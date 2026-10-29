#!/usr/bin/env python3
"""Scale page generator: tools/scale_pages.json row -> scales/<slug>/index.html.

    python3 tools/gen_scale_page.py <slug>            write scales/<slug>/index.html
    python3 tools/gen_scale_page.py <slug> --check    exit 1 if the file differs
    python3 tools/gen_scale_page.py <slug> --stdout   print the page
    python3 tools/gen_scale_page.py --hub             write scales/index.html (--check, --stdout too)
    python3 tools/gen_scale_page.py --fixture         write tests/fixtures/scale_pages_v1.json
    python3 tools/gen_scale_page.py --fixture --check exit 1 if the fixture drifted

Card diagrams are the app's own pan() (index.html, run in tools/sandbox.js), so a
card sits on exactly the angles, radii and colours the app draws. Decks come from
data/decks.json (built-in rows) or the engine (new rows), never from this file.
Page copy is the row's "copy" object, else scales/<slug>/copy.json.
"""
import colorsys
import html
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TABLE = os.path.join(ROOT, "tools", "scale_pages.json")
FIXTURE = os.path.join(ROOT, "tests", "fixtures", "scale_pages_v1.json")
SITE = "https://handpan.raywu.org/"
UPDATED = "2026-10-28"
BG_LIGHT = "#fbfaf8"
BG_DARK = "#15181b"
WORDS = {8: "Eight", 9: "Nine", 10: "Ten", 18: "Eighteen", 20: "Twenty"}
AN_LETTERS = set("AEFHILMNORSX")

SAMPLE_COPY = {
    "lead_html": "Start with the three cards below: play each card's lit notes, then move to the next.",
    "alias_html": "",
    "history_html": ["This sample paragraph stands in for the page's own history."],
    "who_html": "Sample maker, through sample pans.",
    "progression_tail_html": ", top shell only.",
}

GROUPS = [
    ("Minor", "Dark and moody. The most common handpan sound."),
    ("Celtic minor", "Minor without the dark 6th. Soft and open."),
    ("Pentatonic minor", "Few notes, hard to play a wrong one."),
    ("Major and bright", "Happy, uplifting."),
    ("Middle Eastern and Japanese", "Exotic colour from a flat 2nd or raised 7th."),
]
HUB_INTRO = "Every chord each handpan scale can play, with the notes to strike. Pick your scale."

NODE_SRC = r"""
const fs = require("fs");
const W = process.env.GSP_ROOT;
const { loadEngine } = require(W + "/tools/engine_loader.js");
const { boot } = require(W + "/tools/sandbox.js");
const HPE = loadEngine(["core", "voicing", "layout", "naming", "select", "share"]);
const app = boot();
const decks = JSON.parse(fs.readFileSync(W + "/data/decks.json", "utf8"));
const input = JSON.parse(fs.readFileSync(0, "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pc = (d, f) => d.fields[f][2] % 12;
function seedOf(r, src) {
  const p = HPE.core.parseSeed(src.seed, { palette: src.palette, name: src.typed });
  if (!p.ok) throw new Error(r.slug + ": " + p.code + ": " + p.reason);
  return p;
}
function shareOf(p) {
  const e = HPE.share.encode(p.value);
  if (!e.ok) throw new Error("encode: " + e.code);
  return e.value;
}
function autoPick(d) {
  const want = ["i", "iv", "v"];
  const root = (ch) => d.degrees[String(pc(d, ch.roots[0]))] || "";
  const found = want.map((w) => {
    const i = d.chords.findIndex((ch) => !ch.sup && ch.fields.length === 3 && /^[A-G][#b]?m?$/.test(ch.main) &&
      root(ch).toLowerCase() === w);
    return i + 1;
  });
  return found.every((n) => n > 0) ? found : [1, 2, 3];
}
function card(d, n) {
  const ch = d.chords[n - 1];
  const rpc = pc(d, ch.roots[0]);
  const col = (f) => (pc(d, f) === rpc ? d.colors.root : d.colors.tone);
  const sep = '<span class="sepc"> - </span>';
  const svg = app.get("pan(" + JSON.stringify(d) + "," + JSON.stringify(ch) + ")").replace(/\s*\n\s*/g, " ");
  return {
    n, main: ch.main, sup: ch.sup, subtitle: ch.subtitle, fields: ch.fields, roots: ch.roots,
    degree: d.degrees[String(rpc)] || "",
    notes_html: ch.fields.map((f) => '<span style="color:' + col(f) + '">' + esc(d.fields[f][0]) + "<sub>" + d.fields[f][1] + "</sub></span>").join(sep),
    numbers_html: ch.fields.map((f) => '<span style="color:' + col(f) + '">' + esc(d.fields[f][5]) + "</span>").join(sep),
    notes: ch.fields.map((f) => d.fields[f][0] + d.fields[f][1]).join(" "),
    numbers: ch.fields.map((f) => d.fields[f][5]).join(" - "),
    bottom: ch.fields.filter((f) => d.fields[f][3] === "bottom").length,
    svg,
  };
}
const out = { rows: {}, alt: {} };
for (const r of input.rows) {
  let d, p = null;
  if (r.deck) d = decks.find((x) => x.id === r.deck);
  else { p = seedOf(r, r); const b = HPE.select.build(p.value); if (!b.ok) throw new Error(r.slug + ": " + b.code); d = b.value; }
  const auto = autoPick(d);
  const pick = r.pick || auto;
  out.rows[r.slug] = {
    deck_id: d.id, name: d.name, count: d.chords.length, colors: d.colors, degrees: d.degrees, geom: d.geom,
    fields: d.fields, seed: p ? HPE.core.formatSeed(p.value) : null, share: p ? shareOf(p) : null,
    auto_pick: auto, cards: pick.map((n) => card(d, n)),
  };
  if (r.alt_share) {
    const ap = seedOf(r, r.alt_share);
    const code = shareOf(ap);
    const dec = HPE.share.decode(code);
    out.alt[r.slug] = { share: code, again: dec.ok ? shareOf({ value: dec.value }) : null, ok: dec.ok };
  }
}
process.stdout.write(JSON.stringify(out));
"""


def load_rows():
    with open(TABLE, encoding="utf-8") as f:
        return json.load(f)


def engine(rows):
    env = dict(os.environ, GSP_ROOT=ROOT)
    run = subprocess.run(["node", "-e", NODE_SRC], input=json.dumps({"rows": rows}), capture_output=True,
                         text=True, env=env, cwd=ROOT)
    if run.returncode:
        raise SystemExit("gen_scale_page: engine failed: " + run.stderr.strip())
    return json.loads(run.stdout)


def lum(hex_):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (int(hex_[i:i + 2], 16) for i in (1, 3, 5))
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def contrast(a, b):
    hi, lo = sorted((lum(a), lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def _shift(hex_, bg, step):
    h, l, s = colorsys.rgb_to_hls(*(int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5)))
    pct = round(l * 100)
    cur = hex_
    while contrast(cur, bg) < 4.5 and 0 < pct < 100:
        pct += step
        r, g, b = colorsys.hls_to_rgb(h, pct / 100, s)
        cur = "#%02X%02X%02X" % (round(r * 255), round(g * 255), round(b * 255))
    return cur


def accents(root):
    light = root if contrast(root, BG_LIGHT) >= 4.5 else _shift(root, BG_LIGHT, -1)
    dark = root if contrast(root, BG_DARK) >= 4.5 else _shift(root, BG_DARK, 1)
    return light, dark


def article(letter):
    return "an" if letter[0].upper() in AN_LETTERS else "a"


def cross_lead(row, target):
    if target["root"] != row["root"]:
        return "Playing %s %s pan?" % (article(target["root"]), target["root"])
    if target["family"] == row["family"]:
        return "%s notes?" % WORDS[target["notes"]]
    return "Another %s scale?" % row["root"]


def siblings(row, rows):
    i = next(n for n, r in enumerate(rows) if r["slug"] == row["slug"])
    same = [r["slug"] for r in rows if r["group"] == row["group"] and r["slug"] != row["slug"]]
    rest = [r["slug"] for r in rows[i + 1:] + rows[:i] if r["group"] != row["group"]]
    return (same + rest)[:3]


def link_item(row):
    return '<li><a href="/scales/%s/">%s handpan chords</a></li>' % (row["slug"], esc(row["name"]))


def hub_page(rows=None):
    rows = rows or load_rows()
    url = SITE + "scales/"
    title = "Handpan scale chord charts"
    description = ("Handpan chord charts for %d scales, grouped by sound, with the notes to play for each chord."
                   % len(rows))
    out = ['<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
           '<meta name="viewport" content="width=device-width, initial-scale=1">\n']
    out.append("<title>%s</title>\n" % title)
    out.append('<meta name="description" content="%s">\n' % html.escape(description))
    out.append('<link rel="canonical" href="%s">\n' % url)
    out.append('<meta property="og:type" content="website">\n<meta property="og:url" content="%s">\n' % url)
    out.append('<meta property="og:title" content="%s">\n' % title)
    out.append('<meta property="og:description" content="%s">\n' % html.escape(description))
    out.append('<meta property="og:image" content="%sog.png">\n' % SITE)
    out.append('<meta property="og:site_name" content="Handpan Chords">\n')
    out.append('<meta name="theme-color" content="%s">\n' % BG_LIGHT)
    out.append('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
               '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
               '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family='
               'Bitter:wght@400;600&family=Nunito+Sans:wght@400;600;700&display=swap">\n')
    out.append("<style>\n" + CSS_HEAD.replace("@LIGHT@", "#2563B0").replace("@DARK@", "#7fb0ee") + "</style>\n")
    out.append("</head>\n<body>\n<main>\n")
    out.append('<header><p><a href="/">Home</a> &rsaquo; Scale chord charts</p>\n<h1>%s</h1>\n' % title)
    out.append('<p style="margin-top:8px">%s</p>\n</header>\n' % HUB_INTRO)
    for name, blurb in GROUPS:
        out.append('<section class="group">\n<h2>%s</h2><p class="muted">%s</p>\n<ul class="rel">\n' % (esc(name), esc(blurb)))
        out.append("\n".join(link_item(r) for r in rows if r["group"] == name))
        out.append("\n</ul>\n</section>\n")
    out.append('<p class="muted">Handpan Chords is free in your browser. Your scales stay on your device.</p>\n'
               "</main>\n</body>\n</html>\n")
    return "".join(out)


def esc(s):
    return html.escape(s, quote=False)


def notes_line(fields):
    entries = list(fields.values())
    ding = [f for f in entries if f[3] == "ding"][0]
    top = sorted((f for f in entries if f[3] not in ("ding", "bottom")), key=lambda f: f[2])
    bottom = sorted((f for f in entries if f[3] == "bottom"), key=lambda f: f[2])
    line = "%s%s ding, %s" % (ding[0], ding[1], " ".join("%s%s" % (f[0], f[1]) for f in top))
    if bottom:
        line += ". Bottom shell: " + " ".join("%s%s" % (f[0], f[1]) for f in bottom)
    return line


CSS_HEAD = """:root{color-scheme:light dark;--bg:#fbfaf8;--fg:#1f2328;--muted:#5d646c;--r:@LIGHT@}
@media (prefers-color-scheme:dark){:root{--bg:#15181b;--fg:#e8eaec;--muted:#9aa2aa;--r:@DARK@}}
body{background:var(--bg);color:var(--fg);font-family:"Nunito Sans",system-ui,sans-serif;line-height:1.55;margin:0;padding:20px 16px 48px}
main{max-width:1080px;margin:0 auto;display:flex;flex-direction:column;gap:28px}
h1{font-family:Marcellus,serif;font-weight:400;font-size:clamp(30px,7vw,44px);margin:0;line-height:1.15}
h2{font-family:Marcellus,serif;font-weight:400;font-size:26px;margin:0;color:var(--r)}
p{margin:0;max-width:66ch}
.muted{color:var(--muted);font-size:14px}
section.scale{border-top:3px solid var(--r);padding-top:16px;display:flex;flex-direction:column;gap:12px}
section.plain h2,section.history h2{color:var(--fg);font-size:20px;margin:0 0 4px}
.slot{width:min(322px,100%);display:flex;flex-direction:column;align-items:center}
.cname{font-family:Marcellus,serif;font-size:28px;color:var(--r)}
.row{display:flex;flex-wrap:wrap;gap:16px;justify-content:center}
.ctas{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.open{align-self:flex-start;background:var(--r);color:#fff;text-decoration:none;font-weight:700;letter-spacing:.06em;font-size:14px;border-radius:8px;padding:12px 16px}
@media (prefers-color-scheme:dark){.open{color:#15181b}}
.open.ghost{background:transparent;color:var(--r);border:2px solid var(--r);padding:10px 14px}
ol{margin:0;padding-left:20px;max-width:66ch}
dl.who{margin:8px 0 0;display:grid;grid-template-columns:max-content 1fr;gap:2px 10px}
dl.who dt{font-weight:700}
dl.who dd{margin:0}
a{color:var(--r);font-weight:600;text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:3px}
a.open{text-decoration:none}
a:hover{text-decoration-thickness:2.5px}
a:focus-visible{outline:2px solid currentColor;outline-offset:2px;border-radius:2px}
ul.rel{list-style:none;margin:0;padding:0}
ul.rel li{border-bottom:1px solid var(--muted)}
ul.rel a{display:flex;align-items:center;min-height:44px}
section.related h2,section.group h2{color:var(--fg);font-size:20px;margin:0 0 4px}
"""

CSS_EXTRA = """table.chords{border-collapse:collapse;max-width:100%}
table.chords th,table.chords td{text-align:left;padding:6px 14px 6px 0;border-bottom:1px solid var(--muted)}
table.chords th{font-weight:700}
"""

CARD_CSS = """:host{display:block;width:min(322px,100%%);--root:%(root)s;--tone:%(tone)s}
.card{box-sizing:border-box;width:100%%;background:#fff;color:#242424;border:3px solid var(--root);border-radius:14px;padding:12px 8px 13px;font-family:"Nunito Sans",system-ui,sans-serif}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding:0 5px}
.hdr .l{font:600 9px/1.5 "Nunito Sans",system-ui,sans-serif;letter-spacing:.12em}
.hdr .l .num{color:#757575;font-weight:400}
.hdr .l .deg{color:var(--root);font-weight:600;letter-spacing:.06em}
.hdr .r{font:600 8px/1.3 "Nunito Sans",system-ui,sans-serif;letter-spacing:.11em;text-align:right;max-width:55%%;text-transform:uppercase}
.diagwrap{padding:2px 6px 0}
.diagwrap svg{width:100%%;height:auto;display:block}
.lines{text-align:center;padding-top:4px}
.notesline{font-family:Bitter,serif;font-size:19px;line-height:1.25;white-space:nowrap}
.numline{font-family:Bitter,serif;font-size:18px;line-height:1.2;white-space:nowrap}
.notesline sub{font-size:.62em}
.sepc{color:#75707c}"""

BADGE_CSS = '\n.badge{font:600 9px/1 "Nunito Sans",system-ui,sans-serif;letter-spacing:.14em;color:#E27005;margin-bottom:6px}'


def card_html(row, data, c):
    css = CARD_CSS % {"root": data["colors"]["root"], "tone": data["colors"]["tone"]}
    if c["bottom"]:
        css += BADGE_CSS
    deg = '&nbsp;<span class="deg">%s</span>' % esc(c["degree"]) if c["degree"] else ""
    badge = ""
    if c["bottom"]:
        badge = '<div class="badge">%d BOTTOM NOTE%s</div>' % (c["bottom"], "S" if c["bottom"] > 1 else "")
    name = c["main"] + c["sup"]
    label = name + " chord card"
    if row["kind"] != "frozen":
        label += ": " + c["notes"]
    return (
        '<div class="slot"><div class="cname">%s</div>\n'
        '<div class="cardhost" role="img" aria-label="%s"><template shadowrootmode="open"><style>%s</style>'
        '<div class="card"><div class="hdr"><div class="l">%s<br><span class="num">#%d</span>%s</div>'
        '<div class="r">%s</div></div><div class="diagwrap">%s</div>'
        '<div class="lines">%s<div class="notesline">%s</div><div class="numline">%s</div></div></div>'
        '</template></div></div>\n'
    ) % (esc(name) if not c["sup"] else esc(c["main"]) + "<sup>" + esc(c["sup"]) + "</sup>",
         esc(label), css, esc(data["name"]), c["n"], deg, esc(c["subtitle"]), c["svg"], badge,
         c["notes_html"], c["numbers_html"])


def chord_names(data):
    return [c["main"] + c["sup"] for c in data["cards"]]


def load_copy(row):
    if "copy" in row:
        return row["copy"]
    path = os.path.join(ROOT, "scales", row["slug"], "copy.json")
    if not os.path.exists(path):
        raise SystemExit("gen_scale_page: %s has no copy: add scales/%s/copy.json" % (row["slug"], row["slug"]))
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def render(row, data, rows_by_slug, copy, alt=None):
    frozen = row["kind"] == "frozen"
    name = row["name"]
    url = SITE + "scales/%s/" % row["slug"]
    cards = data["cards"]
    names = chord_names(data)
    triad = [c["degree"].lower() for c in cards] == ["i", "iv", "v"] or \
        all(c["degree"] and not c["sup"] for c in cards) and data["auto_pick"] == [c["n"] for c in cards]
    degs = [c["degree"] for c in cards]
    if frozen:
        deg_phrase = "i, iv and v"
        card_phrase = "the i, iv and v chord cards"
    elif triad:
        deg_phrase = ", ".join(degs[:-1]) + " and " + degs[-1]
        card_phrase = "the %s chord cards" % deg_phrase
    else:
        card_phrase = "the three top-ranked chord cards"
    list_names = ", ".join(names[:-1]) + " and " + names[-1]
    title = "%s handpan chords" % name
    description = ("%s handpan chords: %s (%s) with the notes to play, then practice the full set in the "
                   "free chord flashcard app.") % (name, card_phrase, ", ".join(names))
    og_description = copy["og_description"] if frozen else description
    light, dark = row["accent_light"], row["accent_dark"]
    cta = row["cta"]
    out = ['<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
           '<meta name="viewport" content="width=device-width, initial-scale=1">\n']
    out.append("<title>%s</title>\n" % esc(title))
    out.append('<meta name="description" content="%s">\n' % html.escape(description))
    out.append('<link rel="canonical" href="%s">\n' % url)
    out.append('<meta property="og:type" content="website">\n<meta property="og:url" content="%s">\n' % url)
    out.append('<meta property="og:title" content="%s">\n' % html.escape(title))
    out.append('<meta property="og:description" content="%s">\n' % html.escape(og_description))
    if not frozen:
        out.append('<meta property="og:image" content="%sog.png">\n' % SITE)
        out.append('<meta property="og:site_name" content="Handpan Chords">\n')
    out.append('<meta name="theme-color" content="%s">\n' % light)
    out.append('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
               '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
               '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Marcellus&family='
               'Bitter:wght@400;600&family=Nunito+Sans:wght@400;600;700&display=swap">\n')
    out.append("<style>\n" + CSS_HEAD.replace("@LIGHT@", light).replace("@DARK@", dark) + ("" if frozen else CSS_EXTRA) + "</style>\n")
    if not frozen:
        crumbs = [{"@type": "ListItem", "position": 1, "name": "Home", "item": SITE},
                  {"@type": "ListItem", "position": 2, "name": "%s chords" % name, "item": url}]
        items = [{"@type": "ListItem", "position": i + 1, "name": n} for i, n in enumerate(names)]
        graph = {"@context": "https://schema.org", "@type": "WebPage", "name": "%s handpan chords" % name,
                 "url": url, "dateModified": UPDATED,
                 "publisher": {"@type": "Organization", "name": "Handpan Chords"},
                 "breadcrumb": {"@type": "BreadcrumbList", "itemListElement": crumbs},
                 "mainEntity": {"@type": "ItemList", "itemListElement": items}}
        out.append('<script type="application/ld+json">%s</script>\n' % json.dumps(graph, ensure_ascii=False,
                                                                                 separators=(",", ":")))
    out.append("</head>\n<body>\n<main>\n")
    if frozen:
        out.append('<header><p><a href="/">&larr; Handpan Chords</a></p>\n')
    else:
        out.append('<header><p><a href="/">Home</a> &rsaquo; %s chords</p>\n' % esc(name))
    out.append("<h1>%s handpan chords</h1>\n" % esc(name))
    if frozen:
        guide = '<a href="/handpan-101/">Handpan 101</a>'
        lead = copy["lead_html"] + " New to handpan? Read %s first." % guide
    else:
        lead = copy["lead_html"] + " The app has %d chord cards for this scale." % data["count"]
        lead += ' New to handpan? Read <a href="/handpan-101/">Handpan 101: how to play a handpan</a> first.'
    out.append('<p style="margin-top:8px">%s</p>\n' % lead)
    if copy.get("alias_html"):
        out.append('<p class="muted" style="margin-top:6px">%s</p>' % copy["alias_html"])
    out.append("</header>\n")
    out.append('<section class="history">\n<h2>A little history</h2>\n')
    for para in copy["history_html"]:
        out.append("<p>%s</p>\n" % para)
    if row["popularized"]:
        out.append('<dl class="who"><dt>Popularized by</dt><dd>%s</dd></dl>\n' % copy["who_html"])
    out.append("</section>\n")
    out.append('<section class="plain">\n<h2>How to read a chord card</h2>\n'
               "<ol><li>The darker colour is the root; the lighter colour, the other chord tones.</li>\n"
               "<li>The line under the pan names the notes, root first, with their field numbers.</li>")
    if any(f[3] == "bottom" for f in data["fields"].values()):
        out.append("\n<li>Orange U numbers and dashed circles are bottom-shell notes, played from inside the pan.</li>")
    out.append("</ol>\n</section>\n")
    out.append('<section class="scale" id="%s">\n' % row["slug"])
    out.append('<h2>%s</h2><p class="muted">%s</p>\n' % (esc(name), esc(notes_line(data["fields"]))))
    prog_degs = "" if not all(degs) else " (%s)" % ", ".join(degs)
    out.append("<p>Starter progression: <b>%s</b>%s%s</p>\n" % (esc(", ".join(names)), prog_degs,
                                                              copy["progression_tail_html"]))
    out.append('<div class="row">\n')
    for c in cards:
        out.append(card_html(row, data, c))
    out.append("</div>\n")
    if not frozen:
        out.append('<table class="chords"><thead><tr><th>Chord</th><th>Notes</th><th>Field numbers</th></tr>'
                   "</thead><tbody>")
        for c in cards:
            out.append("<tr><td>%s</td><td>%s</td><td>%s</td></tr>" % (esc(c["main"] + c["sup"]), c["notes"],
                                                                        c["numbers"]))
        out.append("</tbody></table>\n")
    out.append('<div class="ctas"><a class="open" href="%s">PRACTICE %s</a>'
               '<a class="open ghost" href="/#add">ADD YOUR OWN SCALE</a></div>\n' % (cta, esc(name.upper())))
    target = rows_by_slug.get(row["cross"]["to"]) if row.get("cross") else None
    if target:
        out.append('<p>%s Open <a href="%s">%s</a>.</p>\n' % (cross_lead(row, target), row["cross"]["href"],
                                                              esc(target["name"])))
    if row.get("alt_share") and alt:
        a = row["alt_share"]
        out.append('<p class="muted">%s Open <a href="/#s=%s">%s</a>.</p>\n' % (a["lead"], alt["share"],
                                                                                esc(a["name"])))
    out.append("</section>\n")
    all_rows = list(rows_by_slug.values())
    out.append('<section class="related">\n<h2>Related scales</h2>\n<ul class="rel">\n%s\n</ul>\n'
               '<p><a href="/scales/">All %d handpan scale chord charts</a></p>\n</section>\n'
               % ("\n".join(link_item(rows_by_slug[s]) for s in siblings(row, all_rows)), len(all_rows)))
    if not frozen:
        out.append('<p class="muted">Last updated <time datetime="%s">%s</time></p>\n' % (UPDATED, UPDATED))
    out.append('<p class="muted">Handpan Chords is free in your browser. Your scales stay on your device.</p>\n'
               "</main>\n</body>\n</html>\n")
    return "".join(out)


def page_for(slug, rows=None, copy=None):
    rows = rows or load_rows()
    by = {r["slug"]: r for r in rows}
    row = by[slug]
    data = engine([row])
    return render(row, data["rows"][slug], by, copy or load_copy(row), data["alt"].get(slug))


def fixture_data(rows):
    data = engine(rows)["rows"]
    out = {}
    for r in rows:
        d = data[r["slug"]]
        out[r["slug"]] = {
            "deck_id": d["deck_id"], "name": d["name"], "count": d["count"], "colors": d["colors"],
            "degrees": d["degrees"], "geom": d["geom"], "fields": d["fields"], "seed": d["seed"],
            "share": d["share"], "auto_pick": d["auto_pick"],
            "cards": [{k: v for k, v in c.items() if k not in ("svg", "notes_html", "numbers_html")}
                      for c in d["cards"]],
        }
    return json.dumps(out, indent=1, sort_keys=True) + "\n"


def main(argv):
    check = "--check" in argv
    args = [a for a in argv if not a.startswith("--")]
    if "--fixture" in argv:
        text = fixture_data(load_rows())
        if check:
            with open(FIXTURE, encoding="utf-8") as f:
                return 0 if f.read() == text else 1
        with open(FIXTURE, "w", encoding="utf-8") as f:
            f.write(text)
        return 0
    if "--hub" in argv:
        text = hub_page()
        path = os.path.join(ROOT, "scales", "index.html")
        if "--stdout" in argv:
            sys.stdout.write(text)
            return 0
        if check:
            with open(path, encoding="utf-8") as f:
                return 0 if f.read() == text else 1
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)
        return 0
    if len(args) != 1:
        raise SystemExit(__doc__)
    text = page_for(args[0])
    path = os.path.join(ROOT, "scales", args[0], "index.html")
    if "--stdout" in argv:
        sys.stdout.write(text)
        return 0
    if check:
        with open(path, encoding="utf-8") as f:
            same = f.read() == text
        if not same:
            sys.stderr.write("gen_scale_page: %s differs from the generator\n" % path)
        return 0 if same else 1
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
