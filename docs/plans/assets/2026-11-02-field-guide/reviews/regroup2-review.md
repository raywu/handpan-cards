# Regroup-2 review (final) — READY

## Prior findings
- G1-1 RESOLVED: A25 removes focus/violet (2.64:1) from A6; the focus/paper pair is 14.10:1 and the focus != violet row is an inequality, so it always passes.
- G1-L1 RESOLVED: A25 limits the expanded-state pair to #settings-trigger[aria-expanded=true] against the dark header (A22).
- G1-L2 RESOLVED: A26 says A21 adds to A3.

## WCAG contrast for the A6 pairs (tokens from plan section "Approved roles")
| pair | ratio | threshold | result |
|---|---|---|---|
| ink #242424 / paper #F6F4ED | 14.10 | 4.5 | pass |
| muted #5E5850 / paper | 6.39 | 4.5 | pass |
| muted / field #FFFFFF | 7.03 | 4.5 | pass |
| border #8A847B / paper | 3.37 | 3 (non-text) | pass |
| white / violet #6756B5 | 5.87 | 4.5 | pass |
| focus #242424 / paper | 14.10 | 3 | pass |
| error (A2 default = ink) / paper | 14.10 | 4.5 | pass |
| expanded trigger / dark header | current values, unchanged | 3 | not computable here (low G2-L2) |
(If the owner picks A2's alternative, E27005/paper is 2.91 and fails, which is why A2 requires a new token of at least 4.5.)

## Findings
No blocker, high or medium findings.

Lows (do not block):
- G2-L1: A5 sets disabled text to #8A847B, which is 3.37:1 on paper. That is below 4.5, but WCAG 1.4.3 exempts disabled controls, and A6 lists no disabled pair, so no gate trips. Fix: state in the A5 table that disabled rows are exempt from 1.4.3 and recorded for information only.
- G2-L2: the expanded-state pair has no stated hex values. Fix: Phase 0 records the current computed colours of the trigger and the header, and the pair passes at 3:1 or higher (it is unchanged, so failing it would mean the defect already exists today; log it, do not fix it).
- G2-L3: the "Pending Linear handoff" body ("connector missing", "do not assume P1 = High") still reads as current. A14 voids it, but a fresh agent has to know that later text overrides. Fix: mark that section "superseded by A14".

## Protected boundary
Nothing in A1-A26 breaches it. A20 explicitly protects the #E27005 renderer and card uses. A21 unwraps the .prog light query using today's values, so the dark plate keeps its current values. Focus rings exclude .prog, .flip and cards.

## Criteria
| # | Criterion | Verdict |
|---|---|---|
| 1 | No open blocker/high | PASS |
| 2 | Assumptions verified/gated/accepted | PASS (A2 is an owner decision with an AFK default) |
| 3 | Smallest approach | PASS |
| 4 | Phases: prereqs/owner/deliverable/acceptance | PASS (Phase 0 gate is now satisfiable) |
| 5 | Dependencies | PASS |
| 6 | Verification | PASS |
| 7 | Recovery | PASS |
| 8 | Continuation point | PASS |
| 9 | Scope and stop | PASS |
| 10 | Protected boundary | PASS |
| 11 | Self-contained | PASS (note G2-L3) |

pending-linear-writes: []
