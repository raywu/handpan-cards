<!-- Promoted from the 2026-09 planning session. This is the reviewed,
     owner-decided plan for the user-configurable-scale feature. It has NOT
     been built. Two adversarial reviews ran the proposed rules against the
     real deck data; findings marked [verified] were reproduced and are
     ground truth. The OWNER DECISIONS table is binding. -->

# Plan: user-configurable scales -> generated chord flashcards

Draft an implementation plan (do not write feature code yet). Read `CLAUDE.md`
and `tests/CONTRACT.md` first.

This prompt has already survived two adversarial reviews that ran the proposed
rules against the real data. Findings marked **[verified]** were reproduced
against `tools/decks.py` or `index.html` - treat them as ground truth, not as
hypotheses to re-litigate.

## The goal

Let a user define their own handpan - enter the notes (ding, top tonefields,
optional bottom notes), name the scale - and get the same chord flashcards the
three built-in decks produce today, generated automatically.

## Premise correction 1: there is no engine

All 59 chords are hand-authored literal tuples in `tools/decks.py`. The "voicing
rules" in CLAUDE.md are prose describing how humans curated them. Nothing derives
a chord from a set of notes. The work is to BUILD the engine, then expose it.

## Premise correction 2: the 59 cards cannot be exactly reproduced [verified]

> **POST-RETROFIT NOTE (2026-09):** the owner retrofitted Hijaz and Pygmy to the
> cluster-downward rule (7 cards revoiced; see CLAUDE.md). Consequences for this
> plan: (a) all three decks now share ONE voicing convention, so the per-deck
> `downward_policy` parameter is no longer needed to explain the corpus - D2's
> `cluster_all` is now simply "the rule"; (b) the Premise-2 numbers (48/59,
> 56/59, 3 unreachable) were measured BEFORE the retrofit and must be
> re-measured - the `Pygmy Fsus4` exception is expected to disappear since
> `[5,104,3]` is now the curated voicing; (c) root-octave selection (Premise 3)
> and chord selection (Premise 4) are unaffected and remain the real work;
> (d) containment stays the gate - do not reinstate "exact reproduction" until
> the re-measurement says it is reachable.


**The corpus has two authors and they disagree.** D Amara was transcribed from a
commercial deck; Hijaz and Pygmy are the owner's own work. Measured, by
implementing the stated rules and diffing all 59 cards: **48/59 fully automatic,
56/59 if the root octave is supplied free, 3 unreachable by any consistent rule.**

Proof, from cards with identical options available:

- Hijaz `F#sus4` = `[6,8,3]` = F#4, B4 **up**, C#4 down - only the 4th is forced
  down. Amara `Gsus4` = `[6,2,3]` = G4, C4 **down**, D4 down - both moved down,
  although `[6,8,3]` (G4, C5, D4) is available on Amara and is exactly the Hijaz
  shape. Same topology, same `_geom`, opposite answers.
- Amara `Fmaj7` = `[5,1,2,4]` moves the 3rd and 5th down although A4 and C5
  exist. Pygmy `Cm7` = `[3,4,6,104]` keeps them up and drops only the 7th.
- Pygmy `Fsus4` = `[5,104,8]` spans 14 semitones; `[5,104,3]` spans 2, is
  available, and was rejected. No rule reaches this card.

**Consequence: "exact reproduction" is not a reachable exit criterion and must
not gate any stage.** Replace it with:

1. **Containment** - for each curated chord, the engine's candidate set must
   CONTAIN the curated voicing. Verified satisfiable: all 59 are legal under the
   stated invariants. This is the real, passable gate.
2. **A per-deck `downward_policy` parameter**, documented as provenance not
   preference: Amara = `cluster_all`, Hijaz/Pygmy = `drop_only_forced`.
3. **A committed exception list** for cards no policy reaches, `Pygmy Fsus4`
   first among them - declared up front, not discovered mid-build.
4. **Delete "match rate as the headline metric."** A match rate against a
   two-author corpus measures authorship, not engine quality. Publish a
   divergence table instead.

## Premise correction 3: the named "traps" were the easy part [verified]

The prompt previously highlighted the Amara `G5` inverted fifth and duplicate
pitch-class sets. Of 13 failures under a naive rule set, **11 are root-octave
choices** - a problem the plan never mentioned. And there is no derivable rule:
Pygmy roots `Eb MAJOR` at Eb4 (top shell) but `Eb DOMINANT 7` at Eb3 (bottom
shell); `Cm7` roots at C4 although C3 exists and is usable. Neither "lowest
instance" nor "prefer top shell" nor "avoid bottom notes" holds.

Root-octave selection is a first-class named problem. Budget for it accordingly.

## Premise correction 4: chord SELECTION is a separate unsolved problem [verified]

The rules say how to voice a chord. Nothing says which chords make the deck.
Candidate space against a 30-quality vocabulary:

| deck | distinct pc-sets derivable | root-instance x quality | shipped |
|---|---|---|---|
| Hijaz | 22 | 39 | **18** |
| Pygmy | 52 | 141 | **25** |
| Amara | 28 | 46 | **16** |

A naive generator emits 40-140 cards for a 9-note pan. A drill deck stops being
drillable near 30. Worse, the three decks apply *inconsistent* selection: Hijaz
omits `F#5` while Amara ships the structurally identical `G5`; Hijaz ships 1 of 4
available diminished triads; Amara ships zero extended chords though `Dm9`,
`Dm11`, `C6/9`, `Fmaj9` are all available; Pygmy ships 2 of 5 sus4.

Only two selection rules hold across all three decks and are mechanical: sus2
collapses into sus4, and 6 / m6 collapse into m7 / m7b5. Everything else is
editorial. The plan needs a default vocabulary, a hard cap, a ranking function,
and a per-deck override list committed as data.

## Premise correction 5: "root-position" is wrong for 12 of 59 [verified]

CLAUDE.md's "lowest compact root-position voicing" describes the spelling order
of the field list, NOT register. Twelve shipped voicings do not have the root in
the bass. An implementer who writes a bass-note constraint fails a fifth of the
corpus. Also note only one of the six stated rules is a *selector*; the other
three invariants eliminate no ambiguity. Rule count is not rule coverage.

## OWNER DECISIONS (locked - do not re-litigate)

| # | Decision | Consequence for the engine |
|---|---|---|
| D1 | **Core drill deck, ~18-25 cards.** Triads, power chords, sus4, and 7ths (maj7/m7/dom7/m7b5/dim7). Extended chords only where the scale makes them obvious. | Sets the default quality vocabulary and the cap. Ranking only has to break ties inside this vocabulary, not police a 141-card space. |
| D2 | **`downward_policy = cluster_all`, scoped to chord tones.** When any tone is forced below the root, every chord tone (3/5/7, sus 4th, 6-chord 6th) moves to its highest lower instance; a tone with no lower instance stays put; extensions named in the symbol (add9/9/b9/11/#11/13) keep their nearest instance above the root unless themselves forced; bottom-shell fields are ordinary instances. | Originally only D Amara's convention; the owner then retrofitted Hijaz and Pygmy to it (7 cards), so all three built-ins and all generated decks share one rule. No per-deck parameter needed. |
| D3 | **No custom-scale PDFs in v1.** App only; defer `tools/gen_deck.js` and the Python adapter to a later phase. | Phase 6 drops out of the critical path. The print card's hard limits (6-note voicings, ~25-char subtitles) still bound the engine - see Rendering budgets - because generated decks must stay printable later without a redesign. |
| D4 | **Equivalence annotations are a per-card override field.** Built-ins keep exactly the two they ship, frozen as data; custom scales derive them mechanically. | No deck-data change, no PDF rebuild, freeze intact. The five unannotated eligible cards (Pygmy Gm7b5/Fm7/Cm7, Amara Dm7/Am7) are recorded as provenance, not bugs. |
| D5 | **Stay vanilla.** No framework, no CDN script, no build step. | The single-file constraint and the zero-dependency claim survive, and `tests/helpers/sandbox.js` keeps working - a CDN `<script src>` cannot load in `node:vm` at all, so any framework would have forced a harness rewrite before Phase 3. The layout editor's state is hand-rolled. |
| D6 | **Custom deck colours come from a fixed owner-approved palette set** (6-8 curated root/tone pairs; user picks, or assigned by hash of the scale name). | Closes the injection vector: the share URL carries a palette INDEX, never a colour string, so nothing user-supplied reaches an SVG or style attribute. Also preserves hand-tuned contrast (Pygmy's gold was deliberately darkened) that an auto-hue picker would regress. The owner must author the palette set. |
| D7 | **Spill to an inner ring past the rim ceiling.** | Rim capacity is `pi/asin(r_note/rim)` ~ 12 fields at Hijaz/Amara proportions [verified]. Beyond it, remaining notes go to an inner ring beside the ding - exactly what the real Pygmy does with F5/G5. The geometry solver (Phase 1B) owns the spill rule and must keep the inner pair's opposite-ascending convention. Do NOT shrink fields to fit: the print pipeline silently clips below its font floors. |
| D8 | **Degrees are mode-aware**: minor-relative labels (`III`, `VII`) for scales with a minor third, major-relative with flats (`bIII`, `bVII`) otherwise. | [verified] This makes Hijaz (major 3rd -> `I`, `bII`, `bvii`) and Pygmy (minor 3rd -> `III`, `VII`) both fall out of the rule automatically. **D Amara becomes the frozen exception**: it is a minor scale but ships `bIII`/`bVII`, inherited from the commercial deck. So the exception lands on transcribed data rather than on owner-authored data. The engine needs mode detection, and a defined fallback for scales with no third and for symmetric/atonal sets. |


## Architecture: do not migrate the built-ins

The real decision is not JS-vs-Python. It is **whether the built-in decks ever
become generator output.** They should not.

- The three decks are physically verified, owner-curated, and CLAUDE.md forbids
  changing them. Re-deriving them is pure risk for zero product value.
- Keep `tools/decks.py` hand-authored literals **permanently**. The 59 cards
  become a frozen one-way comparison fixture, never data the engine replaces.
- This makes "the three built-in decks render identically" trivially true rather
  than something to defend, and keeps `tools/validate.py` a genuine cross-check
  instead of a generator comparing against itself.
- For custom-scale PDFs: `tools/gen_deck.js` (Node CLI emitting one deck JSON)
  plus a small adapter in `decks.py`. Node becomes a dependency only for custom
  PDFs; `python3 tools/decks.py` stays reportlab-only, as README promises.
  Watch the int-vs-string field key boundary: `validate.py` does `spec[int(fid)]`
  and `hifi.draw_pan` iterates integer keys.

Rejected, with reasons: porting the engine to both languages doubles the
chord-theory surface for no user benefit (the existing renderer duplication is
grandfathered, not a precedent); client-side PDF is a third card renderer and
cannot honour the 62.65 x 87.21 mm spec across browser print scaling - the
calibration bar exists precisely because scaling is unreliable; a build-on-demand
GitHub Action needs authenticated dispatch, i.e. the backend we are avoiding.

## The engine must also decide these [verified problems, not open questions]

- **Root selection under ambiguity.** Hijaz `D°7` = {D,F,G#,B} has four equally
  valid roots. "Root = bass" fails on the 12 cards above. Enharmonic *chord-tone*
  spelling is out of scope - the cards print field labels, not chord spellings
  (Hijaz `D°7` prints `D4-F4-G#4-B4`, not Ab/Cb). The derivable disambiguation
  rules already in the data: prefer sus4 over sus2, prefer m7 over 6, m7b5 over
  m6. Accidental convention is per-scale from the tonic (Hijaz sharps, Pygmy
  flats, Amara naturals).
- **Scale degrees.** Tonic = ding pitch class in all three decks; that question
  is already answered. The real problem: Pygmy labels degrees relative to natural
  minor (`III`, `VII`) while Hijaz and Amara label relative to major (`bIII`,
  `bVII`). No single rule yields both `III` (Pygmy Ab, +3) and `bIII` (Amara F,
  +3). Pick the majority convention, freeze Pygmy as an exception. Case is also
  inconsistent where no third exists (Hijaz `iv` vs Amara `IV`, identical inputs).
- **Equivalence annotations conflict with the data freeze.** Seven cards are
  eligible for `( = X6 )`; two carry it, five identical cases do not, with no
  distinguishing feature. Any derivation rule that produces the two produces five
  more - a deck-data change the non-negotiables forbid. Owner decision required:
  per-card override field, or approve adding five annotations plus a PDF rebuild.
- **Multi-voicing is opt-in data, not a policy.** 30 shipped chord types have
  more usable root instances than shipped cards; only 4 groups got alternates,
  with no feature distinguishing them. Default one card; record the 9 built-in
  alternates as data.
- **Card order is editorial.** Root order differs per deck and is non-monotonic;
  within-root order is inconsistent inside a single deck (Amara's `D` group runs
  triad->7->power->sus, its `C` group triad->power->sus). Since PDFs lay out in
  list order, order is part of the golden output and is not derivable. Define a
  canonical order for generated decks; leave built-ins untouched.

## Rendering budgets are hard engine constraints [verified]

`hifi.bottom_lines` shrinks the note line to a 4.4pt floor and the number line to
4.2pt, then draws regardless of fit; `card_header` fits the subtitle to a 3.6pt
floor with the same behaviour. Current maxima are 6 notes (Pygmy Fm11) and 25
characters. A generated 10-note pan yields 7-note voicings and subtitles like
`Db MAJOR 7 SHARP 11 ( = Ab6/9 ) - HIGH VOICING`, which will silently clip.
Max notes per voicing and max subtitle length are engine constraints derived from
the print card, with tests.

**Geometry ceiling [verified]:** rim fields collide when
`2*rim*sin(pi/N) < 2*r_note`, i.e. `N_max = pi/asin(r_note/rim)` = **12.2 at
Hijaz/Amara proportions**, 15.8 at Pygmy's. A 12-note custom scale is already at
the limit. `r_note`, `f_note`, `f_num`, `n_in`/`n_out` must become functions of N
with an explicit spill rule to the inner ring.

**`pan()` does not generalise [verified]:** `g.inner` and `g.bottom` exist only
on Pygmy, so a generated deck missing them yields `NaN` and a blank diagram;
`ext` is hardcoded `R*1.06` for bottomless decks rather than derived from the
furthest drawn element, so Pygmy-style outward numbers on a bottomless custom
scale clip at the viewBox edge. And the app has **no label auto-fit** while the
print pipeline does (`fit_note` with a 3.6pt floor) - today masked by hand-tuned
per-deck `f_note`. `test_render_agreement.py` compares circle centres, radii and
the note/number/badge lines but **never diagram label font size**, so this
divergence is invisible to the entire suite.

## Sharing is untrusted input [verified - security]

`esc()` escapes only `&` and `<`, never `"`, and colour values reach SVG and
style attributes **without passing through `esc()` at all**. Demonstrated:
`#000" onload="alert(1)` breaks out of `stroke="..."`. Safe today only because
deck data is a committed literal; a shared `#s=...` link is exactly the delivery
vector. Required: a decoder that validates every value against a whitelist (MIDI
0-127, zone enum, angle 0-359, colours `/^#[0-9A-Fa-f]{6}$/`, capped name length
and charset) and **rejects rather than repairs**; custom decks take palettes from
a fixed owner-approved set, never from the URL.

**Encoding [verified sizes]:** encoding the output deck costs ~0.8-1.3 kB of URL
(Pygmy: 3,147 bytes JSON, 1,252 base64url-of-gzip) and freezes generator output
into the link. Encoding the **seed** costs ~50 bytes -> ~68 chars. Mandate seed
encoding with a leading **version byte**, reserve space for Phase-5 layout deltas
so earlier links do not break, and answer explicitly: when the engine improves,
does an old link render old or new cards?

**`localStorage` [verified]:** `save()` is an unconditional whole-key overwrite
of `hpfc`. Any sibling field - spaced-repetition progress, saved scales - is
destroyed on the next deck or mode change, and no current test catches it. Change
to read-modify-write merge, put saved scales under a separate key, and add a test
plus mutant for "an unrelated sibling field survives a save".

## Layout default: Pygmy pattern, mirrored right-first (owner decision)

Custom scales get a generated layout the user can customise. Default generalises
the verified Pygmy arrangement: ding enlarged and offset toward the player
(`r=0.19R`, `dy=0.1425R`); top rim **mirrored right-first** zig-zag ascending
from bottom-right (~290 deg) to top centre (90 deg); inner pair at ~128/~52 deg
ascending **opposite** to the rim direction; bottom notes as a dashed outer ring
in x-ray view with the orange badge.

Must generalise beyond 9+2+6 (define 5 notes, 13 notes, no inner pair, no bottom
shell), must be customisable (mirror, rotate, reorder), must be labelled honestly
as a default rather than a measurement, and must never be retro-applied to the
built-ins - Hijaz and Amara are verified left-first.

## THE SWARM

Exclusive file ownership per lane; no two lanes write the same path. Phases are
serial, lanes inside a phase are parallel.

### Phase 0 - unblocks everything, ships nothing (SERIAL)

| Lane | Scope | Owns |
|---|---|---|
| **P0a** | Engine spec: voicing invariants, `downward_policy`, root-octave policy, selection vocabulary + cap + ranking, naming disambiguation, degree convention, exception list. Owner-approved BEFORE any engine test exists, or every test is a mirror of the implementation (CONTRACT rule 1). | `ENGINE-SPEC.md` |
| **P0b** | Freeze the corpus: extract the 59 cards from a named commit into a fixture, with a SHA-256 self-assertion so it can never be quietly regenerated from the engine. | `tests/fixtures/golden_decks_v1.json`, `tests/test_fixture_integrity.py` |
| **P0c** | Harness prep. `sandbox.js` cannot survive Phase 3: its `/<script>([\s\S]*)<\/script>/` is greedy and needs a bare tag; `getElementById` throws on any id outside a fixed 10; the vm context has no `location`, `URL`, `btoa`, `history`. Extend it, add the engine mutant prefix to `mutation_check.sh` `suite_for()`, raise `suite_health.py` floors. | `tests/helpers/sandbox.js`, `tests/mutation_check.sh`, `tests/suite_health.py`, `tests/CONTRACT.md` |

Note: `mutation_check.sh` refuses to run against a tree modifying `index.html` /
`decks.py` / `hifi.py`, i.e. during most feature work. State when in the loop the
mutation gate actually runs (pre-push, clean tree) or it will rot.
Also: `b_*`/`c_*` mutants are line-anchored against the single-line `const DECKS`
literal - reflowing that line or moving deck data turns every one STALE.

### Phase 1 - engine core (PARALLEL)

| Lane | Scope | Owns |
|---|---|---|
| **A** | **Legality engine.** Enumerate all legal voicings for a (root-pc, interval-set): no ding, no doubled pitch classes, power chords = 2 notes, `(b-a)%12` intervals. Exit: **containment** - every one of the 59 curated tuples appears in its chord's candidate set. Verified satisfiable. | `src/engine/voicing.js`, `tests/test_voicing.js`, `tests/mutants/v_*` |
| **B** | **Geometry solver.** `r_note`/`f_note`/`f_num`/`n_in`/`n_out` as functions of N with the collision ceiling and inner-ring spill; always emit the full geom shape (zeroes, not missing keys); compute `ext` from the furthest drawn element. Exit: synthetic scales at N=5..15 render in BOTH renderers with no overlap and nothing outside the viewBox. | `src/engine/layout.js`, `tests/test_layout.js`, `tests/mutants/g_*` |
| **C** | **Namer + degrees.** Quality naming, root disambiguation on symmetric sets, sus4-over-sus2 and m7-over-6 rules, per-scale accidental convention, degree labels with the majority convention. Exit: reproduces built-in `main`/`sup` modulo a recorded exception list. | `src/engine/naming.js`, `tests/test_naming.js`, `tests/mutants/n_*` |

### Phase 2 - ranker and selector (SERIAL, depends on A + C)

Root-octave policy, `downward_policy` per deck, quality vocabulary, cap, ranking,
dedup rules, per-deck override lists. Exit: a committed **divergence table**
against the fixture - not a match rate. Expect ~48/59 shared policy, ~56/59
per-deck, 3 permanent exceptions.

### Phase 3 - first user-visible ship (SERIAL)

Scale input -> generated deck -> existing card renderer, in memory, no
persistence. This is the walking skeleton. It cannot come earlier: the renderer
needs `geom` plus per-field zone and angle before it can draw anything, which is
Phase 1B.

### Phase 4 - persist and share
Versioned seed encoding, validating decoder, `hpfc` merge fix, layout-delta space
reserved.

### Phase 5 - layout customisation
Mirror / rotate / reorder, filling the space Phase 4 reserved.

### Phase 6 - print, then presets
`tools/gen_deck.js` + adapter; presets as committed JSON loaded at runtime,
**never merged into the `DECKS` literal** (`validate.py` does `PY[d["id"]]` over
every deck in the app JSON and would `KeyError`; `paths.app_decks()` also
requires `^const DECKS = (\[.*\]);$` to stay one line).

## Still missing, name them in the plan

Palette rule for a fourth deck (the three are hand-picked and Pygmy's gold was
deliberately darkened for contrast - an auto-hue picker regresses that); the
~17 print-only per-deck keys a generated deck must synthesise or omit (`sub`,
`credit`, `blurb`, `legend_lines`, `legend_demo`, `blank_cards`, `R`, `cy`, ...);
deck-chip UI at 380px with N custom decks plus delete/rename and what happens to
`store.deck` when the selected custom deck is deleted; custom deck id stability
(edit your scale -> new id -> orphaned SR progress; recommend a content hash with
a `custom:` prefix); accessibility for note entry and the drag-to-reorder editor;
a generation-time budget, since this runs on every link open on a phone; and the
PWA interaction - a cached old `index.html` cannot decode a newer URL version, so
the version byte needs a "this link needs a newer app" path.

## Degenerate cases that will actually reach users

Not "3 notes? 30 notes?" but: a scale with **no perfect fifth on any degree**
(whole-tone subsets) yields zero triads and zero power chords - the UI must say
why; fewer than 3 pitch classes yields only power chords; **symmetric scales**
(diminished, whole-tone, augmented) make root selection arbitrary for every
chord, so the same set gets named 3-4 ways depending on tie-break; a pan with no
ding, or whose ding pitch class is absent from the top shell, leaves tonic
inference with nothing to work from.

## Non-negotiables

- Built-in decks stay literal and render identically. The suite on `main` proves
  it; keep it green rather than asserting it.
- Engine code follows `tests/CONTRACT.md`: spec-first, no importing constants
  from the module under test, every test group needs a killing mutant.
- The app keeps working offline-ish and at 380px.

## Reference sites

`https://handpaner.com/` and `https://www.dingandtones.com/scale` were unreachable
from both the drafting and reviewing environments (egress proxy). Proceed without
them and mark every competitor claim as unverified, or ask the owner to describe
the flows.
