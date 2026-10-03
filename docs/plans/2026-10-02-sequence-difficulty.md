# Sequence difficulty tiers

- **Goal:** after the lanes below merge, `HPE.sequence.pick` deals BASIC, INTERMEDIATE or ADVANCED chord progressions per the tier rules on every deck, generated decks included, and the settings panel shows an always-visible DIFFICULTY selector that is live in CHORD PROGRESSION mode and greyed out and inert in every other mode. BASIC deals exactly what it deals today.
- **Date:** 2026-10-02
- **Base:** `main` @ `61b01c2` (merge of PR #200). Every file:line below was read at that SHA.
- **Shape:** /swarm, two lanes, serialised: D1 (engine) then D2 (app region of `index.html`). D2 spawns when D1 merges. **Amended 2026-10-02:** a follow-up lane D3 (engine hardening, §9) spawns only after D2 merges - D2 and D3 both refresh `tests/mutants/`, so running them in parallel would conflict there.
- **Spec (binding):** Part 2 "Tier rules" and "Score axes" of the Pygmy Progression Tiers doc, https://claude.ai/code/artifact/f14b7860-bf38-4c6d-b579-f54f9535b405 (rev 56). Parts 3a/3b (I1-I8, A1-A6) and the Hijaz/Amara examples are the golden fixtures.
- **Prompt:** scratchpad `difficulty-plan-prompt.md` (session-local; its content is restated here in full).
- **Related:** `docs/plans/2026-09-29-chord-sequence-mode.md` (the mode this extends; its N20-N28 carry over except where §1 amends them).

## §1 Goal and non-goals

**Why.** In the owner's words: "a newer player may not know how to string the different chords together". BASIC solves that for a first session. A player who has BASIC down has nowhere to go; the tiers give them a next step without curating per-deck lists.

**Non-goals.** N1-N10, N13, N15-N19 and N20-N26, N28 from the chord-sequence plan carry over unchanged. N27 ("the player cannot choose length or style") is amended: the player now chooses a tier, which sets the length range; length and style are still drawn.

| # | Non-goal | Not precluded because |
|---|---|---|
| N29 | No change to `data/decks.json`, the `const DECKS` line, diagram geometry or card anatomy | - |
| N30 | No reach axis (owner decision 2026-10-02) | The scorer is a test helper; a later axis adds a column there |
| N31 | No curated per-deck progression lists, no degree templates (rejected in the sequence-mode plan §2 because they fail on generated decks) | - |
| N32 | No change to BASIC's output: same candidates, same draw, same rng consumption | - |
| N33 | No score shipped in the engine. Tier gates only (D-5) | The scorer lives in the test helper and can be promoted |
| N34 | No tier in the share URL (D-7) | The share format is versioned; a later field is additive |
| N35 | No change to the seven playing styles or their copy | - |
| N36 | No print change | - |

## §2 Findings (measured at 61b01c2)

1. **`connects` barely constrains on a real pan.** Average out-degree of the connect graph: Pygmy 47.8 of 51, Hijaz 17.5 of 18, Amara 23.3 of 24. Scale-mates nearly always share a pitch class. Tier rules, not connection, are what shape the space.
2. **Candidate space** (exhaustive DFS, `scratchpad/space.js`): BASIC 36 / 23 / 16 (Pygmy / Hijaz / Amara). INTERMEDIATE 43,450 / 5,005 / 8,810. ADVANCED length-4 alone 5.4M / 95k / 302k; length-6 estimated 1.3e10 on Pygmy. Full enumeration of ADVANCED is ruled out. INTERMEDIATE is enumerable in principle (pool 30 on Pygmy) but would need its own code path; one sampler for both tiers is simpler.
3. **Rejection-sampling acceptance** (uniform independent draws from the tier's pool, start drawn from the tier's start set, accepted iff the tier classifier says exactly that tier and every pair including the wrap connects; `scratchpad/accept.js`, 20k draws per cell):

   | Deck | I3 | I4 | A4 | A5 | A6 |
   |---|---|---|---|---|---|
   | Pygmy | 54% | 30% | 80% | 76% | 73% |
   | Hijaz | 44% | 18% | 87% | 88% | 86% |
   | Amara | 41% | 16% | 88% | 87% | 85% |

   The worst built-in cell is 16%; 64 attempts fail with probability 0.84^64 < 1.5e-5, 512 attempts < 1e-38.
4. **LOW/HIGH exists only on Pygmy, only in `subtitle`** ("- LOW VOICING" / "- HIGH VOICING"): HIGH cards 10, 11, 13, 14, 18, 19, 27, 30, 33; LOW cards 26, 29, 32, 35, 37, 39, 41, 43, 45, 48, 50, 52. Generated decks get subtitles from `HPE.select.build`; grep the builder for whether it ever emits a register qualifier (D1 step 1 records the answer).
5. **App seams:**
   - `index.html:6819` `seq = HPE.sequence.pick(deck(), Math.random, seq && seq.chords);` is the single call site.
   - `index.html:6019` reads `store.mode`; `index.html:6047-6057` `save()` read-modify-writes `hpfc`; the tier is one more key there.
   - `index.html:8075-8106` `setMode()` toggles `.on`/`aria-pressed` and `#panel-seq-note.hidden`; the selector's enabled state hangs off the same function.
   - `index.html:6684` `renderSeqEmpty()` has one message for both reasons; a tier-empty deck needs its own wording.
   - `index.html:6706` `renderSeqRail()` was sized for 2-3 names; ADVANCED deals up to 6, e.g. `Fm9 → Bb7sus4 → Bbm7 → Gm7b5 → C7sus4 → Cm7`.
   - Disabled-control precedent: `.prints button:disabled{opacity:.5; cursor:default}` (`index.html:526`), `#scale-generate:disabled` (`:862`). The panel's Tab trap already filters `!el.disabled` (`:7933`, `:8008`).
6. **Label widths** (Nunito Sans SemiBold 10.5px, .08em tracking, `.mode` padding + border; fontTools against `tools/fonts/`): BASIC 59.5px, ADVANCED 90.4px, INTERMEDIATE 110.6px. A three-across row needs ≥ 3 x 110.6 + 2 gaps ≈ 348px of content. The mobile panel at 380px gives 352px (fits, barely); the 240px desktop sidebar gives 200px (does not fit).

## §3 Decisions

Each decision records the AFK auto-pick and why. "Owner" marks decisions already made by the owner.

- **D-0 (owner, 2026-10-02).** Reach excluded; Q and F redefined as in Part 2; nested allowance tiers replace score gates. The selector is always visible and greyed out outside CHORD PROGRESSION.
- **D-1 API.** `pick(deck, rng, prev, tier)` with `tier` in `"basic" | "intermediate" | "advanced"`; `undefined` means `"basic"`; any other value throws `Error("HPE.sequence.pick: unknown tier")`. The BASIC branch is today's code path untouched, so `pick(deck, rng, prev)` and `pick(deck, rng, prev, "basic")` are byte-identical in output and rng consumption. Also export `TIERS` (the three ids, in order) and `tierOf(deck, chords)` (the classifier) for the app's tests and for D2's guard. *Why:* backward compatible, and the existing seeded tests and `sq_*` mutants keep pinning BASIC.
- **D-2 Generation.** INTERMEDIATE and ADVANCED use uniform rejection sampling. The length is drawn ONCE, before sampling, per D-3, and stays fixed for all attempts and the fallback (eng E-2). Per attempt: a start uniformly from the tier's start set, then each later position uniformly from the tier's pool; accept iff `tierOf` returns this tier, every consecutive pair and the wrap connect, and the result is not `prev`. Cap 512 attempts. `pick` builds an n x n connect matrix once per call (Pygmy: 2,704 `connects` calls, ~1.6 ms measured) and both the sampler and the fallback read it; raw `connects` costs ~0.6 µs a call, so 200k uncached calls measured 115 ms (eng E-1). *Why:* independent uniform draws accepted by a predicate are exactly uniform over the accepted set within a length (unlike a greedy walk, which biases toward high-degree cards), deterministic under a seeded rng, and §2.3 shows the cap is unreachable on built-ins. **Fallback on cap exhaustion:** bounded exhaustive DFS over the tier's space with a node budget of 15,000 (`DFS_NODE_BUDGET`, `src/engine/sequence.js:52`; this plan first said 200,000 - PR #202's perf review cut it after measuring, see §9 item (d)); a COMPLETE search draws uniformly from what it found, or reports the length empty; a search that hits the budget draws uniformly from what it found so far (traversal-order bias accepted: it is reachable only off the built-ins, after 512 misses on a space too large to finish) and reports the length empty only if it found nothing. `NO_TIER_SEQUENCE` is returned once every length is empty (eng E-3). A tiny generated pan is the only realistic way to reach the fallback, and its space is small enough for the budget.
- **D-3 Draw distribution.** Length is drawn first, uniformly over lengths that have at least one sequence, as BASIC does. "Has at least one" is decided lazily: a length whose 512 attempts and fallback both come back empty is dropped and the length is redrawn among the rest. No-repeat: `prev` is rejected inside the acceptance test, and if `prev` is the only sequence the tier has, it is returned (mirrors BASIC's E4 rule). *Why:* without length-first, ADVANCED would be ~99.9% length 6 on Pygmy (§2.2).
- **D-4 LOW/HIGH on generated decks.** A card is LOW/HIGH iff its `subtitle` matches `/\b(LOW|HIGH) VOICING\b/`. If D1 step 1 finds the generator never emits that qualifier, generated decks simply have no LOW/HIGH cards: INTERMEDIATE's pool is then "≤4 notes", and ADVANCED is still reachable through 5+ notes, a non-home start, length 5-6, or a free repeat. *Why:* computing register from field heights would invent a classification the owner has never seen on a card face; the subtitle is what the player reads. **Amended by D-14 (owner, 2026-10-02):** an anchor is exempt from the LOW/HIGH exclusion.
- **D-5 Score.** Not shipped. The Q/F/L/M/R/S/H scorer moves into `tests/helpers/sequence_score.js` and backs the golden-fixture tests. *Why:* `pick` never ranks, so an engine score is dead code that a mutant cannot kill.
- **D-6 Empty tier.** `NO_HOME_CHORD` keeps priority on every tier. `TOO_FEW_CHORDS` stays BASIC's reason. INTERMEDIATE/ADVANCED return `NO_TIER_SEQUENCE` when D-2's fallback finds nothing. The app shows: "This scale has no {TIER} progressions. Pick another difficulty or another scale." (tier name in its all-caps button spelling, so it matches the control).
- **D-7 Persistence.** `store.tier` in `hpfc` (read-modify-write via `save()`), type-guarded on read like `store.mode` (`index.html:6019`): only the three ids survive, anything else reads as `"basic"`. Not in the share URL (N34). *Why:* per-viewer convenience, same lifetime as the mode itself.
- **D-8 Selector placement (design pass).** Its own `.panel-group` with heading "Difficulty", placed directly after the Practice group so it reads as part of the mode choice. In the landscape grid it becomes its own cell; in the desktop sidebar it stacks. *Why:* a second heading inside Practice would be a new label style; a separate group reuses `.panel-heading` exactly.
- **D-9 Selector layout (design pass).** Three `.mode` buttons, BASIC / INTERMEDIATE / ADVANCED, left to right = easiest to hardest, in a `.tierbar` row with equal `flex:1 1 0` widths when the content box is ≥ 348px, otherwise a single column of full-width buttons (each 44px). Implemented with one container rule, not three breakpoints: `display:grid; grid-template-columns:repeat(auto-fit, minmax(111px, 1fr))` is rejected because it produces a ragged 2+1 between 230px and 347px. Use `flex-direction:column` by default and switch to row under `@container tier (min-width:348px)`; the group carries `container:tier / inline-size` (first container query in the repo; no support → column, which is always correct). Inline-size containment makes a shrink-to-fit parent collapse the group to zero width; today every context gives it a definite width (mobile `min(420px,100%)`, sidebar `align-items:stretch`, landscape grid cell stretch), and D2 step 2 asserts the group's width equals its siblings' in all four viewports so a later `align-items:center` cannot silently zero it. The tier buttons do NOT reuse `.modebar` (its `#modeS{flex:1 0 100%}` and wrap rules are mode-specific); `.tierbar` is a new layout class only, no new visual style. *Why:* §2.6; a 2+1 wrap breaks the easy-to-hard reading order.
- **D-10 Greyed state (design pass).** Outside mode S the three buttons carry the native `disabled` attribute (out of Tab order, announced unavailable, already skipped by the panel trap) and render with the existing disabled precedent: `opacity:.5; cursor:default`, no `:active` feedback. The remembered tier keeps its `.on` styling at half opacity, so the player can see what they will get. A `.panel-note` (existing class, `index.html:211`) under the buttons, visible only while disabled, says: "Pick CHORD PROGRESSION to change this." It is wired with `aria-describedby` on each of the three buttons (not the group: a describedby on a non-interactive container is not announced when a screen reader lands on a button in browse mode). The "Difficulty" heading stays at full colour; only the buttons dim, so the group never reads as missing. No new colour, typeface or label style. *Why:* a disabled control with no explanation is a dead end; the note gives direction in the panel's own voice and copies the mode button's exact label.
- **D-11 Interaction.** A tier button sets `aria-pressed`/`.on` exclusively (same as the mode buttons, `index.html:8077`), saves, re-deals (`setOrder()` with `prev` cleared, since a new tier makes the old sequence irrelevant), renders, and calls `closePanel()` so the mobile player lands on the new progression, matching the mode buttons. Clicking the already-pressed tier also re-deals. On the desktop sidebar `closePanel()` is a no-op and focus stays on the pressed button. Re-deal is synchronous (D1 step 6 bounds it at < 50 ms), so there is no loading state; the only non-happy state is D-6's empty message.
- **D-12 Rail at 4-6 chords (design pass).** `.seq-rail` may wrap to at most two lines at 380px portrait and must stay inside the existing landscape footer box: `flex-wrap:wrap; justify-content:center` on the rail, with separators kept attached to the following name (`white-space:nowrap` per "→ name" unit). No font-size change. If the two-line bound or the landscape box fails at the longest built-in ADVANCED sequence, D2 escalates rather than shrinking type (N28: no new chrome budget rows).
- **D-13 Lane split.** Serialised, not parallel. D1 touches `index.html` only inside the generated `<!-- engine:sequence -->` region via `tools/inline_engine.py`; D2 touches only outside it. Textual conflict is impossible, but D2 builds on D1's API, so spawning D2 before D1 merges means building against a world without its dependency.
- **D-14 (owner, 2026-10-02): "Starting chords always allowed".** Every card BASIC may use (an anchor, `anchors()`) is also in the INTERMEDIATE pool and passes INTERMEDIATE's per-chord checks, even when its subtitle carries LOW/HIGH VOICING. Non-anchor LOW/HIGH cards are still excluded (D-4 otherwise stands). The 4-note cap never bites an anchor, since anchors have at most 3 fields (`sequence.js:104`). Lane D3, §9.
- **D-15 (AFK, A-8). `tierOf` returns `null` for a 3-chord sequence that fails INTERMEDIATE.** ADVANCED deals only lengths 4-6, so calling such a sequence "advanced" labels it with a tier that can never deal it. This is the same reasoning as D1's length-2 → `null` rule (`sequence.js:364-367`). ADVANCED's catch-all becomes `4 <= n <= 6` (review C5, A-13: a 7+ chord sequence is just as undealable as a 3-chord one, so it is also `null`). Lane D3, §9.

## §4 Lanes

### D1 - engine

- **Owns:** `src/engine/sequence.js`; `tests/sequence.test.js`; new `tests/helpers/sequence_score.js` (axes only; it never calls `tierOf`, so the golden fixtures stay an independent oracle - eng E-6); new `tests/fixtures/sequence_basic_golden.json`; the `engine:sequence` region of `index.html` (only via `python3 tools/inline_engine.py`); new `tests/mutants/sqd_*.patch`; refreshes of existing `tests/mutants/sq_*.patch` / `sqe_*.patch` that the engine edit makes stale.
- **Never touches:** `data/decks.json`, the `const DECKS` line, anything in `index.html` outside the engine region, `tests/e2e.test.js`, `tests/mutation_check.sh`.
- **Branch:** `claude/difficulty-d1-engine`.

| # | Step | Acceptance | Verify |
|---|---|---|---|
| 1 | Read `HPE.select.build`; record in the PR whether any generated subtitle can contain "LOW VOICING"/"HIGH VOICING" | PR body states the answer with file:line | reviewer reads |
| 1b | Before ANY engine edit, capture `tests/fixtures/sequence_basic_golden.json` from the unmodified engine: for seeds 0..199, each built-in deck, `prev` = null and = the previous deal, record `chords`, `style` and the next `rng()` value | fixture committed in its own commit ahead of the engine change; generator script inline in the test file's header comment | `git log --oneline` shows the fixture commit first |
| 2 | Port the scorer into `tests/helpers/sequence_score.js`; write golden-fixture tests first (red: `tierOf` missing) | I1-I8 → intermediate, A1-A6 → advanced on Pygmy; Hijaz `[1,7,3]` intermediate, `[15,14,4,6]` advanced; Amara `[1,19,17]` intermediate, `[11,21,16,25]` advanced (1-based card numbers in the doc; tests convert); every BASIC sequence today classifies basic (36 / 23 / 16); a resolving sus repeat on the wrap is intermediate, an unresolved repeat is advanced | `node --test tests/sequence.test.js` |
| 3 | Implement `TIERS`, `tierOf` | step 2 green | same |
| 4 | Tests first, then `pick(..., tier)` per D-1/D-2/D-3 | BASIC parity against the step-1b golden fixture (not pick-vs-pick, which is tautological once both calls share a branch; eng E-4): `pick(d, rng, prev)` and `pick(d, rng, prev, "basic")` each reproduce the fixture's `chords`, `style` and next draw; every dealt INTERMEDIATE/ADVANCED sequence over 2,000 seeds per deck has `tierOf ===` its tier, connects on every pair and the wrap, length within range; no consecutive repeat; each length's share within 3pp of uniform over 10,000 draws; unknown tier throws; pick uses only the rng it is given (reuse the vm `Math.random` trap) | `node --test tests/sequence.test.js` |
| 5 | Fallback and reasons per D-2/D-6, tests first | a synthetic 4-card deck reaches the DFS fallback and still deals; a synthetic deck with anchors but no non-anchor cards returns `NO_TIER_SEQUENCE` for intermediate; `NO_HOME_CHORD` wins on every tier | same |
| 6 | Generated-deck sweep | for every generated deck in the existing layout/select sweep fixtures, all three tiers return either a valid sequence or a documented reason, never throw, each in < 50 ms; plus a synthetic deck that forces the DFS fallback on every length finishes in < 50 ms | `node --test tests/sequence.test.js` |
| 7 | Sync | engine region matches | `python3 tools/inline_engine.py && python3 tools/inline_engine.py --check && python3 tools/validate.py` |
| 8 | Mutants: add ≥ 6 `sqd_*` (tier pool ignores the 4-note cap; LOW/HIGH not excluded from intermediate; wrap repeat check made acyclic; must-use gate dropped; length range off by one; basic branch routed through the sampler) with `.` wildcards in `# suite:`; refresh stale ones | every new mutant killed by the named test; refresh clean | `python3 tools/refresh_mutants.py --check` and `node --test tests/mutation_harness.test.js`; the full sweep is CI's |

### D2 - app

> **Re-planned 2026-10-02 after the fifth review FAIL:** see `docs/plans/2026-10-02-difficulty-d2-replan.md`; where the two disagree, that document governs D2.

- **Owns:** `index.html` outside every `<!-- engine:... -->` region and outside the `const DECKS` line; `tests/e2e.test.js`; `tests/app.test.js`; new `tests/mutants/uid_*.patch`; refreshes of ANY `tests/mutants/*.patch` whose anchor the app edit moves (`refresh_mutants.py --check` over the whole directory, not one prefix).
- **Never touches:** `src/engine/*`, engine regions, `data/decks.json`, `tests/mutation_check.sh`.
- **Branch:** `claude/difficulty-d2-app`. Spawned from main after D1 merges.

| # | Step | Acceptance | Verify |
|---|---|---|---|
| 1 | e2e tests first (red) for steps 2-6 | each new test fails on main for the right reason | `node --test --test-name-pattern="difficulty" tests/e2e.test.js` (single tests only; the full e2e suite is CI's) |
| 2 | Markup + CSS per D-8/D-9/D-10 | selector visible in modes A, B and S at 380x740, 320x640, 812x375 landscape and 1280x800 sidebar; three-across at 380 portrait, single column in the 240px sidebar; never a 2+1 row; every button ≥ 44px tall; no new colour (computed colours ⊂ existing `.mode` set), no new font family; the Difficulty group's rendered width equals the Practice group's in all four viewports (guards the inline-size containment collapse) | same pattern |
| 3 | Greyed state per D-10 | `panelStops()` (`index.html:7998`) lists the three tier buttons explicitly after `modeS`/`seqLink` and before `deck-add` - it enumerates ids, so the `!el.disabled` filter alone does not admit new buttons (eng E-5); `driveTabCycle`'s `max` (`tests/e2e.test.js:7010`) rises from 14 to cover the 15-stop mode-S cycle, and both forward and reverse cycles assert the tier buttons in order; in A/B: all three `disabled`, out of the Tab sequence, `opacity` 0.5, remembered tier still `.on`, heading opacity 1, note visible and referenced by every button's `aria-describedby`; in S: enabled, note hidden | same |
| 4 | Behaviour per D-7/D-11 | clicking a tier in S presses it exclusively, persists across reload (`hpfc.tier`), re-deals a progression whose `tierOf` matches, closes the mobile panel; `hpfc.tier = "nonsense"` reads back as BASIC; sibling keys in `hpfc` survive | same |
| 5 | Empty tier per D-6 | a generated deck that returns `NO_TIER_SEQUENCE` shows the tier-specific message naming the tier; `NO_HOME_CHORD`/`TOO_FEW_CHORDS` copy unchanged | same |
| 6 | Rail per D-12 | the longest built-in ADVANCED sequence (pick it by computed rail width) wraps to ≤ 2 lines at 380 portrait and fits the landscape footer box; separators never start a line; the existing 320x568 rail test (`tests/e2e.test.js:~7109`) counts chords from explicit chord elements, not `Math.ceil((segments+1)/2)`, since grouping "→ name" units changes the child count (eng E-7), and keeps its BASIC one-line assertion | same |
| 7 | Existing contracts | chrome budget, landscape budget and contrast tests unchanged and green; the mode-S tab-order and rail tests change only as steps 3 and 6 state | CI |
| 8 | Mutants: ≥ 4 `uid_*` (selector enabled in mode A; tier not persisted; tier not passed to pick; note shown in mode S) | each killed by its named test | `python3 tools/refresh_mutants.py --check` and `node --test tests/mutation_harness.test.js` |

## §5 Standing merge gates

1. CI (`validate.yml`, every required check incl. the mutation shards) green at the PR head SHA, verified against the local tip with `gh pr view --json headRefOid`.
2. A fresh `swarm-reviewer` returns PASS or PASS_WITH_NITS at that same SHA. FAIL bounces to the lane; cap two attempts per lane.
3. Merges serialised, `gh pr merge <n> --merge`, no `--delete-branch`. Merged branches and worktrees cleaned after `gh pr list --head <b> --state merged` confirms.
4. `python3 tools/validate.py`, `tests/test_render_agreement.py` and `tools/inline_engine.py --check` pass at the head.
5. Never run the full e2e suite or `tests/mutation_check.sh` locally; CI at the head SHA is the evidence.

## §6 Cost

2 lanes, ~4 subagent runs (lane + reviewer each), ~2-3 CI runs, +1 reviewer and +1 CI run per bounce.

**D3 amendment (2026-10-02):**

- Planning: 1 subagent run (this amendment, including /plan-eng-review) and 1 CI run on the docs PR.
- Execution: 2 subagent runs (the D3 lane plus 1 fresh `swarm-reviewer`) and ~2-3 CI runs (the first push, plus mutant-refresh follow-ups; D1 needed 3 for this). Each bounce adds 1 reviewer run and 1 CI run, capped at two attempts per §5.
- CI time: the new and strengthened tests add about 2.1 s locally to `tests/sequence.test.js`, which runs 44.4 s today. That is about 5 s at the ~2.5x CI slowdown measured in D1. The 8 new mutants add one shard-run each, on the named test only. Breakdown in §9.3.

## §7 AFK auto-decisions

D-1 through D-13 above were auto-picked under the AFK grant (2026-10-02), each the option the plan recommends. Owner decisions: D-0. Reviews: §8.

Process auto-decisions:
- **A-1** /plan-design-review ran on measurements and real CSS instead of a mockup board: nobody is present to pick a variant.
- **A-2** gstack upgrade offered by the skill preamble was deferred: not part of the task, and an upgrade mid-run changes the review skills under the run.
- **A-3..A-7** /plan-eng-review auto-decisions: see the decision ledger in §8.
- **A-8** (D3) item (e): `null`, not "advanced", for a 3-chord sequence that fails INTERMEDIATE. This is the option the brief recommended (D-15).
- **A-9+** (D3) the /plan-eng-review auto-decisions on the amendment are in the decision ledger.

## §8 Review log

### /plan-design-review (2026-10-02, AFK, no mockups)

Design evidence: §2.6 measurements and the panel CSS at 61b01c2 (`index.html:245-333`), not a mockup board - the owner is AFK, so a variant board could not collect a pick (auto-decision A-1). Initial score 7/10, final 9/10.

| Pass | Before | After | Change |
|---|---|---|---|
| 1 Information architecture | 8 | 9 | heading stays full colour while buttons dim (D-10) |
| 2 Interaction states | 7 | 9 | no loading state by construction; desktop focus outcome stated (D-11); empty state already D-6 |
| 3 User journey | 8 | 9 | note copies the mode button's label; tier change lands on a fresh deal |
| 4 AI-slop risk | 9 | 9 | reuses `.mode`, `.panel-heading`, `.panel-note`; no new visual |
| 5 Design system alignment | 7 | 9 | `.tierbar` is layout-only, does not inherit `.modebar`'s mode-S rules (D-9) |
| 6 Responsive + a11y | 6 | 9 | container named and declared, collapse risk guarded by a width test (D-9); describedby moved to the buttons (D-10) |
| 7 Unresolved decisions | - | - | none |

What already exists: `.mode`, `.panel-group`, `.panel-heading`, `.panel-note`, the disabled precedent (`index.html:526`, `:862`), the panel Tab trap's `!el.disabled` filter. NOT in scope: a tier tooltip/explainer, per-tier colour, animating the enable transition. TODOS: none.

### /plan-eng-review (2026-10-02, AFK, FULL_REVIEW)

Scope challenge: D1 + D2 touch 8+ files, tripping the complexity gate. Auto-decided "original arrangement" (A-3): the two lanes already split on the generated-region boundary, and every file is a test or the one engine module. Prior learnings: 5 loaded, none on this module. History: `sequence.js` has one commit (2c63d0f); no churn risk.

Findings (all folded into §3/§4 above):

- [E-1] (confidence 9/10) D-2 / D1 step 6 - a 200k-node DFS on raw `connects` measured 115 ms on Pygmy, and the lazy length drop can run it per length: the 50 ms bound fails. Fix: one connect matrix per `pick`. (The 200k figure was the budget planned at the time. The shipped budget is 15,000; see §9 item (d).)
- [E-2] (9/10, outside voice) D-2 vs D-3 - D-2 read literally redraws the length per attempt, weighting lengths by acceptance rate (Pygmy I3/I4 ~64/36). Fix: length drawn once, fixed through sampling and fallback.
- [E-3] (8/10, outside voice) D-2 - a budget-truncated DFS can neither prove a length empty nor draw uniformly. Fix: complete vs truncated search distinguished; truncated bias accepted and documented (off built-ins only).
- [E-4] (9/10) D1 step 4 - pick-vs-pick BASIC parity passes a mutant that routes BOTH calls through the sampler. Fix: golden fixture captured before the engine edit (step 1b).
- [E-5] (9/10, outside voice, verified) D2 step 3 - `panelStops()` enumerates ids (`index.html:7998-8008`); new buttons are unreachable by Tab unless listed, and the 15-stop cycle exceeds `driveTabCycle`'s max of 14 (`tests/e2e.test.js:7010`). Fix in step 3; step 7 amended.
- [E-6] (7/10) D1 Owns - a scorer helper that calls `tierOf` makes the fixtures circular. Fix: helper computes axes only.
- [E-7] (8/10, outside voice) D2 step 6 - "→ name" units change the rail's child count, breaking the existing chord-count arithmetic. Fix: count chord elements.
- [E-8] (7/10) D2 Owns - an app-region edit can stale mutants of any prefix. Fix: refresh over the whole directory.

Test coverage:

```
pick(deck,rng,prev,tier)
├─ tier undefined/"basic" ── golden fixture (1b, 4) ── sq_* mutants + sqd basic-routed
├─ tier unknown ──────────── throws (4)
├─ "intermediate"/"advanced"
│   ├─ length draw ───────── uniform within 3pp (4) ── sqd length off-by-one
│   ├─ sampler accept ────── tierOf===tier, connects+wrap, no prev (4) ── sqd pool/LOW-HIGH/wrap/must-use
│   ├─ DFS fallback ──────── synthetic 4-card deck (5), forced-fallback < 50 ms (6)
│   └─ empty ─────────────── NO_TIER_SEQUENCE (5); NO_HOME_CHORD priority (5)
└─ generated sweep ───────── never throws, < 50 ms (6)
app
├─ selector visible x 4 viewports, width parity (D2-2)
├─ disabled A/B, enabled S, panelStops order (D2-3) ── uid enabled-in-A / note-in-S
├─ click → persist, re-deal, close (D2-4) ── uid not-persisted / not-passed
├─ empty copy (D2-5)
└─ rail ≤ 2 lines, landscape box, existing rail test (D2-6)
```

Failure modes: a generated deck whose space is huge but sparse could hit the truncated-DFS path and deal a traversal-biased progression (accepted, E-3); a future `align-items:center` on the panel would zero the container-query group (guarded by the D2-2 width test); a later change to `HPE.select.build` subtitles could start emitting "VOICING" and silently change INTERMEDIATE pools on generated decks (D1 step 1 records the current answer; no test pins it - accepted).

Worktree parallelization: none. D2 depends on D1's API (D-13); one lane at a time.

What already exists: `connects`, `anchors`, `homeAnchor`, `mulberry32` and the vm `Math.random` trap (`tests/sequence.test.js:192-206`) are reused, not rebuilt; `tools/refresh_mutants.py` re-anchors stale patches. NOT in scope: a tier score in the engine (N33), tier in share URLs (N34), register-from-geometry LOW/HIGH (D-4). TODOS: none. Approval readiness: PASS.

## §9 D3 - engine hardening (amendment, 2026-10-02)

- **Base:** `main` @ `154d516`, the merge of PR #202 (D1). D1's reviewer returned PASS_WITH_NITS at `e63d67b`. Every file:line in this section was read at `154d516`.
- **Input:** the D1 review nits plus one owner decision (D-14). Each item below was checked against main before it was put in the lane. Every item has a verdict: CONFIRMED (with its reproduction), DROPPED (with the evidence), or NO ACTION.
- **Probes:** all are read-only node scripts in the session scratchpad (`scratchpad/d3/*.js`, plus the coordinator's `scratchpad/probe/{probe.js,fallback.js,reganchor.js}`). They load the engine through `tests/helpers/engine.js`. Patched variants are built by string-replacing the `src/engine/sequence.js` source inside a vm context, so the repo is never edited. The output quoted under each item is verbatim from a re-run at `154d516` (timings vary run to run).
- **Not reopened:** D-0..D-13, A-1..A-7, and the identical-consecutive-card rule the owner kept (`sequence.js:493-497`).

### 9.1 Evaluation

**(a) Anchors excluded from INTERMEDIATE - CONFIRMED.**

- **Cause.** `intermediateGate` (`sequence.js:340-349`) and `tierPool` (`:404-414`) drop every LOW/HIGH card, anchors included. On the repro deck `(A2) C3 E3 G#3 A#3 C4 E4 G4 G#4 A4 A#4 C#5 | G#2 E3 F3 G3`, chord 14 (`C [C MAJOR - HIGH VOICING]`) is an anchor:

  ```
  $ node scratchpad/d3/a.js <worktree>
  anchors: 0=A [A MAJOR]; 7=A#m [A# MINOR]; 14=C [C MAJOR - HIGH VOICING]; 22=C#m [C# MINOR]; 26=E° [DIMINISHED - HIGH VOICING]; 27=F [F MAJOR]; 32=G° [DIMINISHED]
  intermediate pool has 14? false
  basic dealt 2000 contains 14: 498
  intermediate dealt 2000 contains 14: 0
  advanced dealt 2000 contains 14: 347
  [0,14,8] A [A MAJOR] -> C [C MAJOR - HIGH VOICING] -> A#° [DIMINISHED] connects: true tierOf: advanced
  ```

  `[0,14,8]` connects but classifies "advanced" at length 3, so no tier ever deals it (see (e)).

- **How often.** Over 1,894 decks (the 3 built-ins, the 20 `synthetic_scales.json` rows, and 1,880 random generated decks from `mulberry32(999)`), 46 decks break nesting on main and 0 do with the fix. One of the 46 has a register-labelled **home** anchor: `(A#2) D3 E3 F#3 G3 A3 A#3 D#4 F4 A#4 C5 | F2 A#2 D#3 E3 F4`, anchor 2. None of the 20 synthetic rows or the 37 step-6 sweep decks triggers it, so the tests need explicit fixture decks.

  ```
  $ node scratchpad/d3/probe_a.js
  decks=1894 nesting violations main=46 patched=0 decksWithRegisterAnchor=46 decksWithRegisterHomeAnchor=1
  hijaz: anchors=6 registerAnchors=0 poolsIdentical=true pickDiffs(2x2000)=0
  pygmy: anchors=7 registerAnchors=0 poolsIdentical=true pickDiffs(2x2000)=0
  amara: anchors=5 registerAnchors=0 poolsIdentical=true pickDiffs(2x2000)=0
  patched BASIC golden mismatches: 0
  patched repro deck: INTERMEDIATE draws containing 14 = 213/2000, tierOf mismatches=0; [0,14,8] tierOf=intermediate
  ```

- **The home-anchor case (review R2).** On `REGISTER_HOME_DECK` the home anchor itself is the register-labelled card. On main INTERMEDIATE never starts on it or deals it; with the fix it starts 144 of 500 deals, all still `tierOf` "intermediate":

  ```
  $ node scratchpad/d3/probe_h.js
  main: chords=34 homeAnchor=2 [A# A# MAJOR - HIGH VOICING] homeRootChords=0,1,2,3,4 deals=500 startOnHomeAnchor=0 containHomeAnchor=0 tierMismatch=0 reasons={}
  patched: chords=34 homeAnchor=2 [A# A# MAJOR - HIGH VOICING] homeRootChords=0,1,2,3,4 deals=500 startOnHomeAnchor=144 containHomeAnchor=144 tierMismatch=0 reasons={}
  ```

- **Built-ins are unaffected - proof.** No built-in anchor carries a LOW/HIGH subtitle: 0 of 6, 7 and 5 (Pygmy's LOW/HIGH cards in §2.4 are all non-anchors). With no such anchor, the anchor exemption never fires on a built-in deck. `tierPool` and `intermediateGate` therefore compute exactly what they did before, so the built-in INTERMEDIATE/ADVANCED pools, and `tierOf` on every built-in sequence, cannot change. The run above confirms it empirically: identical pools, and 0 differing deals over 2 tiers x 2,000 chained seeds per deck. BASIC never reads either function, and the step-1b golden fixture still matches 0-mismatch.

**(e) `tierOf` labels unreachable 3-chord sequences "advanced" - CONFIRMED, and still needed after (a).**

- **Cause.** `classifyTier` (`sequence.js:384`) returns "advanced" for any `n >= 3`, but `TIER_LENGTHS.advanced` is `[4, 5, 6]` (`:278`).
- **Scale.** The script enumerates every 3-chord sequence that connects and has no identical neighbours:

  ```
  $ node scratchpad/d3/probe_e.js
  hijaz dealable length-3 by tierOf: main {"advanced":4686,"intermediate":636,"basic":18} | after (a) {"advanced":4686,"intermediate":636,"basic":18} | after (a)+(e) {"null":4686,"intermediate":636,"basic":18}
  pygmy dealable length-3 by tierOf: main {"advanced":108826,"intermediate":2438,"basic":30} | after (a) {"advanced":108826,"intermediate":2438,"basic":30} | after (a)+(e) {"null":108826,"intermediate":2438,"basic":30}
  amara dealable length-3 by tierOf: main {"advanced":11644,"intermediate":1010,"basic":12} | after (a) {"advanced":11644,"intermediate":1010,"basic":12} | after (a)+(e) {"null":11644,"intermediate":1010,"basic":12}
  repro dealable length-3 by tierOf: main {"advanced":23371,"intermediate":1513,"basic":28} | after (a) {"advanced":23013,"intermediate":1871,"basic":28} | after (a)+(e) {"null":23013,"intermediate":1871,"basic":28}
  pick diffs (a) vs (a)+(e), 3 decks x 2 tiers x 500 seeds: 0
  ```

- **Re-check after (a).** (a) moves 358 sequences on the repro deck from "advanced" to "intermediate". 23,013 stay mislabelled, so (e) is still needed.
- **Effect on `pick`.** None: `pick` only ever asks `classifyTier` about lengths it deals, and 0 deals differ. Decision: return `null` (D-15, A-8).
- **Tests that change.** Three existing assertions pin length-3 → "advanced" and must become `null`: `tests/sequence.test.js:513` (resolveDeck `[0,1,2]`), `:529` (capDeck `[0,1,2]`) and `:561` (registerDeck `[0,2,3]`). Each still separates `null` from "intermediate", so `sqd_01`/`sqd_02`/`sqd_03` stay killed. `sqd_04` is killed by the 4-6 chord golden fixtures, which keep "advanced", but its hunk's removed line is the `if (n >= 3) return "advanced";` that step 4 rewrites, so it must be hand-rewritten in step 8 (review C3).
- **D2 checked.** D2's e2e tests (`origin/claude/difficulty-d2-app`, `tests/e2e.test.js:7723`, `:7844`) call `tierOf` only on sequences `pick` dealt. Their results do not change.

**(b) Generated-deck sweep is too weak - CONFIRMED (a coverage gap, not a bug).**

- **What it checks today.** `tests/sequence.test.js:809-863` runs seed 1 only and asserts only "chords or reason, no throw, < 50 ms". That leaves the custom-scale guarantee unpinned.
- **No bug behind the gap.** The strengthened checks find nothing on main: 510 deals over the 37 sweep decks x 3 tiers x 5 seeds, 0 violations.
- **What the gap lets through.** A mutant that stops the DFS leaf from calling `accept` (`sequence.js:456`) survives the sweep at 1 seed, because no sweep deck reaches the fallback. Add the 4 reviewer-slow decks and 5 seeds, and 12 of 40 picks reach the DFS and all 12 deal invalid sequences:

  ```
  $ node scratchpad/d3/probe_b.js main 5
  variant=main seeds=5 rows=37 built=37 deals=510 bad=0 reasons={"basic:NO_HOME_CHORD":15,"intermediate:NO_HOME_CHORD":15,"advanced:NO_HOME_CHORD":15} total=374ms maxPick=2.8ms
  $ node scratchpad/d3/probe_r.js
  main seeds=1: deals=8 picksReachingDFS=0 invalid=0
  main seeds=5: deals=40 picksReachingDFS=12 invalid=0
  leaf seeds=1: deals=8 picksReachingDFS=0 invalid=0
  leaf seeds=5: deals=40 picksReachingDFS=12 invalid=12
  ```

**(c) The DFS node-budget test cannot catch prune removal - CONFIRMED, with a correction from review (C2).**

- **What it can and cannot see.** `dfsFindAll` returns as soon as `nodes >= budget` (`sequence.js:453`, `:460`), so the test's `stats.nodes <= DFS_NODE_BUDGET` (`tests/sequence.test.js:976-1007`) holds whenever the guards exist. The probe removed the connectivity prune (`sequence.js:465`) and the node count was exactly `15000`, so that test stays green: it cannot catch prune removal. It is NOT fully circular, though: deleting the budget guards themselves does turn it red (codex outside voice, C2). Step 5 therefore keeps a node-ceiling assertion and adds the completion test beside it, rather than replacing one with the other.
- **A test that can fail.** It needs a search that COMPLETES under the budget with the prunes and does NOT complete without them. Over 450 (deck, tier, length) cells (built-ins, the 4 reviewer decks, 300 random decks), 144 finish under 15,000 nodes. Only 4 of those turn red when the matrix prune is removed, and 6 when the identical-card prune is removed. Built-in Pygmy fits under the budget only at INTERMEDIATE length 3, and it completes there with or without the prunes.
- **The chosen deck.** The best case is the reviewer deck `(G3) D4 F4 F#4 B4 F#5 G5 A#5` at ADVANCED length 4. A stuck-at-zero rng drives `pick` there (draw 0 = length 4, then 512 identical rejected attempts).

  ```
  $ node scratchpad/d3/probe_c2.js
  (G3) D4 F4 F#4 B4 F#5 G5 A#5 chords=12 advanced L4: nodes=13605 found=10468 brute=10468 exactSet=true dfs=8ms brute=5ms | noMatrixPrune nodes=15000 found=9130 exactSet=false | noRepeatPrune nodes=15000 found=8842
  pygmy chords=52 intermediate L3: nodes=3904 found=2438 brute=2438 exactSet=true dfs=6ms brute=2ms | noMatrixPrune nodes=4356 found=2438 exactSet=true | noRepeatPrune nodes=4186 found=2438
  hijaz chords=19 intermediate L3: nodes=1316 found=636 brute=636 exactSet=true dfs=2ms brute=1ms | noMatrixPrune nodes=1366 found=636 exactSet=true | noRepeatPrune nodes=1486 found=636
  amara chords=25 intermediate L3: nodes=2151 found=1010 brute=1010 exactSet=true dfs=2ms brute=1ms | noMatrixPrune nodes=2287 found=1010 exactSet=true | noRepeatPrune nodes=2387 found=1010
  stuck pick advanced: 0,1,0,1 len 4
  ```

- **Headroom.** The search completes at 13,605 of 15,000 nodes, so the margin is 9%. If the budget is ever cut below 13,605, the completion assertion goes red. That is intended: it means the budget no longer covers a real generated deck the reviewer found. Step 5 states this in the test.

**(d) The plan text said 200,000; the code says 15,000 - CONFIRMED, fixed in this amendment.**

- **Where.** D-2 (§3) and E-1 (§8) now give 15,000. Nothing in the code changes.
- **Rationale (measured in PR #202's perf review, recorded at `sequence.js:29-51`).**
  - At 200,000, the stuck-rng worst case on Pygmy took ~100 ms even with pruning. The accepted set itself is close to that size, so the search fills the whole budget.
  - At 40,000 it took 22-27 ms locally but 64 ms in CI (job 110789441606).
  - A budget-to-time sweep was near-linear. 15,000 measured 8.4-10.5 ms locally, which projects to ~20-26 ms in CI.
- **Re-measured today at `154d516`.** Stuck-rng Pygmy takes 3.9-5.3 ms (INTERMEDIATE) and 8.7-10.7 ms (ADVANCED) locally (`scratchpad/d3/probe_d.js`).

**(f) `sqd_01` targets the gate's cap, not the pool's - NO ACTION, closed (rationale corrected by review C1).**

- **What a pool-only mutant changes.** Dropping the 4-note cap from `tierPool` alone lets the sampler draw 5+ note cards. `accept` then re-checks every candidate through `classifyTier` → `intermediateGate`, which still enforces the cap, so the ACCEPTED SET is unchanged. It is not fully equivalent, though (codex outside voice, C1): the bigger pool changes rng consumption, and on a budget-bound deck the extra rejected candidates spend DFS nodes, so the fallback can find nothing where it found a sequence before. Codex's repro: 30 five-field C cards ahead of C/Dm/Dsus4, a stuck-zero rng; normal `pick` deals `[30,32,31]`, the pool-cap-removed variant returns `NO_TIER_SEQUENCE`.
- **Why still no action.** Both differences need a contrived deck (no built-in or sweep deck is budget-bound at INTERMEDIATE; see (c)) or per-seed pinning that no contract asks for. The gate is the cap's single point of enforcement, so `sqd_01` correctly mutates the gate, and the cap stays in the pool as an efficiency filter. Step 1's pre-D3 fixture pins built-in rng consumption, so a pool-cap removal may also die there on any built-in with a 5+ field card; that is a side effect, not relied on, and no mutant is added.
- **D3's own exemption is different.** Its pool-side mutant (`sqd_08`) changes the accepted set, not just availability: dropping the anchor exemption from the pool removes every sequence through the excluded anchor, which step 2 (i) sees directly (no rng involved).

### 9.2 Lane D3 - engine hardening

- **Branch:** `claude/difficulty-d3-engine`. **Spawn it from main only after D2 (`claude/difficulty-d2-app`) has merged.** Both lanes refresh `tests/mutants/`.
- **Owns:**
  - `src/engine/sequence.js` and `tests/sequence.test.js`.
  - The `engine:sequence` region of `index.html`, edited only through `python3 tools/inline_engine.py`.
  - New `tests/fixtures/sequence_tier_golden.json` (step 1).
  - New `tests/mutants/sqd_07_*`..`sqd_14_*.patch`, and a hand-rewritten `sqd_04` (step 8).
  - Refreshes of ANY stale `tests/mutants/*.patch`:
    - run `python3 tools/refresh_mutants.py` over the whole directory;
    - run `python3 tools/regen_data_mutants.py` **on a clean tree** for the `b_*` data mutants. The D1 lesson: growth in the engine region moves the DECKS-line anchors (`e63d67b`).

    Both scripts are allowed in `.claude/settings.local.json`.
- **Never touches:**
  - `data/decks.json` and the `const DECKS` line;
  - anything in `index.html` outside the engine regions;
  - `tests/e2e.test.js`, `tests/app.test.js`;
  - `tests/mutation_check.sh`;
  - the step-1b BASIC golden fixture.
- **Goal:** items (a), (b), (c) and (e) of §9.1, pinned by tests that can fail.
- **Non-goals:**
  - no change to BASIC;
  - no change to the built-in INTERMEDIATE/ADVANCED deals;
  - no change to `DFS_NODE_BUDGET`;
  - no change to D-2's sampler or fallback semantics;
  - no app change;
  - no reopening of D-0..D-13 or of the identical-consecutive-card rule.
- **Shared fixture decks (step 2 declares them once):**
  - `REGISTER_ANCHOR_DECK` = `(A2) C3 E3 G#3 A#3 C4 E4 G4 G#4 A4 A#4 C#5 | G#2 E3 F3 G3` (chord 14 is a HIGH VOICING anchor);
  - `REGISTER_HOME_DECK` = `(A#2) D3 E3 F#3 G3 A3 A#3 D#4 F4 A#4 C5 | F2 A#2 D#3 E3 F4` (its home anchor, chord 2, is register-labelled);
  - `REVIEWER_DECKS` = the 4 strings at `tests/sequence.test.js:902-905`, hoisted to module scope.

| # | Step | Acceptance | Verify |
|---|---|---|---|
| 1 | Before ANY engine edit, capture `tests/fixtures/sequence_tier_golden.json` from the unmodified engine: for each built-in deck, tiers intermediate and advanced, seeds 0..199, `prev` chained from the previous deal, record `chords`, `style` and the next `rng()` value. Add a test "built-in INTERMEDIATE/ADVANCED deals match the pre-D3 fixture" (generator in its header comment, as for step 1b of D1) | fixture in its own commit ahead of every engine commit; test green on the unmodified engine (1,200 picks, measured 0.92 s locally) | `node --test --test-name-pattern="pre.D3.fixture" tests/sequence.test.js`; `git log --oneline` shows the fixture commit first |
| 2 | Tests first for (a), red: **(i)** "every BASIC anchor is in the INTERMEDIATE pool on every deck" - over the 3 built-ins, every `synthetic_scales.json` row, the step-6 sweep decks, `REGISTER_ANCHOR_DECK` and `REGISTER_HOME_DECK`, every index in `anchors(deck)` is in `_internal.tierPool(deck, "intermediate")`; **(ii)** "INTERMEDIATE deals a register-labelled anchor" - on `REGISTER_ANCHOR_DECK`, `tierOf(deck, [0,14,8]) === "intermediate"`, and over seeds 0..499 with chained `prev` at least one INTERMEDIATE deal contains 14 and every deal has `tierOf === "intermediate"`; on `REGISTER_HOME_DECK` at least one INTERMEDIATE deal starts on chord 2; **(iii)** no built-in anchor's subtitle matches `/\b(LOW|HIGH) VOICING\b/` (the precondition that makes (a) a no-op there) | (i) and (ii) fail on main for the right reason (missing anchor 14 / 2; `[0,14,8]` is "advanced"; 0 deals contain 14); (iii) green on main | `node --test --test-name-pattern="BASIC.anchor.is.in\|register.labelled.anchor" tests/sequence.test.js` |
| 3 | Implement D-14: `tierPool(deck, tier, anchorsList)` takes `anchorsList` as a **required** third argument (review R1, A-9): `attemptLength` passes `ctx.anchorsList` (it calls `tierPool` once per attempted length, `sequence.js:482`), so the "anchors() once per pick" property (`:528-534`) holds without a second `anchors()` call. `tierPool` and `intermediateGate` admit any index in `anchorsList` before the cap/register checks; `classifyTier` passes `ctx.anchorsList`. Update the existing `tierPool` call in `tests/sequence.test.js:989` and step 2's calls to pass `anchors(deck)`. Update the D-4 comment at `:293-295` | step 2 green; step 1 fixture test green (built-in deals unchanged); BASIC golden fixture test green; every test that passes today passes | `node --test tests/sequence.test.js` |
| 4 | Tests first for (e), red: "tierOf returns null for a sequence ADVANCED can never deal" - capDeck `[0,1,2]` → `null`; flip `:513`, `:529`, `:561` from "advanced" to `null`; a 4-chord and a 6-chord twin assert "advanced" so ADVANCED stays pinned at both ends; a 7-chord connecting sequence asserts `null` (review C5, A-13). Then change `classifyTier`'s catch-all to `n >= 4 && n <= 6` (otherwise `null`) and update its comment (`:351-375`) | 3-chord and 7-chord assertions red on main (both return "advanced"); green after; golden fixtures (all ADVANCED ones are 4-6 chords) unchanged; step 1 fixture unchanged (`pick` never asks about length 3 or 7+ for ADVANCED; measured 0 deal diffs for length 3) | `node --test --test-name-pattern="tierOf" tests/sequence.test.js` |
| 5 | Fix the budget test's blind spot (c), in two commits (review R4, A-12). **5a, structural, no behaviour change:** extract `_internal.makeAccept(deck, tier, matrix, excludeSeq, ctx)` and have `attemptLength` use it; every existing test green. **5b:** `dfsFindAll` sets `stats.truncated` true iff a node was actually refused - one budget check at `rec` entry (`if (nodes >= budget) { truncated = true; return; }`), the `&& nodes < budget` loop condition dropped, so a search that finishes on exactly its last allowed node is not flagged (review R3, A-11). Keep the existing node-ceiling test and add `stats.nodes <= budget` to every new case (review C2, A-10). New test "the DFS fallback completes and finds the exact exhaustive set": on `REVIEWER_DECKS[0]` at ADVANCED length 4, and on each built-in at INTERMEDIATE length 3, `stats.truncated === false` and the found set equals a brute-force enumeration (every `startSet x pool^(len-1)` tuple filtered by the same `makeAccept`). New test "the DFS budget truncates exactly at the boundary": on `REVIEWER_DECKS[0]` ADVANCED L4, budget 13,605 → `truncated === false`, `nodes === 13605`, exact set; budget 13,604 → `truncated === true`, `nodes <= 13604`. Header comments state the 13,605 / 15,000 headroom and what a red result means | 5a: whole file green. 5b: removing the matrix prune (`sequence.js:465`) or the identical-card prune (`:464`) turns the completion test red (measured: truncated at 15,000, 9,130 / 8,842 of 10,468 found); removing the budget guard turns the boundary and ceiling tests red; `truncated` hard-wired `false` turns the 13,604 case red; green on the real engine (measured 13,605 nodes, 10,468 = brute force) | `node --test --test-name-pattern="DFS" tests/sequence.test.js` |
| 6 | Strengthen the step-6 sweep (b), renamed "generated decks: every tier deals its own tier, in range and connected, under 50ms": rows = today's 37 sweep decks + `REVIEWER_DECKS` + `REGISTER_ANCHOR_DECK` + `REGISTER_HOME_DECK`; seeds 0..4 per deck per tier, `prev` chained; for each dealt sequence assert `tierOf === tier`, length in the tier's range (basic {2,3}), and every consecutive pair, including the loop-back, is non-identical and connects (`connectsRef`); keep the no-throw and < 50 ms per pick checks. Close the vacuous-pass holes (review C4, A-14): every row must build (no silent skip), and the only `reason` allowed is `NO_HOME_CHORD`, and only on a row whose `homeAnchor` is `null` - measured today that is exactly 3 rows x 5 seeds, `NO_HOME_CHORD` x15 per tier | green on the fixed engine; the DFS-leaf-skips-accept mutant (`sqd_12`) is killed by this test alone (measured: 12 / 12 fallback deals invalid); a `pick` that returns `NO_TIER_SEQUENCE` on any dealable row turns it red | `node --test --test-name-pattern="generated.decks" tests/sequence.test.js` |
| 7 | Sync | engine region matches | `python3 tools/inline_engine.py && python3 tools/inline_engine.py --check && python3 tools/validate.py` |
| 8 | Mutants, each with `# kills:` naming its test and a `.`-wildcard `# suite:` (no quotes): `sqd_07` gate anchor-exemption dropped (killed by step 2 (ii)); `sqd_08` pool anchor-exemption dropped (step 2 (i)); `sqd_09` catch-all back to `n >= 3` (step 4); `sqd_10` DFS matrix prune dropped (step 5); `sqd_11` DFS identical-card prune dropped (step 5); `sqd_12` DFS leaf skips `accept` (step 6); `sqd_13` DFS budget guard removed (step 5 boundary test, review C2); `sqd_14` ADVANCED upper bound dropped (step 4's 7-chord assertion, review C5). **Hand-rewrite `sqd_04`** so its hunk mutates the new `n >= 4 && n <= 6` line to return "intermediate" (review C3: its removed line no longer exists, and `refresh_mutants.py` raises `Unfixable` on that). Commit every engine and `index.html` change BEFORE running either refresh tool: both need clean target files. Then refresh stale patches across the whole directory | every new mutant and the rewritten `sqd_04` killed by its named test; `refresh_mutants.py --check` clean over all of `tests/mutants/`; `b_*` regenerated on a clean tree | clean working tree, then `python3 tools/refresh_mutants.py --check`, `python3 tools/regen_data_mutants.py`, `node --test tests/mutation_harness.test.js`; the full sweep is CI's |

Merge gates: §5 unchanged (CI green at the verified head SHA including every mutation shard; a fresh `swarm-reviewer` returns PASS/PASS_WITH_NITS at that SHA; `gh pr merge --merge`; never the full e2e suite or `mutation_check.sh` locally). The reviewer is also briefed on §9.1's built-in-invariance proof, so it can check the step 1 fixture commit precedes the engine edit.

### 9.3 CI runtime added (measured locally at `154d516`; CI ≈ 2.5x)

| Test | Local | Source |
|---|---|---|
| Step 1 tier fixture (1,200 built-in picks) | +0.92 s | `scratchpad/d3/probe_t2.js` |
| Step 2 (i) nesting over ~65 decks | +0.1 s | 20 synthetic rows in 9 ms; build dominates |
| Step 2 (ii) 500 INTERMEDIATE picks on `REGISTER_ANCHOR_DECK` (+ `REGISTER_HOME_DECK`) | +0.75 s | 366 ms per 500, `probe_t.js` |
| Step 5 exact-set DFS (4 searches + brute force) | +0.03 s | `probe_c2.js` |
| Step 6 sweep, 1 → 5 seeds, +6 rows | +0.3 s | 94 → 289 ms for the 37 rows, `probe_b.js` |
| Step 5 boundary test (2 searches at 13,604 / 13,605) | +0.02 s | ~8 ms per search, `probe_c2.js` |
| Step 4 extra twins (6- and 7-chord `tierOf`) | ≈ 0 | |
| Existing node-ceiling test | kept, 0 | review C2 |
| **Total** | **≈ +2.1 s** on 44.4 s today (≈ +5 s in CI) | |

### 9.4 /plan-eng-review on the amendment (2026-10-02, AFK)

Spawned session, medium effort. Every decision point was auto-chosen as the recommended option; each one is ledger row A-9..A-16. The outside voice was `codex exec` (read-only) on §9 plus `sequence.js`, `sequence.test.js` and `tests/mutants/sqd_04_*`. All 5 of its findings were checked against source and accepted.

**Findings and dispositions**

| # | Sev | Finding | Disposition |
|---|---|---|---|
| R1 | P2 | `tierPool` is called once per `attemptLength` (`sequence.js:482`) with no anchors argument, so "take `anchorsList` from ctx" had no route into it | Step 3: required third argument, passed from `ctx` (A-9) |
| R2 | P2 | The `REGISTER_HOME_DECK` claim (home anchor never dealt) rested on the 1,894-deck count, not on a direct probe | Probed (`probe_h.js`): 0 → 144 of 500 starts; quoted in §9.1(a) |
| R3 | P3 | `stats.truncated` meaning was loose: with two budget checks, a search that ends on its last allowed node can look truncated | Step 5b: one check at `rec` entry, set only on a refused node (A-11) |
| R4 | P2 | The `makeAccept` extraction was folded into a behavioural change, so a regression there could not be bisected | Step 5a: its own structural commit first (A-12) |
| C1 | HIGH | §9.1(f) said a pool-only cap removal is equivalent; on a budget-bound deck it changes availability | (f) rationale corrected; still NO ACTION (A-15) |
| C2 | HIGH | The old budget test is not fully circular: it kills budget-guard removal, and step 5 as written dropped that coverage | Keep the ceiling test; add the 13,604 / 13,605 boundary test and `sqd_13` (A-10) |
| C3 | MED | `sqd_04`'s removed line is the line step 4 rewrites, so `refresh_mutants.py` raises `Unfixable`; both refresh tools need clean target files | Step 8: hand-rewrite `sqd_04`; commit before refreshing (A-16) |
| C4 | MED | The strengthened sweep could still pass vacuously: failed builds are skipped, and every pick could return a reason | Step 6: every row builds, only `NO_HOME_CHORD` on null-home rows (A-14) |
| C5 | MED | `n >= 4` still calls 7+ chord sequences "advanced", contradicting D-15's own reason | D-15 and step 4: `4 <= n <= 6`, else `null`; `sqd_14` (A-13) |

**Test coverage after D3** (each changed code path → the test that can fail on it → the mutant proving it)

```
tierPool  anchor exemption ──────── step 2 (i) nesting ─────────────── sqd_08
intermediateGate anchor exemption ─ step 2 (ii) [0,14,8], draws ────── sqd_07
classifyTier  n == 3 → null ─────── step 4 3-chord + flipped :513/529/561 ─ sqd_09
              n in 4..6 → advanced  step 4 4/6-chord twins, golden ─── sqd_04 (rewritten)
              n >= 7 → null ─────── step 4 7-chord ─────────────────── sqd_14
dfsFindAll    matrix prune ──────── step 5 exact set ───────────────── sqd_10
              identical-card prune  step 5 exact set ───────────────── sqd_11
              budget guard ──────── step 5 boundary + ceiling ──────── sqd_13
              stats.truncated ───── step 5 boundary (13,604 case) ──── (covered by sqd_13 path)
              leaf calls accept ─── step 6 sweep ───────────────────── sqd_12
built-in deals unchanged ────────── step 1 pre-D3 fixture + BASIC golden
```

**Failure modes checked**

- The exemption leaks a non-anchor LOW/HIGH card into INTERMEDIATE: step 2 (ii) asserts `tierOf === "intermediate"` on every deal, and D-4's existing register test still runs.
- Built-in deals drift: step 1's fixture (chords, style and the next rng value) fails on any change, and §9.1(a) proves none is expected.
- The boundary test goes stale if node counting changes: the counts 13,604 / 13,605 are re-measured in 5b before the test is written; the header comment says a red result means the prunes or the budget moved, not the deck.
- Mutant refresh hits `Unfixable`: step 8 names the one known case (`sqd_04`) and requires a clean tree first.
- D2 lands first and grows the mutant set: D3 spawns from main after D2 merges and refreshes the whole directory.

**NOT in scope:** `DFS_NODE_BUDGET`'s value; D-2's sampler/fallback semantics; BASIC; app code and the e2e suite; the identical-consecutive-card rule; a pool-cap mutant (§9.1(f)); any reopening of D-0..D-13 or A-1..A-8.

**What already exists:** `tests/fixtures/synthetic_scales.json` and the 37-row sweep (step 6 extends it), the 4 reviewer decks (hoisted, not new), the BASIC golden fixture (unchanged), `refresh_mutants.py` / `regen_data_mutants.py` (used, not changed), `connectsRef` in the test file (reused for the sweep).

**Parallelization:** sequential implementation, no parallelization opportunity. Every step edits `src/engine/sequence.js` or `tests/sequence.test.js`, and step 8 depends on all of them.

## Decision ledger

| # | Decision | Pick | Basis |
|---|---|---|---|
| A-3 | Complexity gate (8+ files) | Original arrangement | Lanes already split on the generated-region boundary |
| A-4 | E-1 fix | Connect matrix per call | Measured 115 ms → ~1.6 ms setup |
| A-5 | E-3 truncated DFS | Draw from partial set, documented | Reachable only off built-ins; a complete search on a huge space defeats the bound |
| A-6 | E-4 parity oracle | Golden fixture before engine edit | Only oracle a basic-routing mutant cannot pass |
| A-7 | E-2, E-5, E-6, E-7, E-8 | Fix as stated | Each a concrete break with one obvious fix |
| D-14 | 2026-10-02, source: **owner** - "Starting chords always allowed" | Every anchor is in the INTERMEDIATE pool and passes its gate, LOW/HIGH or not | Owner decision; D3 §9 item (a) |
| A-8 | D3 item (e): length-3 sequence failing INTERMEDIATE | `tierOf` → `null` (D-15) | Recommended in the brief; ADVANCED never deals length 3; 0 deal diffs measured |
| A-9 | D3 review R1: how `tierPool` gets anchors | Required third argument `anchorsList`, passed from `ctx` | Explicit over clever; keeps "anchors() once per pick" |
| A-10 | D3 review C2: budget-guard coverage | Keep the node-ceiling test; add the 13,604 / 13,605 boundary test and `sqd_13` | The old test was the only one that killed guard removal |
| A-11 | D3 review R3: `stats.truncated` | True iff a node was refused; single check at `rec` entry | An exact-budget completion is complete, not truncated |
| A-12 | D3 review R4: `makeAccept` extraction | Separate structural commit (5a) before 5b | Bisectable; 5a must leave every test green |
| A-13 | D3 review C5: lengths 7+ | `classifyTier` → `null` outside 4..6; `sqd_14` | Same reasoning as D-15's length-3 case |
| A-14 | D3 review C4: vacuous sweep | Every row builds; only `NO_HOME_CHORD`, only on null-home rows | Measured: exactly 3 rows x 5 seeds today |
| A-15 | D3 review C1: item (f) | Stays NO ACTION, rationale corrected (same accepted set; availability can differ on budget-bound decks) | Needs a contrived deck; gate is the single enforcement point |
| A-16 | D3 review C3: `sqd_04` refresh | Hand-rewrite; commit engine + `index.html` before running either refresh tool | `refresh_mutants.py` raises `Unfixable`; both tools need clean targets |

**Approval readiness: PASS** - the D3 amendment is ready for the lane to be spawned once D2 merges.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | - | - |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | issues_found → folded | 4 (E-2, E-3, E-5, E-7) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | clean (AFK auto-decided) | run 1 (D1/D2): 8 found, 8 folded; run 2 (D3 amendment): 9 found (R1-R4, C1-C5), 9 folded |
| Outside Review | `codex exec` (in run 2) | Independent voice on §9 | 1 | completed | 5 (C1-C5), all accepted |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | clean (AFK auto-decided) | 7 → 9 |

**OUTSIDE COVERAGE:** run 1: codex exec (read-only) on the plan + `sequence.js`, 4 of 4 findings accepted, 1 (E-5) verified against source. Run 2: codex exec (read-only) on §9 + `sequence.js`, `sequence.test.js`, `sqd_04`; 5 of 5 findings accepted, C3 verified against the patch file, C1 and C2 reflected in corrected §9.1 verdicts.
**VERDICT:** ENG + DESIGN CLEARED - D1/D2 ready to implement; D3 ready to spawn after D2 merges.

NO UNRESOLVED DECISIONS
