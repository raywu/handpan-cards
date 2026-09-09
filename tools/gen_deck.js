#!/usr/bin/env node
"use strict";
/*
 * gen_deck.js - a scale seed becomes a printable deck.
 *
 *   node tools/gen_deck.js "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4"   > deck.json
 *   node tools/gen_deck.js --preset d_kurd_9                 > deck.json
 *   node tools/gen_deck.js --list-presets
 *
 * Options: --palette <0-5>  --parent <0-10>  --mirror  --name <text>
 *          --out <path>     (write the JSON there instead of to stdout)
 *
 * Output is the envelope {seed, deck}: `seed` is core.formatSeed's canonical
 * string, `deck` the generated deck object of ENGINE-SPEC section 11.
 * tools/decks.py's from_generated() turns that into the deck dict hifi.build
 * consumes.
 *
 * PURITY: no network, no fetch, no child process, and nothing is written
 * anywhere but the --out path.  Presets are INLINED seed strings for the same
 * reason the app inlines them (fetch fails under file://, is absent in the
 * sandbox, and breaks "offline-ish").
 *
 * ENGINE LOADING: through tests/helpers/engine.js's loadEngine, not require().
 * The engine modules are plain scripts that attach to a global HPE so they can
 * be inlined into index.html verbatim - they have no module wrapper to
 * require.  loadEngine is the one place that convention is implemented
 * (eng-review 2A); duplicating the node:vm dance here would give the tool a
 * second, drifting copy of it.
 *
 * ERRORS: a rejected seed exits 1 and prints "<CODE>: <reason>" on stderr,
 * where both come from the engine result - the code enum of ENGINE-SPEC
 * section 2 is CLOSED and the reason strings live in HPE.core.REASONS.  This
 * tool never composes a sentence of its own and never mints a code.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const { loadEngine } = require(path.join(ROOT, "tests", "helpers", "engine.js"));

// ---- presets: INLINED seed strings ----------------------------------------
// Six scales that are common on real instruments, chosen to spread across the
// engine's paths rather than to be a catalogue: two 25-chord decks and two
// small ones (so a preset exercises both a 3-sheet and a 2-sheet print run),
// a harmonic-minor parent alongside the aeolian ones, and sharp, flat and
// natural spellings.  None of them duplicates a built-in deck.
const PRESETS = [
  { id: "d_kurd_9", label: "D Kurd 9",
    seed: "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4" },
  { id: "d_celtic_minor_9", label: "D Celtic Minor 9",
    seed: "(D3) A3 C4 D4 E4 G4 A4 C5 D5" },
  { id: "csharp_annaziska_9", label: "C# Annaziska 9",
    seed: "(C#3) G#3 B3 C#4 D#4 E4 F#4 G#4 B4" },
  { id: "e_la_sirena_9", label: "E La Sirena 9",
    seed: "(E3) B3 C4 D4 E4 F#4 G4 B4 C5" },
  { id: "f_low_pygmy_9", label: "F Low Pygmy 9",
    seed: "(F3) Ab3 C4 Db4 Eb4 F4 Ab4 C5 Eb5" },
  { id: "g_hijaz_9", label: "G Hijaz 9",
    seed: "(G3) D4 Eb4 F#4 G4 A4 Bb4 C5 D5" },
];

function die(message) {
  process.stderr.write(message + "\n");
  process.exit(1);
}

function parseArgs(argv) {
  const out = { seed: null, options: {}, listPresets: false, out: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) die("usage: " + a + " needs a value");
      return argv[i];
    };
    if (a === "--list-presets") out.listPresets = true;
    else if (a === "--preset") {
      const id = next();
      const hit = PRESETS.find((p) => p.id === id);
      if (!hit) {
        die("unknown preset " + JSON.stringify(id) + "; known: " +
            PRESETS.map((p) => p.id).join(", "));
      }
      out.seed = hit.seed;
      if (out.options.name === undefined) out.options.name = hit.label;
    } else if (a === "--palette") out.options.palette = Number(next());
    else if (a === "--parent") out.options.parent = Number(next());
    else if (a === "--mirror") out.options.mirror = true;
    else if (a === "--name") out.options.name = next();
    else if (a === "--out") out.out = next();
    else if (a.startsWith("--")) die("unknown option " + a);
    else if (out.seed === null) out.seed = a;
    else die("more than one seed given");
  }
  return out;
}

function main(argv) {
  const args = parseArgs(argv);
  const HPE = loadEngine(["core", "voicing", "layout", "naming", "select"]);

  if (args.listPresets) {
    process.stdout.write(JSON.stringify(PRESETS, null, 2) + "\n");
    return;
  }
  if (args.seed === null) {
    die("usage: gen_deck.js \"<scale seed>\" | --preset <id> | --list-presets");
  }

  const parsed = HPE.core.parseSeed(args.seed, args.options);
  if (!parsed.ok) die(parsed.code + ": " + parsed.reason);

  const built = HPE.select.build(parsed.value);
  if (!built.ok) die(built.code + ": " + built.reason);

  const payload = {
    seed: HPE.core.formatSeed(parsed.value),
    deck: built.value,
  };
  const json = JSON.stringify(payload, null, 1) + "\n";
  if (args.out) fs.writeFileSync(args.out, json, "utf8");
  else process.stdout.write(json);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { PRESETS };
