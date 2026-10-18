// Pick-test constant census (import v2 regroup, 2026-10-17). Evidence, not product.
// The app test "IM: a picked ding refreshes every inferred octave and clears the
// NO_OCTAVE tick" (tests/app.test.js:10759) runs OCTAVELESS (tests/app.test.js:10649)
// unpicked and with {ding: 1}, and needs USE enabled after a NO_OCTAVE tick both
// times, so both runs must be REVIEW. This prints status, flags and the serialised
// string for OCTAVELESS and for three candidate bottoms with an octave written.
//   git apply docs/plans/import-v2-eval/l1-prototype.patch
//   node docs/plans/import-v2-eval/pick_constant.cjs . > docs/plans/import-v2-eval/pick_constant.txt
//   git checkout src/engine/importer.js
const path = require("node:path");
const { loadEngine } = require(path.resolve(process.argv[2], "tools/engine_loader.js"));
const E = loadEngine(["core", "importer"]);
const BASE = "Ding: D Top: A Bb C D E F G A";
for (const t of [BASE + " Bottom: C", BASE + " Bottom: C3", BASE + " Bottom: C5", BASE + " Bottom: C6"]) {
  for (const o of [{}, { ding: 1 }]) {
    const r = JSON.parse(JSON.stringify(E.importer.interpret(t, o)));
    console.log([t, JSON.stringify(o), r.status, r.flags.map((f) => f.code + ":" + f.level).join(","), E.importer.serialise(r)].join(" | "));
  }
}
