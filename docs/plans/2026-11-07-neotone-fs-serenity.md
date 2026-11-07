# Neotone page: add F# Serenity (Reo Matsumoto)

Status: plan only (2026-11-07), /reviewed-plan plan mode, spawned session (AFK: recommended option taken at every
decision, logged below). Refs TRI-67. Key: handpan-cards#neotone-fs-serenity. Base: main `26114742`.
One serial lane `claude/neotone-fs-serenity` (worktree from main). Small task: one file boundary (scale-page generator
data + its generated page + its tests).

## Goal (owner 2026-11-07, P1)

Add F# Serenity, a new 19-note Neotone Mutant scale by Reo Matsumoto, to `/scales/neotone/`, with its notes by
tonefield and a Practice link that opens the owner's exact hand-placed layout in the app.

## Evidence (verified 2026-11-07)

- Owner link (TRI-67 description, read as data):
  `/#s=7/uB2_uD3_uE3_(Fs3)_uGs3_A3_B3_Cs4_E4_Fs4_A4_B4_Cs5_E5_uFs5_uA5_uB5_uCs6_uE6/F%23+Serenity/pair-r57.r59.r61.r64.r66.r69.r71.r73.r76.b50.b56.b52.b47.b81.b78.b85.b83.b88/a1ceea`
- `HPE.share.decode` on main (engine via `tools/engine_loader.js`) returns `ok:true`, name "F# Serenity",
  palette 0, profile `{id:"paired", rev:2, map:[r57,r59,r61,r64,r66,r69,r71,r73,r76,b50,b56,b52,b47,b81,b78,b85,b83,b88]}`;
  `formatSeed` = `[B2] [D3] [E3] (F#3) [G#3] A3 B3 C#4 E4 F#4 A4 B4 C#5 E5 [F#5] [A5] [B5] [C#6] [E6]`.
  It decodes as rev 2 directly (no rev-1 fallback), so the link is complete and unambiguous. No owner question on layout.
- Per field (ding F#3):

  | | Ding | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
  |---|---|---|---|---|---|---|---|---|---|---|
  | Top | F#3 | A3 | B3 | C#4 | E4 | F#4 | A4 | B4 | C#5 | E5 |
  | Mutant | - | D3 | G#3 | E3 | B2 | A5 | F#5 | C#6 | B5 | E6 |

- Where Neotone scales live: the page's factory table comes from `tools/neotone_page.json` `defaults` (rendered by
  `defaults_html` in `tools/gen_scale_page.py`; F2 Astronaut 16 is a profile row there). `data/decks.json` holds the
  5 app card decks and contains no Neotone scale.
- Size: `scales/neotone/index.html` is 66,418 B; `NEO_SIZE_CAP` (`tests/test_scale_pages.py`) = 67,584 B, headroom
  1,166 B. A profile tbody today is ~871 B (Astronaut).

## Decisions

- **D1 where the data goes [AFK-recommended; owner may override].** Add a row to `tools/neotone_page.json`, not to
  `data/decks.json`. Why: the Neotone page reads only that file; a decks.json entry would add a sixth app card deck
  (new cards, `#about` counts, PDFs, data mutants), which the goal does not ask for. Consequence: the CLAUDE.md
  deck-data procedure (sync_decks, `#about` counts, regen_data_mutants) does not apply because decks.json is not
  touched. Rejected: decks.json deck (much larger, changes the app's scale list).
- **D2 placement on the page [AFK-recommended].** F# Serenity is not a factory DOME hotkey scale, and the intro says
  "ships with nine scales on the DOME hotkeys". So it goes as one extra `<tbody>` after the nine factory rows, same
  shape, with the hotkey line replaced by "by Reo Matsumoto". The factory sentence is unchanged. Rejected: a new
  `<section>` with its own heading (costs bytes against 1,166 B headroom); calling it DOME+10 (false).
  Implementation: the row carries `"credit": "by Reo Matsumoto"` and no `hotkey`; `defaults_html` prints `credit`
  where it prints `hotkey`, using `d.get("hotkey")` (today `d["hotkey"]` would KeyError).
  Accepted nit: the row sits under the "Neotone factory scales" heading; the credit line marks it (owner sees on DEV). Smallest generator change.
- **D3 row values.** `name`/`typed` "F# Serenity" (owner's name, no note-count suffix); `ding` "F#3"; `main` and
  `mutant` as the table above; `seed` = the formatSeed string above; `palette` = 0 (reviewer verified: palette 0 + this
  profile re-encodes to the owner's link byte for byte; palette 1 adds `palette-2`);
  `profile` = the decoded profile verbatim.
- **D4 i18n [rule check].** No i18n step: scales/ pages are English-only generated HTML with no `I18N` (as in
  2026-11-04-neotone-page-defaults-table.md A6). No app visible text changes. Visible text uses "scale", never "deck".
- **D5 mutation [brief requirement, strictest wins].** Full mutation run required in CI for this PR even though no
  FD/FE/FS path is touched. Lane adds one mutant in `tests/mutants/` swapping two Serenity mutant cells (killed by
  the new test), stripping `index` lines, `# suite:` with `.` wildcards, FLOORS/README count +1 from CI artifacts.
  `ci_scope.decide` already returns `full` for these paths (unmappable `scales/neotone/index.html`); the lane
  confirms the CI "Report the mutation mode" step shows mode=full at the head. Mutant prefix `sp_neotone_`.
- **D6 size cap [past decision 2026-11-04: do not raise the cap].** If the regenerated page exceeds `NEO_SIZE_CAP`,
  stop and report to the owner; do not raise the cap, do not trim other content.

## Non-goals

- No change to `data/decks.json`, other scales, other rows, layouts, geometry, engine (`src/engine/*`), `index.html`,
  i18n tables, Neotone orientation (parked), lens drawing.
- No new scale page or sitemap/llms entry for Serenity; no featured-example change (Astronaut stays).
- No editor files: editor code in `index.html`, `tests/editor_*`.

## Lane `claude/neotone-fs-serenity`

Owns: `tools/neotone_page.json`, `tools/gen_scale_page.py` (`defaults_html` only), `scales/neotone/index.html`
(generated), `tests/fixtures/neotone_page_v1.json` (generated), `tests/test_scale_pages.py` (NeotonePageTest only),
one new `tests/mutants/sp_neotone_*.patch`, the README.md mutant count; `tests/suite_health.py` FLOORS only if raised.

Steps (TDD):
1. Tests first in NeotonePageTest, red: (a) a tbody named "F# Serenity" after the nine factory tbodies with "by Rep
   Matsumoto" and no DOME line; (b) its Top/Mutant cells equal the evidence table; (c) its Practice href equals
   `/#s=` + the owner's link code byte for byte (if the encoder canonicalises differently, assert decode round-trip
   to the same seed and profile map; reviewer confirmed exact equality is expected); (d) the generated default's `ok` is true; (e) the
   factory sentence still says nine; (f) the existing nine rows unchanged (existing tests).
2. Add the row (D3) and the `credit` print (D2); regenerate with `python3 tools/gen_scale_page.py --neotone` and
   `--neotone --fixture`.
3. Mutant (D5). Print page bytes before/after into the PR.
4. PR M to main and PR D to dev from the same head (`Refs TRI-67`). D merges only on green full `validate` on M at
   the verified head, an independent reviewer PASS/PASS_WITH_NITS at that SHA, and not CONFLICTING; then served DEV
   check. M stays held for the owner.

Acceptance (observable):
- New tests pass; all existing `tests.test_scale_pages` pass; page <= `NEO_SIZE_CAP`.
- `git diff --stat main` lists only owned paths; `data/decks.json` and `index.html` unchanged.
- CI `validate` green at the verified head with full mutation.
- Served DEV `/scales/neotone/`: the Serenity row renders; its Practice link opens "F# Serenity" in the app with
  M numbers on all nine fields and field 1 = A3 / mutant D3.

Verify command:
`python3 -m unittest tests.test_scale_pages && python3 tools/gen_scale_page.py --neotone --check && python3 tools/validate.py && git diff --exit-code main -- data/decks.json index.html`

Verification split: automated (above + CI full validate at head); self (byte count, diff stat); independent
(fresh reviewer at head SHA, /review read-only); human (owner DEV QA before any main merge).

## Expected conflict points

- `tests/test_scale_pages.py` and `tools/gen_scale_page.py`: editor branches (`claude/scale-editor-u2f-2` and
  siblings) show diffs to these files against main. Resolve by keeping both sides; generated files
  (`scales/neotone/index.html`, the fixture) are regenerated, never hand-merged.
- Mutant FLOORS/README counts: concurrent lanes drift these; set from main's CI artifacts at merge time.
- `index.html` and `tests/editor_*`: not touched, so no conflict expected.

## Risks / recovery

- Size cap: headroom 1,166 B vs ~900-950 B tbody (strict assertLess); overflow -> stop (D6).
- Link re-encoding mismatch -> test (c) fallback, recorded.
- Recovery: single revert of the lane commit; on dev via `claude/dev-revert-neotone-fs-serenity`.

## Continuation point / stop

Next: integrator dispatches the lane from main. Stop for this plan: plan ready / not ready.

## Decision log (AFK, spawned)

- D1 page JSON not decks.json (recommended; reversible). Owner can override at check-in.
- D2 extra tbody with credit line (recommended; reversible).
- D5 full mutation forced (brief).

## Review log

### Round 1 (reviewer, 2026-11-07, main 26114742)

Verdict: READY (no blocker/high).
- D1 confirmed: `NODE_SRC` reads `data/decks.json` only for `r.deck` rows; defaults come from `tools/neotone_page.json` via `seedOf`. Not an owner question.
- D3 palette confirmed: `parseSeed(seed, {palette:0, name:"F# Serenity", profile})` + `share.encode` reproduces the owner link byte for byte; palette 1 adds `palette-2` and differs. Use `"palette": 0`; test (c) fallback is not needed.
- D5 (low): full mode is forced anyway — `ci_scope.decide` on the lane's paths returns `full` ("unmappable path scales/neotone/index.html"). There is no "rerun with full" mechanism; say "check the Report the mutation mode step shows mode=full" instead.
- Medium: the row sits under the h2/caption "Neotone factory scales", next to "These are the factory defaults". The credit line marks it, but the heading is not accurate for it. Accepted under D2 (bytes); log it as an owner-visible nit.
- Low: FLOORS (`tests/suite_health.py`) counts tests per file, not mutants, and it is a minimum. Raising the `test_scale_pages.py` row is optional; if the lane raises it, add `tests/suite_health.py` to Owns. The mutant count lives in README.md ("1809 mutant patches"), so add README.md to Owns. Use the `sp_neotone_*` prefix.
- Low: size is tight (`assertLess`, strict). Serenity has 9 mutant cells plus a longer link, so expect about 900-950 B against 1,166 B headroom. D6 covers it.
- Author dispositions (Round 1): M1 accepted as nit (D2); L2 fixed (D5); L3 fixed (Owns); L4 covered by D6; L5 fixed (D2); palette fixed to 0 (D3). Verdict READY; no open blocker/high.
