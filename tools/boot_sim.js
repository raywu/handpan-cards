// DOM-stubbed boot simulation for index.html: boots the app with a minimal
// document stub, then exercises every card of every deck in both modes
// (flip, step, deck switch, shuffle) and checks the rendered HTML.
// No dependencies - run with: node tools/boot_sim.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) { console.error("no script block found"); process.exit(1); }

function el(id) {
  return {
    id, _html: "", _text: "", children: [], listeners: {},
    set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; },
    set textContent(v) { this._text = v; }, get textContent() { return this._text; },
    classList: {
      _set: new Set(),
      toggle(c, on) { on === undefined ? (this._set.has(c) ? this._set.delete(c) : this._set.add(c)) : on ? this._set.add(c) : this._set.delete(c); },
      add(c) { this._set.add(c); }, remove(c) { this._set.delete(c); },
    },
    style: { _props: {}, setProperty(k, v) { this._props[k] = v; } },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    appendChild(c) { this.children.push(c); },
    onclick: null,
  };
}
const els = {};
["decks", "card", "front", "back", "count", "prev", "next", "shuffle", "modeA", "modeB"]
  .forEach(id => els[id] = el(id));

let store = {};
const sandbox = {
  localStorage: {
    getItem: k => store[k] || null,
    setItem: (k, v) => { store[k] = v; },
  },
  document: {
    getElementById: id => { if (!els[id]) throw new Error("missing #" + id); return els[id]; },
    createElement: () => el("dyn"),
    documentElement: el("root"),
    addEventListener: () => {},
  },
  console, Math, JSON, Array, Set, Object,
};
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox);   // boot - the order-guard must hold here

if (!els.front._html.includes("hdr")) throw new Error("front not rendered at boot");
console.log("boot OK - default deck rendered, count =", els.count._text);

const german = /\b(MOLL|VERMINDERT|HALBVERMINDERT|LEGENDE)\b|\bDUR\b/;
const DECKS = vm.runInContext("DECKS", sandbox);
let cards = 0;
for (const d of DECKS) {
  const chip = els.decks.children.find(c => c._html.includes(d.name));
  chip.onclick();
  for (const mode of ["A", "B"]) {
    vm.runInContext(`setMode("${mode}")`, sandbox);
    const n = vm.runInContext("order.length", sandbox);
    for (let i = 0; i < n; i++) {
      els.card.listeners.click[0]();      // flip
      const faces = els.front._html + els.back._html;
      if (german.test(faces)) throw new Error("German in render: " + d.id + " card " + i);
      if (!faces.includes("<svg")) throw new Error("no SVG: " + d.id + " " + i);
      if (mode === "A") cards++;
      els.next.onclick();                 // step resets flip
    }
  }
  // deck colours must flow into CSS vars and the rendered SVG
  const rootVar = sandbox.document.documentElement.style._props["--root"];
  if (rootVar !== d.colors.root)
    throw new Error(d.id + " --root is " + rootVar + ", expected " + d.colors.root);
  if (!(els.front._html + els.back._html).includes(d.colors.root))
    throw new Error(d.id + " root colour not present in render");
}
els.shuffle.onclick.call(els.shuffle);
if (cards !== 59) throw new Error("expected 59 cards, exercised " + cards);
console.log("exercised", cards, "cards x 2 modes; no German, SVG + deck colours present, shuffle OK");
