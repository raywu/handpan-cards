"""Render the editor case report already collected by validate."""
import json
from pathlib import Path
import sys


def main(path):
    print("## Editor browser cases")
    print()
    if not path.is_file():
        print("Harness failure. The JS results artifact is missing.")
        return
    results = json.loads(path.read_text())
    suite = results["files"].get("tests/editor_e2e.test.js", {})
    if not suite or suite.get("skipped_no_browser") or suite.get("total") is None:
        print("Harness failure. The editor browser suite did not complete.")
        return
    print("| Case | Expected visible outcome | Result |")
    print("| --- | --- | --- |")
    for case in suite.get("editor_cases", []):
        name = case["name"].replace("|", r"\|")
        print(f'| {case["id"]} | {name} | {case["status"].upper()} |')
    missing = suite.get("editor_required_without_pass", [])
    if missing:
        print()
        print("Required cases without a passing result: " + ", ".join(missing))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
