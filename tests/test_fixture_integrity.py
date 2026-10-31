"""The frozen 177-card corpus (v8). Engine tests read this fixture, never the live DECKS.

A deliberate deck-data change must bump the fixture version and regenerate the
sha256 - it is never regenerated from the engine.
"""
import hashlib
import json
import math
import os
import re
import subprocess
import unittest

from tests import paths

FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "fixtures", "golden_decks_v8.json")
V3_FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          "fixtures", "golden_decks_v3.json")

DECK_KEYS = ("id", "name", "sub", "colors", "degrees", "geom", "fields",
             "chords", "maker_string")
TOP_ZONES = ("ding", "rim", "inner")

# The canonical serialisation's sha256, pinned here so a fixture edit fails
# against a constant a reviewer can see in the diff, not only against a number
# the fixture carries about itself.
#
# 2026-09-16 (engine adoption, owner-approved deck-data change): bumped v3
# -> v4. All three decks now ship the scale engine's generated output
# (18/27/16 -> 19/52/25 chords); this fixture is frozen so exactly this kind
# of change fails loudly rather than being regenerated silently - bumping the
# version and the digest here, in the same PR that changes data/decks.json,
# is the loud failure this fixture exists to force.
#
# 2026-10-06 (degree numerals, owner decision 2026-10-05): bumped v4 -> v5.
# Five degree labels lost their accidental or changed case (Hijaz II and vii,
# Amara III, iv and VII); no chord, field or geometry moved.
#
# 2026-10-07 (size cap removed, owner decisions, Lane U2): bumped v5 -> v6.
# Amara gained Fadd9 and Cadd9 (25 -> 27 cards); Pygmy gained Fmadd9 at
# position 6 and Fm9 took the engine voicing (52 -> 53 cards). No geometry,
# degree or colour moved.
#
# 2026-10-07 (two beginner decks, owner decisions, Lane B): bumped v6 -> v7.
# Two decks were added, kurd (49 cards) and amara10 (29 cards), engine output
# for their maker strings; the three shipped decks did not move.
#
# 2026-10-07 (Pygmy redrawn, owner decision, Lane P1): bumped v7 -> v8. Pygmy's
# geom became the scale engine's output minus ext (r_note, inner_ring, f_note,
# f_num); no field, chord, degree or colour moved.
EXPECTED_SHA256 = ("43d4270206ebe26f22fe3e269c85215999ecb98874dae73ca2eda40219d9eb"
                   "81")

# The v3 corpus's canonical-serialisation digest, pinned the same way as v8's
# above (queue row 48: v3 was unpinned - its "sha256" key existed in the
# fixture but nothing outside the fixture read it, so a coordinated rewrite of
# both the content and its self-reported digest would have passed silently).
EXPECTED_SHA256_V3 = ("6377b1e0230926a5aa85be066517647ec0f7606b569429804a4420"
                      "b540ac1787")


def chord_counts():
    """Card counts per deck, read from the live decks via tests.paths.

    The 49/29/27/19/53 literals are asserted against CLAUDE.md once, in
    tests/test_deck_data.py. Repeating them here would be a second copy free to
    drift; what this suite must prove is that the FROZEN corpus still holds the
    same cards the app does, so it derives the counts instead of restating them.
    The total is still pinned to the spec's 177 below.
    """
    return {d["id"]: len(d["chords"]) for d in paths.app_decks()}

BUMP = ("Deck data changed. This fixture is frozen on purpose: bump it to "
        "golden_decks_v9.json and regenerate sha256, do not edit in place.")


def load():
    with open(FIXTURE, encoding="utf-8") as fh:
        return json.load(fh)


def load_v3():
    with open(V3_FIXTURE, encoding="utf-8") as fh:
        return json.load(fh)


class TestFixtureSelfAssertion(unittest.TestCase):
    def test_sha256_matches_canonical_serialisation(self):
        doc = load()
        canon = json.dumps({"version": doc["version"], "decks": doc["decks"]},
                           sort_keys=True, separators=(",", ":")).encode()
        self.assertEqual(hashlib.sha256(canon).hexdigest(), doc["sha256"],
                         "fixture content and its stored sha256 disagree. " + BUMP)

    def test_sha256_is_the_pinned_v8_digest(self):
        self.assertEqual(load()["sha256"], EXPECTED_SHA256,
                         "the v8 corpus digest changed. " + BUMP)

    def test_v3_sha256_matches_its_canonical_serialisation(self):
        doc = load_v3()
        canon = json.dumps({"version": doc["version"], "decks": doc["decks"]},
                           sort_keys=True, separators=(",", ":")).encode()
        self.assertEqual(hashlib.sha256(canon).hexdigest(), doc["sha256"],
                         "v3 fixture content and its stored sha256 disagree. " + BUMP)

    def test_v3_sha256_is_the_pinned_digest(self):
        self.assertEqual(load_v3()["sha256"], EXPECTED_SHA256_V3,
                         "the v3 corpus digest changed. " + BUMP)

    def test_shape_and_card_counts(self):
        doc = load()
        self.assertEqual(doc["version"], 8)
        self.assertEqual(len(doc["decks"]), 5)
        counts = {d["id"]: len(d["chords"]) for d in doc["decks"]}
        self.assertEqual(counts, chord_counts())
        self.assertEqual(sum(counts.values()), 177)
        for d in doc["decks"]:
            with self.subTest(deck=d["id"]):
                self.assertEqual(tuple(sorted(d)), tuple(sorted(DECK_KEYS)), d["id"])


class TestFixtureMatchesApp(unittest.TestCase):
    def test_fixture_deep_equals_live_decks(self):
        live = {d["id"]: d for d in paths.app_decks()}
        for fx in load()["decks"]:
            with self.subTest(deck=fx["id"]):
                self.assertIn(fx["id"], live, BUMP)
                app = live[fx["id"]]
                for key in ("name", "sub", "chords", "fields", "degrees",
                            "colors", "geom"):
                    self.assertEqual(fx[key], app[key],
                                     "%s.%s diverges from index.html. %s"
                                     % (fx["id"], key, BUMP))


class TestMakerStrings(unittest.TestCase):
    def test_maker_string_tokens_match_fields(self):
        for fx in load()["decks"]:
            with self.subTest(deck=fx["id"]):
                # Partition on "|" rather than flattening it: the separator is
                # what says which shell a note is on, so a string that listed a
                # bottom note among the top ones would otherwise still pass.
                head, sep, tail = fx["maker_string"].partition("|")

                def spell(part):
                    return part.replace("(", " ").replace(")", " ").split()

                fields = list(fx["fields"].values())
                by_midi = lambda zs: sorted(  # noqa: E731
                    (f for f in fields if f[3] in zs), key=lambda f: f[2])
                names = lambda fs: ["%s%d" % (f[0], f[1]) for f in fs]  # noqa: E731

                self.assertEqual(spell(head), names(by_midi(TOP_ZONES)),
                                 "the part before | must spell the top-shell "
                                 "fields, ascending midi")
                self.assertEqual(spell(tail), names(by_midi(("bottom",))),
                                 "the part after | must spell the bottom-shell "
                                 "fields, ascending midi")

    def test_maker_string_marks_ding_and_bottom_shell(self):
        for fx in load()["decks"]:
            with self.subTest(deck=fx["id"]):
                s = fx["maker_string"]
                ding = [f for f in fx["fields"].values() if f[3] == "ding"]
                self.assertEqual(len(ding), 1)
                self.assertTrue(s.startswith("(%s%d)" % (ding[0][0], ding[0][1])))
                has_bottom = any(f[3] == "bottom" for f in fx["fields"].values())
                self.assertEqual("|" in s, has_bottom)


# ---- Neotone (paired-area profile), lane T ---------------------------------
# paired_profile_v1.json below is SUPERSEDED by paired_profile_v2.json (Option B,
# lane T2). It stays, pinned, because a change is a new rev; no engine code reads it.
# docs/plans/2026-10-30-neotone-build.md, "Frozen profile fixture". The fixture
# is written once by hand and is never derived from the implementation; the
# sha256 below is the reviewer-visible pin. A change is a new rev, before merge
# only.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURES = os.path.join(ROOT, "tests", "fixtures")
PROFILE_FIXTURE = os.path.join(FIXTURES, "paired_profile_v1.json")
SHIPPED_CLIENT = os.path.join(FIXTURES, "shipped_client_ee5438d0.html.txt")
SPEC_PATH = os.path.join(ROOT, "docs", "ENGINE-SPEC.md")
PLAN_PATH = os.path.join(ROOT, "docs", "plans", "2026-10-30-neotone-option-b.md")
PROFILE_V2_FIXTURE = os.path.join(FIXTURES, "paired_profile_v2.json")
FONTS = os.path.join(ROOT, "tools", "fonts")

EXPECTED_PROFILE_SHA256 = "ebcffe2fa4283191cd0f83a821aa814fa62fb9b29f102050a6856560f97c57fc"
EXPECTED_SHIPPED_CLIENT_SHA256 = "112bae85da8601f969b6ed1af2259f1e7ae5a6ba9c1d6a2fbd70abbe7796514c"

# The label rule (CLAUDE.md "Diagram label rule"), restated as numbers because
# this fixture must not import the implementation it constrains.
RATIO = {"ding": 0.70875, "rim": 0.80325, "inner": 0.80325, "bottom": 0.8232}
NUM_RATIO, OCTAVE_RATIO, FLOOR_PT = 0.64, 0.66, 3.6
BAND_HALF = 74.0


def load_profile():
    with open(PROFILE_FIXTURE, encoding="utf-8") as fh:
        return json.load(fh)


def slot_circles(p):
    out = {}
    for k, ang in enumerate(p["angles"]):
        a = math.radians(ang)
        for kind, name in (("primary", "p"), ("secondary", "s")):
            o, r = p[kind]["orbit"], p[kind]["r"]
            out["%s%d" % (name, k + 1)] = (o * math.cos(a), o * math.sin(a), r, kind)
    return out


def print_radius(p):
    """D3/D12: furthest drawn element = slot orbit + r + n_out + number height
    (number size = slot r x 0.64), or the ding edge, plus the margin; R is the
    band half over it, rounded to 1 dp as tools/decks.py does."""
    reach = max(
        max(p[k]["orbit"] + p[k]["r"] + p["n_out"] + p[k]["r"] * NUM_RATIO
            for k in ("primary", "secondary")),
        p["ding"]["r"] + abs(p["ding"]["dy"]))
    return round(BAND_HALF / (reach + p["extent_margin"]), 1)


class TestPairedProfileFixture(unittest.TestCase):
    def test_exact_frozen_content(self):
        self.assertEqual(load_profile(), {
            "id": "paired", "rev": 1, "areas": 9,
            "angles": [270, 230, 310, 190, 350, 150, 30, 110, 70],
            "primary": {"orbit": 0.58, "r": 0.16},
            "secondary": {"orbit": 0.86, "r": 0.11},
            "ding": {"r": 0.21, "dy": 0},
            "n_in": 0.052, "n_out": 0.068, "extent_margin": 0.06,
            "slots": ["p%d" % i for i in range(1, 10)]
                     + ["s%d" % i for i in range(1, 10)]})

    def test_sha256_is_pinned(self):
        with open(PROFILE_FIXTURE, "rb") as fh:
            self.assertEqual(hashlib.sha256(fh.read()).hexdigest(),
                             EXPECTED_PROFILE_SHA256,
                             "the paired profile is frozen. Change = new rev, before merge only.")

    def test_slots_are_one_per_area_and_primary_first(self):
        p = load_profile()
        self.assertEqual(len(p["angles"]), p["areas"])
        self.assertEqual(len(p["slots"]), 2 * p["areas"])
        self.assertEqual(len(set(p["slots"])), len(p["slots"]))

    def test_all_slot_circles_pairwise_disjoint_inside_pan_ding_clear(self):
        p = load_profile()
        circles = slot_circles(p)
        names = sorted(circles)
        for i, a in enumerate(names):
            ax, ay, ar, _ = circles[a]
            self.assertLess(math.hypot(ax, ay) + ar, 1.0, a + " leaves the pan")
            self.assertGreater(math.hypot(ax, ay) - ar, p["ding"]["r"],
                               a + " touches the ding")
            for b in names[i + 1:]:
                bx, by, br, _ = circles[b]
                self.assertGreater(math.hypot(ax - bx, ay - by), ar + br,
                                   "%s and %s overlap" % (a, b))

    def test_frozen_margins(self):
        p = load_profile()
        circles = slot_circles(p)
        adj = math.hypot(circles["p1"][0] - circles["p3"][0],
                         circles["p1"][1] - circles["p3"][1])
        self.assertAlmostEqual(adj, 0.397, places=3)
        self.assertGreater(adj, 2 * p["primary"]["r"])
        gap = p["secondary"]["orbit"] - p["primary"]["orbit"]
        self.assertGreater(gap, p["primary"]["r"] + p["secondary"]["r"])
        self.assertLess(p["secondary"]["orbit"] + p["secondary"]["r"], 1.0)

    def test_print_floor_every_glyph_every_slot_every_source_zone(self):
        p = load_profile()
        R = print_radius(p)
        self.assertEqual(R, 63.3)
        self.assertGreaterEqual(R, 60.0)
        self.assertLessEqual(R, 74.0)
        for kind in ("primary", "secondary"):
            r = p[kind]["r"] * R
            number = r * NUM_RATIO
            for zone in ("rim", "inner", "bottom"):
                name = r * RATIO[zone]
                octave = OCTAVE_RATIO * name
                with self.subTest(kind=kind, zone=zone, R=R):
                    self.assertGreaterEqual(number, FLOOR_PT, "index number")
                    self.assertGreaterEqual(octave, FLOOR_PT,
                                            "octave digit %.3f pt at R %.1f" % (octave, R))
                    self.assertGreaterEqual(name, FLOOR_PT)
                    self.assertGreater(name, number, "name must exceed its number")
        ding = p["ding"]["r"] * R * RATIO["ding"]
        self.assertGreaterEqual(ding * OCTAVE_RATIO, FLOOR_PT)


EXPECTED_PROFILE_V2_SHA256 = "472eb35dd120fb6d551942e2f72a8bcda1a699a4df1a0c340bb56e3c8d8cdc79"

V2 = {
    "id": "paired", "rev": 2, "tonefields": 9,
    "angles": [270, 230, 310, 190, 350, 150, 30, 110, 70],
    "main": {"orbit": 0.74, "r": 0.245},
    "mutant": {"depth": 0.45, "r": 0.245},
    "ding": {"r": 0.2, "dy": 0},
    "n_in": 0.12, "number_out": 1.1, "extent_margin": 0.06,
    "slots": ["p%d" % i for i in range(1, 10)] + ["s%d" % i for i in range(1, 10)]}
MAIN_BAND, LENS_BAND, OUTLINE = 0.046, 0.024, 0.012


def load_v2():
    with open(PROFILE_V2_FIXTURE, encoding="utf-8") as fh:
        return json.load(fh)


def lens_geometry(p):
    """Frozen design: lens = circle of radius mutant.r on the main radial line,
    depth = 2 x main.r x mutant.depth, centre at orbit - (2r - depth)."""
    r = p["main"]["r"]
    depth = 2 * r * p["mutant"]["depth"]
    return {"depth": depth, "centre": p["main"]["orbit"] - (2 * r - depth)}


def v2_print_radius(p):
    num = NUM_RATIO * p["main"]["r"]
    reach = max(p["number_out"] + num / 2, p["ding"]["r"])
    return round(BAND_HALF / (reach + p["extent_margin"]), 1)


def pol(radius, ang):
    a = math.radians(ang)
    return radius * math.cos(a), radius * math.sin(a)


def rect_circle_gap(cx, cy, hw, hh, ox, oy, r):
    dx = max(abs(ox - cx) - hw, 0.0)
    dy = max(abs(oy - cy) - hh, 0.0)
    return math.hypot(dx, dy) - r


def fitted(name, octv, size, maxw):
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    if "V2Label" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("V2Label", os.path.join(FONTS, "NunitoSans-Regular.ttf")))
    width = lambda s: (pdfmetrics.stringWidth(name, "V2Label", s)  # noqa: E731
                       + pdfmetrics.stringWidth(str(octv), "V2Label", s * OCTAVE_RATIO))
    while size > 2.5 and width(size) > maxw:
        size -= 0.1
    return size


class TestPairedProfileV2Fixture(unittest.TestCase):
    def test_exact_frozen_content(self):
        self.assertEqual(load_v2(), V2)

    def test_sha256_is_pinned(self):
        with open(PROFILE_V2_FIXTURE, "rb") as fh:
            self.assertEqual(hashlib.sha256(fh.read()).hexdigest(), EXPECTED_PROFILE_V2_SHA256,
                             "the v2 profile is frozen. Change = rev 3 with a rev-2 reader.")

    def test_v1_is_kept_pinned_and_superseded(self):
        v1 = load_profile()
        self.assertEqual(v1["rev"], 1)
        with open(PROFILE_FIXTURE, "rb") as fh:
            self.assertEqual(hashlib.sha256(fh.read()).hexdigest(), EXPECTED_PROFILE_SHA256)
        with open(__file__, encoding="utf-8") as fh:
            self.assertIn("SUPERSEDED by paired_profile_v2.json", fh.read())

    def test_main_circles_disjoint_inside_pan_clear_of_ding(self):
        p = load_v2()
        o, r = p["main"]["orbit"], p["main"]["r"]
        pts = [pol(o, a) for a in p["angles"]]
        self.assertLess(o + r, 1.0)
        self.assertGreater(o - r, p["ding"]["r"])
        for i, a in enumerate(pts):
            for b in pts[i + 1:]:
                self.assertGreater(math.hypot(a[0] - b[0], a[1] - b[1]), 2 * r)

    def test_each_lens_inside_its_main_circle_on_the_ding_side_at_frozen_depth(self):
        p = load_v2()
        o, r = p["main"]["orbit"], p["main"]["r"]
        g = lens_geometry(p)
        self.assertAlmostEqual(g["depth"], 2 * r * p["mutant"]["depth"])
        self.assertAlmostEqual(g["centre"], o - (2 * r - g["depth"]))
        self.assertLess(g["centre"], o, "lens centre must be on the ding side")
        self.assertAlmostEqual(g["centre"] + p["mutant"]["r"] - (o - r), g["depth"],
                               msg="lens spans `depth` radially from the main inner edge")
        self.assertAlmostEqual(p["mutant"]["r"], r)
        self.assertTrue(1 / 3 <= p["mutant"]["depth"] <= 0.50)
        self.assertLessEqual(g["centre"] + p["mutant"]["r"], o + r, "lens leaves its main circle")

    def test_every_glyph_at_least_floor_at_print_radius(self):
        """G1: fitted name, octave digit and M-number at the R the extent rule yields.
        Fit = hifi.fit_note's rule (shrink until width <= 1.47 x r) with r the radius
        of the largest circle inscribed in the drawn shape."""
        p = load_v2()
        R = v2_print_radius(p)
        r = p["main"]["r"] * R
        g = lens_geometry(p)
        lens_ri = g["depth"] * R / 2
        crescent_ri = (2 * p["main"]["r"] - g["depth"]) * R / 2
        number = NUM_RATIO * r
        self.assertGreaterEqual(number, FLOOR_PT, "M-number / main number")
        for nm, oc in (("Bb", 3), ("C#", 3), ("Db", 4), ("Ab", 5), ("Eb", 5), ("F#", 4), ("G#", 3), ("D", 4)):
            for label, zone_ratio, ri in (("lens", RATIO["bottom"], lens_ri),
                                          ("crescent", RATIO["rim"], crescent_ri)):
                size = fitted(nm, oc, r * zone_ratio, 1.47 * ri)
                with self.subTest(glyph=label, note=nm + str(oc), R=R):
                    self.assertGreaterEqual(size, FLOOR_PT, "%s name %.2f pt" % (label, size))
                    self.assertGreaterEqual(size * OCTAVE_RATIO, FLOOR_PT,
                                            "%s octave digit %.2f pt" % (label, size * OCTAVE_RATIO))
        self.assertGreaterEqual(p["ding"]["r"] * R * RATIO["ding"] * OCTAVE_RATIO, FLOOR_PT)

    def test_rule_sizes_name_exceeds_number(self):
        p = load_v2()
        r = p["main"]["r"]
        for zone in ("rim", "bottom"):
            self.assertGreater(r * RATIO[zone], r * NUM_RATIO)

    def test_numbers_do_not_overlap_neighbouring_fields(self):
        p = load_v2()
        R = v2_print_radius(p)
        o, r, ding = p["main"]["orbit"], p["main"]["r"], p["ding"]["r"]
        size = NUM_RATIO * r
        hh, hw = 0.705 * size / 2, 0.6 * size * 2 / 2
        circles = [pol(o, a) for a in p["angles"]]
        for k, ang in enumerate(p["angles"]):
            mx, my = pol(o - r - p["n_in"], ang)
            with self.subTest(number="M%d" % (k + 1)):
                self.assertGreater(math.hypot(mx, my) - hw, ding)
                for j, (ox, oy) in enumerate(circles):
                    gap = rect_circle_gap(mx, my, hw, hh, ox, oy, r)
                    self.assertGreater(gap, 0, "M%d number touches field %d" % (k + 1, j + 1))
            nx, ny = pol(p["number_out"], ang)
            self.assertGreater(math.hypot(nx, ny), 1.0, "main number must sit outside the pan")
            for j, (ox, oy) in enumerate(circles):
                self.assertGreater(rect_circle_gap(nx, ny, hw, hh, ox, oy, r), 0)
        self.assertLessEqual(p["number_out"] + size / 2, BAND_HALF / R + 1e-9)

    def test_frozen_stroke_widths_fit_inside_the_lens(self):
        p = load_v2()
        g = lens_geometry(p)
        self.assertGreater(g["depth"], 2 * (LENS_BAND + OUTLINE))
        self.assertGreater(2 * p["main"]["r"] - g["depth"], 2 * (MAIN_BAND + OUTLINE))


class TestShippedClientFixture(unittest.TestCase):
    def test_is_verbatim_ee5438d0_index_html_and_pinned(self):
        with open(SHIPPED_CLIENT, "rb") as fh:
            data = fh.read()
        self.assertEqual(hashlib.sha256(data).hexdigest(), EXPECTED_SHIPPED_CLIENT_SHA256,
                         "the pinned shipped client changed. It is a verbatim copy of "
                         "git show ee5438d0:index.html and is never edited.")

    def test_name_hides_it_from_html_scanners(self):
        self.assertTrue(SHIPPED_CLIENT.endswith(".html.txt"))
        self.assertFalse(os.path.exists(SHIPPED_CLIENT[:-len(".txt")]))

    def test_boots_with_idb_locks_and_broadcast_channel(self):
        """The recorded old-client harness (plan, "Recorded harness command")."""
        script = (
            "const {boot,createOrigin}=require('./tools/sandbox.js');"
            "const fs=require('fs');"
            "const html=fs.readFileSync(process.argv[1],'utf8');"
            "(async()=>{"
            "const app=boot({html,origin:createOrigin({storage:{}}),indexedDB:true,"
            "broadcastChannel:true,locks:true,isSecureContext:true,"
            "crypto:require('node:crypto').webcrypto,abortController:true});"
            "await app.waitFor(\"typeof booted !== 'undefined' && booted === true\",{timeout:4000});"
            "const db=app.idb.inspect('hpfc.saved-scales.v1');"
            "if(!db)throw new Error('no saved-scales IDB opened');"
            "console.log('BOOT_OK');process.exit(0);})().catch(e=>{console.error(e);process.exit(1)});")
        r = subprocess.run(["node", "-e", script, SHIPPED_CLIENT], cwd=ROOT,
                           capture_output=True, text=True, timeout=60)
        self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
        self.assertIn("BOOT_OK", r.stdout)


class TestEngineSpecProfileSection(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(SPEC_PATH, encoding="utf-8") as fh:
            spec = fh.read()
        m = re.search(r"\n## 18\. [^\n]*\n(.*)\Z", spec, re.S)
        cls.section = m.group(1) if m else ""

    def test_section_exists_and_is_after_section_2(self):
        self.assertTrue(self.section, "ENGINE-SPEC has no section 18 (paired-area profile)")
        with open(SPEC_PATH, encoding="utf-8") as fh:
            spec = fh.read()
        self.assertGreater(spec.index("\n## 18. "), spec.index("\n## 2. "))

    def test_refusal_rows_carry_code_kind_and_sentence(self):
        for code in ("PROFILE_UNKNOWN", "PROFILE_MAP_INVALID", "PROFILE_NOTE_MISSING",
                     "PROFILE_NOTE_TWICE", "PROFILE_FULL", "PROFILE_CONFLICT"):
            with self.subTest(code=code):
                self.assertRegex(
                    self.section,
                    r"(?m)^\| `%s` \| error \| `[^`|]{12,}\.` \|$" % code)

    def test_grammar_facts_are_specified(self):
        for needle in ("pair-", "/^[rib]\\d{1,3}$/", "PROFILE_ENABLED",
                       "recordVersion", "PROFILE_VERSION = 7",
                       "PROFILE_RECORD_VERSION = 5", "I1", "proposeProfile",
                       "geom.place", "`id,rev,map`", "NEEDS_NEWER_APP",
                       "BAD_NOTE", "tests/fixtures/paired_profile_v1.json",
                       "tests/fixtures/paired_profile_v2.json", "tonefield",
                       "mutant tonefield", "lens", "ring-strict", "unplaced",
                       "pitch order", "rev 2", "M<n>",
                       "tests/fixtures/shipped_client_ee5438d0.html.txt"):
            with self.subTest(needle=needle):
                self.assertIn(needle, self.section)

    def test_section_2_enum_is_untouched(self):
        with open(SPEC_PATH, encoding="utf-8") as fh:
            spec = fh.read()
        start = spec.index("\n## 2. ")
        end = spec.index("\n## 3. ", start)
        self.assertNotIn("PROFILE_", spec[start:end],
                         "profile codes live in section 18 until lane E adds them to core.js")


class TestPlanIsCommitted(unittest.TestCase):
    def test_plan_present_and_records_harness_command(self):
        with open(PLAN_PATH, encoding="utf-8") as fh:
            plan = fh.read()
        self.assertIn("Recorded harness command", plan)
        self.assertIn("python3 -m unittest tests.test_fixture_integrity", plan)

    def test_plan_holds_the_exact_v2_fixture(self):
        with open(PLAN_PATH, encoding="utf-8") as fh:
            plan = fh.read()
        with open(PROFILE_V2_FIXTURE, encoding="utf-8") as fh:
            raw = fh.read().strip()
        self.assertIn(raw, plan, "the plan's Frozen v2 fixture section must hold the exact JSON")


if __name__ == "__main__":
    unittest.main()
