<!-- Promoted from the 2026-09 planning session and AMENDED after a third
     adversarial review (2026-09-08, post-retrofit). This is the reviewed,
     owner-decided plan for the user-configurable-scale feature. It has NOT
     been built. Findings marked [verified] were reproduced against the data
     on main at afd52a7 with tools/research/engine_measure/ - re-run those
     scripts rather than trusting a number. The OWNER DECISIONS table is
     binding; entries marked [OWNER: PENDING] carry a swarm default that lanes
     proceed on until the owner replaces it. -->

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
| D6 | **Custom deck colours come from a fixed owner-approved palette set** (6-8 root/tone pairs; user picks, or assigned by hash of the scale name). | The share URL carries a palette INDEX, never a colour string. **[OWNER: PENDING]** the pairs themselves. Swarm default until then: the three built-in pairs plus their root/tone swaps, flagged in the UI as provisional. Needed by Phase 3, not before. |
| D7 | **Spill to an inner ring past the rim ceiling.** | [verified] tangent ceiling `pi/asin(r_note/rim)` = 12.18 at Hijaz/Amara proportions, 15.81 at Pygmy's; stroke-aware (0.65pt rings at print size) it is ~11.9, so **11 rim fields** is the practical cap. Do NOT shrink fields to fit. See D12 for the inner-ring cap. |
| D8 | **Degree NUMERALS are mode-aware**: minor-relative (`III`, `VII`) for scales with a minor third, major-relative with flats (`bIII`, `bVII`) otherwise. | [verified] Hijaz 5/5, Pygmy 7/7 fall out; **D Amara is the frozen exception** (ships `bIII`/`bVII` from the commercial deck). Fallback for no-third and symmetric sets: major-relative with flats. |
| D9 | **Root-octave default: lowest top-shell instance, else lowest.** [OWNER: PENDING] confirmation; swarm proceeds on it. | 51/54 primaries. Pygmy `Db`, `Dbmaj7`, `Eb7` become recorded divergences of the built-in fixture, not engine bugs. |
| D10 | **Degree CASE comes from stacked thirds over a parent scale**, not from the pan alone. [OWNER: PENDING] whether Amara is declared Dorian. | [verified] No pan-only rule separates Hijaz `iv` from Amara `IV`. Stacked thirds over a 7-note parent reproduce all 17 labels (Hijaz Phrygian dominant, Pygmy Aeolian) if Amara is Dorian; under Aeolian, the deck's own credit, Amara `IV` is a second frozen exception. Custom scales: the user picks a parent scale or the engine infers the nearest 7-note mode; scales with no usable parent use uppercase. |
| D11 | **Register tie-break for unforced tones: nearest instance above the root.** | 20/21 under-determined cards; `Fm9` (G5) is the single recorded voicing exception. |
| D12 | **Layout default = Pygmy pattern, mirrored right-first**, generalised: ding enlarged and offset toward the player (`r=0.19R`, `dy=0.1425R`); rim zig-zag ascending from bottom-right (~290 deg) toward top centre, right-first; inner ring holds at most 2 notes at ~128/~52 deg ascending opposite to the rim; bottom notes as a dashed outer x-ray ring, at most 6; beyond 11 rim + 2 inner + 6 bottom the scale is rejected with a reason. | A default, not a measurement. Never retro-applied to the built-ins (Hijaz and Amara are verified left-first). The geometry solver applies to GENERATED decks only; built-in `geom` literals bypass it, so "built-ins render identically" stays trivially true. |

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
and the PWA precache list stays `[index.html]`. Phase 1 lanes never touch
`index.html`; the sandbox must therefore execute ALL `<script>` blocks in
document order (P0c), because a second block makes today's greedy single-block
regex throw.

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
from the URL (D6).

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
- **Spec rules are tagged** `DECIDED(D-number or CLAUDE.md cite)` or
  `DEFAULT[owner-review]`. Lanes proceed on DEFAULTs. Changing a DEFAULT later
  is a spec change handled by CONTRACT rule 4, not a reason to stall.
- **Every phase that edits `index.html` budgets mutant regeneration:** the
  `d_*`/`e_*` mutants are line-anchored on the app script; `b_*` regenerate via
  `tools/regen_data_mutants.py`.
- Mutant patches carry `# kills: <test name>` and, for new prefixes,
  `# suite: <command>` so `mutation_check.sh` selects the suite from the header
  rather than from a hardcoded prefix table.

### Phase 0 - unblocks everything, ships nothing (SERIAL)

| Lane | Scope | Owns |
|---|---|---|
| **P0a** | Engine spec: legality invariants, D2 cluster rule with the operative ANY-non-root-tone forced test, D9 root-octave, D11 register tie-break, D1 vocabulary + cap + ranking, naming disambiguation, D8/D10 degrees, canonical order, the two recorded exceptions (`Fm9` register; Pygmy `Db`/`Dbmaj7`/`Eb7` root octave) and the 5 alternates. Every rule tagged DECIDED or DEFAULT. The quality -> interval table and display strings live in a fixture, not in the engine's exports, so tests never import from the module under test (CONTRACT rule 2). Owner review is a gate AFTER Phase 1, not before. | `docs/ENGINE-SPEC.md`, `tests/fixtures/qualities.json` |
| **P0b** | Freeze the corpus: extract the 59 cards from `afd52a7` (post-retrofit) into a fixture with a SHA-256 self-assertion over a canonical serialisation (`sort_keys`, fixed separators) so it can never be quietly regenerated from the engine or broken by a reformat. | `tests/fixtures/golden_decks_v1.json`, `tests/test_fixture_integrity.py` |
| **P0c** | Harness prep. `sandbox.js`: execute ALL `<script>` blocks in document order; add `location`, `URL`, `btoa`/`atob`, `history`, `TextEncoder`/`TextDecoder`, `setTimeout`, `structuredClone`, `document.querySelector`, and `createElement` stubs with `value`/`setAttribute`/`dataset`; keep `getElementById` strict but extensible; keep `tools/boot_sim.js` and `tests/helpers/dump_app_render.js` green. `mutation_check.sh`: revert with `git apply -R` instead of the fixed `TRACKED` list (a `src/engine` mutant is otherwise never reverted and contaminates the sweep); dirty check over the files each patch names; header-driven `# suite:` selection for `v_*`/`g_*`/`n_*`. `CONTRACT.md`: rule 2's "CI greps for this" either gets a grep in `validate.yml` or is deleted; rule 4's diff list gains `src/engine/**`; rule 5 is scoped to test-only PRs. Do NOT raise floors here. | `tests/helpers/sandbox.js`, `tests/mutation_check.sh`, `tests/CONTRACT.md`, `.github/workflows/validate.yml` |

### Phase 1 - engine core (PARALLEL; never touches `index.html`)

| Lane | Scope | Owns |
|---|---|---|
| **A** | **Legality + voicing.** Enumerate legal voicings for (root field, interval set): no ding, no doubled pitch classes, power chords = 2 notes; apply D2 + D11 to pick one. Exit: containment - every one of the 59 fixture tuples is in its candidate set [verified satisfiable] - and the chosen voicing equals the fixture for 58/59 with `Fm9` as the declared exception (two-sided: the exception must still diverge). | `src/engine/voicing.js`, `tests/voicing.test.js`, `tests/mutants/v_*` |
| **B** | **Geometry solver** per D12: `r_note`/`f_note`/`f_num`/`n_in`/`n_out` as functions of N, rim ceiling, inner-ring and bottom-ring caps, rejection beyond them, full geom shape always emitted, `ext` from the furthest element. Exit (pure geometry, app-side only; print is Phase 6): for synthetic scales at N=5..19, no two field circles closer than r1+r2, every element inside `ext`, the inner pair ascends opposite the rim, and the three built-in `geom` literals pass through untouched. | `src/engine/layout.js`, `tests/layout.test.js`, `tests/mutants/g_*` |
| **C** | **Namer + degrees.** Quality naming from the fixture table, symmetric-set root tie-break (default: prefer tonic, else lowest scale degree), sus4-over-sus2 and m7-over-6 rules, per-scale accidental convention, D8 numerals, D10 case. Exit: reproduces fixture `main`/`sup` and every degree label modulo a two-sided recorded exception list (Amara `bIII`/`bVII`; Amara `IV` unless Dorian). | `src/engine/naming.js`, `tests/naming.test.js`, `tests/mutants/n_*` |

Each lane raises its own `suite_health.py` floor and adds a per-file floor so
an engine test file cannot vanish without tripping the aggregate. Owner review
of `ENGINE-SPEC.md` DEFAULTs happens at the end of this phase.

### Phase 2 - ranker and selector (SERIAL, depends on A + C)

D9 root octave, D1 vocabulary, cap, ranking (default: triads > power > sus4 >
7ths > extended, then by number of top-shell tones; extended only when every
tone is on the top shell), dedup rules, per-deck override lists (default empty;
the built-ins' out-of-vocabulary cards are recorded as overrides). Exit: a
committed **divergence table** against the fixture, diffed by a test with no
numeric expectation, and a two-sided exception test so the list can only shrink.
Owns `src/engine/select.js`, `tests/select.test.js`, `tests/mutants/s_*`,
`tests/fixtures/divergence_v1.json`.

### Phase 3 - first user-visible ship (SERIAL; owns `index.html`)

Scale input -> generated deck -> existing card renderer, in memory, no
persistence. Adds `tools/inline_engine.py`, the engine regions in `index.html`,
the desync check in `tools/validate.py`, a second deck registry so `deck()`
can resolve custom ids without the `DECKS` literal growing (`validate.py`
KeyErrors on any fourth deck in the literal; `tests/paths.py` needs the literal
to stay one line), the D6 palette (provisional if still pending), fixed element
ids for the input UI so e2e can target them, a generation-time budget test
(12-note deck under 200 ms in Node), regenerated `d_*`/`e_*` mutants, and the
CLAUDE.md/README wording "sync step, not build step". Owns `index.html`,
`tools/inline_engine.py`, `tools/validate.py`, `tests/paths.py`,
`tests/helpers/sandbox.js` (round 2), `tests/app.test.js`, `tests/e2e.test.js`,
`tests/mutants/d_*`/`e_*`, `CLAUDE.md`, `README.md`.

### Phase 4 - persist and share
Versioned seed encoding, validating decoder, `hpfc` read-modify-write fix with
its sibling-survival test and mutant, saved scales under their own key, custom
deck id = content hash with a `custom:` prefix, layout-delta space reserved.

### Phase 5 - layout customisation
Mirror / rotate / reorder, filling the space Phase 4 reserved.

### Phase 6 - print, then presets
`tools/gen_deck.js` + `decks.py` adapter (synthesising or omitting the ~17
print-only per-deck keys); presets as INLINED seeds, never `fetch` (fails under
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
| Root-octave policy | Phase 2 | D9 default; **owner confirms** |
| Degree case parent scale for Amara | C | D10; **owner decides** Dorian vs Aeolian exception |
| Ranking and cap | Phase 2 | as stated in Phase 2; flagged |
| Canonical card order | Phase 2/3 | as stated above; flagged |
| Per-deck override lists | Phase 2 | empty; **owner-only** in substance |
| Palette set | Phase 3 | **owner-only** (D6); provisional built-in pairs until then |
| UI element ids for scale input | Phase 3 | fixed in `ENGINE-SPEC.md`; flagged |

## Still missing, name them in the plan

The ~17 print-only per-deck keys a generated deck must synthesise or omit
(`sub`, `credit`, `blurb`, `legend_lines`, `legend_demo`, `blank_cards`, `R`,
`cy`, ...); deck-chip UI at 380px with N custom decks plus delete/rename and what
happens to `store.deck` when the selected custom deck is deleted; accessibility
for note entry and the drag-to-reorder editor; and the PWA interaction - a
cached old `index.html` cannot decode a newer URL version, so the version byte
needs a "this link needs a newer app" path.

## Degenerate cases that will actually reach users

A scale with **no perfect fifth on any degree** (whole-tone subsets) yields zero
triads and zero power chords - the UI must say why; fewer than 3 pitch classes
yields only power chords; **symmetric scales** (diminished, whole-tone,
augmented) make root selection arbitrary for every chord, so the same set gets
named 3-4 ways depending on tie-break; a pan with no ding, or whose ding pitch
class is absent from the top shell, leaves tonic inference with nothing to work
from.

## Non-negotiables

- Built-in decks stay literal and render identically. The suite on `main` proves
  it; keep it green rather than asserting it.
- Engine code follows `tests/CONTRACT.md`: spec-first, no importing constants
  from the module under test, every test group needs a killing mutant.
- The app keeps working offline-ish and at 380px.

## Provenance

Every [verified] number above comes from `tools/research/engine_measure/`
(README there) run against `main` at `afd52a7`. `https://handpaner.com/` and
`https://www.dingandtones.com/scale` were unreachable from the drafting and
reviewing environments; competitor claims are unverified.
