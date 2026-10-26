// Shared fixtures of the seat sweeps (tests/seat_sweeps_*.test.js): the same helpers
// tests/app.test.js keeps for the rest of DR2a's unit layer.
const assert = require("node:assert");
const { boot } = require("./sandbox.js");
const { webcrypto } = require("node:crypto");

function openSheet(app) {
  app.els["deck-add"].click();
  return app.els;
}
async function makeCustom(app, text) {
  openSheet(app);
  app.type(text);
  assert.strictEqual(app.els["scale-generate"].disabled, false, "the sweep's literal fixture reaches generation");
  await app.getAsync("runGenerate()");
  assert.strictEqual(app.els["scale-sheet"].hidden, true, "the sweep fixture is saved before Edit opens");
  const selection = JSON.parse(app.get("JSON.stringify(selection)"));
  assert.strictEqual(selection.kind, "saved", "Edit sweeps target a stable saved instance");
  const row = JSON.parse(app.get(`JSON.stringify(savedEntries.get(${JSON.stringify(selection.id)}))`));
  assert.ok(row, "the selected fixture has a real saved entry");
  assert.strictEqual(row.instanceId, selection.id);
  assert.strictEqual(row.record.s, text, "the complete intended scale was saved");
  return { selection, deck: app.currentDeck() };
}
async function openEdit(app, fixture) {
  await app.getAsync(`selectDeck(${JSON.stringify(fixture.selection)})`);
  assert.deepStrictEqual(JSON.parse(app.get("JSON.stringify(selection)")), fixture.selection);
  app.clickChip(fixture.deck.name);
  assert.strictEqual(app.els["scale-sheet"].hidden, false, "the selected saved instance opens Edit");
}

const D2_NAT = ["C", "D", "E", "F", "G", "A", "B"];
/** n natural notes from `start` ("E3") upward. */
function d2Nat(start, n) {
  let i = D2_NAT.indexOf(start[0]);
  let oct = Number(start.slice(1));
  const out = [];
  for (let k = 0; k < n; k += 1) {
    out.push(D2_NAT[i] + oct);
    i += 1;
    if (i === 7) { i = 0; oct += 1; }
  }
  return out;
}
/** The scale with `sz` notes in each ring, and the note names of each ring in
 *  ascending order (which is the order of the ring's permutation). */
function d2Build(sz) {
  const bottom = d2Nat("C1", sz.bottom);
  const rim = d2Nat("E3", sz.rim);
  const inner = rim.length ? d2Nat(rim[rim.length - 1], sz.inner + 1).slice(1) : d2Nat("E3", sz.inner);
  const parts = [...bottom.map((n) => `[${n}]`), "(A2)", ...rim];
  if (inner.length) parts.push("|", ...inner);
  return { text: parts.join(" "), names: { rim, inner, bottom } };
}
const D2_RINGS = ["rim", "inner", "bottom"];
const d2Sizes = (ring, n) => ({ rim: 3, inner: 3, bottom: 3, [ring]: n });
const d2Id = (n) => Array.from({ length: n }, (_, i) => i);
async function d2Open(app, text, edit) {
  if (edit) await openEdit(app, await makeCustom(app, text));
  else { openSheet(app); app.type(text); }
  app.click(app.els["scale-tab-layout"]);
}
const d2Hit = (app, name) => {
  const h = app.hits().find((n) => String(n.getAttribute("aria-label")).startsWith(name + ","));
  assert.ok(h, `no hit target for ${name}`);
  return h;
};
/** A pointer tap: the press focuses the note, then the click arrives. */
const d2Tap = (app, name) => { const h = d2Hit(app, name); h.focus(); app.click(h); };
const d2Key = (app, name, key) => { const h = d2Hit(app, name); h.focus(); return app.press(h, key); };
const d2Seats = (app) => JSON.parse(app.get("JSON.stringify(layoutSeats)"));
const d2Pick = (app) => JSON.parse(app.get("JSON.stringify(pickRef)"));
const d2Status = (app) => app.els["scale-drawer-status"].textContent;
const d2Norm = (seats) => {
  const out = {};
  for (const r of D2_RINGS) {
    const l = seats && seats[r];
    if (l && l.some((s, i) => s !== i)) out[r] = l;
  }
  return Object.keys(out).length ? out : null;
};
const d2Seed = (app, seats) => {
  app.run(`setPick(null); layoutSeats = ${JSON.stringify(seats)}; resyncSheet(true)`);
};
/** The model of an exchange: the notes at list[i] and list[j] trade seats. */
const d2Exchange = (list, i, j) => { const l = list.slice(); [l[i], l[j]] = [l[j], l[i]]; return l; };
const d2Starts = (k) => {
  const out = [["default", d2Id(k)]];
  out.push(["exchange", d2Exchange(d2Id(k), 0, 1)]);
  if (k >= 3) out.push(["cycle", d2Id(k).map((i) => (i < 3 ? (i + 1) % 3 : i))]);
  return out;
};
const D2_OTHER = [1, 0, 2];
async function d2Case(ring, n, start, edit) {
  const app = boot(edit ? { crypto: webcrypto, abortController: true } : {});
  const sc = d2Build(d2Sizes(ring, n));
  await d2Open(app, sc.text, edit);
  const seats = {};
  for (const r of D2_RINGS) seats[r] = r === ring ? start : D2_OTHER;
  d2Seed(app, seats);
  return { app, sc, seats };
}
const d2AllRings = [["rim", 20], ["inner", 8], ["bottom", 8]];


module.exports = { openSheet, makeCustom, openEdit, D2_NAT, d2Nat, d2Build, D2_RINGS, d2Sizes, d2Id, d2Open, d2Hit, d2Tap, d2Key, d2Seats, d2Pick, d2Status, d2Norm, d2Seed, d2Exchange, d2Starts, D2_OTHER, d2Case, d2AllRings };
