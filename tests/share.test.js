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
const HPE = loadEngine(["core", "voicing", "layout", "naming", "select", "share"]);
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
test("the v4 reader's checksum is pinned against a captured minimal link (Q18)", () => {
  const seed = parsed("(C3) G3");
  assert.deepStrictEqual(decoded("4A4CpAI17Cmem2Gam2J092WIpeFI0"), seed);
  assert.equal(v4Link(seed), "4A4CpAI17Cmem2Gam2J092WIpeFI0");
});

test("the v4 reader's checksum is pinned against a captured link with every option set (Q18)", () => {
  const seed = parsed("(D3) A3 C4 D4 E4 F4 G4 A4 C5",
    { palette: 2, parent: 3, mirror: true, name: "Test Deck" });
  const link = "4A4GpAI11Co13D214D215D216D217D211D213DGeo2JC9CGam2LHbStGWH6LZQmeFYxq1W";
  assert.deepStrictEqual(decoded(link), seed);
  assert.equal(v4Link(seed), link);
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
    const segment = str.split("/")[2];
    // Host-realm ground truth, independent of share.js: the segment is the
    // name's UTF-8 bytes, every one outside the unreserved set as upper-case %XX.
    const expected = Array.from(Buffer.from(name, "utf8"))
      .map(b => (b < 0x80 && /[A-Za-z0-9\-._~]/.test(String.fromCharCode(b)))
        ? String.fromCharCode(b)
        : "%" + b.toString(16).toUpperCase().padStart(2, "0"))
      .join("");
    assert.equal(segment, expected, `${label}: the name segment is not the host's escaping of its UTF-8 bytes`);
    assert.equal(decodeURIComponent(segment), name, `${label}: the escapes do not decode to the name`);
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
  // out-of-range parent must be refused, not clamped.
  const seed = parsed(BASE);
  seed.options.parent = 11;
  const v4 = share.decode(v4Link(seed));
  assert.equal(v4.ok, false);
  assert.equal(v4.code, "BAD_NOTE");
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
  const str = v4Link(seed);
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

/** The three lines the v4 writer put in a payload, for a seed (the v4 writer is gone; the reader is not). */
function v4Lines(seed) {
  const o = seed.options || {};
  const mirrorTop = !!o.mirror;
  const mirrorBottom = o.mirrorBottom === undefined ? !!o.mirror : !!o.mirrorBottom;
  const mirror = mirrorTop === mirrorBottom ? (mirrorTop ? "1" : "0") : (mirrorTop ? "t" : "b");
  const options = [o.palette || 0, o.parent === undefined || o.parent === null ? "" : o.parent,
    mirror, o.anchor === "between" ? "1" : "0", o.name || ""].join("\t");
  const s = o.seats || {};
  const seats = ["rim", "inner", "bottom"].map(r => (s[r] || []).join(","));
  return [core.formatSeed(seed.fields), options, seats.every(x => x === "") ? "" : seats.join(";")];
}

/** What the retired v4 writer produced for a seed. */
function v4Link(seed) {
  return forgePayload(4, v4Lines(seed));
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

test("FPS: angles change the share string but never the deckId", () => {
  const seed = parsed(PYGMY);
  const id = core.deckId(seed);
  const seen = new Set([encoded(seed)]);
  const bottoms = ringCounts(seed).bottom;
  for (const first of [90, 95, 100, 105]) {
    const list = Array(bottoms).fill(null);
    list[0] = first;
    const moved = withAngles(seed, list);
    assert.equal(core.deckId(moved), id, "the deck id of the moved seed moved");
    const str = encoded(moved);
    assert.equal(seen.has(str), false, "two arrangements share one string");
    seen.add(str);
    assert.equal(core.deckId(decoded(str)), id, "the decoded deck id moved");
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
  const opts = o => encoded(parsed(PYGMY, o)).split("/").slice(3, -1).filter(x => x.startsWith("mirror"));
  assert.deepEqual(opts({}), []);
  assert.deepEqual(opts({ mirror: true }), ["mirror"]);
  assert.deepEqual(opts({ mirror: true, mirrorBottom: false }), ["mirror-top"]);
  assert.deepEqual(opts({ mirrorBottom: true }), ["mirror-bottom"]);
});

test("the anchor travels on the options line and round-trips", () => {
  const between = o => encoded(parsed(PYGMY, o)).split("/").slice(3, -1).filter(x => x === "between");
  assert.deepEqual(between({}), []);
  assert.deepEqual(between({ anchor: "between" }), ["between"]);
  const back = decoded(encoded(parsed(PYGMY, { anchor: "between" })));
  assert.equal(back.options.anchor, "between");
  assert.equal("anchor" in decoded(encoded(parsed(PYGMY))).options, false);
});

test("a v3 options line with an unknown mirror or anchor character is refused", () => {
  const payload = payloadOf(v4Link(parsed(BASE, { name: "n" })));
  for (const [mirror, anchor] of [["x", "0"], ["T", "0"], ["", "0"], ["0", "2"],
                                  ["0", ""], ["0", "b"], ["01", "0"]]) {
    const line1 = ["0", "", mirror, anchor, "n"].join("\t");
    reject(forgePayload(3, [payload[0], line1, ""]));
  }
});

test("a v1 or v2 options line cannot carry a one-ring mirror letter", () => {
  const payload = payloadOf(v4Link(parsed(BASE)));
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
  const payload = payloadOf(v4Link(parsed(BASE)));
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
  const plain = encoded(seed).split("/");
  const seats = { rim: reversedSeats(seed).rim, bottom: rotatedSeats(seed, 1).bottom };
  const moved = encoded(withSeats(seed, seats)).split("/");

  assert.equal(plain.some(x => x.startsWith("seats-")), false, "absent seats wrote a segment");
  assert.equal(moved.length, plain.length + 1);
  assert.equal(moved[1], plain[1], "seats touched the scale segment");
  assert.deepEqual(moved.slice(2, -2), plain.slice(2, -1), "seats changed another segment");
  assert.equal(moved[moved.length - 2], `seats-${seats.rim.join(",")};;${seats.bottom.join(",")}`);
});

test("this app writes wire version 6", () => {
  assert.equal(share.VERSION, 6);
  assert.equal(encoded(parsed(BASE)).charAt(0), "6");
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
  const payload = payloadOf(v4Link(seed));
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
  const payload = payloadOf(v4Link(seed));
  const oldOptions = payload[1].split("\t").filter((_, i) => i !== 3).join("\t");
  reject(forgePayload(1, [payload[0], oldOptions, identity(8).reverse().join(",")]));
});

test("a v2 link with a v3-shaped line 2 or a malformed order is corrupt", () => {
  const payload = payloadOf(v4Link(parsed(BASE)));
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
  const link = v4Link(seed);
  const v5 = share.encode(seed).value;
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
    assert.equal(share.decode(v5).ok, true);
    assert.deepEqual(calls, ["current"], "a version 5 link is read by the new grammar");
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
  const link = v4Link(core.parseSeed("(D3) A3 C4 D4 E4 F4 G4 A4 C5").value);
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
  const link = v4Link(parsed(R4E_SEED));
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
  const lines = payloadOf(v4Link(parsed(R4E_SEED)));
  assert.equal(lines.length, 3);
  assert.equal(share.decode(forgePayload(4, lines.slice(0, 2))).ok, false);
  assert.equal(share.decode(forgePayload(4, lines.concat(["x"]))).ok, false);
  assert.equal(share.decode(forgePayload(4, lines)).ok, true, "the three-line control decodes");
});

test("R4-E decode refuses an options line with the wrong number of fields, a palette or parent that is not a count", () => {
  const lines = payloadOf(v4Link(parsed(R4E_SEED)));
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

test("R4-E a 120-note pan with the rim, inner and bottom rings all reversed fits the cap and keeps every ring", () => {
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const fields = {};
  const zones = ["ding"].concat(Array(60).fill("rim"), Array(30).fill("inner"), Array(29).fill("bottom"));
  zones.forEach((zone, i) => {
    const letter = letters[i % 7];
    const octave = 1 + Math.floor(i / 7);
    fields[String(i)] = [letter, octave, 12 * (octave + 1) + (i % 7) * 2, zone, null, letter];
  });
  const ring = (from, count) => Array.from({ length: count }, (_, i) => from + count - 1 - i);
  const seats = { rim: ring(1, 60), inner: ring(61, 30), bottom: ring(91, 29) };
  const r = share.encode({
    fields,
    options: { palette: 5, parent: 10, mirror: true, anchor: "between", name: "x".repeat(40), seats },
  });
  assert.equal(r.ok, true, r.reason);
  assert.ok(r.value.length <= share.CAPS.payload, `${r.value.length} chars`);
  const seatsSeg = r.value.split("/").find(seg => seg.startsWith("seats-"));
  assert.ok(seatsSeg, "the link carries a seats option");
  const lineTwo = seatsSeg.slice(6).split(";");
  assert.equal(lineTwo.length, 3, "one list per ring");
  assert.deepEqual(lineTwo.map((s) => s.split(",").length), [60, 30, 29]);
});

/* ---------------------------------------------------------------------- */
/* SV: the v5 readable link (plan 2026-10-17-share-readable, sections 2-3) */
/* ---------------------------------------------------------------------- */

// Test-side reference for the v5 checksum and for forging links, written
// without reading anything back out of share.js.
function fnv24(text) {
  let hash = 0x811c9dc5;
  for (const byte of Buffer.from(text, "utf8")) {
    hash = (hash ^ byte) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash >>> 8).toString(16).padStart(6, "0");
}

// scale: the scale segment as written; name: "*label" or a typed name with no
// escapes; options: option segments as written. All plain ASCII, so the
// decoded text is the written text apart from "+" in a name.
function forge5(scale, name, options, check) {
  const typed = name.startsWith("*") ? "\t" : name.split("+").join(" ");
  const text = ["5", scale, typed].concat(options).join("\n");
  return ["5", scale, name].concat(options, [check === undefined ? fnv24(text) : check]).join("/");
}

const KURD_SCALE = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5";
const AMARA10_SCALE = "(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5";
const AMARA_SCALE = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
const HIJAZ_SCALE = "(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4";
const PYGMY_SCALE = "[C3] [Db3] [Eb3] (F3) G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]";

const V5_BUILTINS = [
  ["kurd", KURD_SCALE, {}, "D KURD 10",
    "5/(D3)_A3_Bb3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+10/66d9eb",
    "5/(D3)_A3_Bb3_C4_D4_E4_F4_G4_A4_C5/D+KURD+10/9fcd07"],
  ["amara10", AMARA10_SCALE, {}, "D AMARA 10",
    "5/(D3)_A3_C4_D4_E4_F4_G4_A4_C5_D5/*D+AEOLIAN+10/91ba85",
    "5/(D3)_A3_C4_D4_E4_F4_G4_A4_C5_D5/D+AMARA+10/6ceb44"],
  ["amara", AMARA_SCALE, {}, "D AMARA 9",
    "5/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+9/f0daf4",
    "5/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/D+AMARA+9/704d91"],
  ["hijaz", HIJAZ_SCALE, {}, "C# HIJAZ 9",
    "5/(Cs3)_Gs3_B3_Cs4_D4_F4_Fs4_Gs4_B4/*C%23+HIJAZ+9/fe4d19",
    "5/(Cs3)_Gs3_B3_Cs4_D4_F4_Fs4_Gs4_B4/C%23+HIJAZ+9/bc0a48"],
  ["pygmy", PYGMY_SCALE, { anchor: "between" }, "F3 LOW PYGMY 18",
    "5/uC3_uDb3_uEb3_(F3)_G3_Ab3_uBb3_C4_uDb4_Eb4_F4_G4_Ab4_C5_Eb5_-_F5_G5_uAb5/*F+AEOLIAN+12/between/78c615",
    "5/uC3_uDb3_uEb3_(F3)_G3_Ab3_uBb3_C4_uDb4_Eb4_F4_G4_Ab4_C5_Eb5_-_F5_G5_uAb5/F3+LOW+PYGMY+18/between/514b59"],
];

const seedNew = (str, options) => {
  const r = core.parseSeed(str, options);
  assert.equal(r.ok, true, `expected ${str} to parse, got ${r.code}`);
  return host(r.value);
};

const segsOf = (link) => link.split("/");
const optionSegs = (link) => segsOf(link).slice(3, -1);

test("SV: this app writes wire version 6 and keeps records at 4", () => {
  assert.equal(share.VERSION, 6);
  assert.equal(share.RECORD_VERSION, 4);
  assert.ok(encoded(parsed(BASE)).startsWith("6/"));
});

const PYGMY_BOTTOMS = 6;
const withAngles = (seed, list) => {
  const copy = host(seed);
  copy.options = Object.assign({}, copy.options, { angles: { bottom: list } });
  return copy;
};
const pygmyPlain = () => seedNew(PYGMY_SCALE, { anchor: "between" });

test("FPS: at- is the last option and appears only when an entry is set", () => {
  const plain = pygmyPlain();
  const base = encoded(plain);
  for (const none of [undefined, null, {}, { bottom: [] }, { bottom: Array(PYGMY_BOTTOMS).fill(null) }]) {
    const seed = host(plain);
    seed.options = Object.assign({}, seed.options, { angles: none });
    assert.equal(encoded(seed), base, JSON.stringify(none));
  }
  const moved = encoded(withAngles(plain, [null, 225, null, 20, null, 130]));
  assert.deepEqual(optionSegs(moved), ["between", "at-,225,,20,,130"]);
  const everything = encoded(withSeats(withAngles(seedNew(PYGMY_SCALE, {
    palette: 2, parent: 9, mirror: true, mirrorBottom: false, anchor: "between", name: "My Pan" }),
    [0, 5, 10, 15, 20, 25]), { rim: identity(9).reverse() }));
  const segs = optionSegs(everything);
  assert.equal(segs[segs.length - 1], "at-0,5,10,15,20,25");
  assert.ok(segs[segs.length - 2].startsWith("seats-"));
  assert.ok(everything.startsWith("6/"));
});

test("FPS: a deck with bottom angles encodes no bottom seats entry", () => {
  const plain = pygmyPlain();
  const angles = [null, 225, null, 20, null, 130];
  const bottom = identity(PYGMY_BOTTOMS).reverse();
  const both = encoded(withAngles(withSeats(plain, { bottom }), angles));
  assert.equal(both, encoded(withAngles(plain, angles)), "a bottom seats list was written beside at-");
  assert.equal(optionSegs(both).some(x => x.startsWith("seats-")), false);
  const rimToo = encoded(withAngles(withSeats(plain, { rim: identity(9).reverse(), bottom }), angles));
  const seatsSeg = optionSegs(rimToo).find(x => x.startsWith("seats-"));
  assert.equal(seatsSeg, `seats-${identity(9).reverse().join(",")};;`);
  const withoutAngles = encoded(withSeats(plain, { bottom }));
  assert.ok(optionSegs(withoutAngles).some(x => x === `seats-;;${bottom.join(",")}`),
    "bottom seats vanished without angles");
});

// A forged link of either version over the readable grammar.
function forgeN(version, scale, name, options, check) {
  const typed = name.startsWith("*") ? "\t" : name.split("+").join(" ");
  const text = [version, scale, typed].concat(options).join("\n");
  return [version, scale, name].concat(options, [check === undefined ? fnv24(text) : check]).join("/");
}
const PYGMY_SEG = "uC3_uDb3_uEb3_(F3)_G3_Ab3_uBb3_C4_uDb4_Eb4_F4_G4_Ab4_C5_Eb5_-_F5_G5_uAb5";

test("FPS: at- on a v5 link is BAD_NOTE, on a v6 link it is read", () => {
  const at = "at-,225,,20,,130";
  const v6 = forgeN("6", PYGMY_SEG, "*x", ["between", at]);
  const r = share.decode(v6);
  assert.equal(r.ok, true, r.reason);
  assert.deepStrictEqual(host(r.value.options.angles), { bottom: [null, 225, null, 20, null, 130] });
  const v5 = forgeN("5", PYGMY_SEG, "*x", ["between", at]);
  const bad = reject(v5);
  assert.equal(bad.code, "BAD_NOTE");
  const v5plain = forgeN("5", PYGMY_SEG, "*x", ["between"]);
  assert.equal(share.decode(v5plain).ok, true, "a v5 link without at- still opens");
});

test("FPS: a v6 link under the floor, or with a bottom seats list beside at-, is BAD_NOTE and the app imports nothing", () => {
  assert.equal(share.decode(pygmyAngled(",,,20,,")).ok, true, "the control opens");
  for (const list of ["5,,,,,", ",,,,,10", "10,,,,,", "0,,,,,", ",,,,,5"]) {
    const r = share.decode(pygmyAngled(list));
    assert.equal(r.ok, false, list);
    assert.equal(r.code, "BAD_NOTE", list);
  }
  const rimClash = share.decode(pygmyAngled("90,,,,,"));
  assert.equal(rimClash.ok, true, "a clear step opens");
  const beside = forgeN("6", PYGMY_SEG, "*x", ["between", "seats-;;5,4,3,2,1,0", "at-,,,20,,"]);
  assert.equal(reject(beside).code, "BAD_NOTE");
});

test("FPS: a v6 check is computed over the byte 6", () => {
  const options = ["between", "at-,225,,20,,130"];
  const good = forgeN("6", PYGMY_SEG, "*x", options);
  assert.equal(share.decode(good).ok, true);
  const overFive = [good.split("/").slice(0, -1).join("/"),
    fnv24(["5", PYGMY_SEG, "\t"].concat(options).join("\n"))].join("/");
  assert.notEqual(overFive, good);
  reject(overFive);
  const link = encoded(withAngles(pygmyPlain(), [null, 225, null, 20, null, 130]));
  assert.equal(link, good.replace("/*x/", "/" + link.split("/")[2] + "/").replace(/[0-9a-f]{6}$/, link.slice(-6)));
  const meaning = ["6", PYGMY_SEG, "\t"].concat(options).join("\n");
  assert.equal(link.slice(-6), fnv24(meaning));
});

test("SV: the five built-in decks' v5 links are pinned", () => {
  for (const [id, scale, options, label, auto, named] of V5_BUILTINS) {
    const plain = seedNew(scale, options);
    assert.deepStrictEqual(decoded(auto), plain, `${id} auto link decodes`);
    const typed = seedNew(scale, Object.assign({ name: label }, options));
    assert.deepStrictEqual(decoded(named), typed, `${id} named link decodes`);
  }
});

const V6_LINKS = {
  kurd: ["6/(D3)_A3_Bb3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+10/642785", "6/(D3)_A3_Bb3_C4_D4_E4_F4_G4_A4_C5/D+KURD+10/d20a36"],
  amara10: ["6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5_D5/*D+AEOLIAN+10/26725b", "6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5_D5/D+AMARA+10/91c48e"],
  amara: ["6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+9/77d0e3", "6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/D+AMARA+9/881b21"],
  hijaz: ["6/(Cs3)_Gs3_B3_Cs4_D4_F4_Fs4_Gs4_B4/*C%23+HIJAZ+9/cfebf8", "6/(Cs3)_Gs3_B3_Cs4_D4_F4_Fs4_Gs4_B4/C%23+HIJAZ+9/d7bfad"],
  pygmy: [`6/${PYGMY_SEG}/*F+AEOLIAN+12/between/a268bb`, `6/${PYGMY_SEG}/F3+LOW+PYGMY+18/between/68dd5a`],
};

test("FPS: the five built-in decks' v6 links are pinned", () => {
  for (const [id, scale, options, label, auto5, named5] of V5_BUILTINS) {
    const [auto, named] = V6_LINKS[id];
    const plain = seedNew(scale, options);
    assert.equal(encoded(plain), auto, `${id} auto link`);
    assert.deepStrictEqual(decoded(auto), plain, `${id} auto link decodes`);
    const typed = seedNew(scale, Object.assign({ name: label }, options));
    assert.equal(encoded(typed), named, `${id} named link`);
    assert.deepStrictEqual(decoded(named), typed, `${id} named link decodes`);
    for (const [v5, v6] of [[auto5, auto], [named5, named]]) {
      const a = v5.split("/");
      const b = v6.split("/");
      assert.equal(b[0], "6");
      assert.deepEqual(b.slice(1, -1), a.slice(1, -1), `${id}: only the byte and the check differ`);
      const typedName = a[2].startsWith("*") ? "\t" : a[2].split("+").join(" ").split("%23").join("#");
      const meaning = ["6", a[1], typedName].concat(a.slice(3, -1)).join("\n");
      assert.equal(b[b.length - 1], fnv24(meaning), `${id}: the check is over the byte 6`);
    }
  }
});

test("FPS: a v6 link is NEEDS_NEWER_APP to an app pinned at v5", () => {
  for (const [auto, named] of Object.values(V6_LINKS)) {
    for (const link of [auto, named]) {
      const r = engineAtVersion(5).decode(link);
      assert.equal(r.ok, false);
      assert.equal(r.code, "NEEDS_NEWER_APP");
      assert.equal(r.reason, specReason("NEEDS_NEWER_APP"));
    }
  }
});

test("SV: every option has one spelling and a default writes nothing", () => {
  const plain = encoded(seedNew(AMARA_SCALE));
  assert.equal(segsOf(plain).length, 4, "a default seed writes version, scale, name and check only");
  for (let palette = 0; palette <= 5; palette += 1) {
    const link = encoded(seedNew(AMARA_SCALE, { palette }));
    assert.deepEqual(optionSegs(link), palette === 0 ? [] : [`palette-${palette + 1}`]);
    assert.equal(decoded(link).options.palette, palette);
  }
  const slugs = ["ionian", "aeolian", "dorian", "phrygian", "lydian", "mixolydian",
                 "locrian", "harmonic-minor", "melodic-minor", "phrygian-dominant",
                 "harmonic-major"];
  slugs.forEach((slug, parent) => {
    const link = encoded(seedNew(AMARA_SCALE, { parent }));
    assert.deepEqual(optionSegs(link), [`parent-${slug}`]);
    assert.equal(decoded(link).options.parent, parent);
  });
  assert.deepEqual(optionSegs(encoded(seedNew(AMARA_SCALE, { parent: null }))), []);
  const mirrors = [
    [{ mirror: true }, ["mirror"]],
    [{ mirror: true, mirrorBottom: false }, ["mirror-top"]],
    [{ mirror: false, mirrorBottom: true }, ["mirror-bottom"]],
    [{ mirror: false, mirrorBottom: false }, []],
  ];
  for (const [options, want] of mirrors) {
    const seed = seedNew(AMARA_SCALE, options);
    const link = encoded(seed);
    assert.deepEqual(optionSegs(link), want, JSON.stringify(options));
    assert.deepEqual(HPE.layout.resolveMirrors({}, decoded(link).options),
      HPE.layout.resolveMirrors({}, seed.options));
  }
  assert.deepEqual(optionSegs(encoded(seedNew(AMARA_SCALE, { anchor: "between" }))), ["between"]);
  assert.equal(decoded(encoded(seedNew(AMARA_SCALE, { anchor: "between" }))).options.anchor, "between");
  assert.deepEqual(optionSegs(encoded(seedNew(AMARA_SCALE, { anchor: "one" }))), []);
  const seed = seedNew(AMARA_SCALE);
  const moved = encoded(withSeats(seed, { rim: identity(8).reverse() }));
  assert.deepEqual(optionSegs(moved), ["seats-7,6,5,4,3,2,1,0;;"]);
  assert.deepStrictEqual(decoded(moved).options.seats, { rim: identity(8).reverse() });
  const every = encoded(withSeats(seedNew(AMARA_SCALE, {
    palette: 2, parent: 9, mirror: true, mirrorBottom: false, anchor: "between",
    name: "My Hijaz" }), { rim: identity(8).reverse() }));
  assert.deepEqual(optionSegs(every), ["palette-3", "parent-phrygian-dominant",
    "mirror-top", "between", "seats-7,6,5,4,3,2,1,0;;"]);
  const angled = encoded(withAngles(pygmyPlain(), [null, null, 90, null, null, null]));
  assert.deepEqual(optionSegs(angled), ["between", "at-,,90,,,"]);
  assert.deepEqual(decoded(angled).options.angles, { bottom: [null, null, 90, null, null, null] });
  const all = encoded(withAngles(withSeats(seedNew(PYGMY_SCALE, {
    palette: 2, parent: 9, mirror: true, mirrorBottom: false, anchor: "between", name: "My Pan" }),
    { rim: identity(9).reverse() }), [null, 225, null, 20, null, 130]));
  assert.deepEqual(optionSegs(all), ["palette-3", "parent-phrygian-dominant", "mirror-top",
    "between", `seats-${identity(9).reverse().join(",")};;`, "at-,225,,20,,130"]);
});

const ANGLE_CASES = [null, 225, null, 20, null, 130];
const pygmyAngled = (list) => forgeN("6", PYGMY_SEG, "*x", ["between", "at-" + list]);

test("FPS: changing any angle changes the check", () => {
  const seen = new Set();
  const checkOf = (list) => encoded(withAngles(pygmyPlain(), list)).split("/").pop();
  seen.add(encoded(pygmyPlain()).split("/").pop());
  seen.add(checkOf(ANGLE_CASES));
  for (let i = 0; i < PYGMY_BOTTOMS; i += 1) {
    for (const value of [0, 5, 180, 355]) {
      if (ANGLE_CASES[i] === value) continue;
      const list = ANGLE_CASES.slice();
      list[i] = value;
      const link = encoded(withAngles(pygmyPlain(), list));
      assert.notEqual(link, encoded(withAngles(pygmyPlain(), ANGLE_CASES)), `${i}=${value}`);
      seen.add(link.split("/").pop());
      const forged = link.replace(/[0-9a-f]{6}$/, "000000");
      reject(forged);
    }
  }
  const list = ANGLE_CASES.slice();
  list[3] = null;
  assert.notEqual(checkOf(list), checkOf(ANGLE_CASES));
  assert.ok(seen.size > 20, "checks collided");
});

test("FPS: absent round-trips as absent and clearing restores the default link byte for byte", () => {
  const plain = pygmyPlain();
  const base = encoded(plain);
  const back = decoded(base);
  assert.deepStrictEqual(back, plain);
  assert.equal("angles" in back.options, false, "decode invented angles");
  assert.ok(base.length < encoded(withAngles(plain, ANGLE_CASES)).length);
  for (const empty of [undefined, null, {}, { bottom: [] }, { bottom: Array(PYGMY_BOTTOMS).fill(null) }]) {
    const cleared = host(withAngles(plain, ANGLE_CASES));
    cleared.options.angles = empty;
    assert.equal(encoded(cleared), base, JSON.stringify(empty));
  }
  const moved = withAngles(plain, ANGLE_CASES);
  assert.deepStrictEqual(decoded(encoded(moved)), moved);
});

const pygmyMirrorAngled = (list) => forgeN("6", PYGMY_SEG, "*x", ["mirror", "between", "at-" + list]);

test("FPS: a mirrored deck's at- link round-trips and is floored against the mirrored bottom ring", () => {
  const plain = seedNew(PYGMY_SCALE, { anchor: "between", mirror: true });
  const moved = withAngles(plain, [240, null, null, null, null, null]);
  const link = encoded(moved);
  assert.ok(link.includes("/mirror/"), link);
  const back = share.decode(link);
  assert.equal(back.ok, true, back.reason);
  assert.deepStrictEqual(host(back.value.options.angles), { bottom: [240, null, null, null, null, null] });
  assert.equal(back.value.options.mirror, true);
  assert.equal(share.decode(pygmyMirrorAngled("240,,,,,")).ok, true, "U1 at its mirrored home opens");
});

test("FPS: a mirrored deck's link under the floor of the mirrored ring is BAD_NOTE", () => {
  const r = share.decode(pygmyMirrorAngled("290,,,,,"));
  assert.equal(r.ok, false, "290 sits 10 degrees from the mirrored U2 at 300");
  assert.equal(r.code, "BAD_NOTE");
});

test("FPS: an at- entry with a leading zero is BAD_NOTE, one spelling per angle", () => {
  assert.equal(share.decode(pygmyAngled("90,,,,,")).ok, true);
  for (const list of ["090,,,,,", "00,,,,,", ",,,,,090", ",,,20,,0130"]) {
    const r = share.decode(pygmyAngled(list));
    assert.equal(r.ok, false, list);
    assert.equal(r.code, "BAD_NOTE", list);
  }
});

test("FPS: an at- list with a wrong length, a bad entry, a bottom seats list beside it, or out of order is BAD_NOTE", () => {
  assert.equal(share.decode(pygmyAngled(",,,20,,")).ok, true, "the control opens");
  assert.equal(share.decode(pygmyAngled(",225,,20,,130")).ok, true);
  const bads = ["5,,", "5,,,,,,", "5", "3,,,,,", "360,,,,,", "365,,,,,", "05,,,,,", "5,,,,,x", "-5,,,,,",
    "5.5,,,,,", "1000,,,,,", ",,,,,", " 5,,,,,"];
  for (const list of bads) {
    const r = share.decode(pygmyAngled(list));
    assert.equal(r.ok, false, list);
    assert.equal(r.code, "BAD_NOTE", list);
  }
  const beside = forgeN("6", PYGMY_SEG, "*x", ["between", "seats-;;5,4,3,2,1,0", "at-,,,20,,"]);
  assert.equal(reject(beside).code, "BAD_NOTE");
  const rimBeside = forgeN("6", PYGMY_SEG, "*x", ["between", "seats-8,7,6,5,4,3,2,1,0;;", "at-,,,20,,"]);
  assert.equal(share.decode(rimBeside).ok, true, "rim seats beside at- are legal");
  const noBottoms = forgeN("6", "(D3)_A3_C4_D4_E4_F4_G4_A4_C5", "*x", ["at-5"]);
  assert.equal(reject(noBottoms).code, "BAD_NOTE", "angles on a pan with no bottom notes");
  for (const order of [["at-,,,20,,", "between"], ["at-,,,20,,", "seats-8,7,6,5,4,3,2,1,0;;"]]) {
    assert.equal(reject(forgeN("6", PYGMY_SEG, "*x", order)).code, "BAD_NOTE");
  }
});

test("SV: an unknown, duplicated or out-of-order option is BAD_NOTE", () => {
  const scale = "(D3)_A3_C4_D4_E4_F4_G4_A4_C5";
  const control = forge5(scale, "*x", ["palette-3", "between"]);
  assert.equal(share.decode(control).ok, true, "the in-order control opens");
  const bads = [
    ["palette-1"], ["palette-7"], ["palette-03"], ["wobble"], ["Between"], ["parent-"],
    ["parent-nope"], ["mirror-both"], ["seats-"], ["seats-;;"], ["seats-1,0;;;"],
    ["between", "between"], ["palette-3", "palette-3"], ["mirror", "mirror-top"],
    ["between", "palette-3"], ["mirror", "palette-3"], ["parent-dorian", "palette-3"],
    ["seats-7,6,5,4,3,2,1,0;;", "between"],
  ];
  for (const options of bads) {
    reject(forge5(scale, "*x", options));
  }
  const pControl = forgeN("6", PYGMY_SEG, "*x", ["palette-3", "between", "seats-1,0,2,3,4,5,6,7,8;;", "at-,,,20,,"]);
  assert.equal(share.decode(pControl).ok, true, "the v6 in-order control opens");
  const v6bads = [
    ["at-,,,20,,", "between"], ["at-,,,20,,", "seats-1,0,2,3,4,5,6,7,8;;"],
    ["at-,,,20,,", "at-,,,20,,"], ["at-,,,20,,", "palette-3"], ["at-,,,20,,", "mirror"],
    ["between", "AT-5,,,,,"], ["between", "at5,,,,,"], ["between", "at-"],
    ["between", "at-,,,,,"], ["between", "at-,,,20,,", "at-"],
  ];
  for (const options of v6bads) {
    reject(forgeN("6", PYGMY_SEG, "*x", options));
  }
});

test("SV: a v5 link whose second character is not a slash is refused with the documented BAD_NOTE", () => {
  const link = forge5("(D3)_A3_C4_D4_E4_F4_G4_A4_C5", "*x", []);
  assert.equal(share.decode(link).ok, true, "the control opens");
  for (const second of ["x", "-", "_", "5"]) {
    const bent = "5" + second + link.slice(1);
    const r = reject(bent);
    assert.equal(r.reason, specReason("BAD_NOTE").split("<X>").join(bent.slice(0, 12)), bent);
  }
});

test("SV: a link with percent-encoded parens or underscores opens; an escaped * or + is refused", () => {
  const [, , , , auto, named] = V5_BUILTINS[0];
  const base = decoded(auto);
  assert.deepStrictEqual(decoded(auto.replace("(D3)", "%28D3%29")), base);
  assert.deepStrictEqual(decoded(auto.split("_").join("%5F")), base);
  const typed = decoded(named);
  assert.deepStrictEqual(decoded(named.replace("KURD", "KUR%44")), typed);
  assert.deepStrictEqual(decoded(named.split("+").join("%20")).options.name, "D KURD 10");
  reject(auto.replace("/*D", "/%2AD"));
  reject(named.split("+").join("%2B"));
  for (const bad of ["%", "%2", "%G0", "%2g", "%e9", "%2a"]) {
    reject(forge5("(D3)_A3_C4_D4_E4_F4_G4_A4_C5", "x" + bad, []));
  }
});

test("SV: the auto label is ignored on receipt and lies outside the checksum", () => {
  const [, , , , auto] = V5_BUILTINS[0];
  const base = decoded(auto);
  for (const label of ["whatever", "", "%ZZ", "D%2BAEOLIAN", "a b"]) {
    assert.deepStrictEqual(decoded(auto.replace("D+AEOLIAN+10", label)), base, label);
  }
  const [, , , , hijaz] = V5_BUILTINS[3];
  assert.deepStrictEqual(decoded(hijaz.replace("%23", "%2523")), decoded(hijaz));
  assert.equal(decoded(auto).options.name, "");
  const typed = V5_BUILTINS[0][5];
  const name = typed.split("/")[2];
  for (let i = 0; i < name.length; i += 1) {
    const swap = name.charAt(i) === "A" ? "B" : "A";
    const broken = typed.replace("/" + name + "/", "/" + name.slice(0, i) + swap + name.slice(i + 1) + "/");
    assert.equal(share.decode(broken).ok, false, `a flip in a typed name at ${i} was accepted`);
  }
});

test("SV: a 5 or 6 not followed by / is BAD_NOTE, and 7 or above is NEEDS_NEWER_APP", () => {
  const rest = V5_BUILTINS[0][4].slice(2);
  for (const lead of ["5", "6"]) {
    for (const second of ["A", "x", "-", "5", "0", "%", "\\"]) {
      const r = reject(lead + second + rest);
      assert.equal(r.code, "BAD_NOTE");
    }
    reject(lead + rest);
  }
  for (const version of ["7", "8", "9", "A", "z", "_"]) {
    const r = share.decode(version + "/" + rest);
    assert.equal(r.ok, false);
    assert.equal(r.code, "NEEDS_NEWER_APP", version);
  }
});

test("SV: a v5 link is NEEDS_NEWER_APP to an app pinned at v4", () => {
  for (const [, , , , auto, named] of V5_BUILTINS) {
    for (const link of [auto, named]) {
      const r = engineAtVersion(4).decode(link);
      assert.equal(r.ok, false);
      assert.equal(r.code, "NEEDS_NEWER_APP");
      assert.equal(r.reason, specReason("NEEDS_NEWER_APP"));
    }
  }
});

test("SV: the check segment is an exact 6-character lowercase string; an uppercased, 5- or 7-character check is BAD_NOTE", () => {
  const scale = "(D3)_A3_C4_D4_E4_F4_G4_A4_C5";
  const good = forge5(scale, "*x", []);
  assert.equal(share.decode(good).ok, true);
  const check = good.slice(good.lastIndexOf("/") + 1);
  const head = good.slice(0, good.lastIndexOf("/") + 1);
  assert.match(check, /^[0-9a-f]{6}$/);
  const upper = check.toUpperCase();
  const flipped = /[a-f]/.test(check) ? upper : check.replace(/[0-9]/, "a");
  for (const bad of [flipped, check.slice(1), check + "0", check + "a", "", "------", "0x" + check.slice(2)]) {
    reject(head + bad);
  }
});

test("SV: every v5 structural refusal is badNote of the whole link; a parseSeed refusal keeps its own code and reason", () => {
  const scale = "(D3)_A3_C4_D4_E4_F4_G4_A4_C5";
  const structural = [
    "5/", "5/x", "5/x/y", "5//*x/" + fnv24("5\n\n\t"),
    forge5(scale, "*x", ["between", "between"]),
    forge5(scale, "*x", [], "000000"),
    forge5(scale, "x%", []),
    forge5(scale, "", []),
    forge5(scale, "x/y", []),
  ];
  for (const link of structural) {
    const r = share.decode(link);
    assert.equal(r.ok, false, link);
    assert.deepStrictEqual(host(r), host(core.badNote(link)), link);
  }
  const link = forge5("(D3)_A3_C3", "*x", []);
  const refusal = core.parseSeed("(D3) A3 C3", { palette: 0, parent: null, mirror: false, name: "" });
  assert.equal(refusal.ok, false);
  const r = share.decode(link);
  assert.equal(r.ok, false);
  assert.equal(r.code, refusal.code);
  assert.equal(r.reason, refusal.reason);
  assert.notEqual(r.code, "BAD_NOTE");
});

test("SV: a v5 link whose scale segment is typed out of pitch order decodes to the sorted deck and shareCode writes the sorted spelling", () => {
  const sorted = share.decode(forge5("(D3)_A3_C4_D4_E4_F4_G4_A4_C5", "*x", []));
  const shuffled = share.decode(forge5("(D3)_C4_A3_D4_G4_E4_F4_C5_A4", "*x", []));
  assert.equal(sorted.ok, true);
  assert.equal(shuffled.ok, true);
  assert.deepEqual(host(shuffled.value.fields), host(sorted.value.fields));
  assert.equal(share.encode(shuffled.value).value, share.encode(sorted.value).value);
  assert.match(share.encode(shuffled.value).value, /^6\/\(D3\)_A3_C4_D4_E4_F4_G4_A4_C5\//);
});

test("SV: deckName never throws, and an out-of-range parent makes encode return BAD_NOTE", () => {
  const seed = seedNew(AMARA_SCALE);
  const deckName = HPE.select.deckName;
  assert.equal(typeof deckName, "function");
  assert.equal(deckName({ fields: seed.fields }), "D AEOLIAN 9", "a seed with no options");
  assert.equal(deckName(seed), "D AEOLIAN 9");
  assert.equal(deckName(Object.assign({}, seed, { options: { name: "Mine" } })), "Mine");
  for (const parent of [11, -1, 1.5, 100, "x", NaN]) {
    const bad = host(seed);
    bad.options.parent = parent;
    assert.doesNotThrow(() => deckName(bad), String(parent));
    assert.equal(deckName(bad), null, String(parent));
    const r = share.encode(bad);
    assert.equal(r.ok, false);
    assert.equal(r.code, "BAD_NOTE");
  }
  for (const odd of [undefined, null, 5, "x", {}, { fields: {} }]) {
    assert.doesNotThrow(() => deckName(odd));
  }
});

test("SV: every v5 and v6 link survives new URL(...).hash byte for byte", () => {
  const links = [];
  for (const [, , , , auto, named] of V5_BUILTINS) links.push(auto, named);
  const p9 = withSeats(seedNew(HIJAZ_SCALE, {
    palette: 2, parent: 9, mirror: true, mirrorBottom: false, anchor: "between",
    name: "My Hijaz" }), { rim: [1, 0, 2, 3, 4, 5, 6, 7] });
  links.push(encoded(p9));
  assert.equal(links[links.length - 1],
    "6/(Cs3)_Gs3_B3_Cs4_D4_F4_Fs4_Gs4_B4/My+Hijaz/palette-3/parent-phrygian-dominant/mirror-top/between/seats-1,0,2,3,4,5,6,7;;/bfe3d7");
  assert.equal(links.length, 11);
  for (const link of links) {
    assert.equal(new URL("https://example.test/#s=" + link).hash, "#s=" + link);
    assert.equal(share.decode(link).ok, true, link);
  }
  assert.equal(core.deckId(share.decode(links[0]).value), core.deckId(seedNew(KURD_SCALE)));
});

test("SV: deckName equals build's name for every corpus seed", () => {
  let checked = 0;
  for (const row of OK_ROWS) {
    for (const options of [undefined, { name: "Typed" }, { parent: 3 }, { parent: 0, palette: 2 }]) {
      const seed = parsed(row.string, options);
      const built = HPE.select.build(seed);
      if (!built.ok) continue;
      assert.equal(HPE.select.deckName(seed), built.value.name, `${row.name} ${JSON.stringify(options)}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 10, "the corpus loop checked nothing");
});

test("SV: the 120-note worst case fits the cap", () => {
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const fields = {};
  const zones = ["ding"].concat(Array(60).fill("rim"), Array(30).fill("inner"), Array(29).fill("bottom"));
  zones.forEach((zone, i) => {
    const letter = letters[i % 7];
    const octave = 1 + Math.floor(i / 7);
    fields[String(i)] = [letter, octave, 12 * (octave + 1) + (i % 7) * 2, zone, null, letter];
  });
  const ring = (from, count) => Array.from({ length: count }, (_, i) => from + count - 1 - i);
  const seats = { rim: ring(1, 60), inner: ring(61, 30), bottom: ring(91, 29) };
  const r = share.encode({
    fields,
    options: { palette: 5, parent: 10, mirror: true, mirrorBottom: false, anchor: "between",
               name: "/".repeat(40), seats },
  });
  assert.equal(r.ok, true, r.reason);
  assert.ok(r.value.length <= share.CAPS.payload, `${r.value.length} chars`);
  assert.ok(r.value.includes("/" + "%2F".repeat(40) + "/"), "the worst-case name is 40 escapes");
  const seg = optionSegs(r.value).find(s => s.startsWith("seats-"));
  assert.deepEqual(seg.slice(6).split(";").map(s => s.split(",").length), [60, 30, 29]);
});

test("FPS: a 120-note pan with every bottom note moved stays under the cap", () => {
  const letters = ["C", "D", "E", "F", "G", "A", "B"];
  const fields = {};
  const zones = ["ding"].concat(Array(60).fill("rim"), Array(30).fill("inner"), Array(29).fill("bottom"));
  zones.forEach((zone, i) => {
    const letter = letters[i % 7];
    const octave = 1 + Math.floor(i / 7);
    fields[String(i)] = [letter, octave, 12 * (octave + 1) + (i % 7) * 2, zone, null, letter];
  });
  const ring = (from, count) => Array.from({ length: count }, (_, i) => from + count - 1 - i);
  const seats = { rim: ring(1, 60), inner: ring(61, 30), bottom: ring(91, 29) };
  const r = share.encode({
    fields,
    options: { palette: 5, parent: 10, mirror: true, mirrorBottom: false, anchor: "between",
               name: "/".repeat(40), seats, angles: { bottom: Array(29).fill(355) } },
  });
  assert.equal(r.ok, true, r.reason);
  assert.ok(r.value.length <= share.CAPS.payload, `${r.value.length} chars`);
  const segs = optionSegs(r.value);
  assert.equal(segs.find(s => s.startsWith("seats-")).split(";")[2], "", "bottom seats written beside at-");
  assert.deepEqual(segs[segs.length - 1].slice(3).split(","), Array(29).fill("355"));
});

test("IB: a dip round-trips through share encode/decode and its scale segment puts - where the rim ends", () => {
  const plain = seedNew("(D3) A3 C4 D4 E4 | B3 F4");
  const link = encoded(plain);
  assert.equal(segsOf(link)[1], "(D3)_A3_C4_D4_E4_-_B3_F4");
  assert.deepStrictEqual(decoded(link), plain);
  const low = seedNew("[C3] (D3) A3 C4 D4 E4 [G5] | B3 F4");
  assert.equal(segsOf(encoded(low))[1], "uC3_(D3)_A3_C4_D4_E4_uG5_-_B3_F4");
  assert.deepStrictEqual(decoded(encoded(low)), low);
});


/* ---------------------------------------------------------------------- */
/* PD: built-in palette defaults (docs/plans/2026-10-26-built-in-palette-defaults.md) */
/* ---------------------------------------------------------------------- */

const PD_SCALE = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
const PD_SEG = "(D3)_A3_C4_D4_E4_F4_G4_A4_C5";
// Captured from the pre-change encoder (PD base 8b3c351c), never recomputed.
const PD_PINNED_V6 = [
  "6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/Pal/e32a93",
  "6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/Pal/palette-2/542114",
  "6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/Pal/palette-3/552116",
  "6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/Pal/palette-4/522111",
  "6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/Pal/palette-5/532113",
  "6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/Pal/palette-6/50210e",
];

test("PD: pinned v6 links for palettes 0 to 5 decode and re-encode byte for byte", () => {
  PD_PINNED_V6.forEach((link, palette) => {
    const value = decoded(link);
    assert.equal(value.options.palette, palette);
    assert.equal(encoded(value), link);
  });
});

test("PD: palettes 6 to 9 write palette-7 to palette-10, decode back and re-encode byte for byte", () => {
  for (let palette = 6; palette <= 9; palette += 1) {
    const seed = parsed(PD_SCALE, { palette, name: "Pal" });
    const link = encoded(seed);
    assert.deepEqual(link.split("/").slice(3, -1), [`palette-${palette + 1}`], `palette ${palette} spelling`);
    assert.equal(link.charAt(0), "6", "the writer stays v6");
    const back = decoded(link);
    assert.equal(back.options.palette, palette);
    assert.equal(encoded(back), link, "deterministic reshare");
    assert.equal(encoded(seed), link, "deterministic encode");
  }
});

test("PD: a v6 link reads palette-2 to palette-10 and refuses every other spelling", () => {
  for (let n = 2; n <= 10; n += 1) {
    const r = share.decode(forgeN("6", PD_SEG, "*x", [`palette-${n}`]));
    assert.equal(r.ok, true, `palette-${n}`);
    assert.equal(r.value.options.palette, n - 1);
  }
  for (const token of ["palette-0", "palette-1", "palette-01", "palette-07", "palette-010",
                       "palette-11", "palette-100", "palette--2", "palette-2.5", "palette-", "palette-+7", "Palette-7"]) {
    reject(forgeN("6", PD_SEG, "*x", [token]));
  }
  reject(forgeN("6", PD_SEG, "*x", ["palette-7", "palette-7"]));
  reject(forgeN("6", PD_SEG, "*x", ["between", "palette-7"]));
  reject(forgeN("6", PD_SEG, "*x", ["palette-7"], "000000"));
});

test("PD: a v6 palette-10 link combines with the later options in the fixed order", () => {
  const seed = parsed(PYGMY, { palette: 9, parent: 9, mirror: true, anchor: "between", name: "Pan" });
  const link = encoded(seed);
  assert.deepEqual(link.split("/").slice(3, -1).slice(0, 2), ["palette-10", "parent-phrygian-dominant"]);
  assert.equal(decoded(link).options.palette, 9);
});

test("PD: the v5 reader keeps its palette ceiling of 6 and refuses palette-7 with the whole link as payload", () => {
  for (let n = 2; n <= 6; n += 1) assert.equal(share.decode(forge5(PD_SEG, "*x", [`palette-${n}`])).ok, true);
  for (const n of [7, 8, 9, 10]) {
    const link = forge5(PD_SEG, "*x", [`palette-${n}`]);
    const r = reject(link);
    assert.deepEqual(host(r), host(core.badNote(link)), `palette-${n} names the whole link`);
  }
});

test("PD: packed v1 to v4 links with a palette above 5 keep the exact numeric BAD_NOTE payload", () => {
  const seed = parsed(BASE);
  for (const palette of [6, 7, 9, 10, 99]) {
    seed.options.palette = palette;
    const r = share.decode(v4Link(seed));
    assert.equal(r.ok, false);
    assert.deepEqual(host(r), host(core.badNote(palette)), `v4 palette ${palette}`);
  }
  seed.options.palette = 5;
  assert.equal(share.decode(v4Link(seed)).ok, true, "palette 5 still opens on v4");
  for (const version of [1, 2, 3]) {
    const opts = v4Lines(parsed(BASE, { palette: 6 }))[1].split("\t");
    const fields = version >= 3 ? opts : [opts[0], opts[1], opts[2], opts[4]];
    const r = share.decode(forgePayload(version, [core.formatLegacySeed(parsed(BASE).fields), fields.join("\t"), ""]));
    assert.equal(r.ok, false, `v${version}`);
    assert.deepEqual(host(r), host(core.badNote(6)), `v${version} payload is the numeric value`);
  }
});

test("PD: gate precedence is unchanged: cap, then version, then integrity, then payload", () => {
  const good = forgeN("6", PD_SEG, "*x", ["palette-8"]);
  assert.equal(share.decode(good).ok, true);
  assert.equal(share.decode("7" + good.slice(1)).code, "NEEDS_NEWER_APP");
  reject(good.slice(0, -1) + (good.endsWith("0") ? "1" : "0"));
  reject(forgeN("6", PD_SEG, "*" + "x".repeat(4100), ["palette-8"]));
});

test("PD: a palette 6 to 9 deck keeps the deck id of its palette 0 twin", () => {
  const base = core.deckId(parsed(PD_SCALE).fields);
  for (let palette = 6; palette <= 9; palette += 1) {
    assert.equal(core.deckId(parsed(PD_SCALE, { palette }).fields), base);
  }
});

test("ANZ: the C# Annaziska 9 and 13 share links are pinned", () => {
  const rows = [
    ["(C#3) G#3 A3 B3 C#4 D#4 E4 F#4 G#4", "C# Annaziska 9", 0,
      "6/(Cs3)_Gs3_A3_B3_Cs4_Ds4_E4_Fs4_Gs4/C%23+Annaziska+9/24f03b"],
    ["(C#3) [E3] [F#3] G#3 A3 B3 C#4 D#4 E4 F#4 G#4 [B4] [C#5]", "C# Annaziska 13", 1,
      "6/(Cs3)_uE3_uFs3_Gs3_A3_B3_Cs4_Ds4_E4_Fs4_Gs4_uB4_uCs5/C%23+Annaziska+13/palette-2/402803"],
  ];
  for (const [scale, name, palette, code] of rows) {
    const seed = seedNew(scale, { name, palette });
    assert.equal(encoded(seed), code, `${name} link`);
    assert.deepStrictEqual(decoded(code), seed, `${name} link decodes`);
  }
});

/* ---------------- section 18: wire v7 and record v5 ------------------------ */

const PSH = loadEngine(["core", "voicing", "layout", "naming", "select", "share"]);
PSH.core.PROFILE_ENABLED = true;
const PSEEDS = {
  hijaz: "(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4",
  pygmy: "[C3] [Db3] [Eb3] F3 | G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]",
  amara: "(D3) A3 C4 D4 E4 F4 G4 A4 C5",
  kurd: "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5",
  amara10: "(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5"
};
const pj = (x) => JSON.parse(JSON.stringify(x));
const pSeed = (str, opts) => {
  const base = PSH.core.parseSeed(str).value;
  const map = PSH.layout.proposeProfile(base.fields).value;
  const r = PSH.core.parseSeed(str, Object.assign({ profile: { id: "paired", rev: 1, map } }, opts));
  assert.equal(r.ok, true, r.reason);
  return r.value;
};
const hex6 = (text) => ("000000" + (core.fnv1a32(text) >>> 8).toString(16)).slice(-6);
// A hand-built readable link: the checksum is recomputed so only the rule under test can refuse it.
const craft = (version, scaleSeg, nameSeg, options) => {
  const meaning = [version, scaleSeg, nameSeg.charAt(0) === "*" ? "\t" : nameSeg].concat(options);
  return [version, scaleSeg, nameSeg].concat(options, [hex6(meaning.join("\n"))]).join("/");
};
const KURD_SEG = "(D3)_A3_Bb3_C4_D4_E4_F4_G4_A4_C5";
const KURD_PAIR = "pair-r57.r58.r60.r62.r64.r65.r67.r69.r72.-.-.-.-.-.-.-.-.-";

test("PV: the version constants are 6, 7, 4 and 5", () => {
  assert.equal(PSH.share.VERSION, 6);
  assert.equal(PSH.share.PROFILE_VERSION, 7);
  assert.equal(PSH.share.RECORD_VERSION, 4);
  assert.equal(PSH.share.PROFILE_RECORD_VERSION, 5);
});

test("PV: recordVersion is 4 for an acoustic seed and 5 for a profile seed", () => {
  for (const str of Object.values(PSEEDS)) {
    assert.equal(PSH.share.recordVersion(PSH.core.parseSeed(str).value), 4, str);
    assert.equal(PSH.share.recordVersion(pSeed(str)), 5, str);
  }
});

test("PV: a profile seed encodes at v7 with one pair- segment after parent-, an acoustic seed stays v6", () => {
  const link = PSH.share.encode(pSeed(PSEEDS.kurd, { name: "My pan", palette: 2, parent: 3 })).value;
  const segs = link.split("/");
  assert.equal(segs[0], "7");
  assert.equal(segs.filter((s) => s.startsWith("pair-")).length, 1);
  const at = (prefix) => segs.findIndex((s) => s.startsWith(prefix));
  assert.ok(at("palette-") < at("parent-") && at("parent-") < at("pair-"), link);
  assert.match(segs[at("pair-")], /^pair-(?:[rib]\d{1,3}|-)(?:\.(?:[rib]\d{1,3}|-)){17}$/);
  for (const str of Object.values(PSEEDS)) {
    const acoustic = PSH.share.encode(PSH.core.parseSeed(str).value).value;
    assert.ok(acoustic.startsWith("6/"), acoustic);
    assert.ok(!acoustic.includes("pair-"), acoustic);
  }
});

test("PV: every built-in with its proposal round-trips through v7", () => {
  for (const [id, str] of Object.entries(PSEEDS)) {
    const seed = pSeed(str);
    const enc = PSH.share.encode(seed);
    assert.equal(enc.ok, true, id);
    const back = PSH.share.decode(enc.value);
    assert.equal(back.ok, true, `${id}: ${back.code} ${back.reason}`);
    assert.deepEqual(pj(back.value.fields), pj(seed.fields), id);
    assert.deepEqual(pj(back.value.options), pj(seed.options), id);
  }
});

test("PV: 200 seeded random injective maps round-trip through v7", () => {
  let state = 987654;
  const rnd = () => { state = (state * 1103515245 + 12345) & 0x7fffffff; return state / 0x7fffffff; };
  const base = PSH.core.parseSeed(PSEEDS.pygmy).value;
  const keys = PSH.layout.proposeProfile(base.fields).value.filter(Boolean);
  for (let n = 0; n < 200; n += 1) {
    const slots = Array.from({ length: 18 }, (_, i) => i);
    for (let i = 17; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    const map = Array(18).fill(null);
    keys.forEach((k, i) => { map[slots[i]] = k; });
    const seed = PSH.core.parseSeed(PSEEDS.pygmy, { profile: { id: "paired", rev: 1, map } }).value;
    const enc = PSH.share.encode(seed);
    assert.equal(enc.ok, true);
    const back = PSH.share.decode(enc.value);
    assert.equal(back.ok, true, `${back.code} ${back.reason}`);
    assert.deepEqual(pj(back.value.options.profile.map), map);
  }
});

test("PV: an 18-note v7 link is well under the cap", () => {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const wide = Array.from({ length: 19 }, (_, i) => names[(52 + i) % 12] + (Math.floor((52 + i) / 12) - 1));
  const str = "(" + wide[0] + ") " + wide.slice(1).join(" ");
  const base = PSH.core.parseSeed(str).value;
  const map = PSH.layout.proposeProfile(base.fields).value;
  assert.equal(map.filter(Boolean).length, 18);
  const enc = PSH.share.encode(PSH.core.parseSeed(str, { profile: { id: "paired", rev: 1, map } }).value);
  assert.equal(enc.ok, true);
  assert.ok(enc.value.length < 400, String(enc.value.length));
  assert.equal(PSH.share.decode(enc.value).ok, true);
});

test("PV: every single-character flip of a v7 link is refused (the auto label is outside the check)", () => {
  const link = PSH.share.encode(pSeed(PSEEDS.pygmy, { name: "Flip me" })).value;
  assert.equal(PSH.share.decode(link).ok, true);
  for (let i = 0; i < link.length; i += 1) {
    const flipped = link.slice(0, i) + (link.charAt(i) === "x" ? "y" : "x") + link.slice(i + 1);
    assert.equal(PSH.share.decode(flipped).ok, false, `flip at ${i}: ${flipped}`);
  }
});

test("PV: with the flag off a v7 link is NEEDS_NEWER_APP, and v8 always is", () => {
  const link = PSH.share.encode(pSeed(PSEEDS.kurd)).value;
  const off = loadEngine(["core", "voicing", "layout", "naming", "select", "share"]);
  assert.equal(off.core.PROFILE_ENABLED, false);
  const r = off.share.decode(link);
  assert.equal(r.ok, false);
  assert.equal(r.code, "NEEDS_NEWER_APP");
  assert.equal(PSH.share.decode("8" + link.slice(1)).code, "NEEDS_NEWER_APP");
});

test("PV: v7 shapes the grammar forbids are BAD_NOTE, and the good crafted link decodes", () => {
  const good = craft("7", KURD_SEG, "*Label", [KURD_PAIR]);
  const ok = PSH.share.decode(good);
  assert.equal(ok.ok, true, `${ok.code} ${ok.reason}`);
  assert.equal(ok.value.options.profile.map[0], "r57");
  const refuse = (link, why) => {
    const r = PSH.share.decode(link);
    assert.equal(r.ok, false, why);
    assert.equal(r.code, "BAD_NOTE", why);
  };
  refuse(craft("7", KURD_SEG, "*Label", []), "v7 without pair-");
  refuse(craft("7", KURD_SEG, "*Label", [KURD_PAIR, KURD_PAIR]), "two pair- segments");
  refuse(craft("7", KURD_SEG, "*Label", [KURD_PAIR, "mirror"]), "mirror");
  refuse(craft("7", KURD_SEG, "*Label", [KURD_PAIR, "between"]), "between");
  refuse(craft("7", KURD_SEG, "*Label", ["mirror-top", KURD_PAIR]), "mirror-top before pair");
  refuse(craft("7", KURD_SEG, "*Label", [KURD_PAIR, "seats-1,0;;"]), "seats");
  refuse(craft("7", KURD_SEG, "*Label", [KURD_PAIR, "at-,,,,,,,,5"]), "at");
  refuse(craft("7", KURD_SEG, "*Label", [KURD_PAIR.split(".").slice(0, 17).join(".")]), "17 tokens");
  refuse(craft("7", KURD_SEG, "*Label", [KURD_PAIR.replace("r57", "x57")]), "bad token");
  assert.equal(PSH.share.decode(craft("7", KURD_SEG, "*Label", [KURD_PAIR.replace("r57", "r99")])).code, "PROFILE_MAP_INVALID");
  refuse(craft("6", KURD_SEG, "*Label", [KURD_PAIR]), "v6 with pair-");
  refuse(craft("5", KURD_SEG, "*Label", [KURD_PAIR]), "v5 with pair-");
});

test("PV: option order is palette, parent, pair, and a v6 palette-10 still parses under v7", () => {
  const ordered = craft("7", KURD_SEG, "*Label", ["palette-10", "parent-aeolian", KURD_PAIR]);
  const r = PSH.share.decode(ordered);
  assert.equal(r.ok, true, `${r.code} ${r.reason}`);
  assert.equal(r.value.options.palette, 9);
  const reversed = craft("7", KURD_SEG, "*Label", [KURD_PAIR, "palette-10"]);
  assert.equal(PSH.share.decode(reversed).ok, false);
  const v6 = PSH.share.decode(craft("6", KURD_SEG, "*Label", ["palette-10"]));
  assert.equal(v6.ok, true);
  assert.equal(v6.value.options.palette, 9);
});

test("PV: a v7 link that names a note the scale lacks reports the profile code", () => {
  const swapped = craft("7", KURD_SEG, "*Label", [KURD_PAIR.replace("r72", "r57")]);
  const r = PSH.share.decode(swapped);
  assert.equal(r.ok, false);
  assert.equal(r.code, "PROFILE_NOTE_TWICE");
  const missing = craft("7", KURD_SEG, "*Label", [KURD_PAIR.replace("r72", "-")]);
  assert.equal(PSH.share.decode(missing).code, "PROFILE_NOTE_MISSING");
});
