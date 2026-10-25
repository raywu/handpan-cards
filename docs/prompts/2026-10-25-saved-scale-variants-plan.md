# SAVED-SCALE-VARIANTS: research-to-plan prompt

## Mission and authority

Investigate why two saved instruments with identical notes but distinct names or
layouts replace each other; design the smallest safe support for retaining both.
Produce a swarm-shaped executable plan, independently ENG/design-review it, and
resolve material findings. This run is INVESTIGATION/PLANNING ONLY. No app/tests,
dependencies, storage, configuration, authentication, remote data, CLAUDE.md or
main changes. Do not implement a migration or run unreviewed scripts.

Owner wants both named instruments visible together. Owner confirms separate tabs
and reports Add/new LINK still replaces the other. Latest supplied link validly
carries updated positions but retains the same canonical note-inventory identity.
This explains saved-entry replacement, distinct from the earlier omitted-angle
report (unresolved) and independently repaired asynchronous LINK completion bug.
Do not claim either repairs the other. Raw owner names/links/screenshots/storage
are private; use existing public/minimized fixtures and sanitized reports only.

Read the retained investigation rather than repeat completed baseline research:
docs/plans/2026-10-25-saved-scale-variants-investigation.md and hotfix source/UX
notes. The parent async hotfix source is9e47e06a, held main581/DEV582; current full
CI40239404703 is pending. Resolve current remote DEV/main/PR heads before choosing
an eventual implementation base. Never bundle SPS or implement DUPLICATE-NOTES,
whose final plan is explicitly held on codex/duplicate-notes-plan-20261025.

Provisional planning recommendation (owner interview pending, not permission):
retain distinct named/layout variants, edit only the selected saved instrument,
reuse an unchanged imported variant. Define defaults for further decisions below
as proposals; do not fabricate owner answers. Planning may proceed with these
assumptions; implementation cannot begin with unresolved material policy gates.

Before running this prompt, obtain independent critique, fix omissions and freeze
its exact hash. Quality means complete evidence, observable criteria, minimal
scope and no unresolved material review findings; never invent a 10/10 score.

## Discover and independently verify

Read AGENTS/CLAUDE, tests/CONTRACT.md, docs/testing/browser.md, ENGINE-SPEC identity/
storage/share sections, current relevant plans/tests/mutants and generated-source
rules. Inspect each coupling, including transitive calls:

- core.identitySeed/deckId; generated deck.id; collision guard;
- registerDeck/generateDeck, CUSTOM, deck/editedDeck/selectDeck/buildChips;
- scaleRecord/recordDeckId/sameDeck/rememberScale/replaceScale/forgetScale/
  restoreScales/savedScales/writeScales and selection in hpfc settings;
- openShare/boot import/hashchange/syncRoute/routeInfo/#s=/#deck=/#edit-;
- Add versus Edit runGenerate, Edit collision veto, built-in replacement slots,
  allDecks/replacements, hide/delete/reset and unreadable/newer records;
- URL capture and async completion ownership newly introduced by SHC; keep its
  saved selection, modal, history and privacy invariants intact;
- DUPLICATE-NOTES planned future wire/record capability changes: reconcile version
  and namespace ownership without implementing its held functionality.

Classify material claims Verified / Partially verified / Unverified / Contradicted /
Unavailable. Distinguish original requirements, repository convention, historical
behavior, new owner choice, recommendation and unknown. Source inspection is not
successful runtime operation. Use authoritative primary documentation for browser
storage/transactions/locking/UUID/security/compatibility claims; deep-research
alternatives and cite precise URLs. Do not transmit private app state in research.

## Independent lanes and minimum architecture comparison

Root owns prompt/plan/coordination/ledger/synthesis and sole browser/integration
lease; no browser execution needed during this planning run. Separate native agent
contexts investigate source/schema/concurrency and UX/migration/compatibility;
an independent primary-documentation lane assesses runtime mechanisms. Each owns
one unique research note in a separate tree. Fresh non-author ENG/design review
the synthesized plan. Respect four-agent concurrency; no sequential self-review
presented as independent swarm execution.

Compare at least: stable saved-instance identity separate from unchanged canonical
inventory; normalized content-keyed variants; and the minimum wrapper/registry
adaptation. A fingerprint may help import dedup without becoming edit identity.
Measure affected APIs/files/compatibility and maintenance cost. Do not pick an
engine-id hash change or new database merely because it seems convenient.

Define responsibilities of engine inventory ID, local saved-instance handle,
registry key, selected settings, edit target, content fingerprint, built-in slot
owner and portable URL separately. Prevent accidental d.id semantic changes or
registration overwrites BEFORE records are saved. Keep share URLs portable content
snapshots and analytics free of local IDs/names/URLs. No per-link local UUID leak.

## Required behavior and edge-case matrix

1. Import same notes/different name or physical layout: retain both, independently
   selectable/editable/deletable/shareable. Same notes/different palette, anchor,
   mirrors or explicit parent: decide semantic equality explicitly. Distinguish
   explicit versus auto name/parent; normalize absent/default/all-null corrections
   and legacy equivalent wire spellings. Preserve spelling distinctions that the
   engine intentionally treats as meaningful; no pitch-class-only dedup.
2. Exact repeat import/reload/Back: reuse an exact match; deterministic selection
   if multiple exact matches already exist. Never allocate endlessly on boot.
   Current edited instance plus a retained older share link must not overwrite
   either. A copied link describes its committed variant in a clean receiver.
3. Edit selected instance: stable local identity/order through rename/nudge/note
   changes, only that instance updated. Editing onto another equal inventory is
   allowed under the new contract; retain true hash-collision defenses. Edit final
   content matching a sibling must not silently delete/merge either. Propose the
   least surprising handling of explicit Add with fully identical content.
4. Built-in original/replacement/custom siblings: one explicit replacement slot
   owner; imports must not silently steal it. Define seeded routes, replace/reset/
   hide/delete, selection fallback, chip order and future editing provenance.
5. Two tabs: simultaneous different Adds, two edits of one instance, delete versus
   Save, stale clean tab, dirty tab, stale #s= reimport/reload, new/old app tabs and
   duplicated tab. No lost updates/implicit destructive merge. Identify actual
   atomicity of the chosen storage mechanism; a local ID alone does not solve
   whole-array read/modify/write races. Preserve drafts/focus and provide a clear
   conflict/recovery policy. Avoid a generic sync layer for unrelated UI state.
6. Legacy migration: old selection/order/options, built-in replacements, duplicates
   already collapsed, opaque/newer/corrupt records, absent/throwing storage, quota,
   private mode, interrupted writes, partial migration, refresh/repeat migration,
   old writers after upgrade/downgrade and eventual cleanup. Never rewrite opaque
   records or imply overwritten history can be reconstructed. Preserve a useful
   untouched recovery source; account for quota when creating backup plus new data.
7. Durability: distinguish successful registry mutation, session-only fallback and
   acknowledged persistent write. Define staged migration and commit/recovery
   markers with idempotence and failure injection; no silent success after a failed
   write. Evaluate read compatibility, supported API availability and fail-closed
   fallback. Installation and browser API discoverability are not validation.
8. UX: both instruments discoverable without unrequested renaming, stable selected
   chip/focus, identical visible names after convergence, mobile wrap/overflow,
   accessible warnings/conflicts and keyboard/Back/cancel. Add no confirmation
   unless required to avoid actual loss. Define new copy/locales only if needed;
   input remains English note grammar. Preserve physical layout and panel budgets.
9. No unintended changes: generated engine/data/geometry unchanged unless a
   separately justified reviewed dependency; codec legacy behavior/checksum/cap,
   print, practice progress/settings, newest SHC ownership and pending-SAVE-pop,
   eight-language UI and opaque records survive. Quantify performance/storage cost
   for large instruments without arbitrary new note or saved-instrument caps.

## Interview and scope discipline

Reuse settled owner answers (separate tabs; save before LINK; distinct desired
names/layouts). Initial coexistence behavior question remains pending. Recommend
defaults rather than asking implementation trivia; ask one material decision per
question and keep independent investigation moving. Prioritize conflicts that can
lose data, exact Add dedup, Edit convergence, built-in replacement ownership and
old-client recovery. Mark provisional recommendations unmistakably. Do not ask the
owner to expose credentials, storage dumps or their browser profile.

Audit exact CLAUDE.md/ENGINE-SPEC/test policy conflicts. The owner requires explicit
approval for ANY CLAUDE.md edit; draft exact proposed wording/diff and explain the
conflict, never edit it during planning or hide a policy change in an adapter.
Main consent is always separate. No global tool/config or installation grant.

## Produce the executable plan and review it

Write docs/plans/2026-10-25-saved-scale-variants.md with linked research/coordination
and ledger entry; retain prompt/review hashes, branch/worktree/last/next/approvals.
Root planning tree /private/tmp/handpan-saved-variants.HVUKbE/planning, branch
codex/saved-scale-variants-plan-20261025. Keep SHC CI head unchanged while planning.

Include: precise problem and user journeys; evidence/state diagram; candidate
comparison and chosen minimal design; data model/equality/import/edit/selection/
built-in contracts; concrete APIs/files and migration protocol; concurrency/
failure/backup/rollback/downgrade behavior; exact instruction approval diff if
necessary; staged pre-code versus post-code gates with no circular prerequisites;
separate test/app/storage/mutant lanes and one integrator/browser lease; acceptance
matrix with literal public fixtures, intended RED→GREEN and generated mutants per
new group; old/new-client and two-target tests; negative fault injections; existing
regression/mutation floors; final independent review, exact-head full Linux CI,
actual DEV revision/affected paths and native QA limits. No self-scored quality or
promise that passing unit tests guarantees no regression.

Adversarially challenge: wrong instance overwrite, allocating after registry loss,
old boot dedup collapse, Edit becomes unwanted clone, repeated-link proliferation,
content equality losing intent, conflating built-in slot and instance, full-array
lost updates, broken old clients, quota/backup refusal, partially committed
migration, stale routes resurrecting deleted data, opaque-record destruction,
selected-focus drift, secret analytics, tests mirroring implementation, mutant
startup errors, degraded Claude behavior and rollback that restores code but not
data. Assign every blocker an owner, dependency and observable resolution.

Then obtain fresh independent ENG/design reviews of the exact plan, iterate until
material evidence-supported issues are addressed and hash-rechecked. Record which
capabilities remain untested and what needs owner input/approval. Stop after the
reviewed planning deliverable; conditional implementation is a separate decision,
not a side effect of researching this prompt.
