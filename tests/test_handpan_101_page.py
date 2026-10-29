import glob
import json
import os
import re
import unittest

from tests.test_scale_pages import Page, read, ROOT, SITE

PATH = "handpan-101/index.html"
URL = SITE + "handpan-101/"
TITLE = "Handpan 101: A Beginner's Guide to Parts, Scales and First Practice"
ALLOWED_HOSTS = {"fonts.googleapis.com", "fonts.gstatic.com", "handpan.raywu.org", "www.youtube.com",
                 "en.wikipedia.org", "www.sarazhandpans.com", "schema.org"}
NAME_DENYLIST = ["Amy", "Naylor", "Levinson", "Rohner", "Schärer", "Scharer", "Felix", "Sabina"]
SERVED = ["index.html", PATH, "sitemap.xml"] + sorted(
    os.path.relpath(f, ROOT) for f in glob.glob(os.path.join(ROOT, "scales", "*", "index.html"))
    + glob.glob(os.path.join(ROOT, "data", "i18n", "*.json")))


def page():
    return Page(read(PATH))


class Handpan101PageTest(unittest.TestCase):
    def test_no_served_file_links_the_google_doc(self):
        for name in SERVED:
            with self.subTest(file=name):
                text = read(name)
                self.assertNotIn("docs.google.com", text)
                self.assertNotIn("1C1BIyjE", text)

    def test_head_title_description_canonical_og(self):
        p = page()
        html = read(PATH)
        self.assertEqual(re.findall(r"<title>(.*?)</title>", html), [TITLE])
        desc = p.meta("description")
        self.assertTrue(desc)
        self.assertEqual(p.canonical(), URL)
        self.assertIn("<loc>%s</loc>" % URL, read("sitemap.xml"))
        self.assertEqual(p.meta("og:url", "property"), URL)
        self.assertEqual(p.meta("og:title", "property"), TITLE)
        self.assertEqual(p.meta("og:description", "property"), desc)
        self.assertEqual(p.meta("og:site_name", "property"), "Handpan Chords")
        self.assertEqual(p.meta("og:image", "property"), SITE + "og.png")
        self.assertEqual(p.meta("og:type", "property"), "article")

    def test_theme_colours_are_the_app_brown_and_gold(self):
        html = read(PATH)
        self.assertIn("--r:#433b2c", html)
        self.assertIn("--r:#e3b25c", html)
        self.assertRegex(html, r"prefers-color-scheme:dark")

    def test_structure_h1_then_h2_one_main_lang_en(self):
        html = read(PATH)
        self.assertTrue(html.startswith("<!doctype html>"))
        self.assertIn('<html lang="en">', html)
        self.assertEqual(html.count("<main>"), 1)
        self.assertEqual(re.findall(r"<h1>(.*?)</h1>", html, re.S), ["Handpan 101"])
        self.assertIsNone(re.search(r"<h[3-6]", html))
        self.assertLess(html.index("<h1>"), html.index("<h2>"))
        self.assertNotIn('class="q"', html)
        self.assertNotIn("Questions for you", html)

    def test_no_script_but_the_article_json_ld(self):
        html = read(PATH)
        scripts = re.findall(r"<script\b([^>]*)>", html)
        self.assertEqual(scripts, [' type="application/ld+json"'])
        for needle in ("googletagmanager", "gtag", "g-qtywb2hssv", "google-analytics"):
            self.assertNotIn(needle, html.lower())

    def test_article_json_ld_matches_the_page_and_has_no_faq(self):
        html = read(PATH)
        data = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S).group(1))
        self.assertEqual(data["@type"], "Article")
        self.assertEqual(data["headline"], TITLE)
        self.assertEqual(data["mainEntityOfPage"], URL)
        self.assertEqual(data["publisher"]["name"], "Handpan Chords")
        self.assertEqual(data["publisher"]["url"], SITE)
        self.assertRegex(data["dateModified"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertIn('<time datetime="%s">' % data["dateModified"], html)
        self.assertNotIn("FAQPage", html)
        self.assertNotIn("@raywu.org", json.dumps(data))

    def test_visible_sources_publisher_and_last_updated(self):
        html = read(PATH)
        self.assertIn("<h2>Sources</h2>", html)
        sources = re.search(r"<h2>Sources</h2>(.*?)</section>", html, re.S).group(1)
        self.assertGreaterEqual(len(re.findall(r'<a href="https://', sources)), 2)
        text = " ".join(page().text)
        self.assertRegex(text, r"Last updated\s+\d{4}-\d{2}-\d{2}")
        self.assertIn("Handpan Chords", text)

    def test_materials_h2_names_the_five_materials(self):
        m = re.search(r"<h2>Materials</h2>(.*?)</section>", read(PATH), re.S)
        self.assertTrue(m)
        for word in ("Raw", "Coated", "Nitrided", "Stainless", "Ember"):
            self.assertIn(word, m.group(1))

    def test_scale_links_resolve_to_existing_pages(self):
        hrefs = [a["href"] for t, a in page().tags if t == "a" and a.get("href", "").startswith("/scales/")]
        self.assertIn("/scales/d-kurd-10/", hrefs)
        for href in hrefs:
            with self.subTest(href=href):
                self.assertRegex(href, r"^/scales/[a-z0-9-]+/$")
                self.assertTrue(os.path.isfile(os.path.join(ROOT, href.strip("/"), "index.html")))

    def test_exactly_three_youtube_links_and_no_person_names(self):
        links = [a["href"] for t, a in page().tags if t == "a" and "youtube.com" in a.get("href", "")]
        self.assertEqual(len(links), 3)
        for name in NAME_DENYLIST:
            self.assertNotIn(name, read(PATH))

    def test_only_allowed_hosts_back_link_and_ctas(self):
        html = read(PATH)
        self.assertLessEqual(set(re.findall(r"https?://([^/\"'\s)]+)", html)), ALLOWED_HOSTS)
        hrefs = [a.get("href") for t, a in page().tags if t == "a"]
        self.assertIn("/", hrefs)
        self.assertIn("/#add", hrefs)
        self.assertIn("ADD YOUR OWN SCALE", " ".join(page().text))
        self.assertIn(".ctas{", html)

    def test_visible_text_says_scale_never_deck(self):
        self.assertIsNone(re.search(r"deck", page().visible(), re.I))

    def test_kurd_page_links_handpan_101_in_the_same_tab(self):
        self.assertRegex(read("scales/d-kurd-10/index.html"), r'<a href="/handpan-101/">Handpan 101</a>')


if __name__ == "__main__":
    unittest.main()
