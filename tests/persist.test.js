// Lane P (TRI-33): the app asks for persistent storage once, after the first
// successful save, never blocks on it and never lets it change a save result.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { boot: sandboxBoot } = require("./helpers/sandbox.js");

const core = require("./helpers/engine.js").loadEngine(["core"]).core;
const entry = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "synthetic_scales.json"), "utf8"))
  .find(s => s.name === "builtin amara");
const parsed = entry.reader === "legacy" ? core.parseLegacySeed(entry.string) : null;
const SCALE = parsed && parsed.ok ? core.formatSeed(parsed.value.fields) : entry.string;

const boot = async (storage) => {
  const app = sandboxBoot({ crypto: require("node:crypto").webcrypto, abortController: true,
    indexedDB: true, broadcastChannel: true, locks: true, isSecureContext: true });
  await app.waitFor("typeof booted !== 'undefined' && booted === true", { timeout: 2000 });
  if (storage !== undefined) app.sandbox.navigator.storage = storage;
  return app;
};

test("navigator.storage absent: the save succeeds and nothing throws", async () => {
  const app = await boot();
  assert.strictEqual(app.sandbox.navigator.storage, undefined);
  const result = await app.generateAsync(SCALE);
  assert.strictEqual(result.ok, true);
});

test("navigator.storage without persist: the save succeeds", async () => {
  const app = await boot({});
  assert.strictEqual((await app.generateAsync(SCALE)).ok, true);
});

test("persist denied: asked once after the first save, the save is unaffected", async () => {
  let calls = 0;
  const app = await boot({ persist: () => { calls++; return Promise.resolve(false); } });
  assert.strictEqual(calls, 0, "no request before a save");
  const first = await app.generateAsync(SCALE);
  assert.strictEqual(first.ok, true);
  assert.strictEqual(calls, 1);
  const second = await app.generateAsync(SCALE);
  assert.strictEqual(second.ok, true);
  assert.strictEqual(calls, 1, "asked once, not per save");
});

test("persist granted: asked once after the first save", async () => {
  let calls = 0;
  const app = await boot({ persist: () => { calls++; return Promise.resolve(true); } });
  assert.strictEqual((await app.generateAsync(SCALE)).ok, true);
  assert.strictEqual(calls, 1);
});

test("persist rejecting or throwing never fails the save", async () => {
  for (const persist of [() => Promise.reject(new Error("no")), () => { throw new Error("no"); }]) {
    const app = await boot({ persist });
    assert.strictEqual((await app.generateAsync(SCALE)).ok, true);
  }
});

test("a never-settling persist does not block the save", async () => {
  const app = await boot({ persist: () => new Promise(() => {}) });
  assert.strictEqual((await app.generateAsync(SCALE)).ok, true);
});

test("a refused save does not ask for persistence", async () => {
  let calls = 0;
  const app = await boot({ persist: () => { calls++; return Promise.resolve(true); } });
  const result = await app.generateAsync("not a scale");
  assert.strictEqual(result.ok, false);
  assert.strictEqual(calls, 0);
});

// TRI-59 lane A1: a Neotone scale turned by "#1 / #2" is a record 7 (profile plus
// between) and a v9 link; the read path accepts it, nothing else, and a move
// carries the row byte for byte.
const { createOrigin } = require("./helpers/sandbox.js");
const PYGMY = "[C3] [Db3] [Eb3] (F3) G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 [Ab5]";
const settle = async () => { for (let i = 0; i < 8; i += 1) await new Promise((r) => setImmediate(r)); };
const plain = (v) => JSON.parse(JSON.stringify(v));
const sharedBoot = async (origin) => {
  const app = sandboxBoot({ origin, indexedDB: true, broadcastChannel: true, locks: true, isSecureContext: true,
    crypto: require("node:crypto").webcrypto, abortController: true });
  await app.waitFor("typeof booted !== 'undefined' && booted === true", { timeout: 3000 });
  await settle();
  return app;
};
const envelopeOf = (app) => {
  const db = app.idb.inspect("hpfc.saved-scales.v1");
  const row = db.stores.find((st) => st.name === "collections").entries.find(([k]) => k === "current");
  return JSON.parse(row[1]);
};
const profileOptions = (app, text, extra) => plain(app.get(`(() => {
  const s = HPE.core.parseSeed(${JSON.stringify(text)});
  const p = HPE.layout.proposeProfile(s.value.fields);
  return { palette: 1, ...${JSON.stringify(extra || {})}, profile: { id: "paired", rev: 2, map: p.value.map } };
})()`));

test("TRI59d record 7 is read exactly when the record is a profile carrying between", async () => {
  const app = await sharedBoot(createOrigin({ storage: {} }));
  const between = profileOptions(app, PYGMY, { anchor: "between" });
  const plainProfile = profileOptions(app, PYGMY);
  const read = (record) => plain(app.get(`(() => { const r = readSavedRecord(${JSON.stringify(record)}); return { ok: r.ok, v: r.record && r.record.v, turn: r.value && r.value.geom && r.value.geom.turn, anchor: r.value && r.value.options.anchor }; })()`));
  const good = read({ v: 7, s: PYGMY, o: between });
  assert.strictEqual(good.ok, true);
  assert.strictEqual(good.v, 7, "the record keeps its version");
  assert.strictEqual(good.turn, 20, "it draws turned");
  assert.strictEqual(good.anchor, "between");
  assert.strictEqual(read({ v: 5, s: PYGMY, o: between }).ok, false, "record 5 carrying between is not canonical, so it stays opaque");
  assert.strictEqual(read({ v: 7, s: PYGMY, o: plainProfile }).ok, false, "record 7 without between is opaque");
  assert.strictEqual(read({ v: 7, s: PYGMY, o: { palette: 1 } }).ok, false, "record 7 without a profile is opaque");
  assert.strictEqual(read({ v: 5, s: PYGMY, o: plainProfile }).ok, true, "record 5 still reads");
  assert.strictEqual(read({ v: 5, s: PYGMY, o: { ...plainProfile, anchor: "one" } }).ok, true, "anchor one is the default and canonicalises away");
  assert.strictEqual(read({ v: 8, s: PYGMY, o: between }).ok, false, "record 8 needs a newer app");
  assert.strictEqual(plain(app.get("checkShareVersion(7)")).ok, true);
  assert.strictEqual(plain(app.get("checkShareVersion(8)")).code, "NEEDS_NEWER_APP");
});

test("TRI59d savedCandidate stages a between profile as record 7 and refuses the wrong pairings", async () => {
  const app = await sharedBoot(createOrigin({ storage: {} }));
  const between = profileOptions(app, PYGMY, { anchor: "between" });
  const stage = (v, o) => plain(app.get(`(() => { const b = buildGenerated(${JSON.stringify(PYGMY)}, ${JSON.stringify(o)});
    const r = savedCandidate({ type: "import", candidate: { deck: b.value, record: { v: ${v}, s: ${JSON.stringify(PYGMY)}, o: ${JSON.stringify(o)} } } }); return { ok: r.ok }; })()`));
  assert.strictEqual(stage(7, between).ok, true);
  assert.strictEqual(stage(5, between).ok, false);
  assert.strictEqual(stage(7, profileOptions(app, PYGMY)).ok, false);
});

test("TRI59d a v9 link opened and saved writes record 7 and shares as v9 again", async () => {
  const app = await sharedBoot(createOrigin({ storage: {} }));
  const between = profileOptions(app, PYGMY, { anchor: "between" });
  const code = plain(app.get(`HPE.share.encode({ fields: HPE.core.parseSeed(${JSON.stringify(PYGMY)}).value.fields, options: ${JSON.stringify(between)} })`));
  assert.strictEqual(code.ok, true, code.reason);
  assert.strictEqual(code.value.charAt(0), "9");
  const opened = await app.getAsync(`openShare(${JSON.stringify(code.value)})`);
  assert.strictEqual(opened.ok, true, opened.reason);
  await settle();
  const row = envelopeOf(app).entries[0].record;
  assert.strictEqual(row.v, 7);
  assert.strictEqual(row.o.anchor, "between");
  assert.strictEqual(app.currentDeck().geom.turn, 20, "the opened scale draws turned");
  assert.strictEqual(plain(app.get(`shareCode(${JSON.stringify(app.currentDeck())}).value`)).charAt(0), "9");
});

test("TRI59d move carries a record 7 row", async () => {
  const a = await sharedBoot(createOrigin({ storage: {} }));
  const between = profileOptions(a, PYGMY, { anchor: "between", name: "TURNED" });
  const saved = await a.getAsync(`generateDeck(${JSON.stringify(PYGMY)}, ${JSON.stringify(between)})`);
  assert.strictEqual(saved.ok, true, saved.reason);
  await settle();
  const stored = envelopeOf(a).entries[0].record;
  assert.strictEqual(stored.v, 7);
  const m = /#move=([A-Za-z0-9_-]+)/.exec(a.get("moveUrl().url"));
  const code = m ? m[1] : Buffer.from(JSON.stringify({ r: [{ i: "x", r: stored }], h: [] })).toString("base64url");
  const b = await sharedBoot(createOrigin({ storage: {} }));
  const res = await b.getAsync(`moveImport(${JSON.stringify(code)})`);
  assert.strictEqual(res.ok, true);
  await settle();
  assert.deepStrictEqual(envelopeOf(b).entries[0].record, stored);
});
