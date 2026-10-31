# Move over-cap forwards (2026-10-31)

Lane `claude/move-overcap`, stacks on `dev`. Refs the domain move
(`docs/plans/2026-10-30-cloudflare-and-domain-move.md`, held outside this tree).

## Owner decision (2026-10-31), made explicitly after being told scales over the limit would not show on the new host

When the old host's saved-scale handoff code would exceed `MOVE_CAP`, still
forward the user to `MOVE_TARGET`, carrying the largest prefix of their saved
records (in stored order, plus hidden ids and replacement slots for the carried
records) that fits under `MOVE_CAP`. Remaining records stay untouched in
old-host storage. No notice for the over-cap case. The "Your N saved scales
moved here." notice counts only carried records.

## Behaviour

- `moveForward` binary-searches the longest prefix whose encoded code is
  `<= MOVE_CAP`. Hidden ids ride along whole; replacement slots travel inside the
  carried records.
- If not even one record fits, the user is forwarded with no payload and the
  share hash preserved, as for an empty store.
- Under-cap behaviour, `MOVE_CAP` (20000), share-link handling, record and wire
  versions are unchanged. `MOVE_FROM`/`MOVE_TARGET` stay null.
- i18n: no new string; the existing `move.notice` is reused.

Tests: `tests/app.test.js` "MV:" over-cap cases; `tests/e2e.test.js` "move: a
payload over MOVE_CAP still forwards". Mutants: `mv_overcap_returns_false`,
`mv_forward_ignores_cap`.
