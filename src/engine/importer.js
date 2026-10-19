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
    ["NO_NOTE_LIST", BLOCK], ["UNDECLARED_PARENS", BLOCK], ["CONFLICTING_DING", BLOCK], ["DING_CLAUSE_MANY", BLOCK], ["DING_NOT_LOWEST", BLOCK],
    ["DING_ON_BOTTOM", BLOCK], ["REPEATED_IN_SHELL", BLOCK],
    ["AMBIGUOUS_NOTE", BLOCK], ["INNER_BELOW_TOP", BLOCK], ["COUNT_MISMATCH", BLOCK], ["PROVISIONAL_REFUSED", BLOCK],
    ["BOTTOM_NO_OCTAVE", BLOCK], ["CONFLICTING_LIST", BLOCK], ["SEED_REFUSED", BLOCK],
    ["DING_CUE", CONFIRM], ["PARENS_AS_BOTTOM", CONFIRM], ["COUNT_EXCL_DING", CONFIRM], ["SPACE_IN_NOTE", CONFIRM],
    ["SOURCE_NOT_ASCENDING", CONFIRM], ["DUPLICATE_PITCH", CONFIRM], ["NO_OCTAVE", CONFIRM],
    ["DING_CUE_DROPPED", CONFIRM], ["COUNT_OK", INFO]
  ];

  var NOTE_UP = /^([A-G])(#|b)?(-1|[0-9])?$/;
  var NOTE_ODD = /^(?:[a-h](?:#|b)?(?:-1|[0-9])|[a-h]#|H(?:#|b)?[0-9]?)$/;
  var NOTE_LIKE = /^[A-Ga-g](#|b)?$/;
  var OCTAVED = /^[A-Ha-h](#|b)?(-1|[0-9])$/;
  var JOINED = /^([A-G]) (#|b)(-1|[0-9])/;
  var TOKEN = /([A-G]) (?:#|b)(?:-1|[0-9])|Ré(?:#|b)?(?:-1|[0-9])|[A-Za-z][A-Za-z0-9#]*(?:-1(?![0-9]))?|[()\/\-,]|\S/g;
  var SOLFEGE = /^(Do|R[eé]|Mi|Fa|Sol|La|Si)(#|b)?(-1|[0-9])$/;
  var SOLFEGE_LETTER = { Do: "C", Re: "D", "Ré": "D", Mi: "E", Fa: "F", Sol: "G", La: "A", Si: "B" };
  var PITCH_SRC = "(?:[A-G](?:#|b)?(?:-1|[0-9])?|(?:Do|R[e\\u00e9]|Mi|Fa|Sol|La|Si)(?:#|b)?[0-9])";
  var EDGE_L = "(?<![A-Za-z0-9\\u00c0-\\u017f])";
  var EDGE_R = "(?![A-Za-z0-9#\\u00c0-\\u017f])";
  var RUN = new RegExp("(?:" + EDGE_L + PITCH_SRC + EDGE_R + "[\\s,\\-\\/\\u00b7|()]*){5,}", "g");
  var PITCH = new RegExp(EDGE_L + PITCH_SRC + EDGE_R, "g");
  var NARROW_OVER = 2000;
  var WINDOW_CHARS = 1200;
  var SKIPPED = /^(?:and|&|\.|;)$/i;
  var REFERENCE = /^A4 *(?:=|at\b)? *[0-9]{3}(?![0-9])/;
  var GLUED = /^(?:[A-Ha-h](?:#|b)?(?:-1|[0-9])){2,}$/;

  var LABEL = new RegExp(
    "(?:\\b|(?<=[0-9]))(?:(Ding(?:\\s*\\((?:center|centre)\\))?)|(Inner(?:\\s*Notes)?)" +
    "|(Notes\\s*\\(\\s*Bottom\\s*Side\\s*\\)|Notes\\s*Bottom\\s*Side|Bottom\\s*Side\\s*Notes|Bottom\\s*Notes|Bottom)" +
    "|(Notes\\s*\\(\\s*Top\\s*Side\\s*\\)|Notes\\s*Top\\s*Side|Top\\s*Side\\s*Notes|Top\\s*Notes|Top|Tones|Notes?|Notas" +
    "|Outer\\s*circle|notes\\b[^:]{0,40}\\bare))\\s*:", "gi");
  // Colon-less spec-row labels count only when a note follows straight away,
  // so "Anzahl Noten 14" and "Number of notes 12" are not labels.
  var BARE_LABEL = new RegExp("\\b(?:(Hauptnote|Main note)|(Noten|Notes))(?=\\s+\\(?" + PITCH_SRC + EDGE_R + ")", "g");
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
      if (JOINED.test(tok) || OCTAVED.test(tok) || GLUED.test(tok) || SOLFEGE.test(tok)) {
        if (!REFERENCE.test(tok + body.slice(rest.lastIndex))) return true;
      } else if (NOTE_LIKE.test(tok)) {
        run = key ? 0 : run + 1;
        if (run >= 2) return true;
      } else if (tok === ":") {
        key = /^keys?$/i.test(prev);
      } else if (!/^(?:[^A-Za-z0-9.]|and|or)$/i.test(tok)) {
        run = 0;
        key = false;
      } else if (!/^(?:[,\/\-&]|and|or)$/i.test(tok)) key = false;
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
    var group = 0;
    var re = new RegExp(TOKEN.source, "g");
    var m;
    while ((m = re.exec(body))) {
      var tok = m[0];
      var start = from + m.index;
      if (REFERENCE.test(body.slice(m.index))) {
        if (readsAsNoteAfter(re, body, tok)) odd.push(tok);
        break;
      }
      var joined = JOINED.exec(tok);
      var sol = SOLFEGE.exec(tok);
      if (joined || sol || NOTE_UP.test(tok)) {
        last = {
          name: joined ? joined[1] + joined[2] + joined[3] :
            sol ? SOLFEGE_LETTER[sol[1]] + (sol[2] || "") + sol[3] : tok,
          joined: !!joined,
          paren: depth > 0,
          group: depth > 0 ? group : 0,
          role: role,
          span: spanOf(original, start, start + tok.length),
          closeMark: false,
          sep: null
        };
        notes.push(last);
        immediate = true;
        continue;
      }
      if (tok === "(") { if (!depth) group += 1; depth += 1; immediate = false; continue; }
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
      // "Note:" and "notes ... are:" also open prose, so they label a list
      // only when a run of notes follows.
      var weak = m[4] !== undefined && /^note$|are$/i.test(m[4]);
      marks.push({ role: role, from: m.index + m[0].length, at: m.index, weak: weak });
    }
    var bare = new RegExp(BARE_LABEL.source, "g");
    while ((m = bare.exec(text))) {
      var at = m.index;
      if (marks.some(function (k) { return at >= k.at && at < k.from; })) continue;
      var ding = m[1] !== undefined;
      marks.push({ role: ding ? "ding" : "top", from: at + m[0].length, at: at, weak: !ding, bare: ding });
    }
    marks.sort(function (a, b) { return a.at - b.at; });
    for (;;) {
      var lists = [];
      var prose = -1;
      marks.forEach(function (mark, i) {
        var to = i + 1 < marks.length ? marks[i + 1].at : text.length;
        var list = readList(text, mark.from, to, mark.role, original);
        if (mark.weak && list.notes.length < 5 && prose < 0) prose = i;
        list.at = mark.at;
        if (mark.bare) list.notes.forEach(function (n) { n.bareLabel = true; });
        if (list.notes.length || list.odd.length) lists.push(list);
      });
      if (prose < 0) return lists;
      marks.splice(prose, 1);
    }
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
      list.at = m.index;
      list.end = m.index + clause.length;
      lists.push(list);
    }
    return lists;
  }

  function letters(name) {
    return name.replace(/(-1|[0-9])$/, "");
  }

  function pcOf(name) {
    var m = NOTE_UP.exec(name);
    return m ? core().midiFromName(m[1], m[2] || "", 4) % 12 : null;
  }

  function runNames(run) {
    var out = [];
    var re = new RegExp(PITCH.source, "g");
    var m;
    while ((m = re.exec(run))) {
      var sol = SOLFEGE.exec(m[0]);
      out.push(letters(sol ? SOLFEGE_LETTER[sol[1]] + (sol[2] || "") + sol[3] : m[0]));
    }
    return out;
  }

  // tier0's densest-pitch window: the best line and 3 either side, at most
  // WINDOW_CHARS characters, solfege pitches scored too.
  function windowOf(raw) {
    var lines = raw.split("\n");
    var score = lines.map(function (l) { return (normalise(l).match(new RegExp(PITCH.source, "g")) || []).length; });
    var sum = function (i) {
      return score.slice(Math.max(0, i - 3), i + 4).reduce(function (a, b) { return a + b; }, 0);
    };
    var best = 0;
    for (var i = 0; i < lines.length; i += 1) if (sum(i) > sum(best)) best = i;
    var lo = Math.max(0, best - 3);
    var start = 0;
    for (var j = 0; j < lo; j += 1) start += lines[j].length + 1;
    var body = lines.slice(lo, best + 4).join("\n").slice(0, WINDOW_CHARS);
    return { start: start, end: start + body.length };
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

  function read(raw, opts, narrow) {
    opts = opts || {};
    var full = String(raw);
    var base = 0;
    var original = full;
    var titleCount = titleCountOf(opts.title);
    var flags = {};
    function flag(code, extra) {
      var f = flags[code] || (flags[code] = { code: code });
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) f[k] = extra[k];
      return f;
    }
    // With narrow set, a long text is read only in its densest-pitch window,
    // widened to whole lines over every labelled list in the text, or every
    // clause list when it has none. A spread wider than NARROW_OVER or a run of
    // five or more notes outside the window blocks; interpret() then checks
    // any REVIEW against the whole text.
    if (narrow && full.length > NARROW_OVER) {
      var w = windowOf(full);
      var whole = normalise(full);
      var spread = labelledLists(whole, full).filter(function (l) { return l.notes.length; });
      if (!spread.length) spread = clauseLists(whole, full) || [];
      if (spread.length) {
        var lo = spread[0].at;
        var hi = 0;
        spread.forEach(function (l) {
          hi = Math.max(hi, l.end !== undefined ? l.end : l.notes[l.notes.length - 1].span.end);
        });
        lo = lo > 0 ? full.lastIndexOf("\n", lo - 1) + 1 : 0;
        hi = full.indexOf("\n", hi);
        if (hi < 0) hi = full.length;
        if (hi - lo <= NARROW_OVER) w = { start: Math.min(w.start, lo), end: Math.max(w.end, hi) };
        else flag("CONFLICTING_LIST", { spread: hi - lo });
      }
      var outside = 0;
      var rr = new RegExp(RUN.source, "g");
      var rm;
      while ((rm = rr.exec(whole))) {
        var end = rm.index + rm[0].replace(/[\s,\-\/\u00b7|()]+$/, "").length;
        if (rm.index < w.start || end > w.end) outside += 1;
      }
      if (outside) flag("CONFLICTING_LIST", { runs: outside });
      base = w.start;
      original = full.slice(w.start, w.end);
    }
    var text = normalise(original);
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
    var labelled = lists.length > 0;
    if (!lists.length) lists = clauseLists(text, original) || [];
    var odd = [];
    var notes = [];
    lists.forEach(function (list, li) {
      odd = odd.concat(list.odd);
      list.notes.forEach(function (n) {
        n.list = li;
        if (base) n.span = spanOf(full, base + n.span.start, base + n.span.end);
        notes.push(n);
      });
    });
    if (!notes.length) return insufficient();
    if (odd.length) flag("AMBIGUOUS_NOTE", { tokens: odd });
    // Two labelled top lists are two readings of the rim, so neither wins.
    if (labelled && lists.filter(function (l) { return l.role === "top" && l.notes.length; }).length > 1) {
      flag("CONFLICTING_LIST", { tops: true });
    }

    // A ding label restated as the first note of the next list ("Hauptnote C3
    // ... Noten C/ ...") is one note, not two; the restatement lends the ding
    // its octave when the label printed none.
    var dingLabels = notes.filter(function (n) { return n.role === "ding" && !n.paren; });
    var dingClash = null;
    if (dingLabels.length === 1) {
      var dl = dingLabels[0];
      var nextTop = null;
      lists.some(function (list) {
        if (list.role !== "top" || list.notes.indexOf(dl) >= 0) return false;
        nextTop = list.notes.filter(function (n) { return !n.paren; })[0] || null;
        return true;
      });
      var same = nextTop && pcOf(nextTop.name) !== null && pcOf(nextTop.name) === pcOf(dl.name) &&
        (!hasOctave(dl.name) || !hasOctave(nextTop.name) || nextTop.name === dl.name) &&
        (nextTop.sep === "/" || !!dl.bareLabel && (hasOctave(dl.name) || !hasOctave(nextTop.name) ||
          midiOf(nextTop.name) < 60));
      if (same) {
        if (!hasOctave(dl.name) && hasOctave(nextTop.name)) dl.name = nextTop.name;
        notes.splice(notes.indexOf(nextTop), 1);
        lists.forEach(function (list) {
          var at = list.notes.indexOf(nextTop);
          if (at >= 0) list.notes.splice(at, 1);
        });
      } else if (nextTop && (dl.bareLabel || nextTop.sep === "/")) {
        // A spec-row ding the list does not restate, or a slash-marked ding
        // in the list, is a second ding, so neither wins until one is picked.
        dingClash = [dl, nextTop];
      }
    }

    // An earlier run of five or more notes that disagrees with the chosen
    // lists blocks (boullard-battiloro).
    if (labelled) {
      var chosen = notes.map(function (n) { return letters(n.name); }).join(" ");
      var er = new RegExp(RUN.source, "g");
      var em;
      while ((em = er.exec(text))) {
        if (em.index + em[0].length > lists[0].at) break;
        if (runNames(em[0]).join(" ") !== chosen) flag("CONFLICTING_LIST", { earlier: true });
      }
    }

    notes.forEach(function (n, i) { n.index = i; n.octave = hasOctave(n.name); n.midi = midiOf(n.name); });
    var pickable = typeof opts.ding === "number" && opts.ding >= 0 && opts.ding < notes.length;
    if (dingClash && !pickable) flag("CONFLICTING_DING", { notes: dingClash.map(function (n) { return n.index; }) });
    var contested = !!dingClash;

    // Who is the ding?
    var labelDings = notes.filter(function (n) { return n.role === "ding" && !n.paren; });
    var firstTop = null;
    lists.some(function (list) {
      if (list.role !== "top" || !list.notes.length) return false;
      firstTop = list.notes[0];
      return true;
    });
    var ding = null;
    var stray = notes.filter(function (n) { return n.closeMark; });
    function indices(list) { return list.map(function (n) { return n.index; }); }
    if (labelDings.length > 1 || (labelDings.length && stray.length)) contested = true;
    if (pickable) {
      ding = notes[opts.ding];
    } else if (labelDings.length) {
      if (labelDings.length > 1 || stray.length) {
        flag("CONFLICTING_DING", { notes: indices(labelDings.concat(stray)) });
      } else {
        ding = labelDings[0];
      }
    } else if (firstTop && firstTop.paren && notes.filter(function (n) {
      return n.paren && n.list === firstTop.list && n.group === firstTop.group;
    }).length === 1) {
      // A leading parenthesised note before the list is the ding (D-G, Halo).
      ding = firstTop;
      flag("DING_CUE", { notes: [ding.index], cue: "parens" });
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

    // One note per ding label is the cue; a label clause holding more than
    // one note keeps a block under any pick.
    var clauses = {};
    labelDings.forEach(function (n) { (clauses[n.list] = clauses[n.list] || []).push(n); });
    var crowded = [];
    Object.keys(clauses).forEach(function (k) { if (clauses[k].length > 1) crowded = crowded.concat(clauses[k]); });
    if (pickable && crowded.length) flag("DING_CLAUSE_MANY", { notes: indices(crowded) });

    var parensBottom = opts.parens === "bottom";
    notes.forEach(function (n) {
      if (n === ding) n.assigned = "ding";
      else if (pickable && contested && n.role === "ding" && !n.paren && clauses[n.list].length === 1) n.assigned = "dropped";
      else if (n.paren && parensBottom) { n.assigned = "bottom"; n.inline = true; }
      else if (n.paren) n.assigned = "unknown";
      else n.assigned = n.role === "ding" ? "top" : n.role;
    });
    var dropped = notes.filter(function (n) { return n.assigned === "dropped"; });
    if (dropped.length) flag("DING_CUE_DROPPED", { notes: indices(dropped), ding: ding.index });
    if (pickable && ding.role === "bottom") flag("DING_ON_BOTTOM", { ding: ding.index });
    var inlined = notes.filter(function (n) { return n.inline; });
    if (inlined.length) flag("PARENS_AS_BOTTOM", { notes: indices(inlined) });
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

    if (ding && ding.midi !== null && !flags.CONFLICTING_DING) {
      var under = tops.concat(inner).filter(function (n) { return n.midi !== null && n.midi < ding.midi; });
      if (under.length) flag("DING_NOT_LOWEST", { notes: indices(under), ding: ding.index });
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
      if (n.assigned === "unknown" || n.assigned === "dropped" || n.midi === null) return;
      var shell = n.assigned === "bottom" ? "b" : "t";
      (byPitch[n.midi] = byPitch[n.midi] || { t: [], b: [] })[shell].push(n.index);
    });
    var repeated = [];
    var sameShell = [];
    Object.keys(byPitch).forEach(function (k) {
      var g = byPitch[k];
      if (g.t.length > 1) sameShell = sameShell.concat(g.t);
      if (g.b.length > 1) sameShell = sameShell.concat(g.b);
      if (g.t.length && g.b.length) repeated = repeated.concat(g.t, g.b);
    });
    var num = function (a, b) { return a - b; };
    if (sameShell.length && !flags.CONFLICTING_DING) flag("REPEATED_IN_SHELL", { notes: sameShell.sort(num) });
    if (repeated.length) flag("DUPLICATE_PITCH", { notes: repeated.sort(num) });

    var bare = notes.filter(function (n) { return n.assigned !== "unknown" && n.assigned !== "dropped" && !n.octave; });
    if (bare.length) flag("NO_OCTAVE", { notes: indices(bare) });
    var lowBare = bottoms.filter(function (n) { return !n.octave && !n.inline; });
    if (lowBare.length) flag("BOTTOM_NO_OCTAVE", { notes: indices(lowBare) });

    var blocked = !ding || flags.UNDECLARED_PARENS || flags.CONFLICTING_DING || flags.COUNT_MISMATCH ||
                  flags.AMBIGUOUS_NOTE || flags.DING_NOT_LOWEST || flags.REPEATED_IN_SHELL || flags.DING_ON_BOTTOM || flags.DING_CLAUSE_MANY;
    var octaves = {};
    // With parens read as bottoms, each sits at its own place in the source line.
    function inlineString(d) {
      var parts = ["(" + d.name + ")"];
      notes.forEach(function (n) {
        if (n === d || n.assigned === "dropped") return;
        parts.push(n.assigned === "bottom" ? "[" + n.name + "]" : n.name);
      });
      return parts.join(" ");
    }
    if (bare.length && !blocked) {
      var parsed = core().parseSeed(inlined.length ? inlineString(ding) : provisionalString(ding, tops, inner, bottoms));
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
      bottom: bottoms.map(function (n) { return make(n, !n.inline); }),
      inner: inner.map(function (n) { return make(n, false); })
    };
    var listing = notes.map(function (n) {
      var inferred = !n.octave && octaves[n.index] !== undefined;
      return { note: inferred ? octaves[n.index] : n.name, span: n.span, role: n.assigned };
    });
    return finish(roles, listing, total);
  }

  // A narrowed REVIEW stands only when the same reader, over the whole text,
  // gives the same status, string and flags. Any difference BLOCKs, so
  // narrowing can only keep the whole-text reading or refuse.
  function readingOf(r) {
    return JSON.stringify([r.status, serialise(r), r.flags]);
  }

  function guard(r) {
    if (r.status !== "REVIEW") return r;
    var line = serialise(r);
    var parsed = line ? core().parseSeed(line) : { ok: false, code: "EMPTY", reason: "" };
    if (parsed.ok) return r;
    var f = { code: "SEED_REFUSED", refusal: { code: parsed.code, reason: parsed.reason }, level: BLOCK };
    var rank = function (c) { for (var i = 0; i < FLAG_ORDER.length; i++) if (FLAG_ORDER[i][0] === c) return i; return -1; };
    var at = 0;
    while (at < r.flags.length && rank(r.flags[at].code) < rank("SEED_REFUSED")) at++;
    r.flags.splice(at, 0, f);
    r.status = "NEEDS_INPUT";
    return r;
  }

  function interpret(raw, opts) {
    return guard(interpretRaw(raw, opts));
  }

  function interpretRaw(raw, opts) {
    var narrowed = read(raw, opts, true);
    if (narrowed.status !== "REVIEW" || String(raw).length <= NARROW_OVER) return narrowed;
    var whole = read(raw, opts, false);
    if (readingOf(whole) === readingOf(narrowed)) return narrowed;
    narrowed.flags.unshift({ code: "CONFLICTING_LIST", wide: true, level: BLOCK });
    narrowed.status = "NEEDS_INPUT";
    return narrowed;
  }

  // The canonical line for a REVIEW result, or "" when nothing may be written.
  // interpret() never returns a REVIEW result whose line parseSeed refuses: its
  // guard turns that into NEEDS_INPUT with SEED_REFUSED.
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

  // compose(): the four helper fields (ding, top, inner, bottom) to one scale
  // line. Each field is read alone; later fields are checked only against
  // earlier ones that read cleanly, so one slip produces one message.
  var COMPOSE_SOLFEGE = /^(?:do|r[eé]|mi|fa|sol|la|si|ti)(?:#|b|♯|♭)?(?:-1|[0-9])?$/i;
  var COMPOSE_UPPER_B = /^([A-Ga-g])B(?:-1|[0-9])?$/;
  var COMPOSE_NOTE = /^([A-G])(#|b)?(-1|[0-9])?$/;
  var COMPOSE_BARRED = /[()\[\]|]/;
  var COMPOSE_FIELDS = ["ding", "top", "inner", "bottom"];
  var COMPOSE_LOW = -1;
  var COMPOSE_HIGH = 10;

  function composeRange(x) { return x + " is outside C-1 to G9."; }
  function composeLower(x, p) { return x + " is lower than " + p + ": list low to high."; }

  function composeMidi(n, octave) { return core().midiFromName(n.letter, n.acc, octave); }
  function composeFits(midi) { return midi >= 0 && midi <= 127; }
  function composeNamed(n, octave) { return n.letter + n.acc + octave; }

  function composeRead(text) {
    var tokens = String(text === undefined || text === null ? "" : text).trim().split(/[\s,;]+/)
      .filter(function (t) { return t !== ""; });
    var notes = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (COMPOSE_BARRED.test(t)) return { notes: [], error: "Type notes only: the line is written for you." };
      if (COMPOSE_SOLFEGE.test(t)) return { notes: [], error: "Use letter names, like D A Bb." };
      var upper = COMPOSE_UPPER_B.exec(t);
      if (upper) {
        var l = upper[1].toUpperCase();
        return { notes: [], error: l + "B is not a note: write " + l + "-flat as " + l + "b." };
      }
      var m = COMPOSE_NOTE.exec(t.replace(/♯/g, "#").replace(/♭/g, "b").replace(/^./, function (c) { return c.toUpperCase(); }));
      if (!m) return { notes: [], error: "\"" + t + "\" is not a note: try C, F# or Bb." };
      var n = { letter: m[1], acc: m[2] || "", octave: m[3] === undefined ? null : Number(m[3]) };
      if (n.octave !== null && !composeFits(composeMidi(n, n.octave))) {
        return { notes: [], error: composeRange(composeNamed(n, n.octave)) };
      }
      notes.push(n);
    }
    return { notes: notes, error: null };
  }

  // The lowest octave that puts the note strictly above `below` (a midi number).
  function composeAbove(n, below) {
    for (var o = COMPOSE_LOW; o < COMPOSE_HIGH; o++) if (composeMidi(n, o) > below) return o;
    return COMPOSE_HIGH;
  }

  function composeStage(head, notes, below, field, anchorName) {
    var names = [];
    for (var k = 0; k < notes.length; k++) {
      var n = notes[k];
      var octave = n.octave === null ? composeAbove(n, below) : n.octave;
      var midi = composeMidi(n, octave);
      var name = composeNamed(n, octave);
      if (!composeFits(midi)) return { names: names, error: composeRange(name) };
      names.push(name);
      var parsed = core().parseSeed(head + names.join(" "));
      if (!parsed.ok && parsed.code !== "NO_FIFTH") {
        names.pop();
        var before = k ? names[k - 1] : null;
        var error = parsed.reason;
        if (parsed.code === "NOTE_OUT_OF_RANGE") error = composeRange(name);
        else if (parsed.code === "NOTE_REPEATED") error = name + " is already in the top or inner notes.";
        else if (parsed.code === "NOTE_OUT_OF_ORDER") {
          if (before) error = composeLower(name, before);
          else if (field === "top") error = name + " is not above the ding, " + anchorName + ".";
          else error = name + " is below the highest top note, " + anchorName + ".";
        }
        return { names: names, error: error };
      }
      below = midi;
    }
    return { names: names, last: below, error: null };
  }

  function composeBottoms(notes, ding) {
    var names = [];
    var guessed = [];
    var below = null;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      var octave = n.octave;
      var guess = octave === null;
      if (guess) {
        octave = below === null ? ding.octave : composeAbove(n, below);
        var at = composeMidi(n, octave);
        if (at === ding.midi) octave += below === null ? -1 : 1;
      }
      var midi = composeMidi(n, octave);
      var name = composeNamed(n, octave);
      if (octave < COMPOSE_LOW || octave > COMPOSE_HIGH || !composeFits(midi)) {
        return { names: [], guessed: [], error: n.letter + n.acc + " has no octave that fits: type one." };
      }
      if (below !== null && midi === below) return { names: [], guessed: [], error: name + " is already in the bottom notes." };
      if (below !== null && midi < below) return { names: [], guessed: [], error: composeLower(name, names[i - 1]) };
      names.push(name);
      if (guess) guessed.push(name);
      below = midi;
    }
    return { names: names, guessed: guessed, error: null };
  }

  function compose(fields) {
    fields = fields || {};
    var out = {
      ok: false, empty: false, line: "", seed: null,
      errors: { ding: null, top: null, inner: null, bottom: null },
      info: { bottom: null }, guessed: [],
      notes: { ding: [], top: [], inner: [], bottom: [] }
    };
    var read = {};
    COMPOSE_FIELDS.forEach(function (f) { read[f] = composeRead(fields[f]); });
    if (COMPOSE_FIELDS.every(function (f) { return !read[f].error && !read[f].notes.length; })) {
      out.empty = true;
      return out;
    }
    COMPOSE_FIELDS.forEach(function (f) { out.errors[f] = read[f].error; });

    var ding = null;
    if (!out.errors.ding) {
      if (!read.ding.notes.length) out.errors.ding = "Enter the ding, like D3.";
      else if (read.ding.notes.length > 1) out.errors.ding = "Enter one note for the ding.";
      else {
        var d = read.ding.notes[0];
        var dOctave = d.octave === null ? 3 : d.octave;
        ding = { letter: d.letter, acc: d.acc, octave: dOctave, name: composeNamed(d, dOctave), midi: composeMidi(d, dOctave) };
        out.notes.ding = [ding.name];
      }
    }

    var top = null;
    var topMidi = null;
    var inner = null;
    if (!out.errors.top && !read.top.notes.length) out.errors.top = "Enter the top notes, low to high.";
    if (ding && !out.errors.top) {
      var staged = composeStage("(" + ding.name + ") ", read.top.notes, ding.midi, "top", ding.name);
      if (staged.error) out.errors.top = staged.error;
      else { top = staged.names; topMidi = staged.last; }
    }
    if (top) {
      out.notes.top = top;
      if (read.inner.notes.length && !out.errors.inner) {
        var high = top[top.length - 1];
        var upper = composeStage("(" + ding.name + ") " + top.join(" ") + " | ", read.inner.notes, topMidi, "inner", high);
        if (upper.error) out.errors.inner = upper.error;
        else inner = upper.names;
      } else if (!out.errors.inner) inner = [];
    }
    if (inner) {
      out.notes.inner = inner;
      var full = core().parseSeed("(" + ding.name + ") " + top.join(" ") + (inner.length ? " | " + inner.join(" ") : ""));
      if (!full.ok && full.code === "NO_FIFTH") {
        out.errors.ding = "No fifth above the ding " + ding.name + ": add " + core().fifthName(ding.letter, ding.acc) + " to the top notes, or check the ding.";
      } else if (!full.ok) out.errors.top = full.reason;
    }

    var bottom = null;
    if (ding && !out.errors.bottom) {
      var placed = composeBottoms(read.bottom.notes, ding);
      if (placed.error) out.errors.bottom = placed.error;
      else bottom = placed;
    }
    if (bottom) {
      out.notes.bottom = bottom.names;
      out.guessed = bottom.guessed;
      if (bottom.guessed.length) {
        out.info.bottom = "Octaves guessed: " + bottom.guessed.join(", ") + ". Type an octave to change a guess.";
      }
    }

    if (ding && top && inner && bottom && COMPOSE_FIELDS.every(function (f) { return !out.errors[f]; })) {
      var roles = {
        ding: { note: ding.name },
        top: top.map(function (x) { return { note: x }; }),
        inner: inner.map(function (x) { return { note: x }; }),
        bottom: bottom.names.map(function (x) { return { note: x }; })
      };
      var line = serialise({ status: "REVIEW", roles: roles });
      var parsed = core().parseSeed(line);
      if (parsed.ok) {
        out.ok = true;
        out.line = line;
        out.seed = parsed.value;
      } else {
        out.errors.bottom = parsed.reason;
      }
    }
    return out;
  }

  HPE.importer = {
    interpret: interpret,
    serialise: serialise,
    compose: compose
  };
})(HPE);
