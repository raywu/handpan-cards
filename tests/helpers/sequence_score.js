// A test-only scorer for the Q/F/L/M/R/S/H axes of
// docs/plans/2026-10-02-sequence-difficulty.md, Part 2 "Score axes" of the
// Pygmy Progression Tiers doc (artifact f14b7860-bf38-4c6d-b579-f54f9535b405,
// rev 56). Backs the golden-fixture tests in tests/sequence.test.js.
//
// D-5 / eng finding E-6: this helper computes AXES ONLY. It never calls
// HPE.sequence.tierOf, so the golden fixtures (card numbers lifted straight
// from the spec doc) stay an INDEPENDENT oracle against the engine's own
// tier classifier - if this file called tierOf to grade itself, a bug shared
// by both would never show up as a test failure.
//
// It reimplements small pieces of the engine (pc/fieldPc/connects-adjacent
// helpers) rather than importing engine internals, for the same reason:
// tests/CONTRACT.md rule 2 forbids a test mirroring the module it tests, and
// this is the module the sequence engine's own tierOf is tested against.
// `anchors` is the one exception, reused directly from HPE.sequence.anchors
// since the spec itself defines "quality" in terms of anchors ("a sus that
// is its root's anchor counts as a triad") - anchors() is not the tier
// classifier and carries no tier logic of its own.
"use strict";

function pc(n) {
  return ((n % 12) + 12) % 12;
}

function field(deck, id) {
  return deck.fields[String(id)];
}

function fieldPc(deck, id) {
  return pc(field(deck, id)[2]);
}

function fieldZone(deck, id) {
  return field(deck, id)[3];
}

function homePc(deck) {
  for (var id in deck.fields) {
    if (Object.prototype.hasOwnProperty.call(deck.fields, id) &&
        deck.fields[id][3] === "ding") {
      return pc(deck.fields[id][2]);
    }
  }
  return null;
}

function chord(deck, i) {
  return deck.chords[i];
}

function rootPc(deck, i) {
  return fieldPc(deck, chord(deck, i).roots[0]);
}

function chordName(deck, i) {
  var c = chord(deck, i);
  return c.main + (c.sup || "");
}

function isSus(deck, i) {
  return /sus/.test(chordName(deck, i));
}

function registerOf(deck, i) {
  var sub = chord(deck, i).subtitle || "";
  if (/\bLOW VOICING\b/.test(sub)) return "LOW";
  if (/\bHIGH VOICING\b/.test(sub)) return "HIGH";
  return "";
}

function chordMidis(deck, i) {
  return chord(deck, i).fields.map(function (f) { return field(deck, f)[2]; });
}

function bottomCount(deck, i) {
  return chord(deck, i).fields.filter(function (f) {
    return fieldZone(deck, f) === "bottom";
  }).length;
}

// score(deck, seq, anchorsList): seq is an array of 0-based chord indices,
// read as a loop (the last element connects back to the first). anchorsList
// is the array HPE.sequence.anchors(deck) returns - the caller passes it in
// so this file never has to import the engine.
function score(deck, seq, anchorsList) {
  var n = seq.length;
  var home = homePc(deck);
  var anchorSet = new Set(anchorsList || []);

  function deg(i) { return pc(rootPc(deck, i) - home); }

  function resolves(k) {
    var i = seq[k];
    var j = seq[(k + 1) % n];
    return isSus(deck, i) && rootPc(deck, j) === rootPc(deck, i) && !isSus(deck, j);
  }

  // Q - chord quality
  var q = 0;
  seq.forEach(function (i, k) {
    var nf = chord(deck, i).fields.length;
    var suspended = isSus(deck, i);
    var isAnchor = anchorSet.has(i);
    if (nf >= 5) {
      q = 2;
    } else if (suspended && !isAnchor && !resolves(k)) {
      q = 2;
    } else if (nf === 4 || (suspended && !isAnchor)) {
      q = Math.max(q, 1);
    }
  });

  // F - function (moves)
  var degs = seq.map(deg);
  var moves = 0;
  for (var k = 0; k < n; k += 1) {
    if (resolves(k)) moves += 1;
    var a = degs[k], b = degs[(k + 1) % n], cc = degs[(k + 2) % n];
    if (b === 0 && a !== 0 && Math.min(a, 12 - a) <= 2) {
      moves += 1;
    } else if (cc === 0 && ((a === 5 && b === 7) || (a === 2 && b === 7))) {
      moves += 1;
    }
  }
  var playsHome = degs.indexOf(0) >= 0;
  var f = (moves >= 2 || !playsHome) ? 2 : moves;

  // L - length
  var l = n <= 3 ? 0 : (n === 4 ? 1 : 2);

  // M - movement (new fields per change, including the wrap)
  var newFieldsTotal = 0;
  for (k = 0; k < n; k += 1) {
    var curFields = new Set(chord(deck, seq[k]).fields);
    var nextFields = chord(deck, seq[(k + 1) % n]).fields;
    newFieldsTotal += nextFields.filter(function (fld) { return !curFields.has(fld); }).length;
  }
  var avgNew = newFieldsTotal / n;
  var m = avgNew <= 1.5 ? 0 : (avgNew <= 2.5 ? 1 : 2);

  // R - register
  var allMidis = [];
  seq.forEach(function (i) { allMidis = allMidis.concat(chordMidis(deck, i)); });
  var span = Math.max.apply(null, allMidis) - Math.min.apply(null, allMidis);
  var regs = seq.map(function (i) { return registerOf(deck, i); });
  var r = (regs.indexOf("LOW") >= 0 || span > 26) ? 2
    : (regs.indexOf("HIGH") >= 0 || span > 19) ? 1 : 0;

  // S - start
  var s = deg(seq[0]) === 0 ? 0 : (playsHome ? 1 : 2);

  // H - bottom shell
  var bottomTotal = 0;
  seq.forEach(function (i) { bottomTotal += bottomCount(deck, i); });
  var h = bottomTotal <= 3 ? 0 : (bottomTotal <= 6 ? 1 : 2);

  var total = q + f + l + m + r + s + h;
  return { Q: q, F: f, L: l, M: m, R: r, S: s, H: h, total: total };
}

module.exports = { score: score };
