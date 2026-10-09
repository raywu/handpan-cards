#!/usr/bin/env node
// Merges the full-suite execution-coverage data into one report (refactor pass
// 4, lane 0). Inputs, all produced by .github/workflows/coverage.yml:
//
//   --node <dir>      NODE_V8_COVERAGE output (raw V8 JSON, one per process)
//   --browser <dir>   HPC_COVERAGE_DIR output of tests/helpers/cdp.js
//   --python <dir>    one `coverage json` file per tests/test_*.py module
//   --out <file>      the report (default artifacts/coverage-report.json)
//   --root <dir>      the checkout the paths resolve against (default: this repo)
//
// Attribution: a script run by tools/sandbox.js has the offsets of index.html
// itself; a browser script has offsets into its own <script> body, normalised
// here with Debugger.scriptParsed's startLine/startColumn FIRST. Only then is
// an index.html offset that falls inside an `<!-- engine:<name> begin -->`
// region moved onto src/engine/<name>.js by that region's constant offset.
// vm scripts run without a filename (evalmachine.<anonymous>) are listed under
// `unattributed` and never folded into a shipped file's counts.
//
// A browser take that failed (`*.incomplete.json`) or a session whose close()
// never ran makes this tool exit 1 and write nothing.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const { fileURLToPath } = require("node:url");

const REPO = path.resolve(__dirname, "..");

const readJSON = (f) => JSON.parse(fs.readFileSync(f, "utf8"));

function walk(dir) {
  const out = [];
  if (!dir || !fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out.sort();
}

function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

function lineOf(starts, off) {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= off) lo = mid; else hi = mid - 1;
  }
  return lo + 1;
}

function relOf(root, url) {
  if (!url) return null;
  let p = url;
  if (p.startsWith("file://")) { try { p = fileURLToPath(p); } catch { return null; } }
  if (!path.isAbsolute(p)) return null;
  let real = p;
  try { real = fs.realpathSync(p); } catch { /* a path that is gone */ }
  const rel = path.relative(root, real);
  if (rel.startsWith("..") || path.isAbsolute(rel) || rel.split(path.sep).includes("node_modules")) return null;
  return rel.split(path.sep).join("/");
}

// ---------------------------------------------------------------------------
// index.html structure: inline script bodies, engine regions, style blocks.
// ---------------------------------------------------------------------------
function htmlLayout(root) {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const starts = lineStarts(html);
  const bodies = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => { const start = m.index + m[0].length - "</script>".length - m[1].length; return [start, start + m[1].length]; });
  const regions = [];
  const re = /<!-- engine:(\w+) begin[^>]*-->\n<script>\n/g;
  for (let m; (m = re.exec(html));) {
    const file = path.join(root, "src", "engine", m[1] + ".js");
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, "utf8");
    const start = m.index + m[0].length;
    if (!html.startsWith(src, start)) continue;
    regions.push({ name: m[1], rel: `src/engine/${m[1]}.js`, start, end: start + src.length });
  }
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => ({ start: m.index + m[0].length - "</style>".length - m[1].length, text: m[1] }));
  return { html, starts, bodies, regions, styles };
}

// ---------------------------------------------------------------------------
// Accumulation.
// ---------------------------------------------------------------------------
const SHIPPED = /^(index\.html|src\/|tools\/|tests\/helpers\/)/;
class Acc {
  constructor(root) {
    this.root = root;
    this.layout = htmlLayout(root);
    this.files = new Map();        // rel -> { fns: Map, ranges: Map(suite -> Map) , fnSuites: Map }
    this.unattributed = [];
    this.suites = new Set();
    this.seenRel = new Set();      // every shipped file any coverage mentioned
    this.counts = { nodeJson: 0, browserTakes: 0, pythonModules: 0 };
  }
  file(rel) {
    let f = this.files.get(rel);
    if (!f) { f = { fns: new Map(), ranges: new Map() }; this.files.set(rel, f); }
    return f;
  }
  // Route one html-coordinate range to [rel, shifted start, shifted end] or null.
  route(rel, s, e) {
    if (rel !== "index.html") return [rel, s, e];
    for (const r of this.layout.regions) if (s >= r.start && e <= r.end) return [r.rel, s - r.start, e - r.start];
    return ["index.html", s, e];
  }
  addScript(rel, suite, kind, fns, base) {
    if (!SHIPPED.test(rel)) return;
    this.suites.add(suite);
    const { html, bodies } = this.layout;
    for (const fn of fns) {
      const r0 = fn.ranges[0];
      const topLevel = fn.functionName === "" && (
        (rel === "index.html" && r0.startOffset + base === 0 && r0.endOffset + base >= html.length) ||
        (rel === "index.html" && bodies.some(([a, b]) => r0.startOffset + base === a && r0.endOffset + base === b)) ||
        (rel !== "index.html" && r0.startOffset === 0 && base === 0));
      fn.ranges.forEach((rg, i) => {
        if (topLevel && i === 0) return;
        const hit = this.route(rel, rg.startOffset + base, rg.endOffset + base);
        if (!hit) return;
        const f = this.file(hit[0]);
        this.seenRel.add(hit[0]);
        const key = hit[1] + ":" + hit[2];
        let m = f.ranges.get(suite);
        if (!m) { m = new Map(); f.ranges.set(suite, m); }
        m.set(key, (m.get(key) || 0) + rg.count);
        if (i === 0) {
          let e = f.fns.get(key);
          if (!e) { e = { name: fn.functionName, start: hit[1], end: hit[2], node: 0, browser: 0, suites: new Set() }; f.fns.set(key, e); }
          e[kind] += rg.count;
          if (rg.count > 0) e.suites.add(suite);
        }
      });
    }
  }
  nodeJson(file, dir) {
    const j = readJSON(file);
    const entries = (j.result || []).map((s) => ({ s, rel: relOf(this.root, s.url) })).filter((x) => x.rel);
    const anon = (j.result || []).filter((s) => /^evalmachine\./.test(s.url || ""));
    let suite = null;
    for (const x of entries) {
      if (/^tests\/[^/]+\.test\.js$/.test(x.rel) && x.s.functions.some((f) => f.ranges[0].count > 0 && f.functionName)) { suite = x.rel; break; }
    }
    if (!suite) {
      const sub = path.relative(dir, path.dirname(file));
      suite = sub && !sub.startsWith("..") ? "py:" + sub.split(path.sep)[0] : null;
    }
    if (!entries.length && !anon.length) return;
    this.counts.nodeJson++;
    if (!suite) suite = "node:other";
    for (const x of entries) this.addScript(x.rel, suite, "node", x.s.functions, 0);
    for (const s of anon) {
      const live = s.functions.filter((f) => f.functionName && f.ranges[0].count > 0)
        .map((f) => ({ name: f.functionName, length: f.ranges[0].endOffset - f.ranges[0].startOffset, count: f.ranges[0].count }));
      if (live.length) this.unattributed.push({ suite, url: s.url, functions: live });
    }
  }
  browserTake(t) {
    this.counts.browserTakes++;
    const suite = t.suite || "browser:unknown";
    this.suites.add(suite);
    const { starts } = this.layout;
    for (const s of t.coverage || []) {
      const sc = (t.scripts || {})[s.scriptId];
      if (!sc || relOf(this.root, sc.url) !== "index.html") continue;
      const base = starts[sc.startLine] + sc.startColumn;
      this.addScript("index.html", suite, "browser", s.functions, base);
    }
  }
}

// ---------------------------------------------------------------------------
// Per-file analysis.
// ---------------------------------------------------------------------------
function analyseFile(rel, f, text, starts) {
  const fns = [...f.fns.values()].sort((a, b) => a.start - b.start || b.end - a.end);
  const enclosing = (fn) => {
    let best = null;
    for (const o of fns) {
      if (o === fn || o.start > fn.start || o.end < fn.end || (o.start === fn.start && o.end === fn.end)) continue;
      if (!best || o.end - o.start < best.end - best.start) best = o;
    }
    return best;
  };
  const view = (fn) => {
    const enc = enclosing(fn);
    return {
      name: fn.name || "(anonymous)", start: fn.start, end: fn.end,
      line: lineOf(starts, fn.start), endLine: lineOf(starts, fn.end),
      enclosing: enc ? { name: enc.name || "(anonymous)", start: enc.start, end: enc.end, line: lineOf(starts, enc.start) } : null,
      node: fn.node, browser: fn.browser,
    };
  };
  const out = { functionCount: fns.length, zeroFunctions: [], browserOnly: [], uncovered: [], suitesTouching: [] };
  const live = new Set();
  for (const fn of fns) {
    const total = fn.node + fn.browser;
    if (total === 0) out.zeroFunctions.push(view(fn));
    else {
      live.add(fn);
      if (fn.node === 0) out.browserOnly.push(view(fn));
    }
  }
  // Painted masks: bit 1 executed, bit 2 explicitly zero, per suite.
  const len = text.length;
  const masks = new Map();
  for (const [suite, ranges] of f.ranges) {
    const list = [...ranges].map(([k, c], i) => { const [s, e] = k.split(":").map(Number); return [s, e, c, i]; })
      .sort((a, b) => a[0] - b[0] || b[1] - a[1] || a[3] - b[3]);
    const m = new Uint8Array(len);
    for (const [s, e, c] of list) m.fill(c > 0 ? 1 : 2, s, Math.min(e, len));
    masks.set(suite, m);
  }
  const covered = new Uint8Array(len), zero = new Uint8Array(len);
  for (const m of masks.values()) for (let i = 0; i < len; i++) { if (m[i] === 1) covered[i] = 1; else if (m[i] === 2) zero[i] = 1; }
  for (let i = 0; i < len;) {
    if (!(zero[i] && !covered[i])) { i++; continue; }
    let j = i;
    while (j < len && zero[j] && !covered[j]) j++;
    let s = i, e = j;
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e > s) {
      let enc = null;
      for (const o of fns) if (o.start <= s && o.end >= e && (!enc || o.end - o.start < enc.end - enc.start)) enc = o;
      if (enc && live.has(enc)) {
        out.uncovered.push({ start: s, end: e, line: lineOf(starts, s), endLine: lineOf(starts, e), inFunction: enc.name || "(anonymous)" });
      }
    }
    i = j;
  }
  // Lines only one suite executes.
  const exclusive = {};
  const lineCount = starts.length;
  for (const [suite, m] of masks) {
    const lines = new Set();
    for (let i = 0; i < len; i++) {
      if (m[i] !== 1 || /\s/.test(text[i])) continue;
      let only = true;
      for (const [other, om] of masks) if (other !== suite && om[i] === 1) { only = false; break; }
      if (only) lines.add(lineOf(starts, i));
    }
    const names = [...f.fns.values()].filter((fn) => fn.suites.size === 1 && fn.suites.has(suite)).map((fn) => fn.name || "(anonymous)");
    if (lines.size || names.length) exclusive[suite] = { lines: lines.size, functions: names.slice(0, 200) };
  }
  out.exclusive = exclusive;
  out.suitesTouching = [...masks.keys()].sort();
  out.lineCount = lineCount;
  return out;
}

// ---------------------------------------------------------------------------
// CSS.
// ---------------------------------------------------------------------------
const normMedia = (s) => s.replace(/@media/i, "").replace(/\s+/g, "").toLowerCase();

function parseCssRules(text, base) {
  const rules = [];
  const atStack = [];
  let pstart = 0;
  const n = text.length;
  const skipTrivia = (i) => {
    for (;;) {
      while (i < n && /\s/.test(text[i])) i++;
      if (text.startsWith("/*", i)) { const e = text.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; } else return i;
    }
  };
  const skipStr = (i) => { const q = text[i]; i++; while (i < n && text[i] !== q) { if (text[i] === "\\") i++; i++; } return i; };
  const skipParen = (i) => {
    let d = 0;
    for (; i < n; i++) {
      const c = text[i];
      if (c === '"' || c === "'") i = skipStr(i);
      else if (c === "(") d++;
      else if (c === ")" && --d === 0) return i;
    }
    return n;
  };
  const matchBrace = (i) => {
    let d = 0;
    for (; i < n; i++) {
      const c = text[i];
      if (c === '"' || c === "'") i = skipStr(i);
      else if (c === "(") i = skipParen(i);
      else if (text.startsWith("/*", i)) { const e = text.indexOf("*/", i + 2); i = e < 0 ? n : e + 1; }
      else if (c === "{") d++;
      else if (c === "}" && --d === 0) return i;
    }
    return n - 1;
  };
  for (let i = 0; i < n; i++) {
    const c = text[i];
    if (c === '"' || c === "'") i = skipStr(i);
    else if (c === "(") i = skipParen(i);
    else if (text.startsWith("/*", i)) { const e = text.indexOf("*/", i + 2); i = e < 0 ? n : e + 1; }
    else if (c === ";") pstart = i + 1;
    else if (c === "}") { atStack.pop(); pstart = i + 1; }
    else if (c === "{") {
      const selStart = skipTrivia(pstart);
      const prelude = text.slice(selStart, i).trim();
      if (/^@(media|supports|container|layer)\b/i.test(prelude)) { atStack.push(prelude); pstart = i + 1; continue; }
      const close = matchBrace(i);
      if (!prelude.startsWith("@")) {
        rules.push({ wsStart: base + pstart, start: base + selStart, end: base + close + 1, selector: prelude.replace(/\s+/g, " "),
          media: atStack.filter((a) => /^@media/i.test(a)) });
      }
      i = close;
      pstart = close + 1;
    }
  }
  return rules;
}

// ---------------------------------------------------------------------------
// Python.
// ---------------------------------------------------------------------------
const PY_DEFS = `
import ast, json, sys
out = {}
for f in sys.argv[1:]:
    tree = ast.parse(open(f, encoding="utf-8").read())
    defs = []
    def visit(node, prefix):
        for ch in ast.iter_child_nodes(node):
            if isinstance(ch, (ast.FunctionDef, ast.AsyncFunctionDef)):
                q = prefix + ch.name
                defs.append([q, ch.lineno, ch.end_lineno])
                visit(ch, q + ".")
            elif isinstance(ch, ast.ClassDef):
                visit(ch, prefix + ch.name + ".")
            else:
                visit(ch, prefix)
    visit(tree, "")
    out[f] = defs
print(json.dumps(out))
`;

function pythonReport(root, dir) {
  const rels = fs.readdirSync(path.join(root, "tools")).filter((f) => f.endsWith(".py")).sort().map((f) => "tools/" + f);
  const executed = new Map(), loaded = new Set(), perModule = new Map();
  const modules = walk(dir).filter((f) => f.endsWith(".json"));
  for (const f of modules) {
    const mod = path.basename(f, ".json");
    const j = readJSON(f);
    for (const [p, d] of Object.entries(j.files || {})) {
      const rel = relOf(root, path.isAbsolute(p) ? p : path.join(root, p));
      if (!rel) continue;
      loaded.add(rel);
      const set = executed.get(rel) || new Set();
      for (const l of d.executed_lines || []) set.add(l);
      executed.set(rel, set);
      const pm = perModule.get(rel) || new Map();
      pm.set(mod, new Set(d.executed_lines || []));
      perModule.set(rel, pm);
    }
  }
  const res = cp.spawnSync("python3", ["-c", PY_DEFS, ...rels], { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 });
  if (res.status !== 0) throw new Error("python def listing failed: " + res.stderr);
  const defs = JSON.parse(res.stdout);
  const out = { modules: modules.length, files: {} };
  for (const rel of rels) {
    const ex = executed.get(rel) || new Set();
    const zeroDefs = [];
    for (const [name, line, end] of defs[rel]) {
      let hit = false;
      for (let l = line + 1; l <= end; l++) if (ex.has(l)) { hit = true; break; }
      if (!hit) zeroDefs.push({ name, line, endLine: end });
    }
    const exclusive = {};
    const pm = perModule.get(rel) || new Map();
    for (const [mod, lines] of pm) {
      let n = 0;
      for (const l of lines) { let only = true; for (const [o, ol] of pm) if (o !== mod && ol.has(l)) { only = false; break; } if (only) n++; }
      if (n) exclusive[mod] = { lines: n };
    }
    out.files[rel] = { defCount: defs[rel].length, neverLoaded: !loaded.has(rel), zeroDefs, exclusive };
  }
  return out;
}

// ---------------------------------------------------------------------------
// The report.
// ---------------------------------------------------------------------------
function problems(browserDir) {
  const bad = [];
  for (const f of walk(browserDir)) {
    const b = path.basename(f);
    if (b.endsWith(".incomplete.json")) bad.push({ file: b, reason: "a takePreciseCoverage/CSS take failed: " + (readJSON(f).error || "") });
    else if (b.startsWith("session-")) {
      const s = readJSON(f);
      if (!s.closed) bad.push({ file: b, reason: "browser session never reached close(); its last take is missing", suite: s.suite });
    }
  }
  return bad;
}

function buildReport(opts) {
  const root = fs.realpathSync(opts.root || REPO);
  const bad = problems(opts.browser);
  if (bad.length) { const e = new Error("incomplete browser coverage"); e.incomplete = bad; throw e; }
  const acc = new Acc(root);
  for (const d of [].concat(opts.node || [])) for (const f of walk(d)) if (/coverage-.*\.json$/.test(path.basename(f))) acc.nodeJson(f, d);
  const takes = [], viewports = [];
  for (const f of walk(opts.browser)) {
    const b = path.basename(f);
    if (/^browser-.*\.json$/.test(b)) takes.push(readJSON(f));
    else if (/^viewports-.*\.jsonl$/.test(b)) for (const l of fs.readFileSync(f, "utf8").split("\n")) if (l) viewports.push(JSON.parse(l));
  }
  for (const t of takes) acc.browserTake(t);

  const { starts, html, styles } = acc.layout;
  const report = {
    schema: 1,
    sources: { ...acc.counts, suites: [...acc.suites].sort() },
    files: {}, unattributed: [], neverLoaded: [],
  };
  for (const [rel, f] of [...acc.files].sort((a, b) => a[0].localeCompare(b[0]))) {
    const text = rel === "index.html" ? html : fs.readFileSync(path.join(root, rel), "utf8");
    const st = rel === "index.html" ? starts : lineStarts(text);
    report.files[rel] = analyseFile(rel, f, text, st);
    if (opts.verbose) report.files[rel].functions = [...f.fns.values()].map((e) => ({ name: e.name, start: e.start, end: e.end, node: e.node, browser: e.browser }));
  }
  for (const u of acc.unattributed) report.unattributed.push(u);
  const unattribLive = new Set(acc.unattributed.flatMap((u) => u.functions.map((f) => f.name + ":" + f.length)));
  for (const r of Object.values(report.files)) {
    for (const z of r.zeroFunctions) if (unattribLive.has(z.name + ":" + (z.end - z.start))) z.liveInUnattributed = true;
  }
  for (const dir of ["src/engine", "tools", "tests/helpers"]) {
    for (const f of fs.readdirSync(path.join(root, dir)).filter((x) => x.endsWith(".js")).sort()) {
      const rel = `${dir}/${f}`;
      if (!acc.seenRel.has(rel)) report.neverLoaded.push(rel);
    }
  }
  if (opts.python) report.python = pythonReport(root, opts.python);

  // CSS: rule universe from index.html, used ranges from the browser takes.
  const rules = styles.flatMap((s) => parseCssRules(s.text, s.start));
  const used = [];
  let unmapped = 0;
  for (const t of takes) {
    for (const u of t.cssDelta || []) {
      const sh = (t.sheets || {})[u.styleSheetId];
      if (!sh || !sh.isInline || relOf(root, sh.sourceURL) !== "index.html") { unmapped++; continue; }
      if (!u.used) continue;
      const b = starts[sh.startLine] + sh.startColumn;
      used.push([b + u.startOffset, b + u.endOffset]);
    }
  }
  used.sort((a, b) => a[0] - b[0]);
  const isUsed = (r) => {
    let lo = 0, hi = used.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (used[m][0] < r.wsStart) lo = m + 1; else hi = m; }
    return lo < used.length && used[lo][0] <= r.start;
  };
  const matched = new Map(), seen = new Set();
  const vps = new Map();
  const noteMedia = (list) => { for (const m of list || []) { const k = normMedia(m.text); seen.add(k); if (m.matches) matched.set(k, true); } };
  for (const v of viewports) { noteMedia(v.media); vps.set(`${v.width}x${v.height}${v.mobile ? "m" : ""}`, v); }
  for (const t of takes) { noteMedia(t.media); if (t.viewport) vps.set(`${t.viewport.width}x${t.viewport.height}${t.viewport.mobile ? "m" : ""}`, t.viewport); }
  const unusedRules = [];
  for (const r of rules) {
    if (isUsed(r)) continue;
    const inUnmatched = r.media.some((m) => !matched.get(normMedia(m)));
    unusedRules.push({ selector: r.selector, line: lineOf(starts, r.start), start: r.start, end: r.end, media: r.media,
      liveByDefault: inUnmatched ? "inside an @media block no recorded viewport satisfied" : undefined });
  }
  report.css = { ruleCount: rules.length, usedRangeCount: used.length, unmappedDeltaEntries: unmapped, unused: unusedRules };
  const mediaTexts = new Set(rules.flatMap((r) => r.media));
  report.media = [...mediaTexts].sort().map((m) => ({ text: m, exercised: !!matched.get(normMedia(m)) }));
  report.viewports = [...vps.values()].map((v) => ({ width: v.width, height: v.height, mobile: v.mobile }))
    .sort((a, b) => a.width - b.width || a.height - b.height);
  return report;
}

function main(argv) {
  const opts = { node: [], out: path.join(REPO, "artifacts", "coverage-report.json") };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = argv[i + 1];
    const need = () => { if (v === undefined) { console.error(`${a} needs a value`); process.exit(2); } i++; return v; };
    if (a === "--node") opts.node.push(need());
    else if (a === "--browser") opts.browser = need();
    else if (a === "--python") opts.python = need();
    else if (a === "--out") opts.out = need();
    else if (a === "--root") opts.root = need();
    else if (a === "--verbose") opts.verbose = true;
    else { console.error(`unknown argument ${a}`); process.exit(2); }
  }
  let report;
  try { report = buildReport(opts); } catch (e) {
    if (e.incomplete) {
      console.error("coverage run is INCOMPLETE; no report written:");
      for (const b of e.incomplete) console.error(`  ${b.file}: ${b.reason}`);
      process.exit(1);
    }
    throw e;
  }
  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  fs.writeFileSync(opts.out, JSON.stringify(report, null, 1));
  console.log(`wrote ${opts.out}`);
}

module.exports = { buildReport, parseCssRules, htmlLayout };
if (require.main === module) main(process.argv.slice(2));
