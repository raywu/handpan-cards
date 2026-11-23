// v6 and v7 saved-scale records through login sync (editor RC): this build READS them, so
// a v6/v7 row pulls in, pushes, tombstones and crosses devices as the exact bytes the
// editor wrote, and a v7 row stays under the server's 8192-byte record cap. Fixture bytes
// come from the editor writer (scaleRecord): v6 is generated at this head, v7 is the frozen fixture in tests/fixtures/opaque_records_v6_v7.json (its v6 entry is not readable by the editor build, so it is not used here).
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

const RECORDS = { v6: {"v":6,"s":"(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5","o":{"palette":0,"mirror":false,"mirrorBottom":false,"anchor":"one","parent":null,"angles":{"inner":[130,50]}}}, v7: FIX.records.v7 };
const V5 = { ...FIX.readableV4, v: 5 };
const addLocal = async (app, id, record) => {
  app.run(`globalThis.__r = commitSaved({ type: "sync-apply", collectionId: ${JSON.stringify(app.get("savedState.collectionId"))},
    ops: [{ op: "insert", id: ${JSON.stringify(id)}, remoteId: null, record: ${JSON.stringify(record)} }] });`);
  assert.strictEqual(await app.getAsync("__r.then(r => r.ok)"), true);
  await app.getAsync("syncKick(false)");
};

describe("v6 and v7 records through login sync", () => {
  for (const version of ["v6", "v7"]) {
    const record = RECORDS[version];

    test(`sync v6/v7: a ${version} row on the server is pulled in, visible and byte-identical`, async () => {
      const id = uuid();
      const app = await fixture([{ scale_id: id, rev: 1, record, deleted: false }]);
      assert.strictEqual(bytes(local(app, id).record), bytes(record));
      assert.strictEqual(app.get(`savedEntries.has(${JSON.stringify(id)})`), true, "readable, so shown");
      assert.strictEqual(server(app, id), bytes(record), "server bytes unchanged");
      assert.ok(!pushedIds(app).includes(id), "a pull never pushes the row back");
    });

    test(`sync v6/v7: a local ${version} scale is pushed byte-identical`, async () => {
      const app = await fixture([]);
      const id = uuid();
      await addLocal(app, id, record);
      assert.ok(pushedIds(app).includes(id), "pushed");
      assert.strictEqual(server(app, id), bytes(record));
      assert.strictEqual(serverRow(app, id).deleted, false);
    });

    test(`sync v6/v7: deleting a ${version} scale tombstones it and leaves its sibling alone`, async () => {
      const id = uuid(), sibling = uuid();
      const app = await fixture([{ scale_id: id, rev: 1, record, deleted: false },
        { scale_id: sibling, rev: 2, record: V5, deleted: false }]);
      reset(app);
      app.run(`globalThis.__r = commitSaved({ type: "delete", collectionId: ${JSON.stringify(app.get("savedState.collectionId"))},
        instanceId: ${JSON.stringify(id)}, expectedRevision: ${local(app, id).revision} });`);
      assert.strictEqual(await app.getAsync("__r.then(r => r.ok)"), true);
      await app.getAsync("syncKick(false)");
      assert.strictEqual(serverRow(app, id).deleted, true);
      assert.strictEqual(serverRow(app, sibling).deleted, false);
      assert.strictEqual(server(app, sibling), bytes(V5));
    });
  }

  test("sync v6/v7: a v5 row replaced by a v7 body on another device arrives as that v7 body", async () => {
    const id = uuid();
    const app = await fixture([{ scale_id: id, rev: 1, record: V5, deleted: false }]);
    assert.strictEqual(local(app, id).record.v, 5);
    app.run(`__rows[0] = { scale_id: ${JSON.stringify(id)}, rev: 5, record: ${JSON.stringify(FIX.records.v7)}, deleted: false }; __rev = 5;`);
    await app.getAsync("syncKick(true)");
    assert.strictEqual(bytes(local(app, id).record), bytes(FIX.records.v7));
    assert.strictEqual(app.get(`savedEntries.has(${JSON.stringify(id)})`), true);
    assert.ok(!pushedIds(app).includes(id), "the arriving body is not pushed back");
  });

  test("sync v6/v7: a v7 scale pushed from one device is pulled by a fresh device", async () => {
    const a = await fixture([]);
    const id = uuid();
    await addLocal(a, id, FIX.records.v7);
    const b = await fixture(plain(a.get("__rows")));
    assert.strictEqual(bytes(local(b, id).record), bytes(FIX.records.v7));
    assert.strictEqual(b.get(`savedEntries.has(${JSON.stringify(id)})`), true);
  });

  test("sync v6/v7: a v7 record is under the 8192-byte server cap", () => {
    for (const version of ["v6", "v7"]) {
      const size = Buffer.byteLength(bytes(RECORDS[version]));
      assert.ok(size < 8192, `${version} is ${size} bytes`);
    }
  });
});
