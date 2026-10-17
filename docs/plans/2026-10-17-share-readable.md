# Plan: human-readable share links, and COPY LINK as an on-page share icon (2026-10-17)

Status: PLAN ONLY. Nothing here is built. Base: `origin/main` at `ebd997f`, refreshed from `e158f06`. The commits between touch only `CLAUDE.md`, `README.md`, a plan doc, `tests/harness.test.js`, `tests/helpers/cdp.js` and two `dh_*` mutants, and no engine or app code, so P1 to P11 stand. Every count and check recorded below was re-run at `ebd997f` and is unchanged.
Owner brief 2026-10-17 (binding), plus the coordinator's scope addition of the same day (the share icon).

Every measurement below comes from a probe run against `origin/main`:

- The prototype is `scratchpad/v5/proto.js`, with probes `probe.js` (P1 to P8), `probe9.js` and `probe10.js` (P10, P11).
- They were run with `ROOT=<worktree> node probe.js`.
- They live in the planning session's scratchpad and are NOT committed.
- The outputs are quoted verbatim where they are cited.

A claim marked **[unverified]** was not measured. Section 7 lists every one.

---

## 1. Recommendation

**Ship wire version 5.** It is a readable, slash-separated link that carries the seed and ends in a 6-hex checksum. For example:

```
#s=5/(D3)_A3_Bb3_C4_D4_E4_F4_G4_A4_C5/D+KURD+10/9fcd07
```

- **Back-compat.** v1 to v4 links keep decoding through today's packed reader, byte for byte. New links are written only as v5.
- **Canonical address bar.** The address bar stays canonical. A v4 link imports once, and `syncRoute()` then rewrites it to v5 with `replaceState`. That rewrite adds no history entry and triggers no second import.
- **Share icon.** In the same release, COPY LINK leaves the settings panel and becomes a 44px share icon in the header's empty left cell. That cell is `.hspacer` today, so in portrait the card, the header height and the title position cannot move.

**Rationale**

- **Readable on sight.** The scale, the name and every non-default option can be read straight off the link.
  - Every built-in deck's link is shorter than its v4 link: 7 to 20 characters shorter with an auto name, and 9 to 38 with a typed name (P1).
  - A deck with every option set is longer (129 against 98, P9).
- **D14 holds unchanged.** The link carries the seed: the scale string, the options and the seats delta. Decoding still goes through `HPE.core.parseSeed`, and a link that fails the checksum is refused rather than repaired (P4: 0 of 520 single-character flips accepted).
- **Rejecting older formats needs no new code path.** An app that predates v5 already answers `NEEDS_NEWER_APP` to a v5 link (P2).
- **The icon costs no layout.**
  - Portrait: the icon fills a 44px cell that already exists.
  - Landscape: it joins the header's flex row at the trigger's own height.
  - Desktop: the left cell is still there.

**Alternatives considered**
- (a) Keep the packed format. It is the status quo, but it fails the brief.
- (b) Literal `[ ] # |` in the link. Transports percent-encode them, and some autolinkers stop at them (section 7).
- (c) Write the generated deck into the link. That violates D14.
- (d) Base64 JSON. It is neither readable nor shorter.

**Confidence**
- High on the grammar and on back-compat, both probed.
- Medium on transports: no real messenger was tested, and the risks are listed in section 7.
- High on the icon's zero layout cost in portrait, which follows from the CSS. The landscape cost is NOT measured (section 7).

---

## 2. Grammar (answers Q1 and Q2)

### 2.1 Spec

```
link    = "5" "/" scale "/" name *( "/" option ) "/" check
scale   = token *( "_" token )                 ; core.formatSeed order (pitch order)
token   = "(" note ")"                         ; the ding
        / "u" note                             ; a bottom-shell note ("[X]" in a scale string)
        / note                                 ; a top-shell note
        / "-"                                  ; the inner bar ("|" in a scale string)
note    = letter [ "s" / "b" ] octave          ; "s" = sharp, so no "#" in the link
name    = typed / "*" label
typed   = 1*( unreserved / "+" / pct )         ; "+" = space, A-Za-z0-9 - . _ ~ literal, all else %XX upper-hex
label   = *( any non-"/" character )           ; the auto name, for reading only; ignored on receipt
option  = "palette-" ("2"-"6")                 ; palette index + 1, as the UI's "Palette N" labels
        / "parent-" mode-slug                  ; naming PARENTS[i].name lowercased, spaces -> "-"
        / "mirror" / "mirror-top" / "mirror-bottom"
        / "between"                            ; anchor between notes 1 and 2
        / "seats-" rim ";" inner ";" bottom    ; comma lists, empty when a ring is not moved
check   = 6 lowercase hex
```

**Options**
- Options appear in the order listed above.
- An option is written only when it differs from the default (section 3.2).
- The decoder refuses an unknown option, a duplicate or an out-of-order option with `BAD_NOTE`. Each deck therefore has exactly one canonical v5 spelling, and `syncRoute()` relies on that equality.

**Telling v5 from v1 to v4.** The first character is the version, exactly as today.
- A link whose first character is `5` must have `/` as its second character. Otherwise it is `BAD_NOTE`. `/` is not in the packed alphabet `0-9A-Za-z-_`, so no v1 to v4 string can start `5/`.
- Version characters 1 to 4 go through the unchanged packed reader.
- Characters above 5 return `NEEDS_NEWER_APP`, as today.

**Decode order**
1. Apply the cap (`CAPS.payload`, still 4096, still the first gate).
2. Read the version character.
3. Split on literal `/`.
4. Percent-decode each segment. Use a hand-rolled decoder over the existing `utf8String`, with no host encoder (the test "the module references no host encoder or compression API" stays green). A malformed escape is `BAD_NOTE`.
5. Verify the checksum.
6. Map the scale tokens back to a scale string and call `core.parseSeed`.
7. Re-attach the seats through `HPE.layout.readSeats`, exactly as `decode` does for v3 and v4.

**Refusals.** Every v5 structural refusal (the `5/` shape, the segment layout, a malformed escape, an option, the checksum, the seats) returns `badNote(text)` on the whole link, exactly as v4's `decodeSeed` does (share.js's `badNote` wraps `HPE.core.badNote`). Two refusals are not structural and pass through unchanged, as in v4: `NEEDS_NEWER_APP` from the version gate, and whatever `core.parseSeed` returns.

**Scale tokens.** The v5 scale segment is a total, verbatim inverse of `core.formatSeed`: `[X]` and `uX`, `#` and `s`, `|` and `-`, a space and `_` swap, and every other character is copied, so every segment maps to exactly one scale string. share.js validates no scale token. The mapped string goes to `core.parseSeed`, whose code and reason come back unchanged ("decode propagates parseSeed's own code for an invalid seed" keeps pinning that). A lone `-` is the bar, while a `-1` octave (`SCALE_NOTE_RE` allows it) stays inside its own `_`-separated note token, so the two never meet.

### 2.2 Checksum (Q2)

- **Algorithm.** The top 24 bits of 32-bit FNV-1a, written as 6 lowercase hex characters.
- **Comparison.** The check segment is compared as an exact 6-character lowercase string. Any other byte, an uppercase hex digit included, fails the check. The refusal is `BAD_NOTE` through `badNote(text)`, as v4's checksum failure is: share.js has no `BAD_CHECKSUM` code, and the closed enum that "share answers only with codes from the closed section 2 enum" pins does not grow.
- **What it covers.** The DECODED meaning, joined by `\n`:
  - the version;
  - the percent-decoded scale segment;
  - the name, with `\t` standing for "auto name" in place of the label text;
  - each percent-decoded option.
- **Why the decoded text and not the raw text.** A transport that percent-encodes `(` or `_` must not break a link, and P8 shows it does not. Escaping can only change how a character is spelled, never what it means: `*` and `+` are reserved, so a transport cannot turn an auto marker into a typed name (P8: `%2A` and `%2B` are refused).
- **Why the decoded meaning and not a canonical re-encode.** The first prototype re-encoded, and it accepted 8 single-character flips that produced equivalent seeds, such as `A3` becoming `A_`. Checking the decoded meaning accepts 0 flips (P4).
- **Why the auto label is outside the checksum.**
  - The label is never read on receipt, so changing it changes nothing.
  - Running `encodeURI` over a sharp-rooted auto link double-encodes its `%23`, and the link still opens (P10). A typed name with an escape does not survive that (P10, refused).
  - Cost: flips inside the label are accepted, 104 of 104 such flips on the Hijaz auto link (P11). None was accepted anywhere else.
  - This is owner gate G3.
- **Strength.** 24 bits means a random corruption passes with probability 1 in 16,777,216, against 1 in 2^36 for v4's 6 alphabet characters. The checksum detects accidents; it is not a security property (D14 never claimed one).

### 2.3 The five built-in decks (P1, verbatim)

"Auto" is the deck saved with no typed name. "Named" is the built-in deck's own name carried as a typed name; this is the edited-seed case, which shares as a custom deck. Lengths exclude `#s=`.

| Deck | v5 auto (len) | v4 auto len | v5 named (len) | v4 named len |
|---|---|---|---|---|
| kurd | `5/(D3)_A3_Bb3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+10/66d9eb` (55) | 62 | `5/(D3)_A3_Bb3_C4_D4_E4_F4_G4_A4_C5/D+KURD+10/9fcd07` (51) | 74 |
| amara10 | `5/(D3)_A3_C4_D4_E4_F4_G4_A4_C5_D5/*D+AEOLIAN+10/91ba85` (54) | 61 | `5/(D3)_A3_C4_D4_E4_F4_G4_A4_C5_D5/D+AMARA+10/6ceb44` (51) | 74 |
| amara | `5/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+9/f0daf4` (50) | 57 | `5/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/D+AMARA+9/704d91` (47) | 69 |
| hijaz | `5/(Cs3)_Gs3_B3_Cs4_D4_F4_Fs4_Gs4_B4/*C%23+HIJAZ+9/fe4d19` (56) | 63 | `5/(Cs3)_Gs3_B3_Cs4_D4_F4_Fs4_Gs4_B4/C%23+HIJAZ+9/bc0a48` (55) | 77 |
| pygmy | `5/uC3_uDb3_uEb3_(F3)_G3_Ab3_uBb3_C4_uDb4_Eb4_F4_G4_Ab4_C5_Eb5_-_F5_G5_uAb5/*F+AEOLIAN+12/between/78c615` (103) | 123 | `5/uC3_uDb3_uEb3_(F3)_G3_Ab3_uBb3_C4_uDb4_Eb4_F4_G4_Ab4_C5_Eb5_-_F5_G5_uAb5/F3+LOW+PYGMY+18/between/514b59` (105) | 143 |

**How the built-in decks share today**
- An untouched built-in deck shares as `#deck=<slug>` (`routeInfo`), not `#s=`. The table above is the custom-deck form, which a SAVE of a seed produces.
- The auto label reads "D AEOLIAN 10" for Kurd because `autoName` names the inferred parent mode, not the maker's name.

**Probe results**
- All ten links come back from `new URL(origin + "#s=" + code).hash` byte for byte.
- All ten round-trip with an unchanged `core.deckId`.
- `encodeURI` leaves every link unchanged except Hijaz's two, whose `%23` it would double-encode (see P10).

**P9: every option set at once**
- Input: Hijaz with palette index 2, parent 9, a top-only mirror, the `between` anchor, the rim seats moved and the typed name "My Hijaz".
- Output, 129 characters against v4's 98, round trip ok, same deckId:

```
5/(Cs3)_Gs3_B3_Cs4_D4_F4_Fs4_Gs4_B4/My+Hijaz/palette-3/parent-phrygian-dominant/mirror-top/between/seats-1,0,2,3,4,5,6,7;;/e3049a
```

**Other probes**
- **P2.** Today's app (VERSION 4) decoding a v5 link returns `{"ok":false,"code":"NEEDS_NEWER_APP","reason":"This link needs a newer version of the app. Reload."}`.
- **P5 and P8.**
  - `%28D3%29` opens.
  - `%5F` between scale tokens opens.
  - `%7E` and `%5F` inside a typed name open.
  - `%2A` for `*` and `%2B` for `+` are refused with a checksum error.
  - A double-encoded `%2523` opens only inside the ignored auto label (G3).

---

## 3. Names, defaults, caps, back-compat and hand edits (Q3 to Q7)

### 3.1 Names (Q3)

**Carrying a typed name**
- A typed name is carried verbatim after percent-encoding.
- `core.readOptions` keeps its rule: printable ASCII, trimmed, 1 to 40 characters (`NAME_RE`). A non-ASCII name cannot exist: "Café" is refused by `parseSeed` with `BAD_NOTE` (P3).
- P3 round trips, all keeping the hash stable:
  - `My Kurd` gives `My+Kurd`.
  - `Ray's pan #2` gives `Ray%27s+pan+%232`.
  - `50/50 (low) ~ test_1` gives `50%2F50+%28low%29+~+test_1`.
  - A 40-character name and the full ASCII punctuation set also round-trip.

**Detecting "no typed name"**
- The sender knows from `seed.options.name`, which is empty when nothing was typed.
- `seedOf(d)` already carries only a typed name. The sheet's `nameDirty` rule means an untouched, prefilled name box saves no name.

**What the sender writes when there is no typed name**
- The sender writes `*` and then the default generated name. Nothing else is invented.
- The new export `HPE.select.deckName(seed)` produces the label, using `options.name ||` the same `autoName(fields, options.parent ?? inferParent(...))` expression that `select.build` uses.
- Lane E's test pins `deckName(seed) === build(seed).value.name` for every seed in the engine corpus.
- **`deckName` never throws.** `autoName` reads `naming().PARENTS[parentIndex].display`, which throws a TypeError for an index outside `PARENTS` (11 entries, 0 to 10, the range `core.readOptions` accepts). So `deckName` returns `null` for an explicit `options.parent` outside 0 to 10 instead of calling `autoName`, and `encode` turns that `null` into `badNote(seed)`: an out-of-range parent makes `encode` return `BAD_NOTE`.
- P7: the longest label shape is 13 characters ("C# PHRYGIAN 2") plus at most 3 count digits. That stays under `NAME_MAX` 16, so the non-ASCII ellipsis that `autoName` appends past 16 is never written.

**What the receiver does with `*`**
- The receiver sets no name, and `select.build` re-derives the label exactly as it does for a v4 link with an empty name.
- The label text in the link is never read (G3).

### 3.2 Options omitted at their default (Q4)

| Option | Default (`core.DEFAULT_OPTIONS` / `readOptions`) | Written as |
|---|---|---|
| palette | 0 | omitted; else `palette-2` to `palette-6` |
| parent | null (inferred; the sheet writes none since 2026-10-14) | omitted; else `parent-<slug>` (an explicit parent from an older link or record) |
| mirror / mirrorBottom | both false | omitted; else `mirror` (both), `mirror-top`, `mirror-bottom`, after `HPE.layout.resolveMirrors` |
| anchor | `one` | omitted; else `between` |
| seats | no ring moved | omitted; else `seats-r;i;b` |
| name | "" | never omitted: either a typed name or `*` and the label |

`replaces` is a record option and never travels, as today ("SU: an edited seed shares as a custom deck").

### 3.3 Caps and COPY LINK's disabled state (Q5)

- `CAPS.payload` stays 4096 and stays the first gate on decode. The same cap applies on encode, as v4's `encode` does.
- P6: a 120-note pan with every option set, every ring moved and a 40-character name made entirely of `/` (worst case, each becomes `%2F`) is 969 characters in v5 against 1122 in v4. No valid seed can reach the cap.
- S5 is unchanged: the share control is disabled, never hidden, and its `title` carries the refusal.
  - It stays reachable only through the stubbed-encode fixture of "SU: an over-cap custom deck disables COPY LINK with the refusal as its title and leaves the bare path", which keeps its title and passes untouched.
  - Section 6.6 covers how the disabled icon looks.

### 3.4 Back-compat and the canonical bar (Q6)

**What does not change**
- The v1 to v4 decoding is byte-identical. Their tests stay, fed by the test-side writer `forgePayload(version, lines)` or by golden literals.
- `routeInfo`, `routeFor` and `syncRoute` do not change. `shareCode(d)` is still the single encode (R2).

**What changes automatically.** Once `encode` writes v5:
1. A v4 `#s=` boot runs `openShare`. That is the one import, with one `share_open` unless the deck is `bootStored`.
2. The boot's closing `syncRoute()` sees `location.hash !== routeFor(deck())` and calls `replaceState` once, to the v5 code.
3. `replaceState` fires no `hashchange`, so there is no second import and no history entry.

**Tests that already prove the mechanism (unchanged)**
- "SU: syncRoute is idempotent"
- "SU: a hashchange to a #s= code imports it once and a second identical hashchange is a no-op"
- "SU: tapping three chips writes three replaceState hashes and no pushState"
- `tests/e2e.test.js` "edge 8: the app's own writes fire no hashchange, and a hashchange to the shown hash changes nothing"

**The one gap: a hashchange to the v4 spelling of the deck already shown**
- This happens on Back onto a pre-upgrade history entry.
- The listener's guard (`location.hash === routeFor(deck())`) compares spellings, so the v4 spelling falls through to `openShare` and imports again.
- Fix, in lane E: the `#s=` branch decodes first. If the received seed re-encodes to the code the bar would show for `deck()`, the branch only calls `syncRoute()`: no `rememberScale`, no `selectDeck` and no `share_open`.

**New tests, in lane E's acceptance**
- "SV: a v4 #s= boot imports once and ends with the v5 code in the bar through one replaceState"
- "SV: a hashchange to the v4 spelling of the deck shown rewrites the bar to v5 and imports nothing"
- `tests/e2e.test.js` "SV: a v4 link opens, the bar ends on v5, and Back leaves the page"

The analytics hash rule is untouched. The gtag `config` still sends `location.origin + location.pathname`, so a typed name in a v5 link never reaches GA ("page_location carries no hash, so a share payload never reaches GA" and "SU: page_location carries no hash on a custom-deck boot or a #s= boot", both unchanged). Fragments are never sent in `Referer`.

**Stored records stay at version 4 (engineering decision, recorded here).**
- `scaleRecord` writes `{v: SHARE_VERSION, ...}` and `restoreScales` rewrites every record whose `v` is below `SHARE_VERSION`.
- Bumping the app's `SHARE_VERSION` to the wire version 5 would therefore rewrite every visitor's stored decks to `v: 5`. A later revert of the app would then refuse all of them through `checkShareVersion` (`NEEDS_NEWER_APP`).
- The record format (`formatSeed` plus options) does not change, so lane E adds `HPE.share.RECORD_VERSION = 4` and points the app's `SHARE_VERSION` at it. The wire version moves alone.

### 3.5 Hand edits (Q7): owner gate G4

- **What strict means.** With a strict checksum, which is the recommendation, a hand-edited link is refused with today's corrupt-link sentence, and the sender has to make a new link in the app.
- **The readable form invites editing, and strict refuses it.** That is the tension the owner decides.
- **The middle option.** A literal check segment `-` marks a link as hand-made. It is accepted with a warning and canonicalised by `syncRoute()` on the next write. It is still rejection rather than repair: the seed must parse whole through `parseSeed`.

---

## 4. Implementation plan (/swarm)

**North star.** A shared link reads as the scale it opens. Every older link still opens the same deck. The main page offers COPY LINK as a share icon without moving the card a pixel.

**Non-goals**
- No change to deck data, diagram geometry, the card or the PDF.
- No change to `core.formatSeed`, `parseSeed` or the stored record format.
- No new external asset, font or dependency.
- No transition or animation.
- No URL shortener, no QR code and no `#deck=` change.
- No new analytics event or parameter.
- No line-number references in comments.

### 4.1 Waves and cross-workstream order

| Wave | Lane | Branch | In flight |
|---|---|---|---|
| 0 (other workstream) | About lane O, then About lane D (PR #331's plan) | `claude/about-overlay`, `claude/about-docs` | - |
| 1 | E: engine v5 and back-compat | `claude/share-v5-engine` | 1 |
| 2 | I: share icon, COPY LINK leaves the panel | `claude/share-v5-icon` | 1 |
| 3 | D: docs | `claude/share-v5-docs` | 1 |

**Dependency on PR #331**
- About lane O owns all of these:
  - the last Resources row;
  - `panelStops()`, to which it appends `about-open`;
  - the `syncRoute` and `hashchange` guards;
  - the `popstate` branch;
  - `tests/app.test.js`, `tests/e2e.test.js`, `tools/sandbox.js` and its FLOORS rows.
- Lanes E and I touch `panelStops()`, the header, the `hashchange` listener and both test files. So wave 1 starts only after About lane O AND About lane D have merged, and never in the same wave as either of them. Lane D owns `CLAUDE.md` and README.md lines, both of which our lanes also edit.
- Lane I's brief is written against the post-About `panelStops()`. The `about-open` entry stays last; lane I removes only `share-copy` and `share-url`.

**Dependency on scale import (PR #329 plan)**
- Its lane B owns the `index.html` app JS, `tests/app.test.js` and `tests/e2e.test.js`. Its lane A1 owns README.md's engine-module and suite-count sentences and adds mutants, which moves the README mutant count.
- Our lanes therefore never share a wave with scale import lane A1 or B.
- Their relative order is owner gate G9.

**Why waves 1 to 3 are serial.** Lanes E and I both edit `tests/app.test.js`, and lane D needs both merged. The work does not split by file, so one lane is in flight at a time (cap 4).

### 4.2 Ownership (no file or region owned twice in a wave; one lane per wave)

| Path | E | I | D |
|---|---|---|---|
| `src/engine/share.js`, `src/engine/select.js` (`deckName` export only) | owns | - | - |
| `index.html` engine regions `share` and `select` (written by `tools/inline_engine.py` only) | owns | - | - |
| `index.html` app JS: `SHARE_VERSION` declaration; the `#s=` branch of the `hashchange` listener | owns | - | - |
| `index.html` header markup (`.hrow`), header CSS, the Scales `.modebar`, `#share-url` and its hide listeners, `openScaleSheet()`'s hide of it, `copyLink`'s `done()` clear, `panelStops()`, `panelBackground`, `copyLink()`'s reveal, the print block | - | owns | - |
| `tests/share.test.js` | owns | - | - |
| `tests/app.test.js`, `tests/e2e.test.js` | owns (wave 1) | owns (wave 2) | - |
| `tools/probe/panel_fit.js` (`REMOVED_BY_DESIGN` only) | - | owns | - |
| `tests/mutants/`: own new patches, refreshes of patches it stales | `sv_*` | `si_*` | - |
| `tests/suite_health.py` FLOORS rows | share, app, e2e | app, e2e | - |
| `README.md` mutant-count sentence | owns | owns (wave 2) | - |
| `tests/fixtures/engine_corpus_v1.json` | owns (regen only if `--check` fails; expected not to) | - | - |
| `CLAUDE.md`, `README.md` prose, `docs/plans/2026-10-16-share-url.md` (supersession note) | - | - | owns |

### 4.3 Standing gates (every lane)

1. **CI is green at the verified head SHA.**
   - `gh pr view <n> --json headRefOid` must equal the local tip. Re-query once, because the field lags a push.
   - Gate on the `gh run list` conclusion at that SHA, never on `gh pr checks` buckets.
2. **An independent reviewer returns PASS or PASS_WITH_NITS** at that same SHA, working in its own worktree on `review-<lane>`.
3. **The sync and validation tools are clean.** These must all pass:
   - `python3 tools/inline_engine.py --check`
   - `python3 tools/sync_decks.py --check`
   - `python3 tools/validate.py`
   - `node tools/regen_engine_corpus.js --check`

   All four were recorded clean on `origin/main` `ebd997f`.
4. **Every mutant patch applies.** `python3 tools/refresh_mutants.py --check` must print "all mutant patches apply cleanly; nothing to refresh" (recorded on `ebd997f`).
5. **A lane that changes an engine module** commits the module, the `inline_engine.py` output and any corpus regen in ONE commit.
6. **The operator merges.**

### 4.4 Lane E brief: `claude/share-v5-engine` (wave 1)

**Owns.** Column E of 4.2.

**Objective.** `HPE.share` writes v5 (section 2), reads v1 to v5, and exports `RECORD_VERSION` 4. The app keeps records at 4 and closes the same-deck v4 hashchange gap (3.4). Until the owner answers, use the "Default while unanswered" column of section 5.

**TDD order.** Write every test below first. Watch each one fail on `origin/main` for the stated reason, then implement.

**Implementation (anchors, not lines)**
1. `share.js`:
   - Set `var VERSION = 5;` and keep the declaration shape, because `engineAtVersion(version)` in `tests/share.test.js` rewrites it with the regex `/var VERSION = \d+;/`. `var RECORD_VERSION = 4;` does not match that regex, so the helper still pins only the wire version.
   - Add `var RECORD_VERSION = 4;` and export it beside `VERSION` and `CAPS`.
2. A v5 writer and reader. `decode` dispatches on the version character, sending 1 to 4 to the existing packed reader unchanged.
3. The packed WRITER becomes dead code: `optionsLine` as written, the body encoding in `encode`, and the writer side of `seatsField`. Delete it. Keep every READER function.
4. `select.js` exports `deckName(seed)` (3.1). `share.js` reads it lazily through `HPE.select`, matching how `select.js` reaches `layout()` and `naming()`, and only inside `encode`. Nothing at load time and nothing in `decode` touches `HPE.select`, and `decodeSeed`'s version gate runs before the `5/` check. So `engineAtVersion(4)`, which loads only `core.js`, `layout.js` and the rewritten `share.js`, still answers `NEEDS_NEWER_APP` to a v5 link with no `select.js`.
5. App changes:
   - `const SHARE_VERSION = HPE.share.RECORD_VERSION;`
   - The `hashchange` `#s=` branch gets the same-deck short circuit (3.4).

**Acceptance: tests added**
- `tests/share.test.js`, each asserting what its title says:
  - "SV: this app writes wire version 5 and keeps records at 4". It asserts `VERSION === 5`, `RECORD_VERSION === 4`, and that `encoded(...)` starts with `5/`.
  - "SV: the five built-in decks' v5 links are pinned". It holds the ten literals of 2.3, both encode and decode. This is the Q18 analogue.
  - "SV: every option has one spelling and a default writes nothing". It covers the 3.2 table, both directions.
  - "SV: an unknown, duplicated or out-of-order option is BAD_NOTE".
  - "SV: a link with percent-encoded parens or underscores opens; an escaped * or + is refused". This is P8.
  - "SV: the auto label is ignored on receipt and lies outside the checksum". P10 and P11, conditional on G3 (a).
  - "SV: a 5 not followed by / is BAD_NOTE, and 6 or above is NEEDS_NEWER_APP".
  - "SV: a v5 link is NEEDS_NEWER_APP to an app pinned at v4". It uses the existing helper `engineAtVersion(4)`.
  - "SV: the check segment is an exact 6-character lowercase string; an uppercased, 5- or 7-character check is BAD_NOTE"
  - "SV: every v5 structural refusal is badNote of the whole link; a parseSeed refusal keeps its own code and reason"
  - "SV: deckName never throws, and an out-of-range parent makes encode return BAD_NOTE"
  - "SV: every v5 link survives new URL(...).hash byte for byte".
  - "SV: deckName equals build's name for every corpus seed".
  - "SV: the 120-note worst case fits the cap". This is P6.
- `tests/app.test.js`:
  - "SV: a v4 #s= boot imports once and ends with the v5 code in the bar through one replaceState". It asserts history calls `["replace"]` and one `share_open`.
  - "SV: a hashchange to the v4 spelling of the deck shown rewrites the bar to v5 and imports nothing". It asserts no `share_open`, an unchanged `savedScales()` and history `["replace"]`.
  - "SV: stored records keep v 4 after a v5 boot".
- `tests/e2e.test.js`: "SV: a v4 link opens, the bar ends on v5, and Back leaves the page".

**Acceptance: tests changed (and why)**
- `tests/share.test.js` loader list: `loadEngine(["core","layout","share"])` becomes `["core","voicing","layout","naming","select","share"]`, because `encode` now needs `deckName`.
- These two tests still pin the PACKED reader:
  - "encode's checksum is pinned against a captured minimal payload (Q18)"
  - "encode's checksum is pinned against a captured payload with every option set (Q18)"

  Their literals become decode goldens, which decode to the expected seed. They are retitled "decode still opens the captured v4 minimal payload (Q18)" and "decode still opens the captured v4 payload with every option set (Q18)", because v4 is no longer written.
- "this app writes wire version 4" becomes "this app writes wire version 5". The version moved.
- Every test that derives a v1 to v4 payload through `payloadOf` switches to a pinned v4 golden link or `forgePayload(4, [formatSeed(f), <v4 options line>, <seats>])`. Once `encode` writes v5, `payloadOf` would read v5 text as packed alphabet: refusal tests would pass vacuously and acceptance tests would fail. A grep for `payloadOf(` in `tests/share.test.js` finds fourteen calling tests. Ten test the v4 READER (and v1 to v3 forged from it), which stays:
  - "R4-E decode refuses a payload of two or four lines"
  - "R4-E decode refuses an options line with the wrong number of fields, a palette or parent that is not a count"
  - "a v3 options line with an unknown mirror or anchor character is refused"
  - "a v1 or v2 options line cannot carry a one-ring mirror letter"
  - "a malformed seats FIELD is refused, never repaired"
  - "a v2 flat order that crosses rings is refused"
  - "a v1 link carrying anything on line 2 is a corrupt payload"
  - "a v2 link with a v3-shaped line 2 or a malformed order is corrupt"
  - "decode chooses its scale-line reader from the version". Its `link` becomes a v4 golden, so "a version 4 link is read by the new grammar" still holds. It gains a v5 link that also records `["current"]`.
  - "a version 3 link with a bar opens with bottom notes"
- The other four `payloadOf` callers test the WRITER, so they assert v5 option segments instead, spelled as in 2.1's grammar and 3.2's table. Titles are kept, so the rewritten writer mutants that name them still select them:
  - "the one-ring mirror letters are exactly t and b on the options line": a both-ring mirror writes `mirror`, a top-only mirror writes `mirror-top`, a bottom-only mirror writes `mirror-bottom`, and no mirror writes no mirror segment.
  - "per-ring seats ride on line 2 as rim;inner;bottom": unmoved seats write no `seats-` segment; moved rim and bottom seats write `seats-<rim>;;<bottom>` (comma lists, the inner list empty), and the scale and other option segments are unchanged.
  - "the anchor travels on the options line and round-trips": a default link carries no `between` segment, and an `anchor: "between"` link carries exactly one.
  - "R4-E a 120-note pan with the rim, inner and bottom rings all reversed fits the cap and keeps every ring": the `seats-` segment holds three `;`-separated lists, of 60, 30 and 29 seats.
- "R4-E decode refuses a version byte outside the alphabet and a body character outside it, even under a valid check" slices `encoded(...)` as a packed string without calling `payloadOf`. It switches to a v4 golden, because it tests the v4 reader's alphabet.
- "a 2-, 3- and 4-byte UTF-8 character each round-trip through encode's byte pipeline (Q4)" reads `encoded(...)` through `refFromAlphabet` and takes line 1's name field, so it breaks the same way, although it calls no `payloadOf`. It now reads the v5 name segment and asserts that its `%XX` escapes are the host's UTF-8 bytes of the name, in uppercase hex. The title is kept.
- "the payload's third section is where the layout delta goes" does not call `payloadOf`. It round-trips `encoded(seed)` and refuses `str + "AAAAAA"`. Under v5 that append fails on the v5 check segment and never reaches a packed third section, so the test would pass while testing nothing it names. Its round-trip and append clauses run on `forgePayload(4, [formatSeed(f), <v4 options line>, ""])` instead, which keeps them on the packed shape. Its assertion that share.js documents the layout-delta section stays, because that comment sits with the kept reader.
- `tests/app.test.js` changes:
  - "the app's share version IS the engine's, not a second copy of the number" now asserts `SHARE_VERSION === HPE.share.RECORD_VERSION`, and that the declaration reads `HPE.share.RECORD_VERSION`, because records decouple from the wire.
  - "a newer share string reaches the user as section 2's NEEDS_NEWER_APP sentence" bumps from `HPE.share.VERSION + 1`, not `SHARE_VERSION + 1`. As written today it would build "5" plus a v5 tail, which is a valid v5 link.
  - "S3: seats, anchor and a one-ring mirror travel through a share link and rebuild the same pan" now expects `payload(url.value)` to start with `"5/"`, not `"4"`. The version moved.
  - "rule N: a moved deck's stored record and share link are the strings main wrote" keeps its record half (`v: 4`, `RECORD_VERSION`). Its `shareLink` half takes the v5 literal Lane E's encoder writes for that deck.

**Acceptance: tests that stay untouched.** The lane runs each of these, and a failure means STOP and report:
- "flipping any single character of a valid string is rejected". Its seed has a typed name, so P4 applies.
- "truncating or extending a valid string is rejected"
- "the share string leads with the version byte"
- "a payload over CAPS is rejected"
- "an over-cap payload is rejected WITHOUT parsing anything"
- "a version byte above this app's is still NEEDS_NEWER_APP"
- "share answers only with codes from the closed section 2 enum"
- "the module references no host encoder or compression API"
- "R4-E encode refuses a value that is not a seed, writes a seed with no options as the defaults, and refuses an over-cap link"
- the v1, v2 and v3 tests that read goldens or only the version character:
  - "a v1 link emitted by an older app still decodes here, deck unchanged"
  - "a v2 link emitted by an older app still decodes here, deck unchanged"
  - "a v2 flat order is converted to per-ring seats on decode"
  - "a v3 link is NEEDS_NEWER_APP to an app pinned at v2 or v1". Its `encoded(...)` is now v5, still above 1 and 2.
  - "a v2 link is NEEDS_NEWER_APP to an app pinned at v1"
  - "a version byte BELOW the oldest format is a corrupt payload"
- "the share version guard rejects a newer payload with NEEDS_NEWER_APP". It runs the record path, where 5 is still above 4.
- every "SU:" test
- "page_location carries no hash, so a share payload never reaches GA"

**Mutants**
- New `sv_*` patches:
  - `sv_check_over_raw_text`
  - `sv_auto_label_read_as_name`
  - `sv_default_option_written`
  - `sv_option_order_lax`
  - `sv_sharp_written_as_hash`
  - `sv_record_version_follows_wire`
  - `sv_same_deck_v4_reimports`
- **Expected to go stale.** Every patch that touches `src/engine/share.js`:
  - `f1b_share_checksum_shift`
  - `g2b_link_version_ignored`
  - `h_cap_removed`, `h_decode_repairs`, `h_decode_repairs_options`, `h_options_dropped`, `h_version_check_removed`, `h_version_ge`, `h_integrity_ignored`
  - `l0_decode_bypasses_reader_seam`
  - `r4e_share_encode_seed_unchecked`, `r4e_share_seats_only_rim_written`, `r4e_share_alphabet_char_read_as_zero`, `r4e_share_options_default_invented`, `r4e_share_encode_cap_unchecked`, `r4e_share_options_field_count_unchecked`, `r4e_share_line_count_unchecked`
  - `s_share_order_unchecked`, `s_share_v1_rejected`, `s_share_order_dropped`, `s_share_v1_delta_accepted`
  - `s3_share_anchor_dropped`
- **Patches on `SHARE_VERSION`:**
  - `d_share_version_lax`, `d_share_version_literal`, `d_share_version_nonfinite`
  - `d_replaces_not_carried`
  - `qa_scale_record_drops_options`
- Run `python3 tools/refresh_mutants.py`, then `--check`.
- **Writer mutants.** Rewrite against the v5 writer: `s_share_order_dropped`, `r4e_share_options_default_invented`, `s3_share_anchor_dropped`, `r4e_share_seats_only_rim_written`, `h_options_dropped`, `r4e_share_encode_cap_unchecked`. The patch count must not fall.
- Hand-edit the `# suite:` header of every patch whose killing test was retitled (the two Q18 tests, "this app writes wire version 4"). Use `.` wildcards, never quotes.
- Every re-pointed mutant updates its `# kills:` line along with its `# suite:` line, and both use `.` wildcards.
- Set the README mutant count, and the FLOORS rows for `tests/share.test.js` (73 today), `tests/app.test.js` and `tests/e2e.test.js`, from CI's run artifacts at the head SHA, not from arithmetic.

**Verify.** One command, recorded on `origin/main` `ebd997f` as 73 pass and 34 pass:

```
node --test tests/share.test.js && node --test --test-name-pattern "SU: |share version|newer share string|S3: seats|SV: " tests/app.test.js
```

Also run the four sync and corpus checks of gate 3, and the one new e2e test on its own.

**Non-goals.** The plan non-goals, plus:
- no header, panel or CSS change;
- no change to `copyLink()`;
- no change to `routeInfo`, `routeFor` or `syncRoute`.

### 4.5 Lane I brief: `claude/share-v5-icon` (wave 2, after E merges)

**Owns.** Column I of 4.2.

**Objective.** Section 6: the icon, the move and the fallback. `#share-copy` and `#share-url` keep their ids, so `tools/sandbox.js` `ELEMENT_IDS`, which already lists both, needs no change.

**TDD order.** Write every test below first, and watch each fail on `origin/main` for the stated reason.

**Acceptance: tests added** (`tests/app.test.js` unless noted)
- "SI: #share-copy is the header's first control, a button labelled Copy link with an inline SVG and no external asset"
- "SI: the Scales group holds + ADD A SCALE alone in a full-width row and no share control"
- "SI: panelStops holds neither share control, in either state"
- "SI: panelBackground holds #share-copy, so an open drawer inerts it"
- "SI: the print block hides #share-copy and #share-url"
- "SI: a revealed #share-url is positioned out of flow"
- `tests/e2e.test.js`:
  - "SI: the share icon is a 44px target in the header's left cell at 380x780 and the title stays centred"
  - "SI: a revealed #share-url does not move the card at 380x780"
  - "SI: a revealed #share-url hides on blur, on Escape and when the scale sheet opens, and the chips are hit-testable again". After each hide, `document.elementFromPoint` at a chip's centre returns that chip.
- "SI: a second COPY LINK clears the message line before writing LINK COPIED again". The clear lives in `copyLink`'s `done()`, not in `say()`. It records every `textContent` write to `#announce` over two clicks, awaiting one frame after each, and expects `["", "LINK COPIED", "", "LINK COPIED"]`. A `say()` from elsewhere (a `#scale-msg` keystroke message) writes once, with no clear.
- Before merging, the lane takes a 1x screenshot of the icon at 380x780 and checks that the glyph reads as a link (6.3).

**Acceptance: tests changed (and why)**
- "SU: COPY LINK joins panelStops after + ADD A SCALE and leaves it while disabled" is retitled "SU: COPY LINK is not a panel stop, enabled or disabled". It asserts `!stops(app).includes("share-copy")` in both states, because the control left the panel. No mutant names its old title (grep of `tests/mutants/` for "COPY.LINK.joins", 0 hits).
- "SU: COPY LINK reveals the readonly input when both are absent". It now asserts that `share-url` is in neither `panelStops()` state, since the input moved out of the panel. The title is kept.
- "editable defaults: #deck-restore follows #deck-add, starts hidden and joins the panel stops only while rendered". The title stays true. Its two regexes become:
  - `id="deck-add"[^>]*>[^<]*<\/button>\s*<\/div>\s*<button[^>]*id="deck-restore"...`
  - `document.getElementById("deck-add"), restoreBtn,`
- "panel fit rule 2: a control the base renders and the candidate lacks fails unless it is removed by design". Its `deepStrictEqual(pf.REMOVED_BY_DESIGN, ...)` gains `"share-copy"`.
- `tests/e2e.test.js`:
  - In `assertCardFits`, `LANDSCAPE_CONTROLS` gains `"#share-copy"`. The icon is always-on landscape chrome, which the card must not cover.
  - In "the mode buttons and Shuffle are 44px tall and steal nothing from their neighbours", `resting` gains `"#share-copy"`.
  - On Lane I's base (About lane O merged), 'seventeen flash-card' becomes 'sixteen flash-card' and 'eighteen progression' becomes 'seventeen progression'. `FLASH_STOPS` / `PROG_STOPS` lose `share-copy` (17→16, 18→17). About lane O adds `about-open` to `FLASH_STOPS` and renames today's "sixteen flash-card" and "seventeen progression" titles to seventeen and eighteen (`docs/plans/2026-10-17-about-off-main.md` on `claude/about-off-main-plan`). `PROG_STOPS` is built from `FLASH_STOPS`, so it follows.
  - The lane re-counts `FLASH_STOPS` and `PROG_STOPS` on its actual base before renaming anything, and renames from the counts it finds, not from this plan's numbers. "the sidebar's native Tab order is the panel's DOM order" reads `FLASH_STOPS.slice(1)` and `PROG_STOPS.slice(1)`, so it follows with no edit and keeps its title.
  - In "RESET SEEDED DECKS is absent until a seeded deck is edited or deleted, arms, and restores all five", Tab from `#deck-add` lands on `deck-restore`. The `share-copy` step between them goes.
  - "edge 9: a real COPY LINK click puts location.href, query included, on the clipboard" clicks the header `#share-copy` without opening the panel.
  - "edge 10: COPY LINK is a 44px target inside the panel at 320px and 380px with no horizontal overflow" becomes "edge 10: COPY LINK is a 44px target in the header at 320px and 380px with no horizontal overflow". It no longer opens the panel, and it drops the clause that pins its top to `#deck-add`'s. No mutant names it.
- **Mutant headers to re-point.** Headers are word-split, so they use `.` wildcards, never quotes. Re-point the `# kills:` and `# suite:` lines of `pm_handpan101_outside_tab_trap` and `uid_panelstops_misses_tier` to `Tab.cycles.exactly.the.sixteen.flash-card.stops` and `Tab.cycles.exactly.the.seventeen.progression.stops`.
  - `e_restore_not_panel_stop` names the RESET SEEDED DECKS title, which is kept, so its header stays.
  - No patch names "edge 9", "edge 10" or "the sidebar's native Tab order".

**Acceptance: untouched, and run**
- These pass unchanged, because ids, `copyLink()`'s chain and `track` are unchanged:
  - "SU: an over-cap custom deck disables COPY LINK with the refusal as its title and leaves the bare path"
  - "SU: COPY LINK copies location.href and announces LINK COPIED"
  - "SU: COPY LINK falls back to navigator.share when the clipboard rejects"
  - "SU: COPY LINK says nothing when the share sheet is dismissed"
  - "SU: COPY LINK tracks share_copy with no id, name or code"
  - "SU: a deck change hides a revealed #share-url so it never keeps the old deck's link"
  - "no event param is a string over 40 characters or names a custom: id"
  - "#about is in both inert lists and #app in neither". Its regexes still hold, because `#share-copy` is added by id.
- `tests/e2e.test.js` "the header and footer stay inside their pixel budget, so the card keeps its size" and "the card keeps its origin/main size with the about section below the first screen" (in whatever form About lane O leaves it). Both are unchanged for the reasons given in 6.7.

**Mutants**
- New `si_*` patches:
  - `si_icon_in_panel_stops`
  - `si_icon_not_inert_under_drawer`
  - `si_icon_prints`
  - `si_icon_unlabelled`
  - `si_share_url_in_flow`
  - `si_icon_hidden_when_refused`
- **Expected to go stale:**
  - `su_copy_hidden_when_refused`, `su_copy_stays_enabled`, `su_copy_reencodes`, `su_abort_not_silent`, `su_share_copy_sends_id`, `su_share_url_stays_after_deck_change`
  - `e_restore_not_panel_stop`, `e_panel_moved_into_header`, `e_target_chrome_eats_card`, `e_menu_keys_leak_to_card`
  - `ms_js_breakpoint_drift`, `ms_resize_leaves_inert`
  - `mr_stops_omit_amy`, `pm_handpan101_outside_tab_trap`, `qr_res_link_not_a_stop`, `uid_panelstops_misses_tier`
  - `pm_removed_by_design_too_wide`
  - `d_reset_close_stays_armed`
- Refresh, then `--check`. Rewrite against a stabler anchor where the tool cannot re-anchor.
- Set the README mutant count and FLOORS rows from CI artifacts.

**Verify.** One command, recorded on `origin/main` `ebd997f` as 11 pass:

```
node --test --test-name-pattern "COPY LINK|share_copy|share-url|panelStops|panel stops|removed by design|inert lists|SI: " tests/app.test.js
```

Also run `node tools/probe/panel_fit.js --base origin/main --font both` and the two new e2e tests one at a time.

**Non-goals.** The plan non-goals, plus:
- no change to `share.js`, `syncRoute` or `routeInfo`;
- no new `say()` text;
- no change to the deck strip's chips;
- no `tools/sandbox.js` change.

### 4.6 Lane D brief: `claude/share-v5-docs` (wave 3)

**Owns.** `CLAUDE.md`, the README prose, and a supersession note at the top of `docs/plans/2026-10-16-share-url.md`.

**Objective**
- Rewrite these CLAUDE.md passages so that every sentence names the test that proves it, and drop any sentence with no test:
  - the share-URL bullet in "Known pitfalls", covering the `#s=` format, `#share-copy` and `#share-url`;
  - the `#share-copy` sentences;
  - the "Scale strings" paragraph's version note.
- Add the v5 grammar in five lines, the record-version split, and the header icon.

**Acceptance**
- A fresh reviewer greps every quoted test title in the changed text and finds it.
- `tests/test_readme_currency.py` passes.
- No line numbers appear.

**Verify.** `python3 -m pytest tests/test_readme_currency.py -q`. Run it on `origin/main` before starting and record that it passes there.

**Non-goals.** No code and no test changes.

### 4.7 Reviewer briefs

**Every lane**
- **Inputs:**
  - the branch, base `origin/main` and the verified head SHA;
  - this lane's brief, verbatim;
  - the ownership table;
  - the owner gate answers.
- **The `/review` run.** Prefix every Bash call with `OPENCLAW_SESSION=1`.
- **Worktrees.** Use no node_modules symlink; this repo needs none.
- **Read-and-report only.** The reviewer reads CI's conclusion at that SHA. A FAIL needs a concrete failure scenario.

**Lane E (mutant budget 10)**
- Spend it on:
  - the checksum's coverage: raw text against decoded text, and the label;
  - the dispatch on the version character;
  - the record version;
  - the same-deck short circuit.
- Check by diff that the v1 to v4 reader functions are byte-identical to `origin/main`.

**Lane I (mutant budget 8)**
- Spend it on:
  - inertness under the drawer;
  - the panel stops;
  - the print rule;
  - the out-of-flow fallback;
  - the disabled state.
- Open the page at 380x780, 844x390 and 1280x800 through `/browse`, and compare against the 6.2 wireframes.

**Lane D (mutant budget 10)**
- Mutate each documented behaviour and confirm that its named test goes red.

---

## 5. Owner gates

| # | Question | Options | Recommendation | Evidence | Default while unanswered |
|---|---|---|---|---|---|
| G1 | Notation inside the link | (a) `u`, `s`, `_`, `-`, `( )` tokens; (b) literal `[ ] # \|` and spaces; (c) stay packed | (a) | P1: all 10 links come back from `URL.hash` byte for byte. (b) needs `%5B %5D %23 %7C %20` by spec, and some autolinkers stop at `[ ] \|` [unverified] | (a) |
| G2 | Checksum | (a) 6 hex = 24 bits; (b) 4 hex = 16 bits; (c) 6 alphabet characters = 36 bits | (a) | P4: 0 of 520 flips accepted at 24 bits. (c) mixes case into an otherwise readable link | (a) |
| G3 | Auto name in the link | (a) `*label`, ignored and outside the checksum; (b) `*label` inside the checksum; (c) bare `*` | (a) | P10: (a) survives a double-encoding transport on sharp roots and (b) does not. P11: (a) accepts flips only inside the ignored label. (c) is 12 to 16 characters shorter and less readable | (a) |
| G4 | Hand edits | (a) strict: an edited link is refused; (b) the literal check `-` is accepted as hand-made, with a warning, then canonicalised; (c) the checksum is ignored | (a) | D14 "rejects rather than repairs". (b) is still rejection, through `parseSeed`, but adds an accepted unchecked path. (c) drops the brief's checksum | (a) |
| G5 | Option spelling | (a) words: `palette-3` (1-based, as the UI's "Palette N"), `parent-harmonic-minor`, `mirror-top`, `between`; (b) numbers: `p2`, `m9` | (a) | P9 shows (a) | (a) |
| G6 | Share icon placement | (a) the header's left cell (`.hspacer`) at every width; (b) right of the title, beside the menu (grid 88/1fr/88); (c) in the footer beside the counter; (d) on the card face | (a) | 6.2: (a) uses an existing 44px cell. (b) costs the title 44px at 320px wide, where an e2e test already guards the title-trigger overlap. (c) crowds a footer budget the e2e chrome test pins. (d) breaks "print controls are never on a card face" | (a) |
| G7 | Glyph | (a) a chain link; (b) three connected nodes; (c) a box with an up arrow | (a) | 6.3: the control copies a link first and says LINK COPIED. (c) means the system share sheet, which is the fallback here. (b) reads as social sharing | (a) |
| G8 | Where `#share-url` reveals when clipboard and share are both missing | (a) an out-of-flow overlay under the header row, z-index 29 below `#scale-sheet` (30), hidden on blur, on Escape and when `openScaleSheet()` runs; (b) open the drawer and reveal it inside; (c) drop the input and only say the link | (a) | 6.5: (a) moves nothing, and its hides hand the chips back. (b) opens a panel the user did not ask for. (c) leaves no way to copy | (a) |
| G9 | Order against scale import | (a) after scale import lanes A1 and B merge; (b) before them | (a) | Both workstreams own `tests/app.test.js` and the README mutant count (4.1). The scale-import gates were decided first | (a) |
| G10 | The Scales row after the move | (a) + ADD A SCALE alone, full width; (b) + ADD A SCALE beside RESET SEEDED DECKS in a duo row | (a) | RESET is `hidden` unless a seed is edited or deleted, so (b) leaves a half-empty row most of the time | (a) |

---

## 6. On-page share icon: design and the move

The `frontend-design` skill was applied under a brief that pins the visual system. Its boldness budget is therefore spent on one decision only, the empty header cell. Every other detail is borrowed from what exists.

### 6.1 Tokens (all existing; nothing new)

| Role | Value | Source |
|---|---|---|
| Surface | `#211d16` | `.mode` background |
| Hairline | `#433b2c` 1px, radius 8px | `.mode` border |
| Glyph colour | `#c4bcab` via `currentColor` | `.mode` colour |
| Pressed | `#2e281e` | `.mode:active` |
| Focus | `2px solid #e3b25c`, offset 2px | global `:focus-visible` |
| Disabled | `opacity:.5; cursor:default` | the `#scale-drawer .mode:disabled` values |
| Target | 44 x 44 | `#settings-trigger` |
| Line weight | `stroke-width` 2.4 in a 24-unit viewBox drawn at 20px (renders 2px) | matches the trigger's 18 x 2px bars |

**Type.** No text renders in the control; its name is `aria-label`. LINK COPIED appears in the existing `.announce` row, set in Nunito Sans, as today.

**Theme.** The app is dark only (`<meta name="color-scheme" content="dark">`, `:root{color-scheme:dark}`), so there is no light variant to design. The icon inherits the same pair of colours as every `.mode` label.

### 6.2 Placement (wireframes)

Portrait, 380 x 780. The icon replaces `<span class="hspacer">`, cell for cell. The `44px 1fr 44px` grid, the title's optical centre and the header height do not change.

```
+--------------------------------------+
| [@]      Handpan Chords         [=]  |   [@] share-copy 44x44, [=] settings-trigger 44x44
| ( D KURD 10 )( D AMARA 10 )( ... )>  |   #decks chip strip
|                                      |
|          +----------------+          |
|          |                |          |
|          |      card      |          |   .scene: untouched
|          |                |          |
|          +----------------+          |
|                                      |
|  <-     3 / 49   SHUFFLE: OFF    ->  |   footer: untouched
|              LINK COPIED             |   .announce row (existing)
+--------------------------------------+
```

Landscape phone, 844 x 390, `@media (max-height:520px)`. Inside it, `.hrow{display:contents}` already dissolves the grid and `.hspacer{display:none}` removes the spacer.
- The icon becomes a flex item of the header row with `order:2` and `flex:0 0 auto`, the trigger's own rule. DOM order puts it immediately before the trigger.
- The chip strip (`flex:1 1 auto; min-width:0`) gives up 44px plus one gap and keeps scrolling. The gap is the landscape header's existing `gap:var(--sp-3)`, which is 9px under `max-height:520px`.
- Landscape Tab order (icon, trigger, chips) differs from visual order (chips, icon, trigger). This is accepted: `#settings-trigger` already does the same on main, where `.hrow` precedes `.decks` in the DOM and `order` puts it after them on screen.
- The row height is set by 44px controls either way.
- `[@] [=]` ends at the right border, with one 9px gap (the single space) between the two controls.

```
+------------------------------------------------------------------------------+
| ( D KURD 10 )( D AMARA 10 )( D AMARA 9 )( C# HIJ...  >               [@] [=] |
|                        +---------+                                           |
|                        |  card   |                                           |
|                        +---------+                                           |
|  <-      3 / 49     SHUFFLE: OFF     ->                                      |
+------------------------------------------------------------------------------+
```

Desktop, at least 1024 x 700. `#settings-trigger` is `display:none`, and the panel is the sidebar.
- The grid keeps its two 44px columns, so the icon sits in the left cell, the right cell stays empty, and the title stays centred.
- The icon is the only share control on the page, just as on phones.
- **Panel coverage.** Below 1024 x 700 an open panel covers the icon completely: the panel is `position:fixed; inset:0` at z-index 41, above the scrim (40), and the icon is inert under it (6.5.5). At 1024 x 700 and up, the sidebar (z-index 20) sits beside the header, so the icon stays visible and live.

```
+------------------------------------------------------------+-------------+
| [@]              Handpan Chords                            |  Settings   |
| ( chips ...................................... )           |  sidebar    |
|                    +-----------+                           |  (Scales:   |
|                    |   card    |                           |  + ADD A    |
|                    +-----------+                           |  SCALE)     |
+------------------------------------------------------------+-------------+
```

**Alignment.** The icon is centred in its cell, matching the trigger. The title stays centre-aligned.

### 6.3 Markup and glyph

```html
<button id="share-copy" type="button" class="mode" aria-label="Copy link">
  <svg class="glyph-link" viewBox="0 0 24 24" width="20" height="20"
       aria-hidden="true" focusable="false">
    <g transform="rotate(-45 12 12)" fill="none" stroke="currentColor"
       stroke-width="2.4" stroke-linecap="round">
      <rect x="2" y="8" width="12" height="8" rx="4"/>
      <rect x="10" y="8" width="12" height="8" rx="4"/>
    </g>
  </svg>
</button>
```

- **The glyph.** It is our own drawing: two 12 x 8 stadiums (`rx` 4, `stroke-width="2.4"`, which renders 2px at 20px), overlapping by 4 units and rotated -45 degrees about the centre. Lane I checks a 1x screenshot before merging. There is no icon font, no sprite and no external file, which matches the CSS-drawn hamburger.
- **Sizing.** `#share-copy{width:44px; height:44px; padding:0; flex:none}`. This is the trigger's own sizing, minus its z-index. The icon must NOT sit above the scrim, which is why 6.5 inerts it.
- **The accessible name.** It is "Copy link", the action and not the glyph. That echoes the LINK COPIED confirmation, so the action keeps one name through the flow.
- **No `title` while enabled.** A tooltip would only repeat the name, and S5 reserves `title` for the refusal.
- **Focus.** The global `:focus-visible` ring draws 2px outside the 8px radius. No new rule is needed.

### 6.4 Feedback, motion, print

- **Tap feedback.** `copyLink()`'s outcomes do not change; only `done()` gains the clear below.
  - Its `say("LINK COPIED","ok")` writes the `.announce` row (`role="status"`, `aria-live="polite"`), which is visible under the footer on every layout.
  - Its outcomes are LINK SHARED, SELECT THE LINK AND COPY IT, and silence on a dismissed share sheet.
  - The glyph does not swap to a tick. A timed swap would add state and motion for a message the live region already gives.
  - The accessible name stays "Copy link" in every state; only `disabled` and `title` change.
  - **Repeat copies.** `say()` today writes over the old text without clearing it, so a second LINK COPIED changes nothing. Lane I makes `copyLink`'s `done()` clear the message line and `#announce` before it writes, so a repeat copy is announced again. `say()` itself is unchanged, so `#scale-msg` is not re-announced on every keystroke. No `say()` text changes. The write of the new text runs in a `requestAnimationFrame` after the clear, so assistive tech sees two separate mutations. The SI test awaits one frame before reading the record.
- **Reduced motion.** Nothing animates. `.mode:active` is an instant background change, not a transition, so `prefers-reduced-motion` needs no rule.
- **Print.** Add `#share-copy, #share-url{display:none}` INSIDE the existing `@media print{` block. It must remain the last block in the `<style>` element, per `tests/test_render_agreement.py::test_print_block_is_last_in_the_style_element`.

### 6.5 The move, exactly

1. **`#share-copy`** leaves the Scales `.modebar duo` and replaces `.hspacer` in `.hrow`. The id is kept, so these keep working: the `shareCopy` const, `syncRoute()`'s `disabled`/`title` writes, `shareCopy.onclick = copyLink`, `ELEMENT_IDS`, and every SU test.
2. **The Scales row.** `<div class="modebar duo">` becomes `<div class="modebar">` holding only `#deck-add`. `.modebar .mode{flex:1 1 0}` makes it full width, the same pattern as the HANDPAN 101 row before About. The `#deck-restore` button below it does not change (G10).
3. **`#share-url`** moves out of the panel and directly after `.hrow` inside `<header>`. It stays `readonly hidden aria-label="Share link"` and is styled:

   ```css
   header{position:relative}
   #share-url{position:absolute; left:0; right:0; top:44px; z-index:29;
     background:#211d16; border:1px solid #433b2c; border-radius:8px; color:#eae6df}
   ```

   These declarations are added to the existing `#share-url` rule, which keeps `box-sizing`, `width:100%`, `min-height:44px`, `padding:0 10px` and `font-size:16px` (16px stops iOS from zooming on focus). Its `margin-top:var(--sp-2)` is removed, so the field's top edge is exactly 44px. `#share-url[hidden]{display:none}` stays.

   - It reuses `.mode`'s surface (`#211d16`), hairline (1px `#433b2c`) and radius (8px). Its text is `#eae6df`, the body text colour, not `.mode`'s `#c4bcab`, because it shows a link to read.
   - It hides on `blur`, on Escape and when `openScaleSheet()` runs. Its z-index 29 keeps it under `#scale-sheet` (30). Revealed, it overlays the chip strip, and the hide on blur hands the chips back (the SI `elementFromPoint` test).
   - Out of flow, a reveal moves nothing (G8).
   - `copyLink()`'s `reveal()` already focuses and selects it.
   - The deck-change hide is unchanged.
   - No `header` rule in `index.html` sets `position` today, so `position:relative` is needed.
4. **`panelStops()`** drops `document.getElementById("share-copy"), document.getElementById("share-url")`. The list reads `..., document.getElementById("deck-add"), restoreBtn, ...prints..., ...res- links, about-open` (the last item is About's). On the page, the icon is the first header Tab stop, before `#settings-trigger`. A disabled button leaves the Tab order natively.
5. **`panelBackground`** gains `document.getElementById("share-copy")`. Below 1024 x 700 the drawer is modal, so the icon must be inert under it, like the deck strip. The header is still not inerted whole, because it holds the trigger. The sheet's `background` already covers it, since it lists `header`.
6. **Disabled (S5).**
   - Add `#share-copy:disabled{opacity:.5; cursor:default}`.
   - It is disabled, never hidden, with the refusal as its `title`. `syncRoute()` still says the refusal once on the transition, and it stays in the message line until the next `say()`, so touch users, who never see a tooltip, can still read it.
   - [unverified] whether a `title` on a disabled button shows on hover in every desktop browser. The said refusal is the guaranteed channel.
7. **Analytics.** `share_copy` stays the same event with `{deck_kind, method}`: no id, no name and no code. "SU: COPY LINK tracks share_copy with no id, name or code" stays untouched.

### 6.6 States

| State | Look | Name or description | Tab |
|---|---|---|---|
| Rest | `.mode` surface, glyph `#c4bcab` | "Copy link" | stop |
| Focus-visible | plus the 2px `#e3b25c` ring | same | stop |
| Pressed | `#2e281e` | same | - |
| Disabled (S5) | opacity .5 | `title` = the engine's refusal, said once | not a stop |
| Drawer open (below 1024 x 700) | under the scrim, inert | hidden from AT | not a stop |
| Sheet open | inert with the header; a revealed `#share-url` hides | - | not a stop |
| Print | `display:none` | - | - |

### 6.7 Panel-fit and card-size verdicts

- **`tools/probe/panel_fit.js`: changed, tested by the CI `panel-fit` job.**
  - `REMOVED_BY_DESIGN` gains `"share-copy"`. COPY LINK is rendered in the base panel and absent from the candidate by design. Without the entry, rule 2 fails it as "rendered on the base and absent from the candidate".
  - The Scales row keeps one line, 44px, so no control below it moves. `#deck-add` widens within its row.
  - `RES_ALLOWANCE_PX` is untouched.
  - The pin "panel fit rule 2: a control the base renders and the candidate lacks fails unless it is removed by design" changes with it.
- **`tests/e2e.test.js` card-size tests: unchanged.**
  - Covered: "the header and footer stay inside their pixel budget, so the card keeps its size" and the `ORIGIN_SCENE` check (titled today "the card keeps its origin/main size with the about section below the first screen"; About lane O may retitle it).
  - Portrait and desktop: the icon occupies the existing 44px `.hspacer` cell.
  - Landscape: it adds a 44px item to a row whose height is already set by the 44px trigger.
  - A revealed `#share-url` is out of flow.
  - So header height, `main` height and `.scene`'s rectangle are unchanged. Lane I proves this at its head SHA with the two tests running unchanged, plus "SI: a revealed #share-url does not move the card at 380x780".

---

## 7. Risks, rejected alternatives and unverified claims

### Risks

1. **A transport encodes `+` as `%2B`.** The link is then refused (P8), by design: `+` is reserved. [unverified] No mainstream messenger was observed doing this.
2. **Markdown renderers end a bare autolink at `)`.** A link pasted into Markdown could lose its tail at the ding's `)`. The checksum then refuses the truncated link instead of opening the wrong deck. [unverified]
3. **Chat formatting reads `*...*` or `_..._` as emphasis** (WhatsApp, Slack) and could eat characters. The checksum refuses the result. [unverified] whether autolinked URLs are exempt.
4. **A future `formatSeed` change alters the token order.** That would change v5 spellings. Mitigation: SV pins the five decks' literals, so such a change goes red and needs a version bump.
5. **A link with escaped parens imports once, then canonicalises.** This is intended. On a later hashchange, the same-deck short circuit prevents a re-import.
6. **The landscape strip loses 44px plus a gap.** More chips scroll out of view, though no card change follows. Not measured.
7. **About lane O is still in review.** Section 6.5's `panelStops()` text assumes its `about-open` tail. If #331 changes course, lane I's brief edits only the `share-*` entries, which is unaffected.

### Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Bump the record version with the wire version | A revert of the app would refuse every stored deck (3.4) |
| Checksum over raw text | Breaks on harmless transport escaping (P8) |
| Checksum over a canonical re-encode | Accepted 8 equivalent-seed flips in the first prototype |
| `_` for space and `~` for the auto marker | Unreserved characters; RFC 3986 normalisers may unescape `%7E` to `~` [standard read, not observed] |
| A second COPY LINK in the panel | Two controls for one action |
| A floating action button | A new component family; covers the card |

### Unverified claims (complete list)

- Transport behaviour on `+`, `)`, `*`, `_` and `encodeURI`-style double-encoding (risks 1 to 3, P10's premise).
- Android Linkify's URL pattern stopping at `[ ] |` (G1), recalled from memory and not read from source.
- `title` tooltips on disabled buttons across desktop browsers (6.5.6).
- Whether a clear followed by a write one animation frame later in `copyLink`'s `done()` makes every screen reader announce a repeat LINK COPIED (6.4).
- Whether the 6.3 glyph reads as a link at 1x; Lane I's screenshot is the check.
- The landscape chip-strip width lost (risk 6), not measured.
- No e2e test was run for this plan, and no screenshot of the icon was taken. The wireframes are derived from the CSS rules cited, not rendered.

---

## 8. Quality score

The rubric is restated each round. Each row is 0 to 10.

| Dimension | Round 1 | Fix applied | Final |
|---|---|---|---|
| Evidence | 7: P1 used the first checksum design | Reran P1 to P8 and added P9 to P11 after G3's change, then quoted the new output | 10 |
| Repo accuracy (every cited name grepped) | 8: palette spelling clashed with the UI's "Palette N" | Grepped every function, test title, mutant and selector, and moved palette to 1-based | 10 |
| Owner fidelity | 9: the auto label risked counting as "invented" | The label is `autoName`'s own output and is ignored on receipt (3.1) | 10 |
| Testability | 8: the v4 tests' fate was vague | Every v4-pinning test is listed as changed, with its reason, or as untouched-and-run | 10 |
| Swarm shape | 8: the About and scale-import overlaps were implicit | 4.1 records both dependencies and the per-wave ownership | 10 |
| Regression safety (share tests, corpus, analytics hash, address bar) | 7: record rollback and same-deck re-import were missed | Records decoupled at 4; the hashchange short circuit added; both tested | 10 |
| Decisions | 9 | Ten gates, each with options, evidence and a default; nothing decided that is the owner's | 10 |
| Concision | 8 | Prose cut to tables, and briefs liftable verbatim | 10 |

### Round 2: eng and design review FAILs (2026-10-17)

| Finding | Fix | Where |
|---|---|---|
| E1: the untouched list held tests that forge v1 to v4 through `payloadOf` | All fourteen `payloadOf` callers listed: ten move to a v4 golden or `forgePayload(4, ...)`, four assert v5 option segments (round 3); the Q4 UTF-8 test, found in the same sweep, reads the v5 name segment | 4.4 |
| E2: rule N's share half pins a v4 literal | Record half kept (`v: 4`), share half takes the v5 literal | 4.4 |
| E3: e2e stops and mutant headers | `FLASH_STOPS`, sixteen/seventeen (on About lane O's seventeen/eighteen base; round 3), the RESET Tab step, edge 9, edge 10 (also found), two `# kills:` and `# suite:` re-points | 4.5 |
| N1 to N6 | `engineAtVersion`, exact check compare (BAD_NOTE: there is no `BAD_CHECKSUM`), `badNote(text)` refusals, the `formatSeed` inverse, `deckName`'s null guard, base `ebd997f`, the third-section rationale | 2.1, 2.2, 3.1, 4.4 |
| Design blocker: a revealed `#share-url` covered the chips above everything | z-index 29, hides on blur, Escape and sheet open, `elementFromPoint` test | 6.5, 4.5, G8 |
| Design nits 1 to 8 | Styling, `--sp-3` gap, Tab order, disabled refusal, panel coverage at 1024 x 700, 12 x 8 glyph, fixed accessible name, a clear in `copyLink`'s `done()` (round 3: not in `say()`) with a test | 6.2 to 6.6, 4.5 |

| Round 3, B1: stop counts ignored About lane O | Counts taken on About's base: seventeen/eighteen become sixteen/seventeen; `# kills:` and `# suite:` re-pointed; the lane re-counts on its actual base first | 4.5 |
| Round 3, eng nits 1 to 4 | Six writer mutants named; mirror and seats tests moved to the v5 writer group (ten reader tests); `# kills:` rule; the clear scoped to `copyLink`'s `done()` | 4.4, 4.5, 6.4 |
| Round 3, design nits 1 to 4 | `#share-url` keeps its base declarations and loses `margin-top`; `stroke-width` 2.4; the clear-then-write split by a frame; landscape wireframe redrawn | 6.1, 6.2, 6.3, 6.4, 6.5 |

Every row re-scored 10 after rounds 2 and 3. The two items the repo cannot settle are in the unverified list.

### Adversarial pass: the five likeliest ways a lane fails review or CI, and the fix in this plan

1. **Lane E bumps `SHARE_VERSION` with the wire version and silently migrates stored records.**
   - Fix: `RECORD_VERSION` is in the objective.
   - The changed test "the app's share version IS the engine's..." asserts the new source.
   - "SV: stored records keep v 4 after a v5 boot" catches the migration, and `sv_record_version_follows_wire` proves that test can go red.
2. **Retitled Q18 tests leave mutants selecting zero tests, so they "survive".**
   - Fix: each retitle is named in 4.4.
   - The lane hand-edits those `# suite:` headers with `.` wildcards.
   - Writer-side mutants are rewritten, not dropped, so the README count band holds.
3. **`tests/share.test.js` keeps loading `["core","layout","share"]`, and `encode` throws on a missing `HPE.select`.**
   - Fix: the loader change is listed first among the changed tests.
   - `share.js` reads `HPE.select` lazily, as `select.js` does `layout()`.
4. **Lane I's icon lands above the scrim or stays reachable under the modal drawer.** That fails a reviewer's 380px keyboard walk.
   - Fix: there is no z-index on `#share-copy`, it joins `panelBackground` (6.5.5), and the test "SI: panelBackground holds #share-copy..." plus `si_icon_not_inert_under_drawer` pin it. `#share-url` takes z-index 29, under the sheet (30) and the scrim (40), and hides on blur, Escape and sheet open, so it never covers the chips or a modal.
5. **The panel-fit CI job fails on the removed control, or the lane rebases onto About and collides in `panelStops()`.**
   - Fix: `REMOVED_BY_DESIGN` and its pin are in lane I's ownership and acceptance.
   - Wave 1 cannot start before About lanes O and D merge (4.1).
   - Lane I edits only the `share-*` entries.
