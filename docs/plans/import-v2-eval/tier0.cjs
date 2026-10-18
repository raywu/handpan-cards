// Tier 0 baseline (import v2, Phase 1, section B). Evidence, not product.
// Runs the shipped HPE.importer.interpret over every gold case in two modes:
//   paste: the verbatim source span (what a user would copy from the page);
//   page:  the whole no-JS page text the probe saved (what a proxy would pass),
//          preferring the Shopify .json body text when the probe got one.
// A REVIEW result is what the user can USE after ticking its CONFIRMs, so a
// REVIEW whose serialised line differs from the expectation is WRONG-BUT-VALID.
//
//   node docs/plans/import-v2-eval/tier0.cjs <gold.json> <cacheDir> <out.json>
const fs = require("node:fs");
const path = require("node:path");
const { loadEngine } = require("../../../tools/engine_loader.js");

const [goldPath, cacheDir, outPath] = process.argv.slice(2);
const E = loadEngine(["core", "importer"]);
const gold = JSON.parse(fs.readFileSync(goldPath, "utf8"));

// expected.status is the right answer for a TEXT tier: REVIEW with textSeed, or
// NEEDS_INPUT (the source is genuinely ambiguous) or INSUFFICIENT (no pitches).
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
  if (text == null) return null;
  const r = JSON.parse(JSON.stringify(E.importer.interpret(text, { title: c.title })));
  const line = E.importer.serialise(r);
  return { status: r.status, codes: r.flags.map((f) => f.code), line, outcome: classify(c, r, line) };
}

const rows = [];
for (const c of gold.cases) {
  const read = (suffix) => {
    const f = path.join(cacheDir, c.id + suffix);
    return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
  };
  const page = read(".shopify.txt") ?? read(".txt");
  rows.push({ id: c.id, category: c.category, paste: run(c, c.span ? (c.title ? c.title + "\n" : "") + c.span : null),
              page: run(c, page) });
}
const tally = (mode) => rows.reduce((t, r) => {
  const k = r[mode] ? r[mode].outcome : "no-text";
  t[k] = (t[k] || 0) + 1;
  return t;
}, {});
const out = { ranAt: new Date().toISOString(), totals: { paste: tally("paste"), page: tally("page") }, rows };
fs.writeFileSync(outPath, JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out.totals, null, 1));
for (const r of rows) {
  console.log([r.id, r.category, r.paste && r.paste.outcome, r.paste && r.paste.codes.join(","),
               r.page && r.page.outcome, r.page && r.page.codes.join(",")].join(" | "));
}
