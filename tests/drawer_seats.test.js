// Lane DR2a: the browser layer of seats without a drag (spec sections 5, 6, 9,
// 10, 16; plan 20.17). Real hit nodes, real focus, real key and click events.
// The unit layer is the DR2a block at the end of tests/app.test.js. Expected
// values are literals written here from the spec.

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
  pygmy: "[C3] [Db3] [Eb3] (F3) G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 F5 G5 [Ab5]",
};
const MIN_PX = 44;

const BROWSER = findBrowser();
if (!BROWSER) {
  const why = "drawer_seats skipped: no Chromium binary found (set CHROME_BIN to enable). " +
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
  const frames = () => ev(`return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));`);
  const typeBox = (s) => ev(`const el = document.getElementById("scale-box"); el.value = ${JSON.stringify(s)};
    el.dispatchEvent(new Event("input", { bubbles: true })); return true;`);
  const waitSheet = (shown) => b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden") === ${!shown}`, { label: "the sheet" });

  const openAdd = async (scale, w = 380, h = 667) => {
    await b.setViewport(w, h, true);
    await ev(`try { localStorage.clear(); } catch (e) {} return true;`);
    await b.goto(url);
    await ev(`document.getElementById("deck-add").click(); return true;`);
    await waitSheet(true);
    await typeBox(scale);
    await ev(`document.getElementById("scale-layout-toggle").click(); return true;`);
    await frames();
  };
  const names = () => ev(`return [...document.querySelectorAll("#scale-preview .panhit")].map((h) => h.getAttribute("aria-label").split(",")[0]);`);
  const hitSel = (name) => ev(`const h = [...document.querySelectorAll("#scale-preview .panhit")].find((n) => n.getAttribute("aria-label").startsWith(${JSON.stringify(name + ",")}));
    return h ? "#scale-preview .panhit[data-field='" + h.getAttribute("data-field") + "']" : null;`);
  const tap = async (name) => { const sel = await hitSel(name); assert.ok(sel, `no target for ${name}`); await b.click(sel); await frames(); };
  const status = () => ev(`return document.getElementById("scale-drawer-status").textContent;`);
  const focusName = () => ev(`const a = document.activeElement; return a && a.classList.contains("panhit") ? a.getAttribute("aria-label").split(",")[0] : (a && a.id) || null;`);
  const seatOrder = () => ev(`return [...document.querySelectorAll("#scale-preview .panhit")].map((h) => h.getAttribute("aria-label").split(",")[0] + "=" + h.getAttribute("aria-label").split("seat ")[1].split(" ")[0]).join(" ");`);

  test("DR2a browser: a real tap then a real tap swaps two notes, focus returns, the flash is two seats and then none", async () => {
    await openAdd(SCALES.amara);
    await tap("A3");
    assert.strictEqual(await ev(`return document.querySelector("#scale-preview .panhit[aria-pressed='true']").getAttribute("aria-label").split(",")[0];`), "A3");
    await tap("D4");
    assert.strictEqual(await status(), "Swapped A3 and D4. A3 is now in rim seat 3 of 8, lower right.");
    assert.strictEqual(await focusName(), "A3");
    assert.strictEqual(await ev(`return document.querySelectorAll("#scale-preview .panflash").length;`), 2);
    await tap("C4"); await tap("E4");
    assert.ok(await ev(`return document.querySelectorAll("#scale-preview .panflash").length;`) <= 2, "more than two flash seats");
    await b.waitFor(`document.querySelectorAll("#scale-preview .panflash").length === 0`, { label: "the flash to end", timeout: 2000 });
    assert.match(await seatOrder(), /^A3=3 C4=4 D4=1 E4=2 /);
  });

  test("DR2a browser: Tab order, the plate as one stop, and Space/arrows/Escape on a focused note", async () => {
    await openAdd(SCALES.pygmy);
    await ev(`document.getElementById("scale-back").focus(); return true;`);
    const seen = [];
    for (let i = 0; i < 16; i += 1) {
      await b.key("Tab", "Tab", 9);
      const id = await ev(`const a = document.activeElement; return a.classList.contains("panhit") ? "plate" : a.id;`);
      if (id === "scale-back") break;
      seen.push(id);
    }
    const head = ["scale-box", "plate", "scale-layout-toggle", "scale-note-prev", "scale-note-next", "scale-seat-prev",
      "scale-seat-next", "scale-mirror", "scale-mirror-bottom", "scale-layout-reset", "scale-anchor-one", "scale-anchor-between"];
    const got = seen.filter((x) => head.includes(x));
    const want = head.filter((x) => x !== "scale-seat-prev" && x !== "scale-seat-next" && x !== "scale-layout-reset");
    assert.deepStrictEqual(got.filter((x) => want.includes(x)), want, `Tab order: ${seen}`);
    await ev(`document.querySelector("#scale-preview .panhit[tabindex='0']").focus(); return true;`);
    await b.key(" ", "Space", 32);
    assert.match(await status(), /^Picked up /);
    await b.key("Escape", "Escape", 27);
    assert.strictEqual(await status(), "Cancelled. Nothing moved.");
    assert.strictEqual(await ev(`return document.getElementById("scale-drawer").hidden;`), false, "the first Escape closed the drawer");
    await b.key("Escape", "Escape", 27);
    assert.strictEqual(await ev(`return document.getElementById("scale-drawer").hidden;`), true);
  });

  for (const [key, scale] of Object.entries({ amara: SCALES.amara, kurd: SCALES.kurd, pygmy: SCALES.pygmy })) {
    test(`DR2a browser (58): at 380x667 the same-ring targets of ${key} are at least ${MIN_PX}px and the plate at least 240px`, async () => {
      await openAdd(scale);
      const first = await ev(`return document.querySelector("#scale-preview .panhit[tabindex='0']").getAttribute("aria-label").split(",")[0];`);
      await tap(first);
      const m = await ev(`const svg = document.querySelector("#scale-preview svg"); const sr = svg.getBoundingClientRect();
        const k = sr.width / svg.viewBox.baseVal.width;
        const same = [...document.querySelectorAll("#scale-preview .panhit")].filter((h) => h.getAttribute("aria-label").includes(document.querySelector(".panhit[aria-pressed='true']").getAttribute("aria-label").split(", ")[1].split(" seat")[0] + " seat"));
        return { plate: sr.height, sizes: same.map((h) => Number(h.getAttribute("r")) * 2 * k) };`);
      assert.ok(m.plate >= 240, `plate ${m.plate}px`);
      for (const s of m.sizes) assert.ok(s >= MIN_PX - 0.5, `a same-ring target is ${s.toFixed(1)}px: ${m.sizes.map((x) => x.toFixed(1))}`);
    });
  }

  test("DR2a browser (121, item 7): over a scale that does not parse the closed drawer leaves the toggle focused and aria-disabled", async () => {
    await openAdd(SCALES.amara);
    await typeBox("(D3) zzz");
    await ev(`document.getElementById("scale-note-next").focus(); return true;`);
    await ev(`document.getElementById("scale-layout-toggle").click(); return true;`);
    await frames();
    assert.strictEqual(await focusName(), "scale-layout-toggle");
    assert.strictEqual(await ev(`return document.getElementById("scale-layout-toggle").getAttribute("aria-disabled");`), "true");
  });

  test("DR2a browser (84): the longest status sentence fits the reserved band without the plate scrolling away", async () => {
    await openAdd(SCALES.pygmy);
    const before = await ev(`return document.getElementById("scale-plate-band").getBoundingClientRect().height;`);
    await tap("G3");
    await tap("Ab3");
    const after = await ev(`return document.getElementById("scale-plate-band").getBoundingClientRect().height;`);
    assert.ok(after - before <= 40, `the band grew ${before} to ${after}`);
  });

  test("DR2a browser (70): a swap reaches the stored deck and Edit shows it", async () => {
    await openAdd(SCALES.amara);
    await tap("A3"); await tap("C4");
    await ev(`document.getElementById("scale-generate").click(); return true;`);
    await waitSheet(false);
    await ev(`document.querySelector("#decks .chip.on").click(); return true;`);
    await waitSheet(true);
    await ev(`document.getElementById("scale-layout-toggle").click(); return true;`);
    await frames();
    assert.match(await seatOrder(), /^A3=2 C4=1 /);
  });
}
