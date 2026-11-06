// Scale editor lane U2b, the logic half of the shell: the pure primitives the
// panel is built on (text commit, pan type, the opening model, the dirty check),
// run in the sandbox with ONE_PANEL on. The DOM half is tests/editor_e2e.test.js.
// Assertions derive from docs/plans/2026-11-06-scale-editor-u2-split.md (U2b),
// D10, D12, SE-2, SE-15 and D15 in docs/plans/2026-11-05-scale-editor-reinvent.md.
const { test } = require("node:test");
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

test("U2c-14 (D22 / SE-4): a point inside a drawn circle hits that note first; the 43 unit areas catch the rest; holding yields to the zone under the pointer", () => {
  const a = app();
  withModel(a, "[E3] " + SCALE);
  a.run(`globalThis.__v = editorSolve(__m).value; globalThis.__g = __v.geom; true`);
  const hit = (x, y, holding = false) => plain(a.get(`editorHitAt(__v, [${x}, ${y}], ${holding})`));
  const bottomAt = plain(a.get(`(() => { const id = ringIds(__v.fields, "bottom")[0]; const ang = __v.fields[id][4] * Math.PI / 180; return [__g.bottom * Math.cos(ang), __g.bottom * Math.sin(ang), __v.fields[id][4]]; })()`));
  assert.deepStrictEqual(hit(bottomAt[0], bottomAt[1]), { kind: "note", ring: "bottom", i: 0 });
  const turn = bottomAt[2] * Math.PI / 180 + 0.2 / 1.15;
  const off = [1.15 * Math.cos(turn), 1.15 * Math.sin(turn)];
  assert.deepStrictEqual(hit(off[0], off[1]), { kind: "note", ring: "bottom", i: 0 }, "0.2 R along the ring is outside the drawn circle and inside the 43 unit area");
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
