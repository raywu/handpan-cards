import glob
import os
import re
import shutil
import subprocess
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://handpantheory.com/"
NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"


def read(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as f:
        return f.read()


def publish(out, branch=None):
    env = {k: v for k, v in os.environ.items() if k != "CF_PAGES_BRANCH"}
    if branch is not None:
        env["CF_PAGES_BRANCH"] = branch
    subprocess.run(["sh", os.path.join(ROOT, "tools", "publish.sh"), out], cwd=ROOT, env=env, check=True)


def sitemap_tree():
    return ET.parse(os.path.join(ROOT, "sitemap.xml")).getroot()


PATTERNS = [
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
ALLOW = {f: list(FILENAMES) for f in NAME_FILES}


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
        samples = ["oranienbaum", "biorhyme", "montserrat", "commercial", "reference deck",
                   "original D Amara", "original Amara", "pixel-validated", "DUR/MOLL", "bilingual",
                   "double-blue", "ding-as-green"]
        self.assertEqual(len(samples), len(PATTERNS) + 1)
        for s in samples:
            self.assertEqual(len(line_hits("probe.txt", "x %s x" % s)), 1, s)
        for name in ("CSharp_Hijaz_Orion_9_CHORD_ONLY_Letter.pdf",
                     "F3_Low_Pygmy_18_CHORD_ONLY_Letter.pdf", "D_Amara_9_CHORD_ONLY_Letter.pdf"):
            self.assertEqual(len(tracked_name_hits([name])), 1, name)
            self.assertEqual(len(line_hits("probe.txt", name)), 1, name)
            self.assertEqual(line_hits("tests/paths.py", name), [])
        self.assertEqual(line_hits("probe.txt", "x" + "A1b2" * 75 + "montserrat"), [])


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

    def test_sitemap_lists_the_root_every_scale_page_and_handpan_101(self):
        locs = {e.text.strip() for e in sitemap_tree().iter(NS + "loc")}
        pages = set()
        for prefix in ("", "zh-hant/", "zh-hans/"):
            pages |= {SITE + os.path.relpath(os.path.dirname(f), ROOT).replace(os.sep, "/") + "/"
                      for f in glob.glob(os.path.join(ROOT, prefix + "scales", "*", "index.html"))}
        self.assertTrue(pages)
        hubs = {SITE + "scales/"}
        for prefix in ("zh-hant/", "zh-hans/"):
            if os.path.isfile(os.path.join(ROOT, prefix + "scales", "index.html")):
                hubs.add(SITE + prefix + "scales/")
        self.assertEqual(locs, {SITE} | pages | hubs | {SITE + "handpan-101/"})

    def test_no_lastmod_and_nojekyll_is_empty(self):
        self.assertEqual(list(sitemap_tree().iter(NS + "lastmod")), [])
        path = os.path.join(ROOT, ".nojekyll")
        self.assertTrue(os.path.isfile(path))
        self.assertEqual(os.path.getsize(path), 0)

    def header_rules(self):
        lines = [l for l in read("_headers").splitlines() if l.strip()]
        rules = [l for l in lines if not l[0].isspace()]
        headers = [l.strip() for l in lines if l[0].isspace()]
        return rules, headers

    def test_headers_noindex_is_scoped_to_the_dev_and_preview_hosts(self):
        rules, headers = self.header_rules()
        self.assertTrue(rules)
        for rule in rules:
            self.assertTrue(rule.startswith("https://"), rule)
            host = rule[len("https://"):].split("/")[0]
            self.assertTrue(host.endswith(".pages.dev"), rule)
        self.assertEqual(headers, ["X-Robots-Tag: noindex"] * len(rules))

    def test_headers_noindex_names_the_dev_and_prod_projects_and_their_previews(self):
        rules, _ = self.header_rules()
        self.assertEqual(sorted(rules), sorted([
            "https://handpan-cards-dev.pages.dev/*",
            "https://:version.handpan-cards-dev.pages.dev/*",
            "https://handpan-cards.pages.dev/*",
            "https://:version.handpan-cards.pages.dev/*",
        ]))

    def test_no_headers_rule_matches_a_production_hostname(self):
        rules, _ = self.header_rules()
        for rule in rules:
            self.assertFalse(rule.startswith("/"), "bare path rule applies to every host: " + rule)
            host = rule[len("https://"):].split("/")[0]
            rx = re.compile("^" + re.sub(r":[a-z]+", "[^.]+", re.escape(host).replace(r"\*", ".*").replace(r"\:", ":")) + "$")
            for prod in ("handpan.raywu.org", "handpantheory.com", "www.handpantheory.com"):
                self.assertIsNone(rx.match(prod), "%s matches %s" % (rule, prod))

    def test_404_page_exists_and_is_neither_noindex_nor_a_canonical_of_the_app(self):
        page = read("404.html")
        self.assertIn("<title>", page)
        self.assertIn('href="/"', page)
        self.assertIn('href="/scales/"', page)
        self.assertNotRegex(page, r"(?i)rel=[\"']canonical")
        self.assertNotRegex(page, r"(?i)http-equiv=[\"']refresh")

    def test_handpan_101_links_the_neotone_page_in_chords_section(self):
        html = read("handpan-101/index.html")
        m = re.search(r"<h2>Chords on a handpan</h2>(.*?)</section>", html, re.S)
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1).count('<a href="/scales/neotone/">'), 1)
        self.assertTrue(os.path.isfile(os.path.join(ROOT, "scales", "neotone", "index.html")))

    def test_publish_script_builds_exactly_the_allowlist_byte_for_byte(self):
        allow_files = ["index.html", "404.html", "sitemap.xml", "robots.txt", "llms.txt",
                       "_headers", "_redirects", "og.png", "apple-touch-icon.png", "favicon.ico"]
        allow_dirs = ["scales", "handpan-101", "brand"]
        with tempfile.TemporaryDirectory() as out:
            publish(out)
            built = set()
            for base, _, names in os.walk(out):
                for n in names:
                    built.add(os.path.relpath(os.path.join(base, n), out))
            expected = set(allow_files)
            for f in ("indexnow-key.txt",):
                if f in tracked_files():
                    expected.add(f)
            for d in allow_dirs + ["zh-hant", "zh-hans", "fonts"]:
                for f in tracked_files():
                    if f.startswith(d + "/"):
                        expected.add(f)
            self.assertEqual(built, expected)
            for rel in expected:
                with open(os.path.join(out, rel), "rb") as a, open(os.path.join(ROOT, rel), "rb") as b:
                    self.assertEqual(a.read(), b.read(), rel)
            for banned in ("tests", "docs", "tools", "src", "data", "CLAUDE.md", "AGENTS.md", "CNAME", ".git"):
                self.assertFalse(any(b == banned or b.startswith(banned + os.sep) for b in built), banned)

    def test_publish_script_refuses_an_output_dir_that_already_has_files(self):
        with tempfile.TemporaryDirectory() as out:
            open(os.path.join(out, "stale.txt"), "w").close()
            r = subprocess.run(["sh", os.path.join(ROOT, "tools", "publish.sh"), out], cwd=ROOT)
            self.assertNotEqual(r.returncode, 0)

    def test_llms_txt_lists_exactly_the_sitemap_locs(self):
        listed = set(re.findall(r"\((https://[^)\s]+)\)", read("llms.txt")))
        locs = {e.text.strip() for e in sitemap_tree().iter(NS + "loc")}
        self.assertEqual(listed, locs)
        self.assertIn(SITE + "handpan-101/", listed)
        self.assertIn(SITE + "scales/", listed)

    def test_qa_seed_page_is_dev_only_noindex_and_never_published(self):
        page = read("qa-seed.html")
        self.assertRegex(page, r'<meta name="robots" content="noindex">')
        self.assertNotRegex(page, r"(?i)rel=[\"']canonical")
        self.assertNotRegex(page, r'href="[^"]*\.html"')
        self.assertIn('href="/"', page)
        with tempfile.TemporaryDirectory() as out:
            publish(out)
            self.assertFalse(os.path.exists(os.path.join(out, "qa-seed.html")))
        with tempfile.TemporaryDirectory() as out:
            publish(out, "main")
            self.assertFalse(os.path.exists(os.path.join(out, "qa-seed.html")))
        self.assertNotIn("qa-seed", read("sitemap.xml") + read("llms.txt") + read("robots.txt"))
        self.assertNotIn("qa-seed", read("index.html"))

    def test_qa_seed_is_published_only_for_a_non_production_branch(self):
        for branch in ("dev", "claude/some-lane"):
            with tempfile.TemporaryDirectory() as out:
                publish(out, branch)
                with open(os.path.join(out, "qa-seed.html"), "rb") as a, open(os.path.join(ROOT, "qa-seed.html"), "rb") as b:
                    self.assertEqual(a.read(), b.read(), branch)

    def test_qa_seed_host_guard_allows_only_the_dev_project_and_its_previews(self):
        m = re.search(r"const allowedHost = (.+?);\n", read("qa-seed.html"))
        self.assertIsNotNone(m)
        script = "const f=%s;process.stdout.write(JSON.stringify(process.argv.slice(1).map(f)))" % m.group(1)
        hosts = ["handpan-cards-dev.pages.dev", "abc123.handpan-cards-dev.pages.dev",
                 "claude-qa-harness.handpan-cards-dev.pages.dev",
                 "handpan.raywu.org", "www.handpantheory.com", "handpantheory.com",
                 "handpan-cards.pages.dev", "abc123.handpan-cards.pages.dev",
                 "evilhandpan-cards-dev.pages.dev", "handpan-cards-dev.pages.dev.evil.com", "localhost"]
        out = subprocess.run(["node", "-e", script] + hosts, capture_output=True, check=True, text=True).stdout
        import json
        self.assertEqual(dict(zip(hosts, json.loads(out))), {
            "handpan-cards-dev.pages.dev": True, "abc123.handpan-cards-dev.pages.dev": True,
            "claude-qa-harness.handpan-cards-dev.pages.dev": True,
            "handpan.raywu.org": False, "www.handpantheory.com": False, "handpantheory.com": False,
            "handpan-cards.pages.dev": False, "abc123.handpan-cards.pages.dev": False,
            "evilhandpan-cards-dev.pages.dev": False, "handpan-cards-dev.pages.dev.evil.com": False,
            "localhost": False})

def fake_site(root, optional):
    os.makedirs(os.path.join(root, "tools"))
    shutil.copy(os.path.join(ROOT, "tools", "publish.sh"), os.path.join(root, "tools", "publish.sh"))
    for f in ["index.html", "404.html", "sitemap.xml", "robots.txt", "llms.txt", "_headers", "_redirects",
              "og.png", "apple-touch-icon.png", "favicon.ico"]:
        open(os.path.join(root, f), "w").write(f)
    for d in ("scales", "handpan-101", "brand"):
        os.makedirs(os.path.join(root, d))
        open(os.path.join(root, d, "x.txt"), "w").write(d)
    for rel in optional:
        path = os.path.join(root, rel)
        if rel.endswith("/"):
            os.makedirs(path)
            open(os.path.join(path, "x.txt"), "w").write(rel)
        else:
            open(path, "w").write(rel)


def publish_fake(optional):
    with tempfile.TemporaryDirectory() as root, tempfile.TemporaryDirectory() as out:
        fake_site(root, optional)
        out = os.path.join(out, "o")
        r = subprocess.run(["sh", os.path.join(root, "tools", "publish.sh"), out], capture_output=True)
        built = set()
        for base, _, names in os.walk(out):
            for n in names:
                built.add(os.path.relpath(os.path.join(base, n), out))
        return r.returncode, built


class OptionalPublishTest(unittest.TestCase):
    def test_publish_copies_the_zh_fonts_and_key_paths_only_when_present(self):
        code, built = publish_fake([])
        self.assertEqual(code, 0)
        self.assertEqual({b.split(os.sep)[0] for b in built} & {"zh-hant", "zh-hans", "fonts", "indexnow-key.txt"}, set())
        code, built = publish_fake(["zh-hant/", "zh-hans/", "fonts/", "indexnow-key.txt"])
        self.assertEqual(code, 0)
        for rel in ("zh-hant/x.txt", "zh-hans/x.txt", "fonts/x.txt", "indexnow-key.txt"):
            self.assertIn(rel.replace("/", os.sep), built)

    def test_publish_copies_each_optional_path_independently(self):
        for opt in ("zh-hant/", "zh-hans/", "fonts/", "indexnow-key.txt"):
            code, built = publish_fake([opt])
            self.assertEqual(code, 0, opt)
            extra = {b for b in built if b.split(os.sep)[0] in ("zh-hant", "zh-hans", "fonts", "indexnow-key.txt")}
            self.assertEqual(len(extra), 1, opt)
            self.assertTrue(next(iter(extra)).startswith(opt.rstrip("/")), opt)


def redirect_sources():
    return [l.split()[0] for l in read("_redirects").splitlines() if l.strip() and not l.startswith("#")]


class ZhPathsUnrulesTest(unittest.TestCase):
    PATHS = ["/zh-hant/", "/zh-hant/scales/d-kurd-10/", "/zh-hans/scales/", "/fonts/fonts.css",
             "/fonts/x.woff", "/indexnow-key.txt"]

    def test_no_redirect_rule_matches_zh_fonts_or_the_key_file(self):
        for src in redirect_sources():
            rx = re.compile("^" + re.escape(src).replace(r"\*", ".*").rstrip("/") + "/?$")
            for p in self.PATHS:
                self.assertIsNone(rx.match(p), "%s matches %s" % (src, p))

    def test_no_headers_rule_matches_zh_fonts_or_the_key_file_on_any_host(self):
        for line in read("_headers").splitlines():
            if line.strip() and not line[0].isspace():
                self.assertTrue(line.startswith("https://"), "path rule would hit " + line)
                path = "/" + line[len("https://"):].split("/", 1)[1]
                self.assertEqual(path, "/*", line)


class HandpantheoryHostSetTest(unittest.TestCase):
    def test_the_old_host_string_survives_only_in_cname_and_the_move_switch(self):
        out = subprocess.run(["git", "grep", "-l", "handpan.raywu.org", "--", ".", ":!docs", ":!tests"],
                             cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
        self.assertEqual(sorted(out), ["CNAME", "index.html"])
        old = [l.strip() for l in read("index.html").splitlines() if "handpan." + "raywu.org" in l]
        self.assertEqual(old, ['const MOVE_FROM = "handpan.raywu.org";'])

    def test_canonical_and_og_url_name_the_new_host(self):
        html = read("index.html")
        self.assertIn('<link rel="canonical" href="https://handpantheory.com/">', html)
        self.assertIn('<meta property="og:url" content="https://handpantheory.com/">', html)
        self.assertIn('const MOVE_FROM = "handpan.raywu.org";', html)
        self.assertIn('const MOVE_TARGET = "https://handpantheory.com";', html)


INDEXNOW = os.path.join(ROOT, "tools", "indexnow.py")


def run_indexnow(*args, cwd=None):
    return subprocess.run(["python3", INDEXNOW] + list(args), cwd=cwd or ROOT, capture_output=True, text=True)


class IndexNowTest(unittest.TestCase):
    def test_dry_run_is_the_default_and_prints_valid_json_with_the_sitemap_locs(self):
        import json
        r = run_indexnow()
        self.assertEqual(r.returncode, 0, r.stderr)
        payload = json.loads(r.stdout)
        locs = [e.text.strip() for e in sitemap_tree().iter(NS + "loc")]
        self.assertEqual(payload["host"], "handpantheory.com")
        self.assertEqual(payload["keyLocation"], SITE + "indexnow-key.txt")
        self.assertEqual(payload["urlList"], locs)
        self.assertTrue(payload["key"])

    def test_dry_run_reads_the_key_from_the_key_file_when_present(self):
        import json
        with tempfile.TemporaryDirectory() as d:
            key = os.path.join(d, "k.txt")
            with open(key, "w") as f:
                f.write("abc123def456\n")
            r = run_indexnow("--key-file", key)
            self.assertEqual(json.loads(r.stdout)["key"], "abc123def456")

    def test_send_without_a_key_file_exits_non_zero_and_sends_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            r = run_indexnow("--send", "--key-file", os.path.join(d, "absent.txt"))
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(r.stdout, "")

    def test_send_refuses_a_non_handpantheory_host(self):
        for host in ("handpan.raywu.org", "handpantheory.com.evil.com", "evilhandpantheory.com",
                     "handpan-cards-dev.pages.dev", "localhost"):
            with tempfile.TemporaryDirectory() as d:
                key = os.path.join(d, "k.txt")
                with open(key, "w") as f:
                    f.write("abc123def456")
                r = run_indexnow("--send", "--host", host, "--key-file", key)
                self.assertNotEqual(r.returncode, 0, host)
                self.assertIn("handpantheory.com", r.stderr, host)

    def test_dry_run_also_refuses_a_foreign_host(self):
        r = run_indexnow("--host", "example.com")
        self.assertNotEqual(r.returncode, 0)

    def test_the_tool_names_only_the_indexnow_endpoint_as_a_network_target(self):
        src = read("tools/indexnow.py")
        self.assertEqual(sorted(set(re.findall(r"https?://[A-Za-z0-9.\-]+", src))),
                         ["http://www.sitemaps.org", "https://api.indexnow.org"])


if __name__ == "__main__":
    unittest.main()
