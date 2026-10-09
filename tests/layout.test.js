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
  const parsed = HPE.core.parseLegacySeed(s);
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

test("solve with no seats preserves the field ids and every non-angle column", () => {
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
  const parsed = HPE.core.parseLegacySeed(PYGMY_RIM_SEED);
  assert.equal(parsed.ok, true);
  return solved({ seed: parsed.value, string: PYGMY_RIM_SEED, label: "pygmy rim" }, options);
}

test("nine rim fields with an inner pair reproduce the verified pygmy zig-zag", () => {
  const { fields } = pygmyRim({ anchor: "between" });
  const angles = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => fields[String(i)][4]);
  assert.deepEqual(angles, [290, 250, 330, 210, 10, 170, 50, 130, 90]);
});

test("anchor between seats the pygmy nine-field zig-zag, and mirror reflects it", () => {
  const angles = (options) => {
    const { fields } = pygmyRim(options);
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => fields[String(i)][4]);
  };
  assert.deepEqual(angles({ anchor: "between" }), [290, 250, 330, 210, 10, 170, 50, 130, 90]);
  assert.deepEqual(angles({ anchor: "between", mirror: true }), [250, 290, 210, 330, 170, 10, 130, 50, 90]);
});

test("eight rim fields with default options reproduce the verified hijaz / amara zig-zag", () => {
  const eight = seedOf(NINETEEN, 8, 0);
  const { fields } = solved({ ...eight, label: "hijaz rim" });
  const angles = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => fields[String(i)][4]);
  assert.deepEqual(angles, [270, 225, 315, 180, 0, 135, 45, 90]);
});

test("six bottom fields reproduce the verified pygmy x-ray ring", () => {
  const full = seedOf(NINETEEN, 13, 6);
  const { fields } = solved({ ...full, label: "pygmy bottom" });
  const angles = [101, 102, 103, 104, 105, 106].map((i) => fields[String(i)][4]);
  assert.deepEqual(angles, [300, 240, 0, 180, 60, 120]);
});

test("the rim is evenly spread; anchor one puts note 1 at bottom centre, between straddles it", () => {
  for (const entry of SWEEP) {
    for (const anchor of ["one", "between"]) {
      const { fields } = solved(entry, { anchor });
      const rim = Object.keys(fields)
        .filter((id) => fields[id][3] === "rim")
        .sort((a, b) => Number(a) - Number(b))
        .map((id) => fields[id][4]);
      const step = 360 / rim.length;
      if (anchor === "one") assert.equal(rim[0], 270, `${entry.label}: note 1 at bottom centre`);
      else assert.ok(Math.abs(rim[0] - (270 + step / 2)) < 0.06, `${entry.label}: note 1 half a step right of 270`);
      assertSpread(entry, rim, step);
    }
  }
});

function assertSpread(entry, rim, step) {
  const sorted = [...rim].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    assert.ok(Math.abs(sorted[i] - sorted[i - 1] - step) < 0.25,
      `${entry.label}: rim spacing ${sorted[i - 1]} -> ${sorted[i]}, step ${step}`);
  }
}

/* Anchor one puts note 1 exactly at bottom centre (hijaz's field 1 at 270), so
 * the side the zig-zag starts on is read off the first rim field that is not
 * on the vertical axis. */
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

test("one direction: the default seats the first off-axis rim note on the left, mirror on the right", () => {
  for (const entry of SWEEP) {
    for (const anchor of ["one", "between"]) {
      const plainFields = solved(entry, { anchor }).fields;
      const mirrored = HPE.layout.solve(entry.seed, { anchor, mirror: true }).value;
      const [def, mir] = anchor === "one" ? [-1, 1] : [1, -1];
      assert.equal(Math.sign(firstSideX(plainFields)), def, `${entry.label} ${anchor}: default hand`);
      assert.equal(Math.sign(firstSideX(mirrored.fields)), mir, `${entry.label} ${anchor}: mirror hand`);
    }
  }
});

test("odd rim notes sit right and even left at every count from 2 to 24, both anchors", () => {
  for (let count = 2; count <= 24; count += 1) {
    for (const anchor of ["one", "between"]) {
      const angles = HPE.layout.rimAngles(count, anchor);
      assert.equal(angles.length, count);
      angles.forEach((a, i) => {
        const x = Math.cos(a * DEG);
        if (Math.abs(x) < 1e-9) return;
        if (anchor === "one" && i === 0) return;
        assert.equal(x > 0, i % 2 === 0,
          `${count} rim, ${anchor}: note ${i + 1} at ${a} is on the ${x > 0 ? "right" : "left"}`);
      });
    }
  }
});

test("anchor one puts note 1 at 270; anchor between straddles 270 with note 1 on the right", () => {
  for (let count = 2; count <= 24; count += 1) {
    const one = HPE.layout.rimAngles(count, "one");
    const between = HPE.layout.rimAngles(count, "between");
    const step = 360 / count;
    assert.equal(one[0], 270, `${count} one`);
    assert.ok(Math.abs(((between[0] - (270 + step / 2)) + 540) % 360 - 180) < 1e-9, `${count} between note 1`);
    assert.ok(Math.abs(between[1] - (270 - step / 2)) < 1e-9, `${count} between note 2`);
  }
  assert.deepEqual(plain(HPE.layout.rimAngles(9, "one").map((a) => Math.round(a))), [270, 230, 310, 190, 350, 150, 30, 110, 70]);
  assert.deepEqual(plain(HPE.layout.rimAngles(8, "one")), [270, 225, 315, 180, 0, 135, 45, 90]);
  assert.deepEqual(plain(HPE.layout.rimAngles(9, "between").map((a) => Math.round(a))), [290, 250, 330, 210, 10, 170, 50, 130, 90]);
  assert.deepEqual(plain(HPE.layout.rimAngles(8, "between")), [292.5, 247.5, 337.5, 202.5, 22.5, 157.5, 67.5, 112.5]);
});

test("the anchor applies with and without inner notes", () => {
  const rimOf = (str, options) => {
    const parsed = HPE.core.parseLegacySeed(str);
    const { fields } = HPE.layout.solve(parsed.value, options).value;
    return Object.keys(fields).filter((id) => fields[id][3] === "rim")
      .sort((a, b) => Number(a) - Number(b)).map((id) => fields[id][4]);
  };
  const noInner = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5";
  const withInner = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5 / D5 E5";
  for (const str of [noInner, withInner]) {
    assert.equal(rimOf(str, { anchor: "one" })[0], 270, `${str} one`);
    assert.ok(Math.abs(rimOf(str, { anchor: "between" })[0] - 290) < 0.06, `${str} between`);
    assert.deepEqual(rimOf(str), rimOf(str, { anchor: "one" }), `${str} default is one`);
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
    const parsed = HPE.core.parseLegacySeed(str);
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

test("stored seats and mirror draw the same sides on an odd rim", () => {
  const nine = { ...seedOf(TWELVE, 9, 0), label: "nine rim" };
  const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(String);
  const anglesOf = (options) => {
    const { fields } = solved(nine, options);
    return ids.map((id) => fields[id][4]);
  };
  assert.deepEqual(anglesOf({ seats: { rim: rotated(9, 1) } }), rotated(9, 1).map((slot) => ODD_FROM_BOTTOM[9].plain[slot]));
  assert.deepEqual(anglesOf({ seats: { rim: reversed(9) } }), ODD_FROM_BOTTOM[9].plain.slice().reverse());
  assert.deepEqual(anglesOf({ mirror: true }), ODD_FROM_BOTTOM[9].mirror);
  assert.deepEqual(anglesOf({ mirror: true, seats: { rim: reversed(9) } }), ODD_FROM_BOTTOM[9].mirror.slice().reverse());
});

test("even rim counts run in the one direction: note 2 on the left, mirror on the right", () => {
  const EVEN = {
    6: { plain: [270, 210, 330, 150, 30, 90], mirror: [270, 330, 210, 30, 150, 90] },
    8: { plain: [270, 225, 315, 180, 0, 135, 45, 90], mirror: [270, 315, 225, 0, 180, 45, 135, 90] },
    10: { plain: [270, 234, 306, 198, 342, 162, 18, 126, 54, 90], mirror: [270, 306, 234, 342, 198, 18, 162, 54, 126, 90] },
  };
  for (const count of [6, 8, 10]) {
    assert.deepEqual(rimOnly(count).angles, EVEN[count].plain, `${count} plain`);
    assert.deepEqual(rimOnly(count, { mirror: true }).angles, EVEN[count].mirror, `${count} mirror`);
  }
});

test("default options reproduce the shipped Amara 9 and Hijaz layouts", () => {
  const decks = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "decks.json"), "utf8"));
  const makers = {
    amara: "(D3) A3 C4 D4 E4 F4 G4 A4 C5",
    hijaz: "(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4",
  };
  for (const id of Object.keys(makers)) {
    const shipped = decks.find((d) => d.id === id);
    const parsed = HPE.core.parseLegacySeed(makers[id]);
    const { geom, fields } = HPE.layout.solve(parsed.value).value;
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

test("the inner pair ascends opposite the rim direction (anchor between, where note 1 leaves the axis)", () => {
  for (const entry of SWEEP) {
    const { fields } = solved(entry, { anchor: "between" });
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
    const { fields } = HPE.layout.solve(entry.seed, { anchor: "between", mirror: true }).value;
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

test("an over-cap pan solves, seats or no seats", () => {
  const over = panFields(12, 0, 0);
  const identity = Array.from({ length: 12 }, (_, i) => i);
  for (const options of [undefined, { seats: { rim: identity } }]) {
    assert.equal(HPE.layout.solve(over, options).ok, true);
  }
  const bad = HPE.layout.solve(over, { seats: "junk" });
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

/* ---- Lane S3: options.seats, the layout correction, one ring at a time -----
 *
 * ONE seed option, `seats`, an object with optional `rim`, `inner` and `bottom`.
 * Each is a permutation of that ring's seat indices: entry i is the seat the
 * ring's i-th note (ascending by id) takes. A missing, null or undefined ring
 * is the generated default. Every ring is validated on its own against its own
 * length, so no input can seat a note in another ring. Anything malformed is
 * rejected through the section 1 result contract with BAD_NOTE - the section 2
 * enum is CLOSED. The legacy flat `order` is gone from the solver; only
 * `seatsFromOrder` reads it, for version 1 and 2 records and links. */

const RINGS = ["rim", "inner", "bottom"];

/** The ids of one ring, ascending by id - the order seats are indexed in. */
function ringIds(fields) {
  const out = { rim: [], inner: [], bottom: [] };
  for (const id of Object.keys(fields).sort((a, b) => Number(a) - Number(b))) {
    if (out[fields[id][3]]) out[fields[id][3]].push(id);
  }
  return out;
}

function identity(n) {
  return Array.from({ length: n }, (_, i) => i);
}

/** A permutation that is not the identity for any n >= 2: reverse it. */
function reversed(n) {
  return identity(n).reverse();
}

/** A single cyclic shift - what ROTATE writes. */
function rotated(n, by) {
  return identity(n).map((i) => (i + by + n) % n);
}

function anglesById(fields) {
  const out = {};
  for (const id of Object.keys(fields)) out[id] = fields[id][4];
  return out;
}

/** Every ring of an entry reversed; rings of one note stay as they are. */
function allReversed(entry) {
  const rings = ringIds(plain(solved(entry)).fields);
  const seats = {};
  for (const ring of RINGS) if (rings[ring].length) seats[ring] = reversed(rings[ring].length);
  return seats;
}

test("a seat list for one ring cannot name a seat in another", () => {
  const entry = SWEEP.find((e) => e.label === "mixed N=19");
  const rings = ringIds(plain(solved(entry)).fields);
  assert.ok(rings.rim.length > 0 && rings.inner.length > 0 && rings.bottom.length > 0);
  const bad = [
    { rim: identity(rings.rim.length + 1) },
    { rim: identity(rings.rim.length - 1) },
    { rim: identity(rings.rim.length - 1).concat([rings.rim.length]) },
    { inner: identity(rings.inner.length - 1).concat([rings.inner.length + rings.bottom.length]) },
    { bottom: identity(rings.bottom.length - 1).concat([rings.bottom.length]) },
    { inner: identity(rings.rim.length) },
  ];
  for (const seats of bad) {
    const res = HPE.layout.solve(entry.seed, { seats });
    assert.equal(res.ok, false, `accepted ${JSON.stringify(seats)}`);
    assert.equal(res.code, "BAD_NOTE");
  }
});

test("seats naming a ring that does not exist, or a non-object, are rejected BAD_NOTE", () => {
  const entry = SWEEP.find((e) => e.n === 19);
  for (const seats of [{ top: [0] }, "0,1,2", [0, 1], 17, true]) {
    let res;
    assert.doesNotThrow(() => { res = HPE.layout.solve(entry.seed, { seats }); });
    assert.equal(res.ok, false, `accepted ${JSON.stringify(seats)}`);
    assert.equal(res.code, "BAD_NOTE");
  }
});

test("a ring that is not a permutation is rejected BAD_NOTE, never thrown", () => {
  const entry = SWEEP.find((e) => e.label === "mixed N=19");
  const n = ringIds(plain(solved(entry)).fields).rim.length;
  const bad = [
    identity(n).slice(0, n - 1),
    identity(n).concat([n]),
    identity(n - 1).concat([0]),
    identity(n - 1).concat([n]),
    identity(n - 1).concat([-1]),
    identity(n - 1).concat([0.5]),
    identity(n - 1).concat(["0"]),
    identity(n - 1).concat([NaN]),
    "0,1,2",
    {},
    17,
    true,
  ];
  for (const rim of bad) {
    let res;
    assert.doesNotThrow(() => { res = HPE.layout.solve(entry.seed, { seats: { rim } }); },
      `solve threw on ${JSON.stringify(rim)}`);
    assert.equal(res.ok, false, `accepted ${JSON.stringify(rim)}`);
    assert.equal(res.code, "BAD_NOTE", `wrong code for ${JSON.stringify(rim)}`);
    assert.equal(typeof res.reason, "string");
    assert.equal("value" in res, false, "an err result carries no value");
  }
});

test("a rejected ring names the value in the section 2 BAD_NOTE reason", () => {
  const entry = SWEEP.find((e) => e.n === 19);
  const res = HPE.layout.solve(entry.seed, { seats: { rim: [0, 0] } });
  assert.equal(res.ok, false);
  assert.equal(res.reason,
    HPE.core.REASONS.BAD_NOTE.reason.split("<X>").join(String([0, 0]).slice(0, 12)));
});

test("a bad ring is rejected on a bare fields map too", () => {
  const entry = SWEEP.find((e) => e.n === 19);
  const res = HPE.layout.solve(entry.seed.fields, { seats: { rim: [1, 2, 3] } });
  assert.equal(res.ok, false);
  assert.equal(res.code, "BAD_NOTE");
});

test("absent seats solve exactly as they did before seats existed", () => {
  for (const entry of SWEEP) {
    const base = plain(solved(entry));
    assert.deepStrictEqual(plain(solved(entry, {})), base, entry.label);
    assert.deepStrictEqual(plain(solved(entry, { seats: null })), base, entry.label);
    assert.deepStrictEqual(plain(solved(entry, { seats: undefined })), base, entry.label);
    assert.deepStrictEqual(plain(solved(entry, { seats: {} })), base, entry.label);
    assert.deepStrictEqual(plain(solved(entry, { seats: { rim: null, inner: undefined } })), base, entry.label);
  }
});

test("identity seats are exactly absent seats", () => {
  for (const entry of SWEEP) {
    const base = plain(solved(entry));
    const rings = ringIds(base.fields);
    const seats = {};
    for (const ring of RINGS) seats[ring] = identity(rings[ring].length);
    assert.deepStrictEqual(plain(solved(entry, { seats })), base, entry.label);
  }
});

test("a ring's seats say which seat each of its notes takes", () => {
  for (const entry of SWEEP) {
    const base = plain(solved(entry)).fields;
    const rings = ringIds(base);
    for (const ring of RINGS) {
      const ids = rings[ring];
      if (ids.length < 2) continue;
      const slots = ids.map((id) => base[id][4]);
      for (const perm of [reversed(ids.length), rotated(ids.length, 1), rotated(ids.length, -2)]) {
        const moved = plain(solved(entry, { seats: { [ring]: perm } })).fields;
        ids.forEach((id, i) => {
          assert.equal(moved[id][4], slots[perm[i]], `${entry.label} ${ring} #${id}`);
        });
        for (const other of RINGS) {
          if (other === ring) continue;
          for (const id of rings[other]) {
            assert.equal(moved[id][4], base[id][4], `${entry.label}: ${ring} moved ${other} #${id}`);
          }
        }
      }
    }
  }
});

test("seats reassign the solved angles and never invent one", () => {
  for (const entry of SWEEP) {
    const base = plain(solved(entry)).fields;
    const moved = plain(solved(entry, { seats: allReversed(entry) })).fields;
    for (const ring of RINGS) {
      const ids = ringIds(base)[ring];
      assert.deepStrictEqual(ids.map((id) => moved[id][4]).sort(), ids.map((id) => base[id][4]).sort(),
        `${entry.label}: the ${ring} angle set changed`);
    }
  }
});

test("non-trivial seats actually move at least one field", () => {
  for (const entry of SWEEP) {
    if (entry.n < 2) continue;
    const base = plain(solved(entry)).fields;
    const moved = plain(solved(entry, { seats: allReversed(entry) })).fields;
    assert.notDeepStrictEqual(anglesById(moved), anglesById(base), entry.label);
  }
});

test("seats change only the angles, never the geometry", () => {
  for (const entry of SWEEP) {
    const base = plain(solved(entry)).geom;
    const moved = plain(solved(entry, { seats: allReversed(entry) })).geom;
    assert.deepStrictEqual(moved, base, entry.label);
  }
});

test("the ding is never part of the correction and keeps its null angle", () => {
  for (const entry of SWEEP) {
    const { fields } = solved(entry, { seats: allReversed(entry) });
    const dings = Object.keys(fields).filter((id) => fields[id][3] === "ding");
    assert.equal(dings.length, 1, entry.label);
    assert.equal(fields[dings[0]][4], null, entry.label);
  }
});

test("seats never change a zone", () => {
  for (const entry of SWEEP) {
    const before = zoneColumn(plain(solved(entry)).fields);
    const after = zoneColumn(plain(solved(entry, { seats: allReversed(entry) })).fields);
    assert.deepStrictEqual(after, before, entry.label);
  }
});

test("seats and mirror compose: a flip reflects the corrected layout", () => {
  for (const entry of SWEEP) {
    const rings = ringIds(plain(solved(entry)).fields);
    const seats = {};
    for (const ring of RINGS) if (rings[ring].length) seats[ring] = rotated(rings[ring].length, 1);
    const straight = solved(entry, { seats }).fields;
    const flipped = solved(entry, { seats, mirror: true }).fields;
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

test("the seed's own options.seats is honoured, and an explicit option wins", () => {
  const entry = SWEEP.find((e) => e.n === 19);
  const seats = allReversed(entry);
  const seed = plain(entry.seed);
  seed.options.seats = seats;
  const fromSeed = HPE.layout.solve(seed).value.fields;
  const explicit = HPE.layout.solve(entry.seed, { seats }).value.fields;
  assert.deepStrictEqual(plain(fromSeed), plain(explicit));
  const overridden = HPE.layout.solve(seed, { seats: null }).value.fields;
  assert.deepStrictEqual(plain(overridden), plain(solved(entry).fields));
});

test("solve does not mutate seats it was handed", () => {
  const entry = SWEEP.find((e) => e.n === 19);
  const seats = allReversed(entry);
  const before = plain(seats);
  HPE.layout.solve(entry.seed, { seats });
  assert.deepStrictEqual(plain(seats), before);
});

test("a flat order option no longer moves anything", () => {
  const entry = SWEEP.find((e) => e.n === 19);
  const res = HPE.layout.solve(entry.seed, { order: reversed(19) });
  assert.equal(res.ok, true);
  assert.deepStrictEqual(plain(res.value), plain(solved(entry)));
});

test("seatsFromOrder converts a flat order that stays in its rings", () => {
  const counts = { rim: 4, inner: 2, bottom: 3 };
  const order = [1, 0, 3, 2, 5, 4, 8, 6, 7];
  const res = HPE.layout.seatsFromOrder(order, counts);
  assert.equal(res.ok, true);
  assert.deepStrictEqual(plain(res.value), { rim: [1, 0, 3, 2], inner: [1, 0], bottom: [2, 0, 1] });
});

test("seatsFromOrder leaves a ring that is the identity as the default", () => {
  const counts = { rim: 3, inner: 0, bottom: 2 };
  const res = HPE.layout.seatsFromOrder([0, 1, 2, 4, 3], counts);
  assert.equal(res.ok, true);
  assert.deepStrictEqual(plain(res.value), { bottom: [1, 0] });
  assert.deepStrictEqual(plain(HPE.layout.seatsFromOrder([0, 1, 2, 3, 4], counts)), { ok: true, value: null });
  assert.deepStrictEqual(plain(HPE.layout.seatsFromOrder(null, counts)), { ok: true, value: null });
});

test("a flat order that crosses a ring is refused BAD_NOTE", () => {
  const counts = { rim: 3, inner: 0, bottom: 2 };
  for (const order of [[3, 1, 2, 0, 4], [0, 1, 4, 3, 2], reversed(5)]) {
    const res = HPE.layout.seatsFromOrder(order, counts);
    assert.equal(res.ok, false, JSON.stringify(order));
    assert.equal(res.code, "BAD_NOTE");
  }
});

test("seatsFromOrder refuses what is not a permutation of the field count", () => {
  const counts = { rim: 3, inner: 0, bottom: 2 };
  for (const order of [[0, 1, 2], [0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 3], [0, 1, 2, 3, "4"], "x", {}, 4]) {
    const res = HPE.layout.seatsFromOrder(order, counts);
    assert.equal(res.ok, false, JSON.stringify(order));
    assert.equal(res.code, "BAD_NOTE");
  }
});

test("a seatsFromOrder result solves to what the flat order did", () => {
  const entry = SWEEP.find((e) => e.label === "mixed N=19");
  const base = plain(solved(entry)).fields;
  const rings = ringIds(base);
  const counts = { rim: rings.rim.length, inner: rings.inner.length, bottom: rings.bottom.length };
  const order = [];
  let offset = 0;
  for (const ring of RINGS) {
    reversed(counts[ring]).forEach((slot) => order.push(offset + slot));
    offset += counts[ring];
  }
  const seats = HPE.layout.seatsFromOrder(order, counts).value;
  const moved = plain(solved(entry, { seats })).fields;
  const ids = [].concat(rings.rim, rings.inner, rings.bottom);
  ids.forEach((id, i) => assert.equal(moved[id][4], base[ids[order[i]]][4], `#${id}`));
});

test("ET-2 rim/bottom/inner angles follow CLAUDE.md zig-zags", () => {
  const core = HPE.core;
  const angles = (seed, zone, options) => {
    const solved = HPE.layout.solve(core.parseLegacySeed(seed).value, options);
    assert.equal(solved.ok, true);
    return Object.keys(solved.value.fields)
      .filter((id) => solved.value.fields[id][3] === zone)
      .sort((a, b) => Number(a) - Number(b))
      .map((id) => solved.value.fields[id][4]);
  };
  const host = (v) => JSON.parse(JSON.stringify(v));

  assert.deepEqual(host(HPE.layout.rimAngles(9, "between")), [290, 250, 330, 210, 10, 170, 50, 130, 90]);
  assert.deepEqual(host(HPE.layout.bottomAngles(6)), [300, 240, 0, 180, 60, 120]);
  assert.deepEqual(host(HPE.layout.innerAngles(2)), [128, 52]);

  const eight = [270, 225, 315, 180, 0, 135, 45, 90];
  assert.deepEqual(angles("(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4", "rim"), eight);
  assert.deepEqual(angles("(D3) A3 C4 D4 E4 F4 G4 A4 C5", "rim"), eight);
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

    const seats = {};
    const expected = {};
    for (const ring of ["rim", "inner", "bottom"]) {
      const ringIdList = ids.filter((id) => fields[id][3] === ring);
      if (ringIdList.length < 2) continue;
      seats[ring] = ringIdList.map((_, i) => ringIdList.length - 1 - i);
      ringIdList.forEach((id, i) => { expected[id] = solved.value.fields[ringIdList[seats[ring][i]]][4]; });
    }
    const back = HPE.layout.solve(fields, { seats });
    assert.equal(back.ok, true, row.name);
    for (const id of Object.keys(expected)) {
      assert.equal(back.value.fields[id][4], expected[id], `${row.name}: field ${id}`);
    }
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

/* ---- Lane S2: built-ins against the solver, and the two mirrors ---------- */

const BUILTIN_STRINGS = {
  hijaz: ["(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4", undefined],
  amara: ["(D3) A3 C4 D4 E4 F4 G4 A4 C5", undefined],
  kurd: ["(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5", undefined],
  amara10: ["(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5", undefined],
  pygmy: ["(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 / F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5", { anchor: "between" }],
};

const DECK_DATA = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "decks.json"), "utf8"));

test("the solver seats every built-in field where its diagram has it, from the deck's scale string", () => {
  assert.deepEqual(Object.keys(BUILTIN_STRINGS).sort(), DECK_DATA.map((d) => d.id).sort());
  for (const deck of DECK_DATA) {
    const [string, options] = BUILTIN_STRINGS[deck.id];
    const parsed = HPE.core.parseLegacySeed(string);
    assert.equal(parsed.ok, true, deck.id);
    const { fields } = HPE.layout.solve(parsed.value, options).value;
    const byMidi = {};
    for (const id of Object.keys(fields)) byMidi[fields[id][2]] = fields[id];
    assert.equal(Object.keys(fields).length, Object.keys(deck.fields).length, `${deck.id}: field count`);
    for (const id of Object.keys(deck.fields)) {
      const [, , midi, zone, angle] = deck.fields[id];
      const got = byMidi[midi];
      assert.ok(got, `${deck.id} field ${id}: midi ${midi} missing from solver output`);
      assert.equal(got[3], zone, `${deck.id} field ${id}: ring`);
      assert.equal(got[4], angle, `${deck.id} field ${id} (${deck.fields[id][0]}${deck.fields[id][1]}): angle`);
    }
  }
});

const BOTTOM_PAN = "(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 / F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5";
const anglesByZone = (options) => {
  const parsed = HPE.core.parseLegacySeed(BOTTOM_PAN);
  const { fields } = HPE.layout.solve(parsed.value, options).value;
  const out = { rim: [], inner: [], bottom: [] };
  for (const id of Object.keys(fields).sort((a, b) => Number(a) - Number(b))) {
    if (out[fields[id][3]]) out[fields[id][3]].push(fields[id][4]);
  }
  return out;
};
const reflect = (list) => list.map((a) => Math.round((((180 - a) % 360) + 360) % 360 * 10) / 10);

test("mirrorBottom reflects the bottom ring and nothing else", () => {
  const base = anglesByZone({ mirror: false, mirrorBottom: false });
  const got = anglesByZone({ mirror: false, mirrorBottom: true });
  assert.deepEqual(got.rim, base.rim);
  assert.deepEqual(got.inner, base.inner);
  assert.deepEqual(got.bottom, reflect(base.bottom));
  assert.notDeepEqual(got.bottom, base.bottom);
});

test("mirror with mirrorBottom false reflects rim and inner and leaves the bottom ring", () => {
  const base = anglesByZone({ mirror: false, mirrorBottom: false });
  const got = anglesByZone({ mirror: true, mirrorBottom: false });
  assert.deepEqual(got.rim, reflect(base.rim));
  assert.deepEqual(got.inner, reflect(base.inner));
  assert.deepEqual(got.bottom, base.bottom);
});

test("an absent mirrorBottom takes the value of mirror", () => {
  const implied = anglesByZone({ mirror: true });
  assert.deepEqual(implied, anglesByZone({ mirror: true, mirrorBottom: true }));
  const base = anglesByZone({ mirror: false });
  assert.deepEqual(implied.rim, reflect(base.rim));
  assert.deepEqual(implied.bottom, reflect(base.bottom));
  assert.deepEqual(base, anglesByZone({ mirror: false, mirrorBottom: false }));
  /* An odd rim with no inner notes keeps today's golden mirrored angles. */
  const odd = seedOf(TWELVE, 9, 0);
  const { fields } = HPE.layout.solve(odd.seed, { mirror: true }).value;
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => fields[String(i)][4]), ODD_FROM_BOTTOM[9].mirror);
  const withBottom = HPE.layout.solve(HPE.core.parseLegacySeed("(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5 | Bb2 C3 D3").value, { mirror: true }).value.fields;
  const plainBottom = HPE.layout.solve(HPE.core.parseLegacySeed("(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5 | Bb2 C3 D3").value).value.fields;
  const bottomIds = Object.keys(withBottom).filter((id) => withBottom[id][3] === "bottom");
  for (const id of bottomIds) {
    assert.equal(withBottom[id][4], reflect([plainBottom[id][4]])[0], `bottom field ${id}`);
  }
});

test("the call's mirrorBottom beats the seed's, and the seed's beats the top value", () => {
  const seedWith = (options) => {
    const seed = plain(HPE.core.parseLegacySeed(BOTTOM_PAN).value);
    Object.assign(seed.options, options);
    return seed;
  };
  const zonesOf = (seed, options) => {
    const { fields } = HPE.layout.solve(seed, options).value;
    const out = { bottom: [] };
    for (const id of Object.keys(fields).sort((a, b) => Number(a) - Number(b))) {
      if (fields[id][3] === "bottom") out.bottom.push(fields[id][4]);
    }
    return out.bottom;
  };
  const straight = anglesByZone({ mirror: false }).bottom;
  const flipped = reflect(straight);
  assert.deepEqual(zonesOf(seedWith({ mirrorBottom: true }), { mirror: false }), flipped, "seed beats top");
  assert.deepEqual(zonesOf(seedWith({ mirrorBottom: true }), { mirror: false, mirrorBottom: false }), straight, "call beats seed");
  assert.deepEqual(zonesOf(seedWith({ mirrorBottom: false }), { mirror: true }), straight, "seed false beats top true");
  assert.deepEqual(zonesOf(seedWith({ mirror: true }), {}), flipped, "no mirrorBottom anywhere: top");
});

test("resolveMirrors is one function: call first, then seed, then the top value", () => {
  const r = HPE.layout.resolveMirrors;
  assert.deepEqual(plain(r({}, {})), { top: false, bottom: false });
  assert.deepEqual(plain(r({ mirror: true }, {})), { top: true, bottom: true });
  assert.deepEqual(plain(r({}, { mirror: true })), { top: true, bottom: true });
  assert.deepEqual(plain(r({ mirror: false }, { mirror: true })), { top: false, bottom: false });
  assert.deepEqual(plain(r({ mirrorBottom: true }, {})), { top: false, bottom: true });
  assert.deepEqual(plain(r({ mirror: true }, { mirrorBottom: false })), { top: true, bottom: false });
  assert.deepEqual(plain(r({ mirror: true, mirrorBottom: false }, { mirrorBottom: true })), { top: true, bottom: false });
  assert.deepEqual(plain(r(undefined, undefined)), { top: false, bottom: false });
});

test("the geometry keys that differ from solver output are exactly the documented ones", () => {
  const documented = {
    hijaz: { f_ding: [0.135, 0.12], f_note: [0.128, 0.1454], f_num: [0.105, 0.1216] },
    amara: { f_ding: [0.135, 0.12], f_note: [0.128, 0.1454], f_num: [0.105, 0.1216] },
    kurd: {},
    amara10: {},
    pygmy: {},
  };
  const ABSENT_OK = new Set(["inner", "bottom", "ding_dy", "rim_num_out", "ext"]);
  for (const deck of DECK_DATA) {
    const [string, options] = BUILTIN_STRINGS[deck.id];
    const { geom } = HPE.layout.solve(HPE.core.parseLegacySeed(string).value, options).value;
    const differs = {};
    for (const key of Object.keys(geom)) {
      const stored = deck.geom[key];
      if (stored === undefined && ABSENT_OK.has(key)) continue;
      if (stored !== geom[key]) differs[key] = [stored, geom[key]];
    }
    for (const key of Object.keys(deck.geom)) {
      if (!(key in geom)) differs[key] = [deck.geom[key], undefined];
    }
    assert.deepEqual(plain(differs), plain(documented[deck.id]), `${deck.id}: geom drift`);
  }
});

/* ---------------------------------------------------------------- rule N
 * A seat's number is the label the default arrangement gave the note that
 * sits there. A moved note takes the number of the seat it now fills. */

const RULE_N_SCALES = [
  ["D3 example", "(D3) A3 C4 D4 E4 F4 G4 A4 C5"],
  ["D Kurd 10", "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5"],
  ["F3 Low Pygmy", "[C3] [Db3] [Eb3] F3 | G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]"],
];
const RULE_N_ANCHORS = ["one", "between"];
const RULE_N_MIRRORS = [[false, false], [true, false], [false, true], [true, true]];

const freshSeed = (text) => {
  const res = HPE.core.parseSeed(text, {});
  assert.equal(res.ok, true, `${text}: ${res.code}`);
  return res.value;
};

/** n-note ring: no move, one swap, then three swaps. */
function ruleNArrangements(n) {
  const out = [];
  if (n < 2) return out;
  const one = identity(n);
  [one[0], one[1]] = [one[1], one[0]];
  out.push(one);
  const three = identity(n);
  for (let k = 0; k < 3; k += 1) {
    const i = (k * 2) % n;
    const j = (k * 2 + 1) % n;
    if (i !== j) [three[i], three[j]] = [three[j], three[i]];
  }
  out.push(three);
  return out;
}

const ruleNLabels = (fields) => {
  const out = {};
  for (const id of Object.keys(fields)) out[id] = fields[id][5];
  return out;
};

test("rule N: after seats, each seat keeps its number and the note sitting there carries it", () => {
  for (const [name, text] of RULE_N_SCALES) {
    for (const anchor of RULE_N_ANCHORS) {
      for (const [mirror, mirrorBottom] of RULE_N_MIRRORS) {
        const base = { mirror, mirrorBottom, anchor };
        const seed = freshSeed(text);
        const rings = ringIds(seed.fields);
        const home = plain(HPE.layout.solve(freshSeed(text), base).value.fields);
        for (const ring of RINGS) {
          for (const list of ruleNArrangements(rings[ring].length)) {
            const label = `${name} ${anchor} ${mirror}/${mirrorBottom} ${ring} ${list}`;
            const res = HPE.layout.solve(freshSeed(text), { ...base, seats: { [ring]: list } });
            assert.equal(res.ok, true, label);
            const moved = res.value.fields;
            for (let s = 0; s < rings[ring].length; s += 1) {
              const seatId = rings[ring][s];
              const sitting = Object.keys(moved).find((id) => moved[id][3] === ring
                && moved[id][4] === home[seatId][4]);
              assert.ok(sitting, `${label}: nobody sits at seat ${s}`);
              assert.equal(moved[sitting][5], seed.fields[seatId][5],
                `${label}: the note at seat ${s} carries ${moved[sitting][5]}, not ${seed.fields[seatId][5]}`);
            }
            for (const id of Object.keys(moved)) {
              assert.deepStrictEqual(moved[id].slice(0, 4), seed.fields[id].slice(0, 4), `${label} #${id}`);
            }
          }
        }
      }
    }
  }
});

test("rule N: mirrors and orientation change no label", () => {
  for (const [name, text] of RULE_N_SCALES) {
    const rings = ringIds(freshSeed(text).fields);
    const seats = {};
    for (const ring of RINGS) {
      const lists = ruleNArrangements(rings[ring].length);
      if (lists.length) seats[ring] = lists[1];
    }
    const want = ruleNLabels(HPE.layout.solve(freshSeed(text), { seats }).value.fields);
    for (const anchor of RULE_N_ANCHORS) {
      for (const [mirror, mirrorBottom] of RULE_N_MIRRORS) {
        const got = ruleNLabels(HPE.layout.solve(freshSeed(text), { mirror, mirrorBottom, anchor, seats }).value.fields);
        assert.deepStrictEqual(got, want, `${name} ${anchor} ${mirror}/${mirrorBottom}`);
      }
    }
  }
});

const RULE_N_NO_SEATS = {
  "D3 example one false/false": "25ac5a7c09cd908b",
  "D3 example one true/true": "f675f30395520a1c",
  "D3 example between false/false": "8f7bf228071c4263",
  "D3 example between true/true": "046adf1ebce7ffd9",
  "D Kurd 10 one false/false": "bb40d40871ccbaa8",
  "D Kurd 10 one true/true": "3393bf5408748c94",
  "D Kurd 10 between false/false": "67640a0ffec2c92c",
  "D Kurd 10 between true/true": "633dae4764b43080",
  "F3 Low Pygmy one false/false": "7f4f6b8e4a128a15",
  "F3 Low Pygmy one true/true": "fa2e9b7d48c1e768",
  "F3 Low Pygmy between false/false": "65909a1b9132c2da",
  "F3 Low Pygmy between true/true": "3a2444569d85577d",
};

test("rule N: with no seats every column of every field is what main solved", () => {
  const crypto = require("node:crypto");
  const got = {};
  for (const [name, text] of RULE_N_SCALES) {
    for (const anchor of RULE_N_ANCHORS) {
      for (const both of [false, true]) {
        const fields = HPE.layout.solve(freshSeed(text), { mirror: both, mirrorBottom: both, anchor }).value.fields;
        got[`${name} ${anchor} ${both}/${both}`] = crypto.createHash("sha256")
          .update(JSON.stringify(fields)).digest("hex").slice(0, 16);
      }
    }
  }
  assert.deepStrictEqual(got, RULE_N_NO_SEATS);
});

test("rule N: solve reads labels from its input and never from its own output", () => {
  const seed = freshSeed(RULE_N_SCALES[2][1]);
  for (const id of Object.keys(seed.fields)) seed.fields[id][5] = `x${id}`;
  const before = plain(seed.fields);
  const rings = ringIds(seed.fields);
  const seats = {};
  for (const ring of RINGS) {
    const lists = ruleNArrangements(rings[ring].length);
    if (lists.length) seats[ring] = lists[1];
  }
  const res = HPE.layout.solve(seed, { seats });
  assert.equal(res.ok, true);
  assert.deepStrictEqual(plain(seed.fields), before, "solve wrote into its input");
  for (const ring of RINGS) {
    const list = seats[ring];
    if (!list) continue;
    for (let i = 0; i < list.length; i += 1) {
      assert.equal(res.value.fields[rings[ring][i]][5], before[rings[ring][list[i]]][5],
        `${ring} note ${i} did not take the label of seat ${list[i]} from the input`);
    }
  }
});
