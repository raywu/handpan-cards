// Boots index.html's inline scripts in a node:vm with a minimal DOM stub, so the
// app's logic can be unit-tested without a browser and without the app growing
// any test seam. Shared by tests/app.test.js and tools/boot_sim.js so the stub
// exists in exactly one place.
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

const APP = path.join(__dirname, "..", "..", "index.html");

// Ids getElementById will serve. getElementById stays STRICT - an unknown id
// throws, so a typo in the app is a loud failure, not a silent null - but the
// list is extensible: push through registerIds(), or pass opts.extraIds for one
// boot only.
const ELEMENT_IDS = ["decks", "card", "front", "back", "count", "prev", "next", "shuffle", "modeA", "modeB"];

/** Permanently extend the served id list (for later boots in this process). */
function registerIds(...ids) {
  for (const id of ids.flat()) if (!ELEMENT_IDS.includes(id)) ELEMENT_IDS.push(id);
  return ELEMENT_IDS;
}

function makeElement(id, tag = "div") {
  const attrs = {};
  return {
    id, tagName: String(tag).toUpperCase(),
    _html: "", _text: "", value: "", checked: false,
    children: [], listeners: {}, dataset: {}, attributes: attrs,
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
    set textContent(v) { this._text = v; }, get textContent() { return this._text; },
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
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    removeEventListener(t, fn) {
      const l = this.listeners[t] || [];
      const i = l.indexOf(fn);
      if (i >= 0) l.splice(i, 1);
    },
    dispatchEvent(ev) { for (const fn of this.listeners[ev && ev.type] || []) fn(ev); return true; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      return c;
    },
    remove() {},
    focus() {}, blur() {}, click() { if (this.onclick) this.onclick.call(this); },
    onclick: null, oninput: null, onchange: null,
  };
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
    get pathname() { return state.url.pathname; },
    set pathname(v) { state.url.pathname = v; },
    get host() { return state.url.host; },
    get protocol() { return state.url.protocol; },
    toString() { return state.url.href; },
    assign(v) { this.href = v; },
    replace(v) { this.href = v; },
    reload() {},
  };
  return loc;
}

/**
 * @param {object} opts
 *   storage        - seed object for localStorage (default empty)
 *   throwOnStorage - make localStorage throw, exercising the private-mode guard
 *   random         - deterministic replacement for Math.random
 *   href           - initial location (default "https://example.test/index.html")
 *   extraIds       - extra element ids served by getElementById, this boot only
 *   syncTimers     - run setTimeout callbacks immediately instead of queueing
 */
function boot(opts = {}) {
  const html = fs.readFileSync(APP, "utf8");
  // Every inline block, in document order; <script src=...> is skipped (the app
  // is single-file by contract, so there should never be one).
  const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (!blocks.length) throw new Error("no inline <script> found in index.html");

  const els = {};
  const served = [...ELEMENT_IDS, ...(opts.extraIds || [])];
  for (const id of served) els[id] = makeElement(id);
  const created = [];
  const store = { ...(opts.storage || {}) };
  const docEl = makeElement("root", "html");

  // Each boot gets its own Math so stubbing random cannot leak across tests.
  const mathStub = Object.create(Math);
  if (opts.random) mathStub.random = opts.random;

  const all = () => [...Object.values(els), docEl, ...created];
  const match = (el, sel) => {
    if (sel.startsWith("#")) return el.id === sel.slice(1);
    if (sel.startsWith(".")) return el.classList.contains(sel.slice(1));
    return el.tagName === sel.toUpperCase();
  };
  const queryAll = (sel) => {
    const parts = String(sel).split(",").map((s) => s.trim()).filter(Boolean);
    return all().filter((el) => parts.some((p) => match(el, p)));
  };

  // Timers: queued by default so a recurring timer cannot hang a unit test.
  // flushTimers() drains the queue in due order; opts.syncTimers runs inline.
  const timers = new Map();
  let nextTimer = 1;

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
    back() {}, forward() {}, go() {},
  };

  const sandbox = {
    localStorage: {
      getItem(k) { if (opts.throwOnStorage) throw new Error("denied"); return k in store ? store[k] : null; },
      setItem(k, v) { if (opts.throwOnStorage) throw new Error("denied"); store[k] = String(v); },
      removeItem(k) { if (opts.throwOnStorage) throw new Error("denied"); delete store[k]; },
    },
    document: {
      getElementById(id) { if (!els[id]) throw new Error("missing #" + id); return els[id]; },
      createElement: (tag) => { const e = makeElement("dyn", tag || "div"); created.push(e); return e; },
      querySelector: (sel) => queryAll(sel)[0] || null,
      querySelectorAll: (sel) => queryAll(sel),
      documentElement: docEl,
      get body() { return docEl; },
      addEventListener(t, fn) { (this._l = this._l || {}), (this._l[t] = this._l[t] || []).push(fn); },
      removeEventListener() {},
      _l: {},
    },
    location, history,
    URL, URLSearchParams, TextEncoder, TextDecoder, structuredClone, btoa, atob,
    setTimeout(fn, ms, ...args) {
      if (opts.syncTimers) { fn(...args); return 0; }
      const id = nextTimer++;
      timers.set(id, { fn, ms: ms || 0, args, seq: id });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    setInterval() { return 0; },
    clearInterval() {},
    queueMicrotask: (fn) => fn(),
    // Only host-realm globals a vm context lacks are injected. Never Array,
    // Object, Error and friends: a context has its own, and importing the host
    // ones would make `x instanceof Array` false for values the code built.
    console, Math: mathStub,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const src of blocks) vm.runInContext(src, sandbox);

  /** Run queued setTimeout callbacks in due order until the queue is empty. */
  function flushTimers(maxRounds = 100) {
    for (let round = 0; round < maxRounds && timers.size; round++) {
      const due = [...timers.entries()].sort((a, b) => a[1].ms - b[1].ms || a[1].seq - b[1].seq);
      const [id, t] = due[0];
      timers.delete(id);
      t.fn(...t.args);
    }
    return timers.size;
  }

  return {
    els, store, docEl, sandbox, created, location, history, blocks, flushTimers,
    /** Serve one more element id from this boot on. */
    registerId: (id) => (els[id] = els[id] || makeElement(id)),
    /** Evaluate an expression inside the app's scope. */
    get: (expr) => vm.runInContext(expr, sandbox),
    run: (stmt) => vm.runInContext(stmt, sandbox),
    faces: () => els.front._html + els.back._html,
    clickChip: (deckName) => {
      const chip = els.decks.children.find((c) => c._html.includes(deckName));
      if (!chip) throw new Error("no chip for " + deckName);
      chip.onclick();
    },
    flip: () => els.card.listeners.click[0](),
    cssVar: (name) => docEl.style._props[name],
  };
}

module.exports = { boot, makeElement, makeLocation, registerIds, ELEMENT_IDS, APP };
