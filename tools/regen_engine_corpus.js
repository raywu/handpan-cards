#!/usr/bin/env node
/* Rewrites (or, with --check, verifies) tests/fixtures/engine_corpus_v1.json:
 * the engine's observable output for a fixed corpus of seeds, so a refactor of
 * src/engine (complexity-refactor plan, 2026-10-03, lane EG) has an oracle that
 * is wider than the per-module unit tests.
 *
 * Corpus: the 20 strings of tests/fixtures/synthetic_scales.json, plus one
 * malformed seed per HPE.core.REASONS code that parseSeed can return. REASONS
 * is enumerated at run time: a code with no malformed seed below is recorded
 * under `notFromParseSeed`, so adding a code to REASONS changes the fixture.
 *
 * Per seed: the parseSeed result ({ok, code} or fields), layout.solve's geom,
 * and select.build's chord list (main, sup, fields, roots) with warning codes.
 *
 * A deliberate engine output change regenerates this file in the SAME commit
 * and says why in the commit body - never as a silent rebuild.
 *
 * Usage:
 *   node tools/regen_engine_corpus.js                     rewrite the fixture
 *   node tools/regen_engine_corpus.js --check             compare only, exit 1
 *                                                         on any mismatch
 *   --fixture PATH  read/write PATH instead of the default (combines with --check)
 */
const fs = require("node:fs");
const path = require("node:path");
const { loadEngine } = require("./engine_loader.js");

const ROOT = path.join(__dirname, "..");
const DEFAULT_DEST = path.join(ROOT, "tests", "fixtures", "engine_corpus_v1.json");
const SYNTHETIC = path.join(ROOT, "tests", "fixtures", "synthetic_scales.json");

const MALFORMED = {
  NO_DING: "G3 B3 D4 G4",
  NO_FIFTH: "(C3) D3 E3 F#3 G#3 A#3 C4 D4 E4",
  BAD_NOTE: "(D3) A3 H4 C4",
  NOTE_OUT_OF_RANGE: "(C9) D9 E9 A9",
  NOTE_OUT_OF_ORDER: "(D) A B C D E F G | C D2",
  NOTE_REPEATED: "(D3) A3 C4 C4 E4",
};

const hpe = loadEngine(["core", "voicing", "layout", "naming", "select"]);
const plain = (v) => JSON.parse(JSON.stringify(v));

const READERS = { legacy: hpe.core.parseLegacySeed, current: hpe.core.parseSeed };

function record(string, reader = "legacy") {
  const read = READERS[reader];
  if (!read) throw new Error(`unknown reader tag ${JSON.stringify(reader)} for ${string}`);
  const parsed = read(string);
  if (!parsed.ok) return { string, reader, parse: { ok: false, code: parsed.code } };
  const entry = { string, reader, parse: { ok: true, fields: plain(parsed.value.fields) } };
  const solved = hpe.layout.solve(parsed.value);
  entry.layout = solved.ok ? { ok: true, geom: plain(solved.value.geom) } : { ok: false, code: solved.code };
  const built = hpe.select.build(parsed.value);
  entry.build = built.ok
    ? {
        ok: true,
        chords: built.value.chords.map((c) => plain({ main: c.main, sup: c.sup, fields: c.fields, roots: c.roots })),
        warnings: built.warnings.map((w) => w.code),
      }
    : { ok: false, code: built.code };
  return entry;
}

function build() {
  const synthetic = JSON.parse(fs.readFileSync(SYNTHETIC, "utf8"));
  const malformed = {};
  const notFromParseSeed = [];
  for (const code of Object.keys(hpe.core.REASONS)) {
    if (!(code in MALFORMED)) {
      notFromParseSeed.push(code);
      continue;
    }
    const got = hpe.core.parseLegacySeed(MALFORMED[code]);
    if (got.ok || got.code !== code) {
      throw new Error(`malformed seed for ${code} no longer yields ${code}: ${JSON.stringify(got).slice(0, 120)}`);
    }
    malformed[code] = record(MALFORMED[code]);
  }
  return {
    synthetic: synthetic.map((s) => ({ name: s.name, ...record(s.string, s.reader) })),
    malformed,
    notFromParseSeed,
  };
}

function diff(expected, actual, where, problems) {
  if (JSON.stringify(expected) === JSON.stringify(actual)) return;
  const bothObjects = expected && actual && typeof expected === "object" && typeof actual === "object" &&
    Array.isArray(expected) === Array.isArray(actual);
  if (!bothObjects) {
    problems.push(`${where}: fixture ${JSON.stringify(expected)} != current ${JSON.stringify(actual)}`);
    return;
  }
  for (const k of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    diff(expected[k], actual[k], `${where}.${k}`, problems);
  }
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const flag = args.indexOf("--fixture");
  const dest = flag >= 0 ? path.resolve(args[flag + 1]) : DEFAULT_DEST;
  const corpus = build();

  if (check) {
    const existing = JSON.parse(fs.readFileSync(dest, "utf8"));
    const problems = [];
    diff(existing.corpus, corpus, "corpus", problems);
    if (problems.length) {
      console.error(`engine_corpus_v1.json is stale (${problems.length} mismatch(es)):`);
      for (const p of problems.slice(0, 40)) console.error("  " + p);
      process.exit(1);
    }
    console.log(`engine_corpus_v1.json matches: ${corpus.synthetic.length} synthetic, ` +
      `${Object.keys(corpus.malformed).length} malformed, ${corpus.notFromParseSeed.length} not from parseSeed`);
    return;
  }

  const out = {
    _what: "parseSeed / layout.solve / select.build output for the synthetic_scales.json strings plus one malformed seed per parseSeed-reachable REASONS code.",
    _why: "oracle for the src/engine refactor (complexity-refactor plan, lane EG): regenerate only for a deliberate engine output change, in the same commit, and say why in the commit body.",
    _regen: "node tools/regen_engine_corpus.js",
    corpus,
  };
  fs.writeFileSync(dest, JSON.stringify(out, null, 1) + "\n");
  console.log(`wrote ${dest}`);
}

main();
