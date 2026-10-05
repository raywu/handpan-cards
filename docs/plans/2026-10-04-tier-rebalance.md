# Plan: rebalance the sequence difficulty tiers (BASIC / MEDIUM / HARD)

Date: 2026-10-04. Base: `origin/main` at `6b40b85` (PR #235 on PR #233).
Branch `claude/tier-rebalance`, worktree `scratchpad/lanewt`. Prompt:
`scratchpad/tier-rebalance-plan-prompt.md` (the owner's binding decisions 1-7
are restated in section 1). Every number below was measured by
`scratchpad/rebalance_probe2.js` running the engine of a detached worktree at
`6b40b85` (`tools/engine_loader.js`, `loadEngine(["core","sequence"])`,
`data/decks.json`), 3,000 `pick()`-equivalent deals per tier per built-in
deck with `mulberry32(7)` and no `prev`, 300 per row of the generated sweep (TR-15).
Reproduction: section 12.

## 0. Goal and non-goals

**Goal.** Give each tier a target output shape (a distribution over
measurable axes), change `src/engine/sequence.js` until every deck deals
that shape within tolerance, and make the three tiers monotonic on every
axis per deck. BASIC becomes "truly basic" again (home start, short, major
and minor triads only); Amy Naylor's tonic-start rows A1-A8 stay BASIC and
her off-tonic rows A9-A10 move to MEDIUM; HARD stops being a catch-all: it
needs an extended card or two non-anchor cards (R-7 as amended).

**Non-goals.** No named presets. No physical-reach axis (owner decision
N30). No UI change: no markup, CSS or app JS outside the generated engine
region. No new tier. No change to `data/decks.json` or diagram geometry. No
engine cache (R-10). No change to `anchors()`, `connects()`, the connect
rule, `NO_HOME_CHORD` priority (D-6) or `TOO_FEW_CHORDS`.

## 1. Owner decisions carried in (binding, 2026-10-04 interviews)

1. BASIC: lengths 2/3/4 at 40/40/20; home start >= 80%; vocabulary = major
   and minor triad anchors only (G° leaves Pygmy's BASIC).
2. Secondary BASIC start: on a minor-home deck the major anchor on home+3
   (Ab on Pygmy, F on Amara) starts at the remaining weight. Hijaz (major
   home) has none.
3. Amy rows A1-A8 are BASIC-eligible, A9 and A10 are MEDIUM (measured on
   Pygmy, the only deck where all ten resolve exactly).
4. MEDIUM: lengths 3/4 favouring 3; start = a non-diminished anchor or a
   home-rooted card (R-4 below records the "non-diminished" reading); a
   diminished anchor mid-deal only; about one third pure-triad deals, two
   thirds exactly one colour chord; 7th and sus/power families at equal
   share; home start between BASIC's and HARD's.
5. HARD "extended, register bounded": every deal has at least one card
   MEDIUM cannot use (5+ fields or a register voicing); register voicings
   capped near a third of chords; home start free; lengths 4/5/6 even;
   HARD is no longer a catch-all (R-7).
6. Determinism = shape within tolerance, asserted over the three built-in
   decks and the generated sweep; seeded random; the D-1 pin is re-pinned.
7. Monotonic on every axis per deck.

## 2. Shape table (targets and measured values)

All figures are the share of deals unless marked "of chords". "Measured"
is the probe at N = 3,000 on each built-in deck (Pygmy / Amara / Hijaz).
Band = the assertion in `tests/sequence.test.js` (section 7, test S1).

| axis | BASIC target (band) | measured | MEDIUM target (band) | measured | HARD target (band) | measured |
|---|---|---|---|---|---|---|
| length distribution | 2/3/4 = 40/40/20 (each +-3 pp) | 40.9/39.7/19.4 on all three | 3/4 = 60/40 (+-3 pp) | 61.6/38.4, 61.6/38.4, 61.3/38.7 | 4/5/6 = 33/33/33 (+-3 pp) | 33.3/33.2/33.4, 33.8/33.7/32.5, 33.1/33.8/33.1 |
| mean length | 2.8 | 2.79 x3 | 3.4 | 3.38, 3.38, 3.39 | 5.0 | 5.00, 4.99, 5.00 |
| home-anchor start | 80% (+-3 pp); 100% when no secondary start | 81.6 / 81.6 / 100.0 | 40% (+-4 pp) on a deck with home-rooted colour cards | 40.5 / 40.5 / 26.7 (Hijaz: R-4 note) | free, no band; monotonicity rule only | 16.0 / 32.8 / 34.3 |
| non-anchor chords (of chords) | 0% exactly | 0.0 x3 | 20% (+-4 pp) | 19.6 / 19.6 / 19.5 | >= 60% | 80.2 / 79.2 / 70.4 |
| pure-triad deals | 100% exactly | 100 x3 | 33% (+-4 pp) | 33.8 / 33.8 / 34.0 | 0% exactly | 0.0 x3 |
| colour family split (of colour deals) | n/a | - | equal among non-empty families (+-4 pp each) | Pygmy 48.6 seventh / 51.4 susPower (no "other"); Amara 33.6/32.5/33.9; Hijaz 33.4/34.3/32.4 | not weighted; recorded only | - |
| register voicings (of chords) | 0% exactly | 0 x3 | 0% exactly | 0 x3 | <= 33.4% (`registerCount*3 <= len` per deal) | 20.3 / 0.0 / 0.0 (today 40.3 on Pygmy) |
| extended-card deals | 0% | 0 | 0% | 0 | recorded, no share band; per deal the exact predicate is "(>= 1 extended) OR (>= 2 non-anchor)" | 84.3 / 69.0 / 47.0 (today 94 / 71 / 49) |
| diminished-anchor chords (of chords) | 0% exactly, except under the R-3 fallback | 0 / 0 / 39.0 (Hijaz fallback) | free, recorded | 11.6 / 0 / 32.8 | free | 3.0 / 0.0 / 14.2 |
| bottom-shell deals (Pygmy only) | recorded | 80.8 | recorded | 98.4 | recorded | 99.4 |
| distinct deals in 3,000 | recorded | 164 / 30 / 71 | recorded | 1849 / 957 / 855 | recorded | 3000 / 2999 / 2992 |

**N and standard error.** At N = 3,000 the binomial SE of a share p is
sqrt(p(1-p)/N): 0.9 pp at p = 0.4, 0.7 pp at p = 0.2, 0.3 pp at p = 0.03.
A +-3 pp band is therefore > 3 SE from target at every tested share, and a
+-4 pp band > 4 SE: a false red is below 1 in 300 per cell, and the suite's
seed is fixed, so a red is reproducible and never a flake. Seed policy:
`mulberry32(7)` for shape, `mulberry32(11)` for the sample deals, a fresh
rng per (deck, tier) so the tiers do not share a stream.

**Budget against the 180 s suite limit.** The shape test drives the
internal cell sampler on cells computed ONCE per deck (R-10), so 3,000
draws cost under 20 ms of enumeration plus 3,000 x O(1) draws per
(deck, tier): under 1 s for the three built-ins. The public `pick()` path is
asserted on the same decks at N = 300 per tier (section 7, S2). Nothing
enumerates per deal inside a 3,000-deal loop.

**Tiny pools.** A band only applies where the pool can satisfy it. The
sweep rows with 11 chords have BASIC pools of 8 loops (section 4), so the
length axis is asserted only when the pool has at least 5 loops at EVERY
length the tier deals (the sweep's smallest BASIC pools at 12-chord decks
are 4 loops: `reviewer G3`/`G#3`, length 4 share there is 0 and the band is
not applied). The home-start band is asserted on every deck with a home
anchor. The MEDIUM family band applies only to families with a non-empty
cell on that deck (Pygmy has no "other" cards; the probe's split is 48.6 /
51.4 over two families, inside +-4 of 50/50). The register bound and the
"(>= 1 extended) OR (>= 2 non-anchor)" predicate are exact per deal and
apply everywhere HARD deals.

HARD columns re-measured 2026-10-04 under the owner decision "Broaden HARD
everywhere" (R-7), probe `scratchpad/rebalance_probe4.js` with
`HARD_RULE=broad`, N = 3,000, seed 7. Sampler: 0 fall-throughs of 512 draws
on every built-in and custom deck. Custom decks (`parseSeed` +
`select.build`), HARD: D Kurd 9 dealt 3000/3000, 0 extended cards, extended
deals 0.0%, non-anchor 70.1%; C Major 9 dealt 3000/3000, 0 extended,
non-anchor 69.5%; D Integral 8 dealt 3000/3000, extended deals 62.0%,
non-anchor 77.3%. Sweep (300 draws/tier): HARD nulls 0 on every row;
reviewer (G3)/(A3)/(G#3) now deal HARD (home 55.7/39.0/35.0, extended 0.0).
Monotonicity flags identical to probe3 (h! on top-heavy and reviewer rows,
as before).

## 3. Rules (R-1 .. R-10) and numbered decisions

Each rule names the engine change in `src/engine/sequence.js`, the
alternative rejected, and the test and mutant that pin it. "Triad anchor" =
an anchor whose `chordShape(...).tier === 0` (maj/min); "dim anchor" =
tier 2; "sus/power anchor" = tier 1 or 3.

**R-1 BASIC vocabulary and start set (owner 1, 2).** BASIC deals from the
subset of `basicPools()` loops whose every chord is a triad anchor and whose
first chord is the home anchor or the relative-major anchor (the triad
anchor rooted at home+3 semitones, present only when the home anchor is
minor: `chordShape(home).tier === 0` and interval set `0,3,7`). A home
anchor that is not itself a triad (a sus4 or dim home, as on the `REGISTER_*`
sweep rows) is BASIC vocabulary regardless (decision TR-1). Register
(LOW/HIGH) anchors stay admitted (D-14).
- Rejected: all anchors with a home-start filter only (today's R6 minus the
  start): leaves G° in a quarter of Pygmy BASIC deals, the complaint that
  started this.
- Pinned by: S1 (non-anchor 0%, dim 0% on Pygmy/Amara), the pool-size table
  (section 4), Amy test A1-A8; mutants `sqr_01` (vocab admits every anchor),
  `sqr_02` (relative-major start dropped: A6-A8 leave BASIC on Pygmy).

**R-2 BASIC sampling (owner 1).** `pickBasic` draws the length with weights
2:0.4, 3:0.4, 4:0.2 over the lengths whose filtered pool is non-empty
(weights renormalised), then the start side with weight home:0.8,
relative:0.2 over the sides non-empty at that length, then uniformly within
the (length, side) cell. `prev` is removed from its cell before the draws
(E4 kept); if that empties every cell the exclusion is skipped (today's
guard). Three rng draws plus the style draw.
- Rejected: uniform over the union with a home-start quota: the owner asked
  for the length ordering and a >= 80% home start, and a quota needs the
  same cells anyway.
- Pinned by: S1 (length and home bands), D-1 re-pin (section 7, S5);
  mutants `sqr_03` (length weights uniform: 4-chord share 33% not 20%),
  `sqr_04` (home weight dropped: home start 50% on Pygmy).

**R-3 BASIC tiny-pool fallback (decision TR-2).** If the R-1 pool has fewer
than `MIN_BASIC_POOL = 12` loops over lengths 2-4, BASIC vocabulary widens
to EVERY anchor (start set and R-2 weights unchanged). Hijaz has one triad
anchor besides C# (Bm): its R-1 pool is a single loop `C# Bm` and 3,000
draws dealt it once. With the fallback Hijaz's pool is 5/18/48, 71 distinct
deals, 39.0% diminished chords. The sweep's `reviewer (B3)` row (3 triad
anchors, pool 3) also falls back; no other sweep row does.
- Rejected: refuse (`TOO_FEW_CHORDS`) on a one-loop pool: Hijaz is a
  shipped deck and BASIC must deal on it. Rejected: widen to sus and dim
  anchors only when the pool is EMPTY: a pool of one or three loops is not a
  practice tier.
- Pinned by: Hijaz pool sizes in section 4, S1 on Hijaz (dim share > 0 is
  recorded, not banded); mutant `sqr_05` (threshold 0: Hijaz deals one
  sequence; killed by the Hijaz distinct-deal count).

**R-4 MEDIUM gate and start set (owner 4; decision TR-3).** A sequence is
MEDIUM iff: length 3 or 4; the first chord is a NON-DIMINISHED anchor
(`chordShape` tier 0, 1 or 3) or any pool card rooted on home; repeated roots
only as resolved sus pairs (today's rule); every chord is an anchor or a
"colour card" (non-anchor, <= 4 fields, no register voicing; today's
`intermediateGate` card rule); and the deal contains AT MOST ONE colour
card. A diminished anchor may appear at positions 2-4.
- TR-3 default "non-diminished anchor", not the interview's "major/minor
  anchor": the owner's stated concern was diminished-first deals, and a
  triad-only start would make Amara A10 `Gsus4 C F` NONE (Gsus4 is Amara's
  only G anchor). Under the default A10 is MEDIUM at 1 in 350. Alternative:
  triad-only start; A10 becomes NONE on Amara and Hijaz loses F#sus4 starts
  (38.1% of its MEDIUM deals).
- Note Hijaz home start measured 26.7%, under the 40% band: with only two
  non-dim anchors (C#, Bm) and the weights of R-5, the renormalised cells
  put 73% of starts on F#sus4 and Bm. The band is asserted at 40% +-4 only
  on decks whose non-home start set is at least as large as the home-rooted
  set (Pygmy 6 vs 4, Amara 4 vs 5 after excluding Dm itself; Hijaz 2 vs 5).
  Hijaz's 26.7% still satisfies the monotonicity rule (B 100 > M 26.7 <
  H 34.3 is the h! case of M-5: M > H is asserted on built-ins ONLY where
  it holds today, see M-5 and decision TR-6).
- Pinned by: S1 (non-anchor 20%, pure 33%), tierOf goldens, Amy A9/A10;
  mutants `sqr_06` (dim start allowed), `sqr_07` (colour cap dropped: two
  colour chords pass, non-anchor share rises to ~35%), `sqd_15`/`sqd_16`
  re-anchored on the new start-set code.

**R-5 MEDIUM sampling (owner 4).** Every MEDIUM-classified sequence of
lengths 3-4 is enumerated once per `pick()` (R-10) and bucketed into cells
(length, kind, family, side): length 3 or 4; kind = pure (no colour card)
or colour; family = the colour card's family (R-6), "none" for pure; side =
home (first chord rooted on home) or other. Cell weights: length 3:0.6,
4:0.4; kind pure:1/3, colour:2/3; family equal among non-empty families;
side home:0.4, other:0.6; weights renormalised over the non-empty cells at
each level, then uniform within the cell. `prev` removed from its cell
first (E4). Four rng draws plus style. The cells hold only sequences that
CLASSIFY MEDIUM under the R-8 order: a pure, home-start, all-triad-anchor
loop is BASIC and sits in no MEDIUM cell (the probe applies
`classify(seq) === "intermediate"` at the leaf and the engine does the
same; that is why Pygmy's `3/pure/home` cell holds 10 sequences and not
every home-rooted triad loop). (Eng review R4.)
- Rejected: uniform over the MEDIUM pool (today): Pygmy would deal 64%
  colour chords, mostly sus (23 sus/power cards vs 7 sevenths). Rejected:
  weighting by card count: the owner excluded it ("not by card count").
- Measured: Pygmy pure 33.8%, seventh 48.6% / susPower 51.4% of colour
  deals, home 40.5%; Amara pure 33.8%, 33.6/32.5/33.9, home 40.5%.
- Pinned by: S1 bands; mutants `sqr_08` (pure weight 0), `sqr_09` (family
  weight by card count), `sqr_10` (length weights uniform), `sqr_11` (home
  side weight dropped).

**R-6 Colour family detection (decision TR-4).** By chord name
(`chordName`, main + sup): `/sus/` or `/^[A-G][#b]?5$/` -> susPower;
else `/7/` -> seventh; else -> other (add9, 6, 6/9, a non-anchor dim
triad such as Hijaz's B°). `7sus4` is susPower (the sus test runs first,
matching `chordIsSus` and the resolve rule). "other" is a THIRD family at
equal share, not folded in: folding add9 into sevenths would give Amara's
Dmadd9 a seventh's weight for no musical reason. A family with no card in
the pool has no cells and its share falls to the others (Pygmy: two
families at 50/50). A deck with no colour cards deals pure-triad MEDIUM
only (the sweep's 11-chord rows: non-anchor 23.6% because the single
colour card there is one of eleven; `reviewer G3` deals 21.2%).
- Rejected: detect by interval set like `chordShape`: a 7th family by
  intervals needs five shapes (7, maj7, m7, m7b5, dim7) and still misses
  6/9; the card NAME is what the player reads.
- Pinned by: a unit test on `_internal.colourFamily` over every colour card
  of the three decks (expected table in S4); mutant `sqr_12` (sus tested
  after 7: `C#7sus4` becomes seventh).

**R-7 HARD gate (owner 5; owner decision 2026-10-04 "Broaden HARD
everywhere"; decision TR-5).** A sequence is HARD iff: length 4-6; not
MEDIUM and not BASIC (classification order unchanged); AND (at least one
chord is EXTENDED, meaning a NON-ANCHOR card that has > 4 fields OR carries a
register voicing (`!isAnchor && (fields > 4 || register)`), OR at least TWO
chords are non-anchor cards (`!isAnchor`, counted per position)); AND
`registerCount * 3 <= length` over EVERY chord, anchors included (0 of 4, 1
of 4-5, 2 of 6). A register-labelled ANCHOR is neither extended nor
non-anchor; it is MEDIUM vocabulary under D-14 and is counted only by the
register bound. (Eng review R2, codex P1.) Otherwise `classifyTier` returns
null. HARD keeps today's 512-draw sampler with the new accept (0 fallbacks to
DFS in 9,000 built-in deals); start set is the pool; lengths drawn evenly
among those not proven empty (D-3 unchanged). The rule is the same on every
deck, built-in or generated.
- TR-5 (restated): a 4-6 chord sequence that fails MEDIUM, has no extended
  card and has at most ONE non-anchor card is dealt by no tier and `tierOf`
  returns null, as D-15 already does for length 3. `sqd_09` and `sqd_14`
  (catch-all bounds) are re-anchored on the new predicate.
- TR-7 (superseded by the owner, 2026-10-04): no deck reports HARD empty
  because it lacks an extended card. A deck with no extended card deals HARD
  from the two-non-anchor branch; HARD is empty only where no 4-6 sequence
  meets the gate, which no sweep row does.
- Measured: Pygmy register 20.3% of chords (today 40.3%), extended deals
  84.3%; Amara extended deals 69.0% (5 extended cards: Dm9 Dm11 F6/9 Fmaj9
  C6/9); Hijaz extended deals 47.0% (2 cards: C#7b9 Bm6/9).
- Pinned by: S1 (per-deal predicate, register bound), S7, the S8 null test,
  tierOf goldens; mutants `sqr_13` (register bound dropped: Pygmy register
  share returns to ~40%), `sqr_14` (catch-all restored for length 4-6),
  `sqr_15` (two-non-anchor branch dropped: S7 red, reviewer rows and Kurd go
  HARD-empty), `sqr_16` (`>= 2` relaxed to `>= 1`: S8 null case red),
  `sqr_17` (extended branch dropped: a fixed one-extended-card-plus-anchors
  example stops classifying "advanced").

**R-8 Classification order.** `classifyTier` stays BASIC, then MEDIUM, then
HARD, then null; `tierOf` is the public wrapper. The tiers no longer nest
as supersets of DEALS (a length-2 BASIC deal is not MEDIUM; a pure-triad
MEDIUM deal starting off home is not BASIC), but vocabulary still nests
(owner 7): BASIC cards (triad anchors, or all anchors under R-3) are a
subset of MEDIUM's pool (all anchors + colour cards, D-14), which is a
subset of HARD's (every card). The "tiers nest" test is restated to assert
vocabulary nesting and the three classifications on the five-card fixture.

**R-9 `sequences(deck, len)` returns the R-1..R-3 BASIC pool (decision
TR-8).** It is the public "what BASIC can deal" set: `tools/regen_card_fixture.js`
enumerates it for the mode S face digests and `tests/app.test.js` reads it
for the valid-progression check. R8 of PR #233 ("a sequence's rotations are
distinct EASY sequences") is superseded: the loop set still contains every
rotation, but only the rotations starting on home or the relative major
are in the pool. The rotation test becomes "every rotation of a BASIC
sequence that starts on home or the relative start is also in the pool".
Alternative: keep `sequences()` as the all-anchor loop set and add a
`basicPool()`; rejected because two public pool functions invite the
fixture tool to enumerate the wrong one.

**R-10 No cache; enumeration once per `pick()` (decision TR-9).** The engine
is ES5-style with no caches and the plan keeps it so. MEDIUM's enumeration
is a matrix-pruned DFS over `tierPool` x `tierStartSet` at lengths 3 and 4
run once per `pick()`: measured 19 ms / 23,646 nodes on Pygmy, 20 ms /
36,000 nodes on the sweep's 59-chord N=19 rows, 4-5 ms on Hijaz/Amara.
**Those counts hold only with a BRANCH-LEVEL prune on the colour-card cap
(decision TR-14):** the probe refuses a second non-anchor card at the
prefix (`if (col && colourUsed) continue`), so no branch carrying two
colour cards is ever expanded. The existing `dfsFindAll` prunes only on
connectivity and consecutive repeats and applies everything else at the
leaf; the outside reviewer ran it with the R-4 pool and start set and
counted 221,520 nodes for Pygmy length 4 alone (65,575 on Amara), which
the 60,000 budget would truncate. So the enumeration is a new internal
`mediumEnumerate(deck, len, ctx, stats)` that is `dfsFindAll` plus one
prefix check (`colourUsed`), OR `dfsFindAll` gains an optional `prune(seq,
depth)` argument that the HARD path passes as null; either way the budget
test asserts `stats.nodes` EQUALS the section 4 node counts (Pygmy 23,646,
Amara 6,892, Hijaz 4,518) so a lost prune is a red, not a slow pass. That
is inside the 50 ms per-deal bound in Node; a phone runs this JS 3-5x
slower, so a MEDIUM tap is expected to cost 60-100 ms on Pygmy on a low-end
device, still under one frame of perceived delay and only on MEDIUM taps.
Because 23,646 > `DFS_NODE_BUDGET` (15,000), the enumeration runs with its
own budget `MEDIUM_ENUM_BUDGET = 60,000` (max observed 36,000 with the
prune; the budget test records truncation as a bug, not a fallback). The
shape tests take the cells from `_internal.mediumCells(deck)`
and drive `_internal.drawMedium(cells, rng, prev)` so 3,000 draws do not
enumerate 3,000 times. Alternative: a per-deck cache keyed on the deck
object; rejected (no caches, and the app deals on a user tap, so 20 ms is
invisible).

## 4. Pool sizes and odds (measured)

BASIC pool = sequences(deck, len) after R-1..R-3, by length 2/3/4.

| deck | BASIC today | BASIC new | starts | MEDIUM sequences (cells) | MEDIUM DFS nodes / setup | HARD extended cards |
|---|---|---|---|---|---|---|
| Pygmy | 42/210/840 | Fm 5/20/60 + Ab 5/20/60 = 170 | Fm 81.6%, Ab 18.4% | 10,442 in 12 cells (3/pure 10+130, 3/seventh 90+300, 3/susPower 252+760, 4/pure 60+540, 4/seventh 480+1800, 4/susPower 1340+4680; home+other) | 23,646 / 19 ms | 22 of 52 (21 register) |
| Amara | 20/60/120 | Dm 3/6/6 + F 3/6/6 = 30 | Dm 81.6%, F 18.4% | 2,072 in 16 cells (3/other 12+24, 3/pure 6+42, 3/seventh 24+60, 3/susPower 104+252, 4/other 24+72, 4/pure 18+90, 4/seventh 60+180, 4/susPower 288+816) | 6,892 / 5 ms | 5 of 25 (0 register) |
| Hijaz | 28/96/264 | R-3 fallback: C# 5/18/48 = 71 (R-1 alone: 1) | C# 100% | 1,394 in 14 cells (3/other 16+12, 3/pure 0+30, 3/seventh 34+44, 3/susPower 95+71, 4/other 64+48, 4/pure 0+84, 4/seventh 116+184, 4/susPower 304+292) | 4,518 / 4 ms | 2 of 19 (0 register) |

Amara and Pygmy BASIC pools are small (30 and 170 loops) by design: BASIC
is the drill tier. Pygmy's 3,000 deals hit 164 of 170 loops.

**Amy odds under the exact sampling formula.** BASIC: P = w_len x w_side x
1/cell. MEDIUM: P = w_len x w_kind x w_family x w_side x 1/cell.

| row | chords (Pygmy) | tier | odds per deal | today |
|---|---|---|---|---|
| A1 i VI III VII | Fm Db Ab Eb | BASIC | 1 in 375 (0.2 x 0.8 / 60) | BASIC |
| A2 i v VI VII | Fm Cm Db Eb | BASIC | 1 in 375 | BASIC |
| A3 i III VII iv | Fm Ab Eb Bbm | BASIC | 1 in 375 | BASIC |
| A4 i VII VI v | Fm Eb Db Cm | BASIC | 1 in 375 | BASIC |
| A5 i VII v VI | Fm Eb Cm Db | BASIC | 1 in 375 | BASIC |
| A6 I IV V | Ab Db Eb | BASIC | 1 in 250 (0.4 x 0.2 / 20) | BASIC |
| A7 I V vi IV | Ab Eb Fm Db | BASIC | 1 in 1,500 (0.2 x 0.2 / 60) | BASIC |
| A8 I vi IV V | Ab Fm Db Eb | BASIC | 1 in 1,500 | BASIC |
| A9 IV iii ii I | Db Cm Bbm Ab | MEDIUM | 1 in 6,750 (0.4 x 1/3 x 0.6 / 540) | BASIC |
| A10 ii V I | Bbm Eb Ab | MEDIUM | 1 in 1,083 (0.6 x 1/3 x 0.6 / 130) | BASIC |

Decision TR-10: the prompt asked for A9 and A10 "better than 1 in 2,000".
A10 meets it; A9 sits in the 4/pure/other cell of 540 sequences and lands
at 1 in 6,750. Default: accept the measured odds and restate the acceptance
as "A10 better than 1 in 2,000; A9 better than 1 in 10,000", because the
only lever that improves A9 (a higher length-4 pure weight) moves the
MEDIUM length and pure-triad targets the owner set in decision 4.
Alternative: raise the 4/pure share to 1/2 of length-4 deals (A9 to 1 in
4,500, pure deals to ~40%). Recorded for the owner; the plan ships the
default.

## 5. Amy coverage after the change

Pygmy: all ten rows resolve exactly; A1-A8 BASIC, A9-A10 MEDIUM (table
above). Amara and Hijaz: a `~` marks an anchor substituted on the wanted
root because no exact triad exists (Amara has Gsus4, not Gm; Hijaz has
F#sus4 and G#°); substitute rows are measured and must not be NONE, but
the "same tier as Pygmy" clause applies to exact rows only (decision TR-11,
default: exempt; they are not Amy's chords).

| row | Amara | Hijaz |
|---|---|---|
| A1, A2, A4, A5, A6, A7, A8, A9 | GAP (no Bb anchor) | GAP (no A, E, Bbm, Ebm) |
| A3 i III VII iv | `Dm F C ~Gsus4` MEDIUM, 1 in 337 (Pygmy: BASIC) | GAP |
| A6 I IV V | GAP | `C# ~F#sus4 ~G#°` BASIC under R-3, 1 in 45 |
| A10 ii V I | `~Gsus4 C F` MEDIUM, 1 in 350 (Pygmy: MEDIUM) | GAP |

No row regresses to NONE: every row that resolves on main (eval section
11: Amara A3, A10; Hijaz A6) still resolves to a tier.

Acceptance (verbatim in the reviewer brief): **on Pygmy A1-A8 classify
BASIC and A9-A10 MEDIUM; on Amara and Hijaz every row that resolves exactly
keeps the same tier as on Pygmy; no row that resolves on main regresses to
NONE; A10 better than 1 in 2,000 and A9 better than 1 in 10,000 per MEDIUM
deal on Pygmy (TR-10).**

## 6. Sample deals, Pygmy, 15 consecutive per tier (`mulberry32(11)`, prev chained)

BASIC: `Fm Db Ab` / `Fm Cm Db Eb` / `Fm Db Ab` / `Fm Eb Bbm` / `Fm Db Ab` /
`Fm Bbm` / `Fm Db` / `Fm Cm Eb` / `Fm Eb Ab Bbm` / `Fm Db` / `Fm Cm` /
`Ab Fm` / `Fm Cm` / `Fm Ab Db Eb` / `Ab Bbm Eb Db`.

MEDIUM: `Eb G° Bbsus4` / `Db G° Eb` / `Db Ab5 Cm` / `Fm G° Eb Ab` /
`F5 G° Ab` / `Db Eb Ab5` / `Fm7 Ab Bbm` / `Fm Db G° Ab` / `Ab Db Bbsus4` /
`Fm G° Eb7 Ab` / `Fm Db Bb5 Cm` / `Ab G° Eb Fm` / `Cm Ab Ebsus4` /
`Cm Ab Eb` / `Cm Fm Ab Eb`.

HARD: `Fm7 C5 Csus4 Bbm7 Cm` / `Bbsus4 C7sus4 Cm7 Ab Ab Absus4` /
`Bb5 F5 F7sus4 Eb Cm` / `Fsus4 Bbm7 C7sus4 Eb7 Bb7sus4` /
`C7sus4 Eb7 Abmaj7 Eb7sus4 Bbm` / `Ab5 Db Abmaj7 Fm7 C5 Bbm` /
`Dbmaj7 Eb7sus4 Db5 Fm` / `Abmaj7 Csus4 Bbm Eb7 Abmaj7sus4` /
`Fm G° Ab Dbmaj7 Gm7b5` / `Fm7 Db Ab5 Fm9 Abmaj7 Fm9` /
`C7sus4 Db Csus4 Db5 Cm7 Bbm` / `Db5 Ab5 Eb7 Gm7b5 Eb5 Cm` /
`Eb7 Bb5 Cm Bb7sus4 Fm9 Ab` / `Ab5 Eb7sus4 Fm7 Eb` / `Db Ab Ab5 Bb7sus4`.
(`Ab Ab` in deal 2 and `Fm9 ... Fm9` in deal 10 are the two register
voicings of one name; the identical-card rule is per card, not per name.)

Hijaz BASIC under R-3 (same seed): `C# G#° D°` / `C# F#sus4 Bm D°` /
`C# G#° D°` / `C# Bm F°` / `C# G#° F°` / `C# F°` / `C# G#°` / `C# G#° D°` /
`C# Bm D° F°` / `C# G#°` / `C# F#sus4` / `C# D°` / `C# G#°` / `C# D° Bm F°` /
`C# F#sus4 F° D°`.

## 7. Monotonicity rules and tests (tests first)

Per deck, over the shape run (3,000 draws per tier on built-ins, 300 (TR-15) on
each sweep row that deals every tier):

| axis | rule | measured range (sweep) | status |
|---|---|---|---|
| M-1 mean length | B < M < H | always | asserted everywhere |
| M-2 non-anchor share | B <= M < H, B = 0 | always | asserted everywhere |
| M-3 register share among NON-ANCHOR chords | B = M = 0 <= H (non-decreasing, not strict: decks without register colour cards have H = 0). Measured over non-anchor chords only: a register-labelled ANCHOR is BASIC/MEDIUM vocabulary (R-1, D-14, `REGISTER_HOME`'s home anchor starts every BASIC deal there), so an all-chord register share is NOT zero on those decks; the probe's sweep flags them `r!` for exactly that reason (decision TR-13, eng review R2, codex P1) | `REGISTER_ANCHOR`/`REGISTER_HOME` rows: H 22.6 / 22.3 (all-chord) > 0; built-ins Amara/Hijaz H = 0 | asserted everywhere on the non-anchor measure, decision TR-12 (non-strict) |
| M-4 vocabulary | cards(B) subset cards(M) subset cards(H) | by construction | asserted everywhere |
| M-5 home-start rate | B > M and B > H everywhere; M > H on the built-in decks where it holds today (Pygmy 40.5 > 16.0, Amara 40.5 > 32.8); on Hijaz (26.7 vs 34.3) and on 19 sweep rows HARD's free start exceeds MEDIUM's (`top-heavy N=13`: H 40.6 vs M 31.2) | see left | decision TR-6: assert B > M and B > H per deck; assert M > H on Pygmy and Amara only. Alternative: give HARD a home-side weight below MEDIUM's (makes "home start free" false). Recorded for the owner. Owner decision 2026-10-04: leave as is, no HARD home-side weight. |

Tests, all in `tests/sequence.test.js` unless named, written BEFORE the
engine change and red on main for the stated reason:

- **S1 shape (built-ins).** For each deck and tier, 3,000 draws through
  `_internal.drawBasic` / `_internal.drawMedium` on cells from
  `_internal.basicCells(deck)` / `_internal.mediumCells(deck)`, and 3,000
  `pick(deck, rng, null, "advanced")` for HARD (sampler, ~1 ms per deal);
  assert every band of section 2. Red on main: `_internal.*Cells` missing.
- **S2 shape (public path).** 300 `pick()` per tier per built-in deck with
  `prev` chained; every deal classifies as its tier via `tierOf`, lengths
  within +-6 pp (SE 2.8 pp at N = 300), BASIC home start >= 70%, every HARD
  deal meets the R-7 predicate and the register bound. Red on main: BASIC home start 14.5%.
- **S3 monotonicity.** M-1..M-5 per deck over the S1/S2 runs and over the
  sweep rows at 300 draws per tier (the sweep harness `generated()` at
  "generated decks: every tier deals its own tier"; 300 not 1,000, decision
  TR-15: the monotonicity gaps are 20-60 pp wide, SE at N = 300 is under 3
  pp, and HARD draws go through `pick()` at ~1 ms each over ~40 sweep rows).
  Red on main: M-5 (B 14.5 < M 40.3 on Pygmy).
- **Runtime budget (eng review R3).** `tests/sequence.test.js` takes 53 s
  locally today against `NODE_SUITE_TIMEOUT` 180 s, and CI runs it 1.5-2x
  slower. S1-S3 together may add at most 30 s locally; the lane records the
  before/after `duration_ms` of the suite in the PR body. If the budget is
  blown, cut S1's HARD draws from 3,000 to 1,000 first (its bands are
  100%/0% predicates, not proportions), never the BASIC/MEDIUM cell draws.
- **S4 family detection.** `_internal.colourFamily` over the 23 Pygmy, 15
  Amara and 11 Hijaz colour cards against the table in section 3 (R-6).
- **S5 D-1 re-pin.** Re-capture `tests/fixtures/sequence_basic_golden.json`
  (capture snippet at the top of the suite) and
  `tests/fixtures/sequence_tier_golden.json` after the engine lands;
  `tierOf` goldens re-captured the same way. `pick(d, rng, prev)` and
  `pick(d, rng, prev, "basic")` stay byte-identical to each other.
- **S6 Amy.** Existing Amy test restated: A1-A8 BASIC and in
  `sequences(PYGMY, len)`; A9, A10 `tierOf === "intermediate"` and present in
  `mediumCells(PYGMY)`; Amara A3/A10 MEDIUM, Hijaz A6 BASIC (substitute
  rows); odds computed from cell sizes and asserted at the TR-10 bounds.
- **S7 HARD on decks with no extended card.** The generated-deck test lists
  ONLY the three `NO_HOME_CHORD` rows as null on "advanced"; `reviewer (G3)`,
  `(A3)`, `(G#3)` (0 extended cards) deal HARD on every seed, and every
  dealt sequence has >= 2 non-anchor cards. A custom-scale case builds D
  Kurd 9 (`parseSeed` + `select.build`) and asserts HARD deals with 0
  extended cards.
- **S8 restated existing tests.** EASY pool sizes (28/96/264 etc. -> section
  4); "length is drawn 2, 3 or 4 evenly" and the 6,000-deal 3 pp test ->
  40/40/20; "tiers nest" -> R-8; "R8 rotations" -> R-9; "§2 migration table"
  -> the length-4 loop counts re-measured under the new gates (basic count
  = `sequences(deck, 4).length`, the rest by `tierOf`, including null);
  "tierOf returns null for a sequence ADVANCED can never deal" is extended
  with BOTH: a 5-chord sequence with exactly ONE non-anchor, non-extended
  card (null: one colour card, not MEDIUM by length, not HARD by the gate),
  and a 4-chord sequence with TWO non-anchor non-extended cards (tierOf
  "advanced", the positive side of the new branch) (TR-5); DFS budget tests
  gain the `MEDIUM_ENUM_BUDGET` bound (R-10) and keep `DFS_NODE_BUDGET` for
  HARD; "every BASIC anchor is in the INTERMEDIATE pool" unchanged;
  "INTERMEDIATE deals a register-labelled anchor" unchanged (D-14).
- **S9 `tests/app.test.js`.** No assertion change expected: the mode S
  validity check reads `sequences()`; the two tests that widened to "2 to
  4 chords" in PR #233 still hold. Face digests: `tests/fixtures/card_face_v1.json`
  and `gen_face_v1.json` mode S keys are enumerated from `sequences()`, so
  they SHRINK; regenerate with `node tools/regen_card_fixture.js` and check
  mode A and B digests byte-identical to main (as PR #233 did). The tool
  itself is not edited.
- **Mutants** (`tests/mutants/sqr_01..15.patch`, one per rule as named in
  section 3, each with a `# suite:` header naming the killing test with
  `.` wildcards, no `index a..b` lines, stale `@@` headers tolerated by
  `git apply`). Existing sequence mutants re-anchored where their hunks
  move: `sq_length4_bucket_dropped`, `sq_rng_ignored`, `sq_start_not_anchor`,
  `sq_wrap_not_checked`, `sqd_09`, `sqd_14`, `sqd_15`, `sqd_16` (run
  `python3 tools/refresh_mutants.py`; hand-rewrite against a stabler anchor
  where it cannot re-anchor, per memory `hand-regenerated-mutants-drift`).
- **FLOORS.** `tests/suite_health.py` row `"tests/sequence.test.js": 36`
  rises by the number of tests added; set from THIS branch's CI artifacts
  in a follow-up commit, and the README mutant count (629) likewise.

## 8. Lane (one, serial)

The only plausible split (engine rules vs shape harness) cannot go green
independently: the harness is red until the rules land and the rules are
unverifiable without it. One lane, `claude/tier-rebalance`, worktree
`scratchpad/lanewt` (exists, at `6b40b85`). Steps, TDD:

| # | step | done when | verify |
|---|---|---|---|
| 1 | Write S1-S9 and the 17 mutants; commit red | tests fail for the stated reasons on `6b40b85`; `git apply --check` passes on every new mutant | `node --test tests/sequence.test.js` (red) |
| 2 | R-1..R-3, R-9 in `pickBasic`/`basicPools`/`sequences`; `python3 tools/inline_engine.py`; then `node tools/regen_card_fixture.js` (R-9 shrinks the mode S face digests the moment `sequences()` changes, so the regeneration belongs to this step, not step 5; eng review R5) | S1 BASIC, S6 A1-A8, S8 pool sizes green; `tests/app.test.js` green; mode A/B digests byte-identical to main | `node --test tests/sequence.test.js tests/app.test.js` |
| 3 | R-4..R-6, R-10 (`mediumCells`, `drawMedium`, `colourFamily`, `MEDIUM_ENUM_BUDGET`); inline | S1 MEDIUM, S4, S6 A9/A10 green | same |
| 4 | R-7, R-8 (`classifyTier` HARD gate, null); inline | S1 HARD, S7, tierOf null test green; S3 green | same + `tests/app.test.js` |
| 5 | Re-capture goldens (S5), regenerate face digests (S9), re-anchor mutants | every suite green locally; `python3 tools/validate.py`; `python3 tools/inline_engine.py --check`; `bash tests/mutation_check.sh` kills all `sq*` mutants | full verify command |
| 6 | Push; CI at head SHA; FLOORS + README count from CI artifacts as a follow-up commit | CI green at the verified head | `gh run list --branch claude/tier-rebalance` |
| 7 | Independent reviewer (brief below); merge under AFK rules; cleanup | PASS / PASS_WITH_NITS at the merged SHA | `gh pr view --json state,headRefOid` |

**Ownership (this lane only):** `src/engine/sequence.js`; the
`<!-- engine:sequence -->` region of `index.html` via `tools/inline_engine.py`;
`tests/sequence.test.js`; `tests/fixtures/sequence_basic_golden.json`,
`sequence_tier_golden.json`, `card_face_v1.json`, `gen_face_v1.json`
(regenerated, tool untouched); `tests/mutants/sq*.patch` (new `sqr_*`,
re-anchored `sq_*`/`sqd_*`); the `tests/sequence.test.js` FLOORS row in
`tests/suite_health.py`; the mutant count line in `README.md`;
`docs/plans/2026-10-04-tier-rebalance.md`. Nothing else. In particular NOT
`tests/app.test.js` assertions, `tests/e2e.test.js`, app markup or CSS,
`data/decks.json`, `tools/regen_card_fixture.js`.

**Verify command:**
`node --test tests/sequence.test.js tests/app.test.js && python3 tools/validate.py && python3 tools/inline_engine.py --check && bash tests/mutation_check.sh`

**Standing merge gates:** CI green at a head SHA verified against the local
tip (`gh pr view <n> --json state,headRefOid`); the independent reviewer
PASS or PASS_WITH_NITS at that SHA; no edits to the worktree while
`mutation_check.sh` runs; `--force-with-lease` only on this lane's branch;
merge with `gh pr merge <n> --merge`, no `--delete-branch`.

**Reviewer brief (verbatim, add no rules):** branch `claude/tier-rebalance`,
base `main`, the verified head SHA, the ownership list above, the goal and
non-goals of section 0, and these acceptance criteria: "(1) `tests/sequence.test.js`
asserts the section 2 bands at N = 3,000 on the three built-in decks and
the section 7 monotonicity rules M-1..M-5 per deck, over the built-ins and
the generated sweep, and is green in CI at the head SHA. (2) On Pygmy A1-A8
classify BASIC and A9-A10 MEDIUM; on Amara and Hijaz every row that
resolves exactly keeps the same tier as on Pygmy; no row that resolves on
main regresses to NONE; A10 better than 1 in 2,000 and A9 better than 1 in
10,000 per MEDIUM deal on Pygmy. (3) `tierOf` returns null for a 4-6 chord
sequence that fails MEDIUM and has no extended card and at most one
non-anchor card (TR-5 as restated). (4) Every
`tests/mutants/sq*.patch` is killed by the mutation gate at the head SHA.
(5) `python3 tools/inline_engine.py --check` and `python3 tools/validate.py`
pass; mode A and B face digests are byte-identical to main. (6) No file
outside the ownership list changed." Read-and-report only; FAIL needs a
concrete failure scenario.

## 9. Cost and risk

- Cost: engine ~250 lines changed in one module; tests ~400 lines; 15
  mutants; fixture regeneration. CC time ~2-3 h including CI and review.
- Risk: the MEDIUM enumeration budget. Measured max 36,000 nodes at N=19;
  `MEDIUM_ENUM_BUDGET` 60,000 leaves 1.7x headroom and the budget test makes
  truncation a red, not a silent bias. If a future generator emits larger
  decks the number is the first thing to raise.
- Risk: the face-digest regeneration (S9) is the step most likely to touch
  bytes outside the lane's intent; the mode A/B byte-identity check is the
  guard.
- Risk: Hijaz MEDIUM home start 26.7% (R-4 note). The owner may prefer a
  higher home weight on decks with few non-dim anchors; the weight is one
  constant and the band test will show the effect.
- Risk (product): under the broad gate the HARD extended-deal share on the
  built-ins falls from today's 94 / 71 / 49 to 84.3 / 69.0 / 47.0 (Pygmy /
  Amara / Hijaz), because two-colour-card sequences without an extended card
  now qualify. Owner accepted this to give every deck, including D Kurd and
  C Major customs, a HARD tier.
- Risk: MEDIUM enumeration cost on phones (R-10): 19 ms in Node is an
  estimated 60-100 ms on a low-end phone per MEDIUM tap. Not measured; if a
  user reports lag on MEDIUM, TR-9's rejected per-deck cache is the fix.

## 10. Rollback and future rule changes

The shape test (S1-S3) is the regression guard. Reverting the engine
commit restores main's behaviour and turns S1-S3 red, which is the correct
signal. A future rule change is evaluated by rerunning
`scratchpad/rebalance_probe2.js` (or S1 with the proposed constants) and
filling a new copy of the section 2 table; a change is accepted only with
the table and the Amy table re-measured.

## 11. Numbered decisions (defaults recorded, AFK)

| id | decision | default | alternative |
|---|---|---|---|
| TR-1 | a non-triad home anchor is BASIC vocabulary | yes, whatever its shape (home is always dealt) | refuse BASIC on such decks |
| TR-2 | BASIC tiny-pool fallback | `MIN_BASIC_POOL = 12`; widen to all anchors | refuse; or widen only when empty |
| TR-3 | MEDIUM start set | non-diminished anchor or home-rooted card | triad anchors only (Amara A10 -> NONE) |
| TR-4 | colour families | susPower (`/sus/`, `/^[A-G][#b]?5$/`), seventh (`/7/`), other; equal share among non-empty | fold "other" into seventh |
| TR-5 | HARD not a catch-all | 4-6 chord non-MEDIUM sequence with no extended card AND at most one non-anchor card -> `tierOf` null (owner, 2026-10-04) | keep catch-all |
| TR-6 | home-start monotonicity | B > M and B > H per deck everywhere; M > H on Pygmy and Amara only. Owner decision 2026-10-04: leave as is, no HARD home-side weight | HARD home-side weight |
| TR-7 | deck with no extended card | SUPERSEDED (owner, 2026-10-04): HARD deals via the two-non-anchor branch on every deck | `NO_TIER_SEQUENCE` on such decks |
| TR-8 | `sequences()` semantics | the dealt BASIC pool; R8 rotations superseded; face digests regenerated | all-anchor loop set + new `basicPool()` |
| TR-9 | MEDIUM enumeration | once per `pick()`, no cache, `MEDIUM_ENUM_BUDGET = 60,000`; tests drive `_internal` cells | per-deck cache |
| TR-10 | A9 odds | accept 1 in 6,750; acceptance restated to "A9 better than 1 in 10,000" | raise 4/pure weight. The outside reviewer (codex P2) showed joint cell weights that meet the ORIGINAL 1-in-2,000 for both A9 and A10: put 27.3% of all MEDIUM draws on the 540-sequence `4/pure/other` cell and 6.7% on the 130-sequence `3/pure/other` cell (A9 ~1 in 1,978, A10 ~1 in 1,940, pure still 34%). Not adopted under AFK: it makes pure deals 80% length-4 and off-home, which cuts against owner decision 4 (lengths 60/40 inside every kind) for two Amy rows; recorded for the owner, one constant table to change. CONFIRMED by the owner 2026-10-04: keep 60/40 lengths, A9 1 in 6,750 |
| TR-11 | substitute Amy rows | measured, must not be NONE, exempt from "same tier as Pygmy" | hold them to Pygmy's tier |
| TR-12 | register monotonicity | non-decreasing (H may be 0 on decks without register cards) | strict |
| TR-13 | M-3 measure | register share among NON-ANCHOR chords (register anchors are BASIC/MEDIUM vocabulary; all-chord share is non-zero on `REGISTER_HOME`) | all-chord share, and drop register anchors from BASIC/MEDIUM vocabulary (breaks D-14 and R-1) |
| TR-14 | MEDIUM enumeration prune | branch-level colour-card cap (`colourUsed` prefix check) in a `mediumEnumerate` DFS or a `prune` hook on `dfsFindAll`; budget test pins `stats.nodes` to section 4 | leaf-only accept with a ~250,000 budget (truncates nothing but costs 10x) |
| TR-15 | S3 sweep draws | 300 per tier per sweep row (SE < 3 pp against 20-60 pp gaps) | 1,000 |

## 12. Reproduction

In a detached worktree at `6b40b85`:
`node scratchpad/rebalance_probe2.js pygmy 3000` (also `amara`, `hijaz`,
`sweep 1000`); env `M_HOME_W` (0.4), `MIN_BASIC_POOL` (12), `M_START`
(`nondim` | `triad`). Outputs used here: `probe3_pygmy.out`,
`probe3_amara.out`, `probe3_hijaz.out`, `probe3_sweep.out`. The probe's
gates are the R-1..R-7 predicates verbatim; the engine must reproduce its
pool sizes (section 4) exactly, which S8 asserts.

## 13. Engineering review (/plan-eng-review, 2026-10-04, AFK)

Reviewer: Claude (interactive session, owner AFK: every D<N> below is
auto-answered with the recommended option and listed in the session
summary). Target: this file at lane head `6b40b85`, branch
`claude/tier-rebalance`. Outside voice: codex (`codex-plan-review`,
completed, verbatim in 13.6). Search unavailable: no web search was run.

### 13.1 Decision ledger

### D1: prerequisite design doc
No design doc exists for this plan; the plan carries its own requirements
(section 3) and owner interview answers (section 1). Options: run
/plan-design-review first, or skip. Auto-answer: **Skip, proceed with the
standard review** (recommended): the change is engine-only, no UI, and the
owner already answered the design questions in the interview.

### D2: complexity gate (structure)
The plan touches 10 files (`sequence.js`, `index.html` engine region,
`sequence.test.js`, four fixtures, `sq*.patch`, `suite_health.py`,
`README.md`, this plan). Question: `Original arrangement` (one lane, section
8) vs `Smaller arrangement` (split engine rules from shape harness).
Auto-answer: **Original arrangement** (recommended): the file set is forced
by the generated-region and fixture rules, and section 8 already shows the
split cannot go green independently. Scope record: one lane, seven serial
steps, no reduction.

### R1: TR-7 leaves some generated decks with no HARD tier
- Finding: `[MEDIUM] (confidence: 9/10) src/engine/sequence.js classifyTier`
  (plan R-7/TR-5/TR-7). On a generated deck with no non-anchor card over 4
  fields and no register voicing, HARD classifies nothing and the HARD
  button shows `NO_TIER_SEQUENCE`. Three sweep rows are in that state today.
- Plan baseline: TR-7 chose `NO_TIER_SEQUENCE`, catch-all rejected.
- Runtime evidence: `probe3_sweep.out` rows G3/A3/G#3 (12-chord pans) show
  `nulls H` non-zero under the new gate; main deals HARD on them.
- Question D3: keep TR-7 or restore a catch-all only on decks with zero
  extended cards? Options: A) keep TR-7 and flag for the owner
  (recommended; the owner defined HARD as "extended, register bounded" and
  a catch-all makes HARD deck-dependent again), B) catch-all on
  zero-extended decks (one predicate in `classifyTier`, M-4 then holds
  trivially on those decks).
- State: auto-answered A. Accepted scope: section 9 risk added; TR-7
  unchanged. History: raised by this review, not by codex. Owner answered
  D3 on 2026-10-04: broaden HARD everywhere (R-7 above). R1 is resolved; the
  section 9 risk is restated.

### R2: register definitions were inconsistent (codex P1, second finding)
- Finding: `[HIGH] (confidence: 10/10)` plan R-7 and M-3. R-7 said "non-anchor
  with > 4 fields OR a register voicing" but the probe's `extended`
  predicate excludes anchors for BOTH clauses; M-3 said `B = M = 0` register
  share, which is false on `REGISTER_HOME` (every BASIC deal starts on the
  HIGH VOICING home anchor) and on `REGISTER_ANCHOR` (D-14 keeps MEDIUM
  dealing a register anchor).
- Runtime evidence: `rebalance_probe2.js` line 85 `extended = i =>
  !isAnchor(i) && (nFields > 4 || isReg(d, i))`; `probe3_sweep.out`
  `REGISTER_HOME` row flagged `r!`.
- Resolution (no owner question, it is a wording defect): R-7 now says
  "a NON-ANCHOR card that has > 4 fields OR carries a register voicing";
  the register bound counts every chord; M-3 is measured over NON-ANCHOR
  chords (TR-13). S8's D-14 test and R-1 stand unchanged. State: applied.

### R3: added test runtime is unbudgeted
- Finding: `[MEDIUM] (confidence: 8/10) tests/sequence.test.js`. The suite
  takes 53 s locally against the 180 s `NODE_SUITE_TIMEOUT`; CI is 1.5-2x
  slower. S1 adds 9,000 `pick()` calls per deck and S3 adds 1,000 draws per
  tier over ~40 sweep rows, with every HARD draw running the DFS.
- Question D4: 1,000 or 300 sweep draws per tier? Auto-answer: **300**
  (recommended, TR-15): SE under 3 pp against 20-60 pp gaps. Runtime
  budget recorded in section 7 (S1-S3 add at most 30 s locally; cut S1
  HARD draws first). State: applied.

### R4: R-5 did not say that MEDIUM cells exclude BASIC-classified sequences
- Finding: `[LOW] (confidence: 9/10)` plan R-5. The probe applies the R-8
  classification at the leaf, so a pure home-start triad loop is BASIC and
  is in no MEDIUM cell; the engine must do the same or the section 4 cell
  counts (which S8 asserts) will not reproduce. Resolution: sentence added
  to R-5. State: applied.

### R5: step ordering stales the face fixtures one step early
- Finding: `[MEDIUM] (confidence: 9/10)` plan section 8 steps 2 and 5. R-9
  lands in step 2 and shrinks `sequences()`, which `tests/app.test.js`'s mode
  S face digests enumerate; the plan regenerated them in step 5 while step
  4's verify already runs `tests/app.test.js`. Resolution: regeneration
  moved into step 2's done-when; step 5 keeps the final re-capture. State:
  applied.

### R6: MEDIUM enumeration budget did not fit `dfsFindAll` (codex P1, first finding)
- Finding: `[HIGH] (confidence: 10/10) src/engine/sequence.js dfsFindAll`.
  The plan's 23,646-node figure was measured under the probe's branch-level
  colour-card prune (`rebalance_probe2.js` line 119); `dfsFindAll` (lines
  518-551) prunes only connectivity and consecutive repeats, so the same
  accept at the leaf visits 221,520 nodes on Pygmy length 4 and the 60,000
  budget truncates shipped decks.
- Question D5: dedicated `mediumEnumerate` with the prefix check, or a
  `prune` hook on `dfsFindAll`? Auto-answer: **either, implementer's choice,
  with the budget test pinning `stats.nodes` to the section 4 counts**
  (recommended; TR-14). Leaf-only accept with a 250,000 budget rejected
  (10x cost on every MEDIUM tap). State: applied to R-10 and TR-14.

### R7: TR-10 alternative from codex (P2)
- Finding: `[LOW] (confidence: 7/10)` plan TR-10. Joint cell weights can
  meet the original 1-in-2,000 for A9 and A10 (27.3% of all MEDIUM draws on
  `4/pure/other`, 6.7% on `3/pure/other`).
- Question D6: adopt the joint weights or keep TR-10? Auto-answer: **keep
  TR-10** (recommended): the joint weights make pure deals 80% length-4 and
  off-home, against owner decision 4 (60/40 lengths inside every kind).
  Recorded in TR-10 for the owner; one constant table to change. State:
  recorded, not applied. Owner confirmed 2026-10-04.

### 13.2 Scope challenge
1. Smallest change that meets the owner's five decisions: the seven rules
   R-1..R-7 plus the sampling R-5; none is droppable without breaking a
   numbered owner decision. 2. Nothing is built that was not asked: the
   generated-deck monotonicity sweep is the owner's "deterministically across
   scales" requirement. 3. Reuse: `dfsFindAll`, `basicPools`, the sweep
   harness, `regen_card_fixture.js` all reused. 4. TODOS.md has no
   sequence-tier entry; nothing to cross-reference. 5. Removed from scope by
   this review: nothing. 6. Deferred: TR-10 joint weights (owner). 7.
   Non-goals confirmed: no deck data, no geometry, no UI copy, no
   `regen_card_fixture.js` edits.

### 13.3 Section 1, architecture
No issues found beyond R1, R2 and R6 above. The ES5 no-cache style is kept;
`pick()` stays the single entry point; the tier enum and the app's
`NO_TIER_SEQUENCE` path are unchanged.

### 13.4 Section 2, code quality
- `[LOW] (confidence: 8/10) src/engine/sequence.js makeAccept` : the new
  MEDIUM cell bucketing must not be folded into `makeAccept` (HARD still uses
  it); keep `mediumEnumerate` separate so the HARD path's node counts and
  the `DFS_NODE_BUDGET` tests do not move. Covered by TR-14.
- No issues found otherwise.

### 13.5 Section 3, tests

```
pick()
 ├─ BASIC  pickBasic/basicPools ─ S1 bands ★★★★  S6 A1-A8 ★★★★  S8 pools ★★★  golden S5 ★★★
 ├─ MEDIUM mediumEnumerate ──────── S1 bands ★★★★  S4 cells ★★★★  S6 A9/A10 ★★★  budget ★★★★ (nodes pinned)
 ├─ HARD   classifyTier/dfsFindAll ─ S1 bands ★★★  S7 null ★★★★  TR-7 sweep rows ★★★
 ├─ cross-tier  S3 monotonicity ★★★ (built-ins + sweep at 300 draws)
 ├─ app consumers  S9 app.test.js ★★★ (mode S validity reads sequences(); A/B digests byte-identical)
 ├─ mutants  15 sqr_* + 8 re-anchored ★★★★
 └─ [→E2E] tier buttons / NO_TIER_SEQUENCE copy: existing e2e.test.js, untouched
[GAP] phone-side MEDIUM tap latency: not testable in Node; section 9 risk.
```

REGRESSION RULE: every S8 restatement keeps the test name and changes only
the asserted numbers, so a wrong-reason pass is visible in the diff.
Test plan artifact:
`~/.gstack/projects/raywu-handpan-cards/ray-claude-tier-rebalance-eng-review-test-plan-20261004-212041.md`.

### 13.6 Section 4, performance
- R6 above (MEDIUM enumeration), resolved by TR-14.
- `[LOW] (confidence: 6/10)` phone latency 60-100 ms per MEDIUM tap on
  Pygmy, estimated not measured; section 9 risk. No other issues found.

### 13.7 Outside voice

```CODEX SAYS
P1 — R-10’s enumeration budget does not fit the specified implementation. Running the existing `dfsFindAll` with the proposed MEDIUM pool/start rules visits 221,520 nodes for Pygmy length 4 alone, and 65,575 for Amara. The existing DFS prunes connectivity and consecutive duplicates; a leaf-level acceptance predicate cannot reduce those counts. The 60,000 budget truncates shipped decks. Specify the probe’s additional branch pruning and production behavior on truncation before treating its pool sizes, probabilities or timings as validated.

P1 — The register requirements are mutually incompatible. R-1/R-4 preserve register-labelled anchors, while M-3 requires `B = M = 0` register share everywhere. `REGISTER_HOME_DECK` has a HIGH VOICING major home anchor: every proposed BASIC deal starts on it. S8 also explicitly preserves the test requiring MEDIUM to deal register anchors. Moreover, R-7 counts these anchors as “extended,” although MEDIUM can use them, contradicting HARD’s defining requirement. Resolve the vocabulary and metric definitions together; the specified tests cannot all pass.

P2 — TR-10 relaxes the Amy acceptance criterion on a false optimization premise. Independent sampling of length/kind/side is an implementation choice. Joint cell weights can meet both original odds within the stated bands: allocate 27.3% of all MEDIUM draws to the 540-sequence A9 cell and 6.7% to the 130-sequence A10 cell. That gives approximately 1-in-1,978 and 1-in-1,940, with 34% pure deals. The remaining colour cells can preserve 60/40 lengths, 40% home starts and equal families. Evaluate this before accepting the weaker A9 requirement.

Recommendation: Revise before implementation because the enumeration measurements do not describe the specified algorithm, and the register acceptance criteria are unsatisfiable.
```

Disposition: P1 (enumeration) confirmed, fixed by TR-14 (R6). P1 (register)
confirmed as a wording defect, fixed by R-7 rewording and TR-13 (R2). P2
evaluated and recorded under TR-10 for the owner (R7).

### 13.8 TODOS.md
Nothing added (no entry is owed: TR-10's alternative lives in this plan's
decision table, which the owner reads). Nothing skipped, nothing built now.

### 13.9 Required outputs
- **NOT in scope:** deck data, geometry, UI copy, `tools/regen_card_fixture.js`,
  `tests/app.test.js` assertions, `tests/e2e.test.js`, per-deck caches, a
  HARD catch-all, the TR-10 joint weights.
- **What already exists:** `dfsFindAll`, `basicPools`, `classifyTier`,
  `tierOf`, the sweep harness in `tests/sequence.test.js`, the golden and
  face fixtures and their regeneration tools, `tools/refresh_mutants.py`.
- **Diagrams:** section 13.5 (test coverage); section 2's band table is the
  output shape.
- **Failure modes:** budget truncation (test red by design); a lost branch
  prune (node-count test red); stale face digests (app.test.js red in step
  2); runtime budget blown (cut S1 HARD draws); a generated deck with no
  HARD (owner-flagged, section 9).
- **Worktree parallelization:** Sequential implementation, no
  parallelization opportunity.

### 13.10 Implementation Tasks
| id | P | task | human / CC | surfaced by | files | verify |
|---|---|---|---|---|---|---|
| T1 | P1 | Write S1-S9 and 15 `sqr_*` mutants, commit red | 1 d / 25 min | plan §8 step 1 | tests/sequence.test.js, tests/mutants/sqr_*.patch | `node --test tests/sequence.test.js` red for stated reasons |
| T2 | P1 | R-1..R-3, R-9; inline; regen face fixtures | 0.5 d / 15 min | §8 step 2, R5 | src/engine/sequence.js, index.html region, card_face_v1/gen_face_v1 | S1 BASIC, S6, S8, app.test.js green; A/B digests identical |
| T3 | P1 | R-4..R-6, R-10 with TR-14 prune; inline | 1 d / 20 min | §8 step 3, R6 | sequence.js, index.html region | S1 MEDIUM, S4, A9/A10, node-count test green |
| T4 | P1 | R-7, R-8 HARD gate and null; inline | 0.5 d / 10 min | §8 step 4, R2 | sequence.js, index.html region | S1 HARD, S7, S3 green |
| T5 | P2 | Goldens S5, mutant re-anchoring, mutation gate | 0.5 d / 20 min | §8 step 5 | fixtures, tests/mutants/sq*.patch | full verify command green |
| T6 | P2 | Push, CI, FLOORS + README count from artifacts | 0.2 d / 10 min | §8 step 6 | tests/suite_health.py, README.md | CI green at head SHA |
| T7 | P2 | Independent reviewer, merge, cleanup | 0.2 d / 15 min | §8 step 7 | none | PASS at merged SHA |
| T8 | P3 | Owner: decide TR-10 joint weights, TR-7 catch-all | 10 min / 5 min | R7, R1 | plan §11 | owner reply |

### 13.11 Suppressed findings (confidence 3-4)
- Hijaz MEDIUM home band exemption (R-4 note) is a conditional band; a
  future deck with two non-dim anchors could sit either side of it.
- `isReg` matches on subtitle text; a future subtitle rename would silently
  drop register detection. Not actionable now.

### 13.12 Unresolved decisions
None. D1-D6 auto-answered under AFK and listed above.

### 13.13 Completion summary
Seven findings (two from codex, five own), six applied in place (R-5, R-7,
R-10, M-3, S3 runtime budget, §8 step 2, §9 risks, TR-13..TR-15), one
recorded for the owner (TR-10). Plan is ready to implement.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO | not run | engine-only change, owner interview already fixed product shape | 0 | skipped | - |
| Outside | codex-plan-review | second model on the plan | 1 | completed | 3 (2 P1 confirmed and fixed, 1 P2 recorded) |
| Eng | /plan-eng-review | this review | 1 | clean after amendments | 7 |
| Design | not run | no UI change | 0 | skipped | - |
| DX | not run | no developer-facing surface | 0 | skipped | - |

OUTSIDE COVERAGE: codex reviewed the full plan body up to the 30 KB cap
(sections 0-12 minus the tail of section 12).

VERDICT: READY TO IMPLEMENT (one serial lane, section 8).

NO UNRESOLVED DECISIONS

## 14. Execution notes (lane `claude/tier-rebalance`, 2026-10-04)

Every deviation from sections 0-13 and every decision the lane took alone.

1. **Resumed from a WIP commit.** The first lane agent hit a rate limit and
   left `616e7c3` ("wip(sequence): tier rebalance steps 1-3 in progress").
   This lane audited that WIP against R-1..R-10 and the amended R-7 and built
   on top with new commits; no history was rewritten. The WIP engine already
   implemented every rule; the audit fixed one stale comment (`pickTiered`
   still described the superseded TR-7) and restated the tests (item 3 on).
2. **MIGRATION_L4 (S8 "section 2 migration table").** The plan gives no
   numbers; measured by full enumeration of connected length-4 loops and
   asserted as measured (basic = `sequences(deck, 4).length`):

   | deck | intermediate | advanced | null |
   |---|---|---|---|
   | Hijaz | 1,092 | 88,228 | 4,880 |
   | Pygmy | 8,900 | 2,542,250 | 2,811,862 |
   | Amara | 1,548 | 291,994 | 3,500 |

3. **Pygmy tier-doc fixtures re-classified (S5).** On main I1-I8 were all
   "intermediate" and A1-A6 all "advanced". Under the new rules: I1, I6 stay
   intermediate; I2-I5 (length 3 with two or three colour cards, over
   R-4's one-colour cap, and HARD starts at length 4) are null; I7, I8
   (length 4, two or more colour cards) are advanced by the two-non-anchor
   branch; A2, A5 stay advanced; A1, A3, A4, A6 (two or more LOW/HIGH
   voicings in four chords) are null by the register bound. Asserted as
   measured; each group carries its reason in a comment.
4. **S8 fixtures.** Three connected Pygmy loops, one per branch of the gate,
   each with its shape (non-anchor and extended counts, no register card)
   asserted before its tier: `[0, 6, 8, 19, 30]` Fm G° Ab Bbm Csus4 (one
   colour card, null), `[0, 6, 11, 20]` Fm G° Ab5 Bb5 (two colour cards,
   advanced), `[0, 5, 6, 8]` Fm Fm9 G° Ab (one extended card, advanced; the
   fixed example `sqr_17` names).
5. **Five-card deck now deals HARD.** The "fallback and empty-tier reasons"
   test used to assert HARD empty on the four-anchors-plus-G7 deck (TR-7).
   Under the broad gate a deal that plays G7 at two positions is HARD; the
   test now asserts a stuck-rng HARD deal classifies "advanced" and plays G7
   at least twice. The four-card and three-card all-anchor decks stay
   HARD-empty (no non-anchor card).
6. **S7 / generated decks.** The generated-deck test's null list is the
   three `NO_HOME_CHORD` rows only; reviewer (G3)/(A3)/(G#3) deal HARD with
   >= 2 non-anchor cards on every seed; a new test builds D Kurd 9 and
   asserts HARD deals with 0 extended cards.
7. **Face digests.** `card_face_v1.json`: only mode S keys changed; mode A
   and B byte-identical to main. `gen_face_v1.json`: its decks are
   unchanged, but `rails.basic` (one BASIC sequence rail) changed, so it was
   regenerated with the tool's own `node tools/regen_card_fixture.js --gen`
   (tool untouched). Section 7 S9 named only the default invocation.
8. **Golden format.** `sequence_basic_golden.json` is written pretty-printed
   (2-space indent, trailing newline) as on main; the capture snippet at the
   top of the suite now says so, so a re-capture does not minify it.
9. **Mutants: 17 `sqr_*`, not 15.** The broad-gate amendment replaced
   `sqr_13..15` with `sqr_13..17` (one per branch); section 7 and step 1
   still say 15. Killing tests where the plan named none: `sqr_01` the
   sequences golden table; `sqr_06` the tier golden fixture (MEDIUM's
   dim-chord share is "free, recorded", so S1 has no band that sees a dim
   start); `sqr_07`, `sqr_14`, `sqr_16`, `sqr_17` the TR-5 null test;
   `sqr_04/05/08/09/11/13` S1. Every kill was checked to be an assertion,
   not a crash.
10. **More mutants re-anchored than section 7 lists.** `refresh_mutants.py`
    re-anchored `sq_wrap_not_checked`, `sqd_01`, `sqd_02`, `sqd_05`,
    `sqd_07`; hand-rewritten against the current code (the tool reported
    UNFIXABLE): `sq_length4_bucket_dropped` (now drops the length-4 BASIC
    cells; its `# suite:` named a renamed test), `sq_prev_rejection_loop`
    (`withoutPrev`), `sq_start_not_anchor` (BASIC vocabulary = every card),
    `sqd_04`, `sqd_06`, `sqd_09`, `sqd_14`, `sqd_15`, `sqd_16` (its old
    killing test was renamed; it now names the tier golden test, as
    `sqd_15` does). `sq_rng_ignored` still applied and needed nothing.
    `sqd_06` now routes "basic" to `pickMedium`: falling through to
    `pickTiered` as before would throw on `TIER_LENGTHS.basic`, a
    wrong-reason kill.
11. **`eg_prevvalid_inverted.patch` (outside `sq*`).** It mutates
    `prevValid` in `src/engine/sequence.js`, which moved; the refresh tool
    called its anchor AMBIGUOUS and `git apply --check` failed, which would
    have reddened the mutation gate. Regenerated against the current
    `prevValid` with the same headers and the same mutation. This is the one
    file this lane touched outside the section 8 ownership list, and only
    because the module it patches is lane-owned.
12. **Verify command path.** Section 8 says `bash tools/mutation_check.sh`;
    the script is `tests/mutation_check.sh`.
13. **Durations, and why S1 needs no cut.** `node --test
    tests/sequence.test.js` on main was 52,823 ms for 36 tests (the brief's
    baseline; 55,987 ms re-measured in this session). The first push (df815d5)
    measured 84.3-84.8 s locally with every S1 tier at 3,000 draws, so S1's
    HARD draws were cut to 1,000 per R3's remedy (79,733 ms). CI then showed
    that was not enough: in run 37268618336 `tests/sequence.test.js` TIMED OUT
    at `suite_health.py`'s 180 s wall clock (CI runs this suite ~2.4x slower
    than local: main's whole js step was 253 s against ~120 s for the other
    suites), and the mutation gate's clean-tree baseline failed "generated
    decks: every tier deals its own tier ... under 50ms" with `mixed N=18
    intermediate seed 0 took 58ms`. Locally a MEDIUM pick on the 17-19 field
    sweep decks cost 15-25 ms, almost all of it in `field()`:
    `deck.fields[String(id)]` calls the global `String`, and under `node:vm`
    (`tools/engine_loader.js`) every global lookup goes through the context's
    interceptor. R-10 enumerates MEDIUM per pick, so this cost now landed on
    every deal. The fix is `deck.fields[id]`, which is the same lookup (a
    property key is converted with ToString either way) and needs no global
    call. With it the 19-field MEDIUM enumeration drops from ~23 ms to
    ~6-12 ms, and the whole suite runs in 21,903 ms for 43 tests, under main's
    baseline. The S1 cut was therefore REVERTED: S1 draws all three tiers
    3,000 times, as section 2 specifies. No other plan count changed.
    Measured in CI at 801c01d (run 37269871209, green): the whole js step
    (all 15 suites, e2e included) took ~119 s, against 253 s on main. The
    mutation-gate shards took 4m15s, 4m26s, 5m28s and 5m49s (shard 3), every
    clean-tree baseline was green with the 50 ms bound unchanged, and all 646
    mutants were killed. `tests/sequence.test.js` ran 43 tests, 0 failed.
14. **`sqd_12_dfs_leaf_skips_accept` re-pointed.** Its suite was the
    generated-deck tier test. Under the broad R-7 gate the HARD sampler's
    512 random draws always find a deal on those decks, so the DFS fallback
    is never reached there and the mutant survived (local gate and CI shard
    3/4). It now names "the DFS fallback completes and finds the exact
    exhaustive set", which kills it by an assertion ("DFS set differs from
    brute force"). The patch body is unchanged.
