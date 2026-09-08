#!/usr/bin/env python3
"""Guards against a suite that passes because it ran nothing.

`unittest discover` and `node --test` both exit 0 when they collect zero tests,
and a decorated skip is easy to miss in a log. CI asserts a floor on the number
of tests actually executed, and that nothing was skipped - except the e2e suite,
which legitimately skips when no browser is present.
"""
import os
import re
import subprocess
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tests import paths  # noqa: E402

MIN_PYTHON = 40
MIN_NODE_UNIT = 12      # app units alone, when no browser is available
MIN_NODE_FULL = 17      # app units + browser e2e


def check_python():
    loader = unittest.TestLoader()
    suite = loader.discover(start_dir="tests", top_level_dir=paths.ROOT)
    if loader.errors:
        for e in loader.errors:
            print(e)
        return ["python: test discovery raised errors"]
    result = unittest.TextTestRunner(verbosity=0, stream=open("/dev/null", "w")).run(suite)
    problems = []
    print(f"python: ran {result.testsRun}, skipped {len(result.skipped)}, "
          f"failures {len(result.failures)}, errors {len(result.errors)}")
    if result.testsRun < MIN_PYTHON:
        problems.append(f"python: only {result.testsRun} tests ran, floor is {MIN_PYTHON}")
    if result.skipped:
        problems.append("python: skipped tests are not allowed: "
                        + ", ".join(str(s[0]) for s in result.skipped))
    if result.failures or result.errors:
        problems.append("python: suite is not green")
    return problems


def check_node():
    proc = subprocess.run(["node", "--test", "tests/*.test.js"],
                          capture_output=True, text=True, cwd=paths.ROOT)
    out = proc.stdout + proc.stderr

    def field(name):
        m = re.search(rf"^# {name} (\d+)$", out, re.M)
        return int(m.group(1)) if m else None

    total, passed, failed = field("tests"), field("pass"), field("fail")
    skipped = field("skipped") or 0
    problems = []
    if total is None:
        return ["node: could not parse TAP summary"]

    # The e2e suite skips itself when no browser is present, which is a
    # supported configuration - the floor and the skip rule both move with it.
    probe = subprocess.run(
        ["node", "-e", "process.stdout.write(String(require('./tests/helpers/cdp.js').findBrowser()))"],
        capture_output=True, text=True, cwd=paths.ROOT)
    have_browser = probe.stdout.strip() not in ("", "null")
    floor = MIN_NODE_FULL if have_browser else MIN_NODE_UNIT
    print(f"node: ran {total}, passed {passed}, failed {failed}, skipped {skipped} "
          f"(browser: {'yes' if have_browser else 'no'}, floor {floor})")

    if total < floor:
        problems.append(f"node: only {total} tests ran, floor is {floor}")
    if failed:
        problems.append("node: suite is not green")
    if skipped:
        # node emits "ok N - <test name> # SKIP" - the name comes BEFORE the
        # marker, so the reason has to be matched ahead of "# SKIP".
        browser_skips = len(re.findall(r"^ok .*(?:browser|chrom).*# SKIP", out, re.M | re.I))
        if have_browser or browser_skips < skipped:
            problems.append(f"node: {skipped} skipped test(s), "
                            f"{browser_skips} explained by a missing browser")
        else:
            print(f"note: {skipped} skipped because no browser is installed")
    return problems


if __name__ == "__main__":
    issues = check_python() + check_node()
    print()
    if issues:
        for i in issues:
            print("FAIL:", i)
        sys.exit(1)
    print("SUITE HEALTH OK")
