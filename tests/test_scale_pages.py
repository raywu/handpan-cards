import contextlib
import io
import tempfile
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
                 "www.youtube.com", "www.sarazhandpans.com", "www.handpan.world",
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
BROWN = "#1a1815"
SHARED_ROOT = ":root{color-scheme:dark;--bg:#1a1815;--fg:#eae6df;--muted:#c4bcab;--r:#e3b25c;"
SHARED_RULES = [
    "body{background:var(--bg);color:var(--fg);font-family:\"Nunito Sans\",system-ui,sans-serif;line-height:1.55;",
    "h1{font-family:Marcellus,serif;font-weight:400;font-size:clamp(30px,7vw,44px);margin:0;line-height:1.15}",
    "font-size:24px;",
    "a{color:var(--r);font-weight:600;text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:3px}",
    "a:hover{text-decoration-thickness:2.5px}",
    "a:focus-visible{outline:2px solid currentColor;outline-offset:2px;border-radius:2px}",
]

# Independent oracle for the plan's page table (Round 4 dispositions, row 0 from Round 7 H3,
# Equinox and Magic Voyage). kind, palette index, cards in the deck, popularized, cross-link target.
ROWS = {
    "d-kurd-10": ("built-in", 6, 49, True, "d-kurd-9"),
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
_ENGINE = {}


def rendered(slug):
    if slug not in _RENDERED:
        rows = gen.load_rows()
        by = {r["slug"]: r for r in rows}
        row = by[slug]
        if not _ENGINE:
            _ENGINE.update(gen.engine(rows))
        data = _ENGINE
        copy = row.get("copy") or dict(gen.SAMPLE_COPY)
        if not row["popularized"]:
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
    return [(re.search(r'<div class="fname">(.*?)</div>', body, re.S).group(1).replace("<sup>", "").replace("</sup>", ""),
             re.search(r'<div class="diagwrap" role="img"([^>]*)>', body).group(1), body)
            for body in re.findall(r'<template shadowrootmode="open">(.*?)</template>', html, re.S)]


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
                if kind(slug) == "built-in":
                    self.assertEqual(row["deck"], BUILT_IN_DECK[slug])
                    self.assertEqual(slugs().get(slug), row["deck"])
                    self.assertEqual(row["cta"], "/#deck=" + slug)
                else:
                    self.assertIsNone(row["deck"])
                    self.assertTrue(row["seed"] and row["typed"])
                    self.assertTrue(row["cta"].startswith("/#s=6/"))

    def test_no_row_is_frozen(self):
        self.assertEqual([r["slug"] for r in gen.load_rows() if r["kind"] == "frozen"], [])
        self.assertNotIn("copy", table()["d-kurd-10"])
        copy = gen.load_copy(table()["d-kurd-10"])
        self.assertNotIn("og_description", copy)
        self.assertTrue(os.path.exists(os.path.join(ROOT, "scales", "d-kurd-10", "copy.json")))

    def test_the_page_table_rows_with_a_folder_are_listed_in_the_sitemap(self):
        sitemap = read("sitemap.xml")
        for slug in ROWS:
            if exists(slug):
                with self.subTest(slug=slug):
                    self.assertIn("<loc>%sscales/%s/</loc>" % (SITE, slug), sitemap)


class GeneratorTest(unittest.TestCase):
    KURD_10_LINKS = {
        "canonical": "https://handpan.raywu.org/scales/d-kurd-10/",
        "cta": "/#deck=d-kurd-10",
        "cross": "/#s=6/(D3)_A3_Bb3_C4_D4_E4_F4_G4_A4/D+Kurd+9/300038",
        "also_try": [
            "https://handpan.raywu.org/#s=6/(Cs3)_Gs3_A3_B3_Cs4_Ds4_E4_Fs4_Gs4/C%23+Annaziska+9/24f03b",
            "https://handpan.raywu.org/#s=6/(Cs3)_uE3_uFs3_Gs3_A3_B3_Cs4_Ds4_E4_Fs4_Gs4_uB4_uCs5/C%23+Annaziska+13/palette-2/402803",
        ],
    }

    def test_kurd_10_keeps_its_url_canonical_cta_cross_and_also_try_links(self):
        want = self.KURD_10_LINKS
        row = table()["d-kurd-10"]
        html = read("scales/d-kurd-10/index.html")
        self.assertEqual(row["cta"], want["cta"])
        self.assertEqual(row["cross"]["href"], want["cross"])
        self.assertEqual([a["href"] for a in row["also_try"]], want["also_try"])
        self.assertIn('<link rel="canonical" href="%s">' % want["canonical"], html)
        hrefs = re.findall(r'href="([^"]*)"', html)
        for h in [want["cta"], want["cross"]] + want["also_try"]:
            self.assertIn(h.replace("&", "&amp;"), [x for x in hrefs] + [x.replace("&amp;", "&") for x in hrefs])

    def test_every_existing_page_regenerates_byte_identical_from_its_copy(self):
        slugs = [s for s in ROWS if exists(s)]
        pages = gen.pages_for(slugs)
        for slug in slugs:
            with self.subTest(slug=slug):
                self.assertEqual(pages[slug], read("scales/%s/index.html" % slug))

    def test_check_flag_exits_zero_for_kurd(self):
        run = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "gen_scale_page.py"),
                              "d-kurd-10", "--check"], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)

    def test_check_flag_exits_zero_for_the_hub(self):
        run = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "gen_scale_page.py"),
                              "--hub", "--check"], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)

    def test_a_differing_page_fails_check_with_one_message(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "index.html")
            with open(path, "w", encoding="utf-8") as f:
                f.write("stale")
            with contextlib.redirect_stderr(io.StringIO()) as err:
                self.assertEqual(gen.emit(path, "fresh", True, False), 1)
            self.assertIn("differs from the generator", err.getvalue())

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
                    self.assertRegex(body, r"\.card\{[^}]*border:\s*3\.2px solid var\(--root\)")
                    self.assertRegex(body, r"\.front\{[^}]*border:\s*3\.2px solid var\(--root\)")
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
                css = html.replace(" ", "")
                for sel in re.findall(r"([^{}]*)\{[^{}]*pointer-events:none", css):
                    self.assertTrue(sel.strip().startswith(".prog"), "only the stepper takes pointer-events:none: " + sel)

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
                self.assertLess(html.index('class="history"'), html.index('class="prog"'))

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
                if kind(slug) == "built-in":
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

    def test_aria_labels_name_the_chord_and_notes_on_every_page(self):
        for slug in ROWS:
            html = html_of(slug)
            labels = [re.search(r'aria-label="([^"]*)"', attrs).group(1) for _, attrs, _ in cards(html)]
            with self.subTest(page=slug):
                for label in labels:
                    self.assertRegex(label, r"^[A-G]\S* chord card: ([A-G][#b]?\d ?)+$")

    def test_scripts_are_the_json_ld_block_and_the_one_swipe_script(self):
        for slug in ROWS:
            html = html_of(slug)
            p = Page(html)
            with self.subTest(page=slug):
                self.assertEqual([s[0] for s in p.scripts], ["application/ld+json", None])
                self.assertEqual(p.scripts[1][1], gen.SWIPE_JS)
                tail = "<script>" + gen.SWIPE_JS + "</script>\n</main>\n</body>\n</html>\n"
                self.assertTrue(html.endswith(tail))
                self.assertEqual(html.count("<script>"), 1)
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


class StepperTest(unittest.TestCase):
    def test_one_progression_stepper_of_three_steps_with_one_checked(self):
        for slug in ROWS:
            html = html_of(slug)
            with self.subTest(page=slug):
                self.assertEqual(html.count('class="prog"'), 1)
                radios = re.findall(r'<input type="radio"([^>]*)>', html)
                self.assertEqual(len(radios), 3)
                self.assertEqual(sum(" checked" in r for r in radios), 1)
                self.assertIn("checked", radios[0])
                for i, r in enumerate(radios, 1):
                    self.assertRegex(r, r'aria-label="Chord %d of 3: [A-G]\S*"' % i)
                self.assertEqual(re.findall(r'<div class="step">(.*?)</div>', html),
                                 ["Chord 1 of 3", "Chord 2 of 3", "Chord 3 of 3"])

    def test_each_card_has_a_flip_checkbox_a_front_with_the_name_and_a_back_with_the_diagram(self):
        for slug in ROWS:
            html = html_of(slug)
            names = [c["main"] + c["sup"] for c in fixture()[slug]["cards"]]
            with self.subTest(page=slug):
                found = cards(html)
                self.assertEqual([n for n, _, _ in found], names)
                for _, _, body in found:
                    self.assertEqual(body.count('type="checkbox"'), 1)
                    self.assertIn('aria-label="Flip card: ', body)
                    front = re.search(r'<div class="face front">(.*?)</div></div><div class="face back">', body, re.S).group(1)
                    self.assertIn("Tap to reveal the notes", front)
                    self.assertNotIn("<svg", front)
                    back = body.split('class="face back"')[1]
                    self.assertIn("<svg", back)
                    self.assertIn("prefers-reduced-motion", body)
                    self.assertIn("-webkit-backface-visibility", body)
                    self.assertIn("preserve-3d", body)

    def test_no_prev_label_on_step_one_and_no_next_label_on_step_three(self):
        for slug in ROWS:
            html = html_of(slug)
            with self.subTest(page=slug):
                navs = re.findall(r'<div class="nav">(.*?)</div></div>', html)
                self.assertEqual(len(navs), 3)
                self.assertNotIn("PREV", navs[0])
                self.assertIn('for="p2">NEXT', navs[0])
                self.assertIn('for="p1">PREV', navs[1])
                self.assertIn('for="p3">NEXT', navs[1])
                self.assertIn('for="p2">PREV', navs[2])
                self.assertNotIn("NEXT", navs[2])

    def test_only_two_scripts_and_the_light_dom_progression_line_stays(self):
        for slug in ROWS:
            html = html_of(slug)
            with self.subTest(page=slug):
                self.assertEqual(html.count("<script"), 2)
                self.assertIn("Starter progression:", html)


class SwipeScriptTest(unittest.TestCase):
    FIXTURE_DIR = os.path.join("tests", "fixtures", "scale_pages_pre_swipe")

    def fixture_slugs(self):
        return [s for s in ROWS if s != "d-kurd-10"]

    def test_swipe_script_is_inline_with_no_network_or_globals(self):
        js = gen.SWIPE_JS
        for needle in ("fetch", "XMLHttpRequest", "gtag", "import(", "http"):
            self.assertNotIn(needle, js)
        self.assertTrue(js.startswith(read("src/engine/swipe.js").rstrip("\n")))
        driver = js[len(read("src/engine/swipe.js").rstrip("\n")):].strip()
        self.assertRegex(driver, re.compile(r"^\(function\s*\(\)\s*\{.*\}\)\(\);?$", re.S))
        self.assertNotRegex(js, r"\bwindow\.\w+\s*=")

    def test_swipe_constants_match_the_app(self):
        app = read("src/engine/swipe.js")
        m = re.search(r"const SWIPE_COMMIT_PX = (\d+), SWIPE_FLING_PX_MS = ([\d.]+), "
                      r"SWIPE_FLING_WINDOW_MS = (\d+), SWIPE_SLOP_PX = (\d+);", app)
        self.assertTrue(m)
        commit, fling, window, slop = m.groups()
        self.assertEqual(gen.SWIPE_CONSTANTS, {"COMMIT": int(commit), "FLING": float(fling),
                                               "WINDOW": int(window), "SLOP": int(slop)})

    def test_the_page_script_contains_the_engine_swipe_module_byte_for_byte(self):
        module = read("src/engine/swipe.js").rstrip("\n")
        for slug in ROWS:
            with self.subTest(slug=slug):
                self.assertIn("<script>" + module + "\n(function(){", read("scales/%s/index.html" % slug))

    def test_the_driver_takes_every_swipe_constant_from_the_module(self):
        driver = gen.SWIPE_DRIVER
        for pattern in (r"\b(COMMIT|FLING|WINDOW|SLOP|TILT)\w*\s*=", r"\b(18|0\.15|220|180|260|24)\b"):
            self.assertNotRegex(driver, pattern)
        for name in ("SLOP_PX", "FLING_WINDOW_MS", "OUT_MS", "OUT_EASE", "IN_MS", "IN_PX", "BACK_MS", "EASE", "xf", "releaseDecision"):
            self.assertIn("W." + name, driver)

    def test_swipe_script_fits_its_budget(self):
        self.assertLessEqual(len(gen.SWIPE_JS.encode()), 5800)

    @staticmethod
    def without_card_css(html):
        html = re.sub(r"<style>[^<]*</style>(?=<label class=\"wrap\">)", "<style></style>", html)
        return re.sub(r"scroll-margin-top:min\(\d+px,", "scroll-margin-top:min(Npx,", html)

    def test_js_off_markup_is_unchanged(self):
        s = "<script>" + gen.SWIPE_JS + "</script>\n"
        for slug in self.fixture_slugs():
            with self.subTest(slug=slug):
                page = read("scales/%s/index.html" % slug)
                self.assertEqual(page.count(s), 1)
                self.assertEqual(self.without_card_css(page.replace(s, "", 1)),
                                 self.without_card_css(read("%s/%s.html" % (self.FIXTURE_DIR, slug))))

    def test_the_card_css_copies_the_apps_values(self):
        app = re.sub(r"\s+", " ", read("index.html"))
        css = gen.CARD_CSS
        for value in ("perspective:1400px", "transition:transform .45s cubic-bezier(.2,.7,.25,1)", "border-radius:12px",
                      "box-shadow:0 12px 34px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.4)", "padding:3.2px"):
            self.assertIn(value, app)
        for value in ("perspective:1400px", "transition:transform .45s cubic-bezier(.2,.7,.25,1)", "border-radius:12px",
                      "box-shadow:0 12px 34px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.4)", "border:3.2px solid var(--root)"):
            self.assertIn(value, css)

    def test_the_answer_face_is_the_default_and_the_name_face_the_flip(self):
        css = gen.CARD_CSS
        self.assertIn(".front{transform:rotateY(180deg)}", css)
        self.assertNotIn(".back{transform", css)
        self.assertIn(".front .hint{display:none}", css)

    def test_every_row_page_regenerates_with_the_script(self):
        for slug in ROWS:
            with self.subTest(slug=slug):
                self.assertIn("<script>" + gen.SWIPE_JS + "</script>\n", read("scales/%s/index.html" % slug))

    def test_the_hub_has_no_swipe_script(self):
        self.assertNotIn("<script", read("scales/index.html"))


class ContrastTest(unittest.TestCase):
    def test_accents_pass_the_theme_contrast_checks(self):
        for slug, row in table().items():
            light, dark = row["accent_light"], row["accent_dark"]
            with self.subTest(slug=slug):
                self.assertGreaterEqual(ratio(light, BG_LIGHT), 4.5)
                self.assertGreaterEqual(ratio(light, "#ffffff"), 4.5)
                self.assertGreaterEqual(ratio(dark, BG_DARK), 4.5)
                html = html_of(slug)
                self.assertIn("--r:%s}" % light, html)
                self.assertIn("--r:%s}}" % dark, html)

    def test_the_kurd_accents_are_the_shipped_pair(self):
        row = table()["d-kurd-10"]
        self.assertEqual((row["accent_light"], row["accent_dark"]), ("#2563B0", "#7fb0ee"))

    def test_non_frozen_accents_are_the_generator_rule(self):
        for slug, row in table().items():
            if slug != "d-kurd-10":
                with self.subTest(slug=slug):
                    root = fixture()[slug]["colors"]["root"]
                    self.assertEqual((row["accent_light"], row["accent_dark"]), gen.accents(root))

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
        return list(ROWS)

    def test_og_image_site_name_and_matching_titles(self):
        for slug in self.new_slugs():
            p = Page(html_of(slug))
            with self.subTest(page=slug):
                self.assertEqual(p.meta("og:image", "property"), SITE + "og.png")
                self.assertEqual(p.meta("og:site_name", "property"), "Handpan Chords")
                self.assertEqual(p.meta("og:description", "property"), p.meta("description"))
                title = [t for t in re.findall(r"<title>(.*?)</title>", html_of(slug))][0]
                self.assertEqual(p.meta("og:title", "property"), title.replace("&amp;", "&"))

    def test_every_title_is_the_h1(self):
        for slug in ROWS:
            html = html_of(slug)
            with self.subTest(page=slug):
                h1 = re.findall(r"<h1>(.*?)</h1>", html, re.S)
                self.assertEqual(re.findall(r"<title>(.*?)</title>", html), h1)
                self.assertEqual(h1, [table()[slug]["name"] + " handpan chords"])

    def test_there_is_no_chord_table_on_any_page(self):
        for slug in ROWS:
            with self.subTest(page=slug):
                self.assertNotIn("<table", html_of(slug))
                self.assertNotIn("table.chords", html_of(slug))

    def test_json_ld_is_one_graph_and_every_string_is_visible(self):
        for slug in self.new_slugs():
            p = Page(html_of(slug))
            with self.subTest(page=slug):
                self.assertEqual(len(p.scripts), 2)
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


GROUPS = ["Minor", "Celtic minor", "Pentatonic minor", "Major and bright", "Middle Eastern and Japanese"]


class HubAndSiblingsTest(unittest.TestCase):
    def test_every_entry_has_a_known_group_and_the_groups_hold_sixteen(self):
        rows = gen.load_rows()
        self.assertEqual([r["group"] for r in rows if r["group"] not in GROUPS], [])
        self.assertEqual(len(rows), 16)
        self.assertEqual(list(dict.fromkeys(r["group"] for r in rows)), GROUPS)

    def test_the_hub_lists_all_sixteen_under_the_five_headings_in_order(self):
        html = read("scales/index.html")
        self.assertEqual(html, gen.hub_page())
        self.assertEqual(re.findall(r"<h1>(.*?)</h1>", html), ["Handpan scale chord charts"])
        self.assertEqual(re.findall(r"<h2>(.*?)</h2>", html), GROUPS)
        want = [(r["slug"], r["name"]) for r in gen.load_rows()]
        got = re.findall(r'<li><a href="/scales/([a-z0-9-]+)/">(.*?) handpan chords</a></li>', html)
        self.assertEqual(got, want)
        self.assertEqual(Page(html).canonical(), SITE + "scales/")
        self.assertIsNone(re.search(r"deck", Page(html).visible(), re.I))

    def test_each_page_links_three_other_siblings_and_the_hub(self):
        for slug, row in table().items():
            with self.subTest(page=slug):
                html = html_of(slug)
                sib = re.findall(r'<li><a href="/scales/([a-z0-9-]+)/">', html)
                self.assertEqual(len(sib), 3)
                self.assertEqual(len(set(sib)), 3)
                self.assertNotIn(slug, sib)
                self.assertTrue(set(sib) <= set(ROWS))
                self.assertIn('<a href="/scales/">All 16 handpan scale chord charts</a>', html)

    def test_siblings_come_from_the_same_group_first_then_the_next(self):
        rows = gen.load_rows()
        by = {r["slug"]: r for r in rows}
        self.assertEqual(gen.siblings(by["d-kurd-10"], rows), ["d-kurd-9", "d-integral-9", "c-sharp-mystic-8"])
        self.assertEqual(gen.siblings(by["d-sabye-9"], rows), ["d-aegean-18", "c-sharp-hijaz-9", "e-romanian-hijaz-9"])
        self.assertEqual(gen.siblings(by["f-sharp-akebono-9"], rows),
                         ["c-sharp-hijaz-9", "e-romanian-hijaz-9", "d-kurd-10"])


if __name__ == "__main__":
    unittest.main()


class AlsoTryTest(unittest.TestCase):
    LINKS = [
        ("C# Annaziska 9", "https://handpan.raywu.org/#s=6/(Cs3)_Gs3_A3_B3_Cs4_Ds4_E4_Fs4_Gs4/C%23+Annaziska+9/24f03b"),
        ("C# Annaziska 13", "https://handpan.raywu.org/#s=6/(Cs3)_uE3_uFs3_Gs3_A3_B3_Cs4_Ds4_E4_Fs4_Gs4_uB4_uCs5/C%23+Annaziska+13/palette-2/402803"),
    ]

    def anchors(self, slug):
        return re.findall(r'<a href="([^"]*)">([^<]*)</a>', read("scales/%s/index.html" % slug))

    def test_only_the_two_kurd_pages_carry_both_links_with_exact_text_and_href(self):
        for slug in ROWS:
            if not exists(slug):
                continue
            with self.subTest(slug=slug):
                found = self.anchors(slug)
                has = [(t, h) for t, h in self.LINKS if (h, t) in found]
                if slug in ("d-kurd-9", "d-kurd-10"):
                    self.assertEqual(has, self.LINKS)
                    page = read("scales/%s/index.html" % slug)
                    self.assertIn("Also try", page)
                    self.assertIn('<ul class="rel also">', page)
                else:
                    self.assertEqual(has, [])
                    self.assertNotIn("Annaziska", read("scales/%s/index.html" % slug))


class SharedBrownHeadTest(unittest.TestCase):
    def test_the_explore_index_takes_the_shared_dark_only_head(self):
        html = read("scales/index.html")
        self.assertIn(SHARED_ROOT.rstrip(";") + "}", html)
        for rule in SHARED_RULES:
            with self.subTest(rule=rule):
                self.assertIn(rule, html)
        self.assertRegex(html, r"h2\{font-family:Marcellus,serif;font-weight:400;font-size:24px;margin:0;color:var\(--r\)\}")
        self.assertNotIn("prefers-color-scheme", html)
        self.assertEqual(Page(html).meta("theme-color"), BROWN)
        self.assertEqual(html, gen.hub_page())

    def test_the_scale_pages_keep_their_own_head(self):
        for slug in ROWS:
            with self.subTest(page=slug):
                html = html_of(slug)
                self.assertIn("prefers-color-scheme:dark", html)

    def test_the_about_overlay_takes_the_shared_rules(self):
        css = read("index.html")
        about = css[css.index("#about{position:fixed"):css.index("html.about-open{")]
        self.assertNotIn("#1f1b15", about)
        self.assertIn("background:#1a1815", about)
        self.assertRegex(about, r"\.abouthead\{[^}]*background:#1a1815")
        self.assertRegex(about, r"color:#eae6df; font:400 16px/1\.55 \"Nunito Sans\"")
        self.assertRegex(about, r'#about h2\{[^}]*font:400 clamp\(30px, 7vw, 44px\)/1\.15 "Marcellus", serif')
        self.assertRegex(about, r'#about h3\{[^}]*font:400 24px/1\.2 "Marcellus", serif[^}]*color:#e3b25c')
        self.assertNotIn("text-transform:uppercase", about)
        self.assertRegex(about, r"#about h4\{[^}]*color:#c4bcab")
        self.assertRegex(about, r"#about a\{color:#e3b25c; font-weight:600; text-decoration:underline; text-decoration-thickness:1\.5px; text-underline-offset:3px\}")
        self.assertIn("calc((100% - 520px) / 2)", about)

    def test_every_primary_passes_contrast_on_the_brown(self):
        for colour in ("#e3b25c", "#eae6df", "#c4bcab"):
            self.assertGreaterEqual(ratio(colour, BROWN), 4.5)
