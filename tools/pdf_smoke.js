#!/usr/bin/env node
// Writes a one-page PDF through src/engine/pdf.js so a real reader can judge
// it.  node's own tests can only prove the bytes are the bytes we meant to
// write; whether those bytes are a PDF is a question only a parser answers,
// and tests/test_pdf_emitter.py asks pymupdf.
//
//     node tools/pdf_smoke.js out.pdf [width height]
const fs = require("node:fs");
const { loadEngine } = require("./engine_loader.js");

const [, , out, w, h] = process.argv;
if (!out) {
  console.error("usage: node tools/pdf_smoke.js OUT.pdf [width height]");
  process.exit(2);
}

const HPE = loadEngine(["fontdata", "pdf"]);
const doc = HPE.pdf.doc(w ? Number(w) : 612, h ? Number(h) : 792);

const p = doc.page();
p.setStroke(0, 0, 0);
p.setLineWidth(0.5);
p.rect(36, 36, 200, 120, "S");
p.roundRect(260, 36, 120, 120, 8, "S");
p.setFill(0.043, 0.482, 0.459);
p.circle(120, 300, 40, "f");
p.setFill(0, 0, 0);
p.text(36, 420, "Cm7", "Display", 24);
p.text(36, 390, "C4 Eb4 G4 Bb3", "Notes", 11);
p.text(36, 370, "1-3-5-b7", "NotesB", 11);
p.text(36, 350, "DIMINISHED 7° (100% / Actual Size)", "Label", 9);
p.text(36, 330, "LOW VOICING", "LabelSB", 9);

const second = doc.page();
second.text(36, 700, "page two", "Label", 10);

fs.writeFileSync(out, Buffer.from(doc.bytes()));
console.log(out);
