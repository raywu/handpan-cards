import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))

from ci_scope import code_changed, load_corpus, mutant_coverage, select  # noqa: E402


def workflow():
    with open(os.path.join(ROOT, ".github", "workflows", "validate.yml"), encoding="utf-8") as f:
        return f.read()


def jobs():
    text = workflow()
    body = text.split("\njobs:\n", 1)[1]
    parts = re.split(r"(?m)^  ([A-Za-z_][A-Za-z0-9_-]*):\s*$", body)
    return {parts[i]: parts[i + 1] for i in range(1, len(parts), 2)}


class CiScopeTest(unittest.TestCase):
    def test_a_plans_or_prompts_only_change_skips_ci(self):
        self.assertFalse(code_changed(["docs/plans/a.md", "docs/prompts/b.md"]))

    def test_every_doc_a_test_reads_runs_ci(self):
        for path in ("README.md", "CLAUDE.md", "docs/ENGINE-SPEC.md", "docs/CARD-SPEC.md"):
            self.assertTrue(code_changed([path]), path)
        self.assertTrue(code_changed(["docs/plans/a.md", "index.html"]))

    def test_an_empty_change_list_runs_ci(self):
        self.assertTrue(code_changed([]))
        self.assertTrue(code_changed(["", "\n"]))

    def test_every_job_but_changes_waits_for_the_doc_only_verdict(self):
        all_jobs = jobs()
        self.assertIn("changes", all_jobs)
        scope = all_jobs["changes"]
        self.assertIn("git diff --no-renames --name-only HEAD^1 HEAD", scope)
        self.assertIn('[ "$EVENT_NAME" = "push" ]', scope)
        plain = "needs.changes.outputs.code == 'true'"
        aggregate = "always() && needs.changes.outputs.code != 'false'"
        want = {"data": plain, "python-tests": plain, "js-tests": plain, "mutation-gate-shard": plain,
                "panel-fit": plain, "suite-health": aggregate, "mutation-gate": aggregate}
        self.assertEqual(sorted(want), sorted(n for n in all_jobs if n != "changes"))
        for name, body in all_jobs.items():
            if name == "changes":
                continue
            needs = re.search(r"(?m)^    needs:\s*(.+)$", body)
            self.assertTrue(needs and re.search(r"\bchanges\b", needs.group(1)), name + " needs changes")
            cond = re.search(r"(?m)^    if:\s*(.+)$", body)
            self.assertTrue(cond and cond.group(1).strip() == want[name], name + " if")

    def test_pull_requests_run_ci_only_against_main(self):
        self.assertRegex(workflow(), r"(?m)^  pull_request:\n    branches: \[main\]\n")


CORPUS = load_corpus(os.path.join(ROOT, "tests", "mutants"))


def diff_of(path, added=(), removed=()):
    body = "".join("-%s\n" % line for line in removed) + "".join("+%s\n" % line for line in added)
    return "diff --git a/%s b/%s\n--- a/%s\n+++ b/%s\n@@ -1,1 +1,1 @@\n%s" % (path, path, path, path, body)


def pick(changed, added=(), removed=(), event="pull_request", head_ref="claude/some-lane"):
    diff = "".join(diff_of(p, added, removed) for p in changed)
    return select(changed, diff, event, head_ref, CORPUS)


def targeting(path):
    return {n for n, c in CORPUS.items() if path in c["targets"]}


class ScopedSelectionTest(unittest.TestCase):
    def test_an_app_only_css_change_is_scoped_to_the_index_html_mutants(self):
        mode, names = pick(["index.html"], added=["  .card { color: red; }"])
        self.assertEqual(mode, "scoped")
        self.assertTrue(names)
        self.assertTrue(set(names) >= targeting("index.html"))
        self.assertFalse(set(names) & targeting("tools/hifi.py"))
        self.assertLess(len(names), len(CORPUS))

    def test_a_push_runs_full_whatever_the_diff(self):
        self.assertEqual(pick(["index.html"], added=["  .card { color: red; }"], event="push")[0], "full")

    def test_a_hifi_change_selects_its_mutants_and_none_of_the_share_engine(self):
        mode, names = pick(["tools/hifi.py"], added=["x = 1"])
        self.assertEqual(mode, "scoped")
        self.assertTrue(set(names) >= targeting("tools/hifi.py"))
        self.assertFalse(set(names) & targeting("src/engine/share.js"))

    def test_a_changed_test_file_selects_every_mutant_whose_suite_names_it(self):
        for event_path in ("tests/test_print.py", "tests/pdfcards.test.js"):
            mode, names = pick([event_path], added=["# note"])
            self.assertEqual(mode, "scoped", event_path)
            want = {n for n, c in CORPUS.items() if event_path in c["covers"]}
            self.assertTrue(want, event_path)
            self.assertTrue(set(names) >= want, event_path)

    def test_a_deleted_test_file_still_selects_its_mutants(self):
        diff = "diff --git a/tests/test_print.py b/tests/test_print.py\ndeleted file mode 100644\n--- a/tests/test_print.py\n+++ /dev/null\n@@ -1 +0,0 @@\n-x\n"
        mode, names = select(["tests/test_print.py"], diff, "pull_request", "claude/a", CORPUS)
        self.assertEqual(mode, "scoped")
        self.assertTrue(set(names) >= {n for n, c in CORPUS.items() if "tests/test_print.py" in c["covers"]})

    def test_a_changed_mutant_selects_itself(self):
        name = next(n for n in sorted(CORPUS) if n.startswith("ao_"))
        mode, names = pick(["tests/mutants/" + name], added=["# x"])
        self.assertEqual(mode, "scoped")
        self.assertIn(name, names)

    def test_every_mutant_maps_to_a_target_file(self):
        for name, cov in CORPUS.items():
            self.assertTrue(cov["targets"], name + " has no +++ b/ target")
            self.assertIn("tests/mutants/" + name, cov["covers"])

    def test_coverage_reads_targets_dotted_modules_and_paths(self):
        text = (
            "# suite: python3 -m unittest -k t tests.test_print\n"
            "--- a/x.py\n+++ b/tools/hifi.py\n@@ -1 +1 @@\n-a\n+b\n"
        )
        cov = mutant_coverage("m.patch", text)
        self.assertEqual(cov["targets"], {"tools/hifi.py"})
        self.assertEqual(cov["covers"], {"tools/hifi.py", "tests/test_print.py", "tests/mutants/m.patch"})
        node = mutant_coverage("n.patch", "# suite: node --test tests/app.test.js\n+++ b/index.html\n")
        self.assertIn("tests/app.test.js", node["covers"])


class FullTriggerTest(unittest.TestCase):
    def assertFull(self, changed, added=(), head_ref="claude/some-lane", event="pull_request"):
        self.assertEqual(pick(changed, added=added, head_ref=head_ref, event=event)[0], "full", changed)

    def test_scale_data_runs_full(self):
        for path in ("data/decks.json", "tools/sync_decks.py", "tools/decks.py", "tests/test_deck_data.py",
                     "tests/mutants/b_picker_order_swapped.patch", "tests/mutants/c_card_width.patch"):
            self.assertFull([path], added=["x"])

    def test_the_scale_engine_runs_full(self):
        for path in ("src/engine/share.js", "tools/inline_engine.py", "tests/fixtures/engine_corpus_v1.json",
                     "tools/regen_engine_corpus.js", "tests/mutants/fps_decode_skips_floor.patch"):
            self.assertFull([path], added=["x"])

    def test_saved_scales_run_full_by_path(self):
        for path in ("tests/storage_corpus.test.js", "tests/link_corpus.test.js", "tests/share.test.js",
                     "tests/fixtures/shipped_client_c6ef6b58.html.txt", "tools/probe/saved_variants_storage.js",
                     "qa-seed.html", "tests/mutants/sv_migration_replayed_on_reload.patch"):
            self.assertFull([path], added=["x"])

    def test_saved_scales_run_full_by_content(self):
        self.assertFull(["index.html"], added=["  localStorage.setItem(k, v);"])
        self.assertFull(["tests/e2e.test.js"], added=["  await page.evaluate(() => indexedDB.open('x'));"])
        self.assertFull(["tests/test_print.py"], added=["    # moves the saved list"])

    def test_a_css_only_hunk_is_not_a_saved_scale_change(self):
        self.assertEqual(pick(["index.html"], added=["  .rim { stroke: #333; }"])[0], "scoped")

    def test_every_harness_path_runs_full(self):
        for path in ("tests/mutation_check.sh", "tests/shard_mutants.js", "tools/ci_scope.py", "tools/refresh_mutants.py",
                     "tools/regen_data_mutants.py", ".github/workflows/validate.yml", "tests/helpers/cdp.js",
                     "tools/sandbox.js", "requirements-ci.txt", "package.json", "package-lock.json"):
            self.assertFull([path], added=["x"])

    def test_a_release_branch_runs_full(self):
        for ref in ("claude/release-rc-2026-11-10", "claude/release-nits", "claude/release-move-x"):
            self.assertFull(["tools/hifi.py"], added=["x"], head_ref=ref)

    def test_an_unmappable_path_runs_full(self):
        self.assertFull(["foo/bar.txt"], added=["x"])

    def test_an_empty_or_missing_diff_runs_full(self):
        self.assertEqual(select([], "", "pull_request", "claude/a", CORPUS)[0], "full")
        self.assertEqual(select(["tools/hifi.py"], "", "pull_request", "claude/a", CORPUS)[0], "full")

    def test_an_empty_selection_runs_full(self):
        lone = {"only.patch": {"targets": {"a.py"}, "covers": {"a.py", "tests/mutants/only.patch"}}}
        self.assertEqual(select(["tools/hifi.py"], diff_of("tools/hifi.py", ["x"]), "pull_request", "claude/a", lone)[0], "full")

    def test_a_docs_only_plan_change_is_not_a_mutation_run(self):
        self.assertFalse(code_changed(["docs/plans/x.md"]))


class WorkflowWiringTest(unittest.TestCase):
    def test_e2e_is_never_scoped(self):
        self.assertNotIn("mode", jobs()["js-tests"])

    def test_shards_pass_the_selection_only_in_scoped_mode(self):
        shard = jobs()["mutation-gate-shard"]
        self.assertIn("needs.changes.outputs.mode == 'scoped'", shard)
        self.assertIn("MUTANT_LIST", shard)
        self.assertIn("mutant-selection", shard)

    def test_the_union_check_reads_the_selection_in_scoped_mode(self):
        gate = jobs()["mutation-gate"]
        self.assertIn("needs.changes.outputs.mode", gate)
        self.assertIn("mutant-selection", gate)

    def test_ref_and_event_reach_the_script_through_env_never_run(self):
        scope = jobs()["changes"]
        self.assertRegex(scope, r"(?m)^\s+HEAD_REF: \$\{\{ github\.head_ref \}\}$")
        self.assertRegex(scope, r"(?m)^\s+EVENT_NAME: \$\{\{ github\.event_name \}\}$")
        run = scope.split("run: |", 1)[1]
        self.assertNotIn("github.head_ref", run)

    def test_a_push_forces_full(self):
        scope = jobs()["changes"]
        self.assertIn("mode=full", scope)


CHECK_PY = (
    "import os, sys\n"
    "if os.environ.get('MUTANT_LIST'):\n"
    "    sys.exit(7)\n"
    "sys.exit(0 if open('subject.txt').read() == 'ok\\n' else 1)\n"
)


class MutantListSweepTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="scopedmut-")
        self.addCleanup(shutil.rmtree, self.dir, True)
        os.makedirs(os.path.join(self.dir, "tests", "mutants"))
        self.write("subject.txt", "ok\n")
        self.write("check.py", CHECK_PY)
        for rel in ("mutation_check.sh", "shard_mutants.js"):
            shutil.copy(os.path.join(ROOT, "tests", rel), os.path.join(self.dir, "tests", rel))
        self.git("init", "-q")
        self.git("config", "user.email", "f@example.invalid")
        self.git("config", "user.name", "F")
        self.git("config", "commit.gpgsign", "false")
        self.git("add", ".")
        self.git("commit", "-qm", "base")
        self.write("subject.txt", "bad\n")
        body = self.git("diff", "--", "subject.txt")
        self.git("checkout", "--", "subject.txt")
        self.names = ["a_one.patch", "b_two.patch", "c_three.patch"]
        for name in self.names:
            self.write("tests/mutants/" + name, "# kills: subject stays ok\n# suite: python3 check.py\n" + body)
        self.git("add", ".")
        self.git("commit", "-qm", "mutants")

    def write(self, rel, text):
        with open(os.path.join(self.dir, rel), "w", encoding="utf-8") as f:
            f.write(text)

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.dir, check=True, capture_output=True, text=True).stdout

    def sweep(self, **env):
        full = {k: v for k, v in os.environ.items() if not k.startswith("MUTANT_")}
        full.update(env, MUTANT_TIMEOUT="60")
        r = subprocess.run(["bash", "tests/mutation_check.sh"], cwd=self.dir, env=full, capture_output=True, text=True, timeout=120)
        return r.returncode, r.stdout + r.stderr

    def report(self, name):
        with open(os.path.join(self.dir, name), encoding="utf-8") as f:
            return [line for line in f.read().split("\n") if line]

    def selection(self, *names):
        self.write("selection.txt", "".join(n + "\n" for n in names))
        return os.path.join(self.dir, "selection.txt")

    def test_a_one_mutant_selection_across_four_shards_reports_exactly_the_selection(self):
        sel = self.selection("b_two.patch")
        seen = []
        for i in range(1, 5):
            code, out = self.sweep(MUTANT_SHARD="%d/4" % i, MUTANT_LIST=sel, MUTANT_REPORT=os.path.join(self.dir, "r%d.txt" % i))
            self.assertEqual(code, 0, out)
            seen += self.report("r%d.txt" % i)
        self.assertEqual(seen, ["b_two.patch"])

    def test_an_empty_shard_report_is_a_truly_empty_file(self):
        sel = self.selection("b_two.patch")
        for i in range(1, 5):
            self.sweep(MUTANT_SHARD="%d/4" % i, MUTANT_LIST=sel, MUTANT_REPORT=os.path.join(self.dir, "r%d.txt" % i))
        sizes = [os.path.getsize(os.path.join(self.dir, "r%d.txt" % i)) for i in range(1, 5)]
        self.assertEqual(sorted(sizes)[:3], [0, 0, 0])

    def test_without_a_shard_the_list_restricts_the_whole_corpus(self):
        code, out = self.sweep(MUTANT_LIST=self.selection("c_three.patch"))
        self.assertEqual(code, 0, out)
        self.assertIn("c_three.patch killed", out)
        self.assertNotIn("a_one.patch", out)
        self.assertNotIn("b_two.patch", out)

    def test_a_listed_name_missing_from_the_corpus_exits_1(self):
        code, out = self.sweep(MUTANT_LIST=self.selection("b_two.patch", "gone.patch"))
        self.assertEqual(code, 1, out)
        self.assertIn("gone.patch", out)

    def test_an_empty_list_file_exits_1(self):
        code, out = self.sweep(MUTANT_LIST=self.selection())
        self.assertEqual(code, 1, out)

    def test_a_shard_with_no_list_that_selects_zero_still_exits_1(self):
        code, out = self.sweep(MUTANT_SHARD="4/4", MUTANT_REPORT=os.path.join(self.dir, "r.txt"))
        self.assertEqual(code, 1, out)

    def test_nested_runs_do_not_inherit_the_list(self):
        code, out = self.sweep(MUTANT_LIST=self.selection("a_one.patch"))
        self.assertEqual(code, 0, out)
        self.assertIn("a_one.patch killed", out)


if __name__ == "__main__":
    unittest.main()
