# Editor RC nit table (P0, TRI-59)

Plan: `docs/plans/2026-11-11-editor-rc.md` section 6, P0 step 4. Every row has an owner or lane; a row without one blocks P0 acceptance.
Status key: CLOSED = landed in the RC base, evidence cited; OPEN = still to do, lane named; MOOT = disappears when the named lane deletes the code; OWNER = needs the owner's eyes.
Sources: `docs/plans/2026-11-06-scale-editor-u2-split.md` review logs, `docs/plans/2026-11-07-editor-v4-gap.md`, `docs/plans/2026-11-08-editor-panel-simplify.md`, PR bodies #904-#994. PR comments and reviews on all 19 PRs hold no text.
Owner update 2026-11-11: PL-b (unified #1 toggle) is PAUSED and out of this RC; its nits are marked PAUSED, not assigned; phone QA uses the PL-b-deferred variant (item 8b).
Lanes: U2i, U2j-1, U2j-2, PL-a, P1, N1, I1, D1 are the plan's lanes; "nit lane" is the W5 lane.

| # | Source | Nit | Status | Owner / lane |
|---|---|---|---|---|
| 1 | U1 (#907) n1 | Frozen e36333c9 fixture for SE-R3-3 (only c6ef6b58 exists) | OPEN | nit lane |
| 2 | U1 n2 | SE-R4-1 moveUrl test falls back to a hand-built code; assert the `#move=` match | OPEN | nit lane |
| 3 | U1 n3 | `moveImport` still drops non-object rows; carry them or record the exception | OPEN | nit lane |
| 4 | U1 n4 | storage_corpus edit outside U's row | CLOSED (approved boundary exception) | none |
| 5 | U1 n5 | Frozen-region test title mentions only #790; first precheck alternative never matches | OPEN | nit lane |
| 6 | U1 n6 | No dedicated "record 7+ protected" mutant | CLOSED (SE-G2 kills one, reviewer-verified) | none |
| 7 | U1 n7 | Move notice count includes opaque rows | OPEN | nit lane |
| 8 | RC #912 | Sheet-open clones `layoutAngles` only when `angles.bottom` non-empty; inner-pins-only v8 scale loses pins on Edit then SAVE | MOOT on legacy sheet deletion; editor-path regression test still needed | U2j-1 (deletes sheet-open) + nit lane (editor-path test) |
| 9 | RC #912 | `readSavedRecord` v6 `\|\| profiled` redundant (cosmetic) | OPEN | nit lane |
| 10 | U2a n1 | `editorWithAngle` drops seat order when unpinning on a seated ring; guard any unpin control | OPEN | nit lane (guard + test) |
| 11 | U2a n2 | `editorSwapSeats` on a pinned cyclops refused with "1,0 is not a note" | OPEN, verify | nit lane |
| 12 | U2a n3 | Pin order after exchange/fold untested (two hand mutants survived) | OPEN | nit lane |
| 13 | U2a n4 | Direct `editorExchangeAngles` refused on a seated ring; unreachable via swap | CLOSED (matches app) | none |
| 14 | U2b n1 | README mutant count lags | OPEN | D1 (set from main CI artifacts; P0 base README reads 1969 = `ls tests/mutants/*.patch`) |
| 15 | U2b n2 | popstate with unsaved edits closes the editor without the D10 Back prompt (`popstate` handler has no editor path; no test) | OPEN | U2j-1 |
| 16 | U2b n3 | `editorCommitText` ignores a typed seat order | OPEN | nit lane |
| 17 | U2b n4 | D21 e2e compares against `pan()` output (tautological) | OPEN | nit lane |
| 18 | U2b n5 | No conflict-recovery UI in the editor (legacy offer lives in hidden `.sheetsurf`) | OPEN, new UI | nit lane; owner decision if it exceeds one session |
| 19 | U2b n6 | Release-safety v4/v5/v6 fixtures not loaded through the editor e2e | OPEN | nit lane |
| 20 | U2b n7 | Blur commit rebuilds Undo; a tap during blur can be lost | OPEN | N1 (name field touches blur/commit) |
| 21 | U2b n8 | Dialog Save on an empty model closes silently | OPEN | nit lane |
| 22 | U2b n9 | A scale that fails to load, then typed notes, saves in place instead of as new | OPEN | nit lane |
| 23 | U2b note | Served-DEV check of ONE_PANEL needs a flag-on build | CLOSED (flag is true on the RC base; DEV merge per A4) | none |
| 24 | U2c n1 | Parity 2 not against a legacy capture | MOOT once legacy UI is gone | U2i / U2j-1 |
| 25 | U2c n2 | Hit-circle labels hidden by role=img | CLOSED (fixed in U2c r2) | none |
| 26 | U2c n3 | Contrived SE-11 fixture | OPEN, low | nit lane |
| 27 | U2c n4 | Lost notice | CLOSED (fixed in U2c r2) | none |
| 28 | U2c n5 | Aria template word order | OPEN | I1 (i18n fit and wording pass) |
| 29 | U2c AD-U2c-1 | Ding swap copy (only a bottom note swaps with the ding); "owner may revisit at phone check" | OWNER | owner phone QA item 3 |
| 30 | #921 N1 | `s.zone` survives a drag / pan switch | CLOSED (test "OQA zone clear on lift and pan switch"; e2e "zone cleared on drag lift") | none |
| 31 | #921 N2 | Tap uses narrow hit, drop uses wide | CLOSED (zone-first fix; e2e "OQA tap equals drag model") | none |
| 32 | #921 N3-N5 | Silent deselect / pick_first for full pill | CLOSED (test "OQA N3 N4 N5 copy") | none |
| 33 | #921 N6 | Aria/group labels "Add the held note", stale D17 test name | OPEN, verify | nit lane |
| 34 | #921 N7 | No tap-vs-drag parity test | CLOSED (e2e "OQA tap equals drag model") | none |
| 35 | #921 N8 | Non-English tables carry English for six `editor.say.*` keys | OPEN, verify all 8 tables | I1 |
| 36 | #920 n1 | `editorDragLift` leaves stale rings | CLOSED (#942) | none |
| 37 | #920 n2, n3 | Empty-zone target rings, rim-gap highlight | CLOSED (e2e "OQA zone highlight occupied", "zone full dashed") | none |
| 38 | #920 n4 | D8 scroll e2e measures no distance | CLOSED (#942; e2e "OQA touch scroll does not remove") | none |
| 39 | #920 n5 | Neotone mutant drag e2e | CLOSED (#945; e2e "OQA neotone drag off removes") | none |
| 40 | #920 n6 | 50ms click-eat window | CLOSED (#942, one click) | none |
| 41 | #920 pre-existing | BAD_NOTE refusal copy garbled | CLOSED (#942, key `editor.say.no_room`) | none |
| 42 | v4-gap row 17 | Drag source fade + snap-back copy | CLOSED (e2e "v4: while dragging a placed note, the source carries lift..." and "OQA snap back says went back") | none |
| 43 | Owner QA items 1-8 (2026-11-07) | Targets, pill wording, trash, iPad, one visible Undo, Reset wrap, labels | CLOSED in tests (#937 gaps 1-7 e2e names "OQA ...") | none; owner re-judges at phone QA |
| 44 | D-OQA-2 | Hit radii 0.85/0.75/0.85 "owner may adjust at device check" | OWNER | owner phone QA item 5 |
| 45 | D-OQA-4 | Landscape iPhone/iPad acceptable | OWNER | owner phone QA item 13 |
| 46 | #988 | Octave buttons at 375px for a wide range | OPEN, fit check | I1 (real-font fit, 375/820) |
| 47 | #982 U2g nit | Undo/redo during live drag | CLOSED (U2h-1 `editorUndoAllowed`) | none |
| 48 | #992 | Delete nits N1-N3 and drag-restore guard | CLOSED in #992 (merged into base) | none |
| 49 | Panel plan D1a | "#1" hidden on profile | PAUSED (PL-b paused by owner and out of this RC; Q8 same-controls part goes to PL-a) | PL-a for Q8; the PL-b part is paused, not assigned |
| 50 | Panel plan Q6 | Neotone wording check, 8 languages | OPEN | before P1 (W3); owner of the check: P1 |
| 51 | #994 (Mirror/Rotate) | Content to be removed (Q9/Q10: Rotate and Mirror dropped) | OPEN | PL-a (removal); #994 stays open |
| 52 | #982 | `ONE_PANEL` toggle and legacy UI must not ship | OPEN | U2j-1 / U2j-2; U2i migrates tests first |
| 53 | #985, #988, #992, #994 reviews | No reviewer nit text recorded in repo plans, PR comments or reviews | GAP | RC review (fresh reviewer re-derives from the diff); integrator supplies any review text held in session notes |
| 54 | P0 merge | README mutant/suite counts conflicted when merging #977; resolved to the larger count and re-checked | CLOSED (test_readme_currency 11 passed) | D1 re-sets from main CI artifacts |
