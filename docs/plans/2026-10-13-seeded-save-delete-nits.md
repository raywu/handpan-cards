# Seeded SAVE / DELETE nits lane (Q3, Q4, Q5, Q7)

Date: 2026-10-13. Base: main `ed74b51`. Parent workstream:
`docs/plans/2026-10-13-seeded-save-delete.md` (plan, PR #296) and its
coordination doc on `claude/seeded-save-delete-coord`, open rows Q3, Q4, Q5, Q7.
Owner decision 2026-10-13 (check-in): "One nits lane now" covering all four rows.

## Goal

Every nit the three reviewers left on #297, #298 and #299 is either closed by a
test-backed change in this one lane or recorded below as deferred with a reason.
After the lane merges, the four Q rows read RESOLVED.

## Non-goals

- No change to RESET semantics (D10 below), to `fallbackDeck()`, or to the
  hidden + `replaces` two-tab state beyond the boot message (D11).
- No deck data, geometry, engine region (`src/engine/*.js`, `<!-- engine:* -->`)
  or `const DECKS` change.
- No settings-panel markup or CSS change: the `panel-fit` CI oracle allows only
  `res-*` growth. The phone `.announce` item is deferred (D13).
- No new UI copy beyond the strings already shipped; no renames of tests the
  mutant headers name.

## AFK auto-decisions (recorded here, listed to the owner on return)

- **D10 (Q4 finding 1, owner call taken conservatively):** keep the shipped
  RESET: it clears EVERY stored record whose `replaces` names a seed, including
  an older same-seed record that renders in the custom tier. The warning copy
  already says "Your edits to them will be gone", and every such record IS an
  edit of a seed. Deleting the newer record promotes the older into the seed's
  slot (a consequence of `replacements()` taking the newest); that is kept and
  pinned by test, not changed. README and CLAUDE.md say this in one sentence
  each (item 15). Reversible: a later lane can filter RESET to the newest per
  seed without touching storage.
- **D11 (Q4 finding 2):** the boot message is wrong, not the landing. Fix the
  guard at the `wantedDeck !== deckId` line so "That deck is gone." is NOT said
  when the deck shown is `replacements()[wantedDeck]`. No state reconciliation.
- **D12:** this plan file ships inside the lane PR, not a plan PR of its own:
  the lane is small and every item is test-backed; one CI + review cycle saved.
- **D13:** the phone `.announce` item (RESET warning and "Seeded decks
  restored." land under the opaque settings panel below 1024px) is DEFERRED:
  any fix adds a message row to the panel, which the `panel-fit` oracle refuses,
  so it needs an owner call on where the message goes. Recorded as a new queue
  row, not silently dropped.
- Q5 N2 (stale "follow-up" line in the #298 body) was fixed by the integrator
  with `gh pr edit` on 2026-10-13; not lane work.

- **D14 (eng review F1 + F2, #299 nit N4):** a hidden seed with a replacement
  resolves to that replacement in `deck()` itself, for every seed. The
  alternative, keeping the landing on `fallbackDeck()` and only silencing the
  message for Kurd, leaves a non-default seed (hijaz) landing on Kurd with
  "That deck is gone" while its replacement sits one chip away, and leaves N4's
  order coincidence in place. One clause, one test, one mutant; the CLAUDE.md
  sentence that documents the Kurd-only behaviour is corrected (item 17).
- **D15 (eng review F3):** every "verify with the mutant selected" step runs
  the patch's own `# suite:` line by hand after `git apply`, since
  `tests/mutation_check.sh` selects only by `MUTANT_SHARD`.

## Lane: `claude/seeded-save-delete-nits`

Worktree `.claude/worktrees/seeded-save-delete-nits`, base `ed74b51`.

**Owns:** `index.html` (app JS, CSS and comments OUTSIDE the engine regions and
the `const DECKS` line), `tests/app.test.js`, `tests/e2e.test.js`,
`tests/mutants/*`, `tests/suite_health.py` (FLOORS rows only), `README.md`,
`CLAUDE.md`, `docs/plans/2026-10-13-seeded-save-delete-nits.md`.
**Never touches:** `data/`, `src/`, `tools/`, any other test file, the
settings-panel markup (`#settings-panel` and its CSS).

TDD throughout: each code item lands as a failing test (or a surviving mutant)
first, then the change.

### Code items (index.html)

1. **Unused const at RESET.** Delete `const seeded = Object.keys(replacements());`
   inside `restoreBtn.onclick` (the line before the `for ... delete CUSTOM[id]`
   loop). It shadows the `seeded()` helper and is read nowhere.
   Verify: `grep -c "const seeded = Object.keys" index.html` prints 0;
   `node --test --test-name-pattern "RESET" tests/app.test.js` green.
2. **Boot with a replaced AND hidden seed (D11, D14).** `deck()` gains one
   clause: `CUSTOM[deckId] || allDecks().find(d => d.id === deckId) ||
   replacements()[deckId] || fallbackDeck()`, so a stored id of a hidden seed
   that has a replacement lands on that replacement for EVERY seed, not just
   Kurd through `fallbackDeck()` and never by chip-order coincidence (#299
   review nit N4). `deck()` is consulted with a stale id only at boot; every
   other caller sets `deckId` through `selectDeck`. The boot guard grows
   `&& !(replacements()[wantedDeck] && replacements()[wantedDeck].id === deckId)`.
   New app test "SD: a seed both hidden and replaced boots onto its
   replacement without a warning", three cases in one test: (a) store
   `{deck:"kurd", hidden:["kurd"]}` in `hpfc` and the record with
   `o.replaces:"kurd"` under `SCALES_KEY` (`hpfc.scales.v3`, never a
   `scales` field of the blob; Codex finding 1), boot, assert the shown deck is the replacement and `.announce` text is "";
   (b) the same with `deck:"hijaz"`, `hidden:["hijaz","kurd"]` and the record
   replacing hijaz, with a second unrelated custom record saved AFTER it so
   the replacement is NOT first in chip order; assert the shown deck is
   hijaz's replacement and no warning; (c) `hidden:["kurd"]` with NO
   replacement record still says "That deck is gone. Showing ...".
   Mutant `d_boot_warns_on_replacement.patch` reverts the guard to the shipped
   line (killed by (a)); mutant `d_boot_replacement_by_order.patch` deletes
   the `replacements()[deckId] ||` clause (killed by (b)); `# kills:` names
   the new test on both.
   Verify: the test's own `--test-name-pattern`; each mutant by hand (D15):
   `git apply tests/mutants/<p>.patch && <the patch's "# suite:" line>; git
   apply -R tests/mutants/<p>.patch`, expecting the suite to fail while
   applied. `tests/mutation_check.sh` has no single-patch selector (it runs
   `tests/mutants/*.patch`, sharded only by `MUTANT_SHARD`); CI's shards are
   the oracle.
3. **Pygmy's seeded sheet says "Layout changed from the default."** Pygmy's
   stored anchor is `between`, which the `custom` check in the layout notice
   (the `text = editingId && custom ? "Layout changed from the default." : ""`
   line) reads as non-default. A built-in's own stored layout IS its default,
   so: `text = editingId && !isBuiltIn(editingId) && custom ? ... : ""`.
   Test first: "SD: a seeded deck's sheet never reports a layout change on
   open" opens the Edit sheet of each of the five built-ins and asserts the
   notice is ""; and the existing DR1 tests (`dr1Notice`, "Layout changed from
   the default.") stay green for custom decks. Mutant
   `d_seeded_sheet_layout_changed.patch` drops the `!isBuiltIn(editingId)`
   term.
4. **Two stale comments.** (a) The CSS comment at `index.html:196` begins "The
   pencil on a SELECTED CUSTOM chip": since #297 every selected chip, seeded
   included, carries it; rewrite the first two sentences to say so and keep the
   rest. (b) The comment at `index.html:7752` says ids live in "hpfc.hidden";
   they live in the `hidden` field of the single `hpfc` blob. Rewrite.
   Verify: `grep -n '"hpfc.hidden"' index.html` prints nothing;
   `python3 tools/validate.py` green (comment-only, engine regions untouched).

### Test and mutant items

5. **RESET's stored-records half (Q3 A6 nit, Q5 N1).** Extend the app test
   "editable defaults: RESET arms, then clears hidden and replacements and
   keeps custom decks": after the confirming tap assert (a) `.announce` text is
   "Seeded decks restored." when the deck on screen survives, and
   "Seeded decks restored. Showing D KURD 10." when the replacement was the
   deck on screen (that is what the existing test does; Codex finding 2:
   assert the full string, not a prefix) and (b) no record under
   `hpfc.scales.v3` (`app.get("SCALES_KEY")`) carries `o.replaces`. Extend the
   e2e test "SD: RESET arms, then restores all five at 380px and focuses
   #deck-add" with (b) read through `b.eval` (the e2e harness has no `page`
   object; Codex finding 6). New mutant
   `d_reset_keeps_stored_replaces.patch`: replace the RESET handler's
   `writeScales(savedScales().filter(...))` line with
   `writeScales(savedScales());`; `# kills:` names the app test. It must
   survive BEFORE the assertion lands and die after (record both runs in the
   PR body).
6. **Two same-seed records (Q4 finding 1, pins D10).** New app test "SD: two
   records naming one seed: the newest holds the slot, deleting it promotes
   the older, RESET clears both": seed the store with two `replaces:"kurd"`
   records (older first) with two DISTINCT scale strings - restoration
   deduplicates by the scale-derived id, so two records that differ only in
   palette or name collapse to one (Codex finding 7) - boot, assert chip order has the newer in Kurd's slot
   and the older in the custom tier; DELETE the newer, assert the older now
   sits in Kurd's slot and Kurd is still absent; RESET, assert both records are
   gone from the registry and from stored scales and Kurd's chip is back.
   No code change expected; if any assertion fails, STOP and record it in the
   return report rather than changing RESET (D10).
7. **RESET disarm mutants (Q3 last nit).** Two new mutants, both killed by the
   existing test "SD: an armed RESET disarms on a tap elsewhere, blur and
   panel close, and re-arms after": `d_reset_blur_stays_armed.patch` deletes
   `restoreBtn.onblur = disarmReset;`; `d_reset_close_stays_armed.patch`
   deletes the `disarmReset();` call inside `closePanel` (near
   `index.html:10713`).
8. **Mutant header hygiene (Q3).** Rewrite the prose description line(s) of
   `e_chip_pencil_on_builtins`, `d_hidden_not_filtered`,
   `d_builtin_hide_unwired`, `d_fork_overwrites` in SAVE / DELETE / RESET
   terms (no FORK / HIDE vocabulary; the `# kills:` and `# suite:` lines and
   the diff are untouched). `d_seeded_sheet_keeps_fork_copy`: description
   becomes "Every Edit sheet of a deck without stored options, every seeded
   deck included, shows the retired FORK THIS DECK copy". `d_replaces_not_carried`
   is correct as written (it mutates `restoreScales`); add the mutant SD-A15
   described, `d_replaces_not_carried_back.patch`, which deletes the
   carry-back line `if (typeof replaces === "string" && isBuiltIn(replaces))
   built.value.options.replaces = replaces;` in `generateDeck`; `# kills:` the
   test "SD: a replacement takes the seeded slot across a reload and a field
   edit". If it survives, extend that test until it dies.
   Verify: `python3 tools/refresh_mutants.py --check`; `grep -il "fork\|hide"
   tests/mutants/{e_chip_pencil_on_builtins,d_hidden_not_filtered,d_builtin_hide_unwired,d_fork_overwrites}.patch`
   lists nothing except where the word is inside a `# kills:` or `# suite:`
   line.
9. **Counts.** `tests/suite_health.py` FLOORS rows for `tests/app.test.js` and
   `tests/e2e.test.js` rise to the new counts CI reports at the final SHA
   (floors are minimums: set them from CI's artifacts, never guess).
   README "922 mutant patches" becomes the on-disk count
   (`ls tests/mutants/*.patch | wc -l`, expected 929).

### Docs items (README.md, CLAUDE.md)

Every sentence below cites the test that proves it (memory
`feedback_docs_lane_cites_tests`); the reviewer diffs claims against tests.

10. README: SAVE on a seeded deck is refused when a saved custom deck already
    holds that scale (the guard is `fromSeed && CUSTOM[...]`; another seeded
    deck's scale does not refuse), with the message "Another deck already uses this scale."
    (test: `grep -n "Another deck already uses" tests/app.test.js`; if no test
    asserts it on a SEEDED deck, add one first).
11. README: SAVE on a seeded deck with nothing changed closes the sheet and writes nothing
    (test "SD: saving a seeded deck unchanged closes the sheet and writes
    nothing").
12. README: an armed RESET disarms on blur, on a tap anywhere else, and when
    the panel closes (test "SD: an armed RESET disarms ...").
13. README: one sentence from plan section E: a SAVE in an older build of the
    app rebuilds the record without `replaces`, so the deck becomes a plain
    custom deck and the seed comes back beside it; nothing else is lost. No
    test can run an older build; cite the plan section instead.
14. README and CLAUDE.md: replace loose "five seeded slots" phrasing (grep `seeded slot`) with
    "the seeded decks' slots" where it is about slots, not the count.
15. README and CLAUDE.md (D10): RESET clears every saved edit of a seeded
    deck, including an older one no longer shown in the seed's slot (test from
    item 6). Check what 37a6232 already says and change only what disagrees.
16. CLAUDE.md "Default deck" bullet: "A stored deck id is always honoured"
    becomes "A stored deck id of a VISIBLE deck is always honoured" so the
    bullet no longer contradicts its own later sentence; also note the boot
    message rule from item 2 in the same bullet (one sentence).

17. CLAUDE.md "Default deck" bullet (D14): the sentence "A stored id of a
    replaced seed shows the replacement ONLY for the default deck (through
    `fallbackDeck()`); any other replaced seed id falls back silently" becomes
    "A stored id of a replaced seed shows its replacement, whichever seed it
    is (`deck()` consults `replacements()` before `fallbackDeck()`)" (test
    from item 2, case (b)). README: grep `replaced` and align any sentence
    that says the same Kurd-only thing.

### Mutants

New patches (7): `d_boot_warns_on_replacement`, `d_boot_replacement_by_order`,
`d_seeded_sheet_layout_changed`,
`d_reset_keeps_stored_replaces`, `d_reset_blur_stays_armed`,
`d_reset_close_stays_armed`, `d_replaces_not_carried_back`. Each: `# kills:`
names one test, `# suite:` is `node --test --test-name-pattern <name with .
for every space> tests/app.test.js`, no `index a..b` line
(memory `mutant-patches-reject-index-lines`), anchored on the change with
`-U3` context. Run `python3 tools/refresh_mutants.py --check` before pushing.
Do not run the full mutation sweep locally; CI's four shards are the oracle.
To check one patch by hand use its `# suite:` line after `git apply` (D15).

### Acceptance (lane) and verify commands

- A1 items 1-4 land, each with its test: `node --test tests/app.test.js`.
- A2 items 5-7: `node --test --test-name-pattern "RESET|same.seed|two.records" tests/app.test.js`;
  the single e2e test: `node --test --test-name-pattern "RESET.arms" tests/e2e.test.js`
  (needs `CHROME_BIN`; skip locally if absent and let CI run it).
- A3 item 8: `python3 tools/refresh_mutants.py --check`.
- A4 `python3 tools/validate.py` and `node tools/boot_sim.js` green.
- A5 docs items 10-17: each README/CLAUDE.md sentence names, in the PR body,
  the test that proves it.
- A6 CI green at the final pushed SHA (all 11 checks incl. four mutation
  shards); an independent reviewer PASS or PASS_WITH_NITS at that SHA.

### Delivery

Commit per item group (code, tests+mutants, docs), push the branch, open the
PR against main with the item list and the before/after mutant runs from
item 5, wait for CI. Local runs are smoke tests; CI at the final commit is
the evidence.

## Standing gates

Merge is AFK-authorised only with CI green at a head SHA verified against the
local tip AND a fresh reviewer PASS at that SHA. Bounce cap two. No deck data,
no geometry, no engine regions, no `--amend`, no `--no-verify`.

## Eng review (2026-10-13, /plan-eng-review, AFK)

Scope: complexity gate tripped (eight-plus files) and was auto-answered
"Original arrangement": the owner chose one nits lane, and every item is a
nit of the shipped SAVE / DELETE / RESET model, so splitting would add PRs
without adding an ownership boundary.

NOT in scope: any change to RESET's semantics (D10), the phone `.announce`
item (D13), `#settings-panel` markup or CSS, deck data, engine modules.

What already exists: `replacements()`, `fallbackDeck()`, the boot guard,
the RESET handler with its three disarm hooks, and the five tests the plan
extends are all on main at ed74b51 and were read at their current lines.

Findings and decisions:

- F1 (D14): item 2 as drafted only worked for Kurd, because the landing on
  the replacement came from `fallbackDeck()` preferring `DEFAULT_DECK`'s
  replacement. A hidden hijaz with a replacement landed on Kurd with "That
  deck is gone". Remedy: `deck()` consults `replacements()[deckId]` before
  `fallbackDeck()`; test covers Kurd, a non-default seed with the
  replacement NOT first in chip order, and the no-replacement case.
- F2 (D14): #299 nit N4 (order-coincidence landing when Kurd is hidden) was
  not mapped to any item. The same clause closes it; item 17 corrects the
  CLAUDE.md sentence that documented the Kurd-only behaviour.
- F3 (D15): "mutation_check.sh with the new patch selected" named a selector
  that does not exist (`MUTANT_SHARD` only). Every per-mutant verify step
  now runs the patch's own `# suite:` line after `git apply`.

Outside voice (Codex exec, read-only sandbox, 8 findings): 4 confirmed and
folded into items 2, 5 and 6 (scales live under `hpfc.scales.v3`; RESET's
message carries "Showing D KURD 10." when the replacement was on screen;
the e2e harness exposes `b.eval`, not `page.evaluate`; two same-seed records
need distinct scale strings or restoration dedupes them). The other 4
confirmed items 2 (the `deck()` clause), 3, 4, 5's survive-then-die claim,
7 and 8 as written. Codex noted `refresh_mutants.py --check` validates
applicability only, not header wording; item 8's grep is the wording check.

Failure modes watched: (1) the `deck()` clause resolving a hidden seed to a
replacement somewhere other than boot - ruled out, every other caller sets
`deckId` through `selectDeck`; (2) `d_reset_keeps_stored_replaces` dying
before the assertion lands - item 5 records both runs in the PR body;
(3) FLOORS set from a local count - item 9 reads CI's artifacts.

Worktree parallelization: one lane, one worktree, no split.

Test plan artifact: this section is the test plan; every item names its
test and its mutant, A1-A6 name the commands.

Unresolved decisions: none. Approval readiness: READY, AFK auto-approved.

## GSTACK REVIEW REPORT

| Review | Status | Findings |
|---|---|---|
| CEO | skipped (nits lane, no scope question) | - |
| Outside voice | Codex exec, 8 findings, 4 confirmed and folded in | fixtures |
| Eng | done, F1-F3 resolved as D14 and D15 | 3 |
| Design | n/a (no UI change) | - |
| DX | n/a | - |

OUTSIDE COVERAGE: Codex (read-only) reviewed items 2-8 against the code.
VERDICT: READY FOR IMPLEMENTATION.
NO UNRESOLVED DECISIONS
