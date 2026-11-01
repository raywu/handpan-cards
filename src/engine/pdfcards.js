// The print sheet, drawn in the browser.
//
// This is a port of tools/hifi.py, function for function, in the order that
// file defines them. It exists because a browser print dialog owns the paper
// and iOS Safari ignores @page: the only way a phone produces the sheet the
// print pipeline produces is to write the PDF here and hand the platform a
// finished file.
//
// Two rules govern every line below, and both come from real divergences:
//
//   Tracking. hifi.tracked advances per character by stringWidth(ch) + track.
//   Laying the run out in one call and adding track * (n - 1) is a different
//   drawing on any glyph pair a face would kern, so the loop is kept.
//
//   Rounding. Python round() is banker's and Math.round is half-up. Anywhere
//   the Python rounds, this goes through HPE.pdfdeck.bankers.
//
// The canvas wrapper at the top mimics the slice of reportlab's API hifi uses,
// so the ported bodies read as the Python reads and a future diff between the
// two files is a real diff rather than a translation.
var HPE = (typeof HPE !== "undefined") ? HPE : {};
HPE.pdfcards = (function () {
  "use strict";

  function core() {
    return HPE.core;
  }

  var BLACK = [0, 0, 0];
  var WHITE = [1, 1, 1];

  // ---- palette (tools/hifi.py's BLUE/GREEN/NAME/INK/SEP/ORANGE/FAINT) ----
  var BLUE0 = [0.043, 0.482, 0.459];
  var GREEN0 = [0.867, 0.561, 0.000];
  var NAME = [0.329, 0.329, 0.329];
  var INK = [0.141, 0.141, 0.141];
  var SEP = [0.451, 0.451, 0.451];
  var ORANGE = [0.8863, 0.4392, 0.0196];
  var FAINT = [0.78, 0.78, 0.78];
  var FAINT_DECOR = [0.7333, 0.7333, 0.7333];
  var LENS_EMPTY = [0.9529, 0.9451, 0.9608];

  var BLUE = BLUE0;
  var GREEN = GREEN0;

  // The card and the gutters are measured figures (CLAUDE.md, print spec);
  // only the page box is a choice, so it is the only thing `paper` moves.
  var GEOM = { PW: 612, PH: 792, CW: 177.6, CH: 247.2, GX: 12.2, GY: 9.4 };
  var PAPER = { letter: [612, 792], a4: [595.28, 841.89] };
  var CW = GEOM.CW, CH = GEOM.CH, GX = GEOM.GX, GY = GEOM.GY;

  function pageSize(paper) {
    return PAPER[paper] || PAPER.letter;
  }

  // ---- the reportlab slice hifi draws through ----------------------------
  // The starred operators are deliberate, not typos: reportlab's Canvas
  // defaults to FILL_EVEN_ODD, so hifi paints every fill even-odd and this
  // emitter must too or the two PDFs differ on every filled path.
  // tests/mutants/n_pdfcards_fill_only.patch and o_pdfcards_stroke_fill.patch
  // revert one branch each and must stay killed.
  function mode(stroke, fill) {
    if (stroke && fill) return "B*";
    if (fill) return "f*";
    return "S";
  }

  function Canvas(page) {
    this.p = page;
    this.font = "Label";
    this.size = 10;
    this.fill = BLACK;
  }
  Canvas.prototype.setFillColor = function (c) {
    this.fill = c;
    this.p.setFill(c[0], c[1], c[2]);
  };
  Canvas.prototype.setStrokeColor = function (c) {
    this.p.setStroke(c[0], c[1], c[2]);
  };
  Canvas.prototype.setLineWidth = function (w) { this.p.setLineWidth(w); };
  Canvas.prototype.setDash = function (a, b) {
    if (a === undefined) this.p.setDash(0);
    else this.p.setDash(a, b === undefined ? a : b);
  };
  Canvas.prototype.setFont = function (f, s) { this.font = f; this.size = s; };
  Canvas.prototype.drawString = function (x, y, s) {
    if (s === "") return;
    this.p.text(x, y, s, this.font, this.size);
  };
  Canvas.prototype.drawCentredString = function (x, y, s) {
    this.drawString(x - stringWidth(s, this.font, this.size) / 2, y, s);
  };
  Canvas.prototype.circle = function (x, y, r, stroke, fill) {
    this.p.circle(x, y, r, mode(stroke, fill));
  };
  Canvas.prototype.roundRect = function (x, y, w, h, r, stroke, fill) {
    this.p.roundRect(x, y, w, h, r, mode(stroke, fill));
  };
  Canvas.prototype.line = function (x1, y1, x2, y2) {
    this.p.line(x1, y1, x2, y2);
  };
  Canvas.prototype.setLineJoin = function (j) { this.p.op(j + " j"); };
  Canvas.prototype.pathOps = function (ops, stroke, fill) {
    var p = this.p;
    function n(v) {
      var t = (Math.round(v * 10000) / 10000).toFixed(4);
      return t.replace(/0+$/, "").replace(/\.$/, "");
    }
    ops.forEach(function (op) {
      p.op(op.slice(1).map(n).join(" ") + (op.length > 1 ? " " : "") +
           (op[0] === "m" ? "m" : op[0] === "c" ? "c" : "h"));
    });
    p.op(mode(stroke, fill));
  };
  Canvas.prototype.saveState = function () { this.p.save(); };
  Canvas.prototype.restoreState = function () { this.p.restore(); };
  Canvas.prototype.translate = function (x, y) { this.p.translate(x, y); };
  Canvas.prototype.rotate = function (d) { this.p.rotate(d); };

  function stringWidth(text, font, size) {
    return HPE.pdf.stringWidth(text, font, size);
  }

  // ---- text helpers (tools/hifi.py's tw/tracked/fit/note_w) --------------
  function tw(text, font, size, track) {
    track = track || 0.0;
    return stringWidth(text, font, size) +
           track * Math.max(0, text.length - 1);
  }

  function tracked(c, x, y, text, font, size, track, align, color) {
    track = track || 0.0;
    if (color) c.setFillColor(color);
    c.setFont(font, size);
    var w = tw(text, font, size, track);
    if (align === "c") x -= w / 2;
    else if (align === "r") x -= w;
    for (var i = 0; i < text.length; i++) {
      c.drawString(x, y, text[i]);
      x += stringWidth(text[i], font, size) + track;
    }
    return w;
  }

  function fit(text, font, size, maxw, track, floor) {
    track = track || 0.0;
    floor = floor === undefined ? 3.6 : floor;
    while (size > floor && tw(text, font, size, track * size / 10.0) > maxw) {
      size -= 0.25;
    }
    return size;
  }

  function noteW(name, octv, font, size) {
    return stringWidth(name, font, size) +
           stringWidth(String(octv), font, size * rule().OCTAVE_RATIO);
  }

  // ---- diagram label sizing (tools/hifi.py's label_ratio/label_size/num_size/fit_note) ----
  // One rule sizes every glyph the pan draws, in both outputs. See CLAUDE.md
  // under "Diagram label rule" for where the three ratios come from and why
  // the index number takes no 1.05.
  function rule() { return core().LABEL_RULE; }

  function labelRatio(zone) {
    var gl = PROFILE_DRAW.glyph;
    if (zone === "neo-main") return rule().LABEL_RATIO_NOTE * gl.main;
    if (zone === "neo-ding") return rule().LABEL_RATIO_DING * gl.ding;
    if (zone === "neo-lens") return rule().LABEL_RATIO_BNOTE * gl.lens;
    if (zone === "ding") return rule().LABEL_RATIO_DING;
    if (zone === "bottom") return rule().LABEL_RATIO_BNOTE;
    return rule().LABEL_RATIO_NOTE;
  }

  function labelSize(r, zone) { return r * labelRatio(zone); }

  function numSize(rNote) { return rNote * rule().NUM_RATIO; }

  function fitNote(name, octv, font, size, maxw) {
    while (size > 2.5 && noteW(name, octv, font, size) > maxw) size -= 0.1;
    return size;
  }

  function noteText(c, x, y, name, octv, font, size, color, centre) {
    var w = noteW(name, octv, font, size);
    if (centre === undefined || centre) x -= w / 2;
    c.setFillColor(color || BLACK);
    c.setFont(font, size);
    c.drawString(x, y, name);
    c.setFont(font, size * rule().OCTAVE_RATIO);
    c.drawString(x + stringWidth(name, font, size), y - size * 0.20,
                 String(octv));
    return w;
  }

  // ---- card chrome (tools/hifi.py's duo_frame/plain_frame/side_credit/card_header) ----
  function duoFrame(c, x, y, w, h, bw, rad, ga) {
    // gb is not passed: the 2026-09-16 restyle made the frame a single-colour
    // four-sided one in the root colour, and the deck grad tuple is kept
    // whole elsewhere for whatever a future restyle wants.
    bw = bw === undefined ? 2.8 : bw;
    rad = rad === undefined ? 7.0 : rad;
    ga = ga || BLUE;
    c.setFillColor(ga);
    c.roundRect(x, y, w, h, rad, 0, 1);
    c.setFillColor(WHITE);
    c.roundRect(x + bw, y + bw, w - 2 * bw, h - 2 * bw,
                Math.max(1.0, rad - bw), 0, 1);
  }

  function plainFrame(c, x, y, w, h, col, bw, rad) {
    c.setStrokeColor(col || NAME);
    c.setLineWidth(bw === undefined ? 1.0 : bw);
    c.setFillColor(WHITE);
    c.roundRect(x, y, w, h, rad === undefined ? 7.0 : rad, 1, 1);
  }

  function sideCredit(c, x, y, w, h, text) {
    c.saveState();
    c.translate(x + w - 6.0, y + 12);
    c.rotate(90);
    tracked(c, 0, 0, text, "Label", 3.5, 0.55, "l", FAINT);
    c.restoreState();
  }

  function fitClip(text, font, size, maxw, track, floor) {
    floor = floor === undefined ? 3.6 : floor;
    var s = size;
    while (s > floor && tw(text, font, s, track) > maxw) s = Math.max(floor, s - 0.25);
    if (tw(text, font, s, track) <= maxw) return { text: text, size: s };
    var t = text;
    while (t.length > 1 && tw(t.replace(/\s+$/, "") + "...", font, s, track) > maxw) {
      t = t.slice(0, -1);
    }
    return { text: t.replace(/\s+$/, "") + "...", size: s };
  }

  function cardHeader(c, x, y, w, h, deck, num, subtitle, main, sup, warnW) {
    warnW = warnW || 0;
    var numw = num ? tw(num, "Label", 4.4, 0.4) : 0.0;
    var right = warnW ? x + w - 16 - warnW - 4 : x + w - 16;
    var clip = fitClip(deck, "Label", 4.6, right - (x + 9) - numw - 6, 0.5);
    var dw = tracked(c, x + 9, y + 6.5, clip.text, "Label", clip.size, 0.5, "l", INK);
    if (num) tracked(c, x + 9 + dw + 6, y + 6.5, num, "Label", 4.4, 0.4, "l", SEP);
    if (subtitle) {
      var s = fit(subtitle, "LabelSB", 4.2, w * 0.65, 0.55);
      tracked(c, x + w / 2, y + h - 11.5, subtitle, "LabelSB", s,
              s * 0.055 * 2.4, "c", INK);
    }
    var size = 27.0;
    while (size > 8 && (tw(main, "Display", size, size * 0.02) +
                        tw(sup, "Display", size * 0.52, 0)) > w * 0.80) {
      size -= 0.5;
    }
    var supw = sup ? tw(sup, "Display", size * 0.52, 0) : 0.0;
    var wm = tw(main, "Display", size, size * 0.02);
    var base = y + h - 18 - size * 0.70;
    var xe = x + w / 2 + (wm + supw) / 2 - supw;
    tracked(c, xe, base, main, "Display", size, size * 0.02, "r", NAME);
    if (sup) {
      c.setFillColor(NAME);
      c.setFont("Display", size * 0.52);
      c.drawString(xe, base + size * 0.46, sup);
    }
  }

  function bottomLines(c, x, y, w, fields, roots, meta, yNames, yNums) {
    var size = 11.0, total = 0.0, i, f, nm, ov;
    while (size > 4.4) {
      total = 0.0;
      for (i = 0; i < fields.length; i++) {
        nm = meta[fields[i]][0];
        ov = meta[fields[i]][1];
        total += noteW(nm, ov, "Notes", size);
      }
      total += (fields.length - 1) * tw(" - ", "Notes", size);
      if (total <= w - 16) break;
      size -= 0.25;
    }
    var px = x + (w - total) / 2;
    for (i = 0; i < fields.length; i++) {
      f = fields[i];
      nm = meta[f][0];
      ov = meta[f][1];
      var col = roots.indexOf(f) >= 0 ? BLUE : GREEN;
      px += noteText(c, px, yNames, nm, ov, "Notes", size, col, false);
      if (i < fields.length - 1) {
        c.setFillColor(SEP);
        c.setFont("Notes", size);
        c.drawString(px, yNames, " - ");
        px += tw(" - ", "Notes", size);
      }
    }

    var s2 = 11.0, total2 = 0.0;
    while (s2 > 4.2) {
      total2 = 0.0;
      for (i = 0; i < fields.length; i++) {
        total2 += tw(meta[fields[i]][5], "Notes", s2);
      }
      total2 += (fields.length - 1) * tw(" - ", "Notes", s2);
      if (total2 <= w - 16) break;
      s2 -= 0.25;
    }
    px = x + (w - total2) / 2;
    for (i = 0; i < fields.length; i++) {
      f = fields[i];
      var lab = meta[f][5];
      c.setFillColor(roots.indexOf(f) >= 0 ? BLUE : GREEN);
      c.setFont("Notes", s2);
      c.drawString(px, yNums, lab);
      px += tw(lab, "Notes", s2);
      if (i < fields.length - 1) {
        c.setFillColor(SEP);
        c.drawString(px, yNums, " - ");
        px += tw(" - ", "Notes", s2);
      }
    }
  }

  // ---- diagram (tools/hifi.py's draw_ring) --------------------------------
  function drawRing(c, x, y, r, state) {
    c.setDash();
    c.setFillColor(WHITE);
    c.setStrokeColor(BLACK);
    c.setLineWidth(0.65);
    if (state === "off-bottom") {
      c.setStrokeColor([0.62, 0.62, 0.62]);
      c.setDash(1.6, 1.6);
      c.circle(x, y, r, 1, 1);
      c.setDash();
      return;
    }
    c.circle(x, y, r, 1, 1);
    if (state === "off") return;
    var col = (state === "root" || state === "ding-root") ? BLUE : GREEN;
    c.setStrokeColor(col);
    c.setLineWidth(r * 0.24);
    c.circle(x, y, r * 0.87, 1, 0);
    c.setStrokeColor(BLACK);
    c.setLineWidth(0.55);
    c.circle(x, y, r * 0.74, 1, 0);
  }

  function fieldOrder(spec) {
    // hifi iterates `spec.items()`, which is the adapter's insertion order;
    // a JS object with numeric-string keys iterates in ascending numeric
    // order instead. Fixing the order here keeps one drawing order for both,
    // and drawing order is visible: a later ring paints over an earlier one.
    return Object.keys(spec).filter(function (k) { return k !== "_geom"; })
      .sort(function (a, b) { return Number(a) - Number(b); });
  }

  // The paired-area profile's draw figures: a literal copy of
  // tests/fixtures/paired_profile_v3.json (ENGINE-SPEC section 18) plus the
  // stroke and glyph figures of the Neotone card (course-correction plan K3
  // and K8), held equal to the fixture and to HPE.layout.PROFILE by a test.
  // pdf_build.js loads no layout module, so the figures cannot be read from
  // it. A geom that carries `place` is drawn from it; every other geom takes
  // the acoustic path.
  var PROFILE_DRAW = {
    tonefields: 9,
    angles: [270, 230, 310, 190, 350, 150, 30, 110, 70],
    main: { orbit: 0.745, r: 0.19 },
    mutant: { depth: 0.3333, r: 0.19 },
    ding: { r: 0.2, dy: 0 },
    decor: { r: 0.355 },
    n_in: 0.085, number_out: 1.0758, extent_margin: 0.06,
    stroke: { outline: 0.012, decor: 0.0076, main_band: 0.046, lens_band: 0.024 },
    glyph: { main: 0.62, number: 0.62, ding: 0.623, lens: 0.565, mnum: 0.5 }
  };

  // Print radius of a placed deck, or null for an acoustic geom: the reach is
  // fixed by the profile (the main numbers outside the rim and the ding
  // edge), not by which slots are occupied.
  function profileExtent(geom) {
    if (!geom.place) return null;
    var pd = PROFILE_DRAW;
    var reach = pd.number_out + rule().NUM_RATIO * pd.main.r / 2;
    var ding = geom.r_ding + Math.abs(geom.ding_dy || 0);
    return Math.max(reach, ding) + pd.extent_margin;
  }

  function profileRadius(geom) {
    var ext = profileExtent(geom);
    return ext === null ? null : HPE.pdfdeck.bankers(74.0 / ext, 1);
  }

  // ---- Neotone card shapes (analytic: no clip paths) -----------------------
  // Every shape is a closed path of cubic arcs of at most a quarter turn, in a
  // local frame (u along the radial line, v across it) in units of R. The
  // lens is the intersection of two disks and the crescent the first disk
  // less the second; both come from the two circle-circle intersection
  // points, so print, app and tools/hifi.py draw identical vectors.
  function arcOps(cu, cv, r, t0, t1, ops) {
    var n = Math.max(1, Math.ceil(Math.abs(t1 - t0) / (Math.PI / 2) - 1e-9));
    var d = (t1 - t0) / n;
    var k = 4 / 3 * Math.tan(d / 4);
    for (var i = 0; i < n; i++) {
      var ta = t0 + i * d, tb = ta + d;
      var ca = Math.cos(ta), sa = Math.sin(ta), cb = Math.cos(tb), sb = Math.sin(tb);
      ops.push(["c",
        cu + r * (ca - k * sa), cv + r * (sa + k * ca),
        cu + r * (cb + k * sb), cv + r * (sb - k * cb),
        cu + r * cb, cv + r * sb]);
    }
  }

  function twoCircles(a, ra, b, rb) {
    var d = a - b;
    var xb = (d * d + rb * rb - ra * ra) / (2 * d);
    var h = Math.sqrt(rb * rb - xb * xb);
    return { up: b + xb, h: h, aa: Math.atan2(h, b + xb - a), ab: Math.atan2(h, xb) };
  }

  function lensOps(a, ra, b, rb) {
    var t = twoCircles(a, ra, b, rb);
    var ops = [["m", t.up, t.h]];
    arcOps(a, 0, ra, t.aa, 2 * Math.PI - t.aa, ops);
    arcOps(b, 0, rb, -t.ab, t.ab, ops);
    ops.push(["h"]);
    return ops;
  }

  function crescentOps(a, ra, b, rb) {
    var t = twoCircles(a, ra, b, rb);
    var ops = [["m", t.up, t.h]];
    arcOps(a, 0, ra, t.aa, -t.aa, ops);
    arcOps(b, 0, rb, -t.ab, t.ab, ops);
    ops.push(["h"]);
    return ops;
  }

  function neoRound(v) { return Math.round(v * 10000) / 10000; }

  function neoMutantFigures() {
    var pd = PROFILE_DRAW, r = pd.main.r;
    var depth = 2 * r * pd.mutant.depth;
    var lensC = neoRound(pd.main.orbit - (2 * r - depth));
    var st = pd.stroke;
    var dm = st.decor + st.main_band / 2;
    var dl = st.decor + st.outline + st.lens_band / 2;
    return {
      depth: depth, lensC: lensC, r: r, rl: pd.mutant.r,
      lens: lensOps(pd.main.orbit, r, lensC, pd.mutant.r),
      crescentBand: crescentOps(pd.main.orbit, r - dm, lensC, pd.mutant.r + dm),
      lensBand: lensOps(pd.main.orbit, r - dl, lensC, pd.mutant.r - dl)
    };
  }

  // The card as data, in units of R, polar around the pan centre: what the
  // print drawer and the app both draw. `st(id)` is "root" | "on" | "off".
  function neoPlan(spec, g, st) {
    var pd = PROFILE_DRAW, place = g.place;
    var main = {}, mut = {};
    var ding = null;
    Object.keys(spec).forEach(function (k) {
      if (k === "_geom") return;
      var v = spec[k];
      if (v[3] === "ding") { ding = k; return; }
      var pl = place[k];
      if (!pl) return;
      (pl[3] === "mutant" ? mut : main)[pl[0]] = k;
    });
    var hasMut = Object.keys(mut).length > 0;
    var fig = hasMut ? neoMutantFigures() : null;
    var tones = [];
    function entry(id) {
      var v = spec[id];
      return { id: id, name: v[0], oct: v[1], label: v[5], st: st(id) };
    }
    if (hasMut) {
      pd.angles.forEach(function (ang) {
        var t = { theta: ang, orbit: pd.main.orbit, r: pd.main.r,
                  main: main[ang] === undefined ? null : entry(main[ang]),
                  lens: mut[ang] === undefined ? null : entry(mut[ang]) };
        tones.push(t);
      });
    } else {
      Object.keys(place).sort(function (a, b) { return Number(a) - Number(b); })
        .forEach(function (k) {
          var pl = place[k];
          tones.push({ theta: pl[0], orbit: pl[1], r: pl[2],
                       main: entry(k), lens: null });
        });
    }
    var gl = pd.glyph, ru = rule();
    return {
      hasMut: hasMut, fig: fig, tones: tones,
      ding: ding === null ? null : entry(ding),
      numberU: function (t) {
        return hasMut ? pd.number_out : t.orbit - t.r - g.n_in;
      },
      mnumU: pd.main.orbit - pd.main.r - pd.n_in,
      nameU: function (t) { return hasMut ? t.orbit + fig.depth / 2 : t.orbit; },
      lensNameU: hasMut ? fig.lensC + fig.rl - fig.depth / 2 : 0,
      nameSize: function (t) { return ru.LABEL_RATIO_NOTE * gl.main * t.r; },
      nameCap: function (t) {
        return ru.LABEL_WIDTH_RATIO * (hasMut ? fig.depth : t.r);
      },
      numSize: function (t) { return ru.NUM_RATIO * gl.number * t.r; },
      mnumSize: function (t) { return ru.NUM_RATIO * gl.mnum * t.r; },
      lensSize: hasMut ? ru.LABEL_RATIO_BNOTE * gl.lens * fig.rl : 0,
      lensCap: hasMut ? ru.LABEL_WIDTH_RATIO * fig.depth / 2 : 0,
      dingSize: ru.LABEL_RATIO_DING * gl.ding * g.r_ding,
      dingCap: ru.LABEL_WIDTH_RATIO * g.r_ding,
      nameFloor: 3.6 / ru.OCTAVE_RATIO
    };
  }

  function neoPoint(ops, ox, oy, R, theta, sign) {
    var a = theta * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    return ops.map(function (op) {
      var out = [op[0]];
      for (var i = 1; i < op.length; i += 2) {
        out.push(ox + R * (op[i] * ca - op[i + 1] * sa),
                 oy + sign * R * (op[i] * sa + op[i + 1] * ca));
      }
      return out;
    });
  }

  function neoFit(name, oct, size, cap, floor) {
    while (size - 0.1 >= floor && noteW(name, oct, "Label", size) > cap) size -= 0.1;
    return size;
  }

  function neoDrawPan(c, cx, cy, R, spec, active, roots, numbers) {
    var pd = PROFILE_DRAW, g = spec._geom, stk = pd.stroke;
    var plan = neoPlan(spec, g, function (id) {
      var i = Number(id);
      return roots.indexOf(i) >= 0 ? "root" : active.indexOf(i) >= 0 ? "on" : "off";
    });
    var out = R * stk.outline;
    function colour(s) { return s === "root" ? BLUE : GREEN; }
    function name(x, y, nm, oct, size, cap, floor) {
      var fs = neoFit(nm, oct, size * R, cap * R, floor);
      noteText(c, x, y - fs * 0.34, nm, oct, "Label", fs, INK);
    }
    function pos(u, th) {
      var a = th * Math.PI / 180;
      return [cx + R * u * Math.cos(a), cy + R * u * Math.sin(a)];
    }
    c.setStrokeColor(FAINT_DECOR); c.setLineWidth(R * stk.decor);
    c.circle(cx, cy, R * pd.decor.r, 1, 0);

    var dr = R * g.r_ding;
    c.setDash(); c.setFillColor(WHITE); c.setStrokeColor(BLACK);
    c.setLineWidth(out);
    c.circle(cx, cy - R * (g.ding_dy || 0), dr, 1, 1);
    if (plan.ding.st !== "off") {
      c.setStrokeColor(colour(plan.ding.st));
      c.setLineWidth(R * stk.main_band);
      c.circle(cx, cy - R * (g.ding_dy || 0),
               dr - R * (stk.decor + stk.main_band / 2), 1, 0);
    }
    name(cx, cy - R * (g.ding_dy || 0), plan.ding.name, plan.ding.oct,
         plan.dingSize, plan.dingCap, plan.nameFloor);

    c.setLineJoin(1);
    plan.tones.forEach(function (t) {
      var th = t.theta, p = pos(t.orbit, th), rr = R * t.r;
      c.setDash(); c.setFillColor(WHITE); c.setStrokeColor(BLACK);
      c.setLineWidth(out);
      c.circle(p[0], p[1], rr, 1, 1);
      if (plan.hasMut) {
        var f = plan.fig;
        c.setFillColor(t.lens ? WHITE : LENS_EMPTY);
        c.pathOps(neoPoint(f.lens, cx, cy, R, th, 1), 0, 1);
        if (t.main && t.main.st !== "off") {
          c.setStrokeColor(colour(t.main.st)); c.setLineWidth(R * stk.main_band);
          c.pathOps(neoPoint(f.crescentBand, cx, cy, R, th, 1), 1, 0);
        }
        if (t.lens && t.lens.st !== "off") {
          c.setStrokeColor(colour(t.lens.st)); c.setLineWidth(R * stk.lens_band);
          c.pathOps(neoPoint(f.lensBand, cx, cy, R, th, 1), 1, 0);
        }
        c.setStrokeColor(BLACK); c.setLineWidth(out);
        c.circle(p[0], p[1], rr, 1, 0);
        c.pathOps(neoPoint(f.lens, cx, cy, R, th, 1), 1, 0);
      } else if (t.main.st !== "off") {
        c.setStrokeColor(colour(t.main.st)); c.setLineWidth(R * stk.main_band);
        c.circle(p[0], p[1], rr - R * (stk.decor + stk.main_band / 2), 1, 0);
      }
    });
    c.setLineJoin(0);
    plan.tones.forEach(function (t) {
      if (t.main) {
        var q = pos(plan.nameU(t), t.theta);
        name(q[0], q[1], t.main.name, t.main.oct, plan.nameSize(t),
             plan.nameCap(t), plan.nameFloor);
      }
      if (t.lens) {
        var l = pos(plan.lensNameU, t.theta);
        name(l[0], l[1], t.lens.name, t.lens.oct, plan.lensSize,
             plan.lensCap, plan.nameFloor);
      }
    });
    if (!numbers) return;
    plan.tones.forEach(function (t) {
      function num(u, label, size, col, font) {
        var q = pos(u, t.theta);
        c.setFillColor(col); c.setFont(font, size);
        c.drawCentredString(q[0], q[1] - size * 0.36, label);
      }
      if (t.main) {
        num(plan.numberU(t), t.main.label, Math.max(plan.numSize(t) * R, 3.6),
            INK, "Label");
      }
      if (t.lens) {
        num(plan.mnumU, t.lens.label, Math.max(plan.mnumSize(t) * R, 3.6),
            ORANGE, "LabelSB");
      }
    });
  }

  function drawPan(c, cx, cy, R, spec, active, roots, numbers) {
    active = active || [];
    roots = roots || [];
    numbers = numbers === undefined ? true : numbers;
    var g = spec._geom;
    var nfs = numSize(R * g.r_note);
    c.setStrokeColor(BLACK); c.setLineWidth(1.15); c.setDash();
    c.circle(cx, cy, R, 1, 0);
    if (g.place) {
      neoDrawPan(c, cx, cy, R, spec, active, roots, numbers);
      return;
    }
    if (g.inner_ring) {
      c.setLineWidth(0.6);
      c.circle(cx, cy, R * g.inner_ring, 1, 0);
    }
    if (g.bottom) {
      c.setStrokeColor([0.90, 0.90, 0.90]); c.setLineWidth(0.7);
      c.setDash(2.2, 2.2);
      c.circle(cx, cy, R * g.bottom, 1, 0);
      c.setDash();
    }

    function state(i, bottom) {
      if (roots.indexOf(i) >= 0) {
        return core().isDing(spec[i]) ? "ding-root" : "root";
      }
      if (active.indexOf(i) >= 0) return "on";
      return bottom ? "off-bottom" : "off";
    }

    fieldOrder(spec).forEach(function (key) {
      var i = Number(key);
      var val = spec[key];
      var nm = val[0], ov = val[1], zone = val[3], ang = val[4], lab = val[5];
      if (zone === "ding") {
        var rr0 = R * g.r_ding;
        var dy = R * (g.ding_dy || 0.0);
        drawRing(c, cx, cy - dy, rr0, state(i, false));
        var fs0 = fitNote(nm, ov, "Label", labelSize(rr0, zone),
                          rr0 * rule().LABEL_WIDTH_RATIO);
        noteText(c, cx, cy - dy - rr0 * 0.30, nm, ov, "Label", fs0, INK);
        return;
      }
      var orb = R * g[zone];
      var rr = R * (zone === "bottom" ? g.r_bnote : g.r_note);
      var a = ang * Math.PI / 180;
      var px = cx + orb * Math.cos(a), py = cy + orb * Math.sin(a);
      drawRing(c, px, py, rr, state(i, zone === "bottom"));
      var fs = fitNote(nm, ov, "Label", labelSize(rr, zone),
                       rr * rule().LABEL_WIDTH_RATIO);
      noteText(c, px, py - rr * 0.30, nm, ov, "Label", fs, INK);
      if (numbers) {
        var nr, col, fnt;
        if (zone === "bottom") {
          nr = orb + rr + R * g.n_out;
          col = ORANGE; fnt = "LabelSB";
        } else if (zone === "rim" && g.rim_num_out) {
          nr = orb + rr + R * g.n_in;
          col = INK; fnt = "Label";
        } else {
          nr = orb - rr - R * g.n_in;
          col = INK; fnt = "Label";
        }
        c.setFillColor(col); c.setFont(fnt, nfs);
        c.drawCentredString(cx + nr * Math.cos(a),
                            cy + nr * Math.sin(a) - nfs * 0.36, lab);
      }
    });
  }

  // ---- page assembly (tools/hifi.py's slots/crop_marks) -------------------
  function slots(paper) {
    var page = pageSize(paper);
    var tw_ = 3 * CW + 2 * GX;
    var th_ = 3 * CH + 2 * GY;
    var x0 = (page[0] - tw_) / 2;
    var y0 = (page[1] - th_) / 2;
    var out = [];
    for (var row = 0; row < 3; row++) {
      for (var col = 0; col < 3; col++) {
        out.push([x0 + col * (CW + GX),
                  y0 + th_ - (row + 1) * CH - row * GY]);
      }
    }
    return out;
  }

  function cropMarks(c, paper) {
    var page = pageSize(paper);
    var xs = [], ys = [];
    slots(paper).forEach(function (s) {
      [s[0], s[0] + CW].forEach(function (v) {
        if (xs.indexOf(v) < 0) xs.push(v);
      });
      [s[1], s[1] + CH].forEach(function (v) {
        if (ys.indexOf(v) < 0) ys.push(v);
      });
    });
    c.setStrokeColor([0.6, 0.6, 0.6]); c.setLineWidth(0.3);
    var m = 8.0;
    xs.sort(function (a, b) { return a - b; }).forEach(function (x) {
      c.line(x, 6, x, 6 + m);
      c.line(x, page[1] - 6, x, page[1] - 6 - m);
    });
    ys.sort(function (a, b) { return a - b; }).forEach(function (y) {
      c.line(6, y, 6 + m, y);
      c.line(page[0] - 6, y, page[0] - 6 - m, y);
    });
  }

  // ---- card types (tools/hifi.py's chord_card/title_card/legend_card/blank_card) ----
  var CARD_WARNINGS = { NO_THIRDS: "NO 3RDS ON THIS PAN" };

  function cardWarnings(deck) {
    return (deck.warnings || []).filter(function (w) {
      return Object.prototype.hasOwnProperty.call(CARD_WARNINGS, w.code);
    }).map(function (w) { return CARD_WARNINGS[w.code]; });
  }

  function chordCard(c, x, y, deck, num, chord) {
    var main = chord[0], sup = chord[1], subtitle = chord[2];
    var fields = chord[3], roots = chord[4];
    var spec = deck.spec;
    var rootPc = core().pc(spec[roots[0]][2]);
    var pcs = fields.map(function (f) {
      return core().pc(spec[f][2]);
    });
    var every = fieldOrder(spec).map(Number);
    var activeAll = every.filter(function (k) {
      return pcs.indexOf(core().pc(spec[k][2])) >= 0;
    });
    var rootsAll = every.filter(function (k) {
      return core().pc(spec[k][2]) === rootPc;
    });
    var ga = (deck.grad || [null, null])[0];
    duoFrame(c, x, y, CW, CH, undefined, undefined, ga);
    var warnW = Math.max.apply(null, [0].concat(cardWarnings(deck).map(function (l) {
      return tw(l, "LabelSB", 4.0, 0.7);
    })));
    cardHeader(c, x, y, CW, CH, deck.name, "#" + num, subtitle, main, sup, warnW);
    var deg = (deck.degrees || {})[String(rootPc)];
    if (deg) {
      tracked(c, x + 9, y + CH - 13.5, deg, "LabelSB", 6.0, 0.4, "l", BLUE);
    }
    sideCredit(c, x, y, CW, CH, deck.credit);
    drawPan(c, x + CW / 2, y + deck.cy, deck.R, spec, activeAll, rootsAll);

    var nb = spec._geom && spec._geom.place ? 0 :
        fields.filter(function (f) { return spec[f][3] === "bottom"; }).length;
    if (nb) {
      tracked(c, x + CW / 2, y + deck.y_note + 13,
              nb + " BOTTOM NOTE" + (nb > 1 ? "S" : ""),
              "LabelSB", 4.6, 0.7, "c", ORANGE);
    }
    bottomLines(c, x, y, CW, fields, roots, spec,
                y + deck.y_note, y + deck.y_num);

    // Owner decision 2026-09-15: a pan-wide warning belongs on the CARDS.
    // The shop variant ships chord cards and nothing else, so a warning drawn
    // only on the title card is dropped by the file the print shop gets.
    cardWarnings(deck).forEach(function (line, i) {
      tracked(c, x + CW - 16, y + 6.0 - i * 5.5, line, "LabelSB", 4.0, 0.7,
              "r", ORANGE);
    });
  }

  // tools/hifi.py's BLURB_* and blurb_layout: a note line wider than the card
  // wraps at a note boundary, and a blurb too tall for the card steps its size
  // and spacing down together, never under the 3.6 pt floor, never dropping a
  // line.
  var BLURB_Y0 = 26.0, BLURB_SIZE = 4.2, BLURB_STEP = 8.0, BLURB_TRACK = 0.35;
  var BLURB_LAST_BASELINE = 2.0;
  var BLURB_FLOOR = 3.6;
  var BLURB_MIN_STEP = 1.2 * BLURB_FLOOR;

  function wrapBlurbLine(text, maxw) {
    if (tw(text, "Label", BLURB_SIZE, BLURB_TRACK) <= maxw) return [text];
    var tokens = [];
    text.split("  ").forEach(function (tok) {
      if (tok === "|" && tokens.length) tokens[tokens.length - 1] += "  |";
      else tokens.push(tok);
    });
    var out = [tokens[0]];
    tokens.slice(1).forEach(function (tok) {
      var trial = out[out.length - 1] + "  " + tok;
      if (tw(trial, "Label", BLURB_SIZE, BLURB_TRACK) <= maxw) {
        out[out.length - 1] = trial;
      } else {
        out.push(tok);
      }
    });
    return out;
  }

  function blurbLayout(lines) {
    var rows = [];
    lines.forEach(function (ln) {
      wrapBlurbLine(ln, CW - 24).forEach(function (part) {
        rows.push({ text: part, bottom: ln.indexOf("BOTTOM") === 0 });
      });
    });
    var size = BLURB_SIZE, step = BLURB_STEP;
    var room = BLURB_Y0 - BLURB_LAST_BASELINE;
    if (rows.length > 1 && (rows.length - 1) * step > room) {
      var f = room / ((rows.length - 1) * step);
      step = Math.max(step * f, BLURB_MIN_STEP);
      size = Math.max(BLURB_SIZE * f, BLURB_FLOOR);
    }
    return { rows: rows, size: size, step: step };
  }

  function titleCard(c, x, y, deck) {
    plainFrame(c, x, y, CW, CH);
    var s = fit(deck.name, "Display", 16, CW - 24, 0.4);
    tracked(c, x + 12, y + CH - 24, deck.name, "Display", s, s * 0.03, "l", INK);
    tracked(c, x + 12, y + CH - 34, deck.sub, "Label", 4.6, 0.5, "l", SEP);
    tracked(c, x + CW - 12, y + CH - 34, "CHORD CARDS", "LabelSB", 4.6, 0.9,
            "r", SEP);
    sideCredit(c, x, y, CW, CH, deck.credit);
    var tops = fieldOrder(deck.spec).map(Number).filter(function (k) {
      return deck.spec[k][3] !== "bottom";
    });
    drawPan(c, x + CW / 2, y + deck.cy, deck.R, deck.spec, tops, [0]);
    var lay = blurbLayout(deck.blurb);
    lay.rows.forEach(function (row, i) {
      tracked(c, x + CW / 2, y + BLURB_Y0 - i * lay.step, row.text, "Label",
              lay.size, BLURB_TRACK, "c", row.bottom ? ORANGE : SEP);
    });
  }

  function legendCard(c, x, y, deck) {
    plainFrame(c, x, y, CW, CH);
    tracked(c, x + 9, y + CH - 13.5, deck.name, "Label", 4.6, 0.5, "l", INK);
    tracked(c, x + CW - 9, y + CH - 12.5, "LEGEND", "LabelSB", 4.2, 0.9, "r",
            INK);
    var s = fit("How to read", "Display", 20, CW * 0.62);
    tracked(c, x + CW - 9, y + CH - 34, "How to read", "Display", s, s * 0.02,
            "r", NAME);
    sideCredit(c, x, y, CW, CH, deck.credit);

    var demo = deck.legend_demo[0], demoRoot = deck.legend_demo[1];
    drawPan(c, x + CW / 2, y + deck.cy, deck.R, deck.spec, [demo], [demoRoot]);

    var sy = y + deck.y_note + 12;
    var r = 4.6;
    drawRing(c, x + 16, sy, r, "ding-root");
    tracked(c, x + 24, sy - 1.8, "ROOT NOTE", "Label", 4.2, 0.4, "l", INK);
    drawRing(c, x + 82, sy, r, "on");
    tracked(c, x + 90, sy - 1.8, "CHORD NOTE", "Label", 4.2, 0.4, "l", INK);
    deck.legend_lines.forEach(function (ln, i) {
      tracked(c, x + CW / 2, y + deck.y_num + 2 - i * 7, ln, "Label", 4.0, 0.3,
              "c", (i === 0 && deck.has_bottom) ? ORANGE : SEP);
    });
  }

  function blankCard(c, x, y, deck) {
    plainFrame(c, x, y, CW, CH, FAINT);
    tracked(c, x + 9, y + CH - 13.5, deck.name, "Label", 4.6, 0.5, "l", FAINT);
    sideCredit(c, x, y, CW, CH, deck.credit);
    drawPan(c, x + CW / 2, y + deck.cy, deck.R, deck.spec);
    c.setStrokeColor([0.88, 0.88, 0.88]); c.setLineWidth(0.5);
    c.line(x + 18, y + deck.y_note - 3, x + CW - 18, y + deck.y_note - 3);
    c.line(x + 18, y + deck.y_num - 3, x + CW - 18, y + deck.y_num - 3);
  }

  // ---- build (tools/hifi.py's build()) -------------------------------------
  function build(deck, opts) {
    opts = opts || {};
    // The "full" variant (anything but "shop": title card, legend card, blank
    // padding) is not used by the app since 2026-10-08; kept, and tested.
    var chordsOnly = opts.variant === "shop";
    var paper = PAPER[opts.paper] ? opts.paper : "letter";
    var page = pageSize(paper);

    BLUE = deck.col_root || BLUE0;
    GREEN = deck.col_tone || GREEN0;
    var placedR = profileRadius(deck.spec._geom);
    if (placedR) deck = Object.assign({}, deck, { R: placedR });

    var doc = HPE.pdf.doc(page[0], page[1]);
    var S = slots(paper);

    var cards = [];
    var i;
    if (chordsOnly) {
      for (i = 0; i < deck.chords.length; i++) {
        cards.push(["chord", [i + 1, deck.chords[i]]]);
      }
      while (cards.length % 9 !== 0) cards.push(["skip", null]);
    } else {
      cards.push(["title", null]);
      cards.push(["legend", null]);
      for (i = 0; i < deck.chords.length; i++) {
        cards.push(["chord", [i + 1, deck.chords[i]]]);
      }
      for (i = 0; i < (deck.blank_cards || 0); i++) cards.push(["blank", null]);
      while (cards.length % 9 !== 0) cards.push(["blank", null]);
    }

    function calibration(c) {
      var x0 = 12.0, y0 = 220.0, ln = 144.0;
      c.setStrokeColor([0.45, 0.45, 0.45]); c.setLineWidth(0.5);
      c.line(x0, y0, x0, y0 + ln);
      [0, ln].forEach(function (t) {
        c.line(x0 - 3, y0 + t, x0 + 3, y0 + t);
      });
      c.saveState(); c.translate(x0 + 6, y0 + 8); c.rotate(90);
      c.setFillColor([0.45, 0.45, 0.45]); c.setFont("Label", 4.2);
      c.drawString(0, 0, "2.00 IN / 50.8 MM  -  VERIFY AT 100% SCALE");
      c.restoreState();
    }

    var c = null;
    cards.forEach(function (entry, idx) {
      if (idx % 9 === 0) {
        c = new Canvas(doc.page());
        cropMarks(c, paper);
        if (idx === 0) calibration(c);
      }
      var slot = S[idx % 9];
      var x = slot[0], y = slot[1];
      if (entry[0] === "chord") chordCard(c, x, y, deck, entry[1][0], entry[1][1]);
      else if (entry[0] === "title") titleCard(c, x, y, deck);
      else if (entry[0] === "legend") legendCard(c, x, y, deck);
      else if (entry[0] === "blank") blankCard(c, x, y, deck);
    });

    return doc.bytes();
  }

  return {
    build: build,
    slots: slots,
    GEOM: GEOM,
    PAPER: PAPER,
    CARD_WARNINGS: CARD_WARNINGS,
    labelRatio: labelRatio,
    labelSize: labelSize,
    numSize: numSize,
    profileRadius: profileRadius,
    profileExtent: profileExtent,
    PROFILE_DRAW: PROFILE_DRAW,
    neoPlan: neoPlan,
    lensOps: lensOps,
    crescentOps: crescentOps,
    // exported for the port's own unit tests, not for the app
    _internal: {
      Canvas: Canvas, tracked: tracked,
      tw: tw, fit: fit, labelSize: labelSize,
      numSize: numSize, fitNote: fitNote, blurbLayout: blurbLayout,
      cardHeader: cardHeader, chordCard: chordCard, fitClip: fitClip
    }
  };
}());
