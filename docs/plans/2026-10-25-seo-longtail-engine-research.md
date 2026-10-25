# SEO long-tail: engine, musical evidence and arrival contract

Research lane: independent engine/music/link investigation, 2026-10-25.
Frozen research prompt: `docs/prompts/2026-10-25-seo-longtail-subplan.md`,
SHA256 `16b334034765e063764c71c60dab709a393207c9eddaef595878417e7bad6fc8`.
Source baseline: `217609075a14e6ca4799497210af27d9df842c5e`.
This is evidence for a plan, not authority to implement or publish articles.

## Decision-relevant findings

The supplied instrument is a viable **candidate** for a useful lesson: the canonical
reader accepts it and the engine builds 67 chord cards. Its wire label is correctly
13+5, meaning **18 notes**, not the illustrative query's 20. An article must not
substitute this example under an E Amara 20 heading. A maker name carried in an
owner-supplied link establishes neither maker provenance nor popularity.

The article can offer the instrument in the app today. It cannot promise that the
link opens the exact published progression, difficulty, style or view. Instrument
restoration and progression reproduction are different contracts. Also, EASY is an
engine vocabulary/sequence class, not a physical-instrument accessibility guarantee:
the sampled EASY progression uses a bottom note. Musical/editorial human review is
required before calling a lesson beginner-friendly, beautiful or playable in a
specified manner. No listening/physical playing test occurred in this investigation.

## Methods and evidence qualification

Read project `CLAUDE.md`, `tests/CONTRACT.md`, relevant engine modules, app share/
boot/order/storage paths and existing test source. No test suites, browser, app
storage import, remote writes, dependency installs or source edits were performed.
One non-mutating inline Node diagnostic loaded reviewed repository engine code
through `tools/engine_loader.js`; it only read files, instantiated a private VM,
decoded/encoded the supplied literal and printed generated values. No diagnostic
file or output artifact was written. The results below are **Verified diagnostic
outputs**, not an independent musical oracle or an end-to-end browser test.

Reproduce after reviewing the source, without executing unreviewed scripts:

```js
const {loadEngine} = require('./tools/engine_loader.js');
const E = loadEngine(['core','voicing','layout','naming','select','share','sequence']);
const code = '6/uC3_uD3_(E3)_uG3_uA3_B3_uC4_D4_E4_Fs4_G4_A4_B4_D5_E5_-_Fs5_G5_A5/E+AMARA+13+%2B+5+%28XENITH+EXPANSE%29/between/at-130,20,335,210,185/4ef180';
const read = E.share.decode(code);
// Inspect read.ok before continuing. Actual result here: true.
const seed = read.value;
console.log(E.core.formatSeed(seed), seed.options, seed.fields);
console.log(E.share.encode(seed)); // actual value equals code byte for byte
const built = E.select.build(seed);
// Inspect built.ok before continuing. Actual result here: true.
for (const tier of ['basic','intermediate','advanced']) {
  console.log(tier, E.sequence.pick(built.value, E.sequence.mulberry32(42), null, tier));
}
```

Inspection of `tools/engine_loader.js` shows read-only file access and VM loading;
the loaded modules are plain engine scripts with no filesystem/network side
effects. This bounded diagnostic is not equivalent to running every possible scale.

## Supplied URL: canonical verified meaning

Canonical input (English note conventions unchanged):

```text
[C3] [D3] (E3) [G3] [A3] B3 [C4] D4 E4 F#4 G4 A4 B4 D5 E5 | F#5 G5 A5
```

| Zone | Verified notes | Count |
|---|---|---:|
| Ding | E3 | 1 |
| Rim | B3 D4 E4 F#4 G4 A4 B4 D5 E5 | 9 |
| Inner | F#5 G5 A5 | 3 |
| Bottom | C3 D3 G3 A3 C4 | 5 |
| Total | 13 upper including ding, plus 5 bottom | 18 |

Decoded options: name `E AMARA 13 + 5 (XENITH EXPANSE)`, palette0,
parent inference (`null`), mirror false, anchor `between`, bottom angles in U1–U5
order `[130,20,335,210,185]`. The reader validates angle length/floor through the
layout solver and validates the checksum. Re-encoding the decoded seed is byte-
exact, including checksum `4ef180`. This is internal consistency evidence;
independent fixture/checksum tests remain necessary because encoder and decoder
can share a defect. Sources: `src/engine/share.js:308`, `:437`, `:520`;
`tests/share.test.js:117` explicitly explains why round-trip alone is insufficient.

`HPE.select.build(seed)` returned id `custom:d070a859`, name above, 67 chords and
no warnings. That raw build is enough to inspect chord notes, **not** a full
geometry-equivalent article renderer: `select.build` solves the default layout;
the app's `generateDeck` subsequently re-applies carried seats/bottom angles and
restores carried name/parent semantics (`index.html:9869–9940`). A future diagram
pipeline must match that supported sequence and validate physical labels/angles,
without silently introducing a second share parser or changing the live app.

## Genuine engine examples, not approved lesson copy

These are observed candidates generated at the pinned baseline with a new
`mulberry32(42)` instance per tier and `prev=null`. Chord indexes are revision-
specific and must never be the sole durable identifier in a content record.

| Tier / style | Returned indexes | Resolved chord sequence |
|---|---|---|
| basic / paradiddle | 0,48,24 | Em → D → Am |
| intermediate / three-three-two | 24,5,8,10 | Am → Em(add9) → F# diminished → G |
| advanced / freestyle | 18,41,57,31,16 | G(add9) → Bm7 high voicing → D7sus4 → Am7 → Gmaj7 |

The basic result's exact field mapping is Em `[3,5,7]` = E4/G4/B4,
D `[2,4,6]` = D4/F#4/A4 and Am `[6,105,9]` = A4/**C4 bottom**/E5.
This gives a concrete differentiated lesson opportunity (how the bottom C enables
Am and how to approach that transition), subject to an actual player's review.
It also gives a concrete editorial rejection check: do not describe this voicing
as top-shell-only. The intermediate F# diminished uses F#4/A4/C4 bottom too.
No inference that the instrument is tuned accurately, the progression sounds
pleasant, the named style is appropriate for a beginner, or a specific player can
strike the tones simultaneously has been validated.

## What the engine actually guarantees

**Verified from source, not newly tested:**

- `select.js:104–150` admits chord candidates only when required pitch classes
  exist on non-ding fields; extended qualities additionally require their tones
  on the upper shell. The ding never voices. The engine collapses equivalent
  pitch sets, selects particular registers and ranks/canonically orders cards.
- `voicing.js:20`, `:236–305` caps voicings at six notes, applies the project's
  extension-trimming, root-register and forced-tone rules. These are explicit
  musical representation conventions, not a model of hand reach or timbre.
- `sequence.js:165–203` chooses anchors by shape/root, ties preferring fewer
  bottom fields, and connects adjacent chords by shared pitch class or root
  distance of one/two semitones. A smooth connection heuristic is not evidence
  of a unique tonal analysis or universally pleasing voice leading.
- `sequence.js:280–329`, `:551–634` defines EASY as 2–4 basic-vocabulary cards,
  MEDIUM as 3–4 cards with at most one colour card, HARD as 4–6 with specified
  complexity/register limits. Vocabulary, start rules and sampling weights matter;
  tiers are not interchangeable with an accredited beginner/intermediate syllabus.
- `sequence.js:1088` accepts an explicit RNG, prior sequence and tier. Its public
  `mulberry32` supports repeatable editorial candidate generation. The app instead
  passes `Math.random` (`index.html:10823`), so the public link does not pin a draw.
- A valid instrument can build zero cards; app `generateDeck` refuses it without
  overwriting current selection (`index.html:9875`). Valid card decks can still
  produce `NO_HOME_CHORD`, `TOO_FEW_CHORDS` or `NO_TIER_SEQUENCE`. Do not force a
  multi-tier article out of a scale without supported results. Hard search is
  bounded; a sampled result set is not proof of exhaustive progression coverage.

## Article → app arrival matrix

Source-backed behavior is **Verified by inspection**; all rows are **unexecuted
browser scenarios** for a future approval-gated validation pass.

| Visitor state | Supported expectation | What the article must not promise |
|---|---|---|
| Fresh storage, valid URL | Instrument generated and selected; mode defaults A (name→notes flashcards), tier basic | Automatically opening Chord progression or the published draw |
| Returning with mode/tier stored | Instrument selected; valid stored A/B/S mode and basic/intermediate/advanced tier retained | Forcing EASY/MEDIUM independently of stored preferences |
| Returning in sequence mode | Sequence drawn with `Math.random`; prior in-memory sequence can influence no-repeat behavior | Same indexes, style or start chord as article |
| Reload/repeated article arrival to same stored deck | Correct instrument may still open, but `share_open` suppressed when id equals bootStored | Counting every arrival through existing share_open totals |
| Same-page hash already names current instrument | Canonical route guard can no-op; open sheet/About can cause hash handler to ignore change | A reset to article state on every click |
| Storage unavailable/denied | Guarded reads/defaults and in-memory saved scales support current session | Persistence across visits, exact repeat state or analytics delivery |
| Old valid share URL after engine changes | Instrument seed rebuilt using current engine | Frozen published chord set/ranking or perpetual identical card indexes |
| Malformed/newer/ineligible URL | Reader refusal / engine reason; no successful content guarantee | Silent repair or fallback claimed as successful exact-scale arrival |

Sources: `share.js:7–9`; `index.html:9559`, `:9763–9770`, `:9972–9989`,
`:9998–10006`, `:10145–10164`, `:10818–10829`, `:14480–14533`.
Blocked storage does not imply the app crashes; existing guarded paths deliberately
support it. That source evidence is weaker than a new physical-device journey.

Recommended truthful CTA: **“Open this 18-note scale in Handpan Chord Cards.”**
Then give current-UI steps: open Settings, choose Chord progression and EASY or
MEDIUM; explain that the app generates additional progressions and may show a
different one. Keep the article's notated examples/diagrams independently useful.
Do not use “Play this exact progression” for the existing URL. Publishing that
wording, introducing a progression deep-link route or changing app state on arrival
all require separate implementation/content approval.

## Reproducible editorial record and validation proposal

Proposed record: content id/version; provenance of exact note inventory including
zones/octaves and layout source/license; canonical instrument seed/options; wire
version/link; engine Git SHA and module digests; generated deck/chord identities
including symbolic quality, pitch classes, concrete fields/octaves/zone labels;
RNG algorithm/initial integer and independent stream per tier, call order/prior
sequence, resolved order/style, locale; candidate date; human musical reviewer,
review date/limitations; article draft/approval status; public CTA contract and
compatibility-monitoring owner. Preserve resolved output rather than regenerating
silently at publication. A changed engine must trigger a reviewed diff/correction,
not automatically rewrite musical explanations or dates.

Independent acceptance oracles: owner/maker-confirmed inventory, a frozen reviewed
lesson fixture, independently specified pitch-class intervals and field membership,
plus actual player assessment for physical recommendations. The production encoder
round-trip, `tierOf` classification and LLM prose are useful diagnostics but cannot
be the only oracle for their own implementation or musical suitability.

Existing relevant suites (source inspected, not run here):
`tests/share.test.js` pinned legacy/current wire cases, independent checksum helpers,
angle floor/shape refusals and URL escaping; `tests/sequence.test.js:313` explicit-
RNG determinism and `:1349` generated-tier connectivity/range/performance;
`tests/app.test.js:409–430` denied-storage and share usability;
`tests/core.test.js`, `tests/voicing.test.js`, `tests/select.test.js` and naming/
layout suites cover the corresponding project contracts. Existing tests do not
establish a new editorial pipeline's correctness or this article's physical QA.

For future implementation, add spec-first positive and negative cases for exact
18-versus20 heading/link alignment; wrong octave/shell; missing chord tone;
bottom-required beginner claims; no-card and unavailable-tier rejection;
fresh/returning/repeated/storage-denied arrival; old reader/checksum/escaping;
query-before-hash; stable output fixture versus engine drift; and preserved
app/print/parser/share behavior. Fault injections must assertion-fail after a clean
green baseline; do not count startup error, timeout, skip or shared-oracle agreement
as proof. Full final-head CI and actual DEV journeys remain required for any later
app-touching implementation, following the shared browser lease/runbook.

## Limits and owner decisions

- **Unverified:** maker-origin authentication, popularity/search demand, real-world
  ergonomics/sound, editorial review capacity and permission to publish.
- **Partially verified:** fresh/returning/storage-denied behavior is source-backed
  and has related historical tests, but no new browser execution occurred here.
- **Unverified:** article→app measurement completeness. `share_open` is deliberately
  not an exhaustive arrival counter; analytics privacy/consent/adblock restrictions
  further limit observability. Never transmit raw custom seed/name/hash data.
- Proposed optional richer deep-link capability is a separately scoped app feature;
  it is not a prerequisite to a truthful instrument-link pilot.

Module SHA256s at inspection: core `2aa04fadaa170ea389fc2a9575ebacc38293421a88084b4bcd5b2fc10130533c`;
select `e94514912ea010049075df881036646c5b1a1820df6de64a1639226d120cf497`;
share `758fce7d6a9c6d837284274d8aa4ed4d51c1342a5f9be50f2ccd37f6476b6e84`;
sequence `62ca3b681d0499ea7e08ef7438ee3ed0aa6f36e0aa0e9a70fb7c0a7fcf043eec`.
