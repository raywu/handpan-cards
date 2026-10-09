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
const HPE = loadEngine(["core", "layout", "share"]);
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
  const r = core.parseLegacySeed(str, options);
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
  // Plan section 9 reworded BAD_NOTE; ENGINE-SPEC.md is frozen history.
  if (code === "BAD_NOTE") return "<X> is not a note. Use names like C, F#, Bb, with an optional octave, e.g. (D) A Bb C.";
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
const CODES = ["NO_DING", "NO_FIFTH", "BAD_NOTE",
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
  assert.equal(encoded(seed), "4A4CpAI17Cmem2Gam2J092WIpeFI0");
});

test("encode's checksum is pinned against a captured payload with every option set (Q18)", () => {
  const seed = parsed("(D3) A3 C4 D4 E4 F4 G4 A4 C5",
    { palette: 2, parent: 3, mirror: true, name: "Test Deck" });
  assert.equal(encoded(seed),
    "4A4GpAI11Co13D214D215D216D217D211D213DGeo2JC9CGam2LHbStGWH6LZQmeFYxq1W");
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
  for (const bad of [undefined, null, 42, {}, [], "\n\n\n", "1\0\0"]) {
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
    "4A4CpAI17Cmem2Gam2J092WIpeFI0",
    "4A4GpAI11Co13D214D215D216D217D211D213DGeo2JC9CGam2LHbStGWH6LZQmeFYxq1W",
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
    const recoveredName = text.split("\n")[1].split("\t")[4];
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
  if (!ding || tokens.slice(1).some(t => t.startsWith("("))) return null;
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
    assert.equal(r.reason, core.parseSeed(core.formatSeed(seed.fields)).reason,
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
/* (j) per-ring seats travel in the share string             */
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
  vm.runInContext(
    fs.readFileSync(path.join(ROOT, "src", "engine", "layout.js"), "utf8"), sandbox);
  vm.runInContext(src, sandbox);
  assert.equal(sandbox.HPE.share.VERSION, version);
  return sandbox.HPE.share;
}

// The alphabet's version character. Digits come first, so versions 0-9 are the
// plain decimal digit and 10 is "A"; spelled out here rather than read out of
// the module, per tests/CONTRACT.md rule 2.
const VERSION_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                      "abcdefghijklmnopqrstuvwxyz-_";

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

const PYGMY = "(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5";
const RING_NAMES = ["rim", "inner", "bottom"];

function ringCounts(seed) {
  const counts = { rim: 0, inner: 0, bottom: 0 };
  for (const id of Object.keys(seed.fields)) {
    const zone = seed.fields[id][3];
    if (zone in counts) counts[zone] += 1;
  }
  return counts;
}

/** Every ring with more than one note, reversed. */
function reversedSeats(seed) {
  const counts = ringCounts(seed);
  const seats = {};
  for (const ring of RING_NAMES) {
    if (counts[ring] > 1) seats[ring] = identity(counts[ring]).reverse();
  }
  return seats;
}

function rotatedSeats(seed, by) {
  const counts = ringCounts(seed);
  const seats = {};
  for (const ring of RING_NAMES) {
    const n = counts[ring];
    if (n > 1) seats[ring] = identity(n).map(i => (i + by) % n);
  }
  return seats;
}

function withSeats(seed, seats) {
  const out = host(seed);
  out.options.seats = seats;
  return out;
}

function reject(str) {
  const r = share.decode(str);
  assert.equal(r.ok, false, `decode accepted ${str}`);
  assert.equal(r.code, "BAD_NOTE", `wrong code for ${str}`);
  return r;
}

// Three captured golden links, v1 and v2, written by the app BEFORE per-ring
// seats existed (captured from the engine at main 1f4603b, never recomputed).
const GOLDEN = {
  v1TestDeck: "1A4GpAI11Co13D214D215D216D217D211D213DGeo2JC9CGbKPNDq84HbOsiAjkBNKG",
  v1Minimal: "1A4CpAI17Cmem2Gam2Ge9bcwZm",
  v1Pygmy: "1A4OpAI17Co11OZCWGpGWHM8q84Oq84Sq845YD213DI15OZKWHZKWHpKWV213Co14OZCWHM8p849YCo14OZGWGM8r2Z092J09K7bdRNaAj3GeVm",
  v2TestDeck: "2A4GpAI11Co13D214D215D216D217D211D213DGeo2JC9CGbKPNDq84HbOsiAlM3pN0",
  v2Minimal: "2A4CpAI17Cmem2Gam2GeOUlLJ0",
  v2Pygmy: "2A4OpAI17Co11OZCWGpGWHM8q84Oq84Sq845YD213DI15OZKWHZKWHpKWV213Co14OZCWHM8p849YCo14OZGWGM8r2Z092J09K7bdRNaAz020NW",
  v2Bent: "2A4GpAI11Co13D214D215D216D217D211D213DGen2Gan2K9bRdGADomsB3KiD2mpB38iCImmkALkb0",
  v2Moved: "2A4OpAI17Co11OZCWGpGWHM8q84Oq84Sq845YD213DI15OZKWHZKWHpKWV213Co14OZCWHM8p849YCo14OZGWGM8r2ZG92J09JMzsPMGACImoB3CiD2mrB3OiDomuB3aiCJ0iC2mnCYmnComnD2mnDImnDYmnCGX-oii0",
};

test("seats survive the round trip, ring by ring", () => {
  for (const row of OK_ROWS) {
    const seed = parsed(row.string);
    const seats = reversedSeats(seed);
    const back = decoded(encoded(withSeats(seed, seats)));
    if (Object.keys(seats).length === 0) {
      assert.equal("seats" in back.options, false);
      continue;
    }
    assert.deepStrictEqual(back.options.seats, seats, `seats lost for ${row.name}`);
    assert.deepStrictEqual(back.fields, seed.fields,
      `${row.name}: seats disturbed the fields`);
  }
});

test("a seat list for one ring alone round-trips without inventing the others", () => {
  const seed = parsed(PYGMY);
  for (const ring of ["rim", "bottom"]) {
    const only = { [ring]: reversedSeats(seed)[ring] };
    assert.deepStrictEqual(decoded(encoded(withSeats(seed, only))).options.seats, only);
  }
});

test("a rotation round-trips like any other seat list", () => {
  const seed = parsed(PYGMY);
  const n = ringCounts(seed).rim;
  for (const by of [1, 2, n - 1]) {
    const seats = rotatedSeats(seed, by);
    assert.deepStrictEqual(decoded(encoded(withSeats(seed, seats))).options.seats, seats);
  }
});

test("absent seats round-trip as ABSENT, never as the identity", () => {
  const seed = parsed(BASE);
  const back = decoded(encoded(seed));
  assert.deepStrictEqual(back, seed);
  assert.equal("seats" in back.options, false, "decode invented seats");
  assert.ok(encoded(seed).length < encoded(withSeats(seed, reversedSeats(seed))).length,
    "a moved link is not longer than a default one");
});

test("clearing seats restores the byte-for-byte default share string", () => {
  const seed = parsed(BASE);
  const before = encoded(seed);
  assert.notEqual(encoded(withSeats(seed, reversedSeats(seed))), before);
  for (const empty of [null, undefined, {}]) {
    const cleared = host(seed);
    cleared.options.seats = empty;
    assert.equal(encoded(cleared), before, "cleared seats did not shorten the link");
  }
});

test("D5-5: seats change the share string but never the deckId", () => {
  const seed = parsed(BASE);
  const id = core.deckId(seed);
  const seen = new Set([encoded(seed)]);
  for (const by of [1, 2, 3]) {
    const str = encoded(withSeats(seed, rotatedSeats(seed, by)));
    assert.equal(seen.has(str), false, "two arrangements share one string");
    seen.add(str);
    assert.equal(core.deckId(decoded(str)), id, "the deck id moved");
  }
});

test("seats compose with every other option on the wire", () => {
  const seats = rotatedSeats(parsed(BASE), 1);
  for (const options of OPTION_CASES) {
    const seed = withSeats(parsed(BASE, options), seats);
    assert.deepStrictEqual(decoded(encoded(seed)), seed,
      `options lost for ${JSON.stringify(options)}`);
  }
});

test("a name carrying tabs and separators still survives beside seats", () => {
  const seed = withSeats(parsed(BASE, { name: "1,2;3 | tabbed (D3) name" }),
                         reversedSeats(parsed(BASE)));
  const back = decoded(encoded(seed));
  assert.equal(back.options.name, "1,2;3 | tabbed (D3) name");
  assert.deepStrictEqual(back.options.seats, reversedSeats(parsed(BASE)));
});

test("a name of every printable character survives beside an anchor", () => {
  let all = "";
  for (let c = 0x21; c <= 0x7e; c += 1) all += String.fromCharCode(c);
  const seed = parsed(BASE, { name: all.slice(0, 40), anchor: "between" });
  const back = decoded(encoded(seed));
  assert.equal(back.options.name, all.slice(0, 40));
  assert.equal(back.options.anchor, "between");
  const tail = parsed(BASE, { name: all.slice(40, 80), anchor: "between" });
  assert.equal(decoded(encoded(tail)).options.name, all.slice(40, 80));
});

test("mirror travels as 0, 1, t or b: each ring's own value survives", () => {
  const cases = [
    [{}, {}],
    [{ mirror: true }, { mirror: true }],
    [{ mirror: true, mirrorBottom: false }, { mirror: true, mirrorBottom: false }],
    [{ mirror: false, mirrorBottom: true }, { mirror: false, mirrorBottom: true }],
  ];
  for (const [input, want] of cases) {
    const seed = parsed(PYGMY, input);
    const back = decoded(encoded(seed));
    const mirrors = HPE.layout.resolveMirrors({}, back.options);
    const expect = HPE.layout.resolveMirrors({}, Object.assign({}, seed.options, want));
    assert.deepStrictEqual(mirrors, expect, JSON.stringify(input));
  }
});

test("an explicit mirrorBottom equal to the top value normalises away", () => {
  const same = encoded(parsed(PYGMY, { mirror: true, mirrorBottom: true }));
  assert.equal(same, encoded(parsed(PYGMY, { mirror: true })));
  const back = decoded(same);
  assert.equal("mirrorBottom" in back.options, false);
});

test("the one-ring mirror letters are exactly t and b on the options line", () => {
  const line = o => payloadOf(encoded(parsed(PYGMY, o)))[1].split("\t");
  assert.equal(line({})[2], "0");
  assert.equal(line({ mirror: true })[2], "1");
  assert.equal(line({ mirror: true, mirrorBottom: false })[2], "t");
  assert.equal(line({ mirrorBottom: true })[2], "b");
});

test("the anchor travels on the options line and round-trips", () => {
  const plain = payloadOf(encoded(parsed(PYGMY)))[1].split("\t");
  const between = payloadOf(encoded(parsed(PYGMY, { anchor: "between" })))[1].split("\t");
  assert.equal(plain.length, 5);
  assert.equal(plain[3], "0");
  assert.equal(between[3], "1");
  const back = decoded(encoded(parsed(PYGMY, { anchor: "between" })));
  assert.equal(back.options.anchor, "between");
  assert.equal("anchor" in decoded(encoded(parsed(PYGMY))).options, false);
});

test("a v3 options line with an unknown mirror or anchor character is refused", () => {
  const payload = payloadOf(encoded(parsed(BASE, { name: "n" })));
  for (const [mirror, anchor] of [["x", "0"], ["T", "0"], ["", "0"], ["0", "2"],
                                  ["0", ""], ["0", "b"], ["01", "0"]]) {
    const line1 = ["0", "", mirror, anchor, "n"].join("\t");
    reject(forgePayload(3, [payload[0], line1, ""]));
  }
});

test("a v1 or v2 options line cannot carry a one-ring mirror letter", () => {
  const payload = payloadOf(encoded(parsed(BASE)));
  for (const version of [1, 2]) {
    for (const mirror of ["t", "b"]) {
      reject(forgePayload(version, [payload[0], ["0", "", mirror, "n"].join("\t"), ""]));
    }
  }
});

test("seats that do not permute their own ring are rejected", () => {
  const seed = parsed(PYGMY);
  const n = ringCounts(seed).rim;
  const bad = [
    identity(n).slice(0, n - 1),
    identity(n).concat([n]),
    identity(n - 1).concat([0]),
    identity(n - 1).concat([n]),
  ];
  for (const rim of bad) {
    const str = encoded(withSeats(seed, { rim }));
    const r = reject(str);
    assert.equal(r.reason, specReason("BAD_NOTE").split("<X>").join(str.slice(0, 12)));
  }
});

test("a seat naming a note of another ring is rejected, not repaired", () => {
  const seed = parsed(PYGMY);
  const { rim, bottom } = ringCounts(seed);
  const crossed = identity(rim).concat([]);
  crossed[0] = rim;
  reject(encoded(withSeats(seed, { rim: crossed })));
  const low = identity(bottom);
  low[0] = bottom + rim;
  reject(encoded(withSeats(seed, { bottom: low })));
});

test("a seat list for a ring the pan does not have is rejected", () => {
  reject(encoded(withSeats(parsed(BASE), { inner: [0, 1] })));
  reject(encoded(withSeats(parsed(BASE), { bottom: [0] })));
});

test("a malformed seats FIELD is refused, never repaired", () => {
  const payload = payloadOf(encoded(parsed(BASE)));
  for (const delta of ["x;;", "-1;;", "1.5;;", "0,1", ";;;", ";;", ";", ",;;",
                       "0,;;", "7,6,5,4,3,2,1,0", "7,6,5,4,3,2,1,0;;;"]) {
    reject(forgePayload(3, [payload[0], payload[1], delta]));
  }
});

test("flipping any single character of a moved link is rejected", () => {
  const seed = parsed(BASE, { palette: 2, name: "Amara" });
  const str = encoded(withSeats(seed, reversedSeats(seed)));
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

test("the longest possible link - every option, every ring moved - fits the cap", () => {
  for (const row of OK_ROWS.concat([{ name: "pygmy", string: PYGMY }])) {
    const seed = parsed(row.string, {
      palette: 5, parent: 10, mirror: true, mirrorBottom: false, anchor: "between",
      name: "A B~C 40 chars long name padded out ok!!",
    });
    const full = withSeats(seed, reversedSeats(seed));
    assert.ok(encoded(full).length <= share.CAPS.payload,
      `${row.name} with seats does not fit the share cap`);
  }
});

test("a 120-note pan with every note moved still fits the cap", () => {
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const fields = {};
  for (let i = 0; i < 120; i += 1) {
    const letter = letters[i % 7];
    const octave = 1 + Math.floor(i / 7);
    fields[String(i)] = [letter, octave, 12 * (octave + 1) + (i % 7) * 2,
                         i === 0 ? "ding" : "rim", null, letter];
  }
  const seat = Array.from({ length: 119 }, (_, i) => 118 - i);
  const r = share.encode({
    fields,
    options: { palette: 5, parent: 10, mirror: true, anchor: "between",
               name: "x".repeat(40), seats: { rim: seat } },
  });
  assert.equal(r.ok, true, r.reason);
  assert.ok(r.value.length <= share.CAPS.payload, `${r.value.length} chars`);
});

test("a link over the cap is refused on length alone", () => {
  assert.equal(share.CAPS.payload, 4096);
  reject("3" + "A".repeat(share.CAPS.payload));
});

/* ---------------------------------------------------------------------- */
/* (k) the version gate is backward-compatible                             */
/* ---------------------------------------------------------------------- */

test("per-ring seats ride on line 2 as rim;inner;bottom", () => {
  const seed = parsed(PYGMY, { palette: 3, parent: 7, mirror: true, name: "Pan" });
  const plain = payloadOf(encoded(seed));
  const seats = { rim: reversedSeats(seed).rim, bottom: rotatedSeats(seed, 1).bottom };
  const moved = payloadOf(encoded(withSeats(seed, seats)));

  assert.equal(plain.length, 3);
  assert.equal(moved.length, 3);
  assert.equal(moved[0], plain[0], "seats touched the scale line");
  assert.equal(moved[1], plain[1], "seats widened the OPTIONS line");
  assert.equal(plain[1].split("\t").length, 5);
  assert.equal(plain[2], "", "absent seats wrote something on line 2");
  assert.equal(moved[2], `${seats.rim.join(",")};;${seats.bottom.join(",")}`);
});

test("this app writes wire version 4", () => {
  assert.equal(share.VERSION, 4);
  assert.equal(encoded(parsed(BASE)).charAt(0), "4");
  assert.equal(encoded(parsed(BASE)).charAt(0), VERSION_CHARS.charAt(share.VERSION));
});

test("a v1 link emitted by an older app still decodes here, deck unchanged", () => {
  assert.deepStrictEqual(decoded(GOLDEN.v1TestDeck),
    parsed(MAKER_STRINGS[2], { palette: 2, parent: 3, mirror: true, name: "Test Deck" }));
  assert.deepStrictEqual(decoded(GOLDEN.v1Minimal), parsed("(C3) G3"));
  assert.deepStrictEqual(decoded(GOLDEN.v1Pygmy), parsed(PYGMY, { name: "Pygmy" }));
});

test("a v2 link emitted by an older app still decodes here, deck unchanged", () => {
  assert.deepStrictEqual(decoded(GOLDEN.v2TestDeck),
    parsed(MAKER_STRINGS[2], { palette: 2, parent: 3, mirror: true, name: "Test Deck" }));
  assert.deepStrictEqual(decoded(GOLDEN.v2Minimal), parsed("(C3) G3"));
  assert.deepStrictEqual(decoded(GOLDEN.v2Pygmy), parsed(PYGMY, { name: "Pygmy" }));
});

test("a v2 flat order is converted to per-ring seats on decode", () => {
  const bent = decoded(GOLDEN.v2Bent);
  assert.deepStrictEqual(bent.options.seats, { rim: [7, 6, 5, 4, 3, 2, 1, 0] });
  assert.equal("order" in bent.options, false);
  assert.equal(bent.options.name, "Bent");
  const moved = decoded(GOLDEN.v2Moved);
  assert.deepStrictEqual(moved.options.seats, {
    rim: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0],
    bottom: [1, 2, 3, 4, 5, 0],
  });
  assert.deepStrictEqual(moved.fields, parsed(PYGMY).fields);
});

test("a v2 flat order that crosses rings is refused", () => {
  const seed = parsed(PYGMY);
  const n = 17;
  const swapAcross = identity(n);
  swapAcross[0] = 16;
  swapAcross[16] = 0;
  const payload = payloadOf(encoded(seed));
  payload[0] = core.formatLegacySeed(seed);
  const r = reject(forgePayload(2, [payload[0], payload[1].split("\t")
    .filter((_, i) => i !== 3).join("\t"), swapAcross.join(",")]));
  assert.equal(r.ok, false);
  const reversedAll = identity(n).reverse();
  reject(forgePayload(2, [payload[0], payload[1].split("\t")
    .filter((_, i) => i !== 3).join("\t"), reversedAll.join(",")]));
});

test("a v1 link carrying anything on line 2 is a corrupt payload", () => {
  const seed = parsed(BASE);
  const payload = payloadOf(encoded(seed));
  const oldOptions = payload[1].split("\t").filter((_, i) => i !== 3).join("\t");
  reject(forgePayload(1, [payload[0], oldOptions, identity(8).reverse().join(",")]));
});

test("a v2 link with a v3-shaped line 2 or a malformed order is corrupt", () => {
  const payload = payloadOf(encoded(parsed(BASE)));
  const oldOptions = payload[1].split("\t").filter((_, i) => i !== 3).join("\t");
  reject(forgePayload(2, [payload[0], oldOptions, "7,6,5,4,3,2,1,0;;"]));
  reject(forgePayload(2, [payload[0], oldOptions, "x"]));
  reject(forgePayload(2, [payload[0], oldOptions, "0,1"]));
});

test("a v3 link is NEEDS_NEWER_APP to an app pinned at v2 or v1", () => {
  const str = encoded(parsed(BASE));
  for (const pinned of [1, 2]) {
    const r = engineAtVersion(pinned).decode(str);
    assert.equal(r.ok, false);
    assert.equal(r.code, "NEEDS_NEWER_APP");
    assert.equal(r.reason, specReason("NEEDS_NEWER_APP"));
  }
});

test("a v2 link is NEEDS_NEWER_APP to an app pinned at v1", () => {
  const r = engineAtVersion(1).decode(GOLDEN.v2TestDeck);
  assert.equal(r.ok, false);
  assert.equal(r.code, "NEEDS_NEWER_APP");
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

/* ---------------- Lane L0: the scale-line reader is chosen by version ------ */

test("decode chooses its scale-line reader from the version", () => {
  const seed = core.parseSeed("(D3) A3 C4 D4 E4 F4 G4 A4 C5").value;
  const link = share.encode(seed).value;
  const v3 = forgePayload(3, [core.formatLegacySeed(seed), ...payloadOf(link).slice(1)]);
  const realLegacy = core.parseLegacySeed;
  const realSeed = core.parseSeed;
  const calls = [];
  core.parseLegacySeed = (...a) => { calls.push("legacy"); return realLegacy(...a); };
  core.parseSeed = (...a) => { calls.push("current"); return realSeed(...a); };
  try {
    assert.equal(share.decode(link).ok, true);
    assert.deepEqual(calls, ["current"], "a version 4 link is read by the new grammar");
    calls.length = 0;
    assert.equal(share.decode(v3).ok, true);
    assert.deepEqual(calls, ["legacy"], "a version 3 link is read by the legacy grammar");
  } finally {
    core.parseLegacySeed = realLegacy;
    core.parseSeed = realSeed;
  }
});

test("a version 3 link with a bar opens with bottom notes", () => {
  const old = core.parseLegacySeed("(D3) A3 C4 D4 E4 F4 G4 A4 C5 | C3 Eb3").value;
  const link = share.encode(core.parseSeed("(D3) A3 C4 D4 E4 F4 G4 A4 C5").value).value;
  const v3 = forgePayload(3, [core.formatLegacySeed(old), ...payloadOf(link).slice(1)]);
  const res = share.decode(v3);
  assert.equal(res.ok, true);
  const zones = {};
  for (const f of Object.values(res.value.fields)) zones[f[3]] = (zones[f[3]] || 0) + 1;
  assert.equal(zones.bottom, 2);
  assert.equal(zones.inner, undefined);
});

/* ------------------------------------------------ R4-E: refusals -------- */

const R4E_SEED = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
const sealed = (head) => head + refChecksum(head);

test("R4-E decode refuses a version byte outside the alphabet and a body character outside it, even under a valid check", () => {
  const link = encoded(parsed(R4E_SEED));
  assert.equal(share.decode("~" + link.slice(1)).ok, false, "a version byte that is not in the alphabet");
  assert.equal(share.decode("~" + link.slice(1)).code, "BAD_NOTE");
  const head = link.slice(0, link.length - 6);
  const at = head.indexOf("0", 1);
  assert.ok(at > 0, "fixture assumption: the body holds a 0 to swap");
  const forged = sealed(head.slice(0, at) + "~" + head.slice(at + 1));
  const r = share.decode(forged);
  assert.equal(r.ok, false, "a body character outside the alphabet is refused, not read as 0");
  assert.equal(r.code, "BAD_NOTE");
});

test("R4-E decode refuses a payload of two or four lines", () => {
  const lines = payloadOf(encoded(parsed(R4E_SEED)));
  assert.equal(lines.length, 3);
  assert.equal(share.decode(forgePayload(4, lines.slice(0, 2))).ok, false);
  assert.equal(share.decode(forgePayload(4, lines.concat(["x"]))).ok, false);
  assert.equal(share.decode(forgePayload(4, lines)).ok, true, "the three-line control decodes");
});

test("R4-E decode refuses an options line with the wrong number of fields, a palette or parent that is not a count", () => {
  const lines = payloadOf(encoded(parsed(R4E_SEED)));
  const parts = lines[1].split("\t");
  assert.equal(parts.length, 5);
  const without = (line1) => share.decode(forgePayload(4, [lines[0], line1, lines[2]]));
  assert.equal(without(parts.join("\t")).ok, true, "control");
  assert.equal(without(parts.slice(1).join("\t")).ok, false, "four fields at version 4");
  assert.equal(without(parts.concat(["x"]).join("\t")).ok, false, "six fields");
  assert.equal(without(["x"].concat(parts.slice(1)).join("\t")).ok, false, "a palette that is not a count");
  assert.equal(without([parts[0], "x"].concat(parts.slice(2)).join("\t")).ok, false, "a parent that is not a count");
  assert.equal(without(["1000"].concat(parts.slice(1)).join("\t")).ok, false, "a palette of four digits");
});

test("R4-E encode refuses a value that is not a seed, writes a seed with no options as the defaults, and refuses an over-cap link", () => {
  for (const bad of [undefined, null, "x", 5, {}]) {
    const r = share.encode(bad);
    assert.equal(r.ok, false);
    assert.equal(r.code, "BAD_NOTE");
  }
  const seed = parsed(R4E_SEED);
  const bare = { fields: seed.fields };
  assert.equal(share.encode(bare).value, share.encode({ fields: seed.fields, options: {} }).value);
  const huge = { fields: seed.fields, options: { name: "x".repeat(share.CAPS.payload) } };
  const over = share.encode(huge);
  assert.equal(over.ok, false);
  assert.equal(over.code, "BAD_NOTE");
});
