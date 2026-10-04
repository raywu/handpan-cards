# Amy Naylor progressions vs the EASY progression generator

Status: FINDINGS, 2026-10-04. Not a build plan. Owner task: "Pull out the
Roman numerals chord numbers and design a prompt to evaluate our easy chord
progression generation against these progressions ... Output a summary table
so I understand the difference between our generation engine and what Amy
recommends." Interview answers (2026-10-04) fixed the scope: video 2 enters as
a separate chord-vocabulary row; the minor-set qualities are the diatonic
natural-minor reading; the axes are reachability, root-motion profile and
per-deck coverage; deliverable is this doc plus the chat table.

Everything in sections 4-6 was computed against the shipped engine
(`src/engine/sequence.js` at main `01915a6`) and `data/decks.json` by the
probe in section 10, not reasoned by hand.

## 1. Sources

- Video 1: https://youtu.be/-BD13QhFJ-M (Amy Naylor), ten progressions. The
  owner supplied the transcript summary with plain digits; qualities below
  were confirmed by the owner as the diatonic reading.
- Video 2: https://youtu.be/0hMIUnA5-OI, "Make Your Chords Way More
  Interesting | Extended Handpan Tutorial" (8:02). No transcript could be
  pulled (YouTube returns an empty caption body without a proof-of-origin
  token; no yt-dlp on the machine). Section 7 records what could be
  recovered from the chapter list and description.

## 2. The ten progressions (Roman numerals, confirmed qualities)

Natural minor: i, iv, v minor; III, VI, VII major. Major: I, IV, V major;
ii, iii, vi minor. Amy's own example for A2 is Dm Am Bb C, so her pan is a D
minor pan WITH Bb, and her major set is in F major, the relative major.

| id | mode | numerals | in Amy's key | video time |
|---|---|---|---|---|
| A1 | minor | i VI III VII | Dm Bb F C | 0:44 |
| A2 | minor | i v VI VII | Dm Am Bb C | 1:43 |
| A3 | minor | i III VII iv | Dm F C Gm | 2:37 |
| A4 | minor | i VII VI v | Dm C Bb Am | 3:24 |
| A5 | minor | i VII v VI | Dm C Am Bb | 4:40 |
| A6 | major | I IV V | F Bb C | 5:40 |
| A7 | major | I V vi IV | F C Dm Bb | 7:05 |
| A8 | major | I vi IV V | F Dm Bb C | 7:50 |
| A9 | major | IV iii ii I | Bb Am Gm F | 8:55 |
| A10 | major | ii V I | Gm C F | 9:54 |

## 3. Mapping rule onto our decks

- Minor set: tonic = the deck's home pitch class (the ding), as the engine
  defines it. Pygmy F minor, Amara D minor.
- Major set on a minor pan: tonic = the RELATIVE major (Pygmy Ab major,
  Amara F major). This is what Amy does (D minor pan, F major set).
- Hijaz (C# D F F# G# B) is neither natural minor nor major. The minor set
  is read from C# (no C#m card exists, the pan has the major third) and the
  major set from C# as I. Both readings are shown so the gap is visible.
- "Exact" = a card with that root and that triad quality exists (register
  variants aside). "Substitute" = no such card, but the engine's anchor on
  that root exists (sus4, dim or power chord). "Missing" = no card on that
  root at all.

## 4. What the EASY generator can emit

`pickBasic` (`src/engine/sequence.js`): length 2 or 3; first chord is the
home anchor; one anchor per root (maj/min > sus4 > dim > power, at most three
fields); distinct roots; every consecutive pair must `connects()` (share a
pitch class, or roots 1-2 semitones apart); length 3 must also connect back to
the start. The complete EASY pools:

| deck | anchors | len 2 | len 3 | total |
|---|---|---|---|---|
| Hijaz | C#, D°, F°, F#sus4, G#°, Bm | 5 | 18 | 23 |
| Pygmy | Fm, G°, Ab, Bbm, Cm, Db, Eb | 6 | 30 | 36 |
| Amara | Dm, F, Gsus4, Am, C | 4 | 12 | 16 |

Sampling 3,000 deals per deck confirms exactly these counts (23 / 36 / 16
distinct sequences).

## 5. Per-progression reachability and coverage

Verdicts: EASY = in the EASY pool. MEDIUM / HARD = classified at that tier by
`tierOf` and every pair connects, so that tier can deal it. NONE = every card
exists but no tier can deal the sequence. GAP = at least one chord has no card
on that root. "~" marks a substitute card.

| id | Amy | Pygmy (F minor / Ab major) | Amara (D minor / F major) | Hijaz (from C#) |
|---|---|---|---|---|
| A1 | i VI III VII | Fm Db Ab Eb: MEDIUM (length 4) | Dm Bb F C: GAP (no Bb) | GAP (no A, no E) |
| A2 | i v VI VII | Fm Cm Db Eb: MEDIUM (length 4) | Dm Am Bb C: GAP (no Bb) | GAP (no A) |
| A3 | i III VII iv | Fm Ab Eb Bbm: MEDIUM (length 4) | Dm F C ~Gsus4: MEDIUM (length 4; Gm has no card) | GAP (no E) |
| A4 | i VII VI v | Fm Eb Db Cm: MEDIUM (length 4) | Dm C Bb Am: GAP (no Bb) | GAP (no A) |
| A5 | i VII v VI | Fm Eb Cm Db: MEDIUM (length 4) | Dm C Am Bb: GAP (no Bb) | GAP (no A) |
| A6 | I IV V | Ab Db Eb: NONE (starts on Ab, not home; length 3 has no non-home tier) | F Bb C: GAP (no Bb) | C# ~F#sus4 ~G#°: EASY, with two substitutes |
| A7 | I V vi IV | Ab Eb Fm Db: HARD only (start not home) | F C Dm Bb: GAP (no Bb) | GAP (no Bbm) |
| A8 | I vi IV V | Ab Fm Db Eb: HARD only (start not home) | F Dm Bb C: GAP (no Bb) | GAP (no Bbm) |
| A9 | IV iii ii I | Db Cm Bbm Ab: HARD only (start not home) | Bb Am Gm F: GAP (no Bb, no Gm) | GAP (no Ebm) |
| A10 | ii V I | Bbm Eb Ab: NONE (start not home; length 3) | ~Gsus4 C F: NONE (start not home; length 3) | GAP (no Ebm) |

Per-deck coverage (every chord available as an exact card): Pygmy 10 of 10.
Amara 0 of 10 exact (2 of 10 with a substitute: A3 and A10, Gsus4 for Gm). Hijaz 0 of 10 exact (1 of 10
with substitutes).

Reachable at EASY: Pygmy 0 of 10, Amara 0 of 10, Hijaz 1 of 10 (A6, with
substitutes, about one deal in 36).

Reachable at any tier: Pygmy 8 of 10 (5 MEDIUM, 3 HARD), Amara 1 of 10
(A3 with Gsus4 at MEDIUM), Hijaz 1 of 10.

### 5.1 "Reachable at MEDIUM" is nominal

MEDIUM draws a length (3 or 4) uniformly, then one sequence uniformly from
that length's pool (random sampling, DFS fallback). The length-4 pools:

| deck | MEDIUM length-4 sequences | of which anchor-only (sus4 anchors included) | odds of one specific A-row per deal |
|---|---|---|---|
| Pygmy | 41,012 | 120 | 1 in 82,024 |
| Amara | 7,800 | 24 | 1 in 15,600 |
| Hijaz | 4,369 | 48 | 1 in 8,738 |

3,000 MEDIUM deals per deck produced none of Amy's progressions. The pool is
card-based: 99.7% of Pygmy's length-4 MEDIUM sequences contain at least one
non-anchor card (a sus4, power, 7th, extension or register voicing). Amy's ten are plain triads throughout.

## 6. Root-motion profile

`connects()` admits a pair when the chords share a pitch class OR the roots
are a step apart. Any two diatonic triads of a seven-note scale satisfy one of
those (triads a third apart share two tones, a fourth/fifth apart share one, a
step apart pass the root clause, a tritone apart share one). Measured on the
anchors: Pygmy admits all 42 ordered pairs, Amara all 20, Hijaz 28 of 30 (only
D° <-> F#sus4 is refused: a major third apart, no shared tone). On Pygmy and
Amara the root-motion rule constrains nothing; on Hijaz it removes only the
two length-3 loops through D° and F#sus4 (20 -> 18). Otherwise the EASY pool
is shaped by length, start-on-home, one-anchor-per-root and distinct roots.

Amy's 28 consecutive root motions (within each progression, no wrap):

| class | count | where |
|---|---|---|
| step (1-2 semitones) | 13 | A2 x2, A4 x3, A5 x2, A6, A7, A8, A9 x3 |
| third (3-4) | 6 | A1, A3, A5, A7, A8 x2 |
| fourth / fifth (5, 7) | 9 | A1 x2, A2, A3 x2, A6, A7, A10 x2 |
| tritone | 0 | |

Note for the owner: the interview framed Amy as "3rds/4ths/5ths"; by count
she is step-heavy (A4 and A9 are pure step walks). Our rule admits all three
classes equally, so the profile difference is not a filter difference. It is
a distribution difference: EASY picks a length first, then uniformly among
that length's admitted sequences (section 5 gives the length-first odds),
while Amy's set favours stepwise walks and a return to home.

## 7. Video 2: chord vocabulary (owner to fill)

Video 2 is "Make Your Chords Way More Interesting | Extended Handpan
Tutorial" (Amy Naylor - Handpan Connect, 2025-12-22, 8:02). Chapters: 0:00
introduction and basics; 1:05 understanding inversions; 2:51 applying bottom
notes; 5:46 practice challenge. By its chapters it is about INVERSIONS and
BOTTOM NOTES on an extended pan, not a list of chord symbols.

Transcript status (2026-10-04): not obtainable from this environment. The only
caption track is English auto-generated; its URL returns a 0-byte body, the
InnerTube player endpoint answers "Precondition check failed" or
LOGIN_REQUIRED for every client, and the watch page's own transcript panel
opens empty for the same reason (YouTube's bot gate on a headless session).
The description, chapter titles and comments name no chords. Filling the row
needs the owner to watch the video, or a signed-in browser / yt-dlp for the
auto captions.

| technique or chord type Amy demonstrates | applied to a progression? | Pygmy cards | Amara cards | Hijaz cards |
|---|---|---|---|---|
| (owner) | (owner) | | | |

Card types we ship today, for reference: sus4, 7sus4, maj7sus4, m7, maj7,
dom7, 7b9, m9, maj9, madd9, m11, 6/9, m6/9, m7b5, °7, power chords (full
list in section 10's probe output). Inversions and bottom-note voicings are
already card concepts here: Pygmy's LOW VOICING cards and its bottom-shell
badge are exactly "applying bottom notes".

## 8. The evaluation prompt (reusable)

Give this to a lane or a model together with `data/decks.json`,
`src/engine/sequence.js` and the progression list in section 2. It is written
so the answers come from running the engine, not from reading it.

```
You are evaluating the handpan-cards EASY progression generator against a
reference list of chord progressions written in Roman numerals.

Inputs:
  - data/decks.json (decks, fields with MIDI numbers, chord cards with
    `fields` and `roots`).
  - src/engine/core.js and src/engine/sequence.js, loaded with
    tools/engine_loader.js: loadEngine(["core","sequence"]).
  - A reference list: id, mode (major|minor), numerals, source timestamp.

Mapping:
  1. Minor-mode rows: tonic = HPE.sequence._internal.homePc(deck).
  2. Major-mode rows on a deck whose home chord is minor: tonic = home + 3
     (relative major). On a deck whose home chord is major: tonic = home.
  3. Natural-minor qualities (i iv v minor; III VI VII major; ii dim).
     Major qualities (I IV V major; ii iii vi minor; vii dim).
  4. Resolve each numeral to a card: EXACT = same root pitch class and same
     triad quality, excluding LOW/HIGH VOICING cards; else SUBSTITUTE = the
     engine's anchor on that root (HPE.sequence.anchors(deck)); else MISSING.

Axes, per deck, per row:
  A. EASY reachability: is the resolved card sequence in
     HPE.sequence.sequences(deck, 2) or (deck, 3)? If not, list every
     failing rule: length > 3; first chord not the home anchor; a repeated
     root; a card that is not an anchor; a consecutive pair (including the
     wrap from last to first at length 3) that fails connects().
  B. Tier reachability: HPE.sequence.tierOf(deck, cards) when every card
     resolves, plus the wrap-around connects() check makeAccept applies.
     Report EASY / MEDIUM / HARD / NONE / GAP.
  C. Odds: for a MEDIUM or HARD verdict, count that tier's pool at the row's
     length with _internal.dfsFindAll(startSet, pool, len, accept, budget)
     and report 1 / (number of lengths at that tier x pool size).
  D. Root-motion profile: count, over the reference list, consecutive root
     motions by class (step 1-2 semitones, third 3-4, fourth/fifth 5 or 7,
     tritone 6). Then count, over the deck's anchors, which ordered pairs
     connects() admits and refuses, grouped by the same classes.
  E. Coverage: rows where every chord resolves EXACT; rows that need a
     SUBSTITUTE; rows with a MISSING root, naming the missing pitch class.

Output: one table with a row per reference progression and a column per
deck, each cell holding the resolved card names and the verdict; a second
table for axis D; a coverage line per deck; and a sampling check (3,000
pick() calls per tier per deck with mulberry32) that confirms the verdicts
empirically. Report counts, not impressions. Do not propose engine changes.
```

## 9. What the comparison says (summary)

| dimension | our EASY generator | Amy's ten |
|---|---|---|
| length | 2 or 3 chords | 3 or 4; eight of ten are 4 |
| first chord | always the home anchor | eight of ten start on the tonic; A9 starts on IV, A10 on ii, and on a minor pan the whole major set starts away from home |
| key | home key only | half the set is in the relative major of the same pan |
| chord quality | one anchor per root; sus4 / dim / power stand in when no triad exists | plain major and minor triads only |
| root motion | share a tone or step; admits every diatonic pair | 13 steps, 6 thirds, 9 fourths/fifths of 28 |
| loop | length 3 must close back to home | every progression is played as a loop; A10 is pitched as an ending |
| result on Pygmy | 0 of 10 at EASY; 5 at MEDIUM (about 1 in 82,000 per deal), 3 at HARD, 2 never | all ten playable, every chord is a card |
| result on Amara | 0 of 10 at EASY; 1 at MEDIUM with Gsus4 for Gm; 8 need Bb, which the pan does not have | Amy's own pan has Bb |
| result on Hijaz | 1 of 10 at EASY (I IV V as C# F#sus4 G#°) | the pan is not diatonic major or minor |

The gaps, in order of weight: (1) length, EASY stops at 3 and Amy lives at 4;
(2) start-on-home, which hides the relative-major half of the set on every
minor pan and A9/A10 on every pan; (3) MEDIUM's pool is card-based rather
than triad-based, so the four-chord triad progressions exist there only
nominally; (4) Amara has no Bb, which is a pan fact, not an engine fact.
The ranking orders CAUSES of unreachability; it is not a fourth evaluation
axis (length distribution was excluded from the axes in the interview).
Owner decision (2026-10-04 interview): gaps (1) and (2) become one serial
follow-up lane, planned in `docs/plans/2026-10-04-easy-tier-amy.md`:
EASY deals 2, 3 or 4 evenly; EASY and MEDIUM may start on any anchor; the
D-1 byte-identical BASIC pin from `2026-10-02-sequence-difficulty.md` is
lifted and re-pinned. Gap (3) is not taken up. No named presets.

## 10. Reproduction

Probe used for sections 4-6 (scratchpad `amy_eval.js`, not committed): loads
the engine with `tools/engine_loader.js`, resolves each numeral per section 3,
calls `sequences`, `tierOf`, `buildConnectMatrix`, `anchors`, samples
`pick()` 3,000 times per tier with `mulberry32(7)`, and counts MEDIUM pools
with `dfsFindAll` at a 5e7 node budget. HARD pools at length 6 exceed the
node heap on Hijaz (28.9 million sequences) and were not counted for Pygmy or
Amara; no verdict depends on them.
