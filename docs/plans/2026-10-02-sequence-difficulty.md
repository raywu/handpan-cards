# Sequence difficulty tiers

- **Goal:** after the lanes below merge, `HPE.sequence.pick` deals BASIC, INTERMEDIATE or ADVANCED chord progressions per the tier rules on every deck, generated decks included, and the settings panel shows an always-visible DIFFICULTY selector that is live in CHORD PROGRESSION mode and greyed out and inert in every other mode. BASIC deals exactly what it deals today.
- **Date:** 2026-10-02
- **Base:** `main` @ `61b01c2` (merge of PR #200). Every file:line below was read at that SHA.
- **Shape:** /swarm, two lanes, serialised: D1 (engine) then D2 (app region of `index.html`). D2 spawns when D1 merges.
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
- **D-2 Generation.** INTERMEDIATE and ADVANCED use uniform rejection sampling. The length is drawn ONCE, before sampling, per D-3, and stays fixed for all attempts and the fallback (eng E-2). Per attempt: a start uniformly from the tier's start set, then each later position uniformly from the tier's pool; accept iff `tierOf` returns this tier, every consecutive pair and the wrap connect, and the result is not `prev`. Cap 512 attempts. `pick` builds an n x n connect matrix once per call (Pygmy: 2,704 `connects` calls, ~1.6 ms measured) and both the sampler and the fallback read it; raw `connects` costs ~0.6 µs a call, so 200k uncached calls measured 115 ms (eng E-1). *Why:* independent uniform draws accepted by a predicate are exactly uniform over the accepted set within a length (unlike a greedy walk, which biases toward high-degree cards), deterministic under a seeded rng, and §2.3 shows the cap is unreachable on built-ins. **Fallback on cap exhaustion:** bounded exhaustive DFS over the tier's space with a node budget of 200,000; a COMPLETE search draws uniformly from what it found, or reports the length empty; a search that hits the budget draws uniformly from what it found so far (traversal-order bias accepted: it is reachable only off the built-ins, after 512 misses on a space too large to finish) and reports the length empty only if it found nothing. `NO_TIER_SEQUENCE` is returned once every length is empty (eng E-3). A tiny generated pan is the only realistic way to reach the fallback, and its space is small enough for the budget.
- **D-3 Draw distribution.** Length is drawn first, uniformly over lengths that have at least one sequence, as BASIC does. "Has at least one" is decided lazily: a length whose 512 attempts and fallback both come back empty is dropped and the length is redrawn among the rest. No-repeat: `prev` is rejected inside the acceptance test, and if `prev` is the only sequence the tier has, it is returned (mirrors BASIC's E4 rule). *Why:* without length-first, ADVANCED would be ~99.9% length 6 on Pygmy (§2.2).
- **D-4 LOW/HIGH on generated decks.** A card is LOW/HIGH iff its `subtitle` matches `/\b(LOW|HIGH) VOICING\b/`. If D1 step 1 finds the generator never emits that qualifier, generated decks simply have no LOW/HIGH cards: INTERMEDIATE's pool is then "≤4 notes", and ADVANCED is still reachable through 5+ notes, a non-home start, length 5-6, or a free repeat. *Why:* computing register from field heights would invent a classification the owner has never seen on a card face; the subtitle is what the player reads.
- **D-5 Score.** Not shipped. The Q/F/L/M/R/S/H scorer moves into `tests/helpers/sequence_score.js` and backs the golden-fixture tests. *Why:* `pick` never ranks, so an engine score is dead code that a mutant cannot kill.
- **D-6 Empty tier.** `NO_HOME_CHORD` keeps priority on every tier. `TOO_FEW_CHORDS` stays BASIC's reason. INTERMEDIATE/ADVANCED return `NO_TIER_SEQUENCE` when D-2's fallback finds nothing. The app shows: "This scale has no {TIER} progressions. Pick another difficulty or another scale." (tier name in its all-caps button spelling, so it matches the control).
- **D-7 Persistence.** `store.tier` in `hpfc` (read-modify-write via `save()`), type-guarded on read like `store.mode` (`index.html:6019`): only the three ids survive, anything else reads as `"basic"`. Not in the share URL (N34). *Why:* per-viewer convenience, same lifetime as the mode itself.
- **D-8 Selector placement (design pass).** Its own `.panel-group` with heading "Difficulty", placed directly after the Practice group so it reads as part of the mode choice. In the landscape grid it becomes its own cell; in the desktop sidebar it stacks. *Why:* a second heading inside Practice would be a new label style; a separate group reuses `.panel-heading` exactly.
- **D-9 Selector layout (design pass).** Three `.mode` buttons, BASIC / INTERMEDIATE / ADVANCED, left to right = easiest to hardest, in a `.tierbar` row with equal `flex:1 1 0` widths when the content box is ≥ 348px, otherwise a single column of full-width buttons (each 44px). Implemented with one container rule, not three breakpoints: `display:grid; grid-template-columns:repeat(auto-fit, minmax(111px, 1fr))` is rejected because it produces a ragged 2+1 between 230px and 347px. Use `flex-direction:column` by default and switch to row under `@container tier (min-width:348px)`; the group carries `container:tier / inline-size` (first container query in the repo; no support → column, which is always correct). Inline-size containment makes a shrink-to-fit parent collapse the group to zero width; today every context gives it a definite width (mobile `min(420px,100%)`, sidebar `align-items:stretch`, landscape grid cell stretch), and D2 step 2 asserts the group's width equals its siblings' in all four viewports so a later `align-items:center` cannot silently zero it. The tier buttons do NOT reuse `.modebar` (its `#modeS{flex:1 0 100%}` and wrap rules are mode-specific); `.tierbar` is a new layout class only, no new visual style. *Why:* §2.6; a 2+1 wrap breaks the easy-to-hard reading order.
- **D-10 Greyed state (design pass).** Outside mode S the three buttons carry the native `disabled` attribute (out of Tab order, announced unavailable, already skipped by the panel trap) and render with the existing disabled precedent: `opacity:.5; cursor:default`, no `:active` feedback. The remembered tier keeps its `.on` styling at half opacity, so the player can see what they will get. A `.panel-note` (existing class, `index.html:211`) under the buttons, visible only while disabled, says: "Pick CHORD PROGRESSION to change this." It is wired with `aria-describedby` on each of the three buttons (not the group: a describedby on a non-interactive container is not announced when a screen reader lands on a button in browse mode). The "Difficulty" heading stays at full colour; only the buttons dim, so the group never reads as missing. No new colour, typeface or label style. *Why:* a disabled control with no explanation is a dead end; the note gives direction in the panel's own voice and copies the mode button's exact label.
- **D-11 Interaction.** A tier button sets `aria-pressed`/`.on` exclusively (same as the mode buttons, `index.html:8077`), saves, re-deals (`setOrder()` with `prev` cleared, since a new tier makes the old sequence irrelevant), renders, and calls `closePanel()` so the mobile player lands on the new progression, matching the mode buttons. Clicking the already-pressed tier also re-deals. On the desktop sidebar `closePanel()` is a no-op and focus stays on the pressed button. Re-deal is synchronous (D1 step 6 bounds it at < 50 ms), so there is no loading state; the only non-happy state is D-6's empty message.
- **D-12 Rail at 4-6 chords (design pass).** `.seq-rail` may wrap to at most two lines at 380px portrait and must stay inside the existing landscape footer box: `flex-wrap:wrap; justify-content:center` on the rail, with separators kept attached to the following name (`white-space:nowrap` per "→ name" unit). No font-size change. If the two-line bound or the landscape box fails at the longest built-in ADVANCED sequence, D2 escalates rather than shrinking type (N28: no new chrome budget rows).
  owner, 2026-10-02: one-line horizontally scrolling rail; current chord kept in view; card size never changes
- **D-13 Lane split.** Serialised, not parallel. D1 touches `index.html` only inside the generated `<!-- engine:sequence -->` region via `tools/inline_engine.py`; D2 touches only outside it. Textual conflict is impossible, but D2 builds on D1's API, so spawning D2 before D1 merges means building against a world without its dependency.

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

## §7 AFK auto-decisions

D-1 through D-13 above were auto-picked under the AFK grant (2026-10-02), each the option the plan recommends. Owner decisions: D-0. Reviews: §8.

Process auto-decisions:
- **A-1** /plan-design-review ran on measurements and real CSS instead of a mockup board: nobody is present to pick a variant.
- **A-2** gstack upgrade offered by the skill preamble was deferred: not part of the task, and an upgrade mid-run changes the review skills under the run.
- **A-3..A-7** /plan-eng-review auto-decisions: see the decision ledger in §8.

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

- [E-1] (confidence 9/10) D-2 / D1 step 6 - a 200k-node DFS on raw `connects` measured 115 ms on Pygmy, and the lazy length drop can run it per length: the 50 ms bound fails. Fix: one connect matrix per `pick`.
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

## Decision ledger

| # | Decision | Pick | Basis |
|---|---|---|---|
| A-3 | Complexity gate (8+ files) | Original arrangement | Lanes already split on the generated-region boundary |
| A-4 | E-1 fix | Connect matrix per call | Measured 115 ms → ~1.6 ms setup |
| A-5 | E-3 truncated DFS | Draw from partial set, documented | Reachable only off built-ins; a complete search on a huge space defeats the bound |
| A-6 | E-4 parity oracle | Golden fixture before engine edit | Only oracle a basic-routing mutant cannot pass |
| A-7 | E-2, E-5, E-6, E-7, E-8 | Fix as stated | Each a concrete break with one obvious fix |

auto-decision (AFK), 2026-10-02: the shipped panel deviates from D-8 and D-9 as written, both under the panel-fit budget forced by owner decision "Fix layout before merge" (bounce 5, reviewer FAIL #4). D-8 specified its own `.panel-group` with a "Difficulty" heading; the shipped `#panel-tier-group` has no heading and reads as part of Practice instead - a 5th panel-group (with its own heading row) was the proximate cause of the 110/129-cell landscape-grid overflow regression bounce 5 fixed, and removing the heading's own line keeps the group's height down without touching the tier buttons themselves. D-9 specified a `@container tier (min-width:348px)` switch between a single column (narrow) and an equal-width row (wide); the shipped `.tierbar` is `display:flex; flex-wrap:wrap` unconditionally (index.html's own comment at the markup site: "D-9's container-query design was dropped for plain flex-wrap"), which is narrower in its tightest wrap (three buttons wrapping individually, not jumping straight to a full single column) and was cheaper to fit inside the same budget. Rationale is panel-fit space, not a design objection to either D-8 or D-9 - this is a budget-driven simplification, not a reconsideration of the design pass's reasoning. Not changed unilaterally: see D2's bounce-5 report for an opinion on whether to reinstate either piece now that the fit crisis is resolved.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | - | - |
| Codex Review | `/codex review` | Independent 2nd opinion | 1 | issues_found → folded | 4 (E-2, E-3, E-5, E-7) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | clean (AFK auto-decided) | 8 found, 8 folded |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | clean (AFK auto-decided) | 7 → 9 |

**OUTSIDE COVERAGE:** codex exec (read-only) on the plan + `sequence.js`; 4 of 4 findings accepted, 1 (E-5) verified against source.
**VERDICT:** ENG + DESIGN CLEARED - ready to implement.

NO UNRESOLVED DECISIONS
