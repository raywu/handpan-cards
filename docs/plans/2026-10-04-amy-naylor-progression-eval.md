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

## 4. What the EASY generator can emit (pre-lane, superseded by section 11)

Sections 4, 5 and 9 describe the engine BEFORE PR #233 (`claude/easy-tier-amy`,
merged as main 71ba20d). They are kept as the baseline; section 11 holds the
rerun against the merged engine.

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
     HPE.sequence.sequences(deck, 2), (deck, 3) or (deck, 4)? If not, list
     every failing rule: length > 4; first chord not an anchor; a repeated
     root; a card that is not an anchor; a consecutive pair (including the
     wrap from last to first at every length) that fails connects().
     For an EASY verdict report odds 1 / (3 x pool size at the row's length).
     (Rules as of PR #233; before it EASY was length 2-3, home-anchor start.)
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

Section 11 used a second probe (scratchpad `amy_eval2.js`, not committed):
the same resolution and sampling, with axis A checked against
`sequences(deck, 2|3|4)` and the current failing rules, and MEDIUM / HARD
pools counted only where a row landed there (none did).

## 11. Rerun after PR #233 (main 71ba20d, 2026-10-04)

Superseded by section 12 (five decks, main d744071); the EASY rules and odds below describe the engine at 71ba20d only.

Section 8's prompt rerun against the merged EASY tier: lengths 2, 3 or 4
drawn evenly; any anchor may start; every length wraps to its first chord.
EASY pools (len 2 / 3 / 4): Hijaz 28 / 96 / 264, Pygmy 42 / 210 / 840,
Amara 20 / 60 / 120. Odds = 1 / (3 x pool at the row's length).

| id | Amy | Pygmy | Amara | Hijaz |
|---|---|---|---|---|
| A1 | i VI III VII | Fm Db Ab Eb: EASY, 1 in 2,520 | Dm Bb F C: GAP (no Bb) | GAP (no A, no E) |
| A2 | i v VI VII | Fm Cm Db Eb: EASY, 1 in 2,520 | Dm Am Bb C: GAP (no Bb) | GAP (no A) |
| A3 | i III VII iv | Fm Ab Eb Bbm: EASY, 1 in 2,520 | Dm F C ~Gsus4: EASY, 1 in 360 | GAP (no E) |
| A4 | i VII VI v | Fm Eb Db Cm: EASY, 1 in 2,520 | Dm C Bb Am: GAP (no Bb) | GAP (no A) |
| A5 | i VII v VI | Fm Eb Cm Db: EASY, 1 in 2,520 | Dm C Am Bb: GAP (no Bb) | GAP (no A) |
| A6 | I IV V | Ab Db Eb: EASY, 1 in 630 | F Bb C: GAP (no Bb) | C# ~F#sus4 ~G#°: EASY, 1 in 288 |
| A7 | I V vi IV | Ab Eb Fm Db: EASY, 1 in 2,520 | F C Dm Bb: GAP (no Bb) | GAP (no Bbm) |
| A8 | I vi IV V | Ab Fm Db Eb: EASY, 1 in 2,520 | F Dm Bb C: GAP (no Bb) | GAP (no Bbm) |
| A9 | IV iii ii I | Db Cm Bbm Ab: EASY, 1 in 2,520 | Bb Am ~Gsus4 F: GAP (no Bb) | GAP (no Ebm) |
| A10 | ii V I | Bbm Eb Ab: EASY, 1 in 630 | ~Gsus4 C F: EASY, 1 in 180 | GAP (no Ebm) |

Before and after:

| deck | section 5 (pre-lane) | section 11 |
|---|---|---|
| Pygmy | 0 EASY, 5 MEDIUM, 3 HARD, 2 NONE | 10 EASY, all exact |
| Amara | 0 EASY, 1 MEDIUM, 1 NONE, 8 GAP | 2 EASY (A3, A10, Gsus4 for Gm), 8 GAP |
| Hijaz | 1 EASY (A6), 9 GAP | 1 EASY (A6), 9 GAP |

Coverage is unchanged from section 5 (it depends on the pans, not the tier):
Pygmy 10 exact; Amara 0 exact, 2 with a substitute, 8 missing Bb; Hijaz 0
exact, 1 with substitutes, 9 missing (A, E, Bbm, Ebm).

Axis D is unchanged from section 6 on the reference side (13 step, 6 third,
9 fourth/fifth, 0 tritone of 28). Anchor pairs admitted by `connects()`,
by class: Pygmy step 14, third 14, fourth/fifth 12, tritone 2, none refused;
Amara step 6, third 6, fourth/fifth 8, none refused; Hijaz step 8, third 10,
fourth/fifth 6, tritone 4, two thirds refused (D° <-> F#sus4).

Sampling check, 3,000 `pick()` calls per tier per deck with `mulberry32(7)`,
no refusals, EASY lengths 955 / 1,022 / 1,023:
Pygmy EASY 840 distinct sequences, Amy hits A1 x3, A2, A3, A4, A6 x5, A10 x4;
Amara EASY 200 distinct (the whole pool), hits A3 x9, A10 x18; Hijaz EASY 382
distinct, hits A6 x9. MEDIUM and HARD: 0 hits on every deck, consistent with
no row classifying there.

What this says about the deferred MEDIUM question: no row lands in MEDIUM or
HARD on any deck. Every row that resolves is EASY, and every miss is a pitch
class the pan lacks (Bb on Amara; A, E, Bbm, Ebm on Hijaz), which no tier
rule can reach. This reference list gives no measured target for "MEDIUM
takes Amy's chords".

## 12. Rerun on five decks (main d744071, 2026-10-07)

Section 8's prompt rerun by measurement against all five built-in decks, in
the app's deck order: D Kurd 10 (`kurd`, 49 cards), D AMARA 10 (`amara10`, 29),
D Amara 9 (`amara`, 27), C# Hijaz (`hijaz`, 19), F3 Low Pygmy 18 (`pygmy`, 53).
Findings only; nothing here proposes an engine or deck change. The code names
the tiers `basic` / `intermediate` / `advanced`; the buttons and this doc say
EASY / MEDIUM / HARD.

### 12.1 Result per deck

Each cell is the resolved card sequence (`~` marks the engine's anchor standing
in for a card of the wanted quality), the tier that can emit it, and the odds
that one `pick()` of that tier deals exactly that sequence (prev = null).
GAP names the roots no card on the deck has.

| id | Amy | Kurd 10 | Amara 10 | Amara 9 | Hijaz | Pygmy |
|---|---|---|---|---|---|---|
| A1 | i VI III VII | Dm Bb F C: EASY, 1 in 375 | GAP (no Bb) | GAP (no Bb) | GAP (no A, no E) | Fm Db Ab Eb: EASY, 1 in 375 |
| A2 | i v VI VII | Dm Am Bb C: EASY, 1 in 375 | GAP (no Bb) | GAP (no Bb) | GAP (no A) | Fm Cm Db Eb: EASY, 1 in 375 |
| A3 | i III VII iv | Dm F C Gm: EASY, 1 in 375 | Dm F C ~Gsus4: MEDIUM, 1 in 337 | Dm F C ~Gsus4: MEDIUM, 1 in 337 | GAP (no E) | Fm Ab Eb Bbm: EASY, 1 in 375 |
| A4 | i VII VI v | Dm C Bb Am: EASY, 1 in 375 | GAP (no Bb) | GAP (no Bb) | GAP (no A) | Fm Eb Db Cm: EASY, 1 in 375 |
| A5 | i VII v VI | Dm C Am Bb: EASY, 1 in 375 | GAP (no Bb) | GAP (no Bb) | GAP (no A) | Fm Eb Cm Db: EASY, 1 in 375 |
| A6 | I IV V | F Bb C: EASY, 1 in 250 | GAP (no Bb) | GAP (no Bb) | C# ~F#sus4 ~G#°: EASY, 1 in 45 | Ab Db Eb: EASY, 1 in 250 |
| A7 | I V vi IV | F C Dm Bb: EASY, 1 in 1,500 | GAP (no Bb) | GAP (no Bb) | GAP (no Bbm) | Ab Eb Fm Db: EASY, 1 in 1,500 |
| A8 | I vi IV V | F Dm Bb C: EASY, 1 in 1,500 | GAP (no Bb) | GAP (no Bb) | GAP (no Bbm) | Ab Fm Db Eb: EASY, 1 in 1,500 |
| A9 | IV iii ii I | Bb Am Gm F: MEDIUM, 1 in 6,750 | GAP (no Bb) | GAP (no Bb) | GAP (no Ebm) | Db Cm Bbm Ab: MEDIUM, 1 in 6,750 |
| A10 | ii V I | Gm C F: MEDIUM, 1 in 1,083 | ~Gsus4 C F: MEDIUM, 1 in 350 | ~Gsus4 C F: MEDIUM, 1 in 350 | GAP (no Ebm) | Bbm Eb Ab: MEDIUM, 1 in 1,083 |

Hijaz is read as in section 3: minor rows from C# with the pan's major third
(no C#m card, so C# stands in), major rows from C# as I. Its A1-A5 resolve
with substitutes (C#, Bm, G#°, F#sus4) wherever a root exists, and the named
gap is the root with no card at all.

Headline counts, out of ten:

| deck | exact | near (substitute) | GAP | EASY | MEDIUM | HARD |
|---|---|---|---|---|---|---|
| Kurd 10 | 10 | 0 | 0 | 8 (A1-A8) | 2 (A9, A10) | 0 |
| Amara 10 | 0 | 2 (A3, A10) | 8 (Bb) | 0 | 2 | 0 |
| Amara 9 | 0 | 2 (A3, A10) | 8 (Bb) | 0 | 2 | 0 |
| Hijaz | 0 | 1 (A6) | 9 (A, E, Bbm, Ebm) | 1 (A6) | 0 | 0 |
| Pygmy | 10 | 0 | 0 | 8 (A1-A8) | 2 (A9, A10) | 0 |

Coverage, by axis E: Kurd 10 and Pygmy 10 exact; Amara 9 and Amara 10 0 exact,
2 with a substitute (Gsus4 for Gm), 8 missing Bb; Hijaz 0 exact, 1 with
substitutes, 9 missing (A, E, Bbm, Ebm). No row on any deck can be dealt by
HARD: every row is made of anchors only, and HARD needs an extended card or
two non-anchor cards. Where a row lands in a tier, no other tier's cells
contain it (checked against the BASIC cells and the MEDIUM cells).

### 12.2 Why the MEDIUM rows are not EASY

Axis A, the rules a resolved row fails for EASY (length 2-4, first chord on
the home anchor or the relative-major triad, every chord a home or triad
anchor, no repeated root, every pair and the wrap passing `connects()`). The
wrap and every pair pass on all twenty-five resolved rows; the only failures are:

- Kurd 10 and Pygmy A9 and A10: the first chord (Bb or Gm on Kurd, Db or Bbm
  on Pygmy) is neither home nor the relative start (F or Ab).
- Amara 9 and Amara 10 A3: Gsus4 is not in EASY's vocabulary (Dm, F, Am, C).
- Amara 9 and Amara 10 A10: both of the above.

EASY's vocabulary is the home anchor plus the triad anchors (Kurd Dm F Gm Am Bb
C; Pygmy Fm Ab Bbm Cm Db Eb; Amara Dm F Am C). Hijaz has only two triad
anchors (C#, Bm), whose loops fall under the 12-loop floor, so its vocabulary
is all six anchors. EASY pools
(length 2 / 3 / 4, 40 / 40 / 20 length weights, 80 / 20 home / relative start
weights, uniform inside the cell): Kurd 10 / 40 / 120, Pygmy 10 / 40 / 120,
Amara 6 / 12 / 12, Hijaz 5 / 18 / 48. A row's odds are P(length) x P(side) /
cell size, so a length-4 home row on Kurd is 0.2 x 0.8 / 60 = 1 in 375; the
section 8 formula 1 / (3 x pool) no longer describes the draw.

MEDIUM odds come from the same exact calculation over its cells (length 3 / 4
at 60 / 40, kind pure / colour at one third / two thirds, then colour family,
then start side home / other at 40 / 60). All four MEDIUM row shapes here sit
in a "pure" (all anchors) cell: Kurd and Pygmy A9 in the length-4 other-start
cell of 540, A10 in the length-3 other-start cell of 130; Amara A3 in the
length-4 home cell of 18, A10 in the length-3 other-start cell of 42.

### 12.3 Root motion (axis D)

Reference side unchanged from section 6: 13 step, 6 third, 9 fourth/fifth, 0
tritone of 28. Anchor pairs `connects()` admits, ordered, by class (nothing
refused unless stated): Kurd 10 step 14, third 14, fourth/fifth 12, tritone 2;
Pygmy the same; Amara 9 and Amara 10 step 6, third 6, fourth/fifth 8; Hijaz
step 8, third 10, fourth/fifth 6, tritone 4, two thirds refused (D deg <->
F#sus4). The Hijaz, Pygmy and Amara 9 figures equal section 11's; Kurd 10 has
Pygmy's seven-root shape (D E F G A Bb C against F G Ab Bb C Db Eb).

### 12.4 Sampling check

3,000 `pick()` calls per tier per deck, `mulberry32(7)`, a fresh generator per
deck and tier, `prev = null` on every call (so no deal excludes the last).
No refusals anywhere.

| deck | EASY distinct (pool), lengths 2 / 3 / 4 | EASY hits | MEDIUM distinct (pool) | MEDIUM hits | HARD distinct | HARD hits |
|---|---|---|---|---|---|---|
| Kurd 10 | 159 (170), 1,197 / 1,234 / 569 | A1 11, A2 10, A3 8, A4 10, A5 9, A6 10, A7 4, A8 2 | 1,878 (12,342) | A10 5 | 3,000 | none |
| Amara 10 | 30 (30), same lengths | none | 1,082 (2,264) | A3 4, A10 10 | 2,998 | none |
| Amara 9 | 30 (30), same lengths | none | 1,082 (2,264) | A3 4, A10 10 | 2,998 | none |
| Hijaz | 71 (71), same lengths | A6 65 | 839 (1,394) | none | 2,993 | none |
| Pygmy | 159 (170), same lengths | same as Kurd | 1,701 (10,942) | A10 5 | 3,000 | none |

The EASY length counts are the same on every deck (the same stream of
draws reaches the same cells), which is also why Kurd and Pygmy hit the same
rows the same number of times. Hits sit near the exact odds: Hijaz A6 expects
66.7 and got 65; Kurd A10 expects 2.8 and got 5; Amara A3 and A10 expect 8.9
and 8.6 and got 4 and 10. HARD lengths 4 / 5 / 6 split roughly evenly on every
deck, with no row ever dealt, as the gate predicts.

### 12.5 Changes since section 11

Section 11 (main 71ba20d): Pygmy 10 EASY; Amara 2 EASY (A3, A10 with Gsus4)
and 8 GAP; Hijaz 1 EASY (A6) and 9 GAP.

- Pygmy: 8 EASY and 2 MEDIUM (A9, A10), all ten still exact. A9 and A10
  moved down a tier. Their odds in their new tier are 1 in 6,750 and 1 in
  1,083; the other eight rows' odds went from 1 in 2,520 / 1 in 630 to 1 in
  375 / 1 in 250 / 1 in 1,500 (depends on length and start side).
- Amara 9: the same two rows resolve (A3, A10, Gsus4 for Gm) and the same
  eight are GAP on Bb, but both moved from EASY to MEDIUM (1 in 337 and 1 in
  350, against 1 in 360 and 1 in 180 at EASY).
- Hijaz: the same single row (A6), still EASY, now 1 in 45 (was 1 in 288);
  the same nine gaps.
- Cause: the tier rebalance, not the decks. EASY no longer starts on any
  anchor: it starts on home or the relative-major triad and draws only from
  home plus triad anchors, with 40 / 40 / 20 length and 80 / 20 side weights.
  Section 11's EASY pools were 28 / 96 / 264, 42 / 210 / 840, 20 / 60 / 120
  and are now smaller (above). Evidence: the current engine run on the
  71ba20d decks (19, 52 and 25 cards) gives the same tier for every row, the
  same odds, and the same EASY and MEDIUM hits as on today's decks.
- The two Amara 9 cards (Fadd9, Cadd9) and the Pygmy changes (Fmadd9 added,
  Fm9 revoiced) moved no row. They are not anchors and are not in any row;
  every row's cell, cell size and odds are identical on the old and new data.
  They changed what else MEDIUM can deal: Amara 9 distinct MEDIUM deals in
  3,000 went from 972 to 1,082, Pygmy's from 1,828 to 1,701 (Fmadd9 opens a
  third colour family that takes a share from the other two).
- Method check: the 71ba20d engine and decks, run with these same steps,
  reproduce section 11's sampling exactly (EASY lengths 955 / 1,022 / 1,023;
  distinct 840 / 200 / 382; Pygmy hits A1 x3, A2, A3, A4, A6 x5, A10 x4;
  Amara A3 x9, A10 x18; Hijaz A6 x9), with `prev = null`.

### 12.6 What the added notes unlock

- Kurd 10 (Bb3 on the pan): Bb is the root every Amara 9 GAP lacked. All eight
  rows that needed it (A1, A2, A4, A5, A6, A7, A8, A9) now resolve exactly. A3
  and A10 stay playable but exact: Gm replaces the Gsus4 stand-in, which also
  moves A3 from MEDIUM to EASY. Net against Amara 9: 0 to 8 EASY, 2 to 2
  MEDIUM, 8 GAP to 0.
- Amara 10 (D5 added at the top): unlocks nothing. Its anchors, EASY cells and
  MEDIUM cells equal Amara 9's, every row has the same card sequence, tier and
  odds, and the 3,000-deal results for EASY and MEDIUM are identical. Its two
  extra cards (Cadd9 and C6/9, HIGH VOICING) are register voicings, which
  MEDIUM excludes and which do not touch any row. The pan's gap is still Bb.
- Gaps by pitch class: Amara 9 and 10 lack Bb (A1, A2, A4-A9); Hijaz lacks A
  (A1, A2, A4, A5), E (A1, A3), Bbm (A7, A8) and Ebm (A9, A10).

### 12.7 What this says

The decks now split cleanly into pans that hold the pitch classes (Kurd 10 and
Pygmy: all ten exact) and pans that do not (Amara 9 and 10, Hijaz). Among
pans that do, EASY reaches the eight progressions that start on home or the
relative major, and MEDIUM the two that start elsewhere. MEDIUM is not
uniformly rarer: the EASY rows sit at 1 in 250 (A6), 1 in 375 (A1 to A5) and
1 in 1,500 (A7, A8), and the MEDIUM rows at 1 in 1,083 (A10) and 1 in 6,750
(A9). So A10 at MEDIUM is dealt more often than A7 and A8 at EASY, and A9 is
4.5 to 27 times rarer than any EASY row. The extra note on Amara 10 changes none of this.

### 12.8 Reproduction

Scratchpad probes, not committed, loading the engine through
`tools/engine_loader.js`: `loadEngine(["core", "sequence"])`, with
`data/decks.json` read directly.

1. For each deck, `HPE.sequence.anchors(deck)` and `_internal.homePc /
   homeAnchor`. Tonic: home for minor rows; for major rows home + 3 when the
   home anchor's shape is the minor triad, else home. Resolve each numeral to
   a card whose root pitch class matches and whose pitch classes are exactly
   the wanted triad (LOW and HIGH VOICING excluded: exact); else the anchor on
   that root (near, `~`); else GAP with the pitch class.
2. `HPE.sequence.tierOf(deck, cards)` for the tier, plus the wrap check:
   `_internal.buildConnectMatrix(deck)[a][b]` for every consecutive pair
   including last to first, and no identical consecutive cards.
3. Odds: `_internal.basicCells(deck)` and `_internal.mediumCells(deck, {})`
   (full enumeration; the `stats` argument reported `truncated: false` on all
   five decks, 4,518 to 28,438 nodes). For the cell holding the row, multiply
   the renormalised weight at each level (BASIC: length, side; MEDIUM: length,
   kind, family, side, with the weights in `src/engine/sequence.js`) and divide
   by the cell's sequence count.
4. Sampling: `HPE.sequence.pick(deck, mulberry32(7), null, tier)` 3,000 times
   per tier per deck, one generator per deck and tier, and count exact matches.
5. Axis D: over `anchors(deck)`, ordered pairs by `connects` (via the matrix)
   grouped by shortest root distance (1-2 step, 3-4 third, 5 fourth/fifth, 6
   tritone).
6. To compare against section 11: `git archive 71ba20d src/engine
   tools/engine_loader.js data/decks.json` into a scratch directory and run the
   same probe against it (and against the current engine with that directory's
   `decks.json`).

Deviations from sections 8 and 10, as facts:

- `sequences(deck, 2|3|4)` still exists and was used for the EASY pools; the
  odds formula 1 / (3 x pool) no longer matches the draw (40 / 40 / 20 lengths,
  80 / 20 start sides), so odds were computed from the cells instead.
- Step C counted pools with `dfsFindAll` and a node budget. MEDIUM is now
  dealt from enumerated cells, so the cells replace that count; `dfsFindAll`
  was not used. No row classifies HARD, so HARD pools were not counted.
- Rows were resolved to a card with exactly the triad's three pitch classes
  instead of "same triad quality", and the Hijaz gap names are given in flats
  (Bbm, Ebm) to match section 11.
- Sampling was `prev = null` throughout. A chained run (each call fed the last
  deal as `prev`) was not made.
