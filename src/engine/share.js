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

  var VERSION = 1;

  // Max characters in a whole share string. A 19-field pan with a 40-character
  // name encodes to well under 300; the cap is the first gate on decode, so an
  // over-cap link is refused before anything is parsed.
  var CAPS = { payload: 512 };

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

  function optionsLine(options) {
    var opts = options || {};
    var palette = opts.palette === undefined || opts.palette === null
      ? 0 : opts.palette;
    var parent = opts.parent === undefined || opts.parent === null
      ? "" : opts.parent;
    var mirror = opts.mirror ? "1" : "0";
    var name = opts.name === undefined || opts.name === null ? "" : opts.name;
    return String(palette) + FIELD_SEP + String(parent) + FIELD_SEP +
           mirror + FIELD_SEP + String(name);
  }

  var UINT_RE = /^[0-9]{1,3}$/;

  function readOptionsLine(line) {
    var parts = String(line).split(FIELD_SEP);
    if (parts.length !== 4) return null;
    if (!UINT_RE.test(parts[0])) return null;
    if (parts[1] !== "" && !UINT_RE.test(parts[1])) return null;
    if (parts[2] !== "0" && parts[2] !== "1") return null;
    return {
      palette: Number(parts[0]),
      parent: parts[1] === "" ? null : Number(parts[1]),
      mirror: parts[2] === "1",
      name: parts[3]
    };
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

  function decode(text) {
    if (typeof text !== "string") return badNote(text);

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

    var options = readOptionsLine(lines[1]);
    if (options === null) return badNote(text);

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
