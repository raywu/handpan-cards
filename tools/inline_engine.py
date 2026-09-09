#!/usr/bin/env python3
"""Sync the scale-engine modules into index.html's inline engine regions.

THIS IS A SYNC STEP, NOT A BUILD STEP: index.html is committed with the engine
already inlined and stays independently functional with no build; this tool only
re-copies src/engine/*.js into it after an engine change, and tools/validate.py
fails when the two drift apart.

Usage, from anywhere:

    python3 tools/inline_engine.py            # re-sync index.html in place
    python3 tools/inline_engine.py --check    # write nothing; exit 1 on desync

Each module lives in its own region, delimited by HTML comments carrying the
module name so the regions are greppable and the tool is idempotent:

    <!-- engine:core begin - synced from src/engine/core.js ... -->
    <script>
    ...src/engine/core.js, verbatim...
    </script>
    <!-- engine:core end -->

The engine files are plain scripts attaching to a shared `var HPE`, so they
inline with no wrapper changes. MODULES is the load order: core first, because
every other module reads HPE.core.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENGINE_DIR = os.path.join(ROOT, "src", "engine")
INDEX = os.path.join(ROOT, "index.html")

MODULES = ["core", "voicing", "layout", "naming", "select", "share"]

BEGIN = ("<!-- engine:%s begin - synced from src/engine/%s.js by "
         "tools/inline_engine.py; edit the module, not this copy -->")
END = "<!-- engine:%s end -->"

# The whole block of regions sits between these two anchors, so the tool can
# rewrite every region at once (and insert them on a first run).
BLOCK_BEGIN = "<!-- engine begin -->"
BLOCK_END = "<!-- engine end -->"


def module_source(name):
    with open(os.path.join(ENGINE_DIR, name + ".js"), encoding="utf-8") as fh:
        return fh.read()


def region_text(name, source):
    return "%s\n<script>\n%s</script>\n%s\n" % (
        BEGIN % (name, name), source, END % name)


def expected_block():
    return BLOCK_BEGIN + "\n" + "".join(
        region_text(name, module_source(name)) for name in MODULES) + BLOCK_END


def read_index():
    with open(INDEX, encoding="utf-8") as fh:
        return fh.read()


def regions(html):
    """name -> inlined source, in document order."""
    found = {}
    for m in re.finditer(
            r"<!-- engine:(\w+) begin[^>]*-->\n<script>\n(.*?)</script>\n"
            r"<!-- engine:\1 end -->", html, re.S):
        found[m.group(1)] = m.group(2)
    return found


def desync():
    """List of English sentences describing every region that is out of sync."""
    html = read_index()
    found = regions(html)
    problems = []
    for name in MODULES:
        if name not in found:
            problems.append("index.html has no engine:%s region" % name)
        elif found[name] != module_source(name):
            problems.append(
                "engine:%s in index.html differs from src/engine/%s.js"
                % (name, name))
    for name in sorted(set(found) - set(MODULES)):
        problems.append("index.html has an unknown engine:%s region" % name)
    order = [n for n in re.findall(r"<!-- engine:(\w+) begin", html)
             if n in MODULES]
    if order and order != MODULES:
        problems.append("engine regions are in the order %s, not %s "
                        "(HPE.core must load first)"
                        % (", ".join(order), ", ".join(MODULES)))
    return problems


def sync():
    html = read_index()
    block = expected_block()
    if BLOCK_BEGIN in html and BLOCK_END in html:
        start = html.index(BLOCK_BEGIN)
        end = html.index(BLOCK_END) + len(BLOCK_END)
        new = html[:start] + block + html[end:]
    else:
        raise SystemExit("index.html has no %s / %s anchors - add them around "
                         "the engine block first" % (BLOCK_BEGIN, BLOCK_END))
    if new == html:
        return False
    with open(INDEX, "w", encoding="utf-8") as fh:
        fh.write(new)
    return True


def main(argv):
    if argv[1:] == ["--check"]:
        problems = desync()
        for p in problems:
            print("DESYNC: " + p)
        if problems:
            print("run: python3 tools/inline_engine.py")
            return 1
        print("engine regions in index.html match src/engine/: OK")
        return 0
    if argv[1:]:
        print("usage: %s [--check]" % argv[0], file=sys.stderr)
        return 2
    changed = sync()
    print("index.html engine regions %s" % ("re-synced" if changed else "already in sync"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
