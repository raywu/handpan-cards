#!/usr/bin/env node
/* Rewrites tests/fixtures/editor_pan_v1.json from the CURRENT index.html by running
 * tests/editor_freeze.test.js in regeneration mode (needs a Chromium: CHROME_BIN).
 *
 * The fixture freezes the editor's pan, drag and drop oracle. Running this tool is how you
 * say "yes, the editor's render changes"; it is not a routine sync step, so run it only with
 * an owner-approved render change and explain the change in the same commit. A lane that
 * runs it to make its own tests pass has defeated the oracle.
 */
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const test = path.join(__dirname, "..", "tests", "editor_freeze.test.js");
const run = spawnSync(process.execPath, ["--test", test], {
  stdio: "inherit",
  env: { ...process.env, EDITOR_FREEZE_REGEN: "1" },
});
process.exit(run.status === null ? 1 : run.status);
