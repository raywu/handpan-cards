#!/usr/bin/env node
/* Writes tests/fixtures/order_follow_base_aabcc0c.json ONCE: the engine's
 * observable output at aabcc0c for a fixed corpus, so the order-follow lane can
 * prove an ascending line is byte-identical. Never run in CI, never regenerated.
 * Loads every engine module from `git show aabcc0c:src/engine/<m>.js`.
 */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const REF = "aabcc0c";
const ROOT = path.join(__dirname, "..");
const FX = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "fixtures", n), "utf8"));
const MODS = ["fontdata", "pdf", "pdfdeck", "pdfcards", "core", "importer", "voicing", "layout", "naming", "select", "share", "sequence"];

function loadBase() {
  const sb = { console, URL, URLSearchParams, TextEncoder, TextDecoder, structuredClone, btoa, atob };
  vm.createContext(sb);
  for (const m of MODS) {
    let src;
    try {
      src = execFileSync("git", ["show", `${REF}:src/engine/${m}.js`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch (e) { continue; }
    vm.runInContext(src, sb, { filename: `${REF}/${m}.js` });
  }
  return sb.HPE;
}

const H = loadBase();
const sha = (x) => crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);
const BUILTIN = {
  hijaz: ["(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4", undefined],
  amara: ["(D3) A3 C4 D4 E4 F4 G4 A4 C5", undefined],
  kurd: ["(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5", undefined],
  amara10: ["(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5", undefined],
  pygmy: ["(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 / F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5", { anchor: "between" }],
};
const COMBOS = [];
for (const anchor of ["one", "between"]) for (const mirror of [false, true]) for (const mb of [undefined, false, true]) {
  const o = { anchor, mirror };
  if (mb !== undefined) o.mirrorBottom = mb;
  COMBOS.push(o);
}

function expectedSeats(v) {
  if (!v.typed) return null;
  const out = {};
  let any = false;
  for (const r of ["rim", "inner"]) {
    const ids = Object.keys(v.fields).filter((k) => v.fields[k][3] === r).map(Number).sort((a, b) => a - b);
    const typed = v.typed.filter((k) => v.fields[k][3] === r).map(Number);
    const seats = ids.map((id) => typed.indexOf(id));
    if (seats.some((s, i) => s !== i)) { out[r] = seats; any = true; }
  }
  return any ? out : null;
}

function labelMap(fields, zone) {
  const m = {};
  for (const id of Object.keys(fields)) if (fields[id][3] === zone) m[fields[id][5]] = fields[id][4];
  return m;
}

function caseOf(source, string, reader, options, extra) {
  const parse = reader === "legacy" ? H.core.parseLegacySeed(string, options) : H.core.parseSeed(string, options);
  const c = Object.assign({ source, string, reader }, extra || {});
  if (options) c.options = options;
  if (!parse.ok) { c.parse = { ok: false, code: parse.code }; return c; }
  const v = parse.value;
  c.parse = { ok: true };
  c.fields = v.fields;
  c.deckId = H.core.deckId(v);
  c.formatSeed = H.core.formatSeed(v.fields);
  c.seats = expectedSeats(v);
  c.solve = COMBOS.map((o) => sha(H.layout.solve(v, o)));
  const enc = H.share.encode(v);
  c.share = enc.ok ? enc.value : { code: enc.code };
  const reparsed = H.core.parseSeed(c.formatSeed, options);
  if (reparsed.ok) {
    const built = H.select.build(reparsed.value);
    c.record = built.ok
      ? { v: H.share.RECORD_VERSION, s: c.formatSeed, o: sha(Object.assign({}, built.value.options, reparsed.value.options.name ? { name: reparsed.value.options.name } : {})) }
      : { code: built.code };
  } else c.record = { code: reparsed.code };
  return c;
}

const cases = [];
const corpus = FX("engine_corpus_v1.json").corpus;
for (const s of corpus.synthetic) cases.push(caseOf("engine_corpus_v1", s.string, s.reader || "new"));
for (const code of Object.keys(corpus.malformed)) for (const row of Object.values(corpus.malformed[code])) cases.push(caseOf("engine_corpus_v1", row.string, row.reader || "new"));
for (const s of FX("synthetic_scales.json")) cases.push(caseOf("synthetic_scales", s.string, s.reader || "new"));
for (const row of FX("scale_grammar_v1.json").rows) for (const s of row.strings) cases.push(caseOf("scale_grammar_v1", s, "new"));
for (const id of Object.keys(BUILTIN)) cases.push(caseOf("builtin_strings", BUILTIN[id][0], "legacy", BUILTIN[id][1], { id }));
for (const [s] of FX("deck_ids_v1.json").strings) cases.push(caseOf("deck_ids_v1", s, "legacy"));
for (const r of FX("engine_corpus_main_d8d2a2d_ok.json").rows) cases.push(caseOf("engine_corpus_main_d8d2a2d_ok", r.str, "new"));

let seed = 20261023;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const nm = (f) => f[0] + f[1];
const sources = [];
for (const id of Object.keys(BUILTIN)) {
  const p = H.core.parseLegacySeed(BUILTIN[id][0]);
  sources.push({ string: H.core.formatSeed(p.value.fields), options: BUILTIN[id][1] });
}
for (const row of FX("scale_grammar_v1.json").rows) {
  if (!row.accept || !row.accept.canonical) continue;
  const p = H.core.parseSeed(row.accept.canonical);
  if (!p.ok) continue;
  const rim = Object.values(p.value.fields).filter((f) => f[3] === "rim").length;
  const inn = Object.values(p.value.fields).filter((f) => f[3] === "inner").length;
  if (rim >= 2 || inn >= 2) sources.push({ string: H.core.formatSeed(p.value.fields) });
}
let perm = 0;
let guard = 0;
while (perm < 200 && guard++ < 100000) {
  const src = sources[perm % sources.length];
  const p = H.core.parseSeed(src.string);
  const f = p.value.fields;
  const ding = Object.keys(f).filter((k) => f[k][3] === "ding").map((k) => nm(f[k]));
  const ring = (z) => Object.keys(f).filter((k) => f[k][3] === z).map(Number).sort((a, b) => a - b).map((k) => nm(f[k]));
  const rim = ring("rim"), inner = ring("inner"), bottom = ring("bottom");
  const r2 = shuffle(rim), i2 = shuffle(inner);
  const moved = r2.some((n, i) => n !== rim[i]) || i2.some((n, i) => n !== inner[i]);
  if (!moved) continue;
  const line = "(" + ding[0] + ") " + r2.join(" ") + (i2.length ? " | " + i2.join(" ") : "") + (bottom.length ? " " + bottom.map((b) => "[" + b + "]").join(" ") : "");
  const q = H.core.parseSeed(line);
  if (!q.ok) continue;
  const c = caseOf("permutation_seed_20261023", line, "new", undefined, { ascending: src.string });
  c.seatMap = COMBOS.map((o) => {
    const s = H.layout.solve(q.value, o);
    return s.ok ? { rim: labelMap(s.value.fields, "rim"), inner: labelMap(s.value.fields, "inner"), bottom: labelMap(s.value.fields, "bottom") } : null;
  });
  cases.push(c);
  perm++;
}

const out = {
  _what: "The engine's observable output at " + REF + " for the order-follow regression contract (plan clauses 1, 2, 7).",
  _why: "Written ONCE by tools/freeze_order_follow_base.js and never regenerated, like engine_corpus_main_d8d2a2d_ok.json.",
  base: REF,
  shareVersion: H.share.VERSION,
  recordVersion: H.share.RECORD_VERSION,
  combos: COMBOS,
  sources: [...new Set(cases.map((c) => c.source))],
  count: cases.length,
  cases,
};
fs.writeFileSync(path.join(ROOT, "tests", "fixtures", `order_follow_base_${REF}.json`), JSON.stringify(out) + "\n");
console.log("cases", cases.length, "shareVersion", out.shareVersion);
