"""Task 6: degree convention D8 (numerals) and the undefined case rule."""
from common import *  # noqa

MINOR_REL = {0: "I", 2: "II", 3: "III", 5: "IV", 7: "V", 8: "VI", 10: "VII",
             1: "bII", 4: "#III", 6: "bV", 9: "#VI", 11: "#VII"}
MAJOR_REL = {0: "I", 2: "II", 4: "III", 5: "IV", 7: "V", 9: "VI", 11: "VII",
             1: "bII", 3: "bIII", 6: "bV", 8: "bVI", 10: "bVII"}

# Parent (7-note) scales as the decks name them.
PARENTS = {
    "hijaz": ("Phrygian dominant (CLAUDE.md blurb: 'PHRYGIAN DOMINANT, NO b6')", {0, 1, 4, 5, 7, 8, 10}),
    "pygmy": ("F Aeolian (credit)", {0, 2, 3, 5, 7, 8, 10}),
    "amara": ("D natural minor (credit: 'D MINOR')", {0, 2, 3, 5, 7, 8, 10}),
    "amara-dorian": ("D Dorian", {0, 2, 3, 5, 7, 9, 10}),
}


def numeral_rule(scale_iv, tonic_iv):
    minor_third = 3 in scale_iv
    return (MINOR_REL if minor_third else MAJOR_REL)[tonic_iv]


def triad_case(root_iv, avail):
    """Case + diminished mark from the triad available on `avail` (a set of
    intervals from the tonic). Returns (case, mark) or None if no third."""
    third_m = (root_iv + 3) % 12 in avail
    third_M = (root_iv + 4) % 12 in avail
    fifth = (root_iv + 7) % 12 in avail
    dim5 = (root_iv + 6) % 12 in avail
    if third_m and not third_M:
        return ("lower", "°" if (dim5 and not fifth) else "")
    if third_M and not third_m:
        return ("upper", "")
    if third_M and third_m:
        return ("both", "")
    return None


def main():
    for did, d in DECKS:
        tonic = d["spec"][0][2] % 12
        scale_iv = {(v[2] % 12 - tonic) % 12 for v in playable(d).values()}
        print(f"\n== {did}: tonic pc {tonic}, scale intervals {sorted(scale_iv)}, minor third present: {3 in scale_iv}")
        for rp, lab in sorted(d["degrees"].items()):
            iv = (rp - tonic) % 12
            num = numeral_rule(scale_iv, iv)
            body = lab.replace("°", "")
            num_ok = num.upper() == body.upper()
            # case from pan notes only
            tc = triad_case(iv, scale_iv)
            want_case = "lower" if body.islower() or body[1:].islower() and body[0] == "b" else "upper"
            if body.startswith("b"):
                want_case = "lower" if body[1:].islower() else "upper"
            pan_case = tc[0] if tc else "UNDEFINED(no third)"
            mark_ok = (tc[1] if tc else "") == ("°" if "°" in lab else "")
            print(f"  {NAMES_SHARP[rp]:2} +{iv:2}  curated {lab:5} D8-numeral {num:5} {'OK' if num_ok else 'MISMATCH'}"
                  f"  case: curated={want_case} pan-triad={pan_case}{'' if pan_case==want_case else ' <-'}"
                  f"  dim-mark {'OK' if mark_ok else 'MISMATCH'}")
        # case from parent scale
        for key in ([did] if did != "amara" else ["amara", "amara-dorian"]):
            pname, parent = PARENTS[key]
            res = []
            for rp, lab in sorted(d["degrees"].items()):
                iv = (rp - tonic) % 12
                body = lab.replace("°", "")
                want = "lower" if body.lstrip("b").islower() else "upper"
                tc = triad_case(iv, parent)
                got = tc[0] if tc else None
                res.append((NAMES_SHARP[rp], want, got, "" if got == want else "<-"))
            print(f"  parent {pname}: ", res)


if __name__ == "__main__":
    main()
