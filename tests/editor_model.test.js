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

test("SE-G2: newestRecordVersion accepts record 6 whatever PROFILE_ENABLED says and refuses 7", () => {
  for (const flag of [true, false]) {
    const app = appBoot();
    app.run(`HPE.core.PROFILE_ENABLED = ${flag}`);
    assert.strictEqual(app.get("checkShareVersion(6).ok"), true, "PROFILE_ENABLED=" + flag);
    assert.strictEqual(plain(app.get("checkShareVersion(7)")).code, "NEEDS_NEWER_APP");
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
