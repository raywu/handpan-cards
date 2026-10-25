# DUPLICATE-NOTES: preserve repeated physical notes, warn without refusal

2026-10-25, revised after the owner's four confirmed choices. **Plan finalization
only; do not execute this plan.** The owner explicitly resumed finishing/revising
this document after the prompt-only pause, without authorizing implementation.
Pending choices and mandatory entry gates are explicit below.

## Decision brief

**Conditional technical feasibility; execution is HELD by owner instruction.**
Scope, musical presentation, no-confirmation and narrow warning coverage are
settled. Compatibility/recovery and measured acceptance gates must be resolved
before any later separately authorized implementation. Technical feasibility is
supported by inspected architecture and bounded data probes. Current app acceptance,
round-trip compatibility, actual UI/print behavior and regression freedom are not
validated for the proposed change. A near10/10 target means source-backed scope,
independent critique and observable gates, not a numeric self-score or a guarantee.

Permit separate physical positions with the same resolved MIDI pitch, rather than
rejecting a scale solely for an approved repeat. Keep every occurrence; show a
non-blocking, factual warning and enable normal updating/saving/generation whenever
other independent requirements, including playable-chord availability, are valid.
A duplicate-valid preview is not a promise that the scale has playable chords.
Preserve existing musical behavior:
written voicings select one field per pitch class; pan/PDF diagrams highlight all
matching positions. No engine rewrite, exhaustive fingering generator or new note
cap is justified by this investigation.

The owner screenshot repeats bottom E4. Independently reviewed diagnostics verify
19 typed positions/18 distinct MIDI pitches and reproduce IN_BOTTOM refusal.
Constructed unsupported seed data retains all19 positions and builds62 legal cards;
that demonstrates feasibility inside existing APIs, **not current parser/UI support**.
Simply deleting the refusal would expose an occurrence-mapping bug and compatibility
hazards. This plan therefore treats identity and protocols as prerequisites.

## Evidence, sources and research method

Accepted sourceDEVac97a9d60edadc73b8766ec3f514de909eeb05cf; research instructions at
2f01c3acc9e1b3c1d3c36294969e37d2d743401c. Re-resolve current main/DEV and relevant
paths before later edits. Active SPS app work is separate and not yet a baseline.
Read [coordination](2026-10-25-duplicate-notes-coordination.md) and
[prompt](../prompts/2026-10-25-duplicate-notes-plan.md), frozen SHA256
be2677f0f32e23a1ae4ccda2ad3c07c711eed7c24e938b41c063dcc192dec3cb.
V1 is retained at8790e1b9; independent critique corrected voicing ties, imported
mentions, retired caps and intended-versus-legacy semantic deltas before execution.

Three independent contexts and separate file-owned worktrees produced
[core/identity/compatibility](2026-10-25-duplicate-notes-core-research.md),
[engine/layout/performance](2026-10-25-duplicate-notes-engine-research.md), and
[UX/accessibility](2026-10-25-duplicate-notes-ux-research.md) evidence. They inspected
source/tests; core/engine ran reviewed pure existing-code VM diagnostics only.
No code patches, suites, browsers, owner storage or migration ran. Test source
is not a passing test result. Raw photo and instrument name are not published.

| Material claim | Status / provenance | Consequence |
|---|---|---|
| Several independent duplicate gates exist | Verified: core.scaleInfer; importer.composeStage/composeBottoms; freeform flags | One warning-string change or one deleted guard is insufficient |
| Current cross-shell unisons already work | Verified: `(D3) A3 [A3]` and `[D3] (D3) A3` parse | Preserve existing valid inputs, IDs, ties, cards and links |
| Equal-Ding upper notes hit ordering | Verified: core uses <=Ding | Owner-approved equality exception required; below-Ding rule is separate |
| composeTyped reuses first matching ID | Verified: importer805–816 | Make typed/canonical correspondence multiplicity-aware before enabling input |
| Layout/hit identity is field/ring/seat based | Verified source and bounded layout probe | Retain existing IDs; no evidence for introducing UUID infrastructure |
| Diagrams and written voicings differ | Verified CLAUDE rules1–3, voicing.js, chordSets/PDF | Do not change established all-PC highlighting to implement duplicate input |
| Encoder can emit an input its decoder refuses | Verified unsupported-data v6 probe in core note | Successful serialization is not compatibility; decide capability/version policy |
| Ring/total caps were retired | Verified source/tests; legacy-cap prose contradicted | Do not reintroduce caps or confuse4096-character wire bound with a note cap |
| Actual duplicate UI/print/rollback/AT performance | Unverified execution | Future acceptance gates, no present no-regression claim |

## Owner decisions and proposed scope

Owner confirmed on2026-10-25: exact duplicates everywhere (including matching
Ding), one chosen position per chord tone, and a nonblocking warning with no
confirmation. The owner also confirmed warning coverage: only newly allowed
repeats plus existing inferred-note warnings. These four choices are settled; do not
re-interview them. Existing diagrams still highlight all matching physical
positions. Remaining implementation contracts are future gates, not execution
authority. The original mixed voicing/highlighting question is now
resolved consistently with the separately verified existing behaviors.

| Decision | Choice / status | Stop/fork |
|---|---|---|
| Admission — owner confirmed | Exact resolved-MIDI copies in any ring, including a non-Ding copy of Ding; one Ding marker only | Preserve unrelated grammar/layout validation; no duplicate-based refusal |
| Musical presentation — owner confirmed | One position per chord tone; preserve existing all-position diagram highlights | Alternate fingering cards or simultaneous unison voicings are separate scope |
| Acknowledgement — owner confirmed | Clear non-blocking warning naming repeated notes/positions; no confirmation solely for a declared repeat | Other independent generation/save guards remain |
| Warning coverage — owner confirmed | Newly admitted formerly refused cases plus current inferred-bottom notices; explicit accepted cross-shell copies remain quiet | Broader all-repeat warnings are outside confirmed scope |
| New-warning visibility | New formerly-refused-repeat summary available on Scale in both fields and combined-line paths | This is a proposed deliberate extension; old inferred-only notices remain field-path scoped |
| Compatibility | Feature-specific wire/record capability, preserving current-valid writer outputs | ENG/owner accept detailed version/rollback contract before storage changes |

“Anywhere” here concerns duplicates, not removal of unrelated validation. Keep
malformed/range/single-Ding/fifth/ambiguity and genuine layout/wire refusals. Top
notes below Ding remain outside this proposal; equal-to-Ding copies are explicitly
included under the owner-confirmed scope. Do not reinterpret omitted octaves,
change English A–G/accidental/zone grammar, or rename a user instrument.

| Resolved relationship | Recommended admission / notice |
|---|---|
| Two+ same MIDI within rim, inner or bottom | Accept each physical occurrence; new warning |
| Same MIDI rim and inner | Accept distinct upper positions; new warning |
| Ding plus equal-MIDI rim/inner field | Accept separate upper field under confirmed scope; new warning; Ding ID itself still never voices |
| Existing accepted top/bottom or Ding/bottom copy | Preserve admission; explicit copies quiet under narrow policy; existing inferred-bottom notice retained |
| Enharmonic same MIDI | Same policy as equivalent spelling, preserve input spellings |
| Same pitch class in different octaves | Preserve current behavior; not an exact-unison warning |
| Repeated bare letters resolving to different octaves | Preserve current inference and do not invent a unison |
| Multiple Ding markers / invalid grammar / unrelated blocker | Existing refusal; repeat warning cannot conceal failure |

## Architecture and deterministic occurrence identity

Use the resolved physical field table as authority. IDs already distinguish Ding0,
upper positions1…N and bottoms from max(101,tops+1). Preserve every field record,
zone/octave/spelling and current equal-MIDI sort-by-typed-position tie. Do not use
Set(MIDI), note-name maps or pitch-class identity to merge physical occurrences.

Prefer parser-provided occurrence correspondence. Where compose adapts input
lists, consume each matching canonical field ID exactly once; do not repeat the
first lookup result. Derive typed seats as a bijection and prove every occurrence
appears once. Avoid new persistent UUIDs unless an independently demonstrated
requirement cannot be met with current position/seat/angle representation.

Identical textual tokens alone cannot encode the act of swapping indistinguishable
physical copies. Define positional identity through the existing ordinal IDs and
layout options: moving/selecting one E4 by its ring/seat/field ID changes that
position only, and saved seats/angles round-trip. Do not promise intrinsic physical
object tracking across arbitrary edits beyond what is actually encoded. Freeze
literal expected mappings for insert/remove/reorder/one-copy-edit and equal-name
swaps before choosing an implementation; unresolved mapping ambiguity stops code.

Compute structured duplicate facts once from resolved input: MIDI, occurrences,
zones/IDs, source spellings and whether the case needs new capability/warning.
Warning text is derived presentation, never stored identity metadata. Keep the
capability predicate and duplicate groups consistent across fields, line, import,
records and share paths without separate UI token matching or a generic framework.

## Admission, inference and freeform import boundaries

Coordinate core.scaleInfer, its equal-Ding ordering branch, composeStage and the
independent composeBottoms IN_BOTTOM guard. Current line `(D3) A3 [E] [E]` infers
E4/E5; dedicated bottom fields use their own below-Ding inference. Pin both current
entry-path semantics, not a newly unified inference algorithm. New valid duplicates
must succeed at final reparse too, not only bypass an early field error.

Direct fields/canonical line/versioned declared inventories describe physical
occurrences. Freeform repeated prose, repeated headings or conflicting alternative
lists do not automatically describe more positions. Preserve provenance and
unrelated ambiguity/count/Ding confirmation safeguards. Confidently declared
repeats alone should not require confirmation under the recommended policy;
ambiguous source interpretation may still require existing review. Do not turn
all importer BLOCK/CONFIRM flags into warnings wholesale.

## Musical, layout, print and performance feasibility

Preserve separate tie policies: non-root tone choices prefer the top shell, then
lower field ID for equal MIDI (voicing.js80–90). Root HOME selection is different:
rootInstances orders equal MIDI by existing numeric-ID order, and bottom-only
homeIndex chooses the last instance (select.js249–269), so equal-MIDI bottom-only
roots choose the highest field ID. Freeze literal fixtures for both policies,
including two identical bottom roots; do not generalize lower-ID tone preference
to HOME. Preserve root-only alternate rejection and three-card/name presentation. No duplicate pitch class in a selected voicing; Ding never
voices. Adding another physical copy need not add harmony, but the first playable
non-Ding copy of a formerly Ding-only pitch can legitimately enable new chords.
Do not demand unchanged output where new musical availability intentionally changes.

Explicit zero-card control: under the proposed admission `(D3) A3 A3` may parse,
retain both A3 positions and display its duplicate warning/preview, yet has no
playable chord. Preserve generateDeck's existing no-playable-chords refusal before
registration (index.html9869–9884); no registry, saved storage or current-selection
mutation. Duplicate acceptance must not bypass this independent musical guard.
Freeze this as a negative-control test plus an assertion-killed generated mutant;
the duplicate warning itself must never be presented as the reason for refusal.

Existing layout retains each physical ID. Default solver geometry is not the
photographed instrument or the app's carried-seats/angles path. Test independently
that each identical-label target can be selected, dragged, nudged, mirrored and
renumbered without moving/removing its sibling. Existing ARIA includes ring/seat/
place; audit pitch-only movement/clash notices and add context only where ambiguous.

Keep all-PC diagram highlights and chosen note/number lines consistent across
HTML/PDF/Python parity. Duplicate editor warnings do not become CARD_WARNINGS or
an extra printed footer line. Existing SMALL_LABELS/NO_THIRDS behavior remains.

Bounded unsupported-data builds up to193positions retained fields and legal
selected cards; single local times0.11–9.57ms are observations, not budgets.
Production choose avoids Cartesian voicing.candidates, but repeats root-instance
work before discarding alternatives. Do not expose exhaustive physical fingerings
or silently alter ranking for speed. No duplicate-workload latency/memory budget
has been established. Stage A must freeze numeric acceptance thresholds and a
measurement protocol BEFORE implementation: same runtime/device, warmup and repeated
samples, median/tail latency, memory and fixed-output checks, isolated parse/build/
layout/render/print/seeded progression measurements. Freeze bounded copies1/2/4/8/
16/32/64 for A/C/E and root-heavy cases plus accepted long-pan controls, with a
reviewed execution budget. Compare unchanged controls and measure new inputs against
the agreed thresholds. Thresholds are unresolved prerequisites, not inferred from
single-run feasibility observations. Exceeding a threshold stops rollout for a
measured optimization review; no new hard note cap or opportunistic rewrite.

## Compatibility recommendation and mandatory decision gate

Propose conditional new capability rather than bumping every existing output:
old-valid inputs continue existing wire6/record4 output and byte-pinned IDs/links;
newly admitted duplicate/equal-Ding-upper cases use a deliberately newer wire and
record version (candidate7/5, final numbers/schema accepted in the specification).
A version number is not a complete design: audit maximum-readable versus emitted
version constants, default writers, rewriters/migrations, capability selection,
old/current reader dispatch, checksums, supported options and every caller.

Capability means “requires newly allowed semantics,” not “any repeated pitch”:
accepted cross-shell unisons must not be unnecessarily re-versioned. Prefer one
shared resolved-data predicate plus explicit reader validation policy. Keep
historical grammar/positional spill and previously accepted valid bytes; determine
which duplicate-refusal meanings are frozen by old version versus intentionally
expanded in current unversioned input. Do not maintain duplicated parser bodies.

Before enabling writes, publish a precise matrix for old and new app revisions ×
old/new wire × old/new record × boot/share/edit/save/delete/dedup/replace/reset.
Old-app new-link behavior should deliberately request an update where supported;
do not promise older code can display the instrument. Current encoder success
with a duplicate v6 that its decoder rejects is the negative control, not a model
to ship under an unchanged capability claim.

Boot preservation of unreadable records is insufficient. recordDeckId currently
ignores version, sameDeck can fall back to raw strings, and seeded reset removes
replacement records irrespective of readability. New writers must not casually
overwrite unknown newer formats. Validate conditional capability-specific records
against actual older revision code in disposable stores; distinguish intentional
confirmed deletion/reset from unintended loss. Before production, require a
recoverable snapshot/export and a tested downgrade/restore procedure, including
new instruments that old code cannot display. If shared-key isolation cannot meet
the accepted recovery contract, evaluate a separate new-data namespace explicitly;
do not hide a second source of truth or silently discard copies to preserve old apps.

Unproven compatibility/recovery blocks storage rollout. This plan does not choose
unsafe same-version broadening for convenience, install a migration or claim a
safe rollback merely because current boot keeps an object.

## Warning behavior and concrete UX proposal

Single-group draft: **“E4 appears twice in BOTTOM NOTES. Both positions are kept.”**
Three copies require the actual count, not “both.” Enharmonic aliases are one
resolved group with intelligible original spellings. Use zone/seat context where
needed to disambiguate positions, not implementation IDs in product copy.

New formerly-refused-repeat summaries are proposed on the Scale tab for the
active fields **and** combined-line route: permitting a line silently without
its requested warning is insufficient. This deliberately extends visibility for
the new category; keep old inferred-octave notices field-only and their existing
line-focus-clearing assertions. All duplicate summaries yield to Layout action/
latest-per-ring messages and restore on Scale; do not duplicate consumers or
persist warnings into share/storage identity.

| State | Required behavior |
|---|---|
| Duplicate-only valid input | Canonical line/pan update; no Not updated strike, stale residue or aria-invalid; normal NEXT/GENERATE/SAVE enabled when otherwise valid |
| New/changed warning settles | Show textual non-color notice and polite announcement once; no acknowledgement, focus move or per-keystroke chatter |
| Duplicate removed/replaced | Remove that group and reveal remaining notices; no stale warning after it becomes unique |
| Separate genuine error | Error/refusal wins with current invalid/held behavior; fixing it restores duplicate-valid success |
| Edit/open/reload | Show coverage-selected notices passively, opening paint silent; existing explicit-cross-shell prefills remain quiet under narrow policy |
| Fields↔line focus | No rewrite/deduplication; new warning facts consistent, legacy field-inference behavior unchanged |
| Scale↔Layout by any accepted route | Preserve warning facts and physical IDs, show only relevant tab's existing messages; no new gesture interference |
| Save/share/print | Keep every copy, no repeat-only confirmation, no new card/footer warning |

Use deterministic zone/occurrence order. For one or two small groups name the
pitches/zones compactly; for many groups propose an accurate count summary such
as “5 pitches appear more than once. All positions are kept.” It must not pretend
to list every group. Whenever a compact summary omits groups, provide discoverable
complete grouped detail: original spellings, resolved equivalent-pitch grouping
(including E4/Fb4), counts and zone/seat context. The editable inventory and Layout
labels alone do not explain those relationships and are not a substitute.
Recommended presentation for implementation review: a native details/summary
disclosure in normal flow at the end of #scale-panel-scale, after the combined-line
fieldrow and before that panel closes, outside #scale-guidance and the fixed
footer. The pinned summary remains compact; the disclosure supplies all groups
and position context and is available for either input path. Hide/remove the whole
disclosure when there are no covered duplicate groups. It must not reuse the
seed-refusal-only #scale-refusal element or turn the details list into a live region.

Use a localized accessible summary (draft “Repeated notes: details”) and semantic
list items; no custom accordion keyboard framework. Start collapsed on a fresh
Add/Edit session. Preserve the open state while that session's groups update and
when switching tabs; clear it on close/new session. Do not auto-open, scroll or
move focus when a repeat appears. If all groups disappear while focus is within
the soon-removed disclosure, defer its removal until focus leaves and show a short
“no repeated notes” state, then clear it; do not strand focus on a hidden node.
Announce the settled compact status once through the existing polite mechanism,
not both the summary and the full list.

Disclosure validity is tied to the currently active input path, never merely to
lastGood/boxOk. During a genuine invalid or unresolved active-input state, suppress
the duplicate summary and retire grouped details; the retained last-good pan may
remain under existing rules but must not make its groups look current. If focus
is inside the disclosure, retain a clearly labeled stale/last-successful-input
context until focus leaves, without presenting it as current validity, then hide
it. Preserve the primary error. Once input becomes valid, recompute facts from
that resolved input and restore only current groups; no partial parse supplies a
false valid list. Freeze valid→invalid→valid, paths, empty/unique correction and
focus-safe retirement cases in the oracle set.

The modal currently traps Tab using an explicit list (index.html13714–13731), so
native HTML alone is insufficient. U/root must add the rendered operable summary
after scaleBox in the Scale stop list, including focused deferred-retirement state;
exclude it when hidden/no groups, in Layout and after close. Preserve all existing
forward/reverse order and wrap behavior. Enter/Space use the native disclosure
semantics, with no custom accordion keyboard framework.

Freeze native interaction outcomes before later code: a genuine summary tap or
Enter/Space toggles once without a tab transition; a deliberate short horizontal
trace (the existing40px cancellation case) or touchcancel toggles neither disclosure
nor tab; a qualifying horizontal gesture from the summary follows the accepted SPS
route exactly once without toggling the disclosure. Preserve its open state on
return. Vertical gestures keep native scrolling without toggling/navigating, and
selection/keyboard behavior remains intact. Browser probes that require neutral
body input must exclude summary/details controls as interactive origins and still
assert the actual dispatched origin. Test real touch/click synthesis, not synthetic
click counts alone. If native arbitration fails, stop for the smallest independently
reviewed fix; do not blanket preventDefault, suppress all clicks, or broaden
production gesture exclusions without evidence and a reviewed scope decision. Freeze keyboard/touch/AT relationships,
update/clearing, all8locales, body scroll and SPS interaction in StageA static review.
The expanded body content must remain reachable without hiding the action or
violating existing fit budgets. If the actual prototype cannot satisfy those
constraints, stop UI implementation and review the smallest presentation revision. Never create an
unbounded fixed footer, shrink targets/type or reinstate a cap to fit text. This
summary/detail policy remains an explicit design approval item.

Hard errors/refusals remain primary; valid duplicate summary is secondary and
inference information follows. Existing syncMsgYield can hide general warnings
behind field messages: specify a combined ordered notice collection so crowded-
label/other relevant warnings stay discoverable, not suppressed indefinitely.
Reuse current slots and lifecycle where possible rather than a new notification
bus. Static prototypes must satisfy existing phone/keyboard/locale fit budgets;
if concise copy cannot fit, stop for reviewed detail presentation rather than
shrinking type, targets or tested tolerances.

Accessibility rationale: valid duplicates are not failed validation, so do not set
aria-invalid solely for repeating; preserve textual identification of genuine
errors. Use existing polite status semantics for nonurgent settled changes and
avoid interrupting focus/alerts. W3C primary guidance supports these choices, not
a guarantee of AT behavior: [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html),
[error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html),
[ARIA21](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA21). Real VoiceOver/TalkBack
remains a separately recorded check.

Localize UI keys in all8catalogs; retain capitalDu German and natural conventions
elsewhere. Pitch input, octaves, accidentals/brackets and user names remain English-
convention data. Avoid English-fragment concatenation; plural/count/zone/name
interpolation and language changes must be tested. No raw photo/name publication.

## Swarm-shaped implementation stages — after separate approval

| Stage | Objective / owned deliverables | Exit / stop / fallback |
|---|---|---|
| A Scope/contracts and authorized baseline validation | Carry forward confirmed choices; retain confirmed warning coverage; paper-review protocol/rollback and disclosure; after future execution approval only, benchmark existing code, inspect copied stores and validate isolated prototypes within that grant | No shipped app/storage implementation for unresolved contracts; freeze literal mappings, protocol matrix and numerical performance thresholds before StageC; stop when evidence/scope is insufficient |
| B Independent oracles | T separate tree: core/import/share/app fixtures and meaningful baseline failures, compatibility snapshots | Screenshot/identity/version failures by intended assertion; no startup/empty selection; unchanged baseline preserved |
| C Core and protocols | E separate tree: eligibility/structured facts, occurrence mapping, explicit reader/writer capability and safe storage adapters | Same tests green; all copies kept, old valid bytes stable; storage-loss evidence stops rollout |
| D Warning UI/locales | U separate tree: active-path success, message aggregation, precise copy/ARIA,8tables; root serializes index changes | Measured fit/state/announcement and no stale residue; no type/target concessions |
| E Faults/review | M committed scratch: generated mutants; fresh ENG/design/source and musical-boundary reviewers | Everynewgroup clean header green/assertion kill, old context intent preserved; findings fixed/rechecked |
| F Integration/delivery | Root source sync, whole affected suites/full exact-headCI, combinedDEV and actual served journeys | No CI skip substitute; new-device/AT limits explicit; main and exact CLAUDE changes separately approved |

E owns src/engine/core.js, importer.js and share.js only if selected by accepted
design. U owns data/i18n/*.json and later index.html duplicate-warning logic,
#scale-panel-scale disclosure markup/lifecycle and its bounded Scale Tab-stop
integration only. Root serializes these edits with generated-region/protocol sync;
no other application markup or gesture rewrite is included by default.
Root alone owns index generated-region sync and integration, source specs/ledger
and applicable floor rows. T owns assigned test files, M only generated patches;
no two active editors write index.html. If protocol application adapters also
need index changes, E proposes a patch to root and U/root serialize it after core
interface freeze. No implementation editor works in root's original checkout.
Current SPS must reach a stable approved integration point before duplicate UI
edits begin; research and isolated oracle design can be parallel after approval.

## Proposed files, responsibilities and rollback

| Path | Proposed responsibility / condition |
|---|---|
| src/engine/core.js | Admission/equality policy and multiplicity facts, stable IDs/ties; preserve old-reader rules through explicit shared policy |
| src/engine/importer.js | Remove duplicate-only field refusals under approved policy, provenance-aware import and one-to-one typed IDs |
| src/engine/share.js | Deliberate capability/wire/record-version dispatch and preserved old output; no unsupported same-version promise |
| index.html | Serialized warning/state/accessibility and storage adapters; generated module/catalog copies synchronized only via approved tools |
| data/i18n/{en,de,es,fr,it,ja,zh-Hans,zh-Hant}.json | New UI notice/position context, current natural tone and English note data |
| tests/core.test.js, import.test.js, share.test.js | Literal repeated-field/inference/version/legacy fixtures and independent identity/compatibility oracles |
| tests/app.test.js, e2e.test.js | Actual Add/Edit/line/field/layout/save/reload/status/focus/fit paths and disposable old/new-store matrices |
| tests/voicing.test.js, select.test.js, layout.test.js, sequence.test.js, PDF parity suites | Only meaningful affected regressions/oracles, no mirrored implementation tests or gratuitous rewrites |
| tests/mutants/*, tests/suite_health.py | Generated faults, refreshed-context intent, actual-count floors onlyraised |
| docs/ENGINE-SPEC.md, existing plan/ledger | Accepted semantic/version contracts and contradiction correction; preserve history as dated decisions |
| CLAUDE.md | Exact proposed diff only; no edit without owner's explicit approval |

Rollback is a reviewed feature/source revert through normal DEV workflow, not
resetting worktrees/shared history. Data already written in a new format must stay
recoverable; prove restore from the snapshot/export before release. Forward
correction may be safer than deploying an old reader over new records. Do not
revert unrelated SPS/SEO work or delete opaque records to obtain a green boot.

## Observable validation and independent oracles

- Exact private screenshot-derived fixture/minimized public E4 cases: approved
 19distinct IDs/18MIDIs, two independently positioned E4 copies, warning and successful
 update; never compare counts only to the implementation's own parsed length.
- Table-driven same-zone/rim-inner/Ding/equivalent-spelling cases, third/fourth
 copies, bare-note inference, direct declared lists versus repeated prose.
- Bijection/permutation properties on occurrence IDs, one-copy edits, same-label
 swaps, cyclic numbering/angles/mirror/anchor/save/edit/reload/share; no data loss.
- Frozen current-valid canonical strings/IDs/selected cards/seeded sequences and
 old golden links/records; oldlong pans remain uncapped. Musical availability
 changes in genuinely new inputs get explicit expected outcomes.
- Duplicate-valid zero-card fixture retains preview/warning but existing generation
 refusal occurs before registry/storage/selection mutation; distinguish musical
 refusal from duplicate input validity.
- Malformed/range/single-Ding/fifth/ambiguity/invalid-option/checksum/payload-length
 controls still fail as specified. New duplicate warnings cannot turn them valid.
- Old/new app×format×operation matrices on copied stores, including unknown future
 records, replace/dedup/reset and intentional deletion; no owner storage touched.
- Browser/print all-PC highlights versus written field lines, separate drag/focus
 targets, no new card warnings; real/fallback fonts and all8locales with existing
 phone/landscape/keyboard/SPS routes and fit budgets.
- Structured warnings nonidentity, correct priority/clearing/settle/silentprefill,
 no field invalidity or generatordisable for duplicates alone; real AT/device
 coverage explicitly recorded and not inferred from DOM assertions.
- Bounded repeated-root/multiplicity workloads, warm/repeated measurements and
 memory/output consistency; no new cap or blind Cartesian enumeration.

Everynewtestgroup needs a generated Git-diff mutant with #kills/#suite and no blob
index line; exact clean header must be green first, then fail by the intended
assertion with positive selection/zero required skips/cancels. Preserve failures;
startup/timeout/registration errors are not kills or green evidence. Use independent
literal inventories/intervals/known old snapshots, not production isLegal/encode-
decode alone. Full final-head CI and actual DEV bytes/journeys remain mandatory.
No passing suite or self-review alone establishes physical playability or safety
of a data migration. No such future checks ran during this planning task.

## Sequenced gates — future, separately authorized work

This completed proposal is not an instruction to begin StageA now. Preconditions
and later acceptance evidence are separate; future tests need code and therefore
are not prerequisites for receiving an execution grant. A future grant may cover
A–F or a bounded subset; stop at its stated boundary, without inventing repeated
per-step approvals for already authorized ordinary work.

### Before execution authorization: policy and scope

Carry forward all four settled owner choices, including narrow warning coverage:
newly admitted repeats plus existing inferred-bottom notices. Do not re-interview
these choices or add warnings to already accepted explicit cross-shell copies.
Any future broadening to every repeat is a separate policy change. Present the
protocol/recovery proposal,
concrete disclosure contract, lane ownership, diagnostic budget and required
acceptance evidence. Current authorization ends at finalizing/reviewing this plan.
No diagnostic, prototype, TDD or application stage is launched by this document.

### After a future execution grant: StageA and pre-application-code gates

Root re-resolves current DEV/SPS and source versions, preserves old goldens and
creates assigned clean isolated worktrees; no takeover of another owned/dirty tree.
Under the scope of that future grant only, StageA may benchmark existing code,
exercise copied/temporary stores and evaluate an isolated UI prototype. These are
bounded validation activities, not shipped application/storage implementation.
If the grant excludes diagnostics/prototypes, propose their exact scope and stop
those activities rather than execute them implicitly.

Freeze the capability/wire/record specification, old-reader meanings and the
old/new operation matrix before production storage code. Candidate7/5 must be
checked for allocation conflicts. Define the lossless backup/export/restore
contract and fixtures now; proof covering the new implemented formats follows
StageC on disposable data, before any owner-data write or release.

Freeze literal occurrence/seat mappings, distinct tone/HOME ties and zero-card
controls. Review the disclosure/focus/gesture/priority/localization contract and
its measured prototype fit. Establish numerical performance thresholds from the
bounded existing-code baseline and reviewed product budget before application
implementation; do not infer a pass from the single feasibility probe or introduce
a hard note cap. Unresolved behavioral/protocol/identity forks stop the affected
code lane. StageB independently authors meaningful intended-red oracles after
its scope is authorized; no application change precedes its required red evidence.

### After code exists: regression, recovery and delivery gates

StagesC–E must prove new-input multiplicity, supported round trips and the complete
old/new writer/reader operation matrix, including lossless snapshot/export/restore
and unknown-record protections on disposable data. Boot preservation alone never
establishes safe downgrade. Recovery or isolation failure blocks real-data writes
and rollout, even if parse/build tests pass.

Each new group needs a generated mutant, exact clean-header green and intended
assertion failure. Startup/registration/timeout failures are not kills; retain
raw failures and do not weaken tests/floors. Independent final exact-head source/
design review, fullCI, combinedDEV and actual served affected journeys precede
delivery claims. Physical device/AT limitations stay visible. Main release and
any exact CLAUDE.md edit remain separate explicit owner approvals. None of these
post-code checks is represented as already complete or required before a future
execution grant can be considered.

## Delivery readiness and stopping point

Current requested outcome: finalize this revised plan, obtain independent ENG/design
review and address material findings, retain exact plan/review refs in coordination
and the shared ledger, then **STOP without executing any implementation stage**.
Do not automatically run the finalized research prompt again, create feature code,
change tests/configuration/dependencies, migrate records or deploy/release a feature.
Documentation status/recovery updates do not create implementation authority.

Technical feasibility remains conditional because duplicate identity/protocols and
warning state need coordinated changes. No duplicate acceptance, UI/print/AT,
performance, rollback or regression tests have been executed for the proposed
feature. Prior CI40227969263 and DEV PR580 at merge
667bbf8b1459ba03de1f010e806891071ef1456c validate the earlier documentation delivery
and unchanged app baseline; they do not validate this feature or this revised plan's
future execution. The reviewed pre-decision plan585fa248 remains retained at43486f5d.
The latest exact revision and review disposition belong in coordination, not a
self-assessed numeric score.

DUPLICATE-NOTES remains distinct from SEO and the authorized SPS gesture stream.
Keep all streams in the shared ledger; preserve their separate permissions. Existing
main573/575/577/579 remain held unless the owner explicitly authorizes a release.
