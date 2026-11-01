// Dumps what the APP actually renders for every card, as JSON on stdout, so the
// Python side can compare it against what the PRINT pipeline draws.
// Everything here is parsed back out of the emitted SVG, so this reflects
// rendered output rather than restating either implementation's logic.
const { boot } = require("./sandbox.js");

const app = boot();
// With file arguments each is a generated-deck payload ({deck}) drawn instead of
// the built-ins, keyed by its basename without `profile_case_`/`_v2.json`.
const extra = process.argv.slice(2).map((f) => {
  const deck = JSON.parse(require("node:fs").readFileSync(f, "utf8")).deck;
  deck.id = require("node:path").basename(f).replace(/^profile_case_/, "profile_").replace(/_v2\.json$/, "");
  return deck;
});
const DECKS = extra.length ? extra : app.get("DECKS");
const r3 = (v) => Math.round(v * 1000) / 1000;
const out = [];

for (const d of DECKS) {
  const deckRef = extra.length ? JSON.stringify(d) : `DECKS.find(x=>x.id===${JSON.stringify(d.id)})`;
  for (let i = 0; i < d.chords.length; i++) {
    const ch = d.chords[i];
    const svg = app.get(`pan(${deckRef}, ${deckRef}.chords[${i}])`);

    // Field circles carry cx/cy; chrome circles (outer rim, inner ring, dashed
    // bottom ring) are centred on the origin and omit them.
    const circles = [];
    const re = /<circle cx="([-\d.eE+]+)" cy="([-\d.eE+]+)" r="([\d.eE+-]+)"([^/]*)\/>/g;
    let m;
    while ((m = re.exec(svg)) !== null) {
      circles.push({ x: +m[1], y: +m[2], r: +m[3], attrs: m[4] });
    }

    // Group the stacked circles of one tonefield by centre, then classify.
    const byCentre = new Map();
    for (const c of circles) {
      const key = `${r3(c.x)},${r3(c.y)}`;
      if (!byCentre.has(key)) byCentre.set(key, []);
      byCentre.get(key).push(c);
    }
    let fields = [];
    if (d.geom && d.geom.place) {
      // Neotone: a field is a black 1.2-wide outline circle (a main tonefield
      // or the ding); its band is a ring circle, or a crescent path where the
      // card has a lens. Mirrors neo_fields in tests/test_render_agreement.py.
      const byXY = new Map();
      for (const c of circles) {
        if (/stroke="#000"/.test(c.attrs) && Math.abs(+c.attrs.match(/stroke-width="([\d.eE+-]+)"/)[1] - 1.2) < 0.01) {
          const k = `${r3(c.x)},${r3(c.y)}`;
          if (!byXY.has(k)) byXY.set(k, { x: r3(c.x), y: r3(c.y), r: r3(c.r), state: "off" });
        }
      }
      const stateOf = (col) => (col === d.colors.root ? "root" : col === d.colors.tone ? "tone" : null);
      for (const c of circles) {
        const f = byXY.get(`${r3(c.x)},${r3(c.y)}`);
        const col = (c.attrs.match(/stroke="([^"]+)"/) || [])[1];
        if (f && stateOf(col)) {
          f.state = stateOf(col);
          f.bandWidth = r3(+c.attrs.match(/stroke-width="([\d.eE+-]+)"/)[1]);
        }
      }
      const mains = [...byXY.values()].filter((f) => f.r < 25);
      for (const m of svg.matchAll(/<path d="M([-\d.eE+]+) ([-\d.eE+]+)[^"]*"[^>]*?stroke="([^"]+)" stroke-width="([\d.eE+-]+)"/g)) {
        const w = +m[4], st = stateOf(m[3]);
        if (st && Math.abs(w - 4.6) < 0.01 && mains.length) {
          const f = mains.reduce((a, b) => (Math.hypot(a.x - +m[1], a.y - +m[2]) <= Math.hypot(b.x - +m[1], b.y - +m[2]) ? a : b));
          f.state = st;
          f.bandWidth = r3(w);
        }
      }
      fields = [...byXY.values()];
    }
    for (const [key, group] of d.geom && d.geom.place ? [] : byCentre) {
      const [x, y] = key.split(",").map(Number);
      const all = group.map((g) => g.attrs).join(" ");
      let state = "off";
      if (all.includes(`stroke="${d.colors.root}"`)) state = "root";
      else if (all.includes(`stroke="${d.colors.tone}"`)) state = "tone";
      else if (all.includes('stroke-dasharray')) state = "off-bottom";
      // A lit field is three stacked circles (outer, band, hairline),
      // largest to smallest, per `field()` in index.html; an unlit field
      // draws only the outer one.
      const ordered = [...group].sort((a, b) => b.r - a.r);
      const entry = { x, y, r: r3(ordered[0].r), state };
      if ((state === "root" || state === "tone") && ordered.length === 3) {
        const band = ordered[1], hairline = ordered[2];
        const bandSW = band.attrs.match(/stroke-width="([\d.eE+-]+)"/);
        entry.bandR = r3(band.r);
        entry.bandWidth = r3(+bandSW[1]);
        entry.hairlineR = r3(hairline.r);
      }
      fields.push(entry);
    }
    fields.sort((a, b) => a.x - b.x || a.y - b.y);

    // The note-NAME labels the diagram actually draws, keyed by the field
    // they name (its note plus its octave, e.g. "Ab4" - unique within a
    // deck). A name label is the only <text> carrying a <tspan> (its
    // octave), so this cannot pick up the index numbers. R is 100 in the
    // app's own viewBox, the same normalisation the Python side puts the
    // print sizes into. Keyed rather than sorted so the comparison is
    // per FIELD: two renderers can draw the same multiset of sizes and still
    // hand them to different fields.
    const labelSizes = {};
    for (const m of svg.matchAll(
      /<text[^>]*font-size="([\d.eE+-]+)"[^>]*>([^<]*)<tspan[^>]*>([^<]*)<\/tspan>/g)) {
      labelSizes[m[2] + m[3]] = r3(+m[1]);
    }

    // The index numbers: the diagram's other <text> runs, the ones with no
    // <tspan>, keyed by what each one says ("1".."9", "U1"..). A name label's
    // content is broken by its nested <tspan>, so this pattern - which
    // requires plain text straight up to </text> - never matches one.
    // Captures fill too: bottom-shell numbers draw in orange (Q24), every
    // other number in the app's ink colour.
    const numberSizes = {};
    const numberFills = {};
    for (const m of svg.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)) {
      const attrs = m[1], text = m[2];
      const sizeM = attrs.match(/font-size="([\d.eE+-]+)"/);
      if (!sizeM) continue;
      numberSizes[text] = r3(+sizeM[1]);
      const fillM = attrs.match(/fill="([^"]+)"/);
      if (fillM) numberFills[text] = fillM[1];
    }

    // The note line, number line and badge as the app actually RENDERS them,
    // parsed back out of linesHTML - not re-read from ch.fields, which would
    // just compare two copies of the same input data.
    const lines = app.get(`linesHTML(${deckRef}, ${deckRef}.chords[${i}])`);
    const noteLine = [...lines.matchAll(/<span style="color:[^"]*">([^<]*)<sub>(\d)<\/sub><\/span>/g)]
      .map((m) => m[1] + m[2]);
    const numLine = [...lines.matchAll(/<span style="color:[^"]*">([^<]*)<\/span>/g)]
      .map((m) => m[1]).filter((t) => !/<sub>/.test(t));
    const badgeMatch = lines.match(/<div class="badge">([^<]*)<\/div>/);

    out.push({
      deck: d.id,
      index: i,
      name: ch.main + ch.sup,
      noteLine,
      numLine,
      badgeText: badgeMatch ? badgeMatch[1].trim() : "",
      labelSizes,
      numberSizes,
      numberFills,
      fields,
    });
  }
}
process.stdout.write(JSON.stringify(out));
