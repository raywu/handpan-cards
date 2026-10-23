import os
import re
import subprocess
import unittest
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://handpan.raywu.org/"
NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def read(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as f:
        return f.read()


def sitemap_tree():
    return ET.parse(os.path.join(ROOT, "sitemap.xml")).getroot()


PATTERNS = [
    r"sven", r"kirchhofer", r"training.?cards", r"hand.?pan.?training", r"(?-i:\bHTC\b)",
    r"oranienbaum", r"biorhyme", r"montserrat", r"commercial", r"reference deck",
    r"original (D )?Amara", r"pixel.validat", r"DUR/MOLL", r"bilingual", r"double.blue", r"ding.as.green",
]
FILENAMES = [
    r"CSharp_Hijaz_Orion_9_CHORD_ONLY_Letter\.pdf",
    r"F3_Low_Pygmy_18_CHORD_ONLY_Letter\.pdf",
    r"D_Amara_9_CHORD_ONLY_Letter\.pdf",
]
RX = re.compile("|".join("(?:%s)" % p for p in PATTERNS + FILENAMES), re.I)
RXF = re.compile("|".join("(?:%s)" % p for p in FILENAMES), re.I)
BASE64_RUN = re.compile(r"[A-Za-z0-9+/=]{200,}")
SELF = {"tests/test_site_files.py", "tests/mutants/g_provenance_guard_blind.patch"}
NAME_FILES = ["tools/decks.py", "tests/paths.py", "tests/test_pdf_build.py",
              "tests/mutants/pm_decks_main_writes_full.patch"]
HTC_FILES = ["tools/probe/panel_fit.js", "tests/app.test.js",
             "tests/mutants/pm_removed_by_design_too_wide.patch"]
ALLOW = {f: list(FILENAMES) for f in NAME_FILES}
ALLOW.update({f: [r"res-trainingcards"] for f in HTC_FILES})


def line_hits(path, text):
    out = []
    for n, line in enumerate(text.splitlines(), 1):
        line = BASE64_RUN.sub("", line)
        for token in ALLOW.get(path, []):
            line = re.sub(token, "", line, flags=re.I)
        if RX.search(line):
            out.append("%s:%d: %s" % (path, n, line.strip()[:80]))
    return out


def tracked_name_hits(names):
    return ["%s: tracked file is one of the three removed PDFs" % f for f in names if RXF.search(f)]


def tracked_files():
    raw = subprocess.run(["git", "-C", ROOT, "ls-files", "-z"], capture_output=True, check=True).stdout
    return [f for f in raw.decode().split("\0") if f]


class ProvenanceGuardTest(unittest.TestCase):
    def test_no_removed_provenance_text(self):
        files = tracked_files()
        hits = tracked_name_hits(files)
        for f in files:
            if f.startswith("docs/plans/") or f in SELF:
                continue
            path = os.path.join(ROOT, f)
            if not os.path.isfile(path):
                continue
            with open(path, "rb") as fh:
                raw = fh.read()
            if b"\0" in raw:
                continue
            hits += line_hits(f, raw.decode("utf-8", "replace"))
        self.assertEqual(hits, [], "\n" + "\n".join(hits))

    def test_the_guard_flags_a_planted_line_for_every_pattern(self):
        samples = ["sven", "kirchhofer", "training cards", "handpan training", "HTC",
                   "oranienbaum", "biorhyme", "montserrat", "commercial", "reference deck",
                   "original D Amara", "original Amara", "pixel-validated", "DUR/MOLL", "bilingual",
                   "double-blue", "ding-as-green"]
        self.assertEqual(len(samples), len(PATTERNS) + 1)
        for s in samples:
            self.assertEqual(len(line_hits("probe.txt", "x %s x" % s)), 1, s)
        self.assertEqual(line_hits("probe.txt", "x htc x"), [])
        for name in ("CSharp_Hijaz_Orion_9_CHORD_ONLY_Letter.pdf",
                     "F3_Low_Pygmy_18_CHORD_ONLY_Letter.pdf", "D_Amara_9_CHORD_ONLY_Letter.pdf"):
            self.assertEqual(len(tracked_name_hits([name])), 1, name)
            self.assertEqual(len(line_hits("probe.txt", name)), 1, name)
            self.assertEqual(line_hits("tests/paths.py", name), [])
        self.assertEqual(line_hits("tests/app.test.js", "res-trainingcards"), [])
        self.assertEqual(len(line_hits("probe.txt", "res-trainingcards")), 1)
        self.assertEqual(line_hits("probe.txt", "x" + "A1b2" * 75 + "htc"), [])


class SiteFilesTest(unittest.TestCase):
    def test_robots_allows_everything(self):
        lines = [l.strip() for l in read("robots.txt").splitlines()]
        self.assertIn("User-agent: *", lines)
        self.assertIn("Allow: /", lines)
        blocking = [l for l in lines if l.lower().startswith("disallow:") and l.split(":", 1)[1].strip()]
        self.assertEqual(blocking, [])

    def test_robots_names_the_absolute_sitemap(self):
        lines = [l.strip() for l in read("robots.txt").splitlines()]
        self.assertIn("Sitemap: " + SITE + "sitemap.xml", lines)

    def test_sitemap_locs_are_absolute_clean_urls(self):
        locs = [e.text.strip() for e in sitemap_tree().iter(NS + "loc")]
        self.assertTrue(locs)
        for loc in locs:
            self.assertTrue(loc.startswith(SITE), loc)
            self.assertTrue(loc.endswith("/"), loc)
            self.assertNotIn("#", loc)

    def test_sitemap_lists_exactly_the_site_root(self):
        locs = {e.text.strip() for e in sitemap_tree().iter(NS + "loc")}
        self.assertEqual(locs, {SITE})

    def test_no_lastmod_and_nojekyll_is_empty(self):
        self.assertEqual(list(sitemap_tree().iter(NS + "lastmod")), [])
        path = os.path.join(ROOT, ".nojekyll")
        self.assertTrue(os.path.isfile(path))
        self.assertEqual(os.path.getsize(path), 0)

    def test_headers_file_sends_noindex_for_every_path(self):
        self.assertEqual(read("_headers"), "/*\n  X-Robots-Tag: noindex\n")


if __name__ == "__main__":
    unittest.main()
