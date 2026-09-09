// Loads the scale-engine modules under node:vm.
//
// This lives in tools/ rather than tests/ because a SHIPPING tool
// (tools/gen_deck.js) needs it: a production tool must not depend on a file
// under tests/, or a tests/ reorganisation silently breaks it.  There is still
// exactly ONE implementation of the convention below - tests/helpers/engine.js
// re-exports this module rather than keeping a second copy that could drift.
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
// Nothing require()s an engine file directly; every consumer goes through
// loadEngine so browser, tool and test see the same globals.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
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
    // Only host-realm globals a vm context lacks (a context brings its own
    // Array/Object/Error/JSON/Math; importing the host ones would break
    // `instanceof` for values the engine built). Same list as sandbox.js.
    console, URL, URLSearchParams, TextEncoder, TextDecoder, structuredClone,
    btoa, atob,
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
