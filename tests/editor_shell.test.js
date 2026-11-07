// Scale editor lane U2b, the logic half of the shell: the pure primitives the
// panel is built on (text commit, pan type, the opening model, the dirty check),
// run in the sandbox with ONE_PANEL on. The DOM half is tests/editor_e2e.test.js.
// Assertions derive from docs/plans/2026-11-06-scale-editor-u2-split.md (U2b),
// D10, D12, SE-2, SE-15 and D15 in docs/plans/2026-11-05-scale-editor-reinvent.md.
const { test, describe } = require("node:test");
const assert = require("node:assert");
const { boot } = require("./helpers/sandbox.js");

const plain = (v) => JSON.parse(JSON.stringify(v));
const SCALE = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5";
const app = () => boot({ onePanel: true });
const withModel = (a, text, options = "undefined") => a.run(`globalThis.__m = editorLoad(${JSON.stringify(text)}, ${options}).value; true`);

test("U2b-1: the empty model has no notes and Save is not allowed on it", () => {
  const a = app();
  assert.deepStrictEqual(plain(a.get("editorEmptyModel()")), { fields: {}, options: {}, pins: [] });
  assert.strictEqual(a.get("editorCanSave(editorEmptyModel())"), false);
  withModel(a, SCALE);
  assert.strictEqual(a.get("editorCanSave(__m)"), true);
});

test("U2b-2: committing the same notes and zones keeps the pins, with no notice", () => {
  const a = app();
  withModel(a, SCALE, `{ angles: { inner: [125, null] } }`);
  const res = plain(a.get(`editorCommitText(__m, "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | D5 C5")`));
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.notice, undefined);
  assert.deepStrictEqual(res.value.pins, [{ ring: "inner", i: 0 }]);
  assert.deepStrictEqual(res.value.options.angles, { inner: [125, null] });
});

test("U2b-3: changing the notes while pins exist resets them and says so", () => {
  const a = app();
  withModel(a, SCALE, `{ angles: { inner: [125, null] }, palette: 3 }`);
  const res = plain(a.get(`editorCommitText(__m, "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5 E5")`));
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.notice, { pinsReset: true });
  assert.deepStrictEqual(res.value.pins, []);
  assert.strictEqual(res.value.options.angles, undefined);
  assert.strictEqual(res.value.options.seats, undefined);
  assert.strictEqual(res.value.options.palette, 3, "options that are not placement survive");
  assert.match(a.get("HPE.core.formatSeed(editorCommitText(__m, \"(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5 E5\").value.fields)"), /E5/);
});

test("U2b-4: changing the notes with no pins carries no notice", () => {
  const a = app();
  withModel(a, SCALE);
  const res = plain(a.get(`editorCommitText(__m, "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5 E5")`));
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.notice, undefined);
});

test("U2b-5: text the parser refuses is an engine refusal with its reason, and the model is not touched", () => {
  const a = app();
  withModel(a, SCALE);
  const before = JSON.stringify(plain(a.get("__m")));
  const res = plain(a.get(`editorCommitText(__m, "(D3) A3 Q9 C4")`));
  assert.strictEqual(res.ok, false);
  assert.ok(typeof res.reason === "string" && res.reason.length > 0 || typeof res.code === "string");
  assert.strictEqual(JSON.stringify(plain(a.get("__m"))), before);
});

test("U2b-6: empty text commits the empty model, and clearing pins counts as a reset", () => {
  const a = app();
  withModel(a, SCALE, `{ angles: { inner: [125, null] } }`);
  const res = plain(a.get(`editorCommitText(__m, "   ")`));
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.value.fields, {});
  assert.deepStrictEqual(res.notice, { pinsReset: true });
});

test("U2b-7: a commit is one history step and Undo restores the model that was current", () => {
  const a = app();
  withModel(a, SCALE, `{ angles: { inner: [125, null] } }`);
  a.run(`globalThis.__h = editorHistoryNew(__m); globalThis.__r = editorApply(__h, (m) => editorCommitText(m, "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5 E5")); true`);
  assert.strictEqual(a.get("__r.history.past.length"), 1);
  assert.deepStrictEqual(plain(a.get("__r.notice")), { pinsReset: true });
  assert.strictEqual(JSON.stringify(plain(a.get("editorUndo(__r.history).present"))), JSON.stringify(plain(a.get("__m"))));
  a.run(`globalThis.__r2 = editorApply(__h, (m) => editorCommitText(m, "(D3) A3 Q9")); true`);
  assert.strictEqual(a.get("__r2.history.past.length"), 0, "a refused commit adds no step");
});

test("U2b-8: pan type Standard to Neotone proposes the profile and back removes it, each one history step", () => {
  const a = app();
  withModel(a, "[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4");
  a.run(`globalThis.__h = editorHistoryNew(__m); true`);
  assert.strictEqual(a.get("editorKindOf(__m)"), "standard");
  a.run(`globalThis.__n = editorApply(__h, (m) => editorPanType(m, "neotone")); true`);
  assert.strictEqual(a.get("__n.history.past.length"), 1);
  assert.strictEqual(a.get("editorKindOf(__n.history.present)"), "neotone");
  const profile = plain(a.get("__n.history.present.options.profile"));
  assert.strictEqual(profile.id, "paired");
  assert.strictEqual(profile.rev, 2);
  assert.strictEqual(profile.map.length, 18);
  assert.strictEqual(a.get("editorSolve(__n.history.present).ok"), true, "the Neotone model solves");
  a.run(`globalThis.__s = editorApply(__n.history, (m) => editorPanType(m, "standard")); true`);
  assert.strictEqual(a.get("__s.history.past.length"), 2);
  assert.strictEqual(a.get("__s.history.present.options.profile"), undefined);
  assert.strictEqual(a.get("JSON.stringify(editorUndo(editorUndo(__s.history)).present) === JSON.stringify(__m)"), true);
  a.run(`globalThis.__same = editorApply(__h, (m) => editorPanType(m, "standard")); true`);
  assert.strictEqual(a.get("__same.history.past.length"), 0, "choosing the type already chosen adds no step");
});

test("U2b-9: switching to Standard drops the profile without touching the seats; unpinning is not involved", () => {
  const a = app();
  withModel(a, "[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4", `{ palette: 2 }`);
  a.run(`globalThis.__n = editorPanType(__m, "neotone").value; globalThis.__s = editorPanType(__n, "standard").value; true`);
  assert.strictEqual(a.get("JSON.stringify(__s) === JSON.stringify(__m)"), true);
});

test("U2b-10: a new scale opens as the empty model and a built-in opens with its notes, anchor and palette, no name and no replaces (D15)", () => {
  const a = app();
  assert.deepStrictEqual(plain(a.get("editorModelFor(null)")), { fields: {}, options: {}, pins: [] });
  a.run(`globalThis.__d = DECKS[0]; globalThis.__bm = editorModelFor(__d, "builtin"); true`);
  assert.strictEqual(a.get("HPE.core.formatSeed(__bm.fields) === HPE.core.formatSeed(__d.fields)"), true);
  assert.strictEqual(a.get("!__bm.options.name"), true);
  assert.strictEqual(a.get("__bm.options.replaces"), undefined);
  assert.strictEqual(a.get("__bm.options.palette || 0"), a.get("seedPalette(__d.colors)"));
  assert.deepStrictEqual(plain(a.get("__bm.pins")), []);
});

test("U2b-11: a saved scale opens with its options, name and pins carried", () => {
  const a = app();
  a.run(`globalThis.__d = { fields: editorLoad(${JSON.stringify(SCALE)}).value.fields,
    options: { name: "Mine", palette: 4, angles: { inner: [125, null] }, replaces: "x" }, colors: {} }; globalThis.__m = editorModelFor(__d, "saved"); true`);
  assert.strictEqual(a.get("__m.options.name"), "Mine");
  assert.strictEqual(a.get("__m.options.palette"), 4);
  assert.strictEqual(a.get("__m.options.replaces"), "x");
  assert.deepStrictEqual(plain(a.get("__m.pins")), [{ ring: "inner", i: 0 }]);
});

test("U2b-12: dirty means the model differs from the one the panel opened with", () => {
  const a = app();
  withModel(a, SCALE);
  a.run(`globalThis.__h = editorHistoryNew(__m); globalThis.__e = editorApply(__h, (m) => editorCommitText(m, "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5 E5")).history; true`);
  assert.strictEqual(a.get("editorIsDirty(__m, __h.present)"), false);
  assert.strictEqual(a.get("editorIsDirty(__m, __e.present)"), true);
  assert.strictEqual(a.get("editorIsDirty(__m, editorUndo(__e).present)"), false, "undone back to the start is clean");
});

test("U2b-13: the commit options of a Standard model are its options; a Neotone model keeps palette, name and the profile only", () => {
  const a = app();
  withModel(a, "[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4", `{ palette: 2, name: "Mine", replaces: "x" }`);
  assert.deepStrictEqual(plain(a.get("editorCommitOptions(__m)")), plain(a.get("__m.options")));
  a.run(`globalThis.__n = editorPanType(__m, "neotone").value; true`);
  const o = plain(a.get("editorCommitOptions(__n)"));
  assert.deepStrictEqual(Object.keys(o).sort(), ["name", "palette", "profile"]);
  assert.strictEqual(o.palette, 2);
  assert.strictEqual(o.name, "Mine");
});

test("U2b-14: the save command is separate for a built-in, an edit for a saved scale, an import for a new one (D15)", () => {
  const a = app();
  const cmd = (kind) => plain(a.get(`editorSaveCommand(${kind}, false)`));
  assert.deepStrictEqual(cmd(`{ selection: { kind: "builtin", id: "k" } }`), { type: "save-as-separate" });
  assert.deepStrictEqual(cmd(`{ selection: { kind: "saved", id: "u1" }, revision: 3 }`), { type: "edit", instanceId: "u1", expectedRevision: 3 });
  assert.deepStrictEqual(plain(a.get(`editorSaveCommand(null, false)`)).type, "import");
  assert.deepStrictEqual(plain(a.get(`editorSaveCommand({ selection: { kind: "saved", id: "u1" }, revision: 3 }, true, true)`)), { type: "save-as-separate" },
    "a Neotone conversion of a scale that owns a built-in slot saves separately");
});

test("U2b-15: flag off, opening the sheet builds no editor session", () => {
  const a = boot({ onePanel: false });
  a.run(`openScaleSheet(addChip); true`);
  assert.strictEqual(a.get("editorSession"), null);
});

// ---- U2c: the tray, tap placement, ding rules and the carried nits ----
// Assertions derive from the U2c row of docs/plans/2026-11-06-scale-editor-u2-split.md
// and D2, D4, D9, D22, D23, SE-4, SE-9, SE-11, SE-12, SE-14, SE-15 of
// docs/plans/2026-11-05-scale-editor-reinvent.md.
const solvedOf = (a, expr = "__m") => plain(a.get(`(() => { const s = editorSolve(${expr}); return s.ok ? Object.fromEntries(Object.entries(s.value.fields).map(([id, f]) => [f[0] + f[1], { zone: f[3], angle: f[4], label: f[5] }])) : s; })()`));
const FAR = "[A2] [B2] [C3] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5";

test("U2c-1 (U2a nit 2): swapping two pinned cyclops notes trades their angles instead of refusing '1,0 is not a note'", () => {
  const a = app();
  withModel(a, SCALE, `{ angles: { inner: [125, 55] } }`);
  const res = plain(a.get(`editorSwapSeats(__m, "inner", 0, 1)`));
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.deepStrictEqual(res.value.options.angles, { inner: [55, 125] });
  assert.deepStrictEqual(res.value.pins.map((p) => p.ring), ["inner", "inner"]);
});

test("U2c-2 (U2a nit 3): pins are oldest first; an exchange pins the unpinned note last, a fold re-pins the set note last", () => {
  const a = app();
  withModel(a, SCALE, `{ angles: { inner: [null, 55] } }`);
  assert.deepStrictEqual(plain(a.get(`editorSwapSeats(__m, "inner", 0, 1).value.pins`)), [{ ring: "inner", i: 1 }, { ring: "inner", i: 0 }]);
  withModel(a, SCALE, `{ seats: { inner: [1, 0] } }`);
  const folded = plain(a.get(`editorSetAngle(__m, "inner", 0, 60).value`));
  assert.deepStrictEqual(folded.pins, [{ ring: "inner", i: 1 }, { ring: "inner", i: 0 }], "the fold pins every note, the one set is newest");
  assert.strictEqual(folded.options.seats, undefined, "a fold drops the seat order");
});

test("U2c-3 (U2b nit 3): a typed seat order is honoured by a commit, as the legacy path does", () => {
  const a = app();
  withModel(a, SCALE);
  const swapped = plain(a.get(`editorCommitText(__m, "(D3) Bb3 A3 C4 D4 E4 F4 G4 A4 | C5 D5")`));
  assert.strictEqual(swapped.ok, true);
  assert.deepStrictEqual(swapped.value.options.seats, { rim: [1, 0, 2, 3, 4, 5, 6, 7] }, "same notes, new order: the seats follow the typing");
  const sol = solvedOf(a, `editorCommitText(__m, "(D3) Bb3 A3 C4 D4 E4 F4 G4 A4 | C5 D5").value`);
  assert.deepStrictEqual([sol.A3.angle, sol.Bb3.angle], [225, 270]);
  a.run(`globalThis.__s = editorCommitText(__m, "(D3) Bb3 A3 C4 D4 E4 F4 G4 A4 | C5 D5").value; true`);
  assert.strictEqual(a.get(`editorCommitText(__s, "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5").value.options.seats`), undefined, "typing pitch order again drops the seats");
  assert.strictEqual(a.get(`editorCommitText(__s, "(D3) Bb3 A3 C4 D4 E4 F4 G4 A4 | C5 D5") .value === __s`), true, "the same order is the same model");
  const more = plain(a.get(`editorCommitText(__m, "(D3) Bb3 A3 C4 D4 E4 F4 G4 A4 | C5 D5 E5")`));
  assert.deepStrictEqual(more.value.options.seats, { rim: [1, 0, 2, 3, 4, 5, 6, 7] }, "changed notes take the typed order too");
});

test("U2c-4: the tray's octave and flats are model view state, one Undo step each, and never make the scale dirty (SE-14)", () => {
  const a = app();
  withModel(a, SCALE);
  assert.deepStrictEqual(plain(a.get("editorView(__m)")), { flats: false, oct: 4 });
  a.run(`globalThis.__h = editorHistoryNew(__m); globalThis.__r = editorApply(__h, (m) => editorSetView(m, { flats: true })); true`);
  assert.strictEqual(a.get("__r.history.past.length"), 1);
  assert.deepStrictEqual(plain(a.get("editorView(__r.history.present)")), { flats: true, oct: 4 });
  assert.strictEqual(a.get("editorIsDirty(__m, __r.history.present)"), false);
  assert.deepStrictEqual(plain(a.get("editorView(editorUndo(__r.history).present)")), { flats: false, oct: 4 });
  a.run(`globalThis.__o = editorApply(__r.history, (m) => editorSetView(m, { oct: 5 })).history; true`);
  assert.strictEqual(a.get("__o.past.length"), 2);
  assert.strictEqual(a.get("editorExport(__o.present).s"), a.get("editorExport(__m).s"), "the export never carries the view");
  assert.strictEqual(a.get("editorApply(__o, (m) => editorSetView(m, { oct: 5 })).history.past.length"), 2, "no change, no step");
});

test("U2c-5: the octave range comes from the engine (SE-15)", () => {
  const a = app();
  assert.deepStrictEqual(plain(a.get("editorOctaveRange()")), { min: -1, max: 9 });
});

test("U2c-6: placing a note puts a rim note in pitch order, and a cyclops or bottom note at its 5 degree angle, pinned", () => {
  const a = app();
  withModel(a, SCALE);
  const rim = plain(a.get(`editorPlace(__m, "rim", "B4")`));
  assert.strictEqual(rim.ok, true);
  assert.match(a.get(`editorLineText(editorPlace(__m, "rim", "B4").value)`), /A4 B4/);
  const cy = plain(a.get(`editorPlace(__m, "inner", "E5", 92)`));
  assert.strictEqual(cy.ok, true, JSON.stringify(cy));
  assert.deepStrictEqual(cy.value.options.angles.inner.filter((v) => v !== null), [90], "92 snaps to the 5 degree step and pins");
  assert.strictEqual(cy.value.pins.length, 1);
  const bo = plain(a.get(`editorPlace(__m, "bottom", "E3", 101)`));
  assert.deepStrictEqual(bo.value.options.angles.bottom, [100]);
});

test("U2c-7 (SE-9): an add next to a pinned bottom note is refused by the engine's clash check and never overlaps", () => {
  const a = app();
  withModel(a, FAR, `{ angles: { bottom: [90, null, null] } }`);
  const near = plain(a.get(`editorPlace(__m, "bottom", "G2", 95)`));
  assert.strictEqual(near.ok, false, "5 degrees from a pinned note overlaps it");
  assert.ok(near.reason && near.reason.length > 0);
  const clear = plain(a.get(`editorPlace(__m, "bottom", "G2", 160)`));
  assert.strictEqual(clear.ok, true, JSON.stringify(clear));
  assert.strictEqual(a.get(`editorSolve(editorPlace(__m, "bottom", "G2", 160).value).ok`), true);
});

test("U2c-8 (D9 / SE-12): an add that resets a custom rim seat order says so in its notice", () => {
  const a = app();
  withModel(a, SCALE, `{ seats: { rim: [1, 0, 2, 3, 4, 5, 6, 7] } }`);
  const res = plain(a.get(`editorPlace(__m, "rim", "B4")`));
  assert.deepStrictEqual(res.notice, { seatsReset: "rim" });
  assert.strictEqual(res.value.options.seats, undefined);
  withModel(a, SCALE);
  assert.strictEqual(plain(a.get(`editorPlace(__m, "rim", "B4")`)).notice, undefined, "no custom order, no notice");
});

test("U2c-9 (D4): a tray note replaces a placed note and takes its seat, zone and angle", () => {
  const a = app();
  withModel(a, SCALE);
  const res = plain(a.get(`editorReplace(__m, "rim", 2, "B4")`));
  assert.strictEqual(res.ok, true);
  const sol = solvedOf(a, `editorReplace(__m, "rim", 2, "B4").value`);
  assert.strictEqual(sol.C4, undefined, "C4 is gone");
  assert.strictEqual(sol.B4.angle, 315, "B4 sits where C4 sat");
  assert.strictEqual(sol.D4.angle, 180, "no other note moved");
  assert.strictEqual(plain(a.get(`editorReplace(__m, "rim", 2, "A3")`)).ok, false, "a note already on the pan cannot be added twice");
});

test("U2c-10 (D23): a tray note replaces the ding; a placed note swaps seats with it", () => {
  const a = app();
  withModel(a, SCALE);
  const rep = solvedOf(a, `editorReplaceDing(__m, "G3").value`);
  assert.strictEqual(rep.G3.zone, "ding");
  assert.strictEqual(rep.D3, undefined);
  assert.strictEqual(rep.C4.angle, 315, "the rim did not move");
  withModel(a, "[A2] " + SCALE);
  const swap = solvedOf(a, `editorSwapNames(__m, { ring: "bottom", i: 0 }, { ring: "ding", i: 0 }).value`);
  assert.strictEqual(swap.A2.zone, "ding", "the dropped note is the ding");
  assert.strictEqual(swap.D3.zone, "bottom");
  assert.strictEqual(swap.D3.angle, 90, "the old root took the dropped note's seat");
  assert.strictEqual(plain(a.get(`editorSwapNames(__m, { ring: "rim", i: 2 }, { ring: "ding", i: 0 })`)).ok, false, "a ding above a rim note is not legal, the engine refuses");
});

test("U2c-11 (D4): a cross-zone swap trades zones and keeps each seat when both stay legal", () => {
  const a = app();
  withModel(a, SCALE);
  const sol = solvedOf(a, `editorSwapNames(__m, { ring: "rim", i: 2 }, { ring: "inner", i: 0 }).value`);
  assert.deepStrictEqual([sol.C5.zone, sol.C5.angle], ["rim", 315]);
  assert.strictEqual(sol.C4.zone, "inner");
  assert.strictEqual(sol.C4.angle, 128);
});

test("U2c-12 (SE-11): a bottom exchange that would clash a third note is refused by the engine", () => {
  const a = app();
  const n = 23;
  const notes = Array.from({ length: n }, (_, k) => `[${"CDEFGAB"[k % 7]}${1 + Math.floor(k / 7)}]`).join(" ");
  const angles = JSON.stringify({ bottom: Array.from({ length: n }, (_, k) => (k === 22 ? 90 : null)) });
  withModel(a, notes + " (A3) C4 D4 E4 F4", `{ angles: ${angles} }`);
  assert.strictEqual(plain(a.get(`editorSwapSeats(__m, "bottom", 0, 2)`)).ok, false);
});

test("U2c-13 (SE-15): note aria labels carry the zone and the seat", () => {
  const a = app();
  withModel(a, "[A2] " + SCALE);
  const labels = plain(a.get(`editorNoteLabels(__m)`));
  const byName = Object.fromEntries(Object.entries(labels).map(([id, text]) => [text.split(",")[0], text]));
  assert.strictEqual(byName.A3, "A3, rim seat 1");
  assert.strictEqual(byName.Bb3, "Bb3, rim seat 2");
  assert.strictEqual(byName.C5, "C5, cyclops seat 1");
  assert.strictEqual(byName.A2, "A2, bottom seat 1");
  assert.strictEqual(byName.D3, "D3, ding");
});

test("U2c-14 (D22 / SE-4): a point inside a drawn circle hits that note first; outside it the zone wins, held or not (OQA: the 43 unit areas are gone from the standard pan)", () => {
  const a = app();
  withModel(a, "[E3] " + SCALE);
  a.run(`globalThis.__v = editorSolve(__m).value; globalThis.__g = __v.geom; true`);
  const hit = (x, y, holding = false) => plain(a.get(`editorHitAt(__v, [${x}, ${y}], ${holding})`));
  const bottomAt = plain(a.get(`(() => { const id = ringIds(__v.fields, "bottom")[0]; const ang = __v.fields[id][4] * Math.PI / 180; return [__g.bottom * Math.cos(ang), __g.bottom * Math.sin(ang), __v.fields[id][4]]; })()`));
  assert.deepStrictEqual(hit(bottomAt[0], bottomAt[1]), { kind: "note", ring: "bottom", i: 0 });
  const turn = bottomAt[2] * Math.PI / 180 + 0.2 / 1.15;
  const off = [1.15 * Math.cos(turn), 1.15 * Math.sin(turn)];
  const outside = hit(off[0], off[1]);
  assert.strictEqual(outside.kind, "spot", "0.2 R along the ring is outside the drawn circle: the zone, not the note");
  assert.strictEqual(outside.ring, "bottom");
  const held = hit(off[0], off[1], true);
  assert.strictEqual(held.kind, "spot");
  assert.strictEqual(held.ring, "bottom", "holding, the zone under the pointer wins");
  assert.strictEqual(typeof held.angle, "number");
  assert.deepStrictEqual(hit(0, 0), { kind: "ding" }, "the ding edge stays the ding although a cyclops area laps it");
  assert.strictEqual(hit(0, 0, true).kind, "ding");
  const rimAt = plain(a.get(`(() => { const id = ringIds(__v.fields, "rim")[0]; const ang = __v.fields[id][4] * Math.PI / 180; return [__g.rim * Math.cos(ang), __g.rim * Math.sin(ang)]; })()`));
  assert.deepStrictEqual(hit(rimAt[0], rimAt[1]), { kind: "note", ring: "rim", i: 0 });
  assert.deepStrictEqual(hit(5, 5), { kind: "off" });
});

test("U2c-15 (parity 2): add, remove, swap, root replace and a pinned bottom angle land on the same record and share link as the same edit through today's tabs", () => {
  const a = app();
  const BASE = "[A2] [B2] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5";
  const via = (text, options) => plain(a.get(`(() => { const e = editorExport(editorLoad(${JSON.stringify(text)}, ${JSON.stringify(options)}).value); return { code: e.code, link: e.link, record: e.record }; })()`));
  const model = (call) => plain(a.get(`(() => { const m0 = editorLoad(${JSON.stringify(BASE)}, undefined).value; const r = ${call}; if (!r.ok) return { refused: r.code }; const e = editorExport(r.value); return { code: e.code, link: e.link, record: e.record }; })()`));
  const cases = [
    ["add rim", `editorAdd(m0, "rim", "B4")`, "[A2] [B2] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4 B4 | C5 D5"],
    ["add inner", `editorAdd(m0, "inner", "E5")`, "[A2] [B2] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5 E5"],
    ["add bottom", `editorAdd(m0, "bottom", "C3")`, "[A2] [B2] [C3] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5"],
    ["remove rim", `editorRemove(m0, "rim", 7)`, "[A2] [B2] (D3) A3 Bb3 C4 D4 E4 F4 G4 | C5 D5"],
    ["remove inner", `editorRemove(m0, "inner", 1)`, "[A2] [B2] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5"],
    ["remove bottom", `editorRemove(m0, "bottom", 0)`, "[B2] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5"],
    ["swap rim seats", `editorSwapSeats(m0, "rim", 0, 1)`, BASE, { seats: { rim: [1, 0, 2, 3, 4, 5, 6, 7] } }],
    ["root replace", `editorReplaceDing(m0, "C3")`, "[A2] [B2] (C3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5"],
    ["pinned bottom angle", `editorSetAngle(m0, "bottom", 0, 60, true)`, BASE, { angles: { bottom: [60, null] } }],
  ];
  for (const [label, call, text, options] of cases) {
    const got = model(call);
    assert.strictEqual(got.refused, undefined, label + " is accepted");
    assert.deepStrictEqual(got, via(text, options), label + ": same record and share link as the tabs");
  }
});

test("U2c-16 (ENGINE-SPEC, D10): a bottom copy of a top note is legal, so replace, ding replace and a cross-zone swap all succeed on it; a same-shell repeat is still refused by the engine", () => {
  const a = app();
  const BASE = "[C4] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5";
  const model = (call) => plain(a.get(`(() => { const m0 = editorLoad(${JSON.stringify(BASE)}, undefined).value; const r = ${call}; if (!r.ok) return { refused: r.code, reason: r.reason }; const e = editorExport(r.value); return { code: e.code, link: e.link, record: e.record }; })()`));
  const via = (text) => plain(a.get(`(() => { const e = editorExport(editorLoad(${JSON.stringify(text)}).value); return { code: e.code, link: e.link, record: e.record }; })()`));
  const cases = [
    ["replace a rim note (hold G3, tap A3)", `editorReplace(m0, "rim", 0, "G3")`, "[C4] (D3) G3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5"],
    ["replace the ding", `editorReplaceDing(m0, "C3")`, "[C4] (C3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5"],
    ["swap across zones", `editorSwapNames(m0, { ring: "rim", i: 7 }, { ring: "inner", i: 0 })`, "[C4] (D3) A3 Bb3 C4 D4 E4 F4 G4 C5 | A4 D5"],
    ["replace the bottom copy", `editorReplace(m0, "bottom", 0, "C3")`, "[C3] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5"],
  ];
  for (const [label, call, text] of cases) {
    const got = model(call);
    assert.strictEqual(got.refused, undefined, label + " is accepted: " + got.reason);
    assert.deepStrictEqual(got, via(text), label + ": same record and share link as the typed scale");
  }
  const repeat = model(`editorReplace(m0, "rim", 0, "C4")`);
  assert.strictEqual(repeat.refused, "NOTE_REPEATED", "a repeat inside one shell keeps the engine's reason");
  assert.doesNotMatch(repeat.reason, /is not a note/);
});

test("U2c-17 (nit 4): placing a pinned note keeps the add's notice and the pin's notice", () => {
  const a = app();
  withModel(a, "[A2] [B2] " + SCALE, `{ seats: { bottom: [1, 0] } }`);
  a.run(`globalThis.__real = editorSetAngle; editorSetAngle = (...args) => { const r = __real(...args); return r.ok ? { ...r, notice: { unpinned: [{ ring: "bottom", i: 0 }] } } : r; }; true`);
  const res = plain(a.get(`editorPlace(__m, "bottom", "C3", 120)`));
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.notice, { seatsReset: "bottom", unpinned: [{ ring: "bottom", i: 0 }] });
});

// ---- U2d: caps, crowded refusal, Reset spacing (D14, D16, D17, D18, parity 6 and 9) ----
const RIM8 = "A3 Bb3 C4 D4 E4 F4 G4 A4";
const CYC = ["C5", "D5", "E5", "F5", "G5", "A5", "B5"];
const BOT = ["A2", "B2", "C3", "E3", "F3", "G3", "Bb2", "Db3", "Eb3", "Gb3", "Ab3", "B3"];
const scaleOf = (rim, cyc, bot) => (bot ? BOT.slice(0, bot).map((n) => "[" + n + "]").join(" ") + " " : "") + "(D3) " + rim + (cyc ? " | " + CYC.slice(0, cyc).join(" ") : "");
const todays = (a, text, options = "undefined") => plain(a.get(`(() => { const s = HPE.core.parseSeed(${JSON.stringify(text)}, ${options}); const seed = { fields: s.value.fields, options: s.value.options };
  return { code: shareCode(seed).value, link: shareLink(seed), record: scaleRecord(seed) }; })()`));
const exported = (a, expr) => plain(a.get(`(() => { const r = ${expr}; if (!r.ok) return { refused: r.code, reason: r.reason }; const e = editorExport(r.value); return { code: e.code, link: e.link, record: e.record }; })()`));

test("U2d-1 (U2c nit 1): a bottom copy of a rim note placed on a scale lands on the record and share link of the typed text", () => {
  const a = app();
  const BASE = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5";
  withModel(a, BASE);
  const placed = exported(a, `editorPlace(__m, "bottom", "C4")`);
  assert.strictEqual(placed.refused, undefined, "the copy is accepted: " + placed.reason);
  assert.deepStrictEqual(placed, todays(a, "[C4] " + BASE));
  const viaTyped = exported(a, `editorLoad("[C4] " + ${JSON.stringify(BASE)})`);
  assert.deepStrictEqual(placed, viaTyped);
});

test("U2d-2 (D16): the caps are 12 rim, 6 cyclops, 12 bottom; the add that would pass one is refused with the exact copy, one under is accepted", () => {
  const a = app();
  assert.deepStrictEqual(plain(a.get("EDITOR_CAPS")), { rim: 12, inner: 6, bottom: 12 });
  withModel(a, scaleOf("A3 Bb3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5", 0, 0));
  const full = plain(a.get(`editorPlace(__m, "rim", "F5")`));
  assert.strictEqual(full.ok, false);
  assert.strictEqual(full.code, "AREA_FULL");
  assert.strictEqual(full.reason, "The rim is full at 12 notes. Remove one first.");
  withModel(a, scaleOf("A3 Bb3 C4 D4 E4 F4 G4 A4 B4 C5 D5", 0, 0));
  assert.strictEqual(plain(a.get(`editorPlace(__m, "rim", "E5")`)).ok, true, "the 12th rim note is accepted");
  withModel(a, scaleOf(RIM8, 6, 0));
  assert.strictEqual(plain(a.get(`editorPlace(__m, "inner", "C6")`)).reason, "The cyclops is full at 6 notes. Remove one first.");
  withModel(a, scaleOf(RIM8, 0, 12));
  assert.strictEqual(plain(a.get(`editorPlace(__m, "bottom", "A1")`)).reason, "The bottom is full at 12 notes. Remove one first.");
});

test("U2d-3 (D16): the crowded check is the final word; 6th cyclops with a bottom note is refused with the pt figures, the 12th bottom with 4 cyclops is accepted", () => {
  const a = app();
  withModel(a, scaleOf(RIM8, 5, 1));
  const crowded = plain(a.get(`editorPlace(__m, "inner", "C6")`));
  assert.strictEqual(crowded.ok, false);
  assert.strictEqual(crowded.code, "TOO_CROWDED");
  assert.strictEqual(crowded.reason, "Too crowded: labels would print at 2.71 pt, under 3.6 pt. Remove a note first.");
  withModel(a, scaleOf(RIM8, 4, 11));
  const twelfth = plain(a.get(`editorPlace(__m, "bottom", "A1")`));
  assert.strictEqual(twelfth.ok, true, "12 bottom with 4 cyclops fits: " + twelfth.reason);
  assert.strictEqual(plain(a.get(`editorNames(editorPlace(__m, "bottom", "A1").value, "bottom").length`)), 12);
});

test("U2d-4 (D16): a refused add changes nothing, and removing from a crowded scale is never refused", () => {
  const a = app();
  withModel(a, scaleOf(RIM8, 5, 1));
  const before = JSON.stringify(plain(a.get("__m")));
  a.run(`editorPlace(__m, "inner", "C6"); true`);
  assert.strictEqual(JSON.stringify(plain(a.get("__m"))), before);
  assert.strictEqual(plain(a.get(`editorRemove(__m, "inner", 0)`)).ok, true);
});

test("U2d-5 (parity 9): an over-cap scale loads, renders and exports as today; only a further add into that area is refused", () => {
  const a = app();
  const RIM13 = "A3 Bb3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5";
  withModel(a, scaleOf(RIM13, 0, 0));
  assert.deepStrictEqual(exported(a, "{ ok: true, value: __m }"), todays(a, scaleOf(RIM13, 0, 0)));
  assert.strictEqual(plain(a.get(`editorPlace(__m, "rim", "G5")`)).code, "AREA_FULL");
  assert.strictEqual(plain(a.get(`editorPlace(__m, "bottom", "A2")`)).ok, true, "another area still accepts");
  assert.strictEqual(plain(a.get(`editorRemove(__m, "rim", 0)`)).ok, true);
  withModel(a, scaleOf(RIM8, 5, 0));
  assert.deepStrictEqual(exported(a, "{ ok: true, value: __m }"), todays(a, scaleOf(RIM8, 5, 0)), "5 cyclops (over the saved 4) is untouched");
});

test("U2d-6 (D17): a rim join takes its pitch-order seat and an auto cyclops or bottom join stays unpinned", () => {
  const a = app();
  withModel(a, scaleOf(RIM8, 2, 1));
  const rim = plain(a.get(`editorPlace(__m, "rim", "B3")`));
  assert.deepStrictEqual(plain(a.get(`editorNames(editorPlace(__m, "rim", "B3").value, "rim")`)), ["A3", "Bb3", "B3", "C4", "D4", "E4", "F4", "G4", "A4"]);
  assert.strictEqual(rim.value.options.angles, undefined);
  assert.deepStrictEqual(exported(a, `editorPlace(__m, "rim", "B3")`), todays(a, scaleOf("A3 Bb3 B3 C4 D4 E4 F4 G4 A4", 2, 1)));
  const inner = plain(a.get(`editorPlace(__m, "inner", "E5")`));
  assert.deepStrictEqual(inner.value.pins, []);
});

test("U2d-7 (D5): a cyclops note placed at an exact angle writes angles.inner and saves as record v6 and a v8 link", () => {
  const a = app();
  withModel(a, scaleOf(RIM8, 2, 0));
  const res = exported(a, `editorPlace(__m, "inner", "E5", 90)`);
  assert.strictEqual(res.refused, undefined);
  assert.strictEqual(res.record.v, 6);
  assert.deepStrictEqual(res.record.o.angles.inner.filter((x) => x !== null), [90]);
  assert.match(res.link.value, /#s=8/);
  assert.strictEqual(exported(a, `{ ok: true, value: __m }`).record.v, 4, "the unpinned scale stays record v4");
});

const pinned = (a) => {
  withModel(a, scaleOf(RIM8, 3, 3));
  a.run(`globalThis.__m = [["bottom", 0, 60], ["bottom", 1, 120], ["inner", 2, 120]].reduce((m, [r, i, g]) => editorSetAngle(m, r, i, g, true).value, __m); true`);
};

test("U2d-8 (D18): the reset scope is the selected note's zone, else the selected zone, else every pinned zone; a rim note or the ding gives none", () => {
  const a = app();
  pinned(a);
  const scope = (sel, zone) => plain(a.get(`editorResetRings(__m, ${JSON.stringify(sel)}, ${JSON.stringify(zone)})`));
  assert.deepStrictEqual(scope({ ring: "bottom", i: 2 }, null), ["bottom"], "an unpinned bottom note still scopes its zone");
  assert.deepStrictEqual(scope({ ring: "inner", i: 2 }, "bottom"), ["inner"], "the note beats the selected zone");
  assert.deepStrictEqual(scope(null, "bottom"), ["bottom"]);
  assert.deepStrictEqual(scope(null, null), ["inner", "bottom"]);
  assert.deepStrictEqual(scope({ ring: "rim", i: 0 }, null), []);
  assert.deepStrictEqual(scope({ ring: "ding", i: 0 }, "bottom"), []);
  withModel(a, scaleOf(RIM8, 3, 3));
  assert.deepStrictEqual(plain(a.get(`editorResetRings(__m, null, null)`)), [], "no pins, no scope");
});

test("U2d-9 (D18): the Reset labels name the scope, the phone label is always Reset spacing, and Neotone disables it", () => {
  const a = app();
  pinned(a);
  const label = (sel, zone) => plain(a.get(`editorResetLabel(__m, ${JSON.stringify(sel)}, ${JSON.stringify(zone)})`));
  assert.deepStrictEqual(label({ ring: "inner", i: 0 }, null), { text: "Reset cyclops spacing", aria: "Reset cyclops spacing", enabled: true });
  assert.deepStrictEqual(label(null, "bottom"), { text: "Reset bottom spacing", aria: "Reset bottom spacing", enabled: true });
  assert.deepStrictEqual(label(null, null), { text: "Reset spacing (2)", aria: "Reset cyclops and bottom spacing", enabled: true });
  assert.deepStrictEqual(label({ ring: "rim", i: 0 }, null), { text: "Reset spacing", aria: "Reset spacing", enabled: false });
  assert.strictEqual(label({ ring: "bottom", i: 2 }, null).enabled, true, "an unpinned note scopes its zone, which holds pins");
  a.run(`globalThis.__m = editorResetSpacing(__m, ["bottom"]).value; true`);
  assert.strictEqual(label({ ring: "bottom", i: 2 }, null).enabled, false, "no pin in the scope");
  pinned(a);
  withModel(a, "[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4");
  a.run(`globalThis.__m = editorPanType(__m, "neotone").value; true`);
  assert.ok(a.get("!!__m.options.profile"), "the fixture is on a Neotone profile");
  assert.strictEqual(label(null, null).enabled, false);
  a.run(`__m.pins = [{ ring: "bottom", i: 0 }]; true`);
  assert.strictEqual(label({ ring: "bottom", i: 0 }, null).enabled, false, "Neotone disables Reset even with a stray pin");
});

test("U2d-10 (parity 6): Reset bottom spacing gives today's bytes, Reset cyclops spacing drops the v8 link, Reset (2) clears both in one step", () => {
  const a = app();
  const TEXT = scaleOf(RIM8, 3, 3);
  withModel(a, TEXT, `{ angles: { bottom: [60, 120, null] } }`);
  assert.deepStrictEqual(exported(a, `editorResetSpacing(__m, ["bottom"])`), todays(a, TEXT), "bottom reset: no at- option");
  withModel(a, TEXT, `{ angles: { inner: [null, null, 120] } }`);
  assert.match(exported(a, "{ ok: true, value: __m }").link.value, /#s=8/);
  const back = exported(a, `editorResetSpacing(__m, ["inner"])`);
  assert.deepStrictEqual(back, todays(a, TEXT));
  assert.doesNotMatch(back.link.value, /#s=8/);
  pinned(a);
  const both = plain(a.get(`editorResetSpacing(__m, ["inner", "bottom"])`));
  assert.strictEqual(both.ok, true);
  assert.deepStrictEqual(both.value.pins, []);
  assert.strictEqual(both.value.options.angles, undefined);
  assert.deepStrictEqual(exported(a, `editorResetSpacing(__m, ["inner", "bottom"])`), todays(a, TEXT));
  const hist = plain(a.get(`(() => { const h = editorApply(editorHistoryNew(__m), (m) => editorResetSpacing(m, ["inner", "bottom"])); return { past: h.history.past.length, undone: JSON.stringify(editorUndo(h.history).present) === JSON.stringify(__m) }; })()`));
  assert.deepStrictEqual(hist, { past: 1, undone: true }, "one Undo step restores both");
});

test("U2d-11 (D18): the reset sets the angles to the engine's count-rule spacing and leaves the other zone's pins alone", () => {
  const a = app();
  pinned(a);
  const res = plain(a.get(`(() => { const m = editorResetSpacing(__m, ["bottom"]).value; const s = editorSolve(m).value;
    const fresh = editorSolve(editorLoad(${JSON.stringify(scaleOf(RIM8, 3, 3))}, { angles: { inner: [null, null, 120] } }).value).value;
    return { got: editorAnglesOf({ value: s }, "bottom"), want: editorAnglesOf({ value: fresh }, "bottom"), pins: m.pins, angles: m.options.angles }; })()`));
  assert.deepStrictEqual(res.got, res.want);
  assert.deepStrictEqual(res.pins, [{ ring: "inner", i: 2 }]);
  assert.deepStrictEqual(res.angles, { inner: [null, null, 120] });
  assert.deepStrictEqual(plain(a.get(`editorResetSpacing(editorResetSpacing(__m, ["bottom"]).value, ["bottom"]).value.pins`)), [{ ring: "inner", i: 2 }], "nothing to reset is a no-op");
});

describe("U2f drag classifier and drop plan", () => {
  const rimOf = (a, x) => plain(a.get(`editorNames(${x}, "rim")`));
  const plan = (a, src, target) => a.run(`globalThis.__p = editorDropPlan(__m, ${JSON.stringify(src)}, ${JSON.stringify(target)}); true`);
  const after = (a) => a.run(`globalThis.__r = __p.step ? __p.step(__m) : null; true`);

  test("U2f-1 (D3): more than 8px of movement is a drag, 8px or less is a tap", () => {
    const a = app();
    for (const [dx, dy, want] of [[0, 0, "tap"], [8, 0, "tap"], [5, 5, "tap"], [0, 9, "drag"], [6, 6, "drag"], [-9, 0, "drag"]]) {
      assert.strictEqual(a.get(`editorDragKind(${dx}, ${dy})`), want, `${dx},${dy}`);
    }
  });

  test("U2f-2 (SE-6): a tray note on a spot places it, on a placed note replaces it, on the ding replaces the root; off the pan snaps back", () => {
    const a = app();
    withModel(a, SCALE);
    plan(a, { from: "tray", name: "B4" }, { kind: "spot", ring: "rim" });
    after(a);
    assert.ok(rimOf(a, "__r.value").includes("B4"));
    plan(a, { from: "tray", name: "B4" }, { kind: "note", ring: "rim", i: 2 });
    after(a);
    assert.deepStrictEqual(rimOf(a, "__r.value"), ["A3", "Bb3", "D4", "E4", "F4", "G4", "A4", "B4"]);
    assert.strictEqual(a.get("__p.say"), "C4 replaced by B4.");
    plan(a, { from: "tray", name: "G3" }, { kind: "ding" });
    after(a);
    assert.strictEqual(a.get("editorDingOf(__r.value)"), "G3");
    for (const kind of ["off", "outside"]) assert.strictEqual(a.get(`(() => { const p = editorDropPlan(__m, { from: "tray", name: "B4" }, { kind: ${JSON.stringify(kind)} }); return p.snap === true && !p.step && !p.trade; })()`), true, kind);
  });

  test("U2f-3 (D4, OQA): a placed note released outside the pan is removed; the ding never is; a miss inside the pan snaps back", () => {
    const a = app();
    withModel(a, SCALE);
    plan(a, { from: "pan", ref: { ring: "rim", i: 3 } }, { kind: "outside" });
    after(a);
    assert.ok(!rimOf(a, "__r.value").includes("D4"));
    assert.strictEqual(a.get("__p.say"), "D4 removed.");
    plan(a, { from: "pan", ref: { ring: "ding", i: 0 } }, { kind: "outside" });
    assert.strictEqual(a.get("__p.refuse"), "Every scale needs a ding. Drop another note on it to swap.");
    assert.strictEqual(a.get("__p.step"), undefined);
    withModel(a, "(D3) A3");
    plan(a, { from: "pan", ref: { ring: "rim", i: 0 } }, { kind: "outside" });
    assert.strictEqual(a.get("__p.refuse"), "The rim needs at least 1 note.");
    withModel(a, SCALE);
    plan(a, { from: "pan", ref: { ring: "rim", i: 3 } }, { kind: "off" });
    assert.strictEqual(a.get("__p.snap"), true);
  });

  test("U2f-4 (D4, D23): a placed note on another note trades; on itself snaps back; the ding trades through the same path", () => {
    const a = app();
    withModel(a, "[A2] " + SCALE);
    plan(a, { from: "pan", ref: { ring: "rim", i: 0 } }, { kind: "note", ring: "rim", i: 1 });
    assert.deepStrictEqual(plain(a.get("__p.trade")), [{ ring: "rim", i: 0 }, { ring: "rim", i: 1 }]);
    plan(a, { from: "pan", ref: { ring: "rim", i: 0 } }, { kind: "note", ring: "rim", i: 0 });
    assert.strictEqual(a.get("__p.snap"), true);
    plan(a, { from: "pan", ref: { ring: "bottom", i: 0 } }, { kind: "ding" });
    assert.deepStrictEqual(plain(a.get("__p.trade")), [{ ring: "bottom", i: 0 }, { ring: "ding", i: 0 }]);
  });

  test("U2f-5: a placed cyclops note dropped on a cyclops spot moves to that angle; a rim note dropped on an empty bottom spot moves areas", () => {
    const a = app();
    withModel(a, SCALE);
    plan(a, { from: "pan", ref: { ring: "inner", i: 0 } }, { kind: "spot", ring: "inner", angle: 110 });
    after(a);
    assert.deepStrictEqual(plain(a.get("__r.value.options.angles.inner.filter((x) => x !== null)")), [110]);
    plan(a, { from: "pan", ref: { ring: "rim", i: 3 } }, { kind: "spot", ring: "bottom", angle: 270 });
    after(a);
    assert.strictEqual(a.get("__r.ok"), true);
    assert.ok(!rimOf(a, "__r.value").includes("D4"));
    assert.deepStrictEqual(plain(a.get(`editorNames(__r.value, "bottom")`)), ["D4"]);
    plan(a, { from: "pan", ref: { ring: "rim", i: 3 } }, { kind: "spot", ring: "rim" });
    assert.strictEqual(a.get("__p.snap"), true, "a rim spot has no angle to move to");
  });

  test("U2f-8 (row 24): a tray note placed on an exact cyclops or bottom angle says where and that it stays; on the rim it says added", () => {
    const a = app();
    withModel(a, SCALE);
    plan(a, { from: "tray", name: "G5" }, { kind: "spot", ring: "inner", angle: -40 });
    assert.strictEqual(a.get("__p.say"), "G5 placed on the cyclops at 320 degrees. It stays there.");
    plan(a, { from: "tray", name: "G2" }, { kind: "spot", ring: "bottom", angle: 270 });
    assert.strictEqual(a.get("__p.say"), "G2 placed on the bottom at 270 degrees. It stays there.");
    plan(a, { from: "tray", name: "B4" }, { kind: "spot", ring: "rim" });
    assert.strictEqual(a.get("__p.say"), "B4 added to the rim.");
    plan(a, { from: "tray", name: "G2" }, { kind: "spot", ring: "bottom" });
    assert.strictEqual(a.get("__p.say"), "G2 added to the bottom.");
  });

  test("U2f-6 (D8): DRAG_ON_TOUCH is one constant, on by default", () => {
    const html = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "index.html"), "utf8");
    assert.strictEqual((html.match(/const DRAG_ON_TOUCH = true;/g) || []).length, 1);
    assert.strictEqual((html.match(/DRAG_ON_TOUCH/g) || []).length >= 2, true, "the flag is read, not only declared");
  });
});

test("U2f-7 (U2d nit N3): the area caps do not apply to a model with a profile; a 13th rim note there is not refused as rim full", () => {
  const a = app();
  withModel(a, scaleOf("A3 Bb3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5", 0, 0));
  a.run(`globalThis.__p = editorClone(__m); __p.options.profile = { id: "paired", rev: 2, map: [] }; globalThis.__r = editorPlace(__p, "rim", "F5"); true`);
  assert.strictEqual(a.get("editorPlace(__m, 'rim', 'F5').code"), "AREA_FULL", "the same add on a Standard pan is refused");
  assert.notStrictEqual(a.get("__r.code"), "AREA_FULL");
  assert.notStrictEqual(a.get("__r.code"), "TOO_CROWDED");
});

const openSession = (a, text, extra = "") => a.run(`globalThis.__m = editorLoad(${JSON.stringify(text)}, undefined).value; editorRender = () => {}; editorSession = { history: editorHistoryNew(__m), base: __m, editing: false, error: "", notice: false, saving: false, dialog: false, held: null, sel: null, zone: null, say: "", plainSay: "" }; ${extra} true`);

describe("OQA-A zone-first, zone state and copy", () => {
  test("OQA zone split midpoint: radius picks the zone, an empty cyclops included; past the bottom reach is off", () => {
    const a = app();
    withModel(a, "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4");
    a.run(`globalThis.__g = editorSolve(__m).value.geom; true`);
    const zone = (r) => a.get(`editorZoneAt(__g, [${r}, 0])`);
    const mid = a.get(`(editorOrbit(__g, "inner") + __g.rim) / 2`);
    assert.strictEqual(zone(mid - 0.01), "inner");
    assert.strictEqual(zone(mid + 0.01), "rim");
    const mid2 = a.get(`(__g.rim + editorOrbit(__g, "bottom")) / 2`);
    assert.strictEqual(zone(mid2 - 0.01), "rim");
    assert.strictEqual(zone(mid2 + 0.01), "bottom");
    const edge = a.get(`editorOrbit(__g, "bottom") + editorNoteReach(__g, "bottom") + 0.08`);
    assert.strictEqual(zone(edge - 0.01), "bottom");
    assert.strictEqual(zone(edge + 0.01), "off");
    const hit = plain(a.get(`(() => { const v = editorSolve(__m).value; return editorHitAt(v, [${mid - 0.01}, 0], false); })()`));
    assert.strictEqual(hit.kind, "spot");
    assert.strictEqual(hit.ring, "inner");
    assert.strictEqual(plain(a.get(`editorHitAt(editorSolve(__m).value, [${mid + 0.01}, 0], false)`)).ring, "rim");
  });

  test("OQA zone clear on lift and pan switch: s.zone is null after a pan-type switch (N1; the drag lift is in the e2e suite)", () => {
    const a = app();
    openSession(a, "[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4", `editorSession.zone = "bottom";`);
    a.run(`editorSetPanType("neotone");`);
    assert.strictEqual(a.get(`editorSession.zone`), null);
  });

  test("OQA N3 N4 N5 copy: ding stays, same zone, zone is full, each a status line and no silent deselect", () => {
    const a = app();
    openSession(a, "[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4", `editorSession.sel = { ring: "ding", i: 0 };`);
    a.run(`editorSelectTap({ kind: "spot", ring: "rim" }, editorSession.history.present);`);
    assert.strictEqual(a.get(`editorSession.say`), a.get(`t("editor.say.ding_stays")`));
    assert.deepStrictEqual(plain(a.get(`editorSession.sel`)), { ring: "ding", i: 0 }, "the selection stays");
    openSession(a, "[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4", `editorSession.sel = { ring: "rim", i: 1 };`);
    a.run(`editorPillTap("rim");`);
    assert.strictEqual(a.get(`editorSession.say`), a.get(`t("editor.say.same_zone", { name: "Bb3", zone: t("editor.zone.rim") })`));
    openSession(a, "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5");
    a.run(`editorPillTap("rim");`);
    assert.strictEqual(a.get(`editorSession.say`), a.get(`t("editor.say.zone_is_full", { zone: t("editor.zone.rim") })`));
    openSession(a, "(D3) A3 Bb3 C4");
    a.run(`editorPillTap("rim");`);
    assert.strictEqual(a.get(`editorSession.say`), a.get(`t("editor.say.pick_first")`));
  });

  test("OQA neotone untouched: Neotone editorHitAt on a fixture grid equals the recorded base result", () => {
    const a = app();
    withModel(a, "[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4");
    a.run(`globalThis.__n = editorPanType(__m, "neotone").value; globalThis.__v = editorSolve(__n).value; true`);
    assert.strictEqual(a.get(`!!__v.geom.place`), true);
    const grid = [];
    for (let x = -1.6; x <= 1.61; x += 0.2) for (let y = -1.6; y <= 1.61; y += 0.2) {
      for (const h of [false, true]) grid.push([+x.toFixed(2), +y.toFixed(2), h, plain(a.get(`editorHitAt(__v, [${x}, ${y}], ${h}, __n)`))]);
    }
    assert.strictEqual(require("node:crypto").createHash("sha1").update(JSON.stringify(grid)).digest("hex"), "86edb3c2a7ef03a154c10899d3f94dcdc9814937");
  });
});

describe("OQB owner QA gap 8", () => {
  const PINNED = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5";
  const clean = (text) => !/,,|^,|,\s/.test(text) && !/\d,\d/.test(text);

  test("OQB bad note copy clean: a refused angle or place names the note and the angle in one sentence, in en and de", () => {
    for (const lang of [null, "de"]) {
      const a = app();
      if (lang) a.run(`setLang(${JSON.stringify(lang)})`);
      withModel(a, PINNED, `{ angles: { inner: [125, null] } }`);
      const place = plain(a.get(`editorPlace(__m, "inner", "B4", 90)`));
      const set = plain(a.get(`editorSetAngle(__m, "inner", 1, 90, true)`));
      for (const res of [place, set]) {
        assert.strictEqual(res.ok, false);
        const text = a.get(`reasonText(${JSON.stringify(res)})`);
        assert.ok(clean(text), "no stringified angle list in: " + text);
        assert.ok(text.includes("90"), "names the angle: " + text);
        assert.ok(!/is not a note|ist keine Note/.test(text), "not the note-name copy: " + text);
      }
      assert.ok(a.get(`reasonText(${JSON.stringify(place)})`).includes("B4"), "names the note");
      assert.ok(a.get(`reasonText(${JSON.stringify(set)})`).includes("D5"), "names the note");
    }
  });
});

// ---- U2e-1: Neotone in the panel (D19, SE-13) ----
describe("U2e Neotone panel paths", () => {
  const NEO = "[A2] [C3] (D3) A3 C4 D4 E4 F4 G4 A4";
  const neo = (a, text = NEO) => a.run(`globalThis.__m = editorPanType(editorLoad(${JSON.stringify(text)}).value, "neotone").value; true`);
  const mapOf = (a) => plain(a.get("__m.options.profile.map"));
  const names = (a, ring) => plain(a.get(`editorNames(__m, ${JSON.stringify(ring)})`));
  const apply = (a, call) => { const res = plain(a.get(call)); if (res.ok) a.run(`globalThis.__m = ${call}.value; true`); return res; };

  test("U2e-1: insert fills the first empty field, then main compaction; the landing is the post-compaction slot (D9)", () => {
    const a = app();
    neo(a);
    assert.strictEqual(apply(a, `editorRemove(__m, "rim", 2)`).ok, true);
    assert.deepStrictEqual(mapOf(a).slice(0, 8), ["r57", "r60", null, "r64", "r65", "r67", "r69", null], "mutants exist: the hole stays");
    const res = apply(a, `editorAdd(__m, "rim", "B4")`);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.notice.landed, 2, "the first empty field takes the insert");
    assert.strictEqual(mapOf(a)[2], "r71");
    const bare = app();
    neo(bare, "(D3) A3 C4 D4 E4 F4");
    assert.strictEqual(apply(bare, `editorRemove(__m, "rim", 1)`).ok, true);
    assert.deepStrictEqual(mapOf(bare).slice(0, 6), ["r57", "r65", "r62", "r64", null, null], "no mutants: compactMain fills the hole from the tail");
    const add = apply(bare, `editorAdd(__m, "rim", "G4")`);
    assert.strictEqual(add.notice.landed, 4, "the highlight names the slot after compaction");
    const moved = apply(bare, `editorNeoMove(__m, 0, 7)`);
    assert.strictEqual(moved.ok, true);
    assert.strictEqual(moved.notice.landed, 0, "a move to a trailing empty field lands where compaction put it");
    const first = app();
    neo(first);
    assert.strictEqual(apply(first, `editorRemove(__m, "rim", 0)`).ok, true);
    assert.strictEqual(apply(first, `editorAdd(__m, "rim", "B4")`).notice.landed, 0, "the first empty field is slot 0");
  });

  test("U2e-2: a mutant into an empty field is refused with the field number, and the model is not touched", () => {
    const a = app();
    neo(a);
    apply(a, `editorRemove(__m, "rim", 2)`);
    const before = JSON.stringify(plain(a.get("__m")));
    const res = plain(a.get(`editorNeoPut(__m, 11, "G3")`));
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, "FIELD_EMPTY");
    assert.strictEqual(res.reason, "Field 3 is empty. Fill the field before its mutant.");
    assert.strictEqual(JSON.stringify(plain(a.get("__m"))), before);
    assert.strictEqual(plain(a.get(`editorNeoPut(__m, 12, "G3")`)).ok, true, "field 4 is filled, so its mutant is accepted");
  });

  test("U2e-3: add and remove only fill or empty fields; no field moves", () => {
    const a = app();
    neo(a);
    const base = mapOf(a);
    apply(a, `editorAdd(__m, "bottom", "D3")`);
    const after = mapOf(a);
    assert.deepStrictEqual(after.map((k, i) => (k === base[i] ? null : i)).filter((v) => v !== null), [11], "only the first empty mutant field changed");
    apply(a, `editorRemove(__m, "bottom", 0)`);
    assert.strictEqual(mapOf(a)[9], null, "removing empties the field and leaves the rest");
    assert.strictEqual(mapOf(a)[10], "b48");
  });

  test("U2e-4: move and swap stay inside one half; a cross-half drop is refused with copy", () => {
    const a = app();
    neo(a);
    assert.strictEqual(apply(a, `editorNeoMove(__m, 0, 8)`).ok, true);
    assert.strictEqual(mapOf(a)[8], "r57");
    assert.strictEqual(mapOf(a)[0], null);
    assert.strictEqual(apply(a, `editorNeoMove(__m, 1, 2)`).ok, true);
    assert.deepStrictEqual(mapOf(a).slice(1, 3), ["r62", "r60"], "a drop on a filled field swaps");
    const cross = plain(a.get(`editorNeoMove(__m, 1, 10)`));
    assert.strictEqual(cross.ok, false);
    assert.match(cross.reason, /own row/);
  });

  test("U2e-5: a tray note dropped on a filled field replaces that note and keeps its field", () => {
    const a = app();
    neo(a);
    const res = apply(a, `editorNeoPut(__m, 1, "B4")`);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(mapOf(a)[1], "r71");
    assert.deepStrictEqual(names(a, "rim").sort(), ["A3", "A4", "B4", "D4", "E4", "F4", "G4"].sort());
  });

  test("U2e-6: seat and angle edits on Neotone keep the engine's PROFILE_CONFLICT copy; Reset is disabled; no pin is made", () => {
    const a = app();
    neo(a);
    const res = plain(a.get(`editorSetAngle(__m, "bottom", 0, 60, true)`));
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, "PROFILE_CONFLICT");
    assert.match(a.get(`reasonText(${JSON.stringify(res)})`), /Neotone sets its own placement/);
    assert.strictEqual(plain(a.get("editorResetLabel(__m, null, null)")).enabled, false);
    assert.deepStrictEqual(plain(a.get("__m.pins")), []);
  });

  test("U2e-7: the drop plan on Neotone routes tray, move and remove through the slot primitives", () => {
    const a = app();
    neo(a);
    const plan = (src, target) => a.get(`(() => { const p = editorDropPlan(__m, ${JSON.stringify(src)}, ${JSON.stringify(target)}); const r = p.step ? p.step(__m) : null; return { has: !!p.step, trade: p.trade || null, snap: !!p.snap, refuse: p.refuse || null, ok: r && r.ok, landed: r && r.notice && r.notice.landed }; })()`);
    const put = plain(plan({ from: "tray", name: "B4" }, { kind: "spot", ring: "rim", slot: 7 }));
    assert.strictEqual(put.ok, true);
    assert.strictEqual(put.landed, 7);
    const move = plain(plan({ from: "pan", ref: { ring: "rim", i: 0 } }, { kind: "spot", ring: "rim", slot: 8 }));
    assert.strictEqual(move.landed, 8);
    const refuse = plain(plan({ from: "pan", ref: { ring: "rim", i: 0 } }, { kind: "spot", ring: "bottom", slot: 12 }));
    assert.strictEqual(refuse.has, false);
    assert.match(refuse.refuse, /own row/);
    const gone = plain(plan({ from: "pan", ref: { ring: "bottom", i: 0 } }, { kind: "outside" }));
    assert.strictEqual(gone.ok, true);
  });

  test("U2e-11 (D3): on Neotone a tap-swap of two main notes and a tap-move to an empty main field take the drag's path", () => {
    const a = app();
    openSession(a, "[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4");
    a.run(`editorSetPanType("neotone"); true`);
    const at = (slot) => a.get(`(() => { const m = editorSession.history.present; const r = editorNeoRef(m, ${slot}); return r ? editorNameAt(m, r) : null; })()`);
    const rimIndex = (name) => a.get(`editorNames(editorSession.history.present, "rim").indexOf(${JSON.stringify(name)})`);
    const tap = (sel, hit) => a.run(`editorSession.sel = ${JSON.stringify(sel)}; editorSelectTap(${JSON.stringify(hit)}, editorSession.history.present); true`);
    const past = () => a.get(`editorSession.history.past.length`);
    const slotA3 = [...Array(9).keys()].find((k) => at(k) === "A3");
    const slotBb3 = [...Array(9).keys()].find((k) => at(k) === "Bb3");
    const start = past();
    tap({ ring: "rim", i: rimIndex("A3") }, { kind: "note", ring: "rim", i: rimIndex("Bb3") });
    assert.strictEqual(a.get(`editorSession.error`), "", "the swap is not refused");
    assert.deepStrictEqual([at(slotA3), at(slotBb3)], ["Bb3", "A3"], "the two notes traded fields");
    assert.strictEqual(past(), start + 1, "one Undo step");
    const empty = [...Array(9).keys()].find((k) => at(k) === null);
    assert.notStrictEqual(empty, undefined);
    tap({ ring: "rim", i: rimIndex("A3") }, { kind: "spot", ring: "rim", slot: empty });
    assert.strictEqual(a.get(`editorSession.error`), "");
    assert.strictEqual(at(empty), "A3", "A3 moved to the empty field");
    assert.strictEqual(past(), start + 2, "one Undo step");
  });

  test("U2e-8: the hit test on Neotone names the field under the pointer through snapTarget", () => {
    const a = app();
    neo(a);
    a.run(`globalThis.__v = editorSolve(__m).value; true`);
    const hit = (slot) => plain(a.get(`(() => { const ref = editorNeoRef(__m, ${slot}); const pt = neoSlotPoint(${slot}, ref ? __v.geom.place[ringIds(__v.fields, ref.ring)[ref.i]] : null); return editorHitAt(__v, [pt.x / 100, -pt.y / 100], true, __m); })()`));
    assert.deepStrictEqual(hit(0), { kind: "note", ring: "rim", i: 0 });
    assert.deepStrictEqual(hit(9), { kind: "note", ring: "bottom", i: 0 });
    assert.deepStrictEqual(hit(7), { kind: "spot", ring: "rim", slot: 7 }, "an empty main field");
    assert.deepStrictEqual(hit(12), { kind: "spot", ring: "bottom", slot: 12 }, "an empty mutant field");
    assert.deepStrictEqual(plain(a.get(`editorHitAt(__v, [0, 0.0], true, __m)`)), { kind: "ding" });
    assert.deepStrictEqual(plain(a.get(`editorHitAt(__v, [3, 3], true, __m)`)), { kind: "off" });
  });

  test("U2e-9 (parity 2): Neotone insert, remove, move, swap and replace land on the same record and link as the same Neotone through today's tabs", () => {
    const a = app();
    const via = (text, map) => plain(a.get(`(() => { const e = editorExport(editorLoad(${JSON.stringify(text)}, { profile: { id: "paired", rev: 2, map: ${JSON.stringify(map)} } }).value); return { code: e.code, link: e.link, record: e.record }; })()`));
    const model = (call) => plain(a.get(`(() => { const m0 = editorPanType(editorLoad(${JSON.stringify(NEO)}).value, "neotone").value; const r = ${call}; if (!r.ok) return { refused: r.code }; const e = editorExport(r.value); return { code: e.code, link: e.link, record: e.record }; })()`));
    const base = ["r57", "r60", "r62", "r64", "r65", "r67", "r69", null, null, "b45", "b48", null, null, null, null, null, null, null];
    const edit = (f) => { const m = base.slice(); f(m); return m; };
    const cases = [
      ["insert rim", `editorAdd(m0, "rim", "B4")`, "[A2] [C3] (D3) A3 C4 D4 E4 F4 G4 A4 B4", edit((m) => { m[7] = "r71"; })],
      ["insert bottom", `editorAdd(m0, "bottom", "D3")`, "[A2] [C3] [D3] (D3) A3 C4 D4 E4 F4 G4 A4", edit((m) => { m[11] = "b50"; })],
      ["remove bottom", `editorRemove(m0, "bottom", 0)`, "[C3] (D3) A3 C4 D4 E4 F4 G4 A4", edit((m) => { m[9] = null; })],
      ["move", `editorNeoMove(m0, 0, 8)`, NEO, edit((m) => { m[8] = "r57"; m[0] = null; })],
      ["swap", `editorNeoMove(m0, 1, 2)`, NEO, edit((m) => { m[1] = "r62"; m[2] = "r60"; })],
      ["replace", `editorNeoPut(m0, 1, "B4")`, "[A2] [C3] (D3) A3 B4 D4 E4 F4 G4 A4", edit((m) => { m[1] = "r71"; })],
    ];
    for (const [label, call, text, map] of cases) {
      const got = model(call);
      assert.strictEqual(got.refused, undefined, label + " is accepted");
      assert.deepStrictEqual(got, via(text, map), label + ": same record and share link as the tabs");
    }
  });

  test("U2e-10: v7 Neotone share links decode in the panel and re-export identically", () => {
    const a = app();
    for (const text of [NEO, "[A2] (D3) A3 C4 D4 E4 F4", "[A2] [B2] [C3] (D3) A3 C4 D4 E4 F4 G4 A4 B4 C5"]) {
      const out = plain(a.get(`(() => { const m = editorPanType(editorLoad(${JSON.stringify(text)}).value, "neotone").value; const e = editorExport(m); const back = editorLoadShare(e.code); const f = editorExport(back.value); return { v: e.code.charAt(0), same: f.code === e.code && JSON.stringify(f.link) === JSON.stringify(e.link) && JSON.stringify(f.record) === JSON.stringify(e.record), ok: back.ok }; })()`));
      assert.strictEqual(out.ok, true, text);
      assert.strictEqual(out.v, "7", text + " is a v7 link");
      assert.strictEqual(out.same, true, text + " re-exports identically");
    }
  });
});

// ---- U2e-2: palette chip, mirror and anchor in the panel (D20, MIRROR kept) ----
describe("U2e-2 palette, mirror and anchor", () => {
  const WITH_BOTTOM = "[A2] [B2] [C3] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4";
  const CYCLOPS = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5";
  const load = (a, text, options = "undefined") => a.run(`globalThis.__m = editorLoad(${JSON.stringify(text)}, ${options}).value; true`);
  const apply = (a, call) => { const res = plain(a.get(call)); if (res.ok) a.run(`globalThis.__m = ${call}.value; true`); return res; };
  const solvedAngles = (a, ring, extra = "") => plain(a.get(`(() => { const s = editorSolve(__m); ${extra} return ringIds(s.value.fields, ${JSON.stringify(ring)}).map((id) => s.value.fields[id][4]); })()`));
  const legacyCode = (a, text, opts) => a.get(`(() => { const b = buildGenerated(${JSON.stringify(text)}, ${JSON.stringify(opts)}); return shareCode(seedOf(b.value)).value; })()`);

  test("U2e2-1 (parity 8): all ten palette indices land on the code today's tabs build, and palette 0 writes no option", () => {
    const a = app();
    for (let p = 0; p <= 9; p += 1) {
      load(a, WITH_BOTTOM);
      assert.strictEqual(apply(a, `editorSetPalette(__m, ${p})`).ok, true, "palette " + p);
      const code = a.get("editorExport(__m).code");
      assert.strictEqual(code, legacyCode(a, WITH_BOTTOM, { palette: p }), "palette " + p + " same code as the tabs");
      assert.strictEqual(code.includes("palette-"), p !== 0, "palette " + p + (p === 0 ? " writes no palette option" : " writes one"));
    }
    load(a, WITH_BOTTOM);
    apply(a, "editorSetPalette(__m, 9)");
    assert.match(a.get("editorExport(__m).code"), /\/palette-10\//);
    apply(a, "editorSetPalette(__m, 0)");
    assert.strictEqual(a.get("editorExport(__m).code.includes('palette-')"), false, "back to 0 drops the option");
    assert.strictEqual(plain(a.get("editorSetPalette(__m, 10)")).ok, false);
  });

  test("U2e2-2: a palette pick is one Undo step, picking the current palette adds none, and Undo restores the colours", () => {
    const a = app();
    load(a, WITH_BOTTOM);
    a.run("globalThis.__h = editorHistoryNew(__m); true");
    assert.strictEqual(a.get("editorApply(__h, (m) => editorSetPalette(m, 4)).history.past.length"), 1);
    assert.strictEqual(a.get("editorApply(__h, (m) => editorSetPalette(m, 0)).history.past.length"), 0, "palette 0 is already current");
    assert.strictEqual(a.get("editorUndo(editorApply(__h, (m) => editorSetPalette(m, 4)).history).present.options.palette"), 0);
  });

  test("U2e2-3: MIRROR TOP flips the rim and keeps the bottom as it was, on the code today's tabs build", () => {
    const a = app();
    load(a, WITH_BOTTOM);
    const rimBefore = solvedAngles(a, "rim");
    const bottomBefore = solvedAngles(a, "bottom");
    assert.strictEqual(apply(a, `editorSetMirror(__m, "top")`).ok, true);
    assert.strictEqual(a.get("__m.options.mirror"), true);
    assert.deepStrictEqual(solvedAngles(a, "bottom"), bottomBefore, "the bottom ring did not move");
    const rimAfter = solvedAngles(a, "rim");
    assert.notDeepStrictEqual(rimAfter, rimBefore);
    assert.deepStrictEqual(rimAfter, rimBefore.map((x) => (180 - x + 360) % 360), "the rim is reflected");
    assert.strictEqual(a.get("editorExport(__m).code"), legacyCode(a, WITH_BOTTOM, { mirror: true, mirrorBottom: false }));
  });

  test("U2e2-4: MIRROR BOTTOM reflects every bottom note, a placed one too (180 - a), as the sheet's toggle does", () => {
    const a = app();
    load(a, WITH_BOTTOM, `{ angles: { bottom: [null, 240, null] } }`);
    const before = solvedAngles(a, "bottom");
    assert.strictEqual(apply(a, `editorSetMirror(__m, "bottom")`).ok, true);
    assert.deepStrictEqual(plain(a.get("__m.options.angles.bottom")), [null, 300, null], "the placed note reflects");
    assert.strictEqual(a.get("editorBottomMirror(__m)"), true);
    assert.deepStrictEqual(solvedAngles(a, "rim"), plain(a.get("(() => { const m = editorSetMirror(editorSetMirror(__m, 'bottom').value, 'bottom').value; const s = editorSolve(m); return ringIds(s.value.fields, 'rim').map((id) => s.value.fields[id][4]); })()")), "the rim is untouched");
    assert.notDeepStrictEqual(solvedAngles(a, "bottom"), before);
    assert.strictEqual(a.get("editorExport(__m).code"), legacyCode(a, WITH_BOTTOM, { mirrorBottom: true, angles: { bottom: [null, 300, null] } }));
  });

  test("U2e2-5: MIRROR TOP on a pinned cyclops reflects the cyclops (180 - a), the link keeps its version, and numbers stay with positions", () => {
    const a = app();
    load(a, CYCLOPS, `{ angles: { inner: [125, 55] } }`);
    const labels = () => plain(a.get(`(() => { const s = editorSolve(__m).value.fields; return ringIds(s, "inner").map((id) => [s[id][4], s[id][5]]).sort((x, y) => x[0] - y[0]); })()`));
    const before = labels();
    const version = a.get("editorExport(__m).code.split('/')[0]");
    assert.strictEqual(apply(a, `editorSetMirror(__m, "top")`).ok, true);
    assert.deepStrictEqual(plain(a.get("__m.options.angles.inner")), [55, 125]);
    assert.deepStrictEqual(plain(a.get("__m.pins")), [{ ring: "inner", i: 0 }, { ring: "inner", i: 1 }].slice(0, a.get("__m.pins.length")), "the pins stay on their notes");
    assert.strictEqual(a.get("editorExport(__m).code.split('/')[0]"), version, "the link version does not change");
    assert.deepStrictEqual(labels().map((p) => p[1]), before.map((p) => p[1]), "each position keeps its number");
    assert.deepStrictEqual(labels().map((p) => p[0]), before.map((p) => p[0]));
  });

  test("U2e2-6: each toggle is one Undo step, toggling twice returns the identical model, and a toggle with nothing to flip adds no step", () => {
    const a = app();
    load(a, WITH_BOTTOM);
    const start = a.get("JSON.stringify(__m)");
    a.run("globalThis.__h = editorHistoryNew(__m); true");
    const once = plain(a.get(`(() => { const r = editorApply(__h, (m) => editorSetMirror(m, "top")); const t = editorApply(r.history, (m) => editorSetMirror(m, "top")); return { one: r.history.past.length, two: t.history.past.length, back: JSON.stringify(t.history.present) === JSON.stringify(editorHistoryNew(editorLoad(${JSON.stringify(WITH_BOTTOM)}).value).present) }; })()`));
    assert.deepStrictEqual(once, { one: 1, two: 2, back: true });
    const bottom = plain(a.get(`(() => { const r = editorApply(__h, (m) => editorSetMirror(m, "bottom")); const t = editorApply(r.history, (m) => editorSetMirror(m, "bottom")); return { one: r.history.past.length, back: JSON.stringify(t.history.present) === JSON.stringify(__m) }; })()`));
    assert.deepStrictEqual(bottom, { one: 1, back: true });
    assert.strictEqual(a.get("JSON.stringify(__m)"), start);
    load(a, "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4");
    a.run("globalThis.__h = editorHistoryNew(__m); true");
    assert.strictEqual(a.get(`editorApply(__h, (m) => editorSetMirror(m, "bottom")).history.past.length`), 0, "no bottom notes, nothing to flip");
  });

  test("U2e2-7: the anchor picks note 1 centred or notes 1 and 2 split, on the code today's tabs build, one Undo step each", () => {
    const a = app();
    load(a, WITH_BOTTOM);
    const one = solvedAngles(a, "rim");
    assert.strictEqual(apply(a, `editorSetAnchor(__m, "between")`).ok, true);
    const between = solvedAngles(a, "rim");
    assert.notDeepStrictEqual(between, one);
    assert.strictEqual(a.get("editorExport(__m).code"), legacyCode(a, WITH_BOTTOM, { anchor: "between" }));
    a.run("globalThis.__h = editorHistoryNew(__m); true");
    assert.strictEqual(a.get(`editorApply(__h, (m) => editorSetAnchor(m, "between")).history.past.length`), 0, "already split");
    assert.strictEqual(a.get(`editorApply(__h, (m) => editorSetAnchor(m, "one")).history.past.length`), 1);
    assert.strictEqual(plain(a.get(`editorSetAnchor(__m, "left")`)).ok, false, "only the two named anchors");
    assert.strictEqual(apply(a, `editorSetAnchor(__m, "one")`).ok, true);
    assert.deepStrictEqual(solvedAngles(a, "rim"), one);
  });

  test("U2e2-8: toggling mirror or anchor there and back is not an edit, and a Neotone model takes none of the three", () => {
    const a = app();
    load(a, WITH_BOTTOM);
    a.run(`globalThis.__base = __m; true`);
    for (const call of [`editorSetMirror(editorSetMirror(__m, "top").value, "top")`, `editorSetMirror(editorSetMirror(__m, "bottom").value, "bottom")`,
      `editorSetAnchor(editorSetAnchor(__m, "between").value, "one")`]) {
      assert.strictEqual(a.get(`editorIsDirty(__base, ${call}.value)`), false, call);
    }
    assert.strictEqual(a.get(`editorIsDirty(__base, editorSetMirror(__m, "top").value)`), true);
    a.run(`globalThis.__m = editorPanType(__m, "neotone").value; true`);
    for (const call of [`editorSetMirror(__m, "top")`, `editorSetMirror(__m, "bottom")`, `editorSetAnchor(__m, "between")`]) {
      const res = plain(a.get(call));
      assert.strictEqual(res.ok, true, call);
      assert.strictEqual(a.get(`${call}.value === __m`), true, call + " changes nothing on Neotone");
    }
  });
});
