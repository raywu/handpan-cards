# Refactor pass 7: plan (eng-reviewed copy, 2026-10-22)

> Reviewed by /plan-eng-review against origin/main d8d2a2d. The original plan
> follows verbatim; "Eng review amendments" and the review report are appended.
> Every amendment names the plan line (of plan.md) it changes.

---

# Refactor pass 7: plan (for /swarm, pending /plan-eng-review)

Evidence: `SCRATCH/explore-refactor-7/evidence.md` (ids referenced below).
Base: `origin/dev` 7b43df7 for every lane (dev first; main PRs opened and
HELD until the owner says merge). Each lane branches from the previous lane's
head when the serialisation table says so, else from `origin/dev`.

## Goal

Remove the dead CSS and the one engine duplicate, make every FALSE-GREEN /
PROXY / TAUTOLOGY test in evidence section 3 assert the behaviour its title
promises, close the mutation blind spots found, convert page-timer sleeps in
e2e to bounded waits and fix the sheetbody-resize flake, and make
`index.html` identical on `dev` and `main` by deciding GA at runtime by host
— with no user-visible behaviour change and every regression proof below
holding.

## Non-goals

- No user-visible behaviour change (DOM, computed styles in any probed state,
  text, analytics events on prod).
- No deck data change (TT-py-09's stale overlay counts are an owner question,
  Q6, not a lane).
- No engine OUTPUT change; a lane that must touch `src/engine/*` names the
  fixture it keeps byte-identical (`tests/fixtures/engine_corpus_v1.json`,
  `pan_render_v1.json`) and never regenerates it.
- No test weakened. A test is deleted only when a stronger one replaces it in
  the SAME commit and both titles are named in the commit message. No test is
  RENAMED (renaming orphans mutant headers) — a title that drifts gets a new
  body, not a new title, except where Q8 says otherwise.
- No importer paths, no DEV-env paths (`validate.yml`, `tools/ci_scope.py`,
  `tests/test_ci_scope.py`), no `tests/e2e.test.js` edits outside L5.
- No long-function splits in the engine (FN-L5, FN-L6) and no sandbox `boot`
  split (FN-L7..9): recorded, not scheduled.
- No DR1 rule G sweep redesign (P5-7 stays deferred unless Q7 says go).

## Lanes

Every lane: TDD (red test first where a test changes), its own worktree,
PR to `dev` (and a HELD PR to `main`), CI `validate` green at the verified head
SHA, independent reviewer at that SHA. "Verify" is the command the reviewer
runs in addition to the standing gates.

### L1 — app block + CSS dead atoms
- Owns: `index.html` (app block and `<style>` only; never an engine region or
  the DECKS line).
- Items: CSS-D1, CSS-D2, CSS-D3. Optional, only on Q3 = yes: FN-L2 (split
  `runGenerate`) — the FLAG clusters are NOT in scope even then (every
  `uxl_*/spa_*/spc_*` mutant anchors on those lines).
- Acceptance: the three atoms are gone (CSS-D2's whole rule, CSS-D1/D3's
  comma atoms); `css_probe.js` over the 45 states reports the SAME live/never
  sets minus the three; no computed-style diff for any element in any state
  (probe extension: dump `getComputedStyle` of every `#scale-*` element per
  state before/after and diff — a small addition to `css_probe.js`, copied
  into the lane's scratch).
- Verify: `python3 tools/validate.py && node --test tests/app.test.js &&
  CHROME_BIN=… node --test --test-name-pattern 'press state|DR1 line 39|SG: N-A6' tests/e2e.test.js`.
- Fail-before evidence: evidence 1.3 reader enumeration (no writer for any of
  the three); `css_probe.json` never-list.
- Mutant obligations: none anchor on the removed lines (verified by
  `grep -l -F` over tests/mutants); `tests/mutation_check.sh` dry apply of
  `di_e_passive_low_contrast`, `dr1_disabled_not_dimmed`,
  `sqe_reroll_no_press_state` must still apply (they share a neighbourhood).

### L2 — engine duplicate
- Owns: `src/engine/share.js`, `src/engine/core.js`, the two engine regions in
  `index.html` via `python3 tools/inline_engine.py` (sync, not hand-edit),
  `tests/share.test.js`, `tests/core.test.js` (additions only).
- Items: DUP-1 (`fnv1a` in share.js → `HPE.core.fnv1a32`).
- Acceptance: one FNV loop in the engine; `engine_corpus_v1.json` and
  `pan_render_v1.json` byte-identical (`node tools/regen_engine_corpus.js
  --check`, `git diff --exit-code tests/fixtures/`); "SV: the five built-in
  decks' v5 links are pinned" and "every frozen legacy string keeps its deck
  id…" green unchanged.
- Verify: `node tools/regen_engine_corpus.js --check && python3
  tools/inline_engine.py --check && node --test tests/share.test.js
  tests/core.test.js tests/app.test.js`.
- Fail-before: evidence DUP-1 (two loops exist, P6-6).
- Mutant obligations: every `sv_*`/`sh_*` mutant whose removed line is in the
  deleted `fnv1a` must be re-anchored to the core loop in the same commit
  (`grep -l fnv1a tests/mutants/*.patch` lists them); kill count unchanged.

### L3 — python tools and sandbox stubs
- Owns: `tools/sync_decks.py` (no behaviour change), `tests/test_sync_decks.py`
  (or the file that tests it — UNRESOLVED name, lane confirms), `tools/sandbox.js`
  (only on Q4 = yes), `tests/harness.test.js` (additions).
- Items: MUT-L4 (a test that `sync_decks` re-parses what it wrote: feed it a
  DECKS line that the lambda substitution would corrupt — a `\0` or `°`
  escape — and assert the tool reports failure); FN-4/FN-5 only on Q4.
- Acceptance: the new test is red against a `sync_decks` with the re-parse
  removed (demonstrated in the PR by a throwaway patch, not committed), green
  on the tree.
- Verify: `python3 -m pytest tests/test_sync_decks.py tests/test_validate.py
  -q` (names per the lane's confirmation) and `node --test tests/harness.test.js`.
- Fail-before: evidence MUT-L4 (one mutant, none for the re-parse).
- Mutant obligations: adds `b_sync_no_reparse.patch` (suite: the new test).

### L4 — unit test truthfulness
- Owns: `tests/app.test.js`, `tests/preview.test.js`, `tests/core.test.js`,
  `tests/select.test.js`, `tests/test_font_subset.py`, `tests/test_gen_deck.py`,
  `tests/test_print.py`, `tests/test_render_agreement.py`, `tests/test_pdf_parity.py`.
  (Shares core.test.js with L2: L4 branches from L2's head.)
- Items: TT-app-01..13 (01-07, 13 fixed; 08-12 noted or fixed if trivial),
  TT-eng-01..04, TT-py-01..08 (01-05 fixed; 06-08 noted).
- Rule: titles unchanged. Each fix: a probe that proves the old body
  FALSE-GREEN (the evidence probe, re-run), the new body red under the same
  probe, green on the tree. TT-eng-01: decide by reading core.js:350 — if
  `parseLegacySeed` is a distinct reader the test is DELETED and replaced in
  the same commit by "parseLegacySeed and parseSeed are distinct readers:
  a legacy bar-list string parses only through parseLegacySeed" (both titles
  in the commit message), else the body becomes `equal(parseLegacySeed, parseSeed)`.
- Acceptance: all 29 findings dispositioned in the PR description (fixed /
  noted-with-reason); every fixed test red under its probe; pass set of the
  whole unit + python suite identical in title list.
- Verify: `node --test tests/*.test.js --test-skip-pattern e2e && python3 -m
  pytest tests -q` plus the probe script the lane keeps in its scratch.
- Fail-before: evidence 3.1 probe log per finding.
- Mutant obligations: `ao_open_not_a_stop`, `d_deck_copies_registry`,
  `d_hide_fifth_allowed`, `d_share_version_literal`, `sqe_link_no_noopener`,
  `c_gen_single_quoted_require` must still be killed, now by the titled
  assertion (lane runs `tests/mutation_check.sh` on those six and quotes the
  failing assertion in the PR).

### L5 — e2e truthfulness, bounded waits, flake
- Owns: `tests/e2e.test.js`, `tests/harness.test.js` (TT-e2e-02 only;
  branches from L3's head if L3 touches harness.test.js, else from dev).
- Items: TT-e2e-01, TT-e2e-02, E2E-S1..S8 (the 28 sleeps ≥ 600 ms), E2E-F1,
  DUP-5.
- Rule (memory "sleep-to-waitFor loses the timing bound"): each sleep becomes
  `waitElapsed(<page constant> + slack, label)` or a `transitionend` listener
  installed before the gesture; a differential probe (page constant doubled in
  index.html → the test must go RED) is run per converted test and listed in
  the PR. Sleeps < 600 ms are out of scope unless the same test is already
  being edited.
- Acceptance: TT-e2e-01 uses `CSS.forcePseudoState` and goes red under the
  `.chip:active{color:inherit}` probe; the resize test (E2E-F1) passes 20
  consecutive single-test local runs and the same-frame reproduction is
  recorded; suite wall at CI not worse than 458 s by more than 5 %.
- Verify: single tests locally (`--test-name-pattern`, one Chrome at a
  time); CI e2e at the head SHA is the oracle.
- Fail-before: evidence 5.2 table, 5.4 history, e2e probe 7b.
- Mutant obligations: `e_chip_no_press_state` and every `uxl_*` naming the
  resize test still killed; none added.

### L6 — mutants, README count, FLOORS
- Owns: `tests/mutants/*.patch` (new files and the two re-anchors),
  `README.md` (count line), `tests/suite_health.py` FLOORS rows. Branches from
  L4's head (its new bodies decide several kill titles).
- Items: MUT-B1..B6 (six new patches), MUT-K1 (re-anchor
  `qa_cycle_tab_stops_no_wrap` so the kill is the assertion, not the crash;
  the test gets a guard in L4's file — L6 opens a one-line PR to L4's branch
  or L4 includes it on request), MUT-K2 (rewrite
  `d_caller_scan_blind_to_escapes` to break the scan in the direction the
  title names), MUT-T1 (record only).
- Acceptance: every new patch has no `index` line, a `.`-wildcard suite
  header, applies with `git apply --check`, is killed, and dies for the
  titled reason (the failing assertion quoted); README count and FLOORS set
  from the four shard reports of the lane's own CI run.
- Verify: `tests/mutation_check.sh` over the new/changed patches locally;
  CI mutation gate at the head SHA.
- Fail-before: evidence 4.1/4.2.

### L7 — docs
- Owns: `CLAUDE.md`, `docs/plans/2026-10-22-refactor-pass-7.md` (this plan
  checked in), the CONTRACT doc for P5-12.
- Items: P5-12 first (CONTRACT rule 4 index line, "six PDFs" → three); the
  CLAUDE.md sentences each lane changed (L1: none; L2: none; L4: none, titles
  unchanged; L5: none; L8: 690-695, 730-737, 813-814); the
  pdfcards.test.js:723 floor note. Every claim cites a test name (memory
  "docs lane claims must cite a test").
- Runs last; branches from the last merged lane head.

### L8 — GA by host (evidence section 6, option b; candidate, owner-gated Q9/Q10)
- Owns: `index.html` app block (`analyticsAllowed` only), `tests/app.test.js`
  (the per-condition predicate loop only), `tests/mutants/dg_predicate_ignores_dev_host.patch`,
  memory/CLAUDE.md lines handed to L7. Branches from L1's head (both edit the
  app block) and from L4's head for app.test.js — i.e. L8 runs after both.
- Change: the DEV host (`handpan-cards-dev.pages.dev`, or the `.pages.dev`
  suffix on Q10) joins the denied-host condition; the id literal is untouched.
  On Q9 = yes, `_headers` is committed to `main` with one assertion in
  `tests/test_site_files.py` and the overlay branch is retired by the
  integrator (not by the lane).
- Acceptance: "the shipped measurement id is G-QTYWB2HSSV" green; new test
  "analyticsAllowed is false for handpan-cards-dev.pages.dev…" red before,
  green after; new mutant killed; `git diff origin/main origin/dev -- index.html`
  empty after the next sync; the 28 dev-only red app tests gone.
- Verify: `node --test tests/app.test.js` on BOTH a main-based and a dev-based
  checkout; e2e "a full boot sends zero requests to googletagmanager.com…".
- Risk to prod: LOW (evidence 6.3 b).

## Serialisation (textual conflicts in index.html and shared test files)

| order | lane | reason |
|---|---|---|
| 1 | L1 | app block + style |
| 1 | L2 | engine regions (disjoint from L1's hunks; parallel, but the second to merge re-runs `inline_engine.py` on the merge) |
| 1 | L3 | python/sandbox, disjoint |
| 2 | L4 | after L2 (core.test.js) |
| 2 | L5 | after L3 if harness.test.js touched, else parallel with L4 |
| 3 | L6 | after L4 (kill titles) and L5 (uxl mutants) |
| 3 | L8 | after L1 (app block) and L4 (app.test.js) |
| 4 | L7 | last |

## Standing merge gates (every lane)

`python3 tools/sync_decks.py --check`; `python3 tools/inline_engine.py --check`;
`python3 tools/validate.py`; `node --test tests/app.test.js`; the lane's
targeted e2e single tests locally; CI `validate` green at the verified head
SHA (`gh run list --commit <sha> --workflow validate.yml`, conclusion only);
independent reviewer at that SHA (read-and-report, `OPENCLAW_SESSION=1`);
dev first (`gh pr merge <D> --merge` when green and not CONFLICTING), main
PRs HELD for the owner; the overlay restore step on every main-to-dev sync
until L8/Q9 retires it.

## Regression proof (per lane, in the PR description)

1. Full-suite title list: the set of passing titles before and after is
   identical except the titles the PR names (added/deleted-with-replacement).
2. `tests/fixtures/engine_corpus_v1.json` byte-identical (`--check`) unless
   the lane names a regen (no lane here does).
3. `tests/fixtures/pan_render_v1.json` byte-identical.
4. The three CHORD_ONLY PDFs' extracted text identical (`python3 tools/decks.py`
   then the staleness test — bytes may differ by the creation stamp).
5. Mutant kill count ≥ README's 1348 at the lane's CI run (from the four
   shard reports), and L6 is the only lane that raises FLOORS.
6. For L1 and L8: the 45-state `css_probe`/computed-style diff empty.

## Risk table

| risk | lane | likelihood | mitigation |
|---|---|---|---|
| A removed CSS atom was reached by a state the probe never entered (print media, mid-animation, real keyboard) | L1 | low | reader enumeration shows no JS writer at all; the atom cannot match without one |
| `fnv1a` re-export changes a checksum through a signed/unsigned difference | L2 | low | pinned v5 links + deckId tests + corpus `--check` |
| A "fixed" test goes red on CI's font/scrollbar environment (memory: CI harness blocks web fonts) | L4/L5 | medium | behavioural bodies read DOM state, not glyph widths; L5 single-test runs locally then CI |
| sleep→waitElapsed conversion still flakes under a loaded runner | L5 | medium | differential probe per test; transitionend listeners before gestures; 20-run local soak for the flake test |
| A re-anchored mutant now survives | L6 | medium | each kill quoted; CI mutation gate; memory "mutation gate can flake" → rerun once at the same SHA |
| DEV host string drifts and DEV traffic leaks into the real GA property | L8 | low | suffix form (Q10) or a test that pins the exact string; it is a data-quality leak, not a prod outage |
| Two lanes editing `index.html` conflict inside an engine region | L1/L2 | low | resolve by taking either side and re-running `inline_engine.py` (CLAUDE.md rule) |
| Mutant count drops below 1348 while a lane rewrites a patch | L6 | low | add before remove; count from shard reports |

## Owner questions (recommended answer first)

1. CSS-D3: delete the `#scale-next:disabled` atoms (recommended: yes — `nextBtn` is only ever hidden, never disabled; if a future step needs it the one-line rule returns), or keep as an affordance?
2. CSS-D1/D2: delete (recommended: yes, no writer exists; zero computed-style change in 45 states).
3. L1 optional `runGenerate` split (FN-L2, P5-6): do it now (recommended: NO — no bug, every SAVE path is e2e-pinned, and it serialises L8 behind a larger diff) or keep deferred?
4. Trim the sandbox's unused stubs (FN-4/FN-5)? Recommended: NO — they are harmless completeness; removing them saves nothing.
5. DUP-4 e2e preamble helper extraction (P5-11): recommended NO this pass (pure churn in the 14-hotspot file).
6. TT-py-09: three print-overlay blurb counts in `data/decks.json` are stale (Hijaz "18 CHORDS" vs 19 cards, Pygmy "25" vs 53, Amara "16" vs 27). This is deck data: fix in a separate owner-instructed data lane (recommended: yes, later, with b_* mutant regen and `c_deck_data_drift` hand-edit per memory), or leave?
7. P5-7 DR1 rule G: 3 × 206 s of shard time. Recommended: leave deferred; a faster sweep is a test redesign, not hygiene.
8. Retitle the three exact e2e/app title twins with a browser clause? Recommended: NO (renaming orphans mutant headers); keep both as they are.
9. `_headers` on `main` (evidence 6.3 b′ ii): commit it so `dev` == `main` byte-for-byte and the overlay branch + restore step retire entirely? Recommended: YES — GitHub Pages ignores `_headers`, prod is unaffected, one new `test_site_files` assertion pins its content.
10. L8 host form: exact `handpan-cards-dev.pages.dev` or `endsWith(".pages.dev")` (covers Cloudflare preview deploys)? Recommended: the suffix — a preview URL is also non-prod and should not report.
11. Approve L8 at all (runtime host selection, option b) versus status quo (d)? Recommended: approve; (a) and (c) are rejected in evidence 6.3.
12. L4's TT-eng-01: delete-and-replace (if `parseLegacySeed` is a distinct reader) is a test deletion under the "stronger replacement in the same commit" rule — confirm that rule covers it. Recommended: yes.

---

## Eng review amendments

Each amendment is applied to the lane text above by reference; the plan line
is the line of `plan.md`. Verified against origin/main d8d2a2d on 2026-10-22.

### A1 — Base every lane on `origin/main` d8d2a2d, not `origin/dev` (plan lines 4-6, 40, 126, 171, 187-188, 211-213)
`dev` carries the GA placeholder and `_headers` (`git diff origin/main origin/dev`:
`_headers` +2, `index.html` 1 line). A main PR from a dev-based branch carries
that overlay and is red before lane code runs (memory "Lane branches stack on
main, not dev", SPG 402bcfe); every sibling plan (order-free, print-header,
free placement, i18n) bases on `origin/main` d8d2a2d. Replace lines 4-6 with:
"Base: `origin/main` d8d2a2d for every lane; a lane that the serialisation
table orders after another branches from that lane's verified head. Each lane
opens PR M to `main` (HELD) and the integrator opens PR D from the same head to
`dev` (DEV-env lane flow, CLAUDE.md 'Lane flow (D2)')." Lines 187-188: drop
"on BOTH a main-based and a dev-based checkout"; the proof is the main-based
unit run plus PR D's `validate` run on M.

### A2 — DUP-1 is not a drop-in: the two FNV functions differ in return type and export (plan lines 69-81, 233)
`src/engine/share.js:200` `fnv1a(text)` returns a uint32 NUMBER consumed by
`checksum` (:212, byte-splits it) and `checkHex` (:219, `>>> 8` then hex).
`src/engine/core.js:966` `fnv1a32(str)` has the same loop but returns an 8-char
zero-padded HEX STRING, used only by `deckId` (:983), and core's export list
(:1020 region) does NOT export it (it exports `utf8Bytes`, which share.js
already consumes at :130, so the share → core dependency exists). L2 must:
export a numeric `HPE.core.fnv1a32(text)` (uint32), make `deckId` format
`fnv1a32(...).toString(16).padStart(8, "0")`, and make share.js call the
export. Lines 79-81: the mutants whose removed line is in an FNV loop are
`l0_id_hashed_from_canonical_string` and `u_palette_hashed_into_deckid`
(both anchor on core.js; `grep -l fnv1a tests/mutants/*.patch` confirms, and no
`sv_*`/`sh_*` patch names it), so the obligation is "those two still apply and
kill", plus a dry `git apply --check` of every patch under `tests/mutants/`
whose diff names `src/engine/share.js`. Line 233 risk: add "the frozen deck ids
(core.test.js:946) pin the hex formatting."

### A3 — L3 as written is vacuous; fold MUT-L4 into L6 as one mutant and drop L3 unless Q4 = yes (plan lines 83-96, 197, 199)
`tools/sync_decks.py:53` substitutes through a lambda, so a `\0` or `°` escape
in the DECKS line cannot corrupt the write and the proposed test is green with
or without the re-parse (outside voice, verified). `tests/test_sync_decks.py`
and `tests/test_validate.py` do not exist; the sync_decks tests are
`tests/test_deck_data.py:664-719`, and
`test_sync_decks_write_mode_catches_a_byte_level_reinjection_mismatch` (:696)
already patches the write line and asserts write mode reports failure, which
it can only do through the re-parse block (`tools/sync_decks.py:58-61`).
Deleting that block makes the tool exit 0 and that test fail. So MUT-L4 closes
with one patch, `b_sync_no_reparse.patch` (removes the `again`/`raise
SystemExit` block; `# suite: python3 -m unittest -k
test_sync_decks_write_mode_catches_a_byte_level_reinjection_mismatch
tests.test_deck_data`, the header form of the existing
`d_sync_decks_reinject_semantic_compare.patch`), owned by L6 as item MUT-B7.
No tool change, no new test. L3 exists only if Q4 = yes (sandbox stubs +
`tests/harness.test.js`); otherwise it leaves the serialisation table and L5
branches from `origin/main`.

### A4 — CSS-D1 wording: `#scale-box-wrap.passive` HAS a writer; only the `#scale-line-note.stale` half is dead (plan lines 50-59, 232)
`index.html:12615` `scaleWrap.classList.toggle("passive", onFields)` writes
`passive`; rule 1153 `#scale-box-wrap.passive ~ #scale-parse{display:none}` is
LIVE and must stay. Rule 1152's second atom is dead because nothing ever adds
`stale` to `#scale-line-note` (the only `stale` writers are previewBox
11420/11430, fieldMsg 12601, fieldsGroup 12613, scaleBox 12616; `lineNote`
:10359 gets only `.textContent` at 12617). Line 58: replace "no writer for any
of the three" with "no writer for the class the atom needs on the element it
names: `#scale-line-note.stale` (D1); `#scale-drawer` never written (D2, no
`drawerBox.` write exists); `#scale-next` never `.disabled` (D3, only `.hidden`
writes at 10579/10705/10985)". Line 232 mitigation: same wording.

### A5 — Counts (plan lines 127, 186; evidence "nine withGaId users")
27 `sleep(` sites with a value >= 600 ms in `tests/e2e.test.js`, not 28 (six at
900, one at 800, one at 1200, the rest 600-700). `withGaId(` has 8 call sites
(defined at app.test.js:9280); line 186 should read "every test built through
`withGaId`, plus 'the shipped measurement id is G-QTYWB2HSSV', green on a
dev-based checkout" rather than a number.

### A6 — New section "Sequencing against the other workstreams" (insert after plan line 202)
- Order-free (`explore-order-free/plan.md`, base main): lane OE owns
  `src/engine/core.js`, the engine regions and the corpus fixture; OS owns the
  app block, `app.test.js`, `e2e.test.js`, `di_*/ui_*` mutants. Pass 7 L2
  (core.js/share.js) and L1/L4/L5/L8 therefore land BEFORE OE or AFTER OD, as
  that plan's risk row already says ("Refactor pass 7 lands between OE and OD
  and rewrites `scaleInfer`"). Recommended: pass 7 first (the i18n plan asks the
  same: "pass 7 → order-free → free placement → i18n A").
- Print-header (`explore-print-header/plan.md`): lane P owns `tools/hifi.py`,
  `pdfcards.js`, the engine regions, `tests/test_print.py`,
  `tests/test_pdf_build.py`, `tests/pdfcards.test.js`. L4 edits
  `test_print.py:437/862/914` and `test_render_agreement.py:331`, and L7 touches
  the `pdfcards.test.js:723` floor note. Pass 7 does NOT touch
  `card_header`/`cardHeader` (`tools/hifi.py:211`; `index.html:3139` in the
  pdfcards engine region): add that to Non-goals. If P lands first, L4 rebases
  its `test_print.py` hunks on P's head; if pass 7 lands first, P rebases.
- Free placement (`explore-free-placement/plan.md`): lane S owns `share.js` and
  `share.test.js` (vs L2); lane D owns the app block, `app.test.js`,
  `e2e.test.js`, app mutants, `sandbox.js` (vs L1/L4/L5/L8). Same rule: pass 7
  before S/D or after W.
- i18n: lane A keys every app-block literal; it wants pass 7 first.
Rule: pass 7 is the FIRST workstream after this review wave, or it waits for
the whole of whichever one starts before it; no interleaving.

### A7 — Name the CONTRACT file (plan line 166)
"the CONTRACT doc" is `tests/CONTRACT.md:165` ("six committed PDFs").
`tests/CONTRACT.md` is read by `tests/suite_health.py`,
`tests/test_deck_data.py`, `tests/test_suite_health.py` and eleven node test
files; L7 greps each reader for the sentence it rewrites before editing.

### A8 — L8's proofs must discriminate (plan lines 183-188)
`tests/e2e.test.js:13506` boots on 127.0.0.1 under `navigator.webdriver`, so
the new host condition can be deleted and that test stays green; drop it from
the Verify line. The sandbox reports `webdriver` true unless told otherwise, so
the new unit cases must pass `webdriver: false` as `app.test.js:9386` does.
Required cases, in or beside the predicate loop at `app.test.js:9405-9418`:
1. "analyticsAllowed is false for the DEV host" —
   `boot({ webdriver: false, href: "https://handpan-cards-dev.pages.dev/" })`
   → false, no gtag script, no config.
2. On Q10 = suffix: "analyticsAllowed is false for a Cloudflare preview host" —
   `href: "https://abc123.handpan-cards-dev.pages.dev/"` → false.
3. Control: the existing "the shipped index.html boots unmodified on a real
   host…" (`https://example.test`) stays true, so the predicate denies
   `.pages.dev`, not every non-local host.
Mutant `dg_predicate_ignores_dev_host.patch` removes the host condition and
must die at case 1 (and case 2 under the suffix form). With the suffix form,
`_headers` on `main` is harmless to GitHub Pages (a Cloudflare-only file), so
Q9's recommendation stands.

### A9 — L5 "bounded waits" need a deadline that fails, not a sleep by another name (plan lines 129-134, 235)
`waitElapsed` (`tests/e2e.test.js:253`) is a `setTimeout` wrapper: a converted
sleep stays a fixed delay, which is the intended BOUND for a timing assertion
(memory "Sleep-to-waitFor loses the timing bound") but is not a readiness
wait. Rule for L5: (i) a wait for a transition installs the `transitionend`
listener before the gesture AND races it against a `waitElapsed(constant +
slack)` that REJECTS, so a slow transition fails the test instead of hanging;
(ii) a timing assertion ("after the 180ms slide…") keeps `waitElapsed(constant
+ slack)` as its bound, and the differential probe (constant doubled in
`index.html` → red) applies to exactly these; (iii) a sleep that covers native
scrolling or layout, with no page constant, becomes `b.waitFor(<predicate>,
{label})` on the observable (scroll position, rect) under the harness's own
deadline — no differential probe is possible, and the PR lists those waits
separately with the predicate each polls.

### A10 — Check the evidence in before dispatch (new lane 0; plan line 164)
`SCRATCH/explore-refactor-7/` is a session scratchpad; the lanes cannot read it
and the TT/MUT/CSS ids are bare identifiers without it. Lane 0 (doc-only PR,
skips CI by `tools/ci_scope.py`): commit `docs/plans/2026-10-22-refactor-pass-7.md`
(this reviewed plan), `docs/plans/2026-10-22-refactor-pass-7-evidence.md`
(evidence.md) and the probe sources (`css_probe.js`, `css_probe.json`,
`mutants.json`, `kill_sample.log`) under
`docs/plans/2026-10-22-refactor-pass-7-probes/`. L7 then only updates them.
Lane briefs cite the checked-in paths.

### A11 — L6's counts come from the right artifacts, after L8 (plan lines 157-158, 200-201, 224-225)
`MUTANT_REPORT` (`tests/mutation_check.sh:42`) lists each shard's ASSIGNED
mutants before the sweep; it is not a kill count. FLOORS
(`tests/suite_health.py:33`) count tests that RAN per file (`by_module`,
:136-164). So: README's count = the sum of the four shard jobs' kill lines in
their logs; FLOORS rows = the suite's per-file run counts from the CI run's
result artifacts (memory "FLOORS rows lag the CI count"). Because L8 adds unit
tests and a mutant after L6's snapshot, L6 moves to order 4 after L8, and L7
stays last (order 5). MUT-B7 (A3) joins L6's list.

### A12 — Python verify commands use unittest, not pytest (plan lines 93, 115-116)
`tests/run.sh` and CI run `python3 -m unittest discover -s tests -t . -v`;
pytest is not a repo dependency. Replace every `python3 -m pytest …` with the
unittest form (`python3 -m unittest tests.test_deck_data -v` for one module).

### A13 — `--test-skip-pattern e2e` does not skip the e2e FILE (plan line 115)
`--test-skip-pattern` matches test NAMES; `tests/*.test.js` still loads
`e2e.test.js` and its titles do not contain "e2e". Use
`node --test $(ls tests/*.test.js | grep -v e2e.test.js)`.

### A14 — MUT-K1's guard belongs to L4 outright (plan lines 150-152)
L4 owns `tests/app.test.js`; the guard that turns the crash kill of
`qa_cycle_tab_stops_no_wrap` into an assertion kill is one L4 item
("TT-app-14: guard, then assert"), and L6 only re-anchors the patch. Drop the
"one-line PR to L4's branch" clause.

### Non-goals additions (plan lines 18-35)
- Pass 7 does not rename, split or move `card_header` (`tools/hifi.py:211`) or
  `cardHeader` (pdfcards region, `index.html:3139`); print-header lane P owns
  them.
- No edit to `tests/CONTRACT.md` beyond P5-12.

### Amended serialisation table (replaces plan lines 193-202)

| order | lane | reason |
|---|---|---|
| 0 | Lane 0 | docs-only: plan + evidence + probes checked in (A10) |
| 1 | L1 | app block + style |
| 1 | L2 | engine regions (disjoint from L1; second to merge re-runs `inline_engine.py`) |
| 1 | L3 | only on Q4 = yes; else absent |
| 2 | L4 | after L2 (core.test.js) |
| 2 | L5 | parallel with L4 (after L3 only if L3 exists and touches harness.test.js) |
| 3 | L8 | after L1 (app block) and L4 (app.test.js); gated on Q9-Q11 |
| 4 | L6 | after L4, L5 and L8 (kill titles, uxl mutants, L8's new test and mutant; A11) |
| 5 | L7 | last |

---

## /plan-eng-review report body

### Scope Challenge
Complexity gate tripped (the plan touches far more than 8 files across 8
lanes). Structure question auto-answered (spawned session, recommended
option): **Original arrangement** — the lanes are already cut on
file-ownership boundaries and a smaller arrangement would merge lanes that
must not share `index.html` hunks. Findings reduce the lane count by one (L3,
A3) without changing the structure. Scope result: accepted as-is with
amendments → mode FULL_REVIEW.

### Section 1 — Architecture
- F1 [HIGH] (confidence 9/10) plan.md:4 — dev-based lanes; A1.
- F2 [HIGH] (9/10) plan.md:69 — fnv1a/fnv1a32 are not interchangeable; A2.
- F6 [MEDIUM] (8/10) plan.md:191 — no sequencing against four sibling
  workstreams that own the same files; A6.
- C3 [MEDIUM] (8/10) plan.md:3 — evidence lives in a scratchpad the lanes
  cannot read; A10. (Outside voice.)

### Section 2 — Code Quality
- F4 [MEDIUM] (9/10) plan.md:58 — CSS-D1 reason misstated; the live sibling
  rule 1153 is at risk from a lane that reads "no writer"; A4.
- F3 [MEDIUM] (9/10) plan.md:84 — cites two test files that do not exist; A3.
- C2 [HIGH] (9/10) plan.md:87 — the proposed MUT-L4 test cannot go red; A3.
  (Outside voice.)
- F7 [LOW] (9/10) plan.md:166 — CONTRACT path; A7.
- A12/A13 [LOW] (9/10) plan.md:93/115 — verify commands would not run as
  written.
- F5 [LOW] (9/10) plan.md:127/186 — counts.

### Section 3 — Tests
Coverage after amendments (each row names the proof the lane must leave):

```
  lane  change                      proof the change is real              proof nothing else moved
  L1    3 dead CSS atoms            css_probe 45-state never-list         computed-style diff empty
  L2    one FNV loop                corpus --check, frozen ids, v5 links  share/core/app suites
  L4    29 test bodies              per-finding probe red -> green        title list identical
  L5    27 sleeps, 2 titles, flake  differential probe / polled predicate 20-run soak, CI wall <= +5%
  L6    7 mutants + 2 re-anchors    quoted failing assertion each         count >= 1348 from kill lines
  L8    host predicate              unit cases 1-3 (A8), dg_* mutant      shipped-id test, real-host control
  L7    docs                        every sentence cites a test           --
```
- C1 [MEDIUM] (8/10) plan.md:130 — `waitElapsed` is `setTimeout`; a
  transitionend wait without a rejecting deadline hangs; A9. (Outside voice.)
- C5 [MEDIUM] (9/10) plan.md:188 — the e2e proof for L8 cannot detect the
  regression; the unit case must set `webdriver:false`; A8. (Outside voice.)
- C4 [MEDIUM] (9/10) plan.md:158 — FLOORS/README sourced from the wrong
  artifact and before L8's additions; A11. (Outside voice.)
- A14 [LOW] — MUT-K1 guard ownership.
Test plan artifact: `~/.gstack/projects/raywu-handpan-cards/ray-main-eng-review-test-plan-<datetime>.md`.

### Section 4 — Performance
No runtime change. L5's CI wall bound (458 s + 5 %) is the only performance
criterion and stands; A9's rejecting deadlines cannot lengthen a green run.

### Outside Voice
CODEX_MODE: ready; `codex exec` completed (`OUTSIDE_STATUS: completed
provider=codex host=claude`); five findings, all verified against the tree and
accepted as C1-C5 above (full text: `codex-outside-voice.md` beside this
file). Its Recommendation was "revise before dispatch"; the revisions are A3,
A8, A9, A10, A11.

### NOT in scope
Owner questions Q1-Q12 (awaiting the owner); the importer, DEV-env CI paths,
engine long-function splits, DR1 rule G, deck data (TT-py-09), `card_header`/
`cardHeader`, any user-visible change.

### What already exists
`test_sync_decks_write_mode_catches_a_byte_level_reinjection_mismatch`
already proves the re-parse (A3) and `d_sync_decks_reinject_semantic_compare`
already anchors on it; `HPE.core.utf8Bytes` is already consumed by share.js
(A2); `boot({webdriver:false, href})` is the real-host fixture (A8); the
DEV-env lane flow already defines "PR M to main + PR D to dev from one head"
(A1).

### Failure modes (critical gaps flagged: 0 after amendments)
1. fnv return-type mismatch → every share checksum changes → caught by the
   pinned v5 links and frozen ids before merge (A2).
2. Suffix predicate too wide → a legitimate non-Cloudflare host denied: the
   control case (A8 case 3) catches a predicate that denies `example.test`.
3. A transitionend wait on a transition that never fires → rejecting deadline
   fails the test with its label (A9), never a hung shard.
4. Mutant count under 1348 during a rewrite → add-before-remove; count from
   kill lines (A11).

### Worktree parallelization
| group | lanes | shared files | rule |
|---|---|---|---|
| 1 | L1, L2, (L3) | index.html (disjoint regions) | second merge re-runs inline_engine.py |
| 2 | L4, L5 | core.test.js (L4 after L2), harness.test.js (L5 only) | parallel |
| 3 | L8 | app block, app.test.js | after L1 and L4 |
| 4 | L6 | tests/mutants, README, suite_health | after L4, L5, L8 |
| 5 | L7 | docs | last |

### Implementation tasks
- T1 P1 Lane 0: check in plan, evidence, probes (A10).
- T2 P1 L1: remove CSS-D1/D2/D3 per A4 wording; probe diff.
- T3 P1 L2: export numeric `fnv1a32`, keep `deckId` hex, share.js calls it (A2).
- T4 P1 L4: 29 test bodies; TT-app-14 guard (A14); unittest verify (A12/A13).
- T5 P1 L5: sleeps → bound/race/poll per A9; TT-e2e-01/02; E2E-F1 soak.
- T6 P1 L8: host predicate + cases 1-3 + mutant (A8); `_headers` + site-files assertion on Q9.
- T7 P2 L6: MUT-B1..B7, K1, K2 re-anchors; counts per A11.
- T8 P2 L7: docs; CONTRACT.md:165; CLAUDE.md 690-695/730-737/813-814.
JSONL: `~/.gstack/projects/raywu-handpan-cards/tasks-eng-review-<ts>.jsonl`.

### Decision ledger

### R1: base branch
Finding: lanes based on `origin/dev` (plan line 4). Plan baseline: dev-first
model. Runtime evidence: `git diff origin/main origin/dev` = overlay only;
memory SPG 402bcfe. Comparison grid: main-based PRs green on main and on dev
through PR D; dev-based PRs red on main. Question D1: which base? Header:
Base branch. Options: A) `origin/main` (recommended) B) keep `origin/dev`.
State: answered. Actual answer: A (spawned session auto-pick, recommended
option). Accepted scope: A1. History: 2026-10-22 opened and answered.

### R2: L3
Finding: the proposed test cannot go red (A3). Plan baseline: new test + tool
guard. Runtime evidence: `tools/sync_decks.py:53` lambda; test_deck_data.py:696.
Comparison grid: one mutant vs a lane. Question D2: Header: L3 disposition.
Options: A) fold MUT-L4 into L6 as `b_sync_no_reparse.patch` and drop L3
unless Q4 = yes (recommended) B) keep L3 and find a corrupting input. State:
answered. Actual answer: A (auto-pick, recommended). Accepted scope: A3.
History: 2026-10-22.

### R3: L6 order
Finding: L8 adds tests after L6's snapshot (A11). Plan baseline: L6 and L8 at
order 3. Runtime evidence: `suite_health.py:33` FLOORS semantics. Question D3:
Header: L6 order. Options: A) L6 after L8 (recommended) B) L8 raises its own
FLOORS row. State: answered. Actual answer: A (auto-pick, recommended).
Accepted scope: A11. History: 2026-10-22.

### R4: structure
Finding: complexity gate (8+ files). Question D4: Header: Lane structure.
Options: A) Original arrangement (recommended) B) Smaller arrangement. State:
answered. Actual answer: A (auto-pick, recommended). Accepted scope: Scope
Challenge record above. History: 2026-10-22.

### Unresolved decisions
None from the review. Owner-gated items (not review decisions, listed for the
caller): Q1-Q12 in the plan; Q9/Q10/Q11 gate L8, Q4 gates L3's existence,
Q12 gates TT-eng-01's delete-and-replace, Q3 gates FN-L2.

### Completion summary
Findings: 14 (2 HIGH from the native review, 1 HIGH from the outside voice,
7 MEDIUM, 4 LOW); all mapped to amendments A1-A14; 0 critical gaps open;
0 unresolved review decisions. Score before 6/10 (two verify paths that could
not run, one vacuous lane, one refactor that would change every checksum, a
dev base) → after 9/10 (the remaining point is the owner gate on L8 and the
evidence check-in). Lake Score: 8/10 — the amendments narrow the plan rather
than widen it.

Approval readiness: PASS

## GSTACK REVIEW REPORT

| Field | Value |
|---|---|
| Skill | plan-eng-review |
| Target | explore-refactor-7/plan.md (verified against origin/main d8d2a2d) |
| Mode | FULL_REVIEW (scope accepted as-is with amendments) |
| Findings | 14 (3 HIGH, 7 MEDIUM, 4 LOW) → amendments A1-A14 |
| Critical gaps | 0 |
| OUTSIDE COVERAGE | codex, completed (5 findings, all accepted as C1-C5) |
| Decisions | D1-D4 auto-answered (recommended option, spawned session) |
| Owner gates | Q1-Q12 (not review decisions); L8 blocked on Q9-Q11 |
| VERDICT | APPROVED WITH AMENDMENTS — ready for /swarm once the owner answers Q1-Q12 and lane 0 checks the evidence in |

NO UNRESOLVED DECISIONS
