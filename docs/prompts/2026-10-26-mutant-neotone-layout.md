# MUTANT-NEOTONE: evidence-led future implementation plan prompt (v3)

Status: FUTURE WORK, planning only. Latest owner request permits this prompt/plan
and independent reviews; all implementation remains paused for Claude handoff.
Do not delay current RC/QA or activate tools, edit app/agent config, install,
commit/push, change CLAUDE.md or implement hardware/MIDI/audio integration.

## Goal and supplied reference

Draft docs/plans/2026-10-26-mutant-neotone-layout.md for offering a Mutant Neotone
layout choice in Add/Edit, assigning a scale to primary and secondary playing
areas across the instrument. User says secondary notes can mimic bottom notes.
Do not turn that statement into an unapproved physical/engine-zone equivalence.

Screenshot: /tmp/codex-remote-attachments/01a16cd2-235e-7171-af22-8f35dfe93709/F3935916-48AC-4262-B97D-7E2CD275715E/1-Photo-1.jpg.
It shows one central field and visually nine surrounding paired large/small
regions, some small regions unlabelled. Treat topology as observation, never an
exact geometry/dimension/tuning/firmware specification. No automatic use of its
example note pitches; preserve privacy and document local-only reference status.

Primary sources consulted: https://play.digitalhandpan.com/ confirms distinct
mutant areas within tonefields. https://manual.digitalhandpan.com/contents is
current manual4.0, explicitly in progress and warns screenshots may be older.
Legacy https://digitalhandpan.com/neotone-one-user-manual.pdf now redirects to
manual root; indexed old snippets mention11tonefields. Reconcile revision/count
conflicts rather than treating a screenshot/index snippet as hardware authority.
Some individual wiki pages are inaccessible in this runtime; record unavailable.

Frontend guidance: consult existing design system/CLAUDE sheet requirements and
browser/test contracts first; local gstack plan-design-review/SKILL.md (UX,
interaction state, mobile44px, wayfinding), and implementation-skill compatibility
only where relevant. No gstack bootstrap/telemetry/global modification or new
Pretext/library/framework activation. Report reference consultation separately
from native skill execution. No new DESIGN.md for an established visual system.

## Independent investigation and decisions

Read current release baseline3542d6ea and future variants2a260d21 separately.
Inspect actual engine core/layout/render/voicing/share/import, app Add/Edit/SAVE/
LINK and tests, print/PDF pipeline. Verify filenames/symbols before listing edits.
Record source paths/ref and Verified/Partial/Unverified/Unavailable findings.
Distinguish pitch class, exact pitch+octave, stable note occurrence, physical slot,
ring/shell semantics, geometry and saved-instance identity. No deckId-only mapping.

Compare minimal approaches: geometry-only preset vs explicit physical-slot map vs
separate instrument mode. Recommend one with justification; avoid a new parallel
engine/renderer unless existing abstractions cannot preserve contracts.

Questions to analyze explicitly:
- Model/revision, playable pitched areas vs body/percussion/MIDI areas;19-slot
  topology provisional pending evidence/owner reference confirmation.
- Explicit per-slot assignment with deterministic suggested mapping and preview;
  never silently sort/remap, truncate, drop excess pitches or fill repeated pitches.
- Empty secondary slots,19/under/over capacity, inner notes, repeated pitches,
  enharmonic spelling, octave and English scale grammar unchanged.
- Acoustic-bottom vs secondary semantics, chord voicing/highlights/badges/numbers/
  difficulty/playability. Do not claim ergonomics from visual proximity alone.
- Existing mirrored/free-angle/order options when switching presets, draft/Cancel/
  tab state and reversible restoration. No silent loss of custom acoustic layout.
- Encode full layout/map in durable records, URL/LINK/checksum and identity;
  old links/records/clients behavior, cap, refusal vs newer-app, corrupt/untrusted
  map validation, future variants concurrency/dedup/conflict handling.
- Website single-file/offline constraints, source-inline synchronization and
  generated builtins unchanged, SVG hit boundaries for overlapping shapes,
  phone keyboard/list alternative, visible44px controls, focus and accessible labels.
- Practice modes/highlighting/print browser+Python PDF parity; either support the
  new profile consistently or clearly block only unsupported export, not scales.
  Any changed export contract needs owner approval and explicit warning/plan.
- No dependency on resuming paused duplicate-note feature: scope supported pitches
  separately, and mark true duplicate capability dependencies explicitly.

## Required plan output

1. Executive recommendation, future status/scope and no-implementation boundary.
2. Evidence/revision table; screenshot observation vs verified specification.
3. Product decisions and short owner interview packet with recommendations;
   AFK defaults provisional, exact hardware/spec/approval gaps remain gates.
4. State/assignment matrix for Add/Edit/switch/Cancel/SAVE/LINK/reopen/conflict/
   session-only/unsupported-layout/invalid/missing/overflow/duplicate scenarios.
5. Plain text wireframe in current Scale/Layout flow, phone/landscape/keyboard and
   read-only visualization states; preserve established fit/target/typography limits.
6. Data/geometry/semantics/serialization/engine/print architecture and exact proposed
   file paths (verified where possible), dependencies, risks and rejected approaches.
7. Swarm lanes with file ownership, separate worktrees, sole integration/browser
   lease, frozen fixtures, independent reviewers and dependency order.
8. Meaningful spec-first TDD/mutants, unchanged builtin snapshots and old wire/record
   corpus, saved-variant coexistence, exact-pitch highlight/slot tests, malformed-map
   fuzz/property tests, visual-fit/keyboard/touch/locale/font and PDF parity gates.
9. Acceptance matrix: input, observable pass/fail, concrete existing baseline and
   future evidence; no tests run merely for this documentation task.
10. Phased approval-gated implementation, rollback/data preservation and Claude
    continuation breadcrumbs; no migration/start until owner resumes.
11. Adversarial review: hidden notes, remapping, wrong physical semantics, ID reuse,
    sharing loses layout, duplicate dependency, unsupported-device assumption,
    hit ambiguity, overflow, print mismatch and interrupted draft/concurrency.

## Quality/iteration contract

V1 self-critique: a generic layout-preset prompt omitted note-occurrence identity,
secondary/bottom distinction, persisted slot maps, older-client behavior and
paused-feature/RC boundaries. V2 explicitly closes those defects above.
Execute V2 to generate the plan, then independent engineering and design reviewers
must challenge its actual output. Revise material findings and rereview changed
sections. Do not claim '10/10' from self-scoring; quality means evidence-qualified,
implementable after decisions, no unresolved material planning omissions and
honest hardware/UX unknowns. Record review dispositions and retained limitations.
Fourth failed review round triggers regroup, not endless prompt expansion.

## V3 lessons from actual V2 output review

Actual output's first independent review found four concrete omissions. Require:
- Wirev7 only for profile-bearing payloads; old acousticv6 writers/checksums stay
  byte-identical. Audit global VERSION use, not only decoder compatibility.
- Pinned old-client Save/Edit/delete/RESET/whole-library rewrite/reload must preserve
  new profile records. New rec.v alone is insufficient if identity ignores it.
  Namespace/capability strategy is a launch gate, not chosen storage architecture.
- Reset previews proposal with Apply/Cancel, preserving old manual map on Cancel;
  Apply remains draft-only until Save.
- Disable already-assigned occurrences with accessible location explanation;
  explicit clear/reassign only. Incomplete profile commit has inline+summary errors,
  first-invalid-row focus and acoustic return preserving the whole scale.
V2 was executed to draft the plan; root applied V3's focused amendment pass to that
output and both independent reviewers reread/cleared the revised plan. This is
recorded iteration, not an untested claim of a perfect score.
