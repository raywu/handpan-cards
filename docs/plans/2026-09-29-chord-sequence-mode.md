# Chord-sequence mode

- **Goal:** after the lanes below merge, a player can choose "PLAY A SEQUENCE" in the settings menu and step through 2 or 3 chords drawn by a seeded, unit-tested rule, starting on the pan's home chord and taken from the owner-approved golden table (§7). Each sequence comes with one of the seven playing styles, written in the app's own words and credited to Moritz.handpan, with an outbound link to the source. NAME->NOTES, NOTES->NAME and print behave exactly as they do today.
- **Date:** 2026-09-29
- **Base:** `main` @ `e728912` (merge of PR #159). Every file:line below was read at that SHA.
- **Shape:** /swarm, two lanes, serialised. S1 (engine, `src/engine/sequence.js`) is followed by S2 (the `index.html` app region). S1 spawns only after the owner approves the golden table (§7).
- **Prompt:** `docs/prompts/2026-09-29-chord-sequence-mode.md`
- **Related docs:**
  - `docs/plans/2026-09-24-quality-eval.md`: N1-N10 and the §6 merge gates.
  - `docs/plans/2026-09-28-android-bg-and-menu.md`: N15-N19, the settings panel, and the structural template.
  - `docs/SCALE_ENGINE_PLAN.md`: the binding engine decisions. This plan adds a module and changes none of them.

## §1 Goal and non-goals

**Why.** In the owner's words: "a newer player may not know how to string the different chords together and may be overwhelmed by the number of chords". The decks hold 19, 52 and 25 cards. This mode narrows a deck to one short, playable loop at a time, and pairs it with one way to play it.

**Non-goals.** N1-N10 (quality-eval), N13 (no edits to `tests/mutation_check.sh`) and N15-N19 (android/menu) carry over unchanged. New non-goals, which together are the v1 cut:

| # | Non-goal (v1) | Not precluded because |
|---|---|---|
| N20 | No change to deck data, diagram geometry, card anatomy, fonts, palettes or the label style. No new colour, typeface or all-caps label outside `.mode` | - |
| N21 | No audio (roadmap 4) | Each sequence is a list of chord indices, and each chord already carries midi. An arpeggio player reads the same list |
| N22 | No spaced-repetition grading and no practice stats (roadmap 1, 2) | The mode stores no per-card state, so a later SM-2 key cannot collide with it |
| N23 | No share-link seed for a sequence | `pick()` takes an injectable rng, so a later `#q=` seed is one parameter |
| N24 | No drawing of a style on the diagram (arpeggio order, 3-3-2 grouping) | The style id is returned by the engine, so an overlay can key off it later |
| N25 | No print change. Sequence mode adds nothing to either PDF, and a printed card carries no sequence furniture | - |
| N26 | No YouTube embed, no player script, no per-style timestamps, no transcription of the video | - |
| N27 | The player cannot choose the length or the style in v1. Both are drawn, and "NEW SEQUENCE" re-rolls both | The engine takes `{length}` as an option |
| N28 | No new CHROME_BUDGET or LANDSCAPE_BUDGET rows. Sequence mode must reuse the A/B chrome box for box (S2 acceptance 7) | - |

## §2 Findings

### Part A: what "complementary" means

**Data the rule reads** (all present today, nothing new stored):
- `chords[].fields` and `chords[].roots`: the voicing and root. Pitch class is `fields[id][2] % 12`, and the zone is `fields[id][3]` (schema: CLAUDE.md "App data model").
- The ding: the one field with zone `ding`. `core.js:19` refuses a pan with no ding, so every deck has one. Its pitch class is the **home** (tonic) pitch class. On all three built-ins it equals the `i`/`I` degree.
- `degrees{pc:label}`: display only. The rule never reads a degree label, so a generated deck, whose labels come from `naming.degrees()` (`src/engine/naming.js:267`), behaves the same as a built-in.

**Step 1, common to every candidate: one "anchor" chord per root.** A deck has several cards on one root (Pygmy has 52 cards across 7 roots). The mode picks one of them, so a newer player sees the simplest shape:
- Only chords of at most 3 fields whose pitch classes are a major or minor triad, a sus4, a diminished triad or a power chord.
- Preference: maj/min, then sus4, then dim, then 5. Ties go to fewer bottom-shell fields, then to deck order.

| Deck | Anchors (card #, degree, voicing) |
|---|---|
| C# Hijaz | C# (#1, I, 3-5-7), D° (#7, bII, 4-5-7), F° (#9, iii°, 5-7-8), F#sus4 (#11, iv, 6-2-3), G#° (#13, v°, 1-2-4), Bm (#15, bvii, 2-4-6) |
| F Low Pygmy | Fm (#1, i, 5-7-8), G° (#7, ii°, 1-U4-U5), Ab (#9, III, 2-3-4), Bbm (#20, iv, U4-U5-5), Cm (#25, v, 3-4-6), Db (#38, VI, U5-5-7), Eb (#44, VII, 4-6-U4) |
| D Amara | Dm (#1, i, 3-5-7), F (#9, bIII, 5-7-8), Gsus4 (#15, IV, 6-2-3), Am (#17, v, 1-2-4), C (#22, bVII, 2-4-6) |

**Step 2: common shape.** A sequence starts on the home anchor, visits distinct roots, and, when 3 chords long, must connect back to its first chord, because a player loops it. The candidates differ only in what "connect" means between consecutive chords:

| | C1 shared tone | C2 shared tone or a step (recommended) | C3 curated degree templates |
|---|---|---|---|
| Rule | Consecutive chords share at least one pitch class | ...or their roots are 1-2 semitones apart | A fixed list (i-VII-VI, i-iv-v, I-bII, ...) matched against degree labels |
| Hijaz 2 / 3 | 4 / 10 | 5 / 18 | depends on list |
| Pygmy 2 / 3 | 4 / 6 | 6 / 30 | depends on list |
| Amara 2 / 3 | 3 / 6 | 4 / 12 | depends on list |
| Generated deck | Works: pitch classes only | Works: pitch classes only | **Fails**: an unusual scale matches no template and gets nothing |
| NO_THIRDS pan, e.g. `(C3) G3 D4 G4 D5` | Builds only two G5 cards, so there is no anchor on the home pitch class C: `NO_HOME_CHORD` (verified in eng review, E1) | same | **Fails** |
| Musical weakness | Never produces i-bVII: Amara never shows C, Pygmy never shows Eb, and so no i-VII-VI. That is the most idiomatic handpan move there is | Permissive. On a diatonic pan every anchor is in the key, so C2 reduces to "the home chord, then any others, looping home". Its musical content is in the anchor choice and the home start | Most "musical" but not computable for arbitrary scales, and it is our taste, not a rule |

**Recommendation: C2.** It is the only rule that includes i-bVII on Amara and Pygmy, and it is honest about what it is. For a beginner, "start on the home chord, move to one or two other chords of the pan, come home" is exactly the lesson. C1's rows are a subset of C2's, marked in the golden table's `C1` column, so the owner can approve C1 instead by keeping only the "yes" rows. C3 is rejected: it cannot serve generated decks. Diminished anchors stay in. Hijaz's colour lives in bII and v°, and excluding them is an owner row (O3).

**Short decks.**
- Fewer than 3 anchors: 2-chord sequences only.
- No 2-chord sequence (fewer than 2 anchors, or no anchor on the home pitch class): `pick()` returns `{chords:null, reason}`, with `reason` one of `NO_HOME_CHORD` (checked first) or `TOO_FEW_CHORDS`. The app shows a one-line message on the card in place of a chord ("This scale doesn't have enough simple chords to make a sequence. Pick another scale, or switch to NAME → NOTES in the menu.").
- The mode button stays enabled, since the next deck may work.

**Randomness.**
- Draw the length first, 2 or 3 with equal probability, among the lengths that exist. Then draw a sequence uniformly within that length. Drawing uniformly over the union would give 3-chord sequences 78-83% of the time.
- A re-roll never returns the sequence just shown when another exists.
- The style is drawn uniformly from the seven, once per sequence.
- Every draw goes through an `rng` argument. The app passes `Math.random`, and tests pass a seeded `mulberry32(seed)` that the module exports.

**Engine API** (`src/engine/sequence.js`, namespace `HPE.sequence`, plain script with `var` like its siblings):
- `anchors(deck)` returns `[chordIndex, ...]`, in deck order.
- `sequences(deck, length)` returns `[[chordIndex, ...], ...]`, in the golden table's order.
- `pick(deck, rng, prev)` returns `{chords:[...], style:"<id>"}`, or `{chords:null, reason:"TOO_FEW_CHORDS" | "NO_HOME_CHORD"}`.
- `STYLES` = `["together", "arpeggio", "three-over-two", "three-three-two", "paradiddle", "groove", "freestyle"]`.
- `mulberry32(seed)` returns an rng function.

### Golden sequences (owner gate, §7)

This is C2's complete output on each built-in deck. "Voicing" gives the field numbers each chord's voicing uses. The diagram also lights every other field of those pitch classes, by the pitch-class-complete rule. `C1 = yes` marks the rows C1 would also produce. Once approved, this table is `tests/sequence.test.js`'s expected output, verbatim.

**C# HIJAZ 9** - home chord C# (#1)

| # | Sequence | Degrees | Voicing, field numbers | Card #s | C1 |
|---|---|---|---|---|---|
| H1 | C# → D° | I - bII | 3-5-7 / 4-5-7 | 1, 7 | yes |
| H2 | C# → F° | I - iii° | 3-5-7 / 5-7-8 | 1, 9 | yes |
| H3 | C# → F#sus4 | I - iv | 3-5-7 / 6-2-3 | 1, 11 | yes |
| H4 | C# → G#° | I - v° | 3-5-7 / 1-2-4 | 1, 13 | yes |
| H5 | C# → Bm | I - bvii | 3-5-7 / 2-4-6 | 1, 15 | - |
| H6 | C# → D° → F° | I - bII - iii° | 3-5-7 / 4-5-7 / 5-7-8 | 1, 7, 9 | yes |
| H7 | C# → D° → G#° | I - bII - v° | 3-5-7 / 4-5-7 / 1-2-4 | 1, 7, 13 | yes |
| H8 | C# → D° → Bm | I - bII - bvii | 3-5-7 / 4-5-7 / 2-4-6 | 1, 7, 15 | - |
| H9 | C# → F° → D° | I - iii° - bII | 3-5-7 / 5-7-8 / 4-5-7 | 1, 9, 7 | yes |
| H10 | C# → F° → F#sus4 | I - iii° - iv | 3-5-7 / 5-7-8 / 6-2-3 | 1, 9, 11 | yes |
| H11 | C# → F° → G#° | I - iii° - v° | 3-5-7 / 5-7-8 / 1-2-4 | 1, 9, 13 | yes |
| H12 | C# → F° → Bm | I - iii° - bvii | 3-5-7 / 5-7-8 / 2-4-6 | 1, 9, 15 | - |
| H13 | C# → F#sus4 → F° | I - iv - iii° | 3-5-7 / 6-2-3 / 5-7-8 | 1, 11, 9 | yes |
| H14 | C# → F#sus4 → G#° | I - iv - v° | 3-5-7 / 6-2-3 / 1-2-4 | 1, 11, 13 | yes |
| H15 | C# → F#sus4 → Bm | I - iv - bvii | 3-5-7 / 6-2-3 / 2-4-6 | 1, 11, 15 | - |
| H16 | C# → G#° → D° | I - v° - bII | 3-5-7 / 1-2-4 / 4-5-7 | 1, 13, 7 | yes |
| H17 | C# → G#° → F° | I - v° - iii° | 3-5-7 / 1-2-4 / 5-7-8 | 1, 13, 9 | yes |
| H18 | C# → G#° → F#sus4 | I - v° - iv | 3-5-7 / 1-2-4 / 6-2-3 | 1, 13, 11 | yes |
| H19 | C# → G#° → Bm | I - v° - bvii | 3-5-7 / 1-2-4 / 2-4-6 | 1, 13, 15 | - |
| H20 | C# → Bm → D° | I - bvii - bII | 3-5-7 / 2-4-6 / 4-5-7 | 1, 15, 7 | - |
| H21 | C# → Bm → F° | I - bvii - iii° | 3-5-7 / 2-4-6 / 5-7-8 | 1, 15, 9 | - |
| H22 | C# → Bm → F#sus4 | I - bvii - iv | 3-5-7 / 2-4-6 / 6-2-3 | 1, 15, 11 | - |
| H23 | C# → Bm → G#° | I - bvii - v° | 3-5-7 / 2-4-6 / 1-2-4 | 1, 15, 13 | - |

**F3 LOW PYGMY 18** - home chord Fm (#1)

| # | Sequence | Degrees | Voicing, field numbers | Card #s | C1 |
|---|---|---|---|---|---|
| P1 | Fm → G° | i - ii° | 5-7-8 / 1-U4-U5 | 1, 7 | - |
| P2 | Fm → Ab | i - III | 5-7-8 / 2-3-4 | 1, 9 | yes |
| P3 | Fm → Bbm | i - iv | 5-7-8 / U4-U5-5 | 1, 20 | yes |
| P4 | Fm → Cm | i - v | 5-7-8 / 3-4-6 | 1, 25 | yes |
| P5 | Fm → Db | i - VI | 5-7-8 / U5-5-7 | 1, 38 | yes |
| P6 | Fm → Eb | i - VII | 5-7-8 / 4-6-U4 | 1, 44 | - |
| P7 | Fm → G° → Ab | i - ii° - III | 5-7-8 / 1-U4-U5 / 2-3-4 | 1, 7, 9 | - |
| P8 | Fm → G° → Bbm | i - ii° - iv | 5-7-8 / 1-U4-U5 / U4-U5-5 | 1, 7, 20 | - |
| P9 | Fm → G° → Cm | i - ii° - v | 5-7-8 / 1-U4-U5 / 3-4-6 | 1, 7, 25 | - |
| P10 | Fm → G° → Db | i - ii° - VI | 5-7-8 / 1-U4-U5 / U5-5-7 | 1, 7, 38 | - |
| P11 | Fm → G° → Eb | i - ii° - VII | 5-7-8 / 1-U4-U5 / 4-6-U4 | 1, 7, 44 | - |
| P12 | Fm → Ab → G° | i - III - ii° | 5-7-8 / 2-3-4 / 1-U4-U5 | 1, 9, 7 | - |
| P13 | Fm → Ab → Bbm | i - III - iv | 5-7-8 / 2-3-4 / U4-U5-5 | 1, 9, 20 | - |
| P14 | Fm → Ab → Cm | i - III - v | 5-7-8 / 2-3-4 / 3-4-6 | 1, 9, 25 | yes |
| P15 | Fm → Ab → Db | i - III - VI | 5-7-8 / 2-3-4 / U5-5-7 | 1, 9, 38 | yes |
| P16 | Fm → Ab → Eb | i - III - VII | 5-7-8 / 2-3-4 / 4-6-U4 | 1, 9, 44 | - |
| P17 | Fm → Bbm → G° | i - iv - ii° | 5-7-8 / U4-U5-5 / 1-U4-U5 | 1, 20, 7 | - |
| P18 | Fm → Bbm → Ab | i - iv - III | 5-7-8 / U4-U5-5 / 2-3-4 | 1, 20, 9 | - |
| P19 | Fm → Bbm → Cm | i - iv - v | 5-7-8 / U4-U5-5 / 3-4-6 | 1, 20, 25 | - |
| P20 | Fm → Bbm → Db | i - iv - VI | 5-7-8 / U4-U5-5 / U5-5-7 | 1, 20, 38 | yes |
| P21 | Fm → Bbm → Eb | i - iv - VII | 5-7-8 / U4-U5-5 / 4-6-U4 | 1, 20, 44 | - |
| P22 | Fm → Cm → G° | i - v - ii° | 5-7-8 / 3-4-6 / 1-U4-U5 | 1, 25, 7 | - |
| P23 | Fm → Cm → Ab | i - v - III | 5-7-8 / 3-4-6 / 2-3-4 | 1, 25, 9 | yes |
| P24 | Fm → Cm → Bbm | i - v - iv | 5-7-8 / 3-4-6 / U4-U5-5 | 1, 25, 20 | - |
| P25 | Fm → Cm → Db | i - v - VI | 5-7-8 / 3-4-6 / U5-5-7 | 1, 25, 38 | - |
| P26 | Fm → Cm → Eb | i - v - VII | 5-7-8 / 3-4-6 / 4-6-U4 | 1, 25, 44 | - |
| P27 | Fm → Db → G° | i - VI - ii° | 5-7-8 / U5-5-7 / 1-U4-U5 | 1, 38, 7 | - |
| P28 | Fm → Db → Ab | i - VI - III | 5-7-8 / U5-5-7 / 2-3-4 | 1, 38, 9 | yes |
| P29 | Fm → Db → Bbm | i - VI - iv | 5-7-8 / U5-5-7 / U4-U5-5 | 1, 38, 20 | yes |
| P30 | Fm → Db → Cm | i - VI - v | 5-7-8 / U5-5-7 / 3-4-6 | 1, 38, 25 | - |
| P31 | Fm → Db → Eb | i - VI - VII | 5-7-8 / U5-5-7 / 4-6-U4 | 1, 38, 44 | - |
| P32 | Fm → Eb → G° | i - VII - ii° | 5-7-8 / 4-6-U4 / 1-U4-U5 | 1, 44, 7 | - |
| P33 | Fm → Eb → Ab | i - VII - III | 5-7-8 / 4-6-U4 / 2-3-4 | 1, 44, 9 | - |
| P34 | Fm → Eb → Bbm | i - VII - iv | 5-7-8 / 4-6-U4 / U4-U5-5 | 1, 44, 20 | - |
| P35 | Fm → Eb → Cm | i - VII - v | 5-7-8 / 4-6-U4 / 3-4-6 | 1, 44, 25 | - |
| P36 | Fm → Eb → Db | i - VII - VI | 5-7-8 / 4-6-U4 / U5-5-7 | 1, 44, 38 | - |

**D AMARA 9** - home chord Dm (#1)

| # | Sequence | Degrees | Voicing, field numbers | Card #s | C1 |
|---|---|---|---|---|---|
| A1 | Dm → F | i - bIII | 3-5-7 / 5-7-8 | 1, 9 | yes |
| A2 | Dm → Gsus4 | i - IV | 3-5-7 / 6-2-3 | 1, 15 | yes |
| A3 | Dm → Am | i - v | 3-5-7 / 1-2-4 | 1, 17 | yes |
| A4 | Dm → C | i - bVII | 3-5-7 / 2-4-6 | 1, 22 | - |
| A5 | Dm → F → Gsus4 | i - bIII - IV | 3-5-7 / 5-7-8 / 6-2-3 | 1, 9, 15 | yes |
| A6 | Dm → F → Am | i - bIII - v | 3-5-7 / 5-7-8 / 1-2-4 | 1, 9, 17 | yes |
| A7 | Dm → F → C | i - bIII - bVII | 3-5-7 / 5-7-8 / 2-4-6 | 1, 9, 22 | - |
| A8 | Dm → Gsus4 → F | i - IV - bIII | 3-5-7 / 6-2-3 / 5-7-8 | 1, 15, 9 | yes |
| A9 | Dm → Gsus4 → Am | i - IV - v | 3-5-7 / 6-2-3 / 1-2-4 | 1, 15, 17 | yes |
| A10 | Dm → Gsus4 → C | i - IV - bVII | 3-5-7 / 6-2-3 / 2-4-6 | 1, 15, 22 | - |
| A11 | Dm → Am → F | i - v - bIII | 3-5-7 / 1-2-4 / 5-7-8 | 1, 17, 9 | yes |
| A12 | Dm → Am → Gsus4 | i - v - IV | 3-5-7 / 1-2-4 / 6-2-3 | 1, 17, 15 | yes |
| A13 | Dm → Am → C | i - v - bVII | 3-5-7 / 1-2-4 / 2-4-6 | 1, 17, 22 | - |
| A14 | Dm → C → F | i - bVII - bIII | 3-5-7 / 2-4-6 / 5-7-8 | 1, 22, 9 | - |
| A15 | Dm → C → Gsus4 | i - bVII - IV | 3-5-7 / 2-4-6 / 6-2-3 | 1, 22, 15 | - |
| A16 | Dm → C → Am | i - bVII - v | 3-5-7 / 2-4-6 / 1-2-4 | 1, 22, 17 | - |

### Part B: the mode and its UI (from `/frontend-design:frontend-design`, direction only)

**Direction.** The mode is a quieter version of the card you already know, not a new screen. The one memorable element is the **sequence rail** in the footer, the chords named in order with the current one lit. Everything else is existing anatomy. Overrides of the skill's defaults, recorded as the prompt requires:
- It argued against all-caps labels. The mode button stays all-caps to match `.mode`, because N20 and the "preserve the visual system" constraint win.
- It suggested a distinct accent for the rail. The current chord uses the deck's existing `--root` colour instead, so no new colour is introduced.

**Menu entry (owner-fixed: in the settings menu).**
- A third `.mode` button, `#modeS` "PLAY A SEQUENCE", in the existing Practice `.modebar` (`index.html:1116-1119`).
- Three buttons do not fit one row of the 320px panel, since each existing one is ~118px wide. `.modebar` gains `flex-wrap:wrap`, and `#modeS` takes the full second row.
- Under the modebar, visible only while the mode is S, sits a `.panel-note` paragraph holding the source credit and link (Part C).
- `panelStops()` (`index.html:7731-7735`) gains `#modeS` and the link, so the focus trap covers them. On desktop the sidebar shows the same content, with no modal.

```
380px panel (mobile hamburger)          desktop sidebar (>=1024x700)
+--------------------------------+      +----------------------+------------------+
| Practice                       |      | Practice             |                  |
| [NAME → NOTES] [NOTES → NAME]  |      | [NAME→NOTES][NOTES→] |   +----------+   |
| [      PLAY A SEQUENCE       ] |      | [ PLAY A SEQUENCE  ] |   |  card    |   |
| Playing styles adapted from    |      | Playing styles ...   |   |          |   |
| "7 ways to play chords on the  |      | Watch on YouTube     |   +----------+   |
| handpan" by Moritz.handpan.    |      | Scales               |  < Dm → F → Am > |
| Watch on YouTube               |      | + ADD A SCALE        |                  |
| Scales ...                     |      | Print this deck ...  |                  |
+--------------------------------+      +----------------------+------------------+
```

**Sequence view: one card at a time, with a position rail.** Side-by-side cards fail at 380px: three diagrams at a third of the width are unreadable. A stepped strip fails the landscape one-row header. One card at a time reuses every existing box, so CHROME_BUDGET and LANDSCAPE_BUDGET hold unchanged (N28).
- **Front face:** mode A's `answer` face, byte for byte (header, diagram, note and number lines). It carries no chord name, since `headerHTML` renders none (`index.html` `headerHTML`). The current chord's name is the lit entry in the footer rail, and the back face repeats it. There is no hint line, because it would add height to a face that already fills the card at 844x390 (eng review E5). In this mode it is not a quiz: the point is to play the chord.
- **Back face:** the chord name (reuses `.prompt`/`nameHTML`), then the style name in Marcellus (`nameHTML`'s face, at the subtitle size), a 1-2 sentence description in Bitter (the `.lines` face), and a plain-text credit "Style from Moritz.handpan". The back holds no link: a link inside the `role=button` card is unreachable for assistive tech, and M1's acceptance keeps the card free of controls.
- **Footer:**
  - `#count` shows the rail `Dm → F → Am`, with the current chord in a `<b>` coloured `var(--root)`, plus a visually-hidden "chord 2 of 3" so the live region announces position rather than arrows.
  - `#shuffle` reads "New sequence" and re-rolls. The shuffle state is kept and restored when the player leaves the mode.
  - Prev/next wrap within the sequence.

```
380x800 portrait                 844x390 landscape (one-row header)
+----------------------------+   +--------------------------------------------+
| Handpan Chord Cards    [≡] |   | Handpan Chord Cards [chips......]      [≡] |
| [HIJAZ][PYGMY][AMARA]      |   | +--------------+                           |
| +------------------------+ |   | | Dm  #1  i    |  (card, same box as A/B)  |
| | D AMARA  #1        i   | |   | |  (diagram)   |                           |
| | Dm                     | |   | | 3-5-7        |                           |
| |      (diagram)         | |   | +--------------+                           |
| | D4 · F4 · A4           | |   | [<]  Dm → F → Am   New sequence  [>]       |
| | 3 - 5 - 7              | |   +--------------------------------------------+
| | Tap for a way to play  | |
| +------------------------+ |   back face:  Dm
| [<]  *Dm* → F → Am   [>]   |               Arpeggios
|      New sequence          |               Play the notes one at a time,
+----------------------------+               low to high, then back down.
                                             Style from Moritz.handpan
```

**Behaviour.**

| Input | Sequence mode |
|---|---|
| Next / Prev, ArrowRight / ArrowLeft, swipe | Step within the sequence and wrap (3 → 1 is the loop home). Unflip |
| Tap, Enter, Space on the card | Flip to the style tip and back |
| "New sequence" | `pick(deck, Math.random, current)`: new chords and a new style, idx 0, unflipped |
| Deck chip, + ADD A SCALE (generate), delete a deck | All go through `selectDeck()` → `setOrder()` (`index.html:5876`), and `setOrder()` draws a fresh sequence in mode S. There is no stale sequence, because `setOrder` is the only writer of `order` |
| Reload | The mode persists (`save()` at `index.html:5662-5672` already writes `mode`). The sequence does not: a fresh one is drawn |
| NAME → NOTES / NOTES → NAME | Leaves the mode and restores the shuffle label and state |

**Stored-value guard.** Today `index.html:5649` accepts any string as `mode`, and `render()` treats every value other than "A" as B. After S2, the value is read only if it is one of `"A"`, `"B"`, `"S"`, and anything else becomes "A". An old store holds "A" or "B" and reads back unchanged.

**The seven styles, in the app's own words.** These are the v1 copy. The owner may edit the wording without re-review.

| id | Name on card | Tip (app's own wording) |
|---|---|---|
| together | All at once | Strike every note of the chord together, then let it ring before the next one |
| arpeggio | Arpeggio | Play the notes one at a time, low to high, then come back down |
| three-over-two | 3 over 2 | One hand plays three even strokes while the other plays two, in the same span |
| three-three-two | 3-3-2 | Group your strokes 3 + 3 + 2 and keep the cycle going through each chord |
| paradiddle | Paradiddle | Right-left-right-right, left-right-left-left, moving the strokes across the chord's notes |
| groove | Groove | Keep one chord shape and add slaps, soft ghost notes, or move the accent around |
| freestyle | Freestyle | Mix the patterns, bring a different top note forward each time, and follow your ear |

**Reduced motion.** The existing flip already honours `prefers-reduced-motion`, and the mode adds no motion.

### Part C: sourcing and linking

**Verdict:** one plain outbound link in the settings panel, `<a href="https://www.youtube.com/shorts/YcmgdgZTpHc" target="_blank" rel="noopener">Watch on YouTube</a>`. No iframe, no player script, no timestamps.
- **Offline (roadmap 3, the PWA):** the link simply fails to load in the new tab, and the app is unaffected. No pre-check, no service-worker handling.
- **Attribution text:** "Playing styles adapted from "7 ways to play chords on the handpan" by Moritz.handpan." The card back carries "Style from Moritz.handpan".
- **Permission:** linking to and naming a public video needs no permission, and the tip wording is ours. Using the creator's name as a credit on every card back is courteous but not required. Asking the creator is an owner decision (O6); the plan does not block on it.
- The link gets its own 44px target and joins `panelStops()`.

## §3 Lanes

S1 and S2 both touch `index.html`, but S1 only through `tools/inline_engine.py` (a generated region) and S2 only outside it. They are still **serialised**: S2 calls `HPE.sequence`, which does not exist until S1 merges, and both edit `tests/app.test.js` and the FLOORS table. The UI is a single lane, not two, because the menu button, `setMode`, `render`, `setOrder` and the footer all move together. Splitting them would put two lanes into a ~40-line region of JS.

| Lane | Owns | Never touches | Acceptance | Verify |
|---|---|---|---|---|
| **S1** `claude/seq-engine` | New `src/engine/sequence.js`. New `tests/sequence.test.js`. `sequence` appended to `MODULES` at `tools/inline_engine.py:35`. The generated engine region in `index.html` (by running the tool only). The two module-list assertions at `tests/app.test.js:474` and `:483`. A new FLOORS row for `tests/sequence.test.js`, plus the app row if it moves. New mutants `sq_*` | The `index.html` app region, `data/`, other engine modules, `tests/e2e.test.js`, the budget tables, `tests/mutation_check.sh` | (1) The failing tests below are written first and fail at base. (2) They pass on the lane head. (3) `python3 tools/inline_engine.py --check` and `tools/validate.py` are clean. (4) Mutants `sq_anchor_order_flipped`, `sq_loop_not_checked`, `sq_rng_ignored`, `sq_repeat_allowed` and `sq_home_not_first` are each killed | `node --test tests/sequence.test.js tests/app.test.js && python3 tools/inline_engine.py --check && python3 tools/validate.py`, then CI 5/5 at head |
| **S2** `claude/seq-ui` | The `index.html` app region: `#modeS` markup (`:1116-1119`) and `.modebar` wrap CSS (`:202`), the `.panel-note` credit and link, the `mode` read guard (`:5649`), `render()` (`:6540-6582`) S branch, the `setOrder()` (`:6585`) S branch, the footer count and Shuffle wiring (`:7703-7707`), `panelStops()` (`:7731-7735`), `setMode` (`:7789-7800`). A new `describe("sequence mode")` block at the end of `tests/e2e.test.js`, and app tests. FLOORS rows for e2e and app. New mutants `sqe_*`, plus the existing mutants listed below | `src/engine/*`, generated regions, `data/`, `<head>`, the `(max-height:520px)` blocks (the single `clip-path` block stays single), CHROME_BUDGET/LANDSCAPE_BUDGET values, `tests/mutation_check.sh` | (1) The failing tests are written first. (2) `#modeS` has `aria-pressed`, exactly one mode is pressed at a time, and the mode survives a reload. (3) Stored modes `"S"`, `"A"` and `"B"` read back; `"C"`, `7` and `null` read as "A". (4) In S the card index stays within the sequence under prev/next/arrows, 3 → 1 wraps, and the answer face shows first. (5) "New sequence" changes the sequence (a stubbed `Math.random` in app tests) and never repeats the last one. (6) Switching deck, generating a deck and deleting a deck each draw a new sequence from the new deck. (7) At 390x844, 390x745, 844x390 and 1280x800, the header, card and footer rects in mode S equal those in mode A (±0.5px), and `#count` is one line at 320x568 for the longest built-in rail ("C# → F#sus4 → G#°"). (8) The panel-fit test (`e2e:1315`) passes with `#modeS` and the note at 320x568 and 844x390, with no internal scroll. (9) The link has `rel` containing `noopener`, `target=_blank`, the exact href, a 44px target, and is in the Tab cycle. The card faces contain no `a`, `button` or `select`. (10) The live region's text contains "chord N of M" and the chord name. (11) A deck with `pick()` → null shows the message and no crash; `render()`'s empty-order guard still holds. (12) Modes A and B are byte-identical in the DOM to base for the same deck and index. (13) The printed card has no rail, tip or link. (14) New mutants `sqe_mode_not_pressed`, `sqe_stored_mode_unguarded`, `sqe_step_leaves_sequence`, `sqe_link_no_noopener`, `sqe_count_not_positional` and `sqe_panelstops_misses_modeS` are killed | Single e2e tests by name (`CHROME_BIN=... node --test --test-name-pattern="sequence mode|settings panel fits" tests/e2e.test.js`, so the existing panel-fit test runs too (E7)), `node --test tests/app.test.js`, then CI 5/5 at head |

**S1 failing tests, written first** (each name is the test title; the assertion follows the colon):
1. `anchors pick one simple chord per root on every built-in deck`: `anchors(deck)+1` deep-equals Hijaz `[1,7,9,11,13,15]`, Pygmy `[1,7,9,20,25,38,44]`, Amara `[1,9,15,17,22]`.
2. `sequences match the approved golden table on every built-in deck`: `sequences(deck,2)` and `sequences(deck,3)` deep-equal the §7 table, row for row and in order.
3. `every sequence starts on the home chord and every step connects, including back home`: a property check over all rows.
4. `pick is deterministic for a seed and uses only the rng it is given`: the same seed gives the same result, and with `Math.random` stubbed to throw it still works.
5. `pick never returns the previous sequence when another exists`: 1000 seeded draws, each with `prev` set.
6. `length is drawn 2 or 3 evenly, and style evenly over seven`: 10k seeded draws, each bucket within ±3 percentage points.
7. `a pan with too few simple chords returns a reason, not a throw`: the fixture `(C3) G3 D4 G4 D5` (NO_THIRDS, from `tests/pdfcards.test.js:209`) builds only two G5 cards, so it yields `{chords:null, reason:"NO_HOME_CHORD"}`. A synthetic two-anchor deck whose anchors include home yields 2-chord sequences only, and `pick` then always returns length 2. A synthetic one-anchor deck on home yields `{chords:null, reason:"TOO_FEW_CHORDS"}`. Precedence: `NO_HOME_CHORD` is checked first (E1).
9. `pick excludes prev before choosing a length`: on a synthetic deck with exactly one 2-chord and several 3-chord sequences, with `prev` set to that 2-chord sequence and an rng stuck at 0, `pick` returns a 3-chord sequence and terminates. `prev` is an array of chord indices compared by value, and `pick` ignores a `prev` containing an index outside the deck (E4).
8. `the app exposes HPE.sequence`: the module-list assertions at `tests/app.test.js:474`/`:483` include `sequence`.

**S2 failing tests, written first** (e2e unless marked app):
1. `sequence mode: the mode button sits in the Practice group and is pressed alone`.
2. `(app) a stored mode outside A, B, S reads as A`.
3. `sequence mode: prev and next stay within the sequence and wrap home`.
4. `sequence mode: New sequence draws a different sequence and restores Shuffle on leaving`.
5. `sequence mode: switching, generating or deleting a deck draws from the new deck`.
6. `sequence mode: the chrome is box-for-box identical to NAME → NOTES` (the 4 viewports in acceptance 7).
7. `the settings panel fits...` (existing, `e2e:1315`), unchanged and required to pass.
8. `sequence mode: the source link is safe, reachable and 44px`.
9. `sequence mode: the counter announces the chord's position and name`.
10. `sequence mode: a pan with no sequence shows the message on the card`.
11. `(app) modes A and B render byte-identical faces to base`. The base snapshot is captured at `e728912` for each built-in deck at idx 0 and 1, and committed as a fixture.
12. `sequence mode: entering and leaving rebuilds the order, with shuffle on and off` (E2): A→S→A and B→S→B with shuffle on and off. Entering S gives an order of length 2 or 3. Leaving restores the full deck order, and the Shuffle label and `.on` class match `shuffled`. Pressing New sequence in S never changes `shuffled`. A persisted `"S"` boots straight into a sequence.
13. `sequence mode: an unsupported deck clears the card and disables stepping` (E3): working deck → `(C3) G3 D4 G4 D5` → working deck. The message replaces both faces with no residue of the previous card. ArrowLeft/ArrowRight, prev/next and Enter/Space throw nothing and change nothing. The next working deck renders normally.
14. `sequence mode: the rail stays inside the footer and renders names as text` (E6): at 320x568, the rail's box lies inside `.mid` and overlaps neither nav button, for the longest built-in rail and for a synthetic 3-chord rail of 6-character names. A chord `main` containing `<b>x</b>` renders as literal text.
15. `sequence mode: the settings panel fits with the credit showing` (E7): it enters S, reopens the panel, and runs the same no-internal-scroll assertions as `e2e:1315` at 320x568 and 844x390.
16. `sequence mode: Tab reaches the source link only while it is visible` (E8): in A and B, forward and backward Tab cycles contain no hidden link. In S they contain it exactly once. The rail's visible text is `aria-hidden`, and the live region's text is exactly `<name>, chord N of M`.

**Existing mutants whose target code S2 edits** (found by grepping the removed line, not the hunk header). Confirm each with `git apply --check` on the lane head:

| Mutant | Removed line | Expected |
|---|---|---|
| `e_a11y_mode_pressed_frozen` | `el.setAttribute("aria-pressed", ...)` in `setMode` | refresh: the loop gains a third id, and the line survives |
| `e_boot_count` | `` count.textContent = `${idx + 1} / ...` `` | re-target: A/B keep this line, and S takes a separate branch |
| `d_shuffle_duplicates` | the swap line in `setOrder` | refresh (the S branch is added above it) |
| `d_step_keeps_flip` | `flipped = false; render();` in `step` | refresh, since `step` is unchanged |
| `f6_render_empty_order_guard` | `if (!order.length) return;` | refresh; must still be killed (acceptance 11) |
| `e_a11y_both_faces_exposed` | the `shown`/`away` aria-hidden pair | refresh. **Never retire** |
| `d_save_drops_mode` | `next.mode = mode;` | untouched, still killed |
| `m2_panel_tab_no_backward_wrap`, `ms_js_breakpoint_drift` | `panelStops()` neighbourhood | refresh |
| `e_panel_moved_into_header` | `id="modeA"`/`id="modeB"` markup | refresh (a third button follows) |
| `e_target_mode_shuffle_short` | `.mode`/`.shuffle` min-height | refresh; `#modeS` must be in its target list |
| `e_landscape_card_overflows_main`, `f2_card_key_flip_dead`, `e_target_shuffle_overlay_eats_arrows` | not edited | untouched. Run them anyway, since the S hint adds text to a face |

S1 moves no existing mutant target. It only appends to a generated region and to two assertion lines, and neither is the removed line of any mutant (grep confirmed at base).

## §4 Order and dependencies

1. **Owner gate (§7):** golden-table approval. Nothing spawns before it.
2. **S1** spawns on approval.
3. **S2** spawns when S1 merges.
4. No other workstream is open, so there is no cross-plan dependency.

## §5 Merge gates

quality-eval §6 applies unchanged: CI 5/5 at a verified head SHA, then a fresh swarm-reviewer PASS or PASS_WITH_NITS at that SHA, then `gh pr merge --merge --match-head-commit`. Deltas:
- **Golden-table fidelity.** S1's reviewer diffs the test's expected arrays against §7 row by row. Any row added, dropped or reordered relative to the approved table is a FAIL.
- **Budget tables.** Nobody edits CHROME_BUDGET or LANDSCAPE_BUDGET (N28). A changed number is a FAIL.
- **380px.** S2's PR body attaches the header, card, footer and panel rects in modes A and S at 380x800 and 320x568, plus a screenshot of both card faces.
- **Mutant refresh.** Each refreshed patch is named in the PR body, with `git apply --check` output on the head.

## §6 Owner decisions (auto-decided under AFK; overridable)

| # | Decision | Default taken | Why |
|---|---|---|---|
| O1 | Definition of complementary | C2: shared tone or a 1-2 semitone root step, starting home and looping home | The only computable rule that includes i-bVII. C1 is available by keeping the `C1 = yes` rows |
| O2 | The golden table | **Owner gate, not auto-decided (§7)** | Musical quality is the owner's call |
| O3 | Diminished anchors | Included | Hijaz's bII and v° are its character. Excluding them leaves Hijaz 3 anchors |
| O4 | Style selection | One per sequence, uniform over seven, re-rolled with the sequence | Simplest. The owner gave no pedagogical order |
| O5 | Text vs diagram style | Text only (N24) | An overlay is new card anatomy |
| O6 | Link vs own copy | Both: our own 1-2 sentence wording on the card, and one link in the panel. Asking the creator's blessing is optional and does not block | Transcribing the video is not ours to ship. Linking is |
| O7 | Print scope | None (N25) | The PDFs are decks, not practice sessions |
| O8 | v1 cut | N20-N28 | Keeps it to two lanes |
| O9 | Menu form | A third `.mode` button, "PLAY A SEQUENCE", in the Practice group, with the modebar wrapping | Same group, same semantics (one practice mode at a time). A separate row would read as a setting, not a mode |
| O10 | Sequence display | One card at a time, with a footer rail | The only option with zero chrome cost (N28) |

## §7 Owner gate: golden-sequence approval

Before S1 spawns, the owner reads the golden table in §2 as a musician and, for each deck, does one of:
- **Approve all** (C2).
- **Approve C1 only** (keep the `yes` rows).
- **Strike specific rows.** A strike means the rule is wrong, not the row: the plan is revised to a rule that drops that row, and the table is regenerated. The engine never carries a per-row denylist, because generated decks would not inherit it.

S1's test expectations are the approved table, verbatim. Under AFK this gate is **not** auto-decided: S1 waits.

**Decision (owner, 2026-09-29): APPROVE ALL (C2) on all three decks.** Hijaz H1-H23, Pygmy P1-P36 and Amara A1-A16 all ship as written, and no row is struck. The gate is closed and S1 may spawn.

## §8 Eng review amendments (binding on S1 and S2)

These came out of `/plan-eng-review` on 2026-09-29, run under AFK. Where the text above and this section disagree, this section wins. E1 was verified by running the engine. The E-numbers are referenced by the tests above.

| # | Finding | Where | Resolution (auto-decided under AFK, recommended option) |
|---|---|---|---|
| E1 | The NO_THIRDS seed `(C3) G3 D4 G4 D5` builds only two G5 cards (`G5 1-2`, `G5 3-4`), so it has no anchor on C. The plan claimed 2-chord sequences | §2 Part A table, S1 test 7 | Fixed in place. That seed is the `NO_HOME_CHORD` fixture. The 2-chord-only and `TOO_FEW_CHORDS` cases use synthetic decks. `NO_HOME_CHORD` is checked first |
| E2 | `setMode()` (`index.html:7791`) calls `render()` but never `setOrder()`. Entering S would leave the full deck in `order`, and leaving it would keep the short sequence. The Shuffle handler (`:7704`) toggles `shuffled` on every click | §2 Part B Behaviour | `setMode(m)` calls `setOrder()` whenever it crosses the S boundary (`(mode === "S") !== (m === "S")`), and `setOrder()` gains the S branch. In S, the Shuffle `onclick` re-rolls and leaves `shuffled` alone. On leaving S, the label and `.on` class are restored from `shuffled`. S2 test 12 |
| E3 | An unsupported deck. Setting `order = []` makes `render()` return before clearing the previous card, and `step()` computes `% 0` (NaN idx) | Short decks, S2 acceptance 11 | New state `seq = {chords, style} \| {chords:null, reason}`. `render()` handles `mode === "S" && !seq.chords` BEFORE the empty-order guard: it writes the message to both faces and clears `#count`. `step()` and `flip()` return early when `order.length === 0`. The guard itself is unchanged, so `f6_render_empty_order_guard` still applies. S2 test 13 |
| E4 | No-repeat was underspecified. With a singleton pool, rejection sampling can loop forever | Randomness | `prev` is an array of chord indices compared by value. It is removed from the candidates BEFORE the length is chosen, and the length is drawn evenly among the lengths whose pool is still non-empty. There is no rejection loop. A `prev` from another deck (an out-of-range index) is ignored. S1 test 9 |
| E5 | The `answer` template has no chord name. `headerHTML` renders deck, #, degree and subtitle only | Part B front face | The front face is mode A's `answer`, byte for byte, with no hint. The name is carried by the rail and the back face. Chrome and face content cannot grow |
| E6 | The rail needs markup, where today's counter is plain `textContent`. `.count` has `.12em` tracking and `.mid` does not shrink, so "one line" does not prove it fits | Footer, S2 acceptance 7 | The rail is built with DOM nodes and `textContent`, never `innerHTML`. `.count` in S gets `white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0`, as an S-only class rule. S2 test 14 checks the rail stays inside `.mid` with no overlap. Anchors are triad, sus4, dim or 5 only, so a rail is at most 3 × ~6 characters |
| E7 | The existing panel-fit test (`e2e:1315`) boots fresh in mode A, so it never shows the S-only credit | S2 test 7 | S2 test 15 repeats the fit in S. The verify pattern now also runs the existing test |
| E8 | `panelStops()` filters out disabled elements but not hidden ones, so the link would be a dead Tab stop in A/B. A visually-hidden label alone would still have the rail's names and arrows announced | a11y | Add the link to `panelStops()` only while it is visible. The rail text is `aria-hidden="true"`, and a visually-hidden span carries `<name>, chord N of M`. S2 test 16 |
| E9 | `#modeS`'s click closes the panel (as `modeA`/`modeB` do), so the credit and link are first seen the next time the menu opens | Menu entry | Accepted. The card back credits the source on every sequence. Keeping `#modeS` consistent with its siblings matters more |

New S2 mutants for these: `sqe_setmode_skips_setorder` (E2), `sqe_empty_seq_stale_card` (E3), `sqe_rail_innerhtml` (E6), `sqe_link_stop_when_hidden` (E8). New S1 mutant: `sq_prev_rejection_loop` (E4).

### Scope challenge

About 9 files are touched: `sequence.js`, `sequence.test.js`, `inline_engine.py`, `index.html`, `app.test.js`, `e2e.test.js`, `suite_health.py`, `tests/mutants/`, and the base fixture. That trips the 8-file gate. Under AFK it was auto-decided as **original arrangement, no reduction**:
- the engine and UI split is already minimal;
- every file is a test or registration obligation of the repo's own gates, not new surface;
- there are no new classes or services, only one module and one state variable.

### What already exists (reused, not rebuilt)

- `order`/`idx`/`step()`: modulo wrap already loops a 2- or 3-entry order.
- `render()`'s aria pair.
- The `flip()` path.
- `save()` persisting `mode`.
- `selectDeck()`→`setOrder()` as the single writer.
- `panelStops()` focus trap.
- `esc()`.
- The `.mode` and `.panel-note` classes.
- `loadEngine` test helper.
- `select.build` for generated fixtures.

### Architecture (state and data flow)

```
selectDeck / setMode(crosses S) / Shuffle-in-S / boot
        |
        v
   setOrder() --mode!=S--> order = 0..n-1 (shuffled?)          (unchanged)
        |
        +--mode==S--> seq = HPE.sequence.pick(deck(), Math.random, seq.chords)
                        |-- chords  --> order = seq.chords ; idx = 0
                        '-- null    --> order = []  (reason kept on seq)
        v
   render(): S && !seq.chords --> message on both faces, #count cleared, return
             !order.length   --> return                    (guard unchanged)
             S               --> front = answer ; back = name+style+tip+credit ; rail
             A / B           --> unchanged bytes
```

### Test coverage

```
engine  anchors ............ S1-1        golden table ....... S1-2
        loop/home property . S1-3        seeded rng ......... S1-4
        no-repeat .......... S1-5, S1-9  distribution ....... S1-6
        short decks ........ S1-7        module registered .. S1-8
app/e2e mode button/pressed  S2-1        stored-mode guard .. S2-2
        wrap within seq .... S2-3        re-roll/shuffle .... S2-4, S2-12
        deck changes ....... S2-5        chrome parity ...... S2-6
        panel fit A / S .... S2-7, S2-15 link safety ........ S2-8
        live region ........ S2-9, S2-16 unsupported deck ... S2-10, S2-13
        A/B unchanged ...... S2-11       rail containment ... S2-14
        print unchanged .... acceptance 13 (existing print e2e, no new test)
GAPS: none open. Musical quality is covered by the owner gate (§7), not a test.
```

### Failure modes

| Failure | Test that catches it | Error handling | User sees |
|---|---|---|---|
| A generated deck with no home anchor | S1-7, S2-13 | `{chords:null, reason}` | A one-line message on the card |
| A stale sequence after a deck switch | S2-5 | `setOrder` is the only writer of `order` | - |
| An infinite re-roll loop | S1-9 | Exclude, then draw | - |
| Markup in a chord name | S2-14 | `textContent` | Literal text |
| A mode string from a future version | S2-2 | Read as A | NAME → NOTES |

None of these is silent or unhandled.

### Performance

- `sequences()` is at most 7×6 ordered pairs per call on the largest anchor set.
- It runs on user action only.
- Nothing is cached, and nothing needs to be.

### Outside voice

`codex exec -s read-only`, 43k tokens, 8 findings.
- **Merged into this review as E1-E8:** all 8.
- **Verified locally:** 3.
  - E1: the engine run.
  - E2: `setMode` at `:7791`.
  - E5: `headerHTML`.
- **Taken on the code refs given:** the other 5.
- **Disagreement:** none.
- **Added by this review, not by codex:** E9.

### NOT in scope

- Everything in N20-N28.
- Changing `render()`'s empty-order guard.
- Refactoring `setMode`/`step` beyond the S branches.
- Any swipe animation. That is a separate prompt, `docs/prompts/2026-09-29-card-swipe-animation.md`, and it must not edit `render()`/`step()` while S2 is open.

### Worktree parallelization

S1 and S2 are serialised: S2 calls the API that S1 adds, and both append to `app.test.js`/FLOORS. The swipe work, once planned, may run beside S2 only if it stays out of `render()`, `step()`, `setOrder()` and the footer. Otherwise it waits for S2 to merge. Whichever merges second rebases the FLOORS row.

## Decision ledger

| # | Decision | Chosen | Rationale | By |
|---|---|---|---|---|
| R1 | gstack upgrade prompt | Not now (snooze level 1) | Conservative. The upgrade is unrelated to the task | AFK auto |
| R2 | /office-hours prerequisite | Skip | The prompt file is the design input | AFK auto |
| R3 | Complexity gate (about 9 files) | Original arrangement | The file count is the repo's own test and registration obligations | AFK auto |
| R4 | Outside voice | Run (codex) | Recommended. It found 8 issues | AFK auto |
| R5 | E1-E9 resolutions | As in §8 | Each is the recommended, non-destructive fix | AFK auto |
| R6 | Golden table (O2) | Approve all (C2), all 75 rows (2026-09-29) | Musical judgement | Owner |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| Eng Review | `/plan-eng-review` | Plan before execution (global CLAUDE.md) | 1 | ISSUES_RESOLVED | 9 found, 9 resolved in plan, 0 critical gaps |
| Outside Voice | codex exec | Independent second opinion | 1 | DONE | 8, all merged (E1-E8) |

**VERDICT:** ENG REVIEW CLEARED. The owner approved the golden table on 2026-09-29 (§7), so S1 may spawn.

NO UNRESOLVED DECISIONS
