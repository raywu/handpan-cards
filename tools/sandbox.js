// Boots index.html's inline scripts in a node:vm with a minimal DOM stub, so the
// app's logic can be unit-tested without a browser and without the app growing
// any test seam. Shared by tests/app.test.js and tools/boot_sim.js so the stub
// exists in exactly one place.
//
// This lives in tools/ rather than tests/ because tools/boot_sim.js and
// tools/regen_pan_fixture.js SHIP and must not require a file under tests/ (a
// tests/ reorganisation would silently break them) - the exact rationale
// tools/engine_loader.js documents for the engine loader. There is still
// exactly ONE implementation of the boot stub below - tests/helpers/sandbox.js
// re-exports this module rather than keeping a second copy that could drift.
//
// EVERY inline <script> block is executed, in document order, into ONE context:
// when the engine is inlined as a second block ahead of the app script, both
// halves see the same globals, exactly as a browser would run them.
//
// The stub is deliberately small. Add to it only what the app actually uses;
// anything richer belongs in the e2e suite, which drives a real browser.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const APP = path.join(__dirname, "..", "index.html");

// Ids getElementById will serve. getElementById stays STRICT - an unknown id
// throws, so a typo in the app is a loud failure, not a silent null.
// The scale-sheet ids of ENGINE-SPEC section 15 are served from Phase 3 on, so
// a boot never throws on the sheet markup and e2e and the units target the same
// names. Serving an id costs nothing when no element in index.html uses it yet.
const ELEMENT_IDS = ["decks", "card", "front", "back", "count", "prev", "next", "shuffle", "modeA", "modeB",
  "scale-sheet", "scale-box", "scale-parse", "scale-msg", "scale-refusal", "scale-mirror",
  "scale-mirror-bottom", "scale-box-wrap", "scale-swatches", "scale-generate", "deck-add", "deck-restore",
  // Phase 4 Edit state, registered here the same way the Phase 3 ids were.
  "scale-name-row", "scale-name",
  "scale-delete-row", "scale-delete", "scale-del-note",
  // Phase 5 LAYOUT section, additive like the two before it.
  "scale-layout-reset",
  // Lane DR1: the layout drawer shell.
  "scale-layout-zone", "scale-plate-band", "scale-layout-hint",
  "scale-layout-state", "scale-drawer", "scale-drawer-hint", "scale-drawer-status",
  "scale-anchor-one", "scale-anchor-between",
  // Lane DR2a: the seat controls that replace the old rot/move group.
  "scale-note-prev", "scale-note-next", "scale-seat-prev", "scale-seat-next",
  // Lane FP-D: the bottom note's 5 degree nudge.
  "scale-angle-prev", "scale-angle-next",
  // Lane DR3: the disclosure over the finer controls.
  "scale-fine-toggle", "scale-fine",
  // The pan-layout preview, additive like every row above it.
  "scale-preview",
  // Stage 2: the page header. The sheet became a full-screen page, so it has a
  // BACK control and a visible title where the drawer had neither.
  "scale-back", "scale-title",
  // The sheet's tabs, their panels and the NEXT button (plan 2026-10-19-sheet-tabs).
  "scale-tabs", "scale-tab-scale", "scale-tab-layout", "scale-panel-scale", "scale-panel-layout", "scale-next",
  // The footer lip (plan 2026-10-19-sheet-tabs 3.7).
  "scale-foot", "scale-footslide", "scale-lip",
  // Lane M1: the settings panel that now hosts the mode toggle and print
  // controls, plus its header trigger and scrim.
  "settings-trigger", "settings-scrim", "settings-panel",
  "print-paper-select",
  "lang-select",
  // Lane S2: the sequence-mode toggle, its credit paragraph and source link.
  "panel-seq-note", "seq-source-link",
  "seq-style", "seq-style-name", "seq-style-tip", "foot",
  // sequence-difficulty D2: the three tier buttons of the five-button Practice
  // group (they replaced "modeS" and the Difficulty group).
  "tier-basic", "tier-intermediate", "tier-advanced",
  // Share URL lane SU-A: the COPY LINK control and its readonly fallback input.
  "share-copy", "share-url", "about", "about-open", "about-close",
  "scale-fields", "scale-ding", "scale-top", "scale-inner", "scale-bottom", "scale-ding-label", "scale-top-label",
  "scale-inner-label", "scale-bottom-label", "scale-field-msg", "scale-fields-live", "scale-fields-note", "scale-line-note",
  // Saved variants: the reviewed status, conflict action and explicit temporary-use controls.
  "saved-status", "scale-conflict", "scale-conflict-msg", "scale-conflict-separate", "saved-temporary-use"];

/** Copy a value out of the vm realm, so assert.deepStrictEqual can compare it. */
const plain = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// Opt-in browser-origin model. Defaults below still boot synchronously with
// isolated storage and no injected durable APIs. This is deliberately a model,
// not evidence about real browser partitioning, quotas or crash durability.
const ORIGINS = new WeakMap();
function createOrigin(options = {}) {
  const origin = {};
  originState(origin, options);
  return origin;
}
function originState(origin, options = {}) {
  if (!origin || typeof origin !== "object") throw new TypeError("origin must be an explicit object");
  if (ORIGINS.has(origin)) return ORIGINS.get(origin);
  const state = { buckets: new Map(), seed: options.storage || {}, events: [], nextClient: 1,
    writeAttempts: [], successfulWrites: [], messages: [] };
  ORIGINS.set(origin, state);
  origin.events = options.events || "manual";
  if (!["manual", "auto", "omit"].includes(origin.events)) throw new TypeError("unknown storage event mode");
  origin.broadcastEvents = options.broadcastEvents || "auto";
  if (!["manual", "auto", "omit"].includes(origin.broadcastEvents)) throw new TypeError("unknown broadcast mode");
  origin.flushBroadcastMessages = ({ limit = Infinity, omit = false } = {}) => {
    if (!(limit === Infinity || Number.isInteger(limit) && limit >= 0)) throw new TypeError('message limit must be nonnegative');
    const pending = state.messages.splice(0, limit);
    if (!omit) for (const { channel, data } of pending) if (!channel._closed) channel._emit("message", { data });
    return pending.length;
  };
  origin.writeAttempts = state.writeAttempts;
  origin.successfulWrites = state.successfulWrites;
  origin.flushStorageEvents = ({ limit = Infinity, omit = false } = {}) => {
    if (!(limit === Infinity || Number.isInteger(limit) && limit >= 0)) throw new TypeError("event limit must be nonnegative");
    const pending = state.events.splice(0, limit);
    if (!omit) for (const { recipient, event } of pending) recipient.dispatch(event);
    return pending.length;
  };
  return state;
}
function originBucket(state, name, seed) {
  if (!state.buckets.has(name)) {
    const store = Object.fromEntries(Object.entries(seed || state.seed).map(([k, v]) => [k, String(v)]));
    state.buckets.set(name, { store, realms: new Set(), locks: new Map() });
  }
  return state.buckets.get(name);
}
// Explicit, deliberately limited IndexedDB model. Host tasks model asynchronous
// request settlement; VM virtual timers and app state never supply authority.
const idbClone = value => structuredClone(value);
const idbError = (name, message = name) => Object.assign(new Error(message), { name });
function idbEvents(target = {}) {
  const listeners = new Map();
  target.addEventListener = (type, fn) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
  };
  target.removeEventListener = (type, fn) => listeners.get(type)?.delete(fn);
  Object.defineProperty(target, '_emit', { value(type, details = {}) {
    const event = { type, target, currentTarget: target, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...details };
    if (typeof target['on' + type] === 'function') target['on' + type].call(target, event);
    for (const fn of [...(listeners.get(type) || [])]) fn.call(target, event);
    return event;
  } });
  return target;
}
function indexedDBFor(bucket) {
  bucket.databases ||= new Map();
  bucket.openQueues ||= new Map();
  const faults = new Map(), holds = new Set(), waiting = new Map(), operations = [];
  const dispatch = (operation, callback) => setImmediate(() => {
    if (holds.has(operation)) {
      if (!waiting.has(operation)) waiting.set(operation, []);
      waiting.get(operation).push(callback);
    } else callback();
  });
  const failure = operation => {
    const item = faults.get(operation);
    if (!item) return null;
    if (item.once) faults.delete(operation);
    return item.error;
  };
  const snapshot = stores => new Map([...stores].map(([name, s]) => [name, {
    name, keyPath: idbClone(s.keyPath), autoIncrement: s.autoIncrement, entries: idbClone(s.entries), nextKey: s.nextKey,
  }]));
  const names = get => ({ contains: name => get().has(String(name)),
    get length() { return get().size; }, item: index => [...get().keys()][index] ?? null,
    [Symbol.iterator]: function* () { yield* get().keys(); } });
  function transaction(db, record, storeNames, mode, upgrade = false) {
    if (db._closed) throw idbError('InvalidStateError');
    if (!['readonly', 'readwrite', 'versionchange'].includes(mode)) throw new TypeError('unsupported transaction mode');
    const scope = typeof storeNames === 'string' ? [storeNames] : Array.from(storeNames);
    if (!upgrade && scope.some(name => !record.stores.has(name))) throw idbError('NotFoundError');
    operations.push({ operation: 'transaction', db: db.name, mode });
    const tx = idbEvents({ db, mode, error: null, _done: false, _started: false,
      _queue: [], _requests: new Set(), _busy: false, _idle: 0, _stores: snapshot(record.stores) });
    db._transactions.add(tx);
    const finish = () => {
      db._transactions.delete(tx);
      if (db._closed && !db._transactions.size) db._finishClose();
      if (record.running === tx) record.running = null;
      pump(record);
    };
    tx.abort = () => {
      if (tx._done) throw idbError('InvalidStateError');
      tx._done = true;
      operations.push({ operation: 'abort', db: db.name, mode });
      dispatch('abort', () => {
        for (const req of tx._requests) if (req.readyState === 'pending') {
          req.error = idbError('AbortError'); req.readyState = 'done'; req._emit('error');
        }
        finish(); tx._emit('abort');
      });
    };
    const fail = error => { if (tx._done) return; tx.error = error; tx.abort(); };
    const next = () => {
      if (tx._done || !tx._started || tx._busy) return;
      const operation = tx._queue.shift();
      if (operation) {
        tx._busy = true;
        dispatch(operation.kind, () => {
          tx._busy = false;
          if (tx._done) return;
          const err = failure(operation.kind);
          if (err) {
            operation.request.error = err; operation.request.readyState = 'done';
            const event = operation.request._emit('error');
            tx._emit('error', { target: operation.request });
            if (!event.defaultPrevented) fail(err);
          } else {
            try {
              operation.request.result = operation.apply();
              operation.request.readyState = 'done';
              operation.request._emit('success');
              if (operation.kind === 'put') { const abort = failure('abortAfterPut'); if (abort) fail(abort); }
            } catch (error) { fail(error); }
          }
          next();
        });
      } else {
        const idle = ++tx._idle;
        dispatch('commit', () => {
          if (tx._done || tx._busy || tx._queue.length || idle !== tx._idle) return next();
          const error = failure('commit');
          if (error) return fail(error);
          if (mode !== 'readonly') record.stores = snapshot(tx._stores);
          operations.push({ operation: 'commit', db: db.name, mode });
          tx._done = true;
          if (tx._commit) tx._commit();
          finish();
          // Commit releases authority before its completion event is delivered.
          // A realm-local hold can model an old read resolving after a peer commit.
          dispatch('complete', () => tx._emit('complete'));
        });
      }
    };
    tx.objectStore = name => {
      name = String(name);
      if (tx._done) throw idbError('InvalidStateError');
      if (!upgrade && !scope.includes(name)) throw idbError('NotFoundError');
      const schema = tx._stores.get(name);
      if (!schema) throw idbError('NotFoundError');
      const request = (kind, apply) => {
        if (tx._done) throw idbError('TransactionInactiveError');
        operations.push({ operation: kind, db: db.name, mode, store: name });
        const req = idbEvents({ result: undefined, error: null, readyState: 'pending', transaction: tx });
        tx._requests.add(req); tx._queue.push({ kind, apply, request: req }); tx._idle++; next(); return req;
      };
      return { name, keyPath: schema.keyPath, autoIncrement: schema.autoIncrement,
        get: key => request('read', () => idbClone(tx._stores.get(name).entries.get(key))),
        getKey: key => request('read', () => tx._stores.get(name).entries.has(key) ? idbClone(key) : undefined),
        put(value, key) {
          if (mode === 'readonly') throw idbError('ReadOnlyError');
          const copy = idbClone(value);
          if (key === undefined && schema.keyPath !== null) key = copy[schema.keyPath];
          if (key === undefined && !schema.autoIncrement) throw idbError('DataError');
          return request('put', () => {
            const store = tx._stores.get(name);
            const actual = key === undefined ? store.nextKey++ : key;
            if (store.autoIncrement && typeof actual === 'number' && actual >= store.nextKey) store.nextKey = Math.floor(actual) + 1;
            if (store.keyPath !== null && key === undefined) copy[store.keyPath] = actual;
            store.entries.set(idbClone(actual), copy); return idbClone(actual);
          });
        },
      };
    };
    tx._start = () => { if (!upgrade) tx._stores = snapshot(record.stores); tx._started = true; next(); };
    if (upgrade) { tx._started = true; }
    else { record.queue.push(tx); pump(record); }
    return tx;
  }
  function pump(record) {
    if (record.running || !record.queue.length) return;
    const tx = record.queue.shift(); record.running = tx;
    setImmediate(() => { if (tx._done) { record.running = null; pump(record); } else tx._start(); });
  }
  function connection(name, record) {
    const db = idbEvents({ name, version: record.version, _closed: false, _transactions: new Set() });
    Object.defineProperty(db, 'objectStoreNames', { get: () => names(() => db._upgrade?._stores || record.stores) });
    db.transaction = (stores, mode = 'readonly') => transaction(db, record, stores, mode);
    db._finishClose = () => {
      record.connections.delete(db);
      for (const retry of [...record.blocked]) setImmediate(retry);
    };
    db.close = () => {
      if (db._closed) return;
      db._closed = true;
      operations.push({ operation: 'close', db: name });
      if (!db._transactions.size) db._finishClose();
    };
    db.createObjectStore = (storeName, options = {}) => {
      const tx = db._upgrade;
      if (!tx || tx._done) throw idbError('InvalidStateError');
      if (tx._stores.has(storeName)) throw idbError('ConstraintError');
      operations.push({ operation: 'createObjectStore', db: name, store: storeName });
      tx._stores.set(storeName, { name: storeName, keyPath: idbClone(options.keyPath ?? null),
        autoIncrement: !!options.autoIncrement, entries: new Map(), nextKey: 1 });
      return tx.objectStore(storeName);
    };
    record.connections.add(db); return db;
  }
  const api = { open(name, version) {
    name = String(name);
    operations.push({ operation: 'open', db: name });
    if (version !== undefined && (!Number.isInteger(version) || version < 1)) throw new TypeError('invalid database version');
    const req = idbEvents({ result: undefined, error: null, readyState: 'pending', transaction: null });
    const begin = () => {
      const doneOpen = () => {
        const queue = bucket.openQueues.get(name);
        queue.shift();
        if (queue.length) setImmediate(queue[0]);
        else bucket.openQueues.delete(name);
      };
      const err = failure('open');
      if (err) { req.error = err; req.readyState = 'done'; req._emit('error'); doneOpen(); return; }
      let record = bucket.databases.get(name);
      const oldVersion = record?.version || 0, desired = version ?? (oldVersion || 1);
      if (desired < oldVersion) { req.error = idbError('VersionError'); req.readyState = 'done'; req._emit('error'); doneOpen(); return; }
      if (!record) { record = { version: 0, stores: new Map(), connections: new Set(), queue: [], running: null, blocked: new Set() }; }
      const upgrade = desired > oldVersion;
      if (upgrade) for (const other of [...record.connections]) other._emit('versionchange', { oldVersion, newVersion: desired });
      let blockedSent = false, settled = false;
      const proceed = () => {
        if (settled) return;
        if (upgrade && record.connections.size) {
          record.blocked.add(proceed);
          if (!blockedSent) { blockedSent = true; req._emit('blocked', { oldVersion, newVersion: desired }); }
          return;
        }
        settled = true; record.blocked.delete(proceed);
        const db = connection(name, record); db.version = desired; req.result = db;
        if (!upgrade) { req.readyState = 'done'; req._emit('success'); doneOpen(); return; }
        const tx = transaction(db, record, [], 'versionchange', true);
        db._upgrade = tx; req.transaction = tx;
        tx._commit = () => { record.version = desired; bucket.databases.set(name, record); };
        tx.addEventListener('complete', () => {
          db._upgrade = null; req.transaction = null; req.readyState = 'done'; req._emit('success'); doneOpen();
        });
        tx.addEventListener('abort', () => {
          db._upgrade = null; db.close(); req.transaction = null;
          req.error = tx.error || idbError('AbortError'); req.readyState = 'done'; req._emit('error'); doneOpen();
        });
        operations.push({ operation: 'upgrade', db: name, oldVersion, newVersion: desired });
        req._emit('upgradeneeded', { oldVersion, newVersion: desired });
        // Upgrade handlers can queue requests or abort before schema commits.
        setImmediate(() => tx._start());
      };
      proceed();
    };
    dispatch('open', () => {
      if (!bucket.openQueues.has(name)) bucket.openQueues.set(name, []);
      const queue = bucket.openQueues.get(name); queue.push(begin);
      if (queue.length === 1) begin();
    });
    return req;
  } };
  const control = {
    get operations() { return idbClone(operations); },
    inspect(name) {
      const record = bucket.databases.get(name);
      return record && { name, version: record.version, stores: [...record.stores.values()].map(s => ({
        name: s.name, keyPath: idbClone(s.keyPath), autoIncrement: s.autoIncrement, entries: [...idbClone(s.entries)],
      })) };
    },
    fault(operation, error = idbError('UnknownError'), { once = true } = {}) { faults.set(operation, { error, once }); },
    hold(operation) { holds.add(operation); },
    release(operation) { holds.delete(operation); const pending = waiting.get(operation) || []; waiting.delete(operation); for (const fn of pending) setImmediate(fn); return pending.length; },
    pending(operation) { return (waiting.get(operation) || []).length; },
    closeConnections(name) { for (const db of [...(bucket.databases.get(name)?.connections || [])]) db.close(); },
  };
  return { api, control };
}
function broadcastChannelFor(bucket, origin, publicOrigin) {
  bucket.channels ||= new Set();
  return class BroadcastChannel {
    constructor(name) { this.name = String(name); this._closed = false; idbEvents(this); bucket.channels.add(this); }
    postMessage(value) {
      if (this._closed) throw idbError('InvalidStateError');
      const data = idbClone(value);
      if (publicOrigin.broadcastEvents === 'omit') return;
      for (const channel of bucket.channels) if (channel !== this && channel.name === this.name && !channel._closed) origin.messages.push({ channel, data: idbClone(data) });
      if (publicOrigin.broadcastEvents === 'auto') setImmediate(() => publicOrigin.flushBroadcastMessages());
    }
    close() { this._closed = true; bucket.channels.delete(this); }
  };
}

function locksFor(bucket, clientId, rejection) {
  const pump = name => queueMicrotask(() => {
    const queue = bucket.locks.get(name);
    if (!queue || queue.held || !queue.pending.length) return;
    const item = queue.pending.shift();
    queue.held = item;
    if (item.signal) item.signal.removeEventListener("abort", item.abort);
    Promise.resolve().then(() => item.callback({ name, mode: "exclusive" })).then(
      value => { queue.held = null; item.resolve(value); pump(name); },
      error => { queue.held = null; item.reject(error); pump(name); });
  });
  return {
    request(name, options, callback) {
      if (typeof options === "function") { callback = options; options = {}; }
      options = options || {};
      if (rejection) return Promise.reject(typeof rejection === "function" ? rejection() : rejection);
      if (typeof callback !== "function") return Promise.reject(new TypeError("lock callback required"));
      if (options.mode && options.mode !== "exclusive" || options.steal || options.ifAvailable) {
        return Promise.reject(new TypeError("sandbox models exclusive queued locks only"));
      }
      name = String(name);
      const signal = options.signal;
      if (signal && signal.aborted) return Promise.reject(signal.reason || Object.assign(new Error("aborted"), { name: "AbortError" }));
      if (!bucket.locks.has(name)) bucket.locks.set(name, { held: null, pending: [] });
      const queue = bucket.locks.get(name);
      return new Promise((resolve, reject) => {
        const item = { clientId, callback, resolve, reject, signal };
        item.abort = () => {
          const index = queue.pending.indexOf(item);
          if (index < 0) return; // A granted callback/commit cannot be canceled retroactively.
          queue.pending.splice(index, 1);
          signal.removeEventListener("abort", item.abort);
          reject(signal.reason || Object.assign(new Error("aborted"), { name: "AbortError" }));
          pump(name);
        };
        if (signal) signal.addEventListener("abort", item.abort, { once: true });
        queue.pending.push(item);
        pump(name);
      });
    },
    async query() {
      const held = [], pending = [];
      for (const [name, queue] of bucket.locks) {
        if (queue.held) held.push({ name, mode: "exclusive", clientId: queue.held.clientId });
        for (const item of queue.pending) pending.push({ name, mode: "exclusive", clientId: item.clientId });
      }
      return { held, pending };
    },
  };
}

function makeElement(id, tag = "div") {
  const attrs = {};
  return {
    id, tagName: String(tag).toUpperCase(),
    _html: "", _text: "", value: "",
    children: [], listeners: {}, dataset: {}, attributes: attrs,
    // Assigning innerHTML replaces the children in a browser; the stub does the
    // same, so a rebuilt list (buildChips) has exactly the nodes it appended.
    set innerHTML(v) {
      this._html = v;
      for (const c of this.children) c.parentNode = null;
      this.children.length = 0;
    }, get innerHTML() { return this._html; },
    // One hidden state: the property and the attribute are the same thing in a
    // browser, and getClientRects() below reads it.
    set hidden(v) { if (v) attrs.hidden = ""; else delete attrs.hidden; },
    get hidden() { return "hidden" in attrs; },
    parentNode: null,
    // The nearest id'd ancestor in the shipped markup (boot() fills it in);
    // dynamically created nodes use parentNode from appendChild instead.
    _markupParent: null,
    // Rendered iff neither the element nor any ancestor is hidden. The stub has
    // no layout, so "rendered" is one rect; CSS never reaches this realm.
    getClientRects() {
      for (let n = this; n; n = n.parentNode || n._markupParent) if (n.hidden) return [];
      return [{}];
    },
    set textContent(v) {
      this._text = v;
      for (const c of this.children) c.parentNode = null;
      this.children.length = 0;
    }, get textContent() { return this._text; },
    setAttribute(k, v) {
      attrs[k] = String(v);
      if (k.startsWith("data-")) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(v);
      if (k === "id") this.id = String(v);
    },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    removeAttribute(k) { delete attrs[k]; },
    hasAttribute(k) { return k in attrs; },
    classList: {
      _set: new Set(),
      contains(c) { return this._set.has(c); },
      add(...cs) { for (const c of cs) this._set.add(c); },
      remove(...cs) { for (const c of cs) this._set.delete(c); },
      toggle(c, on) {
        if (on === undefined) return this._set.has(c) ? this._set.delete(c) : this._set.add(c);
        return on ? this._set.add(c) : this._set.delete(c);
      },
    },
    get className() { return [...this.classList._set].join(" "); },
    set className(v) { this.classList._set = new Set(String(v).split(/\s+/).filter(Boolean)); },
    style: { _props: {}, setProperty(k, v) { this._props[k] = v; } },
    addEventListener(t, fn) {
      const l = (this.listeners[t] = this.listeners[t] || []);
      if (!l.includes(fn)) l.push(fn);
    },
    removeEventListener(t, fn) {
      const l = this.listeners[t] || [];
      const i = l.indexOf(fn);
      if (i >= 0) l.splice(i, 1);
    },
    dispatchEvent(ev) { for (const fn of this.listeners[ev && ev.type] || []) fn(ev); return true; },
    appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      c.parentNode = null;
      return c;
    },
    // focus() is rebound per boot (see bindFocus) so document.activeElement
    // tracks it; the standalone default keeps makeElement usable on its own.
    focus() {}, blur() {}, select() {},
    // No-op: jsdom-less stub has no scroll container or layout, so there is
    // nothing to scroll. renderSeqRail() (D-12) calls this unconditionally
    // on every render in sequence mode; without a stub it throws.
    scrollIntoView() {},
    // clicks is counted so a test can tell a created-and-abandoned <a> from
    // one the app actually activated; a real anchor click is the whole of the
    // download on every platform but iOS.
    clicks: 0, click() { this.clicks++; if (this.onclick) this.onclick.call(this); },
    onclick: null, onchange: null,
  };
}

/**
 * Opt-in layout surface (boot({layout:true})): the members the swipe, wheel and
 * keyboard-inset code reads off an element. The stub has no layout engine, so
 * every number here is a fixed, documented fiction - a 360x520 card box - and
 * the animation is a record, not a clock: it never finishes by itself. A test
 * settles it with finish(). The default boot gets none of this.
 */
const CARD_BOX = { left: 0, top: 0, right: 360, bottom: 520, width: 360, height: 520 };
function addLayout(el) {
  el.getBoundingClientRect = () => ({ ...CARD_BOX });
  el.offsetWidth = CARD_BOX.width;
  el.offsetHeight = CARD_BOX.height;
  el.scrollLeft = 0;
  el.isConnected = true;
  el._anims = [];
  Object.defineProperty(el, "parentElement", { get() { return this.parentNode || null; }, configurable: true });
  el.animate = (keyframes, options) => {
    let settle, fail;
    const finished = new Promise((res, rej) => { settle = res; fail = rej; });
    finished.catch(() => {});
    const anim = {
      keyframes, options, finished, state: "running",
      cancel() { if (this.state === "running") { this.state = "idle"; fail(new Error("AbortError")); } },
      finish() { if (this.state === "running") { this.state = "finished"; settle(this); } },
    };
    el._anims.push(anim);
    return anim;
  };
  el.getAnimations = () => el._anims.filter((a) => a.state === "running");
  el.setPointerCapture = (id) => { el._captured = id; };
  el.contains = (other) => {
    for (let n = other; n; n = n.parentNode) if (n === el) return true;
    return false;
  };
  el.closest = (sel) => {
    const parts = String(sel).split(",").map((x) => x.trim());
    for (let n = el; n; n = n.parentNode) {
      for (const p of parts) {
        if (p.startsWith("#") ? n.id === p.slice(1)
          : p.startsWith(".") ? n.classList.contains(p.slice(1))
          : n.tagName === p.toUpperCase()) return n;
      }
    }
    return null;
  };
  return el;
}

function makeLocation(href) {
  const state = { url: new URL(href) };
  const loc = {
    get href() { return state.url.href; },
    set href(v) { state.url = new URL(v, state.url.href); },
    get search() { return state.url.search; },
    set search(v) { state.url.search = v; },
    get hash() { return state.url.hash; },
    set hash(v) { state.url.hash = v; },
    get origin() { return state.url.origin; },
    get protocol() { return state.url.protocol; },
    get hostname() { return state.url.hostname; },
    get pathname() { return state.url.pathname; },
    set pathname(v) { state.url.pathname = v; },
    toString() { return state.url.href; },
  };
  return loc;
}

/**
 * @param {object} opts
 *   storage        - seed object for localStorage (default empty)
 *   throwOnStorage - make localStorage throw, exercising the private-mode guard
 *   random         - deterministic replacement for Math.random
 *   href           - initial location (default "https://example.test/index.html")
 *   userAgent      - navigator.userAgent (default a desktop Chrome string)
 *   maxTouchPoints - navigator.maxTouchPoints (default 0)
 *   webdriver      - navigator.webdriver (default true, as under automation)
 *   languages      - navigator.languages (default ["en-US", "en"]); navigator.language is its first entry
 *   html           - boot this markup instead of reading index.html
 *   sheetBody      - with layout, expose the anonymous sheet body and its markup ancestry;
 *                    event capture/bubble and native focus/selection remain unsimulated
 *   origin         - explicit shared handle (createOrigin() or {}), partitioned by URL origin
 *   locks          - true injects asynchronous exclusive FIFO navigator.locks
 *   crypto         - explicitly supplied {randomUUID,getRandomValues}; functions may throw/repeat
 *   abortController/isSecureContext - explicit host AbortController/secure-context surface
 *   storageAccessError/locksAccessError/cryptoAccessError - throwing API getters
 *   storageFault   - ({operation,key,value}) => error|null, evaluated before each operation
 *   locksRequestError - rejects request before acquisition, without invoking its callback
 */
const JS_TYPES = new Set([
  "text/javascript", "application/javascript", "application/x-javascript", "text/ecmascript",
  "application/ecmascript", "text/jscript", "text/livescript", "text/x-javascript", "text/x-ecmascript",
]);

function boot(opts = {}) {
  const html = opts.html !== undefined ? String(opts.html) : fs.readFileSync(APP, "utf8");
  // Every inline block, in document order; <script src=...> is skipped (the app
  // is single-file by contract, so there should never be one).
  // A script whose type is not JavaScript (application/ld+json, a template) is data.
  const isJs = (m) => {
    const t = /(?:^|\s)type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[0].slice(0, m[0].indexOf(">") + 1));
    const v = t ? (t[1] ?? t[2] ?? t[3]).trim().toLowerCase() : "";
    return v === "" || v === "module" || JS_TYPES.has(v);
  };
  const blockMatches = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].filter(isJs);
  const blocks = blockMatches.map((m) => m[1]);
  if (!blocks.length) {
    throw new Error(`no inline <script> found in ${opts.html !== undefined ? "the html option" : "index.html"} (a script whose type is not JavaScript is skipped)`);
  }
  // Run the blocks as ONE script whose character offsets equal index.html's own:
  // every character outside a kept block is blanked to a space (newlines kept),
  // so line/column in stack traces and in node's coverage mapper (which lays V8's
  // reported character offsets over the file starting at 0) land on the real
  // index.html position. lineOffset/columnOffset on runInContext do not affect
  // coverage - it recomputes offsets straight from the file - so this is the
  // only way to make coverage (and stacks) agree with the shipped file.
  const chars = new Array(html.length);
  for (let i = 0; i < html.length; i++) chars[i] = html[i] === "\n" ? "\n" : " ";
  for (const m of blockMatches) {
    const bodyStart = m.index + m[0].length - "</script>".length - m[1].length;
    for (let i = 0; i < m[1].length; i++) chars[bodyStart + i] = m[1][i];
  }
  const combinedSrc = chars.join("");

  const els = {};
  // Focus is real state in a browser and the sheet's a11y rules turn on it, so
  // the stub tracks it too: focus() sets document.activeElement, blur() clears
  // it. Every element this boot hands the app goes through bindFocus.
  const focusState = { active: null };
  const bindFocus = (el) => {
    el.focus = (o) => { el.focusOpts = o; focusState.active = el; };
    el.blur = () => { if (focusState.active === el) focusState.active = null; };
    return opts.layout ? addLayout(el) : el;
  };
  for (const id of ELEMENT_IDS) els[id] = bindFocus(makeElement(id));
  // Lane DR2a: the plate's hit layer. The stub has no DOM parser, so the
  // `.panhit` circles the app wrote into #scale-preview are read back into real
  // stub nodes (cached per markup string, so a node keeps its identity and its
  // focus until the plate is repainted) and the plate answers the three
  // selectors the app uses. Focusing one fires `focusin` on the plate, as a
  // browser does.
  const preview = els["scale-preview"];
  const hitCache = { html: null, nodes: [] };
  // Lane DR2b: where the plate sits on the screen. A hit circle's box is its
  // viewBox circle scaled by k about (x0, y0), its radius by a further rk (the
  // ring-mode growth sizePanHits does in a browser); the stub has no layout to ask.
  const plate = { x0: 200, y0: 200, k: 1, rk: 1, gx: 0, gy: 0 };
  preview.setPointerCapture = (id) => { preview._captured = id; };
  preview.releasePointerCapture = (id) => { if (preview._captured === id) preview._captured = null; };
  preview.hasPointerCapture = (id) => preview._captured === id;
  const unesc = (v) => v.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const hitNodes = () => {
    const html = String(preview.innerHTML || "");
    if (hitCache.html === html) return hitCache.nodes;
    hitCache.html = html;
    hitCache.nodes = [...html.matchAll(/<circle class="panhit"[^>]*\/>/g)].map((m) => {
      const n = bindFocus(makeElement("", "circle"));
      for (const a of m[0].matchAll(/([\w:-]+)="([^"]*)"/g)) n.setAttribute(a[1], unesc(a[2]));
      n.classList.add("panhit");
      n.parentNode = preview;
      n.getBoundingClientRect = () => {
        const r = Number(n.getAttribute("r")) * plate.k * plate.rk;
        const x = plate.x0 + Number(n.getAttribute("cx")) * plate.k;
        const y = plate.y0 + Number(n.getAttribute("cy")) * plate.k;
        return { left: x - r, right: x + r, top: y - r, bottom: y + r, width: 2 * r, height: 2 * r };
      };
      n.closest = (sel) => (/(^|,\s*)\.panhit/.test(String(sel)) ? n : null);
      n.focus = (opts) => { n.focusOpts = opts; focusState.active = n; preview.dispatchEvent({ type: "focusin", target: n }); };
      return n;
    });
    return hitCache.nodes;
  };
  const queryHits = (sel) => {
    const s = String(sel);
    if (!s.startsWith(".panhit")) return [];
    const field = /\[data-field="(\d+)"\]/.exec(s);
    const tab = /\[tabindex="(-?\d+)"\]/.exec(s);
    return hitNodes().filter((n) => (!field || n.getAttribute("data-field") === field[1]) &&
      (!tab || n.getAttribute("tabindex") === tab[1]));
  };
  preview.querySelectorAll = queryHits;
  preview.querySelector = (sel) => queryHits(sel)[0] || null;
  /** Deliver an event the way a browser would: to the target, then up the
   *  markup chain, then to the document. Returns the event. */
  const fire = (el, ev, pending) => {
    ev.target = ev.target || el;
    ev.defaultPrevented = false;
    ev.stopped = false;
    const origPrevent = ev.preventDefault;
    ev.preventDefault = () => { ev.defaultPrevented = true; if (origPrevent) origPrevent.call(ev); };
    ev.stopPropagation = () => { ev.stopped = true; };
    for (let n = el; n && !ev.stopped; n = n.parentNode || n._markupParent) {
      for (const fn of n.listeners[ev.type] || []) {
        const result = fn(ev);
        if (pending && result && typeof result.then === "function") pending.push(Promise.resolve(result));
      }
    }
    if (!ev.stopped) for (const fn of sandbox.document._l[ev.type] || []) {
      const result = fn(ev);
      if (pending && result && typeof result.then === "function") pending.push(Promise.resolve(result));
    }
    return ev;
  };
  // Layout boot: #card sits inside a .scene, #scale-sheet has its surface child
  // (the real one is sheet.firstElementChild) and <main> exists for the wheel
  // listener. Default boot gets none of these, so `scene` stays undefined there.
  const layoutMain = opts.layout ? bindFocus(makeElement("main", "main")) : null;
  if (opts.layout) {
    const sceneEl = bindFocus(makeElement("scene"));
    sceneEl.classList.add("scene");
    sceneEl.appendChild(els.card);
    layoutMain.appendChild(sceneEl);
    els["scale-sheet"].appendChild(bindFocus(makeElement("sheetsurf")));
    Object.defineProperty(els["scale-sheet"], "firstElementChild", { get() { return this.children[0] || null; } });
  }
  // Real placeholders, read out of the shipped markup rather than restated
  // here. showPlaceholderPan() draws the seed the placeholder shows, so a stub
  // with no placeholder would silently exercise the empty-string path and
  // report a pass for behaviour the browser does not have.
  for (const [, id, ph] of html
      .matchAll(/<(?:input|textarea)[^>]*\bid="([^"]+)"[^>]*\bplaceholder="([^"]*)"/g)) {
    if (els[id]) els[id].placeholder = ph;
  }
  // `hidden` is real initial state in the shipped markup (the scale page and
  // the print container both ship hidden), and a test that asserts a container
  // STARTS hidden has to see what the browser sees rather than `undefined`.
  for (const [, tag, id] of html.matchAll(/<(?:div|section|aside|p|span|button)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    if (els[id] && /\bhidden\b/.test(tag)) els[id].hidden = true;
  }
  // Ancestry from a tag-stack walk of the shipped markup, so a control inside a
  // hidden container has no client rects without a hand-kept table.
  const markupNodes = [];
  {
    const VOID = new Set(["input", "br", "img", "meta", "link", "hr", "source", "wbr", "area", "col"]);
    const body = html.replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, "");
    const stack = [];
    for (const [, close, tag, attrText, selfClose] of
        body.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)) {
      const name = tag.toLowerCase();
      if (close) {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].tag === name) { stack.length = i; break; }
        }
        continue;
      }
      const id = /\bid="([^"]+)"/.exec(attrText);
      const classes = /\bclass="([^"]*)"/.exec(attrText);
      const isSheetBody = opts.layout && opts.sheetBody && classes &&
        classes[1].split(/\s+/).includes("sheetbody");
      const bodyNode = isSheetBody ? bindFocus(makeElement("", name)) : null;
      if (bodyNode) {
        bodyNode.className = classes[1];
        const surface = els["scale-sheet"].firstElementChild;
        surface.classList.add("sheetsurf");
        surface.appendChild(bodyNode);
        markupNodes.push(bodyNode);
      }
      if (id && els[id[1]]) {
        const up = [...stack].reverse().find((f) => f.id && els[f.id]);
        if (up) els[id[1]]._markupParent = els[up.id];
        // The opt-in body is the only anonymous container added here. Keep the
        // existing nearest-ID chain within it, but make contains/closest/fire
        // agree on that ancestry. Controls outside it retain the old fixture.
        if (opts.layout && opts.sheetBody && stack.some((f) => f.bodyNode)) {
          const parent = [...stack].reverse().find((f) => f.bodyNode || (f.id && els[f.id]));
          const node = parent.bodyNode || els[parent.id];
          els[id[1]].parentNode = node;
          els[id[1]]._markupParent = node;
        }
      }
      if (!VOID.has(name) && !selfClose) stack.push({ tag: name, id: id && id[1], bodyNode });
    }
  }
  const created = [];
  if (html.includes('<div class="announce"')) {
    const node = bindFocus(makeElement("announce"));
    node.className = "announce";
    markupNodes.push(node);
  }
  const origin = opts.origin ? originState(opts.origin) : null;
  const bucket = origin ? originBucket(origin, new URL(opts.href || "https://example.test/index.html").origin, opts.storage) : null;
  const store = bucket ? bucket.store : { ...(opts.storage || {}) };
  const docEl = makeElement("root", "html");
  const headEl = makeElement("head", "head");

  // Each boot gets its own Math so stubbing random cannot leak across tests.
  const mathStub = Object.create(Math);
  if (opts.random) mathStub.random = opts.random;

  const all = () => [...Object.values(els), docEl, ...(layoutMain ? [layoutMain] : []), ...markupNodes, ...created];
  // Only the ID/tag/class compounds and descendant combinator used by the app.
  // This is a selector model, not a CSS layout engine or full selector parser.
  const matchSimple = (el, sel) => {
    const parsed = /^([a-zA-Z][\w-]*)?((?:[#.][\w-]+)*)$/.exec(sel);
    if (!parsed || (!parsed[1] && !parsed[2])) return false;
    if (parsed[1] && el.tagName !== parsed[1].toUpperCase()) return false;
    return [...parsed[2].matchAll(/([#.])([\w-]+)/g)].every(([, kind, value]) =>
      kind === "#" ? el.id === value : el.classList.contains(value));
  };
  const match = (el, sel) => {
    const chain = sel.split(/\s+/);
    if (!matchSimple(el, chain.pop())) return false;
    let ancestor = el;
    while (chain.length) {
      const wanted = chain.pop();
      ancestor = ancestor.parentNode || ancestor._markupParent;
      while (ancestor && !matchSimple(ancestor, wanted)) {
        ancestor = ancestor.parentNode || ancestor._markupParent;
      }
      if (!ancestor) return false;
    }
    return true;
  };
  const queryAll = (sel) => {
    const parts = String(sel).split(",").map((s) => s.trim()).filter(Boolean);
    return all().filter((el) => parts.some((p) => match(el, p)));
  };

  // Timers: queued so a recurring timer cannot hang a unit test.
  // flushTimers() drains the queue in due order.
  const timers = new Map();
  let nextTimer = 1;
  // Lane DR2b: a virtual clock. It moves only when a test calls advance(), so
  // a timer set for 250 ms is due 250 ms later and no sooner. With opts.clock
  // the app's Date.now() reads it too.
  let now = 0;
  const CLOCK_BASE = 1000000;

  const historyCalls = [];
  const location = makeLocation(opts.href || "https://example.test/index.html");
  const history = {
    calls: historyCalls,
    get length() { return historyCalls.length + 1; },
    state: null,
    pushState(state, title, url) {
      historyCalls.push({ type: "push", state, title, url });
      this.state = state;
      if (url !== undefined && url !== null) location.href = String(url);
    },
    replaceState(state, title, url) {
      historyCalls.push({ type: "replace", state, title, url });
      this.state = state;
      if (url !== undefined && url !== null) location.href = String(url);
    },
    // Recorded, not simulated: the app calls back() to pop the page's own
    // history entry, and a unit test asserts the call. The browser's answering
    // popstate is fired explicitly by the harness's popstate() helper.
    back() { historyCalls.push({ type: "back" }); },
  };

  // Blob and the object-URL registry. The PDF emitter hands the browser its
  // bytes this way, and a unit test has to be able to read back both what went
  // into the blob and whether the URL it minted was ever revoked - a leaked
  // object URL pins the whole PDF in memory for the life of the tab.
  const blobs = [];
  class SandboxBlob {
    constructor(parts, opts) {
      this.parts = parts;
      this.type = (opts && opts.type) || "";
      blobs.push(this);
    }
  }
  const objectUrls = [];
  // Subclassed rather than patched: the app calls `new URL(...)` all over the
  // share code, and hanging createObjectURL off the HOST URL would leak the
  // stub into every other suite in the process.
  class SandboxURL extends URL {}
  SandboxURL.createObjectURL = (blob) => {
    const url = "blob:https://example.test/" + objectUrls.length;
    objectUrls.push({ url, blob, revoked: false });
    return url;
  };
  SandboxURL.revokeObjectURL = (url) => {
    const rec = objectUrls.find((o) => o.url === url);
    if (rec) rec.revoked = true;
  };

  const sandbox = {
    localStorage: {
      getItem(k) { if (opts.throwOnStorage) throw new Error("denied"); return k in store ? store[k] : null; },
      setItem(k, v) { if (opts.throwOnStorage) throw new Error("denied"); store[k] = String(v); },
      removeItem(k) { if (opts.throwOnStorage) throw new Error("denied"); delete store[k]; },
    },
    document: {
      getElementById(id) { if (!els[id]) throw new Error("missing #" + id); return els[id]; },
      createElement: (tag) => {
        const e = bindFocus(makeElement("dyn", tag || "div"));
        e.getBoundingClientRect = () => {
          const w = parseFloat(e.style.width) || 0, h = parseFloat(e.style.height) || 0;
          const l = (parseFloat(e.style.left) || 0) + plate.gx, t = (parseFloat(e.style.top) || 0) + plate.gy;
          return { left: l, top: t, right: l + w, bottom: t + h, width: w, height: h };
        };
        created.push(e);
        return e;
      },
      // D-12 (sequence-difficulty): renderSeqRail() groups a separator and a
      // chord name into one unit with a real text node between them, so the
      // stub needs a minimal one too - just enough to be appendChild'd and
      // read back by nodeType/textContent, nothing a real Text node does
      // beyond that.
      createTextNode: (text) => ({ nodeType: 3, textContent: String(text) }),
      get activeElement() { return focusState.active; },
      querySelector: (sel) => queryAll(sel)[0] || null,
      querySelectorAll: (sel) => queryAll(sel),
      documentElement: docEl,
      head: headEl,
      get body() { return docEl; },
      addEventListener(t, fn) { (this._l = this._l || {}), (this._l[t] = this._l[t] || []).push(fn); },
      removeEventListener() {},
      // Runs the listeners addEventListener stored, by event type. There are no
      // capture/bubble phases: a test that needs ordering dispatches in order.
      dispatchEvent(ev) { for (const fn of this._l[ev && ev.type] || []) fn(ev); return true; },
      _l: {},
    },
    location, history,
    URL: SandboxURL, Blob: SandboxBlob,
    TextEncoder, btoa, atob,
    setTimeout(fn, ms, ...args) {
      const id = nextTimer++;
      timers.set(id, { fn, ms: ms || 0, due: now + (ms || 0), args, seq: id });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    // Only host-realm globals a vm context lacks are injected. Never Array,
    // Object, Error and friends: a context has its own, and importing the host
    // ones would make `x instanceof Array` false for values the code built.
    console, Math: mathStub,
    // printCalls records the invocations of window.print() a test asserts on;
    // the app itself no longer calls it, so a test can prove it never does.
    innerWidth: 1024,
    // The print sheet also reads the platform, because iOS Safari ignores
    // `@page` and enforces a page box of its own. Default to a desktop UA so
    // existing tests keep the width-driven layout; `userAgent` overrides it.
    navigator: {
      userAgent: opts.userAgent === undefined
        ? "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"
        : opts.userAgent,
      maxTouchPoints: opts.maxTouchPoints === undefined ? 0 : opts.maxTouchPoints,
      webdriver: opts.webdriver === undefined ? true : opts.webdriver,
      languages: (opts.languages || ["en-US", "en"]).slice(),
      language: (opts.languages || ["en-US", "en"])[0],
    },
    // M3 (desktop sidebar, 2026-09-28): the app reads window.matchMedia once,
    // at boot, to gate the settings panel's modal wiring to below the
    // desktop-sidebar breakpoint. `matches` is always false here - this stub
    // never simulates a resize - so boot in this DOM-stubbed sandbox always
    // sees the below-breakpoint (mobile/hamburger) state; the breakpoint
    // itself is only meaningfully exercised in the e2e suite, which drives a
    // real browser and a real viewport.
    matchMedia: (query) => ({
      matches: !!opts.reducedMotion && /reduce/.test(query), media: query,
      addEventListener() {}, removeEventListener() {},
    }),
  };
  if (opts.layout) {
    sandbox.innerHeight = opts.innerHeight === undefined ? 800 : opts.innerHeight;
    if (opts.visualViewport) {
      const vvl = {};
      sandbox.visualViewport = {
        height: 0, offsetTop: 0, scale: 1, ...opts.visualViewport,
        addEventListener(t, fn) { (vvl[t] = vvl[t] || []).push(fn); },
        removeEventListener() {},
        dispatchEvent(ev) { for (const fn of vvl[ev && ev.type] || []) fn(ev); return true; },
      };
    }
  }
  const printCalls = [];
  sandbox.print = () => { printCalls.push(sandbox.innerWidth); };
  // Window-level listeners. The app registers `popstate` on the window (the
  // scale page is a history entry, and the browser's Back button is the only
  // way a user ever pops it), so the stub has to serve the same registration
  // the browser does - and popstate() below is how a unit test presses Back.
  const winListeners = {};
  sandbox.addEventListener = (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); };
  sandbox.removeEventListener = (t, fn) => {
    const l = winListeners[t] || [];
    const i = l.indexOf(fn);
    if (i >= 0) l.splice(i, 1);
  };
  // All injection is explicit: an origin alone shares raw storage/events; locks,
  // crypto, secure-context and AbortController remain separate capabilities.
  if (origin) {
    const clientId = "sandbox-client-" + origin.nextClient++;
    const recipient = { storage: null, dispatch: event => {
      for (const fn of [...(winListeners.storage || [])]) fn(event);
    } };
    const notify = (key, oldValue, newValue) => {
      if (opts.origin.events === "omit") return;
      for (const other of bucket.realms) if (other !== recipient) {
        origin.events.push({ recipient: other, event: { type: "storage", key, oldValue, newValue,
          url: location.href, storageArea: other.storage } });
      }
      if (opts.origin.events === "auto") setTimeout(() => opts.origin.flushStorageEvents(), 0);
    };
    const check = (operation, key, value) => {
      if (opts.throwOnStorage) throw new Error("denied");
      const failure = opts.storageFault && opts.storageFault({ operation, key, value });
      if (failure) throw failure;
    };
    const write = (operation, key, value, apply) => {
      const attempt = { operation, key, value, url: location.href, success: false };
      origin.writeAttempts.push(attempt);
      check(operation, key, value);
      apply();
      attempt.success = true;
      origin.successfulWrites.push({ ...attempt });
    };
    const storage = {
      get length() { check("length", null, null); return Object.keys(store).length; },
      key(index) { check("key", null, null); return Object.keys(store)[index] ?? null; },
      getItem(key) { key = String(key); check("getItem", key, null); return Object.hasOwn(store, key) ? store[key] : null; },
      setItem(key, value) {
        key = String(key); value = String(value);
        write("setItem", key, value, () => {
          const oldValue = Object.hasOwn(store, key) ? store[key] : null;
          Object.defineProperty(store, key, { value, enumerable: true, configurable: true, writable: true });
          if (oldValue !== value) notify(key, oldValue, value);
        });
      },
      removeItem(key) {
        key = String(key);
        write("removeItem", key, null, () => {
          if (Object.hasOwn(store, key)) { const oldValue = store[key]; delete store[key]; notify(key, oldValue, null); }
        });
      },
      clear() {
        write("clear", null, null, () => {
          if (Object.keys(store).length) { for (const key of Object.keys(store)) delete store[key]; notify(null, null, null); }
        });
      },
    };
    sandbox.localStorage = storage;
    recipient.storage = storage;
    bucket.realms.add(recipient);
    if (opts.locks === true) sandbox.navigator.locks = locksFor(bucket, clientId, opts.locksRequestError);
  } else if (opts.locks === true) {
    sandbox.navigator.locks = locksFor({ locks: new Map() }, "isolated-client", opts.locksRequestError);
  }
  const capabilityBucket = bucket || { locks: new Map() };
  const idb = opts.indexedDB === true ? indexedDBFor(capabilityBucket) : null;
  if (idb) sandbox.indexedDB = idb.api;
  if (opts.broadcastChannel === true) {
    const channelOrigin = opts.origin || createOrigin();
    sandbox.BroadcastChannel = broadcastChannelFor(capabilityBucket, originState(channelOrigin), channelOrigin);
  }
  if (opts.locksAccessError) Object.defineProperty(sandbox.navigator, "locks", {
    configurable: true, get() { throw opts.locksAccessError; },
  });
  if (opts.crypto && !opts.cryptoAccessError) sandbox.crypto = opts.crypto;
  if (opts.isSecureContext !== undefined) sandbox.isSecureContext = !!opts.isSecureContext;
  if (opts.abortController === true) sandbox.AbortController = AbortController;
  if (opts.clock) {
    sandbox.Date = class ClockDate extends Date {
      static now() { return CLOCK_BASE + now; }
      constructor(...a) { if (a.length) super(...a); else super(CLOCK_BASE + now); }
    };
  }
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // Define throwing GLOBAL accessors from inside the context. A throwing host
  // accessor on the context backing object is treated as a missing identifier
  // by node:vm; that would falsely turn SecurityError into ReferenceError.
  if (opts.storageAccessError || opts.cryptoAccessError) {
    sandbox.__sandboxAccessFaults = { ...(opts.storageAccessError ? { localStorage: opts.storageAccessError } : {}),
      ...(opts.cryptoAccessError ? { crypto: opts.cryptoAccessError } : {}) };
    vm.runInContext(`(() => {
      for (const [property, error] of Object.entries(__sandboxAccessFaults))
        Object.defineProperty(globalThis, property, { configurable:true, get() { throw error; } });
      delete globalThis.__sandboxAccessFaults;
    })()`, sandbox);
  }
  vm.runInContext(combinedSrc, sandbox, { filename: APP });

  /** Move the virtual clock forward, running every timer that falls due on the way. */
  function advance(ms) {
    const end = now + ms;
    for (;;) {
      const next = [...timers.entries()].filter(([, t]) => t.due <= end)
        .sort((a, b) => a[1].due - b[1].due || a[1].seq - b[1].seq)[0];
      if (!next) break;
      timers.delete(next[0]);
      now = Math.max(now, next[1].due);
      next[1].fn(...next[1].args);
    }
    now = end;
  }
  /** Run queued setTimeout callbacks in due order until the queue is empty. */
  function flushTimers(maxRounds = 100) {
    for (let round = 0; round < maxRounds && timers.size; round++) {
      const due = [...timers.entries()].sort((a, b) => a[1].due - b[1].due || a[1].seq - b[1].seq);
      const [id, t] = due[0];
      timers.delete(id);
      t.fn(...t.args);
    }
    return timers.size;
  }

  // Await actual returned promises before normalizing cross-realm values.
  // Readiness observes cooperative predicates/promises with a host deadline,
  // never virtual timer advancement. The vm timeout bounds initial synchronous
  // evaluation only: a later Promise callback that spins CPU can starve the
  // host timer. These utilities do not isolate arbitrary async execution.
  // Run helper tests under an outer process supervisor (as suite_health does)
  // even when waitFor/clickAsync has its own readiness timeout.
  const getAsync = async (expr, { timeout } = {}) =>
    plain(await vm.runInContext(expr, sandbox, timeout ? { timeout } : {}));
  function bounded(promise, timeout) {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("sandbox readiness timed out")), timeout);
    })]).finally(() => clearTimeout(timer));
  }
  async function waitFor(expression, { timeout = 1000 } = {}) {
    if (typeof expression !== "string" || !expression) throw new TypeError("readiness expression required");
    if (!Number.isFinite(timeout) || timeout <= 0) throw new TypeError("readiness timeout must be positive");
    return bounded((async () => {
      const deadline = Date.now() + timeout;
      do {
        const value = await getAsync(expression, { timeout: Math.max(1, deadline - Date.now()) });
        if (value) return value;
        await new Promise(resolve => setTimeout(resolve, 1));
      } while (Date.now() < deadline);
      throw new Error("sandbox readiness timed out");
    })(), timeout);
  }

  return {
    idb: idb?.control, els, store, sandbox, created, head: headEl, location, history, blocks, flushTimers, advance, plate,
    /** Evaluate an expression inside the app's scope. */
    get: (expr) => vm.runInContext(expr, sandbox),
    getAsync, waitFor,
    run: (stmt) => vm.runInContext(stmt, sandbox),
    faces: () => els.front._html + els.back._html,
    clickChip: (deckName) => {
      const chip = els.decks.children.find((c) => c._html.includes(deckName));
      if (!chip) throw new Error("no chip for " + deckName);
      chip.onclick();
    },
    flip: () => els.card.listeners.click[0](),
    /** The window.print() calls this boot has seen, newest last. */
    printCalls: () => [...printCalls],
    /** Every Blob the app constructed this boot, oldest first. */
    blobs: () => [...blobs],
    /** Every object URL minted this boot, with whether it was revoked. */
    objectUrls: () => objectUrls.map((o) => ({ ...o })),
    cssVar: (name) => docEl.style._props[name],

    /* -------- generated decks (Phase 3) --------
     * Calls the app's own submit path, so a unit test drives generation
     * exactly as the scale sheet will, with no second implementation here.
     * Arguments cross the realm boundary as JSON, and every returned engine
     * value is normalised out of the vm realm so deepStrictEqual works. */
    generate: (text, options) =>
      plain(vm.runInContext(
        `generateDeck(${JSON.stringify(String(text))}, ${JSON.stringify(options || {})})`,
        sandbox)),
    generateAsync: (text, options) => getAsync(
      `generateDeck(${JSON.stringify(String(text))}, ${JSON.stringify(options || {})})`),
    /** Select a deck by id through the app's own path (built-in or generated). */
    select: (id) => vm.runInContext(`selectDeck(${JSON.stringify(String(id))})`, sandbox),
    /** The id of the deck currently on screen. */
    deckId: () => vm.runInContext("deckId", sandbox),
    /** The generated deck registry, as plain host-realm data. */
    registry: () => plain(vm.runInContext("CUSTOM", sandbox)),
    /* Drop a deck out of the registry WITHOUT going through deleteDeck. The
       app has no UI for this and should not: it exists so a test can stage
       the one state deleteDeck's own `if (!d)` guard is written for, where
       the deck went away between the arming tap and the confirming one. */
    forgetDeck: (id) =>
      vm.runInContext(`delete CUSTOM[${JSON.stringify(String(id))}]`, sandbox),
    /** The deck object render() would use, as plain host-realm data. */
    currentDeck: () => plain(vm.runInContext("deck()", sandbox)),

    /* -------- the scale sheet (Phase 3) --------
     * Drives the sheet the way a person does - typing into the box, clicking
     * the controls, pressing a key - so a unit test never reaches past the UI
     * into the app's internals. */
    /** Type into #scale-box and fire the input event the app listens for. */
    type: (text) => {
      els["scale-box"].value = String(text);
      els["scale-box"].dispatchEvent({ type: "input" });
    },
    /** Dispatch a document-level keydown, as a real key press would. */
    keydown: (key) => {
      let defaultPrevented = false;
      const ev = { key, type: "keydown", preventDefault() { defaultPrevented = true; } };
      for (const fn of sandbox.document._l.keydown || []) fn(ev);
      return defaultPrevented;
    },
    /** The plate's hit nodes, in markup order, and the data-field of the focused one. */
    hits: () => hitNodes(),
    activeHit: () => (focusState.active && hitNodes().includes(focusState.active)
      ? focusState.active.getAttribute("data-field") : null),
    /** Deliver a click or a key to an element, bubbling like a browser. */
    click: (el, init = {}) => fire(el, { type: "click", ...init }),
    clickAsync: async (el, { until, timeout = 1000, ...init } = {}) => {
      if (typeof until !== "string" || !until) throw new TypeError("clickAsync requires explicit until readiness expression");
      const pending = [];
      fire(el, { type: "click", ...init }, pending);
      return bounded(Promise.all(pending).then(() => waitFor(until, { timeout })), timeout);
    },
    press: (el, key, init = {}) => fire(el, { type: "keydown", key, shiftKey: false, ...init }),
    /** A pointer event. Once the plate has captured the pointer the event goes
     *  to the plate, as a browser would deliver it; `el` is where it would have
     *  gone otherwise. */
    pointer: (el, type, init = {}) => {
      const id = init.pointerId === undefined ? 1 : init.pointerId;
      const to = type !== "pointerdown" && preview._captured === id ? preview : el;
      return fire(to, { type, pointerId: id, pointerType: "touch", isPrimary: true, button: 0, buttons: 1,
        clientX: 0, clientY: 0, ...init });
    },
    /** A touchmove, to the node the touch began on. */
    touchmove: (el, init = {}) => fire(el, { type: "touchmove", touches: [{}], cancelable: true, ...init }),
    contextmenu: (el) => fire(el, { type: "contextmenu" }),
    /** The id of the focused element, or null. */
    activeId: () => (focusState.active ? focusState.active.id : null),
    /** True while the scale sheet is open. */
    sheetOpen: () => !els["scale-sheet"].hasAttribute("hidden"),
    /** The practice-screen live region the success message is announced in. */
    announcer: () => sandbox.document.querySelector(".announce"),
    /** Set the hash and fire the app's hashchange listeners, as the browser does
     *  when the hash actually changes: a hash equal to the current one fires
     *  nothing unless opts.force is set (a listener re-entered with the hash it
     *  already shows), and the event carries oldURL and newURL. */
    hashchange: (newHash, opts = {}) => {
      const oldURL = location.href;
      location.hash = newHash;
      if (location.href === oldURL && !opts.force) return;
      for (const fn of winListeners.hashchange || []) fn({ type: "hashchange", oldURL, newURL: location.href });
    },
    /** Press the browser's Back button. Fires the app's popstate listeners; the
     *  stub keeps no entry stack, so what a test asserts is what the app does
     *  in response - it must take the page down and NOT pop anything itself. */
    popstate: () => {
      for (const fn of winListeners.popstate || []) fn({ type: "popstate", state: history.state });
    },
  };
}

module.exports = { boot, plain, ELEMENT_IDS, APP, createOrigin };
