"""Process-tree cleanup for a timed-out node run.

tests/suite_health.py:run_node_file shells out to `node --test`. `node --test`
launches Chrome as a grandchild (tests/helpers/cdp.js). Before this fix,
run_node_file used subprocess.run(..., timeout=...), which on TimeoutExpired
kills only the direct child - the grandchild Chrome process survives and
starves later runs (queue row 69).

These tests replace "node" with a fake script (first on PATH) that spawns a
grandchild and then hangs, drive run_node_file through its timeout path with
NODE_TIMEOUT cranked down, and assert the grandchild is dead afterward.

There are two grandchild shapes, because Chrome is the second one:

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

Both tests also bound the WALL CLOCK of the timeout path, and that assertion
is load-bearing rather than hygiene: the post-kill drain re-reads pipes that
any escaped process still holds open, so an unbounded drain blocks until that
process exits on its own. Without the bound, shape 2 passes for the wrong
reason - it waits out the orphan and then finds it dead.
"""
import os
import signal
import stat
import sys
import tempfile
import time
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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
            started = time.monotonic()
            try:
                result = suite_health.run_node_file("tests/does_not_matter.test.js")
            finally:
                self.elapsed = time.monotonic() - started
                os.environ["PATH"] = old_path
                if old_pid_file_env is None:
                    os.environ.pop("GRANDCHILD_PID_FILE", None)
                else:
                    os.environ["GRANDCHILD_PID_FILE"] = old_pid_file_env
                suite_health.NODE_TIMEOUT = old_timeout

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


if __name__ == "__main__":
    unittest.main()
