# App-to-brand mapping: Handpan Theory

Source: `dev` tree (index.html app `<style>` outside engine regions, plus app JS/head colours; `tools/gen_scale_page.py` CSS_HEAD / CSS_EXTRA / INDEX_CSS_HEAD / CARD_CSS / BADGE_CSS; handpan-101/index.html; 404.html). Targets: `look/tokens.json` + README. Counts are declarations (a shorthand with two values counts once per value). Machine-readable rows: `mapping.json` (same folder).

## Counts

| Kind | Chrome values | Chrome uses | Card values (locked) | Card uses |
|---|---|---|---|---|
| Colour | 38 | 172 | 18 | 45 |
| Font family | 10 | 53 | 3 | 15 |
| Font size | 17 | 60 | 10 | 16 |
| Letter-spacing | 8 | 19 | 4 | 10 |
| Shadow / ring / filter | 5 | 6 | 2 | 3 |
| Border-radius | 8 | 27 | 1 | 6 |
| Spacing (margin / padding / gap) | 30 | 226 | not itemised (15 card decls, locked) | 15 |

Action legend: **on token** = already matches; **to token** = change value to an existing token; **new token** = keep the value, add it to tokens.json under the given name; **merge** = fold into another value/token; **drop** = remove; **n/a** = layout/functional, not a brand value.

## Owner decisions: three conflicts with the board

| # | App today | Board | Default | Why |
|---|---|---|---|---|
| 1 | gold `#E3B25C` (13 decls + JS: focus ring, links, About h3, warn / stale / armed-delete states, hub and handpan-101 `--r`, gold CTA) | accent-gold `#F5C78E` | **Keep `#E3B25C` as a new functional token `signal`; `#F5C78E` stays mark-only (logo orbit, the progression underline).** | Every app use is text or a state signal; the README forbids accent-gold as text. `#F5C78E` is a pale peach close to text-primary / cream `#F1ECE1`, so a warn line would stop reading as a warning. Both pass AA (9.9 vs 12.4:1 on `#0F0E0B`), so nothing forces the change, and it is the most test-pinned chrome colour (5 e2e computed-colour asserts, SHARED_ROOT, About regexes, handpan-101). |
| 2 | text `#EAE6DF` (19) + h1 `#F4F0E8` | text-primary `#F6F4ED` | **Adopt `#F6F4ED`; merge `#F4F0E8` into it.** | Collapses two near-duplicate creams into the board value; contrast rises (14.2 -> 17.5:1 on the new ground) and the card stays the loudest thing because the card is pure white. Cost is mechanical: SHARED_ROOT in test_scale_pages.py, About regex, one e2e press-colour assert, 11 mutant contexts. Keep cream `#F1ECE1` as a separate `surface-inverse` (fills, not text). |
| 3 | ground `#1A1815` (`--table`, theme-color, About, hub, handpan-101) + radial `#26221C` | background `#0F0E0B` | **Adopt `#0F0E0B`, flatten the radial (drop `#26221C`).** | Every locked palette frame gains contrast (worst, Pygmy purple `#6D40A3`: 2.46 -> 2.68:1); it opens a real one-step ladder: the board's surface `#1A1814` is the old ground, so header, chips, buttons and sheets (today `#1F1B15` / `#211D16` / `#272219`, three near-identical browns) all fold into `surface`; README forbids glow on chrome. Cost: theme-color + `--table` move together (app.test.js asserts both and the literal `#1a1815`), e2e frame-pixel TABLE/TABLE2 and `html` bg `rgb(26,24,21)`, test_scale_pages BROWN/SHARED_ROOT/About bg, test_handpan_101 theme-color / `.open` colour / contrast. |

## New tokens proposed (values kept from the app)

| Token | Value | From |
|---|---|---|
| signal | `#E3B25C` | focus ring, links, warn (conflict 1 default) |
| signal-error | `#E27005` (alias of bottom-orange, one orange only) | error text/borders, panghost |
| signal-ok | `#A4C9A0` | success message |
| surface-inverse | `#F1ECE1` | `.mode.on`, Generate/Next, swatch ring, preview plate |
| surface-inverse-pressed | `#DDD7CB` | `:active` of cream controls |
| surface-pressed | `#2E281E` (re-derive one step above `#1A1814`) | `:active`/hover of surface buttons; absorbs `#2A251C`, `#2C2619`, `#332C22` (press) |
| text-placeholder | `#6F675A` | input placeholder |
| scrim | `rgba(0,0,0,.45)` | settings scrim |
| type: label-xs | 9.5px / 600 / .13em / uppercase | footer text buttons, sheet labels |
| type: button-label | 10.5px / 600 / .08em / uppercase | `.mode`, tabs, prints |
| type: body-sm | 14px | page `.muted`, CTA, saved status, panel heading |
| type: input / prose | 16px | form controls (iOS zoom floor), About body |
| type: icon-glyph | 18px | arrow glyphs until line icons land |
| type: progression-sm | 20px display, .02em | chord rail on phones (board `progression` 32px from 640px) |
| type: heading-md | 24px display | About h3, page h2 |
| type: heading-lg | clamp(30px,7vw,44px) display | page h1, About h2 |
| radius-round / radius-xs | 50% / 2px | dots; focus-outline corner, lip pill |
| spacing: gutter / page-end | 16px / 48px | page side padding (CLAUDE.md 16px gutter); page bottom |
| spacing: pad-control-x/y, pad-field, pad-button | 11/13px, 6-7px, 9px, 12px | component-internal padding (not the ramp) |
| sp-1..4 responsive | desktop 6/12/20/28, short (max-height 520) 3/6/9/14 | the app ramp already has these steps; tokens.json lists only the phone values |
| family variants | `ui-ja`, `ui-zh-Hant`, `ui-zh-Hans`, `display-*` | `:lang()` stacks |

## Colour (chrome)

| Value | Uses | Where | Selectors | Action | Target | Pinned by tests |
|---|---|---|---|---|---|---|
| `#eae6df` | 19 | app 16, scale pages 1, scales hub 1, handpan-101 1 | body {color}; #share-url {color}; button.nav {color}; .seq-style b {color} +14 more | **to token** | text-primary #F6F4ED - CONFLICT 2. Body text: body, About, inputs, nav arrows, sheet text, scale-page nav, hub/h101 --fg. | test_scale_pages.py SHARED_ROOT + About regex; test_handpan_101_page.py contrast loop; e2e.test.js armed-delete press rgb(234,230,223); 11 mutants |
| `#f1ece1` | 19 | app 19 | .mode.on {background}; .mode.on {border-color}; #settings-trigger[aria-expanded="true"] {background}; #settings-trigger[aria-expanded="true"] {border-color} +15 more | **new token** | surface-inverse #F1ECE1 - Cream fill (19): .mode.on, primary Generate/Next, swatch ring, scale preview plate. | e2e.test.js cream rgb(241,236,225); 14 mutants |
| `#c4bcab` | 18 | app 16, scales hub 1, handpan-101 1 | .panel-note a {color}; .mode {color}; .panel-heading {color}; .prints button, .prints select, #lang-select {color} +13 more | **to token** | text-secondary #A9A39A - Muted text (18): count, mode labels, messages, About h4, hub/h101 --muted. A9A39A is 7.1:1 on #0F0E0B / 7.08 on surface. | test_scale_pages.py SHARED_ROOT + "#about h4 color:#c4bcab" regex + contrast loop; test_handpan_101_page.py; e2e.test.js N-A9 notice rgb(196,188,171); 12 mutants |
| `#a79d8b` | 13 | app 13 | .panel-note {color}; .seq-style {color}; .shuffle {color}; .sheetlabel {color} +9 more | **merge** | text-secondary #A9A39A - Quieter muted text (13): footer text buttons 9.5px, inactive tabs, panel note, lip pill. Near-identical to A9A39A (6.6 vs 7.1:1). | e2e.test.js "delete link is not #a79d8b" rgb(167,157,139); 15 mutants |
| `#433b2c` | 13 | app 12, scale pages 1 | .mode {border}; #share-url {border}; #settings-panel {border-left} @@media (min-width:1024px) and (min-height:700px); .prints button, .prints select, #lang-select {border} +9 more | **to token** | hairline #3A352D - 1px borders (13): buttons, inputs, settings panel edge, tabs, scale-page nav. | test_scale_pages.py "border:1px solid #433b2c"; app.test.js reroll border regex; test_handpan_101_page.py assertNotIn (still holds); 10 mutants |
| `#e3b25c` | 13 | app 11, scales hub 1, handpan-101 1 | :focus-visible {outline}; #scale-msg.warn, .announce.warn {color}; #scale-drawer-status.warn {color}; #scale-layout-state {color} +8 more | **new token** | signal #E3B25C (board accent-gold #F5C78E stays mark-only) - CONFLICT 1. Focus ring, links, About h3, warn/stale/armed states, hub/h101 --r and gold CTA. | e2e.test.js focus ring rgb(227,178,92) x3 + warn/armed x2; test_scale_pages.py SHARED_ROOT + About h3/a regex + contrast; test_handpan_101_page.py --r; 6 mutants |
| `#1f1b15` | 10 | app 10 | #settings-panel {background}; #scale-sheet {background}; .sheetsurf {background}; #scale-sheet.lipped #scale-footslide {background} +6 more | **to token** | surface #1A1814 - Sheet, settings panel, plate band, drawer status, lip (10). Surface one step above the new ground. | test_scale_pages.py assertNotIn #1f1b15 in About (still holds); 11 mutants |
| `#1a1815` | 8 | app 3, scales hub 1, handpan-101 3, app <head> 1 | :root {--table}; #about {background}; .abouthead {background}; :root {--bg} +3 more | **to token** | background #0F0E0B - CONFLICT 3. Ground for app --table, theme-color, About, hub, handpan-101 (and dark text on gold .open in h101 -> background too). | app.test.js "theme-color ... matching --table" (asserts #1a1815); e2e.test.js "html's computed background-color is the table colour" rgb(26,24,21) + frame-pixel TABLE matrix; test_scale_pages.py BROWN/SHARED_ROOT, About bg + .abouthead regex; test_handpan_101_page.py theme-color, .open/a.open color, ratio vs #1a1815; 9 mutants |
| `#211d16` | 7 | app 6, scale pages 1 | #share-copy:disabled:active {background}; .mode {background}; #share-url {background}; .prints button, .prints select, #lang-select {background} +3 more | **to token** | surface #1A1814 - Buttons: .mode, nav arrows, prints, share-url, reroll, scale-page nav label. | test_scale_pages.py "background:#211d16" (scale nav); app.test.js #share-copy:disabled:active; 5 mutants |
| `#272219` | 5 | app 5 | .chip {background}; .mode.on {color}; #settings-trigger[aria-expanded="true"] {color}; #scale-generate, #scale-next {color} +1 more | **to token** | chip bg -> surface #1A1814; ink on cream -> background #0F0E0B - 5 uses: .chip background; dark text on #f1ece1 (.mode.on, generate/next, settings-trigger open, panghost). The SVG pansel-ink use is diagram (locked). | app.test.js pansel-ink stroke #272219 (diagram, unchanged); 8 mutants |
| `#e27005` | 5 | app 5 | #scale-box.bad {border-color}; #scale-refusal.err {color}; #scale-msg.err, .announce.err {color}; #scale-fields input.bad {border-color} +1 more | **new token** | signal-error = bottom-orange #E27005 (alias, same value) - Error border/text, panghost. CLAUDE.md: one orange only. | app.test.js pan marks #E27005; test_print.py SPEC_BOTTOM_ACCENT |
| `#fff` | 4 | app 3, scale pages 1 | .chip.on {color}; html,body {background} @@media print; body {background} @@media print; .open {color} | **to token** | text-primary #F6F4ED (chip.on label); keep #fff on scale-page light .open; keep #fff in @media print - 4 uses: .chip.on text, scale .open text (light theme), 2 print-only backgrounds. | test_scale_pages.py accents vs #ffffff >=4.5 (light .open) |
| `#ddd7cb` | 4 | app 4 | .mode.on:active {background}; .mode.on:active {border-color}; #scale-generate:active, #scale-next:active {background}; #scale-generate:active, #scale-next:active {border-color} | **new token** | surface-inverse-pressed #DDD7CB - :active of cream controls. | 4 mutants |
| `#2e281e` | 3 | app 3 | button.nav:active {background}; .mode:active {background}; .shuffle.reroll:active {background} | **new token** | surface-pressed #2E281E (re-derive one step above surface) - :active of surface buttons (.mode, nav, reroll). | app.test.js ".shuffle.reroll:active{background:#2e281e}"; 7 mutants |
| `#151310` | 3 | app 3 | #scale-box {background}; #scale-name {background}; #scale-fields input {background} | **to token** | background #0F0E0B - Input wells (scale box, name, fields): ground colour reads as recessed inside surface. | 1 mutant |
| `#332c22` | 3 | app 3 | .sheetbody {border-bottom}; #scale-sheet.lipped #scale-footslide {border-top}; .chip:active {background} | **to token** | hairline #3A352D (borders); surface-pressed (chip:active) - sheetbody/footslide hairlines + chip press. | 3 mutants |
| `#000` | 2 | app 2 | .decks {-webkit-mask-image}; .decks {mask-image} | **n/a** | - - mask-image stop for the chip row fade (alpha only). | none |
| `rgba(226,112,5,.22)` | 2 | app 2 | .panghost {background}; #scale-preview .panhit:active {fill} | **new token** | signal-error @22% (alias of bottom-orange) - panghost / panhit:active fill. | app.test.js (SVG) unchanged |
| `#15181b` | 2 | scale pages 2 | :root {--bg} @@media (prefers-color-scheme:dark); .open {color} @@media (prefers-color-scheme:dark) | **to token** | background #0F0E0B - Scale pages dark --bg + dark .open text (blue-grey ground, off-brand). | test_scale_pages.py BG_DARK + accent ratios; 15 frozen fixtures; re-derive accent_dark |
| `#26221c` | 1 | app 1 | :root {--table2} | **drop** | flat background (or surface #1A1814 if a highlight is kept) - --table2 radial highlight behind the card; README: no glow on chrome except the mark. | e2e.test.js frame-pixel TABLE2 [38,34,28]; 1 mutant |
| `#f4f0e8` | 1 | app 1 | h1 {color} | **merge** | text-primary #F6F4ED - App h1 colour; the h1 becomes the lockup (visually hidden text). | none (test_icons hit is unrelated) |
| `#d5cec2` | 1 | app 1 | .chip {color} | **to token** | text-secondary #A9A39A - Chip label; tokens.json chip-label on text-secondary (7.1:1 on background). | none |
| `color-mix(insrgb,var(--dgb)55%,transparent)` | 1 | app 1 | .chip.on {box-shadow} | **drop** | - - Active-chip 1px tone ring; README: active chip = 1.5px root border + dot. | none |
| `rgba(0,0,0,.45)` | 1 | app 1 | #settings-scrim {background} | **new token** | scrim rgba(0,0,0,.45) - Settings scrim. | none |
| `#2a251c` | 1 | app 1 | .prints button:hover, .prints button:focus-visible, .prints select:hover, .prints select:focus-visible, #lang-select:hover, #lang-select:focus-visible {background} | **merge** | surface-pressed - prints hover/focus. | 3 mutants |
| `#a4c9a0` | 1 | app 1 | #scale-msg.ok, .announce.ok {color} | **new token** | signal-ok #A4C9A0 - Success message. | none |
| `#6f675a` | 1 | app 1 | #scale-fields input::placeholder, #scale-box::placeholder {color} | **new token** | text-placeholder #6F675A - Input placeholder (3.2:1, placeholder only). | none |
| `#b3aa98` | 1 | app 1 | #scale-fields.passive input, #scale-box.passive {color} | **merge** | text-secondary #A9A39A - Passive-path input text. DI test needs >=7:1 vs the sheet: A9A39A on surface #1A1814 = 7.08 (passes, barely). | e2e.test.js DI ">= 7:1" (computed); 1 mutant |
| `#4a4233` | 1 | app 1 | #scale-fields.passive input, #scale-box.passive {border-color} | **merge** | hairline #3A352D - Passive input border. | 1 mutant |
| `#2c2619` | 1 | app 1 | #scale-swipe-cue {background} | **merge** | surface-pressed - swipe-cue disc. | 1 mutant |
| `#fbfaf8` | 1 | scale pages 1 | :root {--bg} | **to token** | background light #F6F4ED - Scale pages light --bg. Accents were derived against it (accents()). | test_scale_pages.py BG_LIGHT + accent ratio 4.5..4.8 band; test_handpan_101_page.py assertNotIn; 15 frozen fixtures; re-run accents and tools/scale_pages.json |
| `#1f2328` | 1 | scale pages 1 | :root {--fg} | **to token** | text-primary light #0F0E0B - Scale pages light --fg. | 15 frozen fixtures only |
| `#5d646c` | 1 | scale pages 1 | :root {--muted} | **to token** | text-secondary light #5E5850 - Scale pages light --muted. | 15 frozen fixtures only |
| `#e8eaec` | 1 | scale pages 1 | :root {--fg} @@media (prefers-color-scheme:dark) | **to token** | text-primary #F6F4ED - Scale pages dark --fg. | 15 frozen fixtures only |
| `#9aa2aa` | 1 | scale pages 1 | :root {--muted} @@media (prefers-color-scheme:dark) | **to token** | text-secondary #A9A39A - Scale pages dark --muted. | 15 frozen fixtures only |
| `#3a342b` | 1 | handpan-101 1 | :root {--rule} | **to token** | hairline #3A352D - handpan-101 --rule (section rule). | none |
| `#222` | 1 | 404 1 | body {color} | **to token** | text-primary (adopt shared dark head) - 404 text on default white. | none |
| `#2563b0` | 1 | 404 1 | a {color} | **to token** | signal #E3B25C (adopt shared dark head) - 404 link uses the Kurd palette blue. | none |

## Font family (chrome)

| Value | Uses | Where | Selectors | Action | Target | Pinned by tests |
|---|---|---|---|---|---|---|
| `Nunito Sans` | 27 | app 24, scale pages 1, scales hub 1, handpan-101 1 | body; .chip; .panel-note; .mode +20 more | **on token** | ui ("Nunito Sans", system-ui, sans-serif) - 21 app rules use the short form in font: shorthand (no fallback) - normalise via one --font-ui var. | none |
| `Marcellus` | 12 | app 5, scale pages 3, scales hub 2, handpan-101 2 | h1; .panel-heading; .count.seq; #about h2 +3 more | **on token** | display (Marcellus, "Cormorant Garamond", Georgia, serif) - h1, panel heading, progression rail, About/page headings. | test_scale_pages.py regexes pin "Marcellus,serif" / "\"Marcellus\", serif" text |
| `Bitter` | 7 | app 7 | #scale-box-wrap; #scale-box; #scale-parse; #scale-name +3 more | **on token** | notes (Bitter, Georgia, serif) - Sheet scale entry (box, fields, name, parse line, hint). | none |
| `"nunito sans", "hiragino sans", "hiragino kaku gothic pron", "yu gothic", "noto sans cjk jp", "noto sans jp", sans-serif` | 1 | app 1 | :lang(ja) body, :lang(ja) .mode, :lang(ja) .prints button, :lang(ja) .prints select, :lang(ja) #lang-select, :lang(ja) .panel-note, :lang(ja) .chip | **new token** | ui-ja (Latin face first, CJK fallbacks) - :lang(ja) override for the interface tables. | none |
| `marcellus, "hiragino mincho pron", "yu mincho", "noto serif cjk jp", serif` | 1 | app 1 | :lang(ja) .panel-heading | **new token** | display-ja (Latin face first, CJK fallbacks) - :lang(ja) override for the interface tables. | none |
| `"nunito sans", "pingfang tc", "microsoft jhenghei", "noto sans cjk tc", "noto sans tc", sans-serif` | 1 | app 1 | :lang(zh-Hant) body, :lang(zh-Hant) .mode, :lang(zh-Hant) .prints button, :lang(zh-Hant) .prints select, :lang(zh-Hant) #lang-select, :lang(zh-Hant) .panel-note, :lang(zh-Hant) .chip | **new token** | ui-zh-Hant (Latin face first, CJK fallbacks) - :lang(zh-Hant) override for the interface tables. | none |
| `marcellus, "pingfang tc", "microsoft jhenghei", "noto serif cjk tc", serif` | 1 | app 1 | :lang(zh-Hant) .panel-heading | **new token** | display-zh-Hant (Latin face first, CJK fallbacks) - :lang(zh-Hant) override for the interface tables. | none |
| `"nunito sans", "pingfang sc", "microsoft yahei", "noto sans cjk sc", "noto sans sc", sans-serif` | 1 | app 1 | :lang(zh-Hans) body, :lang(zh-Hans) .mode, :lang(zh-Hans) .prints button, :lang(zh-Hans) .prints select, :lang(zh-Hans) #lang-select, :lang(zh-Hans) .panel-note, :lang(zh-Hans) .chip | **new token** | ui-zh-Hans (Latin face first, CJK fallbacks) - :lang(zh-Hans) override for the interface tables. | none |
| `marcellus, "pingfang sc", "microsoft yahei", "noto serif cjk sc", serif` | 1 | app 1 | :lang(zh-Hans) .panel-heading | **new token** | display-zh-Hans (Latin face first, CJK fallbacks) - :lang(zh-Hans) override for the interface tables. | none |
| `system-ui` | 1 | 404 1 | body | **to token** | ui - 404 body. | none |

## Font size (chrome)

| Value | Uses | Where | Selectors | Action | Target | Pinned by tests |
|---|---|---|---|---|---|---|
| `12px` | 10 | app 10 | .chip.editable::after; .seq-style; #scale-parse; #scale-refusal +6 more | **on token** | caption 12px - Messages, parse line, status, seq-style, panghost. | none |
| `14px` | 8 | app 2, scale pages 3, scales hub 1, handpan-101 2 | .panel-heading; #saved-status; .muted; .open +1 more | **new token** | body-sm 14px - Saved status, panel heading (Marcellus), page .muted, .open CTA, .step. | none |
| `16px` | 7 | app 6, 404 1 | #share-url; #scale-box-wrap; #scale-box; #scale-name +3 more | **new token** | input 16px (and prose 16px for About / 404) - Form controls: iOS zoom floor; About body. | app.test.js iOS >=16px controls + font-size:16px; test_scale_pages.py About "16px/1.55" regex |
| `9.5px` | 5 | app 5 | .shuffle; .sheetlabel; #scale-or span; #scale-fine-toggle +1 more | **new token** | label-xs 9.5px / 600 / .13em uppercase - Footer text buttons, sheet labels, OR divider, shuffle. Below the board's 11px floor; keep for fit (phone landscape). | e2e.test.js 9.5px footer AA comment (contrast 4.5 floor) |
| `10.5px` | 4 | app 4 | .panel-note; .mode; .prints button, .prints select, #lang-select; #scale-tabs [role=tab] | **new token** | button-label 10.5px / 600 / .08em uppercase - .mode, tabs, panel-note, prints, lang select. | 3 mutants |
| `20px` | 4 | app 1, scale pages 3 | .count.seq; section.plain h2,section.history h2; section.related h2,section.group h2; .rail | **new token** | progression-sm 20px (board progression 32px at >=640px) - .count.seq / .rail chord rail, page section h2. | e2e.test.js rail Marcellus >= 18px; 7 mutants |
| `11.5px` | 4 | app 4 | footer.seq .seq-style @@media (max-height:520px); #scale-generate, #scale-next; .sheethint; .announce | **merge** | caption 12px - Generate/Next, announce, sheethint, seq-style (footer.seq). | 3 mutants |
| `clamp(30px,7vw,44px)` | 4 | app 1, scale pages 1, scales hub 1, handpan-101 1 | #about h2; h1 | **new token** | heading-lg clamp(30px,7vw,44px) display - Page h1, About h2. | test_scale_pages.py About h2 regex |
| `24px` | 3 | app 1, scales hub 1, handpan-101 1 | #about h3; h2 | **new token** | heading-md 24px display - About h3, hub/h101 h2. | test_scale_pages.py About h3 + hub h2 regex |
| `11px` | 2 | app 2 | .chip; .count | **to token** | chip -> chip-label 13px; .count -> caption 12px - .chip and .count. | none (chip row scrolls) |
| `18px` | 2 | app 1, scale pages 1 | button.nav; .nav label::before | **new token** | icon-glyph 18px (until line icons replace the arrows) - button.nav arrow glyph, scale nav ::before. | none |
| `13px` | 2 | app 2 | #scale-title; #about h4 | **to token** | chip-label 13px - About h4, sheet title. | none |
| `clamp(20px,5.5vw,27px)` | 1 | app 1 | h1 | **to token** | wordmark-header 24px (lockup) - App h1; becomes the horizontal lockup, text visually hidden. | none |
| `8.5px` | 1 | app 1 | #scale-sheet.side #scale-fields .sheetlabel | **merge** | label-xs - Side-sheet field label variant. | none |
| `15px` | 1 | app 1 | #scale-conflict | **on token** | body 15px - #scale-conflict. | none |
| `26px` | 1 | scale pages 1 | h2 | **merge** | heading-md 24px - Scale page h2. | none |
| `0` | 1 | scale pages 1 | .prog .nav label | **n/a** | - - Text-hiding trick on scale nav label. | test_scale_pages.py font-size:0 |

## Letter-spacing (chrome)

| Value | Uses | Where | Selectors | Action | Target | Pinned by tests |
|---|---|---|---|---|---|---|
| `.13em` | 6 | app 6 | .shuffle; .sheetlabel; #scale-tabs [role=tab]; #scale-or span +2 more | **new token** | label-xs .13em - Micro uppercase labels (6). | none |
| `.06em` | 3 | scale pages 2, handpan-101 1 | .open; .prog .step | **merge** | button-label .08em - Page .open CTA, .step. | 2 mutants |
| `.09em` | 2 | app 2 | .chip; #scale-title | **to token** | chip -> chip-label .12em; sheet title -> caption .09em | none |
| `.08em` | 2 | app 2 | .mode; .prints button, .prints select, #lang-select | **new token** | button-label .08em - .mode, prints. | none |
| `.12em` | 2 | app 2 | .count; #scale-generate, #scale-next | **on token** | chip-label .12em - Generate/Next, .count. | none |
| `.02em` | 2 | app 1, scale pages 1 | .count.seq; .rail | **new token** | progression .02em (add letterSpacing to the token) - Rail / count.seq. | 2 mutants |
| `.04em` | 1 | app 1 | h1 | **drop** | - - App h1 (becomes lockup). | none |
| `.1em` | 1 | app 1 | #scale-sheet.side #scale-fields .sheetlabel | **merge** | label-xs .13em - Side-sheet label. | none |

## Shadow / ring / filter (chrome)

| Value | Uses | Where | Selectors | Action | Target | Pinned by tests |
|---|---|---|---|---|---|---|
| `box-shadow: 0 0 0 2px #f1ece1` | 2 | app 2 | #scale-swatches .dot.sel::after; #scale-swatches .dot.sel:active::after | **new token** | ring-selected 0 0 0 2px surface-inverse - Selected palette swatch ring (a ring, not a drop shadow). | mutants (e_target_swatch_overlap) |
| `box-shadow: 0 0 0 1px color-mix(in srgb, var(--dgb) 55%, transparent)` | 1 | app 1 | .chip.on | **drop** | - - Active-chip ring; use 1.5px root border only. | none |
| `filter: grayscale(1)` | 1 | app 1 | #scale-preview.stale.example | **n/a** | - - Stale example preview state. | none |
| `box-shadow: 0 var(--sp-1) 0 #1f1b15` | 1 | app 1 | #scale-drawer-status | **to token** | 0 var(--sp-1) 0 surface - Solid cover strip under drawer status, not a shadow. | none |
| `box-shadow: 0 0 0 2px #a79d8b` | 1 | app 1 | #scale-swatches .dot:active::after | **to token** | ring 2px text-secondary - Swatch press ring. | none |

## Border-radius (chrome)

| Value | Uses | Where | Selectors | Action | Target | Pinned by tests |
|---|---|---|---|---|---|---|
| `8px` | 9 | app 7, scale pages 1, handpan-101 1 | .mode; #share-url; .prints button, .prints select, #lang-select; #scale-box +4 more | **on token** | radius-sm 8px - Inputs, .mode, prints, share-url, CTAs. | none |
| `50%` | 4 | app 4 | .chip .dot; #scale-swatches .dot::after; .panghost; #scale-swipe-cue | **new token** | radius-round 50% - Dots (chip dot, swatch, swipe cue, panghost). | none |
| `10px` | 4 | app 3, scale pages 1 | button.nav; .shuffle.reroll; #scale-generate, #scale-next; .prog .nav label | **to token** | radius-md 12px - Arrow buttons (button.nav), Generate/Next, reroll, scale-page nav label. README: arrow buttons are radius-md. | test_scale_pages.py "border-radius:10px"; 3 mutants |
| `2px` | 4 | app 1, scale pages 1, scales hub 1, handpan-101 1 | #scale-lip::after; a:focus-visible | **new token** | radius-xs 2px - Focus outline radius on pages, lip pill bar. | none |
| `999px` | 2 | app 2 | .chip; .chip.on | **on token** | radius-pill - .chip. | none |
| `0` | 2 | app 2 | #settings-panel @@media (min-width:1024px) and (min-height:700px); #scale-tabs [role=tab] | **n/a** | - - Docked settings panel, tabs. | none |
| `12px` | 1 | app 1 | #scale-preview | **on token** | radius-md 12px - #scale-preview. | none |
| `4px` | 1 | scale pages 1 | .prog .step | **merge** | radius-sm 8px - .prog .step badge on scale pages. | none |

## Spacing (margin / padding / gap) (chrome)

| Value | Uses | Where | Selectors | Action | Target | Pinned by tests |
|---|---|---|---|---|---|---|
| `var(--sp-3)` | 39 | app 39 | header {margin-bottom}; #settings-panel {padding}; #settings-panel {gap}; #settings-panel:has(#panel-seq-note:not([hidden]), #deck-restore:not([hidden])) > .panel-col {row-gap} +30 more | **on token** | sp-3 | none |
| `var(--sp-2)` | 30 | app 30 | .hrow {gap}; .hrow {margin-bottom}; .decks {gap}; .modebar {gap} +24 more | **on token** | sp-2 | none |
| `12px` | 15 | app 9, scale pages 3, handpan-101 3 | body {padding}; #settings-panel {padding}; #scale-box-wrap::after {padding}; #scale-box {padding} +8 more | **new token** | pad-button 12px (CTAs, inputs) / body side inset - 15 uses. | none |
| `6px` | 14 | app 11, scale pages 1, handpan-101 2 | .chip {padding}; .chip.editable::after {margin-left}; .chip .dot {margin-right}; .tierbar .mode {padding-inline} +10 more | **new token** | pad-control-y 6px (component padding, not ramp) - Chip/mode/print bottom padding, dot margin, About h3. | none |
| `var(--sp-4)` | 13 | app 13 | #settings-panel {column-gap}; #settings-panel .panel-group {margin-bottom}; #settings-panel:has(#panel-seq-note:not([hidden])):has(#deck-restore:not([hidden])) {column-gap}; #settings-panel:not(:has(#panel-seq-note:not([hidden]), #deck-restore:not([hidden]))) {column-gap} +7 more | **on token** | sp-4 | none |
| `4px` | 13 | app 8, scale pages 3, scales hub 1, handpan-101 1 | #settings-panel:not(:has(#panel-seq-note:not([hidden]), #deck-restore:not([hidden]))) {padding}; #settings-panel:has(#panel-seq-note:not([hidden]), #deck-restore:not([hidden])) {padding}; #settings-panel {padding}; #scale-fine-toggle {padding} +7 more | **to token** | sp-1 - Page h2 margin, rail margin, About li, panel offsets. | none |
| `var(--sp-1)` | 11 | app 11 | #panel-prog-heading {margin-top}; .panel-group {gap}; #settings-panel:not(:has(#panel-seq-note:not([hidden]), #deck-restore:not([hidden]))) .modebar {row-gap}; footer.seq {row-gap} +7 more | **on token** | sp-1 | none |
| `16px` | 11 | app 3, scale pages 3, scales hub 1, handpan-101 3, 404 1 | #settings-panel {padding}; #about {padding}; body {padding}; section.scale {padding-top} +2 more | **new token** | gutter 16px (CLAUDE.md phone gutter) - Page body side padding, About, section padding-top, CTA x-padding. | none |
| `10px` | 9 | app 4, scale pages 4, handpan-101 1 | body {padding}; #share-url {padding}; #scale-plate-band #scale-layout-hint {padding}; #scale-conflict-separate,#saved-temporary-use {padding} +5 more | **to token** | sp-2 (pages) / keep 10px body top inset - App body inset, scale pages .prog gap, share-url. | none |
| `20px` | 9 | app 2, scale pages 2, scales hub 1, handpan-101 4 | #about h3 {margin}; #about ol, #about ul {padding-left}; body {padding}; ol {padding-left} +3 more | **to token** | sp-3 desktop (20px) on pages; list indent stays 20px - Pages body top, ol/ul indent, ctas gap. | none |
| `62px` | 8 | app 8 | #settings-panel {padding}; #settings-panel:not(:has(#panel-seq-note:not([hidden]), #deck-restore:not([hidden]))) {padding}; #settings-panel:has(#panel-seq-note:not([hidden]), #deck-restore:not([hidden])) {padding} | **n/a** | - - Settings panel header clearance (layout). | none |
| `50px` | 8 | app 8 | #settings-panel {padding}; #settings-panel:not(:has(#panel-seq-note:not([hidden]), #deck-restore:not([hidden]))) {padding}; #settings-panel:has(#panel-seq-note:not([hidden]), #deck-restore:not([hidden])) {padding} | **n/a** | - - Settings panel header clearance (layout). | none |
| `9px` | 6 | app 6 | #settings-panel {padding}; #scale-box, #scale-name {padding}; #scale-box-wrap::after {padding}; #scale-fields input {padding} +1 more | **new token** | pad-field 9px - Input padding. | mutants (w1_field_uncapped) |
| `14px` | 5 | app 3, scale pages 1, handpan-101 1 | #scale-delete {padding}; #about h4 {margin}; #scale-conflict-separate,#saved-temporary-use {padding}; .open.ghost {padding} +1 more | **to token** | sp-3 - About h4, conflict buttons, ghost CTA padding. | none |
| `8px` | 5 | app 3, scale pages 1, handpan-101 1 | #about h2 {margin}; #about p {margin}; #saved-status {margin}; dl.who {margin} +1 more | **to token** | sp-2 - About p/h2, saved status, page p margin, dl gap. | none |
| `28px` | 5 | scale pages 2, scales hub 1, handpan-101 2 | main {gap}; .prog {margin-bottom}; .ctas {margin} | **to token** | sp-4 desktop (28px) - Pages main gap, .prog margin. | none |
| `48px` | 4 | app 1, scale pages 1, scales hub 1, handpan-101 1 | #about {padding}; body {padding} | **new token** | page-end 48px - Page / About bottom padding. | none |
| `7px` | 3 | app 3 | .chip {padding}; .mode {padding}; .prints button, .prints select, #lang-select {padding} | **new token** | pad-control-y-top 7px (optical, pairs with 6px) - Chip/mode/prints top padding. | none |
| `520px` | 3 | app 3 | #scale-sheet.tiny .sheetsurf {padding-inline}; #about {padding} | **n/a** | - - About max-width calc (layout). | none |
| `11px` | 2 | app 2 | .mode {padding}; .prints button, .prints select, #lang-select {padding} | **new token** | pad-control-x 11px - .mode / prints horizontal padding. | none |
| `1px` | 2 | app 2 | #scale-sheet.lipped #scale-footslide {padding-top} | **n/a** | - - Hairline offsets. | none |
| `-7px` | 2 | app 2 | #scale-swatches .dot::after {margin} | **n/a** | - - Swatch dot centring. | none |
| `2px` | 2 | scale pages 2 | dl.who {gap}; .prog .step {padding} | **n/a** | - - Tiny badge padding / dl row gap. | none |
| `13px` | 1 | app 1 | .chip {padding} | **merge** | pad-control-x (chip uses 13px; align to 11px or keep) - .chip horizontal padding. | none |
| `-1px` | 1 | app 1 | .sr-only {margin} | **n/a** | - - sr-only. | none |
| `56px` | 1 | app 1 | #settings-panel {padding} | **n/a** | - - Settings panel header clearance (layout). | none |
| `0px` | 1 | app 1 | #scale-sheet.lipped #scale-delete-row {margin-top} | **n/a** | - | none |
| `-16px` | 1 | app 1 | #scale-lip::after {margin-left} | **n/a** | - - Lip pill centring. | none |
| `24px` | 1 | handpan-101 1 | .ctas {gap} | **merge** | sp-4 desktop (28px) - h101 .ctas column gap. | none |
| `22px` | 1 | handpan-101 1 | .ctas .open {padding} | **to token** | sp-4 | none |

## Card-internal (locked: product, not mapped)

Palettes (`--root/--tone/--ga/--gb`, per scale), card paper `#FFFFFF`/`#FFF` and ink `#242424`, chord name `#545454` (Marcellus), hint `#6F6658`, header number `#757575`, separators `#75707C`, bottom orange `#E27005` (badge, U-labels, pan-editor marks), Bitter note/number lines, pan-diagram SVG greys (`#8A8A8A #333 #000 #9E9E9E #E2E2E2`), card shadow `0 12px 34px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.4)`, card radius 12px, card type 8/9/9.5/19/18/44px and .06-.14em tracking. Also the layout-editor marks drawn on the pan preview (`#272219` pansel ink, `#F1ECE1` veil, orange marks) stay: they are diagram, pinned by app.test.js.

| Kind | Value | Uses | Where | Selectors |
|---|---|---|---|---|
| Colour | `#242424 #8a8a8a #333 #000 #fff #9e9e9e #e2e2e2` | 12 | app diagram JS 12 | pan diagram labels, rings, fields (panLabel/drawPan) [app diagram JS] |
| Colour | `#e27005` | 7 | app 1, scale-page card 1, app diagram JS 5 | .badge {color}; bottom U-labels; pansel/panarm/panseat/panflash strokes [app diagram JS] |
| Colour | `#242424` | 2 | app 1, scale-page card 1 | :root {--ink}; .front,.card {color} |
| Colour | `#0b7b75` | 2 | app 2 | :root {--root}; :root {--ga} |
| Colour | `#dd8f00` | 2 | app 2 | :root {--tone}; :root {--gb} |
| Colour | `rgba(0,0,0,.5)` | 2 | app 1, scale-page card 1 | .face {box-shadow} |
| Colour | `rgba(0,0,0,.4)` | 2 | app 1, scale-page card 1 | .face {box-shadow} |
| Colour | `#000` | 2 | app 2 | .face::before {-webkit-mask} |
| Colour | `#757575` | 2 | app 1, scale-page card 1 | .hdr .l .num {color} |
| Colour | `#75707c` | 2 | app 1, scale-page card 1 | .sepc {color} |
| Colour | `#272219` | 2 | app diagram JS 2 | pansel-ink / panfocus SVG stroke (layout editor on the pan diagram) [app diagram JS] |
| Colour | `rgba(226,112,5,.22)` | 2 | app diagram JS 2 | pansel/panarm fill [app diagram JS] |
| Colour | `#ffffff` | 1 | app 1 | :root {--paper} |
| Colour | `#545454` | 1 | app 1 | .bigname {color} |
| Colour | `#6f6658` | 1 | app 1 | .hint {color} |
| Colour | `rgba(234,230,223,.22)` | 1 | app 1 | .card:active {box-shadow} |
| Colour | `#fff` | 1 | scale-page card 1 | .front,.card {background} |
| Colour | `#f1ece1` | 1 | app diagram JS 1 | panveil SVG fill [app diagram JS] |
| Font family | `Nunito Sans` | 9 | app 4, scale-page card 5 | .hdr .l; .hdr .r; .hint +3 more |
| Font family | `Bitter` | 4 | app 2, scale-page card 2 | .notesline; .numline |
| Font family | `Marcellus` | 2 | app 1, scale-page card 1 | .bigname; .front .fname |
| Font size | `9px` | 5 | app 2, scale-page card 3 | .hdr .l; .badge; .front .fdeg |
| Font size | `8px` | 2 | app 1, scale-page card 1 | .hdr .r |
| Font size | `.62em` | 2 | app 1, scale-page card 1 | .notesline sub |
| Font size | `.5em` | 1 | app 1 | .bigname sup |
| Font size | `9.5px` | 1 | app 1 | .hint |
| Font size | `clamp(12px,4.4vw,19px)` | 1 | app 1 | .notesline |
| Font size | `clamp(12px,4.2vw,18px)` | 1 | app 1 | .numline |
| Font size | `44px` | 1 | scale-page card 1 | .front .fname |
| Font size | `19px` | 1 | scale-page card 1 | .notesline |
| Font size | `18px` | 1 | scale-page card 1 | .numline |
| Letter-spacing | `.12em` | 3 | app 1, scale-page card 2 | .hdr .l; .front .fdeg |
| Letter-spacing | `.14em` | 3 | app 2, scale-page card 1 | .hint; .badge |
| Letter-spacing | `.06em` | 2 | app 1, scale-page card 1 | .hdr .l .deg |
| Letter-spacing | `.11em` | 2 | app 1, scale-page card 1 | .hdr .r |
| Shadow / ring / filter | `box-shadow: 0 12px 34px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.4)` | 2 | app 1, scale-page card 1 | .face |
| Shadow / ring / filter | `box-shadow: 0 0 0 3px rgba(234,230,223,.22)` | 1 | app 1 | .card:active |
| Border-radius | `12px` | 6 | app 3, scale-page card 3 | .card; .face; .face::before +1 more |

Note: `.card:active` ring `rgba(234,230,223,.22)` is the old text colour at 22%; it sits on the card so it is locked, but if conflict 2 adopts `#F6F4ED` the owner may want the ring to follow (it is the only card value derived from a chrome colour).

## Tests that pin values this mapping would change

Test code (assertions, must be edited in the same change):

- `tests/app.test.js`: "the head carries theme-color ... matching --table" (`#1a1815` literal + theme-color == `--table`); `.shuffle.reroll{border:1px solid #433b2c}` and `.shuffle.reroll:active{background:#2e281e}`; `#share-copy:disabled:active` `background:#211d16`; iOS controls >= 16px (unchanged by this map). Pan-editor `#272219` / `#E27005` stroke asserts are diagram, unchanged.
- `tests/e2e.test.js`: global focus ring `rgb(227, 178, 92)` (DR1 drawer controls, every-viewport ring), warn `rgb(227,178,92)`, armed delete press `rgb(234, 230, 223)` / not gold, N-A9 notice `rgb(196, 188, 171)`, delete link `rgb(167, 157, 139)`, cream `rgb(241, 236, 225)`, html bg `rgb(26, 24, 21)`, frame-pixel TABLE `[26,24,21]` / TABLE2 `[38,34,28]`, rail Marcellus >= 18px, DI passive text >= 7:1 vs sheet (computed; `#A9A39A` on `#1A1814` = 7.08, passes).
- `tests/test_scale_pages.py`: `BG_LIGHT #fbfaf8`, `BG_DARK #15181b`, `BROWN #1a1815`, `SHARED_ROOT` (`--bg:#1a1815;--fg:#eae6df;--muted:#c4bcab;--r:#e3b25c`), hub h2 24px regex, About overlay regexes (bg `#1a1815`, `.abouthead`, `#eae6df 16px/1.55`, h2 clamp, h3 24px `#e3b25c`, h4 `#c4bcab`, `#about a`), contrast on BROWN, scale nav (`border-radius:10px`, `background:#211d16`, `border:1px solid #433b2c`), accent ratios vs BG_LIGHT / BG_DARK / `#ffffff` (re-run `accents()` and the `accent_*` columns of `tools/scale_pages.json` if the page grounds move).
- `tests/test_handpan_101_page.py`: SHARED_ROOT, theme-color `#1a1815`, `.open` / `a.open` `color:#1a1815`, `--r:#e3b25c`, contrast loop vs `#1a1815`; `assertNotIn("#433b2c" / "#fbfaf8")` keep holding.

Mutant patches (`tests/mutants/*.patch`, context lines; they stop applying when the value changes and need regenerating): `#a79d8b` 15, `#f1ece1` 14 (kept), `#c4bcab` 12, `#eae6df` 11, `#1f1b15` 11, `#433b2c` 10, `#1a1815` 9, `#272219` 8, `#2e281e` 7, `20px` 7, `#e3b25c` 6, `#211d16` 5, `10.5px` 3, `11.5px` 3, `radius:10px` 3, `#332c22` 3, `#2a251c` 3, one each for `#151310 #b3aa98 #4a4233 #2c2619 #26221c`.

Frozen fixtures (`tests/fixtures/shipped_client_*.html.txt`, `scale_pages_pre_swipe/*.html`) contain most of these values as historical snapshots; they are references, not pins, and should not be edited.

Not pinned anywhere in test code: `#d5cec2`, `#f4f0e8` (app h1), `#6f675a`, `#a4c9a0`, `#3a342b`, 404 `#222`/`#2563b0`, chip `11px/.09em`, app h1 `clamp(20px,5.5vw,27px)`, scale h2 `26px`, the chip.on `color-mix` ring, the radial gradient expression.
