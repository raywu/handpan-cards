// Four-mode gold census (import v2 regroup, 2026-10-17). Evidence, not product.
// Runs the engine at <repoRoot> over every gold case. With the L1 prototype
// applied (uncommitted) it measures L1; on a clean tree it measures today.
//   paste:     title + the verbatim source span.
//   window:    title + the page text (the Shopify body when it holds 5 strict
//              tokens, else the no-JS text), whole; the engine narrows a text
//              over 2,000 characters itself (L1 (f)).
//   selectall: title + the whole no-JS page text.
//   link:      the worker rule as it will ship (D-H): same source choice as
//              window; pass on one run of 5 or more strict tokens (octaved
//              letters or solfege), or on a run of 5 or more octaveless letters
//              directly after a known notes label; else 422. extractWindow
//              keeps 8,000 characters centred on the longest qualifying run,
//              then interpret runs on title + that window.
//   selectall20k, link20k: selectall and link on the L2a recorder's cut (4.4,
//              L2a (j)): a no-JS text over 20,000 characters is cut to the
//              20,000-character slice centred on its densest-pitch line, which
//              is what the L3 replay reads. The Shopify body is kept whole.
// parens:"bottom" is passed on the 8 ids of L1 (h) in every mode.
// The label rule is the prototype's, exactly (l1-prototype.patch:34-43):
// LABEL is case-insensitive and needs a colon; BARE_LABEL (Hauptnote, Main
// note, Noten, Notes) is case-sensitive, has no colon, and needs whitespace
// before the run. The run of octaveless letters after either is case-sensitive.
// Separators include the en and em dash. The JSON-LD description is not modelled: the cache holds no parsed JSON-LD.
//   git apply docs/plans/import-v2-eval/l1-prototype.patch
//   CENSUS_ENGINE=l1-prototype node docs/plans/import-v2-eval/census.cjs \
//     docs/plans/import-v2-gold.json <cacheDir> . docs/plans/import-v2-eval/census-l1.json
//   git checkout src/engine/importer.js
//   CENSUS_ENGINE=087a4a8 node docs/plans/import-v2-eval/census.cjs \
//     docs/plans/import-v2-gold.json <cacheDir> . docs/plans/import-v2-eval/census-today.json
const fs = require("node:fs"), path = require("node:path");
const [goldPath, cacheDir, root, outPath] = process.argv.slice(2);
const { loadEngine } = require(path.resolve(root, "tools/engine_loader.js"));
const E = loadEngine(["core", "importer"]);
const gold = JSON.parse(fs.readFileSync(goldPath, "utf8"));
const PARENS = new Set(["yatao-ayasa-d-kurd-12", "thomann-sela-sehp203-d-kurd-9-3-en", "ss-leaf-c-minor-14",
  "ss-sew-f3-low-pygmy-11", "ss-satya-eb-la-sirena-16", "ss-pantheon-halo-equinox-12",
  "thomann-sela-sehp203-d-kurd-9-3-fr", "thomann-sela-sehp203-d-kurd-9-3-it"]);
const SEP = "[\\s,\\-\\u2013\\u2014\\/\\u00b7|()]*";
const L = "(?<![A-Za-z0-9\\u00c0-\\u017f])", R = "(?![A-Za-z0-9#\\u00c0-\\u017f])";
const STRICT_TOK = L + "(?:[A-G](?:#|b|\\u266f|\\u266d)?[0-9]|(?:Do|R[e\\u00e9]|Mi|Fa|Sol|La|Si)(?:#|b|\\u266f|\\u266d)?[0-9])" + R;
const BARE_TOK = L + "[A-G](?:#|b|\\u266f|\\u266d)?" + R;
const STRICT_RUN = new RegExp("(?:" + STRICT_TOK + SEP + "){5,}", "g");
const LABEL = new RegExp("(?:\\b|(?<=[0-9]))(?:Ding(?:\\s*\\((?:center|centre)\\))?|Inner(?:\\s*Notes)?" +
  "|Notes\\s*\\(\\s*Bottom\\s*Side\\s*\\)|Notes\\s*Bottom\\s*Side|Bottom\\s*Side\\s*Notes|Bottom\\s*Notes|Bottom" +
  "|Notes\\s*\\(\\s*Top\\s*Side\\s*\\)|Notes\\s*Top\\s*Side|Top\\s*Side\\s*Notes|Top\\s*Notes|Top|Tones|Notes?|Notas" +
  "|Outer\\s*circle|notes\\b[^:]{0,40}\\bare)\\s*:\\s*", "gi");
const BARE_LABEL = new RegExp("\\b(?:Hauptnote|Main note|Noten|Notes)\\s+", "g");
const RUN_AFTER = new RegExp("\\(?((?:" + BARE_TOK + SEP + "){5,})", "y");
function labelRuns(text) {
  const out = [];
  for (const re of [LABEL, BARE_LABEL]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      RUN_AFTER.lastIndex = re.lastIndex;
      const r = RUN_AFTER.exec(text);
      if (r) out.push({ at: m.index, len: m[0].length + r[0].length, run: r[1] });
    }
  }
  return out;
}
const STRICT_ONE = new RegExp(STRICT_TOK, "g");
function classify(c, r, line) {
  const want = c.expected.status;
  if (r.status === "INSUFFICIENT") return want === "INSUFFICIENT" ? "correct-insufficient" : "insufficient";
  if (r.status === "NEEDS_INPUT" || !line) return want === "NEEDS_INPUT" ? "correct-block" : "blocked";
  if (want !== "REVIEW") return "wrong-but-valid";
  const p = E.core.parseSeed(line);
  if (!p.ok) return "refused";
  return E.core.formatSeed(p.value.fields) === c.expected.textSeed ? "exact" : "wrong-but-valid";
}
function run(c, text) {
  const opts = { title: c.title };
  if (PARENS.has(c.id)) opts.parens = "bottom";
  const r = JSON.parse(JSON.stringify(E.importer.interpret((c.title ? c.title + "\n" : "") + text, opts)));
  const line = E.importer.serialise(r);
  return { outcome: classify(c, r, line), status: r.status, codes: r.flags.map((f) => f.code), line };
}
function extractWindow(text) {
  const runs = [...text.matchAll(STRICT_RUN)].map((m) => ({ at: m.index, len: m[0].length, n: (m[0].match(STRICT_ONE) || []).length, why: "strict" }))
    .concat(labelRuns(text).map((m) => ({ at: m.at, len: m.len, n: (m.run.match(new RegExp(BARE_TOK, "g")) || []).length, why: "label" })));
  if (!runs.length) return null;
  const best = runs.reduce((a, b) => (b.n > a.n ? b : a));
  const mid = best.at + Math.floor(best.len / 2);
  const start = Math.max(0, Math.min(mid - 4000, text.length - 8000));
  return { text: text.slice(start, start + 8000), why: best.why };
}
const PITCH = /(?<![A-Za-z0-9])[A-G](?:#|b|\u266f|\u266d)?(?:-1|[0-9])?(?![A-Za-z0-9])/g;
function cut20k(text) {
  if (text.length <= 20000) return text;
  const lines = text.split(/\r?\n/);
  let best = 0, bestN = -1, at = 0, bestAt = 0;
  for (const l of lines) { const n = (l.match(PITCH) || []).length; if (n > bestN) { bestN = n; best = at; bestAt = at + Math.floor(l.length / 2); } at += l.length + 1; }
  const start = Math.max(0, Math.min(bestAt - 10000, text.length - 20000));
  return text.slice(start, start + 20000);
}
const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null);
const rows = [], totals = {};
const add = (mode, k) => { totals[mode] = totals[mode] || {}; totals[mode][k] = (totals[mode][k] || 0) + 1; };
for (const c of gold.cases) {
  const row = { id: c.id, want: c.expected.status };
  row.paste = c.span ? run(c, c.span) : { outcome: "no-text" };
  const shop = read(path.join(cacheDir, c.id + ".shopify.txt"));
  const txt = read(path.join(cacheDir, c.id + ".txt"));
  const page = shop && (shop.match(STRICT_ONE) || []).length >= 5 ? shop : txt;
  row.window = page == null ? { outcome: "no-text" } : run(c, page);
  row.selectall = txt == null ? { outcome: "no-text" } : run(c, txt);
  if (page == null) row.link = { outcome: "no-text" };
  else {
    const w = extractWindow(page);
    row.link = w ? Object.assign(run(c, w.text), { pass: w.why }) : { outcome: "422" };
  }
  const cut = txt == null ? null : cut20k(txt);
  row.selectall20k = cut == null ? { outcome: "no-text" } : run(c, cut);
  const page20k = shop && (shop.match(STRICT_ONE) || []).length >= 5 ? shop : cut;
  if (page20k == null) row.link20k = { outcome: "no-text" };
  else {
    const w = extractWindow(page20k);
    row.link20k = w ? Object.assign(run(c, w.text), { pass: w.why }) : { outcome: "422" };
  }
  for (const m of ["paste", "window", "selectall", "link", "selectall20k", "link20k"]) add(m, row[m].outcome);
  rows.push(row);
}
const out = { engine: process.env.CENSUS_ENGINE || "unlabelled", totals, rows };
if (outPath) fs.writeFileSync(outPath, JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(totals, null, 1));
for (const r of rows) console.log([r.id, r.want, r.paste.outcome, r.window.outcome, r.selectall.outcome, r.link.outcome, r.selectall20k.outcome, r.link20k.outcome, (r.link.codes || []).join(",")].join(" | "));
