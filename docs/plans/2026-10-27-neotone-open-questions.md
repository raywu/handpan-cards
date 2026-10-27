# Neotone: open owner questions

2026-10-27, lane NT of afk-2026-10-27. Research only; no product decision is made here. Neotone is queued "blocked on owner model/slot answers; record the questions" (`~/.claude/projects/-Users-ray-Projects-handpan-cards/memory/queue-2026-10-27-afk.md`, "Research, plans only" bullet).

## What Neotone is

A "Mutant Neotone" layout choice in the Add/Edit Scale -> Layout flow: assign a scale to the primary and secondary playing areas of a digital handpan, one center field plus visually nine surrounding large/small pairs. The owner said secondary notes can mimic bottom notes; the plan refuses to turn that into an engine-zone equivalence without a decision. (`docs/prompts/2026-10-26-mutant-neotone-layout.md` "Goal and supplied reference", at `origin/codex/neotone-future-plan-20261026`; `docs/plans/2026-10-26-mutant-neotone-layout.md` on `origin/dev`.)

## Where the material lives

- Plan: `docs/plans/2026-10-26-mutant-neotone-layout.md` (on `origin/dev`; created in commit `e0acd302`, branch `origin/codex/neotone-future-plan-20261026`).
- Prompt v3: `docs/prompts/2026-10-26-mutant-neotone-layout.md` (same commit; the prompt is on the codex branch, not confirmed on dev).
- Ledger entry: `docs/WORKSTREAMS.md` "MUTANT-NEOTONE" (`e0acd302`); status lines in `docs/CLAUDE_RETURN_HANDOFF.md:36,104`, `docs/CLAUDE_TAKEOVER_PLAN.md:58,91,173`, `docs/DEVELOPMENT_CONTINUITY.md:16`, `docs/plans/2026-10-25-workstream-status.md:22` (all `origin/dev`).
- Reference image: local-only, never published (SHA256 `e997c67af983962882ebb3419d7265fb112ed5b20562b72f04da841e6b6ad19a`); backup path in `docs/handoff/2026-10-26-recovery-manifest.json:126-127` (`origin/dev`). Host-local paths, so they may not exist on this machine.
- Untracked docs in `/Users/ray/Projects/handpan-cards/docs`: no Neotone hits (grep empty). No `~/Projects/*kit*` Neotone hits found (the recursive grep for `*.md` returned nothing).

## Already decided / reviewed (with sources)

- Planning only; implementation paused; independent ENG and design review CLEAR after one revision round (plan header and "Prompt iteration and independent review closure").
- Recommended approach: one versioned physical-layout profile with an explicit slot-to-note-occurrence map inside the existing Add/Edit flow. Geometry-only preset and a separate instrument app are rejected (plan "Recommendation and feasibility").
- UI: read-only paired-area diagram plus a 44px assignment list as the authoritative editor (plan "UI wireframe").
- Secondary location is not automatically an acoustic-bottom zone (plan "Recommendation").
- Acoustic links stay byte-identical v6; only profile-bearing links use wire v7 (a recommendation pending engineering compatibility review) (plan "Data, geometry and compatibility contract").
- Mixed-version persistence is a launch blocker (same section). Duplicate-note feature stays paused and is not a dependency (same section; `WORKSTREAMS.md` MUTANT-NEOTONE).
- Status: hardware/roles/export decisions unresolved (`docs/CLAUDE_TAKEOVER_PLAN.md:91`).

## Open owner questions

Source for 1-4: plan "Product decisions and deferred owner interview". Q5-Q7 are gaps the plan lists as gates but does not number.

1. **Model and revision, slot count.** Which exact Neotone model/revision, and what is the current blank slot diagram and count (is 19 right; does the center hold another pitched area)? Older material says 11 tonefields; the current manual is 4.0, in progress (plan Evidence table).
   - A (recommended): the owner supplies the model/revision and a blank slot diagram; support only the pictured topology after confirmation.
   - B: support a generic "paired areas" profile and make no hardware-accuracy claim.
   - C: defer until the manual is finished.
2. **Secondary-note musical behavior.**
   - A (recommended): physical mapping of existing source notes with unchanged engine roles; secondary location alone earns no bottom-shell penalties or badges.
   - B: secondary behaves as bottom-like (bottom ordering, tie-breaks and badges apply); needs an explicit engine-policy decision first.
   - C: a new musical layer or voicing policy, specified separately.
3. **Center field.**
   - A (recommended): center maps to the existing Ding; optional surrounding slots may be empty; every entered note occurrence is assigned once.
   - B: center may be reassigned and used as an ordinary chord voice; needs an engine-policy decision (the Ding is excluded from generated voicings today).
   - C: add body/percussion areas; needs verified semantics, later scope.
4. **Print/PDF parity.**
   - A (recommended): browser and PDF parity before launch.
   - B: owner-approved explicit profile-only export restriction, with a visible warning.
   - Never export an acoustic-looking approximation silently.
5. **Wire and storage versioning (approval gate).** Approve v7 only for profile-bearing links (A, recommended), or a different scheme (B). Also approve the mixed-version isolation strategy (capability or namespace) as a launch gate; the plan says a record-version bump alone is not enough.
6. **Release base.** Rebase on the released DEV baseline (`3542d6ea`, A, recommended) or wait for the saved-variants contract (`2a260d21`, B). Same-scale/different-map coexistence depends on it (plan Evidence table and "Saved-instance identity").
7. **Execution grant.** After 1-6 are answered, an explicit grant to freeze the fixture and codec schema and start the T/E/U/P/M lanes (plan "Swarm execution"). Recommended: grant only after 1-4.

## Research that can proceed without answers

- Re-verify engine seams named in the plan (core, layout, voicing, share, importer, `index.html` pan) against current `origin/dev`.
- Audit current storage behavior for older clients (Add/Edit/delete/RESET/library rewrite) and the share-version selection (global `VERSION` affects every encode).
- Audit the print pipeline (`src/engine/pdfcards.js`, `tools/hifi.py`) for profile-aware anatomy.
- Draft the occurrence-identity and map-validation property tests as a spec, without a fixture.

Blocked until answers: the fixture (Q1), voicing/badge copy (Q2, Q3), export scope (Q4), codec schema (Q5).

## Search record

- `git log --all --oneline -i --grep=neotone` -> `e0acd302 Queue reviewed Mutant Neotone layout plan for future work`
- `git grep -il neotone origin/dev` -> the 10 files listed above.
- `grep -ril neotone .../memory` -> `queue-2026-10-27-afk.md` only.
- `grep -ril neotone /Users/ray/Projects/handpan-cards/docs` -> empty.
