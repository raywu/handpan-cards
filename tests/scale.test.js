// G1 - the new scale grammar, HPE.core.parseScale and HPE.core.formatScale,
// nothing calling them yet. Spec: docs/plans/2026-10-06-scale-syntax-and-layout-drawer.md
// section 4 (grammar), section 9 (REASONS text) and section 19 R8 (octave range).
// Every expectation comes from the plan's table in tests/fixtures/scale_grammar_v1.json,
// the shipped decks in data/decks.json, or the sentences quoted below - not from
// reading src/engine/core.js back at itself.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadEngine } = require("./helpers/engine.js");

const ROOT = path.join(__dirname, "..");
const core = loadEngine(["core"]).core;
const grammar = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests", "fixtures", "scale_grammar_v1.json"), "utf8"));
const decksFile = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "decks.json"), "utf8"));
const decks = Array.isArray(decksFile) ? decksFile : decksFile.decks;

// The engine runs in its own vm realm; normalise anything compared to a host literal.
const host = v => JSON.parse(JSON.stringify(v));

function scale(str) {
  const r = core.parseScale(str);
  assert.equal(r.ok, true, `expected ${JSON.stringify(str)} to parse, got ${r.code}: ${r.reason}`);
  return host(r.value.fields);
}

function zoneNames(fields, zone) {
  return Object.keys(fields)
    .filter(id => fields[id][3] === zone)
    .sort((a, b) => fields[a][2] - fields[b][2])
    .map(id => fields[id][0] + fields[id][1])
    .join(" ");
}

// Section 9, verbatim. <A>, <B>, <X> are substituted by the parser.
const SENTENCES = {
  NO_DING: {
    empty: "No ding. Put the ding in round brackets, e.g. (D) A C D E.",
    which: "Which note is the ding? Put it in round brackets, e.g. (D) A C D E, or put a | straight after it: D | A C D E.",
    two: "Two dings. Only the ding takes round brackets; a bottom note takes square ones, e.g. [C] (D) A C.",
    below: "<X> comes before the ding, so it must be a bottom note. Write it in square brackets, e.g. [C] (D) A C."
  },
  NO_FIFTH: {
    "": "No perfect fifth above the ding <X>. Add a <fifth of X>, or check the ding."
  },
  BAD_NOTE: {
    reason: "<X> is not a note. Use names like C, F#, Bb, with an optional octave, e.g. (D) A Bb C.",
    slash: "A lone / is the old way to mark inner notes. Use | now, e.g. (D) A C D | E F.",
    bracket: "<X> is not a bottom note. Give each bottom note its own square brackets, no spaces inside, e.g. [C] [D] (E) B.",
    bar: "Too many | marks. One | starts the inner notes, e.g. (D) A C D | E F. A bottom note takes square brackets instead: [C].",
    barEmpty: "A | needs top notes before it and inner notes after it, e.g. (D) A C D | E F.",
    barFirst: "The | comes after the ding and the top notes, e.g. (D) A C D | E F."
  },
  NOTE_OUT_OF_RANGE: {
    "": "<A> is off the keyboard: a note must be between C-1 and G9."
  },
  NOTE_OUT_OF_ORDER: {
    order: "<A> is not above <B>, and the line runs low to high. Give <A> a higher octave or move it earlier, e.g. (D3) A3 C4 D4.",
    ding: "<A> is at or below the ding <B>. Top notes are above the ding; a lower note is a bottom note and goes before it in square brackets, e.g. [C3] (D3) A3.",
    afterBar: "<A> comes after the | but is below <B>. Notes after | are inner notes now. For a bottom note, use square brackets where its pitch falls, e.g. [C3] (D3) A3 C4.",
    below: "<A> is not below <B>. Bottom notes before the ding also run low to high, e.g. [C3] [D3] (E3) B3."
  },
  NOTE_REPEATED: {
    repeated: "<B> and <A> are the same note, and a note may appear only once per shell. A bottom copy takes square brackets and its octave, e.g. (D3) A3 [C4] C4."
  }
};

function sentenceMatcher(template) {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + escaped.replace(/<fifth of X>|<[ABX]>/g, ".+?") + "$");
}

test("every row of the grammar table parses to its fields", () => {
  assert.equal(grammar.rows.length, 32);
  for (const row of grammar.rows.filter(r => r.accept)) {
    for (const str of row.strings) {
      const fields = scale(str);
      const want = row.accept;
      const label = `row ${row.row}: ${str}`;
      assert.equal(zoneNames(fields, "ding"), want.ding, label);
      assert.equal(zoneNames(fields, "rim"), want.rim, label);
      assert.equal(zoneNames(fields, "inner"), want.inner, label);
      assert.equal(zoneNames(fields, "bottom"), want.bottom, label);
      assert.equal(core.formatScale(fields), want.canonical, label);
    }
  }
});

test("every refused row carries its code and its sentence", () => {
  const seen = new Set();
  const check = (str, code, alternate) => {
    const r = core.parseScale(str);
    assert.equal(r.ok, false, `${JSON.stringify(str)} should be refused`);
    assert.equal(r.code, code, str);
    const template = SENTENCES[code][alternate === null ? "" : alternate];
    assert.match(r.reason, sentenceMatcher(template), str);
    assert.ok(!/<[^>]*>/.test(r.reason), `${str}: unsubstituted placeholder in ${r.reason}`);
    seen.add(code + "/" + alternate);
  };
  for (const row of grammar.rows.filter(r => r.refuse)) {
    for (const str of row.strings) check(str, row.refuse.code, row.refuse.alternate);
  }
  check("", "NO_DING", "empty");
  check("   ", "NO_DING", "empty");
  check("| (D) A C", "BAD_NOTE", "barFirst");
  assert.ok(seen.has("BAD_NOTE/barFirst") && seen.has("NO_DING/empty"));
  for (const code of Object.keys(SENTENCES)) {
    for (const alt of Object.keys(SENTENCES[code])) {
      if (alt === "") continue;
      assert.equal(core.SCALE_REASONS[code][alt], SENTENCES[code][alt], `${code}.${alt}`);
    }
  }
});

test("the five built-in strings parse to the shipped names, octaves, MIDI, zones and labels", () => {
  const strings = {
    hijaz: "(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4",
    pygmy: "[C3] [Db3] [Eb3] F3 | G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]",
    amara: "(D3) A3 C4 D4 E4 F4 G4 A4 C5",
    kurd: "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5",
    amara10: "(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5"
  };
  for (const id of Object.keys(strings)) {
    const shipped = decks.find(d => d.id === id);
    assert.ok(shipped, id);
    const got = scale(strings[id]);
    const keep = f => [f[0], f[1], f[2], f[3], f[5]];
    assert.deepEqual(Object.keys(got).sort(), Object.keys(shipped.fields).sort(), id);
    for (const fid of Object.keys(shipped.fields)) {
      assert.deepEqual(keep(got[fid]), keep(shipped.fields[fid]), `${id} field ${fid}`);
    }
  }
  for (const s of ["(C#) G# B C# D F F# G# B", "C# | G# B C# D F F# G# B", "D/ A C D E F G A C",
                   "[C] [Db] [Eb] F | G Ab [Bb] C [Db] Eb F G Ab C Eb | F G [Ab]"]) {
    assert.ok(core.parseScale(s).ok, s);
  }
});

test("the E Amara 20 example lands on exactly its twenty pitches", () => {
  const str = "[C] [D] (E) [F#] [G] [A] B [C] D E F# G A B [C] D E | F# G A";
  assert.equal(str.length, 60);
  const fields = scale(str);
  const dPan = ["C3", "D3", "E3", "F#3", "G3", "A3", "B3", "C4", "D4", "E4", "F#4", "G4", "A4", "B4",
                "C5", "D5", "E5", "F#5", "G5", "A5"];
  const all = Object.keys(fields).map(id => fields[id][0] + fields[id][1]).sort();
  assert.deepEqual(all, dPan.slice().sort());
  assert.equal(Object.keys(fields).length, 20);
  assert.equal(zoneNames(fields, "bottom"), "C3 D3 F#3 G3 A3 C4 C5");
  assert.equal(core.formatScale(fields).length, 80);
  assert.equal(core.deckId(fields), "custom:8c15ebd7");
});

const ALPHABET = ["|", "(D)", "D/", "[A]", "[C3]", "A", "C", "D", "E4", "/"];
let accepted = null;
function acceptedStrings() {
  if (accepted) return accepted;
  accepted = [];
  const walk = (tokens, depth) => {
    if (tokens.length) {
      const str = tokens.join(" ");
      const r = core.parseScale(str);
      if (r.ok) accepted.push({ str, tokens: tokens.slice(), fields: host(r.value.fields) });
    }
    if (depth === 5) return;
    for (const t of ALPHABET) { tokens.push(t); walk(tokens, depth + 1); tokens.pop(); }
  };
  walk([], 0);
  return accepted;
}

test("formatScale round-trips every accepted string of length one to five over the probe alphabet", () => {
  const list = acceptedStrings();
  assert.ok(list.length > 500, `only ${list.length} accepted strings: the sweep is vacuous`);
  for (const { str, fields } of list) {
    const canonical = core.formatScale(fields);
    const again = core.parseScale(canonical);
    assert.equal(again.ok, true, `${str} -> ${canonical}`);
    assert.equal(JSON.stringify(host(again.value.fields)), JSON.stringify(fields), `${str} -> ${canonical}`);
    assert.equal(core.formatScale(again.value.fields), canonical, str);
  }
});

test("a bare ding and a bracketed ding give the same pan", () => {
  let bare = 0;
  for (const { tokens, fields } of acceptedStrings()) {
    const spaced = tokens.join(" ").split(/\s+/);
    if (spaced.some(t => t.charAt(0) === "(" || t.slice(-1) === ")" || t.slice(-1) === "/" && t !== "/")) continue;
    const bar = spaced.indexOf("|");
    assert.ok(bar > 0, tokens.join(" "));
    const rewritten = spaced.slice(0, bar - 1).concat(["(" + spaced[bar - 1] + ")"], spaced.slice(bar + 1));
    const r = core.parseScale(rewritten.join(" "));
    assert.equal(r.ok, true, rewritten.join(" "));
    assert.equal(JSON.stringify(host(r.value.fields)), JSON.stringify(fields), tokens.join(" "));
    bare += 1;
  }
  assert.ok(bare > 50, `only ${bare} bare strings: the sweep is vacuous`);
  for (const [a, b] of [["C# | G# B C# D F F# G# B", "(C#) G# B C# D F F# G# B"],
                        ["F|G Ab C", "(F) G Ab C"],
                        ["[C] [D] E | G A B | D", "[C] [D] (E) G A B | D"]]) {
    assert.deepEqual(scale(a), scale(b), a);
  }
});

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ["C", "D", "E", "F", "G", "A", "B", "C#", "Eb", "F#", "Ab", "Bb", "Db", "G#", "E#", "Cb", "B#", "Fb"];
function randomNote(rand, octaveOdds) {
  const name = NAMES[Math.floor(rand() * NAMES.length)];
  return rand() < octaveOdds ? name + Math.floor(rand() * 8) : name;
}

function randomLegacy(rand, withMarks) {
  const ding = randomNote(rand, 0.5);
  const first = rand() < 0.5 ? "(" + ding + ")" : ding + "/";
  const topCount = 2 + Math.floor(rand() * (withMarks ? 12 : 10));
  const top = [];
  for (let i = 0; i < topCount; i += 1) top.push(randomNote(rand, 0.3));
  if (withMarks && rand() < 0.4) top.splice(1 + Math.floor(rand() * (top.length - 1)), 0, "/");
  let line = [first].concat(top);
  if (withMarks && rand() < 0.5) {
    const bottoms = [];
    const n = 1 + Math.floor(rand() * 6);
    for (let i = 0; i < n; i += 1) bottoms.push(randomNote(rand, 0.5));
    line = line.concat(["|"], bottoms);
  }
  return line.join(" ");
}

test("every legacy-reachable field map prints and re-parses unchanged", () => {
  const rand = rng(20261007);
  let checked = 0;
  for (let i = 0; i < 60000; i += 1) {
    const str = randomLegacy(rand, true);
    const legacy = core.parseLegacySeed(str);
    if (!legacy.ok) continue;
    const fields = host(legacy.value.fields);
    const canonical = core.formatScale(fields);
    const again = core.parseScale(canonical);
    assert.equal(again.ok, true, `${str} -> ${canonical}: ${again.code} ${again.reason}`);
    assert.equal(JSON.stringify(host(again.value.fields)), JSON.stringify(fields), `${str} -> ${canonical}`);
    checked += 1;
  }
  assert.ok(checked > 2000, `only ${checked} legacy strings accepted: the sweep is vacuous`);
  for (const d of decks) {
    const canonical = core.formatScale(d.fields);
    assert.equal(JSON.stringify(scale(canonical)), JSON.stringify(
      Object.fromEntries(Object.keys(d.fields).map(id => [id, [d.fields[id][0], d.fields[id][1], d.fields[id][2], d.fields[id][3], null, d.fields[id][5]]]))), d.id);
  }
});

test("a string with neither mark reads the same under both grammars", () => {
  const rand = rng(5150);
  let both = 0;
  for (let i = 0; i < 60000; i += 1) {
    const str = randomLegacy(rand, false);
    const old = core.parseLegacySeed(str);
    const now = core.parseScale(str);
    assert.equal(now.ok, old.ok, `${str}: legacy ${old.ok}, new ${now.ok}`);
    if (old.ok) {
      assert.equal(JSON.stringify(host(now.value.fields)), JSON.stringify(host(old.value.fields)), str);
      both += 1;
    }
  }
  assert.ok(both > 1000, `only ${both} accepted by both: the sweep is vacuous`);
});

test("every e.g. in REASONS parses", () => {
  let count = 0;
  for (const code of Object.keys(core.SCALE_REASONS)) {
    for (const text of Object.values(core.SCALE_REASONS[code])) {
      const m = /e\.g\. (.*?)\.(?:\s|$)/.exec(text);
      if (!m) continue;
      for (const example of m[1].split(", or put a | straight after it: ")) {
        const r = core.parseScale(example);
        assert.equal(r.ok, true, `${code}: "${example}" -> ${r.code}: ${r.reason}`);
        count += 1;
      }
    }
  }
  assert.ok(count >= 14, `only ${count} examples found`);
});

test("octave -1 lexes and round-trips", () => {
  const fields = scale("(C-1) G-1 C0");
  assert.equal(fields["0"][2], 0);
  assert.equal(fields["1"][2], 7);
  assert.equal(core.formatScale(fields), "(C-1) G-1 C0");
  assert.deepEqual(scale(core.formatScale(fields)), fields);
  const low = scale("[G-1] (C0) G0");
  assert.equal(low["101"][1], -1);
  assert.equal(core.formatScale(low), "[G-1] (C0) G0");
  assert.equal(core.parseScale("(C-2) G-2").ok, false);
});

test("a bracketed note among top notes and a bottom note after the inner notes continue the climb", () => {
  const among = scale("(D) A [B] C");
  assert.equal(among["101"][2], 59, "bracketed B sits above A3 as a bottom note");
  assert.equal(zoneNames(among, "bottom"), "B3");
  assert.equal(among["2"][0] + among["2"][1], "C4", "C continues from the bracketed B3");
  const pygmy = scale("[C] [Db] [Eb] F | G Ab [Bb] C [Db] Eb F G Ab C Eb | F G [Ab]");
  assert.equal(pygmy["106"][0] + pygmy["106"][1], "Ab5");
  assert.equal(pygmy["104"][0] + pygmy["104"][1], "Bb3");
  assert.equal(pygmy["105"][0] + pygmy["105"][1], "Db4");
  const same = scale("(D) A A");
  assert.equal(same["1"][2], 57);
  assert.equal(same["2"][2], 69, "an untyped repeat climbs a full octave");
  const trailing = scale("(D) A C D E F G A C | A B [C]");
  assert.equal(trailing["101"][0] + trailing["101"][1], "C6");
  const down = scale("[B] [A] (D3) A");
  assert.equal(down["102"][2], 45, "the bottom note next to the ding is the highest A below D3");
  assert.equal(down["101"][2], 35, "and the one before it is the highest B below that");
});

test("formatSeed never emits a note parseSeed refuses", () => {
  const NOTE = /^[A-G][#b]?(-1|[0-9])$/;
  const noteTokens = s => s.split(/\s+/).map(t => t.replace(/[()[\]/]/g, "")).filter(t => t && t !== "|");
  let accepted = 0;
  for (const spelled of ["B#", "Cb", "E#", "Fb"]) {
    for (const octave of ["-1", "0", "1", "8", "9", ""]) {
      for (const shape of [
        n => `[${n}] (C#-1) G# B# D#`,
        n => `(C#-1) G# ${n}`,
        n => `[${n}] (${n}) G`,
        n => `(${n}) G9`,
        n => `[${n}] (D) A`,
        n => `(D) A [${n}]`,
        n => `(${n}) F`
      ]) {
        const str = shape(spelled + octave);
        const r = core.parseScale(str);
        if (!r.ok) continue;
        accepted += 1;
        const fields = host(r.value.fields);
        for (const printed of [core.formatSeed(fields), core.formatScale(fields)]) {
          for (const token of noteTokens(printed)) assert.match(token, NOTE, `${str} printed ${printed}`);
        }
        assert.equal(core.parseScale(core.formatScale(fields)).ok, true, str);
      }
    }
  }
  assert.ok(accepted > 10, `only ${accepted} accepted: the sweep is vacuous`);
  const refused = core.parseScale("[B#] (C#-1) G# B# D#");
  assert.equal(refused.ok, false);
  assert.equal(refused.code, "BAD_NOTE");
  assert.match(refused.reason, /B#-2/);
  assert.equal(core.parseScale("[Cb] (C0) G").ok, true);
});
