#!/usr/bin/env python3
import hifi
from reportlab.lib.colors import Color

# =========================================================== C# HIJAZ / ORION
# spec: field -> (name, octave, midi, zone, angle, label)
HIJAZ_SPEC = {
    "_geom": dict(rim=0.745, r_ding=0.200, r_note=0.190, inner_ring=0.355,
                  f_ding=0.135, f_note=0.128, f_num=0.105,
                  n_in=0.085, n_out=0.0, r_bnote=0.0, f_bnote=0.0),
    0:  ("C#", 3, 49, "ding", None, "Ding"),
    1:  ("G#", 3, 56, "rim", 270, "1"),
    2:  ("B",  3, 59, "rim", 225, "2"),
    3:  ("C#", 4, 61, "rim", 315, "3"),
    4:  ("D",  4, 62, "rim", 180, "4"),
    5:  ("F",  4, 65, "rim",   0, "5"),
    6:  ("F#", 4, 66, "rim", 135, "6"),
    7:  ("G#", 4, 68, "rim",  45, "7"),
    8:  ("B",  4, 71, "rim",  90, "8"),
}

HIJAZ_CHORDS = [
    ("C#", "", "C# MAJOR", [3, 5, 7], {3}),
    ("C#5", "", "POWER CHORD", [3, 7], {3}),
    ("C#sus", "4", "SUSPENDED CHORD", [3, 6, 7], {3}),
    ("C#", "7", "C# DOMINANT 7", [3, 5, 7, 8], {3}),
    ("C#7sus", "4", "SUSPENDED DOMINANT 7", [3, 6, 7, 8], {3}),
    ("C#7", "b9", "HIJAZ SIGNATURE CHORD", [3, 5, 7, 8, 4], {3}),
    ("Bm", "", "B MINOR", [2, 4, 6], {2}),
    ("Bm", "", "B MINOR - HIGH VOICING", [8, 4, 6], {8}),
    ("B5", "", "POWER CHORD", [2, 6], {2}),
    ("Bm", "add9", "B MINOR ADD 9", [2, 4, 6, 3], {2}),
    ("Bm", "6/9", "B MINOR 6/9", [2, 4, 6, 7, 3], {2}),
    ("G#\u00b0", "", "DIMINISHED", [1, 2, 4], {1}),
    ("G#m7", "b5", "HALF-DIMINISHED ( = Bm6 )", [1, 2, 4, 6], {1}),
    ("F#sus", "4", "SUSPENDED CHORD", [6, 2, 3], {6}),
    ("F#maj7sus", "4", "SUSPENDED MAJOR 7", [6, 2, 3, 5], {6}),
    ("D\u00b0", "7", "DIMINISHED 7", [4, 5, 7, 8], {4}),
    ("Dmaj", "7", "D MAJOR 7 (NO 5)", [4, 6, 3], {4}),
    ("Dmaj7", "#11", "D MAJOR 7 SHARP 11 (NO 5)", [4, 6, 3, 7], {4}),
]

HIJAZ = dict(
    title="C# Hijaz / Orion 9 - Chord Cards",
    name="C# HIJAZ 9", sub="ORION  -  8 + 1", credit="C# HIJAZ / ORION",
    spec=HIJAZ_SPEC, chords=HIJAZ_CHORDS, R=73.0, cy=126.0,
    y_note=30.0, y_num=14.0, has_bottom=False,
    legend_demo=(5, 3), grad=(Color(0.878, 0.333, 0.604), Color(0.886, 0.463, 0.106)),
    col_root=Color(0.878, 0.333, 0.604), col_tone=Color(0.886, 0.463, 0.106),
    degrees={1: 'I', 2: 'bII', 6: 'iv', 8: 'v\u00b0', 11: 'bvii'},
    blurb=["C#3  |  G#3  B3  C#4  D4  F4  F#4  G#4  B4",
           "PHRYGIAN DOMINANT, NO b6   -   18 CHORDS"],
    legend_lines=["NOTE NAME + OCTAVE INSIDE EACH TONEFIELD",
                  "TONEFIELD NUMBERS RUN 1 - 8 FROM THE LOWEST NOTE"],
)

# ========================================================= F3 LOW PYGMY 18
PYGMY_SPEC = {
    "_geom": dict(rim=0.722, inner=0.380, bottom=1.150, r_ding=0.190, ding_dy=0.1425,
                  r_note=0.1425, r_bnote=0.1188, inner_ring=None,
                  f_ding=0.114, f_note=0.109, f_bnote=0.0931, f_num=0.0912,
                  n_in=0.052, n_out=0.068, rim_num_out=True),
    0:  ("F",  3, 53, "ding", None, "Ding"),
    1:  ("G",  3, 55, "rim", 290, "1"),
    2:  ("Ab", 3, 56, "rim", 250, "2"),
    3:  ("C",  4, 60, "rim", 330, "3"),
    4:  ("Eb", 4, 63, "rim", 210, "4"),
    5:  ("F",  4, 65, "rim",  10, "5"),
    6:  ("G",  4, 67, "rim", 170, "6"),
    7:  ("Ab", 4, 68, "rim",  50, "7"),
    8:  ("C",  5, 72, "rim", 130, "8"),
    9:  ("Eb", 5, 75, "rim",  90, "9"),
    10: ("F",  5, 77, "inner", 128, "10"),
    11: ("G",  5, 79, "inner",  52, "11"),
    101: ("C",  3, 48, "bottom", 300, "U1"),
    102: ("Db", 3, 49, "bottom", 240, "U2"),
    103: ("Eb", 3, 51, "bottom",   0, "U3"),
    104: ("Bb", 3, 58, "bottom", 180, "U4"),
    105: ("Db", 4, 61, "bottom",  60, "U5"),
    106: ("Ab", 5, 80, "bottom", 120, "U6"),
}

PYGMY_CHORDS = [
    ("Fm", "", "F MINOR", [5, 7, 8], {5}),
    ("F5", "", "POWER CHORD", [5, 8], {5}),
    ("Fsus", "4", "SUSPENDED CHORD", [5, 104, 3], {5}),
    ("Fm", "7", "F MINOR 7", [5, 7, 8, 9], {5}),
    ("Fm", "9", "F MINOR 9", [5, 7, 8, 9, 11], {5}),
    ("Fm", "11", "F MINOR 11", [5, 2, 3, 4, 6, 104], {5}),
    ("Ab", "", "Ab MAJOR", [2, 3, 4], {2}),
    ("Ab", "", "Ab MAJOR - HIGH VOICING", [7, 8, 9], {7}),
    ("Abmaj", "7", "Ab MAJOR 7", [2, 3, 4, 6], {2}),
    ("Abmaj", "9", "Ab MAJOR 9", [2, 3, 4, 6, 104], {2}),
    ("Bbm", "", "Bb MINOR", [104, 105, 5], {104}),
    ("Bbm", "7", "Bb MINOR 7 ( = Db6 )", [104, 105, 5, 7], {104}),
    ("Cm", "", "C MINOR - LOW VOICING", [101, 103, 1], {101}),
    ("Cm", "", "C MINOR", [3, 4, 6], {3}),
    ("Cm", "", "C MINOR - HIGH VOICING", [8, 9, 11], {8}),
    ("C5", "", "POWER CHORD", [3, 6], {3}),
    ("Csus", "4", "SUSPENDED CHORD", [3, 5, 6], {3}),
    ("Cm", "7", "C MINOR 7", [3, 103, 1, 104], {3}),
    ("Db", "", "Db MAJOR", [105, 5, 7], {105}),
    ("Dbmaj", "7", "Db MAJOR 7", [105, 5, 7, 8], {105}),
    ("Eb", "", "Eb MAJOR - LOW VOICING", [103, 1, 104], {103}),
    ("Eb", "", "Eb MAJOR", [4, 1, 104], {4}),
    ("Eb", "7", "Eb DOMINANT 7", [103, 1, 104, 105], {103}),
    ("G\u00b0", "", "DIMINISHED", [1, 104, 105], {1}),
    ("Gm7", "b5", "HALF-DIMINISHED", [1, 104, 105, 5], {1}),
]

PYGMY = dict(
    title="F3 Low Pygmy 18 - Chord Cards",
    name="F3 LOW PYGMY 18", sub="11 + 1 TOP  /  6 BOTTOM",
    credit="F3 LOW PYGMY / F AEOLIAN",
    spec=PYGMY_SPEC, chords=PYGMY_CHORDS, R=60.0, cy=121.0,
    y_note=30.0, y_num=14.0, has_bottom=True,
    legend_demo=(3, 0), blank_cards=9, grad=(Color(0.427, 0.251, 0.639), Color(0.788, 0.592, 0.118)),
    col_root=Color(0.427, 0.251, 0.639), col_tone=Color(0.788, 0.592, 0.118),
    degrees={5: 'i', 8: 'III', 10: 'iv', 0: 'v', 1: 'VI', 3: 'VII', 7: 'ii\u00b0'},
    blurb=["F3 | G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 F5 G5",
           "BOTTOM:  C3  Db3  Eb3  Bb3  Db4  Ab5",
           "COMPLETE F NATURAL MINOR   -   25 CHORDS"],
    legend_lines=["U1 - U6: BOTTOM NOTES, X-RAY VIEW (SEEN FROM ABOVE)",
                  "Bb AND Db EXIST ONLY ON THE BOTTOM SHELL",
                  "TONEFIELDS 1 - 11 RUN FROM THE LOWEST TOP NOTE"],
)


# =============================================================== D AMARA 9
AMARA_SPEC = {
    "_geom": dict(rim=0.745, r_ding=0.200, r_note=0.190, inner_ring=0.355,
                  f_ding=0.135, f_note=0.128, f_num=0.105,
                  n_in=0.085, n_out=0.0, r_bnote=0.0, f_bnote=0.0),
    0: ("D", 3, 50, "ding", None, "Ding"),
    1: ("A", 3, 57, "rim", 270, "1"),
    2: ("C", 4, 60, "rim", 225, "2"),
    3: ("D", 4, 62, "rim", 315, "3"),
    4: ("E", 4, 64, "rim", 180, "4"),
    5: ("F", 4, 65, "rim",   0, "5"),
    6: ("G", 4, 67, "rim", 135, "6"),
    7: ("A", 4, 69, "rim",  45, "7"),
    8: ("C", 5, 72, "rim",  90, "8"),
}

AMARA_CHORDS = [
    ("Dm", "", "D MINOR", [3, 5, 7], {3}),
    ("Dm", "7", "D MINOR 7", [3, 5, 7, 8], {3}),
    ("D5", "", "POWER CHORD", [3, 7], {3}),
    ("Dsus", "4", "SUSPENDED CHORD", [3, 6, 7], {3}),
    ("Am", "", "A MINOR", [1, 2, 4], {1}),
    ("Am", "7", "A MINOR 7", [1, 2, 4, 6], {1}),
    ("A5", "", "POWER CHORD", [1, 4], {1}),
    ("Asus", "4", "SUSPENDED CHORD", [1, 3, 4], {1}),
    ("G5", "", "POWER CHORD", [6, 3], {6}),
    ("Gsus", "4", "SUSPENDED CHORD", [6, 2, 3], {6}),
    ("C", "", "C MAJOR", [2, 4, 6], {2}),
    ("C5", "", "POWER CHORD", [2, 6], {2}),
    ("Csus", "4", "SUSPENDED CHORD", [2, 5, 6], {2}),
    ("F", "", "F MAJOR", [5, 7, 8], {5}),
    ("F5", "", "POWER CHORD", [5, 8], {5}),
    ("Fmaj", "7", "F MAJOR 7", [5, 1, 2, 4], {5}),
]

AMARA = dict(
    title="D Amara 9 - Chord Cards",
    name="D AMARA 9", sub="8 + 1", credit="D AMARA / D MINOR",
    spec=AMARA_SPEC, chords=AMARA_CHORDS, R=73.0, cy=126.0,
    y_note=30.0, y_num=14.0, has_bottom=False,
    legend_demo=(5, 3), grad=(Color(0.043, 0.482, 0.459), Color(0.867, 0.561, 0.000)),
    col_root=Color(0.043, 0.482, 0.459), col_tone=Color(0.867, 0.561, 0.000),
    degrees={2: "i", 9: "v", 7: "IV", 0: "bVII", 5: "bIII"},
    blurb=["D3  |  A3  C4  D4  E4  F4  G4  A4  C5",
           "16 CHORDS - ONE CARD PER CHORD"],
    legend_lines=["NOTE NAME + OCTAVE INSIDE EACH TONEFIELD",
                  "TONEFIELD NUMBERS RUN 1 - 8 FROM THE LOWEST NOTE"],
)

# ================================================== GENERATED DECKS (ADAPTER)
# `tools/gen_deck.js` turns a scale seed into the generated deck object of
# ENGINE-SPEC section 11.  The engine knows about fields, chords, degrees and
# colours; the print pipeline needs a dozen more per-deck keys it has never
# heard of.  from_generated() synthesises them.
#
# ADDITIVE ONLY: the three built-in dicts above and their spec/chord literals
# stay byte-identical, because tools/validate.py check 1 asserts decks.py
# equals the app JSON and check 2 runs invariants over all 59 cards.
#
# Every key a built-in deck dict carries is either produced here or named in
# GENERATED_OMITTED with a reason; tests/test_gen_deck.py reads the key set off
# the built-ins at RUNTIME, so a key added above later fails that test instead
# of slipping through.

GENERATED_OMITTED = {
    "blank_cards": (
        "Padding preference, not deck data: PYGMY asks for 9 write-your-own "
        "cards so its last sheet comes out full. hifi.build already pads to a "
        "multiple of 9 with blanks, and how many spare cards a person wants "
        "is not derivable from a scale, so a generated deck asks for none."
    ),
}

# The diagram band on the card, in points from the card's bottom edge: the
# note line and its badge end near 50, the header block starts near 198.  R is
# then whatever radius makes the furthest drawn element (`geom.ext`, which the
# solver derives from the outermost ring plus its note radius, its number
# offset, the number glyph's own reach and a 6% pad) reach the edge of that
# band, and the pan is centred in it.
#
# HOW CLOSE IS IT TO THE MEASURED LITERALS?  (re-derived 2026-09-09; the earlier
# note here compared 74.0 - a REACH, `_BAND_HALF` - against 73.0, a RADIUS, and
# read the built-ins' own `ext` rather than the generated one, so it understated
# the gap.)  EVERY FIGURE BELOW NAMES THE EXACT SEED IT WAS MEASURED ON.  A
# measured number quoted without its seed has been wrong three times already:
# `ext` moves with the SHAPE of the string, not with a loose family name like
# "Pygmy-shaped".  Running the real pipeline - `gen_deck.js "<seed>"`, then this
# formula - on these three strings:
#
#   S_HIJAZ  (C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4
#   S_PYGMY  (F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 / F5 G5
#            | C3 Db3 Eb3 Bb3 Db4 Ab5        <- canonical, docs/ENGINE-SPEC.md
#   S_NOSEP  S_PYGMY with the `/` omitted: 11 rim, 0 inner, 6 bottom
#                                          <- tests/test_gen_deck.py's
#                                             SEED_WITH_BOTTOM
#
#   S_HIJAZ  ext 1.0600 -> R 69.8 vs the literal 73.0   = -4.4%
#   S_PYGMY  ext 1.4620 -> R 50.6 vs the literal 60.0   = -15.7%
#   S_NOSEP  ext 1.4767 -> R 50.1 vs the literal 60.0   = -16.5%
#
# S_PYGMY and S_NOSEP differ only in that separator, and that alone moves `ext`:
# with no inner shell there is no rim-vs-inner radial crowding, so `r_note`
# solves to 0.1783 (S_NOSEP) instead of 0.1456 (S_PYGMY) - and `f_num`, which is
# 0.64 * r_note, rides along at 0.1141 instead of 0.0932.  `f_num` is the whole
# channel.  For BOTH seeds the max in the reach formula
# (`src/engine/layout.js:289-302`) is won by the same bottom-shell number term,
# `bottomOrb + rBnote + nOut + f_num * LABEL_REACH`:
#
#   term                                            S_PYGMY   S_NOSEP
#   shell circle                                     1.0000    1.0000
#   ding      DING_DY + R_DING                       0.3325    0.3325
#   rim       rimOrb + r_note                        0.8676    0.9233
#   rim+num   rimOrb + r_note + n_in + f_num*0.7     0.9848         -   (*)
#   inner     innerOrb + r_note                      0.5256         -
#   bottom    bottomOrb + r_bnote                    1.2688    1.2688
#   bottom+num  ... + n_out + f_num*0.7              1.4020    1.4167  <- max
#   + EXT_PAD 0.06                                   1.4620    1.4767
#
#   (*) the rim number term only exists when there IS an inner shell
#       (`rimNumOut = hasInner`), so S_NOSEP has no such term at all.
#
# The rim ring DOES move out - 0.722 R (S_PYGMY) to 0.745 R (S_NOSEP) - but it
# never reaches: its best term, 0.9233, loses to the bottom-shell number term by
# a third of R, so it contributes NOTHING to `ext` for either seed.  The entire
# 1.4767 - 1.4620 = 0.0147 delta is the `f_num` glyph:
# 0.7 * (0.1141 - 0.0932) = 0.01463.  The
# 1.4767 / 50.1 pair is S_NOSEP's, NOT the real Pygmy string's.
#
# Like for like on REACH (R * ext, the furthest drawn element from the centre)
# means running `src/engine/layout.js`'s OWN reach formula over the built-in's
# geom too - the outermost ring, plus its note radius, plus the number offset,
# plus `f_num * LABEL_REACH` of glyph, plus `EXT_PAD`.  Measured that way
# (2026-09-09, re-derived a second time after the first correction still
# compared unlike things):
#
#   S_HIJAZ generated 1.0600 x 69.8 = 73.99  vs  HIJAZ_SPEC 1.0600 x 73.0 = 77.38
#                                                                         = -4.4%
#   S_PYGMY generated 1.4620 x 50.6 = 73.98  vs  PYGMY_SPEC 1.4606 x 60.0 = 87.64
#                                                                        = -15.6%
#
# The REACH column is seed-insensitive by construction, but only to about a
# tenth of a point - NOT exactly.  R is defined below as
# `round(_BAND_HALF / ext, 1)`, and that 1-dp rounding is what keeps R * ext off
# a clean 74.0: the product is `_BAND_HALF + e * ext` where |e| <= 0.05 is the
# rounding residue on R, so it lands anywhere in 73.93 .. 74.07 across the ext
# band generated decks actually produce (1.0 .. 1.5; swept at 1e-4 steps, min
# 73.925 at ext 1.4995, max 74.073 at ext 1.4904).  Hence ~ 74.0 for any seed,
# which is why the three figures quoted just above read 73.99 (S_HIJAZ) and
# 73.98 (S_PYGMY) rather than 74.00, and why S_NOSEP's 1.4767 x 50.1 = 73.98
# lands with them.  Only the RADIUS column moves with the seed in any material
# way, which is why the two Pygmy strings disagree above but not here.
#
# The S_PYGMY reach pair was previously quoted as "73.98 vs 76.13 (-2.8%)", but
# 76.13 is `60.0 x 1.2688` - the outer edge of PYGMY_SPEC's bottom note CIRCLES
# only - while the generated `ext` also counts the orange bottom NUMBERS that
# `tools/hifi.py` draws at `orb + rr + R * n_out`, their glyph reach, and the
# 6% pad.  Comparing a circle edge against a padded label reach understated the
# gap by an order of magnitude.
#
# And the ring radius is NOT the cause: both bottom rings sit at exactly
# 1.15 R.  The generated pan comes out ~16% smaller because this formula treats
# reach as ISOTROPIC - it assumes the furthest element could point straight up
# or down into the header block - while the built-in Pygmy's hand-picked
# R = 60.0 exploits the fact that its bottom notes never sit at the top or
# bottom of the card (max |sin theta| = 0.866 at 60/120/240/300 deg).  That is a
# directional bonus a single scalar `ext` cannot express, and a solver that
# places bottom angles freely must not assume it.
#
# The deviation is SAFE IN BOTH DIRECTIONS: every figure is negative, i.e. the
# generated pan is SMALLER than the built-in one, so it clears the header block
# and the bottom-note badge with more margin than the built-ins do, never less.
#
# One consequence worth knowing before trusting the band constants: for EVERY
# top-only deck `ext` is exactly 1.06, because the shell circle dominates the
# outermost ring plus its note radius.  R therefore degenerates to the constant
# 69.8 on every top-only deck, and the formula only starts adapting once a
# bottom shell exists.
_BAND_LOW, _BAND_HIGH = 50.0, 198.0
_BAND_CY = (_BAND_LOW + _BAND_HIGH) / 2.0
_BAND_HALF = (_BAND_HIGH - _BAND_LOW) / 2.0

# The two text baselines are the same on all three built-in decks - they are
# properties of the CARD, not of the instrument - so they are carried over
# rather than derived.
_Y_NOTE, _Y_NUM = 30.0, 14.0


def _hex_color(value):
    """'#RRGGBB' -> reportlab Color."""
    s = value.lstrip("#")
    if len(s) != 6:
        raise ValueError("not a #RRGGBB colour: %r" % (value,))
    return Color(*(int(s[i:i + 2], 16) / 255.0 for i in (0, 2, 4)))


def _spec_from(generated):
    """The engine's geom + fields as hifi's `spec` dict."""
    spec = {"_geom": dict(generated["geom"])}
    for fid, value in generated["fields"].items():
        name, octave, midi, zone, angle, label = value
        spec[int(fid)] = (name, octave, midi, zone, angle, label)
    return spec


def _blurb(spec, chord_count, warnings=()):
    """Title-card copy: the pan's own notes, the deck size, any warning."""
    def line(zone_test):
        return "  ".join(
            "%s%d" % (spec[k][0], spec[k][1])
            for k in sorted(k for k in spec if k != "_geom" and zone_test(spec[k][3])))

    ding = [k for k in spec if k != "_geom" and spec[k][3] == "ding"]
    head = "%s%d  |  " % (spec[ding[0]][0], spec[ding[0]][1]) if ding else ""
    out = [head + line(lambda z: z in ("rim", "inner"))]
    bottom = line(lambda z: z == "bottom")
    if bottom:
        out.append("BOTTOM:  " + bottom)
    out.append("%d CHORD%s - ONE CARD PER CHORD"
               % (chord_count, "S" if chord_count != 1 else ""))
    # A NO_THIRDS pan would otherwise print with no sign anywhere on the sheets
    # that the app had flagged it; the engine's own reason string, verbatim.
    for w in warnings:
        out.append(w["reason"].upper())
    return out


def _legend_lines(spec, has_bottom):
    tops = [k for k in spec if k != "_geom" and spec[k][3] in ("rim", "inner")]
    bottoms = [k for k in spec if k != "_geom" and spec[k][3] == "bottom"]
    lines = []
    if has_bottom:
        # hifi.legend_card prints the FIRST line in the bottom-shell accent
        # when has_bottom, so the bottom-note line has to lead.
        lines.append("U1 - U%d: BOTTOM NOTES, X-RAY VIEW (SEEN FROM ABOVE)"
                     % len(bottoms))
    lines.append("NOTE NAME + OCTAVE INSIDE EACH TONEFIELD")
    lines.append("TONEFIELD NUMBERS RUN 1 - %d FROM THE LOWEST %sNOTE"
                 % (len(tops), "TOP " if has_bottom else ""))
    return lines


def _legend_demo(spec, chords):
    """(field to light, field to light as root) for the how-to-read card."""
    if chords:
        _main, _sup, _sub, fields, roots = chords[0]
        root = next(f for f in fields if f in roots)
        other = next((f for f in fields if f != root), root)
        return (other, root)
    ids = sorted(k for k in spec if k != "_geom")
    return (ids[-1], ids[0])


def from_generated(payload):
    """A gen_deck.js payload (or its bare `deck`) -> a hifi.build deck dict."""
    generated = payload.get("deck", payload)

    spec = _spec_from(generated)
    chords = [(c["main"], c["sup"], c["subtitle"], list(c["fields"]),
               set(c["roots"])) for c in generated["chords"]]
    has_bottom = any(v[3] == "bottom" for k, v in spec.items() if k != "_geom")

    warnings = list(generated.get("warnings") or [])

    root = _hex_color(generated["colors"]["root"])
    tone = _hex_color(generated["colors"]["tone"])

    # NOT .get(): a missing or renamed `ext` used to fall back to 1.0, which
    # silently gave every deck R = 74.0 - on a bottom-shell pan that draws the
    # diagram over the header and off both edges of the card with nothing red.
    # A KeyError at the point of use is the right failure.
    ext = generated["geom"]["ext"]
    name = generated["name"]
    tops = [k for k in spec if k != "_geom" and spec[k][3] in ("rim", "inner")]
    bottoms = [k for k in spec if k != "_geom" and spec[k][3] == "bottom"]

    return dict(
        # --- identity and card copy -------------------------------------
        title="%s - Chord Cards" % name,
        name=name,
        sub=("%d + 1 TOP  /  %d BOTTOM" % (len(tops), len(bottoms))
             if has_bottom else "%d + 1" % len(tops)),
        credit=name.upper(),
        blurb=_blurb(spec, len(chords), warnings),
        legend_lines=_legend_lines(spec, has_bottom),
        legend_demo=_legend_demo(spec, chords),
        # --- data -------------------------------------------------------
        spec=spec,
        chords=chords,
        degrees={int(pc): label for pc, label in generated["degrees"].items()},
        has_bottom=has_bottom,
        # Carried, not dropped: the adapter is not where a warning goes to die.
        warnings=warnings,
        # --- geometry and baselines -------------------------------------
        R=round(_BAND_HALF / ext, 1),
        cy=_BAND_CY,
        y_note=_Y_NOTE,
        y_num=_Y_NUM,
        # --- palette (the two-tone split frame) -------------------------
        col_root=root,
        col_tone=tone,
        grad=(root, tone),
    )


if __name__ == "__main__":
    import os
    OUT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    n1 = hifi.build(os.path.join(OUT, "CSharp_Hijaz_Orion_9_Cards_Letter.pdf"), HIJAZ)
    n2 = hifi.build(os.path.join(OUT, "F3_Low_Pygmy_18_Cards_Letter.pdf"), PYGMY)
    n3 = hifi.build(os.path.join(OUT, "D_Amara_9_Cards_Letter.pdf"), AMARA)
    p1 = hifi.build(os.path.join(OUT, "CSharp_Hijaz_Orion_9_PRINTER_ONLY_Chords_Letter.pdf"),
                    HIJAZ, chords_only=True)
    p2 = hifi.build(os.path.join(OUT, "F3_Low_Pygmy_18_PRINTER_ONLY_Chords_Letter.pdf"),
                    PYGMY, chords_only=True)
    p3 = hifi.build(os.path.join(OUT, "D_Amara_9_PRINTER_ONLY_Chords_Letter.pdf"),
                    AMARA, chords_only=True)
    print("full:", n1, n2, n3, "| printer:", p1, p2, p3)
