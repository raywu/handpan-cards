# Editor interaction coverage

## Why extend the suite

The locked Guided preview made a drawn insertion seat authoritative, while the
dragged pitch label remained offset from the actual touch point. Existing native
tests aimed at the seat center, so the release could pass every saved-layout
assertion while a plausible phone gesture silently missed.

The RC already requires 14 named hosted cases, including
`EDITOR-RC-CYCLOPS-TOUCH` for the reported A6 layout. Extend those cases where
they naturally fit. Add a named journey only for a distinct user-visible failure
that the existing journeys cannot represent.

## Coverage layers

| Layer | Add or strengthen | Evidence |
| --- | --- | --- |
| Unit | Table-drive exact boundary points, just inside, on and outside; CSS pixel margin at multiple transforms, scales and zoom levels; exact versus forgiving hits; precedence between insertion, projected occupied note, Ding, other ring and off-pan | Expected outcomes come from a specified fixture and independent geometry, not from the resolver being tested. Use exact numbers here rather than at the CDP touch rounding boundary. |
| Integration | Exercise projected ring growth and contraction with representative sparse, crowded, mirrored, pinned and capacity layouts; cover replacement identity and insert angle, draft refusal, Undo/Redo and save/link/reopen | Compare note identities, per-pitch angles, untouched rings, history count and round-tripped record. Reuse existing model and shell suites. |
| Native browser | Drive tray tap, touch drag, mouse drag and keyboard through public controls. Aim at center, just inside and outside the visible target, and at a nearby competing target. Include ring switch and return, an off-pan path, and a coalesced final release with no intervening move | Compute gesture coordinates from rendered bounds and independent offsets. Do not ask the resolver for a point that already produces the expected answer or use a helper that silently snaps to the mark. Compare visible action before release with resulting notes, history and geometry. |
| Hosted RC | Keep existing named behavioral gates, and strengthen the Cyclops case with an independently chosen replay path | Full validate at the exact head, then all required named tests against matching served bytes before and after the run. |
| Physical iPhone | For changes to touch targeting, zoom, drawer fit or keyboard behavior, replay a small pinned-RC checklist in Safari | Record revision, device, orientation, pass/fail and any recording separately from Chromium. Include crowded Cyclops insert/miss, nearby replace, and cancel. |

## Representative browser matrix

Use a 380 px portrait fixture for crowded Standard Cyclops and the original
A6 gesture. Use one short landscape case for the coexistence of visible targets,
feedback and the pinned rail. Reuse existing Standard rim, underside, Neotone,
Back and save/reopen cases as comparison paths. Distribute mirror and pin checks
across existing representative fixtures. Keep full combinations and numerical
thresholds in fast tables to avoid multiplying browser runtime.

Each new trajectory should assert the expected preview intent, the target
staying put while aiming, and the exact commit or no-edit result. Near misses
must give an actionable cue. A genuine refusal should stay a refusal, and an
off-pan release should follow the tray or placed-note rule. Exercise one cancel
in each input modality where cleanup differs, including focus and pointer cleanup.

## Implementation and gates

1. **Test lane** owns the boundary table, an independent rendered-coordinate
   driver used only by boundary journeys, and the A6 replay. Start with a failing
   trajectory against the pre-fix revision and prove it passes on the current RC.
2. **Model lane**, only if needed, extracts a small pure coordinate or target
   comparison currently embedded in the UI. Preserve the live entry points and
   validate the extraction with existing return-shape and geometry tests.
3. **CI lane** owns named required-case accounting and evidence. Retain full
   validate, exact served hash verification, zero skipped required cases, and
   append-only frozen fixture history. Record case name, viewport, modality,
   expected outcome, observed outcome and revision for failures.
4. **Independent review** checks that test coordinates do not depend on the
   production decision, that the important mistakes make tests fail, and that
   browser runtime stays bounded. Validate the existing margin and stale-intent
   mutants and use targeted mutants for missing precedence or hidden-target
   commits if those are uncovered. Do not add a new browser framework for
   this work. Use the shared [browser validation runbook](../testing/browser.md).

The first implementation slice is the independently targeted native gesture
and unit boundary table. Keep enhancements to the wider editor coverage
incremental once those checks are stable.

Independent engineering plan review passed. The proposed work changes test
coverage and reporting, with any production extraction subject to separate
review if the test lane finds it necessary.

## First slice implementation

- **Test lane** (`codex/cyclops-qa-first-slice`,
  `/private/tmp/hpc-cyclops-qa-first-slice`) starts at the verified RC
  `5ba8ea25`. The existing hosted ID replays fixed angles against the
  rendered Cyclops arc at 380 px and drops at fixed offsets east of the
  pictured circle. Real occupied-seat and Ding drops assert which notes
  changed, unaffected rings, history and exact Undo. A sandbox boundary
  table checks exact and just-outside SVG circle edges and insertion-only
  expansion.
- **Model lane** needs no product extraction for the first slice. The
  sandbox stub supplies only the painted circle attributes. Native browser
  coverage checks the CSS-pixel margin and rendered gesture coordinates.
- **CI lane** retains the same 14 required IDs. Its finish line is
  exact-head validation and repeat of the named cases against the exact
  served RC once this test change integrates.

Local first-slice evidence covers all 14 named journeys with zero skips,
three consecutive A6 replay runs, the exact-edge sandbox table and a killed
missing-touch-margin mutant. Production files remain identical to
`5ba8ea25`. The next executable action is independent review of this lane's
tip, followed by exact-head CI and hosted smoke on the integration branch.
