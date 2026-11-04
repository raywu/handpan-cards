# Phase 1 receipt: faithful identity (lane A, 2026-11-02)

Status: STOPPED at the owner fidelity gate. Nothing here approves the vector; the owner decides from the evidence below.

## Method (A15, A24, one source path)

- Master: `approved-logo-master.png` (1154 x 979, ivory #F6F4ED, alpha only 0/255, i.e. a single colour on transparent; the plan's "4-colour master" wording does not match the file, so one potrace layer is the whole mark).
- `brand/build_master.py` (local tool; potrace 1.16, Pillow, fontTools; output committed, not a CI dependency): alpha upsampled 4x, Gaussian-smoothed (the master's edges are hard 1px stair-steps) and thresholded, traced by potrace into one filled path, baked to absolute coordinates. No shape is redrawn. Smoothing radius, `-O` and `-a` are constants in the script.
- Wordmark: Nunito Sans Regular outlined with fontTools, full name "Handpan Theory", no kerning table (not applied), no HPT.
- Outputs: `brand/mark.svg` (replaces the simplified `mark-small.svg`, deleted), `horizontal-full.svg` (ivory), `horizontal-mono-light.svg` (ink #242424, an exact recolour), `app-icon-full.svg`, `stacked-full.svg`. The same path is embedded in all of them (test-checked).
- `tools/make_icons.py` stays the sync entry point; it also renders the reading-header @2x/@3x PNGs (223x64 times 2 and 3, exactly the sizes `tests/test_scale_pages.py` pins) and covers them under `--check`. The lockup viewBox is unchanged, 683.93 x 196, so no consumer (index.html h1 CSS, `gen_scale_page.py`, handpan-101, 404, test_scale_pages) needs an aspect change (A12 cascade not triggered).
- Favicon (A7): the master fitted centred on a square #0F0E0B tile, 12% clear space each side (test-checked), no redraw.

## Objective gate (A15/A24)

Rasterised via `make_icons.raster` at 1154px, master and vector both flattened onto #0F0E0B RGB, `differing_fraction` with the repo tolerance (24/channel): **0.006577 (0.66%)** against the 0.02 limit. PASS. Binary (alpha >= 128) mismatch: 910 of 1,129,766 px (0.08%). Negative control: a mark shifted 60px scores > 0.02 (test).

## Evidence (`phase1-evidence/`)

1. `01-side-by-side-master-size.png`: master vs vector at 1154px, ivory on canvas (top) and ink on paper (bottom).
2. `02-overlay-master-red-vector-cyan.png`: overlap ivory, master-only red, vector-only cyan.
3. `03-favicon-actual-size-16-32-48.png` and `04-favicon-zoomed-nearest.png`: actual size and nearest-neighbour zoom on dark and light tab chrome.
4. `05-header-slot-223x64-1x-2x-3x-both-grounds.png`: the header slot raster at 1x/2x/3x, ivory on canvas and ink on paper.
5. `06-lockup-ivory-on-canvas.png`, `07-lockup-ink-on-paper.png`: lockups at ~2x slot.

## Limitations to report to the owner

- 16px: the mark is not recognisable at 16px (the fine inner contour and ding merge); 32 and 48px read. Per A7 this is an accepted limitation for owner review, not redrawn. The brand sheet itself says "prefer 32px+".
- The wordmark is Regular weight without kerning; cap height is 38 of 196 (19% of the mark height, about 12px in a 64px header slot, above the A8 11px floor). Wordmark proportion was chosen to keep the existing lockup aspect; the owner may prefer a larger wordmark, which changes the aspect and triggers the A12 Lane R cascade.
- Sources are larger than before (mark ~20KB; lockup ~26KB inlined, favicon URI ~27KB encoded), index.html grows modestly vs the old 64KB lockup (old lockup shrank, favicon grew).
- Safari before 26 uses the PNG rel=icon (the touch icon), unaffected.
- The stale comment above the favicon `<link>` in index.html still names `mark-small.svg` and a round tile; it is outside the generated region and Lane U's file (Phase 2 edit).
