#!/usr/bin/env node
/* Rewrites tests/fixtures/pan_render_v1.json from the CURRENT index.html.
 *
 * The fixture pins the two-argument pan() render - the one the card path uses
 * and the one tools/hifi.py is held to per field. Running this tool is how you
 * say "yes, the printed cards change"; it is not a routine sync step, so run it
 * only alongside a deliberate render change and explain the change in the same
 * commit. A data change moves this fixture too: regenerate after
 * tools/sync_decks.py, the same way the data mutants are regenerated.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { boot } = require("../tests/helpers/sandbox.js");

const digest = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

const app = boot();
const D = app.get("DECKS");
const decks = {};
for (let i = 0; i < D.length; i += 1) {
  const rows = { null: digest(app.get(`pan(DECKS[${i}], null)`)) };
  const n = app.get(`DECKS[${i}].chords.length`);
  for (let c = 0; c < n; c += 1)
    rows[c] = digest(app.get(`pan(DECKS[${i}], DECKS[${i}].chords[${c}])`));
  decks[D[i].id] = rows;
}

const out = {
  _what: "sha256(pan(deck, chord)) truncated to 16 hex, for the TWO-ARGUMENT render of every built-in deck and chord plus the null (unhighlighted) card.",
  _why: "pan() is shared by the card path and the print renderer agrees with it per field (tests/test_render_agreement.py). A change that alters this render is a change to every printed card, so it must be deliberate: regenerate this file in the same commit and say why. A same-tree comparison of pan(d,ch) against pan(d,ch,{}) cannot see a change that moves both.",
  _regen: "node tools/regen_pan_fixture.js",
  decks,
};
const dest = path.join(__dirname, "..", "tests", "fixtures", "pan_render_v1.json");
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
console.log(`wrote ${dest}: ` + Object.keys(decks).map((k) => `${k} ${Object.keys(decks[k]).length}`).join(", "));
