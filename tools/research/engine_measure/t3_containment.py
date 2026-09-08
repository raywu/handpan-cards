"""Task 3: Lane A candidate sets. Legal voicing for a chord pc-set S: choose
exactly one non-ding field per pc in S (no doubled pcs, every pc present once,
any register). Power chords = 2 pcs -> 2 notes automatically."""
from itertools import product
from common import *  # noqa


def candidates(deck, pcs):
    P = playable(deck)
    per = [[k for k, v in P.items() if v[2] % 12 == p] for p in pcs]
    return [frozenset(c) for c in product(*per)], per


def main():
    sizes = []
    contained = 0
    n = 0
    for did, d, i, m, s, sub, fl, root in cards():
        n += 1
        pcs = sorted({pc(d, f) for f in fl})
        assert len(pcs) == len(fl), (did, m)  # no doubled pcs in the corpus
        cs, per = candidates(d, pcs)
        assert len(cs) == len(set(cs))
        sizes.append(len(cs))
        ok = frozenset(fl) in cs
        contained += ok
        if not ok:
            print("NOT CONTAINED", did, symbol(m, s), fl)
    print(f"contained: {contained}/{n}")
    print(f"candidate-set size: min={min(sizes)} median={median(sizes)} max={max(sizes)} total={sum(sizes)}")
    # per deck
    for did, d in DECKS:
        ss = [len(candidates(d, sorted({pc(d, f) for f in fl}))[0])
              for _, dd, i, m, s, sub, fl, root in cards() if dd is d]
        print(f"  {did}: n={len(ss)} min={min(ss)} median={median(ss)} max={max(ss)}")


if __name__ == "__main__":
    main()
