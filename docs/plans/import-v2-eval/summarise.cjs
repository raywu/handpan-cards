// Summary of the Phase 1 result files (import v2). Evidence, not product.
//   node docs/plans/import-v2-eval/summarise.cjs <gold.json> <probe-results.json>
const fs = require("node:fs");
const gold = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const probe = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const byId = Object.fromEntries(gold.cases.map((c) => [c.id, c]));
const recs = probe.records;
const n = (f) => recs.filter(f).length;
const text = recs.filter((r) => byId[r.id].expected.status === "REVIEW");
const ms = recs.map((r) => r.ms).filter((x) => x != null).sort((a, b) => a - b);
const q = (p) => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))];
const out = {
  pages: recs.length,
  http200: n((r) => r.status === 200),
  challenged: n((r) => r.challenge),
  corsOpen: n((r) => r.cors === "*"),
  shopify: n((r) => r.shopify),
  shopifyJson200: n((r) => r.shopifyJson && r.shopifyJson.status === 200),
  jsonLdProduct: n((r) => r.jsonLdProduct > 0),
  jsonLdHasPitch: n((r) => r.jsonLdHasPitch),
  robotsAllows: n((r) => r.robotsAllows),
  reviewCases: text.length,
  reviewSpanInNoJsText: text.filter((r) => r.spanInNoJsText).length,
  reviewPitchesInNoJsText: text.filter((r) => r.pitchesInNoJsText).length,
  bytesMax: Math.max(...recs.map((r) => r.bytes || 0)),
  textCharsMax: Math.max(...recs.map((r) => r.textChars || 0)),
  msP50: q(0.5),
  msP90: q(0.9),
  msMax: ms[ms.length - 1],
};
console.log(JSON.stringify(out, null, 1));
for (const r of recs) if (byId[r.id].expected.status === "REVIEW" && !r.spanInNoJsText) console.log("span missing:", r.id);
for (const r of recs) if (r.cors !== "*") console.log("no open CORS:", r.id, r.cors);
