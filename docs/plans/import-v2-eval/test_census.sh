#!/usr/bin/env bash
# Test census (import v2 regroup, 2026-10-17). Evidence, not product.
# Runs tests/import.test.js and tests/app.test.js on a tree with the L1
# prototype applied and inlined, uncommitted, and prints each failing test's
# title with the counts. These are the tests L1 must supersede.
#   git apply docs/plans/import-v2-eval/l1-prototype.patch && python3 tools/inline_engine.py
#   bash docs/plans/import-v2-eval/test_census.sh > docs/plans/import-v2-eval/test_census.txt
#   git checkout src/engine/importer.js index.html
set -u
cd "$(dirname "$0")/../../.."
for f in tests/import.test.js tests/app.test.js; do
  out=$(node --test --test-reporter=tap "$f" 2>&1)
  echo "$f | $(printf '%s\n' "$out" | grep -E '^# (tests|pass|fail) ' | tr '\n' ' ')"
  printf '%s\n' "$out" | grep -E '^ *not ok [0-9]+ - ' | sed -E 's/^ *not ok [0-9]+ - /  FAIL: /'
done
