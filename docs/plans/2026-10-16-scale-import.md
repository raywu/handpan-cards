# Scale import investigation (2026-10-16)

Investigation and plan only. No production code changed. Experiments ran as
scratch node scripts against `src/engine/core.js` and `tools/gen_deck.js`
(main at 9e219f5) and against product pages that were downloaded or fetched. No
paid or keyed call was made to Jev/TypeSafe or any LLM API: those comparisons
come from primary documentation only.

**Architecture first.** The app is one static file, `index.html`, served
unchanged by GitHub Pages. It has no backend and no proxy. Its only external
script is GA4, which `loadAnalytics()` (index.html:11318) appends at runtime.
The app makes no `fetch()` calls today.

That shapes every option here:
- A browser cannot fetch an arbitrary product URL, because of CORS.
- Any key placed in `index.html` is public.
- A proxy or worker would be persistent infrastructure, which the owner prompt
  gates on authorization.

So the baseline is **paste the product text**. URL fetch, a proxy and any
model call are written below as validation gates, not as decisions.

Labels used below: **[V]** verified by running it or reading it here. **[O]**
observed on a live page; it can change. **[E]** estimate. **[A]** assumption.

---

## 1. Recommendation

**Preferred: a deterministic, label-driven text importer that runs in the
browser.** It sits inside the existing Add a Scale sheet. Its only output is
text in `#scale-box`, so everything downstream stays as it is: the parse line,
the refusal, the layout drawer, GENERATE and SAVE.

How it works:
1. The user pastes product text or types a description.
2. The importer takes note roles **only** from labels the source writes:
   "Ding", "Top", "Bottom", "Inner", "Notes Top Side" and so on.
3. Every cue the source does not declare is shown for the user to confirm, or
   blocks the import:
   - a first note taken as the ding, or a separator after it,
   - brackets,
   - missing octaves (confirmed, with the inferred octaves shown; G6, owner
     2026-10-17),
   - a count that disagrees with the title.
4. It writes the result in `formatSeed` order. `HPE.core.parseSeed` stays the
   only target validator.

**Why this approach:**
- **The main risk is wrong semantics, not syntax.** Wrong-but-valid strings
  pass `parseSeed` today. Examples: a dropped note, a mistyped C4, and
  manufacturer brackets that mean "bottom" read as our ding (section 3.1).
  - An LLM makes this worse: it can invent a plausible note.
  - Jev cannot extract free text at all (section 3.3).
  - Rules that refuse to guess are the only option where every result
    traces back to a span of the source.
- **Real text is regular enough.** 25 distinct spec lines came from one
  retailer, plus Sela and Sanango pages, all run through a scratch prototype.
  Every correct line was either extracted exactly or flagged. Nothing passed
  silently with wrong content (section 3.2).
- **It fits the hard constraints.** It is a pure engine module with no network
  and no dependency, inlined by `tools/inline_engine.py`.

**Alternatives:**
- Kept as gated enhancements:
  - Direct fetch of Shopify `.json` (gate G1).
  - A proxy for other sites (G2).
  - Jev as a tie-breaker between roles (G3).
- Rejected: an LLM for extraction, a parser per manufacturer as the primary
  design, and image or OCR input (out of scope).
- **Presets:** a scale *name* such as "D Kurd 10" is reported as insufficient.
  When it matches a built-in deck, the importer may *offer* that deck without
  filling in any notes (G4).

**Confidence:**
- High that this is the simplest defensible design.
- Medium on coverage of pastes from sites outside this survey. Three
  retailers/makers were sampled, and real users' pastes are unmeasured.

**Main uncertainty:** no maker in the sample *declares* its notation. Every
ding cue found was structural. So for most real imports, the "verify
equivalence" requirement comes down to one tap: the user confirms the ding.
The design accepts this rather than hiding it.

---

## 2. Codebase findings

### 2.1 Grammar, parsing, serialisation [V]

| Concern | Where | Notes |
|---|---|---|
| Refusal and warning codes | `src/engine/core.js:16-73` (`REASONS`) | Refusals: NO_DING (which/two/below), NO_FIFTH, BAD_NOTE (slash/bracket/bar/barEmpty/barFirst), NOTE_OUT_OF_RANGE, NOTE_OUT_OF_ORDER (ding/afterBar/below), NOTE_REPEATED, NEEDS_NEWER_APP. Warnings: NO_THIRDS, SMALL_LABELS |
| Note token | `core.js:81-84` (`NOTE_RE`, `SCALE_NOTE_RE`) | `/^([A-G])(#\|b)?(-1\|[0-9])?$/`: uppercase letters, ASCII `#`/`b` only. ♯, ♭, lowercase and `H` are all BAD_NOTE |
| Lexing | `lexScale` 534, `scaleTokens` 548 | `(X)`, `X/` and `X\|` mark the ding (`X)` alone is BAD_NOTE). `[X]` marks a bottom note. A lone `/` is refused |
| Structure | `scaleStructure` 580 | one ding; `\|` starts the inner notes |
| Octave inference | `scaleInfer` 666 | ding defaults to octave 3; top notes ascend from the previous note; bottom notes before the ding go downward |
| Entry point | `parseSeed` 733 | returns `{ok, value:{fields}}` or `{ok:false, code, reason}` |
| Canonical print | `formatSeed` 783 | one line by pitch; round-trips the prompt's Yatao string unchanged |
| Identity | `identitySeed` 864, `deckId` 933 | id hashes the identity seed |
| Legacy strings | `parseLegacySeed` 504 | chosen by version tag only |

Fields are records `[name, octave, midi, zone, angle, label]`. Ids are 0 for
the ding, 1..n for top and inner notes, and 101+ for bottom notes. Highlighting
is derived from `midi % 12`.

### 2.2 The Add a Scale sheet (index.html) [V]

- Markup:
  - `#scale-sheet` 1276
  - `#scale-name-row` 1293 (shown on Edit only)
  - `#scale-box` textarea 1308
  - `#scale-parse` 1313
  - `#scale-refusal` 1327
  - layout drawer 1338-1384
  - `#scale-guidance` / `#scale-msg` 1425
  - `#scale-generate` 1429
- `PARSE_HINT` 8952 teaches the grammar.
- Input listener 10701: strips newlines, then calls `syncGrow` and
  `updateParse` (9829). Those call `parseSeed`, `parseLineText` (9275),
  `showParse` (9059) and `showRefusal` (9063).
  - **The importer should stop exactly where this path starts:** set
    `scaleBox.value`, then dispatch `input`.
- Enter key calls `runGenerate` (10156), then `generateDeck` (7929).
- `sheetOptions()` 9590 honours the name only when `editingId` is set. A new
  deck is auto-named, e.g. "D LYDIAN 11", so a product name cannot carry over
  without a product decision (G5).
- Edit fills the box with `HPE.core.formatSeed(edit.fields)` (10026). The
  importer's output takes the same round trip.
- Persistence: `hpfc.scales.v3` (`SCALES_KEY`, 7809). Share codes:
  `shareCode` 8014, `openShare` 8031. An imported deck shares like any custom
  deck after SAVE, with no extra work.
- Layout drawer: `layoutOptions` 9582, `paintLayout` 9157. An imported deck
  gets the solver's default layout and the user adjusts it there, which
  matches the "no layout inference" scope.

### 2.3 Presets [V]

- In 2026-09 the owner removed a preset row from the sheet: the comment at
  index.html:1300 reads "I don't know if we need the preset options"; see
  also `docs/SCALE_ENGINE_PLAN.md:589-594`.
- `tools/gen_deck.js` keeps six `PRESETS` for the CLI only.
- The coordination doc (row 149) notes that preset labels never match engine
  deck names.
- The built-in decks are the real preset library: Kurd 10, Amara 10, Amara 9,
  Hijaz 9 and Low Pygmy 18. They are reachable by `#deck=<slug>`
  (`DECK_SLUGS`).

### 2.4 Constraints that bind the importer [V]

- One file, no bundler. A new engine module needs:
  - a `src/engine/<name>.js` file,
  - a `MODULES` entry in `tools/inline_engine.py`, placed after `core`
    because it calls `HPE.core`,
  - a regenerated region in `index.html`.
  `tools/validate.py` check 4 catches drift.
- No `<script src>` may appear in the committed bytes. Any network call would
  be the app's first `fetch()`.
- `tests/app.test.js` asserts there is no external script, and pins the engine region order, so a new module must be added to that list.
- Tests and CI:
  - `node --test tests/<file>.test.js`; `tests/run.sh`.
  - CI runs `validate.py`, `boot_sim.js`, `refresh_mutants.py --check`,
    `suite_health.py` (one FLOORS row per test file) and the mutation gate
    under `tests/mutants/`.
  - `tools/sandbox.js` `ELEMENT_IDS` must list any new element the app
    touches.
- `tools/engine_loader.js` `loadEngine(names)` loads the module under
  `node:vm` for unit tests.

---

## 3. Technology assessment

### 3.1 What the target validator does with raw manufacturer text [V]

These raw strings went straight into `parseSeed`, through scratch `probe.js`.

**Refused** (safe, but useless as import):

| Input | Result |
|---|---|
| Yatao top line verbatim `D3, F#3, A3, …` | BAD_NOTE (commas) |
| Same with commas stripped | NO_DING which (the ding is unmarked) |
| Sela verbatim `D3/ (C3) (F3) (G3) A3, Bb3 - …` | BAD_NOTE (`A3,`) |
| Sela with separators stripped | NO_DING "Two dings" (its parens mean *bottom*; we read them as dings) |
| Sela SEHP400 `D3 / A3 - Bb3 …` | BAD_NOTE slash |
| Sanango `E3) B3 D4 …` | BAD_NOTE (`E3)` is not a note) |
| `F♯3`, `B♭3`, `d3`, `H4` | BAD_NOTE |
| `D Kurd 10` | BAD_NOTE ("Kurd is not a note") |

**Accepted with wrong meaning** (the dangerous ones):

| Input | Result |
|---|---|
| `(C3) D3 A3 Bb3 C4 D4 E4 F4 G4 A4` (maker parens = bottom) | OK, 10 fields, **C3 ding** |
| Yatao string with E5 dropped | OK, 17 fields |
| Yatao string with C#4 typed as C4 | OK, 18 fields |
| Sanango C Harmonic Minor, B3 in both lists, serialised | OK, 16 fields, `[B3] B3` both kept |

So **target correctness does not imply semantic or source correctness**. Raw
source text must never reach `parseSeed` directly. Only the importer's own
serialised output may, after the source's roles have been resolved.

A bug in the scratch prototype showed the same thing again. A first
keyword regex took A3 as the ding in "Ding: D3 Top: …". That string still
parsed (9 fields), only wrong. The fix was clause and label segmentation.

### 3.2 Deterministic parsing: a prototype against real text [V]/[O]

Scratch prototype `interp.js`, about 120 lines:
- It normalises ♯/♭, en and em dashes, NBSP, and "C #3", which becomes "C#3"
  with a flag.
- It segments by labels.
- It tokenises notes and marks, takes roles only from labels or role words,
  and raises flags.

**Yatao D Aegean 18** [O], from the product's `/products/<handle>.json`
`body_html`:
- The text reads "Notes Top Side: D3, F#3, A3, C#4, D4, F#4, G#4, A4, C#5, D5,
  F#5" and "Notes Bottom Side: B2, E3, G#3, B3, E4, B4, E5". That is
  11 + 7 = 18, matching the title.
- The prototype output equals the prompt's string exactly:
  `[B2] (D3) [E3] F#3 [G#3] A3 [B3] C#4 D4 [E4] F#4 G#4 A4 [B4] C#5 D5 [E5] F#5`.
- `gen_deck.js` gives "D LYDIAN 11", 18 fields, 62 chords.
- The same result comes from a simulated paste of the whole rendered page.
- **The page does not label the ding.** It is only the first top note, so the
  importer asks the user to confirm it.
- The page also says "Key: F# lydian mode", which contradicts its own D-lydian
  note list. The importer ignores key/mode prose.
- JSON-LD on the page carries no note list.

**Yatao store survey** [O]: 89 products, 59 handpan-like, **25 distinct spec
lines**.

| Prototype outcome | Lines | Why |
|---|---|---|
| REVIEW, count matches title (incl. ding) | 17 | labelled top/bottom lists; ding = first note (CONFIRM) |
| REVIEW, `SPACE_IN_NOTE` | 1 | MAG "C #3" joined, flagged |
| NEEDS_INPUT, `NO_OCTAVE` | 3 | C Ashakiran 15/17, D Ashakiran 15 list pitch classes only. Prototype result; under G6 (2026-10-17) these become REVIEW with a NO_OCTAVE CONFIRM (section 4.4) |
| NEEDS_INPUT, `UNDECLARED_PARENS` | 1 | Ayasa D Kurd 12 sold by Yatao: `D3 - (F3, G3), A3 …`; the count implies bottom notes, but the page never says so |
| INSUFFICIENT | 3 | bags and accessories |

Within that one retailer there are at least four templates:
- "Notes Top Side:" with the ding unmarked;
- "Notes: D3 - A3, …" with a hyphen or en dash after the ding;
- MAG "F#2 / F#3, …" with a slash after the ding and a missing comma
  ("B4 C#5");
- the Ayasa parentheses.

Two more findings:
- Title counts included the ding on every listing that had octaves.
- Two listings of the same D Kurd 13 disagree on whether D5 is a top or a
  bottom note.

**Other makers** [O]:
- **Sela** SEHP401, via kirstein.de:
  - It writes "Tones: D3/ (C3) (F3) (G3) A3, Bb3 - C4 - …", with
    "Number of tones 12".
  - **The parentheses mean bottom notes**; the prose names C3, F3 and G3 as
    bottom notes, but no legend says so. The ding is marked with a slash.
  - kirstein.de returns 403 to curl.
- **Sanango** (carrd):
  - It writes "Top: E3) B3 …" / "Bottom: …", where `)` follows the ding.
  - Its "D Aegean 17 Notas" lists 18 notes, while "E Amara 16" counts the
    ding. Count meaning varies even within one maker.
  - "D Ashakiran Medusa 12" reads `D3 F#3) G A B …`: the ding mark sits after
    the *second* note and the octaves are missing. Result: CONFLICTING_DING
    plus NO_OCTAVE, so NEEDS_INPUT.
  - "C Harmonic Minor" lists E4 before Eb4 and puts B3 in both the top and
    bottom lists. Result: SOURCE_NOT_ASCENDING CONFIRM. `parseSeed` then
    **accepts** `… [B3] B3 …` (16 fields): the same pitch on both shells is
    legal in our grammar, so only the importer can flag it.
- **Ayasa**'s own Shopify page for F# Low Pygmy 21 carries the name, count and
  prose but **no pitch list** in its text. Result: INSUFFICIENT.

**Same punctuation, different meaning** [O]:
- The Sela parentheses mean bottom. The Ayasa-at-Yatao parentheses
  apparently mean bottom too. Ours mean the ding.
- Sanango's `)` after a note marks the ding; our grammar refuses that form.
- Slash: Sela/MAG put it after the ding; ours puts it after the ding (legacy)
  or refuses a lone one.

So no punctuation may carry a role unless a source profile records that
meaning *with a cited source*. Without one, parentheses BLOCK.

**Coverage, maintenance** [E]:
- Labels plus flags handled every pitch-bearing line in the sample.
- The rule set is small: about 8 label patterns, 1 tokeniser and 10 flag
  codes.
- New templates break it by failing closed (INSUFFICIENT or NEEDS_INPUT), not
  by producing wrong notes. That is the property that matters.

### 3.3 Jev by TypeSafe (documentation only) [V from docs, no live call]

Source: <https://docs.typesafe.ai/introduction> and linked pages.
- **Output primitives:**
  - Choice (up to 255 options)
  - Score
  - Noul (0-1)
  - Box (image bounding boxes)

  There is **no text generation and no free-text extraction**. The extraction
  cookbook uses a regex to find candidates and has Jev *pick* among them;
  the docs say it "cannot invent a value".
- **API:**
  - `POST https://api.typesafe.ai/v1/systemone` with a Bearer API key.
  - SDKs: `typesafe-sdk` (Python) and `@typesafe-ai/sdk` (Node 20+).
  - Models: jev-1.13.0 (`jev-latest`) and jev-1.14.0 (`jev-preview`).
  - Context: 64k per request, 32k per question; 262k with a long-context
    header.
- **Cost and limits:**
  - $0.042 per million input tokens; output is free.
  - Rate limits apply per organization (429).
  - The docs say customer data is not used for training.
- **Browser use:** no CORS or browser guidance was found. A key in
  `index.html` would be public, so any use needs a proxy (G2).
- **Fit:** after deterministic segmentation, the open questions are which
  candidate note is the ding, and whether a bracketed group is bottom notes.
  - Jev *could* score those choices. But the requirement is to follow the
    maker's *declared* grammar, and where nothing is declared a confident
    guess is the wrong output. A score does not replace user confirmation.
  - Cost is negligible: [E] a page is about 2-5k tokens, under $0.0003.
  - The real costs are the proxy, key custody and a network dependency.
  - Benefit: marginal. Rejected for the MVP; kept as G3.

### 3.4 Conventional LLM [A from general knowledge, no live call]

- Structured-output modes can return JSON shaped like
  `{ding, top[], bottom[], inner[]}`.
- Failure mode: a plausible completed scale. For example, it could fill
  Ayasa's missing Pygmy list from the scale name, or "fix" the 17-of-18 case
  by adding E5. Section 3.1 shows that such output passes `parseSeed`.
- Every pitch would still need a span check against the source, and that
  check *is* the deterministic extractor. So the LLM adds risk without adding
  information.
- It also needs a key, a proxy and per-call cost, and adds latency and
  nondeterminism to tests.
- Rejected.

### 3.5 Hybrid and non-AI alternatives

- **A parser per manufacturer as the primary design: rejected.** Templates
  vary within one retailer (four at Yatao), and one product is listed with
  conflicting roles. Keying on the maker does not decide the grammar; labels
  do. Optional *profiles* are kept only to record a verified, cited
  convention.
  - The shape is `{host, convention, citation}`, e.g. "parentheses = bottom".
  - None qualifies today: no surveyed maker publishes a legend.
- **Guided entry: already exists.** The sheet, `PARSE_HINT` and the refusal
  messages.
  - A cheap win is better refusal hints for the raw-paste mistakes above:
    commas, ♯/♭, lowercase, and a name with no notes.
  - It can ship alone (lane A2).
- **Presets:** the built-in decks already are curated presets.
  - Matching a pasted name to a built-in name ("D Kurd 10") may *offer* the
    built-in deck.
  - It must not fill in notes: a maker's "D Kurd 10" can differ from ours.
    The two listings of Yatao's own D Kurd 13 already disagree.
  - Owner gate G4.

### 3.6 Acquisition: the URL path [O]/[V]

- The Shopify endpoints `/products/<handle>.json`, `/products/<handle>.js`
  and `/products.json?limit=250` return `access-control-allow-origin: *` on
  yataoshop.com and ayasainstruments.com. A browser *could* fetch them
  directly, with no proxy.
- What stops it is policy, not technique:
  - It would be the app's first network request besides GA.
  - It sends the visitor's IP to a third party.
  - It works only on Shopify hosts.
  - The response is untrusted HTML; read it as text, never `innerHTML`.

  Gate G1.
- Non-Shopify pages are blocked by CORS (carrd/Sanango), and some refuse bots
  (kirstein.de, 403). Those would need a proxy (G2), which may be blocked too.
- Image-only specs (most Yatao handpans without a list) yield INSUFFICIENT
  either way.

**Latency and security** apply only if G1 or G2 opens:
- timeouts;
- size caps;
- an allow-list of hosts;
- never render fetched HTML;
- SSRF and abuse controls on a proxy.

The paste baseline has none of these concerns.

---

## 4. Correctness and UX

### 4.1 Three separate checks

| Check | Mechanism |
|---|---|
| Source fidelity | Every extracted note keeps its source span (offset, original text). The review list shows the source fragment beside each role. The note count is checked against the title count, both including and excluding the ding; a mismatch either way is BLOCK |
| Semantic correctness | Roles come only from explicit labels or role words. Undeclared cues are CONFIRM (first note as ding; separator after the first note) or BLOCK (brackets, conflicting ding marks). Missing octaves are CONFIRM `NO_OCTAVE` with the inferred octaves shown (G6) |
| Target correctness | Serialise in `formatSeed` order, then run `parseSeed`. Its refusals show through the existing `#scale-refusal`, unchanged |

### 4.2 Flag codes (from the prototype; names are suggestions)

| Level | Code | Trigger |
|---|---|---|
| BLOCK | NO_NOTE_LIST | no labelled list, or only a name ("D Kurd 10", Ayasa Pygmy 21, image-only pages) |
| BLOCK | UNDECLARED_PARENS | brackets the source never defines |
| BLOCK | CONFLICTING_DING | a ding mark not on the first note, or two ding cues |
| BLOCK | COUNT_MISMATCH | the title count is neither the listed total nor the total minus 1 |
| CONFIRM | DING_CUE | ding taken from a structural cue, not the word "ding" |
| CONFIRM | COUNT_EXCL_DING | the title count equals the total minus 1 |
| CONFIRM | SPACE_IN_NOTE | "C #3" joined into "C#3" |
| CONFIRM | SOURCE_NOT_ASCENDING | the source order is not by pitch (it may be a typo) |
| CONFIRM | DUPLICATE_PITCH | one pitch listed twice (new; not in the prototype) |
| CONFIRM | NO_OCTAVE | a note without an octave. Its octave is `parseSeed`'s inference (`scaleInfer`), never the importer's own; the review list marks each inferred octave and the flag names them (G6, owner 2026-10-17) |
| INFO | COUNT_OK | the title count equals the listed total including the ding |

Status follows the flags: INSUFFICIENT when NO_NOTE_LIST is raised;
otherwise NEEDS_INPUT while any BLOCK stands; otherwise REVIEW.

Enharmonics:
- ♯/♭ normalise to `#`/`b`. Spelling is kept as written: E# stays E#, and our
  parser accepts it.
- `H` is BLOCK, because German H means B and Hb means Bb; ask the user rather
  than map it.
- Lowercase letters are BLOCK. A lowercase "b" is ambiguous between a note
  and a flat sign.
- A pitch listed twice is CONFIRM `DUPLICATE_PITCH`, raised by the importer:
  `parseSeed` refuses a repeat on one shell (NOTE_REPEATED) but accepts the
  same pitch on top and bottom. The review list names both source spans.

### 4.3 Smallest useful UX

1. One new control in the sheet, `IMPORT TEXT`, near `#scale-box`. It opens a
   paste area: a textarea plus IMPORT. Manual entry stays the default and is
   unchanged.
2. IMPORT runs `HPE.importer.interpret(text)`. Then:
   - **INSUFFICIENT**: one line, e.g. "No note list found. Image-only specs
     can't be read; type the notes below." Nothing is written to
     `#scale-box`. No built-in deck is offered for a name-only paste (G4,
     owner 2026-10-17: no).
   - **NEEDS_INPUT / REVIEW**: a compact review list with one row per note:
     role, note and source fragment. Each flag is a line. A CONFIRM blocks
     USE until it is ticked, or the user picks another ding from the notes.
     A BLOCK leaves USE disabled and keeps the paste visible.
3. USE writes the serialised string to `#scale-box` and dispatches `input`.
   From there the existing parse line, refusal, preview, layout drawer,
   GENERATE and SAVE take over. The user corrects in the box, as today.
4. No chat, no settings, no network.

The user's own description takes the same path. "D3 ding, A3 Bb3 C4 D4 E4 F4
G4 A4 top, C3 bottom" gives `[C3] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4`, with the
ding labelled, so INFO only [V].

### 4.4 Representative cases (prototype results) [V]

| Case | Result | Meets expectation |
|---|---|---|
| Yatao D Aegean 18 (`.json` text or a whole-page paste) | 18 notes exact, the prompt's string; DING_CUE CONFIRM; COUNT_OK | yes. The ding role is undeclared, so it is confirmed rather than asserted |
| "D3 ding, A3 Bb3 C4 D4 E4 F4 G4 A4 top, C3 bottom" | `[C3] (D3) A3 Bb3 C4 D4 E4 F4 G4 A4`, 10 fields | yes |
| Labelled form "Ding: D3 Top: … Bottom: C3" | same | yes |
| "D Kurd 10" | INSUFFICIENT, NO_NOTE_LIST | yes; no preset offer (G4: no) |
| Same punctuation, two meanings (Sela `(C3)` = bottom vs our `(D3)` = ding; Ayasa-at-Yatao parens) | UNDECLARED_PARENS BLOCK; nothing is serialised | yes. Neither meaning is assumed |
| Undocumented notation (Sanango `D3 F#3) G A …`) | CONFLICTING_DING BLOCK, plus NO_OCTAVE CONFIRM; nothing is serialised while the BLOCK stands | yes |
| Octaveless list (C Ashakiran 15/17, D Ashakiran 15) | NO_OCTAVE CONFIRM listing each inferred octave, plus DING_CUE CONFIRM where the ding is unlabelled; REVIEW | yes. Inference is `parseSeed`'s, shown and confirmed, never silent |
| Name and count, no pitch list (Ayasa F# Low Pygmy 21) | INSUFFICIENT | yes |
| Image-only spec | INSUFFICIENT; manual entry message | yes. No OCR |
| 18-note title, 17 listed (Yatao without E5) | COUNT_MISMATCH BLOCK ("title says 18, text lists 17") | yes; no note is invented |
| Sanango D Aegean "17 Notas" listing 18 | COUNT_EXCL_DING CONFIRM | yes. Count semantics vary by maker |
| Sanango C Harmonic Minor (B3 in both lists) | prototype: SOURCE_NOT_ASCENDING CONFIRM, serialises and parses (16 fields); planned DUPLICATE_PITCH adds a second CONFIRM | yes, once DUPLICATE_PITCH exists |

---

## 5. Implementation plan

Lanes are split by file ownership, for `/swarm`. Use TDD in each lane: tests
first, against fixtures captured from real text.

**Standing merge gates for every lane:**
- CI green at the verified head SHA (`validate.yml`, mutation gate included);
- an independent reviewer PASS at that SHA;
- `python3 tools/inline_engine.py --check`, `python3 tools/sync_decks.py
  --check` and `python3 tools/validate.py` all clean.

### Lane A1: engine importer (smallest useful release, part 1)

- **Owns:**
  - `src/engine/importer.js` (new, namespace `HPE.importer`)
  - `tools/inline_engine.py` (`MODULES` entry after `core`)
  - the generated `<!-- engine:importer -->` region of `index.html`, written
    by the tool only
  - `tests/import.test.js` (new)
  - `tests/fixtures/import_cases_v1.json` (new)
  - the FLOORS row in `tests/suite_health.py` for the new test file
  - new mutants under `tests/mutants/`
  - `README.md`'s engine-module sentence (README.md:26-34: add `src/engine/importer.js` and change 'eleven' to 'twelve') and its suite count (README.md:180: '23 node suites' becomes 24), which `tests/test_readme_currency.py` pins by glob. importer.js cites symbol anchors, never `file:line`.
  - the two engine-module lists in `tests/app.test.js` "index.html carries the whole engine inline, with no external script" (the `HPE[mod]` loop and the region-order `deepStrictEqual`), which gain `importer` after `core`; Lane B owns the rest of that file and starts after A1 merges.
- **Objective:** `interpret(text) -> {status, roles:{ding, top[], bottom[],
  inner[]}, spans, flags[], total, titleCount}` and `serialise(result) ->
  string`. Both are pure, with no DOM and no network.
- **Fixtures:**
  - the Yatao D Aegean 18 `body_html` text;
  - the 25 Yatao spec lines;
  - the Sela SEHP401/400 strings;
  - the Sanango Aegean, Amara, Medusa and Harmonic Minor strings;
  - the Ayasa Pygmy 21 prose;
  - the two prompt descriptions;
  - "D Kurd 10";
  - Yatao without E5.

  Store them as captured text with the source URL and the capture date,
  never fetched at test time. Fixtures store only the spec lines needed for
  each case, with source URL and capture date, not whole page bodies.
- **Acceptance:**
  - Every row of section 4.4 holds as an exact assertion: the status, the
    flag codes, the serialised string where one exists, and the
    field count = `Object.keys(parseSeed(serialise(r)).value.fields).length`.
  - The Yatao serialisation `=== "[B2] (D3) [E3] F#3 [G#3] A3 [B3] C#4 D4
    [E4] F#4 G#4 A4 [B4] C#5 D5 [E5] F#5"`.
  - **No fixture yields a serialised string whose pitch multiset differs
    from the source's.** Assert it per fixture. For a note the source wrote
    without an octave, compare pitch class only, and assert its octave
    equals the one `parseSeed` infers for the octaveless string (the importer
    never computes an octave of its own).
  - Each octaveless fixture (the three Ashakiran lines) records its exact
    serialised string, the NO_OCTAVE flag and the list of inferred notes.
  - Parentheses without a cited profile never get a role.
  - `serialise` output for every REVIEW fixture is a fixed point of
    `formatSeed(parseSeed(x).value) === x`.
- **Verify:** `node --test tests/import.test.js && python3
  tools/inline_engine.py --check && python3 tools/validate.py && bash
  tests/run.sh node && python3 -m unittest tests.test_readme_currency`
- **G6 (owner, 2026-10-17: infer, then confirm):** `NO_OCTAVE` is a CONFIRM.
  The importer takes the octaves from `parseSeed` on the octaveless string and
  serialises them explicitly, so the box shows the octaves the user ticked.
  This supersedes the 2026-10-16 interim BLOCK.
- **Non-goals:** UI, fetch, profiles with real data, an octave inference of
  the importer's own (it reuses `parseSeed`'s), any change to `parseSeed`,
  `formatSeed` or `REASONS`.

### Lane A2: refusal hints for raw paste (DEFERRED by owner, 2026-10-17; not in this release)

- **Owns:**
  - `src/engine/core.js` `REASONS` alternates only, and the BAD_NOTE alternate
    selection in `scaleTokens`;
  - its region regenerated in `index.html`;
  - `tests/scale.test.js`;
  - `tests/fixtures/scale_grammar_v1.json`.

  Lane A2 also owns tests/core.test.js (the SECTION9 BAD_NOTE alternates) and the docs/ENGINE-SPEC.md section 2 alternate-sentences table, because 'REASONS is the ENGINE-SPEC section 2 table, verbatim' deep-equals core.REASONS against both; its verify command adds `node --test tests/core.test.js`, and it owns its FLOORS and mutant rows.
- **Objective:** when a raw maker string is typed straight into the box,
  BAD_NOTE says why: commas ("separate notes with spaces"), ♯/♭ ("use # and
  b"), lowercase, or a word ("Kurd is not a note" already exists).
- **Acceptance:** each new alternate is asserted, and all existing grammar
  fixtures are unchanged.
  - Every `e.g.` in a new alternate is itself a string that parses
    (`tests/scale.test.js` 'every e.g. in REASONS parses').
- **Verify:** `node --test tests/scale.test.js && node --test tests/core.test.js && python3
  tools/inline_engine.py --check`
- **Non-goals:**
  - accepting any new syntax;
  - changing what parses: no ♯ acceptance, no comma acceptance.

  Widening the grammar is an owner decision.
- **Conflicts with A1** only on `index.html` engine regions, which are
  resolved by re-running the tool. Take care with `tools/inline_engine.py`
  only if A1 lands first.

### Lane B: sheet UI (smallest useful release, part 2; depends on A1 merged)

- **Owns:**
  - the `index.html` app markup, CSS and app JS outside the engine regions:
    the `IMPORT TEXT` control, the paste area, the review list and its
    wiring;
  - `tools/sandbox.js` `ELEMENT_IDS`;
  - `tests/app.test.js`, `tests/e2e.test.js`;
  - their FLOORS and mutant rows;
  - the refresh of any existing `tests/mutants/*.patch` that its `index.html`
    edits stale or make non-unique, whichever suite the patch kills: run
    `python3 tools/refresh_mutants.py`, then `--check`. Placing the controls
    straight after the `#scale-refusal` fieldrow stales
    `a_seed_refusal_below_the_pan.patch`;
  - edits to those drawer and seat-sweep suites only where the new sheet
    controls force an assumption (Tab count, sheet height) to move, each
    called out in the PR.
- **Objective:** section 4.3.
- **Acceptance:**
  - USE writes exactly `HPE.importer.serialise(r)` into `#scale-box` and
    fires `input`, so the parse line matches what typing it would show.
  - BLOCK disables USE.
  - CONFIRM needs a tick, or a picked ding.
  - A NO_OCTAVE review row marks each inferred octave as inferred.
  - INSUFFICIENT writes nothing to `#scale-box`.
  - Manual entry and every existing sheet test pass unchanged.
  - At 380px: no horizontal scroll, and the sheet-guidance N-A5/N-A6
    invariants hold.
  - The import controls join the sheet's focus order.
  - No `fetch` and no new external request: e2e "a full boot sends zero
    requests…" still holds, plus a new assertion that an import sends zero
    requests.
  - Analytics: one `scale_import` event with `{status}` only, no text (G7,
    owner 2026-10-17: yes). Lane B adds it to the 'discoverability: analytics events' describe and to 'no event param is a string over 40 characters or names a custom: id', and Lane C updates the CLAUDE.md event list.
- **Verify:** `node --test tests/app.test.js && node --test tests/e2e.test.js
  && python3 tools/validate.py && python3 tools/refresh_mutants.py --check
  && node --test tests/mutation_harness.test.js tests/drawer_grid.test.js
  tests/drawer_seats.test.js tests/drawer_drag.test.js
  tests/seat_sweeps_keys.test.js tests/seat_sweeps_tap_add.test.js
  tests/seat_sweeps_tap_edit.test.js`
- **Non-goals:**
  - URL fields;
  - deck naming on create (G5: no, auto-naming stays);
  - preset offers (G4: no);
  - editing the layout drawer;
  - editing shared `.mode` or `#settings-panel` rules: the CI panel-fit oracle
    diffs the panel against base.

### Lane C: docs (after B)

- **Owns:** `CLAUDE.md` (a short "Scale import" bullet that names its tests),
  `README.md` (usage line only; the module list and suite counts are A1's), and the `#about` copy only if the owner wants it
  mentioned.
- **Acceptance:** every sentence cites a test.
- **Verify:** reviewer re-reads each cited test.
- **Non-goals:** code.

### Optional enhancements (each behind its gate)

- **E1 (G1):** paste a Shopify product URL. The app fetches
  `/products/<handle>.json` directly, CORS-open, with no proxy. It reads
  `title` and `body_html` as text only (a DOMParser on a detached document,
  then `textContent`) and feeds them to `interpret`.
  - Needs: an allow-list or a Shopify-shape check, a timeout, a size cap.
  - Needs tests that prove no network happens without a user action.
- **E2 (G2):** a proxy for non-Shopify pages.
- **E3 (G3):** Jev as a scorer for ding candidates, behind E2.
- **E4:** source profiles, `{host, convention, citation}`, added only when a
  maker publishes a legend.

---

## 6. Risks and decision record

### Risks

1. **Users confirm by reflex.** DING_CUE is a tick almost everywhere, and a
   tick given without reading verifies nothing.
   - Mitigation: show the ding in the review row with its source fragment.
   - The parse line and preview then show the deck. A wrong ding usually
     trips NO_FIFTH or changes the auto-name visibly.
2. **Pastes from unsurveyed sites.** Templates outside the sample fail closed
   (INSUFFICIENT), which costs the user only the manual path they already have.
3. **Wrong source data.** A maker's own errors (the Yatao "F# lydian" key, the
   D Kurd 13 role conflict) pass through when the note list itself is
   internally consistent. Fidelity to the source is the most the importer can
   promise, and the review list says where each note came from.
4. **Inferred octaves can be wrong.** Three of 25 Yatao lines and Sanango
   Medusa have no octaves; `scaleInfer` puts the ding at octave 3 and ascends
   from there. The owner chose CONFIRM over BLOCK (G6); the review list shows
   each inferred octave so the tick is informed, and the box stays editable.
5. **Mutation-gate and FLOORS upkeep** for a new module (see the repo
   memory). Budget for it in A1.

### Validation gates (owner decisions, all taken 2026-10-17)

| Gate | Question | Evidence so far | Decision |
|---|---|---|---|
| G1 | Allow the app's first non-GA network request: a direct, user-triggered fetch of Shopify product `.json`? | CORS-open on two Shopify hosts [O]; privacy cost: visitor IP to the shop | not now: paste only, no fetch |
| G2 | Run a proxy or worker (persistent infrastructure, abuse controls) for non-Shopify pages? | carrd has no CORS; kirstein.de 403 to curl [O] | no |
| G3 | Any model call (Jev or LLM), which needs G2 plus key custody? | Jev picks only, $0.042 per million input tokens (docs); LLM rejected | no |
| G4 | Offer a built-in deck when the pasted text is only a matching name? | owner removed presets in 2026-09; a maker's "D Kurd 10" may differ | no: report INSUFFICIENT |
| G5 | Carry the product name into the deck name on create? | `sheetOptions()` 9590 names new decks automatically | no: auto-naming stays |
| G6 | Octaveless lists: BLOCK (recommended), or allow `parseSeed`'s inference with a CONFIRM? | inference is "inferring missing pitch information" under the prompt's scope | infer, then CONFIRM |
| G7 | Add a `scale_import` analytics event with `{status}` only? | the Lane B acceptance text; no event is added without it | yes, `{status}` only |

### Rejected alternatives

- An LLM for extraction: hallucination passes target validation; needs a key
  and a proxy.
- Jev in the MVP: it cannot extract text, it only picks; it needs a key and a
  proxy; it adds little over labels plus confirmation.
- A parser per manufacturer as the primary design: templates vary within one
  retailer, and labels are the stable signal.
- Widening `parseSeed` to accept raw maker text: it applies our grammar to
  theirs, which the prompt forbids. Sela's parentheses would become dings.
- OCR or images: out of scope.

### What would change the recommendation

- A maker publishes a notation legend: add a cited profile (E4).
- Owner approves G1 later: add E1 for Shopify URLs. Paste stays the baseline.
- Field data shows most users' sources are unlabelled prose without
  structure: revisit G3, with model output still span-checked against the
  source.

### Not verified

- Parentheses meaning bottom notes (Sela, Ayasa-at-Yatao) is *inferred* from
  prose and counts. No legend was found.
- Yatao's ding convention (first top note) is undeclared on the page.
- Jev: no live call; no CORS or browser docs found.
- One Ayasa page seen in search snippets with "Top/Bottom" and parentheses
  redirected, so it was not read.
- Real users' paste habits and coverage beyond these three sources are
  unmeasured.
- Whether non-Shopify makers can be fetched through a proxy is untested.
