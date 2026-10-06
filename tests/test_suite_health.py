"""Process-tree cleanup for a timed-out node run.

tests/suite_health.py:run_node_file shells out to `node --test`. `node --test`
launches Chrome as a grandchild (tests/helpers/cdp.js). Before this fix,
run_node_file used subprocess.run(..., timeout=...), which on TimeoutExpired
kills only the direct child - the grandchild Chrome process survives and
starves later runs (queue row 69).

These tests replace "node" with a fake script (first on PATH) that spawns a
grandchild and then hangs, drive run_node_file through its timeout path with
NODE_TIMEOUT cranked down, and assert the grandchild is dead afterward.

There are three shapes, because Chrome is the second one:

1. IN GROUP. The plain case - killing node's process group reaches it.
2. IN ITS OWN SESSION, with a parent that reaps it on SIGTERM. This is the
   real topology: the spawn in `launchOnce` (tests/helpers/cdp.js) spawns Chrome `detached: true`,
   which is setsid(2), so the browser leads its OWN group and a kill of
   node's group never reaches it. What does reach it is cdp.js's own SIGTERM
   reaper (tests/helpers/cdp.js:79-100), which kills the browser group and
   re-raises. SIGKILL is uncatchable, so a SIGKILL-first timeout DEFEATS that
   reaper and leaves the orphan Chrome the queue row is about. Shape 1 alone
   is a false oracle: a bash background job inherits its parent's group (job
   control is off in a non-interactive shell), so it dies under either signal.

3. IN GROUP, OUTLIVING NODE ITSELF, holding the pipes. node --test is a
   supervisor, so a worker that ignores SIGTERM outlives it while the pipe it
   inherited keeps communicate() blocking. This is the shape that separates
   "the direct child is down" from "the tree is down": both of the above die
   with node, so under them the SIGKILL escalation is never reached at all and
   its gate can say anything.
4. AS SHAPE 3, BUT IN ITS OWN SESSION, so killpg never reaches it and both
   drains run out the clock. The only shape whose output a later read cannot
   recover, so it is the one that asserts on the excerpt.

All three bound the WALL CLOCK of the timeout path. That bound is hygiene, not
the oracle - what kills a regression here is assert_dead, and on shape 3 the
marker assertion. Shape 2 kills its grandchild 0.3 s into the drain, well inside
the grace, so nothing holds the pipes past it and the clock is unmoved by the
drain's own bound; only shape 3 exercises that bound, and it does so by failing assert_dead
long before 30s is in question.
"""
import glob
import io
import json
import os
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import time
import unittest
from unittest import mock

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REPO_ROOT)
from tests import suite_health  # noqa: E402


# Shape 1: a plain background job. Job control is off here, so it stays in the
# fake node's own process group.
FAKE_NODE = """#!/bin/bash
sleep 100 &
echo $! > "$GRANDCHILD_PID_FILE"
sleep 100
"""

# Shape 2: Chrome's topology. The grandchild calls setsid() and so leaves the
# group entirely; the parent reaps it from a SIGTERM trap, exactly as cdp.js
# does. `sleep & wait` rather than a foreground sleep because bash runs a trap
# only after the current foreground command finishes, and `wait` is the one
# that a signal interrupts.
# The reaper needs real time (the sleep in the trap), so a zero grace can never
# be enough.
FAKE_NODE_DETACHED = """#!/bin/bash
python3 -c 'import os, time; os.setsid(); time.sleep(100)' &
gc=$!
echo $gc > "$GRANDCHILD_PID_FILE"
trap 'sleep 0.3; kill -KILL -$gc 2>/dev/null; exit 143' TERM
sleep 100 &
wait $!
"""

# Shape 3: node itself exits, but a group member outlives it holding the pipes.
# `node --test` is a supervisor; a worker that ignores SIGTERM outlives it, and
# the inherited pipe write end keeps communicate() blocking after the direct
# child is already reaped. This is the shape that tells proc.poll() apart from
# "the tree is down": poll() speaks only for the direct child, so gating the
# SIGKILL escalation on it skips the escalation in exactly the case that needs
# it. The marker goes out before the leak so the excerpt has something to carry.
FAKE_NODE_PIPE_HOLDER = """#!/bin/bash
echo "TAP_MARKER_SHOULD_REACH_THE_TAIL"
bash -c 'trap "" TERM; sleep 100' &
echo $! > "$GRANDCHILD_PID_FILE"
exit 0
"""


# Row 109: a suite that spews to stderr before hanging. A tail-only excerpt of
# (stdout + stderr) evicts a short TAP stdout once stderr alone exceeds the
# 2000-char window; the marker is written to stdout FIRST, so it sits far from
# the end of the concatenation once 10KB of stderr follows it.
FAKE_NODE_LOUD_STDERR = """#!/bin/bash
echo $$ > "$GRANDCHILD_PID_FILE"
echo "TAP_MARKER_SHOULD_REACH_THE_TAIL"
python3 -c "print('E' * 10000)" 1>&2
sleep 100
"""


# Shape 4: the survivor is in its OWN session, so killpg cannot reach it at all,
# and it holds the pipes. Chrome's real topology again (the spawn in `launchOnce` in cdp.js spawns it
# detached, inheriting stdio), but here nothing reaps it, so BOTH drains run out
# the clock. That makes it the only shape where the suite's own output cannot be
# recovered by a later read - if the drain discards TimeoutExpired's partial
# output, CI gets a timeout with no text at all. Nothing can kill this one from
# inside run_node_file, so the test cleans it up itself.
FAKE_NODE_UNREACHABLE_HOLDER = """#!/bin/bash
echo "TAP_MARKER_SHOULD_REACH_THE_TAIL"
python3 -c 'import os, time; os.setsid(); time.sleep(100)' &
echo $! > "$GRANDCHILD_PID_FILE"
exit 0
"""


def process_alive(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    return True


class RunNodeFileTimeoutTest(unittest.TestCase):
    def drive_timeout(self, script):
        """Run run_node_file against a fake `node`; -> (result, grandchild pid)."""
        with tempfile.TemporaryDirectory() as tmp:
            fake_node_path = os.path.join(tmp, "node")
            with open(fake_node_path, "w") as f:
                f.write(script)
            os.chmod(fake_node_path, os.stat(fake_node_path).st_mode | stat.S_IEXEC)

            grandchild_pid_file = os.path.join(tmp, "grandchild.pid")

            old_path = os.environ.get("PATH", "")
            old_pid_file_env = os.environ.get("GRANDCHILD_PID_FILE")
            old_timeout = suite_health.NODE_TIMEOUT
            old_grace = suite_health.GROUP_TERM_GRACE
            old_drain = suite_health.DRAIN_TIMEOUT
            os.environ["PATH"] = tmp + os.pathsep + old_path
            os.environ["GRANDCHILD_PID_FILE"] = grandchild_pid_file
            suite_health.NODE_TIMEOUT = 2
            suite_health.GROUP_TERM_GRACE = min(old_grace, 2)
            suite_health.DRAIN_TIMEOUT = min(old_drain, 1)

            # Captures the Popen run_node_file creates internally, so a test
            # can assert it was reaped and its pipes closed (row 108) - the
            # function itself only returns the parsed TAP summary.
            orig_popen = suite_health.subprocess.Popen
            captured = []

            def capturing_popen(*a, **kw):
                p = orig_popen(*a, **kw)
                captured.append(p)
                return p

            suite_health.subprocess.Popen = capturing_popen
            started = time.monotonic()
            try:
                result = suite_health.run_node_file("tests/does_not_matter.test.js")
            finally:
                self.elapsed = time.monotonic() - started
                suite_health.subprocess.Popen = orig_popen
                os.environ["PATH"] = old_path
                if old_pid_file_env is None:
                    os.environ.pop("GRANDCHILD_PID_FILE", None)
                else:
                    os.environ["GRANDCHILD_PID_FILE"] = old_pid_file_env
                suite_health.NODE_TIMEOUT = old_timeout
                suite_health.GROUP_TERM_GRACE = old_grace
                suite_health.DRAIN_TIMEOUT = old_drain

            self.last_proc = captured[-1] if captured else None
            with open(grandchild_pid_file) as f:
                return result, int(f.read().strip())

    def assert_returned_promptly(self):
        """The timeout path must not wait out a process it failed to kill."""
        self.assertLess(
            self.elapsed, 30,
            f"run_node_file took {self.elapsed:.1f}s to return after a 2s "
            "timeout - it is blocked draining pipes held by a survivor")

    def assert_timeout_reported(self, result):
        total, failed, skipped, cancelled, returncode, output = result
        self.assertIsNone(total)
        self.assertIsNone(failed)
        self.assertEqual(skipped, 0)
        self.assertEqual(cancelled, 0)
        self.assertIsNone(returncode)
        self.assertIn("TIMED OUT after 2s", output)

    def assert_dead(self, pid, what):
        deadline = time.time() + 15
        while process_alive(pid) and time.time() < deadline:
            time.sleep(0.1)
        if process_alive(pid):
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            self.fail(f"{what} pid {pid} survived the timeout")

    def test_grandchild_is_killed_on_timeout(self):
        result, pid = self.drive_timeout(FAKE_NODE)
        self.assert_timeout_reported(result)
        self.assert_returned_promptly()
        self.assert_dead(pid, "grandchild")

    def test_a_grandchild_in_its_own_session_is_reaped_by_its_parent(self):
        """The Chrome case: only a SIGTERM lets the suite's own reaper run."""
        result, pid = self.drive_timeout(FAKE_NODE_DETACHED)
        self.assert_timeout_reported(result)
        self.assert_returned_promptly()
        self.assert_dead(pid, "detached grandchild")

    def test_a_survivor_holding_the_pipes_is_escalated_to_sigkill(self):
        """node exits, a group member does not: poll() says down, the tree is not."""
        result, pid = self.drive_timeout(FAKE_NODE_PIPE_HOLDER)
        self.assert_timeout_reported(result)
        self.assert_returned_promptly()
        self.assert_dead(pid, "pipe-holding survivor")
        self.assertIn(
            "TAP_MARKER_SHOULD_REACH_THE_TAIL", result[5],
            "the suite's own output was dropped from the timeout excerpt - a "
            "return code with no text is unexplainable from a CI log")

    @staticmethod
    def _hpfc_profile_dirs():
        return set(glob.glob(os.path.join(tempfile.gettempdir(), "hpfc-prof-*")))

    def test_a_killed_suites_own_output_reaches_the_excerpt(self):
        """Both drains run out: the partial read is the only text there will be."""
        # AC-G5 (rows 69, 98): an indirect, deterministic proxy for "the kill
        # path never touches a Chrome profile dir it does not own" - this run
        # uses a fake node, never a real browser, so the only way the set
        # could change is suite_health.py itself reaching into tmpdir (e.g. an
        # age-based sweep, which row 98 explicitly rules out as unsafe: it can
        # delete a concurrent run's LIVE profile).
        root = tempfile.mkdtemp()
        old_tempdir = tempfile.tempdir
        old_tmpdir = os.environ.get("TMPDIR")

        def restore_tmp():
            tempfile.tempdir = old_tempdir
            if old_tmpdir is None:
                os.environ.pop("TMPDIR", None)
            else:
                os.environ["TMPDIR"] = old_tmpdir
            shutil.rmtree(root, ignore_errors=True)

        self.addCleanup(restore_tmp)
        decoys = {os.path.join(root, "hpfc-prof-decoy1"),
                  os.path.join(root, "hpfc-prof-decoy2")}
        for decoy in decoys:
            os.mkdir(decoy)
        tempfile.tempdir = root
        os.environ["TMPDIR"] = root
        before = self._hpfc_profile_dirs()
        self.assertEqual(before, decoys)
        result, pid = self.drive_timeout(FAKE_NODE_UNREACHABLE_HOLDER)
        self.addCleanup(self.reap, pid)
        after = self._hpfc_profile_dirs()
        self.assertEqual(after, decoys)
        self.assertTrue(all(os.path.isdir(d) for d in decoys))
        self.assertEqual(
            before, after,
            "the kill path changed the set of hpfc-prof-* profile dirs in "
            "tmpdir - it must never create, remove or sweep one")
        self.assert_timeout_reported(result)
        self.assert_returned_promptly()
        self.assertIn(
            "TAP_MARKER_SHOULD_REACH_THE_TAIL", result[5],
            "the suite's own output was dropped from the timeout excerpt - a "
            "return code with no text is unexplainable from a CI log")
        # Row 108: even on the one shape where run_node_file can never reach
        # the survivor, its OWN Popen (the fake node script, which already
        # exited by the time both drains gave up) must still be waited on and
        # its pipes closed - otherwise Popen.__del__ reports "subprocess NNNN
        # is still running" under -W error::ResourceWarning.
        # .returncode, not .poll(): .poll() itself performs the reap it would
        # be checking for, making the assertion pass even if run_node_file's
        # own reap were removed. .returncode is a plain attribute - reading it
        # cannot mask a missing wait().
        self.assertIsNotNone(
            self.last_proc.returncode,
            "run_node_file returned without reaping its own Popen")
        for name, stream in (("stdout", self.last_proc.stdout),
                              ("stderr", self.last_proc.stderr)):
            self.assertTrue(stream.closed, f"run_node_file left its {name} pipe open")

    def test_timeout_excerpt_keeps_the_tap_output_when_stderr_is_huge(self):
        """Row 109: 10KB of stderr must not evict a short TAP stdout."""
        # No addCleanup here: FAKE_NODE_LOUD_STDERR never forks a grandchild -
        # $$ in the fixture is the fake node script's OWN pid, i.e. the direct
        # child run_node_file's own _kill_group already reaches (they share a
        # pgid). By the time this test runs, that pid is already dead and
        # reaped by _reap(); a killpg cleanup against it would be signaling a
        # pid the kernel may have already handed to an unrelated process.
        result, pid = self.drive_timeout(FAKE_NODE_LOUD_STDERR)
        self.assert_dead(pid, "the fake node script itself")
        self.assert_timeout_reported(result)
        self.assert_returned_promptly()
        self.assertIn(
            "TAP_MARKER_SHOULD_REACH_THE_TAIL", result[5],
            "10KB of stderr evicted the short TAP stdout from the timeout excerpt")

    def reap(self, pid):
        """Kill a survivor run_node_file had no way to reach."""
        try:
            os.killpg(pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass


class ProbeBrowserTimeoutTest(unittest.TestCase):
    """Row 110: every other subprocess in suite_health.py is bounded; the
    browser probe (check_node's `findBrowser()` call) used to be the one
    exception, with no timeout at all."""

    def test_a_hanging_probe_is_killed_and_reported(self):
        with tempfile.TemporaryDirectory() as tmp:
            fake_node_path = os.path.join(tmp, "node")
            pid_file = os.path.join(tmp, "probe.pid")
            # A plain foreground `sleep 100` is killed by subprocess.run's own
            # kill()+wait() on TimeoutExpired even with no group handling at
            # all - it has no descendant to orphan. This shape mirrors
            # FAKE_NODE: a background grandchild that survives its parent
            # unless the whole GROUP is signaled, which is exactly what F1
            # says probe_browser used to fail to do.
            with open(fake_node_path, "w") as f:
                f.write(f"#!/bin/bash\nsleep 100 &\necho $! > {pid_file}\nsleep 100\n")
            os.chmod(fake_node_path, os.stat(fake_node_path).st_mode | stat.S_IEXEC)

            old_path = os.environ.get("PATH", "")
            old_timeout = suite_health.PROBE_TIMEOUT
            os.environ["PATH"] = tmp + os.pathsep + old_path
            suite_health.PROBE_TIMEOUT = 2
            started = time.monotonic()
            try:
                have_browser, problem = suite_health.probe_browser()
            finally:
                elapsed = time.monotonic() - started
                os.environ["PATH"] = old_path
                suite_health.PROBE_TIMEOUT = old_timeout

            self.assertLess(
                elapsed, 30,
                f"probe_browser took {elapsed:.1f}s to return after a 2s "
                "timeout - a wedged findBrowser() must not hang the whole run")
            self.assertFalse(have_browser)
            self.assertIsNotNone(problem, "a hung probe must be reported, not hidden")
            self.assertIn("timed out", problem)

            # AC-G4: probe_browser must not orphan the probe's own process - a
            # descendant surviving at ppid 1, still holding the pipe FDs, is
            # exactly the leak this test exists to catch (row 110's sibling: a
            # bounded RETURN is not the same thing as a bounded PROCESS TREE).
            with open(pid_file) as f:
                probe_pid = int(f.read().strip())
            deadline = time.time() + 15
            while process_alive(probe_pid) and time.time() < deadline:
                time.sleep(0.1)
            if process_alive(probe_pid):
                try:
                    os.kill(probe_pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                self.fail(f"probe process pid {probe_pid} survived the timeout")


class ProbeBrowserErrorTest(unittest.TestCase):
    """A probe that exits nonzero is not "no browser installed" - it is an
    error that must be surfaced as a problem, or check_node silently drops
    the aggregate floor from LEGACY_NODE_FULL to LEGACY_NODE_UNIT and exits
    green over an e2e suite that never ran."""

    def run_probe_with_fake_node(self, script):
        with tempfile.TemporaryDirectory() as tmp:
            fake_node_path = os.path.join(tmp, "node")
            with open(fake_node_path, "w") as f:
                f.write(script)
            os.chmod(fake_node_path, os.stat(fake_node_path).st_mode | stat.S_IEXEC)

            old_path = os.environ.get("PATH", "")
            os.environ["PATH"] = tmp + os.pathsep + old_path
            try:
                return suite_health.probe_browser()
            finally:
                os.environ["PATH"] = old_path

    def test_a_probe_that_exits_nonzero_is_reported_as_a_problem(self):
        have_browser, problem = self.run_probe_with_fake_node(
            "#!/bin/bash\necho boom 1>&2\nexit 1\n")
        self.assertFalse(have_browser)
        self.assertIsNotNone(
            problem,
            "a probe exiting nonzero is indistinguishable from a real absent "
            "browser unless it is reported as a problem")
        self.assertIn("boom", problem)

    def test_a_missing_node_binary_is_reported_not_raised(self):
        with tempfile.TemporaryDirectory() as tmp:
            old_path = os.environ.get("PATH", "")
            os.environ["PATH"] = tmp
            try:
                have_browser, problem = suite_health.probe_browser()
            finally:
                os.environ["PATH"] = old_path
        self.assertFalse(have_browser)
        self.assertIsNotNone(problem, "a missing `node` binary must be reported, not raised")


class RunNodeFileMissingNodeTest(unittest.TestCase):
    """probe_browser reports a missing `node` politely, but check_node then
    calls run_node_file for every UNIT file regardless of have_browser, and
    that Popen sits before its own try. Without a guard the whole gate dies
    with a FileNotFoundError traceback instead of naming the problem."""

    def test_a_missing_node_binary_does_not_crash_the_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            old_path = os.environ.get("PATH", "")
            os.environ["PATH"] = tmp
            try:
                total, failed, skipped, cancelled, returncode, out = suite_health.run_node_file(
                    "tests/core.test.js")
            except FileNotFoundError:
                self.fail("a missing `node` binary must be reported, not raised")
            finally:
                os.environ["PATH"] = old_path
        self.assertIsNone(total, "no suite ran, so there is no total to report")
        self.assertIn("node", out)

    def test_check_node_names_the_missing_binary_as_a_problem(self):
        with tempfile.TemporaryDirectory() as tmp:
            old_path = os.environ.get("PATH", "")
            os.environ["PATH"] = tmp
            try:
                problems = suite_health.check_node()
            except FileNotFoundError:
                self.fail("check_node must report a missing `node`, not raise")
            finally:
                os.environ["PATH"] = old_path
        self.assertTrue(problems, "a node-less machine is a problem, not a green run")
        self.assertTrue(
            any("node" in p for p in problems),
            f"no problem names the missing binary: {problems}")


class SigintDuringRunTest(unittest.TestCase):
    """Row 107: start_new_session=True (needed so a TimeoutExpired kill can
    killpg node reliably) also removes node from a local terminal's foreground
    process group, so a Ctrl-C during the NORMAL (non-timeout) wait never
    reaches node - cdp.js's SIGINT reaper never runs, and its Chrome plus
    hpfc-prof-* profile dir orphan."""

    def test_sigint_reaches_the_node_group(self):
        with tempfile.TemporaryDirectory() as tmp:
            fake_node_path = os.path.join(tmp, "node")
            with open(fake_node_path, "w") as f:
                f.write(FAKE_NODE_DETACHED)
            os.chmod(fake_node_path, os.stat(fake_node_path).st_mode | stat.S_IEXEC)

            grandchild_pid_file = os.path.join(tmp, "grandchild.pid")

            env = dict(os.environ)
            env["PATH"] = tmp + os.pathsep + env.get("PATH", "")
            env["GRANDCHILD_PID_FILE"] = grandchild_pid_file

            driver = f"""
import sys
sys.path.insert(0, {REPO_ROOT!r})
from tests import suite_health
suite_health.NODE_TIMEOUT = 60
suite_health.run_node_file("tests/does_not_matter.test.js")
"""
            driver_path = os.path.join(tmp, "driver.py")
            with open(driver_path, "w") as f:
                f.write(driver)

            # This is the process under test - the stand-in for a local
            # `python3 tests/suite_health.py` a developer Ctrl-C's.
            driver_proc = subprocess.Popen([sys.executable, driver_path], env=env)
            try:
                deadline = time.time() + 10
                while not os.path.exists(grandchild_pid_file) and time.time() < deadline:
                    time.sleep(0.05)
                self.assertTrue(os.path.exists(grandchild_pid_file),
                                "fake node never started")
                time.sleep(0.3)  # let the driver settle into communicate()

                with open(grandchild_pid_file) as f:
                    grandchild_pid = int(f.read().strip())

                # CRITICAL: signal only the child this test spawned, NEVER the
                # process group it lives in - killpg here would hit whatever
                # is running this test suite too.
                os.kill(driver_proc.pid, signal.SIGINT)
                driver_proc.wait(timeout=15)

                deadline = time.time() + 15
                while process_alive(grandchild_pid) and time.time() < deadline:
                    time.sleep(0.1)
                if process_alive(grandchild_pid):
                    try:
                        os.kill(grandchild_pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    self.fail("grandchild survived a local SIGINT during run_node_file")
            finally:
                if driver_proc.poll() is None:
                    driver_proc.kill()
                    driver_proc.wait()


class CheckNodeTimeoutExcerptTest(unittest.TestCase):
    """Row 109's fix builds the head+tail excerpt into run_node_file's return
    value; F3 is that check_node then discards it - the TAP lines a CI log
    needs to say what ran never reach the log at all."""

    def test_a_timed_out_suite_prints_its_excerpt_to_the_log(self):
        import contextlib

        path = "tests/app.test.js"
        marker = "TAP_MARKER_" + ("X" * 200)
        timeout_out = (
            f"{path}: TIMED OUT after 5s - the suite hung and was killed.\n"
            f"{marker}\n")

        def fake_run_node_file(p):
            self.assertEqual(p, path)
            return None, None, 0, 0, None, timeout_out

        orig_run_node_file = suite_health.run_node_file
        orig_probe_browser = suite_health.probe_browser
        orig_glob = suite_health.glob.glob
        orig_floors = dict(suite_health.FLOORS)
        orig_js_files = list(suite_health.JS_FILES)
        suite_health.run_node_file = fake_run_node_file
        suite_health.probe_browser = lambda: (True, None)
        suite_health.glob.glob = lambda *a, **kw: []
        suite_health.FLOORS = {path: 1}
        suite_health.JS_FILES = [path]
        try:
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                suite_health.check_node()
        finally:
            suite_health.run_node_file = orig_run_node_file
            suite_health.probe_browser = orig_probe_browser
            suite_health.glob.glob = orig_glob
            suite_health.FLOORS = orig_floors
            suite_health.JS_FILES = orig_js_files

        self.assertIn(
            marker, buf.getvalue(),
            "a timed-out suite's own TAP excerpt never reached the CI log")


class CheckNodeFloorTest(unittest.TestCase):
    """check_node is the documented local gate (tests/CONTRACT.md: "floors + no
    silent skips"); a green run below a file's floor must still be a problem.
    Lane C's first cut dropped that check from check_node while verify_js kept
    it, so the local path went green over a suite that ran 43 of 193 tests."""

    def test_a_green_run_below_its_floor_is_a_problem(self):
        import contextlib

        path = "tests/app.test.js"
        with mock.patch.object(suite_health, "run_node_file",
                               lambda p: (43, 0, 0, 0, 0, "# tests 43\n# fail 0\n")), \
             mock.patch.object(suite_health, "probe_browser", lambda: (True, None)), \
             mock.patch.object(suite_health.glob, "glob", lambda *a, **kw: []), \
             mock.patch.object(suite_health, "FLOORS", {path: 193}), \
             mock.patch.object(suite_health, "JS_FILES", [path]), \
             contextlib.redirect_stdout(io.StringIO()):
            problems = suite_health.check_node()
        self.assertIn(f"{path}: only 43 tests ran, floor is 193", problems)


class CollectJsCancelledTest(unittest.TestCase):
    """F2 (2026-10-01 bounce): emit_js's own exit code must also go red on a
    `fail 0, cancelled > 0` / non-zero-exit node run, not just on verify_js
    reading the artifact after the fact - both are the gate, per Finding 11."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self._orig_run_node_file = suite_health.run_node_file
        self._orig_probe_browser = suite_health.probe_browser
        self._orig_glob = suite_health.glob.glob
        path = "tests/app.test.js"
        self.path = path
        suite_health.probe_browser = lambda: (True, None)
        suite_health.glob.glob = lambda *a, **kw: [os.path.join(suite_health.paths.ROOT, path)]

    def tearDown(self):
        suite_health.run_node_file = self._orig_run_node_file
        suite_health.probe_browser = self._orig_probe_browser
        suite_health.glob.glob = self._orig_glob
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_emit_js_exits_red_on_cancelled_with_zero_failed(self):
        suite_health.run_node_file = lambda p: (2, 0, 0, 1, 1, "# tests 2\n# fail 0\n# cancelled 1\n")
        outfile = os.path.join(self.tmp, "js.json")
        rc = suite_health.emit_js(outfile)
        self.assertEqual(rc, 1, "a cancelled test with failed=0 must still exit the gate red")
        with open(outfile) as f:
            data = json.load(f)
        entry = data["files"][self.path]
        self.assertEqual(entry["cancelled"], 1)
        self.assertEqual(entry["returncode"], 1)

    def test_emit_js_exits_red_on_nonzero_exit_alone(self):
        suite_health.run_node_file = lambda p: (2, 0, 0, 0, 1, "# tests 2\n# fail 0\n# cancelled 0\n")
        outfile = os.path.join(self.tmp, "js.json")
        rc = suite_health.emit_js(outfile)
        self.assertEqual(rc, 1, "a non-zero exit with failed=0 and cancelled=0 must still be red")


class EmitPythonUnexpectedSuccessTest(unittest.TestCase):
    """F3 (2026-10-01 bounce): emit_python's exit code is the python suites
    job's verdict, so it must go red where `unittest discover` did - including
    on an @expectedFailure test that passes."""

    def test_emit_python_exits_red_on_an_unexpected_success(self):
        class Probe(unittest.TestCase):
            @unittest.expectedFailure
            def test_passes_anyway(self):
                pass

        suite = unittest.TestSuite([Probe("test_passes_anyway")])
        tmp = tempfile.mkdtemp()
        try:
            outfile = os.path.join(tmp, "py.json")
            with mock.patch.object(suite_health.unittest.TestLoader, "discover",
                                   return_value=suite):
                rc = suite_health.emit_python(outfile)
            with open(outfile) as f:
                data = json.load(f)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
        self.assertEqual(data["unexpected_successes"], 1)
        self.assertEqual(rc, 1, "an unexpected success must exit the gate red")


class VerifyArtifactsTest(unittest.TestCase):
    """Finding 11 (2026-09-30 quality refactor): suite-health now reads two
    JSON artifacts emitted by the python-tests/js-tests jobs (suite_health.
    emit_python/emit_js) instead of re-running every suite itself. verify()
    must give every verdict check_python()/check_node() used to give, from
    data alone - a missing or malformed artifact is itself a failure, since a
    silent fallback to running suites would be exactly the re-run this finding
    removes.

    FLOORS/PY_FILES/JS_FILES/the LEGACY_* aggregates and exists() are
    monkeypatched to a small fixed table for the duration of each test, the
    same style CheckNodeTimeoutExcerptTest above uses - so these cases pin
    verify()'s own logic, not today's real corpus."""

    def setUp(self):
        self._orig = {
            "FLOORS": dict(suite_health.FLOORS),
            "PY_FILES": list(suite_health.PY_FILES),
            "JS_FILES": list(suite_health.JS_FILES),
            "LEGACY_PYTHON": suite_health.LEGACY_PYTHON,
            "LEGACY_NODE_UNIT": suite_health.LEGACY_NODE_UNIT,
            "LEGACY_NODE_FULL": suite_health.LEGACY_NODE_FULL,
            "exists": suite_health.exists,
        }
        suite_health.FLOORS = {"tests/test_a.py": 2, "tests/a.test.js": 2}
        suite_health.PY_FILES = ["tests/test_a.py"]
        suite_health.JS_FILES = ["tests/a.test.js"]
        suite_health.LEGACY_PYTHON = 2
        suite_health.LEGACY_NODE_UNIT = 2
        suite_health.LEGACY_NODE_FULL = 2
        suite_health.exists = lambda p: True
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        suite_health.FLOORS = self._orig["FLOORS"]
        suite_health.PY_FILES = self._orig["PY_FILES"]
        suite_health.JS_FILES = self._orig["JS_FILES"]
        suite_health.LEGACY_PYTHON = self._orig["LEGACY_PYTHON"]
        suite_health.LEGACY_NODE_UNIT = self._orig["LEGACY_NODE_UNIT"]
        suite_health.LEGACY_NODE_FULL = self._orig["LEGACY_NODE_FULL"]
        suite_health.exists = self._orig["exists"]
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _write(self, name, data):
        p = os.path.join(self.tmp, name)
        with open(p, "w") as f:
            json.dump(data, f)
        return p

    def _good_py(self):
        return {"total_run": 2, "by_module": {"tests.test_a": 2},
                "skipped": [], "failures": 0, "errors": 0,
                "unexpected_successes": 0, "output_excerpt": ""}

    def _good_js(self):
        return {"have_browser": True, "probe_problem": None,
                "found": ["tests/a.test.js"],
                "files": {"tests/a.test.js":
                          {"total": 2, "failed": 0, "skipped": 0, "browser_skips": 0,
                           "cancelled": 0, "returncode": 0}}}

    def test_a_missing_artifact_fails(self):
        py_path = self._write("py.json", self._good_py())
        problems = suite_health.verify(py_path, os.path.join(self.tmp, "nope.json"))
        self.assertTrue(any("missing artifact" in p for p in problems), problems)

    def test_a_malformed_artifact_fails(self):
        js_path = self._write("js.json", self._good_js())
        py_path = os.path.join(self.tmp, "py.json")
        with open(py_path, "w") as f:
            f.write("{not valid json")
        problems = suite_health.verify(py_path, js_path)
        self.assertTrue(any("malformed artifact" in p for p in problems), problems)

    def test_a_count_under_floor_fails(self):
        py = self._good_py()
        py["total_run"] = 1
        py["by_module"]["tests.test_a"] = 1
        py_path = self._write("py.json", py)
        js_path = self._write("js.json", self._good_js())
        problems = suite_health.verify(py_path, js_path)
        self.assertTrue(any("floor is 2" in p for p in problems), problems)

    def test_a_skipped_test_fails_even_when_the_total_meets_the_floor(self):
        js = self._good_js()
        # 3 ran (above the floor of 2) but one of them was skipped.
        js["files"]["tests/a.test.js"] = {
            "total": 3, "failed": 0, "skipped": 1, "browser_skips": 0,
            "cancelled": 0, "returncode": 0}
        js_path = self._write("js.json", js)
        py_path = self._write("py.json", self._good_py())
        problems = suite_health.verify(py_path, js_path)
        self.assertTrue(
            any("skipped" in p for p in problems),
            f"a skip must fail even though 3 >= the floor of 2: {problems}")

    def test_a_python_skip_fails_even_when_the_total_meets_the_floor(self):
        # unittest itself exits 0 on a skip, so verify_python's own "skipped
        # tests are not allowed" check is the only thing that can catch this -
        # total_run meeting the floor must not paper over it.
        py = self._good_py()
        py["total_run"] = 3
        py["by_module"]["tests.test_a"] = 3
        py["skipped"] = ["tests.test_a.SomeTest.test_thing"]
        py_path = self._write("py.json", py)
        js_path = self._write("js.json", self._good_js())
        problems = suite_health.verify(py_path, js_path)
        self.assertTrue(
            any("skipped" in p for p in problems),
            f"a skip must fail even though 3 >= the floor of 2: {problems}")

    def test_a_python_unexpected_success_fails(self):
        # unittest's wasSuccessful() counts an @expectedFailure test that
        # passes as a failure, so the bare `unittest discover` step this gate
        # replaced went red on one; failures and errors alone never see it.
        py = self._good_py()
        py["unexpected_successes"] = 1
        py_path = self._write("py.json", py)
        js_path = self._write("js.json", self._good_js())
        problems = suite_health.verify(py_path, js_path)
        self.assertTrue(
            any("suite is not green" in p for p in problems),
            f"an unexpected success must fail the gate: {problems}")

    def test_a_js_failure_fails_even_when_the_total_meets_the_floor(self):
        js = self._good_js()
        js["files"]["tests/a.test.js"] = {
            "total": 2, "failed": 1, "skipped": 0, "browser_skips": 0,
            "cancelled": 0, "returncode": 0}
        js_path = self._write("js.json", js)
        py_path = self._write("py.json", self._good_py())
        problems = suite_health.verify(py_path, js_path)
        self.assertTrue(
            any("suite is not green" in p for p in problems),
            f"a failure must fail even though the floor is met: {problems}")

    def test_a_js_cancelled_count_fails_even_with_zero_failed(self):
        # F2 (2026-10-01): node 22 reports a per-test timeout, or a throwing
        # describe-scoped before()/after() hook, as `fail 0, cancelled > 0`
        # with a non-zero exit code - `failed` alone must not be trusted green.
        js = self._good_js()
        js["files"]["tests/a.test.js"] = {
            "total": 2, "failed": 0, "skipped": 0, "browser_skips": 0,
            "cancelled": 1, "returncode": 1}
        js_path = self._write("js.json", js)
        py_path = self._write("py.json", self._good_py())
        problems = suite_health.verify(py_path, js_path)
        self.assertTrue(
            any("suite is not green" in p for p in problems),
            f"a cancelled test must fail even with failed=0: {problems}")

    def test_a_js_nonzero_exit_fails_even_with_zero_failed_and_cancelled(self):
        js = self._good_js()
        js["files"]["tests/a.test.js"] = {
            "total": 2, "failed": 0, "skipped": 0, "browser_skips": 0,
            "cancelled": 0, "returncode": 1}
        js_path = self._write("js.json", js)
        py_path = self._write("py.json", self._good_py())
        problems = suite_health.verify(py_path, js_path)
        self.assertTrue(
            any("suite is not green" in p for p in problems),
            f"a non-zero exit must fail even with failed=0 and cancelled=0: {problems}")

    def test_a_js_entry_missing_cancelled_fails(self):
        # C182-1: a run artifact is the only thing verify() ever sees - a
        # missing "cancelled" key must not silently default to 0 (green),
        # since that is exactly the kind of gap a real emit_js regression
        # would produce.
        js = self._good_js()
        js["files"]["tests/a.test.js"] = {
            "total": 2, "failed": 0, "skipped": 0, "browser_skips": 0,
            "returncode": 0}
        js_path = self._write("js.json", js)
        py_path = self._write("py.json", self._good_py())
        problems = suite_health.verify(py_path, js_path)
        self.assertTrue(
            any("cancelled" in p for p in problems),
            f"a missing cancelled key must fail closed: {problems}")

    def test_a_js_entry_missing_returncode_fails(self):
        js = self._good_js()
        js["files"]["tests/a.test.js"] = {
            "total": 2, "failed": 0, "skipped": 0, "browser_skips": 0,
            "cancelled": 0}
        js_path = self._write("js.json", js)
        py_path = self._write("py.json", self._good_py())
        problems = suite_health.verify(py_path, js_path)
        self.assertTrue(
            any("returncode" in p for p in problems),
            f"a missing returncode key must fail closed: {problems}")

    def test_a_huge_js_error_is_excerpted(self):
        # C182-6: a malformed/erroring entry's own "error" text can be
        # arbitrarily large (a full node crash dump); verify() must bound it
        # the same way collect_js's own output_excerpt does, not print it raw.
        js = self._good_js()
        huge = "X" * 10000
        js["files"]["tests/a.test.js"] = {"total": None, "error": huge}
        js_path = self._write("js.json", js)
        py_path = self._write("py.json", self._good_py())
        problems = suite_health.verify(py_path, js_path)
        matches = [p for p in problems if "tests/a.test.js" in p]
        self.assertTrue(matches, problems)
        self.assertLess(len(matches[0]), len(huge),
                         "a huge error string must be excerpted, not printed raw")
        self.assertIn("elided", matches[0])

    def test_an_unregistered_js_file_fails(self):
        js = self._good_js()
        js["found"] = ["tests/a.test.js", "tests/new.test.js"]
        js_path = self._write("js.json", js)
        py_path = self._write("py.json", self._good_py())
        problems = suite_health.verify(py_path, js_path)
        self.assertTrue(
            any("no FLOORS row" in p and "tests/new.test.js" in p for p in problems),
            problems)

    def test_a_clean_artifact_pair_passes(self):
        # The counterpart to the five failure cases above: verify() must not
        # manufacture a problem out of a genuinely healthy pair of artifacts.
        py_path = self._write("py.json", self._good_py())
        js_path = self._write("js.json", self._good_js())
        self.assertEqual(suite_health.verify(py_path, js_path), [])


if __name__ == "__main__":
    unittest.main()
