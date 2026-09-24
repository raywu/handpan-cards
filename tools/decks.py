#!/usr/bin/env python3
import json
import os
import re

import hifi
from reportlab.lib.colors import Color

# ================================================== GENERATED DECKS (ADAPTER)
# `tools/gen_deck.js` turns a scale seed into the generated deck object of
# ENGINE-SPEC section 11.  The engine knows about fields, chords, degrees and
# colours; the print pipeline needs a dozen more per-deck keys it has never
# heard of.  from_generated() synthesises them.
#
# ADDITIVE ONLY: the three built-in decks come out of _from_canonical() below
# and must stay byte-identical, which tests/fixtures/print_decks_v1.json pins
# and tools/validate.py check 1b re-asserts against data/decks.json.
#
# Every key a built-in deck dict carries is either produced here or named in
# GENERATED_OMITTED with a reason; tests/test_gen_deck.py reads the key set off
# the built-ins at RUNTIME, so a key added to an overlay later fails that test
# instead of slipping through.

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
# never reaches: for EACH seed its best rim term loses to that seed's winning
# bottom-shell number term, so it contributes NOTHING to `ext` for either.  The
# margin is a fraction of the WINNING TERM, not of R:
#
#   S_PYGMY  rim+num 0.98484 vs 1.402040  ->  0.41720 R behind = 29.8% of it
#   S_NOSEP  rim     0.92330 vs 1.416670  ->  0.49337 R behind = 34.8% of it
#
# (an earlier revision called this "a third of R" and quoted only S_NOSEP's
# 0.9233 while concluding "for either seed" - both wrong: neither margin is a
# third OF R, and the two seeds do not share a rim term.)  The entire
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
# band a generated deck CAN produce.  That band is [1.0600, 1.48192], derived -
# not swept - from the formula's own limits: `reach >= 1` (the shell circle is
# unconditional) puts the floor at `1 + EXT_PAD`, and every term in the max is
# capped, so the ceiling is the bottom-shell number term at its caps,
# BOTTOM_ORB 1.15 + R_BNOTE_MAX 0.1188 + N_OUT 0.068 + 0.7 * 0.64 * R_NOTE_MAX
# 0.19 + EXT_PAD 0.06 = 1.48192 (an upper bound; no seed need attain it).
# Swept at 1e-4 steps over THAT band: min 73.9267 at ext 1.4668 (R 50.4), max
# 74.0729 at ext 1.4697 (R 50.4).  An earlier revision quoted its witnesses from
# a looser [1.0, 1.5] sweep and so named ext 1.4995 and 1.4904, both of which
# are ABOVE 1.48192 and unproducible; the 73.93 .. 74.07 bounds are unchanged by
# the correction, so nothing downstream of them moved.  Hence ~ 74.0 for any
# seed,
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
# One consequence worth knowing before trusting the band constants, stated with
# its FULL precondition (an earlier revision of this note dropped half of it and
# was simply false): for a top-only deck WITH NO INNER SHELL - the S_HIJAZ shape
# this was measured on - `ext` is exactly 1.06, because the shell circle wins
# outright and `EXT_PAD` is all that is added to it.  R is then the constant
# 69.8.  The precondition is NOT just "top-only": `rimNumOut = hasInner`
# (`src/engine/layout.js:284`), so an inner shell switches the rim NUMBER term
# on, and that term can beat the shell circle with no bottom shell anywhere.
# Worked counterexample, generated 2026-09-09 with `tools/gen_deck.js`:
#
#   (D3) A3 C4 D4 E4 F4 G4 / A4 C5   <- top-only, but HAS an inner shell
#     rim + r_note + n_in + f_num*0.7
#       = 0.722 + 0.1684 + 0.052 + 0.7 * 0.1078 = 1.0179  > 1.0 (shell)
#     ext = 1.0179 + 0.06 = 1.0779   ->  R = round(74 / 1.0779, 1) = 68.7
#
# So the formula already adapts on top-only decks; a bottom shell is only the
# LARGEST source of adaptation, not the first one.
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


# =================================================== BUILT-IN DECKS (ADAPTER)
# The three shipped decks are data/decks.json + a hand-authored PRINT OVERLAY.
# data/decks.json is the SOURCE; index.html's `const DECKS` line is its
# generated copy (tools/sync_decks.py), and validate.py check 1b asserts what
# comes out here still equals the canonical data.

_CANONICAL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "decks.json")


def _canonical():
    """data/decks.json, keyed by deck id. Read once at import."""
    with open(_CANONICAL_PATH, encoding="utf-8") as fh:
        return {d["id"]: d for d in json.load(fh)}


_CANONICAL = _canonical()


def _overlay_from_print(print_data):
    """The `print` key of a canonical deck -> the hifi overlay kwargs.

    R/cy/y_note/y_num/legend_demo/blank_cards/title/credit/blurb/
    legend_lines pass through unchanged; the three colour fields are
    [r, g, b] lists in data/decks.json (JSON has no Color type) and are
    turned into reportlab Colors here, at the one point that needs them.
    """
    overlay = dict(print_data)
    overlay["legend_demo"] = tuple(overlay["legend_demo"])
    overlay["col_root"] = Color(*overlay["col_root"])
    overlay["col_tone"] = Color(*overlay["col_tone"])
    overlay["grad"] = tuple(Color(*rgb) for rgb in overlay["grad"])
    return overlay


def _from_canonical(deck_id, **extra_overlay):
    """A canonical deck (including its `print` key) -> a hifi deck dict.

    The `print` key carries only what the shared data does not and CANNOT:
    the measured R/cy baselines, the rounded colour literals, the
    hand-written title-card copy, and Pygmy's blank-card padding preference.
    It may not name a key the canonical data already owns - the clash guard
    below raises, and validate.py check 1b asserts the result end to end.
    `**extra_overlay` exists only so callers (tests included) can layer an
    override on top of `print` for a single call; none of HIJAZ/PYGMY/AMARA
    below pass any.

    NOT from_generated(): that one derives R from geom["ext"], which no
    built-in geom carries, and which would redraw every diagram (see the
    measured deltas below - Hijaz 73.0 -> 69.8).

    The COLOURS come from `print` too, as the committed three-decimal
    literals. _hex_color("#E0559A") returns 0.878431..., not 0.878; the two
    representations agree only one way, through validate.py's hexc() rounding,
    so re-deriving them here would move every printed colour by a fraction.
    """
    deck = _CANONICAL[deck_id]
    spec = _spec_from(deck)
    chords = [(c["main"], c["sup"], c["subtitle"], list(c["fields"]),
               set(c["roots"])) for c in deck["chords"]]
    shared = dict(
        name=deck["name"],
        sub=deck["sub"],
        spec=spec,
        chords=chords,
        degrees={int(pc): label for pc, label in deck["degrees"].items()},
        has_bottom=any(v[3] == "bottom"
                       for k, v in spec.items() if k != "_geom"),
    )
    overlay = _overlay_from_print(deck["print"])
    overlay.update(extra_overlay)
    clash = sorted(set(shared) & set(overlay))
    if clash:
        raise ValueError("%s: print overlay shadows canonical data: %s"
                         % (deck_id, ", ".join(clash)))
    shared.update(overlay)
    if "blurb" in shared:
        # The chord count in the blurb's last line is DERIVED from the
        # deck's own chord list, not hand-typed - a hand-typed literal goes
        # stale the moment a chord is added or removed (Pygmy shipped
        # "25 CHORDS" after it grew to 27).
        lines = list(shared["blurb"])
        lines[-1] = re.sub(r"\d+(?=\s*CHORDS)", str(len(chords)), lines[-1])
        shared["blurb"] = lines
    return shared


HIJAZ = _from_canonical("hijaz")
PYGMY = _from_canonical("pygmy")
AMARA = _from_canonical("amara")


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
