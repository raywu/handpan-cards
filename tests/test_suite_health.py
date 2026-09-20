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
   real topology: tests/helpers/cdp.js:289 spawns Chrome `detached: true`,
   which is setsid(2), so the browser leads its OWN group and a kill of
   node's group never reaches it. What does reach it is cdp.js's own SIGTERM
   reaper (tests/helpers/cdp.js:79-99), which kills the browser group and
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
marker assertion. Shape 2 kills its grandchild before the drain is entered, so
nothing holds the pipes during it and the clock is unmoved by the drain's own
bound; only shape 3 exercises that bound, and it does so by failing assert_dead
long before 30s is in question.
"""
import glob
import os
import signal
import stat
import subprocess
import sys
import tempfile
import time
import unittest

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
FAKE_NODE_DETACHED = """#!/bin/bash
python3 -c 'import os, time; os.setsid(); time.sleep(100)' &
gc=$!
echo $gc > "$GRANDCHILD_PID_FILE"
trap 'kill -KILL -$gc 2>/dev/null; exit 143' TERM
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
# and it holds the pipes. Chrome's real topology again (cdp.js:289 spawns it
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
            os.environ["PATH"] = tmp + os.pathsep + old_path
            os.environ["GRANDCHILD_PID_FILE"] = grandchild_pid_file
            suite_health.NODE_TIMEOUT = 2

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
        total, failed, skipped, output = result
        self.assertIsNone(total)
        self.assertIsNone(failed)
        self.assertEqual(skipped, 0)
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
            "TAP_MARKER_SHOULD_REACH_THE_TAIL", result[3],
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
        before = self._hpfc_profile_dirs()
        result, pid = self.drive_timeout(FAKE_NODE_UNREACHABLE_HOLDER)
        self.addCleanup(self.reap, pid)
        after = self._hpfc_profile_dirs()
        self.assertEqual(
            before, after,
            "the kill path changed the set of hpfc-prof-* profile dirs in "
            "tmpdir - it must never create, remove or sweep one")
        self.assert_timeout_reported(result)
        self.assert_returned_promptly()
        self.assertIn(
            "TAP_MARKER_SHOULD_REACH_THE_TAIL", result[3],
            "the suite's own output was dropped from the timeout excerpt - a "
            "return code with no text is unexplainable from a CI log")
        # Row 108: even on the one shape where run_node_file can never reach
        # the survivor, its OWN Popen (the fake node script, which already
        # exited by the time both drains gave up) must still be waited on and
        # its pipes closed - otherwise Popen.__del__ reports "subprocess NNNN
        # is still running" under -W error::ResourceWarning.
        self.assertIsNotNone(
            self.last_proc.poll(),
            "run_node_file returned without reaping its own Popen")
        for name, stream in (("stdout", self.last_proc.stdout),
                              ("stderr", self.last_proc.stderr)):
            self.assertTrue(stream.closed, f"run_node_file left its {name} pipe open")

    def test_timeout_excerpt_keeps_the_tap_output_when_stderr_is_huge(self):
        """Row 109: 10KB of stderr must not evict a short TAP stdout."""
        result, pid = self.drive_timeout(FAKE_NODE_LOUD_STDERR)
        self.addCleanup(self.reap, pid)
        self.assert_timeout_reported(result)
        self.assert_returned_promptly()
        self.assertIn(
            "TAP_MARKER_SHOULD_REACH_THE_TAIL", result[3],
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
            with open(fake_node_path, "w") as f:
                f.write("#!/bin/bash\nsleep 100\n")
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


if __name__ == "__main__":
    unittest.main()
