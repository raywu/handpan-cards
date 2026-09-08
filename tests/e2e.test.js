// End-to-end journeys, driven through a real headless Chromium.
//
// Scope is deliberately small: only behaviour that CANNOT be checked without a
// browser lives here (CSS transforms, layout/clipping at a real viewport,
// localStorage across a reload, real click/key dispatch). Chord data, voicings
// and diagram geometry are covered by the unit tests - see tests/CONTRACT.md.
//
// Nothing here hardcodes deck ids, chord counts, colours or fonts: every
// expectation is derived from the page's own `DECKS` array at runtime, so a
// data edit or a restyle cannot turn these red on its own.
//
// If no Chromium is present the whole suite skips with a printed reason
// (CONTRACT: ./tests/run.sh must work anywhere).

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const path = require("node:path");
const { launch, findBrowser } = require("./helpers/cdp.js");

const REPO = path.resolve(__dirname, "..");
// Fixed high port, loopback only. E2E_PORT is an escape hatch for the rare case
// where something else already owns it (e.g. two suites running side by side).
const PORT = Number(process.env.E2E_PORT) || 8973;
const URL = `http://127.0.0.1:${PORT}/index.html`;

/* ------------------------------------------------------------------ *
 * skip-if-no-browser
 * ------------------------------------------------------------------ */
const BROWSER = findBrowser();
if (!BROWSER) {
  const why =
    "e2e skipped: no Chromium binary found (set CHROME_BIN to enable). " +
    "This is not a failure - see tests/CONTRACT.md.";
  console.log(why);
  test.skip(why, () => {});
} else {
  run();
}

function run() {
  let server = null;
  let spawnError = null;
  let b = null;

  /* ---------------------------------------------------------------- *
   * server + browser lifecycle
   * ---------------------------------------------------------------- */
  before(async () => {
    // file:// has an opaque origin, so localStorage throws there; serve for real.
    server = spawn(
      "python3",
      ["-m", "http.server", String(PORT), "--bind", "127.0.0.1", "--directory", REPO],
      { stdio: ["ignore", "ignore", "ignore"] },
    );
    server.on("error", (e) => {
      spawnError = e;
    });
    await waitForServer();

    b = await launch();
    assert.ok(b, "browser found by findBrowser() but launch() returned null");
    await b.setViewport(900, 900, false);
    await b.goto(URL);
  });

  after(async () => {
    if (b) await b.close();
    if (server) server.kill("SIGKILL");
  });

  async function waitForServer() {
    const deadline = Date.now() + 15000;
    for (;;) {
      try {
        const r = await fetch(URL, { cache: "no-store" });
        if (r.ok) {
          await r.arrayBuffer();
          return;
        }
      } catch {
        /* not up yet */
      }
      if (spawnError) throw spawnError;
      if (Date.now() > deadline) {
        throw new Error(
          `http.server never came up on ${URL} - is port ${PORT} taken? (set E2E_PORT)`,
        );
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  /* ---------------------------------------------------------------- *
   * page helpers - every expectation is read from the page's own data
   * ---------------------------------------------------------------- */

  // [{id, name, chords}] straight out of the embedded DECKS constant.
  const decksMeta = () =>
    b.eval(`return DECKS.map(d => ({ id: d.id, name: d.name, chords: d.chords.length }));`);

  const countText = () =>
    b.eval(`return (document.getElementById("count").textContent || "").trim();`);

  const chipStates = () =>
    b.eval(`return [...document.querySelectorAll("#decks .chip")]
              .map(c => ({ text: c.textContent.trim(), on: c.classList.contains("on") }));`);

  const stored = () =>
    b.eval(`try { return JSON.parse(localStorage.getItem("hpfc") || "null"); }
            catch (e) { return null; }`);

  // Wipe persisted state and reload, so tests do not inherit each other's deck.
  async function freshLoad() {
    await b.eval(`try { localStorage.clear(); } catch (e) {} return true;`);
    await b.goto(URL);
    await b.waitFor(`document.querySelectorAll("#decks .chip").length > 0`, {
      label: "deck chips to be built",
    });
  }

  // Polls, so it is immune to render timing; reports what it actually saw.
  async function expectCount(text, label) {
    try {
      await b.waitFor(
        `(document.getElementById("count").textContent || "").trim() === ${JSON.stringify(text)}`,
        { timeout: 5000, label },
      );
    } catch {
      assert.fail(`${label}: expected the counter to read "${text}", saw "${await countText()}"`);
    }
  }

  // Click the i-th deck chip and wait for the deck to actually change over.
  async function selectDeck(i, meta) {
    await b.click(`#decks .chip:nth-child(${i + 1})`);
    await expectCount(`1 / ${meta[i].chords}`, `deck ${meta[i].id} selected`);
  }

  // Step forward with the real button until the card index is reached.
  async function gotoCard(target, total) {
    const at = () => b.eval(`return +(document.getElementById("count").textContent || "").split("/")[0].trim();`);
    let cur = await at();
    while (cur !== target + 1) {
      await b.click("#next");
      await expectCount(`${(cur % total) + 1} / ${total}`, "next card");
      cur = (cur % total) + 1;
    }
  }

  // Largest deviation of a computed transform's linear part from the identity.
  // 0 for "none"/identity; 2 for rotateY(180deg).
  function rotationAmount(transform) {
    if (!transform || transform === "none") return 0;
    const m = /matrix(3d)?\(([^)]+)\)/.exec(transform);
    if (!m) return 0;
    const v = m[2].split(",").map(Number);
    const lin =
      v.length === 16
        ? [v[0], v[1], v[2], v[4], v[5], v[6], v[8], v[9], v[10]]
        : [v[0], v[1], 0, v[2], v[3], 0, 0, 0, 1];
    const id = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    return Math.max(...lin.map((x, i) => Math.abs(x - id[i])));
  }

  const cardTransform = () =>
    b.eval(`return getComputedStyle(document.getElementById("card")).transform;`);
  const cardFlipped = () =>
    b.eval(`return document.getElementById("card").classList.contains("flip");`);

  /* ---------------------------------------------------------------- *
   * 1. boot
   * ---------------------------------------------------------------- */
  test("boots with the first deck loaded", async () => {
    await freshLoad();
    const meta = await decksMeta();
    assert.ok(meta.length >= 1, "page exposes no decks");

    assert.strictEqual(await countText(), `1 / ${meta[0].chords}`);

    const chips = await chipStates();
    assert.strictEqual(chips.length, meta.length, "one chip per deck");
    assert.deepStrictEqual(
      chips.map((c) => c.on),
      chips.map((_, i) => i === 0),
      "only the first deck's chip is active on a clean boot",
    );

    // Both faces are written on every render, so both must have content.
    const faces = await b.eval(`return {
      front: document.getElementById("front").innerHTML.length,
      back: document.getElementById("back").innerHTML.length,
    };`);
    assert.ok(faces.front > 0 && faces.back > 0, `card faces are empty: ${JSON.stringify(faces)}`);
  });

  /* ---------------------------------------------------------------- *
   * 2. deck switching
   * ---------------------------------------------------------------- */
  test("deck chips switch the deck", async () => {
    await freshLoad();
    const meta = await decksMeta();
    assert.ok(meta.length >= 2, "need at least two decks to test switching");

    for (let i = 0; i < meta.length; i++) {
      await selectDeck(i, meta);
      assert.strictEqual(
        await countText(),
        `1 / ${meta[i].chords}`,
        `deck ${meta[i].id} should show its own chord total`,
      );
      const chips = await chipStates();
      assert.deepStrictEqual(
        chips.map((c) => c.on),
        chips.map((_, k) => k === i),
        `exactly the ${meta[i].id} chip should be active`,
      );
    }
  });

  /* ---------------------------------------------------------------- *
   * 3. the flip
   *
   * render() writes BOTH faces every time, so any content-based assertion
   * passes with the flip CSS deleted. The only honest check is the settled
   * computed transform (transition is 450ms - always settle() first).
   * ---------------------------------------------------------------- */
  test("tapping the card flips it", async () => {
    await freshLoad();

    await b.settle();
    assert.strictEqual(await cardFlipped(), false, "card starts unflipped");
    assert.ok(
      rotationAmount(await cardTransform()) < 0.01,
      `card should start at the identity transform, got ${await cardTransform()}`,
    );

    await b.click("#card");
    await b.waitFor(`document.getElementById("card").classList.contains("flip")`, {
      label: "card to take the flip class",
    });
    await b.settle();
    const flipped = await cardTransform();
    assert.ok(
      rotationAmount(flipped) > 0.5,
      `flipped card must be visually rotated, computed transform was "${flipped}"`,
    );

    await b.click("#card");
    await b.waitFor(`!document.getElementById("card").classList.contains("flip")`, {
      label: "card to drop the flip class",
    });
    await b.settle();
    const back = await cardTransform();
    assert.ok(
      rotationAmount(back) < 0.01,
      `unflipped card must return to the identity transform, got "${back}"`,
    );
  });

  /* ---------------------------------------------------------------- *
   * 4. navigation
   * ---------------------------------------------------------------- */
  test("buttons and arrow keys step through the deck and wrap", async () => {
    await freshLoad();
    const meta = await decksMeta();
    const n = meta[0].chords;
    assert.ok(n >= 3, "deck too small to test stepping");

    await b.click("#next");
    await expectCount(`2 / ${n}`, "#next steps forward");

    await b.key("ArrowRight", "ArrowRight", 39);
    await expectCount(`3 / ${n}`, "ArrowRight steps forward");

    await b.key("ArrowLeft", "ArrowLeft", 37);
    await expectCount(`2 / ${n}`, "ArrowLeft steps back");

    await b.click("#prev");
    await expectCount(`1 / ${n}`, "#prev steps back");

    // wrap at the low end, then at the high end
    await b.click("#prev");
    await expectCount(`${n} / ${n}`, "stepping back from the first card wraps to the last");

    await b.click("#next");
    await expectCount(`1 / ${n}`, "stepping on from the last card wraps to the first");

    await b.key("ArrowLeft", "ArrowLeft", 37);
    await expectCount(`${n} / ${n}`, "ArrowLeft from the first card wraps to the last");
  });

  /* ---------------------------------------------------------------- *
   * 5. persistence
   *
   * Subset semantics only: the hpfc key is going to carry spaced-repetition
   * progress too (CONTRACT), so never assert deep equality on it.
   * ---------------------------------------------------------------- */
  test("deck and mode survive a reload", async () => {
    await freshLoad();
    const meta = await decksMeta();
    const target = meta.length - 1; // any deck that is not the default
    assert.ok(target > 0, "need a non-default deck");

    await selectDeck(target, meta);
    await b.click("#modeB");
    await b.waitFor(`document.getElementById("modeB").classList.contains("on")`, {
      label: "mode B to become active",
    });

    const before = await stored();
    assert.ok(before && typeof before === "object", `nothing saved under "hpfc": ${JSON.stringify(before)}`);
    assert.strictEqual(before.deck, meta[target].id, "saved deck id");
    assert.strictEqual(before.mode, "B", "saved mode");

    await b.goto(URL); // reload
    await b.waitFor(`document.querySelectorAll("#decks .chip").length > 0`, {
      label: "chips after reload",
    });

    assert.strictEqual(
      await countText(),
      `1 / ${meta[target].chords}`,
      "reload should come back on the saved deck",
    );
    const chips = await chipStates();
    assert.deepStrictEqual(
      chips.map((c) => c.on),
      chips.map((_, k) => k === target),
      "saved deck's chip is active after reload",
    );
    const modes = await b.eval(`return {
      a: document.getElementById("modeA").classList.contains("on"),
      b: document.getElementById("modeB").classList.contains("on"),
    };`);
    assert.deepStrictEqual(modes, { a: false, b: true }, "saved mode survives the reload");

    const after = await stored();
    assert.strictEqual(after.deck, meta[target].id);
    assert.strictEqual(after.mode, "B");
  });

  /* ---------------------------------------------------------------- *
   * 6. 380px layout
   *
   * .notesline/.numline are white-space:nowrap inside .face{overflow:hidden},
   * so an overlong line is CLIPPED and body.scrollWidth stays clean - the real
   * assertion is per element: scrollWidth <= clientWidth + 1. Checked on the
   * widest card of each deck (widest = most fields / longest note text /
   * longest number text, all derived from the page data - that is Pygmy Fm11
   * and Hijaz Bm6/9 today, but nothing here depends on that).
   * ---------------------------------------------------------------- */
  test("card lines and diagram stay inside the card at 380px", async () => {
    await freshLoad();
    const meta = await decksMeta();
    await b.setViewport(380, 800, true);
    await b.settle();

    try {
      for (let i = 0; i < meta.length; i++) {
        await selectDeck(i, meta);

        const widest = await b.eval(`
          const d = DECKS[${i}];
          const notes = ch => ch.fields.map(f => d.fields[f][0] + d.fields[f][1]).join(" - ");
          const nums  = ch => ch.fields.map(f => d.fields[f][5]).join(" - ");
          const pick = score => {
            let best = 0;
            for (let k = 1; k < d.chords.length; k++)
              if (score(d.chords[k]) > score(d.chords[best])) best = k;
            return best;
          };
          const cand = [pick(c => c.fields.length), pick(c => notes(c).length), pick(c => nums(c).length)];
          return [...new Set(cand)].sort((a, b) => a - b);
        `);
        assert.ok(widest.length >= 1, `no candidate card found for ${meta[i].id}`);

        for (const card of widest) {
          await gotoCard(card, meta[i].chords);
          await b.settle();

          const m = await b.eval(`
            const box = el => {
              const r = el.getBoundingClientRect();
              return { l: r.left, t: r.top, r: r.right, b: r.bottom };
            };
            const lines = [...document.querySelectorAll(".face .notesline, .face .numline")]
              .map(el => ({
                kind: el.className,
                text: el.textContent.trim(),
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth,
              }));
            const svgs = [...document.querySelectorAll(".face .diagwrap svg")].map(svg => {
              const vb = svg.viewBox.baseVal, bb = svg.getBBox();
              return {
                svg: box(svg),
                wrap: box(svg.parentElement),
                vb: { x: vb.x, y: vb.y, w: vb.width, h: vb.height },
                bb: { x: bb.x, y: bb.y, w: bb.width, h: bb.height },
              };
            });
            return {
              name: (document.querySelector(".face .bigname") || {}).textContent || "",
              count: document.getElementById("count").textContent.trim(),
              lines,
              svgs,
              body: { scrollWidth: document.body.scrollWidth, clientWidth: document.body.clientWidth },
            };
          `);

          const where = `${meta[i].id} card ${m.count} (${m.name.trim()})`;

          // Guard against the selectors silently matching nothing.
          assert.ok(m.lines.length >= 2, `no note/number lines rendered on ${where}`);
          assert.ok(m.svgs.length >= 1, `no diagram rendered on ${where}`);

          for (const ln of m.lines) {
            assert.ok(
              ln.scrollWidth <= ln.clientWidth + 1,
              `${where}: .${ln.kind} overflows its box at 380px - ` +
                `"${ln.text}" needs ${ln.scrollWidth}px in ${ln.clientWidth}px`,
            );
          }

          for (const s of m.svgs) {
            assert.ok(
              s.svg.l >= s.wrap.l - 1 && s.svg.r <= s.wrap.r + 1 &&
                s.svg.t >= s.wrap.t - 1 && s.svg.b <= s.wrap.b + 1,
              `${where}: svg element escapes .diagwrap - ${JSON.stringify(s)}`,
            );
            // Drawn content must fit the viewBox, or the diagram is cut off.
            const tol = 2; // stroke width is not counted by getBBox()
            assert.ok(
              s.bb.x >= s.vb.x - tol &&
                s.bb.y >= s.vb.y - tol &&
                s.bb.x + s.bb.w <= s.vb.x + s.vb.w + tol &&
                s.bb.y + s.bb.h <= s.vb.y + s.vb.h + tol,
              `${where}: diagram content spills out of the viewBox - ${JSON.stringify(s)}`,
            );
          }

          // Weaker, but it catches an outright horizontal blowout of the page.
          assert.ok(
            m.body.scrollWidth <= m.body.clientWidth + 1,
            `${where}: page scrolls horizontally at 380px ` +
              `(${m.body.scrollWidth} > ${m.body.clientWidth})`,
          );
        }
      }
    } finally {
      await b.setViewport(900, 900, false);
    }
  });
}
