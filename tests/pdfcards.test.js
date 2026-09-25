"use strict";
// The two ways a hand port of tools/hifi.py goes wrong quietly, plus the one
// geometry question `paper` introduces.
const test = require("node:test");
const assert = require("node:assert");
const { loadEngine } = require("./helpers/engine.js");

const HPE = loadEngine(["fontdata", "pdf", "pdfdeck", "pdfcards"]);
const P = HPE.pdfcards;

// A page that records what it was asked to draw instead of writing bytes, so
// a test can read the drawing rather than the PDF.
function recorder() {
  const ops = [];
  const noop = () => {};
  return {
    ops: ops,
    text: (x, y, s, face, size) => ops.push({ op: "text", x, y, s, face, size }),
    line: (x1, y1, x2, y2) => ops.push({ op: "line", x1, y1, x2, y2 }),
    circle: (x, y, r, m) => ops.push({ op: "circle", x, y, r, m }),
    roundRect: (x, y, w, h, r, m) => ops.push({ op: "rrect", x, y, w, h, r, m }),
    rect: noop, setFill: noop, setStroke: noop, setLineWidth: noop,
    setDash: noop, save: noop, restore: noop, translate: noop, rotate: noop,
  };
}

test("tracking advances per character, not once for the whole run", () => {
  // hifi.tracked draws one glyph at a time and adds `track` after each. A
  // port that lays the run out in one call and pads the total by
  // track * (n - 1) puts the same run in the same place but every interior
  // glyph somewhere else, and the difference only shows on a pair the face
  // would kern. So: check the per-glyph x, not the run width.
  const page = recorder();
  const c = new P._internal.Canvas(page);
  P._internal.tracked(c, 100, 50, "AVA", "Display", 20, 3.0, "l", null);
  const xs = page.ops.filter((o) => o.op === "text").map((o) => o.x);
  assert.equal(xs.length, 3, "one draw call per character");
  const wA = HPE.pdf.stringWidth("A", "Display", 20);
  const wV = HPE.pdf.stringWidth("V", "Display", 20);
  assert.ok(Math.abs(xs[0] - 100) < 1e-9);
  assert.ok(Math.abs(xs[1] - (100 + wA + 3.0)) < 1e-9);
  assert.ok(Math.abs(xs[2] - (100 + wA + 3.0 + wV + 3.0)) < 1e-9);
});

test("tw pads a run by track * (n - 1), matching hifi.tw", () => {
  const w = HPE.pdf.stringWidth("ABCD", "Label", 10);
  assert.ok(Math.abs(P._internal.tw("ABCD", "Label", 10, 0.5) - (w + 1.5)) < 1e-9);
  assert.ok(Math.abs(P._internal.tw("", "Label", 10, 0.5) - 0) < 1e-9);
  assert.ok(Math.abs(P._internal.tw("A", "Label", 10, 0.5)
                     - HPE.pdf.stringWidth("A", "Label", 10)) < 1e-9);
});

test("fit steps down by 0.25 and stops at the 3.6 pt floor", () => {
  // The floor is the whole point: no floor in the pipeline protects a
  // diagram label, so a port that shrinks to zero draws invisible copy.
  const s = P._internal.fit("a very long subtitle indeed", "LabelSB", 4.2, 1.0,
                            0.55);
  // the loop tests BEFORE it steps, so it lands on the first size at or under
  // the floor, never below the floor by a whole step
  assert.ok(s <= 3.6 && s > 3.6 - 0.25, "landed at " + s);
  assert.equal(P._internal.fit("x", "Label", 8, 1000), 8);
});

test("fit_note steps by 0.1 and floors at 2.5", () => {
  const f = P._internal.fitNote("Ab", 3, "Label", 6.0, 0.5);
  assert.ok(f <= 2.5 && f > 2.5 - 0.1, "landed at " + f);
  assert.equal(P._internal.fitNote("A", 3, "Label", 6.0, 1000), 6.0);
});

test("the label rule is r x ratio per zone, and the number takes no 1.05", () => {
  assert.ok(Math.abs(P._internal.labelSize(10, "ding") - 7.0875) < 1e-9);
  assert.ok(Math.abs(P._internal.labelSize(10, "rim") - 8.0325) < 1e-9);
  assert.ok(Math.abs(P._internal.labelSize(10, "inner") - 8.0325) < 1e-9);
  assert.ok(Math.abs(P._internal.labelSize(10, "bottom") - 8.232) < 1e-9);
  assert.ok(Math.abs(P._internal.numSize(10) - 6.4) < 1e-9);
});

test("slots are 3x3, centred, and the card and gutters never move", () => {
  const s = P.slots("letter");
  assert.equal(s.length, 9);
  const g = P.GEOM;
  const tw_ = 3 * g.CW + 2 * g.GX, th_ = 3 * g.CH + 2 * g.GY;
  assert.ok(Math.abs(s[0][0] - (612 - tw_) / 2) < 1e-9);
  assert.ok(Math.abs(s[0][1] - ((792 - th_) / 2 + th_ - g.CH)) < 1e-9);
  // row-major: slot 1 is one card + gutter to the right of slot 0
  assert.ok(Math.abs(s[1][0] - (s[0][0] + g.CW + g.GX)) < 1e-9);
  assert.ok(Math.abs(s[1][1] - s[0][1]) < 1e-9);
  // slot 3 is one row down
  assert.ok(Math.abs(s[3][1] - (s[0][1] - g.CH - g.GY)) < 1e-9);
});

test("A4 is Letter shifted, not Letter rescaled", () => {
  // The card is a measured figure. Changing paper may only re-centre the
  // grid; a port that scales the grid to the page silently reprints the deck
  // at the wrong size, which no on-screen check would catch.
  const dx = (595.28 - 612) / 2, dy = (841.89 - 792) / 2;
  const L = P.slots("letter"), A = P.slots("a4");
  assert.equal(A.length, L.length);
  for (let i = 0; i < L.length; i++) {
    assert.ok(Math.abs(A[i][0] - (L[i][0] + dx)) < 1e-9, "x " + i);
    assert.ok(Math.abs(A[i][1] - (L[i][1] + dy)) < 1e-9, "y " + i);
  }
});

test("an unknown paper falls back to Letter rather than throwing", () => {
  assert.deepStrictEqual(P.slots("tabloid"), P.slots("letter"));
});

test("the shop variant is chord cards only, padded to whole pages", () => {
  const deck = fixture();
  const full = pages(P.build(deck, { variant: "full" }));
  const shop = pages(P.build(deck, { variant: "shop" }));
  // full adds a title and a legend card ahead of the chords
  assert.ok(full >= 1 && shop >= 1);
  assert.equal(shop, Math.ceil(deck.chords.length / 9));
  assert.equal(full, Math.ceil((deck.chords.length + 2) / 9));
});

test("build writes a Letter box for letter and an A4 box for a4", () => {
  const deck = fixture();
  const letter = latin1(P.build(deck, { paper: "letter" }));
  const a4 = latin1(P.build(deck, { paper: "a4" }));
  assert.ok(/\/MediaBox \[0 0 612 792\]/.test(letter));
  assert.ok(/\/MediaBox \[0 0 595\.28 841\.89\]/.test(a4));
});

function latin1(bytes) { return Buffer.from(bytes).toString("latin1"); }
function pages(bytes) {
  return (latin1(bytes).match(/\/Type \/Page[^s]/g) || []).length;
}

// A real generated deck, adapted the way the app adapts it. `seed` defaults
// to D Amara's maker string; Q13/Q20 need a different pan (one with no
// thirds, one with a mixed root/tone voicing) so it takes an override.
function fixture(seed) {
  const E = loadEngine(["core", "voicing", "layout", "naming", "select"]);
  const parsed = E.core.parseSeed(seed || "(D3) A3 C4 D4 E4 F4 G4 A4 C5", {});
  assert.ok(parsed.ok, "the fixture seed must parse");
  const built = E.select.build(parsed.value);
  assert.ok(built.ok, "the fixture seed must build");
  return HPE.pdfdeck.fromGenerated({
    seed: E.core.formatSeed(parsed.value), deck: built.value });
}

// The PDF content stream draws every glyph as its own "(x) Tj" operator
// (hifi's `tracked` walks a string one character at a time so per-glyph
// tracking can be added between them - see the test above), preceded by
// whichever "r g b rg" last set the fill. Replaying the stream in order and
// pairing each glyph with the colour active when it was drawn lets a test
// read what colour a given run of text was actually drawn in, the same way
// a PDF viewer would.
function pdfGlyphs(bytes) {
  const text = latin1(bytes);
  const re = /([\d.]+) ([\d.]+) ([\d.]+) rg|\(((?:\\.|[^()\\])*)\)\s*Tj/g;
  var m, fill = null;
  const glyphs = [];
  while ((m = re.exec(text))) {
    if (m[4] !== undefined) glyphs.push({ ch: m[4], col: fill });
    else fill = [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  return glyphs;
}

// Every place `needle` occurs in the glyph stream's text, in order, as the
// colour of its first character. Occurrences may be drawn one glyph call per
// character, so this reconstructs the joined string before searching.
function coloursOf(glyphs, needle) {
  const joined = glyphs.map((g) => g.ch).join("");
  const hits = [];
  var from = 0;
  for (;;) {
    const idx = joined.indexOf(needle, from);
    if (idx < 0) break;
    var pos = 0, at = -1;
    for (var i = 0; i < glyphs.length; i++) {
      if (pos === idx) { at = i; break; }
      pos += glyphs[i].ch.length;
    }
    assert.ok(at >= 0, "glyph boundary for " + JSON.stringify(needle));
    hits.push(glyphs[at].col);
    from = idx + needle.length;
  }
  return hits;
}

// Every place a whole run of TOKENS (each one a full "(x) Tj" call, not a
// single character - the number line and the note-line octave both draw
// whole strings per call, per noteText/bottomLines) matches `tokens` exactly
// and contiguously. Unlike coloursOf, this cannot straddle a glyph boundary
// and cannot be fooled by a shorter label (e.g. a lone octave digit "5")
// that also appears, in a different colour, on the note-name line right
// before the number line it belongs to.
function findTokenRun(glyphs, tokens) {
  const out = [];
  for (var i = 0; i + tokens.length <= glyphs.length; i++) {
    var ok = true;
    for (var j = 0; j < tokens.length; j++) {
      if (glyphs[i + j].ch !== tokens[j]) { ok = false; break; }
    }
    if (ok) out.push(glyphs.slice(i, i + tokens.length));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Q13: pdfcards.js:429-432 (cardWarnings) and :470-475 (the badge draw)
 * ------------------------------------------------------------------ */
test("a no-thirds pan draws the NO 3RDS warning badge, in orange, on every chord card", () => {
  // (C3) G3 D4 G4 D5 has no thirds anywhere on the pan: every chord is a
  // power chord or a sus chord, and the engine attaches a NO_THIRDS warning.
  const deck = fixture("(C3) G3 D4 G4 D5");
  assert.deepEqual(deck.warnings.map((w) => w.code), ["NO_THIRDS"],
    "fixture assumption: the seed must actually be warned");
  assert.ok(deck.chords.length >= 1, "fixture assumption: it must ship chords");

  const glyphs = pdfGlyphs(P.build(deck, { variant: "shop" }));
  const badges = coloursOf(glyphs, P.CARD_WARNINGS.NO_THIRDS);
  assert.equal(badges.length, deck.chords.length,
    "one NO 3RDS badge per chord card - PRINTER_ONLY has no title card, so " +
    "this is the only place the warning can survive");
  // hifi's ORANGE (src/engine/pdfcards.js:34), the fixed accent used for
  // every warning and bottom-note badge - not a deck colour.
  const ORANGE = [0.8863, 0.4392, 0.0196];
  badges.forEach((col, i) => assert.deepEqual(col, ORANGE, "badge " + i));
});

/* ------------------------------------------------------------------ *
 * Q20: pdfcards.js:274, the number-line fill per note
 * ------------------------------------------------------------------ */
test("the number line colours each digit label root or tone, per note - not one flat colour", () => {
  const deck = fixture();
  // A chord whose voicing mixes root and non-root fields, so the two colours
  // both appear on one number line.
  const chord = deck.chords.find((c) => c[4].length < c[3].length);
  assert.ok(chord, "fixture assumption: some chord must have non-root tones");
  const [, , , fields, roots] = chord;
  assert.ok(fields.some((f) => roots.indexOf(f) >= 0) &&
             fields.some((f) => roots.indexOf(f) < 0),
    "fixture assumption: the chosen chord must mix root and tone fields");

  // The exact token run bottomLines draws for this chord's number line:
  // label, " - ", label, " - ", label, ... (pdfcards.js:265-282). Matching
  // this whole run - not a single label in isolation - is what tells it
  // apart from the SAME digit appearing, in a different colour, as an
  // octave on the note-name line just above it.
  const labels = fields.map((f) => deck.spec[f][5]);
  const run = [];
  labels.forEach((lab, i) => {
    run.push(lab);
    if (i < labels.length - 1) run.push(" - ");
  });

  const glyphs = pdfGlyphs(P.build(deck, { variant: "shop" }));
  const matches = findTokenRun(glyphs, run);
  assert.ok(matches.length >= 1,
    "the number line's exact token run " + JSON.stringify(run) +
    " must appear in the PDF");

  // Every drawn digit in that run must carry root or tone colour, per note -
  // never the same colour twice over across a root and a non-root field.
  const close = (a, b) => Math.abs(a - b) < 1e-4;
  const sameColour = (c, e) => close(c[0], e[0]) && close(c[1], e[1]) &&
                                close(c[2], e[2]);
  matches.forEach((seq) => {
    fields.forEach((f, i) => {
      const tok = seq[i * 2]; // labels sit at even indices, " - " at odd
      const expected = roots.indexOf(f) >= 0 ? deck.col_root : deck.col_tone;
      assert.ok(sameColour(tok.col, expected),
        "number label " + JSON.stringify(tok.ch) + " (field " + f + ") " +
        "drew " + JSON.stringify(tok.col) + ", expected " +
        (roots.indexOf(f) >= 0 ? "root " : "tone ") +
        JSON.stringify(expected));
    });
  });
});

/* ------------------------------------------------------------------ *
 * Q3: pdfdeck.js branches unreached by any node-unit or Python-spawned test
 * ------------------------------------------------------------------ */
test("legendDemo on a chordless pan picks the highest and lowest field, not a chord tone", () => {
  // pdfdeck.js:132-141. With no chords, legendDemo can't read a root/other
  // pair off chords[0] (:135-137) and falls back to the field range
  // (:139-140). A mis-mapping here (e.g. reusing the chord branch's
  // [other, root] order, or picking [ids[0], ids[last]]) would demo the
  // wrong pair of fields on a pan with nothing to demo a chord with.
  const E = loadEngine(["core", "voicing", "layout", "naming", "select"]);
  const parsed = E.core.parseSeed("(C3) G3", {});
  assert.ok(parsed.ok, "fixture seed must parse");
  const built = E.select.build(parsed.value);
  assert.ok(built.ok, "fixture seed must build");
  assert.equal(built.value.chords.length, 0,
    "fixture assumption: this pan ships no chords");
  const deck = HPE.pdfdeck.fromGenerated({
    seed: E.core.formatSeed(parsed.value), deck: built.value });
  // ding is field 0, the only other field is 1 - highest first, lowest last.
  assert.deepEqual(deck.legend_demo, [1, 0]);
});

test("fromGenerated throws when geom.ext is missing, rather than silently defaulting R", () => {
  // pdfdeck.js:160-162. A renamed or dropped `ext` used to fall back to 1.0
  // (comment at :156-159), which silently gives every deck R = 74.0 - on a
  // bottom-shell pan that draws the diagram off both edges of the card with
  // no visible error. A mis-mapping that resurrects a fallback instead of
  // this throw is exactly the regression the comment describes.
  const E = loadEngine(["core", "voicing", "layout", "naming", "select"]);
  const p = E.core.parseSeed("(D3) A3 C4 D4 E4 F4 G4 A4 C5", {});
  const built = E.select.build(p.value);
  const value = JSON.parse(JSON.stringify(built.value));
  assert.ok("ext" in value.geom, "fixture assumption: ext is normally present");
  delete value.geom.ext;
  assert.throws(
    () => HPE.pdfdeck.fromGenerated({ seed: "x", deck: value }),
    /geom\.ext/,
    "fromGenerated must throw, not fall back to a default R");
});
