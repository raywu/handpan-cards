/* Lane B: HPE.layout.solve - the D12 geometry solver.
 *
 * Spec: docs/ENGINE-SPEC.md sections 1 (result contract), 4 (zones are core's;
 * solve never changes one), 11 (FULL geom shape, `ext` for generated decks),
 * 16 (this lane builds its own N=5..19 sweep), 17; CLAUDE.md "Instrument
 * layouts" (the verified pygmy / hijaz / amara angle sequences).
 *
 * Per tests/CONTRACT.md rule 2 nothing here imports a constant from layout.js:
 * the built-in angle sequences and the pan() drawing rules are the spec, and
 * geometry is asserted as PROPERTIES (nothing overlaps, everything fits inside
 * `ext`) rather than as a transcription of the solver's arithmetic.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { loadEngine } = require("./helpers/engine.js");

const HPE = loadEngine(["core", "layout"]);
const DEG = Math.PI / 180;

const FIXTURES = path.join(__dirname, "fixtures");
const SCALES = JSON.parse(fs.readFileSync(path.join(FIXTURES, "synthetic_scales.json"), "utf8"));

const plain = (v) => JSON.parse(JSON.stringify(v));

function fixture(name) {
  const row = SCALES.find((r) => r.name === name);
  assert.ok(row, `fixture row "${name}" is missing`);
  return row;
}

/* The two entries section 16 names as this lane's sweep source. */
const NINETEEN = fixture("nineteen field maximum").string;
const TWELVE = fixture("twelve note pan").string;

function splitSeed(str) {
  const [top, bottom = ""] = str.split("|");
  const tokens = top.trim().split(/\s+/);
  return {
    ding: tokens[0],
    top: tokens.slice(1),
    bottom: bottom.trim() ? bottom.trim().split(/\s+/) : [],
  };
}

/* Truncate a fixture seed to N non-ding fields. Both source rows put the
 * perfect fifth above the ding at the 3rd top token, so every N >= 5 keeps a
 * valid fifth and parses. */
function seedOf(str, nTop, nBottom) {
  const parts = splitSeed(str);
  const top = parts.top.slice(0, nTop);
  const bottom = parts.bottom.slice(0, nBottom);
  let s = `${parts.ding} ${top.join(" ")}`;
  if (bottom.length) s += ` | ${bottom.join(" ")}`;
  const parsed = HPE.core.parseSeed(s);
  assert.equal(parsed.ok, true, `sweep seed did not parse: ${s} (${parsed.code})`);
  return { string: s, seed: parsed.value };
}

/* Three allocations of N over the shelves, so the sweep visits rim-only pans,
 * pans with one and two inner fields, and pans with 1..6 bottom fields. */
function sweep() {
  const out = [];
  for (let n = 5; n <= 19; n += 1) {
    const topHeavy = Math.min(n, 13);
    out.push({ n, label: `top-heavy N=${n}`, ...seedOf(NINETEEN, topHeavy, n - topHeavy) });

    const nBottom = Math.min(6, Math.floor(n / 3));
    const nTop = Math.min(13, n - nBottom);
    out.push({ n, label: `mixed N=${n}`, ...seedOf(NINETEEN, nTop, n - nTop) });

    if (n <= 11) out.push({ n, label: `rim-only N=${n}`, ...seedOf(TWELVE, n, 0) });
  }
  return out;
}

const SWEEP = sweep();

/* ---- the drawing model, read off pan() in index.html -------------------- */

function orbOf(geom, zone) {
  if (zone === "bottom") return geom.bottom;
  if (zone === "inner") return geom.inner;
  return geom.rim;
}

/** Every drawn field circle as {x, y, r, id, zone}, y-up, in R units. */
function circles(geom, fields) {
  const out = [];
  for (const id of Object.keys(fields)) {
    const [, , , zone, angle] = fields[id];
    if (zone === "ding") {
      out.push({ id, zone, x: 0, y: -geom.ding_dy, r: geom.r_ding });
      continue;
    }
    const orb = orbOf(geom, zone);
    const r = zone === "bottom" ? geom.r_bnote : geom.r_note;
    out.push({ id, zone, x: orb * Math.cos(angle * DEG), y: orb * Math.sin(angle * DEG), r });
  }
  return out;
}

/** The radius at which a field's number label is drawn, per pan(). */
function labelRadius(geom, zone) {
  const orb = orbOf(geom, zone);
  const r = zone === "bottom" ? geom.r_bnote : geom.r_note;
  if (zone === "bottom") return orb + r + geom.n_out;
  if (zone === "rim" && geom.rim_num_out) return orb + r + geom.n_in;
  return orb - r - geom.n_in;
}

function solved(entry, options) {
  const res = HPE.layout.solve(entry.seed, options);
  assert.equal(res.ok, true, `${entry.label}: solve rejected ${entry.string}`);
  return res.value;
}

function zoneColumn(fields) {
  const out = {};
  for (const id of Object.keys(fields)) out[id] = fields[id][3];
  return out;
}

function countZone(fields, zone) {
  return Object.keys(fields).filter((id) => fields[id][3] === zone).length;
}

/** Add extra fields in a zone, to exercise solve's own defensive caps. */
function withExtra(fields, zone, ids) {
  const out = plain(fields);
  for (const id of ids) out[id] = ["C", 4, 60, zone, null, String(id)];
  return out;
}

const GEOM_KEYS = [
  "rim", "inner", "bottom", "r_ding", "ding_dy", "r_note", "r_bnote",
  "inner_ring", "f_ding", "f_note", "f_bnote", "f_num", "n_in", "n_out",
  "rim_num_out", "ext",
];

/* ---- section 1: the result contract ------------------------------------ */

test("solve returns the section 1 ok shape with geom and fields", () => {
  const entry = SWEEP[0];
  const res = HPE.layout.solve(entry.seed);
  assert.deepEqual(Object.keys(res).sort(), ["ok", "value"]);
  assert.equal(res.ok, true);
  assert.deepEqual(Object.keys(res.value).sort(), ["fields", "geom"]);
});

test("solve accepts a bare fields map as well as a seed", () => {
  const entry = SWEEP[0];
  const fromSeed = plain(solved(entry));
  const fromMap = HPE.layout.solve(entry.seed.fields);
  assert.equal(fromMap.ok, true);
  assert.deepStrictEqual(plain(fromMap.value), fromSeed);
});

test("solve is deterministic across the whole sweep", () => {
  for (const entry of SWEEP) {
    assert.deepStrictEqual(plain(solved(entry)), plain(solved(entry)), entry.label);
  }
});

test("solve does not mutate its input", () => {
  const entry = SWEEP.find((e) => e.n === 19);
  const before = plain(entry.seed);
  HPE.layout.solve(entry.seed);
  assert.deepStrictEqual(plain(entry.seed), before);
});

/* ---- section 11: the FULL geom shape ----------------------------------- */

test("geom carries every key pan() reads, plus ext, on every sweep pan", () => {
  for (const entry of SWEEP) {
    const { geom } = solved(entry);
    assert.deepEqual(Object.keys(geom).sort(), [...GEOM_KEYS].sort(), entry.label);
  }
});

test("geom values are finite numbers, never null and never missing", () => {
  for (const entry of SWEEP) {
    const { geom } = solved(entry);
    for (const key of GEOM_KEYS) {
      const v = geom[key];
      if (key === "rim_num_out") {
        assert.equal(typeof v, "boolean", `${entry.label}: ${key}`);
        continue;
      }
      assert.equal(typeof v, "number", `${entry.label}: ${key}`);
      assert.ok(Number.isFinite(v), `${entry.label}: ${key} is ${v}`);
      assert.ok(v >= 0, `${entry.label}: ${key} is negative`);
    }
  }
});

test("an empty zone yields zero, not a missing key", () => {
  const rimOnly = SWEEP.find((e) => e.label === "rim-only N=8");
  const { geom, fields } = solved(rimOnly);
  assert.equal(countZone(fields, "inner"), 0);
  assert.equal(countZone(fields, "bottom"), 0);
  assert.equal(geom.inner, 0);
  assert.equal(geom.bottom, 0);
  assert.equal(geom.r_bnote, 0);
  assert.equal(geom.f_bnote, 0);
  assert.equal(geom.n_out, 0);
});

test("a pan with bottom fields gets a bottom ring outside the shell", () => {
  const withBottom = SWEEP.find((e) => e.n === 19);
  const { geom, fields } = solved(withBottom);
  assert.equal(countZone(fields, "bottom"), 6);
  assert.ok(geom.bottom > 1, "the x-ray ring is drawn outside R");
  assert.ok(geom.r_bnote > 0);
  assert.ok(geom.f_bnote > 0);
  assert.ok(geom.n_out > 0);
});

test("the ding keeps the D12 offset geometry on every generated pan", () => {
  for (const entry of SWEEP) {
    const { geom } = solved(entry);
    assert.ok(geom.r_ding > 0, entry.label);
    assert.ok(geom.ding_dy > 0, `${entry.label}: the ding sits toward the player`);
    assert.ok(geom.ding_dy + geom.r_ding < 1, entry.label);
  }
});

/* ---- section 4: zones are core's, angles are ours ---------------------- */

test("solve never changes a zone", () => {
  for (const entry of SWEEP) {
    const before = zoneColumn(entry.seed.fields);
    const { fields } = solved(entry);
    assert.deepStrictEqual(plain(zoneColumn(fields)), plain(before), entry.label);
  }
});

test("solve preserves the field ids and every non-angle column", () => {
  for (const entry of SWEEP) {
    const { fields } = solved(entry);
    assert.deepEqual(Object.keys(fields).sort(), Object.keys(entry.seed.fields).sort(), entry.label);
    for (const id of Object.keys(fields)) {
      const before = entry.seed.fields[id];
      const after = fields[id];
      assert.equal(after.length, 6);
      assert.deepStrictEqual(
        [after[0], after[1], after[2], after[3], after[5]],
        [before[0], before[1], before[2], before[3], before[5]], `${entry.label} #${id}`);
    }
  }
});

test("the ding angle stays null and every other angle is filled", () => {
  for (const entry of SWEEP) {
    const { fields } = solved(entry);
    for (const id of Object.keys(fields)) {
      const [, , , zone, angle] = fields[id];
      if (zone === "ding") {
        assert.equal(angle, null, `${entry.label} #${id}`);
        continue;
      }
      assert.equal(typeof angle, "number", `${entry.label} #${id}`);
      assert.ok(Number.isFinite(angle) && angle >= 0 && angle < 360, `${entry.label} #${id}: ${angle}`);
      assert.equal(Math.round(angle * 10), angle * 10, `${entry.label} #${id}: not one decimal`);
    }
  }
});

/* ---- the verified built-in sequences (CLAUDE.md "Instrument layouts") --- */

test("nine rim fields reproduce the verified pygmy zig-zag", () => {
  const nine = seedOf(NINETEEN, 9, 0);
  const { fields } = solved({ ...nine, label: "pygmy rim" });
  const angles = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => fields[String(i)][4]);
  assert.deepEqual(angles, [290, 250, 330, 210, 10, 170, 50, 130, 90]);
});

test("mirror turns the nine-field zig-zag into the left-first pattern", () => {
  const nine = seedOf(NINETEEN, 9, 0);
  const { fields } = solved({ ...nine, label: "pygmy rim" }, { mirror: true });
  const angles = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => fields[String(i)][4]);
  assert.deepEqual(angles, [250, 290, 210, 330, 170, 10, 130, 50, 90]);
});

test("eight rim fields mirrored reproduce the verified hijaz / amara zig-zag", () => {
  const eight = seedOf(NINETEEN, 8, 0);
  const { fields } = solved({ ...eight, label: "hijaz rim" }, { mirror: true });
  const angles = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => fields[String(i)][4]);
  assert.deepEqual(angles, [270, 225, 315, 180, 0, 135, 45, 90]);
});

test("six bottom fields reproduce the verified pygmy x-ray ring", () => {
  const full = seedOf(NINETEEN, 13, 6);
  const { fields } = solved({ ...full, label: "pygmy bottom" });
  const angles = [101, 102, 103, 104, 105, 106].map((i) => fields[String(i)][4]);
  assert.deepEqual(angles, [300, 240, 0, 180, 60, 120]);
});

test("the rim ends at top centre and is evenly spread", () => {
  for (const entry of SWEEP) {
    const { fields } = solved(entry);
    const rim = Object.keys(fields)
      .filter((id) => fields[id][3] === "rim")
      .sort((a, b) => Number(a) - Number(b))
      .map((id) => fields[id][4]);
    assert.equal(rim[rim.length - 1], 90, `${entry.label}: highest rim note at top centre`);
    const step = 360 / rim.length;
    const sorted = [...rim].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      assert.ok(Math.abs(sorted[i] - sorted[i - 1] - step) < 0.25,
        `${entry.label}: rim spacing ${sorted[i - 1]} -> ${sorted[i]}, step ${step}`);
    }
  }
});

/* An even rim count puts the lowest note exactly at bottom centre (hijaz's
 * field 1 at 270), so the side the zig-zag starts on is read off the first rim
 * field that is not on the vertical axis. */
function firstSideX(fields) {
  const rim = Object.keys(fields)
    .filter((id) => fields[id][3] === "rim")
    .sort((a, b) => Number(a) - Number(b));
  for (const id of rim) {
    const x = Math.cos(fields[id][4] * DEG);
    if (Math.abs(x) > 1e-9) return x;
  }
  return 0;
}

test("the default is right-first and mirror is left-first", () => {
  for (const entry of SWEEP) {
    assert.ok(firstSideX(solved(entry).fields) > 0, `${entry.label}: default is right-first`);
    const mirrored = HPE.layout.solve(entry.seed, { mirror: true }).value;
    assert.ok(firstSideX(mirrored.fields) < 0, `${entry.label}: mirror is left-first`);
  }
});

test("mirror reflects every angle about the vertical axis", () => {
  for (const entry of SWEEP) {
    const straight = solved(entry).fields;
    const mirrored = HPE.layout.solve(entry.seed, { mirror: true }).value.fields;
    for (const id of Object.keys(straight)) {
      const a = straight[id][4];
      const b = mirrored[id][4];
      if (a === null) {
        assert.equal(b, null, `${entry.label} #${id}`);
        continue;
      }
      assert.ok(Math.abs(Math.cos(b * DEG) + Math.cos(a * DEG)) < 1e-9, `${entry.label} #${id}: x`);
      assert.ok(Math.abs(Math.sin(b * DEG) - Math.sin(a * DEG)) < 1e-9, `${entry.label} #${id}: y`);
    }
  }
});

test("mirror changes only the angles, never the geometry", () => {
  for (const entry of SWEEP) {
    const a = solved(entry).geom;
    const b = HPE.layout.solve(entry.seed, { mirror: true }).value.geom;
    assert.deepStrictEqual(plain(b), plain(a), entry.label);
  }
});

test("the seed's own options.mirror is honoured, and an explicit option wins", () => {
  const entry = SWEEP.find((e) => e.n === 19);
  const seed = plain(entry.seed);
  seed.options.mirror = true;
  const fromSeed = HPE.layout.solve(seed).value.fields;
  const explicit = HPE.layout.solve(entry.seed, { mirror: true }).value.fields;
  assert.deepStrictEqual(plain(fromSeed), plain(explicit));
  const overridden = HPE.layout.solve(seed, { mirror: false }).value.fields;
  assert.deepStrictEqual(plain(overridden), plain(solved(entry).fields));
});

test("the inner pair ascends opposite the rim direction", () => {
  for (const entry of SWEEP) {
    const { fields } = solved(entry);
    const inner = Object.keys(fields)
      .filter((id) => fields[id][3] === "inner")
      .sort((a, b) => Number(a) - Number(b));
    if (!inner.length) continue;
    const lowestRimX = Math.cos(fields["1"][4] * DEG);
    const lowestInnerX = Math.cos(fields[inner[0]][4] * DEG);
    assert.ok(lowestRimX * lowestInnerX < 0,
      `${entry.label}: rim starts x=${lowestRimX.toFixed(2)}, inner starts x=${lowestInnerX.toFixed(2)}`);
    if (inner.length === 2) {
      const secondX = Math.cos(fields[inner[1]][4] * DEG);
      assert.ok(lowestInnerX * secondX < 0, `${entry.label}: inner pair on opposite sides`);
      assert.ok(Math.sin(fields[inner[0]][4] * DEG) > 0, `${entry.label}: inner pair above centre`);
      assert.ok(Math.sin(fields[inner[1]][4] * DEG) > 0, `${entry.label}: inner pair above centre`);
    }
  }
});

test("the inner pair ascends opposite the rim under mirror too", () => {
  for (const entry of SWEEP) {
    const { fields } = HPE.layout.solve(entry.seed, { mirror: true }).value;
    const inner = Object.keys(fields)
      .filter((id) => fields[id][3] === "inner")
      .sort((a, b) => Number(a) - Number(b));
    if (!inner.length) continue;
    assert.ok(Math.cos(fields["1"][4] * DEG) * Math.cos(fields[inner[0]][4] * DEG) < 0, entry.label);
  }
});

/* ---- D7: nothing overlaps, at any N ------------------------------------ */

test("no two field circles overlap, anywhere in the N=5..19 sweep", () => {
  for (const entry of SWEEP) {
    const { geom, fields } = solved(entry);
    const cs = circles(geom, fields);
    for (let i = 0; i < cs.length; i += 1) {
      for (let j = i + 1; j < cs.length; j += 1) {
        const d = Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y);
        assert.ok(d >= cs[i].r + cs[j].r,
          `${entry.label}: #${cs[i].id} and #${cs[j].id} overlap (${d.toFixed(4)} < ` +
          `${(cs[i].r + cs[j].r).toFixed(4)})`);
      }
    }
  }
});

test("no two field circles overlap under mirror either", () => {
  for (const entry of SWEEP) {
    const { geom, fields } = HPE.layout.solve(entry.seed, { mirror: true }).value;
    const cs = circles(geom, fields);
    for (let i = 0; i < cs.length; i += 1) {
      for (let j = i + 1; j < cs.length; j += 1) {
        const d = Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y);
        assert.ok(d >= cs[i].r + cs[j].r, `${entry.label}: #${cs[i].id} / #${cs[j].id}`);
      }
    }
  }
});

test("field circles stay legible: they are never shrunk away to clear a clash", () => {
  for (const entry of SWEEP) {
    const { geom } = solved(entry);
    assert.ok(geom.r_note >= 0.09, `${entry.label}: r_note ${geom.r_note}`);
    assert.ok(geom.f_note >= 0.06, `${entry.label}: f_note ${geom.f_note}`);
    assert.ok(geom.f_num >= 0.05, `${entry.label}: f_num ${geom.f_num}`);
    if (geom.bottom) {
      assert.ok(geom.r_bnote >= 0.07, `${entry.label}: r_bnote ${geom.r_bnote}`);
      assert.ok(geom.f_bnote >= 0.05, `${entry.label}: f_bnote ${geom.f_bnote}`);
    }
  }
});

test("eleven rim fields still fit without overlapping - the D7 ceiling", () => {
  const eleven = { ...seedOf(TWELVE, 11, 0), label: "eleven rim" };
  const { geom, fields } = solved(eleven);
  assert.equal(countZone(fields, "rim"), 11);
  const cs = circles(geom, fields).filter((c) => c.zone === "rim");
  const chord = 2 * geom.rim * Math.sin(Math.PI / 11);
  assert.ok(2 * geom.r_note < chord, `r_note ${geom.r_note} too big for 11 rim fields`);
  for (let i = 0; i < cs.length; i += 1) {
    for (let j = i + 1; j < cs.length; j += 1) {
      assert.ok(Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y) >= 2 * geom.r_note);
    }
  }
});

test("rim fields stay inside the shell circle", () => {
  for (const entry of SWEEP) {
    const { geom, fields } = solved(entry);
    assert.ok(geom.rim + geom.r_note <= 1, `${entry.label}: rim spills past R`);
    if (countZone(fields, "inner")) {
      assert.ok(geom.inner + geom.r_note < geom.rim - geom.r_note,
        `${entry.label}: the inner ring collides with the rim ring`);
    }
  }
});

/* ---- ext: the furthest drawn element ----------------------------------- */

test("every field circle and its number label sits inside ext", () => {
  for (const entry of SWEEP) {
    const { geom, fields } = solved(entry);
    for (const c of circles(geom, fields)) {
      assert.ok(Math.hypot(c.x, c.y) + c.r <= geom.ext,
        `${entry.label}: #${c.id} circle reaches past ext ${geom.ext}`);
    }
    for (const id of Object.keys(fields)) {
      const zone = fields[id][3];
      if (zone === "ding") continue;
      const nr = labelRadius(geom, zone);
      const fs = zone === "bottom" ? geom.f_num : geom.f_num;
      assert.ok(nr >= 0, `${entry.label}: #${id} number label folded through the centre`);
      assert.ok(nr + fs <= geom.ext,
        `${entry.label}: #${id} number label reaches past ext ${geom.ext}`);
    }
  }
});

test("ext also clears the shell circle and the bottom ring itself", () => {
  for (const entry of SWEEP) {
    const { geom } = solved(entry);
    assert.ok(geom.ext > 1, `${entry.label}: ext must clear the R=1 shell circle`);
    if (geom.bottom) assert.ok(geom.ext > geom.bottom + geom.r_bnote, entry.label);
    assert.ok(geom.ext < 3, `${entry.label}: ext ${geom.ext} is implausibly large`);
  }
});

test("ext grows when a bottom shell is added", () => {
  const noBottom = SWEEP.find((e) => e.label === "top-heavy N=13");
  const withBottom = SWEEP.find((e) => e.label === "top-heavy N=19");
  assert.ok(solved(withBottom).geom.ext > solved(noBottom).geom.ext);
});

/* ---- section 4 / 17: the caps ------------------------------------------ */

test("a twelfth rim field is rejected TOO_MANY_RIM", () => {
  const eleven = seedOf(TWELVE, 11, 0);
  const res = HPE.layout.solve(withExtra(eleven.seed.fields, "rim", ["12"]));
  assert.equal(res.ok, false);
  assert.equal(res.code, "TOO_MANY_RIM");
  assert.equal(res.reason, HPE.core.REASONS.TOO_MANY_RIM.reason);
  assert.equal("value" in res, false);
});

test("a third inner field is rejected TOO_MANY_RIM", () => {
  const full = seedOf(NINETEEN, 13, 0);
  const res = HPE.layout.solve(withExtra(full.seed.fields, "inner", ["14"]));
  assert.equal(res.ok, false);
  assert.equal(res.code, "TOO_MANY_RIM");
  assert.equal(res.reason, HPE.core.REASONS.TOO_MANY_RIM.reason);
});

test("a seventh bottom field is rejected TOO_MANY_RIM", () => {
  const full = seedOf(NINETEEN, 13, 6);
  const res = HPE.layout.solve(withExtra(full.seed.fields, "bottom", ["107"]));
  assert.equal(res.ok, false);
  assert.equal(res.code, "TOO_MANY_RIM");
  assert.equal(res.reason, HPE.core.REASONS.TOO_MANY_RIM.reason);
});

test("the 19-field maximum pan is accepted", () => {
  const full = { ...seedOf(NINETEEN, 13, 6), label: "maximum" };
  const { fields } = solved(full);
  assert.equal(countZone(fields, "ding"), 1);
  assert.equal(countZone(fields, "rim"), 11);
  assert.equal(countZone(fields, "inner"), 2);
  assert.equal(countZone(fields, "bottom"), 6);
  assert.equal(Object.keys(fields).length, 20);
});

/* ---- Phase 5 / D5: options.order, the layout correction ----------------
 *
 * The pinned encoding (integrator decisions D5-1..D5-5): ONE seed option,
 * `order`, a permutation of [0 .. n-1] over the NON-DING fields in the order
 * the solver collects them (rim, then inner, then bottom, each ascending by
 * id). order[i] is the solved SLOT that field i takes. Absent or null is the
 * generated default, so nothing that never opened the layout editor moves.
 * Anything that is not a permutation of exactly that length is rejected
 * through the section 1 result contract with the section 2 code BAD_NOTE -
 * the enum is CLOSED, so there is no code of its own for a bad correction. */

/** The non-ding field ids in the order the solver assigns slots. */
function slotFieldIds(fields) {
  const of = (zone) => Object.keys(fields)
    .filter((id) => fields[id][3] === zone)
    .sort((a, b) => Number(a) - Number(b));
  return [...of("rim"), ...of("inner"), ...of("bottom")];
}

function identity(n) {
  return Array.from({ length: n }, (_, i) => i);
}

/** A permutation that is not the identity for any n >= 2: reverse it. */
function reversed(n) {
  return identity(n).reverse();
}

/** A single cyclic shift - what the ROTATE control writes (D5-1). */
function rotated(n, by) {
  return identity(n).map((i) => (i + by + n) % n);
}

function anglesById(fields) {
  const out = {};
  for (const id of Object.keys(fields)) out[id] = fields[id][4];
  return out;
}

test("an absent order solves exactly as it did before order existed", () => {
  for (const entry of SWEEP) {
    const base = plain(solved(entry));
    assert.deepStrictEqual(plain(solved(entry, {})), base, entry.label);
    assert.deepStrictEqual(plain(solved(entry, { order: null })), base, entry.label);
    assert.deepStrictEqual(plain(solved(entry, { order: undefined })), base, entry.label);
  }
});

test("the identity permutation is exactly an absent order", () => {
  for (const entry of SWEEP) {
    const base = plain(solved(entry));
    const n = slotFieldIds(base.fields).length;
    assert.equal(n, entry.n, `${entry.label}: n is the non-ding field count`);
    assert.deepStrictEqual(plain(solved(entry, { order: identity(n) })), base, entry.label);
  }
});

test("order says which field takes which solved slot", () => {
  for (const entry of SWEEP) {
    const base = plain(solved(entry));
    const ids = slotFieldIds(base.fields);
    const slots = ids.map((id) => base.fields[id][4]);
    for (const order of [reversed(ids.length), rotated(ids.length, 1),
                         rotated(ids.length, -2)]) {
      const moved = plain(solved(entry, { order })).fields;
      ids.forEach((id, i) => {
        assert.equal(moved[id][4], slots[order[i]],
          `${entry.label} #${id}: field ${i} did not take slot ${order[i]}`);
      });
    }
  }
});

test("order reassigns the solved angles and never invents one", () => {
  for (const entry of SWEEP) {
    const base = plain(solved(entry));
    const ids = slotFieldIds(base.fields);
    const before = ids.map((id) => base.fields[id][4]).sort();
    const moved = plain(solved(entry, { order: reversed(ids.length) })).fields;
    const after = ids.map((id) => moved[id][4]).sort();
    assert.deepStrictEqual(after, before, `${entry.label}: the angle set changed`);
  }
});

test("a non-trivial order actually moves at least one field", () => {
  for (const entry of SWEEP) {
    if (entry.n < 2) continue;
    const base = plain(solved(entry)).fields;
    const moved = plain(solved(entry, { order: reversed(entry.n) })).fields;
    assert.notDeepStrictEqual(anglesById(moved), anglesById(base), entry.label);
  }
});

test("order changes only the angles, never the geometry", () => {
  for (const entry of SWEEP) {
    const base = plain(solved(entry)).geom;
    const moved = plain(solved(entry, { order: reversed(entry.n) })).geom;
    assert.deepStrictEqual(moved, base, entry.label);
  }
});

test("the ding is never part of the correction and keeps its null angle", () => {
  for (const entry of SWEEP) {
    const { fields } = solved(entry, { order: reversed(entry.n) });
    const dings = Object.keys(fields).filter((id) => fields[id][3] === "ding");
    assert.equal(dings.length, 1, entry.label);
    assert.equal(fields[dings[0]][4], null, entry.label);
  }
});

test("order never changes a zone", () => {
  for (const entry of SWEEP) {
    const before = zoneColumn(plain(solved(entry)).fields);
    const after = zoneColumn(plain(solved(entry, { order: reversed(entry.n) })).fields);
    assert.deepStrictEqual(after, before, entry.label);
  }
});

test("order and mirror compose: a flip reflects the corrected layout", () => {
  for (const entry of SWEEP) {
    const order = rotated(entry.n, 1);
    const straight = solved(entry, { order }).fields;
    const flipped = solved(entry, { order, mirror: true }).fields;
    for (const id of Object.keys(straight)) {
      const a = straight[id][4];
      const b = flipped[id][4];
      if (a === null) { assert.equal(b, null, `${entry.label} #${id}`); continue; }
      assert.ok(Math.abs(Math.cos(b * DEG) + Math.cos(a * DEG)) < 1e-9,
        `${entry.label} #${id}: mirror scrambled the correction (x)`);
      assert.ok(Math.abs(Math.sin(b * DEG) - Math.sin(a * DEG)) < 1e-9,
        `${entry.label} #${id}: mirror scrambled the correction (y)`);
    }
  }
});

test("the seed's own options.order is honoured, and an explicit option wins", () => {
  const entry = SWEEP.find((e) => e.n === 19);
  const order = reversed(entry.n);
  const seed = plain(entry.seed);
  seed.options.order = order;
  const fromSeed = HPE.layout.solve(seed).value.fields;
  const explicit = HPE.layout.solve(entry.seed, { order }).value.fields;
  assert.deepStrictEqual(plain(fromSeed), plain(explicit));
  const overridden = HPE.layout.solve(seed, { order: null }).value.fields;
  assert.deepStrictEqual(plain(overridden), plain(solved(entry).fields));
});

test("solve does not mutate an order it was handed", () => {
  const entry = SWEEP.find((e) => e.n === 19);
  const order = reversed(entry.n);
  const before = order.slice();
  HPE.layout.solve(entry.seed, { order });
  assert.deepStrictEqual(order, before);
});

test("an order that is not a permutation is rejected BAD_NOTE, never thrown", () => {
  const entry = SWEEP.find((e) => e.n === 19);
  const n = entry.n;
  const bad = [
    identity(n).slice(0, n - 1),          // too short
    identity(n).concat([n]),              // too long
    identity(n - 1).concat([0]),          // a repeated index
    identity(n - 1).concat([n]),          // out of range, high
    identity(n - 1).concat([-1]),         // out of range, low
    identity(n - 1).concat([0.5]),        // not an integer
    identity(n - 1).concat(["0"]),        // not a number
    identity(n - 1).concat([NaN]),        // not finite
    "0,1,2",                              // not an array
    {},
    17,
    true,
  ];
  for (const order of bad) {
    let res;
    assert.doesNotThrow(() => { res = HPE.layout.solve(entry.seed, { order }); },
      `solve threw on ${JSON.stringify(order)}`);
    assert.equal(res.ok, false, `accepted ${JSON.stringify(order)}`);
    assert.equal(res.code, "BAD_NOTE", `wrong code for ${JSON.stringify(order)}`);
    assert.equal(typeof res.reason, "string");
    assert.ok(res.reason.length > 0);
    assert.equal("value" in res, false, "an err result carries no value");
  }
});

test("a rejected order names the value in the section 2 BAD_NOTE reason", () => {
  const entry = SWEEP.find((e) => e.n === 19);
  const res = HPE.layout.solve(entry.seed, { order: [0, 0] });
  assert.equal(res.ok, false);
  assert.equal(res.reason,
    HPE.core.REASONS.BAD_NOTE.reason.split("<X>").join(String([0, 0]).slice(0, 12)));
});

test("a bad order is rejected on a bare fields map too", () => {
  const entry = SWEEP.find((e) => e.n === 19);
  const res = HPE.layout.solve(entry.seed.fields, { order: [1, 2, 3] });
  assert.equal(res.ok, false);
  assert.equal(res.code, "BAD_NOTE");
});

test("an over-cap pan is still TOO_MANY_RIM, order or no order", () => {
  const eleven = seedOf(TWELVE, 11, 0);
  const over = withExtra(eleven.seed.fields, "rim", ["12"]);
  for (const options of [undefined, { order: identity(12) }, { order: "junk" }]) {
    const res = HPE.layout.solve(over, options);
    assert.equal(res.ok, false);
    assert.equal(res.code, "TOO_MANY_RIM");
  }
});
