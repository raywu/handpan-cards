# Codex follows Claude browser QA — queued adoption plan

Status: QUEUED, planning only. No active instruction/configuration changes.
Owner clarification (2026-11-10): this is a Codex-specific rule following Claude's
existing paradigm. Claude's instructions, installed skills and behavior stay unchanged.
Stable key: `handpan-cards#browse-first-validation`; tracker: TRI-72.
Execution trigger: Claude handoff plus explicit scoped pilot execution approval.
The pilot does not automatically block authorized login/sync polish.

## Scope and decisions

- REQUIREMENT: Codex uses Claude's existing installed gstack `/browse` workflow for
  agent-driven browsing, UI inspection, screenshots and DEV smoke/visual QA.
- REQUIREMENT: replace custom agent probes; preserve existing CI browser coverage
  until a separately reviewed replacement demonstrates equivalent coverage.
- REQUIREMENT: no changes to Claude global/project instructions, skills, hooks,
  settings, browser configuration or behavior. No general policy imposed on Claude.
- RECOMMENDATION: one thin Codex-only adapter referring to the installed workflow,
  not a copied or forked `/browse` skill and not a new browser framework.
- QUEUED ONLY: no files outside this plan/prompt, no installs, browser launches,
  authentication, app/tests/CI changes, deployments or main merges now.

## Evidence and attribution

Claude already has “Use the `/browse` skill from gstack for all web browsing” in
`~/.claude/CLAUDE.md`. This resolves to
`~/Projects/dotfiles/claude/CLAUDE.md`; treat both as read-only reference, not targets.
The installed canonical workflow is `~/.claude/skills/gstack/browse/SKILL.md` and
its referenced `sections/command-list.md`. Do not copy either into a Codex fork.

Official OpenAI documentation, fetched 2026-11-10:
https://learn.chatgpt.com/docs/agent-configuration/agents-md#how-codex-discovers-guidance
Codex reads its home `AGENTS.override.md`, otherwise `AGENTS.md`, at session start;
project guidance is then layered root to working directory. Default home is
`~/.codex`, subject to `CODEX_HOME`. This documents the entry point, not this
machine's successful loading or gstack operational compatibility.
Local check: active Codex home `/Users/ray/.codex`; neither global file exists.
Future execution must recheck home, override shadowing, instruction limits and
project precedence. Do not raise limits or rewrite project rules as a shortcut.

Dotfiles already has dirty `claude/CLAUDE.md`, `claude/settings.json` and
`codex/config.toml`. Preserve all of them. Its `install.sh` rewrites Claude links,
can install tools and installs a post-merge hook that runs that installer.
Do not run the installer, or pull/merge commands that trigger it, for this adoption.
The narrow approved Codex-only source/link change must not execute broader setup.

Installed `/browse` documents Aside first (real user sessions), or its supported
headless `$B` fallback. Aside was absent from PATH; fallback binary existed.
Neither is validated as operational for Codex. The skill has Claude-specific
model/preamble language; a `--model` parser flag alone is not proof of Codex support.
Do not impersonate Claude, claim native slash-command/model parity, skip consent,
or edit the shared skill to make a host adapter work.

The stalled editor jobs were ad-hoc commands: BSD sed failed to extract the test
selector, an entire header became the regex, and raw Node bypassed the existing
outer timeout; summary grep hid output. Exact Node/CDP wait remains unknown.
This is not proof that the repository framework is faulty. A temporary served
probe reused the existing helper/runner and passed 3/3 in 1.52 seconds once free.
Durable evidence: merged PR1003 comment6753288695 and TRI-28 lifecycle history.
Temporary logs are historical artifacts, not required fresh-session dependencies.
Distinguish pre-existing repository CI infrastructure from Codex-added probes.

## Exact proposed Codex rule — inactive

Proposed canonical file: `~/Projects/dotfiles/codex/AGENTS.md`, exposed as
`$CODEX_HOME/AGENTS.md` (currently `~/.codex/AGENTS.md`) only after approval.
Do not install a global override file or clobber a newly present file.

> Codex only: follow Claude's installed gstack `/browse` workflow for agent-driven
> browsing, UI inspection, screenshots and DEV smoke/visual QA. Read
> `~/.claude/skills/gstack/browse/SKILL.md` and the references needed for the task;
> use its supported tooling and preserve its evidence, privacy, consent and
> tab/session-ownership contract. Do not copy/fork the skill, impersonate Claude,
> or modify Claude's instructions, configuration or behavior. Do not create or
> depend on custom browser drivers, ad-hoc probes, timing or profiler frameworks.
> Retain required repository CI browser tests, race/fault coverage and human QA.
> If the installed workflow cannot operate through supported Codex tools, report
> the exact blocker; do not invent a driver, install tools, bypass a check or
> reinterpret `/browse` as success. Report instruction conflicts rather than
> silently overriding project requirements.

The canonical skill remains the behavior source; the adapter only routes Codex to
it. Any Codex-specific invocation details must be verified and documented in the
Codex adapter, not patched into Claude's workflow. No automatic prompt-string
replacement of `--model claude`, invented flags or omitted lifecycle steps.
If no compatible invocation exists, dependent QA remains blocked pending a
separate owner decision. This plan cannot certify runtime parity from reading.

## Proposed files and preservation boundaries

| Path | Future responsibility / acceptance / rollback |
|---|---|
| `~/Projects/dotfiles/codex/AGENTS.md` (new, Codex-only) | Thin rule above; no duplicated skill or unrelated rules. Review exact diff before activation. Remove only the owned section/file on rollback. |
| `$CODEX_HOME/AGENTS.md` (new link if absent) | Link to that one canonical source. Verify target and fresh-session loading. If absent create safely; if unexpected file/link exists, stop rather than force replacement. Remove only the owned link on rollback. |
| `~/Projects/dotfiles/claude/*`, installed gstack, `codex/config.toml`, shared hooks/installer | READ ONLY and excluded. No Claude edit or exact-CLAUDE approval packet is proposed by this revision. If one becomes necessary, stop and obtain separate exact owner approval. |
| Project `AGENTS.md`, `CLAUDE.md`, `docs/testing/browser.md` | Unchanged. Codex follows required existing CI/scheduling/evidence rules. Where a conflict prevents `/browse`, report it; do not rewrite shared behavior for Claude. |
| Login polish plan | Existing reviewed plan remains unchanged. Any future Codex-only operational annotation needs bounded independent review, preserves its acceptance, and must not change Claude's execution path. |
| Existing CDP helper, suites, mutations, panel-fit and CI | Retained unchanged; executing required established regressions is distinct from creating agent probes. No suite deletion or lowered floor/budget. |
| Temporary agent probes | Retire as Codex workflow dependencies; preserve evidence. No deletion without ownership/usage audit and no mandatory new runtime tool. |

Installer/bootstrap integration is deferred: it is not needed for the narrow
pilot and must never become a route to replay shared Claude setup implicitly.
Future global Codex rollout needs separate approval after the Handpan pilot.

## File-owned stages and acceptance

One integrator owns sequencing, Linear writes and shared-resource scheduling.
Independent source/coverage reads may run in parallel; no fake parallel editors.

| Stage / owner | Deliverable and acceptance / stop |
|---|---|
| 0 inventory lane | Read installed Claude `/browse`, verified Codex entry point and supported host invocation. Distinguish documented/installed/configured/authenticated/authorized/operational. No setup or execution now. |
| 0 coverage lane | Map Codex probes to `/browse` journeys, retained CI tests or explicit gaps. No assertion that browsing reproduces deterministic races, fonts or native Safari. |
| 1 integrator + fresh engineer | Exact Codex-only patch/link and Handpan-scoped pilot brief. Verify it does not activate across other projects. If a global file is used for pilot, its text must explicitly limit activation to Handpan until later rollout approval. |
| 2 scoped pilot operator | After owner approval, use temporary explicit Handpan Codex session instructions, leaving global and shared files untouched. Validate supported CLI/session mechanics and evidence without installing tools. |
| 3 independent compatibility reviewer | Fresh Codex consumes the workflow; fresh Claude follows its original instructions. Both inspect the same harmless fixture/journey with required evidence. Confirm no Claude-side diff or changed entry points and no cross-session interference. Fail any missing/altered consent or evidence step. |
| 4 owner + integrator | Approved real DEV smoke; human handles sign-in/OTP. Verify served revision and actual behavior, not HTTP alone. Preserve phone QA and exact-head CI/review gates. |
| 5 Codex editor + reviewer | Only after pilot passes and exact global Codex-rollout approval: add canonical Codex rule and safe link, prove fresh-session loading in a second project without changing that project's instructions. Claude files and shared setup stay untouched. |
| 6 optional follow-up | Separate usage/coverage audit before removing obsolete owned probes; never delete required CI regressions under this plan. |

## Compatibility and negative acceptance cases

- **Claude unchanged:** before/after status and byte fingerprints of relevant
  Claude instructions, skill definitions, settings and shared hooks match.
  Do not publish sensitive file contents/hashes of credentials; use local receipts.
- **Codex discovery:** verify effective home, absent/shadowing overrides, project
  precedence and a fresh-session acknowledgement of the rule and actual source.
  File existence or a symlink alone is not proof of instruction loading.
- **Supported invocation:** same installed `/browse` commands and workflow,
  correct host identity, no claimed Claude runtime. Unsupported preamble/overlay,
  tools, writes or permissions are explicit blockers, not silently skipped steps.
- **Evidence:** actual named origin, inspected screenshot, console errors and
  relevant state changes. Aside exit0 alone is insufficient: require documented
  `GSTACK_STEP_OK` and no error. Headless fallback uses its documented evidence
  and persistent-tab cleanup; it is not claimed to have Aside cookies.
- **Privacy/actions:** own tabs only; no cookies/tokens/localStorage inspection,
  unrelated tabs or credential/OTP entry. Real DEV mutations need the existing
  workflow's exact per-run consent. AFK is not permission to import sessions.
- **Shared runtime state:** audit preamble/consent/cache/telemetry/session writes
  as well as source-file diffs. Do not assume a `GSTACK_HOME` variable isolates
  every tool; require documented supported isolation where shared markers could
  alter Claude behavior. Unsupported isolation is a pilot blocker, not a reason
  to fork the workflow or silently skip lifecycle steps.
- **Scheduling/cleanup:** coordinate actual shared browser/session/host with Claude,
  follow the unchanged project lease, supported bounds and visible progress;
  close only owned tabs/jobs. Do not kill another session under a global rule.
- **Failures:** missing binary/build, stale refs, missing sentinel, invalid selector,
  stalled job, unexpected global file, source skill drift and conflicting project
  rule all fail the affected step visibly. No custom-driver fallback or waiver.
- **Regression coverage:** sync race/fault, saved-scale/share-link safety, mutation
  gates, locale/fit and SV-PG+phone checks stay required. `/browse` smoke is not a
  substitute for native Safari/VoiceOver/physical keyboard or deterministic CI.

Rollback only owned Codex source/link/session instructions; do not touch Claude,
others' worktrees or saved browser storage. A failed pilot leaves global rules
inactive and required work blocked where evidence is missing. Existing approved
regressions may still run; no new probe framework is introduced.

## Queue, review and pickup

TRI-72 remains planned/Todo, related to TRI-28 and paused TRI-23. Do not unpause
TRI-23 or displace login polish. This clarification supersedes the prior proposal
to replace Claude's global browsing bullet: that patch is WITHDRAWN, not approved.
Prompt evidence lives at `docs/prompts/2026-11-10-browse-first-agent-qa.md`.
Pickup branch/worktree: `claude/browse-first-qa-plan-20261110`,
`/private/tmp/handpan-browse-first-plan-20261110`. Re-read latest Linear/gh and
preserve dirty dotfiles. Stop at reviewed queued plan; do not activate from it.

Review history: original proposal passed independent review after global-vs-pilot
scope repair. Owner then clarified Codex-only adoption following unchanged Claude.
A fresh independent engineering/compatibility review confirmed this revised
architecture READY for queueing, with no required correction or blocker/high.
The old review is historical; runtime compatibility remains unvalidated.
