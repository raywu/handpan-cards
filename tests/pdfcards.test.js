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

// A real generated deck, adapted the way the app adapts it.
function fixture() {
  const E = loadEngine(["core", "voicing", "layout", "naming", "select"]);
  const parsed = E.core.parseSeed("(D3) A3 C4 D4 E4 F4 G4 A4 C5", {});
  assert.ok(parsed.ok, "the fixture seed must parse");
  const built = E.select.build(parsed.value);
  assert.ok(built.ok, "the fixture seed must build");
  return HPE.pdfdeck.fromGenerated({
    seed: E.core.formatSeed(parsed.value), deck: built.value });
}
