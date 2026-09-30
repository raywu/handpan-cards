# Audio arpeggio (roadmap item 4)

Drafted 2026-09-30 by the integrator, AFK. Roadmap order is owner decision O5
(`2026-09-29-backlog-and-refactor.md` §6): audio, SM-2, stats, PWA. The spec text
is README.md "Owner-approved roadmap" (4): "an audio toggle that plays the chord
tones with WebAudio sine/triangle voices pitched from each card's MIDI numbers,
arpeggiated low-to-high".

## §1 Goal and non-goals

**Goal.** A SOUND toggle in the settings panel. When it is on, the app plays the
current card's voicing as a WebAudio arpeggio, low to high, each time the diagram
face is revealed. The setting persists across reloads.

| # | Non-goal |
|---|---|
| N1 | No sampled audio, no audio files, no new sibling files. WebAudio oscillators only |
| N2 | No playback of a whole mode-S sequence (the rail of 2-3 chords). One card at a time |
| N3 | No per-style playback (3:2, paradiddle...). The style copy stays text |
| N4 | No volume, tempo or voice pickers. One fixed voice |
| N5 | No change to deck data, diagram geometry, the engine regions, the DECKS line, print, or the visual system (no new colour, typeface or label style) |
| N6 | No audio in print or in the PDF path |
| N7 | No new dependency, no build step, no `<script src>` |

## §2 Design

**Notes.** A card plays its voicing: `ch.fields` mapped to `d.fields[f][2]`
(midi), deduplicated, sorted ascending. The ding is never in a voicing (card
convention 3), so it never sounds. Pitch-class-complete highlighting lights more
fields than the voicing; only the voicing plays. Bottom-shell fields in a
voicing (Pygmy Bb3, Db4) play at their own midi. Frequency is
`440 * 2 ** ((midi - 69) / 12)`.

**Pure helper.** `arpeggio(d, ch)` returns `[{midi, freq, at}]`, where `at` is the
onset offset in seconds (`i * STEP`). It lives in app JS, outside the engine
regions, and the sandbox can call it (unit-testable with no AudioContext).

**Voice.** One `OscillatorNode` per note, type `"triangle"`, through its own
`GainNode`. Envelope: 0 at onset, a linear ramp to 0.18 over 8 ms, then an
exponential decay to 0.0001 over 1.4 s, and the oscillator stops at onset + 1.5 s.
STEP = 0.16 s. All nodes feed one master `GainNode` (0.8) to `destination`.

**When it plays (sound ON).** On each transition that makes the diagram face
visible:
- Mode A: flipping to the back (the answer face).
- Mode B: dealing a card (the front is the diagram).
- Mode S: dealing a card (the front is mode A's answer face, §8 E5 of the
  sequence plan).

Flipping away from the diagram never plays. Re-revealing plays again. A deck
switch, mode switch or reroll that deals a diagram-front card plays too, since it
is a deal.

**Cancel.** Starting a new arpeggio stops every oscillator still scheduled or
sounding from the previous one, so fast swipes and taps never stack. Turning
SOUND off stops everything at once.

**Context lifecycle.** The `AudioContext` (or `webkitAudioContext`) is created
lazily, on the first play or on the tap that turns SOUND on. That tap is a user
gesture, which unlocks iOS Safari. Every play calls `ctx.resume()` when the state
is `"suspended"`. If neither constructor exists (jsdom, the sandbox, old
browsers), play is a silent no-op and nothing throws. The toggle still renders
and persists.

**Toggle.** A new panel group between "Practice" and "Scales":

```html
<div class="panel-group">
  <h3 class="panel-heading">Sound</h3>
  <button class="mode" type="button" id="sound-toggle" aria-pressed="false">PLAY CHORDS</button>
</div>
```

It reuses `.mode`, `.on` and `aria-pressed`, the same convention as the mode bar,
so there are no new classes or colours. The toggle keeps the panel open, per the
same "After an action" rule as the paper select. Default OFF, so a first visit
makes no sound.

**Persistence.** `save()` writes `next.sound = soundOn` into the shared `"hpfc"`
object, read-modify-write as today. The boot read is type-guarded:
`soundOn = store.sound === true`.

## §3 Lane (single, serial)

The work does not split along file ownership: every change is in `index.html`
plus its two test files. So there is one lane, AU.

**Branch** `claude/audio`. **Owns:**
- `index.html`: app JS, markup and CSS outside the engine regions and the DECKS line;
- `tests/app.test.js`;
- `tests/e2e.test.js`;
- `tests/helpers/cdp.js`, only if a helper is needed;
- `tests/suite_health.py` (FLOORS rows for app and e2e only);
- `tests/mutants/au_*.patch`, plus refreshes of any existing mutant this diff stales;
- `README.md` (mutant count, and one line in the feature list);
- this plan's "Integrator auto-decisions" paragraph, integrator only.

**Never touches:** `data/`, `src/engine/`, `tools/`, the PDFs, or any other plan doc.

**Tests first**, then the implementation.

| # | Test (file) | Acceptance |
|---|---|---|
| T1 | `arpeggio()` on Hijaz's first chord returns its voicing midi ascending, with `at` = 0, 0.16, 0.32... (app) | Midi derived from the note NAMES in the deck data (the suite's own convention), not by calling the helper's logic |
| T2 | `arpeggio()` on every chord of all three decks: strictly ascending, no ding midi, the count equals the distinct voicing fields (app) | Holds over all 96 cards |
| T3 | Pygmy Cm7 (C4 Eb4 G4 Bb3): the bottom-shell Bb3 is included and sorts first (app) | midi order 58, 60, 63, 67 |
| T4 | Freq for A4 (69) is 440 and for C4 (60) is 261.63±0.01 (app) | - |
| T5 | e2e, 380x800, AudioContext stubbed by an init script that records `{type, freq, start, stop}` per oscillator: SOUND off (the default), then flip in mode A: zero oscillators | - |
| T6 | e2e: turn SOUND on, flip in mode A: N triangle oscillators with the card's freqs ascending, starts spaced 0.16 s apart; flip back: no new ones; flip again: N more | - |
| T7 | e2e: mode B, and mode S, SOUND on: #next plays the new card on deal with no flip needed | - |
| T8 | e2e: SOUND on, flip, then #next within 50 ms: every oscillator from the first arpeggio has `stop` called at or before the second's first start | - |
| T9 | e2e: SOUND on, reload: `#sound-toggle` has aria-pressed="true" and `.on`; `localStorage.hpfc` keeps its other keys (deck, mode, printPaper) | - |
| T10 | e2e: with no AudioContext (init script deletes both constructors), SOUND on then flip: no page error, and the card still flips | - |
| T11 | e2e: the toggle is a 44px target at 380x800 and in the desktop sidebar at 1280x800 | - |

**Mutants** (O3: one per new test group), each killed by its named test:
- `au_not_ascending` (T1/T2)
- `au_plays_when_off` (T5)
- `au_no_cancel` (T8)
- `au_not_persisted` (T9)
- `au_throws_without_ctx` (T10)
- `au_plays_on_flip_away` (T6)
- `au_ding_included` (T2)

Each must pass `git apply --check` with no `index` blob line. `# suite:` headers
use `.` wildcards, never quotes.

**Verify commands** (a local run is a smoke test; CI at the final head is the evidence):
- `node --test tests/app.test.js`
- `CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node --test --test-name-pattern="sound" tests/e2e.test.js`, via `bash -c`. Never the full e2e file locally.
- `python3 tools/validate.py`
- `python3 -m unittest tests.test_suite_health tests.test_readme_currency`
- Each new mutant: apply, run only its target test, confirm it fails, `git checkout -- .`. Never the full `mutation_check.sh` locally.

**FLOORS.** Raise app and e2e by exactly the number of tests added. Raise the
README mutant count to the new `ls tests/mutants/*.patch | wc -l`.

## §4 Merge gates

The standing AFK gates apply:
- CI is green at the verified head SHA;
- a fresh swarm-reviewer returns PASS or PASS_WITH_NITS at that SHA;
- `gh pr merge --merge --match-head-commit <sha>`;
- the bounce cap is 2.

## §5 Owner-device check (after merge, not a gate)

On the owner's iPhone and Android: SOUND on, flip a card, and hear it. iOS mutes
WebAudio when the ring/silent switch is on silent; that is platform behaviour, not
a bug. Record the result as a row in the next triage doc.

## Integrator auto-decisions (AFK, 2026-09-30)

- A1: the voice is triangle only (the spec allows sine or triangle). Triangle
  carries better through phone speakers.
- A2: the default is OFF, so the app never makes surprise sound on a first visit.
- A3: plays on reveal of the diagram face, not on a separate play button. That
  adds no new card anatomy (preserve-the-visual-system constraint).
- A4: the voicing only, not the pitch-class-complete lit set. It follows the
  spec's "each card's MIDI numbers", and a card's voicing is what a player
  actually strikes.
- A5: one lane. Everything is in `index.html` plus its tests, so there is no
  ownership split to exploit.
