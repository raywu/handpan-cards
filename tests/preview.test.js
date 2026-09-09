// The pan-layout preview inside the Add/Edit scale sheet.
//
// Owner request (2026-09-09): "instead of just right first or left first, can we
// render a mock of the notes on the pan to help user visualize before committing
// to generating cards?" These tests hold the sheet to that: while a seed is
// being typed, the sheet shows WHERE the notes land - ding, rim zig-zag, inner
// pair, dashed bottom ring - and the LEFT-FIRST / RIGHT-FIRST choice visibly
// moves them.
//
// Everything asserted here is user-observable through the sheet: what a person
// typing into #scale-box sees before pressing GENERATE CARDS. No chord is
// selected, so the preview is the bare pan.
const { test } = require("node:test");
const assert = require("node:assert");
const { boot } = require("./helpers/sandbox.js");

/* ------------------------------------------------------------------ helpers */

// Seeds used throughout. The Pygmy-shaped one exercises all four zones: a ding,
// a full rim, an inner pair (the `/` separator) and a bottom shell (after `|`).
const PLAIN = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
const FULL = "(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 / F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5";
const NO_BOTTOM = "(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 / F5 G5";

/** Open the create sheet and type a seed into it, as a person does. */
function typeInSheet(app, seed) {
  app.run("openScaleSheet()");
  app.type(seed);
}

/** The preview markup currently on the sheet. */
const previewHTML = (app) => app.els["scale-preview"].innerHTML;

/** Every `<circle>` in the preview, as {cx, cy, r, ...attrs} records. */
function circles(svg) {
  return [...svg.matchAll(/<circle([^>]*)\/>/g)].map((m) => {
    const at = {};
    for (const a of m[1].matchAll(/([\w-]+)="([^"]*)"/g)) at[a[1]] = a[2];
    return at;
  });
}

/** Every `<text>` element's flattened content, in document order. */
function texts(svg) {
  return [...svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
    .map((m) => m[1].replace(/<[^>]*>/g, "").replace(/\s+/g, ""));
}

/** note label -> its x position in the preview, rounded to a tenth. */
function notePositions(svg) {
  const out = {};
  for (const m of svg.matchAll(/<text x="([^"]+)" y="[^"]+"[\s\S]*?>([\s\S]*?)<\/text>/g)) {
    const label = m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, "");
    if (!/^[A-G]/.test(label)) continue;          // note labels, not the numbers
    out[label] = Number(Number(m[1]).toFixed(1)) + 0;
  }
  return out;
}

/** The note labels the parse line reports, e.g. ["D3","A3",...]. */
function seedNotes(app, seed) {
  const res = app.get(`HPE.core.parseSeed(${JSON.stringify(seed)}, {})`);
  assert.ok(res.ok, `seed did not parse: ${seed}`);
  const fields = res.value.fields;
  return Object.keys(fields).map((k) => fields[k][0] + fields[k][1]);
}

/** Click one of the two mirror buttons through its own handler. */
function clickMirror(app, which) {
  app.els[which === "left" ? "scale-mirror-l" : "scale-mirror-r"].onclick();
}

/* ------------------------------------------------------- the preview exists */

test("typing a scale renders a pan preview in the sheet", () => {
  const app = boot();
  typeInSheet(app, PLAIN);
  const svg = previewHTML(app);
  assert.match(svg, /^<svg\b/, "the preview should be an inline SVG pan");
  assert.ok(svg.includes("</svg>"), "the preview SVG should be closed");
});

test("the preview appears before any card is generated", () => {
  const app = boot();
  const before = app.registry ? Object.keys(app.registry()).length : 0;
  typeInSheet(app, PLAIN);
  assert.ok(previewHTML(app).includes("<svg"), "preview should be up while typing");
  assert.strictEqual(Object.keys(app.registry()).length, before,
    "previewing must not generate a deck");
});

test("every seed note is drawn in the preview, ding and bottom shell included", () => {
  const app = boot();
  typeInSheet(app, FULL);
  const drawn = texts(previewHTML(app));
  for (const note of seedNotes(app, FULL)) {
    assert.ok(drawn.includes(note), `${note} is missing from the preview`);
  }
});

test("the ding sits at the centre of the preview", () => {
  const app = boot();
  typeInSheet(app, FULL);
  const svg = previewHTML(app);
  const centred = circles(svg).filter((c) => c.cx === "0");
  assert.ok(centred.length >= 1, "the ding circle should sit on the vertical axis");
});

test("a seed with bottom notes draws the dashed bottom ring; one without does not", () => {
  const dashedRing = (svg) =>
    circles(svg).some((c) => c["stroke-dasharray"] && !("cx" in c));
  const withBottom = boot();
  typeInSheet(withBottom, FULL);
  assert.ok(dashedRing(previewHTML(withBottom)),
    "a bottom shell should be shown as a dashed x-ray ring");
  const without = boot();
  typeInSheet(without, NO_BOTTOM);
  assert.ok(!dashedRing(previewHTML(without)),
    "a pan with no bottom shell should have no bottom ring");
});

test("the inner pair is drawn inside the rim, not on it", () => {
  const app = boot();
  typeInSheet(app, FULL);
  const svg = previewHTML(app);
  const notes = circles(svg).filter((c) => "cx" in c && c.cx !== "0");
  const orbits = notes.map((c) => Math.hypot(Number(c.cx), Number(c.cy)));
  const distinct = [...new Set(orbits.map((o) => o.toFixed(2)))];
  assert.ok(distinct.length >= 3,
    `expected rim, inner and bottom orbits, saw ${distinct.length}`);
});

/* ---------------------------------------------- LEFT-FIRST vs RIGHT-FIRST */

test("flipping the mirror moves the notes in the preview", () => {
  const app = boot();
  typeInSheet(app, PLAIN);
  clickMirror(app, "right");
  const right = previewHTML(app);
  clickMirror(app, "left");
  const left = previewHTML(app);
  assert.notStrictEqual(left, right,
    "LEFT-FIRST and RIGHT-FIRST must look different - that is the whole request");
  assert.notDeepStrictEqual(notePositions(left), notePositions(right),
    "the notes should sit in different places, not merely carry a changed attribute");
});

test("the mirror flip is a mirror: a rim note swaps sides", () => {
  const app = boot();
  typeInSheet(app, PLAIN);
  clickMirror(app, "right");
  const rx = notePositions(previewHTML(app)).C4;
  clickMirror(app, "left");
  const lx = notePositions(previewHTML(app)).C4;
  assert.ok(typeof rx === "number" && typeof lx === "number",
    "the rim note C4 should be labelled in the preview");
  assert.ok(rx * lx < 0,
    `a rim note should change sides between the two zig-zags, saw x=${rx} then x=${lx}`);
});

/* --------------------------------------------------- unhighlighted, chordless */

test("the preview highlights nothing - no chord is chosen yet", () => {
  const app = boot();
  typeInSheet(app, FULL);
  const svg = previewHTML(app);
  const palettes = app.get("HPE.select.PALETTES");
  for (let i = 0; i < palettes.length; i += 1) {
    const p = palettes[i];
    assert.ok(!svg.includes(p.root), `palette ${i} root colour should not appear`);
    assert.ok(!svg.includes(p.tone), `palette ${i} tone colour should not appear`);
  }
});

test("a chordless pan render does not throw and lights no field", () => {
  const app = boot();
  const svg = app.get(
    "pan({geom: HPE.layout.solve(HPE.core.parseSeed(" + JSON.stringify(PLAIN) +
    ", {}).value, {mirror:false}).value.geom, fields: HPE.layout.solve(HPE.core.parseSeed(" +
    JSON.stringify(PLAIN) + ", {}).value, {mirror:false}).value.fields, " +
    "colors: HPE.select.PALETTES[0]}, null)");
  assert.match(svg, /^<svg\b/);
  const p = app.get("HPE.select.PALETTES[0]");
  assert.ok(!svg.includes(p.root) && !svg.includes(p.tone),
    "a chordless pan must light no field");
});

/* ------------------------------------------------------------ bad input */

test("an unparseable seed leaves no stale preview on the sheet", () => {
  const app = boot();
  typeInSheet(app, PLAIN);
  assert.ok(previewHTML(app).includes("<svg"));
  app.type("(D3) A3 zzz");
  assert.ok(!previewHTML(app).includes("<svg"),
    "a seed that does not parse should clear the preview, not keep the old pan");
});

test("an empty box shows no preview", () => {
  const app = boot();
  typeInSheet(app, PLAIN);
  app.type("");
  assert.ok(!previewHTML(app).includes("<svg"), "an empty box should show no pan");
});

/* ------------------------------------------------- the card path is untouched */

test("the preview is drawn by the same pan() the cards use", () => {
  const app = boot();
  typeInSheet(app, PLAIN);
  const svg = previewHTML(app);
  const face = app.faces();
  // The pan's fixed furniture - the rim circle at r=100 with a 2px black stroke -
  // is identical in both, which is what "one renderer" means here.
  const rim = '<circle r="100" fill="none" stroke="#000" stroke-width="2"/>';
  assert.ok(svg.includes(rim), "the preview should use the shared pan renderer");
  assert.ok(face.includes(rim), "the card should use the shared pan renderer");
});
