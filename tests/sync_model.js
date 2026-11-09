// A model of the sync-apply command, shared by tests/sync.test.js (race matrix, bounded
// model) and checked against the real command in tests/app.test.js (sync-apply conformance).
const clone = v => JSON.parse(JSON.stringify(v));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// entries: [{ id, revision, record }]. opts: { used, builtinVisible, slotTaken(seed, id) }.
// A missing row on an overwrite fails the whole command (conflict), as the real command does.
function applyOps(entries, ops, opts = {}) {
  const live = clone(entries), skipped = [], inserted = [], removed = [], claimed = new Map();
  const used = new Set([...(opts.used || []), ...live.map(e => e.id)]);
  const settle = (e, record) => {
    const seed = record.o && record.o.replaces;
    if (seed !== undefined) {
      const taken = (opts.slotTaken && opts.slotTaken(seed, e.id)) || (claimed.has(seed) && claimed.get(seed) !== e.id);
      if (taken) delete record.o.replaces; else claimed.set(seed, e.id);
    }
    if (!same(record, e.record)) {
      e.record = record;
      if (!inserted.includes(e.id)) e.revision++;
    }
  };
  for (const op of ops) {
    const at = live.findIndex(e => e.id === op.id);
    if (op.op === "insert") {
      if (!UUID.test(op.id) && !opts.anyId || used.has(op.id)) { skipped.push({ id: op.id, reason: "id" }); continue; }
      const e = { id: op.id, revision: 1, record: clone(op.record) };
      live.push(e); used.add(op.id); inserted.push(op.id);
      settle(e, clone(op.record));
    } else if (op.op === "overwrite") {
      if (at < 0) return { conflict: true, live: clone(entries), committed: [], skipped: [] };
      if (op.requires && skipped.some(s => s.id === op.requires)) { skipped.push({ id: op.id, reason: "dependency" }); continue; }
      if (live[at].revision !== op.expectedRevision) { skipped.push({ id: op.id, reason: "revision" }); continue; }
      settle(live[at], clone(op.record));
    } else if (at < 0) skipped.push({ id: op.id, reason: "missing" });
    else if (live[at].revision !== op.expectedRevision) skipped.push({ id: op.id, reason: "revision" });
    else if ((opts.builtinVisible || 0) + live.length - 1 < 1) skipped.push({ id: op.id, reason: "last-visible" });
    else { live.splice(at, 1); removed.push(op.id); }
  }
  return { conflict: false, live, committed: live.map(e => ({ id: e.id, revision: e.revision })), skipped, inserted, removed };
}

module.exports = { applyOps, UUID };
