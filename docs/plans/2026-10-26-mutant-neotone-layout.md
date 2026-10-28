# Mutant Neotone layout: future implementation plan

2026-10-26. **QUEUED; IMPLEMENTATION PAUSED.** Generated from prompt V2 and amended against V3; independent
ENG/design review CLEAR after one revision round. This owner-authorized planning exception must not delay
RC587 or Claude handoff. No application/config/CLAUDE changes, tests, browser runs,
installs, hardware connection, MIDI or audio implementation are authorized here.

## Recommendation and feasibility

Add one versioned physical-layout profile with an explicit slot-to-note-occurrence
map inside the existing Add/Edit Scale→Layout flow. Keep the current engine and
single-file renderer; extend them only at their actual layout/serialization seams.
A geometry-only preset cannot retain arbitrary primary/secondary assignments.
A separate instrument engine/app would duplicate musical logic unnecessarily.
Technical feasibility is **partial**, not demonstrated: current geometry, zone-
based voicing and print paths need extensions; exact hardware topology is unresolved.

Recommend a paired-area diagram plus a 44px assignment-list editor. Secondary is
physical location, not an automatic acoustic-bottom zone. Keep existing English
scale grammar and all acoustic presets unchanged. Do not ship a preset as hardware-
accurate until model/revision and playing-area inventory are confirmed.

## Evidence and baseline separation

| Finding | Grade and source |
|---|---|
| Mutant tonefields have extra assignable areas | Verified: [official product page](https://play.digitalhandpan.com/), Mutant section, inspected2026-10-26. This establishes paired areas, not a complete pitched-slot count or geometry. |
| Current manual is4.0 for interface4.1/firmware6.8+, in progress; images may be older | Verified: [official contents](https://manual.digitalhandpan.com/contents). Specific wiki-page details unavailable in supplied investigation; no sensor-map claim. |
| Nine surrounding large/small pairs plus one central field appear in screenshot | Verified visual observation only;19potential slots is provisional. Empty labels do not prove disabled/unpitched sensors. Older indexed11-tonefield wording is revision-conflicted, not authoritative evidence against the screenshot. |
| Screenshot geometry, default tuning, center/secondary constraints | Unverified; image is not a firmware specification or dimension drawing. Do not reuse its example pitches as defaults. |
| Released source baseline | Verified local Git3542d6ea868bf08e81a0b4f06c4bc71bbc20cbcb; index SHA7fe75f5407d67b2985405c89db55f7d95882313fea016af8814728c9436db946. |
| Future saved-variants baseline | Separately inspected2a260d212ec8e14394b7198f075366d13bf372ec; indexdc6af752…, not delivered as established by this plan. No assumption that this becomes the release base. |
| Engine paths/limits | Verified at both refs: core.parseSeed/formatSeed/deckId, layout.fieldsOf, voicing.playable/byMidiAscending, share.encode/decode(VERSION6,RECORD_VERSION4), importer.read. Renderer is index.html pan/panField, not a nonexistent render.js. |
| Surface semantics are functional | Verified voicing.js:62–85: bottom differs from top in ordering/tie-breaks; Ding excluded from playable voicings. Badges/tiers must not be reinterpreted as hardware ergonomics. |
| Browser and print renderers differ | Verified index.html pan; src/engine/pdfcards.js and tools/hifi.py independently render bottom/field anatomy. No existing Neotone parity established. |

Local-only image: prompt's attachment path, SHA256
e997c67af983962882ebb3419d7265fb112ed5b20562b72f04da841e6b6ad19a.
Do not publish the screenshot or transcribe its tuning. Frontend reference consulted:
~/.claude/skills/gstack/plan-design-review/SKILL.md (responsive states, discoverability,
44px targets), plus repository visual requirements, docs/testing/browser.md and
tests/CONTRACT.md. Reference consultation only; no skill bootstrap/native execution.

## Product decisions and deferred owner interview

Ask on resumption, not during RC. AFK recommendations below are provisional design
choices; they cannot resolve hardware facts, change CLAUDE or authorize execution.

1. Confirm exact Neotone model/revision and a current blank slot diagram/count,
   including whether center has another pitched area; recommend supporting the
   pictured topology only after confirmation, rather than claiming every model.
2. How should secondary notes behave musically? Recommend physical mapping of
   existing source notes with unchanged engine roles; secondary location alone
   never earns acoustic-bottom penalties/badges. If the goal is a new musical
   layer/voicing policy, request a separate explicit semantics decision first.
3. Recommend center maps to the existing Ding, optional surrounding slots can be
   empty, and every entered note occurrence must be assigned once. Arbitrary center
   reassignment/body/percussion areas require verified semantics and later scope.
   Keeping Ding semantics also keeps its current exclusion from generated voicings;
   allowing center as an ordinary chord voice needs an explicit engine-policy decision.
4. Recommend browser and PDF support parity before launch. If the print audit
   cannot provide parity economically, ask approval for an explicit profile-only
   export restriction; never export an acoustic-looking approximation silently.

## Data, geometry and compatibility contract

Use existing seed.fields for pitch/zone semantics and a small versioned profile
object in options: proposed layoutProfile={id:"neotone-mutant",revision:1,map:[…]}.
Exact schema/token spelling is finalized with codec tests, not a new framework.
Physical slot IDs are independent of array order, MIDI and generated field numbers:
center plus confirmed primary/secondary pair IDs, canonical order/orientation pinned
in a reviewed fixture. Slot19 and numbering are not finalized from this image.

A map value identifies a stable note occurrence by source zone, exact MIDI and
ordinal among same-zone/same-MIDI occurrences; spelling is preserved separately.
Currently legal exact-pitch top/bottom pairs remain distinct occurrences. Current
same-zone duplicates stay rejected: this feature does not resume duplicate notes.
Do not fake repeated notes by assigning one occurrence to multiple physical slots.
After edit/reorder, retain unambiguous surviving occurrences; changed/removed or
ambiguous references become explicit unassigned/conflict rows, never nearest-pitch
substitution. Two matching MIDI numbers must never collapse through deckId or PC.

Validate closed profile IDs/revisions, exact allowed slots, injective assignments,
known occurrence refs, bounded integers/lengths, no prototype/inherited keys, no
unknown executable data or unbounded geometry. All scale occurrences must map once;
empty optional slots are null/absent canonically. Overcapacity does not invalidate
scale input: keep the draft and offer acoustic layout/reduce profile assignment.
No truncation, silent sorting, padding with duplicates or hidden unassigned notes.

Share must encode profile+revision+complete map in canonical order and checksum.
Recommend wire version7 ONLY for profile-bearing links, so existingv6 clients yield
NEEDS_NEWER_APP rather than silent acoustic geometry. Acoustic links must keep
writing byte-identical v6/checksums. Current global VERSION affects every encode;
introduce explicit payload-dependent version selection, not a blanket constant bump.
Pin both emitted families, older-version decode tests and payload
cap; no unapproved bump until engineering compatibility review. Stored new-profile
records need a discriminated new version/schema that old record readers cannot
silently ignore. Audit current saved-collection refusal/recovery before selecting
record-version migration; do not imply changing RECORD_VERSION alone is safe.
Mixed-version persistence is a launch blocker: existing old-client recordDeckId/
sameDeck can ignore rec.v during same-pitch matching. A record-version bump alone
cannot protect a Neotone entry from older-tab Save/delete/RESET/library rewrite.
Pin actual preceding shipped clients and test both directions: new-profile data
survives old-client Add/Edit/delete/RESET/reload and concurrent updates; legacy
records remain unchanged/readable. If shared storage cannot guarantee this, design
reviewed capability/namespace isolation and recovery before launch. A notice alone
is insufficient; do not assume isolation already exists or activate a new store
without the future approved migration plan. Preserve original bytes through failure.
Preserve all old v4 records/links; unknown profile/version is non-destructive with
an upgrade explanation and retained original payload, not default acoustic import.

Saved-instance identity includes full canonical profile/map in content equality,
import dedup and edit conflict checks, while instanceId remains independent. Engine
pitch-only deckId may remain for existing generation/caching but cannot identify
layout variants. Same scale/different map must coexist; unchanged exact links dedup
under the accepted variants contract. Rebase on whichever variants/release storage
contract actually ships; do not backport a second storage system into released DEV.

## State/assignment matrix

| State/input | Observable behavior |
|---|---|
| Add acoustic scale→Neotone | Keep notes/options; offer deterministic proposed map ordered by confirmed slots and source canonical occurrences, preview it, require Apply before adopting. |
| Under capacity/empty secondary | Preserve blanks explicitly; no invented pitches; show assigned/required count and accessible empty-slot labels. |
| Over capacity/unsupported inner role | Preserve complete scale and acoustic draft; explain incompatible profile, offer acoustic return; no scale-wide forbid or data loss. Inner notes can map if their existing roles remain meaningful; otherwise block only profile pending decision. |
| Edit/reorder/change spelling/pitch | Stable occurrence mapping survives reorder/enharmonic-only edit; removed/ambiguous occurrences become unassigned; user explicitly reassigns before committing profile. |
| Switch to acoustic/back | Keep separate in-sheet acoustic mirrors/orders/free angles and Neotone map; offer restore, never mutate acoustic geometry by hidden conversion. |
| Reset assignments | Show a deterministic proposal/preview, then explicit Apply or Cancel. Until Apply retain manual map; Cancel restores it unchanged. Apply is draft-only until Save/Generate. No silent reset on opening the control. |
| Assign an already-used occurrence | Disable it in other slot choices with accessible assigned-location explanation. Explicit clear/reassign only; no automatic move/swap or overwritten target. Revalidate after every change. |
| Incomplete active profile | Block only profile Save/Generate with inline and summary errors; focus first unassigned/conflicting row on attempted commit. Acoustic return keeps every scale note. |
| Layout↔Scale tab/Cancel/reopen | Tab change retains draft; Cancel discards entire unsaved change; reopen loads committed profile/map, not a stale cross-scale draft. |
| SAVE/Generate/fresh LINK/reload | Only valid complete map commits; diagram/address bar/copied link/reload/clean-profile import reconstruct the same assignments. |
| Peer edit/delete/conflict | Existing revision/instance checks cover map; keep losing draft and approved conflict recovery; never merge mismatched slot maps automatically. |
| Session-only/storage failure | Keep source draft and existing durable records; expose existing session-only/retry behavior without false persistence claims. |
| Unknown/corrupt map/version | Fail validation before publication; preserve payload/draft and offer acoustic editing of separately retained notes, never claim successful profile import. |
| Exact repeats beyond current grammar | Existing refusal remains; explain dependency if owner needs it. Paused duplicate support is not secretly activated. |

## UI wireframe and visual behavior

```text
SCALE | LAYOUT
Instrument layout: [Acoustic v] / [Neotone Mutant — confirmed revision]
[read-only paired-area preview; center + primary/secondary labels]
Assigned 12 of 12 notes · 7 empty areas             [Reset assignments]
Area P1 primary    [note occurrence / Empty v]     (44px target)
Area P1 secondary  [note occurrence / Empty v]
… [center row identifies Ding] …
[Back to acoustic layout]                     [Generate / Save changes]
```
Use established typography/palettes/borders; new copy localized, notes stay English.
At320px, tiny overlapping SVG regions cannot each become44px without ambiguity.
Assignment list is authoritative editing; diagram is read-only and aria-described.
If later approved diagram selection is added, select the pair then expose two
separate44px buttons, with explicit z-order/clipping/hit tests; no hidden overlapping
click targets. Keyboard can reach every list row, identify slot/layer/note/empty,
change assignment and return focus after validation; do not rely on color alone.
Landscape uses existing sheet scroll boundaries, no horizontal overflow or footer
occlusion. Practice modes A/B/S use the same committed physical map read-only.
Preserve existing pitch-class-complete highlighting; exact occurrence determines
position/selected voicing fields, not pitch-class dedup of physical assignments.
Secondary-slot occupancy is not bottom-shell anatomy. Keep existing acoustic badge
semantics unchanged; profile badge/copy must disclose source musical roles rather
than falsely naming physical bottom notes. Owner semantics decision gates final copy.
Do not claim playability/ergonomic equivalence from geometric proximity.

## Proposed edits after explicit resumption

| Exact path | Responsibility/dependency |
|---|---|
| src/engine/layout.js | Small profile validation/slot geometry branch; old acoustic solver unchanged; reviewed fixture first. |
| src/engine/core.js, src/engine/importer.js | Only if profile option validation/occurrence handling requires it; keep English parse grammar and current duplicate rules. |
| src/engine/share.js | Versioned canonical profile/map, checksum, cap and backward/newer-client behavior. |
| src/engine/voicing.js, src/engine/select.js | Audit role/tier/caching seams; modify only approved semantics, not because geometry moved. |
| index.html | Layout selector/list/preview, pan/panField, sheetOptions/layoutOptions/solvePreviewLayout, draft switching, buildGenerated/scaleRecord and shipped storage/LINK integration. Engine regions generated via tools/inline_engine.py. |
| src/engine/pdfcards.js, tools/hifi.py | Profile-aware browser/Python anatomy only after print audit; export unsupported states explicit. |
| tests/fixtures/neotone_profile_v1.json (new) | Reviewed geometry/slot inventory, occurrence assignments and orientation; no screenshot-tuning defaults. |
| tests/layout.test.js, tests/core.test.js, tests/import.test.js, tests/share.test.js, tests/voicing.test.js | Spec-first engine/codec/role/property tests; change only necessary groups. |
| tests/app.test.js, tests/e2e.test.js, tests/drawer_grid.test.js, tests/drawer_drag.test.js, tests/drawer_seats.test.js | Draft/interaction/assignment/read-only journeys and unchanged acoustic navigation regression. |
| tests/pdfcards.test.js, tests/test_render_agreement.py, tests/test_pdf_parity.py | Browser/Python profile export parity or approved explicit unsupported refusal. |
| tests/mutants/*.patch, tests/suite_health.py | Generated meaningful faults and additive actual per-file floors, no weakened old checks. |
| docs/WORKSTREAMS.md and this plan | Gate/decision/plan/worktree/checkpoint evidence; CLAUDE exact patch proposed separately for owner approval. |

## Swarm execution, acceptance and recovery

After hardware/semantics/export decisions and explicit future implementation grant:
T owns fixture/tests before source; E owns engine+codec; U owns app only after E
contract freezes; P owns print audit/implementation separately; M owns generated
faults; coordinator owns integration/sync/ledger and sole browser lease. Separate
worktrees and file ownership; E/U coordinate index generated regions through root.
Independent ENG/design reviewers are not authors; no sequential self-review credit.

| Acceptance input | Observable pass/fail and baseline |
|---|---|
| Confirmed hardware map/min/max/empty slots | Every occurrence visible once, no dropped/added note; pinned external fixture, not implementation-derived geometry. |
| Reorder/enharmonic/exact top-bottom pair | Correct stable occurrence/position survives; compare literal fixture; same-zone duplicates remain baseline refusal. |
| v1–6 links/v4 records and five builtins | Acoustic emits exact old v6 bytes/checksums, including pinned builtin URLs; only new-profile v7 refuses on pinned old client. Old corpus/geom/cards/PDF snapshots unchanged. |
| Mixed old/new tabs and persistence | Old client Add/Edit/delete/RESET/whole-library rewrite cannot remove new-profile data; pin real prior client and new record bytes, independent concurrency and rollback tests. Isolation/capability protection demonstrated before launch. |
| Reset/collision/error recovery | Preview reset Cancel preserves manual map; Apply stays draft until Save; duplicate-assignment choices disabled accessibly; incomplete-map commit focuses first invalid row, acoustic escape loses no notes. |
| Same notes/different map, edit/conflict/reload | Independent variants and exact map/LINK roundtrip, no sibling overwrite; shipped saved-variants tests baseline. |
| Malformed/oversized/prototype/fuzzed map | Bounded rejection, no import/storage mutation; canonical roundtrip properties and missing/duplicate slot faults. |
| Highlight/modes/slot identity | Existing PC lighting and source-role counts preserved; selected physical occurrence stays distinct; wrong-slot/secondary-as-bottom mutants fail. |
| Phone/landscape/list keyboard/fonts/locales |44px real controls, no clipping/overflow, correct focus and announcements; shared browser runbook and unchanged budgets. |
| Export | Same confirmed map/labels/highlights across SVG/browser PDF/Python, or owner-approved explicit profile export refusal; no silent acoustic PDF. |

Run meaningful RED→GREEN→generated fault→restored; commit no hand-written mutant
bodies. Full exact-head Linux validate, independent addressed review and servedDEV
journeys precede owner hardware/device QA and separate main consent. No tests run
for this plan. If review fails a fourth round, regroup per standing AFK rule.
Rollback preserves old records/raw links and owned drafts; do not downgrade new
records to acoustic or clear storage. Keep new-profile records readable/recoverable
before reverting UI; rollback compatibility must be demonstrated, not promised.
Claude continuation: read this plan+prompt, resolve live release/variants refs,
recover missing hardware decisions, freeze fixture and codec schema, then request
future execution approval. No unfinished feature work is silently activated.

## Prompt iteration and independent review closure

Prompt V1 self-critique produced V2; V2 independently checked without a material
omission, then executed to generate this plan. Output review found acoustic-write
compatibility, mixed-version storage, Reset and collision/recovery gaps; V3 prompt
now requires all four explicitly. Focused amendments applied and independently
reread by /root/regroup_eng_review and /root/regroup_design_review: both CLEAR for
future planning after one revision round. Reviewed substantive draft SHA256:
d37454af38944ea85b94b6b9f032e8d040fd54966cb3dc13b9a7694c256275d5. Closure metadata and explicit Ding-policy note
added afterward. No hardware/runtime validation or implementation readiness claimed.
Next owner interview stays queued for resumption; no interruption of current RC.
