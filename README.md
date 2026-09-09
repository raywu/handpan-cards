# Handpan Chord Flashcards

One self-contained file: `index.html`. No build step, no dependencies beyond
Google Fonts (loaded from CDN; falls back to system fonts offline).

Decks included: C# Hijaz 9 (pink/orange), F3 Low Pygmy 18 (purple/gold),
D Amara 9 (teal/amber). 59 cards total, with the same diagrams, voicings,
pitch-class highlighting, and typography as the printed sets. The visual
design (Marcellus / Bitter / Nunito Sans, two-tone split borders, per-deck
palettes) is original to this project.

## Use it

- **Tap the card** to flip. **Swipe** or use the arrow buttons/keys to move.
- **Name -> Notes**: front shows the chord name; back shows the pan diagram
  and voicing. **Notes -> Name** reverses it (read the diagram, name the chord).
- **Shuffle** randomizes order. Deck and mode choices persist between visits
  (when the browser allows storage).

## Tests

    ./tests/run.sh                       # everything
    ./tests/run.sh python                # python suites only
    ./tests/run.sh node                  # js suites only
    ./tests/run.sh mutants               # the red-proof gate

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
  all 59 cards are compared on position, highlight state, note order and badge.
- **Browser e2e** - real Chromium: deck switching, the 3D card flip, keyboard
  and touch navigation, reload persistence, and clipping at a 380px viewport.
- **Mutation gate** - every test group ships a patch that must make it fail. A
  test nothing can kill does not count as coverage.

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

Card data is generated from the same `decks.py` that produces the printed
PDFs, exported as JSON and embedded in the HTML. If a chord or note position
changes in the print decks, re-export and re-inject to keep both in sync.

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
> two-tone split borders, poker-card aspect). Add: (1) spaced repetition - grade each
> card "again / good / easy" after flipping, schedule with a simple SM-2,
> persist per-deck progress in localStorage with an export/import JSON
> button; (2) a practice-stats view per deck; (3) PWA support (manifest +
> service worker) so it works offline and installs to the home screen;
> (4) an audio toggle that plays the chord tones with WebAudio sine/triangle
> voices pitched from each card's MIDI numbers, arpeggiated low-to-high.
> Test on a 380px viewport. Do not alter deck data or diagram geometry.
