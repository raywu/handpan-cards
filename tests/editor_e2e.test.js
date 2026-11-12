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
  let magPinned = true;
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
        res.end(html ? apply(buf.toString("utf8"), flagOn).replace("const DRAG_ON_TOUCH = true;", () => "const DRAG_ON_TOUCH = " + dragTouch + ";").replace("</head>", () => magPinned ? "<style>#editor.dragging .editor-panbox{transform:none!important}</style></head>" : "</head>") : buf);
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
  const clickUndo = async () => b.click((await b.eval(`return !!document.getElementById("editor-notice-undo");`)) ? "#editor-notice-undo" : "#editor-undo");
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
    test("the editor pan is the card renderer's drawing of the solved layout at the editor scale, bottom notes as the outer ring", async () => {
      await fresh();
      await openAdd();
      await typeLine("[A2] [B2] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5");
      const r = await b.eval(`const m = editorSession.history.present; const s = editorSolve(m); const p = HPE.select.PALETTES[m.options.palette || 0];
        const expected = pan({ geom: s.value.geom, fields: s.value.fields, colors: { root: p.root, tone: p.tone } }, null, { scale: EDITOR_SCALE, push: editorPush(m, s.value.fields) });
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
      await clickUndo();
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
      await clickUndo();
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
      await clickUndo();
      assert.strictEqual(await kind(), "standard");
      assert.strictEqual(await steps(), s0);
      await b.click("#editor-redo");
      await b.click("#editor-type-standard");
      assert.strictEqual(await kind(), "standard");
      assert.strictEqual(await steps(), s0 + 2);
      await clickUndo();
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
    const offPan = async () => {
      const p = await clientOf(...polar(1.8, 90));
      return { x: p.x, y: Math.max(p.y, 3) };
    };
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
      await clickUndo();
      await clickUndo();
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
      await clickUndo();
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
      await clickUndo();
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
      const pill = (ring) => b.eval(`const p = document.getElementById("editor-pill-${ring}"); return { text: [...p.children].length ? [...p.children].map((c) => c.textContent).join(" ") : p.textContent, aria: p.getAttribute("aria-label"), disabled: p.disabled, full: p.getAttribute("aria-disabled") === "true" };`);
      const reset = () => b.eval(`const r = document.getElementById("editor-reset"); const vis = (c) => getComputedStyle(r.querySelector(c)).display !== "none";
        return { aria: r.getAttribute("aria-label"), disabled: r.disabled, visible: [...r.querySelectorAll("span")].filter((x) => getComputedStyle(x).display !== "none").map((x) => x.textContent).join("|") };`);
      const linkOf = () => b.eval(`return editorExport(editorSession.history.present).link.value;`);
      const pastLen = () => b.eval(`return editorSession.history.past.length;`);
      const RIM12 = "A3 Bb3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5";
      const BOT_LINE = (n) => ["A2", "B2", "C3", "E3", "F3", "G3", "Bb2", "Db3", "Eb3", "Gb3", "Ab3", "B3"].slice(0, n).map((x) => "[" + x + "]").join(" ");

      test("D17: the pills read '+ Rim n of 12', '+ Cyclops n of 6', '+ Bottom n of 12', wait for a held note, and add it at its auto position", async () => {
        await setup(SCALE);
        assert.deepStrictEqual(await pill("rim"), { text: "Add to rim 8 of 12", aria: "Add the held note to the rim, 8 of 12 used", disabled: false, full: false });
        assert.strictEqual((await pill("inner")).text, "Add to cyclops 2 of 6");
        assert.strictEqual((await pill("bottom")).text, "Add to bottom 0 of 12");
        assert.strictEqual(await b.eval(`return document.getElementById("editor-pills").getAttribute("aria-label");`), "Add the held note to an area");
        await hold("B");
        assert.strictEqual((await pill("rim")).disabled, false);
        await b.click("#editor-pill-rim");
        assert.deepStrictEqual((await rimNames()).slice(-2), ["A4", "B4"], "pitch-order seat");
        assert.strictEqual((await pill("rim")).text, "Add to rim 9 of 12", "the count follows the model live");
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
        assert.strictEqual((await pill("inner")).text, "Add to cyclops 3 of 6", await status());
        await clickUndo();
        assert.strictEqual((await pill("inner")).text, "Add to cyclops 2 of 6");
      });

      test("D16: a full area's pill is aria-disabled and a tap or pill into it is refused with the exact copy", async () => {
        await setup("(D3) " + RIM12 + " | C6");
        assert.deepStrictEqual(await pill("rim"), { text: "Rim full", aria: "Add the held note to the rim, 12 of 12 used", disabled: false, full: true });
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
        await clickUndo();
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
        assert.strictEqual((await pill("bottom")).text, "Add to bottom 2 of 12");
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
      const pastLen = () => b.eval(`return editorSession.history.past.length;`);
      const core = () => b.eval(`const m = editorSession.history.present; return { parts: editorPartsOf(m), ding: editorDingOf(m), options: m.options };`);
      const ghostText = () => b.eval(`const g = document.querySelector(".editor-ghost"); return g ? g.textContent : null;`);
      // A real pointer gesture through CDP: press, move in steps, optionally stop mid-way for a look, release.
      const gesture = async (from, to, kind, { mid, at: midAt = 0.5, release = true } = {}) => {
        const at = (k) => ({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
        const steps = [0.25, 0.5, 0.75, 1];
        if (kind === "touch") {
          await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
          for (const k of steps) {
            await b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at(k), id: 1 }] });
            if (mid && k === midAt) await mid();
          }
          if (release) await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        } else {
          await b.send("Input.dispatchMouseEvent", { type: "mousePressed", ...from, button: "left", buttons: 1, clickCount: 1 });
          for (const k of steps) {
            await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...at(k), button: "left", buttons: 1 });
            if (mid && k === midAt) await mid();
          }
          if (release) await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...to, button: "left", buttons: 0, clickCount: 1 });
        }
        if (release) await new Promise((done) => setTimeout(done, 320));
      };
      const names = (ring) => b.eval(`return editorNames(editorSession.history.present, ${JSON.stringify(ring)});`);
      const probeSwipe = () => b.eval(`window.__swipe = { ys: [], ghost: false };
        for (const type of ["touchstart", "touchmove"]) window.addEventListener(type, (e) => window.__swipe.ys.push(e.touches[0].clientY), true);
        new MutationObserver(() => { if (document.querySelector(".editor-ghost")) window.__swipe.ghost = true; }).observe(document.body, { childList: true, subtree: true });
        return true;`);
      const swipeResult = () => b.eval(`return { travel: Math.max(...window.__swipe.ys) - Math.min(...window.__swipe.ys), ghost: window.__swipe.ghost, live: !!(editorDrag && editorDrag.live), top: document.scrollingElement.scrollTop + document.getElementById("editor").scrollTop };`);

      for (const kind of ["mouse", "touch"]) {
        describe(kind, () => {
          test("D3: a tray note dragged to a rim spot, a cyclops spot and a bottom spot is placed there", async () => {
            await setup(SCALE);
            await gesture(await chipAt("B"), await spotAt(0.722, 22.5), kind, { mid: async () => {
              assert.strictEqual(await ghostText(), "B4", "the ghost carries the note name");
              assert.strictEqual(await status(), "Dragging B4: drop on a spot or a note, or off the pan to remove it.");
            } });
            assert.deepStrictEqual((await rimNames()).slice(-2), ["A4", "B4"]);
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

          test("U2e3: a tray note over the ding lights the ding zone only, a small move lights the cyclops, and a drop on the ding replaces it with an Undo", async () => {
            await setup("[A2] (D3) " + RIM8 + " | C5 D5");
            await b.click("#editor-oct-down");
            const on = async () => { await new Promise((done) => setTimeout(done, 60)); return b.eval(`return [...document.querySelectorAll("#editor-pan .ezone.on")].map((e) => e.dataset.ring);`); };
            const ding = await noteAt("ding", 0);
            const reach = await b.eval(`const c = document.querySelector('#editor-pan .ehit[data-ring="ding"]'); return c.getBoundingClientRect().width / 2;`);
            const seen = [];
            await gesture(await chipAt("G"), ding, kind, { mid: async () => {}, release: false });
            seen.push(await on());
            const move = (pt) => kind === "touch"
              ? b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...pt, id: 1 }] })
              : b.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...pt, button: "left", buttons: 1 });
            await move({ x: ding.x, y: ding.y - reach * 1.5 });
            seen.push(await on());
            await move(ding);
            seen.push(await on());
            assert.deepStrictEqual(seen, [["ding"], ["inner"], ["ding"]]);
            if (kind === "touch") await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
            else await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...ding, button: "left", buttons: 0, clickCount: 1 });
            await new Promise((done) => setTimeout(done, 80));
            assert.strictEqual(await b.eval(`return editorDingOf(editorSession.history.present);`), "G3");
            assert.strictEqual(await status(), "D3 removed. G3 is the ding.Undo");
            await clickUndo();
            assert.strictEqual(await b.eval(`return editorDingOf(editorSession.history.present);`), "D3");
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

          test("U2f item 4: the ding dragged off the pan is refused with the ding copy; the last rim note dragged off is refused with the rim minimum", async () => {
            await setup("(D3) A3");
            const before = await core();
            const steps = await pastLen();
            await gesture(await noteAt("ding", 0), await offPan(), kind);
            assert.strictEqual(await status(), "Every scale needs a ding. Drop another note on it to swap.");
            assert.deepStrictEqual(await core(), before);
            await gesture(await noteAt("rim", 0), await offPan(), kind);
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
              await new Promise((done) => setTimeout(done, 320));
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

          test("D4 / SE-6: dropping a placed note off the pan, even on the title, removes it with Undo; a tray note off the pan is cancelled with no step", async () => {
            await setup(SCALE);
            const before = await core();
            await gesture(await noteAt("rim", 3), await offPan(), kind);
            assert.ok(!(await rimNames()).includes("D4"), "removed off the pan");
            assert.strictEqual(await status(), "D4 removed.Undo");
            await b.click("#editor-notice-undo");
            assert.deepStrictEqual(await core(), before);
            const steps = await pastLen();
            await gesture(await noteAt("rim", 3), await centreOf("#editor-title"), kind);
            assert.ok(!(await rimNames()).includes("D4"), "anywhere off the pan removes");
            assert.strictEqual(await pastLen(), steps + 1);
            await clickUndo();
            assert.deepStrictEqual(await core(), before);
            await gesture(await chipAt("G"), await offPan(), kind);
            assert.deepStrictEqual(await core(), before, "a tray note off the pan is cancelled");
            assert.strictEqual(await pastLen(), steps);
          });

          test("D4: the ding dragged off the pan stays; a drag of the ding onto a rim note says only a bottom note can swap", async () => {
            await setup("[A2] " + SCALE);
            const before = await core();
            await gesture(await noteAt("ding", 0), await offPan(), kind);
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
        await probeSwipe();
        const head = await centreOf(".editor-head");
        await gesture(head, { x: head.x, y: head.y + 90 }, "touch");
        await gesture(await centreOf("#editor-status"), await centreOf("#editor-line"), "touch");
        const swipe = await swipeResult();
        assert.ok(swipe.travel >= 40, "the swipe really travelled: " + swipe.travel);
        assert.strictEqual(swipe.ghost, false, "no drag ghost ever appeared");
        assert.strictEqual(swipe.live, false);
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
          await clickUndo();
          assert.deepStrictEqual(await core(), states[k]);
        }
        for (let k = 1; k < states.length; k++) {
          await b.click("#editor-redo");
          assert.deepStrictEqual(await core(), states[k]);
        }
      });

    describe("OQA-A owner QA gaps 1-7", () => {
      const RIM12 = "A3 Bb3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5";
      const pause = () => new Promise((done) => setTimeout(done, 80));
      const ghostClass = async () => { await pause(); return b.eval(`const g = document.querySelector(".editor-ghost"); return g ? g.className : null;`); };
            const endGesture = (kind) => kind === "touch" ? b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }) : b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 0, y: 0, button: "left", buttons: 0, clickCount: 1 });
      const lineBoxes = (sel) => b.eval(`return [...document.querySelectorAll(${JSON.stringify(sel)})].map((e) => ({ text: e.textContent, h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.2 }));`);
      const visibleUndo = () => b.eval(`return [...document.querySelectorAll("#editor button, #editor .mode")].filter((e) => e.textContent.trim() === "Undo" && e.offsetParent !== null && getComputedStyle(e).visibility === "visible").length;`);

      test("OQA pill copy two lines and full: 'Add to rim' over '8 of 12', 'Rim full' at the cap, aria carries 'used', each line at most two line boxes (375 and 820)", async () => {
        for (const [w, h] of [[375, 667], [820, 1180]]) {
          await fresh(w, h);
          await openAdd();
          await typeLine(SCALE);
          const rim = await b.eval(`const p = document.getElementById("editor-pill-rim"); return { act: p.querySelector(".pill-act").textContent, count: p.querySelector(".pill-count").textContent, aria: p.getAttribute("aria-label") };`);
          assert.deepStrictEqual(rim, { act: "Add to rim", count: "8 of 12", aria: "Add the held note to the rim, 8 of 12 used" });
          assert.strictEqual((await b.eval(`return document.querySelector("#editor-pill-inner .pill-act").textContent;`)), "Add to cyclops");
          assert.strictEqual((await b.eval(`return document.querySelector("#editor-pill-bottom .pill-count").textContent;`)), "0 of 12");
          for (const l of await lineBoxes("#editor-pills .pill span")) assert.ok(l.h <= l.lh * 2.6 + 0.5, w + ": '" + l.text + "' is at most two line boxes, " + l.h + " vs " + l.lh);
          await typeLine("(D3) " + RIM12 + " | C6");
          assert.strictEqual(await b.eval(`return document.getElementById("editor-pill-rim").textContent;`), "Rim full");
          assert.strictEqual(await b.eval(`return document.querySelectorAll("#editor-pill-rim span").length;`), 1);
        }
      });

      test("OQA bubbles 0.85 rim 0.75 cyclops: drawn and hit radii on the standard pan", async () => {
        await setup("[G2] " + SCALE);
        const r = await b.eval(`const g = editorSolve(editorSession.history.present).value.geom; const out = {};
          for (const [ring, f, base] of [["rim", 0.85, g.r_note], ["inner", 0.75, g.r_note], ["bottom", 0.85, g.r_bnote]]) {
            const hit = document.querySelector('#editor-pan .ehit[data-ring="' + ring + '"][data-i="0"]');
            const drawn = [...document.querySelectorAll("#editor-pan svg > circle")].filter((c) => Math.abs(+c.getAttribute("cx") - +hit.getAttribute("cx")) < 0.05 && Math.abs(+c.getAttribute("cy") - +hit.getAttribute("cy")) < 0.05 && !c.getAttribute("class"));
            out[ring] = { want: f * base * 100, hit: +hit.getAttribute("r"), drawn: drawn.map((c) => +c.getAttribute("r")) };
          }
          return out;`);
        for (const ring of ["rim", "inner", "bottom"]) {
          assert.ok(Math.abs(r[ring].hit - r[ring].want) <= 0.5, ring + " hit radius " + JSON.stringify(r[ring]));
          assert.ok(r[ring].drawn.some((x) => Math.abs(x - r[ring].want) <= 0.5), ring + " drawn radius " + JSON.stringify(r[ring]));
        }
      });

      test("OQA no trash node: the trash is not in the DOM, before or during a drag, and no visible string names it", async () => {
        await setup(SCALE);
        assert.strictEqual(await b.eval(`return document.getElementById("editor-trash");`), null);
        await gesture(await noteAt("rim", 3), await offPan(), "mouse", { mid: async () => assert.strictEqual(await b.eval(`return document.getElementById("editor-trash");`), null) });
        assert.ok(!/trash/i.test(await b.eval(`return document.getElementById("editor").textContent + " " + Object.values(I18N.en).join(" ");`)));
      });

      for (const kind of ["mouse", "touch"]) {
        describe("OQA " + kind, () => {
          test("OQA drag off removes with undo toast; OQA release to remove ghost: past the margin the ghost says so, release removes in one step, the chip restores", async () => {
            await setup(SCALE);
            const before = await core();
            const steps = await pastLen();
            let cls = null, text = null, inside = null;
            await gesture(await noteAt("rim", 3), await offPan(), kind, { at: 1, mid: async () => { cls = await ghostClass(); text = await ghostText(); } });
            assert.match(cls, /remove/, "the ghost has the remove class past the margin");
            assert.match(text, /Release to remove/);
            assert.ok(!(await rimNames()).includes("D4"));
            assert.strictEqual(await pastLen(), steps + 1, "one history step");
            assert.strictEqual(await status(), "D4 removed.Undo");
            assert.strictEqual(await b.eval(`return !!document.getElementById("editor-notice-undo");`), true);
            await b.click("#editor-notice-undo");
            assert.deepStrictEqual(await core(), before);
            await gesture(await noteAt("rim", 3), await noteAt("rim", 4), kind, { at: 1, mid: async () => { inside = await ghostClass(); } });
            assert.doesNotMatch(inside, /remove/, "over the pan the ghost is plain");
          });

          test("OQA tray drag off cancels: no history step and no status message", async () => {
            await setup(SCALE);
            const before = await core();
            const steps = await pastLen();
            await gesture(await chipAt("G"), await offPan(), kind, { at: 1, mid: async () => assert.doesNotMatch(await ghostClass(), /remove/) });
            assert.deepStrictEqual(await core(), before);
            assert.strictEqual(await pastLen(), steps);
            assert.strictEqual(await status(), "");
          });

          test("OQA ding drag off refuses: the ghost is .refuse, release leaves the model and says the ding copy", async () => {
            await setup("[A2] " + SCALE);
            const before = await core();
            let cls = null;
            await gesture(await noteAt("ding", 0), await offPan(), kind, { at: 1, mid: async () => { cls = await ghostClass(); } });
            assert.match(cls, /refuse/);
            assert.doesNotMatch(cls, /remove/);
            assert.deepStrictEqual(await core(), before);
            assert.strictEqual(await status(), "Every scale needs a ding. Drop another note on it to swap.");
          });

          test("OQA last rim drag off refuses: the ghost is .refuse, release leaves the model and says the rim minimum", async () => {
            await setup("(D3) A3");
            const before = await core();
            let cls = null;
            await gesture(await noteAt("rim", 0), await offPan(), kind, { at: 1, mid: async () => { cls = await ghostClass(); } });
            assert.match(cls, /refuse/);
            assert.deepStrictEqual(await core(), before);
            assert.strictEqual(await status(), "The rim needs at least 1 note.");
          });

          test("OQA pointercancel never removes: a cancel past the margin snaps back with no step; so does losing capture", async () => {
            await setup(SCALE);
            const before = await core();
            const steps = await pastLen();
            for (const type of ["pointercancel", "lostpointercapture"]) {
              await gesture(await noteAt("rim", 3), await offPan(), kind, { release: false });
              await b.eval(`window.dispatchEvent(new PointerEvent(${JSON.stringify(type)}, { pointerId: editorDrag.id, bubbles: true })); return true;`);
              await endGesture(kind);
              await pause();
              assert.deepStrictEqual(await core(), before, type);
              assert.strictEqual(await pastLen(), steps, type);
              assert.strictEqual(await ghostText(), null);
            }
          });

          test("OQA snap back says went back: a rim note dropped on an empty rim spot changes nothing and the status says it went back", async () => {
            await setup(SCALE);
            const before = await core();
            const p = await noteAt("rim", 0);
            const q = await noteAt("rim", 1);
            await gesture(await noteAt("rim", 3), { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, kind);
            await pause();
            assert.deepStrictEqual(await core(), before);
            assert.strictEqual(await status(), "D4 went back.");
          });

          test("OQA tap equals drag model (N7): a tap-tap move and a drag from the same start give deep-equal models", async () => {
            await setup(SCALE);
            await b.click("#editor-oct-up");
            await gesture(await chipAt("E"), await spotAt("inner", 90), kind);
            const start = await model();
            await gesture(await noteAt("inner", 2), await spotAt("inner", 120), kind);
            const dragged = await model();
            await b.eval(`editorSession.history = editorHistoryNew(${JSON.stringify(start)}); editorSession.sel = null; editorRender(); return true;`);
            await tapPoint(await noteAt("inner", 2), kind === "touch");
            await tapPoint(await spotAt("inner", 120), kind === "touch");
            assert.deepStrictEqual(await model(), dragged);
          });

          test("OQA cyclops drop near midpoint: inside the cyclops/rim midpoint lands on the cyclops (ring on the inner orbit), outside on the rim", async () => {
            await setup("(D3) " + RIM8);
            await b.click("#editor-oct-up");
            const mid = await b.eval(`const g = editorSolve(editorSession.history.present).value.geom; return (editorOrbit(g, "inner") + g.rim) / 2;`);
            await gesture(await chipAt("E"), await clientOf(...polar(mid - 0.02, 90)), kind, { release: false });
            await pause();
            const ring = await b.eval(`const c = document.querySelector("#editor-pan .editor-landing"); return c ? Math.hypot(+c.getAttribute("cx"), +c.getAttribute("cy")) : null;`);
            await endGesture(kind);
            await pause();
            assert.ok(ring !== null && Math.abs(ring - (await b.eval(`return editorOrbit(editorSolve(editorSession.history.present).value.geom, "inner");`)) * 100) < 1.5, "landing ring on the inner orbit, got " + ring);
            await setup("(D3) " + RIM8);
            await b.click("#editor-oct-up");
            await gesture(await chipAt("E"), await clientOf(...polar(mid + 0.02, 270)), kind);
            assert.deepStrictEqual(await names("inner"), [], "outside the midpoint is the rim");
            assert.ok((await rimNames()).includes("E5"), await status());
            await setup("(D3) " + RIM8);
            await b.click("#editor-oct-up");
            await gesture(await chipAt("E"), await clientOf(...polar(mid - 0.02, 270)), kind);
            assert.deepStrictEqual(await names("inner"), ["E5"], "inside the midpoint is the cyclops, even empty and in the lower half: " + await status());
          });

          test("OQA zone highlight occupied; OQA zone full dashed: the hovered zone is .ezone.on although it has notes, a zone at its cap is .full with a Full label", async () => {
            await setup(SCALE);
            const on = async () => { await pause(); return b.eval(`return [...document.querySelectorAll("#editor-pan .ezone.on")].map((e) => e.dataset.ring);`); };
            await gesture(await chipAt("B"), await spotAt(0.722, 22.5), kind, { release: false });
            assert.deepStrictEqual(await on(), ["rim"], "the rim has notes and still lights");
            await endGesture(kind);
            await pause();
            await setup("(D3) " + RIM12 + " | C6");
            await gesture(await chipAt("B"), await spotAt(0.722, 22.5), kind, { release: false });
            await pause();
            const full = await b.eval(`const z = document.querySelector('#editor-pan .ezone[data-ring="rim"]'); return { cls: z.getAttribute("class"), dash: getComputedStyle(z).strokeDasharray, label: [...document.querySelectorAll("#editor-pan .ezone-label")].map((e) => e.textContent) };`);
            await endGesture(kind);
            await pause();
            assert.match(full.cls, /full/);
            assert.notStrictEqual(full.dash, "none");
            assert.ok(full.label.includes("Full"), JSON.stringify(full));
          });

          test("OQA zone cleared on drag lift (N1): a picked zone is gone once a drag lifts", async () => {
            await setup(SCALE);
            await tapSpot(...polar(0.38, 90), kind === "touch");
            assert.strictEqual(await b.eval(`return editorSession.zone;`), "inner");
            await gesture(await chipAt("B"), await spotAt(0.722, 22.5), kind, { release: false });
            await pause();
            assert.strictEqual(await b.eval(`return editorSession.zone;`), null);
            await endGesture(kind);
            await pause();
          });
        });
      }

      test("OQA touch scroll does not remove: a vertical touch swipe starting on the pan lifts nothing", async () => {
        await setup(SCALE);
        const before = await core();
        const from = await clientOf(0.1, 0.1);
        await gesture(from, { x: from.x, y: from.y - 120 }, "touch");
        assert.deepStrictEqual(await core(), before);
        assert.strictEqual(await ghostText(), null);
      });

      describe("OQB owner QA gap 8", () => {
        const rings = () => b.eval(`return { esel: document.querySelectorAll("#editor-pan .esel").length, picked: document.querySelectorAll("#editor-pan .etarget.picked").length, on: document.querySelectorAll("#editor-tray .tray-note.on").length, pressed: document.querySelectorAll('#editor-tray .tray-note[aria-pressed="true"]').length };`);
        const countClicks = () => b.eval(`window.__seen = { capture: 0, bubble: 0 };
          window.addEventListener("click", () => { window.__seen.capture += 1; }, true);
          document.addEventListener("click", () => { window.__seen.bubble += 1; });
          return true;`);
        const seen = () => b.eval(`return window.__seen;`);

        for (const kind of ["mouse", "touch"]) {
          test("OQB lift clears rings (" + kind + "): once a drag lifts, no selection ring, picked zone ring or held chip is left on the pan or tray", async () => {
            await setup(SCALE);
            await tapNote("rim", 3, kind === "touch");
            assert.strictEqual((await rings()).esel, 1, "the tap selected a note");
            await gesture(await noteAt("rim", 5), await spotAt(0.722, 22.5), kind, { release: false });
            await pause();
            assert.deepStrictEqual(await rings(), { esel: 0, picked: 0, on: 0, pressed: 0 }, "a selected note, drag lifted");
            await endGesture(kind);
            await pause();
            await setup(SCALE);
            await tapSpot(...polar(0.38, 90), kind === "touch");
            assert.strictEqual((await rings()).picked, 1, "the tap picked the cyclops");
            await gesture(await chipAt("B"), await spotAt(0.722, 22.5), kind, { release: false });
            await pause();
            assert.deepStrictEqual(await rings(), { esel: 0, picked: 0, on: 0, pressed: 0 }, "a picked zone, drag lifted");
            await endGesture(kind);
            await pause();
            await setup(SCALE);
            await hold("G");
            assert.strictEqual((await rings()).on, 1, "the tap held a chip");
            await gesture(await chipAt("B"), await spotAt(0.722, 22.5), kind, { release: false });
            await pause();
            assert.deepStrictEqual(await rings(), { esel: 0, picked: 0, on: 0, pressed: 0 }, "a held chip, drag lifted");
            await endGesture(kind);
            await pause();
          });
        }

        test("OQB scroll measures distance (touch): a 120px vertical swipe starting off the pan travels at least 40px, scrolls nothing and lifts nothing", async () => {
          await setup(SCALE);
          await probeSwipe();
          const before = await core();
          const head = await centreOf(".editor-head");
          await gesture(head, { x: head.x, y: head.y + 120 }, "touch");
          const swipe = await swipeResult();
          assert.ok(swipe.travel >= 40, "the swipe really travelled: " + swipe.travel);
          assert.strictEqual(swipe.ghost, false, "no drag ghost ever appeared");
          assert.strictEqual(swipe.live, false);
          assert.strictEqual(swipe.top, 0, "the editor has nothing to scroll, so scrollTop stays 0");
          assert.deepStrictEqual(await core(), before);
        });

        test("OQB click after drop eaten once (mouse): the click a drop synthesises never reaches the page, and the next click does", async () => {
          await setup(SCALE);
          await countClicks();
          const before = await core();
          const chip = await chipAt("G");
          await gesture(chip, { x: chip.x + 30, y: chip.y }, "mouse", { release: false });
          await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...chip, button: "left", buttons: 1 });
          await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...chip, button: "left", clickCount: 1 });
          const first = await seen();
          assert.strictEqual(first.capture, 1, "the browser did synthesise the click");
          assert.strictEqual(first.bubble, 0, "and the drop ate it");
          await pause();
          await pause();
          await b.eval(`document.getElementById("editor-line").click(); return true;`);
          assert.strictEqual((await seen()).bubble, 1, "a later click is not eaten");
          assert.deepStrictEqual(await core(), before, "the chip drop snapped back and the eaten click held nothing");
          assert.strictEqual(await b.eval(`return editorSession.held === null;`), true);
        });

        for (const kind of ["mouse", "touch"]) {
          test("OQB click elsewhere after drop fires (" + kind + "): a press on another control right after a drop is not eaten", async () => {
            await setup(SCALE);
            const before = await core();
            await gesture(await noteAt("rim", 3), await offPan(), kind, { release: false });
            await endGesture(kind);
            const undo = await centreOf("#editor-notice-undo");
            await tapPoint(undo, kind === "touch");
            if (kind === "touch") await b.eval(`const u = document.getElementById("editor-notice-undo"); if (u) u.click(); return true;`);
            let after = await core();
            for (let waited = 0; waited < 1500 && JSON.stringify(after) !== JSON.stringify(before); waited += 80) {
              await pause();
              after = await core();
            }
            assert.deepStrictEqual(after, before, "Undo ran");
          });
        }
      });
      test("OQA neotone drag off removes: on a Neotone pan a pan note released off the pan is removed with Undo", async () => {
        await setup("[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4");
        await b.click("#editor-type-neotone");
        const before = await core();
        let cls = null;
        await gesture(await noteAt("rim", 2), await offPan(), "mouse", { at: 1, mid: async () => { cls = await ghostClass(); } });
        assert.match(cls, /remove/);
        assert.strictEqual((await names("rim")).length, 6, await status());
        await b.click("#editor-notice-undo");
        assert.deepStrictEqual(await core(), before);
      });

      for (const kind of ["mouse", "touch"]) {
        describe(`U2e Neotone ${kind}`, () => {
          const slotAt = async (slot) => {
            const q = await b.eval(`const p = neoSlotPoint(${slot}, null);
              const svg = document.querySelector("#editor-pan svg"); const c = new DOMPoint(p.x, p.y).matrixTransform(svg.getScreenCTM()); return { x: c.x, y: c.y };`);
            return q;
          };
          const keys = () => b.eval(`return editorSession.history.present.options.profile.map.slice();`);
          const neo = async () => { await setup("[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4"); await b.click("#editor-type-neotone"); };

          test("a tray note dragged to an empty main field fills it, shows the landing ring, and is one Undo step", async () => {
            await neo();
            const past = await pastLen();
            const before = await keys();
            const empty = before.findIndex((k, i) => i < 9 && k == null);
            assert.ok(empty >= 0);
            await hold("B");
            await gesture(await chipAt("B"), await slotAt(empty), kind);
            const after = await keys();
            assert.strictEqual(after.filter((k) => k).length, before.filter((k) => k).length + 1, await status());
            assert.strictEqual(await pastLen(), past + 1);
            assert.strictEqual(await b.eval(`return document.querySelectorAll("#editor-pan .editor-landing").length;`), 1);
            await b.click("#editor-notice-undo");
            assert.deepStrictEqual(await keys(), before);
          });

          test("a mutant dragged into an empty field is refused with the field-empty copy and nothing changes", async () => {
            await neo();
            const before = await keys();
            const emptyMain = before.findIndex((k, i) => i < 9 && k == null);
            assert.ok(emptyMain >= 0);
            await hold("D");
            await b.eval(`editorPlaceHeld({ kind: "spot", ring: "mutant", slot: ${9 + emptyMain} }, editorSession.history.present); return true;`);
            assert.strictEqual(await status(), `Field ${emptyMain + 1} is empty. Fill the field before its mutant.`);
            assert.deepStrictEqual(await keys(), before);
          });

          test("a tray note dragged to the mutant of a filled field fills that mutant, and the mutant drags to another free mutant field", async () => {
            await neo();
            const before = await keys();
            const filled = before.findIndex((k, i) => i < 9 && k);
            await hold("B");
            await gesture(await chipAt("B"), await slotAt(9 + filled), kind);
            const mid = await keys();
            assert.ok(mid[9 + filled], await status());
            const other = mid.findIndex((k, i) => i < 9 && k && i !== filled);
            const past = await pastLen();
            await gesture(await slotAt(9 + filled), await slotAt(9 + other), kind);
            const after = await keys();
            assert.strictEqual(after[9 + other], mid[9 + filled], await status());
            assert.strictEqual(after[9 + filled], null);
            assert.strictEqual(await pastLen(), past + 1);
            await b.click("#editor-notice-undo");
            assert.deepStrictEqual(await keys(), mid);
          });

          const tapAt = async (pt) => {
            if (kind === "touch") {
              await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...pt, id: 1 }] });
              await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
            } else for (const type of ["mousePressed", "mouseReleased"]) await b.send("Input.dispatchMouseEvent", { type, ...pt, button: "left", clickCount: 1 });
            await new Promise((done) => setTimeout(done, 80));
          };

          test("D3 tap parity: tapping a main note then another swaps them, and tapping a note then an empty main field moves it, each one Undo step", async () => {
            await neo();
            const before = await keys();
            const [one, two] = before.map((k, i) => (i < 9 && k ? i : -1)).filter((i) => i >= 0);
            const empty = before.findIndex((k, i) => i < 9 && k == null);
            assert.ok(two !== undefined && empty >= 0);
            const past = await pastLen();
            await tapAt(await slotAt(one));
            await tapAt(await slotAt(two));
            const swapped = await keys();
            assert.strictEqual(swapped[one], before[two], await status());
            assert.strictEqual(swapped[two], before[one]);
            assert.strictEqual(await pastLen(), past + 1);
            await tapAt(await slotAt(one));
            await tapAt(await slotAt(empty));
            const moved = await keys();
            assert.strictEqual(moved[empty], swapped[one], await status());
            assert.strictEqual(moved[one], null);
            assert.strictEqual(await pastLen(), past + 2);
            await b.click("#editor-notice-undo");
            assert.deepStrictEqual(await keys(), swapped);
          });

          test("a pan note dragged onto a free main field moves there in one Undo step", async () => {
            await neo();
            const before = await keys();
            const from = before.findIndex((k, i) => i < 9 && k);
            const to = before.findIndex((k, i) => i < 9 && k == null);
            const past = await pastLen();
            await gesture(await slotAt(from), await slotAt(to), kind);
            const after = await keys();
            assert.strictEqual(after[to], before[from], await status());
            assert.strictEqual(await pastLen(), past + 1);
            await b.click("#editor-notice-undo");
            assert.deepStrictEqual(await keys(), before);
          });
        });
      }

      test("OQA one visible undo: exactly one visible Undo in idle, holding, said-with-undo, notice and error states", async () => {
        await setup(SCALE);
        assert.strictEqual(await visibleUndo(), 1, "idle");
        await hold("B");
        assert.strictEqual(await visibleUndo(), 1, "holding");
        await b.click("#editor-pill-rim");
        assert.strictEqual(await b.eval(`return !!document.getElementById("editor-notice-undo");`), true);
        assert.strictEqual(await visibleUndo(), 1, "said with the chip");
        await b.eval(`editorSession.say = ""; editorSession.notice = true; editorRender(); return true;`);
        assert.strictEqual(await visibleUndo(), 1, "notice");
        await b.eval(`editorSession.notice = false; editorSession.error = "Nope."; editorRender(); return true;`);
        assert.strictEqual(await visibleUndo(), 1, "error");
      });

      test("OQA one visible undo: focus moves to the chip when the focused toolbar Undo is hidden by it (R-OQA-5)", async () => {
        await setup(SCALE);
        await hold("B");
        await b.eval(`document.getElementById("editor-undo").focus(); return true;`);
        await b.eval(`editorPillTap("rim"); return true;`);
        assert.strictEqual(await b.eval(`return document.activeElement && document.activeElement.id;`), "editor-notice-undo");
      });

      test("OQA reset wraps within two lines: Reset spacing is at most two line boxes at 375, 820 and 1440", async () => {
        for (const [w, h] of [[375, 667], [820, 1180], [1440, 960]]) {
          await fresh(w, h);
          await openAdd();
          await typeLine(SCALE);
          const r = await b.eval(`const e = document.getElementById("editor-reset"); const vis = [...e.querySelectorAll("span")].filter((x) => getComputedStyle(x).display !== "none"); return { ws: getComputedStyle(e).whiteSpace, lines: vis.map((x) => Math.round(x.getBoundingClientRect().height / (parseFloat(getComputedStyle(x).lineHeight) || parseFloat(getComputedStyle(x).fontSize) * 1.2))) };`);
          assert.strictEqual(r.ws, "normal", w + "");
          assert.ok(r.lines.length > 0 && r.lines.every((n) => n <= 2), w + ": " + JSON.stringify(r));
        }
      });

      test("OQA bottom labels clear pin ring: a pinned bottom note's number label clears its pin ring and the shell outline (375x667, 1440x960)", async () => {
        for (const [w, h] of [[375, 667], [1440, 960]]) {
          await fresh(w, h);
          await openAdd();
          await typeLine("(D3) " + RIM8 + " [G2]");
          await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => editorSetAngle(m, "bottom", 0, 60, true)).history; editorRender(); return true;`);
          const r = await b.eval(`const svg = document.querySelector("#editor-pan svg"); const pin = svg.querySelector(".epin"); const pr = pin.getBoundingClientRect();
            const c = { x: pr.left + pr.width / 2, y: pr.top + pr.height / 2, r: pr.width / 2 };
            const label = [...svg.querySelectorAll("text")].find((t) => t.getAttribute("fill") === "#E27005");
            const lb = label.getBoundingClientRect();
            const nx = Math.max(lb.left, Math.min(c.x, lb.right)), ny = Math.max(lb.top, Math.min(c.y, lb.bottom));
            const sr = svg.getBoundingClientRect();
            const shell = [...svg.querySelectorAll(":scope > circle")].find((e) => e.getAttribute("r") === "100").getBoundingClientRect();
            const mid = { x: (lb.left + lb.right) / 2, y: (lb.top + lb.bottom) / 2 }, sc = { x: shell.left + shell.width / 2, y: shell.top + shell.height / 2 };
            const nearest = Math.hypot(mid.x - sc.x, mid.y - sc.y) - Math.max(lb.width, lb.height) / 2;
            return { gap: Math.hypot(nx - c.x, ny - c.y) - c.r, inside: lb.left >= sr.left - 0.5 && lb.right <= sr.right + 0.5 && lb.top >= sr.top - 0.5 && lb.bottom <= sr.bottom + 0.5, outsideShell: nearest > shell.width / 2 };`);
          assert.ok(r.gap >= -0.5, w + ": the label sits inside the pin ring, gap " + r.gap);
          assert.strictEqual(r.inside, true, w + ": the label is inside the pan svg");
          assert.strictEqual(r.outsideShell, true, w + ": the label crosses the shell outline");
        }
      });

      test("OQA tablet portrait stacks: at 820x1180 and 1024x1366 the controls sit under the pan, the pan fills the column, nothing scrolls sideways", async () => {
        for (const [w, h] of [[820, 1180], [1024, 1366]]) {
          await fresh(w, h);
          await openAdd();
          await typeLine(SCALE);
          const r = await b.eval(`const ed = document.getElementById("editor"); const svg = document.querySelector(".editor-panbox svg").getBoundingClientRect();
            const cs = getComputedStyle(ed); const col = ed.getBoundingClientRect().width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
            const below = [...ed.querySelectorAll("#editor-areas, .editor-toolbar, #editor-tray")].map((e) => e.getBoundingClientRect().top);
            const panBox = document.querySelector(".editor-panbox").getBoundingClientRect();
            return { size: Math.min(svg.width, svg.height), top: Math.min(...below), panBottom: svg.bottom, want: Math.min(col, panBox.width, panBox.height), scrollOk: document.documentElement.scrollWidth <= document.documentElement.clientWidth, edw: ed.getBoundingClientRect().width };`);
          assert.ok(r.top >= r.panBottom - 1, w + ": controls start at " + r.top + " under the pan bottom " + r.panBottom);
          assert.ok(Math.abs(r.size - r.want) <= 4, w + ": pan " + r.size + " vs " + r.want);
          assert.ok(r.edw <= 520.5, w + ": stacks at the phone width, got " + r.edw);
          assert.strictEqual(r.scrollOk, true);
        }
      });

      test("OQA tablet landscape centred: at 1180x820, 1366x1024 and 1440x960 the control stack is centred on the pan and the pan fills its column", async () => {
        for (const [w, h] of [[1180, 820], [1366, 1024], [1440, 960]]) {
          await fresh(w, h);
          await openAdd();
          await typeLine(SCALE);
          const r = await b.eval(`const svg = document.querySelector(".editor-panbox svg").getBoundingClientRect();
            const els = ["#editor-line", "#editor-status", "#editor-areas", "#editor .editor-toolbar", "#editor-tray"].map((s) => document.querySelector(s).getBoundingClientRect()).filter((r) => r.height > 0);
            const top = Math.min(...els.map((r) => r.top)), bottom = Math.max(...els.map((r) => r.bottom));
            const head = document.querySelector(".editor-head").getBoundingClientRect(); const panBox = document.querySelector(".editor-panbox").getBoundingClientRect();
            return { dy: (top + bottom) / 2 - (svg.top + svg.height / 2), size: Math.min(svg.width, svg.height), want: Math.min(panBox.width, panBox.height), scrollOk: document.documentElement.scrollWidth <= document.documentElement.clientWidth, headBottom: head.bottom, panBoxH: panBox.height, h: innerHeight };`);
          assert.ok(Math.abs(r.dy) <= 8, w + ": controls centre off by " + r.dy);
          assert.ok(Math.abs(r.size - r.want) <= 4, w + ": pan " + r.size + " vs " + r.want);
          assert.ok(r.panBoxH >= r.h - r.headBottom - 48 - 4, w + ": the pan column spans the viewport under the header, " + JSON.stringify(r));
          assert.strictEqual(r.scrollOk, true);
        }
      });
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
            await clickUndo();
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

  describe("U2e-2 palette chip, mirror and anchor", () => {
    const BOTTOM = "(D3) " + RIM8 + " [G2]";
    const setup = async (line, width = 375, height = 667) => { await fresh(width, height); await openAdd(); await typeLine(line); };
    const pastLen = () => b.eval(`return editorSession.history.past.length;`);
    const code = () => b.eval(`return editorExport(editorSession.history.present).code;`);
    const noScroll = (w, h) => b.eval(`const de = document.documentElement, e = document.getElementById("editor");
      return { page: de.scrollHeight === ${h} && de.scrollWidth === ${w}, panel: e.scrollHeight <= e.clientHeight && e.scrollWidth <= e.clientWidth };`);
    const inView = (ids, w, h) => b.eval(`return ${JSON.stringify(ids)}.filter((id) => { const q = document.getElementById(id).getBoundingClientRect();
      return q.width === 0 || q.height === 0 || q.top < 0 || q.bottom > ${h} || q.left < 0 || q.right > ${w}; });`);

    test("375x667: the octave row holds the flats chip, the octave controls and the palette chip, and the panel does not scroll", async () => {
      await setup(BOTTOM);
      assert.deepStrictEqual(await inView(["editor-oct-down", "editor-oct-up", "editor-flats", "editor-palette", "editor-mirror-top", "editor-mirror-bottom", "editor-anchor-one", "editor-anchor-between"], 375, 667), []);
      const row = await b.eval(`const r = document.querySelector(".editor-octaves"); const q = (id) => document.getElementById(id).getBoundingClientRect();
        return { ids: ["editor-flats", "editor-palette"].map((id) => q(id).height >= 44 && q(id).width >= 44), after: q("editor-palette").left >= q("editor-flats").right - 1, sameRow: Math.abs(q("editor-palette").top - q("editor-flats").top) < 2 };`);
      assert.deepStrictEqual(row, { ids: [true, true], after: true, sameRow: true });
      assert.deepStrictEqual(await noScroll(375, 667), { page: true, panel: true });
    });

    test("the palette chip swaps the note grid for ten 44px swatches, with no scroll at 375x667, and a pick recolours the chip and closes", async () => {
      await setup(BOTTOM);
      const dot = () => b.eval(`return getComputedStyle(document.querySelector("#editor-palette .pal-dot")).backgroundImage;`);
      const fillBefore = await dot();
      await b.click("#editor-palette");
      const open = await b.eval(`const g = document.getElementById("editor-swatches"); const dots = [...g.querySelectorAll("button")];
        return { n: dots.length, tall: dots.every((d) => { const q = d.getBoundingClientRect(); return q.width >= 44 && q.height >= 44; }), notes: getComputedStyle(document.getElementById("editor-notes")).display,
          pressed: document.getElementById("editor-palette").getAttribute("aria-expanded"), names: dots.slice(0, 2).map((d) => d.getAttribute("aria-label")) };`);
      assert.deepStrictEqual(open, { n: 10, tall: true, notes: "none", pressed: "true", names: ["Card palette 1", "Card palette 2"] });
      assert.deepStrictEqual(await noScroll(375, 667), { page: true, panel: true }, "swatches open");
      assert.deepStrictEqual(await inView(["editor-swatches", "editor-save", "editor-palette"], 375, 667), []);
      const past = await pastLen();
      await b.click('#editor-swatches button[data-palette="9"]');
      assert.strictEqual((await model()).options.palette, 9);
      assert.match(await code(), /\/palette-10\//);
      assert.strictEqual(await pastLen(), past + 1, "one Undo step");
      assert.strictEqual(await b.eval(`return document.getElementById("editor-swatches").hidden;`), true, "a pick closes the swatches");
      assert.notStrictEqual(await dot(), fillBefore, "the chip took the new colours");
      await b.click("#editor-palette");
      await b.click('#editor-swatches button[data-palette="0"]');
      assert.strictEqual((await model()).options.palette, 0);
      assert.strictEqual((await code()).includes("palette-"), false, "palette 0 writes no option");
      assert.strictEqual(await pastLen(), past + 2);
      await clickUndo();
      assert.strictEqual((await model()).options.palette, 9);
    });

    test("picking the current palette closes the swatches and adds no Undo step; the chip toggles them shut", async () => {
      await setup(BOTTOM);
      const past = await pastLen();
      await b.click("#editor-palette");
      await b.click('#editor-swatches button[data-palette="0"]');
      assert.strictEqual(await pastLen(), past);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-swatches").hidden;`), true);
      await b.click("#editor-palette");
      await b.click("#editor-palette");
      assert.strictEqual(await b.eval(`return [document.getElementById("editor-swatches").hidden, getComputedStyle(document.getElementById("editor-notes")).display];`).then((r) => r[0]), true);
    });

    test("MIRROR TOP on a scale with a pinned cyclops reflects the cyclops (180 - a), the link version holds, and it is one Undo step", async () => {
      await setup("(D3) " + RIM8 + " | C5 D5");
      await pinInner();
      const before = await model();
      const version = (await code()).split("/")[0];
      const past = await pastLen();
      await b.click("#editor-mirror-top");
      const after = await model();
      assert.deepStrictEqual(after.options.angles.inner, before.options.angles.inner.map((a) => (a === null ? null : (180 - a + 360) % 360)));
      assert.strictEqual(after.options.mirror, true);
      assert.strictEqual((await code()).split("/")[0], version, "the link stays the same version");
      assert.strictEqual(await pastLen(), past + 1);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-mirror-top").getAttribute("aria-pressed");`), "true");
      await clickUndo();
      assert.deepStrictEqual((await model()).options.angles, before.options.angles);
      assert.strictEqual((await model()).options.mirror, false);
    });

    test("MIRROR BOTTOM flips the bottom ring only and is disabled with no bottom notes; the anchor splits notes 1 and 2", async () => {
      await setup("(D3) " + RIM8);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-mirror-bottom").disabled;`), true);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-mirror-top").disabled;`), false);
      await typeLine(BOTTOM);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-mirror-bottom").disabled;`), false);
      const rim = () => b.eval(`const s = editorSolve(editorSession.history.present).value.fields; return ringIds(s, "rim").map((id) => s[id][4]);`);
      const bot = () => b.eval(`const s = editorSolve(editorSession.history.present).value.fields; return ringIds(s, "bottom").map((id) => s[id][4]);`);
      const [rim0, bot0] = [await rim(), await bot()];
      await b.click("#editor-mirror-bottom");
      assert.deepStrictEqual(await rim(), rim0, "the rim did not move");
      assert.deepStrictEqual(await bot(), bot0.map((a) => (180 - a + 360) % 360));
      await b.click("#editor-anchor-between");
      assert.notDeepStrictEqual(await rim(), rim0);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-anchor-between").getAttribute("aria-pressed");`), "true");
      assert.match(await code(), /between/);
      const past = await pastLen();
      await b.click("#editor-anchor-between");
      assert.strictEqual(await pastLen(), past, "the same anchor adds no step");
    });

    test("the mirror and anchor controls are at least 44px, and the numbers toast shows on MIRROR BOTTOM only", async () => {
      await setup("(D3) " + RIM8 + " [G2]\n");
      await typeLine(BOTTOM);
      const sizes = await b.eval(`return ["editor-mirror-top", "editor-mirror-bottom", "editor-anchor-one", "editor-anchor-between"].map((id) => { const q = document.getElementById(id).getBoundingClientRect(); return q.width >= 44 && q.height >= 44; });`);
      assert.deepStrictEqual(sizes, [true, true, true, true]);
      await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => editorSetAngle(m, "bottom", 0, 240)).history; editorRender(); return true;`);
      await b.click("#editor-mirror-top");
      assert.strictEqual(await b.eval(`return editorSession.say.includes("Numbers stay");`), false, "no toast on MIRROR TOP");
      await b.click("#editor-mirror-bottom");
      assert.strictEqual(await b.eval(`return editorSession.say.includes("Numbers stay");`), true, "toast on MIRROR BOTTOM");
    });

    test("a palette pick closes the swatches while the text line is being edited", async () => {
      await setup(BOTTOM);
      await b.click("#editor-palette");
      await b.eval(`editorSession.editing = true; return true;`);
      await b.click('#editor-swatches button[data-palette="3"]');
      assert.strictEqual(await b.eval(`return document.getElementById("editor-swatches").hidden;`), true);
    });
  });

  describe("U2e-3 Replace ding and button fit", () => {
    const status = () => b.eval(`return document.getElementById("editor-status").textContent;`);
    const ding = () => b.eval(`return editorDingOf(editorSession.history.present);`);
    const setup = async (line, width = 390, height = 844) => { await fresh(width, height); await openAdd(); await typeLine(line); };

    test("Replace ding sits beside the area pills, sets the ding to a held tray note, and swaps in a selected bottom note", async () => {
      await setup("[A2] (D3) " + RIM8 + " | C5 D5");
      const row = await b.eval(`const p = document.getElementById("editor-pills").getBoundingClientRect(), d = document.getElementById("editor-replace-ding"); const q = d.getBoundingClientRect();
        return { inside: q.top >= p.top - 1 && q.bottom <= p.bottom + 1, level: Math.abs(q.top - document.getElementById("editor-pill-rim").getBoundingClientRect().top) < 2, text: d.textContent };`);
      assert.deepStrictEqual(row, { inside: true, level: true, text: "Replace ding" });
      await b.click("#editor-replace-ding");
      assert.strictEqual(await status(), "Pick a note below, or on the pan, first.");
      await b.click("#editor-oct-down");
      await b.click('.tray-note[data-name="G"]');
      await b.click("#editor-replace-ding");
      assert.strictEqual(await status(), "D3 removed. G3 is the ding.Undo");
      assert.strictEqual(await ding(), "G3");
      assert.strictEqual(await status(), "D3 removed. G3 is the ding.Undo");
      await clickUndo();
      await b.click("#editor-pan");
      await b.eval(`editorSession.sel = { ring: "bottom", i: 0 }; editorRender(); return true;`);
      await b.click("#editor-replace-ding");
      assert.strictEqual(await ding(), "A2");
    });

    test("every label in the pills row and the action row fits its button at 390, 375 and 320 wide, in all eight locales, with the real fonts", async () => {
      const prev = b;
      b = await launch({ foregroundSettle: true, realFonts: true });
      try {
        for (const width of [390, 375, 320]) {
          await setup("[A2] (D3) " + RIM8 + " | C5 D5", width, 844);
          await b.eval(`return document.fonts.ready.then(() => true);`);
          const langs = await b.eval(`return [...document.getElementById("lang-select").options].map((o) => o.value).filter((v) => v !== "auto");`);
          assert.strictEqual(langs.length, 8);
          for (const lang of langs) {
            await b.eval(`const e = document.getElementById("lang-select"); e.value = ${JSON.stringify(lang)}; e.dispatchEvent(new Event("change", { bubbles: true })); return true;`);
            await b.waitFor(`document.documentElement.lang === ${JSON.stringify(lang)}`, { label: "locale applied" });
            await b.eval(`editorRender(); return document.fonts.ready.then(() => true);`);
            const bad = await b.eval(`const out = [];
              for (const btn of document.querySelectorAll("#editor-pills button, #editor .editor-toolbar button")) {
                if (!btn.offsetParent) continue;
                const box = btn.getBoundingClientRect();
                const range = document.createRange(); range.selectNodeContents(btn);
                for (const r of range.getClientRects()) {
                  if (r.width && (r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5)) out.push(btn.id + ":" + btn.textContent);
                }
                const size = parseFloat(getComputedStyle(btn).fontSize);
                if (size < 10.5) out.push(btn.id + " font " + size);
              }
              return out;`);
            assert.deepStrictEqual(bad, [], width + " " + lang);
          }
        }
      } finally {
        await b.close();
        b = prev;
      }
    });
  });

  describe("U2g keyboard and accessibility", () => {
    const FULL = "[A2] [B2] (D3) " + RIM8 + " | C5 D5";
    const status = () => b.eval(`return document.getElementById("editor-status").textContent;`);
    const setup = async (line = FULL) => { await fresh(); await openAdd(); await typeLine(line); };
    const focusKey = (fk) => b.eval(`const e = document.querySelector('#editor-pan [data-fk="${fk}"]'); e.focus(); return document.activeElement === e;`);
    const activeKey = () => b.eval(`return document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.fk || null : null;`);
    const press = (key, code, keyCode, modifiers = 0) => b.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers, ...(key === "Enter" ? { text: "\r" } : key === " " ? { text: " " } : {}) })
      .then(() => b.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers }));
    const enter = () => press("Enter", "Enter", 13);
    const space = () => press(" ", "Space", 32);
    const arrow = (name) => press("Arrow" + name, "Arrow" + name, { Left: 37, Up: 38, Right: 39, Down: 40 }[name]);
    const angleOf = (ring, i) => b.eval(`return editorAnglesOf(editorSolve(editorSession.history.present), "${ring}")[${i}];`);
    const rimNames = () => b.eval(`return editorNames(editorSession.history.present, "rim");`);
    const sel = () => b.eval(`return editorSession.sel;`);

    test("tray chips hold on Enter and on Space, and the same key again cancels (SE-7, D7)", async () => {
      await setup();
      await b.eval(`document.querySelector('.tray-note[data-name="B"]').focus(); return true;`);
      await enter();
      assert.strictEqual(await b.eval(`return editorSession.held && editorSession.held.k;`), 11);
      await enter();
      assert.strictEqual(await b.eval(`return editorSession.held;`), null);
      await space();
      assert.strictEqual(await b.eval(`return editorSession.held && editorSession.held.k;`), 11);
      await space();
      assert.strictEqual(await b.eval(`return editorSession.held;`), null);
    });

    test("every placed note, the cyclops area and the bottom ring are named stops, with one tab stop in the pan", async () => {
      await setup();
      const r = await b.eval(`const els = [...document.querySelectorAll("#editor-pan [data-fk]")];
        return { keys: els.map((e) => e.dataset.fk), names: els.map((e) => e.getAttribute("aria-label")), tabbable: els.filter((e) => e.tabIndex === 0).length, roles: [...new Set(els.map((e) => e.getAttribute("role")))] };`);
      assert.strictEqual(r.keys.length, 15);
      assert.ok(r.names.every((n) => n && n.length > 2), r.names.join("|"));
      assert.ok(r.names.includes("Cyclops area, 2 of 6") && r.names.includes("Bottom area, 2 of 12"), r.names.join("|"));
      assert.strictEqual(r.tabbable, 1, "roving: one tab stop");
      assert.deepStrictEqual(r.roles, ["button"]);
    });

    test("keyboard pick and drop: Enter picks a note, arrows move between seats, Enter on another note swaps them", async () => {
      await setup();
      await focusKey("rim:0");
      await enter();
      assert.deepStrictEqual(await sel(), { ring: "rim", i: 0 });
      assert.strictEqual(await b.eval(`return document.querySelector('#editor-pan [data-fk="rim:0"]').getAttribute("aria-pressed");`), "true");
      assert.match(await status(), /A3 picked/);
      await arrow("Down");
      assert.strictEqual(await activeKey(), "rim:1");
      await arrow("Right");
      assert.strictEqual(await activeKey(), "rim:2", "a rim pick is not nudged, the arrow moves focus");
      await arrow("Left");
      await arrow("Up");
      assert.strictEqual(await activeKey(), "rim:0");
      await arrow("Down");
      await enter();
      assert.match(await status(), /A3 and Bb3 traded places/);
      assert.strictEqual(await sel(), null);
      assert.strictEqual(await b.eval(`return editorSession.history.past.length;`) > 1, true);
      assert.strictEqual(await activeKey(), "rim:1", "focus stays on the seat it was on after the redraw");
    });

    test("keyboard drop of a held tray note on the cyclops area and on the ding", async () => {
      await setup();
      await b.eval(`document.querySelector('.tray-note[data-name="B"]').focus(); return true;`);
      await enter();
      await focusKey("zone:inner");
      await enter();
      assert.strictEqual(await b.eval(`return editorNames(editorSession.history.present, "inner").length;`), 3);
      assert.strictEqual(await b.eval(`return editorSession.held;`), null);
      await b.click("#editor-oct-down");
      await b.eval(`document.querySelector('.tray-note[data-name="E"]').focus(); return true;`);
      await enter();
      await focusKey("ding:0");
      await enter();
      assert.strictEqual(await b.eval(`return editorDingOf(editorSession.history.present);`), "E3");
    });

    test("Escape cancels a pick and does not leave the panel; with nothing picked it is Back", async () => {
      await setup();
      await focusKey("bottom:0");
      await enter();
      assert.notStrictEqual(await sel(), null);
      await press("Escape", "Escape", 27);
      assert.strictEqual(await sel(), null);
      assert.strictEqual(await sheetHidden(), false);
      await focusKey("zone:inner");
      await enter();
      assert.strictEqual(await b.eval(`return editorSession.zone;`), "inner");
      await press("Escape", "Escape", 27);
      assert.strictEqual(await b.eval(`return editorSession.zone;`), null);
      assert.strictEqual(await sheetHidden(), false);
    });

    test("Left and Right nudge a picked bottom or cyclops note 5 degrees, announced, one Undo step each, focus kept", async () => {
      await setup();
      for (const ring of ["bottom", "inner"]) {
        await focusKey(ring + ":0");
        await enter();
        const start = Math.round(await angleOf(ring, 0) / 5) * 5;
        const steps = await b.eval(`return editorSession.history.past.length;`);
        await arrow("Left");
        assert.strictEqual(await angleOf(ring, 0), (start + 5) % 360, ring + " left");
        assert.match(await status(), new RegExp(` at ${(start + 5) % 360} degrees\\.`));
        assert.strictEqual(await activeKey(), ring + ":0");
        await arrow("Right");
        await arrow("Right");
        assert.strictEqual(await angleOf(ring, 0), (start + 355) % 360, ring + " right twice");
        assert.strictEqual(await b.eval(`return editorSession.history.past.length;`), steps + 3);
        assert.deepStrictEqual(await sel(), { ring, i: 0 }, "the pick survives a nudge");
        await press("Escape", "Escape", 27);
      }
    });

    test("the nudge is scoped to focus in the pan with a nudgeable pick: elsewhere an arrow moves nothing", async () => {
      await setup();
      await focusKey("bottom:0");
      await enter();
      const before = await model();
      await b.eval(`document.getElementById("editor-save").focus(); return true;`);
      await arrow("Left");
      await arrow("Right");
      assert.deepStrictEqual(await model(), before, "focus on a toolbar button");
      await b.click("#editor-line");
      await arrow("Left");
      assert.deepStrictEqual(await model(), before, "focus in the text line");
      await press("Escape", "Escape", 27);
      await focusKey("bottom:1");
      await arrow("Left");
      assert.deepStrictEqual(await model(), before, "another note than the picked one has the focus: arrows move focus");
      assert.strictEqual(await activeKey(), "bottom:0");
    });

    test("Cmd/Ctrl+Z is Undo and Shift+Cmd/Ctrl+Z is Redo, but not while the text line is being typed in", async () => {
      await setup();
      await b.eval(`document.querySelector('.tray-note[data-name="B"]').focus(); return true;`);
      await enter();
      await focusKey("zone:inner");
      await enter();
      assert.strictEqual(await b.eval(`return editorNames(editorSession.history.present, "inner").length;`), 3);
      await press("z", "KeyZ", 90, 2);
      assert.strictEqual(await b.eval(`return editorNames(editorSession.history.present, "inner").length;`), 2);
      await press("Z", "KeyZ", 90, 10);
      assert.strictEqual(await b.eval(`return editorNames(editorSession.history.present, "inner").length;`), 3);
      await press("z", "KeyZ", 90, 4);
      assert.strictEqual(await b.eval(`return editorNames(editorSession.history.present, "inner").length;`), 2, "Meta");
      await b.click("#editor-line");
      assert.strictEqual(await b.eval(`return editorSession.editing;`), true);
      await press("Z", "KeyZ", 90, 10);
      assert.strictEqual(await b.eval(`return editorNames(editorSession.history.present, "inner").length;`), 2, "typing keeps the field's own undo");
    });

    test("the text line opens on Enter; the palette chip and its swatches work from the keyboard", async () => {
      await setup();
      await b.eval(`document.getElementById("editor-line").focus(); return true;`);
      await enter();
      assert.strictEqual(await b.eval(`return editorSession.editing;`), true);
      await press("Escape", "Escape", 27);
      await b.eval(`document.getElementById("editor-palette").focus(); return true;`);
      await enter();
      assert.strictEqual(await b.eval(`return document.getElementById("editor-swatches").hidden;`), false);
      await b.eval(`document.querySelector('#editor-swatches [data-palette="3"]').focus(); return true;`);
      await space();
      assert.strictEqual(await b.eval(`return editorSession.history.present.options.palette;`), 3);
    });

    test("focus order and accessibility of the panel: names, no positive tabindex, unique ids, a live status, Tab stays inside", async () => {
      await setup();
      const r = await b.eval(`const root = document.getElementById("editor");
        const stops = [...root.querySelectorAll("button, input, [tabindex]")].filter((e) => !e.disabled && e.getClientRects().length && !e.closest("[hidden]"));
        const name = (e) => (e.getAttribute("aria-label") || e.textContent || "").trim();
        const ids = [...root.querySelectorAll("[id]")].map((e) => e.id);
        return { unnamed: stops.filter((e) => !name(e)).map((e) => e.id || e.tagName), positive: stops.filter((e) => e.tabIndex > 0).length,
          dupes: ids.filter((id, k) => ids.indexOf(id) !== k), live: document.getElementById("editor-status").getAttribute("aria-live"),
          order: stops.filter((e) => e.tabIndex >= 0).map((e) => e.id || e.dataset.fk || e.className).slice(0, 3) };`);
      assert.deepStrictEqual(r.unnamed, []);
      assert.strictEqual(r.positive, 0);
      assert.deepStrictEqual(r.dupes, []);
      assert.strictEqual(r.live, "polite");
      assert.deepStrictEqual(r.order, ["editor-back", "editor-type-standard", "editor-type-neotone"]);
      const stops = await b.eval(`return editorTabStops().length;`);
      await b.eval(`document.getElementById("editor-back").focus(); return true;`);
      const seen = new Set();
      for (let k = 0; k < stops + 2; k += 1) {
        await press("Tab", "Tab", 9);
        seen.add(await b.eval(`return document.activeElement.id || document.activeElement.dataset.fk || document.activeElement.className;`));
        assert.strictEqual(await b.eval(`return !!document.activeElement.closest("#editor");`), true, "Tab never leaves the panel");
      }
      assert.ok(seen.has("editor-back"), "the cycle wraps to the first stop");
      await b.eval(`document.getElementById("editor-back").focus(); return true;`);
      await press("Tab", "Tab", 9, 8);
      assert.strictEqual(await b.eval(`return !!document.activeElement.closest("#editor");`), true, "Shift+Tab wraps backward");
    });
  });

  describe("drag ux: compact panel, magnify on drag, placed-note highlight", () => {
    before(() => { magPinned = false; });
    after(() => { magPinned = true; });
    const pause = (ms) => new Promise((done) => setTimeout(done, ms));
    const ding = () => b.eval(`return editorDingOf(editorSession.history.present);`);
    const names = (ring) => b.eval(`return editorNames(editorSession.history.present, ${JSON.stringify(ring)});`);
    const chipAt = (name) => b.eval(`const r = document.querySelector('.tray-note[data-name="${name}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
    const noteAt = (ring, i) => b.eval(`const r = document.querySelector('#editor-pan .ehit[data-ring="${ring}"][data-i="${i}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
    const live = () => b.eval(`return !!(editorDrag && editorDrag.live);`);
    const isDragging = () => b.eval(`return document.getElementById("editor").classList.contains("dragging");`);
    const panelCss = () => b.eval(`const out = {};
      for (const id of ["editor-areas", "editor-layout", "editor-tray"]) { const c = getComputedStyle(document.getElementById(id)); out[id] = { opacity: c.opacity, pe: c.pointerEvents, vis: c.visibility }; }
      const c = getComputedStyle(document.querySelector("#editor .editor-toolbar")); out.toolbar = { opacity: c.opacity, pe: c.pointerEvents, vis: c.visibility };
      return out;`);
    // The pan box and the pan svg, read from the layout, never from the transform under test.
    const geometry = () => b.eval(`const box = document.querySelector("#editor .editor-panbox").getBoundingClientRect();
      const svg = document.querySelector("#editor-pan svg"), r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
      return { box: { left: box.left, top: box.top, width: box.width, height: box.height }, svg: { left: r.left, top: r.top, width: r.width, height: r.height }, vb: { x: vb.x, y: vb.y, w: vb.width, h: vb.height },
        mag: parseFloat(getComputedStyle(document.querySelector("#editor .editor-panbox")).getPropertyValue("--ed-mag")) || 1,
        transform: getComputedStyle(document.querySelector("#editor .editor-panbox")).transform };`);
    // A client point for a zone spot, by plain proportion inside the drawn svg rectangle.
    const spotNow = async (r, deg) => {
      const g = await geometry();
      const x = r * Math.cos(deg * Math.PI / 180) * 100, y = -r * Math.sin(deg * Math.PI / 180) * 100;
      return { x: g.svg.left + (x - g.vb.x) / g.vb.w * g.svg.width, y: g.svg.top + (y - g.vb.y) / g.vb.h * g.svg.height };
    };
    const geom = () => b.eval(`const g = editorSolve(editorSession.history.present).value.geom; return { rim: editorOrbit(g, "rim"), inner: editorOrbit(g, "inner"), bottom: editorOrbit(g, "bottom"), ding: g.ding_dy };`);
    const touch = (type, pt) => b.send("Input.dispatchTouchEvent", { type, touchPoints: pt ? [{ x: pt.x, y: pt.y, id: 1 }] : [] });
    const liftFrom = async (from, to) => {
      await touch("touchStart", from);
      for (const k of [0.15, 0.3]) await touch("touchMove", { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
    };
    const setup = async (line, width = 390, height = 844, touchOn = true) => { await fresh(width, height, true, touchOn); await openAdd(); await typeLine(line); };
    const SCALE_ = SCALE;

    for (const [w, h, minMag] of [[390, 844, 1.1], [390, 664, 1.1], [375, 667, 1]]) {
      describe(`${w}x${h}`, () => {
        test("drag ux E1: a live drag sets dragging and takes the panel out of play; a press that does not move does not", async () => {
          await setup(SCALE_, w, h);
          const tall = await b.eval(`return [...document.querySelectorAll("#editor button")].filter((x) => x.offsetParent).every((x) => x.getBoundingClientRect().height >= 44 || x.id === "editor-notice-undo" || x.closest("#editor-status"));`);
          assert.strictEqual(tall, true, "every control keeps a 44px target at rest");
          const from = await chipAt("B");
          await touch("touchStart", from);
          await pause(60);
          assert.strictEqual(await isDragging(), false, "a press alone does not set dragging");
          await touch("touchEnd");
          await pause(60);
          await setup(SCALE_, w, h);
          await liftFrom(await chipAt("B"), await noteAt("rim", 0));
          await pause(320);
          assert.strictEqual(await live(), true);
          assert.strictEqual(await isDragging(), true);
          const css = await panelCss();
          for (const k of Object.keys(css)) assert.deepStrictEqual(css[k], { opacity: "0", pe: "none", vis: "hidden" }, k);
          await touch("touchEnd");
        });

        test("drag ux E2: the panel returns after a drop, a pointercancel, Escape and a drop off the pan, and Undo is then usable", async () => {
          for (const how of ["drop", "cancel", "escape", "off"]) {
            await setup(SCALE_, w, h);
            const before = (await names("rim")).length;
            const to = how === "off" ? { x: 195, y: 4 } : await noteAt("rim", 2);
            await liftFrom(await chipAt("B"), to);
            await pause(300);
            assert.strictEqual(await isDragging(), true, how);
            if (how === "cancel") await touch("touchCancel");
            else if (how === "escape") { await b.key("Escape", "Escape", 27); await touch("touchEnd"); }
            else {
              await touch("touchMove", how === "off" ? to : await spotNow((await geom()).rim, 22.5));
              await touch("touchEnd");
            }
            await pause(500);
            assert.strictEqual(await isDragging(), false, how + ": dragging cleared");
            assert.strictEqual(await live(), false, how);
            const css = await panelCss();
            for (const k of Object.keys(css)) assert.deepStrictEqual(css[k], { opacity: "1", pe: "auto", vis: "visible" }, how + " " + k);
            const g = await geometry();
            assert.strictEqual(g.transform === "none" || /^matrix\(1, 0, 0, 1, 0, 0\)$/.test(g.transform), true, how + ": the pan is back at 1x");
            if (how === "drop") {
              assert.strictEqual((await names("rim")).length, before + 1);
              assert.strictEqual(await b.eval(`return !document.getElementById("editor-undo").disabled || !!document.getElementById("editor-notice-undo");`), true);
            } else assert.strictEqual((await names("rim")).length, before, how + ": nothing placed");
          }
        });

        test(`drag ux E3: the pan grows into the freed space, never above its rest top, and drops land in the scaled geometry in every zone`, async () => {
          const cases = [
            { zone: "rim", line: SCALE_, chip: "B", prep: [], at: (g) => [g.rim, 22.5], check: async () => assert.deepStrictEqual((await names("rim")).slice(-2), ["A4", "B4"]) },
            { zone: "inner", line: SCALE_, chip: "E", prep: ["#editor-oct-up"], at: (g) => [g.inner, 90], check: async () => assert.strictEqual((await names("inner")).length, 3) },
            { zone: "bottom", line: SCALE_, chip: "F", prep: ["#editor-oct-down", "#editor-oct-down"], at: (g) => [g.bottom, 150], check: async () => assert.deepStrictEqual(await names("bottom"), ["F2"]) },
            { zone: "ding", line: "[A2] (D3) " + RIM8 + " | C5 D5", chip: "G", prep: ["#editor-oct-down"], at: (g) => [g.ding, -90], check: async () => assert.strictEqual(await ding(), "G3") },
          ];
          for (const early of [false, true]) {
            for (const c of cases) {
              if (early && c.zone === "ding") continue;
              await setup(c.line, w, h);
              for (const sel of c.prep) await b.click(sel);
              const rest = await geometry();
              const gm = await geom();
              await liftFrom(await chipAt(c.chip), await noteAt("rim", 0));
              if (!early) await pause(400);
              const now = await geometry();
              if (!early) {
                assert.ok(now.svg.width / rest.svg.width >= minMag - 0.001, `${c.zone}: svg grew ${now.svg.width / rest.svg.width} (min ${minMag})`);
                assert.ok(Math.abs(now.svg.width / rest.svg.width - now.mag) < 0.02, `${c.zone}: the rect follows --ed-mag`);
                const pad = now.svg.width * 14 / now.vb.w;
                assert.ok(now.svg.left + pad >= -0.5 && now.svg.left + now.svg.width - pad <= w + 0.5, `${c.zone}: the drawing stays on screen`);
              }
              assert.ok(now.box.top >= rest.box.top - 0.5, `${c.zone}: the scaled pan box top ${now.box.top} stays at or below its rest top ${rest.box.top}`);
              assert.ok(now.svg.top >= rest.svg.top - 0.5, `${c.zone}: the scaled svg top stays at or below its rest top`);
              const pt = await spotNow(...c.at(gm));
              await touch("touchMove", pt);
              await touch("touchEnd");
              await pause(700);
              await c.check();
              const back = await geometry();
              assert.ok(Math.abs(back.svg.width - rest.svg.width) <= 1, `${c.zone}: back to rest width within 1px (${back.svg.width} vs ${rest.svg.width})`);
            }
          }
        });
      });
    }

    test("drag ux E4: a placed note is highlighted after a drag, a tap, a pill, Replace ding, a trade and the keyboard, and not after Undo", async () => {
      const marked = () => b.eval(`return [...document.querySelectorAll("#editor-pan .ehit.editor-new")].map((e) => e.dataset.ring + e.dataset.i);`);
      await setup(SCALE_);
      await liftFrom(await chipAt("B"), await noteAt("rim", 0));
      await touch("touchMove", await spotNow((await geom()).rim, 22.5));
      await touch("touchEnd");
      await pause(700);
      assert.deepStrictEqual(await marked(), ["rim8"], "drag add");
      await clickUndo();
      assert.deepStrictEqual(await marked(), [], "not after Undo");
      await b.click('.tray-note[data-name="B"]');
      await b.click("#editor-pill-rim");
      assert.deepStrictEqual(await marked(), ["rim8"], "pill tap");
      await clickUndo();
      await b.click('.tray-note[data-name="B"]');
      const gm = await geom();
      const pt = await b.eval(`const svg = document.querySelector("#editor-pan svg"); const p = new DOMPoint(${gm.rim} * 100 * Math.cos(0.4), -${gm.rim} * 100 * Math.sin(0.4)).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y };`);
      for (const type of ["mousePressed", "mouseReleased"]) await b.send("Input.dispatchMouseEvent", { type, ...pt, button: "left", clickCount: 1 });
      assert.strictEqual((await marked()).length, 1, "tap to place");
      await clickUndo();
      await b.click("#editor-oct-down");
      await b.click('.tray-note[data-name="G"]');
      await b.click("#editor-replace-ding");
      assert.deepStrictEqual(await marked(), ["ding0"], "Replace ding");
      await clickUndo();
      await b.eval(`editorSession.sel = { ring: "rim", i: 0 }; editorRender(); return true;`);
      await b.eval(`editorTrade(editorSession.history.present, { ring: "rim", i: 0 }, { ring: "rim", i: 1 }); editorRender(); return true;`);
      assert.deepStrictEqual(await marked(), ["rim0", "rim1"], "trade, both ends");
      await clickUndo();
      await b.eval(`document.querySelector('#editor-pan [data-fk="rim:0"]').focus(); return true;`);
      await b.key(" ", "Space", 32);
      await b.key("ArrowRight", "ArrowRight", 39);
      await b.key(" ", "Space", 32);
      assert.deepStrictEqual(await marked(), ["rim0", "rim1"], "keyboard trade");
      await clickUndo();
      await b.click('.tray-note[data-name="B"]');
      await b.eval(`document.querySelector('#editor-pan [data-fk="rim:0"]').focus(); return true;`);
      await b.key("Enter", "Enter", 13);
      assert.strictEqual((await marked()).length, 1, "keyboard placement");
    });

    test("drag ux X4: a removal highlights nothing and a cross-ring move highlights only its destination", async () => {
      const marked = () => b.eval(`return [...document.querySelectorAll("#editor-pan .ehit.editor-new")].map((e) => e.dataset.ring + e.dataset.i);`);
      await setup(SCALE_);
      await liftFrom(await noteAt("rim", 2), { x: 195, y: 5 });
      await touch("touchMove", { x: 195, y: 5 });
      await touch("touchEnd");
      await pause(700);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-status").textContent;`), "C4 removed.Undo");
      assert.deepStrictEqual(await marked(), [], "removal marks nothing");
      await clickUndo();
      await liftFrom(await noteAt("rim", 1), await spotNow((await geom()).bottom, -90));
      await touch("touchMove", await spotNow((await geom()).bottom, -90));
      await touch("touchEnd");
      await pause(700);
      assert.deepStrictEqual(await names("bottom"), ["Bb3"], "moved to the bottom");
      assert.deepStrictEqual(await marked(), ["bottom0"], "move marks the destination only");
    });

    test("drag ux E5: with reduced motion the pan stays at 1x and unscaled, the panel is still out of play, and the highlight is still set", async () => {
      await setup(SCALE_);
      await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      try {
        const rest = await geometry();
        await liftFrom(await chipAt("B"), await noteAt("rim", 0));
        const instant = await panelCss();
        for (const k of Object.keys(instant)) assert.strictEqual(instant[k].vis, "hidden", "hidden at once, no fade: " + k);
        await pause(400);
        const now = await geometry();
        assert.strictEqual(await isDragging(), true);
        assert.ok(Math.abs(now.svg.width - rest.svg.width) < 0.5, "rect width unchanged");
        assert.strictEqual(now.mag, 1);
        assert.ok(now.transform === "none" || /^matrix\(1, 0, 0, 1, 0, 0\)$/.test(now.transform), "no transform on the pan box: " + now.transform);
        const css = await panelCss();
        for (const k of Object.keys(css)) assert.deepStrictEqual(css[k], { opacity: "0", pe: "none", vis: "hidden" }, k);
        await touch("touchMove", await spotNow((await geom()).rim, 22.5));
        await touch("touchEnd");
        await pause(500);
        assert.strictEqual(await b.eval(`return document.querySelectorAll("#editor-pan .ehit.editor-new").length;`), 1);
      } finally {
        await b.send("Emulation.setEmulatedMedia", { features: [] });
      }
    });

    test("drag ux E6: a resize during a live drag cancels it, clears dragging and places nothing", async () => {
      await setup(SCALE_);
      await liftFrom(await chipAt("B"), await noteAt("rim", 0));
      await pause(100);
      assert.strictEqual(await live(), true);
      await b.setViewport(844, 390, true);
      await pause(400);
      assert.strictEqual(await live(), false);
      assert.strictEqual(await isDragging(), false);
      for (const [k, v] of Object.entries(await panelCss())) assert.deepStrictEqual(v, { opacity: "1", pe: "auto", vis: "visible" }, "panel restored after resize: " + k);
      assert.strictEqual((await names("rim")).length, 8);
      await touch("touchEnd");
    });

    test("drag ux E6b: a page hidden during a live drag cancels it", async () => {
      await setup(SCALE_);
      await liftFrom(await chipAt("B"), await noteAt("rim", 0));
      await pause(100);
      await b.eval(`Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange")); return true;`);
      await pause(300);
      assert.strictEqual(await live(), false);
      assert.strictEqual(await isDragging(), false);
      assert.strictEqual((await names("rim")).length, 8);
      await touch("touchEnd");
    });

    test("drag ux E6c: orientationchange cancels a live drag, and every listener a drag adds is removed when it ends", async () => {
      await setup(SCALE_);
      await b.eval(`window.__ls = {};
        for (const target of [window, document]) {
          const add = target.addEventListener.bind(target), del = target.removeEventListener.bind(target);
          target.addEventListener = (type, fn, o) => { if (["resize", "orientationchange", "visibilitychange"].includes(type)) window.__ls[type] = (window.__ls[type] || 0) + 1; return add(type, fn, o); };
          target.removeEventListener = (type, fn, o) => { if (["resize", "orientationchange", "visibilitychange"].includes(type)) window.__ls[type] = (window.__ls[type] || 0) - 1; return del(type, fn, o); };
        }
        return true;`);
      await liftFrom(await chipAt("B"), await noteAt("rim", 0));
      await pause(100);
      assert.deepStrictEqual(await b.eval(`return window.__ls;`), { resize: 1, orientationchange: 1, visibilitychange: 1 });
      await b.eval(`window.dispatchEvent(new Event("orientationchange")); return true;`);
      await pause(100);
      assert.strictEqual(await live(), false, "orientationchange cancels");
      assert.strictEqual(await isDragging(), false);
      assert.deepStrictEqual(await b.eval(`return window.__ls;`), { resize: 0, orientationchange: 0, visibilitychange: 0 });
      await touch("touchEnd");
      await liftFrom(await chipAt("B"), await noteAt("rim", 0));
      await touch("touchMove", await spotNow((await geom()).rim, 22.5));
      await touch("touchEnd");
      await pause(400);
      assert.deepStrictEqual(await b.eval(`return window.__ls;`), { resize: 0, orientationchange: 0, visibilitychange: 0 }, "a drop removes them too");
    });

    test("drag ux E7: a second pointer during a live drag is ignored and the first finger's drop still lands", async () => {
      await setup(SCALE_);
      await liftFrom(await chipAt("B"), await noteAt("rim", 0));
      await pause(100);
      await b.eval(`for (const type of ["pointermove", "pointerup", "pointercancel"]) window.dispatchEvent(new PointerEvent(type, { pointerId: 99, clientX: 5, clientY: 5, bubbles: true })); return true;`);
      assert.strictEqual(await live(), true, "the stray pointer did not end the drag");
      await touch("touchMove", await spotNow((await geom()).rim, 22.5));
      await touch("touchEnd");
      await pause(500);
      assert.deepStrictEqual((await names("rim")).slice(-1), ["B4"]);
    });

    test("drag ux iPad landscape: the grid areas are unchanged and a live drag still sets and clears dragging", async () => {
      for (const [w, h] of [[1180, 820]]) {
        await setup(SCALE_, w, h);
        const areas = await b.eval(`return getComputedStyle(document.getElementById("editor")).gridTemplateAreas;`);
        await liftFrom(await chipAt("B"), await noteAt("rim", 0));
        await pause(300);
        assert.strictEqual(await isDragging(), true, `${w}x${h}`);
        assert.strictEqual(await b.eval(`return getComputedStyle(document.getElementById("editor")).gridTemplateAreas;`), areas, "grid areas are the same while dragging");
        await touch("touchMove", await spotNow((await geom()).rim, 22.5));
        await touch("touchEnd");
        await pause(500);
        assert.strictEqual(await isDragging(), false, `${w}x${h}`);
        assert.strictEqual((await names("rim")).length, 9, `${w}x${h}: the drop landed`);
      }
    });
  });

  describe("TRI-59 owner DEV-QA nits 3", () => {
    const DELETE_LABEL = "DELETE THIS SCALE";
        const saveNew = async (line) => {
      await openAdd();
      await typeLine(line);
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the save to close" });
    };
    const reopenSelected = async () => {
      await b.eval(`const view = allDeckViews().find((v) => savedEqual(v.selection, selection)); openEditSheet(view.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor on the selected scale" });
    };
    const label = () => b.eval(`return document.getElementById("editor-delete").getAttribute("aria-label");`);

    test("TRI59 delete is offered on an edited scale only, as a 44px target in the header", async () => {
      await fresh();
      await openAdd();
      assert.strictEqual(await b.eval(`return !!document.getElementById("editor-delete");`), false, "no delete on a scale not yet saved");
      await fresh();
      await openBuiltin();
      const r = await b.eval(`const e = document.getElementById("editor-delete"), q = e.getBoundingClientRect(), h = document.querySelector(".editor-head").getBoundingClientRect();
        return { name: e.getAttribute("aria-label"), w: q.width, h: q.height, inHead: q.left >= h.left && q.right <= h.right + 0.5 && q.top >= h.top - 0.5 && q.bottom <= h.bottom + 0.5 };`);
      assert.deepStrictEqual(r, { name: DELETE_LABEL, w: r.w, h: r.h, inHead: true });
      assert.ok(r.w >= 44 && r.h >= 44, JSON.stringify(r));
    });

    test("TRI59 delete first tap arms and says what will go, the second removes the saved scale and closes the editor", async () => {
      await fresh();
      await saveNew(SCALE);
      const before = await savedCount();
      await reopenSelected();
      await b.click("#editor-delete");
      assert.strictEqual(await label(), "TAP AGAIN TO DELETE");
      assert.strictEqual(await savedCount(), before, "one tap deletes nothing");
      assert.match(await b.eval(`return document.getElementById("editor-status").textContent;`), /^Tap again to remove .+ This cannot be undone\.$/);
      await b.click("#editor-delete");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the editor to close after delete" });
      assert.strictEqual(await savedCount(), before - 1);
    });

    test("TRI59 delete is disarmed by tapping anywhere else in the editor", async () => {
      await fresh();
      await saveNew(SCALE);
      const before = await savedCount();
      await reopenSelected();
      await b.click("#editor-delete");
      await b.click("#editor-pan");
      assert.strictEqual(await label(), DELETE_LABEL);
      assert.doesNotMatch(await b.eval(`return document.getElementById("editor-status").textContent;`), /Tap again to remove/);
      await b.click("#editor-delete");
      assert.strictEqual(await label(), "TAP AGAIN TO DELETE");
      assert.strictEqual(await savedCount(), before);
    });

    test("TRI59 delete leaves the header fitting at 320, 375 and 390", async () => {
      for (const [w, h] of [[320, 568], [375, 667], [390, 844]]) {
        await fresh(w, h);
        await openBuiltin();
        const r = await b.eval(`const head = document.querySelector(".editor-head"), q = head.getBoundingClientRect();
          const kids = [...head.querySelectorAll("button")].map((e) => e.getBoundingClientRect());
          return { fits: head.scrollWidth <= head.clientWidth + 0.5 && kids.every((k) => k.left >= q.left - 0.5 && k.right <= q.right + 0.5 && k.width >= 44 && k.height >= 44),
            overlap: kids.some((k, i) => kids.some((o, j) => j > i && k.left < o.right - 0.5 && o.left < k.right - 0.5)), n: kids.length };`);
        assert.deepStrictEqual(r, { fits: true, overlap: false, n: 4 }, w + " " + JSON.stringify(r));
      }
    });

    const NEO_LINE = "[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4";
    const slotAngles = () => b.eval(`const m = editorSession.history.present, map = m.options.profile.map, solved = HPE.layout.solve({ fields: m.fields, options: m.options });
      return map.map((key, slot) => { if (key === null) return null; const ref = editorNeoRef(m, slot), id = ringIds(m.fields, ref.ring)[ref.i];
        return { key, angle: solved.value.geom.place[id][0] }; });`);
    const profileMap = () => b.eval(`return editorSession.history.present.options.profile.map.slice();`);
    const fixtureAngles = () => b.eval(`return HPE.layout.PROFILE.angles.slice();`);
    const nextLarger = (set, a) => { const sorted = [...set].sort((x, y) => x - y); return sorted.find((v) => v > a) ?? sorted[0]; };
    const status = () => b.eval(`return document.getElementById("editor-status").textContent;`);
    const neoSetup = async (width = 375, height = 667) => {
      await fresh(width, height);
      await openAdd();
      await typeLine(NEO_LINE);
      await b.click("#editor-type-neotone");
    };

    test("TRI59c the Neotone layout row offers Mirror and two rotate buttons, momentary, in view; Standard keeps its four", async () => {
      for (const [w, h] of [[320, 568], [375, 667], [820, 1180]]) {
        await fresh(w, h);
        await openAdd();
        await typeLine("[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4");
        const std = await b.eval(`const vis = (id) => { const e = document.getElementById(id); return e.offsetParent !== null; };
          return { shown: ["editor-mirror-top", "editor-mirror-bottom", "editor-anchor-one", "editor-anchor-between"].map(vis),
            rotate: ["editor-rotate-ccw", "editor-rotate-cw"].map(vis), note: !!document.getElementById("editor-layout-note"),
            pressed: document.getElementById("editor-mirror-top").getAttribute("aria-pressed") };`);
        assert.deepStrictEqual(std, { shown: [true, true, true, true], rotate: [false, false], note: false, pressed: "false" }, "Standard " + w);
        await b.click("#editor-type-neotone");
        const r = await b.eval(`const ids = ["editor-mirror-top", "editor-rotate-ccw", "editor-rotate-cw"], e = document.getElementById("editor");
          const box = (id) => document.getElementById(id).getBoundingClientRect();
          return { shown: ids.map((id) => document.getElementById(id).offsetParent !== null), hidden: ["editor-mirror-bottom", "editor-anchor-one", "editor-anchor-between"].map((id) => document.getElementById(id).offsetParent === null),
            enabled: ids.map((id) => !document.getElementById(id).disabled), pressed: ids.map((id) => document.getElementById(id).hasAttribute("aria-pressed")),
            names: ids.map((id) => document.getElementById(id).getAttribute("aria-label") || document.getElementById(id).textContent),
            targets: ids.every((id) => box(id).width >= 44 && box(id).height >= 44), inView: ids.every((id) => box(id).left >= 0 && box(id).right <= innerWidth && box(id).bottom <= innerHeight),
            oneRow: ids.every((id) => Math.abs(box(id).top - box(ids[0]).top) < 1), scroll: e.scrollHeight <= e.clientHeight && e.scrollWidth <= e.clientWidth,
            note: !!document.getElementById("editor-layout-note") };`);
        assert.deepStrictEqual({ ...r, names: r.names.length }, { shown: [true, true, true], hidden: [true, true, true], enabled: [true, true, true], pressed: [false, false, false],
          names: 3, targets: true, inView: true, oneRow: true, scroll: true, note: false }, "Neotone " + w + " " + JSON.stringify(r.names));
        await b.click("#editor-type-standard");
        assert.strictEqual(await b.eval(`return document.getElementById("editor-anchor-one").offsetParent !== null && document.getElementById("editor-rotate-cw").offsetParent === null;`), true, "back on Standard");
      }
    });

    test("TRI59c each rotate tap moves every Neotone note one fixture step, says which way, and wraps", async () => {
      await neoSetup();
      const fix = await fixtureAngles();
      for (const [btn, dir, word] of [["editor-rotate-cw", 1, "clockwise"], ["editor-rotate-ccw", -1, "anticlockwise"]]) {
        const before = (await slotAngles()).filter(Boolean);
        await b.click("#" + btn);
        const after = (await slotAngles()).filter(Boolean);
        for (const note of before) {
          const want = dir === 1 ? nextLarger(fix, note.angle) : [...fix].sort((x, y) => y - x).find((v) => v < note.angle) ?? Math.max(...fix);
          assert.strictEqual(after.find((n) => n.key === note.key).angle, want, btn + " " + note.key);
        }
        assert.ok((await status()).includes(word) && (word === "clockwise" ? !(await status()).includes("anti") : true), word + ": " + await status());
      }
      const start = await profileMap();
      for (let i = 0; i < 9; i += 1) await b.click("#editor-rotate-cw");
      assert.deepStrictEqual(await profileMap(), start, "nine steps wrap");
    });

    test("TRI59c Mirror sends each Neotone angle to 540 minus it, twice is the start, undo restores the exact map", async () => {
      await neoSetup();
      const start = await profileMap();
      const before = (await slotAngles()).filter(Boolean);
      await b.click("#editor-mirror-top");
      const after = (await slotAngles()).filter(Boolean);
      for (const note of before) assert.strictEqual(after.find((n) => n.key === note.key).angle, (((540 - note.angle) % 360) + 360) % 360, note.key);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-mirror-top").hasAttribute("aria-pressed");`), false);
      await clickUndo();
      assert.deepStrictEqual(await profileMap(), start, "undo restores the exact prior map");
      await b.click("#editor-mirror-top");
      await b.click("#editor-mirror-top");
      assert.deepStrictEqual(await profileMap(), start, "twice is the identity");
    });

    test("TRI59c a rotated Neotone arrangement is dropped by Cancel and kept through SAVE, reload and the share link", async () => {
      await neoSetup();
      const start = await profileMap();
      await b.click("#editor-rotate-cw");
      await b.click("#editor-rotate-cw");
      const rotated = await profileMap();
      assert.notDeepStrictEqual(rotated, start);
      await b.click("#editor-back");
      await b.click("#editor-dlg-discard");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "cancel to close" });
      assert.strictEqual(await savedCount(), 0, "Cancel saved nothing");
      await openAdd();
      await typeLine(NEO_LINE);
      await b.click("#editor-type-neotone");
      assert.deepStrictEqual(await profileMap(), start, "a new session starts from the proposal");
      await b.click("#editor-rotate-cw");
      await b.click("#editor-rotate-cw");
      const link = await b.eval(`const x = editorExport(editorSession.history.present); const back = HPE.share.decode(x.code); return { ok: back.ok, map: back.ok ? back.value.options.profile.map : null };`);
      assert.deepStrictEqual(link, { ok: true, map: rotated }, "the share code carries the rotated map");
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the save to close" });
      await b.send("Page.navigate", { url: base });
      await b.waitFor(`${APP_READY_EXPR} && booted === true && document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`, { timeout: 15000, label: "the app to boot" });
      await reopenSelected();
      assert.deepStrictEqual(await profileMap(), rotated, "the saved scale reopens rotated");
    });

    test("TRI59c a rotation is not kept when the last mutant note goes (accepted)", async () => {
      await neoSetup();
      await b.click("#editor-rotate-cw");
      const rotated = await profileMap();
      await b.eval(`editorDo((m) => editorRemove(m, "bottom", 0)); editorRender(); return true;`);
      const after = await profileMap();
      assert.ok(after.slice(9).every((k) => k === null));
      assert.notDeepStrictEqual(after.slice(0, 9), rotated.slice(0, 9));
    });

    test("TRI59 octave stepper is compact at every phone and tablet size: one row, 44px targets, no overflow", async () => {
      for (const [w, h] of [[320, 568], [375, 667], [390, 844], [820, 1180], [1180, 820]]) {
        await fresh(w, h);
        await openBuiltin();
        const r = await b.eval(`const q = (id) => document.getElementById(id).getBoundingClientRect();
          const down = q("editor-oct-down"), up = q("editor-oct-up"), lab = q("editor-oct-label"), val = q("editor-oct"), flats = q("editor-flats"), pal = q("editor-palette"), notes = q("editor-notes");
          const e = document.getElementById("editor"), de = document.documentElement;
          return { group: Math.round(up.right - down.left), targets: [down, up, flats, pal].every((x) => x.width >= 44 && x.height >= 44),
            oneRow: [up, flats, pal].every((x) => Math.abs(x.top - down.top) < 1), labelBetween: lab.left >= down.right - 0.5 && lab.right <= up.left + 0.5 && val.left >= down.right - 0.5 && val.right <= up.left + 0.5,
            stacked: val.top >= lab.bottom - 0.5, cols: notes.width / 6, noScroll: e.scrollHeight <= e.clientHeight && e.scrollWidth <= e.clientWidth && de.scrollWidth === ${w} };`);
        assert.ok(r.group <= 160, w + ": octave stepper spans " + r.group + "px (was 4+ grid columns)");
        assert.ok(r.group <= r.cols * 3 + 4, w + ": octave stepper is at most three note columns: " + JSON.stringify(r));
        assert.deepStrictEqual([r.targets, r.oneRow, r.labelBetween, r.stacked, r.noScroll], [true, true, true, true, true], w + " " + JSON.stringify(r));
      }
    });

    const mouse = (type, pt) => b.send("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 });
    const panNote = (ring, i) => b.eval(`const r = document.querySelector('#editor-pan .ehit[data-ring="${ring}"][data-i="${i}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
    const statusText = () => b.eval(`return document.getElementById("editor-status").textContent;`);

    test("TRI59b armed delete disarms on the press and the same press still picks and drags a pan note", async () => {
      await fresh();
      await saveNew(SCALE);
      await reopenSelected();
      await b.click("#editor-delete");
      assert.strictEqual(await label(), "TAP AGAIN TO DELETE");
      const at = await panNote("rim", 1);
      await mouse("mousePressed", at);
      await mouse("mouseReleased", at);
      assert.strictEqual(await label(), DELETE_LABEL, "disarmed");
      assert.deepStrictEqual(await b.eval(`return editorSession.sel;`), { ring: "rim", i: 1 }, "the same click picked the note");
      assert.doesNotMatch(await statusText(), /Tap again to remove/);
      await b.eval(`editorSession.sel = null; editorRender(); return true;`);
      await b.click("#editor-delete");
      assert.strictEqual(await label(), "TAP AGAIN TO DELETE");
      await mouse("mousePressed", at);
      assert.strictEqual(await label(), DELETE_LABEL, "disarmed on the press");
      for (const k of [0.3, 0.6, 1]) await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x + 40 * k, y: at.y + 40 * k, button: "left", buttons: 1 });
      assert.strictEqual(await b.eval(`return !!(editorDrag && editorDrag.live);`), true, "the same press went on to drag");
      await mouse("mouseReleased", { x: at.x + 40, y: at.y + 40 });
    });

    test("TRI59b a delete that fails shows the error in the editor and leaves the button disarmed", async () => {
      await fresh();
      await saveNew(SCALE);
      const before = await savedCount();
      await reopenSelected();
      await b.eval(`window.__realCommit = commitSaved; commitSaved = async () => ({ ok: false, kind: "failure" }); return true;`);
      await b.click("#editor-delete");
      await b.click("#editor-delete");
      await b.waitFor(`document.getElementById("editor-status").getAttribute("data-kind") === "error"`, { label: "the delete error" });
      assert.match(await statusText(), /^Could not save these changes\./);
      assert.strictEqual(await label(), DELETE_LABEL);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-delete").classList.contains("armed") || document.getElementById("editor-delete").title !== document.getElementById("editor-delete").getAttribute("aria-label");`), false);
      assert.strictEqual(await b.eval(`return document.getElementById("scale-sheet").hasAttribute("hidden");`), false, "the editor stays open");
      assert.strictEqual(await savedCount(), before);
      await b.eval(`commitSaved = window.__realCommit; return true;`);
    });

    test("TRI59b the last-scale refusal resets the button title and leaves no stale arming text", async () => {
      await fresh();
      await openBuiltin();
      await b.eval(`const all = allDeckViews; allDeckViews = () => all().filter((v) => savedEqual(v.selection, selection)); return true;`);
      await b.click("#editor-delete");
      await b.click("#editor-delete");
      assert.strictEqual(await label(), DELETE_LABEL);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-delete").title;`), DELETE_LABEL);
      assert.strictEqual(await b.eval(`return editorSession.delNote;`), "");
    });

    test("TRI59b a drop restores the panel even when a new press has already begun, but not while that press is a live drag", async () => {
      await fresh(390, 844, true, true);
      await openAdd();
      await typeLine(SCALE);
      const chip = await b.eval(`const r = document.querySelector('.tray-note[data-name="B"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
      const rim = await panNote("rim", 0);
      for (const live of [false, true]) {
        await mouse("mousePressed", chip);
        for (const k of [0.3, 0.6]) await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: chip.x + (rim.x - chip.x) * k, y: chip.y + (rim.y - chip.y) * k, button: "left", buttons: 1 });
        assert.strictEqual(await b.eval(`return !!(editorDrag && editorDrag.live);`), true);
        await b.eval(`const c = document.querySelector('.tray-note[data-name="C"]');
          editorDragEnd({ type: "pointerup", clientX: 5, clientY: 5 });
          c.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "mouse", pointerId: 9, button: 0, clientX: 20, clientY: 20, bubbles: true }));
          ${live ? "editorDrag.live = true;" : ""} return true;`);
        await new Promise((r) => setTimeout(r, 400));
        const dragging = await b.eval(`return document.getElementById("editor").classList.contains("dragging");`);
        assert.strictEqual(dragging, live, live ? "a live drag keeps the panel out" : "a press that has not lifted does not keep the panel hidden");
        await b.eval(`if (editorDrag) editorDrag.live = false; editorDragEnd(null); document.getElementById("editor").classList.remove("dragging"); return true;`);
        await mouse("mouseReleased", rim);
      }
    });

    test("TRI59 octave label and delete fit in all eight locales at 320, 375 and 390 with the real fonts", async () => {
      const prev = b;
      b = await launch({ foregroundSettle: true, realFonts: true });
      try {
        for (const width of [390, 375, 320]) {
          await fresh(width, 844);
          await openBuiltin();
          await b.eval(`return document.fonts.ready.then(() => true);`);
          const langs = await b.eval(`return [...document.getElementById("lang-select").options].map((o) => o.value).filter((v) => v !== "auto");`);
          assert.strictEqual(langs.length, 8);
          for (const lang of langs) {
            await b.eval(`const e = document.getElementById("lang-select"); e.value = ${JSON.stringify(lang)}; e.dispatchEvent(new Event("change", { bubbles: true })); return true;`);
            await b.waitFor(`document.documentElement.lang === ${JSON.stringify(lang)}`, { label: "locale applied" });
            await b.eval(`editorRender(); return document.fonts.ready.then(() => true);`);
            await b.click("#editor-type-neotone");
            const bad = await b.eval(`const out = [], row = document.querySelector(".editor-octaves").getBoundingClientRect();
              for (const id of ["editor-oct-label", "editor-oct", "editor-flats", "editor-delete", "editor-mirror-top", "editor-rotate-ccw", "editor-rotate-cw"]) {
                const e = document.getElementById(id); if (!e || !e.offsetParent) continue;
                const box = e.getBoundingClientRect();
                if (e.scrollWidth > e.clientWidth + 0.5) out.push(id + " scrollWidth");
                const range = document.createRange(); range.selectNodeContents(e);
                for (const r of range.getClientRects()) if (r.width && (r.left < box.left - 0.5 || r.right > box.right + 0.5)) out.push(id + ":" + e.textContent);
              }
              const q = document.getElementById("editor-palette").getBoundingClientRect(); if (q.right > row.right + 0.5) out.push("row overflow");
              const ed = document.getElementById("editor"); if (ed.scrollWidth > ed.clientWidth || ed.scrollHeight > ed.clientHeight) out.push("panel scroll");
              return out;`);
            assert.deepStrictEqual(bad, [], width + " " + lang);
          }
        }
      } finally {
        await b.close();
        b = prev;
      }
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
