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
  // Section 2, ALTERNATE SENTENCES: a second table, keyed by code AND by the
  // name of the condition that selects the sentence. It adds sentences, never
  // codes - the enum above stays closed - so it folds into the same entry.
  for (const line of SPEC.slice(start, end).split("\n")) {
    const m = line.match(/^\| `([A-Z_]+)` \| `(\w+)`[^|]*\| `(.+)` \|$/);
    if (!m) continue;
    assert.ok(table[m[1]], "an alternate sentence for a code not in the enum");
    table[m[1]].alternates = table[m[1]].alternates || {};
    table[m[1]].alternates[m[2]] = m[3];
  }
  return table;
}

// An alternate sentence, selected by the condition named in the spec table.
function alternate(code, name, subs) {
  return substitute(specReasons()[code].alternates[name], subs);
}

test("REASONS is the ENGINE-SPEC section 2 table, verbatim", () => {
  const spec = specReasons();
  assert.deepEqual(Object.keys(spec).sort(),
    ["BAD_NOTE", "NEEDS_NEWER_APP", "NOTE_OUT_OF_ORDER", "NOTE_OUT_OF_RANGE",
     "NOTE_REPEATED", "NO_DING", "NO_FIFTH", "NO_THIRDS", "TOO_MANY_RIM"],
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

test("an explicit octave that breaks the ascending order is NOTE_OUT_OF_ORDER", () => {
  // Section 3, DECIDED(swarm-2026-09-08): the ding counts as the element
  // before the first top note.
  for (const s of ["(D3) A2 C4 E4", "(F3) F3 C4 E4", "(D3) A3 C4 B3 E4",
                   "(D3) A3 C4 | E3 C3"]) {
    const r = core.parseSeed(s);
    assert.equal(r.ok, false, `${s} should be rejected`);
    assert.equal(r.code, "NOTE_OUT_OF_ORDER", s);
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

  // Section 2, DECIDED(swarm-2026-09-10): BAD_NOTE means the text is not a
  // note. A note that DOES lex and is refused for where it landed does not
  // claim otherwise.
  for (const s of ["(C9) D9 E9 A9", "(D3) A3 C4 C4 E4", "(D3) A2 C4 E4",
                   "(D) A B C D E F G | C D2"]) {
    const r = core.parseSeed(s);
    assert.equal(r.ok, false, `${s} should be rejected`);
    assert.notEqual(r.code, "BAD_NOTE", `${s} lexes as notes: ${r.reason}`);
    assert.ok(!r.reason.includes("is not a note"),
      `"${r.reason}" still calls a real note not a note`);
  }
});

/* ------- section 2: a note that lexes is refused for WHERE it landed ------ */

// Section 2, DECIDED(swarm-2026-09-10): <A> is the offending note as the parser
// PLACED it, <B> the element before it, carrying `the ding ` when it is the
// ding and ` (inferred from <token>)` when the user typed no octave for it.
function substitute(reason, subs) {
  for (const [key, value] of Object.entries(subs)) reason = reason.split(key).join(value);
  return reason;
}

function positional(code, subs) {
  return substitute(specReasons()[code].reason, subs);
}

test("a bottom note below the octave inferred for the note before it says so", () => {
  // The owner's phone report: `D2` is a real note, and the message used to
  // claim it was not one. What is wrong is its POSITION, under a `C` the
  // parser placed at C3, and the sentence has to name that C3.
  const r = core.parseSeed("(D) A B C D E F G | C D2");
  assert.equal(r.ok, false, "the seed is still rejected");
  assert.equal(r.code, "NOTE_OUT_OF_ORDER");
  assert.equal(r.reason, positional("NOTE_OUT_OF_ORDER",
    { "<A>": "D2", "<B>": "C3 (inferred from C)" }));
  // Writing the octave the user meant is what fixes it, so that seed parses.
  assert.equal(core.parseSeed("(D) A B C D E F G | C2 D2").ok, true);
  assert.equal(core.parseSeed("(D) A B C D E F G | C D3").ok, true);
});

test("NOTE_OUT_OF_ORDER names the ding as the ding, and an explicit note plainly", () => {
  const ding = core.parseSeed("(D3) A2 C4 E4");
  assert.equal(ding.code, "NOTE_OUT_OF_ORDER");
  assert.equal(ding.reason, alternate("NOTE_OUT_OF_ORDER", "ding",
    { "<A>": "A2", "<B>": "D3" }));

  const typed = core.parseSeed("(D3) A3 C5 B3 E4");
  assert.equal(typed.code, "NOTE_OUT_OF_ORDER");
  assert.equal(typed.reason, positional("NOTE_OUT_OF_ORDER",
    { "<A>": "B3", "<B>": "C5" }),
    "an octave the user typed is not reported as inferred");
});

test("NOTE_OUT_OF_RANGE names the note as the parser placed it", () => {
  const explicit = core.parseSeed("(C9) D9 E9 A9");
  assert.equal(explicit.ok, false);
  assert.equal(explicit.code, "NOTE_OUT_OF_RANGE");
  assert.equal(explicit.reason, positional("NOTE_OUT_OF_RANGE", { "<A>": "A9" }));

  // Section 3: the ding is range-checked too.
  assert.equal(core.parseSeed("(B#9) C9 G9").code, "NOTE_OUT_OF_RANGE");
});

test("NOTE_REPEATED names the note that is already on that shell", () => {
  const r = core.parseSeed("(D3) A3 C4 C4 E4");
  assert.equal(r.ok, false);
  assert.equal(r.code, "NOTE_REPEATED");
  assert.equal(r.reason, positional("NOTE_REPEATED",
    { "<A>": "C4", "<B>": "C4" }));
  assert.equal(core.parseSeed("(D3) A3 C4 | C3 C3").code, "NOTE_REPEATED",
    "the bottom shell reads the same way");

  // Section 3: only an immediate repeat is a repeat. Anything else is simply
  // not ascending, and an enharmonic respelling is a different name.
  assert.equal(core.parseSeed("(D3) A3 C4 E4 C4").code, "NOTE_OUT_OF_ORDER");
  assert.equal(core.parseSeed("(D3) A3 C4 B#3 E4").code, "NOTE_OUT_OF_ORDER");
  // The ding is on no shell, so a top note repeating it is an ordering fault.
  assert.equal(core.parseSeed("(F3) F3 C4 E4").code, "NOTE_OUT_OF_ORDER");

  // Section 3: the same note on the OTHER shell is a different field, so it
  // stays accepted - the diagnostic must not have widened what is rejected.
  assert.equal(core.parseSeed("(D3) A3 C4 D4 E4 | C4 D5").ok, true);
});

test("NOTE_REPEATED names both positions, inference and all", () => {
  // Nit 2 of the w37 review: the placed octave is the half the user cannot
  // see, and a repeat is the one message where NEITHER position may be
  // guessed at - the user typed `C` and `C4`, and no literal `C4` twice.
  const inferred = core.parseSeed("(D3) A3 C C4 E4");
  assert.equal(inferred.ok, false, "the seed is still rejected");
  assert.equal(inferred.code, "NOTE_REPEATED");
  assert.equal(inferred.reason, positional("NOTE_REPEATED",
    { "<A>": "C4", "<B>": "C4 (inferred from C)" }));
  assert.match(inferred.reason, /\(inferred from C\)/,
    "the bare C the parser placed at C4 has to be named as such");

  const flat = core.parseSeed("(Eb4) Ab5 Bb Bb5");
  assert.equal(flat.code, "NOTE_REPEATED");
  assert.equal(flat.reason, positional("NOTE_REPEATED",
    { "<A>": "Bb5", "<B>": "Bb5 (inferred from Bb)" }));

  // Both typed: nothing is annotated, because nothing was inferred.
  assert.equal(core.parseSeed("(D3) A3 C4 C4 E4").reason,
    positional("NOTE_REPEATED", { "<A>": "C4", "<B>": "C4" }));
});

test("a top note that does not clear the ding is told the ding is the floor", () => {
  // Nit 3 of the w37 review. The code is right - the ding is on no shell, so
  // this is an ordering fault, not a repeat - but "F3 is not above the ding
  // F3" is the riddle, and "or the note before it a lower one" tells the user
  // to redefine their instrument. One sentence covers at-the-ding and
  // below-the-ding, and neither offers to move the ding.
  const same = core.parseSeed("(F3) F3 C4");
  assert.equal(same.ok, false, "the seed is still rejected");
  assert.equal(same.code, "NOTE_OUT_OF_ORDER");
  assert.equal(same.reason, alternate("NOTE_OUT_OF_ORDER", "ding",
    { "<A>": "F3", "<B>": "F3" }));
  assert.ok(!same.reason.includes("is not above"),
    "a note equal to the ding must not be told it is 'not above' itself");
  assert.ok(!same.reason.includes("a lower one"),
    "the ding is the instrument; the message must not offer to lower it");

  const below = core.parseSeed("(F3) E3 C4");
  assert.equal(below.code, "NOTE_OUT_OF_ORDER");
  assert.equal(below.reason, alternate("NOTE_OUT_OF_ORDER", "ding",
    { "<A>": "E3", "<B>": "F3" }));
  assert.ok(!below.reason.includes("a lower one"));

  // The ding's own octave can itself be inferred, and that annotation - the
  // whole point of the w37 lane - must survive into this sentence.
  const inferredDing = core.parseSeed("(D) D3 A3");
  assert.equal(inferredDing.code, "NOTE_OUT_OF_ORDER");
  assert.equal(inferredDing.reason, alternate("NOTE_OUT_OF_ORDER", "ding",
    { "<A>": "D3", "<B>": "D3 (inferred from D)" }));

  // A note that clears the ding is still accepted: the boundary has not moved.
  assert.equal(core.parseSeed("(F3) G3 C4").ok, true);
});

test("the ding is resolved before any other token, so its range comes first", () => {
  // Section 3 precedence. The ding is lexed and range-checked at the top of
  // parseSeed, BEFORE the bar check, the separator checks and the lex loop,
  // so an off-keyboard ding beats an unlexable token later in the string.
  for (const s of ["(B9) Zz3", "(B9) A3 |", "(B9) / A3"]) {
    assert.equal(core.parseSeed(s).code, "NOTE_OUT_OF_RANGE", s);
  }
  // Past the ding, every remaining token lexes before any note is PLACED, so
  // a string carrying both an unlexable token and a misplaced one is BAD_NOTE
  // whichever order the two appear in.
  for (const s of ["(D3) A3 Zz3 B9", "(D3) A3 B9 Zz3"]) {
    assert.equal(core.parseSeed(s).code, "BAD_NOTE", s);
  }
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

/* --------- section 3: the inner-shell separator (the D13 amendment) ------- */

test("a lone / splits the top run into rim notes and inner notes", () => {
  // Section 3: notes before the separator are rim, notes after it are inner.
  const f = parsed("(F3) G3 Ab3 C4 Eb4 / F4 G4").fields;
  assert.deepEqual(zoneCounts(f), { ding: 1, rim: 4, inner: 2, bottom: 0 });
  for (const id of ["1", "2", "3", "4"]) assert.equal(f[id][3], "rim", `field ${id}`);
  for (const id of ["5", "6"]) assert.equal(f[id][3], "inner", `field ${id}`);
  // Section 4 is unchanged: ids stay one ascending sequence, rim then inner.
  assert.deepEqual(Object.keys(f).sort(), ["0", "1", "2", "3", "4", "5", "6"]);
  assert.equal(f["6"][5], "6", "an inner field is still labelled by its id");
  // The separator is not a note: the notes and octaves are what they would be
  // without it.
  const flat = parsed("(F3) G3 Ab3 C4 Eb4 F4 G4").fields;
  for (const id of Object.keys(flat)) {
    assert.deepEqual(host(f[id]).slice(0, 3), host(flat[id]).slice(0, 3), `field ${id}`);
  }
});

test("the separator is optional and its absence keeps the positional rule", () => {
  // Section 3: a seed with no separator zones exactly as it did before the
  // amendment - the first up to 11 top notes are rim, the rest inner.
  assert.deepEqual(zoneCounts(parsed("(F3) G3 Ab3 C4 Eb4 F4 G4").fields),
    { ding: 1, rim: 6, inner: 0, bottom: 0 });
  assert.deepEqual(zoneCounts(parsed(
    "(C3) D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4").fields),
    { ding: 1, rim: 11, inner: 2, bottom: 0 });
  // And every fixture row that records zones is still met - see the
  // "zone counts match every fixture row" test, which no separator changed.
});

test("the separator and the trailing-slash ding never collide", () => {
  // The ding slash is ATTACHED to a note; the separator stands alone, as `|`
  // does. That single rule settles every mixed spelling.
  assert.deepEqual(host(parsed("F3/ G3 Ab3 C4")),
    host(parsed("(F3) G3 Ab3 C4")), "a trailing-slash ding is still a ding");
  const both = parsed("F3/ G3 Ab3 C4 / Eb4 F4");
  assert.deepEqual(zoneCounts(both.fields), { ding: 1, rim: 3, inner: 2, bottom: 0 },
    "a trailing-slash ding and a separator coexist in one string");
  assert.deepEqual(host(both), host(parsed("(F3) G3 Ab3 C4 / Eb4 F4")));

  // An unattached slash inside a token is neither, so the token does not lex.
  for (const s of ["(F3) G3/Ab3 C4", "(F3) G3 Ab3/C4 Eb4"]) {
    const r = core.parseSeed(s);
    assert.equal(r.ok, false, s);
    assert.equal(r.code, "BAD_NOTE", s);
  }
  // A slash attached to a LATER note is a second ding token, so the ding count
  // rule fires first, exactly as it always did.
  assert.equal(core.parseSeed("(F3) G3 Ab3/ C4").code, "NO_DING");
  // With no parenthesised or trailing-slash ding at all there is no ding.
  for (const s of ["F3/A3", "F3//A3", "/ (F3) G3 Ab3 C4"]) {
    assert.equal(core.parseSeed(s).code, "NO_DING", s);
  }
});

test("a misplaced or repeated separator is BAD_NOTE naming the slash", () => {
  // Section 2's enum is closed, so a malformed separator is BAD_NOTE. It needs
  // notes on both sides, may appear at most once, and only in the top run.
  for (const s of ["(F3) / G3 Ab3 C4",          // nothing before it
                   "(F3) G3 Ab3 C4 /",          // nothing after it
                   "(F3) G3 / Ab3 / C4",        // twice
                   "(F3) G3 / / Ab3 C4",        // twice, adjacent
                   "(F3) G3 Ab3 C4 | Db3 / Eb3" // after the bar
                  ]) {
    const r = core.parseSeed(s);
    assert.equal(r.ok, false, `${s} should be rejected`);
    assert.equal(r.code, "BAD_NOTE", s);
    assert.equal(r.reason, core.REASONS.BAD_NOTE.reason.replace("<X>", "/"), s);
  }
});

test("an explicit split is capped per ring, not only in total", () => {
  // Section 4: at most 11 rim and at most 2 inner, however the split is written.
  for (const s of ["(C3) D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 / B4", // 12 rim
                   "(C3) D3 E3 F3 G3 / A3 B3 C4"                    // 3 inner
                  ]) {
    const r = core.parseSeed(s);
    assert.equal(r.ok, false, `${s} should be rejected`);
    assert.equal(r.code, "TOO_MANY_RIM", s);
    assert.equal(r.reason, core.REASONS.TOO_MANY_RIM.reason, s);
  }
  assert.deepEqual(zoneCounts(parsed(
    "(C3) D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 / A4 B4").fields),
    { ding: 1, rim: 11, inner: 2, bottom: 0 }, "11 rim + 2 inner is accepted");
});

test("formatSeed prints the separator, and drops it when it says nothing", () => {
  // Section 12: the canonical string carries the separator whenever the split
  // is not the one the positional rule would produce, and omits it when it is -
  // so no seed that parsed before the amendment moves its canonical string.
  const withMark = "(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 / F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5";
  assert.equal(core.formatSeed(parsed(withMark)), withMark);
  assert.equal(core.formatSeed(parsed("F3/ G3 Ab3 C4 / Eb4 F4")),
    "(F3) G3 Ab3 C4 / Eb4 F4");
  // A split at the positional boundary is redundant and is not printed.
  assert.equal(core.formatSeed(parsed(
    "(C3) D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 / A4 B4")),
    "(C3) D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4");
  // Round trip, both directions, for every seed that carries a separator.
  for (const s of [withMark, "(F3) G3 Ab3 C4 Eb4 / F4 G4", "F3/ G3 Ab3 C4 / Eb4 F4"]) {
    const value = parsed(s);
    const printed = core.formatSeed(value);
    assert.deepEqual(host(parsed(printed)), host(value), `${s}: round trip`);
    assert.equal(core.formatSeed(parsed(printed)), printed, `${s}: idempotent`);
  }
});

test("no seed that parsed before the separator existed prints one", () => {
  // The deck id is a pure function of formatSeed (section 12), so this is the
  // id-stability proof: every pre-amendment corpus string still prints the
  // string it always printed, therefore hashes to the id it always had.
  for (const deck of golden.decks) {
    assert.equal(core.formatSeed(parsed(deck.maker_string)).includes("/"), false,
      `${deck.id}: the built-in maker string still prints without a separator`);
    assert.equal(core.formatSeed(parsed(deck.maker_string)), deck.maker_string);
  }
  for (const entry of synthetic.filter(e => e.expect.ok)) {
    assert.equal(core.formatSeed(parsed(entry.string)).includes("/"), false,
      `${entry.name}: no separator appears in a corpus string that never had one`);
  }
});

test("the separator changes the deck id, because the deck is different", () => {
  // Section 12 / D14: the id hashes formatSeed, which now carries the split.
  const notes = "G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5";
  const flat = parsed(`(F3) ${notes}`);
  const split = parsed(`(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 / F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5`);
  assert.deepEqual(zoneCounts(flat.fields), { ding: 1, rim: 11, inner: 0, bottom: 6 });
  assert.deepEqual(zoneCounts(split.fields), { ding: 1, rim: 9, inner: 2, bottom: 6 });
  assert.notEqual(core.deckId(split.fields), core.deckId(flat.fields),
    "two different pans are two different decks");
  assert.match(core.deckId(split.fields), /^custom:[0-9a-f]{8}$/);
  // Options still never reach the id.
  assert.equal(core.deckId(parsed(core.formatSeed(split), { mirror: true }).fields),
    core.deckId(split.fields));
});

test("the Pygmy seed with a separator solves to the golden Pygmy angles", () => {
  // The receipt for the amendment: with the inner pair named, the generated
  // layout reproduces the measured F3 Low Pygmy 18 instrument exactly - every
  // one of the 18 non-ding angles, and every zone.
  const layout = loadEngine(["core", "layout"]);
  const pygmy = deckByIdes.pygmy;
  const seed = "(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 / F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5";
  const value = layout.core.parseSeed(seed, { mirror: false });
  assert.equal(value.ok, true, `${seed}: ${value.code}`);
  assert.deepEqual(zoneCounts(value.value.fields),
    { ding: 1, rim: 9, inner: 2, bottom: 6 }, "9 rim, 2 inner, 6 bottom, 1 ding");

  const solved = layout.layout.solve(value.value);
  assert.equal(solved.ok, true, `solve: ${solved.code}`);
  const diffs = [];
  for (const id of Object.keys(pygmy.fields)) {
    const want = pygmy.fields[id];
    const got = solved.value.fields[id];
    assert.equal(got[3], want[3], `field ${id} (${want[0]}${want[1]}): zone`);
    if (got[4] !== want[4]) diffs.push(`${id} ${want[0]}${want[1]}: ${want[4]} -> ${got[4]}`);
  }
  assert.deepEqual(diffs, [], "every angle matches the measured instrument");
  assert.equal(Object.keys(pygmy.fields).length, 18,
    "all 18 fields were compared: 9 rim + 2 inner + 6 bottom + the ding");
});
