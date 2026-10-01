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
const SHARD_MODULE = path.join(ROOT, "tests", "shard_mutants.js");
const { partition, isE2ESelecting, loadMutants } = require(SHARD_MODULE);

function childEnv(extra) {
  const env = { ...process.env, ...(extra || {}) };
  // See TRAP above. Also drop E2E_PORT: pinning it is the exact environmental
  // difference that turns the real e2e prefix red (queue rows 162, 173, 174).
  // GIT_DIR/GIT_WORK_TREE/GIT_INDEX_FILE are dropped too (review: the
  // process.env approach leaks between tests) - a child that inherits one of
  // these from an outer `git` invocation runs against the WRONG repo/tree/
  // index, silently, rather than the fixture repo it was given a cwd for.
  delete env.NODE_TEST_CONTEXT;
  delete env.E2E_PORT;
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
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

// A patch whose `# suite:` names tests/e2e.test.js takes the no-browser skip
// branch - the NAME is irrelevant, and E2E_MISNAMED below exists to prove it.
// The fixture repo has no tests/helpers/cdp.js, so the script's browser probe
// yields "" and the mutant is skipped deterministically, whether or not a
// browser exists on this machine. The header is also what makes the patch
// legal at all: a header-less patch is refused outright (see the refusal tests
// below) and would never reach the skip.
const E2E_SKIPPED = {
  name: "e_fixture_needs_browser", header: "a fixture e2e assertion",
  suiteHeader: "# suite: node --test tests/e2e.test.js\n",
};
const KILLABLE = { name: "x_subject_is_ok", header: "subject.txt stays ok" };
// A patch carrying `# kills:` but NO `# suite:` line at all.
const HEADERLESS = {
  name: "d_fixture_has_no_suite_header", header: "some app assertion", suiteHeader: "",
};
// The same e2e mutant under a name that does NOT start with `e_`. The corpus
// convention is a naming habit, not a fact the script can rely on: what makes a
// mutant unevaluable here is the SUITE it names, and a browserless machine runs
// that suite to a self-skip and a 0 exit no matter what the file is called.
// tests/mutants/d_page_background_still_announced.patch was exactly this - an
// e2e mutant carrying a `d_` name - and the sweep reported it as a SURVIVOR,
// which is the one verdict a skipped suite must never produce.
const E2E_MISNAMED = {
  name: "d_fixture_e2e_under_a_d_name", header: "a fixture e2e assertion",
  suiteHeader: "# suite: node --test tests/e2e.test.js\n",
};

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

test("an e2e mutant is skipped for its suite, not for its filename", (t) => {
  // A suite that self-skips exits 0, which is indistinguishable from a suite
  // that ran and passed - so the sweep must recognise it BEFORE judging, and
  // the only reliable signal is the `# suite:` command it was told to run.
  const dir = makeFixture(t, { mutants: [KILLABLE, E2E_MISNAMED] });
  const { code, out } = sweep(dir);
  assert.match(out, /^d_fixture_e2e_under_a_d_name\.patch skipped/m, out);
  assert.doesNotMatch(out, /^d_fixture_e2e_under_a_d_name\.patch survived/m, out);
  assert.doesNotMatch(out, /MUTATION GATE PASSED/, out);
  assert.notEqual(code, 0, out);
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

// Queue row 263. The sweep used to pick a command for a header-less patch off
// its FILENAME PREFIX, and for the node prefixes that command was the whole
// suite - so the verdict rested on the suite's exit code alone and never on the
// test the patch claims to kill. A mutant that broke some unrelated test in the
// same file was recorded "killed" while proving nothing. That is the same class
// of unearned green as a red baseline manufacturing kills (rows 187/173), and
// the fix is the same shape: refuse, loudly, instead of guessing.
test("a patch with no '# suite:' header is refused, never guessed at", (t) => {
  const dir = makeFixture(t, { mutants: [HEADERLESS] });
  const { code, out } = sweep(dir);
  assert.match(out, /^d_fixture_has_no_suite_header\.patch broken/m, out);
  assert.match(out, /# suite:/, out);
  assert.notEqual(code, 0, out);
});

test("a header-less patch cannot be scored as killed", (t) => {
  // The whole point: no verdict of any kind may be manufactured for it, and the
  // sweep must not print a pass over a corpus containing one.
  const dir = makeFixture(t, { mutants: [HEADERLESS] });
  const { out } = sweep(dir);
  assert.doesNotMatch(out, /^d_fixture_has_no_suite_header\.patch killed/m, out);
  assert.doesNotMatch(out, /MUTATION GATE PASSED/, out);
});

test("the refusal is per-patch: well-formed siblings are still evaluated", (t) => {
  // Refusing must not degrade into aborting the sweep - the other mutants still
  // carry evidence, and losing it would push lanes toward not adding the guard.
  const dir = makeFixture(t, { mutants: [HEADERLESS, KILLABLE] });
  const { code, out } = sweep(dir);
  assert.match(out, /^x_subject_is_ok\.patch killed/m, out);
  assert.match(out, /^d_fixture_has_no_suite_header\.patch broken/m, out);
  assert.doesNotMatch(out, /MUTATION GATE PASSED/, out);
  assert.notEqual(code, 0, out);
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

test("childEnv scrubs GIT_DIR/GIT_WORK_TREE/GIT_INDEX_FILE even when passed as extra", () => {
  // Q1 N5: these three must never reach a spawned child, whatever set them -
  // the outer process or the `extra` argument merged in above. A leaked
  // GIT_DIR/GIT_WORK_TREE points a child `git` invocation at the WRONG repo
  // or working tree; GIT_INDEX_FILE points it at the wrong index. None of
  // this test mutates process.env.
  const env = childEnv({ GIT_DIR: "x", GIT_WORK_TREE: "y", GIT_INDEX_FILE: "z" });
  assert.equal(env.GIT_DIR, undefined);
  assert.equal(env.GIT_WORK_TREE, undefined);
  assert.equal(env.GIT_INDEX_FILE, undefined);
});

/* Queue row 86, N9. The row reads "three mutant patches carry stale
 * `index 169aa79..` blob headers"; a per-file check of the preimage blob
 * against `git rev-parse HEAD:<path>` said 250 of 250 did. That is not a
 * corpus that drifted, it is the header being inherently unmaintainable:
 * `git diff` stamps the blob the patch was CUT from, and every commit that
 * touches a mutated file rewrites it, so a freshly re-cut patch is stale one
 * commit later. Re-cutting is therefore not a fix - it moves the lie forward
 * a commit.
 *
 * Nothing reads the line. The sweep applies patches with plain `git apply`
 * (tests/mutation_check.sh:242) and reverts with `git apply -R` (:265) -
 * neither `--3way` nor `--index`, the only two modes that resolve a preimage
 * blob by hash. The mode bits are equally inert: every mutated path already
 * exists and no patch changes a file mode. So the line carries no information
 * the sweep uses and one claim that is false, which is exactly the shape of
 * comment worth deleting rather than maintaining.
 *
 * Asserted rather than merely done, because the generator would put it back:
 * tools/regen_data_mutants.py writes `git diff` output verbatim, so without
 * this test the next data-mutant regeneration silently reintroduces twelve of
 * them. */
test("no mutant patch carries a blob header it cannot keep true", () => {
  const dir = path.join(ROOT, "tests", "mutants");
  const offenders = [];
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".patch"))) {
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    for (const line of text.split("\n")) {
      if (/^index [0-9a-f]{7,40}\.\.[0-9a-f]{7,40}/.test(line)) {
        offenders.push(`${name}: ${line}`);
        break;
      }
    }
  }
  assert.deepStrictEqual(offenders, [],
    `these patches stamp a preimage blob that goes stale on the next commit ` +
    `to the file, and nothing in tests/mutation_check.sh reads it:\n` +
    offenders.slice(0, 5).join("\n") + `\n(${offenders.length} total)`);
});

/* Finding 2 (2026-09-30 quality-refactor plan). tools/regen_data_mutants.py
 * used to write data/decks.json's CANONICAL copy with `ensure_ascii=False`
 * while the committed file (and the DECKS line it writes into index.html)
 * both use the ensure_ascii=True default - a one-flag divergence that turned
 * every `b_*.patch` into 9-10 hunks of unicode-escape noise instead of the
 * one real hunk its mutator makes per touched file. A sync mutant (the
 * common case) touches two files - index.html's DECKS line and
 * data/decks.json - so the patch carries two `diff --git` sections.
 * `b_layout_angle_swap` edits two non-adjacent fields ("4" and "6") within
 * data/decks.json, which sounds like it would need two hunks, but both
 * fields sit well inside `git diff`'s default 3-line context window of each
 * other, so the real corpus has exactly ONE hunk there too (checked
 * directly: every file section in every tracked b_*.patch today has exactly
 * one `@@`) - there is no legitimate multi-hunk case in this corpus, so the
 * bound is 1, not 2. The regenerator is also run directly (not just the
 * static patch corpus) in the second test below, so a future mutator that
 * genuinely needs two separate edits that regen_data_mutants.py renders as
 * two hunks is still free to widen this bound - it is a fact about today's
 * mutators, not a policy ceiling. */
test("every b_*.patch has at most one @@ hunk per touched file (regen_data_mutants.py CANONICAL write matches the committed format)", () => {
  const dir = path.join(ROOT, "tests", "mutants");
  const offenders = [];
  for (const name of fs.readdirSync(dir).filter((f) => f.startsWith("b_") && f.endsWith(".patch"))) {
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    const sections = text.split(/^diff --git /m).slice(1);
    for (const section of sections) {
      const hunks = (section.match(/^@@/gm) || []).length;
      if (hunks > 1) {
        const file = (section.match(/^a\/(\S+)/m) || [, "?"])[1];
        offenders.push(`${name} (${file}): ${hunks} hunks`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [],
    `expected at most one @@ hunk per touched file in each b_*.patch; run ` +
    `\`python3 tools/regen_data_mutants.py\` on a clean tree to regenerate:\n` +
    offenders.join("\n"));
});

/* Same claim, but exercising the TOOL rather than just the checked-in
 * output: regenerate every b_*.patch from a clean worktree copy of this
 * repo and assert the freshly-written patches also carry exactly one hunk
 * per touched file. This is the test that would actually catch the
 * ensure_ascii=False regression above if it ever came back - the static
 * check on the committed corpus only catches a regeneration that was
 * already run and committed; this one catches the tool producing the wrong
 * output BEFORE anyone commits it. Runs in a throwaway worktree (never the
 * real checkout) since regen_data_mutants.py writes index.html and
 * data/decks.json in place. */
test("regenerating every b_*.patch from a clean tree keeps exactly one hunk per touched file", (t) => {
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), "regen-mutants-"));
  t.after(() => {
    execFileSync("git", ["worktree", "remove", "--force", worktree], { cwd: ROOT });
  });
  execFileSync("git", ["worktree", "add", "--detach", worktree, "HEAD"], { cwd: ROOT });
  const result = spawnSync("python3", [path.join(worktree, "tools", "regen_data_mutants.py")],
    { cwd: worktree, encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);

  const dir = path.join(worktree, "tests", "mutants");
  const offenders = [];
  for (const name of fs.readdirSync(dir).filter((f) => f.startsWith("b_") && f.endsWith(".patch"))) {
    const text = fs.readFileSync(path.join(dir, name), "utf8");
    const sections = text.split(/^diff --git /m).slice(1);
    for (const section of sections) {
      const hunks = (section.match(/^@@/gm) || []).length;
      if (hunks > 1) {
        const file = (section.match(/^a\/(\S+)/m) || [, "?"])[1];
        offenders.push(`${name} (${file}): ${hunks} hunks`);
      }
    }
  }
  assert.deepStrictEqual(offenders, [],
    `freshly regenerated b_*.patch files should carry at most one @@ hunk ` +
    `per touched file:\n` + offenders.join("\n"));
});

/* Early warning for the failure mode "a normal commit edits a context line a
 * mutant patch anchors on, and the mutant silently stops applying" - `git
 * apply` on a context mismatch is a hard error, so a stale patch does not
 * survive the mutant, it is never even applied, and tests/mutation_check.sh
 * exits 4 (queue's clean-tree-baseline abort) rather than naming the patch.
 * This test names it directly and fast, without running the sweep.
 *
 * A patch that currently APPLIES CLEANLY IN REVERSE is not necessarily
 * stale - it might be one the mutation gate has already applied to this very
 * tree, uncommitted (this test can run as one of the sweep's own suites,
 * against a tree with exactly one mutant patch already in it). But it might
 * ALSO be stale in a different way: a normal commit folded the patch's own
 * post-image into HEAD (e.g. the change it mutates away from landed for real
 * reasons), in which case the patch's precondition is gone for good, not
 * "already applied for now". `git diff --quiet HEAD -- <paths>` on the
 * patch's own `+++ b/` paths tells the two apart: non-zero (the tree differs
 * from HEAD there) means an uncommitted application, not stale; zero (the
 * tree already matches HEAD) means the post-image is permanent, so the
 * patch is stale.
 *
 * Extracted into staleMutants() so a fixture repo - which cannot reach the
 * real corpus or ROOT - can exercise both branches directly (Q1 N1/N2). */
function stalePatchedPaths(patchText) {
  const paths = [];
  for (const line of patchText.split("\n")) {
    const m = line.match(/^\+\+\+ b\/(.+)$/);
    if (m) paths.push(m[1]);
  }
  return paths;
}

// Finding 12 (2026-09-30 quality-refactor plan), second lint: a patch that
// `git apply --check` accepts today can still be riding a NON-UNIQUE anchor -
// its removed+context block happens to occur more than once in the file it
// targets, and `git apply` only ever checked the hint line, not uniqueness.
// A later refactor that reorders those occurrences can make the patch start
// silently mutating the WRONG occurrence while `git apply --check` keeps
// succeeding - the same ambiguity tools/refresh_mutants.py refuses to guess
// at, applied here as an early-warning lint instead of a refusal, because
// unlike refresh_mutants.py this path has no rewrite to perform. Same
// section/hunk parsing as tools/refresh_mutants.py's splitSections/hunksOf,
// kept independent (this file owns no shared module with that tool).
function splitSections(body) {
  if (!body.trim()) return [];
  const pieces = body.split(/(?=^diff --git )/m).filter((p) => p.trim());
  return pieces.map((text) => {
    const m = text.match(/^\+\+\+ b\/(.+)$/m);
    return { file: m ? m[1] : null, text };
  });
}

function hunksOf(sectionText) {
  const hunks = [];
  let old = null;
  const lines = sectionText.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  for (const line of lines) {
    if (line.startsWith("@@")) {
      if (old !== null) hunks.push(old);
      old = [];
    } else if (old === null) {
      continue;
    } else if (line === "" || line.startsWith(" ") || line.startsWith("-")) {
      old.push(line.slice(1));
    }
  }
  if (old !== null) hunks.push(old);
  return hunks;
}

function findAllOccurrences(haystack, needle) {
  if (!needle.length) return [];
  const hits = [];
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) { ok = false; break; }
    }
    if (ok) hits.push(i);
  }
  return hits;
}

function hasNonUniqueAnchor(root, patchText) {
  const headerEnd = patchText.split("\n").findIndex((l) => !l.startsWith("#"));
  const body = patchText.split("\n").slice(headerEnd < 0 ? 0 : headerEnd).join("\n");
  for (const { file, text } of splitSections(body)) {
    if (!file) continue;
    let current;
    try {
      current = fs.readFileSync(path.join(root, file), "utf8").split("\n");
    } catch {
      continue; // file doesn't exist here (e.g. a fixture section) - skip
    }
    if (current[current.length - 1] === "") current.pop();
    for (const old of hunksOf(text)) {
      if (findAllOccurrences(current, old).length > 1) return true;
    }
  }
  return false;
}

function staleMutants(root, mutantsDir) {
  const names = fs.readdirSync(mutantsDir).filter((f) => f.endsWith(".patch")).sort();
  const stale = [];
  for (const name of names) {
    const p = path.join(mutantsDir, name);
    try {
      execFileSync("git", ["apply", "--check", p], { cwd: root, env: childEnv() });
      // Applies forward cleanly: definitely not stale.
    } catch {
      try {
        execFileSync("git", ["apply", "--check", "-R", p], { cwd: root, env: childEnv() });
        // Applies cleanly in reverse: something already turned this patch's
        // pre-image into its post-image. See which, above.
        const paths = stalePatchedPaths(fs.readFileSync(p, "utf8"));
        let matchesHead = true;
        if (paths.length) {
          try {
            execFileSync("git", ["diff", "--quiet", "HEAD", "--", ...paths],
              { cwd: root, env: childEnv() });
            matchesHead = true; // exit 0: tree already matches HEAD there
          } catch {
            matchesHead = false; // exit 1: tree differs from HEAD (uncommitted apply)
          }
        }
        if (matchesHead) stale.push(name);
      } catch {
        // Neither direction applies: a genuinely stale (or malformed) patch.
        stale.push(name);
      }
    }
  }
  return stale;
}

// A separate wrapper, not a change to staleMutants() itself: this file's own
// mh_reverse_apply_skip_dropped.patch targets staleMutants()'s body verbatim
// (it deletes the -R fallback branch), so editing that function's lines would
// stale a mutant outside this lane's ownership (mh_* patch BODIES are never
// touched, per the quality-refactor plan's ownership table). The Finding 12
// non-unique-anchor lint is therefore layered on top, as its own pass over
// the patches staleMutants() already called live.
function staleOrNonUniqueMutants(root, mutantsDir) {
  const stale = staleMutants(root, mutantsDir);
  const names = fs.readdirSync(mutantsDir).filter((f) => f.endsWith(".patch")).sort();
  const result = new Set(stale);
  for (const name of names) {
    if (result.has(name)) continue;
    const p = path.join(mutantsDir, name);
    if (hasNonUniqueAnchor(root, fs.readFileSync(p, "utf8"))) result.add(name);
  }
  return names.filter((n) => result.has(n));
}

// Fixture repo for staleMutants(): one committed file, one patch generated by
// diffing a "bad" edit against it (same discipline as makeFixture above),
// checked back out before commit so the patch's pre-image is real.
function makeStaleFixtureRepo(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stalemutants-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "tests", "mutants"), { recursive: true });
  fs.writeFileSync(path.join(dir, "subject.txt"), "ok\n");
  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "fixture@example.invalid"]);
  git(dir, ["config", "user.name", "Fixture"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  git(dir, ["add", "."]);
  git(dir, ["commit", "-qm", "fixture"]);

  fs.writeFileSync(path.join(dir, "subject.txt"), "bad\n");
  const body = git(dir, ["diff", "--", "subject.txt"]);
  git(dir, ["checkout", "--", "subject.txt"]);
  const patchName = "x_subject_is_bad.patch";
  const patchPath = path.join(dir, "tests", "mutants", patchName);
  fs.writeFileSync(patchPath, `# kills: subject\n# suite: node check.js\n${body}`);
  return { dir, mutantsDir: path.join(dir, "tests", "mutants"), patchPath, patchName };
}

test("a patch applied to the working tree but uncommitted is NOT reported stale", (t) => {
  // Pins the -R reverse-apply guard: it must fail if that branch is deleted,
  // since without it every patch here would (wrongly) hit the outer catch
  // and be reported stale. Passes today, before the HEAD-diff fix.
  const { dir, mutantsDir, patchPath, patchName } = makeStaleFixtureRepo(t);
  execFileSync("git", ["apply", patchPath], { cwd: dir, env: childEnv() });
  const stale = staleMutants(dir, mutantsDir);
  assert.deepStrictEqual(stale, [], `${patchName} should not be reported stale`);
});

test("the same post-image committed to HEAD IS reported stale", (t) => {
  // Fails today (the old logic treats any reverse-appliable patch as "already
  // applied, not stale") and passes once the new `git diff --quiet HEAD`
  // check distinguishes a committed post-image from an uncommitted one.
  const { dir, mutantsDir, patchPath, patchName } = makeStaleFixtureRepo(t);
  execFileSync("git", ["apply", patchPath], { cwd: dir, env: childEnv() });
  git(dir, ["add", "."]);
  git(dir, ["commit", "-qm", "the mutant's post-image landed for real"]);
  const stale = staleMutants(dir, mutantsDir);
  assert.deepStrictEqual(stale, [patchName]);
});

/* Finding 3 (2026-09-30 quality-refactor plan). tools/refresh_mutants.py
 * re-anchors a stale patch by finding its removed-line block elsewhere in the
 * current file content, rather than requiring a human to hand-edit the diff.
 * Three fixture repos below exercise its three outcomes: a patch whose
 * context merely shifted gets re-anchored and still carries the same
 * intent; a patch whose anchor is genuinely ambiguous (occurs twice) is
 * refused rather than guessed at; a patch that already applies is left
 * byte-identical (a true no-op, not "regenerated to the same bytes"). */
const REFRESH_SCRIPT = path.join(ROOT, "tools", "refresh_mutants.py");

function runRefresh(dir, args) {
  return spawnSync("python3", [REFRESH_SCRIPT, ...(args || [])],
    { cwd: dir, encoding: "utf8", env: childEnv({ REFRESH_MUTANTS_ROOT: dir }) });
}

function makeRefreshFixtureRepo(t, { preimage, postimage, finalContent, kills, suite }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "refreshmutants-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "tests", "mutants"), { recursive: true });
  // tools/refresh_mutants.py resolves its own ROOT as its parent's parent -
  // mirror that layout so the fixture's `tools/` dir plays the role of ROOT.
  fs.mkdirSync(path.join(dir, "tools"), { recursive: true });
  fs.writeFileSync(path.join(dir, "subject.txt"), preimage);
  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "fixture@example.invalid"]);
  git(dir, ["config", "user.name", "Fixture"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  git(dir, ["add", "."]);
  git(dir, ["commit", "-qm", "fixture"]);

  // Build the mutant patch against `preimage`, as a real author would.
  fs.writeFileSync(path.join(dir, "subject.txt"), postimage);
  const body = git(dir, ["diff", "--", "subject.txt"]);
  git(dir, ["checkout", "--", "subject.txt"]);

  // Now drift the committed file (simulating an unrelated later commit),
  // so the patch's context no longer matches - unless finalContent is left
  // equal to preimage, in which case the patch stays fresh (no commit needed).
  if (finalContent !== preimage) {
    fs.writeFileSync(path.join(dir, "subject.txt"), finalContent);
    git(dir, ["add", "."]);
    git(dir, ["commit", "-qm", "unrelated drift"]);
  }

  const patchName = "x_subject_is_bad.patch";
  const patchPath = path.join(dir, "tests", "mutants", patchName);
  fs.writeFileSync(patchPath, `# kills: ${kills}\n# suite: ${suite}\n${body}`);
  return { dir, patchPath, patchName };
}

test("refresh_mutants.py leaves an already-applying patch byte-identical", (t) => {
  const preimage = "one\ntwo\nthree\n";
  const postimage = "one\nTWO\nthree\n";
  const { dir, patchPath } = makeRefreshFixtureRepo(t, {
    preimage, postimage, finalContent: preimage,
    kills: "subject", suite: "node check.js",
  });
  const before = fs.readFileSync(patchPath, "utf8");
  const result = runRefresh(dir, []);
  assert.strictEqual(result.status, 0, result.stderr);
  const after = fs.readFileSync(patchPath, "utf8");
  assert.strictEqual(after, before, "a fresh patch must not be rewritten");
});

test("refresh_mutants.py re-anchors a patch whose context drifted", (t) => {
  const preimage = "alpha\nbeta\ngamma\ndelta\n";
  const postimage = "alpha\nBETA\ngamma\ndelta\n";
  // Unrelated drift: a line inserted well before the mutated line shifts
  // every context line's position without touching the mutated text itself.
  const finalContent = "zero\nalpha\nbeta\ngamma\ndelta\n";
  const { dir, patchPath, patchName } = makeRefreshFixtureRepo(t, {
    preimage, postimage, finalContent,
    kills: "subject", suite: "node check.js",
  });
  const check = spawnSync("git", ["apply", "--check", patchPath],
    { cwd: dir, encoding: "utf8", env: childEnv() });
  assert.notStrictEqual(check.status, 0, "fixture setup: patch must be stale before refresh");

  const result = runRefresh(dir, []);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, new RegExp(patchName.replace(/\./g, "\\.")));

  const applied = spawnSync("git", ["apply", "--check", patchPath],
    { cwd: dir, encoding: "utf8", env: childEnv() });
  assert.strictEqual(applied.status, 0, `${patchName} should apply cleanly after refresh:\n${applied.stderr}`);

  git(dir, ["apply", patchPath]);
  assert.strictEqual(fs.readFileSync(path.join(dir, "subject.txt"), "utf8"),
    "zero\nalpha\nBETA\ngamma\ndelta\n");
});

/* P1 (coordinator FAIL, 2026-09-30 quality-refactor plan review of PR #179,
 * attempt 1). The test above only shifts a hunk's line NUMBERS, by
 * prepending an unrelated line before the whole block - every context
 * line's own CONTENT is untouched, so it never exercised the actual bug:
 * the old splice() anchored on the full context+removed block as one
 * contiguous run, so a CONTEXT line's content changing (not just its line
 * number) made the whole anchor fail to match, even though the removed/added
 * lines the mutant actually targets were never touched. Repro that shipped
 * with the FAIL verdict: tests/mutants/sw_tilt_unclamped.patch's hunk ends
 * with the trailing context line `let drag = null, flight = null, eatClick
 * = false;` - appending a comment to THAT line (never touched by the mutant
 * itself) made refresh_mutants.py print `UNFIXABLE "not a context-drift
 * case"`. This fixture reproduces the same shape generically: `beta` is a
 * context line adjacent to the mutated line `gamma`, and only `beta`'s own
 * text changes - `gamma`/`GAMMA` are never touched by the drift. */
test("refresh_mutants.py re-anchors a patch whose CONTEXT LINE CONTENT changed mid-file", (t) => {
  const preimage = "alpha\nbeta\ngamma\ndelta\nepsilon\n";
  const postimage = "alpha\nbeta\nGAMMA\ndelta\nepsilon\n";
  // Unrelated drift: a context line adjacent to the mutated line has its own
  // TEXT changed (not just shifted) - the old whole-block anchor breaks here
  // even though "gamma" itself is untouched.
  const finalContent = "alpha\nBETA2\ngamma\ndelta\nepsilon\n";
  const { dir, patchPath, patchName } = makeRefreshFixtureRepo(t, {
    preimage, postimage, finalContent,
    kills: "subject", suite: "node check.js",
  });
  const check = spawnSync("git", ["apply", "--check", patchPath],
    { cwd: dir, encoding: "utf8", env: childEnv() });
  assert.notStrictEqual(check.status, 0, "fixture setup: patch must be stale before refresh");

  const result = runRefresh(dir, []);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, new RegExp(patchName.replace(/\./g, "\\.")));

  const applied = spawnSync("git", ["apply", "--check", patchPath],
    { cwd: dir, encoding: "utf8", env: childEnv() });
  assert.strictEqual(applied.status, 0, `${patchName} should apply cleanly after refresh:\n${applied.stderr}`);

  git(dir, ["apply", patchPath]);
  assert.strictEqual(fs.readFileSync(path.join(dir, "subject.txt"), "utf8"),
    "alpha\nBETA2\nGAMMA\ndelta\nepsilon\n");
});

/* Attempt-2 FAIL (PR #179 re-review). git writes an empty context line as
 * " ", but an editor that strips trailing whitespace leaves "" - and
 * `git apply` accepts both. 20 committed patches carry the bare form;
 * parse_chunks() used to loop forever on it instead of treating it as
 * blank context. */
test("refresh_mutants.py re-anchors a stale patch with a bare blank context line", (t) => {
  const preimage = "alpha\n\ngamma\ndelta\nepsilon\n";
  const postimage = "alpha\n\nGAMMA\ndelta\nepsilon\n";
  const finalContent = "alpha\n\ngamma\nDELTA2\nepsilon\n";
  const { dir, patchPath, patchName } = makeRefreshFixtureRepo(t, {
    preimage, postimage, finalContent,
    kills: "subject", suite: "node check.js",
  });
  const raw = fs.readFileSync(patchPath, "utf8");
  const bare = raw.replace(/^ $/m, "");
  assert.notStrictEqual(bare, raw, "fixture setup: patch must carry a blank context line");
  fs.writeFileSync(patchPath, bare);

  const result = spawnSync("python3", [REFRESH_SCRIPT],
    { cwd: dir, encoding: "utf8", timeout: 20000, env: childEnv({ REFRESH_MUTANTS_ROOT: dir }) });
  assert.strictEqual(result.signal, null, "refresh_mutants.py must terminate");
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, new RegExp(patchName.replace(/\./g, "\\.")));

  git(dir, ["apply", patchPath]);
  assert.strictEqual(fs.readFileSync(path.join(dir, "subject.txt"), "utf8"),
    "alpha\n\nGAMMA\nDELTA2\nepsilon\n");
});

/* P1b (same FAIL verdict as above). refresh_one() used to write `git diff`'s
 * output verbatim, including the `index <preimage>..<postimage>` blob-header
 * line - exactly what "no mutant patch carries a blob header it cannot keep
 * true" (above) forbids, since that hash goes stale on the very next commit
 * to the file. tools/regen_data_mutants.py already strips this line the same
 * way; refresh_mutants.py must too. */
test("refresh_mutants.py never writes a blob-header line into a refreshed patch", (t) => {
  const preimage = "alpha\nbeta\ngamma\ndelta\nepsilon\n";
  const postimage = "alpha\nbeta\nGAMMA\ndelta\nepsilon\n";
  const finalContent = "alpha\nBETA2\ngamma\ndelta\nepsilon\n";
  const { dir, patchPath } = makeRefreshFixtureRepo(t, {
    preimage, postimage, finalContent,
    kills: "subject", suite: "node check.js",
  });
  const result = runRefresh(dir, []);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  const after = fs.readFileSync(patchPath, "utf8");
  assert.doesNotMatch(after, /^index [0-9a-f]{7,40}\.\.[0-9a-f]{7,40}/m,
    "refreshed patch must not carry a blob-header line");
});

/* Nit 3 (same review). tools/regen_data_mutants.py already refuses to run on
 * a dirty tree for the files it touches (`REFUSING: tracked files already
 * modified`) - refresh_mutants.py splices against a file's CURRENT content,
 * `git diff`s it, then `git checkout --`s it back, so an uncommitted edit to
 * a target file would silently be baked into the freshly-written patch body
 * rather than left alone. Must refuse the same way. */
test("refresh_mutants.py refuses to run (non-check mode) on a dirty target file", (t) => {
  const preimage = "alpha\nbeta\ngamma\ndelta\n";
  const postimage = "alpha\nBETA\ngamma\ndelta\n";
  const { dir, patchPath } = makeRefreshFixtureRepo(t, {
    preimage, postimage, finalContent: preimage,
    kills: "subject", suite: "node check.js",
  });
  const before = fs.readFileSync(patchPath, "utf8");
  // An uncommitted edit to the very file the patch targets.
  fs.appendFileSync(path.join(dir, "subject.txt"), "uncommitted\n");

  const result = runRefresh(dir, []);
  assert.notStrictEqual(result.status, 0, "a dirty target file must not be silently refreshed");
  assert.match(result.stderr, /REFUSING/, result.stderr);
  assert.strictEqual(fs.readFileSync(patchPath, "utf8"), before,
    "a refused run must leave the patch untouched");
  assert.strictEqual(fs.readFileSync(path.join(dir, "subject.txt"), "utf8"),
    preimage + "uncommitted\n", "a refused run must not touch the dirty file either");
});

test("refresh_mutants.py --check tolerates a dirty target file", (t) => {
  const preimage = "alpha\nbeta\ngamma\ndelta\n";
  const postimage = "alpha\nBETA\ngamma\ndelta\n";
  const { dir } = makeRefreshFixtureRepo(t, {
    preimage, postimage, finalContent: preimage,
    kills: "subject", suite: "node check.js",
  });
  fs.appendFileSync(path.join(dir, "subject.txt"), "uncommitted\n");
  const result = runRefresh(dir, ["--check"]);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
});

test("refresh_mutants.py refuses an ambiguous anchor rather than guessing", (t) => {
  const preimage = "alpha\nbeta\ngamma\n";
  const postimage = "alpha\nBETA\ngamma\n";
  // Unrelated drift that (a) pushes the block far enough down the file that
  // `git apply`'s own line-number hint no longer finds it (so the patch is
  // reported stale, not silently applied in the wrong place) and (b)
  // duplicates the exact pre-image block, so re-anchoring by content alone
  // is no longer unique either.
  const padding = Array.from({ length: 10 }, (_, i) => `pad${i}`).join("\n") + "\n";
  const finalContent = padding + "alpha\nbeta\ngamma\n" + "alpha\nbeta\ngamma\n";
  const { dir, patchPath, patchName } = makeRefreshFixtureRepo(t, {
    preimage, postimage, finalContent,
    kills: "subject", suite: "node check.js",
  });
  const before = fs.readFileSync(patchPath, "utf8");
  const result = runRefresh(dir, []);
  assert.notStrictEqual(result.status, 0, "an ambiguous anchor must not exit 0");
  assert.match(result.stderr, /AMBIGUOUS/);
  assert.match(result.stderr, new RegExp(patchName.replace(/\./g, "\\.")));
  assert.strictEqual(fs.readFileSync(patchPath, "utf8"), before,
    "a refused patch must be left untouched");
});

test("a patch whose anchor became non-unique IS reported stale, even though it still applies", (t) => {
  // Fails before the hasNonUniqueAnchor() extension (git apply --check alone
  // sees the hinted lines still match at their original position and calls
  // it live); passes once staleMutants also rejects a precondition that
  // would equally match a second place in the file - the exact gap
  // Finding 12 names.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stalemutants2-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const mutantsDir = path.join(dir, "tests", "mutants");
  fs.mkdirSync(mutantsDir, { recursive: true });
  fs.writeFileSync(path.join(dir, "subject.txt"), "ok\nkeep\n");
  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "fixture@example.invalid"]);
  git(dir, ["config", "user.name", "Fixture"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
  git(dir, ["add", "."]);
  git(dir, ["commit", "-qm", "fixture"]);

  fs.writeFileSync(path.join(dir, "subject.txt"), "bad\nkeep\n");
  const body = git(dir, ["diff", "--", "subject.txt"]);
  git(dir, ["checkout", "--", "subject.txt"]);
  const patchName = "x_subject_is_bad.patch";
  const patchPath = path.join(mutantsDir, patchName);
  fs.writeFileSync(patchPath, `# kills: subject\n# suite: node check.js\n${body}`);

  // Simulate a later, unrelated refactor duplicating subject.txt's content
  // right after itself - the patch's hint (line 1) still matches here, so
  // `git apply --check` keeps succeeding, but "ok\nkeep" now occurs twice.
  fs.appendFileSync(path.join(dir, "subject.txt"), "ok\nkeep\n");
  git(dir, ["add", "."]);
  git(dir, ["commit", "-qm", "unrelated duplication"]);

  execFileSync("git", ["apply", "--check", patchPath], { cwd: dir, env: childEnv() }); // fixture sanity: still applies
  const stale = staleOrNonUniqueMutants(dir, mutantsDir);
  assert.deepStrictEqual(stale, [patchName],
    `${patchName} rides a non-unique anchor and must be reported stale`);
});

// Known, tracked exception to the anchor-uniqueness lint below: a patch
// whose precondition (context + removed lines) matches more than one
// location in the file it targets today - a real Finding 12 gap - but whose
// fix requires editing the BODY of a tests/mutants/h_* patch against
// tests/mutation_check.sh, which is outside lane M's ownership (see
// docs/plans/2026-09-30-quality-refactor.md's ownership table: lane M owns
// only `# kills:`/`# suite:` header lines on those patches, never their
// bodies). Listed explicitly, never silently dropped, so this lint still
// catches any OTHER patch drifting into ambiguity while leaving this one for
// whichever lane owns tests/mutation_check.sh's mutants to re-anchor.
const KNOWN_NON_UNIQUE_ANCHORS = [
  "f_fixture_sha.patch",
];

test("no mutant patch outside the tracked exceptions rides a non-unique anchor", () => {
  const dir = path.join(ROOT, "tests", "mutants");
  const stale = staleOrNonUniqueMutants(ROOT, dir);
  const unexpected = stale.filter((n) => !KNOWN_NON_UNIQUE_ANCHORS.includes(n));
  assert.deepStrictEqual(unexpected, [],
    `these mutant patches' preconditions (context + removed lines) now match ` +
    `more than one place in the file they target - a future refactor could ` +
    `silently mutate the wrong occurrence while \`git apply --check\` keeps ` +
    `succeeding:\n` + unexpected.join("\n"));
  const nowFixed = KNOWN_NON_UNIQUE_ANCHORS.filter((n) => !stale.includes(n));
  assert.deepStrictEqual(nowFixed, [],
    `${nowFixed.join(", ")} no longer rides a non-unique anchor - remove it ` +
    `from KNOWN_NON_UNIQUE_ANCHORS`);
});

test("every mutant patch applies to the tree it will run against", () => {
  let hasGit = true;
  try {
    execFileSync("git", ["--version"], { cwd: ROOT, env: childEnv() });
  } catch {
    hasGit = false;
  }
  if (!hasGit) {
    assert.ok(!process.env.CI, "git must be present in CI");
    return;
  }

  const dir = path.join(ROOT, "tests", "mutants");
  const stale = staleMutants(ROOT, dir);
  assert.deepStrictEqual(stale, [],
    `these mutant patches no longer apply to the tree they will run against ` +
    `- a later commit edited a context line one of them anchors on:\n` +
    stale.join("\n") +
    `\nregenerate: apply by hand, edit, \`git diff > patch\`, keep the header`);
});

// --- Finding 12 (a): every pattern-based `# suite:` command must select
// exactly the test its `# kills:` line names. -----------------------------
//
// Scope: only a suite command that SELECTS a test via a pattern - python's
// `unittest -k` (substring, or fnmatch when the pattern holds a wildcard),
// or node's `--test-name-pattern` (a regex) - can silently select zero
// tests, or a different test than the header claims; that mismatch is the
// real risk. A direct invocation (python's `module.Class.method` form, or a
// suite that is not a test runner at all, e.g. `node tools/boot_sim.js`)
// names its target unambiguously and is skipped - this repo's own patches
// already rely on that: several direct-invocation `# kills:` lines are
// prose, or a test name plus a trailing explanation, never a literal match.
const JS_TEST_CALL_RE = /(?:^|[^.\w])(?:test|it)\(\s*(["'`])((?:\\.|(?!\1)[\s\S])*)\1/gm;
const PY_TEST_DEF_RE = /def (test_\w+)\s*\(/g;

function jsTestNames(file) {
  const text = fs.readFileSync(file, "utf8");
  const literal = new Set();
  const templates = [];
  let m;
  JS_TEST_CALL_RE.lastIndex = 0;
  while ((m = JS_TEST_CALL_RE.exec(text))) {
    const quote = m[1];
    const raw = m[2].replace(/\\(.)/g, "$1");
    if (quote === "`" && /\$\{/.test(raw)) {
      // A template-literal name built inside a loop over cases (e.g.
      // `` `${code} shows the engine's own sentence...` ``): the exact
      // instantiated text cannot be enumerated statically, so this becomes a
      // regex instead - escape the fixed segments, wildcard each `${...}` -
      // that one specific instantiation can be tested against below.
      const pattern = raw
        .split(/\$\{[^}]*\}/)
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*");
      templates.push(new RegExp("^" + pattern + "$"));
    } else {
      literal.add(raw);
    }
  }
  return { literal, templates };
}

function pyTestNames(root, mod) {
  const file = path.join(root, mod.replace(/\./g, "/") + ".py");
  const names = new Set();
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return names;
  }
  let m;
  PY_TEST_DEF_RE.lastIndex = 0;
  while ((m = PY_TEST_DEF_RE.exec(text))) names.add(m[1]);
  return names;
}

function fnmatchToRegex(pattern) {
  let re = "";
  for (const c of pattern) {
    if (c === "*") re += ".*";
    else if (c === "?") re += ".";
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + re + "$");
}

// Resolve the set of test names a patch's `# suite:` command actually
// selects, or null if the command is out of this lint's scope.
function resolveSelection(root, suite, kills) {
  const words = suite.trim().split(/\s+/);
  if (words.includes("unittest")) {
    const ki = words.indexOf("-k");
    if (ki === -1) return null; // direct invocation: unambiguous, out of scope
    const pattern = words[ki + 1];
    const mods = words.slice(ki + 2).filter((w) => w.startsWith("tests."));
    const discovered = new Set();
    for (const mod of mods) for (const n of pyTestNames(root, mod)) discovered.add(n);
    const re = /[*?[]/.test(pattern) ? fnmatchToRegex(pattern) : null;
    return [...discovered].filter((n) => (re ? re.test(n) : n.includes(pattern)));
  }
  if (suite.includes("--test-name-pattern")) {
    const idx = words.findIndex((w) => w === "--test-name-pattern" || w.startsWith("--test-name-pattern="));
    const pattern = words[idx].includes("=")
      ? words[idx].split("=").slice(1).join("=")
      : words[idx + 1];
    const jsFiles = words.filter((w) => w.endsWith(".test.js"));
    let re;
    try {
      re = new RegExp(pattern);
    } catch {
      return [];
    }
    const literal = new Set();
    const templates = [];
    for (const f of jsFiles) {
      const found = jsTestNames(path.join(root, f));
      for (const n of found.literal) literal.add(n);
      templates.push(...found.templates);
    }
    const selected = [...literal].filter((n) => re.test(n));
    if (selected.length === 0 && re.test(kills) && templates.some((t) => t.test(kills))) {
      // A template-literal-parameterized test: its exact instantiated name
      // cannot be enumerated statically, but the kills text names one
      // specific instantiation, the suite pattern selects exactly that
      // text, and the text has the parameterized test's own shape - as
      // close to "selected" as static analysis gets without running the
      // file's own loop.
      return [kills];
    }
    return selected;
  }
  return null; // not a recognized pattern-based test-runner command
}

function headerLintViolations(root, mutantsDir) {
  const names = fs.readdirSync(mutantsDir).filter((f) => f.endsWith(".patch")).sort();
  const violations = [];
  for (const name of names) {
    const text = fs.readFileSync(path.join(mutantsDir, name), "utf8");
    const killsM = text.match(/^# kills: (.*)$/m);
    const suiteM = text.match(/^# suite: (.*)$/m);
    if (!killsM || !suiteM) continue;
    const kills = killsM[1];
    const suite = suiteM[1];
    const selected = resolveSelection(root, suite, kills);
    if (selected === null) continue; // out of lint scope
    if (!(selected.length === 1 && selected[0] === kills)) {
      violations.push({ name, kills, suite, selected });
    }
  }
  return violations;
}

function writeFixturePatch(mutantsDir, name, kills, suite) {
  fs.mkdirSync(mutantsDir, { recursive: true });
  fs.writeFileSync(
    path.join(mutantsDir, name),
    `# kills: ${kills}\n# suite: ${suite}\ndiff --git a/x b/x\n`
  );
}

test("a -k pattern that selects a different test than # kills: names is flagged", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "headerlint-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "tests", "test_thing.py"),
    "def test_alpha(self):\n    pass\n\ndef test_beta(self):\n    pass\n"
  );
  const mutantsDir = path.join(dir, "tests", "mutants");
  writeFixturePatch(mutantsDir, "x_wrong.patch", "a prose description of alpha",
    "python3 -m unittest -k test_alpha tests.test_thing");
  const violations = headerLintViolations(dir, mutantsDir);
  assert.deepStrictEqual(violations.map((v) => v.name), ["x_wrong.patch"]);
  assert.deepStrictEqual(violations[0].selected, ["test_alpha"]);
});

test("a -k pattern naming the literal selected test is not flagged", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "headerlint-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
  fs.writeFileSync(path.join(dir, "tests", "test_thing.py"), "def test_alpha(self):\n    pass\n");
  const mutantsDir = path.join(dir, "tests", "mutants");
  writeFixturePatch(mutantsDir, "x_right.patch", "test_alpha",
    "python3 -m unittest -k test_alpha tests.test_thing");
  assert.deepStrictEqual(headerLintViolations(dir, mutantsDir), []);
});

test("a --test-name-pattern that selects nothing is flagged", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "headerlint-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
  fs.writeFileSync(path.join(dir, "tests", "x.test.js"), "test('alpha', () => {});\n");
  const mutantsDir = path.join(dir, "tests", "mutants");
  writeFixturePatch(mutantsDir, "x_missing.patch", "beta",
    "node --test --test-name-pattern ^beta$ tests/x.test.js");
  const violations = headerLintViolations(dir, mutantsDir);
  assert.deepStrictEqual(violations.map((v) => v.name), ["x_missing.patch"]);
  assert.deepStrictEqual(violations[0].selected, []);
});

test("a template-literal-parameterized test name whose kills line names the instantiation is not flagged", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "headerlint-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "tests", "x.test.js"),
    "for (const code of ['NO_DING', 'BAD_NOTE']) {\n" +
      "  test(`${code} shows the engine's own sentence`, () => {});\n" +
      "}\n"
  );
  const mutantsDir = path.join(dir, "tests", "mutants");
  writeFixturePatch(mutantsDir, "x_template.patch", "NO_DING shows the engine's own sentence",
    "node --test --test-name-pattern ^NO_DING.shows.the.engine.s.own.sentence$ tests/x.test.js");
  assert.deepStrictEqual(headerLintViolations(dir, mutantsDir), []);
});

test("a direct python unittest invocation (no -k) is out of this lint's scope", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "headerlint-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, "tests"), { recursive: true });
  const mutantsDir = path.join(dir, "tests", "mutants");
  writeFixturePatch(mutantsDir, "x_direct.patch", "some prose that is not the method name",
    "python3 -m unittest tests.test_thing.SomeCase.test_alpha");
  assert.deepStrictEqual(headerLintViolations(dir, mutantsDir), []);
});

test("every mutant patch's # kills: line is actually selected by its # suite: command", () => {
  const dir = path.join(ROOT, "tests", "mutants");
  const violations = headerLintViolations(ROOT, dir);
  assert.deepStrictEqual(violations, [],
    `these mutant patches' # kills: line is not what their # suite: command ` +
    `selects (header-only fix: correct # kills:, demote the old text to a ` +
    `plain comment beneath it):\n` +
    violations.map((v) => `${v.name}: kills=${JSON.stringify(v.kills)} ` +
      `selected=${JSON.stringify(v.selected)}`).join("\n"));
});

// --- Finding 4 (2026-09-30 quality refactor): MUTANT_SHARD -------------------
//
// The mutation gate is the CI critical path (~14.5 min). tests/shard_mutants.js
// partitions the real corpus into N shards that mutation_check.sh runs as a
// CI matrix; these tests pin the partition itself (pure, no shell) and then
// drive MUTANT_SHARD through the real script once to prove the env var wiring
// actually restricts what a sweep evaluates.

test("the N=4 shard partition over the real corpus is disjoint and complete", () => {
  const entries = loadMutants(path.join(ROOT, "tests", "mutants"));
  const shards = partition(entries, 4);
  const seen = new Set();
  for (const shard of shards) {
    for (const name of shard) {
      assert.ok(!seen.has(name), `${name} was dealt into more than one shard`);
      seen.add(name);
    }
  }
  const allNames = new Set(entries.map((e) => e.name));
  assert.deepStrictEqual(seen, allNames,
    "the union of all 4 shards must equal every mutant in the corpus, exactly once");
});

test("the N=4 shard partition balances e2e-selecting mutants within 1 per shard", () => {
  // 161 of 477 mutants select tests/e2e.test.js (by the suite COMMAND, not a
  // filename substring) and cluster under the e_/sw_ name prefixes - a flat
  // index%N would leave one shard carrying most of the slow e2e suite.
  const entries = loadMutants(path.join(ROOT, "tests", "mutants"));
  const shards = partition(entries, 4);
  const byName = new Map(entries.map((e) => [e.name, e]));
  const e2eCounts = shards.map(
    (shard) => shard.filter((name) => isE2ESelecting(byName.get(name).text)).length);
  const spread = Math.max(...e2eCounts) - Math.min(...e2eCounts);
  assert.ok(spread <= 1,
    `e2e-selecting mutants per shard differ by more than 1: ${e2eCounts.join(", ")}`);
});

test("the shard partition does not depend on input order", () => {
  const entries = loadMutants(path.join(ROOT, "tests", "mutants"));
  const reversed = [...entries].reverse();
  assert.deepStrictEqual(partition(entries, 4), partition(reversed, 4),
    "partition sorts by name itself - it must not trust the caller's order");
});

function sweepSharded(dir, shardSpec, reportPath) {
  const r = spawnSync("bash", [path.join(dir, "tests", "mutation_check.sh")], {
    cwd: dir, encoding: "utf8",
    env: childEnv({ MUTANT_TIMEOUT: "60", MUTANT_SHARD: shardSpec, MUTANT_REPORT: reportPath }),
    timeout: 120000,
  });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
}

test("MUTANT_SHARD restricts a real sweep to its own partition, and the two shards together cover the fixture corpus", (t) => {
  const KILLABLE2 = { name: "z_subject_is_ok_too", header: "subject.txt stays ok (second)" };
  const dir = makeFixture(t, { mutants: [KILLABLE, KILLABLE2] });
  fs.copyFileSync(SHARD_MODULE, path.join(dir, "tests", "shard_mutants.js"));
  const report1 = path.join(dir, "shard1.txt");
  const report2 = path.join(dir, "shard2.txt");

  const r1 = sweepSharded(dir, "1/2", report1);
  const r2 = sweepSharded(dir, "2/2", report2);

  assert.equal(r1.code, 0, r1.out);
  assert.equal(r2.code, 0, r2.out);

  const names1 = fs.readFileSync(report1, "utf8").trim().split("\n").filter(Boolean);
  const names2 = fs.readFileSync(report2, "utf8").trim().split("\n").filter(Boolean);
  assert.equal(names1.length, 1, `shard 1 report: ${names1}`);
  assert.equal(names2.length, 1, `shard 2 report: ${names2}`);
  assert.notStrictEqual(names1[0], names2[0], "the two shards must not share a mutant");
  assert.deepStrictEqual(
    new Set([...names1, ...names2]),
    new Set(["x_subject_is_ok.patch", "z_subject_is_ok_too.patch"]),
    "the union of both shard reports must equal the whole fixture corpus");

  // Each shard must evaluate ONLY its own mutant, never the sibling's.
  const other1 = names2[0].replace(/\.patch$/, "");
  const other2 = names1[0].replace(/\.patch$/, "");
  assert.doesNotMatch(r1.out, new RegExp(`^${other1}\\.patch`, "m"), r1.out);
  assert.doesNotMatch(r2.out, new RegExp(`^${other2}\\.patch`, "m"), r2.out);
});
