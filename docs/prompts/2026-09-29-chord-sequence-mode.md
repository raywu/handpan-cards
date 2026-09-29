# Prompt: chord-sequence learning mode, as a /swarm plan

You are planning, not building. Repo: `/Users/ray/Projects/handpan-cards`, base
`origin/main` @ `e728912`. Read `CLAUDE.md`, `docs/SCALE_ENGINE_PLAN.md`
(binding owner decisions), then §6 (merge gates) and the non-goals of
`docs/plans/2026-09-24-quality-eval.md`; they carry over unchanged. Use
`docs/plans/2026-09-28-android-bg-and-menu.md` as the structural template.

## Owner feedback (verbatim)

> A newer player may not know how to string the different chords together and
> may be overwhelmed by the number of chords. Add a mode where we randomly pick
> 2 or 3 complementary chords for the player to play through in sequence.
>
> These are some basic ways to play each chord in the chord sequence. Find a
> way to suggest a particular playing style, or link directly to the source for
> educational purposes:

The seven styles the owner supplied, from the Moritz.handpan short "7 ways to
play chords on the handpan" (https://www.youtube.com/shorts/YcmgdgZTpHc,
channel https://www.youtube.com/@Moritz.handpan):

1. All notes at once: strike every note of the chord simultaneously.
2. Arpeggios: play the notes one after another, straight up or down in pitch.
3. 3 over 2 polyrhythm: a three-beat pattern against a two-beat pulse.
4. 3-3-2 pattern: group strokes 3 + 3 + 2 continuously.
5. Paradiddle: R-L-R-R, L-R-L-L across the chord notes.
6. Turn it into a groove: add slaps, ghost notes, or shifting accents.
7. Freestyle: mix patterns, bring out different top melodies, follow your ear.

## Part A - what "complementary" means

This is the core design question, and the owner has not defined it. Do not
pick one rule by taste. Propose 2-3 candidate definitions, each computable from
data the app already has (`chords[].fields`, `roots`, the deck's `degrees`
map, midi pitch classes, the engine's output for generated decks). For example:
diatonic function from the degree labels (i-VII-VI, I-IV-V, i-iv-v), shared
tones between consecutive chords, root motion by 4th/5th, or playability on
this pan (few bottom-shell fields, hands not crossing). For each, cite
`file:line` for the data it reads and show the sequences it yields on all three
built-in decks, and whether it works on a user-generated scale and on a pan
flagged `NO_THIRDS`. Say what happens when a deck cannot supply 3 complementary
chords. Recommend one; the rest become owner decision rows.

**Golden sequences (owner-approved oracle).** Musical quality is not
something `/plan-eng-review` can judge. For the recommended definition, list
the complete set of sequences it can produce on each built-in deck (or, if
large, every sequence from a fixed seed list), in a table the owner can read
as a musician: chord names, degrees, and the fields each chord lights. That
table is an owner gate: the owner approves or strikes rows before any lane
starts, and the approved table becomes the engine unit test's expected output.

Also decide: how random (uniform, weighted, avoid repeating the last sequence),
whether a sequence can be re-rolled, and whether 2 vs 3 is the player's choice
or random. **The picker must take an injectable random source** (a seeded
PRNG passed in, `Math.random` only as the app-level default) so every
selection rule is proven by unit tests, not by e2e runs.

## Part B - the mode and its UI

**Required step:** before drafting Part B, run
`/frontend-design:frontend-design` (design direction only, no code) with the
brief below, and carry its output into §2 of the plan. Keep it inside
"preserve the visual system" (fonts, palettes, card anatomy, spacing ramp,
`.mode`/`.chip`): no new colour, typeface or label style; reuse the existing
panel classes and the all-caps mode-button convention even where the skill's
defaults argue otherwise, and record any such override. Brief to pass it: "Design direction only for a chord-sequence
learning mode in Handpan Chord Cards (index.html). Dark table #1a1815/#26221c,
paper-white cards, Marcellus/Bitter/Nunito Sans. The mode is entered from the
existing settings menu (hamburger panel on mobile, sidebar on desktop) next to
NAME->NOTES / NOTES->NAME. It shows 2-3 complementary chords to play in order,
plus one playing-style tip credited to Moritz.handpan with an outbound link.
Keep 44px targets, a 380px viewport and the landscape one-row header."

Answer:

- **Owner decision (fixed): the mode is added to the settings menu.** Today
  the panel holds NAME->NOTES / NOTES->NAME (`index.html:1117-1118`). Decide
  only its form there: a third button in the same mode group, or a separate
  "Chord sequences" row in the panel. Either way it must be reachable from the
  hamburger panel on mobile and the desktop sidebar, keep the panel's
  focus-trap and Escape behaviour, and fit the panel with no internal scroll at
  320x568 and 844x390 (the existing panel-fit test).
- How a sequence is shown: 2-3 cards side by side, a stepped strip, or one card
  at a time with a position marker. It must hold at 380px, the landscape
  one-row header (`@media (max-height:520px)`), and desktop with the sidebar.
  CHROME_BUDGET and LANDSCAPE_BUDGET only tighten; say whether this mode needs
  its own budget rows.
- How prev/next, Shuffle, the counter, flipping and the keyboard behave in the
  mode, and how the player leaves it.
- The playing-style suggestion: one style per sequence, or per chord; picked
  at random or by rule (e.g. arpeggio for newer players first); where it sits
  on screen; whether the player can change it.
- Whether a style is drawn on the diagram (e.g. arpeggio order low-to-high
  from midi, 3-3-2 grouping) or is text only. Recommend one explicitly; the
  default is text only in v1, with diagram overlays a non-goal.
- State interactions: what happens to an active sequence when the player
  switches deck, adds or removes a scale, or reloads; whether the chosen mode
  persists (`STORE_KEY`, `index.html:5670`) and how an old stored value with no
  sequence mode reads back.

## Part C - sourcing and linking

The style copy must be the app's own short wording, credited to the source,
not transcribed from the video. The app is a single self-contained file with no
external JS: no YouTube iframe or player script. Evaluate a plain outbound
link (`target="_blank" rel="noopener"`) to the one short (no per-style
timestamps: Shorts do not support them reliably), and how the link behaves
offline (roadmap item 3 is a PWA).
State the attribution text, and flag as an owner decision anything that
depends on the creator's permission.

## Constraints the plan must survive

Single-file `index.html`, no build step. Engine logic goes in a new or existing
`src/engine/*.js` module with its own unit tests, inlined by
`tools/inline_engine.py` (a sync step); never hand-edit engine regions or the
`const DECKS` line. Do not alter deck data or diagram geometry. 44px targets;
a11y (announced mode and sequence position, focus handling, reduced motion);
the existing NAME->NOTES / NOTES->NAME flows and print flow unchanged; a
printed card carries no screen furniture. Say whether print is in scope (the
recommended default is no). Relate the plan to roadmap items 1 (spaced
repetition) and 4 (audio arpeggio): what this mode must not preclude, not what
it builds.

**Minimum first version.** Define v1 explicitly and keep it small. Default
non-goals for v1 unless the plan argues otherwise: share-link seeds, diagram
style overlays, audio, spaced-repetition grading, print, per-style video
timestamps, and practice stats.

## Method and budget

Read-only evaluation. You may run single tests
(`node --test --test-name-pattern=...`) and single e2e tests with `CHROME_BIN`.
Never run the full `tests/mutation_check.sh` or the full e2e file locally.
List every mutant under `tests/mutants/` whose target code a lane will move or
delete (`grep -l` the removed lines, not the hunk headers), and say for each:
context refresh, re-target, or retire.

## Output

Write `docs/plans/2026-09-29-chord-sequence-mode.md`. **Shape it for
`/swarm` and write it TDD-first** - this is the recommended execution path:
lanes split by file-ownership boundary, each with acceptance criteria and an
exact verify command, explicit non-goals, standing merge gates, worktree
isolation, and an independent reviewer per PR. Every lane lists its failing
tests (by name, with the assertion) before its implementation steps, and its
verify command runs those tests. Expected shape: one engine lane
(`src/engine/` picker + style choice, unit tests against the golden table)
that can start as soon as the owner approves the table, then the `index.html`
UI work, serialised unless the plan shows disjoint regions.

1. Header: goal (one testable sentence), date, base SHA, shape, related docs.
2. §1 Goal and non-goals (carry quality-eval's; add the v1 non-goals).
3. §2 Findings: Part A candidates with sample sequences per deck, a
   recommendation, and the golden-sequence table; Part B design direction taken from the
   `/frontend-design:frontend-design` run, with ASCII wireframes of the menu
   entry and the sequence view at 380px, landscape and desktop; Part C linking
   verdict and attribution text.
4. §3 Lanes: `| Lane | Owns | Never touches | Acceptance | Verify |`. Engine
   module and UI lanes split by file ownership; two lanes touching
   `index.html` own disjoint line regions or are serialised - say which and
   why. Name FLOORS rows and mutant prefixes per lane. TDD: tests first.
5. §4 Order and dependencies. §5 Merge gates (deltas only). §6 Owner
   decisions with recommended defaults (at least: the definition of
   complementary, the golden-sequence table, style selection rule, text vs
   diagram style, link vs own copy, print scope, v1 cut).
6. §7 Owner gate: golden-sequence approval before any lane spawns.

Do not commit. Then run `/plan-eng-review` on the plan.
