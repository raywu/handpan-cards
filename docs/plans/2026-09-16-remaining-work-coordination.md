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
| W1 | tools/sync_decks.py, tools/regen_data_mutants.py (SHARED with W5 - see row 99), tests/mutants/ (+1) | /tmp/hp-w1 | `nits/sync-decks-hardening` |
| W2 | tools/hifi.py, tools/decks.py, *.pdf, index.html:310 rule | /tmp/hp-w2 | `print/blurb-and-border` |
| W3 | index.html deck header + CSS | /tmp/hp-w3 | `app/print-button` |
| W4 | docs findings, iOS keyboard region | /tmp/hp-w4 | `mobile/audit-pass-1` |
| W5 | data/decks.json, *.pdf, divergence fixture, index.html:const DECKS, CLAUDE.md, tests/app.test.js, tests/fixtures/golden_decks_v4.json (new), tests/fixtures/print_decks_v1.json, tests/mutants/ (14 modified, 0 added), tests/test_deck_data.py, tests/test_fixture_integrity.py, tests/test_gen_deck.py, tests/test_pdf_build.py, tests/test_print.py, tests/test_render_agreement.py, tools/boot_sim.js, tools/validate.py, tools/regen_data_mutants.py (SHARED with W1 - see row 99) | /tmp/hp-w5 | `engine/adopt-generated-decks` |
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
| W1 | merged | #71 | `c8e603e` | PASS_WITH_NITS | 0 |
| W2 | merged | #73 | `bbb9545` | PASS_WITH_NITS | 0 |
| W3 | merged `bc9980a` | #72 | `f6242cd` | PASS_WITH_NITS | 1 |
| W4 | 2nd review PASSED, doc nits fixed, MERGEABLE - held for the owner's SECOND device check | #74 | `a388857` | PASS_WITH_NITS @ `2ec374d` (0 blocking) | 2 |
| W5 | blocked on W2 | - | - | - | 0 |
| W6 | blocked on W2+W4 | - | - | - | 0 |
| S5 | keyboard/footer + delete confirmation - pushed, PR pending | - | `0f62bbc` | - | 0 |

## Review log

| PR | Lane | Verdict | Findings | Outcome |
|---|---|---|---|---|
| #71 | W1 | PASS_WITH_NITS | 0 blocking, 6 nits (N1-N6), 0 boundary violations | merged `4a06641`; nits filed as queue rows 15-18 |
| #73 | W2 | PASS_WITH_NITS | 0 blocking, 4 nits (N1-N4), 1 boundary edit adjudicated NOT a violation | merged `7329033`; nits filed as queue rows 25-28; criterion 10 to the owner as row 29 |
| #72 | W3 | FAIL | 2 blocking (P1 Enter on a print link flips the card instead of opening the PDF; P2 the hidden face's print links stay in the tab order inside an aria-hidden subtree) | bounced; authoring lane unreachable, integrator fixed both at `f6242cd` with two new e2e tests and two re-anchored mutants; fresh reviewer pending |
| #72 | W3 | PASS_WITH_NITS (fresh reviewer, at `f6242cd`) | 0 blocking, 4 nits (N1-N4), 0 boundary violations. Laundered-green check resolved CLEAN: `b255b1b` does describe fixes it lacks, but `f6242cd` restores them and both are live at the reviewed head, so CI's green is real. 9 of 10 mutants spent, 7 killed by the lane's own e2e tests | merged `bc9980a`; nits filed as queue rows 37-40 |
| #74 | W4 | PASS_WITH_NITS | 0 blocking, 6 nits (N1-N6), 0 boundary violations. Independently confirmed the integrator's `d8866d5` re-anchor is faithful: all three patches mutate the identical lines they mutated at `839d70e`, `# kills:`/`# suite:` headers byte-identical, all three verified clean-green / mutant-red locally (including the browser-driven one against real Chrome). No red gate laundered green | NOT merged - held for the owner's device check; nits filed as queue rows 31-36 |
| #75 | W5 | CI FAIL (no reviewer spawned) | `data integrity` red at `5d6bf26`: `tools/boot_sim.js:36` hardcodes `if (cards !== 61)`, and the adoption raises the total to 96 cards. Other four checks green at the same SHA | bounced to the still-live lane 2026-09-16; attempt 1 of 2 consumed. A red CI makes the review moot before it starts, so no reviewer was spawned |
| #75 | W5 | pending (fresh reviewer at `d2c06b6`) | - | Lane fixed `tools/boot_sim.js:36` (61 -> 96) plus a stale docstring in `tests/test_fixture_integrity.py` and pushed `d2c06b6`; all five checks green at that SHA, head verified unmoved. Reviewer briefed on the data-convention invariants, the three self-reported boundary touches, the Amara re-rank vs the owner's "our current order is correct", and a 10-mutant budget aimed at the data invariants |
| #75 | W5 | PASS_WITH_NITS (fresh reviewer, at `d2c06b6`) | 0 blocking, 8 nits (N1-N8), 0 blocking boundary violations. 11 mutants spent against a budget of 10, ZERO survivors - the strongest mutant result of the workstream. Independently re-derived the Pygmy 31 from `select.js` rather than taking it on trust, verified identical register lighting across all 15 multi-voiced groups / 36 cards, and confirmed `geom`/`fields`/`colors` byte-identical across all three decks. Did NOT run /review's Step 4.5 specialists or Step 5.7 adversarial passes, and deliberately skipped Step 5.8 logging so no record could later read as a clean full review | merged `e872a49`; nits filed as queue rows 46-50; N1/N2/N3 doc defects fixed directly on main |
| #79 | S3 | PASS_WITH_NITS | 0 blocking, 0 boundary violations; 8 mutants spent, 2 survived | merged `eeb7329`; nits filed as queue rows 59-66, device half as row 67 |
| #80 | S4 | PASS_WITH_NITS (at `fa1f647`) | 0 blocking, 8 nits (N1-N8), 0 boundary violations. AC1 reproduced independently: 291/291 killed, gate passed, zero skipped. AC2 verified BY HAND, not via the sweep: all 241 node `--test-name-pattern` headers and all 49 python `-k`/dotted headers resolve to a real test, and all 291 patches carry a `# suite:` line. AC3 confirmed as real markup at `index.html:761` inside `#scale-layout-row`, wired with `aria-describedby`. Skip guard judged sound in BOTH error directions: a false skip raises `SKIPPED` and forces exit 5, a false evaluation scores the 0-exit as survived and forces exit 1 - neither can produce a silent green. 4 of 5 mutants spent; M1 killed, M2-M4 survived and became rows 70-73 | merged `43d83ce`; nits filed as queue rows 70-77 |
| #81 | S4 | not reviewed (doc-only) | `dedf128` touches `docs/plans/` only - queue rows 70-77 filed, rows 68/69 sharpened with the PR #80 reviewer's evidence. No code, so no review gate | merged `28db5c2`; CI 5/5 |
| #82 | S4 | PASS_WITH_NITS (at `2a43240`) | 0 blocking, 3 nits (N9-N11), 0 boundary violations (9 files, all lane-owned; committed `index.html`/`src`/`data`/`tools` untouched, so CONTRACT rule 6 holds). AC1 reproduced: 295/295 killed, 0 survived / 0 timeout / 0 stale / 0 skipped / 0 broken. AC2 verified: all three PR #80 survivors now die on their own NAMED assertion, not a crash. Rule 4 provenance checked on all 4 patches - preimage blob + patch reproduces the declared postimage hash exactly, all GENUINE. Comment-strip safety MEASURED, not reasoned: `<!--` and `-->` occur 29 times each (balanced), zero of the 7 `<script>` blocks contain either token, and the hint at line 761 precedes the first engine region at line 822, so the strip cannot reach the inlined engine. 5 mutants spent; 2 killed, 3 survived and became rows 78-80 | merged `339838b`; nits filed as queue rows 78-80 |
| #84 | S4 (oracle) | PASS_WITH_NITS (at `293139d`) | 0 blocking, 1 nit (N12), 0 boundary violations. Diff is exactly 5 lane-owned paths against the real merge-base `4b9b03b`. AC1: the oracle scrolls the hint into view and intersects its rect with every non-`visible` overflow ancestor and the viewport. AC2: both new mutants die on THAT assertion at `:2748`, read from the AssertionError text - `0x0` off-screen, `336x0` clipped - not a crash. AC3 rule-4 provenance verified by REPRODUCTION rather than blob resolution (a `git diff` postimage is hashed but never written to the odb): all four patches applied and re-hashed to their declared postimage. AC4: the narrowed pattern selects exactly 1 test, `tests/layout.test.js:538`; red under the mutant on its own assertion. AC5: `git mv` preserved (`R070`), and the vacuous-`survived` claim was verified by running the fixture, not taken on trust. AC6: 297 `.patch` files, gate green in CI. 2 of 5 mutants spent | merged `916d502`; nit filed as queue row 81 |

## Queue

| # | Row | Raised by | Status |
|---|---|---|---|
| 1 | `validate.py` check 1 double-prints its OK line (D3) | reviewer PR #70 | OPEN, deliberate |
| 2 | `tools/hifi.py` tracking mismatch: `:60` measures 0.231pt/char, `:214` draws 0.554pt/char | earlier session | OPEN |
| 3 | Python oracle tie-break at `tests/test_deck_data.py:338` | earlier session | OPEN |
| 4 | `layout.test.js` label-shape inference + `tools/hifi.py` comment rewrap | earlier session | OPEN |
| 5 | Mutant de-dup | earlier session | OPEN |
| 6 | `formatSeed` guard | earlier session | OPEN |
| 7 | Ring clearance | earlier session | OPEN |
| 8 | Generated title-card text test | earlier session | OPEN |
| 9 | Mixed N=5 inversion (solver radii, recorded not asserted) | earlier session | OPEN |
| 10 | Edit-sheet mirror live-preview + two false comments | earlier session | OPEN |
| 11 | DESIGN.md via /design-consultation | earlier session | OPEN |
| 12 | Print calibration check, six preset names | owner's desk | OPEN |
| 13 | W2 edited `tests/fixtures/print_decks_v1.json` (Pygmy blurb 25->27) outside its ownership; consequence of D5, sent to its reviewer to adjudicate | W2 report | OPEN |
| 14 | Brief to W2 said 8 hand-written `c_*` mutants; 26 exist. Integrator's miscount, not a lane defect | W2 report | OPEN |
| 15 | W1-N1: `tests/test_deck_data.py:556` asserts only a non-zero exit; assert the stderr message instead | reviewer PR #71 | OPEN |
| 16 | W1-N2: `tools/regen_data_mutants.py:235,239,244` still bare `open()`; :244 writes diffs over non-ASCII `data/decks.json` | reviewer PR #71 | OPEN |
| 17 | W1-N3: `CLAUDE.md:301` still says sync_decks re-parses JSON; it now compares bytes. Outside W1's ownership | reviewer PR #71 | OPEN |
| 18 | W1-N4: `tools/regen_data_mutants.py:189` keeps the semantic compare W1 just declared insufficient | reviewer PR #71 | OPEN |
| 19 | Mutant patches are line-anchored: W3's first attempt put `PRINT_PDFS` next to the DECKS line and turned ~12 patches stale. Any `index.html` insertion near that anchor pays this | W3 report | OPEN |
| 20 | W4-F1: a stale landscape-clipping comment/expectation in `tests/e2e.test.js` did not reproduce during the mobile audit. Confirm the test and its comment are accurate against current main | W4 report | OPEN |
| 21 | W4-F2: deck-header print links were not on main at W4's base `839d70e`, so the mobile checklist marked them "not applicable". Re-audit them once W3 (#72) lands | W4 report | OPEN |
| 22 | W4-F3: `interactive-widget=resizes-content` (`index.html:5-13`, pre-existing) is Chromium-only; Safari ignores it, which is why W4's `visualViewport` JS is load-bearing rather than redundant. Informational | W4 report | OPEN |
| 23 | W4-F4: `env(safe-area-inset-*)` reads 0 under headless emulation, so the insets look structurally right but are unconfirmed on hardware. Rolls into the owner device check | W4 report | OPEN |
| 24 | Re-anchoring a mutant patch is the AUTHORING lane's job, not a later cycle's. W4 stopped at diagnosis because `tests/mutants/` was outside its ownership row; the integrator had to take the bounce after the lane had already exited. Extend a lane's ownership to the patches its own edit staleness-breaks, at spawn time | integrator, W4 bounce | OPEN |
| 25 | W2-N1: `tools/decks.py:399` comment still says "the two-tone split frame" in the `from_generated` adapter. One-line fix | reviewer PR #73 | OPEN |
| 26 | W2-N2: `tests/test_render_agreement.py:283-293` compares two test-local literals (`NEW_BW/OLD_BW` vs `NEW_PAD/OLD_PAD`), so that assertion cannot fail regardless of the code. The two `assertAlmostEqual` pins above it are the real check | reviewer PR #73 | OPEN |
| 27 | W2-N3 (surviving mutant): `render_border` filters on full-WIDTH fills and asserts the colour set is `{root}`, so a half-HEIGHT band at `tools/hifi.py:183` passes the whole suite. Harden by asserting the frame rect's drawn height equals `hifi.CH` | reviewer PR #73 | OPEN |
| 28 | W2-N4: `tools/decks.py:285` source literal still reads `25 CHORDS` while the card prints 27 (the regex overwrites at runtime). Correct behaviour, misleading source | reviewer PR #73 | OPEN |
| 29 | W2 criterion 10 came back `covered_by: neither` — nothing in the repo looks at a rendered card, so whether the new border LOOKS right is the owner's call. Mechanically verified by pixel probe at 8x: all four sides root-coloured (Pygmy `#6C40A2`, Amara `#0A7A75`, Hijaz `#DF549A` top and bottom alike), weight 2.00pt to 2.62pt measured. Owner to eyeball a printed sheet | reviewer PR #73 | OPEN |
| 30 | The `c_*` mutant count is 27, not the 8 in the W2 brief nor the 26 in the lane report. The 8 traces to a stale gstack learning `handpan-b-mutants-track-deck-data-only`, which the reviewer corrected. All 27 apply cleanly | reviewer PR #73 | OPEN |
| 31 | W4-N1 (substantive): the iOS keyboard fix's WIRING is untested. `applyKbOffset()` can be replaced with a bare `return;` and all 101 unit tests still pass. The four kbOffset tests exercise only the pure arithmetic helper; the fifth only asserts no throw. The unit sandbox has no `window.visualViewport`, and CI Chromium's visualViewport always equals the layout viewport, so the function is indistinguishable from never running. **The merge rests on the owner's hardware check more than PR #74's body implies** | reviewer PR #74 | OPEN |
| 32 | W4-N2: `applyKbOffset()` in `showSheet()` (`index.html:4391`) is near-dead and structurally unkillable - it is called BEFORE `scaleBox.focus()`, so the keyboard is not up and `kbOffset()` is always 0. The resize/scroll listener does the real work. Harmless defensive code; recorded so it is not mistaken for covered behaviour | reviewer PR #74 | OPEN |
| 33 | W4-N3: `docs/2026-09-16-mobile-audit-pass-1.md` row 8a cites an ad-hoc headless verification (monkey-patching `window.innerHeight`, observing `transform: matrix(1,0,0,1,0,-300)`) that was never committed - `tests/e2e.test.js` is unmodified by that branch, so the evidence is unreproducible. Committing that technique as an e2e test would close rows 31 and 32 at once. Cycle-2 candidate | reviewer PR #74 | OPEN |
| 34 | W4-N4 (for the OWNER's device check list): `.sheetsurf`'s `max-height:85dvh` (`index.html:402`) does not shrink for the keyboard - `dvh` does not react to it on Safari, which is the premise of the fix. With a 300px keyboard on 390x844, a near-cap Edit sheet (~717px) translated up 300px puts its top near -173px. The primary buttons DO become reachable (the footer sits outside the `.sheetbody` scroller and rides the translate), but `.sheetbody`'s scrollport top can leave the screen. **Check the EDIT sheet on Pygmy with the keyboard up, not only the ADD sheet** | reviewer PR #74 | OPEN |
| 35 | W4-N5: `index.html:3933-3939` calls `.sheetsurf` "The scrolling surface itself" and cites "the markup comment on .sheetsurf", but the markup comment at `:673-675` describes `.sheetbody`; the single-child guarantee is the CSS comment at `:388-390`. The lookup itself is correct and `.sheetsurf` carries `overflow-y:auto` as a backstop - a pointer/wording slip only | reviewer PR #74 | OPEN |
| 36 | W4-N6: commit `131039f` (integrator's cycle-1 wave-1 Cycle-state record) is an ancestor of `mobile/audit-pass-1` and not on `origin/main`, so merging PR #74 lands a now-stale Cycle-state table. Refresh the doc immediately after that merge | reviewer PR #74 | OPEN |
| 37 | W3-N1 (only finding with real user impact): dead click zone at `index.html:3819`. `.prints` is a full-width flex row (334px at a 380px viewport) but the links occupy x=207-344, and `onclick="event.stopPropagation()"` sits on the WHOLE div. A real click dispatched at x=115 in that strip did not flip the card; a control click on the card body did. So a ~184x12px band left of "FULL DECK PDF" - previously live card surface - now silently does nothing. Fix: move the handler onto the two anchors instead of the row | reviewer PR #72 | OPEN |
| 38 | W3-N2: first ATTRIBUTE-context use of a TEXT-context escaper, `index.html:3817-3818`. `esc` at `:3679` escapes `&` and `<` but not `"`. Every pre-existing call site is text content; this diff introduces the pattern. Not exploitable today (both values are hardcoded `[A-Za-z0-9_.]` literals) but becomes a real hole the moment a basename is data-driven | reviewer PR #72 | OPEN |
| 39 | W3-N3: the P1 guard's BREADTH is untested. Mutant M8 (`closest("a, button")` -> `closest("div")`, which matches `#card` itself and kills keyboard flipping outright) survived the full unit suite AND the full e2e suite. No test asserts that Space/Enter on the card flips it, so a future widening of that selector ships silently | reviewer PR #72 | OPEN |
| 40 | W3-N4: `index.html:3889`'s `removeAttribute("tabindex")` restore is redundant - `render()` rewrites both faces' innerHTML at `:3867-3868` first, so the shown face's anchors are always fresh elements with no tabindex. Mutant M3 survived. Harmless and defensive, but not load-bearing | reviewer PR #72 | OPEN |
| 41 | **CHROME_BIN is set-able on this machine** - `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, and the e2e suite runs locally in ~70s. Every past "browser-dependent, so it moves to the integrator's desk" call in this workstream was avoidable. Export it in future lane and reviewer briefs. Known local flake: `buttons and arrow keys step through the deck and wrap` (CDP `Input.dispatchMouseEvent` timeout) passes in isolation and is green in CI | reviewer PR #72 | OPEN |
| 42 | The repo's gstack learnings store holds `handpan-card-keydown-swallows-child-link-activation` (confidence 9/10), still citing the PRE-FIX line `index.html:4590`. Now fixed and merged at `bc9980a`. Close or update it so a future reviewer does not re-flag fixed code | reviewer PR #72 | OPEN |
| 43 | **Card count goes 61 -> 96 when PR #75 merges** (Hijaz 18->19, Pygmy 27->52, Amara 16->25). I first filed this as an unseen owner decision; that was wrong. 19 + 52 + 25 is exactly W5's written acceptance criteria, and the 31-names/52-cards split is a recorded owner decision (plan-eng-review run-1 finding 1: "Owner decision: ship 31 names / 52 cards"), as is the Amara re-rank (D11). So the breadth is authorized, not a surprise - but the owner has still never seen the resulting TOTAL, and the Pygmy growth is mostly register duplicates of existing names rather than new chords. Surface the number at merge; do not block on it | integrator, PR #75 CI | OPEN |
| 44 | Stale "61 cards" prose survives W5's adoption in three places its edit authorization did not cover: `CLAUDE.md:270` and `:323` (design-system prose, since drifted to `:276` and `:329`) and a comment in `tools/hifi.py:118` (a never-touch file for that lane). Prose only, no test reads them, but they will mislead the next reader of the ground-truth doc. Fix on main after #75 merges. NARROWED: `tools/hifi.py:118` was fixed to 96 by PR #91; only the two `CLAUDE.md` lines remain, and they still need an owner | W5 lane report | OPEN |
| 45 | W5 marked two acceptance criteria met on the strength of an earlier session rather than re-verifying this turn: "Pygmy 31 reproducible by re-running the ranking" and "every multi-voiced name lights an identical field set across its registers". Both are the criteria most specific to this lane's correctness. The reviewer was asked to check them independently; if it comes back `neither`, they land on the integrator before merge | integrator, W5 lane report | OPEN |
| 46 | **W5-N5, the most valuable finding of the review.** Four of the reviewer's eleven mutants died ONLY to regenerable snapshots (`test_deck_dicts_match_the_pre_refactor_snapshot`, `test_fixture_deep_equals_live_decks`, `test_committed_pdfs_match_a_fresh_build`) with no semantic invariant behind them: root-first spelling order, identical register lighting, one-card-per-pitch-set, and Pygmy's Fm9 spread 9th. `data/decks.json` is NOT pure engine output - Fm9 ships `[5,7,8,9,11]` (G5) where the engine defaults to `[5,7,8,9,6]` (G4). That hand-retained owner divergence is guarded by nothing but a snapshot, and the exact regenerate-repin-rebuild workflow W5 just ran would silently revert it with the suite green. Write real invariant tests for those four conventions, modelled on `test_forced_tones_cluster_below_root`, which IS a genuine invariant and does cover all 96 cards | reviewer PR #75 | OPEN |
| 47 | W5-N7: `tools/boot_sim.js:36` is now `if (cards !== 96)` - still the wrong SHAPE, and the exact defect that reddened CI at `5d6bf26`. A per-deck total would still pass if one deck's `order` ran three short and another three long, which is precisely what boot_sim exists to catch. Derive it per deck. The corpus size is already pinned four other places (`tools/validate.py:88`, `CHORD_COUNTS`, `tests/test_fixture_integrity.py`, `tests/app.test.js:270`), and `test_fixture_integrity` deliberately derives rather than restating on the stated grounds that a second copy drifts; boot_sim is the fifth copy and the only one unaware of it | reviewer PR #75 | OPEN |
| 48 | W5-N8: `tests/fixtures/golden_decks_v3.json` is now pinned by no sha256 while four node suites still read it as the frozen 61-card baseline. Re-pin it | reviewer PR #75 | OPEN |
| 49 | W5-N6 (supersedes row 44, which listed only three of these): stale `61` prose survives at `tools/hifi.py:118`, `tests/app.test.js:5` (a header in a file this PR edited at :251 and :270), `README.md:18,60`, `TODOS.md:27,37,39`, and `docs/ENGINE-SPEC.md:528,534,630,911`. All prose or comments, none read by a test. The reviewer confirmed every OTHER `61` in the repo is legitimate - MIDI note 61, a 6.61:1 contrast ratio, viewport pixels, "PR #61", and the genuinely-61-card frozen `golden_decks_v3` corpus | reviewer PR #75 | RESOLVED: `tools/hifi.py:118` was the only cited location still stale, and this PR fixed it to 96. Every other location the row names was already clean at branch time and was verified individually at this SHA: `tests/app.test.js` and `README.md` contain no `61` at all (README's count was corrected to 96 by PR #88, and app.test.js:5 says 59, never 61); `TODOS.md:27,37,39` are keyboard prose and a blank line; `docs/ENGINE-SPEC.md:528,534,630,911` are stale at 59, not 61, so they are outside what this row asserts. The row was written against a pre-#88 tree and its line anchors drifted. Stale `61` prose DOES survive at `CLAUDE.md:276` and `:329` - outside this lane's ownership, tracked by row 44 |
| 51 | **W4 DEVICE CHECK FAILED on the owner's iPhone 14 / iOS 26.6 (2026-09-16), exactly as row 34 predicted.** Screenshot on `mobile/audit-pass-1` via raw.githack: the ADD sheet with the keyboard up has GENERATE CARDS visible and `#scale-box` pushed off the TOP of the screen, so the seed field is unreachable while you are typing into it. Root cause: `applyKbOffset` translated the surface up by the keyboard height but nothing capped its HEIGHT - `max-height:85dvh` (`index.html:402`) is a layout-viewport unit and does not react to the keyboard, so a ~717px surface lifted 300px lands its top at -173px. The reserved footer rides the translate, which is why the fix LOOKED right. Fixed by the integrator on the branch: new pure `kbCap(innerHeight, vvHeight)` caps the surface to the shrunken visual viewport, `.sheetbody`'s existing shrink absorbs it; 4 new unit tests in `tests/app.test.js` including a top-edge-on-screen invariant. Needs a SECOND device check, and this time the EDIT sheet too. Branch then rebased onto main (clean, no hand-resolved conflicts) because it had gone CONFLICTING after W5 - see row 52. CI 5/5 green at `2ec374d`; fresh reviewer spawned | integrator | OPEN |
| 52 | **Root cause of a 25-minute CI stall worth remembering: a PR whose `mergeable` is `CONFLICTING` never queues a `pull_request` workflow run at all.** After W5 merged, `mobile/audit-pass-1` went conflicting against main; GitHub cannot compute the merge ref, so it silently creates no run - `gh pr checks` says "no checks reported" and `gh api .../actions/runs?head_sha=...` returns `total_count: 0`, which reads exactly like a hung or skipped run. Closing and reopening the PR does NOT help. The swarm loop's "still pending after 30 minutes, park the lane" branch is the wrong response here; the right first probe is `gh pr view <n> --json mergeable`. Fold that into the loop's four-outcome CI branch as a fifth outcome: no run created + CONFLICTING means rebase, not park | integrator | OPEN |
| 53 | Queue row 36 / W4-N6 is now moot: `131039f` turned out to already be on main, and `git rebase` skipped it as a previously-applied commit. No stale Cycle-state table will land with #74 | integrator | RESOLVED |
| 54 | W4-N7 (2nd review, nit): the keyboard fix's WIRING is invisible to every environment CI can run, and the 2nd review proved it by mutation rather than by inspection - `applyKbOffset` gutted to `return;`, the `sheetSurf.style.maxHeight` write deleted outright, `showSheet` no longer calling `applyKbOffset()`, and `hideSheet` (named `closeScaleSheet` when this row was written) no longer resetting the transform ALL survive the full suite (105 unit + the 3 most geometry-sensitive e2e). Headless Chromium's `visualViewport` always equals the layout viewport, so both pure functions return 0 there and every style write is the empty string. This restates and extends row 31 with the mutants that demonstrate it. Not a defect in shipped code - all four mutants trace to missing coverage, not wrong behaviour - so it is a nit, but it is the reason W4 does not merge on CI alone. Closing it needs a harness that can drive a shrunken visual viewport (CDP `Emulation.setDeviceMetricsOverride` is the likely lever), which is W6-sized work, not W4's. | RESOLVED (lane S6, `3ab5e17`): `tests/e2e.test.js` now drives a shrunken visual viewport through a CDP seam, so the wiring is visible to CI at last. The mutants that exist in `tests/mutants/` are `e_kb_sheet_never_translates` (the lift never happens), `e_kb_show_sheet_never_measures` (mutant 3 of this row verbatim), `e_kb_cap_outlives_the_sheet` (the teardown half of the cap, row 88) and `e_kb_zoom_reads_as_a_keyboard` (row 87's gate). This row's mutants 1 and 2 - `applyKbOffset` gutted to `return;`, and the `maxHeight` write deleted - are NOT separately checked in: gutting the function is subsumed by `e_kb_sheet_never_translates`, and the cap's open-path write is exercised by the same tests that pin the teardown. No patch named `e_kb_offset_gutted` or `e_kb_cap_removed` was ever written; an earlier version of this line claimed otherwise |
| 55 | W4-N8 (2nd review, nit): `hideSheet` (then named `closeScaleSheet`, `index.html:4493`) resets `sheetSurf.style.transform` but not `sheetSurf.style.maxHeight` - asymmetric. Harmless on every reachable path (the sheet is `hidden` when closed, `showSheet` recomputes both, and the listeners are not gated on `sheetOpen`), so this is tidiness, not a bug. **Deliberately NOT fixed in W4:** the line sits inside the context window of `tests/mutants/d_layout_preview_sticks.patch`, and editing it would need the mutant re-anchored for no behavioural gain. Do both resets, or neither, when that patch is next touched. | RESOLVED (lane S6, `420400e`): `hideSheet()` now clears `maxHeight` alongside `transform`, behind a `sheetOpen` gate. The gate is not about the `maxHeight` write provoking its own event - that does not reproduce - but about the listeners living for the life of the page: a resize or scroll arriving after `hideSheet()` would otherwise re-apply the lift and the cap to a closed sheet, and on iOS the keyboard dismissing itself as the sheet closes is exactly such an event. Same fix as row 88 |
| 56 | W4-N9 (2nd review, nit) RESOLVED in `a388857`: the `kbCap` comment justified its 8px against "subpixel viewport heights", which over-provisions a sub-pixel error by ~8x. The 8px is defensible as a visual margin against the keyboard, and the comment now says that instead. The value is unchanged. | RESOLVED |
| 57 | W4-N10 (2nd review, nit) RESOLVED in `a388857`: the comment above `const sheetSurf` said the value is "Undefined in the unit sandbox"; `firstElementChild` returns `null`, not `undefined`. Cosmetic; the guard is truthiness either way. | RESOLVED |
| 58 | W4-N11 (2nd review, nit) RESOLVED in `a388857`: `docs/2026-09-16-mobile-audit-pass-1.md` and `TODOS.md:16` both still described the translate-only fix the owner's device check disproved, and checklist item 13 still said the deck-header print affordance was "not yet on `main`" when the rebase brought it in at `index.html:3806-3808` with four e2e tests. The reviewer called the fix description "the one I would want corrected before merge". Both files now record the two-pass history, the 85dvh root cause, and the wiring gap. Item 13 is marked stale and points at F2 / row 21 for the re-audit. | RESOLVED |
| 50 | W5-N4 / ownership-row defect: the reviewer found ~9 test and tool files edited outside W5's ownership row, every one a mechanically forced count update the lane could not ship without, while the one fixture the row DID assign to W5 (`tests/fixtures/divergence_v1.json`) went unchanged. Adjudicated as a mis-specified ownership row, not lane overreach - correct the row, not the branch. Also: `CLAUDE.md:101-102` still says "Pygmy ships Cm7 and Eb7 in two registers each", true at 27 cards and false at 52, where 15 groups span 36 cards. Someone must own that line | reviewer PR #75 | RESOLVED: the W5 row is now the file list `git diff --name-status e872a49^1 e872a49` actually reports - six `tests/test_*.py` files (`test_render_agreement.py` was the one missed), `tools/boot_sim.js`, `tools/validate.py`, `tools/regen_data_mutants.py`, `CLAUDE.md`, `index.html:const DECKS`, both fixtures, alongside `data/decks.json`, `*.pdf` and the divergence fixture. `tests/mutants/ (+1)` was wrong twice over: W5 modified 14 patches and added none, and the `(+1)` had been copied from W1's row, where it means a new patch. Correcting the list exposed a real collision - `tools/regen_data_mutants.py` is assigned to W1 and was edited by W5 - now filed as row 99 rather than buried. The `CLAUDE.md:101-102` ownership gap this row also raised is a separate open question, not fixed here - it needs its own owner assignment |
| 59 | S3-N1 (surviving mutant): `index.html:4284-4290`'s stale-correction guard (`if (layoutOrder && layoutOrder.length !== n) layoutOrder = null;`) is untested — deleting it passes the whole suite. Consequence is user-visible: after a correction, typing a seed with a different field count makes `HPE.layout.solve` return `BAD_NOTE`, `paintPan` returns false, `holdPanPreview()` keeps the old pan, and the Edit mock freezes instead of following the typing. Worth one test | reviewer PR #79 | RESOLVED (8b5520d: test `retyping a seed with a different field count drops the correction and the mock follows` + `d_layout_stale_order_guard.patch`) |
| 60 | S3-N2: that guard is length-only. A same-count zone reshuffle (8 rim -> 6 rim + 2 bottom) carries a stale correction across zone boundaries and silently rotates the bottom shell. No collision, no crash, visible in the mock, fixable with RESET. Named as an accepted risk at `docs/plans/2026-09-16-scale-page-ux.md:368`; pre-existing and plan-sanctioned, now more visible | reviewer PR #79 | OPEN |
| 61 | S3-N3 (surviving mutant): `rotateLayout`'s `layoutSel = wrap(layoutSel + by, a, span)` — the selection following the rotated note — has no test. Pairs with row 59 as one small test addition | reviewer PR #79 | RESOLVED (8b5520d: test `ROTATE keeps the note you chose selected as its ring turns` + `d_rotate_drops_the_selection.patch`) |
| 62 | S3-N4: `tests/mutants/d_pan_hits_leak_into_cards.patch` now kills only by crashing boot. Its `const interactive = true` meets the Stage-3 line `index.html:3780` (`const sel = interactive && opts.selected != null ? ...`); with `opts` null it throws, `boot()` dies, and every `app.test.js` test fails — the named test never reaches its own assertion (`tests/app.test.js:2499`). Verified: `pass 0 / fail 1 / TypeError`. Fix: mutate the emission (drop the `if (interactive)` guard on the two `<g>` appends) instead of the flag | reviewer PR #79 | RESOLVED (8b5520d: mutant re-pointed at the emission; kills on the named test's own assertion) |
| 63 | S3-N5: `tests/mutants/d_edit_moves_selection.patch` also kills via TypeError, and its test oracle is close to a tautology. Same fix shape as row 62 | reviewer PR #79 | RESOLVED (8b5520d: mutant re-pointed, and the oracle now derives its expectation from the registry) |
| 64 | S3-N6: `tests/mutants/d_layout_preview_sticks.patch` kills on a real invariant, but not the one its `# kills:` line states. Re-word the header or re-point the patch | reviewer PR #79 | RESOLVED (8b5520d: mutant now writes the SOLVED pan, so it kills on the invariant its `# kills:` line states) |
| 65 | S3-N7: stale comment at `index.html:196` still cites `#scale-slots .slot` as precedent for an id Stage 3 deleted | reviewer PR #79 | RESOLVED (8b5520d: comment now cites `#scale-delete`) |
| 66 | S3-N8: `docs/plans/2026-09-16-scale-page-ux.md` still describes `solveSheetLayout` / `buildSlots`, both gone. Outside S3's ownership; Stage 4 work | reviewer PR #79 | RESOLVED (8b5520d: as-built note added naming `solvePreviewLayout` and `syncLayoutOrder`) |
| 67 | **Stage 3's AC5 device half is `covered_by: "neither"`** — the `applyKbOffset` translate+cap path iOS Safari exercises is never run by e2e (same root cause as rows 31/54). Needs an owner check on iPhone 14 / iOS 26.6 of BOTH the ADD and EDIT pages with the keyboard up | reviewer PR #79 | OPEN |
| 68 | **`tests/e2e.test.js` "buttons and arrow keys step through the deck and wrap" is flaky in a full-file run** and passes in 4.4s in isolation. It times out on `Input.dispatchMouseEvent` (20-60s) only when the whole file shares one browser session. Reproduced IDENTICALLY at base `1b63e0e` (75/76, same test), so it predates the s4 branch and is not a blocker for it. Order- or state-dependent in the shared CDP session. The PR #80 reviewer's own full-file run at `fa1f647` passed 76/76 INCLUDING this test, so it is intermittent rather than a deterministic full-file failure | Stage 4 sweep | OPEN |
| 69 | **A `tests/e2e.test.js` run killed by `suite_health.py`'s 180s wall clock LEAKS its headless Chrome and profile dir.** Observed: one browser still alive 23 minutes after the kill (profile `hpfc-prof-n7o60t`) plus 12 stale profile dirs, which then starved the next e2e run into 135 cascading CDP timeouts. **Mechanism, sharpened by the PR #80 reviewer:** `tests/suite_health.py:199-202` uses `subprocess.run(..., timeout=NODE_TIMEOUT)`, and on `TimeoutExpired` CPython calls `Popen.kill()` - SIGKILL, not SIGTERM. Node cannot trap it, so its reaper never runs and the browser plus profile dir are orphaned BY CONSTRUCTION. That is also why the existing mutant misses it: `a SIGTERMed suite reaps its browser and its profile directory` tests a signal this path never sends. A fix needs `Popen` + `terminate()` + a grace period, or a process-group kill **Refined by the PR #82 reviewer (2026-09-17):** the starvation trigger is AMBIENT machine load, not specifically a concurrent mutation gate. Its first post-gate run still cascaded with no gate running, against a ~3.5 baseline load from `openclaw-gateway` at 146% CPU; a later run on the same code was 76/77. The cascade's signature is failures at ~0.09ms - instant `Runtime.evaluate` rejections against an already-dead shared CDP session, not 68 independent timeouts - so ONE dead session cascades through every later test in the file. The shared-session fragility is the defect; load is only what exposes it. Do not read a quiet-machine pass as a refutation. | Stage 4 sweep | OPEN |
| 70 | **S4-N1: the AC3 test is satisfiable by the exact failure mode it is named for.** `tests/app.test.js:1771-1790` regexes the raw file text, so it cannot tell markup from a comment: burying the sentence in `<!-- ... -->` - nothing renders, the owner's question goes unanswered - leaves the test named *"the LAYOUT group explains itself on the page, not only in a comment"* passing. Shipped code is correct, so not blocking. Fix: also assert the booted DOM's `textContent` for `#scale-layout-hint`, keeping the file read (which exists to stop the sandbox conjuring the element) | reviewer PR #80 | RESOLVED (`f086acb`: the unit test strips HTML comments first - the failure it is named for - and a new e2e test measures the rendered box) |
| 71 | S4-N2: `.sheethint{display:none}` survives the entire suite - app.test.js 128/128 and full e2e 76/76. Nothing asserts the hint actually renders | reviewer PR #80 | RESOLVED (`f086acb`: e2e `the LAYOUT hint is visible inside the group` asserts a non-zero box, not visibility:hidden, not opacity:0; mutant `e_layout_hint_not_drawn`) |
| 72 | S4-N3: the AC3 test does not bind the `<p>` to `#scale-layout-row`; moving the paragraph to just before `</body>` survives, and the row's `hidden` check passes independently of where the paragraph lives | reviewer PR #80 | RESOLVED (`f086acb`: the e2e test asserts `#scale-layout-row` contains the hint; mutant `e_layout_hint_outside_its_group`) |
| 73 | S4-N4: the new harness test `an e2e mutant is skipped for its suite, not for its filename` has NO mutant, against `mutation_check.sh`'s own opening line "Every test group must have a mutant that kills it." The reviewer's M1 (revert the guard to `case "$base" in e_*)`) is exactly the missing patch and was confirmed killed | reviewer PR #80 | RESOLVED (`f086acb`: `tests/mutants/d_e2e_mutant_skipped_by_filename.patch`) |
| 74 | S4-N5: stale comment at `tests/mutation_harness.test.js:120-124` still states "A patch with an `e_` name takes the no-browser skip branch" - the name-keyed mechanism this branch removed, sitting in the same file as the test that denies it | reviewer PR #80 | RESOLVED (`f086acb`) |
| 75 | S4-N6: `tests/CONTRACT.md:30` is 129 chars; every other line in that block is <=79 | reviewer PR #80 | RESOLVED (`f086acb`) |
| 76 | S4-N7: `tests/mutants/c_name_outgrows_its_field.patch` is the corpus's only whole-file `# suite:` header (`node --test tests/layout.test.js`). Pre-existing, but `mutation_check.sh`'s own comment says a whole-file header is a review finding, so it is filed as one | reviewer PR #80 | RESOLVED (PR #84, `293139d`): header narrowed to `--test-name-pattern ^every.name.the.app.draws.fits.inside.the.field.it.labels$`, the test its own `# kills:` line named. Green clean at that pattern, red mutated. The corpus now has no whole-file header |
| 77 | S4-N8: `docs/plans/2026-09-16-scale-page-ux.md:322` still lists Stage 4's **Files:** as `tests/mutants/`, `docs/`, `TODOS.md`, which does not cover the `index.html` / `tests/*.test.js` / `CONTRACT.md` edits Stage 4 actually made. The edits were sanctioned by the ownership row; the plan line is just stale | reviewer PR #80 | RESOLVED (the Stage 4 **Files:** line now names every file the stage touched) |
| 78 | **S4-N9: the new e2e hint oracle has three blind spots.** Three mutants SURVIVE `the LAYOUT hint is visible inside the group, not merely present in the file`: `.sheethint{position:absolute;left:-9999px}`, `.sheethint{color:transparent}`, and `#scale-layout-row{max-height:0;overflow:hidden}` (an ancestor clip is invisible to `getBoundingClientRect()`, which reports the child's laid-out box regardless). Controls passed - `font-size:0` and dropping `aria-describedby` both died - so the oracle has teeth, and both regressions observed in the wild (`display:none`, hoisting out of the group) are closed. The off-screen one is worth acting on: a `.sr-only` utility (`width:1px;height:1px;position:absolute`) passes every current check and is a plausible future edit. Fix: hit-test the hint's own centre with `document.elementFromPoint` - off-screen returns `null`, clipped returns the ancestor - which closes the 1st and 3rd together in one line. `color:transparent` needs a contrast comparison and is probably not worth it | reviewer PR #82 | RESOLVED in part (PR #84, `b7b4ce0`+`293139d`): the oracle now scrolls the hint into view and asserts the box that survives every clipping ancestor and the viewport, and two mutants pin it - `e_layout_hint_pushed_off_screen` (`0x0`) and `e_layout_hint_clipped_by_its_row` (`336x0`). `color:transparent` stays OPEN by owner decision: it needs contrast maths and is not a plausible edit |
| 79 | S4-N10: `tests/mutants/d_e2e_mutant_skipped_by_filename.patch`'s `# kills:` prose says the mutant is "scored SURVIVED", but the fixture repo has no `tests/e2e.test.js`, so the mutated script ABORTS the sweep on a non-green baseline instead. The kill is real and lands on the test's first named assertion, so AC3 stands - but `assert.doesNotMatch(out, /survived/)` is vacuous in that fixture, since nothing there could ever print `survived`. Fix: one sentence in the header distinguishing the real-corpus defect from the fixture's path, so the next reader does not conclude the `survived` branch is covered | reviewer PR #82 | RESOLVED (PR #84, `293139d`): the header now states that the SURVIVED verdict is the real-corpus defect, that the fixture aborts on a non-green baseline instead, and that the companion `assert.doesNotMatch(out, /survived/)` is vacuous there |
| 80 | S4-N11: naming - `d_e2e_mutant_skipped_by_filename.patch` targets `tests/mutation_harness.test.js`, whose three pre-existing mutants all use the `h_` prefix; `d_` reads as `tests/app.test.js` (92 of the 96 `d_` patches). Cosmetic only: `suite_for()` is `grep -m1 '^# suite:'`, so the header alone selects the suite and the stray `tests/e2e.test.js` in the patch body cannot leak into selection | reviewer PR #82 | RESOLVED (PR #84, `293139d`): renamed `d_` -> `h_` via `git mv`; 15 `h_` siblings now |
| 81 | S4-N12: the visible-box oracle at `tests/e2e.test.js:2748` does not see an ancestor `opacity:0`. `opacity` is not inherited and changes neither `getBoundingClientRect()` nor the clipping intersection, so `#scale-layout-row{gap:var(--sp-2); opacity:0}` renders the hint unreadable and SURVIVES (reproduced by the PR #84 reviewer). The neighbouring vector is already covered: `visibility:hidden` on the same ancestor dies, because `visibility` IS inherited. Traces to correct shipped code - no such rule exists in `index.html` - and sits outside what row 78 asked for, hence a nit. Fix: multiply computed `opacity` up the ancestor chain inside the same loop that intersects the rects, and fold it into the same assertion | reviewer PR #84 | OPEN |
| 82 | **The keyboard test was blind twice over.** The e2e test that was supposed to protect the seed field under a soft keyboard passed on the shipped markup that the owner photographed failing. Two independent reasons: it measured containment in the VIEWPORT rather than in `.sheetbody`, the scroll container that actually clips the field; and it raised the keyboard with `b.setViewport(w,h,true)`, which shrinks `window.innerHeight` as well as `visualViewport.height`, so `kbCap(innerHeight, vvHeight)` was never exercised on the difference it exists to handle. The harness geometry (380x800, vv 508) was also roomier than the owner's phone. Replaced with a stub that redefines `visualViewport.height` and dispatches `resize` (verified to reach `applyKbOffset()`), an oracle that clips the box rect by `.sheetbody`'s rect, and a sweep at 390x745 with 336/365/395px keyboards. It fails on the pre-fix markup with the owner's own symptom: `only 12.0px of the 48.0px seed box survives the sheet's own scroller` | lane S5 | RESOLVED (`d644491`) |
| 83 | **The swatches and the mirror toggle lost their reachable-without-scrolling guarantee.** Owner instruction 2026-09-17: "only generate cards button should be part of the bottom drawer. As of current design the keyboard pushes the bottom drawer up and covers the input field." `.sheetbody`'s closing `</div>` moved below the `.ctlrow`, so only `#scale-generate` (and the Edit-only delete row) stay pinned. A pinned row is not free: `.sheetbody` SHRINKS to make room for it, and under a 336px iOS keyboard the Edit page had a 12px scrollport for a 48px seed field; in the scroll it has 159px. The trade is explicit and the owner chose it. DOM order is unchanged. Both directions are pinned by mutants: `e_sheet_ctlrow_pinned_again.patch` (move it back up) and `e_sheet_primary_back_in_the_scroll.patch` (move it down past the primary) | owner | RESOLVED (`d644491`) |
| 84 | **DELETE takes a confirmation.** Owner instruction 2026-09-17: "Delete cards should require a confirmation." A second tap on the SAME control rather than a dialog - the pinned footer is one row for the reason row 83 gives, a dialog would cost it height, and Escape (which closes the page) must not be able to dismiss a confirmation. The label carries the state (`DELETE THIS DECK` -> `TAP AGAIN TO DELETE`, amber `#e3b25c`), `setSheetMode()` disarms on every open and a `pointerdown` listener on the sheet disarms on the next tap anywhere else (`index.html:4969`), with `delBtn.onblur` as the keyboard-path backstop, so a confirmation never outlives the tap that gave it. (As shipped in `d644491` the only disarm-on-leaving was `onblur`; the pointerdown listener came later - see row 89.) Two new app tests and two mutants (`d_delete_skips_the_confirmation`, `d_delete_stays_armed_across_visits`) | owner | RESOLVED (`d644491`) |
| 85 | **The edit script that landed `d644491` corrupted the head of `index.html`.** It inserted the new `.sheetbody` comment block at offset 0 instead of at the `.ctlrow`, so the committed file opened with 23 lines of comment jammed onto `<!DOCTYPE html>`, and the stale "Outside .sheetbody, with the primary" comment it was meant to replace was still above the row. The markup fix itself was correct, which is why every suite and `validate.py` passed over it - no check in this repo reads the first line of `index.html`. Found only because the generated mutant's first hunk came out as `@@ -1,3 +1,4 @@` | lane S5 | RESOLVED (`0f62bbc`) |
| 86 | **The reviewer's deferred nits on PR #86.** N3: `updateParse()` blanks the arming warning, so typing in the seed clears the "tap again" copy while the button stays armed (the label still carries the state, so this is copy, not safety - and the pointerdown disarm now clears the arm on that same tap). N4: a HELD Enter on a focused DELETE auto-repeats, so one gesture arms and confirms - keyboard-only. N6 RESOLVED (lane S6, `6e39ce2`) as an EQUIVALENT MUTANT: no state the app can enter delivers a click there with `editingId` null, so deleting the guard survives the suite and no legitimate test can kill it. `delRow` carries `hidden` whenever `setSheetMode()` has run for a null `editingId`, and `[hidden]{display:none !important}` beats `.editrow{display:flex}`. The correspondence is not exact - `hideSheet()` sets `editingId = null` at `index.html:4794` without calling `setSheetMode`, so there is a window where `delRow` lacks `hidden` - but in that window the ancestor `#scale-sheet` is itself `hidden`, so the button is still unclickable and the conclusion holds. Reasoning recorded at the guard itself so the nit is not refiled. N7: `disarmDelete()` would be a TDZ error if `setSheetMode` ever became reachable before the delete block runs at boot. N9 RESOLVED (lane S6, `6e39ce2`), and the row's "three" was wrong: a per-file sweep against `git rev-parse HEAD:<path>` found **250 of 250** stale. The header is inherently unmaintainable rather than drifted - `git diff` stamps the blob the patch was CUT from, and every commit touching a mutated file rewrites it, so a re-cut patch is stale one commit later. Nothing reads it (`mutation_check.sh` applies with plain `git apply` and reverts with `git apply -R`; neither resolves a blob by hash), so the line was STRIPPED corpus-wide, `tools/regen_data_mutants.py` now strips it on generation, and `tests/mutation_harness.test.js` pins that it stays gone. N3/N4/N7/N10 remain open. N10: PR #86 carries S4's commit `4d4dddc`, which is also PR #85's head | lane S5 | OPEN |
| 87 | **`applyKbOffset()` never consults `vv.scale`.** A pinch-zoom shrinks `visualViewport.height` exactly the way a soft keyboard does, so the sheet translates up and caps its height for a user who is only zooming in to read. Out of scope for the S5 lane; the fix is to skip the offset when `vv.scale > 1` | reviewer, PR #86 | RESOLVED (lane S6, `a434058`, corrected in the same lane after review): while `vv.scale > 1.01` the page makes NO claim - BOTH the lift and the cap are cleared, and panning is the reader's. The first attempt tried arithmetic instead (`Math.round(vv.height * vv.scale)` and the same on `vv.offsetTop`) and was wrong: `offsetTop` is already in layout px, so the lift decayed to zero as the reader panned while the cap went on insisting a keyboard was there. No arithmetic gets both halves right - a surface laid out at 100dvh is taller than the screen the moment the page is zoomed, so "stay above the keyboard" and "leave the zoom alone" are not simultaneously satisfiable. The hands-off policy is safe only because `#scale-box`, `#scale-name` and `#scale-degrees` pin 16px (`index.html:460,583,584`), so iOS never auto-zooms a focused input and every `scale > 1` is two deliberate fingers. Pinned by `e_kb_zoom_reads_as_a_keyboard` |
| 88 | **`hideSheet()` clears `transform` but not `maxHeight`.** A sheet closed while the keyboard was up keeps the capped height it was given, so the next open is short until the next `applyKbOffset()` fires. Out of scope for the S5 lane | reviewer, PR #86 | RESOLVED (lane S6, `420400e`): teardown is now symmetric, gated on `sheetOpen`, and pinned by `e_kb_cap_outlives_the_sheet`. Same fix as row 55 |
| 89 | **Row 84 describes a mechanism that is no longer the mechanism.** It still says the confirmation disarms "on leaving the button (blur)". That was true of `d644491` and is a fair historical record of it, but a reader looking for how DELETE disarms today will find the wrong answer there and the right one only in row 86. Cosmetic; fix when the cycle's rows are archived | lane S5 | RESOLVED (lane S6): row 84 now names the `sheet` `pointerdown` listener as today's mechanism, keeps `onblur` as the keyboard backstop, and marks the blur-only description as what `d644491` shipped |
| 90 | **The footer's breathing room halved in portrait as a side effect of moving the hairline.** The rule used to sit AFTER `.sheetsurf`'s gap (`[body][gap][RULE][padding][button]`) and now sits on the scrollport's own edge (`[body][RULE][gap][button]`), so body-to-primary separation went from `2 x --sp-4` to `1 x --sp-4`. The landscape half of this is stated in the comment at `index.html:517-521`; the portrait half is not, and no test pins the spacing. Needs an owner glance rather than a fix - it may well be what the footer should look like | reviewer, PR #86 | OPEN |
| 91 | **Cancelling an armed DELETE over a rejected seed leaves the page red with nothing saying why.** `disarmDelete()` blanks `#scale-msg`, but `#scale-box` keeps `.bad` and GENERATE stays disabled, so the owner sees a red outline and a dead button until the next keystroke re-parses. `#scale-parse` survives, so it is narrow. A disarm could restore the last parse message rather than clearing unconditionally | reviewer, PR #86 | OPEN |
| 92 | **`README.md` is out of date** (owner instruction, 2026-09-17). It still describes the repo before the scale engine, the generated `const DECKS` line, the engine inline regions, the 2026-08 restyle's current deck sizes (Hijaz 19 / Pygmy 52 / Amara 25) and the user-configurable-scale page. Needs a drafted plan first, then the rewrite - `/plan-eng-review` before execution, per the owner's standing planning rule. Not this lane's: `README.md` is owned by no S-lane and the rewrite spans the whole repo's story | owner, 2026-09-17 | RESOLVED (PR #88): `README.md:7-13` documents the engine sync step, `:17-18` the current 19/52/25 (96 total) deck sizes, `:24-30` all six engine modules, `:41-51` the scale page and localStorage persistence, and `:89-93` the engine test suites. `tests/test_readme_currency.py` now guards the counts and module list against drift |
| 93 | **The hands-off-under-zoom policy has never been checked on a device.** Row 87's resolution is deliberate: while `vv.scale > 1.01` the sheet neither lifts nor caps, so a reader who pinch-zooms and THEN focuses the seed input gets a keyboard with no lift and no cap and has to pan. That is the trade the policy makes, and it is the right one on the arithmetic, but no one has watched it happen. Add it to the outstanding iPhone 14 / iOS 26.6 pass alongside rows 51 and 67 | reviewer, PR #87 (re-review nit N5) | OPEN |
| 94 | **`docs/plans/2026-09-18-keyboard-wiring-coverage.md` still argues for the overturned arithmetic below its banner.** The file now opens with a READ-FIRST supersession note and its Task 2 block carries the full correction, but roughly a dozen later lines (79, 229, 237, 296, 412-413, 423-424, 480-481, 545-547, 595, 604-607) still present `vv.height * vv.scale` as the chosen fix and the `vv.scale` branch as rejected. Left as history rather than rewritten line by line, because the document is a record of what the lane planned and the banner is what a reader meets first. Rewrite or archive it when the scale-page work closes | reviewer, PR #87 (re-review nit N1) | RESOLVED: each of the file's 7 live occurrences of `vv.height * vv.scale` (a code comment, a failure-modes table, a plan task, and an outside-voice finding) now carries its own SUPERSEDED note pointing at the READ FIRST banner and `c7098df`, matching the treatment `docs/plans/2026-09-18-readme-refresh.md` gave its own superseded sketch. The arithmetic itself is left unrewritten so the record of what was overturned survives |
| 95 | **The app sets no `overscroll-behavior-x` on its root, so a horizontal drag on the card can trigger browser history navigation instead of stepping the deck.** Found by PR #89's swipe coverage: a 120px rightward drag made headless Chromium navigate back and the document vanished mid-test. **Android Chrome is the real-device exposure, not iOS** - WKWebView's back gesture fires only from a screen EDGE swipe, while Chrome's overscroll gesture fires from a centre drag, which is exactly where a thumb lands on the card. The app cannot fix this from JS: both touch listeners are `{ passive: true }` (`index.html:5085-5086`), so `preventDefault()` is unavailable. The only fix is CSS `overscroll-behavior-x:contain` on the root - today it appears only on `.decks` (`index.html:108`) and the sheet (`:414`, `:452`). PR #89 suppressed the gesture in the test harness only (`tests/helpers/cdp.js` launch flags), which the reviewer confirmed masks a headless-Chromium artifact rather than the device bug; the app-side change was left out as a behaviour change outside that lane's non-goals. Needs an owner call: is a card swipe on Android Chrome meant to be safe from back-navigation? | PR #89 reviewer nit 1 | OPEN |
| 96 | **`tests/helpers/cdp.js`'s overscroll flag comment cross-references no follow-up row.** A reader of `cdp.js` alone cannot tell that an app-side question (row 95) is open, so the flag reads as settled rather than as half of a split decision. One comment line. PR #89 reviewer nit 2. | PR #89 reviewer nit 2 | RESOLVED: the comment above the `--disable-features=OverscrollHistoryNavigation,...` flag in `tests/helpers/cdp.js` now cross-references row 95 directly |
| 97 | **PR #89's overscroll flag is global to all 88 e2e tests rather than scoped to the three that need it.** Harmless today - no other test dispatches a horizontal touch drag - but it silently covers future tests too, so a later test that WOULD have caught an overscroll regression will not. Either scope the flag to the swipe tests or assert in the suite that nothing else drags horizontally. PR #89 reviewer nit 3. | PR #89 reviewer nit 3 | CLOSED, won't-fix-documented: both proposed guards were rejected. A suite-level assertion counting `swipe()` callers is churn - `grep -c "b.swipe(" tests/e2e.test.js` is already 7, not the 3 this row assumed, so the count drifts on every legitimate new swipe test, and it still would not catch a test that drags horizontally by some path other than `swipe()`. Scoping the flag per-test costs a browser launch per test, which is exactly the cost the shared CDP session exists to avoid. The comment in `tests/helpers/cdp.js` now records both the global scope and this row's closure inline (see row 96) |
| 98 | Orphan `hpfc-prof-*` profile directories accumulate in tmpdir. Owner is `tests/helpers/cdp.js`, which already has cleanup machinery at `:42`. Split out of row 69 during review because an age-based sweep from `tests/suite_health.py` can delete a concurrently running suite's live profile | review of row 69 | OPEN |
| 99 | **`tools/regen_data_mutants.py` is assigned to W1 but was edited by W5.** Surfaced by correcting the W5 ownership row (row 50): `git diff --name-status e872a49^1 e872a49` lists the file under W5's merge, while the Ownership table gives it to W1. Both lanes are merged, so there is no live conflict to resolve - the risk is forward-looking. A future deck-data lane reads the table, sees the regeneration tool belongs to another lane, skips it, and ships a deck change with stale data mutants still anchored on the old `DECKS` line; `tests/mutation_check.sh` counts a patch that no longer applies as a SURVIVOR, so the gate goes quiet rather than red. CLAUDE.md's print-pipeline section names the regeneration step explicitly. Needs a single owner assigned, or an explicit note that the tool is shared and must be re-run by whoever touches `data/decks.json` | reviewer PR #91 | OPEN |

## Cycle state

Cycle: 2   Wave: 3   Merged this batch: `4a06641` (W1, PR #71), `7329033` (W2, PR #73), `bc9980a` (W3, PR #72), `e872a49` (W5, PR #75), `eeb7329` (S3, PR #79), `43d83ce` (S4, PR #80), `339838b` (S4 nitfix, PR #82), `4b9b03b` (S4 nits2, PR #83), `916d502` (S4 oracle, PR #84), `8733493` (S5, PR #86). The W-numbered wave is finished except W4/W6; the live work is the serially numbered scale-page lanes, now at S6.

**S5 (`scale-page/s5-keyboard-footer`, PR #86) merged 2026-09-17 as `8733493`.** It carried the owner's two instructions of that day - only GENERATE CARDS stays in the pinned drawer (queue row 83) and DELETE takes a confirmation (row 84) - plus the finding that the keyboard e2e test had been blind twice over (row 82) and the head-of-file corruption its first edit script caused (row 85). Independent reviewer PASS_WITH_NITS at `40ae8af`, CI 5/5 green at that exact SHA, `MERGEABLE`; its nits are rows 86-91.

**PR #85 (`scale-page/s4-rows`, head `4d4dddc`) is MERGED, not abandoned.** That commit rode into main inside PR #86's branch, so GitHub closed #85 as merged once `4d4dddc` became an ancestor of main at `8733493`. It is also why row 86's N10 exists: one commit was the head of two open PRs at once.

**S6 (`scale-page/s6-kb-wiring`, this lane) is in flight.** It closes rows 54, 55, 87, 88, 89 and the N6/N9 halves of row 86: a CDP seam that can drive a shrunken visual viewport (`3ab5e17`), a zoom fix for row 87 (`a434058`, overturned in review and replaced by the hands-off-under-zoom policy in `c7098df`), symmetric `hideSheet` teardown behind a `sheetOpen` gate (`420400e`), the four wiring mutants row 54 asked for, and a corpus-wide strip of the unmaintainable `index <blob>..<blob>` patch headers (`6e39ce2`). Delivered as PR #87; CI green at `c754ce2` and again at the head recorded in Cycle state, one review FAIL (attempt 1) fixed in `c7098df`, then PASS_WITH_NITS on re-review. The nits it left open are rows 93 and 94.

| Lane | Worktree | Branch | PR | Head SHA | Verified@ | Verdict | Attempts | Merged | Blocked on | Retained |
|---|---|---|---|---|---|---|---|---|---|---|
| W1 | released | `nits/sync-decks-hardening` | #71 | `c8e603e` | 2026-09-16 CI 5/5 pass | PASS_WITH_NITS | 0 | yes `4a06641` | - | no |
| W2 | released | `print/blurb-and-border` (deleted) | #73 | `bbb9545` | 2026-09-16 CI 5/5 pass | PASS_WITH_NITS | 0 | `7329033` | - | no |
| W3 | released | `app/print-button` (deleted) | #72 | `f6242cd` | 2026-09-16 CI 5/5 pass at `f6242cd` | PASS_WITH_NITS | 1 | yes `bc9980a` | - | no |
| W4 | harness (unreachable) | `mobile/audit-pass-1` | #74 | `d8866d5` | 2026-09-16 CI 5/5 pass at `d8866d5` | PASS_WITH_NITS (0 blocking, 6 nits, 0 boundary violations) | 1 | no | **owner iPhone 14 / iOS 26.6 device check** | yes |
| W4 (2nd) | integrator (lane gone) | `mobile/audit-pass-1` | #74 | `2ec374d` | 2026-09-16 CI 5/5 pass at `2ec374d` (run 35173383440, `matches_reviewed_sha: true`) | PASS_WITH_NITS (0 blocking, 0 boundary violations; 10 mutants spent, 4 survived - all one wiring gap, rows 54-58) | 2 | no | **owner iPhone 14 / iOS 26.6 device check, EDIT sheet included** | yes |
| W5 | released | `engine/adopt-generated-decks` (deleted) | #75 | `d2c06b6` | 2026-09-16 CI 5/5 pass at `d2c06b6` | PASS_WITH_NITS | 1 | yes `e872a49` | - | no |
| W6 | - | `mobile/audit-pass-2` | - | - | - | - | 0 | no | W4 merge (W2 done) | - |
| S3 | released | `scale-page/s3-layout-on-pan` (deleted) | #79 | `71ab7d3` | 2026-09-17 CI 5/5 pass at `71ab7d3` (run 35264003719, mutation gate 288/288) | PASS_WITH_NITS (0 blocking, 0 boundary violations; 8 mutants spent, 2 survived, rows 59-66) | 0 | yes `eeb7329` | - | no |
| S4 | released | `scale-page/s4-sweep` | #80 | `fa1f647` | 2026-09-17 CI 5/5 pass at `fa1f647` | PASS_WITH_NITS (0 blocking, 0 boundary violations; 4 mutants spent, 3 survived, rows 70-73) | 0 | yes `43d83ce` | - | no |
| S4 (nitfix) | released | `scale-page/s4-nitfix` (deleted) | #82 | `2a43240` | 2026-09-17 CI 5/5 pass at `2a43240` | PASS_WITH_NITS (0 blocking, 3 nits -> rows 78-80) | 0 | yes `339838b` | - | no |
| S4 (oracle) | released | `scale-page/s4-oracle` | #84 | `293139d` | 2026-09-17 CI 5/5 pass at `293139d` | PASS_WITH_NITS (0 blocking, 1 nit -> row 81) | 0 | yes `916d502` | - | no |
| S4 (rows) | released | `scale-page/s4-rows` (deleted) | #85 | `4d4dddc` | 2026-09-17 CI 5/5 pass at `4d4dddc` | n/a (doc-only) | 0 | yes - closed MERGED when `4d4dddc` landed inside PR #86 at `8733493` | - | no |
| S5 | released | `scale-page/s5-keyboard-footer` | #86 | `40ae8af` | 2026-09-17 CI 5/5 pass at `40ae8af`, `MERGEABLE` | PASS_WITH_NITS (0 blocking; nits -> rows 86-91) | 0 | yes `8733493` | - | no |
| S6 | `.claude/worktrees/s4` (released) | `scale-page/s6-kb-wiring` (deleted) | #87, merged as `11ecbd2` | `289f93a` | 2026-09-18, all 5 checks SUCCESS at `289f93a` (data integrity, python suites, js suites, suite health, mutation gate) | FAIL at `051d97b` (attempt 1: `vv.offsetTop * vv.scale` scaled a term already in layout px, so the lift and the cap disagreed once the reader panned), fixed in `c7098df`; PASS_WITH_NITS at `c754ce2` from a fresh reviewer, 0 blocking findings, 0 boundary violations, 5 nits. N1-N4 closed in `289f93a` (comments, docs and one test assertion only, no behaviour change, landed AFTER the reviewed SHA); N5 filed as row 93, N1's remaining plan-doc references as row 94 | 1 | yes | - | no, worktree released |

Wave 1 spawned 2026-09-16 off `main` @ `839d70e` (the doc commit; base content
identical to `28117a8`). Agent IDs are held in the integrator session only.
Merge order stands: W1, then W2, then W3/W4 - and W4 only after the owner's
iPhone 14 / iOS 26.6 device check, never on CI alone.

**Scale-page Stage 3 (`scale-page/s3-layout-on-pan`, PR #79) merged 2026-09-17 as
`eeb7329`**, one serial lane outside the W-numbering: the Edit page's pan became the
correction surface (owner decisions D1 tap-the-note, D2 rotate-the-selected-zone,
D3 real URL route, D4 mock-only-commit-on-save). Two commits - `29f7b2f` (the
feature) and `71ab7d3` (24 mutant patches re-anchored, 2 retired, 2 added; corpus
still 288). CI 5/5 green at the reviewed SHA with a complete 288/288 mutation
sweep. Independent reviewer returned PASS_WITH_NITS; nits are queue rows 59-66,
and row 67 carries the AC5 device half that no automated harness can reach.
Worktree and branch swept.

**Scale-page Stage 4 (`scale-page/s4-sweep`, PR #80) merged 2026-09-17 as `43d83ce`.**
Three commits on top of Stage 3's follow-ups: `23dc65a` (the mutation gate now skips e2e
mutants by the `# suite:` command they name, not by their filename), `be726ef` (the
no-suite-header mutant re-anchored after that guard moved), `fa1f647` (rows 59-66 closed,
rows 68-69 filed). The defect it closed: a self-skipping suite exits 0, which is
indistinguishable from a surviving mutant - `d_page_background_still_announced.patch` named
`tests/e2e.test.js` but carried a `d_` prefix, so the basename-keyed skip let it through and
the gate scored a browserless self-skip as SURVIVED. Corpus is 291 patches and the sweep now
evaluates all 74 e2e mutants instead of skipping them: 291/291 killed, zero skipped. CI 5/5
green at `fa1f647`; independent reviewer PASS_WITH_NITS with AC1/AC2/AC3 each re-derived
rather than taken on trust. Nits are queue rows 70-77; 70-75 and 77 are closed on `scale-page/s4-nitfix`,
which gives the AC3 hint an oracle that can actually see it (the unit test strips
HTML comments; a new e2e test measures the rendered box, its containment in
`#scale-layout-row` and its `aria-describedby` wiring) and adds the four missing
mutants - corpus 291 -> 295, all killed. Rows 68, 69 and 76 stay open.
Row 67 (the owner's iPhone 14 /
iOS 26.6 check of BOTH the ADD and EDIT pages with the keyboard up) is still the only thing
no automated harness can settle.

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
