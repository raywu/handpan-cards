import sys

DOC_ONLY = ("docs/plans/", "docs/prompts/")


def code_changed(paths):
    paths = [p.strip() for p in paths if p.strip()]
    return not paths or any(not p.startswith(DOC_ONLY) for p in paths)


if __name__ == "__main__":
    print("code=" + ("true" if code_changed(sys.stdin) else "false"))
