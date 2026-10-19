# Import fix: execution plan (B1, B2, the serialise invariant, C1-C5)

Base: `origin/claude/import-v2-l1b` at `5a5f7f07` (PR #372, held). Every lane stacks on it. Date: 2026-10-18.
Revision 3 (after eng re-review APPROVE_WITH_CHANGES 8.5/10, `S/import-fix/eng-review-2.md`; RC-A and nits 1-5 folded, see section 8.2). Revision 2 followed eng review 1 (7/10; section 8.1); revision 2's plan is kept as `plan.rev2.md` and its prototype diff as `proto-importer.pre-rc-a.diff`. Revision 3's prototype is `wt-proto3`; its sweep outputs are `sweep3-wt-proto3.json`, `seed-refused-wt-proto3.json`, `disorder-wt-proto3.json` and the drop-rule check `drops-wt-proto3.json`. Revision 2's evidence follows. Evidence (scratch, not committed): sweep `S/import-fix/sweep3-wt-base.json` (baseline) and `sweep3-wt-proto2.json` (prototype), SEED_REFUSED firings `seed-refused-wt-proto2.json`, flag-order check `disorder-wt-proto2.json`; prototype engine diff `S/import-fix/proto-importer.diff` (revision 1's diff is kept as `proto-importer.pre-eng.diff`, revision 1's plan as `plan.pre-eng.md`); DEV screenshots `S/shots/`. Here `S` = `/private/tmp/claude-501/-Users-ray-Projects-handpan-cards/3347d7d0-1ec9-4967-bd81-dd4cf98e29d7/scratchpad`.

## 1. Goal and non-goals

**Goal.** Every importer result the sheet can reach that enables USE writes a line that `HPE.core.parseSeed` accepts and that matches what the user meant. Every flag message says exactly what is wrong and where to fix it.

**What the sheet can reach.** `runImport` passes no `title` and no `parens`, and `pickImportDing` passes only `{ding: i}`, for every `i` the picker offers. The picker offers every note index of the unpicked result. So the reachable set is `interpret(text)` plus `interpret(text, {ding: i})` for every note index `i`. The invariant is stated over exactly that set.

**Non-goals.**
- No new UI controls.
- No parens-bottom tap. It was cut in 86cbc03 and stays cut.
- No dual input (#375) and no helper overlay (#374).
- No reader changes beyond B1, B2 and the classes the sweep in section 3 proves broken.
- No prod unhide. The `hidden` attribute on `#import-row` and its pinning tests stay.
- No deck data and no diagram geometry.
- No change to `parseSeed`.
- No change to the picker's option list (see open decision D-6).

**Binding owner constraints.**
- Nothing merges to main. Every M PR is opened only for CI and is held.
- D PRs into `dev` are merged by the integrator once the merge gates in section 6 hold.
- Engine regions in `index.html` are changed only through `python3 tools/inline_engine.py`.
- TDD throughout. Every behaviour change gets a named test and a mutant.
- The README mutant count and the FLOORS in `tests/suite_health.py` come from CI artifacts. They are never guessed.

## 2. Findings, verified on 5a5f7f0

Line numbers are in `src/engine/importer.js` and `index.html` at 5a5f7f0.

### B1: a CONFLICTING_DING pick writes a line parseSeed refuses (confirmed)

The ding clash is raised only while there is no pick:
```js
var pickable = typeof opts.ding === "number" && opts.ding >= 0 && opts.ding < notes.length;
if (dingClash && !pickable) flag("CONFLICTING_DING", { notes: dingClash.map(function (n) { return n.index; }) });
```
On a pick, the picked note becomes the ding. Every other note keeps its role, and a label ding is demoted to a top note:
```js
if (pickable) { ding = notes[opts.ding]; }
...
else n.assigned = n.role === "ding" ? "top" : n.role;
```
So the `Main note C3` cue becomes a top note C3, which sits below the picked ding D3.

| input | pick | status at 5a5f7f0 | seed written | parseSeed |
|---|---|---|---|---|
| `Main note C3\nNotes: D3 / A3 Bb3 C4 D4 E4 F4 G4 A4` | none | NEEDS_INPUT, CONFLICTING_DING [0,1] | none | n/a |
| same | 0 (C3) | REVIEW | `(C3) D3 A3 Bb3 ...` | accepted |
| same | 1 (D3) | REVIEW, no flags | `C3 (D3) A3 Bb3 ...` | **NO_DING** |
| same | 2-9 | REVIEW | `C3 D3 (A3) ...` and the like | **NO_DING** |
| `Hauptnote C3\nNoten D3 / ...` (no colon) | same as above | same | same | same |
| `Ding: D3 Ding: E3 Top: A3 B3 C4` (app IM `TWO_DINGS`) | 1 | REVIEW | `D3 (E3) A3 B3 C4` | **NO_DING** |

The app test "IM: a picked ding clears CONFLICTING_DING" pins a broken path: it never runs the written line through parseSeed.

The Hauptnote variant with a colon (`Noten: D3 / ...`) is NEEDS_INPUT AMBIGUOUS_NOTE. It is not a B1 path.

### B2: a ticked DUPLICATE_PITCH writes a refused line (confirmed)

`DUPLICATE_PITCH` is in `FLAG_ORDER` at level CONFIRM. It is computed by midi across every role. `serialise` returns whatever it builds. Its own comment reads: "A string parseSeed refuses is still returned: its refusal belongs to the sheet's own #scale-refusal."

| input | pick | status | seed | parseSeed |
|---|---|---|---|---|
| `Ding: D3 Top: A3 A3 C4 D4 E4 F4` | none | REVIEW, DUPLICATE_PITCH [1,2] | `(D3) A3 A3 C4 D4 E4 F4` | **NOTE_REPEATED** |
| `Ding: D3 Top: D3 A3 Bb3 C4 D4 E4 F4 G4 A4` | none | REVIEW, DUPLICATE_PITCH [0,1] | `(D3) D3 A3 ...` | **NOTE_OUT_OF_ORDER** |

The second row is pinned as intended behaviour by `tests/import.test.js` "a top note that repeats the ding at its own octave is a duplicate, not a restatement". Fixing B2 supersedes that test (section 5, E-S3).

### C1: BOTTOM_NO_OCTAVE names guessed octaves (confirmed)

In `read()`, `BOTTOM_NO_OCTAVE` is not in the `blocked` set, so provisional octaves are still inferred. The copy then formats the inferred names:
`"Bottom notes X have no octave, so their pitch is unknown. Type the notes with octaves."`

On gold `yatao-c-ashakiran-15-octaveless` it reads "Bottom notes D5, E5, F5, A5, B5, C6 have no octave", which contradicts itself.

### C2: NO_OCTAVE claims no octave anywhere (confirmed)

`Ding: D3 Top: A3 Bb3 C D4 E4 F4 G4 A4` gives REVIEW with NO_OCTAVE notes [3] and inferred `C4`. The copy still says `"No octave in the source. Inferred: X. Bottom notes are a guess."`, even though eight notes carry octaves and there are no bottom notes at all.

### C3: INSUFFICIENT points the wrong way (confirmed)

`IMPORT_INSUFFICIENT = "No note list found. Image-only specs can't be read; type the notes below."`

In the markup, `#scale-box` sits above `#import-row`, so "below" is wrong. The image clause also shows for a pasted product name or a URL, where it does not apply.

The app test at `tests/app.test.js` around line 10823 pins this text.

### C4: UNDECLARED_PARENS gives an instruction that cannot work (confirmed)

`"Brackets around X are not defined by the source. Pick the ding below or type the notes."`

On `Notes: (D3) A3 (C4) (F4) G4` the result is UNDECLARED_PARENS [2,3]. With pick 0 the result is still NEEDS_INPUT UNDECLARED_PARENS. A pick never clears it, because the flag is raised independently of the pick.

The only working fix in the shipped UI is to type the line in the box above.

### C5: terse level prefixes (confirmed)

`paintImportBody` writes `const text = f.level + ": " + importFlagLine(f);`, so the user sees "BLOCK: ..." and "CONFIRM: ...".

The status line `"Resolve the blocks below before USE."` exposes the internal word "blocks".

Direction words in the current IMPORT_FLAG_TEXT:
- Correct: "pick the ding below". The picker sits below the flags.
- Wrong: "type the notes" with no place, or "below". The box is above.

Entries that do not name the notes concerned:
- COUNT_MISMATCH is acceptable: it names the counts.
- INNER_BELOW_TOP names notes but gives no fix.
- AMBIGUOUS_NOTE names the token.
- PROVISIONAL_REFUSED quotes the reason but no notes.

### Also found by the sweep (section 3)

These are the classes beyond B1 and B2:
- Picking any note that is not the lowest top-shell note writes a ding with top notes below it (NO_DING).
- Picking a bottom note writes a bottom note as the ding (NO_FIFTH).
- Picking an inner note writes an inner note as the ding (BAD_NOTE, alternate `barFirst`).
- Picking a copy of a repeated note gives NOTE_REPEATED.

## 3. Invariant sweep

**Method.** `S/import-fix/sweep3.js <worktree> <out>` (revision 1 used `sweep2.js`, the same walker without (e) and the order check) loads `tests/helpers/engine.js` `loadEngine(["core","importer"])`. It runs `interpret(text)` and `interpret(text, {ding: i})` for every note index `i` of the unpicked result. For every REVIEW result it calls `parseSeed(serialise(r))`. A REVIEW result needs all CONFIRMs ticked, and ticks do not change the string.

The corpus is the union of:
- (a) Every text `interpret` received during `node --test tests/import.test.js tests/import_gold.test.js`. A `--require` preload (`S/import-fix/rec.js`) recorded 12265 calls. These cover the seeded fuzz at `tests/import.test.js:580`, every flag fixture and `tests/fixtures/import_cases_v1.json`.
- (b) Every gold span in `tests/fixtures/import_gold_v1.json`.
- (c) The app IM constants.
- (d) The finding texts.
- (e) **The synthetic adversarial corpus** `S/import-fix/synth.js` (added after the eng review, RC3): 965 texts. Four scales (D Kurd, a C# Hijaz-like, F Pygmy, an E scale), three label styles (`Ding:` on one line, `Ding:` with newlines, `Main note` / `Notes:`) and three separators, crossed with these variants: base and no bottom or inner; a labelled ding above a top note (the lower note inserted first or third); a ding label naming the second top note; the ding repeated in the top list; a ding label on a bottom note, and the ding added to the bottom list; every in-shell top repeat, plus bottom and inner repeats; a cross-shell repeat; inner below top; two label dings in both orders; `Main note <below>` / `Notes: ding / ...` and the Hauptnote variant; octaveless top, bottom and single notes.

That comes to 8874 distinct texts and 110858 runs. The order check also asserts that every result's flags are in `FLAG_ORDER` order.

**Baseline at 5a5f7f0.**
- 110858 runs, of which 82732 are REVIEW.
- **63891 violations.** Every one has `serialise` non-empty and refused. 0 come from a REVIEW result where serialise returned "".
- 0 flag-order disorders.

| class | runs | distinct texts | cause |
|---|---|---|---|
| pick:NO_DING | 58773 | 4296 | the picked note is above other top notes (B1 is a case of this) |
| pick:NO_FIFTH | 2288 | 1969 | the picked note is a bottom note, or a top note with no fifth above it among the notes |
| pick:NOTE_REPEATED | 1248 | 435 | the picked ding repeats another note, or an in-shell repeat under a pick |
| pick:BAD_NOTE (barFirst) | 1017 | 702 | the picked note is an inner note |
| pick:NOTE_OUT_OF_ORDER | 167 | 142 | a ding copy in the top list, under a pick |
| **nopick:NOTE_REPEATED** | 241 | 241 | an in-shell repeat (B2 and its synthetic family: top, bottom and inner repeats) |
| **nopick:NO_DING** | 132 | 132 | a labelled ding above a top note, e.g. `Ding: D3 Top: A3 Bb3 C3 C4 ...` writes `C3 (D3) ...` |
| **nopick:NOTE_OUT_OF_ORDER** | 25 | 25 | a ding copy in the top list, e.g. `Ding: D3 Top: D3 A3 ...` |

By source: test-run 52541; gold 176 (15 gold texts, every one under a pick); app IM constants 12; finding texts 17; **synthetic 11145**.

**398 violations need no pick.** Revision 1 claimed that only the two B2-shaped texts did; that sentence was false and is deleted (RC3). The no-pick NO_DING class is why D-3 is now unconditional.

**Prototype.** The scratch worktree `wt-proto2` is not delivered. It carries the lane E design in section 4, revision 2: unconditional DING_NOT_LOWEST, DING_ON_BOTTOM on a picked bottom note, and SEED_REFUSED inserted at its `FLAG_ORDER` rank. Its diff is `S/import-fix/proto-importer.diff` (133 lines of diff, in `importer.js` only).

Under the prototype, over the same 8874 texts:
- 110858 runs, 14948 REVIEW, **0 violations**, **0 flag-order disorders**.
- Gold census unchanged: exact 25, correct-block 5, correct-insufficient 5, insufficient 5, wrong-but-valid 0.
- `tests/import.test.js` + `tests/import_gold.test.js`: 68 pass, 3 fail, and the 3 are exactly E-S1, E-S2 and E-S3.
- `python3 tools/inline_engine.py --check` is OK after the inline.
- **SEED_REFUSED fires 88 times, on 88 distinct texts, always under a pick and never without one** (Appendix C). Every firing is NO_FIFTH: a picked ding with no perfect fifth above it among the notes kept. By the picked note's role: top 85, ding 3. By source: 87 synthetic, 1 app IM constant (`Ding: D3 Ding: E3 Top: A3 B3 C4`, pick 2 = A3, which drops both label cues under D-1 and leaves `(A3) B3 C4`). The 2180+ bottom-note NO_FIFTH runs of revision 1's prototype now stop at DING_ON_BOTTOM and never reach the guard.
- Note that the guard makes 0 violations true by construction. The evidence that the reader is right is the class table above going to 0 through the specific flags, plus Appendix C enumerating every remaining guard firing.
- Timing: synthetic + 40 gold + 117 fixture texts with every pick is 15672 runs in 203 ms.

**Revision 3 (RC-A).** `synth.js` gained five RC-A variants per scale, label style and separator: a ding label holding the ding and the first top note; the ding and a note below it; the ding and two top notes; the long-page shape (`Ding: <ding>` on its own line, then an unlabelled line of two top notes); and two label dings where the first clause holds two notes. The corpus is now **9018 distinct texts and 113030 runs** (synthetic 1109, test-run 7864, gold 39, app IM constants 4, finding texts 2). `sweep4.js` is `sweep3.js` plus the drop-rule check below.
- Baseline at 5a5f7f0 on the 9018 texts: 84760 REVIEW, **65736 violations**, 0 disorders. By class: pick NO_DING 60360, pick NO_FIFTH 2324, pick NOTE_REPEATED 1389, pick BAD_NOTE 1071, pick NOTE_OUT_OF_ORDER 194, nopick NOTE_REPEATED 241, nopick NO_DING 132, nopick NOTE_OUT_OF_ORDER 25.
- Prototype `wt-proto3` (revision 2 plus RC-A, `proto-importer.diff`, 144 lines): 14943 REVIEW, **0 violations, 0 flag-order disorders**.
- **SEED_REFUSED: the same 88 (text, pick) pairs as `wt-proto2`** (set difference 0 / 0 against `seed-refused-wt-proto2.json`), every one NO_FIFTH under a pick (top 85, ding 3), with the same co-flags. None carries DING_CLAUSE_MANY. Appendix C stands.
- **Drop rule (RC-A), over all 4447 results with DING_CUE_DROPPED:** every dropped note is a label ding; the clause holding the pick drops nothing; every other single-note label clause drops exactly its one note; a label clause with more than one note drops nothing and its result is NEEDS_INPUT with DING_CLAUSE_MANY. 0 exceptions.
- **No unflagged drop:** for every REVIEW result, the letters of the written seed equal the notes not dropped, as a multiset. 0 exceptions.
- DING_CLAUSE_MANY fires on 2028 runs over 144 texts (synthetic and two test-run long-page texts), always NEEDS_INPUT with `serialise(r) === ""`. Without a pick those texts stay CONFLICTING_DING.
- Gold census unchanged: exact 25, wrong-but-valid 0. `tests/import.test.js` + `tests/import_gold.test.js`: 68 pass, 3 fail, exactly E-S1 to E-S3. `python3 tools/inline_engine.py --check` is OK.

## 4. Decisions

The integrator decides these under AFK. For each, the recommended option is first.

- **D-1 (B1 meaning).** When a pick resolves a contested ding, any unpicked label-ding cue (`Main note`, `Hauptnote`, `Ding:` and the like, i.e. role `ding` that is not a bracket) is **dropped**. A new CONFIRM, `DING_CUE_DROPPED {notes, ding}`, says so and names every dropped note (two of them on `Ding: D3 Ding: E3 Top: A3 B3 C4` pick 2; eng-review nit).
  - A note from the note list is never dropped.
  - Picking D3 on the B1 text gives `(D3) A3 Bb3 C4 D4 E4 F4 G4 A4`, with one tick.
  - Picking C3 gives `(C3) D3 A3 Bb3 ...`, with D3 as a top note. That is what the source lists after the ding cue.
  - Alternative: keep C3 as a top note. That always fails parseSeed, so it cannot be offered. Alternative: make it a BLOCK. That leaves the user no way forward but typing.
  - A contested reading is `dingClash`, or more than one label ding, or one label ding plus a stray bracket.
  - **The cue is one note per ding label (RC-A, revision 3).** A ding label clause (the notes read under one `Ding:`, `Main note` or `Hauptnote`, i.e. one `n.list`) that holds exactly one note is a cue, and only such a note is ever dropped. A ding label clause that holds more than one note is not a cue: under any pick it drops nothing and raises the new BLOCK `DING_CLAUSE_MANY {notes}`, naming every note of every such clause, so USE stays disabled. Examples: `Ding: D3 E3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4` pick 0 is NEEDS_INPUT [DING_CLAUSE_MANY [0,1]]; the long-page text ending `Ding: D3\nBb3, C4` pick 11 is NEEDS_INPUT [DING_CLAUSE_MANY [11,12,13], REPEATED_IN_SHELL ...] and Bb3 and C4 are not dropped. Without a pick these texts stay CONFLICTING_DING, as today.
  - Why a new code and not CONFLICTING_DING under the pick: CONFLICTING_DING's copy tells the user to pick a ding below, which would be false once a pick has been made and cannot resolve the clause. DING_CLAUSE_MANY's copy sends the user to the box above (E-6).
  - So "A note from the note list is never dropped" stays true, and DING_CUE_DROPPED's copy ("X was given as the ding") is only ever said of a note the source labelled as the ding on its own.
  - Rejected (eng re-review): read every note under a ding label as a cue. The copy would then say "Bb3 and C4 were given as the ding" of an unlabelled line.
- **D-2 (B2).** **BLOCK** a pitch repeated within one shell with the new `REPEATED_IN_SHELL {notes}`, in the order `notes` were read. A pitch repeated across shells (a top note and a bottom note at the same midi) stays the existing `DUPLICATE_PITCH` CONFIRM.
  - Reason 1: the owner's standing rule is never to change notes silently, and dedupe-on-confirm drops a note the source wrote.
  - Reason 2: a doubled pitch in one list is as likely a typo for a different note as a true repeat. Only the user knows which.
  - The ding counts as a member of the top shell. So `Ding: D3 Top: D3 A3 ...` becomes REPEATED_IN_SHELL [0,1]. This supersedes the "duplicate, not a restatement" test (E-S3).
  - Alternative: dedupe on confirm, with copy that says which note will be dropped. It is rejected because it changes notes.
  - Alternative: keep DUPLICATE_PITCH for the ding copy only. It is rejected because it still writes a refused line.
- **D-3 (ding above other notes; revised by RC3).** DING_NOT_LOWEST (BLOCK) is raised whenever the resolved ding is above any top or inner note, picked or not, unless CONFLICTING_DING is already raised. It is `DING_NOT_LOWEST {notes, ding}`, naming the notes below it.
  - Revision 1 raised it on a pick only. The no-pick case is real: `Ding: D3 Top: C3 A3 Bb3 C4 D4` returns REVIEW at 5a5f7f0 and writes `C3 (D3) A3 Bb3 C4 D4`, which parseSeed refuses with NO_DING (132 synthetic texts).
  - With CONFLICTING_DING raised and no pick, that flag already blocks; after D-1, a pick resolves the clash and DING_NOT_LOWEST is then evaluated.
  - This covers the 58773 pick-side and 132 no-pick NO_DING runs, the 1017 inner-note picks (an inner note is above the top notes) and the pick-side NOTE_OUT_OF_ORDER.
- **D-4 (picked bottom note).** Add the BLOCK `DING_ON_BOTTOM {ding}`: "X is a bottom note. The ding is on the top shell: pick another ding."
  - It covers every bottom-note NO_FIFTH run (2180 in revision 1's corpus).
  - The alternative is to rely on the guard (D-5) and show parseSeed's reason. That reason reads "No perfect fifth above the ding Bb2. Add a F, or check the ding.", which misdescribes an import. Revision 1's prototype took that alternative; the revision 2 prototype (`wt-proto2`) implements the dedicated flag, raised as `if (pickable && ding.role === "bottom")` and joined to `blocked`.
- **D-5 (backstop guard; revised by RC2 and RC5).** `interpret` ends with a guard. A REVIEW result whose `serialise` is empty or is refused by `parseSeed` becomes NEEDS_INPUT with BLOCK `SEED_REFUSED {refusal: {code, reason}}`. The `refusal` value has the same `{refusal: {code, reason}}` shape PROVISIONAL_REFUSED carries (eng-review DRY nit). There is no shared helper to reuse: the guard builds the object inline from `parseSeed`'s result, in the same shape (re-review nit 1).
  - **The guard is reachable from real picks.** Revision 1 said it would not fire after D-1 to D-4; the eng review and the expanded sweep both disprove that. It fires on 88 texts (Appendix C), every one a picked ding with no perfect fifth above it among the notes kept, e.g. `Ding: D3 Ding: E3 Top: A3 B3 C4` pick 2. It never fires without a pick. The property test asserts that every firing is on that enumerated shape (E-1), so a new hole of a different shape still shows up as a test failure.
  - **Order (RC5, integrator decision (d)).** SEED_REFUSED is a fixed `FLAG_ORDER` entry, after CONFLICTING_LIST and before the first CONFIRM. The guard inserts it at that rank (a splice at the first flag whose rank is greater), never appends it, so "Flags leave interpret() in this order" stays true.
  - **Copy (integrator decision (b)).** "These notes do not make a playable scale with that ding. Pick another ding or fix the notes in the scale box above." parseSeed's reason is not shown: its "Add a E, or check the ding." misdescribes an import. The refusal stays in the flag object for tests and logs.
  - Alternative: no guard. It is rejected because the goal is a guarantee, not a census.
- **D-6 (picker options).** Keep the picker offering every note. Filtering it to valid dings is a UI behaviour change, out of scope by the non-goals. A bad pick now explains itself (D-3, D-4). Record it as a follow-up for the owner.
- **D-7 (C3 URL line).** Drop the image clause. Add one sentence only when the pasted text contains `http://` or `https://` and the result is INSUFFICIENT: "Links are not opened. Open the page, copy its note list and paste it here."
  - This is an app-side text choice, so it needs no engine field. The app already holds `importSource`.
  - Alternative: drop the line with no replacement.
- **D-8 (C5 lead-ins).** Each flag line starts with "Fix: " for a BLOCK and "Check: " for a CONFIRM. The `BLOCK` and `CONFIRM` level words never reach the screen.
  - Why: it keeps one `<li>` per flag and all existing selectors, and needs no new markup.
  - Alternative: no per-flag prefix, with the flags grouped under two sentence-case headings. It is rejected because it needs new markup.
  - The status line becomes "Fix the notes listed below, or type them in the box above." for NEEDS_INPUT, and "Check each note and tick what needs confirming, then USE." for REVIEW.
- **D-9 (guard and the spy tests).** The two import tests that spy on `parseSeed` to prove no provisional string is built must be rewritten. They should assert that the only call is the guard's call, on exactly `serialise(r)`. This is preferred over hiding the guard's call from the spy, because the spy then also proves the guard ran.
- **D-10 (a prose line after a second list; integrator decision (a), accepted).** The test-run text `"Ding: F3\nOuter circle: G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5\nBottom: C3 Db3\nNotes: D3 version shipped by default."` is NEEDS_INPUT [CONFLICTING_LIST] at 5a5f7f0. Under the unconditional D-3 it is NEEDS_INPUT [DING_NOT_LOWEST {notes [12], ding 0}, CONFLICTING_LIST]: the prose `D3` is read as a top note below F3. It gains DING_NOT_LOWEST and keeps CONFLICTING_LIST, and stays NEEDS_INPUT. A fail-closed block over prose is accepted. Pinned by the E-2 test "IX: D-10 a prose D3 after a second list blocks with DING_NOT_LOWEST and CONFLICTING_LIST". The existing test "two labelled top lists are two readings of the rim and block with CONFLICTING_LIST" (`tests/import.test.js:296-305`) asserts NEEDS_INPUT and CONFLICTING_LIST present, and stays green unedited.

## 5. Lanes

The lanes are serial: **E, then C**. Both must edit `index.html` (E for the engine region and the copy of its new codes; C for the copy), README line 77 (the mutant count) and `tests/suite_health.py` FLOORS. Running them in parallel would conflict on all three.

Lane C branches from lane E's head after E's D PR merges to `dev`. Lane C's PR M is opened with base `main`. Its diff includes lane E's commits until #E merges, which is expected. The gate reads `gh run list --commit <C head> --workflow validate.yml`. PR D (base `dev`) is opened after lane E's D merged. (Revision 1 based M on `claude/import-fix-e`; `validate.yml` runs `pull_request` only for `branches: [main]`, so that PR would never get a `validate` run. RC1.)

Ownership overlap (README:77, FLOORS, `tests/app.test.js`, `index.html`) is handled by running E then C serially. Lane C starts from, and before taking counts rebases onto, lane E's head as merged to `dev`; it takes the README count and the FLOORS rows only from CI artifacts of its own M run at its verified head.

### Lane E: engine (`claude/import-fix-e`), wave 1

**Owns:**
- `src/engine/importer.js`
- the `engine:importer` region of `index.html`, through the tool only
- `tests/import.test.js` and `tests/import_gold.test.js`
- new `tests/mutants/ix_*.patch`, and the refresh of the stale `i_*` mutants listed below
- in `index.html` outside the engine region: ONLY six new `IMPORT_FLAG_TEXT` entries: `DING_CUE_DROPPED`, `DING_CLAUSE_MANY`, `DING_NOT_LOWEST`, `DING_ON_BOTTOM`, `REPEATED_IN_SHELL` and `SEED_REFUSED` (see E-6)
- in `tests/app.test.js`: only the IM tests listed in E-S4
- README.md:77 count; `tests/suite_health.py` FLOORS rows for `import.test.js` and `app.test.js`

**Never touch:**
- `src/engine/core.js` (parseSeed)
- any other engine module
- `data/decks.json` and the DECKS line
- existing `IMPORT_FLAG_TEXT` entries, `IMPORT_INSUFFICIENT`, the status lines and `paintImportBody` (all lane C)
- `#import-row` `hidden`
- `tests/e2e.test.js`
- `ib_*` mutants
- CLAUDE.md

**Steps.** Each step lists its acceptance criterion and its verify command. All steps are run in the lane worktree. Tests come first: E-1 to E-3 are written and committed red before E-4.

**E-1. Property tests (red).** Extend, do not duplicate (eng-review DRY nit): the existing test "every REVIEW string is a fixed point of formatSeed(parseSeed(x))" (`tests/import.test.js:87`) walks only the fixture with no pick. Widen its corpus and picks in place, and rename it to `"every REVIEW string the sheet can reach, every ding pick included, is a fixed point of formatSeed(parseSeed(x))"` (record the rename in the commit message; no mutant or doc cites the old title, verify with `grep -rn "is a fixed point of formatSeed" tests/ CLAUDE.md README.md docs/ENGINE-SPEC.md`).
- Corpus, built once by a helper inside the file and shared by the three properties below:
  - every case of `import_cases_v1.json`;
  - every gold span of `import_gold_v1.json`;
  - the seeded fuzz texts of the narrowing-check test at line 580, with the generator lifted into the shared helper and the same seed and count;
  - the B1, B2, C2, C4 and D-10 texts from sections 2 and 4;
  - **the synthetic adversarial corpus**, `S/import-fix/synth.js` ported into the file as a deterministic generator (RC3): a labelled ding above a top note, two label dings with a pick, a ding label on a bottom note, in-shell and cross-shell repeats, and the other variants listed in section 3 (e).
- For each text, run no pick and every pick `0..notes-1`.
- Property 1 (the renamed line-87 test): every REVIEW result's `serialise` is accepted by `parseSeed` and is a fixed point of `formatSeed`. On failure, report the first 10 `(text, pick, seed, code)` tuples.
- Property 2, new: `"IX: every result's flags are in FLAG_ORDER order"` (RC5, integrator decision (d)). Over the whole corpus, every pick. `FLAG_ORDER` is reached through the engine's exported order, or, if it is not exported, through a copy pinned equal by this test to the order of codes in `importer.js`.
- Property 3, new: `"IX: SEED_REFUSED fires only on a picked ding with no perfect fifth above it"` (RC2). Every SEED_REFUSED result has a pick, `refusal.code === "NO_FIFTH"`, status NEEDS_INPUT, and `serialise(r) === ""`.
- Time budget **10 s** for all three together (integrator decision (e)). The gold spans, the fixture and the synthetic texts run in full (15672 runs in 203 ms in the prototype); the fuzz texts are capped at the existing test's count.
- **Accept:** property 1 fails on 5a5f7f0 with NO_DING (with and without a pick), NO_FIFTH, BAD_NOTE, NOTE_REPEATED and NOTE_OUT_OF_ORDER tuples. Property 2 passes on 5a5f7f0 (0 disorders today) and is written to fail first under the mutant `ix_seed_refused_appended`. Property 3 is red on 5a5f7f0 for one reason only: its first assertion, that the `FLAG_ORDER` property 2 reads contains `SEED_REFUSED`, fails there (re-review nit 4). Runtime under 10 s.
- **Verify:** `node --test --test-name-pattern "is a fixed point of formatSeed|IX: every result's flags|IX: SEED_REFUSED fires only" tests/import.test.js` (red for properties 1 and 3).

**E-2. Behaviour tests (red).** One per decision. Each names the exact flags and the exact seed written.
- `"IX: picking the list ding on a Main note clash drops the cue: (D3) A3 Bb3 C4 D4 E4 F4 G4 A4 with DING_CUE_DROPPED [0]"`. It covers both B1 texts, Main note and Hauptnote without a colon.
- `"IX: picking the Main note cue keeps the list ding as a top note: (C3) D3 A3 Bb3 ..."`.
- `"IX: TWO_DINGS: each pick writes (D3) or (E3) A3 B3 C4 with the other cue dropped"`.
- `"IX: a pitch repeated in one shell blocks with REPEATED_IN_SHELL and writes nothing"`. Uses B2 `[1,2]` and the ding copy `[0,1]`.
- `"IX: a pitch repeated across shells stays a DUPLICATE_PITCH CONFIRM and writes a line parseSeed accepts"`. Uses sanango-c-harmonic-minor-16 (the existing [3,13] case) and asserts the parseSeed acceptance.
- `"IX: a pick above other top or inner notes blocks with DING_NOT_LOWEST naming them"`. Uses CUE pick 3 → notes [0,1,2], and the inner pick → `[0..8,10]`.
- `"IX: a labelled ding above a top note blocks with no pick: Ding: D3 Top: C3 A3 Bb3 C4 D4 is NEEDS_INPUT DING_NOT_LOWEST"` (RC3). Asserts `notes` names C3 and `serialise(r) === ""`.
- `"IX: D-10 a prose D3 after a second list blocks with DING_NOT_LOWEST and CONFLICTING_LIST"`. Uses the D-10 text; asserts the exact flag list `["DING_NOT_LOWEST", "CONFLICTING_LIST"]`, in that order, and NEEDS_INPUT.
- `"IX: a picked bottom note blocks with DING_ON_BOTTOM"`. Uses `Ding: D3 Top: F#3 A3 C#4 Bottom: Bb2` pick 4.
- `"IX: the SEED_REFUSED guard blocks a picked ding with no fifth above it: Ding: D3 Ding: E3 Top: A3 B3 C4 with ding 2"` (RC2). The real input: pick 2 (A3) drops both label cues under D-1; asserts NEEDS_INPUT, SEED_REFUSED with `refusal.code` NO_FIFTH, the flag at its `FLAG_ORDER` rank (before DING_CUE_DROPPED), and `serialise(r) === ""`.
- `"IX: a ding label holding two notes blocks under any pick: Ding: D3 E3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4 pick 0 is NEEDS_INPUT DING_CLAUSE_MANY"` (RC-A). Asserts status NEEDS_INPUT, the flag list exactly `["DING_CLAUSE_MANY"]` with `notes` `[0,1]`, no note with role `dropped`, and `serialise(r) === ""`; with no pick the same text is still CONFLICTING_DING [0,1].
- `"IX: an unlabelled line after a ding label is never dropped: the long-page Ding: D3 then Bb3, C4 with ding 11"` (RC-A). Uses the `tests/import.test.js` long-page text that ends `Ding: D3\nBb3, C4`; asserts NEEDS_INPUT, DING_CLAUSE_MANY with `notes` `[11,12,13]`, no note with role `dropped`, and `serialise(r) === ""`.
- `"IX: one note per ding label is the cue: Ding: D3 Ding: E3 Top: A3 B3 C4 pick 0 drops E3 only"` (RC-A). Asserts REVIEW `(D3) A3 B3 C4` with DING_CUE_DROPPED `notes` `[1]`, so the RC-A change does not over-correct the single-note case.
- `"IX: the SEED_REFUSED guard turns any refused REVIEW into NEEDS_INPUT"`. The second case: a stubbed `core.parseSeed` that refuses once with a code no real input produces (feasible because `importer.js:64` resolves `HPE.core` lazily). It proves the guard is not specific to NO_FIFTH.
- **Accept:** all red at 5a5f7f0 for the stated reason. The cross-shell test may be green already, since only its new parseSeed assertion is new.
- **Verify:** `node --test --test-name-pattern "^IX:" tests/import.test.js`.

**E-3. Supersessions (edit in the same red commit, quoting old and new expectations in the commit message).**
- E-S1 `"octaveless sources: the provisional string, hand-written octaves, roles and guesses"` and E-S2 `"a source with every octave written never builds a provisional string"`: per D-9, assert the only `parseSeed` call is the guard's, on `serialise(r)`.
- E-S3 `"a top note that repeats the ding at its own octave is a duplicate, not a restatement"`: rename to `"... is a REPEATED_IN_SHELL block, not a restatement"` and expect NEEDS_INPUT. In the same commit, update the `# kills:` header of `tests/mutants/i_restatement_any_same_pitch_class.patch`, which names the old title (and its `# suite:` header if it selects by that title). CLAUDE.md:790 also cites it; lane C updates that in C-6.
- E-S4 in `tests/app.test.js`:
  - `"IM: a DING_CUE CONFIRM is satisfied by a tick or by a picked ding"`: pick 0 instead of pick 2, because Bb3 is now DING_NOT_LOWEST.
  - `"IM: a picked ding clears CONFLICTING_DING"`: the pick now leaves DING_CUE_DROPPED, which needs a tick. The test must tick it before USE enables, and must assert that the written `#scale-box` value is accepted by `HPE.core.parseSeed`.
  - `"IM: every code in the engine's FLAG_ORDER has an IMPORT_FLAG_TEXT line"`: no edit. It goes red until E-6 lands.
- **Accept:** each superseded test fails at 5a5f7f0 only on the changed expectation.
- **Verify:** `node --test tests/import.test.js; node --test --test-name-pattern "IM:" tests/app.test.js`.

**E-4. Implement in `src/engine/importer.js`.** Follow `S/import-fix/proto-importer.diff`, plus DING_ON_BOTTOM.
- `FLAG_ORDER` becomes, as in `wt-proto2`:
  - after `CONFLICTING_DING`: `["DING_CLAUSE_MANY", BLOCK]` (revision 3), `["DING_NOT_LOWEST", BLOCK]`, `["DING_ON_BOTTOM", BLOCK]`, `["REPEATED_IN_SHELL", BLOCK]`
  - after `CONFLICTING_LIST` (the last BLOCK): `["SEED_REFUSED", BLOCK]`
  - after `NO_OCTAVE` (before `COUNT_OK`): `["DING_CUE_DROPPED", CONFIRM]`
- A contested pick sets `assigned = "dropped"` on unpicked label-ding cues. Dropped notes are excluded from duplicates, `bare` and `inlineString`.
- (RC-A, D-1) Group the label dings (`role === "ding" && !paren`) by `n.list`. Only a note whose clause has exactly one note may be dropped. Under a pick, if any clause has more than one note, raise `DING_CLAUSE_MANY {notes}` naming every note of every such clause, and add it to `blocked`. A pick inside a crowded clause drops nothing from that clause either (the prototype's first try, which kept the clause's first note droppable, dropped a note under such a pick; the sweep caught it).
- DING_NOT_LOWEST is raised whenever the resolved ding is above any top or inner note, picked or not, unless CONFLICTING_DING is raised (D-3). DING_ON_BOTTOM is raised when the picked note is a bottom note (D-4). Both join `blocked`.
- Duplicates are split by shell: within a shell → REPEATED_IN_SHELL (joins `blocked`); across shells → DUPLICATE_PITCH.
- `interpret = guard(interpretRaw)`. The guard builds `{refusal: {code, reason}}` inline from `parseSeed`'s result, the same shape PROVISIONAL_REFUSED carries (no helper exists; re-review nit 1), and inserts the SEED_REFUSED flag at its `FLAG_ORDER` rank (D-5), as `wt-proto2` does with a rank splice.
- Do not change `serialise`'s signature. Update its "A string parseSeed refuses is still returned" comment, which no longer holds for a REVIEW result.
- Then run `python3 tools/inline_engine.py`.
- **Accept:** E-1 to E-3 are green. Gold census unchanged (exact 25, wrong-but-valid 0). `import_gold.test.js` is green.
- **Verify:** `python3 tools/inline_engine.py --check && node --test tests/import.test.js tests/import_gold.test.js && python3 tools/validate.py`.

**E-5. Re-run the full sweep.** It is scratch, not a test, and it gives the evidence for the PR body.
- **Accept (RC2):** 0 violations and 0 flag-order disorders. SEED_REFUSED fires only on the enumerated inputs in Appendix C (88 texts, every one a picked ding with no perfect fifth above it, refusal NO_FIFTH, none without a pick), and every firing is NEEDS_INPUT with USE disabled (`serialise(r) === ""`, which the sheet treats as nothing to write). Any firing not in Appendix C is a new hole: stop and add a specific flag or decision before E-6.
- **Accept (RC-A):** every DING_CUE_DROPPED result drops exactly one note per unpicked single-note label clause and none from a crowded one; no REVIEW result drops a note without the flag (`drops-<lane>.json` reports `dropBad` 0 and `silent` 0).
- **The sweep scripts are not delivered** and are not in the repo. Lanes run on this machine, so the absolute scratch path works: the lane copies them from `/private/tmp/claude-501/-Users-ray-Projects-handpan-cards/3347d7d0-1ec9-4967-bd81-dd4cf98e29d7/scratchpad/import-fix/` (`sweep3.js`, `sweep4.js`, `synth.js`, the recorded test-run corpus `rec.jsonl`, the instrumentation patch `instr-importer.diff` and the reference `seed-refused-wt-proto2.json`) into its own scratch out dir `<out>`. Both sweeps read `rec.jsonl` and `synth.js` from their second argument and write their reports there.
- **Verify:**
  - `node <out>/sweep3.js <lane worktree> <out>` → 0 violations, 0 disorders; then diff `<out>/seed-refused-<lane worktree basename>.json` (text and pick) against `<out>/seed-refused-wt-proto2.json`: 0 / 0.
  - Drop rule: copy the lane worktree's `src/engine/`, `tests/helpers/` and `tools/engine_loader.js` into `<out>/instr/`, add `lab: n.role === "ding" && !n.paren, list: n.list` to the per-note listing object in `<out>/instr/src/engine/importer.js` (`instr-importer.diff` shows the one line against the prototype; apply it by hand if it does not apply), then `ENG=<out>/instr node <out>/sweep4.js <lane worktree> <out>` → `dropBad` 0, `silentDrop` 0. Delete `<out>/instr` afterwards. Nothing under `<out>` is committed.

**E-6. Copy for the six new codes.** These are the only `IMPORT_FLAG_TEXT` lines lane E writes. Lane C may re-word them. Each names the notes and the place to act.
- `DING_CUE_DROPPED`: "X was given as the ding but you picked Y, so X is left out. Tick to accept, or pick another ding below." X lists every dropped note ("D3 and E3 were given as the ding ... so they are left out").
- `DING_CLAUSE_MANY` (revision 3): "The ding is given as X. A handpan has one ding: type the notes in the box above." X lists every note in `notes` ("D3 and E3"). It does not point at the picker, because no pick resolves it.
- `DING_NOT_LOWEST`: "X sit below the ding (Y). Pick a lower ding below, or type the notes in the box above." It says "the ding", not "the ding you picked", because it now fires without a pick (D-3).
- `DING_ON_BOTTOM`: "X is a bottom note. The ding is on the top shell: pick another ding below."
- `REPEATED_IN_SHELL`: "X is listed twice. Type the notes in the box above with the second one corrected or removed."
- `SEED_REFUSED`: "These notes do not make a playable scale with that ding. Pick another ding or fix the notes in the scale box above." (integrator decision (b), the eng reviewer's sentence; no parseSeed reason).
- **Accept:** `"IM: every code in the engine's FLAG_ORDER has an IMPORT_FLAG_TEXT line"` is green. Every IM test is green. The served-markup test still finds `#import-row` `hidden`.
- **Verify:** `node --test --test-name-pattern "IM:" tests/app.test.js && node --test tests/app.test.js`.

**E-7. Mutants.**
- One new `ix_*` patch per IX test, each with `# kills:` and a `# suite:` header that names the test with `.` for every space. Each patch strips its `index` lines.
  - `ix_dropped_cue_kept_as_top` (B1)
  - `ix_repeat_in_shell_confirm` (level back to CONFIRM)
  - `ix_cross_shell_repeat_blocks`
  - `ix_ding_not_lowest_skipped`
  - `ix_ding_on_bottom_skipped`
  - `ix_guard_skipped`
  - `ix_dropped_cue_serialised`
  - `ix_ding_clause_drop_wide` (RC-A: restores the clause-wide drop, i.e. removes the one-note-per-clause condition from the drop line; killed by `IX: a ding label holding two notes blocks under any pick` and `IX: an unlabelled line after a ding label is never dropped`)
  - `ix_ding_clause_many_skipped` (RC-A: DING_CLAUSE_MANY is not raised; killed by the same two tests, which then see REVIEW or a different flag list)
  - `ix_ding_clause_text_missing` (app copy: the `DING_CLAUSE_MANY` IMPORT_FLAG_TEXT line removed; suite `IM:.every.code`)
  - `ix_property_sweep_pick_skipped`, which kills the property test by making `pickable` ignore `opts.ding` for DING_NOT_LOWEST only
  - `ix_ding_not_lowest_pick_only` (D-3 back to pick-only; killed by the no-pick DING_NOT_LOWEST test)
  - `ix_seed_refused_appended` (the guard pushes SEED_REFUSED at the end instead of its rank; killed by `IX: every result's flags are in FLAG_ORDER order` and the real-input guard test)
  - `ix_seed_refused_reason_shown` (app copy appends parseSeed's reason; suite the IM copy test that pins the SEED_REFUSED line)
  - `ix_cue_dropped_text_missing` (app copy, suite `IM:.every.code`)
- Refresh the mutants made stale by E-4. These are projected from the prototype; confirm them with `git apply --check`:
  - `i_bottom_no_octave_not_raised`
  - `i_ding_clash_ignored`
  - `i_ding_clash_ignores_pick`
  - `i_displaced_ding_dropped`
  - `i_duplicate_needs_three`
  - `i_paren_notes_become_tops`
  - `i_parens_as_bottom_not_flagged`
  - `i_parens_option_ignored`
  - `i_wide_check_skipped`
  - `i_wide_read_narrowed`
  
  Re-anchor each on the removed line, not on the `@@` header (memory: mutant hunk headers are not line refs). Keep its `# kills:` test. Where E-3 renamed that test, update the header to the new name.
- **Accept:**
  - Every patch passes `git apply --check`.
  - Every new or refreshed patch makes its `# suite:` command fail when applied, and the tree is clean after reverting it.
- **Verify** (a per-patch loop, never with `mutation_check.sh` running in the background):
  - `shopt -s nullglob; for p in tests/mutants/i_*.patch tests/mutants/ix_*.patch; do git apply --check "$p" || echo "STALE $p"; done` (no `im_*` patches exist; nullglob keeps an empty glob from printing a false STALE)
  - then for each new or refreshed `p`: `git apply "$p" && (eval "$(grep -m1 '^# suite:' "$p" | sed 's/^# suite: *//')" >/dev/null 2>&1 && echo "SURVIVED $p" || echo "killed $p"); git apply -R "$p"`
  - `git status --porcelain` must be empty except the lane's own edits.

**E-8. Counts.**
- Open PR M (base `main`, held) and let `validate` finish.
- Set README.md:77's mutant count and the `import.test.js` and `app.test.js` FLOORS rows from that run's artifacts: `mutant-shard-*.txt` and the `js-results.json` totals. This is the `by_module` / `files[].total` rule from memory "FLOORS rows lag the CI count".
- Push. CI then re-runs at the new head.
- **Accept:** `validate` is green at the verified head SHA, including suite health and the mutation shards.
- **Verify:**
  - `python3 -m unittest tests.test_readme_currency && python3 tests/suite_health.py --emit-js /tmp/x.json` (local smoke test)
  - `gh run list --commit <sha> --workflow validate.yml --json conclusion` (the evidence)

**E-9. Delivery.**
- Open PR D from the same head into `dev`.
- **Accept:** D is not CONFLICTING and its base is `dev`.
- **Verify:** `gh pr view <D> --json mergeable,baseRefName` → `mergeable` is `MERGEABLE` and `baseRefName` is `dev` (re-review nit 5; `UNKNOWN` right after the push means re-query, memory: a CONFLICTING PR blocks CI).
- The merge itself goes through the section 6 gates.

**Lane E risks.**
- *Gold regression.* The DING_NOT_LOWEST and REPEATED_IN_SHELL BLOCKs could turn a gold exact into a block. The prototype census holds at exact 25. Assert it in E-4 with `import_gold.test.js`.
- *Real repeats.* A source that genuinely lists the same pitch twice in one shell has no handpan meaning. It now blocks where it used to confirm. That is accepted under D-2.
- *Runtime.* The property tests over every pick could approach the 180 s mutant timeout under a suite selection. Keep all three under 10 s (E-1). A mutant whose suite is a property test must select it alone.
- *Stale-mutant cascade.* The ten `i_*` patches above are projections. The real diff may stale others. The `git apply --check` loop over every `i_*`/`ix_*` is authoritative.
- *D-10 side effect.* A prose note after a second list now also raises DING_NOT_LOWEST. Accepted (D-10); pinned by its E-2 test.
- *App test churn.* The two IM supersessions touch `tests/app.test.js`, which lane C also edits. That is safe because the lanes are serial.

### Lane C: copy (`claude/import-fix-c`), wave 2, after lane E's D PR has merged to `dev`

**Owns:**
- in `index.html`, outside engine regions:
  - every existing `IMPORT_FLAG_TEXT` entry
  - E's six entries, for wording only
  - `IMPORT_INSUFFICIENT`
  - the two status lines
  - the `f.level + ": "` prefix in `paintImportBody`
  - `importFlagLine` formatting helpers
- the copy-asserting IM tests in `tests/app.test.js`
- `ib_*` copy mutants
- README.md:77 and the `app.test.js` FLOORS row (`e2e.test.js` too, if C adds e2e tests)
- e2e copy assertions in `tests/e2e.test.js`, only for import copy
- `CLAUDE.md`, the "Scale import" section only (step C-6; RC4, integrator decision (c))

**Never touch:**
- `src/engine/*`
- engine regions
- `tests/import*.test.js`
- `i_*`/`ix_*` mutants
- data
- `#import-row` `hidden`
- any other section of CLAUDE.md

**Steps:**

**C-1. Copy tests (red).** One per finding, each asserting the exact rendered `<li>` text in `#import-flags` or `#import-msg`:
- `"IC: C1 BOTTOM_NO_OCTAVE names pitch classes, not guessed octaves"`. On yatao-c-ashakiran-15-octaveless the line names "D, E, F, A, B, C" and contains no digit in the note list.
- `"IC: C2 NO_OCTAVE names the notes that lack an octave"`. On the C2 text: "The source gives no octave for C. Inferred: C4." It does not mention bottom notes.
  - On an all-bare source, the line is "The source gives no octaves. Inferred: …".
  - "Bottom notes are a guess." appears only when a bottom note is in `notes`.
- `"IC: C3 INSUFFICIENT points to the box above and mentions images nowhere"`. On a product name, the line is "No note list found. Type the notes in the box above."
  - On a URL, the D-7 link sentence is added.
  - This supersedes the pinned text at app.test.js ~10823.
- `"IC: C4 UNDECLARED_PARENS tells the user to type the line in the box above with the bracket rules"`. The text is: "Brackets around X are not explained by the source. Type the notes in the box above: round brackets mark the ding, square brackets mark bottom notes."
- `"IC: C5 no flag line starts with BLOCK: or CONFIRM:, and the status lines never say blocks"`. Each line starts with "Fix: " or "Check: " (D-8).
- `"IC: every IMPORT_FLAG_TEXT line that tells the user to type says the box above, and every line about notes names them"`. This is a table test over every code, using one fixture input per code. It asserts:
  - no line contains "below" next to "type";
  - the place word is "box above" or "below" for the picker only;
  - the rendered line contains each of `f.notes`' names (octave stripped for BOTTOM_NO_OCTAVE).
- `"IC: CONFIRM ticks under SEED_REFUSED"` (re-review nit 2). SEED_REFUSED co-occurs with DING_CUE_DROPPED on 61 of the 88 Appendix C firings, so a CONFIRM tick is shown on a NEEDS_INPUT result whose USE can never enable. Lane C decides whether ticks show under a BLOCK and pins the decision with this test. **Integrator preference: when SEED_REFUSED is present, hide the CONFIRM ticks** (the CONFIRM lines stay, as text, with no checkbox), since USE cannot enable. Fixture: `Ding: D3 Ding: E3 Top: A3 B3 C4` pick 2. If lane C picks the preference, the test asserts no checkbox in `#import-flags` and the DING_CUE_DROPPED line still present; the matching mutant `ib_ticks_shown_under_seed_refused` joins C-4. If lane C picks otherwise, it records why in the PR body and the test pins that instead.
- **Accept:** all red at lane E's head, for the copy reason only (the tick test: for the tick reason).
- **Verify:** `node --test --test-name-pattern "^IC:" tests/app.test.js`.

**C-2. Rewrite the copy.**
- **Accept:** C-1 is green, and every IM test is green.
- Any IM test that pins old copy is superseded in place. Name each one in the commit message. Known ones:
  - the INSUFFICIENT text test at ~10823
  - the tests matched by `ib_flag_text_parens_missing`, `ib_insufficient_shows_review`, `ib_conflicting_list_variants_merged` and `ib_insufficient_writes_box`
- **Verify:** `node --test tests/app.test.js && python3 tools/validate.py && python3 tools/inline_engine.py --check`.

**C-3. e2e (optional, recommended).** Add `"IC: at 380px a ticked import never shows a parseSeed refusal under the box"` to `tests/e2e.test.js`:
- unhide the row, as the IM e2e tests do;
- B1 pick D3 → tick → USE → `#scale-refusal` is empty;
- B2 → USE is disabled.

Run locally with `CHROME_BIN` for one test. CI is the evidence.
- **Verify:** `node --test --test-name-pattern "IC: at 380px" tests/e2e.test.js`.

**C-4. Mutants.**
- New `ic_*` patches, one per IC test: each restores the old string or the level prefix.
- Refresh the `ib_*` patches that anchor on the rewritten strings.
- **Accept and verify:** the same per-patch loop as E-7, over `tests/mutants/ib_*.patch tests/mutants/ic_*.patch`.

**C-5. Counts and delivery.** Same as E-8 and E-9. Rebase onto lane E's head as merged to `dev` first. PR M has base `main` (its diff carries lane E's commits until #E merges; the gate reads `gh run list --commit <C head> --workflow validate.yml`). PR D, base `dev`, is opened after lane E's D merged. Take the README count and FLOORS from that M run's artifacts.
- **Verify:** `gh pr view <M> --json baseRefName` is `main`.

**C-6. CLAUDE.md "Scale import" (RC4).** Done before C-5's final push, so the count run covers it (`CLAUDE.md` is read by tests and always runs CI).
- Update the section to cite the renamed E-S3 test, "a top note that repeats the ding at its own octave is a REPEATED_IN_SHELL block, not a restatement" (the "Engine pins (lane L1b)" bullet at CLAUDE.md:790 cites the old title).
- State DING_CUE_DROPPED, REPEATED_IN_SHELL, DING_NOT_LOWEST, DING_ON_BOTTOM and SEED_REFUSED, one sentence each, each citing its IX test by exact title (the docs-lane rule: every claim cites a live test).
- Touch no other section.
- **Accept and verify:**
  - `grep -n "is a duplicate, not a restatement" CLAUDE.md` returns nothing (today it is CLAUDE.md:790 at 5a5f7f0).
  - For each new title cited, `grep -c "<title>" tests/import.test.js tests/app.test.js` is at least 1.
  - `git diff origin/dev -- CLAUDE.md` touches only lines inside "## Scale import".

**Lane C risks.**
- *Panel height.* Longer copy can grow the sheet's review block. The SG and panel-fit oracles measure the sheet, not the import area, but the row is hidden on main. Check the DEV render at 380x780 in section 7 instead.
- *"below" ambiguity.* The picker IS below the flags. The table test must allow "below" only next to "pick".
- *Copy pinned by mutants.* An unrefreshed `ib_*` mutant goes stale and fails the mutation gate. The loop in C-4 catches it.

## 6. Standing merge gates (every lane)

0. Lane C's M has base `main` (`gh pr view <M> --json baseRefName`), never a lane branch: `validate.yml` runs on `pull_request` only into `main` (RC1).
1. Before any review, `gh pr view <M> --json state,headRefOid` must equal the local tip. Re-query once if it lags a push.
2. `gh run list --commit <sha> --workflow validate.yml --json conclusion,status` shows `completed`/`success` at that SHA. A green run on any other SHA is not evidence. Vendor checks are ignored.
3. A **fresh** `swarm-reviewer` subagent runs `/review` read-and-report at that SHA, in its own worktree (`git checkout -B review-<lane> <sha>`, with no `node_modules` symlink in this repo).
   - Its brief quotes this plan's lane section verbatim: goal, non-goals, owned and never-touch files, acceptance criteria.
   - It returns PASS or PASS_WITH_NITS. A FAIL needs a concrete failure scenario. After a FAIL: fix, then re-review with a new reviewer. A third FAIL triggers the regroup rule.
   - This reviewer gate before a dev merge is stricter than CLAUDE.md's dev rule (which merges D with no reviewer once M's `validate` is green). That is deliberate: the planner brief asked for it.
4. Merge **D only**: `gh pr merge <D> --merge`. M stays open and held for the owner. Nothing merges to main.
5. After each D merge, confirm that Cloudflare Pages deployed the new `dev` head before running section 7. Check the DEV page source: the `engine:importer` region must match the lane head.

## 7. Final step: DEV e2e on https://handpan-cards-dev.pages.dev

This runs after lane C's D PR merges and Cloudflare deploys. The overlay unhides the import row on DEV.

Run it with the gstack `/browse` skill at 380x780 and at 1280x800, using `S/case.sh` and `S/dump.js`. Screenshots go to `S/shots-fix/`.

For every case, record:
- the status;
- every flag line, verbatim;
- whether USE is enabled;
- after USE, the `#scale-box` value and `#scale-refusal`.

**PASS** means no case that enables USE ever shows a `#scale-refusal`, and every line below matches.

Cases 1 to 8 re-run the integrator's 2026-10-17 run (`S/shots` 01-15):
1. Clean list → REVIEW → USE → generate → flip a card.
2. Octaveless bottoms (`yatao-c-ashakiran-15-octaveless`). This is also **C1**: the line names pitch classes only.
3. Conflicting lists → a BLOCK, with "Fix:" copy.
4. Undeclared parens `Notes: (D3) A3 (C4) (F4) G4`. This is also **C4**: the line says to type in the box above with the bracket rules, and a pick does not clear it.
5. A long pasted page → USE.
6. Conflicting ding. Main note and Hauptnote, see **B1** below.
7. INSUFFICIENT: a product name, then a URL. This is also **C3**: "box above"; no image line; the link sentence only for the URL.
8. At 1280x800, repeat cases 2 and 1 through USE and generate.

Then the findings:
- **B1.** `Main note C3\nNotes: D3 / A3 Bb3 C4 D4 E4 F4 G4 A4`.
  - Pick D3, tick DING_CUE_DROPPED, USE → the box reads `(D3) A3 Bb3 C4 D4 E4 F4 G4 A4` and there is no refusal.
  - Pick C3 → `(C3) D3 A3 Bb3 C4 D4 E4 F4 G4 A4`.
  - Repeat with `Hauptnote C3\nNoten D3 / ...`.
  - Picking A3 shows DING_NOT_LOWEST naming C3 and D3, and USE is disabled.
- **B2.** `Ding: D3 Top: A3 A3 C4 D4 E4 F4` → REPEATED_IN_SHELL names A3. USE is disabled, and nothing is written.
- **C2.** `Ding: D3 Top: A3 Bb3 C D4 E4 F4 G4 A4` → "The source gives no octave for C. Inferred: C4." There is no bottom-note sentence.
- **C5.** No line on any case starts with "BLOCK:" or "CONFIRM:", and no status line says "blocks".

Record the results in the coordination doc, with screenshot names. Any FAIL reopens the owning lane.

## 8. Changes from eng review

### 8.1 Eng review 1 (revision 2)

Eng review: APPROVE_WITH_CHANGES, 7/10 (`S/import-fix/eng-review.md`). Every required change, nit and integrator decision, and where it landed:

| item | change | where |
|---|---|---|
| RC1 | Lane C's M PR has base `main`, not `claude/import-fix-e` (validate.yml runs `pull_request` only into `main`); reviewer's replacement text used verbatim | section 5 intro, C-5, section 6 gate 0 |
| RC2 | SEED_REFUSED is reachable from real picks: 88 texts on the expanded sweep, all picked-ding NO_FIFTH, none without a pick; enumerated | section 3, D-5, Appendix C |
| RC2 | E-5 accept: SEED_REFUSED fires only on the Appendix C inputs, each NEEDS_INPUT with USE disabled | E-5; also property 3 in E-1 |
| RC2 | Guard test driven by the real input `Ding: D3 Ding: E3 Top: A3 B3 C4` ding 2; the stub test kept as a second case | E-2 |
| RC2 / decision (b) | SEED_REFUSED copy is the reviewer's sentence; no parseSeed reason shown | D-5, E-6 |
| RC3 | DING_NOT_LOWEST unconditional (picked or not, unless CONFLICTING_DING); reviewer's D-3 text used | D-3, E-4 |
| RC3 | No-pick test `Ding: D3 Top: C3 A3 Bb3 C4 D4` is NEEDS_INPUT DING_NOT_LOWEST | E-2 |
| RC3 | Synthetic adversarial corpus (965 texts, `synth.js`) added to the sweep and, ported, to the E-1 property corpus | section 3 (e), E-1 |
| RC3 | False sentence "Without a pick, the only violations are the two B2-shaped texts" deleted; 398 no-pick violations reported | section 3 |
| RC3 / decision (a) | The D-10 text gains DING_NOT_LOWEST, keeps CONFLICTING_LIST, stays NEEDS_INPUT; accepted, pinned by a test | D-10, E-2, lane E risks, Appendix A |
| RC4 / decision (c) | CLAUDE.md "Scale import" update is lane C step C-6; CLAUDE.md (that section only) moved from lane C's never-touch to its owned files | lane C owns, C-6 |
| RC4 (found while folding) | `tests/mutants/i_restatement_any_same_pitch_class.patch` `# kills:` also names the E-S3 title; lane E updates it with the rename | E-3 |
| RC5 / decision (d) | SEED_REFUSED is a fixed FLAG_ORDER entry after CONFLICTING_LIST; the guard splices it in at its rank | D-5, E-4, prototype diff |
| RC5 / decision (d) | Property "every result's flags are in FLAG_ORDER order" over the whole sweep corpus, with mutant `ix_seed_refused_appended`; sweep shows 0 disorders under the prototype | E-1, E-7, section 3 |
| nit: E-7 glob | `shopt -s nullglob`, `im_*` dropped | E-7 |
| nit: D-8 wording | First sentence now states the "Fix:" / "Check:" choice; the headings form is the rejected alternative | D-8 |
| nit / decision (e) | E-1 time budget 10 s (measured: 15672 synthetic + gold + fixture runs in 203 ms) | E-1, lane E risks |
| nit: DRY test | Extend and rename the line-87 fixed-point test instead of a parallel walker | E-1 |
| nit: DRY refusal | SEED_REFUSED uses PROVISIONAL_REFUSED's `{refusal:{code,reason}}` shape (revision 3: no helper exists, see 8.2 nit 1) | D-5, E-4 |
| nit: two dropped notes | DING_CUE_DROPPED copy names every dropped note | D-1, E-6 |
| nit: reviewer gate | Stated as deliberately stricter than CLAUDE.md's dev rule | section 6 gate 3 |
| nit: overlap | Lane C rebases on E's merged head before taking FLOORS and the README count from CI artifacts | section 5 intro, C-5 |
| prototype | `wt-proto2` adds DING_ON_BOTTOM (D-4), the rank-spliced SEED_REFUSED and the FLAG_ORDER entries; DING_NOT_LOWEST was already unconditional; diff regenerated | `proto-importer.diff` (revision 1: `proto-importer.pre-eng.diff`) |
| copy follow-on | DING_NOT_LOWEST copy says "the ding", not "the ding you picked", since it now fires without a pick | E-6 |

### 8.2 Eng re-review (revision 3)

Re-review: APPROVE_WITH_CHANGES, 8.5/10 (`S/import-fix/eng-review-2.md`). Folded as the reviewer's auto-choice:

| item | change | where |
|---|---|---|
| RC-A | One note per ding label is the cue; only a single-note label clause is ever dropped; D-1 text updated, and "a note from the note list is never dropped" stays true | D-1 |
| RC-A | A ding label clause with more than one note keeps a block under any pick: new BLOCK `DING_CLAUSE_MANY {notes}` after CONFLICTING_DING in FLAG_ORDER, joins `blocked`; chosen over keeping CONFLICTING_DING because that copy says "pick", which no pick can satisfy | D-1, E-4, E-6 |
| RC-A | IX tests: `Ding: D3 E3 Top: ...` pick 0 is NEEDS_INPUT DING_CLAUSE_MANY; the long-page `Ding: D3\nBb3, C4` pick 11 drops nothing; `Ding: D3 Ding: E3 ...` pick 0 still drops E3 only | E-2 |
| RC-A | Mutants `ix_ding_clause_drop_wide` (restores the clause-wide drop), `ix_ding_clause_many_skipped`, `ix_ding_clause_text_missing` | E-7 |
| RC-A | Lane E writes six IMPORT_FLAG_TEXT entries, lane C may re-word six | lane E owns, E-6, lane C owns |
| RC-A | Prototype `wt-proto3` implements it (backup `proto-importer.pre-rc-a.diff`); sweep on 9018 texts: 0 violations, 0 disorders, gold exact 25 / wrong 0, SEED_REFUSED set unchanged (88), drop rule and no-silent-drop checks 0 exceptions | section 3, Appendix A, Appendix C, `proto-importer.diff` |
| RC-A | `synth.js` gains five RC-A variants (1109 synthetic texts); `sweep4.js` adds the drop-rule check | section 3, E-5 |
| nit 1 | No PROVISIONAL_REFUSED helper exists: "the same `{refusal:{code,reason}}` shape", built inline | D-5, E-4, 8.1 row |
| nit 2 | Lane C decides whether CONFIRM ticks show under a BLOCK and pins it with an IC test; integrator preference: hide them when SEED_REFUSED is present | C-1 |
| nit 3 | E-5 names the absolute scratch path; the sweep scripts are not delivered; lanes run on this machine and copy them into their own scratch out dir | E-5 |
| nit 4 | Property 3's red-at-base reason is one: its FLAG_ORDER-contains-SEED_REFUSED assertion fails | E-1 |
| nit 5 | E-9 verifies `gh pr view <D> --json mergeable,baseRefName` → MERGEABLE and `dev` | E-9 |

## Appendix A. Prototype evidence (wt-proto2, scratch, not delivered)

Revision 1's prototype was `wt-proto`; the table below is unchanged except the bottom-pick and new rows, which reflect `wt-proto2`.

| input | pick | 5a5f7f0 | prototype |
|---|---|---|---|
| B1 Main note | 1 (D3) | REVIEW `C3 (D3) ...` NO_DING | REVIEW, DING_CUE_DROPPED [0], `(D3) A3 Bb3 C4 D4 E4 F4 G4 A4` |
| B1 Main note | 0 (C3) | REVIEW `(C3) D3 A3 ...` | same |
| B1 Hauptnote (no colon) | 1 | NO_DING | same as Main note |
| `Ding: D3 Ding: E3 Top: A3 B3 C4` | 0 / 1 | ok / NO_DING | `(D3) A3 B3 C4` / `(E3) A3 B3 C4`, each with DING_CUE_DROPPED |
| `Main note D4\nNotes: D3 A3 ...` | 1 | NOTE_REPEATED | `(D3) A3 ...`, DING_CUE_DROPPED |
| B2 | none | REVIEW, NOTE_REPEATED | NEEDS_INPUT, REPEATED_IN_SHELL [1,2] |
| `Ding: D3 Top: D3 A3 ...` | none | REVIEW, NOTE_OUT_OF_ORDER | NEEDS_INPUT, REPEATED_IN_SHELL [0,1] |
| CUE `Notes: D3 A3 Bb3 ...` | 3 | NO_DING | NEEDS_INPUT, DING_NOT_LOWEST [0,1,2] |
| `Ding: D3 Top: A3 ... A4, C5 Inner: B4` | 9 | BAD_NOTE barFirst | DING_NOT_LOWEST [0..8,10] |
| `Ding: D3 Top: F#3 A3 C#4 Bottom: Bb2` | 4 | NO_FIFTH | NEEDS_INPUT, DING_ON_BOTTOM (D-4) |
| `Ding: D3 Top: C3 A3 Bb3 C4 D4` | none | REVIEW `C3 (D3) ...` NO_DING | NEEDS_INPUT, DING_NOT_LOWEST (D-3, no pick) |
| `Ding: D3 Ding: E3 Top: A3 B3 C4` | 2 (A3) | NO_DING | NEEDS_INPUT, SEED_REFUSED NO_FIFTH at its rank (D-5) |
| D-10 text | none | NEEDS_INPUT [CONFLICTING_LIST] | NEEDS_INPUT [DING_NOT_LOWEST, CONFLICTING_LIST] |
| `Ding: D3 E3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4` (RC-A, wt-proto3) | 0 | REVIEW, wt-proto2: DING_CUE_DROPPED [1], E3 dropped | NEEDS_INPUT [DING_CLAUSE_MANY [0,1]], `""` |
| same (RC-A) | none | NEEDS_INPUT [CONFLICTING_DING [0,1]] | same |
| `Ding: D3 Bb3 C4 Top: A3 Bb3 ...` (RC-A) | 0 | wt-proto2: DING_CUE_DROPPED [1,2] | NEEDS_INPUT [DING_CLAUSE_MANY [0,1,2], REPEATED_IN_SHELL ...], `""` |
| long-page `...Ding: D3\nBb3, C4` (RC-A) | 11 (D3) | wt-proto2: REVIEW, DING_CUE_DROPPED [12,13] | NEEDS_INPUT [DING_CLAUSE_MANY [11,12,13], REPEATED_IN_SHELL [1,2,12,13]], nothing dropped |
| `Ding: D3 Ding: E3 Top: A3 B3 C4` (RC-A) | 0 | ok | REVIEW `(D3) A3 B3 C4`, DING_CUE_DROPPED [1] (unchanged) |

The sweep over the 8874-text corpus gives 0 violations and 0 flag-order disorders. The gold census is unchanged: exact 25, correct-block 5, correct-insufficient 5, insufficient 5, wrong-but-valid 0. The `import_cases_v1` fixture test is green.

Prototype test fallout, which is the projection for E-3:
- import.test.js: E-S1 and E-S2 (spy counts) and E-S3.
- app.test.js: the two IM tests in E-S4, plus the FLAG_ORDER-text test until E-6 lands.

Stale mutants: the ten listed in E-7.

## Appendix B. Every violating input at 5a5f7f0

The full machine-readable list, all 63891 `(src, text, pick, pickNote, flags, seed, code, reason)` records over the 8874-text corpus, is `S/import-fix/sweep3-wt-base.json`. Regenerate it with `node S/import-fix/sweep3.js <worktree at 5a5f7f0> S/import-fix`. The 11145 synthetic records are there in full; by class: the no-pick ones are 132 NO_DING, 241 NOTE_REPEATED and 25 NOTE_OUT_OF_ORDER (section 3), and samples follow:

    nopick NO_DING            Ding: D3 Top: C3 A3 Bb3 C4 D4 E4 F4 G4 A4 Bottom: Bb2 C3 E3 F3 G3 Inner: C5 D5
    nopick NO_DING            Ding: D3 Top: A3 Bb3 C3 C4 D4 E4 F4 G4 A4
    nopick NO_DING            Ding: D3 Top: A3 Bb3 A2 C4 D4 E4 F4 G4 A4
    nopick NOTE_REPEATED      Ding: D3 Top: A3 A3 Bb3 C4 D4 E4 F4 G4 A4 Bottom: Bb2 C3 E3 F3 G3 Inner: C5 D5
    nopick NOTE_REPEATED      Ding: D3 Top: A3 Bb3 C4 C4 D4 E4 F4 G4 A4 Bottom: Bb2 C3 E3 F3 G3 Inner: C5 D5
    nopick NOTE_OUT_OF_ORDER  Ding: D3 Top: D3 A3 Bb3 C4 D4 E4 F4 G4 A4

The subsections below are revision 1's listing over the 7909 non-synthetic texts (52746 records), kept as is.

Below:
- Every gold, app-constant and finding input is listed with all its violating picks.
- The four small classes are listed in full.
- The three large test-run classes (fuzz and fixture texts, many over 2000 characters) are shown by count and by short samples.

#### pick:NO_DING: 49866 runs, 3439 distinct texts

Every non-test-run input is listed; the 3420 test-run texts are represented by up to 8 samples under 160 characters (full list: sweep.json).

| source | text | picks (index=note) | seed written |
|---|---|---|---|
| gold:yatao-mag-d-kurd-17 | `Top side notes : D3, A3, Bb3, C4, D4, E4, F4, G4, A4, C5, D5\nBottom side notes : Bb2, C3, E3, F3, G3, E5` | 1=A3, 2=Bb3, 3=C4, 4=D4, 5=E4, 6=F4, 7=G4, 8=A4, 9=C5, 10=D5, 13=E3, 14=F3, 15=G3, 16=E5 | `[Bb2] [C3] D3 [E3] [F3] [G3] (A3) Bb3 C4 D4 E4 F4 G4 A4 C5 D5 [E5]` |
| gold:yatao-yataopan-d-kurd-17 | `Top Side Notes : D3 – A3, Bb3, C4, D4, E4, F4, G4, A4, C5, D5, E5, F5\nBottom Side Notes : Bb2, C3, F3, G3` | 1=A3, 2=Bb3, 3=C4, 4=D4, 5=E4, 6=F4, 7=G4, 8=A4, 9=C5, 10=D5, 11=E5, 12=F5, 15=F3, 16=G3 | `[Bb2] [C3] D3 [F3] [G3] (A3) Bb3 C4 D4 E4 F4 G4 A4 C5 D5 E5 F5` |
| gold:yatao-mudra-g2-minor-17 | `Top side notes : G2, G3, A3, Bb3, C4, D4, Eb4, F4, G4\nBottom side notes : D3, Eb3, A4, C5, D5, Eb5, F5, G5` | 1=G3, 2=A3, 3=Bb3, 4=C4, 5=D4, 6=Eb4, 7=F4, 8=G4, 9=D3, 10=Eb3, 11=A4, 12=C5, 13=D5, 14=Eb5, 15=F5, 16=G5 | `G2 [D3] [Eb3] (G3) A3 Bb3 C4 D4 Eb4 F4 G4 [A4] [C5] [D5] [Eb5] [F5] [G` |
| gold:yatao-mag-fs2-minor-16 | `Notes Top Side : F#2 / F#3, G#3, A3, B3, C#4, D4, E4, F#4\nNotes Bottom Side : C#3, D3, E3, G#4, A4, B4 C#5` | 1=F#3, 2=G#3, 3=A3, 4=B3, 5=C#4, 6=D4, 7=E4, 8=F#4, 9=C#3, 10=D3, 11=E3, 12=G#4, 13=A4, 14=B4, 15=C#5 | `F#2 [C#3] [D3] [E3] (F#3) G#3 A3 B3 C#4 D4 E4 F#4 [G#4] [A4] [B4] [C#5` |
| gold:yatao-d-aegean-18 | `Notes Top Side : D3, F#3, A3, C#4, D4, F#4, G#4, A4, C#5, D5, F#5\nNotes Bottom Side : B2, E3, G#3, B3, E4, B4, E5` | 1=F#3, 2=A3, 3=C#4, 4=D4, 5=F#4, 6=G#4, 7=A4, 8=C#5, 9=D5, 10=F#5, 12=E3, 13=G#3, 14=B3, 15=E4, 16=B4, 17=E5 | `[B2] D3 [E3] (F#3) [G#3] A3 [B3] C#4 D4 [E4] F#4 G#4 A4 [B4] C#5 D5 [E` |
| gold:sanango-e-amara-16 | `E Amara 16 notes Top: E3) B3 D4 E4 F#4 G4 A4 B4 D5 E5 F#5 Bottom: C3 D3 G3 A3 C4` | 1=B3, 2=D4, 3=E4, 4=F#4, 5=G4, 6=A4, 7=B4, 8=D5, 9=E5, 10=F#5, 13=G3, 14=A3, 15=C4 | `[C3] [D3] E3 [G3] [A3] (B3) [C4] D4 E4 F#4 G4 A4 B4 D5 E5 F#5` |
| gold:sanango-d-kurd-15 | `D Kurd 15 Notas Top: D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5 D5 Bottom: C3 E3 G3 F3` | 1=A3, 2=Bb3, 3=C4, 4=D4, 5=E4, 6=F4, 7=G4, 8=A4, 9=C5, 10=D5, 12=E3, 13=G3, 14=F3 | `[C3] D3 [E3] [F3] [G3] (A3) Bb3 C4 D4 E4 F4 G4 A4 C5 D5` |
| gold:sela-sehp202-d-amara-11-1 | `Notes: D3/ A3 (Bb3), C4, D4, E4, F4, G4, A4, C5, D5, E5 Extended range with two bottom notes` | 2=Bb3 | `D3 A3 (Bb3) C4 D4 E4 F4 G4 A4 C5 D5 E5` |
| gold:thomann-sonority-d-kurd-10 | `Notes: D3/A3, Bb3, C4, D4, E4, F4, G4, A4, C5` | 1=A3, 2=Bb3, 3=C4, 4=D4, 5=E4, 6=F4, 7=G4, 8=A4, 9=C5 | `D3 (A3) Bb3 C4 D4 E4 F4 G4 A4 C5` |
| gold:yatao-e2-pygmy-17 | `Top side notes : E2 – E3, F#3, G3, B3, D4, E4, F#4, G4\nBottom side notes : B2, D3, A3, C4, B4, C5, D5, E5` | 1=E3, 2=F#3, 3=G3, 4=B3, 5=D4, 6=E4, 7=F#4, 8=G4, 9=B2, 10=D3, 11=A3, 12=C4, 13=B4, 14=C5, 15=D5, 16=E5 | `E2 [B2] [D3] (E3) F#3 G3 [A3] B3 [C4] D4 E4 F#4 G4 [B4] [C5] [D5] [E5]` |
| gold:yatao-a2-amara-9 | `Notes (Top Side) : A2 – E3, G3, A3, B3, C4, D4, E4, G4` | 1=E3, 2=G3, 3=A3, 4=B3, 5=C4, 6=D4, 7=E4, 8=G4 | `A2 (E3) G3 A3 B3 C4 D4 E4 G4` |
| gold:yatao-fs-low-pygmy-19 | `Notes (Top Side) : F#3, G#3, A3, C#4, E4, F#4, G#4, A4, C#5, E5, F#5, G#5\nNotes (Bottom Side) : D3, E3, B3, D4, B4, D5, A5` | 1=G#3, 2=A3, 3=C#4, 4=E4, 5=F#4, 6=G#4, 7=A4, 8=C#5, 9=E5, 10=F#5, 11=G#5, 14=B3, 15=D4, 16=B4, 17=D5, 18=A5 | `[D3] [E3] F#3 (G#3) A3 [B3] C#4 [D4] E4 F#4 G#4 A4 [B4] C#5 [D5] E5 F#` |
| gold:sunreed-zen-d-minor-9 | `The central D3 anchors the instrument ...\nNotes: D3, A3, A#3, C4, D4, E4, F4, G4, A4` | 1=A3, 2=A#3, 3=C4, 4=D4, 5=E4, 6=F4, 7=G4, 8=A4 | `D3 (A3) A#3 C4 D4 E4 F4 G4 A4` |
| gold:amazon-gladfresit-d-minor-9 | `... D minor 9Notes: D3-A3-Bb3-C4-D4-E4-F4-G4-A4.` | 1=A3, 2=Bb3, 3=C4, 4=D4, 5=E4, 6=F4, 7=G4, 8=A4 | `D3 (A3) Bb3 C4 D4 E4 F4 G4 A4` |
| gold:mag-blog-d-kurd | `Ding (center): D3\nOuter circle : A3 – Bb3 – C4 – D4 – E4 – F4 – G4 – A4` | 1=A3, 2=Bb3, 3=C4, 4=D4, 5=E4, 6=F4, 7=G4, 8=A4 | `D3 (A3) Bb3 C4 D4 E4 F4 G4 A4` |
| app.test.js IM const | `Notes: D3 A3 Bb3 C4 D4 E4 F4 G4 A4` | 1=A3, 2=Bb3, 3=C4, 4=D4, 5=E4, 6=F4, 7=G4, 8=A4 | `D3 (A3) Bb3 C4 D4 E4 F4 G4 A4` |
| app.test.js IM const | `Ding: D3 Ding: E3 Top: A3 B3 C4` | 1=E3, 2=A3, 3=B3, 4=C4 | `D3 (E3) A3 B3 C4` |
| finding | `Hauptnote C3\nNoten D3 / A3 Bb3 C4 D4 E4 F4 G4 A4` | 1=D3, 2=A3, 3=Bb3, 4=C4, 5=D4, 6=E4, 7=F4, 8=G4, 9=A4 | `C3 (D3) A3 Bb3 C4 D4 E4 F4 G4 A4` |
| finding | `Ding: D3 Top: A3 A3 C4 D4 E4 F4` | 1=A3, 2=A3, 3=C4, 4=D4, 5=E4, 6=F4 | `D3 (A3) A3 C4 D4 E4 F4` |
| test-run | `Notes: D3 - F#3, A3, C#4, D4, F#4, G#4, A4, C#5, D5, F#5` | 1=F#3, 2=A3, 3=C#4, 4=D4, 5=F#4, 6=G#4, 7=A4, 8=C#5, 9=D5, 10=F#5 | `D3 (F#3) A3 C#4 D4 F#4 G#4 A4 C#5 D5 F#5` |
| test-run | `MAG D Kurd 17\nTop side notes : D3, A3, Bb3, C4, D4, E4, F4, G4, A4, C5, D5\nBottom side notes : Bb2, C3, E3, F3, G3, E5` | 1=A3, 2=Bb3, 3=C4, 4=D4, 5=E4, 6=F4, 7=G4, 8=A4, 9=C5, 10=D5, 13=E3, 14=F3, 15=G3, 16=E5 | `[Bb2] [C3] D3 [E3] [F3] [G3] (A3) Bb3 C4 D4 E4 F4 G4 A4 C5 D5 [E5]` |
| test-run | `Notes: D3 - F#3, A3, C#4, D4, F#4, G#4, A4, C#5, D5, F#5 Bottom Side Notes: B2, E3, G#3, B3, E4, B4, E5` | 1=F#3, 2=A3, 3=C#4, 4=D4, 5=F#4, 6=G#4, 7=A4, 8=C#5, 9=D5, 10=F#5, 12=E3, 13=G#3, 14=B3, 15=E4, 16=B4, 17=E5 | `[B2] D3 [E3] (F#3) [G#3] A3 [B3] C#4 D4 [E4] F#4 G#4 A4 [B4] C#5 D5 [E` |
| test-run | `YataoPan D Kurd 17\nTop Side Notes : D3 – A3, Bb3, C4, D4, E4, F4, G4, A4, C5, D5, E5, F5\nBottom Side Notes : Bb2, C3, F3, G3` | 1=A3, 2=Bb3, 3=C4, 4=D4, 5=E4, 6=F4, 7=G4, 8=A4, 9=C5, 10=D5, 11=E5, 12=F5, 15=F3, 16=G3 | `[Bb2] [C3] D3 [F3] [G3] (A3) Bb3 C4 D4 E4 F4 G4 A4 C5 D5 E5 F5` |
| test-run | `Notes Top Side : F#2 / F#3, G#3, A3, B3, C#4, D4, E4, F#4 Notes Bottom Side : C#3, D3, E3, G#4, A4, B4 C#5` | 1=F#3, 2=G#3, 3=A3, 4=B3, 5=C#4, 6=D4, 7=E4, 8=F#4, 9=C#3, 10=D3, 11=E3, 12=G#4, 13=A4, 14=B4, 15=C#5 | `F#2 [C#3] [D3] [E3] (F#3) G#3 A3 B3 C#4 D4 E4 F#4 [G#4] [A4] [B4] [C#5` |
| test-run | `Notes Top Side : C #3 / G#3, A3, B3, C #4, D#4, E4, F#4, G#4, B4 Notes Bottom Side : E3, F#3, A4, C#5` | 1=G#3, 2=A3, 3=B3, 4=C#4, 5=D#4, 6=E4, 7=F#4, 8=G#4, 9=B4, 10=E3, 11=F#3, 12=A4, 13=C#5 | `C#3 [E3] [F#3] (G#3) A3 B3 C#4 D#4 E4 F#4 G#4 [A4] B4 [C#5]` |
| test-run | `Mudra G Minor 17\nTop side notes : G2, G3, A3, Bb3, C4, D4, Eb4, F4, G4\nBottom side notes : D3, Eb3, A4, C5, D5, Eb5, F5, G5` | 1=G3, 2=A3, 3=Bb3, 4=C4, 5=D4, 6=Eb4, 7=F4, 8=G4, 9=D3, 10=Eb3, 11=A4, 12=C5, 13=D5, 14=Eb5, 15=F5, 16=G5 | `G2 [D3] [Eb3] (G3) A3 Bb3 C4 D4 Eb4 F4 G4 [A4] [C5] [D5] [Eb5] [F5] [G` |
| test-run | `Notes: E3 - B3, D4, E4, F#4, G4, A4, B4, D5, E5, F#5, G5, A5` | 1=B3, 2=D4, 3=E4, 4=F#4, 5=G4, 6=A4, 7=B4, 8=D5, 9=E5, 10=F#5, 11=G5, 12=A5 | `E3 (B3) D4 E4 F#4 G4 A4 B4 D5 E5 F#5 G5 A5` |

#### pick:NO_FIFTH: 2180 runs, 1861 distinct texts

Every non-test-run input is listed; the 1860 test-run texts are represented by up to 8 samples under 160 characters (full list: sweep.json).

| source | text | picks (index=note) | seed written |
|---|---|---|---|
| gold:yatao-fs-low-pygmy-19 | `Notes (Top Side) : F#3, G#3, A3, C#4, E4, F#4, G#4, A4, C#5, E5, F#5, G#5\nNotes (Bottom Side) : D3, E3, B3, D4, B4, D5, A5` | 13=E3 | `[D3] (E3) F#3 G#3 A3 [B3] C#4 [D4] E4 F#4 G#4 A4 [B4] C#5 [D5] E5 F#5 ` |
| test-run | `YataoPan F# low pygmy 19\nNotes (Top Side) : F#3, G#3, A3, C#4, E4, F#4, G#4, A4, C#5, E5, F#5, G#5\nNotes (Bottom Side) : D3, E3, B3, D4, B…` | 13=E3 | `[D3] (E3) F#3 G#3 A3 [B3] C#4 [D4] E4 F#4 G#4 A4 [B4] C#5 [D5] E5 F#5 ` |
| test-run | `Ding: D3 Top: F♯3 A3 C♯4 Bottom: B♭2` | 4=Bb2 | `(Bb2) D3 F#3 A3 C#4` |
| test-run | `Ding: D3 Top: F#3 A3 C#4 Bottom: Bb2` | 4=Bb2 | `(Bb2) D3 F#3 A3 C#4` |
| test-run | `Ding: D3\nTop: A3 Bb3 C4 D4 E4 F4 G4 A4 C5\nBottom: C3 F3 G3 E3 B2` | 14=B2 | `(B2) [C3] D3 [E3] [F3] [G3] A3 Bb3 C4 D4 E4 F4 G4 A4 C5` |
| test-run | `Ding: D3
\nTop: A3 Bb3 C4 D4 E4 F4 G4 A4 C5
\nBottom: C3 F3 G3 E3 B2` | 14=B2 | `(B2) [C3] D3 [E3] [F3] [G3] A3 Bb3 C4 D4 E4 F4 G4 A4 C5` |
| test-run | `Ding: D3\nTop: A3 Bb3 C4 D4 E4 F4 G4 A4 C5\nMaterial: steel\nBottom: C3 F3 G3 E3 B2` | 14=B2 | `(B2) [C3] D3 [E3] [F3] [G3] A3 Bb3 C4 D4 E4 F4 G4 A4 C5` |
| test-run | `Ding: D3
\nTop: A3 Bb3 C4 D4 E4 F4 G4 A4 C5
\nMaterial: steel
\nBottom: C3 F3 G3 E3 B2` | 14=B2 | `(B2) [C3] D3 [E3] [F3] [G3] A3 Bb3 C4 D4 E4 F4 G4 A4 C5` |
| test-run | `Ding: D3\nTop: A3 Bb3 C4 D4 E4 F4 G4 A4 C5\nMaterial: steel\nWeight: five kilos\nBottom: C3 F3 G3 E3 B2` | 14=B2 | `(B2) [C3] D3 [E3] [F3] [G3] A3 Bb3 C4 D4 E4 F4 G4 A4 C5` |

#### pick:BAD_NOTE: 693 runs, 378 distinct texts

Every non-test-run input is listed; the 378 test-run texts are represented by up to 8 samples under 160 characters (full list: sweep.json).

| source | text | picks (index=note) | seed written |
|---|---|---|---|
| test-run | `Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4, C5 Inner: B4` | 9=C5 | `D3 A3 Bb3 C4 D4 E4 F4 G4 A4 \| B4 (C5)` |

#### pick:NOTE_REPEATED: 3 runs, 3 distinct texts

| source | text | picks (index=note) | seed written |
|---|---|---|---|
| test-run | `Main note D4\nNotes: D3 A3 Bb3 C4 D4 E4 F4 G4 A4` | 1=D3 | `(D3) A3 Bb3 C4 D4 D4 E4 F4 G4 A4` |
| test-run | `The pan sounds warm and clear, hand made with care in the shop, number 0.\nThe pan sounds warm and clear, hand made with care in the shop, n…` | 11=D3 | `(D3) A3 Bb3 Bb3 C4 C4 D4 E4 F4 G4 A4 C5 \| D5 E5` |
| finding | `Ding: D3 Top: A3 A3 C4 D4 E4 F4` | 0=D3 | `(D3) A3 A3 C4 D4 E4 F4` |

#### nopick:NOTE_OUT_OF_ORDER: 1 runs, 1 distinct texts

| source | text | picks (index=note) | seed written |
|---|---|---|---|
| test-run | `Ding: D3 Top: D3 A3 Bb3 C4 D4 E4 F4 G4 A4` | none | `(D3) D3 A3 Bb3 C4 D4 E4 F4 G4 A4` |

#### pick:NOTE_OUT_OF_ORDER: 2 runs, 1 distinct texts

| source | text | picks (index=note) | seed written |
|---|---|---|---|
| test-run | `Ding: D3 Top: D3 A3 Bb3 C4 D4 E4 F4 G4 A4` | 0=D3, 1=D3 | `(D3) D3 A3 Bb3 C4 D4 E4 F4 G4 A4` |

#### nopick:NOTE_REPEATED: 1 runs, 1 distinct texts

| source | text | picks (index=note) | seed written |
|---|---|---|---|
| finding | `Ding: D3 Top: A3 A3 C4 D4 E4 F4` | none | `(D3) A3 A3 C4 D4 E4 F4` |

## Appendix C. Every SEED_REFUSED firing under the prototype (wt-proto2)

Re-verified under `wt-proto3` (revision 3, RC-A) on the 9018-text corpus: the same 88 (text, pick) pairs, set difference 0 / 0 (`seed-refused-wt-proto3.json`), the same refusals and the same co-flag counts below. DING_CUE_DROPPED appears on 61 of the 88 (43 + 9 + 6 + 3), the source of re-review nit 2.

88 runs on 88 distinct texts, all under a pick, none without one; all NO_FIFTH. 87 are synthetic, 1 is the app IM constant (row with source `app.test.js IM const`). Role is the picked note's role in the unpicked reading. Machine-readable: `S/import-fix/seed-refused-wt-proto2.json`. Other flags on these results: DING_CUE_DROPPED alone 43, none 9, SOURCE_NOT_ASCENDING 12, SOURCE_NOT_ASCENDING + DING_CUE_DROPPED 9, DUPLICATE_PITCH + DING_CUE_DROPPED 6, DUPLICATE_PITCH 6, SOURCE_NOT_ASCENDING + DUPLICATE_PITCH + DING_CUE_DROPPED 3.

| # | source | text | pick | refusal |
|---|---|---|---|---|
| 1 | app.test.js IM const | `Ding: D3 Ding: E3 Top: A3 B3 C4` | 2=A3 (top) | NO_FIFTH |
| 2 | synthetic | `Ding: C#3 Top: G#2 G#3 B3 C#4 D4 F4 F#4 G#4 B4 Bottom: F#2 A2 Inner: C#5` | 1=G#2 (top) | NO_FIFTH |
| 3 | synthetic | `Ding: C#3 Top: G#3 B3 G#2 C#4 D4 F4 F#4 G#4 B4` | 3=G#2 (top) | NO_FIFTH |
| 4 | synthetic | `Ding: C#3 Ding: G#3 Top: B3 C#4 D4 F4 F#4 G#4 B4` | 1=G#3 (top) | NO_FIFTH |
| 5 | synthetic | `Ding: G#3 Ding: C#3 Top: B3 C#4 D4 F4 F#4 G#4 B4` | 0=G#3 (top) | NO_FIFTH |
| 6 | synthetic | `Ding: C#3 Top: G#2, G#3, B3, C#4, D4, F4, F#4, G#4, B4 Bottom: F#2, A2 Inner: C#5` | 1=G#2 (top) | NO_FIFTH |
| 7 | synthetic | `Ding: C#3 Top: G#3, B3, G#2, C#4, D4, F4, F#4, G#4, B4` | 3=G#2 (top) | NO_FIFTH |
| 8 | synthetic | `Ding: C#3 Ding: G#3 Top: B3, C#4, D4, F4, F#4, G#4, B4` | 1=G#3 (top) | NO_FIFTH |
| 9 | synthetic | `Ding: G#3 Ding: C#3 Top: B3, C#4, D4, F4, F#4, G#4, B4` | 0=G#3 (top) | NO_FIFTH |
| 10 | synthetic | `Ding: C#3 Top: G#2 - G#3 - B3 - C#4 - D4 - F4 - F#4 - G#4 - B4 Bottom: F#2 - A2 Inner: C#5` | 1=G#2 (top) | NO_FIFTH |
| 11 | synthetic | `Ding: C#3 Top: G#3 - B3 - G#2 - C#4 - D4 - F4 - F#4 - G#4 - B4` | 3=G#2 (top) | NO_FIFTH |
| 12 | synthetic | `Ding: C#3 Ding: G#3 Top: B3 - C#4 - D4 - F4 - F#4 - G#4 - B4` | 1=G#3 (top) | NO_FIFTH |
| 13 | synthetic | `Ding: G#3 Ding: C#3 Top: B3 - C#4 - D4 - F4 - F#4 - G#4 - B4` | 0=G#3 (top) | NO_FIFTH |
| 14 | synthetic | `Ding: C#3\nTop: G#2 G#3 B3 C#4 D4 F4 F#4 G#4 B4\nBottom: F#2 A2\nInner: C#5` | 1=G#2 (top) | NO_FIFTH |
| 15 | synthetic | `Ding: C#3\nTop: G#3 B3 G#2 C#4 D4 F4 F#4 G#4 B4` | 3=G#2 (top) | NO_FIFTH |
| 16 | synthetic | `Ding: C#3\nTop: G#2, G#3, B3, C#4, D4, F4, F#4, G#4, B4\nBottom: F#2, A2\nInner: C#5` | 1=G#2 (top) | NO_FIFTH |
| 17 | synthetic | `Ding: C#3\nTop: G#3, B3, G#2, C#4, D4, F4, F#4, G#4, B4` | 3=G#2 (top) | NO_FIFTH |
| 18 | synthetic | `Ding: C#3\nTop: G#2 - G#3 - B3 - C#4 - D4 - F4 - F#4 - G#4 - B4\nBottom: F#2 - A2\nInner: C#5` | 1=G#2 (top) | NO_FIFTH |
| 19 | synthetic | `Ding: C#3\nTop: G#3 - B3 - G#2 - C#4 - D4 - F4 - F#4 - G#4 - B4` | 3=G#2 (top) | NO_FIFTH |
| 20 | synthetic | `Main note C#3\nNotes: G#3 B3 C#4 D4 F4 F#4 G#4 B4\nBottom notes: F#2 A2\nInner notes: C#5` | 1=G#3 (top) | NO_FIFTH |
| 21 | synthetic | `Main note C#3\nNotes: G#3 B3 C#4 D4 F4 F#4 G#4 B4` | 1=G#3 (top) | NO_FIFTH |
| 22 | synthetic | `Main note C#3\nNotes: G#2 G#3 B3 C#4 D4 F4 F#4 G#4 B4\nBottom notes: F#2 A2\nInner notes: C#5` | 1=G#2 (top) | NO_FIFTH |
| 23 | synthetic | `Main note C#3\nNotes: G#3 B3 G#2 C#4 D4 F4 F#4 G#4 B4` | 3=G#2 (top) | NO_FIFTH |
| 24 | synthetic | `Main note B3\nNotes: G#3 B3 C#4 D4 F4 F#4 G#4 B4` | 1=G#3 (top) | NO_FIFTH |
| 25 | synthetic | `Main note F#2\nNotes: G#3 B3 C#4 D4 F4 F#4 G#4 B4\nBottom notes: F#2 A2\nInner notes: C#5` | 1=G#3 (top) | NO_FIFTH |
| 26 | synthetic | `Main note C#3\nNotes: G#3 B3 C#4 D4 F4 F#4 G#4 B4\nBottom notes: F#2 A2 C#3\nInner notes: C#5` | 1=G#3 (top) | NO_FIFTH |
| 27 | synthetic | `Main note C#3\nNotes: G#3 B3 C#4 D4 F4 F#4 G#4 B4\nBottom notes: F#2 A2 C#4\nInner notes: C#5` | 1=G#3 (top) | NO_FIFTH |
| 28 | synthetic | `Main note C#3\nNotes: G#3, B3, C#4, D4, F4, F#4, G#4, B4\nBottom notes: F#2, A2\nInner notes: C#5` | 1=G#3 (top) | NO_FIFTH |
| 29 | synthetic | `Main note C#3\nNotes: G#3, B3, C#4, D4, F4, F#4, G#4, B4` | 1=G#3 (top) | NO_FIFTH |
| 30 | synthetic | `Main note C#3\nNotes: G#2, G#3, B3, C#4, D4, F4, F#4, G#4, B4\nBottom notes: F#2, A2\nInner notes: C#5` | 1=G#2 (top) | NO_FIFTH |
| 31 | synthetic | `Main note C#3\nNotes: G#3, B3, G#2, C#4, D4, F4, F#4, G#4, B4` | 3=G#2 (top) | NO_FIFTH |
| 32 | synthetic | `Main note B3\nNotes: G#3, B3, C#4, D4, F4, F#4, G#4, B4` | 1=G#3 (top) | NO_FIFTH |
| 33 | synthetic | `Main note F#2\nNotes: G#3, B3, C#4, D4, F4, F#4, G#4, B4\nBottom notes: F#2, A2\nInner notes: C#5` | 1=G#3 (top) | NO_FIFTH |
| 34 | synthetic | `Main note C#3\nNotes: G#3, B3, C#4, D4, F4, F#4, G#4, B4\nBottom notes: F#2, A2, C#3\nInner notes: C#5` | 1=G#3 (top) | NO_FIFTH |
| 35 | synthetic | `Main note C#3\nNotes: G#3, B3, C#4, D4, F4, F#4, G#4, B4\nBottom notes: F#2, A2, C#4\nInner notes: C#5` | 1=G#3 (top) | NO_FIFTH |
| 36 | synthetic | `Main note C#3\nNotes: G#3 - B3 - C#4 - D4 - F4 - F#4 - G#4 - B4\nBottom notes: F#2 - A2\nInner notes: C#5` | 1=G#3 (top) | NO_FIFTH |
| 37 | synthetic | `Main note C#3\nNotes: G#3 - B3 - C#4 - D4 - F4 - F#4 - G#4 - B4` | 1=G#3 (top) | NO_FIFTH |
| 38 | synthetic | `Main note C#3\nNotes: G#2 - G#3 - B3 - C#4 - D4 - F4 - F#4 - G#4 - B4\nBottom notes: F#2 - A2\nInner notes: C#5` | 1=G#2 (top) | NO_FIFTH |
| 39 | synthetic | `Main note C#3\nNotes: G#3 - B3 - G#2 - C#4 - D4 - F4 - F#4 - G#4 - B4` | 3=G#2 (top) | NO_FIFTH |
| 40 | synthetic | `Main note B3\nNotes: G#3 - B3 - C#4 - D4 - F4 - F#4 - G#4 - B4` | 1=G#3 (top) | NO_FIFTH |
| 41 | synthetic | `Main note F#2\nNotes: G#3 - B3 - C#4 - D4 - F4 - F#4 - G#4 - B4\nBottom notes: F#2 - A2\nInner notes: C#5` | 1=G#3 (top) | NO_FIFTH |
| 42 | synthetic | `Main note C#3\nNotes: G#3 - B3 - C#4 - D4 - F4 - F#4 - G#4 - B4\nBottom notes: F#2 - A2 - C#3\nInner notes: C#5` | 1=G#3 (top) | NO_FIFTH |
| 43 | synthetic | `Main note C#3\nNotes: G#3 - B3 - C#4 - D4 - F4 - F#4 - G#4 - B4\nBottom notes: F#2 - A2 - C#4\nInner notes: C#5` | 1=G#3 (top) | NO_FIFTH |
| 44 | synthetic | `Ding: F3 Top: Eb3 G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 Bottom: C3 Db3 Eb3 Bb3 Db4 Inner: F5 G5` | 1=Eb3 (top) | NO_FIFTH |
| 45 | synthetic | `Ding: F3 Top: G3 Ab3 Eb3 C4 Eb4 F4 G4 Ab4 C5 Eb5` | 3=Eb3 (top) | NO_FIFTH |
| 46 | synthetic | `Ding: F3 Ding: G3 Top: Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5` | 1=G3 (top) | NO_FIFTH |
| 47 | synthetic | `Ding: G3 Ding: F3 Top: Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5` | 0=G3 (top) | NO_FIFTH |
| 48 | synthetic | `Main note Eb3\nNotes: F3 / G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5` | 0=Eb3 (ding) | NO_FIFTH |
| 49 | synthetic | `Ding: F3 Top: Eb3, G3, Ab3, C4, Eb4, F4, G4, Ab4, C5, Eb5 Bottom: C3, Db3, Eb3, Bb3, Db4 Inner: F5, G5` | 1=Eb3 (top) | NO_FIFTH |
| 50 | synthetic | `Ding: F3 Top: G3, Ab3, Eb3, C4, Eb4, F4, G4, Ab4, C5, Eb5` | 3=Eb3 (top) | NO_FIFTH |
| 51 | synthetic | `Ding: F3 Ding: G3 Top: Ab3, C4, Eb4, F4, G4, Ab4, C5, Eb5` | 1=G3 (top) | NO_FIFTH |
| 52 | synthetic | `Ding: G3 Ding: F3 Top: Ab3, C4, Eb4, F4, G4, Ab4, C5, Eb5` | 0=G3 (top) | NO_FIFTH |
| 53 | synthetic | `Main note Eb3\nNotes: F3 / G3, Ab3, C4, Eb4, F4, G4, Ab4, C5, Eb5` | 0=Eb3 (ding) | NO_FIFTH |
| 54 | synthetic | `Ding: F3 Top: Eb3 - G3 - Ab3 - C4 - Eb4 - F4 - G4 - Ab4 - C5 - Eb5 Bottom: C3 - Db3 - Eb3 - Bb3 - Db4 Inner: F5 - G5` | 1=Eb3 (top) | NO_FIFTH |
| 55 | synthetic | `Ding: F3 Top: G3 - Ab3 - Eb3 - C4 - Eb4 - F4 - G4 - Ab4 - C5 - Eb5` | 3=Eb3 (top) | NO_FIFTH |
| 56 | synthetic | `Ding: F3 Ding: G3 Top: Ab3 - C4 - Eb4 - F4 - G4 - Ab4 - C5 - Eb5` | 1=G3 (top) | NO_FIFTH |
| 57 | synthetic | `Ding: G3 Ding: F3 Top: Ab3 - C4 - Eb4 - F4 - G4 - Ab4 - C5 - Eb5` | 0=G3 (top) | NO_FIFTH |
| 58 | synthetic | `Main note Eb3\nNotes: F3 / G3 - Ab3 - C4 - Eb4 - F4 - G4 - Ab4 - C5 - Eb5` | 0=Eb3 (ding) | NO_FIFTH |
| 59 | synthetic | `Ding: F3\nTop: Eb3 G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5\nBottom: C3 Db3 Eb3 Bb3 Db4\nInner: F5 G5` | 1=Eb3 (top) | NO_FIFTH |
| 60 | synthetic | `Ding: F3\nTop: G3 Ab3 Eb3 C4 Eb4 F4 G4 Ab4 C5 Eb5` | 3=Eb3 (top) | NO_FIFTH |
| 61 | synthetic | `Ding: F3\nTop: Eb3, G3, Ab3, C4, Eb4, F4, G4, Ab4, C5, Eb5\nBottom: C3, Db3, Eb3, Bb3, Db4\nInner: F5, G5` | 1=Eb3 (top) | NO_FIFTH |
| 62 | synthetic | `Ding: F3\nTop: G3, Ab3, Eb3, C4, Eb4, F4, G4, Ab4, C5, Eb5` | 3=Eb3 (top) | NO_FIFTH |
| 63 | synthetic | `Ding: F3\nTop: Eb3 - G3 - Ab3 - C4 - Eb4 - F4 - G4 - Ab4 - C5 - Eb5\nBottom: C3 - Db3 - Eb3 - Bb3 - Db4\nInner: F5 - G5` | 1=Eb3 (top) | NO_FIFTH |
| 64 | synthetic | `Ding: F3\nTop: G3 - Ab3 - Eb3 - C4 - Eb4 - F4 - G4 - Ab4 - C5 - Eb5` | 3=Eb3 (top) | NO_FIFTH |
| 65 | synthetic | `Main note F3\nNotes: G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5\nBottom notes: C3 Db3 Eb3 Bb3 Db4\nInner notes: F5 G5` | 1=G3 (top) | NO_FIFTH |
| 66 | synthetic | `Main note F3\nNotes: G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5` | 1=G3 (top) | NO_FIFTH |
| 67 | synthetic | `Main note F3\nNotes: Eb3 G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5\nBottom notes: C3 Db3 Eb3 Bb3 Db4\nInner notes: F5 G5` | 1=Eb3 (top) | NO_FIFTH |
| 68 | synthetic | `Main note F3\nNotes: G3 Ab3 Eb3 C4 Eb4 F4 G4 Ab4 C5 Eb5` | 3=Eb3 (top) | NO_FIFTH |
| 69 | synthetic | `Main note Ab3\nNotes: G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5` | 1=G3 (top) | NO_FIFTH |
| 70 | synthetic | `Main note C3\nNotes: G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5\nBottom notes: C3 Db3 Eb3 Bb3 Db4\nInner notes: F5 G5` | 1=G3 (top) | NO_FIFTH |
| 71 | synthetic | `Main note F3\nNotes: G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5\nBottom notes: C3 Db3 Eb3 Bb3 Db4 F3\nInner notes: F5 G5` | 1=G3 (top) | NO_FIFTH |
| 72 | synthetic | `Main note F3\nNotes: G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5\nBottom notes: C3 Db3 Eb3 Bb3 Db4 C4\nInner notes: F5 G5` | 1=G3 (top) | NO_FIFTH |
| 73 | synthetic | `Main note F3\nNotes: G3, Ab3, C4, Eb4, F4, G4, Ab4, C5, Eb5\nBottom notes: C3, Db3, Eb3, Bb3, Db4\nInner notes: F5, G5` | 1=G3 (top) | NO_FIFTH |
| 74 | synthetic | `Main note F3\nNotes: G3, Ab3, C4, Eb4, F4, G4, Ab4, C5, Eb5` | 1=G3 (top) | NO_FIFTH |
| 75 | synthetic | `Main note F3\nNotes: Eb3, G3, Ab3, C4, Eb4, F4, G4, Ab4, C5, Eb5\nBottom notes: C3, Db3, Eb3, Bb3, Db4\nInner notes: F5, G5` | 1=Eb3 (top) | NO_FIFTH |
| 76 | synthetic | `Main note F3\nNotes: G3, Ab3, Eb3, C4, Eb4, F4, G4, Ab4, C5, Eb5` | 3=Eb3 (top) | NO_FIFTH |
| 77 | synthetic | `Main note Ab3\nNotes: G3, Ab3, C4, Eb4, F4, G4, Ab4, C5, Eb5` | 1=G3 (top) | NO_FIFTH |
| 78 | synthetic | `Main note C3\nNotes: G3, Ab3, C4, Eb4, F4, G4, Ab4, C5, Eb5\nBottom notes: C3, Db3, Eb3, Bb3, Db4\nInner notes: F5, G5` | 1=G3 (top) | NO_FIFTH |
| 79 | synthetic | `Main note F3\nNotes: G3, Ab3, C4, Eb4, F4, G4, Ab4, C5, Eb5\nBottom notes: C3, Db3, Eb3, Bb3, Db4, F3\nInner notes: F5, G5` | 1=G3 (top) | NO_FIFTH |
| 80 | synthetic | `Main note F3\nNotes: G3, Ab3, C4, Eb4, F4, G4, Ab4, C5, Eb5\nBottom notes: C3, Db3, Eb3, Bb3, Db4, C4\nInner notes: F5, G5` | 1=G3 (top) | NO_FIFTH |
| 81 | synthetic | `Main note F3\nNotes: G3 - Ab3 - C4 - Eb4 - F4 - G4 - Ab4 - C5 - Eb5\nBottom notes: C3 - Db3 - Eb3 - Bb3 - Db4\nInner notes: F5 - G5` | 1=G3 (top) | NO_FIFTH |
| 82 | synthetic | `Main note F3\nNotes: G3 - Ab3 - C4 - Eb4 - F4 - G4 - Ab4 - C5 - Eb5` | 1=G3 (top) | NO_FIFTH |
| 83 | synthetic | `Main note F3\nNotes: Eb3 - G3 - Ab3 - C4 - Eb4 - F4 - G4 - Ab4 - C5 - Eb5\nBottom notes: C3 - Db3 - Eb3 - Bb3 - Db4\nInner notes: F5 - G5` | 1=Eb3 (top) | NO_FIFTH |
| 84 | synthetic | `Main note F3\nNotes: G3 - Ab3 - Eb3 - C4 - Eb4 - F4 - G4 - Ab4 - C5 - Eb5` | 3=Eb3 (top) | NO_FIFTH |
| 85 | synthetic | `Main note Ab3\nNotes: G3 - Ab3 - C4 - Eb4 - F4 - G4 - Ab4 - C5 - Eb5` | 1=G3 (top) | NO_FIFTH |
| 86 | synthetic | `Main note C3\nNotes: G3 - Ab3 - C4 - Eb4 - F4 - G4 - Ab4 - C5 - Eb5\nBottom notes: C3 - Db3 - Eb3 - Bb3 - Db4\nInner notes: F5 - G5` | 1=G3 (top) | NO_FIFTH |
| 87 | synthetic | `Main note F3\nNotes: G3 - Ab3 - C4 - Eb4 - F4 - G4 - Ab4 - C5 - Eb5\nBottom notes: C3 - Db3 - Eb3 - Bb3 - Db4 - F3\nInner notes: F5 - G5` | 1=G3 (top) | NO_FIFTH |
| 88 | synthetic | `Main note F3\nNotes: G3 - Ab3 - C4 - Eb4 - F4 - G4 - Ab4 - C5 - Eb5\nBottom notes: C3 - Db3 - Eb3 - Bb3 - Db4 - C4\nInner notes: F5 - G5` | 1=G3 (top) | NO_FIFTH |
