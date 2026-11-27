#!/usr/bin/env node
/* Writes a new editor pan oracle candidate from the CURRENT index.html by running
 * tests/editor_freeze.test.js in regeneration mode (needs a Chromium: CHROME_BIN).
 *
 * The fixture freezes the editor's pan, drag and drop oracle. Running this tool is how you
 * say "yes, the editor's render changes"; it is not a routine sync step, so run it only with
 * an owner-approved render change and explain the change in the same commit. A lane that
 * runs it to make its own tests pass has defeated the oracle.
 */
const { execFileSync, spawnSync } = require("node:child_process");
const path = require("node:path");

const output = process.argv[2];
if (!output || process.argv.length !== 3) {
  console.error("Usage: node tools/regen_editor_pan_fixture.js <new-candidate.json>");
  process.exit(2);
}
const repo = path.resolve(__dirname, "..");
const git = args => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
const revision = git(["rev-parse", "--short", "HEAD"]);
const dirty = git(["status", "--porcelain", "--", "index.html"]);
const test = path.join(repo, "tests", "editor_freeze.test.js");
const run = spawnSync(process.execPath, ["--test", test], {
  stdio: "inherit",
  env: {
    ...process.env,
    EDITOR_FREEZE_REGEN: "1",
    EDITOR_FREEZE_OUTPUT: path.resolve(output),
    EDITOR_FREEZE_SOURCE: revision + (dirty ? "-dirty" : ""),
  },
});
process.exit(run.status === null ? 1 : run.status);
