# Scale syntax, uncapped pans, one direction and the layout drawer: implementation plan (against brief rev 4)

Intended path: `docs/plans/2026-10-06-scale-syntax-and-layout-drawer.md`. This is a plan only. No code, test, data or doc file was changed and no file was written. Every probe ran as `node - <<'EOF' ... EOF` (source on stdin). The sources needed to rerun them are in Appendices A to C. Repo state measured: `main` at commit 028bcf1 (PR #253 merged), `ls tests/mutants | wc -l` = 685.

How the prior draft (written against rev 3) was used: its prototype parser (Appendix A) is reused unchanged after rerunning every check on it; its seam, parser and share-version lanes are kept; its numbers were all rerun and several were corrected (listed in section 5.9). Its claim that `data/decks.json` never changes is replaced by the Pygmy redraw (D9); its four owner questions are now answered by D13, D9, D15 and D14.

---

## 1. What this plan delivers

Today a player types a pan as `(D) A C D E F G A C`, with inner notes after a lone `/` and bottom notes as a separate list after a lone `|`. The app refuses pans over 11 rim, 2 inner or 6 bottom notes, silently moves a 12th and 13th top note to the inner ring, draws even and odd rims in opposite directions, and offers ROTATE and MOVE buttons to correct a layout.

After this plan:

1. A pan is typed the way makers list it: one ascending line, the ding in round brackets, each bottom note in square brackets where its pitch falls, and a `|` before the inner notes. Example: `[C] [D] (E) [F#] [G] [A] B [C] D E F# G A B [C] D E | F# G A`.
2. No pan is refused for size. A crowded pan draws smaller and carries a legibility warning.
3. Every generated pan runs in one direction (odd-numbered rim notes on the right). A per-deck "anchor" setting says whether note 1 sits at bottom centre or the bottom centre falls between notes 1 and 2.
4. The solver reproduces every built-in diagram from a new-grammar string. Four built-ins keep their bytes. F3 Low Pygmy's `geom` becomes solver output and its two PDFs are rebuilt.
5. The scale field wraps to three rows, the mirror is one switch called MIRROR, and a drawer on both the Add and the Edit sheet lets the player drag a note to another seat in its ring. ROTATE and MOVE go.

Terms, defined once. **Rim**: the outer ring of top notes. **Inner**: top notes inside the rim. **Bottom**: notes on the underside shell, drawn as an outer dashed ring. **Seat**: one of a ring's evenly spaced positions. **Anchor**: where note 1 sits relative to bottom centre. **Canonical string**: the one spelling the app prints for a pan. **Legacy grammar**: today's grammar. **Legacy reader**: today's parser, kept under a new name to read strings written before this plan. **Identity string**: a grammar-independent spelling that the deck id hashes. Angles are math convention: 270 is bottom centre, 315 lower right, 225 lower left, 90 top centre.

## 2. Assumed state of main when this starts

The plan starts after Lane C of `docs/plans/2026-10-06-two-beginner-decks.md` merges. Assumptions, each to be re-checked by the first lane:

- `data/decks.json` holds five decks in the order `kurd`, `amara10`, `amara`, `hijaz`, `pygmy`. Kurd 10 and Amara 10 were generated without a mirror from `(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5` and `(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5`, and their `geom` has no `ext` key (that plan's decision AD4).
- Pygmy has 53 chords (52 on main today).
- The frozen deck fixture is `golden_decks_v7.json` (v5 on main today; that plan bumps it in Lanes U2 and B). This plan's Pygmy lane writes the next version.
- `tests/mutants` holds 684 patches. This is a FORECAST: 685 measured today, and the in-flight plan states 681 after U1, 681 after U2, 683 after B, 684 after C. Every lane re-derives its base with `ls tests/mutants | wc -l`.
- Lane U2 pins D Amara 9 to an engine run with `--mirror`. That recipe changes in this plan's Lane S2 (section 7.5).

**Re-measured 2026-10-07 (eng review, R6):** main is `e749957` (Lane U1 merged). `ls tests/mutants | wc -l` prints 687 and the frozen fixture is `golden_decks_v5.json`. The figures 684 and v7 above, and every running mutant total in section 11, are therefore low by at least 3 and are forecasts only. No lane asserts them: each lane derives its base from the tree, and FLOORS and the README count come from CI.

**Re-measured 2026-10-07 at execution start (coordinator, Lane L0 amendment 1):** main is `d744071` (Lanes A, E, U1, U2, B and C of the beginner-decks plan all merged). `ls tests/mutants | wc -l` prints 690. The frozen fixture is `golden_decks_v7.json`. `data/decks.json` holds five decks in the order `kurd`, `amara10`, `amara`, `hijaz`, `pygmy`, 177 cards, and `DEFAULT_DECK` is `"kurd"`. Kurd 10 and Amara 10 ARE on main, so the stand-in sentence below is history. Every running mutant total in section 11 is low by 6 (L0 forecast: 690 to 693). As before, no lane asserts a forecast: each derives its base from the tree, and FLOORS and the README count come from CI. Where R1 names `golden_decks_v5.json`, read the fixture present at the lane's base.

Kurd 10 and Amara 10 are not on main yet. Everything this plan says about them was measured on stand-ins: today's engine run on the two strings above with default options.

## 3. Decisions

### 3.1 Owner decisions (binding, quoted or paraphrased from the brief)

- **D1** maker-style grammar: one ascending line; `[Bb3]` is a bottom note at its pitch position; the ding is `(F)`, `F/` or `F |`; bottom notes below the ding come before it; a further `|` starts the inner notes; octave digits optional, ding defaults to 3, "notes after it climb, notes before it descend".
- **D2** "The label, the placeholder, `PARSE_HINT` and every refusal string describe this one format and agree with each other." The placeholder parses. "Every format-related refusal shows a corrected example."
- **D3** the example is E Amara 20, Ayasa layout.
- **D4** "Give user legibility warning but do not limit."
- **D5** inner notes are only the ones typed after the inner bar.
- **D6** inner notes take the top of the pan and push the ding down; none means a centred ding.
- **D7** the note-1 anchor is a per-deck setting; default note 1 at bottom centre; opt-in bottom centre between notes 1 and 2 with note 1 on the right.
- **D8** "The direction of the scale sequence is the same": odd rim notes right, even left, on every generated pan.
- **D9** "Positions exact" for five built-ins. Pygmy: "Yes, redraw it." The other four keep their stored bytes.
- **D10** saved decks redraw; even rims: "Yes, flip them"; no conversion to preserve a look; saved decks must still open and must not be misread.
- **D11** a drawer on both Add and Edit with drag-to-seat within a ring, the anchor and a mirror; ROTATE and MOVE replaced; the interaction is defined by `/frontend-design:frontend-design`.
- **D12** the old octave-less bottom list now reads as inner notes: "Copy only".
- **D13** one switch labelled MIRROR, off by default.
- **D14** the field wraps to as many as three rows; the example is not shortened.
- **D15** the small-labels warning ignores bottom octave digits: "Exclude them".

### 3.2 Auto-decisions (mine; each can be overturned without reopening D1 to D15)

| # | Decision | Rationale |
|---|---|---|
| A1 | Bars are disambiguated by one lexical fact: how many ding-shaped tokens (`(X)` or `X/`) the line holds. One: at most one bar, and it is the inner bar. None: the note immediately before the first bar is the ding and a second bar is the inner bar. Two or more: refused. | The two modes accept disjoint sets of strings, so no string has two readings (4.3). |
| A2 | In the bare form every token before the ding must be bracketed. `D A C \| E F` is refused, not read as "ding C". | The likeliest intent is `(D) A C \| E F`; guessing would silently build the wrong pan. |
| A3 | An inner bar needs at least one rim note before it and one inner note after it. | One canonical string per pan; refuses the empty-ring typo. |
| A4 | After the ding, an octave-less note is the lowest instance strictly above the previous note ON THE LINE, bracketed or not, bar or not. Before the ding, inference runs right to left: each octave-less note is the highest instance strictly below the note to its right. | "After climbs, before descends" with nothing special-cased. A bracketed note among top notes, and a bottom note typed after the inner notes, both simply continue the climb. |
| A5 | Ordering: every note is at or above the previous note on the line; strictly above the last note of its own shell; every top note strictly above the ding; a bottom note after the ding strictly above the ding. Equal pitch is allowed only between a bottom note and a top note (or the ding, bottom note first) and only when the octave is typed. | Every pan the legacy grammar could express stays expressible (5.2). |
| A6 | Canonical form: ding as `(X3)`, octaves always, one merged pitch-ordered line, a bottom note before an equal-pitch top note or ding, the bar immediately before the first inner note. | One spelling per pan; round trip measured at zero failures. |
| A7 | The lexer accepts octave `-1`. | Descending inference can reach octave -1; the range message already says "between C-1 and G9". |
| A8 | The deck id hashes the identity string (today's `formatSeed` algorithm, generalised), not the new canonical string. | Every existing id stays the same (0 differences in 50,731 legacy strings). |
| A9 | Legacy strings are recognised by VERSION TAG only, never by inspecting the string. | A legacy string can be a valid new string with a different meaning (D12's case), so content sniffing cannot work. |
| A10 | Two share/record version bumps, one per shipping lane: version 3 adds the anchor and per-ring seats (scale line still legacy grammar); version 4 switches the scale line to the new grammar. | Every merge leaves main coherent; a version costs one character. |
| A11 | Bottom field ids start at `max(101, topCount + 1)`, and "is this a bottom field" reads the zone, never `id >= 101`. | Ids are unchanged for every pan under 101 top notes; no collision above it. |
| A12 | An arrangement is three permutations, one per ring (`seats: {rim, inner, bottom}`). A cross-ring arrangement cannot be written down. | Makes D11's "same ring" a property of the data rather than of every caller. |
| A13 | Inner seats: one note at 90; two at 128 and 52; three or more fanned on the inner orbit, symmetric about top centre, step `min(76, 180/(k-1))`, dealt from the two ends inward (first inner note far left, second far right, highest at or nearest top centre). | Two lands exactly on Pygmy. The D3 example puts A5 at top centre, where Ayasa's diagram shows it. A 180 degree span keeps fields largest (5.5). |
| A14 | The ding offset is adaptive: start at 0.1425 and raise it in steps of 0.0025 until every inner index number is 0.01 clear of the ding, to a ceiling of 0.30. | A fixed per-count table fails at other rim counts (5.5). Pygmy stays at 0.1425. |
| A15 | `TOO_MANY_RIM` is REMOVED from `REASONS`. The legibility warning is a new warning code, `SMALL_LABELS`. | Reusing an error code as a warning would change its meaning under every test and mutant that names it. |
| A16 | The warning counts four glyph classes at print scale: top note name, top octave digit, index number, bottom note name. It shows on the sheet (live, before GENERATE, and after) and in the title-card blurb. It gets no chord-card badge: `CARD_WARNINGS` stays as it is. | D15 fixes the glyphs. Crowding is visible on every card already; a badge would cost label room on exactly the cards that lack it. |
| A17 | The share payload cap rises from 640 to 4096 characters and the two-digit limit in `ORDER_RE` goes. | A size cap on a link is a size refusal (D4). |
| A18 | The drag primitive handed to the design step is SWAP: dropping note A on note B's seat exchanges the two. | One drag changes exactly two notes; every arrangement is reachable. The design step may choose insert-and-shift; the data model supports both. |
| A19 | A stored record whose legacy flat order crosses rings opens with the default arrangement; a share link carrying one is refused. | Boot must never drop a deck (D10); links are untrusted input. The shipped ROTATE and MOVE stay inside one ring (`zoneBlock`), so no player-made record has one. |
| A20 | An old stored `mirror: true` is read as MIRROR on. No conversion. | D10: "No conversion to preserve a look." Consequence stated in 5.3. |
| A21 | The Pygmy field `fields` block is not touched; only the keys of `geom` change. The recipe and a test tie `geom` to an engine run. | D9: "`fields` angles unchanged". |
| A22 | MIRROR becomes one switch in place in Lane W1 and is moved into the drawer by Lane DR1, keeping its element id. | The old pair's words are wrong the moment D8 lands; the drawer arrives several lanes later. |

### 3.3 Open owner questions

| # | Question | Options | Recommendation | Blocks |
|---|---|---|---|---|
| Q1 | Does the redrawn Pygmy `geom` carry the solver's `ext` key (1.462)? Today no built-in has `ext`; the app derives the drawing extent from other keys (147.68 units for Pygmy), the in-flight plan strips `ext` from Kurd 10 and Amara 10 (its AD4), and the test "the built-in decks keep the derived extent they have always rendered" in `tests/app.test.js` forbids the key. | (a) Solver output minus `ext`: the picture frame stays `-147.68 -147.68 295.36 295.36`, 100 of 374 numbers in the no-chord drawing move, by at most 0.36 units. (b) Solver output with `ext`: the frame becomes `-146.2 -146.2 292.4 292.4`, 104 of 374 numbers move, by at most 2.96 units, the pan fills about 1% more of the card, and that test is rewritten to exempt Pygmy. | (a). It matches how the other two engine-made built-ins are stored, keeps one rule for all five, and keeps the line count of `data/decks.json`. "No hand-kept geometry" still holds: every remaining key is engine output. | Lane P1 only. |
| Q2 | Pygmy's printed pan. The built-in print radius is a literal 60 in Pygmy's print overlay; the solver's own choice for the same pan would be `round(74/1.462, 1)` = 50.6. The brief puts replacing print overlays out of scope, so the plan keeps 60, and Pygmy's printed top circles grow 2.2% with the on-screen ones. | (a) keep 60 (in scope); (b) a follow-up that derives the print radius for built-ins. | (a), with (b) recorded as a follow-up next to the bottom-octave-digit follow-up. | Nothing. |

### 3.4 Owner answers to 3.3 (2026-10-06, binding)

- Q1: "Keep today's frame". The redrawn Pygmy `geom` is solver output minus `ext` (option a everywhere in Lane P1).
- Q2: "Keep 60". Pygmy's print radius literal stays.
- Saved even-rim deck stored with `mirror: true` opens reversed with MIRROR on: "Accept, note in README". A20 stands; no conversion.

## 4. The grammar, exactly

### 4.1 Tokens

Insert a space either side of every `|`, then split on whitespace (a pasted line break is whitespace). Each token is one of:

| Class | Shape | Notes |
|---|---|---|
| BAR | `\|` | Self-delimiting: `F\|G` is `F`, `\|`, `G`. |
| SLASH | a lone `/` | Always refused, with the "old inner mark" sentence. |
| DING | `(NOTE)` or `NOTE/` | A token that starts with `(`, or ends with `)` or `/`, is ding-shaped; if its body is not a note it is refused. |
| BOTTOM | `[NOTE]` | A token that starts with `[` or ends with `]` is bottom-shaped; one note per bracket pair, no spaces inside. |
| NOTE | `NOTE` | |

`NOTE` is a letter A to G, an optional `#` or `b`, and an optional octave `-1` or `0` to `9`. A token that is both ding-shaped and bottom-shaped (`[(D)]`) is refused.

### 4.2 Structure

Let d be the number of DING tokens and b the number of BARs.

- d = 1 (**explicit ding**): b is 0 or 1. The bar, if present, comes after the ding and is the inner bar.
- d = 0 (**bare ding**): b is 1 or 2. The token immediately before the first bar must be a NOTE; it is the ding. The second bar, if present, is the inner bar.
- d of 2 or more: refused.

In both forms every token before the ding is a BOTTOM token, and an inner bar has at least one rim note before it and at least one inner note after it. Zones: a BOTTOM token is a bottom note wherever it stands; a NOTE after the ding is rim before the inner bar and inner after it. There is no spill (D5). Field ids: ding `0`; top notes `1..n` in line order (rim, then inner); bottom notes from `max(101, n + 1)` in line order, labelled `U1`, `U2`, and so on.

### 4.3 Why no string is ambiguous

The count d is a fact about the characters, not a choice, and the three cases share no string. Within a case the parse reads left to right with no alternative: the ding position is fixed (the one DING token, or the token before the first bar), each bar's role is fixed by its index, and each note's zone is fixed by its brackets and its side of the inner bar.

Measured with the prototype (Appendix A): all 1,111,110 token sequences of length 1 to 6 over the alphabet `| (D) D/ [A] [C3] A C D E4 /`. 7,392 are accepted (6,542 explicit, 850 bare). Every accepted string's canonical form re-parses to the same fields and re-prints identically (0 failures). The 3,443 distinct canonical strings each map to exactly one field set. All 850 bare strings, rewritten with `(X)` in place of `X |`, give the same fields (0 mismatches).

### 4.4 Octave inference and ordering

As A4 and A5. Two cases the brief asks about by name:

- **A bracketed note among top notes** takes part in the climb like any other note. In `(D) A [B] C`, B is B3 (above A3) and C is C4 (above B3). The same rule gives Pygmy's `[Bb]` between `Ab` and `C`.
- **A bottom note typed after the inner notes** continues the climb from the last inner note. Pygmy's trailing `[Ab]` after `| F G` is Ab5.

A fifth above the ding must still exist among the top notes (`NO_FIFTH`, unchanged).

### 4.5 Table of strings (every row was run through the prototype)

| # | String | Result |
|---|---|---|
| 1 | C# Hijaz 9: `(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4` | ding C#3; rim G#3 B3 C#4 D4 F4 F#4 G#4 B4. 9 of 9 shipped fields equal (name, octave, MIDI, zone, label). |
| 2 | Same, short: `(C#) G# B C# D F F# G# B` | same pan |
| 3 | Same, bare: `C# \| G# B C# D F F# G# B` | same pan |
| 4 | F3 Low Pygmy 18 (D9's string): `[C3] [Db3] [Eb3] F3 \| G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 \| F5 G5 [Ab5]` | ding F3; rim G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5; inner F5 G5; bottom C3 Db3 Eb3 Bb3 Db4 Ab5 as U1 to U6. 18 of 18 shipped fields equal. Canonical (78 characters): `[C3] [Db3] [Eb3] (F3) G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 \| F5 G5 [Ab5]` |
| 5 | Pygmy, no octaves: `[C] [Db] [Eb] F \| G Ab [Bb] C [Db] Eb F G Ab C Eb \| F G [Ab]` | same pan |
| 6 | D Amara 9: `(D3) A3 C4 D4 E4 F4 G4 A4 C5`; also `D/ A C D E F G A C` and `D \| A C D E F G A C` | ding D3; rim A3 C4 D4 E4 F4 G4 A4 C5. 9 of 9 shipped fields equal. |
| 7 | D Kurd 10: `(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5` | ding D3; nine rim notes |
| 8 | D Amara 10: `(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5` | ding D3; nine rim notes |
| 9 | E Amara 20 (D3): `[C] [D] (E) [F#] [G] [A] B [C] D E F# G A B [C] D E \| F# G A` | ding E3; rim B3 D4 E4 F#4 G4 A4 B4 D5 E5; inner F#5 G5 A5; bottom C3 D3 F#3 G3 A3 C4 C5. Exactly the D3 pitches. Typed form 60 characters; canonical 80. |
| 10 | Xenith line from D1: `[C#3] [D#3] F3 \| G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 F5 G5` | ding F3; rim (11) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 F5 G5; no inner; bottom C#3 D#3 Bb3 Db4. Canonical 65 characters. |
| 11 | `F\|G Ab C` | ding F3; rim G3 Ab3 C4 |
| 12 | `(D3) A3 [C4] C4 D4` | bottom C4 and top C4 coexist |
| 13 | `[D3] (D3) A3 C4` | a bottom note at the ding's pitch, written first |
| 14 | `(C3) D E F G A B C D E F G A B` | thirteen rim notes, no inner (no spill) |
| 15 | `(D) A [B] \| C` and `(D) A \| [B] C` | the same pan; canonical `(D3) A3 [B3] \| C4` |
| 16 | `(D) A C \| E [F] G` | inner E4 G4, bottom F4 |
| 17 | `(D) A C D E F G A C \| A B C` | ACCEPTED: inner A5 B5 C6. This is the legacy bottom list typed without octaves (D12; section 6.4). |
| 18 | `D A C D E` and `D A C \| E F` | refused `NO_DING`, "which" sentence |
| 19 | `C (D) A` | refused `NO_DING`, "below" |
| 20 | `(D) (A) C` | refused `NO_DING`, "two" |
| 21 | `(D3) A3 C4 D4 E4 F4 G4 / A4 C5` | refused `BAD_NOTE`, "slash" |
| 22 | `(D) A [C D] E` | refused `BAD_NOTE`, "bracket" |
| 23 | `(D) A \| C \| E` and `D \| A \| C \| E` | refused `BAD_NOTE`, "bar" |
| 24 | `(D) \| A C`, `(D) A C \|`, `(D) A C [E] \| [F]` | refused `BAD_NOTE`, "barEmpty" |
| 25 | `(D3) A3 C4 D4 \| C3 E3` | refused `NOTE_OUT_OF_ORDER`, "afterBar" (legacy bottom list with octaves) |
| 26 | `(D3) A3 C3` | refused `NOTE_OUT_OF_ORDER`, base sentence |
| 27 | `(D3) C3 A3` and `(D3) [D3] A3` | refused `NOTE_OUT_OF_ORDER`, "ding" |
| 28 | `[E3] (D3) A3` and `[D3] [C3] (E3) B3` | refused `NOTE_OUT_OF_ORDER`, "below" |
| 29 | `(D3) A3 A3 C4`; `(D) A C D E F G A C \| C5` | refused `NOTE_REPEATED` |
| 30 | `(D) A H C` | refused `BAD_NOTE`, base sentence |
| 31 | `(D9) A9 C` | refused `NOTE_OUT_OF_RANGE` |
| 32 | `(D) C E F`; `D \|` | refused `NO_FIFTH` |

The sentence each refusal carries is in section 9. D3's caveat, as the brief requires: reading A5 as an inner note comes from Ayasa's diagram, where it sits in the top gap; Sound-Sculpture and Sela sell the same 20 pitches. The Ayasa and Xenith pages were not opened in this session.

## 5. Findings (all measured this session unless marked)

### 5.1 The solver under the new rules against the shipped diagrams (D9)

Method: Appendix B patches applied in memory, each deck's string parsed with Appendix A, the result drawn through the app's own `pan()` (booted with `tools/sandbox.js`) for every chord and for the no-chord drawing, and compared with the shipped deck's drawing.

| Deck | Seats matching | Drawings identical | `geom` keys that differ from solver output |
|---|---|---|---|
| C# Hijaz 9 (8 rim), default options | 8 of 8 | 20 of 20 (19 chords and the no-chord drawing) | `f_ding` 0.135 stored against 0.12; `f_note` 0.128 against 0.1454; `f_num` 0.105 against 0.1216. The solver also emits `inner` 0, `bottom` 0, `ding_dy` 0, `rim_num_out` false, `ext` 1.06 where the stored deck has no key. No renderer reads any of these on a rim-only deck. |
| D Amara 9 (8 rim), default options | 8 of 8 | 26 of 26 | same as Hijaz |
| D Kurd 10, D Amara 10 stand-ins (9 rim), default options | 9 of 9 | identical seats and identical `geom` to today's unmirrored engine run, which is how the in-flight plan makes them | none beyond the stripped `ext` |
| F3 Low Pygmy 18, anchor "between" | 17 of 17 (rim, F5 at 128, G5 at 52, U1 to U6 at 300 240 0 180 60 120) | 0 of 53: every drawing changes | `r_note` 0.1425 stored against 0.1456; `f_note` 0.109 against 0.1114; `f_num` 0.0912 against 0.0932; `inner_ring` null against 0; `ext` absent against 1.462 |

Controls: Pygmy with the default anchor seats 8 of 17 (every rim seat is 20 degrees off), which is why the anchor option exists. Today's unpatched solver already seats Pygmy 17 of 17 with no mirror and 1 of 17 with mirror true.

Why bottom seats fall out: the new line lists bottom notes in pitch order (C3 Db3 Eb3 Bb3 Db4 Ab5) and `bottomAngles` deals seats in line order, unchanged.

The redrawn Pygmy `geom`, in full (solver output; the `ext` key is Q1):

`{"rim":0.722,"inner":0.38,"bottom":1.15,"r_ding":0.19,"ding_dy":0.1425,"r_note":0.1456,"r_bnote":0.1188,"inner_ring":0,"f_ding":0.114,"f_note":0.1114,"f_bnote":0.0931,"f_num":0.0932,"n_in":0.052,"n_out":0.068,"rim_num_out":true,"ext":1.462}`

Effect on the no-chord drawing (374 numbers in the SVG): with `ext` kept, 104 numbers move, by at most 2.96 units, and the frame changes from `-147.68 -147.68 295.36 295.36` to `-146.2 -146.2 292.4 292.4`; with `ext` dropped, 100 numbers move, by at most 0.36 units, and the frame is unchanged. The brief states the frame change in the opposite direction; the stored-deck fallback is the larger one.

### 5.2 Legacy strings and ids

- 400,000 random legacy strings (both ding forms, optional `/`, optional bottom list, typed and untyped octaves): 50,731 accepted by today's `core.parseSeed`. For every one, the identity string equals today's `formatSeed` output (0 differences) and the new canonical string re-parses to the same field map (0 failures). 28,750 of them have a new canonical string equal to the legacy string.
- The identity string is injective on new-only shapes: over the 7,392 accepted strings of the enumeration there are 3,443 distinct identity strings and 0 clashes. It prints ` /` whenever the rim count differs from `min(topCount, 11)`, so a new 12-rim pan and a legacy 11-plus-1 spill pan get different ids.
- 100,000 random strings with neither a lone `/` nor a `|`, at most 11 top notes: 4,725 accepted by both grammars, 0 with differing fields, 0 accepted by only one. `tools/gen_deck.js` presets and the Kurd 10 and Amara 10 strings need no change.
- Ids on main, for lane tests to pin: C# Hijaz `custom:626198f8`, Pygmy `custom:6f9ffc33`, Amara 9 `custom:977311b5`, Kurd 10 `custom:cb5fe66a`, Amara 10 `custom:b174242c`. The E Amara 20 example gets `custom:8c15ebd7`; today's parser refuses its identity string with `TOO_MANY_RIM` (three inner notes).
- Storage: custom decks live in the saved-scales list as records `{v, s, o}` (share version, canonical string, options). `rememberScale`, `forgetScale` and `replaceScale` find a record by comparing `s`. The only thing stored against a deck id is the selected deck. There is no per-deck progress store. Ids do not move, so the selection survives.

### 5.3 What redraws for saved decks (D10)

Today's solver against the new default, with the stored `mirror` read as stored:

| Saved deck shape | What changes |
|---|---|
| Odd rim, no inner notes (either mirror value) | Nothing. |
| Even rim, with or without inner notes (either mirror value) | **Changes sides.** Every rim note except note 1 (270) and the top note (90) swaps left and right. Example, 8 rim, unmirrored: 270 315 225 0 180 45 135 90 becomes 270 225 315 180 0 135 45 90. Field sizes are unchanged. |
| Odd rim with inner notes | Sides are kept. Every rim note turns half a step (20 degrees on a 9 rim), so note 1 lands on bottom centre and the top note leaves 90. Fields grow (9 rim plus 2 inner: `r_note` 0.1456 to 0.1612). |
| Exactly one inner note | That note moves from 128 to 90. |
| Two inner notes; any bottom notes | Unchanged (128 and 52; `bottomAngles` untouched). |

So the saved decks that change sides are exactly the even-rim ones. One consequence deserves plain words: a player who saved an 8-rim deck with LEFT-FIRST on (stored `mirror: true`) to make it look like Amara will see it reversed, with MIRROR shown on; switching MIRROR off restores the Amara look. D10 forbids a conversion, so the README says this instead.

A saved correction (`order`) is a permutation over default seats; it is kept and applied to the new seats (section 8).

### 5.4 Legibility (print, generated decks, floor 3.6 pt)

Print sizes follow the shipped rule: print radius R = `round(74 / ext, 1)`; top name = 0.80325 x `r_note` x R; bottom name = 0.8232 x `r_bnote` x R; octave digit = 0.66 x its name; index number = 0.64 x `r_note` x R.

| Sweep (new seat rule) | Glyph | First count under 3.6 pt |
|---|---|---|
| Rim only (`r_note` 0.19 through 10 rim, 0.1783 at 11) | top octave digit | 21 rim (3.48 pt) |
| Rim only | index number | 25 rim (3.55) |
| Rim only | top name | 31 rim (3.59) |
| Rim with any bottom shell (R about 49.9) | octave / number / name | 15 / 19 / 23 rim |
| Rim n with 2 inner | top octave digit | 20 rim (15 rim with 6 bottom) |
| 7 to 12 rim with k inner, no bottom | octave / number / name | 7 / 8 / 9 inner |
| 7 to 12 rim with k inner and 7 bottom | octave / number / name | 5 / 6 / 7 inner |
| 9 rim with m bottom (`r_bnote` 0.1188 through 24) | bottom name | 36 bottom (3.58) |
| 9 rim with m bottom | bottom octave digit | 1 bottom (3.22 pt), excluded by D15 |

Reference points: the D3 example prints at R 50.4 with top name 6.40, top octave 4.22, number 5.10, bottom name 4.93, bottom octave 3.25 and ding 6.79 pt, so it carries no warning. A generated Pygmy shape prints top octave 3.91 pt and bottom octave 3.27 pt, so no warning either.

Grid of 2,002 pans (rim 3 to 24, inner 0 to 6, bottom 0 to 12): 1,162 warn under the proposed trigger; 1,882 would warn if bottom octave digits counted. That difference is what D15 buys.

Proposed trigger: warn when the smallest of {top name, top octave digit, index number, bottom name} at print scale is under 3.6 pt. In effect `min(0.5301 x r_note, 0.8232 x r_bnote) x R < 3.6`, because the top octave digit (0.66 x 0.80325 = 0.5301) is always the smallest top glyph.

"Never refuse" still draws: 60 rim; 100 rim with 10 inner and 40 bottom; and 150 rim with 20 inner and 60 bottom all solve. Over 9,360 pans (rim 1 to 60, inner 0 to 12, bottom 0, 1, 2, 7, 13, 40, both anchors, with the fan and the adaptive offset) there are 0 overlapping circle pairs and 0 duplicate seats; the smallest top gap is 0.0114 R and the smallest bottom gap 0.0271 R.

On-screen legibility at 380 px was NOT measured (UNVERIFIED); it is an input to the design step.

### 5.5 Inner ring for N notes (D6)

Fan as in A13. Seats in note order: one inner note, 90; two, 128 and 52; three, 166 14 90; four, 180 0 120 60; five, 180 0 135 45 90; six, 180 0 144 36 108 72.

Why the ding offset must adapt. `pan()` draws every inner note's index number inward of its circle, toward the ding. Modelling that number as a disc of radius 0.7 x `f_num` (Appendix C), the clearance from the ding at the fixed offset 0.1425 on a 9 rim is about 0 for three inner notes (minus 0.014 at worst), minus 0.023 to minus 0.030 for four (it collides), plus 0.004 for five, and clear from six up. A fixed table by inner count (0.1425, 0.175, 0.2) fails across rim counts 5 to 20: the worst case is minus 0.027 with three inner notes, and minus 0.010 with two inner notes on small rims. That last case exists on main today, for rims of 1 to 5 with one or two inner notes.

The adaptive rule (A14) over the same 9,360 pans: 0 numbers still touching; largest offset 0.22; 612 pans get an offset above 0.1425 (by inner count: 30, 42, 156, 192, 192 for one to five). With one or two inner notes only rims of 1 to 5 are affected (offsets 0.1475 or 0.165). Pygmy keeps 0.1425 (clearance 0.052).

Fan span compared, 9 rim, 7 bottom, anchor "one" (`r_note`; print octave digit in pt):

| Inner notes | span 120 | span 140 | span 152 | span 180 (chosen) |
|---|---|---|---|---|
| 3 | 0.1453; 3.90 | 0.1504; 4.03 | 0.1580; 4.22 | 0.1580; 4.22 (offset 0.175) |
| 4 | 0.1105; 3.00 | 0.1278; 3.45 | 0.1380; 3.71 | 0.1504; 4.03 (offset 0.20) |
| 5 | 0.0836; 2.29 | 0.0971; 2.65 | 0.1052; 2.86 | 0.1236; 3.34 (offset 0.155) |
| 6 | 0.0672; 1.85 | 0.0781; 2.14 | 0.0847; 2.32 | 0.0998; 2.71 |

A narrower fan keeps the default offset but shrinks every field; 180 with the adaptive offset gives the largest labels at every count, so it is the choice. One limit to state: `r_note` is one number for rim and inner fields, so five or more inner notes shrink the rim fields too.

Results under the full rule:

- **D3 example, anchor "one"**: rim 1 to 9 at 270 230 310 190 350 150 30 110 70; inner F#5 at 166, G5 at 14, A5 at 90; bottom U1 to U7 at 295.7 244.3 347.1 192.9 38.6 141.4 90; ding offset 0.175; `r_note` 0.158; `r_bnote` 0.1188; `f_note` 0.1209; `f_num` 0.1011; `ext` 1.4676; modelled clearance 0.011. With anchor "between": offset 0.155, `r_note` 0.1453, `ext` 1.4619.
- **Xenith line** (11 rim, 4 bottom): rim 270 237.3 302.7 204.5 335.5 171.8 8.2 139.1 40.9 106.4 73.6; bottom 315 225 45 135; `r_note` 0.1783; `ext` 1.4767; centred ding.

**All clearance figures are a model. No pan was rendered (UNVERIFIED).** The rendered proof is the named gate G-RENDER in Lane S1.

### 5.6 Blast radius

Counts are matches from `grep -rEo "<pattern>" <place> | wc -l`, run from the repo root, where the places are `src`; `index.html`; `tests` restricted to `*.js` and `*.py`; `tests/mutants` (with the number of patch files from `grep -rlE`); `tests/fixtures`; `tools`; and `CLAUDE.md README.md docs/*.md`.

| Pattern | src | index.html | tests | mutants (files) | fixtures | tools | docs |
|---|---|---|---|---|---|---|---|
| `RIM_MAX` | 8 | 8 | 0 | 4 (4) | 0 | 0 | 0 |
| `INNER_MAX` | 5 | 5 | 0 | 4 (4) | 0 | 0 | 0 |
| `BOTTOM_MAX` | 4 | 4 | 0 | 4 (3) | 0 | 0 | 0 |
| `TOP_MAX` | 2 | 2 | 0 | 2 (1) | 0 | 0 | 0 |
| `TOO_MANY_RIM` | 6 | 6 | 20 | 6 (4) | 6 | 1 | 11 |
| `PARSE_HINT` | 0 | 4 | 6 | 3 (3) | 1 | 0 | 0 |
| `LAYOUT_HINT` | 0 | 3 | 0 | 4 (3) | 0 | 0 | 0 |
| `moveNote` | 0 | 4 | 0 | 5 (3) | 0 | 0 | 0 |
| `rotateLayout\|rotateRing` | 0 | 4 | 0 | 9 (4) | 0 | 0 | 0 |
| `scale-rot-` | 0 | 4 | 21 | 4 (1) | 0 | 2 | 0 |
| `scale-move-` | 0 | 4 | 11 | 2 (1) | 0 | 2 | 0 |
| `scale-mirror-` | 0 | 4 | 21 | 0 | 0 | 2 | 4 |
| `scale-layout-` | 0 | 13 | 25 | 28 (11) | 0 | 2 | 0 |
| `LEFT-FIRST\|RIGHT-FIRST` | 0 | 4 | 10 | 1 (1) | 0 | 0 | 7 |
| `left-first\|right-first` | 2 | 3 | 10 | 3 (2) | 0 | 0 | 11 |
| `INNER_ANGLES` | 2 | 2 | 0 | 2 (1) | 0 | 0 | 0 |
| `rimAnglesFromBottom` | 2 | 2 | 0 | 1 (1) | 0 | 0 | 0 |
| `isCentred` | 4 | 4 | 0 | 2 (2) | 0 | 0 | 0 |
| `CAPS\.payload` | 2 | 2 | 6 | 1 (1) | 0 | 0 | 0 |
| `ORDER_RE` | 2 | 2 | 0 | 1 (1) | 0 | 0 | 0 |
| `>= ?101\|> ?100` | 1 | 1 | 5 | 0 | 0 | 0 | 0 |
| `scale-box` | 0 | 10 | 53 | 7 (2) | 0 | 4 | 4 |
| `reseat` | 2 | 2 | 0 | 2 (1) | 0 | 0 | 0 |

Scale-string literals. Old inner mark, pattern `[A-G][#b]?[0-9]? ?/ [A-G][#b]?[0-9]?`: `tests/core.test.js` 25, `tests/preview.test.js` 2, `tests/layout.test.js` 1, `tests/test_print.py` 1, `tools` 2, `docs/plans` 25, none in `src`, README or CLAUDE.md. Bar followed by a note, pattern `[A-G][#b]?[0-9] \| [A-G]`: `tests/fixtures` 11, `tests/mutants` 24, `index.html` 1, none in test sources, tools, `src`, README or CLAUDE.md. Pygmy's print overlay also holds two legacy-looking blurb lines (`"F3 | G3 Ab3 C4 ..."` and `"BOTTOM:  C3  Db3 ..."`); they are printed text, not parsed, and the print overlay is out of scope.

Mutants by target file (`grep -l "^+++ b/<file>" tests/mutants/* | wc -l`): `index.html` 417, `src/engine/core.js` 29, `select.js` 17, `tools/hifi.py` 17, `pdfcards.js` 15, `layout.js` 14, `data/decks.json` 14, `share.js` 12, `tools/decks.py` 7, `tools/sandbox.js` 5, `pdfdeck.js` 4, `tools/gen_deck.js` 3, `README.md` 1.

Mutants naming symbols this plan edits (`grep -lE`):

- Seat functions: `g_bottom_anchor_dropped`, `g_centred_default_ignored`, `g_inner_pair_with_rim`, `l_order_ignored`.
- ROTATE, MOVE and selection: `ap2_sheet_state_layout_sel_leaks`, `d_layout_stale_order_guard`, `d_layout_reset_identity`, `d_rotate_drops_the_selection`, `f6_pan_home_end_swapped`, `e_layout_reset_inert`, `e_layout_rotate_inert`, `qa_layout_prologue_skips_sync`, `qa_select_pan_field_ignores_order`, `r3s_served_id_not_in_markup`.
- Mirror labels: `d_mirror_ignored`.
- Hints: `d_empty_box_shows_no_example`, `d_layout_hint_deleted`, `d_disarm_skips_placeholder_repaint`, `d_layout_hint_only_a_comment`, `d_hint_every_time`, `d_warnings_rebuild`, `e_empty_box_drops_the_pan`, `d_upsert_says_generated`, `e_layout_hint_outside_its_group`.
- Caps: `b_engine_desync`, `g_bottom_cap_seven`, `g_mirror_ignored`, `u_flat_raises_midi`, `u_reason_string_reworded`, `u_inner_cap_unenforced`.
- Spill: `u_inner_mark_ignored`, `u_inner_mark_unprinted`.
- Order: `ap3_slotzones_reversed`, `eg_slotorder_swapped`, `g_mirror_ignored`, `l_order_length_unchecked`, `l_order_ignored`, `s_share_v1_delta_accepted`, `s_share_order_unchecked`.
- Field styling: `f6_scale_box_media_override`, `f6_scale_box_font_override`.

Sites that assume a bounded count: the cap constants and the three cap lines in `layout.solve`, the two-entry `INNER_ANGLES`, the bottom id base 101, `ORDER_RE` (two digits), and the 640 payload cap. `pan()`, `tools/hifi.py` and the PDF modules loop over whatever fields a deck has; the PDF modules were checked by grep only.

Sheet facts that matter to the lanes: `#scale-box` is an `<input type="text">` whose Enter key calls `runGenerate`; `showPlaceholderPan` parses the element's `placeholder`; `parseLineText` writes the line under the box as `Ding D3 | 1 A3 2 C4 ...` (it uses a bar as a separator, which will now contradict the grammar); `tools/sandbox.js` keeps a strict `ELEMENT_IDS` list, so every id added or removed must be mirrored there.

### 5.7 Share payload

The wire format is one version character, the payload in a 6-bit alphabet, and a 6-character check: length = 1 + ceil(8/6 x bytes) + 6. Measured with the shipped encoder: Pygmy (legacy canonical, 68 characters) encodes to 114 characters, and to 167 with a 40-character name. ESTIMATES from the formula: the D3 example in the new canonical form (80 characters) about 127, or about 245 with a name and every seat rearranged; a 60-note pan about 607; a 127-note pan about 1,290. A pan using every MIDI pitch on both shells with all seats rearranged is under 4,096. Hence A17.

### 5.8 Drag targets

`panHitRadii` caps each hit target at half the distance to its nearest neighbour, with a 44 px floor (`PAN_HIT_MIN_PX`) where there is room. The preview is at most 300 px wide with padding, so the pan is about 284 px (ESTIMATE; no browser was run).

| Pan | Tightest pair | Target at 284 px | Target at 340 px | Pan width needed for 44 px |
|---|---|---|---|---|
| D3 example (9, 3, 7) | rim to inner, 0.372 R | 36 px | 43 px | 348 px |
| Pygmy (9, 2, 6) | rim to inner, 0.342 R | 33 px | 40 px | 376 px |
| Kurd 10 (9 rim) | rim to rim, 0.510 R | 68 px | 82 px | 184 px |
| 12 rim | 0.386 R | 52 px | 62 px | 242 px |
| 16 rim | 0.291 R | 39 px | 47 px | 321 px |
| Xenith (11, 0, 4) | rim to bottom, 0.410 R | 39 px | 47 px | 317 px |
| 20 rim, 2 inner, 8 bottom | 0.226 R | 22 px | 27 px | 561 px |

Bottom-shell pans and crowded pans fall under 44 px at any phone width, so a non-drag path (tap a note, then tap a seat; and a keyboard path) is mandatory.

### 5.9 Corrections to the prior draft and the brief

- The draft said `data/decks.json` is unchanged; under rev 4 Pygmy's `geom` changes.
- The draft's fixed ding-offset table (0.175 for three inner notes, 0.200 for four) holds only at 9 rim; replaced by A14.
- The draft's share lengths for Pygmy (107 and 161) reran as 114 and 167.
- The brief gives the Pygmy frame change backwards (5.1).
- Pygmy has 52 chords on main, so 53 drawings; after the in-flight Lane U2 it has 53 chords, so 54.

## 6. Old strings

### 6.1 Where legacy strings live

Stored records (version 1 or 2); share links of version 1 and 2; test sources, fixtures, mutant patches, tools and plan documents (counts in 5.6).

### 6.2 How each keeps opening

- **Stored records**: by version tag, then a one-time rewrite. A record with `v` of 3 or lower is read by the legacy reader (today's `tokenize`, `validate`, `assemble` and spill, kept as `parseLegacySeed`). It yields the same field map as today and so the same id. At boot the record is then rewritten in place, at the same list index, as a version 4 record holding the new canonical string.
- **Record lookups** (`rememberScale`, `forgetScale`, `replaceScale`) compare deck ids computed through each record's own reader, not `s` against `formatSeed`. Otherwise deleting a deck whose record has not been rewritten would miss it and the deck would return on reload.
- **Share links**: `share.decode` picks the scale-line reader from the link's version: 1 to 3 legacy, 4 new. A legacy flat order is converted to per-ring seats, or the link is refused if it crosses rings (A19).
- **An old cached copy of the app** meeting a version 3 or 4 record skips it (`checkShareVersion` answers `NEEDS_NEWER_APP`) and leaves it in storage; meeting a newer link it shows "This link needs a newer version of the app. Reload."
- **Tests, fixtures, tools, docs**: existing legacy-grammar tests are retargeted at `parseLegacySeed` (they go on proving the reader); new-grammar tests sit beside them.

### 6.3 Proof obligation

No stored deck loses its id or its selection: section 5.2's zero counts, reproduced in the suite as a frozen fixture of legacy strings with ids captured from main before any change (Lane L0), still green after the flip (Lane G2b).

### 6.4 What a player who types the old form sees

- A lone `/`: refused with "A lone / is the old way to mark inner notes. Use | now, e.g. (D) A C D | E F."
- A bottom list with octaves, `(D3) A3 C4 D4 | C3 E3`: refused with the "afterBar" sentence, which shows the bracket form.
- A bottom list WITHOUT octaves, `(D) A C D E F G A C | A B C`: **accepted, as three inner notes A5 B5 C6**. Per D12 this is handled by copy only. The player's signals are the count line (`... 3 inner · 0 bottom`), the live preview (three notes inside the rim, no dashed ring, ding pushed down) and the last sentence of the hint.

## 7. Solver changes (D6, D7, D8, D9)

### 7.1 Rim seats: one rule for both parities

With step = 360 / n and i counting from 0: anchor `one` gives `270 + s x ceil(i / 2) x step`; anchor `between` gives `270 + s x (floor(i / 2) + 0.5) x step`; s is +1 for even i and -1 for odd i (in the app's convention a larger angle from 270 moves to the right). `rimAngles` and `rimAnglesFromBottom` are replaced by this one function.

- **What changes for even rims**: today an even rim puts note 2 on the right. Now note 2 is on the left, which is Hijaz and Amara 9 without a mirror.
- **What the anchor does**: `one` on an odd rim leaves a gap at top centre (Kurd 10: 270 230 310 190 350 150 30 110 70); on an even rim the highest note lands at top centre (270 225 315 180 0 135 45 90). `between` on an odd rim puts the highest note at top centre (Pygmy: 290 250 330 210 10 170 50 130 90); on an even rim it leaves gaps at top and bottom centre (292.5 247.5 337.5 202.5 22.5 157.5 67.5 112.5).
- **The anchor applies with or without inner notes** (D7). Today the choice of rim function hangs on `isCentred`; that link is cut. `isCentred` keeps deciding only whether the ding is centred.

### 7.2 Bottom seats

`bottomAngles` is unchanged and deals seats in line order, which is pitch order. Pygmy's U1 to U6 fall out (5.1).

### 7.3 Inner seats and the ding offset

A13 and A14.

### 7.4 Mirror (D13, item 9)

MIRROR replaces every seat angle a with 180 minus a, on all three rings; it never changes geometry. Under D8 it is the only thing that puts odd rim notes on the left.

| Ring, state | MIRROR off | MIRROR on |
|---|---|---|
| Rim, anchor one, 8 notes | 270 225 315 180 0 135 45 90 | 270 315 225 0 180 45 135 90 |
| Rim, anchor one, 9 notes | 270 230 310 190 350 150 30 110 70 | 270 310 230 350 190 30 150 70 110 |
| Rim, anchor between, 8 notes | 292.5 247.5 337.5 ... | 247.5 292.5 202.5 ... (note 1 left of bottom centre) |
| Rim, anchor between, 9 notes | 290 250 330 ... 90 | 250 290 210 ... 90 |
| Inner, two notes | 128, 52 | 52, 128 |
| Bottom, three notes | 330 210 90 | 210 330 90 |

An old stored `mirror: true` is read as MIRROR on (A20).

### 7.5 The Amara 9 recipe after D8

Today the shipped Amara 9 seats need `--mirror`. After Lane S2 they come from the string with default options: `node tools/gen_deck.js "(D3) A3 C4 D4 E4 F4 G4 A4 C5" --out <scratch>/amara9.json`. Lane S2 changes the recipe wherever the in-flight Lane U2 left it: the test `test_amara_9_chords_equal_a_fresh_engine_run`, the regeneration notes for the golden deck fixture, and any sentence in CLAUDE.md or README that quotes the command (UNVERIFIED which sentences exist, because Lane U2 has not run; the lane finds them with `grep -rn -- "--mirror" CLAUDE.md README.md tests tools docs/ENGINE-SPEC.md`). The deck's bytes do not change.

## 8. Anchor, arrangement and mirror as data (items 7, 8, 9)

- **Anchor**: seed option `anchor`, `"one"` (default) or `"between"`. Whitelisted by the option reader in `core.js`; resolved onto `deck.options` by `select.build`; stored in the record's `o`; carried in share links from version 3 as a new field on the options line placed BEFORE the name (`palette, parent, mirror, anchor, name`), so the free-text name keeps the last slot; NOT hashed into the deck id (options never are); `tools/gen_deck.js` gains `--anchor between`. An older app can only meet it inside a version 3 or 4 link or record and answers `NEEDS_NEWER_APP`.
- **Arrangement**: seed option `seats`, an object with optional `rim`, `inner`, `bottom`, each a permutation of that ring's seat indices; entry i is the seat taken by the ring's i-th note in line order; a missing ring means the default. `layout.solve` validates each ring on its own, so no input can seat a rim note on the bottom ring, and `reseat` loses the ability to do so. On the wire (version 3 and up) the third payload line is `rim;inner;bottom`, each a comma list or empty; an all-default arrangement is the empty line, as today. The legacy flat `order` is read only from version 1 and 2 records and links and converted by one function, `seatsFromOrder(order, counts)`, which fails when any index leaves its ring. Cross-ring orders are therefore refused in three places: the solver's reader, the share decoder, and the drawer (which can only emit a swap inside one ring).
- **A drag** maps to the data as: the dragged note's ring index a and the target seat's occupant b exchange their entries in that ring's permutation. The preview re-solves and repaints on every change, as it does on every keystroke today. `moveNote` (swap with a neighbour) is this primitive restricted to adjacent seats; `rotateLayout` (cyclic shift) is a sequence of swaps. Both are deleted.
- **Mirror**: stays a boolean option and composes with `seats` as it does with `order` today: seats say who sits where, mirror reflects where the seats are. The anchor changes where the seats are and leaves the permutation alone. So an arrangement survives toggling either, which is how the drawer "holds" them.

## 9. Copy (final text; items 10, D2, D12, D13)

**Label**: `SCALE: (DING) TOP NOTES | OPTIONAL INNER NOTES`
**Second label line**: `[NOTE] = A BOTTOM NOTE, WRITTEN WHERE ITS PITCH FALLS`
Whether each fits one line at 380 px is UNVERIFIED; the design step checks it.

**Placeholder**: `[C] [D] (E) [F#] [G] [A] B [C] D E F# G A B [C] D E | F# G A` (60 characters). At 16 px in a field roughly 324 px wide it needs two rows (ESTIMATE, UNVERIFIED); D14's wrapping field shows it whole. No shorter alternative is substituted.

**Count line** (replaces the output of `parseLineText`; D12's "count line"): counts first, then the notes grouped by shell, with no bar used as a separator. For the example: `Ding E3 · 9 top · 3 inner · 7 bottom. Top B3 D4 E4 F#4 G4 A4 B4 D5 E5. Inner F#5 G5 A5. Bottom C3 D3 F#3 G3 A3 C4 C5.` All three counts are always printed, including `0 inner` and `0 bottom`. How the line wraps inside the field group is for the design step.

**`PARSE_HINT`**: "Type every note low to high on one line. Put the ding in round brackets: (D). Put each bottom note in square brackets where its pitch falls: [C]. If your pan has inner notes, put a | before them. Octave numbers are optional." (A closing sentence about the old bar was removed on 2026-10-07; see 20.16.)

**`LAYOUT_HINT`**: "Layout is a guess. Open ADJUST LAYOUT to move a note, change where note 1 sits, or mirror the pan." (The control's name is the design step's to confirm.)

**Mirror switch**: `MIRROR`, off by default. Helper, if the design step keeps one: "Flips left and right."

**`REASONS`**, every entry (`<A>`, `<B>`, `<X>`, `<N>` substituted as today):

| Code | Sentence |
|---|---|
| `NO_DING` (base, empty line) | "No ding. Put the ding in round brackets, e.g. (D) A C D E." |
| `NO_DING` alternate `which` | "Which note is the ding? Put it in round brackets, e.g. (D) A C D E, or put a \| straight after it: D \| A C D E." |
| `NO_DING` alternate `two` | "Two dings. Only the ding takes round brackets; a bottom note takes square ones, e.g. [C] (D) A C." |
| `NO_DING` alternate `below` | "<X> comes before the ding, so it must be a bottom note. Write it in square brackets, e.g. [C] (D) A C." |
| `NO_FIFTH` | unchanged: "No perfect fifth above the ding <X>. Add a <fifth of X>, or check the ding." |
| `TOO_MANY_RIM` | REMOVED (A15) |
| `BAD_NOTE` (base) | "<X> is not a note. Use names like C, F#, Bb, with an optional octave, e.g. (D) A Bb C." |
| `BAD_NOTE` alternate `slash` | "A lone / is the old way to mark inner notes. Use \| now, e.g. (D) A C D \| E F." |
| `BAD_NOTE` alternate `bracket` | "<X> is not a bottom note. Give each bottom note its own square brackets, no spaces inside, e.g. [C] [D] (E) B." |
| `BAD_NOTE` alternate `bar` | "Too many \| marks. One \| starts the inner notes, e.g. (D) A C D \| E F. A bottom note takes square brackets instead: [C]." |
| `BAD_NOTE` alternate `barEmpty` | "A \| needs top notes before it and inner notes after it, e.g. (D) A C D \| E F." |
| `BAD_NOTE` alternate `barFirst` | "The \| comes after the ding and the top notes, e.g. (D) A C D \| E F." |
| `NOTE_OUT_OF_RANGE` | unchanged (not a format refusal) |
| `NOTE_OUT_OF_ORDER` (base) | "<A> is not above <B>, and the line runs low to high. Give <A> a higher octave or move it earlier, e.g. (D3) A3 C4 D4." |
| `NOTE_OUT_OF_ORDER` alternate `ding` | "<A> is at or below the ding <B>. Top notes are above the ding; a lower note is a bottom note and goes before it in square brackets, e.g. [C3] (D3) A3." |
| `NOTE_OUT_OF_ORDER` alternate `afterBar` | "<A> comes after the \| but is below <B>. Notes after \| are inner notes now. For a bottom note, use square brackets where its pitch falls, e.g. [C3] (D3) A3 C4." |
| `NOTE_OUT_OF_ORDER` alternate `below` | "<A> is not below <B>. Bottom notes before the ding also run low to high, e.g. [C3] [D3] (E3) B3." |
| `NOTE_REPEATED` | "<B> and <A> are the same note, and a note may appear only once per shell. A bottom copy takes square brackets and its octave, e.g. (D3) A3 [C4] C4." |
| `NEEDS_NEWER_APP` | unchanged |
| `NO_THIRDS` (warning) | unchanged |
| `SMALL_LABELS` (warning, NEW) | "Crowded pan: the smallest labels print at <N> pt, under the 3.6 pt this app treats as readable. Nothing is left out." |

A lane test extracts every `e.g.` example from `REASONS`, the placeholder and the hint and asserts each parses (D2).

## 10. The design step (D11)

**DS: drawer and field interaction spec.** Run `/frontend-design:frontend-design`. It needs only this plan, so it starts at once and runs alongside the engine lanes. Lanes W1, DR1 and DR2 may not start until its output is merged and the owner has signed it off.

Inputs handed to it:

1. The data model in section 8: one permutation per ring; the primitive is a swap of two notes in one ring (A18), unless the step argues for insert-and-shift.
2. Constraints: single-file app, no new dependency, no `<script src>`; the visual system in CLAUDE.md unchanged; everything works at 380 px; the pan is drawn by the same `pan()` renderer as the cards and redraws on every seat change; the existing interactive hit layer (`sizePanHits`, `panHitRadii`, 44 px floor) is the starting point; the primary button stays outside the scrolling body and only it and the delete row are pinned (owner ruling recorded in the sheet markup).
3. Measured facts: the table in 5.8; the placeholder is 60 characters; the field is an `<input>` today and must become a wrapping control of one to three rows in which Enter still submits and an EMPTY field is tall enough to show the whole placeholder; the count line (section 9) is longer than today's parse line, which shares one reserved line with the refusal.
4. Behaviours to specify: how the drawer opens and closes from the sheet on both Add and Edit, and where focus goes; whether it is offered before the box parses; pointer drag on touch without scrolling the page; a tap-then-tap equivalent; a keyboard equivalent (pick up, move seat by seat within the ring, drop, cancel) with spoken announcements; what a drop outside the ring or on another ring does and how that is shown; the anchor control (two states, section 7.1); the MIRROR switch (D13); a reset; how the legibility warning and the refusal line coexist with the drawer; what happens to an arrangement when the typed notes change the count of a ring.
5. What it must NOT do: change the card face, add a second pan renderer, allow a cross-ring move, shorten the example, or rename MIRROR.

Output: `docs/plans/2026-10-06-layout-drawer-design.md`, holding element ids, states, copy, the keyboard map, announcement strings, the 380 px layout, and an acceptance list written as observable behaviours that Lanes W1, DR1 and DR2 turn into tests.

## 11. Lanes

### 11.1 Order and why

1. **L0** seams, no behaviour change. First: it is what stops a stored record being misread once the grammar changes.
2. **G1** the new parser, unwired. After L0 (same file, `core.js`). May run in parallel with S1; whichever merges second reruns `python3 tools/inline_engine.py`.
3. **S1** no caps in the solver, N inner notes, adaptive ding offset, the warning. Independent of the grammar.
4. **S2** one direction and the anchor. After S1 (same file, `layout.js`). Uses G1's parser in its D9 test.
5. **P1** the Pygmy redraw. After S1 and S2, because the redrawn `geom` must be the output of the final seat and geometry rules.
6. **S3** per-ring seats and share version 3. After S2 (the anchor travels in the same version).
7. **W1** the sheet: wrapping field, count line, MIRROR switch. After S2 (MIRROR's meaning), after DS (its layout). Before G2b so the long placeholder has somewhere to go.
8. **G2a** legacy tests call the legacy reader (no behaviour change): after L0 (section 19, R4). Then **G2b** the flip and share version 4: after G1, G2a, S1, S3, W1.
9. **DR1** drawer shell, anchor, MIRROR moved in; then **DR2** drag. After DS, S3 and G2b.
10. **DOC** the long-form spec. Last.

Common rules for every lane: re-derive the mutant base with `ls tests/mutants | wc -l`; run `python3 tools/inline_engine.py` after any edit under `src/engine/`; regenerate (never hand-write) every mutant its edits make stale; and include in its acceptance the stale check

`for p in tests/mutants/*.patch; do git apply --check "$p" 2>/dev/null || echo "STALE $p"; done` (expected: no output)

and, for every lane except P1, `git diff --exit-code <lane base> -- data/decks.json` (expected: no output, exit 0). Line counts are ESTIMATES. Mutant counts after 684 are FORECASTS.

---

### Lane L0: seams (inert)

- **Goal**: make ids, record lookups and scale-line reading independent of `formatSeed`'s spelling, with no visible change.
- **Owns**: in `src/engine/core.js` the functions `orderedIds` and `deckId`, new `identitySeed`, new export `parseLegacySeed`; in `src/engine/share.js` the choice of reader inside `decodeSeed`; in `index.html` the generated engine regions for core and share and the functions `scaleRecord`, `rememberScale`, `forgetScale`, `replaceScale`, `restoreScales`; new fixture `tests/fixtures/deck_ids_v1.json`; the tests named below.
- **Reads only**: `tests/helpers/engine.js`, `data/decks.json`.
- **Changes**: `identitySeed(fields)` is today's `formatSeed` algorithm with zone-based ordering and the generalised ` /` rule (5.2); `deckId` hashes it; `parseLegacySeed` is exported as an alias of today's `parseSeed`; `decodeSeed` and `restoreScales` call a reader chosen by version (all versions map to the same function for now); record lookups compare `deckId`.
- **TDD order** (red first): (1) `tests/core.test.js` "every frozen legacy string keeps its deck id" (about 500 strings with ids captured from main, plus the five ids in 5.2); (2) "identitySeed equals formatSeed on every legacy-reachable shape"; (3) "identitySeed tells a twelve-note rim from an eleven-plus-one spill"; (4) `tests/app.test.js` "forgetting a deck removes its record whatever spelling the record holds"; (5) `tests/share.test.js` "decode chooses its scale-line reader from the version".
- **Acceptance**: `./tests/run.sh node` prints `ALL GREEN`; `python3 tools/validate.py` exits 0; `python3 tools/inline_engine.py --check` exits 0; `git diff --stat <base> -- tests/fixtures` lists only `deck_ids_v1.json`.
- **Verify**: `./tests/run.sh all`
- **Non-goals**: any grammar change; any version bump.
- **Stop conditions**: any existing fixture changes; any id in the new fixture differs from main.
- **Mutant delta (forecast)**: +3 (id hashed from the canonical string; reader not chosen by version; lookup by string). 684 to 687. About 250 lines.

### Lane L0 outcome (2026-10-07, coordinator)

Merged as PR #259, main `4026e63`, 697 mutants (base 690; forecast was 693).
Two review rounds. Round 1 FAILed at `a2b4e1d`: a null deck id (a string or
record this build cannot re-parse, reachable with an octave-0 ding such as
`(D0) A D F | A`) matched every unreadable record in `rememberScale`,
`forgetScale` and `replaceScale`. Fixed with `sameDeck(r, id, str)`: match by
id only when both ids are non-null, else main's exact-string comparison.
Round 2 PASS_WITH_NITS at `e92f5a2`, CI run 37608642668 green.

As built, for later lanes:
- `identitySeed` prints the ` /` mark only when the rim count is above 0
  (section 5.2 does not state the guard; G1 decides the zero-rim case).
- `generateDeck` and `select.build` still call `core.parseSeed`, and
  `share.encode` still uses `formatSeed`. `restoreScales` and `openShare` use
  the version reader only as a gate and then re-parse. G2b routes all of them.
- `scaleReader(v)` and `scaleLineReader(version)` ignore their argument today.
- Pygmy's shipped id `custom:6f9ffc33` comes from the fields string with
  ` / F5 G5`; the golden `maker_string` without `/` hashes to `custom:b936039c`.
  `tests/fixtures/deck_ids_v1.json` pins the slash form. R1's grep will list
  that fixture.
- Mutants anchored on `scaleRecord`, `rememberScale`, `sameDeck` or `deckId`
  lines go stale when G2b or S3 rewrites them; `refresh_mutants.py` says
  UNFIXABLE when the anchor line itself changed, and the lane then re-anchors
  by hand with headers kept verbatim (eight were in L0).
- `SCALES_KEY` is read and written only in `savedScales()` and `writeScales()`.

Open after L0, for the owner (not scheduled):
- O1: record matching ignores a record's version. With storage a shipped build
  never writes (a non-restorable record whose string reads to the same id as a
  later live one), an edit can replace the dead record and leave the live one,
  so the old deck returns on reload. Main has the mirror case.
- A 32-bit deck id collision now keeps one stored record where main kept two.
- By-id matching on readable records in `rememberScale` and `replaceScale` has
  no test or mutant; only `forgetScale`'s is pinned.
- Docs still say the id hashes `formatSeed` (`docs/ENGINE-SPEC.md`,
  `docs/SCALE_ENGINE_PLAN.md`, a comment in `src/engine/share.js`): Lane DOC.

### Lane G1: the new parser, unwired

- **Goal**: implement and fully test the new grammar and its canonical printer as `HPE.core.parseScale` and `HPE.core.formatScale`, with nothing calling them.
- **Owns**: in `src/engine/core.js` new functions only (tokenizer, structure pass, inference pass, `formatScale`), the note pattern, and the new `REASONS` alternates added without removing anything; the generated core region of `index.html`; new test file `tests/scale.test.js` with its row in `FLOORS` in `tests/suite_health.py`; new fixture `tests/fixtures/scale_grammar_v1.json` (the table in 4.5, each row with its expected fields or code and alternate).
- **Reads only**: `data/decks.json`, `tests/fixtures/deck_ids_v1.json`.
- **Changes**: section 4, following Appendix A.
- **TDD order**: (1) "every row of the grammar table parses to its fields"; (2) "every refused row carries its code and its sentence"; (3) "the five built-in strings parse to the shipped names, octaves, MIDI, zones and labels"; (4) "the E Amara 20 example lands on exactly its twenty pitches"; (5) "formatScale round-trips every accepted string of length one to five over the probe alphabet"; (6) "a bare ding and a bracketed ding give the same pan"; (7) "every legacy-reachable field map prints and re-parses unchanged"; (8) "a string with neither mark reads the same under both grammars"; (9) "every e.g. in REASONS parses"; (10) "octave -1 lexes and round-trips"; (11) "a bracketed note among top notes and a bottom note after the inner notes continue the climb".
- **Acceptance**: `node --test tests/scale.test.js` passes; `./tests/run.sh node` prints `ALL GREEN`; `git diff --exit-code <base> -- tests/core.test.js` prints nothing.
- **Verify**: `./tests/run.sh all`
- **Non-goals**: wiring; removing caps; changing `formatSeed` or any id.
- **Stop conditions**: a string is found with two readings; any D9 string fails test 3.
- **Mutant delta (forecast)**: +7 (bare-ding bar ignored; bracket zone ignored; descending inference climbs; canonical order drops the bottom-first tie; equal pitch accepted untyped; lone slash accepted; `-1` not lexed). 687 to 694. About 450 lines.

### Lane S1: no caps in the solver, N inner notes, ding offset, the warning

- **Goal**: `layout.solve` never refuses for size; inner notes fan for any count; the ding clears inner index numbers; a crowded pan carries `SMALL_LABELS`.
- **Owns**: in `src/engine/layout.js` the cap constants, `INNER_ANGLES`, `innerAngles`, `geometry`, the three cap lines in `solve`, new `labelFloor`, new named constants for the fan span, the offset step, the clearance and the offset ceiling; in `src/engine/select.js` the warnings block of `build`; in `src/engine/core.js` the `SMALL_LABELS` entry only; in `index.html` the generated regions and the one place `syncParseState` clears the message area (so the warning shows live); `tests/layout.test.js` cap tests and new tests; mutant `g_bottom_cap_seven` (retired).
- **Reads only**: `tools/hifi.py` (label ratios, the 3.6 floor), `tools/decks.py`, `src/engine/pdfdeck.js`, `src/engine/pdfcards.js`.
- **Changes**: delete the caps; `innerAngles(k)` per A13; ding offset per A14 (solve `r_note`, test clearance, raise, solve again); `labelFloor(geom)` returns the smallest of the four counted glyph sizes in points at `round(74 / ext, 1)`; `build` attaches `SMALL_LABELS` with `<N>` to one decimal when it is under 3.6. The parser's own caps stay until G2b, so nothing a player can type changes yet except through `tools/gen_deck.js` callers of `solve`.
- **TDD order**: (1) "two inner notes sit at 128 and 52"; (2) "one, three, four, five and six inner notes take the fan seats"; (3) "the ding offset stays 0.1425 for the Pygmy shape and rises until every inner number clears"; (4) "no two fields overlap at any count" (the 9,360-pan sweep of 5.4); (5) "a hundred and fifty rim notes solve"; (6) "labelFloor crosses 3.6 pt at 21 rim, at 15 rim with a bottom shell, at seven inner on nine rim, and at 36 bottom"; (7) "bottom octave digits do not trigger the warning" (D15: one bottom note alone gives no warning); (8) "the E Amara 20 shape carries no warning"; (9) `tests/test_pdf_parity.py` "labelFloor uses the print pipeline's ratios"; (10) `tests/select.test.js` "a crowded pan builds with SMALL_LABELS and is not refused"; (11) `tests/app.test.js` "the sheet shows the small-labels warning while typing".
- **Named gate G-RENDER**: render the app pan at 380 px and the print PDF for 9 rim with 1, 2, 3, 4 and 6 inner notes, for 5 rim with 2 inner, and for the E Amara 20 shape. A human confirms that no inner index number touches the ding, no label leaves its circle, the ding's lower edge stays inside the rim fields, and the title-card blurb with the warning line stays above the print floor. Screenshots go on the PR. The lane does not merge without it; if the model is contradicted, the four named constants are the only things to retune.
- **Acceptance**: `node --test tests/layout.test.js` passes; `node --test --test-name-pattern "SMALL_LABELS" tests/select.test.js` passes; `python3 -m unittest tests.test_pdf_parity -v` passes; `grep -c "RIM_MAX\|INNER_MAX\|BOTTOM_MAX" src/engine/layout.js` prints 0.
- **Verify**: `./tests/run.sh all`
- **Non-goals**: rim direction; the parser's caps; bottom octave digit size.
- **Stop conditions**: G-RENDER shows a collision the constants cannot fix; any built-in drawing changes (`pan_render_v1.json` or `tests/test_render_agreement.py` moves).
- **Mutant delta (forecast)**: -1, +5 (third inner seat wrong; offset not raised; warning never attached; bottom octave counted; cap restored). 694 to 698. Regenerate `g_mirror_ignored`, `b_engine_desync`, `g_inner_pair_with_rim`, `g_centred_default_ignored`. About 450 lines.

### Lane PF: short print line for the small-labels warning

Added 2026-10-07 (owner, interview 4: "Short print string", "Own small lane before G2b"). Eng-reviewed. Base: main with S1 (#263) merged. Must merge before G2b.

- **Why**: the title card prints each warning's full sentence in capitals on
  one centred line (Label 4.2 pt, tracking 0.35). `SMALL_LABELS` measures
  308.4 pt on a 177.6 pt card. `NO_THIRDS` measures 153.1 pt and fits.
  Owner, interview 4: "Short print string".
- **Goal**: a deck carrying the `SMALL_LABELS` warning prints
  `CROWDED PAN: SMALL LABELS` (72.9 pt) on its title card, in both print
  pipelines. The app sheet keeps the full sentence.
- **Owns**: `tools/decks.py` (new `TITLE_WARNINGS` beside `_blurb`, and
  `_blurb`); `src/engine/pdfdeck.js` (new `TITLE_WARNINGS`, exported, and
  `blurb`); the generated engine regions of `index.html` via
  `tools/inline_engine.py`; `tests/test_gen_deck.py`;
  `tests/test_render_agreement.py`; `tests/pdfcards.test.js` (it holds the
  `fromGenerated` tests); the two existing mutants whose hunks sit on the
  changed lines, `c_blurb_spurious_line.patch` and
  `c_gen_warning_off_the_sheet.patch`, plus any other mutant
  `tools/refresh_mutants.py` or `git apply --check` reports stale; new
  mutants; FLOORS and the README mutant count.
- **Reads only**: `src/engine/core.js` (`REASONS`), `src/engine/select.js`,
  `tools/hifi.py`, `src/engine/pdfcards.js`, `docs/ENGINE-SPEC.md`.
- **Changes**: `TITLE_WARNINGS = {"SMALL_LABELS": "CROWDED PAN: SMALL LABELS"}`
  lives with the blurb builder on each side (`tools/decks.py`,
  `src/engine/pdfdeck.js`), not with `CARD_WARNINGS` in the card renderers:
  `pdfdeck` loads before `pdfcards`, and the map is title-card copy.
  `_blurb` and `blurb` print the short line for a code in the map and the
  capitalised reason for any other code, so `NO_THIRDS` is byte-identical.
  No change to `REASONS`, to `CARD_WARNINGS` or to what the chord cards draw.
- **How the tests get a warned deck**: the parser still refuses a crowded
  pan (`TOO_MANY_RIM`) until G2b, so no seed string reaches `SMALL_LABELS`
  through `tools/gen_deck.js`. The Python tests take the real payload for
  `SEED_TOP_ONLY` and append one warning,
  `{"code": "SMALL_LABELS", "reason": <core REASONS text with N filled>}`,
  before `decks.from_generated`. The JS test passes the same warning list to
  `HPE.pdfdeck.fromGenerated`. `tests/select.test.js` already proves a
  crowded pan produces that warning; G2b adds the end-to-end seed.
- **TDD order**:
  1. `tests/test_gen_deck.py` "a small-labels warning prints the short line
     on the title card": the injected deck's `blurb` contains
     `CROWDED PAN: SMALL LABELS` exactly once and no line contains `3.6 PT`.
  2. Same file, "no warning line on the title card is wider than the card":
     for the injected `SMALL_LABELS` deck and the `SEED_NO_THIRDS` deck,
     each warning line at Label 4.2 pt with 0.35 tracking is at most
     `CW - 24` pt. The note lines are not measured here (see F3).
  3. The existing "a warning survives the adapter and reaches the title
     blurb" test stays green unchanged (`NO_THIRDS` verbatim).
  4. `tests/test_render_agreement.py`: `HPE.pdfdeck.TITLE_WARNINGS` equals
     `decks.TITLE_WARNINGS`, next to the existing `CARD_WARNINGS` assertion.
  5. `tests/pdfcards.test.js`: `fromGenerated` gives the short line for
     `SMALL_LABELS` and the capitalised reason for `NO_THIRDS`.
- **Acceptance**: the five tests pass; `python3 tools/inline_engine.py
  --check` and `python3 tools/validate.py` pass; every file in
  `tests/mutants/` still applies (`git apply --check`); the title-card text
  extracted from a PDF built from the injected deck contains the short line
  once (inside test 1 or beside it, using the PDF text helper the file
  already has).
- **Verify**: `./tests/run.sh all`; CI at the head SHA is the evidence.
- **Non-goals**: the sentence in `REASONS` and on the app sheet; a
  small-labels badge on the chord cards (decision A16 says no badge; raised
  with the owner again below); `NO_THIRDS` copy; wrapping or shrinking any
  blurb line, the note lines included; everything on the G2b carry-list.
- **Stop conditions**: any built-in deck's PDF text changes; test 2 fails
  for `NO_THIRDS` (0.5 pt of room today); the app sheet's warning text
  moves; a stale mutant cannot be re-anchored without changing what it
  kills.
- **Mutant delta (forecast)**: +3 (short line dropped in Python; dropped in
  JS; the two maps disagree). 706 plus S1's delta, plus 3.
- **Coordinator commit on this branch** (not the lane's): the G2a, G1 and S1
  outcomes and the interview-4 and interview-5 owner answers, added to the
  scale plan; finding F3 added to Lane P1's block.
- **Open with the owner, does not block**: CHORD_ONLY has no title card, so
  a print-shop file for a crowded pan carries no small-labels notice.
  Decision A16 chose no chord-card badge. Adding `SMALL_LABELS` to
  `CARD_WARNINGS` is one line plus a test if the owner wants it.

### Lane S2: one direction and the anchor

- **Goal**: every rim runs odd-right; `anchor` chooses between the two seatings; four built-ins are proven equal to solver output.
- **Owns**: in `src/engine/layout.js` `rimAngles`, `rimAnglesFromBottom`, `placeZones`, the options read in `solve`, the export list; in `src/engine/core.js` the option reader and defaults; in `src/engine/select.js` the solve call and `deck.options` in `build`; `tools/gen_deck.js` (argument parsing, usage text); in `index.html` the generated regions; the Amara 9 recipe (7.5); `tests/layout.test.js` direction tests; the CLAUDE.md and README layout wording (section 15).
- **Reads only**: `data/decks.json`.
- **Changes**: section 7.1. The LEFT-FIRST and RIGHT-FIRST buttons keep working for now (W1 replaces them); with mirror off they now give the odd-right pan.
- **TDD order**: (1) `tests/layout.test.js` "the solver seats every built-in field where its diagram has it, from the deck's scale string" (loops over `data/decks.json`, default options, anchor `between` for Pygmy, compares ring, seat and angle of every field: the D9 positions check); (2) `tests/app.test.js` "Hijaz, Amara 9, Kurd 10 and Amara 10 draw exactly as the solver draws them" (every chord and the no-chord drawing through `pan()`, stored deck against the solver's fields and `geom`: the D9 "keeps saying so" check); (3) "the geometry keys that differ from solver output are exactly the documented ones" (pins the table in 5.1); (4) "odd rim notes sit right and even left at every count from 2 to 24, both anchors"; (5) "anchor one puts note 1 at 270; anchor between straddles 270 with note 1 on the right"; (6) "the anchor applies with and without inner notes"; (7) "mirror reflects all three rings"; (8) `tests/core.test.js` "anchor is one or between, anything else is refused"; (9) `tests/test_gen_deck.py` "--anchor between reaches the deck options"; (10) `test_amara_9_chords_equal_a_fresh_engine_run` goes red with `--mirror` and green without it.
- Existing tests that change meaning and are rewritten here: "mirror turns the pygmy nine-field zig-zag into the left-first pattern", "eight rim fields mirrored reproduce the verified hijaz / amara zig-zag", "the rim is evenly spread and anchored at bottom centre (odd, centred) or top centre", "the default is right-first and mirror is left-first, except on an odd centred rim", "an odd centred rim starts at bottom centre and keeps each note on its side", "a stored order and mirror draw the same sides on an odd rim", "even rim counts are untouched by the centred default", "the centred default reproduces the shipped Amara 9 and Hijaz layouts", "ET-2 rim/bottom/inner angles follow CLAUDE.md zig-zags".
- **Acceptance**: `node --test --test-name-pattern "seats every built-in field" tests/layout.test.js` passes; `node --test --test-name-pattern "draw exactly as the solver" tests/app.test.js` passes; `./tests/run.sh all` prints `ALL GREEN`; `python3 tools/sync_decks.py --check` exits 0; `grep -rn -- "--mirror" tests/test_gen_deck.py` shows no Amara 9 recipe.
- **Verify**: `./tests/run.sh all`
- **Non-goals**: seats; the drawer; converting saved decks (D10); Pygmy's `geom`.
- **Stop conditions**: test 1 or 2 fails for any deck; `data/decks.json` shows any diff.
- **Mutant delta (forecast)**: +4 (even rims keep the old direction; anchor ignored; anchor tied to inner notes; a built-in no longer equal to solver output). 698 to 702. Regenerate `g_bottom_anchor_dropped`, `g_bottom_anchor_side_flipped`, `g_centred_default_ignored`, `g_mirror_ignored`, `d_mirror_ignored`. About 450 lines.

### Lane P1: redraw F3 Low Pygmy (the one authorised deck-data change)

- **Goal**: Pygmy's `geom` is engine output; its two PDFs are rebuilt; nothing else in any deck moves.
- **Owns**: the `geom` object of the `pygmy` deck in `data/decks.json`; the generated `const DECKS` line of `index.html` (through `python3 tools/sync_decks.py`); `F3_Low_Pygmy_18_Cards_Letter.pdf` and `F3_Low_Pygmy_18_CHORD_ONLY_Letter.pdf` (through `python3 tools/decks.py`); the fixtures and mutants listed below; the Pygmy paragraph of CLAUDE.md (section 15).
- **Reads only**: `src/engine/*`, `tools/decks.py`, `tools/hifi.py`.
- **Changes**: run `node tools/gen_deck.js "[C3] [Db3] [Eb3] F3 | G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]" --anchor between --out <scratch>/pygmy.json` (until G2b wires the new grammar, the equivalent legacy string `(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 / F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5` gives the same fields); copy its `geom` into the deck, with or without `ext` per Q1. Expected values are in 5.1. `fields`, chords, the print overlay (R 60, cy 121) and the blurb are untouched.
- **Every test this touches**:
  - `tests/test_fixture_integrity.py`: the frozen golden deck fixture deep-equals the live decks, so it is bumped to the next version (v8 on the assumed main) following that test's own BUMP message. `golden_decks_v3.json` is frozen history and is not edited.
  - `tests/test_deck_data.py::PrintDeckSnapshotTest.test_deck_dicts_match_the_pre_refactor_snapshot`: `print_decks_v1.json` holds Pygmy's `_geom` `r_note`, `f_note`, `f_num`. It is re-issued as `print_decks_v2.json` with those three values changed and nothing else (UNVERIFIED whether that test's rule is a version bump or an in-place update; the lane follows the rule written beside the test).
  - `tests/app.test.js`: the `pan_render_v1.json` digests (every Pygmy row changes: 54 on the assumed main; no row of another deck may change), "every built-in card face still matches the committed digest of card_face_v1.json" (Pygmy faces only), and "the built-in decks keep the derived extent they have always rendered" (unchanged under Q1 option a; rewritten to exempt Pygmy under option b).
  - `tests/test_print.py`: `LabelSizeRuleTest` reads Pygmy's `r_note` and follows the data; `test_no_label_is_smaller_than_what_either_renderer_drew_before` and `test_no_label_falls_below_the_print_floor` must stay green (labels grow); `test_pygmy_geometry_is_pinned` pins the print radius and centre only and is unaffected.
  - `tests/test_render_agreement.py`, `tests/test_pdf_parity.py`, `tests/pdf_builtin.test.js`: follow the data; expected green without edits.
  - `tests/test_pdf_build.py::test_committed_pdfs_match_a_fresh_build`: green once the two PDFs are rebuilt.
  - `tests/layout.test.js`: the tests pinning `ding_dy` 0.1425 are unaffected (the offset does not change).
- **Fixtures regenerated**: the golden deck fixture (next version); `print_decks_v2.json`; `pan_render_v1.json` by `node tools/regen_pan_fixture.js`; `card_face_v1.json` by `node tools/regen_card_fixture.js`. `engine_corpus_v1.json` holds only a synthetic `ding_dy` and is not touched.
- **Mutants touched**: the eleven data mutants that embed the whole `const DECKS` line are regenerated by `python3 tools/regen_data_mutants.py` (`b_ding_in_voicing`, `b_cluster_forced_only`, `b_layout_angle_swap`, `b_degree_missing`, `b_root_not_in_voicing`, `b_doubled_pitch_class`, `b_decks_json_desync`, `b_pygmy_badge_count`, `b_duplicate_voicing`, `b_midi_off_by_one`, `b_power_chord_fifth`), plus `b_adopted_deck_drifts` if the in-flight plan generated it the same way; `c_deck_data_drift` is re-cut by hand as its header instructs; `w1b_pygmy_geometry_drifts` is re-cut because its hunk sits inside the edited `geom` block; `qd_p_pygmy_blank_cards_drifts` and `w1b_hijaz_credit_damaged` are checked with `git apply --check` and re-anchored with `python3 tools/refresh_mutants.py` only if stale. The three `r1_lock_*` patches mention `const DECKS` in a comment only and are not affected.
- **TDD order** (red first): (1) `tests/test_deck_data.py` new `test_pygmy_geometry_equals_a_fresh_engine_run` (runs `tools/gen_deck.js` with the string and `--anchor between`; asserts every stored `geom` key equals engine output and every stored field angle equals the engine's; red on today's 0.1425); (2) new `test_pygmy_fields_and_chords_are_untouched_by_the_redraw` (the `fields` block and chord list equal the previous golden fixture's); (3) the fixture and digest tests above, red until regenerated; (4) extend Lane S2's test 2 so all five built-ins draw exactly as the solver draws them, and delete Pygmy from test 3's list of documented gaps.
- **Acceptance**: `python3 -m unittest tests.test_deck_data tests.test_fixture_integrity tests.test_print tests.test_pdf_build -v` passes; `python3 tools/sync_decks.py --check`, `python3 tools/regen_data_mutants.py --check` and `python3 tools/validate.py` each exit 0; `git diff --stat <base> -- '*.pdf'` lists exactly the two Pygmy PDFs; `git diff <base> -- data/decks.json | grep -c '^[-+] '` prints the number of changed `geom` lines and every one lies inside the Pygmy `geom` block (5 changed lines under Q1 option a: `r_note`, `inner_ring`, `f_note`, `f_num`, and none added); the stale check prints nothing.
- **Verify**: `./tests/run.sh all`
- **Hand check (part of the lane's PR)**: open both rebuilt Pygmy PDFs and the app at 380 px; confirm the pan reads as before with slightly larger top circles, and that no label leaves its circle. UNVERIFIED until done.
- **Non-goals**: Pygmy's chord list; the print overlay; any other deck; the bottom octave digit.
- **Stop conditions**: any field angle changes; any non-Pygmy row of `pan_render_v1.json` or `card_face_v1.json` changes; a non-Pygmy PDF changes; the engine's `geom` differs from 5.1 (that means S1 or S2 changed geometry and the gap table must be re-measured first).
- **Mutant delta (forecast)**: +1 (`b_pygmy_geom_not_engine_output`: one stored `geom` value nudged; killed by test 1). 702 to 703. About 150 changed lines outside fixtures and PDFs.

### Lane S3: per-ring seats and share version 3

- **Goal**: arrangements are per ring everywhere; links and records carry the anchor and seats; cross-ring is refused everywhere.
- **Owns**: in `src/engine/layout.js` `readOrder`, `reseat`, `slotOrder`, new `readSeats` and `seatsFromOrder`; in `src/engine/share.js` `VERSION`, `CAPS`, `ORDER_RE`, `orderField`, `optionsLine`, `deltaLine`, `readOptionsLine`, `readDeltaLine`, `checkOrder`; in `index.html` the generated regions and `generateDeck`'s correction block, `layoutOrder`, `layoutIds`, `slotZones`, `zoneBlock`, `syncLayoutOrder`, `rotateLayout`, `moveNote`, `resetLayout`, `selectPanField`, `selectedField`; order tests in `tests/share.test.js` and `tests/layout.test.js`.
- **Reads only**: `src/engine/core.js`.
- **Changes**: section 8. ROTATE and MOVE keep working in this lane, rewritten to edit one ring's permutation (they are removed in DR1). Version 3: the options line gains `anchor` before the name; the third line is `rim;inner;bottom`; the cap is 4096. The scale line is still read by the legacy reader.
- **TDD order**: (1) "a seat list for one ring cannot name a seat in another"; (2) "a legacy flat order that stays in its rings converts; one that crosses is refused"; (3) "a version 2 link opens with the same seats it had"; (4) "a version 3 link round-trips anchor and seats"; (5) "a link with a cross-ring arrangement is refused BAD_NOTE"; (6) "a stored record with a cross-ring order opens with the default arrangement"; (7) "a 120-note pan with every ring rearranged encodes under the cap"; (8) "a name containing every printable character still round-trips with an anchor beside it"; (9) the existing version-gate test, moved up one version.
- **Acceptance**: `node --test tests/share.test.js tests/layout.test.js` passes; `node --test --test-name-pattern "ROTATE|MOVE|RESET" tests/app.test.js tests/e2e.test.js` passes.
- **Verify**: `./tests/run.sh all`
- **Non-goals**: the new grammar on the scale line; any drawer UI.
- **Stop conditions**: any version 1 or 2 golden link in `tests/share.test.js` stops decoding to the same deck.
- **Mutant delta (forecast)**: +3. 703 to 706. Regenerate `l_order_length_unchecked`, `l_order_ignored`, `s_share_order_unchecked`, `s_share_v1_delta_accepted`, `eg_slotorder_swapped`, `ap3_slotzones_reversed`, `qa_select_pan_field_ignores_order`. About 500 lines.

### Lane W1: the sheet field (D12, D13, D14)

- **Goal**: the scale field wraps to three rows; the line under it leads with counts; the mirror is one switch.
- **Owns**: in `index.html` the `#scale-box` element and its CSS rules, the field's `input` and `keydown` listeners, `parseLineText`, the two mirror buttons and their handlers (replaced by one element `#scale-mirror`), the `mirror` read in `sheetOptions`; `tools/sandbox.js` ids (`scale-mirror-l` and `scale-mirror-r` out, `scale-mirror` in); the mirror and field tests in `tests/app.test.js`, `tests/e2e.test.js`, `tests/preview.test.js`; `tests/fixtures/app_surface_v1.json`.
- **Reads only**: the DS spec; `src/engine/*`.
- **Changes**: per the DS spec. Fixed by this plan: the field shows one to three rows and never scrolls sideways; an empty field shows the whole placeholder; Enter submits and never inserts a line break; a pasted line break is treated as a space; the count line has the shape in section 9; MIRROR is off by default and reads a stored `mirror: true` as on.
- **TDD order**: (1) e2e "the scale field grows to three rows at 380px and shows the whole example"; (2) e2e "Enter in the scale field generates and adds no line break"; (3) "a pasted line break is read as a space"; (4) "the line under the box leads with the top, inner and bottom counts"; (5) moved to G2b by the eng review (R9): before the flip the bar still means bottom notes, so the test cannot pass here; (6) "MIRROR is one switch, off by default, and carries the choice into the deck" (replaces "the mirror pair defaults to right-first and carries the choice into the deck"); (7) "a deck stored with mirror true opens with MIRROR on"; (8) the existing e2e tests on the field under a real keyboard stay green ("the seed box is not clipped by the sheet's own scroller", "GENERATE CARDS is reachable without scrolling at every phone viewport").
- **Acceptance**: `node --test tests/app.test.js tests/preview.test.js` passes; `node --test --test-name-pattern "scale field|MIRROR" tests/e2e.test.js` passes; `grep -c "LEFT-FIRST\|RIGHT-FIRST\|scale-mirror-l\|scale-mirror-r" index.html tools/sandbox.js` prints 0 for both files.
- **Verify**: `./tests/run.sh all`, plus a hand check on a phone at 380 px with the keyboard up, recorded on the PR (UNVERIFIED until done).
- **Non-goals**: the grammar; the drawer; the label and hint text (G2b).
- **Stop conditions**: the three-row field pushes the primary button out of reach at any tested viewport.
- **Mutant delta (forecast)**: +3 (field stays one row; counts dropped from the line; MIRROR inert). 706 to 709. Regenerate `d_mirror_ignored`, `f6_scale_box_media_override`, `f6_scale_box_font_override`. About 350 lines.

### Lane G2a: legacy tests call the legacy reader (behaviour-free)

- **Goal**: every test and fixture that proves the legacy grammar calls `parseLegacySeed` by name, so the flip is a small diff.
- **Owns** (WIDENED by the eng review, section 19 R1; the list there replaces this one): legacy-grammar cases in `tests/core.test.js` (25 literals), `tests/preview.test.js` (2), `tests/layout.test.js` (1), `tests/test_print.py` (1); `tests/fixtures/synthetic_scales.json` and `engine_corpus_v1.json` (through `tools/regen_engine_corpus.js`), each entry tagged with the reader it is for.
- **Reads only**: `src/engine/core.js`.
- **TDD order**: none new; the lane is a rename with the suite green before and after.
- **Acceptance**: `./tests/run.sh all` prints `ALL GREEN`; `git diff --stat <base> -- src index.html` prints nothing.
- **Verify**: `./tests/run.sh all`
- **Non-goals**: any behaviour change.
- **Stop conditions**: a fixture regeneration changes any chord list.
- **Mutant delta**: 0. Regenerate `u_inner_mark_ignored`, `u_inner_mark_unprinted` if their kill tests moved. About 300 lines.

### Lane G2b: the flip

- **Goal**: typed input, the canonical string, links (version 4) and records use the new grammar; the sheet teaches it; the parser's caps and spill go.
- **Owns**: in `src/engine/core.js` `parseSeed` and `formatSeed` (they become G1's functions; the old ones remain only as `parseLegacySeed`), the parser caps, `TOO_MANY_RIM`, the final `REASONS` text, the bottom id base in `assemble`; in `src/engine/share.js` `VERSION` 4 and the reader table; in `index.html` the generated regions, the `#scale-box` label and placeholder text, `PARSE_HINT`, `LAYOUT_HINT`, the boot rewrite in `restoreScales`; the README "+ ADD A SCALE" bullet and the CLAUDE.md "Scale strings" paragraph; mutant `u_inner_cap_unenforced` (retired).
- **Reads only**: everything else.
- **TDD order**: (1) `tests/app.test.js` "a version 2 record with a bar opens with bottom notes, not inner notes, and is rewritten as version 4 at the same index"; (2) `tests/share.test.js` "a version 3 link with a bar opens with bottom notes"; (3) "the placeholder parses and draws the E Amara 20 pan"; (4) "label, placeholder and hint name the same three marks" (`(`, `[` and `|` in each, a lone `/` in none); (5) "every example in the label, hint and refusals parses"; (6) "typing the old inner mark shows the slash sentence"; (7) "typing an old bottom list with octaves shows the afterBar sentence"; (8) "TOO_MANY_RIM is not in REASONS and thirteen rim notes generate a deck"; (9) "a hundred-and-first top note does not collide with a bottom id"; (10) L0's "every frozen legacy string keeps its deck id", still green; (11) from W1 (R9): "an octave-less list after the bar is counted as inner notes, with zero bottom"; (12) to (15): the record-safety and boundary tests in section 19 (R2, R7, R8).
- **Acceptance**: `./tests/run.sh all` prints `ALL GREEN`; `grep -c "TOO_MANY_RIM" src/engine/core.js src/engine/layout.js` prints 0 for both; `python3 tools/validate.py` exits 0; `python3 -m unittest tests.test_readme_currency -v` passes.
- **Verify**: `./tests/run.sh all`
- **Non-goals**: the drawer; any solver change.
- **Stop conditions**: test 1 or 10 cannot be made green.
- **Mutant delta (forecast)**: -1, +4 (version 3 record read as new grammar; boot rewrite moves the record's index; placeholder not parsed; `afterBar` sentence not chosen). 709 to 712. Regenerate `u_reason_string_reworded`, `u_flat_raises_midi`, `b_engine_desync`, and the hint mutants in 5.6 that quote the old text. About 450 lines.

### Lane DR1: drawer shell, anchor, MIRROR moved in

- **Goal**: the control that opens the drawer on both Add and Edit, the drawer, and the anchor and MIRROR controls inside it, per the DS spec. ROTATE and MOVE removed.
- **Owns**: in `index.html` the markup and CSS of `#scale-layout-row`, the new drawer element, the position of `#scale-mirror`, and the functions `sheetOptions`, the sheet-state reset, `rotateLayout`, `moveNote`, `stepLayoutSel` (deleted or replaced), the focus-order list that names the ROTATE and MOVE buttons; `tools/sandbox.js` ids (`scale-rot-l`, `scale-rot-r`, `scale-move-l`, `scale-move-r` out; drawer ids in); the ROTATE and MOVE tests in `tests/app.test.js` and `tests/e2e.test.js` (replaced); `app_surface_v1.json`; mutants `e_layout_rotate_inert`, `d_rotate_drops_the_selection`, `qa_layout_prologue_skips_sync` (retired).
- **Reads only**: the DS spec; `src/engine/*`.
- **TDD order**: one test per acceptance line of the DS spec, red first; at minimum "the drawer is offered on Add and on Edit", "the drawer opens and closes from the keyboard at 380px and returns focus", "the anchor control redraws the preview and reaches the generated deck, the record and the share link", "MIRROR inside the drawer redraws and reaches the deck", "ROTATE and MOVE are gone from the markup".
- **Acceptance**: `node --test tests/app.test.js tests/e2e.test.js` passes; `grep -c "scale-rot-\|scale-move-" index.html tools/sandbox.js` prints 0 for both.
- **Verify**: `./tests/run.sh all`
- **Non-goals**: dragging.
- **Stop conditions**: the spec needs something the data model in section 8 cannot express.
- **Mutant delta (forecast)**: -3, +4. 712 to 713. Regenerate `e_layout_reset_inert`, `r3s_served_id_not_in_markup`, `ap2_sheet_state_layout_sel_leaks`, `d_layout_reset_identity`, `d_layout_stale_order_guard`, `f6_pan_home_end_swapped`, `e_layout_hint_outside_its_group`, `d_layout_hint_deleted`, `d_layout_hint_only_a_comment`. About 500 lines.

### Lane DR2: drag to seat

- **Goal**: pointer, tap-then-tap and keyboard seat changes within a ring, with live redraw.
- **Owns**: in `index.html` `selectPanField`, the interactive branch of `paintPan`, the sheet's callers of `sizePanHits`, new drag handlers; drag tests in `tests/app.test.js` and `tests/e2e.test.js`.
- **Reads only**: the DS spec; `HPE.layout`.
- **TDD order**: "dragging a rim note onto another rim seat swaps the two and nothing else"; "a drop on another ring changes nothing"; "the same change from the keyboard alone"; "tap a note then a seat does the same"; "the preview redraws during the move"; "the arrangement reaches the generated deck, the record and the share link"; "mirror and anchor keep an arrangement"; "changing the note count of a ring resets only that ring".
- **Acceptance**: `node --test --test-name-pattern "drag|seat" tests/app.test.js tests/e2e.test.js` passes.
- **Verify**: `./tests/run.sh all`, plus a hand check on a phone at 380 px recorded on the PR (UNVERIFIED until done).
- **Non-goals**: any engine change.
- **Stop conditions**: a drag can produce an arrangement `readSeats` refuses.
- **Mutant delta (forecast)**: +5. 713 to 718. About 500 lines.

### Lane DOC: the long-form spec

- **Goal**: `docs/ENGINE-SPEC.md` and `docs/SCALE_ENGINE_PLAN.md` describe the shipped behaviour.
- **Owns**: those two files (the grammar, reasons, layout, share and options sections; the row on mirror). No code.
- **Reads only**: everything.
- **TDD order**: none (prose); the currency tests are the check.
- **Acceptance**: `python3 -m unittest tests.test_readme_currency -v` passes; `grep -c "LEFT-FIRST\|RIGHT-FIRST\|TOO_MANY_RIM" docs/ENGINE-SPEC.md` prints 0.
- **Verify**: `./tests/run.sh all`
- **Non-goals**: any code or data change. **Stop conditions**: the spec and the code disagree (fix the code lane, not the prose). **Mutant delta**: 0.

## 12. Test matrix

| Requirement | Test (lane) |
|---|---|
| D1 grammar, no ambiguity | grammar table, enumeration round trip, bare and explicit twins, climb through brackets (G1) |
| D2 copy agrees, examples parse | every `e.g.` parses (G1); label, placeholder and hint agree; every example parses (G2b) |
| D3 example | twenty pitches (G1); placeholder draws it (G2b) |
| D4 no caps, warning | overlap sweep, 150 rim, `labelFloor` thresholds, `SMALL_LABELS` built and shown live (S1); thirteen rim generates (G2b) |
| D5 no spill | table row 14 (G1) |
| D6 inner at top, ding down | fan seats, offset rule, G-RENDER (S1) |
| D7 anchor | anchor tests (S2); link round trip (S3); control (DR1) |
| D8 one direction | odd-right sweep (S2) |
| D9 four built-ins byte-identical | `git diff --exit-code -- data/decks.json` in every lane but P1; P1's diff confined to Pygmy `geom`; the golden deck fixture |
| D9 every seat reproduced | "the solver seats every built-in field where its diagram has it" (S2) |
| D9 drawings equal solver output | "draw exactly as the solver draws them", four decks (S2), five decks (P1) |
| D9 Pygmy redraw | `test_pygmy_geometry_equals_a_fresh_engine_run`, `test_pygmy_fields_and_chords_are_untouched_by_the_redraw`, PDF rebuild test (P1) |
| D10 old strings open, not misread | frozen ids (L0, G2b); version 2 record and version 3 link with a bar (G2b); cross-ring legacy order (S3) |
| D11 drawer | DS acceptance list as tests (DR1, DR2) |
| D12 copy only | count line counts inner and zero bottom (W1); hint sentence (G2b) |
| D13 MIRROR | one switch, off by default, stored true reads as on (W1) |
| D14 field wraps | three rows at 380 px, Enter submits (W1) |
| D15 bottom octave excluded | "bottom octave digits do not trigger the warning" (S1) |

## 13. Risks

1. **The silent reading in 6.4.** Mitigation is copy only, by D12.
2. **G-RENDER may contradict the clearance model.** S1 isolates the fan span and the offset rule in four named constants; P1 runs after S1, and its stop condition catches any drift.
3. **Saved even-rim decks flip, and a saved mirrored even-rim deck shows MIRROR on and looks reversed** (5.3). Accepted by D10; the README says so.
4. **Pygmy's print overlay keeps radius 60**, so its printed circles grow 2.2% inside an unchanged frame. The solver's packing bound says nothing collides; the hand check in P1 confirms it on paper (UNVERIFIED until then).
5. **Stale mutants.** 417 patches target `index.html`. Each lane runs the stale check and regenerates what it reports.
6. **Two tabs, old and new app.** CORRECTED by the eng review (R7): the claim that an old tab cannot harm newer records was false. Today's `rememberScale`, `replaceScale` and `forgetScale` match on the stored string, so an old tab that saves or deletes a scale whose string is unchanged overwrites a newer record with a version 2 one (anchor and seats lost) or removes it. Section 19, R7 isolates new records under a new storage key.
7. **The in-flight plan may land differently from section 2.** L0 re-checks every assumption there; P1's fixture version and drawing counts follow what is actually on main.
8. **`labelFloor` repeats the print ratios a third time.** Pinned by the parity test in S1.
9. **A textarea changes keyboard and autofill behaviour on iOS.** W1's hand check with a real keyboard is a merge condition.

## 14. Rollback

Each lane is one PR and reverts on its own, in reverse order. L0, G1 and G2a are inert. Reverting S1 restores the solver caps. Reverting S2 flips the redraws back and must be accompanied by reverting P1, because Pygmy's stored `geom` would no longer be the reverted engine's output for the default anchor option. Reverting P1 restores the previous `geom`, fixtures, mutants and both PDFs from the same commit. Reverting S3 or G2b after players have saved version 3 or 4 records leaves those records under the new storage key (section 19, R7), which the reverted app does not read. The reverted app reads the old key, which still holds every deck saved before S3 shipped. Decks saved after S3 are invisible until the lane is re-landed; nothing is deleted. Prefer rolling forward for S3 and G2b.

## 15. Exact text for CLAUDE.md and README

**CLAUDE.md, "Instrument layouts", Hijaz entry, first sentence (Lane S2).** Replace "Standard left-first zig-zag:" with:

> Standard zig-zag, note 1 at bottom centre, odd-numbered notes on the right and even-numbered on the left:

**CLAUDE.md, Pygmy entry (Lane S2).** Replace "Top rim is MIRRORED (right-first) zig-zag:" with:

> Top rim is the SAME zig-zag direction as Hijaz and Amara (odd notes right, even left); what differs is the anchor: bottom centre falls between notes 1 and 2:

**CLAUDE.md, replacing the whole "Generated layouts (2026-10-06, owner decisions)" paragraph (Lane S2; the sentences on inner notes and caps become true with S1, which merges first):**

> **Generated layouts.** One direction on every generated pan, odd or even rim: odd-numbered rim notes sit on the right, even-numbered on the left. Two ANCHORS, a per-deck option `anchor`: `one` (the default) puts note 1 at bottom centre (C# Hijaz 9, D Amara 9, D Kurd 10, D AMARA 10); `between` puts the bottom centre between notes 1 and 2 with note 1 on the right (F3 Low Pygmy). Older notes called these "left-first" and "mirrored (right-first)"; those words described the anchor, not two directions, and are retired. MIRROR reflects all three rings about the vertical axis and is the only thing that puts odd notes on the left. The anchor applies whether or not the pan has inner notes. Inner notes are only the notes typed after the inner bar: one sits at top centre, two at 128 and 52, more fan across the top half of the inner orbit, and they push the ding toward the player (0.1425, more when an inner index number would touch the ding). No inner notes means a centred ding. There are no note-count caps: a crowded pan draws smaller and carries the `SMALL_LABELS` warning, which ignores bottom octave digits; it is never refused. The solver seats every field of every built-in exactly where its diagram has it, from the deck's scale string and default options (`anchor: between` for Pygmy).

**CLAUDE.md, added to the Pygmy entry (Lane P1):**

> Pygmy's `geom` is engine output: `node tools/gen_deck.js "[C3] [Db3] [Eb3] F3 | G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]" --anchor between`. Its field angles, chords and print overlay are still hand-verified data. The other four built-ins keep their stored bytes, and a test proves their drawings equal solver output.

(Until G2b wires the new grammar the lane writes the equivalent legacy string and G2b swaps it.) The sentence "The three original decks are literal data and never pass through the solver" is deleted with the paragraph it sat in.

**CLAUDE.md, new short paragraph under "Architecture" (Lane G2b):**

> **Scale strings.** One ascending line: `[C] [D] (E) [F#] B D E | F# G`. Round brackets (or a trailing slash, or a `|` straight after the note) mark the ding; square brackets mark a bottom note at its pitch position; a `|` after the top notes starts the inner notes. Strings written before 2026-10 used `/` for inner notes and `|` for a bottom list; they are read only by `HPE.core.parseLegacySeed`, chosen by the version tag on a stored record or share link (3 or lower), never by looking at the string. The deck id hashes `identitySeed`, not the canonical string, so no id moved.

**README, replacing the grammar sentences of the "+ ADD A SCALE" bullet (Lane G2b; the drawer sentence is added by DR2):**

> type your pan low to high on one line, the ding in round brackets and each bottom note in square brackets where its pitch falls, e.g. `[C] (D) A C D E F G A C`. If the pan has inner notes, put a `|` before them. The line under the box counts the top, inner and bottom notes it read. Pick a palette; ADJUST LAYOUT opens a drawer where you can drag a note to another seat in its ring, choose whether note 1 sits at bottom centre, and MIRROR the pan; then GENERATE CARDS. No pan is too big; a crowded one warns that its labels print small. Scales saved before this version still open. A saved scale with an even number of rim notes now draws with its sides swapped, to match every other pan; switch MIRROR to swap them back.

**README, "Layout notes", Pygmy top shell bullet (Lane S2).** Replace "zig-zag ascends right-first, Eb5 at top centre" with:

> zig-zag runs the same way as the other decks (odd fields right, even left) with bottom centre between fields 1 and 2, Eb5 at top centre

## 16. What was not read or run

- No browser was run and no pan or PDF was rendered. Every statement about 380 px, the placeholder's fit, label fit, hit-target pixels and inner-number clearance is geometry or estimate, labelled where made.
- No test suite and no mutant sweep was run.
- No file was written; the probes exist only as the sources in the appendices. Appendix B reuses a read-only helper already in the session scratchpad (`plan-probe/lib.js`, function `loadPatched`), reproduced there in words.
- Kurd 10 and Amara 10 are not on main; stand-ins were used. Pygmy's 53rd chord is not on main.
- Read by grep or in part only: `src/engine/pdf*.js`, `src/engine/select.js` beyond `build`, `tools/validate.py`, `docs/ENGINE-SPEC.md`, the bodies of the test files (names and counts were read), and the in-flight plan beyond its mirror, fixture and mutant lines. How a warning reaches the title-card blurb was not re-read this session; S1 follows the path `NO_THIRDS` takes.
- Whether `print_decks_v1.json` is bumped or edited in place was not established.
- The Ayasa and Xenith pages were not opened. `/frontend-design:frontend-design` was not invoked. Nothing under `.claude/worktrees` was read or touched.
- Lane line counts and every mutant count after 685 are forecasts.

## 17. Self-check

Grounding 9; completeness against D1 to D15 and items 1 to 10: 9; grammar soundness 9; lane independence 9; testability 9; honesty 10; protection of shipped decks 9; readability 9.

Weakest point: the inner-ring geometry for three or more notes, and the look of the redrawn Pygmy on paper, rest on a clearance model and two gates rather than on a rendered pan.
Second weakest: lanes that share `index.html` are independent only by named function and by order, and their sizes are estimates.

## 18. Prompt feedback

- The brief gives Pygmy's frame change backwards. Measured: the stored-deck fallback is `-147.68 ... 295.36` and the solver's `ext` gives `-146.2 ... 292.4`.
- "`geom` becomes solver output" collides with an existing convention the brief does not mention: no built-in carries `ext`, a test enforces that, and the in-flight plan strips it from its two new decks. Its figures (104 numbers, 2.96 units) describe the "keep `ext`" case. I raised it as Q1 rather than decide it.
- "No conversion to preserve a look" has a consequence the brief does not spell out: a saved even-rim deck with `mirror: true`, which today looks like Amara, opens reversed with MIRROR on.
- The brief says today's solver needs something new to reproduce Pygmy; in fact today's unmirrored solver already seats Pygmy 17 of 17. What fails today is the default anchor once the inner-note link is cut, and `mirror: true`.
- "Five built-ins" and "53 cards" describe a main that does not exist yet; two decks had to be measured on stand-ins.
- "Prove the ding offset with a RENDERED pan" cannot be met by a planner that may not render or write; only the named gate was available.
- The brief allows scratch scripts on stdin, but the prior probes depended on a helper file in the scratchpad; I reused it read-only.
- D13 puts MIRROR on the sheet and D11 puts "a mirror" in the drawer; I read these as one control that moves (A22).
- D12 names "the count line", but today's line under the box lists notes and has no counts, and it uses a bar as a separator; I specified a new line.
- D9 says to name every test, fixture and mutant the Pygmy redraw touches, while the fixture versions and Pygmy row counts depend on in-flight lanes; the names given are for the assumed main.
- The print radius of a built-in is a literal in an out-of-scope overlay, so "engine output is the source of truth" stops at the screen for Pygmy (Q2).

---

## Appendix A: the prototype parser (run with `node -` from the repo root)

```js
const SEMI={C:0,D:2,E:4,F:5,G:7,A:9,B:11}, ACC={"":0,"#":1,b:-1};
const NOTE_RE=/^([A-G])(#|b)?(-1|[0-9])?$/;
const midiOf=(n,o)=>12*(o+1)+SEMI[n.l]+ACC[n.a], octOf=(n,m)=>(m-SEMI[n.l]-ACC[n.a])/12-1;
const R=(code,why)=>({ok:false,code,why});
function lexNote(s){const m=NOTE_RE.exec(s);return m?{l:m[1],a:m[2]||"",o:m[3]===undefined?null:+m[3],typed:m[3]!==undefined}:null;}
function parse(input){
  const toks=input.replace(/\|/g," | ").split(/\s+/).filter(Boolean); if(!toks.length) return R("NO_DING","empty");
  const items=[];
  for(const t of toks){ if(t==="|"){items.push({k:"bar"});continue;} if(t==="/") return R("BAD_NOTE","slash");
    const dingy=t[0]==="("||t.endsWith(")")||t.endsWith("/"), boty=t[0]==="["||t.endsWith("]");
    if(dingy&&boty) return R("BAD_NOTE","bracket");
    if(dingy){const b=/^\((.*)\)$/.exec(t)||/^(.*)\/$/.exec(t);const n=b&&lexNote(b[1]);if(!n)return R("BAD_NOTE","reason");items.push({k:"ding",n});continue;}
    if(boty){const b=/^\[(.*)\]$/.exec(t);const n=b&&lexNote(b[1]);if(!n)return R("BAD_NOTE","bracket");items.push({k:"bot",n});continue;}
    const n=lexNote(t); if(!n) return R("BAD_NOTE","reason"); items.push({k:"note",n}); }
  const dings=items.map((x,i)=>x.k==="ding"?i:-1).filter(i=>i>=0), bars=items.map((x,i)=>x.k==="bar"?i:-1).filter(i=>i>=0);
  let di, innerBar=-1, mode;
  if(dings.length>1) return R("NO_DING","two");
  if(dings.length===1){ mode="explicit"; di=dings[0]; if(bars.length>1) return R("BAD_NOTE","bar");
    if(bars.length===1){ if(bars[0]<di) return R("BAD_NOTE","barFirst"); innerBar=bars[0]; } }
  else { mode="bare"; if(bars.length===0) return R("NO_DING","which"); if(bars.length>2) return R("BAD_NOTE","bar");
    di=bars[0]-1; if(di<0||items[di].k!=="note") return R("NO_DING","which");
    items[di].k="ding"; items.splice(bars[0],1); if(bars.length===2) innerBar=bars[1]-1; }
  for(let i=0;i<di;i++) if(items[i].k!=="bot") return R("NO_DING",dings.length?"below":"which");
  const pre=items.slice(0,di).map(x=>x.n), ding=items[di].n, post=[]; let zone="rim", rimN=0, innerN=0;
  for(let i=di+1;i<items.length;i++){const x=items[i];
    if(x.k==="bar"){ if(rimN===0) return R("BAD_NOTE","barEmpty"); zone="inner"; continue; }
    if(x.k==="bot") post.push({n:x.n,z:"bottom"}); else {post.push({n:x.n,z:zone}); zone==="rim"?rimN++:innerN++;} }
  if(innerBar>=0&&innerN===0) return R("BAD_NOTE","barEmpty");
  if(ding.o===null) ding.o=3; ding.m=midiOf(ding,ding.o); if(ding.m<0||ding.m>127) return R("NOTE_OUT_OF_RANGE","reason");
  let right=ding.m;
  for(let i=pre.length-1;i>=0;i--){const n=pre[i];
    if(n.o===null){let m=midiOf(n,9)+24; while(m>=right) m-=12; n.m=m;} else n.m=midiOf(n,n.o);
    if(n.m<0||n.m>127) return R("NOTE_OUT_OF_RANGE","reason");
    const lim=(i===pre.length-1)?ding.m:pre[i+1].m;
    if(i===pre.length-1 ? n.m>lim : n.m>=lim) return R("NOTE_OUT_OF_ORDER","below");
    n.o=octOf(n,n.m); right=n.m; }
  let prev=ding.m, lastTop=ding.m, lastBot=pre.length?pre[pre.length-1].m:-Infinity;
  for(const p of post){const n=p.n;
    if(n.o===null){let m=midiOf(n,-1)-12; while(m<=prev) m+=12; n.m=m;} else n.m=midiOf(n,n.o);
    if(n.m<0||n.m>127) return R("NOTE_OUT_OF_RANGE","reason");
    if(n.m<prev) return R("NOTE_OUT_OF_ORDER",p.z==="inner"&&p===post.find(q=>q.z==="inner")?"afterBar":(prev===ding.m?"ding":"reason"));
    if(p.z==="bottom"){ if(n.m<=lastBot) return R("NOTE_REPEATED","reason"); if(n.m<=ding.m) return R("NOTE_OUT_OF_ORDER","ding"); lastBot=n.m; }
    else { if(n.m<=lastTop) return R(lastTop===ding.m?"NOTE_OUT_OF_ORDER":"NOTE_REPEATED",lastTop===ding.m?"ding":"reason"); lastTop=n.m; }
    n.o=octOf(n,n.m); prev=n.m; }
  const tops=post.filter(p=>p.z!=="bottom"), bots=pre.map(n=>({n})).concat(post.filter(p=>p.z==="bottom"));
  const want=((ding.m+7)%12+12)%12; if(!tops.some(p=>((p.n.m%12)+12)%12===want)) return R("NO_FIFTH","reason");
  const fields={"0":[ding.l+ding.a,ding.o,ding.m,"ding",null,"Ding"]};
  tops.forEach((p,i)=>{fields[String(i+1)]=[p.n.l+p.n.a,p.n.o,p.n.m,p.z,null,String(i+1)];});
  const base=Math.max(101,tops.length+1);
  bots.forEach((p,i)=>{fields[String(base+i)]=[p.n.l+p.n.a,p.n.o,p.n.m,"bottom",null,"U"+(i+1)];});
  return {ok:true,fields,mode};
}
function split(f){const top=[],bot=[];for(const id in f){if(id==="0")continue;(f[id][3]==="bottom"?bot:top).push(id);}const by=(a,b)=>a-b;return{top:top.sort(by),bot:bot.sort(by)};}
function format(f){const s=split(f),d=f["0"],line=[{m:d[2],r:1,t:"("+d[0]+d[1]+")"}];let bar=false;
  s.bot.forEach(id=>{const x=f[id];line.push({m:x[2],r:0,t:"["+x[0]+x[1]+"]"});});
  s.top.forEach(id=>{const x=f[id];line.push({m:x[2],r:2,t:x[0]+x[1],inner:x[3]==="inner"});});
  line.sort((a,b)=>a.m-b.m||a.r-b.r);const out=[];for(const x of line){if(x.inner&&!bar){out.push("|");bar=true;}out.push(x.t);}return out.join(" ");}
function identity(f){const s=split(f),d=f["0"];let out="("+d[0]+d[1]+")";
  let rim=s.top.length;for(let n=0;n<s.top.length;n++){if(f[s.top[n]][3]==="inner"){rim=n;break;}}
  const mark=rim!==Math.min(s.top.length,11)?rim:-1;
  for(let n=0;n<s.top.length;n++){if(n===mark)out+=" /";out+=" "+f[s.top[n]][0]+f[s.top[n]][1];}
  if(mark===s.top.length)out+=" /";
  if(s.bot.length){out+=" |";for(const id of s.bot)out+=" "+f[id][0]+f[id][1];}
  return out;}
```

Checks run on it this session: (1) every row of the table in 4.5; (2) the enumeration: recurse over every sequence of length 1 to 6 from `["|","(D)","D/","[A]","[C3]","A","C","D","E4","/"]`; for each accepted string assert `parse(format(fields))` gives the same fields and the same string, record `identity(fields)` against the field set, and for bare-mode strings assert the `(X)` rewrite gives the same fields; (3) legacy comparison: load the shipped engine modules `core` and `layout` from `src/engine/` into a `node:vm` context, generate random legacy strings, and for each one `core.parseSeed` accepts assert `identity(fields) === core.formatSeed(fields)` and that `parse(format(fields))` returns the same fields; (4) ids: `core.deckId(parse(string).fields)` for the five built-in strings; (5) the neither-mark comparison of 5.2.

## Appendix B: the solver probe (in-memory patches to `src/engine/layout.js`)

A loader reads each engine module as text, applies `[module, from, to]` replacements in memory (throwing if an anchor is missing), and runs the result in a fresh `node:vm` context; no file is touched. Patches: `var RIM_MAX = 11;`, `var INNER_MAX = 2;` and `var BOTTOM_MAX = 6;` set to `Infinity` in `core` and `layout`; the body of `innerAngles` (`return INNER_ANGLES.slice(0, count);`) replaced by

```js
if (count === 0) return [];
if (count === 1) return [90];
var span = 180, step = Math.min(76, span / (count - 1));
var left = 90 + step * (count - 1) / 2, out = [], i;
for (i = 0; i < count; i += 1) { var j = Math.floor(i / 2); out.push(i % 2 === 0 ? left - j * step : left - (count - 1 - j) * step); }
return out;
```

in `placeZones`, the expression `isCentred(counts) ? rimAnglesFromBottom(counts.rim) : rimAngles(counts.rim)` replaced by

```js
(function (n, anchor) { var step = n ? 360 / n : 0, out = [], i;
  for (i = 0; i < n; i += 1) { var sign = (i % 2 === 1) ? -1 : 1;
    out.push(norm(270 + sign * (anchor === "between" ? Math.floor(i / 2) + 0.5 : Math.ceil(i / 2)) * step)); }
  return out; })(counts.rim, HPE.__anchor)
```

and, in `geometry`, `var dingDy = isCentred(counts) ? 0 : DING_DY;` replaced by `var dingDy = isCentred(counts) ? 0 : (HPE.__dy || DING_DY);`. The probe sets `HPE.__anchor` and `HPE.__dy` before each `layout.solve`. The adaptive offset is a loop in the probe: start `__dy` at 0.1425, compute the clearance of Appendix C from the returned `geom` and inner seat angles, and add 0.0025 until it is at least 0.01 or the offset reaches 0.30.

Section 5.1 compares `solve` on each deck's parsed fields with `data/decks.json`, then draws both through the app: `const {boot} = require("./tools/sandbox.js"); const app = boot(); app.get("pan(Object.assign({}, DECKS[i], {geom: ..., fields: ...}), chord)")`, and compares the SVG strings and their numbers. Section 5.3 compares against an unpatched load. Section 5.4 computes sizes from the returned `geom` with R = `Math.round(74 / ext * 10) / 10`. The overlap sweep checks every pair of same-shell circles and every top circle against the ding. Section 5.8 takes the smallest centre-to-centre distance d among all fields and reports d / (2 x ext) x pan width.

## Appendix C: the ding-offset clearance (5.5)

For each inner note at seat angle a: the index number is centred at radius `inner - r_note - n_in` along a (where `pan()` draws an inner note's number); the ding is centred `ding_dy` below the pan centre; clearance = distance between those two points minus `r_ding` minus `0.7 x f_num` (0.7 is the solver's own label-reach factor). The pan's clearance is the smallest over its inner notes.

### Critical Files for Implementation
- /Users/ray/Projects/handpan-cards/src/engine/core.js
- /Users/ray/Projects/handpan-cards/src/engine/layout.js
- /Users/ray/Projects/handpan-cards/src/engine/share.js
- /Users/ray/Projects/handpan-cards/index.html
- /Users/ray/Projects/handpan-cards/data/decks.json

## 19. Engineering review amendments (2026-10-07, binding on every lane)

Where this section and sections 1 to 18 disagree, this section wins. Each
item names the lane that owns it. R7 to R9 came from the outside voice
(Codex); R1 to R6 from the review itself.

**R1. Legacy strings live in far more files than G2a lists (G2a, G2b).**
Measured on main `e749957` with

`grep -rlE "[A-G][#b]?[0-9]? (/|\|) [A-G][#b]?[0-9]?" tests tools docs/ENGINE-SPEC.md docs/SCALE_ENGINE_PLAN.md README.md index.html src | grep -v tests/mutants/`

the hits are: `tests/core.test.js` (32 lines), `tests/sequence.test.js` (4),
`tests/layout.test.js` (3), `tests/select.test.js` (2),
`tests/preview.test.js` (2), `tests/e2e.test.js` (1), `tests/app.test.js` (1),
`tests/test_print.py`, `tests/test_pdf_parity.py`,
`tests/test_pdf_deck_adapter.py`, `tests/test_gen_deck.py`,
`tests/test_deck_data.py` (1 each), `tools/decks.py` (2),
`tools/regen_engine_corpus.js` (1), the fixtures `engine_corpus_v1.json` (6),
`synthetic_scales.json` (5), `print_decks_v1.json` (2),
`golden_decks_v5.json` and `golden_decks_v3.json` (1 each), `index.html` (1),
`docs/ENGINE-SPEC.md` (8), `docs/SCALE_ENGINE_PLAN.md` (19), and 12 mutant
patches. Lane U2 adds a Pygmy recipe string to `tests/test_deck_data.py`.
- G2a's ownership is this grep's output at its lane base, not the four files
  in its block. For each hit G2a either routes the call through
  `parseLegacySeed` or leaves it for G2b and says which in the PR.
- `tools/gen_deck.js` gains `--legacy`, which reads the seed with
  `parseLegacySeed`. G2a owns the flag. Every recipe that is frozen history
  (the U2 Amara 9 and Pygmy recipes, P1's Pygmy recipe if written before
  G2b) is run with `--legacy` or rewritten in the new grammar by G2b with the
  deck id asserted unchanged.
- G2b's acceptance gains: the grep above, run at its head, lists only files
  that call the legacy reader by name, frozen fixtures, mutants and the two
  history docs. `docs/ENGINE-SPEC.md` is rewritten by DOC;
  `docs/SCALE_ENGINE_PLAN.md` is history and is not rewritten.
- `golden_decks_v3.json` is frozen history and is not edited.

**R2. The boot rewrite must not lose records (G2b).** `restoreScales`'s
rewrite keeps, byte for byte and at the same index, every record it cannot
read: a newer version, a parse failure, a non-object. Two records that
resolve to the same deck id collapse to the first. Tests 12 and 13 in G2b:
"the boot rewrite leaves an unreadable record byte-identical at its index"
and "two records for one deck id collapse to the first". A storage write
that throws leaves the old list in place (today's `writeScales` swallows the
error; the test asserts the deck still opens).

**R3. Pins are pins, not red-first tests.** L0 tests 1 and 2, G2b test 10,
P1 test 2 and all of G2a are characterisation tests: green when written, by
construction. "Red first" in those blocks reads "written before the change
they guard". A reviewer does not fail a lane because a pin was never red.
Every other test in section 11 is red first as written.

**R4. Five merge conditions need a person, and AFK cannot supply one.** They
are: the DS sign-off, G-RENDER (S1), the print check (P1), and the phone
checks (W1, DR2). They stay owner gates; none is waived or auto-passed.
- S1 adds an automated form of G-RENDER so the human look is a confirmation
  and not the only evidence: `tests/layout.test.js` "no inner index number
  meets the ding or a neighbour on the G-RENDER shapes", computed from the
  coordinates `pan()` emits for the seven shapes named in the S1 block.
- Without the owner, the run may complete L0, G1 and G2a (G2a needs only
  L0's `parseLegacySeed`), draft the DS spec, and take S1 to an open PR with
  CI green and a reviewer verdict. S1 does not merge, and S2, P1, S3, W1,
  G2b, DR1, DR2 do not start, until the owner has passed G-RENDER.
- Section 11.1 item 8 is corrected accordingly: G2a runs after L0, G2b after
  G1, S1, S3 and W1.

**R5. Nothing bounds deck generation once the parser caps go (G2b).** Test
14 in G2b: "a forty-note pan generates its deck inside the time budget"
(20 rim, 8 inner, 12 bottom, built from the placeholder's pitch set). The
lane measures the wall time on CI first, records it in the PR, and sets the
budget at three times that figure. Stop condition added to G2b: the measured
time is over 5 seconds (UNVERIFIED: no forty-note pan was generated in this
review), in which case the lane stops and reports instead of raising the
budget.

**R6. Section 2 was stale.** Corrected in place.

**R7. Old tabs can destroy newer records (S3, L0).** Risk 6 was false as
written; see its correction. Auto-decision AD-ER-1, conservative and
non-destructive, overturnable by the owner:
- From the first lane that writes a record newer than version 2 (S3), the
  app reads and writes saved scales under a new key, `hpfc.scales.v3`. The
  old key `hpfc.scales` is never written again and never deleted.
- On boot, if the new key is absent, the app copies the old key's list into
  it (through the reader chosen by each record's version) and carries on. If
  the new key is present, the old key is ignored.
- Consequence, accepted and stated in the README: a scale saved afterwards
  in a tab still running the old app lands under the old key and does not
  appear in the new app. This needs a tab held open across a deploy.
- L0 routes every read and write of the list through one pair of functions
  so S3's key change is a one-line edit. S3 owns the key, the copy, and the
  tests: "the first boot copies the old key and leaves it byte-identical",
  "a write never touches the old key", "an old-key record saved after the
  copy does not overwrite a new-key record".
- Rollback (section 14) is corrected in place to match.

**R8. The canonical string can spell an octave the lexer refuses (G1).**
`[B#] (C#-1) G# B# D#` infers a bottom note at MIDI 0 spelled `B#-2`, and
the lexer reads only `-1` to `9`. G1: inference refuses, with `BAD_NOTE`,
any note whose spelled octave is outside `-1` to `9`, so every string
`formatSeed` emits is one `parseSeed` reads. Test 15 (G1, rerun in G2b):
"formatSeed never emits a note parseSeed refuses", over `B#`, `Cb`, `E#` and
`Fb` at both ends of the MIDI range, typed with and without octaves.
Appendix A's prototype does not do this and is not the reference for it.

**R9. W1's test 5 cannot pass before the flip.** Moved to G2b; corrected in
place.

## 20. Coordinator record and amendment 2 (2026-10-07, binding on every lane not yet merged)

Where this section differs from sections 1 to 19 or from a lane block, this section holds.

### 20.1 Lane outcomes

- **G2a**: PR #261 merged (main 463258a, 697 mutants), review PASS_WITH_NITS.
- **G1**: PR #262 merged (main fc499bd, 706 mutants), review PASS_WITH_NITS. `HPE.core.parseScale` and `formatScale` exist, unwired.
- **S1**: PR #263 merged (main a98b799, 711 mutants), review PASS_WITH_NITS, owner passed G-RENDER by eye ("S1 looks good"). Deviations: it edited `docs/ENGINE-SPEC.md`, `tests/core.test.js` and the corpus fixture outside its Owns (the `SMALL_LABELS` row), and it models label overlap by glyph box, not by disc. One-inner pans typeable before G2b redraw (inner seat 128 to 90, small rims shrink; 5 rim + 1 inner `r_note` 0.19 to 0.1453): owner, "Accept the redraw".
- **DS**: the design spec is `docs/plans/2026-10-07-scale-drawer-design-spec.md` (PR #260), not the filename section 10 names. Owner signed off the design on mock version 3, 2026-10-07. Its sections 20, 21 and 22 are binding on W1, DR1 and DR2.

### 20.2 Owner answers recorded here (2026-10-07)

- O1: one pan is one scale; version-blind id matching is intended. Pin it with a test (G2b).
- A 32-bit id collision keeps one record: accepted, noted in the README (DOC lane).
- Legacy `(C0) G0 | B#` (a B#-2 field): the old reader refuses it too (G2b).
- `SMALL_LABELS` on print: short title-card string (Lane PF). Title card only; decision A16 stands, no chord-card badge, so a CHORD_ONLY file of a crowded pan carries no notice.
- A crowded pan's title-card note line: wrap to two lines. **Lane P1** owns it (finding F3: `_blurb` and `blurb` draw the note line as one unfitted line at Label 4.2 pt; about 100 characters of top shell runs off the 177.6 pt card once G2b lifts the cap). P1 adds a test that no title-card line of a 20-note top shell is wider than `CW - 24` pt.
- A typed scale with inner notes opens ON CENTRE, always (anchor `one`). Pygmy's built-in data is unchanged.
- Inner notes follow the top mirror switch. An old single `mirror: true` reads as both on.
- The open ADJUST LAYOUT button carries a close mark inside it, after the label.
- OQ16 of the two-beginner-decks plan: Lane U3, after PF.

### 20.3 Carried into Lane G2b

1. The B#-2 case above: the legacy reader refuses it.
2. Fold `SCALE_REASONS` into `REASONS` under one key scheme.
3. R8 wording against the code: the MIDI range is checked before the spelled octave, so `(C9) G9 C` gives `NOTE_OUT_OF_RANGE`. Fix the wording or the order, and say which.
4. The `--legacy` flag test cannot tell the two readers apart; make it.
5. The `reader` tag in `synthetic_scales.json` is read by nothing (the corpus tool hardcodes legacy).
6. The app placeholder test points back at `parseSeed`; `run_gen` defaults to `--legacy`.
7. The guard for a repeated bottom note after the ding has no test.
8. G2b owns the `#scale-box` label and placeholder wording and the D3 example count line (spec acceptance lines 4, 9 and 11). W1 ships today's wording.
9. The end-to-end crowded seed for `SMALL_LABELS` (PF's tests inject the warning).

### 20.4 The design spec against this plan (coordinator auto-decisions, owner away)

- **MIRROR is renamed.** Section 10 lists renaming MIRROR under "must NOT". The owner's mock comment MC 3 overrides it: `MIRROR TOP` and `MIRROR BOTTOM` (20.5).
- **Pinned elements.** Section 10's "only it and the delete row are pinned" gains one: `#scale-plate-band` is sticky while the drawer is open (spec RD 1, owner decision).
- **Ownership of shared functions.** A change belongs to the lane whose tag is on the acceptance line that needs it. Where two lanes need the same function (`paintPan`'s re-key, `pan()`'s interactive branch, the `previewBox` keydown handler), the earlier lane makes its change and the later lane extends it; both lane briefs name the function.
- **No regression window between DR1 and DR2.** DR1 keeps today's note-moving controls working on an Edit deck with stored seats until DR2 replaces them. If the spec's DR1 lines cannot hold with that, DR1 stops and reports.
- **W1 order.** W1 starts after S2, S3 and the spec are on main (AM-6).

### 20.5 Amendment 2: two mirror switches (eng-reviewed and Codex-reviewed; AM-1 to AM-8 confirmed by the owner, AM-9 is a parsing detail under AM-3)

Source: owner comment on the drawer mock ("Top rim and bottom rim should be independently mirror controlled") and interview 6. The spec's section 21 holds the screen side; this holds the engine, data and lane side. "Text changes to the plan" below are applied by reading, not by editing the older sections.

#### Goal

One pan has two independent reflections: TOP (rim and inner rings) and BOTTOM (bottom ring). Every deck, record and share link that exists today draws exactly as it does today.

#### Non-goals

- No third switch for the inner ring.
- No change to any built-in deck's bytes, to `geom`, or to the anchor.
- No conversion of stored records. No new storage key beyond AD-ER-1's `hpfc.scales.v3`.
- No change to the default for a typed scale (both off, anchor `one`).
- No change to `LAYOUT_HINT` ("... or mirror the pan" still reads true).

#### Decisions

| Id | Decision | Source |
|---|---|---|
| D13' | Two switches, `MIRROR TOP` and `MIRROR BOTTOM`, both off by default. Replaces D13. | owner, MC 3 |
| A20' | An old `mirror: true` is read as both on. No conversion. | owner, interview 6 |
| A22 | Unchanged: `#scale-mirror` keeps its id and is the TOP switch. New id `#scale-mirror-bottom`. | spec 21 |
| AM-1 | Option shape: `mirror` (boolean, top shell) stays; new boolean `mirrorBottom`. When `mirrorBottom` is absent it takes the value of `mirror`. | coordinator, owner confirmed 2026-10-07 |
| AM-2 | Share options line: the mirror field becomes `0` (neither), `1` (both), `t` (top only), `b` (bottom only). Versions 1 and 2 accept only `0` or `1`, as today. `t` and `b` are read and written only in version 3 and later. | coordinator, owner confirmed 2026-10-07 |
| AM-3 | CLI: `--mirror` keeps meaning both; `--mirror-top` and `--mirror-bottom` set one shell. | coordinator, owner confirmed 2026-10-07 |
| AM-4 | `MIRROR BOTTOM` is disabled on a pan with no bottom notes; a writer then stores `mirrorBottom: false`. | coordinator, owner confirmed 2026-10-07 |
| AM-5 | One resolution rule, in one function. `layout.js` gains `resolveMirrors(options, seedOptions)` returning `{top, bottom}`: top is `options.mirror` if the key is present, else `seedOptions.mirror`; bottom is `options.mirrorBottom` if present, else `seedOptions.mirrorBottom` if present, else top. `core.js` does NOT fill the default: its reader whitelists the key and leaves it absent. `select.build` writes what `resolveMirrors` returned. | eng review, owner confirmed 2026-10-07 |
| AM-6 | W1 starts after S3 is on main. S3 no longer runs beside W1. | eng review, owner confirmed 2026-10-07 |
| AM-7 | A record or link whose two mirrors differ is written as version 3 or later, never as 2. | eng review, owner confirmed 2026-10-07 |
| AM-8 | S3 makes the editor carry `mirrorBottom` untouched: `resetSheetState` reads it from the record being edited, `sheetOptions` writes it back, and both app `solve` calls pass it. No new control in S3. A top-only link opened, renamed and saved in an S3 build keeps its bottom ring. | Codex P1, owner chose "S3 carries both" |
| AM-9 | CLI parsing keeps two tri-state values (unset, true, false). `--mirror` sets both true. `--mirror-top` sets top true and, after the loop, bottom false if nothing set it; `--mirror-bottom` the reverse. Flag order never matters. | Codex P2, folded in |

#### Text changes to the plan

**7.4** replaces its opening ("MIRROR replaces every seat angle a with 180 minus a, on all three rings; it never changes geometry. Under D8 it is the only thing that puts odd rim notes on the left.") with: "MIRROR TOP replaces every seat angle a with 180 minus a on the rim and inner rings. MIRROR BOTTOM does the same on the bottom ring. Neither changes geometry. Under D8, MIRROR TOP is the only thing that puts odd rim notes on the left." The table's last row moves under MIRROR BOTTOM; the rest under MIRROR TOP. The A20 sentence becomes A20'.

**8, Mirror bullet** becomes: "two boolean options, `mirror` (top shell) and `mirrorBottom`. Both compose with `seats` as `mirror` does today. Absent `mirrorBottom` takes `mirror`'s value, resolved once in `layout.resolveMirrors` (AM-1, AM-5). Neither is hashed into the deck id." The options line sentence gains AM-2 and AM-7.

**8, options line** (`palette, parent, mirror, anchor, name`): unchanged in shape; `mirror` takes four values from version 3.

**5.6 blast radius**: the `scale-mirror-` row counts are measured history and are not edited; the new id `scale-mirror-bottom` falls under the same prefix.

**9, copy**: the switch texts and the helper of spec MC 3.

**Lane S3**: also owns, in `index.html`, the `mirrorBottom` carry of AM-8 (`resetSheetState`, `sheetOptions`, the two `solve` calls). **Lane S2**, TDD item 7 "mirror reflects all three rings" becomes test 3 below. **Lane W1**: goal reads "the mirror is two switches"; "replaced by one element `#scale-mirror`" becomes "replaced by `#scale-mirror` and `#scale-mirror-bottom`"; test 6 becomes "MIRROR TOP and MIRROR BOTTOM are two switches, both off by default, and each carries its own choice into the deck"; test 7 becomes "a deck stored with mirror true and no mirrorBottom opens with both switches on". `tools/sandbox.js` and `tests/fixtures/app_surface_v1.json` gain the new id.

**11.1 Order**, item 7 (W1): "After S2 (MIRROR's meaning), after DS (its layout)" gains "and after S3 (AM-6)"; "MIRROR switch" becomes "MIRROR switches".

**15, the Generated layouts paragraph**: "MIRROR reflects all three rings about the vertical axis and is the only thing that puts odd notes on the left." becomes "MIRROR TOP reflects the rim and inner rings about the vertical axis and is the only thing that puts odd notes on the left; MIRROR BOTTOM reflects the bottom ring. A record with one stored mirror reads as both."

**19 / ledger**: D13 marked superseded by D13'; A20 by A20'.

**Mutant forecasts**: every absolute count in the lane blocks is stale (main is at 706). Read each forecast as its delta only.

#### Where the code changes (anchors, not lines)

| Place | Change | Lane |
|---|---|---|
| `src/engine/core.js` option reader (the `options.mirror !== undefined` block) | whitelist `mirrorBottom`, boolean or `badNote`; leave it absent when not given. `DEFAULT_OPTIONS` and the reader's `out` literal are NOT given a `mirrorBottom` key | S2 |
| `src/engine/layout.js` `placeZones(counts, mirror)` and `solve`'s `var mirror =` line | new `resolveMirrors`; `placeZones(counts, top, bottom)`; `rims` and `inners` use top, `bottoms` uses bottom | S2 |
| `src/engine/select.js` `build` (the `var mirror =` line, the `solve` call, the `options:` literal) | call `resolveMirrors`, pass both to `solve`, write both onto `deck.options` | S2 |
| `tools/gen_deck.js` option loop | `--mirror-top`, `--mirror-bottom`; `--mirror` sets both | S2 |
| `src/engine/share.js` `optionsLine` and `readOptionsLine` | AM-2. The reader takes the version: `t`/`b` return null below 3; any other character returns null at every version. The writer maps (top, bottom) with bottom defaulting to top | S3 |
| `index.html` `resetSheetState`, `sheetOptions`, stored record `o`, and BOTH app calls of `layout().solve(..., { mirror: ..., order: ... })` (`solvePreviewLayout` and the one in `generateDeck`) | carry `mirrorBottom` from the edited record, store it, pass it to both calls; no control (AM-8) | S3 |
| `index.html` the mirror button and handler | two switches driving the two values S3 already carries | W1 |
| `index.html` drawer | both switches moved in; status rows 14 and 21 | DR1 |
| README, `docs/ENGINE-SPEC.md` mirror rows | rewritten | docs lane |

#### Tests added (red first), by lane

**S2**
1. `tests/layout.test.js` "mirrorBottom reflects the bottom ring and nothing else": Pygmy counts, `{mirror:false, mirrorBottom:true}`; rim and inner angles equal the unmirrored run; each bottom angle is `180 - a` normalised.
2. "mirror with mirrorBottom false reflects rim and inner and leaves the bottom ring".
3. "an absent mirrorBottom takes the value of mirror": `{mirror:true}` equals `{mirror:true, mirrorBottom:true}` field for field, and equals today's `{mirror:true}` golden angles.
4. "the call's mirrorBottom beats the seed's, and the seed's beats the top value": three `solve` calls over a seed with `options.mirrorBottom` set.
5. `tests/core.test.js` "mirrorBottom must be a boolean", and "a seed read without mirrorBottom has no mirrorBottom key".
6. `tests/select.test.js` "build writes both mirrors onto deck.options; a seed with only mirror true gets mirrorBottom true".
7. `tests/test_gen_deck.py`, on a pan with bottom notes: "--mirror-top alone reflects the top shell and not the bottom"; "--mirror-bottom alone reflects the bottom and not the top"; "--mirror equals both flags, in either order".

**S3**
8. `tests/share.test.js` "the mirror field round-trips all four states in version 3".
9. "a version 2 link with mirror 1 decodes to both mirrors on".
10. "t or b in a version 1 or 2 options line is refused", and "any other character in the mirror field is refused at version 3".
11. "a seed with mirror true and no mirrorBottom writes 1".
12. `tests/app.test.js` "a top-only deck opened in the editor, renamed and saved keeps mirrorBottom false" (AM-8).
13. `tests/app.test.js` "a deck with unequal mirrors and a moved note generates cards with the bottom ring unreflected, and reloads the same" (the `generateDeck` call, which runs only when an arrangement exists).

**W1, DR1**: spec section 21.3 lines 108 to 116, plus W1 "the preview redraws the bottom ring alone when MIRROR BOTTOM is tapped" (covers the two `solve` call sites).

#### Mutants

Regenerate `g_mirror_ignored` and `d_mirror_ignored` (both anchor on rewritten lines; the rewriting lane owns them). New: S2 +3 (bottom mirror ignored in `placeZones`; absent `mirrorBottom` resolves to false; call value does not beat the seed's), S3 +4 (`t` decoded as both; `t` accepted in version 2; editor drops `mirrorBottom` on save; `generateDeck` omits `mirrorBottom`), W1 +1 (bottom switch inert).

#### Failure modes

| Case | Result | Test | Seen by the user if it broke |
|---|---|---|---|
| Old record, `mirror: true`, has bottom notes | both on, drawn as today | 3, 6, spec line 112 | bottom ring flips on a saved pan |
| Old share link, mirror `1` | both on | 9 | same, on a shared pan |
| Top-only pan shared before version 3 exists | cannot happen: no screen makes one until W1, and W1 follows S3 (AM-6) | 11 | recipient sees the bottom ring flipped, no error |
| New record top-only, opened by an OLDER app | version 3 record, `NEEDS_NEWER_APP`, left in storage (AM-7) | S3's existing version tests | none |
| Pan with no bottom notes, bottom switch | disabled, stored false (AM-4) | spec 21.3 | none |
| `mirrorBottom` given, `mirror` absent | top false, bottom as given | 4 | none |
| Top-only link opened and re-saved in an S3 build, or in a cached S3 tab after W1 | bottom stays unreflected: S3 carries the value (AM-8) | 12 | bottom ring flips after a rename |
| `generateDeck`'s `solve` call omits `mirrorBottom` | caught: preview right, cards wrong | 13 | cards disagree with the preview |
| Split mirrors made by the CLI in an S2-only build | the CLI writes a deck file, not a link or a record; no app path makes split mirrors before S3 | none needed | none |

No critical gap remains: each row has a test and none fails silently once AM-6 holds.

#### Order

This amendment is committed to the plan on Lane PF's branch with the other coordinator notes, so it is on main before S2 starts. Lane order after it: PF; then S2; then S3; then W1; then G2b (it needs W1, as the plan's dependency graph already says); P1, DR1, DR2 as before.

#### Decision ledger (eng review, owner AFK: recommended option taken and recorded)

| Id | Question | Taken | Why | Reversible |
|---|---|---|---|---|
| AD-AM-1 | Where does "absent takes mirror" live: core reader, solve, build, or all three? | One function in `layout.js` (AM-5) | `solve` already resolves `mirror` from two sources; a second default in the core reader would make the app's `{mirror: x}` calls disagree with stored seeds | yes |
| AD-AM-2 | W1 beside S3, or after? | After (AM-6) | With W1 first, a top-only pan shares as `1` under version 2 and the recipient gets a flipped bottom ring with no error | yes |
| AD-AM-3 | Share encoding: four values in one field, or a sixth field? | Four values (AM-2 stands) | Version 1 and 2 lines stay byte-identical and the name stays last and alone (D5-3) | yes, before S3 ships |
| AD-AM-4 | AM-4: store `false`, or store the top value, on a pan with no bottom notes? | `false` (AM-4 stands) | Matches "both off by default" if bottom notes are added later; the drawing is the same either way | yes |
| AD-AM-5 | Outside Voice (Codex) on this amendment? | Run, after the owner authorised it for AFK | 4 findings (1 P1, 3 P2), all accepted: AM-8, AM-9, test 13, G2b order | - |
| AD-AM-6 | TODOS.md entry? | None | Nothing is deferred; every finding is folded into a lane | yes |

#### Review output

**Scope challenge.** Seven files across four lanes (S2 four, S3 one, W1 and DR1 `index.html`), no new module, one new function. Under the 8-file gate in every lane. Nothing existing is rebuilt: `mirrored(list, mirror)` is reused unchanged for both shells.

**What already exists.** `mirrored()` and `placeZones()` in `layout.js`; the two-source resolution in `solve`; the boolean check in the core reader; the version gates in `share.js` `decode`; `d_mirror_ignored` and `g_mirror_ignored`.

**Not in scope.** Inner-ring switch; converting old records; a new share field; `LAYOUT_HINT` wording; built-in deck data.

**Findings folded in (draft 1 to draft 2).**
1. Architecture: the default was specified in three places (core reader, solve, build). Now one function (AM-5).
2. Architecture: W1 beside S3 allowed a silently wrong share link. Reordered (AM-6).
3. Architecture: record and link version when the mirrors differ was implied, not stated (AM-7).
4. Code quality: the code table missed the reader's `out` literal, the two app `solve` call sites, `sandbox.js` and the surface fixture.
5. Code quality: `readOptionsLine` is commented "version-independent"; S3 makes it take the version, and the reader must refuse unknown characters at every version.
6. Tests: no test for resolution precedence, for `select.build`, for the writer's `1` on a legacy seed, or for the preview call. Added 4, 6, 11 and the W1 preview test.
7. Tests: W1's tests 6 and 7 and S2's item 7 named the single switch. Reworded.
8. Docs: section 15 CLAUDE.md text and the 7.2 id table were not listed.
9. Mutant forecasts were absolute and stale. Deltas only.

**Coverage.**

```
resolveMirrors
  call has mirror / not            -> tests 3, 4
  call has mirrorBottom            -> test 4
  seed has mirrorBottom            -> test 4
  neither (falls to top)           -> test 3
placeZones(top, bottom)
  top only / bottom only / both    -> tests 1, 2, 3
core reader: boolean, bad, absent  -> test 5
select.build writes both           -> test 6
gen_deck flags                     -> test 7
share writer 0/1/t/b               -> tests 8, 11
share reader v1, v2, v3, garbage   -> tests 9, 10
sheet: two switches, stored, old   -> W1 6, 7, spec 108-116
preview call sites                 -> W1 preview test
drawer                             -> DR1, spec 21.3
```

No untested branch.

**Performance.** None. One more boolean through an O(n) seat map.

**Parallelization.** Sequential by AM-6: S2, then S3, then W1, then G2b, then DR1.

**Implementation tasks.** T-AM1 (S2) `resolveMirrors`, `placeZones`, core whitelist, `build`, CLI, tests 1 to 7, three mutants, two regenerated. T-AM2 (S3) share writer and reader, tests 8 to 11, two mutants. T-AM3 (W1) two switches, both `solve` calls, new id in sandbox and fixture, one mutant. T-AM4 (DR1) both switches in the drawer. T-AM5 (docs) README, ENGINE-SPEC, CLAUDE.md text.

### 20.6 Lane order from here

PF; S2; S3; W1; G2b; then P1, DR1, DR2 with the owner's print and phone checks; DOC last. Every absolute mutant count in a lane block is stale; read each forecast as its delta over main at the lane's base.

### 20.7 Coordinator corrections (2026-10-07, after Lane PF merged)

Lane PF merged as #264 (main c9a0051, 714 mutants). Its reviewer returned PASS_WITH_NITS and found the following in the plan text of 20.1 to 20.5. Each is corrected here by reading; the older text is not edited.

1. Mutant counts. "Main is at 706" in 20.5 is stale; main was at 711 before PF and is at 714 after it. The rule in 20.6 stands: read each forecast as its delta.
2. S3's size. Where a summary says S3 has "tests 8 to 11, two mutants" or counts S3 as one file, the lane text binds: tests 8 to 13, and S3 also owns the `mirrorBottom` carry in `index.html` (AM-8).
3. The two app `solve` calls. AM-8 gives them to S3. Any line that gives "both `solve` calls" to W1 means only W1's own test that the preview redraws the bottom ring.
4. F3 (the crowded title-card note line wraps to two lines) is recorded in 20.2 and belongs to Lane P1, though P1's block does not repeat it.
5. The CHORD_ONLY notice listed as open in the PF block was answered in 20.2 ("Title card only").
6. Design spec section numbers. 20.1 and 20.4 cite the spec's sections 20 to 22. PR #260 is being rewritten into one text with no override sections; its decision index keeps every id (OD, RD, F, MC, AD-MC, and the section 22 items) and says where each rule now lives. Read a citation of spec section 20, 21 or 22 through that index.
7. S2 test 3 ("equals today's `{mirror:true}` golden angles"). S2 itself changes what an even rim draws (7.1, 5.3), so "today's" holds only for the shapes 5.3 lists as unchanged: an odd rim with no inner notes, and Pygmy's counts with anchor `between`. The test uses one of those. For any other shape the expected angles are the 7.4 table.
8. The goal of 20.5 ("every deck, record and share link that exists today draws exactly as it does today") is about the mirror split. It does not undo 5.3: Lane S2's direction change redraws saved even-rim decks, as D10 decided.

Carried from the PF review, not yet assigned an owner:

- **Title-card blurb height.** Blurb lines draw downward with no limit (`hifi.py` and `pdfcards.js`, the title-card blurb loop). Four lines clear the card edge by about 2 pt; a fifth lands below it. A fifth line needs a bottom shell plus NO_THIRDS plus SMALL_LABELS, or P1's two-line note wrap on a crowded pan with a bottom shell. Unreachable until G2b. Lane P1 must bound it or the owner must rule before G2b.
- **Stale prose for the DOC lane**: the `hifi.py` comment above `CARD_WARNINGS` and the CLAUDE.md "Pan-wide warnings print on the chord cards" bullet still say the title card carries the engine's full reason string; since PF it carries the short line for SMALL_LABELS. Section 15 has no row for this.

### 20.8 Coordinator record after Lane S2 (2026-10-07)

Lane S2 merged as #265 (main 1f4603b, 719 mutant files). Review: PASS_WITH_NITS at a73789d. The older text is not edited; read it through this section.

**S2 deviations, accepted by the reviewer.** It regenerated `tests/fixtures/engine_corpus_v1.json` (four lines, the nineteen-field maximum's geom) and `tests/fixtures/gen_face_v1.json` (digests of even-rim and inner-note seeds), both forced by 5.3. It added "except the Pygmy geometry keys that Lane P1 reconciles" to the CLAUDE.md layout paragraph. It left the README's LEFT-FIRST wording for a later lane.

**Owner answers, interview 7 (binding).**

1. Title-card blurb overflow: **Lane P1 shrinks to fit.** Line spacing and size step down together until every blurb line sits inside the card; no line draws under 3.6 pt; no line is dropped. P1 adds a test for the five-line case (bottom shell, NO_THIRDS, SMALL_LABELS, wrapped note line). This closes the "Title-card blurb height" item of 20.7.
2. **DR1 keeps today's ROTATE and MOVE buttons.** SEAT, NOTE and RESET SEATS arrive whole in DR2, and DR2 removes ROTATE and MOVE. So in the DR1 block: the goal's "ROTATE and MOVE removed", the TDD line "ROTATE and MOVE are gone from the markup", the acceptance `grep -c "scale-rot-\|scale-move-"` printing 0, the `tools/sandbox.js` id removal, and the retirement of `e_layout_rotate_inert`, `d_rotate_drops_the_selection` and `qa_layout_prologue_skips_sync` all move to DR2. The S3 block's "(they are removed in DR1)" reads "removed in DR2". The design spec's DR1 and DR2 ownership table agrees.
3. A fourth review FAIL on PR #260 holds for the owner. S2, S3, P1 and U3 carry on; W1, DR1 and DR2 wait.
4. Lane U3 (two-beginner-decks plan, OQ16) runs in parallel. Whichever of two open lanes merges second merges main and re-sets FLOORS and the README mutant count.

**Carried into Lane S3 from the S2 review** (inside S3's Owns or AM-8):

- `generateDeck`'s re-solve passes `mirror` and `order` only; it drops `anchor` and `mirrorBottom`. AM-8 gives this to S3. S3 adds the test that a deck generated with `anchor: between` or unequal mirrors re-solves to the same fields.
- No test asserts that `select.build`'s fields follow the anchor (a mutant passing `anchor: "one"` to `solve` while still writing `options.anchor` survives). S3 owns `index.html`'s solve calls, not `select.js`; it adds the assertion in a test it owns if one fits, else leaves it for P1, which regenerates Pygmy through that path.

**Carried, no owner yet** (S2 review nits): the seed-level anchor path in `resolveAnchor` is untested and an invalid call-level anchor silently becomes `one`; `g_bottom_anchor_dropped` and `g_bottom_anchor_side_flipped` no longer describe what they mutate; `s2_builtin_seat_drifts` carries a no-op term; `LAYOUT_HINT` and the `// false = right-first` comment in the app are inaccurate until W1 replaces the buttons; the CLAUDE.md mirror sentence uses option names where 20.5 gives UI names (DOC lane).

**Counts.** S3's forecast is +3 plus its 20.5 mutants over main at its base, which is 719.

### 20.9 Coordinator record after Lane S3 and the spec follow-up (2026-10-07)

Lane S3 merged as #267 (main c9adc5e, 726 mutant files). Review: PASS_WITH_NITS at 661c6fc. Lane U3 of the two-beginner-decks plan merged as #266. The design spec was amended by #268 (main 6c01e2f; one file, docs only; one review FAIL at bd9f03b, then PASS_WITH_NITS at 30d737c). The older text is not edited; read it through this section.

**What S3 left on main, for every later lane brief.**

- The engine option is `seats: {rim?, inner?, bottom?}`; `order` is gone from `solve`'s options.
- Share links are written as version 3. Versions 1 and 2 still decode.
- Saved scales live under `hpfc.scales.v3`. The first boot copies the old key and leaves it untouched.
- In `index.html`, `layoutOrder` and `syncLayoutOrder` are now `layoutSeats` and `syncLayoutSeats`. Any lane block that names the old functions means the new ones.
- The editor carries `mirrorBottom` and `anchor` with no control (AM-8). W1 adds the controls.

**Owner answers, interview 8 (binding).**

1. A bottom note added to a pan with MIRROR TOP on: **MIRROR BOTTOM stays off.** AM-4 and AD-AM-4 stand. The spec now says so (#268).
2. The drawer opens with focus on the **first pickable note**.
3. Between DR1 and DR2 today's ROTATE, MOVE and RESET live **inside the drawer**: Edit only, with their own short hint, closed by Escape with the drawer. DR2 replaces the group in place. Ids: `#scale-legacy-group`, `#scale-legacy-hint`.
4. Between G2b and DR1 the sheet has no layout hint: **accepted.**

**The DR1 and DR2 blocks, corrected.** 20.8 item 2 moved the removal of ROTATE and MOVE to DR2. In addition: DR1's Owns gains `#scale-legacy-group` and `#scale-legacy-hint`; DR1's `tools/sandbox.js` line keeps the four `scale-rot-` and `scale-move-` ids and adds the drawer and legacy-group ids; the removal of those four ids from `tools/sandbox.js` is DR2's. DR1's TDD floor "one test per acceptance line of the DS spec" means the lines tagged [DR1] in the spec as amended by #268.

**Design spec citations.** The spec is one text since #260. Every citation in this plan of spec section 20, 21 or 22, or of "spec section 21.3 lines 108 to 116", is read through the spec's decision index and its acceptance list by tag. The acceptance list has 133 lines: W1 21, G2b 5, DR1 37, DR2 70.

**Coordinator readings in the spec follow-up (owner away; listed for the owner).**

- The DR1-era hint copy is the lane's wording, not the owner's: `Layout is a guess. Open ADJUST LAYOUT to flip the pan left and right or choose where note 1 sits.` The owner confirms or rewords it before DR1 starts.
- The legacy group includes today's RESET; it is shown on Edit by un-hiding the group.
- Ring order for arrows, Home, End and NEXT NOTE is seat number.
- A swap followed by its undo returns the unsaved-layout notice to its earlier state.
- An old `mirror: true` deck with no bottom notes opens with `Layout changed from the default.`; once a bottom note is typed, MIRROR BOTTOM joins the comparison (stored reads on, current is off) and the notice reads `Layout not saved yet.` The comparison rule decides, no separate sentence does.
- With nothing picked a tap writes status row 10.
- Left open for the owner, none of them needed before DR2: a second swap inside 600 ms; hold, Space, Enter or drag start on a single-note ring while another note is picked; NEXT NOTE then Escape; focus after a refused tap on another ring; the anchor helper copy after note 1 has been swapped away; the notice when a ring's count differs from the stored deck; the soft keyboard when the drawer closes over an invalid box.

**Carried into Lane W1 from the S3 review** (inside W1's Owns, which already has both `solve` call sites' preview test and the sheet tests):

- Nothing tests that `generateDeck`'s re-solve passes `mirrorBottom`: removing it from that call survives every unit test. W1 can now make the state from the sheet, so W1 adds the test "a deck generated with MIRROR TOP on and MIRROR BOTTOM off re-solves to the same fields" and the mutant "generateDeck omits mirrorBottom" (forecast in 20.5 under S3, not committed there).

**Lane W1's block, corrected (coordinator auto-decisions).**

- Its goal, Owns and tests 6 and 7 read as 20.5 rewrote them: two switches, `#scale-mirror` (MIRROR TOP) and `#scale-mirror-bottom` (MIRROR BOTTOM).
- Its acceptance list is the 21 spec lines tagged [W1]. The tests use scales today's grammar accepts; G2b flips the grammar after W1.
- Its acceptance grep for `LEFT-FIRST` and `RIGHT-FIRST` printing 0 cannot hold while the `LAYOUT_HINT` constant names those buttons, and the hint's wording is G2b's. W1 makes the smallest true edit: in that constant only, the button names become `MIRROR TOP` (`Layout is a guess. Tap MIRROR TOP if your pan is mirrored.`). G2b still owns the final text. W1 owns every test and mutant that quotes the old sentence.
- The inaccurate `// false = right-first` comment of 20.8 goes with the buttons W1 replaces.

**Carried into Lane P1**: the `select.build` assertion of 20.8 (fields follow the anchor). S3 did not add it.

**Carried, no owner yet** (S3 review nits): no mutant for "`t` decoded as both" or "`t` accepted in version 2" (both have killing tests); the test for a crowded rim moves one ring, not every ring; the rename test rotates instead of renaming; no test saves a deck while the old storage key still holds a list; the version 3 reader accepts seats that are not canonical; `seatsField` would throw on a ring that is not an array (unreachable today); stale `order` wording in `index.html` comments, `tests/share.test.js` and `docs/ENGINE-SPEC.md` (DOC lane). Spec nits from the #268 review, for a docs pass before DR1: the sentence "This includes the legacy group's buttons in the DR1 build" sits after the wrong sentence in section 6 (focus goes to the toggle, as acc 131 says); acc 133 should say MIRROR TOP ends pressed; the compared-layout sentence in section 4 names seats with no DR1 qualifier; "in the same place" is loose for RESET.

**Counts.** W1's forecast is +1 (bottom switch inert) plus its own three and the carried `generateDeck` mutant, over main at its base, which is 726.

**Lane order from here.** W1; G2b; then P1, DR1, DR2 with the owner's print and phone checks; DOC last.

### 20.10 Coordinator record after Lane W1 (2026-10-07)

Lane W1 merged as #269 (main df91453, 734 mutant files). Review: PASS_WITH_NITS at 425a591. The older text is not edited; read it through this section.

**Owner answers, interview 9 (binding).**

1. W1's phone check at 380 px with the keyboard up: **merge on the review pass, check later.** It stays UNVERIFIED on #269; a problem found becomes a follow-up fix.
2. The DR1-era hint copy of 20.9 (`Layout is a guess. Open ADJUST LAYOUT to flip the pan left and right or choose where note 1 sits.`): **kept as written.**
3. W1's interim `LAYOUT_HINT` (`Layout is a guess. Tap MIRROR TOP if your pan is mirrored.`): **kept** until G2b.
4. An old single-mirror deck with no bottom notes, a bottom note typed on Edit: **MIRROR BOTTOM stays off and the notice says unsaved.** The spec stands.

**What W1 left on main, for every later lane brief.**

- `#scale-box` is a `textarea` that grows to three rows. Enter generates; a pasted line break becomes a space.
- The mirror controls are two switches, `#scale-mirror` (MIRROR TOP) and `#scale-mirror-bottom` (MIRROR BOTTOM). `scale-mirror-l` and `scale-mirror-r` are gone.
- The field cap is `calc(3 * 1.3em + 26px)`: the spec's 24 px plus two 1 px borders (border-box). Accepted.
- Acceptance line 79's e2e runs at 320x700, not 380. Accepted.
- The old "mirror pair defaults to right-first" test was deleted with the pair.
- `e_preset_refusal_sticks` is a two-hunk mutant; `dataset.dead` exists only inside that patch, not in the app.
- 8 mutants were added against a forecast of 5; 15 were regenerated.

**Carried into Lane G2b from the W1 review** (G2b already owns the sheet copy and rewrites these tests' inputs):

- The plan-named test "the preview redraws the bottom ring alone when MIRROR BOTTOM is tapped" (20.5, 20.7 item 3) was not written. `mirrorBottom: false` in `solvePreviewLayout` survives every test. G2b adds the test and a mutant for it.
- Nothing guards `syncGrow()` in `resetSheetState`: the line 79 test types the scale before it opens Edit, so the field has already grown. G2b adds a test that opens Edit on a saved long deck from a fresh load, and a mutant.
- No fold test uses a three-row field. G2b's placeholder and D3 example are long enough; one fold test takes a three-row scale and asserts `#scale-generate` stays on screen.

**Carried, no owner yet** (W1 review nits):

- `BIG_SCALE` in `tests/e2e.test.js` changed its last note from `B3` to `Bb3` without a note in the PR.
- In landscape (844x390, 667x375) the mirror and swatch row is 97 px tall against 44 on main: the two switches are wider and the swatches wrap. No binding line asks for one row. For the owner's eye with the phone check.
- The IME check is `isComposing` only; Safari's keyCode 229 is not covered.
- The paste caret is offset by the count of CRLF pairs.
- `dataset.grow` is set twice (property and attribute).
- README prose outside the mutant count still says LEFT-FIRST (DOC lane, or G2b if it rewrites that bullet).

**Lane G2b's block, read against main today.**

- `LAYOUT_HINT` goes: spec acceptance line 127 and interview 8 item 4. G2b owns every test and mutant that quotes it.
- Its acceptance list gains the spec lines tagged [G2b]: 4, 9, 11, 14 and 127.
- Its mutant forecast is a delta over 734.

**Lane order from here.** G2b; then P1, DR1, DR2 with the owner's print and phone checks; DOC last.

### 20.11 R5's budget gets a floor (coordinator auto-decision, 2026-10-07, owner away)

Lane G2b measured the forty-note pan on CI at 14 ms (run 37715956008, recorded in #270). R5's rule gives a budget of 42 ms. One sample at that scale is inside the noise of a shared runner: a single pause fails the test, and the test also runs under the mutation gate's baseline. R5 exists to catch generation that has become slow, not to time it to the millisecond.

**Decision.** The budget is three times the measured figure or 1000 ms, whichever is larger. Today that is 1000 ms. R5's stop condition (a measured time over 5 seconds) is unchanged. The owner can restore the bare 3x rule.

### 20.12 Coordinator record after Lane G2b (2026-10-07)

Lane G2b merged as #270 (main fb7193d, 744 mutant files). Review 1 at 1ab02a7: FAIL. Review 2 at 92f0d82: PASS_WITH_NITS. The older text is not edited; read it through this section.

**The FAIL and its fix.** With the caps gone, the legacy reader still numbered bottom notes from 101, so a legacy string with 101 or more top notes lost a top note and the boot rewrite stored the loss. Bottom ids now start at `max(101, topCount + 1)` in both readers. The same review found three plan-letter misses (R5's test used a 15 second bound; the README carried DR2's drawer sentence; the PR body's mutant figures). All four were fixed on the branch.

**What G2b left on main, for every later lane brief.**

- `parseSeed` and `formatSeed` are the new grammar: `(` or a lone first note for the ding, `[ ]` for a bottom note, `|` before the inner notes. The old reader is `parseLegacySeed`.
- The parser caps and `TOO_MANY_RIM` are gone.
- Share links are written as version 4. Stored records are rewritten to version 4 at boot by `restoreScales`: lossless, idempotent, duplicates collapse to the first, an unreadable record is kept byte for byte. `scaleReader` picks the reader by version.
- `LAYOUT_HINT` is gone. `#scale-label-2` sits directly under label 1. The placeholder is the E Amara 20 string of section 9.
- `SMALL_LABELS` shows live in `#scale-msg`.
- `tools/gen_deck.js` reads the new grammar, so Lane P1 uses the new string of its block, not the legacy one.
- FLOORS: app 342, core 66, e2e 275, share 68.

**G2b deviations, accepted by the reviewers.** The CLAUDE.md "Scale strings" paragraph sits before "Hard constraints"; `#scale-label-2` moved up under label 1; some e2e tests use taller viewports; two L0 tests call `forgetScale` and `replaceScale` directly; a third mutant was retired (`l0_remember_null_id_appends`). `tools/sandbox.js` (one id removed), `tools/regen_card_fixture.js` and three fixtures were touched outside the literal Owns.

**G2b nits, no owner yet.**

- Stale comments in `index.html`: "Every version maps to the legacy reader today", and one that still names `LAYOUT_HINT`.
- A stray second hunk in `g2b_record_version_ignored.patch`.
- A tautological test, "parseLegacySeed is parseSeed", in `tests/core.test.js`; a duplicated `formatSeed` pair in `tests/scale.test.js`.
- Three survivors over correct shipped code: keeping a duplicate record in storage; `scaleReader`'s threshold at 3 instead of 4; `stringDeckId` using the legacy reader.
- `recordDeckId` does not check that the version is valid (it did not before G2b either).
- The e2e title "the pan does not move when the seed goes bad" no longer describes the test.
- The MIRROR BOTTOM preview test never asserts that the rim is unchanged.
- No test that a rewritten version 4 record's `o` carries `seats` and no flat `order`.
- 20.3 item 3 ("say which") is answered only in a code comment: the wording was fixed and the order kept.
- `generateDeck` registers the deck before it checks `built.value.id === id`.
- 20.3 item 9: `tests/test_gen_deck.py` still injects `SMALL_LABELS` and its docstring is stale. A real crowded string now works through `tools/gen_deck.js`. Carried into P1 below.

**Lane P1's block, read against main fb7193d.**

Checked by the coordinator on main before dispatch: the engine run of P1's command gives exactly the `geom` of 5.1, every field id matches, and no field angle differs from the stored deck. The stop condition "the engine's `geom` differs from 5.1" is not met.

- The golden deck fixture on main is `golden_decks_v7.json`; the bump is to v8. `golden_decks_v3.json` stays frozen.
- The mutant base is 744, not 702. Forecast: +1 for the block's own mutant, plus what the added work below brings.
- Q1 stands: the stored `geom` is solver output minus `ext`. Four changed lines' worth of keys: `r_note`, `f_note`, `f_num`, `inner_ring`.
- **Added to P1's Owns** by 20.2 (F3), interview 7 and 20.8, which the block does not repeat: the title-card blurb code in both renderers. That is `_blurb` in `tools/decks.py`, the blurb loop of `title_card` in `tools/hifi.py`, `blurb` in `src/engine/pdfdeck.js` and the title-card blurb loop in `src/engine/pdfcards.js`, with their generated regions in `index.html` (through `python3 tools/inline_engine.py`), their tests, and any mutant anchored on a line the lane rewrites. `tools/decks.py` and `tools/hifi.py` move from "Reads only" to "Owns" for those functions only.
- **Added to P1's work**:
  1. A crowded pan's title-card note line wraps to two lines (20.2). Test: no title-card line of a 20-note top shell is wider than `CW - 24` pt.
  2. The blurb shrinks to fit (interview 7): line spacing and size step down together until every blurb line sits inside the card; no line draws under 3.6 pt; no line is dropped. Test: the five-line case (bottom shell, NO_THIRDS, SMALL_LABELS, wrapped note line).
  3. Both renderers agree on 1 and 2 (the existing print and browser PDF parity tests are the model).
  4. An assertion that `select.build`'s fields follow the anchor (20.8, 20.9), with its mutant.
  5. `tests/test_gen_deck.py` runs a real crowded string through `tools/gen_deck.js` instead of injecting `SMALL_LABELS` (20.3 item 9), if it fits inside the lane; if not, the lane says so and it stays a nit.
- **A new stop condition** follows from 1 and 2: any committed PDF other than the two Pygmy ones changes its extracted text or its drawing. The five built-in title cards have at most four blurb lines and no crowded note line, so the new code must not move them. Pygmy's own title card may change only through its `geom`.
- The hand check stays an owner gate (R4). The lane cannot do it. The PR is built and reviewed; **the merge waits for the owner's print check.**

**Lane order from here.** P1 is built and reviewed, then held for the owner. DR1 follows P1's merge: both regenerate parts of `index.html` and the mutants anchored there, and section "Worktree parallelization" makes everything from S2 on serial. DR2 and DOC after that.

### 20.13 Coordinator record after Lane P1 (2026-10-07)

Lane P1 merged as #271 (main d530875, 748 mutant files). Review: PASS_WITH_NITS at 0ef16f5, CI green at that SHA. The older text is not edited; read it through this section.

**Owner answers, interview 10 (binding).**

1. P1's print check: **merge now, check later.** #271 merged on that answer. The check is still open and UNVERIFIED; a problem found on paper becomes a follow-up, not a revert.
2. The two P1 review items below (N1, N4): **folded into Lane DR1.**
3. A title-card blurb past seven rows leaves the card (N2): **accept and document.** Today's behaviour stays. A test and a CLAUDE.md line record the limit. Nothing is refused and no row is dropped.
4. W1's phone check stays open, done on the live site when the owner gets to it.

**What P1 left on main, for every later lane brief.**

- Pygmy's `geom` is engine output minus `ext`. The golden fixture is `golden_decks_v8.json` and the print fixture is `print_decks_v2.json`; v7 and v1 are kept frozen.
- The title-card note line wraps to two lines on a crowded pan. The blurb shrinks to fit through `hifi.blurb_layout` and `blurbLayout` in `src/engine/pdfcards.js`, with a 3.6 pt floor.
- `tests/test_print.py` has `ROUNDED_F_SLACK = 3e-4`; `tests/test_render_agreement.py` writes the same figure inline. Both apply it to every Pygmy zone.
- Accepted touches outside P1's Owns: the Pygmy rows of `seq_ui_base_e728912.json`, a blurb bullet in CLAUDE.md, `tests/CONTRACT.md`.

**P1 review nits.**

- N1. The plan's TDD item was half done: the test "Hijaz, Amara 9, Kurd 10 and Amara 10 draw exactly as the solver draws them" in `tests/app.test.js` still covers four decks and its comment still calls Pygmy "the documented exception". DR1 (below).
- N2. The blurb's step floor stops the shrink: six rows fit, seven sit on the frame (0.08 pt over), eight and more leave the card (about 4 pt at eight). DR1 documents it (below).
- N3. The wrap test does not bind at 4.2 pt: a mutant that wraps at the full card width in both renderers survives. No owner yet.
- N4. The rounding slack applies to every Pygmy zone, and the baseline it guards is read from the live `geom`. Only rim and inner names and the index numbers moved in the redraw. DR1 narrows it (below).
- N5. Surviving mutants with no killing test: step floor dropped (Python, JS); BOTTOM rows never orange in the JS renderer; wrap at card width. No owner yet.
- N6. CLAUDE.md's label-rule figures for Pygmy's rim predate the redraw. DOC lane.

**Lane DR1, read against main.** The block in section "Lanes" stands as corrected by 20.8 item 2 and 20.9. In full:

- DR1 keeps ROTATE, MOVE and RESET. They move into `#scale-legacy-group` with `#scale-legacy-hint`, inside the drawer, Edit only. The removal of ROTATE and MOVE, the grep-for-zero acceptance, the removal of the four `scale-rot-` and `scale-move-` ids from `tools/sandbox.js`, and the retirement of `e_layout_rotate_inert`, `d_rotate_drops_the_selection` and `qa_layout_prologue_skips_sync` are DR2's.
- Both mirror switches exist since W1 (`#scale-mirror`, `#scale-mirror-bottom`). DR1 moves both into the drawer. Owns therefore covers the position of both.
- The DR1-era hint copy is confirmed by the owner (interview 9): `Layout is a guess. Open ADJUST LAYOUT to flip the pan left and right or choose where note 1 sits.`
- The TDD floor is one test per acceptance line tagged [DR1] in the design spec: 37 lines. The spec's section 17 table says what DR1 renders and what waits for DR2.
- The mutant base is 748. DR1 regenerates the nine layout and hint mutants its block lists that it does not retire; every mutant anchored on a line DR1 rewrites is DR1's to refresh.
- DR1 has no owner gate. DR2's phone check is an owner gate and is not waived.

**Three spec sentences, read as follows** (the #268 nits of 20.9; the spec is not edited):

- Section 6: the sentence "This includes the legacy group's buttons in the DR1 build" belongs to the rule that focus returns to the toggle when the drawer closes, as acceptance line 131 says.
- Acceptance line 133: MIRROR TOP ends pressed.
- Section 4: in the DR1 build the compared layout is anchor and both mirrors only, as section 17's row for `#scale-layout-state` says. "In the same place" for RESET means inside `#scale-legacy-group`.

**Added to DR1's Owns and work by interview 10.**

1. In `tests/app.test.js`, the test named in N1 runs over all five built-ins and is renamed to say so; Pygmy's stored `geom` is compared with the solver's after `ext` is dropped; the stale comment goes. No mutant is owed: `b_pygmy_geom_not_engine_output` already covers the data side.
2. In `tests/test_print.py` and `tests/test_render_agreement.py`, the Pygmy slack applies to rim and inner names and to index numbers only. Ding and bottom-shell names are held to the exact baseline again. If a ding or bottom figure then fails, that is a stop condition: report it, do not widen the slack back.
3. The blurb limit. A test in `tests/test_print.py` (and its twin where the JS renderer's blurb tests live, `tests/pdfcards.test.js`) pins today's behaviour: six rows end inside the frame, and an eight-row blurb ends below it with no row dropped and no row under 3.6 pt. One sentence joins the blurb bullet in CLAUDE.md saying the blurb fits to six rows, sits on the frame at seven and leaves the card past that, by owner decision 2026-10-07. No renderer code changes for this item.

Items 1 to 3 touch no file DR1's drawer work touches except `tests/app.test.js`. They are small and go in their own commit.

**Lane order from here.** DR1; DR2 with the owner's phone check; DOC last.

### 20.14 DR1 review 1: FAIL at 910314e, and one reading (coordinator auto-decision, 2026-10-07, owner away)

PR #272, review 1: FAIL at 910314e with CI green. Two findings; neither test nor mutant saw them.

- **F1.** On Edit with the drawer open, Tab goes from RESET to the degrees select and then back up to MIRROR TOP. The spec's focus order (section 4) puts degrees after BESIDE CENTRE. Fix: move the degrees entry in the sheet's Tab-stop list to after the anchor pair. The acceptance line 23 Edit test becomes an exact-order check from the toggle to the first swatch, and a mutant "degrees before MIRROR TOP" joins it.
- **F2.** In the landscape two-column layout (844x390) the plate band spans the grid's height, so `scroll-padding-top` equal to the band's height is larger than the scrollport and Tab leaves focused controls out of view. **Reading (auto-decision):** the spec gives the padding one purpose, "so a control focused by Tab is never left under the band". In the two-column layout the band sits beside the controls, not over them, so the padding there is zero. The portrait rule is unchanged. Test: at 844x390 with the drawer open, on Add and on Edit, every Tab stop of the sheet ends inside the scrollport. The owner was offered no alternative; the other choice is to keep the letter of the spec and leave keyboard users in landscape with off-screen focus.

Also from review 1, for the PR body: the acceptance line 89 figures. 380x667, closed, example scale: toggle top 447.3, bottom 491.3, scrollport 491. 844x390, open: status line top 308.1, bottom 344.1, scrollport 256, not visible at scroll top. Spec line 226 leaves the judgement to the owner at the phone check.

Review 1 nits, not fixed before the final review: `closeDrawer` paints before it moves focus; a stale comment near `sheetOptions` saying the sheet has no anchor control; `--plate-band-h` is read on every paint and goes stale on resize; `hasTwoNoteRing` returns true on a parse failure (unreachable); the JS blurb twin uses literals where Python uses constants; stale `#scale-layout-row` wording in two mutant comments; no mutant on the new stops' Tab order beyond F1's, on `closeDrawer` focus, the Escape ladder, the notice or the pause state.

### 20.15 DR1 review 2: FAIL at bdd94cb (coordinator record, 2026-10-07, owner away)

PR #272, review 2: FAIL at bdd94cb with CI green. F1 and F2 of 20.14 hold in a real browser. Two new findings; both are fixed before review 3. A third FAIL triggers the regroup rule.

- **A (blocking).** The layout notice compares MIRROR BOTTOM against the effective value at sheet open, which is off whenever the pan has no bottom notes. The spec compares against the stored value read through [AD-MC 3] (no `mirrorBottom` key reads as `mirror`) and leaves MIRROR BOTTOM out only while the pan currently has no bottom notes. So a `{mirror: true}` record with a bottom note typed on Edit reads `Layout changed from the default.` where interview 9 item 4 requires `Layout not saved yet. SAVE CHANGES keeps it.`; and a `{mirror: true, mirrorBottom: true}` record with its bottom note deleted reads unsaved where the spec requires `Layout changed from the default.` Fix: the baseline holds the stored value read through [AD-MC 3]; the comparison skips MIRROR BOTTOM only while the box has no bottom notes. Tests pin both directions; a mutant covers the baseline.
- **B.** `#scale-layout-hint` stays shown while the drawer is open. Spec section 4, Open step 4, and the state table of 16.1 hide it. Fix: hidden while open, shown again on close. One test.

**Before review 3 the lane sweeps the spec's state table (section 16.1) row by row against the build**, for every row section 17 gives to DR1, and reports each row as holds, fixed, or DR2's. Both findings of this review were rows no acceptance line names; the sweep is how the rest are found before a reviewer finds them.

Review 2 nits, not fixed: the portrait line 87 assertion is conditional on the band being sticky; `d_generate_enabled_when_invalid` has a `# kills:` header that matches no test name (older than this lane); line 89 is a report with no assertion.

### 20.16 DR1 repair subplan after the third review FAIL (2026-10-07)

PR #272 failed review 3 at 981f546 (CI green). Under the regroup rule a read-only investigation ran a grid over the build: 792 open and closed cells and 2832 keyboard cells for geometry, 112 cells for the layout state. This section is the repair. It governs the DR1 block wherever they differ. Probes and raw data: session scratchpad, folder `regroup/` (`grid.js`, `state.js`, `dyn.js`).

**Cause.** The acceptance lines name sizes and states; the lane wrote one test per line; nothing tested the rule the lines are instances of. Reviews 1 and 3 found the geometry rule broken off the named points, review 2 the state rule. Mechanically: the sheet's `scroll-padding-top` is a cached band height, and neither it nor the band's stickiness is decided against the scrollport's real height. The state product shows no mismatch at 981f546, so the state side needs a test, not a fix.

**Owner answers, interview 11 (binding).**

1. When the scroll area is too short for the pinned pan plus one control, **the pan un-pins and scrolls away**.
2. DR1 **holds at every window size**, tested over a grid, not named points.
3. Remove the last sentence of `PARSE_HINT`: "A | used to mean bottom notes; it now means inner notes."
4. P1 print check: closed ("Prints look great"). W1 phone check: still open.
5. DR2's open behaviours: interview before DR2.

**Rule G (geometry), stated once.** With the drawer open, in every window size, on Add and on Edit, keyboard up or down, before and after a resize:

- G-a. The band is stuck only while `scrollport height - band height >= 44 px`. Otherwise it is not stuck and scrolls with the sheet. 44 px is one control, from answer 1.
- G-b. `scroll-padding-top` equals the band height while the band is stuck and is 0 whenever it is not stuck. That includes the keyboard-up case, the landscape two-column case of 20.14, and G-a's short case.
- G-c. After a real Tab, every stop of the sheet is fully inside the scrollport and clear of a stuck band. A stop taller than the room it has (the scrollport, less a stuck band) passes when its top is in view below the band (the 20.14 pass rule, extended to the stuck band). The plate is exempt: it is the band.
- G-d. With the keyboard up, a focused text field shows as much of itself with the drawer open as the same page shows at the same size with the drawer closed, after focus and after one typed character.
- G-e. G-a and G-b are recomputed whenever the scrollport or the band changes size, whatever the reason (window resize, rotation, keyboard cap, name row, a different scale).
- G-layout. G-a and G-b speak of the one-column layout. In the landscape two-column layout of 20.14 the padding stays 0 and the columns stay as built; G-c, G-d and G-e still apply there.
- G-f. After the drawer opens, the toggle that opened it is in view by G-c's pass rule (in DR1 focus stays on the toggle).
- G-floor. Where the scrollport itself is under 44 px high (the sheet's footer has taken the room, as it does on main), no control can be shown whatever the drawer does. Such a cell is held to G-a (not stuck), G-b and G-d only, and the test prints the cells it treated this way.

**Rule S (state), stated once.** For every combination of sheet (Add, Edit), stored `mirror`, stored `mirrorBottom` (absent, true, false), stored `anchor` (absent, one, between), box (with or without bottom notes, with or without inner notes, valid or invalid) and each control pressed or not: the notice text and each control's enabled, pressed and visible state equal spec 16.1 to 16.3 as read by 20.13 and 20.15.

**Goal.** PR #272 satisfies rule G and rule S, each proved by one enumerating test, and drops the old-bar sentence.

**Non-goals.** No change to the drawer's contents, copy (other than answer 3), focus order, notice rule, plate size, or anything spec section 17 gives DR2. No change to the landscape reading of 20.14. No engine, deck data or geometry change. Review nits of 20.14 and 20.15 stay unfixed except where a step below names one. No new dependency, no `<script src>`.

**Steps (tests first in each).**

1. Rule G test, e2e, one test that loops a fixed cell list: widths 320, 380, 500, 844; heights 390, 480, 553, 667, 780; Add and Edit; keyboard down, and up at 291 and 395 px for heights of 553 and more; a 9-note and a 19-note scale with bottom notes. Keyboard-down cells do the Tab walk (G-a, G-b, G-c, G-f); keyboard-up cells focus each text field and type one character (G-b, G-d). It computes what it expects from the page's own measurements, holds no pixel figure but 44, and names the failing cell. It also asserts the list is not vacuous: on each sheet at least one one-column cell is stuck and at least one is not; add a height to the list if that needs it. It is written from `regroup/grid.js` and must fail at 981f546 on the investigation's groups G1, G2, G3, G4. A second test does G-e by resize: open on Edit at 667x375, resize to 375x667, Tab through; and the reverse. A third does G-e by content: at one fixed size with the drawer open, replace the 9-note scale in the box with the 19-note one (the band's height differs between them) and assert G-a and G-b against fresh measurements one frame later. A fourth walks the boundary: at each width of the list, Edit, 19-note, drawer open, keyboard down, it steps the height 1 px at a time from 480 to 640, measures only (no Tab walk), asserts G-a and G-b at every step, and asserts that both states occur at each width that stays one-column through the walk. The cell list of the first test also carries the breakpoint neighbours 559x520, 560x520, 560x521, 639x700 and 640x699.

   Budget. These four tests live in a new file, `tests/drawer_grid.test.js`, because `tests/e2e.test.js` already runs under one 180 s wall clock in suite health and under the same clock per mutant. The lane registers the file wherever `tests/e2e.test.js` is registered (suite health's count table and its browser-file set, the browser case in `tests/mutation_check.sh`, the README if it lists suites) and checks the five mutants that patch that script still apply. Each test of the file runs in under 60 s here with `CHROME_BIN` set; the lane reports each time. If the first test is over, cells are cut in this order and the cut is reported: the 9-note scale from keyboard-up cells, then width 500 from keyboard-up cells.
2. Mechanism, in `index.html` outside the generated regions: one function decides stuck or not from live measurements (G-a), sets a class or attribute on the zone and sets `--plate-band-h` to the band height or 0 (G-b). Where it cannot measure (the unit tests' DOM stub has no `clientHeight`, `getComputedStyle` or `ResizeObserver`) it keeps today's result, stuck with the band's height, so no existing unit test changes meaning. The keyboard-up un-stick rule also zeroes the padding (one CSS line beside the existing rule). The function runs from `paintLayout` and from one ResizeObserver watching both the band and the sheet body (G-e); the observer is the recompute path, so no second listener is added beside `applyKbOffset`'s. `openDrawer` also brings the toggle into view, `nearest`, no animation (G-f).
3. Rule S test, unit, one test built from `regroup/state.js`'s product. Its expected values are a literal table written from spec 16.1 to 16.3, never the result of calling the app's own functions. Expected to pass as written; if a cell fails, fix the code, not the oracle, and report it.
4. Test repairs named by the investigation: the line 87 test is repaired in place under its present name: it asserts the band's position instead of skipping when it is not stuck, covers Edit, and checks the bottom edge; the line 108 unit test drops its `|| "Adjust layout"` fallback; one test is named for line 40.
5. Answer 3, done before any height is re-measured: delete the sentence from `PARSE_HINT`; update every test and mutant that reads the hint's text or its wrapped height; the plan's own copy of `PARSE_HINT` is the coordinator's to update.
6. Mutants: one per rule clause that code implements (stuck with a window under 44; threshold moved off 44 by a few px, killed by the boundary walk; padding kept while not stuck; padding kept with the keyboard up; sheet body not observed; band not observed, killed by the content test; toggle not brought into view), each killed by the step 1 tests. Re-anchor any mutant whose context moved. FLOORS and the README count follow the file count.
7. Push; `gh pr checks 272 --watch` to green; do not merge.

**Verify (a reviewer can rerun).** `CHROME_BIN` set, run `node --test tests/drawer_grid.test.js` and the step 3 test by name; all pass at the head. The tests of steps 1, 3 and 4 land in a commit of their own before the mechanism, and the lane reports the failing cells at that commit (groups G1 to G4 must be among them); the step 6 mutants, killed in CI's mutation gate at the head, are the standing proof. `python3 tools/inline_engine.py --check` and `python3 tools/sync_decks.py --check` clean. CI green at the head SHA.

**Acceptance.** Rule G and rule S hold as tested; the 37 [DR1] lines still pass; `PARSE_HINT` ends at "Octave numbers are optional."; at 380x780, 380x667 and 844x390 the drawer looks and behaves as at 981f546 (the band is stuck at the two portrait sizes, on Add and on Edit).

**Spec sentences read through this section** (the spec file is not edited by the lane; DOC folds these in). Section 5: the band is stuck only with a 44 px window under it; padding is 0 whenever the band is not stuck. Section 4 Open step 5: the toggle is also brought into view. Acceptance 34 and 87 are instances of rule G.

**Coordinator readings (AFK auto-decisions, for the owner).**

- 44 px is taken from the owner's words "the pinned pan plus one control".
- G-f, the toggle brought into view after open, is my reading: at 380x780 on Edit the focused toggle was left 1.4 of 44 px in view.
- The mechanism keeps `scroll-padding-top` (the investigation's option 1). Replacing it with a focus handler (option 2) or shrinking the plate (option 3) is not taken; the owner chose un-pin over shrink.
- Left for the owner's phone check, not changed: in landscape two columns the status line is not visible together with the plate top (spec line 226 makes this a report).
- Unknown and not testable here: whether iOS Safari honours `scroll-padding-top` as desktop Chrome does. It goes on the DR2 phone-check list.

**Review 4.** A fresh reviewer, briefed with the DR1 block through 20.13 to 20.16, facts only. Review 3's nits not named in step 4 stay listed, not fixed. **On a fourth FAIL the lane stops:** no fifth round; the coordinator reports to the owner with the finding and the options, because a fourth miss means the lane's shape, not its code, is wrong.

Reviewed 2026-10-07: engineering review (nine findings) and an outside voice (four findings), all folded into the text above.

### 20.17 DR1 outcome, interview 12, and Lane DR2 read against main (2026-10-08)

Lane DR1 merged as #272 (main b8c0944, 766 mutant files, 17 node suites). Review 4: PASS_WITH_NITS at 07b697e. The older text is not edited; read the DR2 block through this section. Where they differ, this section governs.

**Review 4 carry-overs.**

- F1 (owner: fix in DR2, interview 12 item 8). Under a standing `runGenerate` refusal the layout controls change state but the plate does not redraw: in `resyncSheet` the early return `if (refusal) { showRefusal(refusal); return; }` sits before the repaint. The same guard inside `disarmDelete` is deliberate (it runs inside a pointerdown) and stays as it is.
- F2. In landscape two columns the plate and the status line scroll away. On record; it goes on the phone-check list, not into a lane.
- F3. The "by content" test of `tests/drawer_grid.test.js` is vacuous: the band's height does not vary with the scale. DR2a changes the drawer's height, so DR2a either makes the test real or deletes it and its claim, and says which.
- F4. On Edit, a deck name with a non-ASCII letter (`D Kürd`) disables the toggle. Older than DR1. Not DR2's; listed for the owner.
- Test and comment nits of review 4 stay listed in the session record, unscheduled.

**Owner answers, interview 12 (binding).**

1. A second swap inside 600 ms: the new flash replaces the old. At no time do more than two seats carry `.panflash`.
2. With a note picked, a hold, Space, Enter or drag start on the note of a one-note ring acts as a tap on it: refused, status row 10, pick kept.
3. Escape with a note picked puts it down and the drawer stays open, wherever focus is (a note, a NOTE or SEAT button, any drawer control, `#scale-box`). The next Escape closes the drawer.
4. After a refused tap on a note of another ring, focus stays on the picked note.
5. The anchor helper speaks of seats: `On centre puts seat 1 at the bottom centre. Beside centre puts the bottom centre between seats 1 and 2.`
6. On Edit, when a ring's note count differs from the stored deck's count for that ring: that ring is at the default, the other rings keep their moves, and `#scale-layout-state` says so.
7. When the drawer closes while `#scale-box` does not parse, focus goes to `#scale-layout-toggle` and the soft keyboard is not raised.
8. F1 above: every layout control and every committed swap redraws the plate under a standing refusal. The primary button stays disabled and the refusal message stays.

**Spec sentences read through this section** (lanes do not edit the spec; DOC folds these in). Acceptance 94 drops "with no other swap in the 600 ms before it": after any committed swap exactly the two seats of that swap carry `.panflash`, and none does 700 ms after the last swap. Section 6 gesture table, row "Hold a note": the held note becomes the picked note unless its ring has one note (item 2). Acceptance 55 gains the picked-note case of item 2. Section 16.3 gains a row: refused tap, pick kept, focus on the picked note, row 10. Section 9 and wireframe 5.2: the helper copy of item 5. Section 4 Close: item 7. Acceptance 107 stands and is an instance of item 3.

**Coordinator readings (AFK auto-decisions, for the owner).**

- Item 6 copy. The notice is the ordinary `#scale-layout-state` sentence followed by one sentence per such ring, in the order rim, inner, bottom: `The {ring} seats were reset.` It is shown only for a ring whose stored arrangement was not the default (a ring with nothing to lose says nothing), and it goes when the ring returns to the stored count (section 14 restores the arrangement). It shows with the drawer open or closed.
- DR2 is split in two serial lanes, DR2a then DR2b. DR1 carried 37 lines and failed three reviews; DR2 carries 70. The split is by behaviour: DR2a is everything that does not need a moving pointer, DR2b is the drag.
- The owner's phone check is one check, on DR2b's head, which contains DR2a. Neither lane merges before it. This is the conservative reading of "DR2's phone check is a gate".
- Item 7 against acceptance 16 (found by the outside voice). The toggle is `disabled` while the box does not parse and the drawer is closed, and a disabled button cannot hold focus. Reading: after such a close the toggle takes focus and carries `aria-disabled="true"` in place of `disabled`, with the disabled look, and a press does nothing and the hint reads as acceptance 85. When focus leaves it, it becomes `disabled` as acceptance 16 says. Acceptance 16 and 85 hold for both forms. Acceptance 121's first sentence is replaced by item 7; its other two sentences stand, and focus that was already outside the zone stays where it was (acceptance 107).
- Tests are organised by rule, not by acceptance line (the 20.16 lesson). The 70 lines must still each be covered; the lane's hand-back maps every line to the test that covers it.

**The code as it is on main (facts the lanes start from).**

- Seats are Edit-only today, and DR2 makes them work on Add and on Edit (spec section 19, acceptance 91). Every gate on `editingId` in the seat path goes or is re-keyed to "drawer open": `editedDeck` and `layoutFields` (which return nothing on Add), `previewLayout`'s early return, the `seats:` option in `solvePreviewLayout`, the seats line of `sheetOptions`, the interactive argument in `paintPan`, the `PAN_EDIT_HINT` suffix of the plate's name, the plate's click and keydown listeners, and the Edit-only entries of `panelStops`. `resetSheetState` already clears `layoutSeats` on Add and the save path already writes `seats` whenever `layoutSeats` is set.
- `syncLayoutSeats` drops a ring's seats when its count changes. Section 14's per-count memory replaces that. `HPE.layout.solve` refuses a seat list of the wrong length, so the memory must hand the solver only an arrangement of the ring's present count.
- `layoutNoticeText` compares anchor and mirrors only. Seats join the comparison by value (acceptance 91), and `layoutBase` gains the arrangements the sheet opened with.
- Reused, not rewritten: `layoutPrologue`, `zoneBlock`, `slotZones`, `seatsFor`, `slotOccupants`, `orderFromSlots`, `setRingSeats`, `wrap`. `moveNote` is already an exchange of two seats of one ring; the step buttons and every other path call one swap function made from it. `rotateLayout` and `stepLayoutSel` go. `layoutSel` (a slot) becomes the picked field or nothing.
- `tests/app.test.js` holds about 41 references to the old group and `tests/e2e.test.js` about 13; 17 mutant files name it. The README names no test file: it carries the mutant-file count and the node-suite count only.
- `touch-action` is decided from the live CSS before `touchstart` reaches script (the comment above the `.scene` swipe rules in `index.html` says so and records that a permanent non-passive `touchstart` listener regressed a held-drag test). `tests/e2e.test.js` has a `startDrag` touch helper built on CDP `Input.dispatchTouchEvent`.

**Rules, each stated once.** Expected values are a literal table or a small model written in the test from the spec, never the result of calling the app's own functions. Each rule has two layers. The unit layer (`tests/app.test.js`) enumerates state transitions exhaustively and may fabricate nothing the app renders: it drives the app's own functions and reads the app's own state. The browser layer proves the same rule on the real hit nodes, real focus and real events, on a smaller named set. A cell that cannot occur is listed in the test with its reason, not skipped silently. Rules P, W, C and R run on the Add sheet and on the Edit sheet.

- Rule P (pick, focus, status). State: {nothing picked, a note picked, a note picked and a SEAT step made since} x focus on {the picked note, another note of its ring, a note of another ring, the note of a one-note ring, a NOTE button, a SEAT button, another drawer control, `#scale-box`}. Event: every gesture of the section 6 table that the lane implements and every event of 16.3, with each key named (the four arrows, Home, End, Space, Enter, Escape, Tab, Shift+Tab), including the wrap at both ends of a ring. Target: the picked note, another note of its ring, a note of another ring, the note of a one-note ring, the ding, none. Expected, as literals: `seats`, the pick, the focused element, the roving `tabindex` holder, the full status sentence with its place words, and the `warn` colour. The sequence of acceptance 124 (pick A, arrows to B, Tab out, Shift+Tab back) and the Escape ladder of item 3 are rows of the table.
- Rule W (arrangements stay valid; acceptance 78). For every ring size from 2 to 20, from three starts (the default, one exchange, and a three-cycle, which is not its own inverse), with the other rings holding a non-default arrangement: for every pair of two different seats, by every path the lane implements, the result equals the start with exactly those two notes exchanged, computed in the test as a note-to-seat list; the other rings are unchanged; `HPE.layout.readSeats` accepts it. A swap of a seat with itself is a separate row: nothing changes. Step buttons are swept over every start seat and both directions, including the wrap.
- Rule C (count memory, section 14). A model of section 14 in the test, run over traces, each ring seeded with a non-default arrangement at every count it visits before the count changes: every walk of three count changes over the counts the parser can reach from {0, 1, 2, 3, 5} per ring; one edit that changes two rings; a pitch edit that keeps the count; an invalid parse between two valid ones; a swap made at a remembered count and the count revisited; RESET SEATS and the count revisited; the sheet closed and reopened (memory cleared). Drawer open and closed; with the drawer open, the pick in the changed ring or not. Expected: each ring's arrangement, the status sentence, the pick, and the item 6 notice.
- Rule R (redraw under refusal, item 8). With a refusal standing, for each control and its literal expected effect: each mirror (the ring's drawn angles reflect), each anchor not already pressed (the rim angles of the other anchor), the anchor already pressed (nothing), a SEAT step and a committed swap by each path (two fields exchange drawn positions), a NOTE step (the pick mark moves, no field moves), RESET SEATS (default angles). In every row the primary button is disabled and the refusal text is unchanged. The expected angles come from a literal fixture for one named scale, not from a second run without the refusal. DR2b adds the drag row.
- Rule G of 20.16 still holds. `tests/drawer_grid.test.js` stays green with the new controls in the drawer, and its Tab walk covers them. No pixel figure is added to it.
- Rule D (drag geometry; DR2b). The oracle is in the test: from the drawn circles it computes which target contains a hit point, a same-ring target winning over another ring's where both contain it (section 10, acceptance 44). Mouse and pen use the pointer position as the hit point; touch uses the point 36 px above the finger (section 7). For each ring of two or more notes and each pair of two different notes A and B: a drag that ends with the hit point at B's centre exchanges exactly A and B. For each note: a release with the hit point on its own seat, on each other-ring note's centre, on the ding, on empty plate and outside the plate gives what the oracle says (no change and row 10 or 11, or the same-ring swap where a same-ring target also contains the point), and the pick is as before the gesture. A one-note ring's note cannot start a drag (item 2). During a drag `.panarm` is on the one seat the oracle names, or on none. Browser set: every such pair at 380 x 667 for the D3 example, Kurd 10 and Pygmy (the three pans of acceptance 58), with a mouse; one pair per ring of each with touch; one pair per ring of the other built-ins; one pair per ring of Kurd 10 and Pygmy at 1280 x 800.
- Rule T (touch timing; DR2b), as traces. Each trace is a list of timed events (down at a note; moves with their distance from the down point, measured as a straight line; a second touch and where; up) with a literal expected result: lifted or not, `preventDefault` on `touchmove` or not, the pick, `seats`, the status row. The traces cover: up before 250 ms; a move of 8 px and of 9 px before 250 ms; held to 250 ms then up without moving (acceptance 100: with A picked, hold B, B stays picked and no click follows that puts it down); held then dragged to a same-ring note, to another ring, off the plate; a move under 8 px before the lift and a drag after it; a second touch before the lift and after it; each of those with nothing picked, with the held note picked, with another same-ring note picked, with a note of another ring picked; a one-note ring's note. The 250 ms tie is a lift. The unit layer runs every trace against a controlled clock. The browser layer runs a named subset with CDP touch input and real waits (CDP event timestamps do not advance the page's timer) and asserts the sheet's `scrollTop`: unchanged through a lifted drag, changed by a swipe that starts on the plate and is not held.

**The contract between the two lanes.** DR2a builds three operations and DR2b calls them and writes no second copy: pick a note or put it down; swap two seats of one ring (commit, flash, status); cancel whatever gesture is in flight. DR2a's click handler takes a "suppress the next click" flag that DR2b sets after a drag and after a hold that lifted. The plate is repainted by replacing its markup, so DR2b's listeners sit on an element that survives a repaint, and a repaint during a gesture (NEXT NOTE, a reset, an edit, the scale ceasing to parse, the drawer or the sheet closing) cancels the gesture first.

### Lane DR2a: seats without a drag

- **Goal**: with the drawer open, on Add and on Edit, every swap can be made by tap-then-tap, by the keyboard and by the step buttons, with live redraw, and it reaches the generated deck, the stored record and the share link; the old ROTATE and MOVE group is gone.
- **Owns**: in `index.html`, outside the generated regions: `selectPanField`; the interactive branches of `pan()` and `paintPan`; `sizePanHits` (its ring-mode call) and the sheet's callers of it; the hit layer and its marks (`.panhit`, `.pansel`, `.panseat`, `.panveil`, `.panflash`, the focus mark); the step buttons and RESET SEATS; `#scale-drawer-hint` and `LAYOUT_HINT`; the anchor helper copy; `layoutStatus` and the height reserved for the status line; the plate-cap adjustment section 5 allows; `layoutNoticeText` and `layoutBase` for seats and the item 6 notice; the per-count arrangement memory in place of `syncLayoutSeats`; every `editingId` gate listed above; `moveNote`, `stepLayoutSel`, `layoutSel`; focus on open and on close, with the toggle's `aria-disabled` form; the drawer entries of `panelStops`; the removal of `#scale-legacy-group`, `#scale-legacy-hint`, `#scale-layout-label`, the four `scale-rot-` and `scale-move-` buttons, `rotateLayout` and the old `previewBox` keydown handler; the repaint in `resyncSheet` that item 8 needs (the guard in `disarmDelete` is not touched). In `tools/sandbox.js`: the id list (old ids out, new ids in) and whatever the stub needs for the unit layer to drive the app's own hit nodes. Tests: `tests/app.test.js`, a new `tests/drawer_seats.test.js`, the tests of `tests/e2e.test.js` and `tests/drawer_grid.test.js` that the removal or the new stops change. Every mutant anchored on a line it rewrites; the README's drawer sentence, its mutant-file count and its node-suite count (17 to 18).
- **Reads only**: the design spec, `src/engine/*`, `data/decks.json`.
- **Acceptance lines**: 18, 19, 24, 29, 51 to 54, 55 (tap, Space, Enter, arrow), 56 to 76, 78 (all but drag), 83, 84, 90, 91, 94, 95 (all but `.panarm`), 96 to 99, 102 to 107, 116, 120, 122 to 124, 126, 132, as read above. The hand-back maps every line, and every clause handed to DR2b, to the test that covers it.
- **TDD order**: rule W, rule P, rule C, rule R as unit tests (tables first, failing); then the browser tests in `tests/drawer_seats.test.js`: the browser layer of P on the real nodes (focus on open and close, the Tab order of line 120, the Escape ladder, item 7), marks and sizes (lines 57, 58, 84, 95), the flash of item 1, the longest status sentence against the reserved height, and one round trip on each sheet (swap, keep, reopen on Edit, read the share link); then the removal (line 24) and the tests it retires or rewrites; then mutants, one per rule clause that code implements.
- **Budget**: nothing new goes into `tests/e2e.test.js`. `tests/drawer_seats.test.js` is registered wherever `tests/drawer_grid.test.js` is (`tests/suite_health.py` count table and `E2E_FILES`, the browser case of `tests/mutation_check.sh`, `tests/shard_mutants.js`), and the five mutants that patch that script are checked to still apply. Each test runs in under 60 s with `CHROME_BIN` set and the file in under 150 s; the lane reports each time. A rule may be split across several tests of one file. Nothing is sampled to save time without the cut being reported.
- **Acceptance**: `node --test tests/app.test.js` passes; with `CHROME_BIN` set `node --test tests/drawer_seats.test.js tests/drawer_grid.test.js` passes; `grep -c "scale-rot-\|scale-move-\|scale-legacy" index.html tools/sandbox.js` prints 0 for both; `python3 tools/inline_engine.py --check` and `python3 tools/sync_decks.py --check` are clean; CI green at the head SHA.
- **Verify**: push, `gh pr checks <n> --watch` in the foreground. No full e2e and no full `tests/mutation_check.sh` locally. Do not merge.
- **Non-goals**: any pointer drag, hold, ghost or `.panarm` (DR2b; a press that moves is ignored in DR2a's build); any engine, deck data or geometry change; `pan()` output for non-interactive drawings (line 40 still holds); the landscape reading of 20.14; F2, F4 and the unscheduled nits; the spec, the plan, CLAUDE.md.
- **Stop conditions**: a path can produce an arrangement `readSeats` refuses; a rule needs an engine change; a spec sentence not listed above contradicts interview 12; line 84, or line 58 with the plate cap not lowered, cannot hold at 380 x 667 (where the cap was lowered line 58 is a report, as it says); a browser test cannot meet the budget.
- **Mutant delta (forecast)**: about +12, less the mutants that die with the old group. FLOORS and the README count follow the file count.

### Lane DR2b: the drag

- **Starts** when DR2a's review has passed. Its branch is cut from DR2a's head and its PR is based on DR2a's branch until DR2a merges.
- **Goal**: a note can be dragged to another seat of its ring with a mouse, a pen or a finger, without scrolling the page, a swipe that is not a hold still scrolls the sheet, and a refused drop is shown.
- **Owns**: in `index.html` the pointer and touch handlers, the ghost, `.panarm`, the click suppression after a drag and after a hold that lifted, a second touch, the cancel on every repaint named in the contract, the reduced-motion rule for the ghost; a new `tests/drawer_drag.test.js` and its registrations; the drag rows of rules P, W and R and the unit layer of rule T in `tests/app.test.js`; its mutants; the README's mutant-file count and node-suite count (18 to 19).
- **Reads only**: everything DR2a owns. A change to DR2a's code is allowed only at the contract's three operations and the suppress flag, and is reported.
- **Acceptance lines**: 41 to 50, 55 (hold, drag start), 78 (drag), 77, 92, 93, 95 (`.panarm`), 100, 101, 125, the in-flight rows of 16.3, and item 2 for hold and drag start.
- **Step 0, before any handler: a feasibility probe.** `touch-action` is fixed before `touchstart` reaches script, so a CSS change at the lift cannot stop the gesture already under way and is not the mechanism. The mechanism is the non-passive `touchmove` listener registered when the drawer opens (acceptance 47), on the plate, not on the page. The lane builds only that listener and the hold timer and runs three traces in Chrome with touch emulation: a held press then a drag (the sheet's `scrollTop` must not change); a move under 8 px before the lift then a drag (the same); a swipe from the plate with no hold (the sheet must scroll). It reports the three results before going on. If the second or third cannot be made to hold, that is a stop condition, not a thing to tune around.
- **TDD order**: step 0; rule T's unit traces, rule D, the drag rows of rules P, W and R, all failing first; then the handlers; then mutants, one per clause.
- **Budget**: as DR2a's, for `tests/drawer_drag.test.js`, rule D split across tests by pan. If a rule D test is over 60 s, the 1280 x 800 pairs go first, then the other built-ins' pairs; the cut is reported.
- **Acceptance**: with `CHROME_BIN` set `node --test tests/drawer_drag.test.js tests/drawer_seats.test.js tests/drawer_grid.test.js` passes; `node --test tests/app.test.js` passes; both sync checks clean; CI green at the head SHA.
- **Verify**: as DR2a. The PR carries the phone-check steps and the line `Phone check: UNVERIFIED` until the owner reports.
- **Non-goals**: as DR2a's, and any change to tap, keyboard or step-button behaviour; no permanent non-passive `touchstart` listener anywhere; no listener on the page outside the plate.
- **Stop conditions**: as DR2a's; step 0 fails; a touch drag cannot be kept from scrolling the sheet without a change outside the plate.
- **Mutant delta (forecast)**: about +8.

**Owner gate.** After DR2b's review passes, the owner checks DR2b's build on a phone: iOS Safari and Android Chrome, both required (owner, interview 13). The list: a held note dragged without the sheet scrolling; a swipe that starts on the plate and is not held scrolls the sheet; a small wobble before the lift, then a drag; hold to lift; a refused drop; tap then tap; the step buttons; iOS Safari's `scroll-padding-top`, `:has()` and the `focusin` reveal from DR1; the keyboard up at heights under 553 px; real web fonts; landscape two columns (F2). Then DR2a merges, DR2b is rebased onto main if needed and merges after CI is green at its new head and a fresh review of that head.

**Both lanes.** Commits end with the two attribution lines of this session, `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and the `Claude-Session:` line; no other model name. Mutant patches carry no `index a..b` line; `# suite:` headers hold no quoted pattern; `# kills:` equals the test name. Engine regions and the `const DECKS` line are generated and are not edited.

**Reviews.** One fresh reviewer per lane, briefed with this section and the lane's block, facts only. DR2a is reviewed against its own line set; the clauses handed to DR2b are not findings against it. On a third FAIL of one lane the regroup rule applies.

**Engineering review and outside voice (2026-10-08).** Seven review findings and fifteen outside-voice findings, all folded in above; none left open. The largest: seats were Edit-only in eight places; rules C and W could pass with the feature broken (default arrangements only); rule D contradicted the overlap rule of section 10; rule T was not single-valued; item 7 pointed focus at a disabled button; the touch mechanism needed a probe before code.

### 20.18 DR2a review 1: FAIL at 226e909 (coordinator record, 2026-10-08, owner away)

PR #273, CI green. Three findings, each reproduced by the reviewer. This section governs the DR2a block where they differ.

**Interview 13 (owner, 2026-10-08, binding).** (1) The item 7 reading of 20.17 is confirmed: the toggle takes focus as `aria-disabled` and becomes `disabled` when focus leaves. (2) The item 6 notice copy `The {ring} seats were reset.` is kept. (3) The phone check needs iOS Safari and Android Chrome, both, before either DR2 merge. (4) The check build is a private artifact of DR2b's `index.html`.

**F-1. Acceptance 84 does not hold.** At 380 x 667, band stuck: on Add after one swap the notice pushes the seat row 14.7 px out of the scrollport; on Edit the footer leaves a 425 px scrollport and the note row is 2.7 px out and the seat row wholly out, with or without a notice. The plate cap was not lowered. The lane's test for the line checks only the band's growth. This was a stop condition and was not reported.

Reading (AFK auto-decision, for the owner):

- On the Add sheet line 84 is required as written, in every notice state (no notice, and the longest Add notice showing) and with the longest status sentence. The lane lowers the open plate cap as section 5 allows, never under the 240 px floor, and reports the measured plate width.
- On the Edit sheet at 380 x 667 line 84 cannot hold above the 240 px floor (it would need about 207 px), so there it is a report, not a requirement. What is required on Edit: rule G as it stands (every stop reachable by Tab, clear of the stuck band), and the plate no narrower than on Add. The lane reports how far each row sits outside. The owner sees this at the phone check and may ask for a different footer or plate; nothing else is changed for it now.
- The test named for line 84 measures the toggle and both step rows against the scrollport on Add in each notice state, and records the Edit figures without asserting them.

**F-2. A count change that lands on the keystroke that ends a pause loses its sentence.** `paintLayout` writes "Layout is ready again." over the row 15 or 16 message that `noteCounts` has just written. Section 14 says row 18b leads the one message. Fix: one message, row 18b first, then the count sentence. Rule C gains typed traces, one keystroke at a time, with the drawer open: a bottom note typed into a pan with swapped bottom seats; the `zzz` case (rim 8 to 3); a restore (row 16) that ends a pause. Expected text is a literal.

**F-3. Acceptance 95.** `.panseat` is 1.6 CSS px; the line asks for at least 2. The ink hairline of `.pansel` is drawn at the same radius as the orange ring, not outside it. The unit test's hairline pattern matches any `#272219` stroke. Fix both marks; the unit test asserts each mark's radius and stroke width by class; a browser test in `tests/drawer_seats.test.js` reads the computed stroke widths and the hairline's radius with a note picked (the TDD order asked for it).

**F-1 addendum (same day, after the lane stopped on it).** No one cap satisfies line 84 on Add with the notice showing (needs a plate of about 247 px or less) and line 58 on Pygmy (needs about 262 px). The spec already says which gives way: section 5 and line 58 make line 58 a report for a pan that falls under 44 px where the cap was lowered, named on the PR and shown to the owner at the phone check. So: the cap goes to `39dvh` (plate 242.1 px at 380 x 667), line 84 is required on Add, and Pygmy's line 58 at that size becomes a recorded report (40.7 px measured); Amara and Kurd keep line 58 as a requirement. The PR names Pygmy and the figure. AFK auto-decision: this follows the signed-off spec and makes no new reading; the alternative (keep 262 px and let the seat row sit 14 px low after a swap on Add) is for the owner to choose at the phone check. The commit trailer of a lane is the one its own session's attribution reminder gives; the instruction in 20.17 to use another model name was wrong and is withdrawn.

**Steps.** Tests first for F-1, F-2, F-3, failing, in one commit; then the fixes; one mutant per fix; push; CI green at the head; do not merge. Nothing else is changed.

**Left as they are (review 1 nits, not fixed before the final review).** Rule W sweeps inner and bottom to 8 and Space/Enter to 8 (the reviewer's 5,947-cell sweep found nothing); no test reads a share link; `.panflash` has no fill or fade; `layoutStatus` re-announces only warnings; other-ring target radii grow on a pick; the hint is not dimmed with an `aria-disabled` toggle; an identity seat list is not normalised on load; the hung RESET mutant's cause is unknown (no real input reaches it in a 36,000-step fuzz); no browser test of 107 or item 6; "back to 1 notes"; RESET SEATS clears the count memory; no mutant names a rule C or R clause. Also recorded: the lane's six commits carry another model name in the co-author line; history is not rewritten for it. `tests/preview.test.js` and `tests/fixtures/app_surface_v1.json` were edited as consequences of owned removals, and `align-self:start` on the landscape band undoes the lane's own regression; all three accepted.

**Review 2.** A fresh reviewer, briefed with 20.17 and this section, facts only. A third FAIL triggers the regroup rule.

### 20.19 DR2a review 2: FAIL at e1b8693 (coordinator record, 2026-10-08, owner away)

PR #273, CI green. One blocking finding, reproduced in Chrome. Review 2 walked the other DR2a lines on the Add sheet in a browser and found them holding; F-1 to F-3 of 20.18 are repaired.

**F1. Acceptance 18 is not implemented.** `openDrawer` moves no focus: after a pointer click or Space on the toggle, focus is still on the toggle. Line 18, section 4 Open step 3 and interview 8 item 2 say focus moves to the roving note: the first pickable note; if no ring has two notes, the first note of the pan; if the pan has no note, focus stays on the toggle; the soft keyboard is not raised. The test titled for line 18 asserts nothing about it, and the browser Tab test puts focus on the note by script.

**Cause, the same in both reviews.** Lines 18, 84 and 95 were each named in a test title and not asserted by it. The lane handed back test names by group, not the line-by-line map its block asks for, so nobody saw the holes. The repair therefore starts with the map.

**Steps (tests first).**

1. The map. A table in the PR body: every acceptance line of the DR2a block, one row each, with the test (file and name) and the one assertion in it that would fail if the line were broken. A line with no such assertion gets one, on the sheet or sheets the line speaks of, before any fix. A test title names a line only if the test asserts it. Clauses handed to DR2b are rows marked DR2b. The lane reports every line that had no assertion.
2. F1. Browser tests of focus after opening: by pointer and by keyboard, on Add and on Edit, on a pan with a two-note ring, on a pan with no two-note ring (`(D3) A3`: A3), on a pan with no note (focus stays on the toggle), and on a reopen. Then the fix. After it, shown by tests: a pointer open shows no focus mark (line 96); rule G and line 84 still hold at 380 x 667 (a programmatic focus can scroll the sheet, so the focus move must not scroll the toggle or the step rows out).
3. Line 95 on small fields. At the 242 px plate the ink hairline overlaps Pygmy's orange ring and leaves under 2 px of orange showing (1.39 px on the bottom shell). Required: on every field of the five built-ins at the 380 x 667 open plate, the orange of `.pansel` shows at least 2 CSS px and the ink hairline is 1 CSS px wide and lies wholly outside the orange. The browser test computes this from the drawn radii and stroke widths in CSS px, for every field.
4. Test repairs: the Amara and Kurd line 58 tests assert 44, not 43.5; the status-height test uses the longest single status row of the spec table, not a shorter sentence.
5. One mutant per fix (focus on open removed; focus on open when the pan has no note; the hairline pulled onto the ring). Push; CI green at the head; do not merge.

**Recorded, not changed.** The deletion of the "DR1 rule G by content" test in 85495d3 is the F3 choice of 20.17 (delete the test and its claim); said here because the commit did not say it. A composite status message of three or four sentences (a two-ring edit that also ends a pause) runs to three or four lines and can push the seat row out at 380 x 667; the spec's two-line rule speaks of single rows, so this is a phone-check item for the owner. The browser files measure fallback fonts; the reviewer's real-font run gave the same line counts.

**Review 3.** A fresh reviewer, briefed with 20.17, 20.18 and this section, facts only. **A third FAIL triggers the regroup rule; the lane is not resumed after it.**

### 20.20 DR2a review 3: PASS_WITH_NITS at 8122e7a; DR2b starts (coordinator record, 2026-10-08, owner away)

PR #273 at 8122e7a: CI green on attempt 2 of run 37838167957, review 3 PASS_WITH_NITS, no blocking finding. **DR2a is not merged: the owner's phone check gates it.** This section lives on DR2b's branch so that DR2a's reviewed head does not move.

**N1, fixed in DR2b's first commit.** Attempt 1 of that run timed out `tests/app.test.js` at the 180 s suite clock. The reviewer measured it: the six "DR2a rule W" sweep tests take about 42 s of the file's 55 s locally and put the file near 165 s on CI. It is an overrun, not a hang. DR2b adds more unit tests to the same file, so before anything else DR2b moves the DR2a rule W sweep tests, unchanged, into a new unit file `tests/seat_sweeps.test.js`, registered wherever `tests/app.test.js` is registered as a unit suite (suite health's count table and FLOORS, `tests/mutation_check.sh`, `tests/shard_mutants.js`, the README's node-suite count); every mutant whose `# suite:` or `# kills:` names a moved test is repointed; the mutants that patch `tests/mutation_check.sh` are checked to still apply. No assertion changes and no sweep is cut. This is the one change DR2b may make to DR2a's tests. The timeout is not raised.

**DR2b block, additions (they govern where they differ from 20.17).**

- The hand-back and the PR body carry a table: every DR2b acceptance line, one row each, with the test file, the test name and the one assertion that fails if the line breaks. It is written before the handlers, with the failing tests. A test title names a line only if the test asserts it. Both DR2a FAILs after review 1 came from lines named and not asserted.
- Commits end with the attribution the lane's own session gives (20.18), not the Opus line of 20.17.
- The README node-suite count goes 18 to 20 (the sweep file and `tests/drawer_drag.test.js`).
- DR2b's new unit tests go where they keep `tests/app.test.js` and `tests/seat_sweeps.test.js` each under 90 s on CI's js step, read from the CI log at the head; the lane reports both times.

**Phone-check list, added to 20.17's.** A composite status message of three or four sentences against the seat row at 380 x 667; Pygmy's 40.7 px targets (line 58 report); on Edit the SEAT row below the fold (line 84 report); place words on an 8-note rim under BESIDE CENTRE, where every seat sits on a sector boundary and mirror-image seats read differently ("lower right" against "bottom"); that opening the drawer does not raise the soft keyboard.

**Left as they are (review 3 nits).** N3 the line 70 unit test's title; N4 the keyboard-open browser test uses a script click after Tab, and the bottom-only line 18 test accepts C3 or D3; N6 the partly asserted lines listed in PR #273's map. N5: the plan commits on the lane branch are the coordinator's.

### 20.21 DR2b step 0: the touch finding was the test, not the app (coordinator record, 2026-10-08, owner away)

The lane reported at 0ff4adb that a held note, dragged, still scrolled the sheet under CDP touch, and marked the browser test "DR2b browser (46, rule T)" `todo`. A read-only investigation (probes in the session scratchpad, folder `inv-touch-probes/`) found:

- On a fresh page the build holds all three step 0 traces: held drag 0 to 0, a move under 8 px then a drag 0 to 0, an unheld swipe 0 to 114.
- The test pressed while the sheet was still flinging from its own swipe. Chrome sends a touchstart that lands during a fling as non-cancelable, and every touchmove of that touch with it; a standalone control page behaves the same. Waiting for the scroll to go quiet (300 ms or more, or no fling) makes it pass.
- The listener the lane adds to the touched node at pointerdown carries the drag: after the lift's repaint the touch events go only to the detached node. Without it the held drag scrolls (0 to 114).

**Repair (tests only; no change to `index.html`).**

1. The rule T browser test waits until `.sheetbody`'s `scrollTop` is unchanged across 200 ms before the held half, and the `todo` comes off.
2. It gains trace (b): one move under 8 px during the hold, then the drag; the sheet does not scroll and the note lifts.
3. A mutant removes the touched-node listener and is killed by that test.
4. The PR body's step 0 section and line 46 row are rewritten to say this.

**Recorded, not changed.** A finger that lands on the plate while the sheet is still flinging cannot drag: the browser has already taken the gesture. It ends as "no drag" with the pick restored. Nothing within the block's limits (no permanent non-passive `touchstart`, no listener outside the plate) changes that. Phone-check item, with: iOS Safari's delivery of touch events to a detached SVG node; the long-press callout or magnifier on iOS; Android's long-press at about 500 ms; a finger's jitter during the hold.

### 20.22 DR2b review 1: FAIL at 07d896e (coordinator record, 2026-10-08, owner away)

PR #274, CI green. One blocking finding; the lane's flags (no listener outside the plate, no `touchstart` listener, no change to tap, keys or step buttons, generated regions clean) are all clear, and the six DR2a sweeps moved byte-identical.

**F1. The ghost is drawn away from the hit point while the keyboard lift is on** (acceptance 47, 92; spec section 7, Hit point). The ghost is `position: fixed` inside `#scale-plate-band` and is given viewport coordinates, but `applyKbOffset` puts a transform on `.sheetsurf`, and a transformed ancestor is the containing block of a fixed box. Measured with the fake keyboard and focus in `#scale-box`: 8 px off at 380 x 667, 128 px with `offsetTop` 120, 150 px sideways at 820 x 1180. The swap still lands under the hit point, so the ghost and the armed seat disagree.

**Steps (tests first, each failing before its fix).**

1. F1. A browser test: drawer open, focus in `#scale-box` with the fake keyboard, at 380 x 667 (`offsetTop` 0 and 120) and 820 x 1180; during a touch drag and a mouse drag the ghost's centre is within 1 px of the hit point (36 px above the finger; the pointer for a mouse), and the armed seat is the one under the ghost's centre. The same with no keyboard. Then the fix, inside the ghost's code: the ghost's position is right whatever transform its ancestors carry. `applyKbOffset` is not changed.
2. A press whose `pointerup` never reaches the plate: a later `pointermove` with no button down (`buttons` 0, mouse or pen) ends the press and lifts nothing.
3. The status row after Escape tells the truth: after a tap, a step that swapped, then a drag of the picked note onto its own seat, or a hold and release on it, Escape gives row 9b (the swaps are kept), not row 9. A lift of the already-picked note does not clear `pickMoved`.
4. A hold that lifts does not change `.sheetbody`'s `scrollTop` (step 0's first trace), also when the focused note is partly out of view: the reviewer saw 0 to 12 px at 380 x 390 from the repaint's focus restore.
5. A `pointercancel` with no gesture in flight leaves the status line as it was.
6. Tests the block asks for and the PR lacks, added (the behaviour was probed correct): a drag under a standing `runGenerate()` refusal redraws the plate and keeps the refusal (rule R drag row); rule D's touch pairs on the D3 example and Kurd 10 as well as Pygmy; rule T's touch "up before 250 ms" trace. Any test title that names a rule or line it does not assert is renamed.
7. Unit-file time. CI's log carries no per-file time, so 20.20's 90 s line is replaced: **no unit test file takes over 25 s locally** (`node --test <file>`, reported per file). The sweeps are split across as many `tests/seat_sweeps_*.test.js` files as that needs, tests unchanged, registered as `tests/seat_sweeps.test.js` is; mutant `# suite:` headers follow; the README's node-suite count follows the files.
8. The PR body: "Changes to DR2a-owned code" lists every edit inside DR2a-owned functions (`pan()` arm marks, the hit layer's arm, the cancel hooks in `paintPan`, `syncParseState` and `resyncSheet`, the listener add and remove in `openDrawer`, `closeDrawer` and `dropDrawer`); the gaps list names every cut that remains. One mutant per fix of steps 1 to 5.

**Recorded, not changed.** A second touch outside the plate while the first finger is still does not cancel (the block allows no listener outside the plate). NEXT NOTE during a drag steps from the dragged note (16.3 does not say otherwise). A touch move of 9 to 14 px released without a scroll may still tap. All three are phone-check items, as is whether a real iOS keyboard produces F1's lift state.

**Review 2.** A fresh reviewer, briefed with the DR2b block and 20.20 to this section, facts only.

### 20.23 DR2 merged; owner phone check; interview 14; lane DR3 (2026-10-08)

**Record.** DR2b review 2: PASS_WITH_NITS at 3e90c34 (CI run 37859965774); F1 retested by the reviewer at 0.015 px over 20 cells. The owner checked the build on iOS Safari and Android Chrome: "both work great". #273 then #274 merged (main b14febb, 775 mutants, 22 node suites). Review 2's nits are listed under "Left as is" below.

**Interview 14 (owner, 2026-10-08, binding).**

1. A seat's number does not change. A swap moves the note name; the number stays at the position. This holds on the generated cards too, so the drawer and the cards agree.
2. The four step buttons stay but are hidden behind a call to action ("Hard to tap? ... finer controls"), placed right above or below the reset button. Front-end design consulted.
3. `RESET SEATS` becomes `RESET LAYOUT`, drawn as a real button, and resets everything: moved notes, both mirrors and the orientation.
4. `NOTE 1` becomes `HANDPAN ORIENTATION`, options `1 CENTRED` and `1 + 2 SPLIT`, and the section moves to the top of the drawer, still below the pan.

**Lane DR3.** Branch `claude/scale-dr3`, own worktree, one PR to main.

**Goal.** The drawer follows interview 14.

**Rule N (numbers belong to seats).** On every pan, generated or built in, the index number drawn at a position is the number the default arrangement (no seat moved; the deck's own anchor and mirrors applied) draws there. Moving notes changes which note name a position shows and nothing else about its number. A card's number line shows, for each note of the voicing, the number drawn at that note's position on the diagram, so the diagram and the line agree on every card. A deck with no moved seat is byte-identical to today in every output: `data/decks.json`, the five built-ins' drawings, their cards, their PDFs, share links and stored records. The stored seat arrangement and the share format do not change; numbers are derived, never stored. The drawer's status and helper copy uses "seat N" for the same number the plate draws.

**Drawer order, under the band and the toggle row.**

1. `HANDPAN ORIENTATION` (the label, id unchanged), the pair `1 CENTRED` (`#scale-anchor-one`) and `1 + 2 SPLIT` (`#scale-anchor-between`), then the helper: `Which note sits nearest you: note 1 alone, or notes 1 and 2 side by side.`
2. `MIRROR TOP`, `MIRROR BOTTOM` and their helper, unchanged.
3. The disclosure: one quiet text button, `#scale-fine-toggle`, in the style `#scale-layout-reset` has today (no border, `#a79d8b`, 9.5 px caps, 44 px high, full row, centred). Closed it reads `HARD TO TAP? SHOW FINER CONTROLS`; open it reads `HIDE FINER CONTROLS`. It carries `aria-expanded` and `aria-controls="scale-fine"`.
4. `#scale-fine`, hidden until the disclosure is opened: the two existing rows, PREVIOUS NOTE / NEXT NOTE and PREVIOUS SEAT / NEXT SEAT, ids and behaviour unchanged.
5. `RESET LAYOUT` (`#scale-layout-reset`), now a `.mode` button, full row.
6. `#scale-drawer-hint`, last.

**Disclosure behaviour.** Closed whenever the sheet opens. Opening it does not move focus and does not scroll; closing it while one of the four buttons has focus puts focus on the disclosure. It stays as set while the sheet stays open, across drawer close and reopen. While closed the four buttons are out of the tab order and out of the accessibility tree. It is enabled whenever the drawer's controls are. The arrow keys on the plate and every tap and drag behaviour are unchanged whether it is open or closed. Rule G of 20.16 holds with it open and closed.

**RESET LAYOUT.** Returns all three seat arrangements, `mirror`, `mirrorBottom` and the anchor to the default: no seat moved, both mirrors off, anchor `one`. On Edit this is the generated default, not the stored record. Enabled when any of those differs from the default. It puts down a picked note, cancels a drag, and writes `Layout reset.` to the status line. The Edit notice that names a reset ring (interview 13) keeps its copy.

**Copy that follows.** Every string that names `RESET SEATS`, `NOTE 1` as the section, `ON CENTRE` or `BESIDE CENTRE` is updated to the new names. Status strings that tell the player to use PREVIOUS SEAT and NEXT SEAT say so only while the disclosure is open; closed, the tap string ends at "to swap." The step buttons' own status rows are unchanged.

**Non-goals.** No change to tap, drag, keyboard or step behaviour, to the plate, the band or rule G, to the notice rule, to the share format or stored records, to built-in deck data or geometry. No new component, dependency or `<script src>`. No fix for review nits unless a step names one. The spec file and CLAUDE.md are not edited (DOC does that).

**Ownership.** `index.html` outside the generated regions; `src/engine/*.js` only as far as rule N needs, synced with `tools/inline_engine.py`; `tools/hifi.py`, `tools/decks.py` and `pdfcards` code only as far as rule N needs; tests, `tests/mutants/`, FLOORS, README counts. If rule N cannot be met without changing a stored format, a built-in's bytes or the print output of an unmoved deck, the lane stops and reports before building.

**Steps (tests first; the tests land in a commit of their own and the lane reports which fail there).**

1. Rule N. Unit tests: for the D3 example, Kurd 10 and Pygmy, with each anchor and mirror setting, after one swap and after three swaps on each ring, every position's number equals the default arrangement's number there and the note names moved; a card's number line equals the numbers at its voicing's positions; app and print agree per field (`tests/test_render_agreement.py`'s rule, on a moved-seat custom deck through the browser PDF path where print cannot read it). A no-move deck's output is byte-identical to main for all five built-ins and one custom deck. Then the change.
2. Order, names and copy, with unit tests for the DOM order, the labels, the helper and each updated string.
3. Disclosure, with unit tests for each sentence of "Disclosure behaviour" and one browser test at 380 x 667 on Add and Edit, open and closed, that the Tab walk meets rule G-c.
4. RESET LAYOUT, with unit tests over the product of (seats moved or not, each mirror, anchor) on Add and Edit: enabled exactly when something differs, and after it everything is default.
5. The `syncParseState` cancel hook (review 2 nit 1): a test that typing a scale with a different ring count during a lifted drag ends the drag without an error.
6. Mutants: one per rule clause the code implements (number follows the note; card line reads pitch order; disclosure open by default; hidden buttons left in the tab order; reset leaves a mirror; reset leaves the anchor; reset enabled rule). Re-anchor moved mutants. FLOORS and the README follow the file counts.
7. A line-to-assertion table on the PR for interview 14's four items and each sentence above. Push; `gh pr checks <n> --watch` to green; do not merge.

**Verify.** `python3 tools/inline_engine.py --check` and `python3 tools/sync_decks.py --check` clean; `python3 tools/decks.py` rebuilds PDFs whose extracted text is unchanged; the named tests pass with `CHROME_BIN` set; no unit test file over 25 s locally except `tests/sequence.test.js`, which is not this lane's; CI green at the head SHA.

**Owner gate.** A private Artifact of the DR3 build for the owner to look at before the merge: the wording, the disclosure and the numbers after a swap.

**Left as is (review 2 nits, for DOC or the owner).** Releasing a drag can scroll the sheet up to 13 px at 380 x 390. `ghostShift` is exact for translate-only ancestors. The #274 PR body lists the focusout listener wrongly and omits the `.panhit` cursor and `let armId`. A vestigial `assert.ok(r)`. `tests/sequence.test.js` takes 51 s locally.

**Coordinator readings (for the owner).** The disclosure sits above RESET LAYOUT and takes the quiet style the reset button gives up, so the reset is the one bordered button at the foot. The disclosure does not persist past the sheet. "Everything" on Edit means the generated default, not the stored record. `CENTRED` keeps the app's existing spelling.

## 20.24 Lanes PM and DR3: owner requests 1 to 7 (2026-10-08; replaces the lane block of 20.23)

This section stands on its own. It replaces the lane block of 20.23; where the two differ, 20.24 governs. All anchors are names (ids, functions, constants, test titles), never line numbers. It was drafted by a planner from the prompt in the PR description of the lanes (scratchpad `plan-prompt-dr3-pm.md`), checked against the tree at `claude/scale-dr3` (e1e9a8a), reviewed by `/plan-eng-review` with a codex outside voice, and amended in 20.24.4.

Requests 1 to 4 are interview 14 (20.23). Requests 5 to 7 are the owner's later message of 2026-10-08:
5. "Let's remove full deck pdf as a print option and adjust the menu ui; consult front end skills".
6. "remove all full deck seed PDFs currently in the repo. We can keep the full deck generator path but add a comment that it isn't being used".
7. "In resource, add a new option called 'Handpan 101' that links to https://docs.google.com/document/d/1C1BIyjEPIXPXdBq-3ezpVPeIqSWUxHswfdx0TpxEjco/edit?usp=drivesdk".

### 20.24.0 Lanes, merge order, rebase procedure

| Lane | Branch | Worktree | Requests | Gate |
|---|---|---|---|---|
| PM | `claude/print-menu` (new, cut from main) | its own | 5, 6, 7 | CI at pushed head SHA |
| DR3 | `claude/scale-dr3` (exists) | `.claude/worktrees/scale-dr3` | 1, 2, 3, 4 | CI at pushed head SHA, then owner private preview |

Merge order: **PM first, DR3 second.** Two reasons:
- PM has no owner gate, so it is not held up behind DR3's preview.
- PM removes the only control that prints the legend card. That makes the `legendLines()` sentence unreachable from the UI before rule N lands (see 20.24.3).

Neither lane merges anything; the coordinator merges. DR3 is not merged while PM is open. The lanes are built in parallel.

After PM merges, lane DR3 does exactly this, in order:
1. `git fetch origin`, then `git rebase origin/main` (no force-push of any shared branch; the lane's own PR branch is updated with `--force-with-lease` only).
2. `python3 tools/inline_engine.py --check`, then `python3 tools/sync_decks.py --check`. A failure is fixed by running the tool without `--check`, never by hand-editing a generated region.
3. `python3 tools/refresh_mutants.py` to re-anchor every mutant context, DR3's new ones included. Commit the refresh on its own.
4. Reset its own `FLOORS` rows in `tests/suite_health.py`, and the README mutant-file and node-suite counts, from the per-file collected counts in main's CI artifacts plus DR3's own additions. It never lowers a row it does not own.
5. Push and wait for CI at the new head SHA. Evidence gathered before the rebase is void.

If the order is inverted by the coordinator, PM performs the same five steps and DR3's acceptance criterion D-A12 is re-read (see the stop conditions).

---

## Lane PM (requests 5, 6, 7)

### PM.1 Goal and non-goals

Goal: the Print group offers one PDF, the chord-only one; the three full-deck seed PDFs leave the repo; Resources gains a `HANDPAN 101` link.

Non-goals:
- No change to PDF bytes of the chord-only variant.
- No removal of the full-deck code path (`downloadDeckPDF('full')`, `pdfFileName` `_Cards_` branch, `HPE.pdfcards.build` `variant: "full"`, `hifi.build(..., chords_only=False)`).
- No new CLI flag on `tools/decks.py`.
- No CLAUDE.md, plan or spec edit.
- No drawer change.

### PM.2 Behaviour rules

- **PM-1.** `#settings-panel .prints` contains exactly two controls, in this order: `<button type="button" id="print-download">DOWNLOAD PDF</button>`, then `<select id="print-paper-select">`. No element in the document has the text `FULL DECK PDF` or `CHORD-ONLY PDF`. (Button copy and row: coordinator reading. The id is the planner's.)
- **PM-2.** Activating `#print-download` by click or Enter calls `downloadDeckPDF('shop', this)` exactly once, then `closePanel()`. Two activations queued together build once.
- **PM-3.** The downloaded file name is the one `pdfFileName(d, "shop", printPaper)` returns today: stem + `_CHORD_ONLY_` + tail + `.pdf`. Bytes for all three built-ins at Letter and A4 are identical to main's. (Coordinator reading.)
- **PM-4.** The heading above the row reads `Print this deck`. (Coordinator reading.)
- **PM-5.** At every `MENU_VIEWPORTS` cell and in the 240px sidebar, button and select sit on one line. Neither is under 44px tall, and neither clips its text (`scrollWidth <= clientWidth`).
- **PM-6.** `downloadDeckPDF("full")` called directly still returns a PDF that carries the title and legend cards and is named `…_Cards_<Paper>.pdf`. No rendered control calls it.
- **PM-7.** The first focusable child of the Resources group is `<a class="mode" id="res-handpan-101" href="https://docs.google.com/document/d/1C1BIyjEPIXPXdBq-3ezpVPeIqSWUxHswfdx0TpxEjco/edit?usp=drivesdk" target="_blank" rel="noopener" aria-label="Handpan 101 (Google Doc)">HANDPAN 101</a>`. It has no `onclick`. (Id, attributes, position: coordinator reading. Row: planner, PM.3.)
- **PM-8.** `HANDPAN 101` is alone in its own `.modebar` row, full row width, above the three-site row. The site row keeps exactly three siblings; the Amy row keeps exactly two.
- **PM-9.** `panelStops()` contains `#res-handpan-101` exactly once, immediately after `#print-paper-select` and immediately before `#res-handpaner`. Tab from the paper select lands on it; Shift+Tab from `#res-handpaner` lands on it. Tab from the last stop wraps to `#settings-trigger`.
- **PM-10.** The repo root holds exactly three tracked `*.pdf` files: `CSharp_Hijaz_Orion_9_CHORD_ONLY_Letter.pdf`, `F3_Low_Pygmy_18_CHORD_ONLY_Letter.pdf`, `D_Amara_9_CHORD_ONLY_Letter.pdf`.
- **PM-11.** `tools/decks.py` run as a script writes those three files and no other. Its `__main__` body becomes `main(out)`, called with the repo root, so a test can call `decks.main(tmp)`.
- **PM-12.** The Python full-deck generator stays exercised: `tests/test_pdf_build.py` `JOBS` keeps all six rows and builds into a temp directory, with full page counts 3, 7, 4.
- **PM-13.** The staleness gate (`test_committed_pdfs_match_a_fresh_build`) compares the three committed files only. The repo-untouched hash checks read the three committed files only.
- **PM-14.** The `panel-fit` oracle passes with `REMOVED_BY_DESIGN` equal to `["modeS", "button:FULL DECK PDF", "button:CHORD-ONLY PDF"]`. No fit rule is loosened: `RES_ALLOWANCE_PX` stays 64.

### PM.3 Design

Existing visual system only. Print needs one CSS change: `.prints{flex-wrap:nowrap}` and `min-width:0` on its two children. Resources needs no new CSS: one more `<div class="modebar">` holding one `a.mode`, which `.modebar .mode{flex:1 1 0}` already stretches.

380px wide, full-screen panel (content 352px):

```
 Print this deck
 +--------------------------------------+ +---------+
 |             DOWNLOAD PDF             | | LETTER v|   44px, one line
 +--------------------------------------+ +---------+

 Resources
 +--------------------------------------------------+
 |                    HANDPAN 101                   |   44px, own row
 +--------------------------------------------------+
 +---------------+ +---------------+ +--------------+
 |   HANDPANER   | | DING & TONES  | |     HTC      |   trio, unchanged
 +---------------+ +---------------+ +--------------+
 +------------------------+ +-----------------------+
 |  AMY: PROGRESSIONS     | |  AMY: BOTTOM NOTES    |   duo, unchanged
 +------------------------+ +-----------------------+
```

- **320x568** (content 292px): same stack. Today `.prints` wraps to two lines here (three controls need about 334px, estimated). After PM it is one line. The new Resources row costs 44px + `--sp-1`, so net panel height is about flat.
- **Sidebar** (240px, content about 200px, `(min-width:1024px) and (min-height:700px)`): `DOWNLOAD PDF` and the select share one line, about 190px needed by estimate. `HANDPAN 101` is a full-width row. The trio keeps its `flex-basis:40%` shape of 2 + 1.
- **Landscape grid** (`max-height:520px`, `repeat(auto-fit, minmax(200px,1fr))`): the Resources column gains one 44px row + 3px. The Print column loses a line where it wrapped.

Where `HANDPAN 101` sits, settled:
- **Chosen: option (a), own full-width row.** It costs 44px + one `--sp-1` gap (48 base, 47 landscape, 50 at the >=640x700 tokens). That is inside the oracle's 64px `res-` allowance.
- **Rejected: option (b), fourth item in the site row.** The test "TR-1: the three site links are equal in width on every line they share…" asserts `siblings === 3` and line shapes `[3]` and `[2,1]`. At 320px a quarter share is (292 - 24) / 4 = 67px, narrower than `HANDPANER` at 10.5px caps.
- **Fallback: none that is placement-only.** If (a) fails a fit cell that removing the print line does not pay for, the lane stops and reports the cell table. Every other arrangement changes what the owner sees beyond placement.

### PM.4 Ownership

Owns:
- `index.html`: the Print group markup, the Resources group markup, the `.prints` CSS rule, and comments at `downloadDeckPDF` and `pdfFileName`.
- `src/engine/pdfcards.js` and `src/engine/pdfdeck.js`: comment only, then `python3 tools/inline_engine.py` regenerates the regions.
- `tools/decks.py`: `main()` and a comment.
- `tools/hifi.py`: comment at `build`'s `chords_only` default.
- `tools/probe/panel_fit.js`: `REMOVED_BY_DESIGN` only.
- `tests/paths.py`, `tests/test_pdf_build.py`, `tests/test_gen_deck.py` (`repo_pdf_hashes` only).
- `tests/app.test.js` and `tests/e2e.test.js`: the tests named in PM.7 and PM.5.
- Its mutants; `README.md` (Print bullet, the "six committed PDFs" sentence, counts); its `FLOORS` rows.
- Deletion of the three `*_Cards_Letter.pdf` files, by `git rm` on the lane branch only.

Reads only: CLAUDE.md, plans, spec, `data/decks.json`, the `const DECKS` line, everything in the drawer.

"Not used" comments, exact places:
- App, above `downloadDeckPDF`: the `'full'` variant has no control since 20.24 and is kept for tests and a future return.
- App, in `pdfFileName`: replace "the six shipped files" with the three shipped CHORD_ONLY files; note the `_Cards_` branch is unused by the UI.
- `src/engine/pdfcards.js`: at the `variant` full branch.
- `src/engine/pdfdeck.js`: at `legend_lines`.
- `tools/decks.py`: above `main()`. Full PDFs are no longer written; `hifi.build(path, deck)` still builds one.
- `tools/hifi.py`: at `build`.

Doc lines:
- **PM fixes README**, because `tests/test_readme_currency.py` reads it: the Print bullet ("shows FULL DECK PDF and CHORD-ONLY PDF buttons … both buttons"), and "rebuilds the six committed PDFs".
- **DOC lane fixes CLAUDE.md**: the `*.pdf` bullet ("Cards" = full deck…), "`python3 decks.py` builds all six PDFs", "rebuilding always rewrites the six PDFs", and the Menu Resources paragraph ("two `.modebar` rows"). PM lists these in its PR body for the DOC lane.

### PM.5 Steps (tests first, in their own commit)

**Commit 1, tests only, red.** Flat titles:

| Rule | File | Title |
|---|---|---|
| PM-1, PM-4 | `tests/app.test.js` | `PM rule 1: the print row is DOWNLOAD PDF then the paper select, and no full-deck control is rendered` |
| PM-2 | `tests/e2e.test.js` (rewrite in place, no new test) | `Enter on a print button runs its real click handler and does not flip the card` (title kept; asserts `variant === "shop"`) |
| PM-2 | `tests/e2e.test.js` (rewrite) | `two taps on DOWNLOAD PDF queued together build the PDF once` |
| PM-3 | `tests/app.test.js` | `PM rule 3: DOWNLOAD PDF names and builds the chord-only file, byte for byte what main built` (sha256 literals for 3 decks x 2 papers, captured on main; green in commit 1) |
| PM-5 | `tests/e2e.test.js` (extend existing row test) | `every row of the settings panel is flush…` (existing title) plus a one-line and no-clip assertion for `.prints` |
| PM-6 | `tests/app.test.js` (existing, kept) | `the emitted bytes are a PDF, and the two variants differ in length`; `the download is named the way the print pipeline names its files` |
| PM-7, PM-8 | `tests/app.test.js` | `PM rule 7: HANDPAN 101 is the first Resources link, a Google Doc in a new tab, alone in its row` |
| PM-9 | `tests/e2e.test.js` | via `RESOURCES` gaining `res-handpan-101` at row 0: `Tab is trapped inside the settings panel and cycles every stop…` (existing); `#seq-source-link and the Amy links are each a panel stop exactly once…` (existing) |
| PM-10 | `tests/test_pdf_build.py` | `test_the_repo_root_holds_only_the_three_chord_only_pdfs` |
| PM-11 | `tests/test_pdf_build.py` | `test_decks_main_writes_only_the_three_chord_only_pdfs` |
| PM-12 | `tests/test_pdf_build.py` | existing page-count test over `JOBS` (unchanged) |
| PM-13 | `tests/test_pdf_build.py` | `test_committed_pdfs_match_a_fresh_build` (existing; input narrowed) |
| PM-14 | `tests/app.test.js` | the existing assertion on `pf.REMOVED_BY_DESIGN`, rewritten to the three-entry list, plus one judged cell lacking `button:FULL DECK PDF` |

**Commit 2, input plumbing.** `tests/paths.py` keeps `PDFS` (six names, used as temp build names) and adds `COMMITTED = ("hijaz_print", "pygmy_print", "amara_print")`. `_repo_pdf_hashes`, `_stale_reasons(...)`'s first argument and `test_gen_deck.repo_pdf_hashes` read `{k: PDFS[k] for k in COMMITTED}`. This is how tests that read the three deleted files get their input: they stop reading them; the full variant is built fresh into temp.

**Commit 3.** `git rm` the three `_Cards_Letter.pdf` files; `tools/decks.py` `main()`.

**Commit 4.** Markup, CSS, comments; `tools/inline_engine.py`; `REMOVED_BY_DESIGN`.

**Commit 5.** Pinned fit literals rewritten from measurement: `MAIN_NEEDED_667x375_S_FALLBACK`, the sidebar `mainNeeded` literals, and the bounce-5 band-edge table. Each changed literal gets a line in the PR's line-to-assertion table.

**Commit 6.** Mutants, `tools/refresh_mutants.py`, FLOORS, README.

Budget: nothing new is added to `tests/e2e.test.js`; rewrites only.

### PM.6 Mutants

Format for every mutant: no `index a..b` lines; a word-split `# suite:` header (dots between words); `# kills:` equal to the test title.

| Mutant | Break | Kills |
|---|---|---|
| `pm_full_deck_button_still_rendered` | restores the `FULL DECK PDF` button | PM rule 1 title |
| `pm_download_builds_full_variant` | `'shop'` becomes `'full'` in the onclick | PM rule 3 title |
| `pm_prints_row_wraps` | drops `flex-wrap:nowrap` | `every row of the settings panel is flush…` |
| `pm_handpan101_outside_tab_trap` | link loses the `res-` id prefix (`id="handpan-101"`) | `Tab is trapped inside the settings panel and cycles every stop…` |
| `pm_handpan101_not_first` | row moved after the Amy row | PM rule 7 title |
| `pm_handpan101_same_tab` | drops `target="_blank"` | PM rule 7 title |
| `pm_decks_main_writes_full` | `main()` also writes a `_Cards_` file | `test_decks_main_writes_only_the_three_chord_only_pdfs` |
| `pm_removed_by_design_too_wide` | adds `print-paper-select` to `REMOVED_BY_DESIGN` | the rewritten `REMOVED_BY_DESIGN` test |

### PM.7 Existing tests and mutants that change meaning

Rewrite, never delete:
- `tests/e2e.test.js`:
  - the `m.labels` assertion `["FULL DECK PDF", "CHORD-ONLY PDF"]` becomes `["DOWNLOAD PDF"]`;
  - `two taps on FULL DECK PDF queued together build the PDF once` is retitled;
  - `a built-in deck's FULL DECK PDF tap produces bytes that open as a PDF` is retitled to `DOWNLOAD PDF`;
  - `the sidebar's FULL DECK and CHORD-ONLY buttons produce a PDF blob` becomes `the sidebar's DOWNLOAD PDF button produces a PDF blob`;
  - the stop-list array with two empty-id print entries (`"deck-add", "", "", "print-paper-select"`) becomes `"deck-add", "print-download", "print-paper-select", "res-handpan-101", …`;
  - `RESOURCES` gains the new id, and the row indices of the other five shift by one;
  - `rows.length >= 4` stays true.
- `tests/app.test.js`: `print CTA: the header carries no print controls; the settings panel carries one set for every deck` (label loop becomes the one label); the comment above the file-name test.
- Mutants:
  - `qe_print_button_enter_skips_closepanel`: the diff is re-cut against the `DOWNLOAD PDF` button; `# kills:` is unchanged.
  - `e_panel_moved_into_header`: two context lines carry `FULL DECK`; refresh.
  - `mr_prints_natural_width`, `mr_paper_select_not_centred`: re-anchor. If either no longer applies to a two-control no-wrap row, rewrite its break to the same property on the new row.
  - Any mutant whose `# kills:` is a retitled test gets the new title.

### PM.8 Verify

```
python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check
node --test tests/app.test.js
python3 -m unittest tests.test_pdf_build tests.test_gen_deck tests.test_readme_currency tests.test_suite_health
node --test --test-name-pattern "PM.rule|Tab.is.trapped.inside.the.settings.panel|every.row.of.the.settings.panel" tests/e2e.test.js
git ls-files '*.pdf'      # exactly three lines
```

No full e2e run and no `tests/mutation_check.sh` locally. The evidence is CI (all jobs, `panel-fit` on real and fallback fonts, four mutant shards) at the pushed head SHA.

### PM.9 Stop and report

- `panel-fit` fails any cell for a reason other than the two removed keys.
- `DOWNLOAD PDF` clips or wraps in the sidebar or at 320px.
- Option (a) costs more than 64px in any cell.
- Any chord-only byte hash differs from main.
- A test outside PM.7 reads a deleted PDF.
- A test reads the CLAUDE.md lines listed in PM.4 (then that line moves into PM and the coordinator is told).
- Third review FAIL (regroup rule).

### PM.10 Acceptance

| # | Criterion | Proof |
|---|---|---|
| P-A1 | One print button, `DOWNLOAD PDF`, with the select on one row | PM rule 1 test; `pm_full_deck_button_still_rendered`; `pm_prints_row_wraps` |
| P-A2 | It builds the chord-only file, bytes as main | PM rule 3 test; `pm_download_builds_full_variant` |
| P-A3 | Full generator kept, commented unused, still tested | the two kept `tests/app.test.js` tests; `JOBS` page counts |
| P-A4 | Three seed PDFs gone, three stay | `test_the_repo_root_holds_only…`; `pm_decks_main_writes_full` |
| P-A5 | `HANDPAN 101` first in Resources, own row, new tab, Google Doc label | PM rule 7 test; `pm_handpan101_not_first`; `pm_handpan101_same_tab` |
| P-A6 | It is inside the Tab trap, once | `pm_handpan101_outside_tab_trap` |
| P-A7 | Panel fits everywhere it fit | CI `panel-fit`; `pm_removed_by_design_too_wide` |
| P-A8 | README says three PDFs and one button | `tests/test_readme_currency.py` green plus the PR table |

---

## Lane DR3 (requests 1, 2, 3, 4)

### DR3.1 Goal and non-goals

Goal: numbers belong to seats everywhere (**rule N**). The step buttons sit behind a disclosure. `RESET LAYOUT` is a button that returns seats, both mirrors and orientation to the default. The orientation control is renamed and leads the drawer.

Non-goals:
- No geometry or deck-data change.
- No share-link or stored-record format change.
- No change to built-in decks.
- No change to `legendLines()`.
- No drag behaviour change.
- No new dependency.
- No plan, spec or CLAUDE.md edit.

### DR3.2 Behaviour rules

**Rule N (request 1).**

- **N-1.** A seat's number is the slot-5 label that `HPE.core` step 7 gave the note that sits there by default: rim and inner `"1".."n"`, bottom `"U1".."Um"`. After any seats arrangement, the note in seat *s* carries seat *s*'s label in slot 5. Slots 0 to 3 never change.
- **N-2.** Mirrors and orientation change no label. They change where a seat is drawn; the number travels with the seat.
- **N-3.** With no seats (absent, or a ring absent), `HPE.layout.solve` output is deep-equal to today's, and `generateDeck` output, card markup and browser PDF bytes are byte-identical to main's.
- **N-4.** `generateDeck()` copies slot 4 **and** slot 5 from the seats solve into the built deck. The plate (`pan()`), the card number line and `HPE.pdfcards` then show the seat number with no renderer change.
- **N-5.** `HPE.core.formatSeed`, `HPE.share.encode` and the stored record `{v, s, o}` are unchanged for a moved deck: same string as main for the same seats.
- **N-6. Invariant.** `HPE.layout.solve` receives fresh parse output whenever seats are given. The two callers are `generateDeck()` and `solvePreviewLayout()`. `merge()` reads labels from its untouched `source` argument and writes to the copy.

**Seat wording (one wording, true on all three rings).** A seat is named `{ring} seat {N}`, where `{N}` is the number the plate draws (`3`, `10`, `U1`). "of {k}" is dropped, because inner `seat 2 of 3` would contradict a drawn `10`. The ring size stays in the plate group label `Pan layout: {a} rim, {b} inner, {c} bottom notes.`

- **W-1.** `.panhit` accessible name: `{name}, {ring} seat {N}, {place}`.
- **W-2.** Row 7: `Swapped {a} and {b}. {a} is now in {ring} seat {N}, {place}.`
- **W-3.** Row 8: `{a} stays in {ring} seat {N}.`
- **W-4.** Row 20: `Picked up {a}, {ring} seat {N}, {place}. PREVIOUS SEAT and NEXT SEAT move it.`
- **W-5.** Row 4, disclosure closed: `Picked up {a}. Tap or drop it on another {ring} note to swap.` Disclosure open: `Picked up {a}. Tap or drop it on another {ring} note to swap, or use PREVIOUS SEAT and NEXT SEAT.`

**Drawer order (requests 2, 3, 4).** Children of `#scale-drawer`, in DOM order:

- **O-1.** `.editrow` holding:
  - `<span class="sheetlabel" id="scale-anchor-label">HANDPAN ORIENTATION</span>`;
  - `.ctlrow role="group" aria-labelledby="scale-anchor-label"` > `.mirror`, with `#scale-anchor-one` text `1 CENTRED` and `#scale-anchor-between` text `1 + 2 SPLIT`;
  - then `<p class="sheethint">Which note sits nearest you: note 1 alone, or notes 1 and 2 side by side.</p>`.

  Ids, `aria-pressed` behaviour and the deck, stored-record and share effects are unchanged. (Owner copy, verbatim.)
- **O-2.** The mirror row (`#scale-mirror`, `#scale-mirror-bottom`) and its hint, unchanged.
- **O-3.** `<button type="button" id="scale-fine-toggle" aria-expanded="false" aria-controls="scale-fine">HARD TO TAP? SHOW FINER CONTROLS</button>`. (Coordinator reading.)
- **O-4.** `<div id="scale-fine" hidden>` holding the two existing rows unchanged: `#scale-note-prev`, `#scale-note-next`, then `#scale-seat-prev`, `#scale-seat-next`.
- **O-5.** `.ctlrow` > `<button type="button" id="scale-layout-reset" class="mode" disabled>RESET LAYOUT</button>`, full row width. (Coordinator reading.)
- **O-6.** `#scale-drawer-hint`, last.

Status rows for orientation (planner's copy): `Note 1 is centred.` and `Notes 1 and 2 are split.` `HINT_GUESS` becomes `Layout is a guess. Open ADJUST LAYOUT to move a note, change the handpan orientation, or mirror the pan.`

**Disclosure.**

- **F-1.** Whenever the sheet opens (Add or Edit), `#scale-fine` has `hidden`, the toggle reads `HARD TO TAP? SHOW FINER CONTROLS`, and `aria-expanded="false"`. The state is not stored anywhere. (Coordinator reading.)
- **F-2.** Activating the toggle flips `hidden`, `aria-expanded` and the text (`HIDE FINER CONTROLS` when open). It moves neither focus nor the sheet's scroll position.
- **F-3.** Closing it while one of the four step buttons has focus puts focus on `#scale-fine-toggle`.
- **F-4.** The state holds across drawer close and reopen while the sheet stays open.
- **F-5.** Closed, the four buttons have no client rects. They are absent from the sheet's Tab stops and from the accessibility tree.
- **F-6.** The toggle is disabled exactly when `#scale-mirror` is (`!boxOk`). The four buttons keep today's enabled rules.
- **F-7. Tab order of the sheet:** back, name (Edit), scale box, the plate's one stop (drawer open), `#scale-layout-toggle`, `#scale-anchor-one`, `#scale-anchor-between`, `#scale-mirror`, `#scale-mirror-bottom`, `#scale-fine-toggle`, [`#scale-note-prev`, `#scale-note-next`, `#scale-seat-prev`, `#scale-seat-next` when open and enabled], `#scale-layout-reset`, degree select (Edit), swatches, GENERATE, DELETE (Edit). Shift+Tab is the reverse. This answers the codex finding on the hard-coded list.
- **F-8.** Escape with focus on `#scale-fine-toggle`: with a pick, puts the pick down; else closes the drawer and focuses `#scale-layout-toggle`. `DRAWER_ZONE` gains the toggle. This answers the codex finding on `closeDrawer()`/`inDrawerZone()`.
- **F-9.** Rule G holds with the new order: after focus lands on any Tab stop, that stop is wholly inside the scrollport below the stuck band (walk G-c), disclosure closed and open.

**Reset.**

- **R-1.** `#scale-layout-reset` is enabled exactly when `boxOk` and at least one of these differs from the default: any ring's seats, `mirror`, the bottom mirror, `anchor`. The default is what a fresh Add sheet has. This answers the codex finding on `paintLayout()`.
- **R-2.** Activating it puts down any pick, cancels a drag in flight, clears all three rings' seats, sets both mirrors and the orientation to the default, repaints the plate, writes `Layout reset.` to `#scale-drawer-status`, and focuses `#scale-layout-toggle` (the button is now disabled). The disclosure state does not change.
- **R-3.** On Edit, reset goes to the generated default, not to the stored record. `layoutNoticeText()` then reads against `layoutBase` as today. (Coordinator reading.)
- **R-4.** After reset, GENERATE produces a deck deep-equal to the one the same text produces on a fresh Add sheet. The stored record carries no `seats`, and `mirror`, `mirrorBottom`, `anchor` are at their defaults.

### DR3.3 Design

Existing system only:
- `.sheetlabel` for `HANDPAN ORIENTATION`; `.mirror` > `.mode` pairs; `.sheethint` for helpers.
- `RESET LAYOUT` is a `.mode` (Nunito Sans 10.5px/600 caps, 44px) with `width:100%`.
- The disclosure takes the quiet text rule `#scale-layout-reset` has today (no border, `#a79d8b`, 9.5px/600 caps, `min-height:44px`). The selector is renamed to `#scale-fine-toggle`; `:active` and `:disabled` follow.
- `#scale-fine:not([hidden]){display:flex; flex-direction:column; gap:var(--sp-2)}`, so `hidden` is never overridden.

380px sheet, drawer open, disclosure closed:

```
 [ plate band: pan diagram + status line ]            (sticky)
 [ ADJUST LAYOUT ^ ]
 HANDPAN ORIENTATION
 +------------------------+ +------------------------+
 |       1 CENTRED        | |      1 + 2 SPLIT       |  44px
 +------------------------+ +------------------------+
 Which note sits nearest you: note 1 alone, or notes
 1 and 2 side by side.
 +------------------------+ +------------------------+
 |       MIRROR TOP       | |     MIRROR BOTTOM      |  44px
 +------------------------+ +------------------------+
 Each flips left and right. Top covers the rim and the
 inner notes.
 HARD TO TAP? SHOW FINER CONTROLS                        44px, text
 +---------------------------------------------------+
 |                   RESET LAYOUT                    |  44px
 +---------------------------------------------------+
 Tap a note, then tap another note in the same ring…
```

Disclosure open: its text is `HIDE FINER CONTROLS`, and between it and `RESET LAYOUT`:

```
 +------------------------+ +------------------------+
 |     PREVIOUS NOTE      | |       NEXT NOTE        |
 +------------------------+ +------------------------+
 +------------------------+ +------------------------+
 |     PREVIOUS SEAT      | |       NEXT SEAT        |
 +------------------------+ +------------------------+
```

- **320x568:** same stack at 292px. The disclosure text is about 215px by estimate, one line. The band sticks only when the scrollport minus the band is at least 44px (rule G); otherwise it scrolls with the content.
- **Sidebar and wide layouts:** the sheet is the same single column; nothing reflows.
- **Landscape:** the `max-height:520px` tokens tighten gaps to 3/6/9/14; the order is the same. The closed disclosure removes two 44px rows from the default height, which is the point of request 2.

### DR3.4 Ownership

Owns:
- `src/engine/layout.js`: `merge()` and its call in `solve()`; then `tools/inline_engine.py` for the region.
- `index.html`:
  - `#scale-drawer` markup;
  - the CSS rules named in DR3.3;
  - `generateDeck()` copy loop;
  - `DRAWER_ZONE`, `paintLayout()`, `paintMirrors()`, `resetSeats()` (renamed `resetLayout()`), `resetSheetState()`;
  - `hitLayer()`, `swapSeats()`, `pickAnnouncement()`, `pickAnchor()`;
  - `HINT_GUESS`;
  - the sheet `keydown` Tab list.
- `tools/sandbox.js`: the id list gains `scale-fine-toggle` and `scale-fine`.
- Tests: `tests/layout.test.js`, `tests/app.test.js`, `tests/drawer_seats.test.js`, `tests/drawer_grid.test.js`, `tests/drawer_drag.test.js`, the three `tests/seat_sweeps_*.test.js`, `tests/pdfcards.test.js`.
- Its mutants, its `FLOORS` rows, the README counts.

Reads only: `src/engine/core.js`, `pdfcards.js`, `pdfdeck.js`, the Print and Resources groups, `tools/hifi.py`, `data/decks.json`, plan, spec, CLAUDE.md.

### DR3.5 Steps (tests first, in their own commit)

Rule N cases, used by every N test:
- **Scales:** the D3 example, D Kurd 10 and F3 Low Pygmy, as typed scale text.
- **Orientation:** both (`one`, `between`).
- **Mirrors:** each mirror alone and both.
- **Swaps:** one swap and three swaps in each ring the scale has.

**Commit 1, tests only.** New tests are red. Identity guards are green and must stay green.

| Rule | File | Title |
|---|---|---|
| N-1 | `tests/layout.test.js` | `rule N: after seats, each seat keeps its number and the note sitting there carries it` |
| N-2 | `tests/layout.test.js` | `rule N: mirrors and orientation change no label` |
| N-3 | `tests/layout.test.js` | `rule N: with no seats every column of every field is what main solved` (pinned from main; green in commit 1) |
| N-3 | `tests/app.test.js` | `rule N: a deck with no moved seat is byte-identical in generateDeck output, card markup and PDF` (sha256 literals from main; green in commit 1) |
| N-4 | `tests/app.test.js` | `rule N: generateDeck gives the plate and the card number line the seat number` |
| N-4 | `tests/pdfcards.test.js` | `rule N: the browser PDF prints the seat number on the diagram and the number line` |
| N-5 | `tests/app.test.js` | `rule N: a moved deck's stored record and share link are the strings main wrote` |
| N-6 | `tests/layout.test.js` | `rule N: solve reads labels from its input and never from its own output` |
| W-1..W-4 | `tests/app.test.js` | `rule W: seat names use the drawn number on rim, inner and bottom` |
| W-5 | `tests/app.test.js` | `rule W: the tap row names the seat buttons only while the finer controls are open` |
| O-1..O-6 | `tests/app.test.js` | `DR3 order: orientation, mirrors, disclosure, finer rows, RESET LAYOUT, hint` |
| O-1 | `tests/app.test.js` | `DR3 orientation: label, two options, helper and status rows read as the owner wrote them` |
| F-1, F-4 | `tests/app.test.js` | `DR3 disclosure: closed on every sheet open, kept across a drawer close` |
| F-2, F-3, F-6 | `tests/app.test.js` | `DR3 disclosure: toggling moves no focus, and closing under a focused step button focuses the disclosure` |
| F-5, F-7 | `tests/app.test.js` | `DR3 Tab order on Add and Edit, finer controls closed and open` |
| F-8 | `tests/app.test.js` | `DR3 Escape from the disclosure closes the drawer and focuses the toggle` |
| F-5, F-7, F-9 | `tests/drawer_seats.test.js` | `DR3 browser: real Tab skips the hidden step buttons and every stop lands inside the scrollport at 380x667` |
| R-1 | `tests/app.test.js` | `DR3 reset is enabled by a seat, by either mirror and by orientation, each alone` |
| R-2 | `tests/app.test.js` | `DR3 reset returns seats, both mirrors and orientation to the default and writes Layout reset.` |
| R-3, R-4 | `tests/app.test.js` | `DR3 reset on Edit gives the generated default, not the stored layout` |

**Commit 2.** `merge()` writes slot 5 for reseated rings: for the ring's note *i* with seat list `list`, `fields[zone[i]][5] = source[zone[list[i]]][5]`. `generateDeck()` copies slot 5 with slot 4. `tools/inline_engine.py`.

**Commit 3.** Seat wording.

**Commit 4.** Markup order, copy, CSS, disclosure state (`fineOpen`, reset in `resetSheetState()`), Tab list, `DRAWER_ZONE`.

**Commit 5.** `resetLayout()` and the `paintLayout()` enabled rule.

**Commit 6.** Mutants, refresh, FLOORS, README.

Budget: no unit file over 25s locally. Browser tests go in the three drawer files, nothing into `tests/e2e.test.js` beyond the one string fix in DR3.7. The PR carries the line-to-assertion table. A title names a rule only if the test asserts it.

### DR3.6 Mutants

Same format rules as PM.6.

| Mutant | Break | Kills |
|---|---|---|
| `dr3_number_follows_the_note` | `merge()` writes no slot 5 | `rule N: after seats, each seat keeps its number…` |
| `dr3_deck_build_copies_angle_only` | `generateDeck()` drops the slot-5 copy | `rule N: generateDeck gives the plate and the card number line the seat number` |
| `dr3_label_read_from_output` | `merge()` reads labels from the copy it is writing | `rule N: solve reads labels from its input…` |
| `dr3_mirror_renumbers` | label write keyed to angle order | `rule N: mirrors and orientation change no label` |
| `dr3_seat_name_uses_ring_index` | wording uses `seat + 1` | `rule W: seat names use the drawn number…` |
| `dr3_disclosure_open_by_default` | markup without `hidden` | `DR3 disclosure: closed on every sheet open…` |
| `dr3_hidden_buttons_reachable_by_tab` | `#scale-fine` hidden by `visibility` instead of `hidden` | `DR3 Tab order on Add and Edit…` |
| `dr3_tab_list_omits_disclosure` | toggle missing from the Tab list | `DR3 Tab order on Add and Edit…` |
| `dr3_escape_on_disclosure_loses_focus` | toggle missing from `DRAWER_ZONE` | `DR3 Escape from the disclosure…` |
| `dr3_reset_leaves_a_mirror` | bottom mirror not reset | `DR3 reset returns seats, both mirrors and orientation…` |
| `dr3_reset_leaves_the_anchor` | `anchor` not reset | same title |
| `dr3_reset_enabled_by_seats_only` | old `!layoutSeats` rule | `DR3 reset is enabled by a seat, by either mirror and by orientation…` |
| `dr3_reset_returns_to_stored` | Edit reset restores `layoutBase` | `DR3 reset on Edit gives the generated default…` |
| `dr3_orientation_below_mirrors` | old order | `DR3 order: …` |

### DR3.7 Existing tests and mutants that change meaning

Rewrite, never delete:
- `tests/layout.test.js`: `solve preserves the field ids and every non-angle column` holds as written (its sweep has no seats); add "with no seats" to its title. `seats reassign the solved angles and never invent one` and `a ring's seats say which seat each of its notes takes` keep their angle assertions.
- `tests/app.test.js`:
  - `DR1 line 25` (`ON CENTRE pressed by default`), `DR1 line 26`, `DR1 line 27`, `DR1 line 115`, `DR2a (71)`: button names in titles and assertions become `1 CENTRED` / `1 + 2 SPLIT`.
  - `DR1 line 131`: the label text.
  - `DR1 rule S`: the anchor, hint and status strings.
  - `DR2a (59, 76, 99, 116, 12): SEAT buttons follow the pick, RESET SEATS follows the seats…`: retitled to `RESET LAYOUT follows the layout`; its enabled assertions move to the R-1 test, and the SEAT-button part opens the disclosure first.
  - `DR2a rule P (120): the Tab order of the sheet…`: superseded by the F-7 test; rewritten in place.
  - `DR2b (16.3)`: reset wording.
  - About 30 lines in the file assert the old strings.
- `tests/drawer_seats.test.js`:
  - `rim seat 3 of 8` becomes `rim seat 3`; `bottom seat 12 of 12` becomes `bottom seat U12`.
  - `(84) …the toggle and both step rows…` is rewritten to "the toggle is inside the scrollport; with the finer controls open both step rows are reachable".
  - `(18, 84)` likewise.
  - `Tab order, the plate as one stop…`: new order.
- `tests/drawer_drag.test.js`: `stays in rim seat 1 of 9.` becomes `stays in rim seat 1.`
- `tests/seat_sweeps_keys.test.js`, `seat_sweeps_tap_add.test.js`, `seat_sweeps_tap_edit.test.js`: the row 7 and row 8 regexes take the seat's drawn label, read from the default fields.
- `tests/e2e.test.js`: one message string, `Tab never reached BESIDE CENTRE`.
- Mutants:
  - `dr2a_reset_seats_leaves_focus`: keeps its break; `# kills:` follows the retitled test.
  - `dr2a_row8_names_a_place`: re-cut on the new row 8.
  - `dr1_anchor_not_reaching_deck`, `dr1_hint_stays_while_open`, `dr1_disabled_not_dimmed`: the last one's selector now includes `#scale-fine-toggle`.
  - `dr2a_cross_ring_swaps`, `dr2a_only_note_is_pickable`, `dr2a_note_step_does_not_wrap`, `dr2a_put_down_always_cancelled`, `dr2b_lift_of_picked_clears_moved`, `dr2b_lift_scrolls_sheet`, `r3s_served_id_not_in_markup`: refresh contexts; update `# kills:` where a title changed.

### DR3.8 Verify

```
python3 tools/inline_engine.py --check && python3 tools/sync_decks.py --check
node --test tests/layout.test.js tests/pdfcards.test.js tests/app.test.js
node --test tests/seat_sweeps_keys.test.js tests/seat_sweeps_tap_add.test.js tests/seat_sweeps_tap_edit.test.js
node --test tests/drawer_seats.test.js tests/drawer_grid.test.js tests/drawer_drag.test.js
python3 -m unittest tests.test_suite_health tests.test_readme_currency
```

No full e2e and no mutation run locally. CI at the pushed head SHA is the evidence. Then the owner gate: a private preview of the lane head, before merge.

### DR3.9 Stop and report

- Any no-moved-seat hash differs from main.
- A third caller of `HPE.layout.solve` passes seats with fields that are not fresh parse output.
- Any reader of slot 5 is found beyond `pan()`, the card number line, `HPE.pdfcards` and `tools/hifi.py`.
- Rule G fails at any grid cell with the new order.
- The disclosure text wraps at 320px.
- A share link or stored record for a moved deck differs from main's string.
- The full-deck button is still rendered on main when DR3 is ready (merge order inverted; see D-A12).
- Third review FAIL (regroup rule).

### DR3.10 Acceptance

| # | Criterion | Proof |
|---|---|---|
| D-A1 | Seat number does not change on a swap, on plate, cards and PDF | N-1 and N-4 tests; `dr3_number_follows_the_note`; `dr3_deck_build_copies_angle_only` |
| D-A2 | Mirrors and orientation keep numbers on seats | N-2 test; `dr3_mirror_renumbers` |
| D-A3 | Unmoved decks byte-identical | both N-3 tests |
| D-A4 | Formats unchanged | N-5 test |
| D-A5 | Seat wording true on three rings | rule W test; `dr3_seat_name_uses_ring_index` |
| D-A6 | Step buttons hidden behind the disclosure, closed by default | `dr3_disclosure_open_by_default`; `dr3_hidden_buttons_reachable_by_tab` |
| D-A7 | Tab order and Escape correct with the disclosure | `dr3_tab_list_omits_disclosure`; `dr3_escape_on_disclosure_loses_focus` |
| D-A8 | `RESET LAYOUT` is a button, resets everything | `dr3_reset_leaves_a_mirror`; `dr3_reset_leaves_the_anchor` |
| D-A9 | Reset enabled by any difference | `dr3_reset_enabled_by_seats_only` |
| D-A10 | Edit reset is the generated default | `dr3_reset_returns_to_stored` |
| D-A11 | Orientation copy and position | order and orientation tests; `dr3_orientation_below_mirrors` |
| D-A12 | `legendLines()` unchanged and unreachable from the UI | PM rule 1 test on main (precondition) |
| D-A13 | Rule G holds | `tests/drawer_grid.test.js` and the DR3 browser test |

### 20.24.3 `legendLines()`: recorded, not changed

`legendLines()` prints `TONEFIELD NUMBERS RUN 1 - n FROM THE LOWEST [TOP ]NOTE` on the legend card. That card exists only in the full variant. After PM no control builds it, and built-in decks (the only input of `tools/decks.py`) carry no seats. So the sentence cannot be shown false through the UI, and it is left as is. If the full variant returns to the UI, the sentence is revisited then.

### 20.24.4 Eng review and outside voice (2026-10-08)

`/plan-eng-review` ran on 20.23 and then on this section; the owner is away, so each recommended option was taken and is recorded here.

Scope: the seven requests are the owner's; nothing is added or cut. Two lanes because the print menu has no owner gate and shares no behaviour with the drawer.

Codex outside voice on the 20.23 draft, five findings, all accepted:
1. Ring-relative seat copy contradicts rule N on inner and bottom rings. Answer: the seat wording rules W-1 to W-5.
2. `legendLines()` is false for a moved deck. Answer: 20.24.3 and the merge order.
3. The sheet's hard-coded Tab list omits the disclosure. Answer: F-7.
4. Escape on the disclosure loses focus unless it joins `DRAWER_ZONE`. Answer: F-8.
5. Reset is seats-only and disabled after a mirror-only or orientation-only change. Answer: R-1, R-2.

Review findings and dispositions:
- (9/10) Rule N belongs in `merge()` plus the `generateDeck()` copy loop; every renderer reads slot 5. Verified: `merge()` builds `fields[id] = source[id].slice()` before any write, so reading labels from `source` is safe. The lane no longer owns `tools/hifi.py`, `tools/decks.py` or `pdfcards.js` (20.23 allowed them).
- (8/10) PM-3 and the N-3 PDF guard pin sha256 literals. If the browser PDF carries a build date, the lane fixes the clock the way the existing byte tests do and says so in the PR; it does not weaken the comparison to length or text.
- (8/10) The half-done state (preview numbers fixed, cards still travelling) gets its own mutant, `dr3_deck_build_copies_angle_only`.
- (7/10) R-2 moves focus to `#scale-layout-toggle` because the button disables itself; this is today's behaviour for reset and stays.
- (7/10) Planner copy the owner has not seen (`Note 1 is centred.`, `Notes 1 and 2 are split.`, the `HINT_GUESS` rewording, `DOWNLOAD PDF`, the `aria-label` of the new link) is covered by the DR3 owner gate and by the return summary.
- Performance: none. One extra slot write per reseated note.
- Not in scope: DESIGN.md, the iOS keyboard item and the label-ratio item in `TODOS.md` are untouched.

Failure modes checked: no-move identity (N-3, two tests); mirror renumbering (N-2); stale labels from a second solve over solved output (N-6); hidden buttons reachable by keyboard (F-5); reset leaving one option behind (two mutants); the new link outside the Tab trap (mutant); a rebuilt `decks.py` recreating the deleted files (PM-11 and its mutant).

Facts the planner could not verify, left to the lanes with stop conditions: all pixel estimates; the new values of the pinned fit literals; the default literals on a fresh Add sheet (read from `resetSheetState()`); whether any test reads the CLAUDE.md lines about six PDFs; whether `mr_prints_natural_width` and `mr_paper_select_not_centred` still express a break; the shape of main's CI artifacts for the FLOORS reset.

Coordinator readings added by this section (owner can overturn any): `DOWNLOAD PDF` and the one-row print group; the chord-only file name kept; `HANDPAN 101` first in Resources on its own row; `{ring} seat {N}` wording without "of k"; the orientation status copy; PM merges before DR3; the three CHORD_ONLY PDFs stay.

### 20.24.5 Amendment after lane PM's first stop (2026-10-08, owner away; AFK auto-decision)

Lane PM stopped on two PM.9 conditions at #275.

**Finding 1.** PM.3 said the new Resources row costs 47px and is "inside the oracle's 64px `res-` allowance". That is false for the links below it. `resAllowance()` in `tools/probe/panel_fit.js` grants the 64px to NEW `res-` controls only (rules 1 and 3). Rule 2 judges existing controls against main, and a row placed first pushes the five existing links down 47px. Rule 2 failed on both font modes.

Decision: **`HANDPAN 101` is the LAST row of Resources, below the Amy row.** No existing control moves down, and no fit rule is loosened (PM-14 stands as written). Position was a coordinator reading, not the owner's words; the owner asked for "a new option". Rejected: granting the allowance to existing `res-` controls in rule 2, because it loosens the oracle for every later change. The owner can overturn this; putting the link first then needs an oracle change in its own lane.

Rules as amended:
- **PM-7.** The LAST focusable child of the Resources group is the `#res-handpan-101` link (markup unchanged).
- **PM-8.** It is alone in its own `.modebar` row, full row width, below the Amy row. The site row keeps three siblings, the Amy row two.
- **PM-9.** `panelStops()` contains `#res-handpan-101` exactly once, immediately after `#res-amy-bottom`, and it is the last stop. Tab from it wraps to `#settings-trigger`. `#res-handpaner` follows `#print-paper-select` as on main.
- PM.3 drawings: read the `HANDPAN 101` row at the bottom of Resources.
- PM.5 test title: `PM rule 7: HANDPAN 101 is the last Resources link, a Google Doc in a new tab, alone in its row`. `RESOURCES` gains the id at the last row; the other five keep their row indices.
- PM.6: `pm_handpan101_not_first` becomes `pm_handpan101_not_last` (row moved above the site row).
- P-A5 reads "last in Resources".

**Finding 2.** `DOWNLOAD PDF` overflows its box by about 4px in the 240px sidebar with Linux fallback fonts. PM-5 stands. The fix is CSS inside the `.prints` rule only (padding or flex shares of the two controls in the sidebar). The label, the 44px height and the type size do not change. If no such CSS holds PM-5 on both font modes, the lane stops and reports.

Stop condition added to PM.9: the new last row fails rule 1 or rule 3 of the oracle in any cell.

Owner check-in, 2026-10-08 (confirmed, no longer coordinator readings): `HANDPAN 101` sits in the last row of Resources; the print button reads `DOWNLOAD PDF`. The owner judges the drawer's new status, hint and seat wording at the DR3 phone check. Older parked items are interviewed once after DR3 merges.

### 20.24.6 Owner phone check of DR3 (2026-10-08)

The owner checked the preview of #276 at `9f50909` and wrote: "Let's update: “#1 centred” & “#1 / #2”", then "Everything else look great and can merge once we update the strings".

- The orientation pair reads `#1 CENTRED` (`#scale-anchor-one`) and `#1 / #2` (`#scale-anchor-between`). This supersedes `1 CENTRED` and `1 + 2 SPLIT` wherever 20.23 and 20.24 name them. Nothing else in the row changes: the label, the helper, the ids, the status lines and the hint stand.
- The status, hint and seat wording left to the phone check is accepted as shipped.
- The phone-check gate on DR3 is met once the two strings ship. The CI and independent-review gates are unchanged and apply at the new head.

## NOT in scope

- Any change to chord ranking, voicing or sequencing: the grammar and the
  solver's seats only.
- A stored `ext` for Pygmy and a new print radius (owner: keep today's frame,
  keep 60).
- The 3.2 pt bottom octave digit (owner: excluded from the warning; TODOS).
- Converting `docs/SCALE_ENGINE_PLAN.md` to the new grammar (history).
- Merging old-key scales into the new key after the first copy (R7).
- Unifying the label ratios into one source (TODOS; risk 8 stands).
- OQ16 of the beginner-decks plan (MEDIUM colour-card position).

## What already exists (reused, not rebuilt)

- `parseSeed` / `formatSeed` / `deckId` in `src/engine/core.js`: kept whole
  as `parseLegacySeed`; ids stay stable through `identitySeed`.
- `share.decodeSeed`'s version gate (`NEEDS_NEWER_APP`): reused for 3 and 4.
- `layout.reseat`, `slotOrder`, `readOrder`: narrowed to one ring, not
  replaced.
- `tools/inline_engine.py`, `tools/sync_decks.py`, `tools/gen_deck.js`,
  `tools/regen_engine_corpus.js`, `tests/mutation_check.sh`: used as they are
  (`gen_deck.js` gains two flags).
- The sheet's keyboard handling (`kbOffset`, `kbCap`, `b.fakeKeyboard()`).

## Record flow after R7 (the one new data path)

```
boot
 |- hpfc.scales.v3 present? -- yes --> read each record by its version
 |                                      |- readable   -> deck
 |                                      |- unreadable -> kept as is, no deck
 |- no --> read hpfc.scales (old key, never written again)
            |- each record through its version's reader
            |- write the list to hpfc.scales.v3   (throws -> list kept in memory)
save / edit / delete --> hpfc.scales.v3 only, matched by deck id (L0)
old tab              --> hpfc.scales only; cannot reach a v3 record
```

## Failure modes

| Path | Failure | Test | Handling | Seen by player |
|---|---|---|---|---|
| boot copy | storage write throws | S3 "first boot copies" | list kept in memory | decks open; not saved |
| boot rewrite | unreadable record | G2b 12 | kept byte-identical | deck absent, nothing lost |
| boot rewrite | two records, one id | G2b 13 | first wins | one deck |
| old tab saves | same string as a new record | S3 old-key test | separate key | new record intact |
| canonical string | octave outside -1 to 9 | G1 15 | refused `BAD_NOTE` | refusal sentence |
| huge pan | generation too slow | G2b 14 | budget; lane stops | none (pre-merge) |
| inner fan | number meets ding | S1 overlap test + G-RENDER | constants; owner look | none (pre-merge) |
| old bar list | read as inner notes | G2b 11 | copy only (D12) | count line says so |

No path is left with no test, no handling and a silent failure. The last
row is silent by owner decision D12 and is covered by copy.

## Worktree parallelization

| Lane | Touches | Depends on |
|---|---|---|
| L0 | core.js, share.js, index.html records | none |
| G1 | core.js (new functions) | L0 |
| G2a | tests/, tools/gen_deck.js, fixtures | L0 |
| S1 | layout.js, index.html pan | none |
| S2 | layout.js | S1, G1 |
| P1 | data/decks.json, PDFs, fixtures, mutants | S2 |
| S3 | layout.js, share.js, index.html layout + storage | S2 |
| W1 | index.html sheet | S2, DS |
| G2b | core.js, share.js, index.html sheet copy | G1, G2a, S1, S3, W1 |
| DR1, DR2 | index.html drawer | DS, S3, G2b |
| DOC | docs/ | all |

Every code lane regenerates an engine region or mutants in `index.html`, so
merges are serial. Worktrees may be built in parallel in two places only:
G1 with S1 (after L0), and G2a with either. Whichever merges second reruns
`python3 tools/inline_engine.py` and the stale-mutant check. Everything from
S2 on is serial, and gated by R4.

## Implementation Tasks

- [ ] T1 (L0) seams: `identitySeed`, id-keyed record lookups, one read/write pair for the list (R7), frozen id fixture.
- [ ] T2 (G1) new parser unwired, with the octave-range refusal and test 15 (R8).
- [ ] T3 (G2a) legacy callers by grep, `gen_deck.js --legacy` (R1).
- [ ] T4 (DS) design spec via `/frontend-design:frontend-design`; owner sign-off (R4).
- [ ] T5 (S1) solver without caps, inner fan, ding offset, warning, automated overlap test; owner passes G-RENDER (R4).
- [ ] T6 (S2) one direction, anchor option.
- [ ] T7 (P1) Pygmy `geom` redraw, fixtures, PDFs; owner print check.
- [ ] T8 (S3) per-ring seats, share version 3, storage key `hpfc.scales.v3` and its three tests (R7).
- [ ] T9 (W1) wrapping field, count line, MIRROR switch; owner phone check.
- [ ] T10 (G2b) the flip, share version 4, boot rewrite with tests 11 to 15 (R2, R5, R8, R9).
- [ ] T11 (DR1) drawer shell, anchor, MIRROR moved in.
- [ ] T12 (DR2) drag to seat; owner phone check.
- [ ] T13 (DOC) `docs/ENGINE-SPEC.md`, CLAUDE.md and README text of section 15, plus the R7 README sentence.

## Decision ledger

Owner decisions D1 to D15 and the answers in 3.4 are unchanged. The review
ran with the owner away (AFK armed); each choice below is the recommended,
non-destructive option and can be overturned without reopening D1 to D15.

| Id | Question | Chosen | Why |
|---|---|---|---|
| AD-ER-0 | Twelve lanes trips the complexity gate: cut scope? | Keep the arrangement | D1 to D15 need every part; lanes already split by ownership |
| AD-ER-1 | Old tabs can overwrite or delete newer records (Codex P1) | New storage key, old key frozen (R7) | The only option that cannot lose a record; costs one README sentence |
| AD-ER-2 | Canonical string can spell an unreadable octave (Codex P2) | Refuse at inference (R8) | Widening the lexer to `-2` adds a spelling nobody types |
| AD-ER-3 | W1 test 5 impossible before the flip (Codex P2) | Move to G2b (R9) | No behaviour change |
| AD-ER-4 | Five human gates under AFK | Keep all five as owner gates; automate G-RENDER's geometry as extra evidence (R4) | A rendered-collision check is not mine to pass |
| AD-ER-5 | G2a's file list is short | Ownership by grep; `gen_deck.js --legacy` (R1) | Enumerated, not estimated |
| AD-ER-6 | Boot rewrite safety | Keep unreadable records; collapse by id (R2) | Non-destructive |
| AD-ER-7 | No generation-time bound | Measured budget test in G2b (R5) | Caps are going by owner decision; a bound is the remaining guard |
| AD-ER-8 | Pins labelled red-first | Relabel (R3) | Stops a literal-minded review FAIL |
| AD-ER-9 | TODOS: label ratios held three times; 3.2 pt bottom digit | Add both to `TODOS.md` | Neither blocks this plan |

For the owner on return: AD-ER-1 changes where saved scales are stored. It
deletes nothing, but it is the one choice here that touches player data.

Approval readiness: PASS

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO Review | `/plan-ceo-review` | Scope and strategy | 0 | not run | owner decisions D1 to D15 stand in for it |
| Outside Voice | Codex plan review | Independent second opinion | 1 | issues_found | 3 (1 P1, 2 P2), all folded in as R7, R8, R9 |
| Eng Review | `/plan-eng-review` | Architecture and tests (required) | 1 | clear after amendments | 9 issues, 1 critical gap (R7), 0 unresolved |
| Design Review | `/plan-design-review` | UI and UX gaps | 0 | not run | the DS step (section 10) carries the design work |
| DX Review | `/plan-devex-review` | Developer experience | 0 | not run | not applicable |

- **OUTSIDE COVERAGE:** Codex completed. All three findings were accepted. The P1 was checked against the record functions on main `e749957`. The two P2s follow from this plan's own text and were not re-run; R8's example string is Codex's (UNVERIFIED here).
- **CROSS-MODEL:** no disagreement left open. Codex's P1 overturned risk 6 of this plan.
- **VERDICT:** ENG CLEARED at `016dfe0` plus this commit, with section 19 binding. Execution waits for Lane C of the beginner-decks plan, and five merge conditions stay with the owner (R4).

NO UNRESOLVED DECISIONS
