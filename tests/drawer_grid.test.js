// Lane DR1, plan section 20.16: the drawer's geometry rule (rule G), proved by
// enumeration. Four tests, one browser. The cells are a fixed list; every
// expectation is computed from the page's own measurements and the only pixel
// figure held is 44 (one control). Failures name the cell and the clause.
//
// Rule G (plan 20.16): with the drawer open, at every window size, on Add and
// Edit, keyboard up or down, before and after a resize:
//   G-a  the band is stuck only while scrollport height - band height >= 44
//   G-b  scroll-padding-top equals the band height while stuck, else 0
//   G-c  after a real Tab every stop is inside the scrollport and clear of a
//        stuck band (a stop taller than its room: its top is in view below it)
//   G-d  keyboard up: a focused text field shows as much open as closed
//   G-e  G-a and G-b are recomputed when the scrollport or the band resizes
//   G-f  the toggle is in view after the drawer opens
//   G-layout  the landscape two-column layout keeps the padding at 0
//   G-floor  a scrollport under 44 px is held to G-a, G-b and G-d only

const { test, before, after, afterEach } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { launch, findBrowser, assertNoUncaught } = require("./helpers/cdp.js");

const REPO = path.resolve(__dirname, "..");
const ONE_CONTROL = 44;
const SCALES = {
  n9: "[C3] (D3) A3 C4 D4 E4 F4 G4 A4",
  n19: "[C3] [Db3] [Eb3] F3 | G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 Bb4 C5 Eb5 | F5 G5 [Ab5]",
};
const WIDTHS = [320, 380, 500, 844];
const HEIGHTS = [390, 480, 553, 667, 780];
const NEIGHBOURS = [[559, 520], [560, 520], [560, 521], [639, 700], [640, 699]];
const KEYBOARDS = [291, 395];

const BROWSER = findBrowser();
if (!BROWSER) {
  const why = "drawer_grid skipped: no Chromium binary found (set CHROME_BIN to enable). " +
    "This is not a failure - see tests/CONTRACT.md.";
  console.log(why);
  test.skip(why, () => {});
} else {
  run();
}

const PAGE = `
window.__d = (() => {
  const sp = () => document.querySelector("#scale-sheet .sheetbody");
  const band = () => document.getElementById("scale-plate-band");
  const r1 = (x) => Math.round(x * 10) / 10;
  const label = (el) => !el ? null : el.id || (el.parentElement && el.parentElement.id
    ? el.parentElement.id + "[" + [...el.parentElement.children].indexOf(el) + "]" : el.tagName);
  const unsticks = (el) => !!el && el.matches("input, textarea, select, #scale-swatches button");
  function vis(el) {
    const s = sp(), sr = s.getBoundingClientRect(), r = el.getBoundingClientRect();
    let lo = Math.max(r.top, 0), hi = Math.min(r.bottom, window.visualViewport.height);
    if (s.contains(el)) { lo = Math.max(lo, sr.top); hi = Math.min(hi, sr.bottom); }
    if (hi <= lo) return 0;
    const b = band();
    if (b && !b.contains(el) && s.contains(el) && getComputedStyle(b).position === "sticky") {
      const br = b.getBoundingClientRect();
      if (br.right > r.left + 1 && br.left < r.right - 1 && br.bottom > lo && br.top < hi) {
        const above = Math.max(0, Math.min(hi, br.top) - lo), below = Math.max(0, hi - Math.max(lo, br.bottom));
        return r1(Math.max(above, below));
      }
    }
    return r1(hi - lo);
  }
  function state() {
    const s = sp(), sr = s.getBoundingClientRect(), b = band(), br = b.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(s).scrollPaddingTop);
    return { room: sr.height, spTop: sr.top, spBottom: sr.bottom, bandH: br.height, bandBottom: br.bottom,
      pos: getComputedStyle(b).position, pad: Number.isFinite(pad) ? pad : 0,
      open: document.getElementById("scale-layout-zone").classList.contains("open"),
      twoCol: matchMedia("(max-height:520px) and (min-width:560px)").matches,
      textFocus: unsticks(document.activeElement), scrollTop: s.scrollTop, sh: s.scrollHeight, ch: s.clientHeight };
  }
  function at(el) {
    const s = sp(), r = el.getBoundingClientRect();
    return { id: label(el), inBody: s.contains(el), inBand: band().contains(el), h: r.height, top: r.top,
      bottom: r.bottom, vis: vis(el), st: state() };
  }
  return { state, at, vis, label, sp };
})(); return true;`;

function run() {
  let server = null;
  let url = "";
  let b = null;

  before(async () => {
    server = http.createServer((req, res) => {
      fs.readFile(path.join(REPO, "index.html"), (err, buf) => {
        if (err) { res.writeHead(404).end(); return; }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(buf);
      });
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    url = `http://127.0.0.1:${server.address().port}/index.html`;
    b = await launch();
    await b.setViewport(900, 900, false);
    await b.goto(url);
  });

  after(async () => {
    if (b) await b.close();
    if (server) await new Promise((r) => server.close(r));
  });

  afterEach(() => assertNoUncaught());

  const ev = (s) => b.eval(s);
  const frames = () => ev(`return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));`);
  const waitSheet = (shown) => b.waitFor(
    `document.getElementById("scale-sheet").hasAttribute("hidden") === ${!shown}`, { label: "the sheet" });
  const typeBox = (s) => ev(`const el = document.getElementById("scale-box"); el.value = ${JSON.stringify(s)};
    el.dispatchEvent(new Event("input", { bubbles: true })); return el.value;`);

  const generateDeck = async (scale) => {
    await b.setViewport(380, 780, true);
    await ev(`try { localStorage.clear(); } catch (e) {} return true;`);
    await b.goto(url);
    await ev(`document.getElementById("deck-add").click(); return true;`);
    await waitSheet(true);
    await typeBox(scale);
    assert.ok(await ev(`const g = document.getElementById("scale-generate"); const ok = !g.disabled; g.click(); return ok;`),
      "the scale was refused");
    await waitSheet(false);
  };

  // A page at a size with the sheet open on Add (the scale typed) or on Edit
  // (the stored deck), keyboard down, drawer closed.
  const openCell = async (w, h, sheet, scale) => {
    await b.clearKeyboard().catch(() => {});
    await b.setViewport(w, h, true);
    await b.goto(url);
    await b.setViewport(w, h, true);
    await ev(PAGE);
    if (sheet === "add") {
      await ev(`document.getElementById("deck-add").click(); return true;`);
      await waitSheet(true);
      await typeBox(scale);
    } else {
      await ev(`document.querySelector("#decks .chip.on").click(); return true;`);
      await waitSheet(true);
    }
    await frames();
  };
  const openDrawerNow = async () => {
    await ev(`__d.sp().scrollTop = 0; const t = document.getElementById("scale-layout-toggle"); t.focus(); t.click(); return true;`);
    await frames();
  };

  /* ---- the rule, as assertions over one measurement ---- */
  const ROOM = (st) => st.room - (st.pos === "sticky" ? st.bandH : 0);
  const stuckExpected = (st) => st.room - st.bandH >= ONE_CONTROL;

  // G-a, G-b (and G-layout). `strict`: nothing text-like is focused, so the
  // band's stickiness is decided by room alone; with a text field focused the
  // band is static by the page's own focus rule and only "not stuck" can hold.
  function checkAB(fail, st) {
    if (!st.open) return fail("open", "the zone is not open");
    if (st.twoCol) {
      if (st.pad > 0.5) fail("G-layout", `two columns keep the padding at 0, it is ${st.pad}`);
      return null;
    }
    const stuck = st.pos === "sticky";
    if (st.textFocus) {
      if (stuck) fail("G-a", "the band stayed stuck under a focused text field");
    } else if (stuck !== stuckExpected(st)) {
      fail("G-a", `${stuck ? "stuck" : "not stuck"} with scrollport ${st.room.toFixed(1)} and band ${st.bandH.toFixed(1)} ` +
        `(window ${(st.room - st.bandH).toFixed(1)}, ${ONE_CONTROL} needed)`);
    }
    const want = stuck ? st.bandH : 0;
    if (Math.abs(st.pad - want) > 1) fail("G-b", `scroll-padding-top ${st.pad} while ${stuck ? "stuck with band " + st.bandH.toFixed(1) : "not stuck"}`);
    return stuck;
  }

  // G-c over one measured Tab stop.
  function checkC(fail, a) {
    if (!a.inBody || a.inBand) return;
    const st = a.st;
    const band = st.pos === "sticky" && !st.twoCol ? st.bandH : 0;
    const bandBottom = st.pos === "sticky" ? st.bandBottom : st.spTop;
    const avail = st.room - band;
    const tall = a.h > avail + 0.5;
    if (!tall) {
      if (a.vis < a.h - 1) fail("G-c", `#${a.id} shows ${a.vis} of ${a.h.toFixed(1)}px (top ${a.top.toFixed(1)}, scrollport ${st.spTop.toFixed(1)} to ${st.spBottom.toFixed(1)}, ${st.pos}, band ${st.bandH.toFixed(1)}, pad ${st.pad}, scrollTop ${st.scrollTop}, scrollHeight ${st.sh}, clientHeight ${st.ch})`);
    } else if (!(a.top >= Math.max(st.spTop, bandBottom) - 1 && a.top < st.spBottom)) {
      fail("G-c", `tall #${a.id} (${a.h.toFixed(1)}px) has its top at ${a.top.toFixed(1)}, scrollport ${st.spTop.toFixed(1)} to ${st.spBottom.toFixed(1)}, band bottom ${bandBottom.toFixed(1)}`);
    }
  }

  const tabWalk = async (fail) => {
    await ev(`__d.sp().scrollTop = 0; document.getElementById("scale-back").focus(); return true;`);
    const seen = [];
    for (let i = 0; i < 45; i++) {
      await b.key("Tab", "Tab", 9);
      const a = await ev(`const a = document.activeElement; if (!a || a.id === "scale-back") return null; return __d.at(a);`);
      if (!a) break;
      seen.push(a.id);
      checkAB(fail, a.st);
      checkC(fail, a);
    }
    return seen;
  };

  const report = (name, fails, extra) => {
    const by = {};
    for (const f of fails) (by[f.clause] = by[f.clause] || []).push(f);
    const lines = Object.keys(by).sort().map((c) =>
      `${c}: ${by[c].length} (e.g. ${by[c][0].cell}: ${by[c][0].detail}; cells ${[...new Set(by[c].map((f) => f.cell))].slice(0, 8).join(" | ")})`);
    assert.strictEqual(fails.length, 0, `${name}: ${fails.length} failures\n  ${lines.join("\n  ")}${extra || ""}`);
  };

  /* ---- keyboard-up reading of a text field (G-d) ---- */
  const kbReading = async (field, kb, h, ch) => {
    await b.clearKeyboard();
    await ev(`document.activeElement && document.activeElement.blur(); __d.sp().scrollTop = 0; return true;`);
    const val = await ev(`return document.getElementById(${JSON.stringify(field)}).value;`);
    await b.fakeKeyboard(h - kb);
    await ev(`document.getElementById(${JSON.stringify(field)}).focus(); return true;`);
    await frames();
    const focused = await ev(`return __d.at(document.getElementById(${JSON.stringify(field)}));`);
    await b.send("Input.insertText", { text: ch });
    await frames();
    const typed = await ev(`return __d.at(document.getElementById(${JSON.stringify(field)}));`);
    await ev(`const e = document.getElementById(${JSON.stringify(field)}); e.value = ${JSON.stringify(val)};
      e.dispatchEvent(new Event("input", { bubbles: true })); e.blur(); return true;`);
    await b.clearKeyboard();
    await frames();
    return { focused, typed };
  };

  test("DR1 rule G grid: stuck, padding, Tab stops, toggle in view and keyboard-up fields hold at every cell", async () => {
    const fails = [];
    const floorCells = [];
    const stuckSeen = { add: { yes: 0, no: 0 }, edit: { yes: 0, no: 0 } };
    const sizes = [];
    for (const w of WIDTHS) for (const h of HEIGHTS) sizes.push([w, h]);
    for (const n of NEIGHBOURS) sizes.push(n);
    try {
      for (const [sk, scale] of Object.entries(SCALES)) {
        await generateDeck(scale);
        for (const [w, h] of sizes) for (const sheet of ["add", "edit"]) {
          const cell = `${sk} ${w}x${h} ${sheet}`;
          const fail = (clause, detail) => fails.push({ cell, clause, detail });
          try {
            await openCell(w, h, sheet, scale);
            const fields = sheet === "edit" ? ["scale-box", "scale-name"] : ["scale-box"];
            const ch = (f) => (f === "scale-box" ? " " : "x");
            const closed = {};
            if (h >= 553) {
              for (const kb of KEYBOARDS) for (const f of fields) closed[kb + f] = await kbReading(f, kb, h, ch(f));
            }
            await openDrawerNow();
            const open = await ev(`return { toggle: __d.at(document.getElementById("scale-layout-toggle")), st: __d.state() };`);
            const floor = open.st.room < ONE_CONTROL;
            if (floor) floorCells.push(cell);
            const stuck = checkAB(fail, open.st);
            if (!open.st.twoCol && !floor) stuckSeen[sheet][stuck ? "yes" : "no"] += 1;
            if (!floor) checkC((c, d) => fail(c === "G-c" ? "G-f" : c, d), open.toggle);
            if (!floor) await tabWalk(fail);
            if (h >= 553) {
              for (const kb of KEYBOARDS) for (const f of fields) {
                await ev(`__d.sp().scrollTop = 0; return true;`);
                await b.clearKeyboard();
                await ev(`document.activeElement && document.activeElement.blur(); return true;`);
                const r = await kbReading(f, kb, h, ch(f));
                const c = closed[kb + f];
                const sub = `${cell} kb${kb} ${f}`;
                if (r.focused.vis < c.focused.vis - 0.5) fails.push({ cell: sub, clause: "G-d", detail: `focus shows ${r.focused.vis}, closed shows ${c.focused.vis}` });
                if (r.typed.vis < c.typed.vis - 0.5) fails.push({ cell: sub, clause: "G-d", detail: `typed shows ${r.typed.vis}, closed shows ${c.typed.vis}` });
                if (r.focused.st.room < ONE_CONTROL) floorCells.push(sub);
                for (const m of [r.focused, r.typed]) {
                  if (m.st.twoCol) continue;
                  if (m.st.pos === "sticky") fails.push({ cell: sub, clause: "G-a", detail: "stuck under a focused text field" });
                  if (m.st.pad > 0.5) fails.push({ cell: sub, clause: "G-b", detail: `padding ${m.st.pad} under a focused text field` });
                }
              }
            }
          } catch (e) {
            fail("error", String(e && e.message || e));
            await b.clearKeyboard().catch(() => {});
          }
        }
      }
    } finally {
      await b.clearKeyboard().catch(() => {});
      await b.setViewport(900, 900, false);
    }
    console.log(`DR1 grid: ${floorCells.length} G-floor cells held to G-a, G-b and G-d only: ${floorCells.join(", ") || "none"}`);
    for (const sheet of ["add", "edit"]) {
      if (!(stuckSeen[sheet].yes > 0 && (sheet === "add" || stuckSeen[sheet].no > 0))) {
        fails.push({ cell: sheet, clause: "vacuous", detail: `${JSON.stringify(stuckSeen[sheet])} one-column cells stuck / not stuck` });
      }
    }
    report("rule G grid", fails);
  });

  test("DR1 rule G by resize: open on Edit, rotate in either direction, and the band and padding follow", async () => {
    const fails = [];
    try {
      await generateDeck(SCALES.n19);
      for (const [from, to] of [[[667, 375], [375, 667]], [[375, 667], [667, 375]]]) {
        const cell = `${from.join("x")} to ${to.join("x")}`;
        const fail = (clause, detail) => fails.push({ cell, clause, detail });
        await openCell(from[0], from[1], "edit", SCALES.n19);
        await openDrawerNow();
        checkAB(fail, await ev(`return __d.state();`));
        await b.setViewport(to[0], to[1], true);
        await frames();
        checkAB(fail, await ev(`return __d.state();`));
        await tabWalk(fail);
      }
      {
        // Band only: its status line grows with nothing else repainted.
        const cell = "380x780 status line grows";
        const fail = (clause, detail) => fails.push({ cell, clause, detail });
        await openCell(380, 780, "edit", SCALES.n19);
        await openDrawerNow();
        const before = await ev(`return __d.state();`);
        checkAB(fail, before);
        await ev(`document.getElementById("scale-drawer-status").textContent = "A long line of status text. ".repeat(40); return true;`);
        await frames();
        const after = await ev(`return __d.state();`);
        checkAB(fail, after);
        if (after.bandH - before.bandH < 40) fail("vacuous", `the band grew only ${before.bandH} to ${after.bandH}`);
        if (Math.abs(after.room - before.room) > 1) fail("vacuous", `the scrollport changed too: ${before.room} to ${after.room}`);
        if (before.pos !== "sticky" || after.pos === "sticky") fail("vacuous", `stuck did not flip: ${before.pos} to ${after.pos}`);
      }
      {
        // Keyboard only: the band keeps its height, the scrollport shrinks under it.
        const cell = "380x780 keyboard up, nothing focused";
        const fail = (clause, detail) => fails.push({ cell, clause, detail });
        await openCell(380, 780, "edit", SCALES.n19);
        await openDrawerNow();
        const before = await ev(`return __d.state();`);
        checkAB(fail, before);
        const vv = Math.round(before.bandH + 30 + 140 + 8);
        await b.fakeKeyboard(vv);
        await frames();
        const after = await ev(`return __d.state();`);
        await b.clearKeyboard();
        checkAB(fail, after);
        if (Math.abs(after.bandH - before.bandH) > 1) fail("vacuous", `the band changed too: ${before.bandH} to ${after.bandH}`);
        if (before.pos !== "sticky" || after.pos === "sticky") fail("vacuous", `stuck did not flip: ${before.pos} to ${after.pos} with scrollport ${before.room} to ${after.room}`);
      }
    } finally {
      await b.setViewport(900, 900, false);
    }
    report("rule G by resize", fails);
  });

  test("DR1 rule G boundary walk: stepping the height 1px at a time, stuck flips exactly where the window reaches 44", async () => {
    const fails = [];
    const note = [];
    try {
      await generateDeck(SCALES.n19);
      for (const w of WIDTHS) {
        await openCell(w, 480, "edit", SCALES.n19);
        await openDrawerNow();
        const seen = { yes: 0, no: 0 };
        let oneColumn = true;
        for (let h = 480; h <= 640; h++) {
          await b.setViewport(w, h, true);
          await frames();
          const st = await ev(`return __d.state();`);
          if (st.twoCol) { oneColumn = false; continue; }
          const stuck = checkAB((c, d) => fails.push({ cell: `${w}x${h}`, clause: c, detail: d }), st);
          seen[stuck ? "yes" : "no"] += 1;
        }
        note.push(`${w}: ${JSON.stringify(seen)}`);
        if (oneColumn && !(seen.yes > 0 && seen.no > 0)) {
          fails.push({ cell: `${w}x480-640`, clause: "G-a", detail: `the walk never crossed the threshold: ${JSON.stringify(seen)}` });
        }
      }
    } finally {
      await b.setViewport(900, 900, false);
    }
    report("rule G boundary walk", fails, `\n  ${note.join("; ")}`);
  });
}
