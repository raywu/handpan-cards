#!/usr/bin/env node
// A generated-deck payload on stdin -> the adapted print deck on stdout, so
// tests/test_pdf_deck_adapter.py can hold src/engine/pdfdeck.js against
// decks.from_generated key for key.
const { loadEngine } = require("./engine_loader.js");

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => { buf += d; });
process.stdin.on("end", () => {
  const HPE = loadEngine(["pdfdeck"]);
  process.stdout.write(JSON.stringify(HPE.pdfdeck.fromGenerated(JSON.parse(buf))));
});
