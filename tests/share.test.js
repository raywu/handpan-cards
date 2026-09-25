// Phase 4 lane 4a - HPE.share, the versioned seed share encoding.
//
// Spec-first per tests/CONTRACT.md rule 1: every assertion comes from
// docs/ENGINE-SPEC.md sections 1, 2, 13, 14 and 16, from
// tests/fixtures/synthetic_scales.json or from the golden maker strings.
// Nothing is read back out of src/engine/share.js to compare against itself;
// the module's PUBLIC surface (VERSION, CAPS) is the contract under test, and
// the reason strings are held to the spec's own section 2 table.
//
// [#23 review correction, lane 4b] The "no browser API" source scan below is
// not a backstop. tests/helpers/engine.js:42-43 INJECTS TextEncoder,
// TextDecoder, btoa and atob into every vm sandbox, so for four of the six APIs
// section 14 names this scan is the ONLY guard: a module that used them would
// run green in the realm. Only CompressionStream and Buffer are genuinely
// absent here. That is why the scan is anchored on the NAME rather than on a
// direct call - `Buffer.from(x)` is a use, and `\bBuffer\s*\(` did not see it.
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
  path.join(ROOT, "tests", "fixtures", "golden_decks_v3.json"), "utf8"));
const synthetic = JSON.parse(fs.readFileSync(
  path.join(ROOT, "tests", "fixtures", "synthetic_scales.json"), "utf8"));

const OK_ROWS = synthetic.filter(r => r.expect && r.expect.ok === true);
const NOT_OK_ROWS = synthetic.filter(r => r.expect && r.expect.code);
const MAKER_STRINGS = golden.decks.map(d => d.maker_string);

// Q35: every table-driven test below that iterates NOT_OK_ROWS (e.g. "decode
// propagates parseSeed's own code for an invalid seed") is a for-loop with no
// per-row assertion count, so an empty table would silently make that test a
// no-op pass rather than fail. This guard fails loudly if the fixture ever
// loses its error rows.
test("the synthetic fixture has at least one error-expecting row (Q35)", () => {
  assert.ok(NOT_OK_ROWS.length > 0, "fixture lost its NOT_OK_ROWS rows");
});

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
               "NOTE_OUT_OF_RANGE", "NOTE_OUT_OF_ORDER", "NOTE_REPEATED",
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

// Q18: the CHECK suffix is a checksum over VERSION_CHAR + BODY, and a round
// trip alone cannot catch a broken checksum - encode and decode share the
// same (possibly broken) implementation, so a shifted checksum still
// round-trips against itself. These two literals were captured from
// share.encode's real output at commit 23c4962 (git show
// 23c4962:src/engine/share.js, run through tools/engine_loader.js in a
// scratch directory; not computed here), so any future change to the
// checksum mixing - including the one this file's f1b_share_checksum_shift
// mutant makes - changes the tail of these strings and fails the pin.
test("encode's checksum is pinned against a captured minimal payload (Q18)", () => {
  const seed = parsed("(C3) G3");
  assert.equal(encoded(seed), "2A4CpAI17Cmem2Gam2GeOUlLJ0");
});

test("encode's checksum is pinned against a captured payload with every option set (Q18)", () => {
  const seed = parsed("(D3) A3 C4 D4 E4 F4 G4 A4 C5",
    { palette: 2, parent: 3, mirror: true, name: "Test Deck" });
  assert.equal(encoded(seed),
    "2A4GpAI11Co13D214D215D216D217D211D213DGeo2JC9CGbKPNDq84HbOsiAlM3pN0");
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
  const str = encoded(parsed(BASE));
  assert.equal(str.charAt(0), "0123456789".charAt(share.VERSION),
    "the version byte of a single-digit version is its decimal digit");
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
/* (d2) the UTF-8 byte pipeline (Q4)                                       */
/*                                                                          */
/* share.js:108-157 hand-rolls UTF-8 encode/decode because a vm realm has  */
/* no TextEncoder (see the file's own top comment). Nothing above the byte */
/* layer ever carries a multi-byte character through a FULL              */
/* encode/decode/parseSeed round trip - scale tokens are ASCII, and       */
/* section 13 restricts a validated `name` to printable ASCII - so the    */
/* only way to exercise the byte pipeline itself is a standalone          */
/* reference re-implementation of the same public wire contract (this     */
/* file's own header comment: the URL-safe alphabet, unpadded 6-bit       */
/* packing, the FNV-1a check), cross-checked against the two Q18 golden   */
/* literals above before being trusted for anything.                      */
/* ---------------------------------------------------------------------- */

const REF_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                     "abcdefghijklmnopqrstuvwxyz-_";
const REF_INDEX = {};
for (let ri = 0; ri < REF_ALPHABET.length; ri += 1) {
  REF_INDEX[REF_ALPHABET.charAt(ri)] = ri;
}

function refUtf8Bytes(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i += 1) {
    let code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
      const low = str.charCodeAt(i + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
        i += 1;
      }
    }
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f),
                 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f),
                 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
}

function refUtf8String(bytes) {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    let code, extra;
    if (b < 0x80) { code = b; extra = 0; }
    else if ((b & 0xe0) === 0xc0) { code = b & 0x1f; extra = 1; }
    else if ((b & 0xf0) === 0xe0) { code = b & 0x0f; extra = 2; }
    else if ((b & 0xf8) === 0xf0) { code = b & 0x07; extra = 3; }
    else return null;
    if (i + extra >= bytes.length) return null;
    for (let k = 1; k <= extra; k += 1) {
      const next = bytes[i + k];
      if ((next & 0xc0) !== 0x80) return null;
      code = (code << 6) | (next & 0x3f);
    }
    i += extra + 1;
    if (code > 0x10ffff) return null;
    if (code > 0xffff) {
      code -= 0x10000;
      out += String.fromCharCode(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
    } else {
      out += String.fromCharCode(code);
    }
  }
  return out;
}

function refToAlphabet(bytes) {
  let out = "", bits = 0, acc = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    acc = (acc << 8) | bytes[i];
    bits += 8;
    while (bits >= 6) { bits -= 6; out += REF_ALPHABET.charAt((acc >> bits) & 0x3f); }
  }
  if (bits > 0) out += REF_ALPHABET.charAt((acc << (6 - bits)) & 0x3f);
  return out;
}

function refFromAlphabet(str) {
  const bytes = [];
  let bits = 0, acc = 0;
  for (let i = 0; i < str.length; i += 1) {
    const v = REF_INDEX[str.charAt(i)];
    if (v === undefined) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((acc >> bits) & 0xff); }
  }
  return bytes;
}

function refChecksum(text) {
  let hash = 0x811c9dc5;
  const bytes = refUtf8Bytes(text);
  for (let i = 0; i < bytes.length; i += 1) {
    hash = (hash ^ bytes[i]) >>> 0;
    hash = (((hash & 0xffff) * 0x01000193) +
            ((((hash >>> 16) * 0x01000193) & 0xffff) << 16)) >>> 0;
  }
  return refToAlphabet([(hash >>> 24) & 0xff, (hash >>> 16) & 0xff,
                        (hash >>> 8) & 0xff, hash & 0xff]);
}

test("the reference UTF-8/alphabet/checksum re-implementation matches the two Q18 golden literals (Q4 setup)", () => {
  for (const golden of [
    "2A4CpAI17Cmem2Gam2GeOUlLJ0",
    "2A4GpAI11Co13D214D215D216D217D211D213DGeo2JC9CGbKPNDq84HbOsiAlM3pN0"
  ]) {
    const head = golden.slice(0, golden.length - 6);
    const check = golden.slice(golden.length - 6);
    assert.equal(refChecksum(head), check,
      "the reference checksum must reproduce a known-good CHECK before it can be trusted below");
  }
});

// [PR 144 review round 1, F2] The reference re-implementation above mirrors
// share.js's own surrogate-pair-combining logic, so if encode's real
// utf8Bytes ever regressed to CESU-8 (each surrogate half encoded as its own
// 3-byte sequence, instead of the combined 4-byte form) the reference decoder
// would make the same mistake decoding it back and the round trip would
// still read as correct - a bug and its own detector cancel out. containedBytes
// checks the RAW byte stream extracted from encode's real output against the
// host realm's own `Buffer.from(name, "utf8")`, which has no share.js code in
// it at all, so it cannot share share.js's bug.
function containsSubsequence(haystack, needle) {
  if (needle.length === 0) return true;
  for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    let match = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

test("a 2-, 3- and 4-byte UTF-8 character each round-trip through encode's byte pipeline (Q4)", () => {
  const base = parsed("(C3) G3");
  for (const [label, name] of [
    ["2-byte", "caf\u00e9"],
    ["3-byte", "\u20ac100"],
    ["4-byte", "\ud83d\ude00hi"]
  ]) {
    const seed = JSON.parse(JSON.stringify(base));
    seed.options = seed.options || {};
    seed.options.name = name;
    const str = encoded(seed);
    const bytes = refFromAlphabet(str.slice(1, str.length - 6));
    const text = refUtf8String(bytes);
    assert.ok(text !== null, `${label}: reference decode failed`);
    const recoveredName = text.split("\n")[1].split("\t")[3];
    assert.equal(recoveredName, name, `${label}: name did not survive the byte pipeline`);

    // Host-realm ground truth, independent of both share.js and the
    // reference re-implementation above (Q4 / F2).
    const expected = Array.from(Buffer.from(name, "utf8"));
    assert.ok(containsSubsequence(bytes, expected),
      `${label}: encode's real byte stream does not contain the host's own UTF-8 encoding of the name`);
  }
});

test("a truncated or malformed multi-byte sequence in the payload is refused, never repaired (Q4)", () => {
  const asciiBytes = s => s.split("").map(c => c.charCodeAt(0));
  // [PR 144 review round 1, F1] Each case MUST end with the line-3 separator
  // (0x0a) so the payload still has exactly LINES=3 lines once the malformed
  // tail is appended - otherwise decode rejects it on the line count
  // (share.js LINES check) before the bad bytes are ever looked at, and the
  // case can never fail regardless of how utf8String handles bad bytes.
  const prefix = asciiBytes("(C3) G3\n0\t\t0\tA");
  const NEWLINE = 0x0a;
  const cases = [
    ["truncated 3-byte lead", [0xe2, NEWLINE]],
    ["bad continuation after a 2-byte lead", [0xc2, 0x41, NEWLINE]],
    ["truncated 4-byte lead", [0xf0, 0x9f, NEWLINE]],
    // A skipped-check bug that just accepts the bad continuation byte and
    // merges its low 6 bits anyway (rather than rejecting) can still land on
    // a code point that happens to be printable ASCII, which would then
    // sail through core.parseSeed's name validation too and make the whole
    // link decode ok. 0xc0 is a (already-known-accepted, filed separately)
    // overlong 2-byte lead whose 5 payload bits are all zero, so the merged
    // code is just the continuation byte's low 6 bits, 0x3e here - '>',
    // printable - which is exactly the failure mode a check-skip produces.
    ["bad continuation whose bits alone spell a printable character", [0xc0, 0x3e, NEWLINE]]
  ];
  for (const [label, tail] of cases) {
    const bytes = prefix.concat(tail);
    const body = refToAlphabet(bytes);
    const head = "2" + body;
    const full = head + refChecksum(head);
    const r = share.decode(full);
    assert.equal(r.ok, false, `${label}: malformed UTF-8 was accepted`);
    assert.ok(CODES.includes(r.code), `${label}: invented code ${r.code}`);
  }
});

// [PR 144 review round 1, F1 part 2] Positive control: the identical prefix,
// terminated the same way but with no bad bytes at all, must decode ok - this
// is what proves the cases above are rejected FOR their malformed UTF-8, not
// incidentally for some other reason (line count, options shape, etc) that a
// broken tail would trip anyway.
test("the malformed-UTF-8 test's shared prefix decodes ok with no bad bytes appended (Q4 control)", () => {
  const asciiBytes = s => s.split("").map(c => c.charCodeAt(0));
  const prefix = asciiBytes("(C3) G3\n0\t\t0\tA");
  const bytes = prefix.concat([0x0a]);
  const body = refToAlphabet(bytes);
  const head = "2" + body;
  const full = head + refChecksum(head);
  const r = share.decode(full);
  assert.equal(r.ok, true, `control payload was rejected: ${r.ok ? "" : r.code}`);
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
    // The payload carries fields, not the row's text, so the string decode
    // re-parses is formatSeed's - which is the string whose reason must come
    // back unchanged. (Section 2's positional codes name the octave the parser
    // placed, so a row whose octaves were supplied by the fixture builder
    // reports against those.)
    //
    // What this gave up, so the next reader need not rediscover it: the
    // anchor used to be `parseSeed(row.string)`, an INDEPENDENT value, and it
    // stopped being a valid invariant once reasons started naming placed
    // octaves - `unvalidatedSeed` defaults a missing octave to 3, so the
    // round-tripped string legitimately reports a different sentence from the
    // row's own text. The replacement is close to tautological, since decode
    // itself does parseSeed(formatSeed(...)) and both sides now compute the
    // same string. It still catches decode COMPOSING a sentence of its own
    // instead of propagating the engine's, which is the defect the paired
    // mutant h_decode_repairs.patch injects - but it no longer catches decode
    // re-parsing the wrong string, because there is no longer an independent
    // expectation to disagree with it.
    assert.equal(r.reason, core.parseSeed(core.formatSeed(seed)).reason,
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

test("the payload's third section is where the layout delta goes", () => {
  // D14 reserved a third section behind the version byte and Phase 5 spends
  // it (D5-3): empty means no correction, so an uncorrected v2 payload still
  // looks exactly like the v1 one it replaces.
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
  // Over the CODE, not the prose: the module's own docstring names btoa in
  // order to say it does not use one, and the anchor is now the bare name.
  const code = SHARE_SRC.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  for (const api of ["btoa", "atob", "TextEncoder", "TextDecoder",
                     "CompressionStream", "DecompressionStream", "Buffer",
                     "document", "window", "localStorage"]) {
    assert.equal(new RegExp("\\b" + api + "\\b").test(code), false,
      `share.js references ${api}; section 14 forbids depending on it`);
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

/* ---------------------------------------------------------------------- */
/* (j) Phase 5 / D5: options.order travels in the share string             */
/* ---------------------------------------------------------------------- */

// D5-3: `order` rides on payload LINE 2 - the section v1 reserved for exactly
// this - as comma-separated decimal indices, empty meaning absent. The options
// line is NOT widened, so `name` keeps the last tab-separated slot to itself
// and stays the only free-text field on its line. D5-4: the wire version is 2
// and decode is backward-compatible, so every v1 link ever emitted still opens.

const vm = require("node:vm");

/** The engine as an app pinned to a DIFFERENT wire version would run it. */
function engineAtVersion(version) {
  const src = SHARE_SRC.replace(/var VERSION = \d+;/, `var VERSION = ${version};`);
  assert.ok(new RegExp(`var VERSION = ${version};`).test(src),
    "share.js no longer declares its wire version as a plain `var VERSION`");
  const sandbox = {
    console, URL, URLSearchParams, TextEncoder, TextDecoder, structuredClone,
    btoa, atob,
  };
  vm.createContext(sandbox);
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, "src", "engine", "core.js"), "utf8"), sandbox);
  vm.runInContext(src, sandbox);
  assert.equal(sandbox.HPE.share.VERSION, version);
  return sandbox.HPE.share;
}

// The alphabet's version character. Digits come first, so versions 0-9 are the
// plain decimal digit and 10 is "A"; spelled out here rather than read out of
// the module, per tests/CONTRACT.md rule 2.
const VERSION_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                      "abcdefghijklmnopqrstuvwxyz-_";

/** The non-ding field count of a seed - the length `order` must have. */
function slotCount(seed) {
  return Object.keys(seed.fields).filter(id => seed.fields[id][3] !== "ding").length;
}

function withOrder(seed, order) {
  const out = host(seed);
  out.options.order = order;
  return out;
}

function identity(n) {
  return Array.from({ length: n }, (_, i) => i);
}

/** The three payload lines inside a share string, version byte and check off. */
function payloadOf(str) {
  const body = str.slice(1, str.length - 6);
  const bytes = [];
  let bits = 0;
  let acc = 0;
  for (const ch of body) {
    acc = (acc << 6) | VERSION_CHARS.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return Buffer.from(bytes).toString("utf8").split("\n");
}

/** Build a well-formed share string, checksum and all, at any wire version. */
function forgePayload(version, lines) {
  const bytes = [...Buffer.from(lines.join("\n"), "utf8")];
  let body = "";
  let acc = 0;
  let bits = 0;
  for (const byte of bytes) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      body += VERSION_CHARS.charAt((acc >> bits) & 0x3f);
    }
  }
  if (bits > 0) body += VERSION_CHARS.charAt((acc << (6 - bits)) & 0x3f);
  const head = VERSION_CHARS.charAt(version) + body;
  let hash = 0x811c9dc5;
  for (let i = 0; i < head.length; i += 1) {
    hash = (hash ^ head.charCodeAt(i)) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const octets = [(hash >>> 24) & 0xff, (hash >>> 16) & 0xff,
                  (hash >>> 8) & 0xff, hash & 0xff];
  let check = "";
  acc = 0;
  bits = 0;
  for (const byte of octets) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      check += VERSION_CHARS.charAt((acc >> bits) & 0x3f);
    }
  }
  if (bits > 0) check += VERSION_CHARS.charAt((acc << (6 - bits)) & 0x3f);
  return head + check;
}

test("an order survives the round trip, unchanged element for element", () => {
  for (const row of OK_ROWS) {
    const seed = parsed(row.string);
    const n = slotCount(seed);
    const order = identity(n).reverse();
    const back = decoded(encoded(withOrder(seed, order)));
    assert.deepStrictEqual(back.options.order, order, `order lost for ${row.name}`);
    assert.deepStrictEqual(back.fields, seed.fields,
      `${row.name}: order disturbed the fields`);
  }
});

test("a rotation - a cyclic shift - round-trips like any other permutation", () => {
  const seed = parsed(BASE);
  const n = slotCount(seed);
  for (const by of [1, 2, n - 1]) {
    const order = identity(n).map(i => (i + by) % n);
    assert.deepStrictEqual(decoded(encoded(withOrder(seed, order))).options.order, order);
  }
});

test("an absent order round-trips as ABSENT, never as the identity", () => {
  // The reset control clears the correction, so the link has to shorten back:
  // an identity permutation on the wire would be a silent one-way door.
  const seed = parsed(BASE);
  const back = decoded(encoded(seed));
  assert.deepStrictEqual(back, seed);
  assert.equal("order" in back.options, false, "decode invented an order");
  const n = slotCount(seed);
  assert.ok(encoded(seed).length < encoded(withOrder(seed, identity(n).reverse())).length,
    "an ordered link is not longer than a default one");
});

test("clearing an order restores the byte-for-byte default share string", () => {
  const seed = parsed(BASE);
  const before = encoded(seed);
  const scrambled = encoded(withOrder(seed, identity(slotCount(seed)).reverse()));
  assert.notEqual(scrambled, before);
  const cleared = host(seed);
  cleared.options.order = null;
  assert.equal(encoded(cleared), before, "a cleared order did not shorten the link");
});

test("D5-5: an order changes the share string but never the deckId", () => {
  const seed = parsed(BASE);
  const n = slotCount(seed);
  const id = core.deckId(seed);
  const seen = new Set([encoded(seed)]);
  for (const by of [1, 2, 3]) {
    const order = identity(n).map(i => (i + by) % n);
    const str = encoded(withOrder(seed, order));
    assert.equal(seen.has(str), false, "two corrections share one string");
    seen.add(str);
    assert.equal(core.deckId(decoded(str)), id, "the deck id moved");
  }
});

test("order composes with every other option on the wire", () => {
  const n = slotCount(parsed(BASE));
  const order = identity(n).map(i => (i + 1) % n);
  for (const options of OPTION_CASES) {
    const seed = withOrder(parsed(BASE, options), order);
    assert.deepStrictEqual(decoded(encoded(seed)), seed,
      `options lost for ${JSON.stringify(options)}`);
  }
});

test("a name carrying tabs and separators still survives beside an order", () => {
  // The name is LAST on the options line precisely so it may hold anything
  // printable; adding a field before it must not change that.
  const n = slotCount(parsed(BASE));
  const seed = withOrder(parsed(BASE, { name: "1,2,3 | tabbed (D3) name" }),
                         identity(n).reverse());
  const back = decoded(encoded(seed));
  assert.equal(back.options.name, "1,2,3 | tabbed (D3) name");
  assert.deepStrictEqual(back.options.order, identity(n).reverse());
});

test("an order that is not a permutation of the field count is rejected", () => {
  const seed = parsed(BASE);
  const n = slotCount(seed);
  const bad = [
    identity(n).slice(0, n - 1),        // too short
    identity(n).concat([n]),            // too long
    identity(n - 1).concat([0]),        // a repeated index
    identity(n - 1).concat([n]),        // out of range
  ];
  for (const order of bad) {
    const r = share.decode(encoded(withOrder(seed, order)));
    assert.equal(r.ok, false, `decode accepted ${JSON.stringify(order)}`);
    assert.equal(r.code, "BAD_NOTE", `wrong code for ${JSON.stringify(order)}`);
    assert.equal(r.reason, specReason("BAD_NOTE").split("<X>").join(
      String(encoded(withOrder(seed, order))).slice(0, 12)));
  }
});

test("a malformed order FIELD is refused, never repaired", () => {
  const seed = parsed(BASE);
  for (const order of [["x"], ["-1"], [1.5], ["1;2"]]) {
    const r = share.decode(encoded(withOrder(seed, order)));
    assert.equal(r.ok, false, `decode accepted ${JSON.stringify(order)}`);
    assert.ok(CODES.includes(r.code), `invented code ${r.code}`);
  }
});

test("flipping any single character of an ordered link is rejected", () => {
  const seed = parsed(BASE, { palette: 2, name: "Amara" });
  const str = encoded(withOrder(seed, identity(slotCount(seed)).reverse()));
  for (let i = 0; i < str.length; i += 1) {
    const swap = str.charAt(i) === "A" ? "B" : "A";
    const broken = str.slice(0, i) + swap + str.slice(i + 1);
    let r;
    assert.doesNotThrow(() => { r = share.decode(broken); },
      `decode threw on a flip at ${i}`);
    assert.equal(r.ok, false, `flip at ${i} was accepted`);
    assert.ok(CODES.includes(r.code), `flip at ${i} invented code ${r.code}`);
  }
});

test("the longest possible link - every option, a full order - fits the cap", () => {
  for (const row of OK_ROWS) {
    const seed = parsed(row.string, {
      palette: 5, parent: 10, mirror: true,
      name: "A B~C 40 chars long name padded out ok!!",
    });
    const full = withOrder(seed, identity(slotCount(seed)).reverse());
    assert.ok(encoded(full).length <= share.CAPS.payload,
      `${row.name} with an order does not fit the share cap`);
  }
});

/* ---------------------------------------------------------------------- */
/* (k) D5-4: the version gate is backward-compatible                       */
/* ---------------------------------------------------------------------- */

test("the correction rides on line 2 and never widens the options line", () => {
  // The options line is tab-separated and `name` is its only free-text field.
  // Widening that line would put machine indices next to the one field a user
  // controls; line 2 was reserved for the delta, so that is where it goes.
  const seed = parsed(BASE, { palette: 3, parent: 7, mirror: true, name: "Pan" });
  const n = slotCount(seed);
  const plain = payloadOf(encoded(seed));
  const moved = payloadOf(encoded(withOrder(seed, identity(n).reverse())));

  assert.equal(plain.length, 3, "the payload is not three lines");
  assert.equal(moved.length, 3, "a correction changed the payload's line count");
  assert.equal(moved[0], plain[0], "a correction touched the scale line");
  assert.equal(moved[1], plain[1], "a correction widened the OPTIONS line");
  assert.equal(plain[1].split("\t").length, 4,
    "the options line is no longer four fields");
  assert.equal(plain[2], "", "an absent correction wrote something on line 2");
  assert.equal(moved[2], identity(n).reverse().join(","),
    "line 2 is not the correction as comma-separated decimal indices");
});

test("an uncorrected v2 payload is the v1 payload, byte for byte", () => {
  // Only the version character may differ: a bump that changed the bytes of
  // every existing link would be a format change dressed as a version bump.
  const v1 = engineAtVersion(1);
  for (const options of OPTION_CASES) {
    const seed = parsed(BASE, options);
    const older = v1.encode(seed);
    const newer = encoded(seed);
    assert.equal(older.ok, true, older.reason);
    assert.deepStrictEqual(payloadOf(newer), payloadOf(older.value),
      `v2 rewrote the payload for ${JSON.stringify(options)}`);
    assert.equal(newer.charAt(0), "2");
    assert.equal(older.value.charAt(0), "1");
  }
});

test("a v1 link carrying anything on line 2 is a corrupt payload", () => {
  // v1 RESERVED the section: an old string with content there was never
  // emitted by any shipped app, so reading it as a v2 correction would be
  // repairing a link, not decoding one.
  const seed = parsed(BASE);
  const forged = forgePayload(1, [payloadOf(encoded(seed))[0],
                                  payloadOf(encoded(seed))[1],
                                  identity(slotCount(seed)).reverse().join(",")]);
  const r = share.decode(forged);
  assert.equal(r.ok, false, "a v1 link with a layout delta was accepted");
  assert.equal(r.code, "BAD_NOTE");
});

test("this app writes wire version 2", () => {
  assert.equal(share.VERSION, 2);
  assert.equal(encoded(parsed(BASE)).charAt(0), VERSION_CHARS.charAt(share.VERSION));
});

test("a v1 link emitted by an older app still decodes here, unchanged", () => {
  // The PWA row of the plan: a link is forever. Bumping the version must not
  // turn every link ever shared into a corrupt-payload rejection.
  const v1 = engineAtVersion(1);
  for (const options of OPTION_CASES) {
    const seed = parsed(BASE, options);
    const link = v1.encode(seed);
    assert.equal(link.ok, true, `the v1 app could not encode ${JSON.stringify(options)}`);
    assert.equal(link.value.charAt(0), "1", "the fixture link is not v1");
    assert.deepStrictEqual(decoded(link.value), seed,
      `a v1 link decoded differently for ${JSON.stringify(options)}`);
  }
});

test("a v1 link carries no order and decodes as the generated default", () => {
  const v1 = engineAtVersion(1);
  const seed = parsed(BASE);
  const link = v1.encode(withOrder(seed, identity(slotCount(seed)).reverse()));
  assert.equal(link.ok, true);
  const back = decoded(link.value);
  assert.equal("order" in back.options, false,
    "a v1 link cannot carry an order, so decode must not report one");
});

test("a v2 link is NEEDS_NEWER_APP to an app pinned at v1", () => {
  const v1 = engineAtVersion(1);
  const str = encoded(parsed(BASE));
  const r = v1.decode(str);
  assert.equal(r.ok, false);
  assert.equal(r.code, "NEEDS_NEWER_APP");
  assert.equal(r.reason, specReason("NEEDS_NEWER_APP"));
});

test("a version byte above this app's is still NEEDS_NEWER_APP", () => {
  const str = encoded(parsed(BASE));
  for (const bump of [1, 2, 8]) {
    const newer = VERSION_CHARS.charAt(share.VERSION + bump) + str.slice(1);
    const r = share.decode(newer);
    assert.equal(r.ok, false);
    assert.equal(r.code, "NEEDS_NEWER_APP", `version ${share.VERSION + bump}`);
    assert.equal(r.reason, specReason("NEEDS_NEWER_APP"));
  }
});

test("a version byte BELOW the oldest format is a corrupt payload", () => {
  // No version 0 ever shipped, so a "0" byte is junk, not an old link.
  const str = encoded(parsed(BASE));
  const r = share.decode("0" + str.slice(1));
  assert.equal(r.ok, false);
  assert.equal(r.code, "BAD_NOTE");
});
