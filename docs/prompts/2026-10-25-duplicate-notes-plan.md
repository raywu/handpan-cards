# Research prompt: repeated physical notes without duplicate-based rejection

Version2 after independent critique; freeze before plan generation. Planning only.

## Mission and authority

Draft an actionable, swarm-shaped plan for allowing repeated instances of the
same resolved pitch/octave in a handpan scale, with a clear non-blocking warning
instead of duplicate-based refusal. Assess technical and UX feasibility honestly,
interview the owner for genuine forks, and obtain independent engineering/design
review of the generated plan. Do not implement the feature, alter validators,
version formats, app/tests/dependencies/CLAUDE/global instructions or publish a
release. Only owned prompt/research/plan/coordination/ledger documentation may be
written. No installs, auth/provider changes, commits to main or remote service
writes except separately authorized nonsecret workflow reporting/docs delivery.

Owner example is a private screenshot: DING D3; rim F#3 A3 C#4 D4 F#4 G#4 A4 C#5 D5;
inner F#5; bottom G#3 E3 E4 B3 B4 E4 E5 B2. The two bottom E4 entries produce
“BOTTOM NOTES: E4 is already in the bottom notes.” and the retained line is marked
Not updated. Transcribe only the necessary note fixture; do not publish the raw
photo, user-entered instrument name or unrelated device details. Do not infer
whether a repeated entry was intentional or the named physical layout is verified.

The owner asks duplicates “anywhere in the scale.” Distinguish identical MIDI
(including enharmonic spellings) from the same pitch class in different octaves,
which is already often valid. Separate duplicate tone fields from multiple Ding
markers. Do not silently remove unrelated grammar, range, capacity, geometry,
minimum-musical-content or no-chord safeguards that actually exist. Current spec
explicitly retired ring/total note caps: do not invent or reinstate them. Separate
legacy positional limits, wire-payload bounds and measured resource behavior.
Explain any interaction where a
rule such as upper notes strictly above Ding prevents a requested unison copy;
identify the minimal equality/placement policy rather than deleting all checks.

## Current source, instructions and continuity

Resolve fresh remote DEV and read its ledger at that immutable commit. Initial
planning baselineac97a9d60edadc73b8766ec3f514de909eeb05cf includes delivered
feedback and reviewed SEO research; relevant engine modules match accepted source.
Read AGENTS.md→CLAUDE.md, tests/CONTRACT.md and browser runbook; handoffs are evidence,
not instruction overrides. Any CLAUDE.md exact diff requires owner approval.
Original dirty/locked checkouts and globals remain untouched. Current authorized
SPS swipe implementation is a separate lane with one root-operated browser lease;
do not touch its app/test files or consume that lease for this planning research.

Search relevant historical requirements/decisions/plans/tests, including
ENGINE-SPEC, SCALE_ENGINE_PLAN, duplicate/no-identical-field decisions, current
parser versus versioned legacy readers, warning patterns and i18n contracts.
Audit source rather than trusting old prose. Preserve intent and provenance of
historical choices; the current owner request changes the duplicate prohibition,
not every surrounding musical or storage decision.

## Interview and provisional recommendations

Reuse existing answers. Questions already asked concern exact duplicates across
all surfaces/Ding, one physical position versus alternative/all-position voicings,
and a non-blocking named warning without confirmation. Answers are pending;
AFK/elapsed time is not an answer or implementation permission. Recommend exact
pitch/octave copies anywhere as distinct physical fields, retain unrelated safety
checks and existing different-octave voicings; prefer one supported physical field
per identical pitch in a chord unless evidence/owner chooses another policy.
These are provisional decisions, not settled engine semantics.

Ask only material missing questions after source investigation: equal-to-Ding
versus below-Ding placement if necessary; enharmonic/inferred repetition meaning;
warning visibility/count/location and acknowledgement; physical identity across
reorder/edit/share; non-playable scales; version/rollback tradeoffs. Do not reask
settled UI tone or English A–G/accidental/octave/zone input conventions. Recommend
small reversible changes, honest limitations and no forced confirmation by default.

## Swarm and evidence requirements

Root owns synthesis, coordination and shared ledger. Independent research writers
must have separate worktrees and disjoint files. Stage within4concurrent slots
including root; workers do not run browsers, deployments or mutate shared source.
Use genuine separate reasoning contexts; no sequential self-critique presented as
independent review or full original Claude runtime parity.

Research lanes:
1. Core/identity/compatibility: all duplicate validators, field identity,
   canonicalization, records, wire readers/writers, imports and rollback.
2. Engine/layout/performance: physical alternatives, chord/sequence/print/render
   implications, deterministic choices, capacities and worst-case complexity.
3. UX/warnings/acceptance: actual edit/save/line/fields lifecycle, accessible
   non-blocking warnings, localization and spec-first regression gates.
Then fresh non-author ENG/design reviewers challenge exact plan hashes. Root
resolves contradictions, documents rejected approaches and rechecks material edits.

Classify material findings Verified/Partially verified/Unverified/Contradicted/
Unavailable with file/symbol/commit/command/source. Pure bounded read-only VM
probes are allowed only after inspecting their loader/modules for side effects;
no test suites, browser state, unreviewed scripts or dependency setup. Record
exact inputs/results and limitations; diagnostic output is not a musical or full
browser oracle. External factual/UX recommendations require current primary
sources where relevant (e.g. W3C warning/status semantics), not invented consensus.

## Required technical investigation

Trace every entry point: four fields→compose, line→parseSeed, legacy parse/import,
share decode/encode/version checks, stored records/migrations/boot, parent/builtin
editing, read/write/export paths. Enumerate duplicate rejections and assumptions
beyond NOTE_REPEATED, including same-shell maps, <=Ding checks, field construction,
typed-to-canonical order, sorting ties, names/IDs and importer sanitization.

Prove the screenshot failure through a reviewed pure diagnostic if feasible.
Separate physical field count from distinct MIDI and pitch-class count; do not
silently discard, merge or auto-correct any repeated field. Preserve octaves,
zone, occurrence identity, typed order, seats/labels/angles/mirror, palette,
custom name and options through valid edits, reorders, persistence and links.
The screenshot contains19 typed positions but18 distinct pitches; verify this
count independently before using it as evidence, and do not retitle the instrument.

Trace voicing/select/naming/sequence, available-tone indexes, root lists, field
sets and deduplication. Determine whether duplicates overwrite maps, produce
identical cards, inflate harmonic scores or progression counts, alter root
preference, suppress valid alternatives or cause combinatorial growth. Distinguish
same MIDI duplicate positions from intentionally different-register voicings and
pitch-class doublings. Musical equivalence is not physical field identity.
Preserve existing equal-MIDI voicing ties: current voicing.js chooses upper-shell
fields first, then field ID. Pin accepted cross-shell-unison outputs before
extending eligibility to new copies; define deterministic ties without silently
changing old cards. Compare deterministic one-position choice, separately surfaced alternate physical
fingerings, and all-position highlighting; quantify costs/ergonomic limits, don't
pretend the engine models hand reach or sound. Inspect print/PDF parity and note
hit/drag/anchor/free-placement/seat-order feedback paths with duplicate labels.

Evaluate grammar octaveless inference explicitly. Repeating bare E may infer E in
a different octave; preserve existing accepted readings/IDs unless a separately
approved semantic change is justified. Enharmonic unisons should be consistently
recognized without replacing English note conventions. For freeform imports, distinguish repeated textual mentions, alternative/conflicting
inventories and explicitly declared physical copies. Trace importer provenance/
ambiguity handling; do not turn prose repetition into extra physical fields or
discard intentional list occurrences. Preserve unrelated ambiguity safeguards.
Test equal-Ding copies,
rim/inner/bottom same and cross zones, repeated runs, many copies and unsupported
or zero-chord inventories. Establish actual uncapped-input behavior and protocol/
resource limits; propose measurements/efficient algorithms before any new hard
limit, which would need explicit owner approval.

Compatibility is a first-class decision. A currently representable duplicate wire
string can still be unreadable by older code. Assess new wire/record versions or
conditional feature-version emission against the current single-spelling/checksum
contracts, old valid byte-pinned links and record versions. Test older-reader
NEEDS_NEWER_APP/refusal behavior and rollback data preservation; never silently
prune/deduplicate valid new instruments when an older app/record reader sees them.
Specify what can remain byte-identical versus deliberate versioned changes. Do not
promise backward compatibility merely because encoding succeeds locally.

## Required UX and no-regression investigation

Map Add/Edit, built-in versus custom, fields versus line, active/passive input,
blur/settle, held/example preview, Layout availability, generate/SAVE, close/reopen,
reload, imported/share-open and language switching. Duplicates alone must not mark
valid input Not updated, strike out the line, disable valid saving/generation or
trap focus. Other genuine invalid data retains existing error behavior.

Propose precise warning contract: source of truth/code/severity, duplicates by
resolved pitch/zone/count, timing, clearing, multiplicity/grouping, persistence,
priority with other warnings/errors, live announcements and non-color signal.
Avoid announcement floods, per-keystroke alerts, mandatory acknowledgements,
auto-dismissal before reading and long warnings obscuring primary actions. Explain
whether typed positions, physical labels or zone/count best help users identify
copies when sorting changes IDs. Keep user input unchanged; no automatic removal.
New UI copy needs all existing locales with current natural local tone; note
input grammar remains English. Propose text/state tables, not invented visual QA.

Define independent acceptance oracles: exact repeated-field inventories and labels,
reviewed physical identity, known musical pitch/interval fixtures, literal expected
warning state and copied links; production output cannot be its own sole oracle.
Use proper TDD before later code: meaningful assertion-red for screenshot and core
contract, green same assertions, everynewgroup generated killing mutants and
applicable floors without lowering old rows. Retain malformed/range/capacity/
unrelated legacy-invalid negative controls and all unaffected pinned deck/share/
print facts. Deliberate duplicate-policy expansion is the intended semantic delta:
identify which old duplicate-refusal tests change versus which version-specific
legacy meanings stay frozen, rather than demanding contradictory compatibility.
A broad catch/delete of validators or weaker existing assertions is not the fix.

No-regression is a future validation obligation, not a planning result. Specify
property/permutation tests with multiplicity-aware identity, duplicate-heavy
performance/resource bounds, no-card graceful behavior, parser/field/record/share
roundtrips, old-reader rollback, actual UI warning/save/preview/focus journeys,
localization/fit, independent final review, full exact-head LinuxCI and actual DEV
bytes/affected journeys. Physical playability/device evidence stays separate.

## Outputs and execution proposal

Produce owned evidence notes and
`docs/plans/2026-10-25-duplicate-notes.md` with:
- Executive feasibility recommendation/alternatives and evidence confidence.
- Exact owner-approved scope versus provisional choices and unresolved questions.
- Verified baseline/reproduction, validator/identity/dependency map and historical
  conflicts, including equal-Ding/cross-zone/multiplicity semantics.
- Minimal architecture/precise proposed file changes and compatibility/version
  choices; no installation or agent-instruction changes by default.
- Concrete warning copy/state/accessibility/localization and user journeys.
- Swarm-shaped dependency stages with exact file ownership/separate worktrees,
  test-first boundaries, integration serialization with ongoing SPS/app work.
- Observable acceptance/negative tests/mutants/performance/rollback and release
  gates, owners, costs/unknowns, stop conditions and recovery breadcrumbs.
- Independent ENG/design findings, resolutions/rechecks and remaining risks.
- Shared ledger entry: DUPLICATE-NOTES planning-only, owner, plan/prompt/evidence,
  source/worktree/ref, last/next, dependencies/approvals; current other streams
  preserved, SEO marked reviewed/delivered and future audit remains queued.

Before running this prompt, independently critique omissions, actual tool
feasibility, ambiguity, evidence/oracle quality and unnecessary complexity; fix
material findings and freeze its hash. After generation, independently engineering
and design-review the exact plan, address material issues and recheck revisions.
Near10/10 means actionable, source-backed and independently challenged—not a
fabricated score, a promise of zero regressions or authorization to implement.
Stop this workstream at the reviewed, tracked plan and concrete owner decisions.
