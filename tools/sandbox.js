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
  "scale-mirror-bottom", "scale-box-wrap", "scale-swatches", "scale-generate", "deck-add",
  // Phase 4 Edit state, registered here the same way the Phase 3 ids were.
  "scale-name-row", "scale-name", "scale-degrees-row", "scale-degrees",
  "scale-delete-row", "scale-delete", "scale-del-note",
  // Phase 5 LAYOUT section, additive like the two before it.
  "scale-layout-row", "scale-rot-l", "scale-rot-r",
  "scale-move-l", "scale-move-r", "scale-layout-reset",
  // The pan-layout preview, additive like every row above it.
  "scale-preview",
  // Stage 2: the page header. The sheet became a full-screen page, so it has a
  // BACK control and a visible title where the drawer had neither.
  "scale-back", "scale-title",
  // Lane M1: the settings panel that now hosts the mode toggle and print
  // controls, plus its header trigger and scrim.
  "settings-trigger", "settings-scrim", "settings-panel",
  "print-paper-select",
  // Lane S2: the sequence-mode toggle, its credit paragraph and source link.
  "panel-seq-note", "seq-source-link",
  "seq-style", "seq-style-name", "seq-style-tip", "foot",
  // sequence-difficulty D2: the three tier buttons of the five-button Practice
  // group (they replaced "modeS" and the Difficulty group).
  "tier-basic", "tier-intermediate", "tier-advanced"];

/** Copy a value out of the vm realm, so assert.deepStrictEqual can compare it. */
const plain = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

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
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
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
    focus() {}, blur() {},
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
 */
function boot(opts = {}) {
  const html = fs.readFileSync(APP, "utf8");
  // Every inline block, in document order; <script src=...> is skipped (the app
  // is single-file by contract, so there should never be one).
  const blockMatches = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  const blocks = blockMatches.map((m) => m[1]);
  if (!blocks.length) throw new Error("no inline <script> found in index.html");
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
    el.focus = () => { focusState.active = el; };
    el.blur = () => { if (focusState.active === el) focusState.active = null; };
    return opts.layout ? addLayout(el) : el;
  };
  for (const id of ELEMENT_IDS) els[id] = bindFocus(makeElement(id));
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
  for (const [, tag, id] of html.matchAll(/<(?:div|section|aside|p|span)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
    if (els[id] && /\bhidden\b/.test(tag)) els[id].hidden = true;
  }
  // Ancestry from a tag-stack walk of the shipped markup, so a control inside a
  // hidden container has no client rects without a hand-kept table.
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
      if (id && els[id[1]]) {
        const up = [...stack].reverse().find((f) => f.id && els[f.id]);
        if (up) els[id[1]]._markupParent = els[up.id];
      }
      if (!VOID.has(name) && !selfClose) stack.push({ tag: name, id: id && id[1] });
    }
  }
  const created = [];
  const markupNodes = [];
  if (html.includes('<div class="announce"')) {
    const node = bindFocus(makeElement("announce"));
    node.className = "announce";
    markupNodes.push(node);
  }
  const store = { ...(opts.storage || {}) };
  const docEl = makeElement("root", "html");

  // Each boot gets its own Math so stubbing random cannot leak across tests.
  const mathStub = Object.create(Math);
  if (opts.random) mathStub.random = opts.random;

  const all = () => [...Object.values(els), docEl, ...(layoutMain ? [layoutMain] : []), ...markupNodes, ...created];
  const match = (el, sel) => {
    if (sel.startsWith("#")) return el.id === sel.slice(1);
    if (sel.startsWith(".")) return el.classList.contains(sel.slice(1));
    return el.tagName === sel.toUpperCase();
  };
  const queryAll = (sel) => {
    const parts = String(sel).split(",").map((s) => s.trim()).filter(Boolean);
    return all().filter((el) => parts.some((p) => match(el, p)));
  };

  // Timers: queued so a recurring timer cannot hang a unit test.
  // flushTimers() drains the queue in due order.
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
      timers.set(id, { fn, ms: ms || 0, args, seq: id });
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
    },
    // M3 (desktop sidebar, 2026-09-28): the app reads window.matchMedia once,
    // at boot, to gate the settings panel's modal wiring to below the
    // desktop-sidebar breakpoint. `matches` is always false here - this stub
    // never simulates a resize - so boot in this DOM-stubbed sandbox always
    // sees the below-breakpoint (mobile/hamburger) state; the breakpoint
    // itself is only meaningfully exercised in the e2e suite, which drives a
    // real browser and a real viewport.
    matchMedia: (query) => ({
      matches: false, media: query,
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
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(combinedSrc, sandbox, { filename: APP });

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
    els, store, sandbox, created, location, history, blocks, flushTimers,
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
  };
}

module.exports = { boot, plain, ELEMENT_IDS, APP };
