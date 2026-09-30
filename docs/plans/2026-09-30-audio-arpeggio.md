# Audio arpeggio (IDEA - not on the roadmap)

> **Parked 2026-09-30 (owner).** Audio is an idea, not committed roadmap. This
> plan was eng-reviewed but never executed; do not start it without asking the
> owner. References below to "roadmap item 4" and O5 ordering are historical.

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

**When it plays (sound ON).** Whenever a render leaves the diagram face showing.
The predicate is one pure function,
`diagramShown() = (mode === "A" && flipped) || (mode !== "A" && !flipped)`,
which follows from `render()`'s face assignment (`index.html:6686`): in mode A the
back is the answer diagram; in B the front is `questionB` (diagram); in S the
front is mode A's answer face (§8 E5 of the sequence plan).

**Hook site (eng review F1).** Playback hooks in ONE place: the tail of
`render()`, after the faces are written and after its two early returns (empty
mode-S sequence, `!order.length`), so neither of those ever plays. It runs
`maybePlay()`, which plays when `audioArmed && soundOn && diagramShown()`.
`audioArmed` is `false` until the last line of the boot block, after
`setMode(mode)` (around `index.html:8181`) and the boot-time share-link
`openShare()` call (`:8201`, into `:6127`, which reaches `render()` through
`selectDeck`; there is no hashchange listener). Both call `render()`
with no user gesture, so without the gate a stored-ON reload in mode B or S
would queue an arpeggio into a suspended context that bursts out on the first
tap. Every other `render()` caller is a user transition:

| Path | Reaches render() via | Plays when |
|---|---|---|
| tap / Enter / Space on the card | `flip()` `:7858` | the new face is the diagram (A to back; B/S back to front) |
| #next / #prev / arrow keys | `step()` `:7864` | mode B or S (A deals the name face) |
| swipe release | `land()` `:8067` then `step()`, or `step()` directly under reduced motion | as #next |
| shuffle toggle (A/B), reroll (S) | `setOrder(); render()` `:7883-7884` | mode B or S |
| deck chip, GENERATE, delete deck, share link after boot | `selectDeck()` `:6199` | mode B or S |
| mode button | `setMode()` `:7979` | the new mode is B or S |

Consequence, accepted: re-clicking the active mode or deck chip replays, and a
one-chord deck replays on #next. That is "re-revealing plays again". Contract,
written as a comment at the hook: `render()` is called only on user
transitions; any future passive re-render (resize, theme) must take a
`{silent: true}` flag. A key-change detector ("play if the card changed") was
rejected: it goes silent on one-chord decks and on a reroll that lands on the
same first chord.

**Cancel.** Starting a new arpeggio silences every voice still scheduled or
sounding from the previous one, so fast swipes and taps never stack. Turning
SOUND off does the same at once. A hard `osc.stop()` clicks, so a cancel on each
live voice runs `gain.cancelScheduledValues(now)`, `setValueAtTime(current, now)`,
`linearRampToValueAtTime(0, now + 0.015)`, then `osc.stop(now + 0.02)`. Live
voices sit in one array; `onended` removes and disconnects each.

**Context lifecycle.** The constructor (`window.AudioContext ||
window.webkitAudioContext`) is looked up LAZILY at creation time, never cached
at boot, so a test can install a stub after load. The context is created on the
first play or on the tap that turns SOUND on.

iOS unlock (eng review F3): WebKit only unlocks inside a `touchend`, `pointerup`,
`click` or `keydown` handler, not in `pointerdown` on touch and not in a promise
callback. `land()` runs from `anim.finished.then(...)`, so a swipe after a
stored-ON reload can never unlock by itself. So the app adds a one-shot
capture-phase listener on `pointerup`, `touchend`, `keydown` and `click`
(on `window`, `{capture: true, passive: true}`, so it runs before the document-capture swipe handlers at `index.html:8150-8172`, including the one that calls `stopPropagation` on an eaten click). When `soundOn` is true it creates
or resumes the context and starts a one-sample silent buffer. It detaches once
`ctx.state === "running"`.

Every play calls `ctx.resume()` when `ctx.state !== "running"`, which covers
Safari's `"interrupted"` as well as `"suspended"`. Scheduling happens inside
`resume().then()` against a play-generation counter. A play superseded by a
newer one, or by SOUND off, before its resume settles schedules nothing, so a
stale arpeggio can never burst out later.

If neither constructor exists (jsdom, the sandbox, old browsers), play is a
silent no-op and nothing throws. The toggle still renders and persists.

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

The mobile panel's Tab trap is an explicit list, `panelStops()`
(`index.html:7910`), not native tab order. `#sound-toggle` must be inserted
there in DOM order, after the mode-S sequence link and before `#deck-add`, or Tab
skips it (eng review F4, precedent mutant `sqe_panelstops_misses_modeS`).

**Persistence.** `save()` writes `next.sound = soundOn` into the shared `"hpfc"`
object, read-modify-write as today. The boot read is type-guarded:
`soundOn = store.sound === true`, so `"true"`, `1` and `"yes"` all read as OFF.
`let soundOn` is declared beside `let mode` (`index.html:5975`), before any code
path that calls `save()`, so there is no TDZ error at boot.

## §3 Lane (single, serial)

The work does not split along file ownership: every change is in `index.html`
plus its two test files. So there is one lane, AU.

**Branch** `claude/audio`. **Owns:**
- `index.html`: app JS, markup and CSS outside the engine regions and the DECKS line;
- `tests/app.test.js`;
- `tests/e2e.test.js`;
- `tests/helpers/sandbox.js`: add `"sound-toggle"` to `ELEMENT_IDS` (`:25`),
  because `getElementById` throws on any unlisted id (`:274`) and every
  app.test.js boot would break (eng review F4);
- `tests/helpers/cdp.js`, only if a helper is needed. The suite already launches
  Chrome with `--autoplay-policy=no-user-gesture-required` (`:326`), so e2e cannot
  observe the iOS gesture rule; that is the owner-device check in §5;
- `tests/suite_health.py` (FLOORS rows for app and e2e only);
- `tests/mutants/au_*.patch`, plus refreshes of any existing mutant this diff stales;
- `README.md` (mutant count, and one line in the feature list);
- this plan's "Integrator auto-decisions" paragraph, integrator only.

**Never touches:** `data/`, `src/engine/`, `tools/`, the PDFs, or any other plan doc.

**Tests first**, then the implementation.

**Stub strategy (eng review F7).** The constructor is looked up lazily, so most
tests need no init script:
- **app.test.js:** after boot, `app.run("AudioContext = class { ... }")` installs a
  recording stub whose `currentTime` the test controls.
- **e2e:** after `freshLoad()`, `b.eval` installs the same stub.

The stub records, per oscillator, `{type, freq, start, stop}`; per gain node,
its `connect` target and its scheduled ramps; and the context's `resume` calls.
Only T13, the boot-silence test, needs `Page.addScriptToEvaluateOnNewDocument`.
It removes the script with `Page.removeScriptToEvaluateOnNewDocument` in a
`finally`, because the suite shares one page and a leaked init script would stub
every later test.

Page errors go to `window.__auErr`, collected by a `window.addEventListener("error")`
the test installs, because CDP drops unsolicited events (`cdp.js:107`).

**Naming.** Every new e2e test name contains the word "sound", so the verify
pattern below and the mutants' `# suite:` headers select it. Timing asserts use
a ±5 ms tolerance against the stub's clock, never wall time.

| # | Test (file) | Acceptance |
|---|---|---|
| T1 | `arpeggio()` on Hijaz's first chord returns its voicing midi ascending, with `at` = 0, 0.16, 0.32... (app) | Midi derived from the note NAMES in the deck data (the suite's own convention), not by calling the helper's logic |
| T2 | `arpeggio()` on every chord of all three decks: strictly ascending, no ding midi, the count equals the distinct voicing fields, and the midi SET equals the voicing's, not the lit pitch-class set (app) | Holds over all 96 cards |
| T2b | `arpeggio()` on a generated custom deck, created through the same generate path the existing custom-deck app tests use: ascending, and it equals its voicing (app) | Custom decks reach `CUSTOM[deckId]`, not `DECKS` |
| T3 | Pygmy Cm7 (C4 Eb4 G4 Bb3): the bottom-shell Bb3 is included and sorts first (app) | midi order 58, 60, 63, 67 |
| T4 | Freq for A4 (69) is 440 and for C4 (60) is 261.63±0.01 (app) | - |
| T4b | `diagramShown()` over the six combinations of mode {A,B,S} and flipped {false,true} (app) | true exactly for A+flipped, B+unflipped and S+unflipped |
| T4c | Scheduling with the stub (app): one play makes N triangle oscillators, each with its own gain connected into the master, which is connected to `destination`; the peak ramp is 0.18 at +8 ms; a second play fades and stops every live voice of the first by the second's first onset; SOUND off does the same at once | Covers routing and envelope, so a disconnected or zero-gain voice cannot pass |
| T5 | e2e, 380x800, stub installed: SOUND off (the default), then flip in mode A: zero oscillators | - |
| T6 | e2e: turn SOUND on, flip in mode A: N triangle oscillators with the card's freqs ascending, starts spaced 0.16 s apart; flip back: no new ones; flip again: N more | - |
| T7 | e2e: SOUND on. Mode B: #next plays with no flip; flipping to the name plays nothing; flipping back to the diagram plays. Mode S: #next plays; reroll plays | Covers the B/S deal and the B flip-back reveal |
| T7b | e2e: SOUND on, mode B: a deck chip click plays, and switching mode A to B plays | Covers the `selectDeck` and `setMode` paths |
| T8 | e2e, mode B (not A: mode A's #next deals the name face, so it would never start a second arpeggio): SOUND on, #next, then #next again within 50 ms. Every first-arpeggio oscillator has `stop` at or before the second's first start + 0.02 s | - |
| T9 | e2e: SOUND on, reload: `#sound-toggle` has aria-pressed="true" and `.on`; `localStorage.hpfc.sound === true` | Sibling-key preservation is already pinned by the existing app test and `d_save_wholesale`, so T9 does not repeat it |
| T10 | e2e: after load, `delete window.AudioContext; delete window.webkitAudioContext`, then SOUND on and flip: `__auErr` is empty and the card flipped | - |
| T11 | e2e: the toggle is a 44px target at 380x800 and in the desktop sidebar at 1280x800 | - |
| T12 | e2e, 380x800: Tab from the trigger reaches `#sound-toggle` in the trap's cycle, and pressing it leaves the panel open | - |
| T13 | e2e: seed `hpfc = {mode:"B", sound:true}` with the init-script stub, then load, and also load a share-link URL: zero oscillators until a user action | Boot and `openShare()` never play |
| T14 | app: seed `sound` as `"true"`, `1` and `"yes"`: each boots OFF | - |
| T15 | e2e: SOUND on, mode B, a swipe through `b.swipe` that lands (`land()` then `step()`): it plays | - |

Existing regressions to keep green: the Tab-trap cycle test
(`e2e.test.js:1173`), the mobile-panel fit loop (`:1335` onward), and the desktop
sidebar-fit test at 1024x700 (`:6729`). The new panel group adds height, and
1024x700 is the tightest fit.

**Mutants** (O3: one per new test group), each killed by its named test:
- `au_not_ascending` (T1/T2)
- `au_lit_set_not_voicing`: plays the pitch-class-complete lit set (T2). This
  replaces `au_ding_included`, which needed an unrealistic edit to fire.
- `au_plays_when_off` (T5)
- `au_plays_on_flip_away` (T6)
- `au_bs_deal_silent`: the predicate is reduced to `mode === "A" && flipped` (T7)
- `au_no_cancel` (T8 and T4c)
- `au_not_persisted` (T9)
- `au_throws_without_ctx` (T10)
- `au_not_in_tab_trap` (T12)
- `au_plays_at_boot`: the `audioArmed` gate removed (T13)
- `au_sound_truthy_guard`: `store.sound === true` weakened to `!!store.sound` (T14)
- `au_voice_disconnected`: the voice gain is never connected to the master (T4c)

Each must pass `git apply --check` with no `index` blob line. `# suite:` headers
use `.` wildcards, never quotes.

After the implementation, run `git apply --check` over ALL existing patches, not
only the new ones. Seventeen have context in the regions this diff touches:
- `d_save_drops_mode`, `d_save_no_guard`, `d_save_wholesale`, `d_step_keeps_flip`
- `e_boot_count`, `e_nav_wrap`, `e_panel_moved_into_header`, `e_persist_save`
- `f6_render_empty_order_guard`, `ms_js_breakpoint_drift`
- `sqe_empty_seq_stale_card`, `sqe_link_stop_when_hidden`,
  `sqe_panelstops_misses_modeS`, `sqe_step_leaves_sequence`
- `ui_credit_back`, `ui_style_back_on_card`, `ui_style_block_not_filled`

Refresh each stale one by re-deriving its hunk; hunk headers are not line refs.
The `h_*` patches patch `mutation_check.sh` itself, so check them too.

**Verify commands** (a local run is a smoke test; CI at the final head is the evidence):
- `node --test tests/app.test.js`
- `CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node --test --test-name-pattern="sound" tests/e2e.test.js`, via `bash -c`. Never the full e2e file locally.
- `python3 tools/validate.py`
- `python3 -m unittest tests.test_suite_health tests.test_readme_currency`
- `for p in tests/mutants/*.patch; do git apply --check "$p" || echo "STALE $p"; done`
- Each new mutant: apply it, run only its target test, confirm the test fails,
  then `git checkout -- .`. Never the full `mutation_check.sh` locally, and
  never edit the tree while it runs.

**FLOORS.** In `tests/suite_health.py`, raise app (192) and e2e (186) by exactly
the number of tests added: planned +8 app (T1, T2, T2b, T3, T4, T4b, T4c, T14)
and +13 e2e (T5 to T13, T7b, T15). Use the real count if the split changes.

**README.**
- Set the mutant count (`README.md:127`, 463 today) to the new
  `ls tests/mutants/*.patch | wc -l`, 475 as planned.
- Add one feature line.
- Leave the quoted original prompt at `README.md:192` alone: it is a quotation.

**Integrator flag.** CLAUDE.md's "Owner-approved roadmap" still lists item 4
as not yet built. CLAUDE.md is outside this lane, so the integrator updates it
after merge.

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

The iOS unlock path cannot be tested in CI, since headless Chrome runs with
autoplay allowed. So the iPhone check adds three cases:
- (a) reload with SOUND stored ON in mode B, then swipe first: the first swipe's
  card plays, because the swipe's own `touchend` runs the unlock listener
  before `land()` fires;
- (b) lock and unlock the phone, then flip: it plays (the `"interrupted"` state);
- (c) a burst of fast swipes never stacks.

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

## Eng review (2026-09-30)

This review is /plan-eng-review, FULL_REVIEW, run in a spawned session, so every
decision was auto-chosen and is recorded below. Evidence is `index.html` at
d993f39 (main ed64c8a plus this plan). The outside voice was codex-cli 0.156.1,
read-only.

**Scope challenge.** About 8 files: `index.html`, two test files,
`sandbox.js`, `suite_health.py`, README and about 12 new patches. That sits at the
complexity gate. It passes, because the file count is test and bookkeeping
fan-out, not a design sprawl. It is one lane with no split, and scope was not
reduced.

**Findings.** Folded into §2 and §3 as marked.

| # | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| F1 | P1 | No hook site specified. `render()` runs at boot through `setMode` and the boot share link, with no gesture. Stored ON in mode B or S would queue sound into a suspended context | `index.html:8181`, `:8201`, `:6127`, `:6217` | Hook at the tail of `render()` behind `audioArmed`, set after the boot block. §2 "Hook site" |
| F2 | P1 | The reveal paths were underspecified. The mode-B flip back to the diagram, deck chips, GENERATE and delete, setMode, the shuffle toggle and reroll were not named | `:7858`, `:7864`, `:7883-7884`, `:6199`, `:7979`; the render callers were enumerated by grepping `\brender\b`, including bare references (none exist) | Reveal-path table in §2; T7, T7b |
| F3 | P1 | iOS unlock. `land()` runs in `anim.finished.then`, outside the gesture. `pointerdown` on touch does not unlock. After a stored-ON reload, no toggle tap ever happens. `resume()` gated on `"suspended"` only misses `"interrupted"` | `:8067`, `:8119` | One-shot capture unlock listener on pointerup, touchend, keydown and click; resume when `!== "running"`; generation counter. §2 "Context lifecycle"; §5 (a)-(c) |
| F4 | P1 | `#sound-toggle` is missing from the explicit Tab trap. `sandbox.js` throws on unlisted ids, so every app.test.js boot breaks | `index.html:7910`; `tests/helpers/sandbox.js:25`, `:274` | §2 Toggle; ownership adds `sandbox.js`; T12; `au_not_in_tab_trap` |
| F5 | P2 | A hard `stop()` on cancel clicks | - | 15 ms fade, then stop. §2 "Cancel" |
| F6 | P1 | T8 cannot pass as written: mode A's #next deals the name face, so no second arpeggio starts | `index.html:7864` | T8 moved to mode B |
| F7 | P2 | The stub needs an init script for every e2e test, which leaks across the shared page. "No page error" has no collector, because CDP drops events | `cdp.js:107`; no `addScriptToEvaluateOnNewDocument` anywhere in the suite | Lazy constructor plus a post-load stub; an init script for T13 only, removed in `finally`; `__auErr` collector |
| F8 | P2 | Recording oscillators only cannot catch a disconnected or zero-gain voice (codex) | - | T4c records `connect` and ramps; `au_voice_disconnected` |
| F9 | P2 | Mutant gaps. There is no mutant for boot silence, the Tab trap, the type guard or B/S deal. `au_ding_included` is an unrealistic edit | - | 5 added, 1 replaced; 12 total. `git apply --check` over all patches; 17 at-risk ones named |
| F10 | P3 | Bookkeeping. FLOORS lacked numbers. The README quoted-roadmap line is untouched. CLAUDE.md roadmap item 4 is out of lane. `soundOn` risked a TDZ error at boot | `suite_health.py`; `README.md:127`, `:192`; `index.html:5975` | §3 FLOORS, README, integrator flag; §2 Persistence |

**Decision ledger (auto-decisions).**
- E1: play from `render()`'s tail, not from each transition. It is DRY: one site
  covers the 6 paths, and a future caller inherits it. Rejected: per-transition
  calls, which are easy to miss (the plan already missed 4), and a card-key
  change detector, which misses one-chord decks and same-card rerolls.
- E2: re-clicking the active mode or deck chip replays. This follows from E1 and
  matches "re-revealing plays again". It is recorded, not gated.
- E3: add an `audioArmed` boot gate rather than skipping the first render by
  counting. The gate is explicit and has its own mutant.
- E4: register the unlock listener on `window` in the capture phase with
  `passive: true`. It runs ahead of the document-capture swipe handlers, so an
  eaten click (`stopPropagation` at `index.html:8171`) still unlocks, and it
  cannot interfere with their `preventDefault`.
- E5: replace `au_ding_included` with `au_lit_set_not_voicing`. The latter is a
  plausible real bug, since the lit set is one variable away in `render()`.
- E6: codex's "T9 should seed a sibling key" is not adopted as a new test. The
  existing app test plus `d_save_wholesale` already pin read-modify-write.
- E7: the iOS silent switch stays platform behaviour. `navigator.audioSession`
  is not adopted (N-list unchanged); it is listed as an owner option below.

**Test coverage.**

```
transition            path                    test       mutant
boot / share boot  -> render (unarmed)     -> T13     -> au_plays_at_boot
flip A->back       -> flip()               -> T6      -> au_plays_when_off
flip A->front      -> flip()               -> T6      -> au_plays_on_flip_away
flip B back->front -> flip()               -> T7      -> au_bs_deal_silent
#next B/S          -> step()               -> T7, T8  -> au_bs_deal_silent, au_no_cancel
swipe land         -> land() -> step()     -> T15     -> (shares au_bs_deal_silent)
reroll S           -> setOrder; render     -> T7      -> -
chip / mode        -> selectDeck / setMode -> T7b     -> -
no ctor            -> maybePlay no-op      -> T10     -> au_throws_without_ctx
routing/envelope   -> voice()              -> T4c     -> au_voice_disconnected
notes              -> arpeggio()           -> T1-T3   -> au_not_ascending, au_lit_set_not_voicing
persist            -> save / boot read     -> T9, T14 -> au_not_persisted, au_sound_truthy_guard
Tab trap           -> panelStops()         -> T12     -> au_not_in_tab_trap
iOS gesture unlock -> capture listener     -> NONE in CI (headless autoplay flag) -> §5 device check
```

**Failure modes.**

| Failure | Test | Handling | Silent? |
|---|---|---|---|
| iOS never unlocks (swipe-only session) | none (CI cannot) | unlock listener | yes: owner-device check §5 (a) |
| context `"interrupted"` after a lock | none | resume on `!== "running"` | yes: §5 (b) |
| a stale play bursts after resume | T4c (generation) | generation counter | no |
| no WebAudio | T10 | no-op | no |
| the new group overflows the 1024x700 sidebar | existing `:6729` | CSS | no |

**Performance.** A play creates a few nodes (at most 6 notes x 2 nodes plus one
master) and disconnects them in `onended`. There is no timer and no rAF. This is
negligible.

**NOT in scope.** Volume or tempo pickers (N4), sequence playback (N2),
`navigator.audioSession` (E7), a play button (A3), and sampled audio (N1).

**What already exists.**
- `aria-pressed` with `.mode`/`.on` toggles.
- The `panelStops()` explicit trap.
- `save()` read-modify-write, with its sibling-key test.
- CDP `--autoplay-policy` (`cdp.js:326`).
- `b.swipe` and `finishAnimations`.

**Parallelization.** Sequential implementation, no parallelization opportunity.

**Implementation tasks.**
1. Add `sound-toggle` to `sandbox.js`.
2. Write the app tests T1-T4c and T14 (red).
3. Write the e2e tests T5-T15 (red).
4. Implement `arpeggio`, `diagramShown`, voice, cancel, the lazy context and the
   unlock listener.
5. Add the markup, the `panelStops` entry and persistence.
6. Add the 12 mutants and prove each kills.
7. Run `git apply --check` over all patches and refresh the stale ones.
8. Update FLOORS and the README.
9. Push, let CI run, then the reviewer.

**Owner items (not blocking).** None blocks the lane. Two are listed for later:
- (a) Whether to adopt `navigator.audioSession.type = "playback"` (iOS 17+) so
  sound plays with the silent switch on. The default is no, since the switch is
  the user's own intent.
- (b) Whether re-clicking the active mode or chip should replay. The default is
  yes (E2).

**Completion summary.**
- Step 0: scope accepted as-is.
- Architecture: 3 issues (F1, F2, F3).
- Code quality: 2 (F4, F5).
- Tests: diagram produced, 5 gaps fixed (F6, F7, F8, F9, and T2b for custom decks).
- Performance: 0.
- Outside voice: codex ran; 8 points, 6 overlapping, 2 new adopted (F7
  collector, F8 routing), 1 not adopted (E6).
- Unresolved decisions: 0.
- Critical gaps: 1, the iOS gesture unlock, which is untestable in CI and goes
  to the §5 device check.

Approval readiness: PASS

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | - | - |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | issues_found | 8 points, 2 new adopted |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 10 findings, all folded in, 0 unresolved, 1 critical gap routed to the device check |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | - | - |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | - | - |

**CODEX:** 8 points. 6 overlapped F2, F3, F4 and F6. It added the error
collector (F7) and gain/connect recording (F8). The T9 sibling-key point was
already covered (E6).
**OUTSIDE COVERAGE:** codex ran, read-only, against d993f39.
**VERDICT:** ENG CLEARED. Ready to implement.

NO UNRESOLVED DECISIONS
