# Handpan Chord Flashcards

One self-contained file: `index.html`. No build step, no dependencies beyond
Google Fonts (loaded from CDN; falls back to system fonts offline).

`index.html` is the shipped product: what is in the repo is what GitHub Pages
serves, byte for byte. The scale engine lives twice - as the readable modules
under `src/engine/` and as a copy pasted between the `<!-- engine:... -->`
markers in `index.html`. Keeping the copy current is a **sync step, not a build
step**: `python3 tools/inline_engine.py` rewrites those regions from
`src/engine/*.js`, and `--check` reports whether they already match. Nothing is
compiled, minified or generated on the way to the browser, and the file still
opens straight from disk. Never hand-edit inside an engine region - change the
module and re-run the tool. `python3 tools/validate.py` fails CI if the
two ever drift.

Decks included: C# Hijaz 9, 19 cards (pink/orange); F3 Low Pygmy 18,
52 cards (purple/gold); D Amara 9, 25 cards (teal/amber). 96 cards total,
with the same diagrams, voicings, pitch-class highlighting, and typography as
the printed sets. The visual design (Marcellus / Bitter / Nunito Sans,
single-colour root-frame borders, per-deck palettes) is original to this
project.

The scale engine that generates and ranks those cards is six modules under
`src/engine/`: `src/engine/core.js` (note parsing and pitch classes),
`src/engine/voicing.js` (the cluster and spelling rules),
`src/engine/naming.js` (chord symbols and subtitles),
`src/engine/select.js` (which chords a pan gets and in what order),
`src/engine/layout.js` (the tonefield solver and label sizes) and
`src/engine/share.js` (URL encoding for the seed behind a generated deck).
`docs/ENGINE-SPEC.md` is the spec; `docs/SCALE_ENGINE_PLAN.md` records the
decisions behind it.

## Use it

- **Tap the card** to flip. **Swipe** or use the arrow buttons/keys to move.
- **Name -> Notes**: front shows the chord name; back shows the pan diagram
  and voicing. **Notes -> Name** reverses it (read the diagram, name the chord).
- **Shuffle** randomizes order. Deck and mode choices persist between visits
  (when the browser allows storage).
- **+ ADD** (the first chip in the deck row) opens the scale sheet: type your
  pan as a ding in brackets followed by the top notes, e.g.
  `(D) A C D E F G A C`, with any bottom notes after a `|`. The line under the
  box shows how the notes were read as you type; pick a palette and, if your
  pan is mirrored, LEFT-FIRST; then GENERATE CARDS. Regenerating the same
  scale replaces that deck in place. The sheet is a real page, not an overlay:
  opening it pushes `#add`, and reopening a saved one pushes `#edit-<id>`, so
  the back gesture closes the sheet instead of leaving the app. A page route
  pasted into the address bar opens nothing - it is replaced away at boot,
  because a restored page with no entry behind it is one back cannot leave.
- **Your scales persist** in localStorage and come back on the next visit.
  Tapping a custom deck's chip when that deck is already selected reopens the
  sheet with its name and notes filled in - that is the one way in, and the
  pencil on the chip marks it. DELETE removes the deck and asks for a second
  tap to confirm. A generated deck also travels as a `#s=` link: the app opens
  one from the address bar with no account and no server, though nothing in
  the UI builds or copies that link yet.

## Tests

    ./tests/run.sh                       # validate, boot sim, python + node
    ./tests/run.sh python                # python suites only
    ./tests/run.sh node                  # js suites only
    python3 tests/suite_health.py        # per-file test-count floors
    ./tests/run.sh mutants               # the red-proof gate (separate; slow)

`./tests/run.sh` with no argument does NOT run the mutation gate or the suite
health check - run those two yourself before pushing. The gate mutates the
working tree in place, so nothing else may run alongside it, and it refuses to
start if the tree already modifies a file one of its patches touches
(`README.md` and `data/decks.json` are both such files): commit first.

Needs `pip install reportlab pymupdf`. No JavaScript dependencies: the
browser tests drive an already-installed Chrome over the DevTools Protocol, so
there is still no `package.json`, no lockfile and no build step.

What is covered:

- **Deck data** - the three instrument layouts are pinned against the tables in
  `CLAUDE.md`, plus the voicing rules (ding never voiced, no doubled pitch
  classes, power chords are a root and a fifth).
- **Print layout** - text fitting against what the renderer actually draws, the
  3x3 page grid, and the tonefield drawing recipe.
- **App logic** - highlighting derivation, chord-spelling order, navigation and
  wrap, shuffle, and the localStorage guards, booted headless from `index.html`.
- **App vs print agreement** - the two renderers are independent
  implementations of the same conventions (and use opposite y-axis signs), so
  all 96 cards are compared on position, highlight state, note order and badge.
- **The scale engine** - each module under `src/engine/` has its own node
  suite: chord selection and ranking, voicing, naming, the layout solver swept
  over N=5..19 pans, and share-URL round trips.
- **The README itself** - `tests/test_readme_currency.py` reads the deck data,
  the engine module list and the mutant corpus and fails if the counts and
  names on this page have gone stale.
- **Browser e2e** - real Chromium: deck switching, the 3D card flip, keyboard
  navigation, reload persistence, clipping at a 380px viewport, and
  the scale sheet's modality, focus handling and 44px hit areas.
- **Mutation gate** - 312 mutant patches under `tests/mutants/`, each one a
  deliberate break that some test must catch. The gate is all-or-nothing: one
  survivor fails it. A test nothing can kill does not count as coverage.

That is 10 node suites (`tests/*.test.js`) and 8 python suites
(`tests/test_*.py`), plus `tests/suite_health.py`, which holds a per-file floor
on the number of tests collected so a suite cannot quietly stop running.

`tests/CONTRACT.md` is the binding guide for adding tests, including the traps
that have already cost a debugging cycle.

## Host on GitHub Pages

1. Create a repo and add `index.html` at the root.
2. Repo Settings -> Pages -> Source: "Deploy from a branch" -> `main` / root.
3. Your app is at `https://<user>.github.io/<repo>/`.

**Private repo caveat:** GitHub only serves Pages from private repos on paid
plans (Pro/Team). On a free account the repo must be public for Pages to work.
The published page itself is always public either way - Pages has no auth.
If you need the *app* private, use Cloudflare Pages with Cloudflare Access,
or Netlify with password protection, both of which deploy this same single
file unchanged.

Quickest local test: `tools/preview.sh` (or `tools/preview.sh <branch>` /
`tools/preview.sh pr:<n>` to preview before merging), then open the printed
`http://localhost:8000` on your laptop or the LAN URL on your phone (same Wi-Fi).

## Regenerating deck data

`data/decks.json` is the one canonical copy of the deck data. The app's
embedded `const DECKS` line and the print generator both derive from it.
Edit that file, then run `python3 tools/sync_decks.py` (re-injects it into
`index.html`) and `python3 tools/decks.py` (rebuilds the PDFs).

Layout notes (intentional, verified against the physical instruments -
do not "correct"):

- **F3 Low Pygmy top shell**: field 1 (G3) sits bottom-RIGHT, zig-zag
  ascends right-first, Eb5 at top centre, F5/G5 inside beside the ding
  (10 left, 11 right).
- **F3 Low Pygmy bottom notes** (U1-U6) are drawn as an outer ring in
  x-ray view (seen from above): U1 C3 lower-right, U2 Db3 lower-left,
  U3 Eb3 right, U4 Bb3 left, U5 Db4 upper-right, U6 Ab5 upper-left.
- Highlighting is pitch-class complete (every instance of a chord's
  pitch classes lights up, ding included), matching the verified
  convention of the original D Amara reference deck.

## Optional: Claude Code follow-up prompt

If you want to grow this into a bigger app, start a Claude Code session in
the repo and use:

> This repo contains index.html, a self-contained handpan chord flashcard
> app (vanilla JS, embedded JSON deck data for three handpans, SVG pan
> diagrams). Keep the single-file, no-build architecture and the existing
> visual system (Marcellus / Bitter / Nunito Sans, per-deck palettes,
> single-colour root-frame borders, poker-card aspect). Add: (1) spaced repetition - grade each
> card "again / good / easy" after flipping, schedule with a simple SM-2,
> persist per-deck progress in localStorage with an export/import JSON
> button; (2) a practice-stats view per deck; (3) PWA support (manifest +
> service worker) so it works offline and installs to the home screen;
> (4) an audio toggle that plays the chord tones with WebAudio sine/triangle
> voices pitched from each card's MIDI numbers, arpeggiated low-to-high.
> Test on a 380px viewport. Do not alter deck data or diagram geometry.
