#!/bin/sh
# Copies the published allowlist into an empty output dir (default _site).
# A copy, not a build step: every file is the committed bytes.
set -eu
cd "$(dirname "$0")/.."
out="${1:-_site}"
if [ -d "$out" ] && [ -n "$(ls -A "$out")" ]; then
  echo "publish.sh: $out is not empty" >&2
  exit 1
fi
mkdir -p "$out"
for f in index.html 404.html sitemap.xml robots.txt llms.txt _headers og.png apple-touch-icon.png; do
  cp "$f" "$out/$f"
done
for d in scales handpan-101; do
  cp -R "$d" "$out/$d"
done
if [ -n "${CF_PAGES_BRANCH:-}" ] && [ "$CF_PAGES_BRANCH" != "main" ]; then
  cp qa-seed.html "$out/qa-seed.html"
fi
