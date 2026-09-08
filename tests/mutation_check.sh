#!/usr/bin/env bash
# Every test group must have a mutant that kills it. A test nothing can kill is
# not a test. Each tests/mutants/*.patch carries a "# kills: <test>" header and
# must make its suite FAIL when applied.
#
# Suite is chosen by filename prefix:
#   b_ deck data | c_ print+pdf | d_ app units | e_ e2e | r_ render agreement
set -uo pipefail
cd "$(dirname "$0")/.."

# .pyc invalidation keys on source mtime-in-SECONDS plus size, so a
# byte-length-neutral mutant applied and reverted inside one second leaves a
# stale .pyc holding the mutated module. Without this, a sweep can validate
# against data that is no longer on disk and report phantom results.
export PYTHONDONTWRITEBYTECODE=1
find . -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true

TRACKED="index.html tools/decks.py tools/hifi.py"
# An interrupted sweep must never leave a mutant applied in the working tree.
trap 'git checkout -- $TRACKED 2>/dev/null || true' EXIT INT TERM

HAVE_BROWSER=$(node -e "process.stdout.write(String(require('./tests/helpers/cdp.js').findBrowser()))" 2>/dev/null)
if ! git diff --quiet -- $TRACKED; then
  echo "REFUSING: working tree already modifies $TRACKED - commit or stash first."
  exit 2
fi

# For the python suites the NAMED test is run (unittest -k), so a mutant that
# happens to be caught by some other test does not count: it must kill the one
# it claims to cover, or the guarantee that that test is live is silently void.
# The node suites still run whole - their test names contain spaces.
suite_for() {   # $1 = patch path, $2 = "# kills:" target (may be empty)
  local k=""
  [ -n "$2" ] && k="-k $2"
  case "$(basename "$1")" in
    b_*) echo "python3 -m unittest $k tests.test_deck_data" ;;
    c_*) echo "python3 -m unittest $k tests.test_print tests.test_pdf_build" ;;
    d_*) echo "node --test tests/app.test.js" ;;
    e_*) echo "node --test tests/e2e.test.js" ;;
    r_*) echo "python3 -m unittest $k tests.test_render_agreement" ;;
    *)   echo "" ;;
  esac
}

shopt -s nullglob
PATCHES=(tests/mutants/*.patch)
if [ ${#PATCHES[@]} -eq 0 ]; then
  echo "NO MUTANTS FOUND - the red-proof gate is empty."; exit 1
fi

SURVIVORS=(); KILLED=0
for p in "${PATCHES[@]}"; do
  target=$(grep -m1 '^# kills:' "$p" | sed 's/^# kills:[[:space:]]*//')
  cmd=$(suite_for "$p" "$target")
  if [ -z "$cmd" ]; then
    echo "SKIP  $p (unknown suite prefix)"; SURVIVORS+=("$p (no suite)"); continue
  fi
  # A skipped suite exits 0, which would look identical to a surviving mutant.
  if [ "${p##*/}" != "${p##*/e_}" ] && { [ -z "$HAVE_BROWSER" ] || [ "$HAVE_BROWSER" = "null" ]; }; then
    echo "SKIP  $p (no browser; e2e mutants cannot be validated here)"; continue
  fi
  if ! git apply --check "$p" 2>/dev/null; then
    echo "STALE $p (does not apply)"; SURVIVORS+=("$p (stale)"); continue
  fi
  git apply "$p"
  if $cmd >/dev/null 2>&1; then
    echo "SURVIVED  $p  -> ${target:-?} did NOT fail"
    SURVIVORS+=("$p")
  else
    echo "killed    $p  -> ${target:-?}"
    KILLED=$((KILLED + 1))
  fi
  git checkout -- $TRACKED
  find . -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true
done

echo
echo "$KILLED/${#PATCHES[@]} mutants killed"
if [ ${#SURVIVORS[@]} -ne 0 ]; then
  printf 'SURVIVING MUTANT: %s\n' "${SURVIVORS[@]}"
  echo "A surviving mutant means the named test cannot detect the defect it claims to cover."
  exit 1
fi
echo "MUTATION GATE PASSED"
