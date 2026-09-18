#!/usr/bin/env python3
"""Regenerate the tests/mutants/b_*.patch data mutants from their INTENT.

Run from the repo root on a clean tree after ANY change to deck data:

    python3 tools/regen_data_mutants.py

    python3 tools/regen_data_mutants.py --check   # regenerate NOTHING; exit 1
                                                  # if any b_*.patch is stale

Why this exists: the b_* mutants edit data/decks.json and the DECKS JSON in
index.html in lockstep (so validate.py stays green and only the named test
catches them), and they anchor on the single-line DECKS literal. The lockstep
partner used to be tools/decks.py, which held a second hand-maintained copy of
the data; since 2026-09-16 it derives from data/decks.json and has no literal
left to edit, so every behavioural mutant's decks.py replacement list is []. Any data
change therefore turns every one of them STALE and fails the mutation gate.
Re-deriving them from intent takes seconds; hand-editing 17 KB diffs does not.

Adding a mutant: append an entry to MUTANTS - header lines (the first must be
"# kills: <test name>"), exact-string replacements for decks.py (normally [];
see above), and a mutator for the parsed app JSON. Name it in DESYNC_ONLY if it
wants index.html and data/decks.json to DISAGREE. Keep each mutant
orthogonal: it must fail ONLY the test it names, or the gate's guarantee that
that test is live is void (tests/mutation_check.sh runs the named test).
"""
import json
import os
import re
import subprocess
import sys

DECKS_PY = "tools/decks.py"
INDEX = "index.html"
CANONICAL = "data/decks.json"
OUT = "tests/mutants"
TRACKED = [INDEX, DECKS_PY, CANONICAL]


def sh(*a):
    return subprocess.run(a, capture_output=True, text=True, check=True).stdout


def chord(decks, deck_id, main, sup):
    d = next(x for x in decks if x["id"] == deck_id)
    return next(c for c in d["chords"] if c["main"] == main and c["sup"] == sup)


def card(decks, deck_id, subtitle):
    d = next(x for x in decks if x["id"] == deck_id)
    return next(c for c in d["chords"] if c["subtitle"] == subtitle)


# name -> (header lines, [(old, new) exact decks.py replacements], json mutator or None)
MUTANTS = {
    "b_degree_missing": (
        ["# kills: test_degrees_cover_chord_roots",
         "# suite: python3 -m unittest -k test_degrees_cover_chord_roots tests.test_deck_data",
         "# Amara loses the IV degree, leaving G5 and Gsus4 without a scale degree."],
        [],
        lambda D: next(x for x in D if x["id"] == "amara")["degrees"].pop("7"),
    ),
    "b_ding_in_voicing": (
        ["# kills: test_ding_never_in_voicing",
         "# suite: python3 -m unittest -k test_ding_never_in_voicing tests.test_deck_data",
         "# Hijaz B MINOR voiced with the ding added. Its pitch class (C#) is not",
         "# already in the chord, so no highlighting invariant breaks.",
         "# (Lockstep is now index.html + data/decks.json.)"],
        [],
        lambda D: chord(D, "hijaz", "Bm", "").update(fields=[2, 4, 6, 0]),
    ),
    "b_doubled_pitch_class": (
        ["# kills: test_no_doubled_pitch_classes",
         "# suite: python3 -m unittest -k test_no_doubled_pitch_classes tests.test_deck_data",
         "# Hijaz B MINOR ADD 9 doubles B (B3 + B4) in one voicing."],
        [],
        lambda D: chord(D, "hijaz", "Bm", "add9").update(fields=[2, 4, 6, 3, 8]),
    ),
    "b_duplicate_voicing": (
        ["# kills: test_voicings_unique_within_deck",
         "# suite: python3 -m unittest -k test_voicings_unique_within_deck tests.test_deck_data",
         "# Amara Csus4 given C major's exact field list - a duplicate card that",
         "# validate.py cannot see (it only rejects duplicate fields WITHIN a card)."],
        [],
        lambda D: chord(D, "amara", "Csus", "4").update(fields=[2, 4, 6]),
    ),
    "b_layout_angle_swap": (
        ["# kills: test_layouts_match_spec",
         "# suite: python3 -m unittest -k test_layouts_match_spec tests.test_deck_data",
         "# Hijaz rim angles 4 (180) and 6 (135) swapped in BOTH index.html and",
         "# data/decks.json, so validate.py's cross-check still passes: only the",
         "# CLAUDE.md layout table catches it."],
        [],
        lambda D: (next(x for x in D if x["id"] == "hijaz")["fields"]["4"].__setitem__(4, 135),
                   next(x for x in D if x["id"] == "hijaz")["fields"]["6"].__setitem__(4, 180)),
    ),
    "b_midi_off_by_one": (
        ["# kills: test_midi_matches_note_name",
         "# suite: python3 -m unittest -k test_midi_matches_note_name tests.test_deck_data",
         "# Amara ding D3 given MIDI 51 (= Eb3). The ding is in no voicing, so every",
         "# chord invariant and validate.py stay green; only the note-name <-> MIDI",
         "# pitch-class check (and the layout table) notice."],
        [],
        lambda D: next(x for x in D if x["id"] == "amara")["fields"]["0"].__setitem__(2, 51),
    ),
    "b_power_chord_fifth": (
        ["# kills: test_power_chords_are_root_and_fifth",
         "# suite: python3 -m unittest -k test_power_chords_are_root_and_fifth tests.test_deck_data",
         "# Amara G5 voiced G4 + C5: a fourth above the root, not a fifth. C5 sits",
         "# above G4, so the cluster rule is satisfied and only the fifth check fails."],
        [],
        lambda D: chord(D, "amara", "G5", "").update(fields=[6, 8]),
    ),
    "b_pygmy_badge_count": (
        ["# kills: test_badge_counts_bottom_notes_in_the_voicing",
         "# suite: python3 -m unittest -k test_badge_counts_bottom_notes_in_the_voicing tests.test_deck_data",
         "# Pygmy Fsus4 voiced G4 + C5 instead of the bottom-shell Bb3, so the badge",
         "# count drops from 1 to 0. Both tones sit ABOVE the root, so the cluster",
         "# rule is satisfied and only the badge test sees it."],
        [],
        lambda D: chord(D, "pygmy", "Fsus", "4").update(fields=[5, 6, 8]),
    ),
    "b_root_not_in_voicing": (
        ["# kills: test_roots_appear_in_voicing",
         "# suite: python3 -m unittest -k test_roots_appear_in_voicing tests.test_deck_data",
         "# Amara F MAJOR 7 rooted on field 7 (A4), which its voicing does not use."],
        [],
        lambda D: chord(D, "amara", "Fmaj", "7").update(roots=[7]),
    ),
    "b_cluster_forced_only": (
        ["# kills: test_forced_tones_cluster_below_root",
         "# suite: python3 -m unittest -k test_forced_tones_cluster_below_root tests.test_deck_data",
         "# Pygmy Cm7 put back to its pre-2026-09-15 cluster: Bb3 is bottom-shell-only",
         "# and forces nothing, yet Eb and G sit below the root at Eb3/G3. validate.py,",
         "# voicing uniqueness and the badge count (2, also wrong but asserted by a",
         "# different test) do not see it - only the cluster rule in CLAUDE.md rule 3",
         "# catches it."],
        [],
        lambda D: card(D, "pygmy", "C MINOR 7 ( = Eb6 )").update(fields=[3, 103, 1, 104]),
    ),
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
}

# The one mutant whose MECHANISM is the disagreement between the two copies.
# A fourth tuple element would be tidier and would force an edit to all eleven
# entries for one mutant's benefit; this set keeps that diff at [].
DESYNC_ONLY = {"b_decks_json_desync"}


PATTERN = re.compile(r"^const DECKS = (\[.*\]);$", re.M)


def apply_json(mutator, sync=True):
    """Apply a JSON mutation to index.html, and to data/decks.json unless sync=False.

    sync=True is the lockstep case: both copies move together, validate.py
    check 1 stays green, and only the test named in the mutant's header fails.
    sync=False is the DESYNC case - exactly one mutant (b_decks_json_desync)
    wants index.html to disagree with canonical, which check 1 exists to catch.
    """
    html = open(INDEX, encoding="utf-8").read()
    m = PATTERN.search(html)
    decks = json.loads(m.group(1))
    assert json.dumps(decks) == m.group(1), "serialisation format drifted"
    mutator(decks)
    # A LAMBDA replacement plus a re-parse of the WRITTEN file: the degrees
    # carry U+00B0 and re's replacement template eats backslash escapes
    # (CLAUDE.md, "Known pitfalls"), and a smoke test on stale data passes.
    line = "const DECKS = " + json.dumps(decks) + ";"
    html = PATTERN.sub(lambda _m: line, html, count=1)
    open(INDEX, "w", encoding="utf-8").write(html)
    again = PATTERN.search(open(INDEX, encoding="utf-8").read())
    assert again is not None and json.loads(again.group(1)) == decks, \
        "re-injection did not land"
    if sync:
        # Byte-identical to Task 1's writer, or every patch carries a
        # whole-file reformat of data/decks.json as noise.
        with open(CANONICAL, "w", encoding="utf-8") as fh:
            json.dump(decks, fh, indent=2, ensure_ascii=False)
            fh.write("\n")


def check_only():
    """Exit 0 when every b_*.patch still applies, 1 listing the stale ones.

    Every path in this file is repo-root-relative, so --check resolves them from
    the repo root and works from any working directory (CI runs it from the
    checkout root; a human may not).
    """
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    stale = []
    for name in sorted(MUTANTS):
        patch = f"{OUT}/{name}.patch"
        if not os.path.exists(patch):
            stale.append(f"{patch} (missing)")
            continue
        if subprocess.run(["git", "apply", "--check", patch],
                          capture_output=True).returncode != 0:
            stale.append(patch)
    if stale:
        print("STALE data mutants - rerun tools/regen_data_mutants.py on a clean tree:")
        for s in stale:
            print("  " + s)
        return 1
    print(f"all {len(MUTANTS)} data mutants apply cleanly")
    return 0


if len(sys.argv) > 1:
    if sys.argv[1:] != ["--check"]:
        print(f"usage: {sys.argv[0]} [--check]", file=sys.stderr)
        sys.exit(2)
    sys.exit(check_only())

if subprocess.run(["git", "diff", "--quiet", "--"] + TRACKED).returncode != 0:
    sys.exit("REFUSING: tracked files already modified")

for name, (header, replacements, mutator) in MUTANTS.items():
    src = open(DECKS_PY).read()
    for old, new in replacements:
        assert src.count(old) == 1, (name, "anchor count", src.count(old), old)
        src = src.replace(old, new)
    open(DECKS_PY, "w").write(src)
    if mutator is not None:
        apply_json(mutator, sync=name not in DESYNC_ONLY)
    diff = sh("git", "diff", "--", *TRACKED)
    assert diff.strip(), (name, "empty diff")
    # Drop git's `index <preimage>..<postimage>` lines. They name the blob this
    # patch was cut from, which the next commit to the file invalidates, and
    # nothing reads them: the sweep applies with plain `git apply` and reverts
    # with `git apply -R`, neither of which resolves a blob by hash. Keeping
    # them just means every regeneration ships a fresh set of claims that are
    # false by the following commit (queue row 86, N9). Pinned by
    # tests/mutation_harness.test.js.
    diff = "\n".join(l for l in diff.split("\n")
                      if not re.match(r"index [0-9a-f]{7,40}\.\.[0-9a-f]{7,40}", l))
    with open(f"{OUT}/{name}.patch", "w") as f:
        f.write("\n".join(header) + "\n" + diff)
    subprocess.run(["git", "checkout", "--"] + TRACKED, check=True)
    ok = subprocess.run(["git", "apply", "--check", f"{OUT}/{name}.patch"],
                        capture_output=True).returncode == 0
    print(f"{'ok   ' if ok else 'FAIL '} {name}")

print(f"\nregenerated {len(MUTANTS)} mutants; tree clean: "
      f"{subprocess.run(['git','diff','--quiet','--']+TRACKED).returncode == 0}")
