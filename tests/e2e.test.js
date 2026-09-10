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
// Loopback only, and by default port 0 - the OS hands out a free port, so two
// suites running side by side (several agents share this machine) simply cannot
// collide. E2E_PORT pins a specific port when you want one; a pinned port that
// is already taken is a LOUD, immediate failure, never a hang - see the before()
// hook and the "a taken port fails the harness fast" test at the end of this file.
const PORT = Number(process.env.E2E_PORT) || 0;
// Not known until the server is listening (port 0 is resolved by the OS).
// NB: this deliberately shadows the global URL class for the whole module.
let URL = "";

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
    // listen() calls its callback ONLY on success: on EADDRINUSE it emits
    // 'error' and the callback never runs. Awaiting the callback alone is an
    // unbounded hang on a taken port - the exact case waitForServer's message
    // below was written for, and one that used to stall CI until it was killed
    // from outside. So settle on BOTH outcomes and fail loudly.
    await new Promise((resolve, reject) => {
      server.once("error", (e) => {
        reject(new Error(
          `the test server could not listen on 127.0.0.1:${PORT} (${e.code || e.message})` +
          ` - is port ${PORT} taken? (E2E_PORT pins this port; unset it to let the` +
          ` OS pick a free one)`,
        ));
      });
      server.listen(PORT, "127.0.0.1", resolve);
    });
    // Port 0 is only resolved once the socket is bound.
    URL = `http://127.0.0.1:${server.address().port}/index.html`;
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
          `the test server never came up on ${URL} - is that port taken? (E2E_PORT pins one)`,
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
  // Deliberately does NOT scroll first: this helper is load-bearing for tests
  // that are not about scrolling, and a scroll here hides exactly the class of
  // bug where something else has come to rest on top of the chip.
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
          // + ADD is deliberately NOT one of these chips: it lives outside the
          // scrollport so that it is always reachable and no chip can come to
          // rest under it. Its own tests are further down this file.
          addInsideStrip: nav.contains(document.getElementById("deck-add")),
          body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
        };
      `);
      assert.strictEqual(row.chips, 3 + 6, "three built-ins and six customs");
      assert.strictEqual(row.tops.length, 1, `the chip row wrapped onto ${row.tops.length} lines`);
      assert.strictEqual(row.wraps, false, "the chip row grew taller than one line");
      assert.strictEqual(row.rowScrolls, true, "nine chips at 380px should scroll horizontally");
      assert.strictEqual(row.activeInView, true, "the active chip is not scrolled into view");
      assert.strictEqual(row.addInsideStrip, false, "+ ADD is back inside the scrolling strip");
      assert.ok(row.body.sw <= row.body.cw + 1, "the chip row blew the page out horizontally");
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  /* ---------------------------------------------------------------- *
   * + ADD reachability at phone widths
   *
   * Owner-reported: "I do not see the pan visual before generating the chord
   * cards." The preview was fine - its ONLY entry point was not. With the
   * three built-in decks the chip row already overflows a phone viewport
   * (scrollWidth 469 vs clientWidth 356 at 380px) and + ADD, being last, started
   * at x=416 - entirely past the right edge at 380, 390 and 430 CSS px alike.
   * It is on-screen at 768px and above, which is why review never caught it.
   *
   * 390x844 is the owner's own device (iPhone 14, iOS 26.6, Safari) and comes
   * first; 380x800 is the repo's stated test width (CLAUDE.md); 430x930 is the
   * widest phone that still overflows.
   *
   * These tests deliberately do NOT scrollIntoView first - the owner cannot
   * do that, and neither may the test that guards them.
   * ---------------------------------------------------------------- */
  test("+ ADD is fully on-screen and hit-testable at phone widths", async () => {
    await freshLoad();
    try {
      // Every width twice: once with the three built-ins (103px of overflow)
      // and once with three more custom decks on top, because the overflow
      // grows with every deck generated and buildChips only ever scrolls the
      // SELECTED chip into view - never + ADD.
      const widths = [[390, 844], [380, 800], [430, 930]];
      let overflowed = 0;
      for (const [vw, vh] of [...widths, ...widths]) {
        await b.setViewport(vw, vh, true);
        const m = await b.eval(`
          const add = document.getElementById("deck-add");
          const nav = document.getElementById("decks");
          const r = add.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return {
            r: { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height },
            vw: document.documentElement.clientWidth,
            vh: document.documentElement.clientHeight,
            overflows: nav.scrollWidth > nav.clientWidth + 1,
            decks: nav.querySelectorAll(".chip:not(#deck-add)").length,
            hitIsAdd: !!hit && (hit === add || add.contains(hit)),
            body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
          };
        `);
        const at = `at ${vw}x${vh} with ${m.decks} decks`;
        // The strip spans the full width now, so a three-deck row happens to
        // fit at 430. Count the states that DO overflow instead of demanding it
        // everywhere, and assert the count after the loop so the matrix can
        // never go vacuous.
        if (m.overflows) overflowed++;
        assert.ok(m.r.l >= -1 && m.r.r <= m.vw + 1,
          `+ ADD is not inside the viewport ${at}: ${JSON.stringify(m.r)}`);
        assert.ok(m.r.t >= -1 && m.r.b <= m.vh + 1,
          `+ ADD is cut off vertically ${at}: ${JSON.stringify(m.r)}`);
        assert.ok(m.r.h >= 43.5 && m.r.w > 20,
          `+ ADD lost its 44px touch target ${at}: ${JSON.stringify(m.r)}`);
        assert.strictEqual(m.hitIsAdd, true,
          `nothing hit-tests to + ADD at its own centre ${at}: ${JSON.stringify(m.r)}`);
        assert.ok(m.body.sw <= m.body.cw + 1,
          `the page scrolls horizontally ${at} (${m.body.sw} > ${m.body.cw})`);

        // A real click at that centre point, with no scrolling first.
        await b.click("#deck-add");
        await b.waitFor(`!document.getElementById("scale-sheet").hasAttribute("hidden")`,
          { label: `the sheet to open from a plain tap on + ADD ${at}` });
        await b.key("Escape", "Escape", 27);
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
          { label: `the sheet to close again ${at}` });

        // Halfway through, lengthen the strip and go round again.
        if (m.decks === 3 && vw === 430) {
          for (const s of SIX_SCALES.slice(0, 3)) await generate(s);
        }
      }
      assert.ok(overflowed >= 4,
        `only ${overflowed} of the probed states overflowed the chip row; ` +
        `this test proves nothing unless + ADD is reachable while the strip scrolls`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("the owner's journey at 380px: tap + ADD, type a scale, see the pan", async () => {
    await freshLoad();
    await b.setViewport(380, 800, true);
    try {
      await b.click("#deck-add");
      await b.waitFor(`!document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the scale sheet to open from a plain tap on + ADD at 380px" });
      await typeScale("(D) A C D E F G A C");
      await b.waitFor(
        `(() => { const p = document.getElementById("scale-preview");
                  return !!p && !p.hasAttribute("hidden") && !!p.querySelector("svg"); })()`,
        { label: "the pan preview to render" });

      const m = await b.eval(`
        const p = document.getElementById("scale-preview");
        const s = document.querySelector(".sheetsurf");
        const pr = p.getBoundingClientRect(), sr = s.getBoundingClientRect();
        const sv = p.querySelector("svg").getBoundingClientRect();
        return {
          pr: { l: pr.left, r: pr.right, t: pr.top, b: pr.bottom, w: pr.width, h: pr.height },
          sr: { l: sr.left, r: sr.right, t: sr.top, b: sr.bottom },
          sv: { w: sv.width, h: sv.height },
          vh: document.documentElement.clientHeight,
          vw: document.documentElement.clientWidth,
        };
      `);
      assert.ok(m.pr.w > 40 && m.pr.h > 40,
        `the pan preview has no size: ${JSON.stringify(m.pr)}`);
      assert.ok(m.sv.w > 20 && m.sv.h > 20,
        `the preview svg has no size: ${JSON.stringify(m.sv)}`);
      assert.ok(m.pr.l >= m.sr.l - 1 && m.pr.r <= m.sr.r + 1
                && m.pr.t >= m.sr.t - 1 && m.pr.b <= m.sr.b + 1,
        `the pan preview is outside the visible sheet surface: ` +
        `${JSON.stringify(m.pr)} vs ${JSON.stringify(m.sr)}`);
      assert.ok(m.pr.t >= -1 && m.pr.b <= m.vh + 1 && m.pr.l >= -1 && m.pr.r <= m.vw + 1,
        `the pan preview is off a 380x800 screen: ${JSON.stringify(m.pr)}`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  /* No deck chip may ever come to rest UNDER + ADD.
   *
   * This is the test the first attempt at this fix did not have, and the
   * regression it let through: with + ADD pinned over the strip as a sticky
   * overlay, D AMARA 9 sat at x 296.1-407.9 under a pin at 290.8-356 on a plain
   * fresh load at 390x844. The chip was fully visible, its centre hit-tested to
   * deck-add, and tapping it opened the create sheet instead of switching decks
   * - a wrong-action mis-tap on a built-in deck, worse than the unreachable
   * + ADD it was meant to fix.
   *
   * A rect check cannot see that; only elementFromPoint can, which is why every
   * assertion below is a hit test. Three points per chip - the centre and both
   * inner thirds - because an overlay can leave a sliver of a chip exposed and
   * still steal the tap anyone would actually aim. Points outside the strip's
   * scrollport are simply scrolled out of view and are not the subject here;
   * points inside it must belong to whatever is drawn there.
   */
  test("no deck chip ever rests under + ADD, at any width, state or scroll", async () => {
    await freshLoad();
    const meta = await decksMeta();
    try {
      // Hit-test every visible point of every chip, plus + ADD, in one pass.
      const sweep = (state) => b.eval(`
        const nav = document.getElementById("decks");
        const add = document.getElementById("deck-add");
        const nr = nav.getBoundingClientRect();
        const owns = (el, hit) => !!hit && (hit === el || el.contains(hit));
        const pts = (r) => [
          { name: "left third", x: r.left + r.width / 3 },
          { name: "centre", x: r.left + r.width / 2 },
          { name: "right third", x: r.left + (r.width * 2) / 3 },
        ];
        const bad = [];
        let probed = 0;
        for (const c of nav.querySelectorAll(".chip")) {
          const r = c.getBoundingClientRect();
          const y = r.top + r.height / 2;
          for (const p of pts(r)) {
            // Only points actually inside the scrollport can be tapped at all.
            if (p.x < nr.left || p.x > nr.right) continue;
            probed++;
            const hit = document.elementFromPoint(p.x, y);
            if (!owns(c, hit)) bad.push({
              chip: c.textContent.trim(), point: p.name, x: Math.round(p.x),
              got: hit ? (hit.id || hit.className || hit.tagName) : null,
              chipRect: [Math.round(r.left), Math.round(r.right)],
              addRect: [Math.round(add.getBoundingClientRect().left),
                        Math.round(add.getBoundingClientRect().right)],
            });
          }
        }
        // + ADD must answer for itself at all three of its own points.
        const ar = add.getBoundingClientRect();
        const ay = ar.top + ar.height / 2;
        for (const p of pts(ar)) {
          probed++;
          if (!owns(add, document.elementFromPoint(p.x, ay)))
            bad.push({ chip: "+ ADD", point: p.name, x: Math.round(p.x), got: "not itself" });
        }
        return { bad, probed, chips: nav.querySelectorAll(".chip").length };
      `);

      const expectClean = async (state) => {
        const m = await sweep(state);
        assert.ok(m.probed > 0, `${state}: nothing was probed at all`);
        assert.deepStrictEqual(m.bad, [],
          `${state}: a visible point does not hit-test to what is drawn there ` +
          `(${JSON.stringify(m.bad)})`);
      };

      // Fresh load, then selecting each deck in turn, then flicked to each end
      // - buildChips scrolls the SELECTED chip into view, so selecting one deck
      // is what parks a different one wherever it lands.
      const flick = (to) => b.eval(
        `const n = document.getElementById("decks");
         n.scrollLeft = ${to === "end" ? "n.scrollWidth" : "0"};
         return n.scrollLeft;`);

      // Scrolling belongs inside the test that needs it, never in the shared
      // selectDeck helper - a scroll there hides the very bug this test hunts.
      const selectChip = async (i) => {
        await b.eval(`document.querySelectorAll("#decks .chip")[${i}]
                        .scrollIntoView({ block: "nearest", inline: "nearest" });
                      return true;`);
        await b.click(`#decks .chip:nth-child(${i + 1})`);
        await b.waitFor(
          `document.querySelectorAll("#decks .chip")[${i}].classList.contains("on")`,
          { label: `deck chip ${i} to become the active deck` });
      };

      for (const [vw, vh] of [[390, 844], [380, 800], [430, 930]]) {
        await b.setViewport(vw, vh, true);
        const size = () => b.eval(
          `return document.querySelectorAll("#decks .chip").length;`);
        const at = `${vw}x${vh}, ${await size()} decks`;

        await expectClean(`${at}, fresh load`);
        for (let i = 0; i < meta.length; i++) {
          await selectChip(i);
          await expectClean(`${at}, after selecting ${meta[i].id}`);
        }
        await flick("start");
        await expectClean(`${at}, flicked to the start`);
        await flick("end");
        await expectClean(`${at}, flicked to the end`);
      }

      // And again with nine decks, where the strip is three times its width.
      await b.setViewport(380, 800, true);
      for (const s of SIX_SCALES) await generate(s);
      for (const [vw, vh] of [[390, 844], [380, 800], [430, 930]]) {
        await b.setViewport(vw, vh, true);
        const at = `${vw}x${vh}, nine decks`;
        await expectClean(`${at}, fresh from a generate`);
        for (let i = 0; i < meta.length; i++) {
          await selectChip(i);
          await expectClean(`${at}, after selecting ${meta[i].id}`);
        }
        await flick("start");
        await expectClean(`${at}, flicked to the start`);
        await flick("end");
        await expectClean(`${at}, flicked to the end`);
      }
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

  /* ---------------------------------------------------------------- *
   * 7b. landscape - the card must FIT, not float over the chrome
   *
   * Owner-reported via the mobile audit (coordination row 210): held
   * sideways, an iPhone 14 (844x390) loses NAME<->NOTES, SHUFFLE, the
   * counter and + ADD. The cause is a one-way size constraint. `--card-w`
   * is min(88vw, 46vh, 420px) and `.scene` took it as its WIDTH, deriving
   * height from aspect-ratio 63/87 - so at 390px tall the card asked for
   * 46vh = 179.4 wide and therefore 247.7 TALL, inside a `main` that only
   * had 113.8px to give. `align-items:center` split the ~134px of overflow
   * above and below, laying the card over the header and the footer.
   *
   * Why these assertions are hit-tests and not rectangles: every one of
   * those controls has a rect that is fully on-screen and correctly sized
   * even while it is buried. Only `document.elementFromPoint` at the point
   * a thumb actually lands can see the difference, and two escaped defects
   * in this workstream came from checking rects instead.
   *
   * Why the matrix also asserts the card is MAXIMAL, not merely contained:
   * the obvious fixes make the card fit by destroying it. The audit's own
   * suggestion (`max-height:100%; width:auto; max-width:var(--card-w)`)
   * leaves BOTH axes indefinite - `.card` and both `.face`es are
   * percentage- and absolutely-sized, so the scene has no intrinsic width
   * to fall back on - and it measures 0x0 at every viewport probed here,
   * portrait included. Every control hit-tests perfectly with no card on
   * the page at all. So each cell also demands the card be as large as the
   * ratio and the available box allow, which is what pins the fix to
   * "derive the binding axis from the space" rather than "collapse".
   * ---------------------------------------------------------------- */

  // The controls the audit measured as buried, plus the two arrows it
  // measured as still reachable (they sit outside the card's x-range, so
  // they are the negative control: a fix that moves the card sideways
  // instead of shrinking it would show up here).
  const LANDSCAPE_CONTROLS = ["#modeA", "#modeB", ".shuffle", ".count", "#deck-add", "#prev", "#next"];

  // One reading of the whole page: where every control's centre actually
  // hit-tests, where the card sits relative to its container, and how big
  // the card is against the largest size the box could hold.
  //
  // --card-w is resolved by measuring a throwaway element rather than by
  // re-implementing its min() here, and the ratio is read off the computed
  // aspect-ratio, so a restyle of either cannot make this test lie.
  const layoutProbe = () => b.eval(`
    const sels = ${JSON.stringify(LANDSCAPE_CONTROLS)};
    const name = (n) => !n ? "null"
      : (n.id ? "#" + n.id
        : n.tagName.toLowerCase() + (typeof n.className === "string" && n.className.trim()
          ? "." + n.className.trim().split(/\\s+/).join(".") : ""));
    const controls = sels.map((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { sel, missing: true };
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        sel,
        hitsSelf: !!hit && (hit === el || el.contains(hit)),
        hit: name(hit),
        r: { l: +r.left.toFixed(1), t: +r.top.toFixed(1), r: +r.right.toFixed(1), b: +r.bottom.toFixed(1) },
      };
    });
    const scene = document.querySelector(".scene");
    const s = scene.getBoundingClientRect();
    const mn = document.querySelector("main").getBoundingClientRect();
    // Resolve var(--card-w) exactly, without duplicating its formula.
    const ruler = document.createElement("div");
    ruler.style.cssText = "position:absolute;visibility:hidden;width:var(--card-w)";
    document.body.appendChild(ruler);
    const cardW = ruler.getBoundingClientRect().width;
    ruler.remove();
    const ar = getComputedStyle(scene).aspectRatio.split("/").map((n) => parseFloat(n));
    const ratio = ar.length === 2 && ar[1] ? ar[0] / ar[1] : 63 / 87;
    return {
      controls,
      scene: { l: +s.left.toFixed(1), t: +s.top.toFixed(1), r: +s.right.toFixed(1), b: +s.bottom.toFixed(1),
               w: +s.width.toFixed(1), h: +s.height.toFixed(1) },
      main: { l: +mn.left.toFixed(1), t: +mn.top.toFixed(1), r: +mn.right.toFixed(1), b: +mn.bottom.toFixed(1),
              w: +mn.width.toFixed(1), h: +mn.height.toFixed(1) },
      // The widest the card may be (its own cap) and the widest the box can
      // hold at this ratio. A correct fix lands on the smaller of the two.
      cardW: +cardW.toFixed(1),
      fitW: +Math.min(cardW, mn.height * ratio).toFixed(1),
      vw: document.documentElement.clientWidth,
      vh: document.documentElement.clientHeight,
      body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
    };
  `);

  // Assert one cell of the matrix: nothing buried, card inside its box, card
  // as big as that box allows. `at` names the viewport AND the state, so a
  // failure line says which cell without counting loop iterations.
  async function assertCardFits(at) {
    const m = await layoutProbe();
    for (const c of m.controls) {
      assert.ok(!c.missing, `${c.sel} is missing from the page ${at}`);
      assert.strictEqual(c.hitsSelf, true,
        `${c.sel} is not tappable ${at}: elementFromPoint at its centre returned ` +
        `${c.hit} (its rect is ${JSON.stringify(c.r)}, so a rect check would have passed). ` +
        `The card is at ${JSON.stringify(m.scene)} inside main ${JSON.stringify(m.main)}.`);
    }
    assert.ok(m.scene.t >= m.main.t - 1 && m.scene.b <= m.main.b + 1,
      `the card overflows main vertically ${at}: card ${JSON.stringify(m.scene)} ` +
      `vs main ${JSON.stringify(m.main)}`);
    assert.ok(m.scene.l >= m.main.l - 1 && m.scene.r <= m.main.r + 1,
      `the card overflows main horizontally ${at}: card ${JSON.stringify(m.scene)} ` +
      `vs main ${JSON.stringify(m.main)}`);
    assert.ok(m.scene.w >= m.fitW - 1.5,
      `the card is smaller than the space allows ${at}: ${m.scene.w}px wide where ` +
      `${m.fitW}px fits (cap ${m.cardW}px, main is ${m.main.h}px tall). ` +
      `Making the controls reachable by collapsing the card is not a fix.`);
    assert.ok(m.scene.w <= m.cardW + 1,
      `the card exceeds its own --card-w cap ${at}: ${m.scene.w} > ${m.cardW}`);
    assert.ok(m.body.sw <= m.body.cw + 1,
      `the page scrolls horizontally ${at} (${m.body.sw} > ${m.body.cw})`);
    return m;
  }

  const flip = async (want) => {
    await b.click("#card");
    await b.waitFor(
      `document.getElementById("card").classList.contains("flip") === ${want}`,
      { label: `the card to ${want ? "flip" : "flip back"}` },
    );
  };

  test("in landscape every control stays tappable and the card fits, at every size and state", async () => {
    await freshLoad();
    const meta = await decksMeta();
    try {
      // 844x390 is the reported device (iPhone 14 sideways); 926x428 is the
      // largest current phone; 667x375 is an SE, the shortest landscape a
      // phone offers; 1280x500 is a short-but-wide desktop window, which the
      // audit never probed and which is broken on main too. A single-width
      // landscape probe is what nit (b) was filed against last cycle.
      for (const [vw, vh] of [[844, 390], [926, 428], [667, 375], [1280, 500]]) {
        await b.setViewport(vw, vh, true);
        await assertCardFits(`at ${vw}x${vh} on load`);

        // Flipped: the back face is the taller content, and the flip is a
        // 3d transform under `perspective`, which a width:auto scene can
        // resolve differently from a width-driven one.
        await flip(true);
        await assertCardFits(`at ${vw}x${vh} with the card flipped`);
        await flip(false);

        // Switching decks re-renders the card and rebuilds the chip row, so
        // it is the state in which a height-driven card could relayout.
        await selectDeck(1, meta);
        await assertCardFits(`at ${vw}x${vh} after switching to ${meta[1].id}`);
        await selectDeck(0, meta);
        await assertCardFits(`at ${vw}x${vh} after switching back to ${meta[0].id}`);
      }
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("portrait is unchanged: the card keeps its full --card-w width and nothing is buried", async () => {
    await freshLoad();
    const meta = await decksMeta();
    try {
      // The repo's stated test width plus the owner's own device. In every
      // one of these the HEIGHT constraint must NOT bind - the card is as
      // wide as --card-w allows, exactly as it was before the landscape fix.
      for (const [vw, vh] of [[380, 800], [380, 780], [390, 844]]) {
        await b.setViewport(vw, vh, true);
        const m = await assertCardFits(`at ${vw}x${vh} on load (portrait)`);
        assert.ok(Math.abs(m.scene.w - m.cardW) <= 1,
          `portrait regressed at ${vw}x${vh}: the card is ${m.scene.w}px wide but ` +
          `--card-w still resolves to ${m.cardW}px, so the landscape fix has ` +
          `narrowed the card in portrait too`);

        await flip(true);
        await assertCardFits(`at ${vw}x${vh} with the card flipped (portrait)`);
        await flip(false);

        await selectDeck(1, meta);
        await assertCardFits(`at ${vw}x${vh} after switching deck (portrait)`);
        await selectDeck(0, meta);
      }
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
   * tap targets and contrast (lane 31; coordination rows 214-216)
   *
   * The test above probes the swatch overlay VERTICALLY only, which is why
   * it stayed green while the horizontal half of the same overlay was
   * unreachable: six 44px overlays on a 24px pitch overlap by 20px each and
   * the later sibling wins the hit test, so the right half of every swatch
   * but the last belonged to its neighbour. A rect check cannot see that -
   * every rect was correct - so everything below probes with
   * elementFromPoint at the target's OWN extremes.
   * ---------------------------------------------------------------- */

  // WCAG 2.x relative luminance and contrast ratio, from computed rgb().
  function srgbToLuminance(rgb) {
    const [r, g, bl] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  }

  function contrastRatio(fg, bg) {
    const a = srgbToLuminance(fg);
    const c = srgbToLuminance(bg);
    const [hi, lo] = a > c ? [a, c] : [c, a];
    return (hi + 0.05) / (lo + 0.05);
  }

  const AA_NORMAL = 4.5;

  test("every palette swatch owns its full 44px hit area on BOTH axes", async () => {
    await freshLoad();
    await b.setViewport(380, 780, true);
    try {
      await openSheet();
      const probe = await b.eval(`
        const dots = [...document.querySelectorAll("#scale-swatches .dot")];
        const name = (el) => !el ? "null"
          : el === document.documentElement ? "html"
          : (el.id ? "#" + el.id : el.tagName.toLowerCase()) +
            (el.className && typeof el.className === "string" ? "." + el.className.trim().replace(/\\s+/g, ".") : "");
        return dots.map((dot, i) => {
          const r = dot.getBoundingClientRect();
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          // +/-21 pins the documented 44px box; +/-18 would pass on 36px.
          const pts = { left: [cx - 21, cy], right: [cx + 21, cy],
                        top: [cx, cy - 21], bottom: [cx, cy + 21] };
          const bad = [];
          for (const [where, [x, y]] of Object.entries(pts)) {
            const hit = document.elementFromPoint(x, y);
            if (!(hit === dot || dot.contains(hit))) {
              bad.push(where + " -> " + name(hit) + " (index " + dots.indexOf(hit) + ")");
            }
          }
          return { i, cx: +cx.toFixed(1), bad };
        });
      `);
      const broken = probe.filter((p) => p.bad.length);
      assert.strictEqual(probe.length, 6);
      assert.deepStrictEqual(broken, [],
        "a palette swatch does not own its own 44px box - a thumb landing inside " +
        "swatch N selects swatch N+1 with no feedback:\n" +
        broken.map((p) => `  swatch ${p.i} (centre x=${p.cx}): ${p.bad.join(", ")}`).join("\n"));

      // The pitch itself, so a future gap edit that re-creates the overlap
      // fails on the cause and not only on the symptom.
      const pitch = await b.eval(`
        const d = [...document.querySelectorAll("#scale-swatches .dot")]
          .map(el => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; });
        const gaps = [];
        for (let i = 1; i < d.length; i++) gaps.push(+(d[i] - d[i - 1]).toFixed(2));
        return gaps;
      `);
      assert.ok(pitch.every((g) => g >= 44 - 0.5),
        `palette swatch centres are ${JSON.stringify(pitch)}px apart; 44px overlays ` +
        `on a pitch under 44 necessarily overlap`);
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  test("the card's small print meets AA contrast against the paper", async () => {
    await freshLoad();
    await b.setViewport(380, 780, true);
    try {
      const measured = await b.eval(`
        const face = document.querySelector("#front");
        const paper = getComputedStyle(face).backgroundColor;
        const parse = (s) => (s.match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
        const out = [];
        // .hint is the ONLY instruction a first-run user gets; the rest are
        // the same family (row 215), lower priority but the same paper.
        for (const [label, sel] of [
          ["hint", "#front .hint"],
          ["hdr index", "#front .hdr .l .num"],
          ["separator", "#back .sepc"],
        ]) {
          const el = document.querySelector(sel);
          if (!el) { out.push({ label, sel, missing: true }); continue; }
          const cs = getComputedStyle(el);
          out.push({ label, sel, fg: parse(cs.color), px: parseFloat(cs.fontSize) });
        }
        return { paper: parse(paper), out };
      `);
      const failures = [];
      for (const m of measured.out) {
        assert.ok(!m.missing, `${m.sel} is not on the page - the probe is measuring nothing`);
        const ratio = contrastRatio(m.fg, measured.paper);
        if (ratio < AA_NORMAL) {
          failures.push(`${m.label} (${m.sel}) rgb(${m.fg.join(",")}) at ${m.px}px = ` +
            `${ratio.toFixed(2)}:1, AA needs ${AA_NORMAL}`);
        }
      }
      assert.deepStrictEqual(failures, [],
        "card text below WCAG AA on the paper:\n  " + failures.join("\n  "));
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("the mode buttons and Shuffle are 44px tall and steal nothing from their neighbours",
    async () => {
      await freshLoad();
      await b.setViewport(390, 844, true);
      try {
        const probe = await b.eval(`
          const name = (el) => !el ? "null"
            : el === document.documentElement ? "html"
            : (el.id ? "#" + el.id : el.tagName.toLowerCase()) +
              (el.className && typeof el.className === "string" ? "." + el.className.trim().replace(/\\s+/g, ".") : "");
          const rows = [];
          // The three under-sized controls, plus the ones that already pass:
          // a min-height that swallows a neighbour is the row-214 bug again.
          const sels = ["#modeA", "#modeB", "#shuffle", "#prev", "#next",
                        "#deck-add", "#decks .chip:not(#deck-add)"];
          for (const sel of sels) {
            const el = document.querySelector(sel);
            if (!el) { rows.push({ sel, missing: true }); continue; }
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            // Its OWN extremes, inset 1px so the probe is inside the box. The
            // horizontal pair is taken on the vertical midline, where even a
            // 999px-radius pill spans its full width - corners would not be
            // inside a chip at all.
            const pts = { top: [cx, r.top + 1], bottom: [cx, r.bottom - 1],
                          centre: [cx, cy],
                          left: [r.left + r.width / 4, cy],
                          right: [r.right - r.width / 4, cy] };
            const bad = [];
            for (const [where, [x, y]] of Object.entries(pts)) {
              const hit = document.elementFromPoint(x, y);
              if (!(hit === el || el.contains(hit))) bad.push(where + " -> " + name(hit));
            }
            rows.push({ sel, h: +r.height.toFixed(1), w: +r.width.toFixed(1), bad });
          }
          return rows;
        `);
        const short = probe.filter((p) => !p.missing && p.h < 44);
        const stolen = probe.filter((p) => !p.missing && p.bad.length);
        assert.deepStrictEqual(probe.filter((p) => p.missing), []);
        assert.deepStrictEqual(short.map((p) => `${p.sel} ${p.w}x${p.h}`), [],
          "interactive controls under the 44px minimum at 390x844");
        assert.deepStrictEqual(stolen.map((p) => `${p.sel}: ${p.bad.join(", ")}`), [],
          "a control's own box hit-tests to something else - an expanded target " +
          "has been laid over a neighbour");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

  /* ---------------------------------------------------------------- *
   * the chrome budget
   *
   * `main` is flex:1 and .scene is height:min(100%, ...), so on every
   * viewport where the VERTICAL axis binds, one pixel added to the header
   * or the footer is one pixel taken off the card - 1:1, silently.
   *
   * assertCardFits above CANNOT see that. Its maximality guard is
   *     fitW = min(cardW, main.height * ratio)
   * which is derived from the CURRENT main height, so when main shrinks the
   * expectation shrinks with it and the assertion stays green while the card
   * collapses. It answers "is the card as big as the space allows", never
   * "is the space still there".
   *
   * So this guard pins the space itself, against numbers MEASURED on the
   * merge-base and written down here. Both bounds are one-sided - chrome may
   * only get smaller, the card may only get bigger - so a genuine improvement
   * never has to touch this table, but growing the chrome does. The listed
   * viewports are the ones where the vertical axis binds: 844x390 is iPhone 14
   * landscape (the device rows 210/216 are about), 375x667 an SE, 390x745 an
   * iPhone 14 with Safari's toolbar showing, 320x568 the narrowest phone still
   * in the wild. 390x844 and 926x428 are included as controls: 88vw binds
   * there, so the card must not move at all.
   *
   * If you change this table, say in the commit message what you took off the
   * card and why the owner agreed to it.
   * ---------------------------------------------------------------- */
  const CHROME_BUDGET = [
    // vw,  vh,   minCardW, maxChrome   (chrome = vh - main.height)
    [390, 844, 343.19, 270.17],
    [390, 745, 342.69, 270.17],
    [375, 667, 288.80, 268.17],
    [320, 568, 217.11, 268.17],
    [844, 390, 82.42, 276.17],
    [926, 428, 109.94, 276.17],
  ];

  test("the header and footer stay inside their pixel budget, so the card keeps its size",
    async () => {
      await freshLoad();
      try {
        const bad = [];
        for (const [vw, vh, minCardW, maxChrome] of CHROME_BUDGET) {
          await b.setViewport(vw, vh, true);
          const m = await b.eval(`
            const mn = document.querySelector("main").getBoundingClientRect();
            const sc = document.querySelector(".scene").getBoundingClientRect();
            return {
              main: +mn.height.toFixed(2),
              card: +sc.width.toFixed(2),
              vh: document.documentElement.clientHeight,
              header: +document.querySelector("header").getBoundingClientRect().height.toFixed(2),
              footer: +document.querySelector("footer").getBoundingClientRect().height.toFixed(2),
            };
          `);
          const chrome = +(m.vh - m.main).toFixed(2);
          if (chrome > maxChrome + 1) {
            bad.push(`${vw}x${vh}: chrome is ${chrome}px, budget ${maxChrome}px ` +
              `(header ${m.header}, footer ${m.footer}) - main is ${m.main}px`);
          }
          if (m.card < minCardW - 1) {
            bad.push(`${vw}x${vh}: the card is ${m.card}px wide, was ${minCardW}px ` +
              `(-${(100 * (1 - m.card / minCardW)).toFixed(1)}%) - growing the chrome ` +
              `takes this off the card 1:1`);
          }
        }
        assert.deepStrictEqual(bad, [],
          "the practice screen's chrome has grown at the card's expense");
      } finally {
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

  /* ---------------------------------------------------------------- *
   * an edit never destroys ANOTHER deck (queue rows 131, 132)
   *
   * What a unit test cannot show: that at a real 380px viewport the refused
   * save leaves the sheet standing with its message readable and both chips
   * in the row, and that an options-only edit's chip is still where the user
   * left it after a real reload out of a real localStorage.
   * ---------------------------------------------------------------- */

  const COLLIDE_SCALE = SIX_SCALES[2];      // a second custom deck's exact scale

  /** Select the custom chip at index `at` in the deck row. */
  const selectChipAt = (at) => b.eval(`
    const c = [...document.querySelectorAll("#decks .chip:not(#deck-add)")][${at}];
    c.scrollIntoView({ block: "nearest", inline: "nearest" });
    c.click();
    return c.textContent.trim();
  `);

  const sheetState = () => b.eval(`
    const box = document.getElementById("scale-box");
    const msg = document.getElementById("scale-msg");
    return {
      open: !document.getElementById("scale-sheet").hasAttribute("hidden"),
      bad: box.classList.contains("bad"),
      msg: msg.textContent.trim(),
      msgVisible: msg.getBoundingClientRect().height > 0,
      primaries: [...document.querySelectorAll("#scale-sheet button")]
        .filter(el => !el.disabled && el.textContent.trim().match(/^(GENERATE|SAVE)/)).length,
      body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
    };
  `);

  test("an edit onto another deck's scale is refused at 380px and both chips stay", async () => {
    try {
      await freshLoad();
      await b.setViewport(380, 780, true);
      await generate(EDIT_SCALE);
      await generate(COLLIDE_SCALE);

      // name the second deck, so the loss the refusal prevents is visible
      await openEdit();
      await b.eval(`
        const el = document.getElementById("scale-name");
        el.value = "RAY'S PAN";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return el.value;
      `);
      await b.click("#scale-generate");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the Edit sheet to close after the rename" });

      const before = await chipReport();
      const storedBefore = await b.eval(`return localStorage.getItem("hpfc.scales");`);
      assert.ok(before.chips.includes("RAY'S PAN"), JSON.stringify(before.chips));

      await selectChipAt(before.chips.indexOf("RAY'S PAN") - 1);   // the FIRST custom deck
      await openEdit();
      await typeScale(COLLIDE_SCALE);
      await b.click("#scale-generate");

      const st = await sheetState();
      assert.strictEqual(st.open, true, "the refused save closed the sheet");
      assert.strictEqual(st.bad, true, "the scale box was not marked bad");
      assert.match(st.msg, /Another deck already uses this scale/,
        `the sheet says "${st.msg}"`);
      assert.strictEqual(st.msgVisible, true, "the refusal message has no height");
      assert.ok(st.primaries <= 1, `${st.primaries} enabled primaries while the sheet is open`);
      assert.ok(st.body.sw <= st.body.cw + 1, "the refusal scrolls the page horizontally");

      // Queue row 142: `primaries <= 1` also holds with the primary stuck at 0
      // forever, so it cannot fail in the direction that matters. The refusal
      // must be RECOVERABLE - retyping brings the primary back and clears the
      // message, without closing and reopening the sheet.
      await typeScale(SIX_SCALES[3]);
      const back = await sheetState();
      assert.strictEqual(back.open, true, "retyping closed the sheet");
      assert.strictEqual(back.primaries, 1,
        `${back.primaries} enabled primaries after retyping past the refusal - ` +
        "the refusal is a dead end");
      assert.strictEqual(back.bad, false, "the box is still marked bad after a valid retype");
      assert.strictEqual(back.msg, "", `the refusal message survived the retype: "${back.msg}"`);

      await b.eval(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return true;`);
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the Edit sheet to close on Escape" });
      const after = await chipReport();
      assert.deepStrictEqual(after.chips, before.chips,
        `a deck was destroyed by the refused edit: ${JSON.stringify(after.chips)}`);
      assert.strictEqual(
        await b.eval(`return localStorage.getItem("hpfc.scales");`), storedBefore,
        "a refused save wrote to hpfc.scales");
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("an options-only edit keeps its chip position across a reload at 380px", async () => {
    try {
      await freshLoad();
      await b.setViewport(380, 780, true);
      await generate(EDIT_SCALE);
      await generate(COLLIDE_SCALE);
      await generate(SIX_SCALES[4]);
      const before = await chipReport();
      const at = before.chips.indexOf(before.on[0]) - 1;    // the MIDDLE custom deck
      assert.ok(at > 0, `no three custom chips: ${JSON.stringify(before.chips)}`);
      const target = before.chips[at];

      await selectChipAt(at);
      await openEdit();
      await b.click("#scale-swatches > *:nth-child(5)");    // an OPTION only: the id cannot move
      await b.click("#scale-generate");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the Edit sheet to close after SAVE CHANGES" });

      const saved = await chipReport();
      assert.strictEqual(saved.chips[at], target,
        `the options-only edit moved the chip before any reload: ${JSON.stringify(saved.chips)}`);

      await navigate();
      await b.waitFor(`document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`,
        { label: "deck chips after the reload" });
      const back = await chipReport();
      assert.strictEqual(back.chips[at], target,
        `an options-only edit sent the chip to the end of the row on the next boot: ` +
        JSON.stringify(back.chips));
      assert.deepStrictEqual(back.chips, before.chips,
        `the chip row was reordered by an options-only edit: ${JSON.stringify(back.chips)}`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });


  /* ---------------------------------------------------------------- *
   * the preset row (Phase 6)
   *
   * What a unit test cannot show: that six more buttons above the box still
   * fit a 380px sheet without a horizontal scrollbar, are real 44px targets,
   * and are inside the sheet's focus trap rather than beside it.
   * ---------------------------------------------------------------- */

  const presetMeta = () => b.eval(`
    return {
      seeds: SCALE_PRESETS.map(p => p.seed),
      labels: SCALE_PRESETS.map(p => p.label),
      buttons: [...document.querySelectorAll("#scale-presets .preset")]
        .map(el => ({ id: el.dataset.preset, label: el.textContent.trim() })),
    };
  `);

  test("a preset is one tap from a parsed scale and an auto-named deck at 380px", async () => {
    await freshLoad();
    await b.setViewport(380, 780, true);
    try {
      await openSheet();
      const meta = await presetMeta();
      assert.strictEqual(meta.buttons.length, meta.seeds.length,
        `${meta.buttons.length} preset buttons for ${meta.seeds.length} seeds`);
      assert.deepStrictEqual(meta.buttons.map(x => x.label), meta.labels,
        "the row does not show the preset labels");

      const at = 1;
      await b.click(`#scale-presets .preset:nth-child(${at + 1})`);
      const after = await b.eval(`
        const box = document.getElementById("scale-box");
        return {
          value: box.value,
          bad: box.classList.contains("bad"),
          parse: document.getElementById("scale-parse").textContent.trim(),
          disabled: document.getElementById("scale-generate").disabled,
          body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
        };
      `);
      assert.strictEqual(after.value, meta.seeds[at],
        `the preset left "${after.value}" in the box`);
      assert.strictEqual(after.bad, false, "the preset seed does not parse");
      assert.strictEqual(after.disabled, false, "the preset left the primary disabled");
      assert.ok(after.parse.length > 0, "the preset left the parse line empty");
      assert.ok(after.body.sw <= after.body.cw + 1,
        `the preset row scrolls the page horizontally at 380px (${after.body.sw} > ${after.body.cw})`);

      await b.click("#scale-generate");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the sheet to close after generating from a preset" });

      const made = await b.eval(`
        const d = CUSTOM[deckId];
        return d ? {
          name: d.name,
          explicit: d.options.name,
          auto: HPE.select.autoName(d.fields, d.options.parent),
          chips: [...document.querySelectorAll("#decks .chip:not(#deck-add)")]
                   .map(c => c.textContent.trim()),
          on: [...document.querySelectorAll("#decks .chip.on")].map(c => c.textContent.trim()),
          body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
        } : null;
      `);
      assert.ok(made, "generating from a preset produced no custom deck");
      assert.strictEqual(made.explicit, undefined,
        "the preset label was pinned onto the deck as an explicit name");
      assert.strictEqual(made.name, made.auto,
        `the preset deck is named "${made.name}", not the section 13 auto name "${made.auto}"`);
      assert.notStrictEqual(made.name, meta.labels[at],
        "the preset label reached the deck-name space");
      assert.strictEqual(made.on.length, 1, `${made.on.length} selected chips`);
      assert.ok(made.chips.length > 3,
        `no new chip after generating from a preset: ${JSON.stringify(made.chips)}`);
      assert.ok(made.body.sw <= made.body.cw + 1, "the new chip blew the row out");
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("every preset is a 44px target inside the sheet's focus trap at 380px", async () => {
    await freshLoad();
    await b.setViewport(380, 780, true);
    try {
      const cardW = () => b.eval(
        `return getComputedStyle(document.documentElement).getPropertyValue("--card-w");`);
      const before = await cardW();
      await openSheet();

      const hits = await b.eval(`
        const out = { small: [], probes: [], inside: true };
        const surf = document.querySelector("#scale-sheet .sheetsurf").getBoundingClientRect();
        for (const el of document.querySelectorAll("#scale-presets .preset")) {
          const r = el.getBoundingClientRect();
          if (r.height < 44) out.small.push((el.dataset.preset || "?") + " " + r.height.toFixed(1));
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          // +/-21 pins the documented 44px; +/-18 would pass on anything 36px up.
          out.probes.push([cy - 21, cy + 21].every(y => {
            const hit = document.elementFromPoint(cx, y);
            return hit === el || el.contains(hit);
          }));
          if (r.left < surf.left - 1 || r.right > surf.right + 1) out.inside = false;
        }
        return out;
      `);
      assert.deepStrictEqual(hits.small, [], "preset buttons shorter than 44px");
      assert.strictEqual(hits.probes.length, 6);
      assert.ok(hits.probes.every(Boolean),
        `a preset has no 44px hit area: ${JSON.stringify(hits.probes)}`);
      assert.strictEqual(hits.inside, true, "a preset sits outside the sheet surface at 380px");

      // Keyboard only: Tab must reach every preset and never leave the sheet.
      const seen = [];
      for (let i = 0; i < 20; i++) {
        await b.key("Tab", "Tab", 9);
        seen.push(await b.eval(`
          const el = document.activeElement;
          const sheet = document.getElementById("scale-sheet");
          return { id: (el && el.dataset && el.dataset.preset) || (el && el.id) || "",
                   inside: !!(el && sheet.contains(el)) };
        `));
      }
      assert.ok(seen.every(s => s.inside),
        `Tab escaped the create sheet: ${JSON.stringify(seen)}`);
      const ids = new Set(seen.map(s => s.id));
      for (const p of (await presetMeta()).buttons) {
        assert.ok(ids.has(p.id), `Tab never reached the ${p.label} preset: ${JSON.stringify([...ids])}`);
      }

      // Enter on a focused preset fills the box: the browser's OWN default
      // activation, so the row is not a pointer-only path.
      let focused = null;
      for (let i = 0; i < 20 && !focused; i++) {
        focused = await b.eval(`
          const el = document.activeElement;
          return (el && el.dataset && el.dataset.preset) || null;
        `);
        if (!focused) await b.key("Tab", "Tab", 9);
      }
      assert.ok(focused, "Tab never landed on a preset button");
      await b.eval(`
        const box = document.getElementById("scale-box");
        box.value = "";
        box.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      `);
      await pressActive();
      const meta = await presetMeta();
      const want = meta.seeds[meta.buttons.findIndex(x => x.id === focused)];
      assert.strictEqual(await b.eval(`return document.getElementById("scale-box").value;`),
        want, `Enter on the focused ${focused} preset did not fill the box`);

      const state = await b.eval(`
        return { body: { sw: document.body.scrollWidth, cw: document.body.clientWidth } };
      `);
      assert.ok(state.body.sw <= state.body.cw + 1,
        "the preset row scrolls the page horizontally at 380px");
      assert.strictEqual(await cardW(), before, "the sheet changed --card-w");
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  /* ---------------------------------------------------------------- *
   * the primary action never falls below the fold (queue rows 211, 212)
   *
   * .sheetsurf is a scrolling surface capped at 85dvh. Whenever the content
   * is taller than the cap, whatever sits at the BOTTOM of the flow - which
   * is the sheet's only primary, #scale-generate (GENERATE CARDS on the
   * create path, SAVE CHANGES on the Edit path) - starts below the fold, and
   * it reads as a dead end rather than as something scrollable: scrollTop is
   * 0 on open and iOS overlay scrollbars are invisible until touched.
   *
   * So the check is the RESTING state, at scrollTop 0, with no scrolling of
   * any kind performed first: the button must be inside the viewport AND be
   * the element a tap at its own centre actually reaches. A rect alone is not
   * enough - a sticky or fixed neighbour can cover a rect that measures fine.
   *
   * What this CANNOT see, and no headless Chromium can: Safari's dynamic
   * toolbars and its real dvh, real env(safe-area-inset-*) values (0 under
   * emulation), and the soft keyboard - Safari shrinks the VISUAL viewport,
   * not the layout viewport, so dvh does not shrink there. The shrunk
   * viewports below are a PROXY for a keyboard, not the thing itself.
   * ---------------------------------------------------------------- */

  // 380 is the repo's stated test width; 390x844 is the owner's phone; 390x745
  // approximates the same phone with Safari's toolbars showing; 844x390 is it
  // in landscape, where the 85dvh cap is at its most brutal.
  const FOLD_VIEWPORTS = [[380, 800], [390, 844], [390, 745], [844, 390]];

  // The largest pan the engine accepts (13 top + 6 bottom = 19 layout slots
  // beside the ding), which is the tallest the Edit sheet can ever be.
  const BIG_SCALE = "(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5 E5 F5 G5 A5 | C3 E3 F3 G3 A3 B3";

  // Everything the fold check needs, read in one round trip and with nothing
  // scrolled first. `hit` is named so a failure says what is covering it.
  const primaryFold = () => b.eval(`
    // Every scrollable box in the sheet, so "nothing was scrolled first" is
    // checked against whichever one actually carries the overflow.
    const surf = document.getElementById("scale-sheet").firstElementChild;
    const scrolled = [surf, ...surf.querySelectorAll("*")]
      .filter(el => el.scrollTop > 0).map(el => (el.id || el.className) + ":" + el.scrollTop);
    const gen = document.getElementById("scale-generate");
    const r = gen.getBoundingClientRect();
    const hit = document.elementFromPoint(
      Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    return {
      scrolled,
      top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height,
      vw: window.innerWidth, vh: window.innerHeight,
      label: (gen.textContent || "").trim(),
      hitsSelf: hit === gen,
      hit: hit ? (hit.id || hit.className || hit.tagName) : null,
      slots: document.querySelectorAll("#scale-slots .slot").length,
      body: (() => {
        const el = surf.querySelector(".sheetbody");
        if (!el) return null;
        // How far the last row sits past the bottom of the box that holds it.
        const last = el.lastElementChild.getBoundingClientRect();
        return {
          clientH: el.clientHeight,
          overhang: last.bottom - el.getBoundingClientRect().bottom,
        };
      })(),
    };
  `);

  function assertPrimaryVisible(m, where) {
    assert.deepStrictEqual(m.scrolled, [],
      `${where}: something in the sheet was already scrolled ` +
      `(${m.scrolled.join(", ")}) - this check is only meaningful at rest`);
    assert.ok(m.height >= 44,
      `${where}: the primary is only ${m.height.toFixed(1)}px tall`);
    assert.ok(m.top >= -0.5 && m.bottom <= m.vh + 0.5,
      `${where}: "${m.label}" is outside the ${m.vw}x${m.vh} viewport ` +
      `(top ${m.top.toFixed(1)}, bottom ${m.bottom.toFixed(1)}) - ` +
      `${(m.bottom - m.vh).toFixed(1)}px below the fold`);
    assert.ok(m.left >= -0.5 && m.right <= m.vw + 0.5,
      `${where}: "${m.label}" runs off the side (${m.left.toFixed(1)}..${m.right.toFixed(1)})`);
    assert.ok(m.hitsSelf,
      `${where}: "${m.label}" measures on-screen but a tap at its centre lands ` +
      `on "${m.hit}" instead`);
  }

  // Opening the sheet is SETUP for these tests, not the thing under test - the
  // assertion is always about #scale-generate. That matters at 844x390, where
  // the tap path cannot be used at all: + ADD wraps onto a second line which
  // #decks (overflow:auto) clips, so a tap at its centre lands on #hdr and the
  // sheet never opens. That is deck-nav geometry owned by another lane, and it
  // reproduces unchanged on origin/main, so it is not this lane's to fix or to
  // hide. Tap where a finger can reach the chip; where it cannot, PROVE that
  // clipping is the reason before falling back to a scripted click, so a
  // different breakage still fails here instead of being papered over.
  const openSheetForFold = async (w, h) => {
    const reach = await b.eval(`
      const el = document.getElementById("deck-add");
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      const r = el.getBoundingClientRect();
      const box = document.getElementById("decks").getBoundingClientRect();
      const hit = document.elementFromPoint(
        Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      return {
        tappable: hit === el,
        clippedByDecks: r.bottom > box.bottom + 0.5 || r.top < box.top - 0.5,
        hit: hit ? (hit.id || hit.className || hit.tagName) : null,
      };
    `);
    if (reach.tappable) {
      await b.click("#deck-add");
    } else {
      assert.ok(reach.clippedByDecks,
        `at ${w}x${h}: + ADD is not tappable (a tap at its centre lands on ` +
        `"${reach.hit}") for some reason other than the known deck-nav clipping - ` +
        `these tests' setup needs re-checking before their result means anything`);
      await b.eval(`document.getElementById("deck-add").click(); return true;`);
    }
    await b.waitFor(`!document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: `the scale sheet to open at ${w}x${h}` });
  };

  test("GENERATE CARDS is reachable without scrolling at every phone viewport", async () => {
    try {
      await freshLoad();
      for (const [w, h] of FOLD_VIEWPORTS) {
        await b.setViewport(w, h, true);
        // Freshly opened each time: the resting state is the one that matters.
        await openSheetForFold(w, h);
        await typeScale(BIG_SCALE);
        // The preview is drawn on parse and is the tallest thing on the create
        // sheet; measuring before it lands would flatter the result.
        await b.waitFor(`!document.getElementById("scale-preview").hasAttribute("hidden")`,
          { label: `the preview to render at ${w}x${h}` });
        assertPrimaryVisible(await primaryFold(), `create sheet at ${w}x${h}`);
        await b.key("Escape", "Escape", 27);
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
          { label: "the sheet to close" });
      }
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("SAVE CHANGES is reachable without scrolling on a built-in-sized deck", async () => {
    try {
      await freshLoad();
      await b.setViewport(380, 800, true);
      await generate(EDIT_SCALE);
      for (const [w, h] of FOLD_VIEWPORTS) {
        await b.setViewport(w, h, true);
        await openEdit();
        const m = await primaryFold();
        assert.strictEqual(m.label, "SAVE CHANGES", "this is not the Edit sheet");
        assertPrimaryVisible(m, `Edit sheet (8 notes) at ${w}x${h}`);
        await b.key("Escape", "Escape", 27);
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
          { label: "the Edit sheet to close" });
      }
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("SAVE CHANGES is reachable without scrolling on the largest pan the engine allows", async () => {
    try {
      await freshLoad();
      await b.setViewport(380, 800, true);
      await generate(BIG_SCALE);
      for (const [w, h] of FOLD_VIEWPORTS) {
        await b.setViewport(w, h, true);
        await openEdit();
        const m = await primaryFold();
        assert.strictEqual(m.label, "SAVE CHANGES", "this is not the Edit sheet");
        assert.ok(m.slots >= 17,
          `the worst case regressed: the LAYOUT row lists only ${m.slots} slots`);
        assertPrimaryVisible(m, `Edit sheet (${m.slots} slots) at ${w}x${h}`);
        await b.key("Escape", "Escape", 27);
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
          { label: "the Edit sheet to close" });
      }
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("GENERATE CARDS survives a viewport shrunk the way a soft keyboard shrinks one", async () => {
    // PROXY ONLY. A real iOS keyboard shrinks the visual viewport and leaves
    // dvh alone, so this is the friendlier of the two cases, not the honest
    // one; the honest one needs a device. It still pins the regression that a
    // short viewport must not bury the primary.
    try {
      await freshLoad();
      for (const h of [544, 508]) {
        await b.setViewport(390, h, true);
        await openSheet();
        await typeScale(BIG_SCALE);
        await b.waitFor(`!document.getElementById("scale-preview").hasAttribute("hidden")`,
          { label: `the preview to render at 390x${h}` });
        assertPrimaryVisible(await primaryFold(), `create sheet at 390x${h} (keyboard proxy)`);
        await b.key("Escape", "Escape", 27);
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
          { label: "the sheet to close" });
      }
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("keeping the primary out of the scroll still leaves the sheet's own content reachable", async () => {
    // The failure mode of the fix: a fixed footer that eats the cap leaves a
    // scrolling area too small to use, or one that cannot reach its own end.
    // The worst case is the tallest sheet at the shortest viewport.
    try {
      await freshLoad();
      await b.setViewport(380, 800, true);
      await generate(BIG_SCALE);
      await b.setViewport(844, 390, true);
      await openEdit();

      const at = await primaryFold();
      assert.ok(at.body, "the sheet has no .sheetbody - this test is measuring the wrong thing");
      // Measured from the rows themselves, not from scrollHeight: a box that
      // is not a scroll container reports scrollHeight === clientHeight while
      // its content spills out of it in plain sight, and this test has to see
      // that case as "unreachable content", not as "nothing overflows".
      assert.ok(at.body.overhang > 0,
        "the largest pan no longer overflows in landscape: pick a taller case");
      assert.ok(at.body.clientH >= 100,
        `the footer left only ${at.body.clientH}px to scroll in - the sheet is unusable`);

      // Scrolled with a REAL wheel over the sheet, not by assigning scrollTop:
      // an overflow:hidden box still takes a scrollTop from script, so the
      // scripted form passes on a sheet no finger can actually scroll.
      const where = await b.eval(`
        const r = document.querySelector(".sheetbody").getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      `);
      for (let i = 0; i < 12; i++) {
        await b.send("Input.dispatchMouseEvent", {
          type: "mouseWheel", x: where.x, y: where.y, deltaX: 0, deltaY: 400,
        });
      }

      // The end of the content is reachable, and the primary has not moved
      // while getting there.
      const end = await b.eval(`
        const body = document.querySelector(".sheetbody");
        const last = body.lastElementChild.getBoundingClientRect();
        const gen = document.getElementById("scale-generate").getBoundingClientRect();
        return {
          atEnd: body.scrollTop + body.clientHeight >= body.scrollHeight - 1,
          lastBottom: last.bottom, bodyBottom: body.getBoundingClientRect().bottom,
          genBottom: gen.bottom, vh: window.innerHeight,
        };
      `);
      assert.ok(end.atEnd, "the sheet body cannot be scrolled to its end");
      // 1.5px, not 0.5: scrollHeight is an integer and the flow is fractional,
      // so a fully scrolled box can sit a rounding step short of its own end.
      assert.ok(end.lastBottom <= end.bodyBottom + 1.5,
        `the last row of the sheet is still cut off at the bottom of the scroll ` +
        `(${end.lastBottom.toFixed(1)} vs ${end.bodyBottom.toFixed(1)})`);
      assert.ok(end.genBottom <= end.vh + 0.5,
        `the primary left the viewport once the body was scrolled ` +
        `(bottom ${end.genBottom.toFixed(1)} of ${end.vh})`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  /* ---------------------------------------------------------------- *
   * accessible state and focus on the practice screen
   *
   * (coordination rows 213, 217, 219). Only reachable through a browser:
   * activeElement across a DOM rebuild, and the attributes a screen reader
   * reads off the live tree. Every expectation is derived from the page's
   * own state - no deck id, chord name or count is hardcoded.
   * ---------------------------------------------------------------- */

  // What holds focus right now, described well enough to name in a failure.
  const activeDesc = () => b.eval(`
    const a = document.activeElement;
    return {
      isBody: a === document.body || !a,
      id: (a && a.id) || null,
      tag: a ? a.tagName : null,
      cls: (a && typeof a.className === "string") ? a.className : null,
      inDecks: !!(a && a.closest && a.closest("#decks")),
      isSelectedChip: !!(a && a.matches && a.matches("#decks .chip.on")),
    };
  `);

  // Row 213. closeScaleSheet() restores focus correctly, and then the deck
  // switch rebuilds the chip strip underneath it - so the fix has to survive
  // buildChips(), not merely run before it.
  test("GENERATE and SAVE CHANGES leave focus on the deck that was just made", async () => {
    await freshLoad();
    await generate(SIX_SCALES[1]);
    const afterGen = await activeDesc();
    assert.strictEqual(afterGen.isBody, false,
      "focus was dumped on <body> after GENERATE CARDS - a screen reader " +
      "restarts from the top of the page just as the success message fires");
    assert.strictEqual(afterGen.isSelectedChip, true,
      `after GENERATE focus should rest on the selected deck chip, but it is on ` +
      `${JSON.stringify(afterGen)}`);

    // The Edit path lands in the same place: SAVE CHANGES also closes the
    // sheet and then re-selects, so it rebuilds the strip too.
    try {
      await editFreshDeck();
      await b.click("#scale-generate");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the Edit sheet to close after SAVE CHANGES" });
      const afterSave = await activeDesc();
      assert.strictEqual(afterSave.isBody, false,
        "focus was dumped on <body> after SAVE CHANGES");
      assert.strictEqual(afterSave.isSelectedChip, true,
        `after SAVE CHANGES focus should rest on the selected deck chip, but it is on ` +
        `${JSON.stringify(afterSave)}`);

      // DELETE is the one path where the chip holding focus is genuinely
      // detached by the rebuild, so it is the strictest case of the same bug.
      await editFreshDeck();
      await b.click("#scale-delete");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the Edit sheet to close after DELETE" });
      const afterDelete = await activeDesc();
      assert.strictEqual(afterDelete.isBody, false,
        "focus was dumped on <body> after DELETE - the chip it was resting on " +
        "was detached by the chip-strip rebuild and nothing put it back");
      assert.strictEqual(afterDelete.isSelectedChip, true,
        `after DELETE focus should rest on the fallback deck's chip, but it is on ` +
        `${JSON.stringify(afterDelete)}`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  // Regression guard for the same row: the two closes that were measured
  // CORRECT must stay correct. They do not re-select, so nothing rebuilds the
  // strip and focus belongs on the control that opened the sheet.
  test("Escape and a backdrop tap still hand focus back to the opener", async () => {
    await freshLoad();
    await openSheet();
    await b.key("Escape", "Escape", 27);
    await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "Escape to close the sheet" });
    assert.strictEqual(await activeId(), "deck-add",
      "Escape no longer returns focus to + ADD");

    await openSheet();
    await clickPoint(8, 8);
    await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "a backdrop tap to close the sheet" });
    assert.strictEqual(await activeId(), "deck-add",
      "a backdrop tap no longer returns focus to + ADD");
  });

  // Row 217. The `.on` class is a colour, and colour is not state.
  test("the selected deck and the active mode carry accessible state", async () => {
    await freshLoad();
    const readState = () => b.eval(`
      return {
        modes: ["modeA", "modeB"].map(id => {
          const el = document.getElementById(id);
          return { id, on: el.classList.contains("on"),
                   pressed: el.getAttribute("aria-pressed") };
        }),
        chips: [...document.querySelectorAll("#decks .chip:not(#deck-add)")]
          .map(c => ({ text: c.textContent.trim(), on: c.classList.contains("on"),
                       current: c.getAttribute("aria-current") })),
      };
    `);

    // The invariants, not a snapshot: aria mirrors the class the app already
    // maintains, so this cannot go stale on a deck or a mode being added.
    const check = (st, when) => {
      for (const m of st.modes) {
        assert.strictEqual(m.pressed, m.on ? "true" : "false",
          `${when}: #${m.id} is ${m.on ? "" : "not "}active but reports ` +
          `aria-pressed=${JSON.stringify(m.pressed)}`);
      }
      const lit = st.chips.filter(c => c.on);
      assert.strictEqual(lit.length, 1, `${when}: ${lit.length} chips carry .on`);
      const marked = st.chips.filter(c => c.current === "true");
      assert.deepStrictEqual(marked.map(c => c.text), lit.map(c => c.text),
        `${when}: aria-current="true" should be on exactly the selected chip; ` +
        `chips read ${JSON.stringify(st.chips)}`);
    };

    check(await readState(), "on load");

    await b.click("#modeB");
    await b.waitFor(`document.getElementById("modeB").classList.contains("on")`,
      { label: "mode B to become active" });
    check(await readState(), "after switching to NOTES -> NAME");

    const meta = await decksMeta();
    await selectDeck(1, meta);
    check(await readState(), "after switching deck");

    // And a generated deck's own chip gets the same treatment.
    await generate(SIX_SCALES[2]);
    check(await readState(), "after generating a deck");
  });

  // Row 219. REASONED, not measured: Chromium cannot tell us what VoiceOver
  // announces. What IS checkable is that only one face is exposed at a time
  // and that the counter is a live region.
  test("only the face that is showing is exposed, and the counter is a live region", async () => {
    await freshLoad();
    const readCard = () => b.eval(`
      const card = document.getElementById("card");
      const front = document.getElementById("front");
      const back = document.getElementById("back");
      const desc = (card.getAttribute("aria-describedby") || "").trim();
      const ids = desc ? desc.split(/\\s+/) : [];
      const flat = s => (s || "").replace(/\\s+/g, " ").trim();
      return {
        flipped: card.classList.contains("flip"),
        countLive: document.getElementById("count").getAttribute("aria-live"),
        frontHidden: front.getAttribute("aria-hidden"),
        backHidden: back.getAttribute("aria-hidden"),
        describedIds: ids,
        describedText: flat(ids.map(id => (document.getElementById(id) || {}).textContent || "")
          .join(" ")),
        frontText: flat(front.textContent),
        backText: flat(back.textContent),
      };
    `);

    const check = (st, when) => {
      assert.strictEqual(st.countLive, "polite",
        `${when}: #count reports aria-live=${JSON.stringify(st.countLive)}, so ` +
        `stepping through the deck announces nothing`);
      const shown = st.flipped ? "back" : "front";
      const away = st.flipped ? "front" : "back";
      assert.strictEqual(st.flipped ? st.backHidden : st.frontHidden, null,
        `${when}: the face that is showing (#${shown}) is aria-hidden`);
      assert.strictEqual(st.flipped ? st.frontHidden : st.backHidden, "true",
        `${when}: the turned-away face (#${away}) is not aria-hidden, so the ` +
        `card's accessible text carries both faces at once`);
      assert.deepStrictEqual(st.describedIds, [shown],
        `${when}: the card should be described by #${shown}, but ` +
        `aria-describedby reads ${JSON.stringify(st.describedIds)}`);
      const want = st.flipped ? st.backText : st.frontText;
      assert.ok(want.length > 0, `${when}: #${shown} rendered no text at all`);
      assert.strictEqual(st.describedText, want,
        `${when}: the card's description does not match the visible face`);
    };

    const first = await readCard();
    assert.strictEqual(first.flipped, false, "the card booted flipped");
    check(first, "on load");
    // The whole point: unflipped, the answer must not be in the description.
    assert.notStrictEqual(first.describedText, first.backText,
      "the question side's description is the answer side's text");

    await b.click("#card");
    await b.waitFor(`document.getElementById("card").classList.contains("flip")`,
      { label: "the card to flip" });
    check(await readCard(), "flipped");

    await b.click("#next");
    await b.waitFor(`!document.getElementById("card").classList.contains("flip")`,
      { label: "the next card to come up unflipped" });
    check(await readCard(), "after stepping to the next card");

    // Mode B swaps which face holds the diagram; the exposure rule does not care.
    await b.click("#modeB");
    await b.waitFor(`document.getElementById("modeB").classList.contains("on")`,
      { label: "mode B to become active" });
    check(await readCard(), "in NOTES -> NAME");
  });

  /* ---------------------------------------------------------------- *
   * harness contract: a taken port fails loudly, it does not hang
   * ---------------------------------------------------------------- */

  // Regression guard. Several agents share this machine and the port is fixed,
  // so a collision is routine; before this test the `listen` await never
  // settled on EADDRINUSE (the callback only fires on success), so the run hung
  // until something outside killed it and waitForServer's "is port N taken?"
  // message was dead code in exactly the case it was written for.
  //
  // The child is marked with E2E_HARNESS_CHILD so it cannot re-enter here.
  test("a taken port fails the harness fast, naming the port and E2E_PORT", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const net = require("node:net");
    const { spawnSync } = require("node:child_process");

    // Port 0: the OS picks a free one, so this can never collide with a
    // parallel agent the way a hardcoded number would.
    const squatter = net.createServer();
    await new Promise((res, rej) => {
      squatter.once("error", rej);
      squatter.listen(0, "127.0.0.1", res);
    });
    const taken = squatter.address().port;

    // This file is itself running inside node's test runner, which marks the
    // environment with NODE_TEST_CONTEXT. Inherited, that makes the child think
    // it is a runner-managed worker and exit 0 immediately - which would make
    // this test pass against a broken harness. Strip it.
    const env = { ...process.env, E2E_PORT: String(taken), E2E_HARNESS_CHILD: "1" };
    delete env.NODE_TEST_CONTEXT;

    let r;
    try {
      r = spawnSync(process.execPath, ["--test", "tests/e2e.test.js"], {
        cwd: REPO,
        encoding: "utf8",
        timeout: 30000,
        env,
      });
    } finally {
      await new Promise((res) => squatter.close(res));
    }

    const out = (r.stdout || "") + (r.stderr || "");
    // A timeout kill shows up as a signal (and, on some platforms, an error).
    // That IS the hang, so it must fail here rather than pass quietly.
    assert.strictEqual(r.signal, null,
      `the harness was killed by ${r.signal} - it hung on a taken port instead of failing`);
    assert.strictEqual(r.error, undefined,
      `spawnSync failed: ${r.error && r.error.message}`);
    assert.strictEqual(typeof r.status, "number", "no exit status from the harness");
    assert.notStrictEqual(r.status, 0, "the harness exited 0 with its port taken");
    assert.ok(out.includes(String(taken)),
      `the failure never named port ${taken}:\n${out.slice(-2000)}`);
    assert.ok(out.includes("E2E_PORT"),
      `the failure never mentioned E2E_PORT:\n${out.slice(-2000)}`);
  });

  // The other half of the same defect: `node --test` has no per-test deadline,
  // so a wedged suite used to hang tests/suite_health.py forever - which is how
  // a single stuck port burned a whole CI job. run_node_file must bound every
  // suite it starts and report the overrun as a PROBLEM, not a traceback.
  test("suite_health bounds every node suite with a wall clock", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const os = require("node:os");
    const { spawnSync } = require("node:child_process");

    // A suite that never finishes. Written outside tests/ so the *.test.js glob
    // in suite_health.py cannot pick it up and demand a FLOORS row for it.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "suite-health-hang-"));
    const hang = path.join(dir, "hang.test.js");
    fs.writeFileSync(hang,
      'require("node:test").test("never finishes", () => ' +
      "new Promise((r) => setTimeout(r, 60000)));\n");

    const probe = [
      "import sys",
      "from tests import suite_health",
      "total, failed, skipped, out = suite_health.run_node_file(sys.argv[1])",
      'print("TOTAL", total)',
      "print(out)",
    ].join("\n");

    // Same NODE_TEST_CONTEXT trap as above: inherited, the node run_node_file
    // starts would think it is a runner-managed worker and exit at once.
    const env = { ...process.env, NODE_SUITE_TIMEOUT: "3" };
    delete env.NODE_TEST_CONTEXT;

    const started = Date.now();
    let r;
    try {
      r = spawnSync("python3", ["-c", probe, hang], {
        cwd: REPO,
        encoding: "utf8",
        timeout: 60000,
        env,
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    const elapsed = Date.now() - started;
    const out = (r.stdout || "") + (r.stderr || "");

    assert.strictEqual(r.signal, null,
      `run_node_file was killed by ${r.signal} - it never bounded the hung suite`);
    assert.strictEqual(r.error, undefined,
      `run_node_file never returned: ${r.error && r.error.message} (after ${elapsed}ms)`);
    assert.strictEqual(r.status, 0,
      `run_node_file raised instead of reporting the timeout:\n${out.slice(-2000)}`);
    assert.ok(!/Traceback \(most recent call last\)/.test(out),
      `the timeout surfaced as a traceback:\n${out.slice(-2000)}`);
    assert.ok(/^TOTAL None$/m.test(out),
      `a timed-out suite must not report a test count:\n${out.slice(-2000)}`);
    assert.ok(out.includes("TIMED OUT after 3s"),
      `the timeout was not reported with its limit:\n${out.slice(-2000)}`);
    assert.ok(out.includes("hang.test.js"),
      `the timeout report did not name the file:\n${out.slice(-2000)}`);
  });


  /* ---------------------------------------------------------------- *
   * browser reaping (tests/helpers/cdp.js)
   *
   * The harness spawns a real browser and a real profile directory. Both are
   * cleaned up by close(), which only ever runs from after(). Two paths skip
   * after() entirely and used to orphan the browser: a launch() that rejects
   * AFTER spawn (the debug-port timeout, the WebSocket open, any of the setup
   * CDP sends), and a suite killed by a signal - which is exactly how
   * SUITE_TIMEOUT in tests/mutation_check.sh and NODE_TIMEOUT in
   * tests/suite_health.py end an overrunning run. The orphans were observed on
   * a dev box as chrome-headless-shell roots reparented to init, alongside 52
   * abandoned hpfc-prof-* directories.
   *
   * Both tests give the child its own TMPDIR, so "was the profile directory
   * removed?" is answerable without guessing which hpfc-prof-* was ours, and
   * so a stray process can be recognised by its --user-data-dir argument.
   * Every child strips NODE_TEST_CONTEXT: inherited, a node child believes it
   * is a runner-managed worker and exits 0 at once, which would make these
   * pass against the very code they exist to condemn.
   * ---------------------------------------------------------------- */

  const { spawn: spawnChild, execFileSync } = require("node:child_process");
  const osmod = require("node:os");

  function childEnv(extra) {
    const env = { ...process.env, E2E_HARNESS_CHILD: "1", ...extra };
    delete env.NODE_TEST_CONTEXT;
    return env;
  }

  function alive(pid) {
    try { process.kill(pid, 0); return true; } catch { return false; }
  }

  // Anything still running that was pointed at this profile root - the browser
  // root process and every renderer/zygote child carry --user-data-dir.
  function processesUnder(dir) {
    let out = "";
    try { out = execFileSync("ps", ["-eo", "pid=,args=", "-ww"], { encoding: "utf8" }); } catch { return []; }
    return out.split("\n").filter((l) => l.includes(dir));
  }

  function killUnder(dir) {
    for (const line of processesUnder(dir)) {
      const pid = Number(line.trim().split(/\s+/)[0]);
      if (pid && pid !== process.pid) { try { process.kill(pid, "SIGKILL"); } catch {} }
    }
  }

  async function until(pred, ms) {
    const deadline = Date.now() + ms;
    for (;;) {
      if (pred()) return true;
      if (Date.now() > deadline) return false;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  const CDP_HELPER = path.join(REPO, "tests/helpers/cdp.js");

  test("a SIGTERMed suite reaps its browser and its profile directory", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const tmp = fs.mkdtempSync(path.join(osmod.tmpdir(), "reap-term-"));
    // Launch a browser, announce the root pid, then sit still: no after(), no
    // close() - only a signal handler can save this.
    const script =
      "const { launch } = require(" + JSON.stringify(CDP_HELPER) + ");" +
      "(async () => { const b = await launch();" +
      "  if (!b) { console.log('NOBROWSER'); process.exit(0); }" +
      "  console.log('PID ' + b.proc.pid + ' DIR ' + b.profileDir);" +
      "  setInterval(() => {}, 1000); })();";

    const child = spawnChild(process.execPath, ["-e", script], {
      cwd: REPO, env: childEnv({ TMPDIR: tmp }), stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { err += d.toString(); });
    const exited = new Promise((r) => child.on("exit", (c, s) => r({ c, s })));

    const announced = await until(() => /PID \d+ DIR \S+/.test(out) || /NOBROWSER/.test(out), 60000);
    if (/NOBROWSER/.test(out)) {
      child.kill("SIGKILL"); await exited;
      fs.rmSync(tmp, { recursive: true, force: true });
      return;
    }
    assert.ok(announced, `the child never launched a browser:\n${out}\n${err.slice(-2000)}`);
    const m = out.match(/PID (\d+) DIR (\S+)/);
    const browserPid = Number(m[1]);
    const profileDir = m[2];
    assert.ok(alive(browserPid), "the browser was not running before the kill");

    try {
      child.kill("SIGTERM");
      // A handler that swallows the signal would be a WORSE bug than the leak:
      // an overrunning suite would stop being killable. The child must die.
      // The race has an explicit settle point, so the loser's timer is cleared
      // rather than left armed: an armed timer holds node's event loop open for
      // its full budget, and this suite runs 34 more times in every sweep.
      let bail;
      const gone = await Promise.race([
        exited,
        new Promise((r) => { bail = setTimeout(() => r(null), 15000); }),
      ]).finally(() => clearTimeout(bail));
      assert.ok(gone, "SIGTERM did not terminate the child - the handler swallowed it");

      const reaped = await until(() => !alive(browserPid), 10000);
      assert.ok(reaped, `browser pid ${browserPid} outlived the SIGTERMed suite`);
      const clear = await until(() => processesUnder(profileDir).length === 0, 10000);
      assert.ok(clear, `processes still hold the profile:\n${processesUnder(profileDir).join("\n")}`);
      const removed = await until(() => !fs.existsSync(profileDir), 10000);
      assert.ok(removed, `the profile directory survived: ${profileDir}`);
    } finally {
      try { child.kill("SIGKILL"); } catch {}
      killUnder(tmp);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("a launch() that fails after spawn leaves no browser and no profile", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const tmp = fs.mkdtempSync(path.join(osmod.tmpdir(), "reap-fail-"));
    // A stand-in browser that reports a debug port nothing is listening on, so
    // launch() gets past spawn and then fails at the WebSocket - the shape of
    // every post-spawn failure, without a 20s wait for the port timeout.
    const fake = path.join(tmp, "fake-browser");
    fs.writeFileSync(fake,
      "#!/bin/sh\n" +
      "echo 'DevTools listening on ws://127.0.0.1:1/devtools/browser/dead' 1>&2\n" +
      "exec sleep 300\n");
    fs.chmodSync(fake, 0o755);

    const profiles = path.join(tmp, "profiles");
    fs.mkdirSync(profiles);
    // The child reports what is left the moment launch() rejects, BEFORE it
    // exits. Checking after exit would prove nothing: the process-teardown
    // reaper cleans up on the way out, so a launch() that never reaped its own
    // failure would still look clean from outside. The leak this closes is the
    // window a long-lived process spends holding an orphan it already gave up on.
    const script =
      "const { execFileSync } = require('node:child_process');" +
      "const fs = require('node:fs');" +
      "const { launch } = require(" + JSON.stringify(CDP_HELPER) + ");" +
      "(async () => { try { await launch(); console.log('NOTHROW'); }" +
      "  catch (e) { console.log('THREW ' + (e && (e.message || e.type || e))); }" +
      "  const root = process.env.TMPDIR;" +
      "  const left = fs.readdirSync(root).filter((n) => n.startsWith('hpfc-prof-'));" +
      "  const ps = execFileSync('ps', ['-eo', 'pid=,args=', '-ww'], { encoding: 'utf8' })" +
      "    .split('\\n').filter((l) => l.includes(root));" +
      "  console.log('LEFT ' + JSON.stringify(left));" +
      "  console.log('PROCS ' + ps.length);" +
      "  process.exit(0); })();";

    const r = await new Promise((resolve) => {
      const c = spawnChild(process.execPath, ["-e", script], {
        cwd: REPO,
        env: childEnv({ TMPDIR: profiles, CHROME_BIN: fake }),
        stdio: ["ignore", "pipe", "pipe"],
      });
      let o = "", e = "";
      c.stdout.on("data", (d) => { o += d.toString(); });
      c.stderr.on("data", (d) => { e += d.toString(); });
      c.on("exit", (code) => resolve({ code, o, e }));
      // unref: a pure backstop must not by itself keep the process alive for a
      // minute after the child has already exited.
      setTimeout(() => { try { c.kill("SIGKILL"); } catch {} }, 60000).unref();
    });

    try {
      assert.ok(/THREW/.test(r.o),
        `launch() should have rejected past spawn:\n${r.o}\n${r.e.slice(-2000)}`);
      // The original error is a diagnostic other lanes read; it must survive.
      assert.ok(!/THREW (undefined|null)\b/.test(r.o), `the failure lost its error:\n${r.o}`);

      const leftLine = r.o.match(/LEFT (\[.*\])/);
      assert.ok(leftLine, `the child never reported its profile directories:\n${r.o}`);
      assert.deepStrictEqual(JSON.parse(leftLine[1]), [],
        `launch() left profile directories behind: ${leftLine[1]}`);
      const procLine = r.o.match(/PROCS (\d+)/);
      assert.ok(procLine, `the child never reported surviving processes:\n${r.o}`);
      assert.strictEqual(Number(procLine[1]), 0,
        `launch() left ${procLine[1]} process(es) holding the profile`);
      // And nothing outlived the child either.
      const clear = await until(() => processesUnder(profiles).length === 0, 5000);
      assert.ok(clear,
        `a browser outlived the failed launch:\n${processesUnder(profiles).join("\n")}`);
    } finally {
      killUnder(tmp);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });


  /* ---------------------------------------------------------------- *
   * launch retry (tests/helpers/cdp.js)
   *
   * CI run 34518203026 aborted the mutation gate at its BASELINE check: the
   * e2e suite failed on the CLEAN tree with "browser did not report a debug
   * port", ~2 minutes into a 232-mutant sweep, and attempt 2 with no code
   * change was green. The exit branch of the launch race did NOT fire, so the
   * browser was alive and had simply not printed its DevTools ws URL inside
   * the 20s bound - a loaded runner, not breakage. Fourth occurrence, first
   * captured signature.
   *
   * So launch() retries that ONE rejection ONCE. The two tests below are the
   * whole contract: a slow start is retried (and its first, still-alive
   * browser reaped first), and a browser that really fails is NOT - retrying
   * real breakage only doubles the wall clock before the same failure.
   *
   * Both drive a stand-in browser through CHROME_BIN, the seam findBrowser()
   * already has, and both lower the port bound through
   * HPFC_CDP_PORT_TIMEOUT_MS - which can only ever LOWER it - so the slow-start
   * path costs the sweep half a second instead of 20 seconds twice.
   * ---------------------------------------------------------------- */

  // Reports, from inside the child and BEFORE it exits (see the reaping tests
  // above for why "after exit" would prove nothing): how many times the fake
  // browser was executed, what launch() finally threw, and what it left behind.
  const LAUNCH_PROBE =
    "const { execFileSync } = require('node:child_process');" +
    "const fs = require('node:fs');" +
    "const { launch } = require(" + JSON.stringify(CDP_HELPER) + ");" +
    "(async () => { try { await launch(); console.log('NOTHROW'); }" +
    "  catch (e) { console.log('THREW ' + (e && (e.message || e.type || e))); }" +
    "  const log = process.env.FAKE_LOG;" +
    "  console.log('LAUNCHES ' + (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\\n').filter(Boolean).length : 0));" +
    "  const root = process.env.TMPDIR;" +
    "  const left = fs.readdirSync(root).filter((n) => n.startsWith('hpfc-prof-'));" +
    "  const ps = execFileSync('ps', ['-eo', 'pid=,args=', '-ww'], { encoding: 'utf8' })" +
    "    .split('\\n').filter((l) => l.includes(root));" +
    "  console.log('LEFT ' + JSON.stringify(left));" +
    "  console.log('PROCS ' + ps.length);" +
    "  process.exit(0); })();";

  function runLaunchProbe(fakeBody, tmp) {
    const fake = path.join(tmp, "fake-browser");
    const log = path.join(tmp, "invocations");
    fs.writeFileSync(fake, fakeBody.replace(/@LOG@/g, log));
    fs.chmodSync(fake, 0o755);
    const profiles = path.join(tmp, "profiles");
    fs.mkdirSync(profiles);
    return new Promise((resolve) => {
      const c = spawnChild(process.execPath, ["-e", LAUNCH_PROBE], {
        cwd: REPO,
        env: childEnv({
          TMPDIR: profiles, CHROME_BIN: fake, FAKE_LOG: log,
          HPFC_CDP_PORT_TIMEOUT_MS: "500",
        }),
        stdio: ["ignore", "pipe", "pipe"],
      });
      let o = "", e = "";
      c.stdout.on("data", (d) => { o += d.toString(); });
      c.stderr.on("data", (d) => { e += d.toString(); });
      c.on("exit", (code) => resolve({ code, o, e }));
      setTimeout(() => { try { c.kill("SIGKILL"); } catch {} }, 60000).unref();
    });
  }

  test("a slow-starting browser is retried once, and the first one is reaped", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const tmp = fs.mkdtempSync(path.join(osmod.tmpdir(), "launch-slow-"));
    // First run: alive, silent, past the bound - the observed CI signature
    // exactly (NOT an exit, which is a different branch and must not retry).
    // Second run: reports a port nothing listens on, so the retry is provably
    // reached without this test needing a real browser.
    const body =
      "#!/bin/sh\n" +
      "echo run >> '@LOG@'\n" +
      "if [ \"$(wc -l < '@LOG@')\" -le 1 ]; then exec sleep 120; fi\n" +
      "echo 'DevTools listening on ws://127.0.0.1:1/devtools/browser/dead' 1>&2\n" +
      "exec sleep 120\n";
    const r = await runLaunchProbe(body, tmp);

    try {
      const launches = r.o.match(/LAUNCHES (\d+)/);
      assert.ok(launches, `the child never reported the launch count:\n${r.o}\n${r.e.slice(-2000)}`);
      assert.strictEqual(Number(launches[1]), 2,
        "a slow start must be retried exactly once (two browsers spawned, not " +
        `${launches[1]}):\n${r.o}\n${r.e.slice(-2000)}`);
      // Not the timeout again: the retry got past the port wait and died at the
      // dead WebSocket, which is only reachable on the second attempt.
      assert.ok(!/THREW browser did not report a debug port/.test(r.o),
        `the retry never happened - launch() rethrew the slow-start timeout:\n${r.o}`);
      // A silent retry turns a known intermittent into an unknown slowdown.
      assert.ok(/retry/i.test(r.e),
        `the retry was silent - nothing on stderr names it:\n${r.e.slice(-2000)}`);
      // The first browser is ALIVE when the retry starts; not reaping it leaks a
      // Chrome and a profile dir per retry.
      const leftLine = r.o.match(/LEFT (\[.*\])/);
      assert.ok(leftLine, `the child never reported its profile directories:\n${r.o}`);
      assert.deepStrictEqual(JSON.parse(leftLine[1]), [],
        `the retry left profile directories behind: ${leftLine[1]}`);
      const procLine = r.o.match(/PROCS (\d+)/);
      assert.ok(procLine, `the child never reported surviving processes:\n${r.o}`);
      assert.strictEqual(Number(procLine[1]), 0,
        `the retry left ${procLine[1]} process(es) holding a profile`);
    } finally {
      killUnder(tmp);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("a browser that exits at once is not retried", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const tmp = fs.mkdtempSync(path.join(osmod.tmpdir(), "launch-dead-"));
    // Real breakage, not a slow runner: retrying it just pays the same failure
    // twice, and on a 232-mutant sweep that is the difference between a red
    // suite and a timed-out one.
    const body =
      "#!/bin/sh\n" +
      "echo run >> '@LOG@'\n" +
      "exit 3\n";
    const r = await runLaunchProbe(body, tmp);

    try {
      const launches = r.o.match(/LAUNCHES (\d+)/);
      assert.ok(launches, `the child never reported the launch count:\n${r.o}\n${r.e.slice(-2000)}`);
      assert.strictEqual(Number(launches[1]), 1,
        "a browser that exited must NOT be retried (one spawn, not " +
        `${launches[1]}):\n${r.o}\n${r.e.slice(-2000)}`);
      assert.ok(/THREW browser exited: 3/.test(r.o),
        `the original failure must reach the caller unchanged:\n${r.o}`);
    } finally {
      killUnder(tmp);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

}
