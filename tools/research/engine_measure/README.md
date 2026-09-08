# Engine measurement scripts

Read-only measurements of the three built-in decks that back the numbers in
`docs/SCALE_ENGINE_PLAN.md`. They were written for the 2026-09 adversarial
review of that plan (round 3, post-retrofit) and are kept so the numbers can be
re-derived instead of trusted.

Run from the repo root; no dependencies beyond `tools/decks.py`:

```
PYTHONPATH=tools/research/engine_measure python3 tools/research/engine_measure/t1_cluster.py
```

| script | measures |
|---|---|
| `t1_cluster.py` | does CLAUDE.md rule 3 / D2 reproduce every curated voicing given the root field (strict vs permitted reading) |
| `t2_root.py` | root-octave policies scored against the 54 primary cards |
| `t3_containment.py` | containment gate: curated voicing inside the legal candidate set, and candidate-set sizes |
| `t4_selection.py` | chord-selection space under the D1 vocabulary vs what each deck ships |
| `t5_bass.py` | cards whose root is not the lowest note |
| `t6_degrees.py`, `t6b_case.py` | D8 numerals, and which parent scale reproduces the degree CASE |
| `t7_misc.py` | geometry ceiling, print maxima, annotation eligibility, alternates, encoding sizes |
| `t8_combined.py` | root policy x cluster rule: fully-automatic reproduction rates |

These are research tools, not tests: nothing in CI runs them, and they may be
deleted once the engine's own divergence table (plan, Phase 2) exists.
