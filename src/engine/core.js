/* HPE.core - the D13 seed parser shared by every engine lane and by the app.
 *
 * Plain script, no module wrapper: index.html is a single self-contained file
 * by contract, so this text has to be inlinable verbatim. `var`, not `const`,
 * so the namespace lands on the global object of a node:vm context too.
 *
 * Normative source: docs/ENGINE-SPEC.md sections 1-4, 12, 13, 16 and 17.
 */
var HPE = (typeof HPE !== "undefined") ? HPE : {};

(function (HPE) {
  "use strict";

  /* ---- section 2: the code enum and its reason strings, verbatim -------- */

  var REASONS = {
    NO_DING: {
      kind: "error",
      reason: "No ding. Start with the ding note, e.g. (D) or D/."
    },
    NO_FIFTH: {
      kind: "error",
      reason: "No perfect fifth above the ding <X>. Add a <fifth of X>, or check the ding."
    },
    TOO_MANY_RIM: {
      kind: "error",
      reason: "Too many notes for one pan: at most 11 rim, 2 inner and 6 bottom."
    },
    BAD_NOTE: {
      kind: "error",
      reason: "<X> is not a note. Use names like C, F#, Bb, with an optional octave."
    },
    NEEDS_NEWER_APP: {
      kind: "error",
      reason: "This link needs a newer version of the app. Reload."
    },
    NO_THIRDS: {
      kind: "warning",
      reason: "No 3rds on this pan: only power chords and sus chords."
    }
  };

  var LETTERS = "CDEFGAB";
  var SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var ACCIDENTAL = { "": 0, "#": 1, b: -1 };

  var RIM_MAX = 11;
  var INNER_MAX = 2;
  var BOTTOM_MAX = 6;
  var TOP_MAX = RIM_MAX + INNER_MAX;

  var NOTE_RE = /^([A-G])(#|b)?([0-9])?$/;
  var DEFAULT_OPTIONS = { palette: 0, parent: null, name: "", mirror: false };

  /* ---- small helpers ---------------------------------------------------- */

  function pitchClass(midi) {
    return ((midi % 12) + 12) % 12;
  }

  // Section 3: midi = 12 * (octave + 1) + letter + accidental, letter-anchored,
  // so Cb4 is 59 and B#3 is 60.
  function midiFromName(letter, accidental, octave) {
    return 12 * (octave + 1) + SEMITONES[letter] + ACCIDENTAL[accidental || ""];
  }

  // The octave the formula implies for this spelling at this midi, so an
  // inferred Cb prints as Cb4 and never as Cb3.
  function octaveOf(letter, accidental, midi) {
    return (midi - SEMITONES[letter] - ACCIDENTAL[accidental || ""]) / 12 - 1;
  }

  function spell(letter, accidental) {
    return letter + (accidental || "");
  }

  function accidentalString(offset) {
    if (offset === 0) return "";
    return new Array(Math.abs(offset) + 1).join(offset > 0 ? "#" : "b");
  }

  // Section 2: the fifth above X is the letter four steps up carrying whatever
  // accidental makes the interval a perfect fifth (G for C, Ab for Db, F# for
  // B, Cb for Fb, E# for A#).
  function fifthName(letter, accidental) {
    var up = LETTERS.charAt((LETTERS.indexOf(letter) + 4) % 7);
    var natural = ((SEMITONES[up] - SEMITONES[letter]) % 12 + 12) % 12;
    return up + accidentalString(ACCIDENTAL[accidental || ""] + (7 - natural));
  }

  function ok(value) {
    return { ok: true, value: value };
  }

  function err(code, substitutions) {
    var reason = REASONS[code].reason;
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

  /* ---- tokenising ------------------------------------------------------- */

  // A token is DING-SHAPED when it carries any of the ding punctuation. These
  // are counted over the whole string before any other rule runs (D13), so
  // `(D3) (A3) C4` is NO_DING rather than BAD_NOTE. A single, first,
  // ding-shaped token that is not exactly `(NAME)` or `NAME/` is a malformed
  // note token and therefore BAD_NOTE.
  function isDingShaped(token) {
    return token.charAt(0) === "(" ||
           token.charAt(token.length - 1) === ")" ||
           token.charAt(token.length - 1) === "/";
  }

  function dingBody(token) {
    var paren = /^\((.*)\)$/.exec(token);
    if (paren) return paren[1];
    var slash = /^(.*)\/$/.exec(token);
    if (slash) return slash[1];
    return null;
  }

  function lex(token) {
    var m = NOTE_RE.exec(token);
    if (!m) return null;
    return {
      letter: m[1],
      accidental: m[2] || "",
      octave: m[3] === undefined ? null : Number(m[3]),
      token: token
    };
  }

  /* ---- octave inference ------------------------------------------------- */

  function nextAbove(previousMidi, letter, accidental) {
    var midi = midiFromName(letter, accidental, 0);
    while (midi <= previousMidi) midi += 12;
    return midi;
  }

  // Section 3: the first bottom note is the instance of its pitch class nearest
  // the ding, excluding the ding's own midi, ties (tritone, same pitch class)
  // going BELOW.
  function nearestToDing(dingMidi, letter, accidental) {
    var step = ((dingMidi - midiFromName(letter, accidental, 0)) % 12 + 12) % 12;
    // The ding's own midi is not a candidate, so a same-pitch-class bottom note
    // has its neighbours a full octave either side and the tie goes below.
    var below = dingMidi - (step === 0 ? 12 : step);
    var above = step === 0 ? dingMidi + 12 : below + 12;
    return (dingMidi - below) <= (above - dingMidi) ? below : above;
  }

  function place(note, previousMidi, seedFn) {
    if (note.octave !== null) {
      return midiFromName(note.letter, note.accidental, note.octave);
    }
    return seedFn(previousMidi, note.letter, note.accidental);
  }

  /* ---- options ---------------------------------------------------------- */

  var NAME_RE = /^[\x20-\x7E]*$/;

  // Section 13/14. There is no options code in the section 2 enum, and the spec
  // forbids inventing one, so a rejected option is BAD_NOTE naming the value.
  function readOptions(options) {
    var out = {
      palette: DEFAULT_OPTIONS.palette,
      parent: DEFAULT_OPTIONS.parent,
      name: DEFAULT_OPTIONS.name,
      mirror: DEFAULT_OPTIONS.mirror
    };
    if (options === undefined || options === null) return ok(out);
    if (typeof options !== "object") return badNote(options);

    if (options.palette !== undefined) {
      var palette = options.palette;
      if (typeof palette !== "number" || palette !== Math.floor(palette) ||
          palette < 0 || palette > 5) return badNote(palette);
      out.palette = palette;
    }
    if (options.parent !== undefined && options.parent !== null) {
      var parent = options.parent;
      if (typeof parent !== "number" || parent !== Math.floor(parent) ||
          parent < 0 || parent > 10) return badNote(parent);
      out.parent = parent;
    }
    if (options.name !== undefined && options.name !== "") {
      var name = options.name;
      if (typeof name !== "string") return badNote(name);
      name = name.replace(/^\s+/, "").replace(/\s+$/, "");
      if (!NAME_RE.test(name) || name.length < 1 || name.length > 40) {
        return badNote(name);
      }
      out.name = name;
    }
    if (options.mirror !== undefined) {
      if (typeof options.mirror !== "boolean") return badNote(options.mirror);
      out.mirror = options.mirror;
    }
    return ok(out);
  }

  /* ---- parseSeed -------------------------------------------------------- */

  function parseSeed(input, options) {
    if (typeof input !== "string") return badNote(String(input));

    var opts = readOptions(options);
    if (!opts.ok) return opts;

    var tokens = input.split(/\s+/).filter(function (t) { return t !== ""; });

    // 1. Ding counting, before every other rule (D13).
    var dingIndexes = [];
    for (var i = 0; i < tokens.length; i += 1) {
      if (isDingShaped(tokens[i])) dingIndexes.push(i);
    }
    if (dingIndexes.length !== 1 || dingIndexes[0] !== 0) {
      return err("NO_DING", {});
    }

    var body = dingBody(tokens[0]);
    if (body === null) return badNote(tokens[0]);
    var dingNote = lex(body);
    if (!dingNote) return badNote(tokens[0]);
    // A ding written without an octave is octave 3 (all three built-ins).
    if (dingNote.octave === null) dingNote.octave = 3;
    var dingMidi = midiFromName(dingNote.letter, dingNote.accidental, dingNote.octave);
    if (dingMidi < 0 || dingMidi > 127) return badNote(tokens[0]);

    // 2. Split the rest on the bar, which must stand alone.
    var rest = tokens.slice(1);
    var bar = -1;
    for (var b = 0; b < rest.length; b += 1) {
      if (rest[b] === "|") {
        if (bar >= 0) return badNote("|");
        bar = b;
      }
    }
    var topTokens = bar < 0 ? rest : rest.slice(0, bar);
    var bottomTokens = bar < 0 ? [] : rest.slice(bar + 1);
    if (bar >= 0 && bottomTokens.length === 0) return badNote("|");

    // 3. Lex every remaining token.
    var topNotes = [];
    var bottomNotes = [];
    var lists = [[topTokens, topNotes], [bottomTokens, bottomNotes]];
    for (var l = 0; l < lists.length; l += 1) {
      var raw = lists[l][0];
      for (var t = 0; t < raw.length; t += 1) {
        var note = lex(raw[t]);
        if (!note) return badNote(raw[t]);
        lists[l][1].push(note);
      }
    }

    // 4. Octave inference, MIDI range and the strict-ascending rule. The ding
    //    counts as the element before the first top note.
    var seen = {};
    var previous = dingMidi;
    var n;
    for (n = 0; n < topNotes.length; n += 1) {
      var top = topNotes[n];
      top.midi = place(top, previous, nextAbove);
      if (top.midi < 0 || top.midi > 127) return badNote(top.token);
      if (top.midi <= previous) return badNote(top.token);
      top.octave = octaveOf(top.letter, top.accidental, top.midi);
      var topKey = "top " + spell(top.letter, top.accidental) + top.octave;
      if (seen[topKey]) return badNote(top.token);
      seen[topKey] = true;
      previous = top.midi;
    }

    for (n = 0; n < bottomNotes.length; n += 1) {
      var low = bottomNotes[n];
      low.midi = n === 0
        ? place(low, dingMidi, nearestToDing)
        : place(low, bottomNotes[n - 1].midi, nextAbove);
      if (low.midi < 0 || low.midi > 127) return badNote(low.token);
      if (n > 0 && low.midi <= bottomNotes[n - 1].midi) return badNote(low.token);
      low.octave = octaveOf(low.letter, low.accidental, low.midi);
      var lowKey = "bottom " + spell(low.letter, low.accidental) + low.octave;
      if (seen[lowKey]) return badNote(low.token);
      seen[lowKey] = true;
    }

    // 5. Caps (section 4).
    if (topNotes.length > TOP_MAX || bottomNotes.length > BOTTOM_MAX) {
      return err("TOO_MANY_RIM", {});
    }

    // 6. A perfect fifth above the ding must exist on the TOP shell.
    var wanted = pitchClass(dingMidi + 7);
    var hasFifth = false;
    for (n = 0; n < topNotes.length; n += 1) {
      if (pitchClass(topNotes[n].midi) === wanted) hasFifth = true;
    }
    if (!hasFifth) {
      return err("NO_FIFTH", {
        "<X>": spell(dingNote.letter, dingNote.accidental) + dingNote.octave,
        "<fifth of X>": fifthName(dingNote.letter, dingNote.accidental)
      });
    }

    // 7. Build the field map (section 4: ids, labels, zones).
    var fields = {};
    fields["0"] = [spell(dingNote.letter, dingNote.accidental), dingNote.octave,
                   dingMidi, "ding", null, "Ding"];
    for (n = 0; n < topNotes.length; n += 1) {
      var id = String(n + 1);
      fields[id] = [spell(topNotes[n].letter, topNotes[n].accidental),
                    topNotes[n].octave, topNotes[n].midi,
                    n < RIM_MAX ? "rim" : "inner", null, id];
    }
    for (n = 0; n < bottomNotes.length; n += 1) {
      fields[String(101 + n)] = [
        spell(bottomNotes[n].letter, bottomNotes[n].accidental),
        bottomNotes[n].octave, bottomNotes[n].midi, "bottom", null, "U" + (n + 1)];
    }

    return ok({ fields: fields, options: opts.value });
  }

  /* ---- section 12: the canonical string and the deck id ----------------- */

  function fieldsOf(seedOrFields) {
    return (seedOrFields && seedOrFields.fields) ? seedOrFields.fields : seedOrFields;
  }

  function orderedIds(fields) {
    var top = [];
    var bottom = [];
    for (var id in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, id)) continue;
      if (id === "0") continue;
      (Number(id) >= 101 ? bottom : top).push(id);
    }
    function byNumber(a, c) { return Number(a) - Number(c); }
    return { top: top.sort(byNumber), bottom: bottom.sort(byNumber) };
  }

  function formatSeed(seed) {
    var fields = fieldsOf(seed);
    var ids = orderedIds(fields);
    var ding = fields["0"];
    var out = "(" + ding[0] + ding[1] + ")";
    var n;
    for (n = 0; n < ids.top.length; n += 1) {
      out += " " + fields[ids.top[n]][0] + fields[ids.top[n]][1];
    }
    if (ids.bottom.length) {
      out += " |";
      for (n = 0; n < ids.bottom.length; n += 1) {
        out += " " + fields[ids.bottom[n]][0] + fields[ids.bottom[n]][1];
      }
    }
    return out;
  }

  // FNV-1a, 32-bit, over the UTF-8 bytes. Hand-rolled rather than TextEncoder:
  // section 14 forbids depending on host encoders the vm context may not have.
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

  function fnv1a32(str) {
    var hash = 0x811c9dc5;
    var bytes = utf8Bytes(str);
    for (var i = 0; i < bytes.length; i += 1) {
      hash = (hash ^ bytes[i]) >>> 0;
      // 32-bit multiply by 0x01000193 without losing precision.
      hash = (((hash & 0xffff) * 0x01000193) +
              ((((hash >>> 16) * 0x01000193) & 0xffff) << 16)) >>> 0;
    }
    var hex = hash.toString(16);
    while (hex.length < 8) hex = "0" + hex;
    return hex;
  }

  // D14: a pure function of formatSeed - notes, octaves, zones and order. The
  // options are never hashed, so renaming or recolouring keeps the id.
  function deckId(seedOrFields) {
    return "custom:" + fnv1a32(formatSeed(fieldsOf(seedOrFields)));
  }

  HPE.core = {
    parseSeed: parseSeed,
    formatSeed: formatSeed,
    deckId: deckId,
    REASONS: REASONS,
    pitchClass: pitchClass,
    midiFromName: midiFromName,
    fifthName: fifthName,
    CAPS: { rim: RIM_MAX, inner: INNER_MAX, bottom: BOTTOM_MAX, top: TOP_MAX }
  };
})(HPE);
