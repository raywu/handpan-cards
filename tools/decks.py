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
    ("C#", "", "C# DUR / C# MAJOR", [3, 5, 7], {3}),
    ("C#5", "", "POWER CHORD", [3, 7], {3}),
    ("C#sus", "4", "SUSPENDED CHORD", [3, 6, 7], {3}),
    ("C#", "7", "C# DOMINANT 7", [3, 5, 7, 8], {3}),
    ("C#7sus", "4", "SUSPENDED DOMINANT 7", [3, 6, 7, 8], {3}),
    ("C#7", "b9", "HIJAZ SIGNATURE CHORD", [3, 5, 7, 8, 4], {3}),
    ("Bm", "", "H MOLL / B MINOR", [2, 4, 6], {2}),
    ("Bm", "", "B MINOR - HIGH VOICING", [8, 4, 6], {8}),
    ("B5", "", "POWER CHORD", [2, 6], {2}),
    ("Bm", "add9", "H MOLL ADD 9 / B MINOR ADD 9", [2, 4, 6, 3], {2}),
    ("Bm", "6/9", "H MOLL 6/9 / B MINOR 6/9", [2, 4, 6, 7, 3], {2}),
    ("G#\u00b0", "", "VERMINDERT / DIMINISHED", [1, 2, 4], {1}),
    ("G#m7", "b5", "HALBVERMINDERT  ( = Bm6 )", [1, 2, 4, 6], {1}),
    ("F#sus", "4", "SUSPENDED CHORD", [6, 8, 3], {6}),
    ("F#maj7sus", "4", "SUSPENDED MAJOR 7", [6, 8, 3, 5], {6}),
    ("D\u00b0", "7", "VERMINDERT 7 / DIMINISHED 7", [4, 5, 7, 8], {4}),
    ("Dmaj", "7", "D DUR 7 / D MAJOR 7 (NO 5)", [4, 6, 3], {4}),
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
    ("Fm", "", "F MOLL / F MINOR", [5, 7, 8], {5}),
    ("F5", "", "POWER CHORD", [5, 8], {5}),
    ("Fsus", "4", "SUSPENDED CHORD", [5, 104, 8], {5}),
    ("Fm", "7", "F MOLL 7 / F MINOR 7", [5, 7, 8, 9], {5}),
    ("Fm", "9", "F MOLL 9 / F MINOR 9", [5, 7, 8, 9, 11], {5}),
    ("Fm", "11", "F MINOR 11 - FULL SCALE", [5, 7, 8, 9, 11, 104], {5}),
    ("Ab", "", "AS DUR / Ab MAJOR", [2, 3, 4], {2}),
    ("Ab", "", "Ab MAJOR - HIGH VOICING", [7, 8, 9], {7}),
    ("Abmaj", "7", "AS DUR 7 / Ab MAJOR 7", [2, 3, 4, 6], {2}),
    ("Abmaj", "9", "AS DUR 9 / Ab MAJOR 9", [2, 3, 4, 6, 104], {2}),
    ("Bbm", "", "B MOLL / Bb MINOR", [104, 105, 5], {104}),
    ("Bbm", "7", "B MOLL 7  ( = Db6 )", [104, 105, 5, 7], {104}),
    ("Cm", "", "C MINOR - LOW VOICING", [101, 103, 1], {101}),
    ("Cm", "", "C MOLL / C MINOR", [3, 4, 6], {3}),
    ("Cm", "", "C MINOR - HIGH VOICING", [8, 9, 11], {8}),
    ("C5", "", "POWER CHORD", [3, 6], {3}),
    ("Csus", "4", "SUSPENDED CHORD", [3, 5, 6], {3}),
    ("Cm", "7", "C MOLL 7 / C MINOR 7", [3, 4, 6, 104], {3}),
    ("Db", "", "DES DUR / Db MAJOR", [105, 5, 7], {105}),
    ("Dbmaj", "7", "DES DUR 7 / Db MAJOR 7", [105, 5, 7, 8], {105}),
    ("Eb", "", "Eb MAJOR - LOW VOICING", [103, 1, 104], {103}),
    ("Eb", "", "ES DUR / Eb MAJOR", [4, 6, 104], {4}),
    ("Eb", "7", "ES DUR 7 / Eb DOMINANT 7", [103, 1, 104, 105], {103}),
    ("G\u00b0", "", "VERMINDERT / DIMINISHED", [1, 104, 105], {1}),
    ("Gm7", "b5", "HALBVERMINDERT / HALF-DIM", [1, 104, 105, 5], {1}),
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
    ("Dm", "", "D MOLL / D MINOR", [3, 5, 7], {3}),
    ("Dm", "7", "D MOLL 7 / D MINOR 7", [3, 5, 7, 8], {3}),
    ("D5", "", "POWER CHORD", [3, 7], {3}),
    ("Dsus", "4", "SUSPENDED CHORD", [3, 6, 7], {3}),
    ("Am", "", "A MOLL / A MINOR", [1, 2, 4], {1}),
    ("Am", "7", "A MOLL 7 / A MINOR 7", [1, 2, 4, 6], {1}),
    ("A5", "", "POWER CHORD", [1, 4], {1}),
    ("Asus", "4", "SUSPENDED CHORD", [1, 3, 4], {1}),
    ("G5", "", "POWER CHORD", [6, 3], {6}),
    ("Gsus", "4", "SUSPENDED CHORD", [6, 2, 3], {6}),
    ("C", "", "C DUR / C MAJOR", [2, 4, 6], {2}),
    ("C5", "", "POWER CHORD", [2, 6], {2}),
    ("Csus", "4", "SUSPENDED CHORD", [2, 5, 6], {2}),
    ("F", "", "F DUR / F MAJOR", [5, 7, 8], {5}),
    ("F5", "", "POWER CHORD", [5, 8], {5}),
    ("Fmaj", "7", "F DUR 7 / F MAJOR 7", [5, 1, 2, 4], {5}),
]

AMARA = dict(
    title="D Amara 9 - Chord Cards",
    name="D AMARA 9", sub="8 + 1", credit="D AMARA / D MINOR",
    spec=AMARA_SPEC, chords=AMARA_CHORDS, R=73.0, cy=126.0,
    y_note=30.0, y_num=14.0, has_bottom=False,
    legend_demo=(5, 3),
    degrees={2: "i", 9: "v", 7: "IV", 0: "bVII", 5: "bIII"},
    blurb=["D3  |  A3  C4  D4  E4  F4  G4  A4  C5",
           "16 CHORDS - ONE CARD PER CHORD"],
    legend_lines=["NOTE NAME + OCTAVE INSIDE EACH TONEFIELD",
                  "TONEFIELD NUMBERS RUN 1 - 8 FROM THE LOWEST NOTE"],
)

if __name__ == "__main__":
    n1 = hifi.build("/home/claude/out/CSharp_Hijaz_Orion_9_Cards_Letter.pdf", HIJAZ)
    n2 = hifi.build("/home/claude/out/F3_Low_Pygmy_18_Cards_Letter.pdf", PYGMY)
    p1 = hifi.build("/home/claude/out/CSharp_Hijaz_Orion_9_PRINTER_ONLY_Chords_Letter.pdf",
                    HIJAZ, chords_only=True)
    p2 = hifi.build("/home/claude/out/F3_Low_Pygmy_18_PRINTER_ONLY_Chords_Letter.pdf",
                    PYGMY, chords_only=True)
    p3 = hifi.build("/home/claude/out/D_Amara_9_PRINTER_ONLY_Chords_Letter.pdf",
                    AMARA, chords_only=True)
    print("full:", n1, n2, "| printer:", p1, p2, p3)
