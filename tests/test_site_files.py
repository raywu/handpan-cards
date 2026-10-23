import os
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
