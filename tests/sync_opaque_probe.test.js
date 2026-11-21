// Opaque-record probe for the sign-in release: a synced saved-scale row written by a
// NEWER build (record version 6 or 7; this release reads up to 5) must never be lost
// or rewritten by pull, push, or the deletion of a different scale. The fixture bytes
// were frozen from editor-rc-int 2971e9bb (tests/fixtures/opaque_records_v6_v7.json);
// the verdict comes from THIS tree's readSavedRecord, not the build that wrote them.
const { test, describe } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { boot: sandboxBoot, createOrigin } = require("./helpers/sandbox.js");

const boot = (options = {}) => sandboxBoot({ crypto: require("node:crypto").webcrypto, abortController: true, ...options });
const plain = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "opaque_records_v6_v7.json"), "utf8"));
const DEV = "https://handpan-cards-dev.pages.dev/";
const PROJECT = "https://cknlvnxyjwcjzzrmlhum.supabase.co";
const KEY = "hpfc.sync.v1";
const uuid = () => require("node:crypto").randomUUID();
const bytes = v => JSON.stringify(v);

const sidecar = () => JSON.stringify({ v: 1, project: PROJECT, userId: "11111111-1111-4111-8111-111111111111",
  email: "a@b.test", refresh: "r0", access: "a0", accessExp: Date.now() + 3600e3, cursor: 0,
  base: {}, alias: {}, deferredDeletes: [], localOnly: [], pending: false, first: false });

const fixture = async rows => {
  const app = boot({ origin: createOrigin(), href: DEV, locks: true, indexedDB: true, isSecureContext: true, storage: { [KEY]: sidecar() } });
  for (const id of [...fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8").matchAll(/id="(sync-[^"]+)"/g)].map(m => m[1])) {
    app.els[id] = app.sandbox.document.createElement("div"); app.els[id].id = id;
  }
  app.run(`globalThis.__requests = []; globalThis.__rows = ${JSON.stringify(rows)}; globalThis.__rev = ${rows.reduce((m, r) => Math.max(m, r.rev), 0)};
    globalThis.fetch = async function (url, opt) {
      const path = String(url).replace(${JSON.stringify(PROJECT)}, "");
      __requests.push({ path, body: opt.body ? JSON.parse(opt.body) : null });
      let response;
      if (path.startsWith("/auth/v1/token")) response = { access_token: "a1", refresh_token: "r1", expires_in: 3600 };
      else if (path.startsWith("/rest/v1/saved_scales")) response = __rows.filter(r => r.rev > Number(/rev=gt\\.(\\d+)/.exec(path)[1]));
      else if (path.endsWith("push_scales")) response = JSON.parse(opt.body).rows.map(r => {
        const rev = ++__rev, at = __rows.findIndex(x => x.scale_id === r.scale_id);
        const row = { scale_id: r.scale_id, rev, record: r.deleted ? (at >= 0 ? __rows[at].record : null) : r.record, deleted: r.deleted };
        if (at >= 0) __rows[at] = row; else __rows.push(row);
        return { scale_id: r.scale_id, rev };
      });
      else response = {};
      return { status: 200, ok: true, json: async () => response };
    };`);
  await app.waitFor("booted === true", { timeout: 2000 });
  await app.waitFor("syncHolder === true", { timeout: 2000 });
  await app.getAsync("syncRunning");
  return app;
};

const server = (app, id) => bytes(plain(app.get(`__rows.find(r => r.scale_id === ${JSON.stringify(id)})`)).record);
const serverRow = (app, id) => plain(app.get(`__rows.find(r => r.scale_id === ${JSON.stringify(id)})`));
const local = (app, id) => plain(app.get(`savedState.entries.find(e => e.instanceId === ${JSON.stringify(id)})`));
const pushedIds = app => plain(app.get('__requests.filter(r => r.path.endsWith("push_scales")).flatMap(r => r.body.rows.map(x => x.scale_id))'));
const reset = app => app.run("__requests = [];");

const setup = async version => {
  const opaque = { id: uuid(), record: FIX.records[version] }, readable = { id: uuid(), record: FIX.readableV4 };
  const app = await fixture([
    { scale_id: opaque.id, rev: 1, record: opaque.record, deleted: false },
    { scale_id: readable.id, rev: 2, record: readable.record, deleted: false }]);
  return { app, opaque, readable, frozen: bytes(opaque.record) };
};

describe("opaque record probe (sign-in release vs newer-build rows)", () => {
  test("precondition: this tree cannot read record 6 or 7 but reads the readable fixture", async () => {
    const app = boot();
    for (const v of ["v6", "v7"]) {
      assert.strictEqual(FIX.records[v].v, v === "v6" ? 6 : 7);
      assert.strictEqual(app.get(`readSavedRecord(${JSON.stringify(FIX.records[v])}).ok`), false, v);
    }
    assert.strictEqual(app.get(`readSavedRecord(${JSON.stringify(FIX.readableV4)}).ok`), true);
  });

  for (const version of ["v6", "v7"]) {
    test(`opaque record ${version} survives pull`, async () => {
      const { app, opaque, readable, frozen } = await setup(version);
      assert.ok(local(app, readable.id), "the readable sibling row is pulled in");
      const row = local(app, opaque.id);
      assert.ok(row, "the opaque row is kept locally");
      assert.strictEqual(bytes(row.record), frozen, "local copy is byte-identical");
      assert.strictEqual(server(app, opaque.id), frozen, "server bytes unchanged");
      assert.ok(!pushedIds(app).includes(opaque.id), "never pushed");
    });
  }

  test("opaque record bytes unchanged after push of another scale", async () => {
    for (const version of ["v6", "v7"]) {
      const { app, opaque, frozen } = await setup(version);
      reset(app);
      const other = uuid();
      const collectionId = app.get("savedState.collectionId");
      app.run(`globalThis.__r = commitSaved({ type: "sync-apply", collectionId: ${JSON.stringify(collectionId)},
        ops: [{ op: "insert", id: ${JSON.stringify(other)}, remoteId: null, record: ${JSON.stringify(FIX.readableV4)} }] });`);
      assert.strictEqual(await app.getAsync("__r.then(r => r.ok)"), true);
      await app.getAsync("syncKick(false)");
      assert.ok(pushedIds(app).includes(other), version + ": the other scale was pushed");
      assert.ok(!pushedIds(app).includes(opaque.id), version + ": opaque row is not in any push");
      assert.strictEqual(server(app, opaque.id), frozen, version + ": server bytes unchanged");
      assert.strictEqual(bytes(local(app, opaque.id).record), frozen, version + ": local bytes unchanged");
      assert.strictEqual(serverRow(app, opaque.id).deleted, false);
    }
  });

  test("opaque record bytes unchanged after delete of a different scale", async () => {
    for (const version of ["v6", "v7"]) {
      const { app, opaque, readable, frozen } = await setup(version);
      reset(app);
      const e = local(app, readable.id);
      app.run(`globalThis.__r = commitSaved({ type: "delete", collectionId: ${JSON.stringify(app.get("savedState.collectionId"))},
        instanceId: ${JSON.stringify(readable.id)}, expectedRevision: ${e.revision} });`);
      assert.strictEqual(await app.getAsync("__r.then(r => r.ok)"), true, version + ": delete accepted");
      await app.getAsync("syncKick(false)");
      assert.strictEqual(serverRow(app, readable.id).deleted, true, version + ": the deleted scale is tombstoned");
      assert.ok(!pushedIds(app).includes(opaque.id), version + ": opaque row is not in any push");
      assert.strictEqual(serverRow(app, opaque.id).deleted, false, version + ": opaque row is not tombstoned");
      assert.strictEqual(server(app, opaque.id), frozen, version + ": server bytes unchanged");
      assert.strictEqual(bytes(local(app, opaque.id).record), frozen, version + ": local bytes unchanged");
    }
  });

  test("opaque record is never parsed and rewritten", async () => {
    const synthetic = { ...FIX.records.v7, v: 8, zz: { future: [1, { n: null }] }, o: { ...FIX.records.v7.o, futureOption: "keep-me" } };
    const { app, opaque } = await (async () => {
      const id = uuid();
      const app = await fixture([{ scale_id: id, rev: 1, record: synthetic, deleted: false }]);
      return { app, opaque: { id } };
    })();
    const frozen = bytes(synthetic);
    assert.strictEqual(bytes(local(app, opaque.id).record), frozen, "unknown fields and key order survive the pull");
    const updated = { ...synthetic, zz: { future: [2] }, s: FIX.records.v7.s + " " };
    app.run(`__rows[0] = { scale_id: ${JSON.stringify(opaque.id)}, rev: 9, record: ${JSON.stringify(updated)}, deleted: false }; __rev = 9;`);
    await app.getAsync("syncKick(true)");
    assert.strictEqual(bytes(local(app, opaque.id).record), bytes(updated), "a newer remote body replaces it verbatim");
    app.run(`syncChanged()`);
    app.advance(2100);
    await app.getAsync("syncRunning");
    assert.ok(!pushedIds(app).includes(opaque.id), "never pushed back");
    assert.strictEqual(server(app, opaque.id), bytes(updated), "server bytes unchanged");
  });

  test("opaque record visibility reported", async () => {
    for (const version of ["v6", "v7"]) {
      const { app, opaque, readable } = await setup(version);
      const held = !!local(app, opaque.id);
      const visibleOpaque = app.get(`savedEntries.has(${JSON.stringify(opaque.id)})`);
      const visibleReadable = app.get(`savedEntries.has(${JSON.stringify(readable.id)})`);
      console.log(`opaque-visibility ${version}: stored=${held} visibleInLocalList=${visibleOpaque} (readable sibling visible=${visibleReadable})`);
      assert.strictEqual(typeof visibleOpaque, "boolean");
      assert.strictEqual(app.get("syncRunning"), null, "no sync crash");
    }
  });
});
