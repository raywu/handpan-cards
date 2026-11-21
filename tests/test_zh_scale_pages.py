import json
import os
import re
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from test_scale_pages import Page, ROOT, SITE, strings  # noqa: E402
import gen_scale_page as gen  # noqa: E402

SCRIPTS = {"zh-Hant": "zh-hant", "zh-Hans": "zh-hans"}
SAMPLE = {
    "zh-Hant": {
        "title": "D Kurd 10 手碟和弦表", "description": "D Kurd 10 手碟的和弦表。", "updated": "2026-11-12",
        "lead_html": "從下面三張卡開始。", "alias_html": "也稱為庫德小調。",
        "history_html": ["這是範例歷史段落。"], "who_html": "範例製作者。",
        "progression_tail_html": "，只用上層。"},
    "zh-Hans": {
        "title": "D Kurd 10 手碟和弦表", "description": "D Kurd 10 手碟的和弦表。", "updated": "2026-11-13",
        "lead_html": "从下面三张卡开始。", "alias_html": "也称为库德小调。",
        "history_html": ["这是示例历史段落。"], "who_html": "示例制作者。",
        "progression_tail_html": "，只用上层。"},
}
SLUG = "d-kurd-10"
OTHER = "d-kurd-9"
BOTH = {"zh-Hant": {SLUG}, "zh-Hans": {SLUG}}
NONE = {"zh-Hant": set(), "zh-Hans": set()}
_CACHE = {}


def world():
    if not _CACHE:
        rows = gen.load_rows()
        _CACHE["rows"] = rows
        _CACHE["by"] = {r["slug"]: r for r in rows}
        _CACHE["data"] = gen.engine(rows)
    return _CACHE


def page(slug=SLUG, script="en", avail=BOTH, copy=None):
    w = world()
    row = w["by"][slug]
    if script == "en":
        c = dict(gen.SAMPLE_COPY, who_html=None) if not row["popularized"] else dict(gen.SAMPLE_COPY)
    else:
        c = copy or dict(SAMPLE[script])
        if not row["popularized"]:
            c["who_html"] = None
    return gen.render(row, w["data"]["rows"][slug], w["by"], c, w["data"]["alt"].get(slug), script=script, avail=avail)


def hub(script="en", avail=BOTH):
    return gen.hub_page(world()["rows"], script=script, avail=avail)


def alternates(html):
    return {a["hreflang"]: a["href"] for t, a in Page(html).tags if t == "link" and a.get("rel") == "alternate"}


def svgs(html):
    return re.findall(r"<svg.*?</svg>", html, re.S)


class ZhPageTest(unittest.TestCase):
    def test_head_markers_per_script(self):
        for script, d in SCRIPTS.items():
            with self.subTest(script=script):
                h = page(script=script)
                p = Page(h)
                self.assertIn('<html lang="%s">' % script, h)
                self.assertEqual(p.meta("content-language", "http-equiv"), script)
                self.assertEqual(p.meta("applicable-device"), "pc,mobile")
                url = SITE + "%s/scales/%s/" % (d, SLUG)
                self.assertEqual(p.canonical(), url)
                self.assertEqual(p.meta("og:url", "property"), url)

    def test_english_page_keeps_lang_en_and_no_zh_meta(self):
        h = page()
        self.assertIn('<html lang="en">', h)
        self.assertNotIn("content-language", h)
        self.assertNotIn("applicable-device", h)

    def test_hreflang_cluster_is_reciprocal_on_every_member(self):
        want = {"en": SITE + "scales/%s/" % SLUG, "zh-Hant": SITE + "zh-hant/scales/%s/" % SLUG,
                "zh-Hans": SITE + "zh-hans/scales/%s/" % SLUG, "x-default": SITE + "scales/%s/" % SLUG}
        for script in ("en", "zh-Hant", "zh-Hans"):
            with self.subTest(script=script):
                self.assertEqual(alternates(page(script=script)), want)

    def test_hub_cluster_is_reciprocal_on_every_member(self):
        want = {"en": SITE + "scales/", "zh-Hant": SITE + "zh-hant/scales/", "zh-Hans": SITE + "zh-hans/scales/",
                "x-default": SITE + "scales/"}
        for script in ("en", "zh-Hant", "zh-Hans"):
            with self.subTest(script=script):
                self.assertEqual(alternates(hub(script)), want)

    def test_missing_copy_means_no_alternate(self):
        only_hant = {"zh-Hant": {SLUG}, "zh-Hans": set()}
        for script in ("en", "zh-Hant"):
            with self.subTest(script=script):
                got = alternates(page(script=script, avail=only_hant))
                self.assertEqual(sorted(got), ["en", "x-default", "zh-Hant"])
        self.assertEqual(alternates(page(avail=NONE)), {})
        self.assertNotIn("hreflang", page(avail=NONE))
        self.assertNotIn("hreflang", hub(avail=NONE))
        self.assertEqual(sorted(alternates(page(OTHER, avail=only_hant))), [])

    def test_no_pages_dev_in_any_identity_url(self):
        for script in ("en", "zh-Hant", "zh-Hans"):
            for h in (page(script=script), hub(script)):
                self.assertNotIn("pages.dev", h)

    def test_zh_pages_load_no_third_party_font_host(self):
        for script in SCRIPTS:
            for h in (page(script=script), hub(script)):
                with self.subTest(script=script):
                    self.assertNotIn("fonts.googleapis", h)
                    self.assertNotIn("fonts.gstatic", h)
                    self.assertIn('<link rel="stylesheet" href="/fonts/fonts.css">', h)

    def test_english_pages_keep_google_fonts(self):
        for h in (page(), hub()):
            self.assertIn("fonts.googleapis.com", h)
            self.assertNotIn("/fonts/fonts.css", h)

    def test_cjk_fallback_stack_per_script(self):
        self.assertIn('"PingFang TC","Microsoft JhengHei","Noto Sans TC"', page(script="zh-Hant"))
        self.assertIn('"PingFang SC","Microsoft YaHei","Noto Sans SC"', page(script="zh-Hans"))
        self.assertNotIn("PingFang SC", page(script="zh-Hant"))

    def test_json_ld_is_one_graph_and_every_string_is_visible(self):
        for script in SCRIPTS:
            with self.subTest(script=script):
                h = page(script=script)
                p = Page(h)
                self.assertEqual(len(p.scripts), 2)
                graph = json.loads(p.scripts[0][1])
                self.assertEqual(graph["@type"], "WebPage")
                self.assertNotIn("inLanguage", graph)
                self.assertNotIn("description", graph)
                visible = p.norm()
                home = gen.load_zh()[script]["home"]
                for s in strings(graph):
                    if s == home:
                        continue
                    self.assertIn(re.sub(r"\s+", " ", s), visible)
                self.assertEqual(graph["name"], SAMPLE[script]["title"])
                self.assertEqual(graph["url"], Page(h).canonical())

    def test_date_is_the_copy_updated_everywhere(self):
        for script in SCRIPTS:
            with self.subTest(script=script):
                h = page(script=script)
                want = SAMPLE[script]["updated"]
                graph = json.loads(Page(h).scripts[0][1])
                self.assertEqual(graph["dateModified"], want)
                self.assertIn('<time datetime="%s">%s</time>' % (want, want), h)

    def test_chord_card_svgs_are_the_english_bytes(self):
        en = svgs(page())
        self.assertEqual(len(en), 3)
        for script in SCRIPTS:
            self.assertEqual(svgs(page(script=script)), en)

    def test_no_deck_in_visible_text_and_brand_untranslated(self):
        for script in SCRIPTS:
            for h in (page(script=script), hub(script)):
                with self.subTest(script=script):
                    p = Page(h)
                    self.assertNotRegex(p.visible().lower(), r"\bdecks?\b")
                    self.assertIn("Handpan Theory", p.norm())
                    self.assertNotIn("手碟理論", h)

    def test_steel_tongue_drum_line_on_page_and_hub(self):
        z = gen.load_zh()
        for script in SCRIPTS:
            self.assertIn(z[script]["not_steel"], Page(page(script=script)).norm())
            self.assertIn(z[script]["not_steel"], Page(hub(script)).norm())

    def test_same_two_scripts_as_english(self):
        for script in SCRIPTS:
            p = Page(page(script=script))
            self.assertEqual([s[0] for s in p.scripts], [s[0] for s in Page(page()).scripts])
            self.assertEqual(p.scripts[1][1], Page(page()).scripts[1][1])

    def test_zh_pages_link_zh_hub_and_english_101(self):
        for script, d in SCRIPTS.items():
            hrefs = Page(page(script=script)).hrefs()
            self.assertIn("/%s/scales/" % d, hrefs)
            self.assertIn("/handpan-101/", hrefs)
            self.assertNotIn("/scales/", hrefs)

    def test_sibling_links_follow_the_copy_that_exists(self):
        zh = lambda h: [x for x in Page(h).hrefs() if x.startswith("/zh-hant/scales/") and x != "/zh-hant/scales/"]
        self.assertEqual(zh(page(script="zh-Hant")), [])
        every = {"zh-Hant": set(world()["by"]), "zh-Hans": set()}
        self.assertGreater(len(zh(page(script="zh-Hant", avail=every))), 1)

    def test_zh_hub_lists_only_slugs_with_copy(self):
        h = hub("zh-Hant")
        links = [x for x in Page(h).hrefs() if x.startswith("/zh-hant/scales/") and x != "/zh-hant/scales/"]
        self.assertEqual(links, ["/zh-hant/scales/%s/" % SLUG])

    def test_neotone_rows_refuse_zh(self):
        w = world()
        row = dict(w["by"][SLUG], kind="frozen")
        with self.assertRaises(SystemExit):
            gen.render(row, w["data"]["rows"][SLUG], w["by"], dict(SAMPLE["zh-Hant"]), script="zh-Hant", avail=BOTH)


class ZhCliTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.old = gen.SITE_DIR
        gen.SITE_DIR = self.tmp.name
        self.addCleanup(setattr, gen, "SITE_DIR", self.old)
        d = os.path.join(self.tmp.name, "scales", SLUG)
        os.makedirs(d)
        with open(os.path.join(d, "copy.zh-Hant.json"), "w", encoding="utf-8") as f:
            json.dump(SAMPLE["zh-Hant"], f, ensure_ascii=False)

    def out(self, *parts):
        return os.path.join(self.tmp.name, *parts)

    def test_all_writes_every_row_with_copy_plus_the_hub_and_check_agrees(self):
        self.assertEqual(gen.main(["--lang", "zh-Hant", "--all"]), 0)
        self.assertTrue(os.path.exists(self.out("zh-hant", "scales", SLUG, "index.html")))
        self.assertTrue(os.path.exists(self.out("zh-hant", "scales", "index.html")))
        self.assertFalse(os.path.exists(self.out("zh-hans")))
        self.assertEqual(gen.main(["--lang", "zh-Hant", "--all", "--check"]), 0)
        with open(self.out("zh-hant", "scales", SLUG, "index.html"), "a", encoding="utf-8") as f:
            f.write(" ")
        self.assertEqual(gen.main(["--lang", "zh-Hant", "--all", "--check"]), 1)

    def test_a_named_slug_without_copy_is_refused(self):
        with self.assertRaises(SystemExit):
            gen.main(["--lang", "zh-Hant", OTHER])

    def test_unknown_script_is_refused(self):
        with self.assertRaises(SystemExit):
            gen.main(["--lang", "fr", "--all"])

    def test_hreflang_follows_the_copy_files_on_disk(self):
        self.assertEqual(gen.main(["--lang", "zh-Hant", "--all"]), 0)
        with open(self.out("zh-hant", "scales", SLUG, "index.html"), encoding="utf-8") as f:
            self.assertEqual(sorted(alternates(f.read())), ["en", "x-default", "zh-Hant"])


PURE_PROBE = {"zh-Hant": "階進級靈鋼樂", "zh-Hans": "阶进级灵钢乐"}


def copy_files(script):
    base = os.path.join(gen.SITE_DIR, "scales")
    return sorted(os.path.join(base, d, "copy.%s.json" % script) for d in os.listdir(base)
                  if os.path.exists(os.path.join(base, d, "copy.%s.json" % script)))


def strings_of(node):
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for v in node.values():
            yield from strings_of(v)
    elif isinstance(node, list):
        for v in node:
            yield from strings_of(v)


def committed_drift(script, rows=None):
    rows = rows or gen.load_rows()
    avail = gen.discover(rows)
    slugs = sorted(avail[script])
    if not slugs:
        return []
    pages = gen.pages_for(slugs, rows, script=script, avail=avail)
    want = {os.path.join(gen.SITE_DIR, gen.prefix(script) + "scales", s, "index.html"): pages[s] for s in slugs}
    want[os.path.join(gen.SITE_DIR, gen.prefix(script) + "scales", "index.html")] = gen.hub_page(rows, script, avail)
    bad = []
    for path, text in want.items():
        if not os.path.exists(path):
            bad.append(path)
            continue
        with open(path, encoding="utf-8") as f:
            if f.read() != text:
                bad.append(path)
    return bad


class ZhScriptPurityTest(unittest.TestCase):
    def test_the_probe_text_is_impure_for_the_other_script_and_pure_for_its_own(self):
        for script, other in (("zh-Hant", "zh-Hans"), ("zh-Hans", "zh-Hant")):
            with self.subTest(script=script):
                self.assertEqual(gen.script_impurities(PURE_PROBE[script], script), [])
                self.assertEqual("".join(gen.script_impurities(PURE_PROBE[other], script)), "".join(sorted(PURE_PROBE[other])))

    def test_every_copy_file_on_disk_is_pure_for_its_script(self):
        for script in SCRIPTS:
            for path in copy_files(script):
                with self.subTest(path=path), open(path, encoding="utf-8") as f:
                    text = "".join(strings_of(json.load(f)))
                    self.assertEqual(gen.script_impurities(text, script), [])

    def test_the_label_table_is_pure_for_both_scripts(self):
        for script in SCRIPTS:
            with self.subTest(script=script):
                text = "".join(strings_of(gen.load_zh()[script]))
                self.assertEqual(gen.script_impurities(text, script), [])


class ZhCommittedBytesTest(unittest.TestCase):
    def test_every_committed_zh_page_and_hub_equals_the_generator_output(self):
        for script in SCRIPTS:
            with self.subTest(script=script):
                self.assertEqual(committed_drift(script), [])

    def test_the_drift_check_sees_a_missing_stale_and_current_page(self):
        with tempfile.TemporaryDirectory() as tmp:
            old = gen.SITE_DIR
            gen.SITE_DIR = tmp
            try:
                d = os.path.join(tmp, "scales", SLUG)
                os.makedirs(d)
                with open(os.path.join(d, "copy.zh-Hant.json"), "w", encoding="utf-8") as f:
                    json.dump(SAMPLE["zh-Hant"], f, ensure_ascii=False)
                self.assertEqual(len(committed_drift("zh-Hant")), 2)
                self.assertEqual(gen.main(["--lang", "zh-Hant", "--all"]), 0)
                self.assertEqual(committed_drift("zh-Hant"), [])
                with open(os.path.join(tmp, "zh-hant", "scales", "index.html"), "a", encoding="utf-8") as f:
                    f.write(" ")
                self.assertEqual(len(committed_drift("zh-Hant")), 1)
            finally:
                gen.SITE_DIR = old


class ZhTextTest(unittest.TestCase):
    def test_zh_notes_use_chinese_punctuation_and_the_cross_label_has_no_space(self):
        html_text = page(slug="d-aegean-18", script="zh-Hant", avail=NONE)
        self.assertRegex(html_text, r"中心音，")
        self.assertRegex(html_text, r"。底殼：")
        z = gen.load_zh()
        a, b = dict(root="D", family="minor", notes=10), dict(root="D", family="minor", notes=9)
        self.assertEqual(gen.zh_cross_lead(a, b, z["zh-Hant"]), "九個音？")
        self.assertEqual(gen.zh_cross_lead(a, b, z["zh-Hans"]), "九个音？")

    def test_hub_without_any_copy_file_refuses(self):
        with tempfile.TemporaryDirectory() as tmp:
            old = gen.SITE_DIR
            gen.SITE_DIR = tmp
            os.makedirs(os.path.join(tmp, "scales"))
            try:
                with self.assertRaises(SystemExit):
                    gen.main(["--lang", "zh-Hant", "--hub"])
            finally:
                gen.SITE_DIR = old


if __name__ == "__main__":
    unittest.main()
