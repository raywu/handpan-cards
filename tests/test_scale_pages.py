import json
import os
import re
import unittest
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://handpan.raywu.org/"
ALLOWED_HOSTS = {"fonts.googleapis.com", "fonts.gstatic.com", "handpan.raywu.org", "www.w3.org"}
PAGES = [
    {
        "path": "scales/kurd/index.html",
        "url": SITE + "scales/kurd/",
        "layouts": [("d-kurd-10", "kurd")],
        "aliases": ["D Kurd"],
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


def chord_names(html, layout_id):
    section = re.search(r'<section[^>]*id="%s".*?</section>' % layout_id, html, re.S)
    if not section:
        return None
    out = []
    for li in re.findall(r'<li class="chord">(.*?)</li>', section.group(0), re.S):
        name = re.search(r"<b>(.*?)</b>", li, re.S).group(1)
        out.append(re.sub(r"</?sup>", "", name))
    return out


class ScalePagesTest(unittest.TestCase):
    def test_each_page_lists_every_chord_of_its_layouts_in_deck_order(self):
        data = decks()
        for page in PAGES:
            html = read(page["path"])
            for layout_id, slug in page["layouts"]:
                with self.subTest(page=page["path"], layout=layout_id):
                    want = [c["main"] + c["sup"] for c in data[slug]["chords"]]
                    self.assertEqual(chord_names(html, layout_id), want)

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
            for needle in ("<script", "googletagmanager", "gtag", "g-qtywb2hsv", "google-analytics"):
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
