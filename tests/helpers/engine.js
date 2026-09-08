// Loads the scale-engine modules under node:vm for the engine test suites.
//
// MODULE CONVENTION (the app is single-file by contract, so the engine cannot
// use require/import - it has to be inlinable into index.html verbatim):
//
//   * every src/engine/<name>.js is a PLAIN SCRIPT, no module wrapper, no
//     require, no export statement;
//   * it attaches its public surface to the shared global namespace `HPE`,
//     which it must create defensively on first use:
//
//         var HPE = (typeof HPE !== "undefined") ? HPE : {};
//         HPE.core = { pc, midiOf, parseSeed, formatSeed, deckId };
//
//     (`var`, not `const`: `var` lands on the vm's global object, so later
//     scripts and index.html's own inline block both see it.)
//   * a module may read modules loaded BEFORE it (HPE.core inside HPE.voicing);
//     loadEngine's argument order is that load order.
//
// Tests never require() an engine file directly; they go through loadEngine so
// browser and test see the same globals.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..", "..");
const ENGINE_DIR = path.join(ROOT, "src", "engine");

/**
 * Load engine modules, in order, into ONE vm context.
 * @param {string[]|string} names e.g. ["core", "voicing"] or "core"
 * @param {object} [extraGlobals] merged into the context before loading
 * @returns {object} the shared HPE namespace, with `_context` attached
 */
function loadEngine(names, extraGlobals = {}) {
  const list = (Array.isArray(names) ? names : [names]).filter(Boolean);
  if (!list.length) throw new Error("loadEngine: name at least one engine module");

  const sandbox = {
    console, JSON, Math, Array, Object, Set, Map, String, Number, Boolean,
    Error, RegExp, Date, isNaN, isFinite, parseInt, parseFloat,
    TextEncoder, TextDecoder, structuredClone,
    btoa: (s) => Buffer.from(String(s), "binary").toString("base64"),
    atob: (s) => Buffer.from(String(s), "base64").toString("binary"),
    ...extraGlobals,
  };
  vm.createContext(sandbox);

  for (const name of list) {
    const file = path.join(ENGINE_DIR, `${name}.js`);
    if (!fs.existsSync(file)) {
      throw new Error(
        `loadEngine: ${path.relative(ROOT, file)} does not exist yet` +
        (fs.existsSync(ENGINE_DIR) ? "" : " (src/engine/ has not been created)"));
    }
    vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  }

  const ns = sandbox.HPE;
  if (!ns || typeof ns !== "object") {
    throw new Error(`loadEngine: ${list.join(", ")} defined no HPE namespace - ` +
                    "an engine module must assign to the global HPE object");
  }
  Object.defineProperty(ns, "_context", { value: sandbox, enumerable: false, configurable: true });
  return ns;
}

module.exports = { loadEngine, ENGINE_DIR };
