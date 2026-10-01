#!/usr/bin/env python3
"""Sync data/decks.json into index.html's `const DECKS` line.

THIS IS A SYNC STEP, NOT A BUILD STEP, for the same reason
tools/inline_engine.py is one: index.html IS the shipped artifact, GitHub Pages
serves the committed bytes, and the file still opens from disk with the data
already inline. data/decks.json is the SOURCE; the line in index.html is its
generated copy, and both are committed.

    python3 tools/sync_decks.py            # re-sync index.html in place
    python3 tools/sync_decks.py --check    # report drift, write nothing

The injected payload is json.dumps with DEFAULT arguments. That is not a taste
call: tools/regen_data_mutants.py's apply_json() asserts the embedded line
reserialises to itself, so any other separator or ensure_ascii setting breaks
the data mutants.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(ROOT, "index.html")
CANONICAL = os.path.join(ROOT, "data", "decks.json")
PATTERN = re.compile(r"^const DECKS = (\[.*\]);$", re.M)


def canonical():
    with open(CANONICAL, encoding="utf-8") as fh:
        return json.load(fh)


def inject(decks):
    """Write `decks` into index.html's `const DECKS` line and re-parse the
    file to confirm the write landed (CLAUDE.md, "Known pitfalls": the
    degrees carry U+00B0, and a naive re.sub treats it as an escape and
    silently writes nothing - a smoke test against stale data would pass;
    only reading the bytes back proves it). Raises SystemExit on failure.

    `decks` need not be the canonical file's own content - this is also
    tools/regen_data_mutants.py's injection path for a MUTATED decks object
    (finding 15, 2026-09-30 quality-refactor plan), so both tools share one
    injection+re-parse implementation instead of keeping two copies in sync
    by hand."""
    with open(INDEX, encoding="utf-8") as fh:
        html = fh.read()
    match = PATTERN.search(html)
    if not match:
        raise SystemExit("index.html has no `const DECKS = [...]` line")

    want = json.dumps(decks)
    line = "const DECKS = " + want + ";"
    html = PATTERN.sub(lambda _m: line, html, count=1)
    with open(INDEX, "w", encoding="utf-8") as fh:
        fh.write(html)

    with open(INDEX, encoding="utf-8") as fh:
        again = PATTERN.search(fh.read())
    if again is None or again.group(1) != want:
        raise SystemExit("re-injection did not land - index.html NOT in sync")


def main(argv):
    # Parse argv, never substring-match it: a typo beside a real flag would
    # silently select WRITE mode, and on this tool that overwrites index.html.
    args = argv[1:]
    if args not in ([], ["--check"]):
        print("usage: %s [--check]" % argv[0], file=sys.stderr)
        return 2
    check = args == ["--check"]

    with open(INDEX, encoding="utf-8") as fh:
        html = fh.read()
    match = PATTERN.search(html)
    if not match:
        print("index.html has no `const DECKS = [...]` line", file=sys.stderr)
        return 1

    want = json.dumps(canonical())
    if match.group(1) == want:
        print("DECKS in index.html matches data/decks.json: OK")
        return 0

    if check:
        print("DECKS in index.html differs from data/decks.json "
              "(%d bytes embedded vs %d canonical) - run "
              "`python3 tools/sync_decks.py`" % (len(match.group(1)), len(want)),
              file=sys.stderr)
        return 1

    # A LAMBDA replacement, not a bare string: the `degrees` labels carry
    # U+00B0 and re's replacement parser treats backslash escapes in the
    # template, which is how a past hand-injection silently wrote nothing
    # (CLAUDE.md, "Known pitfalls").
    line = "const DECKS = " + want + ";"
    html = PATTERN.sub(lambda _m: line, html, count=1)
    with open(INDEX, "w", encoding="utf-8") as fh:
        fh.write(html)

    # ALWAYS re-parse what was written. A smoke test against stale data passes
    # (CLAUDE.md again); only reading the bytes back proves the write landed.
    with open(INDEX, encoding="utf-8") as fh:
        again = PATTERN.search(fh.read())
    if again is None or again.group(1) != want:
        print("re-injection did not land - index.html NOT in sync", file=sys.stderr)
        return 1

    print("DECKS in index.html re-synced from data/decks.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
