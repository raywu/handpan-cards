"""Spike candidates for the mark, in board pixels (viewBox 520 125 320 210).

python3 candidates.py OUTDIR  -> v1/A/B .svg and _landmarks.json
"""
import json, math, os, re, sys
import numpy as np
from scipy.optimize import least_squares
import landmarks as LM

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
TEAL, GOLD, WARM = "#44E0D8", "#F5C78E", "#F8EDD9"
VB = 'viewBox="520 125 320 210"'
M = LM.M
CX = LM.ORIGIN[0]
W = LM.W
(LX, LY), (RX, RY) = LM.LENS_L, LM.LENS_R


def ybase(x):
    return LY + (RY - LY) * (x - LX) / (RX - LX)


# ---- samples (board px) ------------------------------------------------------
cl = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "centrelines.json")))
dome_l = [p for p in cl["dome"] if p[0] < 646] + cl["dome_top"]
dome_r = [(700, 211), (715, 219), (740, 233), (761.7, 248.3)]   # read from the 6x zoom; the tracker lost it here
dome_s = np.array(dome_l + dome_r, float)
rim_s = np.array([p for p in cl["rim_front"] if p[0] <= 700], float)
shell_s = np.array([p for p in cl["bottom_shell"] if p[0] <= 660], float)


def frame(P):
    """board -> pan frame: u in [-1, 1] across the lens line, v = offset from it / W (down +), mirrored to u <= 0"""
    u = (P[:, 0] - CX) / W
    v = (P[:, 1] - ybase(P[:, 0])) / W
    return -np.abs(u), v


def unframe(u, v):
    x = CX + u * W
    return x, ybase(x) + v * W


# ---- spike A: superellipse caps  v = V0 * (1 - |u|^p)^q -------------------------
def fit_cap(P, v0):
    u, v = frame(P)
    f = lambda k: v0 * np.clip(1 - np.abs(u) ** k[0], 0, 1) ** k[1] - v
    k = least_squares(f, [2.0, 0.5], bounds=([1.0, 0.2], [6.0, 3.0])).x
    return k, float(np.sqrt(np.mean(f(k) ** 2)) * W)


V_DOME = (M["dome_top"][1] - ybase(M["dome_top"][0])) / W
V_RIM = (M["rim_front_low"][1] - ybase(M["rim_front_low"][0])) / W
V_SHELL = (M["shell_low"][1] - ybase(M["shell_low"][0])) / W
kA = {n: fit_cap(P, v0) for n, P, v0 in (("dome", dome_s, V_DOME), ("rim", rim_s, V_RIM), ("shell", shell_s, V_SHELL))}


def cap_path(v0, k, n=64):
    us = np.linspace(-1, 1, 2 * n + 1)
    vs = v0 * np.clip(1 - np.abs(us) ** k[0], 0, 1) ** k[1]
    pts = [unframe(u, v) for u, v in zip(us, vs)]
    return "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in pts), pts


# ---- spike B: symmetric cubic Beziers, one per half, horizontal at the centre ----
def bez(t, P0, P1, P2, P3):
    t = t[:, None]
    return (1 - t) ** 3 * P0 + 3 * (1 - t) ** 2 * t * P1 + 3 * (1 - t) * t * t * P2 + t ** 3 * P3


def fit_bez(P, v0):
    u, v = frame(P)
    S = np.column_stack([u, v])
    ts = np.linspace(0, 1, 400)

    def ctrl(k):
        return (np.array([-1.0, 0.0]), np.array([-1 + k[0], k[1]]), np.array([-k[2], v0]), np.array([0.0, v0]))

    def f(k):
        C = bez(ts, *ctrl(k))
        d = np.sqrt(((S[:, None, :] - C[None, :, :]) ** 2).sum(-1)).min(1)
        return d

    k = least_squares(f, [0.3, v0 * 0.6, 0.4], bounds=([0.0, -1.0, 0.0], [1.0, 1.0, 1.0])).x
    return ctrl(k), float(np.sqrt(np.mean(f(k) ** 2)) * W)


cB = {n: fit_bez(P, v0) for n, P, v0 in (("dome", dome_s, V_DOME), ("rim", rim_s, V_RIM), ("shell", shell_s, V_SHELL))}


def bez_path(ctrl, n=48):
    left = bez(np.linspace(0, 1, n + 1), *ctrl)
    right = left[::-1].copy(); right[:, 0] *= -1
    pts = [unframe(u, v) for u, v in np.vstack([left, right[1:]])]
    return "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in pts), pts


def bez_svg(ctrl):
    """the same curve as true SVG cubic segments (what the generator would ship)"""
    P = [unframe(*p) for p in ctrl]
    Q = [unframe(-p[0], p[1]) for p in reversed(ctrl)]
    f = lambda p: f"{p[0]:.2f} {p[1]:.2f}"
    return f"M{f(P[0])} C{f(P[1])} {f(P[2])} {f(P[3])} C{f(Q[1])} {f(Q[2])} {f(Q[3])}"


# ---- shared parts --------------------------------------------------------------
OC, OA, OBm, OT = M["orbit_centre"], M["orbit_a"], M["orbit_b"], math.radians(-M["orbit_tilt_deg"])


def orbit_pt(t):
    x, y = OA * math.cos(t), OBm * math.sin(t)
    return OC[0] + x * math.cos(OT) - y * math.sin(OT), OC[1] + x * math.sin(OT) + y * math.cos(OT)


def orbit_arc(t0, t1, n=120):
    return "M" + " L".join("%.2f %.2f" % orbit_pt(t0 + (t1 - t0) * i / n) for i in range(n + 1))


def ellipse_pt(c, a, b, tilt_deg, deg):
    th = math.radians(-tilt_deg); t = math.radians(deg)
    x, y = a * math.cos(t), -b * math.sin(t)          # deg measured y-up
    return c[0] + x * math.cos(th) - y * math.sin(th), c[1] + x * math.sin(th) + y * math.cos(th)


prof = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "ring_profiles.json")))


def ring_segments(name, key, width):
    """the ring as 5-degree arcs, each coloured and faded by the mock's measured profile"""
    cx, cy, a, b = M[key]
    p = prof[name]
    vals = []
    for i in range(72):
        q = p[i]
        if q is None:   # hidden behind the pan in the mock: borrow the nearest visible neighbours
            nb = [p[(i + d) % 72] for d in range(-6, 7) if p[(i + d) % 72] is not None]
            q = list(np.mean(nb, 0)) if nb else [0, 0, 0]
        vals.append(q)
    vals = np.array(vals, float)
    sm = (np.roll(vals, 1, 0) + 2 * vals + np.roll(vals, -1, 0)) / 4
    out = []
    for i in range(72):
        r, g, bl = sm[i]
        s = max(0.0, (r + g + bl) / 560.0)
        if s < 0.05:
            continue
        warm = np.clip((r - bl) / max(r + bl, 1) * 2.2 + 0.5, 0, 1)
        col = tuple(int(round(ct * (1 - warm) + cg * warm)) for ct, cg in zip((0x44, 0xE0, 0xD8), (0xF5, 0xC7, 0x8E)))
        a0, a1 = i * 5 - 2.75, i * 5 + 2.75
        pts = [ellipse_pt((cx, cy), a, b, M["ring_tilt_deg"], a0 + (a1 - a0) * j / 6) for j in range(7)]
        d = "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in pts)
        out.append(f'<path d="{d}" stroke="rgb{col}" stroke-opacity="{min(1, s):.2f}" stroke-width="{width}" fill="none"/>')
    return "".join(out)


def mark_svg(dome_d, rim_d, shell_d, silhouette_d, dome_only_d, label):
    sw, so, sf = M["stroke_pan"], M["stroke_orbit"], M["stroke_field"]
    fields = []
    for (x, y), (rx, ry, rot) in zip(M["fields"], [(7, 4.2, -32), (7, 6, -14), (7.6, 7.8, 0), (7, 6, 14), (7, 4.2, 32)]):
        fields.append(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" transform="rotate({rot} {x} {y})"/>')
    ta, tb = math.pi - 0.0, 0.0
    # front half: local q > 0 (sin t > 0), from the left tip through the bottom to the right tip
    front = orbit_arc(math.pi, 0, 200)
    back = orbit_arc(math.pi, 2 * math.pi, 200)
    (x1, y1), (x2, y2) = M["teal_dot"], M["gold_dot"]
    return f'''<svg xmlns="http://www.w3.org/2000/svg" {VB} width="320" height="210" aria-label="{label}">
<defs>
 <linearGradient id="og" gradientUnits="userSpaceOnUse" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">
  <stop offset="0" stop-color="{TEAL}"/><stop offset=".22" stop-color="{WARM}"/><stop offset=".78" stop-color="{WARM}"/><stop offset="1" stop-color="{GOLD}"/></linearGradient>
 <mask id="hidePan" maskUnits="userSpaceOnUse" x="500" y="100" width="360" height="260"><rect x="500" y="100" width="360" height="260" fill="#fff"/><path d="{silhouette_d}" fill="#000" stroke="#000" stroke-width="{sw + 2}"/></mask>
 <mask id="hideDome" maskUnits="userSpaceOnUse" x="500" y="100" width="360" height="260"><rect x="500" y="100" width="360" height="260" fill="#fff"/><path d="{dome_only_d}" fill="#000" stroke="#000" stroke-width="{sw + 2}"/></mask>
 <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
 <filter id="bloom" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
</defs>
<g mask="url(#hidePan)" filter="url(#glow)">
 {ring_segments("inner", "ring_inner", 1.6)}{ring_segments("middle", "ring_middle", 1.5)}{ring_segments("outer", "ring_outer", 1.2)}
</g>
<g mask="url(#hidePan)"><path d="{back}" fill="none" stroke="url(#og)" stroke-width="{so}" stroke-linecap="round"/></g>
<g fill="none" stroke="{WARM}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)">
 <path d="{shell_d}"/><path d="{rim_d}"/><path d="{dome_d}"/>
 <ellipse cx="{M['ding_centre'][0]}" cy="{M['ding_centre'][1]}" rx="{M['ding_rx']}" ry="{M['ding_ry']}"/>
 <g stroke-width="{sf}">{''.join(fields)}</g>
</g>
<path d="{front}" fill="none" stroke="url(#og)" stroke-width="{so}" stroke-linecap="round" filter="url(#glow)"/>
<circle cx="{x1}" cy="{y1}" r="{M['teal_r'] + 5}" fill="{TEAL}" opacity=".35" filter="url(#bloom)"/>
<circle cx="{x2}" cy="{y2}" r="{M['gold_r'] + 5}" fill="{GOLD}" opacity=".35" filter="url(#bloom)"/>
<circle cx="{x1}" cy="{y1}" r="{M['teal_r']}" fill="{TEAL}"/>
<circle cx="{x2}" cy="{y2}" r="{M['gold_r']}" fill="#FFE6C2"/>
</svg>
'''


def shared_landmarks():
    return {"ding_centre": list(M["ding_centre"]), "teal_dot": list(M["teal_dot"]), "gold_dot": list(M["gold_dot"]),
            "orbit_centre": list(M["orbit_centre"]), "orbit_a": M["orbit_a"], "orbit_b": M["orbit_b"],
            "orbit_tilt_deg": M["orbit_tilt_deg"]}


def curve_landmarks(dome_pts, rim_pts, shell_pts):
    at = lambda pts, x: min(pts, key=lambda p: abs(p[0] - x))
    lm = shared_landmarks()
    lm.update({"lens_left": list(dome_pts[0]), "lens_right": list(dome_pts[-1]),
               "dome_top": list(min(dome_pts, key=lambda p: p[1])),
               "rim_front_low": list(max(rim_pts, key=lambda p: p[1])), "rim_front_x600": list(at(rim_pts, 600)),
               "shell_low": list(max(shell_pts, key=lambda p: p[1])), "shell_x600": list(at(shell_pts, 600)),
               "shell_x620": list(at(shell_pts, 620))})
    return lm


def write(name, svg, lm):
    open(os.path.join(OUT, name + ".svg"), "w").write(svg)
    json.dump(lm, open(os.path.join(OUT, name + "_landmarks.json"), "w"), indent=1)


def build(label, dome, rim, shell):
    (dd, dp), (rd, rp), (sd, sp) = dome, rim, shell
    sil = dd + " L" + " L".join(f"{x:.2f} {y:.2f}" for x, y in sp[::-1][1:]) + " Z"
    dome_only = dd + " Z"
    return mark_svg(dd, rd, sd, sil, dome_only, label), curve_landmarks(dp, rp, sp)


svgA, lmA = build("A", *(cap_path(v0, kA[n][0]) for n, v0 in (("dome", V_DOME), ("rim", V_RIM), ("shell", V_SHELL))))
write("A", svgA, lmA)
svgB, lmB = build("B", *(bez_path(cB[n][0]) for n in ("dome", "rim", "shell")))
write("B", svgB, lmB)

# ---- v1 baseline: the shipped mark-full.svg, scaled so its rim ends sit on the lens points
v1 = open(os.path.join(REPO, "docs/brand/logo/mark-full.svg")).read()
inner = re.sub(r"^<svg[^>]*>|</svg>\s*$", "", v1.strip()).replace("<title>Handpan Theory</title>", "")
s = (RX - LX) / 380.0
tx, ty = LX - 60 * s, LM.ORIGIN[1] - 212 * s
write("v1", f'<svg xmlns="http://www.w3.org/2000/svg" {VB} width="320" height="210"><g transform="translate({tx:.3f} {ty:.3f}) scale({s:.5f})">{inner}</g></svg>\n',
      None or {})
mp = lambda x, y: [tx + x * s, ty + y * s]
o = dict(cx=252, cy=196, rx=232, ry=72, rot=-15)
def v1_orbit(t):
    a = math.radians(o["rot"]); x, y = o["rx"] * math.cos(t), o["ry"] * math.sin(t)
    return mp(o["cx"] + x * math.cos(a) - y * math.sin(a), o["cy"] + x * math.sin(a) + y * math.cos(a))
xr = lambda X: 60 + (X - tx - 60 * s) / s  # board x -> v1 x
def v1_ell(cx, cy, rx, ry, X):
    u = (xr(X) - cx) / rx
    return mp(xr(X), cy + ry * math.sqrt(max(0, 1 - u * u)))
lm1 = {"lens_left": mp(60, 212), "lens_right": mp(440, 212), "dome_top": mp(250, 128), "ding_centre": mp(250, 136),
       "rim_front_low": mp(250, 236), "rim_front_x600": v1_ell(250, 212, 190, 24, 600),
       "shell_low": mp(250, 246), "shell_x600": v1_ell(250, 222, 175, 24, 600), "shell_x620": v1_ell(250, 222, 175, 24, 620),
       "teal_dot": v1_orbit(math.pi - 0.28), "gold_dot": v1_orbit(-0.42), "orbit_centre": mp(252, 196),
       "orbit_a": 232 * s, "orbit_b": 72 * s, "orbit_tilt_deg": 15.0}
json.dump(lm1, open(os.path.join(OUT, "v1_landmarks.json"), "w"), indent=1)

fits = {"A_superellipse_p_q_and_rms_px": {n: [list(map(float, kA[n][0])), kA[n][1]] for n in kA},
        "B_bezier_rms_px": {n: cB[n][1] for n in cB},
        "B_svg_paths": {n: bez_svg(cB[n][0]) for n in cB}}
json.dump(fits, open(os.path.join(OUT, "fits.json"), "w"), indent=1)
print(json.dumps({k: v for k, v in fits.items() if k != "B_svg_paths"}, indent=1))


# ---- spike B2: B's curves, rings as a few gradient arcs ("lobes"), lighter pan glow ----
def ring_lobes(name, key, width, uid):
    cx, cy, a, b = M[key]
    p = prof[name]
    vals = np.array([q if q is not None else [np.nan] * 3 for q in p], float)
    for i in range(72):                       # fill hidden angles from neighbours
        if np.isnan(vals[i, 0]):
            nb = [vals[(i + d) % 72] for d in range(-6, 7) if not np.isnan(vals[(i + d) % 72, 0])]
            vals[i] = np.mean(nb, 0) if nb else 0
    sm = (np.roll(vals, 2, 0) + 2 * np.roll(vals, 1, 0) + 3 * vals + 2 * np.roll(vals, -1, 0) + np.roll(vals, -2, 0)) / 9
    bright = sm.sum(1) / 560.0
    on = bright > 0.12
    if on.all():
        on[np.argmin(bright)] = False
    start = int(np.argmin(on))                # walk from an "off" angle so lobes do not wrap
    lobes, cur = [], []
    for k in range(72):
        i = (start + k) % 72
        if on[i]:
            cur.append(i)
        elif cur:
            lobes.append(cur); cur = []
    if cur:
        lobes.append(cur)
    defs, paths = [], []
    for j, lobe in enumerate(lobes):
        if len(lobe) < 3:
            continue
        a0, a1 = lobe[0] * 5 - 5, lobe[0] * 5 + (len(lobe)) * 5
        pts = [ellipse_pt((cx, cy), a, b, M["ring_tilt_deg"], a0 + (a1 - a0) * t / 40) for t in range(41)]
        (x0, y0), (x1, y1) = pts[0], pts[-1]
        stops = []
        for f in (0, .2, .4, .6, .8, 1):
            ang = a0 + (a1 - a0) * f
            i = int(round(ang / 5)) % 72
            r, g, bl = sm[i]
            op = 0 if f in (0, 1) else min(1, bright[i])
            warm = float(np.clip((r - bl) / max(r + bl, 1) * 2.2 + 0.5, 0, 1))
            col = "#%02X%02X%02X" % tuple(int(round(ct * (1 - warm) + cg * warm)) for ct, cg in zip((0x44, 0xE0, 0xD8), (0xF5, 0xC7, 0x8E)))
            # project the angle's point on the chord so the stop sits where that angle is
            px, py = ellipse_pt((cx, cy), a, b, M["ring_tilt_deg"], ang)
            dx, dy = x1 - x0, y1 - y0
            off = ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy)
            stops.append((min(1, max(0, off)), col, op))
        stops.sort()
        gid = f"r{uid}{j}"
        defs.append(f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{x0:.2f}" y1="{y0:.2f}" x2="{x1:.2f}" y2="{y1:.2f}">'
                    + "".join(f'<stop offset="{o:.3f}" stop-color="{c}" stop-opacity="{op:.2f}"/>' for o, c, op in stops) + "</linearGradient>")
        paths.append(f'<path d="M' + " L".join(f"{x:.2f} {y:.2f}" for x, y in pts) + f'" stroke="url(#{gid})" stroke-width="{width}" fill="none" stroke-linecap="round"/>')
    return "".join(defs), "".join(paths)


def to_B2(svg):
    d1, p1 = ring_lobes("inner", "ring_inner", 1.6, "i")
    d2, p2 = ring_lobes("middle", "ring_middle", 1.5, "m")
    d3, p3 = ring_lobes("outer", "ring_outer", 1.2, "o")
    start = svg.index('<g mask="url(#hidePan)" filter="url(#glow)">')
    end = svg.index("</g>", start) + 4
    svg = svg[:start] + f'<g mask="url(#hidePan)" filter="url(#glow)">{p1}{p2}{p3}</g>' + svg[end:]
    svg = svg.replace("</defs>", d1 + d2 + d3 + '<filter id="soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.2" result="b"/><feComponentTransfer in="b" result="c"><feFuncA type="linear" slope=".55"/></feComponentTransfer><feMerge><feMergeNode in="c"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>')
    svg = svg.replace('stroke-linejoin="round" filter="url(#glow)"', 'stroke-linejoin="round" filter="url(#soft)"')
    return svg.replace('aria-label="B"', 'aria-label="B2"')


write("B2", to_B2(svgB), lmB)
