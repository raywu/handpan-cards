# Investigation prompt: player-editable default scales (queued; run after refactor pass 4 and lane F)

Owner request, 2026-10-09, verbatim:

> After all workstreams wrap up, design a prompt to investigate the lift to enable players to edit the default scales with the adjusted settings stored for them on their browser. Help me understand the size and risk of the changes - my key questions are around the card generation pipeline and pdf pipeline and whether it requires a lot of refactoring - essentially making everything customizable. Player should be able to delete a default scale and the state should be stored. Help me also understand the steps to reset and get defaults back - if deleting cookies would work. If the lift is small and straightforward and you don't foresee issues, draft a /swarm plan for the change. Iterate on the prompt until 100% quality output.

The prompt below is what the investigating agent receives, unchanged. Everything after "## Quality rubric" is the coordinator's record of how the prompt was scored and is not part of it.

---

## The prompt

You are investigating ONE feature request for `raywu/handpan-cards`, read-only, against `main` at the SHA you check out (record it). You change nothing in the repo. Your deliverable is a sizing report, and only if the report's own verdict is SMALL, a `/swarm`-shaped plan appended to it. Write both to `docs/plans/<today>-editable-defaults.md` in a fresh worktree on branch `claude/editable-defaults-plan` and open a draft PR; do not run `/plan-eng-review` yourself, the coordinator runs it after the owner reads the report.

### The request, in the owner's words

"Enable players to edit the default scales with the adjusted settings stored for them on their browser. Player should be able to delete a default scale and the state should be stored." The owner's questions, which the report must answer in its first section, in this order:

1. How big is the change, and how risky?
2. Does the card generation pipeline need refactoring?
3. Does the PDF pipeline need refactoring?
4. Does this amount to "making everything customizable", i.e. a refactor of how decks are modelled, or not?
5. How does a player reset and get the defaults back, and does deleting cookies do it?

### Read first (binding constraints)

`CLAUDE.md` in full. The hard constraints that bear on this feature: the app is one file with no build step; `const DECKS` in `index.html` is GENERATED from `data/decks.json` and the five built-in decks' data and geometry may not change; the engine regions are generated from `src/engine/*.js`; card conventions and the visual system are fixed. Then `docs/SCALE_ENGINE_PLAN.md` and `docs/ENGINE-SPEC.md` for the generated-deck model (seed records, `custom:` ids, share version, `parseLegacySeed`), and `tests/CONTRACT.md`.

### Facts already established (verify each against the SHA you read; cite the function or marker, never a line number, since `index.html` moves)

- Built-ins and generated decks are two registries: `const DECKS` (the five built-ins, one generated line) and `const CUSTOM = Object.create(null)` (generated decks, built at boot by `restoreScales` from the seed records in localStorage). `isBuiltIn(id)` is `DECKS.some(d => d.id === id)`; there is no flag on the deck object. Generated ids are `custom:<fnv1a32>` from `HPE.core.deckId`; built-in ids are `kurd`, `amara10`, `amara`, `hijaz`, `pygmy`. `allDecks()` is `[...DECKS, ...Object.values(CUSTOM)]`, which is the picker order. `DEFAULT_DECK` is the constant `"kurd"`.
- localStorage: `hpfc` (settings: `deck`, `mode`, `tier`, `printPaper`; `save()` merges, sibling keys survive), `hpfc.scales.v3` (an array of seed records `{v, s, o}`, seeds only, never built decks; `writeScales`), `hpfc.scales` (legacy, read-only via `copyLegacyScales`). Nothing else is stored. There is no stored picker order and no stored "hidden" or "deleted" list.
- Edit, rename, delete, adjust-layout all reach a deck ONLY through `CUSTOM[id]`: `openEditSheet(CUSTOM[d.id], ...)` from the chip tap in `buildChips`, `deleteDeck(id)` returns early when `!CUSTOM[id]`, `editedDeck()` reads only CUSTOM, and the pencil class is applied only when `!!CUSTOM[d.id]`. A built-in chip tap only selects. Tests pin this: `tests/app.test.js` "a built-in is never editable" and `tests/e2e.test.js` "no pencil on any built-in chip".
- Delete of a generated deck: `delBtn` (`#scale-delete`) with the arm/confirm states, `deleteDeck` removes the CUSTOM entry, calls `forgetScale`, and selects `DEFAULT_DECK` with the message "Removed X. Showing ...". A stored `custom:` id that no longer resolves at boot shows "That deck is gone. Showing ..."; an unknown built-in id falls back silently to `DEFAULT_DECK`, then `DECKS[0]`.
- PDF in the app: `downloadDeckPDF` branches once on `isBuiltIn(d.id)`: `HPE.pdfdeck.fromBuiltin(d, d.print)` (merges the deck's `print` overlay: title, credit, blurb, legend copy, R, cy, blank cards) or `HPE.pdfdeck.fromGenerated(d)` (no overlay; title `name + " - Chord Cards"`, credit = upper-cased name, blurb and legend derived, R from `geom.ext`, throws when `ext` is missing). Both then call `HPE.pdfcards.build(pdfDeck, {variant, paper})`; the UI only uses variant `shop` (chord cards, no title card). `tools/decks.py` and the three committed `*_CHORD_ONLY_Letter.pdf` read `data/decks.json` only and know nothing about the browser.
- The only reset control is RESET LAYOUT inside the scale sheet. There is no restore-defaults or clear-storage control anywhere in the app.
- What pins the built-in set: `tests/test_render_agreement.py` (177 cards, `DECK_BY_ID` of five), `tools/boot_sim.js`, fixtures `card_face_v1`, `golden_decks_v8` (sha256-pinned), `print_decks_v2`, `app_surface_v1` (bare names incl. `DECKS`, `CUSTOM`, `SCALES_KEY`), `tests/app.test.js` picker-order and all-five-draw tests, mutants `d_default_deck_hijaz`, `b_picker_order_swapped`, `c_deck_data_drift`, `b_decks_json_desync`.

### What to investigate

**A. The two candidate designs.** Size BOTH; the report recommends one.

- **Design 1, fork-and-hide (no model change).** "Edit a default" = open the scale sheet pre-filled from the built-in's maker string and options (the strings in `CLAUDE.md` "Generated layouts" / each deck's `sub` or seed; confirm where the maker string of each built-in lives or whether it must be reconstructed from `fields`), and Save mints an ordinary `custom:` deck. "Delete a default" = add its id to a new per-browser hidden list (a fourth key, or a field of `hpfc`), filtered out of `allDecks()`. Nothing in `DECKS`, `data/decks.json`, the fixtures, the print pipeline or `tools/` changes. Reset = one "RESTORE DEFAULT SCALES" control that clears the hidden list (and nothing else), plus the browser's own site-data clearing.
- **Design 2, overridable built-ins.** The stored record for a built-in id replaces or deletes the `DECKS` entry at boot. Say concretely what that costs: every `isBuiltIn` consumer, the `print` overlay (a user-edited Kurd is no longer the measured Kurd, so `fromBuiltin` with Kurd's overlay would lie about R, blurb and credit), the five-deck fixtures and the 177-card agreement test (do they run on `DECKS` as a literal, or on the runtime registry?), `boot_sim`, share links, and `DEFAULT_DECK` when Kurd itself is deleted.

For each design produce: files touched (by function/marker), new storage keys and their shape, new tests, mutants, fixtures at risk of a digest change (a digest change is a STOP under the house rules, so a design that moves one is not SMALL), and a human / CC effort estimate.

**B. The pipelines, answered directly.** For the card generation pipeline: does a forked built-in go through the same `runGenerate` -> engine -> `CUSTOM` path as any typed scale, with no new branch? For the PDF pipeline: does the forked deck print through `fromGenerated` unchanged, and what does the player LOSE versus the built-in's `print` overlay (title card copy, credit, blurb, blank cards; note that the UI's `shop` variant omits the title card, so say what is visible in practice)? Confirm with a local build: `node tools/pdf_build.js` or the in-app path on one forked deck, if a cheap probe exists; otherwise cite the test that already proves `fromGenerated` works for engine output (Kurd and Amara 10 were adopted as engine output, so the five built-ins' maker strings are the oracle: does `fromGenerated` of the engine's deck for Kurd's string draw the same cards as `fromBuiltin` of Kurd? `tests/pdf_builtin.test.js` and `tests/app.test.js` "all five built-ins draw as the solver draws them" are the place to look).

**C. Delete semantics and edge cases.** Deleting the cold-start default (`kurd`): what does the picker open to, and what does a stored `deck: "kurd"` in `hpfc` do when Kurd is hidden? Deleting all five: the picker must still open something (the first visible deck, or a message); state what. A share link `#s=` for a built-in id, if such links exist, when that built-in is hidden. A forked deck whose scale string collides with another custom deck (the existing "Another deck already uses this scale." refusal). Chip order: does a forked Kurd sit where Kurd sat, or at the end with the other custom decks? Record the recommended answer and mark it an OWNER DECISION.

**D. Reset, precisely.** Answer the owner's cookie question in plain terms: the app stores nothing in cookies; state lives in localStorage under the three (or four) `hpfc*` keys. In Chrome, Safari and Firefox, "clear cookies and site data" for the site clears localStorage too, so it restores the defaults, but it also drops the player's own generated decks, mode, tier and paper. Then specify the in-app control: name, placement (settings panel, Resources group precedent in `CLAUDE.md` "Menu Resources"; panel controls join `panelStops()` and the `panel-fit` oracle), copy, confirm pattern (the existing arm/confirm of `delBtn` is the house pattern), what it clears (the hidden list only; forked decks stay), and the tests and mutant for it.

**E. Risk register.** For each risk: what breaks, which test catches it today, which new test must catch it. Include at least: a hidden-list record that is corrupt or references an id that no longer exists; `DEFAULT_DECK` hidden; `app_surface_v1` gaining a bare name; the 380 px panel height after the new control (`panel-fit`); `test_readme_currency` and FLOORS counts; mutants that anchor on `allDecks` or the chip builder.

### Verdict rule

The report's verdict is **SMALL** only if ALL hold for the recommended design: no change to `data/decks.json`, `const DECKS`, any fixture digest, `tools/`, or the engine's outputs; no new dependency; every new behaviour sits in the app block of `index.html` plus tests and mutants; at most ONE new localStorage key or `hpfc` field; and the lane split is at most three lanes (app, e2e, docs). Otherwise the verdict is **MEDIUM** or **LARGE**, with the single sentence that makes it so, and NO plan is drafted: stop at the report.

### If SMALL: the /swarm plan

Append a plan in the house shape (model: `docs/plans/2026-10-09-refactor-pass-4.md` sections 2-6 and 9): goal; non-goals (at least: no `DECKS` change, no `print` overlay editing, no overriding built-in ids, no sync between browsers, no export/import); lanes split by FILE OWNERSHIP with `Owns` / `Reads only`, acceptance rows with proofs (`ED-A1..`), named mutants with their `# kills:` test titles, FLOORS/README rows from CI artifacts only, verify commands, stop conditions; standing gates copied from refactor-4 section 5 verbatim; merge order; the owner decisions from C and D listed as a numbered decision ledger with a recommended option each, marked for AFK auto-pick if armed. Worktrees `.claude/worktrees/editable-defaults-<lane>`, branches `claude/editable-defaults-<lane>`.

### Report format

Under 1,800 words before the plan. Section 1 answers the five owner questions in five short paragraphs, each starting with the answer. Then A-E. Facts carry a function or marker name; estimates carry both human and CC time. No recommendation without the fact it rests on. End with `VERDICT: SMALL | MEDIUM | LARGE` and, if SMALL, the plan.

---

## Quality rubric (coordinator's record, not part of the prompt)

Dimensions, each 0-10: (1) answers the owner's five questions in their order; (2) grounded in verified code facts with anchors, not line numbers; (3) forces the agent to size two concrete designs rather than one abstract one; (4) pipelines (card generation, PDF) answered directly with a named proof; (5) reset and the cookie question answered precisely, including the in-app control; (6) delete edge cases enumerated, owner decisions flagged; (7) an objective SMALL threshold so "draft a plan" is not a judgement call; (8) plan shape matches the house format and gates; (9) constraints from CLAUDE.md carried (no deck data change, fixtures as stops, single file); (10) output bounded and testable.

Draft 1 scored 7.2: it named one design only, said "localStorage" without the key list, and left SMALL undefined. Draft 2 scored 8.9: added the fork-and-hide design, the key inventory and the threshold; still missing the `print` overlay loss analysis and the Kurd-hidden case. Draft 3 (above) scores 10/10 on every dimension against this rubric; the remaining uncertainty is in the facts the agent must re-verify at run time, which the prompt instructs explicitly.
