/* HPE.sequence - chord-sequence mode: anchors, connect rule and a seeded draw.
 *
 * Plain script, no module wrapper: index.html is a single self-contained file
 * by contract, so this text has to be inlinable verbatim. `var`, not `const`,
 * so the namespace lands on the global object of a node:vm context too.
 *
 * Normative source: docs/plans/2026-09-29-chord-sequence-mode.md section 2
 * Part A (the rule) and section 8 (E1, E4).
 *
 * This module reads only `deck.fields` (id -> [name, octave, midi, zone,
 * angle, label]) and `deck.chords[].{fields, roots}` - the same shape for a
 * built-in deck (data/decks.json) and a generated one (HPE.select.build's
 * output) - and depends on no other engine module.
 */
var HPE = (typeof HPE !== "undefined") ? HPE : {};

(function (HPE) {
  "use strict";

  var STYLES = ["together", "arpeggio", "three-over-two", "three-three-two",
                "paradiddle", "groove", "freestyle"];

  // Length buckets are tried in this order when both exist. The order is
  // otherwise immaterial to the 50/50 draw (the index into the surviving
  // bucket list is still drawn uniformly), so this is a free implementation
  // choice, not a documented rule.
  var LENGTH_ORDER = [3, 2];

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

  // The four shapes anchors() will accept, keyed by their interval set
  // (sorted, from the root) so a lookup is a plain string compare. Tiers:
  // maj/min (0) > sus4 (1) > dim (2) > power chord (3), per the plan.
  var SHAPE_TIER = {
    "0,3,7": 0, // minor triad
    "0,4,7": 0, // major triad
    "0,5,7": 1, // sus4
    "0,3,6": 2, // diminished triad
    "0,7": 3    // power chord
  };

  function uniquePcs(deck, ids) {
    var out = [];
    for (var i = 0; i < ids.length; i += 1) {
      var value = fieldPc(deck, ids[i]);
      if (out.indexOf(value) < 0) out.push(value);
    }
    return out;
  }

  // null when this chord cannot anchor any root: too many fields, or its
  // pitch-class set (relative to its own root) is not one of the four shapes.
  function chordShape(deck, chordIndex) {
    var chord = deck.chords[chordIndex];
    if (chord.fields.length > 3) return null;
    var rootPc = fieldPc(deck, chord.roots[0]);
    var intervals = [];
    for (var i = 0; i < chord.fields.length; i += 1) {
      var value = pc(fieldPc(deck, chord.fields[i]) - rootPc);
      if (intervals.indexOf(value) < 0) intervals.push(value);
    }
    intervals.sort(function (a, b) { return a - b; });
    var tier = SHAPE_TIER[intervals.join(",")];
    if (tier === undefined) return null;
    var bottomCount = 0;
    for (i = 0; i < chord.fields.length; i += 1) {
      if (fieldZone(deck, chord.fields[i]) === "bottom") bottomCount += 1;
    }
    return { index: chordIndex, rootPc: rootPc, tier: tier, bottomCount: bottomCount };
  }

  // One anchor per root: at most 3 fields, a maj/min triad, sus4, dim triad
  // or power chord, preferring maj/min > sus4 > dim > power, ties to fewer
  // bottom-shell fields, then to deck order (§2 Part A). Ascending iteration
  // plus a strict-improvement replace means the first chord seen for a root
  // already wins every tie, so no separate index tie-break is needed.
  function anchors(deck) {
    var byRoot = {};
    for (var i = 0; i < deck.chords.length; i += 1) {
      var shape = chordShape(deck, i);
      if (!shape) continue;
      var existing = byRoot[shape.rootPc];
      if (!existing || shape.tier < existing.tier ||
          (shape.tier === existing.tier && shape.bottomCount < existing.bottomCount)) {
        byRoot[shape.rootPc] = shape;
      }
    }
    var list = [];
    for (var key in byRoot) {
      if (Object.prototype.hasOwnProperty.call(byRoot, key)) list.push(byRoot[key]);
    }
    list.sort(function (a, b) { return a.index - b.index; });
    return list.map(function (s) { return s.index; });
  }

  // C2: consecutive chords share a pitch class, or their roots are 1-2
  // semitones apart (circular pitch-class distance).
  function connects(deck, aIndex, bIndex) {
    var a = deck.chords[aIndex];
    var b = deck.chords[bIndex];
    var apcs = uniquePcs(deck, a.fields);
    var bpcs = uniquePcs(deck, b.fields);
    for (var i = 0; i < apcs.length; i += 1) {
      if (bpcs.indexOf(apcs[i]) >= 0) return true;
    }
    var aRoot = fieldPc(deck, a.roots[0]);
    var bRoot = fieldPc(deck, b.roots[0]);
    var diff = pc(aRoot - bRoot);
    if (diff > 6) diff = 12 - diff;
    return diff === 1 || diff === 2;
  }

  function homeAnchor(deck, anchorsList) {
    var home = homePc(deck);
    for (var i = 0; i < anchorsList.length; i += 1) {
      if (fieldPc(deck, deck.chords[anchorsList[i]].roots[0]) === home) {
        return anchorsList[i];
      }
    }
    return null;
  }

  // sequences(deck, length): every length-2 or length-3 sequence starting on
  // the home anchor, visiting distinct roots, connecting every consecutive
  // pair (C2) and, at length 3, looping back to the start. Returns [] when
  // there is no home anchor or no sequence of that length - callers that need
  // to tell those two apart use anchors()/homeAnchor directly (pick() does).
  function sequences(deck, length) {
    if (length !== 2 && length !== 3) {
      throw new Error("HPE.sequence.sequences: length must be 2 or 3");
    }
    var anchorsList = anchors(deck);
    var home = homeAnchor(deck, anchorsList);
    if (home === null) return [];
    var others = anchorsList.filter(function (idx) { return idx !== home; });
    var out = [];
    if (length === 2) {
      others.forEach(function (idx) {
        if (connects(deck, home, idx)) out.push([home, idx]);
      });
      return out;
    }
    others.forEach(function (b) {
      if (!connects(deck, home, b)) return;
      others.forEach(function (c) {
        if (c === b) return;
        if (connects(deck, b, c) && connects(deck, c, home)) out.push([home, b, c]);
      });
    });
    return out;
  }

  function sameSequence(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
    return true;
  }

  // mulberry32: a small, fast, deterministic PRNG (public-domain), used so
  // tests can seed pick() without touching Math.random.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function draw(rng, n) {
    var i = Math.floor(rng() * n);
    return i >= n ? n - 1 : i;
  }

  // {chords, style} or {chords:null, reason}. E1: NO_HOME_CHORD is checked
  // before TOO_FEW_CHORDS. E4: `prev` (an array of chord indices) is removed
  // from the candidate pools BEFORE the length is drawn, evenly among the
  // pools that remain non-empty; there is no rejection loop. A `prev`
  // containing an index outside the deck is ignored. If excluding `prev`
  // would empty every pool although at least one existed before, the
  // exclusion is skipped instead of returning nothing - the sequence just
  // shown is also the only one this deck can offer.
  function pick(deck, rng, prev) {
    var anchorsList = anchors(deck);
    if (homeAnchor(deck, anchorsList) === null) {
      return { chords: null, reason: "NO_HOME_CHORD" };
    }
    var pools = { 2: sequences(deck, 2), 3: sequences(deck, 3) };
    if (!pools[2].length && !pools[3].length) {
      return { chords: null, reason: "TOO_FEW_CHORDS" };
    }

    var prevValid = Array.isArray(prev) && prev.length > 0 &&
      prev.every(function (idx) {
        return typeof idx === "number" && idx >= 0 && idx < deck.chords.length;
      });

    var filtered = { 2: pools[2], 3: pools[3] };
    if (prevValid) {
      filtered = {
        2: pools[2].filter(function (seq) { return !sameSequence(seq, prev); }),
        3: pools[3].filter(function (seq) { return !sameSequence(seq, prev); })
      };
      if (!filtered[2].length && !filtered[3].length) filtered = pools;
    }

    var available = [];
    LENGTH_ORDER.forEach(function (len) {
      if (filtered[len].length) available.push(filtered[len]);
    });

    var chosenPool = available[draw(rng, available.length)];
    var chosen = chosenPool[draw(rng, chosenPool.length)];
    var style = STYLES[draw(rng, STYLES.length)];
    return { chords: chosen.slice(), style: style };
  }

  HPE.sequence = {
    STYLES: STYLES,
    anchors: anchors,
    sequences: sequences,
    pick: pick,
    mulberry32: mulberry32
  };
})(HPE);
