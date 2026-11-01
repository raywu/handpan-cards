# Neotone course correction

2026-11-01. Mode: plan only (no code, commits, PRs or Linear writes). AFK armed. Refs TRI-17. Rewritten after three NOT_READY reviews (see "Regroup").

Authority: dev's `docs/plans/2026-10-30-neotone-option-b.md` at origin/dev b5aed492 ("the OB plan"), as amended by the C0 table below. Line numbers below are of `git show b5aed492:docs/plans/2026-10-30-neotone-option-b.md`.

## What happened (evidence)

1. The owner's Option B direction (2026-10-30) and card decisions (2026-10-31) are in the OB plan (on dev via #755; on main twin #754, open).
2. OB Q-C said P and U were to be reworked as P2/U2 after E2. They were merged to dev anyway (#750 06:44Z, #752 09:51Z), then PA-N polished their Option A strings (#794 15:25Z). #752 (commit f2d8d2a1) set `PROFILE_ENABLED` true, so served DEV has written rev-1 v5 records and v7 links (verified: `git log -p origin/dev -S'PROFILE_ENABLED: true' -- src/engine/core.js` prints only f2d8d2a1). OB Q-A's "Rev 1 data exists only inside tests" is therefore false.
3. E2, P2, U2 never started. T2 (fixture v2, ENGINE-SPEC 18) is on dev.
4. Root causes R1-R4 as before: lanes dispatched and reviewed against the base plan; no memory entry recorded the supersede; 10-31 decisions never reached a brief.

## Goal

Dev matches the owner-approved mocks plus D4: a Neotone checkbox on the Scale form and a Standard/Neotone switch on the Layout tab that follow each other, mutant tonefields as lenses on the ding side, tap-to-swap and hold-and-drag within a ring, the 10-31 card structure. No Option A element is user-visible on dev. Hard requirement (owner 2026-11-01): all UI/UX matches the three original artifacts, row by row (section "UI/UX conformance").

## Non-goals

Main merges; deck data; voicing/tier changes; a Neotone footer tag; any new harness; Option B beyond the mocks and D4; any fixture change other than the OD1 rev 3; rewriting or force-pushing any branch.

## Decisions

Owner, 2026-11-01 (not reopened):
- D1 forward-correct on dev (no revert of #750, #752, #794).
- D2 the 10-31 card decisions are final as structure: band D (main 0.046R, lens 0.024R), main numbers outside the rim (cards with a mutant note), mutant number `M<n>`, main names centred in the crescent, a Neotone scale with no mutant note = Standard engine output, F Low Pygmy 18 as the example. "Padding" means the v2 fixture gap (chord 0.506 vs 2r 0.49); the 10-31 "10% smaller" is not applied (superseded by OD1: r is 0.19R, the Chord Card value).
- D3 SUPERSEDED by OD1 (owner 2026-11-01): the v2 fixture (sha256 611b59a2…) is replaced by fixture rev 3 with Chord Card geometry. E2 owns rev 3 (fixture, spec 18, integrity sha); P2 measures label fit against it and never changes geometry.
- D4 Neotone checkbox on the Scale form beside the bottom notes; the Layout switch follows it.
- D5 `sheet.inner` drops the mutant term in all 8 tables (A10 lists the values).

AFK decisions (reversible; listed for the owner):
- A1 `PROFILE_ENABLED` stays true on dev; main has no flag line (C1 records it in this doc's "State record").
- A2 Branch mechanics (verified with git, see "Branch facts"): E2 = `claude/neotone-e` fast-forwarded to T2 head 98281e35, then E2 commits; #744 updated in place. P2 = `claude/pa-p` plus a merge commit of the E2 head; #749 updated in place. U2 = NEW branch `claude/neotone-u2` from the E2 head plus cherry-picks, in order, of f2d8d2a1 d364fdba dc1e967a e0ef8268 83c54ce6 c908b95a bd71c358 (all seven apply clean onto 98281e35, checked with `git merge-tree`); NEW main PR. Not picked: 7efaf957 and 7bd47fa4 (dev merges); 8dfd24a8 d271941c 658d81ed 049adec2 490cedb5 e3868245 (mutant/i18n refreshes, regenerated instead); 5fe640ec and 6369570e (PA-N Option A polish; 5fe640ec conflicts in `index.html`); U2 hand-ports 5fe640ec's old-client ops tests in `tests/storage_corpus.test.js` to rev 2. No push in this plan is a force-push.
- A3 Combined landing (R3-B, R4-D): E2, P2 and U2 are combined once, on `claude/neotone-m` (phase M: the E2 head, then merge commits of the P2 and U2 heads, then M's mutants), opened as a main PR only when #744, #749 and the U2 main PR each have `validate` success at a verified head and a fresh reviewer PASS/PASS_WITH_NITS at that head. Nothing lands on DEV until `validate` concludes success at the verified `claude/neotone-m` head (full CI: python-tests incl. `test_render_agreement.py`/`test_pdf_parity`, e2e, panel-fit, mutation gate) and a fresh reviewer passes that SHA. Conflict rule on `claude/neotone-m`: engine regions re-inlined (`python3 tools/inline_engine.py`), E2 side in E2-owned files, U2 side in `index.html` app code and `data/i18n`, P2 side in `pan`/`panField`, pdfcards and hifi; every Option A symbol and key from #752/#794 is deleted. Then L: `claude/dev-sync-neotone` from origin/dev merging that exact M head; the only extra resolutions allowed are dev-only hunks outside the M diff (recorded in the PR body); the A3 local run (`node --test tests/app.test.js tests/pdfcards.test.js tests/layout.test.js tests/core.test.js tests/share.test.js tests/storage_corpus.test.js tests/link_corpus.test.js && python3 -m pytest tests/test_render_agreement.py tests/test_pdf_parity.py && python3 tools/inline_engine.py --check && python3 tools/sync_i18n.py --check && python3 tools/validate.py && node tools/boot_sim.js`) on the merged tree is pasted in the PR body (CI does not run on dev PRs). Merge under the `claude/dev-sync-*` grant. Until it lands, dev keeps the Option A code as is (no partial landing).
- A4 E2 changes `proposeProfile`, `HPE.layout.PROFILE` and `solve` in place (no legacy export). Callers are fixed by their owners on their own branches: `index.html` app code and `tests/app.test.js`/`storage_corpus.test.js` by U2; `PROFILE_DRAW` in `src/engine/pdfcards.js` and `tools/hifi.py`, and the PA tests in `tests/pdfcards.test.js`/`test_render_agreement.py`, by P2; the PL tests in `tests/layout.test.js` and the `rev: 1` builders in core/share/scale/link_corpus tests by E2 (inventory in "Coupling").
- A5 Rev-1 data (engine, E2): `HPE.core.migrateProfile(raw, fields) -> {map, unplaced}`. A rev-1 map that is ring-strict and maps every non-ding field is returned unchanged (identity). Any other rev-1 map (cross-ring key, inner key, missing note) is replaced by `proposeProfile(fields)` (pitch order, so bottoms compact to s1..sN). `readProfile` accepts rev 1 only through it. `HPE.share.decode` emits `rev: 2` for a ring-strict `pair-` map and `rev: 1` otherwise; the wire is unchanged.
- A6 Rev-1 data (open behaviour, U2): stored bytes are never rewritten until the user saves. A record or link whose migration has empty `unplaced` opens as Neotone with the migrated map. One with non-empty `unplaced` (DEV Pygmy) shows its cards as the Standard render of its notes; Edit opens the sheet in Neotone with the migrated map and the decision-8 cause messages, SAVE held until the listed notes are removed; SAVE then writes rev 2. `savedMeaning` of every stored record is computed from the stored options and is byte-identical before and after the landing.
- A7 Ninth tonefield and non-mutant scales: with at least one mutant note, all nine main tonefields and nine lenses use the fixture; empty ones draw neutral (preview adds the number) and accept a tap-move or drop. With no mutant note, geometry is the Standard solve of the notes; the main half orders the Standard seats (p_k = Standard rim seat k; entries past the rim count are null); a swap permutes notes over those seats. This is the profile's own placement, not `seats`/`angles`, so ENGINE-SPEC 18.2's ban on combining them still holds. Adding the first bottom note re-lays the pan to the fixture (C3 checks the jump). C3 may overturn either.
- A8 (R3-D) Ticking the Scale-form checkbox does exactly what the Layout switch does: Neotone on, extras already in the scale named with the decision-8 messages, SAVE held; ticking is never refused and needs no reason key. The owner's 10-30 rule stays: while ticked, typing a 10th top note or `|` is an inline input error. `NEOTONE_INPUT` is an engine REASONS code (R4-H): E2 adds it to `HPE.core` REASONS and the ENGINE-SPEC section 18 refusal table (the `tests/core.test.js` REASONS/spec test covers it); U2 owns the `reason.NEOTONE_INPUT` i18n values in all 8 tables and the inline error UI.
- A9 Docs (R3-G): C0's docs live on `claude/neotone-cc-docs` from origin/dev, touching only `docs/plans/`. Its dev PR merges on the owner's word. Lanes and reviewers are briefed from that branch's head SHA (`git show <sha>:docs/plans/...`), so no lane waits for it and no lane carries it. Its paths are all under `docs/plans/`, the `tools/ci_scope.py` docs-only set; dev PRs run no CI.
- A10 `sheet.inner` exact values: en "TOP INNER (CYCLOPS) NOTE (OPTIONAL)"; de "OBERER INNENTON (CYCLOPS, OPTIONAL)"; es "NOTA INTERIOR (CYCLOPS) (OPCIONAL)"; fr "NOTE INTÉRIEURE DU DESSUS (CYCLOPS) (FACULTATIVE)"; it "NOTA INTERNA (CYCLOPS) (OPZIONALE)"; ja "内側のノート（サイクロプス・任意）"; zh-Hans "正面内圈音（Cyclops，可选）"; zh-Hant "上殼內圈音（Cyclops，選填）". U2 tests all eight by value.

## Coupling (origin/dev b5aed492; what must change together)

| Reader | File (owner) | Reads | Breaks when E2 lands because |
|---|---|---|---|
| `commitOptions`, `solvePairedPreview` | `index.html` app (U2) | writes `{rev: 1, map}`; parks loose notes in free slots of either ring | ring-strict `readProfile` refuses parked inner/cross keys |
| `syncProfile`, `resetAreas` | `index.html` app (U2) | `proposeProfile(...).value` as an 18-array | value becomes `{map, unplaced}` |
| `pairedOverlay`, `PROFILE_SLOT_COUNT` | `index.html` app (U2) | `HPE.layout.PROFILE.primary/secondary/areas/slots` | v2 literal has `main/mutant`, no `areas` |
| `PROFILE_DRAW`, `profileExtent`, `drawPan` | `src/engine/pdfcards.js` (P2) | v1 primary/secondary, `place` as `[angle, orbit, r]` | place gains `kind`, lens figures |
| `PROFILE_DRAW` | `tools/hifi.py` (P2) | same | same |
| "PA: the draw figures are a literal copy…" | `tests/pdfcards.test.js` (P2) | `E.layout.PROFILE[k]` == `PROFILE_DRAW[k]` | PROFILE is v2 |
| `PROFILE_DRAW` assertion | `tests/test_render_agreement.py` (P2) | hifi v1 figures | same |
| "PL: HPE.layout.PROFILE is exactly the frozen fixture", "PL: proposeProfile fills primaries…", "PL: … refuses a 19th note" | `tests/layout.test.js` (E2) | v1 fixture, array return | rewritten to v2 |
| `rev: 1` map builders | `tests/core|share|scale|link_corpus.test.js` (E2); `tests/app.test.js`, `tests/storage_corpus.test.js` (U2) | `proposeProfile(...).value` as array | return shape |
| `savedMeaning` (`meaning.push(o.profile.map)`) | `index.html` (U2) | stored map | A6 pins it unchanged |
| `share.js` decode | engine (E2) | always `rev: 1` | A5 |
| `pan()` | `index.html` render (P2) | `HPE.pdfcards.PROFILE_DRAW`, `profileExtent` | v2/rev-3 draw figures |
| `_profile_radius` | `tools/decks.py` (P2) | v1 PROFILE radii | rev-3 figures |
| `profile_case_*_v1.json`, `dump_app_render.js` | `tests/fixtures/`, `tools/` (P2) | v1 draw output | regenerated as `_v2` from rev 3 |
| needles "rev 2", "ring-strict", "unplaced", "pitch order", "M<n>", "proposeProfile" | `tests/test_fixture_integrity.py` (E2) | spec 18 wording and fixture sha 611b59a2 | E2 rewords spec 18 and adds rev 3; needles and sha updated in the same E2 commit |

Hence A3: no subset of E2/P2/U2 can land on dev alone without breaking dev.

## Branch facts (verified 2026-11-01, origin fetched)

- Heads: neotone-e 701c06fc, neotone-t2 98281e35, pa-p e769ae47, pa-u 7bd47fa4, pa-u-nits e3868245, dev b5aed492, main c6ef6b58. #744/#749/#751/#754/#793 OPEN, base main, MERGEABLE.
- First-parent vs main: neotone-e = 8fd2e65e f8612724 701c06fc. neotone-t2 = those + a504aec4 f8d38543 75a1d7bb 98281e35 (neotone-e is an ancestor, so A2's T2 merge is a fast-forward). pa-p = E's three + 0b65b0bc 3755f19a 2d64dce7 e769ae47 (no merges). pa-u = E's three + f2d8d2a1, 7efaf957 (merge dev), 8dfd24a8 d271941c 658d81ed d364fdba dc1e967a e0ef8268 049adec2 83c54ce6 c908b95a 490cedb5 bd71c358, 7bd47fa4 (merge dev). pa-u-nits = 28 dev merge commits (first parent is dev) + 5fe640ec 6369570e e3868245.
- Dev-only: all of pa-u-nits' first-parent chain except its last three commits; pa-u's two merges. All five branches are ancestors of dev.
- Force-push: a clean main twin of pa-u or pa-u-nits needs a history rewrite, i.e. a force-push of a branch this lane did not create, which no AFK grant covers. A2 avoids it with a new branch; P2 and E2 only add commits.

## Phases

| # | Owner | Prereq | Deliverable | Observable acceptance |
|---|---|---|---|---|
| C0 | agent | none | Branch `claude/neotone-cc-docs` from origin/dev b5aed492: this doc, plus the OB plan edited exactly per the C0 table; a dev PR (A9). Memory: `queued-neotone-option-b.md` (supersede; dispatch from the amended OB plan at the docs head SHA; briefs quote it) and its MEMORY.md line. The local untracked OB copy is replaced with `git show origin/dev:` output, never committed. | `git diff b5aed492 <head> -- docs/plans/2026-10-30-neotone-option-b.md` equals the C0 table row for row, compared on reflowed text (`git diff --word-diff`; R4-G); `git diff --name-only b5aed492 <head>` lists only `docs/plans/` paths; the memory file exists; `diff <(git show origin/dev:docs/plans/2026-10-30-neotone-option-b.md) docs/plans/2026-10-30-neotone-option-b.md` is empty in the local checkout |
| C1 | agent | none | State record (section below) filled. | `git grep -c PROFILE_ENABLED origin/main -- src index.html` prints nothing; `gh pr view` shows #744/#749/#751/#754/#793 OPEN at the heads in "Branch facts"; the record is in this doc on the docs branch |
| E2 | lane | C0 head SHA | A2 branch. Tests first. OB E2 acceptance as amended, plus: fixture rev 3 per OD1 (`tests/fixtures/paired_profile_v3.json`, exact content in "Fixture rev 3"; `HPE.layout.PROFILE` = rev 3; ENGINE-SPEC rows E-S1..E-S13; integrity sha, needles and rev-3 tests; the glyph-floor assertion moves to P2); `NEOTONE_INPUT` REASONS code and spec row (A8); A5 `migrateProfile`; Kurd 9 equality test in `tests/layout.test.js`: Neotone geom of `(D3) A3 Bb3 C4 D4 E4 F4 G4 A4` at its proposal map equals `node tools/gen_deck.js "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4"` geom (angles, rim, field and ding radii, number positions); `tests/link_corpus.test.js` gains v7 links written by the dev build at b5aed492 (provenance pinned): Pygmy with F5/G5 in s1/s2, Kurd 10, `(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5 D5` (10 rim). | OB E2 verify command green locally; `validate` success at the pushed #744 head; every corpus link decodes and `migrateProfile` gives the A5 result; the Kurd 9 test passes; `HPE.layout.PROFILE` deep-equals the rev 3 fixture and every OD1 figure; fresh reviewer PASS at that SHA |
| P2 | lane | E2 head green on #744 | A2 branch. OB P2 acceptance as amended (lens renderers, band D, `M<n>`, crescent-centred names, `PROFILE_DRAW` v2). Brief line: "P2 draws rev 3 (OD1) and measures label fit only; it never changes geometry; lens glyphs use the K8 factor; a glyph under 3.6 pt at depth 1/3 is reported to the owner, not fixed by changing depth." Deliverable: the measured glyph table (every lens/main glyph, all five built-ins converted plus Kurd 9 and Hijaz+1, at depth 1/3) and `tests/fixtures/neotone_card_reference.json` diff (K1). `tests/fixtures/profile_case_*_v1.json` regenerated as `_v2`; the dev `profile_case_kurd9_v1.json` seed has 9 rim notes and is replaced by the 8-rim Kurd 9 string. | OB P2 verify green; K1 reference diff within 1% of R on Pygmy and Kurd 9; glyph table committed under `docs/plans/`; lens labels ≥ 3.6 pt on F Low Pygmy 18; Kurd 9 card positions equal Standard; `validate` success at the #749 head; reviewer PASS at that SHA |
| U2 | lane | E2 head green on #744 | A2 branch `claude/neotone-u2` (E2 head + the seven cherry-picks) + new main PR. OB U2 acceptance as amended, plus: conformance rows U1-U16 and Message list M1-M8; checkbox `#scale-neotone` beside the bottom-notes field, labelled by `sheet.neotone_check` (D4 overrides mock B1 "no switch here" and thread 5d2e62f1), two-way with the Layout switch (tick or switch on = Neotone on; untick or switch off = Standard, notes kept); A8 ticking; `reason.NEOTONE_INPUT` values (code is E2's) for a typed 10th top note or `|` while ticked; A6 open behaviour; A4 callers; `storage_corpus` port of 5fe640ec ops tests to rev 2; deletes all Option A UI, keys and callers in `index.html`. | Keys absent from all 8 tables: `sheet.paired_*`, `sheet.mode_paired`, `sheet.reset_areas`, `sheet.areas_reset`, `sheet.areas_label`, `sheet.paired_dropped`; every `reason.PROFILE_*` value differs from dev's in all 8; `sheet.inner` equals the A10 value in each table; app tests: Pygmy built-in, tick → Neotone on, the M1 message (mock s5) "Neotone has 9 main tonefields. Inner notes F5 and G5 have no tonefield: remove them to save.", SAVE disabled; every message M1-M8 by exact en value; switch off → checkbox unticked; `storage_corpus` rev-1 cases per A6; i18n step (8 tables, sync, audit) and 380 px fit for label + checkbox in all 8 locales; OB U2 verify green; `validate` success at the U2 PR head; reviewer PASS at that SHA |
| M | lane | E2, P2, U2 gates | `claude/neotone-m` from the E2 head merging the P2 and U2 heads (merge commits, A3 conflict rule); OB M list (mutants); main PR. | `gh pr view` head == local tip; `validate` conclusion success at that exact SHA (`gh run list --commit <sha> --workflow validate.yml`); `python3 tools/refresh_mutants.py --check`; mutation gate green; FLOORS and README count from that run's artifacts; fresh reviewer PASS/PASS_WITH_NITS at that SHA |
| L | agent | M green and reviewed at its head | A3 dev landing: `claude/dev-sync-neotone` = origin/dev + merge of the M head. | A3 local run output in the PR body; `git diff <M head> <L merge> -- $(git diff --name-only origin/main...<M head>)` empty (A13); merged with `gh pr merge --merge`; key-absence and `PROFILE_DRAW` checks re-run on the merged dev tree (the #794 keys exist only on dev); served DEV loads the sheet with no console error |
| Q | integrator | L merged | QA guide per amended OB Q. | Artifact republished privately; amended OB Q done criterion holds |
| C3 | owner | Q | DEV check: checkbox + switch, Pygmy tick (F5/G5 named, SAVE held), Pygmy lens card, Kurd 9 plain, 8-rim + one bottom note (ninth tonefield empty), first-bottom-note jump, a DEV-era Pygmy record opening per A6. | owner sign-off |
| C4 | agent | C3 sign-off and the owner's word | Close #751 and #793 with a "superseded by <U2 PR>" comment (branches kept). | `gh pr list` shows #744, #749, #754, the U2 PR and M's PR OPEN at the SHAs recorded at L; #751/#793 CLOSED |

Order: C0, C1 -> E2 -> P2 ∥ U2 -> M (CI green) -> L -> Q -> C3 -> C4. O1-O4 were decided AFK in round 3 (see "Owner questions decided AFK"). Lanes via `/swarm`; each reviewer is briefed with the amended OB plan at the C0 head SHA, this doc, the lane's ownership row and the verified head SHA.

### E2 spec rows (ENGINE-SPEC section 18, exact)

| id | Old (dev b5aed492) | New |
|---|---|---|
| E-S1 | 18.1 "Main name: at orbit + depth/2 (0.8478) on every tonefield of a card that has a mutant note (empty lenses included), at orbit on a card with none." | "Main name: at orbit + depth/2 (0.8083) on every tonefield of a card that has a mutant note (empty lenses included). A card with none draws the Standard geometry of its notes (18.4), names at the field centre." |
| E-S2 | 18.1 "Empty main tonefields and empty mutant tonefields draw neutral on cards, print and preview; the sheet preview adds the tonefield number." | "On a card with a mutant note, empty main tonefields and empty mutant tonefields draw neutral on cards, print and preview; the sheet preview adds the tonefield number. A card with no mutant note has no empty tonefield." |
| E-S3 | 18.2 "`id` is `\"paired\"` and `rev` is `2` (rev 1 is not read);" | "`id` is `\"paired\"` and `rev` is `2`, or `rev` is `1` and the map is first passed through `HPE.core.migrateProfile` (identity on a ring-strict complete map, otherwise the pitch-order proposal);" and, after "an `i` key, or a key in the other ring, is `PROFILE_MAP_INVALID`.", add: "On a scale with no bottom note, main entries past the rim count are null and the main half orders the Standard rim seats." |
| E-S4 | 18.7 "No rev 1 map was ever produced by a served build (the flag has never been on), so rev 2 has no rev 1 reader; once rev 2 is served, a geometry change is rev 3 with a rev 2 reader." | "Two revisions are counted separately. The map rev (`options.profile.rev`) is the map format: rev 2, and served DEV produced rev 1 maps (flag on since #752), so rev 2 keeps the rev 1 migration of 18.2. The fixture rev (`paired_profile_vN.json` `\"rev\"`) is the geometry: `paired_profile_v3.json`, rev 3 (owner OD1, 2026-11-01). A geometry revision never changes the map format, so a rev 2 map draws on fixture rev 3 unchanged; v1 and v2 are superseded and kept." Also replace 18.7's opening sentence naming `paired_profile_v2.json` as current with "`paired_profile_v3.json` (fixture rev 3; v1 and v2 are superseded and kept)" (E4-E). |
| E-S5 | 18.1 "- Main tonefield: circle of radius `main.r` (0.245) at orbit `main.orbit` (0.74) on" | "- Main tonefield: circle of radius `main.r` (0.19) at orbit `main.orbit` (0.745) on" |
| E-S6 | 18.1 "- Lens: a circle of radius `mutant.r` (0.245) on the same radial line. With" | "- Lens: a circle of radius `mutant.r` (0.19) on the same radial line. With" |
| E-S7 | 18.1 "(mutant.depth 0.44 is the fraction of the main diameter, so depth is 0.2156)" and "from the pan centre (0.4656)" | "(mutant.depth 1/3 is the fraction of the main diameter, so depth is 0.1267)" and "from the pan centre (0.4917)" |
| E-S8 | 18.1 "(0.6028)" (mutant tonefield name) | "(0.6183)" |
| E-S9 | 18.1 "(n_in 0.145, 0.35)" | "(n_in 0.085, 0.47)" |
| E-S10 | 18.1 print extent "= 60.9" | "= 61.8" (extent = 1.0758 + 0.64·0.19/2 + 0.06 = 1.1966; R = round(74/1.1966, 1)) (E4-B) |
| E-S11 | 18.1, new bullet after the ding bullet | "- Decor ring: a circle of radius `decor.r` (0.355) at the pan centre, drawn on every Neotone card and the Layout preview; not a tonefield, never lit, never labelled." (E4-C) |
| E-S12 | 18.1 main-number bullet (number_out) | append: "Only when the scale has at least one mutant note; with none, main numbers sit at the Standard spot (orbit - r - n_in = 0.47)." (D4-1, thread 09263155) |
| E-S13 | 18.1 "Size is the label rule number size, 0.64 x `main.r`" and "The label rule and the 3.6 pt print floor are unchanged and apply to every glyph" | "On Neotone cards glyphs are sized per K8: main name 0.80325 x 0.62 x `main.r`, main number 0.64 x 0.62 x `main.r`, ding name 0.70875 x 0.623 x `ding.r`, lens name 0.8232 x 0.565 x `main.r`, `M<n>` 0.64 x 0.5 x `main.r`; octave digit 0.66 x its name. The 3.6 pt print floor is unchanged and applies to every glyph." Print extent bullet: "number size / 2" reads "the unscaled number size 0.64 x `main.r`, / 2", which is what pins R at 61.8 (E-S10). (E5-1) |

All E-S rows compare reflowed text. Rev 3 figures: lensC = 0.745 - (0.38 - 0.1267) = 0.4917; lens name = 0.4917 + 0.19 - 0.0633 = 0.6183; main name = 0.745 + 0.0633 = 0.8083; M number = 0.745 - 0.19 - 0.085 = 0.47.

### Fixture rev 3 (E2; exact content)

```
{ "id": "paired", "rev": 3,
  "tonefields": 9,
  "angles": [270, 230, 310, 190, 350, 150, 30, 110, 70],
  "main":   { "orbit": 0.745, "r": 0.19 },
  "mutant": { "depth": 0.3333, "r": 0.19 },
  "ding":   { "r": 0.2, "dy": 0 },
  "decor":  { "r": 0.355 },
  "n_in": 0.085, "number_out": 1.0758, "extent_margin": 0.06,
  "slots": ["p1","p2","p3","p4","p5","p6","p7","p8","p9",
            "s1","s2","s3","s4","s5","s6","s7","s8","s9"] }
```

`angles`, `slots`, `extent_margin`, `number_out`, `ding` are unchanged from v2; `decor` is new (OD1). `tests/test_fixture_integrity.py` gains `EXPECTED_SHA256_PROFILE_V3` and the rev-3 tests; v2's content and sha stay pinned and marked SUPERSEDED as v1 is. Depth check (E4-A, AFK): dev's v2 check is the strict `1 / 3 <= depth <= 0.50`, which 0.3333 fails. The rev-3 test asserts `abs(p["mutant"]["depth"] - 1/3) < 1e-4` instead; the v2 class keeps its own check unchanged. `decor.r == 0.355` is asserted by E2; P2 draws the ring (E-S11) and asserts it in render-agreement. The fixture's glyph-floor test moves to P2 (E3-E): E2 asserts geometry only; P2 asserts every glyph >= 3.6 pt with the K8 factor.

And 18.4: after "for every non-ding field" add " of a scale with a mutant note; for a scale with none, `place` carries the Standard solve's angle, `rim` and `r_note` per field with `kind` \"main\"". The 18.3 sentences are reworded per OB E2 (no "area").

### C0 table (OB plan at b5aed492; the diff must equal this)

| # | Anchor (line, exact old text) | New text |
|---|---|---|
| 1 | 69 "- Change (E2): ring-strict validation, new proposal, `PROFILE_FULL` meaning, rev 2." | "- Change (E2): ring-strict validation, new proposal, `PROFILE_FULL` meaning, rev 2, and the rev-1 migration `HPE.core.migrateProfile` (course correction A5)." |
| 2 | 71-79, from "- Safe to change without a reader" to "keep a rev-1 reader)." | "- Superseded 2026-11-01: #752 (f2d8d2a1) set `PROFILE_ENABLED` true on dev, so served DEV wrote rev-1 v5 records and v7 links. E2 keeps a rev-1 migration (A5); main has no lane E code." |
| 3 | 119 "**Q-C. Open PRs.** Rework on the same branches; close nothing." | "**Q-C. Open PRs.** Superseded 2026-11-01 by `2026-11-01-neotone-course-correction.md` A2/A3." |
| 4 | 120-127, from "- #749/#750 (P) and #751/#752 (U) are not on dev" to "E2 merges T2 into `claude/neotone-e`." | "- #750, #752 and #794 are merged to dev and are corrected forward (owner D1). E2: `claude/neotone-e` fast-forwards to T2 head 98281e35, then adds E2; #744 in place. P2: `claude/pa-p` merges the E2 head; #749 in place. U2: new `claude/neotone-u2` from the E2 head plus cherry-picks f2d8d2a1 d364fdba dc1e967a e0ef8268 83c54ce6 c908b95a bd71c358; new main PR; #751 and #793 close as superseded after owner QA. No force-push. E2, P2 and U2 are combined once on `claude/neotone-m`; after `validate` succeeds at its head, one `claude/dev-sync-neotone` PR merges that head into dev." |
| 5 | 128-130, from "- Nothing on dev conflicts" to "neither is user-reachable." | "- Dev has T2, E, P, U and PA-N, with `PROFILE_ENABLED` true since #752; all are corrected forward in the combined landing." |
| 6 | 55 S10 right cell "Empty tonefields draw neutral (decision 8) on cards, print and preview; preview adds its tonefield number." | "On a card with a mutant note, empty tonefields draw neutral (decision 8) on cards, print and preview; preview adds its tonefield number. A card with no mutant note draws the Standard geometry and has none (owner D2)." |
| 7 | 173 "\| No v7 link or v5 record was ever producible on a served build \| Verified (Q-A); re-verified at E2 start \|" | "\| Rev-1 v7 links and v5 records exist on DEV only (flag on since #752) \| Verified 2026-11-01; E2 migrates them (A5) \|" |
| 8 | 175 "\| P and U branches are not on dev \| Verified (`gh pr view 750/752`: OPEN) \|" | "\| P, U and PA-N are on dev (#750, #752, #794) \| Verified 2026-11-01; corrected forward (D1) \|" |
| 9 | 199 E2 row Owns: "refusal sentences in ENGINE-SPEC section 18 table (verbatim with REASONS)"; Prereqs "T2 on dev" | Owns: "`docs/ENGINE-SPEC.md` section 18 (refusal table verbatim with REASONS, and course-correction rows E-S1..E-S13)"; Prereqs "T2 head 98281e35" |
| 10 | 200 P2 row Prereqs "E2 on dev (G2 default = recommendation)" | "E2 head green on #744 (G2 default = recommendation)" |
| 11 | 201 U2 row Branch "`claude/pa-u` (merge E2)"; Prereqs "E2 on dev" | Branch "`claude/neotone-u2` (new; course correction A2)"; Prereqs "E2 head green on #744" |
| 12 | 202 M row Branch "`claude/neotone-m` from the stack head"; Prereqs "P2, U2 on dev" | Branch "`claude/neotone-m` from the E2 head, merging the P2 and U2 heads"; Prereqs "E2, P2 and U2 each with `validate` success at a verified head and a reviewer pass; dev receives the M head only after M's own `validate` success (course correction A3)" |
| 13 | 205-211, from "Second lander of P2/U2" to "takes the T2/E2 side." | "Lanes refreshing context-shifted existing mutant patches in their own diffs is allowed; new `pa_*` mutants belong to M. P2 and U2 never merge each other; their conflicts are resolved once on `claude/neotone-m` (course correction A3), where CI runs: engine regions re-inlined, never hand-merged (base R4); E2 side in E2-owned files; U2 side in `index.html` app code and `data/i18n`; P2 side in `pan`/`panField`, pdfcards and hifi; every Option A symbol and key from #752/#794 deleted. `claude/dev-sync-neotone` only merges that CI-green M head into dev." Anchor starts at line 205 "Lanes refreshing" (E4-F); the "Second lander" lines 205-211 are replaced, not duplicated. |
| 14 | 230 "- `readProfile`: rev 2 only;" | "- `readProfile`: rev 2, or rev 1 after `HPE.core.migrateProfile` (identity on a ring-strict complete map, else the pitch-order proposal; A5);" |
| 15 | 239 "- `solve` with a profile: `geom.place` per v2;" | "- `solve` with a profile: on a scale with a mutant note, `geom.place` per map v2; on a scale with none, the Standard solve of its notes with `place` = Standard angle, `rim`, `r_note`, kind \"main\", the main half ordering the Standard seats (A7); Kurd 9 `(D3) A3 Bb3 C4 D4 E4 F4 G4 A4` at its proposal equals `tools/gen_deck.js` output;" |
| 16 | 245-246 "a cross-ring v7 link is refused with the profile code;" | "a cross-ring or inner-key v7 link decodes as rev 1 and migrates per A5 (no refusal); a ring-strict map decodes as rev 2 and round-trips unchanged; links written by dev b5aed492 are pinned in `link_corpus.test.js`;" |
| 17 | 252-253 "(Pygmy minus F5/G5 with 6 mutant notes; Kurd 9 with empty mutant tonefields; Hijaz 8 rim, one empty main tonefield)" | "(Pygmy minus F5/G5 with 6 mutant notes; Kurd 9 `(D3) A3 Bb3 C4 D4 E4 F4 G4 A4`, no mutant note, drawn as Standard; Hijaz `[B2] (C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4`, one mutant note, main tonefield 9 empty)" |
| 18 | 256 "- Empty mutant or main tonefield: neutral outline only (decision 8), never error colour." | "- On a card with a mutant note, an empty mutant or main tonefield: neutral outline only (decision 8), never error colour." |
| 19 | 339 "empty mutant and empty main tonefields (8-rim scale) neutral" | "empty mutant and empty main tonefields neutral on Hijaz plus one bottom note, Kurd 9 with no mutant note drawn as Standard, the first bottom note re-laying the pan, Scale-form checkbox and Layout switch following each other, ticking on Pygmy naming F5/G5 with SAVE held, a DEV-era rev-1 Pygmy record opening per A6" |
| 20 | 341-342 "every decision 3-10 has a row." | "every decision 3-10 and course-correction D2, D4, A6, A7, A8 has a row." |
| 21 | 347 "- `HPE.core.readProfile(raw, options, fields)`: ring-strict, rev 2." | "- `HPE.core.readProfile(raw, options, fields)`: ring-strict, rev 2; rev 1 via `HPE.core.migrateProfile(raw, fields) -> {map, unplaced}`." |
| 22 | 371 "- Empty bottom field: Neotone allowed, every mutant tonefield empty and neutral." | "- Empty bottom field: Neotone allowed; the card draws the Standard geometry of its notes, no lenses (owner D2)." |
| 23 | 374 "- Fewer than 9 rim notes: empty main tonefields drawn neutral; legal." | "- Fewer than 9 rim notes: legal. With a mutant note, main tonefields past the rim count are empty, neutral and accept a move; with none, only the Standard seats exist (A7)." |
| 24 | 391-392 "- R8 A rev-1 record appears from an unforeseen path: E2 start check (Q-A); if found, keep a rev-1 reader rather than refusing." | "- R8 Rev-1 records exist on DEV (Q-A as amended): E2 keeps `migrateProfile`; corpus tests pin it." |
| 25 | 396 "revert U2 on dev (`claude/dev-revert-pa-u`)" | "revert the combined landing on dev (`claude/dev-revert-neotone`)" |
| 26 | 398-399 "T2/E2 can be fixed forward freely while the flag is false on every served build." | "The rev-1 migration stays for good (served DEV wrote rev 1)." |
| 27 | 403-406, from "Owner answers G1" to "owner DEV QA." | "Superseded 2026-11-01: follow `2026-11-01-neotone-course-correction.md` Phases." |
| 28 | 411 "(#744, T2's, #749, #751, M's)" | "(#744, #754, #749, the U2 main PR, M's)" |
| 29 | 586, the whole "**Superseded (integrator AFK 2026-10-30, owner may overturn at QA):** …" paragraph | "**Scope (owner D2, 2026-11-01):** on a card with a mutant note, the fixture's nine angles, empty tonefields neutral and `geom.place` from the fixture apply (ENGINE-SPEC 18.1, 18.4). On a card with no mutant note the lines above hold: Standard engine output, no padding to nine." |
| 30 | 600 "(Superseded by ENGINE-SPEC 18.1/18.4 and the fixture: fixed fixture angles, empty tonefields neutral, `geom.place` from the fixture; integrator AFK 2026-10-30, owner may overturn at QA.)" | "(Owner D2, 2026-11-01: the non-mutant equality holds; mutant cards take positions from fixture rev 3 (OD1).)" |
| 31 | 600 " (Same supersede note: 18.1/18.4 and the fixture win.)" | deleted |
| 32 | 633, after "Converting a built-in with extras (Pygmy F5/G5) still shows the flags until the notes are removed." | add: " Ticking the checkbox does exactly what the Layout switch does (course correction A8): Neotone on, extras named, SAVE held; ticking is never refused. The typed-input error key is `reason.NEOTONE_INPUT`." |
| 33 | 414, heading "## Frozen v2 fixture" | add after it: "Superseded 2026-11-01 by owner decision OD1 (course correction): fixture rev 3 `tests/fixtures/paired_profile_v3.json` (orbit 0.745R, r 0.19R, ding 0.2R, n_in 0.085R, number_out 1.0758, depth 1/3 of the diameter, decor ring 0.355R). v2 below is kept pinned and superseded, as v1 is.", then a blank line before "Frozen by lane T2" |
| 34 | 475 "Depth 1/3 fails, so the fixture takes the smallest 0.01 step that passes the 3.6 pt" | prepend: "(Superseded by OD1: depth is 1/3 by owner decision; lens glyphs meet the floor through the K8 factor, course correction O1.) " |
| 35 | 561 "(mock: r = 0.245R, orbit = 0.74R)" and 564 "(mock 0.245R)" | "(superseded by OD1: r 0.19R, orbit 0.745R)" and "(superseded by OD1: ding 0.2R)" |
| 36 | 582, the whole "**Superseded by T2 (owner G1 answer, 2026-10-30, \"bigger tonefields\").** …" paragraph | "**Owner OD1, 2026-11-01:** the v17 Chord Card numbers in this section are the spec again, frozen as fixture rev 3; ENGINE-SPEC section 18 follows rev 3." |

The E2 acceptance line 234 ("`proposeProfile(fields)` returns `{map, unplaced}`") and Interfaces line 346 stay: A4 changes the return in place.

## UI/UX conformance (owner hard requirement, 2026-11-01)

Owner: "all UI / UX must match the original artifact." The originals are the source of truth: UX Mocks (NHK2ZtAdrChie2rEMXWAGd, 14 resolved threads), Chord Card (TgFMSuaPN4ZZbkp6y71cte, 16 threads, final state) and the QA Guide (Wa9kam3ALSsF274wYDG6n2, no comments; it still describes Option A "Paired areas" and is rewritten in Q). The OB plan is a derivative; where it and an original disagree, the original wins and C0 amends the OB plan. Earlier failure: the C0 table covered only OB plan text, not the 30 comment threads; the "approved" column of the dev-today artifact was copied from the OB summary. Every row below is checked twice: an automated DOM/render test, and a human side-by-side of served DEV against the original (C3).

Source tags: M = UX Mocks (B1/B2/shared), C = Chord Card, T = comment thread, Q = QA Guide, O = owner decision (dated), OQ = owner question decided AFK (O1-O4, A12, A13).

Authority per row (owner 2026-11-01): UX Mocks for U rows; Chord Card for card and preview geometry (K1, K2, K4, K8, U11). A row that names an override (D4, OD1, F4, F5, K8) is checked against the override, not the original.

| # | Element | Original expects | Dev today (Option A) | Phase | Automated check | Human check (C3) |
|---|---|---|---|---|---|---|
| U1 | Vocabulary | "Tonefield", "mutant tonefield", "Mutant notes"; no "area", "paired", "zigzag", no invented handpan terms (T) | PAIRED AREAS, Area n main/small, RESET AREAS, "(in {area})" | U2 | grep of all 8 `data/i18n` tables and `index.html` for area/paired/zigzag/Gebiet etc. returns nothing in visible strings; `sheet.paired_*` keys absent | read every string on both tabs |
| U2 | Scale tab | Mock B1 form EXCEPT the D4 checkbox (O D4 2026-11-01 overrides B1 "no Neotone switch here" and thread 5d2e62f1): labels `sheet.top` en "Top Notes", `sheet.bottom_opt` en "Bottom Notes / Neotone Mutant Notes (optional)" (title case per O3, M B1, T); checkbox `#scale-neotone` beside the bottom field, `sheet.neotone_check` en "Neotone"; `sheet.inner` = A10 (O D5). No pan drawing on this tab | `sheet.top` "TOP RIM NOTES", `sheet.bottom_opt` "BOTTOM NOTES (OPTIONAL)", `sheet.inner` with CYCLOPS/MUTANT; no checkbox | U2 | en values exact; other 7 locales translated in the i18n step (keys present, value differs from dev, sync + audit + 380 px fit); A10 values exact in all 8; A8 two-way test | Scale tab matches mock B1 plus the checkbox |
| U3 | Neotone switch | Standard / Neotone switch on the Layout tab (M B2); D4 adds a checkbox on the Scale form that follows it | PAIRED AREAS mode only; no checkbox | U2 | A8 two-way test | tick and switch stay in sync |
| U4 | Layout tab pan | Pan appears first on the Layout tab; notes pair with tonefields, note N in tonefield N in pitch order (M B2) | 18 dropdowns | U2 | preview snapshot test per mode | matches B2 |
| U5 | Moving notes | Tap-to-swap and hold-and-drag, within one ring only; main and mutant rings separate; moving between rings goes through the Scale-tab fields (M B2, T "make a note for add/edit lane") | dropdown per slot, cross-ring parking | U2 | app tests: swap inside ring works, cross-ring swap refused, drag within ring, keyboard path for a11y | by hand on iPhone and Mac |
| U6 | No picker UI | No EDIT TONEFIELDS button, no counter, no "Placed n of n", no pickers (T "remove from B") | "Assigned n of 18", RESET AREAS | U2 | DOM has none of those ids/strings | absent |
| U7 | Messages | Exactly the strings in "Message list" below (M1-M8 incl. M2b), shown beside the switch; Neotone stays on; extras named; SAVE held; one rule for too many notes (M shared/B2/s4/s5, T) | falls back to Standard at 19 notes | U2 (+E2 for `reason.*` codes) | one app test per message, exact en value, triggering case named in the list | read every message case |
| U8 | Empty mutant tonefield | Neutral style, not the red dashed error (M B2, T) | dashed outline empty slot | U2 + P2 | style test: no error class on empty mutant | looks neutral |
| U9 | Built-in conversion | Editing a built-in saves a NEW scale; s5 line M6 says the built-in stays; bottom notes become mutant notes 1-6; top rim notes never become mutant (Amara 9 gets none); Name editable, label key `sheet.neotone_name_label` (en "Name", D4-5), prefilled = the built-in's saved name + " " + `sheet.neotone_name_suffix` (en "Neotone Mutant"), i.e. "F3 LOW PYGMY 18 Neotone Mutant" (F4; mock's "F Low Pygmy 18 Neotone Mutant" is the same rule on its mock name; case per O2); helper M7 under the name; duplicate names allowed (M shared, T) | bottoms fill small slots first, then main slots | U2 + E2 | Pygmy and Amara 9 conversion tests; prefill test asserts exactly `name + " Neotone Mutant"` for Pygmy and Amara 9; duplicate-name test | convert Pygmy and Amara 9 |
| U10 | Links | v7 carries notes, name, layout; saved scales by private local id; v6 and below open Standard; an older app shows the existing "needs a newer app" message (`NEEDS_NEWER_APP`; AFK decision A12 answers thread 43f4cec1's "please pick one"); built-in page URLs unchanged (M shared, T) | partly (A5, A6) | E2 + U2 | link corpus; an older-version decode test returns NEEDS_NEWER_APP | open an old link and a DEV-era record |
| U11 | Pitch numbers | For a scale with at least one mutant note, main numbers 1-9 outside the pan at number_out 1.0758 on cards AND the Layout preview (O OD1; overrides B2's 0.88R); with none, numbers sit at the Standard spot (orbit - r - n_in = 0.47R) on cards and the preview (K6, owner thread 09263155, AFK D4-1); mutant name in the lens at 0.6183R (E-S8); `M<n>` at 0.47R, the Standard number spot, on the same radial line, not stacked (C, threads 8e392bb2, 04c07816, D5-3); empty lenses in the preview faint, unlabelled except the tonefield number (E-S2) | n/a | P2 (card), U2 (preview) | render-agreement test; preview DOM test: number positions at 1.0758R with a mutant note and 0.47R without, `M<n>` text | numbers outside the rim on the preview and the card |
| K1 | Geometry source | O OD1 2026-11-01: Chord Card geometry, fixture rev 3: rim orbit 0.745R, tonefield r 0.19R, ding 0.2R, n_in 0.085R, number_out 1.0758, decor ring 0.355R (C, T "match standard handpan card's geometry") | v2 fixture r 0.245 at 0.74 (replaced by rev 3) | E2 (fixture) + P2 (render) | `tests/fixtures/neotone_card_reference.json` (circle centres/radii in R units, extracted from the Chord Card SVG for the Pygmy and Kurd 9 cards); rendered app and hifi cards within 1% of R | side-by-side with the Chord Card |
| K2 | Lens | Ding-side lens = intersection of the main circle with the offset circle, depth 1/3 of the main diameter (0.1267R) (O OD1, C) | v2 depth 0.44 | E2 + P2 | lens geometry test against rev 3 | side-by-side |
| K3 | Bands and outlines | Band D: main 0.046R, lens 0.024R; solid black outline on every tonefield, lens and ding; no inner hairline; band follows the crescent with a thin white gap; lit lenses banded all round (C) | per D2 | P2 | stroke-width tests | side-by-side |
| K4 | Labels | All nine main names (including tonefields with an empty lens) at orbit + depth/2 when the scale has any mutant note; at the field centre when it has none (K6, thread 0e928a74, D4-3); main numbers per U11; mutant number `M<n>` orange at the old Standard number spot; number line `3-4-6-M4`; tonefields 7-9 faint unlabelled lenses (C) | n/a | P2 | per-card label position tests, incl. tonefields 7-9 name position and a no-mutant scale | side-by-side |
| K5 | Card chrome | Frame in the root colour; pan outline solid black; no BOTTOM NOTES badge, no dashed outline, no Neotone footer tag (C, decision 13) | PA badges and dashes | P2 | negative tests | absent |
| K6 | Non-mutant Neotone | Looks like a Standard card without mutant cutouts; plain full-circle tonefields; pitch numbers where Standard puts them; Dm on D Kurd 9 Neotone has 8 main tonefields (C, T) | Option A render | P2 | Kurd 9 equality test (E2) | side-by-side |
| K7 | Footer | "<saved name>  #n" (F4): the Chord Card's "F3 Low Pygmy 18 Neotone  #12" and mock's "#37" are illustrative of that rule | unverified | P2 | footer text test on a saved converted Pygmy | read |
| K8 | Glyph sizing | Neotone cards only (AFK D4-2, owner thread 377b20d7): main names, numbers and ding = project label rule x 0.62 (rim 0.80325 x 0.62 x r, number 0.64 x 0.62 x r, ding 0.70875 x 0.623 x r_ding (0.2R); octave 0.66 x name). At R 61.8: main octave 3.86 pt, number 4.66 pt; ding at x0.62 would give 3.585 pt, so the ding takes 0.623 (floor-holding minimum, octave 3.60 pt). Lens names: Chord Card rule r_main x 0.8232 x f, with f = 0.565 (O1; 3.6/(0.19·61.8·0.8232·0.66) = 0.5643, rounded up; octave 3.60 pt, name 5.46 pt). Ding octave margin is 0.002 pt (3.602); P2's every-glyph test guards it and its measured factor replaces 0.623 if needed (E5-4, D3-5). Standard cards and the no-shrink baseline (Hijaz, Pygmy, Amara 9 Standard) are untouched. `M<n>` = r_main x 0.64 x 0.5 (3.76 pt at R 61.8), floored at 3.6 pt. The 3.6 pt print floor (CLAUDE.md) is not waived | n/a | P2 | `HPE.pdfcards.labelRatio` gains the lens zone; one constant per language (`LABEL_RULE`, hifi); every glyph ≥ 3.6 pt test; P2 glyph table | glyph sizes compared at C3 |
| U12 | Layout helper | Line "Mutant notes pair with tonefields: note N goes in tonefield N." (M3) under the switch when Neotone is on (M B2) | none | U2 | exact en; 8 locales | read |
| U13 | Unused lenses | Grey line "Tonefields 7 to 9 have no mutant note. That's fine." (M4; numbers from the scale) (M B2) | none | U2 | exact en for Pygmy (6 bottoms); range computed | read |
| U14 | Rearrange hint | The Layout tab says it is where placement is rearranged (thread 5d2e62f1): M5 (new strings table) | none | U2 | exact en; 8 locales | read |
| U15 | Vendor-name ban | UI-ban test allows "Neotone" (OB decision 11); every other maker name stays banned | ban would reject "Neotone" | U2 | ban test passes with "Neotone" visible, still fails on another maker name (mutant) | n/a |
| U16 | Sheet buttons | Cancel left, SAVE right (M B2) | as dev | U2 | DOM order test | read |

SUPERSEDED by OD1 (kept for history): Conflict for the owner (K1, K2): D3 froze the v2 fixture (main r 0.245, orbit 0.74, depth 0.44) as "the 0.245R fixture". The Chord Card original shows Standard geometry (orbit 0.745R, r 0.19R, ding 0.2R) and the owner asked for it to match Standard. The orbit agrees; the tonefield radius and lens depth appear not to. Until reconciled, D3 and the hard requirement cannot both hold. P2's first task is a numeric diff of the fixture against the Chord Card SVG (read-only); the owner picks the outcome (see Open decision OD1).

SUPERSEDED by OD1 (kept for history): Owner answer on the conflict (2026-11-01): "Use the final decisions we made on the artifact NHK2ZtAdrChie2rEMXWAGd (UX Mocks); I will share screenshots in case you're confused." Recorded: the UX Mocks final decisions are the authority for every U row; K1 and K2 (geometry) are HELD, neither D3 nor the Chord Card numbers is applied, until the owner's screenshots arrive. P2 does not start geometry work before then. Next action: owner shares screenshots; the plan then amends K1/K2 and D3.

SUPERSEDED by OD1 for geometry; its strings live in U12/U13 and the Message list (kept for history; its pixel readings were wrong, see D2-1): Screenshots received (owner, 2026-11-01, UX Mocks: Q0 diagram and B2 Layout tab). Read off the images (approximate, pan radius about 207 px): main tonefield r about 0.20R, ding about 0.21R, rim orbit about 0.69-0.72R; the mutant tonefield is a small FULL circle (r about 0.6 of the main, about 0.12R) whose centre sits on the ding-side edge of its main tonefield, so the overlap reads as a lens; unlit mutant circles are drawn faint; main numbers 1-9 sit outside the rim; ding is a plain outlined circle; mutant label shows the note over "<n>s" (superseded by `M<n>` in the Chord Card). B2 layout: Scale/Layout tabs, Standard/Neotone segmented switch (Neotone filled teal), helper line "Mutant notes pair with tonefields: note N goes in tonefield N.", red error line "Neotone has 9 main tonefields. Remove 2 top notes (F5 and G5 have no tonefield).", grey line "Tonefields 7 to 9 have no mutant note. That's fine.", pan below, Cancel left and SAVE right. Resolution (AFK, reversible): the mock geometry is Standard-like (r about 0.20R), so D3's 0.245R fixture does not match; K1/K2 are reopened to match the mocks. E2 adds fixture rev 3 from the mock (main r 0.19-0.20R as the Chord Card states, mutant circle r about 0.12R centred on the ding-side edge, orbit about 0.745R); P2 first diffs it against both originals and reports any gap over 3 percent to the owner. Owner confirms numbers at C3. The helper line and the grey 7-9 line become required strings in 8 locales (new U12, U13).

### Message list (U7; exact en; keys owned by U2 unless marked E2)

Verbatim from the originals (M1-M4, M6, M7; checked against the live UX Mocks). Shown together on s5 in this order: diagram, M6, Name field, M7, M1 (D3-6). B2 order: switch, M3, M2/M2b, M4, M5 (AFK placement), pan, Cancel/SAVE; s4: switch, M2b, pan (D5-2).

| # | Key | Case | en text (verbatim from the original) |
|---|---|---|---|
| M1 | `sheet.neotone_inner_extra` | built-in Pygmy ticked (inner F5/G5), mock s5 | "Neotone has 9 main tonefields. Inner notes F5 and G5 have no tonefield: remove them to save." |
| M2 | `sheet.neotone_top_extra` | more than 9 top rim notes, mock B2 | "Neotone has 9 main tonefields. Remove 2 top notes (F5 and G5 have no tonefield)." (count and names from the scale) |
| M2b | `sheet.neotone_both_extra` | too many mutant and main notes, mock s4 | "Neotone has 9 mutant tonefields. Eb6 has no mutant tonefield. F5 and G5 have no main tonefield. Remove them to save." |
| M3 | `sheet.neotone_pair_help` | Neotone on, mock B2 | "Mutant notes pair with tonefields: note N goes in tonefield N." |
| M4 | `sheet.neotone_unused` | fewer bottoms than 9, mock B2 | "Tonefields 7 to 9 have no mutant note. That's fine." |
| M6 | `sheet.neotone_builtin` | editing a built-in, mock s5 | "F Low Pygmy 18 is a built-in. Its 6 bottom notes become mutant notes in tonefields 1-6. Saving creates a new scale; the built-in stays as it is." (name and counts from the scale) |
| M7 | `sheet.neotone_name_hint` | under the prefilled name, mock s5 | "Suggested name; you can change it." |

New strings (not verbatim in any original; owner reads each at C3; a reviewer checks them against this table, not against the originals):

| # | Key | Case | en text | Source |
|---|---|---|---|---|
| M5 | `sheet.neotone_rearrange` | Layout tab, U14 (thread 5d2e62f1 asks the tab to say it rearranges placement) | "Tap a note, then another in the same ring, to swap them, or hold a note and drag it." | exact clause of the mock B2 designer note "Moving notes works as today: tap a note, then another in the same ring, to swap them, or hold a note and drag it." with the first letter capitalised (AFK O4) |
| M8 | `reason.NEOTONE_INPUT` (E2 code) | typing a 10th top note or `|` while ticked (A8) | "Neotone has 9 main tonefields. Remove the extra top note to save." | built from M2's verbatim wording (D3-2); the `|` case reads "Neotone has no inner notes. Remove the inner note to save." |

Gate additions: (1) every phase brief quotes this table and the Message list; (2) a reviewer FAILs a lane on any row it owns that differs from the original, unless the row names an override (O, F4, F5, K8), in which case it is checked against the override; (3) C3 is a row-by-row side-by-side of served DEV against the three originals and is the only sign-off; (4) the QA Guide is rewritten from this table in Q.

### OD1 geometry decision (resolves F1, F2)

**OWNER DECISION 2026-11-01 (check-in): Chord Card geometry wins over UX Mocks B2** - orbit 0.745R, r 0.19R, ding 0.2R, lens depth 1/3 of the diameter, numbers outside the pan (number_out 1.0758), decor ring 0.355R. B2 is authority for UI rows (U*), not for card geometry (K1/K2/K4 and the preview). F10 reference = Chord Card. Supersedes D3, the K1/K2 hold, the screenshot geometry paragraph, R2-I's "10% smaller" (r 0.228) and B2's orbit 0.62R/depth 1/2/numbers at 0.88R. Round-2 findings are folded in ("Round 2 disposition").
Units: fixture depth 0.44 is a fraction of the main DIAMETER (0.44 x 0.49R = 0.2156R); the Chord Card depth 2r/3 is 1/3 of the diameter = 0.1267R. Differences: r 0.245 vs 0.19R (29%), depth 0.2156R vs 0.1267R, n_in 0.145 vs the Standard 0.085R; orbit (0.74 vs 0.745) and number_out 1.0758 agree. Chronology: the 10-31 04:29Z owner instruction to match Standard came after the fixture freeze (75a1d7bb, 06:16Z 10-31 froze the 10-30 G1 answer); the OB "superseded by T2" note is backwards and C0 corrects it.
Applied: fixture rev 3 (E2) = orbit 0.745R, r 0.19R, ding 0.2R, n_in 0.085R, number_out 1.0758, depth 1/3 of the diameter, decor ring 0.355R. Depth is owner-fixed at 1/3, so G1's "move to 1/2" escape no longer applies; the 3.6 pt floor is met by the K8 factor (O1). P2's measured glyph table (depth 1/3) is a deliverable and gates P2's merge; the owner sees it at C3.

### Design review 1 disposition (independent, NOT_READY, 2026-11-01)
- F1/F2 fixed: OD1 above; P2 prerequisite in Phases.
- F3 fixed: U2 reads "Scale tab unchanged EXCEPT the D4 checkbox. D4 (owner 2026-11-01) overrides mock B1 'no switch here' and thread 5d2e62f1".
- F4 decision (AFK): prefill = the scale's own name + `sheet.neotone_name_suffix` ("Neotone Mutant"), so "F3 LOW PYGMY 18 Neotone Mutant"; the footer shows the saved name, so K7 reads "<saved name>  #n" and the mock's "F Low Pygmy 18 Neotone Mutant #37" and the Chord Card's "F3 Low Pygmy 18 Neotone  #12" are both illustrative. Owner may overrule at C3.
- F5 decision: no inner hairline on Neotone cards (Chord Card render and 10-31 decision win over the OB convention). F6 decision: the project label rule (0.80325/0.64, 3.6 pt floor) sizes glyphs; the Chord Card multipliers are illustrative; C3 compares positions, not glyph sizes. Added row K8.
- F7: every message string is copied verbatim from the originals into the U7 acceptance by the U2 lane, including s4 "Neotone has 9 mutant tonefields. Eb6 has no mutant tonefield. F5 and G5 have no main tonefield. Remove them to save.", B2 "Neotone has 9 main tonefields. Remove 2 top notes (F5 and G5 have no tonefield).", "Mutant notes pair with tonefields: note N goes in tonefield N.", "Tonefields 7 to 9 have no mutant note. That's fine.", s5 "F Low Pygmy 18 is a built-in. Its 6 bottom notes become mutant notes in tonefields 1-6. Saving creates a new scale; the built-in stays as it is.", "Suggested name; you can change it." The U2 phase acceptance string is replaced by the B2 sentence.
- F8 added row U14: the Layout tab tells users it is where placement is rearranged (thread 5d2e62f1), wording taken from the thread.
- F9: Layout preview labels: mutant label shows note over `M<n>` (the later Chord Card decision), pitch numbers outside the rim; U11's human check is "numbers outside the rim on the preview and the card".
- F10: reference fixture `tests/fixtures/neotone_card_reference.json`, extracted from the Chord Card SVG (circle centres/radii in R units for the Pygmy and Kurd 9 cards); tolerance 1% of R; covers the Kurd 9 non-mutant card too.
- F11: (a) K5 root frame flagged for C3 confirmation; (b) K3 adds white band inset about 0.0076R and fills #f3f1f5 (empty lens) vs #fff (filled); (c) new row U15: the vendor-name UI-ban test is changed to allow "Neotone" (OB decision 11); (d) rows cite the Chord Card render, not its bullets; (e) U1 acceptance lists dev's keys by name: `reason.PROFILE_*`, `sheet.paired_*`, `sheet.mode_paired`, `sheet.reset_areas`, `sheet.areas_reset`, `sheet.areas_label`, `sheet.paired_dropped`.
Status: **Ready** (2026-11-01). Round 5 design READY; round 5 eng findings folded and confirmed READY by the round 6 narrow eng review.

### Owner questions decided AFK (round 3 regroup, 2026-11-01; owner may overrule at C3)

- D4-2 (AFK, round 4): adopt the Chord Card x0.62 for main names, numbers and ding on Neotone cards; faithful to owner thread 377b20d7. The ding takes 0.623 because x0.62 puts its octave digit at 3.585 pt, under the unwaived floor. P2's measured floor-holding values replace these if they differ (D3-5).
- D4-1 (AFK, round 4): main-number placement is conditional on the scale having a mutant note (1.0758R with, 0.47R Standard spot without), per owner thread 09263155, which is later than 04c07816.
- D4-4 (AFK, round 4): mock s4's grey "Bottom field: C3 Db3 ..." line is mock illustration, not UI; no row, no string. No UX Mocks thread mentions it (round-4 design review read all 14).
- E4-A (AFK, round 4): tolerance test `abs(depth - 1/3) < 1e-4`; the fixture keeps 0.3333 (owner-fixed 1/3).
- O1 (K8, revised round 4): f = 0.565. Rationale: the smallest factor that keeps the lens octave digit at the 3.6 pt floor at the rev-3 print radius R 61.8 (E-S10): 3.6/(0.19·61.8·0.8232·0.66) = 0.5643, rounded up. The earlier 0.53 was computed at R 66 and fails at 61.8 (3.38 pt, E4-B). 0.42 (Chord Card) would need a floor waiver. The 0.62 factor does not apply to lens names (they have their own f). Decided now so it is fixed before E2 and P2. If P2 measures a different floor-holding minimum, P2 uses the measured value and reports it in its glyph table; O1 is not re-asked (D3-5).
- O2 (U9/K7): prefill "F3 LOW PYGMY 18 Neotone Mutant" (saved name as stored + " Neotone Mutant"). Rationale: no deck data change; F4's rule. The casing differs from the mock's "F Low Pygmy 18 Neotone Mutant" and is accepted under F4 (D3-3); the rejected alternative was all upper case, "F3 LOW PYGMY 18 NEOTONE MUTANT".
- O3 (U2): title case for "Top Notes" and "Bottom Notes / Neotone Mutant Notes (optional)", as mock B1. Rationale: the mock is the U-row authority and the requirement is to match it.
- O4 (U14): M5 = the exact clause of the mock designer note (new strings table). Rationale: closest original text; the requirement is to match the original.
- A12 (U10, D3-4): an older app shows the existing "needs a newer app" message for a v7 link it cannot read. Rationale: existing, conservative behaviour; no new string.
- A13 (L, E3-F): L merges `claude/dev-sync-neotone` under the `claude/dev-sync-*` dev-merge grant, although it carries code main has not merged. Rationale: its tree is the CI-green, reviewed M head plus dev-only hunks; L's acceptance adds `git diff <M head> <L merge> -- $(git diff --name-only origin/main...<M head>)` is empty, so every line in M's scope is exactly what CI ran.

### Round 2 disposition (Review 4 R4-A..R4-J, Design round 2 D2-1..D2-11)

- R4-A blocker: owner decision. OD1 (owner 2026-11-01) answers the hold: Chord Card geometry, fixture rev 3, owned by E2 (Phases E2); D3 and the Non-goal amended; integrity sha and needles updated by E2; P2 is gated on E2 and O1. Rubric rescored below.
- R4-B high: fixed. Authority-per-row line and gate (2) "unless the row names an override"; (1) D4 named in U2 and the U2 phase; (2) U9/K7 one rule (F4), case is O2; (3) F5 no hairline (K3); (4) K8.
- R4-C high: fixed. Message list M1-M8 with keys and exact en; U7 and the U2 phase acceptance quote it; the Pygmy tick case uses the mock s5 string M1.
- R4-D high: fixed. L and M swapped: `claude/neotone-m` must have `validate` success at its verified head and a reviewer pass before L; A3 local run adds the render-agreement and pdf-parity pytest.
- R4-E medium: fixed. (1) U14/M5; (2) U11 preview labels and observable; (3) K1 reference file, method, 1% of R tolerance, Kurd 9 included.
- R4-F medium: fixed. Four Coupling rows added with owners.
- R4-G low: fixed. C0 acceptance compares reflowed text: the check joins wrapped lines (`git diff --word-diff`) before comparing to the table.
- R4-H low: fixed. A8: `NEOTONE_INPUT` is an E2 REASONS code with a spec row; U2 owns its i18n values.
- R4-I low: fixed. Risks line reworded; the gentler migration recorded as considered.
- R4-J low: fixed. Rubric rescored; K5 root frame: thread 2f095580 kept the root frame with no owner objection (D2 review), confirmed at C3; K3 white inset 0.0076R and fills #f3f1f5/#fff stay in the F11 disposition and are added to K3's acceptance by P2; U15 vendor-name row added.
- D2-1 blocker: owner decision. The reviewer is right that B2 reads 0.62R / 0.20R / depth 1/2 / numbers 0.88R and that line 166 misread it; the owner chose between the two originals on 2026-11-01: Chord Card wins for geometry (OD1). The misread paragraph is marked superseded.
- D2-2 blocker: fixed. D3, the hold paragraphs, the screenshot paragraph, Risks and the K1 Dev cell now all point to OD1/rev 3; no text says "no rev 3".
- D2-3 high: fixed. U2 row carries the D4 exception.
- D2-4 high: fixed. U2 phase string replaced by M1 (mock s5); U7 points to the full list.
- D2-5 high: fixed with owner decision. K8 row: lens rule from the Chord Card, the 3.6 pt floor kept, factor f is O1; "C3 compares positions, not glyph sizes" withdrawn (K8 human check compares sizes).
- D2-6 medium: fixed. U12-U16 are table rows.
- D2-7 medium: fixed. U9 now states F4's rule; case is O2.
- D2-8 medium: owner decision. OD1 puts numbers outside (1.0758) on the preview too; U11 updated.
- D2-9 medium: owner decision. The reference fixture follows the owner's pick (Chord Card); U4's "matches B2" covers layout and interaction only, not geometry.
- D2-10 low: fixed. Decor ring in OD1 and K1; B1 label keys and en values in U2 (O3 for case); s4 as M2b; Cancel/SAVE as U16; preview empty lens per U11.
- D2-11 low: owner decision. "10% smaller" superseded by OD1's explicit r 0.19R.

### Round 3 lessons (regroup)

- Stale C0 rows (E3-A): the M/L swap was edited into A3 and Phases but not into the C0 rows that quote the OB plan, and lanes are briefed from the OB plan. Rule: any change to phase order or ownership greps the C0 table for the same branch names in the same edit.
- v2 figures left in (E3-B, E3-D, E3-E): OD1 changed the inputs, but the derived figures (0.8478, 0.4656, 0.6028, 0.35) and the fixture tests were never recomputed; the E-S rows were treated as settled text. Rule: a geometry input change recomputes every derived figure and writes the whole fixture out.
- Invented wording (D3-1, D3-2): a "verbatim" list held strings the plan wrote itself, so a reviewer could not tell them apart. Rule: invented strings live in a separate table with a source column.
- Edit tooling (E3-C): a regex row replace matched the first "| U2 |" line, in the Phases table. Rule: row replaces anchor on table-unique text and are diffed before review.

### Round 3 disposition (E3-A..E3-G, D3-1..D3-6)

- E3-A high: fixed. C0 rows 12 and 13 now match A3 (conflicts resolved on `claude/neotone-m`; dev-sync only merges the CI-green M head).
- E3-B high: fixed. E-S1 = 0.8083; E-S5..E-S9 give exact rev-3 replacements for every 18.1 v2 figure; derivations written out.
- E3-C high: fixed. Phases U2 row rebuilt with five cells (lane, prereq, deliverable, acceptance incl. M1, `validate`, reviewer).
- E3-D medium: fixed. E-S4 separates map rev (2) from fixture rev (3); fixture rev 3 content written out; v2 pinned and superseded.
- E3-E medium: fixed. O1 decided now; glyph-floor assertion moved from E2's fixture tests to P2; every rev-3 key listed.
- E3-F low: AFK decision A13 plus a diff acceptance on L.
- E3-G low: rubric rescored (Pass 4, 9/10).
- D3-1 high: fixed. M5 moved to the new strings table, wording is the exact designer-note clause (O4).
- D3-2 medium: fixed. M8 moved to the new strings table, built from M2's wording.
- D3-3 medium: fixed. O2 recorded with the casing caveat and the alternative named correctly.
- D3-4 medium: AFK decision A12 (NEEDS_NEWER_APP) in U10.
- D3-5 low: fixed in O1.
- D3-6 low: fixed. s5 display order stated above the Message list.

## State record (C1 fills)

`PROFILE_ENABLED` on main: absent (`git grep -c PROFILE_ENABLED origin/main -- src index.html` prints nothing, exit 1; origin/main c6ef6b58). On dev: true (A1). PR heads at C1 (2026-11-01, `gh pr view`, all OPEN, base main, MERGEABLE, equal to "Branch facts"):

| PR | State | headRefOid |
|---|---|---|
| #744 | OPEN | 701c06fcfa1b3f0ea015afcee635ae3d61369bc3 |
| #749 | OPEN | e769ae479f34af55006e9ceb6323f19aedadd23e |
| #751 | OPEN | 7bd47fa435cf2974a9ba4fa911adb1a6e2d3bf42 |
| #754 | OPEN | 98281e3558db00b733251bef873dcb8762e5be6b |
| #793 | OPEN | e38682450cc880e8060073e6dd9ea6c8e1b66f1a |

PR heads at L: (filled at L; C4 compares against these).

## Verification

Automated: `validate` at each main-PR head. Self: A3 local run on the merged tree. Independent: fresh reviewer per lane at the verified SHA. Human: C3.

## Risks and recovery

- U2 cherry-picks conflict onto the E2 head (checked clean only onto 98281e35): resolve toward E2's API; the lane records it.
- Combined landing conflicts are large: one owner (L), rules in A3; revert path `claude/dev-revert-neotone`.
- 3.6 pt floor: met by the K8 lens factor; a glyph still under it at depth 1/3 goes to the owner (geometry is owner-fixed by OD1).
- DEV users' Option A swaps are lost on every non-ring-strict map, which includes every DEV Pygmy record (inner F5/G5 keys); A5 re-proposes them (DEV only). Considered and not chosen: keep r/b keys and send only i/cross keys to `unplaced` (more code for DEV-only data).
- Rev 3 lands after a v2 fixture was frozen: stored records and links hold maps, not geometry, and rev 3 leaves the map format unchanged, so no stored record changes meaning.

## Continuation

When Ready: C0 and C1, then E2 via `/swarm`.

## Rubric and self-score

Rubric (each 0/1; the bar is all 10): (1) every phase has a prereq; (2) an owner; (3) a deliverable; (4) an observable acceptance; (5) no sentence of the OB plan contradicts this doc after the C0 table; (6) every branch start, merge and push is checked against git ("Branch facts", `merge-tree` result); (7) no force-push or rewrite; (8) every remote write sits inside an AFK grant or is owner-gated (dev-sync grant for L; lane commits/PRs on `claude/*`; C0 dev merge and C4 closes owner-gated); (9) every R3 finding has a resolution; (10) every engine/UI coupling has one owner and lands in one step.

Pass 3 (after round 2 fold-in): self-scored 10/10, wrong (E3-G): the Phases U2 row was corrupted (items 1-4) and C0 rows 12/13 contradicted A3 (item 5).

Pass 4 (round 3 regroup, 2026-11-01): (1)-(4) pass (U2 phase row rebuilt; every phase has prereq, owner, deliverable, acceptance); (5) pass on a grep of this doc and the C0 rows for "0.245", "0.44", "0.2156", "0.4656", "0.6028", "0.8478", "0.145", "dev-sync-neotone" (each remaining hit is a quoted Old cell or history); (6) partial: branch heads and merge-tree results were verified in Review 4, not re-run this round; (7) pass; (8) pass with A13 recorded; (9) pass: every R3, R4, D2, E3, D3 finding has a disposition; (10) pass. 9/10; (6) is re-verified at C1.

Pass 1 scored 8/10: (5) failed, OB line 633 still reads as a refusal on tick (fixed by row 32); (8) failed, C4 closing PRs is not an enumerated grant (now on the owner's word). Pass 2: 10/10. R3 map: A C0 table; B A3, Coupling; C A2, Branch facts; D A8, row 32; E A7, E-S1/E-S2; F A5/A6; G A9; H A4 (no legacy export); I A9 and the C0 acceptance (no CI claim); J A10; K Kurd 9 string, Non-goal, Q rows 19-20, State record, P2 brief line.

## Regroup (2026-11-01, after Review 3)

Three rounds failed for one reason: the plan was patched finding by finding while its lane sequence assumed E2 could land on dev alone and that P/U branches could be "updated in place". Neither was read from code or git. The code shows E2's API change breaks U-owned `index.html`, P-owned pdfcards/hifi and their tests (Coupling), so landing must be joint (A3). Git shows pa-u/pa-u-nits are dev-based and need a rewrite to be clean, so U2 takes a new branch (A2). The C0 topic list never quoted the OB plan, so its contradictions resurfaced each round; the C0 table now quotes every passage. Review sections below are verbatim.

## Review log

### Review 1 (independent eng + design, 2026-11-01)

Verdict NOT_READY (2 blockers, 5 high, 4 medium, 3 low). Dispositions: CC1 fixed (diagnosis rewritten, dev copy is authority). CC2 fixed (C0 takes dev's copy). CC3 owner decision D3. CC4 fixed (T3). CC5 fixed (E2 rev-1 reader and corpus tests, A2). CC6 fixed (C1 acceptance, A1). CC7 owner decision D4. CC8 fixed (start points, M and Q kept). CC9 fixed (A3, C4). CC10 owner decision D5. CC11 fixed (U2 key list). CC12 fixed (briefs quote the amended plan). CC13 noted.

### Review 2

Independent eng + design, 2026-11-01, against origin/dev (fetched) and `git show origin/dev:docs/plans/2026-10-30-neotone-option-b.md`. Verdict **NOT_READY** (1 blocker, 6 high, 5 medium, 1 low). The Review 1 dispositions hold where stated (CC1, CC2, CC6, CC11 verified); CC5, CC8, CC9 and CC12 are only partly fixed (R2-A to R2-E). The D1-D5 owner decisions are not reopened. A3 is challenged.

Verified true: branches `claude/neotone-e` 701c06fc, `claude/pa-p` e769ae47, `claude/pa-u` 7bd47fa4, `claude/pa-u-nits` e3868245 and `claude/neotone-t2` 98281e35 exist (`claude/neotone-sync` does not, and C0 creates it); #744/#749/#751/#754/#793 are OPEN; #745/#750/#752/#755/#794 are merged to dev at the stated times; `validate` passed at 701c06fc, 98281e35 and e3868245; main has no `PROFILE_ENABLED` (C1 holds); the v2 fixture sha 611b59a2 matches `tests/test_fixture_integrity.py`; the U2 key list covers every Option A key U added on dev.

| id | sev | finding | evidence | fix |
|---|---|---|---|---|
| R2-A | blocker | E2 "merging dev head" and U2 "start `claude/pa-u-nits`" put dev-only work into main twins. If dev is merged into `claude/neotone-e`, #744 picks up about 30 dev-only merges (move-hosts, move-overcap, mn2/mn3, look-b, logo-app, qa-seed), including work held behind the Move e2e gate. #751 already carries two dev merges (7bd47fa4, 7efaf957): 320 files against main, including brand, 404.html and the move lanes. `claude/pa-u-nits` has dev merge 30d73d67 (323 files). So A3 "update #751 in place" ships unrelated dev work the day main merges. | `git diff --stat origin/main...claude/pa-u`; `git log --merges` on pa-u and pa-u-nits; memory "Lane branches stack on main, not dev" | E2: merge T2 only, never dev; resolve dev conflicts on a `claude/dev-sync-<lane>` branch. U2: rebuild a clean main twin (E2 plus cherry-picks of the non-merge U and PA-N commits), then close #751 and #793 as superseded, or force-update #751 from the clean branch under the lane-created-branch grant. Change A3 to match. |
| R2-B | high | U2's start point contradicts its twin and C4. It starts from `claude/pa-u-nits` (head of #793), names #751 (head `claude/pa-u`) as its main twin, and C4 closes #793 as superseded. Whatever U2 pushes cannot update #751. | `gh pr view 751/793 --json headRefName` | Pick one branch and one PR. Follows from R2-A: one clean branch, one main twin, the other PR closed. |
| R2-C | high | Between E2 and U2, the Option A sheet on dev breaks. The dev app reads `proposeProfile(...).value` as an array (`profileMap = proposed.ok ? proposed.value : null`, then `profileMap.map(...)`) and writes `rev: 1`. E2 changes the return to `{map, unplaced}` at rev 2, so the Option A sheet throws on dev and the app tests on #744 go red. The fix lives in `index.html`, which U2 owns. | dev `index.html` profile callers; dev `src/engine/layout.js` `proposeProfile` | Choose one: (a) E2 keeps the old return shape behind a new function name, and U2 switches callers; (b) E2's dev PR merges only together with U2's; (c) E2 also owns the caller adapter in `index.html`. Write the choice into the ownership row. |
| R2-D | high | The rev-1 reader does not say what opens. Rev-2 `readProfile` refuses a map that leaves a note out (PROFILE_NOTE_MISSING), so a migrated record with `unplaced` entries cannot pass it, and "every link opens" has no defined result. Dev's Pygmy rev-1 map has inner F5 and G5 in s1/s2 and bottoms in s3-s8. Migration sends F5 and G5 to `unplaced` and keeps the bottoms in s3-s8, not s1-s6. The wire carries no rev, so every v7 `pair-` token, including tokens written after E2, goes through the rev-1 reader forever. | dev `src/engine/share.js` decode (`rev:1` always); dev `src/engine/core.js` `readProfile` (`raw.rev !== 1`); `proposeProfile` slot fill | Write the outcome down: either the sheet opens in Neotone with unplaced notes listed and SAVE held, or it falls back to Standard with a notice. State that savedMeaning is unaffected. State that rev-1-to-rev-2 is the identity on ring-strict maps, and add a round-trip test (rev-2 encode, decode, read, same map). Decide whether migrated bottoms compact to s1-sN. |
| R2-E | high | C0's acceptance makes the reviewer briefs wrong. It allows only the D3/D4/D5 amendments, but reviewers are briefed with the amended Option B plan verbatim. That plan still says E2 is "rev 2 only", gives `storage_corpus.test.js` to U2 and carries the AFK supersede lines. ENGINE-SPEC 18.2 on dev says "rev 1 is not read". A2 (the rev-1 reader), T3 and the new start points would be invisible to reviewers, or would contradict what they read. | dev Option B plan E2 row and lanes table; ENGINE-SPEC 18.2 | Widen C0: amend the E2 acceptance (rev-1 reader), move `storage_corpus.test.js` to E2, remove or replace the AFK supersede lines, and add the start points. Quote the exact amendment text in this doc so the C0 diff can be checked line by line. |
| R2-F | high | T3 has no owner for its own test and no delivery path. T3's acceptance test ("Kurd 9 Neotone geom equals gen_deck output") checks engine behaviour. T3 owns only spec and fixture text and runs before E2, so the test is red when T3 lands, and `layout.test.js` belongs to E2. No branch or PR is named. | T3 row; Option B lanes table (`tests/layout.test.js` belongs to E2) | Move the test to E2 as its first test. T3's acceptance becomes the spec diff plus an unchanged fixture sha. Deliver T3 as commits on `claude/neotone-t2`, updating #754 and its dev twin. |
| R2-G | high | "Non-mutant Neotone = Standard output" (D2) does not fit a nine-tonefield main ring. A Kurd 9 scale has 8 rim notes, so Standard has 8 seats. U2(c) tap-to-empty, or a swap into tonefield 9, has no geometry. Adding the first bottom note also re-lays the whole pan at once: from Standard angles to the fixed nine 40-degree angles, and from inboard numbers to numbers outside the rim. | ENGINE-SPEC 18.1 fixed angles; D2; the U2 interaction list in the Option B plan | Define it: the Standard seats are the tonefields; on a non-mutant scale the map only assigns notes to them; with 8 rim notes there is no p9 slot to target. Add a C3 row where the owner checks the jump on the first bottom note. |
| R2-H | medium | "Fixture sha pin updated only if the fixture changes" conflicts with D3 ("no rev 3") and the fixture rule "A change is a new rev". T3 also misses three spec lines: 18.1 "at orbit on a card with none", 18.4 `geom.place` "for every non-ding field", and 18.2's rev-1 sentence (which A2 contradicts). | `tests/test_fixture_integrity.py` docstring; dev ENGINE-SPEC 18.1/18.2/18.4 | State that the fixture is unchanged and sha 611b59a2 stays. Add those three spec edits to T3's scope. |
| R2-I | medium | D2 says "padding". The owner's 10-31 note was "Tonefields 10% smaller than touching", which gives r of about 0.228. D3's r 0.245 leaves only about a 3% gap (chord 0.506 against 2r = 0.49), and a 10% cut would push the lens octave digit to about 3.4 pt, under the 3.6 pt floor. Two more points are open: whether mutant cards keep the AFK fixed nine angles and pad-to-nine, and whether "main numbers outside the rim" applies to every card or only to cards with mutant notes. | dev Option B plan 10-31 owner lines and AFK supersede; ENGINE-SPEC 18.1 | Record that D2's "padding" means the v2 fixture gap (D3 wins over 10%). State the angle and pad-to-nine rule for mutant cards, and limit "numbers outside" to cards with mutant notes. |
| R2-J | medium (design) | D4's checkbox has no U2 acceptance. Missing: how it binds two-way to the Layout switch; what unticking does; what ticking does when the scale already has `|` or a 10th top note (Pygmy has both); the inline refusal strings and their keys, which are not in the i18n list; a 380px fit check of label plus checkbox in all 8 locales; an a11y label. The Goal and C3 test "against the mocks", but mock B1 says "No Neotone switch here" on the Scale tab, and the Non-goal "Option B beyond the mocks" excludes D4. | dev Option B check-in answer; `scratchpad/neotone-mocks.html` B1 | Add U2 rows for each item. Make C3 cite D4 next to the mocks. Change the Goal wording to "Scale-form checkbox". Change the Non-goal to "beyond the mocks and D4". |
| R2-K | medium | The i18n acceptance grep checks English only. The non-English Option A strings do not contain "area" or "paired" (it "aree accoppiate", ja "ペアエリア"), and `sheet.inner` in ja reads "ミュータント". | `data/i18n/*.json` on dev | Accept by key, per locale: every removed key is absent, every `reason.PROFILE_*` value differs from its dev value in all 8 tables, and D5 is checked per locale. |
| R2-L | medium | C0's merge path is not covered by any grant. A dev-only docs PR from `claude/neotone-sync` has no main twin with a green `validate`, and it is not a sync/revert/unrevert branch. C0's acceptance also skips the memory entries and the local copy. | AFK dev-merge grant in global CLAUDE.md | Put the C0 docs on `claude/neotone-t2` (#754 runs docs-only `validate`, and its dev twin then qualifies), or gate C0's dev merge on the owner. Add the memory files and the absent or restored local copy to C0's acceptance. |
| R2-M | low | E2's corpus is underspecified, and so is Q. The corpus rule is append-only frozen fixtures with a provenance commit, so links "produced by the current dev build" need a pinned dev SHA. The Kurd 9 scale string is not given and Kurd 9 is not a built-in. Q is integrator work (a private artifact), not a swarm lane, and it drops Option B Q's done criterion. CC13 cannot be verified. | `tests/link_corpus.test.js` header; Option B Q row | Pin the generating SHA in the fixture provenance. Write the Kurd 9 string out. Mark Q as integrator, keep Option B Q's done criterion, and add D4 and T3 rows to it. |

Checks run: plan read in full; each Review 1 disposition checked against origin/dev; branch, PR, merge-time and CI conclusions read with `gh`; share/core/layout/index.html read on dev; ENGINE-SPEC 18 and the fixture integrity test read; i18n tables diffed by key. Not run: no code was executed and no test suite was run; mock B1 was read from the local scratchpad copy only.

### Review 3 (final)

Independent eng + design, 2026-11-01, against origin/dev b5aed492 (fetched) and `git show origin/dev:docs/plans/2026-10-30-neotone-option-b.md` (633 lines). Verdict **NOT_READY** (4 high, 4 medium, 3 low). D1-D5 not reopened.

R2 status: fixed R2-F, R2-H, R2-L. Mostly fixed R2-I, R2-J, R2-K, R2-M (residuals in R3-J/K). Partly fixed R2-A, R2-B (R3-C), R2-D (R3-F), R2-G (R3-E). Not fixed R2-C (R3-B), R2-E (R3-A).

Verified true: the five branch heads are unchanged (701c06fc, 98281e35, e769ae47, 7bd47fa4, e3868245) and `validate` concluded success at each one. #744/#749/#751/#754/#793 are OPEN. Main has no `PROFILE_ENABLED` (C1 holds). The v2 fixture matches D3 and its sha256 starts 611b59a2. `pa-p` has no merge commits and is stacked on `neotone-e`. `pa-u-nits` branched from dev after #752.

| id | sev | finding | evidence | fix |
|---|---|---|---|---|
| R3-A | high | R2-E is not fixed. C0 lists amendment topics without exact text, and the list leaves out passages that contradict this doc. C0's acceptance ("shows only these amendments") therefore forbids correcting them, and reviewers are briefed with the plan verbatim. Missed: Q-C "Rework on the same branches; close nothing … merges the E2 head into its branch" (contradicts A2/A3/C4); Q-A "Rev 1 data exists only inside tests … stop" (contradicts A1/A5); E2 acceptance "`proposeProfile(fields)` returns `{map, unplaced}`" (contradicts A4) and "a cross-ring v7 link is refused with the profile code" (contradicts A5); E2 "`solve` with a profile: `geom.place` per v2", P2 profile cases "Kurd 9 with empty mutant tonefields; Hijaz 8 rim, one empty main tonefield", edge cases "Empty bottom field: Neotone allowed, every mutant tonefield empty and neutral" and "Fewer than 9 rim notes …", plus S10 (all contradict A6/D2); the Frozen-card-design AFK supersede lines ("18.1/18.4 and the fixture win" over non-mutant = Standard; contradicts D2); the Lanes-table branch column `claude/pa-u (merge E2)` and the "on dev" prereqs. Scenario: the P2 reviewer reads P2 acceptance requiring a lens Kurd 9 case. P2 ships Kurd 9 = Standard as this doc's P2 row says, and the review FAILs (or the lane builds the wrong thing). | dev Option B plan: Q-A, Q-C, E2/P2 acceptance, Edge cases, Frozen card design, Lanes table | Add a C0 amendment table to this doc: anchor (section + quoted old sentence) → exact new text, one row per passage above plus the items already listed. C0 acceptance: the diff equals that table. |
| R3-B | high | R2-C is not fixed. A4 keeps only `proposeProfile`'s return shape. E2 also replaces `HPE.layout.PROFILE` with the v2 literal and makes `readProfile`/`solve` ring-strict, and the Option A code on dev reads both. Dev `index.html` `pairedOverlay` reads `P.primary/P.secondary/P.areas`. The legacy `proposeProfile` reads `PROFILE.areas`. `solvePairedPreview` and `commitOptions` pass `rev: 1` maps, cross-ring by default for Pygmy (F5/G5 in s1/s2). P's `tests/pdfcards.test.js` "PA: the draw figures are a literal copy of the frozen profile fixture and of HPE.layout.PROFILE" and `layout.test.js` "PL: HPE.layout.PROFILE is exactly the frozen fixture" pin v1. Scenario: E2's dev PR is gated only on #744 `validate`, which carries no P/U code, so it is green and merges. On served DEV, open the sheet, go to the Layout tab and choose Paired areas with an empty area: `pairedOverlay` throws on `kind.orbit` of undefined. The PA test is red on dev, and CI never runs on dev, so "dev app tests green" cannot be observed. The fixes live in U2/P2-owned files. | dev `index.html` `pairedOverlay`, `solvePairedPreview`, `commitOptions`; dev `src/engine/layout.js` `PROFILE`, `proposeProfile`; the tests named | Take R2-C option (b). E2's dev landing waits; E2, P2 and U2 reach dev together, through one `claude/dev-sync-neotone` PR, once #744, #749 and the U2 main twin are green at their heads, with the app/pdfcards/layout suites run locally on the merged tree and the output recorded in the PR. Drop A4's "dev stays green" claim, or state exactly what E2 keeps (v1 `PROFILE` and permissive rev-1 solve under legacy names). |
| R3-C | high | A2/A3 branch mechanics. (1) Read literally, "the non-merge commits of `pa-u-nits`" is `git rev-list --no-merges origin/main..origin/claude/pa-u-nits`: 70 commits, including the dev-only move/mn3/qa-seed work. That brings R2-A back. The intended set is first-parent only: U f2d8d2a1 … bd71c358 (12) plus PA-N 5fe640ec, 6369570e, e3868245, without E's three commits. Of these, 8dfd24a8, d271941c, 658d81ed and e3868245 are mutant or i18n refreshes anchored to dev; they should be regenerated, not cherry-picked. (2) Updating #793 "in place" from a clean history needs a force-push of `claude/pa-u-nits`. The AFK grant allows `--force-with-lease` only on a branch the lane itself created, and PA-N created this one, so the action is gated and the AFK lane stalls. (3) `pa-p` has no merges and its non-merge set includes E's three commits, which are already ancestors of E2, so cherry-picking is wrong there. | `git log --first-parent` / `--merges` on pa-u, pa-u-nits, pa-p; AFK grant in global CLAUDE.md | U2 starts a new branch (for example `claude/neotone-u2`) from E2 plus the listed first-parent commits, with a new main PR, and C4 closes #751 and #793 as superseded. P2 merges the E2 head into `claude/pa-p` (merge commit, #749 updated in place, per Q-C). Write the commit list into A2. |
| R3-D | high (design) | U2's checkbox refusal contradicts owner decisions 8 and 9. The U2 row says "ticking with a `\|` inline or a 10th top note is refused with a reason key". Option B decision 8 says "Neotone stays on, extras named, SAVE held until removed", and decision 9 and DR1's three cause keys cover converting Pygmy (remove F5/G5). Under D4's two-way link, either the Layout switch is refused too, and the Pygmy conversion that C3 checks cannot be reached, or the checkbox and the switch disagree. Scenario: edit built-in Pygmy (`\| F5 G5`), tick Neotone: refused. Then flip the Layout switch: it is either refused as well, or on with F5/G5 unplaced while the checkbox stays unticked. | U2 row; dev Option B Decisions 8/9, U2 (d)/(e), DR1 | Make ticking act exactly like the switch: Neotone on, the decision-8 cause messages, SAVE held. No refusal key. |
| R3-E | medium | A6 leaves two behaviours undefined while P2 and U2 run in parallel before C3. (a) On a mutant scale with 8 rim notes, main tonefield 9 has no draw or tap rule. T3's "remove the … empty tonefields neutral override" would delete the 18.1 sentence "Empty main tonefields and empty mutant tonefields draw neutral", which also loses the owner's v17 rule "An empty mutant tonefield is drawn neutral grey" for Pygmy s7-s9. (b) On a non-mutant Neotone scale (Standard geometry), there is no rule for how a tap-to-swap in the map moves notes, since 18.2 forbids `seats`/`angles` with a profile. | ENGINE-SPEC 18.1/18.2 on dev; Frozen card design "Shared geometry"; U2 (c) | State defaults. With a mutant note: all nine main tonefields and nine lenses are drawn, empty ones neutral; T3 restricts the neutral sentence to cards with a mutant note instead of deleting it. Without one: the main half of the map orders the Standard seats, and the Kurd 9 equality test runs at the proposal map. C3 may overturn either. |
| R3-F | medium | A5 contradicts itself. "Such a record opens as Standard … SAVE held" conflicts with its own test "current-dev records and links open and re-save with no note lost", and E2's corpus names exactly that case (Pygmy with inner keys in slots). The open-as-Standard and SAVE-held behaviour is UI (U2's `index.html`) but sits in E2's row. The effect on savedMeaning (`meaning.push(o.profile.map)`) and on bottom compaction (R2-D) is still not stated. | dev `index.html` `savedMeaning`; A5; E2 row | Engine (E2): the rev-1 → `{map, unplaced}` migration, identity on ring-strict maps. U2 owns the open behaviour. The test reads "opens, no note lost; re-save allowed once the listed notes are resolved". State that an identity migration leaves savedMeaning unchanged, and say whether bottoms compact. |
| R3-G | medium | A7 can be bypassed. E2 merges T2, which carries the C0 and T3 commits, into `claude/neotone-e`. E2's dev PR, or its dev-sync branch, then lands those docs on dev under the AFK grant without the owner's word. | A2, A7, phase order | Either drop A7 (the docs ride with E2), or hold E2's dev landing on the same owner word (this fits R3-B's combined landing). |
| R3-H | medium | Ownership. U2 "deletes … the legacy export", but that export is in `src/engine/layout.js`, its inline region and `tests/layout.test.js`, which the Option B lanes table gives to E2. | Option B Lanes table, U2/E2 rows | Add the export deletion (layout.js, `tools/inline_engine.py` regen, the matching layout tests) to U2's ownership row in the C0 table. |
| R3-I | low | C0's "docs-only CI skips" cannot be observed. On #754 the `changes` job diffs the PR merge commit against main (29 files, src/tests included), and ENGINE-SPEC is in code scope, so full `validate` runs. | `.github/workflows/validate.yml` `changes`; `tools/ci_scope.py` | Acceptance: `validate` green at the new #754 head. |
| R3-J | low | The R2-K residual. "`sheet.inner` without '/MUTANT'" misses zh-Hans/zh-Hant "Cyclops/Mutant" and ja "サイクロプス/ミュータント". | `data/i18n/*.json` on dev | Per locale: the value differs from dev's and contains no mutant term (list the expected values). |
| R3-K | low | Residuals. The Kurd 9 string is still not written out ("fixed in the brief"). The Non-goal still reads "beyond the mocks" without "and D4". Q gains no D4/A6 rows. C4's "current heads" and C1's "A1 recorded" (where?) are undefined. The P2 brief should say that "P2 measures" padding cannot change v2 geometry (D3), only label fit. | Phases table; R2-J/R2-M fixes | Write the string. Fix the Non-goal. Add the Q rows. Name the head SHAs or the "no new commits" rule, and the record location. Add the one clarifying line to the P2 brief. |

Checks run: plan read in full; origin fetched; branch heads, PR state/head/base and `validate` conclusions at each head read with `git`/`gh`; first-parent and merge history of each lane branch; dev Option B plan sections Q-A, Q-C, E2/P2/U2 acceptance, Edge cases, Frozen card design, Lanes table; dev ENGINE-SPEC 18.1-18.5; dev `index.html` profile callers; dev `layout.js` `PROFILE`/`proposeProfile`; dev `core.js` `readProfile`; the tests pinning `HPE.layout.PROFILE`; the v2 fixture values and sha; `sheet.inner` in all 8 tables; the `validate.yml` change-scope job. Not run: no code or test suite was executed; the claimed dev breakage (R3-B) is inferred from reading the code, not reproduced.

### Review 4

Independent eng + design review, 2026-11-01. Checked against origin/dev b5aed492 (fetched) and `git show origin/dev:docs/plans/2026-10-30-neotone-option-b.md` (633 lines). The plan was read at 250 lines, which includes the "UI/UX conformance" section added after Review 3. Verdict **NOT_READY**: 1 blocker, 3 high, 2 medium, 4 low. D1-D5 were not reopened by this review. The plan's own conformance section reopens D3 (R4-A).

**R3 status.** All eleven R3 findings have a real fix in the text.
- R3-A: fixed by the C0 table. All 32 anchors are present at b5aed492; see R4-F for wrapped anchors.
- R3-B: fixed by A3 and the Coupling table. The residual is R4-D.
- R3-C: fixed by A2. The 7-commit chain cherry-picks cleanly in sequence onto 98281e35 (simulated with `git merge-tree` and `commit-tree`; the result tree passes `inline_engine`, `sync_i18n` and `sync_decks --check`, and its node suites ran 1467 pass, 0 fail, 4 todo). No push needs force.
- R3-D: fixed by A8 and row 32. This agrees with OB line 633: typed input is refused, and conversion shows the flags.
- R3-E: fixed by A7, E-S1 and E-S2.
- R3-F: fixed by A5 and A6.
- R3-G: fixed by A9.
- R3-H: fixed by A4 (there is no legacy export to delete).
- R3-I: fixed (no CI claim on C0).
- R3-J: fixed by A10. In all 8 locales the value differs from dev's and drops the mutant term (checked against dev `data/i18n`).
- R3-K: fixed. The P2 brief line is now contradicted by an original (R4-A).

**Verified true:**
- Heads: neotone-e 701c06fc, neotone-t2 98281e35, pa-p e769ae47, pa-u 7bd47fa4, pa-u-nits e3868245.
- #744, #749, #751, #754 and #793 are OPEN, base main, MERGEABLE.
- `validate` concluded success at all five heads.
- The first-parent chains match "Branch facts", and all five branches are ancestors of origin/dev.
- f2d8d2a1 is the only commit that turns `PROFILE_ENABLED` true.
- `git grep -c PROFILE_ENABLED origin/main -- src index.html` prints nothing (exit 1).
- None of the new branch names exist on the remote yet.
- Release safety holds. v1-v6 links are untouched. A rev-1 `pair-` v7 link still decodes, through A5. Main has no flag and no lane-E code. A6 pins savedMeaning.

| id | sev | finding | evidence | fix |
|---|---|---|---|---|
| R4-A | blocker | The plan carries an unresolved owner hold that can rewrite E2. The "UI/UX conformance" section says K1/K2 geometry is HELD until the owner's screenshots arrive, and "the plan then amends K1/K2 and D3". It points to "Open decision OD1", which does not exist anywhere in the doc. The Phases table, the Order line and "Continuation" ("When Ready: C0 and C1, then E2") never gate on the hold. The conflict is real. Fixture: main r 0.245, orbit 0.74, depth 0.44 of the diameter (0.2156R). Chord Card render: r 0.19R, orbit 0.745R, depth 1/3 of the diameter (0.1267R). So r is about 29% smaller and depth about 70% smaller, and n_in is 0.145 against the Standard 0.085R. The chronology runs the wrong way. The fixture was frozen at 75a1d7bb (06:16Z 10-31) from the 10-30 G1 answer, but owner thread 04c07816 ("match standard handpan card's geometry", 04:29Z 10-31) came earlier, and the OB "Owner change 2026-10-31" list followed. The P2 brief line ("a glyph under 3.6 pt goes to the owner") also contradicts G1's own rule ("1/3, measure first; under 3.6 pt move to about 0.49-0.50, no re-ask"). Scenario: E2 starts as Continuation says. It pins spec 18 (E-S1 "0.8478", 18.1 lensC 0.4656), the PL fixture test and the corpus to v2. The screenshots then pick Standard geometry. That needs a fixture rev 3, which is a Non-goal, D3 says "no rev 3", and `test_fixture_integrity.py` pins sha 611b59a2. E2 is rebuilt and P2 cannot pass gate (2) meanwhile. | Plan "UI/UX conformance" K1/K2 and the conflict and owner-answer paragraphs; Phases, Order and Continuation; dev `tests/fixtures/paired_profile_v2.json` and ENGINE-SPEC 18.1; `git log` on the fixture; Chord Card render and thread 04c07816 | Write OD1: options, recommendation, and a measured glyph table at r 0.245/0.19 by depth 0.44/1/3/1/2 against the 3.6 pt floor. Make OD1's owner answer a prerequisite of E2, which owns the fixture and spec 18, and of P2. Either amend D3, the Non-goal "fixture rev 3" and the fixture sha rule to match the answer, or record that D3 stands and exempt K1/K2 from gate (2). Rescore the rubric afterwards: criteria 1-4 fail today for OD1. |
| R4-B | high | Gate (2) ("a reviewer FAILs a lane on any row it owns that differs from the original, whatever the OB plan says") cannot be satisfied where the originals disagree with each other or with settled decisions. (1) D4 puts the checkbox on the Scale form; mock B1 says "No Neotone switch here" and owner thread 5d2e62f1 puts it on Layout only, yet U2 says "Unchanged form". (2) The U9 prefill "F Low Pygmy 18 Neotone Mutant" (mock s5; the built-in is "F3 LOW PYGMY 18") disagrees with K7's footer "F3 Low Pygmy 18 Neotone  #12" (Chord Card), so a deck saved with the U9 prefill fails K7. (3) K3 has no inner hairline (Chord Card, thread ddbe1a06), while the OB keeps the 0.74r hairline (card convention 4). (4) No row says whether the CLAUDE.md label rule (0.80325/0.64, 3.6 pt) or the Chord Card multipliers (.62/.42, M number r x .64 x .5) win, so a K4 side-by-side check flags every glyph. Scenario: U2 ships the D4 checkbox, and the reviewer, following gate (2) and mock B1, must FAIL it. | Mock B1; threads 5d2e62f1, ddbe1a06; `data/decks.json` Pygmy name; OB card convention 4; CLAUDE.md label rule | Per row, name the winning source and the owner decision with its date (D4 over B1/5d2e62f1; one name and one footer; hairline yes or no; the label rule over the mock sizes), and write gate (2) as "differs from the original, unless the row names an override". |
| R4-C | high | The decision-8 message has three different exact strings for the same Pygmy tick case. (1) The U2 phase acceptance and OB line 296: "Inner notes F5 and G5 have no tonefield. Remove them to save." (2) U7: "Neotone has 9 main tonefields. Remove 2 top notes (F5 and G5 have no tonefield)." (3) The mock (local copy): "Neotone has 9 main tonefields. Inner notes F5 and G5 have no tonefield: remove them to save." U7 quotes one of three causes. The s4 mutant-overflow sentence, the B2 lines ("note N goes in tonefield N", "Tonefields 7 to 9 have no mutant note. That's fine.") and the s5 built-in line are missing. Scenario: U2 implements string (1) so its own app test passes, and gate (2) FAILs it against U7. | Plan U2 row and U7; OB lines 295-296 and DR1; `neotone-mocks.html` s4/s5/B2 | List each message once, with its key and its exact en text, for the three causes and the B2/s5 info lines. Make the U2 acceptance and U7 quote that list. |
| R4-D | high | L puts a combined tree on served DEV that no CI has run. CI runs only on main PRs. #744, #749 and the U2 PR each validate E2 plus one side, and the first CI over E2+P2+U2 together is M's, which comes after L. A3's local list is the node suites, the sync checks, `validate.py` and `boot_sim.js`. It leaves out python-tests (`test_render_agreement.py` and `test_pdf_parity`, which compare the app's `pan` render through `dump_app_render.js` with hifi, exactly where the P2-side and U2-side `index.html` resolutions meet), `e2e.test.js`, panel-fit, `refresh_mutants.py --check` and suite health. Scenario: the L merge resolves a `pan`/`panField` hunk toward U2's copy. The node suites stay green, and the render-agreement test that would catch the lens mismatch never runs. Served DEV then draws Pygmy cards that disagree with the PDF until M's CI, after landing. | `.github/workflows/validate.yml` jobs; A3 run list; Phases L and M order; dev `tests/test_render_agreement.py` (PROFILE_DRAW assertion) | Swap L and M. Build `claude/neotone-m` (E2 head, then merge commits of P2 and U2, then M's mutants), open its main PR, and land dev from that same head only after `validate` succeeds there, via `claude/dev-sync-neotone`. Minimum alternative: add `python3 -m pytest tests/test_render_agreement.py tests/test_pdf_parity.py` and `node tools/refresh_mutants.py --check` (or its python equivalent) to A3's run. |
| R4-E | medium (design) | Conformance coverage gaps. (1) Owner thread 5d2e62f1 asks the UI to tell users that the Layout tab rearranges placement; no row covers it ("rearrange" does not appear in the plan). (2) Layout-preview labels are unspecified ("Ns" in the mock lens versus `M<n>` in the Chord Card, thread 8e392bb2), and U11's human check is "n/a", against gate (3). (3) The K-row "numeric diff against the Chord Card SVG" names no committed reference file, extraction method or tolerance, and covers only Pygmy, although K6 cites Kurd 9. | Threads 5d2e62f1, 8e392bb2, 9fa770b1; K1-K7 automated column | Add a row for the hint, or drop it with a reason. Specify the preview labels and give U11 an observable. Name the reference fixture, the method and the tolerance, and add Kurd 9. |
| R4-F | medium | The Coupling table is incomplete. Missing: `pan()` in `index.html` (reads `HPE.pdfcards.PROFILE_DRAW` and `profileExtent`; on the P2 side under A3, but not listed), `tools/decks.py` `_profile_radius`, `tests/fixtures/profile_case_*_v1.json` and `dump_app_render.js`, and the `tests/test_fixture_integrity.py` needles. Those needles ("rev 2", "ring-strict", "unplaced", "pitch order", "M<n>", "proposeProfile") constrain E2's spec 18 rewording. Owners exist through A3, A4 and the P2 row, so this is not a blocker. The table nonetheless claims to be the inventory. | `git grep` on origin/dev for PROFILE, PROFILE_DRAW and profile_radius | Add the four rows, with their owners. |
| R4-G | low | The C0 "diff equals table row for row" check works only if wrapped lines are ignored. Rows 16 (245-246), 19 (338-339), 26 (398-399) and 27 span line breaks, and so do E-S1, E-S4 and the 18.4 "for every non-ding field" anchor. | `git show b5aed492:` OB plan and ENGINE-SPEC | Say that the check compares reflowed text, or give the anchors as line ranges. |
| R4-H | low | Ownership of `reason.NEOTONE_INPUT` is unclear. The app renders refusals as `"reason." + r.code` with the engine REASONS as source. `tests/core.test.js` compares REASONS with the ENGINE-SPEC table, and that table is E2's. The plan gives the key to U2 ("UI, i18n key") without saying whether it is an engine REASONS code (E2, spec row) or app-only. | dev `index.html` reason renderer; `tests/core.test.js` REASONS/spec tests | State which, and name the owner of the spec row if it is a REASONS code. |
| R4-I | low | The Risks line says the swaps lost are on "cross-ring maps". Under A5, every non-ring-strict map is re-proposed, which includes every DEV Pygmy record (inner F5/G5 keys). A gentler migration exists and is not chosen: keep the r/b keys in place and send only the i and cross keys to `unplaced`. DEV-only, so this is acceptable as written. | A5; dev Pygmy rev-1 map | Reword the Risks line, or record the alternative as considered. |
| R4-J | low | Smaller items. The rubric's "Pass 2: 10/10" was scored before the conformance section existed. K5's root-coloured frame was never confirmed (owner thread 2f095580 says "solid black like standard", and has no reply). The white band inset and the empty-lens fill (#f3f1f5) are not in K3/U8. The vendor-name ban test from OB decision 11 has no row. | Rubric section; Chord Card threads | Rescore after R4-A, flag K5 for C3, and add the details. |

Checks run:
- The plan was read in full (250 lines); dev's OB plan (633 lines) and dev's ENGINE-SPEC 18 were read.
- All 32 C0 anchors and the E-S anchors were located.
- Branch heads, first-parent chains and ancestry of dev were checked with `git`.
- PR state, head, base and mergeable were read, then the `validate` conclusion at each of the five heads (`gh`, one call at a time).
- `PROFILE_ENABLED` was checked on main and on dev.
- The 7-commit cherry-pick chain was simulated onto 98281e35. `inline_engine`, `sync_i18n` and `sync_decks --check` were run on the result, and so were the node suites (app, pdfcards, layout, core, share, storage_corpus, link_corpus and others): 1467 pass, 0 fail.
- Dev readers of the PROFILE APIs were found with `git grep`.
- `sheet.inner` was read in all 8 dev tables.
- The engine corpus was checked for profile content: it holds codes only, so a reason rewording does not require regenerating it.
- A design sub-review read all three originals and their 30 comment threads, plus the fixture and `layout.js` on dev.

Not run:
- The E2/P2/U2 code does not exist yet, so the A3 merge could not be tried.
- No python, e2e or panel-fit suite was run on the sim tree.
- No rendered card was diffed against the Chord Card SVG.
- The glyph sizes at r 0.19 are an estimate, not a measurement.
- No Codex outside voice was used.


### Round 3 eng review

(verbatim, independent /plan-eng-review, 2026-11-01)

Verdict **NOT_READY**: 0 blocker, 3 high, 2 medium, 2 low. OD1 and D1-D5 not reopened. Holds: R4-A, R4-C, R4-E..R4-J. Not held: R4-D (C0 table still has L-before-M, E3-A); D2-3/D2-4 (U2 phase row corrupted, E3-C).

| id | sev | finding | evidence | fix |
|---|---|---|---|---|
| E3-A | high | M-before-L swap not carried into C0 table: row 12 sets OB M prereq to "the combined `claude/dev-sync-neotone` landing on dev"; row 13 resolves P2/U2 conflicts on `claude/dev-sync-neotone`, while A3 resolves them on `claude/neotone-m`. Scenario: lanes briefed from amended OB plan deadlock (M waits for dev landing, L waits for green M), or L resolves `pan`/`panField` hunks on the dev-sync branch where CI never runs (the R4-D failure). Rubric (5) scored pass but fails. | C0 rows 12, 13 vs A3 and Phases M, L | Row 12: M prereq = "E2, P2, U2 each green at a verified head and reviewer-passed". Row 13: "resolved once on `claude/neotone-m` (A3); `claude/dev-sync-neotone` only merges that head". Rescore (5). |
| E3-B | high | E-S1 keeps a v2 figure: "orbit + depth/2 (0.8478)" = 0.74 + 0.2156/2. Under rev 3 it is 0.745 + 0.1267/2 = 0.8083. Other 18.1 v2 numbers (r 0.245, lensC 0.4656, mutant name 0.6028, n_in 0.145 → M number 0.35) have no exact replacement row; integrity needles read that text. Scenario: E2 pastes E-S1 verbatim; spec says 0.8478 while PROFILE gives 0.808; K1 1% check fails or spec and code disagree. | E-S1; dev ENGINE-SPEC 18.1 | Recompute every 18.1 figure from rev 3; exact E-S rows (or one 18.1 replacement block); E-S1 = 0.8083 or a formula. |
| E3-C | high | Phases U2 row is corrupted: holds a 9-cell conformance row in a 5-column table; no prereq, A2 deliverable, Option A deletion, storage_corpus port, U1-U16 scope, or acceptance. D2-3/D2-4 claim M1 is there; it is not. Rubric (1)-(4) fail for U2. | Phases U2 row; D2-4 disposition | Rewrite the row with five cells (lane; E2 green + O2/O3; A2 branch + cherry-picks, A4/A6/A8, U1-U16, M1-M8, A10, storage_corpus port; exact strings, i18n step, `validate` at U2 head, reviewer PASS). |
| E3-D | medium | Fixture rev 3 collides with map `rev`. Spec 18.7: "a geometry change is rev 3 with a rev 2 reader"; fixture `"rev"` key is the profile rev. Plan keeps maps at rev 2; nothing says what `paired_profile_v3.json`'s `rev` holds or what readProfile/decode accept for 3. | dev `paired_profile_v2.json`; ENGINE-SPEC 18.7; A5, E-S3, E-S4, Risks | Decide: fixture `"rev": 3` with maps still `rev: 2`, or maps rev 3 with a rev 2 reader; exact 18.7 sentence; rev-3 constant and test in `test_fixture_integrity.py`, v2 kept pinned and SUPERSEDED. |
| E3-E | medium | `test_fixture_integrity.py` pins glyph floors on the fixture (`test_every_glyph_at_least_floor_at_print_radius`, `1/3 <= depth <= 0.50`); E2 owns them, but the lens glyph rule depends on O1, gated only before P2. Scenario: E2's rev-3 floor test goes red (lens octave about 2.9 pt) or E2 picks f itself. Rev 3 leaves `mutant.r`, `angles`, `extent_margin`, `slots` unstated. | dev test_fixture_integrity.py; K8, O1, Phases E2 | Make O1 (or default 0.53) a prereq of E2, or move the lens glyph-floor assertion to P2. List every rev-3 key and value. |
| E3-F | low | L's use of the `claude/dev-sync-*` grant is literal but a stretch (carries code main has not merged; tree differs from CI-green M head). A3 limits make it acceptable. | Global AFK grant; A3 | Record as an AFK auto-decision; optionally require `git diff <M head> <L merge> -- $(git diff --name-only main...<M head>)` empty. |
| E3-G | low | Rubric self-scored 10/10 while E3-A and E3-C fail items 1-5; the 0.245/0.44 grep did not cover this doc's E-S rows. | Rubric | Rescore after fixes; extend the grep to E-S rows and Coupling. |

Checks run: plan read in full (391 lines), each R4 and D2 disposition checked; C0 rows vs A3 and Phases; origin fetched, dev b5aed492; `git show origin/dev:` of the v2 fixture, ENGINE-SPEC 18.1/18.7, test_fixture_integrity.py; E-S1 recomputed; L grant read. Not run: no code or suites; branch heads/PRs/merge-tree not re-verified; validate.yml and OB anchors not re-read; no Codex voice; skill's interactive questions skipped as briefed.

Integrator note (not part of the review): E3-C was an editing error in the fold-in (the conformance U2 row overwrote the Phases U2 row). Fixed after this review: the Phases U2 row is restored with five cells and the conformance U2 row carries the D4 text. E3-A, E3-B, E3-D, E3-E, E3-F, E3-G are open.

### Round 3 design review

(verbatim, independent design review, 2026-11-01; the interactive /plan-design-review skill was replaced by a manual review)

Verdict: NOT_READY. Blocker 0, high 1, medium 3, low 2.

- D3-1 (high). M5 "Tap two notes to swap them, or hold and drag." is not in any original; the plan says so ("wording is U2's"), breaking the hard requirement and the "verbatim" header. Mock B2 has no UI string for the hint; closest is the designer note "Moving notes works as today: tap a note, then another in the same ring, to swap them, or hold a note and drag it."; thread 43487e52 asks only that drag/swap be supported. Scenario: U2 ships M5, reviewer passes it, owner finds no source at C3, i18n re-roll across 8 tables after dev merge. Fix: relabel M5 "NEW, not in originals"; use the mock-note sentence trimmed to UI voice as an O4 owner question with that default, or drop U14/M5.
- D3-2 (medium). M8 `reason.NEOTONE_INPUT` is invented ("U2 writes the sentence") in a list headed "verbatim". Fix: move M5 and M8 to a "new strings, owner-approved at C3" sub-table, or reuse M2 for the 10th-top-note case.
- D3-3 (medium). O2 option (b) says "title-case" but shows upper case; default (a) gives a mixed-case name matching neither original. Fix: "upper-case" in (b); note in (a) that it differs from the mock's casing and is accepted under F4.
- D3-4 (medium). U10 does not state which message an older build shows for a v7 link; thread 43f4cec1 left it open ("show a clear 'update to open this layout' message, or fall back to Standard. Please pick one."). Fix: record NEEDS_NEWER_APP (existing, conservative) as an AFK decision with source, or ask the owner.
- D3-5 (low). O1 rests on estimates at R 66 pt and is needed before P2, whose glyph table comes later. Fix: if P2's measured f-min differs, P2 uses the measured floor-holding value and reports it; O1 not re-asked.
- D3-6 (low). M1, M6, M7 co-display order on s5 is unstated (diagram, M6, Name, M7, M1). Fix: add the order to U9/U7's human check.

D2 dispositions: all 11 hold in the table text (D2-2, D2-3, D2-5, D2-6, D2-10 checked). M1, M2, M2b, M3, M4, M6, M7 match the mock text exactly (local mock copy neotone-mocks.html). No uncovered elements in the threads read.

Checks run: plan sections read; local UX Mocks copy grepped for every M string, swap/drag wording, Cancel/SAVE; 3 of 14 UX Mocks threads read in full (43487e52, 43f4cec1, fd88cb59). Not run: 11 of 14 UX Mocks threads; 16 Chord Card threads; live Artifact read (local mock copy dated 2026-10-30 16:01); QA Guide; origin/dev i18n/index.html checks; the interactive skill itself.


### Round 4 disposition (E4-A..E4-F, D4-1..D4-5)

- E4-A high: fixed. Rev-3 test is `abs(depth - 1/3) < 1e-4`; the false "compares against 1/3 - 1e-4" claim is removed.
- E4-B high: fixed. E-S10 (60.9 -> 61.8); O1 recomputed at R 61.8 to f = 0.565; every K8 figure restated at R 61.8.
- E4-C medium: fixed. E-S11 decor-ring bullet; E2 asserts `decor.r`, P2 draws and tests it.
- E4-D medium: fixed. Grep extended to derived 18.1 figures ("60.9", "0.53", "R 66"); rubric rescored (Pass 5).
- E4-E low: fixed. E-S4 replaces 18.7's opening sentence.
- E4-F low: fixed. C0 row 13 anchor starts at line 205 "Lanes refreshing".
- D4-1 high: fixed. U11, K4, E-S12 and the preview DOM test are conditional on a mutant note (AFK D4-1).
- D4-2 medium: fixed. K8 adopts x0.62, ding 0.623 to hold the floor (AFK D4-2).
- D4-3 medium: fixed. K4 names all nine main names and the no-mutant case.
- D4-4 low: recorded as mock illustration (AFK D4-4).
- D4-5 low: fixed. U9 names `sheet.neotone_name_label`, en "Name"; U2 adds it to all 8 tables.

Pass 5 (round 4, 2026-11-01): (1)-(4) pass; (5) pass on a grep for "0.245", "0.44", "0.2156", "0.4656", "0.6028", "0.8478", "0.145", "60.9", "0.53", "R 66" (remaining hits are quoted Old cells, review logs or history); (6) partial, re-verified at C1; (7)-(10) pass; every E4 and D4 finding has a disposition. 9/10.

### Round 5 disposition (E5-1..E5-4, D5-1..D5-3)

- E5-1 medium: fixed. E-S13 restates the 18.1 sizes per K8 and pins the print extent to the unscaled 0.64 x `main.r` term.
- E5-2 medium: fixed. C0 row 9 and the E2 phase row cite E-S1..E-S13; the stale E-S1..E-S4 is removed.
- E5-3 low: fixed. U7 cites M1-M8 incl. M2b.
- E5-4 low: noted in K8 (P2's every-glyph test guards the 0.002 pt ding margin).
- D5-1 low: fixed. K8 ding term uses r_ding (0.2R).
- D5-2 low: fixed. B2 and s4 element order stated above the Message list.
- D5-3 low: fixed. U11 places the mutant name in the lens at 0.6183R and `M<n>` at 0.47R, not stacked.

### Round 4 eng review

(independent /plan-eng-review, 2026-11-01, read-and-report only, against origin/dev b5aed492)

Verdict **NOT_READY**: 0 blocker, 2 high, 2 medium, 2 low. OD1, D1-D5, O1-O4, A12 and A13 were not reopened. The E3 dispositions hold as written: E3-A (C0 rows 12/13 now match A3), E3-B (figures recomputed), E3-C (Phases U2 row has five cells), E3-D (E-S4 splits map rev from fixture rev), E3-E (rev-3 keys listed, floor test moved to P2), E3-F (A13 plus the diff acceptance), E3-G (rescored). Two new defects came in with the rev-3 numbers.

| id | sev | finding | evidence | fix |
|---|---|---|---|---|
| E4-A | high | The "Fixture rev 3" note claims the depth check "compares against 1/3 - 1e-4". On dev it is the strict `self.assertTrue(1 / 3 <= p["mutant"]["depth"] <= 0.50)`, with no tolerance. The fixture stores `"depth": 0.3333`, which is below 1/3. Scenario: E2 copies the rev-3 tests from the v2 class as the plan implies. `0.3333 >= 0.33333…` is False, so `test_fixture_integrity.py` goes red at the #744 head. Or E2 changes the depth to make it pass, which edits an owner-fixed value (OD1) outside its brief. | dev `tests/test_fixture_integrity.py`, v2 class `test_each_lens_inside_its_main_circle_on_the_ding_side_at_frozen_depth` (the `1 / 3 <= ... <= 0.50` line); plan "Fixture rev 3" paragraph | Pick one and write it out exactly. (a) The rev-3 test asserts `abs(depth - 1/3) < 1e-4` (and the note stops saying the old check "holds"). (b) The fixture stores a depth >= 1/3, for example 0.33334, and E-S7 and the derived figures are restated. |
| E4-B | high | The print radius in 18.1 is a derived figure that was not recomputed, and there is no E-S row for it. Dev 18.1 says "R = round(74 / extent, 1) = 60.9", where extent = number_out + 0.64·main.r/2 + extent_margin. At r 0.19 that is 1.0758 + 0.0608 + 0.06 = 1.1966, so R = 61.8. The O1/K8 lens-floor reasoning uses "R 66 pt", but rev 3 prints at R 61.8. At R 61.8, f = 0.53 gives a lens octave digit of 0.19·61.8·0.8232·0.53·0.66 ≈ 3.38 pt, which is under the 3.6 pt floor. (At R 66 it is about 3.61 pt, which is where 0.53 came from.) Scenario: P2 builds with O1's f = 0.53, its new every-glyph ≥ 3.6 pt test goes red on Pygmy lens octaves, and P2's gate fails. Separately, E2 leaves "60.9" in the spec while `HPE.pdfcards`, hifi and decks compute 61.8, so the spec and the code disagree. | dev ENGINE-SPEC 18.1 "Print extent" bullet; K8 row; O1 | Add E-S10: "= 60.9" → "= 61.8". Recompute O1's factor at R 61.8: the floor-holding minimum is about 0.565 (3.6 / (0.19·61.8·0.8232·0.66)). Record it as O1's value, or state that P2's measured value replaces it (D3-5 already allows that). Add "60.9" to the Pass 4 grep list. |
| E4-C | medium | The new `decor` key (0.355) has no ENGINE-SPEC row, no renderer owner and no integrity test. 18.1 describes no decor ring, and none of E-S1..E-S9 adds one. K1 names it, but no row says who draws it (P2) or what checks it. Scenario: E2 adds the key, nothing reads it, and the K1 1% diff against the Chord Card SVG flags a missing circle at C3. | dev 18.1 (no "decor"); plan "Fixture rev 3", E-S table, K1 | Add an E-S row inserting an 18.1 bullet ("Decor ring: circle of radius `decor.r` (0.355), stroke …") and put the decor-ring draw in P2's acceptance. |
| E4-D | medium | Rubric Pass 4 item (5) is scored "pass", but E4-A and E4-B are contradictions between this doc and the dev sources it amends. Its grep covered v2 inputs only, not derived print figures. Pass 4's 9/10 overstates. Item (6) "partial" is honest. | Rubric Pass 4 | Rescore after E4-A and E4-B: (5) fails until fixed. Extend the grep to every number in 18.1 (60.9, 1.0758-derived extent). |
| E4-E | low | E-S4 replaces only the last sentence of 18.7. The opening sentence still lists only "`tests/fixtures/paired_profile_v2.json` (the rev 2 profile; v1 is superseded and kept)". After E2 that names a superseded fixture as current, and it uses "rev 2" in the fixture sense that E-S4 now separates from the map rev. | dev 18.7 opening sentence | Extend E-S4 to that sentence: "`paired_profile_v3.json` (fixture rev 3; v1 and v2 are superseded and kept)". |
| E4-F | low | C0 row 13's anchor runs from "Second lander of P2/U2". Its new text starts "Lanes refreshing context-shifted existing mutant patches … is allowed; new `pa_*` mutants belong to M." That sentence is already on OB lines 205-206, just before the anchor, so the edited OB plan states it twice. | OB plan at b5aed492, lines 205-206 | Start the anchor at line 205 "Lanes refreshing", or drop that sentence from row 13's new text. |

Checks run:
- Read the plan in full (489 lines) and checked every E3 and D3 disposition against the text.
- Ran `git fetch` (origin/dev = b5aed492).
- Read `git show origin/dev:` of ENGINE-SPEC section 18 (18.1, 18.2, 18.4, 18.7), `paired_profile_v2.json` and `tests/test_fixture_integrity.py` (v2 class, depth check, floor test, sha pins).
- Read the OB plan lines 202 and 205-211 (C0 rows 12/13).
- Located the exact old text for E-S1..E-S9 and the 18.4 "for every non-ding field" anchor. All exist; E-S7 and 18.4 need reflow, which the plan already allows.
- Recomputed the rev-3 figures. depth 0.1267, lensC 0.4917, lens name 0.6183, main name 0.8083 and M number 0.47 are all correct; the lens and main names sit at the midpoints of the lens and the crescent. Main circles are disjoint (chord 0.5096 > 0.38) and clear of the ding.
- Recomputed the print extent and R (61.8) and the lens glyph sizes at f = 0.53.
- Checked map rev against fixture rev across A5, E-S3, E-S4 and readProfile: consistent (maps rev 2, rev 1 through migrateProfile, fixture rev 3).
- Checked C0 and Phases order: M comes before L everywhere.
- Checked the Phases U2 row: complete (prereq, owner, deliverable, acceptance incl. M1, `validate` and reviewer).

Not run:
- No code or test suites were run, and the rev-3 tests were not prototyped.
- Branch heads, PR state and merge-tree were not re-verified (item (6) defers that to C1).
- The OB anchors other than rows 12/13 were not re-read.
- No Chord Card SVG diff, no Codex outside voice.
- The skill's interactive questions and its report-file/review-log writes were skipped, as briefed (read-and-report only).

### Round 4 design review

I ran this review by hand: /plan-design-review is interactive. Read-and-report only. No edits, commits, publishes or comments.

**Verdict: NOT_READY** (1 high, 2 medium, 2 low)

**D4-1 (high): U11 and K6 contradict each other on where main numbers go for a Neotone scale with no mutant notes.**
- **Finding:** U11 puts main numbers "outside the pan at number_out 1.0758 on cards AND the Layout preview" and does not exempt non-mutant scales. K6 says "pitch numbers where Standard puts them".
- **Evidence:** Chord Card thread 09263155 (owner, 10-31 04:33): "For neotone non mutant - pitch number should sit where standard handpan pitch number sits". It is the last word on this and overrides 04c07816's "Kurd card's numbers will move outside the rim too". The live Chord Card code agrees: `pt(a, C.mut.length ? R+5 : orbit-r-.085*R)`. Numbers go to 1.0758R only when the scale has mutants. Without mutants they sit at the Standard inboard spot, about 0.47R.
- **Failure scenario:** the P2 lane follows U11 and renders Dm on D Kurd 9 Neotone with numbers at 1.0758R. The U11 render test passes. K6's Kurd 9 equality test and the C3 side-by-side against the Chord Card then fail, or the reviewer FAILs P2 on K6. Either way one of the two rows must be broken.
- **Fix:** U11 should read "for a scale with at least one mutant note; with none, numbers sit at the Standard spot (orbit - r - n_in) on cards and the preview (K6, thread 09263155)". Apply the same condition to `number_out` in fixture rev 3 / E-S rows and to the preview DOM test.

**D4-2 (medium): K8 main glyph sizes leave out the Chord Card's 0.62 compromise factor.**
- **Finding:** K8 sizes main names with the plain project rule (rim 0.80325 x r, number 0.64 x r).
- **Evidence:** the live Chord Card draws main names at `r*.80325*.62`, numbers at `r*.64*.62` and the ding at `.70875*.62`. That follows owner thread 377b20d7: "The notes need to be slightly smaller as a compromise for aesthetics". K8's human check now compares glyph sizes (D2-5 withdrew "positions, not sizes").
- **Scenario:** at C3 the owner sees main names and numbers about 1.6x larger than the Chord Card. That fails the "matches the original" requirement on a row whose authority is the Chord Card.
- **Fix:** either adopt the 0.62 factor for main names, numbers and ding on Neotone cards (it stays above 3.6 pt: 0.19 x 66 x 0.80325 x 0.62 x 0.66 is about 4.1 pt for the octave digit), or record an explicit owner/AFK override citing 377b20d7.
- **Note:** O1's lens factor 0.53 and `M<n>` = 0.64 x 0.5 are fine.

**D4-3 (medium): no row or test for the main-name position on tonefields 7-9.**
- **Finding:** K4 says "Main names centred in the crescent". It does not say this covers tonefields with no mutant note.
- **Evidence:** thread 0e928a74 (04:41, later than 0f23fc62) moved Ab4, C5 and Eb5 into the crescent too. The live code centres every name at orbit + depth/2 whenever the scale has any mutant.
- **Fix:** K4 should read "all nine main names (including tonefields with an empty lens) at orbit + depth/2 when the scale has any mutant note; at the field centre when it has none (K6)".

**D4-4 (low): mock s4's grey echo line has no row.**
- **Finding:** s4 shows "Bottom field: C3 Db3 Eb3 Bb3 Db4 Ab5 Bb5 C6 Db6 Eb6" above M2b, and no plan row covers it.
- **Fix:** add a row, or record the line as mock illustration and not UI.

**D4-5 (low): the s5 "Name" label and its key are not named.**
- **Finding:** U9 covers the editable name field, but not the label text "Name" or its key. A lane could reuse a differently worded existing label.
- **Fix:** name the key in U9 and set en "Name".

**Checks that hold:**
- **Verbatim strings:** M1, M2, M2b, M3, M4, M6 and M7 match the live UX Mocks exactly.
- **M5:** "Tap a note, then another in the same ring, to swap them, or hold a note and drag it." is an exact clause of the live B2 designer note with the first letter capitalised.
- **U2 labels:** "Top Notes" and "Bottom Notes / Neotone Mutant Notes (optional)" match mock B1 and thread 5d2e62f1 ("Yes title case").
- **s5 order:** diagram, M6, Name, M7, M1 matches the mock.
- **U16:** Cancel left, SAVE right matches.
- **AFK decisions:**
  - **O1:** faithful. Lens name 0.19 x 66 x 0.8232 x 0.53 is about 5.47 pt, octave digit about 3.61 pt, so it meets the floor.
  - **O2:** faithful under F4. On dev the stored name is "F3 LOW PYGMY 18".
  - **O3:** faithful.
  - **O4:** faithful.
  - **A12:** faithful. The mock note says an older app "already shows 'needs a newer app'", which answers thread 43f4cec1.
- **D3 dispositions:** D3-1, D3-2, D3-3, D3-4, D3-5 and D3-6 all hold.
- **K rows against the Chord Card:**
  - **Geometry (K1, K2):** orbit 0.745, r 0.19, ding 0.2, n_in 0.085, decor 0.355 and depth 2r/3 match the live code.
  - **Bands (K3):** 0.046R / 0.024R matches.
  - **`M<n>` position (U11):** the old Standard spot matches thread 04c07816.
  - **Card frame (K5):** root-colour frame per thread 2f095580.
  - **Footer (K7):** "#12" handled by K7.
- **QA Guide:** still describes Paired areas, as the plan says, and is rewritten in phase Q.

**Thread ids read:**
- **UX Mocks (14/14):** 43487e52, 43f4cec1, fd88cb59, 8026903e, 65d431a1, b34ab3ae, 06a5ada3, 9fa770b1, 76aa98db, 5d2e62f1 (full), e8ebe9f4, 62634f89 (full), 91832383 (full), e2b215ae.
- **Chord Card (16/16):** 0e928a74, 0f23fc62, 09263155, 04c07816, bb934459, 0d0cf487, dc04e825, b7a90806, 377b20d7, 8e392bb2 (full), ddbe1a06, 2f095580, 11f5d4d6, 648f6717, cdb79d37, dd0ce7c9.

**Checks run:**
- Live Artifact read of UX Mocks, Chord Card and QA Guide.
- All 30 comment threads, paged and with elided threads read individually.
- Plan sections: UI/UX conformance, Message list, New strings table, Fixture rev 3, OD1, O1-O4/A12/A13, Round 3 disposition.
- String-by-string compare against the mock source.
- Chord Card SVG code compared against K1-K8.
- `git show origin/dev:data/decks.json` (deck names) and `origin/dev:data/i18n/en.json` (current sheet labels).
- O1 and K8 point-size arithmetic at R = 66 pt.

**Not run:**
- Rendering or pixel measurement of the artifacts.
- The served DEV app.
- Any test suite.
- Checks of A13 or the C0/E-S engineering rows beyond the geometry figures.

### Round 5 eng review

**Verdict: NOT_READY.** 0 blocker, 0 high, 2 medium, 2 low. The two medium findings are spec/ownership text gaps, and each needs only a one-row fix. With both folded in, the plan is READY. No figure is wrong.

Round-4 dispositions hold in the plan body:
- **E4-A:** the rev-3 depth check is `abs(depth-1/3)<1e-4`, and the v2 class keeps its own check.
- **E4-B:** E-S10 reads 61.8. Recomputed: extent 1.0758 + 0.0608 + 0.06 = 1.1966, and 74/1.1966 = 61.84, so R = 61.8.
- **E4-C:** E-S11 adds the decor bullet. E2 asserts the key; P2 draws and tests the ring.
- **E4-E:** E-S4 now replaces 18.7's opening sentence.
- **E4-F:** C0 row 13's anchor starts at line 205 "Lanes refreshing". Checked against OB lines 205-211 at b5aed492.
- **D4-1:** U11, K4 and E-S12 are conditional on a mutant note.
- **D4-2:** K8 uses x0.62 with ding 0.623.
- **D4-5:** U9 names the key.
- **O1 = 0.565:** confirmed.

Glyph sizes recomputed at R 61.8 (r = 11.742 pt, ding r = 12.36 pt), against the 3.6 pt floor:

| Glyph | Name | Octave digit / size |
|---|---|---|
| Main | 5.85 | 3.86 |
| Number | 4.66 | — |
| Ding at x0.62 | — | 3.585 (fails) |
| Ding at x0.623 | — | 3.602 |
| Lens at f 0.565 | 5.46 | 3.604 |
| `M<n>` | 3.76 | — |

All figures match K8, and everything except ding x0.62 holds the floor.

| id | sev | finding | evidence | failure scenario | fix |
|---|---|---|---|---|---|
| E5-1 | medium | No E-S row amends the 18.1 sentences "Size is the label rule number size, 0.64 x `main.r`" and "The label rule and the 3.6 pt print floor are unchanged and apply to every glyph". K8 now sizes numbers at 0.64x0.62, ding at 0.623, lens names at 0.8232x0.565, and `M<n>` at 0.64x0.5. The extent bullet also says "number size / 2" without saying which size. | dev ENGINE-SPEC 18.1 "Numbers" and "Print extent" bullets; plan E-S table (E-S1..E-S12) vs K8 | If P2 feeds the K8 number size (0.64·0.62·0.19) into "number size / 2", extent is 1.1735 and R = 63.1, not E-S10's 61.8. Spec and code then disagree, or an R-equality test goes red. If it uses the unscaled size, the spec still states a number size the code does not use. | Add E-S13. Restate the 18.1 sizes per K8 (rim name x0.62, number x0.62, ding x0.623, lens 0.8232x0.565, `M<n>` 0.64x0.5; floor 3.6 pt kept). State that the extent uses the unscaled 0.64·`main.r` term, which is what pins R at 61.8. |
| E5-2 | medium | C0 row 9 still writes the OB E2 ownership as "course-correction rows E-S1..E-S4". The E2 phase row lists both "E-S1..E-S12" and a leftover "ENGINE-SPEC rows E-S1..E-S4". | plan C0 row 9; Phases E2 deliverable | Lanes are briefed from the amended OB plan. E2's brief would then own only E-S1..E-S4, so E-S5..E-S12 (r 0.19, depth 1/3, R 61.8, decor, conditional numbers) are out of scope or flagged as boundary violations by the reviewer. This is the same class as E3-A, stale C0 rows. | Change row 9 to "E-S1..E-S12" (E-S13 if E5-1 is taken). Drop the duplicate "E-S1..E-S4" from the E2 row. |
| E5-3 | low | U7 says "Exactly the strings in the Message list (M1-M7)". The list has M1-M8 plus M2b, and the U2 row says M1-M8. | U7 vs Message list and Phases U2 | A reviewer could skip M2b/M8 under U7. | Change it to "M1-M8 incl. M2b". |
| E5-4 | low | The ding octave margin is 0.002 pt (3.602), and any extent change breaks it. The plan already lets P2's measured value replace the factor (D3-5), so this is noted only. | K8 | A small extent tweak drops the ding under 3.6 pt. | None needed beyond P2's every-glyph test. |

No new contradictions were introduced by the fold beyond E5-1 and E5-2. OD1, O1-O4, A12, A13, D4-1/2/4 and E4-A are internally consistent.

**Checks run:**
- Plan read: lines 1-245 in full, plus the Round 4 disposition and review logs. Remaining 246-619 grep-scanned.
- Dev b5aed492 compared via `git show`: ENGINE-SPEC 18.1 (lines 1173-1200), the 18.2 "rev 1 is not read" anchor, the v2 depth check in `tests/test_fixture_integrity.py`, and OB plan lines 205-211.
- All rev-3 derived figures and every K8 glyph size recomputed by hand.

**Not run:** the `/plan-eng-review` skill was not invoked. I did the review by hand at low effort, so no interactive steps came up. Not checked:
- `paired_profile_v2.json` content, `data/i18n/en.json`, `src/engine`, `tools/hifi.py` / `tools/decks.py` code.
- Branch heads, PRs and merge-tree.
- OB anchor lines other than 205-211.
- Any test suites.

### Round 5 design review

**Verdict: READY.** 0 blocker, 0 high, 0 medium, 3 low. All the lows are wording fixes that can go in without another review round. I did not reopen any AFK decision (O1-O4, A12, A13, D4-1, D4-2, D4-4), and each one is consistent with its thread.

**D5-1 (low): K8 does not say which radius "r" is in the ding term.**
- Finding: K8 says "ding 0.70875 x 0.623 x r". The 3.60 pt octave figure only works with the ding's own radius, 0.2R.
- Evidence: the live Chord Card code is `name(C.ding[0],cx,cy,dr*.70875*.62,…)`, with `dr = r_ding*R`. At R 61.8: 0.2·61.8·0.70875·0.623·0.66 = 3.60 pt. With r_main 0.19R it comes to 3.42 pt.
- Failure scenario: P2 reads "r" as the main radius, as it does in the other K8 terms. The ding octave digit then prints at 3.42 pt, under the 3.6 pt floor, and P2 "fixes" it by changing the factor.
- Fix: write "0.70875 x 0.623 x r_ding (0.2R)".

**D5-2 (low): the order of elements on the B2 Layout tab is not pinned.**
- Finding: the plan pins the s5 order (D3-6) but not B2's. U12 says only "under the switch" and U13 has no position. M5 (new) has no slot.
- Evidence: the live mock `S("b2",…)` order is tabs, switch, M3 (muted), M2 (msg), M4 (muted), pan, Cancel/SAVE. In s4 it is the switch, then M2b, then the pan.
- Failure scenario: U2 puts the messages below the pan, or M4 above M3. Every message string test passes, but the C3 side-by-side fails against B2.
- Fix: add one line to the Message list: "B2 order: switch, M3, M2/M2b, M4, M5 (AFK placement), pan, Cancel/SAVE; s4: switch, M2b, pan".

**D5-3 (low): U11's "note over `M<n>`" reads as a stacked label.**
- Finding: the Chord Card does not stack them. The mutant note name sits in the lens at 0.6183R (lensC + r - depth/2). `M<n>` sits separately at 0.47R (orbit - r - 0.085R), on the same radial line.
- Evidence: Chord Card code (`qx,qy=pt(a,lensC+r-depth/2)`; `sx,sy=pt(a,orbit-r-.085*R)`), and thread 04c07816 at 04:32: "Mutant pitch number should sit where previous standard handpan pitch number sits". E-S8 already has 0.6183.
- Failure scenario: P2 stacks the name and number together inside the lens.
- Fix: in U11, write "mutant name in the lens at 0.6183R (E-S8); `M<n>` at 0.47R".

**Checks that hold:**
- **U11, K4, K6 (D4-1):** all three, plus E-S12, are conditional on the scale having a mutant note. That matches thread 09263155 (04:33, later than 04c07816's "Kurd card's numbers will move outside the rim too"). It also matches the live code: `pt(a, C.mut.length ? R+5 : orbit-r-.085*R)`. With no mutant, 0.47R holds.
- **K4 (D4-3):** all nine main names at orbit + depth/2 when the scale has any mutant note, and at the centre when it has none. This matches thread 0e928a74 and `pt(a,C.mut.length?orbit+depth/2:orbit)`. Main name 0.8083 checks out.
- **K8 (D4-2):** x0.62 for main names, numbers and ding matches `r*.80325*.62`, `r*.64*.62` and `dr*.70875*.62` (thread 377b20d7). Arithmetic at R 61.8:
  - main octave 3.86 pt
  - main number 4.66 pt
  - ding octave 3.585 pt at x0.62, 3.60 pt at x0.623
  - lens, f 0.565: name 5.46 pt, octave 3.60 pt
  - `M<n>`: 3.76 pt
  - E-S10: R = 74/1.1966 = 61.8
  - Lens f overrides the Chord Card's 0.42, which is legitimately recorded as O1 (floor not waived).
- **D4-4:** the s4 "Bottom field: …" echo line is in the mock markup. None of the 14 UX Mocks threads mentions it, so recording it as illustration is faithful.
- **D4-5 / U9:** the s5 label is exactly "Name" (`<label class="f">Name…`). Under it is "Suggested name; you can change it." Prefill under F4/O2 is faithful. Thread 43f4cec1 allows duplicate names.
- **Verbatim strings against the live mock, all exact:**
  - M1 "Neotone has 9 main tonefields. Inner notes F5 and G5 have no tonefield: remove them to save."
  - M2 "Neotone has 9 main tonefields. Remove 2 top notes (F5 and G5 have no tonefield)."
  - M2b "Neotone has 9 mutant tonefields. Eb6 has no mutant tonefield. F5 and G5 have no main tonefield. Remove them to save."
  - M3 "Mutant notes pair with tonefields: note N goes in tonefield N."
  - M4 "Tonefields 7 to 9 have no mutant note. That's fine."
  - M6 "F Low Pygmy 18 is a built-in. Its 6 bottom notes become mutant notes in tonefields 1-6. Saving creates a new scale; the built-in stays as it is."
  - M7 "Suggested name; you can change it."
  - M5 is an exact clause of the B2 designer note, with the first letter capitalised.
  - The s5 order (diagram, M6, Name, M7, M1) matches.
- **U2:** "Top Notes" and "Bottom Notes / Neotone Mutant Notes (optional)" match B1 and thread 5d2e62f1 ("Yes title case"). The D4 checkbox override of B1's "No Neotone switch here" and 5d2e62f1 is recorded.
- **U5:** tap-to-swap and drag within a ring only, per thread 43487e52.
- **U6:** no EDIT TONEFIELDS button and no counter in B2, per fd88cb59.
- **U16:** Cancel left, SAVE right.
- **U1:** vocabulary rows match threads b34ab3ae, 06a5ada3 and e2b215ae.
- **U10 / A12:** the mock note says an older app "already shows 'needs a newer app'".
- **K1, K2, K3 against the Chord Card code:** orbit .745, r .19, ding .2, n_in .085, decor ring .355, depth 2r/3. Bands 0.046R and 0.024R (dc04e825). Solid outlines and full lens band (ddbe1a06, cdb79d37).
- **K5:** root-colour frame with a black pan outline (2f095580).
- **K6:** Kurd 9 is Standard output with Standard angles and the decor ring still drawn, consistent with E-S11 (04c07816, bb934459).
- **K7:** both footers are illustrative under F4.
- **`M<n>`:** matches thread 8e392bb2.
- **QA Guide:** still Option A ("Paired areas", "Assigned n of n", 18 rows) and has no comment threads. It is rewritten in phase Q, as the plan says.

**Thread ids read (14 + 16):**
- UX Mocks (14): 43487e52, 43f4cec1, fd88cb59, 8026903e, 65d431a1, b34ab3ae, 06a5ada3, 9fa770b1, 76aa98db, 5d2e62f1 (full), e8ebe9f4, 62634f89 (full), 91832383 (full), e2b215ae.
- Chord Card (16): 0e928a74, 0f23fc62, 09263155, 04c07816, bb934459, 0d0cf487, dc04e825, b7a90806, 377b20d7, 8e392bb2 (full), ddbe1a06, 2f095580, 11f5d4d6, 648f6717, cdb79d37, dd0ce7c9.

**Checks run:**
- Live Artifact read of the UX Mocks (NHK2ZtAdrChie2rEMXWAGd), Chord Card (TgFMSuaPN4ZZbkp6y71cte) and QA Guide (Wa9kam3ALSsF274wYDG6n2).
- All 30 threads, paged by cursor, with the elided threads opened one by one.
- String-by-string compare of M1-M7, M5 and the U2/U9 labels against the mock source.
- Chord Card SVG code compared against U11, K1-K8, E-S1/E-S8/E-S12 and the Fixture rev 3 block.
- Point-size arithmetic for K8 and O1 at R 61.8.
- Plan read in full for: Decisions, Phases, E-S rows, Fixture rev 3, the UI/UX conformance table, Message list, OD1, AFK decisions, Round 4 disposition and the round-4 design log.

**Not run:**
- Rendering or pixel measurement of the artifacts.
- The served DEV app.
- Any test suite or git verification.
- Engineering rows (C0 table anchors, A2/A3 branch mechanics, A13) beyond the design figures.

### Round 6 eng review (narrow)

**Verdict: READY**

No findings.

**What I checked**
1. **E-S13.**
   - The old text it quotes matches dev 18.1 word for word: "Size is the label rule number size, 0.64 x `main.r`" in the Numbers bullet, and "The label rule and the 3.6 pt print floor are unchanged and apply to every glyph" in the last bullet.
   - The replacement sizes match K8 (plan line 199) term for term: main name 0.80325x0.62, number 0.64x0.62, ding 0.70875x0.623 on `ding.r` (consistent with D5-1's r_ding 0.2R), lens name 0.8232x0.565, `M<n>` 0.64x0.5, octave digit 0.66, floor 3.6 pt.
   - The print-extent change replaces "number size / 2" in dev with the unscaled 0.64·`main.r` term. I recomputed it: 1.0758 + 0.64·0.19/2 (0.0608) + 0.06 = 1.1966, and 74/1.1966 = 61.84, so R = 61.8. That matches E-S10 and K8's "At R 61.8".
2. **E-S ranges.** The only live citations are the Phases E2 row (line 78) and C0 row 9 (line 140), and both say E-S1..E-S13. Every other E-S range sits in the review logs or dispositions (lines 518, 535, 545, 661, 662). E-S1..E-S4 and E-S1..E-S12 appear only in those logs.
3. **Round-5 lows.**
   - E5-3: U7 (line 187) reads "M1-M8 incl. M2b".
   - E5-4: noted in K8 (0.002 pt ding margin, guarded by P2's every-glyph test).
   - D5-1: the K8 ding term reads "r_ding (0.2R)".
   - D5-2: the B2 and s4 order lines sit above the Message list (line 214) and match the fix text.
   - D5-3: U11 (line 191) puts the mutant name in the lens at 0.6183R (E-S8) and `M<n>` at 0.47R, "not stacked".

**Checks run:** `git show origin/dev:docs/ENGINE-SPEC.md` lines 1170-1202; greps of the plan for E-S13/E-S10/K8, E-S ranges, and the U7/U11/Message list/M2b rows and their round-5 log entries; hand recomputation of the extent and R. Nothing was edited.
