# SHARE-CUSTOMIZATION-HOTFIX investigation-to-plan prompt

## Mission and current authority

Investigate a reported post-SAVE sharing mismatch, produce an executable swarm-shaped
hotfix plan, independently engineering/design-review it, and implement only a sound,
evidence-backed scoped fix after review. Owner prioritizes this over the existing
SPS swipe work. The requirement is: after a successful customization SAVE, the
selected saved instrument, displayed layout, canonical address-bar URL and LINK
clipboard/native-share/fallback payload must describe the same customization.
Do not execute the separate DUPLICATE-NOTES plan; it remains explicitly held.
Never merge main or edit CLAUDE.md without separate explicit owner consent.

Prompt quality is a source/evidence/coverage gate, not a numeric self-score. Before
running this prompt to synthesize its plan, obtain independent critique, fix all
material omissions, freeze its hash, and retain critique/recheck provenance. Then
run genuine independent source, behavior and regression investigations in isolated
file-owned contexts; the integrator alone operates host browsers and merges output.

## Observations and uncertainty to preserve

- Owner supplied an18-position instrument, same seven bottom pitches in three
  links, differently named/configured. Existing identity is custom:e6bd34c7 for all;
  name, parent option and bottom positions are excluded from field-based identity.
  Importing each same-identity link replaces that saved entry. This is verified
  existing behavior, distinct from the alleged URL mismatch. Do not silently
  redesign identity/rename/deduplication or implement keep-both variants in this fix.
- Owner's intended bottom angles in canonical bottom-field order are
  [90,220,315,180,0,40,140]. A private screenshot confirms the physical placement:
  lowest bottom at top90deg, second at220, third315, fourth180, fifth0, sixth40,
  seventh140. Original link encodes those angles; latest freshly copied link omits
  angles and describes defaults. Owner CONFIRMS SAVE CHANGES preceded LINK.
- The source screenshot is an Edit view, not proof of commit timing. Treat owner
  reports as credible evidence without inventing unseen local storage contents.
  Raw screenshot, instrument names/full owner links are private; do not publish
  them in repository docs, comments, analytics or external services. Use anonymized
  names and minimized/pitch-equivalent fixtures for public reports.
- Public production HTML fetched read-only matches main96c4c589cec0950723b3b5323dc1df5bbc359329,
  SHA256bd9be272474032a8ada18efb8a16f9160ad726ce0f12cf6dec035ac0fe223282.
  DEV667bbf8b1459ba03de1f010e806891071ef1456c includes unrelated accepted feedback.
  Re-resolve live refs/served bytes before calling a behavior current.
- An isolated existing-sandbox VM simulation injected the exact intended draft
  angle state, ran production SAVE/popstate/LINK and produced the correct original
  custom-angle code. That is a positive logical path, NOT a real-browser/drag or
  reproduction of the owner defect. First probe checked clipboard synchronously
  before its Promise and failed; it is INVALID bug evidence. Corrected awaited
  probe passed. Preserve both and their limitations; do not manufacture red TDD.
- copyLink currently copies location.href; syncRoute normally regenerates that
  URL from selected saved data after SAVE/select/popstate. A blind stale-address
  probe alone does not establish a reachable user defect. Verify the full state
  chain before recommending URL-only hardening.

## Read and trace, including transitive dependencies

Read existing AGENTS/CLAUDE, tests/CONTRACT.md and docs/testing/browser.md. Inspect
current engine share/core/layout, app edit draft/commit/registry/store/route/copy
functions and all relevant test fixtures/mutants. Trace every writer of geometry,
layoutAngles/layoutSeats, options, saved records, selection and route; include
count/order/reset/mirror/anchor/parent/name/palette transformations. Audit reference
aliasing and serialization loss: correct in-memory field angles do not establish
correct persisted options or link semantics.

Use sources including core.identitySeed/deckId; share.encode/decode/checksum/caps;
generateDeck/seedOf/scaleRecord/rememberScale/replaceScale/openShare/restoreScales;
resetSheetState/fitAngles/noteCounts/followTyped/runGenerate; selectDeck/syncRoute;
closeScaleSheet/pendingPop/popstate/hashchange; copyLink/clipboard/native-share/
manual selection; browser helper lifecycle and existing route/save/angles tests.
Do not assume a test source assertion has run or that VM DOM models native history.

## Independent lanes and investigation matrix

Root owns prompt/plan/coordination/ledger, browser lease and final synthesis.
Source lane owns a unique research note only. UX/lifecycle lane owns another unique
note only. Regression/browser lane authors reviewed temporary diagnostics only
until plan review; no production/test implementation yet. Each uses its own tree.
Fresh non-author ENG/design reviewers report only. Respect the runtime's worker
limit; browser jobs serialized with bounded supervisor and ownership cleanup.

Cover these observable cases, marking each executed, source-only or untested:
1. Single-tab exact saved custom layout versus default, both import orders, Edit
   reopen/SAVE/no-op SAVE, selection changes and copied URL semantic decode.
2. Real drag, bottom swap, fine nudge, mirror/anchor/reset, notes/count/order edits,
   rename/parent/palette-only edits and valid-invalid-valid recovery. Check that
   every intended customization survives registry, record, reload and fresh link.
3. Immediate and settled SAVE→history.back/popstate/hashchange→LINK; browser Back/
   Forward, restored/reloaded tabs and pending transitions. No arbitrary sleeps
   that merely hide a race; retain actual event sequence/state snapshots.
4. Two actual tabs sharing an origin/storage with same identity but distinct
   layouts/names; per-tab memory versus shared records, import/selection/save/
   reload/focus/events. Preserve each tab's dirty edits and distinguish observed
   overwriting from stale display or route. Do not access owner's browser/profile.
5. Clipboard Promise success/rejection/missing capability; native share success,
   AbortError and other failure; selected-text fallback. Payload consistency and
   no stale URL/success notice across asynchronous selection/commit changes.
6. Current versus legacy links, explicit/auto names, same-ID replacement and
   collision veto, angles/seats/default/null lists, unknown newer stored records,
   malformed/over-cap links/refusals and disabled LINK behavior. No lost records.
7. Modal Add/Edit/About routes, query/path/origin preservation, save-cancel/invalid
   Save, repeated LINK clicks, keyboard/focus accessibility, phone/desktop/Safari
   coverage limitations and eight-language UI conventions. English notes unchanged.
8. Distinguish data loss BEFORE encode from stale route AFTER commit and stale
   capture AT copy. Never merely refresh the URL while persisted/displayed data
   are already inconsistent; do not silently serialize unsaved draft state.

## Diagnostic and evidence rules

Only reviewed diagnostics, isolated copied/in-memory data and owned temporary
browser profiles. Freeze command/selector/count/runtime/supervisor/deadline first.
Root alone transfers the existing SPS browser lease after proving no job active;
unknown processes/profiles are never killed. Read all raw output: registration,
startup, TypeError, timeout, skipped/cancelled or empty selection is not a success
or a mutant kill. Retain failures and resource census. Do not install dependencies,
lengthen thresholds, run a full Mac suite or change global/CDP policy for this fix.

Classify claims Verified / Partially verified / Unverified / Contradicted /
Unavailable, with source SHA/symbol/command and realistic reproduction limits.
Keep happy-path passes as controls; no retry-until-green or assumed user error.
A source-only possibility is not a confirmed bug. If no reachable defect emerges,
produce a conditional plan and targeted open questions; do not implement speculative
identity migrations or claim a hotfix complete. Continue safe independent work.

## Required plan output

Write docs/plans/2026-10-25-share-customization-hotfix.md and linked coordination/
research receipts, update docs/WORKSTREAMS.md. Include:
- Executive diagnosis and priority, exact confirmed versus reported failure;
- Four-state invariants: editor preview, committed registry/storage, canonical
  address bar, outbound payload; event/state diagram and expected owner behavior;
- Reproduction matrix with baseline/control/raw evidence and negative cases;
- Root cause or bounded hypotheses, smallest reversible alternatives and rejected
  shortcuts; separate same-inventory variants/keep-both as proposed/unapproved;
- Swarm file ownership, separate test/app lanes, dependencies, stop/error/recovery
  and sole source-sync/browser/integration ownership;
- Meaningful spec-first TDD: intended failure before shipping code, same green,
  generated mutants for every new group, preserved legacy intent and raised floors;
- Static/native responsive/focus/clipboard/share behavior and failure handling;
- Exact changed files/proposed APIs, compatibility/storage/history/security impact,
  rollback and recovery of existing data without touching owner storage;
- Pre-code contracts versus post-code acceptance in executable dependency order;
- Independent ENG/design findings/fixes/exact-hash rechecks, final source review,
  full exact-head Linux validate and actual combined DEV bytes/affected journeys;
- Explicit proof limits, physical QA and permissions. Main and exact CLAUDE edits
  require explicit consent. No self-score, no invented regression-free guarantee.

Iterate prompt then plan until material findings are addressed and acceptance is
observable. Run the reviewed sound plan only under the owner's conditional hotfix
execution grant. Do not expand scope because a related bug is interesting. Report
new scope/approval blockers with concrete evidence while continuing authorized work.
