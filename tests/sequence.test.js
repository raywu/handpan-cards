// HPE.sequence - the chord-sequence-mode engine (S1 of
// docs/plans/2026-09-29-chord-sequence-mode.md), extended with difficulty
// tiers (D1 of docs/plans/2026-10-02-sequence-difficulty.md). Tests are named
// exactly as listed in the chord-sequence plan's section 3 ("S1 failing
// tests") for the S1 block, and by the tier plan's §4 step numbers below.
//
// tests/fixtures/sequence_basic_golden.json (D1 step 1b) was captured from
// the UNMODIFIED engine at main@61b01c2, before any tier code existed, with
// this script (run once, output committed, script itself not checked in):
//
//   const fs = require("fs");
//   const { loadEngine } = require("./tests/helpers/engine.js");
//   const DECKS = JSON.parse(fs.readFileSync("data/decks.json", "utf8"));
//   const E = loadEngine(["sequence"]);
//   const out = {};
//   for (const id of ["hijaz", "pygmy", "amara"]) {
//     const deck = DECKS.find((d) => d.id === id);
//     out[id] = [];
//     for (let seed = 0; seed < 200; seed += 1) {
//       const rngNull = E.sequence.mulberry32(seed);
//       const nullDeal = E.sequence.pick(deck, rngNull, null);
//       const nullNext = rngNull();
//       const rngPrev = E.sequence.mulberry32(seed); // fresh rng, same seed
//       const prevDeal = E.sequence.pick(deck, rngPrev, nullDeal.chords);
//       const prevNext = rngPrev();
//       out[id].push({
//         seed,
//         nullCase: { chords: nullDeal.chords, style: nullDeal.style, nextRng: nullNext },
//         prevCase: { chords: prevDeal.chords, style: prevDeal.style, nextRng: prevNext }
//       });
//     }
//   }
//   fs.writeFileSync("tests/fixtures/sequence_basic_golden.json", JSON.stringify(out));
//
// This fixture is the BASIC-parity oracle for step 4 (eng E-4): comparing
// pick-vs-pick after the engine edit would pass a mutant that routes BOTH
// the undefined-tier and "basic" calls through the new tiered sampler: the
// fixture was captured before that code existed, so it cannot share such a
// bug.
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadEngine } = require("./helpers/engine.js");
const { score } = require("./helpers/sequence_score.js");

const ROOT = path.join(__dirname, "..");
const DECKS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "decks.json"), "utf8"));
const BASIC_GOLDEN = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests", "fixtures", "sequence_basic_golden.json"), "utf8"));

function deckById(id) {
  const hit = DECKS.find((d) => d.id === id);
  assert.ok(hit, `no built-in deck named "${id}"`);
  return hit;
}

const HIJAZ = deckById("hijaz");
const PYGMY = deckById("pygmy");
const AMARA = deckById("amara");

// The approved golden table, §2/§7 of the plan (OWNER-APPROVED 2026-09-29,
// "APPROVE ALL (C2) on all three decks") - converted from the table's 1-based
// card numbers to 0-based chord indices, row for row, in the table's order.
const GOLDEN = {
  hijaz: {
    2: [
      [0, 6], [0, 8], [0, 10], [0, 12], [0, 14]
    ],
    3: [
      [0, 6, 8], [0, 6, 12], [0, 6, 14],
      [0, 8, 6], [0, 8, 10], [0, 8, 12], [0, 8, 14],
      [0, 10, 8], [0, 10, 12], [0, 10, 14],
      [0, 12, 6], [0, 12, 8], [0, 12, 10], [0, 12, 14],
      [0, 14, 6], [0, 14, 8], [0, 14, 10], [0, 14, 12]
    ]
  },
  pygmy: {
    2: [
      [0, 6], [0, 8], [0, 19], [0, 24], [0, 37], [0, 43]
    ],
    3: [
      [0, 6, 8], [0, 6, 19], [0, 6, 24], [0, 6, 37], [0, 6, 43],
      [0, 8, 6], [0, 8, 19], [0, 8, 24], [0, 8, 37], [0, 8, 43],
      [0, 19, 6], [0, 19, 8], [0, 19, 24], [0, 19, 37], [0, 19, 43],
      [0, 24, 6], [0, 24, 8], [0, 24, 19], [0, 24, 37], [0, 24, 43],
      [0, 37, 6], [0, 37, 8], [0, 37, 19], [0, 37, 24], [0, 37, 43],
      [0, 43, 6], [0, 43, 8], [0, 43, 19], [0, 43, 24], [0, 43, 37]
    ]
  },
  amara: {
    2: [
      [0, 8], [0, 14], [0, 16], [0, 21]
    ],
    3: [
      [0, 8, 14], [0, 8, 16], [0, 8, 21],
      [0, 14, 8], [0, 14, 16], [0, 14, 21],
      [0, 16, 8], [0, 16, 14], [0, 16, 21],
      [0, 21, 8], [0, 21, 14], [0, 21, 16]
    ]
  }
};

const ANCHORS_1BASED = {
  hijaz: [1, 7, 9, 11, 13, 15],
  pygmy: [1, 7, 9, 20, 25, 38, 44],
  amara: [1, 9, 15, 17, 22]
};

function engine() {
  return loadEngine(["sequence"]);
}

// The engine runs in its own node:vm realm, so the values it returns are
// built from that realm's Array/Object. deepStrictEqual compares prototypes,
// so any engine value compared against a host-realm literal is normalised
// through JSON (same convention as tests/core.test.js's host()).
function host(value) {
  return JSON.parse(JSON.stringify(value));
}

function pc(n) {
  return ((n % 12) + 12) % 12;
}

function rootPc(deck, chordIndex) {
  const chord = deck.chords[chordIndex];
  return pc(deck.fields[String(chord.roots[0])][2]);
}

function chordPcs(deck, chordIndex) {
  const chord = deck.chords[chordIndex];
  return [...new Set(chord.fields.map((id) => pc(deck.fields[String(id)][2])))];
}

function connectsRef(deck, a, b) {
  const apcs = chordPcs(deck, a);
  const bpcs = chordPcs(deck, b);
  if (apcs.some((p) => bpcs.includes(p))) return true;
  let diff = pc(rootPc(deck, a) - rootPc(deck, b));
  if (diff > 6) diff = 12 - diff;
  return diff === 1 || diff === 2;
}

/* -------------------------------------------------------------- S1-1 */

test("anchors pick one simple chord per root on every built-in deck", () => {
  const E = engine();
  for (const [id, deck] of [["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA]]) {
    const got = host(E.sequence.anchors(deck)).map((i) => i + 1);
    assert.deepStrictEqual(got, ANCHORS_1BASED[id], `anchors mismatch on ${id}`);
  }
});

/* -------------------------------------------------------------- S1-2 */

test("sequences match the approved golden table on every built-in deck", () => {
  const E = engine();
  for (const [id, deck] of [["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA]]) {
    assert.deepStrictEqual(host(E.sequence.sequences(deck, 2)), GOLDEN[id][2],
      `2-chord sequences mismatch on ${id}`);
    assert.deepStrictEqual(host(E.sequence.sequences(deck, 3)), GOLDEN[id][3],
      `3-chord sequences mismatch on ${id}`);
  }
});

/* -------------------------------------------------------------- S1-3 */

test("every sequence starts on the home chord and every step connects, including back home", () => {
  const E = engine();
  for (const deck of [HIJAZ, PYGMY, AMARA]) {
    const homeIdx = E.sequence.anchors(deck).find(
      (i) => rootPc(deck, i) === pc(deck.fields["0"][2]));
    for (const length of [2, 3]) {
      for (const seq of E.sequence.sequences(deck, length)) {
        assert.strictEqual(seq[0], homeIdx, `sequence ${seq} does not start home`);
        const roots = seq.map((i) => rootPc(deck, i));
        assert.strictEqual(new Set(roots).size, roots.length, `sequence ${seq} repeats a root`);
        for (let i = 0; i < seq.length; i += 1) {
          const a = seq[i];
          const b = seq[(i + 1) % seq.length];
          assert.ok(connectsRef(deck, a, b),
            `${a} -> ${b} does not connect in sequence ${seq} on deck ${deck.id}`);
        }
      }
    }
  }

  // A synthetic deck where B connects home and C connects B, but C does NOT
  // connect back to home - the wrap edge that makes a 3-chord sequence a
  // loop. This is the case a built-in deck never happens to exercise (every
  // (home,B,C) triple it offers already loops back), so it is the only thing
  // that would catch an implementation that dropped the loop-back check.
  const loopDeck = syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],    // home, pc 0
    "1": ["C", 4, 60, "rim", null, "1"],
    "2": ["E", 4, 64, "rim", null, "2"],
    "3": ["G", 4, 67, "rim", null, "3"],        // home chord: C E G (0,4,7)
    "4": ["D", 4, 62, "rim", null, "4"],
    "5": ["F", 4, 65, "rim", null, "5"],
    "6": ["A", 4, 69, "rim", null, "6"],        // B chord: D F A (2,5,9)
    "7": ["F", 5, 77, "rim", null, "7"],
    "8": ["Ab", 5, 80, "rim", null, "8"],
    "9": ["B", 5, 83, "rim", null, "9"]         // C chord: F Ab B (5,8,11)
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] },
    { main: "Dm", sup: "", fields: [4, 5, 6], roots: [4] },
    { main: "Fdim", sup: "", fields: [7, 8, 9], roots: [7] }
  ]);
  assert.deepStrictEqual(host(E.sequence.anchors(loopDeck)), [0, 1, 2]);
  assert.deepStrictEqual(host(E.sequence.sequences(loopDeck, 2)), [[0, 1]],
    "only home->B connects at length 2 (home-C shares no tone and its roots are 5 apart)");
  assert.deepStrictEqual(host(E.sequence.sequences(loopDeck, 3)), [],
    "home->B->C is not a loop: C shares no tone with home and its root is 5 semitones away");
});

/* -------------------------------------------------------------- S1-4 */

test("pick is deterministic for a seed and uses only the rng it is given", () => {
  const E = engine();
  const rng1 = E.sequence.mulberry32(42);
  const rng2 = E.sequence.mulberry32(42);
  const a = E.sequence.pick(HIJAZ, rng1, null);
  const b = E.sequence.pick(HIJAZ, rng2, null);
  assert.deepStrictEqual(a, b);

  // pick() runs inside the engine's OWN node:vm realm, which brings its own
  // Math - stubbing the host's Math.random here would stub a Math object
  // pick() never sees, and the assertion below would pass even if pick()
  // called Math.random freely. E._context's own properties don't include
  // Math (a vm context's standard built-ins aren't own properties of the
  // sandbox object the host holds), so fetch the live binding by running
  // "Math" in that context - vm.runInContext returns the real, mutable
  // object the context's code shares, not a copy.
  const vmMath = vm.runInContext("Math", E._context);
  const originalRandom = vmMath.random;
  vmMath.random = () => { throw new Error("pick must not call Math.random"); };
  try {
    const rng3 = E.sequence.mulberry32(7);
    assert.doesNotThrow(() => E.sequence.pick(PYGMY, rng3, null));
  } finally {
    vmMath.random = originalRandom;
  }
});

/* -------------------------------------------------------------- S1-5 */

test("pick never returns the previous sequence when another exists", () => {
  const E = engine();
  const rng = E.sequence.mulberry32(1234);
  let prev = null;
  for (let i = 0; i < 1000; i += 1) {
    const result = E.sequence.pick(PYGMY, rng, prev);
    assert.ok(result.chords, "pick unexpectedly returned a null-chords result");
    if (prev) {
      assert.notDeepStrictEqual(result.chords, prev,
        "pick repeated the previous sequence although others exist");
    }
    prev = result.chords;
  }
});

/* -------------------------------------------------------------- S1-6 */

test("length is drawn 2 or 3 evenly, and style evenly over seven", () => {
  const E = engine();
  const rng = E.sequence.mulberry32(99);
  const N = 10000;
  const lengthCounts = { 2: 0, 3: 0 };
  const styleCounts = {};
  for (const s of E.sequence.STYLES) styleCounts[s] = 0;
  let prev = null;
  for (let i = 0; i < N; i += 1) {
    const result = E.sequence.pick(HIJAZ, rng, prev);
    lengthCounts[result.chords.length] += 1;
    styleCounts[result.style] += 1;
    prev = result.chords;
  }
  const pct = (n) => (100 * n) / N;
  assert.ok(Math.abs(pct(lengthCounts[2]) - 50) <= 3,
    `length=2 share ${pct(lengthCounts[2])}% not within 3pp of 50%`);
  assert.ok(Math.abs(pct(lengthCounts[3]) - 50) <= 3,
    `length=3 share ${pct(lengthCounts[3])}% not within 3pp of 50%`);
  const expected = 100 / E.sequence.STYLES.length;
  for (const s of E.sequence.STYLES) {
    assert.ok(Math.abs(pct(styleCounts[s]) - expected) <= 3,
      `style "${s}" share ${pct(styleCounts[s])}% not within 3pp of ${expected}%`);
  }
});

/* -------------------------------------------------------------- S1-7 */

// A deck object built by hand, matching the app data model (CLAUDE.md "App
// data model"): fields id -> [name, octave, midi, zone, angle, label], and
// chords[].{fields, roots} as arrays of field ids.
function syntheticDeck(fields, chords) {
  return { id: "synthetic", fields: fields, chords: chords };
}

test("a pan with too few simple chords returns a reason, not a throw", () => {
  const E = engine();

  // NO_HOME_CHORD: the NO_THIRDS fixture from tests/pdfcards.test.js:135-143 -
  // (C3) G3 D4 G4 D5 builds only two power-chord cards (G5 1-2, G5 3-4), so it
  // has no anchor on its own home pitch class C (E1 of the plan).
  const built = engine();
  const full = loadEngine(["core", "voicing", "layout", "naming", "select", "sequence"]);
  const parsed = full.core.parseSeed("(C3) G3 D4 G4 D5", {});
  assert.ok(parsed.ok, "the NO_THIRDS fixture must parse");
  const deck = full.select.build(parsed.value);
  assert.ok(deck.ok, "the NO_THIRDS fixture must build");
  assert.deepStrictEqual(host(full.sequence.pick(deck.value, full.sequence.mulberry32(1), null)),
    { chords: null, reason: "NO_HOME_CHORD" });

  // A synthetic two-anchor deck (home + one other, connected) yields 2-chord
  // sequences only, and pick() always returns length 2.
  const twoAnchor = syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],
    "1": ["C", 4, 60, "rim", null, "1"],
    "2": ["E", 4, 64, "rim", null, "2"],
    "3": ["G", 4, 67, "rim", null, "3"],
    "4": ["D", 4, 62, "rim", null, "4"],
    "5": ["F#", 4, 66, "rim", null, "5"],
    "6": ["A", 4, 69, "rim", null, "6"]
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] },
    { main: "D", sup: "", fields: [4, 5, 6], roots: [4] }
  ]);
  assert.deepStrictEqual(host(E.sequence.anchors(twoAnchor)), [0, 1]);
  assert.deepStrictEqual(host(E.sequence.sequences(twoAnchor, 2)), [[0, 1]]);
  assert.deepStrictEqual(host(E.sequence.sequences(twoAnchor, 3)), []);
  for (let seed = 0; seed < 20; seed += 1) {
    const result = E.sequence.pick(twoAnchor, E.sequence.mulberry32(seed), null);
    assert.strictEqual(result.chords.length, 2);
  }

  // A synthetic one-anchor deck (home only, no other anchor) yields
  // TOO_FEW_CHORDS.
  const oneAnchor = syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],
    "1": ["C", 4, 60, "rim", null, "1"],
    "2": ["E", 4, 64, "rim", null, "2"],
    "3": ["G", 4, 67, "rim", null, "3"]
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] }
  ]);
  assert.deepStrictEqual(host(E.sequence.anchors(oneAnchor)), [0]);
  assert.deepStrictEqual(
    host(E.sequence.pick(oneAnchor, E.sequence.mulberry32(2), null)),
    { chords: null, reason: "TOO_FEW_CHORDS" });
});

/* -------------------------------------------------------------- S1-9 */

test("pick excludes prev before choosing a length", () => {
  // A synthetic deck where home, B and C are pairwise connected (home-B and
  // home-C by a shared tone, B-C by a shared tone), so sequences(deck,2) has
  // exactly the two entries [home,B] and [home,C] and sequences(deck,3) has
  // exactly [home,B,C] and [home,C,B]. (Any 3-chord sequence's wrap edge
  // forces its last chord to also connect home, so it necessarily has its own
  // 2-chord entry too - a deck cannot have 3-chord sequences while having
  // fewer than two 2-chord ones. "Several" 3-chord sequences alongside
  // "exactly one" 2-chord sequence is therefore not constructible under the
  // rule the golden table verifies; this deck instead has two of each, which
  // is enough to exercise the exclusion-before-length-draw and no-rejection-
  // loop behaviour E4 describes.)
  const deck = syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],   // home, pc 0
    "1": ["C", 4, 60, "rim", null, "1"],
    "2": ["E", 4, 64, "rim", null, "2"],
    "3": ["G", 4, 67, "rim", null, "3"],       // home chord: C E G (pcs 0,4,7)
    "4": ["D", 4, 62, "rim", null, "4"],
    "5": ["G", 5, 79, "rim", null, "5"],
    "6": ["A", 5, 81, "rim", null, "6"],       // B chord: D G A (pcs 2,7,9)
    "7": ["E", 5, 76, "rim", null, "7"],
    "8": ["G", 6, 91, "rim", null, "8"],
    "9": ["B", 6, 95, "rim", null, "9"]        // C chord: E G B (pcs 4,7,11)
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] },
    { main: "D", sup: "", fields: [4, 5, 6], roots: [4] },
    { main: "Em", sup: "", fields: [7, 8, 9], roots: [7] }
  ]);

  const E = engine();
  assert.deepStrictEqual(host(E.sequence.anchors(deck)), [0, 1, 2]);
  const pool2 = E.sequence.sequences(deck, 2);
  const pool3 = E.sequence.sequences(deck, 3);
  assert.deepStrictEqual(host(pool2), [[0, 1], [0, 2]]);
  assert.deepStrictEqual(host(pool3), [[0, 1, 2], [0, 2, 1]]);

  // prev is pool3's own first entry, [0,1,2] - the exact sequence an
  // unfiltered stuck-at-zero draw would land on. A rejection-sampling
  // implementation (draw, check against prev, redraw) would draw the same
  // index every time from a stuck rng and either loop forever or give up and
  // hand back the very prev it was told to avoid; excluding prev from the
  // pool BEFORE the length/sequence draw sidesteps that entirely.
  const stuckAtZero = () => 0;
  const prev = pool3[0];
  const result = E.sequence.pick(deck, stuckAtZero, prev);
  assert.strictEqual(result.chords.length, 3, "expected a 3-chord sequence");
  assert.notDeepStrictEqual(host(result.chords), host(prev));

  // A prev whose index is out of range for this deck is ignored, not applied
  // - pick(deck, stuckAtZero, null) and pick(deck, stuckAtZero, [0, 99]) draw
  // from the same (unfiltered) pools and so land on the same sequence.
  const withNull = E.sequence.pick(deck, stuckAtZero, null);
  const ignored = E.sequence.pick(deck, stuckAtZero, [0, 99]);
  assert.deepStrictEqual(host(ignored.chords), host(withNull.chords));

  // Integrator clarification (binding, fills a gap in §8 E4): when excluding
  // prev empties every length pool - e.g. a deck whose only sequence IS prev
  // - pick falls back to returning prev's own sequence again, with a freshly
  // drawn style, rather than null or a loop.
  const oneSequenceDeck = syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],
    "1": ["C", 4, 60, "rim", null, "1"],
    "2": ["E", 4, 64, "rim", null, "2"],
    "3": ["G", 4, 67, "rim", null, "3"],
    "4": ["D", 4, 62, "rim", null, "4"],
    "5": ["F#", 4, 66, "rim", null, "5"],
    "6": ["A", 4, 69, "rim", null, "6"]
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] },
    { main: "D", sup: "", fields: [4, 5, 6], roots: [4] }
  ]);
  const onlySequence = E.sequence.sequences(oneSequenceDeck, 2);
  assert.deepStrictEqual(host(onlySequence), [[0, 1]]);
  const fallback = E.sequence.pick(oneSequenceDeck, stuckAtZero, [0, 1]);
  assert.deepStrictEqual(host(fallback.chords), [0, 1]);
  assert.strictEqual(typeof fallback.style, "string");
  assert.ok(E.sequence.STYLES.includes(fallback.style));
});

/* ================================================================
 * D1 - difficulty tiers (docs/plans/2026-10-02-sequence-difficulty.md §4)
 * ================================================================ */

// Part 3a/3b of the Pygmy Progression Tiers doc (artifact
// f14b7860-bf38-4c6d-b579-f54f9535b405, rev 56), 1-based "#N" card numbers
// converted to 0-based chord indices. These are the golden fixtures step 2
// names; tierOf is asserted against them directly (D1 step 2/3).
const PYGMY_INTERMEDIATE = {
  I1: [0, 30, 24], I2: [4, 41, 50], I3: [0, 48, 50], I4: [4, 23, 35],
  I5: [0, 7, 35], I6: [0, 43, 37, 30], I7: [4, 16, 41, 50], I8: [2, 0, 21, 19]
};
const PYGMY_ADVANCED = {
  A1: [36, 51, 38, 0], A2: [23, 50, 16, 41], A3: [5, 17, 25, 0],
  A4: [49, 51, 15, 16], A5: [5, 22, 23, 7, 33, 35], A6: [25, 38, 44, 38]
};
const HIJAZ_INTERMEDIATE = [0, 6, 2];
const HIJAZ_ADVANCED = [14, 13, 3, 5];
const AMARA_INTERMEDIATE = [0, 18, 16];
const AMARA_ADVANCED = [10, 20, 15, 24];

/* -------------------------------------------------------------- D1 step 2/3 */

test("tierOf classifies the golden fixtures and every BASIC sequence", () => {
  const E = engine();
  for (const [name, seq] of Object.entries(PYGMY_INTERMEDIATE)) {
    assert.strictEqual(E.sequence.tierOf(PYGMY, seq), "intermediate",
      `Pygmy ${name} ${seq} should classify intermediate`);
  }
  for (const [name, seq] of Object.entries(PYGMY_ADVANCED)) {
    assert.strictEqual(E.sequence.tierOf(PYGMY, seq), "advanced",
      `Pygmy ${name} ${seq} should classify advanced`);
  }
  assert.strictEqual(E.sequence.tierOf(HIJAZ, HIJAZ_INTERMEDIATE), "intermediate");
  assert.strictEqual(E.sequence.tierOf(HIJAZ, HIJAZ_ADVANCED), "advanced");
  assert.strictEqual(E.sequence.tierOf(AMARA, AMARA_INTERMEDIATE), "intermediate");
  assert.strictEqual(E.sequence.tierOf(AMARA, AMARA_ADVANCED), "advanced");

  // Every BASIC sequence today (36 / 23 / 16) still classifies "basic".
  for (const [id, deck] of [["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA]]) {
    let count = 0;
    for (const length of [2, 3]) {
      for (const seq of E.sequence.sequences(deck, length)) {
        assert.strictEqual(E.sequence.tierOf(deck, seq), "basic",
          `${id} BASIC sequence ${seq} should classify basic`);
        count += 1;
      }
    }
    assert.strictEqual(count, { hijaz: 23, pygmy: 36, amara: 16 }[id],
      `${id} BASIC candidate count changed`);
  }

  // A synthetic deck isolating the sus-resolve exception: chord0 = C anchor
  // (home), chord1 = Dm anchor (root D), chord2 = Dsus4-shaped 4-field
  // non-anchor chord sharing Dm's root. [0,2,1] (sus, then its resolution,
  // adjacent on the wrap) is the one repeat INTERMEDIATE allows - advanced
  // otherwise, since nothing else distinguishes the two tiers here.
  const resolveDeck = syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],
    "1": ["C", 4, 60, "rim", null, "1"],
    "2": ["E", 4, 64, "rim", null, "2"],
    "3": ["G", 4, 67, "rim", null, "3"],
    "4": ["D", 4, 62, "rim", null, "4"],
    "5": ["F", 4, 65, "rim", null, "5"],
    "6": ["A", 4, 69, "rim", null, "6"],
    "7": ["D", 5, 74, "rim", null, "7"],
    "8": ["G", 5, 79, "rim", null, "8"],
    "9": ["A", 5, 81, "rim", null, "9"],
    "10": ["C", 6, 84, "rim", null, "10"]
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] },
    { main: "Dm", sup: "", fields: [4, 5, 6], roots: [4] },
    { main: "Dsus4", sup: "add9", fields: [7, 8, 9, 10], roots: [7] }
  ]);
  assert.strictEqual(E.sequence.tierOf(resolveDeck, [0, 2, 1]), "intermediate",
    "sus (pos1) resolving forward into its root chord (pos2) should be intermediate");
  assert.strictEqual(E.sequence.tierOf(resolveDeck, [0, 1, 2]), "advanced",
    "the same pair in the other order does not resolve and should be advanced");

  // The 4-note cap: a >4-field chord anywhere in the sequence pushes it to
  // advanced even with no repeat and a home start.
  const capDeck = syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],
    "1": ["C", 4, 60, "rim", null, "1"], "2": ["E", 4, 64, "rim", null, "2"], "3": ["G", 4, 67, "rim", null, "3"],
    "4": ["D", 4, 62, "rim", null, "4"], "5": ["F", 4, 65, "rim", null, "5"], "6": ["A", 4, 69, "rim", null, "6"],
    "7": ["E", 5, 76, "rim", null, "7"], "8": ["G", 5, 79, "rim", null, "8"], "9": ["B", 5, 83, "rim", null, "9"],
    "10": ["D", 6, 86, "rim", null, "10"], "11": ["F", 6, 89, "rim", null, "11"]
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] },
    { main: "Dm", sup: "", fields: [4, 5, 6], roots: [4] },
    { main: "Em9", sup: "", fields: [7, 8, 9, 10, 11], roots: [7] }
  ]);
  assert.strictEqual(E.sequence.tierOf(capDeck, [0, 1, 2]), "advanced",
    "a 5-field chord should push the sequence past intermediate's 4-note cap (root E avoids confounding with Dm's repeated D root)");

  // LOW/HIGH register excludes a card from intermediate even at <=4 fields.
  // A plain Em triad (index 1) is seeded ahead of the LOW VOICING Em (index
  // 3) purely so anchors() elects the plain one as E's sole anchor (first
  // seen wins a shape-tier tie) - that keeps the tested sequence [0, 2, 3]
  // out of BASIC for the anchor reason alone, so failing INTERMEDIATE can
  // only be attributed to the register check, not to a root repeat or a
  // BASIC/INTERMEDIATE gate confound. The plain Em (index 1) is never part
  // of the tested sequence.
  const registerDeck = syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],
    "1": ["C", 4, 60, "rim", null, "1"], "2": ["E", 4, 64, "rim", null, "2"], "3": ["G", 4, 67, "rim", null, "3"],
    "4": ["D", 4, 62, "rim", null, "4"], "5": ["F", 4, 65, "rim", null, "5"], "6": ["A", 4, 69, "rim", null, "6"],
    "7": ["E", 5, 76, "rim", null, "7"], "8": ["G", 5, 79, "rim", null, "8"], "9": ["B", 5, 83, "rim", null, "9"],
    "10": ["E", 6, 88, "rim", null, "10"], "11": ["G", 6, 91, "rim", null, "11"], "12": ["B", 6, 95, "rim", null, "12"]
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] },
    { main: "Em", sup: "", fields: [7, 8, 9], roots: [7] },
    { main: "Dm", sup: "", fields: [4, 5, 6], roots: [4] },
    { main: "Em", sup: "", subtitle: "- LOW VOICING", fields: [10, 11, 12], roots: [10] }
  ]);
  assert.strictEqual(E.sequence.tierOf(registerDeck, [0, 2, 3]), "advanced",
    "a LOW VOICING card should exclude the sequence from intermediate");

  // The sus-resolve exception must check the WRAP pair (last position back to
  // first), not just forward-adjacent positions in array order.
  const wrapDeck = syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],
    "1": ["C", 4, 60, "rim", null, "1"], "2": ["E", 4, 64, "rim", null, "2"], "3": ["G", 4, 67, "rim", null, "3"],
    "4": ["D", 4, 62, "rim", null, "4"], "5": ["F", 4, 65, "rim", null, "5"], "6": ["A", 4, 69, "rim", null, "6"],
    "7": ["C", 5, 72, "rim", null, "7"], "8": ["F", 5, 77, "rim", null, "8"], "9": ["G", 5, 79, "rim", null, "9"],
    "10": ["C", 6, 84, "rim", null, "10"]
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] },
    { main: "Dm", sup: "", fields: [4, 5, 6], roots: [4] },
    { main: "Csus4", sup: "add9", fields: [7, 8, 9, 10], roots: [7] }
  ]);
  assert.strictEqual(E.sequence.tierOf(wrapDeck, [0, 1, 2]), "intermediate",
    "chord2 (sus, root C) resolving into chord0 (root C) only via the wrap should be intermediate");

  // Intermediate's length range is exactly {3, 4}: a 5-chord sequence that
  // otherwise satisfies every other intermediate rule (home start, no
  // repeats, <=4 fields, no register) must still fall through to advanced.
  const lengthDeck = syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],
    "1": ["C", 4, 60, "rim", null, "1"], "2": ["E", 4, 64, "rim", null, "2"], "3": ["G", 4, 67, "rim", null, "3"],
    "4": ["D", 4, 62, "rim", null, "4"], "5": ["F", 4, 65, "rim", null, "5"], "6": ["A", 4, 69, "rim", null, "6"],
    "7": ["E", 5, 76, "rim", null, "7"], "8": ["G", 5, 79, "rim", null, "8"], "9": ["B", 5, 83, "rim", null, "9"],
    "10": ["F", 5, 77, "rim", null, "10"], "11": ["A", 5, 81, "rim", null, "11"], "12": ["C", 6, 84, "rim", null, "12"],
    "13": ["G", 5, 79, "rim", null, "13"], "14": ["B", 5, 83, "rim", null, "14"], "15": ["D", 6, 86, "rim", null, "15"]
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] },
    { main: "Dm", sup: "", fields: [4, 5, 6], roots: [4] },
    { main: "Em", sup: "", fields: [7, 8, 9], roots: [7] },
    { main: "F", sup: "", fields: [10, 11, 12], roots: [10] },
    { main: "G", sup: "", fields: [13, 14, 15], roots: [13] }
  ]);
  assert.strictEqual(E.sequence.tierOf(lengthDeck, [0, 1, 2, 3, 4]), "advanced",
    "a 5-chord sequence is outside intermediate's {3,4} length range even with no other violation");
});

/* -------------------------------------------------------------- D1 step 3 */

test("TIERS lists the three tier ids in order", () => {
  const E = engine();
  assert.deepStrictEqual(host(E.sequence.TIERS), ["basic", "intermediate", "advanced"]);
});

/* -------------------------------------------------------------- D1 step 4 */

test("pick(..., undefined) and pick(..., \"basic\") reproduce the pre-tier golden fixture", () => {
  const E = engine();
  for (const [id, deck] of [["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA]]) {
    for (const row of BASIC_GOLDEN[id]) {
      for (const tierArg of [undefined, "basic"]) {
        const rngNull = E.sequence.mulberry32(row.seed);
        const nullDeal = tierArg === undefined
          ? E.sequence.pick(deck, rngNull, null)
          : E.sequence.pick(deck, rngNull, null, tierArg);
        assert.deepStrictEqual(host(nullDeal.chords), row.nullCase.chords,
          `${id} seed ${row.seed} null-prev chords diverged from the golden fixture`);
        assert.strictEqual(nullDeal.style, row.nullCase.style);
        assert.strictEqual(rngNull(), row.nullCase.nextRng);

        const rngPrev = E.sequence.mulberry32(row.seed);
        const prevDeal = tierArg === undefined
          ? E.sequence.pick(deck, rngPrev, row.nullCase.chords)
          : E.sequence.pick(deck, rngPrev, row.nullCase.chords, tierArg);
        assert.deepStrictEqual(host(prevDeal.chords), row.prevCase.chords,
          `${id} seed ${row.seed} prev-excluded chords diverged from the golden fixture`);
        assert.strictEqual(prevDeal.style, row.prevCase.style);
        assert.strictEqual(rngPrev(), row.prevCase.nextRng);
      }
    }
  }
});

test("pick throws on an unknown tier", () => {
  const E = engine();
  assert.throws(() => E.sequence.pick(HIJAZ, E.sequence.mulberry32(1), null, "expert"),
    /HPE\.sequence\.pick: unknown tier/);
});

test("pick uses only the rng it is given for intermediate/advanced tiers", () => {
  const E = engine();
  const vmMath = vm.runInContext("Math", E._context);
  const originalRandom = vmMath.random;
  vmMath.random = () => { throw new Error("pick must not call Math.random"); };
  try {
    for (const tier of ["intermediate", "advanced"]) {
      const rng = E.sequence.mulberry32(7);
      assert.doesNotThrow(() => E.sequence.pick(PYGMY, rng, null, tier));
    }
  } finally {
    vmMath.random = originalRandom;
  }
});

test("intermediate/advanced deals satisfy tierOf, connectivity, length range and no consecutive repeat", () => {
  const E = engine();
  const TIER_LENGTHS = { intermediate: [3, 4], advanced: [4, 5, 6] };
  for (const [id, deck] of [["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA]]) {
    for (const tier of ["intermediate", "advanced"]) {
      let prev = null;
      for (let seed = 0; seed < 2000; seed += 1) {
        const rng = E.sequence.mulberry32(seed);
        const result = E.sequence.pick(deck, rng, prev, tier);
        assert.ok(result.chords, `${id} ${tier} seed ${seed} returned ${result.reason}`);
        const seq = host(result.chords);
        assert.strictEqual(E.sequence.tierOf(deck, seq), tier,
          `${id} ${tier} seed ${seed} ${seq} did not classify as ${tier}`);
        assert.ok(TIER_LENGTHS[tier].includes(seq.length),
          `${id} ${tier} seed ${seed} length ${seq.length} out of range`);
        for (let i = 0; i < seq.length; i += 1) {
          const a = seq[i];
          const b = seq[(i + 1) % seq.length];
          assert.notStrictEqual(a, b,
            `${id} ${tier} seed ${seed} ${seq} has a consecutive repeat at ${i}`);
          assert.ok(connectsRef(deck, a, b),
            `${id} ${tier} seed ${seed} ${a} -> ${b} does not connect`);
        }
        prev = seq;
      }
    }
  }
});

test("intermediate/advanced length is drawn uniformly over the tier's lengths", () => {
  const E = engine();
  const N = 10000;
  for (const tier of ["intermediate", "advanced"]) {
    const lengths = tier === "intermediate" ? [3, 4] : [4, 5, 6];
    const counts = {};
    for (const l of lengths) counts[l] = 0;
    const rng = E.sequence.mulberry32(314);
    let prev = null;
    for (let i = 0; i < N; i += 1) {
      const result = E.sequence.pick(PYGMY, rng, prev, tier);
      counts[result.chords.length] += 1;
      prev = result.chords;
    }
    const expected = 100 / lengths.length;
    for (const l of lengths) {
      const pct = (100 * counts[l]) / N;
      assert.ok(Math.abs(pct - expected) <= 3,
        `${tier} length=${l} share ${pct}% not within 3pp of ${expected}%`);
    }
  }
});

/* -------------------------------------------------------------- D1 step 5 */

test("fallback and empty-tier reasons per D-2/D-6", () => {
  const E = engine();

  // A synthetic 4-card all-anchor deck (home C, Dm, Em, G). A stuck-at-zero
  // rng makes every random attempt identical and rejected (intermediate: the
  // repeated draw always fails tierOf or connects before 512 attempts run
  // out), forcing the DFS fallback - which still finds and deals a sequence.
  const fourCard = syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],
    "1": ["C", 4, 60, "rim", null, "1"], "2": ["E", 4, 64, "rim", null, "2"], "3": ["G", 4, 67, "rim", null, "3"],
    "4": ["D", 4, 62, "rim", null, "4"], "5": ["F", 4, 65, "rim", null, "5"], "6": ["A", 4, 69, "rim", null, "6"],
    "7": ["E", 4, 64, "rim", null, "7"], "8": ["G", 4, 67, "rim", null, "8"], "9": ["B", 4, 71, "rim", null, "9"],
    "10": ["G", 4, 67, "rim", null, "10"], "11": ["B", 4, 71, "rim", null, "11"], "12": ["D", 5, 74, "rim", null, "12"]
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] },
    { main: "Dm", sup: "", fields: [4, 5, 6], roots: [4] },
    { main: "Em", sup: "", fields: [7, 8, 9], roots: [7] },
    { main: "G", sup: "", fields: [10, 11, 12], roots: [10] }
  ]);
  const stuckAtZero = () => 0;
  for (const tier of ["intermediate", "advanced"]) {
    const result = E.sequence.pick(fourCard, stuckAtZero, null, tier);
    assert.ok(result.chords, `${tier} fallback on the 4-card deck should still deal`);
    assert.strictEqual(E.sequence.tierOf(fourCard, host(result.chords)), tier);
  }

  // A synthetic 3-card all-anchor deck (home C, Dm, Em - no non-anchor card
  // and no 4th anchor) has anchors but nothing INTERMEDIATE can build a
  // length-3/4 sequence from without an index repeat, which 3 distinct roots
  // and no sus-resolve pair can never satisfy: NO_TIER_SEQUENCE every time.
  const threeCard = syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],
    "1": ["C", 4, 60, "rim", null, "1"], "2": ["E", 4, 64, "rim", null, "2"], "3": ["G", 4, 67, "rim", null, "3"],
    "4": ["D", 4, 62, "rim", null, "4"], "5": ["F", 4, 65, "rim", null, "5"], "6": ["A", 4, 69, "rim", null, "6"],
    "7": ["E", 4, 64, "rim", null, "7"], "8": ["G", 4, 67, "rim", null, "8"], "9": ["B", 4, 71, "rim", null, "9"]
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] },
    { main: "Dm", sup: "", fields: [4, 5, 6], roots: [4] },
    { main: "Em", sup: "", fields: [7, 8, 9], roots: [7] }
  ]);
  for (let seed = 0; seed < 200; seed += 1) {
    const result = E.sequence.pick(threeCard, E.sequence.mulberry32(seed), null, "intermediate");
    assert.deepStrictEqual(host(result), { chords: null, reason: "NO_TIER_SEQUENCE" },
      `threeCard intermediate seed ${seed} should be NO_TIER_SEQUENCE`);
  }
  // The same deck's ADVANCED tier (no repeat restriction) does find sequences
  // - confirming NO_TIER_SEQUENCE above is tier-specific, not deck-wide.
  const advancedOnThreeCard = E.sequence.pick(threeCard, E.sequence.mulberry32(1), null, "advanced");
  assert.ok(advancedOnThreeCard.chords);

  // NO_HOME_CHORD wins on every tier, reusing the NO_THIRDS fixture from S1-7.
  const full = loadEngine(["core", "voicing", "layout", "naming", "select", "sequence"]);
  const parsed = full.core.parseSeed("(C3) G3 D4 G4 D5", {});
  const noHomeDeck = full.select.build(parsed.value).value;
  for (const tier of ["basic", "intermediate", "advanced"]) {
    const result = tier === "basic"
      ? full.sequence.pick(noHomeDeck, full.sequence.mulberry32(1), null)
      : full.sequence.pick(noHomeDeck, full.sequence.mulberry32(1), null, tier);
    assert.deepStrictEqual(host(result), { chords: null, reason: "NO_HOME_CHORD" },
      `NO_HOME_CHORD should win on tier ${tier}`);
  }

  // D-3 / coordinator nit: when prev is the tier's ONLY sequence, pick
  // returns prev (with a freshly drawn style) rather than NO_TIER_SEQUENCE.
  // A synthetic deck with a single home-root start (chord0, root C) and the
  // sus-resolve pair isolated to chords1/2 (root D) has exactly one
  // intermediate-valid sequence in total: [0,2,1].
  const oneTierSequenceDeck = syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],
    "1": ["C", 4, 60, "rim", null, "1"],
    "2": ["E", 4, 64, "rim", null, "2"],
    "3": ["G", 4, 67, "rim", null, "3"],
    "4": ["D", 4, 62, "rim", null, "4"],
    "5": ["F", 4, 65, "rim", null, "5"],
    "6": ["A", 4, 69, "rim", null, "6"],
    "7": ["D", 5, 74, "rim", null, "7"],
    "8": ["G", 5, 79, "rim", null, "8"],
    "9": ["A", 5, 81, "rim", null, "9"],
    "10": ["C", 6, 84, "rim", null, "10"]
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] },
    { main: "Dm", sup: "", fields: [4, 5, 6], roots: [4] },
    { main: "Dsus4", sup: "add9", fields: [7, 8, 9, 10], roots: [7] }
  ]);
  const onlyTierSequence = [0, 2, 1];
  const styles = new Set();
  for (let seed = 0; seed < 500; seed += 1) {
    const result = E.sequence.pick(oneTierSequenceDeck, E.sequence.mulberry32(seed), onlyTierSequence, "intermediate");
    assert.deepStrictEqual(host(result.chords), onlyTierSequence,
      `seed ${seed} should fall back to prev, the tier's only sequence`);
    styles.add(result.style);
  }
  assert.ok(styles.size > 1, "the style should still be freshly drawn on the fallback-to-prev path");
});

/* -------------------------------------------------------------- D1 step 6 */

test("generated decks: every tier returns a sequence or a reason, never throws, under 50ms", () => {
  const full = loadEngine(["core", "voicing", "layout", "naming", "select", "sequence"]);
  const scales = JSON.parse(
    fs.readFileSync(path.join(ROOT, "tests", "fixtures", "synthetic_scales.json"), "utf8"));
  function fixtureRow(name) {
    const row = scales.find((r) => r.name === name);
    assert.ok(row, `fixture row "${name}" is missing`);
    return row;
  }
  const NINETEEN = fixtureRow("nineteen field maximum").string;
  const TWELVE = fixtureRow("twelve note pan").string;
  function splitSeed(str) {
    const [top, bottom = ""] = str.split("|");
    const tokens = top.trim().split(/\s+/);
    return { ding: tokens[0], top: tokens.slice(1), bottom: bottom.trim() ? bottom.trim().split(/\s+/) : [] };
  }
  function seedOf(str, nTop, nBottom) {
    const parts = splitSeed(str);
    const top = parts.top.slice(0, nTop);
    const bottom = parts.bottom.slice(0, nBottom);
    let s = `${parts.ding} ${top.join(" ")}`;
    if (bottom.length) s += ` | ${bottom.join(" ")}`;
    const parsed = full.core.parseSeed(s);
    assert.equal(parsed.ok, true, `sweep seed did not parse: ${s} (${parsed.code})`);
    return { string: s, seed: parsed.value };
  }
  const sweep = [];
  for (let n = 5; n <= 19; n += 1) {
    const topHeavy = Math.min(n, 13);
    sweep.push({ n, label: `top-heavy N=${n}`, ...seedOf(NINETEEN, topHeavy, n - topHeavy) });
    const nBottom = Math.min(6, Math.floor(n / 3));
    const nTop = Math.min(13, n - nBottom);
    sweep.push({ n, label: `mixed N=${n}`, ...seedOf(NINETEEN, nTop, n - nTop) });
    if (n <= 11) sweep.push({ n, label: `rim-only N=${n}`, ...seedOf(TWELVE, n, 0) });
  }

  for (const row of sweep) {
    const built = full.select.build(row.seed);
    if (!built.ok) continue;
    const deck = built.value;
    for (const tier of ["basic", "intermediate", "advanced"]) {
      const t0 = Date.now();
      let result;
      assert.doesNotThrow(() => {
        result = tier === "basic"
          ? full.sequence.pick(deck, full.sequence.mulberry32(1), null)
          : full.sequence.pick(deck, full.sequence.mulberry32(1), null, tier);
      }, `${row.label} ${tier} threw`);
      const dt = Date.now() - t0;
      assert.ok(dt < 50, `${row.label} ${tier} took ${dt}ms`);
      assert.ok(result.chords || typeof result.reason === "string",
        `${row.label} ${tier} returned neither chords nor a reason`);
    }
  }
});

test("a deck forcing the DFS fallback on every length finishes under 50ms", () => {
  const E = engine();
  const fourCard = syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],
    "1": ["C", 4, 60, "rim", null, "1"], "2": ["E", 4, 64, "rim", null, "2"], "3": ["G", 4, 67, "rim", null, "3"],
    "4": ["D", 4, 62, "rim", null, "4"], "5": ["F", 4, 65, "rim", null, "5"], "6": ["A", 4, 69, "rim", null, "6"],
    "7": ["E", 4, 64, "rim", null, "7"], "8": ["G", 4, 67, "rim", null, "8"], "9": ["B", 4, 71, "rim", null, "9"],
    "10": ["G", 4, 67, "rim", null, "10"], "11": ["B", 4, 71, "rim", null, "11"], "12": ["D", 5, 74, "rim", null, "12"]
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] },
    { main: "Dm", sup: "", fields: [4, 5, 6], roots: [4] },
    { main: "Em", sup: "", fields: [7, 8, 9], roots: [7] },
    { main: "G", sup: "", fields: [10, 11, 12], roots: [10] }
  ]);
  const stuckAtZero = () => 0;
  for (const tier of ["intermediate", "advanced"]) {
    const t0 = Date.now();
    const result = E.sequence.pick(fourCard, stuckAtZero, null, tier);
    const dt = Date.now() - t0;
    assert.ok(result.chords, `${tier} forced fallback should still deal`);
    assert.ok(dt < 50, `${tier} forced fallback took ${dt}ms`);
  }
});

/* -------------------------------------------------------------- S1-8 */

test("the app exposes HPE.sequence", () => {
  const appTestPath = path.join(ROOT, "tests", "app.test.js");
  const src = fs.readFileSync(appTestPath, "utf8");
  assert.ok(/"sequence"/.test(src),
    "tests/app.test.js's module-list assertions should include \"sequence\"");

  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(/<!-- engine:sequence begin/.test(html),
    "index.html has no inlined engine:sequence region - run tools/inline_engine.py");
});
