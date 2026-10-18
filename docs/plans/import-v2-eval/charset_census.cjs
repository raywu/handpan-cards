// Charset census of the 40 cached gold pages (import v2 regroup, devops P3-3).
// Reads the <meta charset> or <meta http-equiv="Content-Type"> in the first 1,024
// bytes of each cached page, the same place the worker looks (4.4), and checks
// how many U+FFFD replacement characters the cached copy holds. probe.mjs saved
// each body through Buffer.toString("utf8") (probe.mjs:33), so a page that is not
// UTF-8 shows up as replacement characters, not as a decode error. The cache holds
// no response headers, so a charset sent only in Content-Type is not seen here.
//   node docs/plans/import-v2-eval/charset_census.cjs docs/plans/import-v2-gold.json <cacheDir>
const fs = require("node:fs"), path = require("node:path");
const [goldPath, cacheDir] = process.argv.slice(2);
const gold = JSON.parse(fs.readFileSync(goldPath, "utf8"));
const counts = {};
for (const c of gold.cases) {
  const f = path.join(cacheDir, c.id + ".html");
  if (!fs.existsSync(f)) { console.log(c.id, "| no page"); continue; }
  const html = fs.readFileSync(f, "utf8");
  const head = html.slice(0, 1024);
  const m = head.match(/<meta[^>]+charset\s*=\s*["']?([A-Za-z0-9_-]+)/i);
  const label = m ? m[1].toLowerCase() : "none";
  const bad = (html.match(/\uFFFD/g) || []).length;
  const k = label + (bad ? " replacement-chars" : " clean");
  counts[k] = (counts[k] || 0) + 1;
  console.log([c.id, c.expected.status, label, "U+FFFD x" + bad].join(" | "));
}
console.log(JSON.stringify(counts));
