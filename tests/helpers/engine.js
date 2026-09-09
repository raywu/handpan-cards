// The engine loader for the test suites - a RE-EXPORT, not a second copy.
//
// The implementation lives in tools/engine_loader.js because tools/gen_deck.js
// ships and must not require a file under tests/ (a tests/ reorganisation would
// silently break it).  Tests keep importing "./helpers/engine.js" unchanged;
// the module convention it implements (plain scripts on a global HPE, no
// require/import/export in src/engine/*) is documented there.
module.exports = require("../../tools/engine_loader.js");
