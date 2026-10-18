// Option P coverage (import v2, Phase 1, section D2). Evidence, not product.
// For every gold case with known true pitches, asks: could a user who picks the
// right ding (with its octave) and one handpaner.com catalog entry get the
// case's pan? The catalog (a JSON array of {name, definition}, extracted 2026-10-17 from
// https://handpaner.com/nuxt/bd049b5.js; source repo Robhub/handpaner, MIT,
// Copyright (c) 2020 Robin) is ding-first and octaveless; octaves follow
// handpaner's own rule: a note goes up an octave when its letter index is at
// or below the previous one's, chained from the ding; a digit pins an octave.
// (X) is a BOTTOM note in handpaner (our syntax uses [X]). The catalog is NOT
// committed (reuse permission is an owner step); the extract used had sha256
// 7abe3d402dd356ae2f3b283f456730f5b2f89ff613e3fa1c737f5b80b9fba359. Results keep
// only the matched entry name.
//   exact: ding, top set and bottom set all equal by MIDI
//   near:  same top set (by MIDI, after transposing to the ding), different bottoms
//   pc-only: only the pitch-class set matches (a different pan; not usable as a preset)
//   none:  anything else
//   node docs/plans/import-v2-eval/pcoverage.cjs <gold.json> <catalog.json> <out.json>
const fs = require("node:fs");
const { loadEngine } = require("../../../tools/engine_loader.js");
const E = loadEngine(["core"]);
const [goldPath, catPath, outPath] = process.argv.slice(2);
const gold = JSON.parse(fs.readFileSync(goldPath, "utf8"));
const cat = JSON.parse(fs.readFileSync(catPath, "utf8"));

const ORDER = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pc = (n) => (PC[n[0]] + (n.slice(1) === "#" ? 1 : n.slice(1) === "b" ? -1 : 0) + 12) % 12;

function expand(def) {
  const [dingTok, rest] = def.split("/");
  const dm = /^([A-G][#b]?)(\d)?$/.exec(dingTok.trim());
  let oct = dm[2] ? +dm[2] : 3;
  let prevIdx = ORDER.indexOf(dm[1]);
  const ding = (oct + 1) * 12 + pc(dm[1]);
  const notes = [];
  for (const raw of rest.trim().split(/\s+/)) {
    const bottom = /^\(.*\)$/.test(raw);
    const m = /^[([]?([A-G][#b]?)(\d)?[)\]]?$/.exec(raw);
    const idx = ORDER.indexOf(m[1]);
    if (m[2]) oct = +m[2];
    else if (idx <= prevIdx) oct += 1;
    prevIdx = idx;
    notes.push({ midi: (oct + 1) * 12 + pc(m[1]), bottom });
  }
  return { ding, top: notes.filter((n) => !n.bottom).map((n) => n.midi), bottom: notes.filter((n) => n.bottom).map((n) => n.midi) };
}

function truth(seed) {
  const p = E.core.parseSeed(seed);
  if (!p.ok) throw new Error(seed + ": " + p.code);
  const f = Object.values(p.value.fields);
  return {
    ding: f.find((x) => x[3] === "ding")[2],
    top: f.filter((x) => x[3] === "rim" || x[3] === "inner").map((x) => x[2]),
    bottom: f.filter((x) => x[3] === "bottom").map((x) => x[2]),
  };
}

const key = (a) => [...a].sort((x, y) => x - y).join(",");
const pcs = (s) => key([...new Set([s.ding, ...s.top, ...s.bottom].map((m) => m % 12))]);

const rows = [];
for (const c of gold.cases) {
  if (!c.expected.seed) { rows.push({ id: c.id, coverage: "n/a" }); continue; }
  const t = truth(c.expected.seed);
  let best = { coverage: "none" };
  for (const e of cat) {
    const x = expand(e.definition);
    const d = t.ding - x.ding;
    const s = { ding: t.ding, top: x.top.map((m) => m + d), bottom: x.bottom.map((m) => m + d) };
    const topEq = key(s.top) === key(t.top);
    if (topEq && key(s.bottom) === key(t.bottom)) { best = { coverage: "exact", entry: e }; break; }
    if (topEq && best.coverage !== "near") best = { coverage: "near", entry: e };
    else if (best.coverage === "none" && pcs(s) === pcs(t)) best = { coverage: "pc-only", entry: e };
  }
  rows.push({ id: c.id, notes: 1 + t.top.length + t.bottom.length, bottoms: t.bottom.length, coverage: best.coverage, entry: best.entry ? best.entry.name : null });
}
const totals = rows.reduce((a, r) => ((a[r.coverage] = (a[r.coverage] || 0) + 1), a), {});
fs.writeFileSync(outPath, JSON.stringify({ ranAt: new Date().toISOString(), catalogEntries: cat.length, totals, rows }, null, 1) + "\n");
console.log(JSON.stringify(totals));
for (const r of rows) console.log([r.id, r.coverage, r.notes, r.bottoms, r.entry || ""].join(" | "));
