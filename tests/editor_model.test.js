// Scale editor lane U, release-safety half: the app's record gates for a pinned
// cyclops (record v6), the saved meaning, the move transfer, and the rollback
// against main's frozen reader. Assertions derive from
// docs/plans/2026-11-05-scale-editor-reinvent.md (R3-1, R3-3, R4-1) and
// docs/ENGINE-SPEC.md section 14; none restates the implementation.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { boot, createOrigin } = require("./helpers/sandbox.js");

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const FROZEN = fs.readFileSync(path.join(__dirname, "fixtures", "shipped_client_c6ef6b58.html.txt"), "utf8");
const plain = (v) => JSON.parse(JSON.stringify(v));
const settle = async () => { for (let i = 0; i < 8; i += 1) await new Promise((r) => setImmediate(r)); };
const webcrypto = require("node:crypto").webcrypto;
const appBoot = (opts = {}) => boot({ crypto: webcrypto, abortController: true, ...opts });

const SCALE = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5";
const PIN = { angles: { inner: [125, 55] } };
const NOPIN = {};

const sharedBoot = async (origin, html) => {
  const app = boot({ html, origin, indexedDB: true, broadcastChannel: true, locks: true, isSecureContext: true,
    crypto: webcrypto, abortController: true });
  await app.waitFor("typeof booted !== 'undefined' && booted === true", { timeout: 3000 });
  await settle();
  return app;
};
const envelopeOf = (app) => {
  const db = app.idb.inspect("hpfc.saved-scales.v1");
  const row = db.stores.find((st) => st.name === "collections").entries.find(([k]) => k === "current");
  return JSON.parse(row[1]);
};
const read = (app, record) => plain(app.get(`(() => { const r = readSavedRecord(${JSON.stringify(record)}); return { ok: r.ok, v: r.record && r.record.v, kind: r.kind, why: r.why }; })()`));

test("SE-G1: a v6 record is read exactly when angles.inner is pinned and the record is unprofiled", () => {
  const app = appBoot();
  const good = { v: 6, s: SCALE, o: PIN };
  assert.strictEqual(read(app, good).ok, true);
  assert.strictEqual(read(app, good).v, 6, "the record keeps its version");
  assert.strictEqual(read(app, { v: 6, s: SCALE, o: {} }).ok, false, "v6 with no inner pin is protected");
  assert.strictEqual(read(app, { v: 6, s: SCALE, o: { angles: { inner: [null, null] } } }).ok, false, "v6 with an all-null inner list is protected");
  assert.strictEqual(read(app, { v: 6, s: SCALE, o: { palette: 2 } }).ok, false);
  assert.strictEqual(read(app, { v: 4, s: SCALE, o: PIN }).ok, false, "a pinned cyclops is never a v4 record");
  assert.strictEqual(read(app, { v: 7, s: SCALE, o: PIN }).ok, false, "record 7 is protected");
  assert.strictEqual(read(app, { v: 9, s: SCALE, o: PIN }).ok, false, "record 9 is protected");
});

test("SE-G2: newestRecordVersion accepts record 6 whatever PROFILE_ENABLED says and refuses 8", () => {
  for (const flag of [true, false]) {
    const app = appBoot();
    app.run(`HPE.core.PROFILE_ENABLED = ${flag}`);
    assert.strictEqual(app.get("checkShareVersion(6).ok"), true, "PROFILE_ENABLED=" + flag);
    assert.strictEqual(plain(app.get("checkShareVersion(8)")).code, "NEEDS_NEWER_APP");
    assert.strictEqual(read(app, { v: 6, s: SCALE, o: PIN }).ok, true, "PROFILE_ENABLED=" + flag);
  }
});

test("SE-G3: savedCandidate stages a pinned-cyclops candidate as v6 and refuses every other pairing", () => {
  const app = appBoot();
  const stage = (text, opts, v) => plain(app.get(`(() => { const b = buildGenerated(${JSON.stringify(text)}, ${JSON.stringify(opts)});
    const rec = scaleRecord(seedOf(b.value)); if (${v} !== null) rec.v = ${v};
    const r = savedCandidate({ type: "import", candidate: { record: rec, deck: b.value } });
    return { ok: r.ok, v: r.record && r.record.v }; })()`));
  assert.deepStrictEqual(stage(SCALE, PIN, null), { ok: true, v: 6 });
  assert.deepStrictEqual(stage(SCALE, NOPIN, null), { ok: true, v: 4 }, "unpinned saves stay v4");
  assert.strictEqual(stage(SCALE, PIN, 4).ok, false, "pinned scale staged as v4");
  assert.strictEqual(stage(SCALE, NOPIN, 6).ok, false, "unpinned scale staged as v6");
});

test("SE-G4: savedMeaning appends angles.inner only when present, so unpinned meanings keep their bytes", () => {
  const app = appBoot();
  const meaning = (opts) => JSON.parse(app.get(`savedMeaning(buildGenerated(${JSON.stringify(SCALE)}, ${JSON.stringify(opts)}).value)`));
  const plainM = meaning(NOPIN), pinned = meaning(PIN), other = meaning({ angles: { inner: [130, 50] } });
  assert.strictEqual(plainM.length, 9, "an unpinned meaning is the nine-element tuple");
  assert.deepStrictEqual(pinned.slice(0, 9), plainM);
  assert.strictEqual(pinned.length, 10);
  assert.deepStrictEqual(pinned[9], [125, 55]);
  assert.notStrictEqual(JSON.stringify(pinned), JSON.stringify(other), "two scales differing only by cyclops pins are distinct");
  assert.strictEqual(JSON.stringify(meaning({ angles: { bottom: [null] } })), JSON.stringify(plainM), "an all-null list is no pin");
});

test("SE-G5: a pinned-cyclops scale saves, reloads and edits as record v6; an unpinned one stays v4", async () => {
  const origin = createOrigin({ storage: {} });
  const app = await sharedBoot(origin, HTML);
  const saved = await app.getAsync(`generateDeck(${JSON.stringify(SCALE)}, ${JSON.stringify({ ...PIN, name: "PINNED" })})`);
  assert.strictEqual(saved.ok, true, saved.reason);
  const plainSaved = await app.getAsync(`generateDeck(${JSON.stringify(SCALE.replace("D5", "E5"))}, { name: "PLAIN" })`);
  assert.strictEqual(plainSaved.ok, true);
  await settle();
  const rows = envelopeOf(app).entries;
  assert.strictEqual(rows.find((r) => r.record.o.name === "PINNED").record.v, 6);
  assert.strictEqual(rows.find((r) => r.record.o.name === "PLAIN").record.v, 4);
  const again = await sharedBoot(origin, HTML);
  assert.strictEqual(again.get("savedMode"), "durable");
  assert.strictEqual(again.get("savedEntries.size"), 2, "both rows read back");
  assert.deepStrictEqual(plain(again.get("[...savedEntries.values()].map(v => v.deck.options.angles || null).filter(Boolean)")), [{ inner: [125, 55] }]);
  const id = rows.find((r) => r.record.o.name === "PINNED").instanceId;
  const edited = await again.getAsync(`commitSaved({ type: "edit", collectionId: savedState.collectionId, instanceId: ${JSON.stringify(id)}, expectedRevision: 1,
    candidate: (() => { const b = buildGenerated(${JSON.stringify(SCALE)}, ${JSON.stringify({ angles: { inner: [130, 50] }, name: "PINNED" })});
      return savedCandidate({ type: "edit", candidate: { record: scaleRecord(seedOf(b.value)), deck: b.value } }); })() })`);
  assert.strictEqual(edited.ok, true, edited.reason || edited.why);
  await settle();
  const row = envelopeOf(again).entries.find((r) => r.instanceId === id);
  assert.strictEqual(row.record.v, 6);
  assert.deepStrictEqual(row.record.o.angles, { inner: [130, 50] });
});

test("SE-R3-3: main's frozen reader keeps a stored v6 record byte for byte through a boot and another save", async () => {
  const origin = createOrigin({ storage: {} });
  const fresh = await sharedBoot(origin, HTML);
  const saved = await fresh.getAsync(`generateDeck(${JSON.stringify(SCALE)}, ${JSON.stringify({ ...PIN, name: "PINNED" })})`);
  assert.strictEqual(saved.ok, true, saved.reason);
  await settle();
  const before = envelopeOf(fresh);
  assert.strictEqual(before.entries[0].record.v, 6);
  const snapshot = JSON.stringify(before);
  const old = await sharedBoot(origin, FROZEN);
  assert.notStrictEqual(old.get("savedMode"), "protected", "the frozen reader is not left protected by a v6 row");
  assert.strictEqual(JSON.stringify(envelopeOf(old)), snapshot, "booting main's reader wrote nothing");
  assert.strictEqual(old.get("[...savedEntries.values()].some(v => v.record.o.name === 'PINNED' && !v.opaque)"), false, "main's reader does not render the v6 row");
  old.els["deck-add"].click();
  old.type("(D3) A3 C4 D4 E4 F4 G4 A4 C5");
  old.els["scale-name"].value = "ACOUSTIC";
  old.els["scale-name"].dispatchEvent({ type: "input" });
  await old.getAsync("runGenerate()");
  await settle();
  const after = envelopeOf(old);
  assert.strictEqual(after.entries.length, 2);
  assert.deepStrictEqual(after.entries.find((e) => e.record.o.name === "PINNED"), before.entries[0], "another save never rewrites the v6 row");
});

test("SE-R4-1: moveImport keeps a row its reader cannot read as opaque bytes and never drops it", async () => {
  const origin = createOrigin({ storage: {} });
  const app = await sharedBoot(origin, HTML);
  const good = { v: 6, s: SCALE, o: { ...PIN, name: "PINNED" } };
  const future = { v: 7, s: SCALE, o: { angles: { inner: [125, 55] }, name: "FUTURE" } };
  const unnamed = { v: 9, s: "(D3) A3", o: { palette: 1 } };
  const code = Buffer.from(JSON.stringify({ r: [{ i: "a", r: good }, { i: "b", r: future }, { i: "c", r: unnamed }], h: [] })).toString("base64url");
  const res = await app.getAsync(`moveImport(${JSON.stringify(code)})`);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.imported, 3, "every row is carried");
  await settle();
  const rows = envelopeOf(app).entries.map((e) => e.record);
  assert.deepStrictEqual(rows.find((r) => r.o.name === "PINNED"), good, "the v6 row round-trips byte-equal");
  assert.deepStrictEqual(rows.find((r) => r.o.name === "FUTURE"), future, "an unreadable row is kept verbatim");
  assert.deepStrictEqual(rows.find((r) => r.v === 9), unnamed);
});

test("SE-R4-1: a v6 record round-trips byte-equal through moveUrl and moveImport", async () => {
  const from = createOrigin({ storage: {} });
  const a = await sharedBoot(from, HTML);
  const saved = await a.getAsync(`generateDeck(${JSON.stringify(SCALE)}, ${JSON.stringify({ ...PIN, name: "PINNED" })})`);
  assert.strictEqual(saved.ok, true, saved.reason);
  await settle();
  const stored = envelopeOf(a).entries[0].record;
  const url = a.get("moveUrl().url");
  const m = /#move=([A-Za-z0-9_-]+)/.exec(url);
  const code = m ? m[1] : Buffer.from(JSON.stringify({ r: [{ i: "x", r: stored }], h: [] })).toString("base64url");
  const b = await sharedBoot(createOrigin({ storage: {} }), HTML);
  const res = await b.getAsync(`moveImport(${JSON.stringify(code)})`);
  assert.strictEqual(res.ok, true);
  await settle();
  assert.deepStrictEqual(envelopeOf(b).entries[0].record, stored);
});

// ---- U2a: the editor model, its edit primitives, Undo/Redo and the flag ----
// docs/plans/2026-11-06-scale-editor-u2-split.md section 3 (U2a); the oracles are
// the golden parity fixture, the share fixtures and the engine itself.
const GOLDEN = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "engine_parity_golden_v1.json"), "utf8"));
const CORPUS = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "engine_corpus_v1.json"), "utf8"));
const js = (v) => JSON.stringify(v);
const model = (app) => (text, options) => plain(app.get(`(() => { const r = editorLoad(${js(text)}, ${js(options)}); return r; })()`));

// The suites that name index.html themselves, enumerated from the tree (not by one
// grep of a call shape). A NEW direct reader fails here, so the inventory cannot
// grow silently.
const DIRECT_READERS = [
  "tests/app.test.js", "tests/coverage_merge.test.js", "tests/e2e.test.js", "tests/e2e_sync.test.js", "tests/editor_e2e.test.js", "tests/editor_freeze.test.js", "tests/editor_shell.test.js", "tests/harness.test.js", "tests/helpers/cdp.js",
  "tests/helpers/dump_app_render.js", "tests/helpers/so_status_inventory.js", "tests/layout.test.js", "tests/link_corpus.test.js",
  "tests/mutation_harness.test.js", "tests/pdfcards.test.js", "tests/select.test.js",
  "tests/sequence.test.js", "tests/storage_corpus.test.js", "tests/swipe.test.js", "tests/sync_opaque_probe.test.js", "tests/sync_v6_v7.test.js",
];
test("U2a-F3: no suite starts reading index.html directly without joining the inventory", () => {
  const root = path.join(__dirname, "..");
  const files = [...fs.readdirSync(__dirname).filter((f) => f.endsWith(".js")).map((f) => "tests/" + f),
    ...fs.readdirSync(path.join(__dirname, "helpers")).filter((f) => f.endsWith(".js")).map((f) => "tests/helpers/" + f)];
  const named = files.filter((f) => !/editor_model\.test\.js$/.test(f) &&
    fs.readFileSync(path.join(root, f), "utf8").includes("index.html")).sort();
  assert.deepStrictEqual(named, [...DIRECT_READERS].sort());
});

const PARITY_KINDS = [];
for (const c of GOLDEN.cases) for (const k of Object.keys(c.cases || {})) PARITY_KINDS.push([c, k]);

test("U2a-P1: every golden scale loads into the model and exports byte-equal string, layout, record and link", () => {
  const app = appBoot();
  assert.ok(PARITY_KINDS.length >= 50);
  for (const [c, k] of PARITY_KINDS) {
    const g = c.cases[k];
    const got = plain(app.get(`(() => {
      const m = editorLoad(${js(c.formatSeed)}, ${js(g.options)});
      if (!m.ok) return { ok: false, code: m.code };
      const x = editorExport(m.value);
      return { ok: true, s: x.s, record: x.record, options: x.options, code: x.code,
        solve: x.solve.ok ? { ok: true, geom: x.solve.value.geom, fields: x.solve.value.fields } : { ok: false, code: x.solve.code } };
    })()`));
    const label = c.label + " " + k;
    assert.strictEqual(got.ok, true, label);
    assert.strictEqual(got.s, c.formatSeed, label);
    assert.deepStrictEqual(got.record, g.record, label + " record");
    assert.deepStrictEqual(got.solve, g.solve, label + " solve");
    assert.strictEqual(got.code, g.link.ok ? g.link.link : undefined, label + " link");
  }
});

test("U2a-P1b: every engine corpus string that parses loads into the model with the corpus fields and a stable text", () => {
  const app = appBoot();
  let n = 0;
  for (const row of CORPUS.corpus.synthetic) {
    if (!row.parse || !row.parse.ok) continue;
    n += 1;
    const got = plain(app.get(`(() => {
      const m = editorLoad(HPE.core.formatSeed(${js(row.parse.fields)}));
      return m.ok ? { fields: m.value.fields, again: editorLoad(editorExport(m.value).s).value.fields } : m;
    })()`));
    assert.deepStrictEqual(got.fields, row.parse.fields, row.name);
    assert.deepStrictEqual(got.again, row.parse.fields, row.name + " re-parse");
  }
  assert.ok(n >= 10);
});

const FIXTURE_DIR = path.join(__dirname, "fixtures", "share_links_v1");
const CAPTURE = `(code) => {
  const dec = HPE.share.decode(code);
  if (!dec.ok) return { refused: dec.code };
  const m = editorLoadShare(code);
  if (!m.ok) return { refused: m.code };
  const x = editorExport(m.value);
  return { record: x.record, direct: scaleRecord({ fields: dec.value.fields, options: dec.value.options }), code: x.code,
    string: HPE.core.formatSeed(dec.value.fields) };
}`;

test("U2a-P4: every v1-v6 share fixture loads into the model and re-exports the record the decoded seed gives", () => {
  const app = appBoot();
  let n = 0;
  for (const file of ["v1", "v2", "v3", "v4", "v5", "v6"]) {
    const fx = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file + ".json"), "utf8"));
    for (const e of fx.entries) {
      n += 1;
      const got = plain(app.get(`(${CAPTURE})(${js(e.link)})`));
      assert.strictEqual(got.refused, undefined, file + " " + e.id);
      assert.strictEqual(js(got.record), js(got.direct), file + " " + e.id);
      assert.strictEqual(got.record.s, got.string, file + " " + e.id);
    }
  }
  assert.ok(n >= 20);
});

const PROFILE_CODE = (app) => app.get(`(() => {
  const s = HPE.core.parseSeed("(D3) A3 Bb3 C4 D4 E4 F4 G4 A4").value;
  const map = HPE.core.proposeProfileMap(s.fields).map;
  const opts = { ...s.options, profile: { id: "paired", rev: 2, map } };
  const r = HPE.share.encode({ fields: s.fields, options: opts });
  return r.ok ? r.value : r;
})()`);
const PIN8 = (app) => app.get(`(() => {
  const s = HPE.core.parseSeed("[A2] [B2] [C3] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5").value;
  const opts = { ...s.options, palette: 4, angles: { inner: [125, 55], bottom: [null, 240, null] } };
  const r = HPE.share.encode({ fields: s.fields, options: opts });
  return r.ok ? r.value : r;
})()`);

test("U2a-P7: a v7 profile link and a v8 pinned-cyclops link (with at-, ai- and palette-N) round-trip through the model", () => {
  const app = appBoot();
  const v7 = PROFILE_CODE(app);
  assert.strictEqual(typeof v7, "string");
  assert.strictEqual(v7.charAt(0), "7");
  const v8 = PIN8(app);
  assert.strictEqual(typeof v8, "string");
  assert.strictEqual(v8.charAt(0), "8");
  assert.ok(/ai-/.test(v8) && /at-/.test(v8) && /palette-5/.test(v8), v8);
  for (const code of [v7, v8]) {
    const got = plain(app.get(`(${CAPTURE})(${js(code)})`));
    assert.strictEqual(got.refused, undefined, code);
    assert.strictEqual(js(got.record), js(got.direct), code);
    assert.strictEqual(got.code, code, "the link re-exports byte-equal");
  }
  const rec8 = plain(app.get(`editorExport(editorLoadShare(${js(v8)}).value).record`));
  assert.strictEqual(rec8.v, 6);
  assert.deepStrictEqual(rec8.o.angles, { inner: [125, 55], bottom: [null, 240, null] });
  assert.strictEqual(plain(app.get(`editorExport(editorLoadShare(${js(v7)}).value).record`)).v, 5);
});

test("U2a-P4b: a v10 link is refused through the existing needs-newer path", () => {
  const app = appBoot();
  const v8 = PIN8(app);
  const forged = "A" + v8.slice(1);
  const via = plain(app.get(`(() => { const a = HPE.share.decode(${js(forged)}); const b = editorLoadShare(${js(forged)}); return { a: a.code, b: b.code, ok: b.ok }; })()`));
  assert.strictEqual(via.a, "NEEDS_NEWER_APP");
  assert.strictEqual(via.b, "NEEDS_NEWER_APP");
  assert.strictEqual(via.ok, false);
  assert.strictEqual(plain(app.get(`editorLoadRecord({ v: 9, s: "(D3) A3 C4", o: {} })`)).code, "NEEDS_NEWER_APP");
});

const NOTES = (names) => names.join(" ");
const R13 = ["A3", "Bb3", "B3", "C4", "C#4", "D4", "Eb4", "E4", "F4", "F#4", "G4", "Ab4", "A4"];
const OVER = {
  "13 rim": "(C3) " + NOTES(R13),
  "7 cyclops": "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | " + NOTES(["C5", "D5", "E5", "F5", "G5", "A5", "B5"]),
  "13 bottom": "[A1] [Bb1] [B1] [C2] [C#2] [D2] [Eb2] [E2] [F2] [F#2] [G2] [Ab2] [A2] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4",
};

test("U2a-P9: an over-cap scale loads and exports unchanged; the model never trims", () => {
  const app = appBoot();
  for (const [label, text] of Object.entries(OVER)) {
    const got = plain(app.get(`(() => {
      const m = editorLoad(${js(text)});
      if (!m.ok) return { ok: false, code: m.code };
      const x = editorExport(m.value);
      const direct = HPE.core.parseSeed(${js(text)}).value;
      return { ok: true, s: x.s, again: editorLoad(x.s).value.fields, fields: direct.fields, record: x.record,
        link: x.code, linkDirect: HPE.share.encode(direct).value };
    })()`));
    assert.strictEqual(got.ok, true, label);
    assert.deepStrictEqual(got.again, got.fields, label);
    assert.strictEqual(got.link, got.linkDirect, label);
    assert.strictEqual(got.record.s, got.s, label);
  }
  const sizes = plain(app.get(`(() => { const r = ringSizes(editorLoad(${js(OVER["13 bottom"])}).value.fields); return r; })()`));
  assert.strictEqual(sizes.bottom, 13);
});

const BASE = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5";
const WITH_BOTTOM = "[A2] [B2] " + BASE;
const run = (app, body) => plain(app.get(`(() => { ${body} })()`));
const LOAD = (text, options) => `const m0 = editorLoad(${js(text)}, ${js(options)}).value;`;

test("U2a-M1: adding or removing a note resets that ring's seats to solved and keeps every other ring's (D9)", () => {
  const app = appBoot();
  const seats = { rim: [1, 0, 2, 3, 4, 5, 6, 7], inner: [1, 0] };
  const r = run(app, `${LOAD(BASE, { seats })}
    const added = editorAdd(m0, "rim", "B4");
    const removed = editorRemove(m0, "rim", 0);
    const innerAdd = editorAdd(m0, "inner", "E5");
    return { before: m0.options.seats, added: added.ok && added.value.options.seats, aNotice: added.notice,
      removed: removed.ok && removed.value.options.seats, innerAdd: innerAdd.ok && innerAdd.value.options.seats,
      size: added.ok && ringSizes(added.value.fields), solved: added.ok && editorExport(added.value).solve.ok };`);
  assert.deepStrictEqual(r.before, seats);
  assert.deepStrictEqual(r.added, { inner: [1, 0] }, "rim seats reset, inner kept");
  assert.deepStrictEqual(r.aNotice, { seatsReset: "rim" });
  assert.deepStrictEqual(r.removed, { inner: [1, 0] });
  assert.deepStrictEqual(r.innerAdd, { rim: seats.rim }, "inner seats reset, rim kept");
  assert.strictEqual(r.size.rim, 9);
  assert.strictEqual(r.solved, true);
});

test("U2a-M2: a pinned angle survives a count change; a clash the change creates unpins the newest pin (D18)", () => {
  const app = appBoot();
  const kept = run(app, `${LOAD(BASE, { angles: { inner: [150, null] } })}
    const added = editorAdd(m0, "inner", "E5");
    return { angles: added.value.options.angles, notice: added.notice };`);
  assert.deepStrictEqual(kept.angles, { inner: [150, null, null] }, "the pin stays, the newcomer is auto");
  assert.strictEqual(kept.notice, undefined);
  const clash = run(app, `${LOAD(BASE, { angles: { inner: [125, null] } })}
    const added = editorAdd(m0, "inner", "E5");
    return { ok: added.ok, angles: added.value.options.angles, notice: added.notice, solved: editorExport(added.value).solve.ok };`);
  assert.strictEqual(clash.ok, true);
  assert.strictEqual(clash.angles, undefined, "the clashing pin is gone and the empty list dropped");
  assert.deepStrictEqual(clash.notice, { unpinned: [{ ring: "inner", i: 0 }] });
  assert.strictEqual(clash.solved, true);
  const newest = run(app, `${LOAD(BASE, { angles: { inner: [150, null] } })}
    const second = editorSetAngle(m0, "inner", 1, 55);
    const added = editorAdd(second.value, "inner", "E5");
    return { ok: second.ok, pins: second.value.pins, angles: added.value.options.angles, notice: added.notice };`);
  assert.strictEqual(newest.ok, true);
  assert.deepStrictEqual(newest.notice.unpinned[0], { ring: "inner", i: 1 }, "the pin set last goes first");
  assert.deepStrictEqual(newest.angles, { inner: [150, null, null] }, "the older pin stays when removing the newest clears the clash");
});

test("U2a-M3: primitives are pure and refuse without changing the model", () => {
  const app = appBoot();
  const r = run(app, `${LOAD(WITH_BOTTOM, { angles: { bottom: [null, 240] } })}
    const snap = JSON.stringify(m0);
    const deep = (o) => { Object.freeze(o); for (const k of Object.keys(o)) if (o[k] && typeof o[k] === "object") deep(o[k]); return o; };
    deep(m0);
    const outs = [editorAdd(m0, "rim", "B4"), editorRemove(m0, "inner", 0), editorSetAngle(m0, "bottom", 0, 100),
      editorSwapSeats(m0, "rim", 0, 3), editorExchangeAngles(m0, "bottom", 0, 1), editorSetPalette(m0, 3)];
    const refused = [editorAdd(m0, "rim", "A3"), editorAdd(m0, "rim", "nope"), editorRemove(m0, "rim", 99),
      editorSetAngle(m0, "rim", 0, 100), editorSwapSeats(m0, "rim", 0, 99), editorSetPalette(m0, 11)];
    return { same: snap === JSON.stringify(m0), ok: outs.map((o) => o.ok), refused: refused.map((o) => o.ok) };`);
  assert.strictEqual(r.same, true);
  assert.deepStrictEqual(r.ok, [true, true, true, true, true, true]);
  assert.deepStrictEqual(r.refused, [false, false, false, false, false, false],
    "a duplicate, a non-note, a bad index, an angle on the rim, a seat swap off the ring and a palette outside 0-9 are refused");
});

test("U2a-M4: random add/remove/pin/swap sequences never leave an invalid seat list or angle list (property)", () => {
  const app = appBoot();
  const r = run(app, `
    let seed = 20261106; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const NAMES = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
    let m = editorLoad(${js(WITH_BOTTOM)}, { seats: { rim: [1, 0, 2, 3, 4, 5, 6, 7], inner: [1, 0] } }).value;
    const canon = (v) => (v && typeof v === "object" ? (Array.isArray(v) ? v.map(canon) : Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))) : v);
    const bad = []; let applied = 0, refused = 0, unpinned = 0, resets = 0;
    for (let step = 0; step < 400; step += 1) {
      const ring = pick(["rim", "inner", "bottom"]);
      const n = ringSizes(m.fields)[ring];
      const kind = pick(["add", "add", "remove", "pin", "swap", "xchg", "unpin"]);
      let res;
      if (kind === "add") res = editorAdd(m, ring, pick(NAMES) + (ring === "bottom" ? 2 : ring === "inner" ? 5 : 4));
      else if (kind === "remove") res = editorRemove(m, ring, Math.floor(rnd() * Math.max(n, 1)));
      else if (kind === "pin") res = editorSetAngle(m, ring, Math.floor(rnd() * Math.max(n, 1)), Math.floor(rnd() * 360));
      else if (kind === "unpin") res = editorSetAngle(m, ring, Math.floor(rnd() * Math.max(n, 1)), null);
      else if (kind === "swap") res = editorSwapSeats(m, ring, Math.floor(rnd() * Math.max(n, 1)), Math.floor(rnd() * Math.max(n, 1)));
      else res = editorExchangeAngles(m, ring, Math.floor(rnd() * Math.max(n, 1)), Math.floor(rnd() * Math.max(n, 1)));
      if (!res.ok) { refused += 1; continue; }
      applied += 1;
      if (res.notice && res.notice.unpinned) unpinned += 1;
      if (res.notice && res.notice.seatsReset) resets += 1;
      m = res.value;
      const sizes = ringSizes(m.fields);
      const o = m.options;
      for (const rg of ["rim", "inner", "bottom"]) {
        const s = o.seats && o.seats[rg];
        if (s && (s.length !== sizes[rg] || [...s].sort((a, b) => a - b).some((v, i) => v !== i))) bad.push([step, "seats", rg, s]);
        const a = o.angles && o.angles[rg];
        if (a && (a.length !== sizes[rg] || a.every((v) => v === null))) bad.push([step, "angles", rg, a]);
        if (o.angles && o.angles[rg] && o.seats && o.seats[rg] && rg !== "rim") bad.push([step, "both", rg]);
      }
      const x = editorExport(m);
      if (!x.solve.ok) bad.push([step, "solve", x.solve.code]);
      const back = editorLoadShare(x.code);
      if (!back.ok || JSON.stringify(canon(editorExport(back.value).record)) !== JSON.stringify(canon(x.record))) bad.push([step, "roundtrip"]);
    }
    return { bad: bad.slice(0, 3), applied, refused, unpinned, resets };`);
  assert.deepStrictEqual(r.bad, []);
  assert.ok(r.applied > 100 && r.refused > 0, JSON.stringify(r));
  assert.ok(r.resets > 0, "the walk reached a seat reset");
});

test("U2a-H1: every primitive undoes to the byte-equal model and Redo replays it; a new action clears Redo", () => {
  const app = appBoot();
  const r = run(app, `${LOAD(WITH_BOTTOM, { seats: { rim: [1, 0, 2, 3, 4, 5, 6, 7] }, angles: { bottom: [null, 240] } })}
    const steps = [
      (m) => editorAdd(m, "rim", "B4"), (m) => editorRemove(m, "inner", 0), (m) => editorSetAngle(m, "bottom", 0, 100),
      (m) => editorSwapSeats(m, "rim", 0, 3), (m) => editorExchangeAngles(m, "bottom", 0, 1), (m) => editorSetPalette(m, 3),
      (m) => editorAdd(m, "bottom", "C3"),
    ];
    let h = editorHistoryNew(m0);
    const states = [JSON.stringify(m0)];
    for (const step of steps) {
      const res = editorApply(h, step);
      if (!res.ok) return { failed: true };
      h = res.history;
      states.push(JSON.stringify(h.present));
    }
    const undone = [];
    for (let i = steps.length; i > 0; i -= 1) { h = editorUndo(h); undone.push(JSON.stringify(h.present) === states[i - 1]); }
    const extra = editorUndo(h);
    const redone = [];
    for (let i = 1; i <= steps.length; i += 1) { h = editorRedo(h); redone.push(JSON.stringify(h.present) === states[i]); }
    const afterRedo = editorRedo(h);
    const back = editorUndo(h);
    const branched = editorApply(back, (m) => editorSetPalette(m, 7));
    return { undone, redone, depth: states.length - 1, noop: extra === h || JSON.stringify(extra.present) === states[0],
      noRedo: afterRedo.present === h.present, cleared: branched.history.future.length, canRedo: editorCanRedo(branched.history), canUndo: editorCanUndo(h) };`);
  assert.strictEqual(r.failed, undefined);
  assert.deepStrictEqual(r.undone, [true, true, true, true, true, true, true]);
  assert.deepStrictEqual(r.redone, [true, true, true, true, true, true, true]);
  assert.strictEqual(r.noop, true, "Undo at the start stays put");
  assert.strictEqual(r.noRedo, true, "Redo at the end stays put");
  assert.strictEqual(r.cleared, 0);
  assert.strictEqual(r.canRedo, false);
  assert.strictEqual(r.canUndo, true);
});

test("U2a-H2: a refused action adds no history step and hands the history back unchanged", () => {
  const app = appBoot();
  const r = run(app, `${LOAD(BASE)}
    const h = editorHistoryNew(m0);
    const res = editorApply(h, (m) => editorAdd(m, "rim", "A3"));
    const ok = editorApply(h, (m) => editorSetPalette(m, 3));
    const again = editorApply(ok.history, (m) => editorAdd(m, "rim", "nope"));
    return { ok: res.ok, code: res.code, same: res.history === h, depth: res.history.past.length,
      again: again.history === ok.history, againDepth: again.history.past.length, canUndo: editorCanUndo(again.history) };`);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.same, true, "the refused action returns the very history it was given");
  assert.strictEqual(r.depth, 0);
  assert.strictEqual(r.again, true);
  assert.strictEqual(r.againDepth, 1, "one accepted step, none added by the refusal");
  assert.strictEqual(r.canUndo, true);
});

test("U2a-H3: an action that changes nothing adds no Undo step", () => {
  const app = appBoot();
  const r = run(app, `${LOAD(WITH_BOTTOM, { angles: { bottom: [null, 240] }, seats: { rim: [1, 0, 2, 3, 4, 5, 6, 7] } })}
    const h = editorHistoryNew(m0);
    const outs = [(m) => editorExchangeAngles(m, "bottom", 1, 1), (m) => editorSwapSeats(m, "rim", 2, 2),
      (m) => editorSwapSeats(m, "bottom", 0, 0), (m) => editorSetPalette(m, 0), (m) => editorSetAngle(m, "bottom", 1, 240)]
      .map((step) => { const res = editorApply(h, step); return { ok: res.ok, same: res.history === h, depth: res.history.past.length }; });
    const real = editorApply(h, (m) => editorSwapSeats(m, "rim", 0, 1));
    return { outs, real: real.history.past.length };`);
  for (const o of r.outs) assert.deepStrictEqual(o, { ok: true, same: true, depth: 0 });
  assert.strictEqual(r.real, 1, "a real change still adds its step");
});

// The retired sheet's own functions were the oracle. Every literal in X1-X5 below was recorded by
// running origin/main's (a4ecfc2e) swapSeats and slideNote on the same scale and options with the
// sheet's globals set, ok flag included; the live oracle is gone with the sheet, the literals stay.
const modelRun = (app, text, opts, call) => run(app, `${LOAD(text, opts)}
  const before = JSON.stringify(m0);
  const r = ${call};
  if (!r.ok) return { ok: false, code: r.code, kept: JSON.stringify(m0) === before };
  const o = r.value.options;
  return { ok: true, angles: (o.angles && o.angles.bottom) || null, seats: o.seats || null,
    inner: (o.angles && o.angles.inner) || null, link: editorExport(r.value).code,
    solved: editorExport(r.value).solve.ok, noop: JSON.stringify(r.value) === before, kept: JSON.stringify(m0) === before };`);
const BOTTOM3 = "[A2] [B2] [C3] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4";

test("U2a-X1: exchanging two bottom notes matches the recorded sheet output, pinning both", () => {
  const app = appBoot();
  const cases = [
    { opts: { angles: { bottom: [null, 240, null] } }, i: 0, j: 1, recorded: { ok: true, angles: [240, 330, null], seats: null } },
    { opts: { angles: { bottom: [null, null, 240] } }, i: 0, j: 1, recorded: { ok: true, angles: [210, 330, 240], seats: null } },
    { opts: { angles: { bottom: [60, 240, null] } }, i: 1, j: 0, recorded: { ok: true, angles: [240, 60, null], seats: null } },
  ];
  for (const c of cases) {
    const label = js(c.opts) + " " + c.i + "," + c.j;
    const want = c.recorded;
    const viaExchange = modelRun(app, BOTTOM3, c.opts, `editorExchangeAngles(m0, "bottom", ${c.i}, ${c.j})`);
    const viaSwap = modelRun(app, BOTTOM3, c.opts, `editorSwapSeats(m0, "bottom", ${c.i}, ${c.j})`);
    for (const got of [viaExchange, viaSwap]) {
      assert.strictEqual(got.ok, want.ok, label);
      assert.deepStrictEqual(got.angles, want.angles, label + " angles");
      assert.deepStrictEqual(got.seats, want.seats, label + " seats");
      assert.strictEqual(got.solved, true, label);
      assert.strictEqual(got.noop, false, label + " the exchange changed the model");
      assert.strictEqual(got.kept, true, label + " the input model is untouched");
    }
    const wantCode = "at-" + want.angles.map((a) => (a === null ? "" : a)).join(",");
    for (const got of [viaExchange, viaSwap]) assert.ok(got.link.includes(wantCode), label + " the link carries the recorded angles " + wantCode + ": " + got.link);
  }
  const first = modelRun(app, BOTTOM3, cases[0].opts, 'editorExchangeAngles(m0, "bottom", 0, 1)');
  assert.ok(first.link.includes("at-240,330,"), "the link carries both traded angles: " + first.link);
});

test("U2a-X2: an exchange the 5 degree steps cannot hold is refused and moves nothing, as the recorded sheet output is", () => {
  const app = appBoot();
  const n = 23;
  const notes = Array.from({ length: n }, (_, k) => `[${"CDEFGAB"[k % 7]}${1 + Math.floor(k / 7)}]`).join(" ");
  const text = notes + " (A3) C4 D4 E4 F4";
  const opts = { angles: { bottom: Array.from({ length: n }, (_, k) => (k === 22 ? 90 : null)) } };
  const recorded = { ok: false, angles: opts.angles.bottom, seats: null };
  for (const [a, b] of [[0, 2], [2, 0]]) {
    for (const fn of ["editorExchangeAngles", "editorSwapSeats"]) {
      const got = modelRun(app, text, opts, `${fn}(m0, "bottom", ${a}, ${b})`);
      assert.strictEqual(got.ok, recorded.ok, fn + " " + a + "," + b);
      assert.strictEqual(got.kept, true, fn + " " + a + "," + b + " moves nothing");
      const after = run(app, `${LOAD(text, opts)} ${fn}(m0, "bottom", ${a}, ${b}); return m0.options.angles.bottom;`);
      assert.deepStrictEqual(after, recorded.angles, fn + " " + a + "," + b + " the pins stay where they were");
    }
  }
});

test("U2a-X3: a seat swap matches the recorded sheet output: seats without bottom pins, the angle trade with them", () => {
  const app = appBoot();
  const cases = [
    { text: BASE, opts: {}, ring: "rim", i: 0, j: 3, recorded: { ok: true, seats: { rim: [3, 1, 2, 0, 4, 5, 6, 7] }, angles: null } },
    { text: WITH_BOTTOM, opts: { seats: { rim: [1, 0, 2, 3, 4, 5, 6, 7] } }, ring: "rim", i: 1, j: 2, recorded: { ok: true, seats: { rim: [1, 2, 0, 3, 4, 5, 6, 7] }, angles: null } },
    { text: BOTTOM3, opts: {}, ring: "bottom", i: 0, j: 2, recorded: { ok: true, seats: { bottom: [2, 1, 0] }, angles: null } },
    { text: BOTTOM3, opts: { seats: { bottom: [1, 0, 2] } }, ring: "bottom", i: 0, j: 1, recorded: { ok: true, seats: null, angles: null } },
  ];
  for (const c of cases) {
    const label = c.ring + " " + c.i + "," + c.j + " " + js(c.opts);
    const want = c.recorded;
    const got = modelRun(app, c.text, c.opts, `editorSwapSeats(m0, ${js(c.ring)}, ${c.i}, ${c.j})`);
    assert.strictEqual(got.ok, want.ok, label);
    assert.deepStrictEqual(got.seats, want.seats, label + " seats");
    assert.deepStrictEqual(got.angles, want.angles, label + " angles");
  }
  const cyclops = modelRun(app, BOTTOM3 + " | C5 D5", { angles: { inner: [125, 55] } }, 'editorSwapSeats(m0, "bottom", 0, 1)');
  assert.deepStrictEqual(cyclops.seats, { bottom: [1, 0, 2] }, "a pinned cyclops is not a bottom pin: the seats trade");
  assert.strictEqual(cyclops.angles, null);
});

test("U2a-X4: pinning a bottom note on a ring with a custom seat order matches the recorded sheet output: every note is pinned where it sits first", () => {
  const app = appBoot();
  const seated = { seats: { bottom: [1, 0, 2] } };
  const want = { ok: true, angles: [210, 330, 95], seats: null };
  const got = modelRun(app, BOTTOM3, seated, 'editorSetAngle(m0, "bottom", 2, 95)');
  assert.strictEqual(got.ok, want.ok);
  assert.deepStrictEqual(got.angles, want.angles, "the sheet's own result");
  assert.strictEqual(got.seats, want.seats, "the seat order is folded into the angles");
  assert.strictEqual(got.solved, true);
  const plainWant = { ok: true, angles: [null, 300, null], seats: null };
  const plain3 = modelRun(app, BOTTOM3, {}, 'editorSetAngle(m0, "bottom", 1, 300)');
  assert.strictEqual(plain3.ok, plainWant.ok);
  assert.deepStrictEqual(plain3.angles, plainWant.angles, "no seat order: only the one note is pinned");
  assert.strictEqual(plain3.seats, plainWant.seats);
});

test("U2a-X5: pinning a note where it already sits changes nothing, as the recorded sheet output does, unless a seat order is being folded", () => {
  const app = appBoot();
  const solvedAt = run(app, `${LOAD(BOTTOM3)}
    const s = HPE.layout.solve({ fields: m0.fields, options: m0.options }).value;
    return ringIds(s.fields, "bottom").map((id) => s.fields[id][4]);`);
  assert.deepStrictEqual(solvedAt, [330, 210, 90], "the solved angles the sheet's slideNote was recorded against");
  const want = { ok: true, angles: null, seats: null };
  const got = modelRun(app, BOTTOM3, {}, `editorSetAngle(m0, "bottom", 1, ${solvedAt[1]})`);
  assert.strictEqual(got.ok, want.ok);
  assert.strictEqual(got.noop, true);
  assert.strictEqual(got.angles, want.angles, "the sheet pins nothing");
  assert.strictEqual(got.seats, want.seats);
});

test("U2a-X6: the inner ring folds its seat order into pins the same way", () => {
  const app = appBoot();
  const inner = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5";
  const before = run(app, `${LOAD(inner, { seats: { inner: [1, 0] } })}
    const s = HPE.layout.solve({ fields: m0.fields, options: m0.options }).value;
    return ringIds(s.fields, "inner").map((id) => s.fields[id][4]);`);
  assert.deepStrictEqual(before, [52, 128]);
  const got = modelRun(app, inner, { seats: { inner: [1, 0] } }, 'editorSetAngle(m0, "inner", 0, 55)');
  assert.strictEqual(got.ok, true);
  assert.deepStrictEqual(got.inner, [55, 130], "the other cyclops note stays where it sat, on its 5 degree step");
  assert.strictEqual(got.seats, null);
  assert.strictEqual(got.solved, true);
});

test("U2a-X7: a saved v4 and a saved v6 record load into the model and re-export the same record", () => {
  const app = appBoot();
  const records = [
    { v: 4, s: WITH_BOTTOM.replace(" | C5 D5", ""), o: { palette: 3, seats: { rim: [1, 0, 2, 3, 4, 5, 6, 7] } } },
    { v: 4, s: WITH_BOTTOM.replace(" | C5 D5", ""), o: { palette: 0, angles: { bottom: [null, 240] } } },
    { v: 6, s: "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5", o: { angles: { inner: [125, 55] } } },
  ];
  for (const rec of records) {
    const label = "v" + rec.v + " " + js(rec.o);
    const got = run(app, `const rec = ${js(rec)};
      const read = readSavedRecord(rec);
      const m = editorLoadRecord(rec);
      if (!m.ok) return { ok: false, code: m.code, read: read.ok };
      const x = editorExport(m.value);
      return { ok: true, read: read.ok, v: x.record.v, s: x.record.s, o: x.record.o, solved: x.solve.ok };`);
    assert.strictEqual(got.ok, true, label);
    assert.strictEqual(got.read, true, label + " the app reads it too");
    assert.strictEqual(got.v, rec.v, label);
    assert.strictEqual(got.s, rec.s, label);
    for (const key of Object.keys(rec.o)) assert.deepStrictEqual(got.o[key], rec.o[key], label + " " + key);
    assert.strictEqual(got.solved, true, label);
  }
});

// Editor RC lane N1: the scale name. Assertions derive from docs/plans/2026-11-08-editor-panel-simplify.md
// section 5.2 (setter rules, blank restores autoName, trim, 40 cap, Neotone per Q6).
const NAMED = (app, name) => `${LOAD(SCALE, {})}
  const r = editorSetName(m0, ${js(name)});
  return { ok: r.ok, name: r.value && r.value.options.name, same: r.value === m0 };`;

test("N1-M1: editorSetName writes options.name trimmed, caps it at 40 characters, and a blank clears it", () => {
  const app = appBoot();
  assert.strictEqual(run(app, NAMED(app, "  My Kurd  ")).name, "My Kurd", "trimmed");
  assert.strictEqual(run(app, NAMED(app, "X".repeat(60))).name, "X".repeat(40), "capped at 40");
  assert.strictEqual(run(app, NAMED(app, "\u{1F3B5}".repeat(45))).name, "\u{1F3B5}".repeat(40), "the cap counts characters, not UTF-16 units");
  const blank = run(app, `${LOAD(SCALE, { name: "OLD" })}
    const r = editorSetName(m0, "   ");
    return { ok: r.ok, has: "name" in r.value.options, before: m0.options.name };`);
  assert.deepStrictEqual(blank, { ok: true, has: false, before: "OLD" }, "blank removes the key and does not touch the input model");
});

test("N1-M2: editorSetName is pure, undoable as one step, and a same-name call adds no step", () => {
  const app = appBoot();
  const r = run(app, `${LOAD(SCALE, {})}
    const h = editorHistoryNew(m0);
    const a = editorApply(h, (m) => editorSetName(m, "Alpha"));
    const b = editorApply(a.history, (m) => editorSetName(m, " Alpha "));
    const c = editorApply(a.history, (m) => editorSetName(m, ""));
    const undone = editorUndo(a.history).present;
    return { depth: a.history.past.length, sameDepth: b.history === a.history, cleared: !!c.history.present.options.name,
      undoneName: !!undone.options.name, untouched: !!m0.options.name, fields: JSON.stringify(a.history.present.fields) === JSON.stringify(m0.fields) };`);
  assert.deepStrictEqual(r, { depth: 1, sameDepth: true, cleared: false, undoneName: false, untouched: false, fields: true });
});

test("N1-M3: the name is part of the dirty check, but not of the notes line", () => {
  const app = appBoot();
  const r = run(app, `${LOAD(SCALE, {})}
    const named = editorSetName(m0, "Alpha").value;
    const back = editorSetName(named, "").value;
    return { dirty: editorIsDirty(m0, named), clean: editorIsDirty(m0, back), line: editorLineText(named) === editorLineText(m0) };`);
  assert.deepStrictEqual(r, { dirty: true, clean: false, line: true });
});

test("N1-M4: a name reaches the saved record's options, does not change its version or the notes, and survives a reload of the record", () => {
  const app = appBoot();
  const r = run(app, `${LOAD(SCALE, {})}
    const named = editorSetName(m0, "Alpha").value;
    const plainX = editorExport(m0), x = editorExport(named);
    const back = editorLoadRecord(x.record);
    return { name: x.record.o.name, v: x.record.v === plainX.record.v, s: x.record.s === plainX.record.s, noName: !!plainX.record.o.name,
      reloaded: back.ok && back.value.options.name };`);
  assert.deepStrictEqual(r, { name: "Alpha", v: true, s: true, noName: false, reloaded: "Alpha" });
});

test("N1-M5: editing the notes keeps the name", () => {
  const app = appBoot();
  const r = run(app, `${LOAD(SCALE, { name: "Alpha" })}
    const next = editorCommitText(m0, ${js(SCALE + " E5")});
    return { ok: next.ok, name: next.ok && next.value.options.name };`);
  assert.deepStrictEqual(r, { ok: true, name: "Alpha" });
});

test("N1-M6: editorAutoName is the engine's auto label on Standard, with the Neotone suffix on a profiled model, and empty for an empty model", () => {
  const app = appBoot();
  const r = run(app, `${LOAD(WITH_BOTTOM, {})}
    const plainM = editorLoad(${js(SCALE)}, {}).value;
    const profiled = (m) => ({ ...m, options: { ...m.options, profile: { id: "paired", rev: 2, map: new Array(18).fill(null) } } });
    const neo = profiled(m0), neoPlain = profiled(plainM);
    const auto = (m) => HPE.select.deckName({ fields: m.fields, options: { ...m.options, name: undefined } });
    return { empty: editorAutoName(editorEmptyModel()), std: editorAutoName(m0) === auto(m0), stdText: editorAutoName(m0),
      neo: editorAutoName(neo) === auto(neo) + " " + t("sheet.neotone_name_suffix"),
      neoPlain: editorAutoName(neoPlain) === auto(neoPlain) + " " + t("sheet.neotone_name_suffix_plain"),
      named: editorAutoName(editorSetName(neo, "Mine").value) === auto(neo) + " " + t("sheet.neotone_name_suffix") };`);
  assert.strictEqual(r.empty, "");
  assert.strictEqual(r.std, true);
  assert.ok(/\S/.test(r.stdText));
  assert.strictEqual(r.neo, true, "a Neotone scale with a bottom note reads the Mutant suffix");
  assert.strictEqual(r.neoPlain, true, "a Neotone scale with no bottom note reads the plain suffix");
  assert.strictEqual(r.named, true, "autoName ignores a typed name");
});

test("N1-M7: a profiled model keeps its name through the save options, and the pan type switch keeps a typed name", () => {
  const app = appBoot();
  const r = run(app, `${LOAD(WITH_BOTTOM, {})}
    const named = editorSetName(m0, "Mine").value;
    const neo = editorPanType(named, "neotone");
    const model = neo.ok ? neo.value : { ...named, options: { ...named.options, profile: { id: "paired", rev: 2, map: new Array(18).fill(null) } } };
    const back = editorPanType(model, "standard").value;
    return { kept: editorCommitOptions(model).name, profile: !!editorCommitOptions(model).profile, back: back.options.name };`);
  assert.deepStrictEqual(r, { kept: "Mine", profile: true, back: "Mine" });
});

const MAIN_A4 = fs.readFileSync(path.join(__dirname, "fixtures", "shipped_client_a4ecfc2e.html.txt"), "utf8");

// docs/ENGINE-SPEC.md 18.6 rule I1: a record the shipped client cannot read never owns a seeded slot.
test("SE-I1-1: readSavedRecord refuses a v6 record that carries replaces, and still reads a v6 record without it", () => {
  const app = appBoot();
  assert.strictEqual(read(app, { v: 6, s: SCALE, o: { ...PIN, replaces: "kurd" } }).ok, false);
  assert.strictEqual(read(app, { v: 6, s: SCALE, o: { ...PIN } }).ok, true);
});

test("SE-I1-2: savedCandidate refuses a pinned (v6) candidate for replace-builtin, and accepts it for save-as-separate", () => {
  const app = appBoot();
  const run = (type) => plain(app.get(`(() => { const b = buildGenerated(${JSON.stringify(SCALE)}, ${JSON.stringify(PIN)});
    const c = savedCandidate({ type: ${JSON.stringify(type)}, candidate: { record: scaleRecord(seedOf(b.value)), deck: b.value } });
    return { ok: c.ok, v: c.record && c.record.v }; })()`));
  assert.strictEqual(run("replace-builtin").ok, false);
  const sep = run("save-as-separate");
  assert.strictEqual(sep.ok, true);
  assert.strictEqual(sep.v, 6);
});

test("SE-I1-3: editorSaveCommand sends a slot owner with an unreadable (pinned or Neotone) record to save-as-separate", () => {
  const app = appBoot();
  assert.deepStrictEqual(plain(app.get(`editorSaveCommand({ selection: { kind: "saved", id: "u1" }, revision: 3 }, true, true)`)), { type: "save-as-separate" });
  assert.strictEqual(app.get(`editorSaveCommand({ selection: { kind: "saved", id: "u1" }, revision: 3 }, false, true).type`), "edit");
});

test("SE-I1-4: main a4ecfc2e writes a slot owner; the RC saves it with pinned inner angles; the owner row stays v4, the pinned save is a separate row, and a4ecfc2e is not protected", async () => {
  const origin = createOrigin({ storage: {} });
  const m = await sharedBoot(origin, MAIN_A4);
  await m.getAsync(`generateDeck(${JSON.stringify("(D3) A3 C4 D4 E4 F4 G4 A4 C5")}, { name: "ACOUSTIC" })`);
  await settle();
  const r1 = await m.getAsync(`(async () => { const b = buildGenerated(${JSON.stringify(SCALE)}, { name: "MYKURD" });
    const c = savedCandidate({ type: "replace-builtin", candidate: { record: scaleRecord(seedOf(b.value)), deck: b.value } });
    const r = await commitSaved({ type: "replace-builtin", collectionId: savedState.collectionId, seedId: DEFAULT_DECK,
      expectedSlotStateRevision: savedState.slotStateRevision, expectedOwnerId: savedState.slots[DEFAULT_DECK] || null, candidate: c });
    return { ok: r.ok }; })()`);
  assert.strictEqual(r1.ok, true);
  await settle();
  const e0 = envelopeOf(m);
  const ownerId = e0.slots[Object.keys(e0.slots)[0]];
  const ownerRow = e0.entries.find((e) => e.instanceId === ownerId);
  const rc = await sharedBoot(origin, HTML);
  const res = await rc.getAsync(`(async () => {
    const owner = savedEntries.get(${JSON.stringify(ownerId)});
    const b = buildGenerated(${JSON.stringify(SCALE)}, { angles: { inner: [125, 55] }, name: "MYKURD" });
    const base = { selection: { kind: "saved", id: ${JSON.stringify(ownerId)} }, revision: owner.revision };
    const command = editorSaveCommand(base, innerPinned(b.value.options), true);
    const candidate = { record: scaleRecord(seedOf(b.value)), deck: b.value };
    const r = await commitSaved({ ...command, collectionId: savedState.collectionId, candidate });
    return { ok: r.ok, type: command.type };
  })()`);
  await settle();
  assert.deepStrictEqual(plain(res), { ok: true, type: "save-as-separate" });
  const e1 = envelopeOf(rc);
  assert.deepStrictEqual(e1.entries.find((e) => e.instanceId === ownerId).record, ownerRow.record, "the slot owner row is untouched");
  const v6 = e1.entries.filter((e) => e.record.v === 6);
  assert.strictEqual(v6.length, 1);
  assert.strictEqual(v6[0].record.o.replaces, undefined, "the pinned row owns no slot");
  const m2 = await sharedBoot(origin, MAIN_A4);
  assert.notStrictEqual(m2.get("savedMode"), "protected", "a4ecfc2e is not protected");
  assert.ok(m2.get("savedEntries.size") > 0, "a4ecfc2e still shows saved scales");
});

test("SE-I1-5: an edit command that would turn a slot owner into a v6 row is refused", async () => {
  const origin = createOrigin({ storage: {} });
  const rc = await sharedBoot(origin, HTML);
  await rc.getAsync(`generateDeck(${JSON.stringify("(D3) A3 C4 D4 E4 F4 G4 A4 C5")}, { name: "ACOUSTIC" })`);
  await settle();
  const res = await rc.getAsync(`(async () => { const b = buildGenerated(${JSON.stringify(SCALE)}, { name: "MYKURD" });
    const c = savedCandidate({ type: "replace-builtin", candidate: { record: scaleRecord(seedOf(b.value)), deck: b.value } });
    const r = await commitSaved({ type: "replace-builtin", collectionId: savedState.collectionId, seedId: DEFAULT_DECK,
      expectedSlotStateRevision: savedState.slotStateRevision, expectedOwnerId: savedState.slots[DEFAULT_DECK] || null, candidate: c });
    const id = r.instanceId, rev = savedEntries.get(id).revision;
    const p = buildGenerated(${JSON.stringify(SCALE)}, { angles: { inner: [125, 55] }, name: "MYKURD" });
    const e = await commitSaved({ type: "edit", collectionId: savedState.collectionId, instanceId: id, expectedRevision: rev,
      candidate: { record: scaleRecord(seedOf(p.value)), deck: p.value } });
    return { placed: r.ok, ok: e.ok, v: savedEntries.get(id).record.v }; })()`);
  assert.strictEqual(res.placed, true);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.v, 4);
});

/* ---- BN (TRI-59): bottom notes stay put on add and remove ---- */
const BN_BOT = ["A2", "B2", "C3", "E3", "F3", "G3", "Bb2", "Db3", "Eb3", "Gb3", "Ab3", "B3"];
const bnText = (n) => (n ? BN_BOT.slice(0, n).map((x) => `[${x}]`).join(" ") + " " : "") + BASE;
const BN_FN = `const drawn = (m) => { const s = editorSolve(m); return s.ok ? editorAnglesOf(s, "bottom") : null; };
  const norm = (a) => ((a % 360) + 360) % 360;
  const near = (a, b) => { const d = Math.abs(norm(a - b)); return Math.min(d, 360 - d); };
  const right = (a) => norm(a - 270) < 180;
  const byName = (m) => { const names = editorNames(m, "bottom"), at = drawn(m); return Object.fromEntries(names.map((n, k) => [n, at[k]])); };
  const sameWithin = (before, after) => Object.keys(before).every((n) => after[n] !== undefined && near(before[n], after[n]) <= 2.5 + 1e-9 && right(before[n]) === right(after[n]));
  const widest = (angles) => { const s = angles.map(norm).sort((a, b) => a - b); let best = null;
    s.forEach((a, k) => { const gap = (s[(k + 1) % s.length] - a + 360) % 360 || 360; const mid = norm(a + gap / 2);
      const c = { mid, gap, d: near(mid, 270), r: right(mid) };
      if (!best || c.gap > best.gap + 1e-9 || (Math.abs(c.gap - best.gap) < 1e-9 && (c.d < best.d - 1e-9 || (Math.abs(c.d - best.d) < 1e-9 && c.r && !best.r)))) best = c; });
    return best.mid; };`;

test("BN-M1: a drop on an untouched bottom ring puts the note at the drop angle and keeps every other note where it is drawn (symmetric snap), in one model", () => {
  const app = appBoot();
  for (let n = 1; n <= 11; n += 1) {
    const r = run(app, `${BN_FN} ${LOAD(bnText(n), {})}
      const before = byName(m0);
      for (const angle of [270, 345, 15, 195, 165, 120, 60, 300, 240]) {
        const placed = editorPlaceAt(m0, "bottom", ${js(BN_BOT[n])}, angle);
        if (!placed.ok) continue;
        const after = byName(placed.value);
        return { angle, at: after[${js(BN_BOT[n])}], kept: sameWithin(before, after), size: Object.keys(after).length, stored: placed.value.options.angles.bottom.length };
      }
      return null;`);
    assert.ok(r, `n=${n} has a free drop angle`);
    assert.strictEqual(r.at, r.angle, `n=${n} the new note is where it was dropped`);
    assert.strictEqual(r.kept, true, `n=${n} the others stay within the snap`);
    assert.strictEqual(r.size, n + 1);
    assert.strictEqual(r.stored, n + 1, `n=${n} every note is stored`);
  }
});

test("BN-M2: an add with no position lands in the middle of the widest empty stretch (nearest bottom centre, right first on a tie); the others stay", () => {
  const app = appBoot();
  for (let n = 1; n <= 11; n += 1) {
    const r = run(app, `${BN_FN} ${LOAD(bnText(n), {})}
      const before = byName(m0);
      const added = editorAdd(m0, "bottom", ${js(BN_BOT[n])});
      const after = byName(added.value);
      const others = { ...after }; delete others[${js(BN_BOT[n])}];
      return { ok: added.ok, want: widest(Object.values(others)), at: after[${js(BN_BOT[n])}], kept: sameWithin(before, after), notice: added.notice };`);
    assert.strictEqual(r.ok, true, `n=${n}`);
    const gap = Math.abs(r.at - r.want);
    assert.ok(Math.min(gap, 360 - gap) <= 2.5 + 1e-9, `n=${n} lands in the middle of the widest stretch of the frozen ring (${r.want}), got ${r.at}`);
    assert.strictEqual(r.kept, true, `n=${n}`);
    assert.strictEqual(r.notice, undefined, `n=${n} the add never unpins or resets anything`);
  }
  const two = run(app, `${LOAD(bnText(2), {})} const a = editorAdd(m0, "bottom", "C3"); return a.value.options.angles;`);
  assert.deepStrictEqual(two, { bottom: [0, 180, 270] }, "the 90 and 270 midpoints tie; the one nearest bottom centre wins");
  const one = run(app, `${LOAD(bnText(1), {})} const a = editorAdd(m0, "bottom", "B2"); return a.value.options.angles;`);
  assert.deepStrictEqual(one, { bottom: [90, 270] });
});

test("BN-M3: removing a bottom note keeps every other note where it is drawn", () => {
  const app = appBoot();
  for (let n = 2; n <= 12; n += 1) {
    for (let i = 0; i < n; i += 1) {
      const r = run(app, `${BN_FN} ${LOAD(bnText(n), {})}
        const before = byName(m0);
        const removed = editorRemove(m0, "bottom", ${i});
        const after = byName(removed.value);
        delete before[editorNames(m0, "bottom")[${i}]];
        return { ok: removed.ok, kept: sameWithin(before, after), count: Object.keys(after).length, pins: removed.value.pins.filter((p) => p.ring === "bottom").length };`);
      assert.strictEqual(r.ok, true, `n=${n} i=${i}`);
      assert.strictEqual(r.kept, true, `n=${n} i=${i}`);
      assert.strictEqual(r.count, n - 1);
      assert.strictEqual(r.pins, n - 1, `n=${n} i=${i} every kept note is pinned`);
    }
  }
});

test("BN-M4: an add or remove that leaves every note on its even spot stores no bottom list and no bottom pins, and the link has no angle field", () => {
  const app = appBoot();
  const r = run(app, `${LOAD(bnText(2), {})}
    const grown = editorAdd(m0, "bottom", "C3");
    const back = editorRemove(grown.value, "bottom", 2);
    return { angles: back.value.options.angles, pins: back.value.pins, link: editorExport(back.value).code, grownLink: editorExport(grown.value).code };`);
  assert.strictEqual(r.angles, undefined);
  assert.deepStrictEqual(r.pins, []);
  assert.doesNotMatch(r.link, /at-/);
  assert.match(r.grownLink, /at-0,180,270/);
});

test("BN-M5: a drop onto a taken spot is refused as no room and leaves the model unchanged; a no-position add never refuses for room", () => {
  const app = appBoot();
  const r = run(app, `${LOAD(bnText(3), {})}
    const snap = JSON.stringify(m0);
    const clash = editorPlaceAt(m0, "bottom", "E3", 200);
    const onTop = editorPlaceAt(m0, "bottom", "E3", 90);
    return { clash: { ok: clash.ok, code: clash.code, reason: clash.reason }, onTop: onTop.ok, same: snap === JSON.stringify(m0) };`);
  assert.strictEqual(r.clash.ok, false);
  assert.strictEqual(r.clash.code, "NO_ROOM");
  assert.match(r.clash.reason, /E3 has no room at 200/);
  assert.strictEqual(r.onTop, false);
  assert.strictEqual(r.same, true);
  const crowded = run(app, `${LOAD(bnText(11), {})}
    const a = editorAdd(m0, "bottom", "B3");
    return { ok: a.ok, code: a.code, notice: a.notice, count: a.ok && a.value.options.angles.bottom.length };`);
  assert.strictEqual(crowded.ok, true, "the 12th note goes through editorSettle, which has room at the widest midpoint");
  assert.strictEqual(crowded.notice, undefined);
  assert.strictEqual(crowded.count, 12);
});

test("BN-M6: a swapped bottom ring freezes from its drawn angles with no seatsReset notice; rim seats still reset", () => {
  const app = appBoot();
  const r = run(app, `${BN_FN} ${LOAD(bnText(2), { seats: { bottom: [1, 0] } })}
    const before = byName(m0);
    const added = editorAdd(m0, "bottom", "C3");
    const rim = editorLoad(${js(bnText(2))}, { seats: { rim: [1, 0, 2, 3, 4, 5, 6, 7], bottom: [1, 0] } }).value;
    const rimAdd = editorAdd(rim, "rim", "B4");
    return { before, after: byName(added.value), notice: added.notice, seats: added.value.options.seats, rimNotice: rimAdd.notice, rimSeats: rimAdd.value.options.seats };`);
  assert.strictEqual(r.after.A2, r.before.A2);
  assert.strictEqual(r.after.B2, r.before.B2);
  assert.strictEqual(r.notice, undefined);
  assert.strictEqual(r.seats, undefined);
  assert.deepStrictEqual(r.rimNotice, { seatsReset: "rim" });
  assert.deepStrictEqual(r.rimSeats, { bottom: [1, 0] });
});

test("BN-M7: with MIRROR BOTTOM stored, an add reads the drawn (mirrored) angles and nothing moves", () => {
  const app = appBoot();
  for (let n = 1; n <= 8; n += 1) {
    const r = run(app, `${BN_FN} ${LOAD(bnText(n), { mirrorBottom: true })}
      const before = byName(m0);
      const added = editorAdd(m0, "bottom", ${js(BN_BOT[n])});
      return { ok: added.ok, kept: sameWithin(before, byName(added.value)), mirror: added.value.options.mirrorBottom };`);
    assert.strictEqual(r.ok, true, `n=${n}`);
    assert.strictEqual(r.kept, true, `n=${n} mirrored notes stay where drawn`);
    assert.strictEqual(r.mirror, true, `n=${n} the stored option is carried`);
  }
});

test("BN-M8: a Neotone model resizes as before: no bottom angles are ever stored", () => {
  const app = appBoot();
  app.run("HPE.core.PROFILE_ENABLED = true");
  const r = run(app, `const base = editorLoad(${js("(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4")}, {}).value;
    const neo = editorPanType(base, "neotone");
    if (!neo.ok) return { refused: neo.code };
    const added = editorAdd(neo.value, "bottom", "C3");
    const removed = editorRemove(neo.value, "rim", 0);
    const put = editorNeoPut(neo.value, NEO_MAIN, "A3");
    const placed = put.ok ? editorPlaceAt(put.value, "bottom", "E3", 100) : null;
    const mutantPlace = placed && placed.ok ? editorNames(placed.value, "bottom") : (placed ? placed.code : "no mutant");
    return { mutantPlace, kind: editorKindOf(neo.value), addAngles: added.ok ? added.value.options.angles : null, rmAngles: removed.ok ? removed.value.options.angles : null };`);
  assert.strictEqual(r.refused, undefined);
  assert.strictEqual(r.kind, "neotone");
  assert.strictEqual(r.addAngles === null || r.addAngles === undefined, true);
  assert.strictEqual(r.rmAngles === null || r.rmAngles === undefined, true);
  assert.deepStrictEqual(r.mutantPlace, ["E3", "A3"], "a positioned add beside a Neotone bottom mutant note takes today's path, not the freeze");
});

test("BN-M9: a typed line that only adds or removes bottom names freezes the rest (rim and cyclops pins kept, no pinsReset); a rename with no stable match and a line that changes another ring respread", () => {
  const app = appBoot();
  const commit = (text, options, typed) => run(app, `${BN_FN} ${LOAD(text, options)}
    const before = byName(m0);
    const r = editorCommitText(m0, ${js(typed)});
    return { ok: r.ok, notice: r.notice, before, after: r.ok ? byName(r.value) : null, pins: r.ok ? r.value.pins : null, angles: r.ok ? r.value.options.angles : null };`);
  const add2 = commit(bnText(2), {}, bnText(4));
  assert.strictEqual(add2.ok, true);
  assert.deepStrictEqual(add2.after, { A2: 0, B2: 180, C3: 270, E3: 90 }, "two added notes are placed one by one at the widest-stretch midpoint: 270 first, then 90");
  assert.strictEqual(add2.notice, undefined);
  const drop = commit(bnText(3), {}, bnText(3).replace("[B2] ", ""));
  assert.deepStrictEqual(drop.after, { A2: drop.before.A2, C3: drop.before.C3 }, "removing B2 keeps A2 and C3 where they are");
  const both = commit(bnText(3), {}, bnText(4).replace("[B2] ", ""));
  assert.strictEqual(both.ok, true);
  assert.strictEqual(both.after.A2, both.before.A2);
  assert.strictEqual(both.after.C3, both.before.C3);
  assert.strictEqual(Object.keys(both.after).length, 3);
  const pinned = commit(bnText(3), { angles: { inner: [150, null] } }, bnText(2));
  assert.strictEqual(pinned.ok, true);
  assert.strictEqual(pinned.notice, undefined, "a bottom-only typed edit shows no pinsReset notice");
  assert.deepStrictEqual(pinned.angles.inner, [150, null], "the cyclops pin is kept");
  assert.ok(pinned.pins.some((p) => p.ring === "inner" && p.i === 0));
  const rename = commit(bnText(3), { angles: { inner: [150, null] } }, bnText(3).replace("[B2]", "[Bb2]"));
  assert.strictEqual(rename.ok, true);
  assert.deepStrictEqual(rename.notice, { pinsReset: true }, "a rename with no stable match respreads");
  assert.strictEqual(rename.angles, undefined);
  const other = commit(bnText(3), { angles: { inner: [150, null] } }, bnText(3).replace("A4 |", "|"));
  assert.deepStrictEqual(other.notice, { pinsReset: true }, "a line that changes another ring keeps pinsReset");
  const seatsOf = (text, typed) => run(app, `${BN_FN} ${LOAD(text, {})}
    const r = editorCommitText(m0, ${js(typed)});
    return { ok: r.ok, seats: r.ok ? r.value.options.seats : null };`);
  const RIM_PITCH = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5";
  const RIM_SWAP = "(D3) Bb3 A3 C4 D4 E4 F4 G4 A4 | C5 D5";
  const swapIn = seatsOf("[A2] [B2] " + RIM_PITCH, "[A2] [B2] [C3] " + RIM_SWAP);
  assert.strictEqual(swapIn.ok, true);
  assert.deepStrictEqual(swapIn.seats && swapIn.seats.rim, [1, 0, 2, 3, 4, 5, 6, 7], "a rim swap typed with a bottom add is applied");
  const swapOut = seatsOf("[A2] [B2] " + RIM_SWAP, "[A2] [B2] [C3] " + RIM_PITCH);
  assert.strictEqual(swapOut.ok, true);
  assert.strictEqual(swapOut.seats, undefined, "typing the rim back in pitch order with a bottom add clears the swap");
});

test("BN-M10: an add to an empty bottom ring stays untouched (no position) or gives the RC's model (drop angle)", () => {
  const app = appBoot();
  const r = run(app, `${LOAD(bnText(0), {})}
    const a = editorAdd(m0, "bottom", "A2");
    const placed = editorPlaceAt(m0, "bottom", "A2", 100);
    const rc = editorSetAngle(editorAdd(m0, "bottom", "A2").value, "bottom", 0, 100, true);
    return { auto: a.value.options.angles, pins: a.value.pins, placed: placed.value.options.angles, same: JSON.stringify(placed.value) === JSON.stringify(rc.value) };`);
  assert.strictEqual(r.auto, undefined);
  assert.deepStrictEqual(r.pins, []);
  assert.deepStrictEqual(r.placed, { bottom: [100] });
  assert.strictEqual(r.same, true);
});

test("BN-M11: freezing an untouched ring keeps every U label for 1 to 12 notes, both anchors, mirror off and on; a note moves at most 2.5 degrees", () => {
  const app = appBoot();
  for (const anchor of ["one", "between"]) {
    for (const mirrorBottom of [false, true]) {
      for (let n = 1; n <= 12; n += 1) {
        const r = run(app, `${LOAD(bnText(n), { anchor, mirrorBottom })}
          const solved = editorSolve(m0);
          const labels = (s) => ringIds(s.value.fields, "bottom").map((id) => s.value.fields[id][5]);
          const angles = editorFreezeBottom(m0);
          const frozen = editorLoad(${js(bnText(n))}, { anchor: ${js(anchor)}, mirrorBottom: ${mirrorBottom}, angles: { bottom: angles } });
          const after = frozen.ok ? editorSolve(frozen.value) : null;
          const drawn = editorAnglesOf(solved, "bottom");
          const gap = (a, b) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return Math.min(d, 360 - d); };
          return { ok: !!after && after.ok, same: !!after && after.ok && JSON.stringify(labels(after)) === JSON.stringify(labels(solved)), shift: Math.max(...drawn.map((a, k) => gap(a, angles[k]))) };`);
        assert.strictEqual(r.ok, true, `${anchor} mirror=${mirrorBottom} n=${n} solves`);
        assert.strictEqual(r.same, true, `${anchor} mirror=${mirrorBottom} n=${n} keeps every label`);
        assert.ok(r.shift <= 2.5 + 1e-9, `${anchor} mirror=${mirrorBottom} n=${n} shifts ${r.shift}`);
      }
    }
  }
});
