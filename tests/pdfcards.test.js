"use strict";
// The two ways a hand port of tools/hifi.py goes wrong quietly, plus the one
// geometry question `paper` introduces.
const test = require("node:test");
const assert = require("node:assert");
const { loadEngine } = require("./helpers/engine.js");

const HPE = loadEngine(["core", "fontdata", "pdf", "pdfdeck", "pdfcards"]);
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
  const parsed = E.core.parseLegacySeed(seed || "(D3) A3 C4 D4 E4 F4 G4 A4 C5", {});
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
    "one NO 3RDS badge per chord card - CHORD_ONLY has no title card, so " +
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
  const parsed = E.core.parseLegacySeed("(C3) G3", {});
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
  const p = E.core.parseLegacySeed("(D3) A3 C4 D4 E4 F4 G4 A4 C5", {});
  const built = E.select.build(p.value);
  const value = JSON.parse(JSON.stringify(built.value));
  assert.ok("ext" in value.geom, "fixture assumption: ext is normally present");
  delete value.geom.ext;
  assert.throws(
    () => HPE.pdfdeck.fromGenerated({ seed: "x", deck: value }),
    /geom\.ext/,
    "fromGenerated must throw, not fall back to a default R");
});

test("ET-2 hexColor/bankers", () => {
  const { bankers, hexColor } = HPE.pdfdeck;
  assert.strictEqual(bankers(1.05, 1), 1.1, "the double nearest 1.05 is above the tie");
  assert.strictEqual(bankers(0.25, 1), 0.2, "exact tie rounds to the even digit");
  assert.strictEqual(bankers(0.35, 1), 0.3, "the double nearest 0.35 is below the tie");
  assert.strictEqual(bankers(2.5, 0), 2);
  assert.strictEqual(bankers(3.5, 0), 4);
  assert.strictEqual(bankers(-2.5, 0), -2);
  assert.strictEqual(bankers(0.125, 2), 0.12);
  assert.deepEqual(JSON.parse(JSON.stringify(hexColor("#ff8000"))), [1, 128 / 255, 0]);
  assert.deepEqual(JSON.parse(JSON.stringify(hexColor("0B7B75"))), [11 / 255, 123 / 255, 117 / 255],
    "the leading # is optional");
  assert.throws(() => hexColor("#fff"), /not a #RRGGBB colour/);
});

/* ------------------------------------------------------------- EG-2 */

test("EG-2 pdfcards takes pc/isDing from core at use time", () => {
  const E = loadEngine(["core", "fontdata", "pdf", "pdfdeck", "pdfcards"]);
  let pcCalls = 0;
  let dingCalls = 0;
  const realPc = E.core.pc;
  const realDing = E.core.isDing;
  E.core.pc = (n) => { pcCalls += 1; return realPc(n); };
  E.core.isDing = (rec) => { dingCalls += 1; return realDing(rec); };

  const deck = fixture();
  const bytes = Buffer.from(E.pdfcards.build(deck, { variant: "shop" })).toString("latin1");
  assert.ok(pcCalls > 0, "pdfcards never reached core.pc");
  assert.ok(dingCalls > 0, "pdfcards never reached core.isDing");

  const late = loadEngine(["fontdata", "pdf", "pdfdeck", "pdfcards", "core"]); // EG-2: index.html order
  const lateBytes = Buffer.from(late.pdfcards.build(deck, { variant: "shop" })).toString("latin1");
  assert.equal(lateBytes, bytes,
    "core must be read when a card draws, not when pdfcards loads");
});

test("fromGenerated prints the short line for SMALL_LABELS and the capitalised reason for NO_THIRDS", () => {
  const E = loadEngine(["core", "voicing", "layout", "naming", "select"]);
  function deckWith(warnings) {
    const parsed = E.core.parseLegacySeed("(D3) A3 C4 D4 E4 F4 G4 A4 C5", {});
    const built = E.select.build(parsed.value);
    const value = Object.assign({}, built.value, { warnings: warnings });
    return HPE.pdfdeck.fromGenerated({ seed: E.core.formatSeed(parsed.value), deck: value });
  }
  const crowded = deckWith([{ code: "SMALL_LABELS", reason: E.core.REASONS.SMALL_LABELS.reason.replace("<N>", "3.4") }]);
  assert.equal(crowded.blurb.filter((l) => l === "CROWDED PAN: SMALL LABELS").length, 1);
  assert.ok(!crowded.blurb.some((l) => /3\.6 PT/.test(l)));
  const reason = E.core.REASONS.NO_THIRDS.reason;
  const quiet = deckWith([{ code: "NO_THIRDS", reason: reason }]);
  assert.ok(quiet.blurb.includes(reason.toUpperCase()));
});

/* ------------------------------------------------------------------ *
 * Lane P1: the title-card blurb wraps and shrinks to fit (hifi.blurb_layout)
 * ------------------------------------------------------------------ */
const DECK_DATA = JSON.parse(require("node:fs").readFileSync(
  require("node:path").join(__dirname, "..", "data", "decks.json"), "utf8"));
const CROWDED_NO_THIRDS = "[C2] [D2] [G2] (C3) D3 G3 C4 D4 G4 C5 D5 G5 C6 D6 G6 C7 D7 G7 C8 D8 G8 C9 D9";

test("a crowded note line wraps inside the card, and a six-line blurb shrinks to fit without dropping a line", () => {
  const E = loadEngine(["core", "voicing", "layout", "naming", "select"]);
  const parsed = E.core.parseSeed(CROWDED_NO_THIRDS);
  assert.equal(parsed.ok, true, parsed.reason);
  const built = E.select.build(parsed.value);
  assert.deepEqual(built.value.warnings.map((w) => w.code), ["NO_THIRDS", "SMALL_LABELS"]);
  const deck = HPE.pdfdeck.fromGenerated({ seed: E.core.formatSeed(parsed.value), deck: built.value });
  const { rows, size, step } = P._internal.blurbLayout(deck.blurb);
  const CW = P.GEOM.CW;
  assert.equal(rows.length, 6, "two note lines, bottom, count and two warnings");
  rows.forEach((r) => assert.ok(P._internal.tw(r.text, "Label", size, 0.35) <= CW - 24, r.text));
  assert.ok(size >= 3.6, "no line under 3.6 pt, got " + size);
  assert.ok(step >= 1.2 * size, "lines do not touch");
  assert.ok(26 - (rows.length - 1) * step >= 2 - 1e-9, "the last baseline stays inside the card");
  const words = (list) => list.join(" ").split(/\s+/).filter(Boolean);
  assert.deepEqual(words(rows.map((r) => r.text)), words(deck.blurb), "nothing is dropped or reordered");
});

test("the blurb limit: six rows end inside the frame, seven sit on it, eight leave the card, none dropped or under 3.6 pt", () => {
  const lay = (n) => {
    const lines = Array.from({ length: n }, (_, i) => "ROW " + i);
    const { rows, size, step } = P._internal.blurbLayout(lines);
    assert.deepEqual(rows.map((r) => r.text), lines, "no row dropped");
    assert.ok(size >= 3.6 - 1e-9, "no row under 3.6 pt, got " + size);
    return 26 - (rows.length - 1) * step;
  };
  assert.ok(lay(6) >= 2 - 1e-9, "six rows end inside the frame");
  const seven = lay(7);
  assert.ok(seven < 2 && seven >= 0, "seven rows sit on the frame, got " + seven);
  assert.ok(lay(8) < 0, "eight rows leave the card");
});

test("the built-in title cards keep the 4.2 pt, 8 pt-step blurb they always had", () => {
  for (const id of ["hijaz", "pygmy", "amara", "kurd", "amara10"]) {
    const canonical = DECK_DATA.find((d) => d.id === id);
    const deck = HPE.pdfdeck.fromBuiltin(canonical, canonical.print);
    const { rows, size, step } = P._internal.blurbLayout(deck.blurb);
    assert.deepEqual(rows.map((r) => r.text), deck.blurb, id);
    assert.equal(size, 4.2, id);
    assert.equal(step, 8, id);
  }
});

test("rule N: the browser PDF prints the seat number on the diagram and the number line", () => {
  const E = loadEngine(["core", "voicing", "layout", "naming", "select"]);
  const text = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
  const parsed = E.core.parseLegacySeed(text, {});
  const built = E.select.build(parsed.value);
  assert.ok(built.ok);
  const moved = E.layout.solve(E.core.parseLegacySeed(text, {}).value, { seats: { rim: [1, 0, 2, 3, 4, 5, 6, 7] } });
  assert.ok(moved.ok);
  for (const id of Object.keys(moved.value.fields)) {
    built.value.fields[id][4] = moved.value.fields[id][4];
    built.value.fields[id][5] = moved.value.fields[id][5];
  }
  const deck = HPE.pdfdeck.fromGenerated({ seed: E.core.formatSeed(parsed.value), deck: built.value });
  assert.strictEqual(deck.spec["1"][5], "2", "A3 now sits in seat 2");
  assert.strictEqual(deck.spec["2"][5], "1", "C4 now sits in seat 1");
  const chord = deck.chords.find((c) => c[3].map(String).indexOf("1") >= 0 && c[3].map(String).indexOf("2") >= 0);
  assert.ok(chord, "fixture assumption: a chord that voices both swapped notes");
  const want = chord[3].map(String).map((f) => (f === "1" ? "2" : f === "2" ? "1" : deck.spec[f][5]));
  const run = [];
  want.forEach((lab, i) => { run.push(lab); if (i < want.length - 1) run.push(" - "); });
  const glyphs = pdfGlyphs(P.build(deck, { variant: "shop" }));
  assert.ok(findTokenRun(glyphs, run).length >= 1,
    "the number line's token run " + JSON.stringify(run) + " is not in the PDF");
  const plain = HPE.pdfdeck.fromGenerated({ seed: E.core.formatSeed(parsed.value), deck: E.select.build(parsed.value).value });
  assert.notStrictEqual(latin1(P.build(deck, { variant: "shop" })), latin1(P.build(plain, { variant: "shop" })),
    "a moved deck printed the same bytes as the unmoved one, so the diagram numbers did not follow the seats");
});

test("OF: the browser PDF and the app print the same number line 2-1-4 on the Am card of (D3) C4 A3 D4 E4 F4 G4 A4 C5", async () => {
  const { boot } = require("./helpers/sandbox.js");
  const E = loadEngine(["core", "voicing", "layout", "naming", "select"]);
  const typed = "(D3) C4 A3 D4 E4 F4 G4 A4 C5";
  const value = E.core.parseSeed(typed).value;
  const seats = JSON.parse(JSON.stringify(E.core.typedSeats(value)));
  assert.deepEqual(seats, { rim: [1, 0, 2, 3, 4, 5, 6, 7] });
  const built = E.select.build(value);
  assert.ok(built.ok);
  const moved = E.layout.solve(value, { seats });
  assert.ok(moved.ok);
  for (const id of Object.keys(moved.value.fields)) {
    built.value.fields[id][4] = moved.value.fields[id][4];
    built.value.fields[id][5] = moved.value.fields[id][5];
  }
  const deck = HPE.pdfdeck.fromGenerated({ seed: E.core.formatSeed(value), deck: built.value });
  const am = deck.chords.find((c) => c[0] === "Am");
  assert.ok(am, "an Am card");
  const pdfLabels = am[3].map((f) => String(deck.spec[String(f)][5]));
  assert.deepEqual(pdfLabels, ["2", "1", "4"]);
  const run = [];
  pdfLabels.forEach((lab, i) => { run.push(lab); if (i < pdfLabels.length - 1) run.push(" - "); });
  assert.ok(findTokenRun(pdfGlyphs(P.build(deck, { variant: "shop" })), run).length >= 1, "the PDF number line is 2-1-4");

  const app = boot({ crypto: require("node:crypto").webcrypto, abortController: true });
  await app.getAsync("savedReady");
  const made = await app.generateAsync("(D3) A3 C4 D4 E4 F4 G4 A4 C5", { seats });
  assert.strictEqual(made.ok, true, made.reason);
  assert.strictEqual(typeof made.instanceId, "string", "generation acknowledges a stable saved instance");
  const expr = `savedEntries.get(${JSON.stringify(made.instanceId)}).deck`;
  assert.strictEqual(app.get(`savedEntries.has(${JSON.stringify(made.instanceId)})`), true,
    "the number line is read from the acknowledged saved instance");
  const reg = JSON.parse(JSON.stringify(app.get(expr)));
  const idx = reg.chords.findIndex((ch) => ch.main === "Am");
  assert.ok(idx >= 0, "an Am card in the app");
  const line = app.get(`linesHTML(${expr}, ${expr}.chords[${idx}])`);
  const numline = /<div class="numline">([\s\S]*)<\/div><\/div>/.exec(line)[1];
  const got = [...numline.matchAll(/>(\d+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(got, pdfLabels);
});

/* ------------------------------------------------------------------ *
 * Lane E (refactor pass 4): the paths only index.html reached before
 * ------------------------------------------------------------------ */
const ORANGE_RGB = [0.8863, 0.4392, 0.0196];

// "r g b rg" fills and "BT /Fn size Tf ... (s) Tj ET" runs, in order, so a
// test can read the size and colour each run was actually drawn with.
function textRuns(bytes) {
  const text = latin1(bytes);
  const re = /([\d.]+) ([\d.]+) ([\d.]+) rg|\/F\d+ ([\d.]+) Tf [^\n]*?\(((?:\\.|[^()\\])*)\) Tj/g;
  var m, fill = null;
  const runs = [];
  while ((m = re.exec(text))) {
    if (m[5] !== undefined) runs.push({ s: m[5], size: Number(m[4]), col: fill });
    else fill = [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  return runs;
}

function dashCount(bytes, on) {
  return (latin1(bytes).match(new RegExp("\\[" + on + " " + on + "\\] 0 d", "g")) || []).length;
}

function sameRgb(a, b) {
  return a.every((v, i) => Math.abs(v - b[i]) < 1e-4);
}

function pygmyDeck() {
  const canonical = DECK_DATA.find((d) => d.id === "pygmy");
  return HPE.pdfdeck.fromBuiltin(canonical, canonical.print);
}

// One card on one sheet: the Pygmy deck cut down to the named chord.
function pygmyCard(main, fields) {
  const deck = pygmyDeck();
  const chord = deck.chords.find((c) => c[0] + c[1] === main && String(c[3]) === String(fields));
  assert.ok(chord, "fixture assumption: Pygmy ships " + main + " " + fields);
  return { deck: deck, chord: chord,
           bytes: P.build(Object.assign({}, deck, { chords: [chord] }), { variant: "shop" }) };
}

test("Canvas.setDash: one argument is both dash and gap, two are dash and gap, none clears", () => {
  const calls = [];
  const page = { setDash: (...a) => calls.push(a) };
  const c = new P._internal.Canvas(page);
  c.setDash(2.2);
  c.setDash(1.6, 0.4);
  c.setDash();
  assert.deepEqual(calls, [[2.2, 2.2], [1.6, 0.4], [0]]);
});

test("a bottom-shell pan draws the dashed bottom orbit once and one dashed ring per unlit bottom field", () => {
  const { deck, chord, bytes } = pygmyCard("Cm7", [101, 103, 1, 104]);
  const pcs = chord[3].map((f) => HPE.core.pc(deck.spec[f][2]));
  const unlit = Object.keys(deck.spec).filter((k) => k !== "_geom" &&
    deck.spec[k][3] === "bottom" && pcs.indexOf(HPE.core.pc(deck.spec[k][2])) < 0);
  assert.ok(unlit.length >= 1 && unlit.length < 6, "fixture assumption: some bottom fields stay unlit");
  assert.equal(dashCount(bytes, "2.2"), 1, "the bottom orbit");
  assert.equal(dashCount(bytes, "1.6"), unlit.length, "off-bottom rings");
  const plain = P.build(Object.assign({}, fixture(), { chords: [fixture().chords[0]] }), { variant: "shop" });
  assert.equal(dashCount(plain, "2.2") + dashCount(plain, "1.6"), 0, "a pan with no bottom shell draws neither");
});

test("bottom-shell index numbers print in the orange accent", () => {
  const { deck, chord, bytes } = pygmyCard("Cm7", [101, 103, 1, 104]);
  const pcs = chord[3].map((f) => HPE.core.pc(deck.spec[f][2]));
  const unlit = Object.keys(deck.spec).filter((k) => k !== "_geom" &&
    deck.spec[k][3] === "bottom" && pcs.indexOf(HPE.core.pc(deck.spec[k][2])) < 0);
  const runs = textRuns(bytes);
  unlit.forEach((k) => {
    const hits = runs.filter((r) => r.s === deck.spec[k][5]);
    assert.equal(hits.length, 1, "field " + k + " is on the diagram only: " + deck.spec[k][5]);
    assert.ok(sameRgb(hits[0].col, ORANGE_RGB), "field " + k + " number is not orange");
  });
  const rim = runs.filter((r) => r.s === deck.spec["5"][5]);
  assert.ok(rim.length >= 1 && rim.every((r) => !sameRgb(r.col, ORANGE_RGB)), "a rim number is not orange");
});

test("a card voicing bottom-shell fields says how many, in orange, singular for one", () => {
  const one = pygmyCard("Cm7", [3, 4, 6, 104]);
  const two = pygmyCard("Eb7", [4, 6, 104, 105]);
  const none = pygmyCard("Ab", [7, 8, 9]);
  const joined = (bytes) => pdfGlyphs(bytes).map((g) => g.ch).join("");
  assert.ok(joined(one.bytes).includes("1 BOTTOM NOTE"));
  assert.ok(!joined(one.bytes).includes("BOTTOM NOTES"), "one field reads singular");
  assert.ok(joined(two.bytes).includes("2 BOTTOM NOTES"));
  [[one, "1 BOTTOM NOTE"], [two, "2 BOTTOM NOTES"]].forEach(([card, text]) => {
    const cols = coloursOf(pdfGlyphs(card.bytes), text);
    assert.equal(cols.length, 1, text);
    assert.ok(sameRgb(cols[0], ORANGE_RGB), text + " is not orange");
  });
  assert.ok(!/BOTTOM NOTE/.test(joined(none.bytes)), "Ab voices the top shell only");
});

// Runs of one recorded card: glyphs regrouped by baseline, face and size,
// with the left and right ink edge. The rotated credit is drawn at local y 0
// (the recorder ignores translate/rotate), so y 0 is dropped.
function cardRuns(deck, chord) {
  const page = recorder();
  P._internal.chordCard(new P._internal.Canvas(page), 0, 0, deck, 1, chord);
  const out = {};
  page.ops.filter((o) => o.op === "text" && o.y !== 0).forEach((o) => {
    const k = o.y.toFixed(3) + "|" + o.face + "|" + o.size;
    const w = HPE.pdf.stringWidth(o.s, o.face, o.size);
    const r = out[k] || (out[k] = { y: o.y, face: o.face, size: o.size,
                                    left: o.x, right: o.x, s: "" });
    r.left = Math.min(r.left, o.x);
    r.right = Math.max(r.right, o.x + w);
    r.s += o.s;
  });
  return Object.values(out);
}
const runAt = (runs, y, face) =>
  runs.filter((r) => Math.abs(r.y - y) < 1e-6 && r.face === face);

test("P4 the E3 header: degree top-left, subtitle centred above the name, footer deck name then #n", () => {
  const { deck, chord } = pygmyCard("Cm7", [3, 4, 6, 104]);
  assert.ok(chord[2], "fixture assumption: Cm7 carries a subtitle");
  const CH = P.GEOM.CH, CW = P.GEOM.CW;
  const runs = cardRuns(deck, chord);
  const deg = runAt(runs, CH - 13.5, "LabelSB").filter((r) => r.size === 6.0);
  assert.equal(deg.length, 1, "the degree sits at y + CH - 13.5");
  assert.ok(Math.abs(deg[0].left - 9) < 1e-6);
  const sub = runAt(runs, CH - 11.5, "LabelSB");
  assert.equal(sub.length, 1, "the subtitle sits at y + CH - 11.5");
  assert.ok(Math.abs((sub[0].left + sub[0].right) / 2 - CW / 2) < 0.5, "centred");
  assert.ok(sub[0].left - deg[0].right >= 4, "4 pt between degree and subtitle");
  const foot = runAt(runs, 6.5, "Label");
  const name = foot.filter((r) => r.s === deck.name);
  const num = foot.filter((r) => r.s === "#1" && r.size === 4.4);
  assert.equal(name.length, 1, "deck name in the footer");
  assert.equal(num.length, 1, "#n in the footer at 4.4");
  assert.ok(Math.abs(name[0].left - 9) < 1e-6);
  assert.ok(Math.abs(num[0].left - (name[0].left +
    P._internal.tw(deck.name, "Label", name[0].size, 0.5) + 6)) < 1e-6, "#n 6 pt after the name");
  assert.equal(runAt(runs, 6.0, "LabelSB").length, 0, "no warning on a warned-free pan");
});

test("P2/D2 twin: a 40-character deck name on a no-thirds pan is clipped to ASCII dots, clear of #n, the right-aligned warning and the credit", () => {
  const base = fixture("(C3) G3 D4 G4 D5");
  assert.deepEqual(base.warnings.map((w) => w.code), ["NO_THIRDS"]);
  const long = "D CELTIC MINOR 10 WITH SIX BOTTOM NOTESS";
  assert.equal(long.length, 40);
  const deck = Object.assign({}, base, { name: long });
  const CW = P.GEOM.CW;
  const runs = cardRuns(deck, deck.chords[0]);
  const foot = runAt(runs, 6.5, "Label");
  const name = foot.filter((r) => r.size !== 4.4);
  const num = foot.filter((r) => r.s === "#1" && r.size === 4.4);
  assert.equal(name.length, 1);
  assert.equal(num.length, 1);
  assert.ok(name[0].s.endsWith("..."), "clipped with three ASCII periods: " + name[0].s);
  assert.ok(name[0].size >= 3.6 - 1e-9, "the 3.6 pt floor, got " + name[0].size);
  const warn = runAt(runs, 6.0, "LabelSB");
  assert.equal(warn.length, 1);
  assert.equal(warn[0].s, P.CARD_WARNINGS.NO_THIRDS);
  assert.ok(Math.abs(warn[0].right - (CW - 16)) < 1e-6, "right-aligned to x + CW - 16");
  assert.ok(num[0].left - name[0].right >= 4, "name ends 4 pt before #n");
  assert.ok(warn[0].left - num[0].right >= 4, "#n ends 4 pt before the warning");
  const creditLeft = CW - 6.0 - 3.5;
  assert.ok(creditLeft - warn[0].right >= 4, "warning clears the rotated credit");
  assert.ok(6.0 + 0.7 * 4.0 < 12, "warning cap top is below the credit's start");
});

test("a 40-character deck name that fits below 4.6 pt draws whole at its drawn tracking", () => {
  const { deck, chord } = pygmyCard("Cm7", [3, 4, 6, 104]);
  const name = "MOUNTAIN MAGIC WOMB HANDPAN MW MEMORY WA";
  assert.equal(name.length, 40);
  const foot = runAt(cardRuns(Object.assign({}, deck, { name: name }), chord), 6.5, "Label")
    .filter((r) => r.size !== 4.4);
  assert.equal(foot.length, 1);
  assert.equal(foot[0].s, name);
  assert.ok(foot[0].size < 4.6 && foot[0].size >= 3.6 - 1e-9, "got " + foot[0].size);
});

test("a deck name too long even at 3.6 pt is clipped at exactly 3.6 pt", () => {
  const base = fixture("(C3) G3 D4 G4 D5");
  const deck = Object.assign({}, base, { name: "D CELTIC MINOR 10 WITH SIX BOTTOM NOTESS" });
  const foot = runAt(cardRuns(deck, deck.chords[0]), 6.5, "Label").filter((r) => r.size !== 4.4);
  assert.equal(foot.length, 1);
  assert.ok(foot[0].s.endsWith("..."), foot[0].s);
  assert.equal(foot[0].size, 3.6);
});

test("fitClip agrees with hifi.fit_clip: the 40-character name at budget 140.92 is whole at 4.35, the size hifi.fit_clip returns", () => {
  const r = P._internal.fitClip("MOUNTAIN MAGIC WOMB HANDPAN MW MEMORY WA", "Label", 4.6, 140.92, 0.5);
  assert.equal(r.text, "MOUNTAIN MAGIC WOMB HANDPAN MW MEMORY WA");
  assert.equal(r.size, 4.35);
});

function pygmyWith(main, sup, fields) {
  const deck = pygmyDeck();
  const chord = [main, sup, "", fields, [fields[0]]];
  return { deck: deck, chord: chord,
           bytes: P.build(Object.assign({}, deck, { chords: [chord] }), { variant: "shop" }) };
}

test("a chord name too wide for the header steps down in 0.5 pt until name and superscript fit", () => {
  let shrunk = 0;
  for (let n = 4; n <= 12; n++) {
    const name = "Z".repeat(n);
    const { bytes } = pygmyWith(name, "maj7", [3, 4, 6]);
    const sizes = textRuns(bytes).filter((r) => r.s === "Z").map((r) => r.size);
    assert.equal(sizes.length, n, "one glyph per letter of the name");
    assert.ok(sizes.every((s) => s === sizes[0]), "one size for the whole name");
    const size = sizes[0];
    const fits = (sz) => P._internal.tw(name, "Display", sz, sz * 0.02) +
      P._internal.tw("maj7", "Display", sz * 0.52, 0) <= P.GEOM.CW * 0.80;
    assert.ok(fits(size), n + " letters fit at the size drawn, " + size);
    if (size < 27) {
      shrunk++;
      assert.ok(size > 8, n + " letters: not at the floor, got " + size);
      assert.ok(!fits(size + 0.5), n + " letters: one 0.5 pt step bigger would not fit");
      assert.equal((27 - size) % 0.5, 0, "the size sits on the 0.5 pt grid from 27");
    }
  }
  assert.ok(shrunk >= 3, "fixture assumption: several widths take the shrink loop, got " + shrunk);
});

test("a long note line and a long number line each step down in 0.25 pt to the widest size that fits", () => {
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 101, 102, 103, 104];
  const avail = P.GEOM.CW - 16;
  const sep = (sz) => HPE.pdf.stringWidth(" - ", "Notes", sz);
  let noteShrunk = 0, numShrunk = 0;
  for (let k = 6; k <= all.length; k++) {
    const ids = all.slice(0, k);
    const { deck, bytes } = pygmyWith("C", "", ids);
    const sepSizes = textRuns(bytes).filter((r) => r.s === " - ").map((r) => r.size);
    assert.equal(sepSizes.length, 2 * (k - 1), "a note line and a number line of separators");
    const noteSize = sepSizes[0], numSize = sepSizes[k - 1];
    const noteTotal = (sz) => ids.reduce((t, f) => t +
      HPE.pdf.stringWidth(deck.spec[f][0], "Notes", sz) +
      HPE.pdf.stringWidth(String(deck.spec[f][1]), "Notes", sz * 0.66), 0) + (k - 1) * sep(sz);
    const numTotal = (sz) => ids.reduce((t, f) => t +
      HPE.pdf.stringWidth(deck.spec[f][5], "Notes", sz), 0) + (k - 1) * sep(sz);
    if (noteSize < 11) {
      noteShrunk++;
      assert.ok(noteTotal(noteSize) <= avail || noteSize <= 4.4, k + " fields: note line fits, got " + noteSize);
      assert.ok(noteSize <= 4.4 || noteTotal(noteSize + 0.25) > avail, k + " fields: note line is the widest fit");
    }
    if (numSize < 11) {
      numShrunk++;
      assert.ok(numTotal(numSize) <= avail || numSize <= 4.2, k + " fields: number line fits, got " + numSize);
      assert.ok(numSize <= 4.2 || numTotal(numSize + 0.25) > avail, k + " fields: number line is the widest fit");
    }
  }
  assert.ok(noteShrunk >= 3 && numShrunk >= 3, "fixture assumption: several widths take each loop");
});

test("the label rule is public: HPE.pdfcards.labelRatio and labelSize match the internal figures", () => {
  assert.equal(typeof P.labelSize, "function");
  assert.equal(typeof P.labelRatio, "function");
  assert.equal(P.labelSize, P._internal.labelSize, "one function, two doors");
  ["ding", "rim", "inner", "bottom"].forEach((zone) => {
    assert.ok(Math.abs(P.labelSize(10, zone) - 10 * P.labelRatio(zone)) < 1e-12, zone);
  });
  assert.equal(P.labelRatio("ding"), 0.70875);
  assert.equal(P.labelRatio("rim"), 0.80325);
  assert.equal(P.labelRatio("bottom"), 0.8232);
});

test("a warning code that is an Object.prototype name is not a known code: pdfdeck prints its reason, pdfcards draws no badge", () => {
  const E = loadEngine(["core", "voicing", "layout", "naming", "select"]);
  const parsed = E.core.parseLegacySeed("(D3) A3 C4 D4 E4 F4 G4 A4 C5", {});
  const built = E.select.build(parsed.value);
  const value = Object.assign({}, built.value, { warnings: [{ code: "constructor", reason: "odd one" }] });
  const deck = HPE.pdfdeck.fromGenerated({ seed: E.core.formatSeed(parsed.value), deck: value });
  assert.ok(deck.blurb.includes("ODD ONE"), "the reason, upper-cased, as for any code without a short line");
  const glyphs = pdfGlyphs(P.build(deck, { variant: "shop" }));
  assert.ok(!glyphs.map((g) => g.ch).join("").includes("function"), "no inherited function reached the page");
  assert.equal(coloursOf(glyphs, P.CARD_WARNINGS.NO_THIRDS).length, 0);
});

test("a title card prints the BOTTOM row of the note blurb in orange, and the other rows in the separator grey", () => {
  const deck = pygmyDeck();
  const bytes = P.build(deck, { variant: "full" });
  const runs = textRuns(bytes);
  const bottomRow = deck.blurb.find((l) => l.indexOf("BOTTOM") === 0);
  assert.ok(bottomRow, "fixture assumption: Pygmy's blurb has a BOTTOM row");
  const SEPRGB = [0.451, 0.451, 0.451];
  const rowRuns = (text) => {
    const tokens = text.split("");
    const out = [];
    for (var i = 0; i + tokens.length <= runs.length; i++) {
      if (tokens.every((t, j) => runs[i + j].s === t)) out.push(runs[i]);
    }
    return out;
  };
  const b = rowRuns(bottomRow);
  assert.ok(b.length >= 1, "the BOTTOM row is on the title card");
  assert.ok(sameRgb(b[0].col, ORANGE_RGB), "BOTTOM row is orange");
  const other = rowRuns(deck.blurb.find((l) => /CHORD/.test(l)));
  assert.ok(other.length >= 1 && sameRgb(other[0].col, SEPRGB), "a non-BOTTOM row is separator grey");
});

test("blurbLayout wraps a note line at the card width less 24 pt, and never lets a step go under 1.2 x the 3.6 pt floor", () => {
  const maxw = P.GEOM.CW - 24;
  const note = (n) => Array.from({ length: n }, (_, i) => "C" + (i % 9)).join("  ");
  const tw = (t) => P._internal.tw(t, "Label", 4.2, 0.35);
  var n = 1;
  while (tw(note(n + 1)) <= maxw) n++;
  assert.ok(tw(note(n)) <= maxw && tw(note(n + 1)) > maxw, "fixture: n notes just fit, n + 1 do not");
  assert.equal(P._internal.blurbLayout([note(n)]).rows.length, 1, "a line that just fits stays whole");
  const wrapped = P._internal.blurbLayout([note(n + 1)]).rows;
  assert.equal(wrapped.length, 2, "one note over the width wraps");
  wrapped.forEach((r) => assert.ok(tw(r.text) <= maxw, r.text));
  const lines = Array.from({ length: 12 }, (_, i) => "ROW " + i);
  const { size, step } = P._internal.blurbLayout(lines);
  assert.equal(size, 3.6, "the size floor holds");
  assert.ok(Math.abs(step - 1.2 * 3.6) < 1e-9, "the step floor holds, got " + step);
});

/* ---------------------------------------------------------------------
 * R4-E: pdfdeck branches no suite reached
 * ------------------------------------------------------------------ */
function generatedValue(seed) {
  const E = loadEngine(["core", "voicing", "layout", "naming", "select"]);
  const parsed = E.core.parseLegacySeed(seed, {});
  assert.ok(parsed.ok, "fixture seed must parse");
  const built = E.select.build(parsed.value);
  assert.ok(built.ok, "fixture seed must build");
  return { seed: E.core.formatSeed(parsed.value), deck: built.value };
}

test("R4-E legendDemo of a one-tone chord shows that tone as both root and other", () => {
  const payload = generatedValue("(D3) A3 C4 D4 E4 F4 G4 A4 C5");
  payload.deck.chords = [{ main: "X", sup: "", subtitle: "", fields: [3], roots: [3] }];
  assert.deepEqual(HPE.pdfdeck.fromGenerated(payload).legend_demo, [3, 3]);
  payload.deck.chords = [{ main: "X", sup: "", subtitle: "", fields: [3, 5], roots: [3] }];
  assert.deepEqual(HPE.pdfdeck.fromGenerated(payload).legend_demo, [5, 3]);
});

test("R4-E the title blurb is led by the ding when there is one, counts chords in the singular, and omits an empty BOTTOM row", () => {
  const payload = generatedValue("(D3) A3 C4 D4 E4 F4 G4 A4 C5");
  payload.deck.chords = payload.deck.chords.slice(0, 1);
  const lines = HPE.pdfdeck.fromGenerated(payload).blurb;
  assert.match(lines[0], /^D3  \|  A3  C4/);
  assert.deepEqual(lines.slice(1), ["1 CHORD - ONE CARD PER CHORD"], "no BOTTOM row on a pan without a bottom shell");
  payload.deck.chords = payload.deck.chords.concat(payload.deck.chords);
  assert.equal(HPE.pdfdeck.fromGenerated(payload).blurb.at(-1), "2 CHORDS - ONE CARD PER CHORD");

  delete payload.deck.fields["0"];
  assert.match(HPE.pdfdeck.fromGenerated(payload).blurb[0], /^A3  C4/, "no ding, no ding lead");
});

test("R4-E a generated deck with no warnings key has none, and bankers leaves a non-finite number alone", () => {
  const payload = generatedValue("(D3) A3 C4 D4 E4 F4 G4 A4 C5");
  delete payload.deck.warnings;
  assert.deepEqual(JSON.parse(JSON.stringify(HPE.pdfdeck.fromGenerated(payload).warnings)), []);
  assert.ok(Number.isNaN(HPE.pdfdeck.bankers(NaN, 1)));
  assert.equal(HPE.pdfdeck.bankers(Infinity, 1), Infinity);
  assert.equal(HPE.pdfdeck.bankers(0.25, 1), 0.2, "an exact tie goes to the even digit");
});

test("R4-E an overlay that shadows canonical data names the deck by id, or by name when it has no id", () => {
  const deck = DECK_DATA.find((d) => d.id === "hijaz");
  const clash = Object.assign({}, deck.print, { name: "nope" });
  assert.throws(() => HPE.pdfdeck.fromBuiltin(deck, clash), /^Error: hijaz: print overlay shadows canonical data: name$/);
  const anonymous = Object.assign({}, deck);
  delete anonymous.id;
  assert.throws(() => HPE.pdfdeck.fromBuiltin(anonymous, clash),
    new RegExp("^Error: " + deck.name + ": print overlay shadows canonical data: name$"));
});

test("R4-E drawString of an empty string draws nothing, and tracked and fit default to no tracking and the 3.6 pt floor", () => {
  const P = HPE.pdfcards;
  const page = HPE.pdf.doc(200, 200).page();
  const c = new P._internal.Canvas(page);
  c.drawString(10, 10, "");
  assert.equal(page.ops.length, 0, "an empty run emits no operator");
  const plain = P._internal.tracked(c, 10, 10, "ABC", "Label", 10);
  assert.equal(plain, P._internal.tw("ABC", "Label", 10, 0), "no track argument is no tracking");
  assert.ok(page.ops.every((op) => !/rg$/.test(op)), "and no colour argument sets no fill");
  assert.equal(P._internal.fit("ABCDEFGHIJ", "Label", 10, 1), 3.5, "an impossible width steps down past the default 3.6 pt floor and stops");
  assert.equal(P._internal.fit("ABCDEFGHIJ", "Label", 10, 1, 0, 2), 2, "an explicit floor is honoured");
});

test("R4-E build with no options, colours, degrees, grad or warnings falls back to the teal and amber defaults", () => {
  const deck = fixture();
  const tealAmber = ["0.043 0.482 0.459 rg", "0.867 0.561 0 rg"];
  const bare = JSON.parse(JSON.stringify(deck));
  for (const key of ["col_root", "col_tone", "degrees", "grad", "warnings"]) delete bare[key];
  const withDefaults = latin1(HPE.pdfcards.build(bare));
  for (const op of tealAmber) assert.ok(withDefaults.includes(op), op + " missing from a deck with no colours");
  assert.ok(!pdfGlyphs(HPE.pdfcards.build(bare)).map((g) => g.ch).join("").includes("NO 3RDS"), "no warnings key, no badge");
  const recoloured = JSON.parse(JSON.stringify(deck));
  recoloured.col_root = [0.1, 0.2, 0.3];
  recoloured.col_tone = [0.4, 0.5, 0.6];
  const own = latin1(HPE.pdfcards.build(recoloured));
  assert.ok(own.includes("0.1 0.2 0.3 rg") && own.includes("0.4 0.5 0.6 rg"));
  assert.ok(!own.includes("0.043 0.482 0.459 rg"), "a deck's own colours replace the defaults");
});

/* ---- Neotone lane P: a paired-area deck is drawn from geom.place -------- */

const PA = (() => {
  const fs = require("node:fs");
  const path = require("node:path");
  const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", f), "utf8"));
  return {
    frozen: read("paired_profile_v1.json"),
    pygmy: read("profile_case_pygmy_v1.json"),
    kurd: read("profile_case_kurd9_v1.json"),
  };
})();

function tracingPage() {
  const ops = [];
  let dash = false, fill = null;
  return {
    ops,
    text: (x, y, s, face, size) => ops.push({ op: "text", x, y, s, face, size, fill }),
    line: () => {},
    circle: (x, y, r, m) => ops.push({ op: "circle", x, y, r, m, dash }),
    roundRect: () => {}, rect: () => {},
    setFill: (r, g, b) => { fill = [r, g, b]; },
    setStroke: () => {}, setLineWidth: () => {},
    setDash: (a) => { dash = a > 0; },
    save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {},
  };
}

function paCard(payload, chordIndex) {
  const deck = HPE.pdfdeck.fromGenerated(payload);
  deck.R = P.profileRadius(payload.deck.geom);
  const page = tracingPage();
  P._internal.chordCard(new P._internal.Canvas(page), 0, 0, deck, 1, deck.chords[chordIndex]);
  return { page, deck, R: deck.R, cx: P.GEOM.CW / 2, cy: deck.cy };
}

const at = (cx, cy, R, [a, o]) => [
  cx + o * R * Math.cos((a * Math.PI) / 180), cy + o * R * Math.sin((a * Math.PI) / 180)];

test("PA: the draw figures are a literal copy of the frozen profile fixture and of HPE.layout.PROFILE", () => {
  const f = PA.frozen;
  assert.deepStrictEqual(JSON.parse(JSON.stringify(P.PROFILE_DRAW)), {
    primary: f.primary, secondary: f.secondary, ding: f.ding,
    n_in: f.n_in, n_out: f.n_out, extent_margin: f.extent_margin,
  });
  const E = loadEngine(["core", "layout"]);
  for (const k of ["primary", "secondary", "ding", "n_in", "n_out", "extent_margin"]) {
    assert.deepStrictEqual(JSON.parse(JSON.stringify(E.layout.PROFILE[k])), JSON.parse(JSON.stringify(P.PROFILE_DRAW[k])), k);
  }
});

test("PA: the print radius is round(74 / extent, 1) with the profile's fixed reach; acoustic geoms are not profiles", () => {
  assert.equal(P.profileRadius(PA.pygmy.deck.geom), 63.3);
  assert.equal(P.profileRadius(PA.kurd.deck.geom), 63.3);
  assert.ok(Math.abs(P.profileExtent(PA.kurd.deck.geom) - 1.1684) < 1e-9);
  assert.equal(P.profileRadius({ r_ding: 0.2, ding_dy: 0 }), null);
});

test("PA: build draws a profile deck on R 63.3, whatever R the adapter derived from the stale geom.ext", () => {
  const rims = [];
  const realDoc = HPE.pdf.doc;
  HPE.pdf.doc = function (w, h) {
    const doc = realDoc.call(this, w, h);
    const realPage = doc.page;
    doc.page = function () {
      const p = realPage.call(this);
      const rc = p.circle;
      p.circle = function (x, y, r, m) { rims.push(r); return rc.call(this, x, y, r, m); };
      return p;
    };
    return doc;
  };
  const deck = HPE.pdfdeck.fromGenerated(PA.kurd);
  try {
    P.build(deck, { variant: "shop" });
  } finally {
    HPE.pdf.doc = realDoc;
  }
  assert.notEqual(deck.R, 63.3, "the adapter's R comes from the stale ext");
  assert.ok(rims.includes(63.3), "the pan rim is drawn on R = 63.3");
  assert.ok(!rims.includes(deck.R));
});

test("PA: every field sits on its geom.place figure; an empty slot draws nothing and no guide ring is drawn", () => {
  const { page, R, cx, cy } = paCard(PA.kurd, 0);
  const g = PA.kurd.deck.geom;
  const circles = page.ops.filter((o) => o.op === "circle" && o.r <= R * 0.25);
  const want = Object.values(g.place).map(([a, o, r]) => [...at(cx, cy, R, [a, o]), r * R]);
  want.push([cx, cy, g.r_ding * R]);
  for (const [x, y, r] of want) {
    assert.ok(circles.some((c) => Math.abs(c.x - x) < 1e-6 && Math.abs(c.y - y) < 1e-6 &&
      Math.abs(c.r - r) < 1e-6), `no field circle at ${x}, ${y}`);
  }
  const fields = new Set(circles.map((c) => `${c.x.toFixed(3)},${c.y.toFixed(3)}`));
  assert.equal(fields.size, 10, "nine rim notes and the ding; p4 and p8 stay empty");
  const centred = page.ops.filter((o) => o.op === "circle" && Math.abs(o.x - cx) < 1e-9 &&
    Math.abs(o.y - cy) < 1e-9 && o.r > g.r_ding * R + 1e-6);
  assert.deepStrictEqual(centred.map((c) => c.r), [R], "only the rim: no inner ring, no bottom ring");
});

test("PA: a source-bottom note keeps its dashed ring and orange number in a primary slot; a top note in a secondary slot is ordinary", () => {
  const E = loadEngine(["core", "voicing", "layout", "naming", "select"]);
  E.core.PROFILE_ENABLED = true;
  const map = PA.pygmy.map.slice();
  const b = map.indexOf("b48"), t = map.indexOf("r55");
  [map[b], map[t]] = [map[t], map[b]];
  const parsed = E.core.parseSeed(PA.pygmy.seed, { profile: { id: "paired", rev: 1, map } });
  assert.ok(parsed.ok, JSON.stringify(parsed));
  const solved = E.layout.solve(parsed.value);
  assert.ok(solved.ok, JSON.stringify(solved));
  const payload = JSON.parse(JSON.stringify(PA.pygmy));
  payload.deck.geom = solved.value.geom;
  payload.deck.fields = solved.value.fields;

  const ids = Object.keys(payload.deck.fields);
  const bottomId = ids.find((k) => payload.deck.fields[k][2] === 48 && payload.deck.fields[k][3] === "bottom");
  const topId = ids.find((k) => payload.deck.fields[k][2] === 55 && payload.deck.fields[k][3] === "rim");
  assert.equal(payload.deck.geom.place[bottomId][1], 0.58, "C3 now sits in a primary slot");
  assert.equal(payload.deck.geom.place[topId][1], 0.86, "G3 now sits in a secondary slot");

  const idx = payload.deck.chords.findIndex((c) => !c.fields.some((f) => payload.deck.fields[f][2] % 12 === 0 || payload.deck.fields[f][2] % 12 === 7));
  assert.ok(idx >= 0);
  const { page, R, cx, cy } = paCard(payload, idx);
  const ringAt = (id) => {
    const [x, y] = at(cx, cy, R, payload.deck.geom.place[id]);
    return page.ops.find((q) => q.op === "circle" && Math.abs(q.x - x) < 1e-6 && Math.abs(q.y - y) < 1e-6);
  };
  assert.equal(ringAt(bottomId).dash, true, "an unlit bottom note is dashed in a primary slot");
  assert.equal(ringAt(topId).dash, false, "an unlit top note in a secondary slot is a solid field");
  const numberOf = (id) => page.ops.find((q) => q.op === "text" && q.s === payload.deck.fields[id][5] &&
    (q.face === "Label" || q.face === "LabelSB"));
  const orange = [0.8863, 0.4392, 0.0196];
  assert.deepStrictEqual(numberOf(bottomId).fill.map((v) => +v.toFixed(4)), orange);
  assert.equal(numberOf(bottomId).face, "LabelSB");
  assert.equal(numberOf(topId).face, "Label");
});

test("PA: the 3.6 pt floor holds for every diagram glyph of both profile decks", () => {
  for (const payload of [PA.pygmy, PA.kurd]) {
    payload.deck.chords.forEach((_, i) => {
      const { page, R, cx, cy } = paCard(payload, i);
      const glyphs = page.ops.filter((o) => o.op === "text" && Math.hypot(o.x - cx, o.y - cy) <= R * 1.25 &&
        (o.face === "Label" || o.face === "LabelSB"));
      assert.ok(glyphs.length > 10);
      for (const gl of glyphs) assert.ok(gl.size >= 3.6 - 1e-9, `${gl.s} drawn at ${gl.size}`);
    });
  }
});

test("PA: the app pan() draws a profile deck at geom.place, on the print extent, with no guide ring", () => {
  const { boot } = require("./helpers/sandbox.js");
  const app = boot();
  const d = PA.pygmy.deck;
  const svg = app.get(`pan(${JSON.stringify(d)}, ${JSON.stringify(d.chords[0])})`);
  const circles = [...svg.matchAll(/<circle cx="(-?[\d.e-]+)" cy="(-?[\d.e-]+)" r="([\d.e-]+)"/g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]), r: Number(m[3]) }));
  for (const [a, o, r] of Object.values(d.geom.place)) {
    const x = 100 * o * Math.cos((a * Math.PI) / 180), y = -100 * o * Math.sin((a * Math.PI) / 180);
    assert.ok(circles.some((c) => Math.abs(c.x - x) < 1e-6 && Math.abs(c.y - y) < 1e-6 &&
      Math.abs(c.r - 100 * r) < 1e-6), `app has no field at ${a} degrees, orbit ${o}`);
  }
  const ext = Number(svg.match(/viewBox="(-?[\d.]+) /)[1]);
  assert.ok(Math.abs(-ext - 100 * P.profileExtent(d.geom)) < 1e-6, "the viewBox is the print extent");
  assert.equal((svg.match(/<circle r="/g) || []).length, 1, "only the rim is a centred ring");
});

// docs/plans/2026-10-31-print-url-mark.md: the print-only handpantheory.com mark.
function ctmRecorder() {
  const texts = [];
  let m = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const mul = (a, b) => [
    a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
  let fill = null;
  const noop = () => {};
  return {
    texts: texts,
    text: (x, y, s, face, size) => {
      texts.push({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5], s, face, size,
        rotated: Math.abs(m[1]) > 1e-9, fill: fill, w: HPE.pdf.stringWidth(s, face, size) });
    },
    setFill: (r, g, b) => { fill = [r, g, b]; },
    save: () => stack.push([m.slice(), fill]),
    restore: () => { [m, fill] = stack.pop(); },
    translate: (dx, dy) => { m = mul([1, 0, 0, 1, dx, dy], m); },
    rotate: (d) => {
      const a = d * Math.PI / 180;
      m = mul([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0], m);
    },
    line: noop, circle: noop, roundRect: noop, rect: noop, setStroke: noop,
    setLineWidth: noop, setDash: noop,
  };
}

function urlMarkOf(deck, chord) {
  const page = ctmRecorder();
  P._internal.chordCard(new P._internal.Canvas(page), 0, 0, deck, 1, chord);
  const glyphs = page.texts.filter((t) => t.rotated && t.size === 4.0 && "handpantheory.com".includes(t.s));
  const credit = page.texts.filter((t) => t.rotated && !glyphs.includes(t));
  return { page, glyphs, credit };
}


const URL_DECKS = () => DECK_DATA.filter((d) => d.print).map(
  (d) => HPE.pdfdeck.fromBuiltin(d, d.print));

test("URL mark: every chord card of all five decks has one mark, bottom to top, 4.0 pt, URL grey, lower end at the footer baseline, inside the rounded frame, clear of the credit and the warning column", () => {
  const decks = URL_DECKS();
  assert.equal(decks.length, 5);
  let cards = 0;
  decks.forEach((deck) => deck.chords.forEach((chord) => {
    cards++;
    const { glyphs, credit, page } = urlMarkOf(deck, chord);
    assert.equal(glyphs.map((g) => g.s).join(""), "handpantheory.com", deck.name);
    const ys = glyphs.map((g) => g.y);
    assert.deepEqual(ys, ys.slice().sort((a, b) => a - b));
    assert.ok(Math.abs(ys[0] - 6.0) < 1e-9);
    glyphs.forEach((g) => {
      assert.ok(g.size >= 3.6);
      assert.deepEqual(g.fill, P.URL_MARK.grey);
      assert.ok(Math.abs(g.x - (P.GEOM.CW - 6.0)) < 1e-9);
    });
    const last = glyphs[glyphs.length - 1];
    const top = last.y + last.w;
    assert.ok(top <= P.GEOM.CH - 2.8);
    const x0 = glyphs[0].x - 4.0 * 1.011, x1 = glyphs[0].x + 4.0 * 0.353;
    assert.ok(x0 >= 2.8 && x1 <= P.GEOM.CW - 2.8);
    assert.ok(Math.hypot(x1 - (P.GEOM.CW - 7.0), ys[0] - 7.0) <= 4.2);
    const cMin = Math.min(...credit.map((t) => t.y));
    assert.ok(Math.abs(cMin - 50.4) < 1e-9, "credit starts at CREDIT_Y");
    assert.ok(cMin - top >= 3.9, "4 pt between the mark and the credit");
    page.texts.filter((t) => !t.rotated && t.y < 12).forEach((t) => {
      assert.ok(t.x + t.w <= P.GEOM.CW - 16 + 1e-6, "warning stays left of the mark column");
    });
  }));
  assert.equal(cards, 177);
});

test("URL mark: constants", () => {
  assert.equal(P.URL_MARK.text, "handpantheory.com");
  assert.equal(P.URL_MARK.size, 4.0);
  assert.equal(P.URL_MARK.track, 0.3);
  assert.equal(P.URL_MARK.creditY, 50.4);
});

test("URL mark: title, legend and blank cards carry none", () => {
  const deck = pygmyDeck();
  const I = P._internal;
  ["titleCard", "legendCard", "blankCard"].forEach((fn) => {
    assert.equal(typeof I[fn], "function", fn);
    const page = ctmRecorder();
    I[fn](new I.Canvas(page), 0, 0, deck);
    assert.ok(page.texts.some((t) => t.rotated), fn + " still draws its credit");
    assert.equal(page.texts.filter((t) => t.rotated && t.size === 4.0).length, 0, fn);
  });
});
