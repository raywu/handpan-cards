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
 * output). It reads `HPE.core` lazily, at use time (see `core()` below), so
 * core must be loaded before any function here runs but not before this file.
 */
var HPE = (typeof HPE !== "undefined") ? HPE : {};

(function (HPE) {
  "use strict";

  var STYLES = ["together", "arpeggio", "three-over-two", "three-three-two",
                "paradiddle", "groove", "freestyle"];

  // Tier shape constants (docs/plans/2026-10-04-tier-rebalance.md section 3).
  // BASIC (R-2): length 2/3/4 at 40/40/20, start on home 80% of the time and
  // on the relative start 20%. MEDIUM (R-5): length 3/4 at 60/40, a pure-
  // anchor deal one time in three, the colour families at equal shares, a
  // home-rooted start 40%. Every weight is renormalised over the options
  // that have a non-empty cell (weightedDraw divides by the sum it is given).
  var BASIC_LENGTH_WEIGHT = { 2: 0.4, 3: 0.4, 4: 0.2 };
  var BASIC_SIDE_WEIGHT = { home: 0.8, relative: 0.2 };
  var MEDIUM_LENGTH_WEIGHT = { 3: 0.6, 4: 0.4 };
  var MEDIUM_KIND_WEIGHT = { pure: 1 / 3, colour: 2 / 3 };
  var MEDIUM_SIDE_WEIGHT = { home: 0.4, other: 0.6 };
  var COLOUR_FAMILIES = ["seventh", "susPower", "other"];

  // R-3: a BASIC pool of fewer than this many loops (lengths 2-4 together)
  // is not a practice tier, so BASIC's vocabulary widens to every anchor.
  var MIN_BASIC_POOL = 12;

  // R-10: MEDIUM is enumerated once per pick(). Every built-in deck, every
  // preset and every pan of eight or fewer pitch classes finishes well inside
  // this (Pygmy 23,646 nodes; the 59-chord N=19 sweep decks 36,000), but with
  // the deck size cap gone (D16) a custom pan of nine or more pitch classes
  // can need hundreds of thousands. Running out is a supported outcome: the
  // fixed-order DFS prefix would open every length-4 deal on the same few
  // cards, so a truncated enumeration is replaced by a random-walk sample
  // (sampleMedium), drawn from the caller's rng, under the same budget.
  var MEDIUM_ENUM_BUDGET = 60000;

  // D-2's bounded-DFS fallback node budget (eng E-3 budget-hit semantics: a
  // truncated search draws uniformly from what it found so far and reports
  // the length empty only if it found nothing). The plan's own figure was
  // 200,000; perf review on PR #202 found that, even after precomputing
  // anchors/home once per pick() and pruning the DFS on connectivity and the
  // no-consecutive-repeat rule, a stuck-rng (every draw forced to 0) worst
  // case on the built-in Pygmy deck (52 chords, the largest built-in) still
  // measured ~100ms at 200,000 - the fallback explores its full budget
  // whenever the tier's pool is this large and well-connected, independent
  // of pruning, because the accepted set itself can be close to that size.
  // 40,000 measured ~22-27ms locally on the same worst case, but CI's
  // runner is slower than local hardware: the same 40,000-budget build
  // measured 64ms in CI (job 110789441606, still over the 50ms bound).
  // 15,000 measured ~8.4-10.5ms locally (a budget sweep at 40k/30k/25k/
  // 20k/15k/10k showed a near-linear budget-to-time relationship, so the
  // ~2.5-3x local-to-CI slowdown observed at 40,000 projects 15,000 to
  // roughly 20-26ms in CI), comfortably under the 50ms bound (D1 step 6 /
  // D-11) with margin for CI variance, while staying far larger than the
  // space of any realistic generated deck that would actually reach this
  // fallback (per D-2's own note, "a tiny generated pan is the only
  // realistic way to reach the fallback, and its space is small enough
  // for the budget") - the reduction only tightens the pathological worst
  // case, not realistic use.
  var DFS_NODE_BUDGET = 15000;

  function core() {
    return HPE.core;
  }

  function pc(n) {
    return core().pc(n);
  }

  // A property key is converted to a string anyway, so the lookup needs no
  // String(): that global call cost ~3x on the MEDIUM enumeration under
  // node:vm, enough to push a 19-field deck's pick past 50ms in CI.
  function field(deck, id) {
    return deck.fields[id];
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
          core().isDing(deck.fields[id])) {
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
    var key = intervals.join(",");
    var tier = SHAPE_TIER[key];
    if (tier === undefined) return null;
    var bottomCount = 0;
    for (i = 0; i < chord.fields.length; i += 1) {
      if (fieldZone(deck, chord.fields[i]) === "bottom") bottomCount += 1;
    }
    return { index: chordIndex, rootPc: rootPc, tier: tier, key: key, bottomCount: bottomCount };
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

  function chordRootPc(deck, i) {
    return fieldPc(deck, deck.chords[i].roots[0]);
  }

  // Every loop of 2, 3 or 4 distinct `vocab` cards that starts on one of
  // `starts`, connects every consecutive pair (C2) and connects the last
  // chord back to the first: pools[length][s] lists the loops starting on
  // starts[s]. Order within a list: each later position in `vocab` order.
  // connects() is evaluated once per pair, not once per visited node - a
  // BASIC pick and every tierOf() pay this.
  function basicLoops(deck, vocab, starts) {
    var pools = { 2: [], 3: [], 4: [] };
    var n = vocab.length;
    var adj = new Array(n);
    var i, j;
    for (i = 0; i < n; i += 1) {
      adj[i] = new Array(n);
      for (j = 0; j < n; j += 1) {
        adj[i][j] = i !== j && connects(deck, vocab[i], vocab[j]);
      }
    }
    var seq = [];
    var used = new Array(n);
    function rec(s) {
      var last = seq[seq.length - 1];
      if (seq.length >= 2 && adj[last][seq[0]]) {
        pools[seq.length][s].push(seq.map(function (k) { return vocab[k]; }));
      }
      if (seq.length === 4) return;
      for (var k = 0; k < n; k += 1) {
        if (used[k] || !adj[last][k]) continue;
        used[k] = true;
        seq.push(k);
        rec(s);
        seq.pop();
        used[k] = false;
      }
    }
    for (var s = 0; s < starts.length; s += 1) {
      pools[2].push([]);
      pools[3].push([]);
      pools[4].push([]);
      i = vocab.indexOf(starts[s]);
      for (j = 0; j < n; j += 1) used[j] = false;
      used[i] = true;
      seq = [i];
      rec(s);
    }
    return pools;
  }

  function loopCount(pools) {
    var total = 0;
    [2, 3, 4].forEach(function (len) {
      pools[len].forEach(function (list) { total += list.length; });
    });
    return total;
  }

  // Everything the tier gates and pickers need to know about a deck, computed
  // once per pick() / tierOf() and never cached (R-10):
  //   anchorsList, home (pitch class), homeAnchorIdx  - as before;
  //   dimAnchors   - the anchors that are diminished triads (R-4);
  //   basicVocab   - R-1: the home anchor (whatever its shape, TR-1) plus
  //                  every major/minor triad anchor; R-3: every anchor when
  //                  that leaves fewer than MIN_BASIC_POOL loops;
  //   basicStarts  - [home anchor], plus, when the home anchor is a MINOR
  //                  triad, every major OR minor triad anchor rooted a minor
  //                  third (3 semitones) above home. That second start is
  //                  the "relative" start everywhere in this file and its
  //                  tests: on the built-in decks it is the relative major,
  //                  but the rule does not require a major triad;
  //   basicCells   - the BASIC pool as (length, side) cells, lengths ascending
  //                  and home before relative; empty cells are left out.
  // A deck with no home anchor has no BASIC vocabulary, starts or cells.
  function tierContext(deck) {
    var anchorsList = anchors(deck);
    var homeAnchorIdx = homeAnchor(deck, anchorsList);
    var ctx = {
      anchorsList: anchorsList,
      home: homePc(deck),
      homeAnchorIdx: homeAnchorIdx,
      dimAnchors: anchorsList.filter(function (i) { return chordShape(deck, i).tier === 2; }),
      basicVocab: [],
      basicStarts: [],
      basicCells: []
    };
    if (homeAnchorIdx === null) return ctx;

    var triads = anchorsList.filter(function (i) { return chordShape(deck, i).tier === 0; });
    var starts = [homeAnchorIdx];
    if (chordShape(deck, homeAnchorIdx).key === "0,3,7") {
      var relative = pc(ctx.home + 3);
      triads.forEach(function (i) {
        if (chordRootPc(deck, i) === relative) starts.push(i);
      });
    }
    var vocab = anchorsList.filter(function (i) {
      return i === homeAnchorIdx || triads.indexOf(i) >= 0;
    });
    var pools = basicLoops(deck, vocab, starts);
    if (loopCount(pools) < MIN_BASIC_POOL) {
      vocab = anchorsList;
      pools = basicLoops(deck, vocab, starts);
    }
    ctx.basicVocab = vocab;
    ctx.basicStarts = starts;
    [2, 3, 4].forEach(function (len) {
      starts.forEach(function (start, s) {
        if (!pools[len][s].length) return;
        ctx.basicCells.push({
          length: len,
          start: start,
          side: s === 0 ? "home" : "relative",
          seqs: pools[len][s]
        });
      });
    });
    return ctx;
  }

  // tierContext() plus `refusal`: the NO_HOME_CHORD deal when the deck has no
  // home anchor, else null.
  function homeOrRefuse(deck) {
    var ctx = tierContext(deck);
    ctx.refusal = ctx.homeAnchorIdx === null ? { chords: null, reason: "NO_HOME_CHORD" } : null;
    return ctx;
  }

  function basicCells(deck) {
    return tierContext(deck).basicCells;
  }

  // sequences(deck, length): the BASIC pool at that length (R-9) - every loop
  // BASIC can deal, home starts first, then relative starts. Rotations
  // are distinct sequences, but only the rotations that start on home or the
  // relative start are in the pool. Returns [] when there is no home anchor
  // (NO_HOME_CHORD stays ahead of everything) or no sequence of that length -
  // callers that need to tell those apart use anchors()/homeAnchor directly
  // (pick() calls homeOrRefuse(deck)).
  function sequences(deck, length) {
    if (length !== 2 && length !== 3 && length !== 4) {
      throw new Error("HPE.sequence.sequences: length must be 2, 3 or 4");
    }
    var out = [];
    basicCells(deck).forEach(function (cell) {
      if (cell.length === length) out = out.concat(cell.seqs);
    });
    return out;
  }

  function prevValid(deck, prev) {
    return Array.isArray(prev) && prev.length > 0 &&
      prev.every(function (idx) {
        return typeof idx === "number" && idx >= 0 && idx < deck.chords.length;
      });
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

  // rng() scaled over the weights' own sum, so the caller never renormalises.
  function weightedDraw(rng, items, weights) {
    var total = 0;
    var i;
    for (i = 0; i < weights.length; i += 1) total += weights[i];
    var r = rng() * total;
    for (i = 0; i < items.length; i += 1) {
      r -= weights[i];
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  }

  // E4: `prev` leaves its cell BEFORE anything is drawn, and a cell it
  // empties drops out of the weights. If that would leave nothing at all
  // (prev is the tier's only sequence) the exclusion is skipped.
  function withoutPrev(cells, prev) {
    if (!prev) return cells;
    var out = [];
    cells.forEach(function (cell) {
      var seqs = cell.seqs.filter(function (seq) { return !sameSequence(seq, prev); });
      if (!seqs.length) return;
      out.push({
        length: cell.length, start: cell.start, kind: cell.kind, family: cell.family,
        side: cell.side, seqs: seqs
      });
    });
    return out.length ? out : cells;
  }

  // One level of a cell draw: the distinct values of `key` among `cells`, one
  // weighted draw among them, and the cells that carry the winner.
  function narrow(rng, cells, key, weightOf) {
    var values = [];
    cells.forEach(function (cell) {
      if (values.indexOf(cell[key]) < 0) values.push(cell[key]);
    });
    var weights = values.map(function (value) { return weightOf(value, cells); });
    var chosen = weightedDraw(rng, values, weights);
    return cells.filter(function (cell) { return cell[key] === chosen; });
  }

  // Draws one sequence from weighted cells: one rng draw per level (always,
  // even when a level has a single option, so the draw count is fixed), then
  // one uniform draw inside the cell the levels single out. null when there
  // are no cells.
  function drawCells(cells, rng, prev, levels) {
    var live = withoutPrev(cells, prev);
    if (!live.length) return null;
    levels.forEach(function (level) {
      live = narrow(rng, live, level[0], level[1]);
    });
    var seqs = live[0].seqs;
    return seqs[draw(rng, seqs.length)].slice();
  }

  var BASIC_LEVELS = [
    ["length", function (value) { return BASIC_LENGTH_WEIGHT[value]; }],
    ["side", function (value) { return BASIC_SIDE_WEIGHT[value]; }]
  ];

  var MEDIUM_LEVELS = [
    ["length", function (value) { return MEDIUM_LENGTH_WEIGHT[value]; }],
    ["kind", function (value) { return MEDIUM_KIND_WEIGHT[value]; }],
    ["family", function () { return 1; }],
    ["side", function (value) { return MEDIUM_SIDE_WEIGHT[value]; }]
  ];

  // R-2: length, then start side, then uniform within the (length, side) cell.
  function drawBasic(cells, rng, prev) {
    return drawCells(cells, rng, prev, BASIC_LEVELS);
  }

  // R-5: length, kind, colour family, start side, then uniform in the cell.
  function drawMedium(cells, rng, prev) {
    return drawCells(cells, rng, prev, MEDIUM_LEVELS);
  }

  // {chords, style} or {chords:null, reason}. E1: NO_HOME_CHORD is checked
  // (by pick) before TOO_FEW_CHORDS. A `prev` containing an index outside the
  // deck is ignored.
  //
  // pick(deck, rng, prev) and pick(deck, rng, prev, "basic") both resolve
  // here, pinned to tests/fixtures/sequence_basic_golden.json.
  function pickBasic(deck, rng, prev, ctx) {
    var chosen = drawBasic(ctx.basicCells, rng, prevValid(deck, prev) ? prev : null);
    if (!chosen) return { chords: null, reason: "TOO_FEW_CHORDS" };
    var style = STYLES[draw(rng, STYLES.length)];
    return { chords: chosen, style: style };
  }

  // ---- Tiers (D-1..D-6, rebalanced by R-1..R-10) -------------------------

  var TIERS = ["basic", "intermediate", "advanced"];

  var TIER_LENGTHS = { intermediate: [3, 4], advanced: [4, 5, 6] };

  function chordName(deck, i) {
    var c = deck.chords[i];
    return c.main + (c.sup || "");
  }

  function chordIsSus(deck, i) {
    return (/sus/).test(chordName(deck, i));
  }

  // R-6: the family of a colour card, by the NAME the player reads. The sus
  // test runs first, so a 7sus4 is sus/power, matching chordIsSus and the
  // resolve rule. "other" is add9, 6, 6/9 and a non-anchor diminished triad.
  function colourFamily(deck, i) {
    var name = chordName(deck, i);
    if ((/sus/).test(name) || (/^[A-G][#b]?5$/).test(name)) return "susPower";
    if ((/7/).test(name)) return "seventh";
    return "other";
  }

  // D-4: a card is LOW/HIGH iff its subtitle matches this exactly. Applies
  // identically to built-in and generated decks (HPE.select.build / naming.js
  // pass voicingClass straight into subtitle() on both). D-14 (owner,
  // "Starting chords always allowed"): MEDIUM excludes LOW/HIGH cards EXCEPT
  // the anchors, which are always admitted, so BASIC's vocabulary nests
  // inside MEDIUM's on every deck; see intermediateGate and tierPool.
  function chordRegister(deck, i) {
    var sub = deck.chords[i].subtitle || "";
    if ((/\b(LOW|HIGH) VOICING\b/).test(sub)) return "register";
    return "";
  }

  // A repeated root at position k (first seen at position j < k, reading the
  // sequence as a loop) is allowed under the MEDIUM repeat rule only when j
  // and k are adjacent - in EITHER direction around the loop, including the
  // wrap - and the earlier one resolves into the later: a sus chord whose own
  // root carries over to a non-sus chord next.
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

  // R-1: BASIC = 2..4 BASIC-vocabulary cards with distinct roots, starting on
  // the home anchor or the relative start (the wrap-to-first and consecutive-
  // connect rules live in makeAccept / basicLoops).
  function basicGate(deck, seq, ctx) {
    if (seq.length < 2 || seq.length > 4) return false;
    if (ctx.basicStarts.indexOf(seq[0]) < 0) return false;
    if (hasForbiddenRepeat(deck, seq, false)) return false;
    for (var i = 0; i < seq.length; i += 1) {
      if (ctx.basicVocab.indexOf(seq[i]) < 0) return false;
    }
    return true;
  }

  // R-4: MEDIUM starts on a non-diminished anchor or on any card rooted on
  // home (the card rule below still has to admit it).
  function intermediateStart(deck, i, ctx) {
    if (ctx.anchorsList.indexOf(i) >= 0 && ctx.dimAnchors.indexOf(i) < 0) return true;
    return chordRootPc(deck, i) === ctx.home;
  }

  // R-4: length 3 or 4, an R-4 start, repeated roots only as resolved sus
  // pairs, every chord an anchor or a colour card (non-anchor, at most 4
  // fields, no register voicing), and AT MOST ONE colour card.
  function intermediateGate(deck, seq, ctx) {
    var anchorsList = ctx.anchorsList;
    if (seq.length !== 3 && seq.length !== 4) return false;
    if (!intermediateStart(deck, seq[0], ctx)) return false;
    if (hasForbiddenRepeat(deck, seq, true)) return false;
    var colour = 0;
    for (var i = 0; i < seq.length; i += 1) {
      if (anchorsList.indexOf(seq[i]) >= 0) continue;
      if (deck.chords[seq[i]].fields.length > 4) return false;
      if (chordRegister(deck, seq[i]) !== "") return false;
      colour += 1;
    }
    return colour <= 1;
  }

  // R-7 (owner, 2026-10-04 "broaden HARD everywhere"): HARD = length 4..6
  // with at least one EXTENDED card - a NON-ANCHOR card with more than 4
  // fields or a register voicing - OR at least two non-anchor cards, counted
  // per position; and register cards (anchors included) on at most a third
  // of the chords: 0 of 4, 1 of 4-5, 2 of 6. The second branch is what gives
  // a deck with no extended card (D Kurd 9, C Major 9) a HARD tier.
  function hardGate(deck, seq, ctx) {
    if (seq.length < 4 || seq.length > 6) return false;
    var extended = false;
    var nonAnchor = 0;
    var register = 0;
    for (var i = 0; i < seq.length; i += 1) {
      var isRegister = chordRegister(deck, seq[i]) !== "";
      if (isRegister) register += 1;
      if (ctx.anchorsList.indexOf(seq[i]) >= 0) continue;
      nonAnchor += 1;
      if (isRegister || deck.chords[seq[i]].fields.length > 4) extended = true;
    }
    if (!extended && nonAnchor < 2) return false;
    return register * 3 <= seq.length;
  }

  // classifyTier(deck, chords, ctx): BASIC, then MEDIUM, then HARD, then null
  // (R-8), given a tierContext() so a hot caller (the MEDIUM enumeration, the
  // HARD sampler/DFS) builds it ONCE per pick instead of once per candidate.
  // The tiers no longer nest as sets of DEALS - a length-2 BASIC deal is not
  // MEDIUM, a pure-anchor MEDIUM deal starting off home is not BASIC - so
  // each gate is a full definition and the ORDER decides a sequence that
  // passes two of them. A sequence no gate passes is dealt by no tier and
  // classifies null (TR-5): there is no catch-all.
  // Each gate rejects on length internally (its own first line); classifyTier
  // does not re-check length before calling it. A redundant outer pre-filter
  // would make the gate's own length check unreachable, which is what let a
  // length-off-by-one mutant survive on PR #202
  // (tests/mutants/sqd_05_intermediate_length_range_off_by_one.patch).
  function classifyTier(deck, chords, ctx) {
    if (basicGate(deck, chords, ctx)) {
      return "basic";
    }
    if (intermediateGate(deck, chords, ctx)) {
      return "intermediate";
    }
    if (hardGate(deck, chords, ctx)) {
      return "advanced";
    }
    return null;
  }

  // Public entry point: computes the context once and delegates.
  function tierOf(deck, chords) {
    if (!Array.isArray(chords) || chords.length === 0) {
      throw new Error("HPE.sequence.tierOf: chords must be a non-empty array");
    }
    return classifyTier(deck, chords, tierContext(deck));
  }

  // Vocabulary nests (R-8): BASIC's cards are anchors, MEDIUM's pool is every
  // anchor plus the colour cards, HARD's is every card.
  function tierPool(deck, tier, anchorsList) {
    var n = deck.chords.length;
    var out = [];
    for (var i = 0; i < n; i += 1) {
      if (tier === "advanced" || anchorsList.indexOf(i) >= 0 ||
          (deck.chords[i].fields.length <= 4 && chordRegister(deck, i) === "")) {
        out.push(i);
      }
    }
    return out;
  }

  // R-4: MEDIUM's start set is every non-diminished anchor plus every pool
  // card rooted on home; HARD starts anywhere in its pool.
  function tierStartSet(deck, tier, pool, ctx) {
    if (tier === "advanced") return pool;
    return pool.filter(function (i) {
      return intermediateStart(deck, i, ctx);
    });
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

  // R-10 / TR-14: every MEDIUM sequence of length 3 and 4, found by one
  // matrix-pruned DFS over tierPool x tierStartSet and bucketed into the R-5
  // cells. On top of dfsFindAll's two prunes (identical card, connectivity)
  // this refuses a SECOND colour card at the prefix, so no branch carrying
  // two is ever expanded; without that prune Pygmy's length 4 alone is
  // 221,520 nodes. A node is one rec() entry, both lengths counted together
  // against `budget`. The leaf applies the full classification, so a loop
  // BASIC claims sits in no MEDIUM cell.
  // Returns [{length, kind: "pure"|"colour", family, side: "home"|"other",
  // seqs}], non-empty cells only, in a fixed order: length, then pure before
  // colour, then COLOUR_FAMILIES order, then home before other. `stats`,
  // when passed, gets `.nodes` and `.truncated` exactly as dfsFindAll's does.
  function mediumEnumerate(deck, ctx, matrix, budget, stats, rng) {
    var pool = tierPool(deck, "intermediate", ctx.anchorsList);
    var startSet = tierStartSet(deck, "intermediate", pool, ctx);
    var isColour = deck.chords.map(function (_, i) { return ctx.anchorsList.indexOf(i) < 0; });
    var buckets = {};
    var nodes = 0;
    var truncated = false;
    var len;
    var seq;
    var familyOf = [];
    function file(chords) {
      var family = "none";
      for (var i = 0; i < chords.length; i += 1) {
        if (!isColour[chords[i]]) continue;
        if (familyOf[chords[i]] === undefined) familyOf[chords[i]] = colourFamily(deck, chords[i]);
        family = familyOf[chords[i]];
      }
      var side = chordRootPc(deck, chords[0]) === ctx.home ? "home" : "other";
      var key = chords.length + "/" + family + "/" + side;
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(chords.slice());
    }
    function rec(depth, colourUsed) {
      if (nodes >= budget) {
        truncated = true;
        return;
      }
      nodes += 1;
      if (depth === len) {
        if (seq[len - 1] !== seq[0] && matrix[seq[len - 1]][seq[0]] &&
            classifyTier(deck, seq, ctx) === "intermediate") {
          file(seq);
        }
        return;
      }
      var options = depth === 0 ? startSet : pool;
      for (var i = 0; i < options.length; i += 1) {
        var candidate = options[i];
        if (depth > 0) {
          var prevChord = seq[depth - 1];
          if (candidate === prevChord || !matrix[prevChord][candidate]) continue;
        }
        if (isColour[candidate] && colourUsed) continue;
        seq[depth] = candidate;
        rec(depth + 1, colourUsed || isColour[candidate]);
      }
    }
    TIER_LENGTHS.intermediate.forEach(function (length) {
      len = length;
      seq = new Array(len);
      rec(0, false);
    });
    if (stats) {
      stats.nodes = nodes;
      stats.truncated = truncated;
    }
    if (truncated && rng) {
      buckets = {};
      var sampled = sampleMedium(deck, ctx, matrix, budget, rng, pool, startSet, isColour, file);
      if (stats) stats.sampled = sampled;
    }

    var cells = [];
    TIER_LENGTHS.intermediate.forEach(function (length) {
      ["none"].concat(COLOUR_FAMILIES).forEach(function (family) {
        ["home", "other"].forEach(function (side) {
          var seqs = buckets[length + "/" + family + "/" + side];
          if (!seqs) return;
          cells.push({
            length: length,
            kind: family === "none" ? "pure" : "colour",
            family: family,
            side: side,
            seqs: seqs
          });
        });
      });
    });
    return cells;
  }

  // The second pass of mediumEnumerate, run only when the DFS above ran out
  // of budget. Random walks over the same space: a length from
  // TIER_LENGTHS.intermediate, a start uniformly from `startSet` (both from one draw), then each
  // next card uniformly from the candidates the DFS would have expanded (not
  // the previous card, connected to it, no second colour card), closed and
  // classified exactly as the DFS leaf does. A node is a card placed, and
  // the walks stop at the same `budget`. Each distinct sequence is filed
  // once, through `file`; returns how many were. Draws from `rng`.
  function sampleMedium(deck, ctx, matrix, budget, rng, pool, startSet, isColour, file) {
    var lengths = TIER_LENGTHS.intermediate;
    var seen = {};
    var onward = [];
    var width = deck.chords.length;
    var filed = 0;
    var nodes = 0;
    // One rng() call yields several draws: each pick keeps the fraction of u
    // it did not use, and a fresh value is fetched once fewer than 1024
    // distinct values per outcome would remain, so no index is off by more
    // than 0.1%. rng() is the dominant cost of a walk.
    var u = 0;
    var room = 0;
    if (!startSet.length) return 0;
    while (nodes < budget) {
      var length = 0;
      var walk = [];
      var colourUsed = false;
      do {
        var options = null;
        var n;
        if (walk.length === 0) {
          n = lengths.length * startSet.length;
        } else {
          var prevChord = walk[walk.length - 1];
          if (!onward[prevChord]) {
            onward[prevChord] = { all: [], pure: [] };
            for (var i = 0; i < pool.length; i += 1) {
              var candidate = pool[i];
              if (candidate === prevChord || !matrix[prevChord][candidate]) continue;
              onward[prevChord].all.push(candidate);
              if (!isColour[candidate]) onward[prevChord].pure.push(candidate);
            }
          }
          options = colourUsed ? onward[prevChord].pure : onward[prevChord].all;
          n = options.length;
          if (!n) break;
        }
        if (room < n * 1024) {
          u = rng();
          room = 4294967296;
        }
        u *= n;
        var at = Math.floor(u);
        if (at >= n) at = n - 1;
        u -= at;
        room /= n;
        var next;
        if (options) {
          next = options[at];
        } else {
          length = lengths[at % lengths.length];
          next = startSet[(at - at % lengths.length) / lengths.length];
        }
        walk.push(next);
        colourUsed = colourUsed || isColour[next];
        nodes += 1;
      } while (walk.length < length && nodes < budget);
      if (walk.length < length) continue;
      var key = length;
      for (var k = 0; k < length; k += 1) key = key * width + walk[k];
      if (seen[key]) continue;
      if (walk[length - 1] !== walk[0] && matrix[walk[length - 1]][walk[0]] &&
          classifyTier(deck, walk, ctx) === "intermediate") {
        seen[key] = true;
        file(walk);
        filed += 1;
      }
    }
    return filed;
  }

  // The MEDIUM cells of a deck, for callers that draw many times from one
  // enumeration (the shape tests; pick() enumerates per call). `budget`
  // defaults to MEDIUM_ENUM_BUDGET. Without `rng` the result is the
  // deterministic DFS enumeration, truncated or not; with one, a truncated
  // enumeration is replaced by the random-walk sample, as pick() does.
  function mediumCells(deck, stats, budget, rng) {
    return mediumEnumerate(deck, tierContext(deck), buildConnectMatrix(deck),
      budget === undefined ? MEDIUM_ENUM_BUDGET : budget, stats, rng);
  }

  // MEDIUM per R-5. A deck whose MEDIUM set is empty reports NO_TIER_SEQUENCE.
  function pickMedium(deck, rng, prev, ctx) {
    var cells = mediumEnumerate(deck, ctx, buildConnectMatrix(deck), MEDIUM_ENUM_BUDGET, null, rng);
    var chosen = drawMedium(cells, rng, prevValid(deck, prev) ? prev : null);
    if (!chosen) return { chords: null, reason: "NO_TIER_SEQUENCE" };
    var style = STYLES[draw(rng, STYLES.length)];
    return { chords: chosen, style: style };
  }

  // Bounded exhaustive DFS over sequences of length `len`, seq[0] from
  // `startSet`, seq[1..] from `pool`, collecting every one `accept` likes.
  // Stops after visiting `budget` nodes (a node = one partial sequence of
  // any depth); D-2's fallback. `matrix`, when given, prunes a branch BEFORE
  // it is counted as a node: a candidate that repeats the previous chord or
  // does not connect to it can never pass `accept`'s own identical-card/
  // connectivity check at the leaf, so skipping it here does not change
  // which sequences are found - it only lets the same node budget reach
  // deeper into the space that can actually be accepted (perf review on PR
  // #202, item 4).
  // `stats`, when passed, gets `.truncated` set to true iff a node was actually
  // refused for lack of budget (a search that finishes on exactly its last
  // allowed node is complete, not truncated), and its `.nodes` set to the final
  // visited-node count on return - a deterministic, hardware-independent way to prove
  // the DFS never exceeds `budget` (used by the perf regression test
  // instead of a wall-clock timing, which varies with the runner).
  function dfsFindAll(startSet, pool, len, accept, budget, matrix, stats) {
    var found = [];
    var nodes = 0;
    var truncated = false;
    var seq = new Array(len);
    function rec(depth) {
      if (nodes >= budget) {
        truncated = true;
        return;
      }
      nodes += 1;
      if (depth === len) {
        if (accept(seq)) found.push(seq.slice());
        return;
      }
      var options = depth === 0 ? startSet : pool;
      for (var i = 0; i < options.length; i += 1) {
        var candidate = options[i];
        if (depth > 0) {
          var prevChord = seq[depth - 1];
          if (candidate === prevChord) continue;
          if (matrix && !matrix[prevChord][candidate]) continue;
        }
        seq[depth] = candidate;
        rec(depth + 1);
      }
    }
    rec(0);
    if (stats) {
      stats.nodes = nodes;
      stats.truncated = truncated;
    }
    return found;
  }

  // The acceptance predicate shared by the HARD sampler, the DFS fallback and
  // the tests that reconstruct the fallback path. Cheapest checks first,
  // classifyTier (the expensive one, even with a shared ctx) last -
  // `excludeSeq`/identical-card/connectivity are O(1) per pair and reject the
  // overwhelming majority of candidates before classifyTier's gate functions
  // ever run (perf review on PR #202, item 3).
  function makeAccept(deck, tier, matrix, excludeSeq, ctx) {
    return function accept(seq) {
      if (excludeSeq && sameSequence(seq, excludeSeq)) return false;
      for (var i = 0; i < seq.length; i += 1) {
        var next = seq[(i + 1) % seq.length];
        // No consecutive repeat: playing the identical card back-to-back is
        // never musically meaningful, in any tier - distinct from the
        // repeated-ROOT rule the tier gates above already enforce.
        if (seq[i] === next) return false;
        if (!matrix[seq[i]][next]) return false;
      }
      return classifyTier(deck, seq, ctx) === tier;
    };
  }

  // One attempt at a fixed length: up to 512 uniform random draws, then the
  // bounded DFS fallback. `empty` is true only when the fallback (whether it
  // completed or hit the node budget) found literally nothing, per D-2 "a
  // search that hits the budget ... reports the length empty only if it
  // found nothing".
  function attemptLength(deck, rng, tier, len, matrix, excludeSeq, ctx) {
    var pool = tierPool(deck, tier, ctx.anchorsList);
    var startSet = tierStartSet(deck, tier, pool, ctx);
    if (!startSet.length || !pool.length) return { seq: null, empty: true };

    var accept = makeAccept(deck, tier, matrix, excludeSeq, ctx);

    for (var attempt = 0; attempt < 512; attempt += 1) {
      var seq = [startSet[draw(rng, startSet.length)]];
      for (var k = 1; k < len; k += 1) seq.push(pool[draw(rng, pool.length)]);
      if (accept(seq)) return { seq: seq, empty: false };
    }

    var found = dfsFindAll(startSet, pool, len, accept, DFS_NODE_BUDGET, matrix);
    if (found.length) {
      return { seq: found[draw(rng, found.length)], empty: false };
    }
    return { seq: null, empty: true };
  }

  // Draws a length uniformly among those not yet proven empty, attempts it,
  // and drops/redraws per D-3 when an attempt proves its length empty.
  function drawFromLengths(deck, rng, tier, lengths, matrix, excludeSeq, ctx) {
    var remaining = lengths.slice();
    while (remaining.length) {
      var idx = draw(rng, remaining.length);
      var len = remaining[idx];
      var attempt = attemptLength(deck, rng, tier, len, matrix, excludeSeq, ctx);
      if (attempt.seq) return attempt.seq;
      remaining.splice(idx, 1);
    }
    return null;
  }

  // HARD per D-2/D-3/D-6 with the R-7 gate: the 512-draw sampler, then the
  // bounded DFS. NO_HOME_CHORD is checked by the caller (pick) before this
  // runs, so it keeps priority on every tier. A deck where no 4-6 sequence
  // meets the gate (no non-anchor card at all) reports NO_TIER_SEQUENCE.
  function pickTiered(deck, rng, prev, tier, ctx) {
    var matrix = buildConnectMatrix(deck);
    var lengths = TIER_LENGTHS[tier];

    var prevOk = prevValid(deck, prev);

    // Phase 1: exclude prev, mirroring BASIC's E4 rule.
    var found = drawFromLengths(deck, rng, tier, lengths, matrix, prevOk ? prev : null, ctx);
    // Phase 2: prev may be the only sequence this tier has - include it.
    if (!found && prevOk) {
      found = drawFromLengths(deck, rng, tier, lengths, matrix, null, ctx);
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
    var ctx = homeOrRefuse(deck);
    if (ctx.refusal) return ctx.refusal;
    if (t === "basic") {
      return pickBasic(deck, rng, prev, ctx);
    }
    if (t === "intermediate") {
      return pickMedium(deck, rng, prev, ctx);
    }
    return pickTiered(deck, rng, prev, t, ctx);
  }

  HPE.sequence = {
    STYLES: STYLES,
    TIERS: TIERS,
    anchors: anchors,
    sequences: sequences,
    tierOf: tierOf,
    pick: pick,
    mulberry32: mulberry32,
    // Exposed for the hardware-independent regression tests: the node-count
    // tests reconstruct the real DFS / enumeration for a given deck and tier
    // and assert on the nodes actually visited rather than on wall-clock
    // time, and the shape tests draw thousands of deals from cells that were
    // enumerated once.
    _internal: {
      DFS_NODE_BUDGET: DFS_NODE_BUDGET,
      MEDIUM_ENUM_BUDGET: MEDIUM_ENUM_BUDGET,
      MIN_BASIC_POOL: MIN_BASIC_POOL,
      dfsFindAll: dfsFindAll,
      makeAccept: makeAccept,
      tierContext: tierContext,
      tierPool: tierPool,
      tierStartSet: tierStartSet,
      basicCells: basicCells,
      drawBasic: drawBasic,
      mediumCells: mediumCells,
      drawMedium: drawMedium,
      colourFamily: colourFamily,
      buildConnectMatrix: buildConnectMatrix,
      classifyTier: classifyTier,
      homePc: homePc,
      homeAnchor: homeAnchor,
      prevValid: prevValid,
      homeOrRefuse: homeOrRefuse
    }
  };
})(HPE);
