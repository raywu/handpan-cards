# Phase 0 readiness receipt (lane P, 2026-11-02)

Binding: plan amendments A1-A29 override the body.

## Base and ancestry (A13)

- Worktree `/Users/ray/Projects/handpan-theory-brand-implementation`, branch `claude/field-guide-brand`, cut from `origin/main` 8a6e04f89c6e (full 8a6e04f89c6e73f8ee6128d97b280b7fe8a2a2fb); planning tip 3e984bf8 (docs only).
- `origin/dev` = b045c03879b6e559ef99527d0408adb9283c985f.
- `git diff --quiet origin/main origin/dev -- . ':!docs/plans' ':!docs/prompts'` exited 0: main and dev code trees are equal. This main-based branch is the single head for PR M; the dev PR is not opened by this lane.

## Tools

| Tool | Local | CI | Note |
|---|---|---|---|
| node | v25.8.1 | 22 | local newer than CI; CI is the oracle |
| python3 | 3.9.6 | 3.12 | local older than CI |
| PyMuPDF | 1.26.5 (MuPDF 1.26.10) | unpinned | |
| reportlab, fontTools 4.60.2, Pillow 11.3.0 | present | requirements-ci.txt: reportlab, pymupdf, fonttools | Pillow is used only by the local tool `brand/build_master.py` |
| potrace | 1.16 (`/opt/homebrew/bin/potrace`) | not installed | local-only tracing tool (A15); output committed, not a CI dependency |
| Browser | `findBrowser()` returned `null` | CI has Chromium | gate: no browser launched in Phases 0-1; no browser lease taken; nothing installed |

No hidden install requirement: Phases 0-1 need only the Python/Node tools above.

## Package hashes

All 18 files in `docs/plans/assets/2026-11-02-field-guide/manifest.json` matched their recorded sha256 before this lane touched anything. `token-check.json` was then regenerated (A6/A25) and its manifest entry (sha256, bytes) updated; the other 17 are unchanged.

## Ownership (this PR)

- Lane P: plan receipts under `docs/plans/assets/2026-11-02-field-guide/`, `PRODUCT.md`.
- Lane A: `brand/*`, `tools/make_icons.py`, `tests/test_icons.py`, the `tests/app.test.js` favicon and `LG:` tests, `tests/mutants/nm_favicon_ink_dropped.patch`.
- Generated outputs written only by the tool: the `brand:lockup` region and favicon URI in `index.html`, `apple-touch-icon.png`, `og.png`, `brand/horizontal-*@{2,3}x.png`. No other `index.html` byte changes (Phase 2 not started).
- Not touched: cards, progression renderers, palettes, fonts, geometry, deck data, print, engine, storage, share links, CLAUDE.md.

## Token contrast (A6, A25)

`token-check.json` regenerated with labelled pairs. Phase 0 gate: text pairs >= 4.5, non-text >= 3. Result: PASS, no failures.

| Pair | Ratio | Min |
|---|---|---|
| ink/paper | 14.1 | 4.5 |
| muted/paper | 6.39 | 4.5 |
| muted/field | 7.03 | 4.5 |
| border/paper (non-text) | 3.37 | 3 |
| border/field (non-text) | 3.71 | 3 |
| white/violet | 5.87 | 4.5 |
| violet/paper (links) | 5.34 | 4.5 |
| violet/field (links) | 5.87 | 4.5 |
| focus ring ink/paper (non-text) | 14.1 | 3 |
| focus ring ink/field (non-text) | 15.52 | 3 |
| error ink text/paper (A2) | 14.1 | 4.5 |
| error 2px ink border/paper (A2, non-text) | 14.1 | 3 |

A25: `focus/violet` is replaced by `focus/paper` plus a recorded row `focus (#242424) != violet fill (#6756B5)`, true (ink/violet ratio 2.64 is informational only; A19 asserts the ring sits on paper, 2px offset).

## A28: `#settings-trigger[aria-expanded=true]` vs the dark header (existing CSS, A22)

Fill #221f1a, text #f6f4ed, border #a9a39a, header ground #0f0e0b (`--table`). Text on fill 14.92:1; border on ground 7.71:1 (>= 3, passes); fill alone on ground 1.18:1 (the border carries the boundary). Not below 3:1 where it counts: no pre-existing defect to log. Treatment kept as-is (A22).

## A5 state table (light-ground controls; with A22, A23, A27)

Proposed values from the approved tokens; Phase 2 implements them. "Disabled" rows are WCAG 1.4.3-exempt and informational only (A27); disabled uses #8A847B text, not opacity alone. `#settings-trigger` expanded keeps its dark treatment (A22; no paper ground); `#scale-fine-toggle` and `#scale-lip` carry aria-expanded with no expanded style, only the A1 focus ring. Checkbox accent-color #6756B5. `#scale-generate:disabled:active` and `#share-copy:disabled:active` are listed (A23). Filled-violet rows state fill vs paper (5.34) for the non-text boundary.

| Control | State | Text hex | Ground hex | Border hex | Text contrast | Border contrast | Note |
|---|---|---|---|---|---|---|---|
| Secondary button (.mode, #share-copy, Resources links) | rest | #242424 | #FFFFFF | #8A847B | 15.52 | 3.71 |  |
| Secondary button (.mode, #share-copy, Resources links) | hover | #242424 | #F6F4ED | #242424 | 14.1 | 14.1 | border darkens to ink |
| Secondary button (.mode, #share-copy, Resources links) | focus-visible | #242424 | #FFFFFF | #8A847B | 15.52 | 3.71 | + 2px #242424 ring, offset 2px, on paper (A1/A19) |
| Secondary button (.mode, #share-copy, Resources links) | selected (.on) | #FFFFFF | #6756B5 | #6756B5 | 5.87 | fill vs paper >= 5.34 | ring != violet fill |
| Secondary button (.mode, #share-copy, Resources links) | disabled | #8A847B | #F6F4ED | #8A847B | 3.37 | 3.37 | 1.4.3-exempt, informational (A27); text #8A847B, not opacity alone |
| Text field (#scale-fields input, name, share-url) | rest | #242424 | #FFFFFF | #8A847B | 15.52 | 3.71 |  |
| Text field (#scale-fields input, name, share-url) | focus-visible | #242424 | #FFFFFF | #242424 | 15.52 | 15.52 | + 2px ring |
| Text field (#scale-fields input, name, share-url) | error (.bad / aria-invalid) | #242424 | #FFFFFF | #242424 | 15.52 | 15.52 | ink text + leading icon + 2px #242424 border (A2 AFK default) |
| Text field (#scale-fields input, name, share-url) | disabled | #8A847B | #F6F4ED | #8A847B | 3.37 | 3.37 | A27 |
| Error/announce text (#scale-msg.err, #scale-refusal.err, .announce.err) | visible | #242424 | #F6F4ED |  | 14.1 |  | ink text + error icon (A2) |
| Primary action (#scale-generate) | rest | #FFFFFF | #6756B5 | #6756B5 | 5.87 | fill vs paper >= 5.34 |  |
| Primary action (#scale-generate) | hover | #FFFFFF | #5A49A6 | #5A49A6 | 7.15 | fill vs paper >= 5.34 | hover fill darker violet |
| Primary action (#scale-generate) | focus-visible | #FFFFFF | #6756B5 | #6756B5 | 5.87 | fill vs paper >= 5.34 | + 2px ink ring offset 2px, on paper |
| Primary action (#scale-generate) | disabled | #8A847B | #F6F4ED | #8A847B | 3.37 | 3.37 | A27; text #8A847B |
| Primary action (#scale-generate) | disabled:active (A23) | #8A847B | #F6F4ED | #8A847B | 3.37 | 3.37 | no state change; same as disabled |
| #share-copy | disabled:active (A23) | #8A847B | #F6F4ED | #8A847B | 3.37 | 3.37 | no state change; same as disabled |
| Link (reading/About) | rest | #6756B5 | #F6F4ED |  | 5.34 |  |  |
| Link (reading/About) | hover | #242424 | #F6F4ED |  | 14.1 |  | underline + ink |
| Link (reading/About) | focus-visible | #6756B5 | #F6F4ED | #242424 | 5.34 | 14.1 | + 2px ring |
| Checkbox (#scale-neotone) | unchecked | #242424 | #FFFFFF | #8A847B | 15.52 | 3.71 |  |
| Checkbox (#scale-neotone) | checked | #FFFFFF | #6756B5 | #6756B5 | 5.87 | fill vs paper >= 5.34 | accent-color #6756B5 (A5) |
| Checkbox (#scale-neotone) | focus-visible | #242424 | #FFFFFF | #8A847B | 15.52 | 3.71 | + ring |
| #scale-fine-toggle / #scale-lip (aria-expanded) | expanded | #242424 | #FFFFFF | #8A847B | 15.52 | 3.71 | no expanded style; focus ring only (A22) |
| #settings-trigger (dark header) | expanded=true | #f6f4ed | #221f1a | #a9a39a | 14.92 | 6.56 | existing dark treatment kept (A22); A28 below |

## A2 owner decision (AFK default recorded)

Error state on light ground = ink #242424 text + leading error icon + `aria-invalid` with a 2px #242424 border; #E27005 stays on dark ground only and on the protected `#scale-preview .nhit:focus-visible`, `.panhit:active`, `.panghost`, card `.badge` and renderer fills (A20). The owner may instead approve a new error token with >= 4.5:1 on paper.
