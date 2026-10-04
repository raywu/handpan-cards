// HPE.sequence - the chord-sequence-mode engine (S1 of
// docs/plans/2026-09-29-chord-sequence-mode.md), extended with difficulty
// tiers (D1 of docs/plans/2026-10-02-sequence-difficulty.md). Tests are named
// exactly as listed in the chord-sequence plan's section 3 ("S1 failing
// tests") for the S1 block, and by the tier plan's §4 step numbers below.
//
// tests/fixtures/sequence_basic_golden.json (D1 step 1b) was first captured
// from the UNMODIFIED engine at main@61b01c2, before any tier code existed,
// and RE-CAPTURED on 2026-10-04 (docs/plans/2026-10-04-easy-tier-amy.md,
// R1-R8: EASY lengths 2..4, any-anchor start) from the engine of that lane,
// with this script (run once, output committed, script itself not checked
// in):
//
//   const fs = require("fs");
//   const { loadEngine } = require("./tests/helpers/engine.js");
//   const DECKS = JSON.parse(fs.readFileSync("data/decks.json", "utf8"));
//   const E = loadEngine(["core", "sequence"]);
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
// This fixture is the EASY-parity oracle (eng E-4): comparing pick-vs-pick
// after an engine edit would pass a mutant that routes BOTH the
// undefined-tier and "basic" calls through the tiered sampler; the fixture
// pins pickBasic's own output and rng consumption, so it cannot share such a
// bug. The pre-tier byte-identical pin (D-1 of the 2026-10-02 plan) was
// lifted with the 2026-10-04 re-capture.
//
// tests/fixtures/sequence_tier_golden.json (D3 step 1) was first captured
// from the UNMODIFIED engine at main@486813c, before any D3 edit, and
// RE-CAPTURED on 2026-10-04 (R5: MEDIUM may start on any anchor) with this
// script (run once, output committed, script itself not checked in). `prev`
// is chained from the previous deal:
//
//   const fs = require("fs");
//   const { loadEngine } = require("./tests/helpers/engine.js");
//   const DECKS = JSON.parse(fs.readFileSync("data/decks.json", "utf8"));
//   const E = loadEngine(["core", "sequence"]);
//   const out = {};
//   for (const id of ["hijaz", "pygmy", "amara"]) {
//     const deck = DECKS.find((d) => d.id === id);
//     out[id] = {};
//     for (const tier of ["intermediate", "advanced"]) {
//       out[id][tier] = [];
//       let prev = null;
//       for (let seed = 0; seed < 200; seed += 1) {
//         const rng = E.sequence.mulberry32(seed);
//         const deal = E.sequence.pick(deck, rng, prev, tier);
//         out[id][tier].push({ seed, chords: deal.chords, style: deal.style, nextRng: rng() });
//         prev = deal.chords;
//       }
//     }
//   }
//   fs.writeFileSync("tests/fixtures/sequence_tier_golden.json", JSON.stringify(out));
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

const TIER_GOLDEN = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests", "fixtures", "sequence_tier_golden.json"), "utf8"));

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
  return loadEngine(["core", "sequence"]);
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

// EASY pool sizes under R1-R4 of docs/plans/2026-10-04-easy-tier-amy.md §2
// (measured at main@01915a6 by the plan's probe).
const EASY_POOL_SIZES = {
  hijaz: { 2: 28, 3: 96, 4: 264 },
  pygmy: { 2: 42, 3: 210, 4: 840 },
  amara: { 2: 20, 3: 60, 4: 120 }
};

test("sequences match the approved golden table on every built-in deck", () => {
  // R2/R7 (2026-10-04): the pool now starts on EVERY anchor, so the approved
  // table is the home-start SUBSET of the pool, in the pool's own order; the
  // whole pool's size is the §2 table, and sequences(deck, 4) exists.
  const E = engine();
  for (const [id, deck] of [["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA]]) {
    const homeIdx = E.sequence._internal.homeAnchor(deck, E.sequence.anchors(deck));
    for (const length of [2, 3]) {
      const pool = host(E.sequence.sequences(deck, length));
      assert.deepStrictEqual(pool.filter((seq) => seq[0] === homeIdx), GOLDEN[id][length],
        `${length}-chord home-start sequences mismatch on ${id}`);
    }
    for (const length of [2, 3, 4]) {
      assert.strictEqual(E.sequence.sequences(deck, length).length, EASY_POOL_SIZES[id][length],
        `${id} length-${length} EASY pool size`);
    }
  }
  assert.throws(() => E.sequence.sequences(HIJAZ, 5), /length must be 2, 3 or 4/);
  assert.throws(() => E.sequence.sequences(HIJAZ, 1), /length must be 2, 3 or 4/);
});

/* -------------------------------------------------------------- S1-3 */

test("every sequence starts on an anchor and every step connects, including back to the first chord", () => {
  // R2-R4 (2026-10-04): the start is ANY anchor, every card is an anchor,
  // roots are distinct, every pair connects and the last chord wraps to the
  // FIRST chord (not to home) at every length 2..4.
  const E = engine();
  for (const deck of [HIJAZ, PYGMY, AMARA]) {
    const anchorsList = host(E.sequence.anchors(deck));
    const seen = new Set();
    for (const length of [2, 3, 4]) {
      for (const seq of host(E.sequence.sequences(deck, length))) {
        assert.ok(anchorsList.includes(seq[0]), `sequence ${seq} does not start on an anchor`);
        for (const idx of seq) assert.ok(anchorsList.includes(idx), `sequence ${seq} uses non-anchor ${idx}`);
        const roots = seq.map((i) => rootPc(deck, i));
        assert.strictEqual(new Set(roots).size, roots.length, `sequence ${seq} repeats a root`);
        for (let i = 0; i < seq.length; i += 1) {
          const a = seq[i];
          const b = seq[(i + 1) % seq.length];
          assert.ok(connectsRef(deck, a, b),
            `${a} -> ${b} does not connect in sequence ${seq} on deck ${deck.id}`);
        }
        const key = seq.join(",");
        assert.ok(!seen.has(key), `sequence ${seq} listed twice on ${deck.id}`);
        seen.add(key);
      }
    }
  }

  // A synthetic deck where B connects home and C connects B, but C does NOT
  // connect back to home - the wrap edge that makes a 3-chord sequence a
  // loop. This is the case a built-in deck never happens to exercise (every
  // (home,B,C) triple it offers already loops back), so it is the only thing
  // that would catch an implementation that dropped the loop-back check.
  // Under R2 the pool also holds the rotations: at length 2 both orderings of
  // each connected pair, [home,B] / [B,home] and [B,C] / [C,B]; at length 3
  // and 4 nothing, since no three anchors form a loop.
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
  assert.deepStrictEqual(host(E.sequence.sequences(loopDeck, 2)), [[0, 1], [1, 0], [1, 2], [2, 1]],
    "home-B and B-C connect, in both orders; home-C shares no tone and its roots are 5 apart");
  assert.deepStrictEqual(host(E.sequence.sequences(loopDeck, 3)), [],
    "home->B->C is not a loop: C shares no tone with home and its root is 5 semitones away");
  assert.deepStrictEqual(host(E.sequence.sequences(loopDeck, 4)), [],
    "three anchors can never fill a 4-chord loop of distinct roots");
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

test("length is drawn 2, 3 or 4 evenly, and style evenly over seven", () => {
  // R1 (2026-10-04): three length buckets, each one third.
  const E = engine();
  const rng = E.sequence.mulberry32(99);
  const N = 10000;
  const lengthCounts = { 2: 0, 3: 0, 4: 0 };
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
  for (const length of [2, 3, 4]) {
    assert.ok(Math.abs(pct(lengthCounts[length]) - 100 / 3) <= 3,
      `length=${length} share ${pct(lengthCounts[length])}% not within 3pp of one third`);
  }
  const expected = 100 / E.sequence.STYLES.length;
  for (const s of E.sequence.STYLES) {
    assert.ok(Math.abs(pct(styleCounts[s]) - expected) <= 3,
      `style "${s}" share ${pct(styleCounts[s])}% not within 3pp of ${expected}%`);
  }
});

test("EASY length is drawn 2 / 3 / 4 within 3 pp of one third each over 6,000 seeded deals on Pygmy", () => {
  const E = engine();
  const N = 6000;
  const counts = { 2: 0, 3: 0, 4: 0 };
  let prev = null;
  for (let seed = 0; seed < N; seed += 1) {
    const result = E.sequence.pick(PYGMY, E.sequence.mulberry32(seed), prev);
    assert.ok(result.chords, `seed ${seed} returned ${result.reason}`);
    counts[result.chords.length] += 1;
    prev = result.chords;
  }
  for (const length of [2, 3, 4]) {
    const pct = (100 * counts[length]) / N;
    assert.ok(Math.abs(pct - 100 / 3) <= 3,
      `length=${length} share ${pct}% not within 3pp of one third`);
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
  // sequences only - both rotations under R2/R8 - and pick() always returns
  // length 2.
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
  assert.deepStrictEqual(host(E.sequence.sequences(twoAnchor, 2)), [[0, 1], [1, 0]]);
  assert.deepStrictEqual(host(E.sequence.sequences(twoAnchor, 3)), []);
  assert.deepStrictEqual(host(E.sequence.sequences(twoAnchor, 4)), []);
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
  // home-C by a shared tone, B-C by a shared tone), so under R2 (any anchor
  // start) sequences(deck,2) is every ordered pair and sequences(deck,3) every
  // permutation; with three anchors there is no length-4 sequence (R4).
  // Six of each is enough to exercise the exclusion-before-length-draw and
  // no-rejection-loop behaviour E4 describes.
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
  assert.deepStrictEqual(host(pool2), [[0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1]]);
  assert.deepStrictEqual(host(pool3),
    [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]);
  assert.deepStrictEqual(host(E.sequence.sequences(deck, 4)), []);

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

  // R8 (2026-10-04): every sequence ships with its rotations, so excluding
  // prev can never empty every pool - a two-anchor deck whose prev is [0,1]
  // still has [1,0]. pick returns that rotation with a drawn style. (The
  // earlier integrator clarification - fall back to prev itself - is now
  // unreachable; the branch stays as a guard.)
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
  assert.deepStrictEqual(host(onlySequence), [[0, 1], [1, 0]]);
  const fallback = E.sequence.pick(oneSequenceDeck, stuckAtZero, [0, 1]);
  assert.deepStrictEqual(host(fallback.chords), [1, 0]);
  assert.strictEqual(typeof fallback.style, "string");
  assert.ok(E.sequence.STYLES.includes(fallback.style));
});

/* ================================================================
 * EASY tier re-spec (docs/plans/2026-10-04-easy-tier-amy.md §2, R1-R8)
 * ================================================================ */

// Chord names as "main|sup" ("Fm", "Gsus|4", "G#°"), resolved to the ANCHOR
// carrying that name (Pygmy ships three cards named Ab; the anchor is the
// first, index 8).
function anchorByName(E, deck, name) {
  const [main, sup] = name.split("|");
  const hit = E.sequence.anchors(deck).find((idx) => {
    const c = deck.chords[idx];
    return c.main === main && (c.sup || "") === (sup || "");
  });
  assert.ok(hit !== undefined, `${deck.id}: no anchor named ${name}`);
  return hit;
}

// Amy Naylor's progressions mapped onto each deck's chord names
// (docs/plans/2026-10-04-amy-naylor-progression-eval.md): all ten on Pygmy,
// A3 and A10 on Amara, A6 on Hijaz.
const AMY_ROWS = {
  pygmy: [
    ["Fm", "Db", "Ab", "Eb"], ["Fm", "Cm", "Db", "Eb"], ["Fm", "Ab", "Eb", "Bbm"],
    ["Fm", "Eb", "Db", "Cm"], ["Fm", "Eb", "Cm", "Db"], ["Ab", "Db", "Eb"],
    ["Ab", "Eb", "Fm", "Db"], ["Ab", "Fm", "Db", "Eb"], ["Db", "Cm", "Bbm", "Ab"],
    ["Bbm", "Eb", "Ab"]
  ],
  amara: [["Dm", "F", "C", "Gsus|4"], ["Gsus|4", "C", "F"]],
  hijaz: [["C#", "F#sus|4", "G#°"]]
};

test("each of Amy's rows is BASIC and in the EASY pool of its deck", () => {
  const E = engine();
  for (const [id, deck] of [["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA]]) {
    for (const row of AMY_ROWS[id]) {
      const seq = row.map((name) => anchorByName(E, deck, name));
      assert.strictEqual(E.sequence.tierOf(deck, seq), "basic",
        `${id} ${row.join(" ")} (${seq}) should classify basic`);
      const pool = host(E.sequence.sequences(deck, seq.length)).map((q) => q.join(","));
      assert.ok(pool.includes(seq.join(",")),
        `${id} ${row.join(" ")} (${seq}) missing from sequences(deck, ${seq.length})`);
    }
  }
});

test("R8: a sequence's rotations are distinct EASY sequences", () => {
  const E = engine();
  const pool = host(E.sequence.sequences(PYGMY, 4)).map((q) => q.join(","));
  assert.ok(pool.includes("0,37,8,43"), "Fm Db Ab Eb missing");
  assert.ok(pool.includes("37,8,43,0"), "Db Ab Eb Fm (rotation) missing");
  assert.ok(pool.includes("8,43,0,37"), "Ab Eb Fm Db (rotation) missing");
  assert.ok(pool.includes("43,0,37,8"), "Eb Fm Db Ab (rotation) missing");
});

test("tiers nest on the five-card fixture: BASIC, INTERMEDIATE and ADVANCED triples", () => {
  const E = engine();
  const deck = fiveCardDeck();
  assert.deepStrictEqual(host(E.sequence.anchors(deck)), [0, 1, 2, 3]);
  assert.strictEqual(E.sequence.tierOf(deck, [1, 2, 3, 0]), "basic",
    "Dm Em G C: anchors only, distinct roots, anchor start");
  assert.strictEqual(E.sequence.tierOf(deck, [1, 2, 4, 0]), "intermediate",
    "Dm Em G7 C: anchor start, a non-anchor card, no repeat");
  assert.strictEqual(E.sequence.tierOf(deck, [4, 0, 1, 2]), "advanced",
    "G7 C Dm Em: starts on a non-anchor, non-home card");
  const pool4 = host(E.sequence.sequences(deck, 4)).map((q) => q.join(","));
  assert.ok(pool4.includes("1,2,3,0"), "the BASIC triple is in the EASY pool");
  assert.ok(!pool4.includes("1,2,4,0"), "the INTERMEDIATE triple is not");
});

// §2 migration table: every connected length-4 loop (each consecutive pair
// connects, the last connects back to the first, no consecutive identical
// card - exactly what makeAccept admits before the tier gate), classified
// under R1-R6.
const MIGRATION_L4 = {
  hijaz: { intermediate: 10033, advanced: 83951 },
  pygmy: { intermediate: 98908, advanced: 5263384 },
  amara: { intermediate: 15241, advanced: 281693 }
};

test("length-4 loops migrate per the §2 table on every built-in deck", () => {
  const E = engine();
  const I = E.sequence._internal;
  for (const [id, deck] of [["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA]]) {
    const anchorsList = E.sequence.anchors(deck);
    const ctx = { anchorsList, home: I.homePc(deck), homeAnchorIdx: I.homeAnchor(deck, anchorsList) };
    const matrix = I.buildConnectMatrix(deck);
    const n = deck.chords.length;
    const counts = { basic: 0, intermediate: 0, advanced: 0, null: 0 };
    const seq = [0, 0, 0, 0];
    for (seq[0] = 0; seq[0] < n; seq[0] += 1) {
      for (seq[1] = 0; seq[1] < n; seq[1] += 1) {
        if (seq[1] === seq[0] || !matrix[seq[0]][seq[1]]) continue;
        for (seq[2] = 0; seq[2] < n; seq[2] += 1) {
          if (seq[2] === seq[1] || !matrix[seq[1]][seq[2]]) continue;
          for (seq[3] = 0; seq[3] < n; seq[3] += 1) {
            if (seq[3] === seq[2] || seq[3] === seq[0]) continue;
            if (!matrix[seq[2]][seq[3]] || !matrix[seq[3]][seq[0]]) continue;
            counts[String(I.classifyTier(deck, seq, ctx))] += 1;
          }
        }
      }
    }
    assert.strictEqual(counts.basic, E.sequence.sequences(deck, 4).length, `${id} basic`);
    assert.strictEqual(counts.intermediate, MIGRATION_L4[id].intermediate, `${id} intermediate`);
    assert.strictEqual(counts.advanced, MIGRATION_L4[id].advanced, `${id} advanced`);
    assert.strictEqual(counts.null, 0, `${id}: a connected length-4 loop classified null`);
  }
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

  // Every EASY sequence (388 / 1,092 / 200 under R1-R4) classifies "basic".
  for (const [id, deck] of [["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA]]) {
    let count = 0;
    for (const length of [2, 3, 4]) {
      for (const seq of E.sequence.sequences(deck, length)) {
        assert.strictEqual(E.sequence.tierOf(deck, seq), "basic",
          `${id} BASIC sequence ${seq} should classify basic`);
        count += 1;
      }
    }
    assert.strictEqual(count, { hijaz: 388, pygmy: 1092, amara: 200 }[id],
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
  assert.strictEqual(E.sequence.tierOf(resolveDeck, [0, 1, 2]), null,
    "the same pair in the other order does not resolve; at length 3 that is not dealable by any tier, so null");

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
  assert.strictEqual(E.sequence.tierOf(capDeck, [0, 1, 2]), null,
    "a 5-field chord should push the sequence past intermediate's 4-note cap, and length 3 is not ADVANCED, so null (root E avoids confounding with Dm's repeated D root)");

  // Nit (perf review on PR #202): a length-2 sequence is exclusively a BASIC
  // shape - neither intermediate ({3,4}) nor advanced ({4,5,6}) ever deal a
  // length-2 sequence - so one that fails BASIC's gate has no tier left to
  // fall through to and must classify null, not default to "advanced". Here
  // chord2 (Em9, 5 fields) is not anchor-eligible, so [0, 2] fails basicGate's
  // "every chord must be an anchor" check.
  assert.strictEqual(E.sequence.tierOf(capDeck, [0, 2]), null,
    "a length-2 sequence that fails BASIC has no tier to fall through to and should classify null");

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
  assert.strictEqual(E.sequence.tierOf(registerDeck, [0, 2, 3]), null,
    "a LOW VOICING card should exclude the sequence from intermediate, and length 3 is not ADVANCED, so null");

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

test("tierOf returns null for a sequence ADVANCED can never deal", () => {
  const E = engine();
  // ADVANCED deals lengths 4..6 only (TIER_LENGTHS), so a connecting
  // 3-chord or 7-chord sequence belongs to no tier. Pygmy's golden ADVANCED
  // cards pin both ends of the range: A1 has 4 chords, A5 has 6.
  assert.strictEqual(E.sequence.tierOf(PYGMY, PYGMY_ADVANCED.A1), "advanced", "4 chords");
  assert.strictEqual(E.sequence.tierOf(PYGMY, PYGMY_ADVANCED.A5), "advanced", "6 chords");
  assert.strictEqual(E.sequence.tierOf(PYGMY, [5, 22, 23]), null, "3 chords that fail INTERMEDIATE");
  const seven = [...PYGMY_ADVANCED.A5, 0];
  assert.strictEqual(seven.length, 7);
  const I = E.sequence._internal;
  const matrix = I.buildConnectMatrix(PYGMY);
  for (let i = 0; i < seven.length; i += 1) {
    const next = seven[(i + 1) % seven.length];
    assert.ok(seven[i] !== next && matrix[seven[i]][next], `seven-chord fixture breaks at ${i}`);
  }
  assert.strictEqual(E.sequence.tierOf(PYGMY, seven), null, "7 chords connect but ADVANCED never deals 7");
});

/* -------------------------------------------------------------- D1 step 3 */

test("TIERS lists the three tier ids in order", () => {
  const E = engine();
  assert.deepStrictEqual(host(E.sequence.TIERS), ["basic", "intermediate", "advanced"]);
});

/* -------------------------------------------------------------- D1 step 4 */

test("pick(..., undefined) and pick(..., \"basic\") reproduce the EASY golden fixture", () => {
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

test("built-in INTERMEDIATE/ADVANCED deals match the tier golden fixture", () => {
  const E = engine();
  for (const [id, deck] of [["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA]]) {
    for (const tier of ["intermediate", "advanced"]) {
      let prev = null;
      for (const row of TIER_GOLDEN[id][tier]) {
        const rng = E.sequence.mulberry32(row.seed);
        const deal = E.sequence.pick(deck, rng, prev, tier);
        assert.deepStrictEqual(host(deal.chords), row.chords,
          `${id} ${tier} seed ${row.seed} chords diverged from the tier golden fixture`);
        assert.strictEqual(deal.style, row.style);
        assert.strictEqual(rng(), row.nextRng);
        prev = deal.chords;
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

// Synthetic DFS-fallback fixtures (shared by step 5, the timing test and the
// nesting test). fourCardDeck: four all-anchor cards (home C, Dm, Em, G).
// fiveCardDeck: the same four plus G7 (G B D F, four fields, root G) as chord
// index 4 - a non-anchor card, so INTERMEDIATE has something to build a
// non-BASIC sequence from (2026-10-04: under R6 every all-anchor,
// distinct-root sequence of length 2..4 is BASIC, which leaves the four-card
// deck no INTERMEDIATE sequence at all).
function fourCardDeck() {
  return syntheticDeck({
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
}
function fiveCardDeck() {
  return syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],
    "1": ["C", 4, 60, "rim", null, "1"], "2": ["E", 4, 64, "rim", null, "2"], "3": ["G", 4, 67, "rim", null, "3"],
    "4": ["D", 4, 62, "rim", null, "4"], "5": ["F", 4, 65, "rim", null, "5"], "6": ["A", 4, 69, "rim", null, "6"],
    "7": ["E", 4, 64, "rim", null, "7"], "8": ["G", 4, 67, "rim", null, "8"], "9": ["B", 4, 71, "rim", null, "9"],
    "10": ["G", 4, 67, "rim", null, "10"], "11": ["B", 4, 71, "rim", null, "11"], "12": ["D", 5, 74, "rim", null, "12"],
    "13": ["G", 3, 55, "rim", null, "13"], "14": ["B", 3, 59, "rim", null, "14"], "15": ["D", 4, 62, "rim", null, "15"], "16": ["F", 4, 65, "rim", null, "16"]
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] },
    { main: "Dm", sup: "", fields: [4, 5, 6], roots: [4] },
    { main: "Em", sup: "", fields: [7, 8, 9], roots: [7] },
    { main: "G", sup: "", fields: [10, 11, 12], roots: [10] },
    { main: "G", sup: "7", fields: [13, 14, 15, 16], roots: [13] }
  ]);
}

test("fallback and empty-tier reasons per D-2/D-6", () => {
  const E = engine();

  // The five-card deck (four anchors + G7). A stuck-at-zero rng makes every
  // random attempt identical and rejected (intermediate: the repeated draw
  // always fails tierOf or connects before 512 attempts run out), forcing
  // the DFS fallback - which still finds and deals a sequence.
  const fiveCard = fiveCardDeck();
  const stuckAtZero = () => 0;
  for (const tier of ["intermediate", "advanced"]) {
    const result = E.sequence.pick(fiveCard, stuckAtZero, null, tier);
    assert.ok(result.chords, `${tier} fallback on the 5-card deck should still deal`);
    assert.strictEqual(E.sequence.tierOf(fiveCard, host(result.chords)), tier);
  }

  // The four-card all-anchor deck: every connected distinct-root loop of
  // length 3 or 4 is BASIC under R6, and a repeat is never a sus-resolve, so
  // INTERMEDIATE has no sequence (NO_TIER_SEQUENCE on every seed) while
  // ADVANCED - which allows repeats - still deals.
  const fourCard = fourCardDeck();
  for (let seed = 0; seed < 200; seed += 1) {
    const result = E.sequence.pick(fourCard, E.sequence.mulberry32(seed), null, "intermediate");
    assert.deepStrictEqual(host(result), { chords: null, reason: "NO_TIER_SEQUENCE" },
      `fourCard intermediate seed ${seed} should be NO_TIER_SEQUENCE`);
  }
  assert.ok(E.sequence.pick(fourCard, E.sequence.mulberry32(1), null, "advanced").chords);

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
  // intermediate-valid sequence in total: [0,2,1]. Under R5 an anchor may
  // also start a MEDIUM sequence, so chord1 is a four-field Dm7: in the
  // MEDIUM pool, but not an anchor, keeping chord0 the only legal start.
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
    { main: "Dm", sup: "7", fields: [4, 5, 6, 10], roots: [4] },
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

/* -------------------------------------------------------------- D3 shared fixtures */

// Built once, on first use, and shared by every test below (D3 N4): building
// ~65 generated decks per test would repeat the work the sweep, the nesting
// test and the register tests each need. A failed build asserts at first use,
// so one bad row fails the test that needed it, not the whole file.
const FULL_ENGINE_MODULES = ["core", "voicing", "layout", "naming", "select", "sequence"];
const REGISTER_ANCHOR_SEED = "(A2) C3 E3 G#3 A#3 C4 E4 G4 G#4 A4 A#4 C#5 | G#2 E3 F3 G3";
const REGISTER_HOME_SEED = "(A#2) D3 E3 F#3 G3 A3 A#3 D#4 F4 A#4 C5 | F2 A#2 D#3 E3 F4";
const REVIEWER_SEEDS = [
  "(G3) D4 F4 F#4 B4 F#5 G5 A#5",
  "(A3) E4 G4 G#4 A4 C5 D#5 E5 A5",
  "(B3) F4 F#4 A4 B4 C5 D5 F5 F#5 A5 B5 C6 D6",
  "(G#3) E4 G4 G#4 A4 C5 D#5 G#5"
];

let generatedFixtures = null;
function generated() {
  if (generatedFixtures) return generatedFixtures;
  const full = loadEngine(FULL_ENGINE_MODULES);
  function buildDeck(str) {
    const parsed = full.core.parseSeed(str, {});
    assert.equal(parsed.ok, true, `fixture seed did not parse: ${str} (${parsed.code})`);
    const built = full.select.build(parsed.value);
    assert.equal(built.ok, true, `fixture seed did not build: ${str}`);
    return built.value;
  }
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
    let seedString = `${parts.ding} ${top.join(" ")}`;
    if (bottom.length) seedString += ` | ${bottom.join(" ")}`;
    return seedString;
  }
  const sweep = [];
  for (let n = 5; n <= 19; n += 1) {
    const topHeavy = Math.min(n, 13);
    sweep.push({ n, label: `top-heavy N=${n}`, string: seedOf(NINETEEN, topHeavy, n - topHeavy) });
    const nBottom = Math.min(6, Math.floor(n / 3));
    const nTop = Math.min(13, n - nBottom);
    sweep.push({ n, label: `mixed N=${n}`, string: seedOf(NINETEEN, nTop, n - nTop) });
    if (n <= 11) sweep.push({ n, label: `rim-only N=${n}`, string: seedOf(TWELVE, n, 0) });
  }
  const synthetic = scales
    .map((row) => ({ name: row.name, parsed: full.core.parseSeed(row.string, {}) }))
    .filter((r) => r.parsed.ok)
    .map((r) => ({ label: r.name, built: full.select.build(r.parsed.value) }))
    .filter((r) => r.built.ok)
    .map((r) => ({ label: r.label, deck: r.built.value }));
  generatedFixtures = {
    full,
    synthetic,
    sweep: sweep.map((row) => ({ ...row, deck: buildDeck(row.string) })),
    reviewer: REVIEWER_SEEDS.map((str) => ({ label: str, string: str, deck: buildDeck(str) })),
    registerAnchor: buildDeck(REGISTER_ANCHOR_SEED),
    registerHome: buildDeck(REGISTER_HOME_SEED)
  };
  return generatedFixtures;
}

test("generated decks: every tier deals its own tier, in range and connected, under 50ms", () => {
  const { full, sweep, reviewer, registerAnchor, registerHome } = generated();
  const rows = [
    ...sweep.map((r) => ({ label: r.label, deck: r.deck })),
    ...reviewer.map((r, i) => ({ label: `reviewer deck ${i}`, deck: r.deck })),
    { label: "REGISTER_ANCHOR_DECK", deck: registerAnchor },
    { label: "REGISTER_HOME_DECK", deck: registerHome }
  ];
  assert.strictEqual(rows.length, 37 + 4 + 2, "the sweep is 37 decks + 4 reviewer decks + 2 register decks");
  const LENGTHS = { basic: [2, 3, 4], intermediate: [3, 4], advanced: [4, 5, 6] };
  const S = full.sequence;
  const noHomeRows = new Set();
  const reasons = {};
  for (const row of rows) {
    const deck = row.deck;
    const homeAnchorIdx = S._internal.homeAnchor(deck, S.anchors(deck));
    for (const tier of ["basic", "intermediate", "advanced"]) {
      let prev = null;
      for (let seed = 0; seed < 5; seed += 1) {
        const t0 = Date.now();
        let result;
        assert.doesNotThrow(() => {
          result = tier === "basic"
            ? S.pick(deck, S.mulberry32(seed), prev)
            : S.pick(deck, S.mulberry32(seed), prev, tier);
        }, `${row.label} ${tier} seed ${seed} threw`);
        const dt = Date.now() - t0;
        assert.ok(dt < 50, `${row.label} ${tier} seed ${seed} took ${dt}ms`);
        if (!result.chords) {
          assert.strictEqual(result.reason, "NO_HOME_CHORD",
            `${row.label} ${tier} seed ${seed} returned ${result.reason}, not a deal`);
          assert.strictEqual(homeAnchorIdx, null,
            `${row.label} ${tier} seed ${seed}: NO_HOME_CHORD on a deck that has a home anchor`);
          noHomeRows.add(row.label);
          reasons[tier] = (reasons[tier] || 0) + 1;
          continue;
        }
        const chords = host(result.chords);
        assert.strictEqual(homeAnchorIdx === null, false,
          `${row.label} ${tier} seed ${seed}: dealt on a deck with no home anchor`);
        assert.strictEqual(S.tierOf(deck, chords), tier,
          `${row.label} ${tier} seed ${seed} dealt ${JSON.stringify(chords)} which tierOf calls ${S.tierOf(deck, chords)}`);
        assert.ok(LENGTHS[tier].includes(chords.length),
          `${row.label} ${tier} seed ${seed} dealt length ${chords.length}`);
        for (let i = 0; i < chords.length; i += 1) {
          const next = chords[(i + 1) % chords.length];
          assert.notStrictEqual(chords[i], next, `${row.label} ${tier} seed ${seed}: identical neighbours at ${i}`);
          assert.ok(connectsRef(deck, chords[i], next),
            `${row.label} ${tier} seed ${seed}: ${chords[i]} -> ${next} does not connect`);
        }
        prev = chords;
      }
    }
  }
  assert.strictEqual(noHomeRows.size, 3, `NO_HOME_CHORD rows: ${[...noHomeRows].join(", ")}`);
  assert.deepStrictEqual(reasons, { basic: 15, intermediate: 15, advanced: 15 },
    "exactly 3 rows x 5 seeds per tier carry NO_HOME_CHORD");
});

test("a deck forcing the DFS fallback on every length finishes under 50ms", () => {
  const E = engine();
  const fiveCard = fiveCardDeck();
  const stuckAtZero = () => 0;
  for (const tier of ["intermediate", "advanced"]) {
    const t0 = Date.now();
    const result = E.sequence.pick(fiveCard, stuckAtZero, null, tier);
    const dt = Date.now() - t0;
    assert.ok(result.chords, `${tier} forced fallback should still deal`);
    assert.ok(dt < 50, `${tier} forced fallback took ${dt}ms`);
  }
});

// Perf review on PR #202 (reviewer FAIL @ f037e86): pick() recomputed
// anchors/home inside tierOf on every accept() call in the hot sampling and
// DFS-fallback loops, so these four specific generated decks - all of which
// land in the "length 4 pool empty, drop to exhaustive DFS" path for at
// least one tier - measured 54-107ms, over the 50ms bound (D1 step 6 / E-1).
// The fix computes a ctx (anchors list, home pc, home anchor index) once per
// pick() call and threads it through the sampler/DFS instead of recomputing
// per leaf; accept() also now checks the cheap matrix/identical-card rule
// before the tier gate. Swept over seeds 0..49 on every tier to catch any
// seed-dependent regression, not just the reviewer's reported seeds.
test("the four reviewer-reported slow decks finish under 50ms over seeds 0..49", () => {
  const { full, reviewer } = generated();
  for (const { string: s, deck } of reviewer) {
    for (const tier of ["basic", "intermediate", "advanced"]) {
      for (let seed = 0; seed < 50; seed += 1) {
        const t0 = Date.now();
        let result;
        assert.doesNotThrow(() => {
          result = tier === "basic"
            ? full.sequence.pick(deck, full.sequence.mulberry32(seed), null)
            : full.sequence.pick(deck, full.sequence.mulberry32(seed), null, tier);
        }, `${s} ${tier} seed ${seed} threw`);
        const dt = Date.now() - t0;
        assert.ok(dt < 50, `${s} ${tier} seed ${seed} took ${dt}ms`);
        assert.ok(result.chords || typeof result.reason === "string",
          `${s} ${tier} seed ${seed} returned neither chords nor a reason`);
      }
    }
  }
});

// Perf review on PR #202: a stuck rng (every draw forced to 0) on the
// built-in Pygmy deck (52 chords, the largest built-in) forces the full DFS
// fallback - the reviewer measured 8965ms on advanced before the fix. The
// fix's ctx-sharing and connectivity pruning alone brought this to ~100ms,
// still over budget purely because Pygmy's accepted set at this tier is
// itself close to the (then) 200,000-node budget. A first pass capped
// DFS_NODE_BUDGET at 40,000 (~22-27ms locally) but CI's runner is slower
// than local hardware and measured 64ms there (still over 50ms) - a timing
// assertion alone is hardware-flaky. DFS_NODE_BUDGET is now 15,000
// (src/engine/sequence.js), which measured ~8.4-10.5ms locally (a budget
// sweep at 40k/30k/25k/20k/15k/10k showed an ~linear budget-to-time
// relationship, so the ~2.5-3x local-to-CI slowdown observed at 40,000
// projects 15,000 to roughly 20-26ms in CI - comfortably under 50ms with
// headroom for CI variance). "lengths 5-6" in the review ask are advanced's
// natural {4,5,6} range; intermediate only ever draws length 3-4, so it is
// exercised at its own natural lengths below - both tiers go through the
// identical forced-DFS path on this deck regardless of which length is
// drawn.
test("Pygmy forced-fallback (stuck rng) finishes under 50ms for advanced and intermediate", () => {
  const DECKS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "decks.json"), "utf8"));
  const pygmy = DECKS.find((d) => d.id === "pygmy");
  assert.ok(pygmy, "pygmy deck missing from data/decks.json");
  const E = engine();
  const stuckAtZero = () => 0;
  for (const tier of ["intermediate", "advanced"]) {
    for (let run = 0; run < 3; run += 1) {
      const t0 = Date.now();
      const result = E.sequence.pick(pygmy, stuckAtZero, null, tier);
      const dt = Date.now() - t0;
      assert.ok(result.chords || typeof result.reason === "string",
        `pygmy ${tier} run ${run} returned neither chords nor a reason`);
      assert.ok(dt < 50, `pygmy ${tier} run ${run} forced fallback took ${dt}ms`);
    }
  }
});

// Hardware-independent companion to the timing test above: a wall-clock
// bound is only ever a proxy, and CI's runner proved slower than local
// hardware (see the comment above). This asserts the actual invariant the
// budget is meant to guarantee - dfsFindAll never visits more than
// DFS_NODE_BUDGET nodes - by reconstructing the exact fallback path
// pick()/attemptLength() takes for Pygmy (the largest built-in, so its
// worst case bounds every other built-in and every realistic generated
// deck) at every length each tier actually draws, independent of rng,
// JIT warmup or runner speed.
test("Pygmy's DFS fallback never exceeds DFS_NODE_BUDGET nodes, at every tier length", () => {
  const DECKS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "decks.json"), "utf8"));
  const pygmy = DECKS.find((d) => d.id === "pygmy");
  assert.ok(pygmy, "pygmy deck missing from data/decks.json");
  const E = engine();
  const I = E.sequence._internal;
  const TIER_LENGTHS = { intermediate: [3, 4], advanced: [4, 5, 6] };
  const matrix = I.buildConnectMatrix(pygmy);
  const anchorsList = E.sequence.anchors(pygmy);
  const home = I.homePc(pygmy);
  const homeAnchorIdx = I.homeAnchor(pygmy, anchorsList);
  const ctx = { anchorsList, home, homeAnchorIdx };
  for (const tier of ["intermediate", "advanced"]) {
    const pool = I.tierPool(pygmy, tier, anchorsList);
    const startSet = I.tierStartSet(pygmy, tier, pool, anchorsList);
    for (const len of TIER_LENGTHS[tier]) {
      function accept(seq) {
        for (let i = 0; i < seq.length; i += 1) {
          const next = seq[(i + 1) % seq.length];
          if (seq[i] === next) return false;
          if (!matrix[seq[i]][next]) return false;
        }
        return I.classifyTier(pygmy, seq, ctx) === tier;
      }
      const stats = {};
      I.dfsFindAll(startSet, pool, len, accept, I.DFS_NODE_BUDGET, matrix, stats);
      assert.ok(stats.nodes <= I.DFS_NODE_BUDGET,
        `pygmy ${tier} length ${len}: dfsFindAll visited ${stats.nodes} nodes, over the ${I.DFS_NODE_BUDGET} budget`);
    }
  }
});

/* -------------------------------------------------------------- D3 step 5 */

// The DFS fallback's completion and budget boundary (D3 §9.1(c)). The older
// ceiling test above (stats.nodes <= DFS_NODE_BUDGET) holds whenever the
// budget guards exist, so it cannot see the connectivity or identical-card
// prune go missing: a search that loses a prune just fills the whole budget.
// These tests use a search that COMPLETES under the budget with the prunes and
// does not complete without them: the reviewer deck
// "(G3) D4 F4 F#4 B4 F#5 G5 A#5" at ADVANCED length 4 visits 13,605 nodes
// (found 10,468) of the 15,000 budget; without the matrix prune it truncates
// at 15,000 with 9,130 found, without the identical-card prune with 8,842.
// HEADROOM: the margin is 9%. A red result here means the prunes or the budget
// moved so that a real generated deck the reviewer found no longer completes;
// it is not a stale deck.
const DFS_COMPLETE_NODES = 13605;

function dfsRun(E, deck, tier, len, budget) {
  const I = E.sequence._internal;
  const matrix = I.buildConnectMatrix(deck);
  const anchorsList = E.sequence.anchors(deck);
  const ctx = { anchorsList, home: I.homePc(deck), homeAnchorIdx: I.homeAnchor(deck, anchorsList) };
  const pool = I.tierPool(deck, tier, anchorsList);
  const startSet = I.tierStartSet(deck, tier, pool, anchorsList);
  const accept = I.makeAccept(deck, tier, matrix, null, ctx);
  const stats = {};
  const found = host(I.dfsFindAll(startSet, pool, len, accept, budget, matrix, stats));
  const brute = [];
  const seq = new Array(len);
  (function walk(depth) {
    if (depth === len) {
      if (accept(seq)) brute.push(seq.slice());
      return;
    }
    for (const c of (depth === 0 ? startSet : pool)) {
      seq[depth] = c;
      walk(depth + 1);
    }
  })(0);
  const key = (list) => list.map((q) => q.join(",")).sort();
  return { stats: host(stats), found, foundKeys: key(found), bruteKeys: key(brute) };
}

test("the DFS fallback completes and finds the exact exhaustive set", () => {
  const { full, reviewer } = generated();
  const cases = [
    ["reviewer deck 0 ADVANCED L4", reviewer[0].deck, "advanced", 4],
    ["hijaz INTERMEDIATE L3", HIJAZ, "intermediate", 3],
    ["pygmy INTERMEDIATE L3", PYGMY, "intermediate", 3],
    ["amara INTERMEDIATE L3", AMARA, "intermediate", 3]
  ];
  const budget = full.sequence._internal.DFS_NODE_BUDGET;
  for (const [label, deck, tier, len] of cases) {
    const run = dfsRun(full, deck, tier, len, budget);
    assert.ok(run.stats.nodes <= budget, `${label}: ${run.stats.nodes} nodes, over the ${budget} budget`);
    assert.strictEqual(run.stats.truncated, false, `${label}: the search was truncated at ${run.stats.nodes} nodes`);
    assert.ok(run.bruteKeys.length > 0, `${label}: brute force found nothing, so the case proves nothing`);
    assert.deepStrictEqual(run.foundKeys, run.bruteKeys, `${label}: DFS set differs from brute force`);
  }
});

test("the DFS budget truncates exactly at the boundary", () => {
  const { full, reviewer } = generated();
  const deck = reviewer[0].deck;
  const exact = dfsRun(full, deck, "advanced", 4, DFS_COMPLETE_NODES);
  assert.strictEqual(exact.stats.nodes, DFS_COMPLETE_NODES);
  assert.strictEqual(exact.stats.truncated, false, "finishing on the last allowed node is complete, not truncated");
  assert.deepStrictEqual(exact.foundKeys, exact.bruteKeys);
  const short = dfsRun(full, deck, "advanced", 4, DFS_COMPLETE_NODES - 1);
  assert.strictEqual(short.stats.truncated, true, "one node short of the full search must report truncation");
  assert.ok(short.stats.nodes <= DFS_COMPLETE_NODES - 1,
    `${short.stats.nodes} nodes visited under a budget of ${DFS_COMPLETE_NODES - 1}`);
  assert.ok(short.foundKeys.length < exact.foundKeys.length);
});

/* -------------------------------------------------------------- D3 step 2 */

// D-14 (owner): "Starting chords always allowed". Every BASIC anchor is in the
// INTERMEDIATE pool, LOW/HIGH register or not, so BASIC nests inside
// INTERMEDIATE on every deck. The nesting probe behind this (46 of 1,894 decks
// broke it on main) covered 3 + 11 + 1880 = 1,894 decks: the 3 built-ins, the 11
// synthetic_scales.json rows that build (the other 9 are deliberate parse/build
// rejects; 3 of the 11 are the built-ins again), and 1,880 random generated
// decks. This test covers the first two groups plus the sweep and the two
// register fixtures; none of the synthetic or sweep decks has a register-labelled
// anchor, so REGISTER_ANCHOR_DECK and REGISTER_HOME_DECK carry the case.
test("every BASIC anchor is in the INTERMEDIATE pool on every deck", () => {
  const fx = generated();
  const E = engine();
  const decks = [
    ["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA],
    ...fx.synthetic.map((r) => [r.label, r.deck]),
    ...fx.sweep.map((r) => [r.label, r.deck]),
    ["REGISTER_ANCHOR_DECK", fx.registerAnchor],
    ["REGISTER_HOME_DECK", fx.registerHome]
  ];
  assert.strictEqual(fx.synthetic.length, 11, "11 of the 20 synthetic rows build");
  for (const [label, deck] of decks) {
    const anchorsList = host(E.sequence.anchors(deck));
    const pool = host(E.sequence._internal.tierPool(deck, "intermediate", anchorsList));
    for (const idx of anchorsList) {
      assert.ok(pool.includes(idx),
        `${label}: BASIC anchor ${idx} [${deck.chords[idx].main}${deck.chords[idx].sup || ""} ${deck.chords[idx].subtitle}] is missing from the INTERMEDIATE pool`);
    }
  }
});

test("INTERMEDIATE deals a register-labelled anchor", () => {
  const { full, registerAnchor, registerHome } = generated();
  const S = full.sequence;
  assert.strictEqual(S.tierOf(registerAnchor, [0, 14, 8]), "intermediate",
    "A -> C (HIGH VOICING anchor) -> A#dim connects and every card is an anchor or plain");

  let prev = null;
  let containing = 0;
  for (let seed = 0; seed < 500; seed += 1) {
    const deal = S.pick(registerAnchor, S.mulberry32(seed), prev, "intermediate");
    assert.ok(deal.chords, `seed ${seed} dealt nothing (${deal.reason})`);
    assert.strictEqual(S.tierOf(registerAnchor, deal.chords), "intermediate",
      `seed ${seed} dealt ${JSON.stringify(deal.chords)} which is not intermediate`);
    if (deal.chords.includes(14)) containing += 1;
    prev = deal.chords;
  }
  assert.ok(containing > 0, "no INTERMEDIATE deal in 500 contained the HIGH VOICING anchor 14");

  const homeAnchorIdx = S._internal.homeAnchor(registerHome, S.anchors(registerHome));
  assert.strictEqual(homeAnchorIdx, 2, "REGISTER_HOME_DECK's home anchor is chord 2");
  prev = null;
  let startsOnHome = 0;
  for (let seed = 0; seed < 500; seed += 1) {
    const deal = S.pick(registerHome, S.mulberry32(seed), prev, "intermediate");
    assert.ok(deal.chords, `home deck seed ${seed} dealt nothing (${deal.reason})`);
    assert.strictEqual(S.tierOf(registerHome, deal.chords), "intermediate");
    if (deal.chords[0] === 2) startsOnHome += 1;
    prev = deal.chords;
  }
  assert.ok(startsOnHome > 0, "no INTERMEDIATE deal started on the register-labelled home anchor");
});

test("no built-in anchor is a register-labelled anchor, so the exemption is a no-op there", () => {
  const E = engine();
  for (const [id, deck] of [["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA]]) {
    for (const idx of host(E.sequence.anchors(deck))) {
      assert.ok(!/\b(LOW|HIGH) VOICING\b/.test(deck.chords[idx].subtitle || ""),
        `${id} anchor ${idx} carries a LOW/HIGH subtitle`);
    }
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

/* ------------------------------------------------------------- EG-1 */

test("EG-1 sequence pickers share one validity rule", () => {
  const E = engine();
  const I = E.sequence._internal;
  assert.equal(typeof I.prevValid, "function");
  assert.equal(typeof I.homeOrRefuse, "function");
  for (const [id, deck] of [["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA]]) {
    const n = deck.chords.length;
    const invalid = [undefined, null, "abc", [], [n], [-1], [0, "1"], [0, n + 3]];
    const valid = [[0], [0, 1], [n - 1]];
    for (const prev of invalid) assert.equal(I.prevValid(deck, prev), false, `${id} ${JSON.stringify(prev)}`);
    for (const prev of valid) assert.equal(I.prevValid(deck, prev), true, `${id} ${JSON.stringify(prev)}`);
    for (const tier of ["basic", "intermediate", "advanced"]) {
      for (let seed = 0; seed < 20; seed += 1) {
        const base = host(E.sequence.pick(deck, E.sequence.mulberry32(seed), null, tier));
        for (const prev of invalid) {
          const got = host(E.sequence.pick(deck, E.sequence.mulberry32(seed), prev, tier));
          assert.deepEqual(got, base, `${id} ${tier} seed ${seed} prev ${JSON.stringify(prev)}`);
        }
        if (base.chords) {
          const again = host(E.sequence.pick(deck, E.sequence.mulberry32(seed), base.chords, tier));
          if (again.chords && E.sequence.pick(deck, E.sequence.mulberry32(seed), base.chords, tier).chords) {
            assert.notDeepEqual(again.chords, base.chords, `${id} ${tier} seed ${seed} repeated prev`);
          }
        }
      }
    }
  }
  const noHome = { fields: { 1: ["A", 3, 57, "rim", 0, "A"] }, chords: [] };
  const refused = I.homeOrRefuse(noHome);
  assert.equal(refused.refusal.reason, "NO_HOME_CHORD");
  assert.equal(refused.refusal.chords, null);
  const ok = I.homeOrRefuse(HIJAZ);
  assert.equal(ok.refusal, null);
  assert.equal(typeof ok.homeAnchorIdx, "number");
});

/* ------------------------------------------------------------- EG-2 */

test("EG-2 sequence and voicing take pc/isDing from core at use time", () => {
  const E = loadEngine(["core", "voicing", "sequence"]);
  let pcCalls = 0;
  let dingCalls = 0;
  const realPc = E.core.pc;
  const realDing = E.core.isDing;
  E.core.pc = (n) => { pcCalls += 1; return realPc(n); };
  E.core.isDing = (rec) => { dingCalls += 1; return realDing(rec); };

  E.sequence.anchors(AMARA);
  assert.ok(pcCalls > 0, "sequence.anchors never reached core.pc");
  pcCalls = 0;
  E.sequence._internal.homePc(AMARA);
  assert.ok(pcCalls > 0 && dingCalls > 0, "sequence.homePc skipped core.pc/core.isDing");

  pcCalls = 0;
  const rootPc = realPc(AMARA.fields["1"][2]);
  E.voicing.choose(AMARA.fields, rootPc, [0, 3, 7]);
  assert.ok(pcCalls > 0, "voicing.choose never reached core.pc");

  const late = loadEngine(["sequence", "core"]);
  assert.equal(typeof late.sequence.anchors, "function", "sequence must load before core");
  assert.deepEqual(host(late.sequence.anchors(AMARA)), host(E.sequence.anchors(AMARA)),
    "core must be read when anchors runs, not when sequence loads");
});
