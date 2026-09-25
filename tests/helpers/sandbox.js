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
// The scale-sheet ids of ENGINE-SPEC section 15 are served from Phase 3 on, so
// a boot never throws on the sheet markup and e2e and the units target the same
// names. Serving an id costs nothing when no element in index.html uses it yet.
const ELEMENT_IDS = ["decks", "card", "front", "back", "count", "prev", "next", "shuffle", "modeA", "modeB",
  "scale-sheet", "scale-box", "scale-parse", "scale-msg", "scale-refusal", "scale-mirror-l",
  "scale-mirror-r", "scale-swatches", "scale-generate", "deck-add",
  // Phase 4 Edit state, registered here the same way the Phase 3 ids were.
  "scale-name-row", "scale-name", "scale-degrees-row", "scale-degrees",
  "scale-delete-row", "scale-delete", "scale-del-note",
  // Phase 5 LAYOUT section, additive like the two before it.
  "scale-layout-row", "scale-rot-l", "scale-rot-r", "scale-slots",
  "scale-move-l", "scale-move-r", "scale-layout-reset",
  // The pan-layout preview, additive like every row above it.
  "scale-preview",
  // Stage 2: the page header. The sheet became a full-screen page, so it has a
  // BACK control and a visible title where the drawer had neither.
  "scale-back", "scale-title",
  // Workstream B: the print sheet's container and the geometry <style> the
  // CTA writes into. Both live outside <main> so @media print can hide the
  // app without hiding the sheet.
  "printroot", "printgeom"];

/** Permanently extend the served id list (for later boots in this process). */
function registerIds(...ids) {
  for (const id of ids.flat()) if (!ELEMENT_IDS.includes(id)) ELEMENT_IDS.push(id);
  return ELEMENT_IDS;
}

/** Copy a value out of the vm realm, so assert.deepStrictEqual can compare it. */
const plain = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

function makeElement(id, tag = "div") {
  const attrs = {};
  return {
    id, tagName: String(tag).toUpperCase(),
    _html: "", _text: "", value: "", checked: false,
    children: [], listeners: {}, dataset: {}, attributes: attrs,
    // Assigning innerHTML replaces the children in a browser; the stub does the
    // same, so a rebuilt list (buildChips) has exactly the nodes it appended.
    set innerHTML(v) { this._html = v; this.children.length = 0; }, get innerHTML() { return this._html; },
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
    // focus() is rebound per boot (see bindFocus) so document.activeElement
    // tracks it; the standalone default keeps makeElement usable on its own.
    focus() {}, blur() {},
    // clicks is counted so a test can tell a created-and-abandoned <a> from
    // one the app actually activated; a real anchor click is the whole of the
    // download on every platform but iOS.
    clicks: 0, click() { this.clicks++; if (this.onclick) this.onclick.call(this); },
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
 *   userAgent      - navigator.userAgent (default a desktop Chrome string)
 *   maxTouchPoints - navigator.maxTouchPoints (default 0)
 */
function boot(opts = {}) {
  const html = fs.readFileSync(APP, "utf8");
  // Every inline block, in document order; <script src=...> is skipped (the app
  // is single-file by contract, so there should never be one). Each block also
  // carries the real line/column its source starts at in index.html, so
  // vm.runInContext can report accurate stacks and node's coverage mapper can
  // attribute lines back to the shipped file (see the runInContext call below).
  const blockMatches = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  const blocks = blockMatches.map((m) => m[1]);
  const blockOffsets = blockMatches.map((m) => {
    const start = m.index + m[0].indexOf(m[1]);
    const before = html.slice(0, start);
    const lastNl = before.lastIndexOf("\n");
    return { lineOffset: (before.match(/\n/g) || []).length, columnOffset: start - lastNl - 1 };
  });
  if (!blocks.length) throw new Error("no inline <script> found in index.html");

  const els = {};
  // Focus is real state in a browser and the sheet's a11y rules turn on it, so
  // the stub tracks it too: focus() sets document.activeElement, blur() clears
  // it. Every element this boot hands the app goes through bindFocus.
  const focusState = { active: null };
  const bindFocus = (el) => {
    el.focus = () => { focusState.active = el; };
    el.blur = () => { if (focusState.active === el) focusState.active = null; };
    return el;
  };
  const served = [...ELEMENT_IDS, ...(opts.extraIds || [])];
  for (const id of served) els[id] = bindFocus(makeElement(id));
  // Real placeholders, read out of the shipped markup rather than restated
  // here. showPlaceholderPan() draws the seed the placeholder shows, so a stub
  // with no placeholder would silently exercise the empty-string path and
  // report a pass for behaviour the browser does not have.
  for (const [, id, ph] of html
      .matchAll(/<input[^>]*\bid="([^"]+)"[^>]*\bplaceholder="([^"]*)"/g)) {
    if (els[id]) els[id].placeholder = ph;
  }
  // `hidden` is real initial state in the shipped markup (the scale page and
  // the print container both ship hidden), and a test that asserts a container
  // STARTS hidden has to see what the browser sees rather than `undefined`.
  for (const [, tag, id] of html.matchAll(/<(?:div|section|aside)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    if (els[id] && /\bhidden\b/.test(tag)) els[id].hidden = true;
  }
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
    // Recorded, not simulated: the app calls back() to pop the page's own
    // history entry, and a unit test asserts the call. The browser's answering
    // popstate is fired explicitly by the harness's popstate() helper.
    back() { historyCalls.push({ type: "back" }); },
    forward() {}, go() {},
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
      createElement: (tag) => { const e = bindFocus(makeElement("dyn", tag || "div")); created.push(e); return e; },
      get activeElement() { return focusState.active; },
      querySelector: (sel) => queryAll(sel)[0] || null,
      querySelectorAll: (sel) => queryAll(sel),
      documentElement: docEl,
      get body() { return docEl; },
      addEventListener(t, fn) { (this._l = this._l || {}), (this._l[t] = this._l[t] || []).push(fn); },
      removeEventListener() {},
      _l: {},
    },
    location, history,
    // Event, so app code can fire the real thing (`new Event("input")`) rather
    // than reaching past its own listeners - the stub's dispatchEvent already
    // dispatches by `type`.
    URL: SandboxURL, Blob: SandboxBlob,
    URLSearchParams, Event, TextEncoder, TextDecoder, structuredClone, btoa, atob,
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
    // The print sheet reads the viewport ONCE, at the CTA (AC-B5b), and then
    // calls window.print(). Both are window-level in the browser, so the stub
    // serves them here; printCalls records the invocations a test asserts on.
    innerWidth: opts.innerWidth === undefined ? 1024 : opts.innerWidth,
    // The print sheet also reads the platform, because iOS Safari ignores
    // `@page` and enforces a page box of its own. Default to a desktop UA so
    // existing tests keep the width-driven layout; `userAgent` overrides it.
    navigator: {
      userAgent: opts.userAgent === undefined
        ? "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"
        : opts.userAgent,
      maxTouchPoints: opts.maxTouchPoints === undefined ? 0 : opts.maxTouchPoints,
    },
  };
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
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  blocks.forEach((src, i) =>
    vm.runInContext(src, sandbox, { filename: APP, ...blockOffsets[i] }));

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
    /** The id of the focused element, or null. */
    activeId: () => (focusState.active ? focusState.active.id : null),
    /** True while the scale sheet is open. */
    sheetOpen: () => !els["scale-sheet"].hasAttribute("hidden"),
    /** The practice-screen live region the success message is announced in. */
    announcer: () => sandbox.document.querySelector(".announce"),
    /** Press the browser's Back button. Fires the app's popstate listeners; the
     *  stub keeps no entry stack, so what a test asserts is what the app does
     *  in response - it must take the page down and NOT pop anything itself. */
    popstate: () => {
      for (const fn of winListeners.popstate || []) fn({ type: "popstate", state: history.state });
    },
    /** Fire a window-level event the app listens for. `afterprint` is the one
     *  that matters: window.print() returns immediately on iOS Safari, so the
     *  print sheet is torn down on the event rather than in a finally, and a
     *  test has no other way to reach the listener - winListeners is closed
     *  over and not exposed. */
    fireWindow: (type) => {
      for (const fn of winListeners[type] || []) fn({ type });
    },
  };
}

module.exports = { boot, makeElement, makeLocation, registerIds, plain, ELEMENT_IDS, APP };
