# Remaining work - /swarm coordination doc

**Goal:** land every outstanding item on the handpan-cards backlog - tooling
nits, the print button, the border restyle, the Pygmy blurb, the mobile audit,
and engine adoption - without app and print ever diverging and without a deck's
printed CONTENT changing except where an owner decision says it must.

**Not bytes - content.** ReportLab stamps a creation date, so every rebuild
rewrites all six PDFs even when nothing changed (`CLAUDE.md:317-320`), and the
staleness test compares extracted TEXT, not bytes. A reviewer policing PDF byte
identity would fail every honest lane. Police text and visual semantics.

**Non-goals:**
- No new features beyond the six items below. No refactors of passing code.
- No change to the diagram geometry, the label size rule, or the chord-selection
  ranking. The ranking order was confirmed correct by the owner on 2026-09-16.
- No build step. `index.html` stays a single self-contained file with no
  `<script src>`, and every generated region stays committed.
- No change to the six PDFs' CONTENT outside the one lane that owns them
  (byte churn from a rebuild is expected and is not a finding).

**Base:** `main` @ `28117a8` (PR #70, single-source deck data, merged).

**Merge gate:** a green CI at a lane's head SHA is necessary but not sufficient
here. Two lanes can edit disjoint regions of `index.html`, conflict-free, and
produce a merged file neither CI run ever tested. So: **main's own CI must be
green before the next lane merges.** Serialized merges plus a green main between
them is the cheap form of a merge queue, and this plan already serializes.

---

## Hard rules

1. The main agent is the sole writer of this doc. Lanes return structured
   reports and never edit it.
2. Every lane PR passes `/review` by a non-author reviewer before merge, at the
   **verified head SHA**, with CI's conclusion read at that same SHA. Verdicts
   are recorded in the Review log.
3. **Worktree isolation is mandatory.** Every lane works in its own
   `git worktree`. The live checkout at `/Users/ray/Projects/handpan-cards`
   stays live and is never a lane's workspace.
4. TDD. Tests first, then implementation. A local green is a smoke test; CI at
   the final pushed commit is the evidence.
5. Deck data changes go through `data/decks.json` + `tools/sync_decks.py` +
   `tools/decks.py`, then `tools/regen_data_mutants.py` on a clean tree.
6. Merges are serialized by the integrator, one at a time.

---

## The index.html bottleneck (read before assigning any lane)

This is the real contention point, and it is sharper than the PDF one the owner
already serialized away.

`index.html` is 4624 lines and is the whole app. Four of the six items want to
edit it:

| Item | Region of index.html | Conflict class |
|---|---|---|
| Border restyle | `.face::before` CSS @ :310 | narrow, one rule |
| Print button | deck-header markup + its CSS | narrow, new block |
| Mobile audit/fix | CSS across the file, unknown span | **broad** |
| Engine adoption | the `const DECKS` line only | **none - generated** |

Two observations decide the lane shape:

- **Engine adoption is now conflict-free on `index.html`.** That line is a
  GENERATED copy of `data/decks.json`. CLAUDE.md's rule is explicit: resolve a
  conflict inside it by taking either side and re-running
  `python3 tools/sync_decks.py`. This is exactly the payoff PR #70 was built
  for, and it means the biggest lane is no longer the riskiest one to schedule.
- **The mobile lane is the dangerous one**, not because it is hard but because
  its edit span is unknown in advance. A lane that may touch CSS anywhere in the
  file cannot run concurrently with two lanes making narrow CSS edits without
  generating rebase work that costs more than the parallelism buys.

**Resolution:** the mobile lane splits across two cycles. Cycle 1 it audits
(read-only) and fixes ONLY the one confirmed defect in its own narrow region.
Cycle 2, after the narrow-edit lanes have merged, it applies the rest of its
findings against a settled file. This honours the owner's "audit and fix"
decision without pretending the collision is not there.

---

## Owner decisions binding this plan

Taken 2026-09-16. Lanes apply these; they do not revisit them.

| # | Decision |
|---|---|
| D1 | Nit 1 fixed now: `sync_decks.py` post-write guard compares BYTES (`again.group(1) == want`), not re-parsed JSON. |
| D2 | Nit 2 paired with D1: a write-mode test, TDD, plus the killing mutant (write mode emitting `sort_keys=True`). |
| D3 | `validate.py` check-1 double-print: NOT fixed. Backlog row only. |
| D4 | Nit 4 fixed: `encoding='utf-8'` on `regen_data_mutants.py`'s `index.html` open/write. |
| D5 | Pygmy blurb: DERIVE the chord count from the deck, do not correct the literal 25 to 27. |
| D6 | All PDF-text-changing work is serialized into ONE lane. No two branches ever hold the six PDFs. |
| D7 | Engine adoption runs as a FULL lane under AFK auth. The lane makes the musical calls itself. |
| D8 | Border: the deck's ROOT colour on all four sides; print `bw` 2.2 -> 2.8 pt, app `padding` 2.5 -> 3.2 px (+27%). **Keep the plumbing, change only the draw** - `duo_frame`'s `gb` param, `--gb`, `grad=` and `colors.gb` all stay. |
| D9 | Print button: BOTH variants offered as two links (`Cards` and `PRINTER_ONLY`), in the deck header. |
| D10 | Pygmy cap binds at 31 **NAMES**, which is 52 cards. Amended at eng-review 2026-09-16, see the amendment note below. |
| D11 | Amara ships 25, FULLY RE-RANKED. |
| D12 | Mobile lane audits and fixes, but treats the visual system (fonts, palettes, card anatomy) as frozen. |
| D13 | Four concurrent lanes. |

### D11 supersedes an earlier instruction - stated plainly

The owner previously said, verbatim: *"The commercial reference should be
accurate. Let's not make an exception but find a design that would adhere to the
commercial Amara deck and still take generalization ask into account."*

D11 chooses full re-ranking, which means **the Amara card ORDER will no longer
match the commercial reference deck.** The card CONTENT of the original 16 is
unchanged - the conventions measured from that deck (pitch-class-complete
highlighting, spelling-order bottom lines, the three forced cards) all still
hold and are still asserted by tests. What changes is sequence and deck size.

This was put to the owner with that exact trade-off named in the option text and
chosen anyway. It is therefore the binding decision, and CLAUDE.md's provenance
notes get an amendment saying so rather than being quietly left to contradict it.

### D10 amended at eng-review - the cap counts NAMES, not cards

D10 was drafted as "the top 31 by ranking" on the assumption that 31 was a card
count. It is not. `src/engine/select.js:439` `trimToNames()` caps DISTINCT CHORD
NAMES; root-instance multi-voicing then expands the surviving names into cards.
Measured against the live engine from the golden maker strings:

| | names | cards | multi-voiced names |
|---|---|---|---|
| Pygmy today (hand-authored) | 21 | 27 | 2 (Cm7, Eb7 x2) |
| Name-cap 31 (engine as-is) | **31** | **52** | 15 (12 names x2, 3 names x3) |
| Card-cap 31 (hypothetical) | 18 | 31 | 9 |

Card-capping was rejected: it costs 13 chord names and deletes EVERY 7th chord on
the pan except `Abmaj7sus4` (`Fm7, Fm9, Gm7b5, Abmaj7, Bbm7, Cm7, Dbmaj7, Eb7,
Fsus4, Absus4, Bbsus4, Ebsus4, Eb7sus4`), a regression against the 27-card deck
shipping today, while still spending three cards each on `Ab` and `Ab5`. That is
the exact failure `select.js:441` documents: a chord's own alternates evicting a
different chord from the tail. It would also reverse engine decision D1
(2026-09-16), which states the cap "bounds how many CHORDS a player has to learn,
not how many cards the deck prints".

**Owner decision at eng-review: Pygmy ships 31 names / 52 cards.** The 21 extra
cards are alternate registers of names already in the deck; nothing is learned
twice. Pygmy's printed deck goes from ~4 to ~7 US-Letter sheets.

Verified alongside: all 15 multi-voiced names light an IDENTICAL field set across
their registers (0 mismatches), so pitch-class-complete highlighting holds for
the generated alternates exactly as it does for today's Cm7/Eb7 pair.

---

## Lanes

### Cycle 1 - four concurrent

#### W1 - tooling nits (D1, D2, D4)

**Owns:** `tools/sync_decks.py`, `tools/regen_data_mutants.py`,
`tests/test_deck_data.py` (the `CanonicalSourceTest` group only),
`tests/mutants/` (one new patch).
**Never touches:** `index.html`, `data/decks.json`, `tools/decks.py`, any PDF.

The defining property of this lane: **it is byte-neutral.** `git diff main --
index.html data/decks.json '*.pdf'` must be empty at its head. That is what lets
its reviewer use "nothing generated moved" as a signal.

Steps:
1. Write the failing test for write mode first. It must fail against today's
   semantic comparison and pass against a byte comparison. The reviewer already
   produced the discriminating case: make write mode emit
   `json.dumps(..., sort_keys=True)`; today that prints success and exit 0, and
   the very next `--check` fails.
2. Fix `tools/sync_decks.py:70` to compare `again.group(1) == want`.
3. Add the killing mutant for the new test to `tests/mutants/`; patch count goes
   267 -> 268.
4. Add `encoding="utf-8"` to `regen_data_mutants.py`'s `index.html` reads and
   writes. `index.html` contains non-ASCII; this is latent, not a live bug.
5. Full python suite, `node --test`, `tools/validate.py`, `tests/mutation_check.sh`.

**Acceptance:** `git diff main -- index.html data/decks.json '*.pdf'` empty;
mutation gate green with zero survivors at **exactly one more patch than main**
(a DELTA, not the absolute 268 - W2 and W5 also own `tests/mutants/` and
regenerate the 11 `b_*` set, so an absolute count is owned by three lanes); the
new mutant is killed by the TARGETED suite named in its own `# suite:` header,
and that header names an individual test (`-k <test>`), not a whole file. Not
"killed by nothing else" - `tests/mutation_check.sh:138` runs only the header's
command, so the harness cannot prove a negative and an acceptance criterion that
asks it to is unmeetable.

#### W2 - print output (D5, D6, D8-print-half)

**Owns:** `tools/hifi.py`, `tools/decks.py`, all six `*.pdf`,
`tests/test_print.py`.
**Does NOT own `tests/mutants/`, and must not regenerate them.** Every generated
`b_*.patch` targets `data/decks.json` and the `index.html` DECKS line - verified,
all 12 - and this lane touches neither. `regen_data_mutants.py` exists for deck
DATA changes. W2's only mutant exposure is the 8 hand-written `c_*` patches
anchored on `tools/hifi.py` and `tools/decks.py`, which it verifies with
`git apply --check` (step 5) and never regenerates. That leaves `tests/mutants/`
owned by W1 and W5 alone.
**Also owns, by necessity:** the `.face::before` rule in `index.html`
(see below).
**Never touches:** `data/decks.json` content, `src/engine/*`, the deck-header
markup.

This is the serialized PDF lane from D6. It does two things in sequence on one
branch:

1. **Pygmy blurb (D5).** Replace the `25 CHORDS` literal at `tools/decks.py:276`
   with a count derived from the deck. Hijaz (18) and Amara (16) currently match
   their literals, so deriving must leave their blurbs byte-identical and change
   only Pygmy's - that asymmetry is the test.
2. **Border restyle (D8).** `duo_frame` at `tools/hifi.py:176` stops being a
   two-tone split and draws the root colour on all four sides at `bw=2.8`; the
   app's `.face::before` at `index.html:310-313` drops the two-stop gradient for
   a flat `var(--ga)` and goes `padding: 2.5px -> 3.2px`.
3. **Add the missing border agreement assertion** to
   `tests/test_render_agreement.py`, TDD, BEFORE step 2 - it must fail against
   today's split border and pass against the flat one. Assert the same drawn
   frame in both renderers: colour source (root, not tone) and relative weight.
   Without this the restyle is unpinned in both outputs.
4. **Amend the docs D8 contradicts.** `CLAUDE.md:167`, `README.md:20` and
   `README.md:116` all describe the border as a TWO-TONE SPLIT, and
   `CLAUDE.md`'s reads "deliberately NOT a gradient". All three are ground-truth
   lines in this repo; leaving them is how the next lane re-litigates a settled
   decision.
5. **`git apply --check` the 8 hand-written `c_*` mutants** before pushing. This
   lane edits `tools/decks.py:276`, and `regen_data_mutants.py --check`
   iterates only the generated `b_*` set - it is blind to the `c_*` patches that
   anchor on `decks.py`. `mutation_check.sh` does catch them, but at CI, after
   the push.

**Why the app's border CSS lives in this lane and not W3.** The border is one
change with two renderers, and **this lane has to create the test that pins
them together.** Correcting an earlier draft of this plan: `tests/
test_render_agreement.py` does NOT pin the border today - it pins label sizes
per field, and greps clean for `border|duo_frame|face::before|padding|bw|ga|gb`.
Nothing in either suite asserts that print and app draw the same frame. So D8
would ship a restyle unpinned in both renderers unless W2 ADDS that assertion,
which is step 3 below. Once it exists, the test spans both files by
construction and cannot be split across separately-merging lanes. W2 therefore
owns the single CSS rule at `index.html:310` - narrow, textually distant from
W3's header block and W4's fixes.

**Keep the plumbing, change only the draw (D8).** `duo_frame`'s `gb` parameter
(`tools/hifi.py:176`, callers `:454` and `:530`), the `--gb` token
(`index.html:22,311,3829`), `grad=` in every `tools/decks.py` deck dict and
`colors.gb` in `data/decks.json` all STAY. Removing them reaches into W5's file
for no benefit. No lane tidies across that boundary.

Then: rebuild all six PDFs and confirm the staleness gate is green in the same
commit. Do NOT run `regen_data_mutants.py` - see the ownership note above.

**Acceptance:** Hijaz and Amara blurbs byte-identical; Pygmy's reads 27; all six
PDFs rebuilt in the same commit as the code that changes them; the NEW border
agreement assertion exists, fails on the old border and passes on the new;
`tests/test_render_agreement.py` green; all 8 `c_*` patches still apply;
`CLAUDE.md:167`, `README.md:20` and `README.md:116` amended.

#### W3 - print button (D9)

**Owns:** the deck-header markup and its CSS in `index.html`; a new e2e test.
**Never touches:** `.face::before`, `tools/*`, any PDF, `data/decks.json`.

Two links in the deck header, opening the committed PDFs as-is:
`<deck>_Cards_Letter.pdf` and `<deck>_PRINTER_ONLY_Chords_Letter.pdf`. No PDF
generation, no client-side PDF library, no server.

Traps this lane must not fall into:
- The PDFs are served by GitHub Pages from the repo root. With a custom domain
  the site serves at the domain ROOT, without one it serves under `/<repo>/`.
  A root-absolute `/Foo.pdf` breaks on the no-custom-domain case. Use a
  RELATIVE href.
- The filenames contain no spaces today (`CSharp_Hijaz_Orion_9_Cards_Letter.pdf`)
  but they are data-adjacent. **Do NOT string-build from the deck name, and do
  NOT add a field to `data/decks.json`** - that file's deck keys are exactly
  `id, name, sub, colors, degrees, geom, fields, chords`, it is W5's file, and
  W5 REGENERATES it, so a new field would be silently dropped next cycle. Use a
  literal `deckId -> basename` map in `index.html`'s non-generated app JS, which
  this lane owns outright. Three decks, two entries each.
- At 380px the header is already tight. Two links must not push the deck name
  onto a second line - test at 380px, per CLAUDE.md.
- `index.html` must still open from `file://`. A relative href does; verify it.

**Acceptance:** both links resolve to the committed files from a local
`python3 -m http.server`; header intact at 380px; no `<script src>` added;
`git diff main -- data/decks.json` empty.

#### W4 - mobile audit, pass 1 (D12)

**Owns:** a findings document under `docs/`, plus the narrow region of the
iOS keyboard defect.
**Never touches:** `.face::before`, the deck header, `tools/*`, any PDF.

Cycle 1 scope is deliberately narrow, per the bottleneck analysis above:
1. Walk the iPhone 14 / iOS 26.6 checklist at 380px. Record findings with repro
   steps. **Read-only** on the app. The lane ENUMERATES the checklist itself as
   its first deliverable and puts it in the findings doc - an earlier draft said
   "the 18-item checklist" as though one existed; no such list is written down
   anywhere in this repo or this plan, and a spawned lane sees only its prompt.
   Cover at minimum: deck chips, mode bar, card tap/flip, the ADD dialog, the
   scale sheet, GENERATE CARDS with the keyboard up, safe-area insets, landscape,
   and the print links W3 adds (if merged first).
2. Fix ONLY the confirmed keyboard-covers-GENERATE-CARDS defect.

Everything else found becomes a queue row for cycle 2.

**This lane's fix is NOT CI-verifiable, and the plan says so rather than
pretending.** `TODOS.md` records it verbatim: *"headless Chromium cannot
reproduce the condition at all (the e2e suite's shrunken viewports are a
documented PROXY for a keyboard, not the thing), so it needs a device check."*
Hard rule 4 makes CI the evidence for every other lane; here it cannot be. Split
it honestly:
- **CI-verifiable:** unit tests over the `visualViewport` offset math (given a
  viewport height and offsetTop, assert the computed translate), plus the
  existing e2e suite staying green at its proxy viewports. These gate the PR.
- **Device-only:** that the button is actually reachable with the keyboard up on
  an iPhone 14 / iOS 26.6. **The PR waits on an owner device check before merge.**
  This is the one lane in this plan that is not merge-authorized by CI alone.

**Acceptance:** findings doc enumerates the checklist and gives every item a
verdict; the offset math has unit tests; e2e green; no CSS touched outside that
defect's region; PR explicitly flagged DEVICE-CHECK-PENDING and not merged until
the owner confirms on hardware.

### Cycle 2 - after W2 merges

#### W5 - engine adoption (D7, D10, D11)

**Owns:** `data/decks.json`, the generated `DECKS` line via `sync_decks.py`, all
six PDFs, `tests/fixtures/divergence_v1.json`, `tests/mutants/` (rebased onto
merged W1 first).
**Also owns:** `CLAUDE.md` (the D11 provenance amendment and the deck-size line
in "What this project is" are W5 steps 7; without CLAUDE.md in its ownership the
edit is easy to drop). W2 owns the SEPARATE border lines at `CLAUDE.md:167` -
different sections, no textual overlap, but W2 merges first so W5 rebases.
**Preserves:** W3's `deckId -> PDF basename` map in the app JS - regenerating
`data/decks.json` must not disturb it, and W3 deliberately kept it out of that
file so it cannot.
**Never touches:** `src/engine/*` (the engine is correct; this lane adopts its
output, it does not change it), `tools/hifi.py`, the app's non-generated regions.

Runs after W2 because it rebuilds the same six PDFs (D6).

1. Run `tools/gen_deck.js` per seed. Produce the full divergence table against
   today's decks - the evidence, before any adoption.
2. Apply D10 as amended: Pygmy takes the top 31 **NAMES** by the existing
   ranking (`src/engine/select.js:439` `trimToNames`), which the engine expands
   into **52 cards**. The cut must be reproducible by re-running the ranking,
   not hand-curated. Do not attempt to reach 31 cards - see the D10 amendment
   note above for why card-capping was rejected.
3. Apply D11: Amara ships 25, fully re-ranked.
4. Hijaz 18 -> 19, including the `Bm - HIGH VOICING` deletion decision.
5. Resolve the Fm9 spread-9th / Fm11 / Abmaj9 / Dmaj7 / Dmaj7#11 overrides
   against the documented voicing rules in CLAUDE.md. Every call gets a one-line
   rationale citing the rule it follows.
6. Write `data/decks.json`, run `sync_decks.py`, run `decks.py`, regen mutants.
7. Amend CLAUDE.md's Amara provenance note per the D11 supersession above, and
   the deck-size line in "What this project is".

**Acceptance:** hijaz 19 names / 19 cards, pygmy **31 names / 52 cards**, amara
25 names / 25 cards - stated as both counts, because the cap is on names and an
acceptance criterion that says only "31" is how this plan got it wrong the first
time; `validate.py` checks 1/1b/2/3/4 green with the new total; the Pygmy 31 is
reproducible by re-running the ranking; every multi-voiced name lights an
identical field set across its registers; every override carries a rationale
citing a CLAUDE.md rule. This lane REBASES ONTO MERGED W1 before regenerating
`tests/mutants/`.

#### W6 - mobile audit, pass 2

Applies the cycle-1 findings against a settled `index.html`. Briefed from the
queue rows W4 filed.

---

## Ownership

| Lane | Owns | Worktree | Branch |
|---|---|---|---|
| W1 | tools/sync_decks.py, tools/regen_data_mutants.py, tests/mutants/ (+1) | /tmp/hp-w1 | `nits/sync-decks-hardening` |
| W2 | tools/hifi.py, tools/decks.py, *.pdf, index.html:310 rule | /tmp/hp-w2 | `print/blurb-and-border` |
| W3 | index.html deck header + CSS | /tmp/hp-w3 | `app/print-button` |
| W4 | docs findings, iOS keyboard region | /tmp/hp-w4 | `mobile/audit-pass-1` |
| W5 | data/decks.json, *.pdf, divergence fixture | /tmp/hp-w5 | `engine/adopt-generated-decks` |
| W6 | index.html CSS (broad) | /tmp/hp-w6 | `mobile/audit-pass-2` |

---

## Merge order

W1 first (byte-neutral, cannot conflict with anything). **Then W2, as soon as it
passes review** - an earlier draft put it last in cycle 1, which lengthened the
critical path for nothing: W2 is the sole blocker for W5, the largest lane, and
its `index.html` footprint is a single CSS rule, so the rebase cost it imposes on
W3 and W4 is near zero. Then W3 and W4 in either order (disjoint narrow regions);
**W4 does not merge on CI alone** - it waits on the owner's device check. Then
cycle 2: **W5 and W6 concurrently** - W6's CSS work is independent of W5's
data/PDF/generated-DECKS lane, so gating it on W5 was serialization for nothing.
W6 needs only W2 and W4 merged. W5 rebases onto W1.

Stale means CONFLICTING, not merely behind. A lane behind main is not rebased.

---

## Cost

Cycle 1: 4 lanes -> ~8 subagent runs, 4 CI runs, +1 reviewer and +1 CI run per
bounce. Cycle 2: 2 lanes -> ~4 subagent runs, 2 CI runs. The mutation gate is the
long CI job (267+ patches), so every PR touching `tests/mutants/` pays it - that
is W1, W2 and W5, three of the six.

Paper cost, now that D10 is settled: Pygmy's printed deck goes from ~4 to ~7
US-Letter sheets (52 cards at 3x3, plus title, legend and blanks in the `Cards`
variant). Hijaz and Amara are unchanged in sheet count.

---

## Status

| Lane | State | PR | Head SHA | Verdict | Attempts |
|---|---|---|---|---|---|
| W1 | in review | #71 | `c8e603e` | pending | 0 |
| W2 | in review | #73 | `bbb9545` | pending | 0 |
| W3 | not spawned | - | - | - | 0 |
| W4 | not spawned | - | - | - | 0 |
| W5 | blocked on W2 | - | - | - | 0 |
| W6 | blocked on W2+W4 | - | - | - | 0 |

## Review log

| PR | Lane | Verdict | Findings | Outcome |
|---|---|---|---|---|

## Queue

| # | Row | Raised by | Status |
|---|---|---|---|
| 1 | `validate.py` check 1 double-prints its OK line (D3) | reviewer PR #70 | open, deliberate |
| 2 | `tools/hifi.py` tracking mismatch: `:60` measures 0.231pt/char, `:214` draws 0.554pt/char | earlier session | open |
| 3 | Python oracle tie-break at `tests/test_deck_data.py:338` | earlier session | open |
| 4 | `layout.test.js` label-shape inference + `tools/hifi.py` comment rewrap | earlier session | open |
| 5 | Mutant de-dup | earlier session | open |
| 6 | `formatSeed` guard | earlier session | open |
| 7 | Ring clearance | earlier session | open |
| 8 | Generated title-card text test | earlier session | open |
| 9 | Mixed N=5 inversion (solver radii, recorded not asserted) | earlier session | open |
| 10 | Edit-sheet mirror live-preview + two false comments | earlier session | open |
| 11 | DESIGN.md via /design-consultation | earlier session | open |
| 12 | Print calibration check, six preset names | owner's desk | open |
| 13 | W2 edited `tests/fixtures/print_decks_v1.json` (Pygmy blurb 25->27) outside its ownership; consequence of D5, sent to its reviewer to adjudicate | W2 report | open |
| 14 | Brief to W2 said 8 hand-written `c_*` mutants; 26 exist. Integrator's miscount, not a lane defect | W2 report | open |

## Cycle state

Cycle: 1   Wave: 1   Merged this batch: -

| Lane | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on | Retained |
|---|---|---|---|---|---|---|---|---|---|---|
| W1 | harness | `nits/sync-decks-hardening` | #71 | `c8e603e` | 2026-09-16 CI 5/5 pass | in review | 0 | no | - | - |
| W2 | harness | `print/blurb-and-border` | #73 | `bbb9545` | 2026-09-16 CI 5/5 pass | in review | 0 | no | - | - |
| W3 | harness | `app/print-button` | #72 | - | - | working | 0 | no | - | - |
| W4 | harness | `mobile/audit-pass-1` | - | - | - | - | 0 | no | owner device check | - |
| W5 | - | `engine/adopt-generated-decks` | - | - | - | - | 0 | no | W2 merge | - |
| W6 | - | `mobile/audit-pass-2` | - | - | - | - | 0 | no | W2+W4 merge | - |

Wave 1 spawned 2026-09-16 off `main` @ `839d70e` (the doc commit; base content
identical to `28117a8`). Agent IDs are held in the integrator session only.
Merge order stands: W1, then W2, then W3/W4 - and W4 only after the owner's
iPhone 14 / iOS 26.6 device check, never on CI alone.

---

## GSTACK REVIEW REPORT

`/plan-eng-review`, 2026-09-16, against `main @ 28117a8`. Plan amended in place;
this section records what changed and why.

| Run | Reviewer | Status | Findings |
|---|---|---|---|
| 1 | plan-eng-review (Claude, Opus 5) | complete | 10 raised, 10 applied |
| 2 | outside voice (codex, high effort, read-only) | complete | 6 raised, 6 applied, 1 corrected a finding from run 1 |

### Run 1 - findings and disposition

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | P0 | `select.cap` trims NAMES, not cards. Pygmy adopts to 52 cards / 31 names, not 31 cards. D10 and W5's acceptance were both unachievable. | **Owner decision: ship 31 names / 52 cards.** D10 amended; W5 acceptance restated in both counts. Card-capping measured and rejected: it costs 13 names and every 7th chord on the pan. |
| 2 | P0 | `tests/test_render_agreement.py` has ZERO border assertions. W2's stated justification for owning `index.html:310` was false, and nothing pins the border in either renderer. | Justification corrected; W2 gains an explicit step to ADD the agreement assertion, TDD, before the restyle. The conclusion (one lane owns both halves) survives on the corrected reason. |
| 3 | P1 | W3's "derive the href from a per-deck field" - no such field exists in `data/decks.json`, and adding one collides with W5's regeneration. | **Owner decision: literal `deckId -> basename` map in the app's non-generated JS.** W3 gains a `git diff main -- data/decks.json` empty criterion. |
| 4 | P1 | W4's acceptance demanded a regression test `TODOS.md` says headless Chromium cannot produce. | **Owner decision: ship behind a device check.** Split into a CI-gated offset-math half and a device-gated reachability half; W4 is DEVICE-CHECK-PENDING and not merge-authorized by CI alone. |
| 5 | P1 | W2 edits `tools/decks.py` but the plan never checked the 8 hand-written `c_*` mutants, which `regen_data_mutants.py --check` is blind to. | `git apply --check` added as W2 step 5. |
| 6 | P1 | D8 contradicts `CLAUDE.md:167`, `README.md:20`, `README.md:116` ("TWO-TONE SPLIT... deliberately NOT a gradient"); no lane was assigned the amendment. | W2 step 4 amends all three. |
| 7 | P2 | `tests/mutants/` claimed by W1, W2 and W5; W1's "268 patches" is an absolute owned by three lanes. | W1's acceptance restated as a delta. Ownership narrowed further by run-2 finding #3 below. |
| 8 | P2 | W4's "18-item iPhone 14 checklist" is enumerated nowhere; a spawned lane sees only its prompt. | W4 now ENUMERATES the checklist as its first deliverable, with a minimum coverage list. |
| 9 | P2 | Merge order put W2 last in cycle 1 while W2 is the sole blocker for W5, the largest lane. | W2 now merges second, right after W1. |
| 10 | P3 | D8 orphans `duo_frame`'s `gb`, `--gb`, `grad=`, `colors.gb`; silence invites a lane to tidy into W5's file. | D8 amended: keep the plumbing, change only the draw. |

### Run 2 - outside voice, findings and disposition

| # | Sev | Finding | Disposition |
|---|---|---|---|
| 1 | High | "Stale means conflicting" is too weak here: two lanes can edit disjoint regions of a single-file app, conflict-free, and produce a merged file no CI run ever tested. | Merge gate added to the header: main's own CI must be green before the next lane merges. Serialized merges + green main between them is the cheap merge queue. |
| 2 | High | The goal's "without a deck's printed bytes changing" is impossible - ReportLab stamps a creation date, every rebuild rewrites all six PDFs, and the staleness test compares extracted TEXT (`CLAUDE.md:317-320`). A reviewer policing byte identity fails every honest lane. | Goal and non-goals restated as CONTENT, not bytes, with the reason inline. |
| 3 | Med | W2 must not own or regenerate `tests/mutants/`: all 12 generated `b_*` patches target `data/decks.json` and the `index.html` DECKS line, and W2 touches neither. | **Verified all 12 - correct, and it corrects run-1 finding #7.** W2 drops `tests/mutants/` from its ownership and no longer runs `regen_data_mutants.py`. Ownership is now W1 and W5 only. W2's exposure is the `c_*` set, covered by run-1 finding #5. |
| 4 | Med | W1's "killed by the new test and by nothing else" is unprovable: `tests/mutation_check.sh:138` runs only the patch's own `# suite:` command. | Acceptance rewritten to "killed by the targeted suite named in its header, and that header names an individual test". |
| 5 | Low | W5 is assigned a `CLAUDE.md` edit in its steps but `CLAUDE.md` is absent from its ownership block and the ownership table. | Added to W5's ownership, with the W2 overlap (`CLAUDE.md:167`, different section) called out. |
| 6 | Low | W6 need not wait for W5 - its CSS work is independent of W5's data/PDF/DECKS lane. | Cycle 2 now runs W5 and W6 concurrently; W6 blocks on W2+W4 only. |

### Test plan

`~/.gstack/projects/raywu-handpan-cards/ray-main-eng-review-test-plan-20260916-150010.md`

Coverage map, the one hard gap (the missing border agreement assertion), the one
criterion CI cannot meet (W4's device check), and the one unmeetable criterion
that was removed (W1's "nothing else").

### Evidence gathered during review

Every code anchor the plan cites was checked and is real and correctly located.
Measured against the live engine from the golden maker strings:

```
hijaz  cap=25  cards=19  names=19   shipped 18
pygmy  cap=31  cards=52  names=31   shipped 27 (21 names)
amara  cap=25  cards=25  names=25   shipped 16
```

Pygmy's 15 multi-voiced names were checked for pitch-class-complete
highlighting: **0 mismatches**, every register of a name lights an identical
field set. The generated alternates inherit the convention today's Cm7/Eb7 pair
already follows.

### VERDICT

**APPROVED WITH AMENDMENTS APPLIED.** The lane decomposition, the ownership
model and D6's PDF serialization were all sound. What the plan got wrong was
four factual claims about the codebase (the cap's unit, the border test's
contents, a `data/decks.json` field that does not exist, a regression test that
cannot exist) and four unmeetable or mis-sequenced criteria. All are corrected
above. Ready to execute.

NO UNRESOLVED DECISIONS
