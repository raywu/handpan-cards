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

  var BLACK = [0, 0, 0];
  var WHITE = [1, 1, 1];

  // ---- palette (tools/hifi.py:22-32) ------------------------------------
  var BLUE0 = [0.043, 0.482, 0.459];
  var GREEN0 = [0.867, 0.561, 0.000];
  var NAME = [0.329, 0.329, 0.329];
  var INK = [0.141, 0.141, 0.141];
  var SEP = [0.451, 0.451, 0.451];
  var ORANGE = [0.8863, 0.4392, 0.0196];
  var FAINT = [0.78, 0.78, 0.78];

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
  function mode(stroke, fill) {
    if (stroke && fill) return "B";
    if (fill) return "f";
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
  Canvas.prototype.saveState = function () { this.p.save(); };
  Canvas.prototype.restoreState = function () { this.p.restore(); };
  Canvas.prototype.translate = function (x, y) { this.p.translate(x, y); };
  Canvas.prototype.rotate = function (d) { this.p.rotate(d); };

  function stringWidth(text, font, size) {
    return HPE.pdf.stringWidth(text, font, size);
  }

  // ---- text helpers (tools/hifi.py:41-68) --------------------------------
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
           stringWidth(String(octv), font, size * 0.66);
  }

  // ---- diagram label sizing (tools/hifi.py:118-160) ----------------------
  // One rule sizes every glyph the pan draws, in both outputs. See CLAUDE.md
  // under "Diagram label rule" for where the three ratios come from and why
  // the index number takes no 1.05.
  var LABEL_RATIO_DING = 0.70875;
  var LABEL_RATIO_NOTE = 0.80325;
  var LABEL_RATIO_BNOTE = 0.8232;
  var NUM_RATIO = 0.64;
  var LABEL_WIDTH_RATIO = 1.47;

  function labelRatio(zone) {
    if (zone === "ding") return LABEL_RATIO_DING;
    if (zone === "bottom") return LABEL_RATIO_BNOTE;
    return LABEL_RATIO_NOTE;
  }

  function labelSize(r, zone) { return r * labelRatio(zone); }

  function numSize(rNote) { return rNote * NUM_RATIO; }

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
    c.setFont(font, size * 0.66);
    c.drawString(x + stringWidth(name, font, size), y - size * 0.20,
                 String(octv));
    return w;
  }

  // ---- card chrome (tools/hifi.py:176-223) -------------------------------
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

  function cardHeader(c, x, y, w, h, deck, num, subtitle, main, sup) {
    tracked(c, x + 9, y + h - 13.5, deck, "Label", 4.6, 0.5, "l", INK);
    if (num) tracked(c, x + 9, y + h - 21.5, num, "Label", 4.6, 0.4, "l", SEP);
    if (subtitle) {
      var s = fit(subtitle, "LabelSB", 4.2, w * 0.60, 0.55);
      tracked(c, x + w - 9, y + h - 12.5, subtitle, "LabelSB", s,
              s * 0.055 * 2.4, "r", INK);
    }
    var size = 27.0;
    while (size > 8 && (tw(main, "Display", size, size * 0.02) +
                        tw(sup, "Display", size * 0.52, 0)) > w * 0.62) {
      size -= 0.5;
    }
    var supw = sup ? tw(sup, "Display", size * 0.52, 0) : 0.0;
    var base = y + h - 24 - size * 0.70;
    tracked(c, x + w - 9 - supw, base, main, "Display", size, size * 0.02, "r",
            NAME);
    if (sup) {
      c.setFillColor(NAME);
      c.setFont("Display", size * 0.52);
      c.drawString(x + w - 9 - supw, base + size * 0.46, sup);
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

  // ---- diagram (tools/hifi.py:270-354) -----------------------------------
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

  function drawPan(c, cx, cy, R, spec, active, roots, numbers) {
    active = active || [];
    roots = roots || [];
    numbers = numbers === undefined ? true : numbers;
    var g = spec._geom;
    var nfs = numSize(R * g.r_note);
    c.setStrokeColor(BLACK); c.setLineWidth(1.15); c.setDash();
    c.circle(cx, cy, R, 1, 0);
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
        return spec[i][3] === "ding" ? "ding-root" : "root";
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
                          rr0 * LABEL_WIDTH_RATIO);
        noteText(c, cx, cy - dy - rr0 * 0.30, nm, ov, "Label", fs0, INK);
        return;
      }
      var orb = R * g[zone];
      var rr = R * (zone === "bottom" ? g.r_bnote : g.r_note);
      var a = ang * Math.PI / 180;
      var px = cx + orb * Math.cos(a), py = cy + orb * Math.sin(a);
      drawRing(c, px, py, rr, state(i, zone === "bottom"));
      var fs = fitNote(nm, ov, "Label", labelSize(rr, zone),
                       rr * LABEL_WIDTH_RATIO);
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

  // ---- page assembly (tools/hifi.py:356-377) -----------------------------
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

  // ---- card types (tools/hifi.py:431-521) --------------------------------
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
    var rootPc = ((spec[roots[0]][2] % 12) + 12) % 12;
    var pcs = fields.map(function (f) {
      return ((spec[f][2] % 12) + 12) % 12;
    });
    var every = fieldOrder(spec).map(Number);
    var activeAll = every.filter(function (k) {
      return pcs.indexOf(((spec[k][2] % 12) + 12) % 12) >= 0;
    });
    var rootsAll = every.filter(function (k) {
      return ((spec[k][2] % 12) + 12) % 12 === rootPc;
    });
    var ga = (deck.grad || [null, null])[0];
    duoFrame(c, x, y, CW, CH, undefined, undefined, ga);
    cardHeader(c, x, y, CW, CH, deck.name, "#" + num, subtitle, main, sup);
    var deg = (deck.degrees || {})[String(rootPc)];
    if (deg) {
      tracked(c, x + 9, y + CH - 31.5, deg, "LabelSB", 6.0, 0.4, "l", BLUE);
    }
    sideCredit(c, x, y, CW, CH, deck.credit);
    drawPan(c, x + CW / 2, y + deck.cy, deck.R, spec, activeAll, rootsAll);

    var nb = fields.filter(function (f) { return spec[f][3] === "bottom"; }).length;
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
      tracked(c, x + CW / 2, y + 6.0 - i * 5.5, line, "LabelSB", 4.0, 0.7,
              "c", ORANGE);
    });
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
    deck.blurb.forEach(function (ln, i) {
      tracked(c, x + CW / 2, y + 26 - i * 8, ln, "Label", 4.2, 0.35, "c",
              ln.indexOf("BOTTOM") === 0 ? ORANGE : SEP);
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

  // ---- build (tools/hifi.py:379-427) -------------------------------------
  function build(deck, opts) {
    opts = opts || {};
    var chordsOnly = opts.variant === "shop";
    var paper = PAPER[opts.paper] ? opts.paper : "letter";
    var page = pageSize(paper);

    BLUE = deck.col_root || BLUE0;
    GREEN = deck.col_tone || GREEN0;

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
    // exported for the port's own unit tests, not for the app
    _internal: {
      Canvas: Canvas, tracked: tracked,
      tw: tw, fit: fit, noteW: noteW, labelSize: labelSize,
      numSize: numSize, fitNote: fitNote, cardWarnings: cardWarnings
    }
  };
}());
