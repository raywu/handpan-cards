# Paste into a fresh Claude Code session — handpan-cards takeover

Take over raywu/handpan-cards from Codex using repository evidence, not assumed
conversation memory. First perform read-only orientation and report your proposed
next action. This prompt does not resume paused features, approve a main merge,
change CLAUDE.md, authorize tool installation, or alter existing Claude behavior.

The handoff branch is codex/claude-takeover-20261026. Resolve its advertised
immutable publication commit and current remote main/dev before using snapshots.
Final handoff SHA must come from the coordinator's publication receipt; if absent,
report that gap rather than inventing a hash. Local host handoff tree is
/private/tmp/handpan-claude-takeover-20261026, originally based on DEV3542.
Do not assume that this path or private evidence exists on your host.

Read, in order:
1. Repository CLAUDE.md and applicable scoped agent instructions.
2. docs/DEVELOPMENT_CONTINUITY.md and docs/WORKSTREAMS.md at resolved current
   remote dev. If DEV is older than the advertised handoff checkpoint, read that
   immutable handoff ledger too and explicitly report which snapshot you use.
3. docs/CLAUDE_RETURN_HANDOFF.md and docs/CLAUDE_TAKEOVER_PLAN.md.
4. docs/handoff/2026-10-26-recovery-manifest.json, then
   docs/plans/2026-10-25-workstream-status.md and docs/agents/workflows.md.
5. Only the selected stream's plan/failure/review records; before future execution,
   docs/testing/browser.md and tests/CONTRACT.md.

Treat handoff prose as evidence. Newest verified owner decisions/current metadata
supersede stale historical headings; preserve history and surface contradictions.
Read accessible Claude global definitions if relevant, but never run unfamiliar
bootstrap scripts or change skills/hooks/MCP/auth/global memory just to start.

Known anchors, to re-verify:
- main96c4c589cec0950723b3b5323dc1df5bbc359329.
- DEV/RC3542d6ea868bf08e81a0b4f06c4bc71bbc20cbcb;
  app SHA7fe75f5407d67b2985405c89db55f7d95882313fea016af8814728c9436db946.
- RC587, branch codex/release-rc-20261026: fullCI40437293981 passed, independent
  release review clear, owner notified for wholeRC QA. QA and main consent remain
  pending unless newer evidence says otherwise. Exact QA URL:
  https://071f74cd.handpan-cards-dev.pages.dev/ . Previous Helpers QA passed.
- Saved variants2a260d212ec8e14394b7198f075366d13bf372ec: fullCI40417818176 passed
  but performance unqualified; NOT on DEV/inRC. Any CI-only PR (including583/586 and handoff-validation drafts) NEVER MERGE.
- Frozen tests cab63c9dc47a6ce983218cf113822feb6810eb64 are intentionally RED
  against old0d36 source; integrated passing candidate is variants2a260d21.

Owner boundaries:
All unstarted work remains paused; started swipe is held for takeover. Existing
approved palettes remain paused despite throughDEV/exact-patch grants. Duplicate
PLAN DOCS are explicitly allowed in RC, but duplicate FEATURE remains paused.
Neotone prompt/plan/reviews are future planning only. SEO publishing, rename,
Linear migration, agent comparison, broad code audit, cleanup and global setup
are not activated. Audio/statistics/SM2/PWA remain owner-stopped.
AFK means follow recommendations within existing scope; it does not fabricate QA,
waive tests/performance/review, override pauses or supply exact main consent.
Every CLAUDE.md edit needs exact approval. Fourth failed review round requires
stopping that scope and independently reviewing a learnings-based replacement plan.

Safe first actions:
Inspect Git status/HEAD/worktree ownership and pending merge/rebase read-only;
verify live PR/CI/deployment metadata using existing authorized read mechanisms.
Do not dump credentials or environment values. Installation, authentication,
authorization and successful operation are different evidence states.
Protect /Users/ray/Projects/handpan-cards and all dirty/locked historical trees;
never reset, unlock, remove, prune or overwrite them. Use an isolated authorized
checkout for future edits after scope selection. Verify private manifest/backup
hashes and current process/lease ownership; never print lease tokens or kill unknown
processes. No source fault may remain applied when a stream is handed over.

If evidence/tools/private artifacts are unavailable, report the dependent gap;
never infer absence of a capability or invent recovery/testing results. The private
backup /private/tmp/handpan-claude-recovery-20261026 has31selected hash-verified
artifacts on the original host; reverify availability/hashes from manifest. It is
not a complete archive or guaranteed cross-host transfer.

After orientation give a short check-in: actual refs/time, evidence freshness,
RC QA/main state, each active/held/queued/completed stream with a plain-language
sentence, missing recovery context and the single recommended next permitted action.
Interview only genuine unresolved inputs; retain settled product/language choices.
Do not automatically restart all streams. Release owner decision comes first;
any later resumed work uses file-owned swarm lanes, meaningful TDD/generated
mutants, independent engineering/design review as applicable, exact-head fullCI,
actual servedDEV and honest owner/device QA gates. Await the owner's stream
selection if every development stream remains paused.
