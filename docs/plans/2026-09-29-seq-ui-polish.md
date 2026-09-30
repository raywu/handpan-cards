# Chord-progression UI polish (lane UI)

- **Goal:** in mode S the card face carries only the chord (header, name, diagram, note lines) and nothing credits Moritz.handpan on the card or in the footer. The style tip ("<name> · <tip>") sits in the footer above a centred Marcellus rail, which is at least 18px and whose current chord meets 4.5:1. `#shuffle` is a 44px icon-only refresh button named "New progression". In every mode, `#prev`, `#shuffle` and `#next` share one centre line (within 0.5px). The "three-over-two" style displays as "3:2 polyrhythm". Every assertion in §3 is green in CI at the lane's head SHA.
- **Date:** 2026-09-29
- **Base:** `main` @ `db31ab9` (merge of PR #166). Every file:line below was read at that SHA. R1 (`claude/r1-retire-legacy-print`, 77e381f, no PR yet) deletes `index.html` blocks from :860 onward, so every `index.html` line after :860 moves once R1 merges. The lane re-greps each anchor by its quoted text and never trusts a line number (memory: mutant-hunk-headers-are-not-line-refs).
- **Shape:** one /swarm lane, UI, on `claude/seq-ui-polish`. It is serialised after R1 and before SW (§4).
- **Related docs:**
  - `docs/plans/2026-09-29-backlog-and-refactor.md`: R1 and R2, N15-N20.
  - `docs/plans/2026-09-29-card-swipe-animation.md`: SW, N21-N40.
  - `docs/plans/2026-09-29-chord-sequence-mode.md`: the original S design. It is historical, so its "Style from Moritz.handpan" (:226, :260) and "3 over 2" (:248) are left as they are.
  - `docs/plans/2026-09-27-followup-triage.md`: this plan follows its voice.
  - `docs/plans/2026-09-24-quality-eval.md`: the §6 gates.
  - The owner's source prompt, `docs/prompts/2026-09-29-chord-sequence-mode.md:25`, also says "3 over 2". It is left as it is.

## §1 Goal and non-goals

**Goal.** The owner's five requests plus the rename, and a short audit. The whole change is one lane, with its effect on the chrome measured before it starts.

Evidence: I prototyped the proposed CSS and DOM in Chrome by injecting it through `tests/helpers/cdp.js` into the unmodified `db31ab9` page. That run measured every number in §2 and wrote the `proto-*` screenshots. No tracked file was edited.

**Non-goals.** N1-N40 from the related plans carry over unchanged. New ones:

| # | Non-goal |
|---|---|
| N41 | No change to deck data, diagram geometry or any `src/engine/*` module. The style id `three-over-two` stays in `src/engine/sequence.js` and its inlined region, so there is no `inline_engine.py` run |
| N42 | No new colour and no new typeface. Every colour in §3 already appears in `index.html`: `#f1ece1`, `#eae6df`, `#c4bcab`, `#433b2c`, `#211d16`, `#2e281e` and `var(--root)`. Fonts are Marcellus and Nunito Sans only |
| N43 | No change to the A or B card faces. `tests/fixtures/seq_ui_base_e728912.json` is NOT regenerated. It stays byte-for-byte and is the proof of this non-goal (§3.4) |
| N44 | The settings-menu `#panel-seq-note` ("7 different ways to play chords: Watch on YouTube", `index.html:1156-1160`) stays exactly as it is, and so do its tests (app.test.js:4656, :4689; e2e :7326-7389) and mutants (`e_panel_moved_into_header`, `sqe_link_no_noopener`). Owner clarification 1 |
| N45 | No new feature. There is no tap-to-expand tip, no screen-reader announcement of a style change (§2 not-now X1) and no per-style icon |
| N46 | No edit to `CHROME_BUDGET` (e2e :2738) or `LANDSCAPE_BUDGET` (:2813). They run in mode A, and mode A's chrome is measured unchanged at all 10 viewports (§2 table M) |
| N47 | No change to `#shuffle`'s id, its `onclick` handler (`index.html:8103-8108`) or `setOrder()` |

## §2 Findings

### Owner items

| # | Owner item | Verified at | Current state | Fix |
|---|---|---|---|---|
| O1 | Move the style out of the card and into the UI | `index.html:6932-6939` (`backS`) | The S back face shows the chord name, then the style name (`.bigname` 22px), the tip (Bitter 13px `#c4bcab` on white paper, **1.89:1**) and the credit line. Screenshot: `380x700-hijaz-S-back.png` | `backS` becomes `headerHTML(...)` + the `.prompt` name only. A new static `<p class="seq-style" id="seq-style" hidden><b id="seq-style-name"></b> · <span id="seq-style-tip"></span></p>` goes inside `.mid`, before `#count`. `render()`'s S branch sets the two leaves' `textContent` (name in Marcellus 15px `#eae6df`; tip in Nunito Sans 12px/1.45 `#c4bcab`, which is **9.39:1** on the page) and un-hides the block; `renderSeqEmpty()` hides it; `setMode` hides it outside S (D16, D17) |
| O2 | Remove "Style from Moritz.handpan" | `index.html:6937` | It exists only on the S back face. After R1 it has no print copy (R1 deletes e2e :7586-7612). The menu link stays (N44) | Delete the `.hint` line from `backS`. No other copy exists at `db31ab9`: `grep -n Moritz index.html` finds only :1156 (a comment) and the menu note |
| O2b | Rename "3 over 2" to "3:2 polyrhythm" | `index.html:5961` (`SEQ_STYLE_COPY`, app JS, outside every engine region) | `"three-over-two": ["3 over 2", ...]`. No test, mutant or README mentions "3 over 2" | Change the display string only. The id is unchanged (N41). The two historical docs are left as they are (header) |
| O3 | Bigger, centred progression rail | `index.html:513-514` (`.count`, `.count.seq`), `:6899` (inline `--root` colour) | 11px Nunito Sans caps, `.12em` tracking. The current chord is drawn in `--root` on `#1a1815`: Hijaz 5.01, **Pygmy 2.46, Amara 3.46** (both fail AA). Screenshot: `380x700-pygmy-S-front.png` | `.count.seq{font:400 20px/1.2 Marcellus, serif; letter-spacing:0; color:#c4bcab; text-align:center}`. Delete `:6899`. Add `.seq-rail b{font-weight:400; color:#f1ece1; text-decoration:underline 2px var(--root); text-underline-offset:4px}`, which is 15.04:1 on every deck, and keep the deck colour as the underline. The widest rail ("G#sus4 → C#sus4 → D#sus4") was measured at 20px: it fits 296/296 at 320x568 and 334/334 at 667x375 and 844x390 |
| O4 | Refresh icon instead of "New progression" | `index.html:8207-8215` (`setMode`), `:525-530`, `:846` | A 9.5px caps text button, 154.6px wide at 1280 | In S, `setMode` sets `shuffleBtn.innerHTML` to an inline SVG constant (`viewBox="0 0 24 24"`, `stroke="currentColor"`, `aria-hidden="true"`, `focusable="false"`), sets `aria-label="New progression"`, and keeps the `.reroll` class. Leaving S calls `removeAttribute("aria-label")` and restores the `textContent` exactly as today. `.shuffle.reroll{width:56px; height:44px; padding:0}` matches `button.nav`. `.shuffle.reroll svg{width:20px; height:20px}`. `:846 :active` stays |
| O5 | Bottom controls middle-aligned | `index.html:507-512`, `:965-974` | In **every** mode and viewport, the arrows centre on the 55px `.mid` stack (count 11 + shuffle 44), so they sit **5.5px above** Shuffle's centre (for example `#prev` cy 635.8 vs `#shuffle` 641.3 at 380x700). Screenshots: `380x700-hijaz-A-front.png`, `844x390-hijaz-A-front.png` | The footer becomes a grid with `.mid{display:contents}` and the markup ids kept. A/B: `"count count count" / "prev shuffle next"`. S portrait: `"style style style" / "count count count" / "prev shuffle next"`. S landscape (`@media (max-height:520px)`): one row, `56px 1fr 56px 56px`, `"prev count shuffle next" / "prev style shuffle next"`. Measured: prev, shuffle and next have equal cy in A, B and S at all 10 viewports |

### Table M: measured chrome cost (prototype vs db31ab9)

Card = `.scene` width in px. The footer is 55px today in every mode.

| Viewport | A chrome (both) | A card (both) | S footer new | S card now → new |
|---|---|---|---|---|
| 390x844 | 225.7 | 343.2 | 119.1 | 343.2 → 343.2 |
| 390x745 | 225.7 | 342.7 | 119.1 | 342.7 → 329.6 |
| 380x700 | 225.7 | 322.0 | 119.1 | 322.0 → 297.0 |
| 375x667 | 225.7 | 306.8 | 119.1 | 306.8 → 273.1 |
| 320x568 | 227.7 | 246.4 | 119.1 | 246.4 → 200.0 |
| 844x390 | 158.7 | 167.5 | 61.8 | 167.5 → 162.6 |
| 926x428 | 158.7 | 195.0 | 61.8 | 195.0 → 190.1 |
| 667x375 | 158.7 | 156.6 | 61.8 | 156.6 → 151.8 |
| 1280x500 | 158.7 | 230.0 | 61.8 | 230.0 → 230.0 |
| 1280x800 | 245.7 | 368.0 | 101.8 (tip on 1 line) | 368.0 → 367.5 |

- A and B are unchanged to the pixel, so `CHROME_BUDGET` and `LANDSCAPE_BUDGET` hold (N46).
- S portrait costs +64px of footer. The card absorbs only what exceeds main's slack.
- S landscape costs +6.8px.
- Nothing scrolls at any viewport, including 380x700 and 844x390.

### Audit (all modes, three decks, menu; 844x390, 380x700, 1280x800, plus 320x568)

Severity scale: High (fails a WCAG AA floor), Med (visibly wrong), Low (polish).

| # | Finding | Evidence | Sev | Verdict |
|---|---|---|---|---|
| A1 | Arrows 5.5px off the Shuffle/refresh centre line, in A and B as well as S | O5 row; `metrics.json` | Med | **FIX** (same as O5) |
| A2 | The rail's current chord fails AA on Pygmy (2.46) and Amara (3.46) | `index.html:6899`; `380x700-pygmy-S-front.png`, `380x700-amara-S-front.png` | High | **FIX** (same as O3) |
| A3 | The style tip on paper is 1.89:1 | `index.html:6936`; `380x700-hijaz-S-back.png` | High | **FIX** (resolved by O1: it moves to the page at 9.39:1) |
| A4 | `.hint` has no `text-align`, so at 844x390 "TAP TO REVEAL THE NOTES" wraps onto 2 ragged, left-aligned lines inside a centred card | `index.html:491-492`; `844x390-hijaz-A-front.png` | Low | **FIX**: add `text-align:center` on the rule's SECOND line (`:492`), so the `-` line of `e_contrast_hint_faded` is untouched (§3.5) |
| A5 | Menu mode buttons have inconsistent widths: NAME→NOTES and NOTES→NAME sit at their natural width (118/118 at 1280) and centred, while CHORD PROGRESSION fills its row (199) | `index.html:202-206`; `380x700-menu-S.png`, `1280x800-menu-S.png` | Low | **FIX**: `.modebar .mode{flex:1 1 0}` after `:202`, so A and B share row 1 edge-to-edge and `#modeS{flex:1 0 100%}` (:206) keeps row 2 |
| A6 | The "NEW PROGRESSION" 9.5px caps label is the widest footer control | `1280x800-hijaz-S-back.png` | Low | **FIX** (resolved by O4) |

**Not now** (recorded, no lane):

| # | Item | Why not now |
|---|---|---|
| X1 | A new style after "New progression" is not announced (`#seq-style` is not live) | `#count` is already `aria-live` and announces the chord and position. A second live region would double-speak every re-roll. It needs a design, so it is a feature (N45) |
| X2 | S portrait costs the card up to -19% at 320x568 and -11% at 375x667 | The owner asked for the tip in the UI. Hiding it behind a tap is a feature. Clamping it to one line with an ellipsis loses content. Revisit only if the owner reports it |
| X3 | The deck-chip strip clips "D AMA..." at 380 | The strip is a deliberate horizontal scroller (`380x700-hijaz-A-front.png`). No change |
| X4 | `.announce` reserves ~24.7px at the page foot even when empty (`index.html:812`) | Removing it re-baselines `CHROME_BUDGET` for every viewport, which breaks N46. Its own lane, if ever |
| X5 | The S back face now shows only the header and chord name on a large empty card | That is the owner's request. Scaling the name up would change the card anatomy. Left for the owner to react to |

## §3 Lane UI

- **Branch:** `claude/seq-ui-polish`, cut from `main` **after R1 merges** (§4), in its own worktree.
- **Acceptance:** every test in §3.2-§3.3 is green, every `ui_*` mutant is killed, every existing mutant listed in §3.5 still applies and is still killed, and CI is green at the head SHA.

### §3.1 Owns / Never touches

**Owns**, all in `index.html`, anchored by text:
- CSS:
  - the `footer{` rule (:507-508), `button.nav` (:509-511) and `.mid{` (:512);
  - `.count`, `.count.seq` (:513-514) and `.shuffle` / `.shuffle.reroll` (:525-530);
  - a new `.seq-style` / `.seq-rail b` / `footer.seq` block, placed directly after `.shuffle.reroll:active` (:846);
  - line 2 of `.hint` (:492);
  - one new `.modebar .mode` line after :202.
- Markup: the `<footer>` block (:965-974). It gets `id="foot"` and the static `#seq-style` paragraph (with `#seq-style-name` and `#seq-style-tip` leaves, O1) before `#count`.
- JS:
  - `SEQ_STYLE_COPY["three-over-two"]` (:5961);
  - the `:6899` colour line in `renderSeqRail`;
  - the `backS` template (:6932-6939) and one `#seq-style` fill added after it;
  - one added line in `renderSeqEmpty()` (:6860-6869, after `countEmpty.classList.remove("seq")`) that sets `#seq-style` hidden (D17);
  - the `if (m === "S") { ... } else { ... }` shuffle block in `setMode` (:8207-8215), plus one `foot.classList.toggle("seq", m === "S")` and `seqStyle.hidden = m !== "S"`.

**Tests and harness it owns:**
- `tests/app.test.js`: the new tests U1-U5 (added after :4654) and nothing else.
- `tests/e2e.test.js`:
  - the new tests E1, E2, E4, E5 and E6;
  - E3, which replaces the body and name of :7513-7545;
  - the one-line re-target of :7199-7200 (textContent → aria-label);
  - the containment re-target in the 320x568 rail test (:7418, :7448): `.mid` becomes `display:contents` and has an empty rect, so `insideMid` measures `#foot` instead (D18). The test name is unchanged.
- `tests/helpers/sandbox.js`: append `"seq-style", "seq-style-name", "seq-style-tip", "foot"` to `ELEMENT_IDS` (:25-48).
- `tests/mutants/ui_*.patch` (new) and the context refreshes and re-targets in §3.5.
- `tests/suite_health.py`: the FLOORS rows for `tests/app.test.js` and `tests/e2e.test.js`.
- `README.md`: the mutant-count sentence (:127).

**Never touches:**
- `src/engine/*` and every `<!-- engine:... -->` region.
- The `const DECKS` line and `data/decks.json`.
- `tests/fixtures/*`.
- `#panel-seq-note` / `#seq-source-link` markup (:1156-1160) and their tests and mutants.
- `render()` outside the S branch.
- `step()`, `flip()` and `setOrder()`.
- The `#shuffle` `onclick` (:8103-8108).
- `CHROME_BUDGET` / `LANDSCAPE_BUDGET`.
- The `let tx` touch block (SW's).
- Every file R1 owns that is not listed above.
- `tests/mutation_check.sh` (memory: mutation-check-edits-stale-h-patches).

**Sandbox note (verified at `tests/helpers/sandbox.js:58-100`).** The four new ids go at the END of `ELEMENT_IDS`. The stub already supports `hidden` (plain property), `setAttribute`/`getAttribute` (null when absent)/`removeAttribute`, and `classList.toggle(name, force)`. It does NOT model two browser behaviours, and the lane does **not** change the stub (D19):
- `innerHTML` and `textContent` are independent slots (:67-68): setting one never clears the other;
- `textContent` never aggregates children.

So the unit tests read leaf ids (`#seq-style-name`, `#seq-style-tip`) and never assert that one assignment cleared the other; those cross-clearing checks live in E2, in a real browser.

### §3.2 Failing tests first: `tests/app.test.js` (sandbox, `boot()`)

| # | Test name (exact) | Asserts |
|---|---|---|
| U1 | `mode S shows the style in the footer, never on the card` | `setMode("S")`. For every style in `HPE.sequence.STYLES`, set `seq.style=s; render()`. Then `els.back.innerHTML` contains neither the style name nor the tip. `els["seq-style"].hidden === false`, `els["seq-style-name"].textContent === SEQ_STYLE_COPY[s][0]` and `els["seq-style-tip"].textContent === SEQ_STYLE_COPY[s][1]`. After `setMode("A")`, `els["seq-style"].hidden === true` and `els.foot.classList.contains("seq") === false` (it is `true` in S). A second boot with `storage: { hpfc: JSON.stringify({ mode: "S" }) }` starts with `#seq-style` shown and `foot.seq` set, with no `setMode` call from the test |
| U2 | `the three-over-two style reads exactly "3:2 polyrhythm"` | `get("SEQ_STYLE_COPY")["three-over-two"][0] === "3:2 polyrhythm"`. With `seq.style="three-over-two"; render()`, `els["seq-style-name"].textContent === "3:2 polyrhythm"`. `index.html` source does not contain `"3 over 2"` |
| U3 | `nothing on the card or in the footer credits Moritz.handpan; the menu link stays` | The `index.html` source does not match `/Style from Moritz/i`. In S, `els.back.innerHTML`, `els.front.innerHTML`, `#seq-style-name`, `#seq-style-tip` and `#count` text contain no `Moritz`. `#seq-source-link` still exists with the same href (N44) |
| U4 | `in mode S the re-roll control is an icon named "New progression", and leaving S restores Shuffle` | In S: `aria-label === "New progression"`, `innerHTML` matches `/^<svg[^>]*aria-hidden="true"/`, `.reroll` is set. After `setMode("A")`: `getAttribute("aria-label") === null`, `textContent === "Shuffle: off"`, `.reroll` is not set. (The stub cannot see one assignment clear the other, so "no text in S" and "no svg in A" are E2's.) |
| U5 | `an unsupported deck hides the style block and a working deck brings it back` | The existing :4744 pattern: `setMode("S")`, `generate("(C3) G3 D4 G4 D5")`, `select(...)`. `els["seq-style"].hidden === true`. Selecting `hijaz` un-hides it with the current style's name. Codex finding 4 (D17) |

The existing tests :4611, :4629 and :4643 are unchanged and must stay green. :4643's CSS regexes still match, because `.shuffle.reroll{` keeps `border:1px solid #433b2c` and `:846` stays.

### §3.3 Failing tests first: `tests/e2e.test.js` (CDP, real Chrome)

Run each test on its own (`--test-name-pattern`). Never run the full file locally (memory: chrome-bin-available-locally).

| # | Test name (exact) | Asserts |
|---|---|---|
| E1 | `the footer controls share one centre line in every mode` | For modes A, B and S at 380x700, 320x568, 844x390 and 1280x800: `\|cy(#prev)-cy(#shuffle)\| <= 0.5` and `\|cy(#next)-cy(#shuffle)\| <= 0.5`. In portrait, `#count`'s centre x is within 1px of the footer's centre x |
| E2 | `the mode S refresh button is a 44px icon that hit-tests to itself` | In S at 380x700 and 844x390: the `#shuffle` rect is at least 44x44. `elementFromPoint` at its centre is `#shuffle` or inside it. `aria-label` is "New progression". It contains an `svg` and `textContent.trim() === ""`. `#prev` and `#next` still hit-test to themselves. After switching to A: no `svg` inside `#shuffle`, no `aria-label`, `textContent === "Shuffle: off"` |
| E3 | `switching to mode S keeps the header and footer width fixed and grows the footer only by the style block` (replaces :7513) | At 390x844, 390x745, 380x700, 320x568, 844x390, 667x375 and 1280x800, compare A with S:<br>- header rect is identical (±0.5);<br>- footer `l` and `w` are identical;<br>- footer growth is ≤ 70px when `innerHeight > 520` and ≤ 10px otherwise;<br>- `document.scrollingElement.scrollHeight <= innerHeight`;<br>- `#seq-style`'s bottom is ≤ `innerHeight`;<br>- the card keeps the `assertCardFits` relation to `main` |
| E4 | `the rail is centred Marcellus of at least 18px and its current chord meets AA on every deck` | For hijaz, pygmy and amara in S: `#count`'s computed `fontFamily` starts with Marcellus, `fontSize >= 18`, `textAlign === "center"`. The rail `<b>`'s computed colour on `#1a1815` is ≥ 4.5:1. Its `textDecorationLine` includes `underline` and its `textDecorationColor` equals the deck's `colors.root` (codex finding 5: colour alone survives `text-decoration-line:none`) |
| E5 | `the hint line is centred under the card` | At 844x390 in A: `getComputedStyle(.hint).textAlign === "center"`. Each line box of the hint (via `Range.getClientRects`) is centred within 1px of the hint box |
| E6 | `the menu's NAME→NOTES and NOTES→NAME buttons split their row evenly` | At 380x700 and 1280x800 with the panel open: `\|w(#modeA)-w(#modeB)\| <= 1`, `left(#modeA) == left(#modeS)` ±1 and `right(#modeB) == right(#modeS)` ±1 |

Re-target: at :7199-7200, `"New progression" redraws without touching Shuffle's own on/off state` reads `getAttribute("aria-label")` instead of `textContent`. The name is unchanged, so no mutant `# suite:` header moves. `:7220` (`"Shuffle: off"` in A) is unchanged.

Existing tests that must stay green unedited:
- `the mode buttons and Shuffle are 44px tall...` (:2681);
- `the header and footer stay inside their pixel budget...` (:2755);
- `every interactive control has a press state` (:3298);
- `no press state dims the footer's small text with opacity` (:3383);
- the 320x568 one-line rail test (:7465) stays green with ONE edit: its `insideMid` containment (:7418, :7448) is re-targeted from `.mid` to `#foot`, because `.mid{display:contents}` has an empty rect and the check would fail on a correct lane (codex finding 1, D18). The measured widest rail fits at 20px.

### §3.4 Fixture

`tests/fixtures/seq_ui_base_e728912.json` holds only modes A and B faces and the count text (app.test.js:4779). This lane changes neither, so the fixture is **not regenerated or re-baselined**. `modes A and B render byte-identical DOM to the pre-lane base` staying green unedited is the proof of N43. If it goes red, the lane has changed an A/B face: fix the lane, never the fixture.

### §3.5 Mutants

**New, prefix `ui_`** (16). Each has a `# kills:` header naming one test above, and a `# suite:` header using `.` wildcards (memory: mutant-suite-headers-are-word-split).

| Mutant | Defect | Killed by |
|---|---|---|
| `ui_style_back_on_card` | Re-adds the style name and tip `<div>`s to `backS` | U1 |
| `ui_style_block_not_filled` | `render()` skips the `#seq-style` fill | U1 |
| `ui_style_block_left_visible` | `setMode` drops `seqStyle.hidden = m !== "S"` | U1 |
| `ui_footer_seq_class_sticks` | `foot.classList.toggle("seq", m === "S")` becomes `add("seq")` | U1 |
| `ui_rename_reverted` | `"3:2 polyrhythm"` becomes `"3 over 2"` | U2 |
| `ui_credit_back` | Re-adds the `Style from Moritz.handpan` hint line to `backS` | U3 |
| `ui_refresh_unnamed` | Drops `setAttribute("aria-label", "New progression")` | U4, E2 |
| `ui_refresh_label_leaks_into_A` | Drops `removeAttribute("aria-label")` on leaving S | U4 |
| `ui_mid_not_contents` | Drops `.mid{display:contents}` | E1 |
| `ui_landscape_style_row` | Drops the `@media (max-height:520px) footer.seq` override | E3 |
| `ui_rail_root_ink` | Restores `node.style.setProperty("color", "var(--root)")` | E4 |
| `ui_rail_small` | `.count.seq` back to `600 11px/1 "Nunito Sans"` | E4 |
| `ui_hint_not_centred` | Drops `text-align:center` from `.hint` line 2 | E5 |
| `ui_modebar_natural_width` | Drops `.modebar .mode{flex:1 1 0}` | E6 |
| `ui_style_survives_empty_seq` | Drops the `renderSeqEmpty()` line that hides `#seq-style` | U5 |
| `ui_rail_no_underline` | `.seq-rail b` loses its `text-decoration:underline ...` (colour stays) | E4 |

**Existing mutants whose anchors move.** Found with `grep -lF` over `tests/mutants/*.patch` for every text the lane edits. After rebasing onto R1, run `git apply --check` on each. The R2 test `every mutant patch applies to the tree it will run against` (tests/mutation_harness.test.js) catches any that the lane misses.

| Mutant | Anchor | Disposition |
|---|---|---|
| `sqe_reroll_not_marked` | `shuffleBtn.classList.add("reroll")`, with context from `textContent = "New progression"` | **Context refresh**. The `-` line is unchanged |
| `sqe_reroll_no_press_state` | `.shuffle.reroll:active{...}` (:846); the new block follows it | **Context refresh** if `apply --check` fails |
| `sqe_setmode_skips_setorder` | `if (wasS !== (m === "S")) setOrder();`, with context from `classList.remove("reroll")` | **Context refresh** |
| `sqe_count_not_positional` | The `live.textContent` line; context includes :6899 | **Context refresh** |
| `sqe_rail_innerhtml` | `node.textContent = c.main ...`; the next line (:6899) is deleted | **Context refresh** |
| `e_a11y_count_not_live` | The `<div class="count" id="count" aria-live="polite">` footer markup | **Context refresh**. The `-` line is unchanged; `<footer>` gains an id and `#seq-style` is inserted before it |
| `e_target_mode_shuffle_short` | The `.shuffle{... min-height:44px` line | **Context refresh**. Keep `min-height:44px` on the same line |
| `e_target_shuffle_overlay_eats_arrows` | `.shuffle` / `.shuffle.reroll` rules | **Context refresh**. The defect still bites in the grid: the `::after` covers both arrows on the same row |
| `e_shuffle_active_dims_with_opacity` | `.shuffle:active{color:#eae6df}` | **Context refresh** if needed. The `-` line is unchanged |
| `e_target_chrome_eats_card` | `justify-content:space-between; gap:var(--sp-2); margin-top:var(--sp-3)}` (footer line 2) | **Re-target**. The new `footer{` rule must keep `margin-top:var(--sp-3)` on its own final line, and the mutant's third hunk swaps that line for `margin-top:20px`. Same `# kills:` |
| `e_contrast_card_greys` | Context only (`footer{`/`button.nav{` nearby) | **Context refresh** if `apply --check` fails |
| `e_contrast_hint_faded` | `.hint{` line 1 | **Context refresh**. `text-align:center` goes on line 2, so the `-` line is unchanged |
| `p_footer_prints_over_the_card_sheet` | `body.printing > footer` | R1 retires or re-targets it. **R1's disposition stands**; the lane does nothing |
| `e_panel_moved_into_header`, `sqe_link_no_noopener` | Menu note (N44) | **Kept**. Context refresh only if R1's edits moved them |

No mutant is retired by this lane.

### §3.6 Counts and verify

- **FLOORS** (`tests/suite_health.py`): `tests/app.test.js` rises by +5 and `tests/e2e.test.js` by +5 (E3 replaces a test), applied to whatever values R1 leaves. No other row changes.
- **README** (`README.md:127`): the mutant count rises by exactly +16 over the post-R1 count. `tests/test_readme_currency.py` checks it.
- **Verify** (in the worktree):

  ```
  node --test tests/app.test.js
  node --test --test-name-pattern 'footer.controls.share|refresh.button.is.a.44px|grows.the.footer.only|rail.is.centred|hint.line.is.centred|split.their.row|New.progression..redraws|44px.tall|pixel.budget|press.state|longest.rail' tests/e2e.test.js
  python3 -m unittest tests.test_suite_health tests.test_readme_currency tests.test_render_agreement -v
  python3 tools/validate.py && node tools/boot_sim.js
  node --test --test-name-pattern 'every.mutant.patch.applies' tests/mutation_harness.test.js
  for p in tests/mutants/ui_*.patch; do git apply --check "$p" || echo "STALE $p"; done
  ```

- CI's mutation gate at the head SHA is the evidence for the kills. Do not run `tests/mutation_check.sh` locally.

## §4 Order relative to R1 and SW

**Confirmed: after R1, before SW.**

- **R1 → UI.** R1 edits `tests/app.test.js`, `tests/e2e.test.js`, `tests/helpers/sandbox.js` (it removes `printroot` and `printgeom`), FLOORS and the README count, and deletes `index.html` blocks that shift every UI anchor. The file-ownership sets overlap, so the two cannot run concurrently. R1 is further along (a commit exists and is finishing its README count), and UI's line anchors are easier to re-grep than R1's 25-29 mutant refreshes.
- **UI → SW.** SW's Never-touches includes the footer markup (`:961-968`) and its N38 forbids touching the step call sites. UI rewrites that markup and the footer CSS, so SW must see the final footer. If SW went first, UI would have to refresh SW's new mutants too. SW's own region (a CSS block after `main{}` and the `let tx` block) does not overlap UI's, so SW's rebase is limited to line drift.
- SW is already serialised after R1 (backlog §4), so the final order is **R1 → UI → SW**.

## §5 Merge-gate deltas

The standing gates from quality-eval §6 and CLAUDE.md apply unchanged, plus these:

1. Before the reviewer is spawned, the lane report quotes `git apply --check` output for every mutant in §3.5 and every `ui_*` patch at the head SHA.
2. The reviewer's brief includes table M. The reviewer re-measures S footer growth at 380x700 and 844x390 and FAILs if it exceeds the E3 bounds, or if A chrome differs from `CHROME_BUDGET`.
3. The reviewer checks N42 mechanically: every hex colour the diff adds already appears on the base side of `index.html`.
4. The reviewer checks N44: the diff shows no change inside `#panel-seq-note`, and `tests/fixtures/` is untouched (N43).
5. The PR body carries before/after screenshots at 380x700 and 844x390 in S.

## §6 Decisions taken for the owner (AFK)

| # | Decision | Alternatives | Why |
|---|---|---|---|
| D1 | The style block sits in the footer, above the rail | The header, under the deck chips; a tooltip on the rail | The header is the one-row landscape budget. Below the card, the reading order is how to play, then where you are, then the controls. It measured +6.8px in landscape |
| D2 | Format: one paragraph, Marcellus name + " · " + Nunito tip, existing greys | Two lines (name, then tip) | Saves a line in portrait (~20px of card) |
| D3 | The S back face keeps the header and chord name only | Scaling the name up to fill the card | The anatomy is unchanged. Recorded as X5 for the owner |
| D4 | The menu video link stays (owner clarification 1) | - | Owner instruction |
| D5 | The rename is display-only; id `three-over-two` is unchanged | Renaming the id to `three-two` | The id is engine data used by `pick()` and the tests; renaming it changes the engine for no user-visible gain |
| D6 | Refresh button: inline SVG circular arrow in a 56x44 frame identical to `button.nav`, with `aria-label` and no `title` | A text+icon combo; a `title` tooltip | The owner asked to save space. The three buttons now read as one control set. `title` duplicates the label to screen readers on some browsers |
| D7 | Mode A and B adopt the same aligned grid | Fixing S only | O5's misalignment exists in every mode. It costs 0px (table M) |
| D8 | Landscape S puts the style under the rail in the middle column, on one row with the buttons | Stacking it as in portrait (+64px) | +6.8px instead of about +64px on the tightest viewport class |
| D9 | Accept the portrait S cost (+64px of footer; card -8% at 380x700, -19% at 320x568) | Clamping the tip to one line; a tap-to-show tip | Clamping hides content. A tap-to-show tip is a feature (N45). Recorded as X2 |
| D10 | The current chord is drawn `#f1ece1` with a `--root` underline | Keeping `--root` ink at the larger size | Pygmy's 2.46 fails even the 3:1 large-text floor. The underline keeps the deck colour cue without a new colour |
| D11 | The fixture is not regenerated (N43) | Regenerating it as the brief assumed | A/B faces are unchanged, so an unchanged fixture is the stronger proof |
| D12 | The footer hook is `id="foot"` + a `.seq` class toggled in `setMode` | `footer:has(...)` | Testable in the sandbox and not dependent on `:has` support. It adds one id, which is SW's concern only after it rebases |
| D13 | E3 replaces and renames the "does not move or resize" test | Keeping it and exempting S | Its claim is false by design now. No mutant names it in `# suite:` (grep: 0 hits), so the rename strands nothing |
| D14 | The style change is not announced to screen readers | Making `#seq-style` a live region | It would double-speak on every re-roll. Recorded as X1 |
| D15 | Order: R1 → UI → SW | UI before R1 | §4 |
| D16 | `#seq-style` is static markup with two leaf ids, filled by `textContent` | Building a `<b>` and text nodes in `render()` | No DOM churn per render, no markup injection path, and the sandbox can read each leaf (its `textContent` does not aggregate children). Added by eng review |
| D17 | `renderSeqEmpty()` hides `#seq-style`; the S render un-hides it | Leaving the last style visible on an unsupported deck | A stale "how to play" line under "this scale has no progression" is wrong. Added by eng review (codex finding 4), tested by U5 |
| D18 | Re-target the 320x568 rail test's containment from `.mid` to `#foot` | Keeping `.mid` a real box and aligning with `align-items` | `display:contents` is what gives one centre line in every mode at 0px. The test's claim (the rail stays in the footer and off the arrows) is unchanged. Added by eng review (codex finding 1) |
| D19 | The sandbox stub is not changed; cross-clearing checks move to E2 | Teaching the stub browser `innerHTML`/`textContent` semantics | The stub is shared by every app test and boot_sim; changing assignment semantics risks unrelated reds. A real browser already runs E2. Added by eng review (codex finding 2) |

## GSTACK REVIEW REPORT

/plan-eng-review, spawned session (auto-chose recommended options), 2026-09-29, base `db31ab9`.

**Scope challenge.** ~8 files (index.html, app.test.js, e2e.test.js, sandbox.js, suite_health.py, README.md, tests/mutants/, this plan) trips the complexity gate. Kept as one lane: every file is a test or count that follows from the index.html change, and splitting would put the same footer markup in two lanes. No scope cut; no scope added beyond the owner's items and A4/A5.

**Architecture.** Sound. Footer grid with `.mid{display:contents}` reuses the existing `@media (max-height:520px)` landscape breakpoint (`index.html:58`, :247, :383, :711). State lives in one place (`setMode` + the S render branch). Gap found: the unsupported-deck path (`renderSeqEmpty`, `index.html:6860`) left the style block stale. Fixed (D17, U5, `ui_style_survives_empty_seq`).

**Code quality.** Static leaves filled by `textContent` (D16) remove the only injection-shaped path. The SVG constant is the one `innerHTML` write and carries no data.

**Tests.** Four defects in the draft, all fixed:
1. The 320x568 rail test's `insideMid` (e2e :7418, :7448) would fail on a correct lane, since a `display:contents` box has an empty rect. Re-targeted to `#foot` (D18).
2. U4 asserted cross-clearing that the sandbox stub (`tests/helpers/sandbox.js:67-68`) cannot model. Moved to E2 (D19).
3. U1-U3 read aggregate text from a node with children, which the stub never aggregates. Now they read leaf ids (D16).
4. E4 would pass with the underline removed. It now asserts `textDecorationLine`, and `ui_rail_no_underline` kills it.
Also added: U1 boots with stored mode S, so the boot path through `setMode(mode)` (`index.html:8277`) is covered.

Coverage:
```
setMode(S/A) ── shuffle icon+label ... U4, E2 (+A-side restore)
             ├─ foot.seq toggle ...... U1 (incl. stored-S boot)
             └─ #seq-style hidden .... U1
render S ───── style leaves fill ..... U1, U2, U3
             ├─ rail font/ink/underline E4
             └─ backS no style/credit  U1, U3
renderSeqEmpty ─ hides style ......... U5
CSS grid ────── centre line A/B/S .... E1; footer growth E3; rail fit :7465
.hint / .modebar ..................... E5, E6
A/B faces unchanged .................. fixture test :4779 (N43)
```

**Performance.** No concern: one static node, no new listeners, no per-render allocation beyond today's rail.

**Outside voice.** `codex exec -s read-only`: 5 findings, all verified against the code and accepted (above). None rejected.

**Failure modes.** R1 lands with different line numbers (mitigated: anchors by text). A mutant context drifts (mitigated: `apply --check` + R2's harness test). S portrait card shrink on small phones (accepted, X2/D9).

**Counts after review.** app +5, e2e +5, `ui_*` mutants 16, README +16.

**Implementation order.** Tests U1-U5 and E1-E6 red first; markup + CSS; JS (`setMode`, render S, `renderSeqEmpty`, `SEQ_STYLE_COPY`); e2e re-targets; mutants + refreshes; FLOORS + README; push and let CI's mutation gate decide.

**Worktree parallelization.** None: one lane, serialised R1 → UI → SW (§4).

NO UNRESOLVED DECISIONS
