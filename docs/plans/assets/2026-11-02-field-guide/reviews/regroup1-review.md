# Regroup round 1 review (read-only, repo handpan-theory-brand @ 0e085950)

Verdict: NOT READY (one medium contradiction, one-line fix)

## R3 resolution
| R3 | Amendment | Status | Evidence |
|---|---|---|---|
| R3-1 | A19 | resolved in the A1 test | WCAG: #242424/#F6F4ED = 14.10:1; #242424/#6756B5 = 2.64:1; A19 drops the ring-vs-violet assertion. BUT see G1-1 (A6 still demands it) |
| R3-2 | A20 | resolved | selectors exist in index.html (#scale-box.bad x2, #scale-fields input.bad, #scale-refusal.err, #scale-msg.err, .announce.err, .panghost x2); diagram/card/renderer #E27005 marked protected |
| R3-3 | A21 | resolved | test_scale_pages.py:33 SHARED_ROOT, :795/:886 `light dark`, :874 .prog light query, :905/:1079 prefers-color-scheme:dark all named; test_handpan_101_page.py:51 (assertNotIn prefers-color-scheme) stays true under light-only |
| R3-4 | A22 | resolved | #settings-trigger[aria-expanded (4 hits) keeps dark header treatment; A5 #221f1a fix voided |
| R3-5 | A23 | resolved | both :disabled:active selectors exist (1 hit each) |
| R3-6 | A24 | resolved | flatten onto #0F0E0B at 1154px RGB |

## Findings
**G1-1 (medium).** A6 still lists the token-check pair `focus/violet` and says "Phase 0 fails if any ... non-text <3"; focus #242424 on violet #6756B5 = 2.64:1. A19 replaced only A1's test, not A6. Failure: Phase 0 regenerates token-check.json per A6, the focus/violet row is 2.64 < 3, Phase 0 fails and the lane must change the token or edit the gate (scope widening) - the same trap as R3-1. Fix: "A25: A6's `focus/violet` pair is replaced by `focus/paper` (already listed) plus a recorded `focus != violet fill` row; the `expanded state` pair covers only #settings-trigger[aria-expanded=true] vs the dark header per A22."

## Lows
- G1-L1: A6 `expanded state` pair has no defined target after A22 voided the paper-ground expanded fix; covered by the G1-1 fix text.
- G1-L2: A3 says "Test changes owned by Lane R: SCALE_LOCKUP_IMG/MONO_SOURCE"; A21 widens it - fine since later overrides, but a fresh agent should read A21 as additive.

## Readiness
| # | Criterion | Verdict |
|---|---|---|
| 1 | No open blocker/high | PASS (G1-1 is medium) |
| 2 | Assumptions verified/gated/owner/AFK | PASS (A2 owner decision with AFK default) |
| 3 | Smallest approach | PASS |
| 4 | Phases: prereqs/owner/deliverable/acceptance | FAIL (G1-1: Phase 0 acceptance unsatisfiable) |
| 5 | Dependencies | PASS |
| 6 | Verification | PASS |
| 7 | Recovery | PASS |
| 8 | Continuation point | PASS |
| 9 | Scope and stop | PASS |
| 10 | Protected boundary | PASS (A20 states diagram/card/renderer #E27005 protected; .prog values unchanged per A21) |
| 11 | Self-contained | PASS with note (G1-1) |

pending-linear-writes: []
