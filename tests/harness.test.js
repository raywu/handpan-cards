// Self-tests of the e2e test harness itself - tests/helpers/cdp.js and the
// subprocess contracts tests/e2e.test.js's before()/after() hooks rely on
// (a taken port, a SIGTERMed suite, a crashed/slow-starting browser). Moved
// out of tests/e2e.test.js (finding 17, quality refactor 2026-09-30): these
// do not drive a real page the way every e2e journey does, and an 8k-line
// file made them easy to lose track of.
//
// Like tests/e2e.test.js, this whole suite skips with a printed reason if no
// Chromium binary is present (CONTRACT: ./tests/run.sh must work anywhere) -
// several of these tests launch a real (or stand-in) browser subprocess.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { launch, findBrowser, Browser, takeExceptions } = require("./helpers/cdp.js");

const REPO = path.resolve(__dirname, "..");

const BROWSER = findBrowser();
if (!BROWSER) {
  const why =
    "harness self-tests skipped: no Chromium binary found (set CHROME_BIN to " +
    "enable). This is not a failure - see tests/CONTRACT.md.";
  console.log(why);
  test.skip(why, () => {});
} else {
  run();
}

function run() {
  /* ------------------------------------------------------------------ *
   * settle() - finding 6, quality refactor 2026-09-30. Unit-level: a fake
   * Browser whose eval() is stubbed to report controlled getAnimations()
   * counts, so these do not need a live page or a real animation and cannot
   * flake on CI timing the way driving a real CSS transition would.
   * ------------------------------------------------------------------ */

  test("settle() returns promptly when no animation is running", async () => {
    let calls = 0;
    const b = Object.create(Browser.prototype);
    b.eval = async () => {
      calls++;
      // Call 1 is the single rAF wait settle() always pays up front; every
      // call after that is a getAnimations().length poll.
      return calls === 1 ? null : 0;
    };
    const t0 = Date.now();
    await b.settle();
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 200, `settle() took ${elapsed}ms with no animation ever running`);
    assert.strictEqual(calls, 2,
      `settle() should check getAnimations() once and return, not loop (saw ${calls} eval calls)`);
  });

  test("settle() waits for a running animation to finish", async () => {
    let calls = 0;
    const b = Object.create(Browser.prototype);
    b.eval = async () => {
      calls++;
      // Call 1: the rAF wait. Calls 2-3: still animating. Call 4+: cleared.
      if (calls === 1) return null;
      if (calls <= 3) return 1;
      return 0;
    };
    await b.settle();
    assert.ok(calls >= 4,
      `settle() must keep polling until getAnimations() clears, not return on the first ` +
      `nonzero read (saw only ${calls} eval calls)`);
  });

  test("settle() gives up at its 500ms ceiling rather than hanging on a stuck animation", async () => {
    const b = Object.create(Browser.prototype);
    let calls = 0;
    b.eval = async () => { calls++; return calls === 1 ? null : 1; }; // never clears
    b.strictSettle = false;
    const t0 = Date.now();
    await b.settle();
    const elapsed = Date.now() - t0;
    assert.ok(elapsed >= 480 && elapsed < 1500,
      `settle() should bail out around its 500ms ceiling, not sooner or much later (took ${elapsed}ms)`);
  });

  /* ---------------------------------------------------------------- *
   * harness contract: a taken port fails loudly, it does not hang
   * ---------------------------------------------------------------- */

  // Regression guard. Several agents share this machine and the port is fixed,
  // so a collision is routine; before this test the `listen` await never
  // settled on EADDRINUSE (the callback only fires on success), so the run hung
  // until something outside killed it and waitForServer's "is port N taken?"
  // message was dead code in exactly the case it was written for.
  //
  // The child is marked with E2E_HARNESS_CHILD so it cannot re-enter here.
  test("a taken port fails the harness fast, naming the port and E2E_PORT", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const net = require("node:net");
    const { spawnSync } = require("node:child_process");

    // Port 0: the OS picks a free one, so this can never collide with a
    // parallel agent the way a hardcoded number would.
    const squatter = net.createServer();
    await new Promise((res, rej) => {
      squatter.once("error", rej);
      squatter.listen(0, "127.0.0.1", res);
    });
    const taken = squatter.address().port;

    // This file is itself running inside node's test runner, which marks the
    // environment with NODE_TEST_CONTEXT. Inherited, that makes the child think
    // it is a runner-managed worker and exit 0 immediately - which would make
    // this test pass against a broken harness. Strip it.
    const env = { ...process.env, E2E_PORT: String(taken), E2E_HARNESS_CHILD: "1" };
    delete env.NODE_TEST_CONTEXT;

    let r;
    try {
      r = spawnSync(process.execPath, ["--test", "tests/e2e.test.js"], {
        cwd: REPO,
        encoding: "utf8",
        timeout: 30000,
        env,
      });
    } finally {
      await new Promise((res) => squatter.close(res));
    }

    const out = (r.stdout || "") + (r.stderr || "");
    // A timeout kill shows up as a signal (and, on some platforms, an error).
    // That IS the hang, so it must fail here rather than pass quietly.
    assert.strictEqual(r.signal, null,
      `the harness was killed by ${r.signal} - it hung on a taken port instead of failing`);
    assert.strictEqual(r.error, undefined,
      `spawnSync failed: ${r.error && r.error.message}`);
    assert.strictEqual(typeof r.status, "number", "no exit status from the harness");
    assert.notStrictEqual(r.status, 0, "the harness exited 0 with its port taken");
    assert.ok(out.includes(String(taken)),
      `the failure never named port ${taken}:\n${out.slice(-2000)}`);
    assert.ok(out.includes("E2E_PORT"),
      `the failure never mentioned E2E_PORT:\n${out.slice(-2000)}`);
  });

  // The other half of the same defect: `node --test` has no per-test deadline,
  // so a wedged suite used to hang tests/suite_health.py forever - which is how
  // a single stuck port burned a whole CI job. run_node_file must bound every
  // suite it starts and report the overrun as a PROBLEM, not a traceback.
  test("suite_health bounds every node suite with a wall clock", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const os = require("node:os");
    const { spawnSync } = require("node:child_process");

    // A suite that never finishes. Written outside tests/ so the *.test.js glob
    // in suite_health.py cannot pick it up and demand a FLOORS row for it.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "suite-health-hang-"));
    const hang = path.join(dir, "hang.test.js");
    fs.writeFileSync(hang,
      'require("node:test").test("never finishes", () => ' +
      "new Promise((r) => setTimeout(r, 60000)));\n");

    const probe = [
      "import sys",
      "from tests import suite_health",
      "total, failed, skipped, cancelled, returncode, out = suite_health.run_node_file(sys.argv[1])",
      'print("TOTAL", total)',
      "print(out)",
    ].join("\n");

    // Same NODE_TEST_CONTEXT trap as above: inherited, the node run_node_file
    // starts would think it is a runner-managed worker and exit at once.
    const env = { ...process.env, NODE_SUITE_TIMEOUT: "3" };
    delete env.NODE_TEST_CONTEXT;

    const started = Date.now();
    let r;
    try {
      r = spawnSync("python3", ["-c", probe, hang], {
        cwd: REPO,
        encoding: "utf8",
        timeout: 60000,
        env,
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    const elapsed = Date.now() - started;
    const out = (r.stdout || "") + (r.stderr || "");

    assert.strictEqual(r.signal, null,
      `run_node_file was killed by ${r.signal} - it never bounded the hung suite`);
    assert.strictEqual(r.error, undefined,
      `run_node_file never returned: ${r.error && r.error.message} (after ${elapsed}ms)`);
    assert.strictEqual(r.status, 0,
      `run_node_file raised instead of reporting the timeout:\n${out.slice(-2000)}`);
    assert.ok(!/Traceback \(most recent call last\)/.test(out),
      `the timeout surfaced as a traceback:\n${out.slice(-2000)}`);
    assert.ok(/^TOTAL None$/m.test(out),
      `a timed-out suite must not report a test count:\n${out.slice(-2000)}`);
    assert.ok(out.includes("TIMED OUT after 3s"),
      `the timeout was not reported with its limit:\n${out.slice(-2000)}`);
    assert.ok(out.includes("hang.test.js"),
      `the timeout report did not name the file:\n${out.slice(-2000)}`);
  });


  /* ---------------------------------------------------------------- *
   * browser reaping (tests/helpers/cdp.js)
   *
   * The harness spawns a real browser and a real profile directory. Both are
   * cleaned up by close(), which only ever runs from after(). Two paths skip
   * after() entirely and used to orphan the browser: a launch() that rejects
   * AFTER spawn (the debug-port timeout, the WebSocket open, any of the setup
   * CDP sends), and a suite killed by a signal - which is exactly how
   * SUITE_TIMEOUT in tests/mutation_check.sh and NODE_TIMEOUT in
   * tests/suite_health.py end an overrunning run. The orphans were observed on
   * a dev box as chrome-headless-shell roots reparented to init, alongside 52
   * abandoned hpfc-prof-* directories.
   *
   * Both tests give the child its own TMPDIR, so "was the profile directory
   * removed?" is answerable without guessing which hpfc-prof-* was ours, and
   * so a stray process can be recognised by its --user-data-dir argument.
   * Every child strips NODE_TEST_CONTEXT: inherited, a node child believes it
   * is a runner-managed worker and exits 0 at once, which would make these
   * pass against the very code they exist to condemn.
   * ---------------------------------------------------------------- */

  const { spawn: spawnChild, execFileSync } = require("node:child_process");
  const osmod = require("node:os");

  function childEnv(extra) {
    const env = { ...process.env, E2E_HARNESS_CHILD: "1", ...extra };
    delete env.NODE_TEST_CONTEXT;
    return env;
  }

  function alive(pid) {
    try { process.kill(pid, 0); return true; } catch { return false; }
  }

  // Anything still running that was pointed at this profile root - the browser
  // root process and every renderer/zygote child carry --user-data-dir.
  function processesUnder(dir) {
    let out = "";
    try { out = execFileSync("ps", ["-eo", "pid=,args=", "-ww"], { encoding: "utf8" }); } catch { return []; }
    return out.split("\n").filter((l) => l.includes(dir));
  }

  function killUnder(dir) {
    for (const line of processesUnder(dir)) {
      const pid = Number(line.trim().split(/\s+/)[0]);
      if (pid && pid !== process.pid) { try { process.kill(pid, "SIGKILL"); } catch {} }
    }
  }

  async function until(pred, ms) {
    const deadline = Date.now() + ms;
    for (;;) {
      if (pred()) return true;
      if (Date.now() > deadline) return false;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  const CDP_HELPER = path.join(REPO, "tests/helpers/cdp.js");

  test("a SIGTERMed suite reaps its browser and its profile directory", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const tmp = fs.mkdtempSync(path.join(osmod.tmpdir(), "reap-term-"));
    // Launch a browser, announce the root pid, then sit still: no after(), no
    // close() - only a signal handler can save this.
    const script =
      "const { launch } = require(" + JSON.stringify(CDP_HELPER) + ");" +
      "(async () => { const b = await launch();" +
      "  if (!b) { console.log('NOBROWSER'); process.exit(0); }" +
      "  console.log('PID ' + b.proc.pid + ' DIR ' + b.profileDir);" +
      "  setInterval(() => {}, 1000); })();";

    const child = spawnChild(process.execPath, ["-e", script], {
      cwd: REPO, env: childEnv({ TMPDIR: tmp }), stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { err += d.toString(); });
    const exited = new Promise((r) => child.on("exit", (c, s) => r({ c, s })));

    const announced = await until(() => /PID \d+ DIR \S+/.test(out) || /NOBROWSER/.test(out), 60000);
    if (/NOBROWSER/.test(out)) {
      child.kill("SIGKILL"); await exited;
      fs.rmSync(tmp, { recursive: true, force: true });
      return;
    }
    assert.ok(announced, `the child never launched a browser:\n${out}\n${err.slice(-2000)}`);
    const m = out.match(/PID (\d+) DIR (\S+)/);
    const browserPid = Number(m[1]);
    const profileDir = m[2];
    assert.ok(alive(browserPid), "the browser was not running before the kill");

    try {
      child.kill("SIGTERM");
      // A handler that swallows the signal would be a WORSE bug than the leak:
      // an overrunning suite would stop being killable. The child must die.
      // The race has an explicit settle point, so the loser's timer is cleared
      // rather than left armed: an armed timer holds node's event loop open for
      // its full budget, and this suite runs 34 more times in every sweep.
      let bail;
      const gone = await Promise.race([
        exited,
        new Promise((r) => { bail = setTimeout(() => r(null), 15000); }),
      ]).finally(() => clearTimeout(bail));
      assert.ok(gone, "SIGTERM did not terminate the child - the handler swallowed it");

      const reaped = await until(() => !alive(browserPid), 10000);
      assert.ok(reaped, `browser pid ${browserPid} outlived the SIGTERMed suite`);
      const clear = await until(() => processesUnder(profileDir).length === 0, 10000);
      assert.ok(clear, `processes still hold the profile:\n${processesUnder(profileDir).join("\n")}`);
      const removed = await until(() => !fs.existsSync(profileDir), 10000);
      assert.ok(removed, `the profile directory survived: ${profileDir}`);
    } finally {
      try { child.kill("SIGKILL"); } catch {}
      killUnder(tmp);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("a launch() that fails after spawn leaves no browser and no profile", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const tmp = fs.mkdtempSync(path.join(osmod.tmpdir(), "reap-fail-"));
    // A stand-in browser that reports a debug port nothing is listening on, so
    // launch() gets past spawn and then fails at the WebSocket - the shape of
    // every post-spawn failure, without a 20s wait for the port timeout.
    const fake = path.join(tmp, "fake-browser");
    fs.writeFileSync(fake,
      "#!/bin/sh\n" +
      "echo 'DevTools listening on ws://127.0.0.1:1/devtools/browser/dead' 1>&2\n" +
      "exec sleep 300\n");
    fs.chmodSync(fake, 0o755);

    const profiles = path.join(tmp, "profiles");
    fs.mkdirSync(profiles);
    // The child reports what is left the moment launch() rejects, BEFORE it
    // exits. Checking after exit would prove nothing: the process-teardown
    // reaper cleans up on the way out, so a launch() that never reaped its own
    // failure would still look clean from outside. The leak this closes is the
    // window a long-lived process spends holding an orphan it already gave up on.
    const script =
      "const { execFileSync } = require('node:child_process');" +
      "const fs = require('node:fs');" +
      "const { launch } = require(" + JSON.stringify(CDP_HELPER) + ");" +
      "(async () => { try { await launch(); console.log('NOTHROW'); }" +
      "  catch (e) { console.log('THREW ' + (e && (e.message || e.type || e))); }" +
      "  const root = process.env.TMPDIR;" +
      "  const left = fs.readdirSync(root).filter((n) => n.startsWith('hpfc-prof-'));" +
      "  const ps = execFileSync('ps', ['-eo', 'pid=,args=', '-ww'], { encoding: 'utf8' })" +
      "    .split('\\n').filter((l) => l.includes(root));" +
      "  console.log('LEFT ' + JSON.stringify(left));" +
      "  console.log('PROCS ' + ps.length);" +
      "  process.exit(0); })();";

    const r = await new Promise((resolve) => {
      const c = spawnChild(process.execPath, ["-e", script], {
        cwd: REPO,
        env: childEnv({ TMPDIR: profiles, CHROME_BIN: fake }),
        stdio: ["ignore", "pipe", "pipe"],
      });
      let o = "", e = "";
      c.stdout.on("data", (d) => { o += d.toString(); });
      c.stderr.on("data", (d) => { e += d.toString(); });
      c.on("exit", (code) => resolve({ code, o, e }));
      // unref: a pure backstop must not by itself keep the process alive for a
      // minute after the child has already exited.
      setTimeout(() => { try { c.kill("SIGKILL"); } catch {} }, 60000).unref();
    });

    try {
      assert.ok(/THREW/.test(r.o),
        `launch() should have rejected past spawn:\n${r.o}\n${r.e.slice(-2000)}`);
      // The original error is a diagnostic other lanes read; it must survive.
      assert.ok(!/THREW (undefined|null)\b/.test(r.o), `the failure lost its error:\n${r.o}`);

      const leftLine = r.o.match(/LEFT (\[.*\])/);
      assert.ok(leftLine, `the child never reported its profile directories:\n${r.o}`);
      assert.deepStrictEqual(JSON.parse(leftLine[1]), [],
        `launch() left profile directories behind: ${leftLine[1]}`);
      const procLine = r.o.match(/PROCS (\d+)/);
      assert.ok(procLine, `the child never reported surviving processes:\n${r.o}`);
      assert.strictEqual(Number(procLine[1]), 0,
        `launch() left ${procLine[1]} process(es) holding the profile`);
      // And nothing outlived the child either.
      const clear = await until(() => processesUnder(profiles).length === 0, 5000);
      assert.ok(clear,
        `a browser outlived the failed launch:\n${processesUnder(profiles).join("\n")}`);
    } finally {
      killUnder(tmp);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });


  /* ---------------------------------------------------------------- *
   * launch retry (tests/helpers/cdp.js)
   *
   * CI run 34518203026 aborted the mutation gate at its BASELINE check: the
   * e2e suite failed on the CLEAN tree with "browser did not report a debug
   * port", ~2 minutes into a 232-mutant sweep, and attempt 2 with no code
   * change was green. The exit branch of the launch race did NOT fire, so the
   * browser was alive and had simply not printed its DevTools ws URL inside
   * the 20s bound - a loaded runner, not breakage. Fourth occurrence, first
   * captured signature.
   *
   * So launch() retries that ONE rejection ONCE. The two tests below are the
   * whole contract: a slow start is retried (and its first, still-alive
   * browser reaped first), and a browser that really fails is NOT - retrying
   * real breakage only doubles the wall clock before the same failure.
   *
   * Both drive a stand-in browser through CHROME_BIN, the seam findBrowser()
   * already has, and both lower the port bound through
   * HPFC_CDP_PORT_TIMEOUT_MS - which can only ever LOWER it - so the slow-start
   * path costs the sweep half a second instead of 20 seconds twice.
   * ---------------------------------------------------------------- */

  // Reports, from inside the child and BEFORE it exits (see the reaping tests
  // above for why "after exit" would prove nothing): how many times the fake
  // browser was executed, what launch() finally threw, and what it left behind.
  const LAUNCH_PROBE =
    "const { execFileSync } = require('node:child_process');" +
    "const fs = require('node:fs');" +
    "const { launch } = require(" + JSON.stringify(CDP_HELPER) + ");" +
    "(async () => { try { await launch(); console.log('NOTHROW'); }" +
    "  catch (e) { console.log('THREW ' + (e && (e.message || e.type || e))); }" +
    "  const log = process.env.FAKE_LOG;" +
    "  console.log('LAUNCHES ' + (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\\n').filter(Boolean).length : 0));" +
    "  const root = process.env.TMPDIR;" +
    "  const left = fs.readdirSync(root).filter((n) => n.startsWith('hpfc-prof-'));" +
    "  const ps = execFileSync('ps', ['-eo', 'pid=,args=', '-ww'], { encoding: 'utf8' })" +
    "    .split('\\n').filter((l) => l.includes(root));" +
    "  console.log('LEFT ' + JSON.stringify(left));" +
    "  console.log('PROCS ' + ps.length);" +
    "  process.exit(0); })();";

  function runLaunchProbe(fakeBody, tmp) {
    const fake = path.join(tmp, "fake-browser");
    const log = path.join(tmp, "invocations");
    fs.writeFileSync(fake, fakeBody.replace(/@LOG@/g, log));
    fs.chmodSync(fake, 0o755);
    const profiles = path.join(tmp, "profiles");
    fs.mkdirSync(profiles);
    return new Promise((resolve) => {
      const c = spawnChild(process.execPath, ["-e", LAUNCH_PROBE], {
        cwd: REPO,
        env: childEnv({
          TMPDIR: profiles, CHROME_BIN: fake, FAKE_LOG: log,
          HPFC_CDP_PORT_TIMEOUT_MS: "500",
        }),
        stdio: ["ignore", "pipe", "pipe"],
      });
      let o = "", e = "";
      c.stdout.on("data", (d) => { o += d.toString(); });
      c.stderr.on("data", (d) => { e += d.toString(); });
      c.on("exit", (code) => resolve({ code, o, e }));
      setTimeout(() => { try { c.kill("SIGKILL"); } catch {} }, 60000).unref();
    });
  }

  test("a slow-starting browser is retried once, and the first one is reaped", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const tmp = fs.mkdtempSync(path.join(osmod.tmpdir(), "launch-slow-"));
    // First run: alive, silent, past the bound - the observed CI signature
    // exactly (NOT an exit, which is a different branch and must not retry).
    // Second run: reports a port nothing listens on, so the retry is provably
    // reached without this test needing a real browser.
    const body =
      "#!/bin/sh\n" +
      "echo run >> '@LOG@'\n" +
      "if [ \"$(wc -l < '@LOG@')\" -le 1 ]; then exec sleep 120; fi\n" +
      "echo 'DevTools listening on ws://127.0.0.1:1/devtools/browser/dead' 1>&2\n" +
      "exec sleep 120\n";
    const r = await runLaunchProbe(body, tmp);

    try {
      const launches = r.o.match(/LAUNCHES (\d+)/);
      assert.ok(launches, `the child never reported the launch count:\n${r.o}\n${r.e.slice(-2000)}`);
      assert.strictEqual(Number(launches[1]), 2,
        "a slow start must be retried exactly once (two browsers spawned, not " +
        `${launches[1]}):\n${r.o}\n${r.e.slice(-2000)}`);
      // Not the timeout again: the retry got past the port wait and died at the
      // dead WebSocket, which is only reachable on the second attempt.
      assert.ok(!/THREW browser did not report a debug port/.test(r.o),
        `the retry never happened - launch() rethrew the slow-start timeout:\n${r.o}`);
      // A silent retry turns a known intermittent into an unknown slowdown.
      assert.ok(/retry/i.test(r.e),
        `the retry was silent - nothing on stderr names it:\n${r.e.slice(-2000)}`);
      // The first browser is ALIVE when the retry starts; not reaping it leaks a
      // Chrome and a profile dir per retry.
      const leftLine = r.o.match(/LEFT (\[.*\])/);
      assert.ok(leftLine, `the child never reported its profile directories:\n${r.o}`);
      assert.deepStrictEqual(JSON.parse(leftLine[1]), [],
        `the retry left profile directories behind: ${leftLine[1]}`);
      const procLine = r.o.match(/PROCS (\d+)/);
      assert.ok(procLine, `the child never reported surviving processes:\n${r.o}`);
      assert.strictEqual(Number(procLine[1]), 0,
        `the retry left ${procLine[1]} process(es) holding a profile`);
    } finally {
      killUnder(tmp);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("a browser that exits at once is not retried", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const tmp = fs.mkdtempSync(path.join(osmod.tmpdir(), "launch-dead-"));
    // Real breakage, not a slow runner: retrying it just pays the same failure
    // twice, and on a 232-mutant sweep that is the difference between a red
    // suite and a timed-out one.
    const body =
      "#!/bin/sh\n" +
      "echo run >> '@LOG@'\n" +
      "exit 3\n";
    const r = await runLaunchProbe(body, tmp);

    try {
      const launches = r.o.match(/LAUNCHES (\d+)/);
      assert.ok(launches, `the child never reported the launch count:\n${r.o}\n${r.e.slice(-2000)}`);
      assert.strictEqual(Number(launches[1]), 1,
        "a browser that exited must NOT be retried (one spawn, not " +
        `${launches[1]}):\n${r.o}\n${r.e.slice(-2000)}`);
      assert.ok(/THREW browser exited: 3/.test(r.o),
        `the original failure must reach the caller unchanged:\n${r.o}`);
    } finally {
      killUnder(tmp);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
  /* ------------------------------------------------------------------ *
   * EX-1 / EX-3 (complexity refactor 2026-10-03, lane EX): an exception the
   * app throws on its own must reach the test that caused it, and a settle()
   * that gave up at its ceiling must say so.
   * ------------------------------------------------------------------ */

  const THROWER =
    "data:text/html," + encodeURIComponent(
      "<button id=b onclick=\"throw new Error('EX1-click')\">x</button>" +
      "<button id=d onclick=\"setTimeout(()=>{throw new Error('EX1-delayed')},30)\">y</button>");

  async function loadThrower(br) {
    await br.send("Page.navigate", { url: THROWER });
    await br.waitFor("document.getElementById('b')", { label: "thrower page" });
  }

  test("EX-1 an uncaught handler exception is reported", async () => {
    takeExceptions();
    const a = await launch();
    const c = await launch();
    try {
      await loadThrower(a);
      await loadThrower(c);
      await a.eval("document.getElementById('b').click();");
      await c.eval("document.getElementById('d').click();");
      const deadline = Date.now() + 5000;
      let seen = [];
      while (Date.now() < deadline) {
        seen = seen.concat(takeExceptions());
        if (seen.some((t) => /EX1-click/.test(t)) && seen.some((t) => /EX1-delayed/.test(t))) break;
        await new Promise((r) => setTimeout(r, 40));
      }
      assert.ok(seen.some((t) => /EX1-click/.test(t)), `first instance's throw missing: ${JSON.stringify(seen)}`);
      assert.ok(seen.some((t) => /EX1-delayed/.test(t)), `second instance's setTimeout throw missing: ${JSON.stringify(seen)}`);
    } finally {
      await a.close();
      await c.close();
    }
  });

  test("EX-3 settle reports a ceiling hit", async () => {
    const b = await launch();
    const lines = [];
    const orig = process.stderr.write;
    b.strictSettle = false;
    try {
      await b.send("Page.navigate", { url: "data:text/html," + encodeURIComponent(
        "<div id=a style='width:10px;height:10px;background:red'></div>" +
        "<script>document.getElementById('a').animate([{opacity:0},{opacity:1}],{duration:1e9})</script>") });
      await b.waitFor("document.getElementById('a')", { label: "animated page" });
      process.stderr.write = function (chunk, ...rest) { lines.push(String(chunk)); return true; };
      await b.settle();
    } finally {
      process.stderr.write = orig;
      await b.close();
    }
    assert.ok(lines.some((l) => /E2E-SETTLE-CEILING/.test(l)),
      `settle() hit its 500ms ceiling silently; stderr was ${JSON.stringify(lines)}`);
  });
}
