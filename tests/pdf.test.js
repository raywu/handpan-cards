/* HPE.pdf - the PDF writer core.
 *
 * The emitter exists so the platform's print engine never gets a vote on the
 * page box, which means this file's output has to be a PDF a real reader
 * accepts without a repair pass. The two traps pinned here are the ones that
 * make a file "open fine" in one viewer and fail in another: byte offsets in
 * the xref table (a JS string is UTF-16, so `length` is not a byte count), and
 * text metrics coming from anywhere but the one advance table Task 1 generated.
 *
 * Per tests/CONTRACT.md rule 2 nothing here imports a constant from pdf.js.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { loadEngine } = require("./helpers/engine.js");

const HPE = loadEngine(["fontdata", "pdf"]);

function latin1(doc) {
  return Buffer.from(doc.bytes()).toString("latin1");
}

test("bytes() returns a Uint8Array that starts with a PDF header", () => {
  const d = HPE.pdf.doc(612, 792);
  d.page();
  const out = d.bytes();
  // `instanceof` is useless here: the engine runs in its own vm realm, so its
  // Uint8Array is a different constructor than this file's.
  assert.equal(out.constructor.name, "Uint8Array");
  assert.match(Buffer.from(out.slice(0, 8)).toString("latin1"), /^%PDF-1\.[0-9]/);
});

test("the xref offsets are byte offsets, not character offsets", () => {
  const d = HPE.pdf.doc(612, 792);
  const p = d.page();
  // The degree sign is the trap: one JS character, two UTF-8 bytes, and one
  // byte in the latin1 the file is actually written in. Any accumulator that
  // measures with String#length puts every later xref entry into the middle
  // of an object.
  p.text(72, 720, "A°B", "Label", 12);
  const s = latin1(d);
  const startxref = Number(s.match(/startxref\n(\d+)/)[1]);
  assert.equal(s.slice(startxref, startxref + 4), "xref");
  let checked = 0;
  for (const m of s.matchAll(/^(\d{10}) 00000 n *$/gm)) {
    const off = Number(m[1]);
    if (off === 0) continue;
    assert.match(s.slice(off, off + 24), /^\d+ 0 obj/);
    checked += 1;
  }
  assert.ok(checked > 3, `only ${checked} in-use xref entries`);
});

test("the trailer /Size counts every object and the file ends with %%EOF", () => {
  const d = HPE.pdf.doc(612, 792);
  d.page();
  const s = latin1(d);
  const size = Number(s.match(/\/Size (\d+)/)[1]);
  const objs = [...s.matchAll(/^(\d+) 0 obj/gm)].map((m) => Number(m[1]));
  assert.equal(size, Math.max(...objs) + 1);
  assert.equal(s.trimEnd().endsWith("%%EOF"), true);
});

test("stringWidth reads the generated advance table and scales linearly", () => {
  const d = HPE.pdf.doc(612, 792);
  const one = d.stringWidth("Cm7", "Notes", 12);
  assert.ok(one > 0);
  assert.ok(Math.abs(d.stringWidth("Cm7", "Notes", 24) - 2 * one) < 1e-9);
  const w = HPE.fontdata.FACES.Notes.widths;
  const expect = ("Cm7".split("").reduce((a, c) => a + w[c], 0) / 1000) * 12;
  assert.ok(Math.abs(one - expect) < 1e-9);
});

test("stringWidth throws on a character outside CHARSET rather than scoring it 0", () => {
  const d = HPE.pdf.doc(612, 792);
  assert.throws(() => d.stringWidth("♯", "Notes", 12), /CHARSET/);
});

test("only the faces a page actually used are embedded", () => {
  const d = HPE.pdf.doc(612, 792);
  d.page().text(10, 10, "x", "Label", 8);
  const s = latin1(d);
  assert.match(s, /\/BaseFont \/NunitoSans-Regular/);
  assert.ok(!/\/BaseFont \/Marcellus-Regular/.test(s), "unused face embedded");
});

test("an embedded face is a simple TrueType with WinAnsi and a full Widths array", () => {
  const d = HPE.pdf.doc(612, 792);
  d.page().text(10, 10, "x", "Label", 8);
  const s = latin1(d);
  assert.match(s, /\/Subtype \/TrueType/);
  assert.match(s, /\/Encoding \/WinAnsiEncoding/);
  assert.match(s, /\/FirstChar 32/);
  assert.match(s, /\/LastChar 255/);
  const widths = s.match(/\/Widths \[([^\]]*)\]/)[1].trim().split(/\s+/);
  assert.equal(widths.length, 255 - 32 + 1);
  assert.match(s, /\/FontFile2 \d+ 0 R/);
  const len1 = Number(s.match(/\/Length1 (\d+)/)[1]);
  assert.ok(len1 > 5000, `Length1 ${len1} is not a whole subset font`);
});

test("text escapes the three special bytes and octal-escapes the high ones", () => {
  const d = HPE.pdf.doc(612, 792);
  d.page().text(10, 10, "a(b)c\\d°e", "Label", 8);
  const s = latin1(d);
  assert.match(s, /\(a\\\(b\\\)c\\\\d\\260e\) Tj/);
});

test("the page box is the one asked for, in both orientations of paper", () => {
  for (const [w, h] of [[612, 792], [595.28, 841.89]]) {
    const d = HPE.pdf.doc(w, h);
    d.page();
    assert.match(latin1(d), new RegExp(`/MediaBox \\[0 0 ${w} ${h}\\]`));
  }
});

test("graphics state nests: restore puts back what save captured", () => {
  const d = HPE.pdf.doc(612, 792);
  const p = d.page();
  p.save();
  p.translate(10, 20);
  p.rotate(-90);
  p.restore();
  const s = latin1(d);
  assert.equal((s.match(/(^|\n)q\n/g) || []).length, 1);
  assert.equal((s.match(/(^|\n)Q\n/g) || []).length, 1);
  assert.ok(s.indexOf("\nq\n") < s.indexOf("\nQ\n"));
});

test("every drawing primitive emits an operator and a paint mode", () => {
  const d = HPE.pdf.doc(612, 792);
  const p = d.page();
  p.setStroke(0, 0, 0);
  p.setFill(1, 0, 0);
  p.setLineWidth(0.3);
  p.setDash(2, 2);
  p.line(0, 0, 10, 10);
  p.rect(1, 2, 3, 4, "S");
  p.roundRect(1, 2, 30, 40, 5, "B");
  p.circle(50, 50, 10, "f");
  const s = latin1(d);
  for (const op of [" RG\n", " rg\n", " w\n", " d\n", " l\n", " re\n",
                    " c\n", "S\n", "f\n", "B\n"]) {
    assert.ok(s.includes(op), `missing operator ${JSON.stringify(op)}`);
  }
});
