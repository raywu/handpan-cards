"""Task 5: cards whose root is not the lowest sounding field."""
from common import *  # noqa


def main():
    out = []
    for did, d, i, m, s, sub, fl, root in cards():
        low = min(fl, key=lambda f: midi(d, f))
        if low != root:
            out.append(f"{did:6} #{i+1:2} {symbol(m, s):12} {fmt(d, fl)}  bass={label(d, low)} root={label(d, root)}")
    print(f"root not in bass: {len(out)}/59")
    for o in out:
        print("  ", o)


if __name__ == "__main__":
    main()
