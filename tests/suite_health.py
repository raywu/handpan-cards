#!/usr/bin/env python3
"""Guards against a suite that passes because it ran nothing.

`unittest discover` and `node --test` both exit 0 when they collect zero tests,
and a decorated skip is easy to miss in a log. CI asserts a floor on the number
of tests actually executed, and that nothing was skipped - except the e2e suite,
which legitimately skips when no browser is present.

FLOORS carries ONE ROW PER TEST FILE. A lane that adds tests raises only its own
row; nobody inserts or reorders lines. Rows pre-seeded at 0 name files that do
not exist yet - a 0 row for a missing file is not an error, it is a placeholder
so the later lane edits a number instead of the table's shape.

The per-file rows must still cover the aggregate floors this file has always
enforced (python 40, node unit 12, node unit+e2e 17). Those aggregates are
MINIMUMS, checked below with >=, so a lane raising its own row is fine and only
a table that no longer reaches an aggregate is an error. "Never lower someone
else's row" is a reviewer rule (tests/CONTRACT.md), not something arithmetic can
see.
"""
import glob
import io
import os
import re
import signal
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tests import paths  # noqa: E402

# path -> minimum number of tests that must RUN in that file.
FLOORS = {
    # python
    "tests/test_deck_data.py": 16,
    "tests/test_pdf_build.py": 7,
    "tests/test_gen_deck.py": 17,
    "tests/test_print.py": 29,
    "tests/test_render_agreement.py": 11,
    "tests/test_fixture_integrity.py": 6,
    "tests/test_failure_diagnosability.py": 11,
    "tests/test_readme_currency.py": 4,
    "tests/test_suite_health.py": 12,
    # node
    "tests/app.test.js": 112,
    "tests/e2e.test.js": 101,
    # pre-seeded for the scale-engine lanes; each lane raises its own row only.
    "tests/core.test.js": 41,
    "tests/voicing.test.js": 15,
    "tests/layout.test.js": 51,
    "tests/naming.test.js": 26,
    "tests/select.test.js": 35,
    "tests/share.test.js": 44,
    "tests/preview.test.js": 14,
    "tests/mutation_harness.test.js": 17,
}

# The e2e suite is the only one allowed to vanish: it skips itself when no
# browser is present, which is a supported configuration.
E2E_FILES = {"tests/e2e.test.js"}

# Aggregate floors, unchanged since the constants this table replaced.
LEGACY_PYTHON = 40
LEGACY_NODE_UNIT = 12
LEGACY_NODE_FULL = 17

PY_FILES = [p for p in FLOORS if p.endswith(".py")]
JS_FILES = [p for p in FLOORS if p.endswith(".js")]


def validate_floors(floors):
    """Raise if the per-file rows no longer reach the aggregate floors.

    The aggregates are MINIMUMS: raising a row is always fine, and the table only
    breaks when the rows stop covering an aggregate.
    """
    py = [p for p in floors if p.endswith(".py")]
    js = [p for p in floors if p.endswith(".js")]
    for name, got, want in (
        ("python", sum(floors[p] for p in py), LEGACY_PYTHON),
        ("node unit", sum(floors[p] for p in js if p not in E2E_FILES), LEGACY_NODE_UNIT),
        ("node total", sum(floors[p] for p in js), LEGACY_NODE_FULL),
    ):
        if got < want:
            raise AssertionError(
                f"{name} per-file floors sum to {got}, "
                f"below the aggregate floor {want}")


validate_floors(FLOORS)
# A lane raising a pre-seeded 0 row must not break this file at import time.
validate_floors({**FLOORS, "tests/core.test.js": 8})


def module_of(path):
    return path[:-3].replace("/", ".")


def exists(path):
    return os.path.exists(os.path.join(paths.ROOT, path))


class PerFileResult(unittest.TextTestRunner.resultclass):
    """Tallies executed tests by the file the TestCase was defined in."""

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self.by_module = {}

    def startTest(self, test):
        mod = type(test).__module__
        self.by_module[mod] = self.by_module.get(mod, 0) + 1
        super().startTest(test)


def check_python():
    loader = unittest.TestLoader()
    suite = loader.discover(start_dir="tests", top_level_dir=paths.ROOT)
    if loader.errors:
        for e in loader.errors:
            print(e)
        return ["python: test discovery raised errors"]
    # Captured, not discarded: a red python suite used to report a bare verdict
    # with its tracebacks streamed to /dev/null, which is the same defect the
    # node path carried and the same reason main was unexplainably red.
    captured = io.StringIO()
    runner = unittest.TextTestRunner(verbosity=0, stream=captured,
                                     resultclass=PerFileResult)
    result = runner.run(suite)
    problems = []
    print(f"python: ran {result.testsRun}, skipped {len(result.skipped)}, "
          f"failures {len(result.failures)}, errors {len(result.errors)}")

    for path in sorted(PY_FILES):
        floor = FLOORS[path]
        ran = result.by_module.get(module_of(path), 0)
        if not exists(path):
            if floor:
                problems.append(f"{path}: floor is {floor} but the file does not exist")
            continue
        print(f"  {path}: ran {ran}, floor {floor}")
        if ran < floor:
            problems.append(f"{path}: only {ran} tests ran, floor is {floor}")

    counted = sum(result.by_module.get(module_of(p), 0) for p in PY_FILES)
    extra = result.testsRun - counted
    if extra:
        print(f"  (+{extra} python test(s) in files with no floor row)")
    if result.testsRun < LEGACY_PYTHON:
        problems.append(f"python: only {result.testsRun} tests ran in total, "
                        f"aggregate floor is {LEGACY_PYTHON}")
    if result.skipped:
        problems.append("python: skipped tests are not allowed: "
                        + ", ".join(str(s[0]) for s in result.skipped))
    if result.failures or result.errors:
        print(f"--- python: {len(result.failures)} failing, {len(result.errors)} "
              f"erroring test(s), the suite's own output follows ---")
        print(excerpt(captured.getvalue()))
        print("--- end of python output ---")
        problems.append("python: suite is not green")
    return problems


# `node --test` runs with no per-test deadline here, so a suite that wedges -
# a browser that never reports ready, a server socket that never binds - used to
# hang this script forever and burn a whole CI job with no log. Every node suite
# therefore runs under a wall clock. The slowest suite measured locally is the
# e2e one at ~5s, so this is ~35x headroom; it matches the SUITE_TIMEOUT that
# tests/mutation_check.sh already uses, and NODE_SUITE_TIMEOUT overrides it.
NODE_TIMEOUT = int(os.environ.get("NODE_SUITE_TIMEOUT", "180"))


# How much of a failing suite's own output to reprint. A return code with no
# text is unexplainable from a CI log (three main-is-red incidents in one day
# proved it), and an unbounded dump of 219 mutant runs is worse than silence.
# The TimeoutExpired path above already settled on a 2000-char bound; the
# failure path needs BOTH ends - the first failure says what broke, the trailing
# TAP summary says how much - so a long stream keeps 2000 characters of each and
# elides the middle.
EXCERPT_HEAD = 2000
EXCERPT_TAIL = 2000


def excerpt(out):
    """A bounded, both-ends view of a suite's output."""
    if len(out) <= EXCERPT_HEAD + EXCERPT_TAIL:
        return out
    elided = len(out) - EXCERPT_HEAD - EXCERPT_TAIL
    return (out[:EXCERPT_HEAD]
            + f"\n... [{elided} characters elided] ...\n"
            + out[-EXCERPT_TAIL:])


# A timed-out suite is SIGTERMed first, and only then SIGKILLed. The suite's own
# process group is not the whole tree: tests/helpers/cdp.js:289 spawns Chrome
# `detached: true`, i.e. setsid(2), so the browser leads its OWN group and a
# killpg of node's group never reaches it. What does reach it is cdp.js's
# SIGTERM/SIGINT/SIGHUP reaper (tests/helpers/cdp.js:79-99), which kills the
# browser group and removes its profile dir. SIGKILL is uncatchable, so killing
# outright defeats that reaper and leaves an orphan Chrome plus an hpfc-prof
# directory behind for every timeout - the starvation queue row 69 is about.
# Grace is the reaper's whole budget: it only signals and rmdirs.
GROUP_TERM_GRACE = 10

# Draining after the kill is bounded too. The pipes were inherited by the whole
# tree, so anything that escaped the group still holds the write end and an
# unbounded communicate() blocks until THAT process exits - the hang this path
# exists to prevent, reappearing one level down. Output from a suite that had
# to be killed is a nicety; returning is not.
DRAIN_TIMEOUT = 5


def _kill_group(proc, sig):
    """Signal the suite's process group, tolerating a tree that already died.

    The group id is proc.pid itself - start_new_session=True makes node a
    session leader, so its pgid IS its pid. Asking os.getpgid() instead would
    lose the group in the exact case that needs it: once node has exited, it is
    a zombie whose getpgid(2) raises ESRCH on macOS while its group lives on.
    The pid cannot have been recycled underneath us either, because nothing has
    reaped it yet - the timeout path never waited.
    """
    try:
        os.killpg(proc.pid, sig)
    except (ProcessLookupError, PermissionError):
        pass


def _text(buf):
    """TimeoutExpired carries its partial output as BYTES even in text mode."""
    if buf is None:
        return ""
    return buf if isinstance(buf, str) else buf.decode("utf-8", "replace")


def _drain(proc, timeout):
    """-> (stdout, stderr, drained) within `timeout`.

    `drained` is False when the deadline passed with the pipes still open, which
    is the only direct evidence that something in the tree is still running:
    proc.poll() speaks for the DIRECT child alone, and node can be reaped while
    a worker of its own outlives it holding the write end.

    Whatever the suite wrote before the deadline comes off the exception rather
    than being thrown away - a killed suite's output is the only explanation a
    CI log gets, and this is the one path where a later read cannot recover it.
    """
    try:
        stdout, stderr = proc.communicate(timeout=timeout)
        return stdout, stderr, True
    except subprocess.TimeoutExpired as exc:
        return _text(exc.stdout), _text(exc.stderr), False


def _reap(proc):
    """Wait on the Popen and close its pipes, on every exit path.

    communicate() already does both when it returns normally, but a timed-out
    read - or one cut short by a signal reaching US (see the BaseException
    clause in run_node_file) - can leave the Popen a zombie: unwaited, with its
    pipe file objects still open. That is exactly what Popen.__del__ warns
    about ("subprocess NNNN is still running"), and it does so on every such
    run, not only a killed one - row 108.
    """
    try:
        proc.wait(timeout=0)
    except Exception:
        pass
    for stream in (proc.stdout, proc.stderr):
        try:
            if stream is not None:
                stream.close()
        except Exception:
            pass


NO_NODE = "node: no `node` binary found on PATH"


def run_node_file(path):
    """-> (total, failed, skipped, output) for one node test file.

    A suite that overruns NODE_TIMEOUT returns totals of None with the timeout
    named in the output, so the caller reports a problem instead of raising.
    """
    try:
        proc = subprocess.Popen(["node", "--test", "--test-reporter=tap", path],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                text=True, cwd=paths.ROOT, start_new_session=True)
    except FileNotFoundError:
        # probe_browser already reports this politely, but check_node runs the
        # UNIT files regardless of have_browser, so without this guard a
        # node-less machine kills the gate with a traceback instead of a
        # problem naming the cause.
        return None, None, None, NO_NODE

    try:
        try:
            stdout, stderr = proc.communicate(timeout=NODE_TIMEOUT)
        except subprocess.TimeoutExpired:
            _kill_group(proc, signal.SIGTERM)
            stdout, stderr, drained = _drain(proc, GROUP_TERM_GRACE)
            if not drained:
                # Escalate on the DRAIN, not on proc.poll(): the pipes still being
                # open is what says a group member outlived the grace, and poll()
                # would report the tree down the moment node itself was reaped.
                _kill_group(proc, signal.SIGKILL)
                stdout, stderr, _ = _drain(proc, DRAIN_TIMEOUT)
            # Both ends, via the shared excerpt() - not a tail-only slice: a
            # long stderr must not evict the short TAP summary that says what
            # ran (row 109).
            return None, None, 0, (
                f"{path}: TIMED OUT after {NODE_TIMEOUT}s - the suite hung and was killed.\n"
                f"{excerpt(stdout + stderr)}")
    except BaseException:
        # start_new_session=True above puts node in its own session so the
        # TimeoutExpired path can killpg it reliably - but that also removes
        # node from a local terminal's foreground process group, so a Ctrl-C
        # during THIS communicate() (KeyboardInterrupt, here as anywhere else)
        # never reaches node: cdp.js's SIGINT reaper
        # (tests/helpers/cdp.js:79-99) never runs, and a headless Chrome plus
        # its hpfc-prof-* profile dir are orphaned (row 107, and row 98's local
        # variant of the same leak). Deliver the signal ourselves before it
        # propagates.
        _kill_group(proc, signal.SIGTERM)
        _drain(proc, GROUP_TERM_GRACE)
        raise
    finally:
        _reap(proc)
    out = stdout + stderr

    def field(name):
        m = re.search(rf"^# {name} (\d+)$", out, re.M)
        return int(m.group(1)) if m else None

    return field("tests"), field("fail"), field("skipped") or 0, out


# Every other subprocess in this file is bounded (NODE_TIMEOUT, the drains).
# This probe used to be the exception: a wedged findBrowser() hung the whole
# script forever with no log (row 110).
PROBE_TIMEOUT = 10


def probe_browser():
    """-> (have_browser, problem). problem is None unless the probe itself hung,
    exited abnormally, or `node` could not be found at all - none of which mean
    "no browser installed", so none of them may be folded into have_browser=False
    without a problem alongside it (a caller that trusts have_browser alone to
    pick the aggregate floor would otherwise exit green over an e2e suite that
    never ran).
    """
    try:
        proc = subprocess.Popen(
            ["node", "-e", "process.stdout.write(String(require('./tests/helpers/cdp.js').findBrowser()))"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            cwd=paths.ROOT, start_new_session=True)
    except FileNotFoundError:
        return False, "node: browser probe could not run - no `node` binary found"

    try:
        try:
            stdout, stderr = proc.communicate(timeout=PROBE_TIMEOUT)
        except subprocess.TimeoutExpired:
            _kill_group(proc, signal.SIGTERM)
            stdout, stderr, drained = _drain(proc, GROUP_TERM_GRACE)
            if not drained:
                _kill_group(proc, signal.SIGKILL)
                stdout, stderr, _ = _drain(proc, DRAIN_TIMEOUT)
            return False, (f"node: browser probe timed out after {PROBE_TIMEOUT}s "
                           f"- findBrowser() hung")
    finally:
        _reap(proc)

    if proc.returncode != 0:
        return False, (f"node: browser probe exited {proc.returncode}: "
                       f"{excerpt(stdout + stderr)}")
    return stdout.strip() not in ("", "null"), None


def check_node():
    have_browser, probe_problem = probe_browser()
    print(f"node: browser {'yes' if have_browser else 'no'}")

    problems = [probe_problem] if probe_problem else []
    total_counted = 0
    # Glob, so a new tests/*.test.js file cannot slip in with no floor at all.
    found = sorted(
        os.path.relpath(f, paths.ROOT).replace(os.sep, "/")
        for f in glob.glob(os.path.join(paths.ROOT, "tests", "*.test.js")))
    for path in found:
        if path not in FLOORS:
            problems.append(f"{path}: no FLOORS row in tests/suite_health.py "
                            f"- add one (0 is a fine starting value)")
    for path in sorted(set(JS_FILES) | set(found)):
        floor = FLOORS.get(path, 0)
        if not exists(path):
            if floor:
                problems.append(f"{path}: floor is {floor} but the file does not exist")
            continue
        if path in E2E_FILES and not have_browser:
            print(f"  {path}: not run, no browser installed")
            continue
        total, failed, skipped, out = run_node_file(path)
        if total is None:
            if "TIMED OUT" in out:
                print(f"  {path}: TIMED OUT after {NODE_TIMEOUT}s")
                print(f"--- {path}: timed out, its own output follows ---")
                print(out)
                print(f"--- end of {path} output ---")
                problems.append(f"{path}: timed out after {NODE_TIMEOUT}s "
                                f"- the suite hung (raise NODE_SUITE_TIMEOUT only "
                                f"if it is genuinely this slow)")
            elif out == NO_NODE:
                problems.append(f"{path}: {NO_NODE}")
            else:
                problems.append(f"{path}: could not parse TAP summary")
            continue
        total_counted += total
        print(f"  {path}: ran {total}, failed {failed}, skipped {skipped}, floor {floor}")
        if total < floor:
            problems.append(f"{path}: only {total} tests ran, floor is {floor}")
        if failed:
            print(f"--- {path}: {failed} failing test(s), its own output follows ---")
            print(excerpt(out))
            print(f"--- end of {path} output ---")
            problems.append(f"{path}: suite is not green")
        if skipped:
            # node emits "ok N - <test name> # SKIP" - the name comes BEFORE the
            # marker, so the reason has to be matched ahead of "# SKIP".
            browser_skips = len(re.findall(r"^ok .*(?:browser|chrom).*# SKIP", out, re.M | re.I))
            if have_browser or browser_skips < skipped:
                problems.append(f"{path}: {skipped} skipped test(s), "
                                f"{browser_skips} explained by a missing browser")
            else:
                print(f"  note: {skipped} skipped because no browser is installed")

    aggregate = LEGACY_NODE_FULL if have_browser else LEGACY_NODE_UNIT
    print(f"node: ran {total_counted} in total, aggregate floor {aggregate}")
    if total_counted < aggregate:
        problems.append(f"node: only {total_counted} tests ran in total, "
                        f"aggregate floor is {aggregate}")
    return problems


if __name__ == "__main__":
    issues = check_python() + check_node()
    print()
    if issues:
        for i in issues:
            print("FAIL:", i)
        sys.exit(1)
    print("SUITE HEALTH OK")
