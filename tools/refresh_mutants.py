#!/usr/bin/env python3
"""Re-anchor tests/mutants/*.patch files whose context has drifted.

Finding 3 (2026-09-30 quality-refactor plan): a legitimate code change can
shift the context lines a mutant patch anchors on, so `git apply` fails even
though the mutant's INTENT (replace this exact run of lines with that exact
run of lines) is still perfectly valid. Hand-editing the diff to re-anchor it
is slow and error-prone; this tool does it mechanically.

Algorithm, per patch file, per touched-file section, per hunk:
  1. Read the hunk's pre-image lines (context + removed) and post-image lines
     (context + added) - the same two blocks `git diff` would show either
     side of.
  2. Search the CURRENT file's lines for the pre-image block as a contiguous
     run.
       - exactly one match: splice in the post-image block at that location.
       - zero matches: the mutant's anchor is gone for good (not a context
         drift) - refuse to touch this patch, it needs a human.
       - more than one match: the anchor is AMBIGUOUS - which occurrence was
         meant is a judgement call this tool refuses to make. Exit nonzero
         and name the patch; never guess.
  3. Once every hunk in every section finds a unique anchor, write the
     spliced content to the real tracked files, `git diff` to capture a
     fresh patch body, `git checkout --` to restore the tree, and write the
     new patch (original `#` header, regenerated body).

A patch that already applies cleanly (`git apply --check`) is left byte-
identical - this tool only touches patches `git apply --check` rejects.

Usage:
  python3 tools/refresh_mutants.py          refresh every stale, unambiguous
                                             patch in tests/mutants/
  python3 tools/refresh_mutants.py --check  report drift, write nothing;
                                             exit nonzero if any patch would
                                             change or is ambiguous/unfixable
"""
import os
import re
import subprocess
import sys
from pathlib import Path

# REFRESH_MUTANTS_ROOT lets the test suite point this at a throwaway fixture
# repo instead of the real one; unset (the normal case), it is this script's
# own repo root, same convention as tools/sync_decks.py's ROOT.
ROOT = Path(os.environ.get("REFRESH_MUTANTS_ROOT") or Path(__file__).resolve().parent.parent)
MUTANTS_DIR = ROOT / "tests" / "mutants"

DIFF_GIT_RE = re.compile(r"^diff --git ", re.MULTILINE)
PLUS_PATH_RE = re.compile(r"^\+\+\+ b/(.+)$", re.MULTILINE)


class Ambiguous(Exception):
    def __init__(self, patch_name, file_path, count):
        self.patch_name = patch_name
        self.file_path = file_path
        self.count = count


class Unfixable(Exception):
    def __init__(self, patch_name, file_path):
        self.patch_name = patch_name
        self.file_path = file_path


def split_header_body(text):
    lines = text.splitlines(keepends=True)
    i = 0
    while i < len(lines) and lines[i].startswith("#"):
        i += 1
    return "".join(lines[:i]), "".join(lines[i:])


def split_sections(body):
    """Body -> list of (file_path, section_text), one per 'diff --git' block."""
    if not body.strip():
        return []
    pieces = DIFF_GIT_RE.split(body)
    # pieces[0] is empty (text before first match); re-prefix the rest.
    sections = []
    for piece in pieces[1:]:
        text = "diff --git " + piece
        m = PLUS_PATH_RE.search(text)
        sections.append((m.group(1) if m else None, text))
    return sections


def hunks_of(section_text):
    """section_text -> list of (old_lines, new_lines), each a list of str."""
    hunks = []
    old, new = None, None
    for line in section_text.splitlines():
        if line.startswith("@@"):
            if old is not None:
                hunks.append((old, new))
            old, new = [], []
        elif old is None:
            continue
        elif line.startswith(" "):
            old.append(line[1:])
            new.append(line[1:])
        elif line.startswith("-"):
            old.append(line[1:])
        elif line.startswith("+"):
            new.append(line[1:])
        elif line.startswith("\\"):
            continue
    if old is not None:
        hunks.append((old, new))
    return hunks


def find_unique(haystack, needle):
    """Index of the unique contiguous occurrence of `needle` in `haystack`
    (both lists of str), or raise ValueError('none'/'ambiguous')."""
    if not needle:
        raise ValueError("none")
    matches = []
    n = len(needle)
    for i in range(len(haystack) - n + 1):
        if haystack[i:i + n] == needle:
            matches.append(i)
    if len(matches) == 0:
        raise ValueError("none")
    if len(matches) > 1:
        raise ValueError("ambiguous")
    return matches[0]


def splice(patch_name, file_path, hunks):
    """Apply every hunk's old->new splice to file_path's current content,
    returning the new full text, or raise Ambiguous/Unfixable."""
    full_path = ROOT / file_path
    text = full_path.read_text(encoding="utf-8")
    trailing_newline = text.endswith("\n")
    lines = text.split("\n")
    if trailing_newline:
        lines = lines[:-1]
    for old, new in hunks:
        try:
            idx = find_unique(lines, old)
        except ValueError as e:
            if str(e) == "ambiguous":
                raise Ambiguous(patch_name, file_path, "multiple")
            raise Unfixable(patch_name, file_path)
        lines[idx:idx + len(old)] = new
    new_text = "\n".join(lines)
    if trailing_newline:
        new_text += "\n"
    return full_path, new_text


def git(args, **kw):
    return subprocess.run(["git"] + args, cwd=ROOT, text=True,
                           capture_output=True, check=False, **kw)


def refresh_one(patch_path, check_only):
    """Returns one of: "fresh", "refreshed", "would-refresh" (check mode),
    or raises Ambiguous/Unfixable."""
    text = patch_path.read_text(encoding="utf-8")
    check = git(["apply", "--check", str(patch_path)])
    if check.returncode == 0:
        return "fresh"

    header, body = split_header_body(text)
    sections = split_sections(body)
    if not sections:
        raise Unfixable(patch_path.name, "<no file sections>")

    touched = []
    for file_path, section_text in sections:
        if file_path is None:
            raise Unfixable(patch_path.name, "<unparseable section>")
        hunks = hunks_of(section_text)
        full_path, new_text = splice(patch_path.name, file_path, hunks)
        touched.append((full_path, file_path, new_text))

    if check_only:
        return "would-refresh"

    originals = {fp: fp.read_text(encoding="utf-8") for fp, _, _ in touched}
    try:
        for full_path, _, new_text in touched:
            full_path.write_text(new_text, encoding="utf-8")
        diff_paths = [fp for _, fp, _ in touched]
        diffed = git(["diff", "--"] + diff_paths)
        new_body = diffed.stdout
    finally:
        for full_path, orig in originals.items():
            full_path.write_text(orig, encoding="utf-8")

    patch_path.write_text(header + new_body, encoding="utf-8")
    return "refreshed"


def main(argv):
    check_only = argv == ["--check"]
    if argv and not check_only:
        print("usage: refresh_mutants.py [--check]", file=sys.stderr)
        return 2

    names = sorted(p.name for p in MUTANTS_DIR.glob("*.patch"))
    changed = []
    problems = []
    for name in names:
        patch_path = MUTANTS_DIR / name
        try:
            status = refresh_one(patch_path, check_only)
        except Ambiguous as e:
            problems.append(f"AMBIGUOUS anchor in {e.patch_name} ({e.file_path}): "
                             f"the removed lines occur more than once in the current "
                             f"file - refusing to guess which one was meant")
            continue
        except Unfixable as e:
            problems.append(f"UNFIXABLE {e.patch_name} ({e.file_path}): no unique "
                             f"anchor found in the current file; this is not a "
                             f"context-drift case, needs a human")
            continue
        if status in ("refreshed", "would-refresh"):
            changed.append(name)
            print(f"{'would refresh' if check_only else 'refreshed'}: {name}")

    for p in problems:
        print(p, file=sys.stderr)

    if problems:
        return 1
    if check_only and changed:
        print(f"{len(changed)} patch(es) would be refreshed; run without --check "
              f"to apply", file=sys.stderr)
        return 1
    if not check_only:
        print(f"refreshed {len(changed)} patch(es); {len(names) - len(changed)} "
              f"already fresh")
    else:
        print("all mutant patches apply cleanly; nothing to refresh")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
