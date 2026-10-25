# Workflow reference index

This index locates existing definitions and reports capability boundaries. It does
not install skills, import private global instructions or change Claude's startup
behavior. Project requirements remain in [CLAUDE.md](../../CLAUDE.md), with the
existing [AGENTS.md](../../AGENTS.md) entry point and [test contract](../../tests/CONTRACT.md).
Use the shared [browser runbook](../testing/browser.md) when selecting checks.

## Start or resume a session

The owner-selected shared locator is [WORKSTREAMS.md](../WORKSTREAMS.md) on remote
**DEV**, not whichever branch contains this index. Resolve the repository's remote
DEV commit through an authorized GitHub read or fetch, then read
`docs/WORKSTREAMS.md` at that immutable commit. Report the commit and freshness.
Feature/main copies are snapshots. Missing access means stale/unavailable; never
reset another checkout or silently use a cached copy as current shared state.

The ledger links retained plans, coordination snapshots, source branches/PRs,
host-local worktree locations, decisions, last actions and exact continuation.
Read the selected stream's scope and current PR/CI state before doing work.
Local paths may not exist on another host. Recover from advertised refs in a new
clean authorized checkout; preserve dirty/locked trees and uncertain ownership.

Explicit bootstrap prompt for a new agent:

> In raywu/handpan-cards, read the existing repository instructions. Resolve the
> current remote dev commit and read docs/WORKSTREAMS.md at that exact commit.
> Select the requested stream, inspect its retained plan/coordination references
> and live PR/head/review/CI state, and restate its last confirmed action, next
> action, acceptance and approval boundaries before writes. Report unavailable
> context or ownership conflicts; do not infer main or CLAUDE-change permission.

This is a user-supplied bootstrap, not automatic discovery. No existing instruction
file was changed to require Claude or another harness to follow new lifecycle
steps. Publishing Codex's state makes it available to other agents; it does not
claim they already load it automatically. A later pointer/loader change needs its
own load-impact assessment and authorization.

## Definitions and current disposition

Source aliases identify independently inspected repositories, not installed tools:

- `dotfiles@4b5fadc3ec688bdc1fdaae97bfcc5b9ca736706a`: the owner's dotfiles
  clone, normally beside this repository. Only cited skill/contract files were
  checked; unrelated dirty files remain untouched.
- `gstack@636175d3496e1f5087d65522e69d314584c7b236`: the inspected gstack
  source clone, reachable on the original host through `~/.claude/skills/gstack`.
  That path is not promised on another host.

| Workflow | Canonical definition / references | Disposition in this batch |
|---|---|---|
| `/swarm` | dotfiles `claude/skills/swarm/SKILL.md`, `claude/skills/_shared/coordination-contract.md`, referenced lane/reviewer agents and schemas | Reference only. This host has demonstrated separate native agent contexts; that alone does not validate the entire original workflow. No adapter installed. |
| `/plan-eng-review` | gstack `plan-eng-review/SKILL.md` and its referenced sections/helpers/templates | Reference only; independent project plan review has been used, but native loading and full transitive runtime parity remain unverified. |
| `/plan-design-review` | gstack `plan-design-review/SKILL.md` and referenced sections/tools | Reference only; preserve its actual stages, state/journey evidence and missing-coverage labels when an adapter is later approved. |
| `/review` | gstack `review/SKILL.md`, plan-completion, specialist/adversarial sections and transitive dependencies | Reference only. Original parent can fix; independent children report. Do not claim author self-review is independent review or inherit helper mutation authority. |
| `/codex` | gstack `codex/SKILL.md`, explicit review/challenge/consult mode and referenced sections | Retain original purpose: outside review/consultation. A native child is not automatically an outside harness/provider. Do not recursively invoke the same harness or transmit private global instructions. No replacement activated. |
| “check in” | Existing repository AGENTS/CLAUDE check-in contract; original global prose is host-local | Existing project behavior: fresh stream status, then interview unresolved items with recommendation first; retain answers. This is not a newly registered slash command. |
| Browser/DEV validation | Shared `docs/testing/browser.md`, candidate test titles, current CI workflow and test contract | Released shared runbook; targeted Chromium and exact-head Linux CI demonstrated. Full Mac suite remains unresolved. |

These are source locations, not instructions to execute unfamiliar scripts.
Inspect the complete original definition and all transitively referenced runtime,
template, tool and lifecycle dependencies before adapting a workflow. Missing
source, tool, auth, actual delegation or required review blocks the dependent
claim. Discovery, configuration, authentication, authorization and demonstrated
execution are distinct. Do not copy bodies, run a global installer or silently
substitute sequential reasoning for independent workers.

The actual gstack engineering outside voice is optional/nonblocking; absent outside
coverage earns no outside-review credit. Source helpers can write logs/state or
sync artifacts, and some success flags can conceal skipped coverage. Referencing
those definitions does not approve their side effects. This index closes no
transitive-dependency or operational-parity gate by itself.

## Ledger publication and recovery

One integrator publishes Codex's ledger records through normal reviewed PRs into
DEV. Workers report owned progress to the integrator; the index is not a distributed
lock. Record creation/assignment, meaningful progress, decisions/blockers,
interruption/handoff, PR/head changes and integration/verification. Creation plus
final PR alone does not preserve the intermediate continuation point.

Retain plan/coordination checkpoints on advertised refs and verify them before
claiming cross-host recovery. Never publish credentials, private instruction bodies
or raw session/network traces. Uncommitted and temporary evidence remains local.
A record's checkpoint is last-observed state; resolve live PR/branch state and
investigate intervening changes before resuming. The ledger's own publication
commit is the external DEV SHA used to read it, not an embedded self-hash.

See the [bootstrap plan](../plans/2026-10-24-repo-continuity.md) for exact scope,
publication gates, negative recovery cases and rollback. Future main→DEV syncs
must preserve DEV ledger updates through reviewed merges rather than replacing
them with an older main snapshot. This does not authorize any main merge.

## Product documentation references

[Official OpenAI AGENTS.md documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
was fetched during this batch. It describes per-directory instruction discovery,
precedence and size limits; it does not establish that this Markdown index or
linked global definitions are automatically loaded. Existing repository pointers
still require actual reads. No default, fallback, installation or loader setting
was changed here.
