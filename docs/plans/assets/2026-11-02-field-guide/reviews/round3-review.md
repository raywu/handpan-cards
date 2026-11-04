# Field guide plan: round-3 review (eng + design)

Plan: plan.md, amendments A1-A18 binding. Code checked: /Users/ray/Projects/handpan-theory-brand (read-only).

## Overall: NOT READY (1 high, 3 medium, 2 low). All fixes are one-line text amendments.

## R2 finding resolution

| Finding | Amendment | Status | Evidence |
|---|---|---|---|
| DES-R2-1 | A1 | partially | #242424 vs paper #F6F4ED = 14.1:1 holds. But #242424 vs violet #6756B5 = 2.64:1, so A1's own Phase 2 test (">=3:1 against both paper and violet") cannot pass. See R3-1 |
| DES-R2-2 | A2 | partially | Owner decision with default recorded (OK for crit 2). Scope is incomplete: #E27005 also appears in the sheet's Layout diagram (`#scale-preview .nhit:focus-visible`, `.panhit:active`, `.panghost`), the card `.badge` and the card renderers (fill/col "#E27005"). "Stays on dark ground only" leaves open whether those get recoloured. See R3-2 |
| DES-R2-3 / ENG-R2-3 | A3 | partially | The decision is made, but the test list is incomplete. test_scale_pages.py also pins `color-scheme:light dark` (lines ~795 and ~886), `@media (prefers-color-scheme:light){.prog{...` (~874), `@media (prefers-color-scheme:dark){:root{` (~905) and `prefers-color-scheme:dark` (~1079). Hub/101/404 are dark-only today (INDEX_CSS_HEAD, SHARED_ROOT test line 33, handpan-101 `:root{color-scheme:dark`, 404 `color-scheme:dark`), so "light-only" flips their ground and SHARED_ROOT plus test_handpan_101_page.py need edits too. See R3-3 |
| DES-R2-4 | A4 | resolved | The meta `color-scheme dark` is kept, which matches the app.test.js head test |
| DES-R2-5 | A5 | partially | The disabled selectors exist (`#share-copy`, `.prints button`, `#scale-generate`, `#scale-drawer .mode`, `#scale-fine-toggle`, all opacity:.5). The checkbox mapping is right (`#scale-neotone` accent-color #E27005 becomes #6756B5). #8A847B on paper = 3.37:1 for disabled text, which WCAG exempts, so it is fine. The "expanded trigger" is underspecified. See R3-4 |
| DES-R2-6 | A6 | resolved | |
| DES-R2-7 | A7 | resolved | |
| DES-R2-8 | A8 | resolved | |
| DES-R2-9 / DES-R2-10 | A9 / A10 | resolved | |
| ENG-R2-1 | A11 | resolved | The favicon test (~3977), the `LG:` tests (~4013-4043) and tests/mutants/nm_favicon_ink_dropped.patch all exist. Note `LG:` also matches the lip-gesture tests (~13212+), which is harmless (more coverage) |
| ENG-R2-2 | A12 | resolved | make_icons.py imports fitz and has `raster`, `differing_fraction` and `check`. It produces no @2x/@3x today, so the extension is real work, and A12 assigns it |
| ENG-R2-4 | A13 | resolved | |
| ENG-R2-5 | A14 | resolved | |
| ENG-R2-6 | A15 | resolved | `make_icons.raster(svg, px)` and `differing_fraction(a, b, clip)` exist. See R3-6 |
| ENG-R2-7 / ENG-R2-8 | A16 / A17 | resolved | |
| ENG-R2-9 | A18 | resolved | FLOORS rows exist: test_icons 6, test_scale_pages 84, app.test.js 1011 |

## Findings

**R3-1 (high). A1's acceptance test is unsatisfiable with A1's own value.** Contrast of #242424 on #6756B5 is 2.64:1. Failure scenario: a Phase 2 lane implements A1 exactly, then the required test (">=3:1 against both paper and violet") fails. The lane must either change the token, which breaks the routine decision, or weaken the test, which widens scope. Fix: "Because of the 2px offset the ring sits on the surrounding paper; the Phase 2 test asserts ring >=3:1 against the adjacent ground (paper) and a ring colour different from the selection fill. It does not test ring against violet." Alternatively, choose a ring colour that is >=3:1 on both grounds.

**R3-2 (medium). A2's scope could reach protected rendering.** The Layout diagram is protected (Goal section) but sits on the sheet, which becomes light ground. Its `.nhit` focus stroke, `.panhit:active` and `.panghost` use #E27005, as do the card `.badge` and the renderer fills. Fix: "A2 applies only to `#scale-box.bad`, `#scale-fields input.bad`, `#scale-refusal.err`, `#scale-msg.err`, `.announce.err`; diagram, card and renderer uses of #E27005 are protected and unchanged."

**R3-3 (medium). A3's test fallout is under-listed, and hub/101/404 change ground.** Failure scenario: Lane R rewrites only SCALE_LOCKUP_IMG/MONO_SOURCE, and CI goes red on the `light dark` and `prefers-color-scheme` assertions and on SHARED_ROOT. Fix: "Lane R owns every color-scheme / prefers-color-scheme assertion in test_scale_pages.py (incl. SHARED_ROOT, the .prog light-media assertion → unconditional plate) and test_handpan_101_page.py; hub/101/404 move from dark to light ground, and the .prog `@media (prefers-color-scheme:light)` wrapper is unwrapped so the plate applies unconditionally with identical values."

**R3-4 (medium). The expanded-state mapping has no target.** `#settings-trigger[aria-expanded=true]` (the only styled expanded state, bg #221f1a) lives in the header. A4 keeps the root dark, so a "paper ground with ink border" there would be a light chip on a dark header and arguably a new header treatment (A10). `#scale-fine-toggle` and `#scale-lip` carry aria-expanded but have no expanded style. Fix: "A5 expanded row = `#settings-trigger[aria-expanded=true]` on dark header (keep #221f1a or name the new value with its contrast against the header) plus `#scale-fine-toggle`/`#scale-lip` on light ground (no new style beyond focus/hover)."

**R3-5 (low).** `#scale-generate:disabled:active` and `#share-copy:disabled:active` set backgrounds (#f6f4ed and #1a1814) that become invisible or wrong on paper. Fix: add both selectors to the A5 state table.

**R3-6 (low).** A15 compares `raster()` output (alpha pixmap) with the master. `differing_fraction` needs equal dimensions and channels. Fix: "flatten both onto #0F0E0B at 1154px before differing_fraction."

## Readiness criteria

| # | Criterion | Verdict |
|---|---|---|
| 1 | No open blocker/high | FAIL (R3-1) |
| 2 | Assumptions verified/gated/owner/AFK | PASS (A2 owner default recorded) |
| 3 | Smallest approach | PASS |
| 4 | Phases have prereqs/owner/deliverable/acceptance | FAIL (R3-1 acceptance unsatisfiable; R3-4 target missing) |
| 5 | Dependencies | PASS (fitz, raster, differing_fraction verified; potrace local only) |
| 6 | Verification covers behaviour/failures | PASS with notes (R3-3 lists the tests that must change) |
| 7 | Recovery | PASS |
| 8 | Continuation point | PASS |
| 9 | Scope and stop | PASS with notes (R3-2) |
| 10 | Protected boundary | PASS with notes; R3-2 must be stated to stay intact |
| 11 | Self-contained | PASS |

pending-linear-writes: []
