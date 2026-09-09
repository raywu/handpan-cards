// P0d - the shared D13 seed parser, HPE.core.
//
// Spec-first per tests/CONTRACT.md rule 1: every assertion below comes from
// docs/ENGINE-SPEC.md sections 1-4, 12, 16 and 17, from the golden fixture, or
// from tests/fixtures/synthetic_scales.json. Nothing is read back out of
// src/engine/core.js to compare against itself - the one exception is the
// REASONS table, which rule 2's carve-out allows because the module carries a
// literal copy of the spec table and the test holds it to the spec.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadEngine } = require("./helpers/engine.js");

const ROOT = path.join(__dirname, "..");
const core = loadEngine(["core"]).core;

const golden = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests", "fixtures", "golden_decks_v1.json"), "utf8"));
const synthetic = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests", "fixtures", "synthetic_scales.json"), "utf8"));
const SPEC = fs.readFileSync(path.join(ROOT, "docs", "ENGINE-SPEC.md"), "utf8");

const deckByIdes = Object.fromEntries(golden.decks.map(d => [d.id, d]));

// The engine runs in its own node:vm realm, so the values it returns are built
// from that realm's Array/Object. deepStrictEqual compares prototypes, so any
// engine value compared against a host-realm literal is normalised through JSON.
function host(value) {
  return JSON.parse(JSON.stringify(value));
}

function parsed(str, options) {
  const r = core.parseSeed(str, options);
  assert.equal(r.ok, true, `expected ${JSON.stringify(str)} to parse, got ` +
    `${r.code}: ${r.reason}`);
  return r.value;
}

function zoneCounts(fields) {
  const counts = { ding: 0, rim: 0, inner: 0, bottom: 0 };
  for (const id of Object.keys(fields)) counts[fields[id][3]] += 1;
  return counts;
}

/* ---------------- section 2: the code enum and its reason strings --------- */

// Parses the section 2 markdown table into {CODE: {kind, reason}}. The table is
// the spec; core.js carries a verbatim copy and this holds it to the source.
function specReasons() {
  const start = SPEC.indexOf("\n## 2. ");
  const end = SPEC.indexOf("\n## 3. ", start);
  assert.ok(start > 0 && end > start, "ENGINE-SPEC has no section 2");
  const table = {};
  for (const line of SPEC.slice(start, end).split("\n")) {
    const m = line.match(/^\| `([A-Z_]+)` \| (\w+) \| `(.+)` \|$/);
    if (m) table[m[1]] = { kind: m[2], reason: m[3] };
  }
  return table;
}

test("REASONS is the ENGINE-SPEC section 2 table, verbatim", () => {
  const spec = specReasons();
  assert.deepEqual(Object.keys(spec).sort(),
    ["BAD_NOTE", "NEEDS_NEWER_APP", "NO_DING", "NO_FIFTH", "NO_THIRDS", "TOO_MANY_RIM"],
    "the spec table no longer holds exactly the section 2 enum");
  assert.deepEqual(host(core.REASONS), spec);
});

/* ---------------- section 3: the three built-in maker strings ------------- */

test("the three built-in maker strings parse to the golden fields", () => {
  // Section 3: name, octave, midi and label are reproduced for all three pans;
  // angle is lane B's output; zone diverges for Pygmy (see the next test).
  for (const deck of golden.decks) {
    const withZone = deck.id !== "pygmy";
    const fields = parsed(deck.maker_string).fields;
    assert.deepEqual(Object.keys(fields).sort(), Object.keys(deck.fields).sort(),
      `${deck.id}: field ids`);
    for (const id of Object.keys(deck.fields)) {
      const want = deck.fields[id];
      const got = fields[id];
      assert.deepEqual(
        [got[0], got[1], got[2], got[5]],
        [want[0], want[1], want[2], want[5]],
        `${deck.id} field ${id}: name/octave/midi/label`);
      assert.equal(got[4], null, `${deck.id} field ${id}: angle is null from parseSeed`);
      if (withZone) assert.equal(got[3], want[3], `${deck.id} field ${id}: zone`);
    }
  }
});

test("the Pygmy maker string yields eleven rim fields from the grammar", () => {
  // Deliberate, DECIDED(swarm-2026-09-08) in section 3: the D13 grammar has no
  // inner-shell marker, so all 11 Pygmy top notes are within the 11-note rim
  // cap and none is inner. The built-in literal ships 9 rim + 2 inner; per D12
  // the built-in geom and zone literals bypass the solver, so the divergence
  // never reaches a rendered card. The grammar's zones govern GENERATED decks.
  const pygmy = deckByIdes.pygmy;
  const fields = parsed(pygmy.maker_string).fields;
  assert.deepEqual(zoneCounts(fields), { ding: 1, rim: 11, inner: 0, bottom: 6 });

  const builtin = zoneCounts(pygmy.fields);
  assert.deepEqual(builtin, { ding: 1, rim: 9, inner: 2, bottom: 6 },
    "the built-in literal is the side that ships 9 rim + 2 inner");
  assert.equal(fields["10"][3], "rim", "the grammar puts F5 on the rim");
  assert.equal(fields["11"][3], "rim", "the grammar puts G5 on the rim");
});

/* ---------------- section 16: the synthetic corpus ------------------------ */

test("every synthetic entry parses or rejects exactly as the fixture expects", () => {
  for (const entry of synthetic) {
    const r = core.parseSeed(entry.string);
    if (entry.expect.ok) {
      assert.equal(r.ok, true,
        `${entry.name}: expected ok, got ${r.code}: ${r.reason}`);
      assert.equal(r.code, undefined, `${entry.name}: an ok result carries no code`);
    } else {
      assert.equal(r.ok, false, `${entry.name}: expected ${entry.expect.code}, got ok`);
      assert.equal(r.code, entry.expect.code, `${entry.name}: code`);
      assert.equal(typeof r.reason, "string", `${entry.name}: reason is a sentence`);
      assert.ok(r.reason.length > 0, `${entry.name}: reason is not empty`);
      assert.equal(r.value, undefined, `${entry.name}: an err result carries no value`);
      assert.equal(r.warnings, undefined, `${entry.name}: an err result carries no warnings`);
    }
  }
});

test("parseSeed itself never emits a warning (section 16)", () => {
  for (const entry of synthetic.filter(e => e.expect.ok)) {
    const r = core.parseSeed(entry.string);
    assert.equal(r.warnings, undefined, `${entry.name}: parseSeed produces no warnings`);
  }
});

test("zone counts match every fixture row that records them", () => {
  const rows = synthetic.filter(e => e.zones);
  assert.ok(rows.length >= 5, "the fixture should record zones on several rows");
  for (const entry of rows) {
    assert.deepEqual(zoneCounts(parsed(entry.string).fields), entry.zones, entry.name);
  }
});

test("parseSeed(formatSeed(v)).value deep-equals v for every ok entry", () => {
  // Section 12 / the plan's P0d exit. formatSeed prints explicit octaves and
  // the strict-ascending rule of section 3 is what makes this hold.
  const ok = synthetic.filter(e => e.expect.ok);
  assert.ok(ok.length >= 10, "the fixture should carry a real corpus of ok seeds");
  for (const entry of ok) {
    const value = parsed(entry.string);
    const printed = core.formatSeed(value);
    assert.equal(typeof printed, "string", `${entry.name}: formatSeed returns a plain string`);
    assert.deepEqual(host(parsed(printed)), host(value), `${entry.name}: round trip`);
    assert.equal(core.formatSeed(parsed(printed)), printed, `${entry.name}: printing is idempotent`);
  }
});

/* ---------------- section 4: ids, labels, zones and caps ------------------ */

test("field ids and labels follow the section 4 scheme", () => {
  const value = parsed("(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 F5 G5 Ab5 C6 | C3 Db3 Eb3 Bb3 Db4 Gb4");
  const f = value.fields;
  assert.equal(f["0"][3], "ding");
  assert.equal(f["0"][5], "Ding");
  for (let i = 1; i <= 13; i += 1) {
    assert.equal(f[String(i)][5], String(i), `top field ${i} is labelled by its id`);
    assert.equal(f[String(i)][3], i <= 11 ? "rim" : "inner", `top field ${i} zone`);
  }
  for (let i = 1; i <= 6; i += 1) {
    assert.equal(f[String(100 + i)][5], `U${i}`, `bottom field ${i} label`);
    assert.equal(f[String(100 + i)][3], "bottom", `bottom field ${i} zone`);
  }
  assert.equal(Object.keys(f).length, 20, "11 rim + 2 inner + 6 bottom + the ding");
});

test("options default to palette 0, no parent, no name, no mirror", () => {
  assert.deepEqual(host(parsed("(D3) A3 C4 D4 E4 F4 G4 A4 C5").options),
    { palette: 0, parent: null, name: "", mirror: false });
  assert.deepEqual(host(
    parsed("(D3) A3 C4 D4 E4 F4 G4 A4 C5",
      { palette: 4, parent: 2, name: "My Pan", mirror: true }).options),
    { palette: 4, parent: 2, name: "My Pan", mirror: true });
});

/* ---------------- section 3: grammar details ------------------------------ */

test("an omitted ding octave is octave 3 and reseeds the inference", () => {
  const amara = deckByIdes.amara;
  const value = parsed("(D) A C D E F G A C");
  assert.deepEqual(host(value.fields["0"]).slice(0, 3), ["D", 3, 50]);
  for (const id of Object.keys(amara.fields)) {
    assert.deepEqual(host(value.fields[id]).slice(0, 3), amara.fields[id].slice(0, 3),
      `field ${id} of the octave-free Amara string`);
  }
});

test("the trailing-slash ding spelling is the parenthesised one", () => {
  assert.deepEqual(host(parsed("D3/ A3 C4 D4 E4 F4 G4 A4 C5")),
    host(parsed("(D3) A3 C4 D4 E4 F4 G4 A4 C5")));
  assert.deepEqual(host(parsed("D/ A C D E F G A C")),
    host(parsed("(D) A C D E F G A C")));
});

test("MIDI is letter-anchored, so Cb4 is 59 and B#3 is 60", () => {
  // Section 3: midi = 12 * (octave + 1) + letter + accidental.
  assert.equal(core.midiFromName("C", "b", 4), 59);
  assert.equal(core.midiFromName("B", "#", 3), 60);
  assert.equal(core.midiFromName("C", "", 4), 60);
  assert.equal(core.midiFromName("A", "", 4), 69);
  assert.equal(core.pitchClass(59), 11);
  assert.equal(core.pitchClass(60), 0);

  const value = parsed("(C3) Cb4 E4 G4");
  assert.deepEqual(host(value.fields["1"]).slice(0, 3), ["Cb", 4, 59],
    "an inferred octave prints the one the formula implies for the typed letter");
});

test("bottom inference restarts nearest the ding, ties going below", () => {
  // Section 3: the first bottom note is the instance of its pitch class
  // NEAREST the ding; a tritone and the ding's own pitch class both tie, and
  // the tie goes below.
  const tail = "(F3) G3 Ab3 C4 | ";
  assert.deepEqual(host(parsed(tail + "F").fields["101"]).slice(0, 3), ["F", 2, 41],
    "same pitch class as the ding resolves below it");
  assert.deepEqual(host(parsed(tail + "B").fields["101"]).slice(0, 3), ["B", 2, 47],
    "a tritone from the ding resolves below it");
  assert.deepEqual(host(parsed(tail + "G").fields["101"]).slice(0, 3), ["G", 3, 55],
    "a whole tone above the ding is nearest above");
  assert.deepEqual(host(parsed(tail + "E").fields["101"]).slice(0, 3), ["E", 3, 52],
    "a semitone below the ding is nearest below");
  const two = parsed(tail + "E G");
  assert.deepEqual(host(two.fields["102"]).slice(0, 3), ["G", 3, 55],
    "each later bottom note is the next instance strictly above the previous");
});

test("an explicit octave that breaks the ascending order is BAD_NOTE", () => {
  // Section 3, DECIDED(swarm-2026-09-08): the ding counts as the element
  // before the first top note.
  for (const s of ["(D3) A2 C4 E4", "(F3) F3 C4 E4", "(D3) A3 C4 B3 E4",
                   "(D3) A3 C4 | E3 C3"]) {
    const r = core.parseSeed(s);
    assert.equal(r.ok, false, `${s} should be rejected`);
    assert.equal(r.code, "BAD_NOTE", s);
  }
});

test("tokenisation is whitespace-splitting only", () => {
  // Section 3 DEFAULT[owner-review]: `( D3 )`, `(D3)A3` and `C5|C3` are each
  // BAD_NOTE, letters are uppercase only, and the octave is a single digit.
  for (const s of ["(D3)A3 C4 E4", "(D3) A3 C4|C3", "(D3) a3 C4 E4",
                   "(D3) A3 C10 E4", "(D3) A3 C#b4 E4", "(D3) A3 https://x C4"]) {
    const r = core.parseSeed(s);
    assert.equal(r.ok, false, `${s} should be rejected`);
    assert.equal(r.code, "BAD_NOTE", s);
  }
  const spaced = core.parseSeed("( D3 ) A3 C4 E4");
  assert.equal(spaced.ok, false, "a spaced-out ding token does not lex");
});

test("a trailing bar with no bottom notes is BAD_NOTE naming the bar", () => {
  const r = core.parseSeed("(D3) A3 C4 D4 E4 F4 G4 A4 C5 |");
  assert.equal(r.ok, false);
  assert.equal(r.code, "BAD_NOTE");
  assert.equal(r.reason, core.REASONS.BAD_NOTE.reason.replace("<X>", "|"));
});

/* ---------------- one direct case per error code -------------------------- */

test("NO_DING covers zero dings, two dings and a misplaced ding", () => {
  for (const s of ["G3 B3 D4 G4", "(D3) (A3) C4 E4", "A3 (D3) C4", "", "   "]) {
    const r = core.parseSeed(s);
    assert.equal(r.ok, false, `${JSON.stringify(s)} should be rejected`);
    assert.equal(r.code, "NO_DING", JSON.stringify(s));
    assert.equal(r.reason, core.REASONS.NO_DING.reason);
  }
  // Ding tokens are counted over the whole string BEFORE any other rule, so a
  // two-ding string with an unlexable token is still NO_DING.
  assert.equal(core.parseSeed("(D3) (A3) H4").code, "NO_DING");
});

test("NO_FIFTH names the ding and the missing fifth", () => {
  const r = core.parseSeed("(C3) D3 E3 F#3 G#3 A#3 C4 D4 E4");
  assert.equal(r.ok, false);
  assert.equal(r.code, "NO_FIFTH");
  assert.equal(r.reason,
    "No perfect fifth above the ding C3. Add a G, or check the ding.");

  // Section 2: the fifth is spelled from the letter four steps above the ding.
  const db = core.parseSeed("(Db3) Eb3 F3 G3 A3 B3 Db4");
  assert.equal(db.code, "NO_FIFTH");
  assert.ok(db.reason.includes("Add a Ab,"), db.reason);
  const b = core.parseSeed("(B3) C#4 D#4 F4 G4 A4 B4");
  assert.equal(b.code, "NO_FIFTH");
  assert.ok(b.reason.includes("Add a F#,"), b.reason);

  // A fifth that exists only on the bottom shell does not satisfy the rule.
  const bottomOnly = core.parseSeed("(C3) D3 E3 F#3 G#3 A#3 | G2");
  assert.equal(bottomOnly.code, "NO_FIFTH");
});

test("TOO_MANY_RIM covers a 14th top note and a 7th bottom note", () => {
  for (const s of ["(C3) D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5",
                   "(D3) A3 C4 D4 E4 F4 G4 A4 C5 | C3 Eb3 E3 F3 G3 Ab3 Bb3"]) {
    const r = core.parseSeed(s);
    assert.equal(r.ok, false, s);
    assert.equal(r.code, "TOO_MANY_RIM", s);
    assert.equal(r.reason, core.REASONS.TOO_MANY_RIM.reason);
  }
  // 13 top notes and 6 bottom notes is the accepted maximum.
  assert.equal(core.parseSeed(
    "(C3) D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 | C2 D2 E2 F2 G2 A2").ok, true);
});

test("BAD_NOTE names the offending token, truncated to 12 characters", () => {
  const r = core.parseSeed("(D3) A3 H4 C4");
  assert.equal(r.ok, false);
  assert.equal(r.code, "BAD_NOTE");
  assert.equal(r.reason, core.REASONS.BAD_NOTE.reason.replace("<X>", "H4"));

  const long = core.parseSeed("(D3) A3 abcdefghijklmnop C4");
  assert.equal(long.code, "BAD_NOTE");
  assert.ok(long.reason.startsWith("abcdefghijkl is not a note"), long.reason);

  // Out of MIDI range, and a duplicate field, are BAD_NOTE too.
  assert.equal(core.parseSeed("(C9) D9 E9 A9").code, "BAD_NOTE");
  assert.equal(core.parseSeed("(D3) A3 C4 C4 E4").code, "BAD_NOTE");
});

test("NEEDS_NEWER_APP is carried but never raised by parseSeed", () => {
  // Section 2: it is a share-layer code, raised only by share.decode.
  assert.equal(typeof core.REASONS.NEEDS_NEWER_APP.reason, "string");
  for (const entry of synthetic) {
    const r = core.parseSeed(entry.string);
    assert.notEqual(r.code, "NEEDS_NEWER_APP", entry.name);
  }
});

/* ---------------- section 12: formatSeed and deckId ----------------------- */

test("formatSeed prints the canonical D13 string with explicit octaves", () => {
  for (const deck of golden.decks) {
    assert.equal(core.formatSeed(parsed(deck.maker_string)), deck.maker_string,
      `${deck.id}: the maker string is already canonical`);
  }
  assert.equal(core.formatSeed(parsed("(D) A C D E F G A C")),
    "(D3) A3 C4 D4 E4 F4 G4 A4 C5");
  assert.equal(core.formatSeed(parsed("D3/ A3 C4 | C3 E3")),
    "(D3) A3 C4 | C3 E3");
});

test("deckId is a custom: prefixed 8-hex hash and is stable", () => {
  const value = parsed(deckByIdes.amara.maker_string);
  const id = core.deckId(value.fields);
  assert.match(id, /^custom:[0-9a-f]{8}$/);
  assert.equal(core.deckId(value.fields), id, "the hash is deterministic");
  // Section 12: the id is a pure function of formatSeed and nothing else.
  assert.equal(core.deckId(parsed("(D) A C D E F G A C").fields), id,
    "an equivalent string with inferred octaves has the same id");
});

test("deckId ignores every option and changes with any field change", () => {
  const seed = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
  const base = core.deckId(parsed(seed).fields);
  const options = [
    { palette: 3 }, { palette: 5 }, { parent: 0 }, { parent: 10 },
    { name: "Totally Different Name" }, { mirror: true },
    { palette: 2, parent: 7, name: "all at once", mirror: true },
  ];
  for (const o of options) {
    assert.equal(core.deckId(parsed(seed, o).fields), base,
      `options ${JSON.stringify(o)} must not move the id`);
  }
  const changed = [
    "(D3) A3 C4 D4 E4 F4 G4 A4 C5 | C3",  // an added bottom field
    "(D3) A3 C4 D4 E4 F4 G4 A4",          // a dropped top field
    "(D3) A3 C4 D4 E4 F4 G4 A4 Db5",      // a changed note
    "(D3) A3 C4 D4 E4 F4 G4 A4 C6",       // a changed octave
    "(D4) A4 C5 D5 E5 F5 G5 A5 C6",       // a changed ding
  ];
  for (const s of changed) {
    assert.notEqual(core.deckId(parsed(s).fields), base, `${s} must move the id`);
  }
});

test("deckId accepts a seed or a bare fields map and never sees the options", () => {
  const value = parsed("(D3) A3 C4 D4 E4 F4 G4 A4 C5", { palette: 5, mirror: true });
  assert.equal(core.deckId(value.fields), core.deckId(value));
  assert.equal(core.formatSeed(value.fields), core.formatSeed(value));
});
