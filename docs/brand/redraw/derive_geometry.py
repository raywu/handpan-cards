"""Print the GEOMETRY table that docs/brand/make_logo.py embeds.

Units: U, where 100 U = W (half the distance between the rim's lens points);
origin = the lens midpoint; y down. Sources: landmarks.py (measured),
evidence/fits.json (the fitted pan curves), ring_profiles.json (ring brightness).
Run: python3 docs/brand/redraw/derive_geometry.py
"""
import json, os, re
import numpy as np
import landmarks as LM

HERE = os.path.dirname(os.path.abspath(__file__))
M = LM.M
k = 100.0 / LM.W


def u(p):
    return [round((p[0] - LM.ORIGIN[0]) * k, 2), round((p[1] - LM.ORIGIN[1]) * k, 2)]


def s(v):
    return round(v * k, 2)


fits = json.load(open(os.path.join(HERE, "evidence", "fits.json")))["B_svg_paths"]
curves = {}
for name, d in fits.items():
    nums = [float(v) for v in re.findall(r"-?\d+\.?\d*", d)]
    pts = [u((nums[i], nums[i + 1])) for i in range(0, len(nums), 2)]
    curves[name] = pts            # M p0 C p1 p2 p3 C p4 p5 p6

# ring lobes: contiguous bright stretches of the smoothed measured profile
prof = json.load(open(os.path.join(HERE, "ring_profiles.json")))
lobes = []
for ring in ("inner", "middle", "outer"):
    p = prof[ring]
    vals = np.array([q if q is not None else [np.nan] * 3 for q in p], float)
    for i in range(72):
        if np.isnan(vals[i, 0]):
            nb = [vals[(i + d) % 72] for d in range(-6, 7) if not np.isnan(vals[(i + d) % 72, 0])]
            vals[i] = np.mean(nb, 0) if nb else 0
    sm = (np.roll(vals, 2, 0) + 2 * np.roll(vals, 1, 0) + 3 * vals + 2 * np.roll(vals, -1, 0) + np.roll(vals, -2, 0)) / 9
    bright = sm.sum(1) / 560.0
    on = bright > 0.12
    start = int(np.argmin(on))
    runs, cur = [], []
    for j in range(72):
        i = (start + j) % 72
        if on[i]:
            cur.append(i)
        elif cur:
            runs.append(cur); cur = []
    if cur:
        runs.append(cur)
    for run in runs:
        if len(run) < 3:
            continue
        a0, a1 = run[0] * 5 - 5, run[0] * 5 + len(run) * 5
        stops = []
        for f in (0, .2, .4, .6, .8, 1):
            ang = a0 + (a1 - a0) * f
            i = int(round(ang / 5)) % 72
            r, g, b = sm[i]
            op = 0 if f in (0, 1) else min(1.0, float(bright[i]))
            warm = float(np.clip((r - b) / max(r + b, 1) * 2.2 + 0.5, 0, 1))
            stops.append([round(ang, 1), round(warm, 2), round(op, 2)])
        lobes.append([ring, a0, a1, stops])

ring = {n: [*u(M["ring_" + n][:2]), s(M["ring_" + n][2]), s(M["ring_" + n][3])] for n in ("inner", "middle", "outer")}
G = {
    "lens": [u(LM.LENS_L), u(LM.LENS_R)],
    "dome": curves["dome"], "rim": curves["rim"], "shell": curves["shell"],
    "ding": [*u(M["ding_centre"]), s(M["ding_rx"]), s(M["ding_ry"])],
    "fields": [[*u(c), s(rx), s(ry), rot] for c, (rx, ry, rot) in
               zip(M["fields"], [(7, 4.2, -32), (7, 6, -14), (7.6, 7.8, 0), (7, 6, 14), (7, 4.2, 32)])],
    "orbit": [*u(M["orbit_centre"]), s(M["orbit_a"]), s(M["orbit_b"]), M["orbit_tilt_deg"]],
    "teal_dot": [*u(M["teal_dot"]), s(M["teal_r"])],
    "gold_dot": [*u(M["gold_dot"]), s(M["gold_r"])],
    "rings": ring, "ring_tilt": M["ring_tilt_deg"], "ring_width": {"inner": 1.56, "middle": 1.46, "outer": 1.17},
    "lobes": lobes,
    "stroke": {"pan": s(M["stroke_pan"]), "orbit": s(M["stroke_orbit"]), "field": s(M["stroke_field"])},
}
print("GEOMETRY = " + json.dumps(G, separators=(",", ":")))
