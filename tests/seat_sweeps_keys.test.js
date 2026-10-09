// DR2a rule W key and seat-button sweeps, Add and Edit (plan 20.22 step 7).
const { test } = require("node:test");
const assert = require("node:assert");
const { boot } = require("./helpers/sandbox.js");
const { openSheet, makeCustom, openEdit, D2_NAT, d2Nat, d2Build, D2_RINGS, d2Sizes, d2Id, d2Open, d2Hit, d2Tap, d2Key, d2Seats, d2Pick, d2Status, d2Norm, d2Seed, d2Exchange, d2Starts, D2_OTHER, d2Case, d2AllRings } = require("./helpers/seat_sweep_common.js");
const DG = require("./helpers/drag.js");

/** The number the plate draws in seat k of a ring: the default label (rule N). */
const seatLabel = (app, sc, ring, k) => {
  const f = JSON.parse(app.get(`JSON.stringify(HPE.core.parseSeed(${JSON.stringify(sc.text)}, {}).value.fields)`));
  const ids = Object.keys(f).filter((id) => f[id][3] === ring).sort((a, b) => Number(a) - Number(b));
  return f[ids[k]][5];
};

for (const edit of [false]) {
  const where = edit ? "Edit" : "Add";

  test(`DR2a rule W (65, 78): Space and Enter swap the same pairs, ring sizes to 8 swept, ${where}`, () => {
    for (const [ring] of d2AllRings) {
      for (let n = 2; n <= 8; n += 1) {
        for (const [label, start] of d2Starts(n)) {
          const { app, sc, seats } = d2Case(ring, n, start, edit);
          const names = sc.names[ring];
          for (const key of [" ", "Enter"]) for (let a = 0; a < n; a += 1) for (let b = 0; b < n; b += 1) {
            d2Seed(app, seats);
            const i = start.indexOf(a), j = start.indexOf(b);
            d2Key(app, names[i], key); d2Key(app, names[j], key);
            const want = a === b ? start : d2Exchange(start, i, j);
            assert.deepStrictEqual(d2Norm(d2Seats(app)), d2Norm({ ...seats, [ring]: want }),
              `${ring} k=${n} ${label} ${JSON.stringify(key)} ${a}->${b}`);
            assert.strictEqual(d2Pick(app), null);
          }
        }
      }
    }
  });

  test(`DR2a rule W (60, 61): NEXT SEAT and PREVIOUS SEAT swap with the adjacent seat, wrap, keep the pick, every start seat, ${where}`, () => {
    for (const [ring, max] of d2AllRings) {
      for (let n = 2; n <= max; n += 1) {
        for (const [label, start] of d2Starts(n)) {
          const { app, sc, seats } = d2Case(ring, n, start, edit);
          const names = sc.names[ring];
          for (let s = 0; s < n; s += 1) for (const [id, dir] of [["scale-seat-next", 1], ["scale-seat-prev", -1]]) {
            d2Seed(app, seats);
            const i = start.indexOf(s);
            const t = (s + dir + n) % n;
            const j = start.indexOf(t);
            d2Tap(app, names[i]);
            app.els[id].click();
            const ctx = `${ring} k=${n} ${label} seat ${s} ${id}`;
            assert.deepStrictEqual(d2Norm(d2Seats(app)), d2Norm({ ...seats, [ring]: d2Exchange(start, i, j) }), ctx);
            assert.deepStrictEqual(d2Pick(app), { ring, i }, `${ctx}: the pick moved or ended`);
            assert.match(d2Status(app), new RegExp(
              `^Swapped ${names[i]} and ${names[j]}\\. ${names[i]} is now in ${ring} seat ${seatLabel(app, sc, ring, t)}, [a-z ]+\\.$`), ctx);
          }
        }
      }
    }
  });
}

for (const edit of [true]) {
  const where = edit ? "Edit" : "Add";

  test(`DR2a rule W (65, 78): Space and Enter swap the same pairs, ring sizes to 8 swept, ${where}`, () => {
    for (const [ring] of d2AllRings) {
      for (let n = 2; n <= 8; n += 1) {
        for (const [label, start] of d2Starts(n)) {
          const { app, sc, seats } = d2Case(ring, n, start, edit);
          const names = sc.names[ring];
          for (const key of [" ", "Enter"]) for (let a = 0; a < n; a += 1) for (let b = 0; b < n; b += 1) {
            d2Seed(app, seats);
            const i = start.indexOf(a), j = start.indexOf(b);
            d2Key(app, names[i], key); d2Key(app, names[j], key);
            const want = a === b ? start : d2Exchange(start, i, j);
            assert.deepStrictEqual(d2Norm(d2Seats(app)), d2Norm({ ...seats, [ring]: want }),
              `${ring} k=${n} ${label} ${JSON.stringify(key)} ${a}->${b}`);
            assert.strictEqual(d2Pick(app), null);
          }
        }
      }
    }
  });

  test(`DR2a rule W (60, 61): NEXT SEAT and PREVIOUS SEAT swap with the adjacent seat, wrap, keep the pick, every start seat, ${where}`, () => {
    for (const [ring, max] of d2AllRings) {
      for (let n = 2; n <= max; n += 1) {
        for (const [label, start] of d2Starts(n)) {
          const { app, sc, seats } = d2Case(ring, n, start, edit);
          const names = sc.names[ring];
          for (let s = 0; s < n; s += 1) for (const [id, dir] of [["scale-seat-next", 1], ["scale-seat-prev", -1]]) {
            d2Seed(app, seats);
            const i = start.indexOf(s);
            const t = (s + dir + n) % n;
            const j = start.indexOf(t);
            d2Tap(app, names[i]);
            app.els[id].click();
            const ctx = `${ring} k=${n} ${label} seat ${s} ${id}`;
            assert.deepStrictEqual(d2Norm(d2Seats(app)), d2Norm({ ...seats, [ring]: d2Exchange(start, i, j) }), ctx);
            assert.deepStrictEqual(d2Pick(app), { ring, i }, `${ctx}: the pick moved or ended`);
            assert.match(d2Status(app), new RegExp(
              `^Swapped ${names[i]} and ${names[j]}\\. ${names[i]} is now in ${ring} seat ${seatLabel(app, sc, ring, t)}, [a-z ]+\\.$`), ctx);
          }
        }
      }
    }
  });
}
