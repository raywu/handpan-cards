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
  let dragTouch = true;
  let magPinned = true;
  const SCALE = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5";
  const RIM8 = "A3 Bb3 C4 D4 E4 F4 G4 A4";

  async function exposeDrawerControl(selector, click) {
    const needsOpen = await b.eval(`
      const control = document.querySelector(${JSON.stringify(selector)});
      return !!control?.closest(".drawerexp-body") && window.drawerExperiment?.expanded === false;
    `);
    if (!needsOpen) return;
    await click("#drawerexp-handle");
    await b.waitFor(`window.drawerExperiment?.expanded === true &&
      !document.getElementById("drawerexp-body").inert &&
      document.getElementById("drawerexp").getAnimations().every(animation => animation.playState !== "running")`,
      { label: "the drawer to restore its controls" });
  }

  before(async () => {
    if (process.env.HPC_EDITOR_HOSTED_URL) {
      base = process.env.HPC_EDITOR_HOSTED_URL;
    } else {
      server = http.createServer((req, res) => {
        const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
        const file = path.resolve(REPO, rel);
        if (!file.startsWith(REPO + path.sep)) { res.writeHead(403).end(); return; }
        fs.readFile(file, (err, buf) => {
          if (err) { res.writeHead(404).end(); return; }
          const html = rel === "index.html";
          res.writeHead(200, { "Content-Type": html ? "text/html; charset=utf-8" : "application/octet-stream", "Cache-Control": "no-store" });
          res.end(html ? buf.toString("utf8").replace("const DRAG_ON_TOUCH = true;", () => "const DRAG_ON_TOUCH = " + dragTouch + ";").replace("</head>", () => magPinned ? "<style>#editor.dragging .editor-panbox{transform:none!important}</style></head>" : "</head>") : buf);
        });
      });
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      base = `http://127.0.0.1:${server.address().port}/index.html`;
    }
    b = await launch({ foregroundSettle: true });
    assert.ok(b, "browser found but launch() returned null");
    const rawClick = b.click.bind(b);
    b.click = async (selector, ...rest) => {
      const need = /^#editor-(redo|remove|reset|delete)\b/.test(selector) ? ["editor-menu", "editor-more"]
        : /^#editor-(palette|swatches|anchor-)/.test(selector) ? ["editor-panel-layout", "editor-tab-layout"] : null;
      await exposeDrawerControl(need ? "#" + need[1] : selector, rawClick);
      if (need && await b.eval(`const e = document.getElementById(${JSON.stringify(need[0])}); return !!e && e.hidden;`)) await rawClick("#" + need[1]);
      await b.eval(`const e = document.querySelector(${JSON.stringify(selector)}); if (e && e.closest && e.closest("#editor-region") && !e.closest("#editor-tabs")) e.scrollIntoView({ block: "nearest" }); return true;`);
      return rawClick(selector, ...rest);
    };
  });
  after(async () => {
    if (b) await b.close();
    if (server) await new Promise((r) => server.close(r));
  });
  afterEach(async () => {
    try {
      await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 0, y: 0, button: "left", buttons: 0, clickCount: 1 });
    } finally { assertNoUncaught(); }
  });

  async function fresh(width = 375, height = 667, on = true, touchDrag = true) {
    dragTouch = touchDrag;
    await b.setViewport(width, height, width < 700);
    await b.send("Storage.clearDataForOrigin", { origin: new URL(base).origin, storageTypes: "indexeddb,local_storage" });
    await b.send("Page.navigate", { url: base });
    await b.waitFor(`${APP_READY_EXPR} && booted === true && document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`,
      { timeout: 15000, label: "the app to boot" });
  }
  const openAdd = async (oct = 4) => {
    await b.eval(`openScaleSheet(addChip); return true;`);
    await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor panel" });
    if (oct !== 3) await b.eval(`const h = editorSession.history; h.present.view = { ...h.present.view, oct: ${oct} }; editorRender(); return true;`);
  };
  const openBuiltin = async () => {
    await b.eval(`const d = allDeckViews().find((v) => savedEqual(v.selection, selection)).deck; openEditSheet(d, addChip); return true;`);
    await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor panel on a built-in" });
  };
  const clickUndo = async () => b.click((await b.eval(`return !!document.getElementById("editor-notice-undo");`)) ? "#editor-notice-undo" : "#editor-undo");
  const model = () => b.eval(`return JSON.parse(JSON.stringify(editorSession.history.present));`);
  const place = (ring) => b.eval(`const s = editorSession, hit = { kind: "spot", ring: ${JSON.stringify(ring)} }; if (s.held) editorPlaceHeld(hit, s.history.present); else if (s.sel && s.sel.ring !== "ding") editorMoveSelected(hit, s.history.present); return true;`);
  const zoneCount = (zone) => b.eval(`const e = document.querySelector('#editor-counts [data-zone="${zone}"]'); return e ? e.textContent : null;`);
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

  // Use the same visible editor flows on loopback and the hosted RC.
  // Model injection is fixture setup only.
  describe("Editor placement and persistence", () => {
    before(() => { magPinned = false; });
    after(() => { magPinned = true; });
    let touching = false;
    async function touch(type, point) {
      await b.send("Input.dispatchTouchEvent", {
        type, touchPoints: point ? [{ ...point, id: 1, radiusX: 4, radiusY: 4, force: 1 }] : []
      });
      touching = type === "touchStart" || type === "touchMove";
    }
    afterEach(async () => {
      if (touching) await touch("touchCancel");
    });
    const center = selector => b.eval(`
      const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    `);
    async function fixture(text, options = {}, oct = 3, height = 700) {
      await fresh(390, height);
      await b.click("#strip-add");
      await b.waitFor("!!window.drawerExperiment && !!document.getElementById('editor-line')",
        { label: "the hosted editor to open" });
      await b.eval(`
        const loaded = ${JSON.stringify(text)} ? editorLoad(${JSON.stringify(text)}, ${JSON.stringify(options)})
          : { ok: true, value: editorSession.history.present };
        if (!loaded.ok) throw Error(loaded.reason);
        const m = loaded.value;
        m.view = { oct: ${oct}, flats: false };
        editorSession.history = editorHistoryNew(m);
        editorSession.base = m;
        editorRender();
        return true;
      `);
    }
    async function lift(selector) {
      await b.waitFor(`(() => {
        const node = document.querySelector(${JSON.stringify(selector)});
        if (!node) return false;
        const r = node.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return node.matches(".ehit") ? !!hit?.closest("#editor-pan") : node === hit || node.contains(hit);
      })()`, { label: "the drag source to be exposed" });
      const point = await center(selector);
      await touch("touchStart", point);
      await touch("touchMove", { x: point.x, y: point.y - 20 });
      await b.waitFor("!!editorDrag?.live && !drawerExperiment.expanded",
        { label: "the touch drag to lift and clear the drawer" });
    }
    async function aim(ring, angle, landing = angle) {
      let target;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const point = await b.eval(`
          const svg = document.querySelector("#editor-pan svg");
          const geom = editorSolve(editorSession.history.present).value.geom;
          const radius = editorOrbit(geom, "${ring}") * 100 + ${attempt % 2 ? 1.5 : 0};
          const radians = ${angle} * Math.PI / 180;
          const p = new DOMPoint(radius * Math.cos(radians), -radius * Math.sin(radians))
            .matrixTransform(svg.getScreenCTM());
          return { x: p.x, y: p.y };
        `);
        await touch("touchMove", point);
        await new Promise(resolve => setTimeout(resolve, 60));
        target = await b.eval(`
          const drag = editorDrag;
          const clientX = parseFloat(drag.ghost.style.left);
          const clientY = parseFloat(drag.ghost.style.top);
          return Math.hypot(clientX - ${point.x}, clientY - ${point.y}) <= 1.5
            ? editorDropTarget({ clientX, clientY }, drag.src) : null;
        `);
        const actual = target?.guidedAngle ?? target?.angle;
        // CDP touch coordinate rounding can perturb an unpinned angle.
        if (target?.kind === "spot" && target.ring === ring && Math.abs(actual - landing) < 0.01) return;
      }
      assert.fail("touch did not reach " + ring + " " + angle + " " + JSON.stringify(target));
    }
    const angleSnapshot = () => b.eval(`
      const solved = editorSolve(editorSession.history.present);
      return Object.fromEntries(["rim", "inner", "bottom"].map(ring => [ring, editorAnglesOf(solved, ring)]));
    `);
    async function clickReady(selector) {
      await b.waitFor(`(() => {
        const button = document.querySelector(${JSON.stringify(selector)});
        if (!button || button.disabled) return false;
        const r = button.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return hit === button || button.contains(hit);
      })()`, { label: selector + " to be enabled and hittable" });
      await b.click(selector);
    }
    async function saveAndReopen(version) {
      const count = await savedCount();
      await clickReady("#editor-save");
      await b.waitFor("document.getElementById('scale-sheet').hidden", { label: "Save closes the editor" });
      assert.equal(await savedCount(), count + 1);
      const entry = await b.eval("return savedState.entries.at(-1);");
      assert.equal(entry.record.v, version);
      const url = new URL(base);
      url.searchParams.set("editorBrowserReopen", "1");
      await b.send("Page.navigate", { url: url.href });
      await b.waitFor(`location.search.includes("editorBrowserReopen=1") && ${APP_READY_EXPR} &&
        booted === true && savedState.entries.some(row => row.instanceId === ${JSON.stringify(entry.instanceId)})`,
        { timeout: 15000, label: "the committed record restores on the same hosted page" });
      await b.click(`#decks .chip[data-selection-id="${entry.instanceId}"]`);
      await b.waitFor("!!document.getElementById('editor-line')", { label: "the saved editor to reopen" });
      return entry.record;
    }

    test("EDITOR-RC-STANDARD-GROW: Guided tap grows each Standard ring and preserves the pitches", async () => {
      const seed = "(D3) A3 B3 C4 D4 E4 F4 G4 | D#4 G#4 A#4";
      for (const [ring, count] of [["rim", 8], ["inner", 4]]) {
        await fixture(seed, {}, 4);
        await b.click('.tray-note[data-name="C#"]');
        const mark = `#editor-pan .guided-landing[data-guided-zone="${ring}"]`;
        await b.waitFor(`!!document.querySelector(${JSON.stringify(mark)})`, { label: "the growth outline to appear" });
        const angle = await b.eval(`return +document.querySelector(${JSON.stringify(mark)}).dataset.angle;`);
        await b.waitFor(`(() => {
          const circle = document.querySelector(${JSON.stringify(mark + " circle")});
          const r = circle?.getBoundingClientRect();
          return !!r && !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("#editor-pan");
        })()`, { label: "the growth target to be exposed" });
        await touch("touchStart", await center(mark + " circle"));
        await touch("touchEnd");
        await b.waitFor("editorSession.history.past.length === 1", { label: "one placement transaction" });
        const placed = await b.eval(`
          const m = editorSession.history.present;
          const notes = editorNames(m, "${ring}");
          return { notes, angle: editorAnglesOf(editorSolve(m), "${ring}")[notes.indexOf("C#4")],
            drawer: drawerExperiment.expanded };
        `);
        assert.equal(placed.notes.length, count);
        assert.equal(placed.angle, angle);
        assert.equal(placed.drawer, false);
        await clickUndo();
        assert.equal(await text(), seed);
      }
    });

    test("EDITOR-RC-CYCLOPS-SNAP: a moved Cyclops note lands at the visible Guided seat", async () => {
      await fixture("");
      await b.eval(`
        editorDo(m => editorReplaceDing(m, "C#3"));
        editorDo(m => editorPlace(m, "rim", "D3"));
        editorDo(m => editorPlace(m, "inner", "A3"));
        editorRender();
        return true;
      `);
      assert.equal(await text(), "(C#3) D3 | A3");
      const undoDepth = await b.eval("return editorSession.history.past.length;");
      await b.click("#drawerexp-handle");
      const before = await angleSnapshot();
      await lift('#editor-pan .ehit[data-ring="inner"]');
      await aim("inner", 150, 166);
      const landing = await b.eval(`return +document.querySelector(
        '.guided-landing[data-guided-zone="inner"]').dataset.angle;`);
      assert.equal(landing, 166);
      await touch("touchEnd");
      await b.waitFor(`editorSession.history.past.length === ${undoDepth + 1}`, { label: "the Guided drag to commit" });
      assert.deepEqual(await angleSnapshot(), { ...before, inner: [landing] });
      await clickReady("#editor-undo");
      await b.waitFor(`editorSession.history.past.length === ${undoDepth}`,
        { label: "Undo restores the previous layout transaction" });
      assert.deepEqual(await angleSnapshot(), before);
    });

    test("D5: a Cyclops tap saves and reloads the exact visible Guided seat", async () => {
      await fresh(390, 700);
      await b.click("#strip-add");
      await typeLine("(D3) A3 B3 C4 D4 E4 F4 G4 | D#4 G#4 A#4");
      const octave = await b.eval('return Number(document.getElementById("editor-oct").textContent);');
      for (let current = octave; current < 4; current++) await b.click("#editor-oct-up");
      for (let current = octave; current > 4; current--) await b.click("#editor-oct-down");
      await b.click('.tray-note[data-name="C#"]');
      const landing = '#editor-pan .guided-landing[data-guided-zone="inner"]';
      await b.waitFor(`(() => {
        const circle = document.querySelector(${JSON.stringify(landing + " circle")});
        const r = circle?.getBoundingClientRect();
        return !!r && !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("#editor-pan");
      })()`, { label: "the Cyclops growth landing to be exposed" });
      const angle = await b.eval(`return +document.querySelector(${JSON.stringify(landing)}).dataset.angle;`);
      await touch("touchStart", await center(landing + " circle"));
      await touch("touchEnd");

      const expectedNotes = ["C#4", "D#4", "G#4", "A#4"];
      const readCyclops = () => b.eval(`
        const model = editorSession.history.present;
        return { notes: editorNames(model, "inner"),
          angles: editorAnglesOf(editorSolve(model), "inner"),
          guided: model.options.guided?.inner };
      `);
      await b.waitFor('editorNames(editorSession.history.present, "inner").includes("C#4")',
        { label: "the tapped Cyclops note to be placed" });
      const placed = await readCyclops();
      assert.deepEqual(placed.notes, expectedNotes);
      assert.equal(placed.angles[placed.notes.indexOf("C#4")], angle);
      assert.equal(placed.guided.size, 4);
      assert.equal(placed.guided.seats.length, 4);

      const record = await saveAndReopen(9);
      assert.deepEqual(record.o.guided.inner, placed.guided);
      assert.deepEqual(await readCyclops(), placed);
    });

    test("EDITOR-RC-GUIDED-SAVE: a custom underside move keeps Guided seats after reload", async () => {
      await fixture("[F3] (D3) A3 C4 E4", {
        angles: { bottom: [270] },
        guided: { rim: { size: 7, seats: [1, 3, 0] } }
      });
      await b.click("#drawerexp-handle");
      const before = await angleSnapshot();
      await lift('#editor-pan .ehit[data-ring="bottom"]');
      await aim("bottom", 200);
      await touch("touchEnd");
      await b.waitFor("editorSession.history.past.length === 1", { label: "the underside move to commit" });
      const moved = { ...before, bottom: [200] };
      assert.deepEqual(await angleSnapshot(), moved);
      const shared = await b.eval(`
        const m = editorSession.history.present;
        const exported = editorExport(m);
        if (!exported.code) throw Error(exported.reason);
        const imported = editorLoadShare(exported.code);
        if (!imported.ok) throw Error(imported.reason);
        const solved = editorSolve(imported.value);
        return { wire: exported.code[0], rim: editorAnglesOf(solved, "rim"),
          inner: editorAnglesOf(solved, "inner"), bottom: editorAnglesOf(solved, "bottom") };
      `);
      assert.deepEqual(shared, { wire: "B", ...moved });
      const record = await saveAndReopen(9);
      assert.deepEqual(record.o.angles.bottom, [200]);
      assert.deepEqual(await angleSnapshot(), moved);
    });

    test("EDITOR-RC-NEOTONE-SAVE: a Neotone move occupies the chosen slot after reload", async () => {
      const map = ["r57", "r58", "r60", null, "r62", "r64", "r65", "r67", null,
        null, null, null, null, null, null, null, null, null];
      await fixture("(D3) A3 Bb3 C4 D4 E4 F4 G4", { profile: { id: "paired", rev: 3, map } });
      await b.click("#drawerexp-handle");
      await lift('#editor-pan .ehit[data-ring="rim"][data-i="0"]');
      await touch("touchMove", await center('#editor-pan .eslot[data-slot="3"]'));
      await b.waitFor('!!document.querySelector("#editor-pan .editor-landing")',
        { label: "the Neotone landing outline" });
      await touch("touchEnd");
      await b.waitFor("editorSession.history.past.length === 1", { label: "the Neotone slot move to commit" });
      const snapshot = () => b.eval(`
        const m = editorSession.history.present;
        return { map: m.options.profile.map, place: editorSolve(m).value.geom.place };
      `);
      const moved = await snapshot();
      assert.equal(moved.map[3], "r57");
      assert.equal(moved.map[0], null);
      assert.deepEqual((await saveAndReopen(8)).o.profile.map, moved.map);
      assert.deepEqual(await snapshot(), moved);
    });

    test("EDITOR-RC-DUPLICATE: a duplicate drag explains the pitch conflict", async () => {
      await fixture("(D3) A3 B3 C4 D4 E4 F4 G4");
      const before = await model();
      await lift('.tray-note[data-name="B"]');
      await aim("inner", 90);
      await touch("touchEnd");
      await b.waitFor("!!document.querySelector('.placement-rejected-marker')",
        { label: "the rejected note marker" });
      assert.deepEqual(await model(), before);
      assert.equal(await b.eval('return editorEl("editor-status").textContent.trim();'),
        "B3 wasn’t placed. An exact pitch can appear only once on the handpan.");
    });

    test("EDITOR-RC-DUPLICATE-REDUCED: duplicate tray and underside drags use the circular refusal", async () => {
      for (const source of ["tray", "bottom"]) {
        const seed = "(D3) A3 B3 C4 D4 E4 F4 G4";
        await fixture(source === "bottom" ? "[B3] " + seed : seed, {}, 3, 664);
        await b.send("Emulation.setEmulatedMedia", {
          features: [{ name: "prefers-reduced-motion", value: "reduce" }]
        });
        try {
          if (source === "bottom") await b.click("#drawerexp-handle");
          const before = await model();
          await lift(source === "tray" ? '.tray-note[data-name="B"]' : '#editor-pan .ehit[data-ring="bottom"]');
          await aim("inner", 90);
          await touch("touchEnd");
          await b.waitFor("!!document.querySelector('.placement-rejected-marker')",
            { label: "the reduced-motion rejection marker" });
          const result = await b.eval(`
            const marker = document.querySelector(".placement-rejected-marker");
            const note = marker.querySelector(".placement-rejected-note");
            const rect = note.getBoundingClientRect();
            return { width: rect.width, height: rect.height, radius: getComputedStyle(note).borderRadius,
              animation: getComputedStyle(marker).animationName,
              error: editorEl("editor-status").textContent.trim() };
          `);
          assert.deepEqual(result, {
            width: 44, height: 44, radius: "50%", animation: "none",
            error: "B3 wasn’t placed. An exact pitch can appear only once on the handpan."
          });
          assert.deepEqual(await model(), before);
        } finally {
          await b.send("Emulation.setEmulatedMedia", { features: [] });
        }
      }
    });

    test("EDITOR-RC-DRAWER: the short-screen drawer closes and reopens with Save reachable", async () => {
      await fixture("(D3) A3 C4 E4", {}, 3, 568);
      assert.equal(await b.eval('return editorEl("drawerexp-handle").getAttribute("aria-expanded");'), "true");
      await clickReady("#drawerexp-handle");
      await b.waitFor('editorEl("drawerexp-body").inert', { label: "the closed drawer to make controls inert" });
      const saveReachable = await b.eval(`
        const save = editorEl("editor-save"), r = save.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === save;
      `);
      assert.equal(saveReachable, true);
      await clickReady("#drawerexp-handle");
      await b.waitFor('!editorEl("drawerexp-body").inert', { label: "the reopened drawer to restore controls" });
      assert.equal(await b.eval('return editorEl("drawerexp-handle").getAttribute("aria-expanded");'), "true");
      assert.equal(await savedCount(), 0);
    });

    test("EDITOR-RC-FORM: the scale input form rejects invalid text and saves corrected notes", async () => {
      await fixture("(D3) A3 B3 C4 E4");
      await clickReady("#editor-more");
      await clickReady("#editor-form-toggle");
      const ding = "#editor-form-ding";
      const enter = async value => {
        await clickReady(ding);
        await b.eval(`
          const input = document.querySelector(${JSON.stringify(ding)});
          input.value = ${JSON.stringify(value)};
          input.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        `);
        await b.key("Enter", "Enter", 13);
      };
      await enter("invalid");
      await clickReady("#editor-back");
      await clickReady("#editor-dlg-save");
      await b.waitFor('editorEl("editor-dialog").hidden', { label: "invalid form Save to return to the editor" });
      assert.equal(await b.eval('return document.activeElement.id;'), "editor-form-ding");
      assert.equal(await b.eval('return editorEl("editor-form-ding").value;'), "invalid");
      assert.equal(await b.eval('return editorEl("editor-form-ding").getAttribute("aria-invalid");'), "true");
      assert.equal(await savedCount(), 0);
      await enter("E3");
      await clickReady("#editor-more");
      await clickReady("#editor-form-toggle");
      assert.match(await text(), /\(E3\)/);
      assert.equal(await b.eval('return editorEl("editor-form").hidden;'), true);
      await clickReady("#editor-save");
      await b.waitFor('editorEl("scale-sheet").hidden', { label: "corrected form notes to save" });
      assert.equal(await savedCount(), 1);
    });
  });

  describe("D13 layout", () => {
    const frame = () => b.eval(`
      const root = document.getElementById("editor");
      const ids = ["editor-back", "editor-line", "drawerexp-handle", "editor-undo", "editor-more",
        "editor-save", "editor-tab-scale", "editor-tab-layout"];
      const box = id => document.getElementById(id).getBoundingClientRect();
      const buttons = ids.filter(id => id !== "editor-line");
      return {
        outerScroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
        rootScroll: [root.scrollWidth, root.clientWidth, root.scrollTop],
        inside: ids.filter(id => {
          const r = box(id);
          return r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth;
        }),
        undersized: buttons.filter(id => { const r = box(id); return r.width < 44 || r.height < 44; }),
        covered: buttons.filter(id => {
          const r = box(id), target = document.getElementById(id);
          return !target.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }),
        expanded: drawerExperiment.expanded,
      };
    `);

    test("375x667: header, line, drawer tabs and pinned actions fit without page scroll", async () => {
      await fresh(375, 667);
      await openBuiltin();
      const result = await frame();
      assert.deepEqual(result.outerScroll, [375, 667]);
      assert.equal(result.rootScroll[0], result.rootScroll[1]);
      assert.equal(result.rootScroll[2], 0);
      assert.deepEqual(result.inside, []);
      assert.deepEqual(result.undersized, []);
      assert.deepEqual(result.covered, []);
      assert.equal(result.expanded, true);
    });

    test("1280x800 renders a bounded pan with reachable drawer and pinned actions", async () => {
      await fresh(1280, 800);
      await openBuiltin();
      const result = await frame();
      assert.deepEqual(result.outerScroll, [1280, 800]);
      assert.deepEqual(result.inside, []);
      assert.deepEqual(result.covered, []);
      await b.click("#drawerexp-handle");
      await b.waitFor('drawerExperiment.state === "SHUT"', { label: "the desktop drawer to close" });
      const r = await b.eval(`
        const shell = document.querySelector('#editor-pan svg > circle[r="100"]').getBoundingClientRect();
        const handle = document.getElementById("drawerexp-handle").getBoundingClientRect();
        return { width: shell.width, height: shell.height, clear: shell.top >= 0 && shell.bottom <= handle.top };
      `);
      assert.ok(r.width > 0 && r.width <= 480 && Math.abs(r.width - r.height) < 1 && r.clear, JSON.stringify(r));
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
        const d = document.createElement("div");
        d.innerHTML = expected;
        const painted = node => Array.from(node.querySelector("svg").children)
          .filter(e => !e.matches(".ehit-layer, .eunder, .guided-informational"))
          .map(e => e.outerHTML);
        return { painted: painted(drawn), expected: painted(d), bottom: Object.values(m.fields).filter((f) => f[3] === "bottom").length };`);
      assert.ok(r.bottom >= 2, "the fixture has bottom notes");
      assert.deepEqual(r.painted, r.expected);
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
    const polar = (r, deg) => [r * Math.cos(deg * Math.PI / 180), r * Math.sin(deg * Math.PI / 180)];
    const clientOf = (x, y) => b.eval(`const svg = document.querySelector("#editor-pan svg"); const p = new DOMPoint(${x} * 100, -(${y}) * 100).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y };`);
    const geomOf = (key) => b.eval(`return editorSolve(editorSession.history.present).value.geom[${JSON.stringify(key)}];`);
    const spotAt = async (ring, deg) => clientOf(...polar(await b.eval(`return editorOrbit(editorSolve(editorSession.history.present).value.geom, ${JSON.stringify(ring)});`), deg));
    const dingAt = async () => clientOf(0, -(await geomOf("ding_dy")));
    const slotAt = (slot) => b.eval(`const g = editorSolve(editorSession.history.present).value.geom; const p = neoSlotPoint(${slot}, null, g.turn);
      const q = new DOMPoint(p.x, p.y).matrixTransform(document.querySelector("#editor-pan svg").getScreenCTM()); return { x: q.x, y: q.y };`);
    const chipAt = async (name) => {
          await exposeDrawerControl('.tray-note[data-name="' + name + '"]', selector => b.click(selector));
          return b.eval(`const r = document.querySelector('.tray-note[data-name="${name}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
        };
    const statusText = () => b.eval(`return document.getElementById("editor-status").textContent;`);
    const stageOf = () => b.eval(`return JSON.parse(JSON.stringify((({ other, ...st }) => st)(editorStageOf(editorSession.history.present))));`);
    const octave = () => b.eval(`return editorView(editorSession.history.present).oct;`);
    const stillEmpty = () => b.eval(`return editorIsEmpty(editorSession.history.present);`);
    const saveDisabled = () => b.eval(`return document.getElementById("editor-save").disabled;`);
    const tapPoint = async (pt, touch) => {
      if (touch) {
        const t0 = Date.now() / 1000;
        await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pt.x, y: pt.y, radiusX: 4, radiusY: 4, force: 1, id: 1 }], timestamp: t0 });
        await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], timestamp: t0 + 0.05 });
      } else for (const type of ["mousePressed", "mouseReleased"]) await b.send("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", clickCount: 1 });
    };
    const gesture = async (from, to, kind) => {
      const at = (k) => ({ x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
      if (kind === "touch") {
        await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 1 }] });
        for (const k of [0.25, 0.5, 0.75, 1]) await b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...at(k), id: 1 }] });
        await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } else {
        await b.send("Input.dispatchMouseEvent", { type: "mousePressed", ...from, button: "left", buttons: 1, clickCount: 1 });
        for (const k of [0.25, 0.5, 0.75, 1]) await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...at(k), button: "left", buttons: 1 });
        await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...to, button: "left", buttons: 0, clickCount: 1 });
      }
      await b.waitFor(`!document.getElementById("editor").classList.contains("dragging") && !document.getElementById("editor").classList.contains("settling")`, { label: "the pan to finish settling after the drag" });
    };
    const targets = () => b.eval(`const hits = [...document.querySelectorAll("#editor-pan .etarget")];
      const small = hits.filter((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height) < 24; }).length;
      return { rings: hits.map((e) => e.dataset.ring).sort(), small, slots: document.querySelectorAll("#editor-pan .eslot").length,
        mut: document.querySelectorAll("#editor-pan .eslot[data-mut]").length, wait: document.querySelectorAll("#editor-pan .eslot.unavailable").length };`);

    test("a new scale opens as an empty pan: both type buttons enabled, Standard pressed, the ding and every zone drawn, the prompt in the status, Save disabled", async () => {
      await fresh();
      await openAdd();
      const r = await b.eval(`const q = (id) => document.getElementById(id);
        return { std: [q("editor-type-standard").disabled, q("editor-type-standard").getAttribute("aria-pressed")], neo: [q("editor-type-neotone").disabled, q("editor-type-neotone").getAttribute("aria-pressed")],
          save: q("editor-save").disabled, overlay: !!q("editor-empty"), prompt: q("editor-status").textContent.startsWith(t("editor.empty")) };`);
      assert.deepStrictEqual(r, { std: [false, "true"], neo: [false, "false"], save: true, overlay: false, prompt: true });
      const t1 = await targets();
      assert.deepStrictEqual(t1.rings, ["ding"]);
      const guidance = await b.eval(`const pan = document.getElementById("editor-pan");
        return {
          rim: pan.querySelectorAll('.guided-informational[data-guided-zone="rim"]').length,
          inner: pan.querySelectorAll('.guided-informational[data-guided-zone="inner"]').length,
          bottom: pan.querySelectorAll('.balanced-outline.bottom').length
        };`);
      assert.deepStrictEqual(guidance, { rim: 7, inner: 3, bottom: 8 });
      assert.strictEqual(t1.small, 0, "every drawn target is at least 24px across");
      assert.strictEqual(t1.slots, 0);
    });

    for (const [w, h] of [[375, 667], [360, 640]]) {
      test(`the empty pan targets stay at least 24px across at ${w}x${h}, Standard and Neotone`, async () => {
        await fresh(w, h);
        await openAdd();
        const sizes = () => b.eval(`const dims = [...document.querySelectorAll("#editor-pan .etarget, #editor-pan .ekey, #editor-pan .eslot")].map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); });
          return { n: dims.length, min: Math.min(...dims) };`);
        const std = await sizes();
        await b.eval(`document.getElementById("editor-type-neotone").click(); return true;`);
        const neo = await sizes();
        assert.ok(std.n > 0 && std.min >= 24, "Standard targets " + JSON.stringify(std));
        assert.ok(neo.n > 0 && neo.min >= 24, "Neotone targets " + JSON.stringify(neo));
      });
    }

    test("Neotone is one tap away while empty: the ding and 18 slots, all 9 mutant slots available; Standard switches back", async () => {
      await fresh();
      await openAdd();
      await b.click("#editor-type-neotone");
      const on = await b.eval(`const q = (id) => document.getElementById(id); return [q("editor-type-neotone").getAttribute("aria-pressed"), q("editor-type-standard").getAttribute("aria-pressed"), q("editor-save").disabled];`);
      assert.deepStrictEqual(on, ["true", "false", true]);
      const t1 = await targets();
      assert.deepStrictEqual([t1.rings, t1.slots, t1.mut, t1.wait], [["ding"], 18, 9, 0]);
      await b.click("#editor-type-standard");
      const t2 = await targets();
      assert.deepStrictEqual([t2.rings, t2.slots], [["ding"], 0]);
      const guides = await b.eval(`
        return [...new Set([...document.querySelectorAll("#editor-pan .guided-informational")]
          .map(node => node.dataset.guidedZone))].sort();
      `);
      assert.deepStrictEqual(guides, ["inner", "rim"]);
    });

    test("switching pan type and back keeps the staged notes: ding C and two rim notes by tap at 390x844 return at the same rings after Neotone and Standard", async () => {
      await fresh(390, 844);
      await openAdd();
      const o = await octave();
      await b.click('.tray-note[data-name="C"]');
      await tapPoint(await dingAt(), true);
      await b.click('.tray-note[data-name="D"]');
      await tapPoint(await spotAt("rim", 45), true);
      await b.click('.tray-note[data-name="E"]');
      await tapPoint(await spotAt("rim", 135), true);
      const hits = () => b.eval(`return [...document.querySelectorAll("#editor-pan .ehit")].map((c) => [c.dataset.ring, c.dataset.i, c.getAttribute("cx"), c.getAttribute("cy")].join(":"));`);
      const before = await hits();
      const standard = await stageOf();
      assert.deepStrictEqual((await stageOf()).rim, ["D" + o, "E" + o], await statusText());
      assert.strictEqual(before.length, 3);
      await b.click("#editor-type-neotone");
      assert.deepStrictEqual((await stageOf()).main, ["D" + o, "E" + o]);
      assert.strictEqual((await stageOf()).ding, "C" + o);
      await b.click("#editor-type-standard");
      assert.deepStrictEqual(await stageOf(), standard, await statusText());
      assert.deepStrictEqual(await hits(), before);
      assert.strictEqual(await stillEmpty(), true);
      assert.strictEqual(await saveDisabled(), true);
    });

    test("Neotone on an empty Standard pan maps the staged notes (owner 2026-11-15): at 390x844 a ding, two rim notes and a bottom note become two main fields and a mutant, and the original Standard seats return", async () => {
      await fresh(390, 844);
      await openAdd();
      const o = await octave();
      await b.click('.tray-note[data-name="C"]');
      await tapPoint(await dingAt(), true);
      await b.click('.tray-note[data-name="D"]');
      await tapPoint(await spotAt("rim", 45), true);
      await b.click('.tray-note[data-name="E"]');
      await tapPoint(await spotAt("rim", 135), true);
      await b.click('.tray-note[data-name="A"]');
      await tapPoint(await spotAt("bottom", 90), true);
      const standard = await stageOf();
      assert.deepStrictEqual([standard.ding, standard.rim, standard.inner, standard.bottom],
        ["C" + o, ["D" + o, "E" + o], [], ["A" + o]], await statusText());
      await b.click("#editor-type-neotone");
      assert.deepStrictEqual(await stageOf(), { kind: "neotone", ding: "C" + o, main: ["D" + o, "E" + o], mutant: ["A" + o] }, await statusText());
      const shape = await b.eval(`const map = editorSession.history.present.options.profile.map; return [map.slice(0, 9).filter(Boolean).length, map.slice(9).filter(Boolean).length, [...document.querySelectorAll("#editor-pan svg text")].map((e) => e.textContent).join(" ")];`);
      assert.deepStrictEqual(shape.slice(0, 2), [2, 1]);
      for (const n of ["D", "E", "A"]) assert.ok(shape[2].includes(n), shape[2]);
      await b.click("#editor-type-standard");
      assert.deepStrictEqual(await stageOf(), standard);
      assert.strictEqual(await stillEmpty(), true);
    });

    test("RCF-16: after a remove the preview in the browser draws each staged note where the commit puts it, and a hit on a drawn note names that note", async () => {
      await fresh(390, 844);
      await openAdd();
      await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => [(x) => editorReplaceDing(x, "D3"), (x) => editorPlace(x, "bottom", "A2"), (x) => editorPlace(x, "bottom", "E3", 135), (x) => editorPlace(x, "bottom", "B2"), (x) => editorPlace(x, "bottom", "C3", 200), (x) => editorRemove(x, "bottom", 0)].reduce((r, f) => (r.ok === false ? r : f(r.value)), { ok: true, value: m })).history;
        editorRender(); return true;`);
      const r = await b.eval(`const m = editorSession.history.present, st = editorStageOf(m);
        const svg = document.querySelector("#editor-pan svg");
        const view = editorGhostSolve(m).value;
        const drawn = [...svg.querySelectorAll('[data-editor-drawn-zone="bottom"] > circle')].map((n) => [+n.getAttribute("cx") / 100, -(+n.getAttribute("cy")) / 100]);
        const hit = drawn.map((pt) => { const ref = editorHitAt(view, pt, null, m); return ref.kind === "note" ? editorNames(m, ref.ring)[ref.i] + "@" + Math.round(((Math.atan2(pt[1], pt[0]) * 180 / Math.PI) + 360) % 360) : ref.kind; });
        const q = editorPlace(m, "rim", "A3"); const sol = editorSolve(q.value).value.fields;
        const commit = Object.values(sol).filter((f) => f[3] === "bottom" && (f[0] + f[1] === "E3" || f[0] + f[1] === "C3")).map((f) => f[0] + f[1] + "@" + Math.round(f[4])).sort();
        return { angles: st.angles.bottom, drawn: drawn.length, hit: hit.sort(), commit, committed: !editorIsEmpty(q.value) };`);
      assert.deepStrictEqual(r.angles, [135, null, 200]);
      assert.strictEqual(r.committed, true);
      assert.strictEqual(r.hit.filter((h) => h.includes("@")).length, 3, "three staged notes are drawn: " + JSON.stringify(r));
      assert.deepStrictEqual(r.hit.filter((h) => /^(E3|C3)@/.test(h)), r.commit, "drawn pinned notes sit at the committed angles, named by their own hit: " + JSON.stringify(r));
      assert.ok(r.hit.some((h) => h.startsWith("B2@")), "the free note is hit as itself: " + JSON.stringify(r));
    });

    for (const [w, h] of [[390, 844], [844, 390]]) {
      test(`RCF-F5 ${w}x${h}: tap order D3, E3@135, B2, C3@200 is accepted, and the preview draws B2, C3 and E3 with hit refs naming each drawn note`, async () => {
        await fresh(w, h);
        await openAdd();
        const r = await b.eval(`const log = []; editorSession.history = editorApply(editorSession.history, (m) => [(x) => editorReplaceDing(x, "D3"), (x) => editorPlace(x, "bottom", "E3", 135), (x) => editorPlace(x, "bottom", "B2"), (x) => editorPlace(x, "bottom", "C3", 200)].reduce((r, f) => { if (r.ok === false) return r; const q = f(r.value); log.push(q.ok === false ? q.code : "ok"); return q; }, { ok: true, value: m })).history;
          editorRender();
          const m = editorSession.history.present, st = editorStageOf(m);
          const svg = document.querySelector("#editor-pan svg");
          const view = editorGhostSolve(m).value;
          const drawn = [...svg.querySelectorAll('[data-editor-drawn-zone="bottom"] > circle')].map((n) => [+n.getAttribute("cx") / 100, -(+n.getAttribute("cy")) / 100]);
          const hit = drawn.map((pt) => { const ref = editorHitAt(view, pt, null, m); return ref.kind === "note" ? editorNames(m, ref.ring)[ref.i] + "@" + Math.round(((Math.atan2(pt[1], pt[0]) * 180 / Math.PI) + 360) % 360) : ref.kind; });
          const q = editorPlace(m, "rim", "A3"); const sol = editorSolve(q.value).value.fields;
          const commit = Object.values(sol).filter((f) => f[3] === "bottom" && (f[0] + f[1] === "E3" || f[0] + f[1] === "C3")).map((f) => f[0] + f[1] + "@" + Math.round(f[4])).sort();
          return { log, angles: st.angles.bottom, bottom: st.bottom, hit: hit.sort(), commit, committed: !editorIsEmpty(q.value) };`);
        assert.deepStrictEqual(r.log, ["ok", "ok", "ok", "ok"], "every tap accepted: " + JSON.stringify(r));
        assert.deepStrictEqual(r.angles, [135, null, 200]);
        assert.strictEqual(r.committed, true, "the fifth commits");
        for (const n of ["B2@", "C3@", "E3@"]) assert.ok(r.hit.some((x) => x.startsWith(n)), n + " is drawn and hit as itself: " + JSON.stringify(r));
        assert.deepStrictEqual(r.hit.filter((x) => /^(E3|C3)@/.test(x)), r.commit, "drawn pinned notes sit at the committed angles: " + JSON.stringify(r));
      });
    }

    test("Standard Add keeps resting outlines visible beneath placed notes", async () => {
      await fresh(390, 844);
      await openAdd();
      await b.eval(`editorSession.history = editorApply(editorSession.history, m =>
        [x => editorReplaceDing(x, "C3"), x => editorPlace(x, "rim", "D3"),
          x => editorPlace(x, "rim", "G#3"), x => editorPlace(x, "rim", "B3"),
          x => editorPlace(x, "inner", "F4"), x => editorPlace(x, "bottom", "A2")]
          .reduce((result, place) => result.ok ? place(result.value) : result, { ok: true, value: m })).history;
        editorRender(); return true;`);
      await b.click("#drawerexp-handle");
      await b.waitFor('drawerExperiment.state === "SHUT"', { label: "the drawer to clear the lower pan" });
      const scene = await b.eval(`const svg = document.querySelector("#editor-pan svg");
        const guides = [...svg.querySelectorAll(".guided-informational, .balanced-outline.bottom")];
        const notes = [...svg.querySelectorAll('circle.ehit')];
        const painted = [...svg.querySelectorAll('[data-editor-drawn-zone] > circle')];
        const model = editorSession.history.present;
        const solved = editorSolve(model).value;
        return {
          rings: [...new Set(guides.map(guide => guide.dataset.guidedZone || "bottom"))].sort(),
          guidesBehind: guides.every(guide => painted.every(note =>
            !!(guide.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING))
            && getComputedStyle(guide).pointerEvents === "none"),
          notes: notes.length,
          missed: notes.flatMap(note => {
            const r = note.getBoundingClientRect();
            const clientX = r.x + r.width / 2, clientY = r.y + r.height / 2;
            const hit = editorHitAt(solved, editorPanPoint({ clientX, clientY }), null, model);
            const correct = note.dataset.ring === "ding" ? hit.kind === "ding" :
              hit.ring === note.dataset.ring && hit.i === Number(note.dataset.i);
            return svg.contains(document.elementFromPoint(clientX, clientY)) && correct ? [] : [note.dataset.ring];
          })
        };`);
      assert.deepStrictEqual(scene, {
        rings: ["bottom", "inner", "rim"], guidesBehind: true, notes: 6, missed: []
      });
    });

    for (const kind of ["mouse", "touch"]) {
      test(`${kind} tap on the empty Standard pan: the ding first (no leading space), then a fifth on the rim commits the scale`, async () => {
        await fresh();
        await openAdd();
        const o = await octave();
        await b.click('.tray-note[data-name="D"]');
        await tapPoint(await dingAt(), kind === "touch");
        assert.match(await statusText(), new RegExp(`^D${o} is the ding\\.`));
        assert.strictEqual((await stageOf()).ding, "D" + o);
        assert.strictEqual(await saveDisabled(), true);
        await b.click('.tray-note[data-name="A"]');
        await tapPoint(await spotAt("rim", 45), kind === "touch");
        assert.strictEqual(await text(), `(D${o}) A${o}`, await statusText());
        assert.strictEqual(await saveDisabled(), false);
        assert.strictEqual(await b.eval(`return "stage" in editorSession.history.present;`), false);
      });

      test(`${kind} drag on the empty Standard pan: rim, inner and bottom notes stage before the ding, the ding drop commits`, async () => {
        await fresh();
        await openAdd();
        const o = await octave();
        await gesture(await chipAt("A"), await spotAt("rim", 45), kind);
        assert.deepStrictEqual((await stageOf()).rim, ["A" + o], await statusText());
        assert.match(await statusText(), /ding/i);
        await gesture(await chipAt("E"), await spotAt("inner", 90), kind);
        assert.deepStrictEqual((await stageOf()).inner, ["E" + o]);
        await gesture(await chipAt("G"), await spotAt("bottom", 200), kind);
        assert.deepStrictEqual((await stageOf()).bottom, ["G" + o]);
        await gesture(await chipAt("D"), await dingAt(), kind);
        assert.strictEqual(await stillEmpty(), false, await statusText());
        assert.deepStrictEqual(await b.eval(`const m = editorSession.history.present; return [editorNames(m, "rim"), editorNames(m, "inner"), editorNames(m, "bottom"), editorDingOf(m)];`),
          [["A" + o], ["E" + o], ["G" + o], "D" + o]);
      });

      test(`${kind} tap and drag on the empty Neotone pan: the ding, then a main note stays on field 5 and an unpaired mutant lands on slot 10`, async () => {
        await fresh();
        await openAdd();
        await b.click("#editor-type-neotone");
        const o = await octave();
        await b.click('.tray-note[data-name="D"]');
        await tapPoint(await dingAt(), kind === "touch");
        assert.match(await statusText(), new RegExp(`^D${o} is the ding\\.`));
        await gesture(await chipAt("A"), await slotAt(4), kind);
        assert.strictEqual(await stillEmpty(), false, await statusText());
        assert.deepStrictEqual(await b.eval(`return editorSession.history.present.options.profile.map.slice(0, 9).map((k) => k !== null);`),
          [false, false, false, false, true, false, false, false, false]);
        await b.click('.tray-note[data-name="E"]');
        const slot9 = await slotAt(9);
        await b.eval(`window.__ev = []; const ab = { pointerdown: "pd", pointerup: "pu", pointercancel: "pc", touchstart: "ts", touchend: "te", mousedown: "md", click: "ck" };
          for (const type of Object.keys(ab)) window.addEventListener(type, (e) => window.__ev.push({ n: ab[type] + (e.defaultPrevented ? "!" : ""), t: Math.round(performance.now()) }), true); return true;`);
        await b.waitFor(`document.getAnimations().length === 0 && !document.getElementById("editor").classList.contains("dragging") && !document.getElementById("editor").classList.contains("settling")`, { label: "the pan to be idle before the slot 10 tap" });
        await b.eval(`return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));`);
        const clicked = () => b.eval(`return window.__ev.some((x) => x.n.startsWith("ck"));`);
        await tapPoint(slot9, kind === "touch");
        let retry = 0;
        if (kind === "touch") {
          await b.waitFor(`window.__ev.some((x) => x.n.startsWith("ck"))`, { timeout: 600, label: "the slot 10 click" }).catch(() => {});
          if (!(await clicked())) {
            retry = 1;
            console.log("slot10 retry=1: the touch tap produced no click, tapping once more");
            await tapPoint(slot9, true);
          }
        }
        await b.waitFor(`editorSession.history.present.options.profile.map[9] !== null`, { timeout: 2000, label: "slot 10 to take the mutant" }).catch(async (err) => {
          const s = await b.eval(`const ev = window.__ev, pu = ev.find((x) => x.n.startsWith("pu")), ck = ev.find((x) => x.n.startsWith("ck"));
            return "slot10 ev=" + ev.map((x) => x.n).join(",") + " ck=" + (ck ? (pu ? ck.t - pu.t : "?") + "ms" : "none") + " dn=" + (pu && ev[0] ? pu.t - ev[0].t : "?") + "ms" + " retry=${retry} v=" + navigator.userAgent.replace(/^.*Chrome\\/(\\d+).*$/, "$1") + " held=" + +!!editorSession.held + " st=" + document.getElementById("editor-status").textContent.slice(0, 12);`).catch(() => "slot10 diag-err");
          throw new Error(s);
        });
        assert.strictEqual(await b.eval(`return editorSession.history.present.options.profile.map[9] !== null;`), true, await statusText());
      });
    }

    test("an empty Neotone pan built by drag (the ding, a main note, a mutant), saved, reloaded and reopened keeps the notes and the record", async () => {
      await fresh();
      await openAdd();
      await b.click("#editor-type-neotone");
      const o = await octave();
      await gesture(await chipAt("D"), await dingAt(), "mouse");
      await gesture(await chipAt("A"), await slotAt(4), "mouse");
      await gesture(await chipAt("E"), await slotAt(9), "mouse");
      const shape = () => b.eval(`const m = editorSession.history.present;
        return { text: document.getElementById("editor-line").value, map: m.options.profile.map.map((k) => k !== null), ding: editorDingOf(m), neotone: document.getElementById("editor-type-neotone").getAttribute("aria-pressed") };`);
      const built = await shape();
      assert.deepStrictEqual([built.map.flatMap((occupied, slot) => occupied ? [slot] : []), built.ding, built.neotone],
        [[4, 9], "D" + o, "true"], JSON.stringify(built));
      assert.strictEqual(await saveDisabled(), false);
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the save to close" });
      assert.strictEqual(await b.eval(`return savedState.entries.length;`), 1, "one record saved");
      await b.send("Page.navigate", { url: base });
      await b.waitFor(`${APP_READY_EXPR} && booted === true && document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`, { timeout: 15000, label: "the app to boot" });
      await b.eval(`const view = allDeckViews().find((v) => savedEqual(v.selection, selection)); openEditSheet(view.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor on the saved scale" });
      assert.deepStrictEqual(await shape(), built, "the saved scale reopens as the same Neotone arrangement");
    });

    test("Neotone: a main note before the ding stages, an unpaired mutant also stages, and the ding drop commits", async () => {
      await fresh();
      await openAdd();
      await b.click("#editor-type-neotone");
      const o = await octave();
      await gesture(await chipAt("E"), await slotAt(9), "mouse");
      assert.deepStrictEqual((await stageOf()).mutant, ["E" + o], await statusText());
      await gesture(await chipAt("A"), await slotAt(2), "mouse");
      assert.deepStrictEqual((await stageOf()).main, [null, null, "A" + o]);
      assert.match(await statusText(), /ding/i);
      await gesture(await chipAt("D"), await dingAt(), "mouse");
      assert.strictEqual(await stillEmpty(), false, await statusText());
    });

    test("390x844: committing the scale moves the pan by at most 1px (A4 measurement)", async () => {
      await fresh(390, 844);
      await openAdd();
      const probe = () => b.eval(`const svg = document.querySelector("#editor-pan svg"); const r = svg.getBoundingClientRect(); const m = svg.getScreenCTM();
        const g = editorSolve(editorSession.history.present).value.geom; const ding = new DOMPoint(0, g.ding_dy * 100).matrixTransform(m);
        return { left: r.left, top: r.top, w: r.width, h: r.height, dx: ding.x, dy: ding.y };`);
      await gesture(await chipAt("E"), await spotAt("inner", 90), "mouse");
      await gesture(await chipAt("G"), await spotAt("bottom", 200), "mouse");
      await gesture(await chipAt("A"), await spotAt("rim", 45), "mouse");
      const before = await probe();
      await gesture(await chipAt("D"), await dingAt(), "mouse");
      assert.strictEqual(await stillEmpty(), false, await statusText());
      const after = await probe();
      const shift = Math.max(...Object.keys(before).map((k) => Math.abs(after[k] - before[k])));
      console.log("A4 commit shift at 390x844 (px):", shift.toFixed(2), JSON.stringify({ before, after }));
      assert.ok(shift <= 1, "the pan moved " + shift + "px on commit: " + JSON.stringify({ before, after }));
    });

    test("a ding placed on the empty pan says it is the ding, never ' removed.'; replacing it later keeps the replace wording", async () => {
      await fresh();
      await openAdd();
      await b.click('.tray-note[data-name="D"]');
      await tapPoint(await dingAt());
      const first = await statusText();
      assert.doesNotMatch(first, /removed/);
      assert.strictEqual(first.startsWith(" "), false);
      await b.click('.tray-note[data-name="C"]');
      await tapPoint(await dingAt());
      assert.match(await statusText(), /^D\d removed\. C\d is the ding\./);
    });

    test("Back protects staged notes and committed edits without writing on Discard", async () => {
      await fresh();
      await openAdd();
      await gesture(await chipAt("A"), await spotAt("rim", 45), "mouse");
      assert.match(await text(), /A[34]/, "the staged rim note is visible in the scale line");
      const stagedLine = await text();
      const stagedModel = await model();
      await b.click("#editor-line");
      await b.key("Enter", "Enter", 13);
      assert.strictEqual(await text(), stagedLine);
      assert.deepStrictEqual(await model(), stagedModel);
      await b.click("#editor-back");
      assert.strictEqual(await dialogOpen(), true);
      await b.click("#editor-dlg-keep");
      assert.strictEqual(await text(), stagedLine);
      await b.click("#editor-back");
      await b.click("#editor-dlg-discard");
      assert.strictEqual(await savedCount(), 0);
      assert.strictEqual(await sheetHidden(), true);
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-back");
      assert.strictEqual(await dialogOpen(), true);
    });

    test("a saved scale that fails to decode opens on the empty pan with its error and keeps the dirty guard: Back asks with nothing staged", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the save to close" });
      await b.eval(`const view = allDeckViews().find((v) => savedEqual(v.selection, selection));
        openEditSheet({ ...view.deck, options: { ...view.deck.options, profile: { id: "bogus", rev: 2, map: [] } } }, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor on the broken scale" });
      const r = await b.eval(`const s = editorSession; return { error: !!s.error, empty: editorIsEmpty(s.history.present), failed: s.base.failed === true };`);
      assert.deepStrictEqual(r, { error: true, empty: true, failed: true });
      await b.click("#editor-back");
      assert.strictEqual(await dialogOpen(), true, "Back on a failed-decode session prompts");
    });

    test("keyboard: the empty pan is one roving tab stop over the ding and each zone, each with a localised name", async () => {
      await fresh();
      await openAdd();
      const keys = () => b.eval(`return [...document.querySelectorAll("#editor-pan [data-fk]")].map((e) => [e.dataset.fk, e.getAttribute("aria-label"), e.getAttribute("tabindex")]);`);
      const en = await keys();
      assert.deepStrictEqual(en.map((k) => k[0]), ["ding:0", "zone:rim", "zone:inner", "zone:bottom"]);
      assert.strictEqual(en.filter((k) => k[2] === "0").length, 1);
      assert.ok(en.every((k) => k[1] && k[1].length > 3), JSON.stringify(en));
      await b.eval(`const e = document.getElementById("lang-select"); e.value = "de"; e.dispatchEvent(new Event("change", { bubbles: true })); return true;`);
      await b.waitFor(`document.documentElement.lang === "de"`, { label: "German" });
      await b.eval(`editorRender(); return true;`);
      const de = await keys();
      assert.deepStrictEqual(de.map((k) => k[0]), en.map((k) => k[0]));
      assert.ok(de[0][1] !== en[0][1] && de[1][1] !== en[1][1], "the ding and rim stops are renamed in German: " + JSON.stringify(de));
    });

    test("I18N: under a pseudo table no visible editor text is English, panel and unsaved-changes dialog", async () => {
      await fresh();
      await b.eval(`const wrap = (v) => typeof v === "string" ? "\\u27e6" + v + "\\u27e7" : Object.fromEntries(Object.entries(v).map(([k, s]) => [k, "\\u27e6" + s + "\\u27e7"]));
        I18N.de = Object.fromEntries(Object.entries(I18N.en).map(([k, v]) => [k, wrap(v)]));
        const e = document.getElementById("lang-select"); e.value = "de"; e.dispatchEvent(new Event("change", { bubbles: true })); return true;`);
      await b.waitFor(`document.documentElement.lang === "de"`, { label: "pseudo German" });
      await openAdd();
      const scan = (label) => b.eval(`const out = [];
        const words = (s) => { let v = String(s), p; do { p = v; v = v.replace(/\\u27e6[^\\u27e6\\u27e7]*\\u27e7/g, ""); } while (v !== p); return /[A-Za-z]{3,}/.test(v); };
        const root = document.getElementById("editor");
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) { if (n.parentElement.closest("textarea, script, style")) continue; if (words(n.nodeValue)) out.push("text:" + n.nodeValue); }
        for (const el of root.querySelectorAll("*")) for (const a of ["aria-label", "title", "placeholder"]) { if (el.id === "editor-name" && a === "placeholder") continue; const v = el.getAttribute(a); if (v && words(v)) out.push(el.id + "@" + a + ":" + v); }
        return out;`).then((left) => assert.deepStrictEqual(left, [], label + ": " + JSON.stringify(left.slice(0, 8))));
      await scan("empty");
      await typeLine(SCALE);
      await scan("typed");
      await b.eval(`editorSession.held = { name: "C4" }; editorRender(); return true;`);
      await scan("a note held");
      await b.click("#editor-type-neotone");
      await scan("neotone");
      await b.eval(`editorShowDialog(true); return true;`);
      await scan("unsaved-changes dialog");
    });

    test("the empty prompt fits the status row in all eight locales at 390, 375 and 360 with the real fonts", async () => {
      const prev = b;
      b = await launch({ foregroundSettle: true, realFonts: true });
      try {
        for (const width of [390, 375, 360]) {
          await fresh(width, 844);
          await openAdd();
          await b.eval(`return document.fonts.ready.then(() => true);`);
          const langs = await b.eval(`return [...document.getElementById("lang-select").options].map((o) => o.value).filter((v) => v !== "auto");`);
          assert.strictEqual(langs.length, 8);
          for (const lang of langs) {
            await b.eval(`const e = document.getElementById("lang-select"); e.value = ${JSON.stringify(lang)}; e.dispatchEvent(new Event("change", { bubbles: true })); return true;`);
            await b.waitFor(`document.documentElement.lang === ${JSON.stringify(lang)}`, { label: "locale applied" });
            for (const kind of ["standard", "neotone"]) {
              await b.click("#editor-type-" + kind);
              const bad = await b.eval(`const out = []; const st = document.getElementById("editor-status"); const ed = document.getElementById("editor");
                const q = st.getBoundingClientRect(); if (st.scrollWidth > st.clientWidth + 0.5 || q.right > innerWidth || q.bottom > innerHeight) out.push("status");
                if (ed.scrollWidth > ed.clientWidth || ed.scrollHeight > ed.clientHeight) out.push("panel scroll");
                return out;`);
              assert.deepStrictEqual(bad, [], width + " " + lang + " " + kind);
            }
          }
        }
      } finally {
        await b.close();
        b = prev;
      }
    });
  });

  describe("D12 / SE-2 / SE-15 the text line", () => {
    test("read-only until tapped; Enter on the focused line also starts editing", async () => {
      await fresh();
      await openBuiltin();
      assert.deepStrictEqual(await b.eval(`return ["editor-line", "editor-name"].map((id) => document.getElementById(id)?.getAttribute("spellcheck"));`), ["false", "false"],
        "the note line and the name field switch spellcheck off, so note names are not red-underlined");
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
    test("switching the pan type returns the panel to the Scale tab", async () => {
      await fresh();
      await openAdd();
      await typeLine("[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4");
      await b.eval(`editorSetTab("layout"); return true;`);
      await b.click("#editor-type-neotone");
      assert.strictEqual(await b.eval(`return editorSession.tab;`), "scale");
      await b.eval(`editorSetTab("layout"); return true;`);
      await b.click("#editor-type-standard");
      assert.strictEqual(await b.eval(`return editorSession.tab;`), "scale");
    });

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

  test("Neotone conversion E4: saved Standard flags do not block a real pan tap, Undo or Save", async () => {
    const input = "(D3) D#3 A3 C4 D4 D#4 G#4 [E3] [B3] [F4] [F#4]";
    for (const flags of [{ mirror: true }, { mirrorBottom: false }, { mirrorBottom: true }]) {
      const label = JSON.stringify(flags);
      await fresh(380, 667);
      const seeded = await b.eval(`const options = { ...${label}, anchor: "between", palette: 3, name: "NEOTONE E4 QA" };
        const built = buildGenerated(${JSON.stringify(input)}, options);
        if (!built.ok) return { ok: false, code: built.code };
        const record = { v: 4, s: HPE.core.formatSeed(built.value.fields), o: options };
        return commitSaved({ type: "import", collectionId: savedState.collectionId,
          selectedInstanceId: selection.kind === "saved" ? selection.id : null,
          candidate: { record, deck: built.value } }).then((r) => ({ ok: r.ok, id: r.instanceId }));`);
      assert.strictEqual(seeded.ok, true, label + ": valid Standard fixture is saved");
      await b.eval(`const view = allDeckViews().find((v) => v.selection.kind === "saved" && v.selection.id === ${JSON.stringify(seeded.id)});
        if (!view) throw new Error("saved Standard fixture missing"); selectDeck(view.selection, false); openEditSheet(view.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the saved Standard editor" });
      for (const [key, value] of Object.entries(flags)) {
        assert.strictEqual(await b.eval(`return editorSession.history.present.options[${JSON.stringify(key)}];`), value, label + ": opened fixture retains " + key);
      }
      await b.click("#editor-oct-up");
      assert.strictEqual(await b.eval(`return editorView(editorSession.history.present).oct;`), 4);
      const original = await model();
      await b.click("#editor-type-neotone");
      assert.strictEqual(await b.eval(`return document.getElementById("editor-type-neotone").getAttribute("aria-pressed");`), "true");
      const neo = await model();
      await b.click('.tray-note[data-name="E"]');
      const point = await b.eval(`const slot = document.querySelector('#editor-pan .eslot[data-slot="6"]');
        if (!slot) throw new Error("empty main field missing"); const r = slot.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
      await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, id: 1 }] });
      await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      assert.strictEqual(await b.eval(`return editorSession.error;`), "", label + ": a valid pan tap must not produce PROFILE_CONFLICT");
      const added = await model();
      assert.deepStrictEqual(await b.eval(`return editorNames(editorSession.history.present, "rim");`), ["D#3", "A3", "C4", "D4", "D#4", "E4", "G#4"], label);
      assert.deepStrictEqual(await b.eval(`return editorNames(editorSession.history.present, "bottom");`), ["E3", "B3", "F4", "F#4"], label);
      assert.deepStrictEqual(added.options.profile.map.slice(0, 6), neo.options.profile.map.slice(0, 6), "existing main fields keep their notes");
      assert.strictEqual(added.options.profile.map[6], "r64");
      assert.deepStrictEqual(added.options.profile.map.slice(9), neo.options.profile.map.slice(9), "mutant pairing survives placement");
      assert.deepStrictEqual([added.options.anchor, added.options.palette], ["between", 3]);
      await clickUndo();
      assert.deepStrictEqual(await model(), neo, label + ": first Undo removes E4");
      await clickUndo();
      assert.deepStrictEqual(await model(), original, label + ": second Undo restores the original Standard flags");
      await b.click("#editor-redo");
      await b.click("#editor-redo");
      assert.deepStrictEqual(await model(), added, label + ": Redo restores conversion and placement");
      if (await b.eval(`return !document.getElementById("editor-menu").hidden;`)) await b.click("#editor-more");
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the valid Neotone save to close" });
      assert.strictEqual(await b.eval(`return savedState.entries.length;`), 1, "the original saved scale is edited in place");
      const saved = await b.eval(`const row = savedState.entries.find((e) => e.instanceId === ${JSON.stringify(seeded.id)});
        return { valid: readSavedRecord(row.record).ok, map: row.record.o.profile.map, anchor: row.record.o.anchor, palette: row.record.o.palette };`);
      assert.deepStrictEqual(saved, { valid: true, map: added.options.profile.map, anchor: "between", palette: 3 }, label);
      await b.send("Page.navigate", { url: base });
      await b.waitFor(`${APP_READY_EXPR} && booted === true`, { timeout: 15000, label: "the saved Neotone scale after reload" });
      await b.eval(`const view = allDeckViews().find((v) => v.selection.kind === "saved" && v.selection.id === ${JSON.stringify(seeded.id)});
        if (!view) throw new Error("saved Neotone scale missing after reload"); selectDeck(view.selection, false); openEditSheet(view.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the reopened Neotone editor" });
      assert.deepStrictEqual(await b.eval(`const m = editorSession.history.present; return { map: m.options.profile.map,
        rim: editorNames(m, "rim"), bottom: editorNames(m, "bottom"), anchor: m.options.anchor, palette: m.options.palette };`),
      { map: added.options.profile.map, rim: ["D#3", "A3", "C4", "D4", "D#4", "E4", "G#4"], bottom: ["E3", "B3", "F4", "F#4"], anchor: "between", palette: 3 }, label);
    }
  });

  describe("D10 the Back prompt", () => {
    test("EDITOR-EXIT-CLEAN: a clean panel closes with no prompt", async () => {
      await fresh();
      await openBuiltin();
      await b.click("#editor-back");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the sheet to close" });
      assert.strictEqual(await dialogOpen(), false);
    });

    test("EDITOR-EXIT-KEEP: Keep editing returns to the panel with the edit intact", async () => {
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

    test("EDITOR-EXIT-INVALID: Back lets an invalid draft exit without saving", async () => {
      await fresh(380, 667);
      const before = await savedCount();
      await b.click("#strip-add");
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "Add opens the editor" });
      await typeLine(SCALE);
      await typeLine("invalid notation", { commit: false });
      await b.click("#editor-back");
      assert.strictEqual(await dialogOpen(), true);
      assert.strictEqual(await b.eval(`
        const discard = document.getElementById("editor-dlg-discard");
        const rect = discard.getBoundingClientRect();
        return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === discard;
      `), true, "Discard is hittable");
      await b.click("#editor-dlg-keep");
      assert.strictEqual(await text(), "invalid notation");
      await b.click("#editor-back");
      await b.click("#editor-dlg-discard");
      assert.strictEqual(await sheetHidden(), true);
      assert.strictEqual(await savedCount(), before);
    });

    test("Save commits pending notation without writing an earlier draft", async () => {
      await fresh(380, 667);
      const before = await savedCount();
      await openAdd();
      await typeLine(SCALE);
      await typeLine("invalid notation", { commit: false });
      await b.click("#editor-save");
      assert.strictEqual(await sheetHidden(), false);
      assert.strictEqual(await text(), "invalid notation");
      assert.strictEqual(await savedCount(), before);

      await typeLine("(E3) B3 C4 D4 E4 F4 G4 B4", { commit: false });
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hidden`, { label: "valid pending notation saves" });
      assert.strictEqual(await savedCount(), before + 1);
      await b.click('#decks .chip[data-selection-kind="saved"][aria-current="true"]');
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the saved scale opens in Edit" });
      assert.match(await text(), /\(E3\)/);
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

    test("EDITOR-EXIT-SAVE: Save saves the scale and closes", async () => {
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
    test("pill Save focuses the live selected saved-scale chip in the active editor", async () => {
      await fresh(380, 667);
      await b.click("#strip-add");
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "active editor opened by the pill" });
      await typeLine(SCALE);
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "pill Save closed the active editor" });
      assert.strictEqual(await b.eval(`const chip = document.querySelector("#decks .chip.on");
        return selection.kind === "saved" && chip?.getAttribute("data-selection-id") === selection.id
          && document.activeElement === chip && chip.getBoundingClientRect().width > 0;`), true,
        "Save focuses the live selected saved-scale chip, not the pill or a detached opener");
    });

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

  describe("D15 Save while a name is typed", () => {
    test("a name typed while Save is pending keeps the editor open and the typed text", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the first save to close" });
      await b.eval(`const view = allDeckViews().find((v) => savedEqual(v.selection, selection)); openEditSheet(view.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor on the saved scale" });
      await b.eval(`const n = document.getElementById("editor-name"); n.focus(); n.value = "PENDING VALID";
        n.dispatchEvent(new Event("input", { bubbles: true })); n.blur(); return true;`);
      await b.eval(`navigator.locks.request("handpan-cards:saved-scales:v1", () => new Promise((r) => { window.__rel = r; })); return true;`);
      await b.waitFor(`typeof window.__rel === "function"`, { label: "the saved-scales lock held" });
      await b.eval(`document.getElementById("editor-save").click(); return true;`);
      await b.waitFor(`!!savePending`, { label: "Save to wait on the lock" });
      await b.eval(`const n = document.getElementById("editor-name"); n.dispatchEvent(new Event("focus")); n.value = "TYPED DURING SAVE";
        n.dispatchEvent(new Event("input", { bubbles: true })); return true;`);
      await b.eval(`window.__rel(); return true;`);
      await b.waitFor(`!savePending`, { label: "the pending Save to finish" });
      assert.strictEqual(await sheetHidden(), false, "the editor stays open");
      assert.strictEqual(await b.eval(`return document.getElementById("editor-name").value;`), "TYPED DURING SAVE");
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
    async function setupLegacy(line) {
      await fresh();
      await openAdd();
      await b.eval(`
        const fixture = editorLoad(${JSON.stringify(line)});
        if (!fixture.ok) throw Error(fixture.reason);
        const view = editorSession.history.present.view;
        const model = { ...fixture.value, view };
        editorSession.history = editorHistoryNew(model);
        editorSession.base = model;
        editorRender();
        return true;
      `);
    }

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

    test("holding a note exposes Cancel; reopening the drawer, Cancel and Escape each clear the preview (SE-7)", async () => {
      await setup(SCALE);
      const before = await model();
      for (const dismiss of ["drawer", "cancel", "escape"]) {
        if (!await b.eval("return drawerExperiment.expanded;")) await b.click("#drawerexp-handle");
        await b.waitFor('drawerExperiment.state === "OPEN"', { label: "the tray to reopen" });
        await hold("B");
        await b.waitFor('drawerExperiment.state === "SHUT"', { label: "the held note to reveal the pan" });
        assert.equal(await b.eval("return editorHeldName();"), "B4");
        assert.equal(await b.eval('return editorEl("editor-cancel")?.textContent.trim();'), "Cancel");
        if (dismiss === "drawer") await b.click("#drawerexp-handle");
        else if (dismiss === "cancel") await b.click("#editor-cancel");
        else await b.key("Escape", "Escape", 27);
        assert.equal(await b.eval("return editorSession.held;"), null);
        assert.deepEqual(await model(), before);
        assert.equal(await sheetHidden(), false);
      }
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
      assert.deepStrictEqual(m.options.angles.bottom.filter((a) => a !== null), [150, 90]);
    });

    const BN_ROWS = `const s = editorSolve(editorSession.history.present).value; return ringIds(s.fields, "bottom").map((id) => ({ n: s.fields[id][0] + s.fields[id][1], a: s.fields[id][4], l: s.fields[id][5] }));`;
    const bnRows = async () => Object.fromEntries((await b.eval(BN_ROWS)).map((r) => [r.n, r]));

    test("BN-E1 (QA video 1): a note added next to E3 on the side nearer bottom centre reads U1; E3 stays at its angle and reads U2", async () => {
      await setup("[E3] " + SCALE);
      const before = await bnRows();
      assert.strictEqual(before.E3.l, "U1");
      await b.click("#editor-oct-down");
      await hold("D#");
      await b.waitFor('drawerExperiment.state === "SHUT"', { label: "the armed note to clear the pan" });
      await tapSpot(...polar(1.15, 140));
      const after = await bnRows();
      assert.strictEqual(after.E3.a, before.E3.a, "E3 did not move");
      assert.strictEqual(after["D#3"].a, 140);
      assert.strictEqual(after["D#3"].l, "U1", "the note nearest bottom centre reads U1");
      assert.strictEqual(after.E3.l, "U2");
    });

    test("BN-E2 (QA video 2): a note moved across its neighbours takes its number from where it lands; nothing swaps back", async () => {
      await setup("[A2] [B2] [C3] " + SCALE);
      const before = await bnRows();
      assert.deepStrictEqual([before.A2.a, before.B2.a, before.C3.a], [330, 210, 90]);
      await b.click("#drawerexp-handle");
      await b.waitFor('drawerExperiment.state === "SHUT"', { label: "the drawer to clear the pan" });
      await tapNote("bottom", 2);
      await tapSpot(...polar(1.15, 240));
      const after = await bnRows();
      assert.strictEqual(after.C3.a, 240);
      assert.deepStrictEqual([after.C3.l, after.A2.l, after.B2.l], ["U1", "U2", "U3"], "distance from 270: C3 30, then A2 and B2 at 60 (right first)");
      assert.deepStrictEqual([after.A2.a, after.B2.a], [330, 210], "the others stay");
    });

    test("BN-E3: removing a bottom note leaves the others where they are drawn on the screen", async () => {
      await setup("[A2] [B2] [C3] " + SCALE);
      const before = await bnRows();
      await b.click("#drawerexp-handle");
      await b.waitFor('drawerExperiment.state === "SHUT"', { label: "the drawer to clear the pan" });
      await tapNote("bottom", 1);
      await b.click("#editor-more");
      await b.click("#editor-remove");
      assert.deepStrictEqual(await b.eval(`return editorNames(editorSession.history.present, "bottom");`), ["A2", "C3"]);
      const after = await bnRows();
      assert.deepStrictEqual([after.A2.a, after.C3.a], [before.A2.a, before.C3.a], "A2 and C3 keep their drawn angles");
    });

    test("BN-E4: a scale with MIRROR BOTTOM stored (record and share link) keeps its numbers on positions, and a bottom add keeps its stored angles", async () => {
      for (const via of ["record", "link"]) {
        await setup("[A2] [B2] [C3] " + SCALE);
        const shape = await b.eval(`const base = editorLoad("[A2] [B2] [C3] " + ${JSON.stringify(SCALE)}, { mirrorBottom: true }).value;
          const e = editorExport(base);
          const loaded = ${JSON.stringify(via)} === "record" ? editorLoadRecord({ v: e.record.v, s: e.record.s, o: e.record.o }) : editorLoadShare(e.code);
          if (!loaded.ok) return { code: loaded.code };
          editorSession.history = editorHistoryNew(loaded.value); editorRender(); return { mirror: loaded.value.options.mirrorBottom };`);
        assert.strictEqual(shape.mirror, true, via);
        const before = await bnRows();
        const rank = Object.values(before).sort((x, y) => Math.abs(((x.a - 270 + 540) % 360) - 180) - Math.abs(((y.a - 270 + 540) % 360) - 180) || (((x.a - 270 + 360) % 360) < 180 ? -1 : 1));
        assert.deepStrictEqual(rank.map((r) => r.l), ["U1", "U2", "U3"], via + ": numbers follow the drawn positions");
        await hold("E");
        await b.click("#editor-oct-down");
        await place("bottom");
        const after = await bnRows();
        for (const n of ["A2", "B2", "C3"]) assert.strictEqual(after[n].a, before[n].a, `${via} ${n} stays`);
        assert.strictEqual((await model()).options.mirrorBottom, true);
      }
    });

    test("BN-E5: a held note placed on the bottom area (no position) goes to the middle of the widest stretch, nearest bottom centre", async () => {
      await setup("[A2] " + SCALE);
      await hold("G");
      await b.click("#editor-oct-down");
      await place("bottom");
      assert.deepStrictEqual((await model()).options.angles.bottom, [90, 270]);
      await setup("[A2] [B2] " + SCALE);
      await hold("G");
      await b.click("#editor-oct-down");
      await place("bottom");
      assert.deepStrictEqual((await model()).options.angles.bottom, [0, 180, 270]);
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

    const exposePanRim = async () => {
      await b.click("#drawerexp-handle");
      await b.waitFor(`drawerExperiment.state === "SHUT"`, { label: "the drawer to uncover the rim" });
    };
    const tapExposedRim = async (index) => {
      const point = await noteAt("rim", index);
      assert.strictEqual(await b.eval(`return !!document.elementFromPoint(${point.x}, ${point.y})?.closest("#editor-pan");`),
        true, `rim note ${index + 1} is reachable`);
      await tapPoint(point);
    };
    const chooseFirstRim = async () => {
      await tapExposedRim(0);
      assert.deepStrictEqual(await b.eval(`return editorSession.sel;`), { ring: "rim", i: 0 });
    };

    test("tap-tap swap of two rim notes shows the result and pinned Undo restores the whole step (D4)", async () => {
      await setupLegacy(SCALE);
      await exposePanRim();
      const before = await model();
      await chooseFirstRim();
      assert.strictEqual(await b.eval(`return !document.getElementById("editor-remove").disabled;`), true, "a selected note enables Remove");
      await tapExposedRim(1);
      assert.match(await status(), /^A3 and Bb3 traded places\./);
      assert.deepStrictEqual((await model()).options.seats, { rim: [1, 0, 2, 3, 4, 5, 6, 7] });
      assert.strictEqual(await b.eval(`return editorSession.history.past.length;`), 1);
      await b.click("#editor-undo");
      assert.deepStrictEqual(await model(), before);
    });

    test("after a rim swap, Tab reaches pinned Undo without stalling", async () => {
      await setupLegacy(SCALE);
      await exposePanRim();
      await chooseFirstRim();
      await tapExposedRim(1);
      const activeUndo = await b.eval(`const undo = document.getElementById("editor-undo");
        const r = undo.getBoundingClientRect();
        return !undo.disabled && undo.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));`);
      assert.strictEqual(activeUndo, true, "pinned Undo remains hittable with the swap banner showing");
      const seen = [];
      for (let i = 0; i < 40; i++) {
        await b.key("Tab", "Tab", 9);
        seen.push(await b.eval(`const a = document.activeElement; return a.id || a.outerHTML.slice(0, 80);`));
      }
      assert.ok(seen.includes("editor-undo"), "pinned Undo is a Tab stop: " + JSON.stringify(seen));
      assert.ok(seen.every((x, i) => i === 0 || x !== seen[i - 1]), "focus moves on every Tab: " + JSON.stringify(seen));
    });

    test("MT first Tab from the control before pinned Undo focuses it without stalling", async () => {
      await setupLegacy(SCALE);
      await exposePanRim();
      await chooseFirstRim();
      await tapExposedRim(1);
      const prev = await b.eval(`const stops = editorTabStops();
        const index = stops.indexOf(document.getElementById("editor-undo"));
        const before = index > 0 ? stops[index - 1] : null;
        if (!before) return null;
        before.focus();
        return document.activeElement === before ? before.id || before.outerHTML.slice(0, 80) : null;`);
      assert.ok(prev, "focus the stop immediately before pinned Undo");
      await b.key("Tab", "Tab", 9);
      assert.strictEqual(await b.eval(`return document.activeElement.id;`), "editor-undo", "first Tab from " + prev);
    });

    test("Remove deletes the selected note and Undo restores it; tapping the selection again deselects it", async () => {
      await setupLegacy(SCALE);
      await exposePanRim();
      const before = await model();
      await tapExposedRim(3);
      assert.deepStrictEqual(await b.eval(`return editorSession.sel;`), { ring: "rim", i: 3 });
      await tapExposedRim(3);
      assert.strictEqual(await b.eval(`return editorSession.sel;`), null);
      await b.click("#editor-more");
      assert.strictEqual(await b.eval(`return document.getElementById("editor-remove").disabled;`), true);
      await b.key("Escape", "Escape", 27);
      await tapExposedRim(3);
      await b.click("#editor-more");
      assert.strictEqual(await b.eval(`return document.getElementById("editor-remove").disabled;`), false);
      await b.click("#editor-remove");
      assert.ok(!(await rimNames()).includes("D4"));
      assert.match(await status(), /^D4 removed\./);
      assert.strictEqual(await b.eval(`return editorSession.history.past.length;`), 1);
      await b.click("#editor-undo");
      assert.deepStrictEqual(await model(), before);
    });

    test("a held note tapped on a placed note replaces it in its seat; Undo restores", async () => {
      await setup(SCALE);
      const before = await b.eval(`return editorSolve(editorSession.history.present).value.fields[3][4];`);
      await hold("B");
      await b.waitFor('drawerExperiment.state === "SHUT"', { label: "the held note to reveal the pan" });
      await tapNote("rim", 2);
      assert.deepStrictEqual(await rimNames(), ["A3", "Bb3", "D4", "E4", "F4", "G4", "A4", "B4"]);
      assert.strictEqual(await b.eval(`const f = editorSolve(editorSession.history.present).value.fields; return Object.values(f).find((x) => x[0] === "B" && x[1] === 4)[4];`), before);
      assert.match(await status(), /C4 replaced by B4/);
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

    test("D23 copy: the initial drag hint is clear and a rim or Cyclops note can swap with the Ding", async () => {
      await setup("[A2] " + SCALE);
      assert.equal(await b.eval(`return editorEl("editor-hint").textContent.trim();`), "Drag a note onto the handpan.");
      await b.click("#drawerexp-handle");
      await b.waitFor('drawerExperiment.state === "SHUT"', { label: "the drawer to clear the pan" });
      const before = await model();
      for (const ring of ["rim", "inner"]) {
        const picked = await b.eval(`return editorNames(editorSession.history.present, ${JSON.stringify(ring)})[0];`);
        await tapNote(ring, 0);
        await tapNote("ding", 0);
        const result = await b.eval(`const m = editorSession.history.present;
          return { ding: editorDingOf(m), ring: editorNames(m, ${JSON.stringify(ring)}) };`);
        assert.equal(result.ding, picked);
        assert.ok(result.ring.includes("D3"));
        await b.click("#editor-undo");
        assert.deepEqual(await model(), before);
      }
    });

    test("D23 with a bottom copy of a rim note: a held tray note still replaces a rim note and the ding", async () => {
      await setupLegacy("[C4] " + SCALE);
      await hold("B");
      await b.waitFor('editorSession.held && drawerExperiment.state === "SHUT"',
        { label: "the held note and cleared pan" });
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

    describe("U2d zone counts, caps, crowded refusal, Reset spacing", () => {
      const pill = (ring) => zoneCount(ring);
      const reset = () => b.eval(`const r = document.getElementById("editor-reset"); const vis = (c) => getComputedStyle(r.querySelector(c)).display !== "none";
        return { aria: r.getAttribute("aria-label"), disabled: r.disabled, visible: [...r.querySelectorAll("span")].filter((x) => getComputedStyle(x).display !== "none").map((x) => x.textContent).join("|") };`);
      const linkOf = () => b.eval(`return editorExport(editorSession.history.present).link.value;`);
      const pastLen = () => b.eval(`return editorSession.history.past.length;`);
      const RIM12 = "A3 Bb3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5";
      const BOT_LINE = (n) => ["A2", "B2", "C3", "E3", "F3", "G3", "Bb2", "Db3", "Eb3", "Gb3", "Ab3", "B3"].slice(0, n).map((x) => "[" + x + "]").join(" ");

      test("D17: the counts read 'Rim n/12', 'Cyclops n/6', 'Bottom n/12', follow the model live, and a held note is added at its auto position", async () => {
        await setup(SCALE);
        assert.strictEqual(await pill("rim"), "Rim 8/12");
        assert.strictEqual(await pill("inner"), "Cyclops 2/6");
        assert.strictEqual(await pill("bottom"), "Bottom 0/12");
        assert.strictEqual(await pill("ding"), "Ding 1/1 Full");
        await hold("B");
        await place("rim");
        assert.deepStrictEqual((await rimNames()).slice(-2), ["A4", "B4"], "pitch-order seat");
        assert.strictEqual(await pill("rim"), "Rim 9/12", "the count follows the model live");
        assert.strictEqual(await b.eval(`return editorSession.held === null;`), true);
        await hold("E");
        await b.click("#editor-oct-down");
        await place("bottom");
        let m = await model();
        assert.strictEqual(Object.values(m.fields).filter((f) => f[3] === "bottom").length, 1);
        assert.deepStrictEqual(m.options.angles, { bottom: [270] }, "the first bottom note of a new scale is stored at 270 (rc-fixes L3-C)");
        await hold("C");
        for (let k = 0; k < 3; k++) await b.click("#editor-oct-up");
        await place("inner");
        assert.strictEqual(await pill("inner"), "Cyclops 3/6", await status());
        await clickUndo();
        assert.strictEqual(await pill("inner"), "Cyclops 2/6");
      });

      test("D16: a full area reads Full in the counts and a tap or drop into it is refused with the exact copy", async () => {
        await setup("(D3) " + RIM12 + " | C6");
        assert.strictEqual(await pill("rim"), "Rim 12/12 Full");
        assert.strictEqual(await b.eval(`return document.querySelector('#editor-counts [data-zone="rim"]').classList.contains("full");`), true);
        const core = () => b.eval(`const m = editorSession.history.present; return { parts: editorPartsOf(m), ding: editorDingOf(m), options: m.options };`);
        const before = await core();
        await hold("F");
        await b.click("#editor-oct-up");
        await place("rim");
        assert.strictEqual(await status(), "The rim is full at 12 notes. Remove one first.");
        assert.deepStrictEqual(await core(), before);
        assert.strictEqual(await b.eval(`return editorSession.held !== null;`), true, "the note is still held");
        await b.eval(`editorPlaceHeld({ kind: "spot", ring: "rim" }, editorSession.history.present); return true;`);
        assert.strictEqual(await status(), "The rim is full at 12 notes. Remove one first.", "a drop into the rim is refused too");
        assert.deepStrictEqual(await core(), before);
        await place("inner");
        assert.strictEqual((await model()).fields && Object.values((await model()).fields).filter((f) => f[3] === "inner").length, 2, "another area still takes it");
      });

      test("D16 e2e: the 6th cyclops note is refused as crowded with a bottom note present; the 12th bottom note is accepted with 4 cyclops", async () => {
        await setup(BOT_LINE(1) + " (D3) " + RIM8 + " | C5 D5 E5 F5 G5");
        await hold("A");
        await b.click("#editor-oct-up");
        await b.click("#editor-oct-up");
        await place("inner");
        assert.strictEqual(await status(), "Too crowded: labels would print at 2.71 pt, under 3.6 pt. Remove a note first.");
        assert.strictEqual(Object.values((await model()).fields).filter((f) => f[3] === "inner").length, 5);
        await setup(BOT_LINE(11) + " (D3) " + RIM8 + " | C5 D5 E5 F5");
        await hold("D");
        await b.click("#editor-oct-down");
        await b.click("#editor-oct-down");
        await place("bottom");
        assert.strictEqual(await b.eval(`return editorNames(editorSession.history.present, "bottom").length;`), 12, await status());
        assert.strictEqual(await status(), "D2 added to the bottom.Undo");
      });

      test("parity 9 save: an over-cap scale saves with the same record and share link; only a further add into that area is refused", async () => {
        const OVER = "(D3) " + RIM12 + " F5";
        await setup(OVER);
        const want = await b.eval(`const s = HPE.core.parseSeed(${JSON.stringify(OVER)}); const seed = { fields: s.value.fields, options: s.value.options }; return { record: scaleRecord(seed), link: shareLink(seed).value };`);
        assert.strictEqual(await linkOf(), want.link);
        await hold("G#");
        await place("rim");
        assert.match(await status(), /^The rim is full at 12 notes\. Remove one first\./);
        await b.click("#editor-cancel");
        assert.strictEqual(await b.eval(`return editorSession.held === null;`), true);
        await b.click("#editor-save");
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the save to close" });
        const got = await b.eval(`const e = savedState.entries[savedState.entries.length - 1]; return e.record;`);
        assert.strictEqual(got.s, want.record.s);
        assert.strictEqual(got.v, want.record.v);
      });

      test("parity 6 / Re-space e2e: pins stay on an add; Reset bottom spacing re-spaces and drops at-, Undo restores; Reset spacing (2) clears both in one step, v8 gone", async () => {
        await setup(BOT_LINE(3) + " (D3) " + RIM8 + " | C5 D5 E5");
        for (const [ring, i, g] of [["bottom", 0, 60], ["bottom", 1, 120], ["inner", 2, 120]]) {
          await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => editorSetAngle(m, ${JSON.stringify(ring)}, ${i}, ${g}, true)).history; editorRender(); return true;`);
        }
        assert.strictEqual((await model()).pins.length, 3);
        await hold("E");
        await b.click("#editor-oct-down");
        await place("bottom");
        assert.strictEqual((await model()).pins.length, 5, "the add freezes the ring: every bottom note pinned");
        assert.strictEqual(await b.eval(`return editorNames(editorSession.history.present, "bottom").length;`), 4);
        assert.match(await linkOf(), /at-/);
        const unpinnedIdx = await b.eval(`return editorNames(editorSession.history.present, "bottom").indexOf("E3");`);
        await tapNote("bottom", unpinnedIdx);
        assert.deepStrictEqual(await reset(), { aria: "Reset bottom spacing", disabled: false, visible: "Reset bottom spacing" });
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
        assert.strictEqual((await reset()).visible, "Reset spacing (2)");
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
        assert.deepStrictEqual(await reset(), { aria: "Reset cyclops spacing", disabled: false, visible: "Reset cyclops spacing" });
        await b.click("#editor-reset");
        assert.doesNotMatch(await linkOf(), /#s=8/);
        assert.strictEqual((await model()).options.angles, undefined);
      });

      test("D18 zone: tapping the empty bottom ring selects the zone and scopes Reset to it; tapping it again clears the zone", async () => {
        await setup("[A2] " + SCALE);
        await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => editorSetAngle(m, "bottom", 0, 60, true)).history; editorRender(); return true;`);
        await tapSpot(...polar(1.15, 150));
        assert.strictEqual(await b.eval(`return editorSession.zone;`), "bottom");
        assert.deepStrictEqual(await reset(), { aria: "Reset bottom spacing", disabled: false, visible: "Reset bottom spacing" });
        await tapSpot(...polar(1.15, 150));
        assert.strictEqual(await b.eval(`return editorSession.zone;`), null);
        await tapSpot(...polar(1.15, 150));
        await b.click("#editor-reset");
        assert.strictEqual((await model()).options.angles, undefined);
      });

      test("an empty cyclops arc and bottom ring show as targets for a held note and take the first note by tap or drop", async () => {
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
        await place("bottom");
        assert.strictEqual(await pill("bottom"), "Bottom 2/12");
      });

      test("the octave stepper carries a visible Octave label and keeps its Octave n accessible name", async () => {
        await setup(SCALE);
        assert.strictEqual(await b.eval(`return document.getElementById("editor-oct-label").textContent;`), "Octave");
        assert.strictEqual(await b.eval(`return getComputedStyle(document.getElementById("editor-oct-label")).display !== "none";`), true);
        assert.strictEqual(await b.eval(`return document.getElementById("editor-oct").getAttribute("aria-label");`), "Octave 4");
      });

      test("D18 labels: the menu item shows the scoped label at any width, with the scope in the accessible name", async () => {
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
        assert.deepStrictEqual(await reset(), { aria: "Reset bottom spacing", disabled: false, visible: "Reset bottom spacing" });
      });

      test("D18 disabled cases: a rim note or the ding selected gives an empty scope; Neotone disables Reset and shows Main and Mutant counts", async () => {
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
        assert.deepStrictEqual(await b.eval(`return [...document.querySelectorAll("#editor-counts .zc")].map((e) => e.dataset.zone);`), ["main", "mutant", "ding"]);
      });

      test("U2c nit 2: a tray note still replaces the ding when a bottom copy of a rim note is present", async () => {
        await setupLegacy("[C4] " + SCALE);
        await b.click("#editor-oct-down");
        await hold("G");
        await b.waitFor('editorSession.held && drawerExperiment.state === "SHUT"',
          { label: "the held note and cleared pan" });
        await tapNote("ding", 0);
        assert.match(await status(), /G3 is the ding/);
        assert.strictEqual(await b.eval(`return editorDingOf(editorSession.history.present);`), "G3");
        assert.deepStrictEqual(await b.eval(`return editorNames(editorSession.history.present, "bottom");`), ["C4"]);
      });
    });

    describe("U2f drag and drop, trash, touch flag", () => {
      const chipAt = async (name) => {
            await exposeDrawerControl('.tray-note[data-name="' + name + '"]', selector => b.click(selector));
            return b.eval(`const r = document.querySelector('.tray-note[data-name="${name}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
          };
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

      async function dragPlacedNote(ring, destination, kind, inspect) {
        const open = await b.eval(`return drawerExperiment.expanded;`);
        if (open) await b.click("#drawerexp-handle");
        await b.waitFor(`drawerExperiment.state === "SHUT"`, { label: "the drawer to uncover the source note" });
        const start = await noteAt(ring, 0);
        const sourceHit = await b.eval(`return !!document.elementFromPoint(${start.x}, ${start.y})?.closest("#editor-pan");`);
        assert.equal(sourceHit, true, `${ring} note is visible before the drag`);
        async function pointer(phase, pt) {
          if (kind === "touch") {
            const type = { down: "touchStart", move: "touchMove", up: "touchEnd", cancel: "touchCancel" }[phase];
            await b.send("Input.dispatchTouchEvent", {
              type, touchPoints: pt ? [{ x: pt.x, y: pt.y, id: 1 }] : []
            });
          } else {
            const type = { down: "mousePressed", move: "mouseMoved", up: "mouseReleased", cancel: "mouseReleased" }[phase];
            await b.send("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", buttons: phase === "move" || phase === "down" ? 1 : 0, clickCount: 1 });
          }
        }
        await pointer("down", start);
        let released = false;
        try {
          await pointer("move", { x: start.x + (start.x < 40 ? 28 : -28), y: start.y });
          await b.waitFor(`!!editorDrag?.live`, { label: `the ${kind} ${ring} drag to lift` });
          let point, hit;
          for (let attempt = 0; attempt < 7; attempt++) {
            point = await b.eval(`
              const target = ${JSON.stringify(destination)};
              const svg = document.querySelector("#editor-pan svg");
              const asEvent = (pt) => ({ clientX: pt.x, clientY: pt.y });
              if (target === "outside") {
                const candidates = [4, innerWidth / 2, innerWidth - 4].flatMap(x =>
                  [4, 12, 22].map(y => ({ x, y })));
                const outside = candidates.find(pt =>
                  !document.elementFromPoint(pt.x, pt.y)?.closest("button, input, #editor-pan") &&
                  editorDropTarget(asEvent(pt), editorDrag.src).kind === "outside");
                if (!outside) throw new Error("No uncovered point is outside the pan");
                return outside;
              }
              if (target === "ding") {
                const r = svg.querySelector('.ehit[data-ring="ding"]').getBoundingClientRect();
                return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
              }
              const angle = [150, 125, 100, 75, 50, 25, 15][${attempt}] * Math.PI / 180;
              const orbit = editorSolve(editorSession.history.present).value.geom.bottom || 1.15;
              const pt = new DOMPoint(orbit * Math.cos(angle) * 100, -orbit * Math.sin(angle) * 100)
                .matrixTransform(svg.getScreenCTM());
              return { x: pt.x, y: pt.y };
            `);
            await pointer("move", point);
            hit = await b.eval(`return editorDropTarget({ clientX: ${point.x}, clientY: ${point.y} }, editorDrag.src);`);
            if (destination === "bottom" ? hit.kind === "spot" && hit.ring === "bottom" : hit.kind === destination) break;
          }
          assert.ok(destination === "bottom" ? hit.kind === "spot" && hit.ring === "bottom" : hit.kind === destination,
            `drag target ${destination}: ${JSON.stringify(hit)}`);
          if (inspect) await inspect();
          await pointer("up", kind === "touch" ? null : point);
          released = true;
          await b.waitFor(`!editorDrag && !editorEl("editor").matches(".dragging, .settling")`, { label: "the placed-note drag to settle" });
        } finally {
          if (!released) await pointer("cancel", kind === "touch" ? null : start);
        }
      }

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

          test("U2f item 4: dragging the Ding or last rim note off the pan leaves an editable draft and Undo restores it", async () => {
            await setup("(D3) A3");
            const before = await core();
            const steps = await pastLen();
            await dragPlacedNote("ding", "outside", kind);
            assert.strictEqual((await core()).ding, "");
            assert.deepStrictEqual(await names("rim"), ["A3"]);
            assert.strictEqual(await b.eval(`return document.getElementById("editor-save").disabled;`), true);
            assert.strictEqual(await pastLen(), steps + 1);
            await clickUndo();
            assert.deepStrictEqual(await core(), before);
            await dragPlacedNote("rim", "outside", kind);
            assert.strictEqual((await core()).ding, "D3");
            assert.deepStrictEqual(await names("rim"), []);
            assert.strictEqual(await b.eval(`return document.getElementById("editor-save").disabled;`), true);
            assert.strictEqual(await pastLen(), steps + 1);
            await clickUndo();
            assert.deepStrictEqual(await core(), before);
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

          test("D4 / SE-6: off-pan removes a placed note with Undo, pinned footer cancels, and a tray note off-pan cancels", async () => {
            await setup(SCALE);
            const before = await core();
            const steps = await pastLen();
            await gesture(await noteAt("rim", 3), await offPan(), kind);
            assert.ok(!(await rimNames()).includes("D4"), "removed off the pan");
            assert.match(await status(), /^D4 removed\./);
            assert.strictEqual(await pastLen(), steps + 1);
            await clickUndo();
            assert.deepStrictEqual(await core(), before);
            await gesture(await noteAt("rim", 3), await centreOf("#editor-save"), kind);
            assert.deepStrictEqual(await core(), before, "a drop on the pinned footer does not remove a note");
            assert.strictEqual(await pastLen(), steps);
            await gesture(await chipAt("G"), await offPan(), kind);
            assert.deepStrictEqual(await core(), before, "a tray note off the pan is cancelled");
            assert.strictEqual(await pastLen(), steps);
          });

          test("D4: a rim note swaps with the Ding in one step and Undo restores both pitches", async () => {
            await setup("(A2) E3 A3");
            const before = await core();
            const steps = await pastLen();
            await dragPlacedNote("rim", "ding", kind);
            const swapped = await core();
            assert.strictEqual(swapped.ding, "E3", await status());
            assert.deepStrictEqual(swapped.parts.rim.slice().sort(), ["A2", "A3"]);
            assert.strictEqual(await pastLen(), steps + 1);
            await clickUndo();
            assert.deepStrictEqual(await core(), before);
          });

          test("D3: the last rim note dragged to an empty bottom spot moves areas in one step; Undo restores", async () => {
            await setup("(D3) A3");
            const before = await core();
            const steps = await pastLen();
            await dragPlacedNote("rim", "bottom", kind);
            assert.deepStrictEqual(await names("bottom"), ["A3"], await status());
            assert.deepStrictEqual(await rimNames(), []);
            assert.strictEqual((await core()).ding, "D3");
            assert.strictEqual(await pastLen(), steps + 1);
            await clickUndo();
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
        for (const sel of [".editor-head", "#editor-line", "#editor-status", "#editor-panels", ".editor-toolbar", "#editor"]) {
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

      test("OQA zone counts: 'Rim 8/12' per zone, 'Full' joins the count at the cap, each count at most two line boxes (375 and 820)", async () => {
        for (const [w, h] of [[375, 667], [820, 1180]]) {
          await fresh(w, h);
          await openAdd();
          await typeLine(SCALE);
          await b.click("#editor-hint-toggle");
          await b.waitFor(`!document.getElementById("editor-areas").hidden`);
          assert.strictEqual(await zoneCount("rim"), "Rim 8/12");
          assert.strictEqual(await zoneCount("inner"), "Cyclops 2/6");
          assert.strictEqual(await zoneCount("bottom"), "Bottom 0/12");
          for (const l of await lineBoxes("#editor-counts .zc")) assert.ok(l.h <= l.lh * 2.6 + 0.5, w + ": '" + l.text + "' is at most two line boxes, " + l.h + " vs " + l.lh);
          for (const f of await b.eval(`return [...document.querySelectorAll("#editor-counts .zc")].map((e) => ({ text: e.textContent, sw: e.scrollWidth, cw: e.clientWidth }));`)) assert.ok(f.cw > 0 && f.sw <= f.cw,w + ": '" + f.text + "' does not overflow its box, scrollWidth " + f.sw + " vs clientWidth " + f.cw);
          await typeLine("(D3) " + RIM12 + " | C6");
          assert.strictEqual(await zoneCount("rim"), "Rim 12/12 Full");
          assert.strictEqual(await b.eval(`return document.querySelectorAll('#editor-counts [data-zone="rim"] b').length;`), 1);
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
          test("OQA drag off removes with undo toast; OQA release to remove ghost: past the margin the ghost says so, release removes in one step, Undo restores", async () => {
            await setup(SCALE);
            const before = await core();
            const steps = await pastLen();
            let cls = null, text = null, inside = null;
            await gesture(await noteAt("rim", 3), await offPan(), kind, { at: 1, mid: async () => { cls = await ghostClass(); text = await ghostText(); } });
            assert.match(cls, /remove/, "the ghost has the remove class past the margin");
            assert.match(text, /Release to remove/);
            assert.ok(!(await rimNames()).includes("D4"));
            assert.strictEqual(await pastLen(), steps + 1, "one history step");
            assert.match(await status(), /^D4 removed\./);
            await clickUndo();
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

          test("OQA Ding off-pan drag previews removal, empties the center and restores through Undo", async () => {
            await setup("[A2] " + SCALE);
            const before = await core();
            const steps = await pastLen();
            let cls = null;
            await dragPlacedNote("ding", "outside", kind, async () => { cls = await ghostClass(); });
            assert.match(cls, /remove/);
            assert.doesNotMatch(cls, /refuse/);
            const after = await core();
            assert.strictEqual(after.ding, "");
            assert.deepStrictEqual(after.parts, before.parts);
            assert.strictEqual(await pastLen(), steps + 1);
            assert.match(await status(), /^D3 removed\./);
            await clickUndo();
            assert.deepStrictEqual(await core(), before);
          });

          test("OQA last rim off-pan drag previews removal, leaves the Ding and restores through Undo", async () => {
            await setup("(D3) A3");
            const before = await core();
            const steps = await pastLen();
            let cls = null;
            await dragPlacedNote("rim", "outside", kind, async () => { cls = await ghostClass(); });
            assert.match(cls, /remove/);
            assert.doesNotMatch(cls, /refuse/);
            assert.deepStrictEqual(await rimNames(), []);
            assert.strictEqual((await core()).ding, "D3");
            assert.strictEqual(await pastLen(), steps + 1);
            assert.match(await status(), /^A3 removed\./);
            await clickUndo();
            assert.deepStrictEqual(await core(), before);
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
            const q = await b.eval(`const geom = editorSolve(editorSession.history.present).value.geom;
              const p = neoSlotPoint(${slot}, null, geom.turn);
              const svg = document.querySelector("#editor-pan svg"); const c = new DOMPoint(p.x, p.y).matrixTransform(svg.getScreenCTM()); return { x: c.x, y: c.y };`);
            return q;
          };
          const keys = () => b.eval(`return editorSession.history.present.options.profile.map.slice();`);
          const neo = async ({ legacy = false } = {}) => {
            const notation = "[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4";
            await setup(notation);
            if (!legacy) {
              await b.click("#editor-type-neotone");
              return;
            }
            await b.eval(`const current = editorSession.history.present;
              const loaded = editorLoad(${JSON.stringify(notation)}, { profile: editorProfileFor(current.fields) });
              if (!loaded.ok || loaded.value.options.profile.rev !== 2) throw new Error(loaded.reason || "Expected the legacy profile");
              editorSession.history = editorHistoryNew(loaded.value);
              editorRender(); return true;`);
          };

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

          test("a legacy Neotone mutant dragged into an empty field is refused with the field-empty copy and nothing changes", async () => {
            await neo({ legacy: true });
            const before = await keys();
            const emptyMain = before.findIndex((k, i) => i < 9 && k == null);
            assert.ok(emptyMain >= 0);
            await gesture(await chipAt("B"), await slotAt(9 + emptyMain), kind);
            assert.match(await status(), new RegExp(`Field ${emptyMain + 1} is empty`));
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
        await place("rim");
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
        await b.eval(`editorPlaceHeld({ kind: "spot", ring: "rim" }, editorSession.history.present); return true;`);
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
            const below = [...ed.querySelectorAll("#editor-tabs, .editor-toolbar, #editor-tray")].map((e) => e.getBoundingClientRect().top);
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

    describe("U2f-2 tap and zone-add parity (gap rows 9, 11, 13, 23, 24)", () => {
      const selectedOf = () => b.eval(`return editorSession.sel;`);
      const pinRings = () => b.eval(`return [...document.querySelectorAll("#editor-pan .epin")].length;`);
      const orbitOf = (ring) => b.eval(`return editorSolve(editorSession.history.present).value.geom[${JSON.stringify(ring)}] || (${JSON.stringify(ring)} === "bottom" ? 1.15 : 0.38);`);
      const linkOf = () => b.eval(`return editorExport(editorSession.history.present).link.value;`);
      const names = (ring) => b.eval(`return editorNames(editorSession.history.present, ${JSON.stringify(ring)});`);
      const pastLen = () => b.eval(`return editorSession.history.past.length;`);

      for (const touch of [false, true]) {
        describe(touch ? "touch" : "mouse", () => {
          test("a selected note moves to a tapped ring as one Undo step", async () => {
            await fresh(375, 667);
            await openAdd();
            await typeLine(SCALE);
            const before = await linkOf();
            await tapNote("rim", 1, touch);
            assert.strictEqual(await status(), "Bb3 picked. Tap another note to swap, or tap a spot to move it.");
            const past = await pastLen();
            await place("bottom");
            assert.deepStrictEqual(await names("bottom"), ["Bb3"], await status());
            assert.strictEqual((await names("rim")).length, 7);
            assert.strictEqual(await selectedOf(), null);
            assert.strictEqual(await pastLen(), past + 1);
            await clickUndo();
            assert.strictEqual(await linkOf(), before, "one Undo restores it byte-equal");
          });

          test("tap select then a cross-zone spot moves even the last rim note as one Undo step", async () => {
            await fresh(375, 667);
            await openAdd();
            await typeLine(SCALE);
            await tapNote("rim", 3, touch);
            await tapSpot(...polar(await orbitOf("bottom"), 150), touch);
            assert.deepStrictEqual(await names("bottom"), ["D4"], await status());
            assert.ok(!(await names("rim")).includes("D4"));
            await fresh(375, 667);
            await openAdd();
            await typeLine("(D3) A3");
            const before = await linkOf();
            const steps = await pastLen();
            await b.click("#drawerexp-handle");
            await b.waitFor(`drawerExperiment.state === "SHUT"`, { label: "the drawer to uncover the last rim note" });
            await tapNote("rim", 0, touch);
            assert.deepStrictEqual(await selectedOf(), { ring: "rim", i: 0 }, await status());
            await tapSpot(...polar(await orbitOf("bottom"), 150), touch);
            assert.deepStrictEqual(await names("bottom"), ["A3"], await status());
            assert.deepStrictEqual(await names("rim"), []);
            assert.strictEqual(await pastLen(), steps + 1);
            await clickUndo();
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
            await place("rim");
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

    test("375x667: the Scale tab holds the octave controls and Sharps|Flats, the Layout tab the palette and anchors, all 44px and in view, and the panel does not scroll", async () => {
      await setup(BOTTOM);
      assert.deepStrictEqual(await inView(["editor-oct-down", "editor-oct-up", "editor-sharps", "editor-flats"], 375, 667), []);
      const big = (ids) => b.eval(`const q = (id) => document.getElementById(id).getBoundingClientRect(); return ${JSON.stringify(ids)}.map((id) => q(id).height >= 44 && q(id).width >= 44);`);
      assert.deepStrictEqual(await big(["editor-oct-down", "editor-oct-up", "editor-sharps", "editor-flats"]), [true, true, true, true]);
      assert.strictEqual(await b.eval(`const q = (id) => document.getElementById(id).getBoundingClientRect(); return Math.abs(q("editor-sharps").top - q("editor-flats").top) < 2 && q("editor-flats").left >= q("editor-sharps").right - 1;`), true, "Sharps then Flats on one row");
      assert.deepStrictEqual(await noScroll(375, 667), { page: true, panel: true }, "Scale tab");
      await b.click("#editor-tab-layout");
      assert.deepStrictEqual(await inView(["editor-swatches", "editor-anchor-one", "editor-anchor-between"], 375, 667), []);
      assert.deepStrictEqual(await big(["editor-swatches", "editor-anchor-one", "editor-anchor-between"]), [true, true, true]);
      assert.deepStrictEqual(await noScroll(375, 667), { page: true, panel: true }, "Layout tab");
    });

    test("EPF: the Layout tab shows ten 44px palette dots under a visible label with no chip, with no scroll at 375x667, and one tap picks", async () => {
      await setup(BOTTOM);
      await b.click("#editor-tab-layout");
      const flat = await b.eval(`const g = document.getElementById("editor-swatches"); const dots = [...g.querySelectorAll("button")];
        const label = document.getElementById("editor-palette-label"); const lq = label.getBoundingClientRect();
        return { chip: document.getElementById("editor-palette"), n: dots.length, shown: !g.hidden && g.offsetParent !== null,
          tall: dots.every((d) => { const q = d.getBoundingClientRect(); return q.width >= 44 && q.height >= 44; }), names: dots.slice(0, 2).map((d) => d.getAttribute("aria-label")),
          labelled: g.getAttribute("aria-labelledby") === "editor-palette-label", ownLabel: g.hasAttribute("aria-label"), labelShown: lq.width > 0 && lq.height > 0, labelText: label.textContent,
          notes: document.getElementById("editor-panel-scale").hasAttribute("hidden") };`);
      assert.deepStrictEqual(flat, { chip: null, n: 10, shown: true, tall: true, names: ["Palette 1", "Palette 2"], labelled: true, ownLabel: false, labelShown: true, labelText: "Palette", notes: true });
      assert.deepStrictEqual(await noScroll(375, 667), { page: true, panel: true }, "dots always shown");
      assert.deepStrictEqual(await inView(["editor-palette-label", "editor-swatches", "editor-save", "editor-anchor-one"], 375, 667), []);
      const past = await pastLen();
      await b.click('#editor-swatches button[data-palette="9"]');
      assert.strictEqual((await model()).options.palette, 9, "one tap picks");
      assert.match(await code(), /\/palette-10\//);
      assert.strictEqual(await pastLen(), past + 1, "one Undo step");
      assert.deepStrictEqual(await b.eval(`const g = document.getElementById("editor-swatches"); return [g.hidden, g.offsetParent !== null, g.querySelector('[data-palette="9"]').getAttribute("aria-pressed"), g.querySelector('[data-palette="0"]').getAttribute("aria-pressed")];`),
        [false, true, "true", "false"], "the group stays open and marks the pick");
      await b.click('#editor-swatches button[data-palette="0"]');
      assert.strictEqual((await model()).options.palette, 0);
      assert.strictEqual((await code()).includes("palette-"), false, "palette 0 writes no option");
      assert.strictEqual(await pastLen(), past + 2);
      await clickUndo();
      assert.strictEqual((await model()).options.palette, 9);
      assert.strictEqual(await b.eval(`return document.querySelector('#editor-swatches [data-palette="9"]').getAttribute("aria-pressed");`), "true", "undo moves the mark");
    });

    test("EPF: the page layer paints an opaque ground and a disabled mode control dims", async () => {
      await setup(BOTTOM);
      const seen = await b.eval(`const bg = getComputedStyle(document.getElementById("scale-sheet")).backgroundColor;
        const x = document.createElement("button"); x.className = "mode"; x.disabled = true; document.getElementById("settings-panel").appendChild(x);
        const dim = getComputedStyle(x).color; x.remove();
        return { bg, dim };`);
      assert.deepStrictEqual(seen, { bg: "rgb(246, 244, 237)", dim: "rgb(138, 132, 123)" });
    });

    test("EPF: picking the current palette adds no Undo step and keeps the dots shown", async () => {
      await setup(BOTTOM);
      const past = await pastLen();
      await b.click('#editor-swatches button[data-palette="0"]');
      assert.strictEqual(await pastLen(), past);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-swatches").offsetParent !== null;`), true);
    });

    test("the anchor splits notes 1 and 2, aria-pressed follows, and a repeat adds no step", async () => {
      await setup("(D3) " + RIM8);
      await typeLine(BOTTOM);
      const rim = () => b.eval(`const s = editorSolve(editorSession.history.present).value.fields; return ringIds(s, "rim").map((id) => s[id][4]);`);
      const rim0 = await rim();
      await b.click("#editor-anchor-between");
      assert.notDeepStrictEqual(await rim(), rim0);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-anchor-between").getAttribute("aria-pressed");`), "true");
      assert.match(await code(), /between/);
      const past = await pastLen();
      await b.click("#editor-anchor-between");
      assert.strictEqual(await pastLen(), past, "the same anchor adds no step");
    });

    test("the anchor controls are at least 44px", async () => {
      await setup("(D3) " + RIM8 + " [G2]\n");
      await typeLine(BOTTOM);
      await b.click("#editor-tab-layout");
      const sizes = await b.eval(`return ["editor-anchor-one", "editor-anchor-between"].map((id) => { const q = document.getElementById(id).getBoundingClientRect(); return q.width >= 44 && q.height >= 44; });`);
      assert.deepStrictEqual(sizes, [true, true]);
    });

    test("EPF: a palette pick applies while the text line is being edited, and is refused while a dialog is open", async () => {
      await setup(BOTTOM);
      await b.click("#editor-tab-layout");
      await b.eval(`editorSession.editing = true; return true;`);
      await b.click('#editor-swatches button[data-palette="3"]');
      assert.strictEqual((await model()).options.palette, 3);
      await b.eval(`editorSession.editing = false; editorSession.dialog = true; return true;`);
      await b.eval(`document.querySelector('#editor-swatches [data-palette="5"]').click(); return true;`);
      assert.strictEqual((await model()).options.palette, 3, "a pick under a dialog is refused");
    });

    test("EPF: a palette pick is refused while a rejected text line is still being edited, and the error stays visible", async () => {
      await setup(BOTTOM);
      await typeLine("A3 QQ9");
      const kind = () => b.eval(`const s = document.getElementById("editor-status"); return [s.getAttribute("data-kind"), s.textContent.trim().length > 0, editorSession.editing];`);
      assert.deepStrictEqual(await kind(), ["error", true, true]);
      const before = (await model()).options.palette || 0;
      await b.click("#editor-tab-layout");
      await b.eval(`document.querySelector('#editor-swatches [data-palette="4"]').click(); return true;`);
      assert.deepStrictEqual(await kind(), ["error", true, true], "the banner stays and editing is still on");
      assert.strictEqual((await model()).options.palette || 0, before, "the palette is unchanged");
    });
  });

  describe("U2e-3 Replace ding and button fit", () => {
    const status = () => b.eval(`return document.getElementById("editor-status").textContent;`);
    const ding = () => b.eval(`return editorDingOf(editorSession.history.present);`);
    const setup = async (line, width = 390, height = 844) => { await fresh(width, height); await openAdd(); await typeLine(line); };

    test("the ding takes a held tray note or a selected bottom note through the pan, with no Replace ding button", async () => {
      await setup("[A2] (D3) " + RIM8 + " | C5 D5");
      assert.strictEqual(await b.eval(`return !document.getElementById("editor-replace-ding") && !document.getElementById("editor-pills");`), true);
      await b.click("#editor-oct-down");
      await b.click('.tray-note[data-name="G"]');
      await b.eval(`editorPlaceHeld({ kind: "ding" }, editorSession.history.present); return true;`);
      assert.strictEqual(await ding(), "G3", await status());
      await clickUndo();
      assert.strictEqual(await ding(), "D3");
      await b.eval(`editorSession.sel = { ring: "bottom", i: 0 }; editorRender(); editorSelectTap({ kind: "ding" }, editorSession.history.present); return true;`);
      assert.strictEqual(await ding(), "A2");
    });

    test("every label in the tabs, the count row and the toolbar fits its button at 390, 375 and 320 wide, in all eight locales, with the real fonts", async () => {
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
              for (const btn of document.querySelectorAll("#editor-tabs button, #editor .editor-toolbar button, #editor-hint-toggle")) {
                if (!btn.offsetParent) continue;
                if (btn.id === "editor-hint-toggle" && (btn.getBoundingClientRect().height < 44 || btn.getBoundingClientRect().width < 44)) out.push("hint toggle under 44px");
                const row = document.getElementById("editor-tabs").getBoundingClientRect();
                if (btn.id === "editor-hint-toggle" && (btn.getBoundingClientRect().right > row.right + 0.5 || document.documentElement.scrollWidth > innerWidth)) out.push("hint toggle overflows");
                const box = btn.getBoundingClientRect();
                const range = document.createRange(); range.selectNodeContents(btn);
                for (const r of range.getClientRects()) {
                  if (r.width && (r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5)) out.push(btn.id + ":" + btn.textContent);
                }
                const size = parseFloat(getComputedStyle(btn).fontSize);
                if (size < 10.5) out.push(btn.id + " font " + size);
              }
              const rowBox = document.getElementById("editor-counts").getBoundingClientRect();
              const zcs = [...document.querySelectorAll("#editor-counts .zc")];
              if (!zcs.length) out.push("no count labels");
              for (const zc of zcs) {
                const box = zc.getBoundingClientRect();
                if (box.left < rowBox.left - 0.5 || box.right > rowBox.right + 0.5 || box.right > innerWidth + 0.5) out.push("count " + zc.dataset.zone + ":" + zc.textContent);
                if (zc.getClientRects().length > 1) out.push("count wraps " + zc.dataset.zone + ":" + zc.textContent);
                if (zc.scrollWidth > zc.clientWidth + 0.5 && zc.clientWidth > 0) out.push("count clipped " + zc.dataset.zone + ":" + zc.textContent);
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

    test("the text line opens on Enter; the palette dots work from the keyboard", async () => {
      await setup();
      await b.eval(`document.getElementById("editor-line").focus(); return true;`);
      await enter();
      assert.strictEqual(await b.eval(`return editorSession.editing;`), true);
      await press("Escape", "Escape", 27);
      await b.click("#editor-tab-layout");
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

    for (const [tw, th] of [[375, 548], [375, 440]]) test(`Tab brings every stop into the panel's scrollport on a short screen ${tw}x${th}`, async () => {
      await fresh(tw, th);
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-tab-layout");
      assert.deepStrictEqual(await b.eval(`const root = document.getElementById("editor");
        const off = root.appendChild(document.createElement("button")); off.id = "zz-off"; off.disabled = true;
        const none = root.appendChild(document.createElement("button")); none.id = "zz-none"; none.style.display = "none";
        const ids = editorTabStops().map((e) => e.id); off.remove(); none.remove();
        return ids.filter((id) => id.startsWith("zz-"));`), [], "a disabled or unlaid-out control is no Tab stop");
      const stops = await b.eval(`return editorTabStops().length;`);
      await b.eval(`document.getElementById("editor-back").focus(); return true;`);
      const outside = [];
      for (let k = 0; k < stops; k += 1) {
        await press("Tab", "Tab", 9);
        const out = await b.eval(`const a = document.activeElement, q = a.getBoundingClientRect(), inRegion = !!a.closest("#editor-region") && !a.closest("#editor-tabs");
          const p = document.getElementById(inRegion ? "editor-region" : "editor").getBoundingClientRect();
          const top = inRegion ? document.getElementById("editor-tabs").getBoundingClientRect().bottom : p.top;
          return q.top < top - 1 || q.bottom > p.bottom + 1 ? (a.id || a.className) : null;`);
        if (out) outside.push(out);
      }
      assert.deepStrictEqual(outside, []);
    });
  });

  describe("drag ux: compact panel, magnify on drag, placed-note highlight", () => {
    before(() => { magPinned = false; });
    after(() => { magPinned = true; });
    const pause = (ms) => new Promise((done) => setTimeout(done, ms));
    const ding = () => b.eval(`return editorDingOf(editorSession.history.present);`);
    const names = (ring) => b.eval(`return editorNames(editorSession.history.present, ${JSON.stringify(ring)});`);
    const chipAt = async (name) => {
          await exposeDrawerControl('.tray-note[data-name="' + name + '"]', selector => b.click(selector));
          return b.eval(`const r = document.querySelector('.tray-note[data-name="${name}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
        };
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
            else if (how === "escape") {
              await b.key("Escape", "Escape", 27);
              await pause(500);
              assert.strictEqual(await isDragging(), false, "Escape alone ends the drag");
              assert.strictEqual(await live(), false, "Escape alone ends the drag");
              await touch("touchEnd");
            }
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

    test("drag ux E4: a placed note is highlighted after a drag, a tap, a tap on a zone, a tap on the ding, a trade by two taps and the keyboard, and not after Undo", async () => {
      const marked = () => b.eval(`return [...document.querySelectorAll("#editor-pan .ehit.editor-new")].map((e) => e.dataset.ring + e.dataset.i);`);
      const tapPt = async (pt) => { for (const type of ["mousePressed", "mouseReleased"]) await b.send("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", clickCount: 1 }); };
      await setup(SCALE_);
      await liftFrom(await chipAt("B"), await noteAt("rim", 0));
      await touch("touchMove", await spotNow((await geom()).rim, 22.5));
      await touch("touchEnd");
      await pause(700);
      assert.deepStrictEqual(await marked(), ["rim8"], "drag add");
      await clickUndo();
      assert.deepStrictEqual(await marked(), [], "not after Undo");
      await b.click('.tray-note[data-name="B"]');
      await tapPt(await spotNow((await geom()).rim - 0.08, 20));
      assert.deepStrictEqual(await marked(), ["rim8"], "zone tap");
      await clickUndo();
      await b.click('.tray-note[data-name="B"]');
      const gm = await geom();
      const pt = await b.eval(`const svg = document.querySelector("#editor-pan svg"); const p = new DOMPoint(${gm.rim} * 100 * Math.cos(0.4), -${gm.rim} * 100 * Math.sin(0.4)).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y };`);
      await tapPt(pt);
      assert.strictEqual((await marked()).length, 1, "tap to place");
      await clickUndo();
      await b.click("#editor-oct-down");
      await b.click('.tray-note[data-name="G"]');
      await tapPt(await spotNow((await geom()).ding, -90));
      assert.deepStrictEqual(await marked(), ["ding0"], "ding tap");
      await clickUndo();
      await tapPt(await noteAt("rim", 0));
      await tapPt(await noteAt("rim", 1));
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
    const DELETE_LABEL = "Delete scale";
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
    const label = () => b.eval(`return document.getElementById("editor-delete").textContent;`);
    const guard = () => new Promise((done) => setTimeout(done, 450));

    test("TRI59 delete is offered on an edited scale only, as a 44px item in the ... menu", async () => {
      await fresh();
      await openAdd();
      assert.strictEqual(await b.eval(`return !!document.getElementById("editor-delete");`), false, "no delete on a scale not yet saved");
      await fresh();
      await openBuiltin();
      await b.click("#editor-more");
      const r = await b.eval(`const e = document.getElementById("editor-delete"), q = e.getBoundingClientRect(), m = document.getElementById("editor-menu").getBoundingClientRect();
        return { name: e.textContent, role: e.getAttribute("role"), w: q.width, h: q.height, inMenu: q.left >= m.left - 0.5 && q.right <= m.right + 0.5 && q.top >= m.top - 0.5 && q.bottom <= m.bottom + 0.5, inHead: !!e.closest(".editor-head") };`);
      assert.deepStrictEqual(r, { name: DELETE_LABEL, role: "menuitem", w: r.w, h: r.h, inMenu: true, inHead: false });
      assert.ok(r.h >= 44, JSON.stringify(r));
    });

    test("TRI59 delete first tap arms and says what will go, the second removes the saved scale and closes the editor", async () => {
      await fresh();
      await saveNew(SCALE);
      const before = await savedCount();
      await reopenSelected();
      await b.click("#editor-delete");
      assert.match(await label(), /^Press again to delete /);
      assert.strictEqual(await savedCount(), before, "one tap deletes nothing");
      assert.match(await b.eval(`return document.getElementById("editor-status").textContent;`), /^Tap again to remove .+ This cannot be undone\.$/);
      await guard();
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
      assert.match(await label(), /^Press again to delete /);
      assert.strictEqual(await savedCount(), before);
    });

    test("the header keeps Back and the pan type fitting at 320, 375 and 390 now that Delete left it", async () => {
      for (const [w, h] of [[320, 568], [375, 667], [390, 844]]) {
        await fresh(w, h);
        await openBuiltin();
        const r = await b.eval(`const head = document.querySelector(".editor-head"), q = head.getBoundingClientRect();
          const kids = [...head.querySelectorAll("button")].map((e) => e.getBoundingClientRect());
          return { fits: head.scrollWidth <= head.clientWidth + 0.5 && kids.every((k) => k.left >= q.left - 0.5 && k.right <= q.right + 0.5 && k.width >= 44 && k.height >= 44),
            overlap: kids.some((k, i) => kids.some((o, j) => j > i && k.left < o.right - 0.5 && o.left < k.right - 0.5)), n: kids.length };`);
        assert.deepStrictEqual(r, { fits: true, overlap: false, n: 3 }, w + " " + JSON.stringify(r));
      }
    });

    const NEO_LINE = "[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4";
    const profileMap = () => b.eval(`return editorSession.history.present.options.profile.map.slice();`);
    const status = () => b.eval(`return document.getElementById("editor-status").textContent;`);
    const neoSetup = async (width = 375, height = 667) => {
      await fresh(width, height);
      await openAdd();
      await typeLine(NEO_LINE);
      await b.click("#editor-type-neotone");
    };

    test("PL-a the Layout row holds only the two anchor buttons, Rotate and Mirror are gone, and the Neotone pair is shown like Standard's", async () => {
      for (const [w, h] of [[320, 568], [375, 667], [820, 1180]]) {
        await fresh(w, h);
        await openAdd();
        await typeLine("[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4");
        await b.click("#editor-tab-layout");
        const row = () => b.eval(`const box = (id) => document.getElementById(id).getBoundingClientRect();
          const all = [...document.querySelectorAll("#editor-layout button")].map((e) => e.id);
          const ids = [...document.querySelectorAll("#editor-layout button")].filter((e) => e.offsetParent !== null).map((e) => e.id);
          return { all, ids, gone: ["editor-mirror-top", "editor-mirror-bottom", "editor-rotate-ccw", "editor-rotate-cw"].map((id) => document.getElementById(id) === null),
            greyed: [...document.querySelectorAll("#editor-layout button")].filter((e) => e.offsetParent !== null && e.disabled).length,
            targets: ids.every((id) => box(id).width >= 44 && box(id).height >= 44), inView: ids.every((id) => box(id).left >= 0 && box(id).right <= innerWidth && box(id).bottom <= innerHeight),
            scroll: document.getElementById("editor").scrollHeight <= document.getElementById("editor").clientHeight };`);
        assert.deepStrictEqual(await row(), { all: ["editor-anchor-one", "editor-anchor-between"], ids: ["editor-anchor-one", "editor-anchor-between"], gone: [true, true, true, true], greyed: 0,
          targets: true, inView: true, scroll: true }, "Standard " + w);
        await b.click("#editor-type-neotone");
        await b.click("#editor-tab-layout");
        const neo = await row();
        assert.deepStrictEqual([neo.ids, neo.gone, neo.greyed, neo.targets, neo.inView, neo.scroll], [["editor-anchor-one", "editor-anchor-between"], [true, true, true, true], 0, true, true, true], "Neotone " + w + ": the pair is shown, enabled, 44px, in view and the panel does not scroll");
        await b.click("#editor-type-standard");
        await b.click("#editor-tab-layout");
        assert.deepStrictEqual((await row()).ids, ["editor-anchor-one", "editor-anchor-between"], "back on Standard");
      }
    });

    const seedPermuted = () => b.eval(`editorDo((m) => { const map = m.options.profile.map, next = new Array(map.length).fill(null);
      map.forEach((key, slot) => { if (key !== null) { const f = slot % 9; next[slot - f + ((f + 2) % 9)] = key; } });
      return editorNeoBuild(m, editorPartsOf(m), next); }); editorRender(); return true;`);

    test("PL-a a permuted Neotone arrangement is dropped by Cancel and kept through SAVE, reload and the share link", async () => {
      await neoSetup();
      const start = await profileMap();
      await seedPermuted();
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
      await seedPermuted();
      const link = await b.eval(`const x = editorExport(editorSession.history.present); const back = HPE.share.decode(x.code); return { ok: back.ok, map: back.ok ? back.value.options.profile.map : null };`);
      assert.deepStrictEqual(link, { ok: true, map: rotated }, "the share code carries the rotated map");
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the save to close" });
      await b.send("Page.navigate", { url: base });
      await b.waitFor(`${APP_READY_EXPR} && booted === true && document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`, { timeout: 15000, label: "the app to boot" });
      await reopenSelected();
      assert.deepStrictEqual(await profileMap(), rotated, "the saved scale reopens permuted");
    });

    test("TRI59 octave stepper is compact at every phone and tablet size: one row, 44px targets, no overflow", async () => {
      for (const [w, h] of [[320, 568], [375, 667], [390, 844], [820, 1180], [1180, 820]]) {
        await fresh(w, h);
        await openBuiltin();
        const r = await b.eval(`const q = (id) => document.getElementById(id).getBoundingClientRect();
          const down = q("editor-oct-down"), up = q("editor-oct-up"), lab = q("editor-oct-label"), val = q("editor-oct"), sharps = q("editor-sharps"), flats = q("editor-flats"), notes = q("editor-notes");
          const e = document.getElementById("editor"), de = document.documentElement;
          return { group: Math.round(up.right - down.left), targets: [down, up, sharps, flats].every((x) => x.width >= 44 && x.height >= 44),
            oneRow: [up, sharps, flats].every((x) => Math.abs(x.top - down.top) < 1), labelBetween: lab.left >= down.right - 0.5 && lab.right <= up.left + 0.5 && val.left >= down.right - 0.5 && val.right <= up.left + 0.5,
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
      assert.match(await label(), /^Press again to delete /);
      const at = await panNote("rim", 1);
      await mouse("mousePressed", at);
      await mouse("mouseReleased", at);
      assert.strictEqual(await label(), DELETE_LABEL, "disarmed");
      assert.deepStrictEqual(await b.eval(`return editorSession.sel;`), { ring: "rim", i: 1 }, "the same click picked the note");
      assert.doesNotMatch(await statusText(), /Tap again to remove/);
      await b.eval(`editorSession.sel = null; editorRender(); return true;`);
      await b.click("#editor-delete");
      assert.match(await label(), /^Press again to delete /);
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
      await guard();
      await b.click("#editor-delete");
      await b.waitFor(`document.getElementById("editor-status").getAttribute("data-kind") === "error"`, { label: "the delete error" });
      assert.match(await statusText(), /^Could not save these changes\./);
      assert.strictEqual(await label(), DELETE_LABEL);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-delete").classList.contains("armed");`), false);
      assert.strictEqual(await b.eval(`return document.getElementById("scale-sheet").hasAttribute("hidden");`), false, "the editor stays open");
      assert.strictEqual(await savedCount(), before);
      await b.eval(`commitSaved = window.__realCommit; return true;`);
    });

    test("TRI59b the last-scale refusal resets the button title and leaves no stale arming text", async () => {
      await fresh();
      await openBuiltin();
      await b.eval(`const all = allDeckViews; allDeckViews = () => all().filter((v) => savedEqual(v.selection, selection)); return true;`);
      await b.click("#editor-delete");
      await guard();
      await b.click("#editor-delete");
      assert.strictEqual(await label(), DELETE_LABEL);
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
            const bad = await b.eval(`const out = [];
              for (const id of ["editor-oct-label", "editor-oct", "editor-sharps", "editor-flats", "editor-anchor-one", "editor-anchor-between", "editor-palette-label", "editor-more"]) {
                const e = document.getElementById(id); if (!e || !e.offsetParent) continue;
                const box = e.getBoundingClientRect();
                if (e.scrollWidth > e.clientWidth + 0.5) out.push(id + " scrollWidth");
                const range = document.createRange(); range.selectNodeContents(e);
                for (const r of range.getClientRects()) if (r.width && (r.left < box.left - 0.5 || r.right > box.right + 0.5)) out.push(id + ":" + e.textContent);
              }
              const ed = document.getElementById("editor"); if (ed.scrollWidth > ed.clientWidth || ed.scrollHeight > ed.clientHeight) out.push("panel scroll");
              return out;`);
            assert.deepStrictEqual(bad, [], width + " " + lang);
            await b.click("#editor-tab-layout");
            assert.deepStrictEqual(await b.eval(`const out = []; for (const id of ["editor-anchor-one", "editor-anchor-between", "editor-palette-label", "editor-swatches"]) { const e = document.getElementById(id); if (e && e.offsetParent && e.scrollWidth > e.clientWidth + 0.5) out.push(id); } return out;`), [], width + " " + lang + " layout");
            await b.click("#editor-more");
            assert.deepStrictEqual(await b.eval(`const m = document.getElementById("editor-menu").getBoundingClientRect(); return [...document.querySelectorAll("#editor-menu [role=menuitem]")].filter((e) => { const q = e.getBoundingClientRect(); return e.scrollWidth > e.clientWidth + 0.5 || q.left < 0 || q.right > innerWidth; }).map((e) => e.id);`), [], width + " " + lang + " menu");
            await b.key("Escape", "Escape", 27);
            await b.click("#editor-tab-scale");
          }
        }
      } finally {
        await b.close();
        b = prev;
      }
    });
  });

  describe("Editor RC W3 P1 tabs, counts, menu, Sharps|Flats, swipe", () => {
    const status = () => b.eval(`return document.getElementById("editor-status").textContent;`);
    const setup = async (line, w = 375, h = 667) => { await fresh(w, h); await openAdd(); await typeLine(line); };
    const hold = (name) => b.click(`.tray-note[data-name="${name}"]`);
    const tabNow = () => b.eval(`return editorSession.tab;`);
    const visible = (id) => b.eval(`const e = document.getElementById(${JSON.stringify(id)}); return !!e && !e.hidden && !e.hasAttribute("hidden") && e.offsetParent !== null;`);
    const swipeBy = (selector, dx, ms = 120, dy = 0) => b.drag(selector, [[dx / 2, ms / 2, dy / 2], [dx, ms, dy]]);

    test("tabs: tablist semantics, roving tabindex, Arrow, Home and End move and focus, the other panel is hidden", async () => {
      await setup(SCALE);
      const r = await b.eval(`const tabs = [...document.querySelectorAll("#editor-tabs [role=tab]")];
        return { list: document.getElementById("editor-tabs").getAttribute("role"), ids: tabs.map((x) => x.id), sel: tabs.map((x) => x.getAttribute("aria-selected")), ti: tabs.map((x) => x.tabIndex),
          ctl: tabs.map((x) => x.getAttribute("aria-controls")), panels: tabs.map((x) => document.getElementById(x.getAttribute("aria-controls")).getAttribute("role")),
          hidden: tabs.map((x) => document.getElementById(x.getAttribute("aria-controls")).hasAttribute("hidden")) };`);
      assert.deepStrictEqual(r, { list: "tablist", ids: ["editor-tab-scale", "editor-tab-layout"], sel: ["true", "false"], ti: [0, -1],
        ctl: ["editor-panel-scale", "editor-panel-layout"], panels: ["tabpanel", "tabpanel"], hidden: [false, true] });
      await b.eval(`document.getElementById("editor-tab-scale").focus(); return true;`);
      await b.key("ArrowRight", "ArrowRight", 39);
      assert.strictEqual(await tabNow(), "layout");
      assert.strictEqual(await b.eval(`return document.activeElement.id;`), "editor-tab-layout");
      assert.deepStrictEqual(await b.eval(`return [...document.querySelectorAll("#editor-tabs [role=tab]")].map((x) => x.tabIndex);`), [-1, 0]);
      await b.key("Home", "Home", 36);
      assert.strictEqual(await tabNow(), "scale");
      await b.key("End", "End", 35);
      assert.strictEqual(await tabNow(), "layout");
      await b.key("ArrowLeft", "ArrowLeft", 37);
      assert.strictEqual(await tabNow(), "scale");
    });

    test("tabs: Scale holds the notes, octave and Sharps|Flats; Layout holds the anchors and the palette; neither tab reaches the other's controls", async () => {
      await setup(SCALE);
      assert.deepStrictEqual(await b.eval(`const inside = (p, id) => document.getElementById(p).contains(document.getElementById(id));
        return ["editor-notes", "editor-oct", "editor-sharps", "editor-flats"].map((id) => inside("editor-panel-scale", id));`), [true, true, true, true]);
      assert.strictEqual(await visible("editor-swatches"), false, "the palette is not on the Scale tab");
      assert.strictEqual(await visible("editor-palette-label"), false, "nor its label");
      await b.click("#editor-tab-layout");
      assert.strictEqual(await visible("editor-swatches"), true);
      assert.strictEqual(await visible("editor-palette-label"), true);
      assert.strictEqual(await visible("editor-notes"), false);
      assert.deepStrictEqual(await b.eval(`return ["editor-anchor-one", "editor-anchor-between"].map((id) => document.getElementById("editor-panel-layout").contains(document.getElementById(id)));`), [true, true]);
    });

    test("tabs: a held note survives a tab switch and still places from the Scale tab", async () => {
      await setup(SCALE);
      await hold("B");
      await b.click("#editor-tab-layout");
      assert.strictEqual(await b.eval(`return editorSession.held !== null;`), true);
      await b.click("#editor-tab-scale");
      assert.strictEqual(await b.eval(`return editorSession.held !== null;`), true);
      await place("rim");
      assert.strictEqual(await zoneCount("rim"), "Rim 9/12");
    });

    test("tabs: choosing a palette swatch keeps the Layout tab", async () => {
      await setup(SCALE);
      await b.click("#editor-tab-layout");
      await b.click("#editor-swatches button");
      assert.strictEqual(await tabNow(), "layout");
    });

    test("counts: Standard shows Rim, Cyclops, Bottom and Ding; Neotone shows Main, Mutant and Ding with no Full mark", async () => {
      await setup("[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4");
      assert.deepStrictEqual(await b.eval(`return [...document.querySelectorAll("#editor-counts .zc")].map((e) => e.textContent);`), ["Rim 7/12", "Cyclops 0/6", "Bottom 1/12", "Ding 1/1 Full"]);
      await b.click("#editor-type-neotone");
      const neo = await b.eval(`return [...document.querySelectorAll("#editor-counts .zc")].map((e) => [e.dataset.zone, e.textContent, e.classList.contains("full")]);`);
      assert.deepStrictEqual(neo.map((x) => x[0]), ["main", "mutant", "ding"]);
      assert.ok(neo.every((x) => /^(Main|Mutant|Ding) \d\/(9|1)/.test(x[1]) && !/Full/.test(x[1].replace(/^Ding.*/, "")) ), JSON.stringify(neo));
    });

    test("counts: both hint lines render under the counts on both tabs", async () => {
      await setup(SCALE);
      const hint = () => b.eval(`return [...document.querySelectorAll("#editor-hint span")].map((e) => e.textContent + ":" + (e.offsetParent !== null));`);
      const want = ["Tap a note to hold it, then tap a ring on the pan, or drag it onto the pan.:true", "Drop or tap a bottom note on the ding to swap it with the root.:true"];
      assert.ok((await hint()).every((x) => x.endsWith(":false")), "collapsed until the Hint button is pressed");
      await b.click("#editor-hint-toggle");
      assert.deepStrictEqual(await hint(), want);
      await b.eval(`return editorSetTab("layout");`);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-panel-layout").hidden;`), false, "the Layout tab is showing");
      assert.deepStrictEqual(await hint(), want);
      assert.strictEqual(await b.eval(`return !document.getElementById("editor-panels").contains(document.getElementById("editor-hint"));`), true, "the hint sits outside both panels");
    });

    test("menu: the ... button opens a menu with Redo, Remove note and Reset spacing; focus moves in, arrows move, Escape closes and returns focus", async () => {
      await setup(SCALE);
      const more = () => b.eval(`const e = document.getElementById("editor-more"); const q = e.getBoundingClientRect(); return { exp: e.getAttribute("aria-expanded"), pop: e.getAttribute("aria-haspopup"), w: q.width, h: q.height };`);
      let m = await more();
      assert.deepStrictEqual([m.exp, m.pop, m.w >= 44, m.h >= 44], ["false", "menu", true, true]);
      assert.strictEqual(await visible("editor-menu"), false);
      await b.click("#editor-more");
      assert.strictEqual(await visible("editor-menu"), true);
      assert.strictEqual((await more()).exp, "true");
      assert.deepStrictEqual(await b.eval(`return [...document.querySelectorAll("#editor-menu [role=menuitem]")].map((e) => e.id);`), ["editor-redo", "editor-remove", "editor-reset"]);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-menu").contains(document.activeElement);`), true, "focus moved in");
      await b.key("Escape", "Escape", 27);
      assert.strictEqual(await visible("editor-menu"), false);
      assert.strictEqual(await b.eval(`return document.activeElement.id;`), "editor-more");
      assert.strictEqual(await b.eval(`return !!document.getElementById("editor");`), true, "Escape closed the menu, not the editor");
    });

    test("menu: an outside tap closes it, and Tab closes it and returns focus to the button", async () => {
      await setup(SCALE);
      await b.click("#editor-more");
      await b.click("#editor-counts");
      assert.strictEqual(await visible("editor-menu"), false);
      await b.click("#editor-more");
      await b.key("Tab", "Tab", 9);
      assert.strictEqual(await visible("editor-menu"), false);
      assert.strictEqual(await b.eval(`return document.activeElement.id;`), "editor-more");
    });

    test("menu: Redo and Remove note act and close the menu; disabled items are aria-disabled and do nothing", async () => {
      await setup(SCALE);
      await b.click("#editor-more");
      assert.strictEqual(await b.eval(`return document.getElementById("editor-redo").getAttribute("aria-disabled");`), "true");
      assert.strictEqual(await b.eval(`return document.getElementById("editor-remove").getAttribute("aria-disabled");`), "true");
      await b.key("Escape", "Escape", 27);
      await hold("B");
      await place("rim");
      await clickUndo();
      assert.strictEqual(await zoneCount("rim"), "Rim 8/12");
      await b.click("#editor-redo");
      assert.strictEqual(await zoneCount("rim"), "Rim 9/12");
      assert.strictEqual(await visible("editor-menu"), false, "the pick closed the menu");
    });

    test("menu: Save is violet with white text at 4.5:1 or better, and Undo stays beside it on the toolbar", async () => {
      await setup(SCALE);
      const r = await b.eval(`const lum = (c) => { const v = c.match(/\\d+/g).slice(0, 3).map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
        const s = getComputedStyle(document.getElementById("editor-save")); const a = lum(s.backgroundColor), f = lum(s.color);
        return { bg: s.backgroundColor, ratio: (Math.max(a, f) + 0.05) / (Math.min(a, f) + 0.05), bar: [...document.querySelectorAll(".editor-toolbar > button")].map((e) => e.id) };`);
      assert.strictEqual(r.bg, "rgb(103, 86, 181)");
      assert.ok(r.ratio >= 4.5, "contrast " + r.ratio);
      assert.deepStrictEqual(r.bar, ["editor-undo", "editor-save", "editor-more"]);
    });

    test("menu: Delete is in the menu only on an edited scale; one press arms it, a press inside the 400ms guard does nothing, a second deletes", async () => {
      await fresh();
      await openAdd();
      await b.click("#editor-more");
      assert.strictEqual(await b.eval(`return !!document.getElementById("editor-delete");`), false, "none on a scale not yet saved");
      await b.key("Escape", "Escape", 27);
      await fresh();
      await openBuiltin();
      await b.click("#editor-more");
      assert.strictEqual(await b.eval(`return document.getElementById("editor-delete").textContent;`), "Delete scale");
      assert.strictEqual(await b.eval(`return !!document.querySelector("#editor-menu .menu-sep");`), true);
      await b.click("#editor-delete");
      assert.match(await b.eval(`return document.getElementById("editor-delete").textContent;`), /^Press again to delete /);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-delete").classList.contains("armed");`), true);
      assert.strictEqual(await visible("editor-menu"), true, "arming keeps the menu open");
      await b.eval(`editorDeleteTap(); return true;`);
      assert.strictEqual(await b.eval(`return editorSession.delArmed;`), true, "inside the guard a second press does nothing");
    });

    test("menu: an armed Delete disarms when the menu closes by Escape or an outside tap", async () => {
      await fresh();
      await openBuiltin();
      await b.click("#editor-more");
      await b.click("#editor-delete");
      await b.key("Escape", "Escape", 27);
      assert.strictEqual(await b.eval(`return editorSession.delArmed;`), false);
      await b.click("#editor-more");
      assert.strictEqual(await b.eval(`return document.getElementById("editor-delete").textContent;`), "Delete scale");
    });

    test("Sharps|Flats: one two-state control, Sharps by default; Flats flips the tray names and Sharps flips them back", async () => {
      await setup(SCALE);
      const state = () => b.eval(`return { s: document.getElementById("editor-sharps").getAttribute("aria-pressed"), f: document.getElementById("editor-flats").getAttribute("aria-pressed"), names: [...document.querySelectorAll(".tray-note")].map((e) => e.dataset.name).join(" ") };`);
      const before = await state();
      assert.deepStrictEqual([before.s, before.f], ["true", "false"]);
      await b.click("#editor-flats");
      const after = await state();
      assert.deepStrictEqual([after.s, after.f], ["false", "true"]);
      assert.notStrictEqual(after.names, before.names);
      assert.match(after.names, /b/);
      await b.click("#editor-sharps");
      assert.deepStrictEqual(await state(), before);
    });

    describe("swipe between Scale and Layout", () => {
      test("a left swipe on the Scale panel opens Layout and a right swipe returns", async () => {
        await setup(SCALE);
        await swipeBy(".editor-accidentals", -120);
        assert.strictEqual(await tabNow(), "layout");
        await swipeBy(".editor-palette-row", 120);
        assert.strictEqual(await tabNow(), "scale");
      });

      test("a swipe that starts on the tab strip, the counts row, the hint or the Layout panel switches tabs", async () => {
        await setup(SCALE);
        await swipeBy("#editor-tab-scale", -120);
        assert.strictEqual(await tabNow(), "layout", "tab strip");
        await swipeBy("#editor-panel-layout", 120);
        assert.strictEqual(await tabNow(), "scale", "Layout panel");
        await b.click("#editor-hint-toggle");
        await swipeBy("#editor-counts", -120);
        assert.strictEqual(await tabNow(), "layout", "counts row");
        await b.eval(`editorSetTab("scale"); return true;`);
        if (await visible("editor-hint")) {
          await swipeBy("#editor-hint", -120);
          assert.strictEqual(await tabNow(), "layout", "hint");
        }
      });

      test("a press held past the hold time is not a swipe, even when it then moves far and fast", async () => {
        await setup(SCALE);
        await b.drag(".editor-accidentals", [[-120, 300]]);
        assert.strictEqual(await tabNow(), "scale");
        await b.drag(".editor-accidentals", [[-120, 200]]);
        assert.strictEqual(await tabNow(), "layout", "the same move without the hold is a swipe");
      });

      test("with reduced motion the swipe cue does not slide, it only brightens when armed", async () => {
        await setup(SCALE);
        await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
        try {
          await b.drag(".editor-accidentals", [[-60, 60], [-120, 120]], { release: false });
          const cue = await b.eval(`const el = document.getElementById("scale-swipe-cue"); return { on: el.classList.contains("on"), transform: el.style.transform, opacity: el.style.opacity };`);
          assert.strictEqual(cue.on, true);
          assert.strictEqual(cue.transform, "");
          assert.strictEqual(cue.opacity, "1");
          await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        } finally {
          await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
        }
      });

      test("a short, slow or mostly vertical swipe changes nothing", async () => {
        await setup(SCALE);
        await swipeBy(".editor-accidentals", -30);
        assert.strictEqual(await tabNow(), "scale", "under 48px");
        await b.drag(".editor-accidentals", [[-60, 200], [-120, 800]]);
        assert.strictEqual(await tabNow(), "scale", "over 600ms");
        await swipeBy(".editor-accidentals", -80, 120, 70);
        assert.strictEqual(await tabNow(), "scale", "not twice as wide as tall");
      });

      test("a swipe that starts on the pan, a tray note or a text field does not switch tabs", async () => {
        await setup(SCALE);
        await swipeBy("#editor-pan", -120);
        assert.strictEqual(await tabNow(), "scale", "pan");
        await swipeBy(".tray-note", -120);
        assert.strictEqual(await tabNow(), "scale", "tray note");
        await b.eval(`const i = document.createElement("input"); i.id = "probe-input"; i.style.cssText = "display:block;width:100%;height:44px"; document.getElementById("editor-panel-scale").appendChild(i); i.scrollIntoView({ block: "center" }); return true;`);
        await swipeBy("#probe-input", -120);
        assert.strictEqual(await tabNow(), "scale", "text field");
      });

      test("a swipe does not switch tabs while a note is held or selected", async () => {
        await setup(SCALE);
        await hold("B");
        await swipeBy(".editor-accidentals", -120);
        assert.strictEqual(await tabNow(), "scale", "held");
        await b.eval(`editorSession.held = null; editorSession.sel = { ring: "rim", i: 0 }; editorRender(); return true;`);
        await swipeBy(".editor-accidentals", -120);
        assert.strictEqual(await tabNow(), "scale", "selected");
      });

      test("a swipe does not switch tabs while the line is being edited or a dialog is open", async () => {
        await setup(SCALE);
        await b.eval(`editorSession.editing = true; return true;`);
        await swipeBy(".editor-accidentals", -120);
        assert.strictEqual(await tabNow(), "scale", "editing");
        await b.eval(`editorSession.editing = false; editorSession.dialog = true; return true;`);
        await swipeBy(".editor-accidentals", -120);
        assert.strictEqual(await tabNow(), "scale", "dialog");
      });

      test("a swipe that starts within 24px of either screen edge is left to the browser", async () => {
        await setup(SCALE);
        const x = await b.eval(`const r = document.querySelector(".editor-accidentals").getBoundingClientRect(); return { left: r.left, w: window.innerWidth };`);
        const send = async (x0, dx) => {
          const y = await b.eval(`const r = document.querySelector(".editor-accidentals").getBoundingClientRect(); return r.top + r.height / 2;`);
          const t0 = Date.now() / 1000;
          const tp = (px) => [{ x: px, y, radiusX: 4, radiusY: 4, force: 1, id: 1 }];
          await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(x0), timestamp: t0 });
          await b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(x0 + dx), timestamp: t0 + 0.1 });
          await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], timestamp: t0 + 0.1 });
        };
        await send(x.w - 10, -150);
        assert.strictEqual(await tabNow(), "scale", "right edge");
        await b.eval(`editorSetTab("layout"); return true;`);
        await send(10, 150);
        assert.strictEqual(await tabNow(), "layout", "left edge");
      });

      test("a swipe does not switch tabs mid-drag and arms again once the drag ends", async () => {
        await setup(SCALE);
        await b.eval(`document.getElementById("editor").classList.add("dragging"); return true;`);
        await swipeBy(".editor-accidentals", -120);
        assert.strictEqual(await tabNow(), "scale", "dragging");
        await b.eval(`document.getElementById("editor").classList.remove("dragging"); return true;`);
        await swipeBy(".editor-accidentals", -120);
        assert.strictEqual(await tabNow(), "layout", "armed again once the drag ends");
      });
    });
  });

  describe("Editor RC W3 P1 panel areas", () => {
    const readPlay = () => b.eval(`const out = {}; for (const id of ["editor-tabs", "editor-panels", "editor-areas"]) { const c = getComputedStyle(document.getElementById(id)); out[id] = { vis: c.visibility, pe: c.pointerEvents, opacity: c.opacity, tr: c.transitionDuration }; } return out;`);
    const mark = (cls, on) => b.eval(`document.getElementById("editor").classList.${on ? "add" : "remove"}("${cls}"); return true;`);
    const open = async (w, h) => { await fresh(w, h); await openAdd(); await typeLine("(D3) A3 Bb3 C4 D4 E4 F4 G4"); };

    test("the tabs and both panels leave play with the rest of the controls while a note is dragged, and stop taking taps while it settles", async () => {
      await open(390, 844);
      await mark("dragging", true);
      await b.waitFor(`getComputedStyle(document.getElementById("editor-tabs")).visibility === "hidden"`, { label: "tabs hidden" });
      const drag = await readPlay();
      for (const id of Object.keys(drag)) assert.deepStrictEqual([drag[id].vis, drag[id].pe, drag[id].opacity], ["hidden", "none", "0"], id);
      await mark("dragging", false);
      await mark("settling", true);
      const settle = await readPlay();
      for (const id of Object.keys(settle)) assert.strictEqual(settle[id].pe, "none", id);
      await mark("settling", false);
      const rest = await readPlay();
      for (const id of Object.keys(rest)) assert.deepStrictEqual([rest[id].vis, rest[id].pe], ["visible", "auto"], id);
    });

    test("with reduced motion the tabs and panels do not animate in or out of play", async () => {
      await open(390, 844);
      await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      try {
        await mark("dragging", true);
        const drag = await readPlay();
        for (const id of Object.keys(drag)) assert.strictEqual(parseFloat(drag[id].tr), 0, id);
        await mark("dragging", false);
        const rest = await readPlay();
        for (const id of Object.keys(rest)) assert.strictEqual(parseFloat(rest[id].tr), 0, id);
      } finally {
        await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
      }
    });
  });

  describe("Editor RC N1 scale name", () => {
    const BOTTOMS = "[A2] [B2] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4";
    const nameIs = () => b.eval(`return document.getElementById("editor-name").value;`);
    const placeholder = () => b.eval(`return document.getElementById("editor-name").placeholder;`);
    const storedName = () => b.eval(`return editorSession.history.present.options.name || "";`);
    const steps = () => b.eval(`return editorSession.history.past.length;`);
    const typeName = (value) => b.eval(`const n = document.getElementById("editor-name"); n.focus(); n.value = ${JSON.stringify(value)};
      n.dispatchEvent(new Event("input", { bubbles: true })); return true;`);
    const typeNameNoBlur = async (value) => {
      await typeName(value);
      await b.eval(`document.getElementById("editor-name").onblur = null; return true;`);
    };
    const closed = () => b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the sheet to close" });
    const lastSaved = () => b.eval(`const e = savedState.entries[savedState.entries.length - 1]; return { id: e.instanceId, revision: e.revision, name: e.record.o && e.record.o.name, profile: !!(e.record.o && e.record.o.profile), deck: savedEntries.get(e.instanceId).deck.name };`);
    const reopenLast = async () => {
      await b.eval(`const view = allDeckViews().find((v) => savedEqual(v.selection, selection)); openEditSheet(view.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor on the saved scale" });
    };

    test("the name field leads the Scale panel and meets the phone input rules", async () => {
      await fresh(375, 667);
      await openAdd();
      const r = await b.eval(`const n = document.getElementById("editor-name"), panel = document.getElementById("editor-panel-scale"), c = getComputedStyle(n), box = n.getBoundingClientRect();
        return { first: panel.firstElementChild.firstElementChild === n, inTray: panel.querySelector("#editor-tray") !== null, size: parseFloat(c.fontSize), h: box.height, max: n.maxLength,
          aria: n.getAttribute("aria-label"), wide: box.width, stops: editorTabStops().indexOf(n) };`);
      assert.strictEqual(r.first, true, "the name is the first thing in the Scale panel");
      assert.ok(r.size >= 16, "font-size " + r.size + " must not zoom iOS");
      assert.ok(r.h >= 44, "height " + r.h);
      assert.strictEqual(r.max, 40);
      assert.strictEqual(r.aria, "Scale name");
      assert.ok(r.stops >= 0, "the name is a tab stop");
      assert.ok(r.wide > 200);
    });

    test("the placeholder is the auto name, the Neotone suffixed one on a Neotone scale, and empty on an empty scale", async () => {
      await fresh();
      await openAdd();
      assert.strictEqual(await placeholder(), "");
      await typeLine(BOTTOMS);
      const auto = await b.eval(`return editorAutoName(editorSession.history.present);`);
      assert.ok(auto.length > 0);
      const hint = (name) => b.eval(`return t("editor.name.auto", { name: ${JSON.stringify(name)} });`);
      assert.strictEqual(await placeholder(), await hint(auto));
      assert.strictEqual(await nameIs(), "", "the field itself stays blank until a name is typed");
      await b.click("#editor-type-neotone");
      const neo = await placeholder();
      assert.strictEqual(neo, await hint(auto + " Neotone Mutant"));
    });

    test("Enter commits the name as one Undo step, drops the keyboard, and Undo takes it back", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      const s0 = await steps();
      await typeName("My Kurd");
      assert.strictEqual(await storedName(), "", "nothing is committed while typing");
      await b.key("Enter", "Enter", 13);
      assert.strictEqual(await storedName(), "My Kurd");
      assert.strictEqual(await steps(), s0 + 1);
      assert.strictEqual(await b.eval(`return document.activeElement === document.getElementById("editor-name");`), false, "Enter ends the typing");
      assert.strictEqual(await b.eval(`return editorSession.naming;`), false);
      await clickUndo();
      assert.strictEqual(await storedName(), "");
      assert.strictEqual(await nameIs(), "");
    });

    test("leaving the field commits it, a blank restores the auto name, and the text is trimmed and capped at 40", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await typeName("  Padded  ");
      await b.click("#editor-line");
      assert.strictEqual(await storedName(), "Padded", "blur commits, trimmed");
      assert.strictEqual(await nameIs(), "Padded");
      await b.key("Escape", "Escape", 27);
      await typeName("Z".repeat(60));
      await b.eval(`document.getElementById("editor-name").blur(); return true;`);
      assert.strictEqual((await storedName()).length, 40);
      await typeName("   ");
      await b.eval(`document.getElementById("editor-name").blur(); return true;`);
      assert.strictEqual(await storedName(), "");
      assert.strictEqual(await nameIs(), "");
    });

    test("Escape in the field restores the stored name and does not close the editor or open the prompt", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await typeName("Keep");
      await b.key("Enter", "Enter", 13);
      await typeName("Throw away");
      await b.key("Escape", "Escape", 27);
      assert.strictEqual(await nameIs(), "Keep");
      assert.strictEqual(await storedName(), "Keep");
      assert.strictEqual(await sheetHidden(), false, "the editor stays open");
      assert.strictEqual(await dialogOpen(), false);
      assert.strictEqual(await b.eval(`return editorSession.naming;`), false);
    });

    test("type a name and tap Save at once: the saved name is the typed one, from one undo step", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await typeName("Raced Save");
      const past = await b.eval(`window.__past = null; const orig = editorSave;
        editorSave = function () { const r = orig.apply(this, arguments); window.__past = editorSession ? editorSession.history.past.length : -1; return r; };
        document.getElementById("editor-save").click(); return true;`);
      assert.strictEqual(past, true);
      await closed();
      const stepsAtSave = await b.eval(`return window.__past;`);
      const base = 1;
      assert.strictEqual(stepsAtSave, base + 1, "the typed scale and the name are one step each");
      const saved = await lastSaved();
      assert.strictEqual(saved.name, "Raced Save");
      assert.strictEqual(saved.deck, "Raced Save");
    });

    test("a press on the name field starts no drag", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      const r = await b.eval(`const n = document.getElementById("editor-name"), box = n.getBoundingClientRect();
        const src = editorDragSource({ target: n, clientX: box.left + 5, clientY: box.top + 5 });
        n.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 7, pointerType: "touch", clientX: box.left + 5, clientY: box.top + 5 }));
        const down = editorDrag;
        return { src, down };`);
      assert.strictEqual(r.src, null);
      assert.strictEqual(r.down, null);
    });

    test("while the name is being typed a tap or key on the pan changes nothing", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      const tryTap = (naming) => b.eval(`const s = editorSession; s.naming = ${naming}; s.sel = null;
        const el = document.querySelector("#editor-pan .ehit"), r = el.getBoundingClientRect();
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
        const tapped = !!s.sel; s.sel = null;
        const key = document.querySelector("#editor-pan [data-fk]");
        key.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
        return { tapped, keyed: !!s.sel };`);
      assert.deepStrictEqual(await tryTap(true), { tapped: false, keyed: false });
      assert.deepStrictEqual(await tryTap(false), { tapped: true, keyed: true }, "the same press selects once the name is committed");
      await b.eval(`editorSession.naming = false; return true;`);
    });

    test("Undo is not taken from the name field: while naming the editor refuses it, so the field undoes its own text", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await typeName("Typing");
      const during = await b.eval(`return editorUndoAllowed(editorSession, null);`);
      await b.key("Enter", "Enter", 13);
      const after = await b.eval(`return editorUndoAllowed(editorSession, null);`);
      assert.strictEqual(during, false);
      assert.strictEqual(after, true);
    });

    test("the two inputs hand over: starting the notes line commits the name, and focusing the name commits the notes line", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await typeNameNoBlur("Handover");
      await b.eval(`editorStartEdit(); return true;`);
      assert.strictEqual(await storedName(), "Handover", "the name was committed first");
      assert.deepStrictEqual(await b.eval(`return [editorSession.naming, editorSession.editing];`), [false, true]);
      await b.eval(`const l = document.getElementById("editor-line"); l.value = ${JSON.stringify(SCALE + " E5")}; document.getElementById("editor-name").dispatchEvent(new Event("focus")); return true;`);
      assert.deepStrictEqual(await b.eval(`return [editorSession.naming, editorSession.editing];`), [true, false]);
      assert.match(await text(), /E5/, "the notes line was committed on the hand-over");
      await b.eval(`editorSession.naming = false; return true;`);
    });

    test("Back, the ... button and the dialog save all commit a pending name first", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await typeNameNoBlur("Via menu");
      await b.eval(`document.getElementById("editor-more").click(); return true;`);
      assert.strictEqual(await storedName(), "Via menu", "the menu opener committed it");
      await b.eval(`editorCloseMenu(false); return true;`);
      await typeNameNoBlur("Via back");
      await b.eval(`document.getElementById("editor-back").click(); return true;`);
      assert.strictEqual(await storedName(), "Via back");
      assert.strictEqual(await dialogOpen(), true, "a name change alone is a change to keep or discard");
      await b.click("#editor-dlg-save");
      await closed();
      assert.strictEqual((await lastSaved()).name, "Via back");
    });

    test("a name change alone makes the editor dirty, and clearing it again makes it clean", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-save");
      await closed();
      await reopenLast();
      assert.strictEqual(await b.eval(`return editorIsDirty(editorSession.base, editorSession.history.present);`), false);
      await typeName("Different");
      await b.key("Enter", "Enter", 13);
      assert.strictEqual(await b.eval(`return editorIsDirty(editorSession.base, editorSession.history.present);`), true);
      await typeName("");
      await b.key("Enter", "Enter", 13);
      assert.strictEqual(await b.eval(`return editorIsDirty(editorSession.base, editorSession.history.present);`), false);
      await b.click("#editor-back");
      await closed();
    });

    test("Discard in the dialog drops a name change", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await typeName("Never saved");
      await b.eval(`document.getElementById("editor-back").click(); return true;`);
      assert.strictEqual(await dialogOpen(), true);
      const before = await savedCount();
      await b.click("#editor-dlg-discard");
      await closed();
      assert.strictEqual(await savedCount(), before);
    });

    test("a name saves on create and on update, reopens in the field, and a blank save returns to the auto name", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await typeName("Round trip");
      await b.key("Enter", "Enter", 13);
      await b.click("#editor-save");
      await closed();
      const created = await lastSaved();
      assert.strictEqual(created.name, "Round trip");
      assert.strictEqual(created.deck, "Round trip");
      assert.strictEqual(await b.eval(`return location.hash === routeFor(deck());`), true, "the address is the app's own route for the selection");
      await reopenLast();
      assert.strictEqual(await nameIs(), "Round trip");
      await typeName("Renamed");
      await b.key("Enter", "Enter", 13);
      await b.click("#editor-save");
      await closed();
      const updated = await lastSaved();
      assert.strictEqual(updated.id, created.id, "an update keeps the handle");
      assert.ok(updated.revision > created.revision);
      assert.strictEqual(updated.name, "Renamed");
      await reopenLast();
      await typeName("");
      await b.key("Enter", "Enter", 13);
      await b.click("#editor-save");
      await closed();
      const blank = await lastSaved();
      assert.ok(!blank.name, "a blank name stores nothing");
      assert.ok(blank.deck.length > 0 && blank.deck !== "Renamed", "the deck falls back to its auto name");
    });

    test("a new Neotone scale stores the suffixed auto name, an edited name is stored verbatim, and a blanked one stores nothing", async () => {
      await fresh();
      await openAdd();
      await typeLine(BOTTOMS);
      await b.click("#editor-type-neotone");
      const shown = await b.eval(`return editorAutoName(editorSession.history.present);`);
      assert.strictEqual(await placeholder(), await b.eval(`return t("editor.name.auto", { name: ${JSON.stringify(shown)} });`));
      await b.click("#editor-save");
      await closed();
      const seeded = await lastSaved();
      assert.strictEqual(seeded.profile, true);
      assert.strictEqual(seeded.name, shown, "seeded with exactly what the field showed");
      assert.match(seeded.name, / Neotone Mutant$/);
      await reopenLast();
      assert.strictEqual(await nameIs(), shown, "reopened with the stored name");
      await typeName("Mine");
      await b.key("Enter", "Enter", 13);
      await b.click("#editor-save");
      await closed();
      assert.strictEqual((await lastSaved()).name, "Mine");
      await fresh();
      await openAdd();
      await typeLine(BOTTOMS);
      await b.click("#editor-type-neotone");
      await typeName("Typed then blanked");
      await b.key("Enter", "Enter", 13);
      await typeName("");
      await b.key("Enter", "Enter", 13);
      await b.click("#editor-save");
      await closed();
      const blank = await lastSaved();
      assert.strictEqual(blank.profile, true);
      assert.ok(!blank.name, "a blank the user chose is not re-seeded");
    });

    test("TRI59d A2: on Neotone, with and without mutant notes, both anchor buttons are shown and enabled, aria-pressed follows, and between turns the pan", async () => {
      const NEO_LINE = "[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4";
      const MUTANT_LINE = "[C3] [Db3] [Eb3] (F3) G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 [Ab5]";
      for (const line of [NEO_LINE, MUTANT_LINE]) {
        await fresh();
        await openAdd();
        await typeLine(line);
        await b.click("#editor-type-neotone");
        await b.click("#editor-tab-layout");
        const read = () => b.eval(`const g = (id) => document.getElementById(id);
          return { shown: ["editor-anchor-one", "editor-anchor-between"].map((id) => !g(id).hidden && g(id).offsetParent !== null),
            off: ["editor-anchor-one", "editor-anchor-between"].map((id) => g(id).disabled || g(id).hasAttribute("aria-disabled")),
            pressed: ["editor-anchor-one", "editor-anchor-between"].map((id) => g(id).getAttribute("aria-pressed")),
            anchor: editorSession.history.present.options.anchor || "one",
            turn: editorSolve(editorSession.history.present).value.geom.turn || 0,
            map: editorSession.history.present.options.profile.map.slice() };`);
        const before = await read();
        assert.deepStrictEqual([before.shown, before.off, before.pressed], [[true, true], [false, false], ["true", "false"]], line);
        await b.click("#editor-anchor-between");
        const after = await read();
        assert.deepStrictEqual([after.shown, after.off, after.pressed, after.anchor], [[true, true], [false, false], ["false", "true"], "between"], line);
        assert.deepStrictEqual(after.map, before.map, "the arrangement is untouched");
        if (line === MUTANT_LINE) assert.deepStrictEqual([before.turn, after.turn, (await (async () => { await b.click("#editor-anchor-one"); return (await read()).turn; })())], [0, 20, 0], "between turns a pan with mutants");
        if (line === MUTANT_LINE) await b.click("#editor-anchor-between");
        await b.click("#editor-anchor-one");
        const back = await read();
        assert.deepStrictEqual([back.pressed, back.anchor], [["true", "false"], "one"], line);
      }
    });

    test("TRI59d A2: Pygmy to Neotone with between, SAVE writes record 7", async () => {
      await fresh();
      await openAdd();
      await typeLine("[C3] [Db3] [Eb3] (F3) G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 [Ab5]");
      await b.click("#editor-tab-layout");
      await b.click("#editor-anchor-between");
      await b.click("#editor-type-neotone");
      assert.strictEqual(await b.eval(`return editorSession.history.present.options.anchor;`), "between", "the pan type switch carries between");
      assert.strictEqual(await b.eval(`return editorCommitOptions(editorSession.history.present).anchor;`), "between");
    });

    test("PLa-N2: with no notes both anchor buttons are disabled on each pan type, and with notes they are enabled on Standard", async () => {
      await fresh();
      await openAdd();
      const state = () => b.eval(`return ["editor-anchor-one", "editor-anchor-between"].map((id) => document.getElementById(id).disabled);`);
      assert.deepStrictEqual(await state(), [true, true], "an empty scale");
      await typeLine(SCALE);
      assert.deepStrictEqual(await state(), [false, false], "a scale with notes");
      await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => editorCommitText(m, "")).history; editorRender(); return true;`);
      assert.deepStrictEqual(await state(), [true, true], "back to empty");
    });

    test("empty Neotone anchors: on an empty Neotone pan both anchor buttons are disabled, and they enable once a main note is placed", async () => {
      await fresh();
      await openAdd();
      await b.click("#editor-type-neotone");
      const state = () => b.eval(`return ["editor-anchor-one", "editor-anchor-between"].map((id) => document.getElementById(id).disabled);`);
      assert.deepStrictEqual(await state(), [true, true], "an empty Neotone pan");
      await typeLine("[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4");
      assert.deepStrictEqual(await state(), [false, false], "a Neotone pan with notes");
    });
  });

  describe("Editor RC W5a quieter tab, error banner, name field", () => {
    const RIM12 = "A3 Bb3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5";
    const FULL = "(D3) " + RIM12 + " | C6";
    const setup = async (line, w = 375, h = 667) => { await fresh(w, h); await openAdd(); await typeLine(line); };
    const pause = (ms) => new Promise((done) => setTimeout(done, ms));
    const refuse = async () => {
      await b.click('.tray-note[data-name="F"]');
      await b.click("#editor-oct-up");
      await b.eval(`editorPlaceHeld({ kind: "spot", ring: "rim" }, editorSession.history.present); return true;`);
      await b.waitFor(`document.getElementById("editor-status").getAttribute("data-kind") === "error"`, { label: "the refusal" });
    };
    const rect = (sel) => b.eval(`const q = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { top: q.top, bottom: q.bottom, left: q.left, right: q.right, height: q.height };`);
    const style = (sel, props) => b.eval(`const c = getComputedStyle(document.querySelector(${JSON.stringify(sel)})); return ${JSON.stringify(props)}.map((p) => c[p]);`);

    test("ETS: the selected tab is not filled: underline and strong text on it, muted text on the other, no .on class, no fill on hover or press", async () => {
      await setup(SCALE);
      for (const sel of ["scale", "layout"]) {
        if (sel === "layout") await b.click("#editor-tab-layout");
        const other = sel === "scale" ? "layout" : "scale";
        const [bg, under, color, classes, weight] = await b.eval(`const c = getComputedStyle(document.getElementById("editor-tab-${sel}"));
          return [c.backgroundColor, c.borderBottomColor, c.color, document.getElementById("editor-tab-${sel}").className, c.fontWeight];`);
        assert.strictEqual(bg, "rgba(0, 0, 0, 0)", sel + " selected tab has no fill");
        assert.strictEqual(under, "rgb(103, 86, 181)", sel + " underline");
        assert.strictEqual(color, "rgb(36, 36, 36)");
        assert.strictEqual(weight, "600");
        assert.ok(!classes.split(" ").includes("on"), sel + " carries no .on: " + classes);
        const [obg, ounder, ocolor] = await b.eval(`const c = getComputedStyle(document.getElementById("editor-tab-${other}")); return [c.backgroundColor, c.borderBottomColor, c.color];`);
        assert.strictEqual(obg, "rgba(0, 0, 0, 0)");
        assert.strictEqual(ounder, "rgba(0, 0, 0, 0)");
        assert.strictEqual(ocolor, "rgb(94, 88, 80)", "the unselected tab is muted");
      }
      const at = await b.eval(`const q = document.getElementById("editor-tab-scale").getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 };`);
      await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...at });
      assert.strictEqual((await style("#editor-tab-scale", ["backgroundColor"]))[0], "rgba(0, 0, 0, 0)", "no fill on hover");
      await b.send("Input.dispatchMouseEvent", { type: "mousePressed", ...at, button: "left", clickCount: 1 });
      assert.strictEqual((await style("#editor-tab-scale", ["backgroundColor"]))[0], "rgba(0, 0, 0, 0)", "no fill while pressed");
      await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...at, button: "left", clickCount: 1 });
    });

    test("EMP: the status line sits between the pan and the counts, within 16px of the pan, and stays in view with no scroll at 375x667 and 320x568", async () => {
      for (const [w, h] of [[375, 667], [320, 568]]) {
        await setup(FULL, w, h);
        await refuse();
        const r = await b.eval(`const pb = document.querySelector("#editor .editor-panbox"); const st = document.getElementById("editor-status");
          const de = document.documentElement, ed = document.getElementById("editor");
          const row = st.parentNode;
          return { order: pb.nextElementSibling === row && row.className === "editor-statusrow" && row.nextElementSibling.id === "editor-areas", gap: st.getBoundingClientRect().top - pb.getBoundingClientRect().bottom,
            inView: st.getBoundingClientRect().top >= 0 && st.getBoundingClientRect().bottom <= ${h} && st.getBoundingClientRect().right <= ${w},
            page: de.scrollHeight === ${h} && de.scrollWidth === ${w}, panel: ed.scrollHeight <= ed.clientHeight && ed.scrollWidth <= ed.clientWidth };`);
        assert.strictEqual(r.order, true, w + " DOM order");
        assert.ok(r.gap >= -0.5 && r.gap <= 16, w + " gap " + r.gap);
        assert.deepStrictEqual([r.inView, r.page, r.panel], [true, true, true], w + " " + JSON.stringify(r));
      }
    });

    test("EMP: landscape 1280x800 puts the status in the right column between the line and the counts", async () => {
      await setup(FULL, 1280, 800);
      await refuse();
      await b.click("#editor-hint-toggle");
      const r = await b.eval(`const q = (s) => document.querySelector(s).getBoundingClientRect(); const pan = q("#editor .editor-panbox"), st = q("#editor-status");
        return { right: st.left >= pan.right - 1, belowLine: st.top >= q("#editor-line").bottom - 1, aboveCounts: st.bottom <= q("#editor-areas").top + 1, aboveTabs: st.bottom <= q("#editor-tabs").top + 1 };`);
      assert.deepStrictEqual(r, { right: true, belowLine: true, aboveCounts: true, aboveTabs: true });
    });

    test("EMP: an error is an ink banner at 14px and a notice is plain text", async () => {
      await setup(FULL);
      await refuse();
      const [bg, color, size] = await style("#editor-status", ["backgroundColor", "color", "fontSize"]);
      assert.deepStrictEqual([bg, color, size], ["rgb(36, 36, 36)", "rgb(255, 255, 255)", "14px"]);
      assert.deepStrictEqual(await style("#editor-status", ["cursor", "borderTopLeftRadius"]), ["auto", "8px"]);
      const wide = await b.eval(`const q = document.getElementById("editor-status").getBoundingClientRect(), e = document.querySelector("#editor .editor-statusrow").getBoundingClientRect(); return q.width / e.width > 0.8;`);
      assert.strictEqual(wide, true, "full-width banner");
      await b.eval(`editorSession.error = ""; editorSession.held = null; editorSession.say = "Pins reset."; editorSession.plainSay = "Pins reset."; editorRender(); return true;`);
      assert.strictEqual((await style("#editor-status", ["backgroundColor"]))[0], "rgba(0, 0, 0, 0)", "a notice has no banner");
    });

    test("EMP: the arrival cue replays for a different error, not for a re-render of the same one, and again after a clear", async () => {
      await setup(FULL);
      const arrive = () => b.eval(`return document.getElementById("editor-status").classList.contains("arrive");`);
      const strip = () => b.eval(`document.getElementById("editor-status").classList.remove("arrive"); return true;`);
      const say = (text) => b.eval(`editorSession.error = ${JSON.stringify(text)}; editorRender(); return true;`);
      await say("First error.");
      assert.strictEqual(await arrive(), true, "first error arrives");
      await strip();
      await say("First error.");
      assert.strictEqual(await arrive(), false, "an unchanged re-render does not replay");
      await say("Second error.");
      assert.strictEqual(await arrive(), true, "a different error replays");
      await strip();
      await say("");
      await say("Second error.");
      assert.strictEqual(await arrive(), true, "the same text after a clear replays");
      assert.notStrictEqual((await style("#editor-status", ["animationName"]))[0], "none");
    });

    test("EMP: no arrival animation under reduced motion", async () => {
      await setup(FULL);
      await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
      try {
        await b.eval(`editorSession.error = "Reduced."; editorRender(); return true;`);
        assert.strictEqual((await style("#editor-status", ["animationName"]))[0], "none");
      } finally {
        await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
      }
    });

    for (const [w, h, key] of [[320, 568, "editor.full.rim"], [375, 667, "editor.crowded"]]) {
      test(`EMP: a two-line German error does not move the pan at ${w}x${h} or overflow sideways`, async () => {
        await setup(FULL, w, h);
        await b.eval(`const e = document.getElementById("lang-select"); e.value = "de"; e.dispatchEvent(new Event("change", { bubbles: true })); return true;`);
        await b.waitFor(`document.documentElement.lang === "de"`, { label: "German" });
        await b.eval(`editorRender(); return true;`);
        const before = await rect("#editor .editor-panbox");
        const long = await b.eval(`return I18N.de[${JSON.stringify(key)}].replace("{max}", "12");`);
        await b.eval(`editorSession.error = ${JSON.stringify(long)}; editorRender(); return true;`);
        const lines = await b.eval(`const st = document.getElementById("editor-status"); return Math.round((st.getBoundingClientRect().height - 8) / 20);`);
        assert.ok(lines >= 1);
        const after = await rect("#editor .editor-panbox");
        assert.ok(Math.abs(after.height - before.height) <= 1, `pan height ${before.height} -> ${after.height} (${lines} lines)`);
        assert.deepStrictEqual(await b.eval(`const ed = document.getElementById("editor"), st = document.getElementById("editor-status"); return [ed.scrollWidth <= ed.clientWidth, st.scrollWidth <= st.clientWidth + 1];`), [true, true]);
      });
    }

    for (const w of [375, 390]) {
      test(`SC ${w} wide: a two-line German error fits the status row without clipping, and the status row keeps its height`, async () => {
        await setup(FULL, w, 700);
        await b.eval(`const e = document.getElementById("lang-select"); e.value = "de"; e.dispatchEvent(new Event("change", { bubbles: true })); return true;`);
        await b.waitFor(`document.documentElement.lang === "de"`, { label: "German" });
        await b.eval(`editorRender(); return true;`);
        const row = () => b.eval(`const r = document.querySelector("#editor .editor-statusrow").getBoundingClientRect(), st = document.getElementById("editor-status"); return { h: r.height, sh: st.scrollHeight, ch: st.clientHeight, sth: st.getBoundingClientRect().height };`);
        const before = await row();
        const long = await b.eval(`return I18N.de["editor.crowded"].replace("{max}", "12");`);
        await b.eval(`editorSession.error = ${JSON.stringify(long)}; editorRender(); return true;`);
        const after = await row();
        assert.ok(after.sth >= 48 - 1 && after.sth > 40, "the banner holds two lines: " + JSON.stringify(after));
        assert.ok(after.sh <= after.ch + 1, "no clipped text: " + JSON.stringify(after));
        assert.strictEqual(after.h, before.h, "the status row does not grow: " + JSON.stringify([before, after]));
      });
    }

    describe("live drag", () => {
      before(() => { magPinned = false; });
      after(() => { magPinned = true; });
      const touch = (type, pt) => b.send("Input.dispatchTouchEvent", { type, touchPoints: pt ? [{ x: pt.x, y: pt.y, id: 1 }] : [] });
      test("EMP: mid-drag at 390x844 the scaled pan box does not cover the status, which stays the top hit", async () => {
        await setup(SCALE, 390, 844);
        const chip = await b.eval(`const r = document.querySelector('.tray-note[data-name="B"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
        const to = await b.eval(`const r = document.querySelector('#editor-pan .ehit[data-ring="rim"][data-i="0"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
        await touch("touchStart", chip);
        for (const k of [0.15, 0.3]) await touch("touchMove", { x: chip.x + (to.x - chip.x) * k, y: chip.y + (to.y - chip.y) * k });
        await pause(500);
        try {
          const r = await b.eval(`const pb = document.querySelector("#editor .editor-panbox").getBoundingClientRect(), st = document.getElementById("editor-status"), sq = st.getBoundingClientRect();
            const hit = document.elementFromPoint(sq.left + sq.width / 2, sq.top + sq.height / 2);
            return { dragging: document.getElementById("editor").classList.contains("dragging"), mag: parseFloat(getComputedStyle(document.querySelector("#editor .editor-panbox")).getPropertyValue("--ed-mag")) || 1,
              overlap: pb.bottom > sq.top + 0.5, hit: hit === st || st.contains(hit), text: st.textContent };`);
          assert.strictEqual(r.dragging, true);
          assert.ok(r.mag > 1.05, "the pan did grow: " + r.mag);
          assert.strictEqual(r.overlap, false, "the pan box ends above the status: " + JSON.stringify(r));
          assert.strictEqual(r.hit, true);
          assert.match(r.text, /Dragging/);
        } finally {
          await touch("touchEnd");
          await pause(400);
        }
      });
    });

    test("N-b: focusing the scale name keeps half-typed, invalid notes text in the notes field", async () => {
      await setup(SCALE);
      await b.click("#editor-line");
      await b.eval(`const l = document.getElementById("editor-line"); l.value = "A3 Bb3 C4 QQ9"; l.dispatchEvent(new Event("input", { bubbles: true })); return true;`);
      await b.click("#editor-name");
      assert.strictEqual(await b.eval(`return document.getElementById("editor-line").value;`), "A3 Bb3 C4 QQ9", "the typed text survives");
      assert.strictEqual(await b.eval(`return editorSession.editing;`), true, "still editing");
      await b.eval(`document.getElementById("editor-line").value = ${JSON.stringify(SCALE)}; return true;`);
      await b.click("#editor-line");
      await b.key("Enter", "Enter", 13);
      assert.strictEqual(await b.eval(`return editorSession.editing;`), false);
      assert.strictEqual(await text(), SCALE, "a valid text still commits");
    });
  });

  describe("Editor RC I1 fit probe, absolute mode", () => {
    test("panel_fit --absolute: the editor cell runs for ja and de at 375 and 320 and reports no failure", async () => {
      const pf = require("../tools/probe/panel_fit.js");
      const r = await pf.runEditorAbsolute({ html: fs.readFileSync(path.join(REPO, "index.html"), "utf8"), fontMode: "fallback", langs: ["ja", "de"], log: () => {} });
      assert.strictEqual(r.rows.length, 2 * pf.EDITOR_CELLS.length * 2, "lang x cell x profile");
      assert.deepStrictEqual(r.failures, []);
      assert.ok(r.panelH > 100 && r.panelH < 400, "the panel height measurement is a real number: " + r.panelH);
    });
  });

  describe("Editor pan size (TRI-59 pan lane)", () => {
    const rects = (w, h) => b.eval(`const q = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height }; };
      const de = document.documentElement, ed = document.getElementById("editor"), rg = document.getElementById("editor-region");
      return { svg: q("#editor-pan svg"), box: q(".editor-panbox"), bar: q(".editor-toolbar"), tray: q("#editor-tray"), name: q("#editor-name"), tabs: q("#editor-tabs"),
        page: de.scrollHeight === ${h} && de.scrollWidth === ${w}, panel: ed.scrollHeight <= ed.clientHeight && ed.scrollWidth <= ed.clientWidth,
        grid: getComputedStyle(ed).display === "grid", region: rg ? { top: rg.getBoundingClientRect().top, h: rg.clientHeight, sh: rg.scrollHeight, st: rg.scrollTop, oy: getComputedStyle(rg).overflowY } : null };`);
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));
    const open = async (w, h) => { await fresh(w, h); await openBuiltin(); await b.waitFor(`document.querySelector("#editor-pan svg")`, { label: "the pan svg" }); await pause(250); };

    const STACKED = [[390, 844, 321], [430, 932, 355], [375, 667, 309],
      [360, 640, 296], [375, 548, 274], [320, 568, 262], [768, 1024, 480]];
    for (const [w, h, diameter] of STACKED) {
      test(`P0 ${w}x${h}: the full rim has its designed size with no page scroll and pinned actions`, async () => {
        await open(w, h);
        await b.click("#drawerexp-handle");
        await b.waitFor('drawerExperiment.state === "SHUT"', { label: "the drawer to clear the whole rim" });
        const r = await b.eval(`const shell = document.querySelector('#editor-pan svg > circle[r="100"]').getBoundingClientRect();
          const handle = editorEl("drawerexp-handle").getBoundingClientRect();
          const bar = editorEl("editor-save").getBoundingClientRect();
          const de = document.documentElement;
          return { w: shell.width, h: shell.height, full: shell.left >= 0 && shell.right <= innerWidth &&
            shell.top >= 0 && shell.bottom <= handle.top + 1, scrolls: de.scrollWidth > innerWidth || de.scrollHeight > innerHeight,
            save: editorEl("editor-save").contains(document.elementFromPoint(bar.x + bar.width / 2, bar.y + bar.height / 2)) };`);
        assert.ok(Math.abs(r.w - r.h) < 1 && Math.abs(r.h - diameter) <= diameter * 0.05, JSON.stringify(r));
        assert.ok(r.full && !r.scrolls && r.save, JSON.stringify(r));
      });
    }

    test("QA1 every editor input with placeholder text paints it lighter than typed text, in main's drawer placeholder grey (#8A847B)", async () => {
      await open(390, 844);
      const r = await b.eval(`const out = [];
        for (const el of document.querySelectorAll("#editor input, #editor textarea")) {
          if (!el.placeholder) continue;
          out.push({ id: el.id, ph: getComputedStyle(el, "::placeholder").color, ink: getComputedStyle(el).color, op: getComputedStyle(el, "::placeholder").opacity });
        }
        return out;`);
      assert.ok(r.some((x) => x.id === "editor-name"), "the name field carries a placeholder: " + JSON.stringify(r));
      for (const x of r) {
        assert.notStrictEqual(x.ph, x.ink, x.id + " placeholder must differ from typed text");
        assert.strictEqual(x.ph, "rgb(138, 132, 123)", x.id + " placeholder colour");
        assert.strictEqual(x.op, "1", x.id + " placeholder opacity");
      }
    });

    test("QA1 design parity with main's drawer: muted text is #5E5850 and a disabled control is grey ink on the sheet ground at full opacity", async () => {
      await open(390, 844);
      const r = await b.eval(`const c = (s, p) => getComputedStyle(document.querySelector(s))[p];
        return { undoOff: document.getElementById("editor-undo").disabled, tab: c("#editor-tab-layout", "color"), label: c("#editor-palette-label", "color"),
          op: c("#editor-undo", "opacity"), ink: c("#editor-undo", "color"), bg: c("#editor-undo", "backgroundColor") };`);
      assert.strictEqual(r.undoOff, true, "undo starts disabled");
      assert.strictEqual(r.tab, "rgb(94, 88, 80)", "inactive tab muted ink");
      assert.strictEqual(r.label, "rgb(94, 88, 80)", "palette label muted ink");
      assert.strictEqual(r.op, "1", "disabled controls are not faded a second time");
      assert.strictEqual(r.ink, "rgb(138, 132, 123)", "disabled ink");
      assert.strictEqual(r.bg, "rgb(246, 244, 237)", "disabled ground");
    });

    test("QA1 390x844: at least 12px between the tab strip and the first row on both tabs", async () => {
      await open(390, 844);
      const gap = (first) => b.eval(`const t = document.getElementById("editor-tabs").getBoundingClientRect(), f = document.querySelector(${JSON.stringify(first)}).getBoundingClientRect(); return f.top - t.bottom;`);
      const scale = await gap("#editor-name");
      assert.ok(scale >= 12 - 0.01, "scale tab gap " + scale);
      await b.click("#editor-tab-layout");
      const layout = await gap("#editor-layout");
      assert.ok(layout >= 12 - 0.01, "layout tab gap " + layout);
    });

    test("P0 guards: 1280x800 keeps its grid pan (574) and 375x360, 360x330 and 540x400 stay stacked with a pan of at least 120", async () => {
      await open(1280, 800);
      let r = await rects(1280, 800);
      assert.ok(r.grid && Math.min(r.svg.w, r.svg.h) >= 0.95 * 574 && Math.min(r.svg.w, r.svg.h) <= 574 + 2, "1280x800 grid pan " + r.svg.h);
      for (const [w, h] of [[375, 360], [360, 330], [540, 400]]) {
        await open(w, h);
        r = await rects(w, h);
        assert.strictEqual(r.grid, false, `${w}x${h} stays stacked`);
        assert.ok(r.svg.h >= 120 - 1, `${w}x${h} pan ${r.svg.h}`);
        assert.ok(r.page && r.bar.top >= 0 && r.bar.bottom <= h, `${w}x${h} toolbar in view, no page scroll`);
      }
    });

    for (const [w, h, target] of [[926, 428, 347], [844, 390, 309], [667, 375, 294], [568, 320, 206]]) {
      test(`P0 phone landscape ${w}x${h}: the pan does not collapse (>= 0.95 x ${target}), the grid is on, tabs in view, toolbar reachable, controls scroll as one column (#editor, LS 2026-11-15)`, async () => {
        await open(w, h);
        const r = await rects(w, h);
        assert.ok(r.grid, "two-column grid");
        assert.ok(r.svg.h >= 0.95 * target && r.svg.h >= 200, `drawn pan ${r.svg.h}`);
        assert.ok(r.page, "no page scroll");
        assert.ok(r.tabs.top >= 0 && r.tabs.bottom <= h, "tabs in view at rest");
        await b.eval(`document.querySelector("#editor .editor-toolbar").scrollIntoView({ block: "nearest" }); return true;`);
        const bar = await b.eval(`const r = document.querySelector("#editor .editor-toolbar").getBoundingClientRect(); return { top: r.top, bottom: r.bottom };`);
        assert.ok(bar.top >= 0 && bar.bottom <= h, "the toolbar is in view once scrolled to: " + JSON.stringify(bar));
        assert.ok(r.region && r.region.oy === "visible" && r.region.h > 0 && r.region.st === 0, "the region no longer scrolls: " + JSON.stringify(r.region));
        assert.strictEqual(await b.eval(`return getComputedStyle(document.getElementById("editor")).overflowY;`), "auto", "the column scrolls as one box");
        assert.ok(r.svg.right <= r.tabs.left + 1 || r.svg.left >= r.tabs.right - 1, "the pan and the controls do not overlap");
      });
    }

    test("P0 landscape phone: no magnification when a note is dragged (the pan already reaches the editor bottom)", async () => {
      await open(844, 390);
      const before = await rects(844, 390);
      assert.ok(before.svg.h >= 0.95 * 309);
      const mag = await b.eval(`return editorDragMeasure();`);
      assert.ok(mag <= 1.02, "magnification " + mag);
    });

    test("P0 region: the controls scroll inside #editor-region, the tab strip stays pinned, the region rests with the name clear of the strip, and the page does not scroll", async () => {
      await open(375, 548);
      const r = await rects(375, 548);
      assert.ok(r.region && r.region.oy === "auto" && r.region.sh > r.region.h, "375x548 region overflows: " + JSON.stringify(r.region));
      const rest = await b.eval(`const rg = document.getElementById("editor-region"), n = document.getElementById("editor-name").getBoundingClientRect(), t = document.getElementById("editor-tabs").getBoundingClientRect();
        return { rest: editorRegionRest(rg), clear: n.top >= t.bottom - 0.5 };`);
      assert.ok(Math.abs(r.region.st - rest.rest) <= 1 && r.region.st < r.region.sh - r.region.h && rest.clear, "rests short of its end with the name clear of the strip: " + JSON.stringify([r.region, rest]));
      assert.ok(r.tray.top >= r.region.top && r.tray.top < r.bar.top, "the tray starts in view at rest");
      assert.strictEqual(await b.eval(`return getComputedStyle(document.getElementById("editor-tabs")).position;`), "sticky");
      assert.ok(Math.abs(r.tabs.top - r.region.top) <= 1, "the strip is pinned at the region top");
      assert.ok(r.page && r.panel, "neither the page nor #editor scrolls");
      await b.click("#editor-tab-layout");
      await pause(100);
      const l = await rects(375, 548);
      assert.strictEqual(l.region.st, 0, "a tab switch opens the chosen panel from the top of the region");
    });

    const openPlacementHelp = async () => {
      await b.click("#editor-more");
      await b.click("#editor-placement-help");
      await b.waitFor('drawerExperiment.expanded && !document.getElementById("editor-areas").hidden',
        { label: "Placement help to open over its drawer" });
    };
    const drawerHits = () => b.eval(`
      const hits = (node, x, y) => node.contains(document.elementFromPoint(x, y));
      const center = id => {
        const node = document.getElementById(id), r = node.getBoundingClientRect();
        return r.width >= 1 && r.height >= 1 && hits(node, r.x + r.width / 2, r.y + r.height / 2);
      };
      const tabs = [...document.querySelectorAll("#editor-tabs [role=tab]")].map(node => {
        const r = node.getBoundingClientRect();
        return hits(node, r.right - 2, r.y + r.height / 2);
      });
      return { tabs, rail: ["editor-undo", "editor-save", "editor-more"].map(center),
        info: document.getElementById("editor-hint-toggle").getClientRects().length };
    `);

    for (const [w, h] of [[390, 844], [390, 664], [375, 667], [360, 640], [320, 568], [667, 375], [844, 390]]) {
      test(`QA3 drawer controls ${w}x${h}: both tab edges and Name remain reachable with no info bleed`, async () => {
        await open(w, h);
        assert.deepEqual(await drawerHits(), { tabs: [true, true], rail: [true, true, true], info: 0 });
        await b.click("#editor-tab-layout");
        assert.equal(await b.eval("return editorSession.tab;"), "layout");
        assert.deepEqual(await drawerHits(), { tabs: [true, true], rail: [true, true, true], info: 0 });
        await b.click("#editor-tab-scale");
        await b.click("#editor-name");
        assert.equal(await b.eval("return document.activeElement.id;"), "editor-name");
        await b.click("#drawerexp-handle");
        await b.waitFor('drawerExperiment.state === "SHUT"', { label: "the drawer to collapse" });
        const closed = await drawerHits();
        assert.equal(closed.info, 0);
        assert.deepEqual(closed.rail, [true, true, true]);
        assert.ok(await b.eval('return document.getElementById("drawerexp-body").inert;'));
      });
    }

    for (const [w, h] of [[390, 844], [390, 664], [375, 667], [360, 640]]) {
      test(`P0 Placement help ${w}x${h}: the overlay preserves frame and pinned rail, and dismissal restores More focus`, async () => {
        await open(w, h);
        const frame = () => b.eval(`
          return ["#editor-pan svg", "#editor-tabs", "#editor-name", "#editor-tray", ".editor-toolbar"].map(sel => {
            const { x, y, width, height } = document.querySelector(sel).getBoundingClientRect();
            return [x, y, width, height].map(value => Math.round(value * 10) / 10);
          });
        `);
        const before = await frame();
        for (const dismiss of ["close", "escape"]) {
          await openPlacementHelp();
          assert.equal(await b.eval("return document.activeElement.id;"), "editor-hint-close");
          assert.deepEqual(await frame(), before);
          const geometry = await b.eval(`
            const close = document.getElementById("editor-hint-close");
            const button = close.getBoundingClientRect();
            const help = document.getElementById("editor-areas");
            const card = help.getBoundingClientRect();
            const contentRight = card.right - parseFloat(getComputedStyle(help).paddingRight);
            const rail = document.querySelector(".editor-toolbar").getBoundingClientRect();
            const hit = document.elementFromPoint(button.x + button.width / 2, button.y + button.height / 2);
            return { label: close.getAttribute("aria-label"), hittable: close.contains(hit), contentClearsClose: contentRight <= button.left,
              inside: button.top >= card.top && button.right <= card.right + 1 && button.bottom <= rail.top };
          `);
          assert.ok(geometry.label && geometry.hittable && geometry.inside && geometry.contentClearsClose, JSON.stringify(geometry));
          const shown = await drawerHits();
          assert.deepEqual(shown.rail, [true, true, true]);
          assert.equal(shown.info, 0);
          if (dismiss === "close") await b.click("#editor-hint-close");
          else await b.key("Escape", "Escape", 27);
          assert.ok(await b.eval('return document.getElementById("editor-areas").hidden;'));
          assert.equal(await b.eval("return document.activeElement.id;"), "editor-more");
          assert.deepEqual(await frame(), before);
        }
        await openPlacementHelp();
        await b.click("#editor-title");
        assert.ok(await b.eval('return document.getElementById("editor-areas").hidden;'), "a tap outside dismisses help");
        assert.deepEqual(await frame(), before);
      });
    }

    test("QA3 drawer controls 390x844: Placement help is reachable after a tray drag", async () => {
      await open(390, 844);
      await b.drag(".tray-note", [[0, 100, -150], [0, 200, -300]]);
      await b.waitFor('!editorDrag && !document.getElementById("editor").matches(".dragging, .settling")',
        { label: "the tray drag to finish" });
      assert.equal((await drawerHits()).info, 0);
      assert.deepEqual((await drawerHits()).rail, [true, true, true]);
      await openPlacementHelp();
      await b.click("#editor-hint-close");
      assert.equal(await b.eval("return document.activeElement.id;"), "editor-more");
      await b.click("#editor-name");
      assert.equal(await b.eval("return document.activeElement.id;"), "editor-name");
    });

    test("QA4 Placement help remains reachable after a pan-type switch from Layout", async () => {
      await open(390, 844);
      for (const kind of ["neotone", "standard"]) {
        await b.click("#editor-tab-layout");
        await b.click("#editor-type-" + kind);
        assert.equal(await b.eval("return editorSession.tab;"), "scale");
        await openPlacementHelp();
        await b.click("#editor-hint-close");
        assert.equal(await b.eval("return document.activeElement.id;"), "editor-more");
      }
    });

    for (const [w, h] of [[375, 667], [360, 640]]) {
      test(`SC ${w}x${h}: the first row of the Scale tab is fully visible under the strip and inside the region, and the tray stays in the region`, async () => {
        await open(w, h);
        const r = await b.eval(`const q = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
          return { name: q("#editor-name"), tabs: q("#editor-tabs"), region: q("#editor-region"), tray: q("#editor-tray") };`);
        assert.ok(r.name.top >= r.tabs.bottom - 1 && r.name.top >= r.region.top - 0.5, `${w}x${h} the Name row is not clipped: ` + JSON.stringify(r));
        assert.ok(r.name.bottom <= r.tray.top + 0.5, `${w}x${h} the Name row sits above the tray: ` + JSON.stringify(r));
        assert.ok(r.tray.bottom <= r.region.bottom + 1, `${w}x${h} the tray is fully in the region: ` + JSON.stringify(r));
      });
    }

    for (const [w, h] of [[390, 844], [375, 667], [360, 640]]) {
      test(`PF ${w}x${h}: selecting Layout shows its panel from the top of the region, and Scale returns to its rest when shown`, async () => {
        await open(w, h);
        const read = () => b.eval(`const rg = document.getElementById("editor-region"), p = document.querySelector('#editor-panels [role=tabpanel]:not([hidden])').getBoundingClientRect(), t = document.getElementById("editor-tabs").getBoundingClientRect();
          return { st: rg.scrollTop, max: rg.scrollHeight - rg.clientHeight, rest: editorRegionRest(rg), panelTop: p.top, tabsBottom: t.bottom, id: document.querySelector('#editor-panels [role=tabpanel]:not([hidden])').id };`);
        await b.eval(`document.getElementById("editor-panels").style.minHeight = "1400px"; editorRegionPin(); return true;`);
        const a = await read();
        assert.ok(a.max > 100 && Math.abs(a.st - a.rest) <= 2 && a.panelTop >= a.tabsBottom - 1, "the region overflows and Scale rests with its panel top clear of the strip: " + JSON.stringify(a));
        await b.click("#editor-tab-layout");
        await pause(150);
        const l = await read();
        assert.strictEqual(l.id, "editor-panel-layout");
        assert.strictEqual(l.st, 0, `${w}x${h} Layout opens at scrollTop 0: ` + JSON.stringify(l));
        assert.ok(l.panelTop >= l.tabsBottom - 1, "the Layout panel top is visible below the strip: " + JSON.stringify(l));
        await b.click("#editor-tab-scale");
        await pause(150);
        const sc = await read();
        assert.ok(Math.abs(sc.st - sc.rest) <= 2, "Scale chosen from the tab strip returns to its rest: " + JSON.stringify(sc));
      });

    }

    // The Name field: a real tap focuses it at a tall viewport, then the soft keyboard shrinks the viewport (Android resize), as on the phone.
    // At the short size itself the region is a few px tall, so Name cannot be tapped there unfocused (plan R4 H1: pan floor 120 beats tray-in-view).
    test("P0 Placement help resize: the open overlay follows the drawer when the viewport rotates", async () => {
      await open(375, 667);
      await openPlacementHelp();
      await b.setViewport(844, 390, true);
      await b.waitFor(`(() => {
        const card = document.getElementById("editor-areas");
        const tabs = [...document.querySelectorAll("#editor-tabs [role=tab]")];
        return !card.hidden && tabs.length === 2 && tabs.every(tab => {
          const r = tab.getBoundingClientRect();
          return card.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        });
      })()`, { label: "the help overlay to cover the rotated tabs" });
      assert.deepEqual((await drawerHits()).rail, [true, true, true]);
      await b.key("Escape", "Escape", 27);
      assert.ok(await b.eval('return document.getElementById("editor-areas").hidden;'));
      assert.equal(await b.eval("return document.activeElement.id;"), "editor-more");
    });

    for (const [w, h, kh] of [[375, 667, 360], [360, 640, 330]]) {
      test(`P0 name focus ${w}x${kh}: focused by a real tap, Name is fully in view with the toolbar; unfocused the pan is at least 120 and the toolbar stays in view`, async () => {
        await open(w, h);
        await b.eval(`document.getElementById("editor-region").scrollTop = 0; return true;`);
        await b.click("#editor-name");
        assert.strictEqual(await b.eval(`return document.activeElement.id;`), "editor-name");
        await b.setViewport(w, kh, true);
        await pause(500);
        const f = await rects(w, kh);
        assert.ok(f.name.top >= 0 && f.name.bottom <= kh && f.name.h >= 44, `${w}x${kh} Name in view: ` + JSON.stringify(f.name));
        assert.ok(f.bar.top >= f.name.bottom - 1 && f.bar.bottom <= kh, "toolbar in view below Name");
        assert.ok(await b.eval(`const t = document.getElementById("editor-tabs").getBoundingClientRect(), n = document.getElementById("editor-name").getBoundingClientRect(); return n.top >= t.bottom - 1;`), "Name is not covered by the pinned tab strip");
        await b.eval(`document.activeElement.blur(); return true;`);
        await pause(300);
        const u = await rects(w, kh);
        assert.ok(u.svg.h >= 119 && u.bar.top >= 0 && u.bar.bottom <= kh && u.page, `${w}x${kh} unfocused pan ${u.svg.h}`);
        assert.ok(u.svg.h > f.svg.h, "focus released pan room to Name");
      });
    }

    test("P0 name focus 844x390 (landscape phone): focusing Name leaves the pan unchanged", async () => {
      await open(844, 390);
      const a = await rects(844, 390);
      await b.click("#editor-name");
      if (await b.eval(`return document.activeElement.id !== "editor-name";`)) await b.eval(`document.getElementById("editor-name").focus(); return true;`);
      await pause(300);
      const f = await rects(844, 390);
      assert.ok(Math.abs(f.svg.h - a.svg.h) < 1, `pan ${a.svg.h} -> ${f.svg.h}`);
    });

    test("P0 Tab at 375x360: Tab from the tab strip lands inside the region or the toolbar and the page never scrolls", async () => {
      await open(375, 360);
      await b.eval(`document.getElementById("editor-tab-scale").focus(); return true;`);
      await b.key("Tab", "Tab", 9);
      await pause(200);
      const r = await b.eval(`const a = document.activeElement; return { id: a.id, inEditor: document.getElementById("editor").contains(a), page: document.documentElement.scrollTop === 0 && document.getElementById("editor").scrollTop === 0 };`);
      assert.ok(r.inEditor && r.page, JSON.stringify(r));
    });

    test("P0 editorWireSwipe: a region scroll cancels the tab swipe (the scrollTop check points at the region)", async () => {
      const src = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
      const m = src.slice(src.indexOf("function editorWireSwipe()"), src.indexOf("function editorDraftMoved"));
      assert.ok(/const body = editorEl\("editor-region"\)/.test(m), "the swipe's scroll reference is the region");
    });

    test("P0 drag keeps E3: the whole rim stays visible at 390x844 during native zoom", async () => {
      magPinned = false;
      try {
        await open(390, 844);
      } finally {
        magPinned = true;
      }
      const point = await b.eval(`const r = document.querySelector('.tray-note[data-name="A"]').getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };`);
      const touch = (type, p) => b.send("Input.dispatchTouchEvent", {
        type, touchPoints: p ? [{ ...p, id: 1 }] : []
      });
      await touch("touchStart", point);
      try {
        await touch("touchMove", { x: point.x, y: point.y - 40 });
        await b.waitFor('!!editorDrag?.live', { label: "the native drag" });
        for (const x of [40, 350]) {
          await touch("touchMove", { x, y: 420 });
          const bounds = await b.eval(`const r = document.querySelector('#editor-pan svg > circle[r="100"]').getBoundingClientRect();
            return { left: r.left, right: r.right, top: r.top, bottom: r.bottom,
              limit: editorEl("drawerexp-handle").getBoundingClientRect().top, width: innerWidth,
              zoom: new DOMMatrix(getComputedStyle(document.querySelector(".editor-panbox")).transform).a };`);
          assert.ok(bounds.zoom > 0 && bounds.zoom <= 1.2, JSON.stringify(bounds));
          assert.ok(bounds.left >= 0 && bounds.right <= bounds.width && bounds.top >= 0 &&
            bounds.bottom <= bounds.limit + 1, JSON.stringify(bounds));
        }
      } finally {
        await touch("touchCancel");
      }
    });
  });

  describe("editor drag guards", () => {
    const pause = (ms) => new Promise((done) => setTimeout(done, ms));
    const chipAt = async (name) => {
          await exposeDrawerControl('.tray-note[data-name="' + name + '"]', selector => b.click(selector));
          return b.eval(`const r = document.querySelector('.tray-note[data-name="${name}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
        };
    const noteAt = (ring, i) => b.eval(`const r = document.querySelector('#editor-pan .ehit[data-ring="${ring}"][data-i="${i}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
    const touch = (type, pt) => b.send("Input.dispatchTouchEvent", { type, touchPoints: pt ? [{ x: pt.x, y: pt.y, id: 1 }] : [] });
    const live = () => b.eval(`return !!(editorDrag && editorDrag.live);`);
    const setup = async () => {
      await fresh(390, 844);
      await openAdd();
      await typeLine(SCALE);
    };
    const liftLive = async () => {
      await setup();
      const from = await chipAt("B"), to = await noteAt("rim", 0);
      await touch("touchStart", from);
      for (const k of [0.15, 0.3]) await touch("touchMove", { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k });
      await pause(300);
      assert.strictEqual(await live(), true, "the drag is live");
    };
    const contextMenuPrevented = () => b.eval(`const ev = new MouseEvent("contextmenu", { bubbles: true, cancelable: true }); document.getElementById("editor-pan").dispatchEvent(ev); return ev.defaultPrevented;`);

    test("edg contextmenu is suppressed during an editor drag and only then", async () => {
      await setup();
      assert.strictEqual(await contextMenuPrevented(), false, "no drag, the menu is left alone");
      await liftLive();
      assert.strictEqual(await contextMenuPrevented(), true, "a live drag swallows the context menu");
      await touch("touchEnd");
      await pause(120);
      assert.strictEqual(await contextMenuPrevented(), false, "after the drop the menu is left alone again");
    });

    test("edg a second pointer cancels the drag and puts the note back", async () => {
      await liftLive();
      const before = await b.eval(`return JSON.stringify(editorSession.history.present.fields);`);
      await b.eval(`document.querySelector("#editor-pan").dispatchEvent(new PointerEvent("pointerdown", { pointerId: 77, button: 0, bubbles: true })); return true;`);
      assert.strictEqual(await b.eval(`return editorDrag === null;`), true, "the second pointer ended the drag");
      assert.strictEqual(await b.eval(`return document.querySelectorAll(".editor-ghost").length;`), 0, "the ghost is gone");
      await touch("touchEnd");
      await pause(120);
      assert.strictEqual(await b.eval(`return JSON.stringify(editorSession.history.present.fields);`), before, "nothing was placed");
    });

    test("edg another pointer pressed on a tray chip ends the drag and starts none of its own", async () => {
      await liftLive();
      await b.eval(`document.querySelector("#editor-tray .tray-note").dispatchEvent(new PointerEvent("pointerdown", { pointerId: 77, button: 0, bubbles: true })); return true;`);
      assert.strictEqual(await b.eval(`return editorDrag === null;`), true, "the second press neither continues nor re-arms a drag");
      await touch("touchEnd");
      await pause(120);
    });
  });

  describe("editor mouse drag guards", () => {
    const pause = (ms) => new Promise((done) => setTimeout(done, ms));
    const noteAt = (ring, i) => b.eval(`const r = document.querySelector('#editor-pan .ehit[data-ring="${ring}"][data-i="${i}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
    const mouse = (type, pt, button = "left", buttons = 1) => b.send("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button, buttons: type === "mouseReleased" ? 0 : buttons, clickCount: 1 });
    const picked = () => b.eval(`return { sel: editorSession.sel, held: editorSession.held };`);
    const setup = async () => {
      await fresh(390, 844);
      await openAdd();
      await typeLine(SCALE);
      await b.eval(`editorSession.sel = null; editorSession.held = null; return true;`);
    };

    test("edm a click after a mouse drag picks nothing: it is eaten, so neither a selection nor a hold appears", async () => {
      await setup();
      const from = await noteAt("rim", 3);
      await mouse("mousePressed", from);
      await mouse("mouseMoved", { x: from.x + 40, y: from.y });
      await mouse("mouseMoved", from);
      await mouse("mouseReleased", from);
      await pause(300);
      assert.deepStrictEqual(await picked(), { sel: null, held: null });
    });

    test("edm a right-button press starts no drag and moves nothing", async () => {
      await setup();
      const from = await noteAt("rim", 3);
      const before = await b.eval(`return JSON.stringify(editorSession.history.present.fields);`);
      await mouse("mousePressed", from, "right", 2);
      assert.strictEqual(await b.eval(`return editorDrag === null;`), true, "no drag state");
      await mouse("mouseMoved", { x: from.x + 40, y: from.y }, "right", 2);
      assert.strictEqual(await b.eval(`return editorDrag === null && document.querySelectorAll(".editor-ghost").length === 0;`), true, "no ghost");
      await mouse("mouseReleased", { x: from.x + 40, y: from.y }, "right", 2);
      await pause(200);
      assert.strictEqual(await b.eval(`return JSON.stringify(editorSession.history.present.fields);`), before);
    });

    test("edm the drag threshold is 8px: 8px is a tap that selects, 9px is a drag that selects nothing", async () => {
      await setup();
      const from = await noteAt("rim", 3);
      await mouse("mousePressed", from);
      await mouse("mouseMoved", { x: from.x + 8, y: from.y });
      await mouse("mouseReleased", { x: from.x + 8, y: from.y });
      await pause(300);
      assert.deepStrictEqual((await picked()).sel, { ring: "rim", i: 3 }, "8px is still a tap");
      await setup();
      const again = await noteAt("rim", 3);
      await mouse("mousePressed", again);
      await mouse("mouseMoved", { x: again.x + 9, y: again.y });
      assert.strictEqual(await b.eval(`return !!(editorDrag && editorDrag.live);`), true, "9px is a drag");
      await mouse("mouseMoved", again);
      await mouse("mouseReleased", again);
      await pause(300);
      assert.deepStrictEqual(await picked(), { sel: null, held: null });
    });
  });

  describe("Editor phone landscape: pan and controls in separate columns", () => {
    async function open(w, h) {
      await fresh(w, h);
      await openAdd();
      await b.waitFor('document.querySelector("#editor-pan svg")', { label: "the pan SVG" });
    }
    const sweep = () => b.eval(`
      const body = document.getElementById("drawerexp-body");
      const els = [...body.querySelectorAll("button, input")].filter(e =>
        !e.closest("[hidden], [inert]") && e.getClientRects().length);
      const covered = [];
      for (const node of els) {
        node.scrollIntoView({ block: "nearest" });
        const r = node.getBoundingClientRect();
        if (!node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)))
          covered.push(node.id || node.className);
      }
      const scrollTop = body.scrollTop;
      body.scrollTop = 0;
      return { covered, count: els.length, scrollTop, rootTop: editorEl("editor").scrollTop };
    `);
    const pinnedSave = async () => {
      const state = await b.eval(`
        const node = document.getElementById("editor-save"), rect = node.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return { top: rect.top, bottom: rect.bottom, height: innerHeight, hit: hit?.id || hit?.tagName,
          reachable: node.contains(hit), rail: [getComputedStyle(node.parentElement).zIndex,
            getComputedStyle(node.parentElement).pointerEvents, getComputedStyle(node.parentElement).visibility],
          classes: editorEl("editor").className, disabled: node.disabled,
          chain: document.elementsFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2).slice(0, 5).map(e => e.id || e.className) };
      `);
      assert.ok(state.top >= 0 && state.bottom <= state.height && state.reachable, JSON.stringify(state));
    };
    async function dragLandscapeNote(zone) {
      const name = zone === "ding" ? "G" : "B";
      if (zone === "ding") await b.click("#editor-oct-down");
      const source = await b.eval(`
        const chip = document.querySelector(${JSON.stringify('.tray-note[data-name="' + name + '"]')});
        chip.scrollIntoView({ block: "nearest" });
        const r = chip.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
        return { x, y, hittable: chip.contains(document.elementFromPoint(x, y)) };
      `);
      assert.equal(source.hittable, true, "the tray note is visible before the drag");
      const touch = (type, pt) => b.send("Input.dispatchTouchEvent", {
        type, touchPoints: pt ? [{ x: pt.x, y: pt.y, id: 1 }] : []
      });
      await touch("touchStart", source);
      let released = false;
      try {
        await touch("touchMove", { x: source.x - 35, y: source.y - 10 });
        await b.waitFor('!!editorDrag?.live', { label: "native drag to lift" });
        let hit;
        for (let attempt = 0; attempt < 5; attempt++) {
          const point = await b.eval(`
            const svg = document.querySelector("#editor-pan svg");
            const center = svg.querySelector('.ehit[data-ring="ding"]');
            if (${JSON.stringify(zone)} === "ding") {
              const r = center.getBoundingClientRect();
              return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
            }
            const g = editorSolve(editorSession.history.present).value.geom;
            const angle = (22.5 + 15 * ${attempt}) * Math.PI / 180;
            const q = new DOMPoint(g.rim * Math.cos(angle) * 100, -g.rim * Math.sin(angle) * 100)
              .matrixTransform(svg.getScreenCTM());
            return { x: q.x, y: q.y };
          `);
          await touch("touchMove", point);
          hit = await b.eval(`return editorDropTarget({ clientX: ${point.x}, clientY: ${point.y} }, editorDrag.src);`);
          if (zone === "ding" ? hit.kind === "ding" : hit.kind === "spot" && hit.ring === "rim") break;
        }
        assert.ok(zone === "ding" ? hit?.kind === "ding" : hit?.kind === "spot" && hit.ring === "rim", JSON.stringify(hit));
        await touch("touchEnd");
        released = true;
        await b.waitFor('!editorDrag && !editorEl("editor").matches(".dragging, .settling")', { label: "the drop to settle" });
      } finally {
        if (!released) await touch("touchCancel");
      }
    }

    for (const [w, h] of [[844, 390], [844, 340], [667, 375]]) {
      test(`LS ${w}x${h}: at rest the drawer and pan occupy separate landscape columns`, async () => {
        await open(w, h);
        const frame = await b.eval(`
          const pan = document.querySelector(".panexp-stage").getBoundingClientRect();
          const drawer = document.getElementById("drawerexp").getBoundingClientRect();
          return { split: pan.right <= drawer.left + 1, open: drawerExperiment.expanded, tab: editorSession.tab };
        `);
        assert.deepEqual(frame, { split: true, open: true, tab: "scale" });
        await pinnedSave();
      });

      test(`LS ${w}x${h}: every Scale and Layout control is reachable inside the drawer`, async () => {
        await open(w, h);
        const scale = await sweep();
        assert.deepEqual(scale.covered, []);
        assert.ok(scale.count >= 17 && scale.scrollTop > 0 && scale.rootTop === 0, JSON.stringify(scale));
        await b.click("#editor-tab-layout");
        const layout = await sweep();
        assert.deepEqual(layout.covered, []);
        assert.ok(layout.count >= 14 && layout.rootTop === 0, JSON.stringify(layout));
        await b.click("#editor-tab-scale");
        assert.equal(await b.eval("return editorSession.tab;"), "scale");
      });

      test(`LS ${w}x${h}: a Neotone switch from the Layout tab keeps the Layout tab`, async () => {
        await open(w, h);
        await b.click("#editor-tab-layout");
        for (const kind of ["neotone", "standard"]) {
          await b.click("#editor-type-" + kind);
          const r = await b.eval(`return { tab: editorSession.tab, layout: !editorEl("editor-panel-layout").hidden, scale: editorEl("editor-panel-scale").hidden };`);
          assert.deepEqual(r, { tab: "layout", layout: true, scale: true }, kind + " keeps Layout");
        }
      });
    }

    test("LS 844x390: Save stays pinned as a chip is dragged into the rim", async () => {
      await open(844, 390);
      await typeLine(SCALE);
      await pinnedSave();
      await dragLandscapeNote("rim");
      assert.match(await text(), /B4/);
      assert.equal(await b.eval("return drawerExperiment.expanded;"), false);
      await pinnedSave();
    });

    for (const [w, h, zone] of [[838, 390, "rim"], [838, 390, "ding"], [667, 375, "rim"], [667, 375, "ding"]]) {
      test(`AF save on screen ${w}x${h} ${zone}: after a touch drop Save is fully in view and hit at its centre`, async () => {
        await open(w, h);
        await typeLine(SCALE);
        await dragLandscapeNote(zone);
        assert.match(await text(), zone === "ding" ? /\(G3\)/ : /B4/);
        await pinnedSave();
      });
    }
  });

  describe("editor landscape dialog lock", () => {
    test("LS 844x340: an open dialog locks the drawer's scroll", async () => {
      await fresh(844, 340);
      await openAdd();
      await typeLine(SCALE);
      const pt = await b.eval(`const r = editorEl("drawerexp-body").getBoundingClientRect();
        return { x: r.right - 32, y: r.top + r.height / 2 };`);
      const wheel = async () => {
        await b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: pt.x, y: pt.y, deltaX: 0, deltaY: 300 });
        await new Promise(done => setTimeout(done, 300));
        return b.eval(`return editorEl("drawerexp-body").scrollTop;`);
      };
      assert.ok(await wheel() > 0, "the drawer scrolls under the wheel before any dialog");
      await b.eval(`editorEl("drawerexp-body").scrollTop = 0; return true;`);
      await b.click("#editor-back");
      await b.waitFor(`!editorEl("editor-dialog").hidden`, { label: "the Save changes dialog" });
      assert.ok(await b.eval(`return editorEl("editor-dialog").contains(document.elementFromPoint(${pt.x}, ${pt.y}));`),
        "the dialog owns the pointer over the drawer");
      assert.strictEqual(await wheel(), 0, "a wheel over the drawer does not move it while the dialog is open");
    });
  });

  describe("Editor floating feedback on portrait and landscape screens", () => {
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    const open = async (w, h) => {
      await fresh(w, h);
      await openAdd();
      await b.waitFor('document.querySelector("#editor-pan svg")', { label: "the pan SVG" });
    };
    const geo = () => b.eval(`
      const box = id => {
        const { top, left, right, bottom } = document.getElementById(id).getBoundingClientRect();
        return { top, left, right, bottom };
      };
      return { line: box("editor-line"), tabs: box("editor-tabs"), status: box("editor-status"),
        ih: innerHeight, iw: innerWidth };
    `);
    const seedMessageScale = () => b.eval(`
      const loaded = editorLoad(${JSON.stringify(SCALE)});
      if (!loaded.ok) throw Error(loaded.reason);
      editorSession.history = editorHistoryNew(loaded.value);
      editorRender();
      return true;
    `);
    const look = () => b.eval(`
      const note = document.getElementById("editor-status");
      return { text: note.textContent, idle: note.hasAttribute("data-idle"), clip: getComputedStyle(note).clipPath };
    `);

    for (const [w, h] of [[844, 390], [667, 375]]) {
      test(`SO: landscape idle status row takes no height at ${w}x${h}`, async () => {
        await open(w, h);
        const message = await look();
        assert.ok(message.idle && message.text && message.clip !== "none");
        const frame = await geo();
        assert.ok(frame.line.bottom <= frame.tabs.top + 0.5);
        await b.click("#editor-tab-layout");
        assert.equal(await b.eval("return editorSession.tab;"), "layout");
      });
    }

    test("SO: a landscape message floats beside the open drawer without shifting its tabs", async () => {
      await open(844, 390);
      const idle = await geo();
      await b.eval(`editorSession.error = t("editor.crowded", { pt: "5.5", floor: "6" }); editorRender(); return true;`);
      const g = await geo();
      assert.deepEqual(g.tabs, idle.tabs);
      assert.deepEqual(g.line, idle.line);
      assert.ok(g.status.top >= g.line.bottom - 0.5 && g.status.bottom <= g.ih + 0.5);
      assert.ok(g.status.left >= 0 && g.status.right <= g.tabs.left + 0.5);
    });

    test("SO: landscape tabs are clickable again once the message is cleared by the app", async () => {
      await open(844, 390);
      await seedMessageScale();
      await b.eval(`document.querySelector('.tray-note[data-name="F"]').click(); return true;`);
      await b.click("#editor-cancel");
      await b.waitFor('document.getElementById("editor-status").textContent === ""', { label: "the message to clear" });
      await b.click("#editor-tab-layout");
      assert.equal(await b.eval("return editorSession.tab;"), "layout");
    });

    for (const [w, h] of [[844, 390], [667, 375], [932, 430], [568, 320]]) {
      test(`SO: en ${w}x${h}: the idle prompt gives way to visible hold and drag feedback`, async () => {
        await open(w, h);
        const idle = await look();
        assert.ok(idle.text && idle.idle && idle.clip !== "none", JSON.stringify(idle));
        await seedMessageScale();
        await b.eval(`document.querySelector('.tray-note[data-name="F"]').click(); return true;`);
        const held = await look();
        assert.ok(held.text && !held.idle && held.clip === "none", JSON.stringify(held));
        await b.click("#editor-cancel");
        const source = await b.eval(`
          const chip = document.querySelector(".tray-note");
          chip.scrollIntoView({ block: "nearest" });
          const r = chip.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        `);
        await b.send("Input.dispatchMouseEvent", { type: "mousePressed", ...source, button: "left", buttons: 1, clickCount: 1 });
        for (let step = 1; step <= 6; step++) {
          await b.send("Input.dispatchMouseEvent", {
            type: "mouseMoved", x: source.x - step * 10, y: source.y - step * 6, button: "left", buttons: 1
          });
        }
        const dragging = await b.eval('return document.getElementById("editor").classList.contains("dragging");');
        const message = await look();
        await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: source.x - 60, y: source.y - 36, button: "left", buttons: 0, clickCount: 1 });
        assert.ok(dragging && message.text && !message.idle && message.clip === "none", JSON.stringify(message));
      });
    }

    const LANDSCAPE = [[844, 390], [667, 375]];
    const STATES = {
      empty: async () => true,
      held: () => b.eval(`document.querySelector('.tray-note[data-name="F"]').click(); return true;`),
      error: () => b.eval(`editorSession.error = t("editor.crowded", { pt: "5.5", floor: "6" }); editorRender(); return true;`),
      undo: () => b.eval(`editorDo(m => editorRemove(m, "rim", 2), t("editor.say.removed", { name: "C4" })); editorRender(); return true;`),
    };
    const reset = () => b.eval(`const s = editorSession; s.error = ""; s.say = ""; s.notice = false; if (s.held) editorCancelHold(); editorRender(); return true;`);
    describe("with real fonts", () => {
      let saved = null;
      before(async () => { saved = b; b = await launch({ foregroundSettle: true, realFonts: true }); });
      after(async () => { const mine = b; b = saved; await mine.close(); });
      for (const lang of ["en", "de"]) {
        for (const [w, h] of LANDSCAPE) {
          test(`SO: ${lang} ${w}x${h}: while a message shows a real click at each tab centre switches tabs and the message buttons stay tappable`, async () => {
            await fresh(w, h);
            if (lang === "de") {
              await b.eval(`const e = document.getElementById("lang-select"); e.value = "de"; e.dispatchEvent(new Event("change", { bubbles: true })); return true;`);
              await b.waitFor(`document.documentElement.lang === "de"`, { label: "German" });
            }
            await openAdd();
            await b.waitFor(`document.querySelector("#editor-pan svg")`, { label: "the pan svg" });
            for (const name of ["empty", "held", "error", "undo"]) {
              if (name !== "empty") { await reset(); await seedMessageScale(); }
              await b.click("#editor-tab-scale");
              await STATES[name]();
              await pause(250);
              const g = await geo();
              assert.ok(g.status.top >= -0.5 && g.status.bottom <= h + 0.5,
                `${name}: feedback stays within the viewport. ` + JSON.stringify(g.status));
              for (const id of ["layout", "scale", "layout"]) {
                await b.click("#editor-tab-" + id);
                assert.strictEqual(await b.eval(`return editorSession.tab;`), id, `${name} ${lang} ${w}x${h}: a click at the ${id} tab centre switched to it`);
              }
              const btn = { held: "#editor-cancel", undo: "#editor-undo" }[name];
              if (btn) {
                const hit = await b.eval(`const e = document.querySelector(${JSON.stringify(btn)}), r = e.getBoundingClientRect(), x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!x && (x === e || e.contains(x));`);
                assert.ok(hit, `${name} ${lang} ${w}x${h}: ${btn} takes its own tap`);
              }
              await reset();
            }
          });
        }
      }

      test("SO: en 568x320: a typed out-of-order line shows its whole error in landscape", async () => {
        await open(568, 320);
        await typeLine("(D3) A3 C3 D4 E4");
        await b.waitFor(`document.getElementById("editor-status").getAttribute("data-kind") === "error"`, { label: "the out-of-order error" });
        await b.waitFor(`document.getElementById("editor-status").getAnimations().length === 0`, { label: "the message to settle" });
        const r = await b.eval(`const st = document.getElementById("editor-status"), sr = st.getBoundingClientRect(), tb = document.getElementById("editor-tabs").getBoundingClientRect();
          let clipped = 0; const tw = document.createTreeWalker(st, NodeFilter.SHOW_TEXT);
          for (let n; (n = tw.nextNode());) { for (let i = 0; i < n.data.length; i++) { const g = document.createRange(); g.setStart(n, i); g.setEnd(n, i + 1); const c = g.getClientRects()[0];
            if (c && c.width > 0 && (c.bottom > sr.bottom + 0.5 || c.top < sr.top - 0.5)) clipped++; } }
          return { text: st.textContent, top: sr.top, bottom: sr.bottom, tabsTop: tb.top, fits: st.scrollHeight <= st.clientHeight, clipped };`);
        assert.ok(r.text.length > 0 && r.fits && r.clipped === 0, "the whole error is readable: " + JSON.stringify(r));
        assert.ok(r.top >= -0.5 && r.bottom <= 320.5, "the error stays in the viewport: " + JSON.stringify(r));
      });

      const LOCALES = ["en", "de", "es", "fr", "it", "ja", "zh-Hans", "zh-Hant"];
      async function holdLandscapeNote() {
        const selector = '.tray-note[data-name="G#"]';
        await exposeDrawerControl(selector, target => b.click(target));
        await b.eval(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: "nearest" }); return true;`);
        await b.click(selector);
        await b.waitFor(`!!document.getElementById("editor-cancel")`, { label: "the held prompt" });
      }
      const SO_STATES = {
        empty: async () => true,
        held: async () => { await holdLandscapeNote(); },
        crowded: () => b.eval(`editorSession.error = t("editor.crowded", { pt: "5.5", floor: "6" }); editorRender(); return true;`),
        picked: () => b.eval(`editorSession.say = t("editor.say.picked", { name: "C4" }); editorRender(); return true;`),
        removed: () => b.eval(`editorDo((m) => editorRemove(m, "rim", 2), t("editor.say.removed", { name: "C4" })); editorRender(); return true;`),
        rimfull: async () => {
          await holdLandscapeNote();
          await b.eval(`editorPlaceHeld({ kind: "spot", ring: "rim" }, editorSession.history.present); return true;`);
        },
      };
      const FULL_RIM = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 | C6";
      for (const lang of LOCALES) {
        for (const [w, h] of [[844, 390], [667, 375], [932, 430], [568, 320]]) {
          test(`SO: ${lang} ${w}x${h}: every landscape message is readable above the collapsed drawer`, async () => {
            await fresh(w, h);
            if (lang !== "en") {
              await b.eval(`const e = document.getElementById("lang-select"); e.value = ${JSON.stringify(lang)}; e.dispatchEvent(new Event("change", { bubbles: true })); return true;`);
              await b.waitFor(`document.documentElement.lang === ${JSON.stringify(lang)}`, { label: lang });
            }
            await openAdd();
            await b.waitFor(`document.querySelector("#editor-pan svg")`, { label: "the pan svg" });
            for (const name of Object.keys(SO_STATES)) {
              if (name !== "empty") {
                await reset();
                await b.eval(`
                  const model = editorLoad(${JSON.stringify(name === "rimfull" ? FULL_RIM : SCALE)});
                  if (!model.ok) throw Error(model.reason);
                  editorSession.history = editorHistoryNew(model.value);
                  editorRender();
                  return true;
                `);
              }
              await SO_STATES[name]();
              if (await b.eval("return drawerExperiment.expanded;")) await b.click("#drawerexp-handle");
              await b.waitFor('drawerExperiment.state === "SHUT"', { label: "the drawer to close" });
              const r = await readClosedFeedback();
              assertClosedFeedback(r, `${name} ${lang} ${w}x${h}`);
            }
            await reset();
          });
        }
      }

      const { ROWS } = require("./helpers/so_status_inventory.js");
      const RENDER_ROW = `
        const ROW = __ROW__;
        const s = editorSession, st = document.getElementById("editor-status"), ed = document.getElementById("editor"), K = window.__so;
        s.error = ""; s.say = ""; s.plainSay = ""; s.notice = false; if (s.held) editorCancelHold();
        s.history = { ...s.history, present: K.full }; editorRender(); ed.scrollTop = 0;
        const text = t(ROW.k, Object.assign({}, ROW.vars, { zone: t("editor.zone.inner") }));
        if (ROW.mode === "error") s.error = text;
        else if (ROW.mode === "plain") s.say = s.plainSay = text;
        else if (ROW.mode === "undo") { s.say = text; s.plainSay = ""; }
        else if (ROW.mode === "undo-empty") { s.history = { ...s.history, present: K.empty }; if (ROW.k === "editor.pins_reset") s.notice = true; else s.say = text; }
        else if (ROW.mode === "held") document.querySelector('.tray-note[data-name="F"]').click();
        else if (ROW.mode === "idle") s.history = { ...s.history, present: K.idle[ROW.k] };
        if (ROW.mode === "drag") { editorRender(); st.removeAttribute("data-kind"); st.removeAttribute("data-idle"); st.textContent = text; } else editorRender();
        const idleKey = {
          "editor.say.stage_need_ding": "editor.save_needs_ding",
          "editor.say.stage_need_fifth": "editor.save_needs_rim",
        }[ROW.k] || ROW.k;
        return ROW.mode === "idle" ? [t(idleKey)] : ROW.mode === "held"
          ? ["editor.held", "editor.guided.tap_growth", "editor.guided.tap_both"]
            .map(key => t(key, { name: editorHeldName() }))
          : [text];`;
      const readClosedFeedback = () => b.eval(`return new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const status = document.getElementById("editor-status");
          const bounds = status.getBoundingClientRect();
          const line = document.getElementById("editor-line").getBoundingClientRect();
          const handle = document.getElementById("drawerexp-handle").getBoundingClientRect();
          const hitOwn = node => {
            const r = node.getBoundingClientRect();
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
            return node === hit || node.contains(hit);
          };
          const controls = ["drawerexp-handle", "editor-undo", "editor-save", "editor-more"]
            .map(id => hitOwn(document.getElementById(id)));
          const actions = [...status.querySelectorAll("button:not([hidden])")].every(hitOwn);
          const protectsRim = status.matches('[data-guided-actions="single"], :has(#editor-save-blocker)');
          const rim = document.querySelector('#editor-pan svg > circle[r="100"]')?.getBoundingClientRect();
          const rimClear = !protectsRim || !!rim && rim.top >= line.bottom - 0.5 && rim.bottom <= bounds.top + 0.5;
          let clipped = 0;
          const walker = document.createTreeWalker(status, NodeFilter.SHOW_TEXT);
          for (let node; (node = walker.nextNode());) {
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const glyph of range.getClientRects()) {
              if (glyph.width > 0 && (glyph.top < bounds.top - 1 || glyph.bottom > bounds.bottom + 1 ||
                glyph.left < bounds.left - 1 || glyph.right > bounds.right + 1)) clipped++;
            }
          }
          resolve({ text: status.textContent.trim(), idle: status.hasAttribute("data-idle"),
            clippedAway: getComputedStyle(status).clipPath !== "none", top: bounds.top, bottom: bounds.bottom,
            left: bounds.left, right: bounds.right, viewport: innerWidth, line: line.bottom,
            drawer: handle.top, px: parseFloat(getComputedStyle(status).fontSize), controls, actions, rimClear, clipped });
        }));
      })`);
      function assertClosedFeedback(result, label, expected = []) {
        const detail = label + " " + JSON.stringify(result);
        assert.ok(result.text, "feedback is shown. " + detail);
        if (expected.length)
          assert.ok(expected.some(copy => result.text.includes(copy)), "localized feedback is shown. " + detail);
        assert.ok(result.actions, "banner actions remain hittable. " + detail);
        assert.ok(result.rimClear, "protected feedback reserves room for the entire rim. " + detail);
        assert.equal(result.clippedAway, result.idle, "only the landscape idle hint is visually hidden. " + detail);
        assert.equal(result.clipped, 0, "the message is not clipped. " + detail);
        assert.ok(result.px >= 12, "the message is at least 12px. " + detail);
        assert.ok(result.left >= -0.5 && result.right <= result.viewport + 0.5 &&
          result.top >= result.line - 0.5 && result.bottom <= result.drawer + 0.5,
          "the banner fits between the scale line and drawer. " + detail);
        assert.deepEqual(result.controls, [true, true, true, true], "pinned actions remain hittable. " + detail);
      }
      const SETUP_ROWS = `const s = editorSession, empty = editorEmptyModel(), full = s.history.present;
        const stage = (extra) => editorWithStage(empty, { ...editorBlankStage("standard"), ...extra });
        window.__so = { full, empty, idle: { "editor.empty": empty, "editor.say.stage_need_ding": stage({ rim: ["A3"] }), "editor.say.stage_need_fifth": stage({ ding: "D3" }) } };
        return document.fonts.ready.then(() => true);`;
      for (const lang of ["en", "de", "es", "fr", "it", "ja", "zh-Hans", "zh-Hant"]) {
        for (const [w, h] of [[844, 390], [667, 375], [932, 430], [568, 320]]) {
          test(`SO: ${lang} ${w}x${h}: every editor message in the inventory is fully readable in landscape`, async () => {
            await fresh(w, h);
            if (lang !== "en") {
              await b.eval(`const e = document.getElementById("lang-select"); e.value = ${JSON.stringify(lang)}; e.dispatchEvent(new Event("change", { bubbles: true })); return true;`);
              await b.waitFor(`document.documentElement.lang === ${JSON.stringify(lang)}`, { label: lang });
            }
            await openAdd();
            await b.waitFor(`document.querySelector("#editor-pan svg")`, { label: "the pan svg" });
            await typeLine(SCALE);
            await b.eval(SETUP_ROWS);
            await b.click("#drawerexp-handle");
            await b.waitFor('drawerExperiment.state === "SHUT"', { label: "the drawer to close" });
            for (const row of ROWS) {
              const expected = await b.eval(RENDER_ROW.replace("__ROW__", () => JSON.stringify(row)));
              const r = await readClosedFeedback();
              assertClosedFeedback(r, `${row.mode} ${row.k} ${lang} ${w}x${h}`, expected);
            }
            await reset();
          });
        }
      }
    });

    test("SO: portrait feedback fits above the collapsed drawer at 375x667", async () => {
      await open(375, 667);
      await b.click("#drawerexp-handle");
      await b.waitFor('drawerExperiment.state === "SHUT"', { label: "the drawer to close" });
      const g = await geo();
      assert.ok(g.status.top >= g.line.bottom && g.status.bottom < g.ih);
      assert.ok(await b.eval('return editorEl("drawerexp-body").inert;'));
    });
  });

  describe("editor armed delete", () => {
    // Oracle recorded 2026-11-14 by reading main's armed delete from the fixture text:
    //   grep -n 'scale-delete\[data-armed\]' tests/fixtures/shipped_client_a4ecfc2e.html.txt
    // gives "#scale-sheet #scale-delete[data-armed]{color:#242424}" over the "#scale-delete" rule's "background:none",
    // and main's armed label (sheet.del_armed) carries no icon glyph or element.
    const MAIN = { color: "rgb(36, 36, 36)", backgroundColor: "rgba(0, 0, 0, 0)", icon: false };

    test("ead the armed delete is main's ink with no fill, not red", async () => {
      const fixture = fs.readFileSync(path.join(REPO, "tests/fixtures/shipped_client_a4ecfc2e.html.txt"), "utf8");
      assert.ok(fixture.includes("#scale-sheet #scale-delete[data-armed]{color:#242424}"), "the oracle literal still matches main");
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the save to close" });
      await b.eval(`const view = allDeckViews().find((v) => savedEqual(v.selection, selection)); openEditSheet(view.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor on the saved scale" });
      await b.click("#editor-delete");
      const got = await b.eval(`const e = document.getElementById("editor-delete"), c = getComputedStyle(e);
        return { armed: e.classList.contains("armed"), color: c.color, backgroundColor: c.backgroundColor,
          icon: !!e.querySelector("svg, img, .ico") || !["none", "normal"].includes(getComputedStyle(e, "::before").content) };`);
      assert.strictEqual(got.armed, true);
      assert.deepStrictEqual({ color: got.color, backgroundColor: got.backgroundColor, icon: got.icon }, MAIN);
    });
  });

  describe("editor Back prompt Save on an empty model", () => {
    test("U2b n8 Save in the prompt on an emptied saved scale says why nothing was saved", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the save to close" });
      await b.eval(`const view = allDeckViews().find((v) => savedEqual(v.selection, selection)); openEditSheet(view.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor on the saved scale" });
      const before = await savedCount();
      await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => ({ ok: true, value: { ...m, fields: {}, pins: [] } })).history; editorRender(); return true;`);
      await b.click("#editor-back");
      assert.strictEqual(await dialogOpen(), true);
      assert.strictEqual(await b.eval('return document.getElementById("editor-dlg-save").disabled;'), true);
      assert.match(await b.eval('return document.getElementById("editor-dlg-body").textContent;'), /ding to save/i);
      assert.strictEqual(await sheetHidden(), false, "the editor stays open");
      assert.strictEqual(await savedCount(), before, "nothing saved");
    });
  });

  describe("editor save recovery", () => {
    const saveScale = async (name) => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await b.eval(`const n = document.getElementById("editor-name"); n.focus(); n.value = ${JSON.stringify(name)};
        n.dispatchEvent(new Event("input", { bubbles: true })); n.blur(); return true;`);
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the first save to close" });
    };
    const editSaved = async () => {
      await b.eval(`const view = allDeckViews().find((v) => savedEqual(v.selection, selection)); openEditSheet(view.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor on the saved scale" });
    };
    const rename = (value) => b.eval(`const n = document.getElementById("editor-name"); n.focus(); n.value = ${JSON.stringify(value)};
      n.dispatchEvent(new Event("input", { bubbles: true })); n.blur(); return true;`);
    const names = () => b.eval(`return savedState.entries.map((e) => e.record.o.name).sort();`);

    describe("the Back dialog on an edited saved scale", () => {
      const record = () => b.eval(`return JSON.stringify(savedState.entries.map((e) => [e.instanceId, e.revision, e.record]));`);
      const toDialog = async () => {
        await saveScale("ORIGINAL");
        await editSaved();
        await rename("EDITED");
        await b.click("#editor-back");
        assert.strictEqual(await dialogOpen(), true);
      };

      test("Discard closes and leaves the saved scale unchanged", async () => {
        await saveScale("ORIGINAL");
        const before = await record();
        await editSaved();
        await rename("EDITED");
        await b.click("#editor-back");
        assert.strictEqual(await dialogOpen(), true);
        await b.click("#editor-dlg-discard");
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the sheet to close after Discard" });
        await b.waitFor(`!savePending`, { label: "any write started by Discard to settle" });
        assert.strictEqual(await record(), before, "the saved record and its revision are untouched");
        assert.deepStrictEqual(await names(), ["ORIGINAL"]);
      });

      test("Save writes the edit once (revision +1, no copy) and closes", async () => {
        await toDialog();
        const rev = await b.eval(`return savedState.entries[0].revision;`);
        await b.click("#editor-dlg-save");
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the sheet to close after Save" });
        assert.deepStrictEqual(await names(), ["EDITED"], "one scale, renamed in place");
        assert.strictEqual(await b.eval(`return savedState.entries[0].revision;`), rev + 1, "written exactly once");
      });
    });

    describe("history back on the editor", () => {
      const back = async () => {
        await b.eval(`history.back(); return true;`);
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden") || !!(document.getElementById("editor-dialog") && !document.getElementById("editor-dialog").hasAttribute("hidden"))`, { label: "back to settle" });
      };

      test("a dirty editor shows the dialog and Keep editing retains the edits and the history entry", async () => {
        await fresh();
        await openAdd();
        await typeLine(SCALE);
        const route = await b.eval(`return location.hash;`);
        await back();
        assert.strictEqual(await dialogOpen(), true);
        assert.strictEqual(await sheetHidden(), false);
        await b.click("#editor-dlg-keep");
        assert.strictEqual(await dialogOpen(), false);
        assert.strictEqual(await sheetHidden(), false);
        assert.match(await text(), /A4/);
        assert.strictEqual(await b.eval(`return location.hash;`), route, "the page's history entry is back on the stack");
        await back();
        assert.strictEqual(await dialogOpen(), true, "a second back asks again");
      });

      test("a clean editor closes silently", async () => {
        await fresh();
        await openBuiltin();
        await back();
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the sheet to close" });
        assert.strictEqual(await dialogOpen(), false);
      });

      test("a staged-only editor asks before closing", async () => {
        await fresh();
        await openAdd();
        await b.eval(`const r = editorApply(editorSession.history, (m) => editorStageEdit(m, (st) => { editorStagePush(st, "rim", "A4"); }));
          editorSession.history = r.history; editorRender(); return r.ok !== false;`);
        const staged = await b.eval(`return editorStageNames(editorSession.history.present, "rim");`);
        assert.deepStrictEqual(staged, ["A4"], "a note is really staged through the real stage path");
        await back();
        await b.waitFor(`!document.getElementById("editor-dialog").hidden`, { label: "staged notes are protected" });
        assert.strictEqual(await sheetHidden(), false);
      });
    });

    describe("the Back dialog paints above every editor layer", () => {
      const NEO = "[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4";
      const probe = () => b.eval(`const center = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
        const inerts = [...document.querySelectorAll("[inert]")];
        inerts.forEach((el) => el.removeAttribute("inert"));
        try {
          const hit = (id) => { const el = document.getElementById(id); const [x, y] = center(el); const h = document.elementFromPoint(x, y); return !!h && el.contains(h); };
          const [tx, ty] = center(document.getElementById("editor-tab-scale")), under = document.elementFromPoint(tx, ty);
          return { save: hit("editor-dlg-save"), discard: hit("editor-dlg-discard"), keep: hit("editor-dlg-keep"),
            tabsCovered: !!under && document.getElementById("editor-dialog").contains(under),
            aboveEveryLayer: (() => { const dlg = document.getElementById("editor-dialog"), own = Number(getComputedStyle(dlg).zIndex);
              return [...document.querySelectorAll("#editor *")].filter((el) => !dlg.contains(el) && getComputedStyle(el).position !== "static")
                .every((el) => { const z = Number(getComputedStyle(el).zIndex); return Number.isNaN(z) || z < own; }); })() };
        } finally { inerts.forEach((el) => el.setAttribute("inert", "")); }`);
      const SIZES = [[360, 640], [375, 667], [390, 844], [844, 390]];
      for (const [w, h] of SIZES) {
        for (const state of ["scale", "layout", "info"]) {
          test(`${w}x${h} ${state}: Save, Discard and Keep editing are hittable and the scrim covers the tabs`, async () => {
            await fresh(w, h);
            await openAdd();
            await typeLine(NEO);
            await b.click("#editor-type-neotone");
            if (state === "layout") await b.click("#editor-tab-layout");
            if (state === "info") await b.click("#editor-hint-toggle");
            if (state === "layout") await b.eval(`history.back(); return true;`); else await b.click("#editor-back");
            await b.waitFor(`!!(document.getElementById("editor-dialog") && !document.getElementById("editor-dialog").hasAttribute("hidden"))`, { label: "the Back dialog" });
            const r = await probe();
            assert.deepStrictEqual(r, { save: true, discard: true, keep: true, tabsCovered: true, aboveEveryLayer: true }, JSON.stringify(r));
          });
        }
      }
    });
  });

  describe("editor keys and delete rebind", () => {
    const saveOne = async (w, h) => {
      await fresh(w, h);
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the save to close" });
      await b.eval(`const view = allDeckViews().find((v) => savedEqual(v.selection, selection)); openEditSheet(view.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor on the saved scale" });
    };
    const armedDelete = async () => {
      await b.click("#editor-delete");
      await b.eval(`return new Promise((r) => setTimeout(r, 500));`);
      await b.click("#editor-delete");
      await b.eval(`return new Promise((r) => setTimeout(r, 300));`);
    };
    for (const [w, h] of [[360, 640], [390, 844]]) {
      test(`FA-06 ${w}x${h} after system Back with the menu open the dialog closes the menu and the first Escape leaves the Save-changes dialog and focus returns to Back`, async () => {
        await saveOne(w, h);
        await b.eval(`const n = document.getElementById("editor-name"); n.focus(); n.value = "FA06 EDIT";
          n.dispatchEvent(new Event("input", { bubbles: true })); n.blur(); return true;`);
        await b.click("#editor-more");
        assert.strictEqual(await b.eval(`return editorSession.menu;`), true);
        await b.eval(`history.back(); return true;`);
        await b.waitFor(`!!(document.getElementById("editor-dialog") && !document.getElementById("editor-dialog").hasAttribute("hidden"))`, { label: "the Back dialog" });
        assert.strictEqual(await b.eval(`return editorSession.menu;`), false, "opening the dialog closes the menu");
        assert.strictEqual(await b.eval(`return document.getElementById("editor-menu").hasAttribute("hidden");`), true, "the menu element is hidden");
        await b.key("Escape", "Escape", 27);
        assert.strictEqual(await dialogOpen(), false, "the first Escape leaves the dialog");
        assert.strictEqual(await b.eval(`return document.activeElement && document.activeElement.id;`), "editor-back");
      });
    }

    test("FA-07 with the hint open Tab moves focus on every step and never to a hidden control", async () => {
      await fresh(390, 844);
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-hint-toggle");
      await b.waitFor(`editorSession.hint === true`, { label: "the hint to open" });
      const seen = [];
      for (let i = 0; i < 8; i++) {
        await b.key("Tab", "Tab", 9);
        seen.push(await b.eval(`const a = document.activeElement, c = getComputedStyle(a);
          return { id: a.id || a.outerHTML.slice(0, 120), hidden: c.visibility === "hidden" || c.display === "none" || a.getClientRects().length === 0 };`));
      }
      assert.ok(seen.every((x) => !x.hidden), JSON.stringify(seen));
      assert.ok(seen.every((x, i) => i === 0 || x.id !== seen[i - 1].id), JSON.stringify(seen));
    });

    test("a remote edit of the open saved scale keeps a dirty editor's draft and does not reopen it", async () => {
      await saveOne(375, 667);
      await typeLine("(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5 E5");
      await b.eval(`document.activeElement.blur(); editorSession.__probe = "local"; return true;`);
      const before = await b.eval(`const s = editorSession;
        return { dirty: editorIsDirty(s.base, s.history.present), naming: !!s.naming, editing: !!s.editing, dialog: !!s.dialog,
          nameMatches: editorSetName(s.history.present, document.getElementById("editor-name").value).value === s.history.present,
          line: document.getElementById("editor-line").value, rev: editingBase.revision };`);
      assert.strictEqual(before.dirty, true, "the notes edit makes the editor dirty");
      assert.deepStrictEqual([before.naming, before.editing, before.dialog, before.nameMatches], [false, false, false, true]);
      await b.eval(`const id = editingBase.selection.id, row = savedState.entries.find((r) => r.instanceId === id),
        built = buildGenerated(row.record.s, { ...row.record.o, name: "REMOTE RENAMED" });
        return commitSaved({ type: "edit", collectionId: savedState.collectionId, instanceId: id, expectedRevision: row.revision,
          candidate: { record: scaleRecord(seedOf(built.value)), deck: built.value } }).then((r) => {
          if (r.ok) savedSnapshotListener({ source: "remote", previous: savedState, current: savedState });
          return r.ok === true; });`);
      await b.waitFor(`savedState.entries.find((r) => r.instanceId === editingBase.selection.id).revision > ${before.rev}`, { label: "the remote revision" });
      const after = await b.eval(`const s = editorSession;
        return { same: s.__probe === "local", dirty: editorIsDirty(s.base, s.history.present),
          line: document.getElementById("editor-line").value, name: document.getElementById("editor-name").value };`);
      assert.strictEqual(after.same, true, "the editor session was not reopened");
      assert.strictEqual(after.dirty, true);
      assert.strictEqual(after.line, before.line, "the local draft survives");
      assert.notStrictEqual(after.name, "REMOTE RENAMED", "the remote content did not overwrite the draft");
    });
  });

  describe("editor layout at rest", () => {
    const pause = (ms) => new Promise((done) => setTimeout(done, ms));
    const NEO = "[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4";
    const TITLE_CASES = [[320, 568, "en"], [320, 568, "de"], [390, 844, "de"], [390, 844, "es"], [390, 844, "fr"], [390, 844, "it"]];
    for (const [w, h, lang] of TITLE_CASES) {
      for (const mode of ["add", "edit"]) {
        test(`ELA title fit ${w}x${h} ${lang} ${mode}: h2#editor-title does not overflow`, async () => {
          await fresh(w, h);
          await b.eval(`setLang(${JSON.stringify(lang)}); return true;`);
          if (mode === "add") await openAdd(); else await openBuiltin();
          await pause(150);
          const r = await b.eval(`const e = document.getElementById("editor-title"); return { sw: e.scrollWidth, cw: e.clientWidth, text: e.textContent };`);
          assert.ok(r.sw <= r.cw, "title fits: " + JSON.stringify(r));
        });
      }
    }
  });


  describe("editor hint and menu at rest", () => {
    const pause = (ms) => new Promise((done) => setTimeout(done, ms));
    const NEO = "[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4";
    const POINTS = [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]];
    const LONG_NAME = "Kurd R\u00e9 mineur - \u591c\u660e\u3051\u306e\u97f3\u968e \u00fc\u00f1\u00e7 \u00e9\u00e0\u00e8 \u00e7\u00f4\u00eb\u00ef\u00e2 40";
    const openSaved = async (name) => {
      await openAdd();
      await typeLine(SCALE);
      if (name) {
        await b.click("#editor-name");
        await b.eval(`const n = document.getElementById("editor-name"); n.value = ${JSON.stringify(name)}; n.dispatchEvent(new Event("input", { bubbles: true })); return true;`);
        await b.key("Enter", "Enter", 13);
      }
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the save to close" });
      await b.eval(`const view = allDeckViews().find((v) => savedEqual(v.selection, selection)); openEditSheet(view.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor on the saved scale" });
    };
    const openHelp = async () => {
      await b.click("#editor-more");
      await b.click("#editor-placement-help");
      await b.waitFor(`!document.getElementById("editor-areas").hidden &&
        document.activeElement.id === "editor-hint-close"`, { label: "placement help and its focused Close button" });
    };
    const samplePoints = (sel) => b.eval(`
        return [...document.querySelectorAll(${JSON.stringify(sel)})].filter(el => el.getClientRects().length).map((el) => {
          const r = el.getBoundingClientRect();
          const miss = ${JSON.stringify(POINTS)}.filter(([fx, fy]) => {
            const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
            return !hit || !el.contains(hit);
          }).length;
          const h = document.elementFromPoint(r.left + r.width * .75, r.top + r.height * .25);
          return { id: el.id || el.textContent.slice(0, 20), miss, over: h && (h.id || h.className) };
        });
      `);

    for (const [w, h] of [[390, 844], [360, 640], [320, 568], [1280, 800]]) {
      test(`EHM menu over drawer handle ${w}x${h}: with the menu open every item is hit at five points`, async () => {
        await fresh(w, h);
        await openSaved(LONG_NAME);
        await b.click("#editor-delete");
        await pause(250);
        assert.strictEqual(await b.eval(`return document.getElementById("editor-menu").hidden;`), false, "the menu is open");
        const rows = await samplePoints("#editor-menu, #editor-menu .menuitem");
        const over = await b.eval(`
            const m = document.getElementById("editor-menu").getBoundingClientRect(), t = document.getElementById("drawerexp-handle").getBoundingClientRect();
            const l = Math.max(m.left, t.left), r = Math.min(m.right, t.right), tp = Math.max(m.top, t.top), bt = Math.min(m.bottom, t.bottom);
            if (r <= l || bt <= tp) return { overlap: false };
            const hit = document.elementFromPoint((l + r) / 2, (tp + bt) / 2);
            return { overlap: true, inMenu: !!hit && document.getElementById("editor-menu").contains(hit), hit: hit && (hit.id || hit.className) };
          `);
        assert.ok(!over.overlap || over.inMenu, "the drawer handle paints over the open menu: " + JSON.stringify(over));
        assert.ok(rows.some(row => row.id === "editor-placement-help"), "Placement help is a visible menu item");
        const bad = rows.filter((r) => r.miss > 0);
        assert.deepStrictEqual(bad, [], "menu items covered: " + JSON.stringify(bad));
      });
    }

    const walkTabs = async (w, h, line = SCALE) => {
      await fresh(w, h);
      await openAdd(); await typeLine(line);
      await openHelp();
      assert.strictEqual(await b.eval(`return document.getElementById("editor-areas").hidden;`), false, "the hint is open");
      const probe = `
          const el = document.activeElement, r = el.getBoundingClientRect(), areas = document.getElementById("editor-areas");
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { id: el.id || String(el.className.baseVal ?? el.className) || el.tagName, ok: !!hit && (el.contains(hit) || (!!el.closest("#editor-pan") && !areas.contains(hit))), hit: hit && (hit.id || String(hit.className.baseVal ?? hit.className)) };
      `;
      for (const shift of [false, true]) {
        for (let i = 1; i <= 8; i++) {
          const before = await b.eval(`const a = document.activeElement; return a.id || String(a.className.baseVal ?? a.className) || a.tagName;`);
          await b.eval(`window.__ehkPrev = document.activeElement; return true;`);
          for (const type of ["keyDown", "keyUp"]) {
            await b.send("Input.dispatchKeyEvent", {
              type, key: "Tab", code: "Tab", windowsVirtualKeyCode: 9,
              nativeVirtualKeyCode: 9, modifiers: shift ? 8 : 0
            });
          }
          await pause(40);
          const moved = await b.eval(`return document.activeElement !== window.__ehkPrev;`);
          assert.ok(moved, `${shift ? "Shift+" : ""}Tab ${i} from ${before} left focus where it was`);
          const r = await b.eval(probe);
          assert.ok(r.ok, `${shift ? "Shift+" : ""}Tab ${i} from ${before} lands under another element: ${JSON.stringify(r)}`);
        }
      }
    };
    for (const [w, h] of [[360, 640], [390, 844]]) {
      test(`EHM tab skips covered ${w}x${h}: with the hint open Tab always lands on a reachable control`, async () => {
        await walkTabs(w, h, NEO);
      });
    }
    for (const [w, h] of [[844, 390], [320, 568], [320, 400]]) {
      test(`EHK2 ${w}x${h} with the hint open Tab and Shift+Tab never land on a control under the card`, async () => {
        await walkTabs(w, h);
      });
    }

    test("EHK1 the menu opened from the keyboard with the hint open closes the hint first", async () => {
      await fresh(390, 844);
      await openAdd();
      await typeLine(NEO);
      await openHelp();
      assert.strictEqual(await b.eval(`return editorSession.hint;`), true, "the hint is open");
      await b.eval(`document.getElementById("editor-more").focus(); return true;`);
      assert.equal(await b.eval("return document.activeElement.id;"), "editor-more");
      await b.send("Input.dispatchKeyEvent", {
        type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r"
      });
      await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      await pause(100);
      assert.strictEqual(await b.eval(`return editorSession.menu;`), true, "the menu is open");
      assert.deepStrictEqual(await b.eval(`return [editorSession.hint, document.getElementById("editor-areas").hidden, document.getElementById("editor-hint-close").hidden];`), [false, true, true], "the hint closed");
    });

    test("EHK3 an armed Delete item shows the main pressed ink #5A49A6 while pressed", async () => {
      await fresh(390, 844);
      await openSaved();
      await b.click("#editor-delete");
      await pause(250);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-delete").classList.contains("armed");`), true, "the Delete is armed");
      await b.send("DOM.enable");
      await b.send("CSS.enable");
      const doc = await b.send("DOM.getDocument", { depth: 0 });
      const node = await b.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "#editor-delete" });
      const ink = () => b.eval(`return getComputedStyle(document.getElementById("editor-delete")).color;`);
      assert.strictEqual(await ink(), "rgb(36, 36, 36)", "at rest the armed ink is main's");
      await b.send("CSS.forcePseudoState", { nodeId: node.nodeId, forcedPseudoClasses: ["active"] });
      try {
        await b.settle();
        assert.strictEqual(await ink(), "rgb(90, 73, 166)");
      } finally {
        await b.send("CSS.forcePseudoState", { nodeId: node.nodeId, forcedPseudoClasses: [] });
      }
    });

    test("EHK4 1280x800 Placement help reopens the collapsed drawer and covers the tab strip", async () => {
      await fresh(1280, 800);
      await openAdd();
      await typeLine(NEO);
      await b.click("#drawerexp-handle");
      assert.strictEqual(await b.eval(`return document.getElementById("drawerexp-handle").getAttribute("aria-expanded");`), "false");
      await openHelp();
      assert.strictEqual(await b.eval(`return document.getElementById("drawerexp-handle").getAttribute("aria-expanded");`), "true");
      const r = await b.eval(`
          const areas = document.getElementById("editor-areas");
          return [...document.querySelectorAll("#editor-tabs .edtab")].map((el) => {
            const q = el.getBoundingClientRect(), hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
            return { id: el.id, covered: !!hit && areas.contains(hit) };
          });
        `);
      assert.ok(r.length > 0, "the tab strip exists");
      assert.deepStrictEqual(r.filter((x) => !x.covered), [], "tabs not under the card: " + JSON.stringify(r));
    });

    test("EHM tab skips covered: closing the hint restores the covered controls to the Tab order", async () => {
      await fresh(390, 844);
      await openAdd();
      await typeLine(NEO);
      const stops = () => b.eval(`return editorTabStops().map((e) => e.id);`);
      const closed = await stops();
      await openHelp();
      await b.click("#editor-hint-close");
      await pause(250);
      assert.deepStrictEqual(await stops(), closed);
      assert.ok(closed.includes("editor-name"));
    });

    for (const [w, h] of [[390, 844], [375, 667], [360, 640], [320, 568], [844, 390]]) {
      test(`EHC hint card ${w}x${h}: the open card covers the tabs and carries the close button at its top right`, async () => {
        await fresh(w, h);
        await openAdd();
        await typeLine(NEO);
        await openHelp();
        assert.strictEqual(await b.eval(`return document.getElementById("editor-areas").hidden;`), false, "the hint is open");
        const r = await b.eval(`
            const areas = document.getElementById("editor-areas"), card = areas.getBoundingClientRect();
            const tabs = [...document.querySelectorAll("#editor-tabs .edtab")].map((el) => {
              const q = el.getBoundingClientRect(), hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
              return { id: el.id, covered: !!hit && areas.contains(hit) };
            });
            const cb = document.getElementById("editor-hint-close"), c = cb.getBoundingClientRect();
            const hit = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
            const strip = document.getElementById("editor-tabs").getBoundingClientRect();
            return { tabs, closeHit: hit === cb, inside: c.left >= card.left - 1 && c.right <= card.right + 1 && c.top >= card.top - 1 && c.bottom <= card.bottom + 1,
              closeTop: c.top - card.top, cardTop: card.top, stripTop: strip.top,
              countsTop: document.getElementById("editor-counts").getBoundingClientRect().top - card.top,
              stops: editorTabStops().map((e) => e.id) };
          `);
        assert.ok(r.tabs.length >= 2 && r.tabs.every((t) => t.covered), "tab buttons covered by the card: " + JSON.stringify(r.tabs));
        assert.ok(r.closeHit, "the close button is hit at its centre: " + JSON.stringify(r));
        assert.ok(r.inside, "the close button sits inside the card: " + JSON.stringify(r));
        assert.ok(r.closeTop >= -1 && r.closeTop <= 12, "the close button is within 12px of the card top: " + r.closeTop);
        assert.ok(r.cardTop <= r.stripTop + .5, "the card top is at or above the tab strip: " + JSON.stringify(r));
        assert.ok(r.countsTop >= 0 && r.countsTop <= 24, "the counts row sits at the card top: " + r.countsTop);
        assert.ok(!r.stops.some((id) => id === "editor-tab-scale" || id === "editor-tab-layout"), "Tab skips the covered tabs: " + JSON.stringify(r.stops));
        assert.ok(r.stops.includes("editor-hint-close"), "the close button stays a Tab stop");
      });
    }

    for (const lang of ["en", "de"]) {
      test(`EHM delete space ${lang}: the armed delete item reads a space before the scale name`, async () => {
        await fresh(390, 844);
        await b.eval(`setLang(${JSON.stringify(lang)}); return true;`);
        await openSaved();
        await b.click("#editor-delete");
        const got = await b.eval(`const e = document.getElementById("editor-delete"), n = e.querySelector(".del-name");
          const tn = document.createTreeWalker(e, NodeFilter.SHOW_TEXT).nextNode(), rg = document.createRange();
          rg.setStart(tn, 0); rg.setEnd(tn, tn.textContent.trimEnd().length);
          const textRight = rg.getBoundingClientRect().right;
          return { name: n && n.textContent, armed: e.classList.contains("armed"), gap: n ? n.getBoundingClientRect().left - textRight : null, text: e.innerText };`);
        assert.strictEqual(got.armed, true);
        assert.ok(got.name && got.name.length > 0, "the name span exists");
        assert.ok(got.gap >= 2, "the rendered gap between the label and the name is a space wide: " + JSON.stringify(got));
      });
    }
  });

  describe("editor Neotone hint fit", () => {
    const LANGS = fs.readdirSync(path.join(REPO, "data/i18n")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
    let fallbackBrowser;
    before(async () => {
      fallbackBrowser = b;
      b = await launch({ foregroundSettle: true, realFonts: true });
    });
    after(async () => {
      const fontBrowser = b;
      b = fallbackBrowser;
      if (fontBrowser && fontBrowser !== fallbackBrowser) await fontBrowser.close();
    });
    for (const lang of LANGS) {
      test(`NM hint fit ${lang}: both Neotone hint lines fit`, async () => {
        for (const [w, h] of [[320, 568], [390, 844]]) {
          const label = `${lang} ${w}x${h}`;
          await fresh(w, h);
          await b.eval(`setLang(${JSON.stringify(lang)}); return true;`);
          await b.waitFor(`document.documentElement.lang === ${JSON.stringify(lang)}`, { label: lang });
          await openAdd();
          await typeLine("[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4");
          await b.click("#editor-type-neotone");
          await b.click("#editor-more");
          await b.click("#editor-placement-help");
          await b.waitFor(`!editorEl("editor-areas").hidden && document.activeElement.id === "editor-hint-close"`,
            { label: "Placement help and its focused Close button" });
          await b.eval("return document.fonts.ready.then(() => true);");
          const r = await b.eval(`
            const card = editorEl("editor-areas"), c = card.getBoundingClientRect();
            const lines = [...document.querySelectorAll("#editor-hint .neo-help")];
            const close = editorEl("editor-hint-close"), box = close.getBoundingClientRect();
            const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            return {
              copy: lines.map(line => line.textContent.trim()),
              expected: [t("editor.neo.pair_help"), t("editor.neo.name_hint")],
              closeHittable: close === hit || close.contains(hit),
              cardScroll: [card.scrollWidth - card.clientWidth, card.scrollHeight - card.clientHeight],
              out: lines.map(line => {
                const q = line.getBoundingClientRect();
                return { text: line.textContent.slice(0, 24), over: Math.max(
                  c.left - q.left, q.right - c.right, c.top - q.top, q.bottom - c.bottom,
                  line.scrollWidth - line.clientWidth
                ) };
              }).filter(entry => entry.over > 0.5)
            };
          `);
          assert.deepStrictEqual(r.copy, r.expected, label + ": localized Neotone help copy");
          assert.ok(r.cardScroll.every(overflow => overflow <= 0), label + ": help card does not scroll " + JSON.stringify(r));
          assert.deepStrictEqual(r.out, [], label + ": both Neotone lines fit inside the card");
          assert.equal(r.closeHittable, true, label + ": the Close button receives a tap");
          await b.click("#editor-hint-close");
          await b.waitFor(`editorEl("editor-areas").hidden && document.activeElement.id === "editor-more"`,
            { label: "closing Placement help returns focus to More" });
        }
      });
    }
  });

  describe("editor name field at 320x568 (NF, owner 2026-11-17)", () => {
    const pause = (ms) => new Promise((done) => setTimeout(done, ms));
    const LANDSCAPE_NF = [[667, 375], [844, 390]];
    const LANGS = ["en", "de", "es", "fr", "it", "ja", "zh-Hans", "zh-Hant"];
    const crowd = () => b.eval(`editorSession.error = t("editor.crowded", { pt: "2.71", floor: "3.6" }); editorRender(); return true;`);
    const geo = () => b.eval(`const inerts = [...document.querySelectorAll("[inert]")];
      inerts.forEach((el) => el.removeAttribute("inert"));
      try {
        const R = (e) => { const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right }; };
        const ed = document.getElementById("editor"), rg = document.getElementById("editor-region"), name = document.getElementById("editor-name");
        const n = R(name), strip = R(document.getElementById("editor-tabs")), reg = R(rg), tray = R(document.getElementById("editor-tray"));
        const hits = [[n.l + 8, n.t + 3], [(n.l + n.r) / 2, n.t + 3], [(n.l + n.r) / 2, (n.t + n.b) / 2], [n.r - 8, n.b - 3]]
          .map(([x, y]) => { const h = document.elementFromPoint(x, y); return h === name ? "self" : (h && (h.id || h.className)); });
        return { n, strip, reg, tray, hits, st: rg.scrollTop, max: rg.scrollHeight - rg.clientHeight, edTop: ed.scrollTop, kind: document.getElementById("editor-status").dataset.kind || "" };
      } finally { inerts.forEach((el) => el.setAttribute("inert", "")); }`);
    const openAt = async (w, h, lang) => {
      await fresh(w, h);
      await b.eval(`setLang(${JSON.stringify(lang)}); return true;`);
      await openAdd();
      await b.eval(`return document.fonts.ready.then(() => true);`);
      await typeLine(SCALE);
      await pause(250);
    };
    const trayGeometry = ({ atEnd = false, render = false } = {}) => b.eval(`
      const drawer = editorEl("drawerexp-body");
      if (${atEnd}) drawer.scrollTop = drawer.scrollHeight;
      const before = drawer.scrollTop;
      const bounds = element => {
        const { top, right, bottom, left } = element.getBoundingClientRect();
        return { top, right, bottom, left };
      };
      const hitOwn = element => {
        const { top, right, bottom, left } = bounds(element);
        return element.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2));
      };
      const saveBefore = bounds(editorEl("editor-save"));
      if (${render}) editorRender();
      const notes = document.querySelectorAll("#editor-notes button");
      const first = notes[0], octave = editorEl("editor-flats"), save = editorEl("editor-save");
      return {
        drawer: bounds(drawer), strip: bounds(editorEl("editor-tabs")), first: bounds(first), octave: bounds(octave),
        firstHit: hitOwn(first), octaveHit: hitOwn(octave), saveHit: hitOwn(save),
        saveBefore, saveAfter: bounds(save), before, top: drawer.scrollTop,
        max: drawer.scrollHeight - drawer.clientHeight, editorTop: editorEl("editor").scrollTop
      };
    `);
    const clear = (g, label) => {
      assert.ok(g.n.t >= g.strip.b - 0.5, `${label}: the name's top is not under the tab strip: ` + JSON.stringify(g));
      assert.ok(g.n.b <= g.reg.b + 0.5, `${label}: the name's bottom is inside the region: ` + JSON.stringify(g));
      assert.deepStrictEqual(g.hits, ["self", "self", "self", "self"], `${label}: the name takes taps at its corners and centre: ` + JSON.stringify(g));
    };
    describe("with real fonts", () => {
      let saved = null;
      before(async () => { saved = b; b = await launch({ foregroundSettle: true, realFonts: true }); });
      after(async () => { const mine = b; b = saved; await mine.close(); });
      for (const lang of LANGS) {
        test(`NF ${lang} 320x568: at rest and with the crowded error the name field sits fully below the tab strip and takes its own taps`, async () => {
          await openAt(320, 568, lang);
          clear(await geo(), `${lang} rest`);
          await crowd();
          await pause(250);
          const g = await geo();
          assert.strictEqual(g.kind, "error", "the crowded error shows: " + JSON.stringify(g));
          clear(g, `${lang} crowded`);
        });
      }
      test("NF en 320x568: scrolled to its end, a render leaves the region there and the octave row takes its taps", async () => {
        await openAt(320, 568, "en");
        const initial = await trayGeometry();
        // On hosts where the natural drawer fits at 568px, shorten the
        // viewport to exercise real drawer scrolling instead of a zero offset.
        if (initial.max <= 0) {
          await b.setViewport(320, 430, true);
          await b.waitFor(`editorEl("drawerexp-body").scrollHeight > editorEl("drawerexp-body").clientHeight`,
            { label: "an overflowed drawer on a shorter phone" });
        }
        const r = await trayGeometry({ atEnd: true, render: true });
        assert.ok(r.max > 0 && Math.abs(r.before - r.max) <= 1 && Math.abs(r.top - r.before) <= 1,
          "render preserves the user's drawer scroll at the end: " + JSON.stringify(r));
        assert.equal(r.editorTop, 0, "the editor itself does not scroll");
        assert.equal(r.octaveHit, true, "the last octave button takes its own tap");
        assert.equal(r.saveHit, true, "Save remains hittable");
        assert.deepStrictEqual(r.saveAfter, r.saveBefore, "Save stays pinned through render");
      });
      for (const [w, h] of [[360, 640], [375, 667], [390, 844]]) {
        test(`NF guard ${w}x${h}: in every language the region still rests at its end with the name clear of the strip`, async () => {
          for (const lang of LANGS) {
            await openAt(w, h, lang);
            const tray = await trayGeometry();
            assert.ok(Math.abs(tray.top - tray.max) <= 1,
              `${lang} ${w}x${h}: drawer rests at its end: ` + JSON.stringify(tray));
            clear(await geo(), `${lang} ${w}x${h}`);
          }
        });
      }
      for (const [w, h] of [[360, 640], [375, 667]]) {
        test(`NF guard ${w}x${h} crowded: in every language the name field clears the strip while a two-line error shows`, async () => {
          for (const lang of LANGS) {
            await openAt(w, h, lang);
            await crowd();
            await pause(250);
            const g = await geo();
            assert.strictEqual(g.kind, "error", `${lang} ${w}x${h}: the crowded error shows: ` + JSON.stringify(g));
            clear(g, `${lang} ${w}x${h} crowded`);
          }
        });
      }
      for (const [w, h] of [[320, 568], [375, 548]]) {
        test(`NF tray ${w}x${h}: at rest the first note row is in view and the region scrolls to the tray's end`, async () => {
          for (const lang of LANGS) {
            await openAt(w, h, lang);
            const rest = await trayGeometry();
            assert.ok(rest.first.top >= rest.strip.bottom - 0.5 && rest.first.bottom <= rest.drawer.bottom + 0.5,
              `${lang} ${w}x${h}: first note is fully in the drawer at rest: ` + JSON.stringify(rest));
            assert.equal(rest.firstHit, true, `${lang} ${w}x${h}: first note takes its own tap at rest`);
            const end = await trayGeometry({ atEnd: true });
            assert.ok(Math.abs(end.top - end.max) <= 1 && end.octave.bottom <= end.drawer.bottom + 0.5,
              `${lang} ${w}x${h}: the end brings the octave row into view: ` + JSON.stringify(end));
            assert.equal(end.octaveHit, true, `${lang} ${w}x${h}: the octave row takes taps at the end`);
            assert.equal(end.saveHit, true, `${lang} ${w}x${h}: Save is still tappable`);
            assert.deepStrictEqual(end.saveAfter, rest.saveBefore, `${lang} ${w}x${h}: scrolling only moves the drawer body`);
          }
        });
      }
      for (const [w, h] of LANDSCAPE_NF) {
        test(`NF guard ${w}x${h}: the landscape column is unchanged`, async () => {
          await openAt(w, h, "en");
          const before = await geo();
          const tray = await trayGeometry();
          clear(before, `${w}x${h} landscape`);
          assert.ok(before.tray.t >= before.n.b - 0.5, "the note tray is below the name field");
          assert.equal(tray.top, 0, "the landscape drawer opens at the start");
          assert.equal(tray.editorTop, 0, "the landscape editor itself does not scroll");
          assert.equal(tray.firstHit, true, "the first note takes taps");
          assert.equal(tray.saveHit, true, "the pinned Save takes taps");
          await crowd();
          const after = await geo();
          const feedback = await trayGeometry();
          assert.equal(after.kind, "error");
          assert.deepStrictEqual([after.n, after.strip, after.tray], [before.n, before.strip, before.tray],
            "floating feedback does not move the landscape drawer controls");
          assert.deepStrictEqual(feedback.saveAfter, tray.saveBefore, "floating feedback does not move Save");
          assert.equal(feedback.firstHit, true, "the first note takes taps while feedback is shown");
          assert.equal(feedback.saveHit, true, "Save takes taps while feedback is shown");
          clear(after, `${w}x${h} landscape crowded`);
        });
      }
    });
  });

  describe("editor cleanup", () => {
    const pause = (ms) => new Promise((done) => setTimeout(done, ms));
    const saveOne = async (w = 375, h = 667) => {
      await fresh(w, h);
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the save to close" });
      await b.eval(`const view = allDeckViews().find((v) => savedEqual(v.selection, selection)); openEditSheet(view.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor on the saved scale" });
    };
    const rename = (value) => b.eval(`const n = document.getElementById("editor-name"); n.focus(); n.value = ${JSON.stringify(value)};
      n.dispatchEvent(new Event("input", { bubbles: true })); n.blur(); return true;`);
    const names = () => b.eval(`return savedState.entries.map((e) => e.record.o.name).sort();`);
    const backAndWait = async () => {
      await b.eval(`history.back(); return true;`);
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden") || !!(document.getElementById("editor-dialog") && !document.getElementById("editor-dialog").hasAttribute("hidden"))`, { label: "back to settle" });
    };
    const remoteEdit = (name) => b.eval(`const id = editingBase.selection.id, row = savedState.entries.find((r) => r.instanceId === id),
      built = buildGenerated(row.record.s, { ...row.record.o, name: ${JSON.stringify(name)} });
      return commitSaved({ type: "edit", collectionId: savedState.collectionId, instanceId: id, expectedRevision: row.revision,
        candidate: { record: scaleRecord(seedOf(built.value)), deck: built.value } }).then((r) => r.ok === true);`);
    const broadcast = () => b.eval(`savedSnapshotListener({ source: "remote", previous: savedState, current: savedState }); return true;`);

    test("ECL2 one Save with an unacknowledged write leaves exactly one copy", async () => {
      await saveOne();
      await rename("DRAFT COPY");
      await b.eval(`editingBase = { ...editingBase, revision: editingBase.revision + 100 }; return true;`);
      const before = await savedCount();
      await b.eval(`window.__realCommit = commitSaved;
        commitSaved = async (c, o) => { const r = await window.__realCommit(c, o); return c.type === "save-as-separate" && r.ok ? { ...r, published: false, persistence: "durable" } : r; };
        document.getElementById("editor-save").click(); return true;`);
      await b.waitFor(`!savePending`, { label: "the save to finish" });
      await b.eval(`commitSaved = window.__realCommit; return true;`);
      assert.strictEqual(await savedCount(), before + 1, "one Save writes one copy");
    });

    describe("pasted navigation with the editor open", () => {
      test("ECL3 a pasted link with a dirty editor asks, keeps the draft and leaves no dead history entry", async () => {
        await fresh();
        const first = await b.eval(`return navigation.currentEntry.key;`);
        await openAdd();
        await typeLine(SCALE);
        const own = await b.eval(`return navigation.currentEntry.key;`);
        const route = await b.eval(`return location.hash;`);
        await b.eval(`location.hash = "#deck=kurd"; return true;`);
        await b.waitFor(`!!(document.getElementById("editor-dialog") && !document.getElementById("editor-dialog").hasAttribute("hidden"))`, { label: "the Save changes dialog" });
        assert.strictEqual(await sheetHidden(), false, "the draft page stays open");
        assert.match(await text(), /A4/, "the draft survives");
        await b.waitFor(`navigation.currentEntry.key === ${JSON.stringify(own)}`, { label: "the page's own entry to be current again" });
        assert.strictEqual(await b.eval(`return location.hash;`), route, "the address bar is back on the page route");
        await b.click("#editor-dlg-discard");
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "Discard to close the page" });
        await b.waitFor(`navigation.currentEntry.key === ${JSON.stringify(first)}`, { label: "history to end where it started" });
      });

      test("ECL3 a pasted link with a clean editor does not ask", async () => {
        await fresh();
        await openBuiltin();
        await b.eval(`location.hash = "#deck=kurd"; return true;`);
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the clean editor to close" });
        assert.strictEqual(await dialogOpen(), false);
      });
    });

    test("ECL6 a dirty editor guards unloading and a clean one does not", async () => {
      await fresh();
      await openAdd();
      const probe = () => b.eval(`const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented;`);
      assert.strictEqual(await probe(), false, "an untouched editor leaves freely");
      await typeLine(SCALE);
      assert.strictEqual(await probe(), true, "a dirty editor asks the browser to confirm");
    });

    test("ECL6 a second Back while the Save changes dialog is up keeps the draft", async () => {
      await fresh();
      await openAdd();
      await typeLine(SCALE);
      await backAndWait();
      assert.strictEqual(await dialogOpen(), true);
      await backAndWait();
      assert.strictEqual(await dialogOpen(), true, "the dialog is still up");
      assert.strictEqual(await sheetHidden(), false);
      assert.match(await text(), /A4/);
    });

    test("ECL7 a Delete tap on a rebound slot-owner explains why the scale was not removed", async () => {
      await fresh();
      await openBuiltin();
      const seed = await b.eval(`return editingBase.selection.id;`);
      await b.click("#editor-delete");
      assert.strictEqual(await b.eval(`return editorSession.delArmed;`), true);
      await b.eval(`const built = buildGenerated(HPE.core.formatSeed(editingBase.deck.fields), { ...editingBase.deck.options, name: "OWNER Y", replaces: ${JSON.stringify(seed)} });
        return commitSaved({ type: "replace-builtin", collectionId: savedState.collectionId, seedId: ${JSON.stringify(seed)}, expectedSlotStateRevision: editingBase.slotStateRevision, expectedOwnerId: null,
          candidate: { record: scaleRecord(seedOf(built.value)), deck: built.value } }).then((r) => r.ok);`);
      await broadcast();
      await b.waitFor(`editingBase.selection.kind === "saved"`, { label: "the editor to rebind to the slot owner" });
      const r = await b.eval(`return { armed: editorSession.delArmed, status: document.getElementById("editor-status").textContent, say: editorSession.say };`);
      assert.ok(!r.armed, "the rebind reset the armed Delete");
      assert.ok(r.status.length > 0, "the status row says something: " + JSON.stringify(r));
      assert.strictEqual(r.status, await b.eval(`return t("editor.rebound", { name: editedDeck().name });`));
    });

    test("ECL8 editing the name keeps an invalid-notes error on screen until the notes are valid", async () => {
      await fresh();
      await openAdd();
      await typeLine("(D3) A3 Q9 nonsense", { commit: true });
      const shown = await b.eval(`return { error: editorSession.error, status: document.getElementById("editor-status").textContent, editing: editorSession.editing };`);
      assert.ok(shown.error && shown.status === shown.error, "notes error is shown: " + JSON.stringify(shown));
      await b.eval(`const n = document.getElementById("editor-name"); n.focus(); n.value = "MY NAME";
        n.dispatchEvent(new Event("input", { bubbles: true })); n.blur(); return true;`);
      const after = await b.eval(`return { error: editorSession.error, status: document.getElementById("editor-status").textContent };`);
      assert.strictEqual(after.status, shown.status, "the error is still shown after the rename: " + JSON.stringify(after));
      assert.strictEqual(after.error, shown.error);
    });

    for (const [w, h] of [[360, 640], [390, 844]]) {
      test(`ECL9 ${w}x${h} a system Back closes the open menu, so Escape leaves the dialog and a second Escape never closes the editor`, async () => {
        await saveOne(w, h);
        await rename("ECL9 EDIT");
        await b.click("#editor-more");
        assert.strictEqual(await b.eval(`return editorSession.menu;`), true);
        await backAndWait();
        assert.strictEqual(await dialogOpen(), true);
        await b.key("Escape", "Escape", 27);
        const r = await b.eval(`return { dialog: editorSession.dialog, menu: editorSession.menu, hidden: document.getElementById("editor-menu").hasAttribute("hidden"),
          expanded: document.getElementById("editor-more").getAttribute("aria-expanded"), focus: document.activeElement && document.activeElement.id };`);
        assert.deepStrictEqual(r, { dialog: false, menu: false, hidden: true, expanded: "false", focus: "editor-back" }, JSON.stringify(r));
        await b.key("Escape", "Escape", 27);
        assert.strictEqual(await sheetHidden(), false, "the editor is still open");
        assert.strictEqual(await dialogOpen(), true, "Escape on a dirty editor asks first");
      });
    }

    for (const [w, h] of [[320, 568], [360, 640], [390, 844]]) {
      test(`ECL9 RR3 ${w}x${h}: the info button's top edge is not under the tab strip, even with the region scrolled to its end`, async () => {
        await fresh(w, h);
        await openAdd();
        await typeLine(SCALE);
        await pause(250);
        await b.eval(`const rg = document.getElementById("editor-region"); rg.scrollTop = rg.scrollHeight; return true;`);
        const r = await b.eval(`const inerts = [...document.querySelectorAll("[inert]")];
          inerts.forEach((el) => el.removeAttribute("inert"));
          try {
            const el = document.getElementById("editor-hint-toggle"), q = el.getBoundingClientRect();
            const hit = document.elementFromPoint(q.left + q.width / 2, q.top + 3);
            return { ok: !!hit && el.contains(hit), hit: hit && (hit.id || hit.className) };
          } finally { inerts.forEach((el) => el.setAttribute("inert", "")); }`);
        assert.ok(r.ok, "info button top-centre + 3px hits itself: " + JSON.stringify(r));
      });
    }

    test("ECL10 an unfinished rename blocks a remote snapshot from rebinding the clean editor", async () => {
      await saveOne();
      await b.eval(`editorSession.__probe = "local"; const n = document.getElementById("editor-name"); n.value = "TYPED NOT COMMITTED"; return true;`);
      assert.strictEqual(await remoteEdit("REMOTE RENAMED"), true, "the remote edit committed");
      await broadcast();
      await pause(200);
      const r = await b.eval(`return { same: editorSession.__probe === "local", name: document.getElementById("editor-name").value };`);
      assert.deepStrictEqual(r, { same: true, name: "TYPED NOT COMMITTED" });
    });

    test("ECL11 a system Back with an uncommitted rename asks first", async () => {
      await saveOne();
      await b.eval(`const n = document.getElementById("editor-name"); n.focus(); n.value = "UNCOMMITTED"; n.dispatchEvent(new Event("input", { bubbles: true })); return true;`);
      assert.strictEqual(await b.eval(`return editorSession.naming;`), true, "the name field is mid-edit");
      await backAndWait();
      assert.strictEqual(await dialogOpen(), true, "the Save changes dialog asks");
      assert.strictEqual(await sheetHidden(), false);
    });

  });

  describe("editor test gaps CL-U", () => {
    const saveOne = async (w = 375, h = 667) => {
      await fresh(w, h);
      await openAdd();
      await typeLine(SCALE);
      await b.click("#editor-save");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the save to close" });
      await b.eval(`const view = allDeckViews().find((v) => savedEqual(v.selection, selection)); openEditSheet(view.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor on the saved scale" });
    };
    const rename = (value) => b.eval(`const n = document.getElementById("editor-name"); n.focus(); n.value = ${JSON.stringify(value)};
      n.dispatchEvent(new Event("input", { bubbles: true })); n.blur(); return true;`);
    const names = () => b.eval(`return savedState.entries.map((e) => e.record.o.name).sort();`);
    const remoteEdit = (name) => b.eval(`const id = editingBase.selection.id, row = savedState.entries.find((r) => r.instanceId === id),
      built = buildGenerated(row.record.s, { ...row.record.o, name: ${JSON.stringify(name)} });
      return commitSaved({ type: "edit", collectionId: savedState.collectionId, instanceId: id, expectedRevision: row.revision,
        candidate: { record: scaleRecord(seedOf(built.value)), deck: built.value } }).then((r) => r.ok === true);`);
    const chipLabel = () => b.eval(`return document.querySelector("#decks .chip.on").textContent;`);

    test("CLU5 r3 an uncommitted rename guards unloading", async () => {
      await saveOne();
      const probe = () => b.eval(`const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented;`);
      assert.strictEqual(await probe(), false, "a clean editor leaves freely");
      await b.eval(`const n = document.getElementById("editor-name"); n.focus(); n.value = "UNCOMMITTED"; n.dispatchEvent(new Event("input", { bubbles: true })); return true;`);
      assert.strictEqual(await b.eval(`return editorSession.naming;`), true, "the name field is mid-edit and uncommitted");
      assert.strictEqual(await probe(), true, "a reload would lose the typed name, so the browser must ask");
    });

    test("CLU5 r4 a remote edit rebinding an unarmed clean editor shows no rebound message", async () => {
      await saveOne();
      assert.strictEqual(await b.eval(`return !editorSession.delArmed;`), true);
      assert.strictEqual(await remoteEdit("REMOTE RENAMED"), true);
      await b.eval(`savedSnapshotListener({ source: "remote", previous: savedState, current: savedState }); return true;`);
      await b.waitFor(`document.getElementById("editor-name").value === "REMOTE RENAMED"`, { label: "the editor to rebind to the remote edit" });
      const r = await b.eval(`return { status: document.getElementById("editor-status").textContent, say: editorSession.say };`);
      assert.deepStrictEqual(r, { status: "", say: "" }, "nothing was armed, so nothing is explained: " + JSON.stringify(r));
    });

    describe("history guard", () => {
      const raceDialog = async (button) => {
        await fresh();
        const first = await b.eval(`return navigation.currentEntry.key;`);
        await openAdd();
        await typeLine(SCALE);
        await b.eval(`window.__realBack = history.back.bind(history); window.__held = 0; history.back = () => { window.__held++; };
          location.hash = "#deck=kurd"; return true;`);
        await b.waitFor(`!!(document.getElementById("editor-dialog") && !document.getElementById("editor-dialog").hasAttribute("hidden")) && window.__held === 1`, { label: "the guard's own pop to be deferred" });
        await b.click(button);
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the page to close" });
        await b.eval(`history.back = window.__realBack; const n = window.__held; window.__held = 0; for (let i = 0; i < n; i++) history.back(); return true;`);
        await new Promise((r) => setTimeout(r, 600));
        await b.eval(`openScaleSheet(addChip); return true;`);
        await b.waitFor(`!!document.getElementById("editor-line") && !document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the page to reopen" });
        await b.eval(`history.back(); return true;`);
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the next system Back to close the page" });
        assert.strictEqual(await b.eval(`return navigation.currentEntry.key;`), first, "history ends where it started");
      };

      test("ECL12 after Discard in the Save changes dialog the next system Back closes the sheet", async () => {
        await raceDialog("#editor-dlg-discard");
      });

      test("ECL12 after Save in the Save changes dialog the next system Back closes the sheet", async () => {
        await raceDialog("#editor-dlg-save");
      });

      test("ECL13 a system Back with an invalid uncommitted notes line asks first", async () => {
        await fresh();
        await openAdd();
        await typeLine("zzz not a scale", { commit: false });
        await b.eval(`history.back(); return true;`);
        await b.waitFor(`!!(document.getElementById("editor-dialog") && !document.getElementById("editor-dialog").hasAttribute("hidden"))`, { label: "the Save changes dialog" });
        assert.strictEqual(await sheetHidden(), false, "the draft page stays open");
        assert.strictEqual(await text(), "zzz not a scale", "the line survives");
      });

      test("ECL13 BACK with an invalid uncommitted notes line asks first", async () => {
        await fresh();
        await openAdd();
        await typeLine("zzz not a scale", { commit: false });
        await b.eval(`editorBack(); return true;`);
        assert.strictEqual(await dialogOpen(), true, "the Save changes dialog asks");
        assert.strictEqual(await sheetHidden(), false);
      });
    });
  });

  describe("editor conflict auto-save (CAS)", () => {
    const TO = { timeout: 60000 };
    const TO13 = { timeout: 120000 };
    const tap = async (sel) => { await b.eval(`const e = document.querySelector(${JSON.stringify(sel)}); if (e && e.scrollIntoView) e.scrollIntoView({ block: "nearest" }); return true;`); await b.click(sel); };
    const pause = (ms) => new Promise((done) => setTimeout(done, ms));
    const closedExpr = `document.getElementById("scale-sheet").hasAttribute("hidden")`;
    const rename = (value) => b.eval(`const n = document.getElementById("editor-name"); n.focus(); n.value = ${JSON.stringify(value)};
      n.dispatchEvent(new Event("input", { bubbles: true })); n.blur(); return true;`);
    const names = () => b.eval(`return savedState.entries.map((e) => e.record.o.name).sort();`);
    const saveNamed = async (name, w = 375, h = 667) => {
      await fresh(w, h);
      await openAdd();
      await typeLine(SCALE);
      await rename(name);
      await tap("#editor-save");
      await b.waitFor(closedExpr, { label: "the first save to close" });
    };
    const editSaved = async () => {
      await b.eval(`const view = allDeckViews().find((v) => savedEqual(v.selection, selection)); openEditSheet(view.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor on the saved scale" });
    };
    const openSaved = async (name, w, h) => { await saveNamed(name, w, h); await editSaved(); };
    const remoteEdit = (name) => b.eval(`const id = editingBase.selection.id, row = savedState.entries.find((r) => r.instanceId === id),
      built = buildGenerated(row.record.s, { ...row.record.o, name: ${JSON.stringify(name)} });
      return commitSaved({ type: "edit", collectionId: savedState.collectionId, instanceId: id, expectedRevision: row.revision,
        candidate: { record: scaleRecord(seedOf(built.value)), deck: built.value } }).then((r) => r.ok === true);`);
    const remoteDelete = () => b.eval(`const id = editingBase.selection.id, row = savedState.entries.find((r) => r.instanceId === id);
      return commitSaved({ type: "delete", instanceId: id, expectedRevision: row.revision, collectionId: savedState.collectionId, ...editingBase.scope }).then((r) => r.ok === true);`);
    const broadcast = () => b.eval(`savedSnapshotListener({ source: "remote", previous: savedState, current: savedState }); return true;`);
    const staleRevision = () => b.eval(`editingBase = { ...editingBase, revision: editingBase.revision + 100 }; return true;`);
    const watchBanner = () => b.eval(`window.__banner = false;
      new MutationObserver(() => { if (document.getElementById("editor-conflict-msg")) window.__banner = true; }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      return true;`);
    const sawBanner = () => b.eval(`return window.__banner === true || !!document.getElementById("editor-conflict-msg");`);
    const sayRevision = () => b.eval(`return announcementRevision;`);
    const holdSecondCommit = () => b.eval(`const real = commitSaved; let n = 0; window.__real = real;
      commitSaved = (c, o) => { n++; if (n === 2) return new Promise((res) => { window.__release = () => res(real(c, o)); }); return real(c, o); }; return true;`);
    const armedDelete = async () => {
      await b.eval(`document.getElementById("editor-more").scrollIntoView({ block: "nearest" }); return true;`);
      await b.click("#editor-delete");
      await pause(500);
      await b.eval(`document.getElementById("editor-more").scrollIntoView({ block: "nearest" }); return true;`);
      await b.click("#editor-delete");
      await pause(300);
    };
    const NAME_OF = (n) => `savedState.entries.find((e) => e.record.o.name === ${JSON.stringify(n)})`;

    test("CAS1 a Save refused because the scale changed elsewhere saves the draft as a new scale with no message", TO, async () => {
      await saveNamed("ORIGINAL");
      const originalRev = await b.eval(`return savedState.entries[0].revision;`);
      await editSaved();
      await rename("DRAFT COPY");
      await staleRevision();
      await watchBanner();
      const said = await sayRevision();
      await tap("#editor-save");
      await b.waitFor(closedExpr, { label: "the automatic copy to close the sheet" });
      assert.deepStrictEqual(await names(), ["DRAFT COPY", "ORIGINAL"]);
      assert.strictEqual(await b.eval(`return ${NAME_OF("ORIGINAL")}.revision;`), originalRev, "the original row is untouched");
      assert.strictEqual(await b.eval(`return selection.id === ${NAME_OF("DRAFT COPY")}.instanceId;`), true, "the new scale is selected");
      assert.strictEqual(await sawBanner(), false, "no conflict banner ever showed");
      assert.strictEqual(await sayRevision(), said, "no success line and no say line for the retried copy");
    });

    test("CAS2 a Save refused because the scale was deleted elsewhere saves the draft as a new scale", TO, async () => {
      await openSaved("ORIGINAL");
      await rename("DRAFT COPY");
      assert.strictEqual(await remoteDelete(), true, "the peer deleted the scale");
      await tap("#editor-save");
      await b.waitFor(closedExpr, { label: "the automatic copy to close the sheet" });
      assert.deepStrictEqual(await names(), ["DRAFT COPY"]);
      assert.strictEqual(await sawBanner(), false);
    });

    test("CAS3 a Save refused by a whole-list change writes exactly one new scale", TO, async () => {
      await openSaved("ORIGINAL");
      const before = await savedCount();
      await rename("DRAFT COPY");
      await b.eval(`editingBase = { ...editingBase, collectionId: "00000000-0000-4000-8000-000000000000" }; return true;`);
      await tap("#editor-save");
      await b.waitFor(closedExpr, { label: "the automatic copy to close the sheet" });
      assert.deepStrictEqual(await names(), ["DRAFT COPY", "ORIGINAL"]);
      assert.strictEqual(await savedCount(), before + 1, "exactly one new scale");
    });

    test("CAS4 a built-in Save refused by a whole-list change writes one new scale and leaves the built-in", TO, async () => {
      await fresh(375, 667);
      await openBuiltin();
      await rename("BUILTIN DRAFT");
      await b.eval(`editingBase = { ...editingBase, collectionId: "00000000-0000-4000-8000-000000000000" }; return true;`);
      await tap("#editor-save");
      await b.waitFor(closedExpr, { label: "the automatic copy to close the sheet" });
      assert.deepStrictEqual(await names(), ["BUILTIN DRAFT"]);
      assert.strictEqual(await b.eval(`return savedState.hidden.length === 0 && savedEntries.size === 1 && savedState.entries[0].record.o.replaces === undefined;`), true, "the built-in is neither hidden nor replaced");
    });

    test("CAS5 a new scale refused by a whole-list change writes one new scale", TO, async () => {
      await fresh(375, 667);
      await openAdd();
      await typeLine(SCALE);
      await rename("NEW DRAFT");
      await b.eval(`savedState = { ...savedState, collectionId: "00000000-0000-4000-8000-000000000000" }; return true;`);
      await tap("#editor-save");
      await b.waitFor(closedExpr, { label: "the automatic copy to close the sheet" });
      assert.deepStrictEqual(await names(), ["NEW DRAFT"]);
      assert.strictEqual(await savedCount(), 1);
    });

    test("CAS6 a second refusal keeps the draft with the failure message and retries only once", TO, async () => {
      await openSaved("ORIGINAL");
      await rename("DRAFT COPY");
      await b.eval(`window.__calls = []; commitSaved = async (c) => { window.__calls.push(c.type); return { ok: false, kind: "conflict" }; }; return true;`);
      await tap("#editor-save");
      await b.waitFor(`window.__calls.length >= 2 && !savePending`, { label: "the retry to finish" });
      await pause(300);
      assert.deepStrictEqual(await b.eval(`return window.__calls;`), ["edit", "save-as-separate"]);
      assert.strictEqual(await b.eval(`return editorSession.error === t("saved.failure");`), true, "the existing failure message shows");
      assert.strictEqual(await sheetHidden(), false, "the draft stays open");
      assert.strictEqual(await b.eval(`return document.getElementById("editor-name").value;`), "DRAFT COPY");
    });

    test("CAS7 Save stays disabled while the automatic copy waits", TO, async () => {
      await openSaved("ORIGINAL");
      await rename("DRAFT COPY");
      await staleRevision();
      await holdSecondCommit();
      await tap("#editor-save");
      await b.waitFor(`typeof window.__release === "function"`, { label: "the automatic copy to wait" });
      assert.deepStrictEqual(await b.eval(`return [document.getElementById("editor-save").disabled, editorSubmitOff(editorSession, editorSession.history.present)];`), [true, true]);
      await b.eval(`window.__release(); return true;`);
      await b.waitFor(`!savePending`, { label: "the held copy to finish" });
      assert.deepStrictEqual(await names(), ["DRAFT COPY", "ORIGINAL"]);
    });

    test("CAS8 a draft that moved during the automatic copy keeps the editor open on the copy", TO, async () => {
      await openSaved("ORIGINAL");
      await rename("DRAFT COPY");
      await staleRevision();
      await holdSecondCommit();
      await tap("#editor-save");
      await b.waitFor(`typeof window.__release === "function"`, { label: "the automatic copy to wait" });
      await b.eval(`editorSession.history = editorApply(editorSession.history, (m) => editorSetName(m, "MOVED ON")).history; editorRender(); return true;`);
      await b.eval(`window.__release(); return true;`);
      await b.waitFor(`!savePending`, { label: "the held copy to finish" });
      assert.strictEqual(await sheetHidden(), false, "the editor stays open on the moved draft");
      assert.strictEqual(await b.eval(`return editingBase.selection.id === ${NAME_OF("DRAFT COPY")}.instanceId;`), true, "the editor is bound to the copy");
      assert.strictEqual(await b.eval(`return editorSession.error;`), "");
      assert.strictEqual(await sawBanner(), false);
    });

    test("CAS9 a Save after a remote edit keeps the remote scale and makes a copy", TO, async () => {
      await openSaved("ORIGINAL");
      await rename("LOCAL DRAFT");
      assert.strictEqual(await remoteEdit("REMOTE WINNER"), true, "the remote edit committed");
      await tap("#editor-save");
      await b.waitFor(closedExpr, { label: "the automatic copy to close the sheet" });
      assert.deepStrictEqual(await names(), ["LOCAL DRAFT", "REMOTE WINNER"]);
    });

    test("CLU4 a missed broadcast then Save keeps the real winner and saves the draft as a new scale", TO, async () => {
      await openSaved("ORIGINAL");
      await rename("LOSING LOCAL DRAFT");
      await b.eval(`window.__stale = { state: savedClone(savedState), entries: [...savedEntries] }; return true;`);
      assert.strictEqual(await remoteEdit("WINNING PEER"), true, "the peer edit committed");
      await b.eval(`const st = window.__stale; savedState = st.state; savedEntries.clear(); for (const [k, v] of st.entries) savedEntries.set(k, v); buildChips(); return true;`);
      assert.deepStrictEqual(await names(), ["ORIGINAL"], "this tab never heard the peer: it still holds the old row");
      await tap("#editor-save");
      await b.waitFor(closedExpr, { label: "the automatic copy to close the sheet" });
      assert.deepStrictEqual(await names(), ["LOSING LOCAL DRAFT", "WINNING PEER"]);
      assert.strictEqual(await sawBanner(), false);
    });

    test("CAS10 a Delete refused because the scale changed elsewhere keeps it and says so", TO, async () => {
      await openSaved("ORIGINAL");
      await rename("LOCAL DRAFT");
      assert.strictEqual(await remoteEdit("REMOTE EDIT"), true);
      const hidden = await b.eval(`return savedState.hidden.length;`);
      await armedDelete();
      await b.waitFor(`document.getElementById("editor-status").textContent === t("editor.say.del_kept")`, { label: "the kept line" });
      assert.deepStrictEqual(await b.eval(`const d = document.getElementById("editor-delete"), st = document.getElementById("editor-status");
        return { error: editorSession.error, kind: st.getAttribute("data-kind"), armed: d.classList.contains("armed") || editorSession.delArmed,
          buttons: st.querySelectorAll("button").length, banner: !!document.getElementById("editor-conflict-msg") };`),
        { error: "", kind: null, armed: false, buttons: 0, banner: false });
      assert.deepStrictEqual(await names(), ["REMOTE EDIT"], "the scale still exists");
      await armedDelete();
      await armedDelete();
      assert.deepStrictEqual(await names(), ["REMOTE EDIT"], "further taps never delete it");
      assert.strictEqual(await b.eval(`return savedState.hidden.length;`), hidden);
    });

    test("CAS11 a Delete refused because the scale is gone closes the editor silently and never deletes the saved fallback", TO, async () => {
      await openSaved("ORIGINAL");
      await rename("LOCAL DRAFT");
      assert.strictEqual(await remoteDelete(), true);
      let said = await sayRevision();
      await armedDelete();
      await b.waitFor(closedExpr, { label: "the editor to close silently" });
      assert.strictEqual(await sayRevision(), said, "no say line");
      assert.strictEqual(await sawBanner(), false);
      assert.strictEqual(await savedCount(), 0);
      await fresh(375, 667);
      await openAdd();
      await typeLine(SCALE);
      await rename("FALLBACK");
      await tap("#editor-save");
      await b.waitFor(closedExpr, { label: "the fallback save to close" });
      await b.eval(`const v = allDeckViews().find((x) => x.selection.kind === "builtin"); selectDeck(v.selection, false); openEditSheet(v.deck, addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line") && editingBase.selection.kind === "builtin"`, { label: "the editor on a built-in" });
      await rename("BUILTIN DRAFT");
      await b.eval(`return commitSaved({ type: "hide-builtin", seedId: editingBase.selection.id, expectedSlotStateRevision: editingBase.slotStateRevision, expectedOwnerId: editingBase.ownerId, collectionId: savedState.collectionId }).then((r) => r.ok);`);
      said = await sayRevision();
      await armedDelete();
      await b.waitFor(closedExpr, { label: "the editor to close silently on the hidden built-in" });
      assert.strictEqual(await sayRevision(), said, "no say line");
      assert.strictEqual(await sawBanner(), false);
      assert.deepStrictEqual(await names(), ["FALLBACK"], "the saved fallback survives");
    });

    test("CAS12 a broadcast remote deletion of the open saved scale leaves the editor and its draft", TO, async () => {
      await openSaved("ORIGINAL");
      assert.strictEqual(await remoteDelete(), true);
      await broadcast();
      await pause(400);
      assert.strictEqual(await sawBanner(), false, "no conflict banner");
      assert.strictEqual(await sheetHidden(), false, "the editor stays open");
      assert.strictEqual(await b.eval(`return document.getElementById("editor-name").value;`), "ORIGINAL", "the draft stays in the field");
    });

    const CAS13_VIEWPORTS = [[375, 667], [390, 844], [430, 932], [768, 1024], [844, 390], [667, 375], [1024, 768]];
    const CAS13_CASES = [...["en", "de", "fr", "it", "es", "ja", "zh-Hant", "zh-Hans"].map((l) => [320, 568, l]),
      ...CAS13_VIEWPORTS.flatMap(([w, h]) => ["en", "de"].map((l) => [w, h, l]))];
    for (const [w, h, lang] of CAS13_CASES) {
      test(`CAS13 ${w}x${h} ${lang}: the delete line keeps the tabs and name within 1px and covers no pan circle`, TO13, async () => {
        await fresh(w, h);
        await b.eval(`setLang(${JSON.stringify(lang)}); return true;`);
        await openAdd();
        await typeLine(SCALE);
        await rename("ORIGINAL");
        await tap("#editor-save");
        await b.waitFor(closedExpr, { label: "the first save to close" });
        await editSaved();
        await rename("LOCAL DRAFT");
        await pause(300);
        const rects = () => b.eval(`const r = (el) => { const q = el.getBoundingClientRect(); return [q.left, q.top, q.width, q.height]; };
          return { tabs: [...document.querySelectorAll("#editor-tabs > *")].map(r), name: r(document.getElementById("editor-name")) };`);
        await b.eval(`document.getElementById("editor-more").scrollIntoView({ block: "nearest" }); return true;`);
        await pause(200);
        const rest = await rects();
        assert.strictEqual(await remoteEdit("REMOTE EDIT"), true);
        await armedDelete();
        await b.waitFor(`document.getElementById("editor-status").textContent === t("editor.say.del_kept")`, { label: "the kept line" });
        await b.eval(`return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));`);
        const now = await rects();
        const close = (a, c) => a.length === c.length && a.every((v, i) => Math.abs(v - c[i]) <= 1);
        assert.ok(rest.tabs.length >= 2 && rest.tabs.every((q, i) => close(q, now.tabs[i])), "the tab strip is where it rested: " + JSON.stringify({ rest, now }));
        assert.ok(close(rest.name, now.name), "the name field is where it rested: " + JSON.stringify({ rest, now }));
        const bad = await b.eval(`const pan = document.getElementById("editor-pan"), svg = pan.querySelector("svg"), status = document.getElementById("editor-status"), bad = [];
          const scan = (tag) => {
            for (const c of pan.querySelectorAll("circle")) {
              const q = c.getBoundingClientRect();
              if (!q.width) continue;
              for (const [fx, fy] of [[0.5, 0.5], [0.5, 0.15], [0.5, 0.85], [0.15, 0.5], [0.85, 0.5]]) {
                const hit = document.elementFromPoint(q.left + q.width * fx, q.top + q.height * fy);
                if (hit && status.contains(hit)) bad.push(tag + ":" + (c.getAttribute("aria-label") || "") + "->" + (hit.id || hit.tagName));
              }
            }
          };
          scan("rest");
          svg.scrollIntoView({ block: "center" });
          scan("scrolled");
          return { bad, n: pan.querySelectorAll("circle").length };`);
        assert.ok(bad.n > 0 && bad.bad.length === 0, "the delete line covers no pan circle: " + JSON.stringify(bad));
      });
    }

    test("CAS14 a Delete on a clean editor whose scale changed in a missed broadcast rebinds and shows the kept line", TO, async () => {
      await openSaved("ORIGINAL");
      assert.strictEqual(await remoteEdit("WINNER"), true, "the peer edit committed with no broadcast");
      const generation = await b.eval(`return sheetGeneration;`);
      await armedDelete();
      await b.waitFor(`editorSession && editorSession.say === t("editor.say.del_kept")`, { label: "the kept line on the rebound session" });
      assert.deepStrictEqual(await b.eval(`const st = document.getElementById("editor-status");
        return { moved: sheetGeneration !== ${generation}, rebound: editorSession.say === t("editor.rebound", { name: "WINNER" }), armed: editorSession.delArmed,
          kind: st.getAttribute("data-kind"), name: document.getElementById("editor-name").value, text: st.textContent === t("editor.say.del_kept") };`),
        { moved: true, rebound: false, armed: false, kind: null, name: "WINNER", text: true });
      assert.deepStrictEqual(await names(), ["WINNER"], "the scale is not deleted");

      await openSaved("SECOND");
      assert.strictEqual(await remoteEdit("SECOND WINNER"), true);
      await b.eval(`window.__realRec = reconcileSavedCollection; reconcileSavedCollection = async () => { await new Promise((r) => { window.__relRec = r; }); return window.__realRec(); }; return true;`);
      await armedDelete();
      await b.waitFor(`typeof window.__relRec === "function"`, { label: "the reconcile to wait" });
      await b.eval(`closeScaleSheet(); openScaleSheet(addChip); return true;`);
      await b.waitFor(`!!document.getElementById("editor-line")`, { label: "a different session" });
      await b.eval(`window.__relRec(); return true;`);
      await pause(600);
      assert.strictEqual(await b.eval(`return editorSession.say === "" && !document.getElementById("editor-status").textContent.includes(t("editor.say.del_kept"));`), true, "the new session gets no kept line");
    });

    test("CAS15 a Delete on a clean editor whose scale was removed elsewhere closes silently", TO, async () => {
      await openSaved("ORIGINAL");
      assert.strictEqual(await remoteDelete(), true, "the peer deleted the scale with no broadcast");
      const said = await sayRevision();
      await armedDelete();
      await b.waitFor(closedExpr, { label: "the editor to close silently" });
      assert.strictEqual(await sayRevision(), said, "no say line");
      assert.strictEqual(await b.eval(`return editorSession === null;`), true);
      assert.strictEqual(await sawBanner(), false);
      assert.strictEqual(await savedCount(), 0, "nothing else was deleted");
    });
  });

  describe("RC fixes: octave 3, the name placeholder and the first bottom note (TRI-59 rc-fixes)", () => {
    const pause = (ms) => new Promise((done) => setTimeout(done, ms));
    const LANGS = ["en", "de", "es", "fr", "it", "ja", "zh-Hans", "zh-Hant"];
    const placeholder = () => b.eval(`return document.getElementById("editor-name").placeholder;`);
    const octave = () => b.eval(`return document.getElementById("editor-oct").textContent;`);
    const bottomAngles = () => b.eval(`const a = editorSession.history.present.options.angles; return a && a.bottom ? a.bottom : null;`);
    const kind = () => b.eval(`return editorSession.kind;`);

    test("L1 every editor opens on octave 3: Add, a built-in, and the accessible name", async () => {
      await fresh();
      await openAdd(3);
      assert.strictEqual(await octave(), "3");
      assert.strictEqual(await b.eval(`return document.getElementById("editor-oct").getAttribute("aria-label");`), "Octave 3");
      await b.click("#editor-back");
      await openBuiltin();
      assert.strictEqual(await octave(), "3");
    });

    test("L1 tapping a tray chip on a new scale places an octave 3 note", async () => {
      await fresh();
      await openAdd(3);
      await b.click('.tray-note[data-name="D"]');
      assert.strictEqual(await b.eval(`return editorSession.held.k !== undefined && editorHeldName();`), "D3");
    });

    test("L2 the name box hints the auto name once the scale is valid, and stays empty while the stage is empty or only staged", async () => {
      await fresh();
      await openAdd(3);
      assert.strictEqual(await placeholder(), "");
      await b.click('.tray-note[data-name="A"]');
      await place("bottom");
      assert.strictEqual(await b.eval(`return editorIsEmpty(editorSession.history.present);`), true, "only staged");
      assert.strictEqual(await placeholder(), "", "no hint while only staged");
      await b.click("#editor-back");
      await b.eval(`const d = document.getElementById("editor-dialog"); if (d && !d.hasAttribute("hidden")) { const x = d.querySelector("button"); if (x) x.click(); } return true;`);
      await fresh();
      await openAdd(3);
      await typeLine(SCALE);
      const auto = await b.eval(`return editorAutoName(editorSession.history.present);`);
      assert.strictEqual(await placeholder(), await b.eval(`return t("editor.name.auto", { name: ${JSON.stringify(auto)} });`));
      assert.strictEqual(await placeholder(), "Auto: " + auto);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-name").value;`), "", "the box itself stays empty");
      assert.strictEqual(await b.eval(`return editorSession.history.present.options.name || "";`), "", "the hint is never stored");
    });

    test("L3 a new scale's first tapped bottom note is stored at 270 and registered as a pin; a second note keeps it U1", async () => {
      await fresh();
      await openAdd(3);
      await typeLine(SCALE);
      assert.strictEqual(await kind(), "new");
      await b.click('.tray-note[data-name="A"]');
      await place("bottom");
      assert.deepStrictEqual(await bottomAngles(), [270]);
      assert.strictEqual(await b.eval(`return editorSession.history.present.pins.some((p) => p.ring === "bottom");`), true);
      assert.strictEqual(await b.eval(`return document.getElementById("editor-reset").disabled;`), false, "Reset spacing is enabled");
      await b.click('.tray-note[data-name="B"]');
      await place("bottom");
      const r = await b.eval(`const f = editorSolve(editorSession.history.present).value.fields; const o = {}; for (const id of Object.keys(f)) if (f[id][3] === "bottom") o[f[id][0] + f[id][1]] = { a: f[id][4], l: f[id][5] }; return o;`);
      assert.strictEqual(r.A3.a, 270);
      assert.strictEqual(r.A3.l, "U1");
    });

    test("L3 on the empty stage a new scale's first bottom note is staged at 270 and the ghost draws it there", async () => {
      await fresh();
      await openAdd(3);
      await b.click('.tray-note[data-name="A"]');
      await place("bottom");
      assert.deepStrictEqual(await b.eval(`return editorSession.history.present.stage.angles;`), [270]);
      assert.strictEqual(await b.eval(`const f = editorSolve(editorSession.history.present).value.fields; return Object.values(f).find((x) => x[3] === "bottom")[4];`), 270);
    });

    test("L3 editing a saved scale and a built-in never takes the default, a typed bottom never does either", async () => {
      await fresh();
      await openBuiltin();
      assert.strictEqual(await kind(), "builtin");
      await b.click('.tray-note[data-name="A"]');
      await place("bottom");
      assert.strictEqual(await bottomAngles(), null);
      await b.click("#editor-back");
      await fresh();
      await openAdd(3);
      await typeLine("[A2] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4");
      const expected = await b.eval(`const keep = editorSession, m = keep.history.present; editorSession = null; const r = editorPlace(m, "bottom", "B3"); editorSession = keep; return r.value.options.angles.bottom;`);
      await b.click('.tray-note[data-name="B"]');
      await place("bottom");
      assert.deepStrictEqual(await bottomAngles(), expected, "the same as a placement with no new-scale session");
    });

    test("L3 a Save that keeps the editor open ends the new-scale default", async () => {
      await fresh();
      await openAdd(3);
      await typeLine(SCALE);
      await b.eval(`window.__sv = editorSave(); document.getElementById("editor-line").value = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4"; return true;`);
      await b.waitFor(`!!editorSession && editorSession.kind === "saved"`, { label: "the session to stop being new" });
      await b.click('.tray-note[data-name="A"]');
      await place("bottom");
      assert.strictEqual(await bottomAngles(), null);
    });

    describe("staged bottom notes tapped out of pitch order (review round 1)", () => {
      const polar = (r, deg) => [r * Math.cos(deg * Math.PI / 180), r * Math.sin(deg * Math.PI / 180)];
      const clientOf = (x, y) => b.eval(`const svg = document.querySelector("#editor-pan svg"); const p = new DOMPoint(${x} * 100, -(${y}) * 100).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y };`);
      const spotAt = async (ring, deg) => clientOf(...polar(await b.eval(`return editorOrbit(editorSolve(editorSession.history.present).value.geom, ${JSON.stringify(ring)});`), deg));
      const dingAt = async () => clientOf(0, -(await b.eval(`return editorSolve(editorSession.history.present).value.geom.ding_dy;`)));
      const tap = async (pt) => { for (const type of ["mousePressed", "mouseReleased"]) await b.send("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", clickCount: 1 }); };
      const solved = () => b.eval(`const s = editorSolve(editorSession.history.present); return Object.fromEntries(Object.values(s.value.fields).filter((f) => f[3] === "bottom").map((f) => [f[0] + f[1], [f[4], f[5]]]));`);
      const buildTop = async () => {
        await b.click('.tray-note[data-name="D"]');
        await tap(await dingAt());
        for (const [n, deg] of [["A", 20], ["B", 60], ["C", 100], ["D", 140]]) {
          await b.click('.tray-note[data-name="' + n + '"]');
          await tap(await spotAt("rim", deg));
        }
      };

      test("tapped angles: A at 100 then a lower C at 200 keep their angles when the scale completes", async () => {
        await fresh();
        await openAdd(3);
        await b.click('.tray-note[data-name="A"]');
        await tap(await spotAt("bottom", 100));
        await b.click("#editor-oct-down");
        await b.click('.tray-note[data-name="C"]');
        await tap(await spotAt("bottom", 200));
        await b.click("#editor-oct-up");
        const preview = await solved();
        await buildTop();
        assert.strictEqual(await b.eval(`return editorIsEmpty(editorSession.history.present);`), false, "the scale completed");
        const after = await solved();
        assert.deepStrictEqual([after.A3[0], after.C2[0]], [preview.A3[0], preview.C2[0]], "no swap at commit");
        assert.deepStrictEqual([after.A3[0], after.C2[0]], [100, 200]);
      });

      test("the 270 default stays on the note pushed first when a lower note follows", async () => {
        await fresh();
        await openAdd(3);
        await b.click('.tray-note[data-name="A"]');
        await place("bottom");
        await b.click("#editor-oct-down");
        await b.click('.tray-note[data-name="C"]');
        await place("bottom");
        await b.click("#editor-oct-up");
        await buildTop();
        assert.strictEqual(await b.eval(`return editorIsEmpty(editorSession.history.present);`), false, "the scale completed");
        const after = await solved();
        assert.deepStrictEqual(after.A3, [270, "U1"]);
      });
    });

    describe("a staged pin is never dropped from the preview (round 3)", () => {
      const polar = (r, deg) => [r * Math.cos(deg * Math.PI / 180), r * Math.sin(deg * Math.PI / 180)];
      const clientOf = (x, y) => b.eval(`const svg = document.querySelector("#editor-pan svg"); const p = new DOMPoint(${x} * 100, -(${y}) * 100).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y };`);
      const spotAt = async (ring, deg) => clientOf(...polar(await b.eval(`return editorOrbit(editorSolve(editorSession.history.present).value.geom, ${JSON.stringify(ring)});`), deg));
      const dingAt = async () => clientOf(0, -(await b.eval(`return editorSolve(editorSession.history.present).value.geom.ding_dy;`)));
      const tap = async (pt) => { for (const type of ["mousePressed", "mouseReleased"]) await b.send("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", clickCount: 1 }); };
      const bottoms = () => b.eval(`const s = editorSolve(editorSession.history.present); return Object.fromEntries(Object.values(s.value.fields).filter((f) => f[3] === "bottom").map((f) => [f[0] + f[1], f[4]]));`);

      test("D3 ding, A2 free, B2 tapped at 100, then a free C3: the preview keeps both pins, the pushes are refused or all fit, and the fifth note commits", async () => {
        await fresh();
        await openAdd(3);
        await b.click('.tray-note[data-name="D"]');
        await tap(await dingAt());
        await b.click("#editor-oct-down");
        await b.click('.tray-note[data-name="A"]');
        await place("bottom");
        await b.click('.tray-note[data-name="B"]');
        await tap(await spotAt("bottom", 100));
        await b.click("#editor-oct-up");
        await b.click('.tray-note[data-name="C"]');
        await place("bottom");
        const stage = await b.eval(`return editorSession.history.present.stage;`);
        const shown = await bottoms();
        assert.strictEqual(shown.A2, 270, "the preview keeps the 270 pin");
        assert.strictEqual(shown.B2, 100, "the preview keeps the tapped pin");
        await b.click('.tray-note[data-name="A"]');
        await tap(await spotAt("rim", 20));
        assert.strictEqual(await b.eval(`return editorIsEmpty(editorSession.history.present);`), false, "the fifth note committed: " + JSON.stringify(stage));
      });
    });

    for (const [w, h] of [[320, 568], [375, 667], [844, 390]]) {
      test(`L2 ${w}x${h}: the placeholder moves nothing and covers no pan circle`, async () => {
        await fresh(w, h);
        await openAdd(3);
        await b.eval(`return document.fonts.ready.then(() => true);`);
        await typeLine(SCALE);
        await pause(250);
        const geo = () => b.eval(`const inerts = [...document.querySelectorAll("[inert]")]; inerts.forEach((e) => e.removeAttribute("inert"));
          try {
            const R = (e) => { const r = e.getBoundingClientRect(); return [r.top, r.left, r.width, r.height]; };
            const pan = document.getElementById("editor-pan"), q = pan.getBoundingClientRect();
            const pts = [[0.5, 0.5], [0.12, 0.12], [0.88, 0.12], [0.12, 0.88], [0.88, 0.88]].map(([fx, fy]) => { const h = document.elementFromPoint(q.left + q.width * fx, q.top + q.height * fy); return !!h && pan.contains(h); });
            return { name: R(document.getElementById("editor-name")), tabs: R(document.getElementById("editor-tabs")), pts };
          } finally { inerts.forEach((e) => e.setAttribute("inert", "")); }`);
        const withHint = await geo();
        assert.match(await placeholder(), /^Auto: /);
        await b.eval(`document.getElementById("editor-name").placeholder = ""; return true;`);
        const rest = await geo();
        for (const k of ["name", "tabs"]) withHint[k].forEach((v, i) => assert.ok(Math.abs(v - rest[k][i]) <= 1, `${k}[${i}] ${v} vs ${rest[k][i]}`));
        assert.deepStrictEqual(withHint.pts, [true, true, true, true, true], "the pan is hit at its centre and four insets");
      });
    }

    describe("with real fonts", () => {
      let saved = null;
      before(async () => { saved = b; b = await launch({ foregroundSettle: true, realFonts: true }); });
      after(async () => { const mine = b; b = saved; await mine.close(); });
      for (const lang of LANGS) {
        test(`L2 ${lang} 320x568: the placeholder text fits the name box on one line`, async () => {
          await fresh(320, 568);
          await b.eval(`setLang(${JSON.stringify(lang)}); return true;`);
          await openAdd(3);
          await b.eval(`return document.fonts.ready.then(() => true);`);
          await typeLine("[A2] [B2] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5");
          await pause(250);
          const r = await b.eval(`const n = document.getElementById("editor-name"), c = getComputedStyle(n), cv = document.createElement("canvas").getContext("2d");
            cv.font = c.fontStyle + " " + c.fontWeight + " " + c.fontSize + " " + c.fontFamily;
            const inner = n.clientWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight);
            return { text: n.placeholder, w: cv.measureText(n.placeholder).width, inner };`);
          assert.ok(r.text.length > 0 && r.w <= r.inner, lang + ": " + JSON.stringify(r));
          assert.strictEqual(r.text, await b.eval(`return t("editor.name.auto", { name: editorAutoName(editorSession.history.present) });`));
        });
      }
    });
  });

}

function DECK_IDS_HAVE(builtinJson, id) {
  return JSON.parse(builtinJson).some((row) => row[0] === id);
}
