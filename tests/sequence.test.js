// HPE.sequence - the chord-sequence-mode engine (S1 of
// docs/plans/2026-09-29-chord-sequence-mode.md). Tests are named exactly as
// listed in that plan's section 3 ("S1 failing tests").
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadEngine } = require("./helpers/engine.js");

const ROOT = path.join(__dirname, "..");
const DECKS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "decks.json"), "utf8"));

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

  const originalRandom = Math.random;
  Math.random = () => { throw new Error("pick must not call Math.random"); };
  try {
    const rng3 = E.sequence.mulberry32(7);
    assert.doesNotThrow(() => E.sequence.pick(PYGMY, rng3, null));
  } finally {
    Math.random = originalRandom;
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
