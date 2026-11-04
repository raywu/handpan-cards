# Prompt: plan a user-clicked domain move (handpan.raywu.org -> handpantheory.com)

Do not invoke /reviewed-plan; produce the plan directly. Planning only: no code, no commits, no pushes, no Linear writes.

## Goal
Replace the silent move (old host runs `moveForward()` at boot and calls `location.replace(MOVE_TARGET + ... "#move=<payload>")`)
with a move the visitor starts by clicking. Saved scales still travel with the move. Write the plan to
`docs/plans/2026-11-04-click-to-move.md` in /Users/ray/Projects/handpan-cards.

## Why
Google Safe Browsing flagged handpantheory.com on the day #825 armed the silent redirect (owner confirmed first-detect date
= redirect date). Report: `docs/plans/2026-11-04-safe-browsing-report.md` (sections 5, 6 item 3, "Re-arm recommendation",
"Owner update"). Owner instruction 2026-11-04: "We should incorporate a user click to move."

## Requirements (owner, hard)
- Saved scales migrate with the move (memory: project-move-must-migrate-scales; CLAUDE.md "Release safety").
- The old host keeps serving the full, working app. No automatic navigation away from it, ever.
- Share links stay backward compatible forever; an old-host `#s=` / `#deck=` link must still open on the old host.
- Shipping this code keeps `MOVE_FROM` and `MOVE_TARGET` null. Arming is a separate one-line PR, gated on: Search Console
  shows no issues for handpantheory.com, and the owner's explicit go. The plan must not schedule or assume the arm.
- Served-DEV e2e proving every saved scale transfers before any main merge of the move (memory feedback_move_e2e_gate).
- Every UI feature ends with i18n: keys in every `data/i18n/*.json` table, `python3 tools/sync_i18n.py`, audit, fit check.
- Visible text says "scale", never "deck". Product name "Handpan Theory".
- Dev-first release flow per CLAUDE.md "Release and CI gates"; main merge needs the owner's words.

## Non-goals
DNS, Cloudflare settings, `_redirects`/server 301, canonical tags, sitemaps, Search Console Change of Address, re-arming,
deck data, engine, share-link format changes.

## Sources to read
- `index.html`: the block under `saved-scale handoff` (MOVE_* constants, `moveThenOk`, `moveEncode/Decode`, `movePayload`
  receiver with referrer check, `moveForward`, `moveImport`, `moveNotice`, `moveReport`) and the `go` section (`moveFlow`,
  `savedReady`, `if (!MOVE_ON_OLD) loadAnalytics()`).
- Tests that cover the move (grep `MOVE_`, `move=`, `moveForward` under `tests/`), and how they arm the constants.
- Earlier plans: `docs/plans/2026-10-31-move-fold-arm.md`, `2026-10-31-move-overcap.md`, `2026-10-31-move-unarm.md`,
  `2026-11-03-move-rc.md`, `2026-10-31-handpantheory-domain-migration.md`.
- `docs/CARD-SPEC.md` for the visual system and any notice/banner conventions; `docs/testing/browser.md` for the DEV check.
- Memory files in `~/.claude/projects/-Users-ray-Projects-handpan-cards/memory/`: project-move-must-migrate-scales.md, feedback_move_e2e_gate.md.
- `tests/mutants/` conventions and memory notes listed in the project MEMORY.md about mutants and FLOORS.

## Questions the plan must answer (with evidence)
1. UI on the old host: where the "moved" prompt lives (banner, sheet, menu row), copy, dismiss behaviour, whether it
   persists across visits, keyboard/screen-reader access. Must not block using the app.
2. Click mechanics: the payload `#move=...` URL is built only inside the click handler (not present in the DOM or HTML for
   crawlers); navigation is a top-level same-tab navigation by user gesture. Is an `<a>` with href set on click or
   `location.assign` better for referrer delivery and popup rules? Verify the referrer the receiver will see (served
   Referrer-Policy on both hosts; `curl -sI` is fine, read-only).
3. Receiver: keep referrer gate and `moveThenOk` hash allowlist? Import automatically on arrival (user already chose) or ask?
   What happens on overcap (existing binary search), zero scales, protected/session storage modes, repeat clicks
   (idempotent import via the digest keys). Say whether the prompt appears when the visitor has no saved scales, and what clicking it does then.
4. Analytics: old host currently skips `loadAnalytics()` when armed. Does that change?
5. Propose the smallest diff and compare it against at least one alternative, with evidence for each.
6. Tests first: which existing tests change (silent-jump tests become "no navigation at boot" + "click navigates"), new
   e2e for the click path, mutants killed, FLOORS/README count updates.
7. Lanes: likely one serial lane (index.html + i18n + tests share ownership). Say so if it does not split.

## Plan shape
Goal, non-goals, decisions (tag each owner / AFK-recommended / past decision), assumptions (each verified with a command or
gated), why smallest, phases (prereqs, owner, deliverable, observable acceptance, verify command), verification split
automated / self / independent reviewer / human (owner DEV QA on iPhone: tap the prompt, land on the DEV target, scales
present), risks, edge cases, recovery (revert lane; constants null means no user impact), continuation point, stop.
State how the served DEV check arms the move without shipping non-null constants (e.g. a DEV-only overlay PR into `dev`, reverted after QA, or a test-only override), and name which host plays old and which plays target. Note the DEV environment has a single host; say how the e2e simulates two hosts (existing test approach) and how the served
DEV check is done.

## Rubric (frozen; reviewers grade against it)
Readiness criteria 1-9 read from `~/.claude/skills/reviewed-plan/SKILL.md` section 8 (Read only; do not invoke the skill), plus: (T1) no automatic navigation from the old host in any code path;
(T2) payload URL never appears in served HTML/DOM before the click; (T3) constants stay null in the shipped lane;
(T4) every scale under `MOVE_CAP` transfers in the e2e; over the cap, the plan states what the visitor sees about scales left on the old host and how they move them; (T5) old share links unaffected.

## Stop
Plan file written; report its path, open questions for the owner (max 4, recommended option first), and
`pending-linear-writes` (`[]` if none).
