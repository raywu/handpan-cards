#!/usr/bin/env node
// A generated-deck payload on stdin -> the print sheet the BROWSER would
// emit, on --out. The app calls HPE.pdfcards.build directly; this wrapper
// exists so tests/test_pdf_parity.py can hold that output against the bytes
// tools/hifi.py writes for the same deck.
//
//   node tools/pdf_build.js --out sheet.pdf [--variant full|shop]
//                           [--paper letter|a4]   < deck.json
//
// --builtin <deck-id> builds one of the three shipped decks (hijaz, pygmy,
// amara) straight from data/decks.json instead, through
// HPE.pdfdeck.fromBuiltin - no stdin involved. This branch runs BEFORE the
// stdin listener is wired: a --builtin invocation has nothing piped in, and
// the plain mode's whole body runs inside process.stdin.on("end"), which
// never fires on a closed, empty stdin - the process would hang rather than
// fail if the builtin branch lived inside that handler.
const fs = require("node:fs");
const path = require("node:path");
const { loadEngine } = require("./engine_loader.js");

const argv = process.argv.slice(2);
function opt(name, dflt) {
  const i = argv.indexOf("--" + name);
  return i >= 0 ? argv[i + 1] : dflt;
}
const out = opt("out");
if (!out) {
  process.stderr.write("usage: pdf_build.js --out FILE [--variant f] < deck.json\n");
  process.stderr.write("   or: pdf_build.js --out FILE --builtin <deck-id>\n");
  process.exit(2);
}

const builtinId = opt("builtin");
if (builtinId) {
  const canonicalPath = path.join(__dirname, "..", "data", "decks.json");
  const canonical = JSON.parse(fs.readFileSync(canonicalPath, "utf8"));
  const deck = canonical.find((d) => d.id === builtinId);
  if (!deck) {
    process.stderr.write("pdf_build.js: no built-in deck '" + builtinId +
                         "' in data/decks.json\n");
    process.exit(2);
  }
  const HPE = loadEngine(["fontdata", "pdf", "pdfdeck", "pdfcards"]);
  const built = HPE.pdfdeck.fromBuiltin(deck, deck.print);
  const bytes = HPE.pdfcards.build(built, {
    variant: opt("variant", "full"),
    paper: opt("paper", "letter"),
  });
  fs.writeFileSync(out, Buffer.from(bytes));
} else {
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
}
