// Lane C - HPE.naming: chord names, subtitles, parent inference, degrees.
//
// READING (recorded, not spec text): `caseFromPan` - the fallback used for a
// pitch class OUTSIDE the parent - suppresses the `\u00b0` suffix when a perfect
// fifth above the degree is also on the pan, even though a diminished fifth is
// present too. Over the pan alone a degree that carries BOTH a b5 and a
// natural 5 is read as the plain triad, not as diminished; `\u00b0` is reserved
// for a degree whose only available fifth is diminished. The behaviour is kept
// here deliberately - see "outside the parent, a natural fifth on the pan
// suppresses the degree sign".
//
// Spec-first per tests/CONTRACT.md rule 1: every assertion comes from
// docs/ENGINE-SPEC.md sections 5, 8, 9, 10, 16 and 17, from CLAUDE.md, or from
// the fixtures. The QUALITIES / PARENTS tables are compared to the spec
// fixtures under rule 2's carve-out: the fixture IS the spec and the module
// carries its own literal copy that this file holds to it.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadEngine } = require("./helpers/engine.js");

const ROOT = path.join(__dirname, "..");
const engine = loadEngine(["core", "naming"]);
const naming = engine.naming;
const core = engine.core;

function fixture(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "fixtures", file), "utf8"));
}

const golden = fixture("golden_decks_v1.json");
const synthetic = fixture("synthetic_scales.json");

// The engine runs in its own node:vm realm, so its values carry that realm's
// prototypes. deepStrictEqual compares prototypes; normalise through JSON.
function host(value) {
  return JSON.parse(JSON.stringify(value));
}

/* ================= the recorded, TWO-SIDED exception lists ================
 *
 * Section 9: the editorial built-in subtitles are recorded exceptions of the
 * fixture, not strings the engine generates; Hijaz's two hand-authored (NO 5)
 * cards are excluded from the naming exit entirely. Section 10: D Amara ships
 * three frozen degree exceptions. Every entry below is asserted to ACTUALLY
 * differ from what the engine produces, so an exception that stops being one
 * turns the suite red instead of quietly hiding a match.
 */

// deck id + card index -> excluded entirely (section 9, hand-authored (NO 5)).
const EXCLUDED_CARDS = [
  {deck: "hijaz", main: "Dmaj", sup: "7"},
  {deck: "hijaz", main: "Dmaj7", sup: "#11"}
];

// deck id + card index -> the editorial subtitle the engine does not generate.
const SUBTITLE_EXCEPTIONS = [
  {deck: "hijaz", subtitle: "HIJAZ SIGNATURE CHORD"},
  {deck: "hijaz", subtitle: "B MINOR - HIGH VOICING"},
  {deck: "pygmy", subtitle: "Ab MAJOR - HIGH VOICING"},
  {deck: "pygmy", subtitle: "C MINOR - LOW VOICING"},
  {deck: "pygmy", subtitle: "C MINOR - HIGH VOICING"},
  {deck: "pygmy", subtitle: "Eb MAJOR - LOW VOICING"}
];

// deck id + pitch class -> the frozen degree label (section 10, D8 and D10).
const DEGREE_EXCEPTIONS = [
  {deck: "amara", pc: "5", label: "bIII"},   // D8: derived III
  {deck: "amara", pc: "0", label: "bVII"},   // D8: derived VII
  {deck: "amara", pc: "7", label: "IV"}      // D10: derived iv
];

/* ------------------------------ helpers ---------------------------------- */

function deckPitchClasses(deck) {
  return Object.keys(deck.fields).map((id) => deck.fields[id][2] % 12);
}

function tonicOf(deck) {
  return deck.fields["0"][2] % 12;
}

function cardsOf(deck) {
  return deck.chords.filter((chord) => !EXCLUDED_CARDS.some(
    (x) => x.deck === deck.id && x.main === chord.main && x.sup === chord.sup));
}

// A card's root spelling is the label of its root field; stripping it off
// `main` and appending `sup` recovers the full quality suffix qualities.json is
// keyed on (`G#m7` + `b5` -> `m7b5`, `Dmaj` + `7` -> `maj7`).
function suffixOf(deck, chord) {
  const rootName = deck.fields[String(chord.roots[0])][0];
  assert.ok(chord.main.startsWith(rootName),
    `${deck.id}: ${chord.main} does not start with its root ${rootName}`);
  return {root: rootName, suffix: chord.main.slice(rootName.length) + chord.sup};
}

// D4 / section 5: the equivalence root is a minor third above the root, named
// from a field of the deck that carries that pitch class.
function equivRootName(deck, chord) {
  const m = / \( = ([A-G][#b]?)m?6 \)$/.exec(chord.subtitle);
  return m ? m[1] : null;
}

const seeds = synthetic.filter((row) => row.expect && row.expect.ok);

function seedPitchClasses(row) {
  const parsed = core.parseSeed(row.string);
  assert.equal(parsed.ok, true, `${row.name}: expected to parse`);
  const fields = parsed.value.fields;
  return {
    fields,
    pcs: Object.keys(fields).map((id) => fields[id][2] % 12),
    tonic: fields["0"][2] % 12
  };
}

// The parent-degree index of a pitch class under a named parent, or -1 when
// the pitch class is outside that parent.
function degreeIndexIn(parentName, tonic, degreePc) {
  const parent = host(naming.PARENTS).find((p) => p.name === parentName);
  return parent.intervals.indexOf(((degreePc - tonic) % 12 + 12) % 12);
}

/* ================ section 16: the tables are the fixtures ================ */

test("QUALITIES is tests/fixtures/qualities.json, verbatim", () => {
  assert.deepStrictEqual(host(naming.QUALITIES), fixture("qualities.json"));
});

test("PARENTS is tests/fixtures/parents.json, in the fixed list order", () => {
  assert.deepStrictEqual(host(naming.PARENTS), fixture("parents.json"));
  // Section 10: Aeolian precedes Dorian deliberately.
  const order = host(naming.PARENTS).map((p) => p.name);
  assert.ok(order.indexOf("Aeolian") < order.indexOf("Dorian"),
    "Aeolian must precede Dorian: they tie at distance 0 on D Amara");
});

/* ===================== section 9: main / sup / subtitle =================== */

test("every built-in card's main and sup come from the quality table", () => {
  let checked = 0;
  for (const deck of golden.decks) {
    for (const chord of cardsOf(deck)) {
      const {root, suffix} = suffixOf(deck, chord);
      assert.deepStrictEqual(host(naming.name(root, suffix)),
        {main: chord.main, sup: chord.sup}, `${deck.id}: ${chord.main}${chord.sup}`);
      checked += 1;
    }
  }
  assert.equal(checked, 57, "59 built-in cards less the two excluded (NO 5) cards");
});

test("every built-in subtitle is generated, modulo the recorded exceptions", () => {
  let generated = 0;
  const exceptionsSeen = [];
  for (const deck of golden.decks) {
    for (const chord of cardsOf(deck)) {
      const {root, suffix} = suffixOf(deck, chord);
      const produced = naming.subtitle(root, suffix, equivRootName(deck, chord));
      const isException = SUBTITLE_EXCEPTIONS.some(
        (x) => x.deck === deck.id && x.subtitle === chord.subtitle);
      if (isException) {
        // Two-sided: an exception that no longer differs is a stale exception.
        assert.notEqual(produced, chord.subtitle,
          `${deck.id}: ${chord.subtitle} is recorded as an exception but the ` +
          "engine now generates it - remove it from SUBTITLE_EXCEPTIONS");
        exceptionsSeen.push(deck.id + ": " + chord.subtitle);
      } else {
        assert.equal(produced, chord.subtitle, `${deck.id}: ${chord.main}${chord.sup}`);
        generated += 1;
      }
    }
  }
  assert.equal(exceptionsSeen.length, SUBTITLE_EXCEPTIONS.length,
    "every recorded subtitle exception must appear in the fixture");
  assert.equal(generated, 51);
});

test("the two ( = X6 ) equivalences are generated, not excepted", () => {
  const annotated = [];
  for (const deck of golden.decks) {
    for (const chord of cardsOf(deck)) {
      if (!/ \( = /.test(chord.subtitle)) continue;
      const {root, suffix} = suffixOf(deck, chord);
      assert.equal(naming.subtitle(root, suffix, equivRootName(deck, chord)),
        chord.subtitle);
      annotated.push(chord.subtitle);
    }
  }
  // Section 8: the built-ins keep exactly these two.
  assert.deepStrictEqual(annotated.sort(),
    ["Bb MINOR 7 ( = Db6 )", "HALF-DIMINISHED ( = Bm6 )"]);
});

test("the rooted flag decides whether the subtitle carries the root", () => {
  assert.equal(naming.subtitle("F", "m7"), "F MINOR 7");
  assert.equal(naming.subtitle("F", "5"), "POWER CHORD");
  assert.equal(naming.subtitle("G#", "m7b5"), "HALF-DIMINISHED");
  assert.equal(naming.subtitle("C#", "sus4"), "SUSPENDED CHORD");
});

test("section 5: the 6-chord collapse annotation", () => {
  assert.equal(naming.subtitle("Bb", "m7", "Db"), "Bb MINOR 7 ( = Db6 )");
  assert.equal(naming.subtitle("G#", "m7b5", "B"), "HALF-DIMINISHED ( = Bm6 )");
  assert.throws(() => naming.subtitle("F", "m", "Ab"), /no equivalence/);
});

test("every subtitle the table can produce for a two-character root fits 26", () => {
  const table = fixture("qualities.json");
  let longest = "";
  for (const suffix of Object.keys(table)) {
    const equivs = suffix === "m7" || suffix === "m7b5" ? ["Bb"] : [null];
    for (const equiv of equivs) {
      const produced = naming.subtitle("Bb", suffix, equiv);
      assert.ok(produced.length <= 26, `${produced} is ${produced.length} chars`);
      if (produced.length > longest.length) longest = produced;
    }
  }
  // Section 9: 26, not 25 - the longest a two-character root can produce.
  assert.equal(longest, "HALF-DIMINISHED ( = Bbm6 )");
  assert.equal(longest.length, 26);
});

test("the 26-character subtitle cap and the 16-character name cap are hard", () => {
  assert.equal(naming.subtitle("Bb", "m7b5", "Bb").length, 26);
  assert.throws(() => naming.subtitle("Bbbb", "m7b5", "Bbb"), /subtitle over 26 characters/);
  assert.equal((() => { const n = naming.name("Bb", "maj7#11"); return n.main + n.sup; })(),
    "Bbmaj7#11");
  assert.throws(() => naming.name("Bbbbbbbbbbbb", "maj7#11"), /chord name over 16 characters/);
});

test("an unknown quality suffix is a programming error, not a result", () => {
  assert.throws(() => naming.name("C", "sus2"), /unknown quality suffix/);
  assert.throws(() => naming.subtitle("C", "m13"), /unknown quality suffix/);
});

/* ===================== section 10: parent inference ====================== */

test("the three built-ins infer the section 10 parents", () => {
  const expected = {hijaz: "Phrygian dominant", pygmy: "Aeolian", amara: "Aeolian"};
  for (const deck of golden.decks) {
    const index = naming.inferParent(deckPitchClasses(deck), tonicOf(deck));
    assert.equal(host(naming.PARENTS)[index].name, expected[deck.id], deck.id);
    assert.equal(naming.parentDistance(deckPitchClasses(deck), tonicOf(deck), index), 0,
      `${deck.id}: the inferred parent contains every pan pitch class`);
  }
});

test("Amara's Aeolian/Dorian tie at distance 0 is won on list order", () => {
  const deck = golden.decks.find((d) => d.id === "amara");
  const pcs = deckPitchClasses(deck);
  const names = host(naming.PARENTS).map((p) => p.name);
  const aeolian = names.indexOf("Aeolian");
  const dorian = names.indexOf("Dorian");
  assert.equal(naming.parentDistance(pcs, tonicOf(deck), aeolian), 0);
  assert.equal(naming.parentDistance(pcs, tonicOf(deck), dorian), 0,
    "the tie is real: Dorian also contains every Amara pitch class");
  assert.equal(naming.inferParent(pcs, tonicOf(deck)), aeolian);
});

test("Hijaz's and Pygmy's parents are unique, not ties", () => {
  for (const id of ["hijaz", "pygmy"]) {
    const deck = golden.decks.find((d) => d.id === id);
    const pcs = deckPitchClasses(deck);
    const zeros = host(naming.PARENTS)
      .map((p, i) => naming.parentDistance(pcs, tonicOf(deck), i))
      .filter((d) => d === 0);
    assert.equal(zeros.length, 1, `${id}: exactly one parent at distance 0`);
  }
});

test("distance counts PAN pitch classes outside the parent, not the reverse", () => {
  // A three-pitch-class pan sits inside many 7-note parents at distance 0; a
  // rule that counted missing PARENT notes would score it 4 everywhere.
  const {pcs, tonic} = seedPitchClasses(
    seeds.find((row) => row.name === "three pitch classes"));
  const distances = host(naming.PARENTS)
    .map((p, i) => naming.parentDistance(pcs, tonic, i));
  assert.ok(distances.some((d) => d === 0),
    "a subset pan must sit at distance 0 in at least one parent");
  assert.ok(Math.max.apply(null, distances) <= 3,
    "distance is bounded by the pan's pitch-class count");
});

/* ========================= section 10: degrees =========================== */

test("every built-in degree label is reproduced, modulo the frozen exceptions", () => {
  let reproduced = 0;
  const exceptionsSeen = [];
  for (const deck of golden.decks) {
    const pcs = deckPitchClasses(deck);
    const tonic = tonicOf(deck);
    const produced = host(naming.degrees(pcs, tonic, naming.inferParent(pcs, tonic)));
    for (const key of Object.keys(deck.degrees)) {
      const expected = deck.degrees[key];
      const exception = DEGREE_EXCEPTIONS.find(
        (x) => x.deck === deck.id && x.pc === key);
      assert.ok(produced[key] !== undefined,
        `${deck.id}: no degree produced for pitch class ${key}`);
      if (exception) {
        assert.equal(exception.label, expected, `${deck.id}: stale exception label`);
        assert.notEqual(produced[key], expected,
          `${deck.id}: pitch class ${key} is a recorded exception but the ` +
          "engine now derives it - remove it from DEGREE_EXCEPTIONS");
        exceptionsSeen.push(deck.id + " " + key);
      } else {
        assert.equal(produced[key], expected, `${deck.id}: pitch class ${key}`);
        reproduced += 1;
      }
    }
  }
  assert.equal(exceptionsSeen.length, DEGREE_EXCEPTIONS.length);
  // CLAUDE.md "Design system": 5 + 7 + 5 labels, less Amara's three exceptions.
  assert.equal(reproduced, 14);
});

test("D8: numerals are minor-relative only when the pan has a minor third", () => {
  const byDeck = {};
  for (const deck of golden.decks) {
    const pcs = deckPitchClasses(deck);
    byDeck[deck.id] = host(naming.degrees(pcs, tonicOf(deck),
      naming.inferParent(pcs, tonicOf(deck))));
  }
  // Hijaz has a major third over C# (F = E#), so flats: D is bII, B is bvii.
  assert.equal(byDeck.hijaz["2"], "bII");
  assert.equal(byDeck.hijaz["11"], "bvii");
  // Pygmy has Ab over F, so minor-relative: Ab is III and Eb is VII, no flats.
  assert.equal(byDeck.pygmy["8"], "III");
  assert.equal(byDeck.pygmy["3"], "VII");
});

test("D10: case comes from stacked thirds over the parent", () => {
  const deck = golden.decks.find((d) => d.id === "hijaz");
  const pcs = deckPitchClasses(deck);
  const produced = host(naming.degrees(pcs, tonicOf(deck),
    naming.inferParent(pcs, tonicOf(deck))));
  // Over Phrygian dominant on C#: F# stacks a minor third (A) -> lowercase;
  // G# stacks a minor third (B) and a diminished fifth (D) -> `v°`.
  assert.equal(produced["6"], "iv");
  assert.equal(produced["8"], "v°");
  assert.equal(produced["1"], "I");
});

test("the parent override moves case, and the numeral only with the degree index", () => {
  const names = host(naming.PARENTS).map((p) => p.name);
  const flipped = [];
  for (const row of seeds) {
    const {pcs, tonic} = seedPitchClasses(row);
    const inferredIndex = naming.inferParent(pcs, tonic);
    const inferred = host(naming.degrees(pcs, tonic, inferredIndex));
    for (let i = 0; i < names.length; i += 1) {
      const other = host(naming.degrees(pcs, tonic, i));
      for (const key of Object.keys(inferred)) {
        if (other[key] !== inferred[key]) {
          if (degreeIndexIn(names[i], tonic, Number(key)) ===
              degreeIndexIn(names[inferredIndex], tonic, Number(key)) &&
              degreeIndexIn(names[i], tonic, Number(key)) >= 0) {
            // Same parent-degree index under both parents: the numeral is
            // fixed by that index, so only the case may move.
            assert.equal(other[key].toUpperCase().replace("°", ""),
              inferred[key].toUpperCase().replace("°", ""),
              `${row.name}: same degree index, so only the case may change`);
          }
          flipped.push(row.name + " " + names[i] + " " + key);
        }
      }
    }
  }
  assert.ok(flipped.length > 0,
    "some parent override must change a label's case on some seed");
  // D Amara's own tie is the worked example: Dorian raises G from iv to IV.
  const amara = golden.decks.find((d) => d.id === "amara");
  const amaraPcs = deckPitchClasses(amara);
  assert.equal(host(naming.degrees(amaraPcs, tonicOf(amara),
    names.indexOf("Dorian")))["7"], "IV");
  assert.equal(host(naming.degrees(amaraPcs, tonicOf(amara),
    names.indexOf("Aeolian")))["7"], "iv");
});

test("a parent is inferred for every ok seed and every pan pc gets a label", () => {
  assert.ok(seeds.length >= 11, "the fixture must carry the ok seeds");
  for (const row of seeds) {
    const {pcs, tonic} = seedPitchClasses(row);
    const index = naming.inferParent(pcs, tonic);
    assert.ok(index >= 0 && index <= 10, `${row.name}: parent index in range`);
    const produced = host(naming.degrees(pcs, tonic, index));
    const unique = Array.from(new Set(pcs)).sort((a, b) => a - b);
    assert.deepStrictEqual(Object.keys(produced).map(Number).sort((a, b) => a - b),
      unique, `${row.name}: one label per pan pitch class`);
    for (const key of Object.keys(produced)) {
      assert.match(produced[key], /^[b#]?(I{1,3}|IV|VI{0,2}|i{1,3}|iv|vi{0,2})°?$/,
        `${row.name}: ${produced[key]} is not a degree label`);
    }
  }
});

test("symmetric seeds name deterministically", () => {
  for (const name of ["octatonic diminished", "augmented hexatonic"]) {
    const row = seeds.find((r) => r.name === name);
    const {pcs, tonic} = seedPitchClasses(row);
    const first = host(naming.degrees(pcs, tonic, naming.inferParent(pcs, tonic)));
    const second = host(naming.degrees(pcs.slice().reverse(), tonic,
      naming.inferParent(pcs.slice().reverse(), tonic)));
    assert.deepStrictEqual(second, first, `${name}: naming must not depend on order`);
    assert.equal(first[String(tonic)][0] === "b" || first[String(tonic)][0] === "#",
      false, `${name}: the tonic is degree I`);
  }
});

test("NO_THIRDS makes every numeral uppercase and drops D10", () => {
  const row = seeds.find((r) => r.name === "three pitch classes");
  const {pcs, tonic} = seedPitchClasses(row);
  const index = naming.inferParent(pcs, tonic);
  const produced = host(naming.degrees(pcs, tonic, index, {noThirds: true}));
  for (const key of Object.keys(produced)) {
    assert.equal(produced[key], produced[key].toUpperCase(), key);
    assert.ok(produced[key].indexOf("°") < 0, `${key}: no D10 suffix under NO_THIRDS`);
  }
  // Two-sided: the flag must actually change something on a pan that has thirds.
  const amara = golden.decks.find((d) => d.id === "amara");
  const amaraPcs = deckPitchClasses(amara);
  const amaraTonic = tonicOf(amara);
  const parent = naming.inferParent(amaraPcs, amaraTonic);
  assert.notDeepStrictEqual(
    host(naming.degrees(amaraPcs, amaraTonic, parent, {noThirds: true})),
    host(naming.degrees(amaraPcs, amaraTonic, parent)));
});

/* ---- D8 as amended (coordination row 28): an IN-PARENT pitch class is
 * numbered by its PARENT-DEGREE INDEX, with the accidental read against the
 * D8 reference scale degree of that same index. A pitch class OUTSIDE the
 * parent keeps the section 10 bN/#N mechanism. The two readings disagree
 * wherever the parent's own degree sits a semitone off the reference degree
 * of the same index AND the reference scale has a degree the other side of
 * it - i.e. the chromatic degrees of Phrygian, Locrian, Lydian and friends.
 */

test("D8 in-parent: a chromatic parent degree is numbered by its degree index", () => {
  // F Phrygian, ding F: F Gb Ab Bb C Db Eb. Gb is parent degree 2, so bII -
  // the reference-scale reading called it #I (one semitone above I).
  const phrygian = [5, 6, 8, 10, 0, 1, 3];
  const produced = host(naming.degrees(phrygian, 5,
    naming.inferParent(phrygian, 5)));
  assert.equal(host(naming.PARENTS)[naming.inferParent(phrygian, 5)].name,
    "Phrygian");
  assert.equal(produced["6"], "bII");

  // C Locrian: Db is degree 2 (bII) and Gb is degree 5 (bV). The
  // reference-scale reading called Gb #IV. The CASE is untouched by this rule
  // and stays D10's: over Locrian, Gb stacks Bb and Db - a major third and a
  // perfect fifth - so the label is uppercase with no degree sign.
  const locrian = [0, 1, 3, 5, 6, 8, 10];
  const loc = host(naming.degrees(locrian, 0, naming.inferParent(locrian, 0)));
  assert.equal(host(naming.PARENTS)[naming.inferParent(locrian, 0)].name,
    "Locrian");
  assert.equal(loc["1"], "bII");
  assert.equal(loc["6"], "bV");

  // C Lydian: F# is degree 4, so #IV - the reference-scale reading, with no
  // minor third on the pan, flattened it to bV.
  const lydian = [0, 2, 4, 6, 7, 9, 11];
  const lyd = host(naming.degrees(lydian, 0, naming.inferParent(lydian, 0)));
  assert.equal(host(naming.PARENTS)[naming.inferParent(lydian, 0)].name, "Lydian");
  assert.equal(lyd["6"], "#iv°");
});

test("the parent override can change a numeral when the degree index moves", () => {
  // C Lydian's F# is degree 4 under Lydian (#iv°). Override to Ionian and F#
  // falls OUTSIDE the parent, so section 10's bN/#N mechanism names it from
  // the reference scale instead: between IV and V, major-relative, so bv°.
  const lydian = [0, 2, 4, 6, 7, 9, 11];
  const names = host(naming.PARENTS).map((p) => p.name);
  assert.equal(host(naming.degrees(lydian, 0, names.indexOf("Lydian")))["6"],
    "#iv°");
  assert.equal(host(naming.degrees(lydian, 0, names.indexOf("Ionian")))["6"],
    "bv°");
});

test("outside the parent, a natural fifth on the pan suppresses the degree sign", () => {
  // The recorded caseFromPan reading, pinned. C Ionian plus Gb: Gb is outside
  // Ionian, and over the pan it has a minor third (A), a diminished fifth (C)
  // and NO perfect fifth (Db is absent), so it takes the sign.
  const names = host(naming.PARENTS).map((p) => p.name);
  const withoutFifth = [0, 2, 4, 5, 6, 7, 9, 11];
  assert.equal(
    host(naming.degrees(withoutFifth, 0, names.indexOf("Ionian")))["6"],
    "bv°");
  // Add Db, a perfect fifth above Gb, and the sign is suppressed.
  const withFifth = withoutFifth.concat([1]);
  assert.equal(
    host(naming.degrees(withFifth, 0, names.indexOf("Ionian")))["6"], "bv");
});

test("the built-in non-root degrees the deck data does not carry are pinned", () => {
  // Coordination row 30: neither label appears in CLAUDE.md's per-deck degree
  // map, so pin what the engine derives for them.
  const hijaz = golden.decks.find((d) => d.id === "hijaz");
  const hijazPcs = deckPitchClasses(hijaz);
  const hijazTonic = tonicOf(hijaz);
  // Hijaz F (spelled E#, the major third of C#) is parent degree 3 over
  // Phrygian dominant, stacking a minor third and a diminished fifth.
  assert.equal(host(naming.degrees(hijazPcs, hijazTonic,
    naming.inferParent(hijazPcs, hijazTonic)))["5"], "iii°");

  const amara = golden.decks.find((d) => d.id === "amara");
  const amaraPcs = deckPitchClasses(amara);
  const amaraTonic = tonicOf(amara);
  // Amara E is parent degree 2 over Aeolian: minor third (G), diminished
  // fifth (Bb is absent from the pan but present in the parent).
  assert.equal(host(naming.degrees(amaraPcs, amaraTonic,
    naming.inferParent(amaraPcs, amaraTonic)))["4"], "ii°");
});

/* ================== section 8: the symmetric root tie-break =============== */

test("symmetricRoot prefers the tonic, else the lowest scale degree", () => {
  assert.equal(naming.symmetricRoot([3, 0, 6, 9], 0), 0);
  assert.equal(naming.symmetricRoot([3, 6, 9], 0), 3);
  assert.equal(naming.symmetricRoot([8, 4, 0], 4), 4);
  // With an explicit degree order the lowest DEGREE wins, not the lowest pc.
  assert.equal(naming.symmetricRoot([1, 10], 5, [5, 7, 8, 10, 0, 1, 3]), 10);
  assert.throws(() => naming.symmetricRoot([], 0), /at least one candidate/);
});
