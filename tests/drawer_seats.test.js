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
  pygmy: "[C3] [Db3] [Eb3] F3 | G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]",
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
    assert.match(await seatOrder(), /^D4=1 E4=2 A3=3 C4=4 /);
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
    test(`DR2a browser (58): at 380x667 the same-ring targets of ${key} are ${key === "pygmy" ? "measured and reported" : "at least " + MIN_PX + "px"} and the plate at least 240px`, async () => {
      await openAdd(scale);
      const first = await ev(`return document.querySelector("#scale-preview .panhit[tabindex='0']").getAttribute("aria-label").split(",")[0];`);
      await tap(first);
      const m = await ev(`const svg = document.querySelector("#scale-preview svg"); const sr = svg.getBoundingClientRect();
        const k = sr.width / svg.viewBox.baseVal.width;
        const same = [...document.querySelectorAll("#scale-preview .panhit")].filter((h) => h.getAttribute("aria-label").includes(document.querySelector(".panhit[aria-pressed='true']").getAttribute("aria-label").split(", ")[1].split(" seat")[0] + " seat"));
        return { plate: sr.height, sizes: same.map((h) => Number(h.getAttribute("r")) * 2 * k) };`);
      assert.ok(m.plate >= 240, `plate ${m.plate}px`);
      const least = Math.min(...m.sizes);
      if (key === "pygmy") {
        console.log(`DR2a 58 report, pygmy at 380x667, plate ${m.plate}px: smallest same-ring target ${least.toFixed(1)}px`);
        assert.ok(Number.isFinite(least) && least > 0, "no same-ring target was measured");
        return;
      }
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

  const stickBand = async () => {
    await ev(`document.activeElement && document.activeElement.blur(); const sp = document.querySelector("#scale-sheet .sheetbody"); const band = document.getElementById("scale-plate-band");
      sp.scrollTop = 0; for (let y = 0; y <= sp.scrollHeight; y += 1) { sp.scrollTop = y; if (band.getBoundingClientRect().top - sp.getBoundingClientRect().top <= 0.5) break; } return true;`);
    await frames();
  };
  const reach = () => ev(`const sp = document.querySelector("#scale-sheet .sheetbody"), sr = sp.getBoundingClientRect();
    const band = document.getElementById("scale-plate-band"), br = band.getBoundingClientRect();
    const out = (id) => Math.round((document.getElementById(id).getBoundingClientRect().bottom - sr.bottom) * 10) / 10;
    return { stuck: getComputedStyle(band).position === "sticky" && br.top - sr.top <= 0.5, plateW: document.querySelector("#scale-preview svg").getBoundingClientRect().width,
      notice: !document.getElementById("scale-layout-state").hidden,
      toggle: out("scale-layout-toggle"), noteRow: out("scale-note-next"), seatRow: out("scale-seat-next") };`);

  for (const [key, scale, a, c] of [["amara", SCALES.amara, "A3", "C4"], ["kurd", SCALES.kurd, "A3", "Bb3"], ["pygmy", SCALES.pygmy, "G3", "Ab3"]]) {
    test(`DR2a browser (84): on Add at 380x667 with the band stuck the toggle and both step rows of ${key} are inside the scrollport, with and without the notice`, async () => {
      await openAdd(scale);
      await stickBand();
      const quiet = await reach();
      await tap(a); await tap(c);
      await stickBand();
      const noisy = await reach();
      assert.strictEqual(quiet.notice, false);
      assert.strictEqual(noisy.notice, true);
      for (const [state, m] of [["no notice", quiet], ["the notice and the swap sentence", noisy]]) {
        assert.ok(m.stuck, `${state}: the band is not stuck`);
        for (const row of ["toggle", "noteRow", "seatRow"])
          assert.ok(m[row] <= 0.5, `${key}, ${state}: the ${row} is ${m[row]}px below the scrollport (plate ${m.plateW}px)`);
        assert.ok(m.plateW >= 240, `${key}, ${state}: the plate is ${m.plateW}px`);
      }
    });
  }

  test("DR2a browser (84, report): on Edit at 380x667 the open plate is no narrower than on Add; the rows' overhang is recorded", async () => {
    await openAdd(SCALES.amara);
    await stickBand();
    const add = await reach();
    await ev(`document.getElementById("scale-generate").click(); return true;`);
    await waitSheet(false);
    await ev(`document.querySelector("#decks .chip.on").click(); return true;`);
    await waitSheet(true);
    await ev(`document.getElementById("scale-layout-toggle").click(); return true;`);
    await frames();
    await stickBand();
    const edit = await reach();
    console.log(`DR2a 84 report, Edit at 380x667: plate ${edit.plateW}px (Add ${add.plateW}px); px below the scrollport: toggle ${edit.toggle}, note row ${edit.noteRow}, seat row ${edit.seatRow}`);
    assert.ok(edit.plateW >= add.plateW - 0.5, `Edit plate ${edit.plateW}px, Add ${add.plateW}px`);
  });

  test("DR2a browser (95): a picked note's orange ring and the seat rings are at least 2px, and the ink hairline lies outside the orange ring", async () => {
    await openAdd(SCALES.pygmy);
    await tap("G3");
    const m = await ev(`const q = (c) => document.querySelector("#scale-preview ." + c);
      const sw = (c) => parseFloat(getComputedStyle(q(c)).strokeWidth);
      return { seat: sw("panseat"), sel: sw("pansel"), selR: Number(q("pansel").getAttribute("r")), inkR: Number(q("pansel-ink").getAttribute("r")),
        inkStroke: getComputedStyle(q("pansel-ink")).stroke, inkSw: sw("pansel-ink") };`);
    assert.ok(m.seat >= 2, `.panseat stroke ${m.seat}px`);
    assert.ok(m.sel >= 2, `.pansel stroke ${m.sel}px`);
    assert.ok(m.inkR > m.selR, `the hairline r ${m.inkR} is not outside the orange ring r ${m.selR}`);
    assert.ok(m.inkSw > 0 && m.inkSw < m.sel, `the hairline is ${m.inkSw}px`);
  });

  const BUILTIN_SCALES = {
    amara9: SCALES.amara,
    amara10: "(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5",
    kurd: SCALES.kurd,
    hijaz: "(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4",
    pygmy: SCALES.pygmy,
  };
  for (const [deck, scale] of Object.entries(BUILTIN_SCALES)) {
    test(`DR2a browser (95): on every field of ${deck} at the 380x667 open plate the orange ring shows 2px and the 1px ink hairline lies wholly outside it`, async () => {
      await openAdd(scale);
      const ids = await ev(`return [...document.querySelectorAll("#scale-preview .panhit")].map((h) => h.getAttribute("data-field"));`);
      assert.ok(ids.length > 0);
      for (const id of ids) {
        const sel = `#scale-preview .panhit[data-field='${id}']`;
        await b.click(sel); await frames();
        const m = await ev(`const svg = document.querySelector("#scale-preview svg"), q = (c) => svg.querySelector("." + c);
          const k = Math.min(svg.getBoundingClientRect().width, svg.getBoundingClientRect().height) / (2 * Number(svg.getAttribute("data-ext")));
          const sw = (c) => parseFloat(getComputedStyle(q(c)).strokeWidth);
          const pressed = svg.querySelector(".panhit[aria-pressed='true']");
          return { pressed: !!pressed, k, selR: Number(q("pansel") && q("pansel").getAttribute("r")), inkR: Number(q("pansel-ink") && q("pansel-ink").getAttribute("r")),
            selW: q("pansel") ? sw("pansel") : 0, inkW: q("pansel-ink") ? sw("pansel-ink") : 0 };`);
        if (!m.pressed) continue;
        const orangeOuter = m.selR * m.k + m.selW / 2;
        const inkInner = m.inkR * m.k - m.inkW / 2;
        const where = `${deck} field ${id}: orange r ${(m.selR * m.k).toFixed(2)}px w ${m.selW}, ink r ${(m.inkR * m.k).toFixed(2)}px w ${m.inkW}`;
        assert.ok(m.selW >= 2, `orange ${m.selW}px wide, ${where}`);
        assert.strictEqual(m.inkW, 1, `the hairline is ${m.inkW}px wide, ${where}`);
        assert.ok(inkInner >= orangeOuter - 0.01, `the hairline overlaps the orange by ${(orangeOuter - inkInner).toFixed(2)}px, ${where}`);
        await b.click(sel); await frames();
      }
    });
  }

  /** The sheet with the scale typed and the drawer still closed. */
  const sheetWith = async (scale, edit) => {
    await b.setViewport(380, 667, true);
    await ev(`try { localStorage.clear(); } catch (e) {} return true;`);
    await b.goto(url);
    await ev(`document.getElementById("deck-add").click(); return true;`);
    await waitSheet(true);
    await typeBox(scale);
    if (edit) {
      await ev(`document.getElementById("scale-generate").click(); return true;`);
      await waitSheet(false);
      await ev(`document.querySelector("#decks .chip.on").click(); return true;`);
      await waitSheet(true);
    }
    await frames();
  };
  const openBy = async (how) => {
    await ev(`document.getElementById("scale-layout-toggle").scrollIntoView({ block: "center" }); return true;`);
    if (how === "pointer") await b.click("#scale-layout-toggle");
    else {
      await b.key("Shift", "ShiftLeft", 16);
      await ev(`document.getElementById("scale-layout-toggle").focus(); return true;`);
      await b.key(" ", "Space", 32);
    }
    await frames();
  };
  const focusState = () => ev(`const a = document.activeElement; const mark = a && a.nextElementSibling;
    return { name: a && a.classList.contains("panhit") ? a.getAttribute("aria-label").split(",")[0] : (a && a.id) || a.tagName,
      rover: !!a && a.getAttribute("tabindex") === "0", hit: !!a && a.classList.contains("panhit"),
      mark: mark && mark.classList.contains("panfocus") ? getComputedStyle(mark).display : null,
      text: !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA"),
      rovers: document.querySelectorAll("#scale-preview .panhit[tabindex='0']").length };`);

  for (const edit of [false, true]) {
    for (const how of ["pointer", "keyboard"]) {
      test(`DR2a browser (18, 96): opening by ${how} on ${edit ? "Edit" : "Add"} puts focus on the first pickable note, with the focus mark only for the keyboard`, async () => {
        await sheetWith(SCALES.pygmy, edit);
        await openBy(how);
        const f = await focusState();
        assert.deepStrictEqual([f.name, f.hit, f.rover, f.text, f.rovers], ["G3", true, true, false, 1], JSON.stringify(f));
        assert.strictEqual(f.mark, how === "pointer" ? "none" : "inline", `the focus mark after a ${how} open`);
        await ev(`document.getElementById("scale-layout-toggle").click(); return true;`);
        await frames();
        assert.strictEqual((await focusState()).name, "scale-layout-toggle", "closing did not return focus to the toggle");
        await openBy(how);
        assert.strictEqual((await focusState()).name, "G3", "a reopen did not focus the first pickable note");
      });
    }
  }

  test("DR2a browser (18): a pan with no ring of two notes focuses its first note", async () => {
    await sheetWith("(D3) A3", false);
    await openBy("pointer");
    assert.strictEqual((await focusState()).name, "A3");
    assert.strictEqual((await focusState()).rover, true);
  });

  test("DR2a browser (18): a pan with no note (a ding alone does not parse, so the drawer cannot open) keeps focus off every note", async () => {
    await sheetWith("(D3)", false);
    await openBy("pointer");
    assert.strictEqual(await ev(`return document.getElementById("scale-drawer").hidden;`), true, "the drawer opened over a pan with no note");
    assert.strictEqual((await focusState()).hit, false, "focus went to a note over a pan with none");
  });

  test("DR2a browser (18, 84): the focus move on open leaves the toggle inside the scrollport and the step rows reachable at 380x667", async () => {
    await sheetWith(SCALES.pygmy, false);
    await openBy("pointer");
    const m = await ev(`const sp = document.querySelector("#scale-sheet .sheetbody"), sr = sp.getBoundingClientRect();
      const r = document.getElementById("scale-layout-toggle").getBoundingClientRect();
      return { top: r.top - sr.top, bottom: r.bottom - sr.bottom };`);
    assert.ok(m.top >= -0.5 && m.bottom <= 0.5, `the toggle is outside the scrollport after the open: ${JSON.stringify(m)}`);
    await stickBand();
    const r = await reach();
    for (const row of ["toggle", "noteRow", "seatRow"]) assert.ok(r[row] <= 0.5, `${row} is ${r[row]}px below the scrollport`);
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
    assert.match(await seatOrder(), /^C4=1 A3=2 /);
  });
}
