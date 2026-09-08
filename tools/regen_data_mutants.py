#!/usr/bin/env python3
"""Regenerate the tests/mutants/b_*.patch data mutants from their INTENT.

Run from the repo root on a clean tree after ANY change to deck data:

    python3 tools/regen_data_mutants.py

Why this exists: the b_* mutants edit tools/decks.py and the DECKS JSON in
index.html in lockstep (so validate.py stays green and only the named test
catches them), and they anchor on the single-line DECKS literal. Any data
change therefore turns every one of them STALE and fails the mutation gate.
Re-deriving them from intent takes seconds; hand-editing 17 KB diffs does not.

Adding a mutant: append an entry to MUTANTS - header lines (the first must be
"# kills: <test name>"), exact-string replacements for decks.py, and a mutator
for the parsed app JSON (None for a decks.py-only mutant). Keep each mutant
orthogonal: it must fail ONLY the test it names, or the gate's guarantee that
that test is live is void (tests/mutation_check.sh runs the named test).
"""
import json
import re
import subprocess
import sys

DECKS_PY = "tools/decks.py"
INDEX = "index.html"
OUT = "tests/mutants"
TRACKED = [INDEX, DECKS_PY]


def sh(*a):
    return subprocess.run(a, capture_output=True, text=True, check=True).stdout


def chord(decks, deck_id, main, sup):
    d = next(x for x in decks if x["id"] == deck_id)
    return next(c for c in d["chords"] if c["main"] == main and c["sup"] == sup)


# name -> (header lines, [(old, new) exact decks.py replacements], json mutator or None)
MUTANTS = {
    "b_degree_missing": (
        ["# kills: test_degrees_cover_chord_roots",
         "# Amara loses the IV degree, leaving G5 and Gsus4 without a scale degree."],
        [('degrees={2: "i", 9: "v", 7: "IV", 0: "bVII", 5: "bIII"},',
          'degrees={2: "i", 9: "v", 0: "bVII", 5: "bIII"},')],
        lambda D: next(x for x in D if x["id"] == "amara")["degrees"].pop("7"),
    ),
    "b_ding_in_voicing": (
        ["# kills: test_ding_never_in_voicing",
         "# Hijaz B MINOR voiced with the ding added. Its pitch class (C#) is not",
         "# already in the chord, so no highlighting invariant breaks."],
        [('("Bm", "", "B MINOR", [2, 4, 6], {2}),',
          '("Bm", "", "B MINOR", [2, 4, 6, 0], {2}),')],
        lambda D: chord(D, "hijaz", "Bm", "").update(fields=[2, 4, 6, 0]),
    ),
    "b_doubled_pitch_class": (
        ["# kills: test_no_doubled_pitch_classes",
         "# Hijaz B MINOR ADD 9 doubles B (B3 + B4) in one voicing."],
        [('("Bm", "add9", "B MINOR ADD 9", [2, 4, 6, 3], {2}),',
          '("Bm", "add9", "B MINOR ADD 9", [2, 4, 6, 3, 8], {2}),')],
        lambda D: chord(D, "hijaz", "Bm", "add9").update(fields=[2, 4, 6, 3, 8]),
    ),
    "b_duplicate_voicing": (
        ["# kills: test_voicings_unique_within_deck",
         "# Amara Csus4 given C major's exact field list - a duplicate card that",
         "# validate.py cannot see (it only rejects duplicate fields WITHIN a card)."],
        [('("Csus", "4", "SUSPENDED CHORD", [2, 5, 6], {2}),',
          '("Csus", "4", "SUSPENDED CHORD", [2, 4, 6], {2}),')],
        lambda D: chord(D, "amara", "Csus", "4").update(fields=[2, 4, 6]),
    ),
    "b_layout_angle_swap": (
        ["# kills: test_layouts_match_spec",
         "# Hijaz rim angles 4 (180) and 6 (135) swapped in BOTH index.html and",
         "# tools/decks.py, so validate.py's cross-check still passes: only the",
         "# CLAUDE.md layout table catches it."],
        [('4:  ("D",  4, 62, "rim", 180, "4"),', '4:  ("D",  4, 62, "rim", 135, "4"),'),
         ('6:  ("F#", 4, 66, "rim", 135, "6"),', '6:  ("F#", 4, 66, "rim", 180, "6"),')],
        lambda D: (next(x for x in D if x["id"] == "hijaz")["fields"]["4"].__setitem__(4, 135),
                   next(x for x in D if x["id"] == "hijaz")["fields"]["6"].__setitem__(4, 180)),
    ),
    "b_midi_off_by_one": (
        ["# kills: test_midi_matches_note_name",
         "# Amara ding D3 given MIDI 51 (= Eb3). The ding is in no voicing, so every",
         "# chord invariant and validate.py stay green; only the note-name <-> MIDI",
         "# pitch-class check (and the layout table) notice."],
        [('0: ("D", 3, 50, "ding", None, "Ding"),', '0: ("D", 3, 51, "ding", None, "Ding"),')],
        lambda D: next(x for x in D if x["id"] == "amara")["fields"]["0"].__setitem__(2, 51),
    ),
    "b_power_chord_fifth": (
        ["# kills: test_power_chords_are_root_and_fifth",
         "# Amara G5 voiced G4 + C5: a fourth above the root, not a fifth. C5 sits",
         "# above G4, so the cluster rule is satisfied and only the fifth check fails."],
        [('("G5", "", "POWER CHORD", [6, 3], {6}),', '("G5", "", "POWER CHORD", [6, 8], {6}),')],
        lambda D: chord(D, "amara", "G5", "").update(fields=[6, 8]),
    ),
    "b_pygmy_badge_count": (
        ["# kills: test_badge_counts_bottom_notes_in_the_voicing",
         "# Pygmy Fsus4 voiced G4 + C5 instead of the bottom-shell Bb3, so the badge",
         "# count drops from 1 to 0. Both tones sit ABOVE the root, so the cluster",
         "# rule is satisfied and only the badge test sees it."],
        [('("Fsus", "4", "SUSPENDED CHORD", [5, 104, 3], {5}),',
          '("Fsus", "4", "SUSPENDED CHORD", [5, 6, 8], {5}),')],
        lambda D: chord(D, "pygmy", "Fsus", "4").update(fields=[5, 6, 8]),
    ),
    "b_root_not_in_voicing": (
        ["# kills: test_roots_appear_in_voicing",
         "# Amara F MAJOR 7 rooted on field 7 (A4), which its voicing does not use."],
        [('("Fmaj", "7", "F MAJOR 7", [5, 1, 2, 4], {5}),',
          '("Fmaj", "7", "F MAJOR 7", [5, 1, 2, 4], {7}),')],
        lambda D: chord(D, "amara", "Fmaj", "7").update(roots=[7]),
    ),
    "b_cluster_forced_only": (
        ["# kills: test_forced_tones_cluster_below_root",
         "# Pygmy Fsus4 put back to its pre-retrofit shape: Bb3 is forced below the",
         "# root but C is left above at C5 instead of clustering to C4. validate.py,",
         "# voicing uniqueness and the badge count (still 1) all stay green - only",
         "# the cluster rule in CLAUDE.md rule 3 catches it."],
        [('("Fsus", "4", "SUSPENDED CHORD", [5, 104, 3], {5}),',
          '("Fsus", "4", "SUSPENDED CHORD", [5, 104, 8], {5}),')],
        lambda D: chord(D, "pygmy", "Fsus", "4").update(fields=[5, 104, 8]),
    ),
    "b_validate_desync": (
        ["# kills: test_validate_py_passes",
         "# tools/decks.py alone drifts from the JSON embedded in index.html - the",
         "# print deck and the app would ship different card copy."],
        [('("Dm", "7", "D MINOR 7", [3, 5, 7, 8], {3}),',
          '("Dm", "7", "D MINOR SEVEN", [3, 5, 7, 8], {3}),')],
        None,
    ),
}


def apply_json(mutator):
    html = open(INDEX).read()
    m = re.search(r"^const DECKS = (\[.*\]);$", html, re.M)
    decks = json.loads(m.group(1))
    assert json.dumps(decks) == m.group(1), "serialisation format drifted"
    mutator(decks)
    html = html.replace(m.group(0), "const DECKS = " + json.dumps(decks) + ";", 1)
    open(INDEX, "w").write(html)


if subprocess.run(["git", "diff", "--quiet", "--"] + TRACKED).returncode != 0:
    sys.exit("REFUSING: tracked files already modified")

for name, (header, replacements, mutator) in MUTANTS.items():
    src = open(DECKS_PY).read()
    for old, new in replacements:
        assert src.count(old) == 1, (name, "anchor count", src.count(old), old)
        src = src.replace(old, new)
    open(DECKS_PY, "w").write(src)
    if mutator is not None:
        apply_json(mutator)
    diff = sh("git", "diff", "--", *TRACKED)
    assert diff.strip(), (name, "empty diff")
    with open(f"{OUT}/{name}.patch", "w") as f:
        f.write("\n".join(header) + "\n" + diff)
    subprocess.run(["git", "checkout", "--"] + TRACKED, check=True)
    ok = subprocess.run(["git", "apply", "--check", f"{OUT}/{name}.patch"],
                        capture_output=True).returncode == 0
    print(f"{'ok   ' if ok else 'FAIL '} {name}")

print(f"\nregenerated {len(MUTANTS)} mutants; tree clean: "
      f"{subprocess.run(['git','diff','--quiet','--']+TRACKED).returncode == 0}")
