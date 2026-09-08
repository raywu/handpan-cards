"""Build integration for the six print PDFs.

Every deck is rebuilt into a TEMP directory (never the repo root) and the
assertions are made against the resulting artifact: page geometry comes from
the crop marks drawn on the sheet, card inventory from the per-card credit
stamp, and card copy from extracted text.  No layout constant is imported
from ``hifi`` (CONTRACT rule 2) - the numbers below are CLAUDE.md's print
spec, which the artifact has to hit.

The last test is the staleness gate: the six PDFs committed in the repo root
must match a fresh build, so deck data cannot change without the printed
sheets being regenerated.
"""
import os
import re
import shutil
import sys
import tempfile
import unittest

import pymupdf

from tests import paths

sys.path.insert(0, paths.TOOLS)

import hifi  # noqa: E402
import decks  # noqa: E402

# --- print spec, quoted from CLAUDE.md ("Print pipeline") -------------------
SPEC_PAGE = (612.0, 792.0)     # US Letter
SPEC_CARD_W = 177.6            # poker card, 62.65 mm
SPEC_CARD_H = 247.2            # poker card, 87.21 mm
SPEC_CALIBRATION = 144.0       # the 2.00 inch bar on page 1
SPEC_CROP_MARK = 8.0           # crop-mark tick length
SPEC_CROP_INSET = 6.0          # ticks start 6 pt from the page edge
TOL = 0.01

# Page counts are pinned by CLAUDE.md / tests/CONTRACT.md: full 3/4/2,
# printer-only 2/3/2.
JOBS = [
    ("hijaz_full", decks.HIJAZ, False, 3),
    ("pygmy_full", decks.PYGMY, False, 4),
    ("amara_full", decks.AMARA, False, 2),
    ("hijaz_print", decks.HIJAZ, True, 2),
    ("pygmy_print", decks.PYGMY, True, 3),
    ("amara_print", decks.AMARA, True, 2),
]

# Heavily tracked strings extract glyph-spaced ("L E G E N D"), so the German
# words are looked for in the whitespace-stripped text; "DUR" is too short to
# be safe there and is matched as a word in the normalised text instead.
GERMAN_WORDS = ("MOLL", "VERMINDERT", "HALBVERMINDERT", "LEGENDE")
GERMAN_DUR = re.compile(r"\bDUR\b")


def flat(text):
    """Whitespace-normalised: tracked() draws glyph by glyph."""
    return re.sub(r"\s+", " ", text).strip()


def squeeze(text):
    return re.sub(r"\s+", "", text)


def doc_text(doc):
    return "".join(page.get_text() for page in doc)


def segments(page):
    """Straight line segments on a page, in PDF points (y measured from top)."""
    out = []
    for path in page.get_drawings():
        for item in path["items"]:
            if item[0] == "l":
                a, b = item[1], item[2]
                out.append((a.x, a.y, b.x, b.y))
    return out


def crop_marks(page):
    """The tick marks at the sheet edges, as (x coordinates, y coordinates)."""
    w, h = SPEC_PAGE
    xs, ys = [], []
    for x1, y1, x2, y2 in segments(page):
        vertical = abs(x1 - x2) < 1e-6
        horizontal = abs(y1 - y2) < 1e-6
        if vertical and abs(abs(y1 - y2) - SPEC_CROP_MARK) < TOL:
            if min(y1, y2) <= SPEC_CROP_INSET + SPEC_CROP_MARK + TOL or \
                    max(y1, y2) >= h - SPEC_CROP_INSET - SPEC_CROP_MARK - TOL:
                xs.append(x1)
        elif horizontal and abs(abs(x1 - x2) - SPEC_CROP_MARK) < TOL:
            if min(x1, x2) <= SPEC_CROP_INSET + SPEC_CROP_MARK + TOL or \
                    max(x1, x2) >= w - SPEC_CROP_INSET - SPEC_CROP_MARK - TOL:
                ys.append(y1)
    return xs, ys


class BuiltDecksTest(unittest.TestCase):
    """Base class: every deck built once, into a throwaway directory."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="handpan-print-")
        cls.built = {}
        cls.returned = {}
        for key, deck, chords_only, _pages in JOBS:
            path = os.path.join(cls.tmp, paths.PDFS[key])
            cls.returned[key] = hifi.build(path, deck, chords_only=chords_only)
            cls.built[key] = path
        cls.docs = {k: pymupdf.open(p) for k, p in cls.built.items()}
        cls.text = {k: doc_text(d) for k, d in cls.docs.items()}

    @classmethod
    def tearDownClass(cls):
        for doc in cls.docs.values():
            doc.close()
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def assertRepoUntouched(self):
        self.assertTrue(self.tmp.startswith(tempfile.gettempdir()))


class BuildTest(BuiltDecksTest):

    def test_all_six_pdfs_build_with_the_expected_page_counts(self):
        for key, _deck, _chords_only, pages in JOBS:
            with self.subTest(pdf=key):
                path = self.built[key]
                self.assertTrue(os.path.isfile(path), "%s was not written" % key)
                self.assertGreater(os.path.getsize(path), 1000)
                self.assertEqual(self.docs[key].page_count, pages,
                                 "%s: wrong number of sheets" % key)
                self.assertEqual(self.returned[key], pages,
                                 "%s: build() reported %r sheets but wrote %d"
                                 % (key, self.returned[key],
                                    self.docs[key].page_count))
        self.assertRepoUntouched()

    def test_every_page_is_us_letter(self):
        for key in self.docs:
            for i, page in enumerate(self.docs[key]):
                with self.subTest(pdf=key, page=i):
                    self.assertAlmostEqual(page.rect.width, SPEC_PAGE[0],
                                           delta=TOL)
                    self.assertAlmostEqual(page.rect.height, SPEC_PAGE[1],
                                           delta=TOL)

    def test_card_geometry_and_calibration_bar_measured_from_the_sheet(self):
        """Cut the sheet on its crop marks and you must get poker cards.

        Measured from the artifact: the marks are the printer's only guide, so
        the spacings between them ARE the card size.
        """
        for key in self.docs:
            with self.subTest(pdf=key):
                page = self.docs[key][0]
                xs, ys = crop_marks(page)
                self.assertEqual(len(xs), 12,
                                 "expected 2 ticks for each of 6 card edges")
                self.assertEqual(len(ys), 12)
                ux = sorted({round(v, 4) for v in xs})
                uy = sorted({round(v, 4) for v in ys})
                self.assertEqual(len(ux), 6, "expected 3 columns of cards")
                self.assertEqual(len(uy), 6, "expected 3 rows of cards")
                dx = [ux[i + 1] - ux[i] for i in range(5)]
                dy = [uy[i + 1] - uy[i] for i in range(5)]
                for col in (0, 1, 2):
                    self.assertAlmostEqual(
                        dx[col * 2], SPEC_CARD_W, delta=TOL,
                        msg="column %d is %.3f pt wide, not the poker-size "
                            "%.1f pt" % (col + 1, dx[col * 2], SPEC_CARD_W))
                    self.assertAlmostEqual(
                        dy[col * 2], SPEC_CARD_H, delta=TOL,
                        msg="row %d is %.3f pt tall, not the poker-size %.1f pt"
                            % (col + 1, dy[col * 2], SPEC_CARD_H))

                bars = [abs(y1 - y2) for x1, y1, x2, y2 in segments(page)
                        if abs(x1 - x2) < 1e-6
                        and abs(abs(y1 - y2) - SPEC_CALIBRATION) < 1.0]
                self.assertEqual(len(bars), 1,
                                 "page 1 needs exactly one calibration bar")
                self.assertAlmostEqual(
                    bars[0], SPEC_CALIBRATION, delta=TOL,
                    msg="the 2.00 in calibration bar measures %.3f pt; a "
                        "printer scaling to fit would go unnoticed" % bars[0])

    def test_printer_only_sheets_contain_only_chord_cards(self):
        """The print-shop file is chord cards and nothing else.

        Every card - chord, title, legend or blank - carries the deck credit up
        its right edge, so counting the credit counts the cards on the sheet.
        """
        for key, deck, chords_only, pages in JOBS:
            with self.subTest(pdf=key):
                tight = squeeze(self.text[key])
                stamped = tight.count(squeeze(deck["credit"]))
                if chords_only:
                    self.assertEqual(
                        stamped, len(deck["chords"]),
                        "%s: %d cards on the sheets, %d chords in the deck"
                        % (key, stamped, len(deck["chords"])))
                    self.assertNotIn("LEGEND", tight,
                                     "%s: legend card leaked into the print "
                                     "shop file" % key)
                    self.assertNotIn("CHORDCARDS", tight,
                                     "%s: title card leaked into the print "
                                     "shop file" % key)
                else:
                    self.assertEqual(stamped, 9 * pages,
                                     "%s: full deck must fill every slot" % key)
                    self.assertGreaterEqual(stamped, len(deck["chords"]) + 2)
                    self.assertIn("LEGEND", tight,
                                  "%s: full deck is missing its legend card"
                                  % key)
                    self.assertIn("CHORDCARDS", tight,
                                  "%s: full deck is missing its title card"
                                  % key)

    def test_note_and_number_lines_print_in_spelling_order(self):
        """Both bottom lines run in chord-spelling order from the root.

        Asserted as ordered substrings: every field label of a deck is printed
        inside the diagram, so "note X appears" would be true regardless.
        """
        for key, deck, _chords_only, _pages in JOBS:
            marks = flat(self.text[key])
            spec = deck["spec"]
            for chord in deck["chords"]:
                main, sup, _sub, fields, _roots = chord
                notes = " - ".join("%s%s" % (spec[f][0], spec[f][1])
                                   for f in fields)
                numbers = " - ".join(spec[f][5] for f in fields)
                with self.subTest(pdf=key, chord=main + sup):
                    self.assertIn(notes, marks,
                                  "%s %s%s: note line %r missing or reordered"
                                  % (key, main, sup, notes))
                    self.assertIn(numbers, marks,
                                  "%s %s%s: number line %r missing or "
                                  "reordered" % (key, main, sup, numbers))

    def test_no_german_card_copy(self):
        for key in self.docs:
            with self.subTest(pdf=key):
                tight = squeeze(self.text[key])
                hits = [w for w in GERMAN_WORDS if w in tight]
                hits += GERMAN_DUR.findall(flat(self.text[key]))
                self.assertEqual(hits, [],
                                 "%s: German card copy is back: %r"
                                 % (key, hits))

    def test_committed_pdfs_match_a_fresh_build(self):
        """Staleness gate: the checked-in PDFs must be current.

        Edit deck data without rerunning tools/decks.py and this goes red -
        app and print would otherwise silently diverge.
        """
        stale = []
        for key, _deck, _chords_only, _pages in JOBS:
            committed = os.path.join(paths.ROOT, paths.PDFS[key])
            self.assertTrue(os.path.isfile(committed),
                            "%s is not committed in the repo root" % key)
            with pymupdf.open(committed) as doc:
                if doc.page_count != self.docs[key].page_count:
                    stale.append("%s: %d committed pages vs %d rebuilt"
                                 % (paths.PDFS[key], doc.page_count,
                                    self.docs[key].page_count))
                    continue
                if squeeze(doc_text(doc)) != squeeze(self.text[key]):
                    stale.append("%s: committed text differs from a rebuild"
                                 % paths.PDFS[key])
        self.assertEqual(
            stale, [],
            "committed PDFs are out of date - rerun `python3 tools/decks.py` "
            "and commit the result:\n  " + "\n  ".join(stale))


if __name__ == "__main__":
    unittest.main()
