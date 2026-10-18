#!/usr/bin/env bash
# Mutant census (import v2 regroup, 2026-10-17). Evidence, not product.
# For every importer mutant (tests/mutants/i_*.patch and ib_*.patch, e2e ones
# skipped) on a tree with the L1 prototype applied and inlined, uncommitted:
# whether it still applies, whether its own suite is green with no mutant, and
# whether the suite fails with it. A "kill" on a red baseline is no kill.
# Unlike tests/mutation_check.sh it never restores the tree, so the prototype
# survives the sweep; it reverts each mutant with git apply -R.
#   git apply docs/plans/import-v2-eval/l1-prototype.patch && python3 tools/inline_engine.py
#   bash docs/plans/import-v2-eval/mutant_census.sh > docs/plans/import-v2-eval/mutant_census.txt
#   git checkout src/engine/importer.js index.html
set -u
cd "$(dirname "$0")/../../.."
for p in tests/mutants/i_*.patch tests/mutants/ib_*.patch; do
  cmd=$(sed -n 's/^# suite: //p' "$p" | head -1)
  case "$cmd" in *e2e.test.js*) echo "$(basename "$p") | skipped (e2e)"; continue ;; esac
  if ! git apply --check "$p" 2>/dev/null; then echo "$(basename "$p") | stale (does not apply)"; continue; fi
  $cmd >/dev/null 2>&1; base=$?
  git apply "$p"
  $cmd >/dev/null 2>&1; rc=$?
  git apply -R "$p"
  if [ $base -ne 0 ]; then verdict="baseline red (rc $base): no kill"
  elif [ $rc -ne 0 ]; then verdict="killed"
  else verdict="SURVIVED"; fi
  echo "$(basename "$p") | $verdict"
done
