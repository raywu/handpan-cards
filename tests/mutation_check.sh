#!/usr/bin/env bash
# Every test group must have a mutant that kills it. A test nothing can kill is
# not a test. Each tests/mutants/*.patch carries a "# kills: <test>" header and
# must make its suite FAIL when applied.
#
# Suite selection: a "# suite: <command>" header line in the patch, and nothing
# else. There is no filename-prefix fallback - a patch without a header is
# refused (see suite_for below for why). The header should NAME the test the
# "# kills:" line claims, not just its file: `-k <test>` for python, and
# `--test-name-pattern <regex>` for node (no spaces - the command is
# word-split, so write the test name with '.' for every space).
#
# Reverting is driven by the patch itself (git apply -R plus a scoped
# checkout/clean of the paths it names), so a mutant against any file - engine
# module, fixture, app - is cleaned up without this script knowing the path.
#
# Per-mutant result lines are machine-readable: the first two whitespace fields
# are "<basename> killed|survived|timeout|stale|skipped|broken". Downstream
# greps depend on that shape - keep it.
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

# git checkout aborts the WHOLE invocation when any pathspec is unknown to HEAD,
# so an add-file mutant would otherwise make the restore a no-op for every other
# path. Restore one path at a time, and only checkout paths HEAD actually has.
restore() {   # $@ = paths
  [ $# -eq 0 ] && return 0
  local path
  for path in "$@"; do
    if git ls-files --error-unmatch -- "$path" >/dev/null 2>&1; then
      git checkout -- "$path" 2>/dev/null || true
    fi
    git clean -fdq -- "$path" 2>/dev/null || true
  done
}

# A mutated suite can hang: a headless browser that never reports ready (seen
# once on a CI runner - the job burned 33 minutes and produced NO log, because
# an unfinished step's log is unreadable), or a loop the mutant made infinite.
# So every suite runs under a wall clock. A hang says nothing about the test, so
# a timed-out suite is retried ONCE; a second timeout is a hard error and never
# a "kill", which would let a hang masquerade as a live test.
SUITE_TIMEOUT=${MUTANT_TIMEOUT:-180}
TMO=()
if command -v timeout >/dev/null 2>&1; then
  TMO=(timeout -k 5 "$SUITE_TIMEOUT")
else
  echo "note: no 'timeout' binary (stock macOS) - suites run UNBOUNDED here; CI has one."
fi
# Suite output is ALWAYS captured and only SOMETIMES printed. A per-mutant run
# is red on purpose, so reprinting 219 of those buries the log; the one run
# whose output is pure signal is a BASELINE that failed - the clean tree, no
# mutant applied - which used to abort the sweep quoting nothing but a return
# code. Three unexplainable main-is-red incidents in a day came from exactly
# that. The log is overwritten per run, and only ever read on the abort path,
# which happens immediately after the run that produced it.
SUITE_LOG=$(mktemp -t mutation_suite_log.XXXXXX)
trap 'rm -f "$SUITE_LOG"' EXIT
run_suite() {   # $* = command string, deliberately word-split
  ${TMO[@]+"${TMO[@]}"} $* >"$SUITE_LOG" 2>&1
}

# Both ends of a long stream: the first failure says what broke, the tail says
# how much. Matches the excerpt() bound in tests/suite_health.py.
print_suite_log() {
  local n
  n=$(wc -c <"$SUITE_LOG" | tr -d ' ')
  if [ "$n" -le 4000 ]; then
    cat "$SUITE_LOG"
  else
    head -c 2000 "$SUITE_LOG"
    printf '\n... [%s characters elided] ...\n' "$((n - 4000))"
    tail -c 2000 "$SUITE_LOG"
  fi
  echo
}

# Union of every path any mutant names: the dirty check and the interrupt
# cleanup both work off this, instead of a hardcoded file list.
ALLPATHS=()
while IFS= read -r line; do [ -n "$line" ] && ALLPATHS+=("$line"); done < <(
  for p in "${PATCHES[@]}"; do patch_paths "$p"; done | sort -u
)

# The dirty check runs BEFORE any cleanup trap is installed: refusing must never
# be able to git-checkout or git-clean away work the user has not committed.
if [ -n "$(git status --porcelain -- ${ALLPATHS[@]+"${ALLPATHS[@]}"})" ]; then
  echo "REFUSING: working tree already modifies files a mutant touches:"
  git status --porcelain -- ${ALLPATHS[@]+"${ALLPATHS[@]}"}
  echo "commit or stash first."
  exit 2
fi

# From here the tree is known clean at those paths, so restoring them can only
# throw away what this script itself applied. An interrupted sweep must never
# leave a mutant in the working tree.
trap 'restore ${ALLPATHS[@]+"${ALLPATHS[@]}"}; rm -f "$SUITE_LOG"' EXIT TERM
trap 'restore ${ALLPATHS[@]+"${ALLPATHS[@]}"}; rm -f "$SUITE_LOG"; exit 130' INT

HAVE_BROWSER=$(node -e "process.stdout.write(String(require('./tests/helpers/cdp.js').findBrowser()))" 2>/dev/null)

# The command a mutant is judged by comes from its own "# suite:" header and
# from NOWHERE ELSE. There used to be a fallback keyed on the filename prefix
# (b_/c_/d_/e_/r_), and for the two node prefixes the command it produced was
# the WHOLE suite file - so the verdict rested on that file's exit code alone
# and never on the test the patch claims to kill. A mutant that happened to
# break some unrelated test in the same file was recorded "killed" while
# proving nothing about its own assertion (queue row 263).
#
# Guessing cannot be made safe, so it is gone: a patch with no header is
# REFUSED. That is the same shape as the clean-tree baseline abort (rows
# 187/173) - an unearned green is worse than a loud stop - and it makes the
# invariant structural rather than a property of today's corpus: the next
# header-less patch is refused on the day it is written, not audited for later.
#
# A header should also NAME the test, not just the file: `-k <test>` for the
# python suites, `--test-name-pattern <regex>` for the node ones. The script
# cannot enforce that (a header is an opaque command string) but every mutant
# added since row 263 does it, and a whole-file header is a review finding.
suite_for() {   # $1 = patch path
  grep -m1 '^# suite:' "$1" | sed 's/^# suite:[[:space:]]*//'
}

# A suite is only evidence if it is GREEN before the mutant is applied and RED
# after. A command that is red (or missing, or a typo: 126/127) on the clean tree
# "kills" every mutant pointed at it while testing nothing.
#
# EVERY command the sweep uses is baselined here, without exception. When this
# script still had built-in prefix commands, trusting those because "CI runs
# them green in its own steps" was the defect: CI's
# environment is not this one, and a single environmental difference (a pinned
# E2E_PORT that is already taken makes the e2e server fail to listen, fast and
# silently) turns a whole family of suites red, whereupon every mutant pointed
# at one is recorded "killed" and the sweep reports a green it has not earned.
#
# A baseline that is not green is therefore a HARD ABORT, never a per-mutant
# verdict: a red suite must not be able to manufacture a "killed". Baselines run
# on the clean tree (before any patch is applied), once per distinct command,
# cached.
#
# Cost note: now that headers name individual tests, nearly every mutant has its
# own distinct command, so the cache saves much less than it did and the sweep
# runs roughly one extra clean-tree run per mutant. That reads like a cost and
# is the opposite: a targeted command runs ONE test where a whole-file command
# runs the file, and one extra run of one test is far cheaper than one run of a
# whole suite. Measured on CI: 233 mutants in 391s with targeted headers against
# ~1030s for 232 the day before, a 2.7x speedup. Per mutant the marginal cost of
# a new targeted e_ mutant is ~3.6s where a file-only one is ~33s. So a header
# that names its test is the CHEAP option as well as the honest one, and a
# whole-file header costs the sweep an order of magnitude for a verdict that is
# not about the named test.
BASELINE_CMDS=(); BASELINE_RCS=(); BASELINE_RC=0
baseline_ok() {   # $1 = command string -> 0 green, 1 not; sets BASELINE_RC
  local i
  for i in "${!BASELINE_CMDS[@]}"; do
    if [ "${BASELINE_CMDS[$i]}" = "$1" ]; then
      BASELINE_RC="${BASELINE_RCS[$i]}"
      [ "$BASELINE_RC" -eq 0 ]; return
    fi
  done
  # Queue row 191, sighted live in row 195: a mutant run that hangs is retried
  # once (below), but a BASELINE that hung was treated as "not green" and
  # aborted the entire sweep - so one slow clean-tree run threw away every
  # verdict, including the 200-odd mutants whose suites were fine. A timeout is
  # not a red: it is an absence of evidence either way, and the per-mutant path
  # already says so. Mirror it here. A second timeout still falls through to the
  # abort, which is correct - a suite that cannot finish twice on the clean tree
  # genuinely is unusable as evidence in this environment.
  run_suite "$1"; BASELINE_RC=$?
  if [ "$BASELINE_RC" -eq 124 ] || [ "$BASELINE_RC" -eq 137 ]; then
    echo "note: baseline hung for ${SUITE_TIMEOUT}s, retrying once: $1"
    run_suite "$1"; BASELINE_RC=$?
  fi
  BASELINE_CMDS+=("$1"); BASELINE_RCS+=("$BASELINE_RC")
  [ "$BASELINE_RC" -eq 0 ]
}

SURVIVORS=(); KILLED=0; SKIPPED=0
for p in "${PATCHES[@]}"; do
  base="${p##*/}"
  target=$(grep -m1 '^# kills:' "$p" | sed 's/^# kills:[[:space:]]*//')
  cmd=$(suite_for "$p")
  if [ -z "$cmd" ]; then
    echo "$base broken    -> no '# suite:' header, so there is no command that could prove ${target:-?} dies"
    SURVIVORS+=("$p (no '# suite:' header)"); continue
  fi
  # A skipped suite exits 0, which would look identical to a surviving mutant.
  case "$base" in
    e_*)
      if [ -z "$HAVE_BROWSER" ] || [ "$HAVE_BROWSER" = "null" ]; then
        echo "$base skipped  (no browser; e2e mutants cannot be validated here)"
        SKIPPED=$((SKIPPED + 1)); continue
      fi ;;
  esac
  if ! git apply --check "$p" 2>/dev/null; then
    echo "$base stale     (does not apply)"; SURVIVORS+=("$p (stale)"); continue
  fi
  if ! baseline_ok "$cmd"; then
    echo
    echo "ABORTING - BASELINE NOT GREEN. The suite for $base fails on the CLEAN"
    echo "tree (rc $BASELINE_RC), with no mutant applied:"
    echo "    $cmd"
    echo
    echo "--- what that suite actually said (bounded excerpt) ---"
    print_suite_log
    echo "--- end of suite output ---"
    echo
    echo "Every mutant pointed at that command would be recorded 'killed' while"
    echo "testing nothing, and the sweep would report a green it has not earned."
    echo "Fix the suite, or the environment it runs in - most often a pinned,"
    echo "already-taken E2E_PORT: unset it and the e2e server binds a free"
    echo "ephemeral port - then re-run the sweep."
    exit 4
  fi

  PATHS=(); while IFS= read -r line; do PATHS+=("$line"); done < <(patch_paths "$p")
  git apply "$p"
  run_suite "$cmd"; rc=$?
  if [ $rc -eq 124 ] || [ $rc -eq 137 ]; then
    echo "$base retry     (suite hung for ${SUITE_TIMEOUT}s, retrying once)"
    run_suite "$cmd"; rc=$?
  fi
  if [ $rc -eq 0 ]; then
    echo "$base survived  -> ${target:-?} did NOT fail"
    SURVIVORS+=("$p")
  elif [ $rc -eq 124 ] || [ $rc -eq 137 ]; then
    echo "$base timeout   -> suite hung twice for ${SUITE_TIMEOUT}s: $cmd"
    SURVIVORS+=("$p (timed out)")
  elif [ $rc -eq 126 ] || [ $rc -eq 127 ]; then
    # Not a test failure: the command could not be run at all.
    echo "$base broken    -> command not executable (rc $rc): $cmd"
    SURVIVORS+=("$p (command not runnable)")
  else
    echo "$base killed    -> ${target:-?}"
    KILLED=$((KILLED + 1))
  fi

  # Revert the mutant itself, then discard anything the suite WROTE while it was
  # applied - scoped to the paths this patch names, never the whole tree.
  git apply -R "$p" 2>/dev/null || true
  restore ${PATHS[@]+"${PATHS[@]}"}
  if [ -n "$(git status --porcelain -- ${PATHS[@]+"${PATHS[@]}"})" ]; then
    echo "DIRTY after $p - the sweep cannot continue on a contaminated tree:"
    git status --porcelain -- ${PATHS[@]+"${PATHS[@]}"}
    exit 3
  fi
  find . -name __pycache__ -type d -prune -exec rm -rf {} + 2>/dev/null || true
done

echo
echo "$KILLED/${#PATCHES[@]} mutants killed"
[ "$SKIPPED" -ne 0 ] && echo "$SKIPPED/${#PATCHES[@]} mutants NOT EVALUATED (skipped)"
if [ ${#SURVIVORS[@]} -ne 0 ]; then
  printf 'SURVIVING MUTANT: %s\n' "${SURVIVORS[@]}"
  echo "A surviving mutant means the named test cannot detect the defect it claims to cover."
  exit 1
fi
# A partial sweep is not a pass. Printing MUTATION GATE PASSED over a corpus
# the run never evaluated is the same class of defect as baselining nothing:
# the words say "every test is proved live" while some were never touched.
#
# This is deliberately a LOUD NON-ZERO rather than a tolerated skip, even though
# a browserless machine is a supported configuration elsewhere in this repo
# (tests/suite_health.py lets the e2e suite skip itself). The two gates answer
# different questions. suite_health asks "did the suite run?", and a developer
# with no browser can still get a truthful answer for everything else. This
# script asks "is every test in the corpus provably killable?", and the only
# honest answer over an unevaluated subset is "unknown" - which must not be
# spelled with a zero exit, because CI and every wrapper read exactly that.
# CI always has a browser, so a complete sweep there still exits 0.
if [ "$SKIPPED" -ne 0 ]; then
  echo "MUTATION GATE INCOMPLETE - $SKIPPED of ${#PATCHES[@]} mutants were never evaluated."
  echo "Nothing above says those tests are live; it says they were not checked."
  echo "Install a browser (or point CHROME_BIN at one) and re-run for a verdict."
  exit 5
fi
if [ "$KILLED" -eq 0 ]; then
  echo "NO MUTANT WAS KILLED - the gate validated nothing."; exit 1
fi
echo "MUTATION GATE PASSED"
