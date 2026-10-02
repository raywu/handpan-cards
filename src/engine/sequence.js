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
  //
  // This is BASIC's untouched code path (D-1): pick(deck, rng, prev) and
  // pick(deck, rng, prev, "basic") both resolve here, byte-identical in
  // output and rng consumption to the pre-tier implementation.
  function pickBasic(deck, rng, prev) {
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

  // ---- Tiers (D-1..D-6) ------------------------------------------------

  var TIERS = ["basic", "intermediate", "advanced"];

  // Pool/start-set length ranges per tier, per D-2 §2.2/D-3.
  var TIER_LENGTHS = { intermediate: [3, 4], advanced: [4, 5, 6] };

  function chordRootPc(deck, i) {
    return fieldPc(deck, deck.chords[i].roots[0]);
  }

  function chordName(deck, i) {
    var c = deck.chords[i];
    return c.main + (c.sup || "");
  }

  function chordIsSus(deck, i) {
    return (/sus/).test(chordName(deck, i));
  }

  // D-4: a card is LOW/HIGH iff its subtitle matches this exactly. Applies
  // identically to built-in and generated decks (HPE.select.build / naming.js
  // pass voicingClass straight into subtitle() on both).
  function chordRegister(deck, i) {
    var sub = deck.chords[i].subtitle || "";
    if ((/\b(LOW|HIGH) VOICING\b/).test(sub)) return "register";
    return "";
  }

  // A repeated root at position k (first seen at position j < k, reading the
  // sequence as a loop) is allowed under the INTERMEDIATE repeat rule only
  // when j and k are adjacent - in EITHER direction around the loop,
  // including the wrap - and the earlier one resolves into the later: a sus
  // chord whose own root carries over to a non-sus chord next.
  function repeatResolves(deck, seq, j, k) {
    var n = seq.length;
    function resolvesAt(a, b) {
      return chordIsSus(deck, seq[a]) &&
        chordRootPc(deck, seq[a]) === chordRootPc(deck, seq[b]) &&
        !chordIsSus(deck, seq[b]);
    }
    if ((j + 1) % n === k) return resolvesAt(j, k);
    if ((k + 1) % n === j) return resolvesAt(k, j);
    return false;
  }

  function hasForbiddenRepeat(deck, seq, allowResolvedRepeat) {
    var roots = seq.map(function (i) { return chordRootPc(deck, i); });
    for (var k = 0; k < roots.length; k += 1) {
      var j = roots.indexOf(roots[k]);
      if (j === k) continue;
      if (allowResolvedRepeat && repeatResolves(deck, seq, j, k)) continue;
      return true;
    }
    return false;
  }

  function basicGate(deck, seq, anchorsList, homeAnchorIdx) {
    if (seq.length !== 2 && seq.length !== 3) return false;
    if (seq[0] !== homeAnchorIdx) return false;
    if (hasForbiddenRepeat(deck, seq, false)) return false;
    for (var i = 0; i < seq.length; i += 1) {
      if (anchorsList.indexOf(seq[i]) < 0) return false;
    }
    return true;
  }

  function intermediateGate(deck, seq, home) {
    if (seq.length !== 3 && seq.length !== 4) return false;
    if (chordRootPc(deck, seq[0]) !== home) return false;
    if (hasForbiddenRepeat(deck, seq, true)) return false;
    for (var i = 0; i < seq.length; i += 1) {
      if (deck.chords[seq[i]].fields.length > 4) return false;
      if (chordRegister(deck, seq[i]) !== "") return false;
    }
    return true;
  }

  // tierOf(deck, chords): the allowance-table classifier from Part 2 of the
  // spec (binding). Each tier allows everything the tier below allows plus
  // more, so classifying by trying BASIC's gate, then INTERMEDIATE's, and
  // defaulting to ADVANCED is equivalent to "must use at least one thing the
  // tier below forbids": the only way to fail a lower gate while passing the
  // next is to use something the lower tier disallows.
  function tierOf(deck, chords) {
    if (!Array.isArray(chords) || chords.length === 0) {
      throw new Error("HPE.sequence.tierOf: chords must be a non-empty array");
    }
    var anchorsList = anchors(deck);
    var home = homePc(deck);
    var homeAnchorIdx = homeAnchor(deck, anchorsList);
    if (basicGate(deck, chords, anchorsList, homeAnchorIdx)) return "basic";
    if (intermediateGate(deck, chords, home)) return "intermediate";
    return "advanced";
  }

  function tierPool(deck, tier) {
    var n = deck.chords.length;
    var out = [];
    for (var i = 0; i < n; i += 1) {
      if (tier === "advanced" ||
          (deck.chords[i].fields.length <= 4 && chordRegister(deck, i) === "")) {
        out.push(i);
      }
    }
    return out;
  }

  function tierStartSet(deck, tier, pool) {
    if (tier === "advanced") return pool;
    var home = homePc(deck);
    return pool.filter(function (i) { return chordRootPc(deck, i) === home; });
  }

  function buildConnectMatrix(deck) {
    var n = deck.chords.length;
    var m = new Array(n);
    for (var i = 0; i < n; i += 1) {
      m[i] = new Array(n);
      for (var j = 0; j < n; j += 1) {
        m[i][j] = connects(deck, i, j);
      }
    }
    return m;
  }

  // Bounded exhaustive DFS over sequences of length `len`, seq[0] from
  // `startSet`, seq[1..] from `pool`, collecting every one `accept` likes.
  // Stops after visiting `budget` nodes (a node = one partial sequence of
  // any depth); D-2's fallback.
  function dfsFindAll(startSet, pool, len, accept, budget) {
    var found = [];
    var nodes = 0;
    var seq = new Array(len);
    function rec(depth) {
      if (nodes >= budget) return;
      nodes += 1;
      if (depth === len) {
        if (accept(seq)) found.push(seq.slice());
        return;
      }
      var options = depth === 0 ? startSet : pool;
      for (var i = 0; i < options.length && nodes < budget; i += 1) {
        seq[depth] = options[i];
        rec(depth + 1);
      }
    }
    rec(0);
    return found;
  }

  // One attempt at a fixed length: up to 512 uniform random draws, then the
  // bounded DFS fallback. `empty` is true only when the fallback (whether it
  // completed or hit the node budget) found literally nothing, per D-2 "a
  // search that hits the budget ... reports the length empty only if it
  // found nothing".
  function attemptLength(deck, rng, tier, len, matrix, excludeSeq) {
    var pool = tierPool(deck, tier);
    var startSet = tierStartSet(deck, tier, pool);
    if (!startSet.length || !pool.length) return { seq: null, empty: true };

    function accept(seq) {
      if (excludeSeq && sameSequence(seq, excludeSeq)) return false;
      if (tierOf(deck, seq) !== tier) return false;
      for (var i = 0; i < seq.length; i += 1) {
        var next = seq[(i + 1) % seq.length];
        // No consecutive repeat: playing the identical card back-to-back is
        // never musically meaningful, in any tier - distinct from the
        // repeated-ROOT rule the tier gates above already enforce.
        if (seq[i] === next) return false;
        if (!matrix[seq[i]][next]) return false;
      }
      return true;
    }

    for (var attempt = 0; attempt < 512; attempt += 1) {
      var seq = [startSet[draw(rng, startSet.length)]];
      for (var k = 1; k < len; k += 1) seq.push(pool[draw(rng, pool.length)]);
      if (accept(seq)) return { seq: seq, empty: false };
    }

    var found = dfsFindAll(startSet, pool, len, accept, 200000);
    if (found.length) {
      return { seq: found[draw(rng, found.length)], empty: false };
    }
    return { seq: null, empty: true };
  }

  // Draws a length uniformly among those not yet proven empty, attempts it,
  // and drops/redraws per D-3 when an attempt proves its length empty.
  function drawFromLengths(deck, rng, tier, lengths, matrix, excludeSeq) {
    var remaining = lengths.slice();
    while (remaining.length) {
      var idx = draw(rng, remaining.length);
      var len = remaining[idx];
      var attempt = attemptLength(deck, rng, tier, len, matrix, excludeSeq);
      if (attempt.seq) return attempt.seq;
      remaining.splice(idx, 1);
    }
    return null;
  }

  // INTERMEDIATE/ADVANCED per D-2/D-3/D-6. NO_HOME_CHORD is checked by the
  // caller (pick) before this runs, so it keeps priority on every tier.
  function pickTiered(deck, rng, prev, tier) {
    var matrix = buildConnectMatrix(deck);
    var lengths = TIER_LENGTHS[tier];

    var prevValid = Array.isArray(prev) && prev.length > 0 &&
      prev.every(function (idx) {
        return typeof idx === "number" && idx >= 0 && idx < deck.chords.length;
      });

    // Phase 1: exclude prev, mirroring BASIC's E4 rule.
    var found = drawFromLengths(deck, rng, tier, lengths, matrix, prevValid ? prev : null);
    // Phase 2: prev may be the only sequence this tier has - include it.
    if (!found && prevValid) {
      found = drawFromLengths(deck, rng, tier, lengths, matrix, null);
    }
    if (!found) {
      return { chords: null, reason: "NO_TIER_SEQUENCE" };
    }
    var style = STYLES[draw(rng, STYLES.length)];
    return { chords: found, style: style };
  }

  // {chords, style} or {chords:null, reason}. D-1: tier in
  // "basic" | "intermediate" | "advanced"; undefined means "basic"; any
  // other value throws. D-6: NO_HOME_CHORD keeps priority on every tier.
  function pick(deck, rng, prev, tier) {
    var t = (tier === undefined) ? "basic" : tier;
    if (TIERS.indexOf(t) < 0) {
      throw new Error("HPE.sequence.pick: unknown tier");
    }
    if (t === "basic") {
      return pickBasic(deck, rng, prev);
    }
    var anchorsList = anchors(deck);
    if (homeAnchor(deck, anchorsList) === null) {
      return { chords: null, reason: "NO_HOME_CHORD" };
    }
    return pickTiered(deck, rng, prev, t);
  }

  HPE.sequence = {
    STYLES: STYLES,
    TIERS: TIERS,
    anchors: anchors,
    sequences: sequences,
    tierOf: tierOf,
    pick: pick,
    mulberry32: mulberry32
  };
})(HPE);
