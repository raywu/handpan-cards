# Plan: scale-degree numerals without accidentals

Date 2026-10-06. Repo raywu/handpan-cards. Base: `main` at or after `068aebd252323b8c78c4b23b0d354ab5f2207257`.
Every figure in this file was produced by a command run on a detached worktree of `068aebd` (since removed) or,
where a tool needs a commit, in a standalone throwaway copy of that tree. Section 12 lists what was not run.

## 0. Corrections to the brief

1. **Base SHA.** The brief names `afb1d07`. PR #248 merged 2026-10-06T07:21:20Z; `git rev-parse origin/main`
   prints `068aebd252323b8c78c4b23b0d354ab5f2207257`. `git diff --name-only afb1d07 068aebd` lists `CLAUDE.md`, `README.md`, `TODOS.md`,
   `docs/plans/2026-10-05-refactor-pass-3-cleanup.md`, `tests/mutation_harness.test.js`, `tests/test_deck_data.py`,
   `tests/test_suite_health.py`, `tools/validate.py`. Two are shared with this plan, at different anchors:
   `README.md` (this plan: the mutant count) and `tests/test_deck_data.py` (this plan: the `DEGREES` table). Every
   diff in appendix A was applied to `068aebd`, not to `afb1d07`.
2. **Default 5 as worded collides.** "That note alone keeps its accidental under today's rule" does not give a
   unique label. Today an out-of-parent pitch class is named from the D8 REFERENCE scale (major or natural
   minor), and when it happens to be a reference degree it prints NO accidental. Enumeration over all 2048 pans
   with tonic 0 (every subset of the other 11 pitch classes), inferred parent: 2938 out-of-parent pitch classes on
   1725 pans; 715 of them have no accidental today; with in-parent steps reading their step numeral, 149 pans
   then carry two identical labels (457 when case and `°` are ignored). Under a parent override: 2495 of 20480.
   The plan keeps the INTENT of the default (an out-of-parent note alone keeps an accidental) with a rule that
   cannot collide; see section 1 and planner decision P1.
3. **Built-in labels are hand data, Hijaz included.** `naming.degrees()` runs only for generated decks
   (`src/engine/select.js`, `build`, the `degrees:` key). The three built-ins carry literal `degrees` maps in
   `data/decks.json`. The engine already derives Amara `III`, `VII`, `iv`, as the brief says. It derives Hijaz
   `bII` and `bvii` today (no minor third over C#, so D8 is major-relative; Phrygian dominant steps 2 and 7 sit a
   semitone under the major scale's). So the Amara change is data only, and the Hijaz change is data plus engine.
4. **Where the labels are pinned.** Besides `DEGREE_EXCEPTIONS` and the `DEGREES` table, the shipped labels are
   pinned by `tests/fixtures/golden_decks_v4.json` (sha-pinned, versioned), `tests/fixtures/print_decks_v1.json`
   and the digests in `tests/fixtures/card_face_v1.json`. `tests/select.test.js`, `tests/test_print.py`,
   `tests/test_render_agreement.py`, `tests/e2e.test.js`, `tests/test_gen_deck.py`, `tests/pdf*.test.js`,
   `tools/boot_sim.js` and `tools/validate.py` contain no label literal. No fixture pins a label of a GENERATED
   deck: `tests/fixtures/engine_corpus_v1.json` has 0 `"degrees"` keys, and `gen_face_v1.json` digests only the
   first three cards of each generated deck, all tonic-rooted.
5. **The numeral is not "one of seven chords".** It is a label per ROOT pitch class, shared by every card on
   that root (`headerHTML` in `index.html`: `d.degrees[String(pc(d, ch.roots[0]))]`). A pan can hold up to 12
   pitch classes, so an eighth label exists whenever a pan has a root outside its parent scale. Section 1.

## 1. Notation decision (the single decision point)

**Fixed: V1.** A label is `[accidental only if the root is outside the parent] + roman step + case + °`.
- Owner, 2026-10-05: Amara, all three frozen exceptions go (the owner's answer for G: "iv (Recommended)"); Hijaz
  "Drop the flats"; custom decks "Yes, no flats anywhere"; accidentals "No accidentals at all (Recommended)".
- Owner, 2026-10-06: "If by convention vii degree is true, we can keep the degree".
- Evidence for keeping `°`: `<scratch>/numerals/notation-research.md`, verdict table: "(a) no flats, no sharps |
  CONFIRMED for the scale-relative convention", "(b) no diminished mark | DENIED", "(c) no sus, 7, ø on the
  numeral | CONFIRMED for a degree label", "(c') no + (augmented) | Same status as °: standard texts write it.
  Moot here ...". Its section 3 gives scale-relative Phrygian dominant as `I II iii° iv v° VI+ vii`.
- V2 (no `°`) is not planned. Appendix D records what it would cost.

**Target labels, verified by running the engine with the new rule (no mismatch with the orchestrator's list):**

| deck | labels after |
|---|---|
| Hijaz | C# `I`, D `II`, F `iii°`, F# `iv`, G# `v°`, B `vii` |
| Pygmy | F `i`, G `ii°`, Ab `III`, Bb `iv`, C `v`, Db `VI`, Eb `VII` (unchanged) |
| Amara | D `i`, F `III`, G `iv`, A `v`, C `VII` |

**Still open (Q1, section 9): a root OUTSIDE the parent scale.** Custom pans only; no built-in has one.
Real example the engine accepts today: seed `(C3) Db3 Eb3 E3 Gb3 G3 B3 C4`, inferred parent Lydian, 20 cards.
Lydian on C is C D E F# G A B. Db and Eb are on the pan and not in it; both root cards (Db: `Db°`, `Dbm7b5`;
Eb: `Ebaug`). So this pan shows seven labels of which two are not scale steps.

| root | cards | today | A. planned default | B. drop the accidental | C. no label |
|---|---|---|---|---|---|
| C | C, Cm, C°, C5, Cmaj7, Cmaj7#11 | `I` | `I` | `I` | `I` |
| Db (outside) | Db°, Dbm7b5 | `#i°` | `#i°` | `i°` | (blank) |
| Eb (outside) | Ebaug | `iii` | `#ii` | `ii` | (blank) |
| E | Em, E5, Emadd9, Em6/9 | `#iii` | `iii` | `iii` | `iii` |
| Gb | Gb5, Gbsus4, Gb7sus4 | `#iv°` | `iv°` | `iv°` | `iv°` |
| G | no card | `V` | `V` | `V` | `V` |
| B | B, B5, Bsus4, Badd9 | `#vii` | `vii` | `vii` | `vii` |

Literal reading of the brief's default (correction 2): Eb `iii` and E `iii`, two roots with one label.

What each option means over all 2048 tonic-0 pans (inferred parent; 1725 have an outside pitch class):

| option | rule | pans with two identical labels | what the user sees |
|---|---|---|---|
| A (default, planned) | outside root: `#` of the parent step below it, or `b` of the step above (tie-break in step NU-1) | 0 of 2048 (0 of 45056 label maps across all 11 parents, with and without `NO_THIRDS`) | an eighth label, always marked `#` or `b`, on that root's cards only |
| B drop and collide | same roman, no accidental | 413 of 2048 exact; 1498 of 2048 when case and `°` are ignored (e.g. pan `C Db D E`: Db `ii`, D `ii`) | two roots that read as the same step; `ii` on a note that is not the second step |
| C no label | outside roots get no entry | 0 | those cards print no degree; the header keeps deck name, index and subtitle |

Second example, committed: `tests/fixtures/gen_face_v1.json` deck "nineteen field maximum" (Aeolian on F, 59
cards) has Gb outside the parent, label `#I` today and under A, on cards `Gb`, `Gb5`.

Design for a small overturn: the whole out-of-parent rule is the body of one new function, `outsideNumeral` in
`src/engine/naming.js`. B replaces its three returns' `accidental` with `""`. C returns `null` from it and
`degrees()` skips the pitch class; no renderer was tested with a card whose root has no label (Amara E has
no entry today, but also no card), so C needs a render check that A and B do not. Under C `minorRelative` becomes dead. Under B it does not: the
both-sides branch still uses it to pick `ROMAN[below]` or `ROMAN[above]`. Section 9, Q1 lists what each
overturn deletes.

## 2. Goal

Every scale-degree label on every card, app and print, built-in and generated, reads as the root's step in the
parent scale: roman numeral 1 to 7, uppercase or lowercase, `°` where the degree is diminished, and no `b` or
`#` unless the root is outside the parent scale.

Done when, at the merged head:
1. `data/decks.json` holds the section 1 target labels, and `python3 tools/sync_decks.py --check`,
   `python3 tools/inline_engine.py --check`, `python3 tools/validate.py`,
   `python3 tools/refresh_mutants.py --check`, `node tools/regen_card_fixture.js --check` all pass.
2. `tests/naming.test.js` has no exception table and asserts all 18 built-in labels are engine output.
3. The four Hijaz and Amara PDFs carry the new labels; the two Pygmy PDFs are byte-identical to `068aebd`.
4. CI is green at the head SHA, including the mutation gate over 678 mutants.

## 3. Non-goals

- No change to chord names, subtitles, voicings, `fields`, `roots`, geometry, colours, fonts, card anatomy.
- No change to case or `°` derivation (`caseFromParent`, `caseFromPan`), parent inference, or `NO_THIRDS`.
- No `+` for augmented degrees (Q3). No Amy name or tag anywhere.
- No `CLAUDE.md` edit (Q2; not authorised).
- No rewrite of history: `docs/plans/*`, `docs/prompts/*`, `tools/research/engine_measure/t6_degrees.py`.
- Pygmy: no label, face digest or PDF byte changes.
- The four ideas the owner stopped tracking are not touched.

## 4. What is true today (evidence)

**Rule.** `src/engine/naming.js`, `numeral(offset, minorRelative, parentDegreeIndex)`: in-parent, roman is
`ROMAN[parentDegreeIndex]` and the accidental is the offset against `MAJOR_REF` or `MINOR_REF` at the same
index; out-of-parent, the pitch class is named from the reference scale. `degrees()` sets `minorRelative` when
the pan holds a minor third over the tonic. Case and `°`: `caseFromParent` (stacked thirds over the PARENT) for
an in-parent step, `caseFromPan` for an outside one; `NO_THIRDS` forces uppercase and no `°`.

| input | today | new |
|---|---|---|
| in-parent step, any parent, any pan | step roman, plus `b`/`#` when the step differs from the major (or, with a minor third on the pan, natural minor) scale | step roman, never an accidental |
| out-of-parent pitch class | reference-scale degree; accidental only if it is not itself a reference degree | `#`+parent step below or `b`+parent step above; always an accidental |
| `NO_THIRDS` | uppercase, no `°`; accidental as above | uppercase, no `°`; accidental as above |
| manual parent override | parent index changes steps, case and accidentals | same, new rule applied to the chosen parent |
| pan with fewer than 7 pitch classes | labels only for pitch classes on the pan | same |

Step labels per parent under the new rule (run over `tests/fixtures/parents.json`, full 7-note pan):

| parent | labels |
|---|---|
| Ionian | I ii iii IV V vi vii° |
| Aeolian | i ii° III iv v VI VII |
| Dorian | i ii III IV v vi° VII |
| Phrygian | i II III iv v° VI vii |
| Lydian | I II iii iv° V vi vii |
| Mixolydian | I ii iii° IV v vi VII |
| Locrian | i° II iii iv V VI vii |
| Harmonic minor | i ii° III iv V VI vii° |
| Melodic minor | i ii III IV V vi° vii° |
| Phrygian dominant | I II iii° iv v° VI vii |
| Harmonic major | I ii° iii iv V VI vii° |

Uniqueness: the committed test "NU-1 no two pitch classes on one pan share a label" enumerates 2048 pans x 11
parents x `noThirds` false/true (45056 maps): every pan pitch class has a label, 0 duplicates, and a label has an
accidental exactly when its pitch class is outside the parent. Largest gap between adjacent steps over the 11 parents is 3 semitones (measured
maxima `2,2,2,2,2,2,2,3,2,3,3`), so an outside pitch class always has a parent step one semitone away.

**Label alphabet.** A label holds accidental, roman, case and `°` only. An augmented step prints plain uppercase
(harmonic minor III, melodic minor III, Phrygian dominant VI, harmonic major VI); the engine has no `+`.
Example: seed `(G3) D4 Eb4 F#4 G4 A4 Bb4 C5 D5` (parent harmonic minor) labels Bb `III`; its only card is `Bbaug`.

**Case comes from the parent's thirds, not the pan's.** Hijaz D: Phrygian dominant step 2 stacks D F# A, a major
triad, so `II`; the pan has no A and the D cards are `D°`, `D°7`. Amara G: Aeolian step 4 stacks G Bb D, minor,
so `iv`; the pan has no Bb and the G cards are `G5`, `Gsus4`, `G7sus4`. Unchanged by this plan; see Q4.

**What else carries chord quality on a card.** `nameHTML` in `index.html` draws `ch.main` plus `<sup>` `ch.sup`
(the chord symbol); `headerHTML` draws `ch.subtitle` in `.hdr .r`. Print: `tools/hifi.py` and
`src/engine/pdfcards.js` draw the same three. The degree label is the fourth and least specific carrier.

**Readers and writers of a label (complete).**
- Writers: `data/decks.json` `degrees` (hand data, built-ins); `src/engine/select.js` `build` (`degrees:
  naming.degrees(...)`, generated decks); `tools/sync_decks.py` (copies into the `const DECKS` line).
- Readers: `headerHTML` in `index.html`; `src/engine/pdfcards.js` (drawn with `tracked(...)`);
  `src/engine/pdfdeck.js` (copies the map with integer keys); `tools/hifi.py` (header draw); `tools/decks.py`
  (two reads into the print deck dict); `tools/validate.py` check 1b (compares print adapter to canonical).
- Nothing parses, sorts or keys on a label: no `degrees` reference in `src/engine/sequence.js`, `share.js`,
  `core.js`, `voicing.js`, `layout.js`, `pdf.js`. Share URLs carry the seed and the parent index; labels are
  re-derived. `localStorage` stores seeds only.
- Tests that read `degrees` without a label literal (no change): `tests/pdf_builtin.test.js`,
  `tests/test_gen_deck.py`, `tests/app.test.js` (the Degrees select), `tests/select.test.js` (shape regex and
  the `NO_THIRDS` uppercase check), `tests/e2e.test.js` (two sites).

**Before and after, by running old and new rule through `select.build` (rest of each deck deep-equal):**

| deck | labels that change |
|---|---|
| built-in Hijaz (engine output for its seed) | D `bII`→`II`, B `bvii`→`vii` |
| built-in Pygmy | none |
| built-in Amara (engine output for its seed) | none; shipped data changes F `bIII`→`III`, G `IV`→`iv`, C `bVII`→`VII` |
| gen_face: twelve note pan | none |
| gen_face: nineteen field maximum | none (Gb `#I` outside, kept) |
| gen_face: octatonic diminished | A `#vi°`→`vi°` (C# `#i°`, E `#iii°`, F# `#iv` outside, kept) |
| gen_face: augmented hexatonic | B `#vii°`→`vii°`, no card on B (E `#iii` outside, kept) |
| gen_face: three pitch classes; omitted ding octave; bottom notes after bar; ding pc absent from top shell | none |
| `tools/gen_deck.js` preset d_celtic_minor_9 | C `bVII`→`VII` |
| `tools/gen_deck.js` preset g_hijaz_9 | F# `#vii°`→`vii°` |
| `tools/gen_deck.js` presets d_kurd_9, csharp_annaziska_9, e_la_sirena_9, f_low_pygmy_9 | none |

No out-of-parent label changes on any deck above. The six presets are the `PRESETS` list of `tools/gen_deck.js`,
a print CLI; the app has no preset row. All six seeds were read from that file and built with the old and the
new `naming.js`: two labels change (above), and for every one of the six the deck with `degrees` removed is
deep-equal before and after.

**Print.** PDF text diff against `068aebd` after `decks.py`: Hijaz Cards and Hijaz CHORD_ONLY each `bII`→`II`
x2, `bvii`→`vii` x5; Amara Cards and Amara CHORD_ONLY each `bIII`→`III` x5, `IV`→`iv` x3, `bVII`→`VII` x4; both
Pygmy PDFs zero text changes. Title, legend and blank cards print no numeral. Every new label is the same length
or shorter, so no fit test moves (`tests/app.test.js` 282 pass, `tests.test_print` OK, `tests.test_render_agreement`
OK after the change). The staleness test (`tests.test_pdf_build`) compares extracted text and fails until the
four PDFs are committed.

**Unaffected output is byte-identical.** After `node tools/regen_card_fixture.js`:
`git diff --numstat tests/fixtures/card_face_v1.json` = `316 316`, changed digests Hijaz 172, Amara 144, Pygmy 0.
`tests/fixtures/gen_face_v1.json` and `tests/fixtures/pan_render_v1.json`: no diff.

**Dead after the change (deleted in NU-1).** `MAJOR_REF`, `MINOR_REF`, the `parentDegreeIndex` parameter, the
reference-offset arithmetic in `numeral`, the local `parent` in `degrees()` (`parentPcs` itself stays: other
callers). In tests: `DEGREE_EXCEPTIONS` and three tests (appendix A.2). `minorRelative` SURVIVES, read only by
`outsideNumeral` as the both-sides tie-break; mutant `n_major_relative_always` proves it live.

## 5. Lane

One serial lane. Engine regions, the `const DECKS` line, the PDFs, the face digests and the data mutants are all
generated from `src/engine/naming.js` and `data/decks.json`, and three of them live in `index.html`; two lanes
would both write `index.html` and `tests/mutants/`. No parallelism is available.

**Lane NU. Branch `claude/numerals-a`. Base `main` at or after `068aebd`.**
Worktree: `git worktree add --detach ../hc-numerals origin/main && git -C ../hc-numerals switch -c claude/numerals-a`.
House rules: parent plan `docs/plans/2026-10-05-refactor-pass-3.md` sections 2.1, 4.3, 5, with the five stated
exceptions P5, P6, P7, P13, P14 (section 10).

**Owns**
- `src/engine/naming.js`: the section from the header comment `/* ---- degree reference scales (D8)` through
  `numeral`; inside `degrees()` only the `minorRelative` comment, the `var parent` line and the `var num` line.
- `index.html`: the `<!-- engine:naming -->` region (via `tools/inline_engine.py` only) and the `const DECKS`
  line (via `tools/sync_decks.py` only). Nothing else in the file.
- `data/decks.json`: five `degrees` values (step NU-2). Nothing else.
- `tests/naming.test.js`: the header comment sentence on exceptions, `DEGREE_EXCEPTIONS`, and the tests named
  in appendix A.2.
- `tests/test_deck_data.py`: the `DEGREES` table and its comment.
- `tests/test_fixture_integrity.py`: whole file. `tests/fixtures/golden_decks_v4.json` (renamed to `_v5`).
- `tests/fixtures/print_decks_v1.json`: five `degrees` values. `tests/fixtures/card_face_v1.json` (via
  `tools/regen_card_fixture.js` only).
- `CSharp_Hijaz_*`, `D_Amara_*` PDFs in the repo root, the four that `git status` lists after NU-2 (via
  `tools/decks.py` only).
- `tests/mutants/`: `n_numeral_from_reference_scale.patch` (deleted), `f1b_numeral_minor_flat.patch`,
  `n_major_relative_always.patch`, seven new `nu_*.patch`, `c_deck_data_drift.patch`, `f_fixture_sha.patch`, the
  eleven `b_*.patch` that `tools/regen_data_mutants.py` writes, and whatever `tools/refresh_mutants.py` rewrites
  (expected: `n_subtitle_cap_25.patch` only).
- `tools/regen_data_mutants.py`: the comment string in the `b_degree_missing` entry.
- `docs/ENGINE-SPEC.md` section 10. `docs/SCALE_ENGINE_PLAN.md` rows D8 and D10.
- `tests/suite_health.py`: the `"tests/naming.test.js"` FLOORS row. `README.md`: the mutant count in the
  `**Mutation gate**` bullet.

### Step NU-1: the engine rule

**Fact.** Section 4, "Rule". Baseline on `068aebd`:
`node --test --test-reporter=tap tests/naming.test.js | grep -E '^# (tests|fail) '` prints `# tests 32`, `# fail 0`.

**Red first (commit 1).** Apply appendix A.2 to `tests/naming.test.js`. Adds six tests, deletes three, changes
two bodies, replaces `DEGREE_EXCEPTIONS` with `BUILTIN_DEGREES`. New names:
- `NU-1 every built-in degree label is the engine output with no exception` (18 labels)
- `NU-1 a step of the parent reads as that step numeral with no accidental` (11 parents x 7 steps x 2 tonics)
- `NU-1 outside the parent a minor third on the pan picks sharp over flat` (green before and after: it pins
  behaviour that must not move)
- `NU-1 no two pitch classes on one pan share a label` (45056 maps)
- `NU-1 numeral: offset 6 sits between two parent steps, and minorRelative picks the branch`
- `NU-1 numeral: outside the parent with a step on one side only`

Accept (red): `node --test --test-reporter=tap tests/naming.test.js | grep -E '^# (tests|pass|fail) '` prints
`# tests 35`, `# pass 28`, `# fail 7`. The seven: five of the six NU-1 tests (all but "picks sharp over flat"),
`D8 in-parent: a chromatic parent degree is numbered by its degree index`, and
`the parent override can change a numeral when the degree index moves`.
`tests/mutation_harness.test.js` is also red from this commit until NU-3 (three mutant headers name deleted
tests); that is expected and closed by NU-3.

**Change (commit 2).** Apply appendix A.1 to `src/engine/naming.js`, then `python3 tools/inline_engine.py`.
The rule, in full:

```js
function numeral(offset, parentIntervals, minorRelative) {
  var at = indexOfPc(parentIntervals, offset);
  if (at >= 0) return {accidental: "", roman: ROMAN[at]};
  return outsideNumeral(offset, parentIntervals, minorRelative);
}
function outsideNumeral(offset, parentIntervals, minorRelative) {
  var below = indexOfPc(parentIntervals, pc(offset - 1));
  var above = indexOfPc(parentIntervals, pc(offset + 1));
  if (below >= 0 && above >= 0) {
    return minorRelative
      ? {accidental: "#", roman: ROMAN[below]}
      : {accidental: "b", roman: ROMAN[above]};
  }
  if (above >= 0) return {accidental: "b", roman: ROMAN[above]};
  return {accidental: "#", roman: ROMAN[below]};
}
```

**Accept.**
- `python3 tools/inline_engine.py --check` last line: `engine regions in index.html match src/engine/: OK`
- `node --test --test-reporter=tap tests/naming.test.js | grep -E '^# (tests|pass|fail) '`: `# tests 35`,
  `# pass 35`, `# fail 0`
- `node --test --test-reporter=tap tests/select.test.js | grep -E '^# (tests|fail) '`: `# tests 51`, `# fail 0`
- `node tools/regen_card_fixture.js --check` exits 0 (no built-in face and no pinned generated face moves yet)
- `python3 tools/validate.py` last line: `validate.py: all checks passed`
- `grep -c 'MAJOR_REF\|MINOR_REF\|parentDegreeIndex' src/engine/naming.js index.html` prints `src/engine/naming.js:0` and `index.html:0`

**Verify.** `node --test --test-reporter=tap tests/naming.test.js | grep -E '^# fail '` prints `# fail 0`.

**Forces.** `index.html` engine region (tool: `inline_engine.py`). Mutants `f1b_numeral_minor_flat`,
`n_major_relative_always`, `n_numeral_from_reference_scale` no longer apply or name deleted tests;
`n_subtitle_cap_25` needs a context refresh. All handled in NU-3.

**STOP.** If `# fail` is not 0 after commit 2, or `regen_card_fixture.js --check` reports a stale
`gen_face_v1.json`: the tree is not the one this plan measured. Stop, do not regenerate the fixture, report the
failing test names and `git log -1 --format=%H origin/main` to the integrator.

### Step NU-2: built-in labels

**Fact.** `data/decks.json` holds each of these strings exactly once (counted):
`"2": "bII"`, `"11": "bvii"`, `"7": "IV"`, `"0": "bVII"`, `"5": "bIII"`. The same five occur exactly once each in
`tests/fixtures/golden_decks_v4.json` and in `tests/fixtures/print_decks_v1.json`. `golden_decks_v4.json` is read
only by `tests/test_fixture_integrity.py` and named only by `tests/mutants/f_fixture_sha.patch`; the JS tests read
the frozen `golden_decks_v3.json`, which does not change.
Baselines on `068aebd`: `python3 -m unittest tests.test_deck_data 2>&1 | grep -c '^OK$'` prints `1` (Ran 25);
`python3 -m unittest tests.test_fixture_integrity 2>&1 | grep -c '^OK$'` prints `1` (Ran 8).

**Red first (commit 3).**
1. `tests/test_deck_data.py`: apply appendix A.3 (the `DEGREES` table).
2. `git mv tests/fixtures/golden_decks_v4.json tests/fixtures/golden_decks_v5.json`; in it replace
   `"version": 4,` with `"version": 5,`, make the five replacements below, and replace the `"sha256"` value
   `d9fe93bd3c8cbbe366498cdd4c2101af6c9d262964f72624319af346b929861e` with
   `050d476260a4fffe7b3ff1457fb76aaaed2d2058afb4e3923ba165deaf3a49e6`.
3. `tests/test_fixture_integrity.py` and `tests/mutants/f_fixture_sha.patch`: apply appendix A.4.
4. `tests/fixtures/print_decks_v1.json`: the five replacements below (edited in place, as commits `1cbf20e`,
   `bbb9545`, `606b94a` did before).

The five replacements, used verbatim in every file this step and NU-3 name:

| old | new |
|---|---|
| `"2": "bII"` | `"2": "II"` |
| `"11": "bvii"` | `"11": "vii"` |
| `"7": "IV"` | `"7": "iv"` |
| `"0": "bVII"` | `"0": "VII"` |
| `"5": "bIII"` | `"5": "III"` |

Accept (red): `python3 -m unittest tests.test_deck_data 2>&1 | grep '^FAILED'` prints `FAILED (failures=3)`
(`DegreeTest` for hijaz and amara, `PrintDeckSnapshotTest`); `python3 -m unittest tests.test_fixture_integrity
2>&1 | grep '^FAILED'` prints `FAILED (failures=2)` (the deep-equal tests for hijaz and amara; both sha tests pass,
which proves the new digest matches the edited fixture).

**Change (commit 4).** In this order:
1. `data/decks.json`: the five replacements.
2. `python3 tools/sync_decks.py`
3. `(cd tools && python3 decks.py)`; last line `full: 3 7 3 | printer: 3 6 3`
4. `git checkout -- 'F3_Low_Pygmy_18_Cards_Letter.pdf' 'F3_Low_Pygmy_18_CHORD_ONLY_Letter.pdf'` (the tool
   restamps all six; the Pygmy text is unchanged, so the committed bytes stay)
5. `node tools/regen_card_fixture.js`
6. Commit `data/decks.json`, `index.html`, the four Hijaz and Amara PDFs, `tests/fixtures/card_face_v1.json`.

**Accept.**
- `python3 tools/sync_decks.py --check` before step 2 prints `DECKS in index.html differs from data/decks.json
  (13861 bytes embedded vs 13857 canonical) - run \`python3 tools/sync_decks.py\``; after it, last line
  `DECKS in index.html matches data/decks.json: OK`
- `git status --short | grep -c '\.pdf$'` prints `4` after step 4
- `git diff --numstat tests/fixtures/card_face_v1.json` prints `316	316	tests/fixtures/card_face_v1.json`;
  `git status --short tests/fixtures/` lists `card_face_v1.json` only (this holds once commit 3 is made;
  before it the renamed fixture and `print_decks_v1.json` are listed too)
- `node tools/regen_card_fixture.js --check` exits 0
- `python3 tools/validate.py` last line: `validate.py: all checks passed`
- after commit 4, each prints `1`: `python3 -m unittest tests.test_deck_data 2>&1 | grep -c '^OK$'`,
  and the same for `tests.test_fixture_integrity`, `tests.test_print`, `tests.test_render_agreement`,
  `tests.test_gen_deck`, `tests.test_pdf_parity`, `tests.test_pdf_build`
- `node --test --test-reporter=tap tests/app.test.js | grep -E '^# (tests|fail) '`: `# tests 282`, `# fail 0`;
  `tests/pdf_builtin.test.js`: `# tests 13`, `# fail 0`; `tests/pdfcards.test.js`: `# tests 16`, `# fail 0`
- `node tools/boot_sim.js | tail -1`: `exercised 96 cards x 2 modes; no German, SVG + deck colours present, shuffle OK`

**Verify.** `python3 tools/validate.py >/dev/null && python3 -m unittest tests.test_deck_data tests.test_fixture_integrity tests.test_pdf_build 2>&1 | grep -c '^OK$'` prints `1`.

**Forces.** The `const DECKS` line (tool: `sync_decks.py`); four PDFs (tool: `decks.py`);
`card_face_v1.json` (tool: `regen_card_fixture.js`); eleven `b_*` data mutants and `c_deck_data_drift.patch`
(NU-3).

**STOP.**
- A replacement string occurs other than once in a file: stop, change nothing, report the count.
- `git status` lists a Pygmy PDF after step 4, or `card_face_v1.json` numstat is not `316 316`, or
  `gen_face_v1.json` / `pan_render_v1.json` show a diff: a non-label output moved. Stop and report; do not commit.
- `tests.test_pdf_build` fails after commit 4: run `(cd tools && python3 decks.py)` once more, repeat step 4,
  amend nothing, add a new commit. If it still fails, stop and report the test's diff output.

### Step NU-3: mutants

Both mutant tools refuse a dirty tree (`REFUSING: tracked files already modified`), so every sub-step commits.

**Fact.** `ls tests/mutants | wc -l` prints `672` on `068aebd`.

**Change.**
1. Commit 5 (hand-written files):
   - `git rm tests/mutants/n_numeral_from_reference_scale.patch`
   - overwrite `f1b_numeral_minor_flat.patch` and `n_major_relative_always.patch`, and add the seven `nu_*.patch`,
     all verbatim from appendix B
   - `tests/mutants/c_deck_data_drift.patch`: the five replacements; each old string occurs exactly twice (the
     `-` and the `+` DECKS line)
   - `tools/regen_data_mutants.py`: in the `b_degree_missing` entry, `# Amara loses the IV degree,` becomes
     `# Amara loses the iv degree,`
2. `python3 tools/regen_data_mutants.py`; expected lines `regenerated 11 mutants; tree clean: True` and
   `all 11 data mutants apply cleanly`. Commit 6.
3. `python3 tools/refresh_mutants.py`; it rewrites `n_subtitle_cap_25.patch`. Commit 7.
4. For each of the nine appendix B patches: `git apply tests/mutants/<name>.patch`, run its `# suite:` line with
   `--test-reporter=tap` inserted after `node --test`, keep the `not ok` line for the PR body,
   `git apply -R tests/mutants/<name>.patch`. (The bare line uses node's default reporter, which prints a cross
   mark and no `not ok`.)

**New and rewritten mutants (one per branch of the rule).**

| patch | branch mutated | killed by | why that test |
|---|---|---|---|
| `nu_step_reads_outside` (replaces `n_numeral_from_reference_scale`) | the in-parent early return is removed | `D8 in-parent: a chromatic parent degree is numbered by its degree index` | a parent step then goes through `outsideNumeral` and gains an accidental |
| `nu_step_keeps_flat` | in-parent accidental `minorRelative ? "" : "b"` | `NU-1 a step of the parent reads as that step numeral with no accidental` | restores the old Hijaz `bII` look on a pan with no minor third |
| `nu_numeral_ignores_parent` | `degrees()` passes `PARENTS[0].intervals` | `NU-1 every built-in degree label is the engine output with no exception` | every non-Ionian built-in reads Ionian steps |
| `f1b_numeral_minor_flat` (rewritten) | both-sides branch ignores `minorRelative` | `NU-1 numeral: offset 6 sits between two parent steps, and minorRelative picks the branch` | asserts `#IV` and `bV` for the two flag values |
| `n_major_relative_always` (rewritten) | `var minorRelative = false;` in `degrees()` | `NU-1 outside the parent a minor third on the pan picks sharp over flat` | the Aeolian pan must read `#IV°` |
| `nu_outside_both_sides_guard` | `if (below >= 0) {` | `NU-1 numeral: outside the parent with a step on one side only` | harmonic minor offset 9 has a step below only; with `minorRelative` false the mutant returns `b` of a step that is not there |
| `nu_outside_one_side_flat` | last return gives `b` + `ROMAN[above]` | same test | offset 9 must read `#VI` |
| `nu_outside_drops_accidental` | above-only branch returns `accidental: ""` | `NU-1 no two pitch classes on one pan share a label` | the outside note then duplicates its neighbour's label; this is option B of Q1 |
| `nu_outside_label_dropped` | `degrees()` gains `if (noThirds && num.accidental) continue;` | same test | no label is duplicated, so only the assertion that the label keys equal the pan sees it; without that assertion every suite stayed green (review F4) |

**Accept.**
- `python3 tools/refresh_mutants.py --check` last line: `all mutant patches apply cleanly; nothing to refresh`
- `ls tests/mutants | wc -l` prints `678`
- `grep -l '^index ' tests/mutants/*.patch | wc -l` prints `0`
- `node --test --test-reporter=tap tests/mutation_harness.test.js | grep -E '^# (tests|fail) '`: `# tests 53`,
  `# fail 0`
- each of the nine suite commands in sub-step 4, run with `--test-reporter=tap`, exited non-zero and printed
  exactly one `not ok` line
- `git diff --name-only $(git merge-base origin/main HEAD) -- tests/mutants | wc -l` prints `24` (counted from the list, not run: 1 deleted,
  2 rewritten, 7 new,
  11 `b_*`, `c_deck_data_drift`, `f_fixture_sha`, `n_subtitle_cap_25`); under the parent plan's cap of 40

**Verify.** `python3 tools/refresh_mutants.py --check && node --test --test-reporter=tap tests/mutation_harness.test.js | grep -E '^# fail '` prints `# fail 0`.

**Forces.** Nothing further.

**STOP.**
- `refresh_mutants.py` prints `AMBIGUOUS` or `UNFIXABLE` for any patch: if it ran before sub-step 2, run
  sub-step 2 first (the eleven `b_*` cannot be re-anchored by it). If it still does for a patch not in the Owns
  list, stop and report the patch name; do not hand-rewrite a patch this lane does not own.
- A sub-step 4 suite exits 0: the mutant survives. Stop; do not weaken or retarget it; report.
- `tests/mutation_check.sh` is not run locally. CI's mutation gate at the head SHA is the evidence. A lone
  survivor in a patch outside the Owns list: rerun the failed job once at the same SHA before anything else.

### Step NU-4: docs and counts

**Fact and Change.** Literal old and new text is in appendix C.
1. `docs/ENGINE-SPEC.md` section 10: heading; the `DECIDED(D8)` numerals bullet; the frozen-exceptions bullet;
   the `DECIDED(owner-review 2026-09-08, ...)` bullet through "`IV`, where the engine derives `VII`, `III` and
   `iv`)."; plus a new per-deck label table (the one `tests/test_deck_data.py` now cites).
2. `docs/SCALE_ENGINE_PLAN.md`: a dated "SUPERSEDED 2026-10-05" sentence appended inside the `Decision` cell of
   rows D8 and D10. The rest of that file is history.
3. `tests/suite_health.py`: `"tests/naming.test.js": 32,` becomes `"tests/naming.test.js": 35,`.
4. `README.md`, `**Mutation gate**` bullet: `672 mutant patches` becomes `678 mutant patches`.
5. Final figures for 3 and 4 come from this PR's own CI artifacts (`js-results` `files[].total` for
   `tests/naming.test.js`; the count of `tests/mutants/*.patch` the mutation gate reports). If CI differs from
   35 or 678, set the file to CI's figure in a follow-up commit and say so in the PR body. A CI figure below the
   planned figure is a STOP: name the missing test or patch first.

**Red first.** None possible for prose. For 3: `python3 -m unittest tests.test_suite_health 2>&1 | grep -c '^OK$'`
prints `1` before and after (a floor, not an equality); the red-first evidence for the count is NU-1's
`# tests 35`.

**Accept.**
- `grep -c 'bIII\|bVII\|bII\|bvii' docs/ENGINE-SPEC.md` prints `2` (both in the new dated note that names the
  old labels)
- `grep -n 'Frozen degree exceptions' docs/ENGINE-SPEC.md | wc -l` prints `0`
- `python3 -m unittest tests.test_suite_health tests.test_readme_currency 2>&1 | grep -c '^OK$'` prints `1`
  (P15; run on `068aebd`)

**Verify.** `python3 -m unittest tests.test_readme_currency tests.test_suite_health 2>&1 | grep -c '^OK$'` prints `1`.

**Forces.** Nothing.

**STOP.** If `main` has moved the FLOORS row or the README count since `068aebd`: merge main, take main's
side of both lines, push, and set both from the CI artifacts of that run (item 5). Do not compute them as
"old figure plus delta".

### Sync order, in one place

1. `src/engine/naming.js` → `python3 tools/inline_engine.py` → `python3 tools/inline_engine.py --check`
2. `data/decks.json` → `python3 tools/sync_decks.py` → `python3 tools/sync_decks.py --check`
3. `(cd tools && python3 decks.py)` → restore the two Pygmy PDFs → `python3 -m unittest tests.test_pdf_build`
   (after commit)
4. `node tools/regen_card_fixture.js` → `node tools/regen_card_fixture.js --check`
5. commit → `python3 tools/regen_data_mutants.py` → commit → `python3 tools/refresh_mutants.py` → commit →
   `python3 tools/refresh_mutants.py --check`
6. `python3 tools/validate.py`

After any merge of main into the branch: rerun 1, 2, 4, 5 and 6 in that order; resolve a conflict in the engine
region or the DECKS line by taking either side and rerunning the tool.

### Reviewer must check (at the head SHA)

1. `git diff $(git merge-base origin/main HEAD) -- data/decks.json` shows exactly five changed lines, all `degrees` values, matching the
   table in NU-2.
2. `git diff $(git merge-base origin/main HEAD) --stat -- '*.pdf'` lists four files, none of them Pygmy.
3. `git diff $(git merge-base origin/main HEAD) -- index.html` touches only the `engine:naming` region and the `const DECKS` line, and
   `inline_engine.py --check`, `sync_decks.py --check`, `regen_card_fixture.js --check`,
   `refresh_mutants.py --check`, `validate.py` all pass.
4. `tests/fixtures/card_face_v1.json`: every changed digest belongs to hijaz or amara; `gen_face_v1.json` and
   `pan_render_v1.json` are unchanged.
5. `tests/naming.test.js` contains no `DEGREE_EXCEPTIONS`; the three deleted tests are exactly those in appendix
   A.2; no other test was removed, skipped or loosened (`git diff $(git merge-base origin/main HEAD) -- tests | grep -c '^+.*\.skip\|^+.*todo'`
   prints `0`).
6. `src/engine/naming.js` has no `MAJOR_REF`, `MINOR_REF` or `parentDegreeIndex`; `minorRelative` decides a branch
   only inside `outsideNumeral`.
7. No file outside the Owns list changed: `git diff --name-only $(git merge-base origin/main HEAD)` against the list.
8. `CLAUDE.md` is unchanged.
9. The PR body carries nine `not ok` lines, one per appendix B patch, and `ls tests/mutants | wc -l` prints `678`.
12. In `tests/naming.test.js`, the test `NU-1 no two pitch classes on one pan share a label` asserts that the
    label keys equal the pan before it asserts uniqueness.
10. No "Amy" string was added: `git diff $(git merge-base origin/main HEAD) | grep -c '^+.*[Aa]my'` prints `0`.
11. CI conclusion for this exact SHA is success, mutation gate included.

### Size and cuts

About 14 hand-edited files plus generated output; 7 to 8 commits; one PR. Nothing in NU-1 to NU-3 can be cut:
each leaves a gate red without the next. NU-4 item 2 (`docs/SCALE_ENGINE_PLAN.md` notes) may be cut if a reviewer
objects to touching that file; items 1, 3 and 4 may not.

## 6. Merge gates

Parent plan `docs/plans/2026-10-05-refactor-pass-3.md` section 6, gates 1 to 4, 6 and 7, unchanged.
Gate 5 is replaced by the AFK regroup rule: a third failed review of this PR ends the bounce; the integrator
writes an investigation prompt, drafts a subplan from its findings, holds both to a stated 10/10 rubric, and
runs an engineering review on the subplan before the lane resumes. A reviewer FAIL is never mergeable.

## 7. Risks

- Share URLs and saved custom pans re-derive labels, so a returning user's custom deck changes labels on next
  load. Example: a custom pan `(D3) A3 C4 D4 E4 G4 A4 C5 D5` shows C as `VII` where it showed `bVII`. Intended.
- 715 of 2938 out-of-parent labels (inferred parent, tonic-0 enumeration) gain an accidental they lack today.
  None is on a committed fixture or on a `tools/gen_deck.js` preset. This is the price of uniqueness under option A.
- e2e was not run by the planner (section 12). No e2e test holds a label literal; CI at the head SHA decides.

## 8. Docs that become false

| file | text | action |
|---|---|---|
| `docs/ENGINE-SPEC.md` section 10 | heading "numerals (D8)"; "Degree NUMERALS are mode-aware: minor-relative (`III`, `VII`) for scales with a minor third, major-relative with flats (`bIII`, `bVII`) otherwise."; "Frozen degree exceptions, two-sided: D Amara ships `bIII` / `bVII` (D8) and `IV` where stacked thirds derive `iv` (D10)."; "Numerals are read against the D8 REFERENCE scale ..." with its (a), (b) and "Both readings reproduce 14 of the 17 built-in degree labels ..." | NU-4, appendix C |
| `docs/SCALE_ENGINE_PLAN.md` | row D8; row D10 "Amara `IV` is a second frozen exception"; lane C row "modulo a two-sided recorded exception list"; "Fallback degrees for no-third / atonal scales ... major-relative with flats, uppercase" | D8 and D10 get a superseded note (binding table); the other two are history |
| `CLAUDE.md` | "Scale degrees per deck: Hijaz {C#:I, D:bII, F:iii° ..., F#:iv, G#:v deg, B:bvii}; ... Amara {D:i, A:v, G:IV, C:bVII, F:bIII}." | Q2, not edited |
| `tests/test_deck_data.py` | comment "CLAUDE.md > \"Scale degrees per deck\", keyed by note name." | NU-2 |
| `README.md`, `TODOS.md`, `tests/CONTRACT.md` | no degree-label sentence (README: mutant count only) | NU-4 item 4 |
| `docs/plans/*`, `docs/prompts/*`, `tools/research/engine_measure/t6_degrees.py` | many | history, not rewritten |

## 9. Open questions for the owner

**Q1. A root outside the parent scale.** Section 1 has the example and the table. Recommendation: A (keep an
accidental on that note only). It is the only option where every root has a label and no two roots share one.
Meanwhile the lane ships A. If overturned to B: blank the three `accidental` values; decide which neighbour an outside note between two steps
takes (a further owner choice; `minorRelative` stays live until then); delete both assertions of the uniqueness
test's inner loop, plus the mutants and tests listed. The two assertions are the `Set` one and the `/^[b#]/` one;
the check that every pan pitch class has a label stays. Listed: delete mutant `nu_outside_drops_accidental` (its
mutation becomes the code); in tests "picks sharp over flat", "offset 6 ...", "one side only", "D8 in-parent
..." and "the parent override can change a numeral ..." every expected outside label loses its accidental;
mutants `f1b_numeral_minor_flat`, `n_major_relative_always`, `nu_outside_one_side_flat`,
`nu_outside_both_sides_guard` and `nu_outside_label_dropped` stay, since each still changes a roman or drops a label.
If C: `outsideNumeral` returns `null` and `degrees()` skips the key. `minorRelative` is then dead: delete it from
`numeral`, `outsideNumeral` and `degrees()`, and delete mutants `f1b_numeral_minor_flat`, `n_major_relative_always`,
`nu_outside_drops_accidental`, `nu_outside_one_side_flat`, `nu_outside_both_sides_guard`. In the uniqueness test
the label-for-every-pitch-class assertion becomes "a label for exactly the pan pitch classes inside the parent",
the `/^[b#]/` assertion becomes "no label has an accidental", and `nu_outside_label_dropped` is rewritten to
drop an in-parent label. Tests "picks sharp over flat", "offset 6 ..." and "one side only" are deleted; the
outside-label expectations in "D8 in-parent ..." and "the parent override can change a numeral ..." are removed.
Add a render test for a card whose root has no degree. (The first draft of this recipe said "same deletions" as B
and had the same fault as the B recipe; both are corrected here.)

**Q2. `CLAUDE.md` "Scale degrees per deck".** False after merge. Recommendation: authorise replacing that bullet
with: "Scale degrees per deck (2026-10-05: the root's step in the parent scale, case from the parent's stacked
thirds, `°` for diminished, no accidentals): Hijaz {C#:I, D:II, F:iii°, F#:iv, G#:v°, B:vii}; Pygmy {F:i,
Ab:III, Bb:iv, C:v, Db:VI, Eb:VII, G:ii°}; Amara {D:i, F:III, G:iv, A:v, C:VII}." Meanwhile the lane leaves
`CLAUDE.md` alone and the PR body names the stale bullet.

**Q3. `+` for an augmented degree.** The engine cannot print it; an augmented step reads plain uppercase
(`III` on `Bbaug`, section 4). No built-in is affected (Hijaz A would be `VI+`; A is not on the pan).
Recommendation: leave out of this change; decide separately. Meanwhile: nothing.

**Q4. Case says the scale's chord, not the card's.** Hijaz D reads `II` (major in the scale) on cards `D°`,
`D°7`; Amara G reads `iv` (minor in the scale) on cards `G5`, `Gsus4`, `G7sus4`. This is existing behaviour
and matches the owner's reading, "I thought the Roman numerals map to the seven diatonic chords of the scale".
Recommendation: keep. Meanwhile: kept.

Closed, recorded for completeness: `°` stays (owner 2026-10-06, section 1). Appendix D has the cost of V2.

## 10. Decisions taken by the planner

- **P1. Out-of-parent rule = parent-neighbour, not today's reference-scale naming.** Reason: correction 2; it
  is the only reading of the default that is collision-free (0 of 45056), it equals today's label wherever
  today's label had an accidental (2223 of 2223 under the inferred parent, 29521 of 29521 under the ten other
  parents as an override, over the 2048 tonic-0 pans; the remaining 715 and 23861 had none today), and it changes
  no out-of-parent label on any committed deck.
- **P2. One function holds the undecided rule.** Reason: brief item 5, "design so overturning it is a small
  change".
- **P3. Tie-break when a parent step lies on both sides keeps `minorRelative`** (`#` with a minor third on the
  pan, else `b`). Reason: it is today's behaviour for that case; no owner decision changes it.
- **P4. Fixture bumped to `golden_decks_v5.json`, not edited in place.** Reason: the fixture's own rule
  (`BUMP` message in `tests/test_fixture_integrity.py`: "do not edit in place").
- **P5. Exception to parent 2.1 "No test is renamed".** `test_sha256_is_the_pinned_v4_digest` becomes
  `..._v5_digest`, and two JS tests are replaced by NU-1-prefixed successors. Reason: their names state the
  version or the rule that no longer exists.
- **P6. Exception to parent 2.1 "No mutant is deleted".** `n_numeral_from_reference_scale` is deleted and
  replaced by `nu_step_reads_outside`. Reason: its mutation is the reference-scale code that no longer exists.
- **P7. Exception to "no test is deleted".** Three tests assert the D8 rule or the exception list itself
  (appendix A.2). Each has a stricter successor; net +3 tests.
- **P8. `print_decks_v1.json` edited in place.** Reason: precedent (`1cbf20e`, `bbb9545`, `606b94a`); it is a
  snapshot of the print adapter, not a versioned corpus.
- **P9. Only four PDFs committed.** Reason: owner decision 4, Pygmy does not change; the Pygmy text diff is empty.
- **P10. No new select-level or e2e test.** Reason: `select.build` passes `naming.degrees()` through untouched,
  and the "every built-in label is engine output" test already runs through the same parent inference.
- **P11. New mutant prefix `nu_`.** Reason: no existing prefix means this lane; parent 5 names by lane.
- **P12. `docs/SCALE_ENGINE_PLAN.md` rows get a superseded note; nothing there is rewritten.** Reason: its header
  calls the decisions table binding, so a reader must be told; the rest is history.
- **P13. Exception to parent 2.1 "No change to deck data":** five `degrees` values change, by owner decisions 1
  and 2.
- **P14. Exception to parent 2.1 "No edit to FLOORS or the README count outside lane CL":** this plan has no
  closing lane; NU-4 is the closing step.
- **P15. Python accept lines count `^OK$` instead of reading the last line.** Reason: measured on `068aebd`,
  `python3 -m unittest tests.test_suite_health tests.test_readme_currency 2>&1 | tail -1` and the same run with
  `2>&1 >/dev/null | tail -1` both print `node: ran 0 in total, aggregate floor 12` (3 of 3 runs; a child's
  stderr line that lands after `OK`), and the NU-2 Verify run ended in a `DeprecationWarning`
  line. `2>&1 | grep -c '^OK$'` printed `1` for every module list this plan uses.

**Review.** An engineering review of this plan was run by a fresh agent on 2026-10-06 and returned
READY_WITH_CHANGES with eleven findings (F1 to F11). All eleven are folded in. One was applied in a different
form from the one it named: F2's `2>&1 >/dev/null | tail -1` does not print `OK` here (P15).

## 11. Self-score

1. Evidence for every fact: **9.** Every number here came from a run; the runs' raw output is not attached, and
   section 4's "no `degrees` reference in six modules" is a grep, the kind of claim the repo's own memory warns
   about. Closing it: a reviewer reruns the greps at the head SHA (Reviewer item 7 bounds the damage).
2. Label table complete and from code: **10.** Built-ins, 8 gen_face decks, the 6 `tools/gen_deck.js` presets, 11 parents x 7 steps,
   2048-pan enumeration, all via `select.build` / `naming.degrees` old against new.
3. Everything affected listed: **9.** Enumerated by reading each reader, not one grep; e2e was read for literals
   but not run, so a rendered-text assertion built at runtime could exist. Closing it: CI e2e at the head SHA.
4. Accept commands pasteable, "before" run on main: **8.** The review found two accept lines that could not pass
   as written (a bare `# suite:` prints no `not ok`; `tail -1` after unittest does not print `OK`), and the
   form the review proposed for the second also fails here (P15). Both are replaced by forms run on `068aebd`.
   NU-3's accept lines and `tests.test_pdf_build` going green were observed in a throwaway copy with its own git
   history, not in a real lane branch; the 24-file figure is counted, not run; NU-4's two grep counts are
   predicted from appendix C text. Closing it: the lane's run.
5. No judgment call left: **9.** Literal text or a verbatim patch for every edit. Appendix C's ENGINE-SPEC
   replacement is prose the lane pastes; a reviewer may still ask for wording changes.
6. No dead code, no weakened test, tests first: **9.** Dead items named and deleted with a grep accept;
   `minorRelative` proven live by a mutant; +3 tests; every step red first where a test can be red. The review
   found one fault no test saw (a dropped outside label under `NO_THIRDS`); it now has an assertion and a
   mutant, but it shows the first draft's 10 was too high.
7. No regression: **9.** Pygmy digests 0 changed, `gen_face`/`pan_render` no diff, Pygmy PDF text identical.
   e2e not run locally.
8. Ownership disjoint and complete: **10.** One lane; generated files written only by their tools; Owns names
   anchors, no line numbers.
9. Owner decisions quoted, undecided isolated, nothing extra: **9.** Quoted, and after review every quoted owner
   phrase is the owner's own wording or a substring of it (the first draft quoted the brief twice); Q1 isolated in one function. P1
   departs from the brief's literal default; it is argued and flagged, but the owner has not seen it.
10. Plain, short, exact prose: **9.** Long because every edit is literal. No line numbers in steps.

## 12. Not run, and why

- The full e2e suite and any single e2e test: the brief forbids the full suite and browser tools.
- `tests/mutation_check.sh`: forbidden by the brief. Each of the nine hand-written mutants was applied and its
  `# suite:` run by hand instead (one `not ok` each).
- `tools/regen_data_mutants.py` and `tools/refresh_mutants.py` in write mode, and `tests.test_pdf_build` going
  green, inside the real repo: they need commits, which the brief forbids. Run instead in a standalone copy
  (`rsync --exclude .git`, `git init`, commit) with the outputs quoted in NU-3.
- CI artifact figures for FLOORS and the README count: they exist only after the lane's PR runs.
- The NU-4 accept greps: they depend on appendix C being applied.

## Appendix A. Source and test diffs (verbatim; apply with `git apply`)

All five were produced by `git diff` on `068aebd`; each block, extracted from this file, passes
`git apply --check` on `068aebd`. `index` lines are stripped. Copies also sit in `<scratch>/numerals/patches/`
and `<scratch>/numerals/mutants/`, where `<scratch>` is
`/private/tmp/claude-501/-Users-ray-Projects-handpan-cards/3347d7d0-1ec9-4967-bd81-dd4cf98e29d7/scratchpad`.

### A.1 `src/engine/naming.js`

````diff
diff --git a/src/engine/naming.js b/src/engine/naming.js
--- a/src/engine/naming.js
+++ b/src/engine/naming.js
@@ -79,11 +79,9 @@ var HPE = (typeof HPE !== "undefined") ? HPE : {};
   // place (select.js) and that call only runs for generated decks.
   var SUBTITLE_MAX = 41;
 
-  /* ---- degree reference scales (D8) ------------------------------------- */
+  /* ---- degree numerals (section 10) -------------------------------------- */
 
   var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
-  var MAJOR_REF = [0, 2, 4, 5, 7, 9, 11];
-  var MINOR_REF = [0, 2, 3, 5, 7, 8, 10];
 
   // Finding 10 (2026-09-30 quality-refactor plan): pc now lives once, in
   // HPE.core; naming.js always loads after it (every caller's loadEngine
@@ -108,40 +106,33 @@ var HPE = (typeof HPE !== "undefined") ? HPE : {};
     return false;
   }
 
-  /* Section 10 as amended (D8, coordination row 28): a pitch class that is IN
-   * the parent is numbered by its PARENT-DEGREE INDEX - degree 2 of the parent
-   * is a II whatever its size - and the accidental is its offset against the
-   * D8 reference degree of the SAME index: -1 gives `b`, +1 gives `#`, 0 none.
-   * That is what a player expects: F Phrygian's Gb is `bII`, not the `#I` the
-   * reference scale alone would produce.
+  /* Section 10 (owner decision 2026-10-05, "No accidentals at all"): a pitch
+   * class that is a STEP of the parent reads as that step's numeral - step 2 of
+   * the parent is a II whatever its size - and never carries `b` or `#`.
    *
-   * A pitch class OUTSIDE the parent keeps the older mechanism: it is named
-   * from the reference degree it is one semitone away from - one semitone
-   * BELOW degree N is `bN`, one semitone ABOVE is `#N`; when both apply the
-   * accidental convention decides, `b` for a major-relative scale (D8 flats)
-   * and `#` otherwise. A pitch class that IS a reference degree carries no
-   * accidental.
+   * `parentIntervals` is the parent's seven intervals above the tonic and
+   * `offset` the pitch class's own interval above the tonic.
    *
    * Returns the numeral split so the caller can case the roman part without
    * touching the accidental. */
-  function numeral(offset, minorRelative, parentDegreeIndex) {
-    var ref = minorRelative ? MINOR_REF : MAJOR_REF;
-    var exact = -1, below = -1, above = -1, i;
-    if (parentDegreeIndex !== undefined && parentDegreeIndex !== null &&
-        parentDegreeIndex >= 0) {
-      var diff = pc(offset - ref[parentDegreeIndex]);
-      if (diff > 6) diff -= 12;
-      return {
-        accidental: diff === 0 ? "" : (diff < 0 ? "b" : "#"),
-        roman: ROMAN[parentDegreeIndex]
-      };
-    }
-    for (i = 0; i < ref.length; i += 1) {
-      if (ref[i] === offset) exact = i;
-      if (ref[i] === pc(offset - 1)) below = i;   // offset sits one ABOVE ref[i]
-      if (ref[i] === pc(offset + 1)) above = i;   // offset sits one BELOW ref[i]
-    }
-    if (exact >= 0) return {accidental: "", roman: ROMAN[exact]};
+  function numeral(offset, parentIntervals, minorRelative) {
+    var at = indexOfPc(parentIntervals, offset);
+    if (at >= 0) return {accidental: "", roman: ROMAN[at]};
+    return outsideNumeral(offset, parentIntervals, minorRelative);
+  }
+
+  /* A pitch class OUTSIDE the parent is not a step, so it is the one label
+   * that carries an accidental: it is named from the parent step it is one
+   * semitone away from - one semitone BELOW step N is `bN`, one semitone ABOVE
+   * is `#N`; when both apply, `#` on a pan with a minor third over the tonic
+   * and `b` otherwise. Every parent step is at most three semitones from the
+   * next, so one of the two neighbours always exists.
+   *
+   * This function is the whole of the out-of-parent rule: a different rule
+   * replaces this body and nothing else. */
+  function outsideNumeral(offset, parentIntervals, minorRelative) {
+    var below = indexOfPc(parentIntervals, pc(offset - 1));
+    var above = indexOfPc(parentIntervals, pc(offset + 1));
     if (below >= 0 && above >= 0) {
       return minorRelative
         ? {accidental: "#", roman: ROMAN[below]}
@@ -275,15 +266,15 @@ var HPE = (typeof HPE !== "undefined") ? HPE : {};
     var noThirds = !!options.noThirds;
     var pan = uniquePcs(pitchClasses);
     var tonic = pc(tonicPc);
-    // D8: minor-relative numerals when the PAN carries a minor third above the
-    // tonic, major-relative with flats otherwise.
+    // Only an out-of-parent pitch class reads this: with a parent step on both
+    // sides it takes `#` when the PAN carries a minor third above the tonic,
+    // `b` otherwise.
     var minorRelative = member(pan, pc(tonic + 3));
-    var parent = parentPcs(parentIndex, tonic);
+    var intervals = PARENTS[parentIndex].intervals;
     var out = {};
     for (var i = 0; i < pan.length; i += 1) {
       var degreePc = pan[i];
-      var num = numeral(pc(degreePc - tonic), minorRelative,
-        indexOfPc(parent, degreePc));
+      var num = numeral(pc(degreePc - tonic), intervals, minorRelative);
       var casing;
       if (noThirds) {
         // NO_THIRDS overrides D10: every numeral uppercase, no stacked thirds.
````

### A.2 `tests/naming.test.js`

````diff
diff --git a/tests/naming.test.js b/tests/naming.test.js
--- a/tests/naming.test.js
+++ b/tests/naming.test.js
@@ -42,10 +42,10 @@ function host(value) {
  *
  * Section 9: the editorial built-in subtitles are recorded exceptions of the
  * fixture, not strings the engine generates; Hijaz's two hand-authored (NO 5)
- * cards are excluded from the naming exit entirely. Section 10: D Amara ships
- * three frozen degree exceptions. Every entry below is asserted to ACTUALLY
- * differ from what the engine produces, so an exception that stops being one
- * turns the suite red instead of quietly hiding a match.
+ * cards are excluded from the naming exit entirely. Every entry below is
+ * asserted to ACTUALLY differ from what the engine produces, so an exception
+ * that stops being one turns the suite red instead of quietly hiding a match.
+ * Section 10 has no exception list: every built-in degree label is derived.
  */
 
 // deck id + card index -> excluded entirely (section 9, hand-authored (NO 5)).
@@ -66,12 +66,15 @@ const SUBTITLE_EXCEPTIONS = [
   {deck: "pygmy", subtitle: "Eb DOMINANT 7 - LOW VOICING"}
 ];
 
-// deck id + pitch class -> the frozen degree label (section 10, D8 and D10).
-const DEGREE_EXCEPTIONS = [
-  {deck: "amara", pc: "5", label: "bIII"},   // D8: derived III
-  {deck: "amara", pc: "0", label: "bVII"},   // D8: derived VII
-  {deck: "amara", pc: "7", label: "IV"}      // D10: derived iv
-];
+// deck id -> pitch class -> degree label (section 10; owner decision
+// 2026-10-05). Every label is a step of the deck's parent, so none carries an
+// accidental, and the engine derives all 18: there is no exception list.
+const BUILTIN_DEGREES = {
+  hijaz: {"1": "I", "2": "II", "5": "iii°", "6": "iv", "8": "v°", "11": "vii"},
+  pygmy: {"5": "i", "7": "ii°", "8": "III", "10": "iv", "0": "v", "1": "VI",
+          "3": "VII"},
+  amara: {"2": "i", "5": "III", "7": "iv", "9": "v", "0": "VII"}
+};
 
 /* ------------------------------ helpers ---------------------------------- */
 
@@ -320,51 +323,91 @@ test("distance counts PAN pitch classes outside the parent, not the reverse", ()
 
 /* ========================= section 10: degrees =========================== */
 
-test("every built-in degree label is reproduced, modulo the frozen exceptions", () => {
+test("NU-1 every built-in degree label is the engine output with no exception", () => {
   let reproduced = 0;
-  const exceptionsSeen = [];
   for (const deck of golden.decks) {
     const pcs = deckPitchClasses(deck);
     const tonic = tonicOf(deck);
     const produced = host(naming.degrees(pcs, tonic, naming.inferParent(pcs, tonic)));
-    for (const key of Object.keys(deck.degrees)) {
-      const expected = deck.degrees[key];
-      const exception = DEGREE_EXCEPTIONS.find(
-        (x) => x.deck === deck.id && x.pc === key);
-      assert.ok(produced[key] !== undefined,
-        `${deck.id}: no degree produced for pitch class ${key}`);
-      if (exception) {
-        assert.equal(exception.label, expected, `${deck.id}: stale exception label`);
-        assert.notEqual(produced[key], expected,
-          `${deck.id}: pitch class ${key} is a recorded exception but the ` +
-          "engine now derives it - remove it from DEGREE_EXCEPTIONS");
-        exceptionsSeen.push(deck.id + " " + key);
-      } else {
-        assert.equal(produced[key], expected, `${deck.id}: pitch class ${key}`);
-        reproduced += 1;
-      }
+    const expected = BUILTIN_DEGREES[deck.id];
+    for (const key of Object.keys(expected)) {
+      assert.equal(produced[key], expected[key], `${deck.id}: pitch class ${key}`);
+      reproduced += 1;
     }
   }
-  assert.equal(exceptionsSeen.length, DEGREE_EXCEPTIONS.length);
-  // CLAUDE.md "Design system": 5 + 7 + 5 labels, less Amara's three exceptions.
-  assert.equal(reproduced, 14);
-});
-
-test("D8: numerals are minor-relative only when the pan has a minor third", () => {
+  // 6 + 7 + 5 labels, every one derived.
+  assert.equal(reproduced, 18);
+});
+
+test("NU-1 a step of the parent reads as that step numeral with no accidental", () => {
+  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
+  // Every parent at every step, from tonic 0 and from a tonic that wraps.
+  for (const tonic of [0, 7]) {
+    host(naming.PARENTS).forEach((parent, index) => {
+      const pcs = parent.intervals.map((n) => (n + tonic) % 12);
+      const produced = host(naming.degrees(pcs, tonic, index));
+      parent.intervals.forEach((interval, step) => {
+        const label = produced[String((interval + tonic) % 12)];
+        assert.equal(label.replace("°", "").toUpperCase(), ROMAN[step],
+          `${parent.name} from ${tonic}: step ${step + 1} reads ${label}`);
+      });
+    });
+  }
+  // Hijaz has a major third over C# and Pygmy a minor third over F: neither
+  // changes a step numeral. D is step 2 and B step 7 of C# Phrygian dominant.
   const byDeck = {};
   for (const deck of golden.decks) {
     const pcs = deckPitchClasses(deck);
     byDeck[deck.id] = host(naming.degrees(pcs, tonicOf(deck),
       naming.inferParent(pcs, tonicOf(deck))));
   }
-  // Hijaz has a major third over C# (F = E#), so flats: D is bII, B is bvii.
-  assert.equal(byDeck.hijaz["2"], "bII");
-  assert.equal(byDeck.hijaz["11"], "bvii");
-  // Pygmy has Ab over F, so minor-relative: Ab is III and Eb is VII, no flats.
+  assert.equal(byDeck.hijaz["2"], "II");
+  assert.equal(byDeck.hijaz["11"], "vii");
   assert.equal(byDeck.pygmy["8"], "III");
   assert.equal(byDeck.pygmy["3"], "VII");
 });
 
+test("NU-1 outside the parent a minor third on the pan picks sharp over flat", () => {
+  const names = host(naming.PARENTS).map((p) => p.name);
+  // Gb is between steps 4 and 5 of both parents and outside both. C Aeolian
+  // carries Eb, a minor third over the tonic, so Gb is a raised 4; C Ionian
+  // does not, so Gb is a lowered 5.
+  const aeolian = [0, 2, 3, 5, 6, 7, 8, 10];
+  assert.equal(
+    host(naming.degrees(aeolian, 0, names.indexOf("Aeolian")))["6"], "#IV°");
+  const ionian = [0, 2, 4, 5, 6, 7, 9, 11];
+  assert.equal(
+    host(naming.degrees(ionian, 0, names.indexOf("Ionian")))["6"], "bv°");
+});
+
+test("NU-1 no two pitch classes on one pan share a label", () => {
+  // Every pan that holds its tonic (2048 of them) under every parent, with and
+  // without NO_THIRDS: 45056 label maps. A step never carries an accidental
+  // and a pitch class outside the parent always does, so none can collide.
+  let maps = 0;
+  for (let mask = 0; mask < 2048; mask += 1) {
+    const pan = [0];
+    for (let bit = 0; bit < 11; bit += 1) if (mask >> bit & 1) pan.push(bit + 1);
+    for (let index = 0; index < 11; index += 1) {
+      const intervals = host(naming.PARENTS)[index].intervals;
+      for (const noThirds of [false, true]) {
+        const produced = host(naming.degrees(pan, 0, index, {noThirds}));
+        const labels = Object.keys(produced).map((key) => produced[key]);
+        assert.deepEqual(Object.keys(produced).map(Number).sort((a, b) => a - b), pan);
+        assert.equal(new Set(labels).size, labels.length,
+          `pan ${pan} under parent ${index}: ${JSON.stringify(produced)}`);
+        for (const key of Object.keys(produced)) {
+          assert.equal(/^[b#]/.test(produced[key]),
+            !intervals.includes(Number(key)),
+            `pan ${pan} under parent ${index}: ${key} reads ${produced[key]}`);
+        }
+        maps += 1;
+      }
+    }
+  }
+  assert.equal(maps, 45056);
+});
+
 test("D10: case comes from stacked thirds over the parent", () => {
   const deck = golden.decks.find((d) => d.id === "hijaz");
   const pcs = deckPitchClasses(deck);
@@ -462,61 +505,72 @@ test("NO_THIRDS makes every numeral uppercase and drops D10", () => {
     host(naming.degrees(amaraPcs, amaraTonic, parent)));
 });
 
-test("numeral: offset 6 sits between two reference degrees, and minorRelative picks the branch (Q21)", () => {
-  // Section 10's "between two degrees" branch (naming.js:144 area): offset 6
-  // is a semitone above MINOR_REF's degree IV (5) and a semitone below
-  // MAJOR_REF's degree V (7) alike, so minorRelative alone decides which
-  // degree and which accidental sign the numeral takes.
-  assert.deepEqual(host(naming.numeral(6, true)), {accidental: "#", roman: "IV"});
-  assert.deepEqual(host(naming.numeral(6, false)), {accidental: "b", roman: "V"});
+test("NU-1 numeral: offset 6 sits between two parent steps, and minorRelative picks the branch", () => {
+  // Offset 6 is outside Ionian, a semitone above its step 4 (5) and a semitone
+  // below its step 5 (7), so minorRelative alone decides which step and which
+  // accidental the numeral takes.
+  const ionian = [0, 2, 4, 5, 7, 9, 11];
+  assert.deepEqual(host(naming.numeral(6, ionian, true)),
+    {accidental: "#", roman: "IV"});
+  assert.deepEqual(host(naming.numeral(6, ionian, false)),
+    {accidental: "b", roman: "V"});
+});
+
+test("NU-1 numeral: outside the parent with a step on one side only", () => {
+  // Harmonic minor has three semitones between steps 6 (8) and 7 (11). Offset
+  // 9 has a step below it and none above: a raised 6. Offset 10 has a step
+  // above it and none below: a lowered 7. minorRelative does not enter.
+  const harmonicMinor = [0, 2, 3, 5, 7, 8, 11];
+  for (const minorRelative of [true, false]) {
+    assert.deepEqual(host(naming.numeral(9, harmonicMinor, minorRelative)),
+      {accidental: "#", roman: "VI"});
+    assert.deepEqual(host(naming.numeral(10, harmonicMinor, minorRelative)),
+      {accidental: "b", roman: "VII"});
+  }
+  // A step itself: the step numeral, whatever minorRelative says.
+  assert.deepEqual(host(naming.numeral(8, harmonicMinor, false)),
+    {accidental: "", roman: "VI"});
 });
 
-/* ---- D8 as amended (coordination row 28): an IN-PARENT pitch class is
- * numbered by its PARENT-DEGREE INDEX, with the accidental read against the
- * D8 reference scale degree of that same index. A pitch class OUTSIDE the
- * parent keeps the section 10 bN/#N mechanism. The two readings disagree
- * wherever the parent's own degree sits a semitone off the reference degree
- * of the same index AND the reference scale has a degree the other side of
- * it - i.e. the chromatic degrees of Phrygian, Locrian, Lydian and friends.
+/* ---- An IN-PARENT pitch class is numbered by its PARENT-DEGREE INDEX and
+ * carries no accidental (owner decision 2026-10-05). A pitch class OUTSIDE the
+ * parent is named from the parent step a semitone away and always carries one.
  */
 
 test("D8 in-parent: a chromatic parent degree is numbered by its degree index", () => {
-  // F Phrygian, ding F: F Gb Ab Bb C Db Eb. Gb is parent degree 2, so bII -
-  // the reference-scale reading called it #I (one semitone above I).
+  // F Phrygian, ding F: F Gb Ab Bb C Db Eb. Gb is parent step 2, so II.
   const phrygian = [5, 6, 8, 10, 0, 1, 3];
   const produced = host(naming.degrees(phrygian, 5,
     naming.inferParent(phrygian, 5)));
   assert.equal(host(naming.PARENTS)[naming.inferParent(phrygian, 5)].name,
     "Phrygian");
-  assert.equal(produced["6"], "bII");
+  assert.equal(produced["6"], "II");
 
-  // C Locrian: Db is degree 2 (bII) and Gb is degree 5 (bV). The
-  // reference-scale reading called Gb #IV. The CASE is untouched by this rule
-  // and stays D10's: over Locrian, Gb stacks Bb and Db - a major third and a
-  // perfect fifth - so the label is uppercase with no degree sign.
+  // C Locrian: Db is step 2 (II) and Gb is step 5 (V). The CASE is D10's:
+  // over Locrian, Gb stacks Bb and Db - a major third and a perfect fifth -
+  // so the label is uppercase with no degree sign.
   const locrian = [0, 1, 3, 5, 6, 8, 10];
   const loc = host(naming.degrees(locrian, 0, naming.inferParent(locrian, 0)));
   assert.equal(host(naming.PARENTS)[naming.inferParent(locrian, 0)].name,
     "Locrian");
-  assert.equal(loc["1"], "bII");
-  assert.equal(loc["6"], "bV");
+  assert.equal(loc["1"], "II");
+  assert.equal(loc["6"], "V");
 
-  // C Lydian: F# is degree 4, so #IV - the reference-scale reading, with no
-  // minor third on the pan, flattened it to bV.
+  // C Lydian: F# is step 4, stacking a minor third and a diminished fifth.
   const lydian = [0, 2, 4, 6, 7, 9, 11];
   const lyd = host(naming.degrees(lydian, 0, naming.inferParent(lydian, 0)));
   assert.equal(host(naming.PARENTS)[naming.inferParent(lydian, 0)].name, "Lydian");
-  assert.equal(lyd["6"], "#iv°");
+  assert.equal(lyd["6"], "iv°");
 });
 
 test("the parent override can change a numeral when the degree index moves", () => {
-  // C Lydian's F# is degree 4 under Lydian (#iv°). Override to Ionian and F#
-  // falls OUTSIDE the parent, so section 10's bN/#N mechanism names it from
-  // the reference scale instead: between IV and V, major-relative, so bv°.
+  // C Lydian's F# is step 4 under Lydian (iv°). Override to Ionian and F#
+  // falls OUTSIDE the parent, so it is named from the steps beside it: between
+  // IV and V with no minor third on the pan, so bv°.
   const lydian = [0, 2, 4, 6, 7, 9, 11];
   const names = host(naming.PARENTS).map((p) => p.name);
   assert.equal(host(naming.degrees(lydian, 0, names.indexOf("Lydian")))["6"],
-    "#iv°");
+    "iv°");
   assert.equal(host(naming.degrees(lydian, 0, names.indexOf("Ionian")))["6"],
     "bv°");
 });
````

### A.3 `tests/test_deck_data.py` (the `DEGREES` table)

````diff
diff --git a/tests/test_deck_data.py b/tests/test_deck_data.py
--- a/tests/test_deck_data.py
+++ b/tests/test_deck_data.py
@@ -95,13 +95,15 @@ LAYOUTS = {
 # chord names, D10 amended), Amara 16 -> 25 (D11, fully re-ranked).
 CHORD_COUNTS = {"hijaz": 19, "pygmy": 52, "amara": 25}
 
-# CLAUDE.md > "Scale degrees per deck", keyed by note name.
+# docs/ENGINE-SPEC.md section 10, keyed by note name (owner decision
+# 2026-10-05: the step of the parent scale, case, the diminished mark, and no
+# accidental).
 DEGREES = {
-    "hijaz": {"C#": "I", "D": "bII", "F": "iii°", "F#": "iv", "G#": "v°",
-              "B": "bvii"},
+    "hijaz": {"C#": "I", "D": "II", "F": "iii°", "F#": "iv", "G#": "v°",
+              "B": "vii"},
     "pygmy": {"F": "i", "Ab": "III", "Bb": "iv", "C": "v", "Db": "VI",
               "Eb": "VII", "G": "ii°"},
-    "amara": {"D": "i", "A": "v", "G": "IV", "C": "bVII", "F": "bIII"},
+    "amara": {"D": "i", "A": "v", "G": "iv", "C": "VII", "F": "III"},
 }
 
 # Bottom notes used by each Pygmy voicing, in card order - the number the
````

### A.4 `tests/mutants/f_fixture_sha.patch` and `tests/test_fixture_integrity.py` (NU-2, commit 3)

````diff
diff --git a/tests/mutants/f_fixture_sha.patch b/tests/mutants/f_fixture_sha.patch
--- a/tests/mutants/f_fixture_sha.patch
+++ b/tests/mutants/f_fixture_sha.patch
@@ -11,9 +11,9 @@
 # byte-identical to Dsus's own sus4 chord elsewhere in the same fixture, so it
 # rode a non-unique anchor. KNOWN_NON_UNIQUE_ANCHORS in
 # tests/mutation_harness.test.js is now empty.
-diff --git a/tests/fixtures/golden_decks_v4.json b/tests/fixtures/golden_decks_v4.json
---- a/tests/fixtures/golden_decks_v4.json
-+++ b/tests/fixtures/golden_decks_v4.json
+diff --git a/tests/fixtures/golden_decks_v5.json b/tests/fixtures/golden_decks_v5.json
+--- a/tests/fixtures/golden_decks_v5.json
++++ b/tests/fixtures/golden_decks_v5.json
 @@ -135,13 +135,13 @@
          {
            "main": "C#sus",
diff --git a/tests/test_fixture_integrity.py b/tests/test_fixture_integrity.py
--- a/tests/test_fixture_integrity.py
+++ b/tests/test_fixture_integrity.py
@@ -1,4 +1,4 @@
-"""The frozen 96-card corpus (v4). Engine tests read this fixture, never the live DECKS.
+"""The frozen 96-card corpus (v5). Engine tests read this fixture, never the live DECKS.
 
 A deliberate deck-data change must bump the fixture version and regenerate the
 sha256 - it is never regenerated from the engine.
@@ -11,7 +11,7 @@ import unittest
 from tests import paths
 
 FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
-                       "fixtures", "golden_decks_v4.json")
+                       "fixtures", "golden_decks_v5.json")
 V3_FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           "fixtures", "golden_decks_v3.json")
 
@@ -29,10 +29,14 @@ TOP_ZONES = ("ding", "rim", "inner")
 # of change fails loudly rather than being regenerated silently - bumping the
 # version and the digest here, in the same PR that changes data/decks.json,
 # is the loud failure this fixture exists to force.
-EXPECTED_SHA256 = ("d9fe93bd3c8cbbe366498cdd4c2101af6c9d262964f72624319af346"
-                   "b929861e")
+#
+# 2026-10-06 (degree numerals, owner decision 2026-10-05): bumped v4 -> v5.
+# Five degree labels lost their accidental or changed case (Hijaz II and vii,
+# Amara III, iv and VII); no chord, field or geometry moved.
+EXPECTED_SHA256 = ("050d476260a4fffe7b3ff1457fb76aaaed2d2058afb4e3923ba165deaf3a"
+                   "49e6")
 
-# The v3 corpus's canonical-serialisation digest, pinned the same way as v4's
+# The v3 corpus's canonical-serialisation digest, pinned the same way as v5's
 # above (queue row 48: v3 was unpinned - its "sha256" key existed in the
 # fixture but nothing outside the fixture read it, so a coordinated rewrite of
 # both the content and its self-reported digest would have passed silently).
@@ -52,7 +56,7 @@ def chord_counts():
     return {d["id"]: len(d["chords"]) for d in paths.app_decks()}
 
 BUMP = ("Deck data changed. This fixture is frozen on purpose: bump it to "
-        "golden_decks_v4.json and regenerate sha256, do not edit in place.")
+        "golden_decks_v6.json and regenerate sha256, do not edit in place.")
 
 
 def load():
@@ -73,9 +77,9 @@ class TestFixtureSelfAssertion(unittest.TestCase):
         self.assertEqual(hashlib.sha256(canon).hexdigest(), doc["sha256"],
                          "fixture content and its stored sha256 disagree. " + BUMP)
 
-    def test_sha256_is_the_pinned_v4_digest(self):
+    def test_sha256_is_the_pinned_v5_digest(self):
         self.assertEqual(load()["sha256"], EXPECTED_SHA256,
-                         "the v4 corpus digest changed. " + BUMP)
+                         "the v5 corpus digest changed. " + BUMP)
 
     def test_v3_sha256_matches_its_canonical_serialisation(self):
         doc = load_v3()
@@ -90,7 +94,7 @@ class TestFixtureSelfAssertion(unittest.TestCase):
 
     def test_shape_and_card_counts(self):
         doc = load()
-        self.assertEqual(doc["version"], 4)
+        self.assertEqual(doc["version"], 5)
         self.assertEqual(len(doc["decks"]), 3)
         counts = {d["id"]: len(d["chords"]) for d in doc["decks"]}
         self.assertEqual(counts, chord_counts())
````

### A.5 `tools/regen_data_mutants.py` (NU-3, commit 5)

````diff
diff --git a/tools/regen_data_mutants.py b/tools/regen_data_mutants.py
--- a/tools/regen_data_mutants.py
+++ b/tools/regen_data_mutants.py
@@ -62,7 +62,7 @@ MUTANTS = {
     "b_degree_missing": (
         ["# kills: test_degrees_cover_chord_roots",
          "# suite: python3 -m unittest -k test_degrees_cover_chord_roots tests.test_deck_data",
-         "# Amara loses the IV degree, leaving G5 and Gsus4 without a scale degree."],
+         "# Amara loses the iv degree, leaving G5 and Gsus4 without a scale degree."],
         [],
         lambda D: next(x for x in D if x["id"] == "amara")["degrees"].pop("7"),
     ),
````

## Appendix B. Mutant patches (verbatim file contents)

Each of the nine was applied to the changed tree; its `# suite:`, run with `--test-reporter=tap`, selected one
test, printed one `not ok` and exited non-zero.

### `tests/mutants/f1b_numeral_minor_flat.patch`

````diff
# kills: NU-1 numeral: offset 6 sits between two parent steps, and minorRelative picks the branch
# suite: node --test --test-name-pattern ^NU.1.numeral..offset.6.sits.between.two.parent.steps..and.minorRelative.picks.the.branch$ tests/naming.test.js
# The minor-relative "between two steps" branch of outsideNumeral is folded
# into the major-relative branch. A pitch class outside the parent on a pan
# with a minor third over the tonic then reads flat-of-above (offset 6 over
# Ionian reads bV, not #IV) on card headers and in the app.
diff --git a/src/engine/naming.js b/src/engine/naming.js
--- a/src/engine/naming.js
+++ b/src/engine/naming.js
@@ -135,7 +135,7 @@
     var above = indexOfPc(parentIntervals, pc(offset + 1));
     if (below >= 0 && above >= 0) {
       return minorRelative
-        ? {accidental: "#", roman: ROMAN[below]}
+        ? {accidental: "b", roman: ROMAN[above]}
         : {accidental: "b", roman: ROMAN[above]};
     }
     if (above >= 0) return {accidental: "b", roman: ROMAN[above]};
````

### `tests/mutants/n_major_relative_always.patch`

````diff
# kills: NU-1 outside the parent a minor third on the pan picks sharp over flat
# suite: node --test --test-name-pattern ^NU.1.outside.the.parent.a.minor.third.on.the.pan.picks.sharp.over.flat$ tests/naming.test.js
# The pan is always read as major-relative, so a pitch class outside the
# parent with a step on both sides reads flat even over a minor third.
diff --git a/src/engine/naming.js b/src/engine/naming.js
--- a/src/engine/naming.js
+++ b/src/engine/naming.js
@@ -269,7 +269,7 @@
     // Only an out-of-parent pitch class reads this: with a parent step on both
     // sides it takes `#` when the PAN carries a minor third above the tonic,
     // `b` otherwise.
-    var minorRelative = member(pan, pc(tonic + 3));
+    var minorRelative = false;
     var intervals = PARENTS[parentIndex].intervals;
     var out = {};
     for (var i = 0; i < pan.length; i += 1) {
````

### `tests/mutants/nu_numeral_ignores_parent.patch`

````diff
# kills: NU-1 every built-in degree label is the engine output with no exception
# suite: node --test --test-name-pattern ^NU.1.every.built.in.degree.label.is.the.engine.output.with.no.exception$ tests/naming.test.js
# Step numerals are counted against Ionian whatever the parent is, so Hijaz
# D and B are outside the scale they are counted in and read bII and bvii.
diff --git a/src/engine/naming.js b/src/engine/naming.js
--- a/src/engine/naming.js
+++ b/src/engine/naming.js
@@ -270,7 +270,7 @@
     // sides it takes `#` when the PAN carries a minor third above the tonic,
     // `b` otherwise.
     var minorRelative = member(pan, pc(tonic + 3));
-    var intervals = PARENTS[parentIndex].intervals;
+    var intervals = PARENTS[0].intervals;
     var out = {};
     for (var i = 0; i < pan.length; i += 1) {
       var degreePc = pan[i];
````

### `tests/mutants/nu_outside_both_sides_guard.patch`

````diff
# kills: NU-1 numeral: outside the parent with a step on one side only
# suite: node --test --test-name-pattern ^NU.1.numeral..outside.the.parent.with.a.step.on.one.side.only$ tests/naming.test.js
# The both-sides test of outsideNumeral forgets the step above, so a pitch
# class with a step below only takes the minor-relative tie-break: harmonic
# minor offset 9 on a major-relative pan reads a flat of a step that is not
# there.
diff --git a/src/engine/naming.js b/src/engine/naming.js
--- a/src/engine/naming.js
+++ b/src/engine/naming.js
@@ -133,7 +133,7 @@
   function outsideNumeral(offset, parentIntervals, minorRelative) {
     var below = indexOfPc(parentIntervals, pc(offset - 1));
     var above = indexOfPc(parentIntervals, pc(offset + 1));
-    if (below >= 0 && above >= 0) {
+    if (below >= 0) {
       return minorRelative
         ? {accidental: "#", roman: ROMAN[below]}
         : {accidental: "b", roman: ROMAN[above]};
````

### `tests/mutants/nu_outside_drops_accidental.patch`

````diff
# kills: NU-1 no two pitch classes on one pan share a label
# suite: node --test --test-name-pattern ^NU.1.no.two.pitch.classes.on.one.pan.share.a.label$ tests/naming.test.js
# A pitch class outside the parent loses its accidental, so it prints the
# same numeral as the parent step beside it: two roots, one label.
diff --git a/src/engine/naming.js b/src/engine/naming.js
--- a/src/engine/naming.js
+++ b/src/engine/naming.js
@@ -138,7 +138,7 @@
         ? {accidental: "#", roman: ROMAN[below]}
         : {accidental: "b", roman: ROMAN[above]};
     }
-    if (above >= 0) return {accidental: "b", roman: ROMAN[above]};
+    if (above >= 0) return {accidental: "", roman: ROMAN[above]};
     return {accidental: "#", roman: ROMAN[below]};
   }
 
````

### `tests/mutants/nu_outside_label_dropped.patch`

````diff
# kills: NU-1 no two pitch classes on one pan share a label
# suite: node --test --test-name-pattern ^NU.1.no.two.pitch.classes.on.one.pan.share.a.label$ tests/naming.test.js
# Under NO_THIRDS a pitch class outside the parent gets no label at all, so
# every card rooted on it prints an empty degree. No label is duplicated, so
# only the check that every pan pitch class is labelled sees it.
diff --git a/src/engine/naming.js b/src/engine/naming.js
--- a/src/engine/naming.js
+++ b/src/engine/naming.js
@@ -275,6 +275,7 @@
     for (var i = 0; i < pan.length; i += 1) {
       var degreePc = pan[i];
       var num = numeral(pc(degreePc - tonic), intervals, minorRelative);
+      if (noThirds && num.accidental) continue;
       var casing;
       if (noThirds) {
         // NO_THIRDS overrides D10: every numeral uppercase, no stacked thirds.
````

### `tests/mutants/nu_outside_one_side_flat.patch`

````diff
# kills: NU-1 numeral: outside the parent with a step on one side only
# suite: node --test --test-name-pattern ^NU.1.numeral..outside.the.parent.with.a.step.on.one.side.only$ tests/naming.test.js
# The step-below-only branch of outsideNumeral reads the step ABOVE, which
# does not exist there, so harmonic minor offset 9 loses its numeral.
diff --git a/src/engine/naming.js b/src/engine/naming.js
--- a/src/engine/naming.js
+++ b/src/engine/naming.js
@@ -139,7 +139,7 @@
         : {accidental: "b", roman: ROMAN[above]};
     }
     if (above >= 0) return {accidental: "b", roman: ROMAN[above]};
-    return {accidental: "#", roman: ROMAN[below]};
+    return {accidental: "b", roman: ROMAN[above]};
   }
 
   /* ---- section 9: chord name and subtitle -------------------------------- */
````

### `tests/mutants/nu_step_keeps_flat.patch`

````diff
# kills: NU-1 a step of the parent reads as that step numeral with no accidental
# suite: node --test --test-name-pattern ^NU.1.a.step.of.the.parent.reads.as.that.step.numeral.with.no.accidental$ tests/naming.test.js
# A step of the parent carries a flat again on a pan with no minor third
# over the tonic, so Hijaz D reads bII: the pre-2026-10-05 look.
diff --git a/src/engine/naming.js b/src/engine/naming.js
--- a/src/engine/naming.js
+++ b/src/engine/naming.js
@@ -117,7 +117,7 @@
    * touching the accidental. */
   function numeral(offset, parentIntervals, minorRelative) {
     var at = indexOfPc(parentIntervals, offset);
-    if (at >= 0) return {accidental: "", roman: ROMAN[at]};
+    if (at >= 0) return {accidental: minorRelative ? "" : "b", roman: ROMAN[at]};
     return outsideNumeral(offset, parentIntervals, minorRelative);
   }
 
````

### `tests/mutants/nu_step_reads_outside.patch`

````diff
# kills: D8 in-parent: a chromatic parent degree is numbered by its degree index
# suite: node --test --test-name-pattern ^D8.in.parent..a.chromatic.parent.degree.is.numbered.by.its.degree.index$ tests/naming.test.js
# A step of the parent is no longer recognised as one and is named like a
# pitch class outside the parent, so F Phrygian Gb reads #I instead of II.
diff --git a/src/engine/naming.js b/src/engine/naming.js
--- a/src/engine/naming.js
+++ b/src/engine/naming.js
@@ -117,7 +117,6 @@
    * touching the accidental. */
   function numeral(offset, parentIntervals, minorRelative) {
     var at = indexOfPc(parentIntervals, offset);
-    if (at >= 0) return {accidental: "", roman: ROMAN[at]};
     return outsideNumeral(offset, parentIntervals, minorRelative);
   }
 
````

## Appendix C. Doc edits (literal)

### C.1 heading, `docs/ENGINE-SPEC.md`

Old:

````text
## 10. Degrees: numerals (D8) and case (D10)
````

New:

````text
## 10. Degrees: numerals (step of the parent, 2026-10-05) and case (D10)
````

### C.2 numerals bullet, `docs/ENGINE-SPEC.md`

Old:

````text
- DECIDED(D8) Degree NUMERALS are mode-aware: minor-relative (`III`, `VII`) for
  scales with a minor third, major-relative with flats (`bIII`, `bVII`)
  otherwise.
````

New:

````text
- DECIDED(owner 2026-10-05, superseding D8) Degree NUMERALS count the steps of
  the PARENT scale, 1 to 7: a root that is step N of the parent reads as roman
  N and never carries an accidental. The owner's words: "Drop the flats",
  "Yes, no flats anywhere", "No accidentals at all". The numeral says which
  step, the case and `°` say which quality (D10); nothing else is in a label.
  Before this decision numerals were read against the major or natural minor
  scale and carried its accidentals (old D8).
````

### C.3 frozen-exceptions bullet, `docs/ENGINE-SPEC.md`

Old:

````text
- DECIDED(D8, D10) Frozen degree exceptions, two-sided: D Amara ships `bIII` /
  `bVII` (D8) and `IV` where stacked thirds derive `iv` (D10). D Amara is
  declared Aeolian.
````

New:

````text
- DECIDED(owner 2026-10-05) There are no frozen degree exceptions: every
  built-in label is the engine's output for that deck's seed, and
  `tests/naming.test.js` asserts all 18. D Amara is declared Aeolian (D10).
  The built-in labels, keyed by note name:

  | deck | labels |
  |---|---|
  | Hijaz | C# `I`, D `II`, F `iii°`, F# `iv`, G# `v°`, B `vii` |
  | Pygmy | F `i`, G `ii°`, Ab `III`, Bb `iv`, C `v`, Db `VI`, Eb `VII` |
  | Amara | D `i`, F `III`, G `iv`, A `v`, C `VII` |

  History: until 2026-10-05 Hijaz shipped `bII` and `bvii` (old D8), and Amara
  shipped `bIII`, `bVII` and `IV` as recorded exceptions to the engine's output.
````

### C.4 owner-review bullet, down to but not including the line "  Its case follows the stacked-thirds rule applied over the PAN pitch classes", `docs/ENGINE-SPEC.md`

Old:

````text
- DECIDED(owner-review 2026-09-08, amending swarm-2026-09-08) Numerals are
  read against the D8 REFERENCE scale (major, or natural minor for a
  minor-relative scale), not against the parent, in two cases that this
  document previously stated differently:
  (a) IN-PARENT degree: the numeral is the parent's degree INDEX and the
  accidental is the offset against the reference degree of the SAME index.
  So a Phrygian second reads `bII` (not `#I`), a Locrian second `bII` and its
  fifth `bV`, a Lydian fourth `#IV`. Over the fixed `parents.json` table that
  offset is always -1, 0 or +1, so a single accidental always suffices.
  (b) OUTSIDE-PARENT pitch class: it is named from the REFERENCE-scale degree
  it is one semitone away from, by the same rule (`bN` below, `#N` above; when
  both apply, `b` for a major-relative scale, `#` otherwise). This differs from
  a reading based on the nearest PARENT degree, and the difference is visible
  only under a manual parent override.
  Both readings reproduce 14 of the 17 built-in degree labels and leave
  D Amara's three frozen exceptions exactly as recorded (`bVII`, `bIII` and
  `IV`, where the engine derives `VII`, `III` and `iv`).
````

New:

````text
- DECIDED(owner 2026-10-05, superseding owner-review 2026-09-08) Two cases:
  (a) IN-PARENT degree: the numeral is the parent's degree INDEX and there is
  no accidental. A Phrygian second reads `II`, a Locrian fifth `V`, a Lydian
  fourth `iv°`.
  (b) OUTSIDE-PARENT pitch class (generated decks only; no built-in has one):
  it is named from the PARENT step one semitone away, `#N` from the step
  below or `bN` from the step above. When a step lies on both sides, `#` if
  the pan carries a minor third above the tonic, `b` otherwise. Every parent
  in `parents.json` has at most three semitones between adjacent steps, so
  one of the two always exists. An outside pitch class therefore always
  carries an accidental and an in-parent one never does, and no two pitch
  classes of one pan share a label (asserted over 2048 pans x 11 parents in
  `tests/naming.test.js`). DEFAULT[owner-review]: the owner has not decided
  this case; the whole rule is `outsideNumeral` in `src/engine/naming.js`.
````

### C.4b the line the C.4 edit stops at, `docs/ENGINE-SPEC.md`

After C.4 the new text ends on case (b), so "Its" would read as the outside pitch class by accident of position.
Say it. Old (two lines, occurs once):

````text
  Its case follows the stacked-thirds rule applied over the PAN pitch classes
  (uppercase when no third is available), unless `NO_THIRDS` applies. In that
````

New:

````text
  An outside pitch class's case follows the stacked-thirds rule applied over
  the PAN pitch classes (uppercase when no third is available), unless
  `NO_THIRDS` applies. In that
````

### C.5 `docs/SCALE_ENGINE_PLAN.md`, OWNER DECISIONS table

In each row the `Decision` cell gains one sentence before its closing ` |`. Old cell ending, then new:

````text
| D8 | **Degree NUMERALS are mode-aware**: minor-relative (`III`, `VII`) for scales with a minor third, major-relative with flats (`bIII`, `bVII`) otherwise. |
````

````text
| D8 | **Degree NUMERALS are mode-aware**: minor-relative (`III`, `VII`) for scales with a minor third, major-relative with flats (`bIII`, `bVII`) otherwise. SUPERSEDED 2026-10-05 (owner: "No accidentals at all"): a numeral is the root's step in the parent scale with no accidental, and D Amara is no longer an exception; see `docs/ENGINE-SPEC.md` section 10. |
````

````text
so **Amara `IV` is a second frozen exception** alongside the D8 numerals. |
````

````text
so **Amara `IV` is a second frozen exception** alongside the D8 numerals. SUPERSEDED 2026-10-05 in part: Amara ships the derived `iv`; there are no frozen exceptions. The stacked-thirds case rule stands. |
````

## Appendix D. V2 (no `°`), not planned

Owner, 2026-10-06: "If by convention vii degree is true, we can keep the degree". It is
(`notation-research.md`, verdict (b) DENIED). Recorded only so the cost is on file.

| deck | extra label changes under V2 |
|---|---|
| Hijaz | F `iii°`→`iii`, G# `v°`→`v` |
| Pygmy | G `ii°`→`ii` (contradicts owner decision 4: Pygmy does not change) |
| Amara | none |

- Misstated quality: `iii`, `v`, `ii` read as minor on roots whose cards are `F°`; `G#°`, `G#m7b5`; `G°`, `Gm7b5`.
- Collisions: 0 under option A of Q1. (Under the brief's literal default: 209 pans inferred, 3883 under override.)
- Reach: 2887 labels carry `°` across the 2048-pan inferred enumeration.
- Output: all six PDFs and the Pygmy face digests change.
- Extra dead code: the `diminished` field of `caseFromParent` and `caseFromPan`, the `°` concatenation in
  `degrees()`, and the test "natural fifth suppresses the degree sign".
