# Refactor pass 3: dead code, blind tests, three small simplifications

Base: main at `e2d1af8` (clean). Status: REVIEWED by `/plan-eng-review` on 2026-10-05 (section 12), eight findings fixed in place. Owner gave the go on 2026-10-05; execution starts with wave 0.

Sources: six audits and six refutation passes (`audit-*.md`, `verify-*.md`, areas APP, UNIT, E2E, ENG, PY, GATE)
written against `e2d1af8`. Every promoted finding was re-opened at its anchor by the planner; Appendix B gives the
grep for each anchor. Earlier passes: `docs/plans/2026-09-30-quality-refactor.md`,
`docs/plans/2026-10-03-complexity-refactor.md`, `docs/plans/2026-10-04-close-out.md`.

Conventions used below:

- `TAP` means `node --test --test-reporter=tap`.
- `CHROME` means `CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` (unset in lane shells
  by default; without it `tests/harness.test.js` and `tests/e2e.test.js` select one skip placeholder and prove nothing).
- `S` is the planner's session scratch directory holding `measure.js`. It is session-scoped and will not exist for the
  integrator; section 1 says what to do then.
- A test "count" is the `# tests N` line of the TAP output, or the `Ran N tests` line of unittest.

## 1. Goal and Done-when

Goal: less complex code paths, unit and e2e suites that test what they say they test, no dead code, no regression.
This is the third pass, so the plan is small on purpose: 7 lanes, 0 new e2e tests, 11 new mutants, 0 deck or visual change.

Done when all of the following hold at the final merge SHA on main:

1. CI workflow `validate.yml` is green in every job: `data integrity`, `python suites`, `js suites (unit + e2e)`,
   `suite health`, `mutation gate shard 1/4` to `4/4`, `mutation gate`, `panel fit (fallback)`, `panel fit (real)`.
   The commands those jobs run:
   - `python3 tools/validate.py`, `node tools/boot_sim.js`, `python3 tools/refresh_mutants.py --check`
   - `python -W error::ResourceWarning tests/suite_health.py --emit-python artifacts/python-results.json`
   - `python3 tests/suite_health.py --emit-js artifacts/js-results.json`
   - `python3 tests/suite_health.py --verify artifacts/python-results.json artifacts/js-results.json` (`--verify` takes exactly two artifact paths; bare, it exits 2)
2. `git diff e2d1af8 -- data/decks.json` is empty.
3. `python3 tools/inline_engine.py --check` and `python3 tools/sync_decks.py --check` both print their `OK` line.
4. Every row of the dead-code accounting (section 3.3) is in one of three states: removed, owner-gated with a
   question in section 10, or kept with a reason.
5. FLOORS in `tests/suite_health.py` and the README mutant count equal main's CI artifacts (lane CL).

Complexity is reported, not gated. Method: cc = 1 + each `if / for / while / do / case / catch / ?: / && / || / ??`,
nested functions counted separately. The integrator re-measures after the last merge with
`node <S>/measure.js <repo>` (needs `acorn` in `<S>/node_modules`). If `S` is gone, the integrator reports "not
re-measured" for this table and the lanes' Accept lines still stand on their own.

| Function | BASE cc / lines / depth | Target | Lane |
|---|---|---|---|
| `tools/probe/panel_fit.js` `runFont` | 35 / 159 / 7 | cc <= 27, lines <= 140 | PF |
| `tools/probe/panel_fit.js` `<callback forEach>` inside `runFont` | 21 / 35 / 4 | cc <= 15 | PF |
| `tools/regen_card_fixture.js` `diffGen` | 13 / 20 / 5 | cc <= 6, depth <= 2 | SB |
| `tools/sandbox.js` `boot` | 34 / 356 / 4 | cc <= 32 | SB |
| `tools/sandbox.js` (file) | 585 lines | <= 560 lines | SB |
| `index.html` app script (unit) | 2610 lines | fewer; no function gains cc | AP |

## 2. Non-goals, owner-gated, deferred

### 2.1 Non-goals (hold for every lane)

- No change to deck data, diagram geometry, the visual system, card copy or the label rule.
- No weakened assertion. No deleted test without a named replacement that kills the same mutants. No test is renamed.
- No bulk mutant retirement. No mutant is deleted by this plan.
- No new dependency, no `package.json`, no build step, no `<script src>`.
- No Amy label or marking on any deck or card.
- No edit to `tests/suite_health.py` FLOORS or the README mutant count outside lane CL.
- No hand edit inside an engine region or the `const DECKS` line of `index.html`.

### 2.2 Owner-gated (not started; questions in section 10)

`PRINT_PAPER.css` (APP-3 / APP-D7), six remaining stub guards (APP-1), paper-select tests (APP-2 / E2E-5 /
E2E-D6), warning wipe on disarm (APP-8), real-font criterion (E2E-1), full id derivation (UNIT-1 remainder, UNIT-2),
ambiguous-anchor refusal (GATE-5), line-ref ratchet widening (GATE-6 remainder), duplicate mutants (GATE-7),
`regen_data_mutants.py --check` (GATE-D5), tautological asserts in `check_2` (PY-3), `tools/research/` (PY-D6),
README section "Optional: Claude Code follow-up prompt" and `tests/CONTRACT.md` `hpfc` trap line (APP-6 remainder).

### 2.3 Deferred (not this pass; reason each)

| ID | Reason |
|---|---|
| ENG-4 / ENG-D15 | Unreachable only from today's callers, not by construction; strands two voicing mutants for a three-line saving. |
| PY-5 | Five test workarounds across the palette readers; verifier found the cost understated. Needs its own plan. |
| E2E-4 | Costs a second Chrome launch and an e2e probe test for a hook nothing else depends on. |
| E2E-6 / E2E-D1 | Verified on 27 tests only; 88 `finally` blocks need manual unwrapping; full proof is CI-only. |
| E2E-8 | Makes every local tool launch Chrome on a Mac where it skips today; local behaviour change, no CI effect. |
| GATE-1 | Do GATE-2 first (lane PG) and re-read shard times; reopen trigger is at `docs/plans/2026-10-01-post-refactor-triage.md:93`. |
| GATE-4 | Needs a new artifact field; no lane needs the data. |
| GATE-8 | Saves about 3 s; risks a wrong-reason kill on the two `mh_*` patches inside `staleMutants`. |
| GATE-9 | Stated oracle cannot pass at BASE (the tool rewrites all 11 `b_*` hunk headers). |
| GATE-10 (`verify_js` extension) | Three `hc_*` patches there are ambiguous-anchored; only the floor row is raised (lane CL). |
| UNIT-7 | Needs Chrome-free harness seams; three tests gained. |
| UNIT-8 | Overlap claim is UNDECIDED. |
| UNIT-9 (rename of the `app.test.js` "sequence source link" test; CONTRACT rule 7 wording) | Rename orphans two mutant headers for a cosmetic gain. |
| GATE-D10 (dated measurements) | UNDECIDED in part: dated figures are history, not dead text. Only the two confirmed items are fixed (lane PG). |

## 3. Findings

### 3.1 Promoted findings

"Why now" is the one-line case for spending a lane's risk on it in a third pass.

| ID | Finding | Change | First test | Oracle after | Lane | Why now |
|---|---|---|---|---|---|---|
| UNIT-3 | Sandbox `textContent` setter keeps children, so the app carries two child-clearing loops that are no-ops in a browser | Setter clears children | red at BASE | unit test + `r3s_` mutant | SB-1 | Unblocks removal of app code that exists only for the stub |
| UNIT-1 (reduced), UNIT-D1, UNIT-D11 | Sandbox serves `scale-slots` (not in markup) and `settings-title` (never looked up) | Delete both ids; pin the list against markup and lookups | red at BASE | unit test + mutant | SB-2 | A renamed markup id passes every suite today |
| UNIT-D12 (stub half) | Sandbox has no `.announce` node, so the app's fallback branch runs on every boot and never in a browser | Seed the markup node in the stub | red at BASE | unit test + mutant | SB-3 | Unblocks AP-1 |
| UNIT-6, UNIT-D2..D7, D9 | Sandbox options, exports and stubs with no caller | Delete | green characterisation | three unit suites, `boot_sim`, fixture `--check` | SB-4 | Dead code; `boot` is the second most complex function in the repo |
| UNIT-D8 | `location.origin` IS read (`shareLink`); deletion test could not see it | Keep; pin it | red-capable test | unit test | SB-4 | Refuted row turned into a pin so the next pass does not delete it |
| UNIT-4 | `isStop` (`!disabled`, `getClientRects`) unpinned: both mutations pass 272/272 | Two tests | green at BASE, red under each mutation | 2 mutants | SB-5 | Keyboard reachability with zero oracle |
| UNIT-10 | `diffGen` is a weaker copy of `diffAll`: extra card or rail passes, missing mode throws | `diffGen` delegates to `diffAll`; rails union | red at BASE | unit test + mutant | SB-6 | The `--gen --check` tool is the AP3-0 oracle |
| UNIT-9 (part) | Stale sandbox comments, `app.test.js` header "59 cards" | Text | n/a | n/a | SB-7 | Rides with the lane that owns the file |
| ENG-1 | Two literal NUL bytes in `tests/share.test.js`; plain `grep` skips the file | `"1\0\0"` escape | green characterisation | named test, `file` output | EN-1 | Every grep-based audit of that file is silently empty |
| ENG-2, ENG-D1..D13 | Engine exports, methods and loader options with no consumer | Delete | green characterisation | engine suites, corpus `--check` | EN-2 | Dead code; strand 0 |
| ENG-3 | `fromBuiltin` re-implements `specFrom` | Call `specFrom(deck)` | green characterisation | pdf suites, parity | EN-3 | Restores parity with `tools/decks.py::_from_canonical` |
| ENG-D16, ENG-D17 | Unused params `phase`, `w`, `h`; dead guard `if (carry)` | Delete | green characterisation | engine suites | EN-2 | Dead code; strand 0 |
| ENG-5 (items 1-3) | Stale text: loader header `midiOf`, spec section 14 globals, `(pick() does)` | Text | n/a | n/a | EN-4 | Rides with the lane |
| E2E-2 | Wheel-momentum test has an upper timing margin under 25 ms (failed once at 205 ms) | Pause hook + reorder; wait stays 180 ms | green characterisation + probe | named e2e test, `sw_wheel_flight_guard_dropped` | HX-1 | The one measured flake source in the e2e suite |
| E2E-9, E2E-D3 | Two waits that bound nothing (pass at 0 ms; their mutants still die) | Delete | probe | two named e2e tests + their mutants | HX-2 | Dead waits read as timing bounds and get copied |
| E2E-3 | `settle()` throwing at its ceiling is unpinned (line deleted: harness 11/11) | One harness test | green at BASE, red under mutation | mutant | HX-3 | The strict-settle contract every e2e test leans on |
| E2E-7 | `waitFor` swallows the evaluation error; a typo reads as a timeout | Report last error | red at BASE | harness test + mutant | HX-4 | Cheap; turns a 5 s mystery into a message |
| GATE-2 | `RunNodeFileTimeoutTest` spends 35 s on two grace constants | Shrink both in the test only | green characterisation | `Ran 5 tests`, about 15 s; three `e_*` mutants still die | PG-1 | 20 s off the python job and 10 to 25 s off three mutants |
| GATE-3 | Profile-dir assertion reads shared TMPDIR; 1 in 7 wrong-reason failures under concurrent Chrome | Private temp dir + decoys | green characterisation | same test | PG-2 | Observed flake, and a wrong-reason kill for one mutant |
| X-1 | `_assert_vectors_match` takes 6 to 10 s per page to build a diff on failure; a parity break times out instead of reporting | Compare, then `self.fail` with first difference | green characterisation + timed proof | `tests.test_pdf_parity` | PG-3 | A real parity regression currently looks like a hung job |
| PY-4 | `assertRepoUntouched` asserts a path prefix, not the repo | sha256 snapshot of the six PDFs | green + one-off red proof | `tests.test_pdf_build` | PG-4 | Named for a guarantee it does not give |
| PY-7 | `test_pdf_emitter` leaks its temp dir | `shutil.rmtree` in `tearDownClass` | n/a | suite stays 7 OK | PG-5 | One line |
| GATE-D1..D3, PY-D1, D2, D3, D5 | Unused exports, attribute, `**kw`, recorder methods, constant, imports | Delete | green characterisation | owning suites | PG-6 | Dead code; strand 0 |
| GATE-6 (part), GATE-D10 (part), PY-6 | Stale line refs and counts in comments | Text | n/a | n/a | PG-7 | Rides with the lane |
| UNIT-D13 / APP-D3, UNIT-D12 / APP-D4 | Count-clearing loops; announce fallback | Delete | SB-1, SB-3 | unit suites, fixtures | AP-1 | Dead in a browser |
| APP-D1 / UNIT-D14, APP-D2 / UNIT-D15 | Card keydown guard with no live target; `.prints` bubble stop with no bubble listener | Delete | green characterisation | three named e2e tests | AP-2 | Dead since the menu-shell change |
| APP-4, APP-D5, APP-D6 | `releaseDecision` param `mouse`, `wheel.sy`: never read | Delete | green characterisation | two table tests | AP-3 | Dead; table rows currently imply `mouse` matters |
| APP-9, APP-D9 | Dead `aria-label` write in `setSheetMode` (always overwritten by `markPan`) | Delete | green characterisation | preview suite | AP-4 | Dead write |
| APP-D10 (`--sep`) | CSS token with no consumer | Delete token and its comment | green characterisation | unit suites, panel fit | AP-5 | The comment itself calls it dead |
| APP-7 | Three stale comments (`fit_note`, `:4954`, orphaned JSDoc tail) | Text | n/a | n/a | AP-6 | One contradicts CLAUDE.md's label rule |
| UNIT-5 | `runFont` tally and width-set logic untested: four mutations pass 39/39 | Extract three pure helpers, test them | red at BASE | 3 tests + 3 mutants | PF-1..3 | Most complex function in the repo, zero unit oracle on its arithmetic |
| X-2 / GATE-10 (row) | `tests/pdfcards.test.js` floor 15, suite runs 16 | Raise row | n/a | `suite health` | CL-1 | One test could vanish unnoticed |
| APP-5 | Six TODOS sections describe a print sheet that no longer exists | Delete sections | n/a | n/a | CL-3 | Misleads the next planner |
| APP-6 (part), UNIT-9 (ENGINE-SPEC path) | README control name and loop wording; spec cites the wrong sandbox path | Text | n/a | `tests.test_readme_currency` stays 11 OK | CL-4 | User-facing doc is two UI generations behind |

### 3.2 Accounting: every audit ID

Verdict is the verify file's. "Planner" marks a row the planner re-ran or re-read; how is in Appendix A or the lane.

| ID | Verdict | Where it went |
|---|---|---|
| APP-1 | CONFIRMED | Two of eight guards go (AP-1: loops, announce fallback). Six stay: owner-gated, Q2 |
| APP-2 | CONFIRMED in part ("cannot fail" REFUTED) | Owner-gated, Q3. Tests stay as regression guards |
| APP-3, APP-D7 | CONFIRMED, TEST-ONLY with a mutant on the same line (`p_print_paper_height_restored`) | Owner-gated, Q1 |
| APP-4, APP-D5, APP-D6 | CONFIRMED | AP-3 |
| APP-5 | CONFIRMED | CL-3 |
| APP-6 | CONFIRMED | CL-4 for lines 46 and 57; the follow-up-prompt section is owner-gated, Q12 |
| APP-7 | CONFIRMED in part | AP-6 |
| APP-8 | CONFIRMED (gap), first test REFUTED | Owner-gated, Q4: behaviour decision |
| APP-9, APP-D9 | CONFIRMED | AP-4 |
| APP-D1, APP-D2 | CONFIRMED | AP-2 |
| APP-D3, APP-D4 | CONFIRMED | AP-1 |
| APP-D8 (`shareLink`) | CONFIRMED, TEST-ONLY, mutant `d_share_reason_composed` depends on it | Kept: mutant depends on it; pinned further by SB-4 |
| APP-D10 | REFUTED for `--sep` (it is dead), CONFIRMED kept for `--tone`, `--gb` | `--sep` removed in AP-5; `--tone` / `--gb` kept by decision (CLAUDE.md, Palettes) |
| APP-D11 (`#panel-scales-group`) | CONFIRMED | Kept: selector of an e2e test and of mutant `e_panel_moved_into_header` |
| APP-D12 (`delBtn.onclick` guard) | CONFIRMED | Kept by decision (in-code comment, queue row 86, N6) |
| APP-D13 (`res-*`) | CONFIRMED | Kept: live (`panelStops`) |
| APP-D14 | REFUTED for `print` / `printCalls`; CONFIRMED for `scale-slots`; UNDECIDED for `fireWindow` | `scale-slots`: SB-2. `print` / `printCalls`: kept (negative oracle at `app.test.js` `app.printCalls()`). `fireWindow`: planner enumerated callers (Appendix B: none outside `tools/sandbox.js`), removed in SB-4 |
| UNIT-1 | CONFIRMED | Reduced form in SB-2; full derivation from markup owner-gated, Q5 |
| UNIT-2 | CONFIRMED, Forces incomplete | Reduced to the `.announce` seed (SB-3); the rest is owner-gated with UNIT-1, Q5 |
| UNIT-3 | CONFIRMED; planner re-ran (stub fix + both loops removed: 272/272, preview 14, layout 53, fixtures match) | SB-1, then AP-1 |
| UNIT-4 | CONFIRMED | SB-5 |
| UNIT-5 | CONFIRMED | PF |
| UNIT-6 | CONFIRMED | SB-4 |
| UNIT-7 | CONFIRMED | Deferred |
| UNIT-8 | CONFIRMED; overlap UNDECIDED | Deferred |
| UNIT-9 | CONFIRMED | SB-7 (sandbox comments, "59 cards"), CL-4 (ENGINE-SPEC path); rename and CONTRACT rule 7 deferred; CONTRACT `hpfc` line in Q12 |
| UNIT-10 | CONFIRMED by experiment | SB-6 |
| UNIT-D1 | CONFIRMED | SB-2 |
| UNIT-D2..D7 | CONFIRMED | SB-4 |
| UNIT-D8 | REFUTED in part (`origin` is read) | `origin` kept and pinned (SB-4); the other location members go in SB-4 |
| UNIT-D9 | CONFIRMED | SB-4 |
| UNIT-D10 | CONFIRMED (leave) | Kept: only negative oracle for "never calls window.print" |
| UNIT-D11 | CONFIRMED | SB-2 |
| UNIT-D12 | CONFIRMED (TEST-ONLY, strand 0) | SB-3 then AP-1 |
| UNIT-D13 | CONFIRMED | SB-1 then AP-1 |
| UNIT-D14, UNIT-D15 | CONFIRMED, browser-checked | AP-2 |
| E2E-1 | CONFIRMED | Owner-gated, Q6: the criterion is the owner's |
| E2E-2 | CONFIRMED, change corrected by verifier | HX-1 (with the reorder) |
| E2E-3 | CONFIRMED | HX-3 |
| E2E-4 | CONFIRMED | Deferred |
| E2E-5, E2E-D6 | CONFIRMED (owner-gated); "cannot fail" too strong | The two guards go in AP-2 under auto-decision 1; the tests stay, Q3 |
| E2E-6, E2E-D1 | CONFIRMED (sample only) | Deferred |
| E2E-7 | CONFIRMED (core), cost argument REFUTED | HX-4 |
| E2E-8 | CONFIRMED | Deferred |
| E2E-9, E2E-D3 | CONFIRMED | HX-2 |
| E2E-D2 | CONFIRMED, moot if E2E-1 moves | Kept until Q6 is answered |
| E2E-D4 (`waitElapsed` label), E2E-D5 (`KNOWN_UNCAUGHT`), E2E-D9, E2E-D10 | CONFIRMED (keep) | Kept by decision (`docs/plans/2026-10-04-close-out.md:161`) or live inside `cdp.js` |
| E2E-D7 (autoplay flag) | CONFIRMED (keep) | Kept by decision; not touched |
| E2E-D8 (pinned browser paths) | UNDECIDED | Kept: removal is not equivalent on a host with both browsers |
| ENG-1 | CONFIRMED | EN-1 |
| ENG-2, ENG-D1..D13 | CONFIRMED | EN-2 |
| ENG-3 | CONFIRMED | EN-3 |
| ENG-4, ENG-D15 | CONFIRMED with corrections | Deferred |
| ENG-5 | CONFIRMED 3 of 4; item 4 REFUTED | Items 1-3 in EN-4; item 4 dropped (refuted) |
| ENG-D14 | CONFIRMED unreachable, class KEPT-BY-DECISION (ENGINE-SPEC section 8) | Kept, Q13 |
| ENG-D16, ENG-D17 | CONFIRMED | EN-2 |
| ENG-D18, ENG-D20, ENG-D22 | CONFIRMED (kept) | Kept by decision (self-documented guards; port rule), Q13 |
| ENG-D19 | Stays; reached by the v1-pinned realm test and mutant `s_share_order_dropped` | Kept: a mutant and a test depend on it |
| ENG-D21 | CONFIRMED TEST-ONLY | Kept: every name is consumed by tests that mutants select |
| X-1 | CONFIRMED | PG-3 |
| X-2 | CONFIRMED | CL-1 |
| PY-1 | REFUTED (core claim) | Dropped. I2 residue not promoted: one surviving input mutation, no user path |
| PY-2 | REFUTED | Dropped |
| PY-3 | CONFIRMED | Owner-gated, Q10: the fix deletes assertions. Docstring only in PG-7 |
| PY-4 | CONFIRMED | PG-4 |
| PY-5 | CONFIRMED, cost understated | Deferred |
| PY-6 | CONFIRMED, two details wrong | PG-7 |
| PY-7 | CONFIRMED | PG-5 |
| PY-D1, PY-D2, PY-D3, PY-D5 | CONFIRMED | PG-6 |
| PY-D4 (`numbers=False`) | CONFIRMED (TEST-ONLY, leave) | Kept: three label-rule tests use it; symmetric with the JS port |
| PY-D6 (`tools/research/`) | CONFIRMED (facts), class wrong | Owner-gated, Q11 |
| PY-D7 (`bw`, `rad`) | CONFIRMED (leave) | Kept: the defaults are the drawn border |
| GATE-1 | CONFIRMED | Deferred |
| GATE-2 | CONFIRMED | PG-1 |
| GATE-3 | CONFIRMED (observed) | PG-2 |
| GATE-4 | CONFIRMED | Deferred |
| GATE-5 | CONFIRMED (count); growth REFUTED | Owner-gated, Q7: reverses a recorded decision (f683680) |
| GATE-6 | CONFIRMED with corrections | Stale refs fixed by name in PG-7; widening the ratchet owner-gated, Q8 |
| GATE-7 | CONFIRMED | Owner-gated, Q9: mutant deletion |
| GATE-8 | CONFIRMED | Deferred |
| GATE-9, GATE-D4 | CONFIRMED, oracle wrong; slot kept by decision | Deferred / kept |
| GATE-10 | CONFIRMED | Row raised in CL-1; `verify_js` extension deferred |
| GATE-D1, GATE-D2, GATE-D3 | CONFIRMED | PG-6 |
| GATE-D5 | CONFIRMED | Not touched this pass: the stale sentence is the `check_only()` docstring in `tools/regen_data_mutants.py`, which no lane owns; the flag itself is owner-gated, Q9b |
| GATE-D6, GATE-D7, GATE-D8 | CONFIRMED | Kept by decision (legacy aggregates, `validate_floors`, `KNOWN_NON_UNIQUE_ANCHORS` each have a mutant or a contract line) |
| GATE-D9 | CONFIRMED, BEHAVIOUR-BEARING | Kept: documented as deliberate |
| GATE-D10 | UNDECIDED in part | Two confirmed items in PG-7; the rest deferred |

Cross-area notes no verify file ruled on, and that the planner did not verify, are UNDECIDED and appear nowhere
above as work. The two that were ruled on are X-1 and X-2.

### 3.3 Dead-code accounting (reference enumeration)

Enumeration command for every row: `git grep -n -a -w <name> e2d1af8 -- . ':!tests/mutants' ':!docs'`, then
`/usr/bin/grep -l -a -F '<line>' tests/mutants/*.patch` for strands. `-a` is required: `tests/share.test.js` holds NUL bytes.

| Item | Class | References found | State |
|---|---|---|---|
| `tools/sandbox.js` `registerIds`, `opts.extraIds`, returned `registerId` | PROVEN DEAD | definition and header comment only | removed, SB-4 |
| `tools/sandbox.js` exports `makeElement`, `makeLocation` | PROVEN DEAD | consumers import only `boot`, `plain`, `APP` | export removed, SB-4 (functions stay; `boot` uses them) |
| `tools/sandbox.js` `opts.syncTimers`, `opts.innerWidth` | PROVEN DEAD | no `boot(` caller passes either | removed, SB-4 |
| `tools/sandbox.js` injected globals `setInterval`, `clearInterval`, `queueMicrotask`, `URLSearchParams`, `Event`, `TextDecoder`, `structuredClone`; layout `requestAnimationFrame` | UNREACHABLE | 0 uses in the 12 inline script blocks | removed, SB-4 |
| `tools/sandbox.js` returned `fireWindow`, `docEl` | PROVEN DEAD | none outside the file | removed, SB-4 (`docEl` the local stays) |
| `tools/sandbox.js` element `oninput`, `checked`, `remove()`, `removeEventListener`; layout `releasePointerCapture`; location `assign`, `replace`, `reload`, `host`, `protocol`; history `forward`, `go` | UNREACHABLE | app has 0 uses of each | removed, SB-4 |
| `tools/sandbox.js` `location.origin` | LIVE (audit wrong) | `shareLink` in `index.html` | kept, pinned in SB-4 |
| `tools/sandbox.js` `print`, `printCalls` | TEST-ONLY, a test depends on it | `app.test.js` `app.printCalls()` | kept |
| `ELEMENT_IDS` entries `scale-slots`, `settings-title` | UNREACHABLE | not in markup / never looked up | removed, SB-2 |
| `index.html` loops `while (countEmpty.children.length)`, `while (countEl.children.length)` | UNREACHABLE in a browser | `textContent = ""` already clears | removed, AP-1 |
| `index.html` `|| document.createElement("div")` on `const announce` | UNREACHABLE in a browser | static markup `.announce` precedes the script | removed, AP-1. The next line `announce.className = "announce";` stays (not exercised by the planner) |
| `index.html` card keydown guard `e.target.closest("button, select")` | UNREACHABLE | `#card` has no button or select descendant | removed, AP-2 |
| `index.html` `.prints` `onclick="event.stopPropagation()"` | UNREACHABLE | the only listeners above it are capture-phase | removed, AP-2 |
| `releaseDecision` param `mouse`; `wheel.sy` | PROVEN DEAD | destructured / written, never read | removed, AP-3 |
| `setSheetMode` `previewBox.setAttribute("aria-label", ...)` | PROVEN DEAD | overwritten by `markPan` on every path | removed, AP-4 |
| CSS `--sep` | PROVEN DEAD | no `var(--sep)`, no JS write | removed, AP-5 |
| `PRINT_PAPER[*].css` | TEST-ONLY, mutant on the line | one test, `p_print_paper_height_restored` | owner-gated, Q1 |
| `shareLink` | TEST-ONLY, mutant depends | `d_share_reason_composed` | kept |
| Six stub guards (wheelMain, `applyKbOffset` / `hideSheet` sheetSurf, `.filter(Boolean)`, `previewBox.querySelector &&`, `a.closest &&`) | TEST-ONLY (taken only in the sandbox) | APP-1 experiments | owner-gated, Q2 |
| Engine: `Page.prototype.arc`, `Page.prototype.stringWidth`, exports `pdf.escapeText`, `pdf.num`, `core.CAPS`, `layout.CAPS`, `voicing.MAX_NOTES`, `select.rank`, `select.order`, `select.TIERS`, `sequence.sameSequence`, `pdfcards.noteW`, `pdfcards.cardWarnings` | PROVEN DEAD | definition and export line only; app consumes 18 other `HPE.x.y` names | removed, EN-2 (internal functions stay) |
| Engine: `setDash` param `phase`, `Doc.prototype.page` params `w`, `h` (each with its body reads folded to the no-argument value: `num(phase || 0)` to `num(0)`, `w === undefined ? this.w : w` to `this.w`, likewise `h`), `decodeSeed` `if (carry)` | PROVEN DEAD / UNREACHABLE | every caller enumerated by the verifier | removed, EN-2 |
| `tools/engine_loader.js` `extraGlobals`, export `ENGINE_DIR`, `.filter(Boolean)` | PROVEN DEAD | all `loadEngine(` call sites pass one array argument | removed, EN-2 |
| ENG-D14, D18, D20, D22 | KEPT-BY-DECISION | spec section 8, self-labelled guards, port rule | kept, Q13 |
| `tests/shard_mutants.js` exports `suiteOf`, `shardFor`, `E2E_SUITE_MARKERS` | PROVEN DEAD | only `partition`, `isE2ESelecting`, `loadMutants` imported | export removed, PG-6 |
| `tools/refresh_mutants.py` `Ambiguous.count`, `git(**kw)` | PROVEN DEAD | set, never read; four call sites pass no kwargs | removed, PG-6 |
| `tests/test_print.py` `_Path` / `RecordingCanvas` unused methods; `tests/test_render_agreement.py` `RecordingCanvas.rect` | PROVEN DEAD | verifier removed 44 + 5 lines, `Ran 92 tests OK` | removed, PG-6 |
| `tests/paths.py` `FONTS`; `tools/decks.py` second `import os` | PROVEN DEAD | definition only | removed, PG-6 |
| `tools/research/` (11 files) | unreferenced standalone scripts | cited in one plan doc | owner-gated, Q11 |
| GATE-D4, D6, D7, D8, D9; E2E-D4, D5, D7, D9, D10; PY-D4, PY-D7; APP-D11, D12, D13; `--tone`, `--gb`; `hifi.back_card` | KEPT-BY-DECISION or LIVE | see 3.2 | kept |

## 4. Lanes

### 4.1 Waves

| Wave | Lanes | Merge order | Why grouped |
|---|---|---|---|
| 1 | SB, EN, HX, PG | any; SB and EN before wave 2 starts | Disjoint files. No lane in this wave edits the app script, CSS or markup of `index.html`. |
| 2 | AP, PF | AP, then PF | AP needs SB-1, SB-3 and EN merged. AP and PF both add to `tests/app.test.js` (different describes), so they merge serially. |
| 3 | CL | last | Reads main's CI artifacts after everything else is in. |

At most 4 lanes in flight. Wave 2 starts only when SB and EN are merged; HX and PG may still be open then (they
share no file with AP or PF).

Wave 0, before any lane: this plan file lands on main by its own docs-only PR from `claude/rp3-plan` (one file,
`docs/plans/2026-10-05-refactor-pass-3.md`), under the same gates as section 6. Lane and reviewer briefs quote the
plan from main, so no lane starts until that PR is merged and the owner has given the go. Every lane's base is
main after that merge; the docs commit changes no file any lane measures, so the BASE figures in this plan hold.
(Eng review F5.)

Intersections and their order:

| Shared thing | Lanes | Rule |
|---|---|---|
| `tests/app.test.js` | SB (wave 1), AP then PF (wave 2) | Serial by wave and merge order. Each lane edits only the describes / tests named in its Owns. |
| `index.html` engine regions | EN only | Never hand-merged. EN reruns `python3 tools/inline_engine.py` after every merge of main into its branch and commits what it writes. |
| `index.html` outside engine regions | AP only | AP never edits inside a region. On a conflict inside a region AP takes main's side and runs `python3 tools/inline_engine.py --check` (expects `OK`). |
| `const DECKS` line | nobody | If `python3 tools/sync_decks.py --check` is not `OK` on any branch, the lane stops and reports. |
| `tests/mutants/` | every lane | `python3 tools/refresh_mutants.py` rewrites every stranded patch. A lane commits only patches its own diff stranded plus its own new patches, and reverts the rest with `git checkout -- tests/mutants/<other>.patch`. |
| `tests/suite_health.py` FLOORS, README mutant count | CL only | Floors are minimums, so wave 1 and 2 PRs are green without touching them. |

### 4.2 Lane vs mutant patch (by `+++ b/<file>` at BASE)

| Lane | Patches targeting files it edits | Stranded by its diff (must refresh or re-cut) | New |
|---|---|---|---|
| SB | `tools/sandbox.js`: `us_layout_no_parent`. `tools/regen_card_fixture.js`: `ap3_gen_digest_blind`. `tests/app.test.js`: `d_caller_scan_blind_to_escapes`, `d_caller_scan_counts_lines` | up to 4 (line offsets; none carries a line SB changes) | 6 `r3s_` |
| EN | `src/engine/*`: 150 patches | 0 expected (verifier: strand 0 after sync) | 0 |
| HX | `tests/helpers/cdp.js`: 8. `tests/e2e.test.js`: `e_listen_error_never_settles`, `eb_waitelapsed_zero` | 0 expected (no patch carries a changed line) | 2 `r3h_` |
| PG | `tests/shard_mutants.js`: `qe_shard_forgets_harness_suite`. `tests/test_pdf_parity.py`: `qd_p_sweep_iterates_seeds`. `tools/decks.py`: 7. `tests/suite_health.py`: 22. `tests/mutation_harness.test.js`: 2. `tests/mutation_check.sh`: 6 | 1 certain (`c_gen_omitted_vacuous`) | 0 |
| AP | `index.html`: 413 | 18 named in the AP block | 0 |
| PF | `tools/probe/panel_fit.js`: 12 (`mr_fit_*` x4, `uid_fit_*` x8) | up to 12 | 3 `r3p_` |
| CL | `README.md`: `m_readme_card_count_stale`; `tests/suite_health.py`: 22 | 0 expected | 0 |

### 4.3 Common to every lane

- Branch `claude/<short>` in its own worktree made with `git worktree add --detach <path> <base>` then
  `git switch -c claude/<short>`. Never `cp -r` a worktree. No `node_modules` symlink; this repo needs none.
- New test names start with `<LANE>-<step> `, contain no apostrophe, quote or parenthesis, and no existing test is renamed.
- Tests first: the first commit of each step is the test named in the step, in the state named (red or green).
- Local e2e: single tests only, with `--test-name-pattern`, `CHROME` exported, one Chrome at a time. Never the full
  e2e suite and never `tests/mutation_check.sh` locally. CI at the pushed head SHA is the evidence.
- After any change to `src/engine/*.js`: `python3 tools/inline_engine.py`, commit what it writes.
- Mutants: commit the code change, then `python3 tools/refresh_mutants.py`. If a patch cannot be re-anchored,
  re-cut it against the nearest stable line, keep its `# kills:` and `# suite:` headers, and strip any
  `index a..b` line. For each new patch: apply it locally, run its `# suite:` command, read the `not ok` line and
  paste it in the PR body, then `git apply -R`. `# suite:` patterns use `.` for every space and punctuation mark,
  no quotes. Cap: 40 patch files per PR.
- Deliver by PR. The PR body carries every "paste in PR body" item from the lane's Accept lines.
- Cuts and the reviewer's checks. Every "Reviewer must check" line, every expected test count and every mutant
  table in a lane block is written for the lane with NO cut taken. When a lane takes a cut or a STOP branch that
  its own block names, and says which one in the PR body, a check that depends on the cut step is read with that
  step removed: its tests, its mutants and its pasted evidence are not expected, and each expected count drops by
  what the step would have added (the PR body states the resulting numbers). A cut the block does not name is
  still a failure. Evidence a lane block places under one step but which covers the whole lane stays required
  after that step is cut; today that is PF's forced old-vs-new probe run, required whenever any of PF-1, PF-2 or
  PF-3 ships.
- On any error, make the smallest change that still serves the step. If a STOP condition fires, take the cut
  written there and say so in the PR body. Never widen scope.

---

### Lane SB: `claude/rp3-sandbox`

**Goal.** The test sandbox behaves like a browser in the three places where it does not today, carries no dead
surface, and the generated-digest check sees every kind of drift.

**Non-goals.** Deriving `ELEMENT_IDS` from the markup. Relaxing the strict `getElementById` throw. Any edit to
`index.html`. Renaming any test.

**Owns.**
- `tools/sandbox.js` (whole file).
- `tools/regen_card_fixture.js`: functions `diffGen`, `mainGen` (call site only), the trailing `main();` line.
- `tests/app.test.js`: line 5 header comment; one NEW block `describe("SB sandbox contract", ...)` inserted
  immediately before `describe("tab stops follow rendering"`; two NEW tests inside `describe("tab stops follow rendering"`.
- `tests/mutants/r3s_*.patch` (new), and refreshes of `us_layout_no_parent`, `ap3_gen_digest_blind`,
  `d_caller_scan_blind_to_escapes`, `d_caller_scan_counts_lines` if stranded.

**Never touches.** `index.html`, `src/engine/`, `tests/e2e.test.js`, `tests/helpers/cdp.js`, FLOORS, README, `data/`.

**Depends on.** Nothing.

**Steps.**

SB-1 (UNIT-3)
- First commit: test `SB-1 assigning textContent drops the children of an element` in `describe("SB sandbox contract")`:
  build an element with `makeElement` reached through `boot()` (`app.sandbox.document.createElement("div")`),
  `appendChild` a second created element, assign `textContent = ""`, assert `children.length === 0` and the child's
  `parentNode === null`. RED at BASE (children survive).
- Change: in `makeElement`, `set textContent(v)` also runs the same two statements the `innerHTML` setter runs
  (`for (const c of this.children) c.parentNode = null; this.children.length = 0;`).
- Forces: none outside Owns.
- Accept: the test passes; `tests/app.test.js`, `tests/preview.test.js`, `tests/layout.test.js` all `# fail 0`
  (CI job `js suites (unit + e2e)`); both fixture checks print `matches` (pasted in PR body).
- Verify: `TAP tests/app.test.js` expects `# tests 273`, `# fail 0`. `node tools/regen_card_fixture.js --check` and
  `node tools/regen_card_fixture.js --gen --check` each print a `matches` line, exit 0.
- Stale text: none. Makes removable elsewhere: the two count-clearing loops in `index.html` (AP-1 removes them).
- STOP: if either fixture check reports drift, revert the setter change, keep the test marked with
  `{ todo: "SB-1" }`, and report. AP-1 then cuts the loop removal.

SB-2 (UNIT-1 reduced, UNIT-D1, UNIT-D11)
- First commit: test `SB-2 every served id is in the markup and is looked up by the app` in
  `describe("SB sandbox contract")`. It reads `index.html`, strips HTML comments and `<script>` / `<style>` blocks,
  collects every `id="..."`; from the text after `const DECKS` it collects every literal `getElementById("...")` and
  `$("...")` argument; asserts every entry of `ELEMENT_IDS` is in both sets. RED at BASE, naming `scale-slots`
  (neither set) and `settings-title` (not looked up).
- Change: delete `"scale-slots"` and `"settings-title"` from `ELEMENT_IDS`.
- Forces: none.
- Accept: the test passes; the three unit suites `# fail 0`; `node tools/boot_sim.js` exits 0.
- Verify: `TAP tests/app.test.js` expects `# tests 274`, `# fail 0`. `node tools/boot_sim.js` last line starts `exercised 96 cards`.
- Stale text: none.
- STOP: if removing `settings-title` fails any suite, restore that one id and drop the "is looked up" half of the
  assertion for it by name (an explicit one-entry exception list in the test, with a comment). `scale-slots` still goes.

SB-3 (UNIT-D12, stub half)
- First commit: test `SB-3 the announcer is a markup node, not one the app created` in
  `describe("SB sandbox contract")`: `const app = boot(); assert.ok(app.announcer()); assert.ok(!app.created.includes(app.announcer()));`.
  RED at BASE (the app's fallback creates it).
- Change: in `boot`, after `const created = [];`, when the HTML contains `<div class="announce"`, build one element
  with class `announce`, keep it in a `markupNodes` array, and include `...markupNodes` in `all()`.
- Forces: none.
- Accept: the test passes; the three unit suites `# fail 0`; both fixture checks `matches`; `boot_sim` exits 0.
  The planner ran this exact change at BASE together with SB-1 and AP-1: 272/272, 14/14, 53/53, fixtures match.
- Verify: `TAP tests/app.test.js` expects `# tests 275`, `# fail 0`.
- Stale text: none. Makes removable elsewhere: the announce fallback in `index.html` (AP-1).
- STOP: if a fixture drifts, revert the change, mark the test `{ todo: "SB-3" }`, report. AP-1 then keeps the fallback.

SB-4 (UNIT-6, UNIT-D2..D9)
- First commit: test `SB-4 shareLink starts with the location origin and path` in `describe("SB sandbox contract")`:
  boot with a custom deck the way the existing `shareLink(CUSTOM[...])` test does, assert the result starts with
  `app.sandbox.location.origin + app.sandbox.location.pathname` and does not start with `undefined`. GREEN at BASE.
  This is a characterisation for a pure deletion; it covers the one member the audit wrongly listed as dead. Modes
  covered: default boot. Not covered: `layout: true` boot (the purge touches `releasePointerCapture` and
  `requestAnimationFrame` there; `tests/layout.test.js` and `tests/preview.test.js` are the characterisation).
- Change: delete every item in section 3.3 marked "removed, SB-4". Keep `location.origin`, `print`, `printCalls`,
  the `ELEMENT_IDS` export, `boot`, `plain`, `APP`. `innerWidth` becomes the literal `1024`.
- Forces: none (no consumer imports a removed name; Appendix B).
- Accept: `module.exports` of `tools/sandbox.js` is exactly `{ boot, plain, ELEMENT_IDS, APP }`; the three unit suites
  `# fail 0`; `boot_sim` exit 0; both fixture checks `matches`; `python3 tools/validate.py` prints
  `validate.py: all checks passed`. CI jobs `js suites (unit + e2e)` and `data integrity`.
- Verify: `TAP tests/app.test.js` expects `# tests 276`, `# fail 0`; `TAP tests/preview.test.js` `# tests 14`;
  `TAP tests/layout.test.js` `# tests 53`.
- Stale text: `tools/sandbox.js` header comment and `boot` JSDoc lines that name `registerIds`, `extraIds`, `syncTimers`.
  Goes stale elsewhere: the clause `Same list as sandbox.js.` in `tools/engine_loader.js` (EN-4 deletes it).
- STOP: any removed member that makes a suite fail is restored individually and listed in the PR body as "live,
  audit wrong"; the rest of the purge proceeds.

SB-5 (UNIT-4)
- First commit: two tests inside `describe("tab stops follow rendering")`:
  `SB-5 Tab in an empty ADD sheet never lands on the disabled GENERATE` and
  `SB-5 Tab in the ADD sheet skips a control inside a hidden row`. Bodies: open the sheet with
  `app.run("openScaleSheet()")`, dispatch 30 (40) `keydown` Tab events on `app.els["scale-sheet"]`, collect
  `app.activeId()`; first asserts `scale-back` and `scale-box` were reached and `scale-generate` was not; second
  sets `editingId = 'x'` AFTER `openScaleSheet()` returns (the open calls `resetSheetState(null)`, which nulls it),
  asserts as a precondition that the `scale-name` row is hidden, then asserts `scale-name` was never reached. A
  test whose precondition does not hold is vacuous: if the row cannot be hidden this way in the sandbox, cut the
  second test and its mutant and say so in the PR body. GREEN at BASE; each goes red under one
  `isStop` mutation (verifier ran both).
- Change: none to product code. New mutants (below).
- Forces: none.
- Accept: both tests pass at BASE; each new mutant is killed by its own test (CI job `mutation gate`; `not ok`
  lines pasted in PR body).
- Verify: `TAP --test-name-pattern 'tab.stops.follow.rendering' tests/app.test.js` expects `# tests 7`, `# fail 0`.
- Stale text: none.
- STOP: if a test is red at BASE, it is wrong; fix the test, not `index.html`.

SB-6 (UNIT-10)
- First commit: test `SB-6 diffGen reports an extra card, an extra rail and a missing mode` in
  `describe("SB sandbox contract")`: `const { diffGen } = require("../tools/regen_card_fixture.js");` with three small
  literal `{ decks, rails }` pairs; asserts one problem string each and no throw. RED at BASE (the file exports
  nothing and runs `main()` on require).
- Change: (a) replace the trailing `main();` with `if (require.main === module) main();` and add
  `module.exports = { diffAll, diffGen };`. (b) `diffGen` body becomes: `diffAll(expected.decks, actual.decks)` with
  each message prefixed `gen `, then one loop over the UNION of `expected.rails` and `actual.rails` keys.
- Forces: none. `tests/app.test.js` test `AP3-0 generated faces and rail DOM match the committed digest` runs the
  tool as a child process and is unaffected by the require guard.
- Accept: the new test passes; `node tools/regen_card_fixture.js --gen --check` prints its `matches` line, exit 0;
  `AP3-0` passes; `ap3_gen_digest_blind` still dies on `AP3-0` (CI job `mutation gate`).
- Verify: `TAP tests/app.test.js` expects `# tests 279`, `# fail 0`.
  `TAP --test-name-pattern '^AP3-0.generated.faces.and.rail.DOM.match.the.committed.digest$' tests/app.test.js`
  expects `# tests 1`, `# pass 1`.
- Stale text: none.
- STOP: if `diffAll`'s messages cannot be reused without changing the built-in `--check` output, keep `diffGen`
  separate and only add the three missing reports (union at mode and card level, union of rails). The test is unchanged.

SB-7 (UNIT-9 part)
- Change: `tests/app.test.js` line 5 "59 cards" becomes "96 cards"; in `tools/sandbox.js` rewrite the comment above
  `innerWidth` and the JSDoc that begins "Fire a window-level event the app listens for" so neither says the app calls `window.print()` or listens for
  `afterprint`. Text only.
- Verify: `TAP tests/app.test.js` still `# tests 279`.

**Mutants.** Stranded: none carries a line SB changes; refresh whatever `refresh_mutants.py` reports among the
four named in Owns. New prefix `r3s` (absent from `ls tests/mutants | sed 's/_.*//' | sort -u` at BASE). 6 new, 10 files at most; cap 40.

| Patch | Target | Mutation | `# suite:` | Expected `not ok` |
|---|---|---|---|---|
| `r3s_textcontent_keeps_children` | `tools/sandbox.js` | setter no longer clears | `node --test --test-name-pattern ^SB-1.assigning.textContent.drops.the.children.of.an.element$ tests/app.test.js` | `not ok ... SB-1 assigning textContent drops the children of an element` |
| `r3s_served_id_not_in_markup` | `tools/sandbox.js` | re-add `"scale-slots"` | `... ^SB-2.every.served.id.is.in.the.markup.and.is.looked.up.by.the.app$ tests/app.test.js` | `not ok ... SB-2 every served id ...` |
| `r3s_announce_node_not_seeded` | `tools/sandbox.js` | `markupNodes` left empty | `... ^SB-3.the.announcer.is.a.markup.node..not.one.the.app.created$ tests/app.test.js` | `not ok ... SB-3 the announcer ...` |
| `r3s_isstop_ignores_disabled` | `index.html` | `isStop` drops `!el.disabled` | `... ^SB-5.Tab.in.an.empty.ADD.sheet.never.lands.on.the.disabled.GENERATE$ tests/app.test.js` | `not ok ... SB-5 Tab in an empty ADD sheet ...` |
| `r3s_isstop_ignores_rects` | `index.html` | `isStop` drops `getClientRects` | `... ^SB-5.Tab.in.the.ADD.sheet.skips.a.control.inside.a.hidden.row$ tests/app.test.js` | `not ok ... SB-5 Tab in the ADD sheet skips ...` |
| `r3s_diffgen_ignores_extra_card` | `tools/regen_card_fixture.js` | card loop iterates expected keys only | `... ^SB-6.diffGen.reports.an.extra.card..an.extra.rail.and.a.missing.mode$ tests/app.test.js` | `not ok ... SB-6 diffGen reports ...` |

The two `isStop` patches must not reuse the hunk of `qa_cycle_tab_stops_no_wrap` or `m2_panel_tab_no_backward_wrap`
(both carry `const isStop` as context): anchor on the `const isStop =` line itself as the changed line.
After AP merges, `r3s_announce_node_not_seeded` kills by boot failure rather than by the assertion; that is the same
test and an acceptable reason (the node is required).

**Split size and cut.** About 120 lines removed, 90 added. If the PR must shrink: SB-6 moves to a follow-up
(nothing depends on it). SB-1 and SB-3 are never cut silently; AP depends on them.

**Reviewer must check (not visible to `/review`).**
- `git diff <base> -- index.html` is empty.
- `module.exports` of `tools/sandbox.js` is exactly the four names.
- No existing test body in `tests/app.test.js` changed (`git diff --stat` shows additions plus one changed comment line).
- Each `r3s_` `not ok` line in the PR body names the test in the table, not a different test.
- CI's `js suites (unit + e2e)` shows `tests/app.test.js` total 279.

---

### Lane EN: `claude/rp3-engine`

**Goal.** The engine modules and their loader export and accept only what something uses.

**Non-goals.** ENG-4 / ENG-D15. ENG-D14, D18, D19, D20, D21, D22. Any behaviour change. Any edit outside the engine
regions of `index.html`.

**Owns.**
- `src/engine/core.js`, `layout.js`, `voicing.js`, `select.js`, `sequence.js`, `pdf.js`, `pdfcards.js`, `pdfdeck.js`,
  `share.js`: only the export lines, methods, params and comments named in the steps.
- `index.html`: the regions between `<!-- engine:<name> begin -->` and `<!-- engine:<name> end -->`, written only by
  `python3 tools/inline_engine.py`.
- `tools/engine_loader.js`.
- `tests/share.test.js`: the one string literal inside test `decode never throws on hostile input`.
- `tests/pdf_builtin.test.js`: the comment block that starts `Reviewer nit from W1a`.
- `docs/ENGINE-SPEC.md`: section 14, the sentence listing the loader's host globals.

**Never touches.** App script, CSS or markup of `index.html`; `tools/sandbox.js`; any other test file; `tests/mutants/`
unless `refresh_mutants.py` reports a strand caused by this diff; FLOORS; README; `data/`.

**Depends on.** Nothing.

**Steps.**

EN-1 (ENG-1)
- First commit: none new. Characterisation is the existing test `decode never throws on hostile input` (GREEN at
  BASE, 1 selected). No new test because the change is to the test's own source bytes.
- Change: replace the two literal NUL bytes in that test's input string with the escape `\0\0` (the string becomes `"1\0\0"`).
- Forces: none.
- Accept: `file tests/share.test.js` no longer says `data`; `git grep -c CAPS -- tests/share.test.js` and plain
  `grep -c CAPS tests/share.test.js` print the same number (pasted in PR body; they already agree at BASE, so the
  `file` line is the check that discriminates); suite count unchanged.
- Verify: `TAP tests/share.test.js` expects `# tests 51`, `# fail 0`.
  `TAP --test-name-pattern '^decode.never.throws.on.hostile.input$' tests/share.test.js` expects `# tests 1`, `# pass 1`.
- Stale text: none. STOP: none (one-line change; if the count differs, revert and report).

EN-2 (ENG-2, ENG-D1..D13, D16, D17)
- First commit: none new. Characterisation: the ten engine suites named in Verify, `tests/app.test.js`, `tests/preview.test.js`,
  `python3 tools/validate.py`, all GREEN at BASE (Appendix A). No new test: a test for "this export is absent"
  would pin dead surface in reverse. Modes not covered by the characterisation: none known; the app consumes 18
  `HPE.x.y` names, none of them removed.
- Change: delete every item in section 3.3 marked "removed, EN-2". For exports, delete the export line only; the
  internal function stays when the module still calls it. `loadEngine(names)` loses `extraGlobals` and its JSDoc
  line; `names` handling becomes `Array.isArray(names) ? names : [names]`; `module.exports = { loadEngine };`.
  Then `python3 tools/inline_engine.py`.
- Forces: none outside Owns (all `loadEngine(` call sites pass one argument; Appendix B).
- Accept: every engine suite keeps its BASE count with `# fail 0`; `python3 tools/inline_engine.py --check` prints
  `engine regions in index.html match src/engine/: OK`; `python3 tools/refresh_mutants.py --check` prints
  `all mutant patches apply cleanly; nothing to refresh`. CI jobs `js suites (unit + e2e)`, `python suites`,
  `data integrity`, `mutation gate`.
- Verify: `TAP tests/core.test.js` 53, `voicing` 16, `naming` 32, `select` 51, `share` 51, `sequence` 43, `pdf` 11,
  `pdf_builtin` 13, `pdfcards` 16, `layout` 53, `tests/app.test.js` 272 (or the count on main if SB merged first),
  each `# fail 0`. `python3 tools/validate.py` last line `validate.py: all checks passed`.
- Stale text: `tools/engine_loader.js` header comment (see EN-4).
- STOP: any single removal that fails a suite or strands a mutant is reverted individually and listed in the PR
  body; the rest proceeds.

EN-3 (ENG-3)
- First commit: none new. Characterisation: `tests/pdf_builtin.test.js` (13), `tests/pdfcards.test.js` (16),
  `python3 -m unittest tests.test_pdf_parity` (11) GREEN at BASE; parity compares every page of every deck.
- Change: in `fromBuiltin`, replace the inlined copy of the spec construction with `var spec = specFrom(deck);` and
  delete the comment block that starts `Reviewer nit from W1a`. Sync.
- Forces: `tests/pdf_builtin.test.js` twin comment (in Owns): reword so it no longer cites the deleted source comment.
- Accept: the three suites keep their counts, `# fail 0` / `OK`. CI jobs `js suites (unit + e2e)`, `python suites`.
- Verify: `TAP tests/pdf_builtin.test.js` `# tests 13`; `python3 -m unittest tests.test_pdf_parity` `Ran 11 tests`, `OK`.
- STOP: if parity fails, revert EN-3 entirely (the two bodies are not equivalent after all) and report.

EN-4 (ENG-5 items 1-3)
- Change, text only: loader header `midiOf` becomes `midiFromName`; ENGINE-SPEC section 14 says the
  test realm DOES have `btoa` and `TextEncoder` (the loader's context object injects them), so the sentence no
  longer reads as a guard; in `src/engine/sequence.js` the comment `(pick() does).` is corrected: `pick` calls
  `homeOrRefuse(deck)`. In the loader, the clause `Same list as sandbox.js.` is deleted (SB-4 makes it false). Sync.
- Verify: `python3 tools/inline_engine.py --check` prints `OK`.

**Mutants.** Stranded: 0 expected (the verifier applied the whole set and got strand 0). If `refresh_mutants.py`
rewrites any patch, commit only those whose target is a file in Owns. New: none. Cap 40.

**Split size and cut.** About 60 lines removed across ten files plus the synced regions. Cut order if the PR
bounces: EN-3 out first, then the loader changes.

**Reviewer must check.**
- `git diff <base> -- index.html` touches only lines inside engine regions, and `inline_engine.py --check` is `OK` at the head SHA.
- No function BODY was deleted where the module still calls it (only export lines).
- `tests/share.test.js` diff is one line, numstat 1/1.
- The removed-globals list in `engine_loader.js` did not remove `URLSearchParams`, `TextDecoder` or
  `structuredClone` unless the PR body shows a grep proving no engine module uses them (they are NOT in this
  lane's scope by default: leave them).

---

### Lane HX: `claude/rp3-e2e`

**Goal.** One flaky timing margin widened, two dead waits gone, two harness contracts pinned.

**Non-goals.** E2E-1, E2E-4, E2E-6, E2E-8. Any new e2e test. Any other `waitElapsed` site (eight others were not probed).

**Owns.**
- `tests/e2e.test.js`: the three tests named in HX-1 and HX-2; the three comments containing
  `index.html:7506-7509`, `index.html:7573-7574`, `index.html:4578`.
- `tests/helpers/cdp.js`: method `waitFor`; the header comment containing `~120 lines`; the comment containing
  `Browser and APP_READY_EXPR are exported`.
- `tests/harness.test.js`: two NEW tests appended after test `EX-3 settle reports a ceiling hit`.
- `tests/mutants/r3h_*.patch` (new).

**Never touches.** `index.html`, `tools/`, `tests/app.test.js`, `tests/suite_health.py`, any other part of `cdp.js`
(in particular `settle`, `launch`, `findBrowser`), FLOORS.

**Depends on.** Nothing.

**Waits touched.**

| Site (label) | Test | Class | ms on main | After | Differential probe (run by the verifier at BASE) |
|---|---|---|---|---|---|
| `the first gesture to end mid-flight` | `card swipe (wheel): momentum wheel events after a committed gesture lands do not step again` | timing bound, both sides: the gap timer must have fired (lower), the fly-out must still be in the air (upper) | 180 | 180, with the fly-out paused so the upper side no longer races | 0 ms fails on "the first gesture must have ended via its own gap timer"; 180 and 400 pass with the hook; without the hook 205 failed once and 215 fails. `sw_wheel_flight_guard_dropped` dies at 180 and 400 on "must not start a second, overlapping fly-out animation" |
| `the touch swipe's eatClick decay` | `card swipe: Enter on a focused #next after a settled touch swipe still steps` | none (bounds nothing) | 50 | removed | 0 ms: 4/4 pass on a clean tree; `sw_eatclick_decay_dropped` still dies with `expected "3 / 19", saw "2 / 19"` |
| `the tap to land mid fly-out` | `card swipe: landing a flight during a mid-flight tap cancels a stale mouse-decay timer from the committing drag` | none (the tap only has to land inside a 400 ms window; 0 ms is inside it) | 100 | removed | 0 ms: 4/4 pass; `sw_flight_pointerdown_bypasses_seteatclick` still dies on "must cancel the committing drag's stale decay timer" |

**Steps.**

HX-1 (E2E-2)
- First commit: none new; the named test is the characterisation (GREEN at BASE, 1 selected). It covers the
  gesture-ended and flight-in-air states; it does not cover reduced motion.
- Change, inside that test only: add `await installFlyoutPauseHook();` before the first wheel gesture, and swap the
  two adjacent statements near the end so `await b.finishAnimations();` runs BEFORE
  `await b.waitFor(\`wheel === null && flight === null\`, { label: "the wheel gesture to end and settle", timeout: 1000 });`.
  The `waitElapsed(180, ...)` call is unchanged. The label string appears four times in the file; edit only the
  occurrence inside this test.
- Forces: none.
- Accept: the test passes 5 times in a row locally (five `# pass 1` blocks pasted in PR body); with the wait
  temporarily set to 400 it still passes, with 0 it fails on the gap-timer message (both pasted, then reverted);
  CI job `js suites (unit + e2e)` green; `sw_wheel_flight_guard_dropped` still killed (CI job `mutation gate`).
- Verify: `CHROME TAP --test-name-pattern '^card.swipe..wheel...momentum.wheel.events.after.a.committed.gesture.lands.do.not.step.again$' tests/e2e.test.js`
  expects `# tests 1`, `# pass 1`.
- STOP: if the test times out on "the wheel gesture to end and settle", the swap was not applied to this test's
  occurrence. If it still fails after that, revert HX-1 and report; HX-2 to HX-4 proceed.

HX-2 (E2E-9, E2E-D3)
- First commit: none new; the two named tests are the characterisation (GREEN at BASE).
- Change: delete `await waitElapsed(50, "the touch swipe's eatClick decay");` and
  `await waitElapsed(100, "the tap to land mid fly-out");`. Rewrite the comment directly above the second one so it
  no longer says "~100ms into the ~400ms decay window".
- Forces: none. Neither line is in any mutant patch.
- Accept: each test passes 4 times in a row locally (pasted); CI green; `sw_eatclick_decay_dropped` and
  `sw_flight_pointerdown_bypasses_seteatclick` still killed (CI job `mutation gate`). Differential probe at the
  lane head, pasted in PR body: `git apply` each of the two patches in turn, run that patch's own test with the
  Verify pattern below, paste the `not ok` line and its assertion message, then `git apply -R`. The message must be
  the one the patch is aimed at, the same one it produces on main.
  (Eng review F4: the gate alone cannot tell a kill for the wrong reason.)
- Verify:
  `CHROME TAP --test-name-pattern '^card.swipe..Enter.on.a.focused..next.after.a.settled.touch.swipe.still.steps$' tests/e2e.test.js`
  and
  `CHROME TAP --test-name-pattern '^card.swipe..landing.a.flight.during.a.mid-flight.tap.cancels.a.stale.mouse-decay.timer.from.the.committing.drag$' tests/e2e.test.js`,
  each `# tests 1`, `# pass 1`.
- STOP: if either mutant survives in CI, restore that one wait at main's value and report.

HX-3 (E2E-3)
- First commit: test `HX-3 settle rejects at its ceiling unless strictSettle is off` in `tests/harness.test.js`,
  built like the existing "gives up at its 500ms ceiling" test (`Object.create(Browser.prototype)`, a stuck
  animation) but WITHOUT setting `strictSettle = false`; asserts `assert.rejects(b.settle(), /E2E-SETTLE-CEILING/)`.
  GREEN at BASE; red when the `throw` line in `settle` is removed (verifier: deleting it leaves the suite 11/11 today).
- Change: none to `cdp.js`.
- Accept: test passes; mutant `r3h_settle_ceiling_never_throws` killed by it.
- Verify: `CHROME TAP tests/harness.test.js` expects `# tests 12`, `# fail 0`, `# skipped 0`.
- STOP: none.

HX-4 (E2E-7)
- First commit: test `HX-4 waitFor names the last evaluation error when it times out` in `tests/harness.test.js`:
  a `Browser` whose `eval` always rejects with `new Error("boom")`; asserts
  `assert.rejects(b.waitFor("x", { timeout: 60, label: "L" }), /timed out waiting for L.*last error: .*boom/)`.
  RED at BASE (the error is swallowed).
- Change: in `waitFor`, remember the last rejection from `this.eval(...)` instead of discarding it, and append
  `" (last error: " + msg + ")"` to the timeout message when there was one. The message still starts with
  `timed out waiting for <label>`. Timeout default and polling are unchanged.
- Forces: none. No test or patch contains `timed out waiting for`.
- Accept: test passes; `r3h_waitfor_drops_last_error` killed by it; CI `js suites (unit + e2e)` green.
- Verify: `CHROME TAP tests/harness.test.js` expects `# tests 13`, `# fail 0`, `# skipped 0`.
- Stale text (this lane): `cdp.js` header `~120 lines` (state no line count); the `APP_READY_EXPR` export comment
  (harness does not reference it; say who does, or drop the clause); the three `e2e.test.js` comments citing old
  `index.html` line numbers (name the function instead of the line).
- STOP: if any existing e2e test in CI fails on a changed message, the message prefix was altered; restore it.

**e2e seconds.** New e2e tests: 0. Removed waits: 0.15 s. Harness: 2 tests, under 1 s together, in the
`js suites (unit + e2e)` step (163 to 253 s over the last five runs). The sandbox cannot pin HX-3 or HX-4: both are
contracts of the CDP `Browser` class, which the sandbox does not load.

**Mutants.** Stranded: 0 expected; the 8 `cdp.js` patches shift by offset only. New prefix `r3h` (absent at BASE). 2 new. Cap 40.

| Patch | Target | Mutation | `# suite:` | Expected `not ok` |
|---|---|---|---|---|
| `r3h_settle_ceiling_never_throws` | `tests/helpers/cdp.js` | the `throw new Error(msg)` after the ceiling is removed | `node --test --test-name-pattern ^HX-3.settle.rejects.at.its.ceiling.unless.strictSettle.is.off$ tests/harness.test.js` | `not ok ... HX-3 settle rejects at its ceiling unless strictSettle is off` |
| `r3h_waitfor_drops_last_error` | `tests/helpers/cdp.js` | the suffix is never appended | `... ^HX-4.waitFor.names.the.last.evaluation.error.when.it.times.out$ tests/harness.test.js` | `not ok ... HX-4 waitFor names the last evaluation error ...` |

`r3h_settle_ceiling_never_throws` must not share a hunk with `ex_settle_ceiling_silent` or
`qe_settle_ignores_quiet_animations` (both carry `if (this.strictSettle !== false)` as context); check each still applies.

**Split size and cut.** About 40 lines. Cut order: HX-1 (the only step with timing risk), then HX-2.

**Reviewer must check.**
- The wait table above against the diff: 180 unchanged, exactly two `waitElapsed` lines deleted, no other wait touched.
- The swap is inside the momentum test only (the label occurs four times).
- The PR body has the 0 ms / 400 ms probe output for HX-1.
- No e2e test was added or renamed; `tests/e2e.test.js` count in CI is still 263, harness 13.

---

### Lane PG: `claude/rp3-pygate`

**Goal.** Python and gate-harness tests that fail fast and for the right reason; no dead surface in the gate tools.

**Non-goals.** GATE-1, GATE-4, GATE-5, GATE-7, GATE-8, GATE-9. Widening `LINE_REF_FILES` or `LINE_REF_RE`. PY-3's
assertions. Any edit to FLOORS. Any change to `tests/suite_health.py` behaviour (comments only).

**Owns.**
- `tests/test_suite_health.py`: class `RunNodeFileTimeoutTest` (`drive_timeout`, `_hpfc_profile_dirs`,
  `test_a_killed_suites_own_output_reaches_the_excerpt`); the two comments containing `cdp.js:289`.
- `tests/suite_health.py`: comments only: the one containing `~35x`, the one containing `cdp.js:289`.
- `tests/shard_mutants.js`: the `module.exports` line. `tools/refresh_mutants.py`: class `Ambiguous`, function `git`. `tests/mutation_harness.test.js`: the comments containing `mutation_check.sh:242` and
  `line ~533`. `tests/mutation_check.sh`: the comment containing `(line 27)`.
- `tests/test_pdf_parity.py`: `_assert_vectors_match`. `tests/test_pdf_build.py`: class `BuiltDecksTest`.
  `tests/test_pdf_emitter.py`: `tearDownClass`. `tests/test_print.py`: classes `_Path`, `RecordingCanvas`, the five
  comments containing `59 cards`. `tests/test_render_agreement.py`: `RecordingCanvas.rect`. `tests/paths.py`: `FONTS`.
- `tools/decks.py`: the second `import os`; the `GENERATED_OMITTED["blank_cards"]` reason string.
  `tools/validate.py`: module docstring. `tools/inline_engine.py`: the comments containing `core first`.
  `tests/test_deck_data.py`: the comment containing `regen_data_mutants.py:158`.
- `tests/mutants/c_gen_omitted_vacuous.patch` (refresh), plus any of the patches in table 4.2's PG row that
  `refresh_mutants.py` reports stranded by this diff.

**Never touches.** `index.html`, `src/engine/`, `tools/hifi.py`, `tests/*.js` other than the two named, FLOORS,
README, `data/`, `*.pdf`.

**Depends on.** Nothing.

**Steps.**

PG-1 (GATE-2)
- First commit: none new; `RunNodeFileTimeoutTest` is its own characterisation (GREEN at BASE, 5 tests, 35 s).
- Change: `drive_timeout` saves, sets and restores (in the existing `finally`) `suite_health.GROUP_TERM_GRACE = 2`
  and `suite_health.DRAIN_TIMEOUT = 1`, exactly as it already does for `NODE_TIMEOUT`.
- Forces: none; 0 patches target this file.
- Accept: 5 tests, OK, wall time under 20 s (pasted in PR body); mutants `e_escalation_gated_on_the_direct_child`,
  `e_timeout_skips_the_sigterm_grace`, `e_killed_suite_output_is_dropped` still killed (CI job `mutation gate`).
- Verify: `python3 -m unittest -k RunNodeFileTimeoutTest tests.test_suite_health` expects `Ran 5 tests`, `OK`.
- STOP: if any assertion about promptness fails with the smaller constants, raise them to 3 and 2 once; if it
  still fails, revert PG-1 and report.

PG-2 (GATE-3)
- First commit: none new; the test named below is the characterisation (GREEN at BASE when no other Chrome runs).
- Change: `test_a_killed_suites_own_output_reaches_the_excerpt` runs inside a private temp root: create
  `tempfile.mkdtemp()`, create two decoy directories `hpfc-prof-decoy1` and `hpfc-prof-decoy2` in it, set
  `tempfile.tempdir` and `os.environ["TMPDIR"]` to it, restore both and remove the root in `addCleanup`. The
  existing `before == after` assertion is kept unchanged; add two assertions: `_hpfc_profile_dirs()` returns exactly the two
  decoys, and both decoys still exist after the run.
- Forces: none.
- Accept: the test passes with a live Chrome running on the machine (worker starts none; the property is "reads only
  its own root": shown by `_hpfc_profile_dirs()` returning exactly the two decoys, asserted in the test). No
  assertion removed (diff shows additions only inside the test).
- Verify: same command as PG-1, `Ran 5 tests`, `OK`. Full file:
  `python3 -m unittest tests.test_suite_health` expects `Ran 30 tests`, `OK`.
- STOP: if `drive_timeout`'s `TemporaryDirectory` breaks under the private root, set only `tempfile.tempdir`
  (not `TMPDIR`) and keep the decoys.

PG-3 (X-1)
- First commit: none new; `tests.test_pdf_parity` is the characterisation (GREEN, 11 tests).
- Change: in `_assert_vectors_match`, replace `self.assertEqual(a, b, msg)` with: `if a != b:` find the first index
  where they differ (or the shorter length) and `self.fail("%s: first difference at op %d: %r != %r (lengths %d, %d)" % (msg, i, ...))`.
  Same equality, same `subTest`, same message prefix.
- Forces: none. `qd_p_sweep_iterates_seeds` targets this file elsewhere; refresh if stranded.
- Accept: 11 tests OK. One-off proof pasted in PR body, run in a THROWAWAY worktree and never in the lane worktree:
  `git worktree add --detach <scratch>/pg3-proof HEAD` at the lane's committed head, change one drawing constant in
  `src/engine` there, run `python3 tools/inline_engine.py` and `python3 -m unittest -f tests.test_pdf_parity`, show
  it FAILS in under 30 s with a "first difference at op" message, then `git worktree remove --force <scratch>/pg3-proof`.
  Nothing from the proof is committed and the lane worktree is never edited for it. CI job `python suites`.
  (Eng review F3: the earlier text reverted with `git checkout --` on files PG does not own.)
- Verify: `python3 -m unittest tests.test_pdf_parity` expects `Ran 11 tests`, `OK`.
- STOP: none.

PG-4 (PY-4)
- First commit: none new; `tests.test_pdf_build` is the characterisation (GREEN, 11 tests).
- Change: `BuiltDecksTest.setUpClass` records, before building, the sha256 of each of the six committed PDFs under
  `paths.ROOT` (`paths.PDFS`). `assertRepoUntouched` keeps its existing `startswith` assertion and adds: the six
  hashes are unchanged.
- Forces: none.
- Accept: 11 tests OK. One-off proof pasted in PR body, run AFTER the real change is committed, in a THROWAWAY
  worktree: `git worktree add --detach <scratch>/pg4-proof HEAD`, point the build at `paths.ROOT` there, run the
  suite, show `test_all_six_pdfs_build...` FAILS on the new assertion, then
  `git worktree remove --force <scratch>/pg4-proof`. The lane worktree is never edited for the proof, so there is
  nothing to revert or re-apply. `git status --short` clean of PDFs at the head SHA.
  (Eng review F3: the earlier text ran `git checkout --` over the lane's own uncommitted change.)
- Verify: `python3 -m unittest tests.test_pdf_build` expects `Ran 11 tests`, `OK`.
- STOP: none.

PG-5 (PY-7)
- Change: `tests/test_pdf_emitter.py` `tearDownClass` also runs `shutil.rmtree(cls.tmp, ignore_errors=True)` after `cls.doc.close()`;
  add `import shutil` to the file's imports (it has none today).
- Verify: `python3 -m unittest tests.test_pdf_emitter` expects `Ran 7 tests`, `OK`.

PG-6 (GATE-D1, D2, D3; PY-D1, D2, D3, D5)
- First commit: none new; characterisation is the owning suites (GREEN at BASE): `tests/mutation_harness.test.js`
  52, `tests.test_print` 40, `tests.test_render_agreement` 24, `tests.test_gen_deck` 17.
- Change: delete every item in section 3.3 marked "removed, PG-6". `tests/shard_mutants.js` exports become
  `{ isE2ESelecting, loadMutants, partition }` (the three functions stay; only the export names go).
- Forces: none. `qe_shard_forgets_harness_suite` does not carry the exports line.
- Accept: each suite keeps its count; `python3 tools/refresh_mutants.py --check` prints its "nothing to refresh"
  line; CI jobs `python suites`, `js suites (unit + e2e)`, `data integrity`.
- Verify: `TAP tests/mutation_harness.test.js` `# tests 52`, `# fail 0`; `python3 -m unittest tests.test_print`
  `Ran 40 tests`, `OK`; `python3 -m unittest tests.test_render_agreement` `Ran 24 tests`, `OK`;
  `python3 -m unittest tests.test_gen_deck` `Ran 17 tests`, `OK`.
- STOP: a removed recorder method that a test turns out to call is restored individually and listed.

PG-7 (GATE-6 part, GATE-D10 part, PY-6)
- Change, text only. Every fix replaces a line number with the function or marker name, and keeps the line count
  of the comment where a mutant targets the file (22 patches target `tests/suite_health.py`):
  - `tests/suite_health.py`, `tests/test_suite_health.py`: `cdp.js:289` becomes "the spawn in `launchOnce`
    (`tests/helpers/cdp.js`)"; the `~5s ... ~35x` comment drops the two figures.
  - `tests/mutation_harness.test.js`: `mutation_check.sh:242` / `(:265)` become "the `git apply` and `git apply -R`
    calls in `tests/mutation_check.sh`"; `line ~533` becomes "`hunksOf`".
  - `tests/mutation_check.sh`: `(line 27)` becomes "(the `shopt -s nullglob` at the top)".
  - `tools/validate.py` docstring `Checks 2-4` becomes `Checks 2-5`. `tools/inline_engine.py` `core first` wording
    matches the real module order. `tests/test_print.py` five `59 cards` become `96 cards`.
    `tests/test_deck_data.py` `regen_data_mutants.py:158` becomes "the mutant definitions in
    `tools/regen_data_mutants.py`", with no line number.
  - `tools/decks.py` `GENERATED_OMITTED["blank_cards"]`: "asks for 9" becomes "asks for 7" (the value in
    `data/decks.json` is 7). This is a reason string in the print generator, not card copy; no PDF text changes.
- Forces: `tests/mutants/c_gen_omitted_vacuous.patch` carries that string: refresh it.
- Accept: `python3 -W error::ResourceWarning tests/suite_health.py --emit-python <file>` prints
  `python: ran 222, skipped 0, failures 0, errors 0, unexpected successes 0`; `tests.test_readme_currency` 11 OK
  (the line-ref ratchet still passes); `git diff <base> -- '*.pdf' data/decks.json` empty.
- Verify: `python3 -m unittest tests.test_readme_currency` `Ran 11 tests`, `OK`;
  `python3 -m unittest tests.test_gen_deck` `Ran 17 tests`, `OK`; `python3 tools/validate.py` last line `validate.py: all checks passed`.
- STOP: if a comment edit strands more than 3 patches, revert that one comment and list it as still stale.

**Mutants.** Stranded: `c_gen_omitted_vacuous` (certain). New: none, so no new prefix. PG-3 and PG-4 change test
helpers; their evidence is the one-off red proof in the PR body, because a mutant that redirects a build into the
repo would dirty tracked PDFs inside the gate (auto-decision 6). Cap 40.

**Split size and cut.** About 90 lines removed, 60 added, 16 files. Cut order: PG-7 comment fixes outside
`tools/decks.py`, then PG-6.

**Reviewer must check.**
- `tests/suite_health.py` diff is comments only (no token outside a `#` line changes).
- No assertion was removed anywhere: PG-2, PG-3 and PG-4 diffs keep every prior assert or replace
  `assertEqual(a, b)` with an equivalent `if a != b: self.fail(...)`.
- PG-1's constants are restored in `finally` (a leak would slow every later test's kill path the other way: mask real grace bugs).
- The two red proofs (PG-3, PG-4) are in the PR body and the tree at the head SHA has no PDF change.

---

### Lane AP: `claude/rp3-app`

**Goal.** The app script, markup and CSS carry no code that only the old sandbox, or nothing at all, could reach.

**Non-goals.** `PRINT_PAPER.css`. The six stub guards in Q2. The `announce.className = "announce";` line. APP-8.
Any visual change, any copy change, any change inside an engine region or the DECKS line. Paper-select tests.

**Owns.**
- `index.html`, outside engine regions and outside the DECKS line: function `releaseDecision` (signature) and its
  one caller's object literal; the `wheel` state literal and its comment; function `setSheetMode`; the `const announce`
  statement and its comment; the two `while (...children.length)` loops; the `card.addEventListener("keydown", ...)`
  handler and its comment; the `<div class="prints" ...>` opening tag; the `:root` line holding `--sep` and the CSS
  comment containing `--sep now has NO consumer`; the comments containing `fit_note shrinks anything that truly overflows`,
  `` (`:4954`) ``, and the orphaned JSDoc tail above `const PAN_HIT_MIN_PX = 44;`.
- `tests/app.test.js`: tests `AP1-2 releaseDecision table` and `AP1-3 wheelDecision table` (fixture keys only).
- `tests/mutants/`: the 18 patches listed under Mutants (refresh or re-cut).

**Never touches.** `tools/sandbox.js`, `src/engine/`, `tests/e2e.test.js`, `tests/helpers/`, `tools/probe/`, FLOORS,
README, `data/`, any `r3s_` patch unless `refresh_mutants.py` reports it stranded by this diff.

**Depends on.** SB merged (SB-1 and SB-3 not cut) and EN merged. Branch from main after both.

**Steps.**

AP-1 (UNIT-D13 / APP-D3, UNIT-D12 / APP-D4)
- First commit: none new. The tests that fail if this goes wrong already exist and are GREEN on main after SB:
  `SB-1 ...`, `SB-3 ...`, `an unsupported deck clears the card and disables stepping, with no crash`,
  `AP3-4 the rail keeps its scroll across a re-render of the same deal and resets on a new one`, and the two digest
  tests. At BASE (before SB) removing the loops fails exactly those four older tests; that is why SB goes first.
- Change: delete both `while (countEmpty.children.length) ...` and `while (countEl.children.length) ...` loops.
  Change `const announce = document.querySelector(".announce") || document.createElement("div");` to
  `const announce = document.querySelector(".announce");` and delete the two-line comment above it. Leave the next
  line (`announce.className = "announce";`) alone.
- Forces: none outside Owns.
- Accept: `tests/app.test.js`, `tests/preview.test.js`, `tests/layout.test.js` `# fail 0`; both fixture checks
  `matches`; `node tools/boot_sim.js` exit 0 (all pasted). CI `js suites (unit + e2e)` and `data integrity`. The
  planner ran this exact pair of edits with SB-1 and SB-3 applied: 272/272, 14/14, 53/53, fixtures match.
- Verify: `TAP tests/app.test.js` expects the count on main (279 after SB), `# fail 0`.
  `node tools/regen_card_fixture.js --check` and `--gen --check` print `matches`.
- Stale text: none beyond the deleted comment.
- STOP: if SB cut SB-1, skip the loops. If SB cut SB-3, skip the announce edit. If a fixture drifts, revert AP-1 whole.

AP-2 (APP-D1 / UNIT-D14, APP-D2 / UNIT-D15)
- First commit: none new. Characterisation (GREEN at BASE, each 1 selected): e2e tests
  `Enter and Space on a focused card flip it`,
  `Enter on a print button runs its real click handler and does not flip the card`,
  `print controls are never on a card face, and the panel is not inside header/main/footer/card`.
  Two verifiers removed both lines and ran these in Chrome: 3/3 and 4/4. No new e2e test: the property "no control
  lives inside `#card`" is already the third test.
- Change: delete the line `if (e.target && e.target.closest && e.target.closest("button, select")) return;` and
  shorten the comment above the handler to one sentence saying `#card` holds no controls (the third e2e test pins
  that). Delete ` onclick="event.stopPropagation()"` from the `.prints` opening tag.
- Forces: none.
- Accept: the three e2e tests pass locally (pasted); CI green; `f2_card_key_flip_dead`,
  `qe_print_button_enter_skips_closepanel`, `e_panel_moved_into_header` still killed (CI job `mutation gate`).
- Verify: `CHROME TAP --test-name-pattern '^Enter.and.Space.on.a.focused.card.flip.it$' tests/e2e.test.js`,
  `CHROME TAP --test-name-pattern '^Enter.on.a.print.button.runs.its.real.click.handler.and.does.not.flip.the.card$' tests/e2e.test.js`,
  `CHROME TAP --test-name-pattern 'print.controls.are.never.on.a.card.face..and.the.panel.is.not.inside.header.main.footer.card' tests/e2e.test.js`,
  each `# tests 1`, `# pass 1`.
- STOP: if `e_panel_moved_into_header` cannot be re-cut so that it still dies on its own test, restore the `onclick`
  attribute and report (the guard removal proceeds).

AP-3 (APP-4, APP-D5, APP-D6)
- First commit: in `tests/app.test.js`, remove the `mouse` key from the default and from the `mouse flick` row of
  `AP1-2 releaseDecision table` (the row and its expected value stay), and remove `sy: 0` from the fixture of
  `AP1-3 wheelDecision table`. GREEN before and after the product change (the function never read either). No
  assertion changes; no row is deleted.
- Change: drop `mouse` from `releaseDecision`'s destructured parameter and from its caller's object literal; drop
  `sy` from the `wheel` literal and from the `// { sx, sy, axis, fired, skip, timer }` comment.
- Forces: none.
- Accept: both table tests pass; `tests/app.test.js` `# fail 0`; the ten stranded `sw_` / `us_` patches (below)
  refreshed and still killed (CI job `mutation gate`).
- Verify: `TAP --test-name-pattern '^AP1-2.releaseDecision.table$' tests/app.test.js` `# tests 1`, `# pass 1`.
- STOP: if more than 12 patches strand, or any needs a hand re-cut that changes what it mutates, cut AP-3 whole.
  The two named hand re-cuts (`sw_panel_guard_dropped`, `sw_sheet_guard_dropped`) do not change what they mutate.

AP-4 (APP-9, APP-D9)
- First commit: none new. Characterisation: `tests/preview.test.js` (14, GREEN), whose tests read the pan's name
  through the `panName` helper after `openEditSheet` / `openScaleSheet`; covers Add and Edit opens, not a refused open.
- Change: delete the `previewBox.setAttribute("aria-label", PAN_NAMES[panState] + "." + PAN_EDIT_HINT);` statement
  in `setSheetMode`. `PAN_EDIT_HINT` and `markPan` are untouched.
- Accept: `tests/preview.test.js` 14, `# fail 0`; `tests/app.test.js` `# fail 0`. CI `js suites (unit + e2e)`.
- Verify: `TAP tests/preview.test.js` `# tests 14`, `# fail 0`.
- STOP: any preview test failing means a path exists where `markPan` does not run; restore the line and report.

AP-5 (APP-D10, `--sep`)
- First commit: none new. Characterisation: `tests/app.test.js`; CI `panel fit (fallback)` and `panel fit (real)`.
- Change: remove ` --sep:#8a8a8a;` from the `:root` line and delete the CSS comment sentence beginning "Note the
  consequence: --sep now has NO consumer" through its end. In the part of that comment that stays, reword the
  three remaining mentions ("Was var(--sep)", "--sep resolves to", "Retuning --sep") to past tense and say once
  that the token was removed in this pass. Keep the literal `var(--sep)` exactly once in the reworded comment (the
  "Was var(--sep)" mention); the Accept below counts it. The rule `.hdr .l .num{color:#757575; ...}` under it is not touched.
  No other token changes.
- Accept: `git grep -n -a -F -e '--sep:' -- index.html` prints nothing (no definition);
  `git grep -n -a -F -e 'var(--sep)' -- index.html` prints exactly one line, inside that comment (no consumer);
  `ab_color_scheme_dropped` refreshed and `e_contrast_card_greys` re-cut as in Mutants below, both still killed;
  both panel-fit jobs green.
  (Eng review F1: the earlier Accept asked for zero `--sep` matches, which the Change as written could not reach.)
- Verify: `CHROME TAP --test-name-pattern '^documentElement.computes.color.scheme..dark$' tests/e2e.test.js` `# tests 1`, `# pass 1`.
- STOP: none.

AP-6 (APP-7)
- Change, comments only: (a) the sentence ending "fit_note shrinks anything that truly overflows" is replaced by
  CLAUDE.md's statement: in the app the field circle itself bounds a name; `ext` comes from `f_num` on generated
  decks only. (b) `` (`:4954`) `` becomes "(in `disarmDelete`)". (c) The orphaned JSDoc tail above
  `const PAN_HIT_MIN_PX = 44;` is deleted or rejoined to `sizePanHits`' own JSDoc.
- Forces: `c_name_outgrows_its_field`, `r_app_drops_the_label_inflation` carry (a) as context: refresh.
- Verify: `TAP tests/app.test.js` `# fail 0`; `python3 tools/refresh_mutants.py --check` prints "nothing to refresh" after the refresh commit.
- STOP: if either patch needs a hand re-cut, skip (a) and list it as still stale.

**Mutants.** Stranded (18, by fixed-string grep at BASE):
AP-1: `ui_style_survives_empty_seq`. AP-2: `f2_card_key_flip_dead`, `qe_print_button_enter_skips_closepanel`,
`e_panel_moved_into_header` (carries the tag on its own `+`/`-` lines: hand re-cut, same mutation, same headers).
AP-3: `sw_eatclick_armed_on_cancel`, `sw_jitter_hop_guard_dropped`, `sw_wheel_flight_guard_dropped`,
`sw_wheel_panel_guard_dropped`, `us_wheel_ignores_flight`, `sw_cancel_from_event_x`, `sw_mouse_decay_too_long`,
`sw_mouse_decay_zero`, `sw_panel_guard_dropped`, `sw_sheet_guard_dropped` (these last two carry `mouse,` on their
own `-`/`+` lines, which `tools/refresh_mutants.py` cannot re-anchor: hand re-cut, dropping `mouse,` from both the
`-` and the `+` line and nothing else, same headers). AP-5: `ab_color_scheme_dropped`, `e_contrast_card_greys`
(its first hunk carries the deleted comment sentence as context and its `+` line reads the removed token: hand
re-cut, context taken from the reworded comment, `+` line `.hdr .l .num{color:#8a8a8a; font-weight:400}`, the
literal the token held, so the mutant draws the same grey as before; second hunk and headers unchanged).
AP-6: `c_name_outgrows_its_field`, `r_app_drops_the_label_inflation`.
New: none. 18 files against cap 40. `p_print_paper_height_restored` must still apply untouched.

The planner verified AP-1 by execution. AP-2 to AP-5 were each executed by an auditor and a verifier separately;
nobody has run all of AP's edits together with a mutant refresh. That combined run is this lane's own first
local check before pushing.

**Split size and cut.** About 45 lines removed. Cut order under pressure: AP-3 (10 patches), AP-6 (a), AP-5.

**Reviewer must check.**
- `git diff <base> -- index.html` has no hunk inside an engine region or on the DECKS line; `git diff <base> -- data/decks.json` empty.
- `announce.className = "announce";` is still present twice in `index.html`.
- Each refreshed patch mutates the same thing as before (diff of each patch: context and offsets only, except the four hand re-cuts named in Mutants:
  `e_panel_moved_into_header`, `sw_panel_guard_dropped`, `sw_sheet_guard_dropped`, `e_contrast_card_greys`).
- No rendered text, colour, font or size changed: `tests/fixtures/card_face_v1.json` and `gen_face_v1.json` are not in the diff.
- Real-font behaviour: nothing in this lane changes layout; CI `panel fit (real)` at the head SHA is the evidence, not a local run.

---

### Lane PF: `claude/rp3-panelfit`

**Goal.** `runFont`'s arithmetic lives in three pure, tested helpers.

**Non-goals.** Changing what the probe measures, its thresholds, its report text or its exit code. Touching
`judgeCell`, `printReport`, `MEASURE_SRC`. Any `index.html` edit.

**Owns.**
- `tools/probe/panel_fit.js`: function `runFont`; three NEW module-level functions; the `module.exports` object (may only grow).
- `tests/app.test.js`: three NEW tests at the end of `describe("panel fit judge")`.
- `tests/mutants/r3p_*.patch` (new) and refreshes among the 12 `mr_fit_*` / `uid_fit_*` patches.

**Never touches.** `index.html`, `tests/e2e.test.js`, `.github/`, FLOORS, any other describe in `tests/app.test.js`.

**Depends on.** AP merged (shared file `tests/app.test.js`). Branch from main after AP.

**Steps.**

PF-1 (UNIT-5, tally)
- First commit: test `PF-1 tallyJudgement adds fails and reported and keeps the first ten messages` in
  `describe("panel fit judge")`: calls `tallyJudgement(report, j, ["a"], true)` with a hand-built `j` holding 12
  fails and 2 reported, asserts `fail === 12`, `reported === 2`, `first.length === 10`, first entry
  `"<cell>: <msg>"`, and `firstReported` equal to the two exact `"<cell>: <msg>"` strings. With the last argument
  `false` on a fresh report it asserts `reported === 2` STILL (both loops at BASE add `reported`) and
  `firstReported.length === 0`: collecting `firstReported` is the only thing the flag switches. A second call on
  the same report asserts the counts accumulate (`fail === 24`) and `first` stays at its first ten.
  RED at BASE (not exported).
  (Outside review O3: the earlier text had the flag suppress `reported`, which neither loop does.)
- Change: extract the two duplicated loops in `runFont` (the all-rules loop that also tracks `firstReported`, and
  the threshold loop over the first three rules) into one function `tallyJudgement`, exported. Both call sites call it.
- Accept: test passes; `TAP --test-name-pattern 'panel.fit' tests/app.test.js` `# fail 0`; CI `panel fit (fallback)`
  and `panel fit (real)` green.
- Verify: `TAP --test-name-pattern 'panel.fit' tests/app.test.js` expects `# tests 40`, `# fail 0`.
- STOP: if the two loops are not equivalent up to the `reported` / `firstReported` handling, keep them separate,
  export the larger one only, and say so.

PF-2 (UNIT-5, gutter)
- First commit: test `PF-2 tallyGutter counts a cell over half a pixel and keeps the first five`: seven records
  with `gutter` 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0 fed one call each; asserts `gutterCells === 5`, that 0.5 is NOT
  counted, and `gutterFirst` deep-equal to the five exact `gutterMessage(w, h, m, gutter)` strings for 0.6 to 1.0
  in order; one more record at 1.1 makes `gutterCells === 6` and leaves `gutterFirst` unchanged. RED at BASE.
  (Outside review O3: `length <= 5` passed with no message collected at all.)
- Change: move the nested `countGutter` arrow to a module-level `tallyGutter(report, rec, w, h, m)`, exported.
- Verify: same command, `# tests 41`, `# fail 0`.
- STOP: none.

PF-3 (UNIT-5, invariance widths)
- First commit: test `PF-3 invarianceWidths keeps multiples of 16, both sides of a change, start neighbours in range and every sidebar width`:
  literal inputs; asserts the exact sorted array. The range filter (`wLo..wHi`) applies ONLY to the three
  neighbours of each edge start. Sidebar widths are added unfiltered when the row has a sidebar, so the expected
  array for a sidebar row with `wHi = 1300` MUST contain 1440 and 1920; a second case with no sidebar asserts they
  are absent; a third puts an edge start at `wHi` and asserts `wHi + 1` is absent. RED at BASE.
  (Outside review O2: the earlier "sorted and in range" contract would have let the extraction drop 1440 and 1920.)
- Change: extract the width-set construction that precedes the invariance pass into
  `invarianceWidths(...)`, exported, taking plain values (range ends, the start widths, the "vectors differ"
  predicate or precomputed change points, whether the row has a sidebar) and returning a sorted array.
- Accept: test passes; `runFont` cc and lines fall (integrator table, section 1); both panel-fit CI jobs green.
  Those two jobs are NOT evidence for this lane: PF never edits `index.html`, so on PF's PR the probe prints
  `index.html identical to <base>: 0 cells measured` and passes without calling `runFont`. The evidence is a
  forced old-vs-new run on one fixed HTML pair, pasted in the PR body:
  1. `git worktree add --detach <scratch>/pf-old <merge-base with main>` (the unrefactored probe).
  2. In `<scratch>/pf-old`: `node tools/probe/panel_fit.js --base efb682c --candidate e2d1af8 --font fallback > <scratch>/old.txt`.
  3. In the lane worktree at its committed head: the same command `> <scratch>/new.txt`.
  4. `diff <(grep -v 'wall time:' <scratch>/old.txt) <(grep -v 'wall time:' <scratch>/new.txt)` prints nothing
     (the probe's `wall time: N s` line is a clock reading and differs run to run; it is the only line filtered),
     and `grep -c '0 cells measured' <scratch>/new.txt` prints `0`. Paste the `cells measured:` line, every `rule ...:` line, the `invariance failures:` line and the
     final `panel fit:` line from `new.txt`.
  5. Repeat 2 to 4 with `--font real` when Google Fonts is reachable; if it is not, say so in the PR body.
  6. `git worktree remove --force <scratch>/pf-old`.
  `efb682c` and `e2d1af8` are main before and after PR #238, whose `index.html` differs by 33 lines in the
  settings panel, so every rule, the threshold pass, the gutter count and the invariance pass run on real cells.
  Run the probe with its default workers and run no other Chrome-driving command meanwhile; this is the probe,
  not the e2e suite. The pair's verdict (PASS or FAIL) is irrelevant;
  only old equals new matters.
  This run is evidence for the whole lane, not only PF-3: if PF-3 is cut, the lane still runs it for PF-1 and PF-2.
  (Outside review O1: the earlier Accept compared CI job logs that measure zero cells on this PR.)
- Verify: same command, `# tests 42`, `# fail 0`. `TAP tests/app.test.js` expects main's count + 3 (282), `# fail 0`.
- STOP: if the extraction needs `Browser` or page state as a parameter, it is not pure: cut PF-3, keep PF-1 and PF-2.

**Mutants.** Stranded: up to 12 (`mr_fit_res_allowance_all_controls`, `_grown`, `_on_rule_2`, `_ungated`;
`uid_fit_allowance_exempt_emptied`, `_on_rule_3`, `_unconditional`, `uid_fit_gutter_unchecked`,
`uid_fit_heading_allowance_grown`, `uid_fit_invariance_not_fatal`, `uid_fit_scrollbars_not_neutralised`,
`uid_fit_threshold_not_judged`). `uid_fit_gutter_unchecked`, `uid_fit_threshold_not_judged` and
`uid_fit_invariance_not_fatal` mutate code near the moved blocks (`failed()` and `thresholdCell` themselves do not
move): refresh each, and hand re-cut one only if the extraction moved the line it mutates, so that it mutates the
SAME expression in its new place, keeping headers. New prefix `r3p` (absent at BASE). 3 new; 15 files at most; cap 40.

| Patch | Mutation | `# suite:` | Expected `not ok` |
|---|---|---|---|
| `r3p_tally_drops_reported` | `tallyJudgement` never adds `reported` | `node --test --test-name-pattern ^PF-1.tallyJudgement.adds.fails.and.reported.and.keeps.the.first.ten.messages$ tests/app.test.js` | `not ok ... PF-1 tallyJudgement ...` |
| `r3p_gutter_threshold_inclusive` | `> 0.5` becomes `>= 0.5` | `... ^PF-2.tallyGutter.counts.a.cell.over.half.a.pixel.and.keeps.the.first.five$ tests/app.test.js` | `not ok ... PF-2 tallyGutter ...` |
| `r3p_invariance_skips_neighbours` | neighbours of a change point not added | `... ^PF-3.invarianceWidths.keeps.multiples.of.16..both.sides.of.a.change..start.neighbours.in.range.and.every.sidebar.width$ tests/app.test.js` | `not ok ... PF-3 invarianceWidths ...` |

**Split size and cut.** About 60 lines moved, 70 test lines. Cut order: PF-3, then PF-2.

**Reviewer must check.**
- The existing 39 tests in `describe("panel fit judge")` are unchanged; `module.exports` only gained names.
- Every refreshed or re-cut `uid_fit_*` patch still mutates the expression their `# kills:` line describes.
- The PR body carries the forced old-vs-new probe run from PF-3 Accept: an empty `diff` once the `wall time:` line is filtered from both sides, a non-zero
  `cells measured:` line, and the pasted rule, invariance and verdict lines. CI's two panel-fit jobs measure zero
  cells on this PR and prove nothing about it.
- PF-1's test asserts `reported` is added with the flag both ways and `firstReported` only with it; PF-3's
  expected array contains 1440 and 1920 for a sidebar row.
- Real-font evidence is step 5 of the forced run (`--font real`) when Google Fonts was reachable. If it was not, the
  PR body says so and there is no real-font evidence for this lane: CI's `panel fit (real)` measures zero cells on
  this PR, and CI blocks web fonts for the unit suites.

---

### Lane CL: `claude/rp3-close`

**Goal.** Counts and docs match main after the six lanes.

**Non-goals.** Any code change. The README section "Optional: Claude Code follow-up prompt". TODOS section
"The iOS keyboard covers GENERATE CARDS while typing a seed" (cited by code; stays). CONTRACT rule 7.

**Owns.** `tests/suite_health.py` FLOORS table only; `README.md` lines containing `mutant patches under`,
`(the first chip in the deck row)`, `2- or 3-chord loop`; `TODOS.md`; `docs/ENGINE-SPEC.md` section 15, the sentence
containing `tests/helpers/sandbox.js`; `tests/mutants/` refreshes caused by the FLOORS edit.

**Never touches.** Everything else.

**Depends on.** SB, EN, HX, PG, AP, PF all merged, and a completed CI run on main at that SHA.

**Steps.**

CL-1 (X-2, GATE-10 row; FLOORS)
- Change: download main's `js-results` and `python-results` artifacts from the CI run at main's head
  (two single-artifact downloads into one directory, as CI does:
  `gh run download <run-id> -n python-results -D <dl>` then `gh run download <run-id> -n js-results -D <dl>`; one
  call with two `-n` nests each file in a subdirectory named after its artifact, and the Verify paths below miss). Set each FLOORS row to that file's `total`
  (JS) or `by_module` count (python). Expected: `tests/app.test.js` 282, `tests/harness.test.js` 13,
  `tests/pdfcards.test.js` 16, others unchanged; a lane that took a cut changes these, which is why the artifact is the source, not this plan.
- Forces: patches that carry a FLOORS row as context (22 target the file): refresh.
- Accept: CI `suite health` green; no row lowered (`git diff` shows only equal or higher numbers).
- Verify: `python3 tests/suite_health.py --verify <dl>/python-results.json <dl>/js-results.json`, where `<dl>` is the
  directory the two artifacts of main's CI run were downloaded to, exits 0 with `<dl>` holding both JSON files directly (`--verify` reads the two files and runs nothing);
  `python3 -m unittest tests.test_suite_health` `Ran 30 tests`, `OK`.
- STOP: an artifact total LOWER than a current floor means a test vanished: stop and report; do not lower the row.

CL-2 (README mutant count)
- Change: set the number in the README line containing `mutant patches under` to `ls tests/mutants/*.patch | wc -l`
  on main (expected 669 = 658 + 6 + 2 + 3).
- Forces: `m_readme_card_count_stale` targets README elsewhere; refresh if stranded.
- Verify: `python3 -m unittest tests.test_readme_currency` `Ran 11 tests`, `OK`.

CL-3 (APP-5)
- Change: delete from `TODOS.md` the six sections whose headings start: `### Chord-card border: single primary colour`,
  `## The page-level print oracle reconstructs the sheet`, `## Print teardown: coverage and residue gaps`,
  `### The card may render 2-3% over spec on iOS`, `### The A4/Letter paper control is inert on iOS`,
  `### RESOLVED - \`.printpage\` emitted a 792pt block`. Everything else stays byte-identical.
- Accept: `git grep -c -e printGridCSS -e teardownPrintSheet -e '346-mutant' -- TODOS.md` prints nothing; the
  heading `## The iOS keyboard covers GENERATE CARDS while typing a seed` is still present.
- STOP: if a deleted section is cited by a path in `index.html` or `tests/` (`git grep -n 'TODOS.md'`), keep that section.

CL-4 (APP-6 part, UNIT-9 part)
- Change: README `**+ ADD** (the first chip in the deck row)` becomes `**+ ADD A SCALE** (in the menu, under Scales)`;
  `2- or 3-chord loop` becomes `loop of 2 to 6 chords, by tier`; ENGINE-SPEC `tests/helpers/sandbox.js` becomes
  `tools/sandbox.js` (re-exported by `tests/helpers/sandbox.js`).
- Verify: `python3 -m unittest tests.test_readme_currency` `Ran 11 tests`, `OK`.

**Mutants.** New: none. Refresh only. Cap 40.
**Split size and cut.** About 110 lines of prose removed, a handful of numbers changed. No cut; CL-3 and CL-4 can be dropped without affecting Done-when.
**Reviewer must check.** Every FLOORS number against the artifact file attached to the PR; README count against the
directory listing at the head SHA; no row lowered.

## 5. Mutant plan

- BASE: 658 patches. New: 11 (`r3s` 6, `r3h` 2, `r3p` 3). Deleted: 0. Expected at the end: 669.
- Prefix table. None of these appears in `ls tests/mutants | sed 's/_.*//' | sort -u` at BASE.

| Prefix | Lane | Count |
|---|---|---|
| `r3s` | SB | 6 |
| `r3h` | HX | 2 |
| `r3p` | PF | 3 |

- Strand counts by lane: SB 0 certain (up to 4 by offset), EN 0, HX 0, PG 1, AP 18, PF up to 12, CL offsets only.
- Refresh procedure: section 4.3. `tools/refresh_mutants.py` needs a clean tree apart from the lane's committed
  change, rewrites every stranded patch in the directory, and the lane keeps only the ones its diff stranded.
- Multi-file or cross-lane patches and their owner:

| Patch | Why shared | Owner |
|---|---|---|
| `r3s_isstop_ignores_disabled`, `r3s_isstop_ignores_rects` | created by SB, target `index.html` (AP's file) | SB creates; AP refreshes if its diff strands them |
| `r3s_announce_node_not_seeded` | kill reason changes after AP-1 | SB creates; AP confirms it still dies and notes the reason in its PR body |
| `ap3_gen_digest_blind` | targets `tools/regen_card_fixture.js`, selects a test in `tests/app.test.js` | SB |
| `e_panel_moved_into_header` | hand re-cut | AP |
| `c_gen_omitted_vacuous` | `tools/decks.py` | PG |
| any patch with a FLOORS row as context | `tests/suite_health.py` | CL |

- The six patches that patch `tests/mutation_check.sh` itself (five `h_*` and `qe_harness_mutant_scored_survived`):
  PG edits one comment in that script. PG runs `git apply --check` on all six after its change and refreshes any that fail.
- The closing lane CL sets FLOORS and the README count from main's CI artifacts (`js-results` `files[].total`,
  `python-results` `by_module`), never from a local run.
- A lone survivor in the mutation gate on a diff that does not touch its target: rerun the failed shard job at the
  same SHA once before treating it as real.

## 6. Standing merge gates

1. CI green at the PR's head SHA, and that SHA verified against the lane's local tip with
   `gh pr view <n> --json state,headRefOid,mergeable`. A `CONFLICTING` PR queues no CI: check `mergeable` before
   suspecting Actions.
2. A fresh `swarm-reviewer` returned PASS or PASS_WITH_NITS at that same SHA. The reviewer is briefed with the lane
   block from this plan VERBATIM plus branch, base and head SHA; nothing is added to or paraphrased in the brief.
   Nits are not fixed before the final review of a lane.
3. Merge with `gh pr merge <n> --merge`. No squash, no rebase-merge, no `--delete-branch`.
4. After any merge: every open PR that shares a file, a generated region, a mutant patch or a FLOORS row with the
   merged one merges main into its branch, reruns the sync tool named in 4.1 if it owns a region, and needs green
   CI at its new head. It also needs a FRESH `swarm-reviewer` verdict at that new head SHA, whatever the merge
   changed: gate 2 ties the verdict to the SHA being merged, and a verdict at an older SHA never carries over.
   (Eng review F2: the earlier text let an old verdict stand when no owned file changed.)
5. Two FAIL verdicts on one lane end the bounce. The lane is parked and a reviewed sub-plan is written before any
   further attempt. Repeated failures across lanes trigger the same.
6. After each merge the integrator fast-forwards local main (`git merge --ff-only`) on a clean checkout.
7. Deploys, migrations and destructive actions are out of scope and need the owner's per-action confirmation.

## 7. What no oracle covers today, and the step that closes it

| Gap at BASE | Evidence | Closed by |
|---|---|---|
| Sandbox `textContent` differs from the DOM | loops removed: 4 tests fail only because of the stub | SB-1 |
| A served id absent from markup, or never looked up | `scale-slots`, `settings-title` | SB-2 |
| `isStop`'s `disabled` and rendered checks | both mutations 272/272 | SB-5 |
| `location.origin` in the stub | removed: 272/272, `shareLink()` returns `undefined/...` | SB-4 |
| Extra generated card or rail vs the fixture; missing mode throws | verifier's three fixture edits | SB-6 |
| `settle()` throws at its ceiling | throw removed: harness 11/11 | HX-3 |
| `waitFor` hides evaluation errors | probe: typo reads as timeout after 425 ms | HX-4 |
| `runFont` tallies and invariance width set | P1 to P4 mutations 39/39 | PF-1..3 |
| Repo PDFs untouched by the build test | build pointed at ROOT: 11 OK, six PDFs modified | PG-4 |
| Profile-dir assertion under concurrent Chrome | 1 failure in 7 | PG-2 |
| `tests/pdfcards.test.js` floor one below its count | 15 vs 16 | CL-1 |

Still uncovered after this plan, on purpose: real-font overlap of the style line (Q6), warning wipe on disarm (Q4),
ambiguous mutant anchors (Q7), the six stub guards (Q2), the eight unprobed `waitElapsed` sites.

## 8. Per-lane budget and cost

| Lane | Patch files touched (cap 40) | e2e seconds added |
|---|---|---|
| SB | up to 10 (6 new + 4 refresh) | 0 |
| EN | 0 expected | 0 |
| HX | 2 new | 0 e2e; under 1 s of harness; minus 0.15 s of waits |
| PG | 1 certain, up to 6 | 0 |
| AP | 18 | 0 |
| PF | up to 15 (3 new + 12) | 0 |
| CL | refresh only, under 10 expected | 0 |

Projected cost: `7 lanes → ~14 subagent runs, ~7 CI runs, +1 reviewer and +1 CI run per bounce`. Default cap
**4 concurrent lanes**; this plan never exceeds 4 (wave 1).

## 9. Auto-decisions

1. **Dead code is removed without asking.** Earlier plans gated every dead-code removal on the owner (for
   example `docs/plans/2026-09-30-quality-refactor.md:97`, G5). This plan removes PROVEN DEAD and UNREACHABLE code
   without asking, with the reference enumeration in section 3.3. TEST-ONLY code goes together with its tests only
   when no mutant depends on it; otherwise it is owner-gated. KEPT-BY-DECISION and BEHAVIOUR-BEARING code stays and
   is listed in section 10. The only authority for this is the owner's sentence "Make sure that there is no dead
   code and we do not introduce regression." Reading that sentence as lifting the earlier owner-gate for PROVEN
   DEAD and UNREACHABLE code is the planner's interpretation, not something the owner said in those words. The
   owner can overturn it: say so and AP-1, AP-2, SB-4, EN-2 and PG-6 become owner questions instead of steps.
   Rejected alternative: keep the gate and ask per item. Rejected because the request names "no dead code" as a goal
   and about 40 items would each need a round trip.
2. **Reduced UNIT-1, not full derivation.** `ELEMENT_IDS` stays a hand list with a strict throw; one test pins it
   against the markup and the app's lookups. Rejected: derive the list from the markup. It reverses the recorded
   LEAVE decision (`docs/plans/2026-09-29-backlog-and-refactor.md:77`) and changes the stub's tag semantics for 51 elements.
3. **The `.announce` node is seeded in the stub; `announce.className = "announce";` stays.** Rejected: also delete
   the `className` line. The planner's combined-removal experiment was not run to completion, so that line is unproven.
4. **E2E-2 keeps 180 ms.** The pause hook removes the racing upper bound; main's value stays the lower bound.
   Rejected: 400 ms as the audit proposed; it passes but changes a bound the probe shows is already sufficient.
5. **Lanes do not edit FLOORS; CL sets them from CI artifacts.** Floors are minimums, so added tests do not redden
   a PR. Rejected: each lane edits its own row (`tests/CONTRACT.md` suggests it); under parallel lanes the rows
   lag and conflict, which the last two passes both hit.
6. **PG-3 and PG-4 get a one-off red proof, not a mutant.** Rejected: a mutant that points the build at the repo
   root; it would modify tracked PDFs inside the mutation gate.
7. **No test is renamed.** Rejected: the UNIT-9 rename; it orphans two mutant `# suite:` headers for a cosmetic fix.
8. **AP and PF merge serially even though their edits to `tests/app.test.js` are in different describes.** Rejected:
   concurrent merge; a textual non-conflict in that file has still reddened main before through a shifted mutant.
9. **TODOS.md sections about the removed print sheet are deleted, not marked resolved.** Rejected: leave with a
   RESOLVED tag; five of the six already describe functions with zero hits in `index.html`.
10. **X-1's fix is `if a != b: self.fail(...)`.** Same equality, cheaper message. Rejected: `assertEqual` with
    `maxDiff`; the cost is in the diff construction, which `maxDiff` does not skip.

## 10. Open questions for the owner

Execution can start without any answer. "Meanwhile" is what the lanes do until one arrives.

| # | Question | Recommendation | Meanwhile |
|---|---|---|---|
| Q1 | `PRINT_PAPER[*].css` is read by nothing in the app; one test and one mutant (`p_print_paper_height_restored`) exist only to pin its shape. Remove the field, the test `PRINT_PAPER carries no page-box height` and that mutant together? | Yes, in a later pass: it is the one place this plan would have to delete a mutant. | Untouched. |
| Q2 | Six guards run only in the sandbox (wheelMain, two `sheetSurf` guards, `.filter(Boolean)`, `previewBox.querySelector &&`, `a.closest &&`). Remove them by making the stub complete? | Leave: each is one token, and removing them means growing the stub. | Untouched. |
| Q3 | With the card keydown guard gone (AP-2), keep the paper-select tests that were named for it as regression guards? | Keep. They fail if a control ever moves inside `#card`. | Kept. |
| Q4 | Disarming DELETE wipes a standing pan warning (APP-8). Intended? | Decide the behaviour first; the audit's first test was refuted. | Untouched. |
| Q5 | Should the sandbox derive its ids and structure from the markup (UNIT-1 / UNIT-2 in full)? | Not now; SB-2 closes the practical gap. | Reduced form only. |
| Q6 | Under real fonts the style line's text rect overlaps `#count` by 1 px at 844x390 (the element boxes do not overlap). Is that a defect, and should the test run under real fonts? | Treat as not a defect; keep the fallback-font test; revisit only with a visible report. | Untouched; E2E-D2 stays. |
| Q7 | Should `refresh_mutants.py` refuse the 52 ambiguous anchors (reverses f683680)? | No; the count is flat (49 to 52). | Untouched. |
| Q8 | Widen the line-ref ratchet to more files (needs a wider regex too)? | No; PG-7 fixes the stale refs by name instead. | Stale refs fixed, ratchet unchanged. |
| Q9 | Delete the two body-identical duplicate mutant pairs (README count would drop by 2)? | Yes, later, as its own small PR. | Untouched. |
| Q9b | `tools/regen_data_mutants.py --check` has no caller. Remove the flag or wire it into CI? | Leave. | Untouched. |
| Q10 | `tools/validate.py` `check_2` has three assertions that cannot fire. Delete them? | Yes, later; it is an assertion deletion, so not without your word. | Docstring fix only. |
| Q11 | `tools/research/` (11 files, 788 lines) is referenced by one plan doc only. Keep? | Keep. | Untouched. |
| Q12 | README section "Optional: Claude Code follow-up prompt" and the `hpfc` trap line in `tests/CONTRACT.md` invite work you un-tracked on 2026-09-30. Delete both? | Delete both. | Untouched. |
| Q13 | Engine guards kept by earlier decisions (ENG-D14, D18, D20, D22). Still keep? | Keep. | Untouched. |

## 11. Appendices

### Appendix A: commands run at BASE by the planner

Detached worktrees `wt-PLAN-1` and `wt-PLAN-2` at `e2d1af8`, both removed. No full e2e, no
`tests/mutation_check.sh`, one Chrome at a time. "Selected" is the `# tests` or `Ran` number.

| Command | Selected | Last result line |
|---|---|---|
| `TAP tests/app.test.js` | 272 | `# fail 0` |
| `TAP tests/preview.test.js` | 14 | `# fail 0` |
| `TAP tests/layout.test.js` | 53 | `# fail 0` |
| `TAP tests/core.test.js` | 53 | `# fail 0` |
| `TAP tests/voicing.test.js` | 16 | `# fail 0` |
| `TAP tests/naming.test.js` | 32 | `# fail 0` |
| `TAP tests/select.test.js` | 51 | `# fail 0` |
| `TAP tests/share.test.js` | 51 | `# fail 0` |
| `TAP tests/sequence.test.js` | 43 | `# fail 0` |
| `TAP tests/pdf.test.js` | 11 | `# fail 0` |
| `TAP tests/pdf_builtin.test.js` | 13 | `# fail 0` |
| `TAP tests/pdfcards.test.js` | 16 | `# fail 0` |
| `TAP tests/mutation_harness.test.js` | 52 | `# fail 0` |
| `TAP --test-name-pattern 'panel.fit' tests/app.test.js` | 39 | `# fail 0` |
| `TAP --test-name-pattern 'tab.stops.follow.rendering' tests/app.test.js` | 5 | `# fail 0` |
| `TAP --test-name-pattern '^AP1-2.releaseDecision.table$' tests/app.test.js` | 1 | `# pass 1` |
| `TAP --test-name-pattern '^AP3-0.generated.faces.and.rail.DOM.match.the.committed.digest$' tests/app.test.js` | 1 | `# pass 1` |
| `TAP --test-name-pattern '^PRINT_PAPER.carries.no.page.box.height$' tests/app.test.js` | 1 | `# pass 1` |
| `TAP --test-name-pattern '^decode.never.throws.on.hostile.input$' tests/share.test.js` | 1 | `# pass 1` |
| `CHROME TAP tests/harness.test.js` | 11 | `# fail 0`, `# skipped 0` |
| `TAP tests/harness.test.js` without `CHROME_BIN` | 1 (skip placeholder) | proves nothing; lanes must export `CHROME_BIN` |
| `CHROME TAP --test-name-pattern '^card.swipe..wheel...momentum.wheel.events.after.a.committed.gesture.lands.do.not.step.again$' tests/e2e.test.js` | 1 | `# pass 1` |
| `CHROME TAP --test-name-pattern '^card.swipe..Enter.on.a.focused..next.after.a.settled.touch.swipe.still.steps$' tests/e2e.test.js` | 1 | `# pass 1` |
| `CHROME TAP --test-name-pattern '^card.swipe..landing.a.flight.during.a.mid-flight.tap.cancels.a.stale.mouse-decay.timer.from.the.committing.drag$' tests/e2e.test.js` | 1 | `# pass 1` |
| `CHROME TAP --test-name-pattern '^Enter.and.Space.on.a.focused.card.flip.it$' tests/e2e.test.js` | 1 | `# pass 1` |
| `CHROME TAP --test-name-pattern '^Enter.on.a.print.button.runs.its.real.click.handler.and.does.not.flip.the.card$' tests/e2e.test.js` | 1 | `# pass 1` |
| `CHROME TAP --test-name-pattern 'print.controls.are.never.on.a.card.face..and.the.panel.is.not.inside.header.main.footer.card' tests/e2e.test.js` | 1 | `# pass 1` |
| `CHROME TAP --test-name-pattern '^documentElement.computes.color.scheme..dark$' tests/e2e.test.js` | 1 | `# pass 1` |
| `node tools/boot_sim.js` | n/a | `exercised 96 cards x 2 modes; no German, SVG + deck colours present, shuffle OK`, exit 0 |
| `node tools/regen_card_fixture.js --check` | n/a | `gen_face_v1.json matches ...: 11 generated decks, rails basic/advanced`, exit 0 (first line: `card_face_v1.json matches ...`) |
| `node tools/regen_card_fixture.js --gen --check` | n/a | `gen_face_v1.json matches ...`, exit 0 |
| `python3 tools/validate.py` | n/a | `validate.py: all checks passed` |
| `python3 tools/inline_engine.py --check` | n/a | `engine regions in index.html match src/engine/: OK` |
| `python3 tools/sync_decks.py --check` | n/a | `DECKS in index.html matches data/decks.json: OK` |
| `python3 tools/refresh_mutants.py --check` | n/a | `all mutant patches apply cleanly; nothing to refresh` |
| `git diff e2d1af8 -- data/decks.json \| wc -l` | n/a | `0` |
| `python3 -m unittest tests.test_pdf_parity` | 11 | `OK` |
| `python3 -m unittest tests.test_pdf_build` | 11 | `OK` |
| `python3 -m unittest tests.test_pdf_emitter` | 7 | `OK` |
| `python3 -m unittest tests.test_print` | 40 | `OK` |
| `python3 -m unittest tests.test_render_agreement` | 24 | `OK` |
| `python3 -m unittest tests.test_gen_deck` | 17 | `OK` |
| `python3 -m unittest tests.test_deck_data` | 25 | `OK` |
| `python3 -m unittest tests.test_fixture_integrity` | 8 | `OK` |
| `python3 -m unittest tests.test_readme_currency` | 11 | `OK` |
| `python3 -m unittest -k RunNodeFileTimeoutTest tests.test_suite_health` | 5 | `Ran 5 tests in 35.159s`, `OK` |
| `python3 -m unittest tests.test_suite_health` | 30 | `Ran 30 tests in 38.148s`, `OK` |
| `python3 -W error::ResourceWarning tests/suite_health.py --emit-python <file>` | 222 | `python: ran 222, skipped 0, failures 0, errors 0, unexpected successes 0`, exit 0 |
| `node <S>/measure.js <worktree>` | n/a | reproduces `runFont` 35/159/7, `boot` 34/356/4, `<cb forEach>` 21, `diffGen` 13 |

Not run by the planner, and why: `python3 tests/suite_health.py --emit-js` (runs the full e2e suite; forbidden
here) and `--verify` (runs nothing itself, but needs the artifact `--emit-js` writes; evidence is CI's `js suites (unit + e2e)` and `suite health` jobs on main at `e2d1af8`, both
green); `tests/mutation_check.sh` (forbidden; CI `mutation gate`); the `panel_fit.js` CLI (CI `panel fit (...)`).
Also not run: the combined AP edits with a mutant refresh. One planner experiment (SB-1 + SB-3 + AP-1 together) ran
and passed as quoted in the lanes; a second, wider one was not carried out.

### Appendix B: anchors and the grep that found each at BASE

Command form: `git grep -n -a -F -e '<string>' e2d1af8 -- <file>`. The line is where it was at `e2d1af8`; lanes
anchor on the string, not the line.

| File | String | Line(s) at BASE |
|---|---|---|
| `tools/sandbox.js` | `const ELEMENT_IDS` | 32 |
| | `"scale-slots"` | 39 |
| | `"settings-title"` | 48 |
| | `function registerIds` | 58 |
| | `function makeElement` | 66 |
| | `set textContent(v)` | 93 |
| | `function makeLocation` | 194 |
| | `get origin` | 203 |
| | `function boot(` | 227 |
| | `opts.extraIds` | 27, 259 |
| | `const created = [];` | 311 |
| | `const all = () =>` | 319 |
| | `opts.syncTimers` | 331, 419 |
| | `opts.innerWidth` | 435 |
| | `printCalls` | 434, 470, 471, 514 |
| | `registerId:` | 502 |
| | `announcer:` | 566 |
| | `fireWindow:` | 578 |
| | `module.exports` | 584 |
| `tools/regen_card_fixture.js` | `function diffAll(` | 122 |
| | `function diffGen(` | 202 |
| | `function mainGen(` | 223 |
| | `main();` | 282 |
| `tests/app.test.js` | `59 cards` | 5 |
| | `test("PRINT_PAPER carries no page-box height"` | 3697 |
| | `app.printCalls()` | 3830 |
| | `describe("panel fit judge"` | 4635 |
| | `describe("tab stops follow rendering"` | 4985 |
| | `test("AP1-2 releaseDecision table"` | 5202 |
| | `mouse: ` | 5205, 5218 |
| | `test("AP1-3 wheelDecision` | 5226 |
| | `sx: 0, sy: 0` | 5229 |
| | `test("AP3-0 generated faces and rail DOM match the committed digest"` | 5375 |
| `tests/preview.test.js` | `const panName` | 196 |
| `index.html` | `--sep:#8a8a8a;` | 50 |
| | `--sep now has NO consumer` | 534 |
| | `class="announce"` | 1102 |
| | `class="prints" onclick="event.stopPropagation()"` | 1302 |
| | `function shareLink(` | 7019 |
| | `fit_note shrinks anything that truly overflows` | 7192 |
| | `const PAN_HIT_MIN_PX = 44;` | 7359 |
| | `function sizePanHits(` | 7360 |
| | `const PRINT_PAPER` | 7390 |
| | `countEmpty.children.length` | 7560 |
| | `countEl.children.length` | 7618 |
| | `const announce = document.querySelector(".announce")` | 7860 |
| | `announce.className = "announce";` | 7861, 8550 |
| | `` (`:4954`) `` | 8338 |
| | `function setSheetMode(` | 8435 |
| | `previewBox.setAttribute("aria-label", PAN_NAMES[panState]` | 8448 |
| | `function disarmDelete(` | 8722 |
| | `const isStop =` | 8856 |
| | `e.target.closest("button, select")` | 8909 |
| | `function releaseDecision(` | 9223 |
| | `let wheel = null;` | 9331 |
| | `sx: 0, sy: 0` | 9375 |
| `tools/probe/panel_fit.js` | `function judgeCell(` | 85 |
| | `async function runFont(` | 547 |
| | `const countGutter` | 577 |
| | `R.reported += j[rn].reported.length;` | 620 |
| | `SIDEBAR_WIDTHS` | 41, 601, 665, 685, 686, 687 |
| | `report.invarianceFailureCount` | 694 |
| | `function printReport(` | 707 |
| | `module.exports` | 811 |
| `tests/helpers/cdp.js` | `~120 lines` | 4 |
| | `async waitFor(` | 204 |
| | `timed out waiting for` | 208 |
| | `async settle(` | 219 |
| | `E2E-SETTLE-CEILING` | 226 |
| | `if (this.strictSettle !== false)` | 227 |
| | `Browser and APP_READY_EXPR are exported` | 606 |
| `tests/harness.test.js` | `gives up at its 500ms ceiling` | 72 |
| | `b.strictSettle = false` | 76, 582 |
| | `EX-3 settle reports a ceiling hit` | 578 |
| `tests/e2e.test.js` | `async function waitElapsed(` | 245 |
| | `async function installFlyoutPauseHook` | 337 |
| | `index.html:7506-7509` | 544 |
| | `index.html:7573-7574` | 2572 |
| | `index.html:4578` | 5082 |
| | `landscape mode S keeps the style line inside the footer` | 8465 |
| | `Enter on a focused #next after a settled touch swipe still steps` | 9445 |
| | `the touch swipe's eatClick decay` | 9458 |
| | `cancels a stale mouse-decay timer from the committing drag` | 10246 |
| | `the tap to land mid fly-out` | 10267 |
| | `momentum wheel events after a committed gesture lands do not step again` | 10512 |
| | `the first gesture to end mid-flight` | 10533 |
| | `the wheel gesture to end and settle` | 10393, 10451, 10507, 10548 |
| `src/engine/pdf.js` | `Page.prototype.setDash = function (on, off, phase)` | 104 |
| | `Page.prototype.arc` | 169 |
| | `Page.prototype.stringWidth` | 196 |
| | `Doc.prototype.page = function (w, h)` | 208 |
| | `Doc.prototype.stringWidth` (TEST-ONLY, kept) | 224 |
| | `escapeText: escapeText` | 325 |
| | `num: num` | 326 |
| `src/engine/core.js` | `CAPS:` | 603 |
| `src/engine/layout.js` | `CAPS:` | 384 |
| `src/engine/voicing.js` | `MAX_NOTES: MAX_NOTES` | 317 |
| `src/engine/select.js` | `rank: rank,` / `order: order,` / `TIERS: TIERS` | 620 / 621 / 625 |
| `src/engine/sequence.js` | `(pick() does)` | 337 |
| | `sameSequence: sameSequence` | 951 |
| `src/engine/pdfcards.js` | `noteW: noteW` / `cardWarnings: cardWarnings` | 605 / 606 |
| `src/engine/pdfdeck.js` | `function specFrom(` | 82 |
| | `function fromBuiltin(` | 220 |
| | `Reviewer nit from W1a` | 278 |
| `src/engine/share.js` | `if (carry) carry.order = delta;` | 359 |
| `tools/engine_loader.js` | `midiOf` | 18 |
| | `const ENGINE_DIR` | 32 |
| | `extraGlobals` | 37, 40, 50 |
| | `.filter(Boolean)` | 41 |
| | `module.exports` | 73 |
| `tests/pdf_builtin.test.js` | `Reviewer nit from W1a` | 55 |
| `tests/share.test.js` | `decode never throws on hostile input` | 254 |
| `docs/ENGINE-SPEC.md` | `tests/helpers/sandbox.js` | 869 |
| `tests/test_suite_health.py` | `cdp.js:289` | 17, 112 |
| | `class RunNodeFileTimeoutTest` | 134 |
| | `def drive_timeout` | 135 |
| | `def _hpfc_profile_dirs` | 233 |
| | `def test_a_killed_suites_own_output_reaches_the_excerpt` | 236 |
| `tests/suite_health.py` | `"tests/pdfcards.test.js":` | 64 |
| | `~35x` | 186 |
| | `NODE_TIMEOUT =` | 188 |
| | `cdp.js:289` | 272 |
| | `GROUP_TERM_GRACE =` | 280 |
| | `DRAIN_TIMEOUT =` | 287 |
| `tests/shard_mutants.js` | `module.exports` | 71 |
| `tools/refresh_mutants.py` | `self.count = count` | 77 |
| | `def git(args, **kw)` | 263 |
| `tests/mutation_harness.test.js` | `mutation_check.sh:242` | 376 |
| | `function hunksOf` | 565 |
| | `line ~533` | 1197 |
| `tests/mutation_check.sh` | `(line 27)` | 123 |
| `tests/test_pdf_parity.py` | `def _assert_vectors_match` | 216 |
| `tests/test_pdf_build.py` | `class BuiltDecksTest` | 234 |
| | `def assertRepoUntouched` | 255 |
| `tests/test_gen_deck.py` | `def repo_pdf_hashes` (the pattern PG-4 copies) | 85 |
| `tests/test_pdf_emitter.py` | `cls.tmp = tempfile.mkdtemp()` | 33 |
| | `def tearDownClass` | 93 |
| `tests/test_print.py` | `class _Path` / `class RecordingCanvas` | 89 / 106 |
| | `59 cards` | 254, 364, 394, 419, 439 |
| `tests/test_render_agreement.py` | `def rect(` | 72 |
| `tests/paths.py` | `FONTS` | 6 |
| `tools/decks.py` | `import os` | 4, 400 |
| | `PYGMY asks for 9 write-your-own` | 27 |
| `data/decks.json` | `"blank_cards": 7,` | 1287 |
| `tools/validate.py` | `Checks 2-4` | 10 |
| `tools/inline_engine.py` | `core first` | 24 |
| `tests/test_deck_data.py` | `regen_data_mutants.py:158` | 555 |
| `README.md` | `2- or 3-chord loop` | 46 |
| | `(the first chip in the deck row)` | 57 |
| | `mutant patches under` | 127 |
| | `Optional: Claude Code follow-up prompt` | 178 |
| `TODOS.md` | `346-mutant` | 112 |
| | the six headings in CL-3 (`git grep -n -a -E '^#+ ' e2d1af8 -- TODOS.md`) | 90, 108, 117, 154, 170, 179 |
| `tests/CONTRACT.md` | `pre-seeded at 0` | 42 |
| `docs/plans/2026-09-30-quality-refactor.md` | `G5` | 68, 72, 97, 236, 259, 341, 363 |

Other enumerations:

- Mutant prefixes at BASE: `ls tests/mutants | sed 's/_.*//' | sort -u` (61 prefixes; none is `r3s`, `r3h`, `r3p`).
- Patches per target file: `/usr/bin/grep -l -a "^+++ b/<file>" tests/mutants/*.patch` (table 4.2).
- Strands: `/usr/bin/grep -l -a -F '<exact line>' tests/mutants/*.patch`. Results that came back empty and are
  relied on: `countEl.children.length`, both `announce` lines, the dead `aria-label` write, `(`:4954`)`,
  `PAN_HIT_MIN_PX = 44`, `set textContent`, `ELEMENT_IDS`, `scale-slots`, `async waitFor(`, `timed out waiting for`,
  the three HX wait labels, `cdp.js:289`, `mutation_check.sh:242`, `line ~533`, `Checks 2-4`, every EN-2 line.
- Callers of removed sandbox names:
  `git grep -n -a -E 'registerIds|extraIds|syncTimers|makeLocation|makeElement|fireWindow|\.docEl' e2d1af8 -- tests tools ':!tests/mutants' ':!tools/sandbox.js'` returns nothing.
- `loadEngine(` call sites: `git grep -n -a -E 'loadEngine\(' e2d1af8 -- tests tools ':!tests/mutants'` (33 lines;
  every call passes one array argument).
- CI job names: `git grep -n -a -E 'name:' e2d1af8 -- .github/workflows/validate.yml` (jobs at lines 10, 31, 61, 98, 126, 162;
  the two `panel fit (...)` jobs are in the same listing).

## 12. Engineering review record (`/plan-eng-review`, 2026-10-05)

Reviewed at `e2d1af8` by the planning session, then by an outside model (Codex, read-only). The owner was away
(AFK mode armed), so each decision below is the recommended non-destructive option, taken under the standing AFK
rule and listed for the owner to overturn. No product code was written.

### 12.1 Scope challenge

Seven lanes over more than eight files trips the review's complexity gate. Scope kept as is: the lanes are already
split by file ownership, each has its own cut order, wave 1 is four disjoint lanes, and the three behaviour-neutral
simplifications (X-1, UNIT-5, the sandbox stub) are each small. Nothing here rebuilds something that exists: every
step reuses the existing suites, `tools/refresh_mutants.py`, `tools/inline_engine.py` and the CI jobs in
`.github/workflows/validate.yml`. No new dependency, file format or CI job.

### 12.2 Findings and what changed

| ID | Severity (confidence) | Where | Finding | Fix applied |
|---|---|---|---|---|
| F1 | P2 (9/10) | AP-5 | Accept demanded zero `--sep` matches in `index.html`; the Change left three mentions in the CSS comment above `.hdr .l .num` (`index.html:528`, `:529`, `:532`), so the step could not pass as written. | Change now rewords the surviving comment; Accept checks the definition (`--sep:`) and the consumer (`var(--sep)`) separately. |
| F2 | P1 (9/10) | Section 6, gate 4 | After a merge of main, an older reviewer verdict could stand when no owned file changed. That breaks gate 2 and the standing rule that the verdict and green CI are at the same SHA. | Any new head needs a fresh reviewer at that SHA. |
| F3 | P2 (8/10) | PG-3, PG-4 | Red proofs edited the lane worktree and reverted with `git checkout --`, once over files PG never owns and once over PG's own uncommitted change. | Both proofs run in a throwaway `git worktree add --detach` and are removed after. |
| F4 | P3 (7/10) | HX-2 | Two timing waits are deleted with only CI's mutation gate as proof; the gate cannot tell a kill for the wrong reason. | A differential probe at the lane head: apply each patch, paste the `not ok` line and message. |
| F5 | P3 (8/10) | Section 4.1 | The plan did not say how the plan file itself reaches main, though briefs quote it. | Wave 0: a docs-only PR from `claude/rp3-plan` before any lane. |
| O1 | P1 (9/10), outside | PF-3 Accept | PF never edits `index.html`, so on its PR `tools/probe/panel_fit.js` prints `index.html identical ... 0 cells measured` and both panel-fit jobs pass without calling `runFont`. The lane's main regression gate was vacuous. Confirmed at `tools/probe/panel_fit.js:798`. | Forced old-vs-new probe run on the fixed pair `efb682c` / `e2d1af8`, empty `diff` required. |
| O2 | P2 (9/10), outside | PF-3 test | "Sorted and in range" contradicts the probe: sidebar widths 1440 and 1920 lie above `W_HI = 1300` and are added unfiltered (`tools/probe/panel_fit.js:41`, `:665`). A lane following the contract could drop them. | Test renamed and rewritten; expected array must contain 1440 and 1920; mutant header updated. |
| O3 | P2 (9/10), outside | PF-1, PF-2 tests | PF-1 said the flag suppresses `reported`; both loops add it and only `firstReported` differs (`tools/probe/panel_fit.js:620`, `:638`). PF-2 accepted `gutterFirst.length <= 5`, true for an empty list. | PF-1 asserts `reported` both ways, `firstReported` exactly, and accumulation; PF-2 asserts the five exact messages. |

Cross-model tension: none. All three outside findings were checked against the probe source and accepted.

Checked and found sound, no change: the SB, AP and PF test counts (273 to 279, then 282; panel-fit describe 39 to
42); CL-1's FLOORS expectations against `tests/suite_health.py:52-64`; the seven CI job names; AP-2's claim that the
`.prints` bubble stop is unreachable (the settings panel is a body-level sibling of `#card`, and the only document
listener is capture-phase); the README mutant-count floor of 90% covering interim growth to 669; the lane-vs-patch
ownership table in 4.2; HX's wait table (the verifier's 0 ms probes at BASE).

### 12.3 Architecture, code quality, performance

- Architecture: no data-flow change. Three extractions move arithmetic out of long functions into pure helpers
  with the same callers (`runFont`, `_assert_vectors_match`, the sandbox stub). Coupling falls; nothing new is shared.
- Code quality: removals are limited to PROVEN DEAD and UNREACHABLE rows of section 3.3, each with a reference
  enumeration. No abstraction is added that has one caller and no test.
- Performance: PG-3 makes a failing parity test cheap (the diff construction was the cost); HX removes 150 ms of
  fixed waits. Nothing adds e2e time (section 8). CI budget for `js suites` is unaffected.

### 12.4 Test coverage after the plan

```
CODE PATH                                   COVERAGE AFTER                       LANE
sandbox stub ids vs markup                  unit, new (SB-2) + 6 r3s mutants     SB
engine dead branches removed                existing 150 engine mutants          EN
wheel momentum after a committed gesture    e2e, existing, race removed          HX-1
touch eatClick decay, tap mid fly-out       e2e, existing + differential probe   HX-2
waitFor timeout path in cdp.js              harness, new + 2 r3h mutants         HX
PDF vector parity failure message           unittest, existing + red proof       PG-3
PDF build leaves committed PDFs untouched   unittest, hash assertion + red proof PG-4
card keydown / .prints handlers removed     unit + e2e, existing                 AP
--sep token removed                         panel fit (both fonts), e2e scheme   AP-5
runFont tally, gutter, invariance widths    unit, 3 new + 3 r3p mutants          PF
runFont end to end after extraction         forced old-vs-new probe diff         PF
FLOORS, README mutant count                 suite health, from CI artifacts      CL
```

Gaps that stay open by decision: real-font layout in unit suites (CI blocks web fonts; `panel fit (real)` is the
only real-font oracle), and the six sandbox-only guards (Q2).

### 12.5 Failure modes

| Failure | Caught by | Silent otherwise? |
|---|---|---|
| A removed "dead" branch was live on some path | characterisation commit first in each step; existing mutants; e2e in CI | no |
| Extraction changes what the probe measures | PF forced probe diff (O1) | yes before O1, no now |
| Sidebar invariance widths dropped | PF-3 exact array with 1440 and 1920 (O2) | yes before O2, no now |
| Wait removal weakens a timing bound | HX-2 differential probe (F4), mutation gate | no |
| A merge of main changes a lane after its review | gate 4, fresh reviewer at the new SHA (F2) | yes before F2, no now |
| Red proof leaves the lane tree dirty or reverts real work | throwaway worktree (F3) | no |
| A stranded mutant patch reddens main | `tools/refresh_mutants.py`, gate 4, mutation gate | no |
| FLOORS or README count lags | CL sets both from main's CI artifacts | no |

No failure mode is left with no test, no error handling and a silent outcome.

### 12.6 What already exists, and not in scope

Already exists and is reused: the unit, harness, e2e and python suites; 658 mutant patches and the sharded mutation
gate; `tools/refresh_mutants.py`; `tools/inline_engine.py --check`; `tools/sync_decks.py --check`; the panel-fit
probe and its two CI jobs; `tests/suite_health.py` FLOORS.

Not in scope: everything in sections 2.1 to 2.3; deck data and diagram geometry; the visual system; any new
feature; the queued numeral-label change; the gstack upgrade offered at review start (1.87.6.0 to 1.91.27.0,
declined while the owner is away).

### 12.7 Worktree parallelisation

| Wave | Lanes in parallel | Shared files inside the wave | Conflict risk |
|---|---|---|---|
| 0 | plan PR | none | none |
| 1 | SB, EN, HX, PG | `tests/mutants/` only (each lane commits its own patches) | low; gate 4 covers it |
| 2 | AP, then PF (serial) | `tests/app.test.js` | serial by design |
| 3 | CL | none | none |

### 12.8 Implementation tasks

- **T1 (P1, human: ~15 min / CC: ~5 min)** Land this plan on main by a docs-only PR from `claude/rp3-plan`. The owner gave the go on 2026-10-05.
- **T2 (P1, human: ~1 day / CC: ~40 min)** Lane SB, `claude/rp3-sandbox`.
- **T3 (P1, human: ~1 day / CC: ~30 min)** Lane EN, `claude/rp3-engine`.
- **T4 (P2, human: ~4 h / CC: ~30 min)** Lane HX, `claude/rp3-e2e`, with the HX-2 differential probe.
- **T5 (P2, human: ~1 day / CC: ~40 min)** Lane PG, `claude/rp3-pygate`, red proofs in throwaway worktrees.
- **T6 (P1, human: ~1.5 days / CC: ~60 min)** Lane AP, `claude/rp3-app`, after T2 and T3 are merged.
- **T7 (P2, human: ~4 h / CC: ~40 min)** Lane PF, `claude/rp3-panelfit`, after T6, with the forced probe diff.
- **T8 (P2, human: ~2 h / CC: ~20 min)** Lane CL, `claude/rp3-close`, FLOORS and README count from CI artifacts.

Each lane: independent `swarm-reviewer` at the head SHA, CI green at that SHA, then merge (section 6).

### 12.9 Completion summary

- Step 0 scope: accepted as is (12.1).
- Architecture: 0 issues. Code quality: 2 (F1, F3). Tests: 2 (F4, plus the three outside PF findings below).
  Process gates: 2 (F2, F5). Performance: 0.
- Outside voice: ran (Codex CLI, read-only, completed). 3 findings, all confirmed and applied (O1 to O3).
- TODOS.md: no new entry proposed. Deferred work is already listed in section 2.3 with a reason each.
- Failure modes: 0 critical gaps left.
- Parallelisation: 4 waves, at most 4 lanes in flight.
- Lake score: 8 of 8 findings took the complete fix.

### 12.10 Wave 0 review bounce (2026-10-05)

The first independent review of the plan PR (head `81540d8`) returned FAIL on five text defects, each of which would
have become a false FAIL in a later lane review. All are fixed in this revision: PF-3's diff now filters the probe's
`wall time:` line; AP names `sw_panel_guard_dropped`, `sw_sheet_guard_dropped` and `e_contrast_card_greys` as hand
re-cuts (18 stranded, not 17); PG no longer cites a `check_only` docstring that lives in a file it does not own;
`--verify` is written with its two artifact paths. Smaller corrections from the same review are applied in place
(PG-5 import, SB-5 ordering and precondition, EN-2 parameter folding, counts of `waitElapsed` sites and of patches
on `tests/mutation_check.sh`, PF real-font evidence, go status).

A second independent review (head `378252c`) also returned FAIL, on two points: CL-1's download command nested the
artifacts where its Verify line could not find them (now two single-artifact downloads into one directory), and the
unconditional reviewer checks contradicted cuts the lane blocks themselves allow (now one rule in section 4.3, and
PF's probe run is lane-level). Its non-blocking notes are applied too (AP count 18 everywhere, GATE-D5 no longer
credited to PG-7, AP-5 keeps one `var(--sep)` literal, SB-7 and PG-2 wording, count slips).

Auto-decision 11 (2026-10-05, integrator): section 6 gate 5 parks a lane after two FAILs and asks for a reviewed
sub-plan. Wave 0 is the plan itself, both FAILs were text defects with no code behind them, and a review of the
corrected plan is the reviewed sub-plan that gate asks for. So the plan goes to a third fresh reviewer once. A
third FAIL stops wave 0 and goes to the owner.

## Decision ledger

Authority for every row: the owner's standing AFK rule ("pick the option I would have recommended, record the
decision and its rationale in the plan", never a destructive option). No row is destructive. The owner can
overturn any of them.

| ID | Decision | Chosen | Rationale | State |
|---|---|---|---|---|
| D1 | Upgrade gstack before reviewing | Declined | Tooling change with the owner away; not needed for the review | auto-decided |
| D2 | Reduce scope at the complexity gate | Keep all seven lanes | Already split by ownership with cut orders (12.1) | auto-decided |
| D3 | F1, AP-5 Accept | Fix applied | The step could not pass as written | auto-decided |
| D4 | F2, gate 4 | Fresh reviewer at every new head | Matches the standing merge rule | auto-decided |
| D5 | F3, PG red proofs | Throwaway worktree | Removes a revert over uncommitted work | auto-decided |
| D6 | F4, HX-2 | Add the differential probe | A removed wait is a removed bound until proven otherwise | auto-decided |
| D7 | F5, plan landing | Wave 0 docs PR | Briefs quote the plan from main | auto-decided |
| D8 | O1, PF regression gate | Forced old-vs-new probe diff | CI measures zero cells on PF's PR | auto-decided |
| D9 | O2, PF-3 contract | Preserve and assert 1440 and 1920 | The old contract allowed a coverage loss | auto-decided |
| D10 | O3, PF-1 and PF-2 tests | Assert the real distinction and exact messages | The old tests pinned behaviour the probe does not have | auto-decided |
| D11 | New TODOS.md entries | None | Deferred work already has a home in section 2.3 | auto-decided |

Approval readiness: PASS. Checked D1 to D11, each against the AFK standing rule; none is destructive or
irreversible; the plan's own owner questions Q1 to Q13 stay open and block no lane (section 10).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO Review | `/plan-ceo-review` | Scope and strategy | 0 | not run | not requested |
| Outside Review | `/codex` (automatic in eng review) | Independent second opinion | 1 | issues found, all applied | 3 (O1 P1, O2 P2, O3 P2), all in lane PF |
| Eng Review | `/plan-eng-review` | Architecture and tests (required) | 1 | issues found, all applied | 5 (F1 to F5); 0 critical gaps left |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | not run | no user-visible change in this plan |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | not run | not requested |

- **OUTSIDE COVERAGE:** completed. Provider Codex CLI, read-only, run from the repo at `e2d1af8` against the plan
  with fixes F1 to F5 already in. Three findings, each verified against `tools/probe/panel_fit.js` and applied.
- **CROSS-MODEL:** no disagreement. The outside review found the vacuous PF gate that the in-session review missed.
- **VERDICT:** ENG REVIEW DONE, eight findings fixed in the plan. The owner gave the go on 2026-10-05.

**UNRESOLVED DECISIONS:**
- Owner questions Q1 to Q13 in section 10. Each has a recommendation and a "meanwhile"; none blocks a lane.
- Auto-decision 1 in section 9 (PROVEN DEAD and UNREACHABLE code is removed without asking) is the planner's
  reading of "no dead code". Overturning it turns AP-1, AP-2, SB-4, EN-2 and PG-6 into owner questions.
- Review decisions D1 to D11 above were taken while the owner was away and are open to being overturned.
