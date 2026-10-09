// DR2a rule W tap sweep and the DR2b drag sweeps, Edit (plan 20.22 step 7).
const { test } = require("node:test");
const assert = require("node:assert");
const { boot } = require("./helpers/sandbox.js");
const { openSheet, makeCustom, openEdit, D2_NAT, d2Nat, d2Build, D2_RINGS, d2Sizes, d2Id, d2Open, d2Hit, d2Tap, d2Key, d2Seats, d2Pick, d2Status, d2Norm, d2Seed, d2Exchange, d2Starts, D2_OTHER, d2Case, d2AllRings } = require("./helpers/seat_sweep_common.js");
const DG = require("./helpers/drag.js");

for (const edit of [true]) {
  const where = edit ? "Edit" : "Add";

  test(`DR2a rule W (78, 52, 53, 41, 42): tap then tap exchanges exactly two notes, ring sizes swept, ${where}`, () => {
    for (const [ring, max] of d2AllRings) {
      for (let n = 2; n <= max; n += 1) {
        for (const [label, start] of d2Starts(n)) {
          const { app, sc, seats } = d2Case(ring, n, start, edit);
          const names = sc.names[ring];
          for (let a = 0; a < n; a += 1) for (let b = 0; b < n; b += 1) {
            d2Seed(app, seats);
            const i = start.indexOf(a), j = start.indexOf(b);
            d2Tap(app, names[i]); d2Tap(app, names[j]);
            const want = a === b ? start : d2Exchange(start, i, j);
            const ctx = `${ring} k=${n} ${label} seat ${a}->${b}`;
            assert.deepStrictEqual(d2Norm(d2Seats(app)), d2Norm({ ...seats, [ring]: want }), ctx);
            assert.strictEqual(d2Pick(app), null, `${ctx}: the pick did not end`);
            const ok = JSON.parse(app.get(`JSON.stringify(HPE.layout.readSeats(layoutSeats, ${JSON.stringify(d2Sizes(ring, n))}))`));
            assert.strictEqual(ok.ok, true, `${ctx}: readSeats refuses it`);
            if (a !== b) assert.match(d2Status(app), new RegExp(
              `^Swapped ${names[i]} and ${names[j]}\\. ${names[i]} is now in ${ring} seat ${b + 1} of ${n}, [a-z ]+\\.$`), ctx);
            else assert.match(d2Status(app), new RegExp(`^${names[i]} stays in ${ring} seat ${a + 1} of ${n}\\.$`), ctx);
          }
        }
      }
    }
  });

  test(`DR2b rule W and R (78, 41, 42): a mouse drag exchanges exactly two notes and readSeats accepts it, ring sizes swept, ${where}`, () => {
    for (const [ring, max] of [["rim", 10], ["inner", 8], ["bottom", 8]]) {
      for (let n = 2; n <= max; n += 1) {
        for (const [label, start] of d2Starts(n)) {
          const { app, sc, seats } = d2Case(ring, n, start, edit);
          const names = sc.names[ring];
          for (let a = 0; a < n; a += 1) for (let b = 0; b < n; b += 1) {
            d2Seed(app, seats);
            const i = start.indexOf(a), j = start.indexOf(b);
            DG.mouseDrag(app, names[i], names[j]);
            const want = a === b ? start : d2Exchange(start, i, j);
            const ctx = `${ring} k=${n} ${label} seat ${a}->${b}`;
            assert.deepStrictEqual(d2Norm(d2Seats(app)), d2Norm({ ...seats, [ring]: want }), ctx);
            const ok = JSON.parse(app.get(`JSON.stringify(HPE.layout.readSeats(layoutSeats, ${JSON.stringify(d2Sizes(ring, n))}))`));
            assert.strictEqual(ok.ok, true, `${ctx}: readSeats refuses it`);
            assert.deepStrictEqual(app.hits().map((h) => h.getAttribute("aria-label").split(",")[0]).sort(), [...sc.names.rim, ...sc.names.inner, ...sc.names.bottom].sort(), `${ctx}: the plate lost a note`);
            if (a !== b) {
              assert.strictEqual(d2Pick(app), null, `${ctx}: the pick did not end`);
              assert.match(d2Status(app), new RegExp(
                `^Swapped ${names[i]} and ${names[j]}\\. ${names[i]} is now in ${ring} seat ${b + 1} of ${n}, [a-z ]+\\.$`), ctx);
            } else {
              assert.deepStrictEqual(d2Pick(app), { ring, i }, `${ctx}: the note is not still picked`);
              assert.match(d2Status(app), new RegExp(`^${names[i]} stays in ${ring} seat ${a + 1} of ${n}\\.$`), ctx);
            }
          }
        }
      }
    }
  });

  test(`DR2b rule W and R (78, 41, 42): a touch drag exchanges exactly two notes for every ring size, ${where}`, () => {
    for (const [ring, max] of d2AllRings) {
      for (let n = 2; n <= max; n += 1) {
        const sc = d2Build(d2Sizes(ring, n));
        const app = boot({ clock: true });
        d2Open(app, sc.text, edit);
        const names = sc.names[ring];
        const seats = { rim: D2_OTHER, inner: D2_OTHER, bottom: D2_OTHER, [ring]: d2Id(n) };
        for (const [a, b] of [[0, n - 1], [n - 1, 0], [0, 1]]) {
          d2Seed(app, seats);
          DG.touchDrag(app, names[a], names[b]);
          const ctx = `${ring} k=${n} ${a}->${b}`;
          assert.deepStrictEqual(d2Norm(d2Seats(app)), d2Norm({ ...seats, [ring]: d2Exchange(d2Id(n), a, b) }), ctx);
          const ok = JSON.parse(app.get(`JSON.stringify(HPE.layout.readSeats(layoutSeats, ${JSON.stringify(d2Sizes(ring, n))}))`));
          assert.strictEqual(ok.ok, true, ctx);
        }
      }
    }
  });
}
