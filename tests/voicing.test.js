// Voicing engine: legality (ENGINE-SPEC section 5), the D2 cluster rule and
// the D11 tie-break (section 6), and the D9 root octave (section 7).
//
// Spec-first: every expectation below is read off docs/ENGINE-SPEC.md,
// docs/SCALE_ENGINE_PLAN.md Premises 2/3/5 or CLAUDE.md rule 3, and held
// against the frozen corpus in tests/fixtures/. Nothing is restated from
// src/engine/voicing.js.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { loadEngine } = require("./helpers/engine.js");

const FIXTURES = path.join(__dirname, "fixtures");
const readFixture = (n) => JSON.parse(fs.readFileSync(path.join(FIXTURES, n), "utf8"));

const GOLDEN = readFixture("golden_decks_v1.json");
const QUALITIES = readFixture("qualities.json");
const SYNTHETIC = readFixture("synthetic_scales.json");

const HPE = loadEngine(["core", "voicing"]);
const V = HPE.voicing;

// Engine values live in a node:vm realm; normalise before deepStrictEqual.
const plain = (v) => JSON.parse(JSON.stringify(v));

const pc = (midi) => ((midi % 12) + 12) % 12;

const rec = (fields, id) => fields[String(id)];
const midiOf = (fields, id) => rec(fields, id)[2];
const zoneOf = (fields, id) => rec(fields, id)[3];

// ENGINE-SPEC section 5 DEFAULT: chords[].fields is the voicing in
// chord-spelling order root, 3, 5, 7, 9, 11, 13 - a stack of thirds. So the
// interval set is recovered from the fixture by walking that order and taking,
// for each field, the smallest interval congruent to its pitch class that is
// strictly above the previous one. That reconstruction reproduces exactly the
// `intervals` arrays of qualities.json (extensions as 13, 14, 17, 18, 21).
function intervalsOfCard(deck, chord) {
  const rootPc = pc(midiOf(deck.fields, chord.roots[0]));
  const out = [];
  let prev = -1;
  for (const id of chord.fields) {
    let iv = (pc(midiOf(deck.fields, id)) - rootPc + 12) % 12;
    while (iv <= prev) iv += 12;
    out.push(iv);
    prev = iv;
  }
  return out;
}

const cardKey = (deck, chord) => `${deck.id} ${chord.main}${chord.sup}`;

function everyCard(fn) {
  for (const deck of GOLDEN.decks) {
    for (const chord of deck.chords) fn(deck, chord);
  }
}

// ---------------------------------------------------------------------------
// The recorded two-sided exceptions. Each MUST still diverge: if the engine
// ever reproduces one, this test goes red and the exception is retired.
//
//  * ENGINE-SPEC section 6 / plan Premise 2: Pygmy `Fm9` ships G5 where the
//    D11 nearest-above tie-break gives G4.
//  * ENGINE-SPEC section 7 / plan Premise 3: the D9 root-octave exceptions
//    Pygmy `Db`, `Dbmaj7` and `Eb7`.
//  * ENGINE-SPEC section 7: the five HIGH / LOW VOICING alternates are opt-in
//    multi-voicing DATA, unreachable by any function of (root pitch class,
//    interval set) - one card of each group is reproduced, the rest are not.
// ---------------------------------------------------------------------------
const TWO_SIDED = {
  "pygmy Fm9": "section 6 D11: curated G5, nearest-above gives G4",
  "pygmy Db": "section 7 D9: curated Db4 = U5, the higher bottom-shell instance",
  "pygmy Dbmaj7": "section 7 D9: curated Db4 = U5, the higher bottom-shell instance",
  "pygmy Eb7": "section 7 D9: curated Eb3 on the bottom although rim Eb4 exists",
  "hijaz Bm": "section 7: HIGH VOICING alternate, multi-voicing data",
  "pygmy Ab": "section 7: HIGH VOICING alternate, multi-voicing data",
  "pygmy Cm": "section 7: HIGH / LOW VOICING alternates, multi-voicing data",
  "pygmy Eb": "section 7: LOW VOICING alternate, multi-voicing data",
};

// The alternates ship two or three cards under one key; exactly one card of
// each group is the one the engine reproduces.
const ALTERNATE_GROUPS = { "hijaz Bm": 2, "pygmy Ab": 2, "pygmy Cm": 3, "pygmy Eb": 2 };

test("containment: every one of the 59 fixture voicings is a legal candidate", () => {
  let checked = 0;
  everyCard((deck, chord) => {
    const rootPc = pc(midiOf(deck.fields, chord.roots[0]));
    const set = V.candidates(deck.fields, rootPc, intervalsOfCard(deck, chord))
      .map((ids) => ids.join(","));
    assert.ok(
      set.includes(chord.fields.join(",")),
      `${cardKey(deck, chord)}: curated voicing ${chord.fields.join(",")} is not in the ` +
      `candidate set (${set.length} candidates)`);
    checked += 1;
  });
  assert.strictEqual(checked, 59, "the corpus is 59 cards");
});

test("candidate ids are numbers in chord-spelling order starting at the root", () => {
  everyCard((deck, chord) => {
    const rootPc = pc(midiOf(deck.fields, chord.roots[0]));
    const ivs = intervalsOfCard(deck, chord);
    for (const ids of V.candidates(deck.fields, rootPc, ivs)) {
      assert.strictEqual(ids.length, ivs.length, cardKey(deck, chord));
      for (const id of ids) assert.strictEqual(typeof id, "number", cardKey(deck, chord));
      assert.strictEqual(pc(midiOf(deck.fields, ids[0])), rootPc,
        `${cardKey(deck, chord)}: a candidate does not start on the root`);
      ids.forEach((id, i) => {
        assert.strictEqual(pc(midiOf(deck.fields, id)), pc(rootPc + ivs[i]),
          `${cardKey(deck, chord)}: candidate position ${i} is not the spelled tone`);
      });
    }
  });
});

test("choose reproduces the corpus outside the recorded two-sided exceptions", () => {
  const matched = [];
  const diverged = [];
  everyCard((deck, chord) => {
    const key = cardKey(deck, chord);
    const rootPc = pc(midiOf(deck.fields, chord.roots[0]));
    const got = V.choose(deck.fields, rootPc, intervalsOfCard(deck, chord));
    assert.ok(got.ok, `${key}: choose failed with ${got.code}`);
    const value = plain(got.value);
    const want = { fields: chord.fields, roots: chord.roots };
    if (JSON.stringify(value) === JSON.stringify(want)) {
      matched.push(key);
    } else {
      assert.ok(TWO_SIDED[key], `${key}: choose gave ${JSON.stringify(value)}, ` +
        `fixture ships ${JSON.stringify(want)} - not a recorded exception`);
      diverged.push(key);
    }
  });

  // Two-sided: every recorded exception must STILL diverge, and each alternate
  // group must contribute exactly (group size - 1) divergences, because the
  // engine reproduces one card of the group.
  for (const key of Object.keys(TWO_SIDED)) {
    const n = diverged.filter((k) => k === key).length;
    const expected = ALTERNATE_GROUPS[key] ? ALTERNATE_GROUPS[key] - 1 : 1;
    assert.strictEqual(n, expected,
      `${key} is recorded as a two-sided exception (${TWO_SIDED[key]}) but ` +
      `diverged ${n} times, expected ${expected}`);
  }
  assert.strictEqual(matched.length + diverged.length, 59);
  // Plan Premise 3: "50/59 cards fully automatically", 8 root-octave misses
  // (5 of them the alternates) plus the Fm9 register.
  assert.strictEqual(diverged.length, 9);
  assert.strictEqual(matched.length, 50);
});

test("with the root field given, choose reproduces 58/59 - only Fm9 diverges", () => {
  // Plan Premise 2 measures the register rules with the ROOT FIELD supplied
  // ("giving the engine the root FIELD, the spelling order of pitch classes
  // and the chord symbol"): the strict reading - unforced tones take the
  // NEAREST instance above the root - reproduces 58/59. The one divergence is
  // Pygmy Fm9, which CLAUDE.md rule 3 names as a permitted free choice.
  //
  // This gate is stricter than the (root pitch class, interval set) one above:
  // the D9 root-octave exceptions and the HIGH / LOW VOICING alternates must
  // all come back exactly once their root field is no longer in question.
  const matched = [];
  const diverged = [];
  everyCard((deck, chord) => {
    const rootId = chord.roots[0];
    const rootPc = pc(midiOf(deck.fields, rootId));
    const got = V.choose(deck.fields, rootPc, intervalsOfCard(deck, chord), { rootId });
    assert.ok(got.ok, `${cardKey(deck, chord)}: choose failed with ${got.code}`);
    const value = plain(got.value);
    assert.deepStrictEqual(value.roots, [rootId], "a pinned root field is used verbatim");
    if (JSON.stringify(value.fields) === JSON.stringify(chord.fields)) {
      matched.push(cardKey(deck, chord));
    } else {
      assert.strictEqual(cardKey(deck, chord), "pygmy Fm9",
        `${cardKey(deck, chord)}: with the root field given, choose gave ` +
        `${value.fields.join(",")} and the fixture ships ${chord.fields.join(",")}. ` +
        "Premise 2 allows exactly one divergence, Pygmy Fm9.");
      diverged.push(cardKey(deck, chord));
    }
  });
  assert.strictEqual(matched.length, 58, "plan Premise 2: 58/59 under the strict reading");
  assert.deepStrictEqual(diverged, ["pygmy Fm9"]);

  // Two-sided: Fm9 must STILL diverge, and by the documented note - the
  // fixture's spread 9th is G5, the nearest-above tie-break gives G4.
  const pygmy = GOLDEN.decks.find((d) => d.id === "pygmy");
  const fm9 = pygmy.chords.find((c) => c.main === "Fm" && c.sup === "9");
  const got = V.choose(pygmy.fields, pc(midiOf(pygmy.fields, fm9.roots[0])),
    [0, 3, 7, 10, 14], { rootId: fm9.roots[0] });
  const ninth = plain(got.value.fields)[4];
  assert.notStrictEqual(ninth, fm9.fields[4]);
  assert.strictEqual(pc(midiOf(pygmy.fields, ninth)), pc(midiOf(pygmy.fields, fm9.fields[4])),
    "both are the same tone, the 9th");
  assert.strictEqual(
    midiOf(pygmy.fields, fm9.fields[4]) - midiOf(pygmy.fields, ninth), 12,
    "the fixture's 9th is one octave above the nearest-above one (G5 vs G4)");
});

test("choose rejects a pinned root that is not a playable field of the root", () => {
  const amara = GOLDEN.decks.find((d) => d.id === "amara");
  const dm = amara.chords.find((c) => c.main === "Dm" && c.sup === "");
  const rootPc = pc(midiOf(amara.fields, dm.roots[0]));

  // The ding is a D on Amara, but the ding never appears in a voicing.
  assert.strictEqual(zoneOf(amara.fields, 0), "ding");
  assert.strictEqual(pc(midiOf(amara.fields, 0)), rootPc);
  const ding = V.choose(amara.fields, rootPc, [0, 3, 7], { rootId: 0 });
  assert.strictEqual(ding.ok, false);

  // A field of the wrong pitch class is not a root: the root never changes.
  const wrong = V.choose(amara.fields, rootPc, [0, 3, 7], { rootId: 2 });
  assert.strictEqual(wrong.ok, false);

  // An absent opts, an empty opts and an explicit D9 root all agree.
  const bare = plain(V.choose(amara.fields, rootPc, [0, 3, 7]));
  assert.deepStrictEqual(plain(V.choose(amara.fields, rootPc, [0, 3, 7], {})), bare);
  assert.deepStrictEqual(
    plain(V.choose(amara.fields, rootPc, [0, 3, 7], { rootId: dm.roots[0] })), bare);
});

test("D9 root octave: lowest top-shell instance, else lowest overall", () => {
  // The recorded root-octave exceptions of section 7 plus the alternates whose
  // divergence is the root field; every other card's roots[0] IS the policy.
  const rootExceptions = new Set([
    "pygmy Db", "pygmy Dbmaj7", "pygmy Eb7",
    "hijaz Bm", "pygmy Ab", "pygmy Cm", "pygmy Eb",
  ]);
  everyCard((deck, chord) => {
    const key = cardKey(deck, chord);
    const rootPc = pc(midiOf(deck.fields, chord.roots[0]));
    const rf = V.rootField(deck.fields, rootPc);
    assert.ok(rf, `${key}: no root field`);
    if (rootExceptions.has(key)) return;
    assert.strictEqual(rf.id, chord.roots[0],
      `${key}: D9 picked field ${rf.id}, fixture ships ${chord.roots[0]}`);
  });

  // Pygmy Db exists only on the bottom shell (U5 Db4, U2 Db3): "the lowest
  // instance overall" applies, and it is the LOWEST of the two.
  const pygmy = GOLDEN.decks.find((d) => d.id === "pygmy");
  const dbRoot = V.rootField(pygmy.fields, pc(61));
  assert.strictEqual(zoneOf(pygmy.fields, dbRoot.id), "bottom");
  assert.strictEqual(midiOf(pygmy.fields, dbRoot.id), 49, "U2 Db3, the lowest instance");

  // Pygmy F sits on the ding (F3) and on the top shell (F4, F5). The ding never
  // appears in a voicing, so the root is F4, never the ding.
  const fRoot = V.rootField(pygmy.fields, pc(65));
  assert.notStrictEqual(zoneOf(pygmy.fields, fRoot.id), "ding");
  assert.strictEqual(midiOf(pygmy.fields, fRoot.id), 65);
});

test("D2 forced chords cluster chord tones to the highest instance below the root", () => {
  const amara = GOLDEN.decks.find((d) => d.id === "amara");
  // CLAUDE.md rule 3 / plan Premise 2: Amara Fmaj7 is forced (its 7th, E, has
  // no instance above F4) and ships spelling order F A C E, all below the root.
  const fmaj7 = amara.chords.find((c) => c.main === "Fmaj" && c.sup === "7");
  const got = V.choose(amara.fields, pc(midiOf(amara.fields, fmaj7.roots[0])),
    [0, 4, 7, 11]);
  assert.deepStrictEqual(plain(got.value.fields), fmaj7.fields);
  const rootMidi = midiOf(amara.fields, got.value.roots[0]);
  for (const id of plain(got.value.fields).slice(1)) {
    assert.ok(midiOf(amara.fields, id) < rootMidi,
      "every chord tone of a forced chord sits below the root");
  }

  // ENGINE-SPEC section 6: bottom-shell fields are ordinary instances - Pygmy
  // Cm7 clusters its 3rd to Eb3 on the bottom shell (U3).
  const pygmy = GOLDEN.decks.find((d) => d.id === "pygmy");
  const cm7 = pygmy.chords.find((c) => c.main === "Cm" && c.sup === "7");
  const gotCm7 = V.choose(pygmy.fields, pc(midiOf(pygmy.fields, cm7.roots[0])),
    [0, 3, 7, 10]);
  assert.deepStrictEqual(plain(gotCm7.value.fields), cm7.fields);
  assert.strictEqual(zoneOf(pygmy.fields, plain(gotCm7.value.fields)[1]), "bottom");

  // HIGHEST, not merely "below": Pygmy Fm11 (root F4) is the case with TWO
  // instances below the root for both the 5th (C4, C3) and the 7th (Eb4, Eb3).
  // The rule names the highest of them, so C4/Eb4 - a "lowest below" reading
  // would give C3/Eb3 and is what this case exists to reject.
  const fm11 = pygmy.chords.find((c) => c.main === "Fm" && c.sup === "11");
  const gotFm11 = V.choose(pygmy.fields, pc(midiOf(pygmy.fields, fm11.roots[0])),
    [0, 3, 7, 10, 14, 17]);
  const fm11Ids = plain(gotFm11.value.fields);
  const fm11Root = midiOf(pygmy.fields, fm11Ids[0]);
  for (const i of [2, 3]) {
    const midi = midiOf(pygmy.fields, fm11Ids[i]);
    assert.ok(midi < fm11Root, `tone ${i} of Fm11 sits below the root`);
    let highestBelow = -Infinity;
    for (const key of Object.keys(pygmy.fields)) {
      const r = pygmy.fields[key];
      if (r[3] === "ding") continue;
      if (pc(r[2]) !== pc(midi) || r[2] >= fm11Root) continue;
      if (r[2] > highestBelow) highestBelow = r[2];
    }
    let instancesBelow = 0;
    for (const key of Object.keys(pygmy.fields)) {
      const r = pygmy.fields[key];
      if (r[3] === "ding") continue;
      if (pc(r[2]) === pc(midi) && r[2] < fm11Root) instancesBelow += 1;
    }
    assert.strictEqual(instancesBelow, 2, `tone ${i} of Fm11 has two instances below`);
    assert.strictEqual(midi, highestBelow,
      `tone ${i} of Fm11 took ${midi}, not the highest instance below the root`);
  }
});

test("D2 forced chords keep their extensions above the root unless forced too", () => {
  const pygmy = GOLDEN.decks.find((d) => d.id === "pygmy");
  const fm11 = pygmy.chords.find((c) => c.main === "Fm" && c.sup === "11");
  const rootPc = pc(midiOf(pygmy.fields, fm11.roots[0]));
  // ENGINE-SPEC section 6: Fm11 counts as forced because its 11th forces it.
  const got = V.choose(pygmy.fields, rootPc, [0, 3, 7, 10, 14, 17]);
  assert.deepStrictEqual(plain(got.value.fields), fm11.fields);

  const ids = plain(got.value.fields);
  const rootMidi = midiOf(pygmy.fields, ids[0]);
  // chord tones (3rd, 5th, 7th) below; the 9th above; the 11th, itself forced,
  // below.
  assert.ok(midiOf(pygmy.fields, ids[1]) < rootMidi, "3rd clusters below");
  assert.ok(midiOf(pygmy.fields, ids[2]) < rootMidi, "5th clusters below");
  assert.ok(midiOf(pygmy.fields, ids[3]) < rootMidi, "7th clusters below");
  assert.ok(midiOf(pygmy.fields, ids[4]) > rootMidi, "the 9th keeps its instance above");
  assert.ok(midiOf(pygmy.fields, ids[5]) < rootMidi, "the 11th is itself forced");
});

test("D11 unforced chords take the nearest instance above the root", () => {
  const pygmy = GOLDEN.decks.find((d) => d.id === "pygmy");
  // Pygmy Fm9 is unforced; every tone has an instance above F4. The tie-break
  // gives the NEAREST one, so the 9th is G4 - the fixture's G5 is the single
  // recorded register exception (section 6, plan Premise 2).
  const fm9 = pygmy.chords.find((c) => c.main === "Fm" && c.sup === "9");
  const rootPc = pc(midiOf(pygmy.fields, fm9.roots[0]));
  const got = V.choose(pygmy.fields, rootPc, [0, 3, 7, 10, 14]);
  const ids = plain(got.value.fields);
  const rootMidi = midiOf(pygmy.fields, ids[0]);

  for (let i = 1; i < ids.length; i += 1) {
    const midi = midiOf(pygmy.fields, ids[i]);
    assert.ok(midi > rootMidi, "an unforced chord puts every tone above the root");
    const wanted = pc(midi);
    let nearest = Infinity;
    for (const key of Object.keys(pygmy.fields)) {
      const r = pygmy.fields[key];
      if (r[3] === "ding") continue;
      if (pc(r[2]) !== wanted || r[2] <= rootMidi) continue;
      if (r[2] < nearest) nearest = r[2];
    }
    assert.strictEqual(midi, nearest, `tone ${i} is not the nearest instance above`);
  }
  // Two-sided: the fixture's spread 9th is G5, the tie-break's is G4.
  assert.notStrictEqual(ids[4], fm9.fields[4]);
  assert.ok(midiOf(pygmy.fields, ids[4]) < midiOf(pygmy.fields, fm9.fields[4]));
});

test("legality invariants hold over every candidate on every synthetic pan", () => {
  const suffixes = Object.keys(QUALITIES);
  let pans = 0;
  let voicings = 0;

  for (const row of SYNTHETIC) {
    if (!row.expect || row.expect.ok !== true) continue;
    const parsed = HPE.core.parseSeed(row.string);
    assert.ok(parsed.ok, `${row.name}: ${row.string} should parse`);
    const fields = plain(parsed.value.fields);
    pans += 1;

    const playablePcs = new Set();
    for (const key of Object.keys(fields)) {
      if (fields[key][3] === "ding") continue;
      playablePcs.add(pc(fields[key][2]));
    }

    for (const rootPc of playablePcs) {
      for (const suffix of suffixes) {
        const ivs = QUALITIES[suffix].intervals;
        const sets = V.candidates(fields, rootPc, ivs);
        const wanted = new Set(ivs.map((iv) => pc(rootPc + iv)));
        const reachable = [...wanted].every((p) => playablePcs.has(p));
        // A quality whose pitch classes are all on non-ding fields must yield
        // candidates; one that is not reachable must yield none.
        if (!reachable) {
          assert.strictEqual(sets.length, 0,
            `${row.name} ${suffix}: unreachable quality produced candidates`);
          continue;
        }
        assert.ok(sets.length > 0, `${row.name} ${suffix}: no candidate`);

        for (const ids of sets) {
          voicings += 1;
          // section 5: the ding never appears in a voicing.
          for (const id of ids) {
            assert.notStrictEqual(fields[String(id)][3], "ding",
              `${row.name} ${suffix}: the ding is in a voicing`);
          }
          // section 5: no two fields of the same pitch class.
          const seen = new Set();
          for (const id of ids) {
            const p = pc(fields[String(id)][2]);
            assert.ok(!seen.has(p),
              `${row.name} ${suffix}: doubled pitch class in ${ids.join(",")}`);
            seen.add(p);
          }
          // section 5 / D3: a voicing never exceeds 6 notes.
          assert.ok(ids.length <= 6,
            `${row.name} ${suffix}: ${ids.length} notes exceeds the 6-note budget`);
          // section 5: a power chord is exactly two notes, root and fifth.
          if (suffix === "5") {
            assert.strictEqual(ids.length, 2, `${row.name}: a power chord is two notes`);
            assert.strictEqual((pc(fields[String(ids[1])][2]) - rootPc + 12) % 12, 7);
          }
        }

        // The same invariants for the single chosen voicing.
        const chosen = V.choose(fields, rootPc, ivs);
        assert.ok(chosen.ok, `${row.name} ${suffix}: choose failed`);
        const ids = plain(chosen.value.fields);
        assert.ok(sets.some((c) => c.join(",") === ids.join(",")),
          `${row.name} ${suffix}: choose returned a voicing outside the candidate set`);
        assert.deepStrictEqual(plain(chosen.value.roots), [ids[0]]);
      }
    }
  }
  assert.strictEqual(pans, 11, "every ok row of synthetic_scales.json");
  assert.ok(voicings > 1000, `only ${voicings} candidate voicings swept`);
});

test("the 6-note budget drops the lowest optional extension first", () => {
  // A pan carrying C D E F G A Bb, so every tone of a C13 exists.
  const parsed = HPE.core.parseSeed("(C3) D3 E3 F3 G3 A3 Bb3 C4 D4 E4 F4");
  assert.ok(parsed.ok);
  const fields = plain(parsed.value.fields);
  const thirteenth = QUALITIES["13"].intervals; // [0,4,7,10,14,17,21]
  assert.strictEqual(thirteenth.length, 7);

  const sets = V.candidates(fields, 0, thirteenth);
  assert.ok(sets.length > 0);
  const dropped = pc(0 + 14); // the 9th, the lowest optional extension
  const kept = [0, 4, 7, 10, 17, 21].map((iv) => pc(iv));
  for (const ids of sets) {
    assert.strictEqual(ids.length, 6, "a 13 chord is trimmed to the 6-note budget");
    const pcs = ids.map((id) => pc(fields[String(id)][2]));
    assert.ok(!pcs.includes(dropped), "the 9th is the tone dropped");
    for (const p of kept) {
      assert.ok(pcs.includes(p), "chord tones and the higher extensions are kept");
    }
  }
  const chosen = V.choose(fields, 0, thirteenth);
  assert.ok(chosen.ok);
  assert.strictEqual(plain(chosen.value.fields).length, 6);
});

test("isLegal enforces the section 5 invariants", () => {
  const amara = GOLDEN.decks.find((d) => d.id === "amara");
  const dm = amara.chords.find((c) => c.main === "Dm" && c.sup === "");
  assert.ok(V.isLegal(amara.fields, dm.fields, [0, 3, 7]), "a curated voicing is legal");

  // The ding is id "0" on every built-in.
  assert.strictEqual(zoneOf(amara.fields, 0), "ding");
  assert.strictEqual(V.isLegal(amara.fields, [0].concat(dm.fields.slice(1))), false,
    "the ding never appears in a voicing");

  // Amara ships C4 (id 2) and C5 (id 8): the same pitch class twice.
  assert.strictEqual(pc(midiOf(amara.fields, 2)), pc(midiOf(amara.fields, 8)));
  assert.strictEqual(V.isLegal(amara.fields, [1, 2, 8]), false,
    "no voicing contains two fields of the same pitch class");

  // Seven distinct pitch classes cannot be a voicing: the budget is 6.
  const seven = [];
  const used = new Set();
  for (const key of Object.keys(amara.fields)) {
    const r = amara.fields[key];
    if (r[3] === "ding" || used.has(pc(r[2]))) continue;
    used.add(pc(r[2]));
    seven.push(Number(key));
  }
  assert.ok(seven.length >= 6);
  assert.strictEqual(V.isLegal(amara.fields, seven.slice(0, 6)), true);
  if (seven.length >= 7) {
    assert.strictEqual(V.isLegal(amara.fields, seven.slice(0, 7)), false,
      "a voicing never exceeds 6 notes");
  }

  // A power chord is exactly two notes.
  const d5 = amara.chords.find((c) => c.main === "D5");
  assert.strictEqual(d5.fields.length, 2);
  assert.strictEqual(V.isLegal(amara.fields, d5.fields, [0, 7]), true);
  assert.strictEqual(V.isLegal(amara.fields, dm.fields, [0, 7]), false,
    "a three-note voicing is not a power chord");
});

test("choose and candidates are deterministic", () => {
  everyCard((deck, chord) => {
    const rootPc = pc(midiOf(deck.fields, chord.roots[0]));
    const ivs = intervalsOfCard(deck, chord);
    const a = plain(V.choose(deck.fields, rootPc, ivs));
    const b = plain(V.choose(deck.fields, rootPc, ivs));
    assert.deepStrictEqual(a, b, cardKey(deck, chord));
    assert.deepStrictEqual(
      plain(V.candidates(deck.fields, rootPc, ivs)),
      plain(V.candidates(deck.fields, rootPc, ivs)),
      cardKey(deck, chord));
  });
});

test("choose rejects a pitch class the pan does not carry, with a spec code", () => {
  const amara = GOLDEN.decks.find((d) => d.id === "amara");
  // Amara carries no Bb anywhere, so a Dm7b5 (root D, tones F, Ab, C) has an
  // absent tone: Ab.
  const got = V.choose(amara.fields, pc(62), [0, 3, 6, 10]);
  assert.strictEqual(got.ok, false);
  assert.ok(Object.prototype.hasOwnProperty.call(plain(HPE.core.REASONS), got.code),
    `${got.code} is not a code of the ENGINE-SPEC section 2 enum`);
  assert.strictEqual(typeof got.reason, "string");
  assert.ok(got.reason.length > 0);
  assert.strictEqual(got.value, undefined, "an err result never carries value");

  // A root pitch class that is not on the pan is rejected the same way.
  const noRoot = V.choose(amara.fields, pc(61), [0, 4, 7]);
  assert.strictEqual(noRoot.ok, false);
  assert.ok(Object.prototype.hasOwnProperty.call(plain(HPE.core.REASONS), noRoot.code));
  assert.strictEqual(V.rootField(amara.fields, pc(61)), null);
});
