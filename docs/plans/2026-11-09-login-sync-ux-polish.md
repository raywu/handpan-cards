# Login and sync UI polish — TRI-28 subplan

Mode: plan; stop after independent engineering/design review; AFK armed.
Implementation is not started. Main releases, deployments, credentials and
CLAUDE.md edits remain gated. This is part of login sync, not a new workstream.

## Outcome and authority

Owner requirements (2026-11-09): “Polish the whole sign-in flow (Recommended)”
and “Polish before login release (Recommended)”. The phone screenshot reports
working functionality with verbose, unclear controls; it does **not** establish
that all phone, backend or cross-device QA passed. Polish blocks the login release.

Make signing in, understanding account state and optionally adding device scales
clear without changing what sync uploads, deletes, stores or authorizes. Preserve
the incumbent Field guide world and practice state. Recommendations below are
routine reversible presentation decisions under AFK, not new product policies.

Baseline: candidate `f91f3e528bcbe070cacfc7550ab9ab30aee4ace8`; DEV merge
`cb4f6fd680489a39a19170e6a73f2e1a3ac2d92b` has the same tree. Prior full validate
`42665015606`, independent review and three served fake-backend checks passed.
Those receipts do not validate the proposed UI. Real-device/backend QA is pending.

## Evidence and boundaries

| Finding | Evidence and significance |
|---|---|
| Identity is repeated and inaccurately called synced | `syncPaint` puts `sync.menuSignedIn` in both `#sync-open` and `#sync-heading`; authentication is not proof that a pull/upload finished. |
| Timestamp is repeated | `#sync-last` renders the timestamp while `syncStatus` also writes it to `#sync-msg`. |
| Account sync and device upload are different | `syncAskIds` uses `pendingLocalIds`; the screenshot has an account sync timestamp while 205 device scales still await consent. Never label that “all scales synced”. |
| Action hierarchy is flat | All account controls use `.mode`; “ADD THEM”, Sign out and Delete account appear as full-width peers. |
| Important behavior already exists | `syncSubmit`, `syncResend`, `syncOtherEmail`, `syncAskAnswer` and `syncDeleteAccount` implement OTP, cooldown, consent and two-press deletion. Preserve their policies. |
| Backup wording can become false | `backup.intro` says scales live “only in this browser”; a signed-in user may have account copies. Correct wording only; keep backup functionality independent. |

Read `CLAUDE.md`, `AGENTS.md`, `tests/CONTRACT.md`, `docs/testing/browser.md`,
`PRODUCT.md` and `docs/plans/assets/2026-11-02-field-guide/surface-briefs.md`.
Apply Impeccable `clarify`, `operate` and `polish`, plus the installed
frontend-design skill: task clarity, restrained hierarchy and purposeful copy.
Pinned project aesthetics override generic advice against cream or uppercase.
Do not repair PRODUCT.md's legacy schema/register or introduce DESIGN.md here.

Non-goals: no auth scheduling/session policy, `trustedBase`, operation-scope
guards, store/identity/migrations, sync engine, schema/RPC, origins/domain warning,
share format, note grammar, editor, print, analytics or account-cap changes.
No new dialog, account route, dependency, browser framework, profiler or timing
infrastructure. `docs/plans/2026-11-09-sync-store-safety-subplan.md` section 21
remains the current safety contract; archived login-v2 setup is not authorization.

## Two solutions and selected direction

**A — compact inline account section (recommended).** Retain the existing opener
and expansion, with one identity, one truthful live status, contextual consent,
and secondary account controls. Existing focus and layout paths remain usable.

```text
Scales
[ + Add a scale ]
[ Back up scales ]
[ Account & sync                    ▾ ]
  Signed in
  player@example.test
  Account synced at 9:14 PM

  Add 205 scales from this device to your account?
  [ Add scales ]   [ Not now ]

  Sign out
  -------------------------------------
  Delete account
```

**B — account summary plus Manage disclosure.** It saves default vertical space
but introduces another control, hidden-action focus and lifecycle state. Reject
for this small polish pass: the current expansion already supplies disclosure.

```text
[ Account & sync ▾ ]
  player@example.test · Account synced at 9:14 PM
  [ Add scales ] [ Not now ]
  [ Manage account ▾ ] → Sign out / Delete account
```

A is the smallest approach. Keep Backup separate and always available. Use
Nunito Sans for UI, existing paper/field/ink/muted/border/action tokens, ink focus
rings and existing spacing. Account-only sentence case and primary/secondary
styles must not restyle global `.mode`, practice controls or protected renderers.
Use violet for the one active task (Send code, Sign in or Add scales), neutral
secondary controls, left-aligned help/status, and a divider above account deletion.
Delete remains a visible, unfilled text-style **button**, not a tiny link; every
target stays at least 44×44 CSS px. No extra decorative icons or motion.

## State, wording and interaction contract

Exact English proposals below are the source for eight locale tables. Preserve
locale-specific tone (German Du; natural respectful conventions elsewhere).
Only UI is translated; English A–G scale input and user-entered names stay intact.

| State | Visible content and hierarchy | Focus/recovery |
|---|---|---|
| Signed out, collapsed | Opener **Sign in to sync**; no account email or sync-success claim. | Existing opener, aria-expanded/controls. |
| Email | “Sync saved scales across devices.”; persistent **Email address** label; primary **Send code**. Keep existing domain warning. | On open focus email; invalid email retains input/focus and aria-invalid, no request. |
| Code | Persistent **6-digit code**; “Enter the code sent to {email}. Check spam too.”; primary **Sign in**; secondary **Change email**, **Resend code**. | Numeric input, paste/autofill and existing maxlength; focus code. Change email returns to email and clears code as today. |
| Sending/verifying/resending | **Sending code…**, **Signing in…** or **Resending code…** on the existing active control; disable Send/Sign in/Resend/Change email while existing `syncBusy` is true; active step inputs become readonly, without clearing values. | Before disabling a focused button move focus to its existing labelled field; use readonly for that focused field while busy rather than dropping focus. Keep the group aria-busy. Existing completion focus rules select the next field or account heading; on failure restore the relevant field. Presentation updates at existing async boundaries only; no new request queue, retry or auth state. |
| Resend cooldown | Secondary **Resend in {s}s**, disabled until existing 60-second deadline. | Preserve the existing timer; do not announce every tick through the live region. |
| Signed in, expanded | Opener **Account & sync**; heading **Signed in** and `{email}` once beneath it. This email is plain text, not a mail link. | Keep `#sync-heading` as the existing programmatic focus destination; its accessible name includes identity. |
| First pull / pending / success | Respectively **Syncing…**, **Changes waiting to sync**, **Account synced at {time}**. No timestamp before a successful sync. | One `role=status`, `aria-live=polite` region; no duplicate timestamp elsewhere. Account status does not assert that unconsented device scales are uploaded. |
| Consent, 1 or 205 eligible scales | “Add {n} scale/scales from this device to your account?”; primary **Add scales**; secondary **Not now**. | Use the unchanged eligible IDs/count and plural rules. Zero hides this prompt. Not now only dismisses this prompt; no upload, sign-out or temporary-storage action. |
| Invalid/expired code, rate limit, offline or account cap | Keep the existing specific actionable error meaning; give it precedence over routine success/pending text. | Retain relevant field values, aria-invalid and focus. No generic success repaint may hide the error. Expired session returns to the existing sign-in path. |
| Delete, unarmed | Secondary **Delete account**, separated from routine controls. | One activation only arms the existing six-second confirmation; no RPC yet. |
| Delete, armed | “Permanently deletes your account and synced scales. Copies on this device stay.”; **Confirm account deletion**. | Second activation within six seconds retains existing RPC/guards. Announce the consequence through the existing polite status region while focus stays on the confirmation button. Timeout/panel close disarms as today; retain any error for restoration after expiry. No new modal. |
| Delete failure | **Could not delete your account. Try again.** | Scope any new key to this action's existing failure mapping; do not guess offline or expiry as the cause. Preserve session, local data and guard behavior. |
| Sign out | **Sign out**; completion “Signed out. Your scales remain on this device.” | Keep local scales. Retain existing focus return to email when panel remains open. |

`syncDeleteAccount` currently only removes the sidecar after success; local scale
records are not deleted. That source supports the device-copy consequence above.
Do not make promises about other devices' offline copies or server recovery.

Use `#sync-msg` as the sole visible message region; remove `#sync-last` rather than
retain an invisible duplicate for tests. Keep `syncMsg` as the existing source of
transient errors/status. While deletion is armed, its consequence is the current action message in that
region; retain, rather than overwrite, any prior error for restoration on disarm.
Otherwise rendering selects a relevant non-routine error/OTP/action message first; current
first-pull/running/pending state then outranks any cached routine sync-status
message; show the last successful account timestamp only when those states do not
apply. A retained `sync.status.synced` message must never mask new pending work.
`syncSay` and `syncPaint` must use the same rendering path so clearing a transient
message restores the appropriate status and never leaves stale success/error text.
No new persistent state, service or sync scheduler. Errors remain until the existing
successful action/state transition clears them; routine repaint cannot clear one.

Backup opener: **Back up scales**. Replace the universal “only this browser” claim
with “Keep a separate copy of your saved scale links, such as in Notes or an email
to yourself.” Preserve the existing session-only warning and restore instructions.

## Responsive and accessibility acceptance

- At 380px portrait, one-column content follows task order; consent buttons may
  share a row only while both fit, then stack. At 320px, no horizontal clipping.
- At short landscape (e.g. 844×390), preserve the settings menu's existing scroll
  and column behavior. The expanded account section stays a coherent group;
  do not create a three-column mini-menu or increase existing fit allowances.
- Render 254-character email without truncation or horizontal overflow, using
  safe wrapping. Test 0/1/205 eligible scales and long translations, real/fallback
  fonts, 200% zoom, keyboard focus and owner VoiceOver on iPhone.
- The settings keyboard list continues to include only visible enabled controls.
  New disclosure is unnecessary. Hidden forms/consent controls are not tab stops;
  errors and deletion confirmation are perceivable without relying on color.

## File-owned waves and handoffs

| Wave / owner | Ownership and prerequisite | Deliverable / observable acceptance |
|---|---|---|
| 0 integrator | This plan, source check, `docs/CARD-SPEC.md` narrow account-UI contract; independent eng/design READY first. | Reviewed state/copy contract and verified current DEV/base; no CLAUDE.md edit. Freeze selectors, expected counts and sole browser lease before execution. |
| 1 T tests | `tests/app.test.js`, `tests/e2e_sync.test.js`; one worktree, no app/locale writes. | Meaningful RED against baseline for identity/status deduplication, consent clarity, error precedence and control hierarchy/accessibility. Existing ten sync-browser tests retained; amend assertions for intentional copy/markup changes without weakening outcomes. |
| 2 U UI | `index.html` non-generated sync markup/CSS, `syncPaint`/`syncSay`, focus enumeration and presentation-only busy/error mapping. Depends on T contract/RED. | GREEN observable journeys, no transport/storage/safety behavior delta. No hidden obsolete nodes solely to placate tests. |
| 2 L locales | Only `data/i18n/{en,de,fr,it,es,ja,zh-Hant,zh-Hans}.json`; may work parallel to U after copy freeze. | All changed/new sync and backup keys translated, placeholders/plural forms preserved; no unrelated translation pass. Do not generate index. |
| 3 integrator | Join U + L + T test commits, regenerate `const I18N` once, then freeze the integrated candidate. Sole writer of generated index; no concurrent index editors. | New copy and UI are present together; clean regression controls pass before any mutant proof. |
| 4 T mutants | Generated `tests/mutants/` diffs plus owned `tests/suite_health.py` rows; depends on the frozen, regenerated wave-3 candidate. | Named regression groups killed by meaningful generated faults; clean controls pass, mutant fails its intended assertion; existing safety corpus retained. Raise measured counts only; full metadata check if headers change. |
| 5 integrator | Join mutant/floor receipts, update this plan/spec, final diff and gates. | Complete scope audit, exact-head CI/review and served/owner QA evidence, recovery breadcrumbs. |

Each lane brief says `Refs TRI-28`, exact base, owned files, acceptance/non-goals,
verification and handoff SHA. Return changed files, actual tests/counts, failures,
limitations and pending Linear writes. Only root updates Linear. U and L can run
in parallel; TDD and mutant application remain dependency-ordered, not fake parallelism.

## Verification and release gates

No tests were run for this plan. Before implementation recheck prerequisites and
candidate suite titles; baseline app=1280, sync browser=10, sync engine=178 and
metadata=54 are reference counts, not assumed post-change results.

1. T records targeted RED on baseline. After integration run generated-source
   and key-parity checks: `python3 tools/sync_i18n.py --check` and
   `python3 tools/validate.py`; syntax: `node --check tests/e2e_sync.test.js`.
   Existing app i18n tests are the audit; no `tools/audit_i18n.py` exists.
2. Root runs `tests.suite_health.run_node_file` for `tests/app.test.js`,
   `tests/e2e_sync.test.js`, `tests/sync.test.js` and, if metadata touched,
   `tests/mutation_harness.test.js`, retaining raw TAP/actual return codes/counts.
   Expected counts are frozen from the T handoff and measured floor changes.
   All old safety/first-pull/scope/consent/deletion/share regressions remain green.
3. Expand the existing sync browser suite, not a new harness: observable deduped
   identity/status, stale-success to pending/first-pull repaint, failure precedence
   over successful repaint, no account-wide
   “all synced” claim while consent remains, consent0/1/205, busy/resend/change-email controls and focus restoration,
   long email, deletion arm/expiry/failure and unchanged local scales/sign-out.
   Add locale/fit checks with existing CDP real-font capability for all eight
   locales at 380px; English, German and both Chinese tables at narrow/short
   landscape, plus remaining material states. Inspect rendered screenshots in
   a batch, including fallback fonts and zoom. A passing geometry check alone
   is not a visual-polish verdict. Keep assertions structural, not magic colors.
4. Existing panel-fit command shape: `node tools/probe/panel_fit.js --base
   f91f3e528bcbe070cacfc7550ab9ab30aee4ace8 --candidate <verified-final-SHA>
   --font both --workers 1 --lang <code>`. Root schedules it via the runbook's
   reviewed bounded-supervision procedure or existing full CI; never raw
   unbounded local execution. Standard panel-fit does not prove expanded sync
   states, which step 3 explicitly exercises. No fit-budget/tool changes.
5. Generate mutant bodies with committed-tree `git diff`, remove index headers,
   run existing bounded mutation orchestrator for selected mutants in its own
   clean worktree, then full metadata check. Preserve actual assertion kills,
   not timeout/zero-match/skip verdicts. No BSD-sed selector extraction loops.
6. Run the mechanical Impeccable detector once on completed UI if no hook is
   active, as context directed; use it as defect evidence, not quality proof.
   Independently review the actual diff/visual results at verified final SHA.
7. Full `validate` must succeed at that exact final head, with a fresh reviewer
   reading its conclusion, before DEV integration. No main merge. Verify actual
   served DEV identity and affected login/consent/error journeys afterward.
8. Owner rechecks polished phone UI, email flow and real cross-device sync;
   Safari/VoiceOver and German/Chinese phone coverage cannot be certified by CDP.
   Only explicit owner words establish device QA. Never ask main consent in the
   QA-ready ping. Editor successor stays held until login QA then editor baseline QA;
   held Mirror/Rotate work remains open and PL-b remains required.

All host browser jobs are serialized by root with explicit Chrome, inherited
overrides removed per runbook, expected selected counts, start/end/PID/profile,
raw output and cleanup receipts. Full Mac generic suite is not claimed repaired.
Missing tools, occupied lease, skipped required tests, stale SHA or a timeout
stop that evidence step; never retry unchanged to manufacture green. After a
third same-approach failed review, regroup into a smaller reviewed subplan.

## Recovery, rubric and continuation

Revert only the polish lane through a reviewed DEV revert PR if needed; preserve
all saved scales, sync records and share links. No storage clear/reset, database
rollback or broad worktree cleanup. Keep failed artifacts and actual head before
fixing. A safety/client or host-policy change discovered here requires its own
reviewed amendment; a presentation task must not smuggle it in.

Frozen readiness rubric: understandable actions; truthful account/upload state;
least-change scope; accessible responsive eight-locale UI; unchanged sync safety;
meaningful RED/GREEN and mutants; executable ownership/dependencies; feasible
recovery; precise handoff. Ready only with no unresolved blocker/high finding.

Independent engineering/design round 1 returned READY_WITH_NITS with no
blocker/high. Root addressed the findings below; both independent reviewers
confirmed READY on the revised text in a bounded round-2 re-check. Implementation/rendered evidence and owner
final real-device/backend QA remain untested. No further product choice is needed.

Pickup: plan worktree `/private/tmp/handpan-sync-polish-plan-20261109`, branch
`claude/login-sync-polish-plan-20261109`, starting f91 above. Root records review
verdicts/decisions here and the latest TRI-28 lifecycle comment before dispatch.
Stop at reviewed plan READY; do not implement from this document alone.

## Independent review and decision log

- Prompt critic: READY, no blockers; retained presentation-only busy/status and
  wording-only backup boundaries. Owner explicitly requested both frontend skills.
- Engineering E1 (medium): FIXED, U + L join/regenerate/freeze now precedes mutant
  clean controls and proof; E2 (medium): FIXED, live first/running/pending outranks
  cached routine success, with a stale-success repaint regression; E3 (low): FIXED,
  competing auth controls and focus while busy are specified using existing state.
- Design D1 (low): FIXED, armed deletion consequence uses the single polite region,
  preserving focus and retained error; D2 (low): FIXED with E3; D3 (low): FIXED,
  deletion wording explicitly says Permanently. No extra modal or scheduler.
- Reviews apply installed plan-eng-review/plan-design-review, Impeccable and
  frontend-design contracts in independent fresh Codex contexts; they do not claim
  native Claude execution/model parity. Reviewers authored neither prompt nor plan.
- Validation split: plan diff/command/source inspection only so far; automated
  implementation, rendered visual review, fresh final code review and human QA
  are future gates. No passing proposal is evidence that the UI is implemented.

Final review disposition (2026-11-09): engineering READY and design READY after
bounded re-check; E1–E3 and D1–D3 all confirmed addressed. No unresolved blocker
or high finding. Next action is reviewed-plan execution only when implementation
authorization covers this polish; this planning run ends here. Existing DEV remains
available for functional QA, and polish plus owner QA still gate the login release.
