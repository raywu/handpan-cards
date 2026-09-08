"""Task 1: does the D2 cluster rule (CLAUDE.md rule 3) reproduce the curated
field list given only (root field, spelling order of pitch classes, symbol)?

Two readings are scored:
  STRICT   - a fully deterministic derivation: free (unforced / stays-put)
             tones take their NEAREST instance above the root.
  PERMITTED- the rule as literally worded, where a free tone's register is
             "otherwise free": the curated field must lie in the permitted set.
"""
from common import *  # noqa


def derive(deck, root, order_pcs, ext):
    """Return per-tone (strict_choice, permitted_set) in spelling order."""
    rm = midi(deck, root)
    P = playable(deck)

    def inst(p, below):
        return sorted((v[2], k) for k, v in P.items()
                      if v[2] % 12 == p and ((v[2] < rm) if below else (v[2] > rm)))

    forced = any(not inst(p, False) for p in order_pcs)
    out = []
    for p in order_pcs:
        lower, upper = inst(p, True), inst(p, False)
        if not forced:
            # every non-root tone above the root, register free
            strict = upper[0][1]
            perm = {k for _, k in upper}
        else:
            interval = (p - (rm % 12)) % 12
            if interval in ext:
                if upper:
                    strict, perm = upper[0][1], {upper[0][1]}
                else:
                    strict, perm = lower[-1][1], {lower[-1][1]}
            elif lower:
                strict, perm = lower[-1][1], {lower[-1][1]}
            else:  # no lower instance: "stays put" -> above the root, free
                strict, perm = upper[0][1], {k for _, k in upper}
        out.append((strict, perm))
    return forced, out


def main():
    n_strict = n_perm = n = 0
    div_strict, div_perm = [], []
    forced_cards = []
    for did, d, i, m, s, sub, fl, root in cards():
        n += 1
        ext = extension_intervals(symbol(m, s))
        others = [f for f in fl if f != root]
        order_pcs = [pc(d, f) for f in others]
        forced, out = derive(d, root, order_pcs, ext)
        strict = [root] + [c for c, _ in out]
        # root keeps its position in spelling order (always first in the corpus)
        assert fl[0] == root, (did, m, fl)
        ok_strict = strict == fl
        ok_perm = all(f in perm for f, (_, perm) in zip(others, out))
        n_strict += ok_strict
        n_perm += ok_perm
        if forced:
            forced_cards.append(f"{did} {symbol(m, s)}")
        if not ok_strict:
            div_strict.append((did, symbol(m, s), sub, forced, fmt(d, fl), fmt(d, strict), ok_perm))
        if not ok_perm:
            div_perm.append((did, symbol(m, s), sub, fmt(d, fl), fmt(d, strict)))
    print(f"cards: {n}")
    print(f"STRICT (nearest-above for free tones) reproduces: {n_strict}/{n}")
    print(f"PERMITTED (rule as worded, free register) contains curated: {n_perm}/{n}")
    print(f"forced cards ({len(forced_cards)}): {forced_cards}")
    print("\nSTRICT divergences (deck, symbol, subtitle, forced?, curated, derived, permitted?):")
    for row in div_strict:
        print("  ", row)
    print("\nPERMITTED divergences:")
    for row in div_perm:
        print("  ", row)


if __name__ == "__main__":
    main()
