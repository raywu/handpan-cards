// Fixture census (import v2 regroup, 2026-10-17). Evidence, not product.
// Runs every case of tests/fixtures/import_cases_v1.json through the engine at
// <repoRoot> (the L1 prototype applied, uncommitted) and lists each case whose
// status, sorted flag codes or serialised string differs from its fixture.
//   git apply docs/plans/import-v2-eval/l1-prototype.patch
//   node docs/plans/import-v2-eval/fixture_census.cjs . docs/plans/import-v2-eval/fixture_census.json
//   git checkout src/engine/importer.js
const fs = require("node:fs"), path = require("node:path");
const [root, outPath] = process.argv.slice(2);
const { loadEngine } = require(path.resolve(root, "tools/engine_loader.js"));
const E = loadEngine(["core", "importer"]);
const fx = JSON.parse(fs.readFileSync(path.resolve(root, "tests/fixtures/import_cases_v1.json"), "utf8"));
const flips = [];
for (const c of fx.cases) {
  const r = JSON.parse(JSON.stringify(E.importer.interpret(c.text, { title: c.title })));
  const got = { status: r.status, codes: r.flags.map((f) => f.code).sort(), serialised: E.importer.serialise(r) };
  const want = { status: c.expect.status, codes: [...c.expect.codes].sort(), serialised: c.expect.serialised };
  if (JSON.stringify(got) !== JSON.stringify(want)) flips.push({ id: c.id, group: c.group, text: c.text, want, got });
}
const out = { cases: fx.cases.length, flipped: flips.length, flips };
if (outPath) fs.writeFileSync(outPath, JSON.stringify(out, null, 1) + "\n");
for (const f of flips) console.log(f.id, "|", JSON.stringify(f.want), "->", JSON.stringify(f.got));
console.log(fx.cases.length, "cases,", flips.length, "flipped");
