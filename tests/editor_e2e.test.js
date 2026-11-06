// Scale editor lane U2b: the one-panel shell in a real browser, flag on. The
// assertions derive from docs/plans/2026-11-06-scale-editor-u2-split.md (U2b)
// and the decisions it cites: D10 (states, Back prompt), D12/SE-2/SE-15 (the
// text line), D13 (layout), D15 (a built-in saves a new scale), D21 (the pan).
// Each test opens the page through the app's own entry points; the two seams it
// reads are the editor session and the saved collection.
const { test, describe, before, after, afterEach } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { launch, findBrowser, APP_READY_EXPR, assertNoUncaught } = require("./helpers/cdp.js");
const { apply } = require("./helpers/editor_flag.js");

const REPO = path.resolve(__dirname, "..");
const BROWSER = findBrowser();
if (!BROWSER) {
  test.skip("editor e2e skipped: no Chromium binary found (set CHROME_BIN to enable)", () => {});
} else {
  run();
}

function run() {
  let server = null;
  let b = null;
  let base = "";
  let flagOn = true;
  const SCALE = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5";

  before(async () => {
    server = http.createServer((req, res) => {
      const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
      const file = path.resolve(REPO, rel);
      if (!file.startsWith(REPO + path.sep)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end(); return; }
        const html = rel === "index.html";
        res.writeHead(200, { "Content-Type": html ? "text/html; charset=utf-8" : "application/octet-stream", "Cache-Control": "no-store" });
        res.end(html ? apply(buf.toString("utf8"), flagOn) : buf);
      });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${server.address().port}/index.html`;
    b = await launch({ foregroundSettle: true });
    assert.ok(b, "browser found but launch() returned null");
  });
  after(async () => {
    if (b) await b.close();
    if (server) await new Promise((r) => server.close(r));
  });
  afterEach(() => assertNoUncaught());

  async function fresh(width = 375, height = 667, on = true) {
    flagOn = on;
    await b.setViewport(width, height, width < 700);
    await b.send("Storage.clearDataForOrigin", { origin: new URL(base).origin, storageTypes: "indexeddb,local_storage" });
    await b.send("Page.navigate", { url: base });
    await b.waitFor(`${APP_READY_EXPR} && booted === true && document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`,
      { timeout: 15000, label: "the app to boot" });
  }
  const openAdd = async () => {
    await b.eval(`openScaleSheet(addChip); return true;`);
    await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor panel" });
  };
  const openBuiltin = async () => {
    await b.eval(`const d = allDeckViews().find((v) => savedEqual(v.selection, selection)).deck; openEditSheet(d, addChip); return true;`);
    await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor panel on a built-in" });
  };
  const model = () => b.eval(`return JSON.parse(JSON.stringify(editorSession.history.present));`);
  const text = () => b.eval(`return document.getElementById("editor-line").value;`);
  const sheetHidden = () => b.eval(`return document.getElementById("scale-sheet").hasAttribute("hidden");`);
  const savedCount = () => b.eval(`return savedState.entries.length;`);
  const dialogOpen = () => b.eval(`const d = document.getElementById("editor-dialog"); return !!d && !d.hasAttribute("hidden");`);
  const typeLine = async (value, { commit = true } = {}) => {
    await b.click("#editor-line");
    await b.eval(`const l = document.getElementById("editor-line"); l.value = ${JSON.stringify(value)};
      l.dispatchEvent(new Event("input", { bubbles: true })); return true;`);
    if (commit) await b.key("Enter", "Enter", 13);
  };
  const pinInner = () => b.eval(`editorSession.history = editorApply(editorSession.history, (m) => editorSetAngle(m, "inner", 0, 125)).history;
    editorRender(); return editorSession.history.present.pins.length;`);

  describe("D13 layout", () => {
    const IDS = ["editor-back", "editor-line", "editor-pan", "editor-areas", "editor-undo", "editor-redo", "editor-remove",
      "editor-reset", "editor-save", "editor-tray"];

    test("375x667: header, line, pan, area slot, toolbar and tray slot are all reachable with no scroll", async () => {
      await fresh(375, 667);
      await openBuiltin();
      const r = await b.eval(`const de = document.documentElement;
        const boxes = Object.fromEntries(${JSON.stringify(IDS)}.map((id) => { const e = document.getElementById(id);
          const q = e.getBoundingClientRect(); return [id, { top: q.top, bottom: q.bottom, left: q.left, right: q.right, w: q.width, h: q.height }]; }));
        return { sh: de.scrollHeight, sw: de.scrollWidth, boxes, ed: (() => { const e = document.getElementById("editor"); return { sh: e.scrollHeight, ch: e.clientHeight, sw: e.scrollWidth, cw: e.clientWidth }; })() };`);
      assert.strictEqual(r.sh, 667, "no vertical page scroll");
      assert.strictEqual(r.sw, 375, "no horizontal page scroll");
      assert.ok(r.ed.sh <= r.ed.ch && r.ed.sw <= r.ed.cw, "the panel itself does not scroll: " + JSON.stringify(r.ed));
      for (const [id, q] of Object.entries(r.boxes)) {
        assert.ok(q.top >= 0 && q.bottom <= 667 && q.left >= 0 && q.right <= 375, id + " is inside the viewport: " + JSON.stringify(q));
      }
      for (const id of ["editor-back", "editor-undo", "editor-redo", "editor-remove", "editor-reset", "editor-save"]) {
        assert.ok(r.boxes[id].h >= 44 && r.boxes[id].w >= 44, id + " is a 44px target: " + JSON.stringify(r.boxes[id]));
      }
      const order = ["editor-back", "editor-line", "editor-pan", "editor-areas", "editor-undo", "editor-tray"].map((id) => r.boxes[id].top);
      assert.deepStrictEqual([...order].sort((x, y) => x - y), order, "header, line, pan, area slot, toolbar, tray slot read top to bottom");
    });

    test("1280x800 renders clean: nothing overflows and every part is in view", async () => {
      await fresh(1280, 800);
      await openBuiltin();
      const r = await b.eval(`const de = document.documentElement;
        const bad = ${JSON.stringify(IDS)}.filter((id) => { const q = document.getElementById(id).getBoundingClientRect();
          return q.width === 0 || q.height === 0 || q.bottom > innerHeight || q.right > innerWidth || q.left < 0 || q.top < 0; });
        return { sh: de.scrollHeight, sw: de.scrollWidth, bad };`);
      assert.deepStrictEqual(r.bad, []);
      assert.strictEqual(r.sw, 1280);
      assert.strictEqual(r.sh, 800);
    });

    test("Remove and Reset spacing are disabled placeholders; Undo and Redo start disabled", async () => {
      await fresh();
      await openBuiltin();
      const r = await b.eval(`return ["editor-undo", "editor-redo", "editor-remove", "editor-reset"].map((id) => document.getElementById(id).disabled);`);
      assert.deepStrictEqual(r, [true, true, true, true]);
    });

    test("every toolbar button has an accessible name and the pan has its name", async () => {
      await fresh();
      await openBuiltin();
      const r = await b.eval(`const name = (id) => (document.getElementById(id).getAttribute("aria-label") || document.getElementById(id).textContent).trim();
        return { names: ["editor-undo", "editor-redo", "editor-remove", "editor-reset", "editor-save"].map(name),
          pan: document.getElementById("editor-pan").getAttribute("aria-label"), role: document.getElementById("editor-pan").getAttribute("role"),
          line: document.getElementById("editor-line").getAttribute("aria-label") };`);
      assert.ok(r.names.every((n) => n.length > 0), JSON.stringify(r.names));
      assert.strictEqual(r.pan, "Pan diagram");
      assert.strictEqual(r.role, "group");
      assert.strictEqual(r.line, "Scale notes - tap to type or paste");
    });
  });

  describe("D21 the pan", () => {
    test("the editor pan is the card renderer's drawing of the solved layout, bottom notes as the outer ring", async () => {
      await fresh();
      await openAdd();
      await typeLine("[A2] [B2] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5");
      const r = await b.eval(`const m = editorSession.history.present; const s = editorSolve(m); const p = HPE.select.PALETTES[m.options.palette || 0];
        const expected = pan({ geom: s.value.geom, fields: s.value.fields, colors: { root: p.root, tone: p.tone } }, null, null);
        const drawn = document.createElement("div"); drawn.innerHTML = document.getElementById("editor-pan").innerHTML;
        drawn.querySelector(".ehit-layer").remove();
        return { same: (() => { const d = document.createElement("div"); d.innerHTML = expected; return d.innerHTML === drawn.innerHTML; })(), bottom: Object.values(m.fields).filter((f) => f[3] === "bottom").length };`);
      assert.ok(r.bottom >= 2, "the fixture has bottom notes");
      assert.strictEqual(r.same, true);
    });

    test("U2b nit 4: every bottom note sits on the outer ring, farther out than every rim and cyclops note", async () => {
      await fresh();
      await openAdd();
      await typeLine("[A2] [B2] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5");
      const r = await b.eval(`const dist = (z) => [...document.querySelectorAll('#editor-pan .ehit[data-ring="' + z + '"]')].map((c) => Math.hypot(+c.getAttribute("cx"), +c.getAttribute("cy")));
        const g = editorSolve(editorSession.history.present).value.geom;
        return { bottom: dist("bottom"), rim: dist("rim"), inner: dist("inner"), want: g.bottom * 100 };`);
      assert.strictEqual(r.bottom.length, 2);
      for (const d of r.bottom) assert.ok(Math.abs(d - r.want) < 0.1 && d > Math.max(...r.rim, ...r.inner), "bottom note at " + d + " vs " + JSON.stringify(r));
    });
  });

  describe("D10 empty scale", () => {
    test("a new scale opens empty: the empty copy shows and Save is disabled", async () => {
      await fresh();
      await openAdd();
      const r = await b.eval(`const e = document.getElementById("editor-empty"); return { shown: !!e && !e.hasAttribute("hidden") && e.textContent.trim().length > 0,
        save: document.getElementById("editor-save").disabled };`);
      assert.deepStrictEqual(r, { shown: true, save: true });
    });
  });

  describe("D12 / SE-2 / SE-15 the text line", () => {
    test("read-only until tapped; Enter on the focused line also starts editing", async () => {
      await fresh();
      await openBuiltin();
      assert.strictEqual(await b.eval(`return document.getElementById("editor-line").readOnly;`), true);
      await b.click("#editor-line");
      assert.strictEqual(await b.eval(`return document.getElementById("editor-line").readOnly;`), false);
      await b.key("Escape", "Escape", 27);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-line").readOnly;`), true);
      await b.eval(`document.getElementById("editor-line").focus(); return true;`);
      await b.key("Enter", "Enter", 13);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-line").readOnly;`), false);
    });

    test("invalid text stays in the line with the parse error until Escape, and the diagram is unchanged", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      const before = await b.eval(`return { pan: document.getElementById("editor-pan").innerHTML, m: JSON.stringify(editorSession.history.present) };`);
      await typeLine("(D3) A3 Q9 C4");
      const during = await b.eval(`const s = document.getElementById("editor-status");
        return { value: document.getElementById("editor-line").value, error: s.textContent.trim(), invalid: document.getElementById("editor-line").getAttribute("aria-invalid"),
          pan: document.getElementById("editor-pan").innerHTML, m: JSON.stringify(editorSession.history.present), ro: document.getElementById("editor-line").readOnly };`);
      assert.strictEqual(during.value, "(D3) A3 Q9 C4", "the typed text is kept");
      assert.ok(during.error.length > 0, "the parse error is shown");
      assert.strictEqual(during.invalid, "true");
      assert.strictEqual(during.ro, false, "still editing");
      assert.strictEqual(during.pan, before.pan, "the diagram is unchanged");
      assert.strictEqual(during.m, before.m, "the model is unchanged");
      assert.strictEqual(await b.eval(`return editorCanUndo(editorSession.history);`), true, "the earlier valid commit is its own step");
      await b.key("Escape", "Escape", 27);
      const after = await b.eval(`return { value: document.getElementById("editor-line").value, error: document.getElementById("editor-status").textContent.trim(),
        invalid: document.getElementById("editor-line").getAttribute("aria-invalid"), ro: document.getElementById("editor-line").readOnly,
        open: !document.getElementById("scale-sheet").hasAttribute("hidden") };`);
      assert.strictEqual(after.value, await text());
      assert.notStrictEqual(after.value, "(D3) A3 Q9 C4", "Escape drops the bad text");
      assert.strictEqual(after.error, "");
      assert.strictEqual(after.invalid, null);
      assert.strictEqual(after.ro, true);
      assert.strictEqual(after.open, true, "Escape while typing does not close the panel");
    });

    test("a valid commit is one Undo step", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      assert.strictEqual(await b.eval(`return editorSession.history.past.length;`), 1);
      await b.click("#editor-undo");
      assert.strictEqual(await b.eval(`return Object.keys(editorSession.history.present.fields).length;`), 0);
    });

    test("changing the notes while pins exist says Pins reset, offers Undo, and Undo brings the pins back", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      assert.strictEqual(await pinInner(), 1);
      await typeLine("(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5 E5");
      const m = await model();
      assert.deepStrictEqual(m.pins, []);
      assert.strictEqual(m.options.angles, undefined);
      assert.match(await b.eval(`return document.getElementById("editor-status").textContent;`), /Pins reset/);
      await b.click("#editor-undo");
      const back = await model();
      assert.strictEqual(back.pins.length, 1);
      assert.ok(back.options.angles && back.options.angles.inner);
    });

    test("the same notes and zones keep the pins and say nothing", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await pinInner();
      const before = await model();
      await typeLine("(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | D5 C5");
      const m = await model();
      assert.deepStrictEqual(m.pins, before.pins);
      assert.deepStrictEqual(m.options.angles, before.options.angles);
      assert.doesNotMatch(await b.eval(`return document.getElementById("editor-status").textContent;`), /Pins reset/);
    });
  });

  describe("pan type", () => {
    test("Standard to Neotone and back are one Undo step each", async () => {
      await fresh();
      await openAdd();
      await typeLine("[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4");
      const steps = () => b.eval(`return editorSession.history.past.length;`);
      const kind = () => b.eval(`return !!editorSession.history.present.options.profile ? "neotone" : "standard";`);
      const s0 = await steps();
      await b.click("#editor-type-neotone");
      assert.strictEqual(await kind(), "neotone");
      assert.strictEqual(await steps(), s0 + 1);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-type-neotone").getAttribute("aria-pressed");`), "true");
      await b.click("#editor-undo");
      assert.strictEqual(await kind(), "standard");
      assert.strictEqual(await steps(), s0);
      await b.click("#editor-redo");
      await b.click("#editor-type-standard");
      assert.strictEqual(await kind(), "standard");
      assert.strictEqual(await steps(), s0 + 2);
      await b.click("#editor-undo");
      assert.strictEqual(await kind(), "neotone");
    });
  });

  describe("D10 the Back prompt", () => {
    test("a clean panel closes with no prompt", async () => {
      await fresh();
      await openBuiltin();
      await b.click("#editor-back");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the sheet to close" });
      assert.strictEqual(await dialogOpen(), false);
    });

    test("Keep editing returns to the panel with the edit intact", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-back");
      assert.strictEqual(await dialogOpen(), true);
      await b.click("#editor-dlg-keep");
      assert.strictEqual(await dialogOpen(), false);
      assert.strictEqual(await sheetHidden(), false);
      assert.match(await text(), /A4/);
    });

    test("Escape while the prompt is open is Keep editing", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-back");
      await b.key("Escape", "Escape", 27);
      assert.strictEqual(await dialogOpen(), false);
      assert.strictEqual(await sheetHidden(), false);
    });

    test("Discard closes and saves nothing", async () => {
      await fresh();
      const before = await savedCount();
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-back");
      await b.click("#editor-dlg-discard");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the sheet to close" });
      assert.strictEqual(await savedCount(), before);
    });

    test("Save saves the scale and closes", async () => {
      await fresh();
      const before = await savedCount();
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-back");
      await b.click("#editor-dlg-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the sheet to close after Save" });
      assert.strictEqual(await savedCount(), before + 1);
    });
  });

  describe("D15 Save", () => {
    test("editing a built-in saves a NEW scale with a new handle and leaves the built-in alone", async () => {
      await fresh();
      const builtin = await b.eval(`return JSON.stringify(DECKS.map((d) => [d.id, d.name, Object.keys(d.fields).length]));`);
      const before = await savedCount();
      await openBuiltin();
      const original = await text();
      await typeLine(original + " E6");
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the sheet to close after Save" });
      assert.strictEqual(await savedCount(), before + 1);
      const saved = await b.eval(`const e = savedState.entries[savedState.entries.length - 1]; return { id: e.instanceId, replaces: e.record.o && e.record.o.replaces, v: e.record.v };`);
      assert.ok(saved.id && !DECK_IDS_HAVE(builtin, saved.id), "a new local handle");
      assert.strictEqual(saved.replaces, undefined, "it does not replace the built-in");
      assert.strictEqual(saved.v, 4, "an unpinned save stays record v4");
      assert.strictEqual(await b.eval(`return JSON.stringify(DECKS.map((d) => [d.id, d.name, Object.keys(d.fields).length]));`), builtin);
      assert.strictEqual(await b.eval(`return savedState.slots && Object.keys(savedState.slots).length;`), 0, "no built-in slot is taken");
    });

    test("Save on an untouched built-in closes without saving", async () => {
      await fresh();
      const before = await savedCount();
      await openBuiltin();
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the sheet to close" });
      assert.strictEqual(await savedCount(), before);
    });

    test("a saved scale opened and saved untouched is byte-equal and keeps its revision", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the first save to close" });
      const snap = () => b.eval(`const e = savedState.entries[savedState.entries.length - 1]; return JSON.stringify([e.instanceId, e.revision, e.record]);`);
      const first = await snap();
      await b.eval(`const view = allDeckViews().find((v) => savedEqual(v.selection, selection)); openEditSheet(view.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor on the saved scale" });
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the second save to close" });
      assert.strictEqual(await snap(), first);
    });

    test("a changed saved scale updates in place: same handle, one more revision", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the first save to close" });
      const before = await b.eval(`const e = savedState.entries[savedState.entries.length - 1]; return { id: e.instanceId, revision: e.revision, n: savedState.entries.length };`);
      await b.eval(`const view = allDeckViews().find((v) => savedEqual(v.selection, selection)); openEditSheet(view.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor on the saved scale" });
      await typeLine(SCALE + " E5");
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the second save to close" });
      const after = await b.eval(`const e = savedState.entries.find((x) => x.instanceId === ${JSON.stringify(before.id)}); return { revision: e.revision, n: savedState.entries.length, s: e.record.s };`);
      assert.strictEqual(after.n, before.n);
      assert.ok(after.revision > before.revision);
      assert.match(after.s, /E5/);
    });
  });

  describe("U2c the tray and tap placement", () => {
    const status = () => b.eval(`return document.getElementById("editor-status").textContent;`);
    const rimNames = () => b.eval(`return editorNames(editorSession.history.present, "rim");`);
    const clientOf = (x, y) => b.eval(`const svg = document.querySelector("#editor-pan svg"); const p = new DOMPoint(${x} * 100, -${y} * 100).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y };`);
    const noteAt = (ring, i) => b.eval(`const r = document.querySelector('#editor-pan .ehit[data-ring="${ring}"][data-i="${i}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
    const tapPoint = async (pt, touch = false) => {
      if (touch) {
        await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pt.x, y: pt.y, id: 1 }] });
        await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else {
        for (const type of ["mousePressed", "mouseReleased"]) await b.send("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", clickCount: 1 });
      }
    };
    const tapSpot = async (x, y, touch) => tapPoint(await clientOf(x, y), touch);
    const tapNote = async (ring, i, touch) => tapPoint(await noteAt(ring, i), touch);
    const polar = (r, deg) => [r * Math.cos(deg * Math.PI / 180), r * Math.sin(deg * Math.PI / 180)];
    const hold = (name) => b.click(`.tray-note[data-name="${name}"]`);
    const setup = async (line) => { await fresh(); await openAdd(); await typeLine(line); };

    test("the tray has the 12 note names, an octave stepper, a flat/sharp toggle and no Ding or Root button (D23)", async () => {
      await setup(SCALE);
      const r = await b.eval(`const tray = document.getElementById("editor-tray");
        return { names: [...document.querySelectorAll("#editor-notes .tray-note")].map((n) => n.textContent), oct: document.getElementById("editor-oct").getAttribute("aria-label"),
          flats: document.getElementById("editor-flats").getAttribute("aria-pressed"), text: tray.textContent, tall: [...tray.querySelectorAll("button")].every((x) => x.getBoundingClientRect().height >= 44) };`);
      assert.deepStrictEqual(r.names, ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]);
      assert.strictEqual(r.oct, "Octave 4");
      assert.strictEqual(r.flats, "false");
      assert.ok(!/ding|root/i.test(r.text), "no Ding/Root button");
      assert.strictEqual(r.tall, true, "44px targets");
    });

    test("holding a note shows the status with a Cancel chip; the held note again, Cancel and Escape each cancel (SE-7)", async () => {
      await setup(SCALE);
      await hold("G");
      assert.strictEqual(await status(), "Holding G4: tap a spot, an area, or the ding.Cancel");
      await hold("G");
      assert.strictEqual(await status(), "");
      await hold("G");
      await b.click("#editor-cancel");
      assert.strictEqual(await status(), "");
      await hold("G");
      await b.key("Escape", "Escape", 27);
      assert.strictEqual(await status(), "");
      assert.strictEqual(await b.eval(`return !document.getElementById("scale-sheet").hasAttribute("hidden");`), true, "Escape cancelled the hold and did not leave");
    });

    test("the octave stepper and the flat toggle are Undo steps and never make a scale dirty (SE-14, SE-15)", async () => {
      await setup(SCALE);
      await b.click("#editor-oct-up");
      assert.strictEqual(await b.eval(`return document.getElementById("editor-oct").textContent;`), "5");
      await b.click("#editor-flats");
      assert.strictEqual(await b.eval(`return document.querySelector(".tray-note[data-name='Bb']") !== null && document.querySelector(".tray-note[data-name='A#']") === null;`), true);
      await b.click("#editor-undo");
      await b.click("#editor-undo");
      assert.deepStrictEqual(await b.eval(`return [document.getElementById("editor-oct").textContent, document.getElementById("editor-flats").getAttribute("aria-pressed")];`), ["4", "false"]);
      assert.strictEqual(await b.eval(`return editorIsDirty(editorSession.base, editorSession.history.present);`), true, "the typed notes are the only change");
      await b.eval(`editorSession.history = editorHistoryNew(editorSession.base); editorRender(); return true;`);
      await b.click("#editor-oct-up");
      assert.strictEqual(await b.eval(`return editorIsDirty(editorSession.base, editorSession.history.present);`), false);
    });

    test("tap-tap placement: a rim note between two rim notes, a cyclops note at its angle, a bottom note at its angle", async () => {
      await setup(SCALE);
      await hold("B");
      await tapSpot(...polar(0.722, 22.5));
      assert.deepStrictEqual((await rimNames()).slice(-2), ["A4", "B4"]);
      assert.strictEqual(await b.eval(`return editorSession.held === null;`), true, "the hold ends on a placement");
      await hold("E");
      await b.click("#editor-oct-up");
      await tapSpot(...polar(0.38, 90));
      let m = await model();
      assert.strictEqual(m.fields && Object.values(m.fields).filter((f) => f[3] === "inner").length, 3);
      assert.deepStrictEqual(m.options.angles.inner.filter((a) => a !== null), [90]);
      assert.strictEqual(m.pins.length, 1);
      await b.eval(`editorSession.history = editorHistoryNew(editorLoad("[A2] " + ${JSON.stringify(SCALE)}).value); editorRender(); return true;`);
      await hold("E");
      await b.click("#editor-oct-down");
      await b.click("#editor-oct-down");
      await tapSpot(...polar(1.15, 150));
      m = await model();
      assert.deepStrictEqual(m.options.angles.bottom.filter((a) => a !== null), [150]);
    });

    test("SE-9: a tray note tapped next to a pinned bottom note never overlaps it", async () => {
      await setup("[A2] " + SCALE);
      await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => editorSetAngle(m, "bottom", 0, 90, true)).history; editorRender(); return true;`);
      await hold("G");
      await b.click("#editor-oct-down");
      await b.click("#editor-oct-down");
      await tapSpot(...polar(1.25, 95));
      assert.strictEqual((await model()).options.angles.bottom.length, 1, "the overlapping add is refused");
      assert.ok((await status()).length > 0 && await b.eval(`return document.getElementById("editor-status").getAttribute("data-kind");`) === "error");
    });

    test("tap-tap swap of two rim notes, with the status, Undo in the status, and Undo of the whole step (D4)", async () => {
      await setup(SCALE);
      await tapNote("rim", 0);
      assert.strictEqual(await b.eval(`return !document.getElementById("editor-remove").disabled;`), true, "a selected note enables Remove");
      await tapNote("rim", 1);
      assert.strictEqual(await status(), "A3 and Bb3 traded places.Undo");
      assert.deepStrictEqual((await model()).options.seats, { rim: [1, 0, 2, 3, 4, 5, 6, 7] });
      await b.click("#editor-notice-undo");
      assert.strictEqual((await model()).options.seats, undefined);
    });

    test("Remove deletes the selected note and Undo restores it; tapping the selection again deselects it", async () => {
      await setup(SCALE);
      await tapNote("rim", 3);
      await tapNote("rim", 3);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-remove").disabled;`), true);
      await tapNote("rim", 3);
      await b.click("#editor-remove");
      assert.ok(!(await rimNames()).includes("D4"));
      assert.strictEqual(await status(), "D4 removed.Undo");
      await b.click("#editor-undo");
      assert.ok((await rimNames()).includes("D4"));
    });

    test("a held note tapped on a placed note replaces it in its seat; Undo restores", async () => {
      await setup(SCALE);
      const before = await b.eval(`return editorSolve(editorSession.history.present).value.fields[3][4];`);
      await hold("B");
      await tapNote("rim", 2);
      assert.deepStrictEqual(await rimNames(), ["A3", "Bb3", "D4", "E4", "F4", "G4", "A4", "B4"]);
      assert.strictEqual(await b.eval(`const f = editorSolve(editorSession.history.present).value.fields; return Object.values(f).find((x) => x[0] === "B" && x[1] === 4)[4];`), before);
      assert.strictEqual(await status(), "C4 replaced by B4.Undo");
      await b.click("#editor-undo");
      assert.ok((await rimNames()).includes("C4"));
    });

    test("D23: a tray note on the ding replaces it; a placed bottom note on the ding swaps seats with it", async () => {
      await setup(SCALE);
      await hold("G");
      await b.click("#editor-oct-down");
      await tapNote("ding", 0);
      assert.strictEqual(await status(), "D3 removed. G3 is the ding.Undo");
      assert.strictEqual(await b.eval(`return editorDingOf(editorSession.history.present);`), "G3");
      await setup("[A2] " + SCALE);
      await tapNote("bottom", 0);
      await tapNote("ding", 0);
      assert.strictEqual(await status(), "A2 is the ding. D3 took its seat.Undo");
      assert.strictEqual(await b.eval(`return editorDingOf(editorSession.history.present);`), "A2");
      assert.deepStrictEqual(await b.eval(`return editorNames(editorSession.history.present, "bottom");`), ["D3"]);
      await b.click("#editor-notice-undo");
      assert.strictEqual(await b.eval(`return editorDingOf(editorSession.history.present);`), "D3");
    });

    test("D9 / SE-12: an add that resets a custom rim seat order says so, with Undo", async () => {
      await setup("(D3) Bb3 A3 C4 D4 E4 F4 G4 A4 | C5 D5");
      assert.deepStrictEqual((await model()).options.seats, { rim: [1, 0, 2, 3, 4, 5, 6, 7] }, "the typed order is honoured");
      await hold("B");
      await tapSpot(...polar(0.722, 22.5));
      assert.strictEqual(await status(), "Custom seat order resetUndo");
      assert.strictEqual((await model()).options.seats, undefined);
    });

    test("SE-11: a bottom trade the engine refuses shows the existing copy and changes nothing", async () => {
      await setup(SCALE);
      const names = await b.eval(`const notes = Array.from({ length: 23 }, (_, k) => "[" + "CDEFGAB"[k % 7] + (1 + Math.floor(k / 7)) + "]").join(" ");
        const angles = { bottom: Array.from({ length: 23 }, (_, k) => (k === 22 ? 90 : null)) };
        const loaded = editorLoad(notes + " (A3) C4 D4 E4 F4", { angles });
        editorSession.history = editorHistoryNew(loaded.value); editorRender();
        return [editorNames(loaded.value, "bottom")[0], editorNames(loaded.value, "bottom")[2]];`);
      const before = await model();
      await tapNote("bottom", 0);
      await tapNote("bottom", 2);
      assert.strictEqual(await status(), await b.eval(`return t("sheet.cannot_trade", { a: ${JSON.stringify(names[0])}, b: ${JSON.stringify(names[1])}, step: ANGLE_STEP });`));
      assert.deepStrictEqual(await model(), before);
    });

    test("D23 copy: a rim or cyclops note dropped on the ding is refused with a plain message; the hint only promises a bottom note", async () => {
      await setup("[A2] " + SCALE);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-hint").textContent;`), "Drop a bottom note on the ding to swap it with the root.");
      const before = await model();
      await tapNote("rim", 0);
      await tapNote("ding", 0);
      assert.strictEqual(await status(), "Only a bottom note can swap with the ding.");
      assert.deepStrictEqual(await model(), before);
    });

    test("D23 with a bottom copy of a rim note: a held tray note still replaces a rim note and the ding", async () => {
      await setup("[C4] " + SCALE);
      await hold("G");
      await tapNote("rim", 0);
      assert.strictEqual(await b.eval(`return editorNames(editorSession.history.present, "rim")[0];`), "Bb3", "the A3 seat took G4's place in pitch order");
      assert.ok(!(await status()).includes("is not a note"));
    });

    test("SE-15: the note labels are exposed, so no ancestor of a hit target is role=img", async () => {
      await setup("[A2] " + SCALE);
      const r = await b.eval(`const c = document.querySelector("#editor-pan .ehit"); return { img: !!c.closest('[role="img"]') && c.closest('[role="img"]') !== c, inside: !!c.parentElement.closest('[role="img"]'), pan: document.getElementById("editor-pan").getAttribute("role"), name: document.getElementById("editor-pan").getAttribute("aria-label") };`);
      assert.strictEqual(r.inside, false);
      assert.strictEqual(r.pan, "group");
      assert.strictEqual(r.name, "Pan diagram");
    });

    test("SE-15: every note carries its zone and seat in its accessible name", async () => {
      await setup("[A2] " + SCALE);
      const r = await b.eval(`return [...document.querySelectorAll("#editor-pan .ehit")].map((c) => c.getAttribute("aria-label"));`);
      for (const want of ["A3, rim seat 1", "Bb3, rim seat 2", "C5, cyclops seat 1", "A2, bottom seat 1", "D3, ding"]) assert.ok(r.includes(want), want + " in " + JSON.stringify(r));
    });

    test("the same tap-tap place and swap work by touch (CDP touch events)", async () => {
      await setup(SCALE);
      await hold("B");
      await tapSpot(...polar(0.722, 22.5), true);
      assert.deepStrictEqual((await rimNames()).slice(-2), ["A4", "B4"]);
      await tapNote("rim", 0, true);
      await tapNote("rim", 1, true);
      assert.deepStrictEqual((await model()).options.seats, { rim: [1, 0, 2, 3, 4, 5, 6, 7, 8] });
    });
  });

  describe("flag off", () => {
    test("with the flag off no editor panel is ever built and the legacy sheet opens", async () => {
      await fresh(375, 667, false);
      await b.eval(`openScaleSheet(addChip); return true;`);
      const r = await b.eval(`return { editor: !!document.getElementById("editor"), line: !!document.getElementById("editor-line"),
        legacy: getComputedStyle(document.querySelector("#scale-sheet .sheetsurf")).display !== "none", cls: document.getElementById("scale-sheet").classList.contains("onepanel") };`);
      assert.deepStrictEqual(r, { editor: false, line: false, legacy: true, cls: false });
    });
  });
}

function DECK_IDS_HAVE(builtinJson, id) {
  return JSON.parse(builtinJson).some((row) => row[0] === id);
}
