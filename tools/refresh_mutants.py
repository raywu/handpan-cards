#!/usr/bin/env python3
"""Re-anchor tests/mutants/*.patch files whose context has drifted.

Finding 3 (2026-09-30 quality-refactor plan): a legitimate code change can
shift the context lines a mutant patch anchors on, so `git apply` fails even
though the mutant's INTENT (replace this exact run of lines with that exact
run of lines) is still perfectly valid. Hand-editing the diff to re-anchor it
is slow and error-prone; this tool does it mechanically.

Algorithm, per patch file, per touched-file section, per hunk:
  1. Parse the hunk into an ordered list of CHUNKS: alternating runs of
     context lines and "change" groups (a run of removed lines followed by
     a run of added lines - a change group may have either side empty for a
     pure insertion or pure deletion).
  2. Anchor on the CHANGE, not the context (-U0 / --unidiff-zero semantics,
     per the 2026-09-30 quality-refactor plan): for a change group with
     removed lines, search the CURRENT file for that removed-lines run as a
     contiguous block, with NO context required on either side. A context
     line elsewhere in the hunk - even one directly touching the change,
     e.g. the line right after it - is free to have drifted; this tool
     never needs it to match. For a pure insertion (no removed lines), fall
     back to the nearest context chunk (the one immediately before it in
     the hunk, or after if the hunk opens with the insertion) as the
     anchor, and insert the added lines beside that match.
       - exactly one match: splice in the added lines at that location.
       - zero matches: the mutant's anchor is gone for good (not a context
         drift) - refuse to touch this patch, it needs a human.
       - more than one match: the anchor is AMBIGUOUS - which occurrence was
         meant is a judgement call this tool refuses to make. Exit nonzero
         and name the patch; never guess.
  3. Once every change group in every hunk in every section finds a unique
     anchor, write the spliced content to the real tracked files, `git diff`
     to capture a fresh patch body, `git checkout --` to restore the tree,
     and write the new patch (original `#` header, regenerated body, minus
     the `index <sha>..<sha>` blob-header line - see `strip_index_lines`).

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
INDEX_LINE_RE = re.compile(r"^index [0-9a-f]{7,40}\.\.[0-9a-f]{7,40}")


def strip_index_lines(diff_text):
    """Drop git's `index <preimage>..<postimage>` blob-header lines before
    writing a patch. They name the blob the patch was cut from, which the
    next commit to the file invalidates - tests/mutation_harness.test.js's
    "no mutant patch carries a blob header it cannot keep true" rejects them,
    and tools/regen_data_mutants.py strips the same line the same way."""
    return "\n".join(l for l in diff_text.split("\n") if not INDEX_LINE_RE.match(l))


class Ambiguous(Exception):
    def __init__(self, patch_name, file_path):
        self.patch_name = patch_name
        self.file_path = file_path


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
    """section_text -> list of hunks; each hunk is the raw list of diff body
    lines (everything between one '@@...@@' header and the next), still
    carrying their leading ' '/'-'/'+' markers - parse_chunks() below does
    the anchoring-relevant parsing."""
    hunks = []
    cur = None
    for line in section_text.splitlines():
        if line.startswith("@@"):
            if cur is not None:
                hunks.append(cur)
            cur = []
        elif cur is None:
            continue
        elif line.startswith("\\"):
            continue
        else:
            cur.append(line)
    if cur is not None:
        hunks.append(cur)
    return hunks


def parse_chunks(hunk_lines):
    """One hunk's raw lines -> ordered list of chunks, alternating:
      {"type": "ctx", "lines": [...]}
      {"type": "chg", "removed": [...], "added": [...]}
    A change chunk's removed/added runs may each be empty (pure insertion
    or pure deletion) but not both."""
    chunks = []
    ctx = []
    i = 0
    while i < len(hunk_lines):
        line = hunk_lines[i]
        if line == "" or line.startswith(" "):
            ctx.append(line[1:])
            i += 1
            continue
        if not (line.startswith("-") or line.startswith("+")):
            # M179-1 (2026-10-01 post-refactor triage): a line that is not
            # blank/context ("" or " "-prefixed) and not a removed/added
            # marker ("-"/"+") matches none of this function's branches. The
            # old code fell straight into the removed/added while loops
            # below, both of which no-op on such a line - `i` never advances,
            # so a single malformed hunk line spun this loop forever. Raise
            # instead of looping: a hunk this tool cannot parse needs a
            # human, not a hang.
            raise ValueError(f"unknown hunk-line prefix: {line!r}")
        if ctx:
            chunks.append({"type": "ctx", "lines": ctx})
            ctx = []
        removed = []
        while i < len(hunk_lines) and hunk_lines[i].startswith("-"):
            removed.append(hunk_lines[i][1:])
            i += 1
        added = []
        while i < len(hunk_lines) and hunk_lines[i].startswith("+"):
            added.append(hunk_lines[i][1:])
            i += 1
        chunks.append({"type": "chg", "removed": removed, "added": added})
    if ctx:
        chunks.append({"type": "ctx", "lines": ctx})
    return chunks


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


def splice_chunks(patch_name, file_path, lines, chunks):
    """Apply one hunk's chunks to `lines` (mutated in place via rebinding),
    anchoring each change group on its removed lines alone (or, for a pure
    insertion, on the nearest context chunk) - never on the full
    context+removed block. Returns the updated lines list, or raises
    Ambiguous/Unfixable."""
    for pos, chunk in enumerate(chunks):
        if chunk["type"] != "chg":
            continue
        removed, added = chunk["removed"], chunk["added"]
        if removed:
            try:
                idx = find_unique(lines, removed)
            except ValueError as e:
                if str(e) == "ambiguous":
                    raise Ambiguous(patch_name, file_path)
                raise Unfixable(patch_name, file_path)
            lines[idx:idx + len(removed)] = added
            continue
        # Pure insertion: anchor on the nearest context chunk instead -
        # prefer the one immediately before this change in the hunk (insert
        # right after its match), falling back to the one immediately after
        # (insert right before its match) when the hunk opens with the
        # insertion.
        before = chunks[pos - 1] if pos > 0 and chunks[pos - 1]["type"] == "ctx" else None
        after = chunks[pos + 1] if pos + 1 < len(chunks) and chunks[pos + 1]["type"] == "ctx" else None
        anchor_lines, insert_after = (before["lines"], True) if before else (
            (after["lines"], False) if after else (None, None))
        if anchor_lines is None:
            raise Unfixable(patch_name, file_path)
        try:
            idx = find_unique(lines, anchor_lines)
        except ValueError as e:
            if str(e) == "ambiguous":
                raise Ambiguous(patch_name, file_path)
            raise Unfixable(patch_name, file_path)
        at = idx + len(anchor_lines) if insert_after else idx
        lines[at:at] = added
    return lines


def splice(patch_name, file_path, hunks):
    """Apply every hunk's chunks to file_path's current content, returning
    (full_path, new_text), or raise Ambiguous/Unfixable."""
    full_path = ROOT / file_path
    try:
        text = full_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        # M179-6 (2026-10-01 post-refactor triage): a patch naming a file
        # that no longer exists in the tree is not a context-drift case -
        # there is nothing to re-anchor against - so report it the same way
        # as every other unrecoverable patch instead of crashing with a raw
        # traceback.
        raise Unfixable(patch_name, file_path)
    trailing_newline = text.endswith("\n")
    lines = text.split("\n")
    if trailing_newline:
        lines = lines[:-1]
    for hunk_lines in hunks:
        try:
            chunks = parse_chunks(hunk_lines)
        except ValueError:
            # M179-1's unknown-hunk-prefix case: not a context-drift
            # scenario to retry, so report it the same way as every other
            # unrecoverable patch instead of an uncaught traceback.
            raise Unfixable(patch_name, file_path)
        lines = splice_chunks(patch_name, file_path, lines, chunks)
    new_text = "\n".join(lines)
    if trailing_newline:
        new_text += "\n"
    return full_path, new_text


def git(args):
    return subprocess.run(["git"] + args, cwd=ROOT, text=True,
                           capture_output=True, check=False)


class GitStatusError(RuntimeError):
    """Raised when git itself fails while checking the targets' status -
    the caller must refuse, not treat empty/missing stdout as "clean"."""


def dirty_targets(targets):
    """Return the sorted subset of `targets` that differ from HEAD, in
    either the index or the worktree.

    M179-4 bounce 1 (2026-10-01 post-refactor triage): `git diff --name-only
    HEAD --` alone compares the WORKTREE to HEAD and is blind to a staged
    edit whose worktree content was then restored to match HEAD again
    (index != worktree == HEAD, e.g. `git add` followed by `git restore
    --worktree`) - that diff reports no difference even though the index
    still carries the staged edit, and refresh_one() reads the WORKTREE
    file, which silently bakes a vanished staged edit's absence into the
    refreshed patch while `git diff` (used to regenerate the patch body)
    would see the index. Union with `git diff --cached --name-only HEAD --`
    (index vs HEAD), which catches that case regardless of worktree state.
    A git failure on EITHER call must refuse, not be read as "no output,
    so nothing is dirty"."""
    sorted_targets = sorted(targets)
    worktree = git(["diff", "--no-color", "--no-ext-diff", "--name-only",
                     "HEAD", "--"] + sorted_targets)
    staged = git(["diff", "--no-color", "--no-ext-diff", "--cached",
                  "--name-only", "HEAD", "--"] + sorted_targets)
    if worktree.returncode != 0 or staged.returncode != 0:
        raise GitStatusError((worktree.stderr or "") + (staged.stderr or ""))
    return sorted(set(worktree.stdout.split()) | set(staged.stdout.split()))


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
        diffed = git(["diff", "--no-color", "--no-ext-diff", "--"] + diff_paths)
        new_body = strip_index_lines(diffed.stdout)
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

    if not check_only:
        # Refuse a dirty tree for any file a patch might touch, same
        # discipline as tools/regen_data_mutants.py: this tool reads a
        # file's CURRENT content to splice against, writes it, `git diff`s
        # it, then restores the pre-splice content - if that pre-splice
        # content is itself an uncommitted edit, the restore preserves the
        # dirty edit (not destructive) but the fresh patch body would
        # silently bake in that uncommitted change as part of the mutant.
        targets = set()
        for name in names:
            text = (MUTANTS_DIR / name).read_text(encoding="utf-8")
            targets.update(PLUS_PATH_RE.findall(text))
        if targets:
            # M179-4 (2026-10-01 post-refactor triage): compare against HEAD,
            # not the index - `git diff --quiet --` (no HEAD) compares the
            # worktree to the index, so a `git add`ed-but-uncommitted edit
            # makes the two match and the refusal missed it. M-3: name only
            # the dirty SUBSET of targets, not every target any patch might
            # touch. M-4: `--no-color --no-ext-diff` so a user's
            # `diff.external`/`color.diff=always` config cannot corrupt this.
            # M179-4 bounce 1: worktree-vs-HEAD ALONE still missed a staged
            # edit whose worktree was restored to HEAD afterwards - see
            # dirty_targets()'s docstring. A git failure refuses too.
            try:
                dirty = dirty_targets(targets)
            except GitStatusError as e:
                print("REFUSING: could not verify the working tree is "
                      "clean: " + str(e), file=sys.stderr)
                return 1
            if dirty:
                print("REFUSING: tracked files already modified: "
                      + ", ".join(dirty), file=sys.stderr)
                return 1

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
