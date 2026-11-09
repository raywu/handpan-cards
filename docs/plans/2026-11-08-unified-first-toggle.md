# Unified anchor controls in the one-panel editor (Standard and Neotone)

Status: READY_WITH_NITS after fresh independent confirmation review, 2026-11-09; the remaining low wording nit is corrected below. Engineering and design findings are addressed; this is readiness of the plan, not execution or runtime validation. Refs TRI-59. This is panel lane PL-b (engine E, app read/render A1, controls A2) of `docs/plans/2026-11-08-editor-panel-simplify.md`, whose current approved body is READY_WITH_NITS, round 9. That panel plan governs panel scope and prerequisites; the current sections below govern PL-b. The explicitly archived decision/review logs preserve earlier proposals, not execution instructions. No implementation is authorized by this revision.

## Goal and settled owner decisions

Use the same TWO Layout buttons, "#1 centred" and "#1 / #2", on Standard and Neotone: keep ids `editor-anchor-one` and `editor-anchor-between`. PL-b enables both Neotone buttons that PL-a leaves disabled; it does not create `editor-anchor-toggle`. On a Neotone card with mutants, "#1 / #2" turns the paired placement (main fields, lenses and radial number placement) by half a tonefield step. It does not permute `profile.map` or renumber slots.

Owner decisions (2026-11-09): two buttons; no editor Mirror Top or Mirror Bottom on EITHER profile; no editor Rotate. PL-a owns those removals. App-wide MIRROR (layout sheet, engine options, saved/shared layouts) remains. Existing mirrored Standard and permuted Neotone scales and links must still open, draw, edit, save and share correctly; removal of the editor controls is not permission to strip their data. The owner accepted the loss of editor un-mirror controls with `ONE_PANEL` true. Do not re-ask settled decisions.

## Sequence and execution gates

The successor is NOT CREATED: `claude/editor-rc-successor` is absent locally/remotely in the integrator's verified snapshot. Panel P0 requires owner manual QA of editor RC #912 BEFORE its creation. P0 will build it from RC #912 plus held #977, #982, #985, #988, #992 and #994; #994 remains included because it also removes obsolete editor reason code. Owner answer (2026-11-09): keep #994 OPEN until the successor is reviewed and ready to supersede it. There is no close authorization; inclusion and eventual supersession do not authorize closure.

Order: panel P0 -> T0 -> PL-a (T0 green) -> P1 -> N1 -> I1 -> D1 -> PL-b E -> A1 -> A2. E branches from the verified COMPLETED PANEL D1 TIP on that successor, A1 from E, A2 from A1. Neither dev nor #994 alone is E's base. Preserve T0's default-state geometry/drag/drop oracles; turned-state fixtures are additions. Panel owner QA, the panel Q6 wording check before P1, completion of those lanes, this plan's fresh independent eng review and the existing design review constraints all remain prerequisites. This revision does not restart the prior review rounds or create a successor.

Owner-confirmed release gate (2026-11-09): PL-b is REQUIRED for the same editor successor release. No release without completed E + A1 + A2, and no release at an E-only or E+A1 intermediate head. This settles the earlier AFK recommendation; do not reopen it or treat panel D1 alone as a release cut. All main PRs stay held; no main merge, deploy or migration is authorized here.

## Non-goals and boundaries

- No deck data, verified layout, `tests/fixtures/paired_profile_v4.json` revision/geometry, radii/orbits or Standard geometry change.
- No editor Mirror/Rotate code, semantics, pairing tests or mutants: PL-a has removed their subjects. Do not reintroduce them. Preserve app-wide MIRROR and its current profile conflict rules.
- No new panel shell, naming, menu, caps, tray, drag mechanics or `ONE_PANEL` flag work. A1 threads effective angles through existing hit/snap consumers without redesigning interaction.
- Legacy sheet controls unchanged. No separate toggle release, decoder-only release or soak. No CLAUDE.md edits or new infrastructure.
- No saved-scale loss, handle-in-share change or incompatible rewrite of old storage/links. Wire v9 / record 7 are selective new formats described below; owner approval is required before their main release.
- Work only in isolated lane worktrees with file ownership below, TDD under `tests/CONTRACT.md`, independent review, exact-head CI and served DEV verification under `docs/testing/browser.md`.

## Source evidence and verified facts (symbols, not line numbers)

Read-only source anchors for this refresh: PR #994 head `462beef80af5246fcc7cce881fa273fa4392415e`, editor RC #912 head `293cda3e438ee9c46576a7b64c07d748dc4d5ad5`, and origin/dev `8d08667ac96376973e492081fa6a9dfbd5432e86`, inspected with `git show`. These are evidence snapshots, not a constructed successor or final-head CI evidence. RC #912 itself has `ONE_PANEL = false`; #994 has the load-bearing `const ONE_PANEL = true ;` line and removes `NEO_REASON` / `#editor-layout-note`. P0 must re-read facts at the future successor, then PL-b re-reads them at D1.

- Standard: `HPE.layout.rimAngles(count, anchor)`: "one" puts note 1 at 270 degrees; "between" puts the pair
  straddling bottom centre, note 1 on the right: `270 + s*(floor(i/2)+0.5)*step`, step = 360/count.
  `resolveAnchor` returns "between" or "one". `core.js` option whitelist accepts `anchor` "one"|"between".
  `editorSetAnchor(m, to)` returns `{ok:true,value:m}` unchanged when `m.options.profile` is set.
- Neotone: `HPE.core.readProfile` refuses `mirror === true`, `mirrorBottom`, `anchor`, `seats`, `angles`
  next to a profile with `PROFILE_CONFLICT` (ENGINE-SPEC 18.2/18.3). `HPE.layout.solve` with a profile
  calls the plain solve with `{}` options, then `placeProfile`: with a mutant note every field takes
  `PROFILE.angles[slot]` (fixture angles 270 230 310 190 350 150 30 110 70); with none, main entry k takes
  the k-th pitch-ranked Standard rim seat angle from the plain solve.
- Anchor "between" is therefore ALREADY expressible with no mutants if `solve` passes the anchor to the
  plain solve; it is NOT expressible with mutants (fixed fixture angles).
- Wire (dev, `src/engine/share.js`): `PROFILE_VERSION` 7, `INNER_VERSION` 8 (pinned cyclops angles, never with `pair-`), `INNER_RECORD_VERSION` 6 (ad5c2cbf, `docs/plans/2026-11-05-scale-editor-reinvent.md`); so 9 and 7 are the free numbers. `HPE.share.encode` writes version 7 iff `opts.profile` and then returns before `mirror`/`between`;
  `decodeReadable` + `OPTION_ORDER` already know `between` (order after `pair`), and v7 forbids it
  (`BAD_NOTE`, ENGINE-SPEC 18.5). `decodeSeed` clamps the read version to `newest` (7 when
  `PROFILE_ENABLED`, else 6; 8 only for an INNER link) and answers `version > VERSION` with `NEEDS_NEWER_APP`.
- Records: `recordVersion` returns 4, 5 (profile) or 6 (inner angles); app `readSavedRecord`/`savedCandidate` require `record.v ===
  PROFILE_RECORD_VERSION` iff profiled; `checkShareVersion` refuses a version above `newestRecordVersion()`
  and a refused record is kept opaque byte-for-byte ("opaque-record", protected). Rule I1 (profile records
  never carry `replaces`, never own a slot) is why an opaque profile record cannot trip slot authority.
- Renderers that assume the fixed angles (they key on `place[...][0]` equal to a `PROFILE_DRAW.angles`
  entry or index `PROFILE.angles[slot]`): `neoPlan` in `src/engine/pdfcards.js` (and its generated copy in
  `index.html`), `neo_figures`/the tones list in `tools/hifi.py`, `placeProfile` in `src/engine/layout.js`,
  and the app's editor/preview helpers `neoSlotPoint` and the empty-mutant-number code that reads
  `HPE.layout.PROFILE.angles[...]`. Radial extents (`profileExtent`, `profileRadius`, R = 61.8) depend on
  `number_out` and the ding, not on angle, so they are rotation-invariant.
- At #994 and origin/dev, `editorSetAnchor` is inert for profiles, the editor Mirror/Rotate transforms permute maps, and layout rendering hides the profile anchor buttons. These are historical source facts; PL-a replaces that row with the two disabled Neotone anchor buttons before this plan runs. #996 is already merged to dev; it is not an outstanding prerequisite.

- Buildgenerated profile branch (symbol `buildGenerated`, the block that does
  `delete built.value.options[name]` for mirror/mirrorBottom/anchor) strips anchor from a profile build.

## Key design question: how to express the half-step on a profile

### Option C (app layer only): IMPOSSIBLE, verified
Every fixture angle is 30 mod 40 (270, 230, 310, 190, 350, 150, 30, 110, 70 all give 30). A half step is
20 degrees, which puts angles at 10 mod 40. A permutation of the nine slots preserves the SET of angles, so
no `profile.map` permutation can ever produce a 20 degree offset. (Only the no-mutant case could reach it,
via seat angles, but `readProfile` forbids passing `anchor`, so the app cannot either.)
A view-only render offset (not stored) was also rejected: it would not survive save, share or print, so the
card would differ from its link and PDF.

### Option A: profile-level field (map rev 3, e.g. `turn`/`offset` key inside `options.profile`)
- Engine: `readProfile` key set `id,map,rev` becomes 4 keys for rev 3; `PROFILE_UNKNOWN` logic for rev;
  `migrateProfile` rev ladder; `pair-` wire token would need an extra token or segment; a new wire version
  (9) AND a new record version (7); `savedMeaning` carries the field.
- Old app + new link: wire clean (`NEEDS_NEWER_APP` via version 9). Old app + new record: opaque (v7).
- Cost: two parallel statements of the same intent (Standard `anchor` vs profile `turn`), so the toggle
  writes different options by pan type, and the editor/app need a pan-type switch to translate them. More
  surface, a second spelling in the share grammar, a rev bump in the map format every consumer validates.

### Option B (RECOMMENDED): lift PROFILE_CONFLICT for `anchor` only; `solve` rotates `geom.place`
- Engine: `options.anchor` ("one"|"between") may sit next to a profile. `solve` (profile branch) passes the
  anchor to the plain solve and, when mutants exist and anchor is "between", turns every fixture angle by
  half a tonefield step (180/9 = 20 degrees). New `geom.turn` (number, ABSENT when 0, so every existing
  profile solve output stays byte-identical). The map format, `pair-` token grammar, profile `rev` (2) and
  the fixture are unchanged. The two buttons write the same option (`anchor`) on both pan types.
- Wire: `between` next to `pair-` is the new thing, so it needs a new version, 9 (`PROFILE_ANCHOR_VERSION`).
  `encode` picks 9 iff profile AND anchor "between", otherwise 7 exactly as today (every existing link and
  its checksum bytes unchanged). A version 9 link is v7 grammar plus exactly one `between` segment.
- Record: `PROFILE_ANCHOR_RECORD_VERSION = 7`, used iff profile AND anchor "between"; profile records
  without it stay 5 byte-for-byte.
- Reuses existing strings, ids and the existing `between` token, and gives the no-mutant case the same
  behaviour Standard has (seats straddle bottom centre), so it is the smaller change.

### Comparison
| | A: profile `turn` | B: anchor beside profile (rec.) | C: app only |
|---|---|---|---|
| Possible | yes | yes | NO (angles 30 mod 40) |
| `readProfile` | new key, rev 3 | drop `anchor` from conflict list | n/a |
| Wire | v9 + new token | v9 + existing `between` token | n/a |
| Record | v7 | v7 (only profile + between; 6 = inner angles, unchanged) | n/a |
| Map format touched | yes (rev) | no | n/a |
| Engine corpus | regen (profile outputs) | additions only (`turn` absent when 0) | n/a |
| Two spellings of one intent | yes | no | n/a |

## Decisions (D = decision, source in brackets)
- D1 Option B. [verified facts above; smallest approach]
- D2 Version bumps, both FLAGGED and owner-gated for a main release: wire 7 -> 9 and record 5 -> 7, each
  emitted ONLY for a profile with anchor "between". Nothing else changes version. [back-compat matrix]
- D3 Turn size: 20 degrees (half of 360/9) when the card has a mutant note; with no mutant note the seats
  follow the plain solve, i.e. half of 360/k for k rim notes, exactly as Standard "between" does with k notes.
  Slot numbers are not renumbered; their placement and the lens follow the turned radial line. A card that gains or loses its first mutant note changes turn size (20 versus
  180/k) just as it already switches between Neotone and Standard geometry; accepted, documented.
- D4 (owner, replaces single-toggle proposal): retain TWO buttons `editor-anchor-one` / `editor-anchor-between`, existing `sheet.anchor_one` / `sheet.anchor_between` labels and split-state accessible name `sheet.anchor_between.aria`. The selected button has `.on` and `aria-pressed="true"`; the other is false. Names remain stable. Each button uses `editorLayoutTap` / `editorDo`, with existing `sheet.anchor_one_on` / `sheet.anchor_between_on` announced by `editor-status` (`role="status"`, polite, atomic). Selecting the current anchor is a no-op, adds no history and does not dirty the scale. No changing-label toggle or label-choice owner question remains. A2 removes PL-a's `editor.neo.anchor_pending` key in all 8 tables, title/aria suffix, disabled-only branch, and its `addedKeys` entry in `tests/app.test.js`; it takes P1's Neotone-anchor test hunks. Both buttons are checked at 320/375/380 px, both fonts, all 8 languages; selected/unselected distinction meets the existing contrast assertion.

- D5 (revised, F7) Both anchor buttons are disabled iff the solve with anchor "one" equals the solve with anchor
  "between" (deep-equal `geom` and `fields`, incl. `place` and `turn`), computed by the editor from
  `HPE.layout.solve`, not from a rim-count rule: that is true for an empty scale, and for a scale with no
  rim note and no mutant lens. It is NOT disabled by "no rim note" alone, because on Neotone the turn also
  moves the mutant lenses (D3). Inner notes do not disable it (`isCentred` only affects the ding position;
  `rimAngles` still reads the anchor). Tests: disabled for empty and for bottom-only/ding-only Standard
  scales, enabled for any scale with a rim note and for a Neotone card with a mutant note.
- D6 (owner Q10): editor Mirror controls are absent before PL-b. No effective-angle mirror-pairing work is needed. Engine `mirror`/`mirrorBottom` profile refusals and app-wide MIRROR remain unchanged; preserve existing mirrored/permuted data through A1/A2.
- D7 (owner Q9): editor Rotate is absent before PL-b. The anchor never changes `profile.map`; old rotated/permuted maps remain supported without a Rotate UI.
- D8 Undo/redo: changing anchor is one `editorDo` history entry; same-state selection adds none. Cancel restores the whole session; selecting between then one is not dirty relative to the original centred model. No Mirror/Rotate handler dependencies.
- D9 Layout row: exactly the two anchor buttons, identical ids/order/labels on both profiles. No editor Mirror or Rotate element, even hidden. P1 owns re-parenting; A2 only enables the Neotone actions and updates pressed/disabled states.

- D10 The anchor survives a pan-type switch both ways (`editorPanType`): it is one intent. `buildGenerated`
  stops stripping `anchor` for a profile and passes it into `solve`. The legacy sheet keeps stripping
  (out of scope; its `#scale-standard` hides on Neotone).
- D11 `PROFILE_CONFLICT` sentence loses "anchor": "Neotone sets its own placement, so mirror, seats and angles
  cannot be combined with it." Touches `HPE.core.REASONS`, ENGINE-SPEC 18.3, `reason.PROFILE_CONFLICT` in all
  8 `data/i18n/*.json`, `tests/scale.test.js`, `tests/core.test.js`, `tests/app.test.js` key pin. [correctness]
- D13 (F2) The engine canonicalises `anchor:"one"` to absent for a profile (in `parseSeed` option handling, so
  `formatSeed`/`encode`/`recordVersion`/`savedMeaning` all see the same seed), and `editorSetAnchor(m,"one")` on
  a profile DELETES `options.anchor`. Result: v5 records and v7 links never carry `anchor`; only "between"
  makes them version 9 / record 7. Dirty-check "toggle there and back" then returns to the exact prior options.
- D14 (F1) Versions are wire 9 and record 7 (wire 8 / record 6 are the cyclops inner-angles formats on dev).
  The `decodeReadable` gate `profiled = text.charAt(0) === "7"` becomes a set {"7","9"} with v9 requiring
  exactly one `pair-` AND exactly one `between`, v7 forbidding `between`, v8 still refusing `pair-`; the
  `newest` clamp in `decodeSeed` and `newestRecordVersion()` learn 9 and 7 (profile) while keeping the 8/6
  inner rules. Ordering: `OPTION_ORDER` unchanged (`between` after `pair`).
- D18 (R2-9) `parseSeed` order: `readProfile` ACCEPTS `anchor` ("one" or "between"; anything else is
  `BAD_NOTE` as for Standard (`readOptions` uses `badNote(options.anchor)`; no new error code)) and still refuses `mirror`/`mirrorBottom`/`seats`/`angles`; only THEN does option
  normalisation drop "one" (D13). "one" is never rejected on the way in. Test: profile + `anchor:"one"` parses
  ok and `formatSeed` equals the no-anchor seed.
- D19 (R2-6) `decodeReadable` branch order for v9: the `between` branch must come BEFORE the
  `else if (profiled) return badNote(text)` fall-through, with `profiled` true for {7,9}; the `between` branch
  accepts the new PROFILE case only on v9 after `pair-`, rejects profile v7 `between`, and preserves existing non-profile `between` decoding (including wire v8). Wire v8 plus `pair-` still returns its existing `PROFILE_CONFLICT`.
- D20 `#editor-layout-note` and `NEO_REASON` are absent through held #994 and remain absent. Do not re-add them or describe anchor buttons with the old profile-conflict note. A2 removes only the temporary `editor.neo.anchor_pending` reason added by PL-a.

- D21 (R2-8) The editor status line (`editor-status`, `role="status" aria-live="polite" aria-atomic="true"`) is a
  live region and announces the anchor result. The split-state `aria-label` begins with the visible text
  ("#1 / #2 ..."), so label-in-name holds. The archived Q3 single-toggle label choice is superseded by the owner's two-button decision.
- D15 (F9) SUPERSEDED by the R3 regroup: one release, no decoder-first release (see Release sequencing).
- D16 (F5, R3-3) The one release is gated on the record-7 move test and the frozen-client cases.
- D17 (F4) New frozen main-with-profile client fixture, pinned.
- D12 A non-mutant "between" Neotone card uses Standard seat angles already carried in `place`; verify all A4 empty-slot, preview and hit consumers as well as the filled-field renderers. Do not assume a zero `geom.turn` makes an empty-slot consumer correct.

## Assumptions
- A1 (verified) No permutation reaches a 20 degree offset (angles 30 mod 40).
- A2 (revised, F4) Two kinds of frozen reader are needed. Existing `tests/fixtures/shipped_client_ee5438d0.html.txt`
  (and the `c6ef6b58` one) are v6-only clients and prove only the v6-era refusals. NEW frozen fixture
  `tests/fixtures/main_profile_client_3668f95d.html.txt` = verbatim `git show 3668f95d:index.html` (main with
  profile support, wire 7 max, record 5 max), sha256-pinned in `tests/test_fixture_integrity.py`. Isolation
  tests run both against a v9 link (expect `NEEDS_NEWER_APP`, not BAD_NOTE, no throw) and a record 7 (kept
  opaque byte-for-byte). A dev-era client (wire 8, record 6) is also in the matrix by using the dev
  `share.js` loaded as the "older" decoder (a v9 link must be NEEDS_NEWER_APP there too).
- A3 (revised) A record version above `newestRecordVersion()` is kept opaque (`readSavedRecord` ->
  "opaque-record") and never trips slot authority for a profile record (Rule I1). Gated by the A2 tests.
- A4 (revised, F3) EVERY fixed-angle site, enumerated by reading (not one grep): in `src/engine/layout.js`
  `placeProfile` (both branches), `snapProfile` / `snapTarget` (`nearestSeat(PROFILE.angles...)`: the drag
  hit-test needs the actual slot-aware placements, not only `geom.turn`); in
  `src/engine/pdfcards.js` `neoPlan` (`pd.angles` loop keyed `main[ang]`/`mut[ang]`) and the generated
  copy; in `tools/hifi.py` the `tones` list (`pd["angles"]` keyed by `main.get(a)`); in `index.html` app JS
  `neoSlotPoint(slot, placed)` including its `placed === null` callers (`editorNeoMarks` empty-field marks,
  `neotoneOverlay` hit targets, the keyboard/rover spot `neoSlotPoint(target.slot, null)`), the
  empty-mutant number placement in `neotoneOverlay` (`HPE.layout.PROFILE.angles[slot % NEO_MAIN]`), and the
  editor preview ring. Mutant layouts can use `HPE.layout.profileAngles(turn)` (and its Python twin) for
  the uniformly turned fixture slots. NO-MUTANT layouts use Standard anchor seats and have `geom.turn`
  absent: every filled-slot renderer/hit/snap consumer must use effective `geom.place` with the slot-to-field
  identity (or an equivalent slot-aware placement map). `profileAngles(geom.turn || 0)` cannot represent
  those seats. E owns the `snapProfile` / `snapTarget` effective-placement interface; A1 threads the solved
  placement and slot identity through callers, including the null-placement/empty-slot paths. Empty marks
  and targets retain existing legal slot semantics and must agree with drawn fields in both layout branches.
  P1/P3 test every consumer with mutant and no-mutant cases; no filled-field snap may fall back to bare
  fixture angles merely because `geom.turn` is absent.
- A5 (gated) `savedMeaning` already includes `anchor` for standard records; P3 confirms a profile record's
  meaning includes it when set, so identity does not conflate "one" and "between" Neotone cards.
- A6 (re-verify at D1) PL-a has removed editor Mirror/Rotate helpers and their tests/mutants while keeping `editorNeoBuild`, anchor handlers and old-data compatibility fixtures. Do not resurrect removed symbols or patches from #994.

## Why this is the smallest approach
One option (`anchor`) already exists and already round-trips on Standard; the wire already has the token and
its ordering; only the profile branch of `solve`, one conflict check, one version number each for wire and
record, and the renderers' angle list change. Option A adds a map-format revision and a second spelling.
Option C cannot work. The existing two-button UI remains; only its Neotone action and temporary unavailable reason change.

## Lanes (file ownership) and waves

Base and release topology: after the sequence/gates above, record the verified D1 SHA and dispatch E there. All lanes are serial because they share `index.html` and depend on the prior wave. PR M = the dedicated `claude/*` lane branch into main, held, with the editor successor stack clearly identified; its exact-head `validate` is the CI vehicle. PR D = integrator-owned `claude/dev-merge-<lane>` into dev, merging the lane head while preserving dev-only work. Resolve dev-side README/app-test/mutant conflicts per panel P0, regenerate generated regions rather than hand-merge them, then validate the actual integration candidate and served revision. No dev-to-main release PR.

### Lane E: engine (wave 1, serial; owns)
`src/engine/core.js` (readProfile conflict list, REASONS sentence), `src/engine/layout.js` (solve profile
branch, new `profileAngles(turn)` helper, `geom.turn`, `PROFILE` untouched), `src/engine/share.js`
(`PROFILE_ANCHOR_VERSION`, encode/decode, `recordVersion`, `PROFILE_ANCHOR_RECORD_VERSION`),
`src/engine/pdfcards.js` (`neoPlan` reads `geom.turn`), `tools/hifi.py` (same), generated regions in
`index.html` ONLY via `python3 tools/inline_engine.py`, `docs/ENGINE-SPEC.md` (sections 18.2, 18.3, 18.4,
18.5, 18.6, 18.7), `docs/CARD-SPEC.md` (print note), `tests/core.test.js`, `tests/layout.test.js`, `tests/storage_corpus.test.js` (the frozen-client record 7 opaque test only, R6-2), the `i18n_swap_two_keys`, `b_*` and `i18n_region_inside_wrapper` mutant patches (hand re-pin, R6-2),
`tests/share.test.js`, `tests/pdfcards.test.js`, `tests/link_corpus.test.js`, `tests/scale.test.js`, `tests/test_pdf_parity.py` (turned-profile hifi/pdfcards parity and its fixture only),
`tools/regen_engine_corpus.js` (bounded optional-options support and profile-input reading),
`tests/fixtures/synthetic_profile_anchors_v9.json` (new corpus-only synthetic input, schema/cases below),
`tests/fixtures/engine_corpus_v1.json` (regenerated by that existing generator, same commit), new fixture
`tests/fixtures/paired_anchor_links_v9.json` (hand-written links, sha256-pinned in
`tests/test_fixture_integrity.py`), `tests/mutants/*` for the new behaviours, `data/i18n/*.json` only the
`reason.PROFILE_CONFLICT` row (+ `tools/sync_i18n.py`), NO editor-test hunk: `NEO_REASON` must already be absent at D1 (if present, stop for base reconciliation); plus `src/engine/layout.js` `snapProfile`/
`snapTarget`, `tests/app.test.js` (the neotone key pins and share/record rows that name PROFILE_CONFLICT or
record versions), the new frozen client fixture and
its pin, and the mutant refresh: run `python3 tools/refresh_mutants.py` (the `const I18N` line is context in
many mutant patches, so editing the generated I18N block shifts them) and apply `--check` on all.
The SEVEN non-English `reason.PROFILE_CONFLICT` sentences are AUTHORED by the lane (naturalness
rules of the i18n tables: plain wording, "scale" not "deck", Neotone untranslated) from the English sentence
"Neotone sets its own placement, so mirror, seats and angles cannot be combined with it."; `tests/scale.test.js`
pins the English row only, and the fit check covers the rest.
Not owned: app-layer `index.html` outside generated regions, or editor tests. E leaves both Neotone anchor buttons disabled exactly as at panel D1 and leaves `editorSetAnchor` inert on a profile. Existing panel/editor tests stay green unedited; A2 owns their Neotone-anchor updates. Re-check the actual D1 test names rather than resurrect the pre-PL-a "none of three" assertion.

### Lane A1: app read and render path (wave 2, based on E's head, after E; NO anchor-action enablement; owns) (R2-1)
`index.html` outside generated regions: `editorCommitOptions` (R5-2: keep `anchor` for a profile model; today it returns only palette/name/profile so SAVE writes record 5 and drops the turn; test: v9 link -> Edit -> change a note -> SAVE stays record 7 and turned), `buildGenerated` profile branch (keep `anchor`, pass it into `solve`),
`readSavedRecord` / `savedCandidate` / `newestRecordVersion` / `recordVersionFor` (accept record 7 iff profile
+ anchor "between"; dev today: `newestRecordVersion` = max(profile 5, inner 6), `recordVersionFor(o, profiled)`
= profile 5, inner 6, else standard; record 6 stays inner), `neoSlotPoint` (all callers incl. `placed ===
null`: `editorNeoMarks`, `editorNeoPoint`, `neotoneOverlay`, rover/keyboard spot), the empty-mutant number
placement, and the `snapTarget` caller for drag (pass effective slot-aware placement as well as turn; no-mutant `geom.turn` is absent); `tests/persist.test.js` (record 7 hunks: read, identity, save-from-v9-link; the shipped-reader opaque test is Lane E's, R6-2; A2 has none, R3-6), the move code (`moveImport`/`moveUrl`) and (R4-4) the record 7 move test `TRI59d move carries a record 7 row`, placed in `tests/persist.test.js`, NOT in `tests/editor_model.test.js` (A2's file, where dev's SE-R4-1 move tests live); dev already
carries unreadable object rows opaque; A1 owns any equivalent missing successor implementation and that test,
the app-JS rows of `tests/app.test.js`, render tests (P3 A1), and its own mutants.
Test that gates A1's merge (R2-1, not a release): a v9 link and a record 7 fixture decoded and rendered on A1's tree (PR M CI)
(E + A1, Neotone actions still disabled) draw TURNED: lens/main centres at fixture angle + 20, drag snap targets and empty-field
marks too, not stripped to the unturned card; and `buildGenerated` of a profile seed with `anchor:"between"`
keeps the anchor.

### Lane A2: two anchor actions (wave 3, based on A1's verified head)

Owns app `index.html` outside generated regions: `editorRenderLayout`, the existing `editorRender` status choice (anchor-result announcement while a note remains held), existing two-button markup/handlers, `editorSetAnchor` (profile "one" deletes the option, D13), and `editorPanType` anchor carry (D10). Owns `tests/editor_model.test.js`, `tests/editor_shell.test.js`, `tests/editor_e2e.test.js`, including the Neotone-anchor hunks written by panel P1; `data/i18n/*.json` ONLY removal of `editor.neo.anchor_pending`, generated I18N sync, and corresponding `tests/app.test.js` `addedKeys`/count arithmetic. Owns CARD-SPEC anchor-control behaviour, its mutants and fit/contrast evidence. No `editorNeoMirror`, `editorNeoPermute`, Rotate handlers, mirror-pairing tests, single-toggle id, or retirement of the two anchor ids.

Shared ownership is SERIAL and hunk-specific: E owns `tests/app.test.js` PROFILE_CONFLICT and wire/record pins; A1 its read/persist rows; A2 the temporary-key and anchor-control rows. `tests/persist.test.js` belongs to A1 only. Each lane owns its changes to `tests/suite_health.py` FLOORS and README mutant counts (from its own exact-head PR M CI artifacts), plus patches affected by its edited source lines. New patches use `tri59d_e_*`, `tri59d_a1_*`, `tri59d_a2_*`. Every lane apply-checks ALL patches; regenerate/re-pin stale contexts with `tools/refresh_mutants.py`, explicitly including `b_*`, `i18n_swap_two_keys` and `i18n_region_inside_wrapper` after generated I18N edits. Re-anchor the surviving `u2e2_anchor_same_adds_step` and post-PL-a two-anchor-row mutant when necessary; never revive retired mirror/rotate mutants.

E, then A1, then A2, each isolated worktree from the prior verified head. Regenerate engine copies with `python3 tools/inline_engine.py`; take either side of a generated-region conflict and regenerate. No parallel editors in the same worktree.

## Phases

### P0 PL-b prerequisite check (integrator; no implementation now)

Confirm panel P0 owner RC QA and recorded successor SHA, inclusion of held #994, completed T0 -> PL-a -> P1 -> N1 -> I1 -> D1, addressed independent reviews and exact-head CI. Record D1 as E's exact base. Check actual source at that SHA: two disabled Neotone anchor buttons with `editor.neo.anchor_pending`; no editor Mirror/Rotate, `NEO_REASON` or `#editor-layout-note`; unchanged load-bearing `ONE_PANEL` line; retained app-wide MIRROR and old-data fixture proofs. Re-enumerate all effective-angle consumers, tests, surviving mutants and source facts below at D1. Inspect `moveImport` / `moveUrl` on the SUCCESSOR stack: dev's opaque carry is not evidence it exists there; A1 owns any missing opaque-carry path. Read `tests/CONTRACT.md` and browser runbook before test changes. Fresh independent `/plan-eng-review` must pass before dispatch; design review covers affected button/disabled/focus/fit states. No need for an implementation or browser run to complete this plan-only refresh.

Owner-settled: PL-b is REQUIRED; #994 stays OPEN until the successor is reviewed/ready to supersede it, with no close authorization. Remaining gates: format-version/main release approval, actual editor RC manual QA and later served DEV phone QA. No permission is inferred from AFK or from an older review disposition.

### P1 Lane E tests first (engine contract, back-compat matrix)
Write failing tests, then implement. Acceptance observable:
- `HPE.layout.solve` with profile + `anchor:"between"` + mutants: every `place` angle equals the fixture
  angle + 20 mod 360 and `geom.turn === 20`; with `"one"` or no anchor `geom.turn` is absent and the output is
  deepEqual to the pre-change output for all 18-slot corpus cases.
- No mutants, k = 1..9 rim notes (plus empty/equal-solve cases): `place` angles equal the Standard "between" seat angles of the plain solve
  with the same fields and anchor; `geom.turn` absent.
- No-mutant snap contract: for k = 1..9, each drawn main field's effective centre snaps to its own profile
  slot under both anchors, with slot identity preserved through E's interface and A1's caller. Explicit
  9-rim between regression: placements [290,250,330,210,10,170,50,130,90] degrees; the second drawn note
  at 250 degrees snaps to slot 1 (zero-based), never fixed-fixture slot 0. Include occupied/empty-target
  and keyboard/rover consistency where those existing consumers use the same placement.
- Print extent identical for turn 0 and turn 20 (`HPE.pdfcards.profileExtent`, `profileRadius` = 61.8);
  `tools/hifi.py` and `HPE.pdfcards` produce identical tones for a turned card (the existing hifi/pdfcards
  parity test extended).
- Back-compat MATRIX (assert each row):
  | input | result |
  |---|---|
  | every existing v1..v8 link in `tests/link_corpus.test.js` and the frozen v7 profile links | decode unchanged, same seeds |
  | new app, v9 link (pair- + between) | decodes; `options.anchor === "between"`, profile intact |
  | new app, v9 link without `between` or with `mirror*`/`seats-`/`at-`/`ai-` | `BAD_NOTE` |
  | new app, v7 link carrying `between` | `BAD_NOTE` (unchanged) |
  | new app, v6 link carrying `pair-` | `BAD_NOTE` (unchanged) |
  | new app encode, profile without anchor / with "one" | byte-identical v7 (golden strings) |
  | new app encode, profile + between | v9, round-trips, checksum covers `between` |
  | shipped client (`shipped_client_ee5438d0.html.txt`) given v9 link | `NEEDS_NEWER_APP`, not BAD_NOTE, no throw |
  | main-with-profile client (`main_profile_client_3668f95d.html.txt`, R4-6) given v9 link | `NEEDS_NEWER_APP`, no throw |
  | main-with-profile client given v7 record | opaque, byte-for-byte kept, library not protected-locked |
  | app with `PROFILE_ENABLED` false given v9 | `NEEDS_NEWER_APP` |
  | `recordVersion` | 4 std; 5 profile; 6 inner angles (unchanged); 7 profile + between |
  | profile with explicit `anchor:"one"` (hand-made seed, editor, or carried by D10) | engine CANONICALISES: `parseSeed`/`formatSeed`/`recordVersion` treat "one" as absent for a profile; the record is v5 with NO `o.anchor`, the link is v7 byte-identical to today (F2) |
  | v5 record carrying `o.anchor` (hand-made, never written) | R3-5 canonical rule: record identity is `record.v === recordVersionFor(canonical seed)`; a v5 record with `o.anchor:"between"` has canonical version 7, so it FAILS identity and is not ok (opaque, kept byte-for-byte, never rewritten); with `o.anchor:"one"` canonicalisation removes it, version 5 holds, and it reads ok. No normalise-then-rewrite path exists. Asserted in A1's persist hunk |
  | v7 record, shipped client | opaque, byte-for-byte kept, library not protected-locked (Rule I1) |
  | v7 record with `replaces` | opaque (Rule I1 extends) |
- `share.decodeReadable` (R2-6): a v9 link with `pair-` and `between` DECODES to profile + `anchor:"between"`; v9 without
  `between` or with `mirror*`/`seats-`/`at-`/`ai-` is `BAD_NOTE`; v7 with `between` is `BAD_NOTE`.
- `core.parseSeed` (R2-9): profile + `anchor:"one"` is accepted then canonicalised away; profile + `anchor`
  accepted; profile + `mirror:true`/`mirrorBottom`/`seats`/`angles`
  still `PROFILE_CONFLICT` with the amended sentence.
Verify: `node --test tests/core.test.js tests/layout.test.js tests/share.test.js tests/pdfcards.test.js
tests/link_corpus.test.js tests/scale.test.js tests/storage_corpus.test.js`, `python3 -m unittest tests.test_fixture_integrity tests.test_pdf_parity`. Select existing browser PDF tests under the runbook for final aggregate verification; no new browser harness.

### P2 Lane E implement, then specs and mutants
Implement in `src/engine`, `python3 tools/inline_engine.py`, `node tools/regen_engine_corpus.js` (diff must
be additions only; any changed existing row is a bug). E extends the EXISTING generator's
`record(string, reader)` to accept optional seed options and pass them to the selected parser; include
those options only in new option-bearing corpus rows, so every old row stays byte-identical. Add the
bounded input `tests/fixtures/synthetic_profile_anchors_v9.json`: rows carry `name`, current-reader
`string`, and literal `options` (`profile` map/rev plus absent/one/between anchor). Cases cover mutant
centred/between, no-mutant k = 1..9 centred/between, and explicit-one canonicalisation. The generator
reads those rows into additive `corpus.profileAnchors`, recording input options plus parse/layout/build
outputs through the SAME engine pipeline; retain existing `corpus.synthetic`, malformed rows and
`notFromParseSeed` exactly. Do not append profile rows to shared `synthetic_scales.json`: unrelated
string-only consumers and their fixed counts remain unchanged. E's existing core/layout tests assert
profile cases/options are actually read, between differs as specified, and old rows remain unchanged;
add a killing mutant that drops the options/profile input. Regenerate and run
`node tools/regen_engine_corpus.js --check` in the same engine commit under CLAUDE.md's generated-output
rule. Then amend ENGINE-SPEC (text below), refresh/regen mutants
(`python3 tools/regen_data_mutants.py` is NOT needed: no deck data). New mutants: turn dropped, turn 10 or 40
instead of 20, `between` allowed in v7, v9 chosen without `between`, record 7 chosen without profile, anchor
ignored in the no-mutant plain solve, hifi turn ignored, pdfcards turn ignored. Isolation tests against the
shipped client for the v9 link and v7 record (Assumptions A2/A3).
Verify: `python3 tools/validate.py` (checks 1, 4, 6), `python3 tools/inline_engine.py --check` if present,
full mutation suite on the lane PR (engine change), CI `validate` at the exact head.
Deliverable: PR M = `claude/<lane>` into main, held, stacked on the previous verified lane head (E: completed panel D1); PR D = `claude/dev-merge-<lane>` into dev. `validate` on M at the exact head is the CI evidence. No dev-to-main PR exists. Owner-gated: nothing merges to main.

### P3 Lane A1 then A2 tests first (app)

A1: test the read/render gate in its lane acceptance; v9 link -> edit a note -> SAVE retains record 7 / anchor and share v9; canonical record identity and `savedMeaning` distinguish centred/between; malformed v5 + between remains opaque unchanged; record 7 `replaces` refusal remains. Add `TRI59d move carries a record 7 row` in `tests/persist.test.js`, proving `moveImport`/`moveUrl` preserve opaque bytes and local handle semantics. Render/hit assertions cover every A4 consumer, including empty marks/rover, preview, snap targets, PDF and hifi parity, on A1's tree before enabling UI.

A2 model/shell: both buttons set the same anchor intent on Standard/Neotone; profile "one" removes anchor; same-state click adds no history; between then one is clean; map unchanged, undo/redo and Cancel preserve options; pan-type switches retain anchor (including built-in Pygmy -> Neotone, expected turned default). Disabled iff the two solve results are equal, including mutant-only and no-rim cases; no rim-only shortcut. Use option literals for legacy mirrored/permuted data, no removed Mirror/Rotate helper. With a tray note
held, changing anchor preserves that held note AND announces the anchor result; do not let `editorRender`'s
current held-note status priority swallow `s.say`. Cancel restores the pre-edit session/held state. Test
visible/live-region result plus held-note preservation, not just the model flag.

A2 e2e: replace only panel P1's "disabled until PL-b" assertions with working Neotone states; retain both ids and stable labels, pressed state, status announcements and focus. Exactly two Layout controls on both profiles, no Mirror/Rotate element. Verify physical turned SVG placement (290/250/... for the mutant fixture), empty slot numbers/hit positions, undo/redo/Cancel, save/reload record 7 and v9 sharing. Keep all old-data mirrored/permuted open/edit/save/share proofs from PL-a, including byte-identical no-op re-save and old v7 decoding. Mutating legacy Standard mirrored scales must keep mirror flags during place/move/trade/remove/save; anchor work cannot erase them. Add the first/last-mutant transition journey: choose between on a
no-mutant Neotone scale -> add its first mutant -> remove its last mutant -> undo/redo -> save/reopen.
At each step assert anchor option/pressed state, drawn placement and hit/snap targets agree; turn changes
between Standard seats and 20-degree fixture offset without losing the between intent. Include the held-note
anchor change/result announcement and Cancel journey.

Verify model/shell with `node --test tests/editor_model.test.js tests/editor_shell.test.js`; A1 persist with `node --test tests/persist.test.js`; app contract with `node --test tests/app.test.js`. Browser checks are serialized by the integrator under the runbook: read actual final-branch titles, record exact `--test-name-pattern` selectors and expected counts BEFORE running the TRI59d, P1 Neotone-anchor and old-data compatibility journeys. Check that selected tests actually ran, with no silent skips; a process exit code is insufficient.

### P4 Implement, sync, fit and mutation

E follows P2; A1 then A2 implement only owned hunks. Run `python3 tools/sync_i18n.py` and `--check`, `python3 tools/validate.py`, fixture-integrity checks, `python3 tests/suite_health.py`, `python3 -m unittest tests.test_readme_currency`, and all-mutant apply checks per lane. Use completed panel I1's probe mode: `node tools/probe/panel_fit.js --absolute --font both --workers 1`
(or I1's supported `--base <pinned successor SHA> --font both --workers 1`, recording that SHA), NEVER
its default `origin/main` comparison with no editor. Require measured editor cells for BOTH anchor states,
Standard/Neotone, all 8 actual locale tables, both fonts and existing 320/375 px cases, plus 380 px UI journeys;
zero selected cells or an absent editor is failure. Record those receipts; preserve existing budgets, both fonts and real tables. Assert selected/unselected 3:1 distinction per existing palette test, target sizes and split accessible name. No new label design or new instrumentation.

Mutants cover selective v9/7 emission, canonical "one", incorrect/dropped turn, no-mutant anchor ignored, every missed consumer (including hifi/pdfcards/snap), malformed v9/version gates, anchor carry/save loss, same-state history, disabled equality and legacy mirror flag loss. Full mutation is REQUIRED for E, A1 and A2 because PL-b changes engine/saved scales; scoped runs may supplement, never replace it. FLOORS/count changes reflect only owned test/mutant changes and exact-head CI artifacts. Deliverables use M/D topology above, `Refs TRI-59`, all M held.

### P5 Review and DEV
Fresh independent reviewer (swarm-reviewer, `OPENCLAW_SESSION=1` on Bash calls) per lane at the verified
head SHA with CI's `validate` conclusion at that SHA; brief quotes this plan verbatim (acceptance criteria,
goal, non-goals, ownership; no added rules). D merges to dev only on green `validate` on M, reviewer PASS or
PASS_WITH_NITS, not CONFLICTING. Then served DEV e2e (`docs/testing/browser.md`) incl. the v9 link and the
v7 record against the shipped client.

### P6 Owner gates and verification split

Owner phone QA on actual served DEV: Standard/Neotone show the same TWO buttons; each state/pressed look is clear; a 9+6 Neotone scale turns half a step with number/lens placement following its radial line; no-mutant placement matches Standard; Pygmy -> Neotone preserves between; save/share/reopen keeps the arrangement; existing mirrored/permuted scales remain editable. Include panel's German and Chinese (zh-Hans/zh-Hant) phone checks. Browser automation cannot certify owner device behaviour.

Automated evidence: P1/P3 contracts, every existing v1..v8 link/storage corpus, frozen readers, record-7 move, all consumer render/hit/print parity tests, fit/i18n/fixture integrity, full mutation, and full Linux CI `validate` at the EXACT final head. Local smoke or doc-only skipped CI is not implementation evidence. Independent final reviewer receives verified SHA, base, ownership, acceptance and CI conclusion; findings must be addressed before dev integration. After integration verify the ACTUAL served DEV revision and affected journeys, with required selected counts/skips recorded. Final aggregate RC gets fresh independent RC review and full release checks; every M stays held for the owner's explicit main merge instruction, calling out wire 9 / record 7. AFK grants dev-only merges after these gates; never main merges, deploys, migrations, force pushes, amend, no-verify or production-credential actions.

## Risks
- R1 Renderer misses a fixed-angle site: a turned lens or empty-field number drawn at the old spot. Mitigated
  by A4 enumeration and a render test per site (card SVG, print plan, hifi, preview, editor ring numbers).
- R2 Float drift: `norm(a + 20)` keeps integers; asserted with `===`, keys of the `main[ang]` map compare
  exactly.
- R3 Removed controls accidentally restored or old mirror/permuted data stripped: exact two-button assertions and retained compatibility fixtures gate A2.
- R4 An old app opens a v9 link: clean `NEEDS_NEWER_APP` (tested against the shipped client); a user who
  shares a turned card with someone on an old tab gets "needs a newer app", never a mangled card.
- R5 An old app syncs/keeps a v7 record: opaque, byte-for-byte; no slot can be owned (Rule I1). A future
  cross-device sync (TRI login sync) must treat a record 7 row as opaque, as it treats 5 and 6.
- R6 `PROFILE_CONFLICT` sentence change touches 8 locale tables; the key pin in `tests/app.test.js` and
  `tests/scale.test.js` must move with it in the same commit.
- R7 Base drift/conflicts: E starts only at completed panel D1 on the future successor; re-verify facts and generated/mutant contexts there.
- R8 Incomplete release cut: owner requires PL-b; never cut at panel D1, E or A1. Keep #994 open; a reviewed/ready successor still needs explicit close authorization.

## Edge cases
- Empty scale or equal solves: both buttons disabled; a mutant-only Neotone card remains enabled when lenses move. One rim note: "between" puts it at the top (per `rimAngles`);
  allowed, existing behaviour.
- Neotone with `unplaced` held: toggle still works (anchor is independent of the map); SAVE/GENERATE hold
  stays.
- Mutant count crosses zero: turn 20 <-> 180/k; the anchor option persists.
- Pan type switch Standard <-> Neotone: anchor kept (D10); the map is rebuilt as today.
- Standard scale with inner notes: toggle enabled, anchor still moves the rim.
- Print: PDF geometry via `HPE.pdfcards`, `tools/hifi.py`, `tools/decks.py` identical (extent unchanged);
  `tools/decks.py` reads hifi's `profile_radius` so needs no change beyond hifi.
- Old saved scales and share links: never rewritten; a saved Neotone scale gains record 7 only when the user
  selects "#1 / #2" and saves (or an existing between intent is carried from Standard / a v9 link and saved).

## Interim and default behaviour (R5-3)
- E's `solve` reads only `seedOptions.anchor` and keeps `readProfile(..., {}, ...)`, so a mirrored Standard model switched to Neotone does not fail with `PROFILE_CONFLICT`.
- `editorModelFor(d,"builtin")` sets `anchor` for every built-in and `editorPanType` keeps it (D10): built-ins whose Standard layout is "between" (Pygmy, note 1 at 290) become TURNED Neotone cards by default after A2. Stated here, and an owner look item in P6.

## Release sequencing and old-client safety

One owner-gated main release: completed editor successor panel stack plus E + A1 + A2, as REQUIRED by the owner (2026-11-09). No separate toggle, decoder-first release or soak. The RC candidate is the completed A2 tip; never E or A1 (intermediate app paths/buttons are not complete). Panel D1 alone is not a release candidate under that decision.

Frozen readers are a PRE-RELEASE gate: both v6-only fixtures and pinned main-with-profile `git show 3668f95d:index.html` refuse v9 with `NEEDS_NEWER_APP` and preserve record 7 opaque byte-for-byte without protected-locking the whole library. Also exercise a pinned pre-change wire-8/record-6 client so v8 support cannot hide a clamp regression. Existing v1..v8 links, records 4/5/6 and permuted-map fixtures remain unchanged. The profile-enabled-false case still refuses v9.

On the successor stack A1 must prove opaque carry in `moveImport` / `moveUrl`; if missing, implement it in A1, preserving opaque rows and local-handle rules. Frozen main's historic `moveImport` drops record 7, so merely passing old-reader opacity does not satisfy move/sync safety. `TRI59d move carries a record 7 row` plus frozen-client tests must pass at the final head. Login/cloud sync compatibility must preserve record 7 opaque where unsupported; dev-only sync code must not hitchhike into the main-based successor. Flag any missing successor-owned integration as a blocker rather than importing unrelated dev work.

Once E+A1 is present, a hand-made v9 link can be opened/saved as record 7 and share-copy v9 on DEV; test this, do not hide it behind A2. E+A1 do not constitute a release or DEV QA completion. Owner approval of the selective version bumps remains necessary before main; no storage migration is authorized.

## Recovery
Before any v9/7 data is exposed, an abandoned stack can be reverted in dependency order A2 -> A1 -> E, using revert commits and integrator-owned `claude/dev-revert-<lane>` PRs; never reset shared branches. After exposure on DEV or main, preserve E + A1 decoders/readers: prefer reverting A2 UI/encoding while keeping existing v9 links and record 7 readable. A whole-stack rollback would make these formats unsupported, so opaque bytes must remain intact and no rollback may discard saved data. Main rollback is an owner-gated main-based PR; dev rollback uses the dev-revert flow. No rollback execution is authorized by this plan-only refresh.

## Proposed ENGINE-SPEC amendment (text; edit lands in lane E, not now)
Replace in 18.2 the last placement sentence: "With a profile, `mirror`, `mirrorBottom`, `seats` and
`angles` must be absent; `anchor` MAY be present and is `"one"` or `"between"`."
Add to 18.4: "`HPE.layout.solve` with a profile reads `options.anchor`. With a mutant note and anchor
`"between"`, every main tonefield and its lens sit at the fixture angle plus `turn` = 180 / tonefields (20
degrees), reduced mod 360, and `geom.turn` is that number; with anchor `"one"` or absent `geom.turn` is
absent. With no mutant note the plain solve receives the anchor, so rim notes take the Standard seat angles
of that anchor and `geom.turn` is absent. `turn` never changes the map, labels, radii, orbits, `ext` or the
print extent. When mutants exist, renderers place the main and lens of tonefield k at `PROFILE.angles[k-1] + turn`. Without mutants, filled fields use the effective `geom.place` angles with their slot identity; no fixed-angle substitution is allowed."
Amend 18.3 `PROFILE_CONFLICT` sentence per D11 ("mirror, seats and angles").
Amend 18.5: "Wire version 9 (`PROFILE_ANCHOR_VERSION`): the version 7 grammar plus exactly one `between`
segment after `pair-`. `encode` writes 9 iff the seed has a profile and `anchor` `"between"`; otherwise it
keeps all existing encoding choices unchanged (profile 7, ordinary 6, inner-pinned 8). A version 9 link without `pair-` and `between`, or with `mirror*`,
`seats-`, `at-` or `ai-`, is `BAD_NOTE`; a version 7 link carrying `between` stays `BAD_NOTE`. In `decodeReadable` the `between` branch is tested before the profiled fall-through, so a profiled v9 link
accepts `between` exactly once. A client whose
newest wire is below 9 answers a version 9 link with `NEEDS_NEWER_APP`."
Amend 18.6: "`PROFILE_ANCHOR_RECORD_VERSION = 7`, returned by `recordVersion` iff the seed has a profile and
`anchor` `"between"`. Rule I1 applies unchanged; a version 7 record with `replaces` is read as opaque. A
client that does not know record 7 keeps it opaque, byte-for-byte."
Amend 18.7: add the v9 link fixture to the pinned list.

## Documentation and continuation

Lane E updates ENGINE-SPEC 18.2–18.7 and print consumption notes; A2 updates CARD-SPEC to describe TWO anchor buttons and effective placement. Do not propose a CLAUDE.md change for feature detail. Keep app-wide MIRROR documentation intact; PL-a already owns removal of its editor-only Mirror/Rotate paragraph.

Next: fresh independent `/plan-eng-review` of this refreshed file, then retain implementation gate until owner RC QA, future successor creation and completed panel D1 are verified. Owner answers now recorded: PL-b REQUIRED; keep #994 OPEN until the successor is reviewed/ready to supersede it, with no close authorization. Remaining owner gates: editor RC manual QA, explicit version-bump/main release approval and served DEV phone QA. Existing two-button/no-Mirror/no-Rotate decisions are settled. This plan-only lane makes no source/test edits, commits, pushes, PRs, Linear writes or browser runs.

## Refresh disposition (2026-11-09)

The operative body now incorporates panel round-9 scope: old D4 single-toggle proposal replaced by two buttons; D6/D7/D8/D9 and A2/P3 remove editor Mirror/Rotate work; D1 successor base and complete lane order replace #994/dev bases throughout; temporary pending-reason removal and P1 test ownership assigned to A2; full mutation, actual final-head CI, independent review and served DEV gates retained. Option A/B/C research, engine decisions, backward-compatibility matrix, consumers and frozen-client research remain current where stated above. Earlier one-button labels, mirror pairing, dev/#994 bases, two-release/soak ideas and conflicting review dispositions below are HISTORICAL ONLY.

## Fresh review record and dispositions (2026-11-09; prior reviewed draft)

These verdicts describe the pre-correction refresh, not readiness of this revision. Fresh confirmation is
pending; implementation stays gated. No new owner questions, features or infrastructure were added.

| Finding | Evidence / prior verdict | Disposition in this revision |
|---|---|---|
| ENG-1 effective no-mutant snapping | Engineering NOT_READY: no-mutant between uses Standard seats with no `geom.turn`; at 9 rims the drawn second field at 250 degrees would snap to fixed slot 0 rather than slot 1. | Fixed in plan: A4 distinguishes effective slot-aware placements from mutant-only uniform turn; E owns snap interface, A1 caller threading, P1 requires k=1..9 and explicit 250-degree regression. |
| ENG-2 reproducible corpus additions | Engineering NOT_READY: #994 `tools/regen_engine_corpus.js` has `record(string, reader)` and reads only `s.string` / `s.reader`; existing synthetic input has no profile cases/options. | Fixed in plan: E owns optional-options generator changes and corpus-only synthetic profile input, additive `corpus.profileAnchors`, check/mutant coverage and regeneration in the engine commit; all old rows unchanged. |
| DES-1 held-note feedback | Design READY_WITH_NITS: current `editorRender` prioritizes held-note status over `s.say`, which can hide an anchor result. | Fixed in plan: A2 owns that status-choice hunk and tests held preservation, anchor announcement and Cancel restoration. |
| DES-2 first/last mutant transition | Design READY_WITH_NITS: between intent crosses Standard-seat and turned-fixture geometry. | Fixed in plan: A2 journey covers adding first/removing last mutant, undo/redo, save/reopen, pressed state, placement and hit/snap consistency. |
| DES-3 fit evidence | Design READY_WITH_NITS: default probe base main has no editor; a successful command can select no relevant cells. | Fixed in plan: P4 requires completed I1 absolute mode or pinned successor base, measured cells for both anchor states, both fonts and all locales; missing cells fail. |

## Archive boundary — prior decisions and independent reviews (read-only history)

Everything below records earlier drafts and verdicts. It is superseded by the operative body above, including historical owner-question statuses; "live plan above" inside archived logs means the refreshed body. Keep the history as evidence, never execute an older sequencing/control/release instruction. No prior READY verdict constitutes review of this refresh.

## Archived decision log (prior AFK proposals; superseded where changed above)
| # | Decision | Alternative | Why |
|---|---|---|---|
| L1 | Option B (anchor beside profile) | A profile `turn`; C impossible | smallest, no map-format change |
| L2 | Wire 9 and record 7 only for profile + between | reuse 7/5 | old apps need a clean refusal / opaque keep |
| L3 | `geom.turn` absent when 0 | always present | keeps every existing output byte-identical |
| L4 | State-showing label ("#1 CENTRED" / "#1 / #2"), no aria-pressed (revised after review F10) | constant label + aria-pressed | both states visible and named, zero new keys |
| L5 | Disabled iff solve(one) equals solve(between) (revised, F7) | rim-count rule | exact, covers lenses |
| L6 | Mirror pairs derived from `editorSolve(m).geom.place` (F6) | typed pair table / fixed angles | cannot drift; handles no-mutant |
| L7 | Anchor carried across pan type switch | reset on switch | one user intent |
| L8 | `PROFILE_CONFLICT` sentence drops "anchor" | leave stale | it would be false |
| L9 | SUPERSEDED (owner 2026-11-08/09): Rotate dropped and editor Mirror Top/Bottom dropped on both profiles (owner Q9, Q10); owned by panel lane PL-a | keep Rotate Neotone-only | owner Q8, Q9, Q10 |
| L10 | Rollback keeps decoders | revert all | no unreadable saved data |
| L11 | Wire 9 / record 7 (F1) | 8 / 6 | 8 and 6 are cyclops inner-angles formats on dev |
| L12 | Engine canonicalises profile anchor "one" to absent (F2) | store "one" | v5/v7 stay byte-identical to main's readers |
| L13 | SUPERSEDED by L23 (decoder-first) | | |
| L14 | The one release is blocked on opaque-carry for moveImport/sync (F5) | assume safe | those paths drop unreadable rows |
| L15 | New frozen main-with-profile client fixture (F4) | reuse v6-only fixtures | v6-only clients cannot prove the v7-era refusal |
| L16 | Lane E also owns `snapTarget`, `tests/app.test.js` pins, mutant refresh, 7 authored translations (F3, F8) | split | one coherent engine+i18n commit |
| L17 | Lane A split: A1 read+render, A2 toggle, as stacked waves (R2-1) | one lane A | A2's e2e needs the read path first |
| L18 | The single release is the ONE_PANEL editor release; no separate main toggle (R2-3) | separate toggle release | ONE_PANEL is the editor flag |
| L19 | Gate: dev opaque-carry ships in the one release; named record-7 move test owned by A1 (R2-4, R3-3) | trust moveImport | main drops a record 7 row |
| L20 | Each lane owns README count / FLOORS for its own mutants; per-file hunks in `tests/app.test.js`; prefixed mutant names (R2-5) | A owns all | E's PR would fail readme currency |
| L21 | `parseSeed` accepts then drops "one"; `decodeReadable` `between` before the profiled fall-through (R2-9, R2-6) | implicit | order bugs reject valid data |
| L22 | Note kept for remaining buttons, no `aria-describedby` on the toggle (R2-7); status line is a live region (R2-8) | describe the toggle | note would contradict the live toggle |
| L23 | ONE release, no soak, no decoder-first release; old-client safety is a frozen-fixture gate (R3 regroup, R3-1) | two releases | main already refuses v9 and keeps record 7 opaque, so release 1 added no safety and named code absent from main |
| L24 | Hand-made v9 link saved writes record 7: stated and tested, not gated (R3-2) | gate writing to A2 | harmless, and correct after release |
| L25 | E leaves `editorSetAnchor` inert; E owns no editor tests; A2 updates the "takes none of the three" assertion in the same commit as the code (R3-4) | E edits editor tests | clean file ownership |
| L26 | v5 record with `anchor:"between"` fails identity, stays opaque, never rewritten; `persist.test.js` is A1's (R3-5, R3-6) | normalise and rewrite | no write path for a malformed record |

## Archived owner questions (statuses historical; current questions above)
- Q1 (format versions, the one main release): approve wire 9 and record 7 (emitted only for Neotone + "#1 / #2")? Needed before any main merge, not before DEV.
- Q3 (DEV look): state-showing label (default) or constant "#1 / #2" with a pressed look? Decided on the iPhone check.
- Q4: REMOVED (R3): there is no soak.
- Q2: ANSWERED 2026-11-08/09: moot: Rotate and editor Mirror are both dropped (Q9, Q10); the only Layout controls are the two anchor buttons. 
- Q-two-buttons: ANSWERED 2026-11-09 (owner): "#1 centred" and "#1 / #2" stay TWO buttons. D4's single `editor-anchor-toggle` is NOT used; `editor-anchor-one` and `editor-anchor-between` stay, and A2 only enables the Neotone "#1 / #2" button (shipped disabled by panel lane PL-a) and makes both anchor buttons act on a profile. Read every "toggle" in D4, L-rows and lane A2 as "the two anchor buttons". The panel plan says "four controls, two anchor buttons".

## Round 2 disposition (revision after review round 2)
> HISTORY, superseded by the R3 regroup (one release, no soak). Kept as the record; the live plan is the body above.
| Finding | Disposition | Where |
|---|---|---|
| R2-1 high: lane/release split | FIXED: A1 read+render (release 1 = E + A1), A2 toggle (release 2); tests: v9 link and record 7 fixture draw turned in the release-1 build on served DEV, no toggle | Lanes, Release sequencing, L17 |
| R2-2 high: stale record 6 | FIXED: comparison row, P1 matrix row, CLAUDE.md patch now 7, "6 inner unchanged"; grep clean | Comparison, P1, doc patches |
| R2-3 medium: ONE_PANEL | FIXED: release 2 is the whole editor release; non-goal, soak, Q1/Q4 aligned | Non-goals, Release sequencing, L18 |
| R2-4 medium: opaque-carry | FIXED: main drops a record 7 row, dev carries opaque, `moveUrl` unchanged; gate and named move test | Release sequencing, L19 |
| R2-5 medium: mutant ownership | FIXED: per-lane README/FLOORS, per-file `tests/app.test.js` hunks, prefixed mutants, P0 checks `tri59c_*` on #996 | Lanes, P0, L20 |
| R2-6 low: branch order | FIXED: D19, P1 test, ENGINE-SPEC 18.5 line | D19, P1, spec |
| R2-7 low: layout note | FIXED: D20 | D20, L22 |
| R2-8 low: live region | CONFIRMED (verified `editor-status` attributes); Q3 kept | D21 |
| R2-9 low: parseSeed order | FIXED: D18, P1 test | D18 |

## Round 3 disposition / regroup (third failed round: smaller subplan)
> HISTORY, superseded by the R3 regroup (one release, no soak). Kept as the record; the live plan is the body above.
Regroup: one release instead of two. Lanes E, A1, A2 remain, as dependency waves on dev-based branches after #996.
| Finding | Disposition | Where |
|---|---|---|
| R3-1 high: release 1 names code absent from main | FIXED by removing release 1; the single release is the dev-to-main editor release, so every site exists; no main-based lanes | Release sequencing, L23 |
| R3-2 medium: v9 link saved writes record 7 | STATED and TESTED (A1 persist hunk); acceptable | Release sequencing, L24 |
| R3-3 medium: opaque-carry owner | FIXED: dev already has it and ships in the one release; A1 owns `TRI59d move carries a record 7 row` | Lane A1, L19 |
| R3-4 medium: E vs editor tests | FIXED: E owns no editor tests and leaves `editorSetAnchor` inert; A2 updates the assertion with the code | Lane E, L25 |
| R3-5 low: v5 + between identity | FIXED: canonical rule, fails identity, opaque | P1 matrix, L26 |
| R3-6 low: stale singulars, persist | FIXED: A1/A2 names; persist.test.js A1 only | P3, P4, Verification, L26 |
| R3-7 low: interim facts | FIXED: marked as #996 at 57232705, re-verified at P0 | Verified facts |

## Round 1 disposition (revision after review)
> HISTORY, superseded by the R3 regroup (one release, no soak). Kept as the record; the live plan is the body above.
| Finding | Disposition | Where / evidence |
|---|---|---|
| F1 blocker: v8/record 6 taken | FIXED: wire 9 / record 7; stale facts updated (dev `share.js`: `PROFILE_VERSION` 7, `INNER_VERSION` 8, `INNER_RECORD_VERSION` 6, `decodeReadable` `profiled = charAt(0)==="7"`, `newest` clamp for 8); `profiled` gate becomes {7,9}; v8 still refuses `pair-` | Verified facts, D14, P1 matrix, ENGINE-SPEC text |
| F2 high: explicit "one" breaks v5 readers | FIXED: engine canonicalises "one" to absent for profiles; `editorSetAnchor("one")` deletes it; matrix rows resolved | D13, P1 matrix |
| F3 high: missed fixed-angle sites | FIXED: full enumeration incl. `snapProfile`/`snapTarget`, `neoSlotPoint(slot,null)` callers (`editorNeoMarks`, `neotoneOverlay`, keyboard spot), empty-mutant number placement, `neoPlan`, hifi tones; ownership assigned | A4, Lanes E and A |
| F4 medium: v6-only fixtures | FIXED: new frozen `git show 3668f95d:index.html` fixture, pinned; dev-era decoder case added | A2, D17 |
| F5 medium: moveImport / sync drop unreadable rows | FIXED as a gate: UI release blocked on opaque carry; record 7 move test | Release sequencing, D16, P5 |
| F6 medium: no-mutant mirror pairs | FIXED: mates from `editorSolve(m).geom.place` | D6 |
| F7 medium/low: D5 vs lens turn | FIXED: disabled iff solve(one) == solve(between) | D5 |
| F8 medium: ownership, I18N refresh, translations | FIXED: Lane E owns `tests/app.test.js` pins, mutant refresh via `refresh_mutants.py`, authors 7 translations; Lane A owns all e2e | Lanes |
| F9 medium: no decoder-first release | FIXED: two-release sequence with soak | Release sequencing, D15 |
| F10 low: unlit state invisible | FIXED: state-showing label, `.on`/aria handling spelled out; constant-label option kept as Q3 | D4 |
No finding was rejected.

## Review round 1
> HISTORY, superseded by the R3 regroup (one release, no soak). Kept as the record; the live plan is the body above.

Verdict: NOT READY. Blockers/highs: F1, F2, F3.

- F1 BLOCKER. Wire v8 / record v6 are already allocated on dev (`INNER_VERSION=8`, `INNER_RECORD_VERSION=6`, commit ad5c2cbf, and `docs/plans/2026-11-05-scale-editor-reinvent.md`: pinned cyclops angles, `pair-` on v8 refused, v6 profile record opaque). Reusing them collides with a shipped meaning. Fix: use wire v9 / record 7; update the stale "newest 7 / record 4|5" facts, the "v9 refused" tests, and the `profiled` gate in `decodeReadable`.
- F2 HIGH. An explicit `anchor:"one"` on a profile (written by `editorSetAnchor`, or carried via D10) produces v5 records with `o.anchor`; main's `buildGenerated` -> `parseSeed` then returns PROFILE_CONFLICT, so old clients cannot read the record. Fix: the engine canonicalises "one" to absent for a profile; test that v5 never carries `anchor`; resolve the "decide by test" matrix row.
- F3 HIGH. Missed fixed-angle sites: `snapProfile`/`snapTarget` in `src/engine/layout.js` (`nearestSeat(PROFILE.angles...)`), `neoSlotPoint(slot,null)` callers (`editorNeoMarks`, `neotoneOverlay`, keyboard spot), empty-mutant number placement, `neoPlan`'s `pd.angles` loop, hifi's tones loop. Add them to the enumeration and ownership.
- F4 MEDIUM. A2/A3 isolation fixtures (`shipped_client_ee5438d0`, `c6ef6b58`) are v6-only clients; add a frozen main-with-profile client (e.g. `git show 3668f95d:index.html`).
- F5 MEDIUM. `moveImport` drops unreadable rows; depend on R4-1 (opaque carry) or equivalent. Cloud/login sync must treat record 7 as opaque.
- F6 MEDIUM. D6 must say no-mutant mirror pairs come from `editorSolve(m).geom.place`, since `rimAngles` pairs differ between "one" and "between".
- F7 MEDIUM/LOW. D5 "no rim note" contradicts the D3 turn on lenses; define disabled as "solve one == solve between".
- F8 MEDIUM. Ownership gaps: `tests/app.test.js` and e2e are not owned by Lane E; the I18N line is context in many mutant patches (refresh needed); 7 translations of the PROFILE_CONFLICT sentence must be authored (`tests/scale.test.js` pins it).
- F9 MEDIUM. No decoder-first release is sequenced; recovery depends on decoders surviving.
- F10 LOW. Unlit "#1 / #2" gives no visible "#1 centred" state; `.on` and `aria-pressed` handling for neo in `editorRenderLayout` must change.

Verified OK: all fixture angles are 30 mod 40; mirror at turn 20 (p9 fixed, pairs p1/p2 ... p7/p8); rotate keeps cyclic order; print extent is rotation-invariant; i18n keys exist in all 8 tables (zero new keys); `savedMeaning` already carries anchor; dropping `anchor` from `PROFILE_CONFLICT` cannot change any stored data.

## Review round 2
> HISTORY, superseded by the R3 regroup (one release, no soak). Kept as the record; the live plan is the body above.

Reviewer: fresh independent, read-only. Checked against origin/dev a30dc212 and main 3668f95d/34f41d92 (`git show`), not against the plan's own claims.

### Round 1 dispositions: verified against source
- F1 FIXED in substance. dev `share.js`: `PROFILE_VERSION` 7, `PROFILE_RECORD_VERSION` 5, `INNER_VERSION` 8, `INNER_RECORD_VERSION` 6; `decodeReadable` gate is `profiled = text.charAt(0) === "7"`; `decodeSeed` clamp is `PROFILE_VERSION` (7) with an 8 special case; main has no INNER constants. So 9/7 are free. A v9 link reaches `version > VERSION` and answers `NEEDS_NEWER_APP` on main and on dev; a record 7 fails `checkShareVersion` (newest 5 on main, 6 on dev) and is opaque. `INDEX["9"]` exists (digit alphabet). Confirmed.
- F2 FIXED. `resolveAnchor` treats absent as "one", so canonicalising "one" to absent for a profile changes no layout.
- F3 FIXED. Fixed-angle sites on dev, re-enumerated: `layout.js` `placeProfile` (both `PROFILE.angles[slot]` uses) and `snapProfile`; `pdfcards.js` `neoPlan` (`pd.angles.forEach`, keyed by `main[ang]`/`mut[ang]`) and its generated copy; `tools/hifi.py` tones loop; `index.html` `neoSlotPoint`, `neotoneOverlay` (`PROFILE.angles[slot % NEO_MAIN]`), `editorNeoMarks`, `editorNeoPoint`, rover spot. `tools/decks.py` has none. The list is complete.
- F4, F6, F7, F9, F10 applied in the body (A2, D6, D5, Release sequencing, D4). Mirror arithmetic re-derived (A_g = 540 - 2t - A_f; p9 fixed at t=20) and correct.
- F5 applied, but its premise is incomplete (R2-4). F8 applied (but see R2-5).

### New findings

R2-1 HIGH. The two-release sequence does not match the two-lane split.
Evidence: "Release sequencing" step 1 says the decoder release is "lane E's decoders (wire 9 decode, record 7 read, ...) ... `snapTarget`", yet "record 7 read" is `readSavedRecord`/`savedCandidate`/`newestRecordVersion`/`recordVersionFor` in `index.html` app JS, which the plan assigns to Lane A, and "Lane E: Not owned: app-layer index.html code". Likewise `buildGenerated` (profile branch strips `anchor`, dev `delete built.value.options[name]`) and `neoSlotPoint`/`neotoneOverlay`/`editorNeoMarks` are Lane A. Consequence if release 1 = lane E only: a v9 link opens with the turn silently stripped (no error, wrong card), a record 7 stays opaque, so the soak proves nothing and rollback "keep the decoders" has none in the app.
Fix: split Lane A into A1 (read/render path: `buildGenerated` keeps anchor, `readSavedRecord`/`newestRecordVersion`/`recordVersionFor` accept record 7 iff profile+between, `neoSlotPoint` family, `snapTarget` caller; no toggle) and A2 (toggle UI, `editorSetAnchor`, `editorNeoMirror`, `editorPanType`, e2e). Release 1 = E + A1 (a v9 link and a record 7 fixture must load correctly in served DEV with no toggle); release 2 = A2. Add a test that a v9 link decoded in the release-1 build renders turned.

R2-2 HIGH. Stale "record 6" survives in acceptance and spec-adjacent text, contradicting D14/L11 and re-creating the F1 collision.
Evidence: P1 matrix row "`recordVersion` | 4 std; 5 profile; 6 profile + between"; Comparison table row "Record | v6 | v6 (only profile + between)"; "Proposed doc patches" CLAUDE.md text "v9 links, record 6". dev `INNER_RECORD_VERSION` is 6 (profile+record 6 is deliberately opaque, `readSavedRecord`). An implementer or a reviewer briefed with the plan verbatim (the repo's practice) would write and accept 6.
Fix: change all three to 7 (and add "6 inner unchanged"). grep the file for `record 6`/`v6` after editing.

R2-3 MEDIUM. Non-goal vs release plan contradiction on `ONE_PANEL`.
Evidence: Non-goals: "`ONE_PANEL` never reaches a main release as a toggle". dev has `const ONE_PANEL = true`; Release step 2 ships "lane A's toggle" to main. If ONE_PANEL stays off on main, release 2 never emits v9/7 and the soak/gate language is moot; if the editor releases, release 2 is the whole editor release and its owner go must cover it.
Fix: state which; most likely "release 2 = the ONE_PANEL editor release; this plan adds no separate main toggle", and align the soak and Q1/Q4 to that.

R2-4 MEDIUM. F5's dependency is mis-stated and is already half-satisfied.
Evidence: main `moveImport` carries a row opaque only if `readSavedRecord({ ...row.r, o: bare }).ok` (drops a v7 row, since 7 > newest 5); dev `moveImport` carries any object row opaque (`else if (savedObject(row.r)) items.push({... opaque: row.r })`). `moveUrl` carries `row.record` unchanged on both.
Fix: record this fact; make "the dev opaque-carry is on main (or ships in release 1)" the gate, with the record-7 move test named, instead of "R4-1 or equivalent".

R2-5 MEDIUM. Mutant count / FLOORS / README ownership gap.
Evidence: Lane E adds about 8 mutants (P2) but only Lane A owns `tests/suite_health.py` FLOORS and the README mutant count; `tests/test_readme_currency.py` checks the stated count against `tests/mutants/*.patch`, so Lane E's PR fails currency. Also `tri59c_neotone_controls_all_shown.patch` is not on dev (it is on the interim lane), so Lane A's rewrite list is only valid after #996 lands; P0 should assert that. `tests/app.test.js` and `tests/mutants/*` are co-owned by E and A.
Fix: give E the README count and FLOORS rows for its own mutants (from main's CI artifacts), A for its own; name per-file hunks for `tests/app.test.js`; add the #996 patch files to P0's check.

R2-6 LOW. `decodeReadable` structure: `else if (profiled) return badNote(text)` sits before the `o === "between"` branch, so a v9 `between` token is rejected unless the branch order changes; the plan's D14 states the rule but not this. Add one line to P1/ENGINE-SPEC 18.5 text and a P1 test (v9 with `between` decodes).

R2-7 LOW. `#editor-layout-note` (dev: `t("reason.PROFILE_CONFLICT")`, `aria-describedby` set on every layout button when profiled) is not addressed. After D11 the note still says placement is fixed while the toggle is live and described by it. Decide: keep the note for the remaining buttons only and remove `aria-describedby` from the toggle.

R2-8 LOW (a11y, D4). A label that changes with state and no `aria-pressed` is acceptable (ARIA practice: do not combine a changing label with a pressed state), and the status line announces the result. Residual ambiguity: "#1 CENTRED" can read as the action. Confirm the editor status line is a live region (it is the only announcement); the split-state `aria-label` begins with the visible text, so label-in-name holds. Keep Q3 for DEV.

R2-9 LOW. Anchor "one" canonicalisation in D13 lives in `parseSeed`, but `readProfile` runs before and tests `options.anchor` for conflict; make the order explicit (accept, then drop) so "one" is not rejected on the way in. Also the movement of `PROFILE_CONFLICT` text in `data/i18n` must keep Neotone untranslated (already stated).

### Readiness criteria
1. No open blocker/high: NOT MET (R2-1, R2-2).
2. Assumptions verified/gated/recorded: MET apart from R2-4 (move/sync fact incomplete).
3. Smallest approach justified: MET (Option C impossibility is correct; B vs A compared).
4. Phases with prereqs/owner/deliverable/acceptance/verify: PARTIAL. Verify commands all exist on dev (`inline_engine.py --check`, `sync_i18n.py --check`, `panel_fit.js`, `regen_engine_corpus.js`, `refresh_mutants.py`, fixture integrity test); phase ownership breaks at R2-1 and R2-5.
5. Dependencies: PARTIAL (R2-3, R2-4, #996).
6. Verification covers failure cases: MET (back-compat matrix, frozen main client fixture, opaque record, per-site render tests); needs the R2-2 fix and a release-1 render test.
7. Recovery: MET (revert UI, keep decoders), but only coherent once R2-1 puts the app-layer decoders in release 1.
8. Continuation point: MET.
9. Scope/stop: MET apart from R2-3.

Verdict: NOT READY. Blockers: none. Highs: R2-1, R2-2. Both are plan edits, no redesign; R2-3 to R2-5 should be fixed in the same pass.

## Review round 3
> HISTORY, superseded by the R3 regroup (one release, no soak). Kept as the record; the live plan is the body above.

Reviewer: fresh independent, read-only. Checked against origin/dev a30dc212 and origin/main 3668f95d with `git show`, not the plan's own claims.

### Round 2 dispositions: verified in the plan body
- R2-1 applied: A1/A2 are consistent across Lanes, Release sequencing, L17, P3/P4 (apart from stale singular "lane A", R3-6). R2-2 applied: no "record 6"/"v8" misuse remains (grep: every hit is the inner-angles format or a historical finding). R2-3, R2-5 (ownership text), R2-6, R2-7, R2-8, R2-9 applied. Version numbers 9/7 are free on both branches (dev `PROFILE_VERSION` 7, `INNER_VERSION` 8, `INNER_RECORD_VERSION` 6; main has none of the inner constants). Old-client safety verified: main `newestRecordVersion` is 5 so record 7 fails `checkShareVersion` and is opaque; a v9 link clamps to 7 and answers `NEEDS_NEWER_APP`. All named verify tools/tests exist on dev (`inline_engine.py --check`, `sync_i18n.py`, `panel_fit.js --font/--workers`, `regen_engine_corpus.js`, `refresh_mutants.py`, `suite_health.py` FLOORS, `test_fixture_integrity.py`, editor_* tests).

### New findings

R3-1 HIGH. Release 1 (E + A1 on main) names code that does not exist on main.
Evidence: main has no editor at all (no `ONE_PANEL`, `editor_model/e2e/shell` tests, `editorNeoMarks`, `editorNeoPoint`, `editorSetAnchor`, `editorPanType`) and `src/engine/layout.js` on main has `placeProfile` but NO `snapProfile`/`snapTarget` (dev only). A1 owns "`editorNeoMarks`, `editorNeoPoint`, the `snapTarget` caller" and Lane E owns `snapProfile`/`snapTarget`; the main-existing sites are only `buildGenerated`, `readSavedRecord`/`savedCandidate`/`newestRecordVersion`, `neoSlotPoint`, `neotoneOverlay`, `neoPlan`, hifi. A PR M to main for E/A1 cannot carry the editor hunks, and a dev-based branch carries the whole dev delta (310 commits; see "Lane branches stack on main, not dev"). The "release 1 draws a v9 link turned incl. drag snap and empty-field marks" test is only satisfiable for the sites main has.
Fix: state which release carries which sites. Release 1 = the main-existing subset (engine wire/record/`profileAngles`/`placeProfile`/`neoPlan`/hifi, `buildGenerated`, record-7 read, `neoSlotPoint`/`neotoneOverlay`), cut as lane branches based on main (or an explicit statement that release 1 is a dev-to-main release of the whole editor, which then contradicts L18). The editor-only sites (`snapTarget`, `editorNeoMarks`, `editorNeoPoint`, rover) ride release 2 with the editor, and the release-1 render test is scoped to the main-existing sites.

R3-2 MEDIUM. "The toggle is absent, so nothing writes v9/7 yet" (Release sequencing step 1) is false. A1 accepts record 7 and `recordVersionFor` returns 7 for profile + between, and `savedCandidate` requires `record.v === recordVersionFor`; so a hand-made v9 link opened and SAVED in release 1 writes a record 7, and share-copy re-emits v9. Fix: either say so (reachable only by hand-made links; acceptable) or gate writing to A2; keep the soak claim honest.

R3-3 MEDIUM. Opaque-carry gate has no owner. The gate says dev's `moveImport` opaque carry must be "on main, or ships in release 1" (verified: main drops a row it cannot read via `readSavedRecord(...).ok`; dev carries `opaque: row.r`), but no lane's ownership list includes `moveImport`, and the named test `TRI59d move carries a record 7 row` is only "written in lane A1". Fix: add `moveImport`/`moveUrl` code and `tests/move*` to A1's ownership if the opaque-carry is not already scheduled for main by another release (name that release), or mark the dependency explicitly.

R3-4 MEDIUM. Lane E and A2 ownership still overlap. Lane E owns "the engine-facing editor tests that assert the old refusal" and `tests/app.test.js` pins, while A2 owns `tests/editor_model.test.js`, `editor_e2e.test.js`, `editor_shell.test.js`. The U2e2-8 assertion "a Neotone model takes none of the three" lives in an editor test, and E's removal of the `anchor` conflict would break it before A2 lands. Fix: name the exact tests E may touch (or move them to A2 and have E keep dev green by leaving `editorSetAnchor` inert, which it already is), plus how `editorSetAnchor`'s inert-on-profile test stays valid between E and A2.

R3-5 LOW. A v5 record carrying `o.anchor:"between"` row (P1 matrix, "read as a record-7 meaning and re-written as 7") conflicts with `savedCandidate`'s `record.v === recordVersionFor` identity check: a v5 record would fail it unless the reader normalises first. Specify the normalisation or drop the row (hand-made, never written).

R3-6 LOW. Stale singulars: P3 "Lanes A1, A2", P4 "lane A PRs M (held) and D", Verification split "scoped on A", and Lane A1's list "`tests/persist.test.js` (record 7 read)" while P3 assigns the record-7 shipped-reader test to the same file under "persist" for A2. Align to A1/A2 names; give the persist hunks to one lane.

R3-7 LOW. P0 asserts `tri59c_*` patches exist, correct (none on dev now; #996 is OPEN, head 5723270596ad), but the "Verified facts" bullet on the interim lane's layout row (`editor-rotate-*`, `editorNeoMirror`, fixed-angle `editorNeoMirror`) describes code absent from dev (dev still has `editor-anchor-one` ids at three sites and no rotate); say these are re-verified at P0 against dev after the merge.

### Owner gates: confirmed flagged
Format-version bumps (D2, Q1, P6, doc patch), any main merge (Stop, P2 "nothing merges to main", P6), and the ONE_PANEL editor release (L18, Q4) are all marked owner-gated.

### Readiness criteria
1. No open blocker/high: NOT MET (R3-1).
2. Assumptions verified/gated/recorded: MET (R3-2, R3-3 are statement/ownership gaps).
3. Smallest approach: MET.
4. Phases with prereqs/owner/deliverable/acceptance/verify: PARTIAL (R3-1, R3-4, R3-6).
5. Dependencies: PARTIAL (R3-1, R3-3).
6. Verification covers failure cases: MET.
7. Recovery: MET.
8. Continuation point: MET.
9. Scope/stop: MET.

Verdict: NOT READY. Blockers: none. Highs: R3-1 (release 1 content vs main's code). Plan-text fixes only; R3-2..R3-4 should be fixed in the same pass.

## Review round 4

Reviewer: fresh independent, read-only. Checked against origin/dev a30dc212 and origin/main (3668f95d lineage) with `git show`, not the plan's own claims.

### Verified OK
- Old-client safety (check 4): main `decodeSeed` clamps the read version to `PROFILE_VERSION` (7), so a v9 link answers `NEEDS_NEWER_APP` before `decodeReadable`; main `newestRecordVersion` is `PROFILE_RECORD_VERSION` (5) so `checkShareVersion` refuses record 7 and `readSavedRecord` keeps it opaque. A v5 record with `anchor:"between"` has canonical version 7, fails `record.v === recordVersionFor`, stays opaque and is never rewritten.
- Free numbers: dev `PROFILE_VERSION` 7, `INNER_VERSION` 8, `PROFILE_RECORD_VERSION` 5, `INNER_RECORD_VERSION` 6; 9 and 7 are free. `decodeReadable` still has `profiled = text.charAt(0) === "7"`, so D14/D19 are needed and correct. Fixed-angle sites (`placeProfile` x2, `snapProfile`) match A4. R3-1, R3-2, R3-3 (dev `moveImport` carries opaque; SE-R4-1 tests exist), R3-5, R3-7 are applied in the live body. Owner gates (format bump Q1, main merge, ONE_PANEL release) are flagged.
- Engine design (check 5): Option B, "one" canonicalised to absent, turn 20 degrees, mirror pairs from `geom.place`, print extent unchanged: sound.

### Findings

R4-1 HIGH. Lane E breaks a test it does not own, so E's PR cannot go green.
Evidence: E rewrites `reason.PROFILE_CONFLICT` (D11) and owns no `tests/editor_*.test.js` (R3-4). `tests/editor_e2e.test.js` on dev pins the OLD sentence verbatim (`const NEO_REASON = "Neotone sets its own placement, so mirror, anchor, seats and angles cannot be combined with it."`, used by the test "TRI59 neotone layout row says why it is disabled..."). After E merges that e2e fails until A2 lands, contradicting the claim that dev stays green after E and breaking the "validate at the head SHA is the evidence" gate for E.
Fix: give E exactly that one constant (named hunk) in `tests/editor_e2e.test.js`, or have the e2e read the sentence from `I18N` instead of a literal; list it under E's ownership and A2's "none of" exceptions. `tests/editor_shell.test.js` (U2e-6) matches only `/Neotone sets its own placement/`, so it survives.

R4-2 MEDIUM. Wrong verify target for the "E leaves editorSetAnchor inert" acceptance.
Evidence: Lane E and R3-4 say `node --test tests/editor_model.test.js` must stay green with zero edits to prove the "takes none of the three" assertion. That assertion is U2e2-8 in `tests/editor_shell.test.js` (not editor_model; editor_model has no anchor tests). Fix: acceptance runs `tests/editor_shell.test.js` and `tests/editor_e2e.test.js` (after R4-1) on E's branch.

R4-3 MEDIUM. PR mechanism for dev-based lanes is unspecified and contradicts P2/P4.
Evidence: P2 deliverable "PR D to dev, PR M to main (held)" and P4 "dev PR D and a held main PR M"; Release sequencing says lanes base on dev (the editor and `ONE_PANEL` are absent on main) and the release PR is dev-to-main. CLAUDE.md gates D on a green `validate` on M at the exact head, and CI runs only on PRs into main. An M from a dev-based head carries the whole dev delta, so what CI evidence each lane (and E's required full mutation run) gets is undefined.
Fix: state the mechanism (e.g. one M per lane head to main as a CI vehicle, never merged and expected to carry the dev delta, or the editor-release branch as the base), and remove "held main PR M" per lane if the only main merge is the release.

R4-4 MEDIUM. A1 move test collides with A2's file.
Evidence: dev's move tests (SE-R4-1) live in `tests/editor_model.test.js` (4 `moveImport` refs), which A2 owns; A1 owns `TRI59d move carries a record 7 row` with the file "located at P0". Placing it beside SE-R4-1 puts two lanes in one file. Fix: name the file now and either give A1 that per-file hunk (as done for `tests/app.test.js`) or put the test in A1's `tests/persist.test.js`.

R4-5 MEDIUM. Superseded history is not marked.
Evidence: "Round 2 disposition" (R2-1 "release 1 = E + A1 ... release 2", R2-3 "soak, Q1/Q4"), "Round 1 disposition" F9 ("two-release sequence with soak"), and the "Review round 1/2/3" findings all describe two releases and the soak; only D15, L13 and Q4 carry a SUPERSEDED/REMOVED note. L14 still says "UI release blocked on opaque-carry". The Round 3 table also sits before Rounds 2 and 1. Fix: prefix those headings with "HISTORY, superseded by the R3 regroup (one release, no soak)" and reword L14 to "the one release".

R4-6 LOW. P1 back-compat matrix never names the new frozen fixture.
Evidence: rows say "shipped client (`shipped_client_ee5438d0`)" (v6-only) given v9 / record 7; the `main_profile_client_3668f95d` cases appear only in A2 and the release gate. P2's "(Assumptions A2/A3)" reads as lane names, not assumptions. Fix: add the main-profile fixture rows to the P1 matrix and write "Assumptions A2/A3".

R4-7 LOW. Lane A2 e2e ownership in P3 is complete, but P3's "model (`tests/editor_model.test.js`) ... p9 fixed" tests assume no E-side `editorNeoMirror` change; fine. No other overlap found in `index.html` (E only generated regions via `inline_engine.py`), `tests/app.test.js` (per-file hunks), `tests/persist.test.js` (A1), `tests/mutants` (prefixed).

### Readiness criteria
1. No open blocker/high: NOT MET (R4-1).
2. Assumptions verified/gated/recorded: MET.
3. Smallest approach: MET.
4. Phases with prereq/owner/deliverable/acceptance/verify: PARTIAL (R4-2, R4-3).
5. Dependencies: PARTIAL (R4-1, R4-4).
6. Verification covers failure cases: MET (R4-6 cosmetic).
7. Recovery: MET.
8. Continuation point: MET.
9. Scope/stop: MET.

Verdict: NOT READY. Blockers: none. Highs: R4-1. Plan-text/ownership fixes only; R4-2 to R4-5 should be fixed in the same pass.

## Round 4 disposition (revision after review round 4)
| Finding | Disposition | Where |
|---|---|---|
| R4-1 high: E breaks `NEO_REASON` e2e | FIXED: E owns exactly the `NEO_REASON` hunk in `tests/editor_e2e.test.js`; A2 owns the rest | Lane E |
| R4-2 medium: wrong verify target | FIXED: acceptance runs `tests/editor_shell.test.js` (U2e2-8) plus the `NEO_REASON` e2e | Lane E |
| R4-3 medium: PR M undefined | FIXED: CI-vehicle PR M per lane, never merged; only main merge is the dev-to-main release | P2, P4 |
| R4-4 medium: move test file | FIXED: record 7 move test lives in `tests/persist.test.js` (A1) | Lane A1 |
| R4-5 medium: history unmarked | FIXED: HISTORY banners on rounds 1-3 sections; L14 reworded | headings, L14 |
| R4-6 low: fixture rows | FIXED: main-with-profile client rows in the P1 matrix; "Assumptions A2/A3" | P1, P2 |

## Review round 5

Reviewer: fresh independent, read-only (append-only edit of this section). Checked against origin/dev a30dc212, origin/main 3668f95d, #996 head 5723270596ad and #994 head 462beef8 with `git show`, not against the plan's own claims. The `/plan-eng-review` skill was not invoked as a skill; its dimensions (architecture, data flow, ownership, failure modes, test coverage) were applied by hand against source. Design check done by reading the code (no browser run).

### Round 4 dispositions: verified against source
- R4-1 applied as written, but stale after #996 (see R5-4). On dev, `NEO_REASON` (editor_e2e "TRI59 neotone layout row says why it is disabled...") pins the old sentence. On #996's head, `NEO_REASON` and `#editor-layout-note` are gone: TRI59c asserts `note: false` on both pan types.
- R4-2 verified: U2e2-8 is in `tests/editor_shell.test.js` and asserts `editorSetAnchor(__m,"between").value === __m` on Neotone, so E keeping `editorSetAnchor` inert keeps it green. U2e-6 matches only `/Neotone sets its own placement/`.
- R4-3 replaced by a mechanism built on a false premise (R5-1).
- R4-4 verified: `tests/persist.test.js` boots the same `helpers/sandbox.js` app, so `moveImport(...)` can be called there as SE-R4-1 does. dev `moveImport` carries an unreadable object row opaque.
- R4-5 verified: HISTORY banners on rounds 1-3 and their dispositions; L14 reworded.
- R4-6 verified: P1 matrix has the `main_profile_client_3668f95d` rows; P2 says "Assumptions A2/A3".

### New findings

R5-1 HIGH. The lane base, CI vehicle and release vehicle are `dev`. The editor actually lives on the held main-based stack, and dev carries other unreleased workstreams.
Evidence: #994 (`claude/neotone-mirror-rotate`, base main, head 462beef8) is 117 commits over main and contains `ONE_PANEL`; it is stacked like #992/#988/#985/#982 (U2h "Stacked on held main PR #977"). Dev reaches the dev-only state through `claude/dev-merge-<lane>` PRs (#996 head 57232705 differs from #994's head). `git log origin/main..origin/dev --first-parent --merges` holds 102 merges, including login sync (#900/#906 login-e, #936/#965 login-s), sync-schema-nits #974, print-controls-style #980 and the revert eddd24f3. The login-s dev merge 4eb3d5db is not an ancestor of 462beef8. So "the editor exists only on dev" (Release sequencing, R3-1 reading) is wrong. Repo memory says the opposite: "Lane branches stack on main, not dev ... base lanes on the previous lane head".
Failure scenario: the integrator follows P2/P4/Release sequencing and opens "the one dev-to-main editor release PR". Merging it puts login-sync lanes S/E and every other on-dev lane into main without the owner's go for them. Before that, each lane's "CI-vehicle M" validates dev's tree rather than the lane on the editor stack. The FLOORS rows and README mutant count "from main's CI artifacts" cannot match a dev-based tree's mutant set.
Fix: base E on #994's head (`validate` is currently `failure` at 462beef8, so P0 must require green), A1 on E's head and A2 on A1's head. PR M = the lane branch into main, held and stacked like #994. PR D = `claude/dev-merge-<lane>` into dev. The one release is the editor RC cut from the stack (with U2j), not dev-to-main. Update P0, P2/P4 deliverables, Release sequencing, Recovery wording and the Continuation point ("dispatch lane E from #994's head").

R5-2 HIGH. The editor SAVE path drops `anchor` on a profile, and no lane owns it.
Evidence: `editorCommitOptions(m)` (dev, unchanged on #996) returns `{palette, name?, profile}` for a profile. `editorSave` calls `buildGenerated(formatSeed(m.fields), editorCommitOptions(m))`. Neither A1's nor A2's ownership list names `editorCommitOptions`.
Failure scenarios: (a) after A2, toggle "#1 / #2" on a Neotone scale and SAVE. A record 5 is written with no anchor, and on reload the card is unturned (preview differs from the saved card). P3's e2e "SAVE -> reload -> record 7 round trip" cannot pass within A2's list, so A2 either edits unowned code (the reviewer flags a boundary violation) or ships a toggle that does not persist. (b) Already after A1: open a v9 link. `generateDeck` imports a record 7 and the card draws turned. Then Edit, change one note and SAVE: the record is rewritten as 5 and the user's saved scale silently loses its turn.
Fix: A1 owns `editorCommitOptions` and keeps `anchor` for a profile (the engine canonicalises "one" away, D13). Add an A1 test: v9 link -> Edit -> change one note -> SAVE -> record 7, still turned.

R5-3 MEDIUM. "E leaves the editor inert" is false: editor models already carry `anchor` next to a profile.
Evidence: `editorModelFor(d,"builtin")` sets `anchor` explicitly for every built-in ("between" when note 1 is not at 270; built-in Pygmy's note 1 is at 290). `editorPanType(m,"neotone")` deletes only `seats`/`angles`, keeping `anchor`, `mirror` and `mirrorBottom`. `editorSolve`/`editorExport` pass `m.options` whole. dev `solve` is unaffected today only because it calls `readProfile(profile, {}, source)` and the plain solve with `{}`.
Failure scenario after E merges (before A2): built-in Pygmy -> Edit -> Neotone. The preview is turned, #996 hides every anchor control on Neotone, and SAVE writes an unturned record 5 (R5-2). `editorExport(m).link` also becomes v9, which dev's `buildGenerated` strips until A1 lands. After A2, by D10, any built-in whose Standard layout is "between" converts to a turned Neotone card by default. That changes the default Neotone diagram, an owner-visible consequence the plan never states.
Fix: record these facts under Verified facts. Land E and A1 back-to-back on dev, with the interim stated. Add a P6 item: "built-in Pygmy -> Neotone opens as #1 / #2 (inherits the anchor)". Require E's `solve` to read only `seedOptions.anchor` and keep `readProfile(..., {}, ...)`, because editor models carry `mirror`/`mirrorBottom` next to a profile; passing seed options into `readProfile` would make `editorPanType` from a mirrored Standard model fail with `PROFILE_CONFLICT`.

R5-4 MEDIUM. Post-#996, the plan names a test and an element that will not exist.
Evidence: on #996's head `NEO_REASON` and `#editor-layout-note` are removed, and TRI59c asserts `note: false` for Standard and Neotone. After #996 the only pins of the sentence are `tests/scale.test.js` (E) and U2e-6's regex. Yet E's ownership and acceptance say "plus the `NEO_REASON` e2e test green via CHROME_BIN", and D20 says the note "is kept for the REMAINING buttons". An implementer following D20 would re-add the note and break TRI59c.
Fix: P0 re-verifies this. E's `editor_e2e` hunk becomes "none if `NEO_REASON` is absent at P0". D20 becomes "no layout note; TRI59c's `note: false` stays". E's acceptance is `tests/editor_shell.test.js` plus TRI59c, both green and unedited.

R5-5 LOW. `tests/mutants/i18n_swap_two_keys.patch` removes the whole `const I18N` line. `refresh_mutants.py` anchors on removed lines, so once E edits that line it reports the patch as needing a human. It needs a hand re-pin, as 7ddbfef3/415deabb did. Name it, and the `b_*` and `i18n_region_inside_wrapper` patches that carry the line as context, in E's mutant refresh.

R5-6 LOW. The frozen-client record-7 opaque test is claimed twice: in the P1 matrix (E) and in A1's persist hunk ("shipped-reader opaque fixture"). Its existing home, `tests/storage_corpus.test.js` (`OLD_HTML`/`OLD_HTML_C6` boot), is unowned. Name one lane and one file.

R5-7 LOW (design). On Standard the row mixes two `aria-pressed` toggles with one label-swap toggle. On Neotone (#996) the toggle is the only stateful button among momentary Mirror/rotate buttons, so its `.on` look is the row's only lit state. Acceptable under Q3. Confirm the `.on` and unlit states differ at a 3:1 contrast ratio or better in every palette, and that "#1 CENTRED" fits at 320 px in all 8 languages (panel_fit already gates the fit).

R5-8 LOW. A2's ownership of `tests/editor_e2e.test.js` ("all e2e") does not carry E's `NEO_REASON` exception. This is moot once R5-4 is applied.

### Readiness criteria
1. No open blocker/high: NOT MET (R5-1, R5-2).
2. Assumptions verified/gated/recorded: PARTIAL (R5-3: "E inert in the editor" is false; R5-4: the post-#996 facts are stale).
3. Smallest approach: MET.
4. Phases with prereqs/owner/deliverable/acceptance: PARTIAL (R5-1 base and deliverables; R5-2 ownership; R5-4 acceptance names a removed test).
5. Dependencies verified: PARTIAL (#996 and #994 are OPEN; #994 `validate` is failure at 462beef8; R5-1 base).
6. Verification covers failure cases: PARTIAL (missing: edit-and-save of a turned card, R5-2; built-in pan-type switch default, R5-3).
7. Recovery feasible: MET (reword for stacked lanes per R5-1).
8. Precise continuation point: PARTIAL ("dispatch lane E from dev", R5-1).
9. Unambiguous scope and stop: PARTIAL (a dev-to-main release would ship unrelated workstreams, R5-1).

Verdict: NOT READY. Blockers: none. Highs: R5-1, R5-2. Both are plan and ownership fixes with no redesign of Option B; fix R5-3 and R5-4 in the same pass.

## Round 5 disposition
R5-1 FIXED (lane bases stack on #994; M/D PR mechanism; RC from stack). R5-2 FIXED (A1 owns `editorCommitOptions`, named test). R5-3 FIXED (interim section, Pygmy default, P6 item via owner look). R5-4 FIXED (D20, E acceptance). R5-5/6/7 FIXED (P3b-P5 notes). R5-8 moot.

## Review round 6

Reviewer: fresh independent, read-only (append-only edit of this section). Checked with `git show` against origin/dev a30dc212, origin/main 3668f95d, #994 head 462beef8 and #996 head 5723270596ad, not against the plan's own claims. `/plan-eng-review` dimensions (architecture, data flow, ownership, failure modes, tests) and a design check were applied by hand; the skill itself was not invoked. NOT RUN: CI `validate` conclusion at 462beef8 (`gh run list` returned HTTP 403 rate limit); P0 already gates it.

### Round 5 fixes: verified against source
- R5-1 (lane base): sound. #994 is base main, OPEN, 117 commits over main. It carries `ONE_PANEL`, share v8/record 6 (`INNER_VERSION` 8, `INNER_RECORD_VERSION` 6) and #904 (lane E inner angles). It does NOT carry login sync: #899 login-e 68e120c2, #924 login-s 48eb66e4, RC #912 293cda3e and #998 are not ancestors, and there is no `src/engine/sync.js`. No open main PR is stacked above #994. Applied in Wave 0, Release sequencing and the Continuation point, but NOT in P2/P4, the lane headings, R7 or Recovery (R6-1).
- R5-2: sound. On 462beef8, `editorCommitOptions` returns `{palette, name?, profile}` and has exactly one caller, `editorSave`, which runs `buildGenerated(formatSeed(m.fields), editorCommitOptions(m))`. A1 owning it plus the named test closes the save path. `buildGenerated`'s profile branch still calls `solve({fields, options:{profile: clean}}, {})` and deletes `anchor`, so A1's "pass it into solve" is required as well and is listed.
- R5-3: sound. `editorModelFor(d,"builtin")` sets `anchor`, `editorPanType` keeps it, `editorSolve` passes `m.options` whole, and `solve` calls `readProfile(profile, {}, source)`. The Interim section records this, but P6 has no Pygmy item (R6-4).
- R5-4: sound. 462beef8 has no `NEO_REASON`, no `editor-layout-note`, `note: false` in TRI59c (editor_e2e), 11 `tri59c_*` patches and three `editor-rotate-ccw` sites. U2e2-8 is at `tests/editor_shell.test.js` line 1029 and holds while `editorSetAnchor` is inert on a profile. U2e-6 matches only `/Neotone sets its own placement/`.
- R5-5/R5-6/R5-7: the text is present, but it sits in a P4 note and not in the owning lane's ownership row (R6-2, R6-6).
- `moveImport` opaque-carry (`else if (savedObject(row.r)) items.push({... opaque: row.r })`) IS on 462beef8, so the "add it to A1 if absent" branch is not needed.

### New findings

R6-1 HIGH. P2 and P4 deliverables still describe the dev-based release mechanism that R5-1 retired.
Evidence: P2: "a CI-vehicle PR M ... carries the whole dev delta ... is never merged, and is closed when the lane merges to dev. The only main merge is the one dev-to-main editor release PR." P4: "a CI-vehicle PR M as in P2 (never merged)". Wave 0 (line 224) says the opposite: "PR M = the lane branch into main (held, real CI vehicle ...)", and "the release is the editor release candidate cut from the stack, not a dev-to-main PR". Stale "dev-based" wording also remains in the Lane A1 and A2 headings ("dev-based, after E merges to dev"), in A1's gate test ("on dev (E + A1 ...)"), in R7 ("base on dev after #996") and in Recovery. R5-1 asked for every one of these to be updated.
Failure scenario: a lane or integrator follows the phase deliverable. (a) They close E's M after D merges to dev, so A1's M (stacked on E's head, base main) now carries E's commits with no held PR for E, and the stack the RC is cut from has a hole. (b) They open "the one dev-to-main editor release PR", which ships login sync (#900/#906, #936/#965), sync-schema-nits #974 and the rest of dev's 102 merges without the owner's go. That is exactly the R5-1 scenario.
Fix: rewrite the P2 deliverable as: "PR M = `claude/<lane>` into main, held, stacked on the previous lane's head, never closed and merged only by the editor RC; PR D = `claude/dev-merge-<lane>` into dev". In P4 write "as in P2". Delete "dev-based" from the A1/A2 headings (base = previous lane head). In A1's gate test write "on A1's tree". In R7 write "base on #994's head". In Recovery, say a pre-release revert is a revert commit at the stack tip plus `claude/dev-revert-<lane>` on dev.

R6-2 MEDIUM. The R5-5 and R5-6 ownership grants are not in the ownership rows, and A1's row still claims the frozen-client test.
Evidence: E's ownership list (Lane E) names neither `tests/storage_corpus.test.js` nor `i18n_swap_two_keys.patch`, `b_*` or `i18n_region_inside_wrapper`. Those appear only in a note under "P4 Lanes A1, A2". Lane A1's row still lists "shipped-reader opaque fixture" among its persist hunks. P5 says the reviewer brief quotes "ownership" verbatim.
Failure scenario: E's reviewer, briefed with the Lane E row, flags E's `storage_corpus.test.js` hunk as a boundary violation and FAILs it. Or A1 also writes the shipped-reader opaque test and the two lanes collide (the R5-6 double claim survives).
Fix: move both grants into the Lane E row, and delete "shipped-reader opaque fixture" from the A1 row.

R6-3 MEDIUM. Nothing stops the RC from being cut part-way up this plan's stack.
Evidence: Release sequencing says "the editor RC is cut from the stack" and that between E and A1 the editor is half-wired. The R5-3 interim is real: after E alone, built-in Pygmy -> Neotone previews turned, but `editorCommitOptions` saves an unturned record 5. The plan never says where the RC may be cut if the owner asks for a release while E or A1 is stacked but A2 is not.
Failure scenario: the owner asks to release the editor while E (or E + A1) is the stack tip. A merge-commit release of that tip puts on main a Pygmy Neotone preview that differs from its saved card, with no UI to change it (#996 hides the anchor controls on Neotone).
Fix: one line in Release sequencing: "the RC cut point is #994's head or A2's head, never E's or A1's".

R6-4 LOW. The Interim section says the Pygmy-default look is "an owner look item in P6", but P6 lists only items (1) to (5). Add item (6): "built-in Pygmy -> Neotone opens as #1 / #2 (turned) by default".

R6-5 LOW. FLOORS rows and the README mutant count are "set from main's CI artifacts" (Lanes, P4). For stacked lanes, main's run is 117 commits behind and has none of the stack's mutants. Write "from the lane's own PR M `validate` run artifacts (by_module / files[].total)". A wrong count would turn readme-currency red, so CI catches it rather than letting it pass silently.

R6-6 LOW (design). The R5-7 contrast check ("lit/unlit states differ at 3:1 in every palette") has no owner and no mechanism. `tools/probe/panel_fit.js` measures fit, not contrast, and no lane owns `tools/probe/`. Make it an A2 e2e assertion in `tests/editor_e2e.test.js` that computes the contrast ratio of the computed colours of `.on` against unlit, per palette.

R6-7 LOW. P0 asserts the `tri59c_*` patches "exist on dev", but E branches from #994's head. Check them at the base (all 11 are present at 462beef8 today) as well as on dev after #996.

### Readiness criteria
1. No open blocker/high: NOT MET (R6-1).
2. Assumptions verified/gated/recorded: MET (R5-3 facts recorded; opaque-carry verified on the stack).
3. Smallest approach: MET.
4. Phases with prereqs/owner/deliverable/acceptance: PARTIAL (R6-1 deliverables contradict Wave 0; R6-2 ownership rows).
5. Dependencies verified: PARTIAL (#994 and #996 OPEN; #994 `validate` not read this round because of the 403, so P0 gates it; the stack has been verified free of login sync).
6. Verification covers failure cases: MET (R6-6 is cosmetic).
7. Recovery feasible: MET in substance; the wording needs R6-1's stack revert.
8. Precise continuation point: MET ("dispatch lane E from #994's head").
9. Unambiguous scope and stop: PARTIAL (P2's "dev-to-main release PR" contradicts the single-RC scope, R6-1; RC cut point, R6-3).

Verdict: NOT READY. Blockers: none. High: R6-1, a text fix only: carry R5-1 into P2, P4, the A1/A2 headings, R7 and Recovery. Fix R6-2 and R6-3 in the same pass. Option B and D1-D21 hold against source.

## Round 6 disposition
R6-1 FIXED (P2/P4 deliverables, A1/A2 headings, R7, Recovery, A1 gate test now describe the stacked mechanism: M = lane branch into main, held, never closed; D = `claude/dev-merge-<lane>`; no dev-to-main PR). R6-2 FIXED (storage_corpus hunk and the i18n/b_* patch grants moved into Lane E's row; A1 row drops the opaque test). R6-3 FIXED (RC cut point line in Release sequencing). R6-4 FIXED (P6 item 6). R6-5 FIXED (FLOORS from the lane's own M run). R6-6 FIXED (A2 e2e contrast assertion). R6-7 FIXED (P0 checks patches at the base). Text-only fixes; no design change. Not re-reviewed: the owner's 'fix and re-review once' allowance was spent on round 6.

## Review round 7

Reviewer: fresh independent, read-only confirm pass (append-only edit of this section). Scope: whether R6-1..R6-7 landed in the plan body, plus any new contradiction the edits introduced. Plan text only; no source, CI or gh state re-checked this round (round 6 did that; P0 gates #994's `validate`).

### Round 6 fixes: verified in the plan body
- R6-1 FIXED in substance. P2 deliverable now reads "PR M = `claude/<lane>` into main, held, stacked on the previous lane's head (E: #994's head), never closed, merged only by the editor RC; PR D = `claude/dev-merge-<lane>` into dev ... No dev-to-main PR exists." P4 says "as in P2". The A1/A2 headings say "based on E's head" / "based on A1's head". R7 says "base on #994's head". Recovery names a revert commit at the stack tip plus `claude/dev-revert-<lane>`. A grep for "dev-based", "dev-to-main", "never merged", "closed when the lane merges", "base on dev", "main's CI artifacts" finds hits only in Wave 0's "replaces every earlier" note, P2's "No dev-to-main PR exists" and the history sections (Round 1-6 findings and dispositions). One site the R6-1 fix named was missed, see R7-1.
- R6-2 FIXED. Lane E's row owns `tests/storage_corpus.test.js` (frozen-client record 7 opaque test only) and the `i18n_swap_two_keys`, `b_*` and `i18n_region_inside_wrapper` patches. Lane A1's row says "the shipped-reader opaque test is Lane E's" and no longer claims it.
- R6-3 FIXED. Release sequencing: the RC is cut at #994's head or A2's head, never at E's or A1's.
- R6-4 FIXED. P6 item (6): built-in Pygmy -> Neotone opens as #1 / #2 (turned).
- R6-5 FIXED. The Lanes "Common to A1 and A2" paragraph (which also covers E) and P4 take FLOORS and README counts from the lane's own PR M `validate` run artifacts.
- R6-6 FIXED. A P4 note puts the 3:1 lit/unlit contrast check in an A2 assertion in `tests/editor_e2e.test.js`, a file A2 owns.
- R6-7 FIXED. P0 checks the `tri59c_*` patches at the #994 base commit and on dev after #996.

### New findings (none blocking)
R7-1 LOW. The A1 gate test still says "decoded and rendered on dev (E + A1, no toggle yet)" (Lane A1 row, "Test that gates A1's merge"). Round 6 asked for "on A1's tree" here, and the Round 6 disposition says this was fixed, but it was not. There is no failure scenario of the R6-1 kind: CI on A1's M runs A1's tree anyway. Still, a gate for D's merge that runs "on dev" can only run after D has merged. Replace "on dev" with "on A1's tree (PR M CI)".
R7-2 LOW. Leftover wording that is ambiguous but not contradictory: (a) Lane E row, "valid and unedited after E merges": E's M never merges by itself, so read this as "after E's D merges to dev". (b) L17 "as dev waves", which should say "as stacked waves". (c) Recovery after the release, "a revert of A2 on dev and a follow-up release". This should say the follow-up release is a main-based revert PR (gated by the owner) plus `claude/dev-revert-A2`, not a dev-to-main release.
No new contradiction between the edited sections. Wave 0, P2, P4, P5 (D merges on green `validate` on M), Release sequencing, the RC cut point, Recovery and the Continuation point all agree on the same stacked M/D mechanism.

### Readiness criteria
1. No open blocker/high: MET.
2. Assumptions verified/gated/recorded: MET.
3. Smallest approach: MET.
4. Phases with prereqs/owner/deliverable/acceptance: MET (R7-1 is wording).
5. Dependencies verified: GATED at P0 (#994 green `validate`, #996 on dev).
6. Verification covers failure cases: MET.
7. Recovery feasible: MET (R7-2c is wording).
8. Precise continuation point: MET.
9. Unambiguous scope and stop: MET.

Verdict: READY. Blockers: none. Highs: none. R7-1 and R7-2 are LOW text fixes that can go in with lane E's first commit or in the reviewer brief.


pending-linear-writes: []


## Fresh confirmation receipt (2026-11-09)

Independent bounded confirmation at pre-nit SHA256
`97f9659248b13dc371aca0a4c77dc2759b6ca97a7c099964c9b535a9666ac223`: READY_WITH_NITS.
All five engineering/design corrections were verified. One LOW wording inconsistency remained in the
proposed ENGINE-SPEC renderer sentence; it now explicitly distinguishes mutant fixture rotation from
no-mutant effective placements, matching the operative acceptance. No requirements or architecture
changed in this disposition. Reviews applied installed workflow contracts read-only; no native Claude
slash-command, Opus invocation, rendered UI or future runtime test success is claimed. All manual-QA,
P0/D1, exact-head CI/review, full mutation and main-release approval gates remain outstanding.
