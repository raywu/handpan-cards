// HPE.sequence - the chord-sequence-mode engine (S1 of
// docs/plans/2026-09-29-chord-sequence-mode.md), extended with difficulty
// tiers (D1 of docs/plans/2026-10-02-sequence-difficulty.md). Tests are named
// exactly as listed in the chord-sequence plan's section 3 ("S1 failing
// tests") for the S1 block, and by the tier plan's §4 step numbers below.
//
// tests/fixtures/sequence_basic_golden.json (D1 step 1b) was first captured
// from the UNMODIFIED engine at main@61b01c2, before any tier code existed,
// RE-CAPTURED on 2026-10-04 (docs/plans/2026-10-04-easy-tier-amy.md,
// R1-R8: EASY lengths 2..4, any-anchor start), and RE-CAPTURED AGAIN on
// 2026-10-04 for the tier rebalance (docs/plans/2026-10-04-tier-rebalance.md
// R-1..R-3: triad-anchor vocabulary, home / relative start, weighted
// length and side draws) from the engine of that lane, with this script (run
// once, output committed, script itself not checked in):
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
//   fs.writeFileSync("tests/fixtures/sequence_basic_golden.json", JSON.stringify(out, null, 2) + "\n");
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
// RE-CAPTURED on 2026-10-04 (R5: MEDIUM may start on any anchor), and
// RE-CAPTURED AGAIN on 2026-10-04 for the tier rebalance
// (docs/plans/2026-10-04-tier-rebalance.md R-4..R-7: MEDIUM cells, broad HARD
// gate) with this script (run once, output committed, script itself not
// checked in). `prev` is chained from the previous deal:
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
  // R-1 (2026-10-04 tier rebalance): BASIC vocabulary is the TRIAD anchors
  // (plus the home anchor), so Pygmy's G° (index 6) and Amara's Gsus4
  // (index 14) leave the pool; Hijaz keeps every anchor under the R-3
  // fallback (its triad-only pool is one loop).
  pygmy: {
    2: [
      [0, 9], [0, 20], [0, 25], [0, 38], [0, 44]
    ],
    3: [
      [0, 9, 20], [0, 9, 25], [0, 9, 38], [0, 9, 44],
      [0, 20, 9], [0, 20, 25], [0, 20, 38], [0, 20, 44],
      [0, 25, 9], [0, 25, 20], [0, 25, 38], [0, 25, 44],
      [0, 38, 9], [0, 38, 20], [0, 38, 25], [0, 38, 44],
      [0, 44, 9], [0, 44, 20], [0, 44, 25], [0, 44, 38]
    ]
  },
  amara: {
    2: [
      [0, 8], [0, 17], [0, 22]
    ],
    3: [
      [0, 8, 17], [0, 8, 22],
      [0, 17, 8], [0, 17, 22],
      [0, 22, 8], [0, 22, 17]
    ]
  }
};

const ANCHORS_1BASED = {
  hijaz: [1, 7, 9, 11, 13, 15],
  pygmy: [1, 8, 10, 21, 26, 39, 45],
  amara: [1, 9, 16, 18, 23]
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

// BASIC pool sizes under R-1..R-3 of docs/plans/2026-10-04-tier-rebalance.md
// §4 (measured by the plan's probe): Pygmy = Fm 5/20/60 + Ab 5/20/60, Amara
// = Dm 3/6/6 + F 3/6/6, Hijaz = C# 5/18/48 under the R-3 fallback.
const EASY_POOL_SIZES = {
  hijaz: { 2: 5, 3: 18, 4: 48 },
  pygmy: { 2: 10, 3: 40, 4: 120 },
  amara: { 2: 6, 3: 12, 4: 12 }
};

test("sequences match the approved golden table on every built-in deck", () => {
  // R-9 (2026-10-04): sequences() is the BASIC pool - loops over the triad
  // anchors starting on home or (minor home only) the relative start - so
  // the approved table is the home-start SUBSET of the pool, in the pool's
  // own order; the whole pool's size is the §4 table, and sequences(deck, 4)
  // exists.
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
        `${id} length-${length} BASIC pool size`);
    }
  }
  // R-3: Hijaz's triad-only pool is the single loop C# Bm, under
  // MIN_BASIC_POOL, so its vocabulary widens to every anchor; the other two
  // decks stay triad-only (G° and Gsus4 never appear).
  const I = E.sequence._internal;
  assert.strictEqual(I.MIN_BASIC_POOL, 12);
  assert.deepStrictEqual(host(I.tierContext(HIJAZ).basicVocab), host(E.sequence.anchors(HIJAZ)));
  assert.deepStrictEqual(host(I.tierContext(PYGMY).basicVocab), [0, 9, 20, 25, 38, 44]);
  assert.deepStrictEqual(host(I.tierContext(AMARA).basicVocab), [0, 8, 17, 22]);
  assert.deepStrictEqual(host(I.tierContext(PYGMY).basicStarts), [0, 9], "Fm home, Ab relative major");
  assert.deepStrictEqual(host(I.tierContext(AMARA).basicStarts), [0, 8], "Dm home, F relative major");
  assert.deepStrictEqual(host(I.tierContext(HIJAZ).basicStarts), [0], "C# is major: home only");
  assert.throws(() => E.sequence.sequences(HIJAZ, 5), /length must be 2, 3 or 4/);
  assert.throws(() => E.sequence.sequences(HIJAZ, 1), /length must be 2, 3 or 4/);
});

/* -------------------------------------------------------------- S1-3 */

test("every sequence starts on an anchor and every step connects, including back to the first chord", () => {
  // R-1/R-9 (2026-10-04): the start is the home anchor or the relative-start
  // anchor, every card is in the BASIC vocabulary (an anchor), roots are
  // distinct, every pair connects and the last chord wraps to the FIRST
  // chord at every length 2..4.
  const E = engine();
  for (const deck of [HIJAZ, PYGMY, AMARA]) {
    const anchorsList = host(E.sequence.anchors(deck));
    const ctx = E.sequence._internal.tierContext(deck);
    const starts = host(ctx.basicStarts);
    const vocab = host(ctx.basicVocab);
    const seen = new Set();
    for (const length of [2, 3, 4]) {
      for (const seq of host(E.sequence.sequences(deck, length))) {
        assert.ok(starts.includes(seq[0]), `sequence ${seq} does not start on home or the relative start`);
        for (const idx of seq) assert.ok(anchorsList.includes(idx), `sequence ${seq} uses non-anchor ${idx}`);
        for (const idx of seq) assert.ok(vocab.includes(idx), `sequence ${seq} uses ${idx}, outside the BASIC vocabulary`);
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
  // Under R-9 the pool holds only the home-start rotation (C major home, so
  // no relative start): [home,B] at length 2; at length 3 and 4
  // nothing, since no three anchors form a loop. (The triad-only pool is one
  // loop, under MIN_BASIC_POOL, so R-3 widens the vocabulary to every anchor
  // - which changes nothing here, since Fdim never loops.)
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
    "home-B connects; [1,0] starts off home; home-C shares no tone and its roots are 5 apart");
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

const BASIC_LENGTH_SHARE = { 2: 40, 3: 40, 4: 20 };

test("length is drawn 2, 3 or 4 at 40/40/20, and style evenly over seven", () => {
  // R-2 (2026-10-04 tier rebalance): three length buckets at 40/40/20.
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
    assert.ok(Math.abs(pct(lengthCounts[length]) - BASIC_LENGTH_SHARE[length]) <= 3,
      `length=${length} share ${pct(lengthCounts[length])}% not within 3pp of ${BASIC_LENGTH_SHARE[length]}%`);
  }
  const expected = 100 / E.sequence.STYLES.length;
  for (const s of E.sequence.STYLES) {
    assert.ok(Math.abs(pct(styleCounts[s]) - expected) <= 3,
      `style "${s}" share ${pct(styleCounts[s])}% not within 3pp of ${expected}%`);
  }
});

test("BASIC length is drawn 2 / 3 / 4 within 3 pp of 40/40/20 over 6,000 seeded deals on Pygmy", () => {
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
    assert.ok(Math.abs(pct - BASIC_LENGTH_SHARE[length]) <= 3,
      `length=${length} share ${pct}% not within 3pp of ${BASIC_LENGTH_SHARE[length]}%`);
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
  const parsed = full.core.parseLegacySeed("(C3) G3 D4 G4 D5", {});
  assert.ok(parsed.ok, "the NO_THIRDS fixture must parse");
  const deck = full.select.build(parsed.value);
  assert.ok(deck.ok, "the NO_THIRDS fixture must build");
  assert.deepStrictEqual(host(full.sequence.pick(deck.value, full.sequence.mulberry32(1), null)),
    { chords: null, reason: "NO_HOME_CHORD" });

  // A synthetic two-anchor deck (home + one other, connected) yields one
  // 2-chord sequence - the home-start rotation only under R-9 - and pick()
  // always returns length 2.
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
  // home-C by a shared tone, B-C by a shared tone), so under R-9 (home start;
  // C major home has no relative start) sequences(deck,2) is both
  // home-start pairs and sequences(deck,3) both home-start permutations;
  // with three anchors there is no length-4 sequence. Two of each is enough
  // to exercise the exclusion-before-length-draw and no-rejection-loop
  // behaviour E4 describes.
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
  assert.deepStrictEqual(host(E.sequence.sequences(deck, 4)), []);

  // prev is pool2's own first entry, [0,1] - the exact sequence an
  // unfiltered stuck-at-zero draw would land on (a stuck rng picks the first
  // non-empty length, 2, the home side and the first entry of the cell). A
  // rejection-sampling implementation (draw, check against prev, redraw)
  // would draw the same index every time from a stuck rng and either loop
  // forever or give up and hand back the very prev it was told to avoid;
  // excluding prev from the cell BEFORE the length/sequence draw sidesteps
  // that entirely.
  const stuckAtZero = () => 0;
  const prev = pool2[0];
  const unfiltered = E.sequence.pick(deck, stuckAtZero, null);
  assert.deepStrictEqual(host(unfiltered.chords), host(prev), "the stuck draw lands on prev when nothing is excluded");
  const result = E.sequence.pick(deck, stuckAtZero, prev);
  assert.strictEqual(result.chords.length, 2, "expected a 2-chord sequence");
  assert.notDeepStrictEqual(host(result.chords), host(prev));

  // A prev whose index is out of range for this deck is ignored, not applied
  // - pick(deck, stuckAtZero, null) and pick(deck, stuckAtZero, [0, 99]) draw
  // from the same (unfiltered) pools and so land on the same sequence.
  const withNull = E.sequence.pick(deck, stuckAtZero, null);
  const ignored = E.sequence.pick(deck, stuckAtZero, [0, 99]);
  assert.deepStrictEqual(host(ignored.chords), host(withNull.chords));

  // R-9 (2026-10-04): only the home-start rotation is in the pool, so a
  // two-anchor deck whose prev is [0,1] has nothing else: excluding prev
  // would empty every cell, the exclusion is skipped (R-2) and pick returns
  // prev itself with a freshly drawn style - the integrator clarification,
  // reachable again.
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

// The MEDIUM cell a sequence lands in (R-5), and the odds of one MEDIUM deal
// being exactly that sequence: length 60/40, kind 1/3 pure vs 2/3 colour,
// family uniform over the families with a non-empty cell at that length,
// side 40/60, then uniform within the cell (every weight renormalised over
// the non-empty options, as drawMedium does).
function mediumCellOf(E, deck, cells, seq) {
  const key = seq.join(",");
  const cell = cells.find((c) => c.seqs.some((q) => q.join(",") === key));
  assert.ok(cell, `${deck.id}: ${key} is in no MEDIUM cell`);
  return cell;
}

function mediumOdds(cells, cell) {
  const lengths = [...new Set(cells.map((c) => c.length))];
  const lengthW = { 3: 0.6, 4: 0.4 };
  const lengthSum = lengths.reduce((s, l) => s + lengthW[l], 0);
  const atLength = cells.filter((c) => c.length === cell.length);
  const kinds = [...new Set(atLength.map((c) => c.kind))];
  const kindW = { pure: 1 / 3, colour: 2 / 3 };
  const kindSum = kinds.reduce((s, k) => s + kindW[k], 0);
  const ofKind = atLength.filter((c) => c.kind === cell.kind);
  const families = [...new Set(ofKind.map((c) => c.family))];
  const ofFamily = ofKind.filter((c) => c.family === cell.family);
  const sides = [...new Set(ofFamily.map((c) => c.side))];
  const sideW = { home: 0.4, other: 0.6 };
  const sideSum = sides.reduce((s, k) => s + sideW[k], 0);
  return (lengthW[cell.length] / lengthSum) * (kindW[cell.kind] / kindSum) *
    (1 / families.length) * (sideW[cell.side] / sideSum) / cell.seqs.length;
}

test("S6: Amy's rows - A1-A8 BASIC, A9-A10 MEDIUM on Pygmy; A3/A10 MEDIUM on Amara; A6 BASIC on Hijaz", () => {
  const E = engine();
  const I = E.sequence._internal;
  const expected = {
    pygmy: ["basic", "basic", "basic", "basic", "basic", "basic", "basic", "basic", "intermediate", "intermediate"],
    amara: ["intermediate", "intermediate"],
    hijaz: ["basic"]
  };
  for (const [id, deck] of [["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA]]) {
    const cells = host(I.mediumCells(deck));
    AMY_ROWS[id].forEach((row, k) => {
      const seq = row.map((name) => anchorByName(E, deck, name));
      const tier = expected[id][k];
      assert.strictEqual(E.sequence.tierOf(deck, seq), tier,
        `${id} ${row.join(" ")} (${seq}) should classify ${tier}`);
      if (tier === "basic") {
        const pool = host(E.sequence.sequences(deck, seq.length)).map((q) => q.join(","));
        assert.ok(pool.includes(seq.join(",")),
          `${id} ${row.join(" ")} (${seq}) missing from sequences(deck, ${seq.length})`);
      } else {
        mediumCellOf(E, deck, cells, seq);
      }
    });
  }
  // TR-10: A10 (Bbm Eb Ab, cell 3/pure/other) better than 1 in 2,000 per
  // MEDIUM deal; A9 (Db Cm Bbm Ab, cell 4/pure/other) better than 1 in
  // 10,000. §4 measures 1 in 1,083 and 1 in 6,750.
  const cells = host(I.mediumCells(PYGMY));
  const a9 = AMY_ROWS.pygmy[8].map((name) => anchorByName(E, PYGMY, name));
  const a10 = AMY_ROWS.pygmy[9].map((name) => anchorByName(E, PYGMY, name));
  const a9cell = mediumCellOf(E, PYGMY, cells, a9);
  const a10cell = mediumCellOf(E, PYGMY, cells, a10);
  assert.deepStrictEqual([a9cell.length, a9cell.kind, a9cell.side], [4, "pure", "other"]);
  assert.deepStrictEqual([a10cell.length, a10cell.kind, a10cell.side], [3, "pure", "other"]);
  assert.strictEqual(a9cell.seqs.length, 540, "§4: Pygmy 4/pure/other holds 540 sequences");
  assert.strictEqual(a10cell.seqs.length, 130, "§4: Pygmy 3/pure/other holds 130 sequences");
  assert.ok(mediumOdds(cells, a9cell) > 1 / 10000, `A9 odds 1 in ${Math.round(1 / mediumOdds(cells, a9cell))}`);
  assert.ok(mediumOdds(cells, a10cell) > 1 / 2000, `A10 odds 1 in ${Math.round(1 / mediumOdds(cells, a10cell))}`);
  assert.strictEqual(Math.round(1 / mediumOdds(cells, a9cell)), 6750);
  assert.strictEqual(Math.round(1 / mediumOdds(cells, a10cell)), 1083);
});

test("R-9: every rotation of a BASIC sequence that starts on home or the relative start is also in the pool", () => {
  const E = engine();
  const pool = host(E.sequence.sequences(PYGMY, 4)).map((q) => q.join(","));
  assert.ok(pool.includes("0,38,9,44"), "Fm Db Ab Eb missing");
  assert.ok(pool.includes("9,44,0,38"), "Ab Eb Fm Db (relative-start rotation) missing");
  assert.ok(!pool.includes("38,9,44,0"), "Db Ab Eb Fm starts off home");
  assert.ok(!pool.includes("44,0,38,9"), "Eb Fm Db Ab starts off home");
  for (const deck of [HIJAZ, PYGMY, AMARA]) {
    const starts = host(E.sequence._internal.tierContext(deck).basicStarts);
    for (const length of [2, 3, 4]) {
      const keys = host(E.sequence.sequences(deck, length)).map((q) => q.join(","));
      for (const key of keys) {
        const seq = key.split(",").map(Number);
        for (let r = 1; r < seq.length; r += 1) {
          const rot = [...seq.slice(r), ...seq.slice(0, r)];
          assert.strictEqual(keys.includes(rot.join(",")), starts.includes(rot[0]),
            `${deck.id}: rotation ${rot} of ${seq} is in the pool iff it starts on home or the relative start`);
        }
      }
    }
  }
});

test("R-8: vocabulary nests and the five-card fixture classifies BASIC, MEDIUM, MEDIUM and null", () => {
  const E = engine();
  const I = E.sequence._internal;
  const deck = fiveCardDeck();
  assert.deepStrictEqual(host(E.sequence.anchors(deck)), [0, 1, 2, 3]);
  assert.strictEqual(E.sequence.tierOf(deck, [0, 1, 2, 3]), "basic",
    "C Dm Em G: home start, triad anchors only, distinct roots");
  assert.strictEqual(E.sequence.tierOf(deck, [1, 2, 3, 0]), "intermediate",
    "Dm Em G C: pure-triad loop starting off home is MEDIUM, not BASIC");
  assert.strictEqual(E.sequence.tierOf(deck, [1, 2, 4, 0]), "intermediate",
    "Dm Em G7 C: anchor start, one colour card, no repeat");
  assert.strictEqual(E.sequence.tierOf(deck, [4, 0, 1, 2]), null,
    "G7 C Dm Em: starts on a non-anchor, non-home card and has no extended card (TR-5)");
  const pool4 = host(E.sequence.sequences(deck, 4)).map((q) => q.join(","));
  assert.ok(pool4.includes("0,1,2,3"), "the BASIC loop is in the pool");
  assert.ok(!pool4.includes("1,2,3,0"), "the off-home rotation is not");
  assert.ok(!pool4.includes("1,2,4,0"), "the colour loop is not");
  // Vocabulary nesting (owner 7): BASIC cards within MEDIUM's pool within
  // HARD's, on the fixture and on every built-in deck.
  for (const d of [deck, HIJAZ, PYGMY, AMARA]) {
    const ctx = I.tierContext(d);
    const medium = host(I.tierPool(d, "intermediate", ctx.anchorsList));
    const hard = host(I.tierPool(d, "advanced", ctx.anchorsList));
    for (const idx of host(ctx.basicVocab)) assert.ok(medium.includes(idx), `${d.id}: BASIC card ${idx} not in MEDIUM's pool`);
    for (const idx of medium) assert.ok(hard.includes(idx), `${d.id}: MEDIUM card ${idx} not in HARD's pool`);
    assert.strictEqual(hard.length, d.chords.length, `${d.id}: HARD's pool is every card`);
  }
});

// §2 migration table (re-measured under R-1..R-7 of the tier rebalance):
// every connected length-4 loop (each consecutive pair connects, the last
// connects back to the first, no consecutive identical card - exactly what
// makeAccept admits before the tier gate), classified by classifyTier,
// INCLUDING the loops no tier deals (TR-5 under the broad R-7: no extended
// card and at most one non-anchor card, or over the register bound).
// Measured in plan §14 (the plan itself names no figures).
const MIGRATION_L4 = {
  hijaz: { intermediate: 1092, advanced: 88228, null: 4880 },
  pygmy: { intermediate: 9320, advanced: 2858184, null: 2980060 },
  amara: { intermediate: 1692, advanced: 409932, null: 3996 }
};

test("length-4 loops migrate per the §2 table on every built-in deck", () => {
  const E = engine();
  const I = E.sequence._internal;
  for (const [id, deck] of [["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA]]) {
    const ctx = I.tierContext(deck);
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
    assert.strictEqual(counts.null, MIGRATION_L4[id].null, `${id} null (TR-5)`);
  }
});

/* ================================================================
 * D1 - difficulty tiers (docs/plans/2026-10-02-sequence-difficulty.md §4)
 * ================================================================ */

// Part 3a/3b of the Pygmy Progression Tiers doc (artifact
// f14b7860-bf38-4c6d-b579-f54f9535b405, rev 56), 1-based "#N" card numbers
// converted to 0-based chord indices. These are the golden fixtures step 2
// names. Tier rebalance (plan §14, S5): re-captured under R-1..R-10, each row
// with the rule that moved it. The I/A names are the doc's, not the tiers.
const PYGMY_TIER_GOLDEN = {
  I1: [[0, 31, 25], "intermediate"],
  // Length 3 with two or three colour cards: over MEDIUM's one-colour cap
  // (R-4), and HARD starts at length 4 (R-7).
  I2: [[4, 42, 51], null], I3: [[0, 49, 51], null], I4: [[4, 24, 36], null], I5: [[0, 8, 36], null],
  I6: [[0, 44, 38, 31], "intermediate"],
  // Length 4 with two or more colour cards: HARD's two-non-anchor branch.
  I7: [[4, 17, 42, 51], "advanced"], I8: [[2, 0, 22, 20], "advanced"],
  A2: [[24, 51, 17, 42], "advanced"], A5: [[6, 23, 24, 8, 34, 36], "advanced"],
  // Two or more LOW/HIGH voicings in four chords: over the register bound.
  A1: [[37, 52, 39, 0], null], A3: [[6, 18, 26, 0], null], A4: [[50, 52, 16, 17], null], A6: [[26, 39, 45, 39], null]
};
const HIJAZ_INTERMEDIATE = [0, 6, 2];
const HIJAZ_ADVANCED = [14, 13, 3, 5];
const AMARA_INTERMEDIATE = [0, 19, 17];
const AMARA_ADVANCED = [10, 21, 16, 26];

/* -------------------------------------------------------------- D1 step 2/3 */

test("tierOf classifies the golden fixtures and every BASIC sequence", () => {
  const E = engine();
  for (const [name, [seq, tier]] of Object.entries(PYGMY_TIER_GOLDEN)) {
    assert.strictEqual(E.sequence.tierOf(PYGMY, seq), tier,
      `Pygmy ${name} ${seq} should classify ${tier}`);
  }
  assert.strictEqual(E.sequence.tierOf(HIJAZ, HIJAZ_INTERMEDIATE), "intermediate");
  assert.strictEqual(E.sequence.tierOf(HIJAZ, HIJAZ_ADVANCED), "advanced");
  assert.strictEqual(E.sequence.tierOf(AMARA, AMARA_INTERMEDIATE), "intermediate");
  assert.strictEqual(E.sequence.tierOf(AMARA, AMARA_ADVANCED), "advanced");

  // Every BASIC sequence (71 / 170 / 30 under R-1..R-3, §4) classifies "basic".
  for (const [id, deck] of [["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA]]) {
    let count = 0;
    for (const length of [2, 3, 4]) {
      for (const seq of E.sequence.sequences(deck, length)) {
        assert.strictEqual(E.sequence.tierOf(deck, seq), "basic",
          `${id} BASIC sequence ${seq} should classify basic`);
        count += 1;
      }
    }
    assert.strictEqual(count, { hijaz: 71, pygmy: 170, amara: 30 }[id],
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
  // repeats, <=4 fields, no register) falls out of MEDIUM - and, with no
  // extended card, out of HARD too (R-7 / TR-5): null.
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
  assert.strictEqual(E.sequence.tierOf(lengthDeck, [0, 1, 2, 3, 4]), null,
    "a 5-chord sequence is outside intermediate's {3,4} length range and has no extended card, so null");
});

// TR-5 / S8 (the broad R-7): three connected Pygmy loops built from anchors
// plus colour cards (non-anchor, <= 4 fields, no register) or one extended
// card, one per branch of the HARD gate.
// Fm G° Ab Bbm Csus4: ONE colour card in five chords - not MEDIUM by length,
// not HARD (nothing extended, fewer than two non-anchor cards): null.
const PYGMY_ONE_COLOUR_L5 = [0, 7, 9, 20, 31];
// Fm G° Ab5 Bb5: TWO colour cards, nothing extended - over MEDIUM's cap and
// HARD by the two-non-anchor branch.
const PYGMY_TWO_COLOUR_L4 = [0, 7, 12, 21];
// Fm Fm9 G° Ab: ONE extended card (Fm9, five fields) plus anchors - HARD by
// the extended branch alone.
const PYGMY_ONE_EXTENDED_L4 = [0, 6, 7, 9];

test("tierOf returns null for a sequence ADVANCED can never deal", () => {
  const E = engine();
  const I = E.sequence._internal;
  const matrix = I.buildConnectMatrix(PYGMY);
  function connectedLoop(seq, label) {
    for (let i = 0; i < seq.length; i += 1) {
      const next = seq[(i + 1) % seq.length];
      assert.ok(seq[i] !== next && matrix[seq[i]][next], `${label} breaks at ${i}`);
    }
  }
  // ADVANCED deals lengths 4..6 only (TIER_LENGTHS), so a connecting
  // 3-chord or 7-chord sequence belongs to no tier. Pygmy's golden rows pin
  // both ends of the range: A2 has 4 chords, A5 has 6.
  assert.strictEqual(E.sequence.tierOf(PYGMY, PYGMY_TIER_GOLDEN.A2[0]), "advanced", "4 chords");
  assert.strictEqual(E.sequence.tierOf(PYGMY, PYGMY_TIER_GOLDEN.A5[0]), "advanced", "6 chords");
  assert.strictEqual(E.sequence.tierOf(PYGMY, [5, 22, 23]), null, "3 chords that fail INTERMEDIATE");
  const seven = [...PYGMY_TIER_GOLDEN.A5[0], 0];
  assert.strictEqual(seven.length, 7);
  connectedLoop(seven, "seven-chord fixture");
  assert.strictEqual(E.sequence.tierOf(PYGMY, seven), null, "7 chords connect but ADVANCED never deals 7");

  const anchorsList = host(E.sequence.anchors(PYGMY));
  const isRegister = (i) => /\b(LOW|HIGH) VOICING\b/.test(PYGMY.chords[i].subtitle || "");
  const isExtended = (i) => !anchorsList.includes(i) && (PYGMY.chords[i].fields.length > 4 || isRegister(i));
  function shape(seq, label, nonAnchor, extended) {
    connectedLoop(seq, label);
    assert.strictEqual(seq.filter((i) => !anchorsList.includes(i)).length, nonAnchor, `${label}: non-anchor cards`);
    assert.strictEqual(seq.filter(isExtended).length, extended, `${label}: extended cards`);
    assert.ok(!seq.some(isRegister), `${label}: carries a register voicing`);
  }
  shape(PYGMY_ONE_COLOUR_L5, "one-colour five-chord fixture", 1, 0);
  assert.strictEqual(E.sequence.tierOf(PYGMY, PYGMY_ONE_COLOUR_L5), null,
    "one colour card in five chords: not MEDIUM by length, not HARD by the gate (TR-5)");
  shape(PYGMY_TWO_COLOUR_L4, "two-colour fixture", 2, 0);
  assert.strictEqual(E.sequence.tierOf(PYGMY, PYGMY_TWO_COLOUR_L4), "advanced",
    "two colour cards fail MEDIUM and qualify HARD by the two-non-anchor branch");
  shape(PYGMY_ONE_EXTENDED_L4, "one-extended fixture", 1, 1);
  assert.strictEqual(E.sequence.tierOf(PYGMY, PYGMY_ONE_EXTENDED_L4), "advanced",
    "one extended card plus anchors qualifies HARD by the extended branch");
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
      // MEDIUM enumerates its cells once per pick() (R-10, ~5-20 ms), so it
      // gets 200 seeds here; S1 covers its shape at N = 3,000 on the cells.
      const seeds = tier === "intermediate" ? 200 : 2000;
      for (let seed = 0; seed < seeds; seed += 1) {
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

test("MEDIUM length is drawn 3 / 4 at 60/40 and HARD 4 / 5 / 6 evenly, within 3 pp on Pygmy", () => {
  const E = engine();
  const I = E.sequence._internal;
  const N = 10000;
  const TARGET = { intermediate: { 3: 60, 4: 40 }, advanced: { 4: 100 / 3, 5: 100 / 3, 6: 100 / 3 } };
  // MEDIUM through the cell sampler pick() itself uses (the cells are
  // enumerated once here, not 10,000 times); HARD through pick().
  const cells = I.mediumCells(PYGMY);
  for (const tier of ["intermediate", "advanced"]) {
    const counts = {};
    for (const l of Object.keys(TARGET[tier])) counts[l] = 0;
    const rng = E.sequence.mulberry32(314);
    let prev = null;
    for (let i = 0; i < N; i += 1) {
      const chords = tier === "intermediate"
        ? I.drawMedium(cells, rng, prev)
        : E.sequence.pick(PYGMY, rng, prev, tier).chords;
      counts[chords.length] += 1;
      prev = chords;
    }
    for (const l of Object.keys(TARGET[tier])) {
      const pct = (100 * counts[l]) / N;
      assert.ok(Math.abs(pct - TARGET[tier][l]) <= 3,
        `${tier} length=${l} share ${pct}% not within 3pp of ${TARGET[tier][l]}%`);
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
  const NO_TIER = { chords: null, reason: "NO_TIER_SEQUENCE" };

  // The five-card deck (four anchors + G7). MEDIUM deals from its cells even
  // on a stuck-at-zero rng. G7 is not extended (four fields, no register),
  // but it is a non-anchor card, so a sequence that plays it at two
  // positions is HARD by the two-non-anchor branch (broad R-7; TR-7
  // superseded): HARD deals there too, through the DFS fallback.
  const fiveCard = fiveCardDeck();
  const stuckAtZero = () => 0;
  const stuck = E.sequence.pick(fiveCard, stuckAtZero, null, "intermediate");
  assert.ok(stuck.chords, "intermediate on the 5-card deck should deal on a stuck rng");
  assert.strictEqual(E.sequence.tierOf(fiveCard, host(stuck.chords)), "intermediate");
  const stuckHard = host(E.sequence.pick(fiveCard, stuckAtZero, null, "advanced"));
  assert.ok(stuckHard.chords, `advanced on the 5-card deck returned ${stuckHard.reason}`);
  assert.strictEqual(E.sequence.tierOf(fiveCard, stuckHard.chords), "advanced");
  assert.ok(stuckHard.chords.filter((i) => i === 4).length >= 2,
    "the only non-anchor card is G7, so a HARD deal plays it at least twice");

  // The four-card all-anchor deck: a loop that starts on home is BASIC, one
  // that starts on any other (non-diminished) anchor is a pure-triad MEDIUM
  // deal (R-4), and with no non-anchor card at all HARD is empty on every
  // seed (neither branch of R-7 can fire).
  const fourCard = fourCardDeck();
  for (let seed = 0; seed < 200; seed += 1) {
    const result = E.sequence.pick(fourCard, E.sequence.mulberry32(seed), null, "intermediate");
    assert.ok(result.chords, `fourCard intermediate seed ${seed} returned ${result.reason}`);
    assert.notStrictEqual(result.chords[0], 0, `fourCard intermediate seed ${seed} started on home (that loop is BASIC)`);
    assert.strictEqual(E.sequence.tierOf(fourCard, host(result.chords)), "intermediate");
    assert.deepStrictEqual(
      host(E.sequence.pick(fourCard, E.sequence.mulberry32(seed), null, "advanced")), NO_TIER,
      `fourCard advanced seed ${seed} should be NO_TIER_SEQUENCE`);
  }

  // A synthetic 3-card all-anchor deck (home C, Dm, Em): the one loop C Dm Em
  // is BASIC from home and MEDIUM from Dm or Em; HARD is empty (no non-anchor
  // card).
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
  const threeCardMedium = host(E.sequence._internal.mediumCells(threeCard))
    .reduce((all, cell) => all.concat(cell.seqs), []).map((q) => q.join(",")).sort();
  assert.deepStrictEqual(threeCardMedium, ["1,0,2", "1,2,0", "2,0,1", "2,1,0"],
    "the 3-card deck's MEDIUM set is the off-home rotations of its two loops");
  for (let seed = 0; seed < 200; seed += 1) {
    const result = E.sequence.pick(threeCard, E.sequence.mulberry32(seed), null, "intermediate");
    assert.ok(result.chords, `threeCard intermediate seed ${seed} returned ${result.reason}`);
    assert.ok(threeCardMedium.includes(host(result.chords).join(",")));
    assert.deepStrictEqual(
      host(E.sequence.pick(threeCard, E.sequence.mulberry32(seed), null, "advanced")), NO_TIER,
      `threeCard advanced seed ${seed} should be NO_TIER_SEQUENCE`);
  }

  // A deck with anchors but nothing MEDIUM can build: home C and one other
  // anchor only (no length-3 loop without a repeated root).
  const twoCard = syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],
    "1": ["C", 4, 60, "rim", null, "1"], "2": ["E", 4, 64, "rim", null, "2"], "3": ["G", 4, 67, "rim", null, "3"],
    "4": ["D", 4, 62, "rim", null, "4"], "5": ["F", 4, 65, "rim", null, "5"], "6": ["A", 4, 69, "rim", null, "6"]
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] },
    { main: "Dm", sup: "", fields: [4, 5, 6], roots: [4] }
  ]);
  for (let seed = 0; seed < 50; seed += 1) {
    assert.deepStrictEqual(
      host(E.sequence.pick(twoCard, E.sequence.mulberry32(seed), null, "intermediate")), NO_TIER,
      `twoCard intermediate seed ${seed} should be NO_TIER_SEQUENCE`);
  }
  assert.ok(E.sequence.pick(twoCard, E.sequence.mulberry32(1), null).chords, "BASIC still deals C Dm there");

  // NO_HOME_CHORD wins on every tier, reusing the NO_THIRDS fixture from S1-7.
  const full = loadEngine(["core", "voicing", "layout", "naming", "select", "sequence"]);
  const parsed = full.core.parseLegacySeed("(C3) G3 D4 G4 D5", {});
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
  // chord0 = C (home anchor), chord1 = Dsus4add9 (a colour card), chord2 =
  // D° (root D's anchor, diminished, so it cannot START a MEDIUM deal under
  // R-4). The only MEDIUM sequence is [0,1,2]: the sus resolves forward into
  // D°; [0,2,1] repeats root D unresolved, and length 4 needs a third root.
  const oneTierSequenceDeck = syntheticDeck({
    "0": ["C", 3, 48, "ding", null, "Ding"],
    "1": ["C", 4, 60, "rim", null, "1"],
    "2": ["E", 4, 64, "rim", null, "2"],
    "3": ["G", 4, 67, "rim", null, "3"],
    "4": ["D", 4, 62, "rim", null, "4"],
    "5": ["F", 4, 65, "rim", null, "5"],
    "6": ["Ab", 4, 68, "rim", null, "6"],
    "7": ["D", 5, 74, "rim", null, "7"],
    "8": ["G", 5, 79, "rim", null, "8"],
    "9": ["A", 5, 81, "rim", null, "9"],
    "10": ["E", 6, 88, "rim", null, "10"]
  }, [
    { main: "C", sup: "", fields: [1, 2, 3], roots: [1] },
    { main: "Dsus4", sup: "add9", fields: [7, 8, 9, 10], roots: [7] },
    { main: "D\u00b0", sup: "", fields: [4, 5, 6], roots: [4] }
  ]);
  const onlyTierSequence = [0, 1, 2];
  const allMedium = host(E.sequence._internal.mediumCells(oneTierSequenceDeck))
    .reduce((all, cell) => all.concat(cell.seqs), []);
  assert.deepStrictEqual(allMedium, [onlyTierSequence], "the fixture has exactly one MEDIUM sequence");
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
    const parsed = full.core.parseLegacySeed(str, {});
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
    .map((row) => ({ name: row.name, parsed: full.core.parseLegacySeed(row.string, {}) }))
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
  // S7: the reviewer rows (G3), (A3), (G#3) carry no extended card, so every
  // HARD deal there comes from the two-non-anchor branch (broad R-7).
  const NO_EXTENDED_ROWS = ["reviewer deck 0", "reviewer deck 1", "reviewer deck 3"];
  const twoNonAnchorDeals = {};
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
        if (tier === "advanced" && NO_EXTENDED_ROWS.includes(row.label)) {
          const anchorsList = host(S.anchors(deck));
          assert.ok(!deck.chords.some((c, i) => !anchorsList.includes(i) &&
            (c.fields.length > 4 || /\b(LOW|HIGH) VOICING\b/.test(c.subtitle || ""))),
          `${row.label} carries an extended card`);
          assert.ok(chords.filter((i) => !anchorsList.includes(i)).length >= 2,
            `${row.label} seed ${seed} dealt ${JSON.stringify(chords)} with fewer than two non-anchor cards`);
          twoNonAnchorDeals[row.label] = (twoNonAnchorDeals[row.label] || 0) + 1;
        }
        prev = chords;
      }
    }
  }
  assert.strictEqual(noHomeRows.size, 3, `NO_HOME_CHORD rows: ${[...noHomeRows].join(", ")}`);
  // S7: no sweep row is HARD-empty (TR-7 superseded); the only empty tiers
  // are the three NO_HOME_CHORD rows, on every tier and seed.
  assert.deepStrictEqual(reasons, { basic: 15, intermediate: 15, advanced: 15 },
    "3 NO_HOME_CHORD rows x 5 seeds per tier, and nothing else");
  assert.deepStrictEqual(twoNonAnchorDeals,
    { "reviewer deck 0": 5, "reviewer deck 1": 5, "reviewer deck 3": 5 },
    "the no-extended reviewer rows deal HARD on every seed");
});

// S7 custom-scale case: the augmented hexatonic seed (AD18) has no extended
// card at all, and HARD still deals there, every deal through the two-non-anchor branch.
test("S7: a custom augmented hexatonic deck deals HARD with no extended card", () => {
  const { full } = generated();
  const S = full.sequence;
  const parsed = full.core.parseLegacySeed("(C3) Eb3 E3 G3 Ab3 B3 C4 Eb4 E4", {});
  assert.equal(parsed.ok, true);
  const built = full.select.build(parsed.value);
  assert.equal(built.ok, true);
  const deck = built.value;
  const anchorsList = host(S.anchors(deck));
  const extended = deck.chords.filter((c, i) => !anchorsList.includes(i) &&
    (c.fields.length > 4 || /\b(LOW|HIGH) VOICING\b/.test(c.subtitle || "")));
  assert.strictEqual(extended.length, 0, "the augmented hexatonic deck has no extended card");
  let prev = null;
  for (let seed = 0; seed < 50; seed += 1) {
    const result = S.pick(deck, S.mulberry32(seed), prev, "advanced");
    assert.ok(result.chords, `augmented HARD seed ${seed} returned ${result.reason}`);
    const chords = host(result.chords);
    assert.strictEqual(S.tierOf(deck, chords), "advanced");
    assert.ok(chords.filter((i) => !anchorsList.includes(i)).length >= 2,
      `augmented seed ${seed} dealt ${JSON.stringify(chords)} with fewer than two non-anchor cards`);
    prev = chords;
  }
});

test("a deck forcing the DFS fallback on every length finishes under 50ms", () => {
  const E = engine();
  const fiveCard = fiveCardDeck();
  const stuckAtZero = () => 0;
  for (const tier of ["intermediate", "advanced"]) {
    const t0 = Date.now();
    const result = E.sequence.pick(fiveCard, stuckAtZero, null, tier);
    const dt = Date.now() - t0;
    // A stuck rng never draws a second G7, so HARD runs the 512 draws and
    // falls to the DFS, which finds the two-G7 sequences (broad R-7).
    assert.ok(result.chords, `${tier} should deal (got ${result.reason})`);
    assert.strictEqual(E.sequence.tierOf(fiveCard, host(result.chords)), tier);
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
  const E = engine();
  const I = E.sequence._internal;
  const matrix = I.buildConnectMatrix(PYGMY);
  const ctx = I.tierContext(PYGMY);
  const pool = I.tierPool(PYGMY, "advanced", ctx.anchorsList);
  const startSet = I.tierStartSet(PYGMY, "advanced", pool, ctx);
  for (const len of [4, 5, 6]) {
    const accept = I.makeAccept(PYGMY, "advanced", matrix, null, ctx);
    const stats = {};
    I.dfsFindAll(startSet, pool, len, accept, I.DFS_NODE_BUDGET, matrix, stats);
    assert.ok(stats.nodes <= I.DFS_NODE_BUDGET,
      `pygmy advanced length ${len}: dfsFindAll visited ${stats.nodes} nodes, over the ${I.DFS_NODE_BUDGET} budget`);
  }
});

// R-10 / TR-14: MEDIUM is enumerated once per pick() by a matrix-pruned DFS
// with a BRANCH-LEVEL prune on the colour-card cap. The node counts are
// asserted EXACTLY (lengths 3 and 4 summed, one node per rec entry): a lost
// prune is a red here, not a slow pass - without the colour prune Pygmy's
// length 4 alone is 221,520 nodes and the 60,000 budget truncates it.
const MEDIUM_ENUM = {
  pygmy: { nodes: 24886, total: 10942, pool: 31, starts: 11 },
  amara: { nodes: 7652, total: 2264, pool: 22, starts: 10 },
  hijaz: { nodes: 4518, total: 1394, pool: 17, starts: 7 }
};

test("MEDIUM enumeration visits exactly the section 4 node counts and finds the exhaustive set", () => {
  const E = engine();
  const I = E.sequence._internal;
  assert.strictEqual(I.MEDIUM_ENUM_BUDGET, 60000);
  for (const [id, deck] of [["hijaz", HIJAZ], ["pygmy", PYGMY], ["amara", AMARA]]) {
    const stats = {};
    const cells = host(I.mediumCells(deck, stats));
    assert.strictEqual(stats.nodes, MEDIUM_ENUM[id].nodes, `${id} MEDIUM enumeration node count`);
    assert.strictEqual(stats.truncated, false, `${id} MEDIUM enumeration was truncated`);
    assert.ok(stats.nodes <= I.MEDIUM_ENUM_BUDGET);
    const ctx = I.tierContext(deck);
    const pool = host(I.tierPool(deck, "intermediate", ctx.anchorsList));
    const startSet = host(I.tierStartSet(deck, "intermediate", pool, ctx));
    assert.strictEqual(pool.length, MEDIUM_ENUM[id].pool, `${id} MEDIUM pool size`);
    assert.strictEqual(startSet.length, MEDIUM_ENUM[id].starts, `${id} MEDIUM start-set size`);
    const found = cells.reduce((all, cell) => all.concat(cell.seqs), []).map((q) => q.join(",")).sort();
    assert.strictEqual(found.length, MEDIUM_ENUM[id].total, `${id} MEDIUM sequence count`);
    assert.strictEqual(new Set(found).size, found.length, `${id}: a sequence sits in two cells`);
    // Exhaustive reference: every connected loop of length 3 and 4 over the
    // whole deck that classifyTier calls "intermediate" - no pool, no start
    // set and no colour prune, so it cannot share a bug with the enumeration.
    const matrix = I.buildConnectMatrix(deck);
    const n = deck.chords.length;
    const brute = [];
    for (const len of [3, 4]) {
      const seq = new Array(len);
      (function walk(depth) {
        if (depth === len) {
          if (seq[len - 1] !== seq[0] && matrix[seq[len - 1]][seq[0]] &&
              I.classifyTier(deck, seq, ctx) === "intermediate") brute.push(seq.join(","));
          return;
        }
        for (let c = 0; c < n; c += 1) {
          if (depth > 0 && (c === seq[depth - 1] || !matrix[seq[depth - 1]][c])) continue;
          seq[depth] = c;
          walk(depth + 1);
        }
      })(0);
    }
    assert.deepStrictEqual(found, brute.sort(), `${id}: MEDIUM cells differ from the exhaustive set`);
  }
});

test("MEDIUM enumeration reports truncation instead of dealing from a partial set", () => {
  const E = engine();
  const I = E.sequence._internal;
  const stats = {};
  I.mediumCells(PYGMY, stats, MEDIUM_ENUM.pygmy.nodes);
  assert.strictEqual(stats.truncated, false, "finishing on the last allowed node is complete");
  assert.strictEqual(stats.nodes, MEDIUM_ENUM.pygmy.nodes);
  const short = {};
  I.mediumCells(PYGMY, short, 1000);
  assert.strictEqual(short.truncated, true);
  assert.ok(short.nodes <= 1000);
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
  const ctx = I.tierContext(deck);
  const pool = I.tierPool(deck, tier, ctx.anchorsList);
  const startSet = I.tierStartSet(deck, tier, pool, ctx);
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
  assert.strictEqual(fx.synthetic.length, 13, "13 of the 20 synthetic rows build");
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

/* ================================================================
 * Tier rebalance (docs/plans/2026-10-04-tier-rebalance.md §2, §7)
 * ================================================================ */

const REGISTER_RE = /\b(LOW|HIGH) VOICING\b/;

// Everything S1-S3 measure about a run of deals, computed from the deck data
// alone (anchors() aside) so it cannot share a bug with the gates.
function shapeOf(E, deck, deals) {
  const I = E.sequence._internal;
  const anchorsList = host(E.sequence.anchors(deck));
  const home = I.homePc(deck);
  const isAnchor = (i) => anchorsList.includes(i);
  const isReg = (i) => REGISTER_RE.test(deck.chords[i].subtitle || "");
  const isExtended = (i) => !isAnchor(i) && (deck.chords[i].fields.length > 4 || isReg(i));
  const isDim = (i) => {
    const r = rootPc(deck, i);
    return [...new Set(chordPcs(deck, i).map((p) => pc(p - r)))].sort((a, b) => a - b).join(",") === "0,3,6";
  };
  const out = {
    n: deals.length, lengths: {}, families: {}, colourDeals: 0, registerBoundBroken: 0, hardGateBroken: 0,
    distinct: new Set(deals.map((q) => q.join(","))).size
  };
  let chords = 0, homeStart = 0, nonAnchor = 0, nonAnchorReg = 0, pure = 0, extended = 0, dimAnchor = 0, reg = 0;
  for (const q of deals) {
    out.lengths[q.length] = (out.lengths[q.length] || 0) + 1;
    if (rootPc(deck, q[0]) === home) homeStart += 1;
    const colour = q.filter((i) => !isAnchor(i));
    chords += q.length;
    nonAnchor += colour.length;
    nonAnchorReg += colour.filter(isReg).length;
    reg += q.filter(isReg).length;
    dimAnchor += q.filter((i) => isAnchor(i) && isDim(i)).length;
    if (colour.length === 0) pure += 1;
    if (q.some(isExtended)) extended += 1;
    if (q.filter(isReg).length * 3 > q.length) out.registerBoundBroken += 1;
    if (!q.some(isExtended) && colour.length < 2) out.hardGateBroken += 1;
    if (colour.length === 1 && !isExtended(colour[0])) {
      const fam = I.colourFamily(deck, colour[0]);
      out.colourDeals += 1;
      out.families[fam] = (out.families[fam] || 0) + 1;
    }
  }
  const share = (x, of) => (of ? (100 * x) / of : 0);
  for (const l of Object.keys(out.lengths)) out.lengths[l] = share(out.lengths[l], out.n);
  for (const f of Object.keys(out.families)) out.families[f] = share(out.families[f], out.colourDeals);
  out.meanLen = out.n ? chords / out.n : 0;
  out.home = share(homeStart, out.n);
  out.nonAnchor = share(nonAnchor, chords);
  out.nonAnchorRegister = share(nonAnchorReg, nonAnchor);
  out.register = share(reg, chords);
  out.dimAnchor = share(dimAnchor, chords);
  out.pure = share(pure, out.n);
  out.extended = share(extended, out.n);
  return out;
}

// One shape run: n deals per tier, mulberry32(7), a fresh rng per (deck,
// tier). BASIC and MEDIUM go through the cell samplers pick() itself uses,
// on cells enumerated ONCE (R-10); HARD goes through pick(). A tier with
// nothing to deal returns null.
function shapeRun(E, deck, n, hardN) {
  const S = E.sequence;
  const I = S._internal;
  function run(count, drawOne) {
    const deals = [];
    let prev = null;
    for (let k = 0; k < count; k += 1) {
      const q = drawOne(prev);
      if (!q) return null;
      deals.push(host(q));
      prev = q;
    }
    return shapeOf(E, deck, deals);
  }
  const basicCells = I.basicCells(deck);
  const mediumCells = I.mediumCells(deck);
  const rngB = S.mulberry32(7);
  const rngM = S.mulberry32(7);
  const rngH = S.mulberry32(7);
  return {
    basicCells: host(basicCells),
    mediumCells: host(mediumCells),
    basic: run(n, (prev) => I.drawBasic(basicCells, rngB, prev)),
    intermediate: run(n, (prev) => I.drawMedium(mediumCells, rngM, prev)),
    advanced: run(hardN === undefined ? n : hardN, () => S.pick(deck, rngH, null, "advanced").chords)
  };
}

const SHAPE_N = 3000;
let builtinShapeRuns = null;
function builtinShapes() {
  if (!builtinShapeRuns) {
    const E = engine();
    builtinShapeRuns = {};
    for (const deck of [HIJAZ, PYGMY, AMARA]) builtinShapeRuns[deck.id] = shapeRun(E, deck, SHAPE_N);
  }
  return builtinShapeRuns;
}

function within(actual, target, band, label) {
  assert.ok(Math.abs(actual - target) <= band,
    `${label}: ${actual.toFixed(1)}% is not within ${band} pp of ${target.toFixed(1)}%`);
}

test("S1: every tier's shape sits in its section 2 band over 3,000 draws on each built-in deck", () => {
  const runs = builtinShapes();
  for (const id of ["hijaz", "pygmy", "amara"]) {
    const { basic, intermediate, advanced, mediumCells } = runs[id];

    // BASIC (R-1..R-3).
    within(basic.lengths[2], 40, 3, `${id} BASIC length 2`);
    within(basic.lengths[3], 40, 3, `${id} BASIC length 3`);
    within(basic.lengths[4], 20, 3, `${id} BASIC length 4`);
    if (id === "hijaz") assert.strictEqual(basic.home, 100, "hijaz BASIC has no secondary start");
    else within(basic.home, 80, 3, `${id} BASIC home start`);
    assert.strictEqual(basic.nonAnchor, 0, `${id} BASIC non-anchor chords`);
    assert.strictEqual(basic.pure, 100, `${id} BASIC pure-triad deals`);
    assert.strictEqual(basic.register, 0, `${id} BASIC register chords`);
    assert.strictEqual(basic.extended, 0, `${id} BASIC extended deals`);
    if (id === "hijaz") {
      // R-3 fallback: the triad-only pool is one loop, so every anchor plays.
      assert.ok(basic.dimAnchor > 0, "hijaz BASIC deals its diminished anchors under the R-3 fallback");
      assert.ok(basic.distinct >= 60, `hijaz BASIC dealt only ${basic.distinct} distinct sequences of 71`);
    } else {
      assert.strictEqual(basic.dimAnchor, 0, `${id} BASIC diminished-anchor chords`);
    }

    // MEDIUM (R-4..R-6).
    within(intermediate.lengths[3], 60, 3, `${id} MEDIUM length 3`);
    within(intermediate.lengths[4], 40, 3, `${id} MEDIUM length 4`);
    if (id !== "hijaz") within(intermediate.home, 40, 4, `${id} MEDIUM home start`);
    within(intermediate.nonAnchor, 20, 4, `${id} MEDIUM non-anchor chords`);
    within(intermediate.pure, 100 / 3, 4, `${id} MEDIUM pure-triad deals`);
    assert.strictEqual(intermediate.register, 0, `${id} MEDIUM register chords`);
    assert.strictEqual(intermediate.extended, 0, `${id} MEDIUM extended deals`);
    const families = [...new Set(mediumCells.filter((c) => c.kind === "colour").map((c) => c.family))].sort();
    assert.deepStrictEqual(families,
      ["other", "seventh", "susPower"], `${id} colour families`);
    assert.deepStrictEqual(Object.keys(intermediate.families).sort(), families);
    for (const fam of families) {
      within(intermediate.families[fam], 100 / families.length, 4, `${id} MEDIUM ${fam} share of colour deals`);
    }

    // HARD (R-7).
    for (const len of [4, 5, 6]) within(advanced.lengths[len], 100 / 3, 3, `${id} HARD length ${len}`);
    assert.ok(advanced.nonAnchor >= 60, `${id} HARD non-anchor chords ${advanced.nonAnchor.toFixed(1)}% under 60%`);
    assert.strictEqual(advanced.pure, 0, `${id} HARD pure-triad deals`);
    // Broad R-7: per deal "(>= 1 extended) OR (>= 2 non-anchor)", exactly.
    // The extended-deal share itself is recorded, not banded (plan §2).
    assert.strictEqual(advanced.hardGateBroken, 0, `${id} HARD deals with neither an extended card nor two non-anchor cards`);
    assert.ok(advanced.extended > 0, `${id} HARD dealt no extended card`);
    assert.strictEqual(advanced.registerBoundBroken, 0, `${id} HARD deals over the register bound`);
  }
});

test("S2: 1,200 public pick() deals per tier classify as their tier and keep the shape", () => {
  const E = engine();
  const TARGET = {
    basic: { 2: 40, 3: 40, 4: 20 },
    intermediate: { 3: 60, 4: 40 },
    advanced: { 4: 100 / 3, 5: 100 / 3, 6: 100 / 3 }
  };
  for (const deck of [HIJAZ, PYGMY, AMARA]) {
    for (const tier of ["basic", "intermediate", "advanced"]) {
      const rng = E.sequence.mulberry32(7);
      const deals = [];
      let prev = null;
      for (let k = 0; k < 1200; k += 1) {
        const result = tier === "basic"
          ? E.sequence.pick(deck, rng, prev)
          : E.sequence.pick(deck, rng, prev, tier);
        assert.ok(result.chords, `${deck.id} ${tier} deal ${k} returned ${result.reason}`);
        const chords = host(result.chords);
        assert.strictEqual(E.sequence.tierOf(deck, chords), tier,
          `${deck.id} ${tier} deal ${k} ${chords} classifies ${E.sequence.tierOf(deck, chords)}`);
        assert.ok(!prev || chords.join(",") !== prev.join(","), `${deck.id} ${tier} deal ${k} repeats prev`);
        deals.push(chords);
        prev = chords;
      }
      const shape = shapeOf(E, deck, deals);
      for (const len of Object.keys(TARGET[tier])) {
        within(shape.lengths[len] || 0, TARGET[tier][len], 6, `${deck.id} ${tier} length ${len}`);
      }
      if (tier === "basic") {
        assert.ok(shape.home >= 70, `${deck.id} BASIC home start ${shape.home.toFixed(1)}% under 70%`);
      }
      if (tier === "advanced") {
        assert.strictEqual(shape.hardGateBroken, 0, `${deck.id} HARD deals outside the broad R-7 predicate`);
        assert.strictEqual(shape.registerBoundBroken, 0, `${deck.id} HARD deals over the register bound`);
      }
    }
  }
});

// M-1..M-5 on one deck's shape run. `strictHome` adds M > H on the home-start
// rate (TR-6: asserted on Pygmy and Amara only). Every measured deck deals
// HARD under the broad R-7 (TR-7 superseded); S3 asserts that.
// `expectRegister` adds the one side of M-3 that can fail (B = M = 0 <= H): a
// deck whose HARD deals are measured to carry non-anchor register cards must
// show H > 0. Eligibility is stated per deck by the caller, not derived.
function assertMonotonic(E, label, deck, run, strictHome, expectRegister) {
  const I = E.sequence._internal;
  const B = run.basic;
  const M = run.intermediate;
  const H = run.advanced;
  assert.ok(B && M && H, `${label}: BASIC, MEDIUM and HARD must all deal`);
  // M-1 mean length.
  assert.ok(B.meanLen < M.meanLen, `${label} M-1: BASIC ${B.meanLen} !< MEDIUM ${M.meanLen}`);
  // M-2 non-anchor share of chords.
  assert.strictEqual(B.nonAnchor, 0, `${label} M-2: BASIC deals a non-anchor chord`);
  assert.ok(B.nonAnchor <= M.nonAnchor, `${label} M-2: BASIC over MEDIUM`);
  // M-3 register share among NON-ANCHOR chords (TR-13).
  assert.strictEqual(B.nonAnchorRegister, 0, `${label} M-3: BASIC`);
  assert.strictEqual(M.nonAnchorRegister, 0, `${label} M-3: MEDIUM`);
  // M-4 vocabulary nests.
  const ctx = I.tierContext(deck);
  const medium = host(I.tierPool(deck, "intermediate", ctx.anchorsList));
  const hard = host(I.tierPool(deck, "advanced", ctx.anchorsList));
  for (const idx of host(ctx.basicVocab)) assert.ok(medium.includes(idx), `${label} M-4: BASIC card ${idx} not in MEDIUM`);
  for (const idx of medium) assert.ok(hard.includes(idx), `${label} M-4: MEDIUM card ${idx} not in HARD`);
  // M-5 home-start rate.
  assert.ok(B.home > M.home, `${label} M-5: BASIC home ${B.home} !> MEDIUM ${M.home}`);
  assert.ok(M.meanLen < H.meanLen, `${label} M-1: MEDIUM ${M.meanLen} !< HARD ${H.meanLen}`);
  assert.ok(M.nonAnchor < H.nonAnchor, `${label} M-2: MEDIUM ${M.nonAnchor} !< HARD ${H.nonAnchor}`);
  if (expectRegister) assert.ok(H.nonAnchorRegister > 0, `${label} M-3: HARD deals no non-anchor register card`);
  assert.ok(B.home > H.home, `${label} M-5: BASIC home ${B.home} !> HARD ${H.home}`);
  if (strictHome) assert.ok(M.home > H.home, `${label} M-5: MEDIUM home ${M.home} !> HARD ${H.home}`);
}

test("S3: difficulty is monotonic (M-1..M-5) on every built-in deck and every sweep deck", () => {
  const E = engine();
  const runs = builtinShapes();
  // Pygmy is the one deck whose HARD deals carry non-anchor register cards
  // (tier-rebalance section 2: 20.3% of HARD chords).
  assertMonotonic(E, "hijaz", HIJAZ, runs.hijaz, false, false);
  assertMonotonic(E, "pygmy", PYGMY, runs.pygmy, true, true);
  assertMonotonic(E, "amara", AMARA, runs.amara, true, false);

  const { full, sweep, reviewer, registerAnchor, registerHome } = generated();
  const rows = [
    ...sweep.map((r) => ({ label: r.label, deck: r.deck })),
    ...reviewer.map((r, i) => ({ label: `reviewer deck ${i}`, deck: r.deck })),
    { label: "REGISTER_ANCHOR_DECK", deck: registerAnchor },
    { label: "REGISTER_HOME_DECK", deck: registerHome }
  ];
  let measured = 0;
  for (const row of rows) {
    const S = full.sequence;
    if (S._internal.homeAnchor(row.deck, S.anchors(row.deck)) === null) continue;
    const run = shapeRun(full, row.deck, 300);
    assertMonotonic(full, row.label, row.deck, run, false, false);
    measured += 1;
  }
  assert.strictEqual(measured, 37 + 4 + 2 - 3, "every sweep deck with a home anchor is measured");
});

// S4 (R-6 / TR-4): the family of every colour card (non-anchor, <= 4 fields,
// no register voicing) on the three built-in decks, by chord NAME.
const COLOUR_FAMILIES = {
  pygmy: {
    susPower: ["F5", "Fsus4", "F7sus4", "Ab5", "Absus4", "Abmaj7sus4", "Bb5", "Bbsus4", "Bb7sus4",
      "C5", "Csus4", "C7sus4", "Db5", "Eb5", "Ebsus4", "Eb7sus4"],
    seventh: ["Fm7", "Gm7b5", "Abmaj7", "Bbm7", "Cm7", "Dbmaj7", "Eb7"],
    other: ["Fmadd9"]
  },
  amara: {
    susPower: ["D5", "Dsus4", "D7sus4", "F5", "G5", "G7sus4", "A5", "Asus4", "A7sus4", "C5", "Csus4"],
    seventh: ["Dm7", "Fmaj7", "Am7"],
    other: ["Dmadd9", "Fadd9", "Cadd9"]
  },
  hijaz: {
    susPower: ["C#5", "C#sus4", "C#7sus4", "F#5", "F#maj7sus4", "B5"],
    seventh: ["C#7", "D°7", "G#m7b5"],
    other: ["B°", "Bmadd9"]
  }
};

test("S4: colourFamily names every built-in colour card's family (sus before 7)", () => {
  const E = engine();
  const I = E.sequence._internal;
  const COUNT = { pygmy: 24, amara: 17, hijaz: 11 };
  for (const deck of [HIJAZ, PYGMY, AMARA]) {
    const anchorsList = host(E.sequence.anchors(deck));
    const got = { susPower: [], seventh: [], other: [] };
    let count = 0;
    deck.chords.forEach((c, i) => {
      if (anchorsList.includes(i) || c.fields.length > 4 || REGISTER_RE.test(c.subtitle || "")) return;
      got[I.colourFamily(deck, i)].push(c.main + (c.sup || ""));
      count += 1;
    });
    assert.strictEqual(count, COUNT[deck.id], `${deck.id} colour-card count`);
    assert.deepStrictEqual(got, COLOUR_FAMILIES[deck.id], `${deck.id} colour families`);
  }
  assert.strictEqual(I.colourFamily(HIJAZ, HIJAZ.chords.findIndex((c) => c.main + (c.sup || "") === "C#7sus4")),
    "susPower", "7sus4 is sus/power: the sus test runs before the 7 test");
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
  const msg = "core must be read when anchors runs, not when sequence loads";
  let lateAnchors;
  assert.doesNotThrow(() => { lateAnchors = late.sequence.anchors(AMARA); }, msg);
  assert.deepEqual(host(lateAnchors), host(E.sequence.anchors(AMARA)), msg);
});

// Lane U1b (PR #254 review 1): with the deck cap gone, MEDIUM's enumeration
// can run out of MEDIUM_ENUM_BUDGET on a pan with nine or more pitch classes.
// A truncated enumeration is the same DFS prefix on every call, so the deal
// must come from random walks instead.
const TRUNCATING_SEEDS = [
  "(C3) C#3 D3 Eb3 E3 F3 F#3 G3 Ab3 A3 Bb3 B3 C4",
  "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | B3 C#4 F#4 G#4"
];

function truncatingDeck(str) {
  const full = loadEngine(FULL_ENGINE_MODULES);
  const parsed = full.core.parseLegacySeed(str, {});
  assert.equal(parsed.ok, true, `fixture seed did not parse: ${str}`);
  const built = full.select.build(parsed.value);
  assert.equal(built.ok, true, `fixture seed did not build: ${str}`);
  return { S: full.sequence, deck: built.value };
}

test("MEDIUM on a truncating pan does not open on one card", () => {
  for (const str of TRUNCATING_SEEDS) {
    const { S, deck } = truncatingDeck(str);
    const I = S._internal;
    const stats = {};
    I.mediumCells(deck, stats);
    assert.strictEqual(stats.truncated, true, `${str} must truncate for this test to mean anything`);
    const ctx = I.tierContext(deck);
    const pool = I.tierPool(deck, "intermediate", ctx.anchorsList);
    const startSet = host(I.tierStartSet(deck, "intermediate", pool, ctx));
    const firstOfFour = new Set();
    let prev = null;
    for (let seed = 0; seed < 400; seed += 1) {
      const result = S.pick(deck, S.mulberry32(seed), prev, "intermediate");
      assert.ok(result.chords, `${str} seed ${seed} returned ${result.reason}`);
      if (result.chords.length === 4) firstOfFour.add(result.chords[0]);
      prev = result.chords;
    }
    assert.ok(firstOfFour.size * 2 >= startSet.length,
      `${str}: length-4 deals opened on ${firstOfFour.size} of ${startSet.length} start cards`);
  }
});

// Captured at 1576ef1 (before any sampling existed): chained 50 MEDIUM picks
// per deck, mulberry32(0..49). The pygmy and amara rows were re-captured
// with the same method on 2026-10-07 (Lane U2), after those two decks gained
// Fmadd9, Fadd9 and Cadd9; the other three rows are unchanged.
const MEDIUM_COMPLETE_GOLDEN = {
  hijaz: [[14,0,10],[14,12,8,10],[14,10,12,6],[14,8,12,6],[10,12,0,14],[10,4,8,14],[14,6,0],[14,0,12],[14,4,12],[14,8,4],[10,12,17],[14,10,3],[10,8,12],[0,7,8],[0,11,14],[10,8,16],[10,14,0,12],[10,0,14,8],[3,0,14],[14,12,10],[1,6,12,14],[4,6,8],[10,14,6,8],[10,14,0],[4,6,12],[10,9,14],[3,6,12],[14,10,8],[10,8,17],[10,14,12],[0,9,14,12],[0,10,15,6],[14,4,10],[1,12,8],[0,7,14,10],[10,12,15],[4,10,14,8],[10,7,14],[14,10,4,12],[3,8,6],[10,13,6,14],[14,10,12,3],[10,0,17,8],[10,0,12,8],[14,6,12,8],[0,12,17],[10,8,16],[14,0,10,12],[0,13,14,6],[0,15,6]],
  pygmy: [[0,7,44],[44,38,0,20],[44,9,20,38],[0,38,7,20],[0,7,38,20],[9,20,44,8],[0,9,7],[25,44,9],[25,51,0],[38,24,9],[25,5,20],[44,7,22],[20,7,44],[0,7,42],[0,20,16],[20,2,9],[0,9,7,20],[0,7,20,25],[2,25,9],[44,38,20],[0,31,7,38],[0,38,24],[0,9,7,25],[0,7,38],[0,42,20],[20,12,7],[2,38,9],[0,38,7],[20,5,38],[0,7,38],[0,9,47,44],[5,20,25,38],[25,42,9],[0,38,34],[0,9,8,25],[20,44,5],[4,9,25,44],[9,51,38],[44,0,36,9],[2,44,25],[20,38,25,8],[44,7,20,40],[9,44,5,7],[0,7,9,44],[38,9,0,44],[5,20,38],[20,2,38],[25,38,9,20],[0,36,7,38],[5,25,7]],
  amara: [[0,15,17],[22,17,8,15],[22,8,17,15],[0,17,22,15],[0,8,22,15],[8,15,21,22],[0,15,22],[17,8,0],[17,10,0],[22,0,21],[15,25,0],[22,8,20],[15,0,8],[0,8,21],[0,15,19],[8,22,18],[0,15,17,8],[0,8,15,22],[2,17,15],[22,17,15],[0,18,15,22],[0,22,21],[0,15,17,8],[0,15,8],[4,8,15],[15,0,19],[2,22,8],[0,17,15],[15,5,22],[0,15,17],[0,14,8,22],[0,17,25,15],[17,4,22],[0,22,3],[0,10,22,15],[15,17,11],[4,17,8,15],[8,22,21],[22,8,21,0],[3,0,8],[15,10,22,0],[22,8,17,14],[8,25,0,17],[0,8,15,22],[17,15,8,22],[0,25,17],[8,22,18],[17,0,15,22],[0,21,22,15],[5,8,15]],
  kurd10: [[0,8,39],[39,32,0,18],[39,10,18,32],[0,32,8,18],[0,8,32,18],[10,18,39,9],[0,10,8],[27,39,10],[27,43,0],[32,22,10],[27,10,35],[39,8,20],[18,8,39],[0,8,34],[0,18,13],[18,2,10],[0,10,8,18],[0,8,18,27],[2,27,10],[39,32,18],[0,29,8,32],[0,32,22],[0,10,8,27],[0,8,32],[0,34,18],[18,11,8],[2,32,10],[0,32,8],[18,15,27],[0,8,32],[0,10,41,39],[0,27,44,18],[27,34,10],[0,32,30],[0,10,9,27],[27,0,35],[4,10,27,39],[10,43,32],[39,0,31,10],[2,39,27],[18,32,27,9],[39,8,18,33],[10,44,0,8],[0,8,10,39],[32,10,0,39],[0,39,15],[18,2,32],[27,32,10,18],[0,31,8,32],[0,44,8]],
  amara10: [[0,15,17],[22,17,8,15],[22,8,17,15],[0,17,22,15],[0,8,22,15],[8,15,21,22],[0,15,22],[17,8,0],[17,10,0],[22,0,21],[15,25,0],[22,8,20],[15,0,8],[0,8,21],[0,15,19],[8,22,18],[0,15,17,8],[0,8,15,22],[2,17,15],[22,17,15],[0,18,15,22],[0,22,21],[0,15,17,8],[0,15,8],[4,8,15],[15,0,19],[2,22,8],[0,17,15],[15,5,22],[0,15,17],[0,14,8,22],[0,17,25,15],[17,4,22],[0,22,3],[0,10,22,15],[15,17,11],[4,17,8,15],[8,22,21],[22,8,21,0],[3,0,8],[15,10,22,0],[22,8,17,14],[8,25,0,17],[0,8,15,22],[17,15,8,22],[0,25,17],[8,22,18],[17,0,15,22],[0,21,22,15],[5,8,15]],
};

test("a deck that completes consumes no extra rng", () => {
  const full = loadEngine(FULL_ENGINE_MODULES);
  const S = full.sequence;
  const build = (str) => full.select.build(full.core.parseLegacySeed(str, {}).value).value;
  const decks = {
    hijaz: HIJAZ,
    pygmy: PYGMY,
    amara: AMARA,
    kurd10: build("(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5"),
    amara10: build("(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5")
  };
  for (const [id, deck] of Object.entries(decks)) {
    const stats = {};
    S._internal.mediumCells(deck, stats);
    assert.strictEqual(stats.truncated, false, `${id} must complete`);
    const dealt = [];
    let prev = null;
    for (let seed = 0; seed < 50; seed += 1) {
      const result = S.pick(deck, S.mulberry32(seed), prev, "intermediate");
      dealt.push(host(result.chords));
      prev = result.chords;
    }
    assert.deepStrictEqual(dealt, MEDIUM_COMPLETE_GOLDEN[id], `${id} MEDIUM deals`);
  }
});

test("every sampled sequence is a MEDIUM sequence", () => {
  for (const str of TRUNCATING_SEEDS) {
    const { S, deck } = truncatingDeck(str);
    const I = S._internal;
    const ctx = I.tierContext(deck);
    const matrix = I.buildConnectMatrix(deck);
    const stats = {};
    const cells = I.mediumCells(deck, stats, undefined, S.mulberry32(7));
    assert.strictEqual(stats.truncated, true);
    assert.ok(stats.sampled >= 1500, `${str}: only ${stats.sampled} distinct sequences sampled`);
    let seen = 0;
    for (const cell of host(cells)) {
      for (const seq of cell.seqs) {
        seen += 1;
        assert.strictEqual(seq.length, cell.length);
        assert.strictEqual(I.classifyTier(deck, seq, ctx), "intermediate", `${str}: ${JSON.stringify(seq)}`);
        assert.ok(seq[seq.length - 1] !== seq[0] && matrix[seq[seq.length - 1]][seq[0]],
          `${str}: ${JSON.stringify(seq)} does not close its loop`);
      }
    }
    assert.strictEqual(seen, stats.sampled, `${str}: every filed sequence is counted once`);
    let prev = null;
    for (let seed = 0; seed < 100; seed += 1) {
      const result = S.pick(deck, S.mulberry32(seed), prev, "intermediate");
      assert.strictEqual(S.tierOf(deck, host(result.chords)), "intermediate",
        `${str} seed ${seed} dealt ${JSON.stringify(host(result.chords))}`);
      prev = result.chords;
    }
  }
});

test("the node count predicts truncation exactly", () => {
  const full = loadEngine(FULL_ENGINE_MODULES);
  const S = full.sequence;
  const I = S._internal;
  const build = (str) => full.select.build(full.core.parseLegacySeed(str, {}).value).value;
  const decks = {
    hijaz: HIJAZ,
    pygmy: PYGMY,
    amara: AMARA,
    kurd10: build("(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5"),
    amara10: build("(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5"),
    pygmy18: build("(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 / F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5")
  };
  TRUNCATING_SEEDS.forEach((str, i) => { decks[`truncating${i}`] = build(str); });
  for (const [id, deck] of Object.entries(decks)) {
    const ctx = I.tierContext(deck);
    const count = I.mediumNodeCount(deck, ctx, I.buildConnectMatrix(deck));
    const unbounded = {};
    I.mediumCells(deck, unbounded, Infinity);
    assert.strictEqual(count, unbounded.nodes, `${id}: count against the unbounded DFS`);
    const bounded = {};
    I.mediumCells(deck, bounded);
    assert.strictEqual(count > I.MEDIUM_ENUM_BUDGET, bounded.truncated, `${id}: count predicts truncation`);
  }
});

// Lane U1b amendment 2 (PR #254 review 2): the sampled cells must not skew
// the owner's MEDIUM shape (home start 40%, pure-triad 33%, each within 4 pp)
// on a pan whose enumeration does not fit the budget.
const OVER_BUDGET_SEEDS = [TRUNCATING_SEEDS[1], REGISTER_HOME_SEED];

test("MEDIUM on an over-budget pan deals inside the shape bands", () => {
  for (const str of OVER_BUDGET_SEEDS) {
    const { S, deck } = truncatingDeck(str);
    const I = S._internal;
    const ctx = I.tierContext(deck);
    assert.ok(I.mediumNodeCount(deck, ctx, I.buildConnectMatrix(deck)) > I.MEDIUM_ENUM_BUDGET,
      `${str} must be over budget`);
    const anchors = new Set(host(ctx.anchorsList));
    const rootPc = (i) => deck.fields[deck.chords[i].roots[0]][2] % 12;
    const picks = 1200;
    let home = 0;
    let pure = 0;
    for (let seed = 0; seed < picks; seed += 1) {
      const chords = host(S.pick(deck, S.mulberry32(seed), null, "intermediate").chords);
      if (rootPc(chords[0]) === ctx.home) home += 1;
      if (chords.every((i) => anchors.has(i))) pure += 1;
    }
    assert.ok(Math.abs(home / picks - 0.4) <= 0.04, `${str}: home start ${home / picks}`);
    assert.ok(Math.abs(pure / picks - 1 / 3) <= 0.04, `${str}: pure-triad ${pure / picks}`);
  }
});

test("an over-budget pan fills every pure cell its anchors allow", () => {
  for (const str of OVER_BUDGET_SEEDS) {
    const { S, deck } = truncatingDeck(str);
    const I = S._internal;
    const ctx = I.tierContext(deck);
    const matrix = I.buildConnectMatrix(deck);
    const anchors = host(ctx.anchorsList);
    const pool = anchors.slice();
    const startSet = host(I.tierStartSet(deck, "intermediate", I.tierPool(deck, "intermediate", ctx.anchorsList), ctx))
      .filter((i) => anchors.includes(i));
    const expected = [];
    for (const len of [3, 4]) {
      const seq = new Array(len);
      const rec = (depth) => {
        if (depth === len) {
          if (seq[len - 1] !== seq[0] && matrix[seq[len - 1]][seq[0]] &&
              I.classifyTier(deck, seq, ctx) === "intermediate") expected.push(seq.join(","));
          return;
        }
        for (const c of depth === 0 ? startSet : pool) {
          if (depth > 0 && (c === seq[depth - 1] || !matrix[seq[depth - 1]][c])) continue;
          seq[depth] = c;
          rec(depth + 1);
        }
      };
      rec(0);
    }
    assert.ok(expected.length > 0, `${str}: the anchors enumeration is empty`);
    const cells = host(I.mediumCells(deck, {}, undefined, S.mulberry32(7)));
    const got = [];
    cells.filter((c) => c.kind === "pure").forEach((c) => c.seqs.forEach((s) => got.push(s.join(","))));
    assert.deepStrictEqual(got.sort(), expected.sort(), `${str}: pure cells against the anchors enumeration`);
  }
});

// Lane U3 (OQ16): on an over-budget pan the colour card's position is a
// stratum, so no position is starved in MEDIUM colour deals.
function colourPositionShares(deck, ctx, chordsList, length) {
  const anchors = new Set(host(ctx.anchorsList));
  const counts = new Array(length).fill(0);
  let total = 0;
  for (const chords of chordsList) {
    if (chords.length !== length) continue;
    const at = chords.findIndex((i) => !anchors.has(i));
    if (at < 0) continue;
    counts[at] += 1;
    total += 1;
  }
  return counts.map((n) => n / total);
}

test("an over-budget pan does not starve a colour position", () => {
  const picks = 4000;
  for (const str of TRUNCATING_SEEDS) {
    const { S, deck } = truncatingDeck(str);
    const I = S._internal;
    const ctx = I.tierContext(deck);
    const sampled = [];
    for (let batch = 0; batch < 40; batch += 1) {
      const cells = I.mediumCells(deck, {}, undefined, S.mulberry32(1000 + batch));
      for (let seed = 0; seed < picks / 40; seed += 1) {
        sampled.push(host(I.drawMedium(cells, S.mulberry32(batch * 1000 + seed), null)));
      }
    }
    const fullCells = I.mediumCells(deck, {}, Infinity);
    const full = [];
    for (let seed = 0; seed < picks; seed += 1) {
      full.push(host(I.drawMedium(fullCells, S.mulberry32(seed), null)));
    }
    for (const length of [3, 4]) {
      const got = colourPositionShares(deck, ctx, sampled, length);
      const ref = colourPositionShares(deck, ctx, full, length);
      got.forEach((share, at) => {
        assert.ok(share >= 0.08, `${str} length ${length} position ${at}: ${share}`);
        if (length === 3) {
          assert.ok(share >= ref[at] / 2, `${str} position ${at}: ${share} against full ${ref[at]}`);
          assert.ok(share <= 0.6, `${str} position ${at}: ${share}`);
        }
      });
      if (length === 3) assert.ok(got[2] >= 0.2, `${str}: last position ${got[2]}`);
    }
  }
});

test("a stratum with no colour start is left out", () => {
  for (const str of TRUNCATING_SEEDS) {
    const { S, deck } = truncatingDeck(str);
    const I = S._internal;
    const ctx = I.tierContext(deck);
    const matrix = I.buildConnectMatrix(deck);
    const anchors = host(ctx.anchorsList);
    const pool = host(I.tierPool(deck, "intermediate", ctx.anchorsList));
    const allStarts = host(I.tierStartSet(deck, "intermediate", I.tierPool(deck, "intermediate", ctx.anchorsList), ctx));
    const isColour = [];
    pool.forEach((i) => { isColour[i] = !anchors.includes(i); });
    anchors.forEach((i) => { isColour[i] = false; });
    const run = (starts) => {
      const filed = [];
      I.sampleMedium(deck, ctx, matrix, S.mulberry32(3), pool, starts, isColour, (w) => filed.push(w.slice()));
      return filed;
    };
    const pureStarts = allStarts.filter((i) => !isColour[i]);
    assert.ok(allStarts.some((i) => isColour[i]), `${str}: expected colour starts`);
    const started = run(pureStarts);
    assert.ok(started.length > 0, `${str}: nothing filed`);
    for (const w of started) {
      assert.strictEqual(w.filter((i) => isColour[i]).length, 1, `${str}: ${JSON.stringify(w)}`);
      assert.ok(!isColour[w[0]], `${str}: ${JSON.stringify(w)} opens on a colour card`);
    }
    for (const w of run(allStarts)) {
      assert.strictEqual(w.filter((i) => isColour[i]).length, 1, `${str}: ${JSON.stringify(w)}`);
    }
  }
});
