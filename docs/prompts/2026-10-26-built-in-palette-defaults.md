# Built-in palette choices — planning prompt

Status: **V2 finalized; independently critiqued and accepted for planning execution.**
Root authorizes running the unchanged V2 body to generate the plan only. No feature, test, instruction,
engine synchronization, browser, configuration or release execution is authorized.

Workstream: `PALETTE-DEFAULTS-10`. Queue after the existing approved active work:
saved-scale variants first, then the already authorized Helpers and Scale↔Layout
swipe work. Target the next suitable main release only if every required review,
verification and release gate is met; this is a scheduling preference, not main
merge consent. Root owns the ledger/status records; this author owns only this
prompt and the future plan named below. Preserve unrelated working-tree changes.

Repository evidence baseline: `0d36b1f4ace31dd5f8978f2ed51741fe78049c36`, inspected
read-only in `/private/tmp/handpan-palette-defaults-plan.20261026`. Resolve live DEV,
active lane ownership and the delivered saved-variants/Helpers/SPS state again at
implementation activation; today's line numbers are investigation breadcrumbs.

## Prompt iteration receipt

V1 seed prompt, not executed:

> Draft a minimal plan to add the D Kurd 10 and D Amara 10 built-in color pairs
> and their root/tone swaps to the palette picker, preserve existing choices,
> defaults and data, and verify no regression before a later release.

Author self-critique against the evidence/rubric below identified these omissions:

| Omission in V1 | Incorporated into V2 |
|---|---|
| Registry-only advice misses validation/protocol/CLI bounds | Trace core, readable and packed shares, record options, CLI, renderers and tests separately. |
| A global new wire version could unnecessarily churn existing links; widening a shared parser could also change old-version refusal behavior | Compare append-only current-wire, selective new-wire and global new-wire designs against actual valid/invalid versioned inputs; choose the smallest safe supported contract. Do not assume a version bump is required or forbidden. |
| Ten nominal44px flex children can shrink or clip | Require measured layout proposals and genuine target/text/hit/focus/lip assertions; compare5×2 and bounded natural wrapping. |
| New colors alter seeded Edit palette inference and saved identities | Verify every built-in/no-op Edit path and old/new multi-tab saved records, including opaque rows and slot authority. |
| 'Rollback by reverting' can strand newly persisted palette choices | Define data-compatible recovery/roll-forward and older-client behavior before release. |
| 'Near10/10' is an unsupported self-score | Use observable acceptance criteria, independent prompt critique, swarm plan review, meaningful TDD/mutants and exact-head delivery evidence. |

This is self-critique, not independent review. Independent critique/root acceptance
is still required before executing the V2 prompt; independent engineering and
design reviews follow production of the plan. No review or validation is inferred
from this file loading successfully.

## V2 prompt — begin

You are the planning lead for `PALETTE-DEFAULTS-10` in handpan-cards. Produce one
reviewable implementation plan at:

`docs/plans/2026-10-26-built-in-palette-defaults.md`

Investigate first. This is planning only: do not implement, run browser jobs,
install tools, change configuration/authentication, execute synchronization or
unreviewed scripts, change remote resources, commit, merge or edit CLAUDE.md.
Use inspected repository code/specifications/tests as primary evidence. External
research is unnecessary unless a material platform question remains; then use
current authoritative documentation and distinguish it from demonstrated runtime
behavior. Never claim a proposed probe or passing historical suite validates this
feature. Preserve existing instructions and all unrelated work.

### 1. Resolve the exact product requirement

The owner wants the two newer built-ins' normal pairs and their root/tone-swapped
versions available alongside the existing six choices. This adds FOUR choices,
for TEN total. It does not change palette0, the default cold-start scale, any
built-in's stored colors, existing users' selections, musical engine output,
geometry, note input conventions, mirror settings or chord inversions.

'Inverse' means swap the root/tone color roles consistently, with `ga=root` and
`gb=tone`, exactly like the existing inverse entries. Do not invert RGB channels,
reflect the physical diagram, reorder notes or change chord/register semantics.

Verify the canonical built-in values in `data/decks.json` before using them. The
inspected pairs are:

| Family | Normal root / tone | Role-swapped root / tone |
|---|---|---|
| D Kurd 10 (`kurd`) | `#2563B0` / `#C0452C` | `#C0452C` / `#2563B0` |
| D Amara 10 (`amara10`) | `#3B7A2A` / `#B3263A` | `#B3263A` / `#3B7A2A` |

Recommend an explicit append order, without renumbering or changing indices0–5.
Provisional recommendation:6Kurd normal,7Amara10 normal,8Kurd swapped,9Amara10
swapped; this preserves the current six-entry prefix and gives the new block its
normal-pairs-then-swaps order. Briefly compare adjacent-normal/inverse pairs if a
real UX advantage exists; resolve this routine design choice by evidence and
review instead of inventing an unnecessary owner blocker. Keep numbered accessible
labels via the existing `sheet.palette_n` template; no new keys/naming system
unless investigation demonstrates a genuine requirement.

### 2. Independently trace the complete contract

Inspect AGENTS.md, applicable CLAUDE.md, tests/CONTRACT.md, the shared browser
runbook, workflow references and relevant current plans before planning changes.
Treat historical plans as evidence, with later accepted amendments taking effect.
Do not activate global skills/installers or claim copied workflow parity. Document
which frontend/workflow guidance was actually consulted and which is unavailable.

Use file paths and symbols, not guessed line numbers. At minimum follow:

- `src/engine/select.js`: six-entry `PALETTES`, palette selection and generated
  `options/colors` in `build`.
- `src/engine/core.js`: `DEFAULT_OPTIONS`, `readOptions` currently rejecting an
  index above5, `parseSeed`/legacy parsing, identity independent of options.
- `src/engine/share.js`: version gates, `RECORD_VERSION`, current readable palette
  regex accepting only `palette-2`…`palette-6`, canonical serialization using
  index+1, packed options, checksums, cap, unknown/duplicate/out-of-order options.
  The actual checksum is FNV-1a with the top24bits in readable links, NOT CRC.
- `index.html`: `buildSwatches`, `seedPalette`, sheet initialization/dirty baseline,
  `paintPan`, save/import/dedup and option identity, tagged saved instances,
  `scaleRecord`/`recordOptions`/`readSavedRecord`/`stageSavedEnvelope`, slot ownership,
  draft/conflict/recovery paths, routing, `copyLink`, tab lists and lip handoff.
  Built-in LINK uses its existing `#deck=` route; do not conflate Edit palette
  inference with rewriting built-in routing or historical links.
- `tools/gen_deck.js`: independent CLI `--palette` range0…5; generated print
  adapter in `tools/decks.py`; `src/engine/pdfcards.js`; SVG/CSS root/tone and
  ga/gb consumption. Identify actual changes required versus regression checks.
- Canonical `data/decks.json`, generated inline regions, sync/deck rules, frozen
  examples and specifications. Do not hand-edit generated engine regions or
  regenerate canonical deck data merely to add choices.
- Existing tests and mutants: core/select/share, app/palette/seeded Edit, real
  browser tab/target/scroll/lip/844controls-column/320phone cases, PDF parity,
  CLI range, localization and English DOM snapshots. Locate hard-coded six/5
  assumptions, but do not blindly replace unrelated sixes, weaken checks or
  regenerate broad fixtures. Frozen saved-variant/profile fixtures cycling modulo6
  can remain historical coverage; add focused new-palette cases where needed.

Produce a small evidence index and classify significant claims as verified,
partially verified, unverified, contradicted or unavailable. Separate code-path
feasibility, historical tests and future validation. Record missing evidence.

### 3. Choose minimal protocol and persistence behavior

This is an append-only registry change unless evidence proves a broader change is
necessary. `ENGINE-SPEC.md`§13 and D6 already state that extensions append indices
and never renumber. Core loads before select: do not create a core→select cycle
or a broad new configuration/registry framework to avoid a few deliberate bounds.
Compare minimal approaches and choose one with concrete trade-offs:

1. Append indices6–9 and extend the current readable token range without changing
   old encodings, explicitly documenting how older clients reject new choices.
2. Use a newer wire format only where required for new options, if it can retain
   a maintainable canonical encoding and existing valid link bytes.
3. Bump the entire write format only if a demonstrated requirement outweighs its
   old-link/canonical-URL/test churn. Do not choose this by default.

For each viable design, make a truth table of old/new writer and old/new reader:
all existing valid v1–v6 examples; each new normal/inverse option; the two-digit
`palette-10` token; malformed, leading-zero, negative, fractional, missing,
duplicated and out-of-order values; old unsupported palette values with valid
checksums; future versions; checksum tampering and the existing cap. Determine
whether old clients show BAD_NOTE versus NEEDS_NEWER_APP and whether that is an
accepted limitation or requires a different design. Never silently reinterpret
an existing valid link or change any index0–5's color roles. Distinguish preserving
valid old meanings from intentionally widening previously invalid input grammar.

Changing core's global range can accidentally widen packed old-version inputs
because their options ultimately go through the current parser; inspect that
path, not just the readable regex. Keep wire version, stored-record version and
collection schema separate. Do not bulk-migrate unchanged records or change record
version solely because a wire version moved.

Determine how new-palette records behave in older active tabs and a rollback:
custom opaque entries, seeded-slot owners, preferred selection, existing palette0–5
siblings and unrelated writes. The current saved adapter retains unreadable raw
rows and can protect a collection with an unreadable slot owner; that is a source
observation to verify, not a completed compatibility test. Require controlled
mixed-client tests and raw-data preservation; no silent default-color substitution,
lossy normalization, record deletion or weakening of concurrency/draft guarantees.
If reverting code would strand newly saved choices, define a data-compatible
roll-forward/reader-preserving rollback. Explain any required owner decision.

### 4. Assess actual ten-choice UX feasibility

The current picker is `display:flex` with no wrap and nominal44px children. Ten
children need440px before any surrounding layout; they may flex-shrink rather than
retain real44px targets. Registry length alone is not a usable implementation.

Recommend the smallest layout change after deriving actual container constraints:
compare stable5×2 with natural wrapping while preserving current ordering,
complete numbered names, selected ring, fourteen-pixel visual dots, readable
root/tone halves and real44×44-or-larger independent hit targets. Do not promise a
fit from CSS classes or arithmetic alone. No new scroll trap, shrunk typography,
reduced target, clipping, arbitrary fit allowance or hidden control is acceptable.

Plan candidate/baseline measurements at320phone,380phone,844×390 landscape and
relevant desktop/short-height/CSSOM edges, with real and fallback fonts, all eight
actual UI languages and Add/Edit, valid/invalid/empty scale states as relevant.
Retain existing sheet/lip/footer/RESET/drawer/primary/DELETE contracts. Exercise
all ten stops forward/back, selection via actual keyboard/pointer input, tab
switch retention, last-swatch lip handoff and correct selected state after save
and reload. Distinguish pre-existing focus/line-oracle defects from new regressions;
reconcile the accepted Helpers text-line/font-preparation amendments at activation.

Opening Edit on Kurd/Amara10 will newly map to their real pair instead of
`seedPalette`'s old fallback0. Specify intentional preview/selection behavior,
no-op SAVE/close semantics, seeded replacement ownership and unchanged built-in
practice/PDF output; do not confuse this improvement with a new global default.

### 5. Produce an executable swarm-shaped plan

Keep the plan concise enough for a fresh session to act on. Include:

1. Decision brief, scope/non-goals, evidence-qualified readiness and sequencing.
2. Exact append table and compatibility/validation/UX decisions with alternatives.
3. File/symbol change inventory and the smallest dependency graph.
4. File-owned lanes in separate worktrees: engine/options/share/CLI; acceptance
   tests; UI; mutation proof; root integration/ledger; independent ENG/design.
   Prevent simultaneous index.html writers: UI owns its app/CSS/markup changes,
   engine owns source modules only, root synchronizes generated regions after
   handoffs. No shared-file collisions or self-review labeled independent review.
5. Meaningful spec-first TDD: literal appended colors/roles, complete old palette
   prefix/default0, option bounds, old link/checksum pins, new round trips and
   rejection cases, record/client compatibility, seeded no-op behavior, generated
   cards/PDFs and real native ten-choice usability. Every new test group gets a
   generated no-blob-header mutant and clean-green/intended-assertion-red/restored
   proof; no syntax, startup, skip, cancellation or timeout kill credit.
6. Existing count/fixture/mutant refreshes preserving actual behavioral intent,
   independent literal expectations and all unaffected oracles. Raise only actual
   per-file floors; never lower floors or remove tests to speed release.
7. Engineering review of parser/compatibility/storage/print/sync/failure paths and
   design review of all states, fit, focus/touch and names before implementation.
   Independent final review at immutable source/test/fault pins; fix/re-review
   material findings. Do not invent review results or a numeric quality score.
8. Validation matrix with proposed exact selectors, expected nonzero coverage,
   meaningful negative/fault cases, owned evidence and stops. Existing command
   shapes must be verified from current files before execution; proposed commands
   are not evidence they ran. One root host-browser lease, unchanged deadlines,
   fonts/readiness checks and owned-process cleanup.
9. Exact-head full Linux validate, generated-source/data preservation checks,
   actual served DEV revision and affected journeys, owner QA instructions, and
   explicit main-release consent. Preserve noindex/analytics and other existing
   DEV delivery contracts. Do not add unused broad integrations or unrelated
   performance campaigns as release blockers without a change-specific reason.
10. Approval gates and an EXACT proposed CLAUDE.md patch packet in the plan only.
    The current paragraph says six swatches/sixth stop and quotes affected tests;
    propose minimal accurate text and explicit related specification changes.
    Do not edit CLAUDE.md, duplicate shared rules or change Claude's behavior.
11. Rollback/recovery, interrupted-lane breadcrumbs, ledger ownership and a handoff
    containing plan/worktree/branch refs, last/next action, decisions, proof refs,
    blockers and release disposition. Root publishes normal reviewed checkpoints.
12. Adversarial challenge and revisions: wrong family/role swap, reordered old
    indices, default0 change, two-digit token bug, old-client/version mismatch,
    opaque/slot data loss, hidden/shrunk/overlapping swatches, stale selected/focus
    nodes, invalid-scale palette disabled, lip/tab regressions, generated drift,
    unchanged built-in PDFs accidentally rebuilt, code-only rollback stranding
    new records, tests mirroring production, self-review and deadline pressure.

For each phase state objective, dependencies, owned files, deliverables, observable
acceptance, stop conditions, approval and rollback. Investigate unresolved facts
first; interview the owner only for material preferences/policy that cannot be
resolved from settled instructions. Provide a recommendation and explain what
work can proceed while awaiting that input. Do not treat AFK or release speed as
permission to lower quality or merge main.

### 6. Quality gate before handing the plan back

Evaluate this checklist with source evidence and explicit open items, not a score:
exact requirement and stable append order; all producer/validator/consumer paths;
old/new protocol plus stored-data behavior; actual ten-choice UX/keyboard contract;
minimal maintainable architecture; true file-owned swarm/dependency order;
meaningful TDD/mutants; independent engineering/design review requirements;
reproducible CI/served DEV/owner QA; data-safe recovery/approval/ledger continuity.

Revise until no material planning omission remains. Unsupported runtime claims
must remain unverified. If a required decision is unresolved, name its owner and
concrete investigation/remediation rather than manufacturing a '10/10' result.
Stop after producing the plan for independent ENG/design review. No implementation
or feature release follows from this planning run.

## V2 prompt — end

## Independent critique and activation

Independent engineering and design critics both CLEAR the V2 draft at SHA
`bd31c461508f1f99c4c872a3153699c99d958ef2b38795790ee474d1736b0a9d`.
They independently checked the exact palette/protocol/UI/persistence and release
rubrics and found no material omission. V1→V2 revisions are recorded above;
critique clearance is not a numeric quality score or approval of the output plan.

Root accepts the exact unchanged prompt body SHA `f1c2f461221c395bcf0ed8650c33c47e02401fd232ce10fe50d65adc90be0a10`
and activates planning execution2026-10-26. Only status/review metadata changed
after the independently reviewed draft; the V2 instruction body is unchanged.
Output plan must receive separate independent ENG/design reviews, with material
findings addressed before it is marked ready for later approval/implementation.
No application, CLAUDE, configuration, browser or release action is authorized.


Execution receipt2026-10-26: V2 produced the linked plan. Its initial50c793 output
was independently reviewed; a Cancel/draft ambiguity and engineering compatibility
clarifications were corrected. Both independent reviewers CLEAR revised5c5a1f.
See the plan's final review closure. No application/CLAUDE/browser execution or
feature release occurred. Prompt/output quality is evidence-qualified rather
than assigned a fabricated score.
