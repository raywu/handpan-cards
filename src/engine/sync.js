/* HPE.sync - the pure merge core of login sync (ENGINE-SPEC 20).
 *
 * Plain script, no module wrapper, inlined verbatim into index.html; `var` so the
 * namespace lands on a node:vm global. PURE: no network, no storage, no clock, no
 * random. Every function takes plain data and returns plain data; ids come from
 * ctx.newId and are checked against ctx.usedIds, never generated here.
 *
 * VOCABULARY. A "local entry" is { id, revision, record }: the saved scale's
 * instanceId, its per-entry revision counter and its profile record. A "remote
 * row" is { scale_id, rev, record, deleted } as the server holds it. The remote
 * id of a local entry is sidecar.alias[id] || id; the local entry of a remote id
 * is the entry whose remote id it is.
 *
 * SIDECAR { v, cursor, base: { <remoteId>: { rev, localRevision } }, alias:
 * { <localId>: <remoteId> }, deferredDeletes: [remoteId], localOnly: [localId],
 * pending }. base[rid].localRevision is the entry revision AFTER the commit that
 * applied or pushed it, so a pulled row is never echoed back (settlePull and
 * settlePush set it); null means "the local copy differs from the server".
 *
 * CTX { newId(), usedIds, builtinVisible, describe(record) -> { meaning, deckId,
 * identity } | null, readable(record) -> bool, slotTaken(seedId) -> bool,
 * copyName(record) -> record }. All but newId are optional.
 */
var HPE = (typeof HPE !== "undefined") ? HPE : {};
HPE.sync = (function () {
  "use strict";
  const MAX_ROWS_PER_PUSH = 200;
  const clone = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function equal(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
    const ak = Object.keys(a), bk = Object.keys(b);
    return ak.length === bk.length && ak.every(k => own(b, k) && equal(a[k], b[k]));
  }
  function emptySidecar() {
    return { v: 1, cursor: 0, base: {}, alias: {}, deferredDeletes: [], localOnly: [], pending: false };
  }
  function normalized(sidecar) {
    const s = Object.assign(emptySidecar(), clone(sidecar || {}));
    return s;
  }
  function remoteOf(sidecar, localId) {
    return (sidecar && sidecar.alias && sidecar.alias[localId]) || localId;
  }
  function localOf(sidecar, local, remoteId) {
    const found = local.find(e => remoteOf(sidecar, e.id) === remoteId);
    return found ? found.id : null;
  }
  function index(local, alias) {
    const byRid = new Map();
    for (const e of local) {
      const rid = alias[e.id] || e.id;
      if (!byRid.has(rid)) byRid.set(rid, e);
    }
    return byRid;
  }
  function stripReplaces(record, ctx, claimed) {
    const out = clone(record), seed = out && out.o && out.o.replaces;
    if (seed === undefined) return out;
    if (claimed.has(seed) || (ctx.slotTaken && ctx.slotTaken(seed))) delete out.o.replaces;
    else claimed.add(seed);
    return out;
  }
  function makeFresh(ctx, local) {
    const used = new Set([...(ctx.usedIds || []), ...local.map(e => e.id)]);
    return () => {
      for (let i = 0; i < 16; i++) {
        const id = ctx.newId();
        if (id && !used.has(id)) { used.add(id); return id; }
      }
      throw new Error("sync: could not allocate a fresh local id");
    };
  }
  const readableIn = (ctx, record) => !ctx.readable || ctx.readable(record) !== false;
  const describeIn = (ctx, record) => (ctx.describe ? ctx.describe(record) : null) || null;

  function planPull(input) {
    const ctx = input.ctx || {}, local = input.local || [], sc = normalized(input.sidecar);
    const alias = sc.alias, base = sc.base, localOnly = new Set(sc.localOnly);
    const deferred = new Set(sc.deferredDeletes);
    const remote = (input.remote || []).slice().sort((a, b) => a.rev - b.rev);
    const byRid = index(local, alias);
    const fresh = makeFresh(ctx, local);
    const claimed = new Set();
    const ops = [], baseUpdates = [], baseDrops = [], pendingRemoves = [];
    const remoteIds = new Set(remote.map(r => r.scale_id));
    const candidates = local.filter(e => !base[alias[e.id] || e.id] && !localOnly.has(e.id) && !remoteIds.has(alias[e.id] || e.id));
    const deckIdentity = new Map();
    for (const e of local) {
      const d = describeIn(ctx, e.record);
      if (d && d.deckId !== undefined) deckIdentity.set(d.deckId, d.identity);
    }
    const copyOf = record => (ctx.copyName ? ctx.copyName(record) : clone(record));
    let cursor = sc.cursor, inserts = 0;

    const insert = (R, reason, extra) => {
      const rid = R.scale_id, readable = readableIn(ctx, R.record);
      const id = extra.id || fresh();
      const record = readable ? stripReplaces(extra.record || R.record, ctx, claimed) : clone(R.record);
      const op = { op: "insert", id, remoteId: extra.remoteId || rid, record, reason };
      if (!readable) op.opaque = true;
      ops.push(op); inserts++;
      return op;
    };

    for (const R of remote) {
      if (R.rev > cursor) cursor = R.rev;
      const rid = R.scale_id, B = base[rid], L = byRid.get(rid);
      if (!R.deleted && deferred.has(rid)) deferred.delete(rid);

      if (!R.deleted) {
        if (!L) {
          if (B) {
            if (R.rev > B.rev) {
              const op = insert(R, "revive", { id: fresh() });
              alias[op.id] = rid;
              baseUpdates.push({ rid, localId: op.id, rev: R.rev, mode: "committed" });
            }
            continue;
          }
          const d = readableIn(ctx, R.record) ? describeIn(ctx, R.record) : null;
          const match = d && candidates.find(e => {
            const dl = describeIn(ctx, e.record);
            return dl && dl.meaning === d.meaning;
          });
          if (match) {
            candidates.splice(candidates.indexOf(match), 1);
            if (match.id !== rid) alias[match.id] = rid;
            byRid.set(rid, match);
            baseUpdates.push({ rid, localId: match.id, rev: R.rev, mode: equal(match.record, R.record) ? "committed" : "edited" });
            continue;
          }
          const collides = d && d.deckId !== undefined && deckIdentity.has(d.deckId) && deckIdentity.get(d.deckId) !== d.identity;
          let op;
          if (collides) op = insert(R, "collision-copy", { id: fresh(), record: copyOf(R.record) });
          else if ((ctx.usedIds || []).includes(rid) || local.some(e => e.id === rid)) op = insert(R, "revive", { id: fresh() });
          else op = insert(R, "new", { id: rid });
          if (op.id !== rid) alias[op.id] = rid;
          if (d && d.deckId !== undefined && !deckIdentity.has(d.deckId)) deckIdentity.set(d.deckId, d.identity);
          baseUpdates.push({ rid, localId: op.id, rev: R.rev, mode: "committed" });
          continue;
        }
        if (!B) {
          baseUpdates.push({ rid, localId: L.id, rev: R.rev, mode: equal(L.record, R.record) ? "committed" : "edited" });
          continue;
        }
        if (R.rev <= B.rev) continue;
        const unchanged = L.revision === B.localRevision;
        if (equal(L.record, R.record)) {
          baseUpdates.push({ rid, localId: L.id, rev: R.rev, mode: "committed" });
        } else if (unchanged) {
          const opaque = !readableIn(ctx, R.record);
          const op = { op: "overwrite", id: L.id, remoteId: rid, record: clone(R.record) };
          if (opaque) op.opaque = true;
          ops.push(op);
          baseUpdates.push({ rid, localId: L.id, rev: R.rev, mode: "committed" });
        } else {
          insert(R, "conflict-copy", { id: fresh(), remoteId: null, record: copyOf(R.record) });
          ops[ops.length - 1].remoteId = ops[ops.length - 1].id;
          baseUpdates.push({ rid, localId: L.id, rev: R.rev, mode: "keep" });
        }
        continue;
      }

      if (!L) { if (B) baseDrops.push(rid); continue; }
      if (!B) {
        if (R.record && equal(L.record, R.record)) pendingRemoves.push({ R, L });
        else baseUpdates.push({ rid, localId: L.id, rev: R.rev, mode: "edited" });
        continue;
      }
      if (R.rev <= B.rev) continue;
      if (L.revision === B.localRevision) pendingRemoves.push({ R, L });
      else baseUpdates.push({ rid, localId: L.id, rev: R.rev, mode: "keep" });
    }

    let visible = (ctx.builtinVisible || 0) + local.length + inserts;
    for (const { R, L } of pendingRemoves) {
      const rid = R.scale_id;
      if (visible - 1 < 1) {
        deferred.add(rid);
        baseUpdates.push({ rid, localId: L.id, rev: R.rev, mode: "keep" });
        continue;
      }
      visible--;
      ops.push({ op: "remove", id: L.id, remoteId: rid });
      delete alias[L.id];
      baseDrops.push(rid);
    }
    return { ops, baseUpdates, baseDrops, alias, deferredDeletes: [...deferred], cursor };
  }

  function planDeferred(input) {
    const ctx = input.ctx || {}, local = input.local || [], sc = normalized(input.sidecar);
    const byRid = index(local, sc.alias);
    const ops = [], baseDrops = [], keep = [];
    let visible = (ctx.builtinVisible || 0) + local.length;
    const alias = sc.alias;
    for (const rid of sc.deferredDeletes) {
      const L = byRid.get(rid), B = sc.base[rid];
      if (!L || !B) { if (!L && B) baseDrops.push(rid); continue; }
      if (L.revision !== B.localRevision) continue;
      if (visible - 1 < 1) { keep.push(rid); continue; }
      visible--;
      ops.push({ op: "remove", id: L.id, remoteId: rid });
      delete alias[L.id];
      baseDrops.push(rid);
    }
    return { ops, baseUpdates: [], baseDrops, alias, deferredDeletes: keep, cursor: sc.cursor };
  }

  function settlePull(sidecar, plan, committed) {
    const next = normalized(sidecar), rev = new Map((committed || []).map(c => [c.id, c.revision]));
    for (const rid of plan.baseDrops) delete next.base[rid];
    for (const u of plan.baseUpdates) {
      const before = next.base[u.rid];
      let localRevision;
      if (u.mode === "committed") {
        if (!rev.has(u.localId)) throw new Error("sync: no committed revision for " + u.localId);
        localRevision = rev.get(u.localId);
      } else if (u.mode === "edited") localRevision = null;
      else localRevision = before ? before.localRevision : null;
      next.base[u.rid] = { rev: u.rev, localRevision };
    }
    next.alias = clone(plan.alias);
    next.deferredDeletes = [...plan.deferredDeletes];
    next.cursor = Math.max(next.cursor, plan.cursor);
    return next;
  }

  function planPush(input) {
    const ctx = input.ctx || {}, local = input.local || [], sc = normalized(input.sidecar);
    const localOnly = new Set(sc.localOnly), rows = [], meta = {};
    const live = new Set();
    for (const e of local) {
      const rid = sc.alias[e.id] || e.id;
      live.add(rid);
      if (localOnly.has(e.id) || !readableIn(ctx, e.record)) continue;
      const b = sc.base[rid];
      if (b && b.localRevision === e.revision) continue;
      rows.push({ scale_id: rid, base_rev: b ? b.rev : null, record: clone(e.record), deleted: false });
      meta[rid] = { localId: e.id, revision: e.revision };
    }
    for (const rid of Object.keys(sc.base).sort()) {
      if (live.has(rid)) continue;
      rows.push({ scale_id: rid, base_rev: sc.base[rid].rev, record: null, deleted: true });
      meta[rid] = { localId: null, revision: null };
    }
    const batches = [];
    for (let i = 0; i < rows.length; i += MAX_ROWS_PER_PUSH) batches.push(rows.slice(i, i + MAX_ROWS_PER_PUSH));
    return { rows, batches, meta };
  }

  function settlePush(sidecar, plan, results) {
    const next = normalized(sidecar), refused = [];
    let conflict = false, failed = false;
    const done = new Set();
    for (const r of results || []) {
      const row = plan.rows.find(x => x.scale_id === r.scale_id);
      if (!row) continue;
      done.add(r.scale_id);
      if (r.conflict) { conflict = true; continue; }
      if (r.refused) {
        refused.push({ scale_id: r.scale_id, refused: r.refused });
        if (r.refused === "unknown") delete next.base[r.scale_id];
        continue;
      }
      next.deferredDeletes = next.deferredDeletes.filter(id => id !== r.scale_id);
      if (row.deleted) {
        delete next.base[r.scale_id];
        for (const k of Object.keys(next.alias)) if (next.alias[k] === r.scale_id) delete next.alias[k];
      } else next.base[r.scale_id] = { rev: r.rev, localRevision: plan.meta[r.scale_id].revision };
    }
    for (const row of plan.rows) if (!done.has(row.scale_id)) failed = true;
    next.pending = conflict || failed || refused.length > 0;
    return { sidecar: next, conflict, refused };
  }

  function firstSyncAudit(input) {
    const sc = normalized(input.sidecar), held = new Set(sc.localOnly), ids = [];
    for (const e of input.local || []) {
      if (sc.base[sc.alias[e.id] || e.id] || held.has(e.id)) continue;
      ids.push(e.id);
    }
    sc.localOnly = [...sc.localOnly, ...ids];
    return { ids, sidecar: sc };
  }

  function releaseLocal(sidecar, ids) {
    const next = normalized(sidecar), drop = new Set(ids);
    next.localOnly = next.localOnly.filter(id => !drop.has(id));
    return next;
  }

  function pendingLocalIds(input) {
    const sc = normalized(input.sidecar), present = new Set((input.local || []).map(e => e.id));
    return sc.localOnly.filter(id => present.has(id));
  }

  return {
    MAX_ROWS_PER_PUSH: MAX_ROWS_PER_PUSH,
    emptySidecar: emptySidecar, remoteOf: remoteOf, localOf: localOf,
    planPull: planPull, planDeferred: planDeferred, settlePull: settlePull,
    planPush: planPush, settlePush: settlePush,
    firstSyncAudit: firstSyncAudit, releaseLocal: releaseLocal, pendingLocalIds: pendingLocalIds
  };
})();
