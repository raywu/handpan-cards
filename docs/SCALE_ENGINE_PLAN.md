<!-- Promoted from the 2026-09 planning session and AMENDED after a third
     adversarial review (2026-09-08, post-retrofit). This is the reviewed,
     owner-decided plan for the user-configurable-scale feature. It has NOT
     been built. Findings marked [verified] were reproduced against the data
     on main at afd52a7 with tools/research/engine_measure/ - re-run those
     scripts rather than trusting a number. The OWNER DECISIONS table is
     binding. D6, D9 and D10 were DECIDED by the owner on 2026-09-08; no
     entry is pending. Engineering review (/plan-eng-review, 2026-09-08) folded
     19 accepted decisions in; each is tagged [eng-review]. -->

# Plan: user-configurable scales -> generated chord flashcards

Implementation plan for the swarm. Read `CLAUDE.md` and `tests/CONTRACT.md`
first. Every number below was re-measured after the voicing retrofit (PR #5);
the earlier draft's pre-retrofit figures have been removed, not annotated.

## The goal

Let a user define their own handpan - enter the notes (ding, top tonefields,
optional bottom notes), name the scale - and get the same chord flashcards the
three built-in decks produce today, generated automatically.

## Premise 1: there is no engine

All 59 chords are hand-authored literal tuples in `tools/decks.py`. The "voicing
rules" in CLAUDE.md are prose describing how humans curated them. Nothing derives
a chord from a set of notes. The work is to BUILD the engine, then expose it.

## Premise 2: the voicing rule now reproduces the corpus; register tie-breaks and root octave do not [verified]

After the retrofit all three decks obey one convention (CLAUDE.md rule 3, D2),
enforced by `tests/test_deck_data.py::test_forced_tones_cluster_below_root`.
Measured with `t1_cluster.py` / `t8_combined.py`, giving the engine the root
FIELD, the spelling order of pitch classes and the chord symbol:

| reading of rule 3 | curated voicing reproduced |
|---|---|
| as worded (unforced tones: any instance above the root) | 59/59 contained |
| strict (unforced tones: NEAREST instance above the root) | 58/59 |

The one strict divergence is Pygmy `Fm9` (curated G5, nearest-above says G4),
which CLAUDE.md names as a permitted free choice. The rule fully DETERMINES only
38/59 voicings; the other 21 (all unforced cards on pans with duplicated pitch
classes) have 2-9 permitted registers. So the engine needs a register tie-break,
and "nearest instance above the root" is the right default: it reproduces 20 of
those 21 with `Fm9` recorded as the single exception.

Forced cards (12): Hijaz `Bm`(high), `F#sus4`, `F#maj7sus4`, `Dmaj7`,
`Dmaj7#11`; Pygmy `Fsus4`, `Fm11`, `Cm7`, `Eb`; Amara `G5`, `Gsus4`, `Fmaj7`.
These are also exactly the 12 cards whose root is not the bass note.

Consequences:

1. **Containment stays the Phase 1 gate** - the engine's legal candidate set
   must contain every curated voicing. [verified] 59/59 contained; candidate
   sets range from 1 to 162 (Pygmy `Fm11`), median 4.
2. **No per-deck `downward_policy`.** D2 is the rule for built-ins and generated
   decks alike. Do not build a policy parameter.
3. **Voicing exceptions: one** (`Fm9` register). Root-octave exceptions are
   listed under Premise 3. There is no other exception list to commit.
4. **Match rate is not a headline metric.** The Phase 2 output is a committed
   divergence table, diffed like the PDF-staleness test, with no numeric
   expectation asserted in a test.

## Premise 3: root-octave selection is the real open problem [verified]

Given only (root pitch class, interval set) the engine must pick the root
FIELD. Scored over the 54 primary cards (`t2_root.py`; the five HIGH/LOW VOICING
alternates are unreachable by any function of that input):

| policy | primary cards reproduced |
|---|---|
| lowest instance | 47/54 |
| **lowest top-shell instance, else lowest** | **51/54** |
| most chord tones above the root | 47/54 |
| highest instance | 24/54 |

The three misses of the recommended policy are all Pygmy bottom-shell roots:
`Db` and `Dbmaj7` (curated Db4 = U5, the only instances are on the bottom
shell and the curated one is the higher), and `Eb7` (curated Eb3, bottom,
although Eb4 on the rim exists). `Eb` (Eb4) vs `Eb7` (Eb3) share a root pitch
class and are provably contradictory for any rule based on forcedness. A fitted
three-clause policy reaches 54/54 and is rejected as overfitting.

Combined with the strict cluster rule, "lowest top-shell instance" reproduces
**50/59 cards fully automatically**, with 8 root-octave misses (5 of them the
alternates) and the `Fm9` register.

## Premise 4: chord selection is a separate, mostly editorial problem [verified]

Under the D1 vocabulary (major, minor, dim, aug, power, sus4, maj7, m7, dom7,
m7b5, dim7 - 11 qualities), measured by `t4_selection.py`:

| deck | derivable (root pc x quality) | distinct pc-sets | root-instance x quality | shipped | shipped inside D1 |
|---|---|---|---|---|---|
| Hijaz | 17 | 14 | 24 | 18 | 11 |
| Pygmy | 25 | 25 | 60 | 25 | 22 |
| Amara | 16 | 16 | 23 | 16 | 16 |

**Amara ships exactly the D1-derivable set** - nothing omitted, nothing outside
it - so D1 is a real convention, not a guess. Hijaz omits three of four
diminished triads, all dim7 spellings but one, and `F#5`, and ships seven cards
outside D1 (`C#7sus4`, `C#7b9`, `Bmadd9`, `Bm6/9`, `F#maj7sus4`, `Dmaj7`,
`Dmaj7#11`). Pygmy omits four power chords and three sus4 and ships `Fm9`,
`Fm11`, `Abmaj9`. Under D1 a 9-note pan yields 16-17 candidates and Pygmy 25,
so the cap only bites beyond Pygmy's size. The extended and altered chords the
owner added by hand are per-deck editorial overrides, committed as data.

Two selection rules hold across all three decks and are mechanical: sus2
collapses into sus4, and 6 / m6 collapse into m7 / m7b5.

## Premise 5: "root position" is spelling order, not register [verified]

Twelve of 59 voicings do not have the root in the bass (the forced cards in
Premise 2). A bass-note constraint fails a fifth of the corpus. CLAUDE.md rule 3
already states this; it is repeated here because an implementer who skims the
chord-name will assume otherwise.

## OWNER DECISIONS (locked - do not re-litigate)

| # | Decision | Consequence for the engine |
|---|---|---|
| D1 | **Core drill deck, ~18-25 cards.** Triads, power chords, sus4, and 7ths (maj7/m7/dom7/m7b5/dim7). Extended chords only where the scale makes them obvious. | Sets the default quality vocabulary and the cap. [verified] Amara ships exactly this set. |
| D2 | **Cluster rule, scoped to chord tones** (CLAUDE.md rule 3). When any non-root tone is forced below the root, every chord tone (3/5/7, sus 4th, 6-chord 6th) moves to its highest lower instance; a tone with no lower instance stays put; extensions named in the symbol (add9/9/b9/11/#11/13) keep their nearest instance above the root unless themselves forced; bottom-shell fields are ordinary instances. | One rule for built-ins and generated decks. The owner retrofitted Hijaz and Pygmy to it (6 cards net). Operative "forced" test is ANY non-root tone including extensions, as `test_deck_data.py` implements it (Fm11 is forced by its 11th). |
| D3 | **No custom-scale PDFs in v1.** App only; `tools/gen_deck.js` and the Python adapter are Phase 6. | The print card's limits (6-note voicings, 25-char subtitles) still bound the engine - see Rendering budgets. |
| D4 | **Equivalence annotations are a per-card override field.** Built-ins keep exactly the two they ship, frozen as data; custom scales derive them mechanically under the m7/m7b5 -> X6/Xm6 definition. | No deck-data change, no PDF rebuild. The five unannotated eligible cards (Pygmy Gm7b5/Fm7/Cm7, Amara Dm7/Am7) are provenance, not bugs. |
| D5 | **Stay vanilla.** No framework, no CDN script, no build step. | See "Engine integration": engine source lives in `src/engine/`, is copied verbatim into `index.html` by a sync step, and a desync check keeps the two identical - the same pattern the DECKS literal already uses. |
| D6 | **Custom deck colours come from a fixed owner-approved palette set** (user picks, or assigned by hash of the scale name). | The share URL carries a palette INDEX, never a colour string. **DECIDED 2026-09-08:** the set is the three built-in pairs plus their root/tone swaps (6 entries, index 0-5 in that order: Hijaz, Pygmy, Amara, then the swaps). Not provisional; extending the set later appends indices and never renumbers. Needed by Phase 3, not before. |
| D7 | **Spill to an inner ring past the rim ceiling.** | [verified] tangent ceiling `pi/asin(r_note/rim)` = 12.18 at Hijaz/Amara proportions, 15.81 at Pygmy's; stroke-aware (0.65pt rings at print size) it is ~11.9, so **11 rim fields** is the practical cap. Do NOT shrink fields to fit. See D12 for the inner-ring cap. |
| D8 | **Degree NUMERALS are mode-aware**: minor-relative (`III`, `VII`) for scales with a minor third, major-relative with flats (`bIII`, `bVII`) otherwise. | [verified] Hijaz 5/5, Pygmy 7/7 fall out; **D Amara is the frozen exception** (ships `bIII`/`bVII` from the commercial deck). Fallback for no-third and symmetric sets: major-relative with flats. |
| D9 | **Root-octave default: lowest top-shell instance, else lowest.** DECIDED 2026-09-08. | 51/54 primaries. Pygmy `Db`, `Dbmaj7`, `Eb7` are recorded divergences of the built-in fixture, not engine bugs. |
| D10 | **Degree CASE comes from stacked thirds over a parent scale**, not from the pan alone. DECIDED 2026-09-08: **D Amara is declared Aeolian** (hexatonic sub-scale of D natural minor with the b6 omitted, per the owner's music-theory rationale), so **Amara `IV` is a second frozen exception** alongside the D8 numerals. | [verified] No pan-only rule separates Hijaz `iv` from Amara `IV`. Stacked thirds over a 7-note parent reproduce 16/17 labels (Hijaz Phrygian dominant, Pygmy Aeolian, Amara Aeolian); Amara `G` derives as `iv` and ships as `IV` from the frozen list. Custom scales: the engine infers the nearest 7-note mode and the scale form exposes a parent-scale picker to override it; the share URL carries the chosen parent; scales with no usable parent use uppercase. |
| D11 | **Register tie-break for unforced tones: nearest instance above the root.** | 20/21 under-determined cards; `Fm9` (G5) is the single recorded voicing exception. |
| D12 | **Layout default = Pygmy pattern, mirrored right-first**, generalised: ding enlarged and offset toward the player (`r=0.19R`, `dy=0.1425R`); rim zig-zag ascending from bottom-right (~290 deg) toward top centre, right-first; inner ring holds at most 2 notes at ~128/~52 deg ascending opposite to the rim; bottom notes as a dashed outer x-ray ring, at most 6; beyond 11 rim + 2 inner + 6 bottom the scale is rejected with a reason. | A default, not a measurement. Never retro-applied to the built-ins (Hijaz and Amara are verified left-first). The geometry solver applies to GENERATED decks only; built-in `geom` literals bypass it, so "built-ins render identically" stays trivially true. [eng-review 17B, amended by design-review 3A] The first time a deck is generated, the message region shows a one-time hint, "Layout is a guess. Tap LEFT-FIRST / RIGHT-FIRST if your pan is mirrored."; nothing is printed on the cards themselves. The left-first/right-first **mirror toggle** (one boolean in the seed) moves from Phase 5 into Phase 3 as a two-button `.mode` pair in the sheet. |

| D13 | **Input is a freeform scale string, not a per-note form.** DECIDED 2026-09-08. One text box takes maker notation: a mandatory ding as `(C#)` or `D/` [review 2026-09-08: mandatory, `NO_DING` otherwise], then the top notes in ascending zig-zag order, optional `\|` followed by bottom notes; octaves are inferred (ding lowest of the top shell, each next top note the next instance above the previous; after `\|` inference restarts from the bottom note nearest the ding, since bottom notes may sit below it, e.g. Pygmy `C3 Db3 Eb3`) and an explicit octave anywhere (`C#4`) overrides inference. **AMENDED by design-review 2026-09-08: no provenance URL anywhere.** There is no URL field, nothing is stored or shown; a pasted vendor link is a `BAD_NOTE` rejection like any other token (fetching was never on the table: CORS on Pages, absent under `file://`, a proxy breaks D5). | The grammar and octave inference live in `src/engine/core.js` (P0d) with their own tests; the seed the URL encodes is the parsed result, not the raw string, and `core.formatSeed` prints a seed back into the grammar (design-review 8A). The create path shows only the box, the mirror pair (D12) and the palette swatches (D6); the parent-scale override (D10) lives in the Edit sheet, never on the create path. |
| D14 | **Seed is the contract; per-card state keys on a stable card key.** Old links render NEW cards when the engine improves. Any future per-card state (the roadmap's spaced repetition) keys on `(deck id, fields list)` [review 2026-09-08 D4: `main + sup` is not unique on the built-ins, e.g. Pygmy `Cm` x3], never on list index, so a regenerated deck keeps progress for every chord that still exists. | **AMENDED [eng-review 2, 1A]:** custom deck id = `custom:` + hash of `core.formatSeed(fields)` **only** (notes, octaves, zones, order). Palette, mirror, parent override and name are seed OPTIONS outside the id, so renaming, recolouring, flipping the mirror or overriding the parent keeps the id and every card's progress (the parent changes degree labels only, never the fields list). The id is computable in Phase 3 from P0d alone; the Phase 4 share encoding carries the options beside the fields and never feeds the hash. A Phase 4 test asserts the id is a pure function of `formatSeed(fields)` with `select.build` never consulted (spy); a second test changes every option and asserts the id is unchanged. |

## Architecture: do not migrate the built-ins

- The three decks are physically verified, owner-curated, and CLAUDE.md forbids
  changing them. Re-deriving them is pure risk for zero product value.
- `tools/decks.py` stays hand-authored **permanently**. The 59 cards become a
  frozen one-way comparison fixture, never data the engine replaces.
- `tools/validate.py` stays a genuine cross-check rather than a generator
  comparing against itself.
- Custom-scale PDFs (Phase 6): `tools/gen_deck.js` emits one deck JSON; a small
  adapter in `decks.py` consumes it. Node becomes a dependency only for custom
  PDFs. Watch the int-vs-string field-key boundary: `validate.py` does
  `spec[int(fid)]` and `hifi.draw_pan` iterates integer keys.

Rejected: porting the engine to both languages; client-side PDF (a third card
renderer that cannot honour the 62.65 x 87.21 mm spec across browser print
scaling); a build-on-demand GitHub Action (needs authenticated dispatch).

## Engine integration with the single-file app [decided by D5]

The engine is authored in `src/engine/*.js` as plain scripts, one per lane:

```
var HPE = HPE || {};
HPE.voicing = (function () { /* pure functions, no DOM, no imports */ return api; })();
if (typeof module !== "undefined") module.exports = HPE.voicing;
```

No `import`/`export`/`require` at top level, no DOM access. Node tests
`require()` the file directly. At runtime the SAME bytes sit inside
`index.html` in their own `<script>` blocks placed before the app script,
between `<!-- engine:voicing -->` ... `<!-- /engine:voicing -->` markers.
`tools/inline_engine.py` (Phase 3) copies each file into its region;
`tools/validate.py` gains a byte-exact region-equals-file check mirroring the
existing DECKS desync check. This is a sync step, like the JSON re-injection,
not a build step: `index.html` stays independently functional, zero-dependency,
and the future PWA precache list (roadmap item 3; nothing exists yet) is `[index.html]`. Phase 1 lanes never touch
`index.html`; the sandbox must therefore execute ALL `<script>` blocks in
document order (P0c), because a second block makes today's greedy single-block
regex throw.

**Module composition in Node [eng-review 2A].** The pattern forbids `require`,
so `select.js` cannot reach `HPE.voicing` through `require()` (each file would
get its own module-scoped `HPE`). P0c adds `tests/helpers/engine.js`: it reads
`src/engine/*.js` in a fixed dependency order (`core`, `voicing`, `naming`,
`layout`, `select`, `share`) into ONE `node:vm` context and returns `HPE`.
Tests use the loader and never `require()` an engine file directly. The same
bytes execute the same way in both hosts.

**One validator, two doors [eng-review 3A].** Input validation lives in the
engine (`HPE.core.parseSeed` returning the result shape below), and BOTH the
Phase 3 text box and the Phase 4 URL decoder call it. There is no form-side or
decoder-side whitelist of its own.

**One result contract [eng-review 7A].** Every public engine entry point returns
`{ok: true, value}` or `{ok: false, code, reason}` and never throws on user
input. `code` is a short stable enum (`NO_DING`, `NO_FIFTH`, `TOO_MANY_RIM`,
`BAD_NOTE`, `NEEDS_NEWER_APP`, ...); `reason` is the English sentence the UI
shows. The UI has exactly one adapter from this shape to the message area.

**Data flow [eng-review 5A]:**

```
 text box ("(C#) G# B ... | C3 Db3")      #s=<version byte><seed bytes>
        |                                          |
        v                                          v
   core.parseSeed  <-------------------------  share.decode
        | {ok, value: seed}   (one validator; rejects, never repairs)
        v
   layout.solve(seed) --> geom + fields          (D12; built-ins bypass)
        |
        v
   select.build(seed, fields) --- voicing.pick (D2, D11); D9 root octave in select
        |                      \-- naming.name  (D1 table, D8, D10)
        v
   deck object {id: "custom:" + hash(formatSeed(fields)), name, options
                {palette, mirror, parent}, colors, degrees, geom, fields,
                chords[], warnings[]}          <- shape fixed in ENGINE-SPEC (P0a)
        |                                   \
        v                                    v
   registry (generated decks, built once)   share.encode(seed) -> URL
        |
        v
   existing renderer: render() / pan() / bottom lines   (unchanged)
```

`select.js` (pipeline) and `layout.js` (solver) carry an inline ASCII diagram
comment when built.

## The engine must also decide these [verified problems, not open questions]

- **Root selection under ambiguity.** Hijaz `D°7` = {D,F,G#,B} has four equally
  valid roots. Enharmonic chord-tone spelling is out of scope - cards print
  field labels. Disambiguation already in the data: prefer sus4 over sus2, m7
  over 6, m7b5 over m6. Accidental convention is per-scale from the tonic
  (Hijaz sharps, Pygmy flats, Amara naturals); custom scales use the user's
  typed spellings verbatim.
- **Scale degrees.** Tonic = ding pitch class in all three decks. Numerals per
  D8, case per D10.
- **Equivalence annotations.** Decided: D4.
- **Multi-voicing is opt-in data, not a policy.** 30 shipped chord types have
  more usable root instances (ding excluded, bottom shell included; 26 with it
  excluded) than shipped cards; only 4 groups (9 cards) got alternates, with no
  distinguishing feature. Default one card; record the 9 built-in alternates as
  data.
- **Card order is editorial.** Root order differs per deck and within-root
  order is inconsistent inside a single deck. PDFs lay out in list order, so
  order is part of the golden output. Canonical order for generated decks
  (swarm default, flagged): roots by scale degree from the tonic; within a root
  triad, power, sus4, 7th, extended. Built-ins untouched.

## Rendering budgets are hard engine constraints [verified]

`hifi.bottom_lines` shrinks the note line to a 4.4pt floor and the number line
to 4.2pt, then draws regardless of fit; `card_header` fits the subtitle to a
3.6pt floor with the same behaviour; `fit_note` (diagram labels) floors at
**2.5pt**. Current maxima are 6 notes (Pygmy `Fm11`) and 25 characters
(`HALF-DIMINISHED ( = Bm6 )`, `D MAJOR 7 SHARP 11 (NO 5)`). A generated 10-note
pan yields 7-note voicings and subtitles that silently clip. Max notes per
voicing and max subtitle length are engine constraints with tests.

**`pan()` does not generalise [verified]:** `g.inner` and `g.bottom` exist only
on Pygmy, so a generated deck missing them yields `NaN` for those zones and a
missing `g.n_in` NaNs every number; `ext` is hardcoded `R*1.06`. The app has no
label auto-fit while the print pipeline does, masked today by hand-tuned
per-deck `f_note`; `test_render_agreement.py` never compares diagram label font
size. The geometry solver must always emit the full geom shape (zeroes, not
missing keys), derive `ext` from the furthest drawn element FOR GENERATED DECKS
ONLY (a derived `ext` would rescale every built-in diagram), and `r_note`,
`f_note`, `f_num`, `n_in`, `n_out` become functions of N with the D12 spill.

## Sharing is untrusted input [verified - security]

`esc()` escapes only `&` and `<`, never `"`, and colour, label and octave values
reach SVG and style attributes without passing through `esc()` at all.
Demonstrated: `#000" onload="alert(1)` breaks out of `stroke="..."`. Safe today
only because deck data is a committed literal; a shared `#s=...` link is exactly
the delivery vector. Required: a decoder that validates every value against a
whitelist (MIDI 0-127, zone enum, angle 0-359, palette index in range, capped
name length and charset) and **rejects rather than repairs**; colours never come
from the URL (D6). [eng-review 3A] That decoder is `share.decode` calling the
SAME `core.parseSeed` the text box uses; see "One validator, two doors".

**Encoding [verified sizes]:** encoding the output deck costs ~1.2 kB of URL
(Pygmy: 3,143 bytes compact JSON, 1,239 chars base64url-of-gzip) and freezes
generator output into the link. Encoding the **seed** (17 MIDI + ding + name as
JSON) costs 87 bytes -> 116 chars; a binary seed is smaller. Mandate seed
encoding with a leading **version byte**, reserve space for Phase-5 layout
deltas, and answer explicitly: when the engine improves, an old link renders
NEW cards (the seed is the contract, not the output). Note `node:vm` has no
`CompressionStream`, `btoa` or `TextEncoder`; the encoder must be pure JS or
the sandbox must stub them (P0c).

**`localStorage` [verified]:** `save()` is an unconditional whole-key overwrite
of `hpfc`; any sibling field is destroyed on the next deck or mode change and no
test catches it. Change to read-modify-write merge, put saved scales under a
separate key, add a test plus mutant for "an unrelated sibling field survives a
save" (Phase 4).

## THE SWARM

Exclusive file ownership per lane; no two lanes write the same path. Phases are
serial; lanes inside a phase are parallel.

### Operating rules for every lane

- **One git worktree per lane** and a distinct `E2E_PORT` per lane:
  `mutation_check.sh` mutates the working tree in place and `e2e.test.js`
  binds a fixed port, so lanes sharing a checkout serialise or corrupt each
  other.
- **The mutation gate runs on a clean tree, pre-push,** and in CI on the clean
  checkout. It refuses a dirty tree by design; that refusal is local-only.
- **Test files are `tests/<name>.test.js`** (the runners, `suite_health.py` and
  CI glob `tests/*.test.js`) or `tests/test_<name>.py`. A file named
  `tests/test_x.js` is silently never run.
- **Suite-health floors trail tests.** Each lane raises `suite_health.py`
  floors in the same PR that adds the tests, never ahead of them.
  [eng-review 1A] The three module constants become a **per-file floor table**
  (`FLOORS = {"tests/app.test.js": 12, ...}`) converted by P0c; a lane adds
  ONE row for its own test file, so no two lanes edit the same line and the
  aggregate floor is the sum. This also delivers the per-file floor Phase 1
  already asks for.
- **Spec rules are tagged** `DECIDED(D-number or CLAUDE.md cite)` or
  `DEFAULT[owner-review]`. Lanes proceed on DEFAULTs. Changing a DEFAULT later
  is a spec change handled by CONTRACT rule 4, not a reason to stall.
- **Every phase that edits `index.html` budgets mutant regeneration:** the
  `d_*`/`e_*` mutants are line-anchored on the app script; `b_*` regenerate via
  `tools/regen_data_mutants.py`.
- Mutant patches carry `# kills: <test name>` and, for new prefixes,
  `# suite: <command>` so `mutation_check.sh` selects the suite from the header
  rather than from a hardcoded prefix table.

### Acceptance commands per lane [swarm-ready, 2026-09-08]

The integrator writes these into each lane's brief verbatim (coordination
contract rule 9: the lane does not own its oracle). Every lane's local run is a
smoke test; **CI at the verified head SHA of the lane's PR is the evidence.**
`ALL` is the baseline every lane must pass and is what CI runs:

```
ALL = python3 tools/validate.py && node tools/boot_sim.js \
   && python3 -m unittest discover -s tests -t . \
   && node --test tests/*.test.js \
   && python3 tests/suite_health.py \
   && ./tests/mutation_check.sh
```

| Lane | Acceptance (all must hold) | Command |
|---|---|---|
| P0a | `docs/ENGINE-SPEC.md`, `tests/fixtures/qualities.json`, `tests/fixtures/synthetic_scales.json` exist; both fixtures parse; every spec rule carries a `DECIDED(...)` or `DEFAULT[owner-review]` tag; every result code and warning code named in this plan appears in the spec | `ALL && python3 -c "import json;json.load(open('tests/fixtures/qualities.json'));json.load(open('tests/fixtures/synthetic_scales.json'))" && ! grep -nE '^- ' docs/ENGINE-SPEC.md \| grep -vE 'DECIDED\(\|DEFAULT\[owner-review\]' && for c in NO_DING NO_FIFTH TOO_MANY_RIM BAD_NOTE NEEDS_NEWER_APP NO_THIRDS; do grep -q "$c" docs/ENGINE-SPEC.md \|\| exit 1; done` |
| P0b | `tests/fixtures/golden_decks_v1.json` equals the 59 built-in cards byte-for-byte; `tests/test_fixture_integrity.py` runs and its mutant kills it | `ALL && python3 -m unittest tests.test_fixture_integrity && ./tests/mutation_check.sh 2>&1 \| grep -q 'f_.*killed'` |
| P0c | Floor table exists with one row per test file; `# suite:` header selects the suite; mutation gate still passes with every existing mutant; the three legacy floors are unchanged in aggregate | `ALL && python3 -c "import tests.suite_health as h;assert isinstance(h.FLOORS,dict) and 'tests/app.test.js' in h.FLOORS" && grep -q 'suite:' tests/mutation_check.sh` |
| P0d | `src/engine/core.js` loads under `node:vm`; `tests/core.test.js` green; the three built-in maker strings parse to the fixture fields; `parseSeed(formatSeed(x))` round-trips every synthetic entry; `deckId` stable across options; every `u_*` mutant kills its named test; floor row for `tests/core.test.js` > 0 | `ALL && node --test tests/core.test.js && ./tests/mutation_check.sh 2>&1 \| grep -E '^u_' \| grep -vq survived` |
| 1A voicing | `tests/voicing.test.js` green; containment 59/59 and voicing 58/59 with `Fm9` the declared two-sided exception; `v_*` mutants all killed; floor row > 0 | `ALL && node --test tests/voicing.test.js && ./tests/mutation_check.sh 2>&1 \| grep -E '^v_' \| grep -vq survived` |
| 1B layout | `tests/layout.test.js` green; no overlap and all fields inside `ext` for every synthetic N; rejection beyond the caps; `g_*` mutants all killed; floor row > 0 | `ALL && node --test tests/layout.test.js && ./tests/mutation_check.sh 2>&1 \| grep -E '^g_' \| grep -vq survived` |
| 1C naming | `tests/naming.test.js` green; fixture `main`/`sup`/degree labels reproduced modulo the recorded exception list; `n_*` mutants all killed; floor row > 0 | `ALL && node --test tests/naming.test.js && ./tests/mutation_check.sh 2>&1 \| grep -E '^n_' \| grep -vq survived` |
| 2 select | `tests/select.test.js` green; `tests/fixtures/divergence_v1.json` committed and the diff test passes; cap, ranking, dedup and `NO_THIRDS` each killed by an `s_*` mutant; floor row > 0 | `ALL && node --test tests/select.test.js && ./tests/mutation_check.sh 2>&1 \| grep -E '^s_' \| grep -vq survived` |
| 3a, 3b app | Engine inlined and `index.html` still single-file with no `<script src>`; `tools/validate.py` handles a fourth deck; the 380 px e2e cases and the sandbox sheet tests pass; every regenerated `d_*`/`e_*`/`b_*` mutant killed; `git diff --stat main -- index.html` is the only app-file change | `ALL && ! grep -q '<script src' index.html && node --test tests/app.test.js tests/e2e.test.js && python3 tools/regen_data_mutants.py --check` |
| 4 share | `tests/share.test.js` green; encode/decode round-trip; `NEEDS_NEWER_APP`, flipped-byte and over-cap rejections; `hpfc` sibling-survival test; Edit sheet tests; share-prefix mutants all killed | `ALL && node --test tests/share.test.js tests/app.test.js tests/e2e.test.js` |
| 5, 6 | written when the phase is reached (Phase 4 exit is the gate) | n/a |

`python3 tools/regen_data_mutants.py --check` is a P0c deliverable: exit non-zero
when the `b_*` mutants no longer apply to the current `DECKS` line. Until it
exists Phase 3 runs the regeneration and commits the result.

### Phase 0 - unblocks everything, ships nothing (P0a, P0b, P0c in parallel: disjoint ownership; P0d SERIAL after all three)

| Lane | Scope | Owns |
|---|---|---|
| **P0a** | Engine spec: legality invariants, D2 cluster rule with the operative ANY-non-root-tone forced test, D9 root-octave, D11 register tie-break, D1 vocabulary + cap + ranking, naming disambiguation, D8/D10 degrees, canonical order, the two recorded exceptions (`Fm9` register; Pygmy `Db`/`Dbmaj7`/`Eb7` root octave) and the 5 alternates. Every rule tagged DECIDED or DEFAULT. The quality -> interval table and display strings live in a fixture, not in the engine's exports, so tests never import from the module under test (CONTRACT rule 2). [eng-review 6A] The fixture is the SPEC; `naming.js` carries its own literal, and one lane-C test asserts deep equality (a mutant flips one interval); P0c adds the CONTRACT rule 2 carve-out "comparing a module's exported table to the spec fixture is allowed". [eng-review 7A] Specifies the `{ok, value | code, reason}` result contract for every entry point; [design-review 2A] an ok result may carry `warnings: [{code, reason}]` (e.g. `NO_THIRDS`, "Only power chords: no 3rds on this pan") which the UI shows in the warning tier and never blocks on. [eng-review 2, 2A] Warnings have ONE producer, `select.build`; the registry copies them onto `deck.warnings` at generation time (submit in Phase 3, decode in Phase 4), and every reader (success message, Edit sheet) reads `deck.warnings`. Nothing regenerates to re-derive them. The warning reason strings sit in the same enum fixture as the error reasons. P0a also fixes the generated deck object shape (`id, name, options{palette, mirror, parent}, colors, degrees, geom, fields, chords[], warnings[]` with `chords[] = {main, sup, subtitle, fields[], roots[]}` exactly as the built-ins, since `render()` reads `subtitle` and `roots[0]`) so Phase 2 produces it and Phase 3 consumes it without an unstated handoff. [eng-review 16A] Specifies D10 inference as DEFAULT[owner-review]: candidate parents = the 7 diatonic modes plus harmonic minor, melodic minor, Phrygian dominant and harmonic major (fixed list order); distance = pan pitch classes outside the parent; ties -> fewest modal alterations, then list order; the override is encoded as an index into that list; tonic = ding pitch class (the ding is mandatory, so there is no fallback). [eng-review 9A] Owns `tests/fixtures/synthetic_scales.json`: a 12-note pan, the 19-field maximum with duplicate-heavy pitch classes, a whole-tone subset (expect `NO_FIFTH`), an octatonic diminished set, an augmented hexatonic set, a 3-pitch-class pan `{C, G, D}` (expect ok + `NO_THIRDS`), no ding (expect `NO_DING`), ding pitch class absent from the top shell; every lane asserts its invariants over the entries whose `expect` is ok. Fixture schema: `{name, string, expect: {ok: true, warnings?: [code]} | {code}, tags: []}`. Lane B generates its own N=5..19 sweep from the 12-note and 19-field entries rather than expecting one in the fixture. Owner review is a gate AFTER Phase 1, not before. | `docs/ENGINE-SPEC.md`, `tests/fixtures/qualities.json`, `tests/fixtures/parents.json`, `tests/fixtures/synthetic_scales.json` |
| **P0b** | Freeze the corpus: extract the 59 cards from `afd52a7` (post-retrofit) - and, per deck, `fields`, `degrees`, `colors` and `geom`, so no engine test reads the live `DECKS` literal [eng-review TODO 1] - into a fixture with a SHA-256 self-assertion over a canonical serialisation (`sort_keys`, fixed separators) so it can never be quietly regenerated from the engine or broken by a reformat. Ships `tests/mutants/f_fixture_sha.patch` with a `# suite: python3 -m unittest tests.test_fixture_integrity` header (needs P0c's header selection, so P0b's mutant is verified in P0c's PR), and a one-way assertion that the fixture chords equal `paths.app_decks()` so an owner-approved data change fails loudly. | `tests/fixtures/golden_decks_v1.json`, `tests/test_fixture_integrity.py`, `tests/mutants/f_*` |
| **P0c** | Harness prep. `sandbox.js`: execute ALL `<script>` blocks in document order; add `location`, `URL`, `btoa`/`atob`, `history`, `TextEncoder`/`TextDecoder`, `setTimeout`, `structuredClone`, `document.querySelector`, and `createElement` stubs with `value`/`setAttribute`/`dataset`; keep `getElementById` strict but extensible; keep `tools/boot_sim.js` and `tests/helpers/dump_app_render.js` green. `mutation_check.sh`: revert with `git apply -R` instead of the fixed `TRACKED` list (a `src/engine` mutant is otherwise never reverted and contaminates the sweep); [eng-review TODO 3] also discard anything a suite WROTE while the mutant was applied (`git checkout --` plus `git clean -fd` scoped to the paths the patch names, never the whole tree) and assert a clean tree after every mutant; dirty check over the files each patch names; header-driven `# suite:` selection for any prefix (a `# suite:` header always wins over the prefix table, so new prefixes such as `h_*` need no script change). Converts the `suite_health.py` constants into the per-file floor table (1A) without raising any floor, and pre-seeds rows at 0 for `tests/core.test.js`, `tests/voicing.test.js`, `tests/layout.test.js`, `tests/naming.test.js`, `tests/select.test.js`, `tests/share.test.js` so later lanes change only their own number and never insert lines [review 2026-09-08 F6]. Adds `tests/helpers/engine.js` (2A). `CONTRACT.md`: rule 2's "CI greps for this" is deleted (no mechanical grep exists for a `node:vm` global) and the rule-2 carve-out above is added; rule 4's diff list gains `src/engine/**`; rule 5 is scoped to test-only PRs. Do NOT raise floors here. | `tests/helpers/sandbox.js`, `tests/helpers/engine.js`, `tests/mutation_check.sh`, `tests/suite_health.py`, `tests/CONTRACT.md`, `.github/workflows/validate.yml` |
| **P0d** | [eng-review 14A] **Shared core, SERIAL after P0a-c.** `src/engine/core.js`: pitch class, MIDI from note name, interval math, the D13 scale-string grammar with octave inference and explicit-octave override, `parseSeed` (the one validator: MIDI 0-127, zone enum, angle 0-359, palette index 0-5, parent index, name length and charset, exactly one ding, no duplicate fields) and **zone assignment** [review 2026-09-08 D3]: top notes ascend; the first up to 11 (D7 rim cap) are `rim`, the next up to 2 are `inner`, a 14th top note is `TOO_MANY_RIM`; notes after `\|` are `bottom`, at most 6. `layout.solve` never changes zones, so the deck id (D14) never depends on layout code); `parseSeed` returns the 7A result shape, and [design-review 8A] `formatSeed` printing a seed back into the D13 grammar with explicit octaves (`(D3) A3 C4 D4 E4 F4 G4 A4 C5`, bottom notes after `|`) so the Edit sheet can show the canonical string, and `deckId(fields)` = `custom:` + a stable hash of that string (D14 as amended; the hash is a fixed non-cryptographic function specified in ENGINE-SPEC, same result in Node and the browser). Exit: parses the three built-in pans from their maker strings (recorded in the P0b fixture, bottom notes with explicit octaves where inference would not reproduce them, e.g. Pygmy `Ab5`) to the fixture's fields on `name, octave, midi, zone, label` (`angle` is lane B's output and excluded); `parseSeed(formatSeed(seed))` deep-equals `seed` for every synthetic fixture entry including one with bottom notes after `|` (one mutant drops the octave from the ding, one drops the `|`); `deckId` is unchanged across every option change and differs for any field change (one mutant hashes the palette too); every synthetic seed parses or rejects with the expected code; one mutant per group. | `src/engine/core.js`, `tests/core.test.js`, `tests/mutants/u_*` |

### Phase 1 - engine core (PARALLEL; never touches `index.html`)

| Lane | Scope | Owns |
|---|---|---|
| **A** | **Legality + voicing.** Enumerate legal voicings for (root field, interval set): no ding, no doubled pitch classes, power chords = 2 notes; apply D2 + D11 to pick one; a voicing never exceeds 6 notes (the print floor, line "Max notes per" below), so an 11th/13th drops its lowest optional extension first. Exit: containment - every one of the 59 fixture tuples is in its candidate set [verified satisfiable] - and the chosen voicing equals the fixture for 58/59 with `Fm9` as the declared exception (two-sided: the exception must still diverge). | `src/engine/voicing.js`, `tests/voicing.test.js`, `tests/mutants/v_*` |
| **B** | **Geometry solver** per D12: `r_note`/`f_note`/`f_num`/`n_in`/`n_out` as functions of N, rim ceiling, inner-ring and bottom-ring caps, rejection beyond them, full geom shape always emitted, `ext` from the furthest element. Exit (pure geometry, app-side only; print is Phase 6): for synthetic scales at N=5..19, no two field circles closer than r1+r2, every element inside `ext`, the inner pair ascends opposite the rim, (the built-ins never call the solver, so there is no passthrough to test). | `src/engine/layout.js`, `tests/layout.test.js`, `tests/mutants/g_*` |
| **C** | **Namer + degrees.** Quality naming from the fixture table (`tests/fixtures/qualities.json`) and parents from `tests/fixtures/parents.json` (P0a: candidate list order, intervals, short display name), symmetric-set root tie-break (default: prefer tonic, else lowest scale degree), sus4-over-sus2 and m7-over-6 rules, per-scale accidental convention, D8 numerals, D10 case. Exit: reproduces fixture `main`/`sup`/`subtitle` and every degree label (subtitles modulo the editorial strings HIJAZ SIGNATURE CHORD, HIGH/LOW VOICING and the two `( = X6 )` equivalences, which are recorded exceptions; subtitle <= 25 chars) modulo a two-sided recorded exception list (Amara `bIII`/`bVII`; Amara `IV`). | `src/engine/naming.js`, `tests/naming.test.js`, `tests/mutants/n_*` |

Each lane raises its own pre-seeded row in the `suite_health.py` per-file floor
table (1A, seeded at 0 by P0c) from 0 to its test count, so an engine test file
cannot vanish without tripping the aggregate and no two lanes insert lines. Every lane also asserts its invariants over
`synthetic_scales.json` (9A): A the legality invariants (no ding, no doubled
pitch class, power = 2) on every generated voicing; B the geometry exit on the
19-field maximum; C deterministic naming on the symmetric sets, D10 inference on
each seed and the parent override flipping case, uppercase when no parent fits. Owner review
of `ENGINE-SPEC.md` DEFAULTs happens at the end of this phase.

### Phase 2 - ranker and selector (SERIAL, depends on A + C)

D9 root octave, D1 vocabulary, cap, ranking (default: triads > power > sus4 >
7ths > extended, then by number of top-shell tones; extended only when every
tone is on the top shell), dedup rules, per-deck override lists (default empty;
the built-ins' out-of-vocabulary cards are recorded as overrides in
`tests/fixtures/divergence_v1.json` under an `overrides` key, so the list lives
in one Phase 2 owned file). Exit: a
committed **divergence table** against the fixture, diffed by a test with no
numeric expectation, and a two-sided exception test so the list can only shrink.
Owns `src/engine/select.js`, `tests/select.test.js`, `tests/mutants/s_*`,
`tests/fixtures/divergence_v1.json`. [eng-review 9A] Also: the cap (25 cards, DEFAULT[owner-review], stated in ENGINE-SPEC) bites on the
synthetic 12-note pan, the ranking order and the sus2/6 dedup are
asserted on a synthetic pan, each with a mutant. [eng-review 2, 2A]
`select.build` returns `warnings[]` on ok results: `NO_THIRDS` when no root
has a third above it on the top shell (the 3-pitch-class `{C, G, D}` synthetic
fixture must yield it; a diatonic pan must yield none; whole-tone is rejected
upstream with `NO_FIFTH` and never reaches `select.build`), each with a mutant.

### Phase 3 - first user-visible ship (SERIAL; owns `index.html`; runs as two lanes 3a then 3b, see the worktree table)

Scale string (D13) -> `core.parseSeed` -> generated deck -> existing card
renderer, in memory, no persistence. Adds `tools/inline_engine.py`, the engine
regions in `index.html`, the desync check in `tools/validate.py` **with its
killing mutant `tests/mutants/b_engine_desync.patch`** (one character changed
inside a region; copies `b_validate_desync.patch`) [eng-review 12A], a second
deck registry so `deck()` can resolve custom ids without the `DECKS` literal
growing (`validate.py` KeyErrors on any fourth deck in the literal;
`tests/paths.py` needs the literal to stay one line) - the registry maps deck id
to a **fully generated deck object**; generation runs once at submit (and once
at decode in Phase 4), never inside `deck()` or `render()` [eng-review 13A] -
the **scale sheet** specified below (design-review 1A-6A: bottom sheet opened
from a dashed "+ ADD" chip; box, live parse line, message line, mirror pair,
palette swatches, Generate), the one-time layout hint (17B as amended), fixed
element ids for the input UI so e2e can target them, keyboard and screen-reader
accessibility for the sheet and its message area (4A: labelled input,
`aria-live` message region, focus trap, no drag needed), generation-time budget tests
(12-note deck under 200 ms AND the 19-field synthetic maximum under 500 ms in
Node) [eng-review 15A], regenerated `d_*`/`e_*` mutants, and the CLAUDE.md/README
wording "sync step, not build step".

[eng-review 8A] `save()` persists only BUILT-IN deck ids in this phase:
selecting a custom deck leaves `store.deck` untouched, so a reload restores the
last built-in deck instead of silently falling back to Hijaz. Unit test plus
mutant; Phase 4 lifts the guard when custom decks become restorable.

[eng-review 10A] Tests: a sandbox unit test submits the whole-tone synthetic
seed and asserts the message element carries the `NO_FIFTH` reason, the text
box keeps its contents and the app's selected deck (`deckId` global) is unchanged; an e2e case sets the viewport
to 380 px, asserts the text box and submit control are visible and inside the
viewport, submits a valid 9-note string and asserts the first generated card
renders. One mutant each. Owns `index.html`,
`tools/inline_engine.py`, `tools/validate.py`, `tests/paths.py`,
`tests/helpers/sandbox.js` (round 2), `tests/app.test.js`, `tests/e2e.test.js`,
`tests/mutants/d_*`/`e_*`, `CLAUDE.md`, `README.md`.


#### Phase 3 UI specification [design-review 2026-09-08, locked]

**Entry [1A].** The deck-chip row gains a dashed-outline chip "+ ADD" at its
end (`border:1.5px dashed #5a5142`, text `#a79d8b`, same pill geometry as
`.chip`). Tapping it opens a bottom sheet over the practice screen. The
practice screen itself (card, nav, mode buttons) does not change.

**Sheet anatomy [1A, 4A], top to bottom:**

| # | Element | Spec |
|---|---|---|
| 0 | Surface | `#1f1b15`, top border `1px #433b2c`, 18px top radius, backdrop `#0009`, `role="dialog"` `aria-modal="true"`, max-height 85dvh, internal scroll |
| 1 | Label | visible, Nunito Sans 600 9.5px uppercase `.13em` `#a79d8b`: "SCALE: DING, THEN TOP NOTES, \| BOTTOM NOTES" |
| 2 | Scale box | Bitter 16px, bg `#151310`, border `1px #433b2c`, radius 8px, min-height 44px, placeholder "(D) A C D E F G A C"; `autocapitalize=off`, `spellcheck=false` |
| 3 | Live parse line | Bitter 12px `#c4bcab`, updates on every input from `core.parseSeed`: "Ding D3 \| 1 A3 2 C4 3 D4 ..."; empty box shows "Type your ding first, e.g. (D) or D/" |
| 4 | Message line | Nunito Sans 11.5px, `aria-live="polite"`; error `#E27005`, warning `#e3b25c`, success `#a4c9a0`; sits ABOVE the control row so the soft keyboard never covers it |
| 5 | Control row | left: mirror pair as two `.mode` buttons "LEFT-FIRST" / "RIGHT-FIRST" (D12, default right-first per D12 shown as `.on`); right: six 14px `.dot` swatches (D6 index 0-5), selected one ringed `#f1ece1` |
| 6 | Generate | full-width `.mode.on` style (`#f1ece1` on `#272219`), 44px, "GENERATE CARDS"; disabled at 50% opacity until the parse line is valid; the only primary button while the sheet is open |

No parent-scale picker and no URL field on the create path (owner decisions
2026-09-08). Contrast for every text/background pair above is at or over
4.5:1 (checked: `#a79d8b` on `#1f1b15` 5.9:1, `#E27005` on `#1f1b15` 4.6:1,
`#e3b25c` 8.2:1, `#a4c9a0` 8.0:1).

**State table [2A].**

| State | Box | Message | Generate | Card behind |
|---|---|---|---|---|
| empty | placeholder | parse hint | disabled | unchanged |
| typing, valid | text | parse line only | enabled | unchanged |
| error (`NO_DING`, `NO_FIFTH`, `TOO_MANY_RIM`, `BAD_NOTE`) | text kept, amber-orange outline `#E27005` | one sentence from `reason`, e.g. "No perfect fifth above the ding D3. Add an A, or check the ding." | disabled | unchanged |
| loading | read-only | none | label "GENERATING", disabled, no spinner (budget is under 200 ms) | unchanged |
| success | sheet closes | practice-screen `aria-live` says "14 cards generated" | n/a | new chip `.on` and scrolled into view; card 1 face-up at full width |
| partial (ok with `warnings[]`) | as success | warning tier in `#e3b25c` on the practice screen, e.g. "Only power chords: no 3rds on this pan" | n/a | as success |
| first generation of this deck id in this page session (no persistence in Phase 3) | as success | one-time hint (17B as amended) appended to the success message | n/a | as success |
| same id already present (same notes, any options) [eng-review 2, 4A] | sheet closes | "Updated D AEOLIAN 9" | n/a | the existing deck is REPLACED in place with the new mirror, palette and parent; id and per-card state kept; its chip selected. Two colour or mirror variants of one pan are a non-goal. |
| delete (Phase 4) | n/a | "Removed C HIJAZ 9" | n/a | first built-in selected |
| newer link (Phase 4) | n/a | "This link needs a newer version of the app. Reload." | n/a | unchanged |

**Journey [3].** Practice screen -> tap "+ ADD" -> focus lands in the box ->
type or paste -> parse line updates -> Generate -> sheet closes -> new chip
selected, card 1 face-up, success message with the one-time hint -> tap
LEFT-FIRST / RIGHT-FIRST later via the Edit sheet (Phase 4) if the pan is
mirrored. The user never leaves the practice screen.

**Custom chip [5A].** Same anatomy as built-in chips: palette `.dot` plus an
auto label `<DING> <MODE> <N>` (e.g. "D AEOLIAN 9", "C HIJAZ 9"; the P0a parent fixture carries a short display name per candidate, e.g. Phrygian dominant -> HIJAZ, so the 16-char cap holds; when the
inferred parent has a common name), uppercase, capped at 16 characters with an
ellipsis, no icon, no URL. Renaming is Phase 4 (Edit sheet).

**Responsive and accessibility [6A].** The chip row scrolls horizontally
(`overflow-x:auto`, `scrollbar-width:none`, right-edge fade mask) and never
wraps; the active chip is scrolled into view on select; every chip and control
is at least 44px tall in its hit area. Sheet: focus moves to the box on open
and returns to "+ ADD" on close; Escape and backdrop tap close it; Tab is
trapped inside; `--card-w` is unaffected by the sheet.

**Tests added to Phase 3 [6A]**, each with one mutant under `e_*`/`d_*`:
card fully inside a 380px viewport on load with zero horizontal overflow;
exactly one enabled primary button while the sheet is open; card width
unchanged after a generate; six custom decks in the registry produce no chip
wrapping and the active chip is within the visible row. Plus the [10A] cases
above, now targeting the sheet's element ids. [eng-review 2, 3A] Also, each
with a mutant: e2e Escape closes the sheet, backdrop tap closes it, and focus
returns to "+ ADD"; sandbox unit tests that Generate stays disabled while the
parse line is invalid, that a same-id generate replaces the deck in place and
keeps the id (4A), that the one-time hint appears on the first generation of a
deck and not on the second, and that the success path reads
`deck.warnings` without a second generation call (spy on `select.build`).

### Phase 4 - persist and share
Versioned seed encoding, `share.decode` calling `core.parseSeed` (3A), `hpfc`
read-modify-write fix with its sibling-survival test and mutant, saved scales
under their own key, custom deck id = `core.deckId(fields)` (D14 as amended;
tests: id equals `hash(formatSeed(fields))` and `select.build` is never consulted for it (spy); change every option, id unchanged; the id itself is computed in Phase 3 from P0d, Phase 4 only encodes it), the seed options (palette, mirror, parent, name) encoded beside
the fields and never hashed,
layout-delta space reserved. [design-review 7A] **One Edit sheet:** tapping
the already-selected custom chip reopens the Phase 3 sheet in Edit state:
a Name field (prefilled with the auto label), the Scale box prefilled with
`core.formatSeed(seed)` (8A), the live parse line, a native `<select>` labelled
"DEGREES" listing the P0a parent candidates with the inferred one preselected
(the D10 override, encoded as the parent index in the seed), the mirror pair
and palette swatches, "SAVE CHANGES" as the single primary button, and a quiet
"DELETE THIS DECK" text link at the bottom (`#a79d8b`, 9.5px uppercase). Saving
re-parses and regenerates once (13A) and keeps the id if the canonical seed is
unchanged (D14). Deleting the SELECTED custom deck falls back to the first
built-in deck **with a visible message** (4A). No context menus, long-press or
swipe gestures. [eng-review 2, 3A] Tests, each with a mutant: the Edit box is
prefilled with `formatSeed(fields)`; changing the Degrees select relabels the
degrees and the share URL carries the new parent index while the id is
unchanged; the Edit sheet shows `deck.warnings` from the registry with no
generation call; rename and delete per the 4A table. The version byte's "this link
needs a newer app" path (`NEEDS_NEWER_APP`) so a PWA-cached old `index.html`
fails politely.

[eng-review 11A] `tests/share.test.js` with mutants under the `h_*` prefix (`u_*` is P0d's); Phase 4 owns `src/engine/share.js`, `tests/share.test.js`, `tests/mutants/h_*` and raises the `share.test.js` floor row: encode -> decode equals the seed for every synthetic
fixture entry; version byte + 1 is rejected with `NEEDS_NEWER_APP`; one flipped
byte is rejected; a payload over the stated cap is rejected.

**CRITICAL regression [eng-review, mandatory]:** `tests/app.test.js:356` ("an
unknown stored deck id falls back to the first deck") locks today's SILENT
fallback and asserts the fallback id is persisted. The deleted-deck message
changes that path. Phase 4 extends that test to distinguish an unknown
built-in id (silent fallback, kept) from a missing `custom:` id (fallback plus
message) and re-verifies `d_no_deck_fallback.patch` still kills. It must not
delete or weaken the existing assertion.

### Phase 5 - layout customisation
Rotate / reorder (mirror shipped in Phase 3 per 17B), filling the space Phase 4
reserved; keyboard-accessible reorder (4A), never drag-only.

### Phase 6 - print, then presets
`tools/gen_deck.js` + `decks.py` adapter (synthesising or omitting the ~17
print-only per-deck keys, listed under "Still missing" and owned here per 4A); presets as INLINED seeds, never `fetch` (fails under
`file://`, absent in the sandbox, against "offline-ish") and never merged into
the `DECKS` literal.

## Open decisions and their swarm defaults

| Decision | Needed by | Default, or owner-only |
|---|---|---|
| Chord-spelling order for extensions | A | root, 3, 5, 7, 9, 11, 13 as observed (Fm9, Fm11); tested against the fixture |
| Symmetric-set root tie-break | C | prefer tonic, else lowest scale degree; flagged |
| Fallback degrees for no-third / atonal scales | C | major-relative with flats, uppercase; flagged |
| Accidental spelling for custom scales | C | user's typed spellings verbatim; flagged |
| Inner-ring cap and bottom-ring cap | B | 2 and 6 (D12); flagged |
| Root-octave policy | Phase 2 | D9; DECIDED |
| Degree case parent scale for Amara | C | D10; DECIDED Aeolian, `IV` frozen |
| Parent-scale choice for custom scales | C / Phase 4 | D10; DECIDED infer nearest mode on create, override only in the Edit sheet (design-review 7A), carried in the URL |
| Ranking and cap | Phase 2 | as stated in Phase 2; flagged |
| Canonical card order | Phase 2/3 | as stated above; flagged |
| Per-deck override lists | Phase 2 | empty; **owner-only** in substance |
| Palette set | Phase 3 | D6; DECIDED built-in pairs + swaps |
| UI element ids for scale input | P0a | fixed in `ENGINE-SPEC.md` now: `scale-sheet`, `scale-box`, `scale-parse`, `scale-msg`, `scale-mirror-l`, `scale-mirror-r`, `scale-swatches`, `scale-generate`, `deck-add`; Phase 3 registers them in the sandbox `ELEMENT_IDS` |
| D10 parent candidate list, distance, tie-break, encoding | P0a | as stated in P0a (16A); flagged DEFAULT[owner-review] |
| Result codes and their English reasons | P0a | enum in `ENGINE-SPEC.md` (7A); flagged |
| Scale-string grammar details (separators, octave marks) | P0d | D13; separators `( )`, `/`, `\|`, whitespace; flagged for edge cases only |

## Formerly "still missing" - now owned [eng-review 4A]

| Item | Owner | Exit condition |
|---|---|---|
| The ~17 print-only per-deck keys (`sub`, `credit`, `blurb`, `legend_lines`, `legend_demo`, `blank_cards`, `R`, `cy`, ...) | Phase 6 | `gen_deck.js` output builds a PDF through `decks.py` with every key synthesised or omitted by name; a test lists the keys |
| Deck-chip UI at 380 px with N custom decks, delete and rename | Phase 3 (scrolling row) / Phase 4 (Edit sheet) | e2e at 380 px with 6 custom decks: no wrapping, active chip visible; Edit sheet rename and delete work |
| `store.deck` when the selected custom deck is deleted | Phase 4 | fallback to the first built-in deck with a visible message; regression test above |
| Accessibility for note entry | Phase 3 | labelled text box, `aria-live` message region, dialog focus trap and return, full keyboard path in e2e |
| Accessibility for the reorder editor | Phase 5 | keyboard reorder, no drag-only path |
| PWA: cached old app opens a newer link | Phase 4 | `NEEDS_NEWER_APP` message, app still usable; share test |

## Degenerate cases that will actually reach users

A scale with **no perfect fifth above the ding** (whole-tone subsets) yields zero
triads and zero power chords - the UI must say why; fewer than 3 pitch classes
yields only power chords; **symmetric scales** (diminished, whole-tone,
augmented) make root selection arbitrary for every chord, so the same set gets
named 3-4 ways depending on tie-break; a pan with no ding, or whose ding pitch
class is absent from the top shell, leaves tonic inference with nothing to work
from.

[eng-review] Owners: no-fifth -> P0d rejects with `NO_FIFTH` in `parseSeed`
(definition: no top-shell note a perfect fifth above the ding pitch class; lane
A only asserts on the fixture that every accepted seed has one); symmetric-scale
naming -> lane C (deterministic tie-break, asserted on the octatonic
diminished and augmented-hexatonic fixture seeds, which do contain fifths;
whole-tone exists in the fixture only as a `NO_FIFTH` rejection); no ding -> P0d (`parseSeed`: exactly one ding
required, `NO_DING`); ding pitch class absent from the top shell -> P0d accepts
it and D10 still takes the tonic from the ding. Each has a row in `synthetic_scales.json`.

## Non-negotiables

- Built-in decks stay literal and render identically. The suite on `main` proves
  it; keep it green rather than asserting it.
- Engine code follows `tests/CONTRACT.md`: spec-first, no importing constants
  from the module under test, every test group needs a killing mutant.
- The app keeps working offline-ish and at 380px.

## Approved Mockups [design-review 2026-09-08]

| Screen | Direction | File |
|---|---|---|
| Create sheet (empty), error state, post-generate warning + hint, Edit sheet | C: bottom sheet over the unchanged practice screen, 380px | `~/.gstack/projects/raywu-handpan-cards/designs/scale-input-20260908/approved-sheet.html` |
| Rejected alternatives A (inline panel) and B (chip-row variants), for the record | superseded | `~/.gstack/projects/raywu-handpan-cards/designs/scale-input-20260908/wireframe.html` |

The approved file is built from the app's own tokens (`.chip`, `.mode`,
`.dot`, `button.nav`, `:focus-visible #e3b25c`) and is the visual reference
for Phase 3 and the Phase 4 Edit sheet.

## Provenance

Every [verified] number above comes from `tools/research/engine_measure/`
(README there) run against `main` at `afd52a7`. `https://handpaner.com/` and
`https://www.dingandtones.com/scale` were unreachable from the drafting and
reviewing environments; competitor claims are unverified.

## GSTACK REVIEW REPORT

**Skills:** /plan-eng-review + /plan-design-review (gstack v1.81.0.0) | **Date:** 2026-09-08 | **Commit:** fbd14b9 (plan edits uncommitted at review time)

| Review | Mode | Outside voices | Result |
|---|---|---|---|
| Eng (run 1) | FULL_REVIEW | Codex (5 tensions, all resolved) | CLEAR, 23/23 complete options |
| Eng (run 2, after design) | DELTA re-review of D10-D14, P0, Phases 2-4 | Codex (6 findings, 1 tension, resolved) | CLEAR, 4/4 complete options |
| Design | 7 passes, APP UI | Codex (5 findings) + Claude subagent (5 findings), 0 hard rejections | 4/10 -> 9/10, 10 decisions, 0 unresolved |

### Verdict

Plan is locked. Eng run 1: 23/23 recommendations chose the complete option.
Eng run 2 (after the design decisions): 4/4, 0 unresolved; it found the id
scope, the warnings owner and the duplicate-seed collision that the design
edits had introduced.
Design: overall score 4/10 before, 9/10 after (Pass 5 stays 8: no
DESIGN.md yet, tracked in `TODOS.md`). Lane ownership is unchanged by any of it.

### Eng decisions folded into this plan

| # | Section | Decision |
|---|---|---|
| E1-D3 (eng-review id, not owner D3) | Scope | Proceed with all six phases as written |
| 1A | Architecture | `suite_health.py` per-file floor table; each lane adds one row (P0c) |
| 2A | Architecture | `tests/helpers/engine.js` shared `node:vm` loader; no direct `require` of engine files |
| 3A | Architecture | One validator (`core.parseSeed`) behind both the text box and the URL decoder |
| 4A | Architecture | Every "still missing" item assigned a phase and exit condition |
| 5A | Architecture | ASCII data-flow diagram under Engine integration; inline diagrams in select.js and layout.js |
| 6A | Code quality | `qualities.json` is the spec; engine literal asserted equal; mutant flips an interval |
| 7A | Code quality | `{ok, value}` / `{ok, code, reason}` result contract; engine never throws on user input |
| 8A | Code quality | Phase 3 `save()` persists built-in ids only; Phase 4 lifts the guard |
| 9A | Tests | `tests/fixtures/synthetic_scales.json` owned by P0a; property tests + mutants per lane |
| 10A | Tests | Phase 3 rejected-path unit test + 380 px e2e, each with a mutant |
| 11A | Tests | `tests/share.test.js`: round-trip, version+1, flipped byte, oversize, with mutants |
| 12A | Tests | `tests/mutants/b_engine_desync.patch` kills the engine-region desync check |
| 13A | Performance | Registry holds fully generated decks; generation once at submit/decode; budget test measures that call |
| 14A | Codex | New serial lane P0d `src/engine/core.js` before Phase 1 |
| 15A | Codex | 19-field worst case under 500 ms alongside the 12-note 200 ms budget |
| 16A | Codex | P0a specifies the D10 candidate mode set, distance, tie-break, encoding, tonic rule |
| 17B | Codex | Keep D12; caveat + mirror toggle in Phase 3 (caveat form amended by design 3A) |
| 18B | Codex | Keep seed-as-contract; per-card state keys on (deck id, fields list) (D14 as amended by review D4) |
| 19A | Owner UX | Freeform scale string replaces the per-note form (D13; URL field removed by design review) |
| TODO 1 | P0b | Fixture freezes per-deck fields, degrees, colours, geom |
| TODO 2 | Phase 4 | Custom id = hash of `formatSeed(fields)` only; options never hashed (amended by 1A) |
| TODO 3 | P0c | Scoped revert + clean after each mutant, clean-tree assertion |

### Eng re-review decisions (run 2, after design) [eng-review 2]

| # | Section | Decision |
|---|---|---|
| 1A | Architecture | Custom id = hash of `formatSeed(fields)` only; options (palette, mirror, parent, name) never hashed; computable in Phase 3 |
| 2A | Code quality | `select.build` is the one producer of `warnings[]`; the registry stores `deck.warnings`; readers never regenerate; deck object shape fixed in ENGINE-SPEC |
| 3A | Tests | 11 delta gaps added with mutants: `\|` round-trip, id stability, `NO_THIRDS`, Escape/backdrop/focus e2e, disabled Generate, upsert, one-time hint, warnings without regeneration, Edit prefill, Degrees override, delete |
| 4A | Codex tension | Same-id generate replaces the deck in place ("Updated ..."), id and progress kept; Codex's "mirror joins the id" rejected because a mirror flip would drop progress |

Codex findings 1, 4, 5, 6 (D14 wording, warnings split, option serialisation, Phase 2 to 3 handoff) were wording consequences of 1A/2A and are written above. Finding 2 (parent under the same id) is not a collision: the parent changes degree labels only, never the fields list (D14 key as amended by review D4).

### Design decisions folded into this plan

| # | Dimension | Before -> after | Decision |
|---|---|---|---|
| Dir | Direction | - | C: bottom sheet from a "+ ADD" chip; no parent picker, no URL field on create |
| Owner | D10 | - | Infer only on create; override lives in the Edit sheet |
| Owner | D13 | - | Drop provenance entirely: no URL field, storage or chip display |
| 1A | Hierarchy | 3 -> 9 | Sheet order box, parse line, message, mirror + swatches, Generate; practice screen unchanged |
| 2A | States | 3 -> 9 | Full state table; `warnings[]` on ok results; duplicate/delete/newer-link copy |
| 3A | Journey | 4 -> 9 | One-time "Layout is a guess" hint in the message region; nothing on cards |
| 4A | Visual spec | 5 -> 9 | Colours, type, sizes and contrast for every sheet element |
| 5A | Consistency | 5 -> 8 | Custom chip = palette dot + auto label `<DING> <MODE> <N>`, 16-char cap |
| 6A | Responsive/a11y | 4 -> 9 | Scrolling chip row, dialog semantics, focus trap, four 380px e2e cases with mutants |
| 7A | Edit path | - | One Edit sheet on the selected custom chip: name, degrees select, delete link (Phase 4) |
| 8A | Round trip | - | `core.formatSeed`; `parseSeed(formatSeed(seed))` equals seed (P0d) |
| TODO 1 | Backlog | - | DESIGN.md via /design-consultation, in `TODOS.md` |

### Mandatory regression

`tests/app.test.js:356` locks the silent unknown-deck fallback. Phase 4 must
extend it (unknown built-in id silent; missing `custom:` id with message) and
re-verify `d_no_deck_fallback.patch` kills. Recorded in Phase 4.

### NOT in scope

- Migrating the three built-in decks to the engine (Architecture section).
- Any vendor URL: no field, no storage, no fetch (D13 as amended).
- A parent-scale picker on the create path (D10 override is Edit-only).
- Per-card layout caveats or badges on generated cards (3A).
- Context menus, long-press or swipe gestures on chips (7A).
- Two colour or mirror variants of one pan as separate decks (eng run 2, 4A).
- Writing DESIGN.md inside this plan (tracked in `TODOS.md`).
- Spaced repetition, stats, PWA, audio (roadmap items 1-4 in CLAUDE.md); only
  the D14 card-key rule and the `NEEDS_NEWER_APP` path touch them.
- Cloud sharing or a proxy of any kind (D5).
- Colour customisation beyond the six palette indices (D6).

### What already exists

- `tests/helpers/sandbox.js` DOM-stubbed boot sandbox (single-script regex, fixed in P0c).
- `tests/mutation_check.sh` with 43 mutants and `# kills:` headers; `tests/suite_health.py` floors 40/12/17.
- `tools/validate.py` DECKS-literal validation and `b_validate_desync.patch` (template for 12A).
- `tools/research/engine_measure/` measurements behind every [verified] tag.
- `tools/regen_data_mutants.py` for `d_*` regeneration after any DECKS change.
- UI tokens in `index.html` reused by the sheet: `.chip` pill + two-tone `.dot`, `.mode` / `.mode.on` buttons, `.shuffle` quiet text button, `button.nav` 56x44, `:focus-visible` ring `#e3b25c`, `--card-w`, `buildChips()`.

### Failure modes (3 critical gaps, all now owned)

1. Engine region drift between `src/engine` and `index.html` -> byte-exact desync check + 12A mutant.
2. Hostile or stale share URL -> `parseSeed` rejects; `NEEDS_NEWER_APP` for newer versions; oversize cap.
3. Silent data loss on custom-deck delete or reload -> 8A guard, 4A message, Phase 4 regression test.
Non-critical: symmetric-scale naming drift (lane C determinism), id drift on option edits (1A tests), 19-field
layout blow-up (15A budget), mutant contamination of the tree (TODO 3),
chip-row overflow with many custom decks (6A e2e).

### Worktree parallelization

| Lane | Depends on | Owns | Conflict flags |
|---|---|---|---|
| P0a, P0b, P0c | main | spec, fixtures, harness | none (disjoint files) |
| P0d | P0a + P0b + P0c | core.js (+ formatSeed, deckId, zones) | none |
| 1A voicing | P0d | `src/engine/voicing.js`, `tests/voicing.test.js`, `v_*`, one floor row | none |
| 1B layout | P0d | `src/engine/layout.js`, `tests/layout.test.js`, `g_*`, one floor row | none |
| 1C naming | P0d | `src/engine/naming.js`, `tests/naming.test.js`, `n_*`, one floor row | none |
| 2 select | 1A + 1C | `select.js`, divergence table | owner review gate |
| 3a app plumbing | 2 + 1B | `tools/inline_engine.py`, `validate.py`, `paths.py`, sandbox round 2, registry + `NEEDS_NEWER_APP` guard in `index.html`, mutant regeneration | sole owner of `index.html` |
| 3b scale sheet | 3a | sheet UI, chip row, a11y, 380 px e2e in `index.html`, CLAUDE.md/README | sole owner of `index.html` (serial after 3a) |
| 4, 5, 6 | 3 | share + Edit sheet, editor, print | serial |

Each Phase 1 lane builds in its own `git worktree`, delivers via PR, and gets
an independent reviewer at the verified head SHA before merge.

### Implementation tasks

Eng run 1: 12 tasks in `~/.gstack/projects/raywu-handpan-cards/tasks-eng-review-20260908-131816.jsonl`.
Eng run 2: 6 tasks in `~/.gstack/projects/raywu-handpan-cards/tasks-eng-review-20260908-143019.jsonl`.
Design: 8 tasks in `~/.gstack/projects/raywu-handpan-cards/tasks-design-review-20260908-134140.jsonl`.

### Test plan artifact

`~/.gstack/projects/raywu-handpan-cards/ray-main-eng-review-test-plan-20260908-125622.md`

### /review findings folded [2026-09-08, PR #8]

20 findings from the adversarial /review subagent are applied above under four
owner decisions: D2 ding mandatory (D13, P0a, degenerate cases), D3 zone
assignment in `parseSeed` (P0d), D4 per-card key = fields list (D14), and
D1 apply the remaining 16 (NO_FIFTH single owner, NO_THIRDS fixture,
pre-seeded floor rows, `h_*` share mutants, D9 in select, lane B exit,
subtitle in lane C, rule-2 carve-out, cap 25, display names, element ids,
id in Phase 3, fixture schema, `E1-` eng-review ids, PWA wording, P0b mutant).
Swarm readiness: Phase 0 runs P0a/P0b/P0c in parallel, Phase 3 splits 3a/3b.

NO UNRESOLVED DECISIONS
