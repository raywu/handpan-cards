# Linear as the workstream tracker: research and phased plan

Status: RESEARCH ONLY, 2026-10-27 (lane LN, workstream afk-2026-10-27). No Linear
account, workspace, issue or write call exists or was made. Nothing here is
authorised to run; every phase below needs an explicit owner go. Builds on the queued
prompt `docs/plans/2026-10-25-linear-roadmap-investigation-prompt.md`.

## 1. Facts about Linear (each cited; re-verify at activation)

| Fact | Source |
|---|---|
| Free plan: unlimited members, 2 teams, 250 issues, 10MB file uploads. Basic $10/user/month billed yearly (5 teams, unlimited issues). Business $16/user/month billed yearly. | https://linear.app/pricing |
| Cancelling a subscription with over 250 issues blocks new issues (so 250 is a real threshold). Secondary sources say the free cap counts active issues only; official text not confirmed, so Phase 0 tests it. | https://linear.app/docs/billing-and-plans.md |
| On free plans all users are Admins. | https://linear.app/docs/billing-and-plans.md |
| Hosted MCP server `https://mcp.linear.app/mcp` (Streamable HTTP, read-write); read-only `https://mcp.linear.app/mcp/readonly`; auth by OAuth 2.1 or bearer token (OAuth token or API key). | https://linear.app/docs/mcp |
| Claude Code: `claude mcp add --transport http linear-server https://mcp.linear.app/mcp`, then `/mcp` to authenticate. Codex: `codex mcp add linear --url https://mcp.linear.app/mcp`, then `codex mcp login linear` (docs say a feature flag in `~/.codex/config.toml` may be needed). | https://linear.app/docs/mcp |
| MCP tools cover finding, creating and updating issues, projects and comments; exact tool names are not in the docs and are published at runtime via `tools/list`. | https://linear.app/docs/mcp ; https://docs.litellm.ai/docs/mcp_servers/linear |
| One authentication context per workspace; switching workspaces needs a separate context. | https://linear.app/docs/mcp |
| GraphQL API at `https://api.linear.app/graphql`; personal API key goes in `Authorization: <key>` (no Bearer), OAuth in `Authorization: Bearer <token>`. HTTP 200 can carry an `errors` array; always check it. | https://linear.app/developers/graphql |
| Rate limits: API key 2,500 requests/hour/user and 3,000,000 complexity points/hour; OAuth app 5,000 and 2,000,000; one query max 10,000 points. | https://linear.app/developers/rate-limiting |
| GitHub integration: issue ID in branch name, PR title or description links the PR; "Fixes ENG-123" moves the issue to the "On PR or commit merge" status on merge; "refs" links without closing; "ignore ENG-123" suppresses. With several PRs on one issue, status changes when the last reaches the state. | https://linear.app/docs/github |
| Cycles: time-boxed, 1 to 8 weeks, unfinished issues roll over automatically, up to 15 future cycles. Plan availability of cycles and projects is not stated on the fetched pages; verify on Free in Phase 0. | https://linear.app/docs/use-cycles |
| Initiatives group projects; team initiatives need Business, initiative views Enterprise. | https://linear.app/docs/initiatives |
| Export: workspace issue CSV (admins; link expires after 12 hours; no attachment files; teams not exportable); Markdown copy of an issue with comments; API and webhooks for programmatic export. CSV is not a complete backup. | https://linear.app/docs/exporting-data |

Conflict noted: one aggregator says Linear has no official MCP server (https://codegen.com/mcp/linear/); Linear's own docs above contradict it, so the docs win.

## 2. What is tracked today

- `docs/WORKSTREAMS.md`: a ~1,100-line append-mostly ledger (newest section first) mixing status, owner decisions and handoffs; both owner and agents edit it.
- `docs/plans/*.md` (about 100 files, many `*-coordination.md`) plus `docs/plans/2026-10-25-plan-inventory.json`.
- `docs/DEVELOPMENT_CONTINUITY.md` and `docs/handoff/` (shared memory for Claude and Codex).
- Claude memory `queued-*.md` files (about 50, outside the repo, Claude-only, so Codex cannot see them).
- PRs and CI on GitHub (gates stay there).

Pain points a tracker should fix: two agents reading different stores; the ledger is too long to read cold; "approved vs proposed vs delivered to DEV vs released to main" states live only in prose.

## 3. Mapping

| Today | Linear | Notes |
|---|---|---|
| The repo / product | One team `HPC` (Free allows 2 teams) | Second team spare for another repo |
| A workstream (e.g. SAVED-SCALE-VARIANTS) | A Project with a one-sentence description and a link to its plan doc | Projects on Free: verify in Phase 0 |
| A lane or task | An Issue under the project; PR linked by `Refs HPC-n` | |
| Delivery state (planned, building, on DEV, DEV-QA passed, held for main, released) | Workflow statuses on the team, plus labels `paused`, `main-held` | Keeps the DEV-before-main rule visible |
| Owner decisions / open questions | Issues labelled `owner-decision`, assigned to the owner | Replaces "waiting on me" prose |
| Owner's ranked priority chain | Issue priority plus a `chain-n` label | Ordering is the main thing the owner asks for |
| Cycles | Skip initially | Work is bursty and AFK; avoids rollover noise |
| Initiatives | Skip | Business/Enterprise for team initiatives |

Free-tier arithmetic: 250 issues (that the cap counts active issues only is UNVERIFIED; no Linear doc is cited for it). About 25 open workstreams at about 5 lanes each is about 125 issues. Do not import history as issues.

## 4. Open workstreams to migrate (from memory `queue-2026-10-27-afk.md` and `docs/WORKSTREAMS.md`; reconcile against live refs at Phase 2)

- Serial app chain (owner ranking 2026-10-27): SV-PG then SAVED-SCALE-VARIANTS to DEV; swipe Scale/Layout (branch `codex/sheet-tab-swipe-20261025`, held through DEV); built-in palette defaults (`2026-10-26-built-in-palette-defaults.md`); landscape Settings/Resources menu (`2026-10-26-landscape-settings-menu.md`); deferred nits OF-D, I18N-D, Q9.
- Parallel, no app code: repository rename (cut to GitHub rename + redirect + remote + folder move, owner-gated); codebase audit (read-only); SEO long-tail; this Linear plan; agent-quality comparison; MUTANT-NEOTONE (blocked on owner answers).
- Held or paused: duplicate notes (paused until further notice); Mac M2/M3/C1 (not selected); main PRs held for owner release (i18n A, order-free, order-follow items per memory).
- Done, record once: RC 3542 released to main 2026-10-26 (the ledger says Actual-main CI 40448555197 was still running; recheck).
- Stopped ideas (Audio, stats, SM-2, PWA): one `stopped` label description, not issues.
- Closed history stays in the repo; do not migrate it.

## 5. Agent read/write design

- Claude Code and Codex both attach `https://mcp.linear.app/mcp` (section 1). Default agents to the read-only endpoint; lane agents get no write access. Writes (status moves, new issues, comments) go through the integrator only, matching today's rule that lanes do not own shared state. Lanes report in their return schema; the integrator posts it.
- Fallback when MCP is unavailable or OAuth lapses: GraphQL with a personal API key stored outside the repo, through a small read helper that checks the `errors` array on HTTP 200.
- PRs carry `Refs HPC-n`. Use `Fixes` only where merging should move the issue to Done; since DEV merges precede main and main needs owner consent, prefer `Refs` and move statuses by hand, so GitHub does not mark work Done at a DEV merge.
- Tool names change at runtime (`tools/list`), so instructions must say "list tools first", not hard-code names.

## 6. What stays in the repo

Plan documents, prompts, handoff docs, CLAUDE.md, engine specs and all CI gate evidence (CI conclusion at the head SHA remains the merge gate). Linear holds the index: status, ordering, owner decisions, links to plan file and PR. `docs/WORKSTREAMS.md` becomes a frozen archive with a header pointing at Linear, plus a periodic read-only snapshot (Phase 4) so a clone without Linear access still shows state.

## 7. Costs

Free: $0, unlimited members, 2 teams, 250 issues (https://linear.app/pricing). One human plus agents on the owner's login or API key implies no extra seats (verify OAuth app-user terms before creating a separate agent identity). Upgrade only if the 250 cap binds (active-only counting is UNVERIFIED): Basic is $10/user/month billed yearly, so $120/year for one seat. Rate limits (2,500 requests/hour on API key) are ample for this volume.

## 8. Risks

1. Free cap of 250 issues: one issue per lane, close finished ones; test whether completed issues leave the count (Phase 0).
2. Continuity loss: exports are CSV without attachments and links expire in 12 hours (https://linear.app/docs/exporting-data); mitigated by the repo snapshot in Phase 4.
3. Two sources of truth during migration: hard cutover date and archive header.
4. Agent access: OAuth sessions lapse, workspaces need separate auth contexts, Codex needs a flag. An agent that cannot read Linear must fall back to the snapshot, not guess.
5. Prompt injection: issue text is untrusted data; the read-only endpoint limits damage.
6. GitHub auto-closing issues at a DEV merge against the DEV-first rule (section 5).
7. Feature availability on Free (projects, cycles, GitHub integration, API) is not stated in the fetched text-only pages; Phase 0 verifies each separately.
8. Vendor or pricing change.

## 9. Phases (each needs an owner go; none touches app code)

**Phase 0, feasibility (owner creates a throwaway Free workspace).** Create one team, one project, 3 test issues, one cycle; install the GitHub integration on a scratch repo; attach Claude Code and Codex to the read-only then the read-write MCP endpoint; complete and archive issues and watch the active count.
Acceptance: a pass/fail table for projects, cycles, labels, statuses, GitHub link by `Refs`, MCP list/create/update from Claude, the same from Codex, API-key GraphQL read, and whether completed issues leave the 250 count.
Verify: the agent runs `tools/list` and one read call per client; output pasted into the table.

**Phase 1, schema.** Configure team `HPC` in the workspace the owner names (an owner question, 8 below: this workspace or a separate one), statuses and labels from section 3; draft the convention note and a proposed CLAUDE.md diff (shown for approval, not applied).
Acceptance: each of the delivery states maps to exactly one status or label.
Verify: a Claude read of the workspace lists them; the owner reviews the diff.

**Phase 2, import open work.** Create projects and lane issues from section 4 only, each with its one-sentence description and plan link, after reconciling with live PR and branch state.
Acceptance: every open workstream in section 4 has a project with a description; active issues under 150; no closed history imported.
Verify: an agent lists projects and issues via MCP and diffs against section 4 and `gh pr list`; the owner spot-checks.

**Phase 3, dual-run.** One week where the integrator updates both Linear and WORKSTREAMS.md; lanes and Codex read Linear.
Acceptance: no status disagreement in a daily diff; a Codex session and a Claude session give the same "what is next" from Linear.
Verify: the two answers captured side by side.

**Phase 4, cutover and snapshot.** Freeze `docs/WORKSTREAMS.md` with an archive header; add a read-only markdown snapshot of Linear state to the repo (tool to be planned separately).
Acceptance: header points to Linear; a fresh clone finds the last snapshot; owner approves the CLAUDE.md wording.
Verify: a cold-start agent given only the repo and Linear access resumes the top-ranked work correctly.

**Phase 5, review.** After two weeks measure active issue count, stale issues and agent read failures.
Acceptance: a written keep, upgrade or revert decision; the revert path is the archived ledger plus the snapshot.
Verify: the metrics are listed in the decision note.

## 10. Open questions for the owner

1. Do you want Linear at all, given the repo ledger works and Linear adds another store beside memory files? (Recommendation: yes, as an index only, repo stays archive.)
2. Which login do agents use, yours or a separate agent identity?
3. Should lane agents ever write, or the integrator only (recommended)?
4. Encode DEV-before-main as statuses (recommended) or labels?
5. Cycles: skip (recommended) or weekly?
6. Retire memory `queued-*.md` in favour of Linear, or keep them as Claude-private notes?
7. May GitHub auto-move issues to Done on PR merge, or only the integrator?
8. Other projects: second team in this workspace or a separate workspace?
9. May a throwaway workspace be created for Phase 0?
