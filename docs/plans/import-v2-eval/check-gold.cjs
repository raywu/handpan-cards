// Gold-set validator (import v2, Phase 1, section A). Evidence, not product.
// Checks every case: required fields; expected.seed and expected.textSeed parse
// and are already canonical (formatSeed of parseSeed); for a text case every
// note name of expected.textSeed occurs in the span (octave digit optional,
// unicode accidentals folded), so the expectation never invents a pitch the
// source does not show. Then reports the O6 mix rules.
//   node docs/plans/import-v2-eval/check-gold.cjs <gold.json>
const fs = require("node:fs");
const { loadEngine } = require("../../../tools/engine_loader.js");
const E = loadEngine(["core"]);
const gold = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const fold = (s) => s.replace(/♯/g, "#").replace(/♭/g, "b").replace(/(^|[^A-Za-z])([b#])([A-G])(?=\d)/g, "$1$3$2")
  .replace(/(Do|Ré|Re|Mi|Fa|Sol|La|Si)(b|#)?(?=\d)/g, (m, s, a) => ({ Do: "C", "Ré": "D", Re: "D", Mi: "E", Fa: "F", Sol: "G", La: "A", Si: "B" })[s] + (a || ""));
let bad = 0;
const fail = (id, msg) => { bad++; console.log("FAIL", id, msg); };
const REQ = ["id", "maker", "seller", "region", "lang", "platform", "category", "url", "readAt", "span", "expected", "reasoning"];
const STATUS = ["REVIEW", "NEEDS_INPUT", "INSUFFICIENT"];
const ids = new Set();
for (const c of gold.cases) {
  for (const k of REQ) if (!(k in c)) fail(c.id, "missing " + k);
  if (ids.has(c.id)) fail(c.id, "duplicate id");
  ids.add(c.id);
  if (!STATUS.includes(c.expected.status)) fail(c.id, "bad expected.status");
  if ((c.expected.status === "REVIEW") !== !!c.expected.textSeed) fail(c.id, "textSeed iff status REVIEW");
  for (const k of ["seed", "textSeed"]) {
    const s = c.expected[k];
    if (!s) continue;
    const p = E.core.parseSeed(s);
    if (!p.ok) { fail(c.id, k + " refused: " + p.code); continue; }
    const canon = E.core.formatSeed(p.value.fields);
    if (canon !== s) fail(c.id, k + " not canonical: " + canon);
  }
  if (c.expected.textSeed) {
    const span = fold(c.span);
    for (const tok of c.expected.textSeed.replace(/[()[\]|]/g, " ").split(/\s+/).filter(Boolean)) {
      const name = tok.replace(/\d$/, "");
      const re = new RegExp("(^|[^A-Za-z#])" + name.replace("#", "\\#") + "(?![#b])", "");
      if (!re.test(span)) fail(c.id, "textSeed note " + tok + " not in span");
    }
  }
}
const count = (f) => gold.cases.filter(f).length;
const makers = new Set(gold.cases.map((c) => c.maker));
const sellers = new Set(gold.cases.map((c) => c.seller));
const mix = {
  cases: gold.cases.length,
  makersOrSellers: new Set([...makers, ...sellers]).size,
  regions: [...new Set(gold.cases.map((c) => c.region))].sort(),
  nonShopify: count((c) => c.platform !== "shopify"),
  nonEnglish: count((c) => c.lang !== "en"),
  proseOnly: count((c) => c.category === "prose-only"),
  imageOnly: count((c) => c.category === "image-only"),
  named: ["Yatao", "Ayasa", "Sela", "Sanango"].map((n) => [n, count((c) => c.maker === n || c.seller === n)]),
};
console.log(JSON.stringify(mix));
const rules = [
  ["30-50 cases", mix.cases >= 30 && mix.cases <= 50],
  [">=10 makers/sellers", mix.makersOrSellers >= 10],
  ["EU, US, Asia", ["EU", "US", "Asia"].every((r) => mix.regions.includes(r))],
  [">=2 non-Shopify", mix.nonShopify >= 2],
  [">=2 non-English", mix.nonEnglish >= 2],
  [">=2 prose-only", mix.proseOnly >= 2],
  [">=3 image-only", mix.imageOnly >= 3],
  ["Yatao, Ayasa, Sela, Sanango", mix.named.every(([, n]) => n > 0)],
];
for (const [r, ok] of rules) { if (!ok) bad++; console.log(ok ? "ok  " : "FAIL", r); }
process.exit(bad ? 1 : 0);
