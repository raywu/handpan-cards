# CLAUDE.md currency: degrees bullet and the Resources trio

Date: 2026-10-06. Owner authorisation: interview answer "Yes, both (Recommended)".

## Goal

Two bullets in the repo `CLAUDE.md` describe behaviour that has since changed.
Make both true again. Nothing else in the file changes.

1. "Scale degrees per deck" still lists the pre-#249 labels (`bII`, `bvii`,
   `IV`, `bVII`, `bIII`). Shipped labels, from `data/decks.json`:
   - Hijaz {C#:I, D:II, F:iii deg, F#:iv, G#:v deg, B:vii}
   - Pygmy {F:i, G:ii deg, Ab:III, Bb:iv, C:v, Db:VI, Eb:VII} (unchanged)
   - Amara {D:i, F:III, G:iv, A:v, C:VII}
2. "Menu Resources" describes only class `duo`. #250 added class `trio` to the
   three-site row: equal widths, two equal plus HTC full width in the sidebar,
   unequal on landscape phones (owner confirmed D1 and D5/D6, 2026-10-06).

## Non-goals

- No code, test, mutant, data or `index.html` change.
- No edit to any other `CLAUDE.md` line, the README, or the plans.
- No change to the outside-note rule (owner item Q1 is still open; the bullet
  states what ships).

## Lane CM (single serial lane)

Owns: `CLAUDE.md` (the two bullets), this plan file.

Acceptance:

1. The degrees bullet matches `data/decks.json` `degrees` for all three decks,
   key for key.
2. The degrees bullet carries a one-clause dated note that the parent scale's
   seven steps take no accidental and that a root outside the parent takes
   `#` or `b` (generated decks only).
3. The Resources bullet names class `trio` and its three layouts.
4. `git diff --stat origin/main` lists `CLAUDE.md` and this plan only.
5. No `file:line` reference is added (line-ref ratchet in
   `tests/test_readme_currency.py`).
6. CI `validate` is green at the head SHA.

Verify: `python3 -m unittest tests.test_readme_currency -v` and
`python3 tools/validate.py`.

## Merge gates

CI green at the verified head SHA, plus an independent reviewer PASS or
PASS_WITH_NITS at that SHA.

## Eng review (inline, 2026-10-06)

Docs-only, one file, no architecture or data flow. Checked: no test or tool
parses the degrees text out of `CLAUDE.md` (the `tests/test_deck_data.py`
comment that cited the bullet was removed in #249); `CLAUDE.md` is in the
line-ref ratchet, so the new text cites names, not lines; no mutant patches
`CLAUDE.md`. No issues. The full `/plan-eng-review` skill was not run for a
two-bullet docs edit; the independent reviewer is the gate.
