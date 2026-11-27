"""Run named browser cases against the exact published Balanced editor HTML."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tests import suite_health

PREVIEW_URL = "https://claude-rc-upgrade.handpan-cards-dev.pages.dev/editor-balanced-mock"

RC_REQUIRED = suite_health.EDITOR_REQUIRED | {
    "EDITOR-RC-STANDARD-GROW",
    "EDITOR-RC-CYCLOPS-SNAP",
    "EDITOR-RC-GUIDED-SAVE",
    "EDITOR-RC-NEOTONE-SAVE",
    "EDITOR-RC-DUPLICATE",
    "EDITOR-RC-DUPLICATE-REDUCED",
}


def served_digest():
    response = subprocess.run(
        ["curl", "--fail", "--silent", "--show-error", "--max-time", "10",
         "--header", "Cache-Control: no-cache", PREVIEW_URL],
        check=True, stdout=subprocess.PIPE,
    )
    return hashlib.sha256(response.stdout).hexdigest()


def run(expected, artifacts, wait):
    expected_digest = hashlib.sha256(expected.read_bytes()).hexdigest()
    report = {"url": PREVIEW_URL, "expected_sha256": expected_digest, "editor_cases": []}
    artifacts.mkdir(parents=True, exist_ok=True)
    try:
        deadline = time.monotonic() + wait
        while True:
            try:
                if served_digest() == expected_digest:
                    break
                readiness = "served HTML did not match the publisher output"
            except subprocess.CalledProcessError as exc:
                readiness = f"preview fetch exited {exc.returncode}"
            if time.monotonic() >= deadline:
                raise ValueError(f"The editor preview did not serve the expected revision ({readiness}).")
            time.sleep(min(5, max(0, deadline - time.monotonic())))
        os.environ["HPC_EDITOR_HOSTED_URL"] = PREVIEW_URL
        total, failed, skipped, cancelled, code, output = suite_health.run_node_file(
            suite_health.EDITOR_E2E, name_pattern="EDITOR-"
        )
        (artifacts / "editor-rc.tap").write_text(output)
        cases = suite_health.editor_cases(output)
        report.update(editor_cases=cases, total=total, failed=failed, skipped=skipped,
                      cancelled=cancelled, returncode=code)
        report["editor_required_without_pass"] = suite_health.editor_case_problems(cases, RC_REQUIRED)
        if served_digest() != expected_digest:
            raise ValueError("The editor preview revision changed while its tests ran.")
        return bool(not total or failed or skipped or cancelled or code
                    or report["editor_required_without_pass"])
    except (OSError, subprocess.CalledProcessError, ValueError) as exc:
        report["harness_error"] = str(exc)
        print(exc, file=sys.stderr)
        return True
    finally:
        (artifacts / "editor-rc.json").write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("expected_html", type=Path, help="HTML from the publisher revision")
    parser.add_argument("artifacts", type=Path)
    parser.add_argument("--wait", type=int, default=180)
    args = parser.parse_args()
    sys.exit(run(args.expected_html, args.artifacts, args.wait))
