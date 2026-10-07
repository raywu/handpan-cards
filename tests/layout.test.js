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
const { boot } = require("./helpers/sandbox.js");

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

test("the ding keeps the D12 offset geometry on every pan with inner notes and is centred on every other", () => {
  for (const entry of SWEEP) {
    const { geom, fields } = solved(entry);
    assert.ok(geom.ding_dy + geom.r_ding < 1, entry.label);
    if (countZone(fields, "inner") > 0) {
      assert.equal(geom.ding_dy, 0.1425, `${entry.label}: the ding sits toward the player`);
      assert.equal(geom.r_ding, 0.19, entry.label);
      assert.equal(geom.f_ding, 0.114, entry.label);
    } else {
      assert.equal(geom.ding_dy, 0, `${entry.label}: the ding is centred`);
      assert.equal(geom.r_ding, 0.2, entry.label);
      assert.equal(geom.f_ding, 0.12, entry.label);
    }
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

const PYGMY_RIM_SEED = "(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 / F5 G5";

function pygmyRim(options) {
  const parsed = HPE.core.parseSeed(PYGMY_RIM_SEED);
  assert.equal(parsed.ok, true);
  return solved({ seed: parsed.value, string: PYGMY_RIM_SEED, label: "pygmy rim" }, options);
}

test("nine rim fields with an inner pair reproduce the verified pygmy zig-zag", () => {
  const { fields } = pygmyRim();
  const angles = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => fields[String(i)][4]);
  assert.deepEqual(angles, [290, 250, 330, 210, 10, 170, 50, 130, 90]);
});

test("mirror turns the pygmy nine-field zig-zag into the left-first pattern", () => {
  const { fields } = pygmyRim({ mirror: true });
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

test("the rim is evenly spread and anchored at bottom centre (odd, centred) or top centre", () => {
  for (const entry of SWEEP) {
    const { fields } = solved(entry);
    const rim = Object.keys(fields)
      .filter((id) => fields[id][3] === "rim")
      .sort((a, b) => Number(a) - Number(b))
      .map((id) => fields[id][4]);
    if (countZone(fields, "inner") === 0 && rim.length % 2 === 1) {
      assert.equal(rim[0], 270, `${entry.label}: lowest rim note at bottom centre`);
      assert.ok(!rim.includes(90), `${entry.label}: nothing at top centre`);
    } else {
      assert.equal(rim[rim.length - 1], 90, `${entry.label}: highest rim note at top centre`);
    }
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

test("the default is right-first and mirror is left-first, except on an odd centred rim", () => {
  for (const entry of SWEEP) {
    const { fields } = solved(entry);
    const flipped = countZone(fields, "inner") === 0 && countZone(fields, "rim") % 2 === 1;
    const mirrored = HPE.layout.solve(entry.seed, { mirror: true }).value;
    const [def, mir] = flipped ? [-1, 1] : [1, -1];
    assert.equal(Math.sign(firstSideX(fields)), def, `${entry.label}: default hand`);
    assert.equal(Math.sign(firstSideX(mirrored.fields)), mir, `${entry.label}: mirror hand`);
  }
});

function rimOnly(count, options) {
  const entry = { ...seedOf(TWELVE, count, 0), label: `rim-only N=${count}` };
  const { fields, geom } = solved(entry, options);
  const angles = Array.from({ length: count }, (_, i) => fields[String(i + 1)][4]);
  return { angles, geom };
}

test("a pan with no inner notes draws a centred ding, and any inner note moves it off centre", () => {
  const dings = (str, options) => {
    const parsed = HPE.core.parseSeed(str);
    assert.equal(parsed.ok, true, str);
    const { geom } = HPE.layout.solve(parsed.value, options).value;
    return [geom.ding_dy, geom.r_ding];
  };
  for (let n = 5; n <= 11; n += 1) {
    assert.deepEqual([rimOnly(n).geom.ding_dy, rimOnly(n).geom.r_ding], [0, 0.2], `${n} rim notes`);
  }
  assert.deepEqual(dings(PYGMY_RIM_SEED), [0.1425, 0.19]);
  const top12 = seedOf(NINETEEN, 12, 0).string;
  const top13 = seedOf(NINETEEN, 13, 0).string;
  assert.deepEqual(dings(top12), [0.1425, 0.19], "12 top notes, no slash: 11 rim + 1 inner");
  assert.deepEqual(dings(top13), [0.1425, 0.19], "13 top notes, no slash");
  assert.deepEqual(dings("(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5 | Bb2 C3"), [0, 0.2], "bottom notes do not force the offset");
});

const ODD_FROM_BOTTOM = {
  5: { plain: [270, 198, 342, 126, 54], mirror: [270, 342, 198, 54, 126] },
  7: { plain: [270, 218.6, 321.4, 167.1, 12.9, 115.7, 64.3], mirror: [270, 321.4, 218.6, 12.9, 167.1, 64.3, 115.7] },
  9: { plain: [270, 230, 310, 190, 350, 150, 30, 110, 70], mirror: [270, 310, 230, 350, 190, 30, 150, 70, 110] },
  11: { plain: [270, 237.3, 302.7, 204.5, 335.5, 171.8, 8.2, 139.1, 40.9, 106.4, 73.6], mirror: [270, 302.7, 237.3, 335.5, 204.5, 8.2, 171.8, 40.9, 139.1, 73.6, 106.4] },
};

/* The angles main drew for an odd rim: highest at 90, right-first. */
function legacyOdd(count) {
  const step = 360 / count;
  return Array.from({ length: count }, (_, i) => {
    const back = count - 1 - i;
    const sign = back % 2 === 1 ? 1 : -1;
    return (((90 + sign * Math.ceil(back / 2) * step) % 360) + 360) % 360;
  });
}

test("an odd centred rim starts at bottom centre and keeps each note on its side", () => {
  for (const count of [5, 7, 9, 11]) {
    for (const hand of ["plain", "mirror"]) {
      const options = hand === "mirror" ? { mirror: true } : undefined;
      const { angles } = rimOnly(count, options);
      assert.deepEqual(angles, ODD_FROM_BOTTOM[count][hand], `${count} rim notes, ${hand}`);
      const before = legacyOdd(count).map((a) => (hand === "mirror" ? (((180 - a) % 360) + 360) % 360 : a));
      for (let i = 1; i < count - 1; i += 1) {
        assert.equal(Math.sign(Math.cos(angles[i] * DEG)), Math.sign(Math.cos(before[i] * DEG)),
          `${count} rim notes, ${hand}: note ${i + 1} keeps its side`);
      }
    }
  }
});

test("a stored order and mirror draw the same sides on an odd rim", () => {
  const nine = { ...seedOf(TWELVE, 9, 0), label: "nine rim" };
  const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(String);
  const anglesOf = (options) => {
    const { fields } = solved(nine, options);
    return ids.map((id) => fields[id][4]);
  };
  assert.deepEqual(anglesOf({ order: rotated(9, 1) }), rotated(9, 1).map((slot) => ODD_FROM_BOTTOM[9].plain[slot]));
  assert.deepEqual(anglesOf({ order: reversed(9) }), ODD_FROM_BOTTOM[9].plain.slice().reverse());
  assert.deepEqual(anglesOf({ mirror: true }), ODD_FROM_BOTTOM[9].mirror);
  assert.deepEqual(anglesOf({ mirror: true, order: reversed(9) }), ODD_FROM_BOTTOM[9].mirror.slice().reverse());
});

test("even rim counts are untouched by the centred default", () => {
  const EVEN = {
    6: { plain: [270, 330, 210, 30, 150, 90], mirror: [270, 210, 330, 150, 30, 90] },
    8: { plain: [270, 315, 225, 0, 180, 45, 135, 90], mirror: [270, 225, 315, 180, 0, 135, 45, 90] },
    10: { plain: [270, 306, 234, 342, 198, 18, 162, 54, 126, 90], mirror: [270, 234, 306, 198, 342, 162, 18, 126, 54, 90] },
  };
  for (const count of [6, 8, 10]) {
    assert.deepEqual(rimOnly(count).angles, EVEN[count].plain, `${count} plain`);
    assert.deepEqual(rimOnly(count, { mirror: true }).angles, EVEN[count].mirror, `${count} mirror`);
  }
});

test("the centred default reproduces the shipped Amara 9 and Hijaz layouts", () => {
  const decks = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "decks.json"), "utf8"));
  const makers = {
    amara: "(D3) A3 C4 D4 E4 F4 G4 A4 C5",
    hijaz: "(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4",
  };
  for (const id of Object.keys(makers)) {
    const shipped = decks.find((d) => d.id === id);
    const parsed = HPE.core.parseSeed(makers[id]);
    const { geom, fields } = HPE.layout.solve(parsed.value, { mirror: true }).value;
    for (const key of ["rim", "r_ding", "r_note", "n_in", "inner_ring"]) {
      assert.equal(geom[key], shipped.geom[key], `${id} ${key}`);
    }
    for (const fid of Object.keys(shipped.fields)) {
      if (shipped.fields[fid][3] === "ding") continue;
      assert.equal(fields[fid][4], shipped.fields[fid][4], `${id} field ${fid}`);
    }
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
    if (inner.length < 2) continue;      /* one inner note sits at top centre (A13) */
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
    if (inner.length < 2) continue;
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

/* ---- the label a field actually gets, measured against the field ---------
 *
 * The geom's f_note / f_bnote / f_num are outputs of the diagram label rule
 * (CLAUDE.md, "Design system"), not figures any renderer reads, so a guard on
 * them alone guards nothing about the drawn size.
 *
 * The guard that stood here re-declared the rule's ratios as literals and
 * then compared them against themselves - `0.80325 * r < r` is true for every
 * r and every ratio under 1, so the assertion held no matter what the shipped
 * constant said. Raising LABEL_RATIO_NOTE to 1.60650 in both renderers, which
 * draws every rim name at 1.6x the radius of the circle it sits in, left the
 * file at 51/51 green.
 *
 * So: no ratio is restated here. `labelSize()` and `numSize()` are read out
 * of the booted app - the very functions pan() calls - and what they return
 * is measured against two things the app does not get to choose: the metrics
 * of the face the label is set in, and the radius the solver handed back.
 * Rule 2 of tests/CONTRACT.md is satisfied because nothing is compared to
 * itself; the bound comes from the font and the circle, not from the rule.
 */

/* Nunito Sans advance widths, in em, measured off the shipped face
 * (tools/fonts/NunitoSans-Regular.ttf, unitsPerEm 1000) - the face the print
 * pipeline embeds and the app names first in its font stack. These are the
 * only glyphs a note name or an octave can be built from. */
const ADVANCE = {
  A: 0.729, B: 0.676, C: 0.673, D: 0.742, E: 0.583, F: 0.548, G: 0.726,
  "#": 0.6, b: 0.583,
  0: 0.6, 1: 0.6, 2: 0.6, 3: 0.6, 4: 0.6, 5: 0.6, 6: 0.6, 7: 0.6, 8: 0.6, 9: 0.6,
};
/* hhea ascent / descent of the same face. Deliberately the face's full
 * declared extent rather than a cap-height estimate: it over-states the ink
 * box, so a pass here is a pass for any glyph the face can set. */
const ASCENT = 1.011, DESCENT = 0.353;

function advance(str) {
  let w = 0;
  for (const ch of String(str)) {
    assert.ok(ch in ADVANCE, `no measured advance for glyph "${ch}"`);
    w += ADVANCE[ch];
  }
  return w;
}

/* The three shape numbers pan()'s label() uses - the baseline drop, the
 * octave tspan's relative size, and its dy - READ OFF A REAL RENDER rather
 * than restated here. label() is an inner function of pan(), so the test
 * calls pan() through the booted app and solves for the ratios from the
 * <text> it emits: a change to any of them moves this measurement instead of
 * leaving a stale literal behind.
 *
 * The ding of a deck with no `ding_dy` is drawn at cy = 0 exactly (pan()
 * passes `(g.ding_dy || 0) * R`), which is what makes the baseline ratio
 * recoverable from the emitted `y` alone. The deck used is asserted to have
 * no ding_dy, so the derivation cannot silently start measuring an offset. */
function labelShape() {
  const app = boot();
  const geom = app.get(`JSON.stringify(DECKS.find(d => d.id === "hijaz").geom)`);
  assert.equal(JSON.parse(geom).ding_dy, undefined,
    "Hijaz grew a ding_dy - its ding is no longer drawn at cy 0 and the "
    + "baseline ratio can no longer be read off the emitted y");
  const svg = app.get(`(() => { const d = DECKS.find(d => d.id === "hijaz"); return pan(d, d.chords[0]); })()`);
  const m = svg.match(
    /<text[^>]*\by="([-\d.]+)"[^>]*\bfont-size="([\d.]+)"[^>]*>[^<]*<tspan\s+font-size="([\d.]+)"\s+dy="([\d.]+)"/);
  assert.ok(m, "pan() emitted no name label in the shape this test reads");
  const [, y, fs, subFs, dy] = m.map(Number);
  return { base: y / fs, sub: subFs / fs, dy: dy / fs };
}

const SHAPE = labelShape();

/* The ink box pan()'s label() puts inside a field, as {halfW, up, down} in R
 * units, relative to the CENTRE of the field circle. label() sets the name at
 * `fs` on a baseline at cy + fs*SHAPE.base and the octave as a tspan at
 * fs*SHAPE.sub dropped a further fs*SHAPE.dy. */
function inkBox(name, oct, fs) {
  const sub = fs * SHAPE.sub;
  const halfW = (advance(name) * fs + advance(oct) * sub) / 2;
  const base = fs * SHAPE.base;
  return { halfW, up: ASCENT * fs - base, down: base + fs * SHAPE.dy + DESCENT * sub };
}

/** The furthest any corner of that box sits from the centre of the field. */
function inkReach(box) {
  return Math.max(Math.hypot(box.halfW, box.up), Math.hypot(box.halfW, box.down));
}

test("every name the app draws fits inside the field it labels", () => {
  const app = boot();
  const labelSize = (r, zone) => app.get(`labelSize(${r}, ${JSON.stringify(zone)})`);
  const numSize = (rNote) => app.get(`numSize(${rNote})`);

  for (const entry of SWEEP) {
    const { geom, fields } = solved(entry);
    for (const id of Object.keys(fields)) {
      const [name, oct, , zone] = fields[id];
      const r = zone === "ding" ? geom.r_ding
              : zone === "bottom" ? geom.r_bnote : geom.r_note;
      const fs = labelSize(r, zone);
      const reach = inkReach(inkBox(name, oct, fs));
      // THE bound: the glyphs the app emits for this field stay inside the
      // circle it drew for that field. Nothing else in the suite makes it,
      // which is how a ratio over 1.0 could ship green.
      assert.ok(reach <= r,
        `${entry.label}: "${name}${oct}" (${zone}) reaches ${reach.toFixed(4)} `
        + `outside its field radius ${r.toFixed(4)} at size ${fs.toFixed(4)}`);
    }
  }

  // The name must outrank the index number beside it. Both sizes come from
  // the app, so this moves the moment either constant does.
  for (const entry of SWEEP) {
    const { geom } = solved(entry);
    assert.ok(labelSize(geom.r_note, "rim") > numSize(geom.r_note),
      `${entry.label}: rim name is not larger than the index number`);
    assert.ok(labelSize(geom.r_ding, "ding") > numSize(geom.r_note),
      `${entry.label}: ding name is not larger than the index number`);
    // NOT asserted: a BOTTOM name over the index number. On a generated deck
    // whose bottom shell is packed tighter than its rim, the solver's own
    // r_bnote falls far enough under r_note that the bottom name lands under
    // the number ("mixed N=5": 0.0978 vs 0.1216). That inversion comes from
    // the solver's radii, is what main already ships, and belongs to
    // src/engine/layout.js. The three built-in decks ARE asserted, in
    // tests/test_print.py and tests/test_render_agreement.py.
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

/* ---- Lane S1: the solver refuses nothing for size ----------------------- */

/** A bare field map of the given shape: ding, rim 1.., inner after the rim,
 *  bottom 101.. - the ids and labels core.parseSeed gives. Pitches are
 *  placeholders; the solver reads zones only. */
function panFields(rim, inner, bottom) {
  const out = { 0: ["D", 3, 50, "ding", null, "Ding"] };
  for (let i = 1; i <= rim + inner; i += 1) {
    out[i] = ["C", 4, 60, i <= rim ? "rim" : "inner", null, String(i)];
  }
  for (let i = 1; i <= bottom; i += 1) out[100 + i] = ["C", 3, 48, "bottom", null, `U${i}`];
  return out;
}

function solveCounts(rim, inner, bottom, options) {
  const res = HPE.layout.solve(panFields(rim, inner, bottom), options);
  assert.equal(res.ok, true, `${rim}/${inner}/${bottom}: ${res.code}`);
  return res.value;
}

test("a twelfth rim field solves", () => {
  assert.equal(solveCounts(12, 0, 0).geom.r_note > 0, true);
});

test("a third inner field solves", () => {
  assert.equal(countZone(solveCounts(11, 3, 0).fields, "inner"), 3);
});

test("a seventh bottom field solves", () => {
  assert.equal(countZone(solveCounts(11, 2, 7).fields, "bottom"), 7);
});

test("a hundred and fifty rim notes solve", () => {
  const { geom, fields } = solveCounts(150, 0, 0);
  assert.equal(countZone(fields, "rim"), 150);
  assert.ok(geom.r_note > 0 && geom.ext > 1);
});

test("an over-cap pan solves, order or no order", () => {
  const over = panFields(12, 0, 0);
  const identity = Array.from({ length: 12 }, (_, i) => i);
  for (const options of [undefined, { order: identity }]) {
    assert.equal(HPE.layout.solve(over, options).ok, true);
  }
  const bad = HPE.layout.solve(over, { order: "junk" });
  assert.equal(bad.ok, false);
  assert.equal(bad.code, "BAD_NOTE");
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

test("ET-2 rim/bottom/inner angles follow CLAUDE.md zig-zags", () => {
  const core = HPE.core;
  const angles = (seed, zone, options) => {
    const solved = HPE.layout.solve(core.parseSeed(seed).value, options);
    assert.equal(solved.ok, true);
    return Object.keys(solved.value.fields)
      .filter((id) => solved.value.fields[id][3] === zone)
      .sort((a, b) => Number(a) - Number(b))
      .map((id) => solved.value.fields[id][4]);
  };
  const host = (v) => JSON.parse(JSON.stringify(v));

  assert.deepEqual(host(HPE.layout.rimAngles(9)), [290, 250, 330, 210, 10, 170, 50, 130, 90]);
  assert.deepEqual(host(HPE.layout.bottomAngles(6)), [300, 240, 0, 180, 60, 120]);
  assert.deepEqual(host(HPE.layout.innerAngles(2)), [128, 52]);

  const mirroredEight = [270, 225, 315, 180, 0, 135, 45, 90];
  assert.deepEqual(angles("(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4", "rim", { mirror: true }), mirroredEight);
  assert.deepEqual(angles("(D3) A3 C4 D4 E4 F4 G4 A4 C5", "rim", { mirror: true }), mirroredEight);
  assert.deepEqual(
    angles("(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5", "bottom"),
    [300, 240, 0, 180, 60, 120]);
});

/* ------------------------------------------------------------- EG-5 */

test("EG-5 slotOrder matches solve's emitted field order on the corpus", () => {
  const corpus = JSON.parse(fs.readFileSync(
    path.join(FIXTURES, "engine_corpus_v1.json"), "utf8")).corpus.synthetic;
  let checked = 0;
  for (const row of corpus) {
    if (!row.parse.ok) continue;
    const fields = row.parse.fields;
    const solved = HPE.layout.solve(fields);
    if (!solved.ok) continue;
    const rank = { rim: 0, inner: 1, bottom: 2 };
    const ids = Object.keys(fields)
      .filter((id) => fields[id][3] !== "ding")
      .sort((a, b) => rank[fields[a][3]] - rank[fields[b][3]] || Number(a) - Number(b));
    const counts = { rim: 0, inner: 0, bottom: 0 };
    for (const id of ids) counts[fields[id][3]] += 1;
    assert.deepEqual(plain(HPE.layout.slotOrder(counts)), ids.map((id) => fields[id][3]), row.name);

    const reversed = ids.map((_, i) => ids.length - 1 - i);
    const back = HPE.layout.solve(fields, { order: reversed });
    assert.equal(back.ok, true, row.name);
    ids.forEach((id, i) => {
      assert.equal(back.value.fields[id][4], solved.value.fields[ids[reversed[i]]][4],
        `${row.name}: field ${id} takes slot ${reversed[i]}`);
    });
    checked += 1;
  }
  assert.ok(checked >= 10, `only ${checked} corpus rows checked`);
});

/* ---- Lane S1: inner notes fan, the ding clears their numbers ------------- */

const innerSeats = (k) => Object.values(solveCounts(9, k, 0).fields)
  .filter((f) => f[3] === "inner").map((f) => f[4]);

test("two inner notes sit at 128 and 52", () => {
  assert.deepEqual(innerSeats(2), [128, 52]);
  assert.deepEqual(plain(HPE.layout.innerAngles(2)), [128, 52]);
});

test("one, three, four, five and six inner notes take the fan seats", () => {
  assert.deepEqual(innerSeats(0), []);
  assert.deepEqual(innerSeats(1), [90]);
  assert.deepEqual(innerSeats(3), [166, 14, 90]);
  assert.deepEqual(innerSeats(4), [180, 0, 120, 60]);
  assert.deepEqual(innerSeats(5), [180, 0, 135, 45, 90]);
  assert.deepEqual(innerSeats(6), [180, 0, 144, 36, 108, 72]);
});

/** Appendix C: the smallest distance between an inner index number (centred
 *  where pan() draws it) and the ding's edge, less the number's reach. */
function innerNumberClearance(geom, fields) {
  let best = Infinity;
  for (const id of Object.keys(fields)) {
    const [, , , zone, angle] = fields[id];
    if (zone !== "inner") continue;
    const nr = geom.inner - geom.r_note - geom.n_in;
    const dx = nr * Math.cos(angle * DEG);
    const dy = nr * Math.sin(angle * DEG) + geom.ding_dy;
    best = Math.min(best, Math.hypot(dx, dy) - geom.r_ding - 0.7 * geom.f_num);
  }
  return best;
}

test("the ding offset stays 0.1425 for the Pygmy shape and rises until every inner number clears", () => {
  const pygmy = solveCounts(9, 2, 6);
  assert.equal(pygmy.geom.ding_dy, 0.1425);
  assert.ok(innerNumberClearance(pygmy.geom, pygmy.fields) >= 0.01);

  for (const k of [1, 2, 3, 4, 5, 6, 9, 12]) {
    for (const rim of [1, 3, 5, 9, 14]) {
      const { geom, fields } = solveCounts(rim, k, 0);
      assert.ok(geom.ding_dy >= 0.1425 && geom.ding_dy <= 0.3, `${rim}/${k}: ${geom.ding_dy}`);
      if (geom.ding_dy < 0.3) {
        assert.ok(innerNumberClearance(geom, fields) >= 0.01, `${rim} rim ${k} inner clears`);
      }
      if (geom.ding_dy > 0.1425) {
        const lower = Math.round((geom.ding_dy - 0.0025) * 10000) / 10000;
        const again = HPE.layout.solve(panFields(rim, k, 0));
        assert.equal(again.value.geom.ding_dy, geom.ding_dy, "deterministic");
        assert.ok(lower >= 0.1425);
      }
    }
  }
  const three = solveCounts(9, 3, 0);
  assert.ok(three.geom.ding_dy > 0.1425, "three inner notes on nine rim push the ding down");
  const four = solveCounts(9, 4, 0);
  assert.ok(four.geom.ding_dy > three.geom.ding_dy - 0.0001);
});

test("no two fields overlap at any count", () => {
  const worst = { top: Infinity, bottom: Infinity };
  let pans = 0;
  for (const mirror of [false, true]) {
    for (let rim = 1; rim <= 60; rim += 1) {
      for (let inner = 0; inner <= 12; inner += 1) {
        for (const bottom of [0, 1, 2, 7, 13, 40]) {
          const { geom, fields } = solveCounts(rim, inner, bottom, { mirror });
          pans += 1;
          const all = circles(geom, fields);
          const seats = new Set();
          for (const id of Object.keys(fields)) {
            const [, , , zone, angle] = fields[id];
            if (zone === "ding") continue;
            const key = `${zone}:${angle}`;
            assert.equal(seats.has(key), false, `${rim}/${inner}/${bottom}: duplicate seat ${key}`);
            seats.add(key);
          }
          for (let i = 0; i < all.length; i += 1) {
            for (let j = i + 1; j < all.length; j += 1) {
              const a = all[i];
              const b = all[j];
              if ((a.zone === "bottom") !== (b.zone === "bottom")) continue;
              const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
              assert.ok(gap > 0,
                `${rim}/${inner}/${bottom} mirror ${mirror}: fields ${a.id} and ${b.id} overlap by ${-gap}`);
              const key = a.zone === "bottom" ? "bottom" : "top";
              worst[key] = Math.min(worst[key], gap);
            }
          }
        }
      }
    }
  }
  assert.equal(pans, 9360);
  assert.ok(worst.top > 0 && worst.bottom > 0);
});

/* ---- Lane S1: labelFloor and the warning --------------------------------- */

const floorOf = (rim, inner, bottom) => HPE.layout.labelFloor(solveCounts(rim, inner, bottom).geom);

/** The first count in [lo, hi] at which the floor is under 3.6 pt. */
function crossing(lo, hi, floorAt) {
  for (let n = lo; n <= hi; n += 1) if (floorAt(n) < 3.6) return n;
  return null;
}

test("labelFloor crosses 3.6 pt at 21 rim, at 15 rim with a bottom shell, at seven inner on nine rim, and at 36 bottom", () => {
  assert.equal(crossing(1, 60, (n) => floorOf(n, 0, 0)), 21);
  assert.equal(crossing(1, 60, (n) => floorOf(n, 0, 2)), 15);
  assert.equal(crossing(0, 12, (n) => floorOf(9, n, 0)), 7);
  assert.equal(crossing(2, 60, (n) => floorOf(9, 0, n)), 36);
});

test("bottom octave digits do not trigger the warning", () => {
  const one = floorOf(9, 0, 1);
  assert.ok(one >= 3.6, `one bottom note alone floors at ${one}`);
  const { geom } = solveCounts(9, 0, 1);
  const R = Math.round(74 / geom.ext * 10) / 10;
  const bottomOctave = 0.66 * 0.8232 * geom.r_bnote * R;
  assert.ok(bottomOctave < 3.6, "the bottom octave digit is itself under the floor");
  assert.ok(one > bottomOctave);
});

test("the E Amara 20 shape carries no warning", () => {
  assert.ok(floorOf(9, 3, 7) >= 3.6);
});

test("labelFloor of an empty pan is finite", () => {
  assert.equal(Number.isFinite(HPE.layout.labelFloor(solveCounts(0, 0, 0).geom)), true);
});

/* ---- R4: the automated form of G-RENDER ---------------------------------- */

/** pan()'s own output for a solved pan, parsed back to coordinates (viewBox
 *  units, y-down, R = 100). Field circles are the ones stroked in ink or the
 *  receded grey; numbers are the <text> elements with no <tspan>. */
function drawn(rim, inner, bottom) {
  const app = boot();
  const { geom, fields } = solveCounts(rim, inner, bottom);
  const d = JSON.stringify({ geom, fields, colors: { root: "#0B7B75", tone: "#DD8F00" } });
  const svg = app.get(`pan(${d}, null)`);
  const circlesOut = [];
  for (const m of svg.matchAll(/<circle cx="([-\d.e]+)" cy="([-\d.e]+)" r="([-\d.e]+)" fill="#fff"/g)) {
    circlesOut.push({ x: +m[1], y: +m[2], r: +m[3] });
  }
  const numbers = [];
  for (const m of svg.matchAll(/<text x="([-\d.e]+)" y="([-\d.e]+)"[^>]*font-size="([-\d.e]+)">([^<]*)<\/text>/g)) {
    numbers.push({ x: +m[1], y: +m[2] - 0.34 * +m[3], fs: +m[3], label: m[4] });
  }
  return { geom, fields, circlesOut, numbers };
}

/* A digit advances about 0.56 em in Nunito Sans and stands about 0.72 em tall;
 * the ding check keeps the plan's own 0.7-em reach disc (Appendix C) because
 * that is the model the offset is solved against. */
const boxHalfW = (n) => 0.28 * n.fs * n.label.length;
const boxHalfH = (n) => 0.36 * n.fs;
function boxToPoint(n, px, py) {
  const dx = Math.max(Math.abs(px - n.x) - boxHalfW(n), 0);
  const dy = Math.max(Math.abs(py - n.y) - boxHalfH(n), 0);
  return Math.hypot(dx, dy);
}

const G_RENDER_SHAPES = [
  [9, 1, 0], [9, 2, 0], [9, 3, 0], [9, 4, 0], [9, 6, 0], [5, 2, 0], [9, 3, 7],
];

test("no inner index number meets the ding or a neighbour on the G-RENDER shapes", () => {
  for (const [rim, inner, bottom] of G_RENDER_SHAPES) {
    const { geom, fields, circlesOut, numbers } = drawn(rim, inner, bottom);
    const R = 100;
    const ding = circlesOut.find((c) => c.r === R * geom.r_ding);
    assert.ok(ding, `${rim}/${inner}/${bottom}: the ding circle was not found`);
    const innerLabels = new Set(Object.keys(fields)
      .filter((id) => fields[id][3] === "inner").map((id) => fields[id][5]));
    const mine = numbers.filter((n) => innerLabels.has(n.label));
    assert.equal(mine.length, inner, `${rim}/${inner}/${bottom}: inner numbers found`);
    for (const n of mine) {
      const reach = 0.7 * n.fs;
      const label = `${rim}/${inner}/${bottom} number ${n.label}`;
      assert.ok(Math.hypot(n.x - ding.x, n.y - ding.y) - ding.r - reach >= 1,
        `${label} is within 0.01 R of the ding`);
      for (const c of circlesOut) {
        if (c === ding) continue;
        const toCentre = Math.hypot(n.x - c.x, n.y - c.y);
        if (Math.abs(toCentre - (c.r + geom.n_in * R)) < 1e-6) continue;   /* its own field */
        assert.ok(boxToPoint(n, c.x, c.y) - c.r >= 0,
          `${label} touches a field circle at (${c.x.toFixed(1)}, ${c.y.toFixed(1)})`);
      }
      for (const o of numbers) {
        if (o === n) continue;
        assert.ok(Math.abs(n.x - o.x) >= boxHalfW(n) + boxHalfW(o)
          || Math.abs(n.y - o.y) >= boxHalfH(n) + boxHalfH(o),
          `${label} touches number ${o.label}`);
      }
    }
  }
});
