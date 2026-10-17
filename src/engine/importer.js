/* HPE.importer - turns pasted product text into a scale string, without guessing.
 *
 * Plain script, no module wrapper: index.html is a single self-contained file
 * by contract, so this text has to be inlinable verbatim. `var`, not `const`,
 * so the namespace lands on the global object of a node:vm context too.
 *
 * Normative source: docs/plans/2026-10-16-scale-import.md, "Lane A1: engine
 * importer" and sections 4.1 to 4.4. Roles come only from labels the source
 * writes (Ding, Top, Bottom, Inner, Notes Top Side, ...) or role words in a
 * clause. Every other cue is a flag. Raw source text never reaches parseSeed;
 * only strings built here from resolved roles do.
 *
 * Reads HPE.core, so it loads after core.
 */
var HPE = (typeof HPE !== "undefined") ? HPE : {};

(function (HPE) {
  "use strict";

  var BLOCK = "BLOCK";
  var CONFIRM = "CONFIRM";
  var INFO = "INFO";

  // Flags leave interpret() in this order.
  var FLAG_ORDER = [
    ["NO_NOTE_LIST", BLOCK], ["UNDECLARED_PARENS", BLOCK], ["CONFLICTING_DING", BLOCK],
    ["AMBIGUOUS_NOTE", BLOCK], ["INNER_BELOW_TOP", BLOCK], ["COUNT_MISMATCH", BLOCK], ["PROVISIONAL_REFUSED", BLOCK],
    ["DING_CUE", CONFIRM], ["COUNT_EXCL_DING", CONFIRM], ["SPACE_IN_NOTE", CONFIRM],
    ["SOURCE_NOT_ASCENDING", CONFIRM], ["DUPLICATE_PITCH", CONFIRM], ["NO_OCTAVE", CONFIRM],
    ["COUNT_OK", INFO]
  ];

  var NOTE_UP = /^([A-G])(#|b)?(-1|[0-9])?$/;
  var NOTE_ODD = /^(?:[a-h](?:#|b)?(?:-1|[0-9])|[a-h]#|H(?:#|b)?[0-9]?)$/;
  var NOTE_LIKE = /^[A-Ga-g](#|b)?$/;
  var OCTAVED = /^[A-Ha-h](#|b)?(-1|[0-9])$/;
  var JOINED = /^([A-G]) (#|b)(-1|[0-9])/;
  var TOKEN = /([A-G]) (?:#|b)(?:-1|[0-9])|[A-Za-z][A-Za-z0-9#]*(?:-1(?![0-9]))?|[()\/\-,]|\S/g;
  var SKIPPED = /^(?:and|&|\.|;)$/i;
  var REFERENCE = /^A4 *(?:=|at\b)? *[0-9]{3}(?![0-9])/;
  var GLUED = /^(?:[A-Ha-h](?:#|b)?(?:-1|[0-9])){2,}$/;

  var LABEL = new RegExp(
    "\\b(?:(Ding)|(Inner(?:\\s*Notes)?)|(Notes\\s*Bottom\\s*Side|Bottom\\s*Side\\s*Notes|Bottom\\s*Notes|Bottom)" +
    "|(Notes\\s*Top\\s*Side|Top\\s*Side\\s*Notes|Top\\s*Notes|Top|Tones|Notes|Notas))\\s*:", "gi");
  var LABEL_ROLES = [null, "ding", "inner", "bottom", "top"];

  function core() { return HPE.core; }

  // One-to-one character replacement, so an offset into the result is an
  // offset into the original.
  function normalise(raw) {
    return String(raw)
      .replace(/♯/g, "#").replace(/♭/g, "b")
      .replace(/[–—]/g, "-")
      .replace(/\s/g, " ");
  }

  function midiOf(name) {
    var m = NOTE_UP.exec(name);
    if (!m || m[3] === undefined) return null;
    return core().midiFromName(m[1], m[2] || "", Number(m[3]));
  }

  function hasOctave(name) {
    return /[0-9]$/.test(name);
  }

  function spanOf(original, start, end) {
    return { start: start, end: end, text: original.slice(start, end) };
  }

  // True when a token after the one that ended the list still reads as a note,
  // so a list cut short never drops notes without a flag. The scan runs to the
  // next recognised label, through any other "Word:" key. A note with an octave
  // counts alone, unless it is the reference pitch (A4 followed by an optional
  // "=" or "at" and a three-digit frequency); letters without one count only
  // as a run of two, and not straight after a "Key:" label.
  function readsAsNoteAfter(re, body, tok) {
    var rest = new RegExp(TOKEN.source, "g");
    var m;
    var prev = tok;
    var key = false;
    var run = 0;
    rest.lastIndex = re.lastIndex;
    while ((m = rest.exec(body))) {
      tok = m[0];
      if (JOINED.test(tok) || OCTAVED.test(tok) || GLUED.test(tok)) {
        if (!REFERENCE.test(tok + body.slice(rest.lastIndex))) return true;
      } else if (NOTE_LIKE.test(tok)) {
        run = key ? 0 : run + 1;
        if (run >= 2) return true;
      } else if (tok === ":") {
        key = /^keys?$/i.test(prev);
      } else if (!/^(?:[,\/\-&;|+\u00b7]|and|or)$/i.test(tok)) {
        run = 0;
        key = false;
      }
      prev = tok;
    }
    return false;
  }

  // The notes of one list body, with the punctuation that follows each. Reading
  // stops at the first word that is not a note, so the next spec line ("Material",
  // "Standard Pitch") never leaks in.
  function readList(text, from, to, role, original) {
    var body = text.slice(from, to);
    var notes = [];
    var odd = [];
    var depth = 0;
    var last = null;
    var immediate = false;
    var re = new RegExp(TOKEN.source, "g");
    var m;
    while ((m = re.exec(body))) {
      var tok = m[0];
      var start = from + m.index;
      var joined = JOINED.exec(tok);
      if (joined || NOTE_UP.test(tok)) {
        last = {
          name: joined ? joined[1] + joined[2] + joined[3] : tok,
          joined: !!joined,
          paren: depth > 0,
          role: role,
          span: spanOf(original, start, start + tok.length),
          closeMark: false,
          sep: null
        };
        notes.push(last);
        immediate = true;
        continue;
      }
      if (tok === "(") { depth += 1; immediate = false; continue; }
      if (tok === ")") {
        if (depth > 0) depth -= 1;
        else if (last && immediate) last.closeMark = true;
        immediate = false;
        continue;
      }
      if (tok === "/" || tok === "-") {
        if (last && immediate && !last.sep) last.sep = tok;
        immediate = false;
        continue;
      }
      if (tok === ",") { immediate = false; continue; }
      if (NOTE_ODD.test(tok)) { odd.push(tok); immediate = false; continue; }
      if (SKIPPED.test(tok)) continue;
      if (GLUED.test(tok) || readsAsNoteAfter(re, body, tok)) odd.push(tok);
      break;
    }
    return { role: role, notes: notes, odd: odd };
  }

  function labelledLists(text, original) {
    var marks = [];
    var re = new RegExp(LABEL.source, "gi");
    var m;
    while ((m = re.exec(text))) {
      var role = null;
      for (var g = 1; g < LABEL_ROLES.length; g += 1) if (m[g] !== undefined) role = LABEL_ROLES[g];
      marks.push({ role: role, from: m.index + m[0].length, at: m.index });
    }
    var lists = [];
    marks.forEach(function (mark, i) {
      var to = i + 1 < marks.length ? marks[i + 1].at : text.length;
      var list = readList(text, mark.from, to, mark.role, original);
      if (list.notes.length || list.odd.length) lists.push(list);
    });
    return lists;
  }

  // "D3 ding, A3 Bb3 top, C3 bottom": a role word closes each comma clause.
  function clauseLists(text, original) {
    if (!/\bding\b/i.test(text)) return null;
    var lists = [];
    var re = /[^,;.]+/g;
    var m;
    while ((m = re.exec(text))) {
      var clause = m[0];
      var word = /\b(ding|top|bottom|inner)s?\b/i.exec(clause);
      var list = readList(clause, 0, clause.length, word ? word[1].toLowerCase() : null, original);
      if (!list.notes.length && !list.odd.length) continue;
      if (!word) return null;
      list.notes.forEach(function (n) {
        n.span = spanOf(original, m.index + n.span.start, m.index + n.span.end);
      });
      lists.push(list);
    }
    return lists;
  }

  function titleCountOf(title) {
    if (typeof title !== "string") return null;
    var sum = /\b(\d{1,2})\s*\+\s*(\d{1,2})\b/.exec(title);
    if (sum) return Number(sum[1]) + Number(sum[2]);
    var m = /\b(\d{1,2})\b(?!\s*Hz)(?!.*\b\d{1,2}\b(?!\s*Hz))/.exec(title.replace(/\+.*$/, ""));
    return m ? Number(m[1]) : null;
  }

  // The importer's single structural choice (G6): ding, tops, bar, inner notes,
  // then every bottom note as [X], each keeping any octave the source wrote.
  function provisionalString(ding, tops, inner, bottoms) {
    var parts = ["(" + ding.name + ")"];
    tops.forEach(function (n) { parts.push(n.name); });
    if (inner.length) parts.push("|");
    inner.forEach(function (n) { parts.push(n.name); });
    bottoms.forEach(function (n) { parts.push("[" + n.name + "]"); });
    return parts.join(" ");
  }

  function interpret(raw, opts) {
    opts = opts || {};
    var original = String(raw);
    var text = normalise(original);
    var titleCount = titleCountOf(opts.title);
    var flags = {};
    function flag(code, extra) {
      var f = flags[code] || (flags[code] = { code: code });
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) f[k] = extra[k];
      return f;
    }
    function finish(roles, notes, total) {
      var out = [];
      FLAG_ORDER.forEach(function (pair) {
        if (flags[pair[0]]) { flags[pair[0]].level = pair[1]; out.push(flags[pair[0]]); }
      });
      var status = flags.NO_NOTE_LIST ? "INSUFFICIENT" :
        out.some(function (f) { return f.level === BLOCK; }) ? "NEEDS_INPUT" : "REVIEW";
      return { status: status, roles: roles, notes: notes, flags: out, total: total, titleCount: titleCount };
    }
    function insufficient() {
      flag("NO_NOTE_LIST");
      return finish({ ding: null, top: [], bottom: [], inner: [] }, [], 0);
    }

    var lists = labelledLists(text, original);
    if (!lists.length) lists = clauseLists(text, original) || [];
    var odd = [];
    var notes = [];
    lists.forEach(function (list, li) {
      odd = odd.concat(list.odd);
      list.notes.forEach(function (n) { n.list = li; notes.push(n); });
    });
    if (!notes.length) return insufficient();
    if (odd.length) flag("AMBIGUOUS_NOTE", { tokens: odd });

    notes.forEach(function (n, i) { n.index = i; n.octave = hasOctave(n.name); n.midi = midiOf(n.name); });

    // Who is the ding?
    var labelDings = notes.filter(function (n) { return n.role === "ding" && !n.paren; });
    var firstTop = null;
    lists.some(function (list) {
      if (list.role !== "top" || !list.notes.length) return false;
      firstTop = list.notes[0];
      return true;
    });
    var pickable = typeof opts.ding === "number" && opts.ding >= 0 && opts.ding < notes.length;
    var ding = null;
    var stray = notes.filter(function (n) { return n.closeMark; });
    function indices(list) { return list.map(function (n) { return n.index; }); }
    if (pickable) {
      ding = notes[opts.ding];
    } else if (labelDings.length) {
      if (labelDings.length > 1 || stray.length) {
        flag("CONFLICTING_DING", { notes: indices(labelDings.concat(stray)) });
      } else {
        ding = labelDings[0];
      }
    } else if (firstTop && !firstTop.paren) {
      var bad = stray.filter(function (n) { return n !== firstTop; });
      if (bad.length) {
        flag("CONFLICTING_DING", { notes: indices([firstTop].concat(bad)) });
      } else {
        ding = firstTop;
        flag("DING_CUE", { notes: [ding.index],
                           cue: firstTop.closeMark ? "mark" : firstTop.sep ? "separator" : "first" });
      }
    }

    notes.forEach(function (n) {
      if (n === ding) n.assigned = "ding";
      else if (n.paren) n.assigned = "unknown";
      else n.assigned = n.role === "ding" ? "top" : n.role;
    });
    var unknown = notes.filter(function (n) { return n.assigned === "unknown"; });
    if (unknown.length) flag("UNDECLARED_PARENS", { notes: indices(unknown) });
    if (!ding && !flags.CONFLICTING_DING && !unknown.length) return insufficient();

    var tops = notes.filter(function (n) { return n.assigned === "top"; });
    var inner = notes.filter(function (n) { return n.assigned === "inner"; });
    var bottoms = notes.filter(function (n) { return n.assigned === "bottom"; });

    var topMax = Math.max.apply(null, tops.map(function (n) { return n.midi === null ? -Infinity : n.midi; }));
    var innerMin = Math.min.apply(null, inner.map(function (n) { return n.midi === null ? Infinity : n.midi; }));
    if (innerMin < topMax) {
      flag("INNER_BELOW_TOP", { notes: indices(inner.filter(function (n) { return n.midi !== null && n.midi < topMax; })) });
    }

    var total = notes.length;
    if (titleCount !== null) {
      if (titleCount === total) flag("COUNT_OK");
      else if (titleCount === total - 1) flag("COUNT_EXCL_DING");
      else flag("COUNT_MISMATCH", { title: titleCount, listed: total });
    }

    var joined = notes.filter(function (n) { return n.joined; });
    if (joined.length) flag("SPACE_IN_NOTE", { notes: indices(joined) });

    var descending = [];
    lists.forEach(function (list) {
      var prev = null;
      list.notes.forEach(function (n) {
        if (n.assigned === "unknown" || n.midi === null) return;
        if (prev && n.midi < prev.midi) descending.push(prev.index, n.index);
        prev = n;
      });
    });
    if (descending.length) flag("SOURCE_NOT_ASCENDING", { notes: descending });

    var byPitch = {};
    notes.forEach(function (n) {
      if (n.assigned === "unknown" || n.midi === null) return;
      (byPitch[n.midi] = byPitch[n.midi] || []).push(n.index);
    });
    var repeated = [];
    Object.keys(byPitch).forEach(function (k) {
      if (byPitch[k].length > 1) repeated = repeated.concat(byPitch[k]);
    });
    if (repeated.length) flag("DUPLICATE_PITCH", { notes: repeated.sort(function (a, b) { return a - b; }) });

    var bare = notes.filter(function (n) { return n.assigned !== "unknown" && !n.octave; });
    if (bare.length) flag("NO_OCTAVE", { notes: indices(bare) });

    var blocked = !ding || flags.UNDECLARED_PARENS || flags.CONFLICTING_DING || flags.COUNT_MISMATCH ||
                  flags.AMBIGUOUS_NOTE;
    var octaves = {};
    if (bare.length && !blocked) {
      var parsed = core().parseSeed(provisionalString(ding, tops, inner, bottoms));
      if (!parsed.ok) {
        flag("PROVISIONAL_REFUSED", { refusal: { code: parsed.code, reason: parsed.reason } });
      } else {
        var fields = parsed.value.fields;
        var nameOf = function (id) { return fields[id][0] + fields[id][1]; };
        var rim = tops.concat(inner);
        octaves[ding.index] = nameOf("0");
        rim.forEach(function (n, i) { octaves[n.index] = nameOf(String(i + 1)); });
        var first = Math.max(101, rim.length + 1);
        bottoms.forEach(function (n, i) { octaves[n.index] = nameOf(String(first + i)); });
      }
    }

    function make(n, guessable) {
      var e = { note: n.name, span: n.span, index: n.index };
      if (!n.octave && octaves[n.index] !== undefined) {
        e.note = octaves[n.index];
        e.inferred = true;
        if (guessable) e.guess = true;
      }
      return e;
    }
    var roles = {
      ding: ding ? make(ding, false) : null,
      top: tops.map(function (n) { return make(n, false); }),
      bottom: bottoms.map(function (n) { return make(n, true); }),
      inner: inner.map(function (n) { return make(n, false); })
    };
    var listing = notes.map(function (n) {
      var inferred = !n.octave && octaves[n.index] !== undefined;
      return { note: inferred ? octaves[n.index] : n.name, span: n.span, role: n.assigned };
    });
    return finish(roles, listing, total);
  }

  // The canonical line for a REVIEW result, or "" when nothing may be written.
  // A string parseSeed refuses is still returned: its refusal belongs to the
  // sheet's own #scale-refusal.
  function serialise(result) {
    if (!result || result.status !== "REVIEW" || !result.roles.ding) return "";
    var line = [];
    var bad = false;
    function add(e, rank, text, innerNote) {
      var midi = midiOf(e.note);
      if (midi === null) bad = true;
      line.push({ midi: midi, rank: rank, text: text, inner: innerNote });
    }
    add(result.roles.ding, 1, "(" + result.roles.ding.note + ")", false);
    result.roles.bottom.forEach(function (e) { add(e, 0, "[" + e.note + "]", false); });
    result.roles.top.forEach(function (e) { add(e, 2, e.note, false); });
    result.roles.inner.forEach(function (e) { add(e, 2, e.note, true); });
    if (bad) return "";
    line.sort(function (a, b) { return a.midi - b.midi || a.rank - b.rank; });
    var out = [];
    var barred = false;
    line.forEach(function (e) {
      if (e.inner && !barred) { out.push("|"); barred = true; }
      out.push(e.text);
    });
    var text = out.join(" ");
    var parsed = core().parseSeed(text);
    return parsed.ok ? core().formatSeed(parsed.value.fields) : text;
  }

  HPE.importer = {
    interpret: interpret,
    serialise: serialise
  };
})(HPE);
