# Complexity refactor + test hardening (2026-10-03)

Status: EXECUTION COMPLETE 2026-10-04 at 9d2ccb5; close-out in `2026-10-04-close-out.md`.

Base: `main` at `e3fe4a5` (CI green). Line numbers are at that commit and drift; every reference also names a symbol.
Execution: `/swarm`, AFK armed. Template for lane blocks: `docs/plans/2026-10-01-post-refactor-triage.md`.
Accept convention (from the triage plan): a step with no separate Accept line is accepted when its Verify passes and its TDD test was seen red first.

## 1. Goal / Done-when

The goal is less branching and duplication in `index.html`'s app script (6412-8972) and in `src/engine/*.js`, plus closing the blind spots in the unit and e2e tests, with **zero regression**. The work is done when every oracle below holds at main's final merge commit, checked by CI at that SHA:

- `node tools/regen_card_fixture.js --check` against `tests/fixtures/card_face_v1.json`, plus its test `app.test.js` "every built-in card face still matches the committed digest" (4539).
- `tests/fixtures/pan_render_v1.json` through `app.test.js:3073`.
- `tests/test_render_agreement.py`.
- `tests/fixtures/golden_decks_v4.json` (sha pinned in `test_fixture_integrity.py`).
- The new `tests/fixtures/engine_corpus_v1.json` (lane ET) and the existing `sequence_basic_golden.json` / `sequence_tier_golden.json`.
- `test_print.py` PDF text staleness.
- `node tools/boot_sim.js`.
- `python3 tools/inline_engine.py --check` and `python3 tools/sync_decks.py --check`.
- `python3 tools/validate.py`.
- `python3 tools/refresh_mutants.py --check`.
- `python3 tests/suite_health.py`, with every FLOORS row at or above today's value. The four lagging rows are raised to the CI count: `app.test.js` 193 -> 243, `e2e.test.js` 251 -> 256, `mutation_harness.test.js` 43 -> 52, `sequence.test.js` 9 -> 29. Close-out then raises every row a lane grew to main's CI `ran N`.

`git diff e3fe4a5 -- data/decks.json` must stay empty for the whole workstream, and the six PDFs' extracted text must not change.

## 2. Non-goals

- No features.
- No deck data, geometry, palette, font or card-anatomy change. No change to anything visible at 380px or on desktop.
- No owner-gated items:
  - G1 (label constants x3)
  - G3 (history narratives)
  - G5 (dead code: card keydown guard 8434, `.prints` stopPropagation, dead loop, announce fallback)
- No weakened test. No assertion removed, loosened, or moved to a weaker oracle. No FLOORS row lowered.
- No bulk mutant retirement. A stranded patch is re-anchored, never deleted. The one exception is a patch whose mutated code no longer exists, which is replaced one-for-one in the same PR.
- No hand edits inside `<!-- engine:* -->` regions or on the `const DECKS` line.
- No module/IIFE wrap and no `window.__app` object. The bare-global surface stays (see F3).
- No describe-block restructure in `e2e.test.js`. Mutant `# suite:` patterns match the full test name including the describe prefix, so moving a test silently changes which mutants select it.
- Nothing from the owner's untracked ideas list in `CLAUDE.md`.
- Deferred and not scheduled:
  - Hotspot 7, `generateDeck` 6513-6556 angle patching. Fixing it means `core.parseSeed` accepting `order`, which is an engine contract change that needs owner input.
  - `parseLineText` 7490-7500. It is a different format from `core.formatSeed`, not a duplicate.
  - The source-text coupling tests (`app.test.js` 2273/2290/2637/2685/2703, id-slicing 3730-4330, `share.test.js:28`).
  - The `SWIPE_*` pins at 4376-4414. They stay, and AP1 must keep every pinned name and value.

## 3. Ranked findings

Ranking rule: a finding that closes a blind spot, or lets later lanes test what they change, ranks above one that only reduces line count.

The index.html hotspot order is AP1 (swipe/wheel/capture), then AP2 (sheet/panel), then AP3 (render/pan/rail):

- **AP1 goes first.** It carries the most mutant hunks (64) and the least unit coverage: the `SWIPE_*` pins at `app.test.js:4375` test constants, and the listeners themselves run only in e2e because `scene = card.parentElement` (8638) is `undefined` in the sandbox. AP1's own regression oracle is the pure decision tables it extracts (AP1-1/2/3), which need no DOM.
- **AP2 goes second.** Its riskiest change, DOM-order Tab stops, was cut in the eng review (R4). What remains is state and inert plumbing with per-mode tables.
- **AP3 goes last.** It is fully byte-pinned (card_face, pan_render, render_agreement), has the fewest hunks (28), and its `pc`/`chordSets` swap depends on EG's engine shape.

**Test surface before any rename (F3).** A committed manifest of every top-level app name that a test reads, `tests/fixtures/app_surface_v1.json`, is asserted resolvable in the booted sandbox. It lands in wave 1, before any app lane runs. It keeps all 266 `app.get`/`app.run` reads and every `b.eval` bare-name read working unchanged, and it turns any rename into a red test instead of a scattered break. `window.__app` was rejected (see section 9).

| ID | Finding | Change | FIRST TEST (red before change) | Oracle (no behaviour change) | Eff | Lane |
|---|---|---|---|---|---|---|
| F1 | `cdp.js` enables `Page`/`Runtime` (520-521), `Network` (532) and optionally `Fetch` (439), and has 0 `exceptionThrown` handlers. An exception in an app event handler leaves e2e green. | Subscribe `Runtime.exceptionThrown` in `launchOnce` (463); add `takeExceptions()`/`assertNoUncaught()`; e2e `afterEach` asserts. | `harness.test.js` "EX-1 an uncaught handler exception is reported" (red: no API) | existing e2e counts unchanged in CI; sentinel test | M | EX |
| F2 | Sandbox has no `parentElement`/`getBoundingClientRect`/`animate`/`getAnimations`/`setPointerCapture`/`visualViewport`/rAF; `querySelector("main")` is null (`tools/sandbox.js` makeElement 66-143). Swipe, wheel and `applyKbOffset` are unit-blind. | Opt-in `boot({layout:true})` adds those members; default boot is byte-for-byte unchanged. | `app.test.js` "US-2 layout boot gives the card a scene" (red: `scene` undefined) | `boot_sim.js`; card_face test; all 243 app tests pass on the default boot | M | US |
| F3 | Tests read about 40 app globals by bare name (scene, seq, flight, drag, eatClick, order...). Nothing pins the set, so a refactor rename breaks two suites at once. | `tests/fixtures/app_surface_v1.json` plus one test asserting each name resolves. Refactor lanes may not rename a listed name. | "US-1 every app surface name resolves" (red: fixture absent) | the fixture itself | S | US |
| F4 | `settle()` (`cdp.js:194-203`) returns silently at its 500 ms ceiling across about 110 call sites. | First report: log `E2E-SETTLE-CEILING <test>`. Throw only after two CI runs show zero hits (step EX-4). | `harness.test.js` "EX-3 settle reports a ceiling hit" | CI e2e pass count unchanged | S | EX |
| F5 | Swipe/wheel/capture: the `release` 8745-8792 decision is tangled with DOM effects; the wheel listener 8873-8906 has 24 branches; the capture pointerdown at 8924 repeats the `startDrag` guard from 8827. | `canStartGesture(e)` used at both sites; pure `releaseDecision(state)` and `wheelDecision(state)` return actions that the listeners execute. | "AP1-1 capture and card pointerdown agree on every guard input" (unit, layout boot) | US swipe unit tests; e2e "card swipe" describe; 64 re-anchored mutants | L | AP1 |
| F6 | Engine tests are thin. `core.fifthName` 103, `layout.rimAngles/bottomAngles/innerAngles` 119/135/148, `select.rank/order/noThirds`, `voicing.reduceIntervals` 107 and `pdfdeck.hexColor` 64 have no direct test. `pdfdeck.bankers` 39 is tested only from python. There is no output snapshot for `parseSeed`/`solve` over non-built-in seeds. | Spec-first unit tests; `tests/fixtures/engine_corpus_v1.json` capturing parseSeed + solve + select.build over the 20 `synthetic_scales.json` strings, written by `tools/regen_engine_corpus.js [--check]`. | "ET-1 engine corpus matches" (red: fixture absent) | the corpus becomes EG's oracle | M | ET |
| F7 | Sheet state (`openScaleSheet` 8032-8048 and `openEditSheet` 8051-8073) writes the same 10 module lets with per-mode values. The inert loops at 8016/8099 and the panel's at 8479/8489 have the same shape over different sets. (Tab stops 8391-8405 / 8468-8478 stay hand-listed: R4.) | `resetSheetState(opts)` with per-mode values; `setInert(on, targets)` with each caller's own set. | "AP2-1 sheet open leaves the expected state per mode" and "AP2-2 setInert applies each caller's own background set" (unit, green today) | e2e sheet/panel tests; card_face | M | AP2 |
| F8 | `runGenerate` 8138-8211 restores readonly/label by hand (8174-8175). `refusal` is set at 8181 and 8187. `genBtn.disabled` is NOT part of the restore: it is state-driven by `syncParseState` (7836/7845/7854), so after a refusal the button stays disabled until the next input that parses. That is today's behaviour and it is kept (eng review R2). | try/finally restores readonly + label only; return the refusal value. Exactly one `replaceRegistered` call site remains (pinned by the scan at 3031). | "AP2-3 a refused generate restores readonly and the label and leaves the button disabled until the seed changes" (unit; green today) | e2e generate tests; `scanNames` test | S | AP2 |
| F9 | B185-1 engine dedupe gaps: `sequence.js:54 pc`, `voicing.js:35 pitchClass`, `pdfcards.js:439-448` inline `%12`; `[3]==="ding"` at `select.js:271/290`, `sequence.js:73`, `pdfcards.js:340/350`. `pickBasic` 238 and `pickTiered` 557 share the prevValid check (250-253 / 562-565) and the NO_HOME_CHORD logic (241 / 594). | Use `HPE.core.pc`/`isDing`. pdfcards is inlined BEFORE core, so it uses a lazy `core()` accessor. Extract `prevValid()` and `homeOrRefuse()`. | ET corpus + sequence goldens green before; "EG-1 sequence pickers share one validity rule" | `engine_corpus_v1`, `sequence_*_golden.json`, `inline_engine.py --check` | M | EG |
| F10 | `core.parseSeed` 309-462 is 154 lines with about 54 branches. `layout.solve` 206-345 is 140 lines with about 41 branches. | parseSeed -> `tokenize`/`validate`/`assemble`; solve -> per-zone placement + merge; export `slotOrder` (for F14). | ET corpus (every code + every geom key) | `engine_corpus_v1`, `layout.test.js` sweep, `golden_decks_v3` engine tests | L | EG |
| F11 | `select.js:530 warning()` builds `{code, reason}` alongside `core.err`. | Route through `core.err` only if the shapes are equal, otherwise document and leave. | "EG-3 warning shape equals core.err shape" | corpus warnings | S | EG |
| F12 | e2e body: 16 literal-ms sleeps (126, 8502, 9226, 9767, 9956, 9997, 10035, 10094, 10146, 10161, 10176, 10219, 10232, 10274, 10300, 10315). One-sided bounds at 2445/2539/2498/8855/8929/9762/10160/10441/10490/10493/10515. Duplicated helpers: `enterSeqMode` 7314/8598, `railText` 7349/7415/8645, `walk` 1459/3735/3793/3851 and others. D180-1 settle triplication. | Sleeps -> `waitFor` conditions; two-sided bounds where the spec gives a range; one module-level copy per helper, same name, no describe moves. | for each sleep: the test is seen green at the same SHA with the condition (no red is possible) - accepted on CI pass + shard time | CI e2e count and shard time | M | EB |
| F13 | `render()` 7197-7276: S test evaluated twice (7198/7217); answer templates duplicated (7224-7225 vs 7239-7240). | One `faceHTML(card, opts)`. | card_face `--check` green before and after (byte oracle); "AP3-1 faceHTML is the only answer-template builder" | card_face_v1, boot_sim | S | AP3 |
| F14 | App restates engine logic: `pc`/`chordSets` 6694-6705; `layoutIds` 7523-7527 and `zoneBlock` 7546-7555 restate solve slot order. | Use `HPE.core.pc` and EG's `slotOrder` export. | "AP3-3 layoutIds equals engine slotOrder on all 20 synthetic scales" | pan_render, render_agreement | S | AP3 |
| F15 | `pan()` 6769-6875 nested `field()`/`label()` closures; `renderSeqRail` 7135-7196 mixes diffing with DOM build. | Hoist closures; split `railDiff`/`railBuild`. | pan_render green before and after | pan_render_v1, render_agreement, e2e rail tests | M | AP3 |
| F16 | `setMode` 8583-8585 duplicates the shuffle onclick label update (8440-8445). | `syncShuffleLabel()`. | "AP2-4 setMode and shuffle produce the same label" | e2e shuffle tests | S | AP2 |
| F17 | `doesNotThrow` around `applyKbOffset` (3028, no visualViewport) is the no-viewport FALLBACK case, not a vacuous test (outside voice). | Keep it unchanged. Add a separate positive test in a layout boot that asserts the offset written for a 400 px visual viewport. | "US-4 applyKbOffset writes the keyboard inset" | itself | S | US |
| F18 | Four FLOORS rows lag the CI count. | Raise to 243/256/52/29. | `suite_health.py` passes with the raised rows | CI `ran N` | S | FL |

## 4. Lanes

Concurrency is at most 4. Merge order within a wave follows the listed order. A later wave starts from main after the previous wave's last merge.

| Wave | Lanes (parallel) | Merge order | Why grouped |
|---|---|---|---|
| 1 | FL, EX, US, ET | FL, ET, US, EX | disjoint files; all test-only (rule 6) |
| 2 | EG, EB | EG, EB | EG touches `src/engine` + engine regions; EB touches e2e/cdp only |
| 3 | AP1 | - | sole `index.html` app owner |
| 4 | AP2 | - | same file as AP1 |
| 5 | AP3 | - | same file; needs EG `slotOrder` |
| 6 | FL2 | - | floors from main's CI |

Common to every lane:

- Branch is `claude/cx-<lane>` in its own `git worktree` (`worktree add --detach`, never `cp -r`). No `node_modules` symlink.
- Test names a lane adds begin `<LANE>-<step> ` so `--test-name-pattern` and `.`-wildcard `# suite:` patterns are unique.
- Lanes do NOT edit `FLOORS` (FL and FL2 own it).
- Local e2e means single tests only, with `--test-name-pattern`.
- Verify is shown as `V:`. `TAP` abbreviates `node --test --test-reporter=tap`.

### FL - floors catch-up (wave 1)

- **Goal:** set the four lagging rows to the CI count.
- **Non-goals:** any other row; any test.
- **Owns:** `tests/suite_health.py` (FLOORS rows only).
- **Never touches:** anything else.
- **Steps:**
  1. Read main's latest CI `ran N` for the four files from the "js suites (unit + e2e)" job log (verified at run 37155566494: 243 / 256 / 52 / 29). Set `app.test.js` 243, `e2e.test.js` 256, `mutation_harness.test.js` 52, `sequence.test.js` 29, or the CI value if a newer main run is higher.
     - Accept: each row equals main's CI count.
     - V: `python3 tests/suite_health.py && python3 -m unittest tests.test_suite_health 2>&1 | tail -1 | grep '^OK'`

### EX - uncaught-exception and settle-ceiling guards (wave 1)

- **Goal:** an app exception in any e2e test fails that test; settle ceiling hits become visible.
- **Non-goals:** sleeps, bounds and helper dedupe (EB); any describe move; `index.html`.
- **Owns:**
  - `tests/helpers/cdp.js`
  - `tests/harness.test.js`
  - `tests/e2e.test.js`, only the top-level `afterEach` hook and one sentinel test
  - new `tests/mutants/ex_*.patch`
  - refresh of existing patches whose every `+++ b/` is `cdp.js` (5 today) or `e2e.test.js` (`e_listen_error_never_settles`)
- **Never touches:** `index.html`, `tools/sandbox.js`, `src/`, any other e2e test body.
- **Steps:**
  1. `harness.test.js` "EX-1 an uncaught handler exception is reported": a page that throws in a click handler must appear in `takeExceptions()`, including when the throw happens in a SECOND `launch()` instance and when it is delayed by a `setTimeout` (outside voice). Then subscribe `Runtime.exceptionThrown` in `launchOnce` (463) into a module registry shared by all Browser instances (the describes at 7124/7763/8453/10701/10738 launch their own). Note `on()` at 136 keeps ONE handler per method, so the registry is the handler.
     - Accept: red before the subscription, green after.
     - V: `TAP --test-name-pattern='^EX-1 ' tests/harness.test.js | grep '^# pass 1$'`
  2. Add `afterEach` in `e2e.test.js` `run()` that drains the registry and logs `E2E-UNCAUGHT <test> <text>` without failing. Push and read the CI log.
     - Accept: CI e2e pass count unchanged.
     - Accept: every `E2E-UNCAUGHT` line becomes a queue row in this plan's section 9 (rule 5 triage, not a fix).
     - V: `git grep -n 'E2E-UNCAUGHT' tests/e2e.test.js | wc -l | grep -x 1`
  3. `harness.test.js` "EX-3 settle reports a ceiling hit": a never-ending animation makes `settle()` log `E2E-SETTLE-CEILING`. Implement it in `cdp.js` settle 194-203.
     - V: `TAP --test-name-pattern='^EX-3 ' tests/harness.test.js | grep '^# pass 1$'`
  4. Enforcement:
     - Switch `afterEach` to `assertNoUncaught()`.
     - For any row from step 2, add a per-test scoped expectation (`expectUncaught(/pattern/)`) that names the queue row. There is no global allow-list.
     - Add e2e "EX-4 sentinel: the uncaught guard is armed": it throws in the page from a click handler, declares `expectUncaught(/EX-4 sentinel/)` so the enforcing `afterEach` does not fail it, and asserts the registry recorded the throw. (Without the scoped expectation the sentinel would fail its own `afterEach`.) `Runtime.exceptionThrown` only fires after `Runtime.enable` (`cdp.js:521`); the `on()` registration is a map lookup, so registering it in `launchOnce` before `enable` is fine.
     - Settle throws at its ceiling ONLY if two CI runs logged zero `E2E-SETTLE-CEILING`. Otherwise it stays report-only and the hits are filed (auto-decision A4).
     - Accept: the sentinel passes; CI e2e count is today's +1.
     - V: `TAP --test-name-pattern='EX-4 sentinel' tests/e2e.test.js | grep '^# pass 1$'`
- **Mutants:**
  - `ex_exception_listener_dropped.patch` (removes the subscription). `# kills: EX-1 ...`, `# suite: node --test --test-name-pattern=^EX-1.an.uncaught tests/harness.test.js`
  - `ex_afterEach_no_assert.patch` (makes `assertNoUncaught` a no-op). Kills the EX-4 sentinel, suite `--test-name-pattern=EX-4.sentinel tests/e2e.test.js`.
  - `ex_settle_ceiling_silent.patch` kills EX-3.

### US - unit-test surface (wave 1)

- **Goal:** make swipe, wheel, capture and `applyKbOffset` unit-testable, and pin the global test surface before any rename.
- **Non-goals:** any `index.html` change (rule 6); changing the default boot; matchMedia desktop emulation beyond an opt-in flag.
- **Owns:**
  - `tools/sandbox.js`
  - `tests/helpers/sandbox.js`
  - `tests/app.test.js` (new tests at file end; the 3028 strengthening)
  - `tests/fixtures/app_surface_v1.json`
  - new `tests/mutants/us_*.patch`
- **Exception (named):** US may ADD new patches under `tests/mutants/` whose `+++ b/` is `index.html`, to kill its new swipe/wheel tests. It edits no existing `index.html` patch and no line of `index.html` itself (rule 6 holds: the PR diff never touches `index.html`). Five of those six patches anchor inside 8629-8942, so AP1 inherits them (its strand count is 64 + 5); the sixth, `us_kb_cap_dropped.patch`, anchors at `applyKbOffset` ~7956 and is AP2's (A18, US-N1).
- **Never touches:** `index.html`, `src/`, `e2e.test.js`, `cdp.js`.
- **Steps:**
  1. "US-1 every app surface name resolves". The fixture lists the names read through `app.get`/`app.run`/`b.eval`, harvested once by a scratch script that is not committed. The test asserts that evaluating each bare name in a default boot throws no `ReferenceError`. It does NOT assert the value is defined: `scene` is legitimately `undefined` in the default boot (`scene = card.parentElement`, 8638), so a `typeof` check would be red on today's code (outside voice).
     - Accept: red with the fixture absent; green with it.
     - V: `TAP --test-name-pattern='^US-1 ' tests/app.test.js | grep '^# pass 1$'`
  2. `boot({layout:true})`:
     - `makeElement` gains `parentElement` (set on appendChild and for the card -> scene), `getBoundingClientRect` (fixed 360x520 card box), `animate` returning `{finished: Promise, cancel()}`, `getAnimations`, `setPointerCapture`/`releasePointerCapture`, `closest`, `contains`, `isConnected`, `offsetWidth`/`offsetHeight`, `scrollLeft`.
     - The window gains `visualViewport`, `requestAnimationFrame`, and `querySelector("main")`.
     - The document stub gains `dispatchEvent(ev)` that runs its `_l[ev.type]` listeners (`tools/sandbox.js:344` stores them today but nothing dispatches them). The capture pointerdown at `index.html:8913` is registered on `document`, so US-3 "an open panel blocks the capture pointerdown" and AP1-1 cannot run without it (eng review finding).
     - Default boot is untouched.
     - Test: "US-2 layout boot gives the card a scene".
     - Accept: `node tools/boot_sim.js` and the full `app.test.js` pass unchanged.
     - V: `TAP tests/app.test.js | grep '^# fail 0$' && node tools/boot_sim.js && node tools/regen_card_fixture.js --check`
  3. Unit tests over the CURRENT code, using `app.run` to dispatch synthetic pointer/wheel events in a layout boot:
     - "US-3 a fast flick past threshold flies out"
     - "US-3 a slow short drag springs back"
     - "US-3 an open panel blocks the capture pointerdown"
     - "US-3 one wheel gesture over WHEEL_COMMIT_PX steps once"
     - "US-3 wheel is ignored mid-flight"

     These are spec-first. Thresholds come from the README/e2e expectations, never from `SWIPE_*` (rule 2).
     - Bound (eng review R3): the stub's dispatch has no capture/bubble phases, its selectors match only simple ids/classes/tags (`tools/sandbox.js:259`), and elements lack `querySelectorAll` (outside voice). If a US-3 test needs a stub member beyond the step 2 list, do NOT add it: cut that test, record it in section 9, and leave the behaviour to the e2e "card swipe" describe plus AP1's pure decision tables. US-2 ships with the step 2 list regardless.
     - V: `TAP --test-name-pattern='^US-3 ' tests/app.test.js | grep -E '^# pass [1-5]$'` and the cut list in the PR body.
  4. "US-4 applyKbOffset writes the keyboard inset": a NEW test in a layout boot with a `visualViewport` of height 400. The 3028 no-viewport test stays byte-identical (it covers the fallback path).
     - V: `TAP --test-name-pattern='US-4 ' tests/app.test.js | grep '^# pass 1$'`
- **Mutants:**
  - `us_surface_name_missing.patch` (adds a bogus name to the fixture, kills US-1)
  - `us_layout_no_parent.patch` (sandbox, kills US-2)
  - one `index.html` mutant per US-3/US-4 test that ships (up to 5 + 1), e.g. `us_release_ignores_velocity.patch` with `# suite: node --test --test-name-pattern=^US-3.a.fast.flick tests/app.test.js`
  - Total up to 8.

### ET - engine test gaps + corpus oracle (wave 1)

- **Goal:** direct tests for untested exports and one output snapshot that EG refactors against.
- **Non-goals:** any `src/engine` change; any engine region.
- **Owns:**
  - `tests/core.test.js`, `layout.test.js`, `select.test.js`, `voicing.test.js`, `pdfcards.test.js` (new tests at file end)
  - `tests/fixtures/engine_corpus_v1.json`
  - new `tools/regen_engine_corpus.js`
  - new `tests/mutants/et_*.patch`
- **Exception (named):** ET may ADD patches under `tests/mutants/` whose `+++ b/` is `src/engine/*.js`. Those are files in `tests/mutants/`, not edits to `src/`; the mutation gate applies them with `git apply` and the engine suites load `src/engine` through `tests/helpers/engine.js`, so they are killable.
- **Never touches:** `index.html`, any file under `src/`, `data/`.
- **Steps:**
  1. `tools/regen_engine_corpus.js [--check]`, modelled on `regen_card_fixture.js`. It loads the engine via `tools/engine_loader.js` and records, for the 20 `synthetic_scales.json` strings plus one malformed seed per `REASONS` code reachable from parseSeed (enumerate `HPE.core.REASONS` at run time; the table at `core.js:16` has 9 entries today, not 12):
     - `parseSeed` result `{ok, code}` or `fields`
     - `layout.solve` geom
     - `select.build` chord list (main, sup, fields, roots, warning code)

     Test: "ET-1 engine corpus matches" in `core.test.js`.
     - Accept: the `--check` exit code is the oracle; regenerate only with a stated reason in the commit body.
     - V: `node tools/regen_engine_corpus.js --check && TAP --test-name-pattern='^ET-1 ' tests/core.test.js | grep '^# pass 1$'`
  2. Spec-first tests:
     - "ET-2 fifthName" (C->G, Db->Ab, B->F#, Fb->Cb, A#->E# from the core.js section-2 comment)
     - "ET-2 rim/bottom/inner angles follow CLAUDE.md zig-zags" (Hijaz/Pygmy/Amara literals from CLAUDE.md)
     - "ET-2 noThirds"
     - "ET-2 reduceIntervals"
     - "ET-2 hexColor/bankers" (`pdfcards.test.js`)
     - V: `for f in core layout select voicing pdfcards; do TAP --test-name-pattern='^ET-2 ' tests/$f.test.js | grep -q '^# fail 0$' || exit 1; done`
- **Mutants:** `et_corpus_check_blind.patch` (makes `--check` return 0) and one per ET-2 group in its target module. Total 7.

### EG - engine refactor (wave 2)

- **Goal:** findings F9 (B185-1), F10 and F11 behind unchanged output.
- **Non-goals:**
  - The parseSeed `order` contract (hotspot 7).
  - Any `select` ranking change.
  - Any change visible in `engine_corpus_v1.json`, the sequence goldens, `golden_decks_v3` engine tests or PDF text.
- **Owns:**
  - `src/engine/*.js`
  - the engine regions in `index.html`, written ONLY by `python3 tools/inline_engine.py`
  - `tests/{core,layout,select,voicing,sequence,pdfcards}.test.js` (new tests at file end)
  - `tests/mutants/` patches whose every `+++ b/` is under `src/engine/` or `tests/<owned>.test.js`
  - the generated-region hunks of `index.html` patches (re-anchor only)
- **Never touches:** `index.html` outside engine regions, `data/`, `tools/hifi.py`, `tools/decks.py`.
- **Steps:**
  1. "EG-1 sequence pickers share one validity rule": `pickBasic` and `pickTiered` reject the same previous-step set over the golden decks. Extract `prevValid` and `homeOrRefuse` in `sequence.js`.
     - V: `TAP tests/sequence.test.js | grep '^# fail 0$' && node tools/regen_engine_corpus.js --check`
  2. `pc`/`isDing` dedupe:
     - `sequence.js:54`, `voicing.js:35`, `select.js:271/290`, `sequence.js:73`.
     - `pdfcards.js:340/350/439-448`, through `function core(){ return HPE.core; }` called at use time, not at load time.
     - Test: "EG-2 pdfcards loads before core and still renders a card", which loads the regions in index order.
     - V: `TAP --test-name-pattern='^EG-2 ' tests/pdfcards.test.js | grep '^# pass 1$' && python3 tools/inline_engine.py && python3 tools/inline_engine.py --check`
  3. "EG-3 warning shape equals core.err shape". If equal, route `select.warning` through `core.err`; if not, leave it and note why in the PR.
  4. `parseSeed` -> `tokenize`/`validate`/`assemble` (internal, not exported).
     - Accept: corpus unchanged; `core.test.js` count unchanged plus EG tests.
     - V: `node tools/regen_engine_corpus.js --check && TAP tests/core.test.js | grep '^# fail 0$'`
  5. `layout.solve` -> per-zone placement + merge. Export `slotOrder(zoneCounts)`. Test: "EG-5 slotOrder matches solve's emitted field order on the corpus".
     - V: `TAP tests/layout.test.js | grep '^# fail 0$' && node tools/regen_engine_corpus.js --check`
  6. Final checks:
     - V: `python3 tools/inline_engine.py --check && node tools/regen_card_fixture.js --check && python3 -m unittest tests.test_render_agreement tests.test_print 2>&1 | tail -1 | grep '^OK'`
- **Mutants:** one per new helper (`eg_prevvalid_inverted`, `eg_lazy_core_eager`, `eg_slotorder_swapped`, `eg_tokenize_drops_last`). Re-anchor the 118 `src/engine` patches per section 5; expect most of them in `core.js`/`layout.js` to need it. If more than 40, split into EG-a (steps 1-3) and EG-b (steps 4-6).

### EB - e2e body (wave 2, after EX merged)

- **Goal:** F12 plus D180-1. (The EB-1 Tab-order probes were cut with AP2 step 3, eng review R4.)
- **Non-goals:** describe moves; renaming any test (mutant selection); `index.html`; the EX hook.
- **Owns:**
  - `tests/e2e.test.js` (test bodies and helpers)
  - `tests/helpers/cdp.js` (settle helpers 345-376)
  - `tests/mutants/` patches whose every `+++ b/` is one of those two files
- **Never touches:** `index.html`, `tools/sandbox.js`, `app.test.js`.
- **Steps:**
  1. Cut (R4): the EB-1 Tab-order probes existed only to gate AP2 step 3, which is cut. No e2e test is added by EB.
  2. Replace the 16 fixed sleeps with `waitFor` on the condition each one waits for. Line 126 (server-boot poll) stays as a poll interval. Check each changed test singly.
     - Accept: the CI "js suites (unit + e2e)" job at EB's head SHA finishes in at most 262 s. Baseline: 238 s on main run 37155566494 (21:34:21 to 21:38:19 UTC, 2026-10-03), plus 10%.
     - V per test: `TAP --test-name-pattern='<exact name>' tests/e2e.test.js | grep '^# pass 1$'`
  3. Two-sided bounds where the spec states a range (2445/2539/2498/8855/8929/9762/10160/10441/10490/10493/10515). Where no upper bound is stated, leave it and list it in the PR.
  4. Helper dedupe: one module-level `enterSeqMode`, `railText`, `walk`, rect/measure/rectsOf/tick/pt. Names and call sites stay; only the definitions merge. Also the D180-1 settle triplication in `cdp.js` 345-376.
     - V: `node --check tests/e2e.test.js && TAP --test-name-pattern='sequence mode.*rail' tests/e2e.test.js | grep '^# fail 0$'`
- **Mutants:** `eb_waitfor_condition_inverted.patch` for one representative converted sleep (killed by that test's own `# suite:`). Re-anchor e2e-targeting patches that the dedupe strands.

### AP1 - swipe / wheel / capture (wave 3)

- **Goal:** F5.
- **Non-goals:** any threshold, timing or easing value; any `SWIPE_*`/`WHEEL_*` rename or value change (pinned at `app.test.js` 4376-4414); any name in `app_surface_v1.json`.
- **Owns:**
  - `index.html` lines outside generated regions, 8629-8942 only
  - `tests/app.test.js` (new tests at file end)
  - `tests/mutants/` patches whose every `+++ b/` is `index.html` and whose removed lines are inside 8629-8942
- **Never touches:** engine regions, the DECKS line, CSS, markup, `e2e.test.js`.
- **Steps:**
  1. "AP1-1 canStartGesture guard table" (unit, pure): a table over drag/isPrimary/button/panelOpen/sheetOpen/order.length through `canStartGesture(e, state)`. Red: the function is absent. Then both listeners call it: the card listener at 8827 and the capture listener at 8924. The two listeners are NOT equivalent and the test does not claim they are: the capture path additionally requires a flight and an inside hit and calls `land()` first (8914-8926, outside voice). Those conditions stay in the capture listener untouched.
     - V: `TAP --test-name-pattern='^AP1-1 ' tests/app.test.js | grep '^# fail 0$'`
  2. "AP1-2 releaseDecision table" (unit, pure): `releaseDecision({dx, dy, vx, moved, cancelled, blocked, mouse, reducedMotion})` returns `{kind: rest|spring|fly, dir, eatClick}`. `dy` and `moved` are inputs because today's `release` reads both (8758, 8769): an out-and-back drag ends at zero displacement and must still eat the trailing click (outside voice). Table rows: fast flick, slow short drag, out-and-back, vertical-dominant drag, cancelled, blocked, mouse, reduced motion. Write the expected values from the e2e "card swipe" expectations. Red: the function is absent. Then `release` 8745-8792 calls it and executes the action.
     - V: `TAP --test-name-pattern='^AP1-2 ' tests/app.test.js | grep '^# fail 0$'`
  3. "AP1-3 wheelDecision table" (unit, pure): the same pattern for the wheel listener 8873-8906 (skip / accumulate / commit / gesture end), with `deltaMode` 0, 1 and 2 rows: today's listener normalises line and page deltas (8886), and dropping that would leave a six-line horizontal wheel accumulating 6 px instead of 96 px while every e2e wheel helper still passes pixel deltas (`e2e.test.js:10125`, outside voice). Mutant `ap1_wheel_deltamode_dropped` kills the line-delta row.
  4. e2e regression, single tests only:
     - V: `TAP --test-name-pattern='card swipe' tests/e2e.test.js | grep '^# fail 0$'`
     - Plus CI full e2e at the head SHA.
  5. V: `node tools/regen_card_fixture.js --check && node tools/boot_sim.js && python3 tools/refresh_mutants.py --check`
- **Mutants:** one per new function (`ap1_cangesture_ignores_sheet`, `ap1_release_drops_reduced_motion`, `ap1_wheel_commit_off_by_one`, `ap1_wheel_deltamode_dropped`). Re-anchor the existing patches in this range (64 hunks today, but the cap counts patch FILES touched, not hunks) plus the 5 `us_*` patches US anchored here (the sixth is AP2's, A18). AP1 is planned as two PRs from the start: AP1-a (steps 1-2: the guard at both sites and the swipe release, so any capture patch that step 1 strands belongs to AP1-a) and AP1-b (step 3, wheel). Count touched patch files before opening each PR; if either exceeds 40 it is subdivided again (AP1-a1/a2) rather than merged over the cap.

### AP2 - sheet, panel, runGenerate, setMode (wave 4)

- **Goal:** F7, F8, F16.
- **Non-goals:** any change to focus order (the Tab-stop lists stay hand-written, R4); history/popstate semantics (`sheetRoute` 8006, popstate 8115); the delete-arm flow.
- **Owns:**
  - `index.html` 7922-8600 outside generated regions (extended from 7969 by A18 so `us_kb_cap_dropped.patch` at `applyKbOffset` 7922-7962 has an owner)
  - `tests/app.test.js` (new tests at file end)
  - `tests/mutants/` patches whose every `+++ b/` is `index.html` and whose removed lines are in that range
- **Never touches:** 8629-8942 (AP1's region), CSS, markup, engine regions, `e2e.test.js`.
- **Steps:**
  1. "AP2-1 sheet open leaves the expected state per mode": a table, green today. The scale open (8032) CLEARS identity and options; the edit open (8051) RESTORES identity, name, seed, palette, mirror and layout order for `editingId`. They are not identical (outside voice). The test snapshots the lets (`editingId`, `refusal`, `nameDirty`, `palette`, `mirror`, `layoutOrder`, `layoutSel`, mode) after scale open, after edit open, and across an edit -> create -> edit transition. Then extract `resetSheetState(opts)` that both opens call with their own mode values.
  2. "AP2-2 setInert applies each caller's own background set": layout boot, green today. The sheet's inert set (8016/8099) and the panel's (`openPanel` 8479 / `closePanel` 8489) are deliberately different (7406 vs 8458, outside voice). `setInert(on, targets)` takes the set as an argument; the test asserts the two sets separately and that neither changes.
  3. CUT (eng review R4). DOM-order Tab stops are not derived. The hand lists at 8391-8405 and 8468-8478 encode choices DOM order cannot reproduce: the panel trap includes a trigger outside the panel (8469), and the sheet stops vary with editing, visibility and disabled state (8393). Deriving them closes no blind spot and needs browser coverage (wrap forward and reverse, focus restoration, breakpoint crossings, Back/Escape) that no lane has. The lists stay as they are.
  4. "AP2-3 a refused generate restores readonly and the label and leaves the button disabled until the seed changes": green on today's code (the button is re-enabled by `syncParseState` 7845 on the next parseable input, not by `runGenerate`). Then `runGenerate` gets a try/finally that restores readonly + label ONLY, and `refusal` is returned. `genBtn.disabled` is not touched by the finally block: moving it there would re-enable the button on a refused seed, which is a behaviour change (eng review R2).
  5. "AP2-4 setMode and shuffle produce the same label": `syncShuffleLabel()`.
  6. V: `TAP tests/app.test.js | grep '^# fail 0$' && node tools/regen_card_fixture.js --check && node tools/boot_sim.js && python3 tools/refresh_mutants.py --check`
- **Mutants:** one per AP2 test (4: AP2-1, AP2-2, AP2-3, AP2-4). Re-anchor the patches in range (about 39 + 13 + 11 hunks today; the cap counts patch files). If more than 40 files, split as AP2-a (steps 1-2) and AP2-b (steps 4-5). The panel-adjacent `e_panel_moved_into_header.patch` is re-cut against a stable anchor (section 5).

### AP3 - render, pan, rail, app-side engine restatement (wave 5)

- **Goal:** F13, F14, F15.
- **Non-goals:** any byte of card faces or diagrams; `generateDeck` (deferred); `parseLineText`.
- **Owns:**
  - `index.html` 6680-7560 outside generated regions
  - `tests/app.test.js` (new tests at file end)
  - `tests/mutants/` patches whose every `+++ b/` is `index.html` and whose removed lines are in that range
- **Never touches:** the regions AP1 and AP2 owned, engine regions, the DECKS line, CSS, existing fixtures (a change to any committed digest is a stop, not a regeneration; the new `gen_face_v1.json` is created in step 0 and then frozen the same way).
- **Steps:**
  0. Characterisation first (outside voice: `card_face_v1` hashes built-in faces only, not generated decks, and nothing hashes the rail DOM). Add `tests/fixtures/gen_face_v1.json`, written by extending `tools/regen_card_fixture.js` with a `--gen` section: the face HTML of the first three cards of each of the 20 `synthetic_scales.json` decks in both answer modes, plus the sequence-rail `innerHTML` for one basic and one tiered sequence on Amara. Test "AP3-0 generated faces and rail DOM match the committed digest". This lands in its OWN commit, before any refactor commit on the branch, so the reviewer can verify the digest was taken from main's rendering. A later digest change in the branch is a stop.
     - V: `node tools/regen_card_fixture.js --check` (now covers both fixtures)
  1. `faceHTML(card, opts)`; evaluate S mode once (7198/7217). Test: "AP3-1 faceHTML is the only answer-template builder" (a source-free behavioural check: front and back of A and B mode render through one spy).
     - V: `node tools/regen_card_fixture.js --check && TAP --test-name-pattern='every built-in card face' tests/app.test.js | grep '^# pass 1$'`
  2. Hoist `pan()`'s `field()`/`label()`.
     - V: `TAP --test-name-pattern='pan_render' tests/app.test.js | grep '^# fail 0$' && python3 -m unittest tests.test_render_agreement 2>&1 | tail -1 | grep '^OK'`
  3. "AP3-3 layoutIds equals engine slotOrder on all 20 synthetic scales". Then `layoutIds`/`zoneBlock` read `HPE.layout.slotOrder`, and `pc`/`chordSets` 6694-6705 use `HPE.core.pc`. `pc` stays as a name if it is in `app_surface_v1.json`.
  4. `renderSeqRail` -> `railDiff` + `railBuild`; `railSeq`/`railEl` stay module lets.
     - V: `TAP --test-name-pattern='rail' tests/e2e.test.js | grep '^# fail 0$'`
- **Mutants:** one per new helper (3) plus `ap3_gen_digest_blind.patch` (makes the `--gen` check return 0; kills AP3-0). Re-anchor about 28 hunks.

### FL2 - close-out (wave 6)

- **Owns:** `tests/suite_health.py` FLOORS rows; the status line of this plan.
- **Step:** set every row that a lane grew to main's CI `ran N` after AP3 merges.
  - V: `python3 tests/suite_health.py`

## 5. Mutant plan

The same procedure applies in every lane, on a clean committed tree (refresh refuses a dirty tree):

1. Commit the refactor, then run `python3 tools/refresh_mutants.py`. It rewrites only patches that `git apply --check` rejects.
2. Run `python3 tools/refresh_mutants.py --check`. Every patch it reports as UNFIXABLE or AMBIGUOUS (26 anchors are already ambiguous) is re-cut:
   - make the scratch edit on the committed tree against a stabler anchor (a line unique in the file, preferably the function signature rather than a CSS rule or markup)
   - `git diff > tests/mutants/<same name>.patch` below the unchanged `# kills:`/`# suite:` prose (rule 4)
   - kill it locally: `git apply tests/mutants/X.patch && <its # suite: command>; rc=$?; git apply -R tests/mutants/X.patch; test $rc -ne 0`, and read the TAP output: the `not ok` line must name the `# kills:` test. A kill from an unrelated exception or a stale-inline mismatch is coverage that is not there (outside voice, `mutation_check.sh:293-309`).
3. If a mutated line no longer exists (for example, the duplicated guard at 8924 after AP1), replace the patch one-for-one with a mutant of the new single site, killed by the same `# kills:` test. List every such replacement in the PR body as `old -> new`.
4. `# suite:` patterns use `.` for every space and never quotes (word-split). Check that each new pattern selects exactly one test with `--test-name-pattern` before committing.
5. Never run `mutation_check.sh` in full locally, and never edit the worktree while any mutation run is active. CI's sharded gate is the evidence.
6. **Cap:** 40 or fewer patches added, edited or replaced per PR. A lane over the cap splits as stated in its block.
7. Ownership: a lane edits a patch only if every `+++ b/` target is a file it owns, with the named exceptions above. The 11 multi-file `index.html` patches (the `b_*` data mutants, for example `b_layout_angle_swap.patch`) also target `data/decks.json`, which no lane owns and no lane changes (eng review R5, amending A14): the app lane whose range contains the `index.html` hunk may re-anchor THAT hunk only; the `data/decks.json` hunk must stay byte-identical, which the reviewer checks by diffing the patch file. Any other multi-file patch waits for the lane that owns its other target; record the hand-off in section 9.
8. Execution surface: a patch whose target is `src/engine/*.js` has a `# suite:` that runs an engine unit suite (`core`/`layout`/`select`/`voicing`/`sequence`/`pdfcards`/`naming`/`share`), which load from `src/engine` through `tests/helpers/engine.js`. The gate applies the patch without re-inlining (`mutation_check.sh:293`), so an `app.test.js` or e2e suite cannot see a source-only mutant and would "kill" it only by accident. Conversely an `index.html` patch names an app or e2e suite.
9. `refresh_mutants.py` rewrites every stranded patch in the tree, not only the lane's own. After running it, a lane commits only the rewrites of patches it owns and reverts the rest (`git checkout -- tests/mutants/<other>.patch`), listing them in the PR body as hand-offs. The reviewer's ownership check reads the PR diff, not the tool's output.

Expected strand counts, from the hunk survey:

| Lane | Hunks in range |
|---|---|
| AP1 | 64 |
| AP2 | about 63 (39 sheet/panel, 13 runGenerate, 11 tier/setMode/keydown) |
| AP3 | about 28 (render 8, pan 13, rail 7) |
| EG | up to 118 `src/engine` patches, most not stranded (bodies outside the split functions) |
| EB | 1 e2e plus 5 cdp |

## 6. Standing merge gates (verbatim)

- CI green at a head SHA verified with `gh pr view --json state,headRefOid` against the local tip.
- A fresh `swarm-reviewer` PASS/PASS_WITH_NITS at that SHA, briefed with the lane's acceptance block quoted verbatim and no added rules.
- Bounce cap 2, one counter; after a second FAIL the lane stops and a reviewed sub-plan is drafted.
- `gh pr merge <n> --merge`.
- Semantic-coupling rule: before merging a lane while another that touches `index.html` or the fixtures has merged since its CI ran, merge main into the branch and take CI at the new head.
- Never run full `mutation_check.sh` or full e2e locally.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Mutant re-anchor drift: a hand re-cut kills for the wrong reason, which the gate cannot see. | `refresh_mutants.py` first. Re-cut against function-signature anchors and run each `# kills:` test locally. Do one-for-one replacement lists in the PR body. Keep the cap at 40 so the reviewer can read every patch. |
| A fixture oracle goes stale legitimately (for example, `engine_corpus_v1` after an intended engine fix). | No lane in this plan may change output. Any stale fixture is a STOP with a rule-5 triage. A regeneration happens only in the same commit, with a stated reason, and needs owner approval because it is a behaviour change. |
| `app_surface_v1.json` blocks a legitimate rename. | Renames are out of scope here. A future lane updates the fixture and every reader in one PR. |
| The e2e shard time is near the 6 min ceiling. | EX adds 1 test and EB adds none. EB's sleep-to-condition change must not grow shard time by more than 10%. If a shard nears its limit, raise `MUTANT_SHARD`/e2e sharding in a separate CI-only commit rather than dropping tests. |
| Flake. | Rerun the failed job at the same SHA first. One rerun only. A second red at the same SHA is real. A lone mutant survivor on an unrelated diff is also rerun first. |
| EX enforcement exposes real app exceptions. | Report-only first. Each hit becomes a queue row with a per-test scoped expectation, never a global allow-list. Bugs are not fixed in EX (rule 6). |
| The layout sandbox drifts from the browser (the fixed rect, `animate` that finishes instantly). | It is opt-in. Unit tests assert decisions, not pixels. The e2e "card swipe" describe remains the behavioural oracle. |
| A conflicting PR blocks CI. | Check `gh pr view --json mergeable` before suspecting Actions. |
| `pdfcards` is inlined before `core`. | The EG-2 test loads the regions in index order. A lazy accessor only. |

## 8. Projected cost

- Lanes: 10 (FL, EX, US, ET, EG, EB, AP1, AP2, AP3, FL2).
- PRs: 12-15. The base is 11 (AP1 is two PRs from the start). Likely splits are EG-a/b, with AP2-a/b and AP1-a1/a2 possible.
- Reviewer runs: about 14-17 (one per PR plus an expected 3 bounces). FL and FL2 still get a reviewer.
- CI runs: about 35-40 (PR pushes plus semantic-coupling re-merges in waves 3-5 plus 2 extra for EX's report-only observation).
- New patches: about 35. Re-anchored: about 150-200 across EG/AP1-3.

## 9. Auto-decisions (AFK armed)

| # | Decision | Rejected alternative | Rationale |
|---|---|---|---|
| A1 | Pin the test surface with `app_surface_v1.json` plus a resolve test. | `window.__app` object | `__app` adds shipped code only for tests, means rewriting 266 reads, and would itself need a migration. The manifest keeps bare-global reads and turns renames red. |
| A2 | Layout sandbox is opt-in (`boot({layout:true})`). | Upgrade the default sandbox | Default boot feeds card_face, boot_sim and 243 tests. Opt-in has zero blast radius. |
| A3 | EX reports uncaught exceptions in CI before enforcing them. | Enforce immediately | Unknown pre-existing exceptions would redden unrelated lanes. Rule 5 needs triage rows first. |
| A4 | Settle throws at its ceiling only after two clean CI runs; otherwise it stays report-only. | Always throw | A ceiling hit can be a legitimately long animation. Two observations separate signal from flake. |
| A5 | No describe restructure in e2e. | Merge the overlapping describes | `# suite:` patterns match full names; moves silently change mutant selection. |
| A6 | Wave 1 lanes do not edit FLOORS; FL raises the lagging rows and FL2 sets the rest from CI. | Each lane edits its own row | Four lanes on one file conflict; CI counts the merge ref, so local counts are wrong anyway. |
| A7 | SUPERSEDED by R4 (eng review): DOM-order Tab stops and the EB-1 probes are cut outright. | Gate on EB-1 probes | The hand lists encode choices DOM order cannot reproduce (panel trigger outside the panel, 8469; state-dependent sheet stops, 8393). |
| A8 | Hotspot order is AP1 > AP2 > AP3. | Start with `render()` (smallest, byte-pinned) | AP1 has the largest blind spot and hunk count. AP3 is the safest and depends on EG. |
| A9 | Defer hotspot 7 (`generateDeck`) and `parseLineText`. | Fold them into EG/AP3 | Hotspot 7 changes the `parseSeed` option contract. `parseLineText` is a different format, not a duplicate. |
| A10 | Leave the source-text coupling tests and the `SWIPE_*` pins as they are. | Rewrite them to behavioural form | Rewriting them is test churn with no blind spot closed. AP1 is constrained to keep the pinned names and values. |
| A11 | `select.warning` routes through `core.err` only if EG-3 shows equal shapes. | Force the merge | `warning` may return a shape the title blurb reads differently. Equality is tested, not assumed. |
| A12 | The engine corpus covers parseSeed + solve + select.build over the existing 20 synthetic strings plus malformed tokens. | Reuse `golden_decks_v4.json` as EG's oracle | v4 is a frozen data corpus that only `test_fixture_integrity.py` reads by sha; it does not snapshot engine output. |
| A13 | Prefixes are `ex_`, `us_`, `et_`, `eg_`, `eb_`, `ap1_`, `ap2_`, `ap3_`. | Reuse `e_`/`u_` | All are unused at e3fe4a5, so no collision with the 47 prefixes in use. |
| A14 | AMENDED by R5 (eng review): the `b_*` data mutants' `index.html` hunk is re-anchored by the app lane in range; their `data/decks.json` hunk stays byte-identical. Other multi-file patches are re-cut by the lane owning all their targets. | Let the app lane edit them freely | No lane owns `data/`, so the original rule had no owner for the 11 `b_*` patches. |
| A15 | 2026-10-04: main went red at c63b468 on `tests/test_readme_currency.py` (598 patches on disk vs README "536", 90% floor). Restated README.md:127 to 598 in #217 as a lane-less hotfix PR, reviewed and merged before any further lane. The stated count now sits at the test's ceiling: any lane that REMOVES a patch must restate it. | Fold the README edit into the next lane PR | Every open and future PR was red on the same test; no lane owns README.md. |
| A16 | 2026-10-04: EX (#213) and EG (#218) were re-merged onto main by the orchestrator (semantic-coupling rule, section 6, after ET and US merged fixtures; then again after #217) rather than bounced to the lanes. | Ask each lane to re-merge | A plain `git merge origin/main` with no conflicts; CI was taken at the new heads. |
| A17 | 2026-10-04: EG's EG-2b hand-off (pdfcards lazy-core half of EG-2) accepted as a queue row rather than bouncing #218. The blocking loaders, confirmed against the repo, are `tools/pdf_build.js:70,77`, `tests/pdf_builtin.test.js:18` and `tests/pdfcards.test.js:8` (its `P.build` tests reach `chordCard` 439-448), as the EG-2b row says; `tests/test_render_agreement.py:629` reads only `GEOM`/`PAPER`/`slots`/`CARD_WARNINGS` and is optional while the accessor stays lazy. Editing `pdfcards.test.js:8` is outside EG's Owns (new tests at file end only). | Bounce EG to widen its Owns | The loaders are outside EG's Owns; widening a lane mid-flight is a scope change the plan reserves for the owner. |
| A18 | 2026-10-04: AP2's `index.html` range is extended from 7969-8600 to 7922-8600 so `tests/mutants/us_kb_cap_dropped.patch` (anchors at `applyKbOffset`, 7922-7962) has an owner (US-N1). AP2's brief states it. | Leave 7922-7968 unowned | An unowned patch that a later lane strands has no one to re-anchor it; AP3's range (6680-7560) is further away. |
| A19 | 2026-10-04: AP1-a (#221, steps 1-2) and AP1-b (step 3) run SERIALLY; AP1-b branched from main after #221 merged. | Parallel from the same base | Both re-anchor the same `index.html` mutant patches in the swipe/wheel section; parallel runs would conflict on every one of them. |
| A20 | 2026-10-04: EB (#220) received a second reviewer FAIL at 50c9f96 (the 50 ms touch-decay sleep at `e2e.test.js:9258` became an unbounded `waitFor`; a `? 400 : 150` decay mutant passes at head and fails on main). Per the standing contingency rule the bounce stopped; a sub-plan (`docs/plans/2026-10-04-eb-timing-bounds-subplan.md`, committed on `claude/cx-eb` at a0b20f5, lands on main with #220) classifies all 16 conversions, is eng-reviewed, and is executed by a fresh lane agent then a fresh reviewer. | Bounce EB a third time | Two FAILs on the same class of defect (timing bounds dropped) means the fix must be systematic, not per site. |
| A21 | 2026-10-04: AP3's `index.html` range (plan-time 6680-7560) was read as the span of its named anchors on fe63803 (`pc` 6770, `chordSets` 6771, `pan` 6845, `renderSeqRail` 7211, `layoutIds` 7599, `zoneBlock` 7622; about 6756-7636), so `layoutIds`/`zoneBlock` stayed in scope after the +76 drift. AP3's brief stated it. | Hold AP3 to the literal plan-time numbers | The numbers were plan-time (63b5516); the anchors are what the steps name, and cutting step 3 for a line-number drift would have left the plan's own goal unmet. |
| A22 | 2026-10-04: FL2's Owns is extended to delete the three inert `KNOWN_UNCAUGHT` rows in `tests/e2e.test.js` (AP1-Q1), since EB did not and FL2 is the last lane; the `KNOWN_UNCAUGHT`/`afterEach` wiring stays. FL2 also restates `README.md:127` to the on-disk patch count (620) under A15. | Leave the rows for a later lane | `expectUncaught` only filters, so an inert row masks a regression of the very throw AP1-a fixed; no later lane exists. |

Queue rows produced during execution (EX step 2, US-3 cuts, mutant hand-offs) are appended here.

| Row | Source | Finding | Likely owner |
|---|---|---|---|
| EX-Q1 | EX step 2, CI run 37164644382 | e2e "card swipe: a tap during the fly-out lands it once and never flips the wrong card" throws uncaught `NotFoundError: Failed to execute 'setPointerCapture' on 'Element': No active pointer with the given id is found.` Masked by `KNOWN_UNCAUGHT` in `tests/e2e.test.js`. Fixed by #221 (try/catch in `startDrag`); mask rows deleted in #226 (A22). | AP1 (guard the `setPointerCapture` call in the capture path, or the test uses a live pointer id) |
| EX-Q2 | EX step 2, same run | e2e "card swipe: landing a flight during a mid-flight tap cancels a stale mouse-decay timer from the committing drag", same `setPointerCapture` NotFoundError, masked the same way. Fixed by #221 (try/catch in `startDrag`); mask rows deleted in #226 (A22). | AP1 |
| EX-Q3 | EX step 2, same run | e2e "card swipe: a short mouse drag whose lostpointercapture carries a stale clientX still springs back", same `setPointerCapture` NotFoundError, masked the same way. Fixed by #221 (try/catch in `startDrag`); mask rows deleted in #226 (A22). | AP1 |
| EX-SETTLE | EX step 4 | Zero `E2E-SETTLE-CEILING` hits in runs 37164644382 and 37165282685; `settle()` now throws at its ceiling (`b.strictSettle = false` opts out). | none |
| US-N1 | US review | `tests/mutants/us_kb_cap_dropped.patch` anchors at `applyKbOffset` (~index.html:7956), outside AP1's 8629-8942, so AP2 inherits it; the other five `us_*` index.html patches are AP1's. | AP2 |
| US-N2 | US report | `tools/sandbox.js` layout-only extras beyond the step 2 list: `#scale-sheet` sheetsurf child, `firstElementChild`, `innerHeight`, `finish()`/`state` on animation records; `document.dispatchEvent` is present in every boot. No growth in dispatch, selectors or `querySelectorAll` (R3 held). | none |
| ET-N1 | ET review | `engine_corpus_v1.json` records `layout.solve` geom only (not per-field angles) and `select.build` main/sup/fields/roots (not subtitles); it is not an angle or subtitle oracle. | EG reviewer (briefed) |
| EG-2b | EG report | pdfcards `pc`/`isDing` dedupe (pdfcards.js 340/350/439-448) cut: `tools/pdf_build.js`, `tests/pdf_builtin.test.js`, `tests/pdfcards.test.js` load no core module and are outside EG's Owns. Needs "core" added to those loaders first. | Owner: lane EG2B of `docs/plans/2026-10-04-close-out.md` |
| EG-3 | EG report | `select.warning` left as `{code, reason}`: `core.err` returns `{ok:false, code, reason}`, so routing would add `ok:false` to every `deck.warnings` entry (A11). Recorded by "EG-3 warning shape equals core.err shape" in `tests/select.test.js`. | none |
| AP1-Q1 | AP1-a (#221) report and review | EX-Q1..Q3 are fixed: `startDrag` wraps `card.setPointerCapture` in try/catch. The three `KNOWN_UNCAUGHT` rows at `tests/e2e.test.js:111-115` are now inert (`expectUncaught` only filters, so they would mask a regression of that throw). Delete them from an `e2e.test.js`-owning lane (EB, or FL2). The catch is a catch-all; narrowing to `NotFoundError` is a nit. | FL2 (done: rows deleted in the FL2 close-out, A22) |

Status: drafted 2026-10-03; eng-reviewed 2026-10-03 (ledger R1-R6 below), approved; execution started 2026-10-03 under AFK; execution COMPLETE 2026-10-04 (waves 1-5 merged: #213 #214 #215 #216 #217 #218 #219 #220 #221 #222 #223 #224 #225; FL2 close-out sets every grown FLOORS row to main's CI `ran N` at 844702a).

---

# Engineering review (2026-10-03)

Reviewer: `/plan-eng-review`, branch `main` at e3fe4a5, outside voice `codex exec` (15 findings, folded above). Every decision brief was auto-decided under AFK and is recorded in the ledger; no brief reached the owner.

## Scope Challenge

- **Reuse:** `tools/regen_card_fixture.js` (the AP3-0 and ET-1 oracles copy its `--check` shape), `tools/engine_loader.js` (ET's corpus loader), `tests/helpers/engine.js` (why `src/engine` mutants are killable), `tools/refresh_mutants.py` (re-anchoring), the existing e2e "card swipe" describe (AP1's behavioural oracle). Nothing new is built where one of these fits.
- **Minimum change:** every lane is a refactor behind an oracle that exists before the refactor commit (ET-1, AP3-0, `card_face_v1`, `app_surface_v1`). The plan adds no feature.
- **Complexity gate:** more than 8 files change across the plan (R1). The structure question was asked and answered: keep the 10 lanes because each PR is bounded by the 40-patch-file cap, the lane splits are pre-named, and the only alternative (fewer, larger PRs) makes the reviewer's patch-by-patch read impossible.
- **TODOS.md cross-reference:** DESIGN.md, iOS keyboard check (shipped), Part B root-instance enumeration, Pygmy "25 CHORDS" blurb. None overlaps a lane; none is pulled in.

## Section 1 - Architecture

- `[MEDIUM] (confidence: 9/10) index.html:7836-7854 — F8 described `genBtn.disabled` staying off after a refusal as a bug. It is state-driven by `syncParseState`; AP2-3 now asserts the current behaviour and the try/finally restores readonly + label only (R2).`
- `[MEDIUM] (confidence: 9/10) index.html:8391-8405, 8468-8478 — DOM-order Tab stops cannot reproduce the hand lists (trigger outside the panel at 8469; state-dependent sheet stops at 8393). Cut (R4).`
- `[LOW] (confidence: 8/10) tests/helpers/cdp.js:439-532 — the plan said only Page/Runtime are enabled; Network is enabled at 532 and Fetch optionally at 439. Corrected in F1; no design impact.`
- `[LOW] (confidence: 10/10) src/engine/core.js:16 — REASONS has 9 entries, not 12. ET enumerates at run time.`

## Section 2 - Code quality

- `[MEDIUM] (confidence: 8/10) tools/sandbox.js:344 — the document stub stores listeners and never dispatches; the capture pointerdown (index.html:8913) is on document. US step 2 adds dispatchEvent.`
- `[MEDIUM] (confidence: 8/10) tools/sandbox.js:259 — selectors are simple; US-3 tests are bounded best-effort and cut rather than growing the stub (R3).`
- `[LOW] (confidence: 9/10) index.html:8638 — scene is undefined in the default boot; US-1 asserts no ReferenceError, not typeof.`

## Section 3 - Tests

Coverage before and after, per hotspot (U = unit, E = e2e, M = mutant kill, O = output oracle):

```
hotspot                    before          after
swipe/wheel/capture 8629-  E . M .         E U M .   (AP1-1/2/3 tables, US-3 best effort)
sheet/panel 7922-8600      E . M .         E U M .   (AP2-1/2, AP2-3 refusal)
render/pan/rail 6680-7560  E . M O(builtin) E U M O(builtin+gen+rail)   (AP3-0)
parseSeed/solve/select     U . M .         U . M O   (ET-1 corpus)
e2e harness exceptions     . . . .         E U M .   (EX-1/3/4)
e2e timing (16 sleeps)     E . . .         E . M .   (EB waitFor + one mutant)
FLOORS                     lagging         = CI count (FL, FL2)
```

REGRESSION RULE: no lane changes any byte of card faces, diagrams, engine output, deck data or geometry. The oracles that enforce it (`card_face_v1`, `gen_face_v1`, `engine_corpus_v1`, `app_surface_v1`, the PDF text test, `test_render_agreement`) must be committed BEFORE the refactor commit they guard, and a digest change in any lane is a stop, never a regeneration.

- `[HIGH] (confidence: 9/10) tests/mutation_check.sh:293-309 — a kill proves nothing unless the failing `not ok` names the `# kills:` test; src/engine mutants are visible only to engine suites. Rules 8 and 9 in section 5 and the local kill check now say so.`
- `[MEDIUM] (confidence: 8/10) tests/mutants/b_*.patch — 11 multi-file patches target `data/decks.json`, which no lane owns. R5 lets the app lane re-anchor the index.html hunk only.`
- `[MEDIUM] (confidence: 8/10) tools/regen_card_fixture.js — built-in faces only; generated decks and rail DOM were unpinned. AP3-0 adds `gen_face_v1.json` in its own first commit.`
- `[LOW] (confidence: 7/10) tests/helpers/cdp.js:136 — one handler per method; EX-1 must cover a second Browser instance and a delayed throw.`

Test Plan Artifact: `~/.gstack/projects/raywu-handpan-cards/claude-main-eng-review-test-plan-2026-10-03.md`.

## Section 4 - Performance

- `[LOW] (confidence: 8/10) .github workflow "js suites (unit + e2e)" — 238 s baseline on run 37155566494; EB's cap is 262 s. EX adds one e2e test. No lane adds a Browser launch.`

## Outside Voice

`codex exec` reviewed the plan read-only (prompt and output in the session scratchpad; logged via `gstack-review-log` as `codex-plan-review`). Of 15 findings, 13 were folded (F1, F8, F17, US-1/2/3, ET REASONS, EX multi-instance, AP1-1/2/3 shapes, AP2-1/2 shapes, AP3-0, section 5 rules 7-9, cap counts files). Two were already covered (the 40-cap existed; the semantic-coupling gate existed).

## Decision ledger

### R1
- Finding: the plan changes more than 8 files (complexity gate).
- Plan baseline: 10 lanes, 11 base PRs, 40-patch-file cap.
- Runtime evidence: hunk survey in section 5 (64 / 63 / 28 / 118); `refresh_mutants.py --check` clean at e3fe4a5.
- Comparison grid: A) keep 10 lanes with the cap (reviewer reads every patch) vs B) merge into 4 larger PRs (fewer reviews, unreadable patch diffs).
- Question: D2 - keep the lane structure?
- Header: `D2 — Lane structure under the complexity gate`
- Options: A (recommended), B.
- State: auto-decided (AFK).
- Actual answer: A.
- Accepted scope: as drafted, with the pre-named splits.
- History: D1 (skip `/office-hours`, the plan has a goal section) preceded it.

### R2
- Finding: F8 misread `genBtn.disabled`.
- Plan baseline: AP2-3 "a refused generate re-enables the button".
- Runtime evidence: `index.html:7836/7845/7854` (state-driven), `8138/8142/8210` (set and re-enabled in runGenerate), refusal returns 8176-8189.
- Comparison grid: A) assert today's behaviour, finally restores readonly + label only vs B) move disabled into finally (behaviour change).
- Question: D3.
- Header: `D3 — What AP2-3 asserts about the generate button`
- Options: A (recommended), B.
- State: auto-decided.
- Actual answer: A.
- Accepted scope: AP2 step 4 as written.
- History: none.

### R3
- Finding: US-3 needs stub members the sandbox lacks (no phases, simple selectors, no `querySelectorAll`).
- Plan baseline: five US-3 tests unconditionally.
- Runtime evidence: `tools/sandbox.js:121, 259, 344`.
- Comparison grid: A) bounded best-effort, cut tests that need more, record in section 9 vs B) grow the stub until all five pass.
- Question: D4.
- Header: `D4 — US-3 scope when the stub falls short`
- Options: A (recommended), B.
- State: auto-decided.
- Actual answer: A.
- Accepted scope: US step 3 bound; V pattern `^# pass [1-5]$`.
- History: none.

### R4
- Finding: DOM-order Tab stops would change behaviour and have no coverage.
- Plan baseline: AP2 step 3 gated on EB-1 probes (A7).
- Runtime evidence: `index.html:8393, 8469`.
- Comparison grid: A) cut AP2-3 and EB-1 vs B) keep both gated on green probes.
- Question: D5.
- Header: `D5 — Derive Tab stops from DOM order?`
- Options: A (recommended), B.
- State: auto-decided.
- Actual answer: A.
- Accepted scope: A7 superseded; EB adds no e2e test.
- History: none.

### R5
- Finding: the 11 `b_*` multi-file patches target `data/decks.json`, which no lane owns.
- Plan baseline: A14 (re-cut by the lane owning all targets; none exists).
- Runtime evidence: `tests/mutants/b_layout_angle_swap.patch:6` and ten siblings.
- Comparison grid: A) app lane re-anchors the index.html hunk only, data hunk byte-identical, reviewer diffs the patch vs B) create a data lane that touches nothing but patches.
- Question: D6.
- Header: `D6 — Owner of the b_* data mutants`
- Options: A (recommended), B.
- State: auto-decided.
- Actual answer: A.
- Accepted scope: A14 amended; section 5 rule 7.
- History: none.

### R6
- Finding: a mutant kill can prove the wrong thing; refresh rewrites every patch; generated faces and rail unpinned (outside voice).
- Plan baseline: section 5 rules 1-7; AP3 steps 1-4.
- Runtime evidence: `tests/mutation_check.sh:293-309`, `tools/refresh_mutants.py:344`, `tools/regen_card_fixture.js`.
- Comparison grid: A) add rules 8-9, the `not ok` read, and AP3-0 vs B) rely on the gate's exit code.
- Question: D7.
- Header: `D7 — Fold the outside voice's gate findings`
- Options: A (recommended), B.
- State: auto-decided.
- Actual answer: A.
- Accepted scope: section 5 rules 8-9, AP3 step 0, EX-1 multi-instance.
- History: none.

## NOT in scope

Hotspot 7 (`generateDeck`, the `parseSeed` option contract), `parseLineText`, any `SWIPE_*`/`WHEEL_*` value, Tab-stop derivation, history/popstate semantics, the delete-arm flow, describe restructuring in e2e, any rename that `app_surface_v1.json` pins, deck data, geometry, CSS, markup, the print pipeline, and the ideas list in CLAUDE.md.

## What already exists

`card_face_v1` (built-in faces), `golden_decks_v3/v4`, sequence goldens, the PDF text staleness test, `test_render_agreement`, the `SWIPE_*` pins at `app.test.js:4375`, the e2e "card swipe" describe, 583 mutants, `refresh_mutants.py --check`, `boot_sim.js`, FLOORS.

## Diagrams

Merge order and oracle dependencies:

```
wave 1   FL ─┐   ET ──> engine_corpus_v1 ──┐
             │   US ──> app_surface_v1, layout boot ──┐
             │   EX ──> uncaught guard ──┐             │
wave 2       │   EG (needs ET) ──> slotOrder           │
             │   EB (needs EX)                         │
wave 3       │   AP1 (needs US)  ─ index.html 8629-8942
wave 4       │   AP2             ─ index.html 7922-8600
wave 5       │   AP3 (needs EG)  ─ index.html 6680-7560, gen_face_v1 first
wave 6   FL2 (needs all)
```

## Failure modes

| Failure | Detected by | Response |
|---|---|---|
| Refactor changes a face or generated-deck byte | `card_face_v1` / `gen_face_v1` `--check` | stop; rule-5 triage; no regeneration |
| Engine output drifts | `engine_corpus_v1 --check`, sequence goldens | stop |
| A mutant is killed for the wrong reason | reviewer reads the `not ok` line per new/re-cut patch | bounce |
| A lane edits a patch it does not own | reviewer diffs `+++ b/` targets | bounce |
| Pre-existing app exception surfaces (EX) | report-only CI log | queue row + scoped expectation |
| e2e job exceeds 262 s (EB) | CI job duration | split the conversion, never drop tests |
| Second reviewer FAIL on one lane | bounce counter | stop; reviewed sub-plan |

## Worktree parallelization strategy

As section 4: at most 4 concurrent `swarm-lane` agents, each in `.claude/worktrees/<lane>` via `git worktree add --detach`, branch `claude/cx-<lane>`, no `node_modules` symlink. File ownership is disjoint within a wave; `index.html` has one owner per wave. The semantic-coupling gate (section 6) re-merges main before any merge that follows another `index.html` or fixture merge.

## Implementation Tasks

| # | Lane | Task | Verify |
|---|---|---|---|
| T1 | FL | set four FLOORS rows to CI counts | `python3 tests/suite_health.py` |
| T2 | ET | corpus tool + ET-1 + ET-2 tests + 7 mutants | ET V lines |
| T3 | US | surface fixture + layout boot + US-3/4 + up to 8 mutants | US V lines |
| T4 | EX | exception registry, settle ceiling, sentinel, 3 mutants | EX V lines |
| T5 | EG | sequence/pc/warning/parseSeed/solve refactors + 4 mutants + re-anchor | EG V lines |
| T6 | EB | 16 sleeps to waitFor, bounds, helper dedupe, 1 mutant | EB V lines, job <= 262 s |
| T7 | AP1-a | canStartGesture + releaseDecision + mutants + re-anchor | AP1 V lines |
| T8 | AP1-b | wheelDecision + mutant + re-anchor | AP1 V lines |
| T9 | AP2 | sheet state, setInert, refusal finally, shuffle label + 4 mutants | AP2 V lines |
| T10 | AP3 | gen_face_v1 first, then faceHTML, pan hoist, slotOrder, railDiff | AP3 V lines |
| T11 | FL2 | FLOORS from CI after AP3 | `python3 tests/suite_health.py` |

## Unresolved decisions

None.

## Completion summary

The plan was reviewed against the code at e3fe4a5 with an outside voice. Six findings changed the plan (R1-R6); the rest were line-level corrections folded in place. Approval readiness: PASS.

## GSTACK REVIEW REPORT

- Review: plan-eng-review
- Trigger: owner request, "Review plan after prompt runs and if sound start execution"
- Why: zero-regression refactor plan for `index.html` hotspots and engine modules with 583 mutants in play
- Runs: 1 (this), outside voice codex x1
- Status: complete
- Findings: 1 HIGH, 6 MEDIUM, 5 LOW, all folded
- OUTSIDE COVERAGE: codex exec, 15 findings, 13 folded, 2 already covered
- VERDICT: PASS
- NO UNRESOLVED DECISIONS
