#!/usr/bin/env python3
"""Sync data/i18n/*.json into index.html's i18n region.

A SYNC STEP, NOT A BUILD STEP, like tools/sync_decks.py: index.html is the
shipped artifact and carries the tables inline. data/i18n/<code>.json are the
SOURCE; the `const I18N = {...};` line between the i18n markers is their
generated copy, and both are committed.

    python3 tools/sync_i18n.py            # re-sync index.html in place
    python3 tools/sync_i18n.py --check    # report drift, write nothing
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "index.html")
DIRECTORY = os.path.join(ROOT, "data", "i18n")
LANG_ORDER = ["en", "de", "fr", "it", "es", "ja", "zh-Hant", "zh-Hans"]
PATTERN = re.compile(
    r"(<!-- i18n begin[^>]*-->\s*<script>)(const I18N = .*?;)(</script>\s*<!-- i18n end -->)", re.S)


def canonical():
    tables = {}
    for code in LANG_ORDER:
        path = os.path.join(DIRECTORY, code + ".json")
        if os.path.exists(path):
            with open(path, encoding="utf-8") as fh:
                tables[code] = json.load(fh)
    if "en" not in tables:
        raise SystemExit("data/i18n/en.json is missing")
    for code, table in tables.items():
        missing = sorted(set(tables["en"]) - set(table))
        extra = sorted(set(table) - set(tables["en"]))
        if missing or extra:
            raise SystemExit("%s.json lacks key parity with en.json: missing %s, extra %s"
                             % (code, missing[:5], extra[:5]))
    return tables


def render(tables):
    return "const I18N = " + json.dumps(tables, ensure_ascii=False) + ";"


def main(argv):
    args = argv[1:]
    if args not in ([], ["--check"]):
        print("usage: %s [--check]" % argv[0], file=sys.stderr)
        return 2
    check = args == ["--check"]

    with open(INDEX, encoding="utf-8") as fh:
        html = fh.read()
    match = PATTERN.search(html)
    if not match:
        print("index.html has no i18n region", file=sys.stderr)
        return 1

    want = render(canonical())
    if match.group(2) == want:
        print("i18n region in index.html matches data/i18n: OK")
        return 0
    if check:
        print("i18n region in index.html differs from data/i18n - run "
              "`python3 tools/sync_i18n.py`", file=sys.stderr)
        return 1

    html = PATTERN.sub(lambda m: m.group(1) + want + m.group(3), html, count=1)
    with open(INDEX, "w", encoding="utf-8") as fh:
        fh.write(html)
    with open(INDEX, encoding="utf-8") as fh:
        again = PATTERN.search(fh.read())
    if again is None or again.group(2) != want:
        raise SystemExit("re-injection did not land - index.html NOT in sync")
    print("i18n region in index.html re-synced from data/i18n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
