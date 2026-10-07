// Phase 2 - the deck selector, HPE.select.
//
// Spec-first per tests/CONTRACT.md rule 1: every assertion comes from
// docs/ENGINE-SPEC.md sections 1, 5, 8, 9, 10, 11, 12, 13, 16 and 17, from
// tests/fixtures/golden_decks_v3.json, tests/fixtures/synthetic_scales.json or
// tests/fixtures/divergence_v1.json. Nothing is read back out of
// src/engine/select.js to compare against itself.
//
// The divergence fixture (section 8, plan Phase 2 exit) is a COMMITTED table of
// the built-ins' hand-authored cards. Its entries are keyed
// `<main><sup> (<field ids>)` - main+sup plus the voicing, because section 12
// records that `main + sup` alone is not unique on the built-ins (Pygmy `Cm`
// x3). The diff test is two-sided, so the table can only ever shrink.
//
// The key is (main+sup, fields) and NOTHING ELSE, so the table is blind to a
// divergence that lives only in `subtitle`: "Amara reproduces 16/16" means on
// that key, not on the full card. Four built-in cards do differ in subtitle
// alone - Hijaz `C#7b9`, Pygmy `Fm7`, Amara `Dm7` and `Am7`. Subtitle
// reproduction is owned by tests/naming.test.js, not by this file.
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
const golden = fixture("golden_decks_v3.json");
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

/* ---------------- root-instance enumeration helpers ----------------------- */

const PYGMY_SEED = BUILTINS.find((b) => b.id === "pygmy").maker;
const AMARA_SEED = BUILTINS.find((b) => b.id === "amara").maker;
const HIJAZ_SEED = BUILTINS.find((b) => b.id === "hijaz").maker;
const ALL_SEEDS = BUILTINS.map((b) => b.maker);

// Parse the trailing " - LOW VOICING" / " - HIGH VOICING" off a subtitle;
// "" (no suffix) means the home card.
function voicingClassOf(subtitle) {
  const m = / - (LOW|HIGH) VOICING$/.exec(subtitle);
  return m ? m[1] : "";
}

function midiOf(deck, fieldId) {
  return deck.fields[String(fieldId)][2];
}

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

/* ---------------- section 8: candidates, collapse, no trim ------------------- */

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

test("collapse's symmetric-root tie-break applies to a 2-member group, not just 3+ (Q22)", () => {
  // A hand-built pitch-set collision: two candidates share the pitch set
  // {0,6} under the SAME suffix but different roots, so collapse's symmetric
  // branch (select.js:226) is eligible with exactly 2 survivors. Ranking
  // alone (tier, then rank) prefers the root-6 candidate; section 8's
  // tie-break (symmetricRoot) prefers the tonic, root 0, whenever the tonic
  // is itself a candidate root. The two disagree, so this pins which one
  // wins.
  const fields = {
    "0": ["C", 3, 60, "ding", null, "Ding"],
    "1": ["C", 4, 60, "rim", 0, "1"],
    "2": ["Gb", 4, 66, "rim", 180, "2"]
  };
  const a = {root: 0, suffix: "tritone", tier: "seventh", rank: 8, intervals: [0, 6]};
  const b = {root: 6, suffix: "tritone", tier: "triad", rank: 0, intervals: [0, 6]};
  const winners = host(select.collapse(fields, [a, b], 0));
  assert.equal(winners.length, 1, "the two candidates share one pitch set");
  assert.equal(winners[0].root, 0,
    "the tie-break must run for a 2-member symmetric group and prefer the tonic");
});

const KURD_10 = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5";
const MAXIMUM = synthetic.find((r) => r.expect.ok && /maximum/.test(r.name));

// D16: nothing trims a deck. Every ranked card of a seed is in the deck.
test("no deck is trimmed: every ranked card of a seed is in the deck", () => {
  const sizes = (str) => {
    const deck = built(str);
    return [deck.chords.length, new Set(deck.chords.map(nameOf)).size];
  };
  assert.deepEqual(sizes(KURD_10), [49, 49], "D Kurd 10");
  assert.deepEqual(sizes(TWELVE), [35, 27], "the twelve-note pan");
  assert.ok(MAXIMUM, "synthetic_scales.json ships a maximum-size entry");
  assert.deepEqual(sizes(MAXIMUM.string), [74, 43], "the nineteen-field maximum");
});

test("canonical order: root degree, then tier, then the quality rank", () => {
  // Section 8: roots by scale degree ascending from the tonic; within a root
  // triad, power, sus4, 7th, extended; within a tier by the `rank` field.
  // This pan repeats the D/E/G/A pitch classes, so root-instance enumeration
  // (this plan) legitimately produces a HIGH-register alternate immediately
  // after several HOME cards - the group stays contiguous, and the deck's
  // 35 cards are all kept: nothing trims a deck (D16).
  assert.deepEqual(built(TWELVE).chords.map(nameOf), [
    "C", "C5", "Cmaj7", "Cadd9", "C6/9", "Cmaj9",
    "D5", "D5", "Dsus4", "Dsus4", "D7sus4",
    "Em", "Em", "E5", "E5", "Esus4", "Esus4", "E7sus4", "Em7",
    "G", "G5", "Gsus4", "Gadd9", "G6/9",
    "Am", "A5", "Asus4", "A7sus4", "Am7", "Amadd9", "Amadd9", "Am9", "Am9",
    "Am11", "Am11"
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

test("m7 and m7b5 derive the D4 equivalence annotation mechanically", () => {
  // Section 8 / D4: an m7 is annotatable as `( = (X+3)6 )` and an m7b5 as
  // `( = (X+3)m6 )`. Hijaz ships that exact m7b5 subtitle.
  const hijaz = golden.decks.find((d) => d.id === "hijaz");
  const shipped = hijaz.chords.find((c) => c.sup === "b5");
  assert.equal(shipped.subtitle, "HALF-DIMINISHED ( = Bm6 )");
  const generated = built(hijaz.maker_string).chords
    .find((c) => nameOf(c) === shipped.main + shipped.sup);
  assert.equal(generated.subtitle, shipped.subtitle);
  // Amara's m7 cards ship unannotated (provenance, section 8), so a generated
  // deck is the two-sided case: the annotation IS derived.
  const amara = built("(D3) A3 C4 D4 E4 F4 G4 A4 C5").chords;
  assert.equal(amara.find((c) => nameOf(c) === "Dm7").subtitle,
    "D MINOR 7 ( = F6 )");
  assert.equal(amara.find((c) => nameOf(c) === "Am7").subtitle,
    "A MINOR 7 ( = C6 )");
  // Nothing else is ever annotated.
  for (const row of synthetic) {
    if (!row.expect.ok) continue;
    for (const chord of built(row.string).chords) {
      if (!/\( = /.test(chord.subtitle)) continue;
      assert.ok(chord.sup === "b5" || (chord.sup === "7" && /m$/.test(chord.main)),
        `${row.name} ${nameOf(chord)}: only m7 and m7b5 carry an equivalence`);
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
  // Section 9 / section 7: the two hand-authored Hijaz cards are overrides
  // by name. Of the fixture's seven shipped HIGH/LOW VOICING alternates,
  // root-instance enumeration (this plan) now DERIVES six of them (Pygmy's
  // Ab/Cm/Cm7/Eb/Eb7 multi-voicings) - they are reproduced cards, not
  // opt-in override data, so they are deliberately no longer recorded as
  // overrides. Hijaz's `Bm - HIGH VOICING` is explicitly out of scope for
  // this plan (deferred, not dropped) and stays a recorded override.
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
  assert.equal(alternates.length, 7, "the fixture ships seven HIGH/LOW alternates");
  const stillDeferred = new Set(["hijaz"]);
  for (const [id, key] of alternates) {
    if (!stillDeferred.has(id)) continue;
    assert.ok(seen[id].includes(key),
      `${id}: the alternate ${key} is a recorded override`);
  }
});

/* ---------------- root-instance enumeration (Part B) ---------------------- */

// Pygmy C has three playable instances: C3 (bottom), C4 (rim), C5 (rim).
// Home is the lowest NON-bottom instance, C4.
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

// D4: Pygmy Db exists only as Db3 and Db4, both bottom shell.
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

/* ---------------- rank by name group (D1) --------------- */

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

test("within a chord's group, LOW precedes HIGH (class order, not just contiguity)", () => {
  // The engine derives THREE Pygmy chords where all three classes coexist:
  // Cm (HOME [3,4,6], LOW [101,103,1], HIGH [8,9,11]), C5 (HOME [3,6],
  // LOW [101,1], HIGH [8,11]) and Csus4 (HOME [3,5,6], LOW [101,5,1],
  // HIGH [8,10,11]). Only Cm's three cards are in the shipped deck today;
  // C5's and Csus4's alternates are engine output pending owner adoption
  // (the `extra` inventory in tests/fixtures/divergence_v1.json). The test
  // asserts class ORDER, which holds regardless of adoption. Contiguity
  // alone (the test above) is satisfied by either [HOME, LOW, HIGH] or
  // [HOME, HIGH, LOW] - both keep a chord's three cards together with HOME
  // first. This test pins the second property Task 5 actually promises,
  // on every one of the three: CLASS_ORDER prints HOME, then LOW, then
  // HIGH, not merely "HOME first, alternates in any order".
  const deck = built(PYGMY_SEED);
  ["Cm", "C5", "Csus4"].forEach((name) => {
    const cards = deck.chords.filter((c) => c.main + c.sup === name);
    assert.deepEqual(cards.map((c) => voicingClassOf(c.subtitle)),
      ["", "LOW", "HIGH"],
      `Pygmy ${name} should print HOME, then LOW, then HIGH, in that order`);
  });
});

test("alternates sit beside their primary and none is dropped", () => {
  const deck = built(PYGMY_SEED);
  const names = new Set(deck.chords.map((c) => c.main + c.sup));
  assert.ok(deck.chords.length > names.size,
    "Pygmy does carry alternates, so this test is not vacuous");
  for (const name of ["Cm", "C5", "Csus4"]) {
    const cards = deck.chords.filter((c) => c.main + c.sup === name);
    assert.deepEqual(cards.map((c) => voicingClassOf(c.subtitle)),
      ["", "LOW", "HIGH"], `${name}: home, LOW and HIGH all present`);
  }
});

test("no chord name is half-present", () => {
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

/* ---------------- the acceptance gates (D2) -------------------------------- */

// The commercial D Amara reference ships no repeated-root card. The engine
// must therefore emit no alternate there - that is the whole content of the
// "Amara 16/16" gate, because enumeration contributes nothing on a pan with
// no repeated roots.
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
  const amara = BUILTINS.find((b) => b.id === "amara");
  const generated = built(AMARA_SEED).chords.map(keyOf);
  for (const c of amara.fixtureChords) {
    assert.ok(generated.includes(keyOf(c)), `Amara ${keyOf(c)} is still produced`);
  }
});

// The gate that actually constrains the ranking filter. Every hand-authored
// multi-voicing card in the shipped Pygmy deck must fall out of the engine,
// card by card. Transcribed directly from the shipped DECKS blob in
// index.html (not copied from the plan - see the plan's Task 6 Step 2 for the
// transcription script), because the plan's first draft of this list was
// wrong: it had Cm HOME as [1,3,5] (actually [3,4,6]) and was missing five
// cards (Ab HOME, Ab HIGH, Cm7 HOME, Eb HOME, Eb7 HOME).
const HAND_AUTHORED_MULTI_VOICINGS = [
  // main+sup, voicing class ("" = home), fields
  ["Ab",  "",     [2, 3, 4]],
  ["Ab",  "HIGH", [7, 8, 9]],
  ["Cm",  "LOW",  [101, 103, 1]],
  ["Cm",  "",     [3, 4, 6]],
  ["Cm",  "HIGH", [8, 9, 11]],
  ["Cm7", "LOW",  [101, 103, 1, 104]],
  ["Cm7", "",     [3, 4, 6, 104]],
  ["Eb",  "LOW",  [103, 1, 104]],
  ["Eb",  "",     [4, 6, 104]],
  ["Eb7", "LOW",  [103, 1, 104, 105]],
  ["Eb7", "",     [4, 6, 104, 105]]
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

test("ET-2 noThirds", () => {
  const fieldsOf = (str) => core.parseSeed(str).value.fields;
  assert.equal(select.noThirds(fieldsOf("(C3) G3 D4 G4 D5")), true,
    "G and D roots have no 3rd above on the top shell");
  assert.equal(select.noThirds(fieldsOf("(D3) A3 C4 D4 E4 F4 G4 A4 C5")), false,
    "A has C (a minor 3rd) above it");
  assert.equal(select.noThirds(fieldsOf("(C3) G3 Bb3 C4")), false,
    "G has Bb (a minor 3rd) above it and nothing else does");
  assert.equal(select.noThirds(fieldsOf("(C3) G3 B3 C4")), false,
    "G has B (a major 3rd) above it and nothing else does");
});

/* ------------------------------------------------------------- EG-3 */

test("EG-3 warning shape equals core.err shape", () => {
  const warning = host(select.build(seedOf("(C3) G3 D4 G4 D5")).warnings[0]);
  const error = host(core.err("NO_THIRDS"));
  assert.deepEqual(Object.keys(warning), ["code", "reason"]);
  assert.equal(error.ok, false, "core.err carries ok:false, a warning does not");
  const { ok, ...errorWithoutOk } = error;
  assert.deepEqual(warning, errorWithoutOk,
    "same code and reason, but not the same shape: routing through core.err would add ok:false to every warning");
});
