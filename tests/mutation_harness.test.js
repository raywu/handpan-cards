// Self-test for tests/mutation_check.sh's own safety gates.
//
// The mutation sweep is the repo's red-proof gate, but nothing proved the GATE
// ITSELF was live. Two gates in particular had no coverage:
//
//   (a) the unconditional clean-tree baseline abort (queue row 187). PR #43
//       fixed a sweep that could report a full green having tested nothing -
//       a clean-tree-red suite "kills" every mutant pointed at it - but the fix
//       shipped with no mutant of its own, so restoring the old behaviour would
//       have reddened nothing.
//   (b) the browserless partial sweep (queue row 193). A sweep that skipped 32
//       of 204 mutants still printed MUTATION GATE PASSED and exited 0.
//
// The obvious approach - a mutant patch naming tests/mutation_check.sh whose
// suite IS tests/mutation_check.sh - does not work: the inner invocation sees
// the outer sweep's own applied patch, hits the dirty-tree refusal and exits 2,
// which the sweep records as a "kill" without ever evaluating the reverted
// guard. So instead every case here drives a COPY of the script against a
// throwaway fixture git repo with a fixture mutant corpus and a trivial fixture
// suite. The real corpus is never touched.
//
// Spec-first per tests/CONTRACT.md rule 1: the assertions are on the script's
// documented user-observable contract - its exit codes and the machine-readable
// result lines its own header block promises - not on its implementation.
//
// TRAP (queue row 165): node's test runner exports NODE_TEST_CONTEXT, and a
// node child that inherits it believes it is a runner-managed worker and exits
// 0 immediately. A lane once shipped a hang test that "passed" in 212ms that
// way. Every child spawned here goes through childEnv(), which deletes it, and
// one test below asserts that scrubbing actually happens.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const SCRIPT = path.join(ROOT, "tests", "mutation_check.sh");

function childEnv(extra) {
  const env = { ...process.env, ...(extra || {}) };
  // See TRAP above. Also drop E2E_PORT: pinning it is the exact environmental
  // difference that turns the real e2e prefix red (queue rows 162, 173, 174).
  delete env.NODE_TEST_CONTEXT;
  delete env.E2E_PORT;
  return env;
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", env: childEnv() });
}

// The fixture suite. Three levers, kept separate on purpose:
//   subject.txt - what the fixture MUTANT flips (ok -> bad)
//   health.txt  - whether the suite is green on the clean tree
//   flaky.txt   - "once"/"always" makes it exit 124, exactly what `timeout`
//                 reports for a wall-clock kill.
// Simulating the timeout by RETURNING 124 rather than by actually sleeping past
// MUTANT_TIMEOUT keeps the hang cases deterministic and instant, and keeps them
// working on a machine with no `timeout` binary (stock macOS), where the script
// runs suites unbounded and a real sleep would simply finish.
const CHECK_JS = `const fs = require("fs");
const read = f => fs.readFileSync(f, "utf8").trim();
const mode = read("flaky.txt");
if (mode === "always" || (mode === "once" && !fs.existsSync("tripped"))) {
  fs.writeFileSync("tripped", "1");
  process.exit(124);
}
process.exit(read("subject.txt") === "ok" && read("health.txt") === "green" ? 0 : 1);
`;

// Builds a throwaway git repo holding: a two-file "subject" the fixture suite
// checks, that suite (node check.js), a copy of the script under test, and a
// mutants dir populated from `mutants`.
//
// health.txt is the baseline lever and subject.txt is the mutant lever, kept
// SEPARATE on purpose: a fixture that made the baseline red by pre-mutating
// subject.txt would trip the "does not apply" branch (which runs BEFORE the
// baseline) and prove nothing about the baseline gate.
//
// `mutants` entries are { name, header, suiteHeader? }. Every patch body is
// GENERATED from a real `git diff` on the committed fixture tree - the same
// discipline tests/CONTRACT.md rule 4 imposes on the real corpus, and here it
// is free.
function makeFixture(t, { health = "green", flaky = "no", mutants }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mutharness-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  fs.mkdirSync(path.join(dir, "tests", "mutants"), { recursive: true });
  fs.writeFileSync(path.join(dir, "subject.txt"), "ok\n");
  fs.writeFileSync(path.join(dir, "health.txt"), `${health}\n`);
  fs.writeFileSync(path.join(dir, "flaky.txt"), `${flaky}\n`);
  fs.writeFileSync(path.join(dir, "check.js"), CHECK_JS);
  fs.copyFileSync(SCRIPT, path.join(dir, "tests", "mutation_check.sh"));
  fs.chmodSync(path.join(dir, "tests", "mutation_check.sh"), 0o755);

  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "fixture@example.invalid"]);
  git(dir, ["config", "user.name", "Fixture"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  git(dir, ["add", "."]);
  git(dir, ["commit", "-qm", "fixture"]);

  fs.writeFileSync(path.join(dir, "subject.txt"), "bad\n");
  const body = git(dir, ["diff", "--", "subject.txt"]);
  git(dir, ["checkout", "--", "subject.txt"]);
  assert.match(body, /^--- a\/subject\.txt$/m, "generated fixture diff is empty");

  for (const m of mutants) {
    const suite = m.suiteHeader === undefined ? "# suite: node check.js\n" : m.suiteHeader;
    fs.writeFileSync(
      path.join(dir, "tests", "mutants", `${m.name}.patch`),
      `# kills: ${m.header}\n${suite}${body}`);
  }
  git(dir, ["add", "."]);
  git(dir, ["commit", "-qm", "mutants"]);
  assert.equal(git(dir, ["status", "--porcelain"]).trim(), "", "fixture tree must be clean");
  return dir;
}

function sweep(dir) {
  const r = spawnSync("bash", [path.join(dir, "tests", "mutation_check.sh")], {
    cwd: dir, encoding: "utf8", env: childEnv({ MUTANT_TIMEOUT: "60" }), timeout: 120000,
  });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
}

// A patch with an `e_` name and NO `# suite:` header falls through to the
// filename-prefix table, which points it at the real repo's e2e suite. The
// fixture repo has no tests/helpers/cdp.js, so the script's browser probe
// yields "" and the mutant takes the no-browser skip branch - deterministically,
// whether or not a browser exists on this machine.
const E2E_SKIPPED = { name: "e_fixture_needs_browser", header: "a fixture e2e assertion", suiteHeader: "" };
const KILLABLE = { name: "x_subject_is_ok", header: "subject.txt stays ok" };

test("green baseline: the sweep kills its fixture mutant and passes", (t) => {
  const dir = makeFixture(t, { mutants: [KILLABLE] });
  const { code, out } = sweep(dir);
  assert.match(out, /^x_subject_is_ok\.patch killed/m, out);
  assert.match(out, /1\/1 mutants killed/, out);
  assert.match(out, /MUTATION GATE PASSED/, out);
  assert.equal(code, 0, out);
});

test("red clean-tree baseline aborts the whole sweep with exit 4", (t) => {
  const dir = makeFixture(t, { health: "red", mutants: [KILLABLE] });
  const { code, out } = sweep(dir);
  assert.match(out, /ABORTING - BASELINE NOT GREEN/, out);
  assert.equal(code, 4, out);
});

test("a red baseline manufactures no per-mutant verdict and no pass", (t) => {
  const dir = makeFixture(t, { health: "red", mutants: [KILLABLE] });
  const { out } = sweep(dir);
  // The defect row 187 closed: a clean-tree-red suite recording "killed" for
  // every mutant aimed at it. No result line of ANY kind may be emitted, and
  // the sweep must not reach its summary.
  assert.doesNotMatch(out, /^x_subject_is_ok\.patch (killed|survived|timeout|broken)/m, out);
  assert.doesNotMatch(out, /MUTATION GATE PASSED/, out);
  assert.doesNotMatch(out, /mutants killed/, out);
});

test("the baseline is evaluated even for a built-in prefix command", (t) => {
  // The row-173 defect was that ONLY `# suite:` headers were baselined, so the
  // five built-in prefixes were trusted blind. Here the killable mutant carries
  // a header and a `b_` sibling does not; a red baseline must still abort, and
  // the abort must name the command it actually ran.
  const dir = makeFixture(t, { health: "red", mutants: [KILLABLE] });
  const { code, out } = sweep(dir);
  assert.match(out, /node check\.js/, out);
  assert.equal(code, 4, out);
});

test("a baseline that hangs once is retried, not scored as red", (t) => {
  // Queue rows 191/195. The per-mutant run has always retried a 124/137 once;
  // the baseline did not, so a single slow clean-tree run aborted the whole
  // sweep and threw away every other verdict. A timeout is an absence of
  // evidence, not a red.
  const dir = makeFixture(t, { flaky: "once", mutants: [KILLABLE] });
  const { code, out } = sweep(dir);
  assert.match(out, /baseline hung.*retrying once/, out);
  assert.doesNotMatch(out, /ABORTING - BASELINE NOT GREEN/, out);
  assert.match(out, /MUTATION GATE PASSED/, out);
  assert.equal(code, 0, out);
});

test("a baseline that hangs twice still aborts", (t) => {
  // The retry must not become a way for a suite that never finishes to be
  // treated as green: two timeouts on the clean tree really is unusable.
  const dir = makeFixture(t, { flaky: "always", mutants: [KILLABLE] });
  const { code, out } = sweep(dir);
  assert.match(out, /ABORTING - BASELINE NOT GREEN/, out);
  assert.match(out, /rc 124/, out);
  assert.doesNotMatch(out, /MUTATION GATE PASSED/, out);
  assert.equal(code, 4, out);
});

test("a partial sweep does not print MUTATION GATE PASSED", (t) => {
  // Queue row 193. One mutant is evaluated and killed, one is skipped for want
  // of a browser. Killing 1 of 2 is not a pass.
  const dir = makeFixture(t, { mutants: [KILLABLE, E2E_SKIPPED] });
  const { code, out } = sweep(dir);
  assert.match(out, /^e_fixture_needs_browser\.patch skipped/m, out);
  assert.match(out, /^x_subject_is_ok\.patch killed/m, out);
  assert.doesNotMatch(out, /MUTATION GATE PASSED/, out);
  assert.notEqual(code, 0, out);
});

test("a partial sweep says how many mutants it did not evaluate", (t) => {
  const dir = makeFixture(t, { mutants: [KILLABLE, E2E_SKIPPED] });
  const { out } = sweep(dir);
  assert.match(out, /MUTATION GATE INCOMPLETE/, out);
  assert.match(out, /1 of 2/, out);
});

test("a dirty tree is refused before anything is applied", (t) => {
  const dir = makeFixture(t, { mutants: [KILLABLE] });
  fs.writeFileSync(path.join(dir, "subject.txt"), "hand-edited\n");
  const { code, out } = sweep(dir);
  assert.match(out, /REFUSING/, out);
  assert.equal(code, 2, out);
  // The refusal must never checkout or clean away uncommitted work.
  assert.equal(fs.readFileSync(path.join(dir, "subject.txt"), "utf8"), "hand-edited\n");
});

test("an empty mutant corpus is an error, never a pass", (t) => {
  const dir = makeFixture(t, { mutants: [KILLABLE] });
  fs.rmSync(path.join(dir, "tests", "mutants", "x_subject_is_ok.patch"));
  git(dir, ["commit", "-qam", "empty corpus"]);
  const { code, out } = sweep(dir);
  assert.match(out, /NO MUTANTS FOUND/, out);
  assert.notEqual(code, 0, out);
});

test("the sweep leaves the fixture tree clean", (t) => {
  const dir = makeFixture(t, { mutants: [KILLABLE] });
  sweep(dir);
  assert.equal(git(dir, ["status", "--porcelain"]).trim(), "", "sweep left the tree dirty");
});

test("children are spawned without NODE_TEST_CONTEXT", () => {
  // Guards the harness above against queue row 165: a node child that inherits
  // NODE_TEST_CONTEXT exits 0 instantly, so every negative case here would
  // self-certify. If this assertion is ever true of childEnv(), the fixture
  // suite's exit code stops meaning anything.
  assert.equal(childEnv().NODE_TEST_CONTEXT, undefined);
  assert.equal(childEnv({ MUTANT_TIMEOUT: "60" }).NODE_TEST_CONTEXT, undefined);
  const r = spawnSync(process.execPath,
    ["-e", "process.stdout.write(String(process.env.NODE_TEST_CONTEXT))"],
    { encoding: "utf8", env: childEnv() });
  assert.equal(r.stdout, "undefined");
  assert.equal(r.status, 0);
});
