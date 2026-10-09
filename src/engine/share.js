/* HPE.share - the versioned share encoding for a seed (ENGINE-SPEC 14).
 *
 * Plain script, no module wrapper: index.html is a single self-contained file
 * by contract, so this text has to be inlinable verbatim. `var`, not `const`,
 * so the namespace lands on the global object of a node:vm context too.
 *
 * WHAT IS ENCODED (D14): the SEED - the canonical scale string plus the seed
 * options - never the generated deck. An old link therefore renders NEW cards
 * when the engine improves. `zone` and `angle` are never encoded: zones are
 * derived by core.parseSeed and angles are layout.solve's output.
 *
 * PURE JS (spec 14): no btoa, no host text encoder, no compression stream. The
 * bytes are hand-rolled so the engine runs identically in a browser and in a
 * node:vm realm.
 *
 * WIRE FORMAT
 *
 *     share = VERSION_CHAR + BODY + CHECK
 *
 *   VERSION_CHAR  one character, ALPHABET[VERSION]; for VERSION <= 9 that is
 *                 the decimal digit, so a v1 link starts with "1". A version
 *                 greater than this app's is NEEDS_NEWER_APP; a smaller one is
 *                 a corrupt payload, because no earlier format ever shipped.
 *   BODY          the payload text as UTF-8 bytes in the URL-safe alphabet
 *                 below, unpadded.
 *   CHECK         six alphabet characters: a 32-bit FNV-1a over
 *                 VERSION_CHAR + BODY. Flipping any single character of the
 *                 whole string - CHECK included - fails this.
 *
 * PAYLOAD TEXT: three "\n"-separated lines. "\n" cannot occur inside any of
 * them (scale strings are note tokens; a name is printable ASCII 0x20-0x7E per
 * spec 13), so the split is unambiguous.
 *
 *     line 0   the canonical scale string: core.formatSeed(seed) from v4,
 *              core.formatLegacySeed(seed) in v1 to v3 (the version tag picks
 *              the reader, never the string)
 *     line 1   the options. v1 and v2: "palette \t parent \t mirror \t name".
 *              v3: "palette \t parent \t mirror \t anchor \t name". parent is
 *              empty for "infer"; mirror is "0" or "1" (both rings alike),
 *              "t" (top ring only) or "b" (bottom ring only), and v1/v2 knew
 *              only "0" and "1"; anchor is "0" (one) or "1" (between). The
 *              name is last so it may hold any printable character.
 *     line 2   THE LAYOUT DELTA (D5-3), the section v1 reserved for it. Empty
 *              in v1, and a v1 string carrying anything here is a corrupt
 *              payload. In v2 it is the flat `order` permutation as comma-separated
 *              decimal indices. In v3 it is the per-ring seats, "rim;inner;
 *              bottom", each a comma list of the seat that ring's i-th note
 *              takes, an unmoved ring left empty. EMPTY still means absent.
 *
 * CODES: section 2's enum is CLOSED and there is no code for "corrupt link".
 * Its last row makes an unparseable token a BAD_NOTE rejection, so every
 * malformed, over-cap or checksum-failing string is BAD_NOTE naming the input,
 * exactly as core.parseSeed names an unparseable token.
 *
 * Normative source: docs/ENGINE-SPEC.md sections 1, 2, 13, 14, 17.
 */
var HPE = (typeof HPE !== "undefined") ? HPE : {};

(function (HPE) {
  "use strict";

  // The version this build WRITES. Every version <= this one is still
  // readable: see decode step 2 (D5-4). v1 = an empty line 2, v2 = a flat layout
  // order on it, v3 = per-ring seats on it and two more facts on the options
  // line (the mirror of each ring, the anchor), v4 = the same payload with the
  // scale string on line 0 in the one-line grammar (v1 to v3 hold the legacy one).
  var VERSION = 4;
  var NEWEST = VERSION;   // an alias decode can still see past its own shadow
  var OLDEST = 1;         // no version 0 ever shipped

  // Max characters in a whole share string. The cap is the first gate on
  // decode, so an over-cap link is refused before anything is parsed. It sits
  // above the longest pan the engine can express (120 notes with every ring
  // moved), which the previous 640 could not carry.
  var CAPS = { payload: 4096 };

  // URL-safe, digits FIRST so the version character of an early version is the
  // plain decimal digit. Extending the format never renumbers this.
  var ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                 "abcdefghijklmnopqrstuvwxyz-_";
  var INDEX = {};
  (function () {
    for (var i = 0; i < ALPHABET.length; i += 1) INDEX[ALPHABET.charAt(i)] = i;
  })();

  var CHECK_LEN = 6;
  var LINES = 3;
  var SEP = "\n";
  var FIELD_SEP = "\t";

  /* ---- results ---------------------------------------------------------- */

  function ok(value) {
    return { ok: true, value: value };
  }

  // Finding 10 (2026-09-30 quality-refactor plan): err/badNote/utf8Bytes now
  // live once, in HPE.core; share.js always loads after it (share.test.js
  // and every other caller's loadEngine list put "core" ahead of "share").
  function err(code, substitutions) {
    return HPE.core.err(code, substitutions);
  }

  function badNote(token) {
    return HPE.core.badNote(token);
  }

  /* ---- bytes ------------------------------------------------------------ */

  function utf8Bytes(str) {
    return HPE.core.utf8Bytes(str);
  }

  function utf8String(bytes) {
    var out = "";
    var i = 0;
    while (i < bytes.length) {
      var b = bytes[i];
      var code;
      var extra;
      if (b < 0x80) { code = b; extra = 0; }
      else if ((b & 0xe0) === 0xc0) { code = b & 0x1f; extra = 1; }
      else if ((b & 0xf0) === 0xe0) { code = b & 0x0f; extra = 2; }
      else if ((b & 0xf8) === 0xf0) { code = b & 0x07; extra = 3; }
      else return null;
      if (i + extra >= bytes.length) return null;
      for (var k = 1; k <= extra; k += 1) {
        var next = bytes[i + k];
        if ((next & 0xc0) !== 0x80) return null;
        code = (code << 6) | (next & 0x3f);
      }
      i += extra + 1;
      if (code > 0x10ffff) return null;
      if (code > 0xffff) {
        code -= 0x10000;
        out += String.fromCharCode(0xd800 + (code >> 10),
                                   0xdc00 + (code & 0x3ff));
      } else {
        out += String.fromCharCode(code);
      }
    }
    return out;
  }

  // Six-bit groups over the byte stream, unpadded.
  function toAlphabet(bytes) {
    var out = "";
    var bits = 0;
    var acc = 0;
    for (var i = 0; i < bytes.length; i += 1) {
      acc = (acc << 8) | bytes[i];
      bits += 8;
      while (bits >= 6) {
        bits -= 6;
        out += ALPHABET.charAt((acc >> bits) & 0x3f);
      }
    }
    if (bits > 0) out += ALPHABET.charAt((acc << (6 - bits)) & 0x3f);
    return out;
  }

  function fromAlphabet(str) {
    var bytes = [];
    var bits = 0;
    var acc = 0;
    for (var i = 0; i < str.length; i += 1) {
      var value = INDEX[str.charAt(i)];
      if (value === undefined) return null;
      acc = (acc << 6) | value;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        bytes.push((acc >> bits) & 0xff);
      }
    }
    return bytes;
  }

  // FNV-1a, 32 bit, over the UTF-8 bytes of the guarded text. Same construction
  // as core.deckId's hash; here it is an integrity check, not an identity.
  function checksum(text) {
    var hash = 0x811c9dc5;
    var bytes = utf8Bytes(text);
    for (var i = 0; i < bytes.length; i += 1) {
      hash = (hash ^ bytes[i]) >>> 0;
      hash = (((hash & 0xffff) * 0x01000193) +
              ((((hash >>> 16) * 0x01000193) & 0xffff) << 16)) >>> 0;
    }
    return toAlphabet([(hash >>> 24) & 0xff, (hash >>> 16) & 0xff,
                       (hash >>> 8) & 0xff, hash & 0xff]);
  }

  /* ---- the payload ------------------------------------------------------ */

  // The layout correction, per ring: "rim;inner;bottom", each ring a
  // comma-separated list of decimal seats. A ring that was not moved is empty,
  // and no ring moved at all is the empty string, so clearing a correction
  // shortens the link back to what it was.
  var RINGS = ["rim", "inner", "bottom"];

  function seatsField(seats) {
    if (!seats || typeof seats !== "object") return "";
    var parts = [];
    var any = false;
    for (var r = 0; r < RINGS.length; r += 1) {
      var list = seats[RINGS[r]];
      if (list && list.length) {
        any = true;
        parts.push(list.join(","));
      } else {
        parts.push("");
      }
    }
    return any ? parts.join(";") : "";
  }

  function optionsLine(options) {
    var opts = options || {};
    var palette = opts.palette === undefined || opts.palette === null
      ? 0 : opts.palette;
    var parent = opts.parent === undefined || opts.parent === null
      ? "" : opts.parent;
    var mirrors = HPE.layout.resolveMirrors({}, opts);
    var mirror = mirrors.top === mirrors.bottom ? (mirrors.top ? "1" : "0")
      : (mirrors.top ? "t" : "b");
    var anchor = opts.anchor === "between" ? "1" : "0";
    var name = opts.name === undefined || opts.name === null ? "" : opts.name;
    // `name` stays LAST and ALONE at the end of this line: the correction rides
    // on line 2, not here, so the one user-controlled free-text field never
    // gains a neighbour (D5-3).
    return String(palette) + FIELD_SEP + String(parent) + FIELD_SEP + mirror +
           FIELD_SEP + anchor + FIELD_SEP + String(name);
  }

  var UINT_RE = /^[0-9]{1,3}$/;
  var ORDER_RE = /^[0-9]{1,2}(,[0-9]{1,2})*$/;
  var RING_RE = /^([0-9]{1,3}(,[0-9]{1,3})*)?$/;

  // v1 and v2 spent four fields and knew mirror as 0 or 1; v3 adds the anchor
  // and the two one-ring mirror letters.
  function readOptionsLine(line, version) {
    var parts = String(line).split(FIELD_SEP);
    var v3 = version >= 3;
    if (parts.length !== (v3 ? 5 : 4)) return null;
    if (!UINT_RE.test(parts[0])) return null;
    if (parts[1] !== "" && !UINT_RE.test(parts[1])) return null;
    var m = parts[2];
    var out = {
      palette: Number(parts[0]),
      parent: parts[1] === "" ? null : Number(parts[1]),
      mirror: m === "1" || m === "t",
      name: parts[parts.length - 1]
    };
    if (m === "t") out.mirrorBottom = false;
    else if (m === "b") out.mirrorBottom = true;
    else if (m !== "0" && m !== "1") return null;
    if (m === "t" || m === "b") {
      if (!v3) return null;
    }
    if (v3) {
      if (parts[3] !== "0" && parts[3] !== "1") return null;
      if (parts[3] === "1") out.anchor = "between";
    }
    return out;
  }

  // One reader per wire version, so a v1 link is read by v1's rules and never
  // measured against a later one's (D5-4). null is ABSENT, undefined is
  // CORRUPT. A v1/v2 value is the flat order and a v3 value is per-ring seats;
  // both come back tagged so decode converts the one and checks the other
  // against the seed they travel with.
  function readDeltaLine(line, version) {
    if (version < 2) return line === "" ? null : undefined;
    if (line === "") return null;
    var i;
    if (version === 2) {
      if (!ORDER_RE.test(line)) return undefined;
      var order = [];
      var digits = line.split(",");
      for (i = 0; i < digits.length; i += 1) order.push(Number(digits[i]));
      return { order: order };
    }
    var rings = line.split(";");
    if (rings.length !== RINGS.length) return undefined;
    var seats = {};
    var any = false;
    for (i = 0; i < rings.length; i += 1) {
      if (!RING_RE.test(rings[i])) return undefined;
      if (rings[i] === "") continue;
      seats[RINGS[i]] = rings[i].split(",").map(Number);
      any = true;
    }
    return any ? { seats: seats } : undefined;
  }

  function zoneCounts(seed) {
    var counts = { rim: 0, inner: 0, bottom: 0 };
    var id;
    for (id in seed.fields) {
      if (!Object.prototype.hasOwnProperty.call(seed.fields, id)) continue;
      var zone = seed.fields[id][3];
      if (zone in counts) counts[zone] += 1;
    }
    return counts;
  }

  /* ---- encode ----------------------------------------------------------- */

  // Takes the value of a core.parseSeed success. It does not re-validate: the
  // one validator is core.parseSeed (spec 1, "input validation lives only in
  // core.parseSeed"), and decode runs it again on the far side.
  function encode(seed) {
    if (!seed || typeof seed !== "object" || !seed.fields) return badNote(seed);
    var payload = HPE.core.formatSeed(seed.fields) + SEP +
                  optionsLine(seed.options) + SEP +
                  seatsField((seed.options || {}).seats);  // line 2: the layout delta.
    var body = toAlphabet(utf8Bytes(payload));
    var head = ALPHABET.charAt(VERSION) + body;
    var out = head + checksum(head);
    if (out.length > CAPS.payload) return badNote(out);
    return ok(out);
  }

  /* ---- decode ----------------------------------------------------------- */

  // The layout correction is core's blind spot: parseSeed owns seed validation
  // and drops the option it does not know, so decode re-attaches the carried
  // value and holds it to its meaning here, against the seed parseSeed just
  // approved. A v3 seat list must be a permutation of its own ring; a v1/v2
  // flat order is converted per ring and refused if any entry crosses rings.
  function decode(text) {
    var carry = {};
    var result = decodeSeed(text, carry);
    if (!result.ok) return result;
    var counts = zoneCounts(result.value);
    var read = null;
    if (carry.delta && carry.delta.order) {
      read = HPE.layout.seatsFromOrder(carry.delta.order, counts);
    } else if (carry.delta && carry.delta.seats) {
      read = HPE.layout.readSeats(carry.delta.seats, counts);
    }
    if (read) {
      if (!read.ok) return badNote(text);
      if (read.value) result.value.options.seats = read.value;
    }
    return result;
  }

  // The scale-line reader for a link's version: 1 to 3 wrote the old grammar
  // (`/` for inner, `|` for a bottom list), 4 writes the new one. The version
  // tag decides, never the look of the string.
  function scaleLineReader(version) {
    return version <= 3 ? HPE.core.parseLegacySeed : HPE.core.parseSeed;
  }

  // The whole decode except the last step, which has to stay the bare
  // core.parseSeed call. `carry` is how the layout correction gets past that
  // call: parseSeed's option whitelist is core's, core.js is frozen, and it
  // drops any option it does not know - so the value is re-attached by decode
  // below, after parseSeed has approved everything it does own.
  function decodeSeed(text, carry) {
    if (typeof text !== "string") return badNote(text);

    // D5-4. The two version gates below are written against VERSION - and from
    // here VERSION means the version being READ, clamped to the newest this
    // build understands. Deliberately shadowing the module's VERSION (the one
    // encode WRITES): it leaves both gates reading exactly as they did in v1
    // while making every version this build knows decodable, so a v1 link
    // still opens in a v2 app and only a genuinely NEWER one is refused.
    var VERSION = Math.max(OLDEST, Math.min(INDEX[text.charAt(0)], NEWEST));

    // 1. The cap is the FIRST gate: an over-cap link is refused on length,
    //    before the version byte and before any parsing at all.
    if (text.length > CAPS.payload) return badNote(text);
    if (text.length < 1 + 1 + CHECK_LEN) return badNote(text);

    // 2. The version byte.
    var version = INDEX[text.charAt(0)];
    if (version === undefined) return badNote(text);
    if (version > VERSION) return err("NEEDS_NEWER_APP", {});
    if (version !== VERSION) return badNote(text);

    // 3. Integrity, before the payload is looked at.
    var head = text.slice(0, text.length - CHECK_LEN);
    if (text.slice(text.length - CHECK_LEN) !== checksum(head)) {
      return badNote(text);
    }

    // 4. The payload.
    var bytes = fromAlphabet(head.slice(1));
    if (bytes === null) return badNote(text);
    var payload = utf8String(bytes);
    if (payload === null) return badNote(text);

    var lines = payload.split(SEP);
    if (lines.length !== LINES) return badNote(text);

    // Line 2 is the layout-delta section: empty in v1, the correction in v2.
    // The LINE COUNT is the same in both - only what may stand here changes.
    var delta = readDeltaLine(lines[2], version);
    if (delta === undefined) return badNote(text);
    carry.delta = delta;

    var options = readOptionsLine(lines[1], version);
    if (options === null) return badNote(text);

    // 5. The same validator the text box uses. It rejects, never repairs, so
    //    its code and reason are propagated unchanged.
    return scaleLineReader(version)(lines[0], options);
  }

  HPE.share = {
    encode: encode,
    decode: decode,
    VERSION: VERSION,
    CAPS: CAPS
  };
})(HPE);
