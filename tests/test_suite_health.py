"""Process-tree cleanup for a timed-out node run.

tests/suite_health.py:run_node_file shells out to `node --test`. `node --test`
launches Chrome as a grandchild (tests/helpers/cdp.js). Before this fix,
run_node_file used subprocess.run(..., timeout=...), which on TimeoutExpired
kills only the direct child - the grandchild Chrome process survives and
starves later runs (queue row 69).

This test replaces "node" with a fake script (first on PATH) that spawns its
own background grandchild in the same process group - the same shape a real
`node --test` run makes with Chrome - then hangs. It drives run_node_file
through its timeout path with NODE_TIMEOUT cranked down, and asserts the
grandchild is dead afterward.
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


FAKE_NODE = """#!/bin/bash
sleep 100 &
echo $! > "$GRANDCHILD_PID_FILE"
sleep 100
"""


def process_alive(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    return True


class RunNodeFileTimeoutTest(unittest.TestCase):
    def test_grandchild_is_killed_on_timeout(self):
        with tempfile.TemporaryDirectory() as tmp:
            fake_node_path = os.path.join(tmp, "node")
            with open(fake_node_path, "w") as f:
                f.write(FAKE_NODE)
            os.chmod(fake_node_path, os.stat(fake_node_path).st_mode | stat.S_IEXEC)

            grandchild_pid_file = os.path.join(tmp, "grandchild.pid")

            old_path = os.environ.get("PATH", "")
            old_pid_file_env = os.environ.get("GRANDCHILD_PID_FILE")
            old_timeout = suite_health.NODE_TIMEOUT
            os.environ["PATH"] = tmp + os.pathsep + old_path
            os.environ["GRANDCHILD_PID_FILE"] = grandchild_pid_file
            suite_health.NODE_TIMEOUT = 2
            try:
                total, failed, skipped, output = suite_health.run_node_file(
                    "tests/does_not_matter.test.js")
            finally:
                os.environ["PATH"] = old_path
                if old_pid_file_env is None:
                    os.environ.pop("GRANDCHILD_PID_FILE", None)
                else:
                    os.environ["GRANDCHILD_PID_FILE"] = old_pid_file_env
                suite_health.NODE_TIMEOUT = old_timeout

            self.assertIsNone(total)
            self.assertIsNone(failed)
            self.assertEqual(skipped, 0)
            self.assertIn("TIMED OUT after 2s", output)

            deadline = time.time() + 5
            with open(grandchild_pid_file) as f:
                grandchild_pid = int(f.read().strip())
            while process_alive(grandchild_pid) and time.time() < deadline:
                time.sleep(0.1)

            self.assertFalse(
                process_alive(grandchild_pid),
                f"grandchild pid {grandchild_pid} survived the timeout")


if __name__ == "__main__":
    unittest.main()
