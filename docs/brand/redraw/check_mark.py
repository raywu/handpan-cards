"""Check the generated mark against the brand board (plan step 9).

python3 docs/brand/redraw/check_mark.py [OUTDIR]
Renders make_logo's full mark in board pixels, runs the harness, and exits 1
unless: worst landmark error <= 2% of W, bright-stroke F1 >= 0.92,
pan F1 >= 0.93, rings F1 >= 0.75. Needs numpy, scipy, Pillow, fonttools and
the preinstalled Playwright.
"""
import json, os, sys, tempfile
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, ".."))
import landmarks as LM
import harness
import make_logo as ML

LIMITS = {"landmark_worst_pct_W": 2.0, "bright": 0.92, "pan": 0.93, "rings": 0.75}
G = ML.G
k = LM.W / 100.0


def board(p):
    return [LM.ORIGIN[0] + p[0] * k, LM.ORIGIN[1] + p[1] * k]


def bez_samples(name, n=200):
    p = np.array(G[name], float)
    out = []
    for seg in (p[0:4], p[3:7]):
        t = np.linspace(0, 1, n)[:, None]
        out.extend((1 - t) ** 3 * seg[0] + 3 * (1 - t) ** 2 * t * seg[1] + 3 * (1 - t) * t * t * seg[2] + t ** 3 * seg[3])
    return [board(q) for q in out]


def landmarks():
    dome, rim, shell = bez_samples("dome"), bez_samples("rim"), bez_samples("shell")
    at = lambda pts, x: min(pts, key=lambda q: abs(q[0] - x))
    ox, oy, a, b, tilt = G["orbit"]
    return {"lens_left": board(G["lens"][0]), "lens_right": board(G["lens"][1]),
            "dome_top": min(dome, key=lambda q: q[1]), "ding_centre": board(G["ding"][:2]),
            "rim_front_low": max(rim, key=lambda q: q[1]), "rim_front_x600": at(rim, 600),
            "shell_low": max(shell, key=lambda q: q[1]), "shell_x600": at(shell, 600), "shell_x620": at(shell, 620),
            "teal_dot": board(G["teal_dot"][:2]), "gold_dot": board(G["gold_dot"][:2]),
            "orbit_centre": board((ox, oy)), "orbit_a": a * k, "orbit_b": b * k, "orbit_tilt_deg": tilt}


def main(out):
    os.makedirs(out, exist_ok=True)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="520 125 320 210" width="320" height="210">'
           f'<g transform="translate({LM.ORIGIN[0]} {LM.ORIGIN[1]}) scale({k:.6f})">{ML.mark("full", "c")}</g></svg>\n')
    sp, lp = os.path.join(out, "generated.svg"), os.path.join(out, "generated_landmarks.json")
    open(sp, "w").write(svg)
    json.dump(landmarks(), open(lp, "w"), indent=1, default=float)
    harness.main("generated", sp, lp, out)
    m = json.load(open(os.path.join(out, "generated-metrics.json")))
    got = {"landmark_worst_pct_W": m["landmark_worst_pct_W"], "bright": m["bright_strokes_PRF"][2],
           "pan": m["pan_PRF"][2], "rings": m["rings_PRF"][2]}
    bad = [f"{n} {got[n]:.3f} (limit {lim})" for n, lim in LIMITS.items()
           if (got[n] > lim if n.startswith("landmark") else got[n] < lim)]
    print("CHECK", "FAIL: " + "; ".join(bad) if bad else "PASS", {n: round(v, 3) for n, v in got.items()})
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix="markcheck-")))
