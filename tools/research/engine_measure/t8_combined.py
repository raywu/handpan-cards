"""Re-measure the plan's headline: 'N fully automatic / N with root supplied /
N unreachable', post-retrofit, for the D2 rule combined with each root policy.
Also: how many cards does the rule fully DETERMINE (singleton permitted set)?
Also: an ad-hoc 3-clause root policy fitted to the three residual failures."""
from common import *  # noqa
from t1_cluster import derive
from t2_root import POLICIES, root_instances, top_instances, unforced, p_lowest_top


def forced_count(deck, rm, rp, quality):
    P = playable(deck)
    n = 0
    for iv in quality:
        if iv == 0:
            continue
        p = (rp + iv) % 12
        if not any(v[2] % 12 == p and v[2] > rm for v in P.values()):
            n += 1
    return n


def p_fitted(deck, rp, q):
    """(1) lowest top-shell root; (2) if none, HIGHEST bottom instance;
    (3) if the top-shell root leaves >=2 chord tones forced and an unforced
    instance exists, lowest unforced. Fitted to Db/Dbmaj7/Eb7 - see report."""
    t = top_instances(deck, rp)
    if not t:
        return root_instances(deck, rp)[-1][1]
    m, k = t[0]
    if forced_count(deck, m, rp, q) >= 2:
        for m2, k2 in root_instances(deck, rp):
            if unforced(deck, m2, rp, q):
                return k2
    return k


def main():
    rows = list(cards())
    # determinism of the rule
    det = 0
    multi = []
    for did, d, i, m, s, sub, fl, root in rows:
        ext = extension_intervals(symbol(m, s))
        others = [f for f in fl if f != root]
        forced, out = derive(d, root, [pc(d, f) for f in others], ext)
        n_perm = 1
        for _, perm in out:
            n_perm *= len(perm)
        if n_perm == 1:
            det += 1
        else:
            multi.append((did, symbol(m, s), n_perm))
    print(f"rule fully determines the voicing (given root field): {det}/59; under-determined: {multi}")

    pols = dict(POLICIES)
    pols["FITTED 3-clause (ad hoc)"] = p_fitted
    for name, fn in pols.items():
        auto = root_ok = rule_ok = 0
        fails_root, fails_rule = [], []
        for did, d, i, m, s, sub, fl, root in rows:
            rp = pc(d, root)
            q = quality_of(d, fl, root)
            ext = extension_intervals(symbol(m, s))
            others = [f for f in fl if f != root]
            forced, out = derive(d, root, [pc(d, f) for f in others], ext)
            strict = [root] + [c for c, _ in out]
            r_ok = fn(d, rp, q) == root
            v_ok = strict == fl
            root_ok += r_ok
            rule_ok += v_ok
            auto += r_ok and v_ok
            if not r_ok:
                fails_root.append(f"{did} {symbol(m, s)}{'*' if is_alternate(sub) else ''}")
            if not v_ok:
                fails_rule.append(f"{did} {symbol(m, s)}")
        n_fail = 59 - auto
        print(f"\n{name}: fully automatic {auto}/59; root supplied -> {rule_ok}/59 strict, 59/59 permitted;"
              f" failures {n_fail} of which root-octave {len(fails_root)} (* = HIGH/LOW alternate)")
        print("   root failures:", fails_root)
        print("   rule failures:", fails_rule)


if __name__ == "__main__":
    main()
