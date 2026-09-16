# Trigger-Aware Cluster Rule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the D2 "forced" test so that a tone whose only lower instance is on the bottom shell does NOT trigger clustering, re-voice the five Pygmy cards that change, and keep the commercial Amara reference exact by construction.

**Architecture:** One predicate changes in `src/engine/voicing.js::choose()` (the forced test gains a top-shell clause, the unforced branch gains a bottom fallback). Everything else is consequence: the Python oracle in `tests/test_deck_data.py` gets the same clause, five Pygmy voicings in `tools/decks.py` and the `DECKS` line of `index.html` are updated in lockstep, the frozen corpus is bumped v2 -> v3, the divergence table keys move, the spec and CLAUDE.md are rewritten, PDFs are rebuilt, and three mutants are re-cut. Root-instance enumeration (the generalization ask) is Part B, a separate follow-up plan gated on this one landing.

**Tech Stack:** vanilla JS engine in a `node:vm` realm (`tests/helpers/engine.js`), `node --test`, Python `unittest`, reportlab, `tests/mutation_check.sh`.

**Spec:** `docs/ENGINE-SPEC.md` section 6 (D2/D11), CLAUDE.md "Verified card conventions" rule 3, and the owner decisions recorded in the session of 2026-09-15 (below).

## Owner decisions this plan implements (2026-09-15)

1. Pygmy `Cm7` (root C4) must voice `[C4/3 Eb4/4 G4/6 Bb3/U4]`, i.e. fields `[3,4,6,104]`, badge `1 BOTTOM NOTES`.
2. "The commercial reference should be accurate. Let's not make an exception but find a design that would adhere to the commercial Amara deck." The rule below preserves every Amara and Hijaz card by construction: neither pan has a bottom shell, so the new clause is vacuously true there and the D2 behaviour observed in the commercial reference (G5, Gsus4, Fmaj7 cluster below the root) is unchanged.
3. Generalization ("a generalized engine can produce a useful and comprehensive set") is Part B.

**Execution gate:** this plan alters deck data. CLAUDE.md forbids that without explicit owner instruction. The owner asked for the PLAN; executing Part A needs the owner's explicit "go" first.

## The rule, precisely

Current D2 forced test: a chord is forced when ANY non-root tone has no instance above the root.

New (trigger-aware) forced test: a chord is forced when ANY non-root tone has no instance above the root AND that tone's HIGHEST lower instance is on the top shell (zone is not `bottom`).

Consequences, unchanged otherwise:
- Forced chord: every chord tone (interval < 12) takes its highest instance below the root, or stays above if it has no lower instance; extensions (interval >= 12) take their nearest instance above the root unless they have none, then their highest lower instance.
- Unforced chord: every tone takes its nearest instance above the root; a tone with no instance above (which, on an unforced chord, is necessarily a tone whose highest lower instance is on the bottom shell) takes its highest lower instance, which is that bottom-shell field.

Measured impact (scratch `chooseT`, this session), engine output vs current rule:

| Deck / pan | Cards that change |
|---|---|
| builtin amara | 0 |
| builtin hijaz | 0 |
| builtin pygmy (engine vocabulary) | 9: Fsus4, F7sus4, Fm11, C7sus4, Cm7, Eb, Eb7, Ebsus4/Eb7sus4 (bottom-note total 28 -> 27) |
| 17 other synthetic pans | 0 except the Pygmy-derived "nineteen field maximum" (6 cards) |

Shipped Pygmy cards that re-voice (the ONLY deck-data change; LOW VOICING cards on roots 101/103 are untouched):

| Card | Old fields | New fields | Old notes | New notes | Badge |
|---|---|---|---|---|---|
| Fsus4 | `[5,104,3]` | `[5,104,8]` | F4 Bb3 C4 | F4 Bb3 C5 | 1 -> 1 |
| Fm11 | `[5,2,3,4,6,104]` | `[5,7,8,9,6,104]` | F4 Ab3 C4 Eb4 G4 Bb3 | F4 Ab4 C5 Eb5 G4 Bb3 | 1 -> 1 |
| Cm7 | `[3,103,1,104]` | `[3,4,6,104]` | C4 Eb3 G3 Bb3 | C4 Eb4 G4 Bb3 | 2 -> 1 |
| Eb | `[4,1,104]` | `[4,6,104]` | Eb4 G3 Bb3 | Eb4 G4 Bb3 | 1 -> 1 |
| Eb7 | `[4,1,104,105]` | `[4,6,104,105]` | Eb4 G3 Bb3 Db4 | Eb4 G4 Bb3 Db4 | 2 -> 2 |

Pygmy fields for reference: 1 G3, 2 Ab3, 3 C4, 4 Eb4, 5 F4, 6 G4, 7 Ab4, 8 C5, 9 Eb5, 10 F5, 11 G5; bottom 101 C3/U1, 102 Db3/U2, 103 Eb3/U3, 104 Bb3/U4, 105 Db4/U5, 106 Ab5/U6. Amara: 1 A3, 2 C4, 3 D4, 4 E4, 5 F4, 6 G4, 7 A4, 8 C5 (no bottom shell).

## Global Constraints

- Single-file app: engine regions in `index.html` are GENERATED. Edit `src/engine/voicing.js`, then `python3 tools/inline_engine.py`. Never hand-edit inside `<!-- engine:voicing begin -->` ... `end -->`.
- Deck data lives twice: `tools/decks.py` and the single `const DECKS = [...]` line in `index.html`. `python3 tools/validate.py` check 1 fails if they differ. Re-inject with a lambda replacement (the degrees contain U+00B0) and re-parse the written file to verify.
- After any deck-data change: `python3 tools/decks.py` (rebuild PDFs), then `python3 tools/regen_data_mutants.py` on a CLEAN tree.
- Tests are spec-first (`tests/CONTRACT.md` rule 1). No test imports a constant from the module it tests (rule 2). Every test group needs a killing mutant (rule 3). Mutant diff bodies are generated with `git diff` on a committed tree, never hand-typed (rule 4).
- `tests/suite_health.py` FLOORS: `tests/voicing.test.js` 14, `tests/select.test.js` 35, `tests/test_deck_data.py` 16. Raise only rows this PR adds tests to.
- Frozen corpus: a deliberate data change renames `tests/fixtures/golden_decks_v2.json` -> `golden_decks_v3.json`, `version` 3, `sha256` recomputed as `hashlib.sha256(json.dumps({"version": 3, "decks": decks}, sort_keys=True, separators=(",", ":")).encode()).hexdigest()` (read `tests/test_fixture_integrity.py` for the canonical form before computing; do not guess).
- The full gate, run before opening the PR: `python3 tools/validate.py && node tools/boot_sim.js && python3 -m unittest discover -s tests -t . && node --test tests/*.test.js && python3 tests/suite_health.py && ./tests/mutation_check.sh` (mutation check is ~5 min and refuses a dirty tree).
- Git: new commits only, never `--amend`, never `--no-verify`, never `git add -A`, no bare `git stash`. Commit trailers: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01S24msyK6JGS18wpqWjZzJc`.
- Branch `scale-engine/trigger-aware-cluster`, built in a dedicated worktree. Merge via `gh pr merge <n> --merge` without `--delete-branch`, after an independent `/review` PASS and green CI at the head SHA.
- Do not touch diagram geometry, the visual system, or the LOW VOICING cards.

---

## Part A: the trigger-aware rule (one PR)

### File structure

| File | Responsibility in this PR |
|---|---|
| `src/engine/voicing.js:280-300` | the predicate change in `choose()` and the header comment above it |
| `index.html` (engine region + `DECKS` line) | synced copy of the module; five re-voiced Pygmy cards |
| `tools/decks.py:86-108` | the five Pygmy tuples |
| `tests/voicing.test.js:261-334` | D2 tests rewritten for the new rule, plus one new test |
| `tests/test_deck_data.py:106-152, 269-360` | badge table, `SEVENTH_REGISTERS`, `_check_cluster` oracle |
| `tests/fixtures/golden_decks_v3.json` (renamed from v2) | frozen corpus with the five new voicings |
| `tests/test_fixture_integrity.py`, `tests/core.test.js:19`, `tests/naming.test.js:32`, `tests/voicing.test.js:18`, `tests/select.test.js:34`, `tests/mutants/f_fixture_sha.patch` | readers of the corpus filename / sha |
| `tests/fixtures/divergence_v1.json` (pygmy) | keys for cards whose field lists changed |
| `docs/ENGINE-SPEC.md:497-525`, `CLAUDE.md:80-83,111-135` | the rule as documented |
| `*.pdf` (six) | rebuilt |
| `tests/mutants/v_bottom_forced_triggers_cluster.patch` (new), `v_forced_ignores_extensions.patch`, `v_cluster_takes_lowest_below.patch`, `b_cluster_forced_only.patch`, `b_pygmy_badge_count.patch` (re-anchored) + `tools/regen_data_mutants.py:39-41,114,126-136` | killing mutants re-cut for the new rule |

### Task 1: Worktree and branch

**Files:** none (setup)

- [ ] **Step 1: Create the worktree off current main**

```bash
cd /Users/ray/Projects/handpan-cards
git fetch origin main
git worktree add -b scale-engine/trigger-aware-cluster ../handpan-cards-tac origin/main
cd ../handpan-cards-tac
ln -s ../handpan-cards/node_modules node_modules 2>/dev/null || true
cp ../handpan-cards/docs/plans/2026-09-15-trigger-aware-cluster-rule.md docs/plans/
git add docs/plans/2026-09-15-trigger-aware-cluster-rule.md
git commit -m "docs(plan): trigger-aware cluster rule, reviewed plan

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S24msyK6JGS18wpqWjZzJc"
```

The plan is untracked on main; the worktree starts from `origin/main`, so this copy-and-commit is what makes the PR body's plan link resolve.

- [ ] **Step 2: Confirm the gate is green before touching anything**

Run: `python3 tools/validate.py && node --test tests/voicing.test.js && python3 -m unittest tests.test_deck_data`
Expected: all pass (61 cards, 14 voicing tests, 16 deck-data tests).

### Task 2: Engine tests for the new rule (RED)

**Files:**
- Modify: `tests/voicing.test.js:261-334` (the two D2 tests)
- Test: `tests/voicing.test.js`

**Interfaces:**
- Consumes: `V.choose(fields, rootPc, intervals, opts?) -> {ok, value:{fields, roots}}`, unchanged signature.
- Produces: three test names that Task 8's mutants cite verbatim.

- [ ] **Step 1: Replace the test "D2 forced chords cluster chord tones to the highest instance below the root" (lines 261-315) with this**

The Amara half stays. The Pygmy `Cm7` half inverts (it is no longer forced). The "two instances below" case moves from `Fm11` (no longer forced) to `Gm7b5` pinned to root G5, whose 7th F has two lower instances F5 and F4.

```js
test("D2 forced chords cluster chord tones to the highest instance below the root", () => {
  const amara = GOLDEN.decks.find((d) => d.id === "amara");
  // CLAUDE.md rule 3 / plan Premise 2: Amara Fmaj7 is forced (its 7th, E, has
  // no instance above F4 and E4 is on the top shell) and ships spelling order
  // F A C E, all below the root. This is the commercial reference behaviour.
  const fmaj7 = amara.chords.find((c) => c.main === "Fmaj" && c.sup === "7");
  const got = V.choose(amara.fields, pc(midiOf(amara.fields, fmaj7.roots[0])),
    [0, 4, 7, 11]);
  assert.deepStrictEqual(plain(got.value.fields), fmaj7.fields);
  const rootMidi = midiOf(amara.fields, got.value.roots[0]);
  for (const id of plain(got.value.fields).slice(1)) {
    assert.ok(midiOf(amara.fields, id) < rootMidi,
      "every chord tone of a forced chord sits below the root");
  }

  // HIGHEST, not merely "below": Pygmy Gm7b5 pinned to root G5 is forced by
  // its 7th (F5 is top-shell and below G5). F has TWO instances below the
  // root, F5 and F4; the rule names the highest, F5 = field 10. A "lowest
  // below" reading would give F4 = field 5 and is what this case rejects.
  const pygmy = GOLDEN.decks.find((d) => d.id === "pygmy");
  const g5 = Object.keys(pygmy.fields).map(Number)
    .find((id) => midiOf(pygmy.fields, id) === 79 && zoneOf(pygmy.fields, id) !== "ding");
  const gotG = V.choose(pygmy.fields, pc(79), [0, 3, 6, 10], { rootId: g5 });
  assert.ok(gotG.ok, gotG.code);
  const ids = plain(gotG.value.fields);
  const seventh = midiOf(pygmy.fields, ids[3]);
  assert.ok(seventh < 79, "the 7th of forced Gm7b5 sits below the root");
  let highestBelow = -Infinity;
  let instancesBelow = 0;
  for (const key of Object.keys(pygmy.fields)) {
    const r = pygmy.fields[key];
    if (r[3] === "ding") continue;
    if (pc(r[2]) !== pc(seventh) || r[2] >= 79) continue;
    instancesBelow += 1;
    if (r[2] > highestBelow) highestBelow = r[2];
  }
  assert.strictEqual(instancesBelow, 2, "F has two instances below G5");
  assert.strictEqual(seventh, highestBelow,
    `the 7th took ${seventh}, not the highest instance below the root`);
  // The b3 and b5 exist only on the bottom shell; on a forced chord a chord
  // tone still takes its highest lower instance, bottom shell included.
  assert.strictEqual(zoneOf(pygmy.fields, ids[1]), "bottom");
  assert.strictEqual(zoneOf(pygmy.fields, ids[2]), "bottom");
});
```

- [ ] **Step 2: Replace the test "D2 forced chords keep their extensions above the root unless forced too" (lines 317-334) with this**

Uses Amara `Fmaj9` (forced by chord tones; the 9th G has G4 above and stays there) and a hand-built five-field pan where ONLY the 9th forces, which proves the forced test still counts extensions.

```js
test("D2 forced chords keep their extensions above the root unless forced too", () => {
  const amara = GOLDEN.decks.find((d) => d.id === "amara");
  // Amara Fmaj9: A, C and E force the chord below F4 (each is top-shell and
  // has no instance above F4). The 9th, G, has G4 above the root and keeps it.
  const got = V.choose(amara.fields, pc(65), [0, 4, 7, 11, 14]);
  assert.ok(got.ok, got.code);
  const ids = plain(got.value.fields);
  const rootMidi = midiOf(amara.fields, ids[0]);
  assert.strictEqual(rootMidi, 65);
  assert.ok(midiOf(amara.fields, ids[1]) < rootMidi, "3rd clusters below");
  assert.ok(midiOf(amara.fields, ids[2]) < rootMidi, "5th clusters below");
  assert.ok(midiOf(amara.fields, ids[3]) < rootMidi, "7th clusters below");
  assert.ok(midiOf(amara.fields, ids[4]) > rootMidi, "the 9th keeps its instance above");
  assert.strictEqual(midiOf(amara.fields, ids[4]), 67, "the 9th is the NEAREST above, G4");

  // The forced test is over ANY non-root tone, extensions included. On this
  // pan Cadd9 from C5 has E5 and G5 above the root, and D only as D4 on the
  // top shell below it: the 9th alone forces the chord, so E and G cluster
  // to E4 and G4 and the forced 9th takes D4.
  const pan = {
    "0": ["C", 3, 48, "ding", null, "Ding"],
    "1": ["D", 4, 62, "rim", 270, "1"],
    "2": ["E", 4, 64, "rim", 225, "2"],
    "3": ["G", 4, 67, "rim", 315, "3"],
    "4": ["C", 5, 72, "rim", 180, "4"],
    "5": ["E", 5, 76, "rim", 0, "5"],
    "6": ["G", 5, 79, "rim", 135, "6"],
  };
  const add9 = V.choose(pan, pc(72), [0, 4, 7, 14], { rootId: 4 });
  assert.ok(add9.ok, add9.code);
  assert.deepStrictEqual(plain(add9.value.fields), [4, 2, 3, 1]);
});
```

- [ ] **Step 3: Add the new test directly after it**

```js
test("D2 a tone forced onto the bottom shell does not trigger clustering", () => {
  // Owner decision 2026-09-15: the forced test has a top-shell clause. A tone
  // whose only lower instance is a bottom-shell field takes that field, and
  // the OTHER tones stay at their nearest instance above the root. Pygmy Bb
  // and Db exist only on the bottom shell, so Cm7 from C4 is
  // C4 Eb4 G4 Bb3(U4) - fields [3,4,6,104] - not the old cluster to Eb3/G3.
  const pygmy = GOLDEN.decks.find((d) => d.id === "pygmy");
  const cm7 = V.choose(pygmy.fields, pc(60), [0, 3, 7, 10]);
  assert.ok(cm7.ok, cm7.code);
  assert.deepStrictEqual(plain(cm7.value.fields), [3, 4, 6, 104]);
  const ids = plain(cm7.value.fields);
  assert.strictEqual(zoneOf(pygmy.fields, ids[3]), "bottom");
  for (const i of [1, 2]) {
    assert.ok(midiOf(pygmy.fields, ids[i]) > 60, `tone ${i} stays above the root`);
  }

  // Same rule, five shipped cards: every Pygmy card rooted on the top shell
  // whose only forced tones are bottom-shell-only now reads nearest-above.
  const expect = {
    "Fsus4": [5, 104, 8],
    "Fm11": [5, 7, 8, 9, 6, 104],
    "Eb": [4, 6, 104],
    "Eb7": [4, 6, 104, 105],
  };
  for (const name of Object.keys(expect)) {
    const chord = pygmy.chords.find((c) => c.main + c.sup === name && !/VOICING/.test(c.subtitle));
    assert.ok(chord, name);
    const got = V.choose(pygmy.fields, pc(midiOf(pygmy.fields, chord.roots[0])),
      intervalsOfCard(pygmy, chord));
    assert.deepStrictEqual(plain(got.value.fields), expect[name], name);
  }

  // Amara and Hijaz have no bottom shell, so the clause changes nothing there:
  // every card of both decks still reproduces (the alternates aside).
  for (const deckId of ["amara", "hijaz"]) {
    const deck = GOLDEN.decks.find((d) => d.id === deckId);
    for (const chord of deck.chords) {
      if (/VOICING/.test(chord.subtitle)) continue;
      const got = V.choose(deck.fields, pc(midiOf(deck.fields, chord.roots[0])),
        intervalsOfCard(deck, chord));
      assert.deepStrictEqual(plain(got.value.fields), chord.fields, cardKey(deck, chord));
    }
  }
});
```

Note: `intervalsOfCard(pygmy, chord)` is computed from the FIXTURE's field list, which at this point still holds the old voicings. The interval set is a function of pitch classes in spelling order and is identical for old and new voicings (e.g. Fm11 old F Ab C Eb G Bb and new F Ab C Eb G Bb), so the test is valid before and after the fixture bump.

- [ ] **Step 4: Run the three tests and confirm they fail against the current engine**

Run: `node --test --test-name-pattern "^D2" tests/voicing.test.js`
Expected: exactly ONE failure, the new test "D2 a tone forced onto the bottom shell does not trigger clustering", red with `[3,103,1,104]` vs `[3,4,6,104]`. The two rewritten tests are expected to PASS today: they re-pin behaviour the current engine already has (Amara Fmaj7/Fmaj9, Gm7b5 at G5, the synthetic Cadd9 pan) using cases that stay valid after the rule change; their old Pygmy Cm7/Fm11 cases would have gone red in Task 3, which is why they are rewritten now. If either rewritten test is red, STOP: the case or the expected array is wrong, not the engine.

- [ ] **Step 5: Commit the red tests**

```bash
git add tests/voicing.test.js
git commit -m "test(voicing): D2 forced test gains the top-shell clause (red)

A tone whose only lower instance is a bottom-shell field no longer forces
the chord; it takes that field and the other tones stay nearest-above.
Owner decision 2026-09-15. Engine follows in the next commit.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S24msyK6JGS18wpqWjZzJc"
```

### Task 3: Implement the predicate in `choose()` (GREEN for Task 2)

**Files:**
- Modify: `src/engine/voicing.js:280-297` and the header comment at `:241-249`
- Sync: `index.html` via `python3 tools/inline_engine.py`

**Interfaces:**
- Produces: `choose()` with the same signature. Field objects from `playable()` carry `{id, midi, zone, top}`; `below()` returns the lower instances sorted DESCENDING, so `tone.down[0]` is the highest lower instance.

- [ ] **Step 1: Change the forced loop and the unforced branch**

Replace lines 280-283:

```js
    var forced = false;
    for (var t = 0; t < tones.length; t += 1) {
      if (!tones[t].up.length) forced = true;
    }
```

with:

```js
    // D2 forced test (owner decision 2026-09-15): a non-root tone forces the
    // chord only when it has no instance above the root AND its highest lower
    // instance is on the TOP shell. A tone whose highest lower instance is on
    // the bottom shell takes that instance and forces nothing. Amara and Hijaz have
    // no bottom shell, so the commercial reference is unchanged by this.
    var forced = false;
    for (var t = 0; t < tones.length; t += 1) {
      if (!tones[t].up.length && tones[t].down[0].top) forced = true;
    }
```

and replace the unforced branch:

```js
      if (!forced) {
        field = tone.up[0];
      }
```

with:

```js
      if (!forced) {
        field = tone.up.length ? tone.up[0] : tone.down[0];
      }
```

- [ ] **Step 2: Update the header comment (lines ~241-249) to read**

```js
  //   forced (D2) -> a non-root tone FORCES the chord when it has no instance
  //              above the root and its highest lower instance is on the top
  //              shell. Every CHORD TONE (interval < 12) then moves to its
  //              HIGHEST instance below the root; a chord tone with no lower
  //              instance stays put. EXTENSIONS keep their NEAREST instance
  //              above the root unless they are themselves forced.
  //   unforced (D11) -> every non-root tone takes its NEAREST instance above
  //              the root; a tone whose highest lower instance is on the bottom
  //              shell takes that instance and forces nothing.
```

- [ ] **Step 3: Sync the engine into the app and run the D2 tests**

Run: `python3 tools/inline_engine.py && node --test --test-name-pattern "^D2" tests/voicing.test.js`
Expected: 3 pass.

- [ ] **Step 4: Run the whole voicing and select suites; expect the corpus tests to go RED on exactly the five Pygmy cards**

Run: `node --test tests/voicing.test.js tests/select.test.js 2>&1 | grep -E "^not ok|choose gave|listed" | head -30`
Expected red: "choose reproduces the corpus outside the recorded two-sided exceptions" (pygmy Fsus4 / Fm11 / Cm7 / Eb / Eb7 "not a recorded exception"), "with the root field given, choose reproduces 60/61", and the two divergence tests in select.test.js. Nothing in amara or hijaz. If any amara or hijaz card is named, STOP: the rule is wrong.

- [ ] **Step 5: Commit the engine change (tree red on purpose; the fixture bump follows)**

```bash
git add src/engine/voicing.js index.html tests/voicing.test.js
git commit -m "feat(voicing): bottom-shell-only tones no longer force the cluster rule

The D2 forced test now requires the forcing tone's highest lower instance
to be on the top shell. Amara/Hijaz have no bottom shell and are unchanged;
Pygmy cards whose only below-root tones are Bb/Db read nearest-above.
Corpus and deck data follow in the next commits.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S24msyK6JGS18wpqWjZzJc"
```

### Task 4: Python oracle, deck data, PDFs

**Files:**
- Modify: `tests/test_deck_data.py:106-152` (badge table, SEVENTH_REGISTERS, comments), `:329-360` (`_check_cluster`)
- Modify: `tools/decks.py:86,89,102,106,108`
- Modify: `index.html` (`const DECKS = [...]` line)
- Rebuild: the six `*.pdf`

- [ ] **Step 1: Change the oracle in `_check_cluster` (test first)**

Replace:

```python
        forced = any(not instances(f, below=False) for f in others)
        for f in others:
            lower, upper = instances(f, True), instances(f, False)
            if not forced:
                self.assertGreater(midi(f), rm,
                                   ("unforced card: tone below the root", card, f))
```

with:

```python
        # Owner decision 2026-09-15: a tone forces the chord only when it has no
        # instance above the root AND its highest lower instance is on the TOP
        # shell. A bottom-shell-only tone takes its bottom field, forces nothing.
        forced = any(not instances(f, below=False)
                     and zone(max(instances(f, True), key=midi)) != "bottom"
                     for f in others)
        for f in others:
            lower, upper = instances(f, True), instances(f, False)
            if not forced:
                if upper:
                    self.assertGreater(midi(f), rm,
                                       ("unforced card: tone below the root", card, f))
                else:
                    self.assertEqual(midi(f), max(midi(g) for g in lower),
                                     ("bottom-shell-only tone not at its highest "
                                      "instance", card, f))
                    self.assertEqual(zone(f), "bottom", card)
```

and pass `zone` in explicitly rather than through instance state: change the signature to `def _check_cluster(self, ch, rm, others, card, midi, instances, zone):`, add `zone = lambda f: field_of(deck, f)[3]` directly under the existing `midi = lambda f: ...` line in `test_forced_tones_cluster_below_root`, and change the call to `self._check_cluster(ch, rm, others, card, midi, instances, zone)`.

- [ ] **Step 2: Update `SEVENTH_REGISTERS` and `PYGMY_BADGE`**

```python
SEVENTH_REGISTERS = [
    ("Cm", "7", "C MINOR 7 - LOW VOICING", [101, 103, 1, 104], 101),
    ("Cm", "7", "C MINOR 7", [3, 4, 6, 104], 3),
    ("Eb", "7", "Eb DOMINANT 7 - LOW VOICING", [103, 1, 104, 105], 103),
    ("Eb", "7", "Eb DOMINANT 7", [4, 6, 104, 105], 4),
]
```

In `PYGMY_BADGE` change `2,  # Cm7 (clustered: Eb3 + Bb3 are both bottom-shell)` to `1,  # Cm7 (Bb3 is the only bottom-shell field; Eb and G sit above C4)` and `2,  # Eb7 (clustered: Bb3 + Db4)` to `2,  # Eb7 (Bb3 + Db4, both bottom-shell-only)`. Rewrite the comment block above `SEVENTH_REGISTERS` so its second paragraph reads:

```python
#   Eb7 rooted at Eb4 is NOT forced: Bb and Db exist only on the bottom shell,
#   and a bottom-shell-only tone forces nothing (owner decision 2026-09-15).
#   G takes its nearest instance above the root, G4; Bb3 and Db4 are the two
#   bottom-shell fields.
```

- [ ] **Step 3: Run the Python deck tests; expect RED on the five cards and the two tables**

Run: `python3 -m unittest tests.test_deck_data 2>&1 | tail -20`
Expected: `test_forced_tones_cluster_below_root` subtests fail for pygmy Fsus4, Fm11, Cm7, Eb, Eb7 ("unforced card: tone below the root"); the badge and SEVENTH_REGISTERS tests fail on Cm7 / Eb7.

- [ ] **Step 4: Change the five tuples in `tools/decks.py`**

```python
    ("Fsus", "4", "SUSPENDED CHORD", [5, 104, 8], {5}),
    ("Fm", "11", "F MINOR 11", [5, 7, 8, 9, 6, 104], {5}),
    ("Cm", "7", "C MINOR 7", [3, 4, 6, 104], {3}),
    ("Eb", "", "Eb MAJOR", [4, 6, 104], {4}),
    ("Eb", "7", "Eb DOMINANT 7", [4, 6, 104, 105], {4}),
```

(Only the field lists change. Names, subtitles, roots unchanged. The four LOW/HIGH VOICING tuples are untouched.)

- [ ] **Step 5: Re-inject the same five voicings into the `DECKS` line of `index.html`**

Run from the worktree root:

```bash
python3 - <<'EOF'
import json, re
p = "index.html"
html = open(p).read()
m = re.search(r"^const DECKS = (\[.*\]);$", html, re.M)
app = json.loads(m.group(1))
new = {("Fsus", "4", "SUSPENDED CHORD"): [5, 104, 8],
       ("Fm", "11", "F MINOR 11"): [5, 7, 8, 9, 6, 104],
       ("Cm", "7", "C MINOR 7"): [3, 4, 6, 104],
       ("Eb", "", "Eb MAJOR"): [4, 6, 104],
       ("Eb", "7", "Eb DOMINANT 7"): [4, 6, 104, 105]}
pygmy = next(d for d in app if d["id"] == "pygmy")
hit = 0
for ch in pygmy["chords"]:
    key = (ch["main"], ch["sup"], ch["subtitle"])
    if key in new:
        ch["fields"] = new[key]; hit += 1
assert hit == 5, hit
line = "const DECKS = " + json.dumps(app) + ";"
out = re.sub(r"^const DECKS = \[.*\];$", lambda _: line, html, count=1, flags=re.M)
open(p, "w").write(out)
back = json.loads(re.search(r"^const DECKS = (\[.*\]);$", open(p).read(), re.M).group(1))
assert next(d for d in back if d["id"] == "pygmy")["chords"][18]["fields"] == [3, 4, 6, 104]
print("re-injected and re-parsed OK")
EOF
git diff --stat index.html
```

Expected: `re-injected and re-parsed OK`; the diff touches ONE line of `index.html`. If more than one line changes, the `json.dumps` formatting differs from the committed line: inspect `git diff index.html | head` and match the committed separators before continuing. The committed line is Python-default `json.dumps` output (`tools/regen_data_mutants.py:153` asserts exactly that), so default `ensure_ascii` and default separators are the right form.

- [ ] **Step 6: Validate, rebuild PDFs, run the Python suites**

Run: `python3 tools/validate.py && python3 tools/decks.py && python3 -m unittest discover -s tests -t . 2>&1 | tail -5`
Expected: validate prints four OK lines and 61 cards; all Python tests pass EXCEPT `tests/test_fixture_integrity.py` (the corpus still ships the old voicings and its `chord_counts`/sha tests read live decks vs fixture) if any of its tests compare voicings to live data. Note which fail; Task 5 fixes those.

- [ ] **Step 7: Confirm the JS gate state**

Run: `node --test tests/voicing.test.js 2>&1 | grep -E "^# (pass|fail)"`
Expected: still 2 failing (the two corpus-reproduction tests), because `golden_decks_v2.json` still carries the old voicings.

- [ ] **Step 8: Commit**

```bash
git add tests/test_deck_data.py tools/decks.py index.html *.pdf
git commit -m "data(pygmy): re-voice Fsus4, Fm11, Cm7, Eb, Eb7 under the trigger-aware rule

Bb and Db exist only on the bottom shell and no longer force the cluster;
the other tones read nearest-above. Cm7 badge 2 -> 1. LOW VOICING cards
unchanged. PDFs rebuilt. Owner decision 2026-09-15.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S24msyK6JGS18wpqWjZzJc"
```

### Task 5: Corpus v2 -> v3

**Files:**
- Rename: `tests/fixtures/golden_decks_v2.json` -> `tests/fixtures/golden_decks_v3.json`
- Modify: `tests/test_fixture_integrity.py:14,19-20,BUMP,test names`, `tests/core.test.js:19`, `tests/naming.test.js:32`, `tests/voicing.test.js:18`, `tests/select.test.js:34`, `tests/mutants/f_fixture_sha.patch`, any other `golden_decks_v2` reader (`grep -rn golden_decks_v2 tests tools docs CLAUDE.md`)

- [ ] **Step 1: Read the canonical hashing form**

Run: `sed -n 1,60p tests/test_fixture_integrity.py`
Copy the exact expression used to compute the digest (it hashes `{"version", "decks"}` with `sort_keys=True, separators=(",", ":")`; confirm before Step 3).

- [ ] **Step 2: Rename and patch the corpus from the live decks**

```bash
git mv tests/fixtures/golden_decks_v2.json tests/fixtures/golden_decks_v3.json
python3 - <<'EOF'
import json, hashlib, re
p = "tests/fixtures/golden_decks_v3.json"
doc = json.load(open(p))
html = open("index.html").read()
app = json.loads(re.search(r"^const DECKS = (\[.*\]);$", html, re.M).group(1))
live = {(d["id"], c["main"], c["sup"], c["subtitle"]): c["fields"]
        for d in app for c in d["chords"]}
changed = 0
for d in doc["decks"]:
    for c in d["chords"]:
        want = live[(d["id"], c["main"], c["sup"], c["subtitle"])]
        if c["fields"] != want:
            c["fields"] = want; changed += 1
assert changed == 5, changed
doc["version"] = 3
canon = json.dumps({"version": 3, "decks": doc["decks"]}, sort_keys=True, separators=(",", ":"))
doc["sha256"] = hashlib.sha256(canon.encode()).hexdigest()
json.dump(doc, open(p, "w"), indent=1, sort_keys=True)
open(p, "a").write("\n")
print(doc["sha256"])
EOF
git diff --stat tests/fixtures/
```

Expected: `changed == 5`; the diff of the renamed file touches only the five field lists, `version` and `sha256`. The committed file is `indent=1, sort_keys=True` with one trailing newline (verified 2026-09-15 against `tests/fixtures/golden_decks_v2.json`, 1222 lines), so the dump above reproduces it byte-for-byte outside the changed values.

- [ ] **Step 3: Point every reader at v3 and pin the new digest**

```bash
grep -rln "golden_decks_v2" tests | xargs sed -i '' 's/golden_decks_v2/golden_decks_v3/g'
grep -rn "golden_decks_v2" tests tools index.html CLAUDE.md docs/ENGINE-SPEC.md docs/SCALE_ENGINE_PLAN.md ; echo "(no hits above = good)"
```

The only readers outside `tests/` are this plan's own text (verified 2026-09-15: `grep -rln golden_decks_v2 tests tools docs CLAUDE.md` lists six test files plus this plan), and the plan keeps its `v2 -> v3` wording as history, so the sed is scoped to `tests` on purpose.

Then in `tests/test_fixture_integrity.py`: set `EXPECTED_SHA256` to the digest printed in Step 2 (split across the two string literals exactly as the file does), change the docstring "frozen 61-card corpus" only if the count changed (it did not), change `BUMP` to name `golden_decks_v4.json`, rename `test_sha256_is_the_pinned_v2_digest` -> `..._v3_digest` with its message "the v3 corpus digest changed", and `self.assertEqual(doc["version"], 3)`.

`tests/mutants/f_fixture_sha.patch` patches the fixture file: regenerate it after Step 4 by editing the sha field on a committed tree, `git diff > tests/mutants/f_fixture_sha.patch`, and re-adding the `# kills:` / `# suite:` header lines from the old file (CONTRACT rule 4).

- [ ] **Step 4: Run every corpus reader**

Run: `python3 -m unittest discover -s tests -t . 2>&1 | tail -3 && node --test tests/core.test.js tests/naming.test.js tests/voicing.test.js 2>&1 | grep -E "^# (pass|fail)"`
Expected: Python all pass; the three JS files all pass. In `tests/voicing.test.js` the corpus test still asserts diverged 10 / matched 51 and the pinned-root test 60/61 with only Fm9 diverging: both hold because the five re-voiced cards now match the engine and no exception was added or removed. If either count differs, STOP and report; do not edit the numbers.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/golden_decks_v3.json tests/test_fixture_integrity.py tests/core.test.js tests/naming.test.js tests/voicing.test.js tests/select.test.js tests/mutants/f_fixture_sha.patch
git commit -m "test(fixtures): bump the frozen corpus to v3 for the trigger-aware voicings

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S24msyK6JGS18wpqWjZzJc"
```

### Task 6: Divergence table keys

**Files:**
- Modify: `tests/fixtures/divergence_v1.json` (pygmy `missing`, `extra`, `overrides[Fm11].fields`)
- Test: `tests/select.test.js:527-560`

- [ ] **Step 1: Run the divergence tests and read the exact red**

Run: `node --test --test-name-pattern "divergence|diverge" tests/select.test.js 2>&1 | grep -E "^not ok|missing|extra|\+|\-" | head -40`
Expected red on pygmy: `missing` lists `Fm11 (5,2,3,4,6,104)` but the fixture now ships `Fm11 (5,7,8,9,6,104)`; `extra` lists `F7sus4 (5,104,3,4)`, `C7sus4 (3,5,1,104)`, `Ebsus4 (4,2,104)`, `Eb7sus4 (4,2,104,105)` but the engine now produces `F7sus4 (5,104,8,9)`, `C7sus4 (3,5,6,104)`, `Ebsus4 (4,7,104)`, `Eb7sus4 (4,7,104,105)`. Hijaz and Amara: no change. Copy the ACTUAL keys from the assertion output, not from this plan, if they differ.

- [ ] **Step 2: Edit the four `extra` keys and the `Fm11` key + override**

In `tests/fixtures/divergence_v1.json` under `decks.pygmy`:
- `missing`: `"Fm11 (5,2,3,4,6,104)"` -> `"Fm11 (5,7,8,9,6,104)"`
- `extra`: the four keys above to their new spellings
- `overrides`: the `Fm11` entry's `fields` -> `[5, 7, 8, 9, 6, 104]`; its `note` stays (the extended-tier reason is unchanged: Bb is bottom-shell-only, so the extended quality is not a candidate).

Nothing else moves: `Cm7 (101,103,1,104)`, `Eb (103,1,104)`, `Eb7 (103,1,104,105)` remain in `missing` (they are LOW VOICING alternates, untouched), and the engine's own `Cm7 (3,4,6,104)` / `Eb (4,6,104)` / `Eb7 (4,6,104,105)` / `Fsus4 (5,104,8)` now coincide with shipped cards, so they appear on neither side.

- [ ] **Step 3: Run the select suite**

Run: `node --test tests/select.test.js 2>&1 | grep -E "^# (pass|fail)"`
Expected: 35 pass, 0 fail. "every override is a built-in card the engine does not produce" still counts seven VOICING alternates.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/divergence_v1.json
git commit -m "test(select): move the divergence keys of the re-voiced Pygmy cards

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S24msyK6JGS18wpqWjZzJc"
```

### Task 7: Spec and CLAUDE.md

**Files:**
- Modify: `docs/ENGINE-SPEC.md:499-511` (three DECIDED(D2) bullets), `CLAUDE.md:83` and `CLAUDE.md:120-135`
- Modify: `docs/SCALE_ENGINE_PLAN.md:124` (the D2 row: add one sentence)

- [ ] **Step 1: Rewrite the section 6 bullets**

Replace the first bullet (`DECIDED(D2) The forced test is: ANY non-root tone ...`) with:

```markdown
- DECIDED(D2, owner 2026-09-15) The forced test is: ANY non-root tone of the
  chord - chord tones AND extensions alike - has no instance above the root
  AND its highest lower instance is on the TOP shell. A tone whose highest
  lower instance is on the BOTTOM shell takes that instance and forces
  nothing (on the built-in pans that is Pygmy Bb and Db, which exist only
  there; a pan with a top-shell instance below a bottom-shell one is covered
  by the same test, not by a "bottom-only" reading). That is the operative test, exactly as
  `tests/test_deck_data.py::test_forced_tones_cluster_below_root` implements
  it. Amara and Hijaz have no bottom shell, so the clause is vacuous there and
  the commercial reference's three forced cards (G5, Gsus4, Fmaj7) are
  preserved by construction, not by exception.
```

Replace the fourth bullet (`Bottom-shell fields are ordinary instances ...`) with:

```markdown
- DECIDED(D2, owner 2026-09-15) On a FORCED chord, bottom-shell fields are
  ordinary instances: a chord tone clusters to the bottom shell when that is
  its highest lower instance (Pygmy `Gm7b5` from G5 -> Bb3/U4, Db4/U5). On an
  UNFORCED chord a bottom-shell-only tone simply takes its bottom field while
  every other tone reads nearest-above (Pygmy `Cm7` -> C4 Eb4 G4 Bb3/U4).
```

Change the D11 bullet to: `... every non-root tone sits above the root and takes its NEAREST instance above the root, except a tone with no instance above, whose highest lower instance is then on the bottom shell and is the one it takes.`

- [ ] **Step 2: Rewrite CLAUDE.md**

Line 83: `not Bb/Db occurrences (Cm7 clusters Eb to U3, so it reads "2 BOTTOM NOTES").` -> `not Bb/Db occurrences (Cm7 is C4 Eb4 G4 Bb3, so it reads "1 BOTTOM NOTE"; Eb7 is Eb4 G4 Bb3 Db4, "2 BOTTOM NOTES").`

Rule 3, replace from `when ANY non-root` through `(Cm7 -> Eb3/U3). The` with:

```markdown
   when ANY non-root tone is only available below the root AND its highest
   lower instance is on the top shell, every CHORD TONE (3rd, 5th, 7th;
   the 4th of a sus chord; the 6th of a 6-chord) moves to its highest
   instance below the root, and one with no lower instance stays put.
   On such a forced card, EXTENSIONS implied by the chord symbol (add9, 9,
   b9; an 11 chord's 9th and 11th; a 13 chord's 9th, 11th and 13th; #11)
   keep their nearest instance ABOVE the root unless they are themselves
   forced. A tone whose highest lower instance is on the bottom shell (Pygmy Bb
   and Db exist only there) takes that field and forces NOTHING: Cm7 is C4 Eb4 G4 Bb3,
   not a cluster to Eb3/G3 (owner decision 2026-09-15). The
```

Add to the Provenance sentence: `The top-shell clause of the forced test is an OWNER DECISION (2026-09-15) that leaves every Amara and Hijaz card unchanged.`

- [ ] **Step 3: Amend the D2 row of `docs/SCALE_ENGINE_PLAN.md:124`**

Append to the Rationale cell: ` Amended 2026-09-15 (owner): the forced test gained a top-shell clause; five Pygmy cards were re-voiced (Fsus4, Fm11, Cm7, Eb, Eb7) and Amara/Hijaz are unchanged. See docs/plans/2026-09-15-trigger-aware-cluster-rule.md.`

- [ ] **Step 4: Confirm no stale wording remains**

Run: `grep -n "Eb3/U3\|2 BOTTOM NOTES\|Fm11 is forced\|its 11th forces" CLAUDE.md docs/ENGINE-SPEC.md tests/*.py tests/*.js tests/mutants/*.patch tools/*.py`
Expected: no hits outside `tests/mutants/` (those are re-cut in Task 8).

- [ ] **Step 5: Commit**

```bash
git add docs/ENGINE-SPEC.md CLAUDE.md docs/SCALE_ENGINE_PLAN.md
git commit -m "docs: record the trigger-aware D2 forced test (owner decision 2026-09-15)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S24msyK6JGS18wpqWjZzJc"
```

### Task 8: Mutants

**Files:**
- Create: `tests/mutants/v_bottom_forced_triggers_cluster.patch`
- Re-cut: `tests/mutants/v_forced_ignores_extensions.patch`, `tests/mutants/v_cluster_takes_lowest_below.patch`, `tests/mutants/b_cluster_forced_only.patch`
- Modify: `tools/regen_data_mutants.py:39-41` (add `card()`), `:114` (badge mutant anchor), `:126-136`
- Modify: `tests/suite_health.py:47` (`tests/voicing.test.js` 14 -> 15)

Precondition for every step below: `git status --short` prints nothing before the edit, so the `git checkout -- src/engine/voicing.js` that follows each `git diff` reverts only the mutation. All diff bodies are produced by editing the committed tree and running `git diff` (CONTRACT rule 4), then prepending the `# suite:` / `# kills:` lines. The `--test-name-pattern` is the test name with every non-alphanumeric run replaced by `.` and anchored `^...$`.

- [ ] **Step 1: New mutant, the top-shell clause dropped**

Edit `src/engine/voicing.js`: `if (!tones[t].up.length && tones[t].down[0].top) forced = true;` -> `if (!tones[t].up.length) forced = true;`. Then:

```bash
{ printf '%s\n' \
  '# suite: node --test --test-name-pattern ^D2.a.tone.forced.onto.the.bottom.shell.does.not.trigger.clustering$ tests/voicing.test.js' \
  '# kills: the top-shell clause of the D2 forced test (owner 2026-09-15). Here a' \
  '# bottom-shell-only tone forces the chord again, so Pygmy Cm7 clusters to' \
  '# Eb3/G3 instead of reading C4 Eb4 G4 Bb3.' ; git diff src/engine/voicing.js; } > tests/mutants/v_bottom_forced_triggers_cluster.patch
git checkout -- src/engine/voicing.js
```

- [ ] **Step 2: Re-cut `v_forced_ignores_extensions.patch`**

Edit: `if (!tones[t].up.length && tones[t].down[0].top) forced = true;` -> `if (tones[t].interval < OCTAVE && !tones[t].up.length && tones[t].down[0].top) forced = true;`. Header:

```
# suite: node --test --test-name-pattern ^D2.forced.chords.keep.their.extensions.above.the.root.unless.forced.too$ tests/voicing.test.js
# kills: the D2 forced test, which is over ANY non-root tone, chord tones AND
# extensions alike (ENGINE-SPEC section 6). Here it ignores extensions, so the
# five-field pan's Cadd9 - forced only by its 9th - stops clustering.
```

Generate with `git diff`, prepend, `git checkout -- src/engine/voicing.js`.

- [ ] **Step 3: Re-cut `v_cluster_takes_lowest_below.patch`**

Same mutation as today (`tone.down[0]` -> `tone.down[tone.down.length - 1]` in the `interval < OCTAVE` branch) regenerated against the new file so the hunk context matches; header unchanged except the last line: `# Here a clustered chord tone takes the LOWEST instance below the root, so Pygmy Gm7b5 from G5 takes F4 instead of F5.`

- [ ] **Step 4: Re-cut the data mutant `b_cluster_forced_only`**

The old mutation (Fsus4 -> `[5,104,8]`) is now the CORRECT voicing. Replace the entry in `tools/regen_data_mutants.py:126-136` with:

```python
    "b_cluster_forced_only": (
        ["# kills: test_forced_tones_cluster_below_root",
         "# suite: python3 -m unittest -k test_forced_tones_cluster_below_root tests.test_deck_data",
         "# Pygmy Cm7 put back to its pre-2026-09-15 cluster: Bb3 is bottom-shell-only",
         "# and forces nothing, yet Eb and G sit below the root at Eb3/G3. validate.py,",
         "# voicing uniqueness and the badge count (2, also wrong but asserted by a",
         "# different test) do not see it - only the cluster rule in CLAUDE.md rule 3",
         "# catches it."],
        [('("Cm", "7", "C MINOR 7", [3, 4, 6, 104], {3}),',
          '("Cm", "7", "C MINOR 7", [3, 103, 1, 104], {3}),')],
        lambda D: card(D, "pygmy", "C MINOR 7").update(fields=[3, 103, 1, 104]),
    ),
```

`chord()` at `tools/regen_data_mutants.py:39-41` matches on main/sup only and returns the FIRST hit, which for Pygmy `Cm7` is index 17, the LOW VOICING card (the normal card is index 18). Add this helper next to `chord()` and use it above; do not widen `chord()` (its other callers are unambiguous):

```python
def card(decks, deck_id, subtitle):
    d = next(x for x in decks if x["id"] == deck_id)
    return next(c for c in d["chords"] if c["subtitle"] == subtitle)
```

Also re-anchor `b_pygmy_badge_count` (`tools/regen_data_mutants.py:114`): its decks.py replacement is a textual `(old, new)` pair whose old string is `[5, 104, 3]`, which no longer exists after Task 4. Change the old string to `'("Fsus", "4", "SUSPENDED CHORD", [5, 104, 8], {5}),'`; the new string `[5, 6, 8]`, the lambda and the header stay (G4 + C5 above the root, badge 1 -> 0, still only the badge test sees it). Without this, `regen_data_mutants.py` fails on the unmatched replacement or leaves the patch anchored on a line that is no longer in `decks.py`.

- [ ] **Step 5: Regenerate the data mutants on a clean tree and run the mutation gate**

```bash
git add tests/mutants tools/regen_data_mutants.py
git commit -m "test(mutants): re-cut the D2 mutants for the trigger-aware rule

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01S24msyK6JGS18wpqWjZzJc"
python3 tools/regen_data_mutants.py && git status --short
```

If regen rewrote any `b_*.patch`, commit those too ("test(mutants): regenerate data mutants"). Then update `tests/suite_health.py` line 47 to `"tests/voicing.test.js": 15,` and commit.

Run: `./tests/mutation_check.sh`
Expected: every mutant kills its named test; specifically the four above. A mutant that survives means its test or diff is wrong; fix the mutant, never the test.

### Task 9: Full gate, PR, review

- [ ] **Step 1: The full gate**

Run: `python3 tools/validate.py && node tools/boot_sim.js && python3 -m unittest discover -s tests -t . && node --test tests/*.test.js && python3 tests/suite_health.py && ./tests/mutation_check.sh`
Expected: all green. `tests/test_pdf_build.py::test_committed_pdfs_match_a_fresh_build` passes because Task 4 rebuilt the PDFs after the data change.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin scale-engine/trigger-aware-cluster
gh pr create --title "Trigger-aware D2 cluster rule: bottom-shell-only tones force nothing" --body "$(cat <<'EOF'
Owner decision 2026-09-15. The D2 forced test gains a top-shell clause: a tone whose only lower instance is a bottom-shell field takes that field and forces nothing; all other tones read nearest-above.

- Amara and Hijaz: 0 cards change (no bottom shell; the commercial reference is preserved by construction).
- Pygmy: 5 shipped cards re-voiced - Fsus4 [5,104,8], Fm11 [5,7,8,9,6,104], Cm7 [3,4,6,104] (badge 2 -> 1), Eb [4,6,104], Eb7 [4,6,104,105]. LOW VOICING cards unchanged.
- Corpus v2 -> v3, divergence keys moved, PDFs rebuilt, four mutants re-cut, spec section 6 and CLAUDE.md rule 3 rewritten.

Plan: docs/plans/2026-09-15-trigger-aware-cluster-rule.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01S24msyK6JGS18wpqWjZzJc
EOF
)"
```

- [ ] **Step 3: Independent review at the verified head SHA, then merge**

Verify `gh pr view <n> --json state,headRefOid` matches `git rev-parse HEAD`. Spawn a fresh reviewer subagent (`OPENCLAW_SESSION=1` on every Bash call, read-and-report only) that checks out `git checkout -B review-tac <sha>` in its own worktree, runs `/review`, and reads CI's conclusion for that SHA. On PASS and green CI: `gh pr merge <n> --merge` (no `--delete-branch`). Then remove the worktree.

---

## Part B: root-instance enumeration (separate plan, gated on Part A)

Not implemented by this plan. Recorded here so the engineering review can judge Part A against where it leads.

**What was measured (this session, scratch `gen2_base.js` / `gen2.js`):** generating one card per root-field instance with `choose(fields, rootPc, ivs, {rootId})` reproduces, under the CURRENT rule, hijaz 18/18, amara 16/16, pygmy 26/27 (only `Fm9`'s hand-set spread 9th G5 is missing), i.e. all six hand-authored Pygmy alternates and the Hijaz `Bm` HIGH VOICING fall out of the engine. It over-generates: pygmy 51 candidates vs 27 shipped, hijaz 23 vs 18, amara 23 vs 16. Under the trigger-aware rule with Part A's data it should reproduce 60/61 (verify: the pinned-root test in `tests/voicing.test.js` is exactly this measurement).

**Decisions the Part B plan must take to the owner before it is written:**
1. Ranking and cap: which root instances survive (e.g. keep the D9 root instance always; add another instance only when it changes register class, e.g. at least one tone crosses the ding octave or the bottom shell; cap per (name) at 2 or 3).
2. Subtitles: generated alternates need the `- HIGH VOICING` / `- LOW VOICING` suffix rule made precise (relative to the D9 card's root midi).
3. Whether enumeration applies to built-in decks (would retire the seven "opt-in data" overrides in `divergence_v1.json`) or only to generated decks.
4. Spec section 7's "multi-voicing is opt-in data" bullet is rewritten either way.

**Hook point:** `src/engine/select.js:239-262 voice()`, which today calls `choose(fields, root, intervals)` once per candidate and dedupes by `fields.join(",")`.

---

## Self-review

- Spec coverage: owner decision 1 (Cm7 voicing) -> Task 2 Step 3 + Task 4; decision 2 (Amara exact, no exception) -> Task 2 Step 3's amara/hijaz loop, Task 3 Step 4's STOP, Task 7 wording; decision 3 -> Part B. Every file in the footprint of the previous data-change commit `f7137f8` is covered except `tests/app.test.js`, `tools/boot_sim.js`, `tests/test_print.py`, `tests/test_render_agreement.py`, `tests/test_gen_deck.py`, `tools/hifi.py` - those pinned CARD COUNTS, which do not change here (61 stays 61).
- Placeholder scan: none; every code step carries the code. Two measured values the executor must copy from tool output rather than this plan: the v3 sha256 (Task 5) and the exact divergence keys (Task 6) - the plan states the expected values and says to STOP if they differ in deck rather than spelling.
- Type consistency: `choose(fields, rootPc, intervals, {rootId})` is used identically in Tasks 2, 3 and Part B; `tone.down[0]` is the highest lower instance in Tasks 3 and 8 (matches `below()` sorting descending).
- Known out-of-scope oddity, NOT touched: `tools/decks.py:124` blurb still says `25 CHORDS` although Pygmy ships 27; report to the owner, do not fix in this PR.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 3 | CLEAR (PLAN) 2026-09-15 | 11 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | stale (2026-09-11, different plan) | n/a: no UI change |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

Eng review findings (all folded into the plan text above, 2026-09-15):

1. [HIGH] `tools/regen_data_mutants.py:114` `b_pygmy_badge_count` anchors on Fsus4 `[5, 104, 3]`, which Task 4 removes. Re-anchored to `[5, 104, 8]` (Task 8 Step 4).
2. [HIGH] `tools/regen_data_mutants.py:39-41` `chord()` returns the LOW VOICING Cm7 (index 17) first. Task 8 adds a subtitle-keyed `card()` for `b_cluster_forced_only`.
3. [MEDIUM] Plan untracked on main; the worktree from `origin/main` would not carry it and the PR body links it. Task 1 now copies and commits it first.
4. [MEDIUM] Corpus rename sed spanned `docs`, which would rewrite this plan's own `v2 -> v3` history. Scoped to `tests` (the only non-plan readers, verified).
5. [MEDIUM] Rule prose said "bottom-shell-only tone"; the implemented invariant is "highest lower instance is on the bottom shell". Spec, CLAUDE.md and header-comment text now state the operative test.
6. [LOW] Python oracle used `self._deck` hidden state; `zone` is now an explicit parameter of `_check_cluster`.
7. [LOW] Task 2 red-phase expectation said "3 failing" then hedged; now: exactly the new test is red, the two rewritten tests must pass today or STOP.
8. [LOW] Fixture dump format hedge replaced by the verified fact (`indent=1, sort_keys=True`, 1222 lines).
9. [LOW] Pygmy engine-vocabulary impact count 8 -> 9 (Ebsus4 and Eb7sus4 are two cards).
10. [LOW] Task 8 `git checkout <file>` now `git checkout -- <file>` with a clean-tree precondition.
11. [INFO] Scope: the plan touches 17 files, above the 8-file complexity threshold. Accepted as-is: every file is a consequence of one deck-data change (same footprint as commit `f7137f8`), not extra scope.

Outside voice (Codex, gpt-5.5, high reasoning): 12 findings; 3 to 10 above are the ones adopted after independent verification. Declined: "commit mutants once, not twice" (regeneration needs a committed tree, so the split matches the repo's established pattern at `58b0f02`/`39ea002`); "Claude trailers pollute commits" (owner's attribution instruction); "run select.test.js right after the engine change" (Task 3 Step 4 already does).

Decisions auto-resolved under the owner's standing AFK grant ("permission granted to follow your recommendations"): D1 proceed with the 17-file footprint; D2 to D10 apply the fixes above. Not auto-resolved: executing Part A (deck-data change) still needs the owner's explicit go.

Test coverage: `~/.gstack/projects/raywu-handpan-cards/ray-main-eng-review-test-plan-20260915-160434.md`.

NOT in scope: Part B root-instance enumeration (TODOS.md), the `25 CHORDS` blurb at `tools/decks.py:124` (TODOS.md), any Amara/Hijaz voicing, diagram geometry, the visual system.

Worktree parallelization: none. Every task commits on the previous one (engine -> data -> corpus -> divergence -> docs -> mutants); one lane, sequential.

Failure modes: (a) an Amara or Hijaz card named in Task 3 Step 4 means the predicate is wrong: STOP. (b) `regen_data_mutants.py` failing on an unmatched replacement means a mutant anchor was missed: grep `tools/regen_data_mutants.py` for every old tuple. (c) A surviving mutant in `mutation_check.sh` means the mutant, never the test, is wrong. 0 critical gaps.

**VERDICT:** ENG CLEARED — ready to implement once the owner gives the explicit go for the deck-data change.

NO UNRESOLVED DECISIONS
