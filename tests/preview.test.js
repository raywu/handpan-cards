// The pan renderer behind the editor's preview and the cards. The retired sheet's own
// preview (mirror flip, stale label, placeholder seed) is gone with the sheet; the editor's
// DOM half is covered in the browser by tests/editor_e2e.test.js.
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

test("the editor's pan is drawn by the same pan() the cards use", () => {
  const app = boot();
  const svg = app.get(`(() => {
    const m = editorLoad(${JSON.stringify(PLAIN)}, {}).value;
    const solved = editorSolve(m).value;
    const p = HPE.select.PALETTES[m.options.palette || 0] || HPE.select.PALETTES[0];
    return pan({ geom: solved.geom, fields: solved.fields, colors: { root: p.root, tone: p.tone } }, null, null);
  })()`);
  const rim = '<circle r="100" fill="none" stroke="#000" stroke-width="2"/>';
  assert.ok(svg.includes(rim), "the editor pan should use the shared pan renderer");
  assert.ok(app.faces().includes(rim), "the card should use the shared pan renderer");
});
