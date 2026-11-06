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
  withModel(a, "(D3) A3 Bb3 C4 D4 E4 F4 G4 | [A2]");
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
  withModel(a, "(D3) A3 Bb3 C4 D4 E4 F4 G4 | [A2]", `{ palette: 2 }`);
  a.run(`globalThis.__n = editorPanType(__m, "neotone").value; globalThis.__s = editorPanType(__n, "standard").value; true`);
  assert.strictEqual(a.get("JSON.stringify(__s) === JSON.stringify(__m)"), true);
});

test("U2b-10: a new scale opens as the empty model and a built-in opens with its notes, anchor and palette, no name and no replaces (D15)", () => {
  const a = app();
  assert.deepStrictEqual(plain(a.get("editorModelFor(null)")), { fields: {}, options: {}, pins: [] });
  a.run(`globalThis.__d = DECKS[0]; globalThis.__bm = editorModelFor(__d, "builtin"); true`);
  assert.strictEqual(a.get("HPE.core.formatSeed(__bm.fields) === HPE.core.formatSeed(__d.fields)"), true);
  assert.strictEqual(a.get("__bm.options.name"), undefined);
  assert.strictEqual(a.get("__bm.options.replaces"), undefined);
  assert.strictEqual(a.get("__bm.options.palette"), a.get("seedPalette(__d.colors)") || undefined);
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
  withModel(a, "(D3) A3 Bb3 C4 D4 E4 F4 G4 | [A2]", `{ palette: 2, name: "Mine", replaces: "x" }`);
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
