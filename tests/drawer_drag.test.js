// Lane DR2b: the browser layer of the note drag (spec sections 7, 8; plan
// 20.17). Real mouse and touch input through CDP, real waits for the 250 ms
// hold, real layout for the ghost. The unit layer is the DR2b block at the
// end of tests/app.test.js and the drag rows of tests/seat_sweeps.test.js.
// Expected values are literals written here from the spec, and the drag
// geometry is computed from the circles the plate draws.

const { test, before, after, afterEach } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { launch, findBrowser, assertNoUncaught } = require("./helpers/cdp.js");

const REPO = path.resolve(__dirname, "..");
const SCALES = {
  amara: "(D3) A3 C4 D4 E4 F4 G4 A4 C5",
  kurd: "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5",
  amara10: "(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5",
  hijaz: "(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4",
  pygmy: "[C3] [Db3] [Eb3] F3 | G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]",
};

const BROWSER = findBrowser();
if (!BROWSER) {
  const why = "drawer_drag skipped: no Chromium binary found (set CHROME_BIN to enable). " +
    "This is not a failure - see tests/CONTRACT.md.";
  console.log(why);
  test.skip(why, () => {});
} else {
  run();
}

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
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    url = `http://127.0.0.1:${server.address().port}/index.html`;
    b = await launch();
    await b.setViewport(380, 667, true);
    await b.goto(url);
  });
  after(async () => {
    if (b) await b.close();
    if (server) await new Promise((r) => server.close(r));
  });
  afterEach(() => assertNoUncaught());

  const ev = (s) => b.eval(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const frames = () => ev(`return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));`);
  const typeBox = (s) => ev(`const el = document.getElementById("scale-box"); el.value = ${JSON.stringify(s)};
    el.dispatchEvent(new Event("input", { bubbles: true })); return true;`);
  const waitSheet = (shown) => b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden") === ${!shown}`, { label: "the sheet" });

  const openAdd = async (scale, w = 380, h = 667, mobile = true) => {
    await b.setViewport(w, h, mobile);
    await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
    await ev(`try { localStorage.clear(); } catch (e) {} return true;`);
    await b.goto(url);
    await ev(`document.getElementById("deck-add").click(); return true;`);
    await waitSheet(true);
    await typeBox(scale);
    await ev(`document.getElementById("scale-layout-toggle").click(); return true;`);
    await frames();
  };
  // The drawn state: each note's name, ring, seat centre in the viewBox, and its screen circle.
  const plate = () => ev(`return [...document.querySelectorAll("#scale-preview .panhit")].map((h) => {
    const r = h.getBoundingClientRect();
    return { name: h.getAttribute("aria-label").split(",")[0], ring: h.getAttribute("data-ring"),
      cx: h.getAttribute("cx"), cy: h.getAttribute("cy"), x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, r: (r.right - r.left) / 2 };
  });`);
  const status = () => ev(`return document.getElementById("scale-drawer-status").textContent;`);
  const pickedName = () => ev(`const h = document.querySelector("#scale-preview .panhit[aria-pressed='true']"); return h ? h.getAttribute("aria-label").split(",")[0] : null;`);
  const ghost = () => ev(`const g = document.querySelector(".panghost"); if (!g) return null; const r = g.getBoundingClientRect();
    return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, w: r.width, h: r.height, top: r.top,
      position: getComputedStyle(g).position, inBand: g.parentNode.id, svg: !!g.closest("svg"), pe: getComputedStyle(g).pointerEvents };`);
  const arms = () => ev(`return [...document.querySelectorAll("#scale-preview .panarm")].map((a) => a.getAttribute("cx") + "," + a.getAttribute("cy"));`);

  const mouse = (type, x, y, extra = {}) => b.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, ...extra });
  const mouseDrag = async (from, to) => {
    await mouse("mouseMoved", from.x, from.y, { button: "none", buttons: 0 });
    await mouse("mousePressed", from.x, from.y);
    await mouse("mouseMoved", from.x + 6, from.y);
    await mouse("mouseMoved", (from.x + to.x) / 2, (from.y + to.y) / 2);
    await mouse("mouseMoved", to.x, to.y);
    await mouse("mouseReleased", to.x, to.y);
  };
  const touch = (type, pts) => b.send("Input.dispatchTouchEvent", {
    type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, radiusX: 4, radiusY: 4, force: 1, id: i + 1 })),
  });
  const touchDrag = async (from, to, holdMs = 320) => {
    await touch("touchStart", [from]);
    await sleep(holdMs);

    await touch("touchMove", [{ x: to.x, y: to.y + 36 }]);
    await touch("touchEnd", []);
  };

  const byRing = (all) => {
    const out = {};
    for (const n of all) (out[n.ring] = out[n.ring] || []).push(n);
    return out;
  };
  // Drag `from` onto `to`'s circle and assert the two notes traded seat centres and nothing else moved.
  const dragPairSwaps = async (a, c, how) => {
    const before = await plate();
    const from = before.find((n) => n.name === a), to = before.find((n) => n.name === c);
    if (how === "touch") await touchDrag(from, to); else await mouseDrag(from, to);
    const after = await plate();
    for (const n of before) {
      const m = after.find((x) => x.name === n.name);
      const want = n.name === a ? to : n.name === c ? from : n;
      assert.deepStrictEqual([m.cx, m.cy], [want.cx, want.cy], `${how} ${a} onto ${c}: ${n.name} is not where the exchange puts it`);
    }
    assert.strictEqual(await pickedName(), null, `${a} onto ${c}: still picked`);
    assert.strictEqual(await ghost(), null, `${a} onto ${c}: the ghost stayed`);
  };

  for (const [key, w, h] of [["amara", 380, 667], ["kurd", 380, 667], ["pygmy", 380, 667]]) {
    test(`DR2b browser rule D (41, 42): at ${w}x${h} a real mouse drag swaps every pair of ${key}'s rings`, async () => {
      await openAdd(SCALES[key], w, h);
      const rings = byRing(await plate());
      for (const list of Object.values(rings)) {
        for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
          await dragPairSwaps(list[i].name, list[j].name, "mouse");
        }
      }
    });
  }

  for (const key of ["hijaz", "amara10"]) {
    test(`DR2b browser rule D (41, 42): a real mouse drag swaps one pair per ring of ${key}`, async () => {
      await openAdd(SCALES[key]);
      for (const list of Object.values(byRing(await plate()))) await dragPairSwaps(list[0].name, list[list.length - 1].name, "mouse");
    });
  }

  for (const key of ["kurd", "pygmy"]) {
    test(`DR2b browser rule D (41, 42): at 1280x800 a real mouse drag swaps one pair per ring of ${key}`, async () => {
      await openAdd(SCALES[key], 1280, 800, false);
      for (const list of Object.values(byRing(await plate()))) await dragPairSwaps(list[0].name, list[list.length - 1].name, "mouse");
    });
  }

  test("DR2b browser rule D (41, 42, 47): a real touch hold-and-drag swaps one pair per ring of Pygmy", async () => {
    await openAdd(SCALES.pygmy);
    for (const list of Object.values(byRing(await plate()))) await dragPairSwaps(list[0].name, list[list.length - 1].name, "touch");
  });

  test("DR2b browser (43, 44, 45): own seat, another ring, the ding, empty plate and outside write rows 8, 10 and 11 and move nothing", async () => {
    await openAdd(SCALES.pygmy);
    const all = await plate();
    const rim = all.filter((n) => n.ring === "rim"), bottom = all.find((n) => n.ring === "bottom");
    const seats = () => ev(`return JSON.stringify(layoutSeats);`);
    const s0 = await seats();
    await mouseDrag(rim[0], rim[0]);
    assert.strictEqual(await status(), `${rim[0].name} stays in rim seat 1 of 9.`);
    assert.strictEqual(await pickedName(), rim[0].name);
    await ev(`document.querySelector("#scale-preview .panhit[aria-pressed='true']").dispatchEvent(new MouseEvent("click", { bubbles: true })); return true;`);
    await sleep(450);
    await ev(`document.querySelector("#scale-preview .panhit[aria-pressed='true']").dispatchEvent(new MouseEvent("click", { bubbles: true })); return true;`);
    await mouseDrag(rim[1], bottom);
    assert.strictEqual(await status(), `Not moved. ${rim[1].name} moves only within the rim.`);
    assert.strictEqual(await ev(`return document.getElementById("scale-drawer-status").classList.contains("warn");`), true);
    const ding = await ev(`const r = document.querySelector("#scale-preview svg").getBoundingClientRect(); return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };`);
    const vp = await ev(`return { x: innerWidth - 2, y: 2 };`);
    for (const at of [ding, vp]) {
      await mouseDrag(rim[2], at);
      assert.strictEqual(await status(), `Not moved. Drop ${rim[2].name} on another rim note to swap.`);
      assert.strictEqual(await pickedName(), null);
    }
    assert.strictEqual(await seats(), s0);
  });

  test("DR2b browser (92, 95): the armed seat carries .panarm at 1.12 r with a 2 px orange stroke, nothing is armed elsewhere", async () => {
    await openAdd(SCALES.amara);
    const all = await plate();
    const [a, b2, c] = all;
    await mouse("mouseMoved", a.x, a.y, { button: "none", buttons: 0 });
    await mouse("mousePressed", a.x, a.y);
    await mouse("mouseMoved", a.x + 6, a.y);
    assert.deepStrictEqual(await arms(), []);
    await mouse("mouseMoved", b2.x, b2.y);
    assert.deepStrictEqual(await arms(), [`${b2.cx},${b2.cy}`]);
    const m = await ev(`const q = document.querySelector("#scale-preview .panarm"); const hit = [...document.querySelectorAll("#scale-preview .panhit")].find((h) => h.getAttribute("cx") === q.getAttribute("cx") && h.getAttribute("cy") === q.getAttribute("cy"));
      return { r: Number(q.getAttribute("r")), hr: Number(hit.getAttribute("data-r")), sw: parseFloat(getComputedStyle(q).strokeWidth), stroke: getComputedStyle(q).stroke };`);
    assert.ok(Math.abs(m.r - 1.12 * m.hr) < 0.01, `panarm r ${m.r} vs 1.12 x ${m.hr}`);
    assert.ok(m.sw >= 2, `stroke ${m.sw}px`);
    assert.strictEqual(m.stroke, "rgb(226, 112, 5)");
    await mouse("mouseMoved", c.x, c.y);
    assert.deepStrictEqual(await arms(), [`${c.cx},${c.cy}`]);
    const svg = await ev(`const r = document.querySelector("#scale-preview svg").getBoundingClientRect(); return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };`);
    await mouse("mouseMoved", svg.x, svg.y);
    assert.deepStrictEqual(await arms(), [], "armed over the ding");
    await mouse("mouseMoved", c.x, c.y);
    await mouse("mouseReleased", c.x, c.y);
    assert.deepStrictEqual(await arms(), []);
    assert.match(await status(), new RegExp(`^Swapped ${a.name} and ${c.name}\\.`));
  });

  test("DR2b browser (93, 7): the ghost is position fixed, outside the SVG, pointer-events none, centred on the pointer, and not clipped above the plate", async () => {
    await openAdd(SCALES.amara);
    const all = await plate();
    const top = all.reduce((p, n) => (n.y < p.y ? n : p));
    await mouse("mouseMoved", top.x, top.y, { button: "none", buttons: 0 });
    await mouse("mousePressed", top.x, top.y);
    await mouse("mouseMoved", top.x, top.y - 6);
    const up = { x: top.x, y: top.y - 40 };
    await mouse("mouseMoved", up.x, up.y);
    const g = await ghost();
    assert.ok(g, "no ghost");
    assert.strictEqual(g.position, "fixed");
    assert.strictEqual(g.inBand, "scale-plate-band");
    assert.strictEqual(g.svg, false);
    assert.strictEqual(g.pe, "none");
    assert.ok(Math.abs(g.x - up.x) < 1 && Math.abs(g.y - up.y) < 1, `ghost centre ${g.x},${g.y} vs ${up.x},${up.y}`);
    const bandTop = await ev(`return document.getElementById("scale-plate-band").getBoundingClientRect().top;`);
    assert.ok(g.top < bandTop, `the ghost's top ${g.top} does not rise above the band's ${bandTop}; the case is not exercised`);
    assert.ok(g.w > 20 && Math.abs(g.w - g.h) < 0.5, `ghost box ${g.w}x${g.h}`);
    const hit = await ev(`const e = document.elementFromPoint(${up.x}, ${up.y}); return !!(e && e.classList && e.classList.contains("panghost"));`);
    assert.strictEqual(hit, false, "the ghost takes pointer hits");
    await mouse("mouseReleased", up.x, up.y);
  });

  test("DR2b browser (7): cursors are grab on a note and grabbing during a drag, and the plate cannot select text or call out", async () => {
    await openAdd(SCALES.amara);
    const css = () => ev(`const h = document.querySelector("#scale-preview .panhit"); const p = document.getElementById("scale-preview");
      return { hit: getComputedStyle(h).cursor, plate: getComputedStyle(p).cursor, hitDuring: getComputedStyle(h).cursor,
        us: getComputedStyle(p).userSelect };`);
    const idle = await css();
    assert.strictEqual(idle.hit, "grab");
    assert.strictEqual(idle.us, "none");
    const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "index.html"), "utf8");
    assert.match(src, /-webkit-user-select:\s*none/);
    assert.match(src, /-webkit-touch-callout:\s*none/);
    const [a] = await plate();
    await mouse("mouseMoved", a.x, a.y, { button: "none", buttons: 0 });
    await mouse("mousePressed", a.x, a.y);
    await mouse("mouseMoved", a.x + 8, a.y);
    const during = await css();
    assert.strictEqual(during.hit, "grabbing");
    assert.strictEqual(during.plate, "grabbing");
    await mouse("mouseReleased", a.x + 8, a.y);
    assert.strictEqual((await css()).hit, "grab");
  });

  test("DR2b browser (7): a contextmenu on the plate is prevented while the drawer is open and not after it closes", async () => {
    await openAdd(SCALES.amara);
    const fire = () => ev(`const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true }); document.querySelector("#scale-preview .panhit").dispatchEvent(e); return e.defaultPrevented;`);
    assert.strictEqual(await fire(), true);
    await ev(`document.getElementById("scale-layout-toggle").click(); return true;`);
    assert.strictEqual(await fire().catch(() => false), false);
  });

  test("DR2b browser (46, rule T): an unheld vertical swipe on a note scrolls the sheet, a held touch drag does not", async () => {
    await openAdd(SCALES.pygmy);
    const body = `document.querySelector("#scale-sheet .sheetbody")`;
    const top = () => ev(`return ${body}.scrollTop;`);
    assert.ok(await ev(`return ${body}.scrollHeight > ${body}.clientHeight;`), "the sheet does not scroll at 380x667, so the case is not exercised");
    const rimLast = (await plate()).filter((n) => n.ring === "rim").pop();
    await ev(`${body}.scrollTop = 0; return true;`);
    await touch("touchStart", [rimLast]);
    for (let k = 1; k <= 6; k += 1) { await touch("touchMove", [{ x: rimLast.x, y: rimLast.y - 14 * k }]); await sleep(8); }
    await touch("touchEnd", []);
    await sleep(100);
    assert.ok(await top() > 0, "an unheld swipe did not scroll the sheet");
    assert.strictEqual(await pickedName(), null, "an unheld swipe lifted a note");
    for (let last = -1; ;) { const s = await top(); if (s === last) break; last = s; await sleep(200); }
    await ev(`${body}.scrollTop = 0; return true;`);
    const note = (await plate()).filter((n) => n.ring === "rim").pop();
    await touch("touchStart", [note]);
    await sleep(320);
    for (let k = 1; k <= 6; k += 1) { await touch("touchMove", [{ x: note.x, y: note.y - 14 * k }]); await sleep(8); }
    const during = await top();
    await touch("touchEnd", []);
    await sleep(100);
    assert.strictEqual(during, 0, "the sheet scrolled during a lifted drag");
    assert.strictEqual(await top(), 0);
    await ev(`${body}.scrollTop = 0; return true;`);
    const again = (await plate()).filter((n) => n.ring === "rim").pop();
    await touch("touchStart", [again]);
    await sleep(100);
    await touch("touchMove", [{ x: again.x + 4, y: again.y }]);
    await sleep(220);
    assert.ok(await ghost(), "a move under 8 px during the hold did not lift the note");
    for (let k = 1; k <= 6; k += 1) { await touch("touchMove", [{ x: again.x, y: again.y - 14 * k }]); await sleep(8); }
    const duringB = await top();
    await touch("touchEnd", []);
    await sleep(100);
    assert.strictEqual(duringB, 0, "the sheet scrolled during a drag after a sub-8 px move in the hold");
  });

  test("DR2b browser (47): a touch hold shows the ghost 36 px above the finger and a second touch cancels it", async () => {
    await openAdd(SCALES.amara);
    const [a] = await plate();
    await touch("touchStart", [a]);
    await sleep(320);
    const g = await ghost();
    assert.ok(g, "no ghost after the hold");
    assert.ok(Math.abs(g.x - a.x) < 1 && Math.abs(g.y - (a.y - 36)) < 1, `ghost centre ${g.x},${g.y} vs ${a.x},${a.y - 36}`);
    assert.strictEqual(g.position, "fixed");
    await touch("touchStart", [a, { x: a.x + 30, y: a.y + 30 }]);
    await sleep(50);
    assert.strictEqual(await ghost(), null, "the second touch left the ghost");
    await touch("touchEnd", []);
    assert.strictEqual(await ev(`return JSON.stringify(layoutSeats);`), "null");
  });

  for (const reduced of [false, true]) {
    test(`DR2b browser (77): a refused drop ${reduced ? "removes the ghost at once under reduced motion" : "returns the ghost over 120 ms"}`, async () => {
      await openAdd(SCALES.amara);
      await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }] });
      const [a] = await plate();
      const empty = await ev(`const r = document.getElementById("scale-plate-band").getBoundingClientRect(); return { x: r.right - 3, y: r.top + 3 };`);
      await mouse("mouseMoved", a.x, a.y, { button: "none", buttons: 0 });
      await mouse("mousePressed", a.x, a.y);
      await mouse("mouseMoved", a.x + 6, a.y);
      await mouse("mouseMoved", empty.x, empty.y);
      await mouse("mouseReleased", empty.x, empty.y);
      const right = await ghost();
      if (reduced) assert.strictEqual(right, null, "the ghost stayed under reduced motion");
      else {
        assert.ok(right, "the ghost vanished with no return");
        await b.waitFor(`!document.querySelector(".panghost")`, { label: "the ghost to leave", timeout: 1500 });
      }
    });
  }

  test("DR2b browser (49): the click a real mouse drag ends with swaps nothing further", async () => {
    await openAdd(SCALES.amara);
    const [a, , c] = await plate();
    await mouseDrag(a, c);
    const after = await plate();
    await sleep(60);
    assert.deepStrictEqual((await plate()).map((n) => [n.name, n.cx, n.cy]), after.map((n) => [n.name, n.cx, n.cy]));
    assert.strictEqual(await pickedName(), null);
  });
}
