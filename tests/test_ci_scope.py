import os
import re
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

from ci_scope import code_changed  # noqa: E402


def workflow():
    with open(os.path.join(ROOT, ".github", "workflows", "validate.yml"), encoding="utf-8") as f:
        return f.read()


def jobs():
    text = workflow()
    body = text.split("\njobs:\n", 1)[1]
    parts = re.split(r"(?m)^  ([a-z][a-z0-9-]*):\s*$", body)
    return {parts[i]: parts[i + 1] for i in range(1, len(parts), 2)}


class CiScopeTest(unittest.TestCase):
    def test_a_plans_or_prompts_only_change_skips_ci(self):
        self.assertFalse(code_changed(["docs/plans/a.md", "docs/prompts/b.md"]))

    def test_every_doc_a_test_reads_runs_ci(self):
        for path in ("README.md", "CLAUDE.md", "docs/ENGINE-SPEC.md"):
            self.assertTrue(code_changed([path]), path)
        self.assertTrue(code_changed(["docs/plans/a.md", "index.html"]))

    def test_an_empty_change_list_runs_ci(self):
        self.assertTrue(code_changed([]))
        self.assertTrue(code_changed(["", "\n"]))

    def test_every_job_but_changes_waits_for_the_doc_only_verdict(self):
        all_jobs = jobs()
        self.assertIn("changes", all_jobs)
        self.assertIn("git diff --no-renames", all_jobs["changes"])
        for name, body in all_jobs.items():
            if name == "changes":
                continue
            needs = re.search(r"(?m)^    needs:\s*(.+)$", body)
            self.assertTrue(needs and re.search(r"\bchanges\b", needs.group(1)), name + " needs changes")
            cond = re.search(r"(?m)^    if:\s*(.+)$", body)
            self.assertTrue(cond and "needs.changes.outputs.code" in cond.group(1), name + " if")

    def test_pull_requests_run_ci_only_against_main(self):
        self.assertRegex(workflow(), r"(?m)^  pull_request:\n    branches: \[main\]\n")


if __name__ == "__main__":
    unittest.main()
