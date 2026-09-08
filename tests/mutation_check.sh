#!/usr/bin/env bash
# Every test group must have a mutant that kills it. A test nothing can kill is
# not a test. Each tests/mutants/*.patch carries a "# kills: <test>" header and
# must make its suite FAIL when applied.
#
# Suite selection, in order:
#   1. a "# suite: <command>" header line in the patch - always wins, so a new
#      mutant prefix needs no change to this script;
#   2. otherwise the filename prefix:
#      b_ deck data | c_ print+pdf | d_ app units | e_ e2e | r_ render agreement
#   3. otherwise the mutant is reported as a survivor (unknown suite).
#
# Reverting is driven by the patch itself (git apply -R plus a scoped
# checkout/clean of the paths it names), so a mutant against any file - engine
# module, fixture, app - is cleaned up without this script knowing the path.
set -uo pipefail
cd "$(dirname "$0")/.."

# .pyc invalidation keys on source mtime-in-SECONDS plus size, so a
# byte-length-neutral mutant applied and reverted inside one second leaves a
# stale .pyc holding the mutated module. Without this, a sweep can validate
# against data that is no longer on disk and report phantom results.
export PYTHONDONTWRITEBYTECODE=1
find . -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true

shopt -s nullglob
PATCHES=(tests/mutants/*.patch)
if [ ${#PATCHES[@]} -eq 0 ]; then
  echo "NO MUTANTS FOUND - the red-proof gate is empty."; exit 1
fi

# The paths a patch touches, one per line (both sides, so a patch that adds or
# deletes a file is covered too).
patch_paths() {
  sed -n -e 's:^+++ b/::p' -e 's:^--- a/::p' "$1" | grep -v '^/dev/null$' | sort -u
}

restore() {   # $@ = paths
  [ $# -eq 0 ] && return 0
  git checkout -- "$@" 2>/dev/null || true
  git clean -fdq -- "$@" 2>/dev/null || true
}

# A mutated suite can hang: a headless browser that never reports ready (seen
# once on a CI runner - the job burned 33 minutes and produced NO log, because
# an unfinished step's log is unreadable), or a loop the mutant made infinite.
# So every suite runs under a wall clock. A hang says nothing about the test, so
# a timed-out suite is retried ONCE; a second timeout is a hard error and never
# a "kill", which would let a hang masquerade as a live test.
SUITE_TIMEOUT=${MUTANT_TIMEOUT:-180}
TMO=()
command -v timeout >/dev/null 2>&1 && TMO=(timeout -k 5 "$SUITE_TIMEOUT")
run_suite() {   # $* = command string
  ${TMO[@]+"${TMO[@]}"} $* >/dev/null 2>&1
}

# Union of every path any mutant names: the dirty check and the interrupt
# cleanup both work off this, instead of a hardcoded file list.
ALLPATHS=()
while IFS= read -r line; do [ -n "$line" ] && ALLPATHS+=("$line"); done < <(
  for p in "${PATCHES[@]}"; do patch_paths "$p"; done | sort -u
)

# An interrupted sweep must never leave a mutant applied in the working tree.
trap 'restore "${ALLPATHS[@]}"' EXIT INT TERM

HAVE_BROWSER=$(node -e "process.stdout.write(String(require('./tests/helpers/cdp.js').findBrowser()))" 2>/dev/null)
if [ -n "$(git status --porcelain -- "${ALLPATHS[@]}")" ]; then
  echo "REFUSING: working tree already modifies files a mutant touches:"
  git status --porcelain -- "${ALLPATHS[@]}"
  echo "commit or stash first."
  exit 2
fi

# For the python suites the NAMED test is run (unittest -k), so a mutant that
# happens to be caught by some other test does not count: it must kill the one
# it claims to cover, or the guarantee that that test is live is silently void.
# The node suites still run whole - their test names contain spaces.
suite_for() {   # $1 = patch path, $2 = "# kills:" target (may be empty)
  local header
  header=$(grep -m1 '^# suite:' "$1" | sed 's/^# suite:[[:space:]]*//')
  if [ -n "$header" ]; then echo "$header"; return; fi
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

SURVIVORS=(); KILLED=0
for p in "${PATCHES[@]}"; do
  target=$(grep -m1 '^# kills:' "$p" | sed 's/^# kills:[[:space:]]*//')
  cmd=$(suite_for "$p" "$target")
  if [ -z "$cmd" ]; then
    echo "SKIP  $p (unknown suite prefix and no '# suite:' header)"
    SURVIVORS+=("$p (no suite)"); continue
  fi
  # A skipped suite exits 0, which would look identical to a surviving mutant.
  if [ "${p##*/}" != "${p##*/e_}" ] && { [ -z "$HAVE_BROWSER" ] || [ "$HAVE_BROWSER" = "null" ]; }; then
    echo "SKIP  $p (no browser; e2e mutants cannot be validated here)"; continue
  fi
  if ! git apply --check "$p" 2>/dev/null; then
    echo "STALE $p (does not apply)"; SURVIVORS+=("$p (stale)"); continue
  fi

  PATHS=(); while IFS= read -r line; do PATHS+=("$line"); done < <(patch_paths "$p")
  git apply "$p"
  run_suite "$cmd"; rc=$?
  if [ $rc -eq 124 ] || [ $rc -eq 137 ]; then
    echo "retry     $p  (suite hung for ${SUITE_TIMEOUT}s, retrying once)"
    run_suite "$cmd"; rc=$?
  fi
  if [ $rc -eq 0 ]; then
    echo "SURVIVED  $p  -> ${target:-?} did NOT fail"
    SURVIVORS+=("$p")
  elif [ $rc -eq 124 ] || [ $rc -eq 137 ]; then
    echo "TIMEOUT   $p  -> suite hung twice for ${SUITE_TIMEOUT}s: $cmd"
    SURVIVORS+=("$p (timed out)")
  else
    echo "killed    $p  -> ${target:-?}"
    KILLED=$((KILLED + 1))
  fi

  # Revert the mutant itself, then discard anything the suite WROTE while it was
  # applied - scoped to the paths this patch names, never the whole tree.
  git apply -R "$p" 2>/dev/null || true
  restore "${PATHS[@]}"
  if [ -n "$(git status --porcelain -- "${PATHS[@]}")" ]; then
    echo "DIRTY after $p - the sweep cannot continue on a contaminated tree:"
    git status --porcelain -- "${PATHS[@]}"
    exit 3
  fi
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
