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

  before(async () => {
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
    b = await launch({ foregroundSettle: true });
    assert.ok(b, "browser found but launch() returned null");
    const rawClick = b.click.bind(b);
    b.click = async (selector, ...rest) => {
      const need = /^#editor-(redo|remove|reset|delete)\b/.test(selector) ? ["editor-menu", "editor-more"]
        : /^#editor-(palette|swatches|anchor-)/.test(selector) ? ["editor-panel-layout", "editor-tab-layout"] : null;
      if (need && await b.eval(`const e = document.getElementById(${JSON.stringify(need[0])}); return !!e && e.hidden;`)) await rawClick("#" + need[1]);
      await b.eval(`const e = document.querySelector(${JSON.stringify(selector)}); if (e && e.closest && e.closest("#editor-region") && !e.closest("#editor-tabs")) e.scrollIntoView({ block: "nearest" }); return true;`);
      return rawClick(selector, ...rest);
    };
  });
  after(async () => {
    if (b) await b.close();
    if (server) await new Promise((r) => server.close(r));
  });
  afterEach(() => assertNoUncaught());

  async function fresh(width = 375, height = 667, on = true, touchDrag = true) {
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

  describe("D13 layout", () => {
    const IDS = ["editor-back", "editor-line", "editor-pan", "editor-hint-toggle", "editor-tabs", "editor-tab-scale", "editor-tab-layout", "editor-panels", "editor-undo", "editor-more",
      "editor-save", "editor-tray"];

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
      for (const id of ["editor-back", "editor-undo", "editor-more", "editor-save", "editor-tab-scale", "editor-tab-layout"]) {
        assert.ok(r.boxes[id].h >= 44 && r.boxes[id].w >= 44, id + " is a 44px target: " + JSON.stringify(r.boxes[id]));
      }
      const order = ["editor-back", "editor-line", "editor-pan", "editor-hint-toggle", "editor-tabs", "editor-undo"].map((id) => r.boxes[id].top);
      assert.deepStrictEqual([...order].sort((x, y) => x - y), order, "header, line, pan, status row, tabs, toolbar read top to bottom (the panels scroll under the pinned strip)");
      assert.strictEqual(await b.eval(`return document.getElementById("editor-areas").hidden;`), true, "the counts and hint start collapsed");
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
    const polar = (r, deg) => [r * Math.cos(deg * Math.PI / 180), r * Math.sin(deg * Math.PI / 180)];
    const clientOf = (x, y) => b.eval(`const svg = document.querySelector("#editor-pan svg"); const p = new DOMPoint(${x} * 100, -(${y}) * 100).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y };`);
    const geomOf = (key) => b.eval(`return editorSolve(editorSession.history.present).value.geom[${JSON.stringify(key)}];`);
    const spotAt = async (ring, deg) => clientOf(...polar(await b.eval(`return editorOrbit(editorSolve(editorSession.history.present).value.geom, ${JSON.stringify(ring)});`), deg));
    const dingAt = async () => clientOf(0, -(await geomOf("ding_dy")));
    const slotAt = (slot) => b.eval(`const g = editorSolve(editorSession.history.present).value.geom; const p = neoSlotPoint(${slot}, null, g.turn);
      const q = new DOMPoint(p.x, p.y).matrixTransform(document.querySelector("#editor-pan svg").getScreenCTM()); return { x: q.x, y: q.y };`);
    const chipAt = (name) => b.eval(`const r = document.querySelector('.tray-note[data-name="${name}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
    const statusText = () => b.eval(`return document.getElementById("editor-status").textContent;`);
    const stageOf = () => b.eval(`return JSON.parse(JSON.stringify(editorStageOf(editorSession.history.present)));`);
    const octave = () => b.eval(`return editorView(editorSession.history.present).oct;`);
    const stillEmpty = () => b.eval(`return editorIsEmpty(editorSession.history.present);`);
    const saveDisabled = () => b.eval(`return document.getElementById("editor-save").disabled;`);
    const tapPoint = async (pt, touch) => {
      if (touch) {
        await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pt.x, y: pt.y, id: 1 }] });
        await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
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
      assert.deepStrictEqual(t1.rings, ["bottom", "ding", "inner", "rim"]);
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

    test("Neotone is one tap away while empty: the ding and 18 slots, the 9 mutant slots waiting for a main field; Standard switches back", async () => {
      await fresh();
      await openAdd();
      await b.click("#editor-type-neotone");
      const on = await b.eval(`const q = (id) => document.getElementById(id); return [q("editor-type-neotone").getAttribute("aria-pressed"), q("editor-type-standard").getAttribute("aria-pressed"), q("editor-save").disabled];`);
      assert.deepStrictEqual(on, ["true", "false", true]);
      const t1 = await targets();
      assert.deepStrictEqual([t1.rings, t1.slots, t1.mut, t1.wait], [["ding"], 18, 9, 9]);
      await b.click("#editor-type-standard");
      const t2 = await targets();
      assert.deepStrictEqual([t2.rings, t2.slots], [["bottom", "ding", "inner", "rim"], 0]);
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

      test(`${kind} tap and drag on the empty Neotone pan: the ding, then a main note dropped on field 5 lands in field 1, then a mutant on slot 10`, async () => {
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
          [true, false, false, false, false, false, false, false, false]);
        await b.click('.tray-note[data-name="E"]');
        const slot9 = await slotAt(9);
        await b.eval(`window.__ev = []; const ab = { pointerdown: "pd", pointerup: "pu", touchstart: "ts", touchend: "te", mousedown: "md", click: "ck" };
          for (const type of Object.keys(ab)) window.addEventListener(type, (e) => window.__ev.push({ n: ab[type] + (e.defaultPrevented ? "!" : ""), t: Math.round(performance.now()) }), true); return true;`);
        await tapPoint(slot9, kind === "touch");
        await b.waitFor(`editorSession.history.present.options.profile.map[9] !== null`, { timeout: 2000, label: "slot 10 to take the mutant" }).catch(async (err) => {
          const s = await b.eval(`const ev = window.__ev, pu = ev.find((x) => x.n.startsWith("pu")), ck = ev.find((x) => x.n.startsWith("ck"));
            return "ev=" + ev.map((x) => x.n).join(",") + " ck=" + (ck ? (pu ? ck.t - pu.t : "?") + "ms" : "none") + " held=" + +!!editorSession.held + " st=" + document.getElementById("editor-status").textContent.slice(0, 12);`);
          throw new Error(s);
        });
        assert.strictEqual(await b.eval(`return editorSession.history.present.options.profile.map[9] !== null;`), true, await statusText());
      });
    }

    test("Neotone: a main note before the ding stages, a mutant slot with no main field takes nothing, the ding drop commits", async () => {
      await fresh();
      await openAdd();
      await b.click("#editor-type-neotone");
      const o = await octave();
      await gesture(await chipAt("E"), await slotAt(9), "mouse");
      assert.deepStrictEqual((await stageOf()).mutant, [], await statusText());
      await gesture(await chipAt("A"), await slotAt(2), "mouse");
      assert.deepStrictEqual((await stageOf()).main, ["A" + o]);
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

    test("Back with only staged notes closes with no prompt; Back after a committed scale with an edit still asks", async () => {
      await fresh();
      await openAdd();
      await gesture(await chipAt("A"), await spotAt("rim", 45), "mouse");
      await b.click("#editor-back");
      assert.strictEqual(await dialogOpen(), false);
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

    test("D23 copy: a rim or cyclops note dropped on the ding is refused with a plain message; the hint line still carries the ding cue", async () => {
      await setup("[A2] " + SCALE);
      assert.deepStrictEqual(await b.eval(`return [...document.querySelectorAll("#editor-hint span")].map((e) => e.textContent);`), ["Tap a note to hold it, then tap a ring on the pan, or drag it onto the pan.", "Drop or tap a note on the ding to swap it with the root."]);
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
        assert.strictEqual(m.options.angles, undefined, "an area add is auto, never pinned");
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
        await hold("G");
        await place("rim");
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
        await place("bottom");
        assert.strictEqual((await model()).pins.length, 3, "the add keeps the pins");
        assert.strictEqual(await b.eval(`return editorNames(editorSession.history.present, "bottom").length;`), 4);
        assert.match(await linkOf(), /at-/);
        const unpinnedIdx = await b.eval(`const a = editorSession.history.present.options.angles.bottom; return a.findIndex((x) => x === null);`);
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
          assert.strictEqual(await zoneCount("rim"), "Rim 8/12");
          assert.strictEqual(await zoneCount("inner"), "Cyclops 2/6");
          assert.strictEqual(await zoneCount("bottom"), "Bottom 0/12");
          for (const l of await lineBoxes("#editor-counts .zc")) assert.ok(l.h <= l.lh * 2.6 + 0.5, w + ": '" + l.text + "' is at most two line boxes, " + l.h + " vs " + l.lh);
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
            await place("bottom");
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
                const row = document.querySelector("#editor .editor-statusrow").getBoundingClientRect();
                if (btn.id === "editor-hint-toggle" && (btn.getBoundingClientRect().right > row.right + 0.5 || document.documentElement.scrollWidth > innerWidth)) out.push("hint toggle overflows");
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

    test("Tab brings every stop into the panel's scrollport on a short screen", async () => {
      await fresh(375, 548);
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

    test("drag ux E4: a placed note is highlighted after a drag, a tap, a zone add, a ding swap, a trade and the keyboard, and not after Undo", async () => {
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
      await place("rim");
      assert.deepStrictEqual(await marked(), ["rim8"], "zone add");
      await clickUndo();
      await b.click('.tray-note[data-name="B"]');
      const gm = await geom();
      const pt = await b.eval(`const svg = document.querySelector("#editor-pan svg"); const p = new DOMPoint(${gm.rim} * 100 * Math.cos(0.4), -${gm.rim} * 100 * Math.sin(0.4)).matrixTransform(svg.getScreenCTM()); return { x: p.x, y: p.y };`);
      for (const type of ["mousePressed", "mouseReleased"]) await b.send("Input.dispatchMouseEvent", { type, ...pt, button: "left", clickCount: 1 });
      assert.strictEqual((await marked()).length, 1, "tap to place");
      await clickUndo();
      await b.click("#editor-oct-down");
      await b.click('.tray-note[data-name="G"]');
      await b.eval(`editorPlaceHeld({ kind: "ding" }, editorSession.history.present); return true;`);
      assert.deepStrictEqual(await marked(), ["ding0"], "ding swap");
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
        assert.deepStrictEqual([neo.ids, neo.gone, neo.greyed], [["editor-anchor-one", "editor-anchor-between"], [true, true, true, true], 0], "Neotone " + w + ": the pair is shown and enabled");
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
      const want = ["Tap a note to hold it, then tap a ring on the pan, or drag it onto the pan.:true", "Drop or tap a note on the ding to swap it with the root.:true"];
      assert.ok((await hint()).every((x) => x.endsWith(":false")), "collapsed until the Hint button is pressed");
      await b.click("#editor-hint-toggle");
      assert.deepStrictEqual(await hint(), want);
      await b.click("#editor-tab-layout");
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
        return { first: panel.firstElementChild === n, inTray: panel.querySelector("#editor-tray") !== null, size: parseFloat(c.fontSize), h: box.height, max: n.maxLength,
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
      assert.strictEqual(await placeholder(), auto);
      assert.strictEqual(await nameIs(), "", "the field itself stays blank until a name is typed");
      await b.click("#editor-type-neotone");
      const neo = await placeholder();
      assert.strictEqual(neo, auto + " Neotone Mutant");
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
      const shown = await placeholder();
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
        assert.strictEqual(ocolor, "rgb(94, 90, 83)", "the unselected tab is muted");
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
        const lines = await b.eval(`const st = document.getElementById("editor-status"); return Math.round((st.getBoundingClientRect().height - 16) / 20);`);
        assert.ok(lines >= 1);
        const after = await rect("#editor .editor-panbox");
        assert.ok(Math.abs(after.height - before.height) <= 1, `pan height ${before.height} -> ${after.height} (${lines} lines)`);
        assert.deepStrictEqual(await b.eval(`const ed = document.getElementById("editor"), st = document.getElementById("editor-status"); return [ed.scrollWidth <= ed.clientWidth, st.scrollWidth <= st.clientWidth + 1];`), [true, true]);
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

    // Targets: the plan's S1 formula with the option B sticky strip (tray beats the 200 floor, 120 is the hard floor),
    // derived by rect probe on this lane's build. 0.95 x target is the floor each test enforces.
    const STACKED = [[390, 844, 362], [430, 932, 402], [375, 667, 259], [360, 640, 232], [375, 548, 140], [320, 568, 160], [768, 1024, 480]];
    for (const [w, h, target] of STACKED) {
      test(`P0 ${w}x${h}: the drawn pan is at least 0.95 x ${target}px, the page never scrolls and the toolbar is in view`, async () => {
        await open(w, h);
        const r = await rects(w, h);
        assert.ok(Math.min(r.svg.w, r.svg.h) >= 0.95 * target, `${w}x${h}: drawn pan ${r.svg.w}x${r.svg.h}, wanted >= ${0.95 * target}`);
        assert.ok(r.page, "no page scroll");
        assert.ok(r.bar.top >= 0 && r.bar.bottom <= h, "toolbar in view " + JSON.stringify(r.bar));
      });
    }

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
      test(`P0 phone landscape ${w}x${h}: the pan does not collapse (>= 0.95 x ${target}), the grid is on, toolbar in view, controls scroll in their own region`, async () => {
        await open(w, h);
        const r = await rects(w, h);
        assert.ok(r.grid, "two-column grid");
        assert.ok(r.svg.h >= 0.95 * target && r.svg.h >= 200, `drawn pan ${r.svg.h}`);
        assert.ok(r.page, "no page scroll");
        assert.ok(r.bar.top >= 0 && r.bar.bottom <= h && r.tabs.top >= 0 && r.tabs.bottom <= h, "toolbar and tabs in view");
        assert.ok(r.region && r.region.oy === "auto" && r.region.h > 0, "the region is a scroll box: " + JSON.stringify(r.region));
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

    test("P0 region: the controls scroll inside #editor-region, the tab strip stays pinned, the region rests at its end, and the page does not scroll", async () => {
      await open(375, 667);
      const r = await rects(375, 667);
      assert.ok(r.region && r.region.oy === "auto" && r.region.sh > r.region.h, "375x667 region overflows: " + JSON.stringify(r.region));
      assert.ok(Math.abs(r.region.st - (r.region.sh - r.region.h)) <= 2, "rests at its end: " + JSON.stringify(r.region));
      assert.ok(r.tray.bottom <= r.bar.top + 1 && r.tray.top >= r.region.top, "the tray is in view at rest");
      assert.strictEqual(await b.eval(`return getComputedStyle(document.getElementById("editor-tabs")).position;`), "sticky");
      assert.ok(Math.abs(r.tabs.top - r.region.top) <= 1, "the strip is pinned at the region top");
      assert.ok(r.page && r.panel, "neither the page nor #editor scrolls");
      await b.click("#editor-tab-layout");
      await pause(100);
      const l = await rects(375, 667);
      assert.strictEqual(l.region.st, 0, "a tab switch opens the chosen panel from the top of the region");
    });

    test("P0 hint: counts and hint sit in a collapsed block under the status, a 44px Hint button with aria-expanded toggles it in place, and the pan does not move", async () => {
      await open(375, 667);
      const st = () => b.eval(`const bt = document.getElementById("editor-hint-toggle"), a = document.getElementById("editor-areas"), r = bt.getBoundingClientRect(), s = document.getElementById("editor-status").getBoundingClientRect();
        return { exp: bt.getAttribute("aria-expanded"), ctl: bt.getAttribute("aria-controls"), hidden: a.hidden, h: r.height, w: r.width, sameRow: Math.abs((r.top + r.bottom) / 2 - (s.top + s.bottom) / 2) < 14 && r.left >= s.left,
          pan: document.querySelector("#editor-pan svg").getBoundingClientRect().height, label: bt.textContent.trim(), inRegion: document.getElementById("editor-region").contains(a) };`);
      const a = await st();
      assert.deepStrictEqual([a.exp, a.ctl, a.hidden, a.inRegion], ["false", "editor-areas", true, false]);
      assert.ok(a.h >= 44 && a.w >= 44 && a.sameRow && a.label.length > 0, JSON.stringify(a));
      await b.click("#editor-hint-toggle");
      const o = await st();
      assert.deepStrictEqual([o.exp, o.hidden], ["true", false]);
      assert.ok(Math.abs(o.pan - a.pan) < 1, "the pan keeps its size");
      assert.ok(await b.eval(`const r = document.getElementById("editor-areas").getBoundingClientRect(); return r.top >= document.getElementById("editor-status").getBoundingClientRect().bottom - 1 && r.bottom >= document.getElementById("editor-region").getBoundingClientRect().bottom - 1 && getComputedStyle(document.getElementById("editor-areas")).position === "absolute";`), "the block opens under the status as an overlay spanning the region");
    });

    for (const [w, h] of [[390, 844], [375, 667], [360, 640]]) {
      test(`PF ${w}x${h}: a gap of at least 8px separates the status row (and the open hint) from the tab strip`, async () => {
        await open(w, h);
        const gap = () => b.eval(`const s = document.querySelector("#editor .editor-statusrow").getBoundingClientRect(), t = document.getElementById("editor-tabs").getBoundingClientRect(); return t.top - s.bottom;`);
        assert.ok(await gap() >= 8, `${w}x${h} rest gap ${await gap()}`);
        await b.click("#editor-hint-toggle");
        assert.ok(await gap() >= 8, `${w}x${h} hint open gap ${await gap()}`);
      });

      test(`PF ${w}x${h}: selecting Layout shows its panel from the top of the region, and Scale rests at its end when shown`, async () => {
        await open(w, h);
        const read = () => b.eval(`const rg = document.getElementById("editor-region"), p = document.querySelector('#editor-panels [role=tabpanel]:not([hidden])').getBoundingClientRect(), t = document.getElementById("editor-tabs").getBoundingClientRect();
          return { st: rg.scrollTop, max: rg.scrollHeight - rg.clientHeight, panelTop: p.top, tabsBottom: t.bottom, id: document.querySelector('#editor-panels [role=tabpanel]:not([hidden])').id };`);
        await b.eval(`document.getElementById("editor-panels").style.minHeight = "1400px"; editorRegionPin(); return true;`);
        const a = await read();
        assert.ok(a.max > 100 && Math.abs(a.st - a.max) <= 2, "the region overflows and Scale rests at its end: " + JSON.stringify(a));
        await b.click("#editor-tab-layout");
        await pause(150);
        const l = await read();
        assert.strictEqual(l.id, "editor-panel-layout");
        assert.strictEqual(l.st, 0, `${w}x${h} Layout opens at scrollTop 0: ` + JSON.stringify(l));
        assert.ok(l.panelTop >= l.tabsBottom - 1, "the Layout panel top is visible below the strip: " + JSON.stringify(l));
        await b.click("#editor-tab-scale");
        await pause(150);
        const sc = await read();
        assert.ok(sc.max <= 2 || Math.abs(sc.st - sc.max) <= 2, "Scale chosen from the tab strip rests at its end again: " + JSON.stringify(sc));
      });

      test(`PF ${w}x${h}: the Hint block is an overlay on the whole controls area, nothing moves when it toggles, and a second tap or Escape closes it`, async () => {
        await open(w, h);
        const snap = () => b.eval(`const q = (s) => { const e = document.querySelector(s), r = e.getBoundingClientRect(); return [r.top, r.left, r.width, r.height].map((x) => Math.round(x * 10) / 10); };
          const a = document.getElementById("editor-areas"), ar = a.getBoundingClientRect(), rg = document.getElementById("editor-region").getBoundingClientRect();
          return { pan: q("#editor-pan svg"), tabs: q("#editor-tabs"), name: q("#editor-name"), tray: q("#editor-tray"), bar: q(".editor-toolbar"), status: q("#editor .editor-statusrow"),
            hidden: a.hidden, pos: getComputedStyle(a).position, bg: getComputedStyle(a).backgroundColor, z: getComputedStyle(a).zIndex, exp: document.getElementById("editor-hint-toggle").getAttribute("aria-expanded"),
            covers: ar.top <= rg.top + 1 && ar.bottom >= rg.bottom - 1 && ar.left <= rg.left + 1 && ar.right >= rg.right - 1, belowStatus: ar.top >= document.querySelector("#editor .editor-statusrow").getBoundingClientRect().bottom - 1 };`);
        const before = await snap();
        await b.click("#editor-hint-toggle");
        const open1 = await snap();
        assert.deepStrictEqual([open1.hidden, open1.exp, open1.pos], [false, "true", "absolute"]);
        assert.ok(open1.covers && open1.belowStatus, "the overlay covers the region and starts under the status row: " + JSON.stringify(open1));
        assert.ok(open1.bg !== "rgba(0, 0, 0, 0)" && Number(open1.z) > 3, "readable background above the sticky strip: " + open1.bg + " z " + open1.z);
        for (const k of ["pan", "tabs", "name", "tray", "bar", "status"]) assert.deepStrictEqual(open1[k], before[k], `${k} does not move when the hint opens`);
        await b.click("#editor-hint-toggle");
        const closed = await snap();
        assert.deepStrictEqual([closed.hidden, closed.exp], [true, "false"]);
        for (const k of ["pan", "tabs", "name", "tray", "bar", "status"]) assert.deepStrictEqual(closed[k], before[k], `${k} does not move when the hint closes`);
        await b.click("#editor-hint-toggle");
        await b.key("Escape", "Escape", 27);
        const esc = await snap();
        assert.deepStrictEqual([esc.hidden, esc.exp], [true, "false"], "Escape closes the hint overlay");
        assert.strictEqual(await b.eval(`return !!document.getElementById("editor");`), true, "Escape closed the overlay, not the editor");
      });
    }

    // The Name field: a real tap focuses it at a tall viewport, then the soft keyboard shrinks the viewport (Android resize), as on the phone.
    // At the short size itself the region is a few px tall, so Name cannot be tapped there unfocused (plan R4 H1: pan floor 120 beats tray-in-view).
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

    test("P0 drag keeps E3: the drag magnification at 390x844 (a pan as wide as the column) stays inside the viewport width", async () => {
      await open(390, 844);
      const rest = (await rects(390, 844)).svg.w;
      const mag = await b.eval(`return editorDragMeasure();`);
      assert.ok(mag >= 1 && mag * rest * 250 / 278 <= 390 - 16 + 1, `mag ${mag} stays inside the viewport width`);
    });
  });

}

function DECK_IDS_HAVE(builtinJson, id) {
  return JSON.parse(builtinJson).some((row) => row[0] === id);
}
