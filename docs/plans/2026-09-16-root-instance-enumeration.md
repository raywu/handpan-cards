# Part B: root-instance enumeration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `select.build` emits one card per playable ROOT-FIELD INSTANCE of a chord, ranked and capped, so multi-register voicings are DERIVED by the engine instead of hand-authored as opt-in deck data.

**Architecture:** `voice()` in `src/engine/select.js` calls `voicing.choose(fields, rootPc, ivs, {rootId})` once per root instance instead of once per candidate, classifies the results as HOME / LOW / HIGH against the home rule, drops alternates that do not earn their place, and caps at 3 per chord name. The deck cap moves from counting cards to counting chord NAMES so alternates cannot evict real chords. `naming.subtitle` grows a voicing-class argument.

**Tech Stack:** vanilla ES5 engine modules under `src/engine/`, node:test, python unittest, reportlab print pipeline.

**Spec:** `docs/SCALE_ENGINE_PLAN.md` section 7; owner decisions in `docs/plans/2026-09-15-trigger-aware-cluster-rule.md` Part B, extended by D1-D4 below.

---

## Owner decisions this plan implements

From the 2026-09-16 interview (recorded in the Part A plan's Part B section):

1. Built-in decks are in scope as an ORACLE. Amara must stay exactly as it is.
2. Home card = the one rooted on the LOWEST NON-BOTTOM-SHELL instance. No suffix. Roots below get `- LOW VOICING`, roots above get `- HIGH VOICING`.
3. An alternate survives only if (a) at least one NON-ROOT tone changes field AND (b) it changes register class (crosses the ding octave, or moves on/off the bottom shell). Cap 3 per chord name.
4. Hijaz `Bm - HIGH VOICING` is deleted.
5. Spec section 7's "multi-voicing is opt-in data" becomes "multi-voicing is DERIVED".

From the 2026-09-16 engineering review, measured before answering:

- **D1 - the deck cap counts chord NAMES, not cards.** Measured: applying decision 3 inside `select.build`'s own pipeline takes Pygmy from 31 cards to 52 against a cap of 31 (`src/engine/select.js:109`). Counting cards would evict 21 entries from the tail of the rank order, which is whole chord names, not surplus alternates.
- **D2 - the Amara gate is kept but restated, and a positive gate is added.** Measured: the rule produces ZERO alternates on Amara, which is why it passes 16/16. The assertion that carries weight is "no alternates on a pan with no repeated roots", plus a card-by-card check that every hand-authored multi-voicing card in Pygmy IS reproduced. That second test fails for the rejected disjoint-fields variant; the Amara-only gate passes it.
- **D3 - scope is SPLIT.** This plan ships enumeration only. It does NOT regenerate built-in deck data. Adopting engine output for Hijaz and Pygmy deletes eight hand-authored cards for reasons unrelated to this feature (Hijaz `Dmaj7`, `Dmaj7#11`; Pygmy `Fm11`, `Abmaj9`, and Fm9's spread 9th G5) and adds 34, so it gets its own plan and its own printed proof.
- **D4 - when the root pitch class exists ONLY on the bottom shell, home is the HIGHEST bottom instance** and lower ones are LOW VOICING. Measured: the naive "lowest overall" fallback demotes Pygmy's shipped `Db [105,5,7]` to a HIGH VOICING and invents a new home card. D4 leaves `Db` and `Dbmaj7` exactly as shipped.

## Non-goals

- **No deck data change.** `tools/decks.py` and the `DECKS` blob in `index.html` are untouched. No PDF rebuild, no JSON re-injection, no `regen_data_mutants.py` run.
- **Decision 4 (delete `Bm - HIGH VOICING`) is NOT executed here.** It is a one-card deck-data change that would drag the whole print pipeline into an engine-only PR. It rides with the adoption plan, where the pipeline runs anyway. It is not reversed, only sequenced.
- **The override mechanism is not deleted.** Decision 5's spec rewrite lands; the `overrides` array in `divergence_v1.json` survives for the cards the engine structurally cannot express, until the adoption plan decides about them.
- No change to the trigger-aware cluster rule itself. `choose()` already accepts `opts.rootId` (Part A, PR 67).

## Global Constraints

- Engine regions in `index.html` are GENERATED. Edit `src/engine/<name>.js`, then run `python3 tools/inline_engine.py`. Never hand-edit inside a region.
- `index.html` stays a single file with no `<script src>`.
- Do not alter deck data or diagram geometry.
- ES5 only in `src/engine/*.js`: `var`, no arrow functions, no `const`/`let`, no template literals.
- Every task ends green: `node --test "tests/*.test.js"` and `python3 -m unittest discover tests` both pass before the commit.
- Commits end with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` then `Claude-Session: https://claude.ai/code/session_01S24msyK6JGS18wpqWjZzJc`.

## Data flow

```
                       select.build(seed)
                              |
                      candidates(fields)          one entry per (root pc, quality)
                              |
                      collapse(...)               duplicate pitch sets merged
                              |
              +---------------v-----------------+
              |  voice(fields, list)   CHANGED  |
              |                                 |
              |  for each candidate:            |
              |    rootIds = playable fields    |
              |              of the root pc,    |
              |              ascending by midi  |
              |    for each rootId:             |
              |      choose(.., {rootId})       |
              |      dedupe on fields.join(",") |
              |                                 |
              |    home  = lowest NON-bottom    |  D4: if none, HIGHEST bottom
              |    keep  = [home] + alternates  |
              |            passing the filter   |  decision 3
              |            capped at 3          |
              |    class = HOME | LOW | HIGH    |  by root midi vs home root midi
              +---------------v-----------------+
                              |
              +---------------v-----------------+
              |  rank(fields, list, tonicPc)     |
              |                        CHANGED   |
              |  score each NAME GROUP once by   |
              |  its HOME card's keys; inside a  |
              |  group order HOME, LOW, HIGH     |
              +---------------v-----------------+
                              |
              +---------------v-----------------+
              |  name-aware trim       CHANGED  |
              |  keep the first cap(fields)     |
              |  DISTINCT chord names in rank   |  D1
              |  order; alternates ride free    |
              +---------------v-----------------+
                              |
                      order(list, tonicPc)         unchanged
                              |
                      card(fields, candidate)      subtitle gains the class
```

The register-class predicate, stated once so three tests can quote it:

```
registerClass(candidate) = ( usesBottomShell , floor((lowestMidi - dingMidi) / 12) )

alternate survives  <=>  nonRootFields(candidate) != nonRootFields(home)
                    AND  registerClass(candidate) != registerClass(home)
```

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/engine/select.js` | `voice()` enumerates root instances, classifies, filters, caps per name; `rank()` scores by name group; the deck cap counts names | MODIFY |
| `src/engine/naming.js` | `subtitle()` takes a voicing class and appends ` - LOW VOICING` / ` - HIGH VOICING` | MODIFY |
| `index.html` | regenerated engine regions | GENERATED, commit what the tool writes |
| `tests/select.test.js` | enumeration, home rule, filter, per-name cap, deck cap by name, divergence table | MODIFY |
| `tests/voicing.test.js` | the positive multi-voicing gate (D2) | MODIFY |
| `tests/naming.test.js` | subtitle class suffixes and the length ceiling | MODIFY |
| `tests/fixtures/divergence_v1.json` | regenerated: `missing` shrinks, `extra` grows | MODIFY |
| `docs/SCALE_ENGINE_PLAN.md` | section 7 rewrite (decision 5) | MODIFY |
| `CLAUDE.md` | multi-voicing is derived, not data | MODIFY |
| `tests/mutants/*.patch` | re-anchor engine mutants that quote changed lines | MODIFY |

---

### Task 1: Worktree and branch

**Files:** none.

- [ ] **Step 1: Create the worktree**

```bash
cd /Users/ray/Projects/handpan-cards
git fetch origin
git worktree add -b feat/root-instance-enumeration ../hc-partb origin/main
cd ../hc-partb
```

- [ ] **Step 2: Confirm the suite is green on the base commit**

Run: `node --test "tests/*.test.js" && python3 -m unittest discover tests`
Expected: PASS, both.

---

### Task 2: `naming.subtitle` takes a voicing class (RED then GREEN)

**Files:**
- Modify: `src/engine/naming.js:166-183`
- Test: `tests/naming.test.js`

**Interfaces:**
- Produces: `subtitle(rootName, suffix, equivRootName, voicingClass)` where `voicingClass` is `""`, `"LOW"` or `"HIGH"`. Absent or `""` means the home card and the output is byte-identical to today.

- [ ] **Step 1: Write the failing tests**

```js
test("subtitle appends the voicing class", () => {
  assert.equal(naming.subtitle("C", "m", null, ""), "C MINOR");
  assert.equal(naming.subtitle("C", "m", null, "LOW"), "C MINOR - LOW VOICING");
  assert.equal(naming.subtitle("C", "m", null, "HIGH"), "C MINOR - HIGH VOICING");
});

test("the voicing class is appended AFTER the equivalence suffix", () => {
  assert.equal(naming.subtitle("C", "m7", "Eb", "HIGH"),
    "C MINOR 7 ( = Eb6 ) - HIGH VOICING");
});

test("an unknown voicing class throws", () => {
  assert.throws(() => naming.subtitle("C", "m", null, "MIDDLE"), /voicing class/);
});

test("the voicing class ceiling test does not throw at the worst case", () => {
  // naming.CAPS.subtitle is SUBTITLE_MAX, read at runtime rather than
  // restated as a literal - a cap change should not need this test rewritten.
  const cap = naming().CAPS.subtitle;
  const out = naming.subtitle("Bb", "m7b5", "Bb", "HIGH");
  assert.equal(out, "HALF-DIMINISHED ( = Bbm6 ) - HIGH VOICING");
  assert.equal(out.length, 41);
  assert.ok(out.length <= cap, `subtitle ${out.length} chars: ${out}`);
});
```

**Correction (2026-09-16 ruling):** the original ceiling test asserted
`out.length <= 64` on `naming.subtitle("Db","m7b5","E","HIGH")`, which is 40
chars - but at the OLD cap of 26 `subtitle` throws a RangeError before
returning, so the assertion was unreachable. Read the cap out of
`naming().CAPS.subtitle` rather than a literal, and assert that the real
41-char worst case (`subtitle("Bb","m7b5","Bb","HIGH")`, which produces
`HALF-DIMINISHED ( = Bbm6 ) - HIGH VOICING`) does NOT throw and fits inside
the cap.

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/naming.test.js`
Expected: FAIL, the class argument is ignored.

- [ ] **Step 3: Implement**

```js
  var VOICING_CLASSES = {"": "", LOW: " - LOW VOICING", HIGH: " - HIGH VOICING"};

  function subtitle(rootName, suffix, equivRootName, voicingClass) {
    var q = quality(suffix);
    var out = q.rooted ? rootName + " " + q.display : q.display;
    if (equivRootName !== undefined && equivRootName !== null && equivRootName !== "") {
      if (suffix === "m7") {
        out += " ( = " + equivRootName + "6 )";
      } else if (suffix === "m7b5") {
        out += " ( = " + equivRootName + "m6 )";
      } else {
        throw new Error("naming: no equivalence for quality " + JSON.stringify(suffix));
      }
    }
    var cls = (voicingClass === undefined || voicingClass === null) ? "" : voicingClass;
    if (!Object.prototype.hasOwnProperty.call(VOICING_CLASSES, cls)) {
      throw new Error("naming: unknown voicing class " + JSON.stringify(cls));
    }
    out += VOICING_CLASSES[cls];
    if (out.length > SUBTITLE_MAX) {
      throw new RangeError("naming: subtitle over " + SUBTITLE_MAX +
        " characters: " + out);
    }
    return out;
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/naming.test.js`
Expected: PASS.

- [ ] **Step 5: Sync and commit**

```bash
python3 tools/inline_engine.py
git add src/engine/naming.js tests/naming.test.js index.html
git commit
```

**Watch:** if the ceiling assertion fails for a real deck, that is a finding, not a
test to loosen. Report it; `- LOW VOICING` is 14 characters and the shipped Pygmy
subtitles are already long.

---

### Task 3: Enumerate root instances in `voice()` (RED)

**Files:**
- Test: `tests/select.test.js`

**Interfaces:**
- Consumes: `voicing.choose(fields, rootPc, intervals, {rootId})` from Part A.
- Produces: each entry in `voice()`'s output gains `voicingClass` (`""`/`"LOW"`/`"HIGH"`) and `rootId` (the pinned root field id). `card()` passes `voicingClass` through to `naming.subtitle`.

- [ ] **Step 1: Write the failing tests**

```js
// Pygmy C has three playable instances: C3 (id 101, bottom), C4 (id 1, rim),
// C5 (id 8, rim). Home is the lowest NON-bottom instance, C4.
test("a repeated root yields one card per surviving instance", () => {
  const deck = built(PYGMY_SEED);
  const cm = deck.chords.filter((c) => c.main + c.sup === "Cm");
  assert.equal(cm.length, 3, "Cm ships low, home and high");
  const classes = cm.map((c) => voicingClassOf(c.subtitle)).sort();
  assert.deepEqual(classes, ["", "HIGH", "LOW"]);
});

test("the home card is rooted on the lowest non-bottom instance", () => {
  const deck = built(PYGMY_SEED);
  const home = deck.chords.find(
    (c) => c.main + c.sup === "Cm" && voicingClassOf(c.subtitle) === "");
  assert.equal(midiOf(deck, home.roots[0]), 60, "home Cm roots on C4");
});

test("LOW roots below the home root, HIGH roots above it", () => {
  const deck = built(PYGMY_SEED);
  const byClass = {};
  for (const c of deck.chords.filter((c) => c.main + c.sup === "Cm")) {
    byClass[voicingClassOf(c.subtitle)] = midiOf(deck, c.roots[0]);
  }
  assert.ok(byClass.LOW < byClass[""], "LOW is below home");
  assert.ok(byClass.HIGH > byClass[""], "HIGH is above home");
});

// D4: Pygmy Db exists only as Db3 (id 102) and Db4 (id 105), both bottom shell.
test("a bottom-only root takes its HIGHEST instance as home", () => {
  const deck = built(PYGMY_SEED);
  const db = deck.chords.filter((c) => c.main + c.sup === "Db");
  const home = db.find((c) => voicingClassOf(c.subtitle) === "");
  assert.equal(home.roots[0], 105, "home Db roots on Db4, the higher bottom note");
  assert.ok(db.some((c) => voicingClassOf(c.subtitle) === "LOW"),
    "Db3 survives as the LOW voicing");
});

test("every card's roots[0] is a field of its own root pitch class", () => {
  for (const seed of ALL_SEEDS) {
    const deck = built(seed);
    for (const c of deck.chords) {
      assert.equal(c.fields[0], c.roots[0],
        `${seed}: ${c.main}${c.sup} spelling order still starts at the root`);
    }
  }
});
```

`voicingClassOf` and `midiOf` are local helpers: parse the trailing
` - LOW VOICING` / ` - HIGH VOICING` off the subtitle, and read
`deck.fields[String(id)][2]`. Define them once at the top of the file next to the
existing `keyOf`.

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/select.test.js`
Expected: FAIL. `Cm` yields one card today.

- [ ] **Step 3: Commit the red tests**

```bash
git add tests/select.test.js
git commit
```

---

### Task 4: Implement enumeration, the home rule and the filter (GREEN for Task 3)

**Files:**
- Modify: `src/engine/select.js:238-262` (`voice`), and `card()` at `:344`

- [ ] **Step 1: Implement**

```js
  // Section 7: a chord is voiced once per playable ROOT-FIELD INSTANCE, not
  // once per root pitch class. The HOME card is rooted on the lowest instance
  // that is NOT on the bottom shell; when the pitch class lives only on the
  // bottom shell (Pygmy Db), the HIGHEST bottom instance is home instead
  // (owner decision D4, 2026-09-16) - the naive "lowest wins" fallback
  // demotes the shipped Db card and invents a new one.
  //
  // An alternate earns its card only when a NON-ROOT tone moves field AND the
  // register class changes. A candidate where only the root moves is the shape
  // the commercial Amara reference omits five times over, so reproducing Amara
  // exactly and keeping those are not simultaneously satisfiable (decision 3).
  var ALTERNATE_CAP = 3;                /* cards per chord name */

  function registerClass(fields, ding, candidateFields) {
    var bottom = 0;
    var lowest = null;
    for (var i = 0; i < candidateFields.length; i += 1) {
      var record = fields[String(candidateFields[i])];
      if (record[3] === "bottom") bottom = 1;
      if (lowest === null || record[2] < lowest) lowest = record[2];
    }
    return bottom + "|" + Math.floor((lowest - dingMidi) / 12);
  }

  function rootInstances(fields, rootPc) {
    var list = [];
    var all = ids(fields);
    for (var i = 0; i < all.length; i += 1) {
      var record = fields[String(all[i])];
      if (record[3] === "ding") continue;
      if (pc(record[2]) === pc(rootPc)) list.push(all[i]);
    }
    list.sort(function (a, b) {
      return fields[String(a)][2] - fields[String(b)][2];
    });
    return list;
  }

  function homeIndex(fields, instances) {
    for (var i = 0; i < instances.length; i += 1) {
      if (fields[String(instances[i])][3] !== "bottom") return i;
    }
    return instances.length - 1;        /* D4: bottom-only, highest wins */
  }

  function dingMidi(fields) {
    var all = ids(fields);
    for (var i = 0; i < all.length; i += 1) {
      if (fields[all[i]][3] === "ding") return fields[all[i]][2];
    }
    throw new Error("select: deck has no ding field");
  }

  function voice(fields, list) {
    var out = [];
    var seen = {};
    var ding = dingMidi(fields);
    for (var i = 0; i < list.length; i += 1) {
      var candidate = list[i];
      var instances = rootInstances(fields, candidate.root);
      var picked = [];
      for (var r = 0; r < instances.length; r += 1) {
        var got = voicing().choose(fields, candidate.root, candidate.intervals,
          {rootId: instances[r]});
        if (!got.ok) continue;
        picked.push({rootId: instances[r], value: got.value});
      }
      // No dedupe pass here: the root field leads every voicing and differs
      // per instance, so two instances can never produce the same fields key.
      if (!picked.length) continue;

      var homeAt = homeIndex(fields, picked.map(function (p) { return p.rootId; }));
      var home = picked[homeAt];
      var homeTones = home.value.fields.slice(1).join(",");
      var homeClass = registerClass(fields, ding, home.value.fields);
      var kept = [home];
      for (r = 0; r < picked.length; r += 1) {
        if (picked[r] === home) continue;
        if (kept.length >= ALTERNATE_CAP) break;
        if (picked[r].value.fields.slice(1).join(",") === homeTones) continue;
        if (registerClass(fields, ding, picked[r].value.fields) === homeClass) continue;
        kept.push(picked[r]);
      }

      for (r = 0; r < kept.length; r += 1) {
        var key = kept[r].value.fields.join(",");
        if (seen[key]) continue;        /* section 5: one fields list per deck */
        seen[key] = true;
        var rootMidi = fields[String(kept[r].rootId)][2];
        var homeMidi = fields[String(home.rootId)][2];
        out.push({
          root: candidate.root,
          rootId: kept[r].rootId,
          voicingClass: rootMidi === homeMidi ? ""
            : (rootMidi < homeMidi ? "LOW" : "HIGH"),
          suffix: candidate.suffix,
          tier: candidate.tier,
          rank: candidate.rank,
          intervals: candidate.intervals,
          fields: kept[r].value.fields.slice(),
          roots: kept[r].value.roots.slice()
        });
      }
    }
    return out;
  }
```

`homeIndex` is passed the ids in the order `picked` holds them, which is ascending
by midi because `rootInstances` sorted them and `choose` failures only remove
entries. Do not re-sort inside `homeIndex`.

Then in `card()`:

```js
    var subtitle = naming().subtitle(rootName, candidate.suffix,
      equivalenceRoot(fields, candidate), candidate.voicingClass);
```

- [ ] **Step 2: Run to verify pass**

Run: `node --test tests/select.test.js`
Expected: PASS for Task 3's tests. The divergence-table tests WILL fail - that is
Task 7's job, leave them red for now and say so in the commit message.

- [ ] **Step 3: Commit**

```bash
python3 tools/inline_engine.py
git add src/engine/select.js index.html
git commit
```

---

### Task 5: Rank by name group, then cap by name (D1)

**Files:**
- Modify: `src/engine/select.js:278-297` (`rank`) and `:424-427` (`build`)
- Test: `tests/select.test.js`

`rank`'s second key is the top-shell tone count, DESCENDING:

```js
    if (a.top !== b.top) return b.top - a.top;
```

Pygmy's `Cm7` home is `[1,3,5,104]` - one bottom field, 3 top-shell tones - and
its HIGH voicing is all top shell, 4 tones. The ALTERNATE therefore sorts ahead
of its own home card. Left alone, a cap boundary falling between them prints
`Cm7 - HIGH VOICING` with no plain `Cm7`, and alternates scatter across the deck
order, which is wrong for a physical deck of cards regardless of the cap.

So ranking scores each NAME GROUP once, using its home card's keys, and orders
within a group HOME, LOW, HIGH. Groups are then contiguous and home-first, and
the cap admits or cuts a whole name.

- [ ] **Step 1: Write the failing tests**

```js
test("a chord's cards are contiguous, home first", () => {
  for (const seed of ALL_SEEDS) {
    const deck = built(seed);
    const seen = new Map();
    let prev = null;
    deck.chords.forEach((c, i) => {
      const n = c.main + c.sup;
      if (n !== prev && seen.has(n)) {
        assert.fail(`${seed}: ${n} is split across the deck at index ${i}`);
      }
      if (n !== prev) {
        assert.equal(voicingClassOf(c.subtitle), "",
          `${seed}: ${n} leads with an alternate, not its home card`);
        seen.set(n, i);
      }
      prev = n;
    });
  }
});

test("the deck cap counts chord NAMES, so alternates cannot evict a chord", () => {
  const deck = built(PYGMY_SEED);
  const names = new Set(deck.chords.map((c) => c.main + c.sup));
  assert.ok(names.size <= capOf(deck), "distinct names stay inside the cap");
  assert.ok(deck.chords.length > names.size,
    "Pygmy does carry alternates, so this test is not vacuous");
});

test("no chord name is half-present after the trim", () => {
  for (const seed of ALL_SEEDS) {
    const deck = built(seed);
    const byName = new Map();
    for (const c of deck.chords) {
      const n = c.main + c.sup;
      byName.set(n, (byName.get(n) || 0) + 1);
    }
    for (const [n, count] of byName) {
      assert.ok(count >= 1 && count <= 3, `${seed}: ${n} has ${count} cards`);
    }
  }
});
```

`capOf(deck)` recomputes `25 + max(0, fieldCount - 12)` from `deck.fields`.

- [ ] **Step 2: Write the overflow test - the only place the cap actually fires**

**None of the three built-ins ever trims.** Pygmy has 18 fields, so its cap is
31, and it produces exactly 31 names; Amara is 25/25 and Hijaz 19/25. Every
assertion in Step 1 passes without one card being cut, so D1's mechanism would
otherwise ship with zero coverage. The test that exercises it needs a generated
deck whose name count exceeds its own cap.

```js
// Find a synthetic scale that overflows its cap, so the trim is observed doing
// its job rather than being a no-op on every built-in.
const OVERFLOW = SYNTHETIC.map((s) => ({s, deck: built(s.string)}))
  .find((x) => x.deck &&
    new Set(x.deck.chords.map((c) => c.main + c.sup)).size === capOf(x.deck) &&
    untrimmedNameCount(x.s.string) > capOf(x.deck));

test("a deck that overflows its cap loses whole names, never half a name", () => {
  assert.ok(OVERFLOW, "no synthetic scale overflows its cap - pick a denser one");
  const {deck} = OVERFLOW;
  const names = new Set(deck.chords.map((c) => c.main + c.sup));
  assert.equal(names.size, capOf(deck), "the trim stops exactly at the cap");
  for (const c of deck.chords) {
    assert.ok(names.has(c.main + c.sup));
  }
  const homes = deck.chords.filter((c) => voicingClassOf(c.subtitle) === "");
  assert.equal(homes.length, names.size,
    "every surviving name kept its home card, not just an alternate");
});
```

`untrimmedNameCount(seed)` counts distinct `root|suffix` pairs before the trim -
expose it from the test helper by calling `build` with the cap lifted, or count
`candidates`+`collapse` output directly. `SYNTHETIC` is
`tests/fixtures/synthetic_scales.json`, already loaded by `tests/layout.test.js`.

**If no synthetic scale overflows, do not weaken the test** - report it, and the
fixture gains a denser scale under a separate decision.

- [ ] **Step 3: Run to verify failure**

Run: `node --test tests/select.test.js`
Expected: FAIL on contiguity (rank interleaves) and on the overflow test (the
slice cuts cards, not names).

- [ ] **Step 4: Implement group ranking**

Replace `rank`'s body:

```js
  // A chord's cards rank as ONE GROUP, scored by the HOME card, and print
  // HOME, LOW, HIGH inside the group. Ranking cards individually puts an
  // all-top-shell HIGH voicing AHEAD of a home card that dips to the bottom
  // shell (the second key is the top-shell tone count, descending), which both
  // scatters a chord across the deck and lets the cap keep an alternate whose
  // home card was cut.
  var CLASS_ORDER = {"": 0, LOW: 1, HIGH: 2};

  function rank(fields, list, tonicPc) {
    var groups = {};
    var order = [];
    for (var i = 0; i < list.length; i += 1) {
      var name = list[i].root + "|" + list[i].suffix;
      if (!Object.prototype.hasOwnProperty.call(groups, name)) {
        groups[name] = [];
        order.push(name);
      }
      groups[name].push({item: list[i], at: i});
    }
    var decorated = [];
    for (i = 0; i < order.length; i += 1) {
      var members = groups[order[i]];
      var home = members[0];
      for (var m = 0; m < members.length; m += 1) {
        if (members[m].item.voicingClass === "") home = members[m];
      }
      members.sort(function (a, b) {
        var ca = CLASS_ORDER[a.item.voicingClass];
        var cb = CLASS_ORDER[b.item.voicingClass];
        if (ca !== cb) return ca - cb;
        return a.at - b.at;
      });
      decorated.push({
        members: members,
        at: home.at,
        top: topShellTones(fields, home.item),
        item: home.item
      });
    }
    decorated.sort(function (a, b) {
      var tierA = TIERS.indexOf(a.item.tier);
      var tierB = TIERS.indexOf(b.item.tier);
      if (tierA !== tierB) return tierA - tierB;
      if (a.top !== b.top) return b.top - a.top;
      var degreeA = pc(a.item.root - tonicPc);
      var degreeB = pc(b.item.root - tonicPc);
      if (degreeA !== degreeB) return degreeA - degreeB;
      if (a.item.rank !== b.item.rank) return a.item.rank - b.item.rank;
      return a.at - b.at;
    });
    var out = [];
    for (i = 0; i < decorated.length; i += 1) {
      var group = decorated[i].members;
      for (var g = 0; g < group.length; g += 1) out.push(group[g].item);
    }
    return out;
  }
```

Every sort key except the grouping is byte-identical to today's, so a deck with
no alternates ranks exactly as it ranks now. That is what keeps Amara fixed.

- [ ] **Step 5: Implement the name-aware trim**

Replace the slice in `build`:

```js
    var limit = cap(fields);
    list = trimToNames(list, limit);
```

with, next to `cap`:

```js
  // D1 (2026-09-16): the cap bounds how many CHORDS a player has to learn, not
  // how many cards the deck prints. Counting cards lets a chord's own
  // alternates evict a different chord from the tail of the rank order - on
  // Pygmy that is 21 entries. Alternates ride along with their name for free.
  function trimToNames(list, limit) {
    var seen = {};
    var count = 0;
    var out = [];
    for (var i = 0; i < list.length; i += 1) {
      var name = list[i].root + "|" + list[i].suffix;
      if (!Object.prototype.hasOwnProperty.call(seen, name)) {
        if (count >= limit) continue;
        seen[name] = true;
        count += 1;
      }
      out.push(list[i]);
    }
    return out;
  }
```

Keyed on `root|suffix` rather than the printed name because `card()` has not run
yet at this point in the pipeline; the two are in bijection. `trimToNames` runs
AFTER `rank` and BEFORE `order`, exactly where the slice was, and `rank` now
guarantees the group is contiguous and home-first, so a name is admitted by its
home card and never by an alternate.

- [ ] **Step 6: Check `order()`**

`order(list, tonicPc)` at `:301` re-sorts by scale degree, tier and quality
rank - keys a chord's alternates all share - so equal elements keep their
relative order only if the sort is stable. **V8's `Array.prototype.sort` is
stable, and `tests/layout.test.js` already relies on that**, so the group stays
contiguous through `order`. Assert it rather than assume it: the Step 1
contiguity test runs against `build`'s FINAL output, which is post-`order`.

- [ ] **Step 7: Run to verify pass**

Run: `node --test tests/select.test.js`
Expected: PASS.

- [ ] **Step 8: Record the measured counts**

Print and paste into the PR body: per built-in seed, `distinct names`,
`total cards`, `cap`. Expected shape from the review's measurement: Amara
25 names / 25 cards / cap 25; Hijaz 19 / 19 / 25; Pygmy 31 names / ~52 cards /
cap 31. **If Pygmy's card count is not between 45 and 55, stop and report** -
the filter is not doing what the review measured. Add the overflow deck's row
too: its name count before and after the trim.

- [ ] **Step 9: Commit**

```bash
python3 tools/inline_engine.py
git add src/engine/select.js tests/select.test.js index.html
git commit
```

### Task 6: The acceptance gates (D2)

**Files:**
- Test: `tests/voicing.test.js`, `tests/select.test.js`

This is the task the whole plan exists to satisfy. Neither test may be weakened
to make the implementation pass.

- [ ] **Step 1: Write the negative gate (Amara, restated)**

```js
// The commercial D Amara reference ships no repeated-root card. The engine must
// therefore emit no alternate there - and that is the whole content of the
// "Amara 16/16" gate, because the enumeration step contributes nothing on a pan
// with no repeated roots. Stated this way it is honest about what it protects.
test("a pan with no repeated roots gets no alternates", () => {
  const deck = built(AMARA_SEED);
  for (const c of deck.chords) {
    assert.equal(voicingClassOf(c.subtitle), "",
      `${c.main}${c.sup} is an alternate, Amara has none`);
  }
  assert.equal(deck.chords.length, new Set(
    deck.chords.map((c) => c.main + c.sup)).size, "one card per name");
});

test("Amara's shipped cards are reproduced unchanged", () => {
  const generated = built(AMARA_SEED).chords.map(keyOf);
  for (const c of AMARA.fixtureChords) {
    assert.ok(generated.includes(keyOf(c)), `Amara ${keyOf(c)} is still produced`);
  }
});
```

- [ ] **Step 2: Write the positive gate (the discriminating one)**

```js
// The gate that actually constrains the ranking filter. Every hand-authored
// multi-voicing card in the shipped Pygmy deck must fall out of the engine,
// card by card. The rejected disjoint-fields variant passes the Amara gate and
// FAILS this one, which is the point.
const HAND_AUTHORED_MULTI_VOICINGS = [
  // main+sup, voicing class, fields - transcribed from the shipped DECKS blob
  ["Cm",  "LOW",  [101, 103, 1]],
  ["Cm",  "",     [1, 3, 5]],
  ["Cm",  "HIGH", [8, 9, 11]],
  ["Cm7", "LOW",  [101, 103, 1, 104]],
  ["Eb",  "LOW",  [103, 1, 104]],
  ["Eb7", "LOW",  [103, 1, 104, 105]]
];

test("every hand-authored multi-voicing card is derived by the engine", () => {
  const deck = built(PYGMY_SEED);
  for (const [name, cls, fields] of HAND_AUTHORED_MULTI_VOICINGS) {
    const hit = deck.chords.find((c) =>
      c.main + c.sup === name &&
      voicingClassOf(c.subtitle) === cls &&
      c.fields.join(",") === fields.join(","));
    assert.ok(hit, `${name} ${cls || "HOME"} [${fields}] is not derived`);
  }
});
```

**Before writing this list, transcribe it from the shipped `DECKS` blob rather
than from this plan.** Read it with:

```bash
node -e '
const fs=require("fs");
const D=JSON.parse(fs.readFileSync("index.html","utf8")
  .match(/const DECKS\s*=\s*(\[[\s\S]*?\]);\n/)[1]);
const p=D.find(d=>d.id==="pygmy");
for(const c of p.chords){
  const m=/ - (LOW|HIGH) VOICING/.exec(c.subtitle||"");
  if(m||p.chords.filter(x=>x.main+x.sup===c.main+c.sup).length>1)
    console.log(c.main+c.sup, m?m[1]:"HOME", "["+c.fields+"]");
}'
```

The `Fm9` row is deliberately absent: its spread 9th (G5) is hand-set and the
engine emits G4. That is a known divergence, recorded, and out of scope here.

- [ ] **Step 3: Run both gates**

Run: `node --test tests/voicing.test.js tests/select.test.js`
Expected: PASS.

**If the positive gate fails**, the filter is wrong and the plan is wrong - stop
and report which card is not derived and what the engine produced instead. Do
not add it to an exception list.

- [ ] **Step 4: Commit**

---

### Task 7: Regenerate the divergence table

**Files:**
- Modify: `tests/fixtures/divergence_v1.json`
- Modify: `tests/select.test.js` if the override-schema test needs the class field

The table is a two-sided record of how generated output differs from shipped
data. Enumeration changes the generated side, so it must be regenerated, not
edited by hand.

- [ ] **Step 1: Regenerate**

Write a throwaway script in the scratchpad that rebuilds each built-in, diffs
`keyOf` against the shipped fixture chords, and writes `missing` / `extra` back
into the JSON with `overrides` left untouched. Keep `version: 1`.

Expected direction, from the review's measurement:
- `missing` SHRINKS. Pygmy's `Db (105,5,7)` and `Dbmaj7 (105,5,7,8)` are now
  derived (this is D4 paying for itself) and drop off the list.
- `extra` GROWS a lot on Pygmy, because every alternate of an engine-only chord
  is a new entry. That is expected under D3's split scope and is exactly the
  inventory the adoption plan will work from.
- Amara's table is unchanged: 0 missing, 9 extra, 0 overrides.

- [ ] **Step 2: Run the table tests**

Run: `node --test tests/select.test.js`
Expected: PASS, including `the divergence table is two-sided, so it can only shrink`.

**Watch:** that test's NAME says shrink but its BODY only checks consistency in
both directions. `extra` growing does not fail it. If you find yourself wanting
to relax the test, you have the wrong regeneration - report instead.

- [ ] **Step 3: Sanity-read the new extras**

Print the Pygmy `extra` list and eyeball it. Every entry should be either an
engine-only chord name that was already extra, or an alternate carrying
` - LOW VOICING` / ` - HIGH VOICING`. Anything else is a bug in Task 4.

- [ ] **Step 4: Commit**

---

### Task 8: Spec and CLAUDE.md (decision 5)

**Files:**
- Modify: `docs/SCALE_ENGINE_PLAN.md` section 7
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rewrite spec section 7's multi-voicing bullet**

Replace "multi-voicing is opt-in data" with the derived rule. State: one card per
playable root-field instance; home is the lowest non-bottom instance, or the
highest bottom instance when the pitch class lives only underneath; an alternate
survives only when a non-root tone moves field AND the register class changes;
cap 3 per name; the deck cap counts names.

Say explicitly that the `overrides` array still exists for cards the engine
cannot express, and that retiring it is the adoption plan's job. Do not claim the
mechanism is gone - it is not.

- [ ] **Step 2: Update CLAUDE.md**

The Pygmy paragraph currently reads "Pygmy ships Cm7 and Eb7 in two registers
each (2026-09-15, owner instruction)". Keep the shipped-data statement (deck data
did not change here) and add one sentence: the engine now DERIVES those cards
rather than reading them from opt-in data, with the home rule in one line.

Leave the "Pitch-class-complete highlighting means both registers light the
IDENTICAL diagram fields" sentence alone. It is still true and it is the reason
an identical diagram cannot be a ranking filter.

- [ ] **Step 3: Run the docs checks**

Run: `python3 tools/validate.py`
Expected: PASS, including check 4 (engine regions in sync).

- [ ] **Step 4: Commit**

---

### Task 9: Mutants

**Files:**
- Modify: `tests/mutants/*.patch` (engine mutants only)

`tools/regen_data_mutants.py` is NOT run - there is no deck-data change (see
Non-goals). Only engine mutants that quote a line this PR moved go stale.

- [ ] **Step 1: Find the stale patches**

```bash
for p in tests/mutants/*.patch; do
  git apply --check "$p" 2>/dev/null || echo "STALE: $p"
done
```

**A stale patch is counted as a SURVIVOR by `mutation_check.sh`, not as an
error.** A patch that no longer applies silently weakens the gate. Fix every one
the loop prints.

- [ ] **Step 2: Re-anchor each stale patch**

Re-anchor only. Do not change what any mutant mutates - the intent must stay
byte-identical. If a mutant's target line no longer exists, say so and propose a
replacement mutant rather than deleting it.

- [ ] **Step 3: Add a mutant for the new filter**

Two new engine mutants:

1. Invert the register-class condition in `voice()` (drop the
   `registerClass(...) === homeClass` guard, so every tone-moving alternate
   survives). Task 6's positive gate should NOT kill it - the Pygmy cards still
   derive - but Task 5's per-name count test should.
2. Collapse `rank`'s group scoring back to per-card (score every member, not the
   home card). Task 5's contiguity test kills it on Pygmy, where `Cm7`'s
   all-top-shell HIGH voicing outranks its own home card.

Verify which test kills each and record that in the patch header comment. A
mutant killed by no test is a coverage gap, not a mutant to delete.

- [ ] **Step 4: Run the mutation gate**

Run: `bash tools/mutation_check.sh`
Expected: PASS, zero survivors.

- [ ] **Step 5: Commit**

---

### Task 10: Full gate, PR, review

- [ ] **Step 1: Run everything**

```bash
node --test "tests/*.test.js"
python3 -m unittest discover tests
python3 tools/validate.py
python3 tools/inline_engine.py --check
bash tools/mutation_check.sh
```

Expected: all PASS, `--check` reports no drift.

- [ ] **Step 2: Confirm no deck data moved**

```bash
git diff --stat origin/main -- tools/decks.py '*.pdf'
git diff origin/main -- index.html | grep -c '^[-+]const DECKS'
```

Expected: empty stat, and `0` for the DECKS grep. **A non-zero count means deck
data changed, which this plan forbids** - stop and report.

- [ ] **Step 3: Push and open the PR**

Body carries: the measured name/card/cap table from Task 5 Step 5, the Pygmy
`extra` inventory from Task 7 as the adoption plan's input, and an explicit line
saying decision 4 (`Bm - HIGH VOICING`) is deferred, not dropped.

Ends with:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01S24msyK6JGS18wpqWjZzJc
```

- [ ] **Step 4: Wait for CI at the final pushed commit**

Local green is a smoke test. CI's conclusion at the head SHA is the evidence.

- [ ] **Step 5: Independent review**

A fresh reviewer at the verified head SHA, read-and-report only, briefed with the
goal, the non-goals, and D1-D4.

---

## Follow-on work this plan deliberately leaves open

Capture as TODOS rows, not as scope:

1. **The adoption plan.** Reconcile built-in Hijaz and Pygmy with engine output:
   34 additions, 8 deletions (Hijaz `Dmaj7`, `Dmaj7#11`, `Bm - HIGH VOICING`;
   Pygmy `Fm11`, `Abmaj9`, and Fm9's spread 9th). Needs a printed proof before
   merge and it runs the full deck-data pipeline (decks.py, PDFs, JSON
   re-injection, `regen_data_mutants.py`).
2. **Decision 4** rides with that plan.
3. **`Fm9`'s spread 9th.** Engine emits G4, the shipped card has G5. Either keep
   it as the one remaining data override or accept G4. Decide with the proof in
   hand, not in the abstract.
4. **Retiring the `overrides` array** once 1-3 land.

## Self-review

- Spec coverage: decisions 1, 2, 3 and 5 are implemented by Tasks 4, 5, 6 and 8.
  Decision 4 is explicitly deferred with a reason, not dropped. D1-D4 map to
  Tasks 5, 6, the scope split, and Task 4's `homeIndex`.
- Placeholders: none. Every code step carries the code.
- Type consistency: `voicingClass` is the same `""`/`"LOW"`/`"HIGH"` string in
  `voice()`, `card()` and `naming.subtitle`. `rootId` is a field id, matching
  `choose`'s `opts.rootId`.
- Known gap: Task 7's regeneration script is described, not written. It is a
  throwaway that reads current output, so writing it against stale numbers here
  would be worse than describing the contract.
- Known gap: `untrimmedNameCount` in Task 5 Step 2 is specified by contract, not
  by code, because how it is best obtained depends on whether the helper module
  can call `candidates`/`collapse` directly. Two routes are named.
- Reviewed 2026-09-16 (`/plan-eng-review`); report below. Two findings landed in
  the plan: `rank` now scores by name group (was: alternates interleaved and the
  cap could keep an alternate whose home card was cut), and Task 5 gained an
  overflow test on a synthetic deck (was: the cap path had zero coverage,
  because no built-in deck ever trims).

---

## GSTACK REVIEW REPORT

`/plan-eng-review`, 2026-09-16. Scope challenged first: Part B existed only as a
decisions block, so the plan was drafted and reviewed in one pass, and the
review re-measured the decisions block's premises inside `select.build`'s own
pipeline rather than accepting its numbers. That produced D1-D4 before the plan
was written, and two more findings after.

### 1. Architecture

**[P1] (confidence 9/10) `src/engine/select.js:283` — rank's second key puts a
HIGH alternate ahead of its own home card.**

```js
    if (a.top !== b.top) return b.top - a.top;   // top-shell tone count, DESC
```

Pygmy's `Cm7` home is `[1,3,5,104]`, one bottom field, 3 top-shell tones; the
HIGH voicing is all top shell, 4 tones, so it sorts first. Failure scenario: a
cap boundary between them prints `Cm7 - HIGH VOICING` with no plain `Cm7`. The
plan as first written also claimed rank keeps a chord's cards adjacent, which is
false for the same reason. RESOLVED — owner chose group ranking; Task 5 now
scores each name group by its home card and orders HOME, LOW, HIGH inside it,
with every other sort key byte-identical so a deck with no alternates ranks
exactly as it does today.

**[P3] (confidence 9/10) `fields["0"][2]` assumed the ding carries id 0.** True
for all three built-ins (checked), unverified for generated decks. Fixed inline
in Task 4: `dingMidi(fields)` finds it by zone and throws if absent.

No other architecture findings. The hook point is one function; `choose`'s
`opts.rootId` contract is already shipped and tested by Part A; the split scope
(D3) removes the print pipeline, the PDF rebuild and `regen_data_mutants.py`
from the blast radius entirely, and Task 10 Step 2 asserts that mechanically
rather than trusting it.

Production failure scenario for the one new codepath: a deck where a root pitch
class has instances but `choose` fails on all of them (a tone missing above and
below). `voice()` skips the candidate via `if (!picked.length) continue;`, same
as today's `if (!picked.ok) continue;`. Accounted for.

### 2. Code quality

**[P3] (confidence 9/10) the `pickedSeen` dedupe in Task 4 was dead code.** The
root field leads every voicing key and differs per instance, so two instances
can never collide. Removed, with a comment saying why rather than leaving a
future reader to re-derive it.

The pre-existing `seen[key]` dedupe in `voice()` (section 5, one fields list per
deck) was checked and left alone: a collision needs the same root field, the
same field set and the same spelling order, which enumeration does not make more
likely.

DRY: `registerClass` is the one definition of the predicate, quoted once in the
plan's data-flow section and referenced by three tests rather than restated.

The CLAUDE.md paragraph on Pygmy's two-register cards becomes inaccurate the
moment this ships (it describes them as opt-in data). Task 8 Step 2 updates it
and explicitly preserves the pitch-class-complete-highlighting sentence, which
stays true and is the reason an identical diagram cannot be a ranking filter.

### 3. Tests

```
CODE PATHS                                         GATES
[~] src/engine/select.js
  |- rootInstances()                               [+] Acceptance
  |   |- [***] repeated root -> 3 instances  T3      |- [***] Amara zero alternates      T6.1
  |   `- [***] bottom-only root (Db)         T3      |- [***] Amara cards unchanged      T6.1
  |- homeIndex()                                     `- [***] every hand-authored multi-
  |   |- [***] lowest non-bottom is home     T3          voicing card derived, card by
  |   `- [***] D4 bottom-only -> highest     T3          card (kills the rejected
  |- registerClass() filter                              disjoint-fields variant)   T6.2
  |   |- [***] survives: tone moves + class
  |   |        changes                       T3    [+] Divergence
  |   `- [***] ALTERNATE_CAP = 3 per name    T5      |- [***] two-sided, schema, reasons T7
  |- rank() group scoring                            `- [**]  extras are engine-only or
  |   |- [***] contiguous, home first        T5           classed alternates (eyeball)  T7
  |   `- [***] mutant: per-card scoring dies T9
  |- trimToNames()                                 [+] Non-goals asserted
  |   |- [***] names <= cap on built-ins     T5      `- [***] no deck-data diff, DECKS
  |   `- [***] OVERFLOW deck: whole names               line untouched               T10.2
  |            cut, home always kept         T5
  `- dingMidi()
      `- [**]  throws with no ding field     (covered by every build)
[~] src/engine/naming.js
  `- subtitle()
      |- [***] "", LOW, HIGH                 T2
      |- [***] class after the equivalence   T2
      |- [***] unknown class throws          T2
      `- [***] SUBTITLE_MAX ceiling          T2

COVERAGE: 18/18 paths  |  QUALITY: ***:16  **:2  |  GAPS: 0
```

**[P1] (confidence 10/10) the cap path had zero coverage.** Pygmy's 18 fields
give a cap of 31 and it produces exactly 31 names; Amara is 25/25 and Hijaz
19/25. Every name-counting assertion passed without a single card being trimmed,
so D1's mechanism would have shipped untested. RESOLVED — owner chose a
synthetic overflow deck from `tests/fixtures/synthetic_scales.json`; Task 5
Step 2 finds one whose untrimmed name count exceeds its cap and asserts whole
names are cut with every survivor keeping its home card. The plan says
explicitly that if no fixture scale overflows, the test is not to be weakened.

REGRESSION RULE: `naming.subtitle` changes arity, and three existing call sites
pass three arguments. Task 2's first assertion pins the no-class output
byte-identical, which is the regression test. Not optional, no question asked.

No E2E or eval paths: this is a pure function over a fields map, with no UI,
network, or LLM surface.

### 4. Performance

`voice()` goes from one `choose` call per candidate to one per root instance.
Measured worst case on the built-ins: Pygmy, 31 candidates against at most 3
instances each, so under 100 calls where there were 31. `choose` is a linear
scan over a field list of 18. The N=5..19 layout sweep is the densest thing the
engine runs and stays in the same order. `rank`'s group pass adds one hash build
over a list of tens. No finding.

No database, no network, no cache. Nothing here is on a hot path — decks are
built once at load and once per share-URL parse.

### Outside voice

Not run: the plan's whole argument rests on measurements taken against this
repo's engine (name/card/cap counts per deck, the shipped Pygmy multi-voicing
list, the LOST/NEW deltas under D4), none of which a second model can check
without re-running the same harness. The finding that mattered most came from
reading `rank`'s comparator, not from a second opinion on prose.

### Verdict

**ENG CLEARED.** Ten tasks, TDD throughout, engine-only, no deck-data change.
Four owner decisions (D1-D4) recorded in the Part A plan's Part B section and
restated at the top of this one. Two review findings folded into Task 5, two
nits fixed inline in Task 4.

Failure modes to stop on, all stated in the tasks themselves: (a) Pygmy's card
count outside 45-55 in Task 5 Step 8 means the filter is not the rule that was
measured; (b) a hand-authored multi-voicing card not derived in Task 6 Step 3
means the filter is wrong and the plan is wrong — it is not to be added to an
exception list; (c) a non-empty deck-data diff in Task 10 Step 2 means the
non-goal was violated; (d) a stale mutant patch counts as a SURVIVOR, not an
error.

NO UNRESOLVED DECISIONS
