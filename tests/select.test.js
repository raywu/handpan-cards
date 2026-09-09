// Phase 2 - the deck selector, HPE.select.
//
// Spec-first per tests/CONTRACT.md rule 1: every assertion comes from
// docs/ENGINE-SPEC.md sections 1, 5, 8, 9, 10, 11, 12, 13, 16 and 17, from
// tests/fixtures/golden_decks_v1.json, tests/fixtures/synthetic_scales.json or
// tests/fixtures/divergence_v1.json. Nothing is read back out of
// src/engine/select.js to compare against itself.
//
// The divergence fixture (section 8, plan Phase 2 exit) is a COMMITTED table of
// the built-ins' hand-authored cards. Its entries are keyed
// `<main><sup> (<field ids>)` - main+sup plus the voicing, because section 12
// records that `main + sup` alone is not unique on the built-ins (Pygmy `Cm`
// x3). The diff test is two-sided, so the table can only ever shrink.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadEngine } = require("./helpers/engine.js");

const ROOT = path.join(__dirname, "..");
const HPE = loadEngine(["core", "voicing", "layout", "naming", "select"]);
const { core, voicing, layout, naming, select } = HPE;

function fixture(name) {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, "tests", "fixtures", name), "utf8"));
}
const golden = fixture("golden_decks_v1.json");
const synthetic = fixture("synthetic_scales.json");
const divergence = fixture("divergence_v1.json");
const SPEC = fs.readFileSync(path.join(ROOT, "docs", "ENGINE-SPEC.md"), "utf8");

// The engine runs in its own node:vm realm, so every value it returns is
// normalised through JSON before it meets a host-realm literal (queue row 16).
function host(value) {
  return JSON.parse(JSON.stringify(value));
}

function seedOf(str, options) {
  const parsed = core.parseSeed(str, options);
  assert.equal(parsed.ok, true,
    `expected ${JSON.stringify(str)} to parse, got ${parsed.code}`);
  return parsed.value;
}

function built(str, options) {
  const result = select.build(seedOf(str, options));
  assert.equal(result.ok, true,
    `expected build(${JSON.stringify(str)}) to succeed, got ` +
    `${result.code}: ${result.reason}`);
  return host(result.value);
}

function nameOf(chord) {
  return chord.main + chord.sup;
}

// The divergence key: the printed card name plus its voicing.
function keyOf(chord) {
  return `${chord.main}${chord.sup} (${chord.fields.join(",")})`;
}

const BUILTINS = golden.decks.map((deck) => ({
  id: deck.id,
  maker: deck.maker_string,
  fixtureChords: deck.chords,
  name: deck.name
}));

/* ---------------- section 11: the generated deck object ------------------ */

const DECK_KEYS = ["id", "name", "options", "colors", "degrees", "geom",
  "fields", "chords", "warnings"];
const CHORD_KEYS = ["main", "sup", "subtitle", "fields", "roots"];

test("build returns exactly the section 11 deck keys", () => {
  for (const b of BUILTINS) {
    const deck = built(b.maker);
    assert.deepEqual(Object.keys(deck).sort(), [...DECK_KEYS].sort(),
      `${b.id}: deck key set`);
  }
});

test("every chord carries exactly main, sup, subtitle, fields, roots", () => {
  const deck = built("(D3) A3 C4 D4 E4 F4 G4 A4 C5");
  assert.ok(deck.chords.length > 0);
  for (const chord of deck.chords) {
    assert.deepEqual(Object.keys(chord).sort(), [...CHORD_KEYS].sort(),
      `chord ${nameOf(chord)} key set`);
  }
});

test("chord field ids and root ids are NUMBERS, never strings", () => {
  for (const b of BUILTINS) {
    for (const chord of built(b.maker).chords) {
      for (const id of chord.fields) {
        assert.equal(typeof id, "number", `${b.id} ${nameOf(chord)} field id`);
      }
      for (const id of chord.roots) {
        assert.equal(typeof id, "number", `${b.id} ${nameOf(chord)} root id`);
      }
      assert.equal(chord.roots.length, 1);
      assert.ok(chord.fields.includes(chord.roots[0]),
        `${b.id} ${nameOf(chord)}: the root must be in the voicing`);
    }
  }
});

test("the ding's angle is null and every other field carries one", () => {
  for (const b of BUILTINS) {
    const deck = built(b.maker);
    for (const id of Object.keys(deck.fields)) {
      const record = deck.fields[id];
      assert.equal(record.length, 6, `${b.id} field ${id} record length`);
      if (record[3] === "ding") {
        assert.equal(record[4], null, `${b.id}: ding angle`);
      } else {
        assert.equal(typeof record[4], "number", `${b.id} field ${id} angle`);
      }
    }
  }
});

test("geom carries the full solver shape, never a missing key", () => {
  for (const b of BUILTINS) {
    const deck = built(b.maker);
    assert.deepEqual(Object.keys(deck.geom).sort(), host(layout.GEOM_KEYS).sort(),
      `${b.id}: geom key set`);
  }
});

/* ---------------- section 13: palette, mirror, parent, colours ----------- */

// The section 13 palette table, read out of the spec rather than hardcoded.
function specPalettes() {
  const start = SPEC.indexOf("\n## 13. ");
  const end = SPEC.indexOf("\n## 14. ", start);
  assert.ok(start > 0 && end > start, "ENGINE-SPEC has no section 13");
  const rows = [];
  for (const line of SPEC.slice(start, end).split("\n")) {
    const m = line.match(/^\| (\d) \| `(#[0-9A-Fa-f]{6})` \| `(#[0-9A-Fa-f]{6})` \|/);
    if (m) rows[Number(m[1])] = { root: m[2], tone: m[3] };
  }
  assert.equal(rows.length, 6, "section 13 lists six palettes");
  return rows;
}

test("colors come from the section 13 palette with ga = root and gb = tone", () => {
  const palettes = specPalettes();
  for (let index = 0; index < palettes.length; index += 1) {
    const deck = built("(D3) A3 C4 D4 E4 F4 G4 A4 C5", { palette: index });
    assert.equal(deck.colors.root, palettes[index].root, `palette ${index} root`);
    assert.equal(deck.colors.tone, palettes[index].tone, `palette ${index} tone`);
    assert.equal(deck.colors.ga, deck.colors.root, `palette ${index} ga`);
    assert.equal(deck.colors.gb, deck.colors.tone, `palette ${index} gb`);
    assert.deepEqual(Object.keys(deck.colors).sort(), ["ga", "gb", "root", "tone"]);
  }
});

test("options report palette, mirror and the RESOLVED parent index", () => {
  const auto = built("(D3) A3 C4 D4 E4 F4 G4 A4 C5");
  assert.deepEqual(Object.keys(auto.options).sort(), ["mirror", "palette", "parent"]);
  // Section 10: D Amara is declared Aeolian, index 1 of the fixed parent list.
  const aeolian = naming.PARENTS.findIndex((p) => p.name === "Aeolian");
  assert.equal(auto.options.parent, aeolian,
    "a null seed parent is replaced by the inferred index");
  const forced = built("(D3) A3 C4 D4 E4 F4 G4 A4 C5",
    { parent: 2, palette: 4, mirror: true });
  assert.equal(forced.options.parent, 2, "an explicit parent override survives");
  assert.equal(forced.options.palette, 4);
  assert.equal(forced.options.mirror, true);
});

/* ---------------- section 12: deck identity ------------------------------ */

test("id is core.deckId(seed) and is unchanged when every option changes", () => {
  for (const b of BUILTINS) {
    const seed = seedOf(b.maker);
    const expected = core.deckId(seed);
    assert.match(expected, /^custom:[0-9a-f]{8}$/);
    assert.equal(built(b.maker).id, expected, `${b.id}: id`);
    const recoloured = built(b.maker,
      { palette: 5, mirror: true, parent: 6, name: "Something Else" });
    assert.equal(recoloured.id, expected,
      `${b.id}: options are outside the id (section 12)`);
  }
});

/* ---------------- section 13: the auto deck name ------------------------- */

test("the auto name is <DING> <PARENT DISPLAY> <TOP-SHELL COUNT>", () => {
  // Section 13 D5A worked examples: D Amara = D AEOLIAN 9, the 12-note
  // synthetic pan = C IONIAN 12.
  assert.equal(built("(D3) A3 C4 D4 E4 F4 G4 A4 C5").name, "D AEOLIAN 9");
  assert.equal(built("(C3) D3 E3 G3 A3 B3 C4 D4 E4 G4 A4 B4").name, "C IONIAN 12");
  // Hijaz infers Phrygian dominant, which section 16 displays as HIJAZ.
  assert.equal(built("(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4").name, "C# HIJAZ 9");
  // Pygmy's maker string is 11 rim + 6 bottom: N counts the TOP shell only.
  assert.equal(
    built("(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5").name,
    "F AEOLIAN 12");
});

test("the auto name never exceeds the 16-character cap", () => {
  for (const row of synthetic) {
    if (!row.expect.ok) continue;
    const deck = built(row.string);
    assert.ok(deck.name.length <= 16,
      `${row.name}: auto name ${JSON.stringify(deck.name)} over 16 characters`);
  }
});

test("a user-supplied name wins over the auto name", () => {
  const deck = built("(D3) A3 C4 D4 E4 F4 G4 A4 C5", { name: "My Pan" });
  assert.equal(deck.name, "My Pan");
});

/* ---------------- section 10: degrees ------------------------------------ */

test("degrees label every pan pitch class, tonic = the ding", () => {
  for (const b of BUILTINS) {
    const deck = built(b.maker);
    const pcs = new Set();
    for (const id of Object.keys(deck.fields)) {
      pcs.add(String(deck.fields[id][2] % 12));
    }
    assert.deepEqual(Object.keys(deck.degrees).sort(), [...pcs].sort(),
      `${b.id}: degrees cover exactly the pan pitch classes`);
    const dingPc = String(deck.fields["0"][2] % 12);
    assert.match(deck.degrees[dingPc], /^I|^i/,
      `${b.id}: the tonic degree is the ding's`);
  }
});

/* ---------------- section 8: candidates, collapse, cap ------------------- */

const TWELVE = "(C3) D3 E3 G3 A3 B3 C4 D4 E4 G4 A4 B4";

test("the 12-note pan is section 8's worked example: 29 raw candidates", () => {
  const seed = seedOf(TWELVE);
  assert.equal(host(select.candidates(seed.fields)).length, 29);
});

test("the pitch-set collapse takes the 12-note pan from 29 to 27", () => {
  const seed = seedOf(TWELVE);
  const raw = select.candidates(seed.fields);
  const collapsed = host(select.collapse(seed.fields, raw, 0));
  assert.equal(collapsed.length, 27);
  // C6 collapses into Am7 and G6 into Em7 (section 5); no 6-chord survives.
  for (const c of collapsed) {
    assert.notEqual(c.suffix, "6", "no 6-chord candidate survives the collapse");
    assert.notEqual(c.suffix, "m6", "no m6 candidate survives the collapse");
    assert.notEqual(c.suffix, "sus2", "no sus2 candidate survives the collapse");
  }
});

test("the cap bites on the 12-note pan: 27 candidates, 25 cards", () => {
  const deck = built(TWELVE);
  assert.equal(deck.chords.length, 25, "the deck is trimmed to the 25-card cap");
  // Ranking drops the LOWEST-ranked candidates: within the extended tier, the
  // two with the fewest top-shell tones, ties broken by root degree ascending -
  // Amadd9 (degree 5) then Gadd9 (degree 4). Cadd9 (degree 1) survives.
  const names = deck.chords.map(nameOf);
  assert.ok(!names.includes("Amadd9"), "Amadd9 is trimmed by the cap");
  assert.ok(!names.includes("Gadd9"), "Gadd9 is trimmed by the cap");
  assert.ok(names.includes("Cadd9"), "Cadd9 outranks both and survives");
});

test("canonical order: root degree, then tier, then the quality rank", () => {
  // Section 8: roots by scale degree ascending from the tonic; within a root
  // triad, power, sus4, 7th, extended; within a tier by the `rank` field.
  assert.deepEqual(built(TWELVE).chords.map(nameOf), [
    "C", "C5", "Cmaj7", "Cadd9", "C6/9", "Cmaj9",
    "D5", "Dsus4", "D7sus4",
    "Em", "E5", "Esus4", "E7sus4", "Em7",
    "G", "G5", "Gsus4", "G6/9",
    "Am", "A5", "Asus4", "A7sus4", "Am7", "Am9", "Am11"
  ]);
});

test("m6 collapses into m7b5 and the deck keeps the canonical order", () => {
  // Pan {C, Eb, G, A}: Cm6 and Am7b5 are the same pitch set; the m7b5 wins.
  const deck = built("(C3) Eb3 G3 A3 C4 Eb4 G4 A4");
  assert.deepEqual(deck.chords.map(nameOf), ["Cm", "C5", "A°", "Am7b5"]);
  assert.deepEqual(deck.chords.map((c) => c.sup), ["", "", "", "b5"]);
});

test("an extended quality is a candidate only on the TOP shell", () => {
  // The 9th of Cadd9 exists only on the bottom shell, so Cadd9 is not a
  // candidate; G5's fifth may still come from the bottom shell.
  const deck = built("(C3) E3 G3 C4 E4 G4 | D3");
  const names = deck.chords.map(nameOf);
  assert.ok(!names.includes("Cadd9"),
    "an extended tone off the top shell disqualifies the candidate");
  assert.ok(names.includes("G5"),
    "a non-extended tier may use a bottom-shell tone");
  assert.deepEqual(names, ["C", "C5", "G5", "Gsus4"]);
});

test("a pitch class that exists only on the ding is never a root", () => {
  // Section 8: the ding never appears in a voicing, so a ding-only pitch class
  // can be neither a root nor a chord tone.
  const deck = built("(Bb2) F3 G3 C4 D4 F4 G4 C5 D5");
  for (const chord of deck.chords) {
    assert.ok(!/^Bb/.test(chord.main),
      `${nameOf(chord)}: Bb exists only on the ding`);
  }
  for (const chord of deck.chords) {
    assert.ok(!chord.fields.includes(0), "the ding is never voiced");
  }
});

/* ---------------- section 5: legality of every emitted voicing ----------- */

test("every emitted voicing passes HPE.voicing.isLegal", () => {
  for (const row of synthetic) {
    if (!row.expect.ok) continue;
    const seed = seedOf(row.string);
    const result = select.build(seed);
    assert.equal(result.ok, true, `${row.name}: build`);
    for (const chord of result.value.chords) {
      assert.equal(voicing.isLegal(seed.fields, chord.fields), true,
        `${row.name} ${nameOf(chord)}: illegal voicing`);
    }
  }
});

test("no two chords in a deck share an identical fields list", () => {
  for (const row of synthetic) {
    if (!row.expect.ok) continue;
    const deck = built(row.string);
    const seen = new Set();
    for (const chord of deck.chords) {
      const key = chord.fields.join(",");
      assert.ok(!seen.has(key),
        `${row.name}: two chords share the voicing ${key}`);
      seen.add(key);
    }
  }
});

test("no generated deck exceeds the 25-card cap", () => {
  for (const row of synthetic) {
    if (!row.expect.ok) continue;
    const deck = built(row.string);
    assert.ok(deck.chords.length <= 25,
      `${row.name}: ${deck.chords.length} cards`);
  }
});

test("names and subtitles respect the section 9 caps", () => {
  for (const row of synthetic) {
    if (!row.expect.ok) continue;
    for (const chord of built(row.string).chords) {
      assert.ok(nameOf(chord).length <= naming.CAPS.name,
        `${row.name} ${nameOf(chord)}: name over the cap`);
      assert.ok(chord.subtitle.length <= naming.CAPS.subtitle,
        `${row.name} ${JSON.stringify(chord.subtitle)}: subtitle over the cap`);
    }
  }
});

/* ---------------- section 16 / 17: warnings ------------------------------ */

test("a pan with no third yields ok plus NO_THIRDS", () => {
  const result = select.build(seedOf("(C3) G3 D4 G4 D5"));
  assert.equal(result.ok, true);
  assert.deepEqual(host(result.warnings).map((w) => w.code), ["NO_THIRDS"]);
  assert.equal(result.warnings[0].reason, core.REASONS.NO_THIRDS.reason);
  assert.deepEqual(host(result.value.warnings), host(result.warnings),
    "deck.warnings carries the same list (section 1)");
});

test("select_warnings matches on every ok row of synthetic_scales.json", () => {
  for (const row of synthetic) {
    if (!row.expect.ok) continue;
    const result = select.build(seedOf(row.string));
    assert.equal(result.ok, true, `${row.name}: build`);
    assert.deepEqual(host(result.warnings).map((w) => w.code),
      row.select_warnings || [], `${row.name}: select_warnings`);
  }
});

test("NO_THIRDS forces every degree numeral uppercase (section 10)", () => {
  const deck = built("(C3) G3 D4 G4 D5");
  for (const pc of Object.keys(deck.degrees)) {
    assert.equal(deck.degrees[pc], deck.degrees[pc].toUpperCase(),
      `degree ${pc} of a NO_THIRDS pan must be uppercase`);
  }
});

/* ---------------- determinism (section 12) ------------------------------- */

test("the same seed builds the same deck byte for byte", () => {
  for (const b of BUILTINS) {
    const first = JSON.stringify(host(select.build(seedOf(b.maker)).value));
    const second = JSON.stringify(host(select.build(seedOf(b.maker)).value));
    assert.equal(first, second, `${b.id}: build is deterministic`);
    const roundTripped = JSON.stringify(
      host(select.build(seedOf(core.formatSeed(seedOf(b.maker)))).value));
    assert.equal(roundTripped, first, `${b.id}: stable across formatSeed`);
  }
});

/* ---------------- the committed divergence table ------------------------- */

test("divergence_v1.json has the section 16 schema", () => {
  assert.equal(divergence.version, 1);
  assert.deepEqual(Object.keys(divergence).sort(), ["decks", "version"]);
  assert.deepEqual(Object.keys(divergence.decks).sort(),
    BUILTINS.map((b) => b.id).sort());
  for (const id of Object.keys(divergence.decks)) {
    const entry = divergence.decks[id];
    assert.deepEqual(Object.keys(entry).sort(), ["extra", "missing", "overrides"]);
    for (const override of entry.overrides) {
      assert.deepEqual(Object.keys(override).sort(),
        ["fields", "main", "note", "roots", "subtitle", "sup"]);
      assert.ok(override.note.length > 0, `${id}: every override cites a reason`);
    }
  }
});

test("the generated decks diverge from the built-ins exactly as committed", () => {
  for (const b of BUILTINS) {
    const entry = divergence.decks[b.id];
    const generated = built(b.maker).chords.map(keyOf);
    const shipped = b.fixtureChords.map(keyOf);
    const missing = shipped.filter((k) => !generated.includes(k));
    const extra = generated.filter((k) => !shipped.includes(k));
    assert.deepEqual(missing.sort(), [...entry.missing].sort(),
      `${b.id}: cards the engine does not produce`);
    assert.deepEqual(extra.sort(), [...entry.extra].sort(),
      `${b.id}: cards the engine produces that the built-in does not ship`);
  }
});

test("the divergence table is two-sided, so it can only shrink", () => {
  for (const b of BUILTINS) {
    const entry = divergence.decks[b.id];
    const generated = built(b.maker).chords.map(keyOf);
    const shipped = b.fixtureChords.map(keyOf);
    for (const key of entry.missing) {
      assert.ok(shipped.includes(key), `${b.id}: ${key} is not a built-in card`);
      assert.ok(!generated.includes(key),
        `${b.id}: ${key} is listed missing but the engine now produces it`);
    }
    for (const key of entry.extra) {
      assert.ok(generated.includes(key),
        `${b.id}: ${key} is listed extra but the engine no longer produces it`);
      assert.ok(!shipped.includes(key), `${b.id}: ${key} IS a built-in card`);
    }
  }
});

test("every override is a built-in card the engine does not produce", () => {
  const seen = { hijaz: [], pygmy: [], amara: [] };
  for (const b of BUILTINS) {
    const entry = divergence.decks[b.id];
    const byKey = new Map(b.fixtureChords.map((c) => [keyOf(c), c]));
    for (const override of entry.overrides) {
      const key = keyOf(override);
      seen[b.id].push(key);
      const shipped = byKey.get(key);
      assert.ok(shipped, `${b.id}: override ${key} is not a built-in card`);
      assert.deepEqual(
        { main: override.main, sup: override.sup, subtitle: override.subtitle,
          fields: override.fields, roots: override.roots },
        { main: shipped.main, sup: shipped.sup, subtitle: shipped.subtitle,
          fields: shipped.fields, roots: shipped.roots },
        `${b.id}: override ${key} must copy the built-in card verbatim`);
      assert.ok(entry.missing.includes(key),
        `${b.id}: override ${key} must also be listed missing`);
    }
  }
  // Section 9 / section 7: the two hand-authored Hijaz cards and the five
  // HIGH / LOW VOICING alternates are overrides by name.
  assert.ok(seen.hijaz.some((k) => k.startsWith("Dmaj7 (")),
    "Hijaz Dmaj7 is a recorded override");
  assert.ok(seen.hijaz.some((k) => k.startsWith("Dmaj7#11 (")),
    "Hijaz Dmaj7#11 is a recorded override");
  const alternates = [];
  for (const b of BUILTINS) {
    for (const chord of b.fixtureChords) {
      if (/VOICING/.test(chord.subtitle)) alternates.push([b.id, keyOf(chord)]);
    }
  }
  assert.equal(alternates.length, 5, "the fixture ships five HIGH/LOW alternates");
  for (const [id, key] of alternates) {
    assert.ok(seen[id].includes(key),
      `${id}: the alternate ${key} is a recorded override`);
  }
});
