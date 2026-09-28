# Prompt: triage the Phase F follow-up list into a /swarm plan

You are planning, not fixing. Repo: `/Users/ray/Projects/handpan-cards`, base
`origin/main` @ `6f341ab` (Phase F of `docs/plans/2026-09-24-quality-eval.md`
closed there, PRs 141-148). Read `CLAUDE.md` and §1, §4, §6 of that plan first;
its non-goals N1-N10 and merge gates carry over unchanged.

## Context that changes the weighting

The app (`index.html` on GitHub Pages) is **live but lightly used, and volume
is not expected to grow**, near or long term. There is no server, no accounts,
no stored user data beyond one browser's localStorage. Weigh accordingly:

- A defect a real user can hit in normal use still matters at any volume -
  one musician with a broken card or share link is the whole audience.
- Risks that only matter at scale or under an adversary (abuse, crafted
  inputs with no victim, perf under load, flake rates that bite only on
  frequent CI runs) get LOW weight.
- Test-quality items earn a fix only if they close a path by which a
  user-visible or wrong-artifact regression could ship with CI green (S1/S2
  in the plan's §1 scale). A test that is merely imprecise, with no named
  regression it would miss, is DROP, not DEFER.
- Maintenance cost is real: every new test and mutant is something the owner
  maintains for a small app. Prefer fewer, sharper fixes. "Nothing here is
  worth doing" is an acceptable answer for any group.

## The follow-up list (reviewer nits from Phase F, unverified)

Each is a reviewer's claim, not a fact. **Verify every item against the code
at `6f341ab` before judging it** - cite `file:line`, and mark it STALE if it
no longer holds or was already addressed.

1. `src/engine/share.js` `utf8String` accepts overlong UTF-8 (`C1 82` decodes
   as "B"). Engine change; product code.
2. F6 Q16 font-size check (`tests/app.test.js`) reads px only - rem/em/clamp()
   escape it, and `index.html` already uses clamp(); reads only the first
   font-size per rule; misses qualified selectors like `.sheetbody #scale-box`.
   Q26 ignores the `font:` shorthand.
3. F2 (`tests/e2e.test.js`): Q27 race test (~479-492) should use an asymmetric
   order (-50 then -120, expect `2/n`) and its comment overclaims; print
   re-enable test (~840-854) never proves the build ran; Q1 share test rebuilds
   the link origin itself; `e_kb_cap_outlives_the_sheet` kill was intermittent;
   a `sheetOpen` gate mutant survives; Q8's caution list missed ~:4892.
4. F6 smaller: arrow-key test starts on slot 0 (ArrowUp->Home passes); Shift+Tab
   from a middle stop untested; Q23 test calls `generateDeck` directly, not
   GENERATE; stale openShare comment ~`index.html:5625`; a zero-chord scale
   saved by an old build is dropped at boot but never removed from storage;
   Q29 misses en/em dashes.
5. F5 (`tests/mutation_check.sh`): removing the new `set -f` survives (no
   regression test); comment at :80 says "line 27", nullglob is line 30;
   `e_sheet_ctlrow` header's apostrophe should be `.`; narrowing `h_run_node`
   left `test_check_node_names_the_missing_binary_as_a_problem` with no mutant;
   `h_e2e_mutant_skipped_by_filename.patch` is not byte-length-neutral.
6. F1b (`tests/share.test.js` etc.): lead byte at the true payload end
   untested (`[0x0a, 0xe2]`); prefix literal duplicated at :445 and :477; Q18
   lacks a `checksum("")` pin and a golden decode; Q21 row text says "iv",
   engine gives "IV"; :467 comment muddled; Q22 uses a synthetic suffix; one
   collapse mutant probably equivalent.
7. F1a: legendDemo test can't tell field 1 from field 2 (add `(C3) G3 G4 G5`
   expecting `[3,0]`); badge check reads a total count and checks only the
   first glyph's colour.
8. F3 (`tests/helpers/sandbox.js`): nothing pins stack line numbers; comment
   ~:149 doesn't say lines 1-993 read as covered; boot got slower (fix:
   `.replace(/[^\n]/g," ")`).
9. F4: asserts at `tests/test_deck_data.py:252` and `:303` outside `subTest`;
   `tests/test_font_subset.py:76-79` checks only returncode, not "DESYNC".
10. F7 (`tests/test_render_agreement.py`): no count guards in
    `test_band_and_hairline_agree` or the numberFills check; the
    `render_app_badge_fill` regex is fragile.

Also check the open rows of `docs/plans/2026-09-24-one-pdf-path-coordination.md`
and `docs/plans/scale-engine-coordination.md` (`grep -n '| OPEN |'`) for
duplicates; reference them by number, do not re-list.

## Method

For each item: verify, then assign
- **Severity** S1-S4 (plan §1 scale) and **cost** C1-C3;
- **Verdict**: FIX (in this workstream), DEFER (real, not now - name the
  trigger that would make it worth doing), DROP (not worth it at this app's
  scale - one line why), STALE, or OWNER (needs a product decision - state it
  as a question with a recommended default);
- For a FIX, the concrete regression or user-visible failure it prevents. No
  named failure, no FIX.

Budget: evaluation is read-only. You may run single tests
(`node --test --test-name-pattern=...`, `python3 -m unittest <one test>`) and
apply one mutant at a time to check a claim, reverting with `git apply -R`.
Never run the full `tests/mutation_check.sh` or full `tests/e2e.test.js`
locally (N9). Never edit a tracked file except the plan you write.

## Output

Write `docs/plans/2026-09-27-followup-triage.md`, /swarm-shaped, in the same
voice and structure as `docs/plans/2026-09-24-quality-eval.md`:

1. Header: goal (one testable sentence), date, base SHA, shape, related docs.
2. §1 Goal and non-goals (carry N1-N10; add any new ones).
3. §2 Triage table: `| # | Item | Verified at | Sev | Cost | Verdict | Why / failure prevented |`,
   every item above, sorted FIX first, then OWNER, DEFER, DROP, STALE.
4. §3 Lanes for the FIX rows only, split by file ownership:
   `| Lane | Owns | Never touches | Rows | Acceptance | Verify |`. Each lane's
   acceptance is testable and its verify is an exact command. Mutant prefix
   per lane; FLOORS rows owned per test file. Name any mutant patch a lane's
   edit may stale (see `tests/mutation_check.sh`-patching `h_*` mutants and
   app-script-anchored patches) and grant the context-only refresh explicitly.
   Prefer the fewest lanes that keep ownership disjoint; one lane is fine.
5. §4 Order and dependencies, including whether the product fix (item 1, if
   FIX) needs owner sign-off before its lane spawns.
6. §5 Merge gates: reference quality-eval §6; state deltas only.
7. §6 Owner decisions: each OWNER row, with the recommended default.
8. A closing line with the counts: FIX / OWNER / DEFER / DROP / STALE.

Do not commit. Return: the plan path, the verdict counts, and any item where
verification contradicted the reviewer's claim.
