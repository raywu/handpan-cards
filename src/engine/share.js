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
 *     line 0   the canonical scale string, core.formatSeed(seed)
 *     line 1   the options, "palette \t parent \t mirror \t name"; parent is
 *              empty for "infer", mirror is "0" (right-first) or "1", and the
 *              name is last so it may hold any printable character
 *     line 2   RESERVED FOR PHASE-5 LAYOUT DELTAS. Empty in v1, and a v1
 *              string carrying anything here is a corrupt payload. The section
 *              exists so a layout delta needs only a version bump, not a new
 *              shape.
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
  // readable: see decode step 2 (D5-4). v1 = four options fields, v2 adds the
  // layout correction as the fourth of five.
  var VERSION = 2;
  var NEWEST = VERSION;   // an alias decode can still see past its own shadow
  var OLDEST = 1;         // no version 0 ever shipped

  // Max characters in a whole share string. A 19-field pan with a 40-character
  // name and a full 19-entry layout correction encodes to well under 400; the
  // cap is the first gate on decode, so an over-cap link is refused before
  // anything is parsed.
  var CAPS = { payload: 640 };

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

  function err(code, substitutions) {
    var reason = HPE.core.REASONS[code].reason;
    for (var key in substitutions) {
      if (Object.prototype.hasOwnProperty.call(substitutions, key)) {
        reason = reason.split(key).join(substitutions[key]);
      }
    }
    return { ok: false, code: code, reason: reason };
  }

  function badNote(token) {
    return err("BAD_NOTE", { "<X>": String(token).slice(0, 12) });
  }

  /* ---- bytes ------------------------------------------------------------ */

  function utf8Bytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i += 1) {
      var code = str.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
        var low = str.charCodeAt(i + 1);
        if (low >= 0xdc00 && low <= 0xdfff) {
          code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
          i += 1;
        }
      }
      if (code < 0x80) {
        bytes.push(code);
      } else if (code < 0x800) {
        bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0x10000) {
        bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f),
                   0x80 | (code & 0x3f));
      } else {
        bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f),
                   0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }
    return bytes;
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

  // The D5 layout correction, comma-separated decimal indices. Empty is
  // ABSENT - the generated layout - never the identity permutation, so
  // clearing a correction shortens the link back to what it was.
  function orderField(order) {
    if (order === undefined || order === null) return "";
    if (Object.prototype.toString.call(order) !== "[object Array]") {
      return String(order);
    }
    var parts = [];
    for (var i = 0; i < order.length; i += 1) parts.push(String(order[i]));
    return parts.join(",");
  }

  function optionsLine(options) {
    var opts = options || {};
    var palette = opts.palette === undefined || opts.palette === null
      ? 0 : opts.palette;
    var parent = opts.parent === undefined || opts.parent === null
      ? "" : opts.parent;
    var mirror = opts.mirror ? "1" : "0";
    var name = opts.name === undefined || opts.name === null ? "" : opts.name;
    // `name` stays LAST so it may hold any printable character; `order` goes in
    // ahead of it (D5-3). A build that writes v1 writes v1's four fields: the
    // options line is a per-version format, and only v2 has a correction field.
    var head = String(palette) + FIELD_SEP + String(parent) + FIELD_SEP + mirror;
    if (VERSION >= 2) head += FIELD_SEP + orderField(opts.order);
    return head + FIELD_SEP + String(name);
  }

  var UINT_RE = /^[0-9]{1,3}$/;
  var ORDER_RE = /^[0-9]{1,2}(,[0-9]{1,2})*$/;

  // One reader per wire version, so a v1 link is read by v1's rules and never
  // measured against v2's field count (D5-4). v1 has four fields and can carry
  // no correction at all; v2 has five, `order` fourth.
  function readOptionsLine(line, version) {
    var count = version >= 2 ? 5 : 4;
    var parts = String(line).split(FIELD_SEP);
    if (parts.length !== count) return null;
    if (!UINT_RE.test(parts[0])) return null;
    if (parts[1] !== "" && !UINT_RE.test(parts[1])) return null;
    if (parts[2] !== "0" && parts[2] !== "1") return null;
    var order = null;
    if (count === 5 && parts[3] !== "") {
      if (!ORDER_RE.test(parts[3])) return null;
      order = [];
      var digits = parts[3].split(",");
      for (var i = 0; i < digits.length; i += 1) order.push(Number(digits[i]));
    }
    return {
      palette: Number(parts[0]),
      parent: parts[1] === "" ? null : Number(parts[1]),
      mirror: parts[2] === "1",
      order: order,
      name: parts[count - 1]
    };
  }

  // The correction is a permutation over the non-ding fields of the seed it
  // travels with, so it can only be checked once the seed has been parsed.
  // core.parseSeed is the one seed validator and its option whitelist drops
  // `order`, so this is where the wire value is held to its meaning.
  function checkOrder(order, seed) {
    if (order === null) return true;
    var n = 0;
    var id;
    for (id in seed.fields) {
      if (!Object.prototype.hasOwnProperty.call(seed.fields, id)) continue;
      if (seed.fields[id][3] !== "ding") n += 1;
    }
    if (order.length !== n) return false;
    var seen = {};
    for (var i = 0; i < n; i += 1) {
      var slot = order[i];
      if (slot < 0 || slot >= n ||
          Object.prototype.hasOwnProperty.call(seen, String(slot))) return false;
      seen[String(slot)] = true;
    }
    return true;
  }

  /* ---- encode ----------------------------------------------------------- */

  // Takes the value of a core.parseSeed success. It does not re-validate: the
  // one validator is core.parseSeed (spec 1, "input validation lives only in
  // core.parseSeed"), and decode runs it again on the far side.
  function encode(seed) {
    if (!seed || typeof seed !== "object" || !seed.fields) return badNote(seed);
    var payload = HPE.core.formatSeed(seed.fields) + SEP +
                  optionsLine(seed.options) + SEP +
                  "";  // line 2: reserved for Phase-5 layout deltas.
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
  // approved. A correction that is not a permutation of that seed's non-ding
  // fields is a corrupt payload like any other (D5-2).
  function decode(text) {
    var carry = {};
    var result = decodeSeed(text, carry);
    if (!result.ok) return result;
    if (carry.order) {
      if (!checkOrder(carry.order, result.value)) return badNote(text);
      result.value.options.order = carry.order;
    }
    return result;
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
    // Line 2 is the reserved layout-delta section: empty in v1.
    if (lines[2] !== "") return badNote(text);

    var options = readOptionsLine(lines[1], version);
    if (options === null) return badNote(text);
    if (carry) carry.order = options.order;

    // 5. The same validator the text box uses. It rejects, never repairs, so
    //    its code and reason are propagated unchanged.
    return HPE.core.parseSeed(lines[0], options);
  }

  HPE.share = {
    encode: encode,
    decode: decode,
    VERSION: VERSION,
    CAPS: CAPS
  };
})(HPE);
