"""Task 4: chord-selection table for the D1 vocabulary.

distinct pc-sets derivable  = |{pc-set of (root, quality)}| over derivable pairs
root-instance x quality     = sum over derivable (root, quality) of # non-ding
                              root instances (bottom shell included)
shipped                     = deck size; shipped-in-vocab = shipped cards whose
                              interval set is a D1 quality
Also re-checks the plan's editorial claims (diminished 1 of 4, sus4 2 of 5,
Amara extended chords available, Hijaz F#5 omitted)."""
from common import *  # noqa

INV = {v: k for k, v in D1_QUALITIES.items()}


def main():
    print("vocabulary (D1):", list(D1_QUALITIES))
    print(f"{'deck':6} {'pairs':>5} {'pcsets':>6} {'root-inst x q':>13} {'shipped':>7} {'in-vocab':>8} {'shipped pairs':>13}")
    for did, d in DECKS:
        P = playable(d)
        scale = sorted({v[2] % 12 for v in P.values()})
        names = NAMES_FLAT if did in ("pygmy",) else NAMES_SHARP
        pairs, pcsets, ri = [], set(), 0
        for rp in scale:
            for qn, q in D1_QUALITIES.items():
                S = frozenset((rp + iv) % 12 for iv in q)
                if S <= set(scale):
                    pairs.append((rp, qn))
                    pcsets.add(S)
                    ri += sum(1 for v in P.values() if v[2] % 12 == rp)
        shipped = d["chords"]
        shipped_pairs = set()
        in_vocab = 0
        for m, s, sub, fl, roots in shipped:
            root = next(iter(roots))
            q = quality_of(d, fl, root)
            if q in INV:
                in_vocab += 1
                shipped_pairs.add((pc(d, root), INV[q]))
        print(f"{did:6} {len(pairs):5} {len(pcsets):6} {ri:13} {len(shipped):7} {in_vocab:8} {len(shipped_pairs):13}")
        missing = [(names[rp], qn) for rp, qn in pairs if (rp, qn) not in shipped_pairs]
        print("   derivable but not shipped:", missing)
        outside = [(m + s) for m, s, sub, fl, roots in shipped
                   if quality_of(d, fl, next(iter(roots))) not in INV]
        print("   shipped outside D1 vocab:", outside)
        by_q = {}
        for rp, qn in pairs:
            by_q.setdefault(qn, []).append(names[rp])
        sh_q = {}
        for rp, qn in shipped_pairs:
            sh_q.setdefault(qn, []).append(names[rp])
        for qn in D1_QUALITIES:
            if qn in by_q:
                print(f"   {qn:6} available {len(by_q[qn])} {by_q[qn]}  shipped {len(sh_q.get(qn, []))} {sh_q.get(qn, [])}")

    # plan's Amara extended-chord claim
    am = dict(DECKS)["amara"]
    scale = {v[2] % 12 for v in playable(am).values()}
    for name, root, ivs in [("Dm9", 2, (0, 3, 7, 10, 2)), ("Dm11", 2, (0, 3, 7, 10, 2, 5)),
                            ("C6/9", 0, (0, 4, 7, 9, 2)), ("Fmaj9", 5, (0, 4, 7, 11, 2))]:
        print("amara", name, "available:", {(root + i) % 12 for i in ivs} <= scale)


if __name__ == "__main__":
    main()
