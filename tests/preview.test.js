// The pan drawing the card path shares with the editor: a pan rendered with no
// chord selected is the bare pan and lights no field.
const { test } = require("node:test");
const assert = require("node:assert");
const { boot } = require("./helpers/sandbox.js");

const PLAIN = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";

test("a chordless pan render does not throw and lights no field", () => {
  const app = boot();
  const svg = app.get(
    "pan({geom: HPE.layout.solve(HPE.core.parseLegacySeed(" + JSON.stringify(PLAIN) +
    ", {}).value, {mirror:false}).value.geom, fields: HPE.layout.solve(HPE.core.parseLegacySeed(" +
    JSON.stringify(PLAIN) + ", {}).value, {mirror:false}).value.fields, " +
    "colors: HPE.select.PALETTES[0]}, null)");
  assert.match(svg, /^<svg\b/);
  const p = app.get("HPE.select.PALETTES[0]");
  assert.ok(!svg.includes(p.root) && !svg.includes(p.tone),
    "a chordless pan must light no field");
});
