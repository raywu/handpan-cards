// Boots index.html's inline script in a node:vm with a minimal DOM stub, so the
// app's logic can be unit-tested without a browser and without the app growing
// any test seam. Shared by tests/app.test.js and tools/boot_sim.js so the stub
// exists in exactly one place.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const APP = path.join(__dirname, "..", "..", "index.html");
const ELEMENT_IDS = ["decks", "card", "front", "back", "count", "prev", "next", "shuffle", "modeA", "modeB"];

function makeElement(id) {
  return {
    id, _html: "", _text: "", children: [], listeners: {},
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
    set textContent(v) { this._text = v; }, get textContent() { return this._text; },
    classList: {
      _set: new Set(),
      contains(c) { return this._set.has(c); },
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      toggle(c, on) {
        if (on === undefined) return this._set.has(c) ? this._set.delete(c) : this._set.add(c);
        return on ? this._set.add(c) : this._set.delete(c);
      },
    },
    style: { _props: {}, setProperty(k, v) { this._props[k] = v; } },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    appendChild(c) { this.children.push(c); },
    onclick: null,
  };
}

/**
 * @param {object} opts
 *   storage        - seed object for localStorage (default empty)
 *   throwOnStorage - make localStorage throw, exercising the private-mode guard
 *   random         - deterministic replacement for Math.random
 */
function boot(opts = {}) {
  const html = fs.readFileSync(APP, "utf8");
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error("no inline <script> found in index.html");

  const els = {};
  for (const id of ELEMENT_IDS) els[id] = makeElement(id);
  const store = { ...(opts.storage || {}) };
  const docEl = makeElement("root");

  // Each boot gets its own Math so stubbing random cannot leak across tests.
  const mathStub = Object.create(Math);
  if (opts.random) mathStub.random = opts.random;

  const sandbox = {
    localStorage: {
      getItem(k) { if (opts.throwOnStorage) throw new Error("denied"); return k in store ? store[k] : null; },
      setItem(k, v) { if (opts.throwOnStorage) throw new Error("denied"); store[k] = String(v); },
    },
    document: {
      getElementById(id) { if (!els[id]) throw new Error("missing #" + id); return els[id]; },
      createElement: () => makeElement("dyn"),
      documentElement: docEl,
      addEventListener(t, fn) { (this._l = this._l || {}), (this._l[t] = this._l[t] || []).push(fn); },
      _l: {},
    },
    console, JSON, Array, Set, Object, Math: mathStub,
  };
  vm.createContext(sandbox);
  vm.runInContext(m[1], sandbox);

  return {
    els, store, docEl, sandbox,
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

module.exports = { boot, makeElement, ELEMENT_IDS, APP };
