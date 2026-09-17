# Mobile usability audit - pass 1

Lane: W4 (mobile audit, pass 1). Target device: iPhone 14 / iOS 26.6 Safari,
380px viewport (CLAUDE.md's stated test width). Base: `main` @ 839d70e;
the branch was later rebased onto `8abaff6` after W5's engine deck adoption
merged, so line numbers and the deck set below are from the pre-rebase base.

No such checklist exists anywhere else in this repo - the list below was
built for this audit by walking the app read-only, driven through the same
headless-Chromium CDP harness `tests/e2e.test.js` uses (`tests/helpers/
cdp.js`), at the viewports `tests/e2e.test.js` itself documents as PROXIES
for a phone (`FOLD_VIEWPORTS`: 380x800, 390x844, 390x745, 844x390; the
owner's own device is 390x844 portrait / 844x390 landscape). Every item
below carries a verdict. Items marked **not-verifiable-headless** are
called out explicitly, per the brief - headless Chromium cannot open a real
iOS soft keyboard or honour real `env(safe-area-inset-*)` values (they read
0 under emulation), so nothing here claims device confirmation it doesn't
have.

This pass was READ-ONLY on the app: chip switching, card flips, opening the
scale/Edit sheets and typing a seed were all exercised, but no `GENERATE
CARDS`, `SAVE CHANGES` or `DELETE THIS DECK` was ever invoked, and nothing
was persisted to `localStorage`. Two Edit-sheet checks below used a
synthetic in-memory deck object passed straight to `openEditSheet()` rather
than a real custom deck, specifically to inspect that UI without saving one.

## Checklist and verdicts

| # | Item | Verdict | Notes / repro |
|---|---|---|---|
| 1 | Deck chip strip at 380px (`#decks`) | **pass** | 4 chips (+ ADD, C# Hijaz 9, F3 Low Pygmy 18, D Amara 9) total 469px of scroll width in a 356px client width - the strip scrolls horizontally by design (`tests/e2e.test.js` "six custom decks keep the chip row on one line", "+ ADD is fully on-screen and hit-testable at phone widths" - both green). + ADD measures 65x44px, fully inside the 380px viewport, tap-testable at its own centre. |
| 2 | Mode bar (NAME→NOTES / NOTES→NAME, ←/→) | **pass** | All four controls are 44px tall (117.5, 117.5, 56, 56px wide), well inside 380px, matches `tests/e2e.test.js` "the mode buttons and Shuffle are 44px tall". |
| 3 | Card tap/flip | **pass** | Card measures 334x462px at 380x800, fully inside the viewport (22.8-357.2px horizontally). A tap on `#card` toggles the `flip` class (verified: `flipped` went `false` → `true` after `b.click("#card")`). Matches the passing e2e "tapping the card flips it". |
| 4 | ADD dialog opens and is a modal | **pass** | Tapping `#deck-add` opens `#scale-sheet` (hidden attribute removed) - matches the green e2e "the sheet is a modal dialog with the spec'd anatomy" and "while the sheet is open Generate is the only reachable primary button". |
| 5 | Scale sheet geometry at 380x800, no keyboard | **pass** | `.sheetsurf` spans 156-800px (bottom-anchored, capped at 85dvh); `#scale-generate` sits fully inside at 726-778px, `transform: none` at rest. |
| 6 | Typing a seed - live parse/preview | **pass** | Typing `(D) A C D E F G A C` into `#scale-box` produces an empty (non-error) `#scale-msg`, enables `#scale-generate` (`disabled` clears), and un-hides + un-stales `#scale-preview`. Matches the green "the owner's journey at 380px: tap + ADD, type a scale, see the pan". |
| 7 | GENERATE CARDS reachable at 380x800 (no keyboard) | **pass** | Button at 726-778px of an 800px viewport; a tap at its own centre hits itself (`hitsSelf: true`). |
| 8 | GENERATE CARDS reachable at the keyboard-shrink PROXY viewport 390x745 | **pass, but see item 8a** | Button at 671-723px of a 745px viewport, still self-hit. This is `tests/e2e.test.js`'s own documented proxy for a keyboard (shrunk layout viewport), **not the real thing** - see 8a. |
| 8a | GENERATE CARDS reachable with a REAL iOS soft keyboard up | **not-verifiable-headless — this is the defect this lane fixes** | This is the confirmed defect from `TODOS.md`: iOS Safari resizes the **visual** viewport when the keyboard opens, not the layout viewport `#scale-sheet`'s `position:fixed` and `.sheetsurf`'s `85dvh` cap are both anchored to. `window.innerHeight` stays put while `window.visualViewport.height` shrinks - no CSS layout unit reacts, so the button can end up behind the keyboard even though every proxy viewport above passes. Repro (device): open the Add sheet on an iPhone 14 (iOS 26.6 Safari), tap into the SCALE box, and watch `GENERATE CARDS` - it sits in a footer reserved outside the scrolling body (`.sheetbody`), so at rest it is never below the fold, but the keyboard itself can still cover it because nothing translates the sheet to compensate. **This is the one item CI cannot confirm and the PR says so** - see the PR body's DEVICE-CHECK-PENDING note. Fixed here in TWO parts, and the first part alone was shipped and then DISPROVED on hardware - see "Confirmed defect fixed by this lane" below for the full sequence. Part 1: a `visualViewport` resize/scroll listener (`kbOffset()` / `applyKbOffset()`) that translates `.sheetsurf` up by the gap between the two viewports. Part 2 (added after the owner's device check failed): `kbCap()`, which also CAPS the surface to the shrunken visual viewport, because `85dvh` is a layout-viewport unit that does not shrink for the keyboard. The pure math of both is unit-tested (`tests/app.test.js`); neither function's WIRING is observable to any suite (headless Chromium's `visualViewport` always equals the layout viewport), so on-device reachability must be confirmed on hardware before merge. |
| 8b | The `interactive-widget=resizes-content` viewport meta tag already on `index.html:13` | **pass, informational — not a new finding** | The page already opts into `interactive-widget=resizes-content` (added earlier, per the inline comment at `index.html:5-11`) so that on a browser that honours it, the *layout* viewport itself shrinks with the keyboard and `85dvh` shrinks with it. Confirmed present via `document.querySelector('meta[name="viewport"]').content`. `TODOS.md` and that same comment already document that Safari does not honour this token (it keeps the default `resizes-visual`), which is exactly why item 8a is still live and exactly why this lane's `visualViewport` fix is necessary rather than redundant. Recorded here only so a future pass doesn't rediscover this meta tag and wonder if it already solved the problem - it solves it only for browsers this app does not currently depend on for the fix. |
| 9 | Edit sheet: extra rows show, DEGREES/LAYOUT/DELETE reachable at 380x800 | **pass** | Verified with a synthetic in-memory deck (never saved): all four Edit-only rows un-hide, `#scale-generate` relabels to `SAVE CHANGES` (660-712px), `DELETE THIS DECK` sits at 734-778px, both inside the 800px viewport. `#scale-degrees` is 48px tall with 11 options. Palette swatches all measure a full 44x44px hit area (matches the green "every palette swatch owns its full 44px hit area on BOTH axes"). ROTATE/MOVE/RESET buttons are all 44px tall. |
| 10 | Edit sheet primaries at the landscape proxy 844x390 (tallest case: Pygmy, has a bottom shell + full LAYOUT section) | **pass** | `SAVE CHANGES` at 271-323px of 390px, self-hit; `DELETE THIS DECK` at 332-376px, self-hit. Matches the green "SAVE CHANGES is reachable without scrolling on the largest pan the engine allows". |
| 11 | Safe-area insets (`env(safe-area-inset-*)`) | **not-verifiable-headless** | `.sheetsurf`'s computed `padding-bottom` read 22px under emulation, which is `max(--sp-4, env(safe-area-inset-bottom))` resolving to `--sp-4` because `env()` reads 0 with no real device notch/home-indicator to report. The CSS itself (`index.html:392` `viewport-fit=cover`, and the four-edge inset comment at `index.html:60-65`) is unit-covered by the passing e2e test "the page reserves a safe-area inset on all four edges", which checks the CSS declarations exist and compute correctly given a value, not that iOS actually reports a nonzero one. A real home-indicator/notch value can only be observed on hardware. |
| 12 | Landscape orientation, phone-sized (844x390, the owner's own device sideways) | **pass** | Card measures top 60px/bottom 291px inside a 390px-tall viewport; `+ ADD` sits at 65-131px, fully inside an 844px-wide viewport. Mode bar (`modeA`/`modeB`), Shuffle, prev/next all self-hit at their own centres and stay 44px tall. This is the case `tests/e2e.test.js` calls out as historically the worst ("+ ADD wraps onto a second line which `#decks` clips" - that comment describes a state that reproduces on `origin/main` per the test's own note, is deck-nav geometry owned by another lane, and is NOT reproduced here: `+ ADD` measured cleanly on-screen and self-hit in this pass). See finding F1 below for how this is tracked. |
| 13 | Deck-header print links | **not applicable AT THE TIME OF THIS AUDIT; now stale - re-audit needed** | Searched `index.html` for any print/PDF-download affordance (`a[href*=".pdf"]`, `a[download]`, `.print`/`#print`/`[id*="print"]`/`[class*="print"]`) and found none. **This no longer holds:** the rebase brought the affordance in - `PDF_LINKS` at `index.html:3806-3808`, with four covering tests in `tests/e2e.test.js`. It has never been audited on a phone. Tracked as F2 / queue row 21. Per the standing memory note ("Print button opens the existing PDF - whole deck set, as-is, no per-chord generation") this is expected work from another lane that had not landed on `main` at 839d70e when this audit ran. No verdict beyond "not present"; re-audit once that lane merges. |
| 14 | Keyboard-only navigation / focus visibility on `+ ADD` and inside the sheets | **pass** | `.focus()` on `#deck-add` lands `document.activeElement` there; Tab-trapping inside the Edit sheet and the seed-box focus ring are both covered and green in `tests/e2e.test.js` ("Tab is trapped inside the Edit sheet and reaches every Edit control", "the focus ring on the seed box is not clipped by the sheet body"). |

## Confirmed defect fixed by this lane

**The iOS keyboard can cover `GENERATE CARDS` / `SAVE CHANGES`** (checklist
item 8a). This took two passes, and the record of the first one matters more
than the code, because it is the case where every automated signal was green
and the fix was still wrong.

**Pass 1 - translate only, DISPROVED ON HARDWARE.** A `visualViewport`
`resize`/`scroll` listener translates `.sheetsurf` up by
`innerHeight - visualViewport.height - visualViewport.offsetTop` (the pure
function `kbOffset()`), applied via `applyKbOffset()` on sheet open and
cleared on close. CI was green, the pure math was unit-tested, and the first
`/review` passed it. The owner then ran the device check on an iPhone 14 /
iOS 26.6 and it FAILED: with the keyboard up, `GENERATE CARDS` was indeed
reachable, but `#scale-box` - the field being typed into - had been pushed
off the TOP of the screen.

**Why it looked fixed.** `.sheetsurf`'s `max-height:85dvh` is a LAYOUT-
viewport unit and does not react to the keyboard, so the surface keeps its
full height (~717px on an 844pt phone). Lifting a 717px surface by a 300px
keyboard puts its top edge at -173px. The reserved footer sits outside the
`.sheetbody` scroller and rides the translate, so the primary button - the
thing everyone checks first, and the thing this item is named after - comes
INTO view at exactly the moment the seed field leaves it. The first review
predicted this precisely (nit N4, queue row 34) and it was recorded as a
device-check instruction rather than treated as a defect.

**Pass 2 - cap as well as translate.** `kbCap(innerHeight, vvHeight)` returns
the max-height the surface must take to fit entirely inside the shrunken
visual viewport once translated; `applyKbOffset()` writes it to
`sheetSurf.style.maxHeight`, and `.sheetbody`'s existing shrink absorbs it.
It returns 0 when no keyboard is up, leaving the stylesheet's `85dvh`
untouched. It deliberately ignores `visualViewport.offsetTop`, which
`kbOffset()` already nets out: the surface is bottom-anchored, so the
translate places its bottom edge at `vvHeight + offsetTop` for any
`offsetTop`, and supplying a height rather than a position makes the top edge
land at `offsetTop + 8` regardless. Feeding `offsetTop` to both would
double-count it. Four unit tests, including the invariant the owner's
screenshot violated: capped and lifted, the top edge stays on screen and the
bottom clears the keyboard.

**What is still NOT verified by CI, and cannot be.** The pure math of both
functions is unit-tested. The WIRING of neither is: headless Chromium's
`visualViewport` always equals the layout viewport, so `kbOffset` and
`kbCap` both return 0 there and every write is the empty string -
indistinguishable from the functions never running. The second review
confirmed this by mutation: `applyKbOffset` gutted to `return;`, the
`maxHeight` write deleted outright, and `showSheet`'s call removed all
survive the entire suite. **A second on-device check is therefore required,
and it must cover the EDIT sheet, not only ADD** - Edit is the taller sheet
and the one pass 1 was never tested against. This is the one lane in the
current workstream that is not merge-authorized by CI alone.

## Findings queued for cycle 2 (not fixed here - out of this lane's scope)

- **F1 - Landscape `+ ADD` clipping, historical.** `tests/e2e.test.js`
  carries a comment (around its fold-viewport helper) describing `+ ADD`
  wrapping onto a second line at 844x390, which `#decks`'s `overflow:auto`
  then clips, so a tap there lands on `#hdr` instead and the sheet never
  opens via a real tap path. That comment says the condition "reproduces
  unchanged on `origin/main`" and is deck-nav geometry owned by another
  lane. This pass did **not** reproduce it (item 12 above measured `+ ADD`
  cleanly on-screen), which likely means it was already fixed by a landed
  lane since that comment was written - but the comment itself was not
  updated. Recommend: whoever owns deck-nav geometry confirms the comment is
  stale and removes/updates it, or re-investigates if there's a state this
  pass didn't hit (e.g. a wider chip row from more custom decks) that still
  triggers it.
- **F2 - No print/PDF link in the app yet** (checklist item 13). Tracked
  only as "not yet present" here; once that lane's markup lands, a follow-up
  mobile pass should audit its tap target size, placement inside the
  deck-header, and whether it survives the same 380px / landscape / safe-area
  checks as everything else in the header.
- **F3 - `interactive-widget=resizes-content` is Chromium-only cover, not
  a fix** (checklist item 8b, informational). No action needed unless a
  future browser landscape change makes it worth reconsidering whether the
  JS fallback in this PR can ever be retired - not now, since Safari does
  not honour the token as of this audit.
- **F4 - Safe-area insets are structurally correct but device-unconfirmed**
  (item 11). Same category as the keyboard fix: `env()` reads 0 under any
  headless/emulated viewport, so the CSS can only be reviewed, not proven,
  without hardware. Recommend folding this into the same device-check pass
  that confirms item 8a, since both need a real iPhone in hand anyway.
- Everything else already carried by `TODOS.md` as of this audit (the
  Pygmy title-card blurb count, the border-treatment change, the Python
  oracle tie-break, etc.) is unrelated to mobile usability and out of this
  lane's scope; not repeated here.

## What this pass could not check at all

- A real iOS soft keyboard (item 8a) and real `env(safe-area-inset-*)`
  values (item 11) - both require hardware, as `TODOS.md` already states
  for the keyboard case and as `tests/e2e.test.js`'s own fold-viewport
  comment states for Safari's dynamic toolbars and true `dvh`.
- Anything gated behind an actual save (renamed/deleted custom decks
  persisting across a real reload, share-link round-trips) was left to the
  existing, already-green e2e suite rather than re-driven here, since this
  pass was scoped to be read-only and those paths are not new.
