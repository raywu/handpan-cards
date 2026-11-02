"""Compare a candidate mark with the board's primary mark.

python3 harness.py NAME cand.svg cand_landmarks.json OUTDIR
The SVG must use board pixels (viewBox 520 125 320 210). Writes NAME-side.png,
NAME-onion.png, NAME-diff.png and NAME-metrics.json; prints the table.
"""
import json, os, subprocess, sys
import numpy as np
from PIL import Image, ImageChops, ImageDraw
from scipy.ndimage import distance_transform_edt
import landmarks as LM

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
HERE = os.path.dirname(os.path.abspath(__file__))
BOARD = os.path.join(REPO, "docs/brand/reference/brand-board.webp")
BOX = (520, 125, 840, 335)
S = 3


def render(svg, png, scale):
    w, h = (BOX[2] - BOX[0]) * scale, (BOX[3] - BOX[1]) * scale
    subprocess.run(["node", os.path.join(HERE, "render.js"), svg, png, str(w), str(h)], check=True, cwd=HERE)
    return Image.open(png).convert("RGB")


def masks(img, bg_l=21.0):
    l = np.asarray(img.convert("L")).astype(float) - bg_l
    return l > 110, (l > 28) & (l <= 110)      # bright strokes, dim strokes (rings, glow-free tails)


def f1(cand, ref, tol=1.5):
    if cand.sum() == 0 or ref.sum() == 0:
        return 0.0, 0.0, 0.0
    dref = distance_transform_edt(~ref)
    dcand = distance_transform_edt(~cand)
    p = (dref[cand] <= tol).mean()
    r = (dcand[ref] <= tol).mean()
    return p, r, 2 * p * r / (p + r) if p + r else 0.0


def main(name, svg, lmfile, out):
    os.makedirs(out, exist_ok=True)
    mock = Image.open(BOARD).convert("RGB").crop(BOX)
    cand1 = render(svg, os.path.join(out, name + "-1x.png"), 1)
    mb, md = masks(mock)
    cb, cd = masks(cand1)
    pan_zone = np.zeros_like(mb)
    pan_zone[205 - BOX[1]:296 - BOX[1], 562 - BOX[0]:776 - BOX[0]] = True
    bright = f1(cb, mb)
    pan = f1(cb & pan_zone, mb & pan_zone)
    rings = f1(cd & ~pan_zone, md & ~pan_zone, tol=2.0)
    cl = json.load(open(lmfile))
    rows, errs = [], []
    for k in LM.KEYS:
        if k not in cl:
            continue
        m, c = LM.M[k], cl[k]
        if k in ("dome_top", "rim_front_low", "shell_low"):   # flat extremum: its x is ill-defined, score height only
            e = abs(c[1] - m[1]) / LM.W * 100
        else:
            e = float(np.hypot(c[0] - m[0], c[1] - m[1])) / LM.W * 100
        errs.append(e)
        rows.append((k, m, c, e))
    for k in ("orbit_a", "orbit_b", "orbit_tilt_deg"):
        if k in cl:
            e = abs(cl[k] - LM.M[k]) / (LM.W if k != "orbit_tilt_deg" else 1) * (100 if k != "orbit_tilt_deg" else 1)
            rows.append((k, LM.M[k], cl[k], e))
            if k != "orbit_tilt_deg":
                errs.append(e)
    metrics = {"bright_strokes_PRF": bright, "pan_PRF": pan, "rings_PRF": rings,
               "landmark_worst_pct_W": max(errs) if errs else None,
               "landmark_mean_pct_W": float(np.mean(errs)) if errs else None,
               "landmarks": [(k, list(m) if isinstance(m, tuple) else m, c, round(e, 2)) for k, m, c, e in rows]}
    json.dump(metrics, open(os.path.join(out, name + "-metrics.json"), "w"), indent=1, default=float)
    # visuals at 3x
    big = render(svg, os.path.join(out, name + "-3x.png"), S)
    mockb = mock.resize(big.size, Image.LANCZOS)
    side = Image.new("RGB", (big.width * 2 + 8, big.height), (60, 60, 60))
    side.paste(mockb, (0, 0)); side.paste(big, (big.width + 8, 0))
    d = ImageDraw.Draw(side)
    d.text((8, 6), "mock", fill=(255, 255, 255)); d.text((big.width + 16, 6), name, fill=(255, 255, 255))
    side.save(os.path.join(out, name + "-side.png"))
    Image.blend(mockb, big, 0.5).save(os.path.join(out, name + "-onion.png"))
    # difference: mock strokes in red, candidate strokes in cyan, overlap white
    mbb = np.asarray(mockb.convert("L")).astype(float) - 21 > 40
    cbb = np.asarray(big.convert("L")).astype(float) - 21 > 40
    diff = np.zeros(mbb.shape + (3,), np.uint8)
    diff[mbb] = (230, 60, 60); diff[cbb] = (60, 220, 230); diff[mbb & cbb] = (255, 255, 255)
    Image.fromarray(diff).save(os.path.join(out, name + "-diff.png"))
    print(f"== {name}")
    print(f"  bright strokes P/R/F1 {bright[0]:.3f}/{bright[1]:.3f}/{bright[2]:.3f}   pan F1 {pan[2]:.3f}   rings F1 {rings[2]:.3f}")
    print(f"  landmarks: worst {metrics['landmark_worst_pct_W']:.1f}% of W, mean {metrics['landmark_mean_pct_W']:.1f}%")
    for k, m, c, e in rows:
        flag = "  <-- over 2%" if e > 2 and k != "orbit_tilt_deg" else ""
        print(f"    {k:16s} mock {m}  cand {[round(v, 1) for v in c] if isinstance(c, list) else round(c, 1)}  err {e:.1f}{'deg' if k == 'orbit_tilt_deg' else '%'}{flag}")


if __name__ == "__main__":
    main(*sys.argv[1:5])
