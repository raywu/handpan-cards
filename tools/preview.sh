#!/usr/bin/env bash
# Preview the app before it reaches main (and therefore GitHub Pages).
#
#   tools/preview.sh                 serve this checkout (live edits, just reload)
#   tools/preview.sh <branch>        serve origin/<branch> from a throwaway worktree
#   tools/preview.sh pr:<number>     serve the head branch of that PR
#   PORT=9000 tools/preview.sh ...   pick a port (default 8000)
#
# Prints a localhost URL and a LAN URL for a phone on the same Wi-Fi.
# Ctrl-C stops the server and removes the throwaway worktree.
set -euo pipefail

ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PORT=${PORT:-8000}
TARGET=${1:-.}
SERVE_DIR=$ROOT
WT=""

if [ "$TARGET" != "." ]; then
  if [[ "$TARGET" == pr:* ]]; then
    TARGET=$(gh pr view "${TARGET#pr:}" --repo "$(git -C "$ROOT" remote get-url origin)" --json headRefName -q .headRefName)
  fi
  git -C "$ROOT" fetch -q origin "$TARGET"
  WT=$(mktemp -d "${TMPDIR:-/tmp}/handpan-preview.XXXXXX")
  git -C "$ROOT" worktree add -q --detach "$WT" "origin/$TARGET"
  SERVE_DIR=$WT
  echo "serving origin/$TARGET at $(git -C "$WT" rev-parse --short HEAD)"
else
  echo "serving working tree at $ROOT"
fi

LAN=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)
echo "  local:  http://localhost:$PORT/"
[ -n "$LAN" ] && echo "  phone:  http://$LAN:$PORT/"
echo "  (Pages serves main only; merge to publish at http://handpan.raywu.org/)"
python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$SERVE_DIR" &
SERVER=$!
cleanup() {
  kill "$SERVER" 2>/dev/null || true
  [ -n "$WT" ] && git -C "$ROOT" worktree remove -f "$WT" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM
wait "$SERVER" || true
