// Link-mode and select-all estimates on today's engine (plan 2026-10-17-import-v2, 2 and 7).
// link: the Shopify body only if it holds 5 strict (N1) pitch tokens, else the page text;
//   an 8,000-char window on the densest line; 422 NO_TEXT unless the window holds ONE run
//   of 5 strict tokens (regroup 2026-10-17: the shipped rule asks for one run, not a count);
//   then the 1,200-char window inside it, with the P1-1 scan (a run of 5 note tokens
//   outside the kept window blocks) on texts over 2,000 characters only, as L1 (f) ships it;
//   then interpret. census.cjs supersedes this file for every figure the regroup cites.
// window1200scan: tier0's window mode (same source choice) plus the P1-1 scan.
// selectall: the whole no-JS page text, 1,200-char window, P1-1 scan.
// Usage: node linkmode.cjs <gold.json> <cacheDir> <repoRoot> <out.json>
const fs = require("node:fs"), path = require("node:path");
const { loadEngine } = require(path.resolve(process.argv[4], "tools/engine_loader.js"));
const [goldPath, cacheDir, , outPath] = process.argv.slice(2);
const E = loadEngine(["core", "importer"]);
const gold = JSON.parse(fs.readFileSync(goldPath, "utf8"));
const PITCH = /(?<![A-Za-z0-9])[A-G](?:#|b|♯|♭)?(?:-1|[0-9])?(?![A-Za-z0-9])/g;
const STRICT = /(?<![A-Za-z0-9À-ſ])(?:[A-G](?:#|b|♯|♭)?[0-9]|(?:Do|R[ée]|Mi|Fa|Sol|La|Si)(?:#|b|♯|♭)?[0-9])(?![A-Za-z0-9])/g;
const STRICT_RUN = /(?:(?<![A-Za-z0-9À-ſ])(?:[A-G](?:#|b|♯|♭)?[0-9]|(?:Do|R[ée]|Mi|Fa|Sol|La|Si)(?:#|b|♯|♭)?[0-9])(?![A-Za-z0-9])[\s,\-\/·|()]*){5,}/;
const RUN = /(?:(?<![A-Za-z0-9])[A-G](?:#|b)?(?:[0-9])?(?![A-Za-z0-9])[\s,\-\/·|()]*){5,}/g;
function classify(c, r, line) {
  const want = c.expected.status;
  if (r.status === "INSUFFICIENT") return want === "INSUFFICIENT" ? "correct-insufficient" : "insufficient";
  if (r.status === "NEEDS_INPUT" || !line) return want === "NEEDS_INPUT" ? "correct-block" : "blocked";
  if (want !== "REVIEW") return "wrong-but-valid";
  const p = E.core.parseSeed(line);
  if (!p.ok) return "refused";
  return E.core.formatSeed(p.value.fields) === c.expected.textSeed ? "exact" : "wrong-but-valid";
}
function bestLine(lines) {
  const score = lines.map((l) => (l.match(PITCH) || []).length);
  let best = 0, bs = -1;
  for (let i = 0; i < lines.length; i++) {
    const s = score.slice(Math.max(0, i - 3), i + 4).reduce((a, b) => a + b, 0);
    if (s > bs) { bs = s; best = i; }
  }
  return best;
}
function win8k(text) {
  const lines = text.split(/\r?\n/);
  const at = lines.slice(0, bestLine(lines)).join("\n").length;
  const start = Math.max(0, at - 4000), end = Math.min(text.length, start + 8000);
  return { start, end };
}
function win1200(text) {
  const lines = text.split(/\r?\n/);
  const best = bestLine(lines), lo = Math.max(0, best - 3);
  const start = lines.slice(0, lo).join("\n").length + (lo ? 1 : 0);
  const end = start + lines.slice(lo, best + 4).join("\n").slice(0, 1200).length;
  return { start, end };
}
const outsideRun = (text, s, e) => text.length > 2000 && [...text.matchAll(RUN)].some((m) => m.index + m[0].length <= s || m.index >= e);
const run = (c, t) => {
  const r = JSON.parse(JSON.stringify(E.importer.interpret(t, { title: c.title })));
  return classify(c, r, E.importer.serialise(r));
};
const tally = {}, rows = [];
const add = (m, k) => { tally[m] = tally[m] || {}; tally[m][k] = (tally[m][k] || 0) + 1; };
for (const c of gold.cases) {
  const f1 = path.join(cacheDir, c.id + ".shopify.txt"), f2 = path.join(cacheDir, c.id + ".txt");
  const sOk = fs.existsSync(f1) && (fs.readFileSync(f1, "utf8").match(STRICT) || []).length >= 5;
  const f = sOk ? f1 : fs.existsSync(f2) ? f2 : null;
  if (!f) { add("link", "no-text"); add("window1200scan", "no-text"); add("selectall", "no-text"); continue; }
  const text = fs.readFileSync(f, "utf8");
  const head = c.title ? c.title + "\n" : "";
  const a = win8k(text), wa = text.slice(a.start, a.end);
  let o1;
  if (!STRICT_RUN.test(wa)) o1 = "422";
  else {
    const w = win1200(wa), ww = wa.slice(w.start, w.end);
    o1 = outsideRun(wa, w.start, w.end) ? (c.expected.status === "NEEDS_INPUT" ? "correct-block" : "blocked-scan") : run(c, head + ww);
  }
  const b = win1200(text), wb = text.slice(b.start, b.end);
  const o2 = outsideRun(text, b.start, b.end) ? (c.expected.status === "NEEDS_INPUT" ? "correct-block" : "blocked-scan") : run(c, head + wb);
  let o3 = "no-text";
  if (fs.existsSync(f2)) {
    const t3 = fs.readFileSync(f2, "utf8"), d = win1200(t3), w3 = t3.slice(d.start, d.end);
    o3 = outsideRun(t3, d.start, d.end) ? (c.expected.status === "NEEDS_INPUT" ? "correct-block" : "blocked-scan") : run(c, head + w3);
  }
  add("link", o1); add("window1200scan", o2); add("selectall", o3);
  rows.push([c.id, c.expected.status, o1, o2, o3].join(" | "));
}
console.log(rows.join("\n"));
console.log(JSON.stringify(tally, null, 1));
if (outPath) fs.writeFileSync(outPath, JSON.stringify({ engineBase: "087a4a8", modes: tally, cases: rows.map((r) => { const [id, want, link, window1200scan, selectall] = r.split(" | "); return { id, want, link, window1200scan, selectall }; }) }, null, 1) + "\n");
