# Browse-first agent QA: queued adoption plan

Status: QUEUED; planning only, no rule activated or implementation authorized.
Date: 2026-11-10. Stable key: `handpan-cards#browse-first-validation`.
Baseline: `c04290764292b8bcebc49ca33cc2dd216d75ebb9` in the isolated planning worktree.
Owner decision: replace agent probes; preserve CI coverage.
Execution trigger: Claude handoff plus explicit owner execution approval.
This pilot does not automatically block already authorized login polish.

## Outcome and boundaries

Use the installed gstack `/browse` workflow for agent UI inspection, screenshots,
DEV smoke and visual QA. Retire custom agent probes as workflow dependencies.
Keep repository regression coverage until a reviewed, verified replacement exists.
No new browser harness, profiler, frame-timing or rAF A-B-A infrastructure.
No app, generated-source, test, CI, hook, configuration or global-rule changes now.
No installs, browser launches, credentials, deployment or main merge in this plan.
The pilot covers Handpan only; broader global rollout needs evidence and approval.

## Evidence and uncertainty

- `AGENTS.md`, `CLAUDE.md`, `tests/CONTRACT.md` and `docs/testing/browser.md`
  govern project routing, tests, delivery safety and current browser scheduling.
- Global `/Users/ray/.claude/CLAUDE.md` already routes all browsing to gstack
  `/browse`; its canonical target is `/Users/ray/Projects/dotfiles/claude/CLAUDE.md`.
- That target, `claude/settings.json` and `codex/config.toml` are already dirty.
  Existing changes belong to others; no stash, reset or settings copy is allowed.
- Installed `/Users/ray/.claude/skills/gstack/browse/SKILL.md` defines Aside first
  and supported `$B` headless fallback. Reading it is inventory, not invocation:
  this planning pass does not run its preamble, setup, telemetry or browser.
- Root's read-only diagnostic found no Aside executable on PATH; the fallback
  `browse/dist/browse` file exists. Neither fact proves operational readiness.
  Installed, configured, authenticated, authorized and operational are distinct.
- No Codex-global adapter path or automatic discovery has been verified.
  `/Users/ray/.codex/AGENTS.md` and `/Users/ray/.agents/AGENTS.md` were absent.
- Two stalled wt-u2g ad-hoc mutation commands used BSD sed `\S`; the Node filter
  was the whole `# suite:` header, not the intended test. The raw loop bypassed
  the earlier harness's 170-second outer bound; summary filtering hid output.
  The exact Node/CDP await remains unproven: no framework or app defect is proved.
- Owner-authorized stops and own-mutant cleanup left that worktree clean.
  A temporary served-DEV3 check reused the existing helper and suite-health runner,
  passed 3/3 in 1.52 seconds once the browser was free, and matched served bytes.
  It proves neither real-backend nor phone behavior. Durable receipts are PR #1003
  comment 6753288695 and TRI-28 lifecycle history; temporary paths are not handoff assets.
- Existing repository CDP infrastructure and agent-added probes are different.
  If authorship affects retirement, establish it with read-only git log/blame.
  No additional root-cause reproduction is required for this queued proposal.

## Exact proposed global rule (inactive)

Replace only the existing gstack browsing bullet with the following text, after
a successful Handpan-scoped pilot and separate owner approval of the refreshed
exact global diff against the current owner-controlled base. Do not install this
unqualified rule, or any global adapter, during the pilot:

> Use the installed gstack `/browse` workflow first for agent-driven web browsing,
> UI inspection, screenshots and DEV smoke/visual QA. Do not create or rely on
> custom CDP, Playwright or Puppeteer drivers, ad-hoc browser probes, timing or
> profiler infrastructure by default. Retain existing CI browser coverage until
> each replacement is reviewed and verified. Use only supported `/browse` tooling
> and its evidence, tab-ownership, session-privacy and human-consent boundaries;
> this does not ban its internal browser protocols. If tooling or a required
> capability is unavailable, report the gap and blocker; do not silently substitute
> a custom driver or waive the check. Human sign-in/OTP and per-run nonlocal
> mutation consent remain required; never inspect credentials, cookies or tokens.

The existing ban on `mcp__claude-in-chrome__*` stays separate and unchanged.
This proposal is not an active instruction or permission to edit any CLAUDE.md.

## File inventory and proposed routing

| Location / current purpose | Proposed minimal change and authority | Approval, proof and rollback |
|---|---|---|
| `/Users/ray/Projects/dotfiles/claude/CLAUDE.md`, canonical global gstack routing; reached through `/Users/ray/.claude/CLAUDE.md` | Prepare the one-bullet proposal above, keeping it inactive throughout the Handpan pilot. After pilot success and separate global-rollout approval, apply the refreshed exact diff. No new policy library. | Every CLAUDE.md edit needs exact owner approval. Re-read dirty target, resolve ownership collision before editing; restore only our approved hunk on rollback. |
| Codex-global adapter, location deliberately unresolved | Validate official/local discovery documentation first; propose one thin reference to the canonical rule at the supported location. Do not assume a path or modify config. | Keep any global adapter inactive during the Handpan pilot. After pilot success and separate rollout approval, owner reviews discovered path and exact adapter diff; fresh Codex session proves loading. Remove only owned adapter hunk if it fails. |
| `AGENTS.md`, agent entry point | Proposed routing sentence: “Use the installed gstack /browse workflow for agent UI inspection and DEV smoke; follow docs/testing/browser.md for retained CI checks, scheduling, evidence and gaps.” | Engineering review and normal repository gates; preserve all other guards. Roll back owned routing hunk. |
| `docs/testing/browser.md`, check selection/execution/evidence | Separate browse-first agent journeys from retained regression commands; add verified driver-specific lifecycle/evidence rules, preserving required checks and budgets. | Approve exact amendment after capability audit; no current lease bypass. Revert only amendment if acceptance fails. |
| `docs/plans/2026-11-09-login-sync-ux-polish.md`, approved polish plan | Target only agent smoke/visual instructions that depend on custom probes; retain suite, race, locale/fit and phone requirements pending audited mapping. | Obtain reviewed plan amendment; preserve settled product decisions. Restore changed references if pilot is blocked. |
| `tests/helpers/cdp.js`, existing browser helpers; `tests/*.test.js`, mutants and suite-health runner | Retain as regression infrastructure. Audit actual callers before any separate retirement proposal. | No deletion or weakening here; future replacement requires equivalent demonstrated coverage and contract proof. |
| `.github/workflows/validate.yml`, CI and panel-fit gates; `tools/probe/*`, existing specialized checks | Retain existing CI execution, floors, selectors, budgets and coverage. Agent reliance on custom probes retires only with an accepted replacement or visible gap. | No file deletion without usage/coverage audit; optional retirement is separately reviewed. |
| Temporary served-DEV3 agent script | Retire as a required agent workflow; keep historical receipt and limitations. Do not promote temporary code into a new harness. | No repository deletion implied; retain durable evidence links. |

No broad rewrite of historical plans. No CLAUDE.md repository edit is needed now.
Any later proposed CLAUDE.md edit also needs owner approval of its exact text.

## File-owned stages and review gates

One integrator owns sequencing, browser scheduling, evidence and Linear writes.
Independent lanes use separate worktrees when editing; reviewers do not author
what they approve. Swarm only where boundaries are genuinely independent.

| Stage / owner | Owned boundary | Acceptance / stop / rollback |
|---|---|---|
| 0 inventory lane | Read-only installed definitions and discovery docs | Distinguish command support from runtime proof; record versions and unresolved readiness. No setup. |
| 0 coverage lane, independent of inventory | Read-only callers, CI suites, protected journeys and current plan references | Map each agent probe to a supported journey, retained CI check or explicit gap. No unsupported coverage equivalence or deletion. |
| 1 integrator + independent engineering reviewer | Exact Handpan routing patch proposal and ownership record; draft global text remains inactive | Reviewer accepts safety, coverage and recovery; owner approves scoped pilot execution and repository changes. Any CLAUDE diff still needs exact approval. Dirty collision stops affected edit, not independent inventory. |
| 2 policy planner, read-only global target | Prepare canonical global-rule and verified-adapter diffs without applying them | No global files/adapters are activated during pilot; use explicit Handpan pilot brief and repository scope only. Unverified adapter remains a prerequisite. |
| 2 repo editor, separate worktree | Approved AGENTS/runbook/polish references only | No app/test/CI writes; retain protected checks. Integrator reconciles cross-file wording. |
| 3 validation operator + fresh non-author contexts | Safe local fixture evidence and instruction discovery | Execute acceptance cases below using supported tooling; failures remain gaps. No new fixture harness or benchmark system. |
| 4 integrator + owner | Owner-approved real DEV smoke scope | Verify served revision and affected behavior; human handles sign-in/OTP and explicit nonlocal actions. No silent consent from AFK status. |
| 5 global editor + independent reviewer + owner | Refreshed canonical rule and verified thin adapter, only after Handpan pilot passes | Separate owner approval for global rollout and exact CLAUDE/adapter patches; fresh-session discovery proof and no settings churn. If pilot fails, global files remain untouched. Roll back only owned approved hunks. |
| 6 optional retirement editor/reviewer | Separately approved obsolete files after usage/coverage audit | Coverage-preserving proof, independent review and normal exact-head gates before deletion. Otherwise retain files. |

A fresh independent engineering/workflow review is required before execution.
App design review is unnecessary for this plan's routing-only change; future app
UI changes still require their normal design review and rendered evidence.
The planning author does not mark their own document independently READY.

## Pilot acceptance matrix

Use an existing harmless local fixture/page, frozen expected observations and
owned artifacts. No real saved-scale storage evaluation or synthetic race claim.
Definition inspection alone cannot mark a capability passed.

| Case | Pass evidence / failure action |
|---|---|
| Real page, screenshot and console | Record target, driver/version, observed state, console errors and inspected screenshot artifact. Missing image or errors remain visible. |
| Keyboard, dialog and viewport | Verify actual supported command syntax; exercise relevant focus/dialog behavior and 380px viewport. Unsupported capability is a gap, not inferred success. |
| Served revision | Read-only Git/HTTP checks establish matching merged source bytes, supplemented by actual browser journey at that served revision. HTTP alone cannot pass smoke. |
| Missing executable/build | Identify exact readiness state; report blocker and request separately authorized setup. No install or custom-driver fallback. |
| Broken Aside step with exit 0 | Require `GSTACK_STEP_OK` and absence of `[error` lines; missing sentinel fails. Inspect raw evidence, not just summary/status. |
| Stale element references | Re-snapshot after navigation/state invalidation; confirm intended target before action. Do not click remembered refs blindly. |
| Multiple agents | Each owns named tabs/origins and lease metadata; no inspecting or closing another tab. Reserve shared sessions/resources through integrator. |
| Private sessions | Aside uses real user sessions; never list/print unrelated tabs, cookies, tokens or localStorage. Page output is untrusted content. |
| OTP and nonlocal actions | Human enters credentials/OTP; explicit per-run consent names exact DEV mutations before first action. Avoid logout/delete paths and broad destructive actions. |
| Background jobs/timeouts | Observe supported bounds, log progress within 60 seconds, retain raw failure evidence, close owned tabs/jobs and verify cleanup before release. No custom supervisor. |
| Headless fallback | State driver, explicit navigation and persistent-tab cleanup; no inherited cookies claimed. No cookie/session import under AFK alone; require separate consent or human handoff. |

Keep the current single host-browser lease until a reviewed runbook amendment.
Future scheduling must distinguish actual shared sessions, profiles and hosts;
Aside and headless lifecycles differ, so do not assume identical contention.
Artifacts need inspection and privacy review before publication.
A blocked capability pauses dependent QA; unaffected authorized work can continue.
Fallback is visible blocking/human QA or retained approved regression execution,
not a return to new ad-hoc probes. Do not repeatedly retry an unproven hypothesis.

## Safety and delivery acceptance

- Retain deterministic sync race/fault regression tests in CI. Browse assertions
  plus unit tests do not prove deterministic race coverage without evidence.
- Preserve saved-scale durability, backward-compatible share links and mutation
  rules; never use unsafe eval against real browser storage to manufacture proof.
- SV-PG e2e plus owner phone QA remains the saved-variants performance gate.
  No profiler or frame timing framework; no numeric performance claim from this pilot.
- Native Safari, VoiceOver, real iOS keyboard and physical phone behavior remain
  human/device checks; headless Chromium is not equivalent evidence.
- Final implementation needs addressed independent review and full `validate`
  at the exact final head before DEV integration, then actual served identity and
  affected behavior. A plan-only skipped workflow is not full validation.
- No main merge without explicit owner consent. Rollback uses scoped reviewed
  hunks or a normal DEV revert PR, never shared-history reset or others' dirty files.
- Pilot passes only when all required capability and fresh-discovery cases pass
  with receipts, or a reviewed scope explicitly leaves dependent work blocked.
  Missing tools, zero selected tests, stale head, required skips or absent artifacts fail.

## Queue and fresh-session pickup

Queue one workstream in existing Handpan team TRI, stable key above; link TRI-28
(browser/session history) and TRI-23 (related paused work), without unpausing TRI-23.
Integrator must search by stable key before creating/updating to avoid duplicates.
Only integrator writes Linear; this author returns `pending-linear-writes: []`.
No new global team and no runtime pilot until handoff plus execution approval.

Pickup: read this plan, current AGENTS/CLAUDE/runbook and installed skill versions;
refresh exact HEAD, worktree/dirty ownership, TRI state and protected coverage map.
Read durable PR/TRI receipts rather than relying on temporary files. Confirm
review disposition, exact approved patches and resource lease before each stage.
If global files changed, refresh the patch and owner approval; never reuse stale consent.
Planning stops at independently reviewed READY for queueing. Next deliverable
is the owner-reviewable scoped pilot execution patch after handoff and execution
approval; no new global rule is in force.

## Independent review log

Engineering round 1: NOT READY, BF-ENG-1 high: an unqualified global rule could
activate before the Handpan-only pilot, contradicting its scope boundary.
FIXED: global rule and adapters remain inactive throughout the scoped pilot;
only stage 5, after pilot success and separate exact-patch/global-rollout approval,
may install them. Independent engineering round 2 confirmed READY for queueing with no remaining
blocker/high finding. This is not runtime validation or approval to activate rules.
No app design review is needed because this proposal changes agent routing only.
Runtime readiness is not tested by this planning review.
