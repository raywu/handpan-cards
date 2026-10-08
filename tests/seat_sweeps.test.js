// DR2a rule W sweeps, moved unchanged out of tests/app.test.js (plan 20.20 N1):
// the six sweep tests took about 42 s of that file's 55 s. The helpers below
// are copies of the ones app.test.js keeps for the rest of DR2a's unit layer.
const { test } = require("node:test");
const assert = require("node:assert");
const { boot } = require("./helpers/sandbox.js");

function openSheet(app) {
  app.els["deck-add"].click();
  return app.els;
}
function makeCustom(app, text) {
  openSheet(app);
  app.type(text);
  app.els["scale-generate"].click();
  return app.registry()[app.deckId()];
}
function openEdit(app, d) {
  app.select(d.id);
  app.clickChip(d.name);
}

const D2_NAT = ["C", "D", "E", "F", "G", "A", "B"];
/** n natural notes from `start` ("E3") upward. */
function d2Nat(start, n) {
  let i = D2_NAT.indexOf(start[0]);
  let oct = Number(start.slice(1));
  const out = [];
  for (let k = 0; k < n; k += 1) {
    out.push(D2_NAT[i] + oct);
    i += 1;
    if (i === 7) { i = 0; oct += 1; }
  }
  return out;
}
/** The scale with `sz` notes in each ring, and the note names of each ring in
 *  ascending order (which is the order of the ring's permutation). */
function d2Build(sz) {
  const bottom = d2Nat("C1", sz.bottom);
  const rim = d2Nat("E3", sz.rim);
  const inner = rim.length ? d2Nat(rim[rim.length - 1], sz.inner + 1).slice(1) : d2Nat("E3", sz.inner);
  const parts = [...bottom.map((n) => `[${n}]`), "(A2)", ...rim];
  if (inner.length) parts.push("|", ...inner);
  return { text: parts.join(" "), names: { rim, inner, bottom } };
}
const D2_RINGS = ["rim", "inner", "bottom"];
const d2Sizes = (ring, n) => ({ rim: 3, inner: 3, bottom: 3, [ring]: n });
const d2Id = (n) => Array.from({ length: n }, (_, i) => i);
function d2Open(app, text, edit) {
  if (edit) openEdit(app, makeCustom(app, text));
  else { openSheet(app); app.type(text); }
  app.els["scale-layout-toggle"].click();
}
const d2Hit = (app, name) => {
  const h = app.hits().find((n) => String(n.getAttribute("aria-label")).startsWith(name + ","));
  assert.ok(h, `no hit target for ${name}`);
  return h;
};
/** A pointer tap: the press focuses the note, then the click arrives. */
const d2Tap = (app, name) => { const h = d2Hit(app, name); h.focus(); app.click(h); };
const d2Key = (app, name, key) => { const h = d2Hit(app, name); h.focus(); return app.press(h, key); };
const d2Seats = (app) => JSON.parse(app.get("JSON.stringify(layoutSeats)"));
const d2Pick = (app) => JSON.parse(app.get("JSON.stringify(pickRef)"));
const d2Status = (app) => app.els["scale-drawer-status"].textContent;
const d2Norm = (seats) => {
  const out = {};
  for (const r of D2_RINGS) {
    const l = seats && seats[r];
    if (l && l.some((s, i) => s !== i)) out[r] = l;
  }
  return Object.keys(out).length ? out : null;
};
const d2Seed = (app, seats) => {
  app.run(`setPick(null); layoutSeats = ${JSON.stringify(seats)}; resyncSheet(true)`);
};
/** The model of an exchange: the notes at list[i] and list[j] trade seats. */
const d2Exchange = (list, i, j) => { const l = list.slice(); [l[i], l[j]] = [l[j], l[i]]; return l; };
const d2Starts = (k) => {
  const out = [["default", d2Id(k)]];
  out.push(["exchange", d2Exchange(d2Id(k), 0, 1)]);
  if (k >= 3) out.push(["cycle", d2Id(k).map((i) => (i < 3 ? (i + 1) % 3 : i))]);
  return out;
};
const D2_OTHER = [1, 0, 2];
function d2Case(ring, n, start, edit) {
  const app = boot();
  const sc = d2Build(d2Sizes(ring, n));
  d2Open(app, sc.text, edit);
  const seats = {};
  for (const r of D2_RINGS) seats[r] = r === ring ? start : D2_OTHER;
  d2Seed(app, seats);
  return { app, sc, seats };
}
const d2AllRings = [["rim", 20], ["inner", 8], ["bottom", 8]];

for (const edit of [false, true]) {
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
              `^Swapped ${names[i]} and ${names[j]}\\. ${names[i]} is now in ${ring} seat ${t + 1} of ${n}, [a-z ]+\\.$`), ctx);
          }
        }
      }
    }
  });
}

// Lane DR2b: the drag rows of rules W and R, same sweep as the taps above.
const DG = require("./helpers/drag.js");

for (const edit of [false, true]) {
  const where = edit ? "Edit" : "Add";

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
