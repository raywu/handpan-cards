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
 * Phase 5 adds ONE option, `options.order` - the user's correction of the
 * generated layout, a permutation over the non-ding fields. Absent is the
 * generated default; see readOrder below.
 */
var HPE = (typeof HPE !== "undefined") ? HPE : {};

(function (HPE) {
  "use strict";

  /* ---- caps (spec section 4) -------------------------------------------- */

  var RIM_MAX = 11;
  var INNER_MAX = 2;
  var BOTTOM_MAX = 6;

  /* ---- D12 fixed geometry, anchored on the built-in literals ------------- */

  var R_DING = 0.19;          /* pygmy literal: the enlarged, offset ding    */
  var DING_DY = 0.1425;       /* offset toward the player                    */
  var RIM_PLAIN = 0.745;      /* hijaz / amara literal, no inner ring        */
  var RIM_WITH_INNER = 0.722; /* pygmy literal, inner fields present         */
  var INNER_ORB = 0.38;       /* pygmy literal                               */
  var BOTTOM_ORB = 1.15;      /* pygmy literal, x-ray ring outside the shell */
  var INNER_RING_DECOR = 0.355; /* hijaz / amara decorative circle           */
  var INNER_ANGLES = [128, 52]; /* left first: opposite the rim direction    */

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

  function fieldsOf(seedOrFields) {
    return (seedOrFields && seedOrFields.fields) ? seedOrFields.fields : seedOrFields;
  }

  function reasonFor(code) {
    var table = (HPE.core && HPE.core.REASONS) || null;
    return table && table[code] ? table[code].reason : code;
  }

  function err(code) {
    return { ok: false, code: code, reason: reasonFor(code) };
  }

  /* Section 2's enum is CLOSED and carries no code for "that correction is not
   * a permutation", so a rejected `order` is BAD_NOTE naming the value, exactly
   * as core.parseSeed names an unparseable token. */
  function badNote(token) {
    return {
      ok: false,
      code: "BAD_NOTE",
      reason: reasonFor("BAD_NOTE").split("<X>").join(String(token).slice(0, 12))
    };
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

  /* Rim, right-first ascending: the last (highest) field sits at top centre
   * and every earlier one steps alternately down the left then the right side.
   * With N = 9 this reproduces the verified pygmy sequence exactly
   * (290, 250, 330, 210, 10, 170, 50, 130, 90); mirroring it about the
   * vertical axis reproduces hijaz and amara exactly. */
  function rimAngles(count) {
    var step = count > 0 ? 360 / count : 0;
    var out = [];
    var i;
    for (i = 0; i < count; i += 1) {
      var back = count - 1 - i;                    /* 0 for the highest note */
      var magnitude = Math.ceil(back / 2);
      var sign = (back % 2 === 1) ? 1 : -1;
      out.push(norm(90 + sign * magnitude * step));
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

  function innerAngles(count) {
    return INNER_ANGLES.slice(0, count);
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

  /* `options.order` is the ONE layout-correction option: a permutation of
   * [0 .. n-1] over the non-ding fields in the order collect() yields them
   * (rim, then inner, then bottom, each ascending by id), where order[i] is the
   * solved SLOT that field i takes. Absent or null is the generated default -
   * every deck that never opened the layout editor solves byte-identically to
   * how it always did. Rotation is not a second option: the UI writes a cyclic
   * shift into this one.
   *
   * Returns a result, never a throw: an order that is not a permutation of
   * exactly that length is BAD_NOTE. */
  function readOrder(value, n) {
    if (value === undefined || value === null) return { ok: true, value: null };
    if (!isArray(value) || value.length !== n) return badNote(value);
    var seen = {};
    var out = [];
    for (var i = 0; i < n; i += 1) {
      var slot = value[i];
      if (typeof slot !== "number" || !isFinite(slot) ||
          slot !== Math.floor(slot) || slot < 0 || slot >= n ||
          Object.prototype.hasOwnProperty.call(seen, String(slot))) {
        return badNote(value);
      }
      seen[String(slot)] = true;
      out.push(slot);
    }
    return { ok: true, value: out };
  }

  function isArray(value) {
    return Object.prototype.toString.call(value) === "[object Array]";
  }

  function solve(seedOrFields, options) {
    var source = fieldsOf(seedOrFields);
    var zones = collect(source);

    if (zones.rim.length > RIM_MAX) return err("TOO_MANY_RIM");
    if (zones.inner.length > INNER_MAX) return err("TOO_MANY_RIM");
    if (zones.bottom.length > BOTTOM_MAX) return err("TOO_MANY_RIM");

    var seedOptions = (seedOrFields && seedOrFields.options) || {};
    var mirror = !!((options && "mirror" in options) ? options.mirror : seedOptions.mirror);

    var hasRim = zones.rim.length > 0;
    var hasInner = zones.inner.length > 0;
    var hasBottom = zones.bottom.length > 0;

    var wanted = readOrder(
      (options && "order" in options) ? options.order : seedOptions.order,
      zones.rim.length + zones.inner.length + zones.bottom.length);
    if (!wanted.ok) return wanted;

    var rimOrb = hasRim ? (hasInner ? RIM_WITH_INNER : RIM_PLAIN) : 0;
    var innerOrb = hasInner ? INNER_ORB : 0;
    var bottomOrb = hasBottom ? BOTTOM_ORB : 0;

    var rims = rimAngles(zones.rim.length);
    var inners = innerAngles(zones.inner.length);
    var bottoms = bottomAngles(zones.bottom.length);

    function finish(list) {
      var out = [];
      var i;
      for (i = 0; i < list.length; i += 1) {
        out.push(round(mirror ? norm(180 - list[i]) : list[i], 1));
      }
      return out;
    }
    rims = finish(rims);
    inners = finish(inners);
    bottoms = finish(bottoms);

    /* r_note: the largest circle that keeps every top field clear of every
     * other top field and of the ding, never larger than the built-in max.
     * This is the D7 ceiling made mechanical - 11 rim fields stay apart
     * because the packing bound, not a constant, sets the radius. */
    var topPoints = [];
    var i;
    for (i = 0; i < rims.length; i += 1) topPoints.push(point(rimOrb, rims[i]));
    for (i = 0; i < inners.length; i += 1) topPoints.push(point(innerOrb, inners[i]));

    var dingPoint = [0, -DING_DY];
    var dingClear = Infinity;
    for (i = 0; i < topPoints.length; i += 1) {
      dingClear = Math.min(dingClear, distance(topPoints[i], dingPoint) - R_DING);
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
    reach = Math.max(reach, DING_DY + R_DING);
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

    var geom = {
      rim: round(rimOrb, 4),
      inner: round(innerOrb, 4),
      bottom: round(bottomOrb, 4),
      r_ding: R_DING,
      ding_dy: DING_DY,
      r_note: rNote,
      r_bnote: rBnote,
      inner_ring: hasInner ? 0 : INNER_RING_DECOR,
      f_ding: round(F_DING_RATIO * R_DING, 4),
      f_note: fNote,
      f_bnote: fBnote,
      f_num: fNum,
      n_in: round(nIn, 4),
      n_out: round(nOut, 4),
      rim_num_out: rimNumOut,
      ext: ext
    };

    /* The correction is applied LAST, to the field-to-slot assignment only.
     * The SET of solved angles is unchanged - order says who sits where, not
     * where the seats are - so every geom value computed above is untouched
     * and mirror, which reflects the ANGLES, composes with it either way. */
    if (wanted.value) {
      var slots = rims.concat(inners, bottoms);
      var moved = [];
      var nRim = rims.length;
      var nInner = inners.length;
      for (i = 0; i < wanted.value.length; i += 1) moved.push(slots[wanted.value[i]]);
      rims = moved.slice(0, nRim);
      inners = moved.slice(nRim, nRim + nInner);
      bottoms = moved.slice(nRim + nInner);
    }

    var fields = {};
    var id;
    for (id in source) {
      if (!Object.prototype.hasOwnProperty.call(source, id)) continue;
      fields[id] = source[id].slice();
    }
    for (i = 0; i < zones.ding.length; i += 1) fields[zones.ding[i]][4] = null;
    for (i = 0; i < zones.rim.length; i += 1) fields[zones.rim[i]][4] = rims[i];
    for (i = 0; i < zones.inner.length; i += 1) fields[zones.inner[i]][4] = inners[i];
    for (i = 0; i < zones.bottom.length; i += 1) fields[zones.bottom[i]][4] = bottoms[i];

    return { ok: true, value: { geom: geom, fields: fields } };
  }

  HPE.layout = {
    solve: solve,
    rimAngles: rimAngles,
    bottomAngles: bottomAngles,
    innerAngles: innerAngles,
    CAPS: { rim: RIM_MAX, inner: INNER_MAX, bottom: BOTTOM_MAX },
    GEOM_KEYS: [
      "rim", "inner", "bottom", "r_ding", "ding_dy", "r_note", "r_bnote",
      "inner_ring", "f_ding", "f_note", "f_bnote", "f_num", "n_in", "n_out",
      "rim_num_out", "ext"
    ]
  };
})(HPE);
