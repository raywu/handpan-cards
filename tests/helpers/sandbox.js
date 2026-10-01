// The boot-stub sandbox for the test suites - a RE-EXPORT, not a second copy.
//
// The implementation lives in tools/sandbox.js because tools/boot_sim.js and
// tools/regen_pan_fixture.js ship and must not require a file under tests/ (a
// tests/ reorganisation would silently break them) - the same rationale
// tools/engine_loader.js documents for the engine loader, and tests/helpers/
// engine.js follows for it. Tests keep importing "./helpers/sandbox.js"
// unchanged; the boot stub it implements is documented there.
module.exports = require("../../tools/sandbox.js");
