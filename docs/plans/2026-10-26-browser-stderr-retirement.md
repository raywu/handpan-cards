# Browser stderr retirement — bounded Mac validation unblock

## Scope and evidence

Internal amendment to the owner-authorized Mac helper repair through DEV and
saved-variants validation. No application, CLAUDE.md, dependency, global setting,
main release, timeout increase or unrelated process termination. Root integrates
and alone operates browsers; separate file-owned test/helper lanes precede review.

Saved-variants UI matrix completed48geometry/528control/16state observations twice,
but whole processes timed out after their bodies passed. Raw original-host
receipts: `/private/tmp/handpan-share-hotfix.urAbvO/evidence/`
`sv10-teardown-observer-a0.{json,stdout.tap,stderr.log}` and
`sv10-teardown-observer-a1.{json,stdout.tap,stderr.log}`. Both remain FAILED;
cleanup reports true. Source pins: e2e db5ea23e0ac8991de799d87bd6fca5b10efbedad324fc5291d715826ef745951,
helper66f7fb2731e92f595b44b79f84092af5f90558649f6058493efab19581bbe6f0.
Observera1 SHA12d93249e2dfd8928ab7e99296a9d219f0915dd0351ca6e59f4eb44ada97f194.
Observers preserve underlying arguments/results and only observe lifecycle; they
add no close/unref/retry/extra app read. a1 bounds120seconds, a0 bounds180.

The trace identifies Node PipeWrap fd17/19 as stderr of owned Chrome children1/2:
root exit signal SIGKILL, stderrDestroyed:false/readableEnded:false after
Browser.close resolved. Child3 stderr closes normally. The server close event
also fires. This establishes retained owned stderr handles, not the identity or
cause of an inherited remote descriptor holder; do not kill guessed descendants.
Before/after census preserves pre-existing Chrome680 and seven profile directories.

## Behavioral contract and minimal change

`tests/helpers/cdp.js` reap(entry) already terminates only its owned launch group
and removes its owned profile. Once retirement begins, its debug-port stderr
reader is no longer useful. Explicitly destroy that launch's stderr stream during
reap, even if process termination throws or profile removal exits early. Preserve
existing SIGKILL group/fallback, bounded removal, original launch failure, coverage
finish-before-retirement and reaper registration. Do not destroy test runner
stdio, unref live handles, force process.exit, increase deadlines, hide failures,
or alter browser readiness/foreground/background semantics.

## Swarm execution and TDD

1. Test lane owns one additive group in `tests/harness.test.js`: construct a
   Browser with an actually owned detached Node child, isolated profile and fake
   websocket; await close and assert that its stderr is destroyed immediately,
   the child is terminated and profile removed. Existing implementation must
   fail the explicit stream-retirement assertion, not timeout or setup. Always
   clean only that child/profile in finally; bounded waits and no Chrome needed.
2. Helper lane owns only the minimal stderr destruction in reap. Root integrates
   additive test then repair. Tests preserve all prior groups and coverage/error
   semantics. A generated `tests/mutants/cdp_stderr_not_retired.patch` removes
   exactly the repair; clean1PASS and named assertion kill required.
3. Independent engineering and lifecycle/design review the plan before execution;
   independent final review checks exact diff and evidence. Unit signal/retry/
   launch-failure/coverage groups must retain their existing meaning.
4. Root re-runs the unchanged native matrix under its existing sole lease and
   180second bound, plus relevant lifecycle checks. Passing body without clean
   process exit remains failed. Confirm no owned roots/profiles remain and all
   pre-existing resources unchanged. Native proof on the new IDB candidate is
   additionally required; the old candidate is not shipping approval.

## Acceptance, stop and recovery

Require meaningful RED→GREEN, generated mutant kill, preserved lifecycle checks,
independently cleared final diff, exact-head Linux validate and actual DEV checks
before delivery. A stream already destroyed/absent must be safe; do not let a
cleanup exception mask the original launch rejection. If the pipe diagnosis is
insufficient or regression appears, stop this repair, retain raw failures and
propose a revised bounded investigation. Revert only the isolated repair commit
through normal branch flow; no reset, force push, process sweep or main merge.

## Independent review refinement

Engineering and lifecycle/design reviewers independently cleared this scope after
inspecting both traces. Freeze the owned child fixture's explicit ready handshake
and initially-open stderr precondition; assert destruction immediately after
Browser.close, before awaiting child exit or child close. Its finally explicitly
destroys only its own stderr even when the intended baseline assertion fails,
and bounds owned child-exit/profile cleanup. Exercise absent/already-destroyed/
throwing destroy safely; cleanup must preserve original launch failure. Existing
coverage.finish rejection behavior is outside this repair's scope; do not claim
it is repaired. Native whole-process success remains mandatory.
