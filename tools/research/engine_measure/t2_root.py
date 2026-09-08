"""Task 2: root-FIELD policies given only (root pc, quality = interval set).

Scored two ways: over all 59 cards, and over the 54 primary cards (the five
HIGH/LOW VOICING alternates are excluded, because one (pc, quality) input can
only ever yield one root field)."""
from common import *  # noqa


def root_instances(deck, rp):
    return sorted((v[2], k) for k, v in playable(deck).items() if v[2] % 12 == rp)


def top_instances(deck, rp):
    return [(m, k) for m, k in root_instances(deck, rp) if deck["spec"][k][3] != "bottom"]


def unforced(deck, rm, rp, quality):
    P = playable(deck)
    for iv in quality:
        if iv == 0:
            continue
        p = (rp + iv) % 12
        if not any(v[2] % 12 == p and v[2] > rm for v in P.values()):
            return False
    return True


def tones_above(deck, rm, rp, quality):
    P = playable(deck)
    return sum(1 for iv in quality if iv and any(
        v[2] % 12 == (rp + iv) % 12 and v[2] > rm for v in P.values()))


POLICIES = {}


def policy(name):
    def deco(fn):
        POLICIES[name] = fn
        return fn
    return deco


@policy("lowest instance")
def p_lowest(deck, rp, q):
    return root_instances(deck, rp)[0][1]


@policy("lowest top-shell instance")
def p_lowest_top(deck, rp, q):
    t = top_instances(deck, rp)
    return t[0][1] if t else root_instances(deck, rp)[0][1]


@policy("highest instance")
def p_highest(deck, rp, q):
    return root_instances(deck, rp)[-1][1]


@policy("lowest unforced, else lowest")
def p_unforced(deck, rp, q):
    for m, k in root_instances(deck, rp):
        if unforced(deck, m, rp, q):
            return k
    return root_instances(deck, rp)[0][1]


@policy("lowest unforced TOP-SHELL, else lowest top-shell, else lowest")
def p_unforced_top(deck, rp, q):
    for m, k in top_instances(deck, rp):
        if unforced(deck, m, rp, q):
            return k
    return p_lowest_top(deck, rp, q)


@policy("most chord tones above (tie: lowest)")
def p_most_above(deck, rp, q):
    best = max(tones_above(deck, m, rp, q) for m, k in root_instances(deck, rp))
    for m, k in root_instances(deck, rp):
        if tones_above(deck, m, rp, q) == best:
            return k


@policy("most chord tones above (tie: highest)")
def p_most_above_hi(deck, rp, q):
    best = max(tones_above(deck, m, rp, q) for m, k in root_instances(deck, rp))
    for m, k in reversed(root_instances(deck, rp)):
        if tones_above(deck, m, rp, q) == best:
            return k


@policy("most chord tones above, top-shell only (tie: lowest)")
def p_most_above_top(deck, rp, q):
    t = top_instances(deck, rp) or root_instances(deck, rp)
    best = max(tones_above(deck, m, rp, q) for m, k in t)
    for m, k in t:
        if tones_above(deck, m, rp, q) == best:
            return k


def main():
    rows = list(cards())
    for name, fn in POLICIES.items():
        hit_all = hit_prim = n_prim = 0
        fails = []
        for did, d, i, m, s, sub, fl, root in rows:
            rp = pc(d, root)
            q = quality_of(d, fl, root)
            got = fn(d, rp, q)
            ok = got == root
            hit_all += ok
            prim = not is_alternate(sub)
            n_prim += prim
            hit_prim += ok and prim
            if not ok and prim:
                fails.append(f"{did} {symbol(m, s)} [{sub}] curated={label(d, root)} got={label(d, got)}")
        print(f"\n== {name}: {hit_all}/{len(rows)} all cards; {hit_prim}/{n_prim} primary cards")
        for f in fails:
            print("   FAIL", f)


if __name__ == "__main__":
    main()
