// HPE.sync - the pure merge core for login sync (docs/plans/2026-11-05-login-sync-v2.md
// sections 8, 9 and 15; docs/ENGINE-SPEC.md section 20). No I/O: every test drives
// plain data. A tiny in-test device and server model plays out multi-device cycles.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadEngine } = require("./helpers/engine.js");

const HPE = loadEngine(["sync"]);
// The engine runs in its own node:vm realm, so returned objects carry that realm's
// prototypes and deepStrictEqual against host literals fails; normalise every return.
const normalise = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const sync = Object.fromEntries(Object.entries(HPE.sync).map(([k, v]) =>
  [k, typeof v === "function" ? (...args) => normalise(v(...args)) : v]));
const SRC = fs.readFileSync(path.join(__dirname, "..", "src", "engine", "sync.js"), "utf8");

const deepFreeze = v => {
  if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(deepFreeze); }
  return v;
};
const clone = v => JSON.parse(JSON.stringify(v));
const rec = (name, v = 5) => ({ v, n: name, s: "D3 A4" });
const describe = record => record && record.n ? { meaning: "m:" + record.n.replace(/ \(\d+\)$/, ""), deckId: "d:" + record.n.replace(/ \(\d+\)$/, ""), identity: record.s } : null;
const copyName = record => ({ ...clone(record), n: record.n + " (2)" });

let idCounter = 0;
const uid = () => "id-" + String(++idCounter).padStart(4, "0");

function makeCtx(device, extra = {}) {
  return {
    newId: uid,
    usedIds: [...device.used],
    builtinVisible: 0,
    describe,
    copyName,
    ...extra
  };
}

class Server {
  constructor() { this.rows = new Map(); this.rev = 0; this.pushes = []; }
  pull(cursor) {
    return [...this.rows.values()].filter(r => r.rev > cursor).sort((a, b) => a.rev - b.rev).map(clone);
  }
  push(rows) {
    this.pushes.push(clone(rows));
    return rows.map(r => {
      const cur = this.rows.get(r.scale_id);
      if (r.deleted && !cur) return { scale_id: r.scale_id, refused: "unknown" };
      if (r.base_rev === null ? (cur && !cur.deleted) : (!cur || cur.rev !== r.base_rev)) return { scale_id: r.scale_id, conflict: true };
      const rev = ++this.rev;
      this.rows.set(r.scale_id, { scale_id: r.scale_id, rev, deleted: r.deleted, record: r.deleted ? (cur ? cur.record : null) : clone(r.record) });
      return { scale_id: r.scale_id, rev };
    });
  }
}

class Device {
  constructor(entries = []) {
    this.entries = entries.map(e => ({ revision: 1, ...clone(e) }));
    this.used = new Set(this.entries.map(e => e.id));
    this.sidecar = sync.emptySidecar();
    this.ctxExtra = {};
    this.pulls = 0;
  }
  add(name, id = uid()) { this.entries.push({ id, revision: 1, record: rec(name) }); this.used.add(id); return id; }
  edit(id, name) { const e = this.entries.find(x => x.id === id); e.record = { ...e.record, n: name }; e.revision++; }
  del(id) { this.entries = this.entries.filter(e => e.id !== id); }
  names() { return this.entries.map(e => e.record.n).sort(); }
  find(name) { return this.entries.find(e => e.record.n === name); }
  apply(plan) {
    for (const op of plan.ops) {
      if (op.op === "insert") { this.entries.push({ id: op.id, revision: 1, record: clone(op.record) }); this.used.add(op.id); }
      else if (op.op === "overwrite") { const e = this.entries.find(x => x.id === op.id); e.record = clone(op.record); e.revision++; }
      else if (op.op === "remove") this.entries = this.entries.filter(e => e.id !== op.id);
    }
  }
  pull(server, ctxExtra = this.ctxExtra) {
    const plan = sync.planPull({ remote: server.pull(this.sidecar.cursor), local: this.entries, sidecar: this.sidecar, ctx: makeCtx(this, ctxExtra) });
    this.apply(plan);
    this.sidecar = sync.settlePull(this.sidecar, plan, this.entries.map(e => ({ id: e.id, revision: e.revision })));
    this.retryDeferred();
    return plan;
  }
  retryDeferred() {
    const plan = sync.planDeferred({ local: this.entries, sidecar: this.sidecar, ctx: makeCtx(this, this.ctxExtra) });
    this.apply(plan);
    this.sidecar = sync.settlePull(this.sidecar, plan, this.entries.map(e => ({ id: e.id, revision: e.revision })));
  }
  push(server) {
    const plan = sync.planPush({ local: this.entries, sidecar: this.sidecar, ctx: makeCtx(this, this.ctxExtra) });
    const results = plan.batches.flatMap(b => server.push(b));
    const settled = sync.settlePush(this.sidecar, plan, results);
    this.sidecar = settled.sidecar;
    return { plan, ...settled };
  }
  cycle(server) {
    let loops = 0, conflicts = 0;
    for (;;) {
      this.pull(server);
      const r = this.push(server);
      loops++;
      if (!r.conflict) return { loops, conflicts };
      conflicts++;
      assert.ok(loops < 3, "conflict loop");
    }
  }
}

test("sync: signed-out defaults and the module is pure data (no I/O, no clock)", () => {
  assert.deepEqual(sync.emptySidecar(), { v: 1, cursor: 0, base: {}, alias: {}, deferredDeletes: [], localOnly: [], pending: false });
  for (const banned of ["fetch", "XMLHttpRequest", "localStorage", "indexedDB", "document", "window", "Date", "Math.random", "crypto", "setTimeout"])
    assert.ok(!new RegExp("\\b" + banned.replace(".", "\\.") + "\\b").test(SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), banned);
});

test("sync: planning never mutates its inputs", () => {
  const dev = new Device([{ id: "a", record: rec("Alpha") }]);
  dev.sidecar = sync.emptySidecar();
  const remote = [{ scale_id: "r1", rev: 1, deleted: false, record: rec("Beta") }];
  const args = deepFreeze({ remote, local: dev.entries, sidecar: dev.sidecar, ctx: { ...makeCtx(dev), usedIds: ["a"] } });
  const plan = sync.planPull(args);
  deepFreeze(plan);
  sync.settlePull(args.sidecar, plan, [{ id: "a", revision: 1 }, { id: plan.ops[0].id, revision: 1 }]);
  sync.planPush({ local: args.local, sidecar: args.sidecar, ctx: args.ctx });
});

test("sync: a remote row with no local copy is inserted with its remote id", () => {
  const dev = new Device([{ id: "a", record: rec("Alpha") }]);
  const server = new Server();
  server.rows.set("r1", { scale_id: "r1", rev: 3, deleted: false, record: rec("Beta") });
  const plan = dev.pull(server);
  assert.equal(plan.ops.length, 1);
  assert.deepEqual({ op: plan.ops[0].op, id: plan.ops[0].id, remoteId: plan.ops[0].remoteId }, { op: "insert", id: "r1", remoteId: "r1" });
  assert.equal(dev.sidecar.cursor, 3);
  assert.deepEqual(dev.sidecar.base.r1, { rev: 3, localRevision: 1 });
});

test("sync: pull then push sends 0 rows (R1-5, base is the post-apply revision)", () => {
  const dev = new Device();
  const server = new Server();
  server.rows.set("r1", { scale_id: "r1", rev: 1, deleted: false, record: rec("Beta") });
  server.rows.set("r2", { scale_id: "r2", rev: 2, deleted: false, record: rec("Gamma") });
  dev.pull(server);
  server.rows.set("r1", { scale_id: "r1", rev: 3, deleted: false, record: rec("Beta2") });
  dev.pull(server);
  assert.deepEqual(dev.names(), ["Beta2", "Gamma"]);
  assert.equal(dev.entries.find(e => e.id === "r1").revision, 2);
  const plan = sync.planPush({ local: dev.entries, sidecar: dev.sidecar, ctx: makeCtx(dev) });
  assert.deepEqual(plan.rows, []);
  assert.deepEqual(plan.batches, []);
});

test("sync: a local edit pushes with base_rev and settles to no further rows", () => {
  const dev = new Device();
  const server = new Server();
  server.rows.set("r1", { scale_id: "r1", rev: 1, deleted: false, record: rec("Beta") });
  server.rev = 1;
  dev.pull(server);
  dev.edit("r1", "Beta!");
  const r = dev.push(server);
  assert.deepEqual(r.plan.rows, [{ scale_id: "r1", base_rev: 1, record: rec("Beta!"), deleted: false }]);
  assert.equal(dev.sidecar.base.r1.rev, 2);
  assert.deepEqual(dev.push(server).plan.rows, []);
});

test("sync: a new local scale pushes as a new row keyed by its instance id", () => {
  const dev = new Device();
  const server = new Server();
  const id = dev.add("Fresh");
  const r = dev.push(server);
  assert.deepEqual(r.plan.rows, [{ scale_id: id, base_rev: null, record: rec("Fresh"), deleted: false }]);
  assert.equal(dev.sidecar.base[id].rev, 1);
});

test("sync: a local delete pushes a tombstone and propagates to another device (D3)", () => {
  const a = new Device(), b = new Device(), server = new Server();
  const id = a.add("Keep"); a.add("Gone");
  const gone = a.find("Gone").id;
  a.cycle(server); b.cycle(server);
  assert.deepEqual(b.names(), ["Gone", "Keep"]);
  a.del(gone);
  const r = a.push(server);
  assert.deepEqual(r.plan.rows, [{ scale_id: gone, base_rev: 2, record: null, deleted: true }]);
  b.cycle(server);
  assert.deepEqual(b.names(), ["Keep"]);
  assert.ok(id);
  assert.equal(b.sidecar.base[gone], undefined);
});

test("sync: delete on both devices is a no-op for the second tombstone", () => {
  const a = new Device(), b = new Device(), server = new Server();
  a.add("Keep"); const x = a.add("X");
  a.cycle(server); b.cycle(server);
  a.del(x); b.del(x);
  a.push(server);
  b.pull(server);
  assert.deepEqual(b.push(server).plan.rows, []);
  assert.deepEqual(b.names(), ["Keep"]);
});

test("sync: a tombstone for an id the device never knew is never sent", () => {
  const dev = new Device();
  dev.sidecar = { ...sync.emptySidecar(), cursor: 5 };
  assert.deepEqual(sync.planPush({ local: [], sidecar: dev.sidecar, ctx: makeCtx(dev) }).rows, []);
});

test("sync: revival on a device that used the id gets a fresh local id plus alias and pushes to the remote id (R1-1)", () => {
  const a = new Device(), b = new Device(), server = new Server();
  a.add("Keep"); const x = a.add("Shared");
  a.cycle(server); b.cycle(server);
  b.del(x);
  a.edit(x, "Shared edited");
  a.push(server);
  const plan = b.pull(server);
  const ins = plan.ops.find(o => o.op === "insert");
  assert.ok(ins && ins.reason === "revive" && ins.remoteId === x && ins.id !== x);
  assert.equal(b.sidecar.alias[ins.id], x);
  assert.ok(b.used.has(x), "the deleted id stays used");
  assert.deepEqual(b.names(), ["Keep", "Shared edited"]);
  b.edit(ins.id, "Shared again");
  const r = b.push(server);
  assert.deepEqual(r.plan.rows.map(x2 => [x2.scale_id, x2.deleted]), [[x, false]]);
  a.cycle(server);
  assert.deepEqual(a.names(), ["Keep", "Shared again"]);
});

test("sync: revive on A, edit on B, A pulls twice -> exactly one scale on A, updated in place (R2-1)", () => {
  const a = new Device(), b = new Device(), server = new Server();
  a.add("Keep"); const x = a.add("Shared");
  a.cycle(server); b.cycle(server);
  a.del(x);
  b.edit(x, "B1");
  b.push(server);
  const first = a.pull(server);
  const revived = first.ops.find(o => o.reason === "revive");
  assert.ok(revived);
  a.push(server);
  b.edit(x, "B2");
  b.cycle(server);
  a.pull(server);
  a.pull(server);
  assert.deepEqual(a.names(), ["B2", "Keep"]);
  assert.equal(a.entries.filter(e => sync.remoteOf(a.sidecar, e.id) === x).length, 1);
  assert.equal(a.entries.find(e => e.record.n === "B2").id, revived.id);
});

test("sync: edit on A beats delete on B and no bytes are lost", () => {
  const a = new Device(), b = new Device(), server = new Server();
  a.add("Keep"); const x = a.add("Shared");
  a.cycle(server); b.cycle(server);
  b.del(x); b.push(server);
  a.edit(x, "A edit");
  a.cycle(server);
  b.cycle(server);
  assert.deepEqual(a.names(), ["A edit", "Keep"]);
  assert.deepEqual(b.names(), ["A edit", "Keep"]);
});

test("sync: remote delete vs unedited local removes it; vs edited local keeps and revives it", () => {
  const a = new Device(), b = new Device(), server = new Server();
  a.add("Keep"); const x = a.add("X"); const y = a.add("Y");
  a.cycle(server); b.cycle(server);
  a.del(x); a.del(y); a.push(server);
  b.edit(y, "Y edited");
  const plan = b.pull(server);
  assert.deepEqual(plan.ops.map(o => [o.op, o.id]), [["remove", x]]);
  assert.equal(plan.ops[0].expectedRevision, 1);
  b.push(server);
  assert.deepEqual(b.names(), ["Keep", "Y edited"]);
  a.cycle(server);
  assert.deepEqual(a.names(), ["Keep", "Y edited"]);
  assert.equal(server.rows.get(y).deleted, false);
});

test("sync: edit-vs-edit converges to exactly two scales on both devices in one pull+push cycle (R1-4)", () => {
  const a = new Device(), b = new Device(), server = new Server();
  const x = a.add("Base");
  a.cycle(server); b.cycle(server);
  a.edit(x, "Base A"); b.edit(x, "Base B");
  a.cycle(server);
  const rb = b.cycle(server);
  assert.equal(rb.conflicts, 0, "no conflict loop");
  a.cycle(server); b.cycle(server);
  assert.equal(a.names().length, 2);
  assert.deepEqual(a.names(), b.names());
  assert.deepEqual(b.entries.map(e => e.record.n).sort().map(n => n.replace(/ \(2\)$/, "")), ["Base A", "Base B"]);
  for (const d of [a, b]) {
    const again = d.push(server);
    assert.deepEqual(again.plan.rows, []);
  }
});

test("sync: edit-vs-edit with equal bodies just advances the base", () => {
  const a = new Device(), b = new Device(), server = new Server();
  const x = a.add("Base");
  a.cycle(server); b.cycle(server);
  a.edit(x, "Same"); b.edit(x, "Same");
  a.cycle(server);
  const plan = b.pull(server);
  assert.deepEqual(plan.ops, []);
  assert.deepEqual(b.push(server).plan.rows, []);
  assert.deepEqual(b.names(), ["Same"]);
});

test("sync: first sign-in meaning match adopts the remote id, no duplicate (R1-6)", () => {
  const dev = new Device([{ id: "local-1", record: { ...rec("Kurd"), s: "same" } }]);
  const server = new Server();
  server.rows.set("remote-1", { scale_id: "remote-1", rev: 4, deleted: false, record: { ...rec("Kurd"), s: "same" } });
  const plan = dev.pull(server);
  assert.deepEqual(plan.ops, []);
  assert.equal(dev.sidecar.alias["local-1"], "remote-1");
  assert.deepEqual(dev.sidecar.base["remote-1"], { rev: 4, localRevision: 1 });
  assert.deepEqual(dev.push(server).plan.rows, []);
  assert.equal(dev.entries.length, 1);
});

test("sync: meaning match with a different body treats the local copy as edited and pushes it once", () => {
  const dev = new Device([{ id: "local-1", record: { ...rec("Kurd"), s: "mine" } }]);
  const server = new Server();
  server.rows.set("remote-1", { scale_id: "remote-1", rev: 4, deleted: false, record: { ...rec("Kurd"), s: "theirs" } });
  dev.pull(server);
  const r = dev.push(server);
  assert.deepEqual(r.plan.rows.map(x => [x.scale_id, x.base_rev]), [["remote-1", 4]]);
  assert.equal(dev.entries.length, 1);
  assert.deepEqual(dev.push(server).plan.rows, []);
});

test("sync: an identity collision without a meaning match makes a renamed copy under a fresh id (R1-6)", () => {
  const ctxDescribe = record => ({ meaning: "m:" + record.n + record.s, deckId: "shared-deck", identity: "i:" + record.s });
  const dev = new Device([{ id: "local-1", record: { ...rec("Local"), s: "one" } }]);
  dev.ctxExtra = { describe: ctxDescribe };
  const server = new Server();
  server.rows.set("remote-1", { scale_id: "remote-1", rev: 2, deleted: false, record: { ...rec("Remote"), s: "two" } });
  const plan = dev.pull(server);
  const ins = plan.ops[0];
  assert.equal(ins.op, "insert");
  assert.equal(ins.reason, "collision-copy");
  assert.notEqual(ins.id, "remote-1");
  assert.equal(ins.record.n, "Remote (2)");
  assert.equal(dev.sidecar.alias[ins.id], "remote-1");
  assert.deepEqual(dev.sidecar.base["remote-1"], { rev: 2, localRevision: null });
  assert.equal(dev.entries.length, 2);
});

test("sync: a delete that would empty the device is deferred, never applied alone (R1-7)", () => {
  const dev = new Device([{ id: "x", record: rec("Only") }]);
  dev.sidecar = { ...sync.emptySidecar(), base: { x: { rev: 1, localRevision: 1 } } };
  const remote = [{ scale_id: "x", rev: 2, deleted: true, record: rec("Only") }];
  const plan = sync.planPull({ remote, local: dev.entries, sidecar: dev.sidecar, ctx: makeCtx(dev) });
  assert.deepEqual(plan.ops, []);
  const sc = sync.settlePull(dev.sidecar, plan, [{ id: "x", revision: 1 }]);
  assert.deepEqual(sc.deferredDeletes, ["x"]);
  assert.deepEqual(sync.planPush({ local: dev.entries, sidecar: sc, ctx: makeCtx(dev) }).rows, [], "never pushed as live while deferred");
  const still = sync.planDeferred({ local: dev.entries, sidecar: sc, ctx: makeCtx(dev) });
  assert.deepEqual(still.ops, []);
  const withOther = [...dev.entries, { id: "y", revision: 1, record: rec("Other") }];
  const applied = sync.planDeferred({ local: withOther, sidecar: sc, ctx: makeCtx(dev) });
  assert.deepEqual(applied.ops.map(o => [o.op, o.id]), [["remove", "x"]]);
  assert.equal(applied.ops[0].expectedRevision, 1);
  const sc2 = sync.settlePull(sc, applied, [{ id: "y", revision: 1 }]);
  assert.deepEqual(sc2.deferredDeletes, []);
  assert.equal(sc2.base.x, undefined);
});

test("sync: a deferred delete is dropped when the scale is edited meanwhile, and the edit revives the row (R1-7)", () => {
  const dev = new Device([{ id: "x", record: rec("Only") }]);
  const server = new Server();
  server.rows.set("x", { scale_id: "x", rev: 1, deleted: false, record: rec("Only") });
  dev.pull(server);
  server.rows.set("x", { scale_id: "x", rev: 2, deleted: true, record: rec("Only") });
  dev.pull(server);
  assert.deepEqual(dev.sidecar.deferredDeletes, ["x"]);
  dev.edit("x", "Only edited");
  dev.retryDeferred();
  assert.deepEqual(dev.sidecar.deferredDeletes, []);
  assert.equal(dev.entries.length, 1);
  const r = dev.push(server);
  assert.deepEqual(r.plan.rows.map(x => [x.scale_id, x.base_rev, x.deleted]), [["x", 2, false]]);
  assert.equal(server.rows.get("x").deleted, false);
});

test("sync: builtin scales count as visible for the last-visible guard", () => {
  const dev = new Device([{ id: "x", record: rec("Only") }]);
  dev.sidecar = { ...sync.emptySidecar(), base: { x: { rev: 1, localRevision: 1 } } };
  const remote = [{ scale_id: "x", rev: 2, deleted: true, record: rec("Only") }];
  const plan = sync.planPull({ remote, local: dev.entries, sidecar: dev.sidecar, ctx: makeCtx(dev, { builtinVisible: 1 }) });
  assert.deepEqual(plan.ops.map(o => o.op), ["remove"]);
  assert.equal(plan.ops[0].expectedRevision, 1);
});

test("sync: localOnly entries are never in a push plan or a delete (R1-8)", () => {
  const dev = new Device([{ id: "l1", record: rec("Mine") }, { id: "l2", record: rec("Also") }]);
  dev.sidecar = { ...sync.emptySidecar(), localOnly: ["l1"] };
  const plan = sync.planPush({ local: dev.entries, sidecar: dev.sidecar, ctx: makeCtx(dev) });
  assert.deepEqual(plan.rows.map(r => r.scale_id), ["l2"]);
  const gone = sync.planPush({ local: [dev.entries[1]], sidecar: dev.sidecar, ctx: makeCtx(dev) });
  assert.ok(gone.rows.every(r => !r.deleted), "deleting a localOnly scale sends nothing");
  const server = new Server();
  server.rows.set("r1", { scale_id: "r1", rev: 1, deleted: true, record: rec("Mine") });
  const pulled = sync.planPull({ remote: server.pull(0), local: dev.entries, sidecar: dev.sidecar, ctx: makeCtx(dev) });
  assert.deepEqual(pulled.ops, []);
});

test("sync: a localOnly scale is not matched by meaning to a remote row", () => {
  const dev = new Device([{ id: "l1", record: rec("Kurd") }]);
  dev.sidecar = { ...sync.emptySidecar(), localOnly: ["l1"] };
  const remote = [{ scale_id: "r1", rev: 1, deleted: false, record: rec("Kurd") }];
  const plan = sync.planPull({ remote, local: dev.entries, sidecar: dev.sidecar, ctx: makeCtx(dev) });
  assert.equal(plan.ops.length, 1);
  assert.equal(plan.ops[0].op, "insert");
  assert.equal(plan.ops[0].remoteId, "r1");
  assert.deepEqual(plan.alias, {});
});

test("sync: first-sync audit counts only scales unmatched after matching; re-sign-in to the same account gives N=0 (R3-6)", () => {
  const server = new Server();
  const a = new Device();
  a.add("One"); a.add("Two");
  a.sidecar = sync.emptySidecar();
  a.cycle(server);
  const reSign = new Device(a.entries.map(e => ({ id: e.id, record: e.record, revision: e.revision + 3 })));
  reSign.cycle(server);
  const audit = sync.firstSyncAudit({ local: reSign.entries, sidecar: reSign.sidecar });
  assert.deepEqual(audit.ids, []);
  assert.equal(server.rows.size, 2);

  const dev = new Device([{ id: "l1", record: rec("Mine") }, { id: "l2", record: rec("Kurd") }]);
  server.rows.set("r1", { scale_id: "r1", rev: 9, deleted: false, record: rec("Kurd") });
  dev.pull(server);
  const held = sync.firstSyncAudit({ local: dev.entries, sidecar: dev.sidecar });
  assert.deepEqual(held.ids, ["l1"]);
  assert.deepEqual(held.sidecar.localOnly, ["l1"]);
  const rows = sync.planPush({ local: dev.entries, sidecar: held.sidecar, ctx: makeCtx(dev) }).rows;
  assert.deepEqual(rows, [], "held scales wait for the prompt");
  const released = sync.releaseLocal(held.sidecar, ["l1"]);
  assert.deepEqual(released.localOnly, []);
  assert.deepEqual(sync.planPush({ local: dev.entries, sidecar: released, ctx: makeCtx(dev) }).rows.map(r => r.scale_id), ["l1"]);
});

test("sync: pendingLocalIds lists localOnly scales that still exist", () => {
  const sc = { ...sync.emptySidecar(), localOnly: ["a", "gone"] };
  assert.deepEqual(sync.pendingLocalIds({ local: [{ id: "a", revision: 1, record: {} }], sidecar: sc }), ["a"]);
});

test("sync: a RECORD_VERSION bump keeps identity (id-keyed, never content-keyed)", () => {
  const dev = new Device();
  const server = new Server();
  server.rows.set("r1", { scale_id: "r1", rev: 1, deleted: false, record: rec("Beta", 5) });
  dev.pull(server);
  server.rows.set("r1", { scale_id: "r1", rev: 2, deleted: false, record: { ...rec("Beta", 6), extra: true } });
  const planned = dev.entries[0].revision;
  const plan = dev.pull(server);
  assert.deepEqual(plan.ops.map(o => [o.op, o.id]), [["overwrite", "r1"]]);
  assert.equal(plan.ops[0].expectedRevision, planned);
  assert.equal(dev.entries.length, 1);
  assert.deepEqual(dev.push(server).plan.rows, []);
});

test("sync: an unreadable remote record is applied opaque and never pushed back rewritten", () => {
  const dev = new Device();
  const readable = record => record.v <= 5;
  dev.ctxExtra = { readable };
  const server = new Server();
  server.rows.set("r1", { scale_id: "r1", rev: 1, deleted: false, record: rec("Future", 9) });
  const plan = dev.pull(server);
  assert.equal(plan.ops[0].opaque, true);
  assert.deepEqual(dev.push(server).plan.rows, []);
  const local = [{ id: "z", revision: 1, record: rec("Future2", 9) }];
  assert.deepEqual(sync.planPush({ local, sidecar: sync.emptySidecar(), ctx: makeCtx(dev, { readable }) }).rows, []);
});

const bump = (dev, id, name, v) => { const e = dev.entries.find(x => x.id === id); e.record = { ...e.record, n: name, v }; e.revision++; };
const serverNames = server => [...server.rows.values()].filter(r => !r.deleted).map(r => r.record.n).sort();

test("sync: edit-vs-edit with an unreadable remote keeps both bodies on the server and on the newer build, no loop", () => {
  const server = new Server();
  const a = new Device(), b = new Device();
  a.ctxExtra = { readable: record => record.v <= 5 };
  const x = a.add("Base");
  a.cycle(server); b.cycle(server);
  bump(b, x, "B edit", 9);
  b.cycle(server);
  a.edit(x, "A edit");
  a.cycle(server); b.cycle(server); a.cycle(server); b.cycle(server);
  assert.deepEqual(serverNames(server), ["A edit", "B edit"]);
  assert.deepEqual(b.names(), ["A edit", "B edit"]);
  assert.equal(b.find("B edit").id, x);
  assert.equal(server.rows.get(x).record.v, 9);
  assert.deepEqual(a.push(server).plan.rows, []);
  assert.deepEqual(b.push(server).plan.rows, []);
});

test("sync: no-base same-id divergence with an unreadable remote keeps both bodies on the server and on the newer build, no loop", () => {
  const server = new Server();
  const b = new Device(), a = new Device([{ id: "x", record: rec("A edit") }]);
  a.ctxExtra = { readable: record => record.v <= 5 };
  server.rows.set("x", { scale_id: "x", rev: 1, deleted: false, record: rec("B edit", 9) });
  server.rev = 1;
  b.cycle(server);
  a.cycle(server); b.cycle(server); a.cycle(server); b.cycle(server);
  assert.deepEqual(serverNames(server), ["A edit", "B edit"]);
  assert.deepEqual(b.names(), ["A edit", "B edit"]);
  assert.equal(server.rows.get("x").record.v, 9);
  assert.deepEqual(a.push(server).plan.rows, []);
  assert.deepEqual(b.push(server).plan.rows, []);
});

test("sync: a deferred delete with no base is kept as committed and is never pushed live", () => {
  const dev = new Device([{ id: "x", record: rec("Only") }]);
  const server = new Server();
  server.rows.set("x", { scale_id: "x", rev: 2, deleted: true, record: rec("Only") });
  const plan = dev.pull(server);
  assert.deepEqual(plan.ops, []);
  assert.deepEqual(dev.sidecar.deferredDeletes, ["x"]);
  assert.equal(dev.sidecar.base.x.localRevision, dev.entries[0].revision);
  assert.deepEqual(dev.push(server).plan.rows, []);
});

test("sync: a localOnly entry is never removed or overwritten by a remote row with its id", () => {
  const dev = new Device([{ id: "x", record: rec("Mine") }, { id: "y", record: rec("Other") }]);
  dev.sidecar = { ...sync.emptySidecar(), localOnly: ["x"] };
  const tomb = [{ scale_id: "x", rev: 1, deleted: true, record: rec("Mine") }];
  const t = sync.planPull({ remote: tomb, local: dev.entries, sidecar: dev.sidecar, ctx: makeCtx(dev) });
  assert.deepEqual(t.ops, []);
  assert.deepEqual(t.baseUpdates, []);
  const live = [{ scale_id: "x", rev: 1, deleted: false, record: rec("Theirs") }];
  const l = sync.planPull({ remote: live, local: dev.entries, sidecar: dev.sidecar, ctx: makeCtx(dev) });
  assert.deepEqual(l.ops, []);
  assert.deepEqual(l.baseUpdates, []);
});

test("sync: a local scale with no base whose id is also a remote row is not adopted by another remote row of the same meaning", () => {
  const dev = new Device([{ id: "x", record: rec("Kurd") }]);
  const remote = [
    { scale_id: "r1", rev: 1, deleted: false, record: rec("Kurd") },
    { scale_id: "x", rev: 2, deleted: false, record: rec("Kurd") }
  ];
  const plan = sync.planPull({ remote, local: dev.entries, sidecar: dev.sidecar, ctx: makeCtx(dev) });
  assert.deepEqual(plan.alias, {});
  assert.deepEqual(plan.ops.map(o => [o.op, o.id]), [["insert", "r1"]]);
});

test("sync: replaces is dropped when the seed slot is held or hidden locally", () => {
  const dev = new Device();
  const taken = new Set(["seed-a"]);
  dev.ctxExtra = { slotTaken: seed => taken.has(seed) };
  const server = new Server();
  server.rows.set("r1", { scale_id: "r1", rev: 1, deleted: false, record: { ...rec("A"), o: { replaces: "seed-a", palette: 2 } } });
  server.rows.set("r2", { scale_id: "r2", rev: 2, deleted: false, record: { ...rec("B"), o: { replaces: "seed-b" } } });
  const plan = dev.pull(server);
  assert.deepEqual(plan.ops[0].record.o, { palette: 2 });
  assert.deepEqual(plan.ops[1].record.o, { replaces: "seed-b" });
});

test("sync: two replaces claims on one seed in the same pull keep only the first", () => {
  const dev = new Device();
  dev.ctxExtra = { slotTaken: () => false };
  const server = new Server();
  server.rows.set("r1", { scale_id: "r1", rev: 1, deleted: false, record: { ...rec("A"), o: { replaces: "s" } } });
  server.rows.set("r2", { scale_id: "r2", rev: 2, deleted: false, record: { ...rec("B"), o: { replaces: "s" } } });
  const plan = dev.pull(server);
  assert.deepEqual([plan.ops[0].record.o, plan.ops[1].record.o], [{ replaces: "s" }, {}]);
});

test("sync: sidecar lost but scales kept: a remote tombstone applies only when bodies are equal; otherwise the local copy revives it (F22)", () => {
  const server = new Server();
  server.rows.set("same", { scale_id: "same", rev: 3, deleted: true, record: rec("Same") });
  server.rows.set("diff", { scale_id: "diff", rev: 4, deleted: true, record: rec("Diff") });
  server.rows.set("purged", { scale_id: "purged", rev: 5, deleted: true, record: null });
  const dev = new Device([
    { id: "same", record: rec("Same") }, { id: "diff", record: rec("Diff changed") },
    { id: "purged", record: rec("Purged") }, { id: "keep", record: rec("Keep") }
  ]);
  const plan = dev.pull(server);
  assert.deepEqual(plan.ops.map(o => [o.op, o.id]), [["remove", "same"]]);
  assert.deepEqual(dev.names(), ["Diff changed", "Keep", "Purged"]);
  const r = dev.push(server);
  assert.deepEqual(r.plan.rows.map(x => [x.scale_id, x.base_rev]).sort(), [["diff", 4], ["keep", null], ["purged", 5]]);
  assert.equal(server.rows.get("diff").deleted, false);
});

test("sync: sidecar lost with a live remote of the same id and a different body keeps both bodies, local at the remote rev, remote as a conflict copy", () => {
  const server = new Server();
  server.rows.set("x", { scale_id: "x", rev: 2, deleted: false, record: rec("Theirs") });
  const dev = new Device([{ id: "x", record: rec("Mine") }]);
  const plan = dev.pull(server);
  assert.deepEqual(plan.ops.map(o => [o.op, o.reason]), [["insert", "conflict-copy"]]);
  assert.deepEqual(dev.names(), ["Mine", "Theirs (2)"]);
  assert.deepEqual(dev.sidecar.base.x, { rev: 2, localRevision: null });
  const rows = dev.push(server).plan.rows;
  assert.deepEqual(rows.map(r => r.base_rev).sort(), [2, null]);
  assert.equal(server.rows.get("x").record.n, "Mine");
});

test("sync: re-sign-in after the other device edited meanwhile keeps both bodies on both devices with no conflict loop", () => {
  const server = new Server();
  const a = new Device([{ id: "x", record: rec("Orig") }]);
  const b = new Device([{ id: "x", record: rec("Orig") }]);
  a.cycle(server); b.cycle(server);
  a.sidecar = sync.emptySidecar();
  b.edit("x", "Edited on B");
  b.cycle(server);
  const r = a.cycle(server);
  assert.equal(r.conflicts, 0);
  b.cycle(server); a.cycle(server);
  assert.ok(a.names().includes("Orig") && a.names().some(n => n.startsWith("Edited on B")));
  assert.equal(a.entries.length, 2);
  assert.equal(b.entries.length, 2);
  assert.deepEqual(a.names(), b.names());
  assert.deepEqual(a.push(server).plan.rows, []);
  assert.deepEqual(b.push(server).plan.rows, []);
});

test("sync: rows pushed in batches of at most 200", () => {
  const dev = new Device();
  for (let i = 0; i < 450; i++) dev.add("S" + i);
  const plan = sync.planPush({ local: dev.entries, sidecar: sync.emptySidecar(), ctx: makeCtx(dev) });
  assert.equal(sync.MAX_ROWS_PER_PUSH, 200);
  assert.equal(plan.rows.length, 450);
  assert.deepEqual(plan.batches.map(b => b.length), [200, 200, 50]);
});

test("sync: settlePush records refusals and conflicts without touching base, and a refused unknown tombstone drops its base", () => {
  const dev = new Device([{ id: "a", record: rec("A") }]);
  dev.sidecar = { ...sync.emptySidecar(), base: { a: { rev: 1, localRevision: 0 }, gone: { rev: 2, localRevision: 1 } } };
  const plan = sync.planPush({ local: dev.entries, sidecar: dev.sidecar, ctx: makeCtx(dev) });
  assert.deepEqual(plan.rows.map(r => r.scale_id).sort(), ["a", "gone"]);
  const out = sync.settlePush(dev.sidecar, plan, [{ scale_id: "a", refused: "cap" }, { scale_id: "gone", refused: "unknown" }]);
  assert.deepEqual(out.refused, [{ scale_id: "a", refused: "cap" }, { scale_id: "gone", refused: "unknown" }]);
  assert.equal(out.sidecar.base.gone, undefined);
  assert.deepEqual(out.sidecar.base.a, { rev: 1, localRevision: 0 });
  assert.equal(out.sidecar.pending, true);
  const conflict = sync.settlePush(dev.sidecar, plan, [{ scale_id: "a", conflict: true }]);
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.sidecar.pending, true);
});

test("sync: the cursor advances to the highest rev seen and never goes back", () => {
  const dev = new Device();
  dev.sidecar = { ...sync.emptySidecar(), cursor: 10 };
  const plan = sync.planPull({ remote: [{ scale_id: "r", rev: 7, deleted: true, record: null }], local: [], sidecar: dev.sidecar, ctx: makeCtx(dev) });
  assert.equal(plan.cursor, 10);
  const plan2 = sync.planPull({ remote: [{ scale_id: "r", rev: 12, deleted: true, record: null }], local: [], sidecar: dev.sidecar, ctx: makeCtx(dev) });
  assert.equal(plan2.cursor, 12);
});

test("sync: a remote tombstone with no local copy changes nothing and drops a stale base", () => {
  const dev = new Device();
  dev.sidecar = { ...sync.emptySidecar(), base: { r: { rev: 1, localRevision: 1 } } };
  const plan = sync.planPull({ remote: [{ scale_id: "r", rev: 2, deleted: true, record: null }], local: [], sidecar: dev.sidecar, ctx: makeCtx(dev) });
  assert.deepEqual(plan.ops, []);
  assert.equal(sync.settlePull(dev.sidecar, plan, []).base.r, undefined);
});

test("sync: a local delete not yet pushed is kept deleted when the remote row has not moved", () => {
  const dev = new Device();
  dev.sidecar = { ...sync.emptySidecar(), base: { r: { rev: 3, localRevision: 1 } } };
  const plan = sync.planPull({ remote: [{ scale_id: "r", rev: 3, deleted: false, record: rec("R") }], local: [], sidecar: dev.sidecar, ctx: makeCtx(dev) });
  assert.deepEqual(plan.ops, []);
  assert.deepEqual(sync.planPush({ local: [], sidecar: dev.sidecar, ctx: makeCtx(dev) }).rows, [{ scale_id: "r", base_rev: 3, record: null, deleted: true }]);
});

test("sync: three devices converge after edits, deletes and adds (smoke)", () => {
  const server = new Server();
  const [a, b, c] = [new Device(), new Device(), new Device()];
  const ids = ["One", "Two", "Three"].map(n => a.add(n));
  a.cycle(server); b.cycle(server); c.cycle(server);
  a.edit(ids[0], "One a");
  b.del(ids[1]);
  c.add("Four");
  for (let i = 0; i < 2; i++) for (const d of [a, b, c]) d.cycle(server);
  assert.deepEqual(a.names(), b.names());
  assert.deepEqual(b.names(), c.names());
  assert.deepEqual(a.names(), ["Four", "One a", "Three"]);
});

const hold = dev => { dev.sidecar = sync.firstSyncAudit({ local: dev.entries, sidecar: dev.sidecar }).sidecar; };
const release = dev => { dev.sidecar = sync.releaseLocal(dev.sidecar, dev.sidecar.localOnly); };

test("sync: a localOnly scale released after the account gained the same id converges with both bodies and no conflict loop", () => {
  const server = new Server();
  const a = new Device([{ id: "x", record: rec("Mine A") }]), b = new Device([{ id: "x", record: rec("Mine B") }]);
  hold(a);
  b.cycle(server);
  a.pull(server);
  a.edit("x", "Mine A edited");
  release(a);
  assert.ok(a.cycle(server).loops <= 2);
  b.cycle(server); a.cycle(server);
  assert.deepEqual(serverNames(server), ["Mine A edited", "Mine B (2)"]);
  assert.deepEqual(a.names(), ["Mine A edited", "Mine B (2)"]);
  assert.deepEqual(b.names(), ["Mine A edited", "Mine B (2)"]);
  assert.equal(a.sidecar.pending, false);
});

test("sync: a held localOnly row does not move the cursor past it; rows before it do", () => {
  const dev = new Device([{ id: "x", record: rec("Mine") }]);
  dev.sidecar = { ...sync.emptySidecar(), localOnly: ["x"] };
  const remote = [
    { scale_id: "r1", rev: 1, deleted: false, record: rec("One") },
    { scale_id: "x", rev: 2, deleted: false, record: rec("Theirs") },
    { scale_id: "r3", rev: 3, deleted: false, record: rec("Three") }
  ];
  const plan = sync.planPull({ remote, local: dev.entries, sidecar: dev.sidecar, ctx: makeCtx(dev) });
  assert.equal(plan.cursor, 1);
  assert.deepEqual(plan.ops.map(o => o.id).sort(), ["r1", "r3"]);
  const free = sync.planPull({ remote, local: dev.entries, sidecar: sync.emptySidecar(), ctx: makeCtx(dev) });
  assert.equal(free.cursor, 3);
});

test("sync: a localOnly scale deleted before release still receives the account's row", () => {
  const server = new Server();
  const a = new Device([{ id: "x", record: rec("Theirs") }]), b = new Device([{ id: "x", record: rec("Mine") }]);
  a.cycle(server);
  hold(b);
  b.cycle(server);
  b.del("x");
  release(b);
  b.cycle(server);
  assert.deepEqual(b.names(), ["Theirs"]);
});

test("sync: an unreadable revived scale is matched by body after a sign-out and sign-in, no duplicate", () => {
  const server = new Server();
  const a = new Device(), b = new Device();
  a.ctxExtra = { readable: record => record.v <= 5 };
  const x = a.add("Base");
  a.cycle(server); b.cycle(server);
  a.del(x);
  bump(b, x, "B v6", 6);
  b.cycle(server);
  a.cycle(server);
  assert.equal(a.entries.length, 1);
  a.sidecar = sync.emptySidecar();
  a.cycle(server);
  assert.equal(a.entries.length, 1);
  assert.deepEqual(a.names(), ["B v6"]);
  assert.deepEqual(serverNames(server), ["B v6"]);
});

test("sync: bounded two-device model holds no-loss, convergence and no endless conflict (depth 3)", () => {
  const strip = n => n.replace(/( \(\d+\))+$/, "");
  const modelDescribe = r => r && r.n ? { meaning: "m:" + strip(r.n), deckId: "d:" + strip(r.n), identity: r.s } : null;
  const modelCopy = r => ({ ...clone(r), n: r.n + " (2)" });
  let idc = 0;
  const mid = () => "id-" + (++idc);
  const world = { parent: new Map(), deleted: new Set() };
  class Dev {
    constructor(tag, entries, old) { this.tag = tag; this.entries = clone(entries); this.used = new Set(entries.map(e => e.id)); this.sc = sync.emptySidecar(); this.old = old; this.k = 0; }
    ctx() { return { newId: mid, usedIds: [...this.used], builtinVisible: 0, describe: modelDescribe, copyName: modelCopy, readable: this.old ? r => !(r && r.v > 5) : undefined }; }
    apply(p) {
      for (const o of p.ops) {
        if (o.op === "insert") { this.entries.push({ id: o.id, revision: 1, record: clone(o.record) }); this.used.add(o.id); }
        else if (o.op === "overwrite") { const e = this.entries.find(x => x.id === o.id); e.record = clone(o.record); e.revision++; }
        else if (o.op === "remove") this.entries = this.entries.filter(e => e.id !== o.id);
      }
    }
    commit() { return this.entries.map(e => ({ id: e.id, revision: e.revision })); }
    pull(s) {
      let p = sync.planPull({ remote: s.pull(this.sc.cursor), local: this.entries, sidecar: this.sc, ctx: this.ctx() });
      this.apply(p); this.sc = sync.settlePull(this.sc, p, this.commit());
      p = sync.planDeferred({ local: this.entries, sidecar: this.sc, ctx: this.ctx() });
      this.apply(p); this.sc = sync.settlePull(this.sc, p, this.commit());
    }
    push(s) {
      const p = sync.planPush({ local: this.entries, sidecar: this.sc, ctx: this.ctx() });
      const st = sync.settlePush(this.sc, p, p.batches.flatMap(b => s.push(b)));
      this.sc = st.sidecar;
      return st;
    }
    cycle(s) {
      for (let i = 0; i < 3; i++) { this.pull(s); if (!this.push(s).conflict) return true; }
      return false;
    }
  }
  const newName = (d, from) => {
    const n = d.tag + (++d.k) + "." + world.parent.size;
    world.parent.set(n, from ? strip(from) : null);
    return n;
  };
  const step = (d, op, s) => {
    if (op === "add") { const id = mid(); d.entries.push({ id, revision: 1, record: { v: 5, n: newName(d), s: "D3" } }); d.used.add(id); }
    else if (op === "edit" || op === "editV6") {
      const e = d.entries[0];
      if (!e || (d.old && (e.record.v > 5 || op === "editV6"))) return false;
      e.record = { ...e.record, n: newName(d, e.record.n), v: op === "editV6" ? 6 : e.record.v };
      e.revision++;
    } else if (op === "del") { const e = d.entries[0]; if (!e) return false; world.deleted.add(strip(e.record.n)); d.entries.shift(); }
    else if (op === "cycle") { if (!d.cycle(s)) throw new Error("conflict loop"); }
    else if (op === "notNow") d.sc = sync.firstSyncAudit({ local: d.entries, sidecar: d.sc }).sidecar;
    else if (op === "release") { if (!d.sc.localOnly.length) return false; d.sc = sync.releaseLocal(d.sc, d.sc.localOnly); }
    else if (op === "reset") d.sc = sync.emptySidecar();
    return true;
  };
  const X = (n, s) => [{ id: "X", revision: 1, record: { v: 5, n, s } }];
  const CONFIGS = {
    sameIdDiff: () => [X("a0", "D3"), X("b0", "E3")],
    aOnly: () => [X("a0", "D3"), []],
    sameIdSame: () => [X("a0", "D3"), X("a0", "D3")]
  };
  const OPS = ["add", "edit", "editV6", "del", "cycle", "notNow", "release", "reset"];
  const moves = [0, 1].flatMap(dv => OPS.map(op => [dv, op]));
  const failures = [];
  let runs = 0;
  const run = (cfg, seq) => {
    idc = 0;
    world.parent = new Map([["a0", null], ["b0", null]]); world.deleted = new Set();
    const [ea, eb] = CONFIGS[cfg]();
    const s = new Server(), devs = [new Dev("a", ea, true), new Dev("b", eb, false)];
    const label = seq.map(m => "ab"[m[0]] + "." + m[1]).join(" ");
    try {
      for (const [dv, op] of seq) if (step(devs[dv], op, s) === false) return;
      runs++;
      for (const d of devs) if (d.sc.localOnly.length) d.sc = sync.releaseLocal(d.sc, d.sc.localOnly);
      for (let r = 0; r < 3; r++) for (const d of devs) if (!d.cycle(s)) throw new Error("conflict loop");
      const live = [...s.rows.values()].filter(r => !r.deleted).map(r => r.record.n).sort();
      for (const d of devs) {
        if (d.sc.pending) throw new Error("pending forever");
        const held = d.entries.filter(e => !d.sc.deferredDeletes.includes(d.sc.alias[e.id] || e.id)).map(e => e.record.n).sort();
        if (JSON.stringify(held) !== JSON.stringify(live)) throw new Error("no convergence");
      }
      const present = new Set(live.map(strip)), hasChild = new Set([...world.parent.values()].filter(Boolean));
      for (const n of world.parent.keys()) {
        if (present.has(n) || world.deleted.has(n) || hasChild.has(n)) continue;
        if (cfg !== "sameIdDiff" && n === "b0") continue;
        throw new Error("lost body " + n);
      }
    } catch (e) { failures.push(cfg + ": " + e.message + " | " + label); }
  };
  const walk = (cfg, seq) => { run(cfg, seq); if (seq.length < 3) for (const m of moves) walk(cfg, [...seq, m]); };
  for (const cfg of Object.keys(CONFIGS)) walk(cfg, []);
  assert.ok(runs > 5000);
  assert.deepEqual(failures.slice(0, 3), []);
});
