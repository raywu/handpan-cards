"""Shared paths for the Python test suites."""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools")
FONTS = os.path.join(TOOLS, "fonts")
INDEX_HTML = os.path.join(ROOT, "index.html")

PDFS = {
    "hijaz_full": "CSharp_Hijaz_Orion_9_Cards_Letter.pdf",
    "pygmy_full": "F3_Low_Pygmy_18_Cards_Letter.pdf",
    "amara_full": "D_Amara_9_Cards_Letter.pdf",
    "hijaz_print": "CSharp_Hijaz_Orion_9_PRINTER_ONLY_Chords_Letter.pdf",
    "pygmy_print": "F3_Low_Pygmy_18_PRINTER_ONLY_Chords_Letter.pdf",
    "amara_print": "D_Amara_9_PRINTER_ONLY_Chords_Letter.pdf",
}


def app_decks():
    """The DECKS JSON embedded in index.html, parsed."""
    import json, re
    html = open(INDEX_HTML, encoding="utf-8").read()
    m = re.search(r"^const DECKS = (\[.*\]);$", html, re.M)
    if not m:
        raise AssertionError("DECKS JSON not found in index.html")
    return json.loads(m.group(1))
