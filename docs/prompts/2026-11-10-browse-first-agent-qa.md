# Codex follows unchanged Claude browser QA — reviewed-plan prompt

Produce or refine docs/plans/2026-11-10-browse-first-agent-qa.md directly.
Do not invoke /reviewed-plan. Mode QUEUE; no activation, app/tests/CI/global edits,
browser launches, installs, credentials, deployments or main merges.

Owner clarification 2026-11-10: this is a Codex-specific rule following Claude's
existing /browse paradigm. Claude's instructions, configuration, skills and
behavior must remain unchanged. Replace Codex-created agent probes, preserve
existing CI coverage until replacements are separately verified. Prior Claude
rule replacement proposal is withdrawn; historical prompt remains in git ed3bcaba.

Read AGENTS.md, CLAUDE.md, tests/CONTRACT.md, docs/testing/browser.md, installed
~/.claude/skills/gstack/browse/SKILL.md and required references. Use one thin
Codex-only adapter referring to that canonical skill; no copied/forked skill or
custom CDP/Playwright/Puppeteer/profiling framework. Installed definitions and
binary existence are not operational proof. Do not run gstack setup/telemetry
while merely inspecting definitions for this plan.

Use official OpenAI guidance on Codex AGENTS.md discovery, fetched before making
path/precedence claims: https://learn.chatgpt.com/docs/agent-configuration/agents-md .
Verify effective CODEX_HOME and overrides locally without exposing environment
secrets. Proposed canonical source ~/Projects/dotfiles/codex/AGENTS.md and safe
link $CODEX_HOME/AGENTS.md; fresh-session loading still needs proof.

Dotfiles contains unrelated dirty Claude/config changes. Its installer and
post-merge hook can rewrite Claude config/install tools; do not run them, or
pull/merge as an activation shortcut. Exclude all Claude/shared setup files.
Any later need to touch CLAUDE.md requires separate exact owner approval.

Evaluate actual supported Codex host invocation of Claude's skill without
impersonation, invented flags or dropped preamble/consent/evidence requirements.
Aside real-session and supported headless fallback have different lifecycle,
auth and evidence contracts. Preserve human OTP, nonlocal mutation consent,
owned tabs, privacy, sentinel/raw evidence, inspected screenshots and cleanup.
Unsupported host/runtime capability blocks dependent QA; no custom fallback.
Keep deterministic race/CI/browser regression, locale/fit and phone gates intact.

Record verified command defects (BSD sed selector + unbounded ad-hoc loop) without
claiming the unknown Node/CDP wait or framework root cause was solved. No extra
root-cause/browser reproduction is needed for this queued policy proposal.

Plan shape: exact inactive Codex-only rule; source-backed evidence; minimum file
map and exclusions; independent inventory/coverage lanes; scoped Handpan pilot
using explicit session brief before global changes; fresh Codex vs unchanged
Claude compatibility/discovery checks; global Codex-only rollout after pilot and
exact approval; owner-approved DEV actions; rollback of owned Codex files only.
No shared AGENTS/runbook/polish-plan behavioral changes; report conflicts.

Frozen pass/fail rubric: Codex-only scope, unchanged Claude, DRY canonical skill,
verified instruction-discovery facts, supported invocation/evidence boundaries,
retained safety/CI/device coverage, scoped pilot before rollout, reversible
ownership and fresh-session pickup. Fresh independent engineering/workflow
review after revision; no numeric quality claim or self-review as independence.

Track existing TRI-72, stable Key handpan-cards#browse-first-validation; do not
create another issue or unpause TRI-23. Root/integrator alone writes Linear.
Stop at independently reviewed queued plan, with runtime readiness unvalidated.
