# Cleanup after G-1 (2026-10-15)

Base: main 9805fb3. Two serial lanes, no visual change anywhere.

## Goal

Close the open G-1 doc nits and the TODOS rows that need no owner input, so
TODOS.md lists only work that is actually open.

## Non-goals

- No visual change. No CSS other than the two `select:focus` deletions below.
- No engine region, no `const DECKS` line, no deck data, no geometry.
- Not the iOS keyboard hardware check, DESIGN.md, the sheet CSS variables row,
  or the `layout.test.js` labelShape guard (owner-only or larger; their TODOS
  rows stay untouched).
- No new test where an assertion inside an existing test does the job.

## Decisions recorded (AFK, recommended option)

- C1. The TODOS "dead `select:focus` term" row names one rule; there are two
  (`.sheetbody:has(...)` at index.html:1012 and :1016). Both lose the term. The
  live `.prints select:hover, .prints select:focus-visible` rule (index.html:561)
  is NOT touched.
- C2. N2 (rewrap the 134-column CLAUDE.md line) is dropped: CLAUDE.md carries
  lines up to 2669 columns, so a rewrap of one line is churn, not a fix.
- C3. The "Sheet guidance follow-ups" row also says the `.pan` adds at
  `openEditSheet` and the `syncParseState` name-refusal branch
  (`second && second.ok`) are unpinned. Lane S adds one mutant per site, plus a
  third pinning the warning's return, so the row can retire whole.
- C4. Decided rows (G-2 share-link parent, G-3 bottom octave 3.2 pt, G-4
  SMALL_LABELS) keep a one-line "Decided 2026-10-15: keep as is" note instead of
  being deleted, so the history stays.

## Lane S: sheet code and tests (wave 1)

Branch `claude/cl-sheet`. Owns `index.html` (outside engine regions and the
DECKS line), `tests/e2e.test.js`, `tests/app.test.js`, `tests/mutants/`. Never touches CLAUDE.md,
README.md, TODOS.md, `tests/suite_health.py`.

1. Pan warning return assertion (test first). In the N-A7 crowded test
   (`SG: N-A7 the crowded 24-note pan...`, tests/e2e.test.js), after the
   keyboard loop and `b.clearKeyboard()`, before Escape:
   `await b.eval(\`document.getElementById("scale-anchor-one").click(); return true;\`)`
   (the same form as the existing between tap; it must follow that tap, or
   `pickAnchor` returns early on an unchanged anchor), `await b.settle()`, then
   assert `layoutNote.textContent === ""`,
   `sheet.classList.contains("noticed") === false`, and
   `getComputedStyle(msgLine).display !== "none"` with `msgLine.textContent`
   still matching `/^Crowded pan/`. No new test, so the e2e FLOORS row stays 298.
   - Accept: the test passes on the branch; with
     `sheet.classList.toggle("noticed", !!note);` changed to
     `if (note) sheet.classList.add("noticed");` in `paintLayout()` the test
     fails AT THE NEW ASSERTION (its message, shown in the PR body). Commit that
     mutation as a third mutant, `cl_notice_never_clears`
     (`# suite: node --test --test-name-pattern ^SG:.N-A7.the.crowded tests/e2e.test.js`).
   - Verify: `node --test --test-name-pattern '^SG:.N-A7.the.crowded' tests/e2e.test.js`
     (needs CHROME_BIN; if absent locally, CI is the oracle).
2. Markup comment above `#scale-guidance` (index.html, the
   `<!-- The page's messages, pinned with the primary...` comment): replace
   "(#scale-msg, a warning first)" so it says a pan warning yields to the layout
   notice while the notice holds text. Comment only.
   - Accept: `grep -c 'a warning first' index.html` prints 0.
3. Remove `select:focus, ` from both `.sheetbody:has(input:focus,
   textarea:focus, select:focus, #scale-swatches button:focus)` rules (the
   `#scale-plate-band{position:static}` rule and the `scroll-padding-top:0`
   rule). Nothing else in either rule changes.
   - Accept: `grep -c 'select:focus,' index.html` prints 0 and
     `grep -c '.prints select:focus-visible' index.html` prints 1.
4. Two new mutants, each with `# kills:` / `# suite:` headers (suite patterns
   use `.` for spaces; no `index` lines in the patch):
   - `cl_edit_warning_not_marked_pan`: drop `msgLine.classList.add("pan");`
     from the `if (warned.length)` line in `openEditSheet`. N-A7 does not kill
     it today: the anchor tap runs `pickAnchor` -> `resyncSheet` ->
     `syncParseState`, whose crowded line re-adds `.pan`. Kill it in the N-A7
     test with `assert.match(opened.cls, /\bpan\b/, "openEditSheet did not mark its warning .pan")`
     right after the existing `opened` asserts (the test already reads
     `opened.cls`).
   - `cl_name_refusal_warning_not_marked_pan`: drop it from the `crowded` line
     in the `second && second.ok` (name-refusal) branch of `syncParseState`.
     No test reaches that branch with a crowded seed. Add one assertion to the
     existing app.test.js test "LF F-1 (a)": type the N-A7 `CROWDED` seed under
     the refused name, then assert `#scale-msg` has `.pan`. If the sandbox
     cannot do this inside that test, add one new app.test.js test and say so
     in the PR body; Lane D then moves the FLOORS row of the file that gained
     the test.
   For each, apply it and run its suite to prove a kill before committing.
   - Accept: all three `cl_*` mutants killed, by name, in the PR body.
5. Re-anchor every mutant the edits staled. `tools/refresh_mutants.py` cannot
   fix three of them (it anchors on the removed-line run and refuses on zero or
   several matches); hand-rewrite each against the new source, keep its header
   and mutation intent, strip `index` lines:
   - `dr1g_padding_kept_with_field_focus`: its removed line becomes the
     `select:focus`-free rule.
   - `e_sheet_primary_back_in_the_scroll`, `e_sheet_ctlrow_pinned_again`: the
     moved `   </div>` occurs twice in index.html, so take context from the
     rewritten comment.
   Then `python3 tools/refresh_mutants.py` for the rest (`dr2a_cap_back_to_42dvh`).
   - Verify: `python3 tools/refresh_mutants.py --check` exits 0,
     `git apply --check` passes on all four, then on a COMMITTED tree with
     `CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
     (e2e, drawer_grid and drawer_seats suites need it), one mutant at a time,
     for the four above, the three `cl_*`, plus any `--check` names:
     ```
     for m in <names>; do
       p=tests/mutants/$m.patch; git apply "$p" || exit 1
       PYTHONDONTWRITEBYTECODE=1 sh -c "$(grep -m1 '^# suite:' "$p" | sed 's/^# suite:[[:space:]]*//')" >/dev/null 2>&1; rc=$?
       git apply -R "$p"; [ $rc -ne 0 ] || { echo "SURVIVED $m"; exit 1; }
     done; git diff --quiet
     ```
     Where CHROME_BIN is unavailable, CI's mutation gate decides.
6. Smoke: `env -u CHROME_BIN ./tests/run.sh` (no package.json; browser suites
   skip without CHROME_BIN) and `python3 tests/suite_health.py` green. CI at the
   pushed head is the evidence.

Mutant count after S: 945 + 3 = 948 (Lane D confirms from CI artifacts).

## Lane D: docs and TODOS (wave 2, after S merges)

Branch `claude/cl-docs`, cut from main after S's merge. Owns CLAUDE.md,
README.md, TODOS.md, `tests/suite_health.py` (FLOORS only). Every changed
sentence cites a test or a grep that proves it.

1. N1, CLAUDE.md: the clause "`test_each_label_rule_number_is_written_once_per_language`
   fails on any second copy" (CLAUDE.md, the label-rule paragraph) becomes
   "fails on a second copy written with the same spelling, outside
   comment-leading lines and lines naming `F_NUM_RATIO`, in the files it scans
   (`src/engine/*.js`, `index.html` outside engine regions, `tools/*.py`); a
   `.66` or `0.640` would pass". Cite the test and its regex in
   tests/test_render_agreement.py.
2. N4, README.md "App vs print agreement" bullet becomes: "**App vs print
   agreement** - the app (which takes `labelSize` and `numSize` from
   `src/engine/pdfcards.js`) is compared against `tools/hifi.py`; the two share
   no code and use opposite y-axis signs, so all 177 cards are compared on
   position, highlight state, note order and badge (`test_highlighting_agrees`;
   the shared label constants are pinned equal by
   `test_the_diagram_label_rule_carries_the_same_constants`)."
3. TODOS.md:
   - Append "Decided 2026-10-15: keep as is." to "Share links re-store an
     explicit parent index", and "Decided 2026-10-15: leave." to "Bottom-shell
     octave digit prints at 3.2 pt on dense generated pans" and "SMALL_LABELS
     has no next action" (C4).
   - Delete "Sheet guidance follow-ups" and "Drop the dead select:focus term
     of the band rule" (both done by S).
   - Accept: `grep -c 'Sheet guidance follow-ups\|dead select:focus' TODOS.md`
     prints 0; `grep -c 'Decided 2026-10-15' TODOS.md` prints 3.
4. CLAUDE.md "Known pitfalls", sheet guidance bullet: the PAN warning return
   now has a test. Replace "(the return has no test, see TODOS.md \"Sheet
   guidance follow-ups\"; true by ...)" with the N-A7 test name.
   - Accept: `grep -c 'Sheet guidance follow-ups' CLAUDE.md` prints 0.
5. Counts from main's CI artifacts at S's merge SHA: README "945 mutant
   patches" becomes the CI total (expected 948); FLOORS rows move only if S
   added a test (e2e 298, app 502 today).
   - Verify: `python3 tests/suite_health.py` locally (smoke); CI at head.

## Merge gates (both lanes)

- `gh pr view <n> --json state,headRefOid`: head equals the local tip.
- `gh run list --commit <40-char sha>`: every run concluded success.
- A fresh `swarm-reviewer` at that SHA (`OPENCLAW_SESSION=1`, no node_modules,
  brief quotes this plan verbatim) returns PASS or PASS_WITH_NITS.
- `gh pr merge <n> --merge`, no `--delete-branch`; fast-forward local main.
- A third FAIL on one lane triggers the regroup in global CLAUDE.md.

Cost: 2 lanes, ~4 subagent runs, ~2 CI runs, +1 reviewer and CI run per bounce.
