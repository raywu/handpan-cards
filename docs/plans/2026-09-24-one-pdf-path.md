# One PDF path, one print UX

**Status:** plan, not yet executed. Drafted 2026-09-24 against `1185886`.
**Supersedes nothing.** It CONSUMES `docs/plans/2026-09-22-seed-pdf-one-source.md`
Stages A and B as its first two waves and adds the app-UX layer that plan
explicitly put out of scope (its section 6, and a grep of it for `PRINT_PDFS`,
`headerHTML`, `downloadDeckPDF` or `target="_blank"` returns nothing).

## Goal

Every deck in the app - built-in and generated - produces its print PDF through
one code path, with one set of controls, one delivery behaviour, and one
remembered paper size.

## Non-goals

- Retiring `tools/hifi.py`. Owner answer Q5 (2026-09-23) keeps it; see D-0.
- The D2 browser-print cutover. `openPrintSheet` (`index.html:6119`) and
  `PRINT_LAYOUTS` stay in place, unreferenced, until row 223's device gate says
  the emitter prints correctly on the phone.
- Changing chord data, voicings, ranking, card copy, or the print layout.
- Adopting generated geometry (it shrinks Pygmy's diagram 15.7%).
- The iOS `Unknown.pdf` filename - queue row 316, WONTFIX.
- Fixing the engine's degree derivation for Pygmy `Fm9`.

## 1. Owner decisions

### D-0. What "one path" means (BLOCKING - answer before Wave 1)

"One path" is in tension with Q5, which the owner answered on 2026-09-23 as a
direct instruction. Two readings:

| | (a) One RUNTIME path **[recommended]** | (b) One IMPLEMENTATION |
|---|---|---|
| App | every deck renders through `HPE.pdfcards` | same |
| `tools/hifi.py` | survives: build-time producer of the six committed PDFs, and the Python half of `tests/test_pdf_parity.py` | deleted |
| Consistent with Q5 | yes | **no - reverses it** |
| Cross-emitter oracle | kept | spent |
| Delivers the owner's UX ask | in full | in full |

Recommend **(a)**. What (a) does NOT buy, stated plainly: the six committed PDFs
stay Python-built, so "one path" becomes true of the **app** and not of the
**repo**. If the owner wants the committed files emitted by JS as well, that is
a third option - it is Stage C of the seed-pdf plan, it was cancelled by Q5, and
reopening it is a separate decision, not a consequence of this one.

Everything below assumes (a).

### D-1. Do the six committed PDFs still ship?

Under (a) nothing in the app links them any more. Recommend **keep them, ship
them, stop linking them**: they remain the print-shop artifact, they are the
reference for `tests/test_pdf_build.py::test_committed_pdfs_match_a_fresh_build`,
and `tests/test_gen_deck.py` sha256-guards them. Cost of keeping: zero, because
`tools/decks.py` and `hifi.py` survive under D-0(a) regardless. Alternative -
delete them - also deletes a staleness gate and a print-shop deliverable to save
six files. No `_A4.pdf` siblings are created: A4 becomes a runtime choice, which
is the point.

### D-2. Which delivery behaviour wins on iOS? (DEVICE-GATED)

Today built-ins open a new tab (`target="_blank"`) and generated decks replace
the current page (`window.location.href = url`, `index.html:6176`). One of them
has to go.

- **(A) Same tab** - what `downloadDeckPDF` does now. Simplest; the reader loses
  the app and comes back with the browser Back button.
- **(B) New tab, falling back to same tab [recommended]** - `window.open(url)`;
  if it returns `null` (popup blocked) fall back to `location.href`. The app
  survives behind the PDF, which is the behaviour the owner has actually been
  living with on built-in decks, and the fallback means a blocked popup still
  delivers the file.

Recommend **(B)**. The fallback makes it safe without a device answer; **which
branch actually fires on iPhone 14 / iOS 26.6 Chrome is not knowable from CI**
and goes on the device checklist (section 6). Non-iOS is unchanged: `<a download>`.

### D-3. Paper selector and persistence

Recommend: render the LETTER/A4 `<select>` for **every** deck, and persist
`printPaper` into the existing `"hpfc"` settings object alongside `deck` and
`mode` (`index.html:5395-5427`), read-modify-write, type-guarded on read like
`store.deck` and `store.mode` already are. No new storage key.

## 2. Measured evidence

Every figure below was measured at `1185886` on 2026-09-24. Commands are given
so a reviewer re-derives rather than confirms.

**The two delivery paths.** `grep -n 'function headerHTML' index.html` -> the
`prints` branch is a ternary on `PRINT_PDFS[d.id]`:

- built-in: two `<a href=... target="_blank" rel="noopener">`, hrefs from
  `const PRINT_PDFS`, whose six values all end `_Letter.pdf`. No selector.
- generated: two `<button onclick="downloadDeckPDF(...)">` plus
  `<select aria-label="Paper size" onchange="setPrintPaper(this.value)">`.

**No A4 file exists.** `ls *.pdf | wc -l` -> `6`; `ls *_A4.pdf` -> nothing. The
built-in branch has no A4 href to offer, which is *why* the selector is absent -
it is a consequence of the file-linking design, not an oversight.

**`printPaper` does not persist.** `grep -n 'localStorage' index.html` -> three
hits (`:5397`, `:5426`, `:5552`). `save()` writes `next.deck` and `next.mode`
only. `let printPaper = "letter"` is a module-level binding reset on every load.

**The hard precondition.** `python3 -c "import json;d=json.load(open('data/decks.json'));print(any('ext' in x['geom'] for x in d))"`
-> `False`. `src/engine/pdfdeck.js:161` throws `"generated deck has no geom.ext"`.
**`fromGenerated` therefore cannot consume a built-in deck at all today**, and no
UX change can land before that is solved. Note the throw is a deliberate guard
(its comment: a silent 1.0 fallback "draws the diagram over the header and off
both edges of the card with nothing red") - it is not to be weakened. A sibling
`fromBuiltin` is the fix, exactly as the seed-pdf plan's B2 specifies.

**What `fromBuiltin` must supply.** `fromGenerated` returns
`title, name, sub, credit, blurb, legend_lines, legend_demo, spec, chords,
degrees, has_bottom, warnings, R, cy, y_note, y_num, col_root, col_tone, grad`.
`src/engine/pdfcards.js:557` additionally reads `deck.blank_cards || 0`, so
Pygmy's 7 blanks need no `pdfcards` change. The built-in values for all of these
are the literals in `tools/decks.py:261-303`, which Wave 1 moves into a
per-deck `print` key inside `data/decks.json` (review A1).

**`blurb` is the one field that is not copied through.** `_from_canonical`
(`tools/decks.py:249-258`) re-substitutes the chord count:
`re.sub(r"\d+(?=\s*CHORDS)", str(len(chords)), lines[-1])`. The literals are
stale by design (hijaz `18` -> prints `19`, pygmy `25` -> `52`, amara `16` ->
`25`). `fromBuiltin` must reproduce the substitution, with `/g` or `replaceAll` -
JS `String.replace` with a bare regex replaces only the first match.

**`Fm9`.** The emitter reproduces committed chord data on 95 of 96 cards
(hijaz 19/19, amara 25/25, pygmy 51/52). Pygmy card 6 `Fm9` is the exception -
the engine derives `G4 / 6` where the committed deck has `G5 / 11`. The built-in
path must READ `chords[].fields` from `data/decks.json` and never re-derive.

**The two oracles are distinct** - the seed-pdf plan conflated them once and was
corrected:

1. **Cross-emitter parity**: `tests/test_pdf_parity.py`. `_pair` builds both
   sides fresh into a `tempfile.mkdtemp()` and opens no committed PDF.
2. **Committed-bytes staleness**: `tests/test_pdf_build.py`,
   `test_committed_pdfs_match_a_fresh_build`. It reads
   `os.path.join(paths.ROOT, paths.PDFS[key])` - a working-tree path that
   `tools/decks.py`'s `__main__` overwrites - so **any acceptance command
   prefixed with `python3 tools/decks.py &&` compares a build against itself and
   passes vacuously.** That is Wave 0's whole job.

**Sizes** (`ls src/engine/*.js | wc -l`, `ls tests/*.test.js | wc -l`,
`ls tests/test_*.py | wc -l`, `ls tests/mutants/*.patch | wc -l`,
`grep -c 'engine:.* begin' index.html`): 10 engine modules, 10 inlined engine
regions, 12 node suites, 13 python suites, 383 mutants, 96 cards, 3 decks.

**Tests that pin the markup this plan changes.** `tests/e2e.test.js` -
`"the deck header links to both committed PDFs for every deck, with relative
hrefs"`, `"the print links sit outside .hdr and do not grow the deck-name box"`,
`"Enter on a print link opens the PDF and does not flip the card"`,
`"only the showing face's print links are in the tab order"`,
`"print controls on the hidden face"`, `"the custom-deck CTA downloads a PDF a
reader can open"`. Four of these query `.prints a`; under this plan there are no
`.prints a` elements left. They are rewritten, not deleted - each one's
*intent* (relative hrefs, box growth, Enter not flipping, tab order, hidden
face) survives against buttons. `tests/app.test.js` also asserts a printed card
carries no `.prints` row; that stays true and needs no change.
`index.html:5644`'s comment about "the `PRINT_PDFS` hrefs" goes stale and must
be updated in the same commit.

**Three mutants patch this code, and one of them will stop applying.**
`grep -ln 'PRINT_PDFS\|downloadDeckPDF\|printPaper' tests/mutants/*.patch` ->
`d_esc_attr_leaves_quote`, `p_paper_picker_forgets_its_state`,
`p_print_cta_drops_the_platform`. `p_paper_picker_forgets_its_state`'s hunk is
anchored at `@@ -6205,8 +6205,8 @@ function headerHTML` and patches the
`<select>` **inside the custom-only branch** that W3 collapses. A patch that no
longer applies is not skipped: `tests/mutation_check.sh:220-221` runs
`git apply --check` and counts a failure as a **SURVIVOR**, which reddens the
all-or-nothing mutation gate. W3 must repair that patch against the new markup
in the same PR, and re-check the other two. `tools/regen_data_mutants.py` does
not help here - it regenerates the `d_*` data mutants anchored on the `DECKS`
line, not hand-written `p_*` patches.

## 3. Lanes

**The lane split is dictated by one fact: `index.html` is a single file.** This
repo has already recorded the consequence -
`docs/plans/2026-09-21-print-cta-and-error-placement.md`: *"Serial, not parallel:
both touch `index.html`, so there is no ownership boundary to split on."* The
axes that do parallelise here are `tools/*.py` + `data/`, `src/engine/*.js`, and
`tests/`; the app-UX work is one lane and cannot be more than one.

**The honest shape is a chain, not a fan.** Each wave is a hard precondition for
the next: the staleness oracle must be real before the overlay move can be
trusted; the overlay must exist before `fromBuiltin` can read it; `fromBuiltin`
must exist before the UI can call it. **Do not pad the lane count.** Wave 1 is
the only place two lanes can run at once, and only because W1a touches no file
W1b touches.

| Wave | Lane | Owns | Never touches | Depends on |
|---|---|---|---|---|
| 0 | **W0 oracle** | `tests/test_pdf_build.py` | everything else | - |
| 1 | **W1a overlay** | `data/decks.json` (the new `print` key), `tools/decks.py`, `CLAUDE.md` repo-layout paragraph, the regenerated `const DECKS` line via `tools/sync_decks.py` | `index.html` by hand, `src/engine/`, `tests/`, `tools/validate.py` | W0 |
| 1 | **W1b print tests** | `tests/test_print.py`, `tests/mutants/w1b_*.patch` (new) | `tools/`, `data/`, `index.html` | W0 |
| 2 | **W2 emitter** | `src/engine/pdfdeck.js`, `tools/pdf_build.js`, `tests/pdf_builtin.test.js` (new), `tests/test_pdf_parity.py`, the `engine:pdfdeck` region of `index.html` via `tools/inline_engine.py` | app JS/markup/CSS in `index.html`, `tools/decks.py`, `tools/hifi.py` | W1a |
| 3 | **W3 UX** | app JS, markup and CSS in `index.html` (OUTSIDE every engine region), `tests/e2e.test.js`, `tests/app.test.js` | `src/engine/`, `tools/`, `data/`, any engine region | W2 |
| 3 | **W3d docs** | `README.md`, `docs/plans/scale-engine-coordination.md`, the memory file | code, tests | W2 |

W2 and W3 both write `index.html` and **must not overlap**: W2 only ever
regenerates an engine region via `tools/inline_engine.py`, W3 only ever edits
outside every region, and W3 starts after W2 merges. A conflict inside an engine
region is resolved by taking either side and re-running the tool, never by hand
(CLAUDE.md).

**Projected cost:** 6 lanes -> ~12 subagent runs, ~6 CI runs, +1 reviewer and +1
CI run per bounce. The mutation gate alone is ~11 min per run, so budget ~90 min
of CI wall-clock before bounces. Concurrency never exceeds 2.

## 4. Tasks

Every lane is TDD: the failing test is step 1, always. Every acceptance
criterion below carries the exact command that verifies it.

### W0 - make the committed-bytes oracle real

This is the seed-pdf plan's A1/T10, unchanged, and it goes first because every
later lane's acceptance depends on it not passing vacuously.

1. In `tests/test_pdf_build.py::test_committed_pdfs_match_a_fresh_build`,
   read the reference from `git show HEAD:<pdf>` into a temp file instead of
   `os.path.join(paths.ROOT, paths.PDFS[key])`.
2. Prove the gate now bites: with the change in place, rebuild
   (`python3 tools/decks.py`) **without committing**, and confirm the test still
   compares against `HEAD` and passes; then make a deck-data edit in a scratch
   commit and confirm it goes red. Record both observations in the PR body.

**Acceptance:** `python3 -W error::ResourceWarning -m unittest tests.test_pdf_build -v`
green; and `python3 tools/decks.py && python3 -m unittest tests.test_pdf_build -v`
green for a *different reason than before* - the rebuild no longer feeds the
comparison. **Non-goal:** no new test file (the seed-pdf plan's O-1 retired
`tests/test_seed_pdf_equivalence.py` as strictly weaker than the glyph-exact
parity harness).

### W1a - the print overlay becomes data

Seed-pdf plan A2 + A3.

**Review A1 changed this lane's shape: there is no new file.** The overlay goes
into `data/decks.json` under a per-deck `print` key, so it rides the sync step
and the drift check that already exist. `tools/sync_decks.py:49` is
`want = json.dumps(canonical())` - the whole `const DECKS` line is a dump of the
canonical file, so new keys need no tool change - and `tools/validate.py:41-46`
check 1 already fails when the two sides diverge. That deletes W3 step 3, the
second sync mechanism, and the new validate check this lane was going to write.

1. Add a `print` object to each of `hijaz`, `pygmy`, `amara` in
   `data/decks.json`, holding the literals now at `tools/decks.py:261-303` - `title`, `credit`, `R`, `cy`,
   `y_note`, `y_num`, `legend_demo`, `legend_lines`, `blurb`, `blank_cards`
   (pygmy only), and the three-decimal colour values for `col_root`, `col_tone`,
   `grad`. **Copied verbatim, not re-derived.** `blurb` keeps its stale chord
   count (hijaz `18`, pygmy `25`, amara `16`); the count is derived downstream
   and a corrected literal would be indistinguishable from a correct one after
   substitution, which would let the substitution be deleted silently.
   The colours must be the committed three-decimal values: `_hex_color("#E0559A")`
   returns `0.878431...`, not `0.878`, and re-deriving moves every printed colour.
2. `tools/decks.py` reads `deck["print"]` instead of carrying the literals. The
   `_from_canonical` clash guard stays - widen it to ignore the `print` key
   rather than treating it as a colliding field. The chord-count substitution
   stays.
3. `python3 tools/sync_decks.py` and commit the regenerated `const DECKS` line.
   No new sync step, no new validate check: check 1 covers it.
4. Amend CLAUDE.md's repo-layout paragraph, which says `decks.py` "carries only
   the PRINT OVERLAY ... as literals". It no longer does, and under D-0(a) the
   app needs those values too, which is why the separation dissolves.

**Acceptance:** `python3 tools/validate.py` green (check 1 now covers the
overlay); `python3 tools/decks.py && git diff --stat -- '*.pdf'` shows only
reportlab's creation-date churn and no text change - verified by
`python3 -W error::ResourceWarning -m unittest tests.test_pdf_build tests.test_print -v`
green (W0 makes that test meaningful) - plus `python3 tools/validate.py` green.
**Do not commit rebuilt PDFs from this lane**; the outputs are unchanged by
design, and committing date-churn would mask a real diff.

### W1b - pin what must not move

**Assertions read the constructed deck objects (`decks.HIJAZ.R`), never the
module source** (review A2). W1a runs concurrently and moves those literals out
of `tools/decks.py`; a grep-shaped assertion would break mid-wave, an
object-shaped one works under either merge order.

1. Assert in `tests/test_print.py` that each deck's `R`/`cy`/`y_note`/`y_num` are
   exactly `73.0/126.0/30.0/14.0` (hijaz, amara) and `60.0/121.0/30.0/14.0`
   (pygmy) - the values Q1 kept, and the ones a later "just use the solver"
   refactor would quietly move by -15.7% on Pygmy.
2. Assert the hand-written `credit` strings survive, `C# HIJAZ / ORION` included
   (Q2), and Pygmy's `blank_cards == 7` (Q4).

`tests/test_print.py:876-913` (`TitleBlurbChordCountTest`) already pins the
blurb substitution and needs no change.

3. Ship two mutants so the new assertions are guarded by CI and not by a PR-body
   claim (review C3): one moving a pinned geometry value, one damaging a
   `credit` string. `tests/mutants/` is shared with W3, but the patch FILES are
   disjoint - W1b creates `w1b_*.patch`, W3 only repairs the three existing
   `p_*`/`d_*` patches.

**Acceptance:** `python3 -W error::ResourceWarning -m unittest tests.test_print -v`
green; both new mutants killed by `tests/mutation_check.sh`; and each new
assertion demonstrated red against a deliberately wrong value before the lane
commits (paste both outputs in the PR body).

### W2 - the emitter can build a built-in deck

Seed-pdf plan B0-B5, unchanged. Summarised here; **that document is the
authoritative task list, including its corrections** - read B1's blurb table and
B3's stdin warning before writing code.

1. **B1** `tests/pdf_builtin.test.js`: feed a built-in deck + its overlay to a new
   `HPE.pdfdeck.fromBuiltin(deck, overlay)`; assert it carries `R`, `cy`, `title`,
   `credit`, `legend_lines`, `blank_cards` unchanged; asserts `blurb` is the
   overlay literal **with the count substituted**; asserts the three-decimal
   colours. **Not because nothing else pins them** - `tests/test_pdf_parity.py`
   traces `(type, color, fill, width, dashes, even_odd, items)` per drawing,
   colours to 3 dp (`:113-118`, built at `:136-140`), so cross-emitter colour
   agreement is already covered. This assertion pins the *overlay -> emitter*
   hand-off, which parity cannot see because both sides would read the same
   wrong overlay; asserts the `fields`+`geom` ->
   `spec`+`_geom` conversion, because `pdfcards.js` reads `spec._geom` and a
   built-in deck has no `spec`; asserts `sub` comes from `data/decks.json`; and
   runs the 96-of-96 `fields`/`roots` loop that forbids re-deriving `Fm9`.
2. **B2** implement `fromBuiltin` beside `fromGenerated` in `src/engine/pdfdeck.js`.
   It does not touch `fromGenerated`; the `geom.ext` throw stays exactly as it is.
3. **B3** `tools/pdf_build.js` gains `--builtin <deck-id>`, reading
   `data/decks.json` alone (the `print` key). **Branch on the flag BEFORE
   wiring the stdin listener** - today all the work happens inside
   `process.stdin.on("end")`, and a `--builtin` invocation with nothing piped in
   would hang the parity suite rather than fail it.
4. **B0** parameterize `tests/test_pdf_parity.py` over the three built-ins:
   `SEEDS` becomes seeds + built-ins, `_pair` gains a built-in branch shelling out
   to `--builtin`. Red until B3 lands - land it in the same PR.
5. **B5** `python3 tools/inline_engine.py`, commit what it writes.

**Acceptance (this is the gate):**
`node --test tests/pdf_builtin.test.js`;
`python3 -W error::ResourceWarning -m unittest tests.test_pdf_parity -v` green
**with a coverage floor B0 must add** (review C1): assert the parameterized set
contains all three built-in ids x both variants, so a parameterization that
silently dropped the built-ins fails instead of greening - the same reason
`test_the_sweep_actually_ran` exists. Green for all three decks and both variants - **fresh Python vs fresh JS, glyph for
glyph**; `python3 tools/validate.py` green (check 4 catches an unsynced region).
Expect sub-0.1pt coordinate drift and nothing else. **Any survivor is a bug in
`fromBuiltin`, not an acceptable delta.**

### W3 - one UX

The only lane that touches app code, and the one the owner will actually see.

1. **Failing e2e first.** Rewrite the six named tests in section 2 against the
   unified markup, and add: (i) every deck - built-in and generated - renders two
   `<button>`s and one paper `<select>` in `.prints`, and zero `<a>`; (ii) the
   paper choice survives a reload; (iii) a built-in deck's FULL DECK PDF tap
   produces bytes that open as a PDF (the shape of the existing
   `"the custom-deck CTA downloads a PDF a reader can open"` test, now run over a
   built-in). Run them; they fail.
2. Delete `const PRINT_PDFS` and collapse `headerHTML`'s `prints` ternary to one
   branch: two buttons plus the selector, for every deck. Update the `esc`
   comment at `index.html:5644`, which names the `PRINT_PDFS` hrefs.
3. `downloadDeckPDF` routes built-ins through `HPE.pdfdeck.fromBuiltin` and
   generated decks through `fromGenerated` - **one function, one decision, made
   from `isBuiltIn(deckId)`**, which already exists. **The overlay is already in
   the browser**: W1a put it in `data/decks.json`, so `tools/sync_decks.py`
   carried it into `const DECKS` and `fromBuiltin` reads it off the deck object
   beside `chords[].fields`. There is no new plumbing in this lane - review A1
   removed it.
4. Delivery per D-2(B): `window.open(url)`, falling back to `location.href` when
   it returns `null`; `<a download>` unchanged off iOS. Disable both buttons for
   the duration of the build (review D1): the emitter runs ~0.14 s for the
   52-card deck and produces a 1.06 MB blob, so a double tap builds two. Keep the 60-second
   `revokeObjectURL` timer and its comment - revoking in the same event-loop turn
   cancels the download with no diagnostic.
5. Persist `printPaper` per D-3: read it type-guarded from the `"hpfc"` object at
   boot, write it in `save()`'s read-modify-write, call `save()` from
   `setPrintPaper`.
6. Repair `tests/mutants/p_paper_picker_forgets_its_state.patch` against the new
   markup, and re-check `d_esc_attr_leaves_quote` and
   `p_print_cta_drops_the_platform`, with
   `for p in tests/mutants/*.patch; do git apply --check "$p" || echo "STALE $p"; done`
   on a clean tree as a fast pre-flight. **`--check` is not the acceptance**
   (review C2): it proves a patch applies, not that it still kills. A repaired
   patch can apply to the new markup and flip nothing the tests observe - a
   silent survivor. Run the three named patches through `tests/mutation_check.sh`
   itself and show all three killed.
7. Check the focus-order code that widens past `.prints a` for the custom path
   (it maps `["a","button","select"]`) - with no `<a>` left, the `a` selector is
   dead weight; leave or remove deliberately, and say which in the PR body.

**Acceptance:** `node --test tests/e2e.test.js` and `node --test tests/app.test.js`
green; `python3 tools/validate.py` green; full CI green at the head SHA. The
380px viewport requirement applies - the selector now renders on three more decks
and must not wrap the print row.
**CI cannot check D-2's iOS branch** - section 6.

### W3d - docs and queue

Runs alongside W3; owns no code.

1. `README.md`: the six PDFs are no longer what the app links. Correct any
   sentence that says otherwise.
2. File the queue rows in section 7.
3. Update the memory note `print-button-opens-existing-pdf` - it is true of
   nothing once W3 lands.

## 5. Review plan

**Merge gate, every lane, no exceptions.** Both must hold:

1. CI green at a head SHA **verified against the local tip**:
   `gh pr view <n> --json state,headRefOid` and confirm it equals the branch tip.
   A lane that failed auth on push still self-reports done. All five checks -
   data integrity, js suites, mutation gate, python suites, suite health - at
   that one SHA. A green run on any other commit is not evidence.
2. An **independent reviewer subagent** returning PASS or PASS_WITH_NITS at that
   same SHA. **A FAIL is never merge-able.** PASS_WITH_NITS merges; the nits
   become queue rows.

**Reviewer brief** carries: branch, base, the verified head SHA, the check names
that passed at it, the lane's acceptance criteria verbatim, the goal and
non-goals, the ownership row (so it can flag boundary violations `/review`
cannot see), and a mutant budget (5; 10 for W1b and W3, which ship test-only or
UI work that nothing else exercises).

**Reviewer discipline**, briefed verbatim:

- Prefix every Bash call with `OPENCLAW_SESSION=1`, or the skill detects an
  interactive host and returns a decision brief instead of a verdict - which
  arrives as a malformed result, not an error.
- `cd` first on every call; the shell cwd resets between calls.
- Check out **at the verified SHA on a real branch**:
  `git worktree add <path> --detach <sha>` then `git checkout -B review-<lane> <sha>`.
  Never by branch name - `/review` diffs HEAD against merge-base and a mid-review
  push silently moves what was reviewed.
- **Do NOT symlink `node_modules` into the review worktree.** It breaks
  `CanonicalSourceTest` and this repo needs none. This contradicts the global
  CLAUDE.md advice on purpose.
- Read-and-report only. Remove the worktree when done. Model: opus.

**What each reviewer must RE-DERIVE, not confirm.** The defect class that has
cost six FAILed review rounds across four PRs in this workstream is *numbers
written about a file rather than measured from it* - line numbers, counts,
arithmetic, provenance claims. Twice, the fix to a miscount introduced the next
one in the same cell. Queue row 330: a doc note citing line numbers in its own
file invalidates them by being inserted. So:

| Lane | Re-derive |
|---|---|
| W0 | that the reference really comes from `HEAD` and not the tree - construct the vacuous case and watch it fail |
| W1a | every literal in the new `print` key of `data/decks.json`, byte for byte against `tools/decks.py` at the base commit, colours to three decimals; and that `const DECKS` was regenerated by the tool, not hand-edited (`python3 tools/sync_decks.py --check`) |
| W1b | that each new assertion fails against a wrong value; a green assertion that cannot go red is not a test |
| W2 | the parity run actually covered three decks x two variants (not a silently-empty parameterization - the file already holds a `test_the_sweep_actually_ran` floor for exactly this), and that `--builtin` does not hang without stdin |
| W3 | the `.prints` markup in the rendered DOM for all four faces and both deck kinds; the persistence round-trip; that no engine region was hand-edited (`python3 tools/inline_engine.py --check`); that every mutant patch still applies |
| W3d | every count and line number in the prose, and every queue row body against the file it cites |

**Bounce policy:** findings go back to the **authoring** lane (context intact).
Re-review uses a **fresh** reviewer - one that already said FAIL is anchored.
**Cap: two attempts per lane**, one counter covering every retry path (review
FAILs, `pr_url` verification failures, rebase re-reviews, null returns). On
exhaustion, take the lane over or escalate. Do not loop.

**Known CI behaviour, so a reviewer does not misread it:**
- The mutation gate can flake - a lone survivor on an unrelated diff. Rerun the
  failed job **at the same SHA** before believing it. `e_swipe_deadzone_dropped`
  is a known flapper (row 325).
- A conflicting PR blocks CI entirely; no run is even queued. Check
  `gh pr view <n> --json mergeable` before suspecting Actions.
- `mutation_check.sh` restores the tree. Never edit a worktree while it runs.
- Mutant `@@` hunk headers are not line references; 314 of 383 are stale
  (row 326). Grep the removed line.
- Poll with `until ! gh pr checks <n> | grep -qE 'pending|IN_PROGRESS|QUEUED'; do sleep 50; done`
  in the background. A bare `sleep N; cmd` chain is blocked by the harness.

## 6. Owner device-pass checklist (CI cannot check any of these)

Run once, on the iPhone 14 / iOS 26.6, after W3 merges. One sitting, six taps.

1. Built-in deck (Hijaz), FULL DECK PDF: does it open in a **new tab** (D-2 B) or
   replace the app (fallback fired)? Which?
2. Same deck, PRINT-ONLY PDF: same question.
3. Generated deck: same two taps, same question. **The answer must match 1 and 2**
   - that is the whole point of the plan.
4. Set paper to A4, reload the page: is A4 still selected?
5. Built-in deck with A4 selected: is the produced PDF actually A4 (the Share
   sheet shows the page size, or open it in Files)?
6. At 380px, does the print row - two buttons plus the selector - fit on one line
   on every deck?

Record the answers in `docs/plans/scale-engine-coordination.md` and, if 1-3
disagree, treat it as a W3 bug and not a new decision.

## 7. Queue rows to file

- **The app no longer links the committed PDFs.** `PRINT_PDFS` is gone; the six
  files remain as print-shop artifacts and as the staleness gate's reference
  (D-1). Anyone looking for the app's PDF source should read `downloadDeckPDF`.
- **D-2's iOS branch is unverified until the device pass runs.** The
  `window.open` -> `location.href` fallback makes both outcomes correct, but only
  the device says which fires.
- **`openPrintSheet` and `PRINT_LAYOUTS` are still unreferenced** and still
  waiting on row 223's device gate. This plan did not remove them and did not
  test them.
- **Memory `print-button-opens-existing-pdf` is retired**, superseded by the
  unified emitter path.
- Whatever nits the six reviews return.

## 8. Assumptions not verified

- ~~That the print overlay can be inlined into `index.html` by a sync step.~~
  **Removed by review A1.** The overlay lives in `data/decks.json`, so it rides
  `tools/sync_decks.py` and `validate.py` check 1, both of which already exist
  and are already tested. There is no unprototyped mechanism left in the plan.
- That `window.open` with a blob URL is not popup-blocked inside a click handler
  on iOS Chrome. The fallback covers the failure; the frequency is unknown.
- ~~That rewriting six e2e tests does not disturb `tests/suite_health.py`'s
  per-file floors.~~ **Resolved by reading the file.** The rows are MINIMUMS,
  checked with `if ran < floor` (`tests/suite_health.py:149`; the module
  docstring says so at `:16`). W3 step 1 is a net ADD of three e2e tests, which
  no floor can fail. The row `"tests/e2e.test.js": 105` should still be RAISED to
  the new count so the added tests are themselves protected - that is a lane
  obligation, not a risk. Only a net DELETE could redden it.

## 9. Engineering review (2026-09-24, /plan-eng-review)

Reviewed against `1185886`. Every figure below was re-derived from the file it
names during this review, not carried over from the plan body.

### 9.1 Verdict

**APPROVE WITH CHANGES.** The chain is honestly shaped, the two oracles are
correctly separated, and the lane table has no ownership collision. Three
factual errors were found and corrected in place (9.6). One architectural
simplification removes the plan's own self-declared riskiest item (9.2 A1).
Two acceptance criteria are claims rather than commands and must become
commands before W2 and W3 spawn (9.4 C1, C2).

### 9.2 Architecture

**A1 [HIGH] (confidence: 9/10) `docs/plans/2026-09-24-one-pdf-path.md` §4 W3
step 3 - the new sync plumbing is avoidable; put the overlay in
`data/decks.json`.**

The plan calls W3 step 3 "the one genuinely new piece of plumbing" and "the
riskiest item in this plan", and §8's first assumption is that it can be done
at all. It can be deleted outright. Instead of `data/print_overlay.json` plus a
new sync step plus a new `validate.py` drift check, add a per-deck `print` key
to `data/decks.json`. Then:

- `tools/sync_decks.py:49` is `want = json.dumps(canonical())` - the whole
  `const DECKS` line is a `json.dumps` of the canonical file, so new keys ride
  the existing sync step with no code change.
- `tools/validate.py:41-46` check 1 already asserts the two sides are equal, so
  the new data gets the existing drift gate for free. No second check to write.
- `tools/decks.py` reads `deck["print"]` where it now reads keyword literals;
  `_from_canonical`'s clash guard and the chord-count substitution are
  unaffected.
- `fromBuiltin` reads it out of `DECKS` in the browser, the same place it reads
  `chords[].fields`. No new delivery mechanism exists to get wrong.

Size check: the DECKS line is 12,273 chars today, from a 26,343-byte
`data/decks.json`; the overlay literals at `tools/decks.py:261-303` are roughly
1.6 KB of text across three decks. Proportionate.

The objection is CLAUDE.md's description of `decks.py` as carrying "only the
PRINT OVERLAY ... as literals". That separation was written when nothing but
print needed those values. D-0(a) is exactly the condition that dissolves it:
under (a) the **app** needs them, so they are no longer print-only data and the
canonical file is where they belong. CLAUDE.md's repo-layout paragraph should be
amended in the same PR (W1a owns it).

Effect: W1a loses its new-file creation and its `validate.py` extension; W3
loses step 3 entirely; §8 loses its first assumption. Net -1 file, -1 check,
-1 unprototyped mechanism.

**A2 [MEDIUM] (confidence: 8/10) §3 lane table - W1a ∥ W1b is safe only under a
constraint the plan does not state.**

The table gives W1a `tools/decks.py` and W1b `tests/test_print.py`, disjoint.
But W1b's *subject* is the data W1a moves. If W1b asserts against the module
source (grep for `R=73.0`), W1a breaks it mid-wave; if W1b asserts through the
built deck objects (`decks.HIJAZ.R == 73.0`), both orderings work. Add one
sentence to W1b: **assertions read the constructed deck objects, never the
module source.** Verified values, re-derived from `tools/decks.py:261-303`:
hijaz and amara `R=73.0, cy=126.0, y_note=30.0, y_num=14.0`; pygmy
`R=60.0, cy=121.0, y_note=30.0, y_num=14.0`. The plan's figures are correct.

**A3 [LOW] (confidence: 7/10) D-1 should state the new contract for the six
PDFs, not just their fate.** "Keep, ship, stop linking" reads as inert. After
W0 they are the staleness reference read from `HEAD`, which means any deck-data
change now *requires* a rebuild-and-commit of all six to green the suite. That
is a workflow obligation the plan should name where D-1 is decided, not leave
implicit in W0.

### 9.3 Code quality

**B1 [HIGH] (confidence: 10/10) §4 W2 B1 - the stated reason for asserting
colours was stale. CORRECTED IN PLACE.** The plan said "the parity oracle
compares `(x, y, size, char)` and cannot see a colour at all". It can:
`tests/test_pdf_parity.py:113-118` documents the drawing trace as
`(type, color, fill, width, dashes, even_odd, items)`, "colours to 3 dp", and
`:136-140` builds that tuple. The assertion is still worth writing - it pins the
overlay-to-emitter hand-off, which parity cannot see because both sides would
read the same wrong overlay - but the old rationale would have been filed by a
reviewer as the plan's own named defect class.

**B2 [MEDIUM] (confidence: 9/10) §8 bullet 3 - floors are minimums.
CORRECTED IN PLACE.** `tests/suite_health.py:149` is `if ran < floor`, and the
module docstring says so at `:16`. A net ADD cannot break a floor; only a net
DELETE can. W3 step 1 adds three tests, so the obligation is to RAISE
`"tests/e2e.test.js": 105`, not to "check before pushing".

**B3 [LOW] (confidence: 10/10) §1 D-2 cited `index.html:6175`. CORRECTED IN
PLACE to `:6176`** (`grep -n 'window.location.href = url' index.html` -> 6176).
Off by one, and the same defect class the plan is written to defend against.

**B4 [LOW] (confidence: 9/10)** Three anchors spot-checked and CORRECT as
written: `index.html:6291` is the `["a","button","select"]` focus-order map that
W3 step 7 discusses; `tests/test_print.py:876` opens `TitleBlurbChordCountTest`;
`tools/decks.py:261-303` holds the three overlay literal blocks including the
three-decimal colours (`Color(0.878, 0.333, 0.604)` and siblings - the plan's
warning against re-deriving them from `#E0559A` is right).

### 9.4 Tests

**C1 [HIGH] (confidence: 9/10) §4 W2 acceptance - "any survivor is a bug" has no
floor behind it.** The plan's own re-derive table asks the reviewer to confirm
"the parity run actually covered three decks x two variants (not a
silently-empty parameterization)", and notes the file already holds a
`test_the_sweep_actually_ran` floor for exactly this. But the acceptance section
lists only `python3 -W error::ResourceWarning -m unittest tests.test_pdf_parity -v`,
which greens on a `SEEDS`-only run. Promote the reviewer's check into the lane's
own acceptance: B0 must add an assertion that the parameterized set contains the
three built-in ids x both variants, so a parameterization that silently dropped
the built-ins fails rather than passes.

**C2 [MEDIUM] (confidence: 9/10) §4 W3 step 6 - `git apply --check` proves
applicability, not lethality.** `tests/mutation_check.sh:220-221` counts a
non-applying patch as a survivor, so `--check` clears only the applicability
half of the gate. A repaired `p_paper_picker_forgets_its_state` can apply
cleanly to the new markup and no longer flip anything the tests observe - a
silent survivor that the all-or-nothing gate will report at the worst moment.
W3's acceptance must run the three named patches through the real gate, not
`--check`. `--check` stays as the fast pre-flight.

**C3 [MEDIUM] (confidence: 7/10) §4 W1b acceptance - "paste both outputs in the
PR body" is a claim about a file, not a checked artifact.** This repo's defect
class is precisely that, and the repo already owns the right mechanism: a mutant
per pinned constant group is how "a green assertion that cannot go red" gets
caught by CI rather than by a reviewer reading prose. W1b should ship one mutant
that moves a pinned geometry value and one that damages a `credit` string.
Counterweight, stated honestly: that widens W1b's blast radius into
`tests/mutants/`, which W3 also touches - they touch different patch files, so
the ownership line holds, but the plan must say so in the lane table.

**C4 [LOW] (confidence: 8/10)** W3's acceptance does not verify that the PDF the
*browser* produces for a built-in equals the one the Node parity suite proved.
That is acceptable and needs no new test: the browser runs the same bytes via
the `engine:pdfdeck` region, and `tools/validate.py` check 4 fails if that region
drifts from `src/engine/pdfdeck.js`. Worth one sentence in W3 so a reviewer does
not file it as a gap.

### 9.5 Performance

**D1 [LOW] (confidence: 9/10, measured during this review) - no blocker, and the
plan is right not to budget for one.** Built-in taps move from a static `href`
to a synchronous main-thread emitter run, which is a real change in kind. Timed
on the Pygmy-shaped seed (`(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 F5 G5 | C3 Db3
Eb3 Bb3 Db4 Ab5`, 52 chords - the largest deck):

```
node tools/gen_deck.js "<seed>" > /tmp/pyg.json
node tools/pdf_build.js --out /tmp/out.pdf < /tmp/pyg.json
-> real 0.14 / 0.15 / 0.14 s (three runs), 1,061,493-byte PDF
```

That total includes Node process startup, so the emitter itself is well under
it. Even a 3-5x mobile penalty stays under ~0.5 s. No spinner is warranted. One
guard is: the two buttons must not be able to double-fire during the run, since
a second tap would build a second megabyte-scale blob. Add it to W3 step 4.

### 9.6 Corrections applied to this document

| Where | Was | Now |
|---|---|---|
| §1 D-2 | `index.html:6175` | `index.html:6176` |
| §4 W2 B1 | "the parity oracle ... cannot see a colour at all" | corrected; cites `tests/test_pdf_parity.py:113-118`/`:136-140` |
| §8 bullet 3 | "a net add or delete does" disturb the floors | corrected; floors are minimums (`tests/suite_health.py:149`) |

### 9.7 Changes required before the lanes spawn

1. Adopt A1: drop `data/print_overlay.json`, add a `print` key to
   `data/decks.json`, delete W3 step 3, delete §8's first assumption, amend
   CLAUDE.md's repo-layout paragraph in W1a.
2. A2: add "W1b asserts through the constructed deck objects, never the module
   source" to the W1b task list.
3. C1: add the built-in-coverage floor to W2's acceptance command list.
4. C2: replace W3 step 6's `--check`-only acceptance with a real mutation-gate
   run over the three named patches.
5. C3: add the two W1b mutants and the `tests/mutants/` ownership note.
6. D1: add the double-fire guard to W3 step 4.

Nothing here changes D-0, D-1, D-2 or D-3, the wave order, or the review plan.

**All six were applied to sections 2, 3, 4 and 8 on 2026-09-24, before any
lane spawned.** The lane table, the W1a/W1b/W2/W3 task lists and the §8
assumption list above are the amended text, not the reviewed text.

### 9.8 Auto-decisions taken under the standing AFK authorization

| # | Decision point | Taken | Rationale |
|---|---|---|---|
| 1 | Prerequisite `/office-hours` offer | **Skip** | The plan already consumes an owner-answered design doc: `docs/plans/2026-09-22-seed-pdf-one-source.md`, Q1-Q5 answered 2026-09-23 by direct owner instruction. |
| 2 | Complexity gate (15 files touched) | **Keep the original arrangement** | §3 already argues the chain cannot be widened (`index.html` is one file) and explicitly forbids padding the lane count. A1 *narrows* it by one file and one mechanism, which is the only move available in the right direction. |
| 3 | Outside Voice | **Native fallback, folded into the sections above** | `codex` preflight not reached in a usable state this session; the second pass was run as an independent re-derivation of every anchor the plan cites, which is what the missing coverage would have bought. Recorded here rather than claimed as clean. |

### 9.9 Learning correction (supersedes a 10/10 prior learning)

`pdf-parity-oracle-blind-to-fill-rule` (recorded 2026-09-23) is **STALE and must
be retired.** Commit `8b7fea0 "Align the JS fill rule with reportlab and watch it
with two mutants"` fixed it. `src/engine/pdfcards.js:51-60` now returns `B*`/`f*`
under a comment naming `tests/mutants/n_pdfcards_fill_only.patch` and
`o_pdfcards_stroke_fill.patch` as the guards, and `even_odd` is in the parity
trace at `tests/test_pdf_parity.py:140`, documented at `:119-122` with the
297-paths-per-Amara history. The learning's remedy ("align the fill rule first,
or normalise `even_odd` out") was taken. W2 carries no residual risk from it.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| Architecture | always | lane shape, ownership, new mechanisms | 1 | run | A1 HIGH, A2 MEDIUM, A3 LOW |
| Code quality | always | the repo's named defect class | 1 | run | B1 HIGH, B2 MEDIUM, B3 LOW, B4 LOW |
| Tests | always | acceptance criteria vs commands | 1 | run | C1 HIGH, C2 MEDIUM, C3 MEDIUM, C4 LOW |
| Performance | always | built-in taps become a runtime build | 1 | run | D1 LOW (measured, no blocker) |
| Outside Voice | default-on | independent re-derivation | 1 | native fallback | folded into 9.2-9.5; recorded in 9.8 |

**VERDICT: APPROVE WITH CHANGES** - six changes listed in 9.7; none touches an
owner decision, the wave order, or the merge gates.

NO UNRESOLVED DECISIONS
