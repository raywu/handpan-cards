import json
import os
import re
import subprocess
import sys
import unittest
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import gen_scale_page as gen  # noqa: E402

SITE = "https://handpan.raywu.org/"
ALLOWED_HOSTS = {"fonts.googleapis.com", "fonts.gstatic.com", "handpan.raywu.org", "www.w3.org",
                 "docs.google.com", "www.youtube.com", "www.sarazhandpans.com", "www.handpan.world",
                 "handpaner.com", "schema.org", "handpanhelpers.klangzeug.de", "svenkirchhofer.de",
                 "yataoshop.com", "isthmusinstruments.com", "www.drumland.com", "maginstruments.com",
                 "www.scan.co.uk", "www.meinlshop.de", "www.dingandtones.com", "sarazhandpans.com",
                 "didgeproject.com", "www.didgeproject.com", "ayasainstruments.com",
                 "shop.ayasainstruments.com", "www.yishama.com", "www.xenithhandpans.com",
                 "www.veritashandpans.com", "www.spirithandpan.com", "www.panart.ch", "www.muziker.al",
                 "www.mudrahandpans.com", "www.kirstein.de", "www.halleonard.com", "www.boullard.ch"}
SIZE_CAP = 60 * 1024
PALETTES = ["#E0559A", "#6D40A3", "#0B7B75", "#E2761B", "#C9971E", "#DD8F00", "#2563B0", "#3B7A2A",
            "#C0452C", "#B3263A"]
BG_LIGHT = "#fbfaf8"
BG_DARK = "#15181b"

# Independent oracle for the plan's page table (Round 4 dispositions, row 0 from Round 7 H3,
# Equinox and Magic Voyage). kind, palette index, cards in the deck, popularized, cross-link target.
ROWS = {
    "d-kurd-10": ("frozen", 6, 49, True, "d-kurd-9"),
    "d-amara-9": ("built-in", 2, 27, False, "d-amara-10"),
    "d-amara-10": ("built-in", 7, 29, False, "d-amara-9"),
    "f-low-pygmy-18": ("built-in", 1, 53, False, "f-low-pygmy-9"),
    "c-sharp-hijaz-9": ("built-in", 0, 19, False, "e-romanian-hijaz-9"),
    "d-kurd-9": ("new", 6, 49, True, "d-kurd-10"),
    "f-low-pygmy-9": ("new", 1, 11, False, "f-low-pygmy-18"),
    "e-romanian-hijaz-9": ("new", 0, 30, False, "c-sharp-hijaz-9"),
    "c-sharp-mystic-8": ("new", 3, 19, False, "d-kurd-10"),
    "d-integral-9": ("new", 4, 19, False, "d-kurd-9"),
    "f-sharp-akebono-9": ("new", 5, 9, False, "d-kurd-10"),
    "d-sabye-9": ("new", 6, 49, False, None),
    "d-aegean-18": ("new", 7, 62, False, "e-amara-20"),
    "e-amara-20": ("new", 2, 77, False, "d-amara-9"),
    "e-equinox-9": ("new", 9, 19, False, "e-romanian-hijaz-9"),
    "f-magic-voyage-8": ("new", 8, 11, False, "f-low-pygmy-9"),
}
LEADS = {
    "d-kurd-10": "Nine notes?", "d-amara-9": "Ten notes?", "d-amara-10": "Nine notes?",
    "f-low-pygmy-18": "Nine notes?", "c-sharp-hijaz-9": "Playing an E pan?", "d-kurd-9": "Ten notes?",
    "f-low-pygmy-9": "Eighteen notes?", "e-romanian-hijaz-9": "Playing a C# pan?",
    "c-sharp-mystic-8": "Playing a D pan?", "d-integral-9": "Another D scale?",
    "f-sharp-akebono-9": "Playing a D pan?", "d-aegean-18": "Playing an E pan?",
    "e-amara-20": "Playing a D pan?", "e-equinox-9": "Another E scale?",
    "f-magic-voyage-8": "Another F scale?",
}
BUILT_IN_DECK = {"d-kurd-10": "kurd", "d-amara-9": "amara", "d-amara-10": "amara10",
                 "f-low-pygmy-18": "pygmy", "c-sharp-hijaz-9": "hijaz"}
KNOWN = {"d-kurd-10": {"aliases": ["D Kurd", "Kurdish minor"], "h1": "D Kurd 10 handpan chords",
                       "cta": "PRACTICE D KURD 10", "cards": ["Dm", "Gm", "Am"]}}
PLAIN_ATTRS = {"id", "href", "src", "class", "rel", "charset", "name", "property", "type",
               "lang", "media", "crossorigin", "content", "datetime"}
TEXT_META = {"description", "og:title", "og:description"}


def read(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as f:
        return f.read()


def decks():
    return {d["id"]: d for d in json.loads(read("data/decks.json"))}


def slugs():
    return json.loads(re.search(r"const DECK_SLUGS = (\{.*?\});", read("index.html")).group(1))


def table():
    return {r["slug"]: r for r in gen.load_rows()}


def fixture():
    return json.loads(read("tests/fixtures/scale_pages_v1.json"))


def exists(slug):
    return os.path.exists(os.path.join(ROOT, "scales", slug, "index.html"))


_RENDERED = {}


def rendered(slug):
    if slug not in _RENDERED:
        rows = gen.load_rows()
        by = {r["slug"]: r for r in rows}
        row = by[slug]
        data = gen.engine([row])
        copy = row.get("copy") or dict(gen.SAMPLE_COPY)
        if row["kind"] != "frozen" and not row["popularized"]:
            copy["who_html"] = None
        _RENDERED[slug] = gen.render(row, data["rows"][slug], by, copy, data["alt"].get(slug))
    return _RENDERED[slug]


def html_of(slug):
    return read("scales/%s/index.html" % slug) if exists(slug) else rendered(slug)


def kind(slug):
    return ROWS[slug][0]


def lum(hex_):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (int(hex_[i:i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def ratio(a, b):
    hi, lo = sorted((lum(a), lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.tags = []
        self.text = []
        self.attrs = []
        self.links = {}
        self.scripts = []
        self._section = None
        self._style = 0
        self._script = None
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.tags.append((tag, a))
        self.attrs += [v or "" for k, v in attrs if k not in PLAIN_ATTRS]
        if tag == "meta" and (a.get("name") in TEXT_META or a.get("property") in TEXT_META):
            self.attrs.append(a.get("content") or "")
        if tag == "style":
            self._style += 1
        if tag == "script":
            self._script = [a.get("type"), ""]
            self.scripts.append(self._script)
        if tag == "section" and a.get("id"):
            self._section = a["id"]
            self.links[self._section] = []
        if tag == "a" and self._section and a.get("href"):
            self.links[self._section].append(a["href"])

    def handle_endtag(self, tag):
        if tag == "style":
            self._style -= 1
        if tag == "script":
            self._script = None
        if tag == "section":
            self._section = None

    def handle_data(self, data):
        if self._script is not None:
            self._script[1] += data
            return
        if self._style:
            return
        self.text.append(data)

    def visible(self):
        return " ".join(self.text + self.attrs)

    def norm(self):
        return re.sub(r"\s+", " ", " ".join(self.text))

    def tidy(self):
        return re.sub(r"\s+([.,;:?!])", r"\1", self.norm())

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

    def hrefs(self):
        return [a.get("href") for t, a in self.tags if t == "a"]


def cards(html):
    return re.findall(r'<div class="cname">(.*?)</div>\s*<div class="cardhost"([^>]*)>\s*<template shadowrootmode="open">(.*?)</template>', html, re.S)


def strings(node):
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for k, v in node.items():
            if k in ("@type", "@context", "@id", "url", "item", "image", "mainEntityOfPage", "sameAs",
                     "dateModified"):
                continue
            yield from strings(v)
    elif isinstance(node, list):
        for v in node:
            yield from strings(v)


class TableOracleTest(unittest.TestCase):
    def test_the_table_has_exactly_the_planned_rows(self):
        self.assertEqual(set(table()), set(ROWS))

    def test_each_row_matches_the_independent_oracle(self):
        t = table()
        for slug, (k, palette, total, popularized, cross) in ROWS.items():
            with self.subTest(slug=slug):
                row = t[slug]
                self.assertEqual(row["kind"], k)
                self.assertEqual(row["palette"], palette)
                self.assertEqual(row["cards_total"], total)
                self.assertEqual(row["popularized"], popularized)
                self.assertEqual((row.get("cross") or {}).get("to"), cross)
                self.assertEqual(len(row["pick"]), 3)

    def test_built_in_rows_name_their_deck_and_new_rows_a_seed(self):
        for slug, row in table().items():
            with self.subTest(slug=slug):
                if kind(slug) in ("frozen", "built-in"):
                    self.assertEqual(row["deck"], BUILT_IN_DECK[slug])
                    self.assertEqual(slugs().get(slug), row["deck"])
                    self.assertEqual(row["cta"], "/#deck=" + slug)
                else:
                    self.assertIsNone(row["deck"])
                    self.assertTrue(row["seed"] and row["typed"])
                    self.assertTrue(row["cta"].startswith("/#s=6/"))

    def test_only_the_kurd_row_is_frozen_and_carries_inline_copy(self):
        self.assertEqual([s for s in ROWS if kind(s) == "frozen"], ["d-kurd-10"])
        self.assertIn("copy", table()["d-kurd-10"])

    def test_the_page_table_rows_with_a_folder_are_listed_in_the_sitemap(self):
        sitemap = read("sitemap.xml")
        for slug in ROWS:
            if exists(slug):
                with self.subTest(slug=slug):
                    self.assertIn("<loc>%sscales/%s/</loc>" % (SITE, slug), sitemap)


class GeneratorTest(unittest.TestCase):
    def test_the_frozen_kurd_page_regenerates_byte_identical(self):
        self.assertEqual(gen.page_for("d-kurd-10"), read("scales/d-kurd-10/index.html"))

    def test_every_existing_page_regenerates_byte_identical_from_its_copy(self):
        for slug in ROWS:
            if exists(slug) and slug != "d-kurd-10":
                with self.subTest(slug=slug):
                    self.assertEqual(gen.page_for(slug), read("scales/%s/index.html" % slug))

    def test_check_flag_exits_zero_for_kurd(self):
        run = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "gen_scale_page.py"),
                              "d-kurd-10", "--check"], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)

    def test_the_card_fixture_has_not_drifted_from_the_engine(self):
        self.assertEqual(gen.fixture_data(gen.load_rows()), read("tests/fixtures/scale_pages_v1.json"))

    def test_fixture_card_counts_match_the_oracle(self):
        fx = fixture()
        self.assertEqual(set(fx), set(ROWS))
        for slug, (_, _, total, _, _) in ROWS.items():
            with self.subTest(slug=slug):
                self.assertEqual(fx[slug]["count"], total)
                self.assertGreaterEqual(fx[slug]["count"], 3)

    def test_built_in_fixtures_are_the_decks_json_data(self):
        data = decks()
        for slug, deck in BUILT_IN_DECK.items():
            with self.subTest(slug=slug):
                self.assertEqual(fixture()[slug]["deck_id"], deck)
                self.assertEqual(fixture()[slug]["fields"], data[deck]["fields"])
                self.assertEqual(fixture()[slug]["geom"], data[deck]["geom"])

    def test_picked_cards_are_the_i_iv_v_triads_when_all_three_exist(self):
        for slug, fx in fixture().items():
            with self.subTest(slug=slug):
                degs = [c["degree"].lower() for c in fx["cards"]]
                if fx["auto_pick"] != [1, 2, 3] or degs == ["i", "iv", "v"]:
                    self.assertEqual(degs, ["i", "iv", "v"])
                    for c in fx["cards"]:
                        self.assertEqual(len(c["fields"]), 3)
                        self.assertRegex(c["main"], r"^[A-G][#b]?m?$")
                        self.assertEqual(c["sup"], "")
                else:
                    self.assertEqual([c["n"] for c in fx["cards"]], [1, 2, 3])

    def test_stored_picks_agree_with_the_fixture(self):
        t = table()
        for slug, fx in fixture().items():
            with self.subTest(slug=slug):
                self.assertEqual([c["n"] for c in fx["cards"]], t[slug]["pick"])

    def test_share_links_decode_to_the_fixture_deck_and_re_encode_canonically(self):
        links = []
        t = table()
        for slug, row in t.items():
            if row["cta"].startswith("/#s="):
                links.append([slug, row["cta"][4:], fixture()[slug]["deck_id"]])
        for slug, ids in gen.engine(list(t.values()))["alt"].items():
            links.append([slug + ":alt", ids["share"], None])
        script = r"""
const W = process.env.GSP_ROOT;
const { loadEngine } = require(W + "/tools/engine_loader.js");
const HPE = loadEngine(["core", "voicing", "layout", "naming", "select", "share"]);
const out = JSON.parse(require("fs").readFileSync(0, "utf8")).map(([slug, code, id]) => {
  const d = HPE.share.decode(code);
  if (!d.ok) return [slug, "refused " + d.code];
  const again = HPE.share.encode(d.value);
  const b = HPE.select.build(d.value);
  if (!b.ok) return [slug, "build " + b.code];
  if (id && b.value.id !== id) return [slug, "id " + b.value.id + " != " + id];
  if (!again.ok || again.value !== code) return [slug, "not canonical " + (again.value || again.code)];
  return [slug, "ok"];
});
process.stdout.write(JSON.stringify(out));
"""
        run = subprocess.run(["node", "-e", script], input=json.dumps(links), capture_output=True, text=True,
                             env=dict(os.environ, GSP_ROOT=ROOT), cwd=ROOT)
        self.assertEqual(run.returncode, 0, run.stderr)
        for slug, verdict in json.loads(run.stdout):
            with self.subTest(link=slug):
                self.assertEqual(verdict, "ok")


class ScalePagesTest(unittest.TestCase):
    def test_h1_and_primary_cta(self):
        for slug in ROWS:
            html = html_of(slug)
            name = table()[slug]["name"]
            with self.subTest(page=slug):
                self.assertEqual(re.findall(r"<h1>(.*?)</h1>", html, re.S), [name + " handpan chords"])
                self.assertEqual(len(re.findall(r"<h1", html)), 1)
                self.assertIn("PRACTICE " + name.upper(), " ".join(Page(html).text))

    def test_kurd_keeps_its_known_copy(self):
        for slug, want in KNOWN.items():
            html = html_of(slug)
            p = Page(html)
            with self.subTest(page=slug):
                self.assertEqual(re.findall(r"<h1>(.*?)</h1>", html, re.S), [want["h1"]])
                self.assertIn(want["cta"], " ".join(p.text))
                self.assertEqual([n for n, _, _ in cards(html)], want["cards"])
                for alias in want["aliases"]:
                    self.assertIn(alias, " ".join(p.text))

    def test_cards_are_inline_shadow_dom_in_the_deck_colours(self):
        for slug in ROWS:
            html = html_of(slug)
            found = cards(html)
            colors = fixture()[slug]["colors"]
            with self.subTest(page=slug):
                self.assertEqual(len(found), 3)
                self.assertNotIn("<iframe", html.lower())
                for name, attrs, body in found:
                    self.assertIn("<svg", body)
                    self.assertIn(colors["root"], body)
                    self.assertIn(colors["tone"], body)
                    self.assertRegex(body, r"background:\s*#fff")
                    self.assertRegex(body, r"border:\s*3px solid var\(--root\)")
                    self.assertNotIn("<script", body)

    def test_card_palette_matches_the_row(self):
        for slug, (_, palette, _, _, _) in ROWS.items():
            with self.subTest(slug=slug):
                if kind(slug) == "new":
                    self.assertEqual(fixture()[slug]["colors"]["root"], PALETTES[palette])
                self.assertEqual(table()[slug]["palette"], palette)

    def test_palette_family_rule_no_cross_family_link_shares_a_palette_or_swapped_pair(self):
        t = table()
        for slug, row in t.items():
            if not row.get("cross") or row["family"] == t[row["cross"]["to"]]["family"]:
                continue
            other = t[row["cross"]["to"]]
            with self.subTest(slug=slug):
                self.assertNotEqual(row["palette"], other["palette"])
                self.assertNotEqual((row["colors"]["root"], row["colors"]["tone"]),
                                    (other["colors"]["tone"], other["colors"]["root"]))

    def test_cards_stay_card_width_and_do_not_trap_scroll(self):
        for slug in ROWS:
            html = html_of(slug)
            with self.subTest(page=slug):
                self.assertIn("min(322px,100%)", html)
                self.assertNotIn("touch-action:none", html.replace(" ", ""))
                self.assertNotIn("pointer-events:none", html.replace(" ", ""))

    def test_history_section_has_popularized_by_only_when_the_row_says_so(self):
        for slug, (_, _, _, popularized, _) in ROWS.items():
            html = html_of(slug)
            with self.subTest(page=slug):
                section = re.search(r'<section class="history">(.*?)</section>', html, re.S)
                self.assertTrue(section)
                body = section.group(1)
                self.assertIn("A little history", body)
                self.assertEqual(body.count("Popularized by"), 1 if popularized else 0)
                self.assertNotIn("Created by", html)
                if popularized:
                    self.assertTrue(body.rstrip().endswith("</dl>"))
                self.assertLess(html.index('class="history"'), html.index('class="cname"'))

    def test_the_notes_line_matches_the_fixture_deck(self):
        for slug in ROWS:
            fields = fixture()[slug]["fields"].values()
            ding = [f for f in fields if f[3] == "ding"][0]
            top = sorted((f for f in fields if f[3] not in ("ding", "bottom")), key=lambda f: f[2])
            bottom = sorted((f for f in fields if f[3] == "bottom"), key=lambda f: f[2])
            want = "%s%s ding, %s" % (ding[0], ding[1], " ".join("%s%s" % (f[0], f[1]) for f in top))
            if bottom:
                want += ". Bottom shell: " + " ".join("%s%s" % (f[0], f[1]) for f in bottom)
            with self.subTest(page=slug):
                self.assertIn(want, Page(html_of(slug)).norm())

    def test_fonts_url_loads_all_three_card_families(self):
        for slug in ROWS:
            html = html_of(slug)
            with self.subTest(page=slug):
                for family in ("Marcellus", "Bitter", "Nunito+Sans"):
                    self.assertRegex(html, r"fonts\.googleapis\.com/css2\?[^\"]*family=%s" % re.escape(family))

    def test_each_page_has_a_section_with_its_anchor_and_the_row_app_link(self):
        for slug in ROWS:
            p = Page(html_of(slug))
            row = table()[slug]
            with self.subTest(page=slug):
                self.assertIn(slug, p.links)
                self.assertIn(row["cta"], p.links[slug])
                self.assertIn("/#add", p.links[slug])
                if kind(slug) in ("frozen", "built-in"):
                    self.assertIn("/#deck=" + slug, p.links[slug])
                else:
                    self.assertTrue(any(h.startswith("/#s=6/") for h in p.links[slug]))

    def test_cross_link_wording_and_target(self):
        t = table()
        for slug, (_, _, _, _, cross) in ROWS.items():
            p = Page(html_of(slug))
            with self.subTest(page=slug):
                if cross is None:
                    self.assertFalse(any(h.startswith("/scales/") for h in p.links[slug]))
                    continue
                self.assertIn("%s Open %s." % (LEADS[slug], t[cross]["name"]), p.tidy())
                self.assertIn(t[slug]["cross"]["href"], p.links[slug])
                if slug != "d-kurd-10":
                    self.assertEqual(t[slug]["cross"]["href"], "/scales/%s/" % cross)

    def test_the_sabye_page_carries_the_muted_alt_share_and_no_page_link(self):
        p = Page(html_of("d-sabye-9"))
        self.assertIn("Playing a C pan? Open C Sabye 9.", p.tidy())
        self.assertTrue(any(h.startswith("/#s=6/") and "C+SABYE+9" in h for h in p.links["d-sabye-9"]))

    def test_aria_labels_name_the_chord_and_notes_on_every_kind_but_frozen(self):
        for slug in ROWS:
            html = html_of(slug)
            labels = [re.search(r'aria-label="([^"]*)"', attrs).group(1) for _, attrs, _ in cards(html)]
            with self.subTest(page=slug):
                for label in labels:
                    if kind(slug) == "frozen":
                        self.assertRegex(label, r"^[A-G]\S* chord card$")
                    else:
                        self.assertRegex(label, r"^[A-G]\S* chord card: ([A-G][#b]?\d ?)+$")

    def test_no_script_but_the_json_ld_block_on_non_frozen_pages(self):
        for slug in ROWS:
            html = html_of(slug)
            p = Page(html)
            with self.subTest(page=slug):
                if kind(slug) == "frozen":
                    self.assertEqual(p.scripts, [])
                else:
                    self.assertEqual([s[0] for s in p.scripts], ["application/ld+json"])
                for needle in ("googletagmanager", "gtag", "g-qtywb2hssv", "google-analytics"):
                    self.assertNotIn(needle, html.lower())

    def test_visible_text_says_scale_never_deck(self):
        for slug in ROWS:
            with self.subTest(page=slug):
                self.assertIsNone(re.search(r"deck", Page(html_of(slug)).visible(), re.I))

    def test_head_has_title_description_canonical(self):
        for slug in ROWS:
            p = Page(html_of(slug))
            url = SITE + "scales/%s/" % slug
            with self.subTest(page=slug):
                self.assertTrue(any(t == "title" for t, _ in p.tags))
                self.assertTrue(p.meta("description"))
                self.assertTrue(p.meta("og:title", "property"))
                self.assertEqual(p.canonical(), url)
                self.assertEqual(p.meta("og:url", "property"), url)
                if exists(slug):
                    self.assertIn("<loc>%s</loc>" % url, read("sitemap.xml"))

    def test_svg_labels_have_spaced_attributes_and_octave_tspans(self):
        for slug in ROWS:
            with self.subTest(page=slug):
                html = html_of(slug)
                self.assertIsNone(re.search(r"<tspan[a-zA-Z]", html))
                self.assertIsNone(re.search(r"\"[a-zA-Z-]+=\"", html))
                self.assertRegex(html, r"<tspan [^>]*>\d</tspan>")

    def test_page_links_back_to_the_app_root(self):
        for slug in ROWS:
            with self.subTest(page=slug):
                self.assertIn("/", Page(html_of(slug)).hrefs())

    def test_only_allowed_external_hosts(self):
        for slug in ROWS:
            with self.subTest(page=slug):
                hosts = set(re.findall(r"https?://([^/\"'\s)]+)", html_of(slug)))
                self.assertLessEqual(hosts, ALLOWED_HOSTS)

    def test_a_bottom_shell_pan_draws_dashed_bottom_circles_and_says_so(self):
        for slug, fx in fixture().items():
            has_bottom = any(f[3] == "bottom" for f in fx["fields"].values())
            html = html_of(slug)
            with self.subTest(page=slug):
                self.assertEqual("stroke-dasharray" in html, has_bottom)
                if has_bottom:
                    self.assertIn("bottom-shell", html)
                    self.assertIn("Bottom shell:", html)

    def test_each_generated_page_is_under_sixty_kilobytes(self):
        for slug in ROWS:
            with self.subTest(page=slug):
                self.assertLess(len(html_of(slug).encode("utf-8")), SIZE_CAP)


class ContrastTest(unittest.TestCase):
    def test_accents_pass_the_theme_contrast_checks(self):
        for slug, row in table().items():
            light, dark = row["accent_light"], row["accent_dark"]
            with self.subTest(slug=slug):
                self.assertGreaterEqual(ratio(light, BG_LIGHT), 4.5)
                self.assertGreaterEqual(ratio(light, "#ffffff"), 4.5)
                self.assertGreaterEqual(ratio(dark, BG_DARK), 4.5)
                self.assertGreaterEqual(ratio(dark, BG_DARK), 4.5)
                html = html_of(slug)
                self.assertIn("--r:%s}" % light, html)
                self.assertIn("--r:%s}}" % dark, html)

    def test_the_kurd_accents_are_the_shipped_pair(self):
        row = table()["d-kurd-10"]
        self.assertEqual((row["accent_light"], row["accent_dark"]), ("#2563B0", "#7fb0ee"))

    def test_an_accent_that_already_passes_is_unchanged(self):
        for root in ("#2563B0", "#6D40A3", "#B3263A"):
            self.assertEqual(gen.accents(root)[0], root)

    def test_a_failing_root_is_darkened_or_lightened_just_enough(self):
        light, dark = gen.accents("#E2761B")
        self.assertNotEqual(light, "#E2761B")
        self.assertGreaterEqual(ratio(light, BG_LIGHT), 4.5)
        self.assertLess(ratio(light, BG_LIGHT), 4.8)
        self.assertEqual(dark, "#E2761B")

    def test_cta_buttons_are_at_least_44px_and_dark_theme_overrides_exist(self):
        for slug in ROWS:
            html = html_of(slug)
            with self.subTest(page=slug):
                self.assertIn("padding:12px 16px", html)
                self.assertIn("font-size:14px", html)
                self.assertIn("@media (prefers-color-scheme:dark){:root{", html)
                self.assertIn("background:#fff;color:#242424", html)


class SeoDeltaTest(unittest.TestCase):
    def new_slugs(self):
        return [s for s in ROWS if kind(s) != "frozen"]

    def test_og_image_site_name_and_matching_titles(self):
        for slug in self.new_slugs():
            p = Page(html_of(slug))
            with self.subTest(page=slug):
                self.assertEqual(p.meta("og:image", "property"), SITE + "og.png")
                self.assertEqual(p.meta("og:site_name", "property"), "Handpan Chords")
                self.assertEqual(p.meta("og:description", "property"), p.meta("description"))
                title = [t for t in re.findall(r"<title>(.*?)</title>", html_of(slug))][0]
                self.assertEqual(p.meta("og:title", "property"), title.replace("&amp;", "&"))

    def test_frozen_page_has_no_seo_additions(self):
        html = html_of("d-kurd-10")
        for needle in ("og:image", "og:site_name", "ld+json", "<table", "Last updated"):
            self.assertNotIn(needle, html)

    def test_visible_chord_table_lists_the_picked_cards(self):
        for slug in self.new_slugs():
            html = html_of(slug)
            with self.subTest(page=slug):
                body = re.search(r"<table class=\"chords\">(.*?)</table>", html, re.S).group(1)
                rows = re.findall(r"<tr><td>(.*?)</td><td>(.*?)</td><td>(.*?)</td></tr>", body)
                self.assertEqual(len(rows), 3)
                for (name, notes, nums), c in zip(rows, fixture()[slug]["cards"]):
                    self.assertEqual(name, c["main"] + c["sup"])
                    self.assertEqual(notes, c["notes"])
                    self.assertEqual(nums, c["numbers"])

    def test_json_ld_is_one_graph_and_every_string_is_visible(self):
        for slug in self.new_slugs():
            p = Page(html_of(slug))
            with self.subTest(page=slug):
                self.assertEqual(len(p.scripts), 1)
                graph = json.loads(p.scripts[0][1])
                self.assertEqual(graph["@type"], "WebPage")
                self.assertEqual(graph["breadcrumb"]["@type"], "BreadcrumbList")
                self.assertEqual(graph["mainEntity"]["@type"], "ItemList")
                self.assertEqual(graph["publisher"], {"@type": "Organization", "name": "Handpan Chords"})
                self.assertNotIn("description", graph)
                visible = p.norm()
                for s in strings(graph):
                    self.assertIn(re.sub(r"\s+", " ", s), visible)

    def test_json_ld_urls_are_canonical_or_a_sitemap_loc(self):
        for slug in self.new_slugs():
            graph = json.loads(Page(html_of(slug)).scripts[0][1])
            url = SITE + "scales/%s/" % slug
            with self.subTest(page=slug):
                self.assertEqual(graph["url"], url)
                items = graph["breadcrumb"]["itemListElement"]
                self.assertEqual([i["item"] for i in items], [SITE, url])

    def test_date_modified_equals_the_visible_last_updated(self):
        for slug in self.new_slugs():
            html = html_of(slug)
            graph = json.loads(Page(html).scripts[0][1])
            with self.subTest(page=slug):
                m = re.search(r'Last updated <time datetime="([^"]+)">([^<]+)</time>', html)
                self.assertTrue(m)
                self.assertEqual(m.group(1), m.group(2))
                self.assertEqual(graph["dateModified"], m.group(1))

    def test_breadcrumb_replaces_the_back_link_and_publisher_is_in_the_footer(self):
        for slug in self.new_slugs():
            p = Page(html_of(slug))
            with self.subTest(page=slug):
                self.assertIn("Home › %s chords" % table()[slug]["name"], p.norm())
                self.assertNotIn("← Handpan Chords", p.norm())
                self.assertIn("Handpan Chords is free in your browser", p.norm())

    def test_links_to_handpan_101_card_count_and_descriptive_app_link(self):
        for slug in self.new_slugs():
            p = Page(html_of(slug))
            with self.subTest(page=slug):
                self.assertIn("/handpan-101/", p.hrefs())
                self.assertIn("Handpan 101: how to play a handpan", p.norm())
                self.assertIn("The app has %d chord cards for this scale." % ROWS[slug][2], p.norm())
                self.assertTrue(any(h.startswith("/#") for h in p.hrefs()))


if __name__ == "__main__":
    unittest.main()
