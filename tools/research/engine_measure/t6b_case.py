"""Task 6b: case rule via DIATONIC stacked thirds in an ordered 7-note parent
scale (degree n triad = degrees n, n+2, n+4), versus pan-only inputs."""
from common import *  # noqa

# parent scales as ordered interval lists from the tonic
PARENTS = {
    "hijaz": {"Phrygian dominant": [0, 1, 4, 5, 7, 8, 10],
              "Double harmonic": [0, 1, 4, 5, 7, 8, 11]},
    "pygmy": {"Aeolian": [0, 2, 3, 5, 7, 8, 10]},
    "amara": {"Aeolian (credit says D MINOR)": [0, 2, 3, 5, 7, 8, 10],
              "Dorian": [0, 2, 3, 5, 7, 9, 10]},
}


def diatonic_case(parent, iv):
    if iv not in parent:
        return None
    n = parent.index(iv)
    third = (parent[(n + 2) % 7] - iv) % 12
    fifth = (parent[(n + 4) % 7] - iv) % 12
    if third == 3 and fifth == 6:
        return "lower°"
    if third == 3:
        return "lower"
    if third == 4 and fifth == 8:
        return "upper+"
    if third == 4:
        return "upper"
    return f"?({third},{fifth})"


def curated_case(lab):
    body = lab.lstrip("b")
    c = "lower" if body.rstrip("°").islower() else "upper"
    return c + ("°" if "°" in lab else "")


def main():
    for did, d in DECKS:
        tonic = d["spec"][0][2] % 12
        pan = {(v[2] % 12 - tonic) % 12 for v in playable(d).values()}
        print(f"\n== {did}")
        for pname, parent in PARENTS[did].items():
            hits = 0
            rows = []
            for rp, lab in sorted(d["degrees"].items()):
                iv = (rp - tonic) % 12
                want = curated_case(lab)
                got = diatonic_case(parent, iv)
                ok = got == want
                hits += ok
                rows.append(f"{NAMES_SHARP[rp]}:{lab}->{got}{'' if ok else ' MISMATCH'}")
            print(f"  parent {pname}: {hits}/{len(rows)}  ", rows)
        # pan-only: thirds actually present on the pan
        rows = []
        for rp, lab in sorted(d["degrees"].items()):
            iv = (rp - tonic) % 12
            m3, M3 = (iv + 3) % 12 in pan, (iv + 4) % 12 in pan
            p5, d5 = (iv + 7) % 12 in pan, (iv + 6) % 12 in pan
            rows.append(f"{NAMES_SHARP[rp]}:{lab} m3={int(m3)} M3={int(M3)} P5={int(p5)} d5={int(d5)}")
        print("  pan-only features:", rows)


if __name__ == "__main__":
    main()
