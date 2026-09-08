// Dumps what the APP actually renders for every card, as JSON on stdout, so the
// Python side can compare it against what the PRINT pipeline draws.
// Everything here is parsed back out of the emitted SVG, so this reflects
// rendered output rather than restating either implementation's logic.
const { boot } = require("./sandbox.js");

const app = boot();
const DECKS = app.get("DECKS");
const r3 = (v) => Math.round(v * 1000) / 1000;
const out = [];

for (const d of DECKS) {
  const deckRef = `DECKS.find(x=>x.id===${JSON.stringify(d.id)})`;
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
    const fields = [];
    for (const [key, group] of byCentre) {
      const [x, y] = key.split(",").map(Number);
      const all = group.map((g) => g.attrs).join(" ");
      let state = "off";
      if (all.includes(`stroke="${d.colors.root}"`)) state = "root";
      else if (all.includes(`stroke="${d.colors.tone}"`)) state = "tone";
      else if (all.includes('stroke-dasharray')) state = "off-bottom";
      // Outer circle radius identifies the field; band/hairline are smaller.
      fields.push({ x, y, r: r3(Math.max(...group.map((g) => g.r))), state });
    }
    fields.sort((a, b) => a.x - b.x || a.y - b.y);

    out.push({
      deck: d.id,
      index: i,
      name: ch.main + ch.sup,
      noteOrder: ch.fields,
      badge: ch.fields.filter((f) => d.fields[f][3] === "bottom").length,
      fields,
    });
  }
}
process.stdout.write(JSON.stringify(out));
