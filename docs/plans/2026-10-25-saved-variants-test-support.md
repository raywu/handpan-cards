# Saved variants — faithful test support amendment

2026-10-25. Implementation detail within owner-approved plan9a96ed6d and exact
packet5d0700f7. No new owner behavior or CLAUDE change. Independent ENG review
required before H/T code; no browser helper repair is included.

## Evidence and bounded decision

Independent acceptance audit found tools/sandbox.js is synchronous, copies storage
per boot and has no locks/crypto/AbortController; tests/helpers/sandbox.js only
reexports it. Durable callbacks and app readiness cannot be made synchronous to
retain old assertions. A Promise JSON-normalized by generate/openShare becomes
{}, hiding incomplete work. Existing tests also inspect obsolete arrays/inventory
registry; explicitly amend those identity/storage oracles under the approved spec,
retain their behavior assertions and all floors/counts.

Preserve synchronous boot() and its existing no-lock defaults for pure render/
engine/layout and shipping boot_sim/fixture consumers. Add opt-in shared-origin
browser API support for durable tests. Missing-lock defaults cover THIS-TAB session
operation only, never durable parity. Do not add test-only production behavior.
Production should publish first ready #count/booted only after durable initialization
and boot import acknowledgment; session initialization can remain synchronous.
Do not alter tests/helpers/cdp.js APP_READY_EXPR or add progressive ready rendering
without a separate reviewed amendment. A helper readiness utility observes actual
application completion; no fake pass by draining all virtual timers.

## File ownership and handoff

H alone owns tools/sandbox.js plus tests/harness.test.js in a separate worktree.
It may add only API semantics required here, and DOM IDs later explicitly handed
off by U; no test mirror/second sandbox implementation. Root owns this amendment,
coordination and observed harness floor. T owns tests/app.test.js, tests/e2e.test.js
and literal tests/fixtures/saved_variants_v1.json after H's immutable handoff. T can
freeze public inputs/titles before H finishes but cannot edit shared helper. S/U
index ownership remains sequential. M owns generated helper/application mutants
in its disposable committed checkout; no app/tests simultaneous mutation/editor.
Root alone runs host browser jobs. Independent reviewer authors none of H/T/S/U.

## H API contract and meaningful TDD

- Existing boot() return/default callers stay synchronous and unchanged. An
  explicit origin object shares raw string storage among opted-in realms; isolate
  default realms. Record successful writes separately from attempted/failed writes.
- Optional navigator.locks request is asynchronous, exclusive FIFO for this scoped
  model, holds ownership until callback Promise settles, releases on fulfillment/
  rejection, rejects pending AbortSignal, and does not abort a granted synchronous
  commit retroactively. Missing/throwing access and explicit request rejection are
  injectable. No overlapping exclusive owner or inline acquisition callbacks.
- Queue storage events only to OTHER same-origin registered realms, with key,
  oldValue,newValue,url,storageArea. Preserve unchanged-value/no-event and removable
  listeners; allow explicit omission/delay. Events notify; lock-time reread is still
  authoritative. Different-origin realms never share storage or locks.
- Inject guarded secure context/crypto randomUUID/getRandomValues and deterministic
  collision sequences; keep missing/throwing controls. Inject AbortController from
  host only where explicitly enabled. No real credential/environment values.
- Direct async evaluate/generate conveniences await actual returned Promises and
  serialize only settled values. Preserve fire()/click's synchronous dispatch of
  EVERY listener; browsers never await listener promises before dispatching another
  listener. Any async click convenience dispatches normally then observes explicit
  bounded actual app completion/error (or separately captured handler Promise,
  without delaying other listeners). Awaiting an event return or merely draining
  microtasks is not commit readiness. Never blanket-advance virtual timers.
  Bounds cover initial synchronous VM evaluation and cooperative promises only;
  an async CPU runaway can block the host timer. All test/helper invocations need
  an outer process supervisor; no arbitrary async thread-isolation claim.
- Default session tests which generate instances need explicitly supplied working
  cryptographic capability fixtures, or reviewed test adaptation. Absence remains
  a negative case. Never use a Math.random production fallback or fake synchronous
  lock to retain legacy expectations.
- Independent synthetic-script helper tests exercise two realms, exclusive queue
  and Promise lifetime/rejection/abort, raw cross-storage/event recipient fields,
  failed acknowledgment, missing capability and UUID collision controls. Expected
  outcomes are literals; do not read production variants implementation as oracle.
- Demonstrate intended helper assertion RED before support, GREEN after; missing
  method/startup failure is not a killing mutant. Generated real-diff mutants must
  produce named assertion failures with exact clean selector pass, no timeout/skip.
  Headers follow actual runner literal word splitting, no shell grouping quotes.

## T policy amendments and frozen coverage

Retain SHC copied URL/angles/fresh receiver/stale UI, seeded ordering/hidden fallback/
promotion/RESET/last-visible protections, single engine build, unrelated hpfc
settings, opaque/raw recovery and legacy reader behavior. Replace ONLY superseded
inventory-target collision/old array mutation/hpfc.deck authority expectations with
stable-instance/envelope/legacy-untouched oracles. Record each amended title and
spec source in coordination, no dropping tests to meet floors. New SV1..SV10 cases
follow the reviewed plan plus successful-write/failed-readback and RESET affected-
scope positives/negatives. Durable cases explicitly opt into faithful async origin;
actual two-target native tests remain mandatory and cannot be replaced by this model.

Public literal fixtures: existing pinned Amara inventory, PUBLIC PAN A/B names,
Pygmy spelling/SHC angles, legacy duplicates/opaque/newer rows and raw whitespace,
fixed UUIDs/collision sequences, label suffix/preset collisions, frozen independent
measurement accounting at2/20/200 and1MiB. No owner data. Freeze test registration
and intended fault table before S app implementation; baseline RED must be useful
assertions, never absent helper, parse errors, unsupported APIs or zero matches.

## Acceptance, failure and recovery

H exact-head helper suite passes with zero required skips, all old default callers
remain valid; no app/helper CDP/floor lowering. Root inspects executed counts and
independent reviewer checks actual asynchronous semantics. Preserve failed logs
and owned worktree on failure; do not change production to satisfy fake helper
semantics. Complete mandatory model AND real-browser interleavings, then full exact-
head validate/DEV per parent plan. If synchronous shipping consumers need changes,
stop for a narrow reviewed extension rather than silently broadening H. Roll back
unmerged owned helper commits only; preserve current accepted base and all data.

## Final support extension — proposed, ENG review before edits

Observed remaining failures are model/tool adaptation, not permission to weaken
source/tests: sandbox document.querySelector cannot match the standard compound
descendant selector #decks .chip.on used by actual focus recovery; fixture tool
boots without explicit crypto, then selects canonical inventory instead of the
saved instance. Existing immutable card-face digests must stay unchanged.

H-final owns tools/sandbox.js, tests/harness.test.js and
tools/regen_card_fixture.js in separate /private/tmp/handpan-saved-variants.HVUKbE/support-final
branch codex/saved-variants-support-final-20261025, based on frozen U069035fd.
No index, locale, CDP-helper, app/e2e-test or instruction edits. Root owns observed
floor update; M later generates meaningful helper mutant in disposable scratch.

Minimal support: document query matching for simple compound ID/tag/class tokens
and descendant ancestry using actual parentNode/markup ancestry; require every
class and ancestor token, never match same-class nodes elsewhere or detached old
chips. Keep existing simple/comma selectors and default boot behavior. Do not
pretend to implement CSS layout or a complete selector engine. Add one spec-derived
synthetic fixture group covering positive, compound-class negative, wrong ancestor,
detached/rebuilt nodes and unchanged simple/comma paths. Capture intended assertion
RED before helper edit, then same GREEN; no missing-method/syntax kill credit.

Fixture tool: only explicit real Node crypto.webcrypto/AbortController capability
in its existing boot adapter, plus selecting res.instanceId || res.value.id, so
current instances and historical --html inputs both work. Preserve synchronous
actual session path; no fake registry/UUID as inventory, no generated fixture
updates. Existing node tools/regen_card_fixture.js --check and --gen --check must
compare all committed digests successfully, not regenerate them. No gratuitous
new tests mirroring these two adapter lines: the existing full-face contracts
are meaningful behavioral verification. Existing historical --html behavior is
checked separately against a frozen prefeature index.

Acceptance: new focused helper RED/GREEN; all actual harness groups with existing
strict controls; unchanged boot177x2; original face/generation digests check;
combined app922 groups (881legacy+feature/review groups) with no skips or floor
lowering; real native focus remains mandatory, model success is not browser proof.
No broad DOM model or compatibility registry. If more shared APIs are needed,
stop for review. Preserve failed logs and rollback only owned unmerged files.
