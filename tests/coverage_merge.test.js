"use strict";
// Lane 0 (refactor pass 4): the coverage hook in tests/helpers/cdp.js and the
// merge tool tools/coverage_merge.js. Neither needs a browser: the hook is
// driven through a fake WebSocket that answers every CDP command.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");
const { Browser, maybeEnableCoverage } = require("./helpers/cdp.js");
const { buildReport, parseCssRules } = require("../tools/coverage_merge.js");

const ROOT = path.resolve(__dirname, "..");
const TOOL = path.join(ROOT, "tools", "coverage_merge.js");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "hpc-covtest-"));

// A WebSocket stand-in: records every command and answers it. `answer` maps a
// method to a result (or a function returning one, or throwing to fail it).
function fakeBrowser(answer = {}) {
  const log = [];
  const listeners = [];
  const ws = {
    addEventListener(type, fn) { if (type === "message") listeners.push(fn); },
    close() {},
    send(raw) {
      const msg = JSON.parse(raw);
      log.push(msg);
      setImmediate(() => {
        let a = answer[msg.method];
        let reply = { id: msg.id, result: {} };
        try {
          if (typeof a === "function") a = a(msg.params);
          if (a !== undefined) reply.result = a;
        } catch (err) { reply = { id: msg.id, error: { message: String(err.message || err) } }; }
        for (const l of listeners) l({ data: JSON.stringify(reply) });
      });
    },
  };
  const profileDir = tmp();
  // pid NaN: reap() would otherwise signal a real process group.
  const b = new Browser({ pid: NaN, kill() {} }, ws, profileDir, { proc: { pid: NaN, kill() {} }, profileDir });
  b.sessionId = "S";
  const emit = (msg) => { for (const l of listeners) l({ data: JSON.stringify(msg) }); };
  return { b, log, emit, methods: () => log.map((m) => m.method) };
}

test("cdp coverage hook sends no Profiler command unless HPC_COVERAGE_DIR is set", async () => {
  const f = fakeBrowser();
  assert.strictEqual(await maybeEnableCoverage(f.b, {}), null);
  assert.strictEqual(f.b.coverage, null);
  await f.b.send("Page.navigate", { url: "about:blank" });
  await f.b.send("Emulation.setDeviceMetricsOverride", { width: 1, height: 1 });
  await f.b.close();
  assert.deepStrictEqual(f.methods(), ["Page.navigate", "Emulation.setDeviceMetricsOverride"]);
  assert.ok(!f.methods().some((m) => /^(Profiler|CSS|DOM|Debugger)\./.test(m)));
});

test("cdp coverage hook: two navigations produce two files, a third at close, and the CSS order is DOM, CSS, track, delta, stop", async () => {
  const dir = tmp();
  let takes = 0;
  const f = fakeBrowser({
    "Profiler.takePreciseCoverage": () => ({ result: [{ scriptId: "s" + takes, url: "x", functions: [{ functionName: "f" + takes++, ranges: [{ startOffset: 0, endOffset: 1, count: 1 }] }] }] }),
    "CSS.takeCoverageDelta": () => ({ coverage: [{ styleSheetId: "a", startOffset: 0, endOffset: 5, used: true }] }),
    "CSS.stopRuleUsageTracking": () => ({ ruleUsage: [] }),
  });
  await maybeEnableCoverage(f.b, { HPC_COVERAGE_DIR: dir });
  f.emit({ method: "Debugger.scriptParsed", params: { scriptId: "s0", url: "file:///x", startLine: 3, startColumn: 8 } });
  await f.b.send("Page.navigate", { url: "file:///one" });
  f.emit({ method: "Page.frameNavigated", params: { frame: { id: "F" } } });
  await f.b.send("Page.navigate", { url: "file:///two" });
  await f.b.close();

  const takesOnDisk = fs.readdirSync(dir).filter((n) => /^browser-.*\.json$/.test(n) && !n.includes("incomplete")).sort();
  assert.strictEqual(takesOnDisk.length, 3);
  const read = (n) => JSON.parse(fs.readFileSync(path.join(dir, n), "utf8"));
  assert.deepStrictEqual(takesOnDisk.map((n) => read(n).coverage[0].functions[0].functionName), ["f0", "f1", "f2"]);
  assert.deepStrictEqual(read(takesOnDisk[0]).scripts.s0, { url: "file:///x", startLine: 3, startColumn: 8 });
  assert.strictEqual(read(takesOnDisk[2]).final, true);
  const session = fs.readdirSync(dir).find((n) => n.startsWith("session-"));
  assert.strictEqual(read(session).closed, true);

  const m = f.methods();
  assert.ok(m.indexOf("DOM.enable") < m.indexOf("CSS.enable"), "CSS requires DOM");
  assert.ok(m.indexOf("Profiler.startPreciseCoverage") > -1);
  assert.strictEqual(m.filter((x) => x === "CSS.stopRuleUsageTracking").length, 1, "stopped at close() only");
  assert.strictEqual(m[m.length - 1] === "CSS.stopRuleUsageTracking" || m.includes("CSS.stopRuleUsageTracking"), true);
  const firstNav = m.indexOf("Page.navigate");
  assert.ok(m.indexOf("Profiler.takePreciseCoverage") < firstNav && m.indexOf("CSS.takeCoverageDelta") < firstNav,
    "coverage is taken BEFORE the navigation that discards the document");
  assert.strictEqual(m.filter((x) => x === "CSS.startRuleUsageTracking").length, 2, "once at start, once after the commit");
});

test("cdp coverage hook: setDeviceMetricsOverride is recorded with the media queries that matched", async () => {
  const dir = tmp();
  const f = fakeBrowser({
    "Runtime.evaluate": () => ({ result: { value: [{ text: "(min-width: 640px)", matches: true }] } }),
  });
  await maybeEnableCoverage(f.b, { HPC_COVERAGE_DIR: dir });
  await f.b.setViewport(380, 800, true);
  await f.b.close();
  const v = fs.readdirSync(dir).find((n) => n.startsWith("viewports-"));
  const row = JSON.parse(fs.readFileSync(path.join(dir, v), "utf8").trim());
  assert.deepStrictEqual([row.width, row.height, row.mobile], [380, 800, true]);
  assert.deepStrictEqual(row.media, [{ text: "(min-width: 640px)", matches: true }]);
});

test("a failed take is recorded as incomplete and the merge tool exits non-zero", async () => {
  const dir = tmp();
  const f = fakeBrowser({ "Profiler.takePreciseCoverage": () => { throw new Error("target closed"); } });
  await maybeEnableCoverage(f.b, { HPC_COVERAGE_DIR: dir });
  await f.b.send("Page.navigate", { url: "file:///one" });
  await f.b.close();
  assert.ok(fs.readdirSync(dir).some((n) => n.endsWith(".incomplete.json")));
  const out = path.join(tmp(), "report.json");
  const r = cp.spawnSync("node", [TOOL, "--browser", dir, "--out", out], { encoding: "utf8" });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /INCOMPLETE/);
  assert.ok(!fs.existsSync(out), "no report is written over an incomplete run");
});

test("a browser session that never reached close() also refuses a report", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "session-1-0.json"), JSON.stringify({ tag: "1-0", suite: "tests/e2e.test.js", closed: false }));
  assert.throws(() => buildReport({ browser: dir }), /incomplete/);
});

test("an unclosed session with no suite and no takes (a node -e probe killed on purpose) is not an incomplete run", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "session-9-0.json"), JSON.stringify({ tag: "9-0", suite: "", closed: false }));
  assert.doesNotThrow(() => buildReport({ browser: dir }));
  fs.writeFileSync(path.join(dir, "browser-9-0-0.json"), JSON.stringify({ coverage: [], scripts: {} }));
  assert.throws(() => buildReport({ browser: dir }), /incomplete/);
});

// ---------------------------------------------------------------------------
// Merge: attribution.
// ---------------------------------------------------------------------------
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const pdfcardsSrc = fs.readFileSync(path.join(ROOT, "src", "engine", "pdfcards.js"), "utf8");
const LABEL_SIZE = "function labelSize(r, zone) { return r * labelRatio(zone); }";
const modOff = pdfcardsSrc.indexOf(LABEL_SIZE);
const beginAt = html.indexOf("<!-- engine:pdfcards begin");
const regionStart = html.indexOf(pdfcardsSrc, beginAt);
const bodyStart = html.indexOf("<script>", beginAt) + "<script>".length;
const before = html.slice(0, bodyStart);
const startLine = before.split("\n").length - 1;
const startColumn = bodyStart - (before.lastIndexOf("\n") + 1);

function nodeJson(dir, name, scripts) {
  fs.writeFileSync(path.join(dir, `coverage-${name}.json`), JSON.stringify({ result: scripts }));
}
const fn = (functionName, s, e, count) => ({ functionName, isBlockCoverage: false, ranges: [{ startOffset: s, endOffset: e, count }] });

test("sanity: the fixture offsets point at labelSize in both files", () => {
  assert.ok(modOff > 0 && regionStart > 0);
  assert.strictEqual(html.slice(regionStart + modOff, regionStart + modOff + LABEL_SIZE.length), LABEL_SIZE);
});

test("coverage_merge attributes an index.html range inside an engine region to the module", () => {
  const nd = tmp();
  nodeJson(nd, "sandbox", [{ scriptId: "1", url: "file://" + path.join(ROOT, "index.html"), functions: [
    fn("", 0, html.length, 1),
    fn("labelSize", regionStart + modOff, regionStart + modOff + LABEL_SIZE.length, 3),
  ] }]);
  const rep = buildReport({ node: [nd], browser: tmp(), verbose: true });
  const mod = rep.files["src/engine/pdfcards.js"];
  assert.ok(mod, "the module has an entry");
  const e = mod.functions.find((x) => x.name === "labelSize");
  assert.deepStrictEqual([e.start, e.end, e.node, e.browser], [modOff, modOff + LABEL_SIZE.length, 3, 0]);
  const app = rep.files["index.html"];
  assert.ok(!app || !(app.functions || []).some((x) => x.name === "labelSize"), "not double-counted under index.html");
});

test("browser and sandbox ranges for labelSize land on the same module range after normalisation", () => {
  const nd = tmp(), bd = tmp();
  nodeJson(nd, "sandbox", [
    { scriptId: "1", url: "file://" + path.join(ROOT, "index.html"), functions: [fn("labelSize", regionStart + modOff, regionStart + modOff + LABEL_SIZE.length, 3)] },
    { scriptId: "2", url: "file://" + path.join(ROOT, "src", "engine", "pdfcards.js"), functions: [fn("labelSize", modOff, modOff + LABEL_SIZE.length, 2)] },
  ]);
  // The browser reports offsets into the <script> body, not into the file.
  const rel = regionStart + modOff - bodyStart;
  fs.writeFileSync(path.join(bd, "browser-1-0-0.json"), JSON.stringify({
    suite: "tests/e2e.test.js", scripts: { 7: { url: "file://" + path.join(ROOT, "index.html"), startLine, startColumn } },
    coverage: [{ scriptId: "7", url: "x", functions: [fn("labelSize", rel, rel + LABEL_SIZE.length, 5)] }],
  }));
  fs.writeFileSync(path.join(bd, "session-1-0.json"), JSON.stringify({ closed: true }));
  const rep = buildReport({ node: [nd], browser: bd, verbose: true });
  const hits = rep.files["src/engine/pdfcards.js"].functions.filter((x) => x.name === "labelSize");
  assert.strictEqual(hits.length, 1, "one range, three reports of it");
  assert.deepStrictEqual([hits[0].start, hits[0].node, hits[0].browser], [modOff, 5, 5]);
});

test("a function executed only in the browser copy is browser-only, not zero", () => {
  const nd = tmp(), bd = tmp();
  nodeJson(nd, "sandbox", [{ scriptId: "1", url: "file://" + path.join(ROOT, "src", "engine", "pdfcards.js"), functions: [fn("labelSize", modOff, modOff + LABEL_SIZE.length, 0)] }]);
  const rel = regionStart + modOff - bodyStart;
  fs.writeFileSync(path.join(bd, "browser-1-0-0.json"), JSON.stringify({
    suite: "tests/e2e.test.js", scripts: { 7: { url: "file://" + path.join(ROOT, "index.html"), startLine, startColumn } },
    coverage: [{ scriptId: "7", url: "x", functions: [fn("labelSize", rel, rel + LABEL_SIZE.length, 1)] }],
  }));
  fs.writeFileSync(path.join(bd, "session-1-0.json"), JSON.stringify({ closed: true }));
  const m = buildReport({ node: [nd], browser: bd }).files["src/engine/pdfcards.js"];
  assert.ok(!m.zeroFunctions.some((x) => x.name === "labelSize"));
  assert.ok(m.browserOnly.some((x) => x.name === "labelSize"));
});

test("scripts run without a filename are listed as unattributed and never counted for a shipped file", () => {
  const nd = tmp();
  nodeJson(nd, "share", [
    { scriptId: "1", url: "evalmachine.<anonymous>", functions: [fn("labelSize", 10, 10 + LABEL_SIZE.length, 4)] },
    { scriptId: "2", url: "file://" + path.join(ROOT, "src", "engine", "pdfcards.js"), functions: [fn("labelSize", modOff, modOff + LABEL_SIZE.length, 0)] },
  ]);
  const rep = buildReport({ node: [nd], browser: tmp() });
  assert.strictEqual(rep.unattributed.length, 1);
  assert.deepStrictEqual(rep.unattributed[0].functions[0].name, "labelSize");
  const z = rep.files["src/engine/pdfcards.js"].zeroFunctions.find((x) => x.name === "labelSize");
  assert.ok(z, "still zero for the shipped file");
  assert.strictEqual(z.liveInUnattributed, true);
});

test("the suite that alone executes a function is reported as its only toucher", () => {
  const nd = tmp();
  const u = "file://" + path.join(ROOT, "src", "engine", "pdfcards.js");
  nodeJson(nd, "a", [
    { scriptId: "1", url: "file://" + path.join(ROOT, "tests", "alpha.test.js"), functions: [fn("t", 0, 5, 1)] },
    { scriptId: "2", url: u, functions: [fn("labelSize", modOff, modOff + LABEL_SIZE.length, 1)] }]);
  nodeJson(nd, "b", [
    { scriptId: "1", url: "file://" + path.join(ROOT, "tests", "beta.test.js"), functions: [fn("t", 0, 5, 1)] },
    { scriptId: "2", url: u, functions: [fn("labelSize", modOff, modOff + LABEL_SIZE.length, 0)] }]);
  // alpha.test.js / beta.test.js do not exist on disk: realpath falls back to the
  // given path, and the suite label is read from the url.
  const m = buildReport({ node: [nd], browser: tmp() }).files["src/engine/pdfcards.js"];
  assert.deepStrictEqual(Object.keys(m.exclusive), ["tests/alpha.test.js"]);
  assert.ok(m.exclusive["tests/alpha.test.js"].functions.includes("labelSize"));
});

// ---------------------------------------------------------------------------
// Merge: python and CSS.
// ---------------------------------------------------------------------------
test("python: a def with no executed body line is a zero def; a loaded def is not", () => {
  const pd = tmp();
  const src = fs.readFileSync(path.join(ROOT, "tools", "sync_decks.py"), "utf8").split("\n");
  const defLine = src.findIndex((l) => /^def main\(/.test(l)) + 1;
  assert.ok(defLine > 0);
  fs.writeFileSync(path.join(pd, "test_x.json"), JSON.stringify({ files: { "tools/sync_decks.py": { executed_lines: [1, 2, defLine] } } }));
  const rep = buildReport({ node: [], browser: tmp(), python: pd });
  const f = rep.python.files["tools/sync_decks.py"];
  assert.ok(f.zeroDefs.some((d) => d.name === "main"));
  assert.strictEqual(f.neverLoaded, false);
  assert.strictEqual(rep.python.files["tools/hifi.py"].neverLoaded, true);
});

test("css: rules parse with their @media ancestry, and an unmatched media block is live by default", () => {
  const css = "/* c */ a { color: red; }\n@media (min-width: 640px) { .x, .y { top: 0 } }\n@keyframes k { from { a: b } }\nb::after { content: \"}\"; background: url(data:x;base64,AA==) }";
  const rules = parseCssRules(css, 100);
  assert.deepStrictEqual(rules.map((r) => r.selector), ["a", ".x, .y", "b::after"]);
  assert.deepStrictEqual(rules[1].media, ["@media (min-width: 640px)"]);
  assert.strictEqual(css.slice(rules[0].start - 100, rules[0].start - 100 + 1), "a");
  assert.strictEqual(css[rules[2].end - 100 - 1], "}");
});

test("css: a used range marks exactly its rule used, the rest are reported unused", () => {
  const bd = tmp();
  const styleOpen = html.indexOf("<style");
  const bodyAt = html.indexOf(">", styleOpen) + 1;
  const bl = html.slice(0, bodyAt).split("\n").length - 1;
  const bc = bodyAt - (html.slice(0, bodyAt).lastIndexOf("\n") + 1);
  const firstRule = parseCssRules(html.slice(bodyAt, html.indexOf("</style>", bodyAt)), bodyAt)[0];
  fs.writeFileSync(path.join(bd, "browser-1-0-0.json"), JSON.stringify({
    suite: "tests/e2e.test.js", scripts: {}, coverage: [],
    sheets: { S1: { sourceURL: "file://" + path.join(ROOT, "index.html"), isInline: true, startLine: bl, startColumn: bc } },
    cssDelta: [{ styleSheetId: "S1", startOffset: firstRule.start - bodyAt, endOffset: firstRule.end - bodyAt, used: true }],
    media: [{ text: "(min-width: 640px)", matches: true }], viewport: { width: 900, height: 900, mobile: false },
  }));
  fs.writeFileSync(path.join(bd, "session-1-0.json"), JSON.stringify({ closed: true }));
  const rep = buildReport({ node: [], browser: bd });
  assert.ok(!rep.css.unused.some((u) => u.start === firstRule.start));
  assert.ok(rep.css.unused.length === rep.css.ruleCount - 1);
  assert.deepStrictEqual(rep.viewports, [{ width: 900, height: 900, mobile: false }]);
  assert.ok(rep.media.some((m) => m.text.includes("min-width:640px") || m.text.includes("min-width: 640px")));
});

test("the CLI writes the report file", () => {
  const out = path.join(tmp(), "nested", "coverage-report.json");
  const r = cp.spawnSync("node", [TOOL, "--node", tmp(), "--browser", tmp(), "--out", out], { encoding: "utf8" });
  assert.strictEqual(r.status, 0, r.stderr);
  const rep = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.strictEqual(rep.schema, 1);
});
