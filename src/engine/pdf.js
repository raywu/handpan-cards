// The PDF writer core.  Everything the print emitter draws goes through here,
// and nothing here knows what a card is.
//
// The page box is the whole reason this file exists.  A browser print dialog
// decides the paper itself and iOS Safari ignores @page entirely, so the only
// way a phone can produce the same sheet tools/hifi.py produces is to write the
// PDF ourselves and hand the platform a finished file.
//
// One invariant runs through the whole file: every byte that reaches the output
// buffer is pushed as a "latin1 string", one character per byte, code 0..255.
// That is what makes an offset a byte offset - a JS string is UTF-16, so the
// moment a two-byte character lands in the buffer, String#length stops counting
// bytes and every xref entry after it points into the middle of an object.
// Text is WinAnsi-escaped (the degree sign becomes the four ASCII characters
// \260) before it is ever appended, and push() asserts the rest.
var HPE = (typeof HPE !== "undefined") ? HPE : {};
HPE.pdf = (function () {
  "use strict";

  var FIRST_CHAR = 32;
  var LAST_CHAR = 255;

  // WinAnsiEncoding, restricted to what fontdata's CHARSET can draw: ASCII is
  // its own code, and the one non-ASCII character the decks use sits at 176.
  function winansi(ch) {
    var c = ch.charCodeAt(0);
    if (c >= 0x20 && c <= 0x7e) return c;
    if (ch === "°") return 0xb0;
    return -1;
  }

  function charAtCode(code) {
    if (code >= 0x20 && code <= 0x7e) return String.fromCharCode(code);
    if (code === 0xb0) return "°";
    return null;
  }

  // PDF wants a plain decimal, never an exponent, and a stable one: "612", not
  // "612.0000". Trailing-zero noise would also make two identical builds differ
  // byte for byte, which the print parity tests compare.
  function num(v) {
    if (!isFinite(v)) throw new Error("non-finite coordinate: " + v);
    var s = (Math.round(v * 10000) / 10000).toFixed(4);
    s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s === "-0" ? "0" : s;
  }

  function escapeText(s) {
    var out = "";
    for (var i = 0; i < s.length; i++) {
      var code = winansi(s[i]);
      if (code < 0) {
        throw new Error("character " + JSON.stringify(s[i]) +
                        " is outside CHARSET - the subset fonts cannot draw it");
      }
      if (code === 0x28 || code === 0x29 || code === 0x5c) {
        out += "\\" + s[i];
      } else if (code < 0x80) {
        out += s[i];
      } else {
        out += "\\" + ("00" + code.toString(8)).slice(-3);
      }
    }
    return out;
  }

  function faceData(face) {
    var f = HPE.fontdata.FACES[face];
    if (!f) throw new Error("unknown face " + JSON.stringify(face));
    return f;
  }

  function stringWidth(s, face, size) {
    var widths = faceData(face).widths;
    var total = 0;
    for (var i = 0; i < s.length; i++) {
      var w = widths[s[i]];
      if (w === undefined) {
        throw new Error("character " + JSON.stringify(s[i]) +
                        " is outside CHARSET - no advance for it");
      }
      total += w;
    }
    return (total / 1000) * size;
  }

  function Page(doc, w, h) {
    this.doc = doc;
    this.w = w;
    this.h = h;
    this.ops = [];
    this.faces = {};
  }

  Page.prototype.op = function (s) { this.ops.push(s); return this; };

  Page.prototype.setStroke = function (r, g, b) {
    return this.op(num(r) + " " + num(g) + " " + num(b) + " RG");
  };
  Page.prototype.setFill = function (r, g, b) {
    return this.op(num(r) + " " + num(g) + " " + num(b) + " rg");
  };
  Page.prototype.setLineWidth = function (w) { return this.op(num(w) + " w"); };
  Page.prototype.setDash = function (on, off, phase) {
    if (on === 0 || on === null || on === undefined) return this.op("[] 0 d");
    return this.op("[" + num(on) + " " + num(off === undefined ? on : off) +
                   "] " + num(phase || 0) + " d");
  };

  Page.prototype.save = function () { return this.op("q"); };
  Page.prototype.restore = function () { return this.op("Q"); };
  Page.prototype.translate = function (x, y) {
    return this.op("1 0 0 1 " + num(x) + " " + num(y) + " cm");
  };
  Page.prototype.rotate = function (deg) {
    var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return this.op(num(c) + " " + num(s) + " " + num(-s) + " " + num(c) +
                   " 0 0 cm");
  };

  Page.prototype.line = function (x1, y1, x2, y2) {
    this.op(num(x1) + " " + num(y1) + " m");
    this.op(num(x2) + " " + num(y2) + " l");
    return this.op("S");
  };

  Page.prototype.rect = function (x, y, w, h, mode) {
    this.op(num(x) + " " + num(y) + " " + num(w) + " " + num(h) + " re");
    return this.op(mode || "S");
  };

  // A quarter-circle bezier: 0.5523 is the standard kappa, and rounding a
  // corner with anything cruder is visible at card scale.
  var K = 0.5522847498;

  Page.prototype.roundRect = function (x, y, w, h, r, mode) {
    var rr = Math.min(r, w / 2, h / 2), k = rr * K;
    this.op(num(x + rr) + " " + num(y) + " m");
    this.op(num(x + w - rr) + " " + num(y) + " l");
    this.curve(x + w - rr + k, y, x + w, y + rr - k, x + w, y + rr);
    this.op(num(x + w) + " " + num(y + h - rr) + " l");
    this.curve(x + w, y + h - rr + k, x + w - rr + k, y + h, x + w - rr, y + h);
    this.op(num(x + rr) + " " + num(y + h) + " l");
    this.curve(x + rr - k, y + h, x, y + h - rr + k, x, y + h - rr);
    this.op(num(x) + " " + num(y + rr) + " l");
    this.curve(x, y + rr - k, x + rr - k, y, x + rr, y);
    this.op("h");
    return this.op(mode || "S");
  };

  Page.prototype.curve = function (x1, y1, x2, y2, x3, y3) {
    return this.op(num(x1) + " " + num(y1) + " " + num(x2) + " " + num(y2) +
                   " " + num(x3) + " " + num(y3) + " c");
  };

  Page.prototype.circle = function (cx, cy, r, mode) {
    var k = r * K;
    this.op(num(cx + r) + " " + num(cy) + " m");
    this.curve(cx + r, cy + k, cx + k, cy + r, cx, cy + r);
    this.curve(cx - k, cy + r, cx - r, cy + k, cx - r, cy);
    this.curve(cx - r, cy - k, cx - k, cy - r, cx, cy - r);
    this.curve(cx + k, cy - r, cx + r, cy - k, cx + r, cy);
    this.op("h");
    return this.op(mode || "S");
  };

  // Start and sweep in math-convention degrees, matching the instrument
  // geometry the rest of the repo is written in.
  Page.prototype.arc = function (cx, cy, r, start, sweep) {
    var steps = Math.max(1, Math.ceil(Math.abs(sweep) / 90));
    var seg = (sweep / steps) * Math.PI / 180;
    var a = start * Math.PI / 180;
    var k = (4 / 3) * Math.tan(seg / 4);
    this.op(num(cx + r * Math.cos(a)) + " " + num(cy + r * Math.sin(a)) + " m");
    for (var i = 0; i < steps; i++) {
      var b = a + seg;
      this.curve(cx + r * (Math.cos(a) - k * Math.sin(a)),
                 cy + r * (Math.sin(a) + k * Math.cos(a)),
                 cx + r * (Math.cos(b) + k * Math.sin(b)),
                 cy + r * (Math.sin(b) - k * Math.cos(b)),
                 cx + r * Math.cos(b), cy + r * Math.sin(b));
      a = b;
    }
    return this.op("S");
  };

  Page.prototype.text = function (x, y, s, face, size) {
    var body = escapeText(String(s));
    var id = this.doc.useFace(face);
    this.faces[face] = id;
    this.op("BT /F" + id + " " + num(size) + " Tf 1 0 0 1 " + num(x) + " " +
            num(y) + " Tm (" + body + ") Tj ET");
    return this;
  };

  Page.prototype.stringWidth = function (s, face, size) {
    return stringWidth(s, face, size);
  };

  function Doc(w, h) {
    this.w = w;
    this.h = h;
    this.pages = [];
    this.faceIds = {};
    this.faceOrder = [];
  }

  Doc.prototype.page = function (w, h) {
    var p = new Page(this, w === undefined ? this.w : w,
                     h === undefined ? this.h : h);
    this.pages.push(p);
    return p;
  };

  Doc.prototype.useFace = function (face) {
    faceData(face);
    if (!this.faceIds[face]) {
      this.faceOrder.push(face);
      this.faceIds[face] = this.faceOrder.length;
    }
    return this.faceIds[face];
  };

  Doc.prototype.stringWidth = function (s, face, size) {
    return stringWidth(s, face, size);
  };

  function widthsArray(face) {
    var widths = faceData(face).widths;
    var out = [];
    for (var c = FIRST_CHAR; c <= LAST_CHAR; c++) {
      var ch = charAtCode(c);
      out.push(ch === null ? "0" : num(widths[ch]));
    }
    return out.join(" ");
  }

  Doc.prototype.bytes = function () {
    // Objects are assembled as latin1 strings and only then measured, because
    // the xref offsets have to be the offsets of the bytes we actually write.
    var objs = [];          // 1-based; objs[n-1] is object n's full body
    function obj(body) { objs.push(body); return objs.length; }
    function reserve() { objs.push(null); return objs.length; }
    function place(n, body) { objs[n - 1] = body; }

    var catalogId = reserve();
    var pagesId = reserve();

    var self = this;
    var fontIds = {};
    this.faceOrder.forEach(function (face) {
      var f = faceData(face);
      var prog = atob(f.ttf);
      var fileId = obj("<< /Length " + prog.length + " /Length1 " +
                       prog.length + " >>\nstream\n" + prog + "\nendstream");
      var descId = obj("<< /Type /FontDescriptor /FontName /" + f.psname +
                       " /Flags " + f.flags +
                       " /FontBBox [" + f.bbox.map(num).join(" ") + "]" +
                       " /ItalicAngle " + num(f.italicAngle) +
                       " /Ascent " + num(f.ascent) +
                       " /Descent " + num(f.descent) +
                       " /CapHeight " + num(f.capHeight) +
                       " /StemV 80 /FontFile2 " + fileId + " 0 R >>");
      fontIds[face] = obj("<< /Type /Font /Subtype /TrueType /BaseFont /" +
                          f.psname + " /FirstChar " + FIRST_CHAR +
                          " /LastChar " + LAST_CHAR + " /Widths [" +
                          widthsArray(face) + "] /Encoding /WinAnsiEncoding" +
                          " /FontDescriptor " + descId + " 0 R >>");
    });

    var kids = [];
    this.pages.forEach(function (p) {
      var content = p.ops.join("\n") + "\n";
      var contentId = obj("<< /Length " + content.length + " >>\nstream\n" +
                          content + "endstream");
      var res = [];
      Object.keys(p.faces).forEach(function (face) {
        res.push("/F" + self.faceIds[face] + " " + fontIds[face] + " 0 R");
      });
      var pageId = obj("<< /Type /Page /Parent " + pagesId + " 0 R" +
                       " /MediaBox [0 0 " + num(p.w) + " " + num(p.h) + "]" +
                       " /Resources << /Font << " + res.join(" ") + " >> >>" +
                       " /Contents " + contentId + " 0 R >>");
      kids.push(pageId + " 0 R");
    });

    place(pagesId, "<< /Type /Pages /Count " + this.pages.length +
          " /Kids [" + kids.join(" ") + "] >>");
    place(catalogId, "<< /Type /Catalog /Pages " + pagesId + " 0 R >>");

    var chunks = ["%PDF-1.4\n%âãÏÓ\n"];
    var len = chunks[0].length;
    var offsets = [];
    objs.forEach(function (body, i) {
      offsets.push(len);
      var s = (i + 1) + " 0 obj\n" + body + "\nendobj\n";
      chunks.push(s);
      len += s.length;
    });

    var xref = "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
    offsets.forEach(function (off) {
      xref += ("0000000000" + off).slice(-10) + " 00000 n \n";
    });
    chunks.push(xref);
    chunks.push("trailer\n<< /Size " + (objs.length + 1) + " /Root " +
                catalogId + " 0 R >>\nstartxref\n" + len + "\n%%EOF\n");

    var s = chunks.join("");
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c > 0xff) {
        throw new Error("non-latin1 byte reached the PDF buffer at " + i +
                        " - every xref offset after it would be wrong");
      }
      out[i] = c;
    }
    return out;
  };

  return {
    doc: function (w, h) { return new Doc(w, h); },
    stringWidth: stringWidth,
    escapeText: escapeText,
    num: num
  };
}());
