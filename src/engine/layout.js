/* HPE.layout - the D12 geometry solver for generated pans.
 *
 * Plain script, no module wrapper: index.html is a single self-contained file
 * by contract, so this text has to be inlinable verbatim. `var`, not `const`,
 * so the namespace lands on the global object of a node:vm context too.
 *
 * Normative source: docs/ENGINE-SPEC.md sections 1, 4, 11, 13, 16, 17;
 * docs/SCALE_ENGINE_PLAN.md D7, D12 and "pan() does not generalise";
 * CLAUDE.md "Instrument layouts".
 *
 * `solve` never changes a zone (spec section 4, D14 as amended) and always
 * emits the FULL geom shape - every key pan() reads, zeroes and false where a
 * zone is empty, never a missing key and never null - because pan() yields NaN
 * for a missing key. Built-in decks bypass this module entirely.
 *
 * Generated pans run one direction on every rim, odd or even: odd-numbered
 * notes on the right, even-numbered on the left. `anchor` ("one", the default,
 * or "between") only chooses where note 1 sits: at bottom centre, or half a
 * step to its right. The ding sits in the centre (r_ding 0.2, ding_dy 0) and
 * moves toward the player, Pygmy style (r_ding 0.19, ding_dy 0.1425), only
 * when the pan has inner notes. Two reflections, `mirror` (rim and inner
 * rings) and `mirrorBottom` (bottom ring), are resolved by `resolveMirrors`.
 *
 * `options.seats` is the user's correction of the generated layout: one
 * permutation per ring (`rim`, `inner`, `bottom`), each validated against its
 * own ring, so no input can seat a note in another ring. Absent is the
 * generated default; see readSeats below. The legacy flat `order` of versions
 * 1 and 2 is read only by `seatsFromOrder`.
 */
var HPE = (typeof HPE !== "undefined") ? HPE : {};

(function (HPE) {
  "use strict";

  /* ---- D12 fixed geometry, anchored on the built-in literals ------------- */

  var R_DING = 0.19;          /* pygmy literal: the enlarged, offset ding    */
  var DING_DY = 0.1425;       /* offset toward the player                    */
  var R_DING_CENTRED = 0.2;   /* amara / hijaz literal: the centred ding     */
  var RIM_PLAIN = 0.745;      /* hijaz / amara literal, no inner ring        */
  var RIM_WITH_INNER = 0.722; /* pygmy literal, inner fields present         */
  var INNER_ORB = 0.38;       /* pygmy literal                               */
  var BOTTOM_ORB = 1.15;      /* pygmy literal, x-ray ring outside the shell */
  var INNER_RING_DECOR = 0.355; /* hijaz / amara decorative circle           */

  /* The inner fan (A13): k notes spread over INNER_SPAN degrees about top
   * centre, INNER_STEP_MAX apart at most, dealt from the two ends inward. One
   * note sits at 90 and two at 128 and 52 (Pygmy's pair) without a special
   * case. The ding offset (A14) starts at DING_DY and rises by DING_DY_STEP
   * until every inner index number is INNER_CLEARANCE clear of the ding, to
   * DING_DY_MAX. These four, with the step cap, are what G-RENDER retunes. */
  var INNER_SPAN = 180;
  var INNER_STEP_MAX = 76;
  var DING_DY_STEP = 0.0025;
  var INNER_CLEARANCE = 0.01;
  var DING_DY_MAX = 0.30;

  /* The legibility floor (A16, D15): print scale is R = round(PRINT_HALF /
   * ext, 1) points, and a label under LABEL_FLOOR_PT is crowded. The ratios
   * are tools/hifi.py's LABEL_RATIO_NOTE, LABEL_RATIO_BNOTE and NUM_RATIO,
   * pinned to them by tests/test_pdf_parity.py. */
  var PRINT_HALF = 74;
  var LABEL_FLOOR_PT = 3.6;
  var PRINT_NOTE_RATIO = 0.80325;
  var PRINT_BNOTE_RATIO = 0.8232;
  var PRINT_NUM_RATIO = 0.64;
  var PRINT_OCTAVE_RATIO = 0.66;

  var R_NOTE_MAX = 0.19;      /* hijaz / amara literal                       */
  var R_BNOTE_MAX = 0.1188;   /* pygmy literal                               */
  var N_IN_PLAIN = 0.085;     /* hijaz / amara literal (numbers inward)      */
  var N_IN_OUT = 0.052;       /* pygmy literal (rim numbers outward)         */
  var N_OUT = 0.068;          /* pygmy literal                               */

  var F_DING_RATIO = 0.6;     /* 0.114 / 0.19   (pygmy)                      */
  var F_NOTE_RATIO = 0.765;   /* 0.109 / 0.1425 (pygmy)                      */
  var F_NUM_RATIO = 0.64;     /* 0.0912 / 0.1425 (pygmy)                     */
  var F_BNOTE_RATIO = 0.784;  /* 0.0931 / 0.1188 (pygmy)                     */

  var PACK = 0.85;            /* clearance factor on the tightest pair       */
  var DING_PACK = 0.9;        /* clearance factor against the ding           */
  var LABEL_REACH = 0.7;      /* how far a number glyph reaches from its box */
  var EXT_PAD = 0.06;         /* 1.0 + 0.06 reproduces pan()'s plain 1.06    */

  var DEG = Math.PI / 180;

  /* ---- small helpers ---------------------------------------------------- */

  function norm(angle) {
    return ((angle % 360) + 360) % 360;
  }

  function round(value, places) {
    var f = Math.pow(10, places);
    return Math.round(value * f) / f;
  }

  // Finding 10 (2026-09-30 quality-refactor plan): fieldsOf is
  // HPE.core's own helper; layout.js always loads after core.js (every
  // caller's loadEngine list includes "core" ahead of "layout"), so this
  // module just delegates rather than keeping its own copy.
  function fieldsOf(seedOrFields) {
    return HPE.core.fieldsOf(seedOrFields);
  }

  /* Section 2's enum is CLOSED and carries no code for "that correction is not
   * a permutation", so a rejected `order` is BAD_NOTE naming the value, exactly
   * as core.parseSeed names an unparseable token. */
  function badNote(token) {
    return HPE.core.badNote(token);
  }

  function point(orb, angle) {
    return [orb * Math.cos(angle * DEG), orb * Math.sin(angle * DEG)];
  }

  function distance(a, b) {
    var dx = a[0] - b[0];
    var dy = a[1] - b[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  function minPairDistance(points) {
    var best = Infinity;
    var i;
    var j;
    for (i = 0; i < points.length; i += 1) {
      for (j = i + 1; j < points.length; j += 1) {
        best = Math.min(best, distance(points[i], points[j]));
      }
    }
    return best;
  }

  /* ---- the zig-zag (CLAUDE.md "Instrument layouts") ---------------------- */

  /* The rim, one rule for both parities (plan 7.1). With step = 360 / count
   * and i counting from 0, anchor "one" seats note i at
   * 270 + s * ceil(i / 2) * step and anchor "between" at
   * 270 + s * (floor(i / 2) + 0.5) * step, s being +1 for even i and -1 for
   * odd i: odd-numbered notes on the right, even-numbered on the left. "one"
   * puts note 1 at bottom centre (hijaz, amara, kurd); "between" straddles it
   * with note 1 on the right (pygmy: 290, 250, 330, ... 90). */
  function rimAngles(count, anchor) {
    var step = count > 0 ? 360 / count : 0;
    var between = anchor === "between";
    var out = [];
    var i;
    for (i = 0; i < count; i += 1) {
      var sign = (i % 2 === 1) ? -1 : 1;
      var magnitude = between ? Math.floor(i / 2) + 0.5 : Math.ceil(i / 2);
      out.push(norm(270 + sign * magnitude * step));
    }
    return out;
  }

  /* The bottom shell in x-ray view: an evenly spread ring that starts just
   * right of bottom centre and alternates, reproducing the verified pygmy
   * sequence (300, 240, 0, 180, 60, 120) at N = 6. */
  function bottomAngles(count) {
    var step = count > 0 ? 360 / count : 0;
    var anchor = 270 + step / 2;
    var out = [];
    var i;
    for (i = 0; i < count; i += 1) {
      var magnitude = Math.ceil(i / 2);
      var sign = (i % 2 === 1) ? -1 : 1;
      out.push(norm(anchor + sign * magnitude * step));
    }
    return out;
  }

  function isCentred(counts) {
    return counts.inner === 0;
  }

  function innerAngles(count) {
    var out = [];
    if (count < 1) return out;
    var step = count > 1 ? Math.min(INNER_STEP_MAX, INNER_SPAN / (count - 1)) : 0;
    var left = 90 + step * (count - 1) / 2;
    var i;
    for (i = 0; i < count; i += 1) {
      var j = Math.floor(i / 2);
      out.push(i % 2 === 0 ? left - j * step : left - (count - 1 - j) * step);
    }
    return out;
  }

  /* ---- the solver -------------------------------------------------------- */

  function byNumber(a, b) { return Number(a) - Number(b); }

  function collect(fields) {
    var zones = { ding: [], rim: [], inner: [], bottom: [] };
    var id;
    for (id in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, id)) continue;
      var zone = fields[id][3];
      if (!Object.prototype.hasOwnProperty.call(zones, zone)) continue;
      zones[zone].push(id);
    }
    zones.ding.sort(byNumber);
    zones.rim.sort(byNumber);
    zones.inner.sort(byNumber);
    zones.bottom.sort(byNumber);
    return zones;
  }

  /* ---- the D5 layout correction ----------------------------------------- */

  /* `options.seats` is the ONE layout-correction option: an object with
   * optional `rim`, `inner` and `bottom`, each a permutation of that ring's
   * seat indices [0 .. n-1], where entry i is the seat the ring's i-th note
   * (ascending by id) takes. A missing, null or undefined ring is the
   * generated default, so every deck that never opened the layout editor
   * solves byte-identically to how it always did. Every ring is checked
   * against its OWN length: a seat in another ring does not exist.
   *
   * Returns a result, never a throw: seats that are not exactly that are
   * BAD_NOTE. `value` is null when no ring carries a list. */
  function readSeats(value, counts) {
    if (value === undefined || value === null) return { ok: true, value: null };
    if (typeof value !== "object" || isArray(value)) return badNote(value);
    var key;
    for (key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key) && ZONES.indexOf(key) < 0) {
        return badNote(value);
      }
    }
    var out = {};
    var any = false;
    for (var z = 0; z < ZONES.length; z += 1) {
      var ring = ZONES[z];
      var list = value[ring];
      if (list === undefined || list === null) continue;
      if (!isPermutation(list, counts[ring])) return badNote(list);
      out[ring] = list.slice();
      any = true;
    }
    return { ok: true, value: any ? out : null };
  }

  var ZONES = ["rim", "inner", "bottom"];

  function isPermutation(list, n) {
    if (!isArray(list) || list.length !== n) return false;
    var seen = {};
    for (var i = 0; i < n; i += 1) {
      var seat = list[i];
      if (typeof seat !== "number" || !isFinite(seat) ||
          seat !== Math.floor(seat) || seat < 0 || seat >= n ||
          Object.prototype.hasOwnProperty.call(seen, String(seat))) {
        return false;
      }
      seen[String(seat)] = true;
    }
    return true;
  }

  /* The ONE converter from the legacy flat `order` (versions 1 and 2): a
   * permutation of [0 .. n-1] over the non-ding fields in the order collect()
   * yields them (rim, then inner, then bottom), where order[i] is the solved
   * slot field i takes. It converts only when every index stays inside the
   * ring it started in; one that leaves its ring is BAD_NOTE. A ring that
   * comes out as the identity is left out, and an order with nothing to say
   * converts to null (the default arrangement). */
  function seatsFromOrder(order, counts) {
    if (order === undefined || order === null) return { ok: true, value: null };
    var n = counts.rim + counts.inner + counts.bottom;
    if (!isPermutation(order, n)) return badNote(order);
    var out = {};
    var any = false;
    var offset = 0;
    for (var z = 0; z < ZONES.length; z += 1) {
      var ring = ZONES[z];
      var size = counts[ring];
      var list = [];
      var identity = true;
      for (var i = 0; i < size; i += 1) {
        var seat = order[offset + i] - offset;
        if (seat < 0 || seat >= size) return badNote(order);
        if (seat !== i) identity = false;
        list.push(seat);
      }
      if (!identity) { out[ring] = list; any = true; }
      offset += size;
    }
    return { ok: true, value: any ? out : null };
  }

  function isArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]";
  }

  /* The solved slot of every non-ding field, in the order collect() yields
   * them: rim slots, then inner, then bottom. `seatsFromOrder` reads over
   * exactly this sequence. */
  function slotOrder(zoneCounts) {
    var out = [];
    var i;
    for (i = 0; i < zoneCounts.rim; i += 1) out.push("rim");
    for (i = 0; i < zoneCounts.inner; i += 1) out.push("inner");
    for (i = 0; i < zoneCounts.bottom; i += 1) out.push("bottom");
    return out;
  }

  function countsOf(zones) {
    return { rim: zones.rim.length, inner: zones.inner.length, bottom: zones.bottom.length };
  }

  function mirrored(list, mirror) {
    var out = [];
    var i;
    for (i = 0; i < list.length; i += 1) {
      out.push(round(mirror ? norm(180 - list[i]) : list[i], 1));
    }
    return out;
  }

  /* Per-zone placement: each zone's evenly spread angles, mirrored and rounded. */
  function placeZones(counts, top, bottom, anchor) {
    return {
      rims: mirrored(rimAngles(counts.rim, anchor), top),
      inners: mirrored(innerAngles(counts.inner), top),
      bottoms: mirrored(bottomAngles(counts.bottom), bottom)
    };
  }

  /* The one place the two reflections are resolved (plan 20.5, AM-5). TOP is
   * the call's `mirror` if the key is present, else the seed's. BOTTOM is the
   * call's `mirrorBottom` if present, else the seed's `mirrorBottom` if
   * present, else the top value. */
  function resolveMirrors(options, seedOptions) {
    var call = options || {};
    var seed = seedOptions || {};
    var top = !!(("mirror" in call) ? call.mirror : seed.mirror);
    var bottom = ("mirrorBottom" in call) ? !!call.mirrorBottom :
      (("mirrorBottom" in seed) ? !!seed.mirrorBottom : top);
    return { top: top, bottom: bottom };
  }

  function resolveAnchor(options, seedOptions) {
    var call = options || {};
    var seed = seedOptions || {};
    var anchor = ("anchor" in call) ? call.anchor : seed.anchor;
    return anchor === "between" ? "between" : "one";
  }

  function geometryAt(counts, placed, dingDy) {
    var rims = placed.rims;
    var inners = placed.inners;
    var bottoms = placed.bottoms;
    var hasRim = counts.rim > 0;
    var hasInner = counts.inner > 0;
    var hasBottom = counts.bottom > 0;
    var rDing = isCentred(counts) ? R_DING_CENTRED : R_DING;

    var rimOrb = hasRim ? (hasInner ? RIM_WITH_INNER : RIM_PLAIN) : 0;
    var innerOrb = hasInner ? INNER_ORB : 0;
    var bottomOrb = hasBottom ? BOTTOM_ORB : 0;

    /* r_note: the largest circle that keeps every top field clear of every
     * other top field and of the ding, never larger than the built-in max.
     * The packing bound, not a cap on the count, sets the radius. */
    var topPoints = [];
    var i;
    for (i = 0; i < rims.length; i += 1) topPoints.push(point(rimOrb, rims[i]));
    for (i = 0; i < inners.length; i += 1) topPoints.push(point(innerOrb, inners[i]));

    var dingPoint = [0, -dingDy];
    var dingClear = Infinity;
    for (i = 0; i < topPoints.length; i += 1) {
      dingClear = Math.min(dingClear, distance(topPoints[i], dingPoint) - rDing);
    }

    var rNote = R_NOTE_MAX;
    var pairs = minPairDistance(topPoints);
    if (isFinite(pairs)) rNote = Math.min(rNote, PACK * pairs / 2);
    if (isFinite(dingClear)) rNote = Math.min(rNote, DING_PACK * dingClear);
    rNote = topPoints.length ? round(rNote, 4) : 0;

    var bottomPoints = [];
    for (i = 0; i < bottoms.length; i += 1) bottomPoints.push(point(bottomOrb, bottoms[i]));
    var rBnote = 0;
    if (hasBottom) {
      rBnote = R_BNOTE_MAX;
      var bottomPairs = minPairDistance(bottomPoints);
      if (isFinite(bottomPairs)) rBnote = Math.min(rBnote, PACK * bottomPairs / 2);
      rBnote = round(rBnote, 4);
    }

    var fNote = round(F_NOTE_RATIO * rNote, 4);
    var fNum = round(F_NUM_RATIO * rNote, 4);
    var fBnote = round(F_BNOTE_RATIO * rBnote, 4);
    var rimNumOut = hasInner;
    var nIn = topPoints.length ? (rimNumOut ? N_IN_OUT : N_IN_PLAIN) : 0;
    var nOut = hasBottom ? N_OUT : 0;

    /* ext: the furthest drawn element, in R units - the outermost circle edge
     * plus its number-label reach, padded. Generated decks only (section 11). */
    var reach = 1;                                   /* the shell circle itself */
    reach = Math.max(reach, dingDy + rDing);
    if (hasRim) {
      reach = Math.max(reach, rimOrb + rNote);
      if (rimNumOut) reach = Math.max(reach, rimOrb + rNote + nIn + fNum * LABEL_REACH);
    }
    if (hasInner) reach = Math.max(reach, innerOrb + rNote);
    if (hasBottom) {
      reach = Math.max(reach, bottomOrb + rBnote);
      reach = Math.max(reach, bottomOrb + rBnote + nOut + fNum * LABEL_REACH);
    }
    var ext = round(reach + EXT_PAD, 4);

    return {
      rim: round(rimOrb, 4),
      inner: round(innerOrb, 4),
      bottom: round(bottomOrb, 4),
      r_ding: rDing,
      ding_dy: dingDy,
      r_note: rNote,
      r_bnote: rBnote,
      inner_ring: hasInner ? 0 : INNER_RING_DECOR,
      f_ding: round(F_DING_RATIO * rDing, 4),
      f_note: fNote,
      f_bnote: fBnote,
      f_num: fNum,
      n_in: round(nIn, 4),
      n_out: round(nOut, 4),
      rim_num_out: rimNumOut,
      ext: ext
    };
  }

  /* A14: the ding offset is adaptive. Solve at DING_DY, then raise it one step
   * at a time while an inner index number (centred where pan() draws it,
   * `inner - r_note - n_in` along its seat, reaching LABEL_REACH x f_num)
   * sits closer than INNER_CLEARANCE to the ding's edge, up to DING_DY_MAX.
   * A pan with no inner notes has a centred ding and never loops. */
  function innerClearance(geom, inners) {
    var best = Infinity;
    var radius = geom.inner - geom.r_note - geom.n_in;
    var i;
    for (i = 0; i < inners.length; i += 1) {
      var at = point(radius, inners[i]);
      var gap = distance(at, [0, -geom.ding_dy]) - geom.r_ding - LABEL_REACH * geom.f_num;
      best = Math.min(best, gap);
    }
    return best;
  }

  function geometry(counts, placed) {
    if (isCentred(counts)) return geometryAt(counts, placed, 0);
    var step = 0;
    var geom = geometryAt(counts, placed, DING_DY);
    while (geom.ding_dy < DING_DY_MAX &&
           innerClearance(geom, placed.inners) < INNER_CLEARANCE) {
      step += 1;
      geom = geometryAt(counts, placed, round(DING_DY + step * DING_DY_STEP, 4));
    }
    return geom;
  }

  /* The smallest of the four glyph classes the warning counts (A16), in
   * points at print scale: top name, top octave digit, index number, bottom
   * name. The bottom octave digit is excluded (D15). A pan with nothing to
   * label has no floor; it reports PRINT_HALF, far above LABEL_FLOOR_PT. */
  function labelFloor(geom) {
    var R = round(PRINT_HALF / geom.ext, 1);
    var sizes = [];
    if (geom.r_note > 0) {
      sizes.push(PRINT_NOTE_RATIO * geom.r_note * R * PRINT_OCTAVE_RATIO);
      sizes.push(PRINT_NOTE_RATIO * geom.r_note * R);
      sizes.push(PRINT_NUM_RATIO * geom.r_note * R);
    }
    if (geom.r_bnote > 0) sizes.push(PRINT_BNOTE_RATIO * geom.r_bnote * R);
    return sizes.length ? Math.min.apply(null, sizes) : PRINT_HALF;
  }

  /* The correction is applied LAST, to the note-to-seat assignment of each
   * ring on its own. The SET of solved angles is unchanged - seats say who
   * sits where, not where the seats are - so every geom value is untouched
   * and mirror, which reflects the ANGLES, composes with it either way. */
  function reseat(placed, seats) {
    var key = { rim: "rims", inner: "inners", bottom: "bottoms" };
    var out = { rims: placed.rims, inners: placed.inners, bottoms: placed.bottoms };
    for (var z = 0; z < ZONES.length; z += 1) {
      var list = seats[ZONES[z]];
      if (!list) continue;
      var slots = placed[key[ZONES[z]]];
      var moved = [];
      for (var i = 0; i < list.length; i += 1) moved.push(slots[list[i]]);
      out[key[ZONES[z]]] = moved;
    }
    return out;
  }

  /* Merge: copy the source fields and write each zone's angle into slot 4.
   * Rule N: a seat's number is the default label of the note that sits there by
   * default, so the note in seat s carries seat s's label (slot 5). Labels are
   * read from `source`, never from the fields being written. */
  function merge(source, zones, placed, seats) {
    var fields = {};
    var id;
    var i;
    for (id in source) {
      if (!Object.prototype.hasOwnProperty.call(source, id)) continue;
      fields[id] = source[id].slice();
    }
    for (i = 0; i < zones.ding.length; i += 1) fields[zones.ding[i]][4] = null;
    for (i = 0; i < zones.rim.length; i += 1) fields[zones.rim[i]][4] = placed.rims[i];
    for (i = 0; i < zones.inner.length; i += 1) fields[zones.inner[i]][4] = placed.inners[i];
    for (i = 0; i < zones.bottom.length; i += 1) fields[zones.bottom[i]][4] = placed.bottoms[i];
    if (seats) {
      for (var z = 0; z < ZONES.length; z += 1) {
        var list = seats[ZONES[z]];
        if (!list) continue;
        var ids = zones[ZONES[z]];
        for (i = 0; i < list.length; i += 1) fields[ids[i]][5] = source[ids[list[i]]][5];
      }
    }
    return fields;
  }

  function solve(seedOrFields, options) {
    var source = fieldsOf(seedOrFields);
    var zones = collect(source);

    var seedOptions = (seedOrFields && seedOrFields.options) || {};
    var mirrors = resolveMirrors(options, seedOptions);
    var anchor = resolveAnchor(options, seedOptions);

    var counts = countsOf(zones);
    var wanted = readSeats(
      (options && "seats" in options) ? options.seats : seedOptions.seats,
      counts);
    if (!wanted.ok) return wanted;

    var placed = placeZones(counts, mirrors.top, mirrors.bottom, anchor);
    var geom = geometry(counts, placed);
    if (wanted.value) placed = reseat(placed, wanted.value);

    return { ok: true, value: { geom: geom, fields: merge(source, zones, placed, wanted.value) } };
  }

  HPE.layout = {
    solve: solve,
    slotOrder: slotOrder,
    seatsFromOrder: seatsFromOrder,
    readSeats: readSeats,
    rimAngles: rimAngles,
    resolveMirrors: resolveMirrors,
    bottomAngles: bottomAngles,
    innerAngles: innerAngles,
    labelFloor: labelFloor,
    LABEL_FLOOR_PT: LABEL_FLOOR_PT,
    GEOM_KEYS: [
      "rim", "inner", "bottom", "r_ding", "ding_dy", "r_note", "r_bnote",
      "inner_ring", "f_ding", "f_note", "f_bnote", "f_num", "n_in", "n_out",
      "rim_num_out", "ext"
    ]
  };
})(HPE);
