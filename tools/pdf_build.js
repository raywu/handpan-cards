#!/usr/bin/env node
// A generated-deck payload on stdin -> the print sheet the BROWSER would
// emit, on --out. The app calls HPE.pdfcards.build directly; this wrapper
// exists so tests/test_pdf_parity.py can hold that output against the bytes
// tools/hifi.py writes for the same deck.
//
//   node tools/pdf_build.js --out sheet.pdf [--variant full|shop]
//                           [--paper letter|a4]   < deck.json
const fs = require("node:fs");
const { loadEngine } = require("./engine_loader.js");

const argv = process.argv.slice(2);
function opt(name, dflt) {
  const i = argv.indexOf("--" + name);
  return i >= 0 ? argv[i + 1] : dflt;
}
const out = opt("out");
if (!out) {
  process.stderr.write("usage: pdf_build.js --out FILE [--variant f] < deck.json\n");
  process.exit(2);
}

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => { buf += d; });
process.stdin.on("end", () => {
  const HPE = loadEngine(["fontdata", "pdf", "pdfdeck", "pdfcards"]);
  const deck = HPE.pdfdeck.fromGenerated(JSON.parse(buf));
  const bytes = HPE.pdfcards.build(deck, {
    variant: opt("variant", "full"),
    paper: opt("paper", "letter"),
  });
  fs.writeFileSync(out, Buffer.from(bytes));
});
