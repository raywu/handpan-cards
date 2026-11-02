"""Measured landmarks of the primary mark on docs/brand/reference/brand-board.webp.

Board pixels, y down. W = half the distance between the rim's two lens points;
every normalised figure is (value - origin) / W with origin = lens midpoint.
How each was measured is in MEASURED_BY.
"""
LENS_L = (566.0, 260.6)
LENS_R = (771.7, 256.7)
ORIGIN = ((LENS_L[0] + LENS_R[0]) / 2, (LENS_L[1] + LENS_R[1]) / 2)   # (668.85, 258.65)
W = (LENS_R[0] - LENS_L[0]) / 2                                       # 102.85

M = {
    "lens_left": LENS_L,
    "lens_right": LENS_R,
    "dome_top": (670.0, 209.5),           # top of the dome = ding's upper edge
    "ding_centre": (670.0, 217.2), "ding_rx": 23.0, "ding_ry": 7.5,
    "rim_front_low": (668.0, 277.0),      # lowest point of the top shell's front edge
    "rim_front_x600": (600.0, 271.0),
    "shell_low": (665.0, 291.0),          # lowest point of the bottom shell
    "shell_x600": (600.0, 275.5), "shell_x620": (620.0, 283.0),
    "fields": [(607.0, 245.0), (634.0, 251.0), (671.0, 254.0), (709.0, 251.7), (737.5, 243.5)],
    "orbit_centre": (674.2, 252.7), "orbit_a": 134.0, "orbit_b": 33.8, "orbit_tilt_deg": 16.4,
    "teal_dot": (559.9, 301.3), "teal_r": 9.4,
    "gold_dot": (783.3, 201.7), "gold_r": 8.5,
    "ring_inner": (674.1, 255.8, 90.6, 82.6), "ring_middle": (675.5, 253.8, 108.5, 100.3),
    "ring_outer": (676.5, 252.0, 126.5, 118.0), "ring_tilt_deg": 9.8,
    "stroke_pan": 3.0, "stroke_orbit": 2.6, "stroke_field": 1.8, "stroke_ring": 1.5,
}

MEASURED_BY = {
    "lens points, dome samples": "read from 5-8x pixel-grid zooms (grid.py), cross-checked by column runs",
    "rim front, bottom shell": "column brightness runs (extract.py) on the left half; right half is crossed by the orbit, so the curves are fitted symmetric about the pan centre",
    "orbit": "algebraic ellipse fit to 24 points read from zooms; 21 of 24 within 4% of the curve",
    "dots": "centroid and area of the saturated core",
    "rings": "RANSAC circles on teal pixels and on warm pixels, then one ellipse fit per ring to both sets (measure4.py); outer ring from the radial brightness profile",
    "strokes": "full width at half maximum across the stroke",
}

KEYS = ["lens_left", "lens_right", "dome_top", "ding_centre", "rim_front_low", "rim_front_x600",
        "shell_low", "shell_x600", "shell_x620", "teal_dot", "gold_dot", "orbit_centre"]


def norm(p):
    return ((p[0] - ORIGIN[0]) / W, (p[1] - ORIGIN[1]) / W)
