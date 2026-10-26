# Built-in palette choices — proposed implementation plan

**Independently ENG/design-reviewed plan; queued behind existing active workstreams.**
Implementation, the exact CLAUDE.md patch and main release remain held. Produced from
accepted prompt V2 (instruction-body SHA
`f1c2f461221c395bcf0ed8650c33c47e02401fd232ce10fe50d65adc90be0a10`).
The prompt was independently engineering/design-critiqued, then executed. This
output completed separate independent ENG/design review and revision as recorded
below. No feature tests, browsers or compatibility
experiments were run during planning.

## Decision and sequencing

Recommend a small append-only feature: retain the existing six palette entries
and default0, append the two missing built-in pairs and their role swaps, expose
ten actual44px choices in a stable five-column/two-row grid, and extend v6's
palette option without changing its existing valid encodings. Keep v1–v5's
historical palette bounds, stored-record version4 and the collection schema.
Validate old-client refusal/data preservation explicitly; do not silently map an
unsupported choice to another color.

This is queued after saved-scale variants, Handpan Helpers and the approved
Scale↔Layout swipe work. Next-main-release targeting is conditional on the
existing queue and all quality gates; it does not authorize implementation,
change release ordering, resume paused work or grant main-merge consent. Root
retains the shared ledger and publication ownership.

Implementation activation requires approval of this reviewed scope and the exact
CLAUDE packet below. Resolve the actual delivered DEV base and current worktree
ownership then; do not start from a partial active-feature branch merely because
this research checkout contains it. Original dirty/locked worktrees stay intact.

## Exact requirement and append table

Add choices, not new initial selections. The default palette remains index0;
DEFAULT_DECK/picker order, stored selections, instrument geometry, note grammar,
chord inventory, built-in data and physical MIRROR behavior remain unchanged.
'Inverse' swaps root/tone roles, with `ga=root` and `gb=tone`; it is neither RGB
inversion nor musical inversion.

| Index | UI label/token | Root | Tone | Meaning |
|---|---|---|---|---|
|0|Palette1 / omitted|`#E0559A`|`#E2761B`|existing Hijaz|
|1|Palette2 / palette-2|`#6D40A3`|`#C9971E`|existing Pygmy|
|2|Palette3 / palette-3|`#0B7B75`|`#DD8F00`|existing Amara9|
|3|Palette4 / palette-4|`#E2761B`|`#E0559A`|existing Hijaz swapped|
|4|Palette5 / palette-5|`#C9971E`|`#6D40A3`|existing Pygmy swapped|
|5|Palette6 / palette-6|`#DD8F00`|`#0B7B75`|existing Amara9 swapped|
|6|Palette7 / palette-7|`#2563B0`|`#C0452C`|new Kurd10 normal|
|7|Palette8 / palette-8|`#3B7A2A`|`#B3263A`|new Amara10 normal|
|8|Palette9 / palette-9|`#C0452C`|`#2563B0`|new Kurd10 swapped|
|9|Palette10 / palette-10|`#B3263A`|`#3B7A2A`|new Amara10 swapped|

This append order preserves the old prefix and gives the new block its existing
normal-pairs-then-swaps pattern. Adjacent normal/inverse additions would also be
technically feasible, but do not justify an additional ordering convention here.
Keep `sheet.palette_n` and numbered labels in all eight languages; no translation
key, color-name taxonomy or new public API is needed.

## Evidence and uncertainties

Inspected baseline: `0d36b1f4ace31dd5f8978f2ed51741fe78049c36`; planning tree
`/private/tmp/handpan-palette-defaults-plan.20261026`, branch
`codex/palette-defaults-plan-20261026`. Source locations below identify symbols;
line numbers/active refs must be refreshed before implementation.

| Finding | Evidence | Status / implication |
|---|---|---|
| Existing six pairs/order and output roles | `src/engine/select.js` PALETTES/build; ENGINE-SPEC§13 | Verified; append only. No select dependency may be introduced into earlier-loaded core. |
| New normal pairs already canonical | `data/decks.json` kurd/amara10 colors; CLAUDE Design system | Verified; reuse exact values, do not edit canonical decks/print overlays. |
| Extending the set is already append-only policy | ENGINE-SPEC§13; SCALE_ENGINE_PLAN D6 | Verified; a new wire version is not inherently mandated by adding stable indices. |
| Core and CLI independently reject index6+ | `core.readOptions`; `tools/gen_deck.js` numeric palette bound0…5 | Verified; registry-only edits cannot work. |
| Readable parser accepts tokens2…6 only | `share.PALETTE_RE`, encode, decodeReadable/OPTION_ORDER | Verified; token10 needs a two-digit canonical spelling. |
| Check/version/legacy paths are coupled | `share.decodeSeed`, readOptionsLine, scaleLineReader | Verified: FNV-1a/top24 readable check; packed versions eventually use current core validation. Guard old-version bounds deliberately. |
| Default remains0; seeded Edit infers exact color pair | core.DEFAULT_OPTIONS; sheet initialization/seedPalette | Verified; Kurd/Amara10 newly infer6/7 rather than fallback0. This changes their Edit preview intentionally. |
| Built-in URLs use existing routes | app routeInfo/routeFor/copyLink | Verified; adding Edit choices does not require rewriting built-in `#deck=` links. |
| Saved meaning includes numeric palette | scaleRecord/recordOptions/readSavedRecord/savedMeaning/stageSavedEnvelope | Verified path; new mixed-client/slot behavior and rollback execution remain untested. |
| Ten current flex children are unsafe to assume usable | `#scale-swatches` flex/no-wrap; `.dot`44px; buildSwatches | Source-verified risk: flex can shrink; no new layout measurement has run. |
| Old six-count contracts occur across tests/instructions | app swatch/SPB groups; native anatomy/targets/tab/lip; CLI/share/core/select tests; CLAUDE palette paragraph | Verified inventory; update only genuinely changed expectations and corresponding generated faults. |
| Palette roles reach SVG and PDF | app render/paintPan; select.build; pdfcards; tools/decks generated adapter | Verified consumption; unchanged old output/new color correctness need actual tests. |

Read AGENTS.md, tests/CONTRACT.md, docs/testing/browser.md and
`docs/agents/workflows.md` at activation. Their shared swarm/review/frontend
requirements inform this plan; no global skill/runtime has been activated and
no outside-provider or browser/design execution is claimed. Preserve accepted
Helpers line-count/font-readiness amendments when rebasing; historical old
six-choice test outcomes are not validation of this feature.

## Protocol and persistence decision

Choose current-wire append as the smallest design that keeps every existing valid
URL byte/checksum stable and follows D6. The writer remains v6. Broaden only v6's
readable palette grammar to canonical decimal2…10; no palette-1, leading zeros,
empty/sign/fraction/duplicate/out-of-order options. Core/CLI accept integer0…9.
The readable reader must retain the v5 palette ceiling5, and packed v1–v4 must
reject an options palette above5 before the widened core parser. Do not widen old
protocol versions accidentally by changing a shared bound.

This intentionally adds meanings to previously unsupported v6 palette7…10 inputs;
it does not reinterpret an existing valid link. Current v1–v5 refusal behavior
stays pinned. Unknown future versions remain NEEDS_NEWER_APP, and invalid syntax,
checksum, option ordering and cap behavior stay unchanged. Preserve pinned valid
v1–v6 corpus bytes and decoded seed/options. Do not change record version merely
because an option range expands; record4's numeric palette shape is unchanged.

| Writer/input → reader | Required behavior / verification |
|---|---|
| Existing valid v1–v6, index0…5 → new | Same decoded fields/options/colors; old v6 encoder bytes/checksums unchanged. |
| Current v6, indices6…9 → new | Exact token7…10, exact option/color round trip, deterministic save/reload/reshare. |
| New palette link → old v6 build | Existing old reader returns BAD_NOTE; app remains usable and does not import/replace a scale. Reloading the updated app can read it. |
| New v6 palette link → a shipped v1–v5 reader | NEEDS_NEWER_APP from its existing version gate; distinguish this from the old v6 BAD_NOTE result. |
| Valid-check packed v1–v4 with index6 → new | Preserve exact core rejection: BAD_NOTE naming numeric value `6`; the new legacy bound must not substitute the whole link as the reason payload. |
| Valid-check readable v5 with token palette-7 → new | Preserve BAD_NOTE naming the whole input link (including its existing truncation convention), not numeric `6`; retain its reader-layer grammar refusal. |
| Existing unsupported v6 palette7…10 → new | Now intentionally supported; document the grammar extension separately from preservation of valid old meanings. |
| Explicit palette-0/palette-1 tokens, palette-01/-07/-010,11+, negative/fraction, repeats/reordered options, wrong check or overcap → new | Same structural/cap rejection contract, no clamping/normalization to another palette. |
| Future version → new | NEEDS_NEWER_APP, no import or data mutation. |

The old-reader BAD_NOTE message is a known forward-compatibility limitation,
not a demonstrated regression of an old valid link. Include this limitation in
implementation/release approval and QA. A blanket v7 write bump would churn all
old canonical URLs without making old clients render the new pairs; selective-v7
writing adds a second canonical/version policy. Neither is justified now. If
independent review or a product requirement requires polite version-specific
refusal for these new choices, stop and re-review a selective-new-wire alternative
before implementation; do not quietly widen scope halfway through coding.

Pin exact error code **and reason/payload**, not just failure, against the frozen
pre-change reader for legacy fixtures. Construct otherwise-valid payloads and
checksums so each intended palette guard is reached. Add distinct tampered-check,
over-cap and future-version cases to retain gate precedence: cap/length precedes
version, version precedes integrity, integrity precedes payload/option validation.
Keep the existing input truncation/error formatting; do not invent a new error.

Keep numeric palette identity in saved meanings and records. At implementation
activation, pin the old-client fixture to the **immediately preceding delivered
variants-compatible build**, recording its immutable commit, served app SHA and
actual persistence backend. In a controlled same-origin old/new two-tab fixture,
prove that specific older build retains unreadable raw new-palette rows and cannot
silently recolor/delete them. A pre-variants localStorage client is a separate
legacy fixture with separate expectations from a variants-compatible IndexedDB
client; v6 wire support does not identify the storage protocol. Do not substitute
one fixture for the other or claim all v6 builds share a backend. Check custom opaque
rows, a new-palette seeded-slot owner, preferred selection, unrelated old-palette
edits, remote reconciliation and dirty drafts. The source can skip unreadable
custom views and protect an unreadable slot owner; these are hypotheses for the
specific new records until exercised, not completed compatibility proof. Old
clients may need reload; unsafe downgrade/loss is not permitted.

No bulk record migration, new storage backend, envelope rewrite, raw color URL or
palette remapping is planned. Reuse current raw/opaque/conflict protections.
Preserve DEFAULT_DECK, default palette0 and old custom record bytes when unchanged.

## UI and seeded Edit recommendation

Use the existing picker and dot styles with a stable five-column/two-row grid:
logical DOM order0…9, five44px tracks, zero gap, 44px target height, original14px
visual dots and selected ring. Change only the palette group's scoped layout;
no typography/color-value shrink or new component. Five tracks need220px, less
than the old six44px targets'264px; actual container/footers still require proof.
The first row contains indices0…4, the second5…9; do not reorder old indices for
visual grouping. Retain existing numbered accessible names and aria-pressed.

Natural wrapping is the fallback design if a supported controls column cannot
provide220px or the fixed grid causes a fit regression. It must keep actual44px
buttons and stable DOM/Tab order; return to design review before substituting it.
Do not accept nominal width on a flex-shrunk button. Intentional second-row
content growth must remain inside the existing scrollable Layout surface, with
no footer/lip overlap, inaccessible primary/DELETE/RESET or outer-page overflow.
A measured additional row is not an invented fit allowance or test waiver.

All ten choices remain usable for empty/invalid scales even while drawer controls
are disabled. Preserve the existing `resetSheetState`/close contract; palette
drafts and committed practice/storage selection are different state:

| Transition | Required palette/selection result |
|---|---|
| Switch Scale ↔ Layout in the same sheet | Retain the unsaved draft palette; no persistence or practice-selection change. |
| Explicit Cancel or close without Generate/Save | Discard the unsaved palette draft; committed practice selection and stored palette remain unchanged. No new global palette default. |
| Reopen Add | Fresh palette0, regardless of the discarded previous draft. |
| Reopen Edit | Derive from the selected saved record’s committed options, or the built-in’s exact matching colors (Kurd6/Amara10 7); never reuse a discarded draft. |
| Successful Generate/Save | Commit the chosen palette under the existing Add/Edit ownership and persistence contract; reload/share reproduce it. |
| Save conflict/failure | Preserve the draft under the existing conflict/recovery contract; this is separate from an explicit Cancel/close. |

Test each transition, including no-op Edit SAVE and close, without changing
existing close or conflict behavior. Actual Tab/Shift+Tab visits all ten once;
the last-swatch lip fallback becomes index9/Palette10. Review focus after native
activation because buildSwatches replaces nodes; classify any old focus defect
before deciding whether a narrow prerequisite repair belongs in this feature.

Opening seeded Kurd/Amara10 Edit should select6/7 and show their original colors;
opening the other built-ins selects their unchanged existing index. Unchanged
SAVE/close must not unexpectedly create a saved replacement, alter data or recolor
practice cards. A real edit retains explicit seeded-slot ownership and the chosen
palette; inverse selection changes only root/tone/ga/gb. Existing built-in routes,
notes, chords, layouts and PDFs remain unchanged.

## File-owned swarm and stages

Root is sole integrator, generated-index writer after handoffs, ledger owner and
host-browser operator. All editor lanes use separate worktrees. Independent ENG
and design reviewers author none of the implementation being reviewed.

| Lane | Owned files / deliverables | Dependency / boundary |
|---|---|---|
| T1 engine/CLI tests | tests/core.test.js, select.test.js, share.test.js, test_gen_deck.py; literal palette/old-link/version boundaries | Requirements/spec frozen first; no app source. |
| T2 UI/storage/print acceptance | tests/app.test.js, e2e.test.js and focused PDF parity tests/fixtures where genuinely necessary | Literal10choices, native targets/tab/lip and saved client matrix; no T1 file overlap. Root serializes any common fixture/floor work. |
| E engine/protocol/CLI | src/engine/select.js, core.js, share.js; tools/gen_deck.js | T1 intended RED; preserve index0…5 and old-version guards; no generated index edits. |
| U UI | index.html scoped picker CSS/app changes outside generated blocks | T2 intended RED; separate from E. Root waits for U handoff before inline synchronization. No deck-data change. |
| M proof | tests/mutants scoped generated patches in committed scratch | Frozen passing candidate/tests; all old fault identities retained. |
| Root docs/integration | ENGINE-SPEC, relevant active decision docs/README CLI wording, approved CLAUDE packet, actual floor/fixture deltas, generated index sync and ledger | Single-writer ownership; exact CLAUDE approval first; no historical blanket rewriting. |
| Independent ENG/design | Plan/candidate read-only findings and proof/coverage audit | Material findings fixed and re-reviewed, not self-review credit. |

A. **Activation and approval.** Finish/resolve preceding active streams, read fresh
DEV and ledger, confirm scopes and exact proposed instruction patch. Deliver
frozen base/ref/owners and a compact validation manifest. Stop on unexpected dirty
files, conflicting work or changed requirements. Approval does not include main.

B. **Spec-first RED.** T1 pins old six palette pairs/default0/link bytes, literal
new pairs and boundaries; T2 pins ten-choice/seeded/no-op/record/print/native
requirements. Establish intended failures on the old six-choice source, preserving
raw source/test pins. No setup/skip/timeout credit. Source remains unchanged until
acceptance criteria are agreed and plan ENG/design reviews are clear.

C. **Minimal implementation.** E appends table, core/CLI range and version-scoped
share grammar; U implements the small grid. Root serially runs the inspected
existing engine sync after E/U handoffs, then its check/deck-data checks. No
hand-edited inline engine or canonical data. Same RED tests must now pass. Stop
if current-wire compatibility, grid usability or seeded/no-op behavior contradicts
the plan; re-review the smallest amendment before proceeding.

D. **Fault proofs and final review.** M generates faults for changed/new groups:
wrong new pair/role swap, old-prefix/default corruption, palette10 parse failure,
legacy-version range leak, record loss/default substitution, missing/shrunk or
clipped tenth target, tab/lip truncation and output color mismatch. Run each exact
header clean→fault→restored with intended assertions and actual selected counts.
Refresh stale contexts/required count metadata without changing old protection.
Raise only observed per-file floors; no dropped IDs or broad fixture regeneration.
Independent ENG/design review exact frozen source/test/fault commits and raw proof.

E. **Delivery and owner QA.** Full exact-head Linux validate, all mutation shards
and required artifacts pass; rebase/retest if preceding DEV changes intervene.
Integrate DEV only after independent review, verify served revision/bytes and
actual affected journeys, then notify owner with the QA steps below. Main remains
held until explicit consent and the agreed release queue permits it.

Every stage checkpoint records plan/ref/worktree, lane ownership, last completed
and next action, decisions/blockers, proof locations and release disposition in
root's ledger/existing recovery thread. Do not leave continuity only in a worker's
uncommitted files or temporary evidence. Preserve old failed outcomes and context.

## Verification matrix and observable acceptance

Freeze exact selectors/counts from the activated branch, rather than inventing a
future test count. Read existing commands before using them. The relevant families
include core options, select's spec palette table, share pinned/version/refusal
cases, CLI palette usage, app six-swatch/SPB/seeded Edit, native44px/tab/lip/844
controls-column, sheet fit/localization and browser/Python PDF checks.

| Area | Required positive / negative evidence |
|---|---|
| Registry/default | Literal complete ten-entry table; old prefix unchanged; default0; bounds -1/fraction/nonnumber/10+ rejected; all four new entries build correct root/tone/ga/gb. |
| Protocol | Truth-table cases above; exact legacy BAD_NOTE code/reason payload and cap→version→integrity→payload gate precedence; exact old wire pins/checksums; token10 canonical roundtrip, unknown/duplicate/order/cap/tamper and old-version guard faults. |
| Storage | Save/reload/import/export/reshare new options; old palette rows unchanged; old/new tabs and raw opaque/slot/draft protection; distinct palette variants coexist and identical meaning deduplicates per accepted variants contract. |
| Seeded behavior | Explicit draft/committed state-transition table above, including tab retention, canceled draft discard, fresh Add0 and reopened Edit from committed state; all five Edit openings map correct palette; no-op SAVE and cancel preserve original data/selection; changed Kurd/Amara10 and inverse retain chosen colors and explicit replacement ownership. |
| UI | Actual44×44 targets/hits and original14px dots, ten complete numbered names/one pressed state, no overlap/clipping/focus loss, full forward/reverse keyboard and lip handoff; empty/invalid input does not disable palette. |
| Responsive/locales |320×568,380×780,844×390, representative desktop/short-height and actual CSSOM boundaries; Add/Edit and folded/open footer/drawer; real/fallback fonts and eight resolved locales. Preserve unchanged fit budgets and use accepted text-node line oracle/current-font readiness, not old container artifacts. |
| Rendering/print | Same notes/chords/fields/ids across palettes; colors only change as specified. Old built-in data/hash and PDF output unchanged; generated new colors correct in SVG and custom PDF. Do not alter overlay/footer geometry. |
| Delivery | Independent addressed reviews; complete exact-head CI with no skips/floors lowered; actual served DEV source and journeys, noindex/analytics contracts; owner QA and separate main consent. |

Plan execution has run none of these feature checks. If required real-font/device
coverage is absent, record unverified coverage; headless Chromium is not physical
Safari, screenreader or touch-device evidence. Keep any broader Mac-suite limit
separate; do not increase timeouts, retry to green or spend unrelated full-storage
performance budgets without a change-specific reason.

Owner DEV QA after delivery: open Add→Layout and find ten choices/default1; choose
7–10 one at a time and Generate, inspect root versus other-tone colors, reload and
open copied links; verify old saved palette choices unchanged; Edit Kurd10 and
Amara10 without a color change and confirm no accidental recolor/replacement;
try their swapped choices; Tab both directions through all ten and test the shut
lip's last-choice handoff; inspect320phone and844landscape targets/scroll/footer.
Supply an exact failing link, locale, device and steps if anything differs. The
technical color/link/storage/print matrices remain automated/reviewer obligations.

## Proposed instruction/specification packet — not applied

Only the CLAUDE palette paragraph's six-count/sixth-stop descriptions and quoted
affected test title require the factual patch below. Existing design-system color
values already include Kurd/Amara10; all other instructions remain untouched.
This is a proposed exact patch against inspected baseline0d36, not permission to
apply it. If the target paragraph or meaning changes before activation, regenerate
the exact packet and obtain explicit approval as required. ENGINE-SPEC§1/§11
bounds, §13 ten-row table and §14 version-specific palette ranges also need a
reviewed factual update; preserve historical old-version grammar documentation.
SCALE_ENGINE_PLAN D6 keeps the old decision history with a dated append amendment,
not a rewrite of past decisions. No duplicated agent instructions or global skill
changes are proposed.

```diff
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -465 +465 @@
-- **The card palette is the last group of the Layout tab, labelled, and enabled without a scale** (sheet polish lane B, 2026-10-21). `#scale-swatches` is the last child of `#scale-panel-layout`, after `#scale-layout-zone`, in an `.editrow` whose `span#scale-palette-label` (CARD PALETTE) names the group through `aria-labelledby` ("SPB: #scale-swatches is the last child of #scale-panel-layout after #scale-layout-zone, in an .editrow whose span.sheetlabel#scale-palette-label (text CARD PALETTE) names the group through aria-labelledby"). The six swatches never read `boxOk`, so they stay enabled with an empty or invalid scale while every drawer control is disabled ("SPB: the swatches stay enabled on the Layout tab with an empty or invalid scale while every drawer control is disabled"). The Scale tab's Tab stops end box, primary, DELETE with no swatch, and the Layout tab's run is RESET LAYOUT, the six swatches, primary, DELETE ("SPB: the Scale tab's Tab stops end box, primary, DELETE with no swatch; the Layout tab's run RESET LAYOUT, the six swatches, primary, DELETE, forward and back, on create and Edit"). A swatch picked on the Layout tab survives a switch to Scale and back and is the palette GENERATE CARDS saves ("SPB: at 380x780 a swatch picked on the Layout tab survives a switch to Scale and back and is the palette GENERATE CARDS saves"). Tab onto the lip hands off to GENERATE CARDS, else DELETE on Edit, else the shown tab's last stop: the sixth swatch on Layout, the scale box on Scale ("UX: Tab onto the lip restores the footer and focuses GENERATE CARDS, DELETE when GENERATE is disabled on Edit, else the shown tab's last stop"). At 844x390 the palette row sits in the controls column (no test; true by the `#scale-sheet[data-tab="layout"] #scale-panel-layout > .editrow` rule in `index.html`).
+- **The card palette is the last group of the Layout tab, labelled, and enabled without a scale** (sheet polish lane B, 2026-10-21). `#scale-swatches` is the last child of `#scale-panel-layout`, after `#scale-layout-zone`, in an `.editrow` whose `span#scale-palette-label` (CARD PALETTE) names the group through `aria-labelledby` ("SPB: #scale-swatches is the last child of #scale-panel-layout after #scale-layout-zone, in an .editrow whose span.sheetlabel#scale-palette-label (text CARD PALETTE) names the group through aria-labelledby"). The ten swatches never read `boxOk`, so they stay enabled with an empty or invalid scale while every drawer control is disabled ("SPB: the swatches stay enabled on the Layout tab with an empty or invalid scale while every drawer control is disabled"). The Scale tab's Tab stops end box, primary, DELETE with no swatch, and the Layout tab's run is RESET LAYOUT, the ten swatches, primary, DELETE ("SPB: the Scale tab's Tab stops end box, primary, DELETE with no swatch; the Layout tab's run RESET LAYOUT, the ten swatches, primary, DELETE, forward and back, on create and Edit"). A swatch picked on the Layout tab survives a switch to Scale and back and is the palette GENERATE CARDS saves ("SPB: at 380x780 a swatch picked on the Layout tab survives a switch to Scale and back and is the palette GENERATE CARDS saves"). Tab onto the lip hands off to GENERATE CARDS, else DELETE on Edit, else the shown tab's last stop: the tenth swatch on Layout, the scale box on Scale ("UX: Tab onto the lip restores the footer and focuses GENERATE CARDS, DELETE when GENERATE is disabled on Edit, else the shown tab's last stop"). At 844x390 the palette row sits in the controls column (no test; true by the `#scale-sheet[data-tab="layout"] #scale-panel-layout > .editrow` rule in `index.html`).
```

## Recovery, limits and review disposition

Before deployment, reversible owned commits can be corrected/reverted in isolated
worktrees without resetting others. Once indices6…9 have been saved, a blind
rollback to a six-only app can make those rows unreadable or protect a seeded-slot
collection. Therefore post-release recovery defaults to a compatible forward fix
that retains the appended palette/reader support and all raw records; test that
recovery path before release. A reader-preserving UI rollback, if necessary, needs
its own reviewed/tested patch; do not invent an untested universal git-revert
runbook, delete new records or silently substitute palette0. Owner controls any
production/main change. This limitation is part of release approval, not hidden.

Current decision: **conditional feasibility, implementation held**. The code path
is small and append-only policy supports it, but wire/persistence compatibility,
actual grid fit, native behavior and quality outcomes are not yet validated.
Required remaining approvals are reviewed implementation scope/exact CLAUDE packet
and later explicit main merge; no additional naming preference is needed now.

Author adversarial review (self-review, not independent):

| Challenge | Plan response / remaining stop |
|---|---|
| Fast 'four constants' patch skips validators | Core/readable/packed/CLI/storage/UI/print paths have explicit owners/tests. |
| All-six URLs churn from unnecessary v7 | Retain v6 encodings; compare actual old valid pins; re-review only if an explicit version-refusal requirement emerges. |
| Shared parser makes old v1–v5 accept new palettes | Version-scoped guards and valid-check malformed legacy cases required. |
| Ten swatches merely shrink | Fixed five44px tracks; real target/text/hit/scroll proof; natural-wrap fallback requires re-review. |
| Seeded no-op saves silently recolor/replace | Intentional6/7 Edit inference and no-op/cancel/slot cases required. |
| Old tabs or rollback destroy new rows | Controlled old/new fixture and raw/slot protection; compatible forward recovery, no blind downgrade. |
| Tests mirror the registry or discard old faults | Literal spec/data expectations, generated exact-header faults, complete old ID retention and current counts. |
| Deadline skips independent review or main consent | Reviewed plan and exact-head independent final/CI/DEV/owner gates stay mandatory. |

Output-plan review receipt and revisions (evidence-qualified):

- Independent DESIGN review of draft `50c7932d7411ae4ded26dfa7950040405851f3b2bde5f145ab11c1e76a256da4`
  found a material ambiguity: “persists across sheet close/cancel” conflicted with
  `resetSheetState` and the draft/committed distinction. **Author revision:** the
  explicit transition table above replaces it; Cancel/close discards unsaved
  palette, Add reopens0, Edit reopens committed/matching palette. Existing
  conflict draft preservation remains separate. Self-review missed this in v1;
  this receipt does not relabel that omission as an author-discovered finding.
- Independent ENG cleared the minimal-v6 wire recommendation with its disclosed
  old-v6 BAD_NOTE limitation; this is a release approval item, not a new owner
  preference interview. Its P2 precision follow-up requires exact legacy error
  payload/gate precedence and an activation-pinned variants-compatible old-client
  fixture. **Author revision:** both are now explicit above; localStorage and
  IndexedDB generations are separate fixtures, not inferred from wire version.
- Root reported read-only extraction of the exact proposed CLAUDE packet and
  `git apply --check --unidiff-zero` against unchanged planning base `0d36`: exit0,
  empty stderr. This is static packet applicability only; no file was applied,
  CLAUDE.md was not changed, and no feature behavior was validated.
- Author self-review of this revision checked the transition table against
  `index.html:resetSheetState` and the legacy refusal wording against
  `share.js:decodeSeed/readOptionsLine` and `core.js:readOptions`. It is not
  independent review or runtime proof.

Independent ENG/design re-reviews are complete as recorded in the final closure
below. Implementation approval remains pending; no numeric quality or runtime
success score is claimed.


## Final independent review closure — 2026-10-26

Independent engineering and design reviewers both CLEAR the revised plan at
SHA `5c5a1f3df8fa28c8db60ccd807349ed680040fe0cefb55f2f1223a40e830be43`.
The original50c793 plan received one material design finding: ambiguous persistence
acrossCancel could imply an unauthorized globaldefault. The revised explicit
transitiontable closes it. Exactlegacyerrorpayload/precedence and pinnedoldclient
backend/servedcommit clarifications were also incorporated and independently
rechecked. No material planning findings remain; no numeric quality score is
claimed. Only status/review metadata changed after that reviewed artifact.

The accepted prompt V2 instruction body remains SHA
`f1c2f461221c395bcf0ed8650c33c47e02401fd232ce10fe50d65adc90be0a10`;
V1 self-critique→V2 independent prompt critique→plan execution→independent plan
ENG/design review→revision→both re-review CLEAR is the actual completed sequence.
StaticexactCLAUDEpacket applicability passed without applying it; feature tests,
actualgridfit, mixedclient operation, implementation and deployment are untested.

Next action is QUEUED ACTIVATION after existing active workstreams: refresh DEV/
source/instruction context, confirm reviewed scope and obtain explicit approval
for the exact CLAUDE packet before any implementation. No owner interview is
needed to settle the canonical colors, inverse meaning or existing default.
Preserve the release's old-client limitation in later implementation approval.
Main still needs separate explicit consent at release. Do not turn this planning
completion into a feature readiness or delivery claim.
