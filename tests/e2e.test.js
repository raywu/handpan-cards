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
const http = require("node:http");
const fs = require("node:fs");
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
    //
    // Served in-process rather than by `python3 -m http.server`: that server is
    // single-threaded, so one of Chrome's speculative sockets sitting idle
    // blocks every later request behind it - which showed up as navigations
    // that hung until a CDP request timed out, reddening whichever test held
    // the wheel. node:http handles sockets concurrently.
    server = http.createServer((req, res) => {
      // NB: the URL const above shadows the global URL class here, so the path
      // is split by hand rather than parsed.
      const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "");
      const file = path.resolve(REPO, rel || "index.html");
      if (!file.startsWith(REPO + path.sep)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end(); return; }
        const type = file.endsWith(".html") ? "text/html; charset=utf-8"
          : file.endsWith(".js") ? "text/javascript" : "application/octet-stream";
        res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
        res.end(buf);
      });
    });
    server.on("error", (e) => { spawnError = e; });
    await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
    await waitForServer();

    b = await launch();
    assert.ok(b, "browser found by findBrowser() but launch() returned null");
    await b.setViewport(900, 900, false);
    await b.goto(URL);
  });

  after(async () => {
    if (b) await b.close();
    if (server) await new Promise((r) => server.close(r));
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
          `the test server never came up on ${URL} - is port ${PORT} taken? (set E2E_PORT)`,
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

  // Deck chips only: "+ ADD" shares the .chip styling but is not a deck.
  const chipStates = () =>
    b.eval(`return [...document.querySelectorAll("#decks .chip:not(#deck-add)")]
              .map(c => ({ text: c.textContent.trim(), on: c.classList.contains("on") }));`);

  const stored = () =>
    b.eval(`try { return JSON.parse(localStorage.getItem("hpfc") || "null"); }
            catch (e) { return null; }`);

  // Wipe persisted state and reload, so tests do not inherit each other's deck.
  // Resolve on the next CDP event with this method name. Page.enable is already
  // on, so the driver's socket is carrying them; it just does not surface them.
  function onceEvent(method, timeout) {
    return new Promise((resolve, reject) => {
      const done = (fn, arg) => { b.ws.removeEventListener("message", h); clearTimeout(t); fn(arg); };
      const h = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        if (m.method === method) done(resolve, m.params);
      };
      const t = setTimeout(
        () => done(reject, new Error(`no ${method} within ${timeout}ms`)), timeout);
      b.ws.addEventListener("message", h);
    });
  }

  // Navigate to URL and wait for the NEW document.
  //
  // Three traps. Page.navigate returns before the new document is committed,
  // and every readiness signal we look for (readyState, #count, a deck chip) is
  // also true of the page we are leaving - so the outgoing document is stamped
  // first and the wait is for that stamp to be gone.
  //
  // Second, do NOT poll with Runtime.evaluate across the commit: an evaluate
  // issued while the execution context is being swapped can sit unanswered for
  // tens of seconds, and the driver gives every CDP request a hard 20s timeout.
  // That was the single biggest source of red here - a navigation the page
  // completed fine, reported as a dead round trip. Wait for the load event
  // instead, and only then start evaluating.
  //
  // Third, a round trip can still be lost (headless Chrome stalls on its own
  // background networking when the sandbox has no route out), so retry - and
  // latch. If the browser is gone for good, every CDP request costs its full
  // 20s, so each remaining test would burn a minute rediscovering the same
  // corpse; the mutation gate then kills the suite for hanging and reads a
  // killed mutant as a survivor. Once navigation is gone it is gone for the
  // run: hand the first failure straight to every later test.
  let navDead = null;
  async function navigate() {
    if (navDead) throw navDead;
    let last = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await b.eval(`window.__stale = true; return true;`);
        const loaded = onceEvent("Page.loadEventFired", 20000);
        await b.send("Page.navigate", { url: URL });
        await loaded;
        await b.waitFor(
          `document.readyState === "complete" && !window.__stale
             && !!document.getElementById("count")?.textContent`,
          { timeout: 10000, label: "the new document to commit" },
        );
        return;
      } catch (e) {
        last = e;
      }
    }
    navDead = last;
    throw last;
  }

  async function freshLoad() {
    if (navDead) throw navDead;
    await b.eval(`try { localStorage.clear(); } catch (e) {} return true;`).catch(() => {});
    await navigate();
    // "+ ADD" ships in the markup, so waiting on ".chip" alone can be satisfied
    // before the app has booted. Wait for a real deck chip.
    await b.waitFor(`document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`, {
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

    await navigate(); // reload
    await b.waitFor(`document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`, {
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

  /* ---------------------------------------------------------------- *
   * the scale sheet (Phase 3)
   *
   * Derived from the LOCKED "Phase 3 UI specification" in
   * docs/SCALE_ENGINE_PLAN.md and from ENGINE-SPEC section 15's element ids.
   * Only what a browser can answer lives here: real layout at 380px, real
   * focus, real modality, real hit areas.
   * ---------------------------------------------------------------- */

  // Six pans that differ only in their ding, so every id is distinct. Each
  // carries a perfect fifth above its ding, which is all parseSeed demands.
  const SIX_SCALES = [
    "(C3) G3 C4 D4 E4 G4 A4 C5",
    "(D3) A3 C4 D4 E4 F4 G4 A4 C5",
    "(E3) B3 D4 E4 F#4 G4 A4 B4",
    "(F3) C4 E4 F4 G4 A4 C5",
    "(G3) D4 F4 G4 A4 Bb4 D5",
    "(A3) E4 G4 A4 B4 C5 E5",
  ];

  const sheetShown = () =>
    b.eval(`return !document.getElementById("scale-sheet").hasAttribute("hidden");`);

  const activeId = () => b.eval(`return (document.activeElement || {}).id || null;`);

  const openSheet = async () => {
    // At 380px the chip row scrolls, so + ADD can start outside the viewport
    // and a click at its centre would land on nothing.
    await b.eval(`document.getElementById("deck-add")
                    .scrollIntoView({ block: "nearest", inline: "nearest" }); return true;`);
    await b.click("#deck-add");
    await b.waitFor(`!document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "the scale sheet to open" });
  };

  // Typing character by character through CDP is slow and the app listens for
  // `input`, so a value plus a real input event is the same journey.
  const typeScale = (s) =>
    b.eval(`
      const el = document.getElementById("scale-box");
      el.value = ${JSON.stringify(s)};
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return el.value;
    `);

  // Click a viewport point rather than an element - the backdrop is the sheet
  // layer itself, so no selector can name only its uncovered part.
  async function clickPoint(x, y) {
    for (const type of ["mousePressed", "mouseReleased"]) {
      await b.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
    }
  }

  async function generate(scale) {
    await openSheet();
    await typeScale(scale);
    await b.click("#scale-generate");
    await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "the sheet to close after Generate" });
  }

  test("the sheet is a modal dialog with the spec'd anatomy", async () => {
    await freshLoad();
    const before = await b.eval(`
      const s = document.getElementById("scale-sheet");
      return {
        hidden: s.hasAttribute("hidden"),
        role: s.getAttribute("role"),
        modal: s.getAttribute("aria-modal"),
        addText: document.getElementById("deck-add").textContent.trim(),
      };
    `);
    assert.strictEqual(before.hidden, true, "the sheet is open before + ADD is tapped");
    assert.strictEqual(before.role, "dialog");
    assert.strictEqual(before.modal, "true");
    assert.match(before.addText, /ADD/);

    await openSheet();
    const open = await b.eval(`
      const s = document.getElementById("scale-sheet");
      const surf = s.firstElementChild;
      const cs = getComputedStyle(surf);
      return {
        maxH: cs.maxHeight,
        overflowY: cs.overflowY,
        viewportH: window.innerHeight,
        parseLine: document.getElementById("scale-parse").textContent.trim(),
        msgLive: document.getElementById("scale-msg").getAttribute("aria-live"),
        placeholder: document.getElementById("scale-box").placeholder,
        generateDisabled: document.getElementById("scale-generate").disabled,
        swatches: document.querySelectorAll("#scale-swatches .dot").length,
        mirrorOn: [...document.querySelectorAll("#scale-mirror-l, #scale-mirror-r")]
          .filter(el => el.classList.contains("on")).map(el => el.id),
      };
    `);
    // max-height: 85dvh, resolved by the browser into pixels.
    assert.ok(Math.abs(parseFloat(open.maxH) - open.viewportH * 0.85) < 2,
      `surface max-height is ${open.maxH} at a ${open.viewportH}px viewport`);
    assert.strictEqual(open.overflowY, "auto", "the surface does not scroll internally");
    assert.match(open.parseLine, /^Type your ding first/);
    assert.strictEqual(open.msgLive, "polite");
    assert.strictEqual(open.placeholder, "(D) A C D E F G A C");
    assert.strictEqual(open.generateDisabled, true);
    assert.strictEqual(open.swatches, 6);
    assert.deepStrictEqual(open.mirrorOn, ["scale-mirror-r"], "right-first is the default");
  });

  test("Generate stays disabled until the parse line is valid", async () => {
    await freshLoad();
    await openSheet();
    for (const [text, valid] of [["", false], ["(D", false], ["(D3) A3 H4", false],
                                 ["(D3) A3 C4 D4", true], ["(D3) A3 C4 D4 ", true]]) {
      await typeScale(text);
      const st = await b.eval(`
        return {
          disabled: document.getElementById("scale-generate").disabled,
          bad: document.getElementById("scale-box").classList.contains("bad"),
          msg: document.getElementById("scale-msg").textContent.trim(),
        };
      `);
      assert.strictEqual(st.disabled, !valid, `"${text}": Generate disabled=${st.disabled}`);
      if (!valid && text) {
        assert.ok(st.msg.length > 0, `"${text}": no reason shown`);
        assert.strictEqual(st.bad, true, `"${text}": the box has no error outline`);
      }
    }
  });

  test("while the sheet is open Generate is the only reachable primary button", async () => {
    await freshLoad();
    const closed = await b.eval(`
      return [...document.querySelectorAll("button.mode.on")]
        .filter(el => !el.disabled && !el.closest("[inert]")).map(el => el.id || el.className);
    `);
    assert.ok(closed.length >= 1, "no primary button on the practice screen");

    await openSheet();
    await typeScale(SIX_SCALES[1]);          // so Generate is live, not disabled
    const open = await b.eval(`
      const sheet = document.getElementById("scale-sheet");
      const reachable = [...document.querySelectorAll("button")]
        .filter(el => !el.disabled && !el.closest("[inert]") && !el.inert);
      const surf = sheet.firstElementChild.getBoundingClientRect();
      return {
        outside: reachable.filter(el => !sheet.contains(el)).map(el => el.id || el.className),
        // A primary is full-width on the sheet surface; the mirror pair and the
        // swatches are segmented controls and are narrower by construction.
        wide: reachable.filter(el => sheet.contains(el))
          .filter(el => el.getBoundingClientRect().width > surf.width * 0.8)
          .map(el => el.id),
      };
    `);
    assert.deepStrictEqual(open.outside, [],
      `practice-screen buttons are still reachable behind the sheet: ${JSON.stringify(open.outside)}`);
    assert.deepStrictEqual(open.wide, ["scale-generate"],
      `full-width primary buttons in the sheet: ${JSON.stringify(open.wide)}`);
  });

  test("Escape closes the sheet and focus returns to + ADD", async () => {
    await freshLoad();
    await openSheet();
    assert.strictEqual(await activeId(), "scale-box", "focus did not land in the box");
    await b.key("Escape", "Escape", 27);
    await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "Escape to close the sheet" });
    assert.strictEqual(await activeId(), "deck-add", "focus did not return to + ADD");
  });

  test("a tap on the backdrop closes the sheet and focus returns to + ADD", async () => {
    await freshLoad();
    await openSheet();
    // The top-left corner of the viewport is backdrop: the surface is anchored
    // to the bottom and is nowhere near 85dvh tall with this content.
    await clickPoint(8, 8);
    await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "a backdrop tap to close the sheet" });
    assert.strictEqual(await activeId(), "deck-add");

    // A tap on the surface must NOT close it.
    await openSheet();
    await b.click("#scale-box");
    assert.strictEqual(await sheetShown(), true, "a tap inside the sheet closed it");
    await b.key("Escape", "Escape", 27);
  });

  test("a generated deck lands on the practice screen without moving the card", async () => {
    await freshLoad();
    await b.setViewport(380, 780, true);
    try {
      const before = await b.eval(`
        const r = document.querySelector(".scene").getBoundingClientRect();
        return { w: r.width, h: r.height,
                 cardW: getComputedStyle(document.documentElement).getPropertyValue("--card-w") };
      `);

      await generate(SIX_SCALES[1]);
      const after = await b.eval(`
        const r = document.querySelector(".scene").getBoundingClientRect();
        const on = [...document.querySelectorAll("#decks .chip.on")];
        const navR = document.getElementById("decks").getBoundingClientRect();
        const chipR = on.length ? on[0].getBoundingClientRect() : null;
        return {
          w: r.width, h: r.height,
          cardW: getComputedStyle(document.documentElement).getPropertyValue("--card-w"),
          count: document.getElementById("count").textContent.trim(),
          flipped: document.getElementById("card").classList.contains("flip"),
          announce: document.querySelector(".announce").textContent.trim(),
          announceLive: document.querySelector(".announce").getAttribute("aria-live"),
          onLabels: on.map(c => c.textContent.trim()),
          chipVisible: chipR && chipR.left >= navR.left - 1 && chipR.right <= navR.right + 1,
          body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
        };
      `);

      assert.strictEqual(after.cardW, before.cardW, "--card-w moved after a generate");
      assert.ok(Math.abs(after.w - before.w) < 0.5,
        `card width changed after a generate: ${before.w} -> ${after.w}`);
      assert.strictEqual(after.flipped, false, "card 1 is not face-up");
      assert.match(after.count, /^1 \//, `counter reads "${after.count}"`);
      assert.strictEqual(after.onLabels.length, 1, "not exactly one selected chip");
      assert.strictEqual(after.chipVisible, true, "the new chip is outside the visible row");
      assert.strictEqual(after.announceLive, "polite");
      assert.match(after.announce, /cards generated/, `announced "${after.announce}"`);
      assert.ok(after.body.sw <= after.body.cw + 1,
        `the page scrolls horizontally after a generate (${after.body.sw} > ${after.body.cw})`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("six custom decks keep the chip row on one line with the active chip in view", async () => {
    await freshLoad();
    await b.setViewport(380, 780, true);
    try {
      for (const s of SIX_SCALES) await generate(s);

      const row = await b.eval(`
        const nav = document.getElementById("decks");
        const chips = [...nav.children];
        const navR = nav.getBoundingClientRect();
        const on = nav.querySelector(".chip.on").getBoundingClientRect();
        return {
          chips: chips.length,
          tops: [...new Set(chips.map(c => Math.round(c.getBoundingClientRect().top)))],
          rowScrolls: nav.scrollWidth > nav.clientWidth + 1,
          wraps: nav.scrollHeight > nav.clientHeight + 1,
          activeInView: on.left >= navR.left - 1 && on.right <= navR.right + 1,
          addLast: chips[chips.length - 1].id,
          body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
        };
      `);
      assert.strictEqual(row.chips, 3 + 6 + 1, "three built-ins, six customs and + ADD");
      assert.strictEqual(row.tops.length, 1, `the chip row wrapped onto ${row.tops.length} lines`);
      assert.strictEqual(row.wraps, false, "the chip row grew taller than one line");
      assert.strictEqual(row.rowScrolls, true, "ten chips at 380px should scroll horizontally");
      assert.strictEqual(row.activeInView, true, "the active chip is not scrolled into view");
      assert.strictEqual(row.addLast, "deck-add", "+ ADD is no longer last");
      assert.ok(row.body.sw <= row.body.cw + 1, "the chip row blew the page out horizontally");
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("the card fits a 380px viewport on load, with no horizontal overflow", async () => {
    await freshLoad();
    await b.setViewport(380, 780, true);
    try {
      const m = await b.eval(`
        const s = document.querySelector(".scene").getBoundingClientRect();
        return {
          scene: { l: s.left, r: s.right, t: s.top, b: s.bottom, w: s.width, h: s.height },
          vw: document.documentElement.clientWidth,
          vh: document.documentElement.clientHeight,
          body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
        };
      `);
      assert.ok(m.scene.l >= -1 && m.scene.r <= m.vw + 1,
        `the card is not inside the 380px viewport: ${JSON.stringify(m.scene)}`);
      assert.ok(m.scene.t >= -1 && m.scene.b <= m.vh + 1,
        `the card is cut off vertically: ${JSON.stringify(m.scene)}`);
      assert.ok(m.scene.w > 200, `the card collapsed to ${m.scene.w}px`);
      assert.ok(m.body.sw <= m.body.cw + 1,
        `the page scrolls horizontally at 380px (${m.body.sw} > ${m.body.cw})`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("every chip and sheet control has a 44px hit area", async () => {
    await freshLoad();
    await b.setViewport(380, 780, true);
    try {
      await openSheet();
      const hits = await b.eval(`
        const out = { small: [], swatches: [] };
        const sel = "#decks .chip, #scale-box, #scale-mirror-l, #scale-mirror-r, #scale-generate";
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          if (r.height < 44) out.small.push((el.id || el.className) + " " + r.height.toFixed(1));
        }
        // The palette swatches are 14px by spec, so their hit area is an
        // invisible overlay: probe it instead of measuring the dot.
        for (const dot of document.querySelectorAll("#scale-swatches .dot")) {
          const r = dot.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          // The overlay is 44px tall and centred, so +/-21 pins the documented
          // 44px; +/-18 would pass on anything 36px or taller.
          const hitsDot = [cy - 21, cy + 21].every(y => document.elementFromPoint(cx, y) === dot);
          out.swatches.push(hitsDot);
        }
        return out;
      `);
      assert.deepStrictEqual(hits.small, [], "controls shorter than 44px");
      assert.strictEqual(hits.swatches.length, 6);
      assert.ok(hits.swatches.every(Boolean),
        `a palette swatch has no 44px hit area: ${JSON.stringify(hits.swatches)}`);
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  /* ---------------------------------------------------------------- *
   * the Edit sheet (Phase 4, lane 4c)
   *
   * The SAME sheet, reopened from the already-selected custom chip. Every
   * case here runs at 380px, which is where a bottom sheet with three more
   * rows is actually at risk.
   * ---------------------------------------------------------------- */

  const EDIT_SCALE = SIX_SCALES[1];        // "(D3) A3 C4 D4 E4 F4 G4 A4 C5"

  const openEdit = async () => {
    await b.eval(`document.querySelector("#decks .chip.on")
                    .scrollIntoView({ block: "nearest", inline: "nearest" }); return true;`);
    await b.click("#decks .chip.on");
    await b.waitFor(`!document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "the Edit sheet to open" });
  };

  /** Generate a deck at 380px and reopen it in Edit state. */
  async function editFreshDeck() {
    await freshLoad();
    await b.setViewport(380, 780, true);
    await generate(EDIT_SCALE);
    await openEdit();
  }

  const activeChipText = () => b.eval(`
    const el = document.activeElement;
    return el && el.closest && el.closest("#decks") ? el.textContent.trim() : null;
  `);

  test("the selected custom chip reopens the sheet in Edit state, prefilled, at 380px", async () => {
    try {
      await freshLoad();
      await b.setViewport(380, 780, true);
      const beforeCardW = await b.eval(
        `return getComputedStyle(document.documentElement).getPropertyValue("--card-w");`);
      await generate(EDIT_SCALE);
      await openEdit();

      const st = await b.eval(`
        const rows = ["scale-name-row", "scale-degrees-row", "scale-delete-row"]
          .map(id => !document.getElementById(id).hasAttribute("hidden"));
        const surf = document.getElementById("scale-sheet").firstElementChild
          .getBoundingClientRect();
        return {
          rows,
          box: document.getElementById("scale-box").value,
          name: document.getElementById("scale-name").value,
          degrees: document.getElementById("scale-degrees").options.length,
          primary: document.getElementById("scale-generate").textContent.trim(),
          del: document.getElementById("scale-delete").textContent.trim(),
          delColor: getComputedStyle(document.getElementById("scale-delete")).color,
          delWide: document.getElementById("scale-delete")
            .getBoundingClientRect().width > surf.width * 0.8,
          cardW: getComputedStyle(document.documentElement).getPropertyValue("--card-w"),
          body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
        };
      `);
      assert.deepStrictEqual(st.rows, [true, true, true], "an Edit-only row is hidden");
      assert.match(st.box, /^\(D3\) /, `the Edit box reads "${st.box}"`);
      assert.ok(st.name.length > 0, "the Name field is empty");
      assert.strictEqual(st.degrees, 11, "the Degrees select is not the 11 candidates");
      assert.strictEqual(st.primary, "SAVE CHANGES");
      assert.strictEqual(st.del, "DELETE THIS DECK");
      assert.strictEqual(st.delColor, "rgb(167, 157, 139)", "the delete link is not #a79d8b");
      assert.strictEqual(st.delWide, false, "the delete link reads as a second primary");
      assert.strictEqual(st.cardW, beforeCardW, "--card-w moved when the Edit sheet opened");
      assert.ok(st.body.sw <= st.body.cw + 1,
        `the Edit sheet scrolls the page horizontally (${st.body.sw} > ${st.body.cw})`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("Escape closes the Edit sheet and focus returns to the chip that opened it", async () => {
    try {
      await editFreshDeck();
      await b.key("Escape", "Escape", 27);
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "Escape to close the Edit sheet" });
      const back = await activeChipText();
      assert.ok(back, "focus did not return to a deck chip");
      assert.notStrictEqual(await activeId(), "deck-add",
        "focus went to + ADD instead of the chip that opened the sheet");
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("a backdrop tap closes the Edit sheet", async () => {
    try {
      await editFreshDeck();
      await clickPoint(8, 8);
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "a backdrop tap to close the Edit sheet" });
      assert.strictEqual(await sheetShown(), false);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("Tab is trapped inside the Edit sheet and reaches every Edit control", async () => {
    try {
      await editFreshDeck();
      const seen = [];
      for (let i = 0; i < 26; i++) {
        await b.key("Tab", "Tab", 9);
        seen.push(await b.eval(`
          const el = document.activeElement;
          const sheet = document.getElementById("scale-sheet");
          return { id: (el && el.id) || (el && el.className) || "",
                   inside: !!(el && sheet.contains(el)) };
        `));
      }
      assert.ok(seen.every(s => s.inside),
        `Tab escaped the Edit sheet: ${JSON.stringify(seen)}`);
      const ids = new Set(seen.map(s => s.id));
      for (const id of ["scale-name", "scale-box", "scale-degrees", "scale-generate", "scale-delete",
                        "scale-rot-l", "scale-rot-r", "scale-layout-reset",
                        "scale-move-l", "scale-move-r"]) {
        assert.ok(ids.has(id), `Tab never reached #${id}: ${JSON.stringify([...ids])}`);
      }
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  test("renaming from the Edit sheet relabels the chip", async () => {
    try {
      await editFreshDeck();
      await b.eval(`
        const el = document.getElementById("scale-name");
        el.value = "RAY'S PAN";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return el.value;
      `);
      await b.click("#scale-generate");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the Edit sheet to close after SAVE CHANGES" });
      const row = await b.eval(`
        return { on: [...document.querySelectorAll("#decks .chip.on")].map(c => c.textContent.trim()),
                 body: { sw: document.body.scrollWidth, cw: document.body.clientWidth } };
      `);
      assert.deepStrictEqual(row.on, ["RAY'S PAN"], "the chip kept the old label");
      assert.ok(row.body.sw <= row.body.cw + 1, "the renamed chip blew the row out");
    } finally {
      await b.setViewport(900, 900, false);
    }
  });


  /* ---------------------------------------------------------------- *
   * the LAYOUT correction (Phase 5)
   *
   * What a unit test cannot show: that someone with only a keyboard can
   * reach these controls and use them, at a real 380px viewport, without
   * the page growing a horizontal scrollbar or the card behind the sheet
   * changing size.
   * ---------------------------------------------------------------- */

  /** Tab until `id` has focus. Keyboard only - no click, no .focus() call. */
  async function tabTo(id, max = 28) {
    for (let i = 0; i < max; i++) {
      if (await activeId() === id) return true;
      await b.key("Tab", "Tab", 9);
    }
    return (await activeId()) === id;
  }

  /** Press the focused control the way a keyboard user does. A button is
   *  activated by the browser's OWN default handler, and that only runs when
   *  the key event carries its text: a bare keyDown produces no keypress and
   *  so no activation. Nothing here is a click - if the app needed a pointer,
   *  none of this would work. */
  const pressActive = async () => {
    for (const type of ["keyDown", "keyUp"]) {
      await b.send("Input.dispatchKeyEvent", {
        type, key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r",
        windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
      });
    }
  };

  const slotState = () => b.eval(`
    const slots = [...document.getElementById("scale-slots").children];
    const row = document.getElementById("scale-layout-row").getBoundingClientRect();
    return {
      notes: slots.map(s => s.textContent.trim()),
      pressed: slots.findIndex(s => s.getAttribute("aria-pressed") === "true"),
      stops: slots.filter(s => s.tabIndex === 0).length,
      named: slots.every(s => (s.getAttribute("aria-label") || "").length > 0),
      inside: slots.every(s => {
        const r = s.getBoundingClientRect();
        return r.left >= row.left - 1 && r.right <= row.right + 1;
      }),
      body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
      cardW: getComputedStyle(document.documentElement).getPropertyValue("--card-w"),
    };
  `);

  const noOverflow = (st, what) =>
    assert.ok(st.body.sw <= st.body.cw + 1,
      `${what} scrolls the page horizontally (${st.body.sw} > ${st.body.cw})`);

  test("ROTATE makes its correction from the keyboard alone at 380px", async () => {
    try {
      await editFreshDeck();
      const before = await slotState();
      assert.ok(before.notes.length >= 8, `the slot list is ${JSON.stringify(before.notes)}`);
      assert.strictEqual(before.stops, 1, "the slot list is not a single tab stop");
      assert.strictEqual(before.named, true, "a slot control has no accessible name");
      assert.strictEqual(before.inside, true, "the slot list overflows its row");
      noOverflow(before, "the LAYOUT section");

      assert.ok(await tabTo("scale-rot-r"), "Tab never reached ROTATE");
      await pressActive();
      const after = await slotState();
      assert.notDeepStrictEqual(after.notes, before.notes, "ROTATE moved nothing");
      assert.deepStrictEqual([...after.notes].sort(), [...before.notes].sort(),
        "ROTATE invented or lost a note");
      noOverflow(after, "a rotated layout");
      assert.strictEqual(after.cardW, before.cardW, "ROTATE moved --card-w");

      // and it commits through the sheet's ONE primary
      await b.click("#scale-generate");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the Edit sheet to close after SAVE CHANGES" });
      await openEdit();
      assert.deepStrictEqual((await slotState()).notes, after.notes,
        "the saved correction did not come back with the sheet");
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  test("the arrow keys choose a position and MOVE swaps it with its neighbour", async () => {
    try {
      await editFreshDeck();
      const before = await slotState();
      assert.ok(await tabTo("scale-slot-" + before.pressed), "Tab never reached the slot list");
      await b.key("ArrowRight", "ArrowRight", 39);
      const chosen = await slotState();
      assert.strictEqual(chosen.pressed, before.pressed + 1,
        "ArrowRight did not move the chosen position");
      assert.strictEqual(await activeId(), "scale-slot-" + chosen.pressed,
        "focus did not follow the chosen position");

      assert.ok(await tabTo("scale-move-r"), "Tab never reached MOVE");
      await pressActive();
      const moved = await slotState();
      assert.strictEqual(moved.notes[chosen.pressed], before.notes[chosen.pressed + 1],
        "MOVE did not move the chosen note");
      assert.strictEqual(moved.notes[chosen.pressed + 1], before.notes[chosen.pressed],
        "MOVE did not displace the note it passed");
      assert.strictEqual(moved.pressed, chosen.pressed + 1,
        "the chosen position did not follow the note");
      noOverflow(moved, "a moved note");
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  test("RESET puts the generated layout back in one keyboard action", async () => {
    try {
      await editFreshDeck();
      const before = await slotState();
      assert.ok(await tabTo("scale-rot-r"), "Tab never reached ROTATE");
      await pressActive();
      await pressActive();
      assert.notDeepStrictEqual((await slotState()).notes, before.notes,
        "two rotations moved nothing");

      assert.ok(await tabTo("scale-layout-reset"), "Tab never reached RESET");
      await pressActive();
      const back = await slotState();
      assert.deepStrictEqual(back.notes, before.notes,
        "RESET did not put the generated layout back");
      noOverflow(back, "the reset layout");
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  test("every LAYOUT control is a 44px target with a visible focus ring", async () => {
    try {
      await editFreshDeck();
      const ids = ["scale-rot-l", "scale-rot-r", "scale-layout-reset",
                   "scale-move-l", "scale-move-r"];
      const small = await b.eval(`
        const ids = ${JSON.stringify(ids)}.concat(["scale-slot-0"]);
        return ids.map(id => {
          const el = document.getElementById(id);
          const r = el.getBoundingClientRect();
          return { id, w: Math.round(r.width), h: Math.round(r.height) };
        }).filter(t => t.w < 44 || t.h < 44);
      `);
      assert.deepStrictEqual(small, [], `LAYOUT controls under 44px: ${JSON.stringify(small)}`);

      // A keyboard user must be able to SEE where they are: the sheet's
      // :focus-visible ring is #e3b25c and these controls are no exception.
      for (const id of ids) {
        assert.ok(await tabTo(id), `Tab never reached #${id}`);
        const ring = await b.eval(`
          const cs = getComputedStyle(document.activeElement);
          return { id: document.activeElement.id, color: cs.outlineColor,
                   width: parseFloat(cs.outlineWidth) || 0, style: cs.outlineStyle };
        `);
        assert.strictEqual(ring.id, id);
        assert.strictEqual(ring.color, "rgb(227, 178, 92)", `#${id} has no #e3b25c ring`);
        assert.ok(ring.width >= 2, `#${id} focus ring is ${ring.width}px`);
        assert.notStrictEqual(ring.style, "none", `#${id} focus ring is styled away`);
      }
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  test("deleting the selected deck falls back to a built-in with a visible message", async () => {
    try {
      await editFreshDeck();
      const gone = await b.eval(`return document.querySelector("#decks .chip.on").textContent.trim();`);
      await b.click("#scale-delete");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the Edit sheet to close after DELETE" });

      const after = await b.eval(`
        const a = document.querySelector(".announce");
        const r = a.getBoundingClientRect();
        const cs = getComputedStyle(a);
        return {
          chips: [...document.querySelectorAll("#decks .chip:not(#deck-add)")].map(c => c.textContent.trim()),
          on: [...document.querySelectorAll("#decks .chip.on")].map(c => c.textContent.trim()),
          said: a.textContent.trim(),
          shown: r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none",
          cardW: getComputedStyle(document.documentElement).getPropertyValue("--card-w"),
          body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
        };
      `);
      assert.strictEqual(after.chips.length, 3, "the deleted deck is still in the chip row");
      assert.strictEqual(after.on.length, 1, "not exactly one selected chip after a delete");
      assert.strictEqual(after.on[0], after.chips[0], "the fallback is not the FIRST built-in");
      assert.ok(after.said.includes(gone), `the delete message never named the deck: "${after.said}"`);
      assert.strictEqual(after.shown, true, "the delete message is not visible");
      assert.ok(after.body.sw <= after.body.cw + 1, "the page scrolls horizontally after a delete");

      // and it stays gone across a reload
      await navigate();
      await b.waitFor(`document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`,
        { label: "deck chips after the reload" });
      const back = await b.eval(
        `return [...document.querySelectorAll("#decks .chip:not(#deck-add)")].map(c => c.textContent.trim());`);
      assert.strictEqual(back.length, 3, `the deleted deck came back: ${JSON.stringify(back)}`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  /* ----------------------------------------------------------------
   * a field edit REPLACES the deck (queue row 73), at 380px
   *
   * "Edit means edit": the old deck leaves the row, the replacement takes its
   * position and its selection, and its label is re-derived from the new notes
   * - so the two indistinguishable chips of the reproduction cannot appear.
   * ---------------------------------------------------------------- */

  const EDIT_MORE_SCALE = EDIT_SCALE + " D5";   // one note appended: new fields

  /** Retype the scale box and press SAVE CHANGES on an open Edit sheet. */
  async function saveFields(scale) {
    await typeScale(scale);
    await b.click("#scale-generate");
    await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "the Edit sheet to close after SAVE CHANGES" });
  }

  const chipReport = () => b.eval(`
    return {
      chips: [...document.querySelectorAll("#decks .chip:not(#deck-add)")].map(c => c.textContent.trim()),
      on: [...document.querySelectorAll("#decks .chip.on")].map(c => c.textContent.trim()),
      cardW: getComputedStyle(document.documentElement).getPropertyValue("--card-w"),
      body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
    };
  `);

  test("a field edit leaves one chip for the deck, selected and relabelled, at 380px", async () => {
    try {
      await editFreshDeck();
      const before = await chipReport();
      assert.strictEqual(before.on.length, 1, "the setup did not leave one selected chip");
      const was = before.on[0];

      await saveFields(EDIT_MORE_SCALE);
      const after = await chipReport();

      assert.strictEqual(after.chips.length, before.chips.length,
        `the edit forked the deck: ${JSON.stringify(after.chips)}`);
      assert.strictEqual(after.on.length, 1,
        `not exactly one selected chip after a field edit: ${JSON.stringify(after.on)}`);
      assert.notStrictEqual(after.on[0], was,
        "the chip label was pinned to the pre-edit notes");
      assert.strictEqual(after.chips.filter(c => c === was).length, 0,
        `the pre-edit chip is still in the row: ${JSON.stringify(after.chips)}`);
      assert.strictEqual(after.cardW, before.cardW, "--card-w moved on a field edit");
      assert.ok(after.body.sw <= after.body.cw + 1,
        `the row scrolls the page horizontally (${after.body.sw} > ${after.body.cw})`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("the replacement takes the old chip's position and keeps it across a reload", async () => {
    try {
      await freshLoad();
      await b.setViewport(380, 780, true);
      await generate(EDIT_SCALE);
      await generate(SIX_SCALES[2]);
      const before = await chipReport();
      const at = before.chips.indexOf(before.on[0]) - 1;   // the FIRST custom deck
      assert.ok(at >= 0, `no two custom chips: ${JSON.stringify(before.chips)}`);
      const target = before.chips[at];

      // select the first custom deck, then reopen it in Edit and change its notes
      await b.eval(`
        const c = [...document.querySelectorAll("#decks .chip:not(#deck-add)")][${at}];
        c.scrollIntoView({ block: "nearest", inline: "nearest" });
        c.click();
        return true;
      `);
      await openEdit();
      await saveFields(EDIT_MORE_SCALE);

      const after = await chipReport();
      assert.strictEqual(after.chips.length, before.chips.length,
        `the edit forked the deck: ${JSON.stringify(after.chips)}`);
      assert.notStrictEqual(after.chips[at], target, "the chip was never relabelled");
      assert.deepStrictEqual(after.on, [after.chips[at]],
        `the replacement is not the chip at position ${at}: ${JSON.stringify(after)}`);
      assert.ok(after.body.sw <= after.body.cw + 1, "the row scrolls the page horizontally");

      await navigate();
      await b.waitFor(`document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`,
        { label: "deck chips after the reload" });
      const back = await chipReport();
      assert.deepStrictEqual(back.chips, after.chips,
        `the chip row changed across a reload: ${JSON.stringify(back.chips)}`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

}
