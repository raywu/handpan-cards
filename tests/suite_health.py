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
import os
import re
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tests import paths  # noqa: E402

# path -> minimum number of tests that must RUN in that file.
FLOORS = {
    # python
    "tests/test_deck_data.py": 12,
    "tests/test_pdf_build.py": 6,
    "tests/test_print.py": 15,
    "tests/test_render_agreement.py": 7,
    "tests/test_fixture_integrity.py": 6,
    # node
    "tests/app.test.js": 23,
    "tests/e2e.test.js": 5,
    # pre-seeded for the scale-engine lanes; each lane raises its own row only.
    "tests/core.test.js": 25,
    "tests/voicing.test.js": 14,
    "tests/layout.test.js": 35,
    "tests/naming.test.js": 26,
    "tests/select.test.js": 35,
    "tests/share.test.js": 25,
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
    runner = unittest.TextTestRunner(verbosity=0, stream=open("/dev/null", "w"),
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
        problems.append("python: suite is not green")
    return problems


def run_node_file(path):
    """-> (total, failed, skipped, output) for one node test file."""
    proc = subprocess.run(["node", "--test", "--test-reporter=tap", path],
                          capture_output=True, text=True, cwd=paths.ROOT)
    out = proc.stdout + proc.stderr

    def field(name):
        m = re.search(rf"^# {name} (\d+)$", out, re.M)
        return int(m.group(1)) if m else None

    return field("tests"), field("fail"), field("skipped") or 0, out


def check_node():
    probe = subprocess.run(
        ["node", "-e", "process.stdout.write(String(require('./tests/helpers/cdp.js').findBrowser()))"],
        capture_output=True, text=True, cwd=paths.ROOT)
    have_browser = probe.stdout.strip() not in ("", "null")
    print(f"node: browser {'yes' if have_browser else 'no'}")

    problems = []
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
            problems.append(f"{path}: could not parse TAP summary")
            continue
        total_counted += total
        print(f"  {path}: ran {total}, failed {failed}, skipped {skipped}, floor {floor}")
        if total < floor:
            problems.append(f"{path}: only {total} tests ran, floor is {floor}")
        if failed:
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
