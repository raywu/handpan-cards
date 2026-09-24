"use strict";
// HPE.pdfdeck.fromBuiltin: the same job fromGenerated does, for the three
// SHIPPED decks. tools/decks.py:_from_canonical is the reference this ports -
// a built-in deck has no geom.ext, no synthesized title, and its print copy
// (R, cy, title, credit, legend, blurb, blank_cards, colours) is hand-written
// in data/decks.json's `print` key rather than derived from the pan. This
// file pins the hand-off from that overlay into the shape pdfcards.js reads
// (spec._geom, top-level blank_cards) - the one thing
// tests/test_pdf_parity.py structurally cannot see, because it only reads
// rendered glyphs and pymupdf drawings, never the intermediate object.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const { loadEngine } = require("./helpers/engine.js");

const HPE = loadEngine(["fontdata", "pdf", "pdfdeck", "pdfcards"]);
const ROOT = path.join(__dirname, "..");

const CANONICAL = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "decks.json"), "utf8"));

function deckById(id) {
  const d = CANONICAL.find((x) => x.id === id);
  assert.ok(d, id + " must exist in data/decks.json");
  return d;
}

function fieldIds(spec) {
  return Object.keys(spec).filter((k) => k !== "_geom");
}

function zoneIds(spec, zones) {
  return fieldIds(spec).filter((k) => zones.indexOf(spec[k][3]) >= 0);
}

test("R, cy, title, credit, legend_lines and colours carry through unchanged", () => {
  const deck = deckById("hijaz");
  const built = HPE.pdfdeck.fromBuiltin(deck, deck.print);
  assert.equal(built.R, deck.print.R);
  assert.equal(built.cy, deck.print.cy);
  assert.equal(built.y_note, deck.print.y_note);
  assert.equal(built.y_num, deck.print.y_num);
  assert.equal(built.title, deck.print.title);
  assert.equal(built.credit, deck.print.credit);
  assert.deepEqual(built.legend_lines, deck.print.legend_lines);
  assert.deepEqual(built.legend_demo, deck.print.legend_demo);
  assert.deepEqual(built.col_root, deck.print.col_root);
  assert.deepEqual(built.col_tone, deck.print.col_tone);
  assert.deepEqual(built.grad, deck.print.grad);
});

test("blank_cards reaches the top level through the overlay flatten", () => {
  // Reviewer nit from W1a: print.blank_cards is nested, but
  // src/engine/pdfcards.js:557 reads the top-level `deck.blank_cards`.
  // fromBuiltin has no dedicated lift for this key - the generic
  // `Object.keys(overlay).forEach(k => out[k] = overlay[k])` flatten already
  // copies every overlay key, `blank_cards` included, onto `out`. A flatten
  // that stopped copying unrecognised overlay keys would silently drop
  // Pygmy's 7 blank cards from the full PDF.
  const pygmy = deckById("pygmy");
  assert.equal(pygmy.print.blank_cards, 7, "fixture assumption");
  const built = HPE.pdfdeck.fromBuiltin(pygmy, pygmy.print);
  assert.equal(built.blank_cards, 7);

  const hijaz = deckById("hijaz");
  assert.ok(!("blank_cards" in hijaz.print), "fixture assumption");
  const builtHijaz = HPE.pdfdeck.fromBuiltin(hijaz, hijaz.print);
  assert.ok(builtHijaz.blank_cards === undefined || builtHijaz.blank_cards === 0);
});

test("blurb carries the overlay text with the LAST line's chord count substituted", () => {
  // tools/decks.py:_from_canonical - the overlay's blurb literal is stale by
  // design (data A2/B1); only the chord count in the final line is derived
  // from the deck's own chord list, everything else (including the scale
  // line) is the hand-written literal, verbatim.
  for (const id of ["hijaz", "pygmy", "amara"]) {
    const deck = deckById(id);
    const built = HPE.pdfdeck.fromBuiltin(deck, deck.print);
    assert.equal(built.blurb.length, deck.print.blurb.length, id);
    // every line but the last is untouched
    for (let i = 0; i < built.blurb.length - 1; i++) {
      assert.equal(built.blurb[i], deck.print.blurb[i], id + " line " + i);
    }
    const lastOverlay = deck.print.blurb[deck.print.blurb.length - 1];
    const lastBuilt = built.blurb[built.blurb.length - 1];
    const expected = lastOverlay.replace(/\d+(?=\s*CHORDS)/g,
                                         String(deck.chords.length));
    assert.equal(lastBuilt, expected, id);
    // The overlay literal is stale on all three decks (A2/B1) - if this ever
    // stops being true for a deck, the substitution would be a no-op there
    // and this test would not be exercising it. Guard the fixture assumption.
    assert.notEqual(lastOverlay, expected,
                    id + ": overlay chord count is no longer stale - " +
                    "update the fixture assumption note");
  }
});

test("blurb substitution replaces every chord count in the last line, not just the first", () => {
  // Row 17: a `String.replace` without the `/g` flag replaces only the FIRST
  // match. A last line with two counts before "CHORDS" (a shape no shipped
  // deck happens to carry, but nothing in the overlay format forbids it)
  // would substitute only the first and leave the second stale - a mutant
  // dropping the flag must turn this red.
  const deck = deckById("amara");
  const n = deck.chords.length;
  const overlay = Object.assign({}, deck.print, {
    blurb: deck.print.blurb.slice(0, -1).concat(
      ["3 CHORDS TODAY, WAS 3 CHORDS YESTERDAY"]),
  });
  const built = HPE.pdfdeck.fromBuiltin(deck, overlay);
  assert.equal(built.blurb[built.blurb.length - 1],
    n + " CHORDS TODAY, WAS " + n + " CHORDS YESTERDAY");
});

test("fields + geom convert into spec + _geom the way pdfcards.js reads them", () => {
  const deck = deckById("amara");
  const built = HPE.pdfdeck.fromBuiltin(deck, deck.print);
  assert.deepEqual(built.spec._geom, deck.geom);
  for (const fid of Object.keys(deck.fields)) {
    assert.deepEqual(built.spec[String(Number(fid))], deck.fields[fid]);
  }
  assert.equal(fieldIds(built.spec).length, Object.keys(deck.fields).length);
});

test("sub comes from data/decks.json, not a synthesized string", () => {
  const deck = deckById("hijaz");
  const built = HPE.pdfdeck.fromBuiltin(deck, deck.print);
  assert.equal(built.sub, deck.sub);
  assert.notEqual(built.sub, undefined);
});

test("degrees convert to int-keyed strings", () => {
  const deck = deckById("pygmy");
  const built = HPE.pdfdeck.fromBuiltin(deck, deck.print);
  for (const pc of Object.keys(deck.degrees)) {
    assert.equal(built.degrees[String(Number(pc))], deck.degrees[pc]);
  }
});

test("has_bottom reflects whether any field is in the bottom zone", () => {
  const hijaz = deckById("hijaz");
  const pygmy = deckById("pygmy");
  assert.equal(HPE.pdfdeck.fromBuiltin(hijaz, hijaz.print).has_bottom, false);
  assert.equal(HPE.pdfdeck.fromBuiltin(pygmy, pygmy.print).has_bottom, true);
});

test("every voicing field and every root field survives, for all 96 cards", () => {
  // T15's coverage floor: this must not re-derive a chord's voicing from the
  // pan (which would silently re-rank Pygmy's Fm9 - see CLAUDE.md's D-6
  // note) - it must carry the chord list through byte for byte.
  let total = 0;
  for (const id of ["hijaz", "pygmy", "amara"]) {
    const deck = deckById(id);
    const built = HPE.pdfdeck.fromBuiltin(deck, deck.print);
    assert.equal(built.chords.length, deck.chords.length, id);
    deck.chords.forEach((c, i) => {
      const [main, sup, subtitle, fields, roots] = built.chords[i];
      assert.equal(main, c.main, id + " chord " + i);
      assert.equal(sup, c.sup, id + " chord " + i);
      assert.equal(subtitle, c.subtitle, id + " chord " + i);
      assert.deepEqual(fields, c.fields, id + " chord " + i + " fields");
      assert.deepEqual(roots, c.roots, id + " chord " + i + " roots");
      total += 1;
    });
  }
  assert.equal(total, 19 + 52 + 25, "96 cards across the three built-ins");
});

test("a canonical/overlay key clash throws rather than silently shadowing", () => {
  const deck = deckById("hijaz");
  const badOverlay = Object.assign({}, deck.print, { name: "nope" });
  assert.throws(() => HPE.pdfdeck.fromBuiltin(deck, badOverlay));
});

test("fromBuiltin returns warnings: [] - a built-in never carries one, but pdfcards.js's CARD_WARNINGS badge and fromGenerated's own `warnings` key both read the same shape", () => {
  // tools/decks.py's _from_canonical has no warnings key at all - built-ins
  // are hand-authored and never warned. This is a deliberate extra key on the
  // JS side only, not part of the statement-for-statement port, so a caller
  // that reads `.warnings` off either adapter's output never has to branch on
  // which one produced it.
  for (const id of ["hijaz", "pygmy", "amara"]) {
    const deck = deckById(id);
    const built = HPE.pdfdeck.fromBuiltin(deck, deck.print);
    assert.deepEqual(built.warnings, [], id);
  }
});

/* ------------------------------------------------------------------ *
 * row 20: tools/pdf_build.js --builtin with a missing or malformed value
 * ------------------------------------------------------------------ */
test("pdf_build.js --builtin with no value prints usage and exits 2", () => {
  const { spawnSync } = require("node:child_process");
  const os = require("node:os");
  const outFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pdf-build-")), "x.pdf");
  const r = spawnSync(process.execPath,
    [path.join(ROOT, "tools", "pdf_build.js"), "--out", outFile, "--builtin"],
    { encoding: "utf8", input: "", timeout: 10000 });
  assert.strictEqual(r.status, 2, "stdout:\n" + r.stdout + "\nstderr:\n" + r.stderr);
  assert.match(r.stderr, /usage/i);
});

test("pdf_build.js --builtin --out swallows the next flag as its value and must still exit 2 with usage", () => {
  const { spawnSync } = require("node:child_process");
  const os = require("node:os");
  const outFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pdf-build-")), "x.pdf");
  const r = spawnSync(process.execPath,
    [path.join(ROOT, "tools", "pdf_build.js"), "--builtin", "--out", outFile],
    { encoding: "utf8", input: "", timeout: 10000 });
  assert.strictEqual(r.status, 2, "stdout:\n" + r.stdout + "\nstderr:\n" + r.stderr);
  assert.match(r.stderr, /usage/i);
});
