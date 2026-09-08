#!/usr/bin/env bash
# Run every suite. Usage: ./tests/run.sh [python|node|mutants]
set -uo pipefail
cd "$(dirname "$0")/.."
FAIL=0
run() { echo; echo "=== $1 ==="; shift; "$@" || FAIL=1; }

# node --test treats a directory with no matching files as a module path, so
# expand explicitly and skip cleanly when a suite has not landed yet.
node_suites() {
  shopt -s nullglob
  local files=(tests/*.test.js)
  if [ ${#files[@]} -eq 0 ]; then echo "(no *.test.js yet - skipping)"; return 0; fi
  node --test "${files[@]}"
}

case "${1:-all}" in
  python)  run "python" python3 -m unittest discover -s tests -t . -v ;;
  node)    run "node"   node_suites ;;
  mutants) run "mutants" ./tests/mutation_check.sh ;;
  all)
    run "data integrity (validate.py)" python3 tools/validate.py
    run "boot simulation"              node tools/boot_sim.js
    run "python suites"                python3 -m unittest discover -s tests -t . -v
    run "node suites"                  node_suites
    ;;
  *) echo "usage: $0 [all|python|node|mutants]"; exit 2 ;;
esac

echo
[ $FAIL -eq 0 ] && echo "ALL GREEN" || echo "FAILURES ABOVE"
exit $FAIL
