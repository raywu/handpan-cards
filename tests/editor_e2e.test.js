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
  let dragTouch = true;
  const SCALE = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5";
  const RIM8 = "A3 Bb3 C4 D4 E4 F4 G4 A4";

  before(async () => {
    server = http.createServer((req, res) => {
      const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
      const file = path.resolve(REPO, rel);
      if (!file.startsWith(REPO + path.sep)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end(); return; }
        const html = rel === "index.html";
        res.writeHead(200, { "Content-Type": html ? "text/html; charset=utf-8" : "application/octet-stream", "Cache-Control": "no-store" });
        res.end(html ? apply(buf.toString("utf8"), flagOn).replace("const DRAG_ON_TOUCH = true;", () => "const DRAG_ON_TOUCH = " + dragTouch + ";") : buf);
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

  async function fresh(width = 375, height = 667, on = true, touchDrag = true) {
    flagOn = on;
    dragTouch = touchDrag;
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

    test("Undo, Redo, Remove and Reset spacing start disabled with nothing edited, selected or pinned", async () => {
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
    const clientOf = (x, y) => b.eval(`const svg = document.querySelector("#editor-pan svg"); const p = new DOMPoint(${x} * 100, -(${y}) * 100).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y };`);
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
      await hold("B");
      await tapNote("rim", 0);
      assert.strictEqual(await b.eval(`return editorNames(editorSession.history.present, "rim")[0];`), "Bb3", "A3 gave way to B4 in pitch order");
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

    describe("U2d area pills, caps, crowded refusal, Reset spacing", () => {
      const pill = (ring) => b.eval(`const p = document.getElementById("editor-pill-${ring}"); return { text: p.textContent, aria: p.getAttribute("aria-label"), disabled: p.disabled, full: p.getAttribute("aria-disabled") === "true" };`);
      const reset = () => b.eval(`const r = document.getElementById("editor-reset"); const vis = (c) => getComputedStyle(r.querySelector(c)).display !== "none";
        return { aria: r.getAttribute("aria-label"), disabled: r.disabled, visible: [...r.querySelectorAll("span")].filter((x) => getComputedStyle(x).display !== "none").map((x) => x.textContent).join("|") };`);
      const linkOf = () => b.eval(`return editorExport(editorSession.history.present).link.value;`);
      const pastLen = () => b.eval(`return editorSession.history.past.length;`);
      const RIM12 = "A3 Bb3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5";
      const BOT_LINE = (n) => ["A2", "B2", "C3", "E3", "F3", "G3", "Bb2", "Db3", "Eb3", "Gb3", "Ab3", "B3"].slice(0, n).map((x) => "[" + x + "]").join(" ");

      test("D17: the pills read '+ Rim n of 12', '+ Cyclops n of 6', '+ Bottom n of 12', wait for a held note, and add it at its auto position", async () => {
        await setup(SCALE);
        assert.deepStrictEqual(await pill("rim"), { text: "+ Rim 8 of 12", aria: "Add the held note to the rim, 8 of 12", disabled: false, full: false });
        assert.strictEqual((await pill("inner")).text, "+ Cyclops 2 of 6");
        assert.strictEqual((await pill("bottom")).text, "+ Bottom 0 of 12");
        assert.strictEqual(await b.eval(`return document.getElementById("editor-pills").getAttribute("aria-label");`), "Add the held note to an area");
        await hold("B");
        assert.strictEqual((await pill("rim")).disabled, false);
        await b.click("#editor-pill-rim");
        assert.deepStrictEqual((await rimNames()).slice(-2), ["A4", "B4"], "pitch-order seat");
        assert.strictEqual((await pill("rim")).text, "+ Rim 9 of 12", "the count follows the model live");
        assert.strictEqual(await b.eval(`return editorSession.held === null;`), true);
        await hold("E");
        await b.click("#editor-oct-down");
        await b.click("#editor-pill-bottom");
        let m = await model();
        assert.strictEqual(Object.values(m.fields).filter((f) => f[3] === "bottom").length, 1);
        assert.strictEqual(m.options.angles, undefined, "an area add is auto, never pinned");
        await hold("C");
        for (let k = 0; k < 3; k++) await b.click("#editor-oct-up");
        await b.click("#editor-pill-inner");
        assert.strictEqual((await pill("inner")).text, "+ Cyclops 3 of 6", await status());
        await b.click("#editor-undo");
        assert.strictEqual((await pill("inner")).text, "+ Cyclops 2 of 6");
      });

      test("D16: a full area's pill is aria-disabled and a tap or pill into it is refused with the exact copy", async () => {
        await setup("(D3) " + RIM12 + " | C6");
        assert.deepStrictEqual(await pill("rim"), { text: "+ Rim 12 of 12", aria: "Add the held note to the rim, 12 of 12", disabled: false, full: true });
        const core = () => b.eval(`const m = editorSession.history.present; return { parts: editorPartsOf(m), ding: editorDingOf(m), options: m.options };`);
        const before = await core();
        await hold("F");
        await b.click("#editor-oct-up");
        await b.click("#editor-pill-rim");
        assert.strictEqual(await status(), "The rim is full at 12 notes. Remove one first.");
        assert.deepStrictEqual(await core(), before);
        assert.strictEqual(await b.eval(`return editorSession.held !== null;`), true, "the note is still held");
        await b.eval(`editorPlaceHeld({ kind: "spot", ring: "rim" }, editorSession.history.present); return true;`);
        assert.strictEqual(await status(), "The rim is full at 12 notes. Remove one first.", "a drop into the rim is refused too");
        assert.deepStrictEqual(await core(), before);
        await b.click("#editor-pill-inner");
        assert.strictEqual((await model()).fields && Object.values((await model()).fields).filter((f) => f[3] === "inner").length, 2, "another area still takes it");
      });

      test("D16 e2e: the 6th cyclops note is refused as crowded with a bottom note present; the 12th bottom note is accepted with 4 cyclops", async () => {
        await setup(BOT_LINE(1) + " (D3) " + RIM8 + " | C5 D5 E5 F5 G5");
        await hold("A");
        await b.click("#editor-oct-up");
        await b.click("#editor-oct-up");
        await b.click("#editor-pill-inner");
        assert.strictEqual(await status(), "Too crowded: labels would print at 2.71 pt, under 3.6 pt. Remove a note first.");
        assert.strictEqual(Object.values((await model()).fields).filter((f) => f[3] === "inner").length, 5);
        await setup(BOT_LINE(11) + " (D3) " + RIM8 + " | C5 D5 E5 F5");
        await hold("D");
        await b.click("#editor-oct-down");
        await b.click("#editor-oct-down");
        await b.click("#editor-pill-bottom");
        assert.strictEqual(await b.eval(`return editorNames(editorSession.history.present, "bottom").length;`), 12, await status());
        assert.strictEqual(await status(), "D2 added to the bottom.Undo");
      });

      test("parity 9 save: an over-cap scale saves with the same record and share link; only a further add into that area is refused", async () => {
        const OVER = "(D3) " + RIM12 + " F5";
        await setup(OVER);
        const want = await b.eval(`const s = HPE.core.parseSeed(${JSON.stringify(OVER)}); const seed = { fields: s.value.fields, options: s.value.options }; return { record: scaleRecord(seed), link: shareLink(seed).value };`);
        assert.strictEqual(await linkOf(), want.link);
        await hold("G");
        await b.click("#editor-pill-rim");
        assert.strictEqual(await status(), "The rim is full at 12 notes. Remove one first.");
        await hold("G");
        assert.strictEqual(await b.eval(`return editorSession.held === null;`), true);
        await b.click("#editor-save");
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the save to close" });
        const got = await b.eval(`const e = savedState.entries[savedState.entries.length - 1]; return e.record;`);
        assert.strictEqual(got.s, want.record.s);
        assert.strictEqual(got.v, want.record.v);
      });

      test("D5: a cyclops note tapped at an exact angle saves as record v6 and reloads pinned", async () => {
        await setup(SCALE);
        await hold("E");
        await b.click("#editor-oct-up");
        await tapSpot(...polar(0.38, 90));
        assert.deepStrictEqual((await model()).options.angles.inner.filter((a) => a !== null), [90]);
        await b.click("#editor-save");
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the save to close" });
        const rec = await b.eval(`const e = savedState.entries[savedState.entries.length - 1]; return { v: e.record.v, inner: e.record.o.angles.inner };`);
        assert.strictEqual(rec.v, 6);
        assert.deepStrictEqual(rec.inner.filter((a) => a !== null), [90]);
        await b.eval(`const view = allDeckViews().find((v) => savedEqual(v.selection, selection)); openEditSheet(view.deck, addChip); return true;`);
        await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor on the saved scale" });
        assert.deepStrictEqual((await model()).options.angles.inner.filter((a) => a !== null), [90]);
        assert.strictEqual((await model()).pins.length, 1);
      });

      test("parity 6 / Re-space e2e: pins stay on an add; Reset bottom spacing re-spaces and drops at-, Undo restores; Reset spacing (2) clears both in one step, v8 gone", async () => {
        await setup(BOT_LINE(3) + " (D3) " + RIM8 + " | C5 D5 E5");
        for (const [ring, i, g] of [["bottom", 0, 60], ["bottom", 1, 120], ["inner", 2, 120]]) {
          await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => editorSetAngle(m, ${JSON.stringify(ring)}, ${i}, ${g}, true)).history; editorRender(); return true;`);
        }
        assert.strictEqual((await model()).pins.length, 3);
        await hold("E");
        await b.click("#editor-oct-down");
        await b.click("#editor-pill-bottom");
        assert.strictEqual((await model()).pins.length, 3, "the add keeps the pins");
        assert.strictEqual(await b.eval(`return editorNames(editorSession.history.present, "bottom").length;`), 4);
        assert.match(await linkOf(), /at-/);
        const unpinnedIdx = await b.eval(`const a = editorSession.history.present.options.angles.bottom; return a.findIndex((x) => x === null);`);
        await tapNote("bottom", unpinnedIdx);
        assert.deepStrictEqual(await reset(), { aria: "Reset bottom spacing", disabled: false, visible: "Reset spacing" });
        const before = await model();
        const steps = await pastLen();
        await b.click("#editor-reset");
        assert.strictEqual(await pastLen(), steps + 1, "one Undo step");
        const after = await model();
        assert.strictEqual(after.options.angles.bottom, undefined);
        assert.deepStrictEqual(after.options.angles.inner, before.options.angles.inner, "the cyclops pin is untouched");
        assert.doesNotMatch(await linkOf(), /at-/);
        assert.deepStrictEqual(await b.eval(`const s = editorSolve(editorSession.history.present).value; return editorAnglesOf({ value: s }, "bottom");`),
          await b.eval(`return HPE.layout.bottomAngles(4);`).then((x) => x));
        await b.click("#editor-undo");
        assert.deepStrictEqual(await model(), before, "Undo restores the pins");
        await b.eval(`editorSession.sel = null; editorRender(); return true;`);
        assert.strictEqual((await reset()).aria, "Reset cyclops and bottom spacing");
        assert.strictEqual(await b.eval(`return document.getElementById("editor-reset").querySelector(".rs-short").textContent;`), "Reset spacing");
        const steps2 = await pastLen();
        await b.click("#editor-reset");
        assert.strictEqual(await pastLen(), steps2 + 1, "both clear in one step");
        const cleared = await model();
        assert.strictEqual(cleared.options.angles, undefined);
        assert.deepStrictEqual(cleared.pins, []);
        assert.doesNotMatch(await linkOf(), /#s=8/);
        assert.strictEqual((await reset()).disabled, true, "nothing left to reset");
      });

      test("D18 cyclops: resetting cyclops spacing drops the link back from v8", async () => {
        await setup(SCALE);
        await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => editorSetAngle(m, "inner", 0, 150, true)).history; editorRender(); return true;`);
        assert.match(await linkOf(), /#s=8/);
        await tapNote("inner", 0);
        assert.deepStrictEqual(await reset(), { aria: "Reset cyclops spacing", disabled: false, visible: "Reset spacing" });
        await b.click("#editor-reset");
        assert.doesNotMatch(await linkOf(), /#s=8/);
        assert.strictEqual((await model()).options.angles, undefined);
      });

      test("D18 zone: tapping the empty bottom ring selects the zone and scopes Reset to it; tapping it again clears the zone", async () => {
        await setup("[A2] " + SCALE);
        await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => editorSetAngle(m, "bottom", 0, 60, true)).history; editorRender(); return true;`);
        await tapSpot(...polar(1.15, 150));
        assert.strictEqual(await b.eval(`return editorSession.zone;`), "bottom");
        assert.deepStrictEqual(await reset(), { aria: "Reset bottom spacing", disabled: false, visible: "Reset spacing" });
        await tapSpot(...polar(1.15, 150));
        assert.strictEqual(await b.eval(`return editorSession.zone;`), null);
        await tapSpot(...polar(1.15, 150));
        await b.click("#editor-reset");
        assert.strictEqual((await model()).options.angles, undefined);
      });

      test("an empty cyclops arc and bottom ring show as targets for a held note and take the first note by tap or pill", async () => {
        await setup("(D3) " + RIM8);
        assert.strictEqual(await b.eval(`return document.querySelectorAll("#editor-pan .etarget").length;`), 2, "the empty cyclops arc and bottom band are drawn without a hold (v4 zones)");
        await hold("E");
        await b.click("#editor-oct-up");
        assert.deepStrictEqual(await b.eval(`return [...document.querySelectorAll("#editor-pan .etarget")].map((e) => e.dataset.ring);`), ["inner", "bottom"]);
        await tapSpot(...polar(0.38, 90));
        assert.deepStrictEqual(await b.eval(`return editorNames(editorSession.history.present, "inner");`), ["E5"], await status());
        await hold("E");
        await b.click("#editor-oct-down");
        await b.click("#editor-oct-down");
        await tapSpot(...polar(1.15, 150));
        assert.deepStrictEqual(await b.eval(`return editorNames(editorSession.history.present, "bottom");`), ["E3"], await status());
        await hold("F");
        await b.click("#editor-pill-bottom");
        assert.strictEqual((await pill("bottom")).text, "+ Bottom 2 of 12");
      });

      test("the octave stepper carries a visible Octave label and keeps its Octave n accessible name", async () => {
        await setup(SCALE);
        assert.strictEqual(await b.eval(`return document.getElementById("editor-oct-label").textContent;`), "Octave");
        assert.strictEqual(await b.eval(`return getComputedStyle(document.getElementById("editor-oct-label")).display !== "none";`), true);
        assert.strictEqual(await b.eval(`return document.getElementById("editor-oct").getAttribute("aria-label");`), "Octave 4");
      });

      test("D18 labels: a wide screen shows the scoped label, a phone shows 'Reset spacing' with the scope in the accessible name", async () => {
        await fresh(1100, 800);
        await openAdd();
        await typeLine("[A2] [B2] " + SCALE);
        await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => editorSetAngle(m, "bottom", 0, 60, true)).history; editorSession.sel = { ring: "bottom", i: 0 }; editorRender(); return true;`);
        assert.deepStrictEqual(await reset(), { aria: "Reset bottom spacing", disabled: false, visible: "Reset bottom spacing" });
        await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => editorSetAngle(m, "inner", 0, 150, true)).history; editorSession.sel = null; editorRender(); return true;`);
        assert.deepStrictEqual(await reset(), { aria: "Reset cyclops and bottom spacing", disabled: false, visible: "Reset spacing (2)" });
        await fresh(375, 667);
        await openAdd();
        await typeLine("[A2] [B2] " + SCALE);
        await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => editorSetAngle(m, "bottom", 0, 60, true)).history; editorSession.sel = { ring: "bottom", i: 0 }; editorRender(); return true;`);
        assert.deepStrictEqual(await reset(), { aria: "Reset bottom spacing", disabled: false, visible: "Reset spacing" });
      });

      test("D18 disabled cases: a rim note or the ding selected gives an empty scope; Neotone disables Reset and hides the pills", async () => {
        await setup("[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4");
        await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => editorSetAngle(m, "bottom", 0, 60, true)).history; editorRender(); return true;`);
        assert.strictEqual((await reset()).disabled, false);
        await tapNote("rim", 0);
        assert.deepStrictEqual(await reset(), { aria: "Reset spacing", disabled: true, visible: "Reset spacing" });
        await tapNote("rim", 0);
        await tapNote("ding", 0);
        assert.strictEqual((await reset()).disabled, true);
        await tapNote("ding", 0);
        await b.click("#editor-type-neotone");
        assert.strictEqual((await reset()).disabled, true);
        assert.strictEqual(await b.eval(`return document.getElementById("editor-pills").hasAttribute("hidden");`), true);
      });

      test("U2c nit 2: a tray note still replaces the ding when a bottom copy of a rim note is present", async () => {
        await setup("[C4] " + SCALE);
        await hold("G");
        await b.click("#editor-oct-down");
        await tapNote("ding", 0);
        assert.strictEqual(await status(), "D3 removed. G3 is the ding.Undo");
        assert.strictEqual(await b.eval(`return editorDingOf(editorSession.history.present);`), "G3");
        assert.deepStrictEqual(await b.eval(`return editorNames(editorSession.history.present, "bottom");`), ["C4"]);
      });
    });

    describe("U2f drag and drop, trash, touch flag", () => {
      const chipAt = (name) => b.eval(`const r = document.querySelector('.tray-note[data-name="${name}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
      const centreOf = (sel) => b.eval(`const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
      const orbit = (ring) => b.eval(`return editorSolve(editorSession.history.present).value.geom[${JSON.stringify(ring)}];`);
      const spotAt = async (r, deg) => clientOf(...polar(typeof r === "string" ? await orbit(r) : r, deg));
      const trashShown = () => b.eval(`const t = document.getElementById("editor-trash"); return !!t && !t.hasAttribute("hidden") && getComputedStyle(t).display !== "none";`);
      const pastLen = () => b.eval(`return editorSession.history.past.length;`);
      const core = () => b.eval(`const m = editorSession.history.present; return { parts: editorPartsOf(m), ding: editorDingOf(m), options: m.options };`);
      const ghostText = () => b.eval(`const g = document.querySelector(".editor-ghost"); return g ? g.textContent : null;`);
      // A real pointer gesture through CDP: press, move in steps, optionally stop mid-way for a look, release.
      const gesture = async (from, to, kind, { mid, release = true } = {}) => {
        const at = (k) => ({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
        const steps = [0.25, 0.5, 0.75, 1];
        if (kind === "touch") {
          await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
          for (const k of steps) {
            await b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at(k), id: 1 }] });
            if (mid && k === 0.5) await mid();
          }
          if (release) await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        } else {
          await b.send("Input.dispatchMouseEvent", { type: "mousePressed", ...from, button: "left", buttons: 1, clickCount: 1 });
          for (const k of steps) {
            await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...at(k), button: "left", buttons: 1 });
            if (mid && k === 0.5) await mid();
          }
          if (release) await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...to, button: "left", buttons: 0, clickCount: 1 });
        }
        if (release) await new Promise((done) => setTimeout(done, 80));
      };
      const names = (ring) => b.eval(`return editorNames(editorSession.history.present, ${JSON.stringify(ring)});`);

      for (const kind of ["mouse", "touch"]) {
        describe(kind, () => {
          test("D3: a tray note dragged to a rim spot, a cyclops spot and a bottom spot is placed there", async () => {
            await setup(SCALE);
            await gesture(await chipAt("B"), await spotAt(0.722, 22.5), kind, { mid: async () => {
              assert.strictEqual(await ghostText(), "B4", "the ghost carries the note name");
              assert.strictEqual(await trashShown(), false, "the trash stays hidden for a tray drag");
              assert.strictEqual(await status(), "Dragging B4: drop on a spot, a note, or the trash.");
            } });
            assert.deepStrictEqual((await rimNames()).slice(-2), ["A4", "B4"]);
            assert.strictEqual(await trashShown(), false, "the trash is gone after the drop");
            assert.strictEqual(await ghostText(), null);
            await b.click("#editor-oct-up");
            assert.strictEqual(await b.eval(`return document.getElementById("editor-oct").textContent;`), "5");
            await gesture(await chipAt("E"), await spotAt("inner", 90), kind);
            assert.strictEqual((await names("inner")).length, 3, await status());
            assert.ok((await model()).options.angles.inner.includes(90));
            await b.click("#editor-oct-down");
            await b.click("#editor-oct-down");
            await gesture(await chipAt("F"), await spotAt(1.15, 150), kind);
            assert.deepStrictEqual(await names("bottom"), ["F3"]);
            assert.ok(await pastLen() >= 3, "each drop is an Undo step");
          });

          test("U2f move at 375x667: a placed cyclops note dragged along its arc moves to the drop angle, pinned, in one Undo step", async () => {
            await fresh(375, 667, true, true);
            await openAdd();
            await typeLine(SCALE);
            await b.click("#editor-oct-up");
            await gesture(await chipAt("E"), await spotAt("inner", 90), kind);
            const before = await pastLen();
            const was = (await names("inner")).slice();
            await gesture(await noteAt("inner", 2), await spotAt("inner", 120), kind);
            assert.deepStrictEqual(await names("inner"), was, "the cyclops note keeps its name");
            assert.deepStrictEqual((await model()).options.angles.inner, [null, null, 120], await status());
            assert.strictEqual(await pastLen(), before + 1, "one Undo step");
            assert.strictEqual(await status(), "E5 moved.Undo");
          });

          test("U2f move at 375x667: a placed bottom note dragged around the bottom ring moves to the drop angle, pinned, in one Undo step", async () => {
            await fresh(375, 667, true, true);
            await openAdd();
            await typeLine(SCALE);
            await b.click("#editor-oct-down");
            await b.click("#editor-oct-down");
            await gesture(await chipAt("F"), await spotAt(1.15, 150), kind);
            const before = await pastLen();
            await gesture(await noteAt("bottom", 0), await spotAt(1.15, 200), kind);
            assert.deepStrictEqual(await names("bottom"), ["F2"]);
            assert.deepStrictEqual((await model()).options.angles.bottom, [200], await status());
            assert.strictEqual(await pastLen(), before + 1, "one Undo step");
            assert.strictEqual(await status(), "F2 moved.Undo");
          });

          test("v4: while dragging a placed note, the source carries lift and the landing ring sits on the note or ding under it; over empty pan or itself nothing", async () => {
            await setup("(D3) " + RIM8);
            const landing = () => b.eval(`const c = document.querySelector("#editor-pan .editor-landing"); return c ? { x: +c.getAttribute("cx"), y: +c.getAttribute("cy") } : null;`);
            const lifted = () => b.eval(`return [...document.querySelectorAll("#editor-pan .ehit.lift")].map((c) => c.dataset.ring + c.dataset.i);`);
            const hitXY = (ring, i) => b.eval(`const c = document.querySelector('#editor-pan .ehit[data-ring="${ring}"][data-i="${i}"]'); return { x: +c.getAttribute("cx"), y: +c.getAttribute("cy") };`);
            const end = () => kind === "touch" ? b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }) : b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 0, y: 0, button: "left", buttons: 0, clickCount: 1 });
            await gesture(await noteAt("rim", 3), await noteAt("rim", 5), kind, { release: false });
            assert.deepStrictEqual(await landing(), await hitXY("rim", 5));
            assert.deepStrictEqual(await lifted(), ["rim3"]);
            await end();
            await new Promise((done) => setTimeout(done, 80));
            await gesture(await noteAt("rim", 3), await noteAt("ding", 0), kind, { release: false });
            const ding = await landing();
            assert.ok(ding && ding.x === 0, "the ring sits on the ding");
            await end();
            await new Promise((done) => setTimeout(done, 80));
            await gesture(await noteAt("rim", 3), await centreOf("#editor-title"), kind, { release: false });
            assert.strictEqual(await landing(), null);
            await end();
          });

          test("U2f item 4: the ding dropped on the trash is refused with the ding copy; the last rim note on the trash is refused with the rim minimum; the trash shows for placed notes only", async () => {
            await setup("(D3) A3");
            const trash = { x: 187, y: 667 - 18 - 26 };
            const before = await core();
            const steps = await pastLen();
            await gesture(await noteAt("ding", 0), trash, kind, { mid: async () => assert.strictEqual(await trashShown(), true) });
            assert.strictEqual(await status(), "Every scale needs a ding. Drop another note on it to swap.");
            assert.deepStrictEqual(await core(), before);
            await gesture(await noteAt("rim", 0), trash, kind);
            assert.strictEqual(await status(), "The rim needs at least 1 note.");
            assert.deepStrictEqual(await core(), before);
            assert.strictEqual(await pastLen(), steps);
          });

          test("D3: a tray note dragged onto the empty cyclops arc and bottom ring (first note) is placed", async () => {
            await setup("(D3) " + RIM8);
            await b.click("#editor-oct-up");
            await gesture(await chipAt("E"), await spotAt(0.38, 90), kind);
            assert.deepStrictEqual(await names("inner"), ["E5"], await status());
            await setup("(D3) " + RIM8);
            await b.click("#editor-oct-down");
            await gesture(await chipAt("E"), await spotAt(1.15, 150), kind);
            assert.deepStrictEqual(await names("bottom"), ["E3"], await status());
          });

          test("U2f review: the landing ring for a tray note over an empty cyclops arc or bottom ring sits on that orbit with a note-sized radius, not on the pan centre", async () => {
            await setup("(D3) " + RIM8);
            const landing = () => b.eval(`const c = document.querySelector("#editor-pan .editor-landing"); return c ? { x: +c.getAttribute("cx"), y: +c.getAttribute("cy"), r: +c.getAttribute("r") } : null;`);
            const end = () => kind === "touch" ? b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }) : b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 0, y: 0, button: "left", buttons: 0, clickCount: 1 });
            for (const [orbit, deg] of [[0.38, 90], [1.15, 150]]) {
              await gesture(await chipAt("B"), await spotAt(orbit, deg), kind, { release: false });
              await new Promise((done) => setTimeout(done, 60));
              const at = await landing();
              await end();
              await new Promise((done) => setTimeout(done, 80));
              assert.ok(at, "a landing ring shows over the empty arc");
              assert.ok(Math.abs(Math.hypot(at.x, at.y) - orbit * 100) < 1.5, "ring centre on the " + orbit + " orbit, got " + JSON.stringify(at));
              assert.ok(at.r > 8 && at.r < 30, "note-sized radius, got " + at.r);
            }
          });

          test("D4: a drag swaps two placed notes (Undo restores); a placed bottom note on the ding swaps seats with it; a tray note on the ding replaces it", async () => {
            await setup("[A2] " + SCALE);
            const before = await core();
            await gesture(await noteAt("rim", 0), await noteAt("rim", 1), kind);
            assert.deepStrictEqual((await model()).options.seats, { rim: [1, 0, 2, 3, 4, 5, 6, 7] });
            assert.strictEqual(await status(), "A3 and Bb3 traded places.Undo");
            await b.click("#editor-notice-undo");
            assert.deepStrictEqual(await core(), before);
            await gesture(await noteAt("bottom", 0), await noteAt("ding", 0), kind);
            assert.strictEqual(await status(), "A2 is the ding. D3 took its seat.Undo");
            assert.strictEqual(await b.eval(`return editorDingOf(editorSession.history.present);`), "A2");
            await b.click("#editor-notice-undo");
            await b.click("#editor-oct-down");
            await gesture(await chipAt("C"), await noteAt("ding", 0), kind);
            assert.strictEqual(await b.eval(`return editorDingOf(editorSession.history.present);`), "C3", await status());
            assert.match(await status(), /^D3 removed\. C3 is the ding\./);
          });

          test("D4 / SE-6: dropping a placed note on the trash or on the tray removes it with Undo; any other drop off the pan snaps back with no step", async () => {
            await setup(SCALE);
            const before = await core();
            const len = await pastLen();
            const trash = { x: 187, y: 667 - 18 - 26 };
            await gesture(await noteAt("rim", 3), trash, kind);
            assert.ok(!(await rimNames()).includes("D4"), "removed by the trash");
            assert.strictEqual(await status(), "D4 removed.Undo");
            await b.click("#editor-notice-undo");
            assert.deepStrictEqual(await core(), before);
            await gesture(await noteAt("rim", 3), await centreOf("#editor-notes"), kind);
            assert.ok(!(await rimNames()).includes("D4"), "removed by the tray");
            await b.click("#editor-undo");
            assert.deepStrictEqual(await core(), before);
            const steps = await pastLen();
            await gesture(await noteAt("rim", 3), await centreOf("#editor-title"), kind);
            assert.strictEqual(await status(), "D4 went back. Drop on the trash to remove it.");
            await gesture(await noteAt("rim", 3), { x: 4, y: 300 }, kind);
            await gesture(await chipAt("G"), await centreOf("#editor-title"), kind);
            assert.deepStrictEqual(await core(), before, "snapped back");
            assert.strictEqual(await pastLen(), steps, "a snap back is not an Undo step");
            assert.strictEqual(await trashShown(), false);
            assert.ok(len <= steps);
          });

          test("D4: the ding dragged to the trash or off the pan stays; a drag of the ding onto a rim note says only a bottom note can swap", async () => {
            await setup("[A2] " + SCALE);
            const before = await core();
            await gesture(await noteAt("ding", 0), { x: 187, y: 667 - 18 - 26 }, kind);
            assert.deepStrictEqual(await core(), before);
            await gesture(await noteAt("rim", 0), await noteAt("ding", 0), kind);
            assert.strictEqual(await status(), "Only a bottom note can swap with the ding.");
            assert.deepStrictEqual(await core(), before);
          });

          test("D3: a rim note dragged to an empty bottom spot moves areas in one step; Undo restores", async () => {
            await setup(SCALE);
            const before = await core();
            await gesture(await noteAt("rim", 3), await spotAt(1.15, 150), kind);
            assert.deepStrictEqual(await names("bottom"), ["D4"], await status());
            assert.ok(!(await rimNames()).includes("D4"));
            await b.click("#editor-notice-undo");
            assert.deepStrictEqual(await core(), before);
          });
        });
      }

      test("D3: 8px or less of movement is a tap (selects, places nothing); more is a drag (the ghost shows)", async () => {
        await setup(SCALE);
        const from = await noteAt("rim", 3);
        const before = await core();
        await gesture(from, { x: from.x + 6, y: from.y }, "mouse");
        assert.deepStrictEqual(await b.eval(`return editorSession.sel;`), { ring: "rim", i: 3 }, "the click still selected the note");
        assert.strictEqual(await ghostText(), null);
        assert.deepStrictEqual(await core(), before);
        await b.click("#editor-pan");
        await setup(SCALE);
        const chip = await chipAt("G");
        let ghost = null;
        await gesture(chip, { x: chip.x + 20, y: chip.y }, "mouse", { mid: async () => { ghost = await ghostText(); } });
        assert.strictEqual(ghost, "G4", "20px is a drag");
        assert.strictEqual(await b.eval(`return editorSession.held === null;`), true, "a drag is not a hold");
      });

      test("D3: a drag from a tray chip that ends on the chip itself does not also hold it", async () => {
        await setup(SCALE);
        const chip = await chipAt("G");
        await b.send("Input.dispatchMouseEvent", { type: "mousePressed", ...chip, button: "left", buttons: 1, clickCount: 1 });
        await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: chip.x + 30, y: chip.y, button: "left", buttons: 1 });
        await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...chip, button: "left", buttons: 1 });
        await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...chip, button: "left", clickCount: 1 });
        assert.strictEqual(await b.eval(`return editorSession.held === null;`), true);
      });

      test("D8 / SE-7: touch-action is none on the pan SVG and the tray chips only; the tray is pan-y and the rest of the panel scrolls", async () => {
        await setup(SCALE);
        const ta = (sel) => b.eval(`return getComputedStyle(document.querySelector(${JSON.stringify(sel)})).touchAction;`);
        assert.strictEqual(await ta("#editor-pan svg"), "none");
        assert.strictEqual(await ta(".tray-note"), "none");
        assert.strictEqual(await ta("#editor-tray"), "pan-y");
        for (const sel of [".editor-head", "#editor-line", "#editor-status", "#editor-pills", ".editor-toolbar", "#editor"]) {
          assert.ok(["auto", "manipulation", "pan-y"].includes(await ta(sel)), sel + " keeps scrolling: " + await ta(sel));
        }
        const before = await core();
        const head = await centreOf(".editor-head");
        await gesture(head, { x: head.x, y: head.y - 60 }, "touch");
        await gesture(await centreOf("#editor-status"), await centreOf("#editor-line"), "touch");
        assert.deepStrictEqual(await core(), before, "a swipe that starts outside the pan drags nothing");
        assert.strictEqual(await ghostText(), null);
      });

      test("DRAG_ON_TOUCH off: touch drags do nothing and touch taps still place and swap; mouse drag is unaffected; touch-action is not none", async () => {
        await fresh(375, 667, true, false);
        await openAdd();
        await typeLine(SCALE);
        const ta = (sel) => b.eval(`return getComputedStyle(document.querySelector(${JSON.stringify(sel)})).touchAction;`);
        assert.notStrictEqual(await ta("#editor-pan svg"), "none");
        assert.notStrictEqual(await ta(".tray-note"), "none");
        const before = await core();
        const synthetic = await b.eval(`const c = document.querySelector('.tray-note[data-name="B"]'); const r = c.getBoundingClientRect(); const o = { pointerId: 7, pointerType: "touch", isPrimary: true, bubbles: true, button: 0, buttons: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", o)); window.dispatchEvent(new PointerEvent("pointermove", { ...o, clientX: o.clientX + 40, clientY: o.clientY - 40 })); const g = document.querySelector(".editor-ghost"); window.dispatchEvent(new PointerEvent("pointerup", { ...o, clientX: o.clientX + 40, clientY: o.clientY - 40 })); return g ? g.textContent : null;`);
        assert.strictEqual(synthetic, null, "a synthetic touch pointer starts no drag");
        await gesture(await chipAt("B"), await spotAt(0.722, 22.5), "touch");
        assert.deepStrictEqual(await core(), before, "a touch drag places nothing");
        assert.strictEqual(await ghostText(), null);
        await gesture(await noteAt("rim", 0), await noteAt("rim", 1), "touch");
        assert.deepStrictEqual(await core(), before, "a touch drag swaps nothing");
        await tapPoint(await chipAt("B"), true);
        assert.strictEqual(await status(), "Holding B4: tap a spot, an area, or the ding.Cancel");
        await tapSpot(...polar(0.722, 22.5), true);
        assert.deepStrictEqual((await rimNames()).slice(-2), ["A4", "B4"], "tap-tap by touch works");
        await tapNote("rim", 0, true);
        await tapNote("rim", 1, true);
        assert.deepStrictEqual((await model()).options.seats.rim.slice(0, 8), [1, 0, 2, 3, 4, 5, 6, 7]);
        await b.click("#editor-oct-up");
        await gesture(await chipAt("E"), await spotAt(0.722, -22.5), "mouse");
        assert.ok((await rimNames()).includes("E5"), "mouse drag still places: " + await status());
      });

      test("U2d nit N2: at 375x667 the empty bottom ring and its first-note spot (90 degrees, 270 degrees) can be tapped and dropped on", async () => {
        await setup("(D3) " + RIM8);
        const inside = (p) => b.eval(`const r = document.querySelector("#editor-pan svg").getBoundingClientRect(); const e = document.elementFromPoint(${p.x}, ${p.y}); return ${p.x} >= r.left && ${p.x} <= r.right && ${p.y} >= r.top && ${p.y} <= r.bottom && !!e && !!e.closest("#editor-pan svg");`);
        for (const deg of [90, 270]) assert.strictEqual(await inside(await spotAt(1.15, deg)), true, deg + " degrees is on the pan");
        await b.click("#editor-oct-down");
        await tapPoint(await chipAt("E"));
        await tapSpot(...polar(1.15, 90));
        assert.deepStrictEqual(await names("bottom"), ["E3"], await status());
        await setup("(D3) " + RIM8);
        await b.click("#editor-oct-down");
        await gesture(await chipAt("E"), await spotAt(1.15, 90), "mouse");
        assert.deepStrictEqual(await names("bottom"), ["E3"], await status());
        assert.deepStrictEqual((await model()).options.angles.bottom, [90]);
      });

      test("U2d nit N1: holding a note on a Neotone pan draws no cyclops or bottom target rings", async () => {
        await setup("[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4");
        await b.click("#editor-type-neotone");
        await hold("B");
        assert.strictEqual(await b.eval(`return document.querySelectorAll("#editor-pan .etarget").length;`), 0);
        await b.click("#editor-type-standard");
        await hold("C");
        assert.ok((await b.eval(`return document.querySelectorAll("#editor-pan .etarget").length;`)) > 0, "a Standard pan still shows them");
      });

      test("Undo and Redo walk back through drops, a pan-type switch and Reset spacing", async () => {
        await setup("[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4");
        const states = [await core()];
        const step = async (act) => {
          const before = await pastLen();
          await act();
          assert.strictEqual(await pastLen(), before + 1, "one history step: " + await status());
          states.push(await core());
        };
        await step(async () => gesture(await chipAt("B"), await spotAt(0.722, 22.5), "mouse"));
        await step(async () => gesture(await noteAt("rim", 3), await spotAt(1.15, 150), "mouse"));
        await step(() => b.click("#editor-type-neotone"));
        await step(() => b.click("#editor-type-standard"));
        for (let k = states.length - 2; k >= 0; k--) {
          await b.click("#editor-undo");
          assert.deepStrictEqual(await core(), states[k]);
        }
        for (let k = 1; k < states.length; k++) {
          await b.click("#editor-redo");
          assert.deepStrictEqual(await core(), states[k]);
        }
      });
    });

    describe("U2f-2 tap and pill parity (gap rows 9, 11, 13, 23, 24)", () => {
      const pillState = (ring) => b.eval(`const p = document.getElementById("editor-pill-${ring}"); return { disabled: p.disabled, ready: p.classList.contains("ready") };`);
      const selectedOf = () => b.eval(`return editorSession.sel;`);
      const pinRings = () => b.eval(`return [...document.querySelectorAll("#editor-pan .epin")].length;`);
      const orbitOf = (ring) => b.eval(`return editorSolve(editorSession.history.present).value.geom[${JSON.stringify(ring)}] || (${JSON.stringify(ring)} === "bottom" ? 1.15 : 0.38);`);
      const linkOf = () => b.eval(`return editorExport(editorSession.history.present).link.value;`);
      const names = (ring) => b.eval(`return editorNames(editorSession.history.present, ${JSON.stringify(ring)});`);
      const pastLen = () => b.eval(`return editorSession.history.past.length;`);

      for (const touch of [false, true]) {
        describe(touch ? "touch" : "mouse", () => {
          test("pill without a note asks to pick; pills stay enabled and turn ready for a held or a selected note", async () => {
            await fresh(375, 667);
            await openAdd();
            await typeLine(SCALE);
            assert.deepStrictEqual(await pillState("bottom"), { disabled: false, ready: false });
            const past0 = await pastLen();
            await b.click("#editor-pill-bottom");
            assert.strictEqual(await status(), "Pick a note below, or on the pan, first.");
            assert.strictEqual(await pastLen(), past0);
            await hold("B");
            assert.deepStrictEqual(await pillState("bottom"), { disabled: false, ready: true });
            await b.click(".tray-note[data-name=\"B\"]");
            await tapNote("rim", 3, touch);
            assert.deepStrictEqual(await pillState("bottom"), { disabled: false, ready: true });
          });

          test("pill moves a selected note to that area as one Undo step", async () => {
            await fresh(375, 667);
            await openAdd();
            await typeLine(SCALE);
            const before = await linkOf();
            await tapNote("rim", 1, touch);
            assert.strictEqual(await status(), "Bb3 picked. Tap another note to swap, or tap a spot to move it.");
            const past = await pastLen();
            await b.click("#editor-pill-bottom");
            assert.deepStrictEqual(await names("bottom"), ["Bb3"], await status());
            assert.strictEqual((await names("rim")).length, 7);
            assert.strictEqual(await selectedOf(), null);
            assert.strictEqual(await pastLen(), past + 1);
            await b.click("#editor-undo");
            assert.strictEqual(await linkOf(), before, "one Undo restores it byte-equal");
          });

          test("tap select then a cross-zone spot moves the note; the last rim note is refused with the minimum copy", async () => {
            await fresh(375, 667);
            await openAdd();
            await typeLine(SCALE);
            await tapNote("rim", 3, touch);
            await tapSpot(...polar(await orbitOf("bottom"), 200), touch);
            assert.deepStrictEqual(await names("bottom"), ["D4"], await status());
            assert.ok(!(await names("rim")).includes("D4"));
            await fresh(375, 667);
            await openAdd();
            await typeLine("(D3) A3");
            const before = await linkOf();
            await tapNote("rim", 0, touch);
            await b.click("#editor-pill-bottom");
            assert.strictEqual(await status(), "The rim needs at least 1 note.");
            assert.strictEqual(await linkOf(), before);
          });

          test("empty cyclops arc accepts a first note at the 5 degree angle, says it stays, and draws a pin ring", async () => {
            await fresh(375, 667);
            await openAdd();
            await typeLine("(D3) " + RIM8);
            assert.deepStrictEqual(await b.eval(`return [...document.querySelectorAll("#editor-pan .etarget")].map((e) => e.dataset.ring);`), ["inner", "bottom"]);
            assert.strictEqual(await pinRings(), 0);
            await hold("G");
            await b.click("#editor-oct-up");
            await tapSpot(...polar(0.38, 62), touch);
            assert.deepStrictEqual(await names("inner"), ["G5"], await status());
            const said = (await status()).match(/^G5 placed on the cyclops at (\d+) degrees\. It stays there\./);
            assert.ok(said, await status());
            assert.strictEqual(Number(said[1]) % 5, 0);
            assert.deepStrictEqual((await model()).options.angles.inner, [Number(said[1])]);
            assert.strictEqual(await pinRings(), 1, "the pinned cyclops note carries a pin ring");
            await hold("F");
            await b.click("#editor-pill-rim");
            assert.match(await status(), /^F5 added to the rim\./);
            assert.strictEqual(await pinRings(), 1, "an auto note has no pin ring");
          });

          test("with nothing held, a tap on the empty cyclops arc or bottom band selects the zone and Reset spacing scopes to it", async () => {
            await fresh(375, 667);
            await openAdd();
            await typeLine("(D3) " + RIM8);
            await tapSpot(...polar(0.38, 90), touch);
            assert.strictEqual(await status(), "Cyclops selected.");
            assert.strictEqual(await b.eval(`return editorSession.zone;`), "inner");
            assert.strictEqual(await b.eval(`return document.querySelector("#editor-pan .etarget[data-ring=inner]").classList.contains("picked");`), true);
            await tapSpot(...polar(await orbitOf("bottom"), 200), touch);
            assert.strictEqual(await status(), "Bottom selected.");
            assert.strictEqual(await b.eval(`return document.getElementById("editor-reset").getAttribute("aria-label");`), "Reset bottom spacing");
          });
        });
      }

      test("the pin ring appears only on a pinned note, and a rim note tap still selects first (the drawn circle is hit first)", async () => {
        await fresh(375, 667);
        await openAdd();
        await typeLine("(D3) " + RIM8 + " [G2]");
        assert.strictEqual(await pinRings(), 0);
        await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => editorSetAngle(m, "bottom", 0, 60, true)).history; editorRender(); return true;`);
        assert.strictEqual(await pinRings(), 1);
        await tapNote("rim", 2);
        assert.deepStrictEqual(await selectedOf(), { ring: "rim", i: 2 });
      });
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
