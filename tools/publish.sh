#!/bin/sh
# Copies the published allowlist into an empty output dir (default _site).
# A copy, not a build step: every file is the committed bytes.
# Experimental payload revision: editor-guided-placement-20261126. Pages watches this publisher, not the companion page.
set -eu
cd "$(dirname "$0")/.."
out="${1:-_site}"
if [ -d "$out" ] && [ -n "$(ls -A "$out")" ]; then
  echo "publish.sh: $out is not empty" >&2
  exit 1
fi
mkdir -p "$out"
for f in index.html 404.html sitemap.xml robots.txt llms.txt _headers _redirects og.png apple-touch-icon.png favicon.ico; do
  cp "$f" "$out/$f"
done
for d in scales handpan-101 brand; do
  cp -R "$d" "$out/$d"
done
if [ -n "${CF_PAGES_BRANCH:-}" ] && [ "$CF_PAGES_BRANCH" != "main" ]; then
  cp qa-seed.html "$out/qa-seed.html"
fi
if [ "${CF_PAGES_BRANCH:-}" = "claude/rc-upgrade" ] && [ -f editor-pan-experiment.html ]; then
  cp editor-pan-experiment.html "$out/editor-pan-experiment.html"
fi
# Both editor previews share staged seat trades and Cyclops number placement.
# Keep the Balanced mock on the RC preview branch. Its HTML is outside the normal Pages watch paths.
if [ "${CF_PAGES_BRANCH:-}" = "claude/rc-upgrade" ] && [ -f editor-balanced-mock.html ]; then
  cp editor-balanced-mock.html "$out/editor-balanced-mock.html"
fi
