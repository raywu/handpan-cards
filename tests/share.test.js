// Phase 4 lane 4a - HPE.share, the versioned seed share encoding.
//
// Spec-first per tests/CONTRACT.md rule 1: every assertion comes from
// docs/ENGINE-SPEC.md sections 1, 2, 13, 14 and 16, from
// tests/fixtures/synthetic_scales.json or from the golden maker strings.
// Nothing is read back out of src/engine/share.js to compare against itself;
// the module's PUBLIC surface (VERSION, CAPS) is the contract under test, and
// the reason strings are held to the spec's own section 2 table.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadEngine } = require("./helpers/engine.js");

const ROOT = path.join(__dirname, "..");
const HPE = loadEngine(["core", "share"]);
const core = HPE.core;
const share = HPE.share;

const SHARE_SRC = fs.readFileSync(
  path.join(ROOT, "src", "engine", "share.js"), "utf8");
const SPEC = fs.readFileSync(path.join(ROOT, "docs", "ENGINE-SPEC.md"), "utf8");
const golden = JSON.parse(fs.readFileSync(
  path.join(ROOT, "tests", "fixtures", "golden_decks_v1.json"), "utf8"));
const synthetic = JSON.parse(fs.readFileSync(
  path.join(ROOT, "tests", "fixtures", "synthetic_scales.json"), "utf8"));

const OK_ROWS = synthetic.filter(r => r.expect && r.expect.ok === true);
const NOT_OK_ROWS = synthetic.filter(r => r.expect && r.expect.code);
const MAKER_STRINGS = golden.decks.map(d => d.maker_string);

// Engine values live in a node:vm realm; deepStrictEqual compares prototypes.
function host(value) {
  return JSON.parse(JSON.stringify(value));
}

function parsed(str, options) {
  const r = core.parseSeed(str, options);
  assert.equal(r.ok, true,
    `expected ${JSON.stringify(str)} to parse, got ${r.code}: ${r.reason}`);
  return host(r.value);
}

function encoded(seed) {
  const r = share.encode(seed);
  assert.equal(r.ok, true,
    `expected encode to succeed, got ${r.code}: ${r.reason}`);
  assert.equal(typeof r.value, "string");
  return r.value;
}

function decoded(str) {
  const r = share.decode(str);
  assert.equal(r.ok, true,
    `expected ${JSON.stringify(str)} to decode, got ${r.code}: ${r.reason}`);
  return host(r.value);
}

// The section 2 reason string for a code, read from the spec table.
function specReason(code) {
  const start = SPEC.indexOf("\n## 2. ");
  const end = SPEC.indexOf("\n## 3. ", start);
  assert.ok(start > 0 && end > start, "ENGINE-SPEC has no section 2");
  for (const line of SPEC.slice(start, end).split("\n")) {
    const m = line.match(/^\| `([A-Z_]+)` \| (\w+) \| `(.+)` \|$/);
    if (m && m[1] === code) return m[3];
  }
  throw new Error(`no section 2 row for ${code}`);
}

// Section 2 is a CLOSED enum; share may only ever answer with one of these.
const CODES = ["NO_DING", "NO_FIFTH", "TOO_MANY_RIM", "BAD_NOTE",
               "NEEDS_NEWER_APP", "NO_THIRDS"];

/* ---------------------------------------------------------------------- */
/* (a) round trip                                                          */
/* ---------------------------------------------------------------------- */

test("every ok synthetic scale round-trips through encode/decode", () => {
  assert.ok(OK_ROWS.length >= 10, "fixture lost its ok rows");
  for (const row of OK_ROWS) {
    const seed = parsed(row.string);
    assert.deepStrictEqual(decoded(encoded(seed)), seed,
      `round trip changed the seed for ${row.name}`);
  }
});

test("the three golden maker strings round-trip through encode/decode", () => {
  assert.equal(MAKER_STRINGS.length, 3);
  for (const maker of MAKER_STRINGS) {
    const seed = parsed(maker);
    assert.deepStrictEqual(decoded(encoded(seed)), seed,
      `round trip changed the seed for ${maker}`);
  }
});

/* ---------------------------------------------------------------------- */
/* (b) options survive                                                     */
/* ---------------------------------------------------------------------- */

const BASE = MAKER_STRINGS[2]; // amara

// Section 13: palette index 0-5, parent index 0-10 or null, name 1-40
// printable ASCII, mirror boolean.
const OPTION_CASES = [
  { palette: 0 }, { palette: 3 }, { palette: 5 },
  { parent: null }, { parent: 0 }, { parent: 7 }, { parent: 10 },
  { mirror: false }, { mirror: true },
  { name: "" }, { name: "My Pan" },
  { name: "A B~C 40 chars long name padded out ok!!" },
  { palette: 4, parent: 2, mirror: true, name: "Everything At Once" },
];

test("palette survives the round trip on its own", () => {
  for (const palette of [0, 1, 2, 3, 4, 5]) {
    const seed = parsed(BASE, { palette });
    assert.equal(decoded(encoded(seed)).options.palette, palette);
  }
});

test("parent survives the round trip on its own, null included", () => {
  for (const parent of [null, 0, 1, 5, 9, 10]) {
    const seed = parsed(BASE, { parent });
    assert.equal(decoded(encoded(seed)).options.parent, parent);
  }
});

test("mirror survives the round trip on its own", () => {
  for (const mirror of [false, true]) {
    const seed = parsed(BASE, { mirror });
    assert.equal(decoded(encoded(seed)).options.mirror, mirror);
  }
});

test("name survives the round trip on its own, punctuation included", () => {
  for (const name of ["", "My Pan", "a", "tab|pipe (D3) \\ \"quoted\" #1",
                      "A B~C 40 chars long name padded out ok!!"]) {
    const seed = parsed(BASE, { name });
    assert.equal(decoded(encoded(seed)).options.name, name);
  }
});

test("every option combination round-trips whole", () => {
  for (const options of OPTION_CASES) {
    const seed = parsed(BASE, options);
    assert.deepStrictEqual(decoded(encoded(seed)), seed,
      `options lost for ${JSON.stringify(options)}`);
  }
});

test("changing any option changes the share string", () => {
  const base = parsed(BASE, { palette: 0, parent: null, mirror: false, name: "" });
  const baseStr = encoded(base);
  const changes = [
    { palette: 1 }, { parent: 0 }, { mirror: true }, { name: "Renamed" },
  ];
  const seen = new Set([baseStr]);
  for (const change of changes) {
    const str = encoded(parsed(BASE, Object.assign(
      { palette: 0, parent: null, mirror: false, name: "" }, change)));
    assert.notEqual(str, baseStr,
      `${JSON.stringify(change)} did not change the share string`);
    assert.equal(seen.has(str), false, "two option sets share one string");
    seen.add(str);
  }
});

test("D14: no option changes the deckId of the decoded seed", () => {
  const base = parsed(BASE);
  const id = core.deckId(base);
  for (const options of OPTION_CASES) {
    const seed = parsed(BASE, options);
    assert.equal(core.deckId(decoded(encoded(seed))), id,
      `deckId moved for ${JSON.stringify(options)}`);
  }
});

/* ---------------------------------------------------------------------- */
/* (c) the version byte                                                    */
/* ---------------------------------------------------------------------- */

test("the share string leads with the version byte", () => {
  assert.equal(share.VERSION, 1);
  const str = encoded(parsed(BASE));
  assert.equal(str.charAt(0), String(share.VERSION));
});

test("a newer version byte is rejected with NEEDS_NEWER_APP", () => {
  const str = encoded(parsed(BASE));
  for (const bump of [1, 2, 8]) {
    const newer = String(share.VERSION + bump) + str.slice(1);
    const r = share.decode(newer);
    assert.equal(r.ok, false);
    assert.equal(r.code, "NEEDS_NEWER_APP");
    assert.equal(r.reason, specReason("NEEDS_NEWER_APP"));
  }
});

/* ---------------------------------------------------------------------- */
/* (d) integrity                                                           */
/* ---------------------------------------------------------------------- */

test("flipping any single character of a valid string is rejected", () => {
  const str = encoded(parsed(BASE, { palette: 2, name: "Amara" }));
  assert.ok(str.length > 20, "share string is implausibly short");
  for (let i = 0; i < str.length; i += 1) {
    const swap = str.charAt(i) === "A" ? "B" : "A";
    const broken = str.slice(0, i) + swap + str.slice(i + 1);
    let r;
    assert.doesNotThrow(() => { r = share.decode(broken); },
      `decode threw on a flip at ${i}`);
    assert.equal(r.ok, false, `flip at ${i} was accepted: ${broken}`);
    assert.ok(CODES.includes(r.code), `flip at ${i} invented code ${r.code}`);
  }
});

test("truncating or extending a valid string is rejected", () => {
  const str = encoded(parsed(BASE));
  for (const bad of [str.slice(0, -1), str.slice(1), str + "A", "", "1", "x"]) {
    const r = share.decode(bad);
    assert.equal(r.ok, false, `accepted ${JSON.stringify(bad)}`);
    assert.ok(CODES.includes(r.code));
  }
});

test("decode never throws on hostile input", () => {
  for (const bad of [undefined, null, 42, {}, [], "\n\n\n", "1  "]) {
    let r;
    assert.doesNotThrow(() => { r = share.decode(bad); },
      `decode threw on ${JSON.stringify(bad)}`);
    assert.equal(r.ok, false);
  }
});

/* ---------------------------------------------------------------------- */
/* (e) the payload cap                                                     */
/* ---------------------------------------------------------------------- */

test("a payload over CAPS is rejected", () => {
  assert.equal(typeof share.CAPS.payload, "number");
  const over = String(share.VERSION) + new Array(share.CAPS.payload + 8).join("A");
  assert.ok(over.length > share.CAPS.payload);
  const r = share.decode(over);
  assert.equal(r.ok, false);
  assert.ok(CODES.includes(r.code));
});

test("an over-cap payload is rejected WITHOUT parsing anything", () => {
  // The cap is the first gate, so an over-cap string that also carries a newer
  // version byte is refused on length and never reaches the version check.
  const over = String(share.VERSION + 1) +
    new Array(share.CAPS.payload + 8).join("A");
  const r = share.decode(over);
  assert.equal(r.ok, false);
  assert.notEqual(r.code, "NEEDS_NEWER_APP",
    "the payload cap must be checked before the version byte");
  const under = String(share.VERSION + 1) + new Array(40).join("A");
  assert.equal(share.decode(under).code, "NEEDS_NEWER_APP",
    "an under-cap newer link must still say NEEDS_NEWER_APP");
});

test("every valid seed encodes inside the cap", () => {
  for (const row of OK_ROWS) {
    const seed = parsed(row.string, {
      palette: 5, parent: 10, mirror: true,
      name: "A B~C 40 chars long name padded out ok!!",
    });
    assert.ok(encoded(seed).length <= share.CAPS.payload,
      `${row.name} does not fit the share cap`);
  }
});

/* ---------------------------------------------------------------------- */
/* (f) decode rejects, never repairs                                       */
/* ---------------------------------------------------------------------- */

// Builds the seed SHAPE (section 1) straight from a scale string, bypassing
// parseSeed, so a share string can be made to carry a payload parseSeed will
// refuse. Rows whose ding token is malformed by construction ("no ding", "two
// dings") cannot be expressed as a field map and are skipped.
function unvalidatedSeed(str) {
  const tokens = str.split(/\s+/).filter(t => t !== "");
  const ding = /^\((.+)\)$/.exec(tokens[0]);
  if (!ding) return null;
  const split = (t) => {
    const m = /^([A-Za-z][#b]?)(-?\d+)?$/.exec(t);
    return m ? [m[1], m[2] === undefined ? 3 : Number(m[2])] : [t, 3];
  };
  const fields = {};
  const d = split(ding[1]);
  fields["0"] = [d[0], d[1], 60, "ding", null, "Ding"];
  const rest = tokens.slice(1);
  const bar = rest.indexOf("|");
  const top = bar < 0 ? rest : rest.slice(0, bar);
  const bottom = bar < 0 ? [] : rest.slice(bar + 1);
  top.forEach((t, i) => {
    const s = split(t);
    fields[String(i + 1)] = [s[0], s[1], 60, i < 11 ? "rim" : "inner", null,
                             String(i + 1)];
  });
  bottom.forEach((t, i) => {
    const s = split(t);
    fields[String(101 + i)] = [s[0], s[1], 60, "bottom", null, "U" + (i + 1)];
  });
  return { fields, options: { palette: 0, parent: null, name: "", mirror: false } };
}

test("decode propagates parseSeed's own code for an invalid seed", () => {
  let checked = 0;
  for (const row of NOT_OK_ROWS) {
    const seed = unvalidatedSeed(row.string);
    if (!seed) continue;
    const str = encoded(seed);
    const r = share.decode(str);
    assert.equal(r.ok, false, `decode repaired ${row.name}`);
    assert.equal(r.code, row.expect.code,
      `decode changed the code for ${row.name}`);
    assert.equal(r.reason, core.parseSeed(row.string).reason,
      `decode changed the reason for ${row.name}`);
    checked += 1;
  }
  assert.ok(checked >= 5, `only ${checked} not-ok rows were expressible`);
});

test("decode propagates a rejected OPTION rather than repairing it", () => {
  // Section 14: parseSeed validates the seed options too, so a payload with an
  // out-of-range palette must be refused, not clamped.
  const seed = parsed(BASE);
  seed.options.palette = 9;
  const r = share.decode(encoded(seed));
  assert.equal(r.ok, false);
  assert.equal(r.code, "BAD_NOTE");
});

/* ---------------------------------------------------------------------- */
/* (g) zone and angle are never encoded                                    */
/* ---------------------------------------------------------------------- */

test("the payload carries no zone or angle: mangling them changes nothing", () => {
  const seed = parsed(BASE, { palette: 1, name: "Zones" });
  const mangled = host(seed);
  for (const id of Object.keys(mangled.fields)) {
    mangled.fields[id][3] = "NONSENSE";
    mangled.fields[id][4] = 123.456;
  }
  assert.equal(encoded(mangled), encoded(seed),
    "zone or angle leaked into the share string");
});

test("decode reconstructs zones and angles through parseSeed", () => {
  for (const row of OK_ROWS) {
    if (!row.zones) continue;
    const back = decoded(encoded(parsed(row.string)));
    const counts = { ding: 0, rim: 0, inner: 0, bottom: 0 };
    for (const id of Object.keys(back.fields)) {
      counts[back.fields[id][3]] += 1;
      assert.equal(back.fields[id][4], null,
        `${row.name} decoded a non-null angle; angles are layout output`);
    }
    assert.deepStrictEqual(counts, row.zones, `zones wrong for ${row.name}`);
  }
});

/* ---------------------------------------------------------------------- */
/* (h) determinism and forward shape                                       */
/* ---------------------------------------------------------------------- */

test("encode is deterministic, byte for byte", () => {
  for (const row of OK_ROWS) {
    const options = { palette: 2, parent: 4, mirror: true, name: "Stable" };
    const a = encoded(parsed(row.string, options));
    const b = encoded(parsed(row.string, options));
    const c = encoded(decoded(a));
    assert.equal(a, b, `encode is not deterministic for ${row.name}`);
    assert.equal(a, c, `re-encoding a decoded seed drifted for ${row.name}`);
  }
});

test("the v1 payload reserves an empty section for Phase-5 layout deltas", () => {
  // D14 reserves space for layout deltas behind the version byte. In v1 that
  // section is present and empty; a v1 string carrying content there is a
  // corrupt payload, and a future version fills it behind version byte 2.
  const doc = SHARE_SRC.slice(0, SHARE_SRC.indexOf("(function"));
  assert.match(doc, /layout delta/i,
    "share.js does not document the reserved layout-delta section");
  const seed = parsed(BASE);
  const str = encoded(seed);
  const r = share.decode(str);
  assert.equal(r.ok, true);
  // Nothing but the reserved section may be empty-extensible: the string is a
  // fixed shape, so appending to it is refused.
  assert.equal(share.decode(str + "AAAAAA").ok, false);
});

/* ---------------------------------------------------------------------- */
/* (i) no browser API                                                      */
/* ---------------------------------------------------------------------- */

test("the module references no host encoder or compression API", () => {
  for (const api of ["btoa", "atob", "TextEncoder", "TextDecoder",
                     "CompressionStream", "DecompressionStream", "Buffer",
                     "document", "window", "localStorage"]) {
    assert.equal(new RegExp("\\b" + api + "\\s*\\(").test(SHARE_SRC), false,
      `share.js calls ${api}; section 14 forbids depending on it`);
  }
  assert.equal(/\brequire\s*\(|^\s*import\s|^\s*export\s/m.test(SHARE_SRC), false,
    "share.js must stay a plain inlinable script");
});

test("share answers only with codes from the closed section 2 enum", () => {
  const bad = ["", "9", "1AAA", "zzzz", String(share.VERSION) + "!!!!!!!!"];
  for (const row of NOT_OK_ROWS) {
    const seed = unvalidatedSeed(row.string);
    if (seed) bad.push(encoded(seed));
  }
  for (const str of bad) {
    const r = share.decode(str);
    if (r.ok) continue;
    assert.ok(CODES.includes(r.code), `invented code ${r.code}`);
    assert.equal(typeof r.reason, "string");
    assert.ok(r.reason.length > 0);
    assert.equal("value" in r, false, "an err result carries no value");
  }
});
