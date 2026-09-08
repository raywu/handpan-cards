"""Task 7: the remaining numerical claims in the plan."""
import base64
import gzip
import json
import math
import re
from collections import Counter, defaultdict
from common import *  # noqa


def main():
    # --- geometry ceiling
    print("== geometry ceiling N_max = pi/asin(r_note/rim)")
    for did, d in DECKS:
        g = d["spec"]["_geom"]
        nmax = math.pi / math.asin(g["r_note"] / g["rim"])
        n_rim = sum(1 for v in playable(d).values() if v[3] == "rim")
        gap12 = 2 * g["rim"] * math.sin(math.pi / 12) - 2 * g["r_note"]
        print(f"  {did}: rim={g['rim']} r_note={g['r_note']} N_max={nmax:.2f} (rim fields now {n_rim});"
              f" gap at N=12 = {gap12:+.4f}R = {gap12*d['R']:+.2f}pt at R={d['R']}pt (ring stroke 0.65pt each)")
        if "r_bnote" in g and g.get("bottom"):
            nb = math.pi / math.asin(g["r_bnote"] / g["bottom"])
            print(f"     bottom ring: N_max={nb:.2f}")
        # ding clearance: rim - r_note vs r_ding (+ ding_dy)
        clear = g["rim"] - g["r_note"] - g["r_ding"]
        print(f"     ding-to-rim-field clearance {clear:.3f}R (ding_dy {g.get('ding_dy', 0)})")

    # --- voicing size, subtitle length
    print("\n== maxima")
    sizes = [(len(fl), did, symbol(m, s)) for did, d, i, m, s, sub, fl, r in cards()]
    print("  max voicing size:", max(sizes), " distribution:", Counter(x[0] for x in sizes))
    subs = sorted(((len(sub), did, sub) for did, d, i, m, s, sub, fl, r in cards()), reverse=True)
    print("  subtitle lengths top 5:", subs[:5])
    mains = sorted(((len(m + s), did, m + s) for did, d, i, m, s, sub, fl, r in cards()), reverse=True)
    print("  longest symbols:", mains[:3])

    # --- equivalence annotations
    print("\n== equivalence annotations")
    annotated = [(did, symbol(m, s), sub) for did, d, i, m, s, sub, fl, r in cards() if "( =" in sub]
    print("  annotated:", annotated)
    m7 = [(did, symbol(m, s)) for did, d, i, m, s, sub, fl, r in cards()
          if quality_of(d, fl, r) in ((0, 3, 7, 10), (0, 3, 6, 10))]
    print(f"  m7/m7b5 cards (= X6 / Xm6 eligible): {len(m7)} {m7}")
    sus = [(did, symbol(m, s)) for did, d, i, m, s, sub, fl, r in cards() if quality_of(d, fl, r) == (0, 5, 7)]
    print(f"  sus4 cards (= Xsus2 eligible under the plan's own sus2->sus4 collapse): {len(sus)} {sus}")
    sym = [(did, symbol(m, s)) for did, d, i, m, s, sub, fl, r in cards()
           if quality_of(d, fl, r) in ((0, 3, 6, 9), (0, 4, 8))]
    print(f"  symmetric (dim7/aug) cards: {len(sym)} {sym}")

    # --- alternates / duplicate pc-sets
    print("\n== alternates")
    for did, d in DECKS:
        groups = defaultdict(list)
        for m, s, sub, fl, roots in d["chords"]:
            groups[frozenset(pc(d, f) for f in fl)].append(m + s + " [" + sub + "]")
        dup = {k: v for k, v in groups.items() if len(v) > 1}
        for k, v in dup.items():
            print(f"  {did}: {v}")
    alt = [(did, symbol(m, s), sub) for did, d, i, m, s, sub, fl, r in cards() if is_alternate(sub)]
    print("  cards with HIGH/LOW VOICING subtitle:", len(alt))
    # by (main,sup)
    bysym = Counter((did, symbol(m, s)) for did, d, i, m, s, sub, fl, r in cards())
    multi = {k: v for k, v in bysym.items() if v > 1}
    print("  groups by symbol with >1 card:", multi, "cards:", sum(multi.values()))

    # --- "30 shipped chord types have more usable root instances than shipped cards"
    print("\n== chord types with more root instances than shipped cards")
    for excl_bottom in (False, True):
        total = 0
        detail = []
        for did, d in DECKS:
            cnt = Counter((symbol(m, s)) for m, s, sub, fl, roots in d["chords"])
            for m, s, sub, fl, roots in d["chords"]:
                if is_alternate(sub):
                    continue
                r = next(iter(roots))
                rp = pc(d, r)
                inst = [k for k, v in playable(d).items() if v[2] % 12 == rp
                        and not (excl_bottom and v[3] == "bottom")]
                if len(inst) > cnt[symbol(m, s)]:
                    total += 1
                    detail.append(f"{did}:{symbol(m, s)}({len(inst)}>{cnt[symbol(m, s)]})")
        print(f"  bottom instances {'excluded' if excl_bottom else 'included'}: {total}  {detail}")

    # --- root-octave claims from Premise 3
    print("\n== Premise 3 spot checks (Pygmy)")
    py = dict(DECKS)["pygmy"]
    for m, s, sub, fl, roots in py["chords"]:
        if m + s in ("Eb", "Eb7", "Cm7"):
            print(f"  {m+s} [{sub}] root {label(py, next(iter(roots)))} zone {py['spec'][next(iter(roots))][3]}")

    # --- encoding sizes
    print("\n== encoding sizes (index.html DECKS pygmy entry)")
    src = open("index.html", encoding="utf-8").read()
    line = re.search(r"^const DECKS = (\[.*\]);$", src, re.M).group(1)
    app = json.loads(line)
    for d in app:
        if d["id"] == "pygmy":
            for name, txt in (("as embedded (json.dumps default separators)", json.dumps(d)),
                              ("compact separators", json.dumps(d, separators=(",", ":"))),
                              ("compact, ensure_ascii=False", json.dumps(d, separators=(",", ":"), ensure_ascii=False))):
                raw = txt.encode("utf-8")
                gz = gzip.compress(raw, 9, mtime=0)
                b64 = base64.urlsafe_b64encode(gz).rstrip(b"=")
                print(f"  {name}: json={len(raw)} gzip={len(gz)} base64url={len(b64)}")
    # seed: notes as midi list
    seed = json.dumps({"n": [v[2] for v in playable(py).values()], "d": py["spec"][0][2], "s": "F3 Low Pygmy 18"}, separators=(",", ":"))
    print("  seed json:", len(seed), "bytes; base64url:", len(base64.urlsafe_b64encode(seed.encode()).rstrip(b"=")))

    # --- retrofit count
    print("\n== retrofit: see `git diff 9fc9af9~1 1345c30 -- tools/decks.py` (6 net voicing changes; 9fc9af9 changed 7, 8848bf5 reverted Dmaj7#11 and re-voiced Fm11)")

    # --- sandbox id whitelist count
    sb = open("tests/helpers/sandbox.js").read()
    ids = re.findall(r'"([a-zA-Z_-]+)"\s*:', sb)
    m_ = re.search(r"els\s*=\s*\{([^}]*)\}", sb, re.S)
    print("\n== sandbox.js element ids:", m_.group(1).strip()[:300] if m_ else "(pattern not found)")


if __name__ == "__main__":
    main()
