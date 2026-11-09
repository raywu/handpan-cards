import argparse
import fnmatch
import os
import re
import sys

DOC_ONLY = ("docs/plans/", "docs/prompts/")

DOC_LIKE = ("README.md", "CLAUDE.md", "tests/CONTRACT.md")
DOC_LIKE_GLOBS = ("docs/*.md", "docs/testing/*.md")

HARNESS_EXACT = (
    "tests/mutation_check.sh",
    "tests/shard_mutants.js",
    "tools/ci_scope.py",
    "tools/refresh_mutants.py",
    "tools/regen_data_mutants.py",
    "tools/sandbox.js",
    "requirements-ci.txt",
)
HARNESS_GLOBS = (".github/workflows/*", "tests/helpers/*", "package*.json")

FD_EXACT = (
    "data/decks.json",
    "tools/sync_decks.py",
    "tools/regen_data_mutants.py",
    "tools/decks.py",
    "tests/test_deck_data.py",
)
FD_GLOBS = ("tests/mutants/b_*.patch", "tests/mutants/c_*.patch")

FE_EXACT = (
    "tools/inline_engine.py",
    "tests/fixtures/engine_corpus_v1.json",
    "tools/regen_engine_corpus.js",
)
FE_GLOBS = ("src/engine/*.js",)

FS_EXACT = (
    "tests/storage_corpus.test.js",
    "tests/link_corpus.test.js",
    "tests/share.test.js",
    "tools/probe/saved_variants_storage.js",
    "qa-seed.html",
)
FS_GLOBS = ("tests/fixtures/shipped_client_*.html.txt",)
FS_MUTANT_PREFIXES = (
    "idba_", "idbh_", "saved_", "sv_", "svh_", "mv_", "us_", "uid_", "url_",
    "s3_", "sc_", "qa_scale_", "d_save_", "d_replace_registered_",
)
FS_KILLS = re.compile(r"IDB|\bSVH?\b|saved|move|storage|migrat", re.I)
FS_KEYWORDS = re.compile(
    r"localStorage|sessionStorage|indexedDB|\bIDB|saved|variant|custom:|handle|#s=|move|migrat|sync|storage",
    re.I,
)

SOURCE_OF = {
    "data/i18n/*.json": ("index.html", "scales/*/index.html"),
    "brand/*.svg": ("index.html",),
    "src/engine/*.js": ("index.html",),
    "data/decks.json": ("index.html", "scales/*/index.html"),
}

RELEASE_REF = "claude/release-*"


def code_changed(paths):
    paths = [p.strip() for p in paths if p.strip()]
    return not paths or any(not p.startswith(DOC_ONLY) for p in paths)


def _matches(path, exact=(), globs=()):
    return path in exact or any(fnmatch.fnmatch(path, g) for g in globs)


def mutant_coverage(name, text):
    targets = set()
    old = None
    for line in text.splitlines():
        if line.startswith("--- a/"):
            old = line[6:].split()[0]
        elif line.startswith("+++ b/"):
            targets.add(line[6:].split()[0])
        elif line.startswith("+++ /dev/null") and old:
            targets.add(old)
    covers = set(targets)
    suite = re.search(r"^# suite:\s*(.*)$", text, re.M)
    if suite:
        line = suite.group(1)
        covers.update(re.findall(r"(?<![\w/.])((?:[\w.-]+/)+[\w.-]+\.(?:py|js|sh))\b", line))
        covers.update("tests/%s.py" % m for m in re.findall(r"\btests\.(\w+)", line))
    covers.add("tests/mutants/" + name)
    kills = re.search(r"^# kills:\s*(.*)$", text, re.M)
    return {"targets": targets, "covers": covers, "kills": kills.group(1) if kills else ""}


def load_corpus(directory):
    corpus = {}
    for name in sorted(os.listdir(directory)):
        if name.endswith(".patch"):
            with open(os.path.join(directory, name), encoding="utf-8") as f:
                corpus[name] = mutant_coverage(name, f.read())
    return corpus


def changed_lines(diff_text):
    current = None
    previous = None
    for line in diff_text.splitlines():
        if line.startswith("--- "):
            previous = line[4:].removeprefix("a/")
        elif line.startswith("+++ "):
            target = line[4:].removeprefix("b/")
            current = previous if target == "/dev/null" else target
        elif line.startswith(("+", "-")) and current:
            yield current, line[1:]


def _scans_content(path):
    return path == "index.html" or (path.startswith("tests/") and path.endswith((".test.js", ".py")))


def _changed_mutant(path):
    return path.startswith("tests/mutants/") and path.endswith(".patch")


def full_trigger(changed, diff_text, head_ref, corpus):
    for path in changed:
        if _matches(path, HARNESS_EXACT, HARNESS_GLOBS):
            return "harness path " + path
        if _matches(path, FD_EXACT, FD_GLOBS):
            return "scale data path " + path
        if _matches(path, FE_EXACT, FE_GLOBS):
            return "scale engine path " + path
        if _matches(path, FS_EXACT, FS_GLOBS):
            return "saved scales path " + path
        if _changed_mutant(path):
            name = path.rsplit("/", 1)[1]
            entry = corpus.get(name)
            if name.startswith(FS_MUTANT_PREFIXES):
                return "saved scales mutant " + name
            if entry and any(t.startswith("src/engine/") for t in entry["targets"]):
                return "scale engine mutant " + name
            if entry and FS_KILLS.search(entry["kills"]):
                return "saved scales mutant " + name
    if fnmatch.fnmatch(head_ref or "", RELEASE_REF):
        return "release ref " + head_ref
    for path, line in changed_lines(diff_text):
        if _scans_content(path) and FS_KEYWORDS.search(line):
            return "saved scales keyword %r in %s" % (FS_KEYWORDS.search(line).group(0), path)
    return None


def decide(changed, diff_text, event, head_ref, corpus):
    changed = [p.strip() for p in changed if p.strip()]
    if event == "push":
        return "full", None, "push"
    if not changed or not diff_text.strip():
        return "full", None, "empty diff"
    mapped = [p for p in changed if not p.startswith(DOC_ONLY)]
    if not mapped:
        return "full", None, "no mappable paths"
    reason = full_trigger(mapped, diff_text, head_ref, corpus)
    if reason:
        return "full", None, reason
    covered = set().union(*(c["covers"] for c in corpus.values())) if corpus else set()
    patterns = []
    for path in mapped:
        sources = [v for k, v in SOURCE_OF.items() if fnmatch.fnmatch(path, k)]
        if path in covered or sources or _matches(path, DOC_LIKE, DOC_LIKE_GLOBS):
            for extra in sources:
                patterns.extend(extra)
        else:
            return "full", None, "unmappable path " + path
    wanted = set(mapped)
    names = sorted(
        n for n, c in corpus.items()
        if c["covers"] & wanted or any(fnmatch.fnmatch(p, g) for p in c["covers"] for g in patterns)
    )
    if not names:
        return "full", None, "empty selection"
    return "scoped", names, "%d of %d mutants" % (len(names), len(corpus))


def select(changed, diff_text, event, head_ref, corpus):
    mode, names, _ = decide(changed, diff_text, event, head_ref, corpus)
    return mode, names


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--diff")
    parser.add_argument("--selection")
    parser.add_argument("--mutants", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tests", "mutants"))
    args = parser.parse_args()
    changed = [line.strip() for line in sys.stdin if line.strip()]
    code = code_changed(changed)
    print("code=" + ("true" if code else "false"))
    mode, names, reason = "full", None, "doc-only"
    if code:
        diff_text = ""
        if args.diff and os.path.exists(args.diff):
            with open(args.diff, encoding="utf-8", errors="replace") as f:
                diff_text = f.read()
        try:
            corpus = load_corpus(args.mutants)
            mode, names, reason = decide(changed, diff_text, os.environ.get("EVENT_NAME", ""), os.environ.get("HEAD_REF", ""), corpus)
        except OSError as err:
            mode, names, reason = "full", None, "unreadable: %s" % err
    print("mode=" + mode)
    print("mode reason: " + reason.replace("\n", " "), file=sys.stderr)
    if args.selection and mode == "scoped":
        with open(args.selection, "w", encoding="utf-8") as f:
            f.write("\n".join(names) + "\n")


if __name__ == "__main__":
    main()
