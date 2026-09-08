// Boot simulation for index.html: boots the app against the shared DOM stub in
// tests/helpers/sandbox.js, then exercises every card of every deck in both
// modes (flip, step, deck switch, shuffle) and checks the rendered HTML.
// No dependencies - run with: node tools/boot_sim.js
const path = require("node:path");
const { boot } = require(path.join(__dirname, "..", "tests", "helpers", "sandbox.js"));

const app = boot();
if (!app.els.front.innerHTML.includes("hdr")) throw new Error("front not rendered at boot");
console.log("boot OK - default deck rendered, count =", app.els.count.textContent);

const german = /\b(MOLL|VERMINDERT|HALBVERMINDERT|LEGENDE)\b|\bDUR\b/;
const DECKS = app.get("DECKS");
let cards = 0;
for (const d of DECKS) {
  app.clickChip(d.name);
  for (const mode of ["A", "B"]) {
    app.run(`setMode("${mode}")`);
    const n = app.get("order.length");
    for (let i = 0; i < n; i++) {
      app.flip();
      const faces = app.faces();
      if (german.test(faces)) throw new Error("German in render: " + d.id + " card " + i);
      if (!faces.includes("<svg")) throw new Error("no SVG: " + d.id + " " + i);
      if (mode === "A") cards++;
      app.els.next.onclick();
    }
  }
  const rootVar = app.cssVar("--root");
  if (rootVar !== d.colors.root)
    throw new Error(d.id + " --root is " + rootVar + ", expected " + d.colors.root);
  if (!app.faces().includes(d.colors.root))
    throw new Error(d.id + " root colour not present in render");
}
app.els.shuffle.onclick.call(app.els.shuffle);
if (cards !== 59) throw new Error("expected 59 cards, exercised " + cards);
console.log("exercised", cards, "cards x 2 modes; no German, SVG + deck colours present, shuffle OK");
