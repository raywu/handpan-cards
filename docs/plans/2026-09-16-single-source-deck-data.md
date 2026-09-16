# Single-source deck data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `data/decks.json` becomes the one canonical copy of deck data; `index.html`'s `const DECKS` line is a GENERATED copy of it and `tools/decks.py` derives its deck dicts from it, so app and print can no longer disagree about what a card says.

**Architecture:** Exactly the precedent already set by the engine regions. `tools/sync_decks.py` injects `data/decks.json` into `index.html` (with `--check` for drift), `tools/decks.py` reads the same file through an adapter shaped like its existing `from_generated()`, and `tools/validate.py` fails on drift. A SYNC STEP, NOT A BUILD STEP: `index.html` stays committed with the data already inline and still opens from disk.

**Tech Stack:** python3 stdlib (`json`, `re`), reportlab print pipeline, python unittest, node:test.

**Spec:** this file. Deck data shape is CLAUDE.md "App data model"; the divergence inventory this plan deliberately does NOT adopt is `tests/fixtures/divergence_v1.json`.

---

## The problem, measured

Deck data exists TWICE today, both copies hand-maintained:

| copy | form | consumer |
|---|---|---|
| `tools/decks.py:7-189` | Python literals (`HIJAZ_SPEC`/`HIJAZ_CHORDS`/`HIJAZ = dict(...)`, x3) | the six PDFs |
| `index.html`, `const DECKS = [...]` | one-line JSON, 8567-byte payload | the app |

`tools/validate.py:36-55` (check 1) compares them field by field. That is a **drift detector, not a source of truth**: it tells you the two copies disagree, and then a human fixes both by hand. CLAUDE.md's "If deck data changes" procedure is that manual dance, and its own "Known pitfalls" section documents the re-injection footgun (U+00B0 in `degrees` makes a naive `re.sub` silently fail) because the procedure is run by hand.

**The split is already exact, which is what makes this cheap.** Measured across all three decks:

- The app carries exactly 8 keys: `id, name, sub, colors, degrees, geom, fields, chords`.
- `geom` key sets are IDENTICAL between `decks.py` and the app on all three decks (app-only: none; py-only: none).
- `decks.py` carries those same 8 (in its own shapes: `spec` = `_geom` + fields, `col_root`/`col_tone`/`grad` = `colors`) PLUS 10 print-only keys: `title, credit, R, cy, y_note, y_num, has_bottom, legend_demo, legend_lines, blurb`, and `blank_cards` on Pygmy only.

So the canonical file is the app's `DECKS` array verbatim, and the print-only keys stay in `decks.py` as a presentation overlay.

**The serialization already round-trips byte-for-byte.** `json.dumps(json.loads(payload))` with DEFAULT arguments reproduces today's 8567-byte payload exactly (`ensure_ascii=False` gives 8542, compact separators 7398 - both wrong). `tools/regen_data_mutants.py:158` already asserts this exact invariant (`"serialisation format drifted"`). The first run of the new sync tool therefore writes `index.html` back unchanged, and the whole plan is provably a content no-op.

## Non-goals

**What "one source of truth" does NOT cover.** `blurb`, `title`, `credit` and
`legend_lines` are print-only hand-written copy and stay in the overlay, so app and print
can still disagree ABOUT COPY after this plan. They already do: `tools/decks.py:124` prints
`"COMPLETE F NATURAL MINOR   -   25 CHORDS"` on a Pygmy deck of 27 cards. That is a known
backlog item (derive the count in `_blurb`), not something this plan fixes, and the plan's
claim is narrower than it first reads: the DATA - fields, geometry, chords, degrees,
colours - can no longer diverge.


- **No deck content changes.** Not one card, subtitle, field list, angle, colour or geometry value moves. Hijaz stays 18 chords, Pygmy 27, Amara 16. Every acceptance gate below is an equality assertion against today's bytes.
- **NOT the engine-adoption question.** `tests/fixtures/divergence_v1.json` records that the engine would derive hijaz 19 / pygmy 52 / amara 25 cards from the same seeds. Adopting any of that is a separate owner decision and a separate plan. This plan deliberately makes that decision *easier to review later* by reducing it to a diff of one JSON file, but does not take it.
- **The app does not fetch data at runtime.** `index.html` keeps its inline copy; `data/decks.json` is never requested by the browser. The single-file constraint is untouched and no `<script src>` appears.
- **`tools/hifi.py` is not touched.** It consumes deck dicts; the shape it receives is unchanged.
- **The engine is not touched.** `src/engine/*.js`, `tools/inline_engine.py` and `tools/gen_deck.js` are out of scope; `from_generated()` keeps working unchanged for generated decks.

## Global Constraints

- `index.html` stays a single self-contained file, no `<script src>`, no build step. `data/decks.json` is a SYNC source, committed alongside the inline copy it generates.
- Do not alter deck data or diagram geometry (CLAUDE.md hard constraint). This plan's entire acceptance case is that it did not.
- The injected payload must be `json.dumps(decks)` with default arguments. Any other separator or `ensure_ascii` setting rewrites all 8567 bytes and breaks `regen_data_mutants.py:158`.
- Re-injection uses a LAMBDA replacement and re-parses the written file to verify (CLAUDE.md "Known pitfalls": `degrees` contains U+00B0, and `re.sub` treats it as an escape).
- Every task ends green: `python3 -m unittest discover tests` and `node --test "tests/*.test.js"` both pass, and `python3 tools/validate.py` exits 0, before the commit.
- Never `git add -A`. Commit named paths.

---

### Task 1: Extract the canonical file and pin its serialization

**Files:**
- Create: `data/decks.json`
- Test: `tests/test_deck_data.py` (new test class at the end)

**Interfaces:**
- Produces: `data/decks.json` - a JSON array of 3 deck objects, the parsed `const DECKS` payload, pretty-printed with `indent=2, ensure_ascii=False, sort_keys=False`. Human-reviewable on disk; the INJECTED form is the compact default-`json.dumps` one. Later tasks read it with plain `json.load`.
- Produces: `tests.paths.CANONICAL` - absolute path to `data/decks.json`.

- [ ] **Step 1: Write the failing test**

Add to `tests/paths.py`:

```python
CANONICAL = os.path.join(ROOT, "data", "decks.json")


def canonical_decks():
    """The canonical deck data on disk, parsed."""
    import json
    with open(CANONICAL, encoding="utf-8") as fh:
        return json.load(fh)
```

Add to `tests/test_deck_data.py`:

```python
class CanonicalSourceTest(unittest.TestCase):
    """data/decks.json is the source; index.html's DECKS line is its copy."""

    def test_canonical_file_equals_the_payload_embedded_in_index_html(self):
        self.assertEqual(paths.canonical_decks(), paths.app_decks())

    def test_canonical_reserialises_to_the_embedded_bytes_exactly(self):
        # The injected form is json.dumps with DEFAULT arguments. Measured
        # 2026-09-16: default 8567 bytes == the committed payload;
        # ensure_ascii=False gives 8542 and compact separators 7398, either of
        # which rewrites the whole line and breaks the identical assertion in
        # tools/regen_data_mutants.py:158.
        html = open(paths.INDEX_HTML, encoding="utf-8").read()
        m = re.search(r"^const DECKS = (\[.*\]);$", html, re.M)
        self.assertIsNotNone(m, "DECKS JSON not found in index.html")
        self.assertEqual(json.dumps(paths.canonical_decks()), m.group(1))
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python3 -m unittest -k CanonicalSourceTest tests.test_deck_data -v`
Expected: FAIL with `FileNotFoundError: .../data/decks.json`

- [ ] **Step 3: Create the file FROM index.html (never by hand)**

Typing the data out invents a chance to change it. Extract it:

```bash
mkdir -p data
python3 - <<'PY'
import json, re, os
html = open("index.html", encoding="utf-8").read()
m = re.search(r"^const DECKS = (\[.*\]);$", html, re.M)
assert m, "DECKS JSON not found in index.html"
decks = json.loads(m.group(1))
assert json.dumps(decks) == m.group(1), "serialisation format drifted"
with open("data/decks.json", "w", encoding="utf-8") as fh:
    json.dump(decks, fh, indent=2, ensure_ascii=False, sort_keys=False)
    fh.write("\n")
print("wrote data/decks.json", os.path.getsize("data/decks.json"), "bytes")
PY
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest -k CanonicalSourceTest tests.test_deck_data -v`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add data/decks.json tests/paths.py tests/test_deck_data.py
git commit -m "Extract the deck data into data/decks.json and pin its serialisation"
```

---

### Task 2: `tools/sync_decks.py` - inject the canonical file into `index.html`

**Files:**
- Create: `tools/sync_decks.py`
- Test: `tests/test_deck_data.py` (extend `CanonicalSourceTest`)

**Interfaces:**
- Consumes: `data/decks.json` (Task 1).
- Produces: `python3 tools/sync_decks.py` rewrites the `const DECKS` line in place; `python3 tools/sync_decks.py --check` exits 0 when in sync, 1 with a diff summary when not. Same CLI contract as `tools/inline_engine.py`.

- [ ] **Step 1: Write the failing test**

Append to `CanonicalSourceTest` in `tests/test_deck_data.py`:

```python
    def test_sync_decks_check_passes_on_the_committed_tree(self):
        out = subprocess.run(
            [sys.executable, os.path.join(paths.TOOLS, "sync_decks.py"), "--check"],
            capture_output=True, text=True)
        self.assertEqual(out.returncode, 0, out.stdout + out.stderr)

    def test_sync_decks_check_fails_when_the_canonical_file_drifts(self):
        # The gate has to FIRE, not merely exist. Mutate a copy of the tree,
        # not the tree: a test that edits data/decks.json in place and restores
        # it leaves the repo dirty when it fails.
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(paths.ROOT, tmp, dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns(".git", "*.pdf"))
            path = os.path.join(tmp, "data", "decks.json")
            decks = json.load(open(path, encoding="utf-8"))
            decks[0]["chords"][0]["subtitle"] = "DRIFTED"
            json.dump(decks, open(path, "w", encoding="utf-8"),
                      indent=2, ensure_ascii=False)
            out = subprocess.run(
                [sys.executable, os.path.join(tmp, "tools", "sync_decks.py"), "--check"],
                capture_output=True, text=True, cwd=tmp)
            self.assertEqual(out.returncode, 1, out.stdout + out.stderr)
            self.assertIn("DECKS", out.stdout + out.stderr)
```

Add `import subprocess, sys, tempfile, shutil` to the test module's imports if absent.

- [ ] **Step 2: Run it to verify it fails**

Run: `python3 -m unittest -k CanonicalSourceTest tests.test_deck_data -v`
Expected: both new tests FAIL - `sync_decks.py` does not exist (returncode 2, "can't open file")

- [ ] **Step 3: Write the tool**

```python
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
call: tools/regen_data_mutants.py:158 asserts the embedded line reserialises to
itself, so any other separator or ensure_ascii setting breaks the data mutants.
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


def main(argv):
    check = "--check" in argv[1:]

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
    if again is None or json.loads(again.group(1)) != canonical():
        print("re-injection did not land - index.html NOT in sync", file=sys.stderr)
        return 1

    print("DECKS in index.html re-synced from data/decks.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
python3 -m unittest -k CanonicalSourceTest tests.test_deck_data -v
git diff --stat index.html
```
Expected: 4 tests PASS, and `git diff` reports **no change to `index.html`** - the tool is a content no-op on the committed tree, which is the whole acceptance case for this task.

- [ ] **Step 5: Commit**

```bash
git add tools/sync_decks.py tests/test_deck_data.py
git commit -m "Add tools/sync_decks.py to sync data/decks.json into index.html"
```

---

**Argument parsing, not substring matching.** `main()` must reject unknown argv rather
than testing `"--check" in argv[1:]`: a typo alongside a real flag silently selects WRITE
mode, which on this tool means overwriting `index.html`. Mirror
`tools/regen_data_mutants.py:186-190` - anything other than exactly `[]` or `["--check"]`
prints a usage line and exits 2. (Found by the outside voice.)

---

### Task 3: Make drift a CI failure via `tools/validate.py`

**Files:**
- Modify: `tools/validate.py:30-56` (check 1) and its check numbering
- Test: `tests/test_deck_data.py::test_validate_py_passes` (exists, `:446`)

**Interfaces:**
- Consumes: `tools/sync_decks.py` (Task 2).
- Produces: `validate.py` check 1 becomes "index.html's DECKS == data/decks.json", enforced by calling the sync tool's own comparison rather than a second implementation of it.

**Why this is not yet redundant with Task 4.** After Task 4 the *Python* side derives from canonical and cannot drift. The *app* side still can: `index.html` is a committed generated copy, so an editor can hand-edit the DECKS line, or a merge can resolve inside it, exactly as could happen inside an engine region. This check is the `validate.py` check-4 analogue for data.

- [ ] **Step 1: Write the failing test**

`test_validate_py_passes` already exists and passes. The new coverage is that validate.py CATCHES an out-of-sync `index.html`. Add to `CanonicalSourceTest`:

```python
    def test_validate_py_fails_when_index_html_drifts_from_canonical(self):
        with tempfile.TemporaryDirectory() as tmp:
            shutil.copytree(paths.ROOT, tmp, dirs_exist_ok=True,
                            ignore=shutil.ignore_patterns(".git", "*.pdf"))
            index = os.path.join(tmp, "index.html")
            html = open(index, encoding="utf-8").read()
            html = html.replace("C# MAJOR", "C# MAJOUR", 1)
            open(index, "w", encoding="utf-8").write(html)
            out = subprocess.run(
                [sys.executable, os.path.join(tmp, "tools", "validate.py")],
                capture_output=True, text=True, cwd=tmp)
            self.assertNotEqual(out.returncode, 0, out.stdout + out.stderr)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python3 -m unittest -k test_validate_py_fails_when_index_html_drifts tests.test_deck_data -v`
Expected: FAIL. Today check 1 compares index.html against `decks.py`, so this DOES currently fail the run - meaning this test passes for the WRONG reason before Task 4 and for the right one after. Record that in the test's docstring and re-run it at the end of Task 4; it must still pass once `decks.py` no longer holds an independent copy.

- [ ] **Step 3: Rewrite check 1**

In `tools/validate.py`, replace the body of check 1 with a delegation:

```python
    # 1. index.html's DECKS line is a current copy of data/decks.json.
    #    data/decks.json is the SOURCE; this is the check-4 analogue for data.
    import sync_decks   # tools/ is already on sys.path: validate.py:16-17
    assert sync_decks.main(["sync_decks.py", "--check"]) == 0, \
        "index.html's DECKS line is stale - run `python3 tools/sync_decks.py`"
    app = sync_decks.canonical()
    print("1. index.html DECKS == data/decks.json: OK")

    # 1b. tools/decks.py's deck dicts carry the canonical data unchanged.
    #     After the adapter lands this cannot drift by construction, so the
    #     check is a GUARD ON THE ADAPTER (a print overlay key must never
    #     shadow a canonical one), not a drift detector between two copies.
```

Keep checks 1b (the existing field/geom/chord/degree/colour comparison against `PY`), 2, 3 and 4 exactly as they are. Do not renumber 2-4; the mutant headers in `tests/mutants/` quote them.

- [ ] **Step 3b: Add `data/decks.json` to check 3's file list**

Check 3 greps the German-copy regex over `("index.html", "tools/decks.py", "tools/hifi.py")`.
After this plan the file a human EDITS is `data/decks.json`, and it is not in that tuple.
Coverage there is only transitive through `index.html` and holds only while check 1 holds -
a guard that depends on another guard. Add the canonical file to the tuple:

```python
    for fn in ("index.html", "tools/decks.py", "tools/hifi.py", "data/decks.json"):
```

This is the one renumber-free change to checks 2-4: the mutant headers quote the check
NUMBERS, not their file lists.

- [ ] **Step 3c: Fix `validate.py`'s own docstring**

`tools/validate.py:4-5` says it "checks that the app's embedded DECKS JSON and
tools/decks.py agree field-for-field". After Step 3 that is no longer what check 1 does.
Rewrite it to name `data/decks.json` as the source and `index.html` as the generated copy,
and describe 1b as the adapter guard. A false docstring on the file that IS the drift gate
is how the next person rebuilds the second copy this plan just deleted.
(Found by the outside voice.)

- [ ] **Step 4: Run the full python suite**

```bash
python3 tools/validate.py
python3 -m unittest discover tests
```
Expected: validate.py prints checks 1, 1b, 2, 3, 4 OK and exits 0; suite green.

- [ ] **Step 5: Commit**

```bash
git add tools/validate.py tests/test_deck_data.py
git commit -m "validate.py check 1 gates index.html against data/decks.json"
```

---

### Task 4: `tools/decks.py` derives its deck dicts from the canonical file

**Files:**
- Modify: `tools/decks.py:7-189` (delete the six literal blocks, add three overlay calls), and add `_from_canonical` beside `from_generated` at `:413`
- Test: `tests/test_deck_data.py` (new snapshot test), `tests/test_pdf_build.py::test_committed_pdfs_match_a_fresh_build` (exists, `:252`)

**Interfaces:**
- Consumes: `data/decks.json` (Task 1), `_spec_from` (`decks.py:356`), `_hex_color` (`decks.py:348`).
- Produces: `decks._from_canonical(deck_id, **overlay) -> dict` - the same deck-dict shape `hifi.build` already consumes. `decks.HIJAZ`, `decks.PYGMY`, `decks.AMARA` keep their names and their exact current values.

**The two traps this task exists to avoid.**

1. **Do NOT reuse `from_generated()`.** It reads `generated["geom"]["ext"]` (`decks.py:428`) and derives `R = _BAND_HALF / ext`. No built-in geom carries an `ext` key at all, and `decks.py:227-231` records what the derivation would produce if one did: Hijaz R 69.8 against the literal 73.0 (-4.4%), Pygmy 50.6 against 60.0 (-15.7%). Re-deriving R would redraw every diagram on every PDF. `R` and `cy` come from the OVERLAY, as literals, always.
3. **`tools/decks.py:186-188` becomes false and is a patch anchor.** The comment above
   `GENERATED_OMITTED` says "the three built-in dicts above and their spec/chord literals
   stay byte-identical". After this task the literals are gone, so the sentence has to be
   rewritten - and those exact lines are the context anchor of the hand-written
   `tests/mutants/c_gen_omitted_vacuous.patch` (`@@ -191,6 +191,14 @@ AMARA = dict(`).
   Rewriting the comment restales that patch, which `regen_data_mutants.py --check` will
   NOT report (it iterates `MUTANTS` only). Task 5 Step 7 owns the re-authoring; verify
   with `git apply --check`, never by reasoning.

4. **Do NOT re-derive the built-in COLOURS through `_hex_color()`.** The committed
   literals are rounded to three decimals - `col_root=Color(0.878, 0.333, 0.604)`
   (`decks.py:49`) - while `_hex_color("#E0559A")` returns `Color(0.878431..., 0.333333...,
   0.603921...)`. They are not equal, and `tests/fixtures/print_decks_v1.json` would catch
   the difference as a snapshot failure on the very first run. The two representations agree
   only ONE WAY, through `validate.py`'s `hexc()` rounding. `col_root`, `col_tone` and
   `grad` therefore come from the OVERLAY as the existing literals, exactly like `R` and
   `cy`. `_hex_color` stays in the file for `from_generated`'s use only.
   (Found by the outside voice, verified at `tools/decks.py:49,119,171`.)

2. **Do NOT re-derive the built-in card copy.** `_blurb()` (`:365`) emits `"18 CHORDS - ONE CARD PER CHORD"`; Hijaz's committed blurb reads `"PHRYGIAN DOMINANT, NO b6   -   18 CHORDS"`. The built-in blurbs, `legend_lines`, `title` and `credit` are hand-written copy and stay literal in the overlay. `_blurb`/`_legend_lines`/`_legend_demo` remain in the file for `from_generated`'s use only.

- [ ] **Step 1: Snapshot the current deck dicts, then write the failing test**

The snapshot must be taken BEFORE any edit to `decks.py`, from the literals as they ship:

```bash
python3 - <<'PY'
import sys, json
sys.path.insert(0, "tools")
import decks as D

def plain(deck):
    out = {}
    for k, v in deck.items():
        if k == "spec":
            out[k] = {str(fk): (list(fv) if fk != "_geom" else dict(fv))
                      for fk, fv in v.items()}
        elif k == "chords":
            out[k] = [[m, s, sub, list(f), sorted(r)] for m, s, sub, f, r in v]
        elif k in ("col_root", "col_tone"):
            out[k] = [v.red, v.green, v.blue]
        elif k == "grad":
            out[k] = [[c.red, c.green, c.blue] for c in v]
        elif k == "degrees":
            out[k] = {str(dk): dv for dk, dv in v.items()}
        elif k == "legend_demo":
            out[k] = list(v)
        else:
            out[k] = v
    return out

snap = {i: plain(d) for i, d in
        (("hijaz", D.HIJAZ), ("pygmy", D.PYGMY), ("amara", D.AMARA))}
with open("tests/fixtures/print_decks_v1.json", "w", encoding="utf-8") as fh:
    json.dump(snap, fh, indent=2, ensure_ascii=False, sort_keys=True)
    fh.write("\n")
print("snapshot written")
PY
```

Then add to `tests/test_deck_data.py`:

```python
class PrintDeckSnapshotTest(unittest.TestCase):
    """The print deck dicts are byte-for-byte what they were before the
    canonical file existed. This is the whole acceptance case for the
    decks.py rewrite: the refactor is a content no-op or it is a bug."""

    def test_deck_dicts_match_the_pre_refactor_snapshot(self):
        import decks as D
        want = json.load(open(os.path.join(paths.ROOT, "tests", "fixtures",
                                           "print_decks_v1.json"),
                              encoding="utf-8"))
        got = {i: _plain(d) for i, d in
               (("hijaz", D.HIJAZ), ("pygmy", D.PYGMY), ("amara", D.AMARA))}
        self.assertEqual(got, want)
```

`_plain` is the `plain()` helper above, moved into the test module so the fixture and the assertion share one normaliser.

- [ ] **Step 2: Run it to verify it passes against the literals**

Run: `python3 -m unittest -k PrintDeckSnapshotTest tests.test_deck_data -v`
Expected: PASS. This is the one step in the plan whose test passes before the change - it is a pin, not a spec. It must still pass after Step 3, which is what makes it worth writing.

- [ ] **Step 3: Rewrite `tools/decks.py`**

Add beside `from_generated`:

```python
def _canonical():
    """data/decks.json, keyed by deck id. Read once at import."""
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        "data", "decks.json")
    with open(path, encoding="utf-8") as fh:
        return {d["id"]: d for d in json.load(fh)}


_CANONICAL = _canonical()


def _from_canonical(deck_id, **overlay):
    """A canonical deck + its hand-authored PRINT OVERLAY -> a hifi deck dict.

    The overlay carries only what the shared data does not and CANNOT: the
    measured R/cy baselines, the hand-written title-card copy, and Pygmy's
    blank-card padding preference. Nothing in the overlay may name a key the
    canonical data already owns - validate.py check 1b asserts that.

    NOT from_generated(): that one derives R from geom["ext"], which no
    built-in geom carries, and which would redraw every diagram (see the
    measured deltas at the top of this file - Hijaz 73.0 -> 69.8).
    """
    deck = _CANONICAL[deck_id]
    spec = _spec_from(deck)
    chords = [(c["main"], c["sup"], c["subtitle"], list(c["fields"]),
               set(c["roots"])) for c in deck["chords"]]
    shared = dict(
        name=deck["name"],
        sub=deck["sub"],
        spec=spec,
        chords=chords,
        degrees={int(pc): label for pc, label in deck["degrees"].items()},
        has_bottom=any(v[3] == "bottom" for k, v in spec.items() if k != "_geom"),
        col_root=_hex_color(deck["colors"]["root"]),
        col_tone=_hex_color(deck["colors"]["tone"]),
        grad=(_hex_color(deck["colors"]["ga"]), _hex_color(deck["colors"]["gb"])),
    )
    clash = sorted(set(shared) & set(overlay))
    if clash:
        raise ValueError("%s: print overlay shadows canonical data: %s"
                         % (deck_id, ", ".join(clash)))
    shared.update(overlay)
    return shared
```

Then replace the three literal blocks. Hijaz becomes:

```python
HIJAZ = _from_canonical(
    "hijaz",
    title="C# Hijaz / Orion 9 - Chord Cards",
    credit="C# HIJAZ / ORION",
    R=73.0, cy=126.0, y_note=30.0, y_num=14.0,
    legend_demo=(5, 3),
    blurb=["C#3  |  G#3  B3  C#4  D4  F4  F#4  G#4  B4",
           "PHRYGIAN DOMINANT, NO b6   -   18 CHORDS"],
    legend_lines=["NOTE NAME + OCTAVE INSIDE EACH TONEFIELD",
                  "TONEFIELD NUMBERS RUN 1 - 8 FROM THE LOWEST NOTE"],
)
```

Pygmy and Amara follow the same shape, each copying its own committed literals verbatim (Pygmy additionally keeps `blank_cards=7`). Add `import json, os` at the top. Delete `HIJAZ_SPEC`, `HIJAZ_CHORDS`, `PYGMY_SPEC`, `PYGMY_CHORDS`, `AMARA_SPEC`, `AMARA_CHORDS`. Keep `from reportlab.lib.colors import Color` - `_hex_color` returns one.

- [ ] **Step 4: Run the snapshot test, then rebuild and diff the PDFs**

```bash
python3 -m unittest -k PrintDeckSnapshotTest tests.test_deck_data -v
python3 -m unittest discover tests
python3 tools/validate.py
(cd tools && python3 decks.py)
python3 -m unittest -k test_committed_pdfs_match_a_fresh_build tests.test_pdf_build -v
git checkout -- '*.pdf'
```
Expected: snapshot PASS, suite green, validate 0, and the staleness test PASS - it compares EXTRACTED TEXT, not bytes, so a reportlab creation-date stamp does not fail it. `git checkout -- '*.pdf'` discards the harmless binary churn; nothing about the cards changed, so the committed PDFs stay committed.

- [ ] **Step 5: Re-run Task 3's drift test for the right reason**

Run: `python3 -m unittest -k test_validate_py_fails_when_index_html_drifts tests.test_deck_data -v`
Expected: PASS - and now it passes because check 1 caught index.html drifting from `data/decks.json`, not because it caught it drifting from a second hand-maintained copy. Update the test's docstring to say so.

- [ ] **Step 6: Commit**

```bash
git add tools/decks.py tests/fixtures/print_decks_v1.json tests/test_deck_data.py
git commit -m "tools/decks.py derives its deck dicts from data/decks.json"
```

---

### Task 5: Repoint every data mutant at the new drift vector

**Files:**
- Modify: `tools/regen_data_mutants.py` - the module docstring, `TRACKED` (`:33`), `apply_json` (`:152`), and **all eleven** `b_*` entries in `MUTANTS` (`:49-150`)
- Delete/replace: `tests/mutants/b_validate_desync.patch`
- Create: `tests/mutants/b_decks_json_desync.patch`
- Regenerate: the other ten `tests/mutants/b_*.patch`
- Re-author by hand: `tests/mutants/c_deck_data_drift.patch` (and `c_gen_omitted_vacuous.patch` only if Task 4 rewrites the comment block above `GENERATED_OMITTED`)

**Why this task is mandatory, not tidy-up, and why it is eleven mutants and not one.**
`grep -l "tools/decks.py" tests/mutants/*.patch` returns 19 patches. Eleven are the
`b_*` family, every one of which carries an exact `decks.py` literal replacement that
Task 4 deletes (`b_degree_missing`, `b_ding_in_voicing`, `b_doubled_pitch_class`,
`b_duplicate_voicing`, `b_layout_angle_swap`, `b_midi_off_by_one`,
`b_power_chord_fifth`, `b_pygmy_badge_count`, `b_root_not_in_voicing`,
`b_cluster_forced_only`, `b_validate_desync`). A stale patch is pushed into
`SURVIVORS` and forces the mutation gate to `exit 1`, so this is a red CI, not a
silent hole - but the point is to keep the gate HONEST, not merely green.

**The lockstep partner changes, and that is the load-bearing part.** The module
docstring records the design: "the b_* mutants edit tools/decks.py and the DECKS JSON
in index.html in lockstep (so validate.py stays green and only the named test catches
them)". After Task 4 `decks.py` holds no literal to edit, so every `replacements` list
becomes `[]` and the mutation is JSON-only. `apply_json` (`:152-160`) writes
`index.html` alone. `data/decks.json` would then disagree with it, `validate.py`
check 1 would fail, and **every one of the ten behavioural mutants would be killed by
`test_validate_py_passes` instead of by the test named in its own header** - the exact
invariant the docstring exists to protect. The new lockstep partner is
`data/decks.json`, so `apply_json` must write BOTH files by default, and the one
mutant whose whole mechanism IS the disagreement opts out explicitly.

- [ ] **Step 1: Confirm what is stale, do not assume it**

```bash
python3 tools/regen_data_mutants.py --check
bash tests/mutation_check.sh   # the only thing that sees the c_* patches
```
Expected from `--check`: exit 1 listing **all eleven** `b_*` patches
(`check_only()` at `:110` iterates `sorted(MUTANTS)` and therefore never reports a
hand-written `c_*` patch - `mutation_check.sh` is where those surface). If any `b_*`
patch still applies, STOP and read why: a surviving patch means a `decks.py` literal
survived Task 4 that should not have.

- [ ] **Step 2: Teach the generator about `data/decks.json`**

```python
CANONICAL = "data/decks.json"
TRACKED = [INDEX, DECKS_PY, CANONICAL]
```

`TRACKED` feeds the `git diff --quiet` dirty-tree guard at `:192`. Without the new
entry the generator will happily run against a modified canonical file and bake a
mutation into every patch it writes.

- [ ] **Step 3: Make `apply_json` write both copies in lockstep**

```python
def apply_json(mutator, sync=True):
    """Apply a JSON mutation to index.html, and to data/decks.json unless sync=False.

    sync=True is the lockstep case: both copies move together, validate.py check 1
    stays green, and only the test named in the mutant's header fails.
    sync=False is the DESYNC case - exactly one mutant (b_decks_json_desync) wants
    index.html to disagree with canonical, which is what check 1 exists to catch.
    """
    html = open(INDEX).read()
    m = re.search(r"^const DECKS = (\[.*\]);$", html, re.M)
    decks = json.loads(m.group(1))
    assert json.dumps(decks) == m.group(1), "serialisation format drifted"
    mutator(decks)
    line = "const DECKS = " + json.dumps(decks) + ";"
    html = PATTERN.sub(lambda _m: line, html, count=1)
    open(INDEX, "w").write(html)
    assert json.loads(re.search(r"^const DECKS = (\[.*\]);$",
                                open(INDEX).read(), re.M).group(1)) == decks
    if sync:
        with open(CANONICAL, "w", encoding="utf-8") as fh:
            json.dump(decks, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
```

Two traps this closes. First, `html.replace(m.group(0), ...)` is the naive path
CLAUDE.md warns about only for `re.sub`; the degrees carry U+00B0 and the safe form
is the lambda replacement plus a re-parse of the WRITTEN file, so use both here as
Task 2's `sync_decks.py` does. Second, `json.dump(..., indent=2, ensure_ascii=False)`
plus the trailing newline must match Task 1's writer byte-for-byte, or every mutant
patch carries a whole-file reformat of `data/decks.json` as noise.

- [ ] **Step 4: Rewrite the ten behavioural mutants as JSON-only lockstep mutants**

For each of `b_degree_missing`, `b_ding_in_voicing`, `b_doubled_pitch_class`,
`b_duplicate_voicing`, `b_layout_angle_swap`, `b_midi_off_by_one`,
`b_power_chord_fifth`, `b_pygmy_badge_count`, `b_root_not_in_voicing`,
`b_cluster_forced_only`: replace the `(old, new)` `decks.py` replacement list with
`[]`. **Change nothing else** - not the header lines, not the lambda. The mutation
INTENT must be byte-identical across the regeneration; that is the only thing that
distinguishes a repoint from a silent weakening.

Two header lines do become false and must be corrected, and only these two:

- `b_layout_angle_swap` says "swapped in BOTH index.html and tools/decks.py, so
  validate.py's cross-check still passes". Rewrite to "swapped in BOTH index.html and
  data/decks.json, so validate.py's cross-check still passes".
- `b_ding_in_voicing` says "chord invariant and validate.py stay green" - still true,
  but for the new reason. Append `# (lockstep is now index.html + data/decks.json.)`

Note `chord(decks, id, main, sup)` returns the FIRST main/sup match, which for Pygmy
Cm7/Eb7 is the LOW VOICING alternate; the mutants that must hit a specific register
already key on subtitle via `card()`. Do not "simplify" any lambda back to `chord()`.

- [ ] **Step 5: Replace `b_validate_desync` with the desync mutant**

```python
    "b_decks_json_desync": (
        ["# kills: test_validate_py_passes",
         "# suite: python3 -m unittest -k test_validate_py_passes tests.test_deck_data",
         "# The canonical data/decks.json drifts from the copy embedded in",
         "# index.html - the app would ship card copy the print deck does not,",
         "# which is exactly the failure the single-source refactor removes the",
         "# HAND-EDIT path to and therefore has to keep a GATE on: index.html is",
         "# a committed generated file and an editor or a merge can still write",
         "# inside it. This is the check-4 analogue for data.",
         "# NOTE: this replaced b_validate_desync (2026-09-16), whose mechanism",
         "# - tools/decks.py holding a second hand-maintained copy - no longer",
         "# exists. Do not restore that one; there is nothing left to desync.",
         "# This is the ONE mutant that calls apply_json(sync=False); every",
         "# other b_* moves both copies together."],
        [],
        lambda D: card(D, "hijaz", "C# MAJOR").update(subtitle="C# MAJOUR"),
    ),
```

and give the dispatch loop a way to reach `sync=False` - the least-clever form is a
module-level set, checked where `apply_json` is called:

```python
DESYNC_ONLY = {"b_decks_json_desync"}
...
    apply_json(mutator, sync=name not in DESYNC_ONLY)
```

A fourth tuple element would be more elegant and would force an edit to all eleven
entries for one mutant's benefit; the set keeps the diff on the entries to `[]`.

- [ ] **Step 6: Update the module docstring**

The docstring states the lockstep invariant in terms of `tools/decks.py`. Rewrite that
sentence to name `data/decks.json` as the partner, and keep the sentence that follows
("Any data change therefore turns every one of them STALE and fails the mutation
gate") - it is still exactly true, and it is the reason this task exists.

- [ ] **Step 7: Re-author the two hand-written `c_*` patches that Task 4 restales**

These are NOT in `MUTANTS` and no tool regenerates them.

```bash
grep -n 'AMARA_CHORDS\|F MAJOR 7' tests/mutants/c_deck_data_drift.patch
git apply --check tests/mutants/c_deck_data_drift.patch || echo STALE
git apply --check tests/mutants/c_gen_omitted_vacuous.patch || echo STALE
```

- `c_deck_data_drift` (`@@ -158,7 +158,7 @@ AMARA_CHORDS = [`) anchors on
  `("Fmaj", "7", "F MAJOR 7", [5, 1, 2, 4], {5}),`, a literal Task 4 deletes. Its
  MECHANISM survives - deck data changed without rebuilding the PDFs, killing
  `test_committed_pdfs_match_a_fresh_build` - so repoint it, do not delete it: hand-write
  the same voicing truncation against `data/decks.json` instead, leaving the header
  lines untouched.
- `c_gen_omitted_vacuous` (`@@ -191,6 +191,14 @@ AMARA = dict(`) anchors on the comment
  block above `GENERATED_OMITTED`, whose text ("the three built-in dicts above and their
  spec/chord literals stay byte-identical") becomes false after Task 4. **If Task 4 or
  Task 6 rewrites that comment, this patch restales and must be re-authored against the
  new context.** If the comment is left alone the patch still applies; verify with
  `git apply --check`, never by reasoning.

- [ ] **Step 8: Regenerate on a clean tree and confirm each mutant kills the RIGHT test**

```bash
git status --short          # MUST be empty; the generator anchors on committed bytes
rm tests/mutants/b_validate_desync.patch
python3 tools/regen_data_mutants.py
python3 tools/regen_data_mutants.py --check
bash tests/mutation_check.sh
```
Expected: `--check` exits 0 with all 11 applying; the gate prints `MUTATION GATE PASSED`.
Then audit for silent weakening the only way that works on a one-line JSON literal -
parse the `-const DECKS` / `+const DECKS` lines as JSON on both revisions and diff the
per-deck delta, rather than eyeballing raw `-`/`+` lines:

```bash
for p in tests/mutants/b_*.patch; do
  echo "== $p"; grep -E '^[-+][^-+]' "$p" | grep -v '^\(+++\|---\)' | cut -c1-120
done
```
Each behavioural mutant must show exactly one `data/decks.json` hunk and one
`index.html` hunk carrying the SAME semantic delta; `b_decks_json_desync` must show an
`index.html` hunk and NO `data/decks.json` hunk. A behavioural mutant missing its
canonical hunk is the failure mode this task exists to prevent.

- [ ] **Step 9: Verify each mutant fails by NAME, not by "something failed"**

For at least `b_layout_angle_swap`, `b_cluster_forced_only` and `b_decks_json_desync`,
apply the patch, run the suite, and confirm the failing test is the one in the header -
specifically that the first two do NOT fail `test_validate_py_passes`. That single
assertion is the whole proof that the lockstep repoint worked.

- [ ] **Step 10: Commit**

```bash
git add tools/regen_data_mutants.py tests/mutants/
git commit -m "Repoint the data mutants at the canonical-vs-index drift vector"
```

---

### Task 6: Rewrite the deck-data procedure in CLAUDE.md, README.md and tests/CONTRACT.md

**`tests/CONTRACT.md` is in scope too.** Its rule 2 governs what `tests/test_deck_data.py`
may import (today: never `tools/decks.py` or `tools/hifi.py`, because comparing the app data
to its own generator is a mirror). This plan adds `CanonicalSourceTest` to that file reading
`data/decks.json` directly - a data file, not the generator, so rule 2 is satisfied, but the
rule's RATIONALE now needs the canonical file named in it or the next reader will not be able
to tell which side of the line a new test falls on. (Found by the outside voice.)

**Files:**
- Modify: `CLAUDE.md` - "Repo layout", "Hard constraints", "Print pipeline" (the "If deck data changes" paragraph), "Known pitfalls"
- Modify: `README.md` if it names the old procedure (grep first; do not invent a section)

**Why it is a task and not a footnote.** CLAUDE.md is the contract every future session reads. Its current "If deck data changes: edit `decks.py`, rebuild PDFs, re-export the JSON and re-inject into `index.html`" becomes actively wrong the moment Task 4 lands - it would send the next session to edit a file that no longer holds the data.

- [ ] **Step 1: Find every mention**

```bash
grep -n "decks.py\|re-inject\|DECKS\|re-export" CLAUDE.md README.md
```

- [ ] **Step 2: Rewrite the procedure paragraph**

Replace the "If deck data changes" paragraph in CLAUDE.md's "Print pipeline" section with:

```
If deck data changes: edit `data/decks.json` - the ONE canonical copy - then
run `python3 tools/sync_decks.py` to re-inject it into `index.html`, rebuild
the PDFs with `python3 tools/decks.py`, and run
`python3 tools/regen_data_mutants.py` on a clean tree (the data mutants anchor
on the DECKS line and go stale on every data change). `tools/validate.py`
check 1 fails if `index.html` is out of sync; `tools/decks.py` reads the
canonical file directly and carries only the PRINT OVERLAY (R, cy, title,
credit, blurb, legend copy, blank-card padding) as literals.
```

- [ ] **Step 3: Add the file to "Repo layout" and the constraint to "Hard constraints"**

Under "Repo layout": `- `data/decks.json` - THE canonical deck data. `index.html`'s `const DECKS` line and `tools/decks.py`'s deck dicts are both derived from it.`

Under "Hard constraints", after the engine-regions bullet, a parallel bullet: **The `const DECKS` line in `index.html` is GENERATED** from `data/decks.json` by `tools/sync_decks.py`; never hand-edit it, and resolve a conflict inside it by taking either side and re-running the tool.

- [ ] **Step 4: Sharpen the re-injection pitfall note**

CLAUDE.md's "Data re-injection" pitfall stays - the U+00B0 lambda trap is now encoded in `sync_decks.py` rather than done by hand, so amend it to say the tool owns it and that its re-parse verification is the reason the tool is trusted.

- [ ] **Step 5: Verify nothing else references the old flow**

```bash
grep -rn "edit .*decks.py\|re-inject" CLAUDE.md README.md docs/ tools/ | grep -v docs/plans/
python3 -m unittest discover tests && node --test "tests/*.test.js"
python3 tools/validate.py
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "Document data/decks.json as the single source of deck data"
```

---

## Acceptance criteria for the whole plan

1. `git diff` on the merge shows **zero change** to the `const DECKS` line in `index.html` (8567-byte payload, unchanged) and zero change to the six committed PDFs' extracted text.
2. `python3 tools/sync_decks.py --check` exits 0 on the merged tree, and exits 1 on a tree whose `index.html` was hand-edited.
3. `python3 tools/validate.py` exits 0 with checks 1, 1b, 2, 3, 4 all OK, and `total == 61` cards is unchanged.
4. `tests/fixtures/print_decks_v1.json` proves the three print deck dicts are identical to their pre-refactor values.
5. `python3 tools/regen_data_mutants.py --check` reports **0 stale of 11** `b_*` mutants (the patch COUNT in `tests/mutants/` stays 267: one deleted, one added), and `tests/mutation_check.sh` prints `MUTATION GATE PASSED`. `--check` covers only `MUTANTS`; the hand-written `c_*` patches are proven by the gate run, not by `--check`.
5b. Under `b_layout_angle_swap` and `b_cluster_forced_only` the failing test is the one named in the patch header and **not** `test_validate_py_passes` - the proof that the `index.html` + `data/decks.json` lockstep survived the repoint. Under `b_decks_json_desync`, `test_validate_py_passes` is the test that fails.
6. `tools/decks.py` contains no chord list, no field spec and no `degrees` dict - grep for `"C# MAJOR"` and `"rim", 270` returns nothing in that file.
7. Editing one subtitle in `data/decks.json` + `sync_decks.py` + `decks.py` changes the app AND the PDF, demonstrated once by hand and reverted.
8. `_from_canonical()` raises `ValueError` when an overlay key shadows a canonical one, asserted by a test that passes a deliberate clash (e.g. `_from_canonical("hijaz", degrees={})`) - the guard is the only thing standing between a typo'd overlay and a silent print/app divergence, so it needs its own test rather than being exercised only by the happy path.
9. `git apply --check` passes on all 19 `tests/mutants/*.patch` files that touch `tools/decks.py`, including the eight hand-written `c_*` ones.

## What this unlocks (not in scope here)

With one canonical file, the engine-adoption question from `tests/fixtures/divergence_v1.json` (hijaz 18->19, pygmy 27->52, amara 16->25) reduces to: run `tools/gen_deck.js` per seed, write the result to `data/decks.json`, run `sync_decks.py` and `decks.py`. It becomes a reviewable diff of ONE file instead of a simultaneous edit of two. That remains an owner decision and gets its own plan.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | issues_found | 12 raised, 3 verified as plan defects, 6 folded |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 9 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**CODEX:** Found three defects the four-section review missed, all verified against source
before folding: `blank_cards=7` not 9 (`tools/decks.py:119`); built-in colours are
3-decimal `Color` literals that `_hex_color()` does not reproduce, so the Task 4 snapshot
gate would have failed on its first run (`:49`); and the plan's "app and print can no longer
disagree" overclaims, since Pygmy's print blurb already reads `25 CHORDS` on a 27-card deck
(`:124`). Three further items folded: `validate.py`'s docstring, `sync_decks.py` argv
parsing, `tests/CONTRACT.md`. Rejected two: lazy-loading `_CANONICAL` (over-engineering for
a repo-local tool) and "CLAUDE.md is unaddressed" (Task 6 already owns it).

**CROSS-MODEL:** No tension. Codex found what the review missed rather than contradicting
it; both reviewers agree `data/decks.json` should be canonical and that the mutant corpus is
the plan's highest-risk surface.

**VERDICT:** ENG CLEARED — ready to implement. Scope reduced at Step 0 per the owner's
choice (keep `data/decks.json` canonical, rewrite Task 5 to cover all 11 `b_*` mutants).
Blocking work before merge: T1 (repoint the mutants), T2 (colours stay overlay literals),
T3 (re-author `c_deck_data_drift.patch`).

NO UNRESOLVED DECISIONS
