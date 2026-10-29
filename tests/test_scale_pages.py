import json
import os
import re
import unittest
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://handpan.raywu.org/"
ALLOWED_HOSTS = {"fonts.googleapis.com", "fonts.gstatic.com", "handpan.raywu.org", "www.w3.org",
                 "www.youtube.com", "www.sarazhandpans.com", "www.handpan.world"}
PAGES = [
    {
        "path": "scales/d-kurd-10/index.html",
        "url": SITE + "scales/d-kurd-10/",
        "layouts": [("d-kurd-10", "kurd")],
        "aliases": ["D Kurd", "Kurdish minor"],
        "h1": "D Kurd 10 handpan chords",
        "cta": "PRACTICE D KURD 10",
        "cards": ["Dm", "Gm", "Am"],
    },
]
PLAIN_ATTRS = {"id", "href", "src", "class", "rel", "charset", "name", "property", "type",
               "lang", "media", "crossorigin", "content"}
TEXT_META = {"description", "og:title", "og:description"}


def read(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as f:
        return f.read()


def decks():
    return {d["id"]: d for d in json.loads(read("data/decks.json"))}


def slugs():
    return json.loads(re.search(r"const DECK_SLUGS = (\{.*?\});", read("index.html")).group(1))


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.tags = []
        self.text = []
        self.attrs = []
        self.links = {}
        self._section = None
        self._style = 0
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.tags.append((tag, a))
        self.attrs += [v or "" for k, v in attrs if k not in PLAIN_ATTRS]
        if tag == "meta" and (a.get("name") in TEXT_META or a.get("property") in TEXT_META):
            self.attrs.append(a.get("content") or "")
        if tag == "style":
            self._style += 1
        if tag == "section" and a.get("id"):
            self._section = a["id"]
            self.links[self._section] = []
        if tag == "a" and self._section and a.get("href"):
            self.links[self._section].append(a["href"])

    def handle_endtag(self, tag):
        if tag == "style":
            self._style -= 1
        if tag == "section":
            self._section = None

    def handle_data(self, data):
        if self._style:
            return
        self.text.append(data)

    def visible(self):
        return " ".join(self.text + self.attrs)

    def meta(self, key, attr="name"):
        for tag, a in self.tags:
            if tag == "meta" and a.get(attr) == key:
                return a.get("content")
        return None

    def canonical(self):
        for tag, a in self.tags:
            if tag == "link" and a.get("rel") == "canonical":
                return a.get("href")
        return None


def parse(page):
    return Page(read(page["path"]))


def cards(html):
    return re.findall(r'<div class="cname">(.*?)</div>\s*<div class="cardhost"[^>]*>\s*<template shadowrootmode="open">(.*?)</template>', html, re.S)


class ScalePagesTest(unittest.TestCase):
    def test_h1_and_primary_cta(self):
        for page in PAGES:
            p = parse(page)
            html = read(page["path"])
            with self.subTest(page=page["path"]):
                self.assertEqual(re.findall(r"<h1>(.*?)</h1>", html, re.S), [page["h1"]])
                self.assertEqual(len(re.findall(r"<h1", html)), 1)
                self.assertIn(page["cta"], " ".join(p.text))

    def test_cards_are_inline_shadow_dom_in_the_deck_colours(self):
        data = decks()
        for page in PAGES:
            html = read(page["path"])
            found = cards(html)
            with self.subTest(page=page["path"]):
                self.assertEqual([n for n, _ in found], page["cards"])
                self.assertNotIn("<iframe", html.lower())
                for layout_id, slug in page["layouts"]:
                    colors = data[slug]["colors"]
                    for name, body in found:
                        self.assertIn("<svg", body)
                        self.assertIn(colors["root"], body)
                        self.assertIn(colors["tone"], body)
                        self.assertRegex(body, r"background:\s*#fff")
                        self.assertRegex(body, r"border:\s*3px solid var\(--root\)")
                        self.assertNotIn("<script", body)

    def test_cards_stay_card_width_and_do_not_trap_scroll(self):
        for page in PAGES:
            html = read(page["path"])
            with self.subTest(page=page["path"]):
                self.assertIn("min(322px,100%)", html)
                self.assertNotIn("touch-action:none", html.replace(" ", ""))
                self.assertNotIn("pointer-events:none", html.replace(" ", ""))

    def test_history_section_ends_with_one_popularized_by_and_no_created_by(self):
        for page in PAGES:
            html = read(page["path"])
            with self.subTest(page=page["path"]):
                section = re.search(r'<section class="history">(.*?)</section>', html, re.S)
                self.assertTrue(section)
                body = section.group(1)
                self.assertIn("A little history", body)
                self.assertEqual(body.count("Popularized by"), 1)
                self.assertNotIn("Created by", html)
                self.assertIn("https://", body)
                self.assertTrue(body.rstrip().endswith("</dl>"))
                self.assertLess(html.index('class="history"'), html.index('class="cname"'))

    def test_the_notes_line_matches_the_deck(self):
        data = decks()
        for page in PAGES:
            text = " ".join(parse(page).text)
            for layout_id, slug in page["layouts"]:
                fields = data[slug]["fields"]
                notes = sorted((f for f in fields.values()), key=lambda f: f[2])
                ding = [f for f in fields.values() if f[3] == "ding"][0]
                top = [f for f in notes if f[3] != "ding"]
                want = "%s%s ding, %s" % (ding[0], ding[1], " ".join("%s%s" % (f[0], f[1]) for f in top))
                with self.subTest(page=page["path"], layout=layout_id):
                    self.assertIn(re.sub(r"\s+", " ", want), re.sub(r"\s+", " ", text))

    def test_fonts_url_loads_all_three_card_families(self):
        for page in PAGES:
            html = read(page["path"])
            with self.subTest(page=page["path"]):
                for family in ("Marcellus", "Bitter", "Nunito+Sans"):
                    self.assertRegex(html, r"fonts\.googleapis\.com/css2\?[^\"]*family=%s" % re.escape(family))

    def test_each_layout_has_a_section_with_its_anchor_and_an_app_link(self):
        for page in PAGES:
            p = parse(page)
            for layout_id, slug in page["layouts"]:
                with self.subTest(page=page["path"], layout=layout_id):
                    self.assertEqual(slugs().get(layout_id), slug)
                    self.assertIn(layout_id, p.links)
                    self.assertIn("/#deck=" + layout_id, p.links[layout_id])

    def test_each_page_names_its_aliases(self):
        for page in PAGES:
            text = " ".join(parse(page).text)
            for alias in page["aliases"]:
                with self.subTest(page=page["path"], alias=alias):
                    self.assertIn(alias, text)

    def test_no_script_and_no_analytics(self):
        for page in PAGES:
            html = read(page["path"]).lower()
            for needle in ("<script", "googletagmanager", "gtag", "g-qtywb2hssv", "google-analytics"):
                with self.subTest(page=page["path"], needle=needle):
                    self.assertNotIn(needle, html)

    def test_visible_text_says_scale_never_deck(self):
        for page in PAGES:
            with self.subTest(page=page["path"]):
                self.assertIsNone(re.search(r"deck", parse(page).visible(), re.I))

    def test_head_has_title_description_canonical_equal_to_sitemap_loc(self):
        sitemap = read("sitemap.xml")
        for page in PAGES:
            p = parse(page)
            with self.subTest(page=page["path"]):
                self.assertTrue(any(t == "title" for t, _ in p.tags))
                self.assertTrue(p.meta("description"))
                self.assertTrue(p.meta("og:title", "property"))
                self.assertEqual(p.canonical(), page["url"])
                self.assertEqual(p.meta("og:url", "property"), page["url"])
                self.assertIn("<loc>%s</loc>" % page["url"], sitemap)

    def test_svg_labels_have_spaced_attributes_and_octave_tspans(self):
        for page in PAGES:
            with self.subTest(page=page["path"]):
                html = read(page["path"])
                self.assertIsNone(re.search(r"<tspan[a-zA-Z]", html))
                self.assertIsNone(re.search(r"\"[a-zA-Z-]+=\"", html))
                self.assertRegex(html, r"<tspan [^>]*>\d</tspan>")

    def test_page_links_back_to_the_app_root(self):
        for page in PAGES:
            with self.subTest(page=page["path"]):
                hrefs = [a.get("href") for t, a in parse(page).tags if t == "a"]
                self.assertIn("/", hrefs)

    def test_only_allowed_external_hosts(self):
        for page in PAGES:
            with self.subTest(page=page["path"]):
                hosts = set(re.findall(r"https?://([^/\"'\s)]+)", read(page["path"])))
                self.assertLessEqual(hosts, ALLOWED_HOSTS)


if __name__ == "__main__":
    unittest.main()
