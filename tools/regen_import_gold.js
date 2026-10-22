#!/usr/bin/env node
/* Rewrites (or, with --check, verifies) tests/fixtures/import_gold_v1.json from
 * docs/plans/import-v2-gold.json: the fields the paste-mode replay reads
 * (id, title, span, category, expected status and text seed) and the ids that
 * take {parens: "bottom"}. --check never writes and exits 1 on drift.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(ROOT, "docs", "plans", "import-v2-gold.json");
const TARGET = path.join(ROOT, "tests", "fixtures", "import_gold_v1.json");
const PARENS_BOTTOM = [
  "yatao-ayasa-d-kurd-12",
  "thomann-sela-sehp203-d-kurd-9-3-en",
  "thomann-sela-sehp203-d-kurd-9-3-fr",
  "thomann-sela-sehp203-d-kurd-9-3-it",
  "ss-leaf-c-minor-14",
  "ss-sew-f3-low-pygmy-11",
  "ss-satya-eb-la-sirena-16",
  "ss-pantheon-halo-equinox-12"
];

const gold = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
const out = {
  version: 1,
  source: "docs/plans/import-v2-gold.json",
  parensBottom: PARENS_BOTTOM,
  cases: gold.cases.map((c) => ({
    id: c.id,
    category: c.category,
    title: c.title || "",
    span: c.span,
    status: c.expected.status,
    textSeed: c.expected.textSeed || null
  }))
};
const text = JSON.stringify(out, null, 1) + "\n";

if (process.argv.includes("--check")) {
  const have = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, "utf8") : "";
  if (have !== text) {
    console.error("tests/fixtures/import_gold_v1.json differs from docs/plans/import-v2-gold.json; run node tools/regen_import_gold.js");
    process.exit(1);
  }
  console.log("import gold fixture is current");
} else {
  fs.writeFileSync(TARGET, text);
  console.log("wrote " + path.relative(ROOT, TARGET) + " (" + out.cases.length + " cases)");
}
