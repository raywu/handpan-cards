# Agent entry point

Read [CLAUDE.md](CLAUDE.md) for the existing project requirements, verified
instrument conventions, generated-source rules and DEV branch model. These
project rules apply regardless of agent. Read [tests/CONTRACT.md](tests/CONTRACT.md)
before adding or changing tests.

For UI/copy/localization, layout, input/focus/navigation, browser harness,
printing or release-verification work, consult the shared
[browser validation runbook](docs/testing/browser.md) during planning and use it
to select checks, schedule browser access and report evidence. Do not infer
browser success from an exit code without checking that required tests ran.

Use a workstream plan with file-owned lanes, independent engineering review and
design review where relevant before implementation. Parallel editors use
separate worktrees; host browser jobs are serialized by the integrator. Final
review is independent of the author, findings are addressed, and full `validate`
must pass at the exact final head before dev integration. Verify the actual
served DEV revision and affected behavior after integration. Never merge into
`main` without the owner's explicit consent.

On “check in”, verify current workstream status, then interview the owner about
unresolved decisions and blockers, one question per item with the recommendation
first. Reuse settled answers, record new ones in the workstream plan, and continue
independent authorized work while waiting. A check-in is not a main-merge grant.
