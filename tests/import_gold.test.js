// Import v2, lane L1: the paste-mode gold replay (docs/plans/2026-10-17-import-v2.md,
// L1 (a) to (d), (g), (h)). Each case is title + the verbatim source span, with
// {parens: "bottom"} on the ids tests/fixtures/import_gold_v1.json names. The
// fixture is written by tools/regen_import_gold.js from docs/plans/import-v2-gold.json.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadEngine } = require("./helpers/engine.js");

const ROOT = path.join(__dirname, "..");
const { core, importer } = loadEngine(["core", "importer"]);
const gold = JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "fixtures", "import_gold_v1.json"), "utf8"));
const byId = (id) => gold.cases.find((c) => c.id === id);
const plain = (x) => JSON.parse(JSON.stringify(x));
const textOf = (c) => (c.title ? c.title + "\n" : "") + c.span;
const read = (c, withParens) => {
  const opts = { title: c.title };
  if (withParens && gold.parensBottom.includes(c.id)) opts.parens = "bottom";
  return plain(importer.interpret(textOf(c), opts));
};
const codes = (r) => r.flags.map((f) => f.code).sort();
const flagOf = (r, code) => r.flags.find((f) => f.code === code);
const outcome = (c, r) => {
  const line = importer.serialise(r);
  if (r.status === "INSUFFICIENT") return c.status === "INSUFFICIENT" ? "correct-insufficient" : "insufficient";
  if (r.status === "NEEDS_INPUT" || !line) return c.status === "NEEDS_INPUT" ? "correct-block" : "blocked";
  if (c.status !== "REVIEW") return "wrong-but-valid";
  const p = core.parseSeed(line);
  if (!p.ok) return "refused";
  return core.formatSeed(p.value.fields) === c.textSeed ? "exact" : "wrong-but-valid";
};

test("gold fixture: 40 cases, 29 REVIEW, and the 8 parens ids all exist", () => {
  assert.equal(gold.version, 1);
  assert.equal(gold.cases.length, 40);
  assert.equal(gold.cases.filter((c) => c.status === "REVIEW").length, 29);
  assert.equal(gold.parensBottom.length, 8);
  for (const id of gold.parensBottom) assert.ok(byId(id), id);
});

test("gold replay (paste mode): at least 23 of the 29 REVIEW cases exact, 0 wrong-but-valid over all 40", () => {
  let exact = 0;
  const wrong = [];
  for (const c of gold.cases) {
    const o = outcome(c, read(c, true));
    if (c.status === "REVIEW" && o === "exact") exact += 1;
    if (o === "wrong-but-valid") wrong.push(c.id);
  }
  assert.deepEqual(wrong, [], "wrong-but-valid");
  assert.ok(exact >= 23, "exact " + exact + " of 29");
});

test("L1 (a): the 11 notation cases come out exact", () => {
  const ids = ["yatao-a2-amara-9", "yatao-fs-low-pygmy-19", "ss-leaf-c-minor-14", "ss-sew-f3-low-pygmy-11",
    "ss-satya-eb-la-sirena-16", "ss-pantheon-halo-equinox-12", "thomann-sela-sehp203-d-kurd-9-3-fr",
    "thomann-sela-sehp203-d-kurd-9-3-it", "mag-blog-d-kurd", "amazon-gladfresit-d-minor-9", "blog-pantheon-halo-xxd"];
  for (const id of ids) {
    const c = byId(id);
    assert.equal(outcome(c, read(c, true)), "exact", id);
  }
});

test("L1 (b): parens bottom lifts the block on the 8 ids, and the same texts without it still block", () => {
  for (const id of gold.parensBottom) {
    const c = byId(id);
    assert.equal(outcome(c, read(c, true)), "exact", id + " with the option");
    if (id === "ss-pantheon-halo-equinox-12") continue;
    const bare = read(c, false);
    assert.equal(bare.status, "NEEDS_INPUT", id + " without the option");
    assert.ok(flagOf(bare, "UNDECLARED_PARENS"), id + " UNDECLARED_PARENS");
    assert.equal(importer.serialise(bare), "", id);
  }
});

test("L1 (b): parens bottom clears UNDECLARED_PARENS and raises PARENS_AS_BOTTOM wherever it changes a reading", () => {
  for (const id of gold.parensBottom) {
    const c = byId(id);
    const r = read(c, true);
    const bare = read(c, false);
    assert.equal(flagOf(r, "UNDECLARED_PARENS"), undefined, id);
    const changed = JSON.stringify(r.roles) !== JSON.stringify(bare.roles);
    if (changed) assert.equal(flagOf(r, "PARENS_AS_BOTTOM").level, "CONFIRM", id);
  }
  assert.ok(flagOf(read(byId("yatao-ayasa-d-kurd-12"), true), "PARENS_AS_BOTTOM"));
});

test("L1 (b): on blog-pantheon-halo-xxd parens bottom deep-equals the reading without it", () => {
  const c = byId("blog-pantheon-halo-xxd");
  assert.deepEqual(importer.interpret(textOf(c), { title: c.title, parens: "bottom" }),
    importer.interpret(textOf(c), { title: c.title }));
});

test("L1 (c): yatao-c-ashakiran-15 gives BOTTOM_NO_OCTAVE (BLOCK) and boullard-battiloro gives CONFLICTING_LIST (BLOCK)", () => {
  const a = read(byId("yatao-c-ashakiran-15"), true);
  assert.equal(a.status, "NEEDS_INPUT");
  assert.equal(flagOf(a, "BOTTOM_NO_OCTAVE").level, "BLOCK");
  assert.equal(importer.serialise(a), "");
  const b = read(byId("boullard-battiloro-celtic-contradictory"), true);
  assert.equal(b.status, "NEEDS_INPUT");
  assert.equal(flagOf(b, "CONFLICTING_LIST").level, "BLOCK");
  assert.equal(importer.serialise(b), "");
  assert.ok(codes(b).includes("CONFLICTING_LIST"));
});
