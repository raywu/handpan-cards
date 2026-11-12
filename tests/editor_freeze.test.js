// Lane T0 of the editor RC (TRI-59): freeze the editor's pan, drag and drop oracle BEFORE the
// panel is rebuilt (docs/plans/2026-11-08-editor-panel-simplify.md, lane T0). Tests only: the
// expected values are frozen in tests/fixtures/editor_pan_v1.json (CONTRACT rule 2 carve-out) and are
// regenerated only by an owner-approved render change, never to make a lane pass:
//   node tools/regen_editor_pan_fixture.js
// Models are built from option literals only (mirror flags, profile.map, angles), never through
// editorSetMirror or any other function a later lane removes. No oracle here skips on CI.
const { test, after } = require("node:test");
const assert = require("node:assert");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { boot } = require("./helpers/sandbox.js");
const { launch, findBrowser, APP_READY_EXPR, assertNoUncaught } = require("./helpers/cdp.js");

const REPO = path.resolve(__dirname, "..");
const FIXTURE = path.join(REPO, "tests", "fixtures", "editor_pan_v1.json");
const REGEN = process.env.EDITOR_FREEZE_REGEN === "1";
const ON_CI = !!process.env.CI;

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const sha16 = (s) => sha(s).slice(0, 16);

const KURD = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5";
const WITH_BOTTOM = "[A2] [B2] " + KURD;
const NEO_MAP = ["r57", "r60", "r62", "r64", "r65", "r67", "r69", "r71", null, "b45", "b47", "b48", "b50", "b52", "b53", "b55", "b57", "b59"];
const NEO_TEXT = "[A2] [B2] [C3] [D3] (D3) [E3] [F3] [G3] [A3] A3 [B3] C4 D4 E4 F4 G4 A4 B4";
const NEO_PROFILE = { id: "paired", rev: 2, map: NEO_MAP };
const EMPTY_MAP = new Array(18).fill(null);

const SPECS = [
  { name: "kurd", text: KURD, options: {} },
  { name: "kurd-palette-3", text: KURD, options: { palette: 3 } },
  { name: "mirror-top", text: WITH_BOTTOM, options: { mirror: true, mirrorBottom: false } },
  { name: "mirror-bottom", text: WITH_BOTTOM, options: { mirror: false, mirrorBottom: true } },
  { name: "pinned-cyclops", text: KURD, options: { angles: { inner: [125, null] } } },
  { name: "pinned-bottom", text: WITH_BOTTOM, options: { angles: { bottom: [60, null] } } },
  { name: "bottom-12", text: "[A2] [B2] [C3] [D3] [E3] [F3] [G3] [A3] [B3] [C4] [D4] [E4] " + KURD, options: {} },
  { name: "rim-at-cap", text: "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5", options: {} },
  { name: "cyclops-at-cap", text: "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5 E5 F5 G5 A5", options: {} },
  { name: "over-cap-load", text: "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5", options: {} },
  { name: "neotone-empty", empty: true, options: { profile: { id: "paired", rev: 2, map: EMPTY_MAP } } },
  { name: "neotone-full", text: NEO_TEXT, options: { profile: NEO_PROFILE } },
];
const SANDBOX_STATES = ["rest", "selected", "held", "zone"];
const BROWSER_STATES = ["rest", "selected", "held", "dragging", "settling"];
const VIEWPORTS = [{ w: 375, h: 667 }, { w: 390, h: 844 }, { w: 900, h: 600 }];
const STYLE_PROPS = ["stroke", "stroke-width", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "fill", "fill-opacity", "opacity",
  "transform", "font-family", "font-size", "font-weight", "pointer-events", "cursor", "touch-action", "visibility", "display"];
const PLAN_NAMES = ["C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4"];
const FROZEN_SYMBOLS = ["editorDragMeasure", "editorDragDown", "editorDragLift", "editorHitAt", "editorDropPlan", "editorNeoDropPlan"];
const FROZEN_CONSTS = ["EDITOR_HIT_AREA", "EDITOR_SCALE"];
const FROZEN_TEST_PATTERNS = {
  "drag ux": /test\(\s*[`"]drag ux (E[1-7]|E6b|E6c|X4)\b/g,
  "tap and hold": /test\(\s*[`"](tap-tap placement|holding a note shows|tap-tap swap|D3: 8px or less|the same tap-tap place and swap work by touch|tray chips hold on Enter)/g,
};

const fixture = REGEN ? null : JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
const produced = { sandbox: {}, dropPlans: {}, source: {}, domPan: {}, geometry: {}, styles: {}, behavioural: {} };
const specs = REGEN ? SPECS : fixture.specs;

function expectFrozen(section, key, actual, same = assert.deepStrictEqual) {
  if (REGEN) {
    produced[section][key] = actual;
    return;
  }
  assert.ok(fixture[section] && key in fixture[section], `the fixture has no ${section} row for ${key}`);
  same(actual, fixture[section][key], `${section} ${key} moved from the frozen value`);
}

const modelJs = (spec) => spec.empty
  ? `({ fields: {}, options: ${JSON.stringify(spec.options)}, pins: [] })`
  : `(() => { const r = editorLoad(${JSON.stringify(spec.text)}, ${JSON.stringify(spec.options)}); if (!r.ok) throw new Error("fixture model " + ${JSON.stringify(spec.name)} + " refused: " + r.reason); return r.value; })()`;

const stateJs = (state) => ({
  rest: "{ sel: null, held: null, zone: null }",
  selected: '{ sel: ringIds(__m.fields, "rim").length > 2 ? { ring: "rim", i: 2 } : null, held: null, zone: null }',
  held: "{ sel: null, held: { k: 5 }, zone: null }",
  zone: '{ sel: null, held: null, zone: "bottom" }',
})[state];

// ---- Pan oracle (sandbox): sha256 of editorWithOverlay(pan(...)) -------------------------------

test("T0 pan hash: editorWithOverlay(pan(...)) is byte-identical for every frozen model and state", () => {
  const a = boot({ onePanel: true });
  for (const spec of specs) {
    a.run(`globalThis.__m = ${modelJs(spec)}; true`);
    for (const state of SANDBOX_STATES) {
      a.run(`globalThis.__st = ${stateJs(state)}; editorSession = { history: editorHistoryNew(__m), base: __m, flash: null, say: "", ...__st }; true`);
      const markup = a.get(`(() => {
        const solved = editorSolve(__m);
        if (!solved.ok) return "unsolved:" + solved.code;
        if (editorIsEmpty(__m)) return "";
        const p = HPE.select.PALETTES[__m.options.palette || 0] || HPE.select.PALETTES[0];
        const drawn = solved.value.geom.place ? null : { scale: EDITOR_SCALE, push: editorPush(__m, solved.value.fields) };
        return editorWithOverlay(pan({ geom: solved.value.geom, fields: solved.value.fields, colors: { root: p.root, tone: p.tone } }, null, drawn), __m, solved.value);
      })()`);
      expectFrozen("sandbox", `${spec.name}/${state}`, sha(markup));
    }
  }
});

// ---- Drop-plan oracle (sandbox) -----------------------------------------------------------------

const PLAN_JS = `(function (m) {
  const rec = (src, target) => {
    const out = {};
    try {
      const r = editorDropPlan(m, src, target);
      out.keys = Object.keys(r).sort();
      if (r.say !== undefined) out.say = r.say;
      if (r.trade) out.trade = r.trade;
      if (r.refuse !== undefined) out.refuse = r.refuse;
      if (r.snap) out.snap = true;
      if (r.step) {
        const x = r.step(editorClone(m));
        out.step = x.ok
          ? { ok: true, text: HPE.core.formatTyped(x.value.fields, x.value.options.seats), options: x.value.options, pins: x.value.pins, notice: x.notice || null }
          : { ok: false, code: x.code, reason: x.reason };
      }
    } catch (e) { out.threw = String(e && e.message); }
    return out;
  };
  const sources = [];
  for (const name of ${JSON.stringify(PLAN_NAMES)}) sources.push(["tray:" + name, { from: "tray", name }]);
  for (const ring of ["rim", "inner", "bottom"]) ringIds(m.fields, ring).forEach((_, i) => sources.push(["pan:" + ring + ":" + i, { from: "pan", ref: { ring, i } }]));
  if (Object.keys(m.fields).some((id) => m.fields[id][3] === "ding")) sources.push(["pan:ding", { from: "pan", ref: { ring: "ding", i: 0 } }]);
  const targets = [];
  for (const ring of ["rim", "inner", "bottom"]) {
    ringIds(m.fields, ring).forEach((_, i) => targets.push(["note:" + ring + ":" + i, { kind: "note", ring, i }]));
    for (const angle of [undefined, 100, 250]) targets.push(["spot:" + ring + ":" + angle, angle === undefined ? { kind: "spot", ring } : { kind: "spot", ring, angle }]);
  }
  if (m.options.profile) for (let slot = 0; slot < 18; slot += 1) targets.push(["slot:" + slot, { kind: "spot", ring: slot < NEO_MAIN ? "rim" : "bottom", slot }]);
  for (const kind of ["ding", "outside", "off"]) targets.push([kind, { kind }]);
  const out = {};
  for (const [sk, src] of sources) out[sk] = targets.map(([tk, target]) => [tk, rec(src, target)]);
  return JSON.stringify(out);
})(__m)`;

test("T0 drop plans: editorDropPlan and editorNeoDropPlan results are frozen for every source and target kind", () => {
  const a = boot({ onePanel: true });
  for (const spec of specs) {
    a.run(`globalThis.__m = ${modelJs(spec)}; true`);
    const plans = JSON.parse(a.get(PLAN_JS));
    for (const [source, rows] of Object.entries(plans)) expectFrozen("dropPlans", `${spec.name}/${source}`, sha16(JSON.stringify(rows)));
  }
});

// ---- Source-hash oracle -------------------------------------------------------------------------

const indexLines = fs.readFileSync(path.join(REPO, "index.html"), "utf8").split("\n");
const fnRange = (from, to = from) => {
  const start = indexLines.findIndex((l) => l.startsWith(`function ${from}(`));
  const last = indexLines.findIndex((l) => l.startsWith(`function ${to}(`));
  assert.ok(start >= 0 && last >= start, `index.html has no function ${from}..${to}`);
  let end = last;
  while (indexLines[end] !== "}") end += 1;
  return indexLines.slice(start, end + 1).join("\n");
};

test("T0 source hash: the drag, hit and drop functions and their constants are byte-identical", () => {
  for (const name of FROZEN_SYMBOLS) expectFrozen("source", name, sha(fnRange(name)));
  expectFrozen("source", "editorDragSource..editorDragEnd", sha(fnRange("editorDragSource", "editorDragEnd")));
  for (const name of FROZEN_CONSTS) {
    const line = indexLines.find((l) => l.startsWith(`const ${name} =`));
    assert.ok(line, `index.html has no const ${name}`);
    expectFrozen("source", name, sha(line));
  }
});

test("T0 ONE_PANEL line: const ONE_PANEL = true ; appears once, byte-identical", () => {
  const hits = indexLines.filter((l) => /const ONE_PANEL = (?:true |false);/.test(l));
  assert.deepStrictEqual(hits, ["const ONE_PANEL = true ;"]);
  assert.strictEqual(require("./helpers/editor_flag.js").ON, hits[0]);
});

// ---- Behavioural oracle: the pinned test counts ---------------------------------------------------

test("T0 behavioural pin: the drag-ux and tap/hold e2e tests are still selected by name", () => {
  const src = fs.readFileSync(path.join(REPO, "tests", "editor_e2e.test.js"), "utf8");
  for (const [label, re] of Object.entries(FROZEN_TEST_PATTERNS)) expectFrozen("behavioural", label, (src.match(re) || []).length);
});

// ---- Browser oracles: DOM pan, geometry, computed style, hidden panel -------------------------------

const BROWSER = findBrowser();
if (!BROWSER && !ON_CI) {
  test.skip("T0 browser oracles skipped: no Chromium binary found (set CHROME_BIN); CI must have one", () => {});
} else {
  runBrowser();
}

function runBrowser() {
  let server = null;
  let b = null;
  let base = "";

  const boots = async (t) => {
    if (b) return;
    server = http.createServer((req, res) => {
      const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "") || "index.html";
      const file = path.resolve(REPO, rel);
      if (!file.startsWith(REPO + path.sep)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end(); return; }
        const html = rel === "index.html";
        res.writeHead(200, { "Content-Type": html ? "text/html; charset=utf-8" : "application/octet-stream", "Cache-Control": "no-store" });
        res.end(html ? buf.toString("utf8").replace("</head>", () => "<style>#editor *{transition:none!important;animation:none!important}</style></head>") : buf);
      });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${server.address().port}/index.html`;
    b = await launch({ foregroundSettle: true });
    assert.ok(b, "browser found but launch() returned null");
  };
  after(async () => {
    if (b) await b.close();
    if (server) await new Promise((r) => server.close(r));
  });

  async function openEditor(w, h) {
    await b.setViewport(w, h, w < 700);
    await b.send("Storage.clearDataForOrigin", { origin: new URL(base).origin, storageTypes: "indexeddb,local_storage" });
    await b.send("Page.navigate", { url: base });
    await b.waitFor(`${APP_READY_EXPR} && booted === true && document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`,
      { timeout: 15000, label: "the app to boot" });
    await b.eval(`openScaleSheet(addChip); return true;`);
    await b.waitFor(`!!document.getElementById("editor-line")`, { label: "the editor panel" });
  }

  const show = (spec, state) => b.eval(`
    const __m = ${modelJs(spec)};
    const st = ${state === "selected" ? stateJs("selected") : state === "held" ? stateJs("held") : stateJs("rest")};
    const s = editorSession;
    s.history = editorHistoryNew(__m); s.base = __m; s.sel = st.sel; s.held = st.held; s.zone = st.zone; s.say = ""; s.error = ""; s.notice = false;
    const root = document.getElementById("editor");
    root.classList.remove("dragging", "settling");
    if (${JSON.stringify(state)} === "dragging") root.classList.add("dragging");
    if (${JSON.stringify(state)} === "settling") root.classList.add("settling");
    editorRender();
    return true;`);

  const MEASURE = `(() => {
    const svg = document.querySelector("#editor-pan svg");
    if (!svg) return null;
    const a = svg.getScreenCTM().a;
    const o = svg.getBoundingClientRect();
    const r2 = (n) => Math.round(n * 100) / 100;
    return { viewBox: svg.getAttribute("viewBox"),
      ehit: [...svg.querySelectorAll(".ehit")].map((c) => { const r = c.getBoundingClientRect(); return [r2(r.width / a), r2(r.height / a), r2((r.left - o.left) / a), r2((r.top - o.top) / a)]; }) };
  })()`;

  const STYLES = (state) => `(() => {
    const props = ${JSON.stringify(STYLE_PROPS)};
    const skipTransform = ${JSON.stringify(state === "dragging" || state === "settling")};
    const pick = (el) => { const cs = getComputedStyle(el); const o = {}; for (const p of props) o[p] = cs.getPropertyValue(p); return o; };
    const out = {};
    const seen = new Set();
    const box = document.querySelector(".editor-panbox");
    out[".editor-panbox"] = pick(box);
    if (skipTransform) delete out[".editor-panbox"].transform;
    out["#editor-pan"] = pick(document.getElementById("editor-pan"));
    for (const el of document.querySelectorAll("#editor-pan *")) {
      const sig = el.tagName.toLowerCase() + "." + (el.getAttribute("class") || "");
      if (seen.has(sig)) continue;
      seen.add(sig);
      out[sig] = pick(el);
    }
    return out;
  })()`;

  const near = (actual, expected, label, tol = 0.25) => {
    if (actual === null || expected === null) { assert.strictEqual(actual, expected, label); return; }
    assert.strictEqual(actual.viewBox, expected.viewBox, `${label}: viewBox`);
    assert.strictEqual(actual.ehit.length, expected.ehit.length, `${label}: ehit count`);
    actual.ehit.forEach((row, i) => row.forEach((v, j) => assert.ok(Math.abs(v - expected.ehit[i][j]) <= tol,
      `${label}: ehit ${i} field ${j} (w,h,dx,dy in viewBox units) is ${v}, frozen ${expected.ehit[i][j]}`)));
  };

  for (const vp of VIEWPORTS) {
    test(`T0 geometry and style: ${vp.w}x${vp.h} .ehit sizes and offsets in viewBox units, viewBox, computed pan styles`, async (t) => {
      await boots(t);
      await openEditor(vp.w, vp.h);
      for (const spec of specs) {
        for (const state of BROWSER_STATES) {
          const key = `${vp.w}x${vp.h}/${spec.name}/${state}`;
          await show(spec, state);
          const measured = await b.eval(`return ${MEASURE};`);
          if (REGEN) produced.geometry[key] = measured;
          else {
            assert.ok(key in fixture.geometry, `the fixture has no geometry row for ${key}`);
            near(measured, fixture.geometry[key], key);
          }
          const styles = await b.eval(`return ${STYLES(state)};`);
          expectFrozen("styles", key, sha16(JSON.stringify(styles)));
          if (REGEN && spec.name === "kurd" && state === "rest") produced.styles[`sample/${vp.w}x${vp.h}`] = styles;
          if (vp.w === 375 && state !== "dragging" && state !== "settling") {
            const html = await b.eval(`return document.getElementById("editor-pan").innerHTML;`);
            expectFrozen("domPan", `${spec.name}/${state}`, sha(html));
          }
        }
      }
      assertNoUncaught();
    });
  }

  test("T0 hidden panel: while dragging, the areas, layout, toolbar and tray are out of play; at rest they are visible", async (t) => {
    await boots(t);
    await openEditor(375, 667);
    const spec = specs[0];
    const probe = `return ["#editor-areas", "#editor-layout", ".editor-toolbar", "#editor-tray"].map((sel) => { const cs = getComputedStyle(document.querySelector(sel)); return [cs.visibility, cs.pointerEvents]; });`;
    await show(spec, "rest");
    for (const [visibility] of await b.eval(probe)) assert.strictEqual(visibility, "visible");
    await show(spec, "dragging");
    for (const [visibility, events] of await b.eval(probe)) {
      assert.strictEqual(visibility, "hidden");
      assert.strictEqual(events, "none");
    }
    await show(spec, "settling");
    for (const [, events] of await b.eval(probe)) assert.strictEqual(events, "none");
    assertNoUncaught();
  });
}

// ---- Regeneration -----------------------------------------------------------------------------------

after(() => {
  if (!REGEN) return;
  const out = {
    _what: "Frozen pre-change values of the editor pan, drag and drop oracle (lane T0 of the editor RC, docs/plans/2026-11-08-editor-panel-simplify.md).",
    _why: "CONTRACT rule 2 carve-out: these are recorded outputs of the editor as it stood on the base SHA below, not derived from the implementation under test. Regenerate only with an owner-approved render change, never to make a lane pass.",
    _regen: "node tools/regen_editor_pan_fixture.js",
    _base: "daffb5bed9d03b8846b8a8f6963d97b8e0847a3c",
    _geometry_note: "geometry rows hold .ehit width, height, dx, dy in viewBox units (px divided by the svg getScreenCTM().a) and the viewBox; absolute rects are never stored. Compared with a 0.25 tolerance. Style rows are sha256/16 of the computed-style records (.editor-panbox transform excluded while dragging and settling). styles.sample/* holds the readable kurd rest record.",
    specs: SPECS,
    ...produced,
  };
  fs.writeFileSync(FIXTURE, JSON.stringify(out, null, 1) + "\n");
});
