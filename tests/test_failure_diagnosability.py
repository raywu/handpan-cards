"""A failing suite must SAY what it said.

Both harness tools ran node suites with their output captured and then threw it
away, so a red run in CI produced a return code and nothing else. Three
successive main-is-red incidents were unexplainable for exactly that reason.

The rule these tests lock in is narrow and deliberate:

* `tests/suite_health.py` prints a bounded excerpt of a suite's own output when
  that suite is not green;
* `tests/mutation_check.sh` prints a bounded excerpt when a BASELINE - the clean
  tree, no mutant applied - is not green;
* and it does NOT print anything for a per-mutant run, where a red suite is the
  expected outcome and printing would bury the log under megabytes of noise.

Spec-first: nothing here reads a message string out of the implementation. The
oracle is "the suite's own words reached stdout", asserted with a marker this
file plants in the suite's output itself.
"""
import glob
import io
import os
import contextlib
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tests import paths  # noqa: E402
from tests import suite_health  # noqa: E402

sys.path.insert(0, paths.TOOLS)
# validate.py stubs sys.modules["hifi"] at import time (it skips font
# registration so it can run without the tools/fonts TTFs) and never cleans
# the stub up - fine for validate.py run standalone, but when this test file
# is run in the SAME process as tests.test_pdf_build (as
# `python3 -m unittest tests.test_readme_currency tests.test_failure_diagnosability
# tests.test_pdf_build` does), the stub leaks and test_pdf_build's own
# `import hifi` gets the stub instead of the real module. Snapshot whether
# "hifi" was already loaded, and if this import is the one that introduces
# the stub, remove it again so a later real `import hifi` elsewhere in the
# same process is unaffected.
_hifi_was_loaded = "hifi" in sys.modules
import validate  # noqa: E402
import inline_engine  # noqa: E402
if not _hifi_was_loaded and not hasattr(sys.modules.get("hifi"), "build"):
    del sys.modules["hifi"]


MARKER = "DIAGNOSABILITY_MARKER_9f3a1c"


def _run_check_node(fake_output, total=5, failed=2, skipped=0, cancelled=0, returncode=0):
    """Drive check_node over ONE synthetic node suite and capture its stdout.

    The suite's result is injected, so no node process runs and the assertion is
    about the tool's reporting, not about any real test file.
    """
    fake = "tests/fake_diag.test.js"
    abs_fake = os.path.join(paths.ROOT, "tests", "fake_diag.test.js")
    probe = mock.Mock(stdout="null", stderr="")
    buf = io.StringIO()
    with mock.patch.object(suite_health.subprocess, "run", return_value=probe), \
            mock.patch.object(suite_health.glob, "glob", return_value=[abs_fake]), \
            mock.patch.object(suite_health, "JS_FILES", [fake]), \
            mock.patch.object(suite_health, "FLOORS", {fake: 0}), \
            mock.patch.object(suite_health, "exists", lambda p: True), \
            mock.patch.object(suite_health, "run_node_file",
                              return_value=(total, failed, skipped, cancelled,
                                            returncode, fake_output)), \
            contextlib.redirect_stdout(buf):
        problems = suite_health.check_node()
    return buf.getvalue(), problems


def _run_check_python(body):
    """Drive check_python over ONE synthetic python test and capture its stdout.

    Discovery is replaced with a single injected TestCase, so no real suite runs
    and the assertion is about the tool's reporting, not about any real test file.
    The per-file floor table is emptied for the same reason: this is a report
    about a red suite, not about how many tests a file owns.
    """
    class Synthetic(unittest.TestCase):
        def runTest(self):
            body(self)

    suite = unittest.TestSuite([Synthetic()])
    buf = io.StringIO()
    with mock.patch.object(unittest.TestLoader, "discover",
                           lambda self, **kw: suite), \
            mock.patch.object(suite_health, "PY_FILES", []), \
            mock.patch.object(suite_health, "LEGACY_PYTHON", 0), \
            contextlib.redirect_stdout(buf):
        problems = suite_health.check_python()
    return buf.getvalue(), problems


class SuiteHealthReportsFailureOutput(unittest.TestCase):
    def test_failing_node_suite_output_reaches_stdout(self):
        tap = ("TAP version 13\n"
               "not ok 1 - a test that broke\n"
               f"  error: '{MARKER}'\n"
               "# fail 2\n")
        out, problems = _run_check_node(tap)
        self.assertTrue(problems, "a failing suite must still be reported as a problem")
        self.assertIn(MARKER, out,
                      "a failing node suite's own output never reached stdout:\n" + out)

    def test_failure_excerpt_names_the_file(self):
        out, _ = _run_check_node(f"not ok 1 - boom\n{MARKER}\n")
        self.assertIn("fake_diag.test.js", out,
                      "the failure excerpt did not name the suite it came from:\n" + out)

    def test_failure_excerpt_is_bounded(self):
        huge = ("x" * 200000) + "\n" + MARKER + "\n"
        out, _ = _run_check_node(huge)
        self.assertIn(MARKER, out, "the tail of a huge failing suite was lost")
        self.assertLess(len(out), 20000,
                        "an unbounded dump would drown the log; got %d chars" % len(out))

    def test_failure_excerpt_keeps_both_ends_of_a_huge_stream(self):
        # The bound is a HEAD-plus-TAIL excerpt, and both halves are load-bearing:
        # the first failure says what broke, the trailing summary says how much.
        # A tail-only reduction still satisfies test_failure_excerpt_is_bounded,
        # so the head half needs its own marker, planted far enough from the tail
        # that no bound short enough to be useful could contain both by accident.
        head_marker = MARKER + "_AT_THE_HEAD"
        tail_marker = MARKER + "_AT_THE_TAIL"
        huge = head_marker + "\n" + ("x" * 200000) + "\n" + tail_marker + "\n"
        out, _ = _run_check_node(huge)
        self.assertIn(tail_marker, out,
                      "the tail of a huge failing suite was lost")
        self.assertIn(head_marker, out,
                      "the HEAD of a huge failing suite was lost - the first "
                      "failure is the half that says what broke:\n" + out)
        self.assertLess(len(out), 20000,
                        "an unbounded dump would drown the log; got %d chars" % len(out))

    def test_green_node_suite_prints_no_excerpt(self):
        out, problems = _run_check_node(f"ok 1 - fine\n{MARKER}\n", failed=0)
        self.assertNotIn(MARKER, out,
                         "a GREEN suite's output was dumped into the log:\n" + out)
        self.assertEqual(
            [p for p in problems if "not green" in p], [],
            "a green suite was reported as not green")


class SuiteHealthReportsPythonFailureOutput(unittest.TestCase):
    """The python runner had the same defect the node runner did.

    Its output went to /dev/null and the verdict was a bare "not green", so a red
    python suite in CI could only be diagnosed by re-running it locally.
    """

    def test_failing_python_suite_output_reaches_stdout(self):
        out, problems = _run_check_python(lambda t: t.fail(MARKER))
        self.assertTrue(problems, "a failing suite must still be reported as a problem")
        self.assertIn(MARKER, out,
                      "a failing python suite's own output never reached stdout:\n" + out)

    def test_python_failure_excerpt_is_bounded(self):
        huge = "y" * 200000
        out, _ = _run_check_python(lambda t: t.fail(huge + "\n" + MARKER))
        self.assertIn(MARKER, out, "the tail of a huge python failure was lost")
        self.assertLess(len(out), 20000,
                        "an unbounded dump would drown the log; got %d chars" % len(out))

    def test_green_python_suite_prints_no_excerpt(self):
        out, problems = _run_check_python(lambda t: None)
        self.assertEqual(
            [p for p in problems if "not green" in p], [],
            "a green suite was reported as not green")
        self.assertNotIn("Traceback", out,
                         "a GREEN suite's output was dumped into the log:\n" + out)


def _git(cwd, *args):
    subprocess.run(("git",) + args, cwd=cwd, check=True,
                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT)


class _Sandbox:
    """A throwaway git repo carrying a copy of tests/mutation_check.sh.

    The script cds to its own parent, so a copy under <tmp>/tests/ runs entirely
    inside the sandbox and cannot touch this checkout.
    """

    def __init__(self, suite_script):
        self.root = tempfile.mkdtemp(prefix="mutcheck-")
        os.makedirs(os.path.join(self.root, "tests", "mutants"))
        shutil.copy(os.path.join(paths.ROOT, "tests", "mutation_check.sh"),
                    os.path.join(self.root, "tests", "mutation_check.sh"))
        os.chmod(os.path.join(self.root, "tests", "mutation_check.sh"), 0o755)
        self._write("suite.sh", suite_script, 0o755)
        self._write("target.txt", "alpha\n")
        _git(self.root, "init", "-q")
        _git(self.root, "config", "user.email", "t@example.com")
        _git(self.root, "config", "user.name", "t")
        _git(self.root, "add", "-A")
        _git(self.root, "commit", "-qm", "seed")
        self._write("target.txt", "beta\n")
        body = subprocess.run(["git", "diff"], cwd=self.root, check=True,
                              stdout=subprocess.PIPE, text=True).stdout
        _git(self.root, "checkout", "--", "target.txt")
        self._write(
            os.path.join("tests", "mutants", "z_fixture.patch"),
            "# kills: a sandbox fixture, never run by the real sweep\n"
            "# suite: ./suite.sh\n" + body)
        _git(self.root, "add", "-A")
        _git(self.root, "commit", "-qm", "mutant")

    def _write(self, rel, text, mode=None):
        p = os.path.join(self.root, rel)
        with open(p, "w") as fh:
            fh.write(text)
        if mode is not None:
            os.chmod(p, mode)

    def run(self):
        env = dict(os.environ, MUTANT_TIMEOUT="60")
        return subprocess.run([os.path.join(self.root, "tests", "mutation_check.sh")],
                              cwd=self.root, capture_output=True, text=True,
                              timeout=300, env=env)

    def close(self):
        shutil.rmtree(self.root, ignore_errors=True)


class MutationCheckReportsBaselineOutput(unittest.TestCase):
    def test_red_baseline_prints_the_suite_output(self):
        box = _Sandbox("#!/bin/sh\n"
                       f"echo '{MARKER} the baseline said this'\n"
                       f"echo '{MARKER} and this on stderr' >&2\n"
                       "exit 1\n")
        self.addCleanup(box.close)
        r = box.run()
        out = r.stdout + r.stderr
        self.assertNotEqual(r.returncode, 0,
                            "a red baseline must abort the sweep:\n" + out)
        self.assertIn(MARKER, out,
                      "the sweep aborted on a red baseline without printing one "
                      "word of what the suite said:\n" + out)

    def test_red_baseline_excerpt_is_bounded(self):
        box = _Sandbox("#!/bin/sh\n"
                       "i=0; while [ $i -lt 4000 ]; do "
                       "echo 'noise noise noise noise noise noise noise'; "
                       "i=$((i+1)); done\n"
                       f"echo '{MARKER}'\n"
                       "exit 1\n")
        self.addCleanup(box.close)
        r = box.run()
        out = r.stdout + r.stderr
        self.assertIn(MARKER, out, "the tail of a huge red baseline was lost")
        self.assertLess(len(out), 20000,
                        "an unbounded dump would drown the log; got %d chars" % len(out))

    def test_per_mutant_run_output_is_not_printed(self):
        # Green on the clean tree (alpha), red once the mutant flips it to beta:
        # a normal kill, whose failure output is expected noise, not signal.
        box = _Sandbox("#!/bin/sh\n"
                       f"echo '{MARKER}'\n"
                       "grep -q beta target.txt && exit 1\n"
                       "exit 0\n")
        self.addCleanup(box.close)
        r = box.run()
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 0, "the fixture mutant should be killed:\n" + out)
        self.assertIn("killed", out, out)
        self.assertNotIn(MARKER, out,
                         "per-mutant suite output was dumped into the log - 219 "
                         "mutants of that is worse than silence:\n" + out)


class ValidateReportsCheckFailures(unittest.TestCase):
    """tools/validate.py had the same defect as the two tools above: a failing
    check raised a bare AssertionError, which aborted the whole script and
    left every check after it unexplained - and unrun. `validate.run_check`
    is the fix: it catches a failing check, prints ITS OWN message labelled
    with the check's number and description, records the failure, and lets
    the remaining checks still run.
    """

    def test_a_failing_check_prints_its_own_message_and_is_recorded(self):
        failures = []
        buf = io.StringIO()

        def boom():
            assert False, MARKER

        with contextlib.redirect_stdout(buf):
            validate.run_check(1, "a fixture check", boom, failures)

        out = buf.getvalue()
        self.assertIn(MARKER, out,
                     "a failing check's own message never reached stdout:\n" + out)
        self.assertIn("1", out, out)
        self.assertEqual(len(failures), 1, failures)
        self.assertEqual(failures[0][0], 1)

    def test_a_passing_check_is_not_recorded_as_a_failure(self):
        failures = []
        buf = io.StringIO()

        with contextlib.redirect_stdout(buf):
            validate.run_check(2, "a fixture check", lambda: None, failures)

        self.assertEqual(failures, [])
        self.assertIn("OK", buf.getvalue())

    def test_a_later_check_still_runs_after_an_earlier_one_fails(self):
        # The whole point of reporting instead of raising: one red check must
        # not hide every check after it.
        failures = []
        buf = io.StringIO()
        ran_second = []

        with contextlib.redirect_stdout(buf):
            validate.run_check(1, "first", lambda: (_ for _ in ()).throw(AssertionError(MARKER)), failures)
            validate.run_check(2, "second", lambda: ran_second.append(True), failures)

        self.assertEqual(ran_second, [True],
                         "a failing check aborted the run instead of being reported")
        self.assertEqual(len(failures), 1)


class InlineEngineReportsReinjectionFailures(unittest.TestCase):
    """tools/inline_engine.py had the same defect tools/sync_decks.py already
    fixed: it wrote the engine regions and reported success without ever
    reading the bytes back - a smoke test against stale in-memory data would
    pass even if the write silently failed to land. `sync()` now re-parses
    index.html via its own `desync()` after writing, and raises with
    `desync()`'s own reasons if that re-parse still finds a problem.
    """

    def test_a_failed_reinjection_raises_with_desyncs_own_reason(self):
        workdir = tempfile.mkdtemp(prefix="inline-engine-diag-")
        try:
            engine_dir = os.path.join(workdir, "src", "engine")
            os.makedirs(engine_dir)
            with open(os.path.join(engine_dir, "core.js"), "w") as fh:
                fh.write("var HPE = {};\n")
            index_path = os.path.join(workdir, "index.html")
            with open(index_path, "w") as fh:
                fh.write("<html>\n<!-- engine begin -->\n<!-- engine end -->\n</html>\n")

            with mock.patch.object(inline_engine, "INDEX", index_path), \
                    mock.patch.object(inline_engine, "ENGINE_DIR", engine_dir), \
                    mock.patch.object(inline_engine, "MODULES", ["core"]), \
                    mock.patch.object(inline_engine, "desync", return_value=[MARKER]):
                with self.assertRaises(SystemExit) as ctx:
                    inline_engine.sync()
                self.assertIn(MARKER, str(ctx.exception),
                             "sync() did not surface desync()'s own reason:\n"
                             + str(ctx.exception))
        finally:
            shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
