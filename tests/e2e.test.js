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
  // + ADD is the strip's first child, so deck i is the (i + 2)-th chip, and
  // with + ADD leading, the last built-in starts past the right edge at 380px.
  // So the chip IS scrolled into view - but the hit test below is what keeps
  // this helper honest about the bug class the old "never scroll" rule was
  // protecting (row 214: something coming to rest ON TOP of a chip). Scrolling
  // moves a chip into the port; it cannot move an overlay off it, so the
  // assertion still fails on exactly the regression it was written for, and
  // "+ ADD is on screen at rest" is proved by its own tests further down.
  async function selectDeck(i, meta) {
    const sel = `#decks .chip:nth-child(${i + 2})`;
    const hit = await b.eval(`
      const el = document.querySelector(${JSON.stringify(sel)});
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
      const r = el.getBoundingClientRect();
      const got = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { own: !!got && (got === el || el.contains(got)),
               got: got ? (got.id || got.className || got.tagName) : null };
    `);
    assert.strictEqual(hit.own, true,
      `a tap at the centre of the ${meta[i].id} chip lands on "${hit.got}" instead`);
    await b.click(sel);
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

  /* The swipe handler (index.html:5084-5090) is the primary way the app is
     navigated on a phone and had no test of any kind until this group. A unit
     test cannot reach it: it is real touch dispatch, not a click. */
  test("a swipe past the threshold steps the deck in the swiped direction", async () => {
    await freshLoad();
    const n = (await decksMeta())[0].chords;

    await b.swipe("#card", -120);
    await expectCount(`2 / ${n}`, "swiping left did not step forward");

    await b.swipe("#card", 120);
    await expectCount(`1 / ${n}`, "swiping right did not step back");

    // Just past the 55px threshold. Paired with the 50px drag in the next test
    // this brackets the constant to within 10px, so a mutant that moves it
    // anywhere inside (50, 60) still dies. 54/56 would be tighter and would
    // flake: CDP rounds a touch point off a fractional getBoundingClientRect
    // centre by up to a pixel.
    await b.swipe("#card", -60);
    await expectCount(`2 / ${n}`, "a 60px drag did not clear the 55px threshold");
  });

  test("a swipe shorter than the threshold does not navigate", async () => {
    // The card is BOTH the flip target and the swipe target, so the deadzone is
    // the whole of what keeps an ordinary tap - and the small drag a thumb makes
    // while tapping - from also throwing the card away to the next one.
    await freshLoad();
    const n = (await decksMeta())[0].chords;

    await b.swipe("#card", -50);
    await expectCount(`1 / ${n}`, "a 50px drag navigated; the deadzone shrank");

    await b.swipe("#card", 50);
    await expectCount(`1 / ${n}`, "a 50px drag back navigated; the deadzone shrank");
  });

  test("swipe wraps at both ends of the deck like the buttons do", async () => {
    await freshLoad();
    const n = (await decksMeta())[0].chords;

    await b.swipe("#card", 120);
    await expectCount(`${n} / ${n}`, "swiping back from the first card did not wrap to the last");

    await b.swipe("#card", -120);
    await expectCount(`1 / ${n}`, "swiping forward from the last card did not wrap to the first");
  });

  /* Row 95: the app sets overscroll-behavior:contain on .decks and the sheet
     but nothing on the root for the HORIZONTAL axis, so a centre drag on the
     card - exactly where a thumb lands - is free to fall through to the
     browser's own overscroll gesture (Android Chrome's back-navigation; on
     the owner's iPhone 14/iOS 26.6 that gesture is the Safari back-swipe).
     tests/helpers/cdp.js disables Chromium's OverscrollHistoryNavigation
     feature for the whole shared CDP session (see the comment above that
     launch flag), so this suite can never observe the browser actually
     navigating - a real regression here would still step the deck AND still
     leave location.href untouched under that flag. The property that DOES
     move is the CSS the fix installs: the root must carry a non-"auto"
     overscroll-behavior-x, or nothing stops the browser from taking the
     gesture on a real device once the harness's masking flag is not there to
     save it. */
  test("a horizontal drag across the card never hands the gesture to browser history (row 95)", async () => {
    await freshLoad();
    const n = (await decksMeta())[0].chords;
    const before = await b.eval(`return location.href;`);

    await b.swipe("#card", -120);
    await expectCount(`2 / ${n}`, "the drag did not step the deck");

    const after = await b.eval(`
      return {
        href: location.href,
        overscrollX: getComputedStyle(document.documentElement).overscrollBehaviorX,
      };
    `);
    assert.strictEqual(after.href, before, "the drag navigated the document away from the app");
    assert.notStrictEqual(
      after.overscrollX, "auto",
      "the root has no overscroll-behavior-x, so a real browser is still free to hand this drag to history navigation (row 95)",
    );
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
   * print links (D9): the deck header opens the already-committed PDFs
   * as-is, two relative links per built-in deck - no generation, no
   * client-side PDF library, no server. Basenames are the real files
   * committed at the repo root (`ls *.pdf`), hardcoded here rather than
   * derived from deck name/id so a rename on either side cannot silently
   * agree with itself.
   * ---------------------------------------------------------------- */
  const EXPECTED_PDFS = {
    hijaz: {
      cards: "CSharp_Hijaz_Orion_9_Cards_Letter.pdf",
      printerOnly: "CSharp_Hijaz_Orion_9_PRINTER_ONLY_Chords_Letter.pdf",
    },
    pygmy: {
      cards: "F3_Low_Pygmy_18_Cards_Letter.pdf",
      printerOnly: "F3_Low_Pygmy_18_PRINTER_ONLY_Chords_Letter.pdf",
    },
    amara: {
      cards: "D_Amara_9_Cards_Letter.pdf",
      printerOnly: "D_Amara_9_PRINTER_ONLY_Chords_Letter.pdf",
    },
  };

  test("the deck header links to both committed PDFs for every deck, with relative hrefs", async () => {
    await freshLoad();
    const meta = await decksMeta();

    for (let i = 0; i < meta.length; i++) {
      await selectDeck(i, meta);
      const id = meta[i].id;
      const expected = EXPECTED_PDFS[id];
      assert.ok(expected, `no expected PDF pair recorded for deck ${id} - update EXPECTED_PDFS`);

      const links = await b.eval(`
        return [...document.querySelectorAll("#front .prints a")]
          .map(a => ({ href: a.getAttribute("href"), text: a.textContent.trim() }));
      `);

      assert.strictEqual(links.length, 2,
        `deck ${id}: expected exactly 2 print links in the header, found ${links.length}`);

      for (const l of links) {
        assert.ok(!l.href.startsWith("/"),
          `deck ${id}: href "${l.href}" is root-absolute - GitHub Pages serves under /<repo>/`);
        assert.ok(!/^[a-z]+:/i.test(l.href),
          `deck ${id}: href "${l.href}" looks absolute/schemed, expected a relative path`);
      }

      const hrefs = links.map(l => l.href).sort();
      const wanted = [expected.cards, expected.printerOnly].sort();
      assert.deepStrictEqual(hrefs, wanted,
        `deck ${id}: print link hrefs ${JSON.stringify(hrefs)} != committed PDFs ${JSON.stringify(wanted)}`);
    }
  });

  test("the print links sit outside .hdr and do not grow the deck-name box", async () => {
    await freshLoad();
    const meta = await decksMeta();
    await b.setViewport(380, 800, true);
    await b.settle();

    try {
      for (let i = 0; i < meta.length; i++) {
        await selectDeck(i, meta);
        const m = await b.eval(`
          const hdr = document.querySelector("#front .hdr");
          const l = hdr.querySelector(".l");
          const prints = document.querySelector("#front .prints");
          return {
            hdrChildren: hdr.children.length,
            nameLines: l.getBoundingClientRect().height,
            lineHeight: parseFloat(getComputedStyle(l).lineHeight),
            printsInsideHdr: hdr.contains(prints),
          };
        `);
        assert.strictEqual(m.hdrChildren, 2,
          `${meta[i].id}: .hdr gained a child - the print links must not join its flex row`);
        assert.strictEqual(m.printsInsideHdr, false,
          `${meta[i].id}: .prints is nested inside .hdr`);
        // The deck name + "#n deg" is authored as one two-line block (a <br>
        // between them); it must stay exactly two lines, not wrap to three.
        assert.ok(
          m.nameLines <= m.lineHeight * 2 + 1,
          `${meta[i].id}: .hdr .l is ${m.nameLines}px tall (line-height ${m.lineHeight}px) - ` +
            `the deck name wrapped past its normal two lines`,
        );
      }
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  /* The card's own keydown handler treats Space and Enter as "flip", and it
     is bound to #card, so it fires for a key event that BUBBLES from any
     descendant. The wrapper's onclick="event.stopPropagation()" guards the
     mouse path only - keydown is a separate listener on a separate phase.
     Without a target guard, Enter on a focused print link is swallowed by
     preventDefault() before the browser activates the anchor: no PDF opens
     AND the card flips, which in NAME->NOTES mode silently reveals the very
     answer the user was studying. A wrong action, not a no-op. */
  test("Enter on a print link opens the PDF and does not flip the card", async () => {
    await freshLoad();
    await b.eval(`
      window.__printLinkActivated = false;
      document.addEventListener("click", e => {
        const a = e.target && e.target.closest && e.target.closest(".prints a");
        if (a) { window.__printLinkActivated = true; e.preventDefault(); }
      }, true);
      document.querySelector("#front .prints a").focus();
      return true;
    `);
    await b.key("Enter", "Enter", 13);
    const m = await b.eval(`
      return {
        activated: window.__printLinkActivated,
        flipped: document.getElementById("card").classList.contains("flip"),
      };
    `);
    assert.strictEqual(m.flipped, false,
      "Enter on a print link flipped the card - the card's keydown handler is " +
      "swallowing events that bubble up from the link");
    assert.strictEqual(m.activated, true,
      "Enter on a print link never activated the anchor - preventDefault() ran first");
  });

  /* headerHTML() feeds all four faces, so .prints renders into #front AND
     #back. The flip is a CSS transform: both faces stay in the DOM, and the
     hidden one carries aria-hidden="true". Focusable content inside an
     aria-hidden subtree is a standard axe violation, and a keyboard user
     tabs into two invisible links. The base had zero focusable elements in
     either face, so this is the feature's own regression. */
  test("only the showing face's print links are in the tab order", async () => {
    await freshLoad();
    const count = () => b.eval(`
      const q = f => [...document.querySelectorAll("#" + f + " .prints a")]
        .filter(a => a.tabIndex >= 0).length;
      return { front: q("front"), back: q("back") };
    `);

    const shut = await count();
    assert.strictEqual(shut.front, 2, "the showing face lost its print links from the tab order");
    assert.strictEqual(shut.back, 0,
      `${shut.back} print link(s) inside the aria-hidden #back face are still focusable`);

    await b.click("#card");
    await b.settle();
    const open = await count();
    assert.strictEqual(open.back, 2, "after the flip the showing face's links are not tabbable");
    assert.strictEqual(open.front, 0,
      `${open.front} print link(s) inside the now-hidden #front face are still focusable`);
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

  // Click a viewport point rather than an element. The drawer used this to hit
  // its backdrop; the page has none, so it is now how a test aims at a spot the
  // page covers and asserts nothing closes.
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

  test("the page is a modal dialog with the spec'd anatomy", async () => {
    await freshLoad();
    const before = await b.eval(`
      const s = document.getElementById("scale-sheet");
      return {
        hidden: s.hasAttribute("hidden"),
        role: s.getAttribute("role"),
        modal: s.getAttribute("aria-modal"),
        labelledby: s.getAttribute("aria-labelledby"),
        addText: document.getElementById("deck-add").textContent.trim(),
      };
    `);
    assert.strictEqual(before.hidden, true, "the sheet is open before + ADD is tapped");
    assert.strictEqual(before.role, "dialog");
    assert.strictEqual(before.modal, "true");
    // The page is named by the title it shows, not by an invisible aria-label.
    assert.strictEqual(before.labelledby, "scale-title");
    assert.match(before.addText, /ADD/);

    await openSheet();
    const open = await b.eval(`
      const s = document.getElementById("scale-sheet");
      const surf = s.firstElementChild;
      const cs = getComputedStyle(surf);
      const sr = surf.getBoundingClientRect();
      const lr = s.getBoundingClientRect();
      return {
        maxH: cs.maxHeight,
        overflowY: cs.overflowY,
        viewportH: window.innerHeight,
        surfH: sr.height, layer: { t: lr.top, l: lr.left, h: lr.height, w: lr.width },
        layerBg: getComputedStyle(s).backgroundColor,
        title: document.getElementById("scale-title").textContent.trim(),
        backText: document.getElementById("scale-back").textContent.trim(),
        parseLine: document.getElementById("scale-parse").textContent.trim(),
        msgLive: document.getElementById("scale-msg").getAttribute("aria-live"),
        refusalLive: document.getElementById("scale-refusal").getAttribute("aria-live"),
        placeholder: document.getElementById("scale-box").placeholder,
        generateDisabled: document.getElementById("scale-generate").disabled,
        swatches: document.querySelectorAll("#scale-swatches .dot").length,
        mirrorOn: [...document.querySelectorAll("#scale-mirror-l, #scale-mirror-r")]
          .filter(el => el.classList.contains("on")).map(el => el.id),
      };
    `);
    // AC1: the page fills the viewport. max-height: 100dvh, resolved by the
    // browser into pixels, and the surface actually drawn that tall.
    assert.ok(Math.abs(parseFloat(open.maxH) - open.viewportH) < 2,
      `surface max-height is ${open.maxH} at a ${open.viewportH}px viewport`);
    assert.ok(Math.abs(open.surfH - open.viewportH) < 2,
      `the surface is ${open.surfH}px tall in a ${open.viewportH}px viewport`);
    assert.ok(open.layer.t <= 0 && open.layer.l <= 0
              && open.layer.h >= open.viewportH - 1,
      `the page layer does not cover the viewport: ${JSON.stringify(open.layer)}`);
    // Opaque: a translucent layer is a backdrop, and a backdrop is the drawer.
    // Read the alpha rather than pattern-matching for one: `transparent`
    // computes to `rgba(0, 0, 0, 0)`, whose alpha has no decimal point, so a
    // regex looking for a fractional alpha waves the most transparent layer
    // of all straight through. A bare `rgb(...)` carries no alpha and is 1.
    const alphaOf = (css) => {
      const m = /^rgba?\(([^)]*)\)$/.exec(css.trim());
      assert.ok(m, `the page layer's background is not a colour: ${css}`);
      const parts = m[1].split(/[,/]/).map((v) => v.trim());
      return parts.length < 4 ? 1 : parseFloat(parts[3]);
    };
    assert.strictEqual(alphaOf(open.layerBg), 1,
      `the page layer is translucent (${open.layerBg}), so the practice screen ` +
      "still shows through it");
    assert.match(open.title, /Add a scale/i, "the page has no visible title");
    assert.match(open.backText, /BACK/, "the page has no visible way back");
    assert.strictEqual(open.overflowY, "auto", "the surface does not scroll internally");
    assert.match(open.parseLine, /^Type your ding first/);
    assert.strictEqual(open.msgLive, "polite");
    // #scale-sheet is aria-modal, so the page-level .announce is outside the
    // dialog and unreachable while the sheet is open. A refusal is announced
    // only if #scale-refusal is itself a live region.
    assert.strictEqual(open.refusalLive, "polite",
      "the seed refusal is not in a live region inside the modal sheet");
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
          msg: document.getElementById("scale-refusal").textContent.trim(),
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

  // AC6, the half the reachability test above cannot see. That test filters on
  // [inert] alone, so it passes just as happily whether aria-hidden is set or
  // not: inert already removes the background from the tab order and from hit
  // testing. aria-hidden is what removes it from the SCREEN READER, which is a
  // separate promise to a separate user, and it needs its own assertion or a
  // change that drops it ships green.
  test("the background behind the page is hidden from assistive tech, not only from the pointer",
    async () => {
      await freshLoad();
      const shut = await b.eval(`
        return [...document.querySelectorAll("header, main, footer")]
          .map(el => ({ tag: el.tagName, hidden: el.getAttribute("aria-hidden"), inert: !!el.inert }));
      `);
      assert.ok(shut.length >= 2, "the practice screen has no landmark regions to hide");
      for (const el of shut) {
        assert.strictEqual(el.hidden, null, `<${el.tag}> is aria-hidden with no page open`);
        assert.strictEqual(el.inert, false, `<${el.tag}> is inert with no page open`);
      }

      await openSheet();
      const open = await b.eval(`
        return [...document.querySelectorAll("header, main, footer")]
          .map(el => ({ tag: el.tagName, hidden: el.getAttribute("aria-hidden"), inert: !!el.inert }));
      `);
      assert.strictEqual(open.length, shut.length, "the landmark set changed while the page was open");
      for (const el of open) {
        assert.strictEqual(el.hidden, "true",
          `<${el.tag}> is still exposed to a screen reader behind the page`);
        assert.strictEqual(el.inert, true, `<${el.tag}> is still interactive behind the page`);
      }

      // And it comes back: a page that leaves the app aria-hidden on close is
      // worse than one that never hid it.
      await b.key("Escape", "Escape", 27);
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the page to close" });
      const after = await b.eval(`
        return [...document.querySelectorAll("header, main, footer")]
          .map(el => ({ tag: el.tagName, hidden: el.getAttribute("aria-hidden"), inert: !!el.inert }));
      `);
      for (const el of after) {
        assert.strictEqual(el.hidden, null, `<${el.tag}> is still aria-hidden after the page closed`);
        assert.strictEqual(el.inert, false, `<${el.tag}> is still inert after the page closed`);
      }
    });

  test("Escape closes the sheet and focus returns to + ADD", async () => {
    await freshLoad();
    await openSheet();
    // AC2: the page does not steal focus into the box - no soft keyboard until
    // the user taps it - but focus does leave the inert background.
    assert.strictEqual(await activeId(), "scale-back",
      "focus did not land on BACK when the page opened");
    await b.key("Escape", "Escape", 27);
    await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "Escape to close the sheet" });
    assert.strictEqual(await activeId(), "deck-add", "focus did not return to + ADD");
  });

  // AC3. The drawer closed on a backdrop tap; the page has no backdrop, and a
  // stray tap on a full-viewport page would silently discard an unsaved edit.
  // BACK is the gesture now, and the old one has to be gone, not just unused.
  test("BACK closes the page and focus returns to + ADD; a stray tap does not",
    async () => {
      await freshLoad();
      await openSheet();
      // The top-left corner used to be backdrop. It is page now.
      await clickPoint(8, 8);
      assert.strictEqual(await sheetShown(), true,
        "a tap near the page edge closed it - the backdrop gesture is still wired");
      await b.click("#scale-box");
      assert.strictEqual(await sheetShown(), true, "a tap inside the page closed it");

      await b.click("#scale-back");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "BACK to close the page" });
      assert.strictEqual(await activeId(), "deck-add",
        "BACK did not return focus to the control that opened the page");
    });

  // AC4. The page owns a history entry, so the platform back gesture is the
  // same close - and it must not take the browser off the app.
  test("the browser's Back button closes the page and stays on the app", async () => {
    await freshLoad();
    const before = await b.eval(`return location.href`);
    await openSheet();
    assert.notStrictEqual(await b.eval(`return location.hash`), "",
      "the page did not route - the back gesture would leave the app");
    await b.eval(`history.back(); return true`);
    await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "the back gesture to close the page" });
    assert.strictEqual(await b.eval(`return location.href`), before,
      "the back gesture left the app instead of closing the page");
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

  /* A custom deck has no pre-built PDF to link at, so its .prints row is
     <button>s plus the paper <select> rather than two <a href>s. The tab-order
     rule that the built-in test pins is the same rule, but the selector that
     enforces it has to cover all three element types - a selector that only
     names `a` leaves three focusable controls inside the aria-hidden face
     (AC-B1b). */
  test("print controls on the hidden face", async () => {
    await freshLoad();
    await generate(SIX_SCALES[1]);
    const count = () => b.eval(`
      const q = f => [...document.querySelectorAll(
        "#" + f + " .prints a, #" + f + " .prints button, #" + f + " .prints select")]
        .filter(el => el.tabIndex >= 0).length;
      return { front: q("front"), back: q("back") };
    `);

    const shut = await count();
    assert.strictEqual(shut.front, 3,
      `the showing face carries ${shut.front} tabbable print controls, not 3`);
    assert.strictEqual(shut.back, 0,
      `${shut.back} print control(s) inside the aria-hidden #back face are still focusable`);

    await b.click("#card");
    await b.settle();
    const open = await count();
    assert.strictEqual(open.back, 3, "after the flip the showing face's controls are not tabbable");
    assert.strictEqual(open.front, 0,
      `${open.front} print control(s) inside the now-hidden #front face are still focusable`);
  });

  /* The unit suite asserts this against a DOM stub, where every element id
     resolves from the first line of the app. In a real browser #printroot is
     parsed AFTER the app's <script> (index.html:5616 vs 3643), so a teardown
     that captured its element at listener-registration time would hold null
     and throw on the first afterprint - invisible to the stub, fatal here. */
  test("afterprint tears the print sheet down in a real browser", async () => {
    await freshLoad();
    await generate(SIX_SCALES[1]);
    const state = await b.eval(`
      const real = window.print;
      window.print = function () {};
      try { openPrintSheet("full"); } finally { window.print = real; }
      const root = document.getElementById("printroot");
      const during = { cells: root.innerHTML.length, hidden: root.hidden,
                       printing: document.body.classList.contains("printing") };
      window.dispatchEvent(new Event("afterprint"));
      return { during, after: { cells: root.innerHTML.length, hidden: root.hidden,
               printing: document.body.classList.contains("printing"),
               css: document.getElementById("printgeom").textContent.length } };`);
    assert.ok(state.during.cells > 0, "the sheet must survive a print() that returns");
    assert.strictEqual(state.during.hidden, false);
    assert.strictEqual(state.during.printing, true);
    assert.strictEqual(state.after.cells, 0, "afterprint did not empty #printroot");
    assert.strictEqual(state.after.hidden, true);
    assert.strictEqual(state.after.printing, false);
    assert.strictEqual(state.after.css, 0, "afterprint did not clear #printgeom");
  });

  /* Nothing in this repo rendered `@media print` until now: three print defects
     shipped past 345 mutants because every print test read the stylesheet text
     instead of the printed page. This one prints the real thing and measures
     it. The defect it was written for: `#printroot .printscale` taking itself
     out of flow inside a paginated grid cell makes Chrome clip every row but
     the last on each page - the card frame paints 183pt of its 247.2pt and the
     pan diagram, note line and number line do not paint at all, so 6 of the
     Amara deck's 25 chord cards come out unusable on the default layout.

     The oracle is pymupdf (already a documented test requirement - see
     CLAUDE.md "Print pipeline"), shelled out to because the js suite is
     node-only. A card frame is a rounded-rect PATH under a `cm` transform, so
     a byte-level scan for `re` operators cannot see one; get_drawings() can. */
  test("every printed card keeps its full height on every page", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;
    const { spawnSync } = require("node:child_process");
    const os = require("node:os");

    await freshLoad();
    await generate(SIX_SCALES[1]);

    // The sheet now survives print() and is torn down on `afterprint`, which
    // a stubbed print() never fires - so it would still be up here. This
    // capture-and-reinject predates that and is kept deliberately (TODOS.md):
    // it is reconstruction-blind, so it cannot catch a defect in how the app
    // produces the sheet, only in how the sheet paginates.
    const cells = await b.eval(`
      window.__cap = null;
      const real = window.print;
      window.print = function () {
        window.__cap = {
          html: document.getElementById("printroot").innerHTML,
          css: document.getElementById("printgeom").textContent };
      };
      try { openPrintSheet("full"); } finally { window.print = real; }
      const c = window.__cap;
      if (!c) return 0;
      const root = document.getElementById("printroot");
      root.innerHTML = c.html;
      root.hidden = false;
      document.getElementById("printgeom").textContent = c.css;
      document.body.classList.add("printing");
      return (c.html.match(/printcell/g) || []).length;`);
    assert.ok(cells > 9,
      `the captured sheet holds ${cells} cells - it must span more than one page`);

    const res = await b.send("Page.printToPDF",
      { printBackground: true, preferCSSPageSize: true });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "print-height-"));
    const pdf = path.join(dir, "deck.pdf");
    fs.writeFileSync(pdf, Buffer.from(res.data, "base64"));

    // Card frames are the only drawings this wide; anything shorter than half a
    // card is a rule or a badge, not a frame.
    const probe = [
      "import sys, json, fitz",
      "d = fitz.open(sys.argv[1])",
      "out = []",
      "for p in d:",
      "    fr = [dr['rect'] for dr in p.get_drawings()",
      "          if 170 <= dr['rect'].width <= 185 and dr['rect'].height > 120]",
      "    hs = sorted(set(round(r.height, 1) for r in fr))",
      "    top = round(min((r.y0 for r in fr), default=-1), 1)",
      "    bot = round(p.rect.height - max((r.y1 for r in fr), default=-1), 1)",
      "    lf = round(min((r.x0 for r in fr), default=-1), 1)",
      "    rt = round(p.rect.width - max((r.x1 for r in fr), default=-1), 1)",
      "    out.append({'h': hs, 'top': top, 'bottom': bot, 'left': lf, 'right': rt})",
      "print(json.dumps(out))",
    ].join("\n");

    let r;
    try {
      r = spawnSync("python3", ["-c", probe, pdf], { encoding: "utf8", timeout: 120000 });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    assert.strictEqual(r.status, 0,
      `the pymupdf probe failed (install pymupdf):\n${(r.stdout || "") + (r.stderr || "")}`);
    const pages = JSON.parse(r.stdout.trim().split("\n").pop());
    assert.ok(pages.length > 1, `the deck printed on ${pages.length} page(s), not several`);

    // 247.2pt is the card height in tools/hifi.py, the print spec.
    for (const [i, page] of pages.entries()) {
      assert.ok(page.h.length > 0, `page ${i + 1} printed no card frames at all`);
      for (const h of page.h) {
        assert.ok(Math.abs(h - 247.2) <= 1,
          `page ${i + 1} printed a card frame ${h}pt tall, not 247.2pt: ` +
          "the row is clipped by the page break and its diagram never painted");
      }
      /* WHERE the sheet lands, not just how tall its cards are. This suite
         measured heights alone and stayed green through a regression that put
         the top row's border at y=0.0, flush with the paper edge - every
         consumer printer has a 3-5mm non-printable band and would have sheared
         it. The cause was `.printpage` carrying a min-height with nothing to
         fill the page box, so the flex centring had no free space to
         distribute and the sheet top-aligned. */
      assert.ok(page.top >= 8,
        `page ${i + 1} printed its top card frame ${page.top}pt from the paper edge; ` +
        "under ~8pt it lands in a consumer printer's non-printable band");
      assert.ok(Math.abs(page.top - page.bottom) <= 2,
        `page ${i + 1} is not centred vertically: ${page.top}pt above the sheet, ` +
        `${page.bottom}pt below. The slack must fall on BOTH ends - a platform ` +
        "that draws its own header band eats the end that has none");
      /* Reviewer N2: the horizontal twin of the same defect. Dropping
         `justify-content:center` survived all 271 tests - desktop wide is a
         557.2pt sheet in a 612pt page, so left-aligning puts the left column's
         border at x~0, in the same non-printable band. */
      assert.ok(page.left >= 8,
        `page ${i + 1} printed its left card frame ${page.left}pt from the paper edge; ` +
        "under ~8pt it lands in a consumer printer's non-printable band");
      assert.ok(Math.abs(page.left - page.right) <= 2,
        `page ${i + 1} is not centred horizontally: ${page.left}pt left of the sheet, ` +
        `${page.right}pt right`);
    }
  });

  /* The rendered download oracle (queue row 148 named this gap). The emitter's
     bytes are already held against tools/hifi.py glyph for glyph by
     tests/test_pdf_parity.py - but that runs the emitter in node, from a deck
     a test built. This runs it where it actually ships: a real browser, the
     real CTA, a real click, a real Blob, and a deck the app itself generated
     from a typed scale. The file is then opened by a PDF reader, because
     "some bytes came back" is not the same claim as "a reader can open it".

     Read off the blob rather than off the disk: Chrome's download machinery is
     not under test and writing into the harness's working directory is a side
     effect nobody wants in a repo. */
  test("the custom-deck CTA downloads a PDF a reader can open", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;
    const { spawnSync } = require("node:child_process");
    const os = require("node:os");

    await freshLoad();
    await generate(SIX_SCALES[1]);
    // The anchor click is real, so the transfer is real unless it is refused.
    await b.send("Page.setDownloadBehavior", { behavior: "deny" }).catch(() => {});

    const cap = await b.eval(`
      return (async () => {
        const real = URL.createObjectURL;
        const seen = [];
        URL.createObjectURL = function (blob) { seen.push(blob); return real.call(URL, blob); };
        const btn = [...document.querySelectorAll("#front .prints button")]
          .find(el => el.textContent.trim() === "FULL DECK PDF");
        if (!btn) return { err: "no FULL DECK PDF button on the showing face" };
        try { btn.click(); } finally { URL.createObjectURL = real; }
        if (seen.length !== 1) return { err: seen.length + " blobs, not 1" };
        const u8 = new Uint8Array(await seen[0].arrayBuffer());
        // Chunked: spreading 200k bytes into one call blows the stack.
        let s = "";
        for (let i = 0; i < u8.length; i += 4096) {
          s += String.fromCharCode.apply(null, u8.subarray(i, i + 4096));
        }
        return { type: seen[0].type, n: u8.length, b64: btoa(s) };
      })();`);

    assert.ok(!cap.err, cap.err);
    assert.strictEqual(cap.type, "application/pdf");
    assert.ok(cap.n > 10000, `the CTA produced ${cap.n} bytes; that is not a card sheet`);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "emitted-pdf-"));
    const pdf = path.join(dir, "deck.pdf");
    fs.writeFileSync(pdf, Buffer.from(cap.b64, "base64"));

    // Same oracle the printed-sheet test above uses, and the same reason:
    // pymupdf is already a documented test requirement and the js suite is
    // node-only. A card frame is a drawn path, invisible to a byte scan.
    //
    // The frame is matched on the print spec's own measurement - 177.6 x 247.2
    // pt, the poker-size card - and not on a range. Every card also draws an
    // inset 172 x 241.6 rect, so a loose "about that big" filter counts each
    // slot twice and the number stops meaning anything.
    const probe = [
      "import sys, json, fitz",
      "CARD = (177.6, 247.2)",
      "d = fitz.open(sys.argv[1])",
      "out = {'pages': d.page_count, 'box': [round(v, 2) for v in d[0].rect],",
      "       'frames': [], 'glyphs': 0}",
      "for p in d:",
      "    fr = [dr for dr in p.get_drawings()",
      "          if abs(dr['rect'].width - CARD[0]) < 0.1",
      "          and abs(dr['rect'].height - CARD[1]) < 0.1]",
      "    out['frames'].append(len(fr))",
      "    out['glyphs'] += len(p.get_text('text'))",
      "print(json.dumps(out))",
    ].join("\n");

    let r;
    try {
      r = spawnSync("python3", ["-c", probe, pdf], { encoding: "utf8", timeout: 120000 });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    assert.strictEqual(r.status, 0,
      `the pymupdf probe failed (install pymupdf):\n${(r.stdout || "") + (r.stderr || "")}`);
    const got = JSON.parse(r.stdout.trim().split("\n").pop());

    // The deck the app just generated, counted the app's own way: the full
    // variant is the chords plus a title card and a legend card, padded to
    // whole 3x3 pages. Nothing here is a literal the emitter could drift from.
    const want = await b.eval(`
      const n = deck().chords.length + 2;
      return { pages: Math.ceil(n / 9), cards: n };`);

    assert.strictEqual(got.pages, want.pages,
      `the emitted PDF has ${got.pages} pages; ${want.cards} cards at 9 a page is ${want.pages}`);
    assert.deepStrictEqual(got.box, [0, 0, 612, 792],
      "the page box must be US Letter - the print spec the cards are measured for");
    const frames = got.frames.reduce((a, n) => a + n, 0);
    assert.strictEqual(frames, want.pages * 9,
      `${frames} card frames drawn; every slot on every page carries one, so ${want.pages * 9}`);
    assert.ok(got.glyphs > 500,
      `only ${got.glyphs} characters of text - the fonts did not draw`);
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
          // + ADD IS one of these chips now (owner, 2026-09: "'Add' call to
          // action can be inline as first option with the different scale
          // selections to save vertical space"), and it leads the row. It is in
          // normal flow, so it overlays nothing; see the row-214 test below.
          addFirst: nav.children[0] === document.getElementById("deck-add"),
          body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
        };
      `);
      assert.strictEqual(row.chips, 1 + 3 + 6, "+ ADD, three built-ins and six customs");
      assert.strictEqual(row.tops.length, 1, `the chip row wrapped onto ${row.tops.length} lines`);
      assert.strictEqual(row.wraps, false, "the chip row grew taller than one line");
      assert.strictEqual(row.rowScrolls, true, "nine chips at 380px should scroll horizontally");
      assert.strictEqual(row.activeInView, true, "the active chip is not scrolled into view");
      assert.strictEqual(row.addFirst, true, "+ ADD is no longer the strip's first chip");
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
   * These tests deliberately do NOT scrollIntoView the button - the owner
   * cannot do that, and neither may the test that guards them.
   *
   * 2026-09: + ADD moved INTO the strip as its first chip, at the owner's
   * request. That trades one cost for another and the trade is deliberate: it
   * can no longer be pushed off the right edge by decks (it is ahead of all of
   * them), but it CAN be scrolled off the left, because buildChips scrolls the
   * SELECTED chip into view. So the guarantee this test now pins is "on screen
   * at rest", where rest is the strip's own origin: scrollLeft 0, which is where
   * every load starts and where a swipe back always lands. The strip is reset to
   * 0 below for exactly that reason, and for no other - no scrollIntoView on the
   * button itself, and the click that follows is a real click at its centre.
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
          nav.scrollLeft = 0;                        // the strip at rest
          const restedAtZero = nav.scrollLeft === 0;
          const r = add.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return {
            r: { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height },
            vw: document.documentElement.clientWidth,
            vh: document.documentElement.clientHeight,
            overflows: nav.scrollWidth > nav.clientWidth + 1,
            decks: nav.querySelectorAll(".chip:not(#deck-add)").length,
            hitIsAdd: !!hit && (hit === add || add.contains(hit)),
            first: nav.children[0] === add,
            restedAtZero,
            body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
          };
        `);
        const at = `at ${vw}x${vh} with ${m.decks} decks`;
        assert.strictEqual(m.first, true, `+ ADD is not the first chip ${at}`);
        assert.strictEqual(m.restedAtZero, true, `the strip would not rest at scrollLeft 0 ${at}`);
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
   * The overlay is gone: + ADD is the strip's first chip, in normal flow, and
   * nothing in its CSS may ever reintroduce position:sticky, a negative margin
   * or a z-index. This test is what says so, and it now sweeps + ADD itself as
   * one of the chips.
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
        // + ADD must answer for itself at all three of its own points. It is
        // one of the .chip nodes above now, so this is belt and braces - and it
        // takes the same scrollport guard, because as the strip's FIRST child
        // it is the one thing that can be scrolled off the LEFT edge.
        const ar = add.getBoundingClientRect();
        const ay = ar.top + ar.height / 2;
        for (const p of pts(ar)) {
          if (p.x < nr.left || p.x > nr.right) continue;
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
      // i indexes DECKS; + ADD is the strip's first chip, so it is one along.
      const selectChip = async (i) => {
        const n = i + 1;
        await b.eval(`document.querySelectorAll("#decks .chip")[${n}]
                        .scrollIntoView({ block: "nearest", inline: "nearest" });
                      return true;`);
        await b.click(`#decks .chip:nth-child(${n + 1})`);
        await b.waitFor(
          `document.querySelectorAll("#decks .chip")[${n}].classList.contains("on")`,
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
    // Re-measured 2026-09 after "+ ADD" moved into the deck strip. That retired
    // a whole 50px row of chrome and the spacing ramp spent part of it back, so
    // every row here moved the RIGHT way and the table was tightened onto the
    // new numbers - which is what makes the gain a floor rather than a windfall
    // some later change can quietly spend. Portrait chrome 269.17 -> 263.67;
    // landscape 276.17 -> 251.67, and the card at 844x390 is 82.42 -> 100.16px
    // wide, +21.5%.
    [390, 844, 343.19, 263.67],
    [390, 745, 342.69, 263.67],
    [375, 667, 292.78, 262.67],
    [320, 568, 221.09, 262.67],
    [844, 390, 100.16, 251.67],
    [926, 428, 127.67, 251.67],
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
   * the landscape header (coordination row 245)
   *
   * Row 245 closed the landscape card as "genuinely small, and that is a
   * disclosed cost": at 844x390 the STACKED header - title, deck strip,
   * mode bar, three rows plus their gaps - ate 134px of a 390px viewport,
   * `main` was left 138.3px and the fit rule capped the card at 100.2px
   * wide. The owner's decision was the first of the two paths the row
   * offered: shrink the header in landscape.
   *
   * The rows below are MEASURED on the shrunk header and written down as
   * one-sided budgets, exactly like CHROME_BUDGET above - chrome may only
   * get smaller, the card may only get bigger - so an improvement never has
   * to touch the table and a regression does.
   *
   * Two guards, not one. This test says landscape got better; the test
   * after it says portrait did not move AT ALL, by equality rather than by
   * a bound, because the acceptance condition the owner set for row 245 is
   * that portrait stays byte-identical. A media query is the whole reason
   * that is even possible, so the pair is what proves the query's gate and
   * not merely its body.
   * ---------------------------------------------------------------- */
  const LANDSCAPE_BUDGET = [
    // vw,  vh,  minCardW, maxChrome, maxHeader   (chrome = vh - main.height)
    // Measured 2026-09-15 with the header collapsed to a single 44px row.
    // Before: chrome 251.67 and header 134 at every one of these; the card
    // was 100.16 / 127.67 / 89.30 / 179.81px wide.
    [844, 390, 167.50, 158.67, 44],
    [926, 428, 195.02, 158.67, 44],
    [667, 375, 156.64, 158.67, 44],
    [1280, 500, 229.98, 158.67, 44],
  ];

  test("the header shrinks in landscape and hands the room to the card", async () => {
    await freshLoad();
    try {
      const bad = [];
      for (const [vw, vh, minCardW, maxChrome, maxHeader] of LANDSCAPE_BUDGET) {
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
        if (m.header > maxHeader + 1) {
          bad.push(`${vw}x${vh}: the header is ${m.header}px tall, budget ${maxHeader}px - ` +
            `in landscape it must be ONE row, not the portrait stack`);
        }
        if (chrome > maxChrome + 1) {
          bad.push(`${vw}x${vh}: chrome is ${chrome}px, budget ${maxChrome}px ` +
            `(header ${m.header}, footer ${m.footer}) - main is ${m.main}px`);
        }
        if (m.card < minCardW - 1) {
          bad.push(`${vw}x${vh}: the card is ${m.card}px wide, budget ${minCardW}px ` +
            `(-${(100 * (1 - m.card / minCardW)).toFixed(1)}%) - the room the header ` +
            `gives up belongs to the card`);
        }
      }
      assert.deepStrictEqual(bad, [],
        "the landscape header has grown back at the card's expense (row 245)");
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  /* ---------------------------------------------------------------- *
   * what the landscape header actually buys, measured
   *
   * The stylesheet used to claim that with the title out "every landscape
   * viewport in the budget table holds the whole strip with no scroll at
   * all". It does not, and never did - the comment's own arithmetic
   * (463 + 241 > 643 at 667x375) disproves it. The two landscape tests
   * above both run freshLoad() with the three BUILT-INS only and assert
   * nothing at all about the strip's width, which is exactly why a false
   * claim could ship green.
   *
   * So: pin the real numbers, with a CUSTOM deck on the strip, which is the
   * owner's actual configuration and the one the old claim was furthest
   * from. The strip overflowing is FINE - .decks is overflow-x:auto, so it
   * scrolls and never clips. What is NOT fine is either end becoming
   * unreachable: `.decks > :first-child{margin-left:auto}` centres the row
   * while it fits, and an auto margin in a scroll container is the classic
   * way to strand the leading item off the scrollable origin. That is the
   * real risk in this rule, so it is what gets asserted.
   * ---------------------------------------------------------------- */
  test("the landscape deck strip scrolls rather than clips, at both ends", async () => {
    await freshLoad();
    await b.setViewport(380, 780, true);
    try {
      await generate(EDIT_SCALE);           // four chips + "+ ADD", the owner's case
      const bad = [];
      const seen = {};
      for (const [vw, vh] of LANDSCAPE_BUDGET) {
        await b.setViewport(vw, vh, true);
        const m = await b.eval(`
          const nav = document.querySelector(".decks");
          const first = nav.firstElementChild, last = nav.lastElementChild;
          const box = () => nav.getBoundingClientRect();
          // Leading end: scroll to the origin and ask whether the first chip
          // is actually inside the box. An auto margin that strands it puts
          // its left edge to the LEFT of the container with scrollLeft 0.
          nav.scrollLeft = 0;
          const atStart = first.getBoundingClientRect().left - box().left;
          // Trailing end: scroll as far as the container allows.
          nav.scrollLeft = nav.scrollWidth;
          const atEnd = box().right - last.getBoundingClientRect().right;
          const maxScroll = nav.scrollLeft;
          nav.scrollLeft = 0;
          return {
            sw: nav.scrollWidth, cw: nav.clientWidth, maxScroll,
            atStart: +atStart.toFixed(2), atEnd: +atEnd.toFixed(2),
            chips: nav.children.length,
            overflowX: getComputedStyle(nav).overflowX,
            bodySw: document.body.scrollWidth, bodyCw: document.body.clientWidth,
          };
        `);
        seen[`${vw}x${vh}`] = m;
        // The strip may overflow. The PAGE may not - an overflowing strip
        // that pushes the body wide is a clip, not a scroll.
        if (m.bodySw > m.bodyCw + 1) {
          bad.push(`${vw}x${vh}: the strip took the whole page horizontal ` +
            `(body ${m.bodySw} > ${m.bodyCw}) instead of scrolling inside .decks`);
        }
        // A strip that overflows must be scrollable by exactly its overflow.
        const over = m.sw - m.cw;
        if (over > 1 && Math.abs(m.maxScroll - over) > 1) {
          bad.push(`${vw}x${vh}: .decks overflows by ${over}px but scrolls only ` +
            `${m.maxScroll}px - ${over - m.maxScroll}px of chip is unreachable`);
        }
        // And the rule itself, not only its consequences. `overflow-x:hidden`
        // passes every behavioural probe above - a hidden box in Chrome is
        // still programmatically scrollable, so scrollLeft moves and both ends
        // land flush - while giving a FINGER nothing to grab: no scrollbar, no
        // drag, no wheel. Only `auto` and `scroll` are user-scrollable, so the
        // computed value is asserted directly.
        if (m.overflowX !== "auto" && m.overflowX !== "scroll") {
          bad.push(`${vw}x${vh}: .decks computes overflow-x:${m.overflowX}. ` +
            "Only auto and scroll let a user scroll the strip; clip visibly " +
            "truncates it, and hidden leaves it scriptable but untouchable, " +
            "which every other assertion in this test would call a pass");
        }
        // Both ends land flush. Negative = the chip sits outside the box even
        // at the extreme of the scroll range, i.e. it can never be tapped.
        if (m.atStart < -1) {
          bad.push(`${vw}x${vh}: at scrollLeft 0 the FIRST chip starts ${-m.atStart}px ` +
            "left of .decks - margin-left:auto has stranded it outside the " +
            "scrollable origin and no gesture can bring it back");
        }
        if (m.atEnd < -1) {
          bad.push(`${vw}x${vh}: fully scrolled, the LAST chip still ends ` +
            `${-m.atEnd}px past .decks' right edge`);
        }
      }
      assert.deepStrictEqual(bad, [], JSON.stringify(seen, null, 2));

      // And the positive claim, stated as a RELATIONSHIP rather than as a
      // pixel count: the strip is wider than the viewport gives it at the
      // shortest landscape a phone offers. Measured 2026-09-15 on a Mac with
      // Nunito Sans resolved: .decks scrollWidth / clientWidth is 611/570 at
      // 844x390, 652/652 at 926x428, 611/393 at 667x375 and 1006/1006 at
      // 1280x500, i.e. 41px and 218px of overflow on the two narrow rows.
      // Built-ins alone already overflow 667x375 by 70px (463 vs 393).
      //
      // Those pixel counts are font-metric dependent - a CI box without the
      // webfont measures different chips - so what is ASSERTED is the sign,
      // on the row where the margin is 200px and no font substitution can
      // flip it. That is precisely the claim the stylesheet used to get
      // wrong, and the whole reason this test exists.
      const narrow = seen["667x375"];
      assert.ok(narrow.sw > narrow.cw + 100,
        "at 667x375 with a custom deck the strip now FITS " +
        `(${narrow.sw} <= ${narrow.cw}): ${JSON.stringify(seen, null, 2)}. If a ` +
        "layout change really did buy that, index.html's landscape comment - " +
        "which states the strip scrolls and by how much - is now the stale one.");

      // The other half of that comment's claim, which nothing used to cover:
      // "with the title out the strip gets the whole width, and on the two
      // WIDER rows it then fits". Stated, like the line above, as a SIGN and
      // not as the measured 652/652 and 1006/1006 - scrollWidth reports
      // max(content, clientWidth), so a row that fits reads sw == cw whatever
      // the chips actually measure, and a row that does not reads strictly
      // wider. That makes it font-metric independent in the direction that
      // matters: only a real overflow can fail it.
      for (const row of ["926x428", "1280x500"]) {
        const wide = seen[row];
        assert.ok(wide.sw <= wide.cw + 1,
          `at ${row} the deck strip no longer fits (${wide.sw} > ${wide.cw}), ` +
          "so a chip is reachable only by scrolling. index.html's landscape " +
          "comment claims both wider rows fit with a custom deck on the strip; " +
          `one of the two is now wrong: ${JSON.stringify(seen, null, 2)}`);
      }
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  /* Portrait is the acceptance test for row 245: if any portrait measurement
   * moves, the change is wrong. So this does not compare portrait against a
   * table of numbers someone once measured - those numbers are one machine's
   * font metrics, and CI's are different. It compares portrait against
   * ITSELF with the landscape block deleted from the stylesheet at runtime.
   *
   * Identical geometry with and without the rule is the whole claim, stated
   * exactly: not "portrait is within a budget", not "portrait matches a
   * number measured on a Mac" - portrait does not move, on whatever machine
   * is asking, in either direction. A rule that leaked into portrait "in the
   * flattering direction" fails here just as loudly as one that crowded it.
   *
   * The block is found by its CONTENT (the visually-hidden h1's clip-path),
   * never by its media condition: a mutant that widens the GATE - the exact
   * defect this is here to catch - would slip past a search for
   * "max-height", because it is no longer a max-height query at all. */
  const PORTRAIT_VIEWPORTS = [
    [390, 844], [390, 745], [375, 667], [320, 568], [380, 800], [380, 780],
  ];

  test("portrait is byte-identical: the landscape header never reaches it", async () => {
    await freshLoad();
    try {
      const bad = [];
      for (const [vw, vh] of PORTRAIT_VIEWPORTS) {
        await b.setViewport(vw, vh, true);
        const m = await b.eval(`
          const read = () => {
            const q = s => document.querySelector(s).getBoundingClientRect();
            return {
              header: +q("header").height.toFixed(2),
              headerW: +q("header").width.toFixed(2),
              footer: +q("footer").height.toFixed(2),
              main: +q("main").height.toFixed(2),
              card: +q(".scene").width.toFixed(2),
              h1: +q("h1").height.toFixed(2),
              display: getComputedStyle(document.querySelector("header")).display,
              modeTop: getComputedStyle(document.querySelector(".modebar")).marginTop,
              h1Pos: getComputedStyle(document.querySelector("h1")).position,
            };
          };
          const before = read();
          // Pull the landscape block out of the cascade, then read the same
          // page again. Anything it was doing to portrait shows up as a
          // difference; if it reaches portrait not at all, nothing moves.
          const pulled = [];
          for (const sh of Array.from(document.styleSheets)) {
            let rules;
            try { rules = Array.from(sh.cssRules); } catch (e) { continue; }
            for (let i = rules.length - 1; i >= 0; i--) {
              const r = rules[i];
              if (r.media && /clip-path/.test(r.cssText)) {
                pulled.push([sh, i, r.cssText]);
                sh.deleteRule(i);
              }
            }
          }
          const after = read();
          for (const [sh, i, text] of pulled.reverse()) sh.insertRule(text, i);
          return { before, after, pulled: pulled.length,
                   gate: window.matchMedia("(max-height:520px)").matches };
        `);
        if (m.pulled !== 1) {
          bad.push(`${vw}x${vh}: found ${m.pulled} landscape blocks in the ` +
            "stylesheet, expected exactly 1 - this test can no longer find the " +
            "rule it is pinning, so its silence would mean nothing");
        }
        if (m.gate !== false) {
          bad.push(`${vw}x${vh}: the max-height:520px gate MATCHES in portrait`);
        }
        for (const k of Object.keys(m.before)) {
          const a = m.before[k], z = m.after[k];
          const moved = typeof a === "number" ? Math.abs(a - z) > 0.01 : a !== z;
          if (moved) {
            bad.push(`${vw}x${vh}: ${k} is ${a} with the landscape block and ` +
              `${z} without it - portrait must not move at all (row 245)`);
          }
        }
      }
      assert.deepStrictEqual(bad, [],
        "portrait moved - row 245's acceptance condition is that it does not");
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  /* ---------------------------------------------------------------- *
   * the pencil on a selected CUSTOM chip (coordination row 218)
   *
   * Row 218: "editing a custom deck is undiscoverable". The already-selected
   * custom chip is the one and only way into the Edit sheet, and it looks
   * exactly like an already-selected built-in, which does nothing when
   * tapped. The fix is an affordance the built-ins do not get.
   *
   * What this asserts, and why each half matters:
   *  - the glyph and the accessible name appear ONLY on a chip that is both
   *    selected AND custom. Row 262 is the reason the negative half is not
   *    decoration: any change that advertises Edit on a NON-selected chip
   *    re-opens a focus trap in deleteDeck that selectDeck's guard does not
   *    cover. The chip's behaviour must stay exactly "second tap on the
   *    selected custom chip", and an affordance that appears anywhere else
   *    would be the first step to breaking it.
   *  - the glyph hit-tests to the CHIP. A separate button inside the chip
   *    would be a second target inside a 44px pill and a second tab stop for
   *    a control that is already reachable; the glyph is a marker, so the
   *    whole pill stays one target.
   * ---------------------------------------------------------------- */

  // The glyph is generated content, so it has no node to query. Two things
  // stand in for one, and between them they say everything a node would:
  //  - getComputedStyle(el, "::after").content is the glyph itself;
  //  - the width the chip LOSES when .editable is taken off and put back is
  //    the box that glyph occupies ON the chip. A rule that drew the pencil
  //    somewhere else - out of flow, off-screen, invisible - takes that box
  //    with it, and `grew` goes to zero while `content` still reads "✎".
  // The midpoint of that recovered box is then hit-tested, so the pixel the
  // glyph draws is shown to be a pixel that acts.
  const chipProbe = () => b.eval(`
    const out = [];
    for (const el of document.querySelectorAll("#decks .chip")) {
      if (el.id === "deck-add") continue;
      const r = el.getBoundingClientRect();
      const marked = el.classList.contains("editable");
      let grew = null, hit = null;
      if (marked) {
        el.classList.remove("editable");
        const plain = el.getBoundingClientRect().width;
        el.classList.add("editable");
        grew = +(el.getBoundingClientRect().width - plain).toFixed(1);
        const pad = parseFloat(getComputedStyle(el).paddingRight) || 0;
        const h = document.elementFromPoint(r.right - pad - grew / 2, r.top + r.height / 2);
        hit = !!h && (h === el || el.contains(h));
      }
      out.push({
        text: el.textContent.trim(),
        on: el.classList.contains("on"),
        label: el.getAttribute("aria-label"),
        marked,
        glyph: getComputedStyle(el, "::after").content,
        grew,
        hit,
        h: +r.height.toFixed(1),
      });
    }
    return out;
  `);

  test("a selected custom chip carries a pencil; no built-in chip ever does", async () => {
    try {
      await freshLoad();
      await b.setViewport(380, 780, true);
      const meta = await decksMeta();
      await generate(EDIT_SCALE);

      // A name LONGER than CHIP_CAP (16), so the chip's visible text is
      // actually elided. WCAG 2.5.3 Label-in-Name: the visible string must be
      // contained in the accessible name, or Voice Control's "tap <what I can
      // read>" hits nothing. An aria-label built from the FULL name announces
      // "Edit MY LOW PYGMY SCALE" over a chip that reads "MY LOW PYGMY SC…",
      // and the ellipsis makes the visible string a non-substring. A short
      // name cannot catch this - the two agree whenever nothing is elided.
      const LONG_NAME = "MY LOW PYGMY SCALE";
      await openEdit();
      await b.eval(`
        const el = document.getElementById("scale-name");
        el.value = ${JSON.stringify(LONG_NAME)};
        el.dispatchEvent(new Event("input", { bubbles: true }));
        return el.value;
      `);
      await b.click("#scale-generate");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the Edit sheet to close after the rename" });

      const after = await chipProbe();
      const sel = after.filter((c) => c.on);
      assert.strictEqual(sel.length, 1, "exactly one chip is selected after Generate");
      const mine = sel[0];
      assert.strictEqual(mine.marked, true,
        `the selected custom chip "${mine.text}" has no pencil - row 218 is that ` +
        "Edit is undiscoverable, and the chip looks identical to a built-in");
      assert.ok(/\u270E/.test(mine.glyph),
        `the chip's ::after draws ${JSON.stringify(mine.glyph)}, not a pencil`);
      assert.ok(mine.grew >= 6,
        `the pencil takes ${mine.grew}px on the chip: it is drawn somewhere ` +
        "else, so the chip the owner taps looks no different from a built-in");
      assert.strictEqual(mine.hit, true,
        "the pencil does not hit-test to its own chip: a tap on the glyph must " +
        "be a tap on the chip, or the affordance points at a dead pixel");
      assert.ok(/^Edit .+/.test(mine.label || ""),
        `the selected custom chip's aria-label is ${JSON.stringify(mine.label)}, ` +
        'expected "Edit <name>"');
      // The chip really is elided at this name length, or the check below is
      // vacuous: a full name and a capped one agree trivially.
      assert.ok(mine.text.length < LONG_NAME.length && /…$/.test(mine.text),
        `the chip reads ${JSON.stringify(mine.text)} for a ${LONG_NAME.length}-char ` +
        "name - CHIP_CAP no longer elides, so this test can no longer see the bug");
      assert.ok((mine.label || "").includes(mine.text),
        `WCAG 2.5.3 Label-in-Name: the chip READS ${JSON.stringify(mine.text)} but ` +
        `ANNOUNCES ${JSON.stringify(mine.label)}. The visible string is not contained ` +
        "in the accessible name, so Voice Control's \"tap " + mine.text + "\" matches " +
        "nothing. The aria-label must be built from chipLabel(name), not from name.");
      assert.ok(mine.h >= 44,
        `the pencil shrank the chip below the 44px target: ${mine.h}px`);
      // The glyph is decoration and must stay out of the chip's TEXT: the
      // deck's label is read by the chip row, by the announcements and by
      // every test that names a deck, and none of them should have to know
      // the pencil exists.
      for (const c of after) {
        assert.ok(!/\u270E/.test(c.text),
          `the pencil leaked into a chip's text: ${JSON.stringify(c.text)}`);
      }

      // Every OTHER chip - the three built-ins, all unselected here - is
      // untouched: no glyph, no Edit name.
      for (const c of after.filter((x) => !x.on)) {
        assert.strictEqual(c.marked, false,
          `an unselected chip ("${c.text}") carries a pencil - Edit must be ` +
          "offered only where it actually works (row 262)");
        assert.strictEqual(c.label, null,
          `an unselected chip ("${c.text}") has aria-label ${JSON.stringify(c.label)}`);
      }

      // And a SELECTED built-in: selected is not enough, custom is not enough.
      await selectDeck(0, meta);
      const builtin = (await chipProbe()).find((c) => c.on);
      assert.ok(builtin, "no chip is selected after switching to a built-in deck");
      assert.strictEqual(builtin.marked, false,
        `the selected built-in chip "${builtin.text}" carries a pencil - tapping ` +
        "it does nothing, so the affordance would be a lie");
      assert.strictEqual(builtin.label, null,
        `the selected built-in chip has aria-label ${JSON.stringify(builtin.label)}`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("tapping the pencil opens the Edit sheet, from the glyph itself", async () => {
    try {
      await freshLoad();
      await b.setViewport(380, 780, true);
      await generate(EDIT_SCALE);
      await b.eval(`document.querySelector("#decks .chip.on")
                      .scrollIntoView({ block: "nearest", inline: "nearest" }); return true;`);
      // Click the GLYPH's own centre point, not the chip's - the affordance
      // is only real if the pixel it draws is the pixel that acts.
      const at = await b.eval(`
        const el = document.querySelector("#decks .chip.on");
        const r = el.getBoundingClientRect();
        el.classList.remove("editable");
        const plain = el.getBoundingClientRect().width;
        el.classList.add("editable");
        const grew = el.getBoundingClientRect().width - plain;
        const pad = parseFloat(getComputedStyle(el).paddingRight) || 0;
        return { x: r.right - pad - grew / 2, y: r.top + r.height / 2, grew };
      `);
      assert.ok(at.grew >= 6, `the pencil occupies ${at.grew}px on the chip`);
      await clickPoint(at.x, at.y);
      await b.waitFor(`!document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the Edit sheet to open from a tap on the pencil" });
      const primary = await b.eval(
        `return document.getElementById("scale-generate").textContent.trim();`);
      assert.strictEqual(primary, "SAVE CHANGES",
        "the pencil opened the CREATE sheet, not the Edit sheet");
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  /* ---------------------------------------------------------------- *
   * defensive mobile chrome (coordination row 223 e/f, and the notch)
   *
   * Three of row 223's items are fixable without the device even though
   * their final confirmation is not:
   *
   *  (e) no scrolling surface set `overscroll-behavior`, so a flick past the
   *      end of the sheet - or of the deck strip - chains to the page behind
   *      it and rubber-bands the whole app under a modal.
   *  (f) `-webkit-tap-highlight-color:transparent` removes iOS's only
   *      default touch feedback, and `button.nav:active` was the app's ONLY
   *      `:active` rule. iOS has no hover, so `:active` is the entire press
   *      channel: without it a tap that missed and a tap that landed look
   *      the same.
   *  (notch) the body reserved the top and bottom insets but not the left
   *      and right, which are the ones that are non-zero in LANDSCAPE - the
   *      orientation row 245 just made usable.
   *
   * The insets themselves are 0 in Chromium, so the third test reads the
   * authored declaration rather than a computed pixel. That is the honest
   * limit: row 223(c) says the real values need the owner's device, and
   * nothing headless can say otherwise. What IS testable is that the
   * declaration exists and names all four edges.
   * ---------------------------------------------------------------- */

  test("every scrolling surface contains its overscroll", async () => {
    await freshLoad();
    await b.setViewport(380, 780, true);
    try {
      await openSheet();
      const seen = await b.eval(`
        const out = {};
        for (const sel of [".decks", ".sheetsurf", ".sheetbody"]) {
          const el = document.querySelector(sel);
          out[sel] = el ? getComputedStyle(el).overscrollBehavior : "MISSING";
        }
        return out;
      `);
      for (const sel of Object.keys(seen)) {
        assert.strictEqual(seen[sel], "contain",
          `${sel} has overscroll-behavior: ${seen[sel]} - a flick past its end ` +
          "chains to the page behind it and drags the whole app (row 223e)");
      }
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("every interactive control has a press state", async () => {
    await freshLoad();
    await b.setViewport(380, 780, true);
    try {
      // A custom deck first, so the Edit-only controls (DELETE THIS DECK, the
      // degrees row) and a custom chip are on the page too. Then the sheet,
      // so the swatches, the mirror pair, the LAYOUT group and the primary are.
      await generate(EDIT_SCALE);
      await b.eval(`document.querySelector("#decks .chip.on")
                      .scrollIntoView({ block: "nearest", inline: "nearest" }); return true;`);
      await b.click("#decks .chip.on");
      await b.waitFor(`!document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the Edit sheet to open" });

      const bad = await b.eval(`
        // Collect every selector in the document's own stylesheet that has an
        // :active state, media queries included, and strip the pseudo-class so
        // it can be matched against a live element.
        //
        // Two CSSOM traps, both of which return an EMPTY list rather than an
        // error - i.e. both of which would make this test pass vacuously:
        //  - CSSRuleList and StyleSheetList are array-like but NOT iterable in
        //    Chrome, so a bare for..of throws and the catch below swallows it;
        //    hence Array.from.
        //  - since nested CSS, EVERY CSSStyleRule carries a .cssRules of its
        //    own (empty), so "if (r.cssRules) { recurse; continue; }" skips
        //    every real rule in the sheet. Recurse only into a NON-empty list
        //    and never skip the rule itself.
        // The assertion message prints the collected list for exactly this
        // reason: an empty one is a broken sweep, not a clean app.
        const actives = [];
        const walk = (rules) => {
          for (const r of Array.from(rules)) {
            if (r.cssRules && r.cssRules.length) walk(r.cssRules);
            if (!r.selectorText || !/:active\\b/.test(r.selectorText)) continue;
            // A declaration that changes nothing is not feedback.
            if (!r.style || r.style.length === 0) continue;
            for (const one of r.selectorText.split(",")) {
              actives.push(one.trim().replace(/:active\\b/g, ""));
            }
          }
        };
        for (const s of Array.from(document.styleSheets)) { try { walk(s.cssRules); } catch (e) {} }

        const name = (el) => el.id ? "#" + el.id
          : el.tagName.toLowerCase() + (typeof el.className === "string" && el.className.trim()
            ? "." + el.className.trim().split(/\\s+/).join(".") : "");
        const out = [];
        const seen = new Set();
        for (const el of document.querySelectorAll('button, [role="button"]')) {
          if (el.closest("[hidden]")) continue;
          const n = name(el);
          if (seen.has(n)) continue;
          seen.add(n);
          const hit = actives.some((sel) => { try { return el.matches(sel); } catch (e) { return false; } });
          if (!hit) out.push(n);
        }
        return { bad: out, actives };
      `);
      assert.deepStrictEqual(bad.bad, [],
        "these controls have no :active rule, so on iOS - which has no hover and " +
        "whose tap highlight this app turns off - a press gives no feedback at all " +
        `(row 223f). The :active selectors that do exist are ${JSON.stringify(bad.actives)}`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  /* ---------------------------------------------------------------- *
   * a press state may not walk back the AA floor PR #53 bought
   *
   * The footer's quiet text buttons are 9.5px - "small text" by WCAG, so the
   * 4.5:1 floor applies, and PR #53 raised them to it deliberately. `opacity`
   * is the one press treatment that cannot be reasoned about locally: it
   * composites the text toward the BACKGROUND, so .6 takes 6.61:1 to 3.21:1
   * and the press state is the least readable moment of the interaction.
   * The sibling rule (#scale-layout-reset, #scale-delete) already does it the
   * right way, by moving `color` UP to full ink, which is also what the block
   * comment says it does.
   *
   * Asserted as "no :active rule sets opacity on .shuffle" rather than as a
   * computed contrast number, because the computed style of a non-pressed
   * element never carries the :active declaration at all - a probe that read
   * getComputedStyle would pass on the broken file.
   * ---------------------------------------------------------------- */
  test("no press state dims the footer's small text with opacity", async () => {
    await freshLoad();
    const found = await b.eval(`
      const out = [];
      const walk = (rules) => {
        for (const r of Array.from(rules)) {
          if (r.cssRules && r.cssRules.length) walk(r.cssRules);
          if (!r.selectorText || !/:active\\b/.test(r.selectorText)) continue;
          if (!r.style || r.style.length === 0) continue;
          for (const one of r.selectorText.split(",")) {
            const sel = one.trim().replace(/:active\\b/g, "");
            let hits = false;
            try { hits = document.querySelector(".shuffle").matches(sel); } catch (e) {}
            if (hits) out.push({ sel: one.trim(), opacity: r.style.opacity, color: r.style.color });
          }
        }
      };
      for (const s of Array.from(document.styleSheets)) { try { walk(s.cssRules); } catch (e) {} }
      return out;
    `);
    assert.ok(found.length > 0,
      "no :active rule matches .shuffle at all - the sweep is broken, or the " +
      "footer button lost its press state entirely");
    const dims = found.filter((r) => r.opacity !== "");
    assert.deepStrictEqual(dims, [],
      "these :active rules dim .shuffle with opacity: " + JSON.stringify(dims) +
      ". The footer is 9.5px, so WCAG's 4.5:1 small-text floor applies; opacity " +
      ".6 composites it toward the background and drops 6.61:1 to 3.21:1, below " +
      "AA - which is exactly the floor PR #53 raised this footer to. Lift `color` " +
      "to full ink instead, the way #scale-layout-reset:active already does.");
    assert.ok(found.some((r) => r.color !== ""),
      "no :active rule on .shuffle moves `color` - the block's own comment says " +
      "the quiet text buttons come up to full ink, and nothing else here can");
  });

  /* ---------------------------------------------------------------- *
   * the press ring follows the card's corners
   *
   * .card:active paints a box-shadow ring, but the 12px radius lives on
   * .face, one level down. A box-shadow takes the radius of the element it
   * is ON, so a .card with no radius rings a rounded card in a hard
   * rectangle - a square nub at each corner, on every tap.
   * ---------------------------------------------------------------- */
  test("the card's press ring is as round as the card", async () => {
    await freshLoad();
    const r = await b.eval(`
      const px = (el) => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      return { card: px(document.getElementById("card")),
               face: px(document.querySelector("#card .face")) };
    `);
    assert.ok(r.face > 0, "the face lost its radius - this test's premise is gone");
    assert.strictEqual(r.card, r.face,
      `.card has a ${r.card}px radius and .face has ${r.face}px, so .card:active's ` +
      "box-shadow ring is drawn square around a rounded card and a nub of ring " +
      "sticks out past each corner while the finger is down");
  });

  test("the page reserves a safe-area inset on all four edges", async () => {
    await freshLoad();
    try {
      const decl = await b.eval(`
        const out = [];
        const walk = (rules) => {
          for (const r of Array.from(rules)) {
            if (r.cssRules && r.cssRules.length) walk(r.cssRules);
            if (!r.selectorText || !/(^|,)\\s*body\\s*($|,)/.test(r.selectorText)) continue;
            out.push(r.style.padding || [r.style.paddingTop, r.style.paddingRight,
              r.style.paddingBottom, r.style.paddingLeft].join(" "));
          }
        };
        for (const s of Array.from(document.styleSheets)) { try { walk(s.cssRules); } catch (e) {} }
        return out.join(" | ");
      `);
      for (const edge of ["top", "right", "bottom", "left"]) {
        assert.ok(decl.includes(`safe-area-inset-${edge}`),
          `body's padding does not reserve env(safe-area-inset-${edge}): "${decl}". ` +
          "viewport-fit=cover puts the page under the notch and the home indicator, " +
          "and left/right are the non-zero pair in landscape.");
      }
      // The floors the insets replace, so a device with no inset is unchanged.
      assert.ok(/max\(/.test(decl),
        `the insets are not floored with max(): "${decl}" - on a device with no ` +
        "inset at all the padding would collapse to 0 and the chrome would touch " +
        "the screen edge");
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

  test("BACK closes the Edit page, and a tap at its edge does not", async () => {
    try {
      await editFreshDeck();
      await clickPoint(8, 8);
      assert.strictEqual(await sheetShown(), true,
        "a tap near the Edit page edge closed it, discarding the edit");
      await b.click("#scale-back");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "BACK to close the Edit page" });
      assert.strictEqual(await sheetShown(), false);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("Tab is trapped inside the Edit sheet and reaches every Edit control", async () => {
    try {
      await editFreshDeck();
      const seen = [];
      for (let i = 0; i < 27; i++) {
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
      for (const id of ["scale-back",
                        "scale-name", "scale-box", "scale-degrees", "scale-generate", "scale-delete",
                        "scale-rot-l", "scale-rot-r", "scale-layout-reset",
                        "scale-move-l", "scale-move-r"]) {
        assert.ok(ids.has(id), `Tab never reached #${id}: ${JSON.stringify([...ids])}`);
      }
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  /* The AC3 hint, judged by what the owner can SEE. The unit test reads
   * index.html as text because the DOM sandbox conjures an element for any id
   * asked for - but text cannot tell markup from a comment, cannot tell a
   * paragraph inside the LAYOUT group from one dumped before </body>, and
   * cannot see `display:none`. All three of those leave the owner's question
   * unanswered while the unit test still passes, so the oracle that closes them
   * has to be a real browser: a box with height, inside the group, carrying the
   * three gestures. */
  test("the LAYOUT hint is visible inside the group, not merely present in the file", async () => {
    try {
      await editFreshDeck();
      const hint = await b.eval(`
        const el = document.getElementById("scale-layout-hint");
        if (!el) return { missing: true };
        const row = document.getElementById("scale-layout-row");
        /* Scroll it up the way a reader would before measuring: the hint sits
         * below the fold of the sheet's own scroller at 380x780, so measuring
         * where it happens to rest asserts a scroll position, not visibility. */
        el.scrollIntoView({ block: "center" });
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        /* The box the owner can actually SEE: the element's own rect clipped by
         * every scrolling/hiding ancestor and then by the viewport. A rect with
         * height is not enough - 'left:-9999px' and an ancestor 'max-height:0;
         * overflow:hidden' both leave getBoundingClientRect() reporting a full
         * box for a paragraph nobody can read. */
        let top = r.top, left = r.left, right = r.right, bottom = r.bottom;
        for (let p = el.parentElement; p; p = p.parentElement) {
          const pcs = getComputedStyle(p);
          if (pcs.overflowX !== "visible" || pcs.overflowY !== "visible") {
            const q = p.getBoundingClientRect();
            top = Math.max(top, q.top); left = Math.max(left, q.left);
            right = Math.min(right, q.right); bottom = Math.min(bottom, q.bottom);
          }
        }
        top = Math.max(top, 0); left = Math.max(left, 0);
        right = Math.min(right, innerWidth); bottom = Math.min(bottom, innerHeight);
        /* opacity does not inherit, so a fully-opaque element can still be
         * invisible because an ANCESTOR (not necessarily the nearest one) is
         * opacity:0 - the effective opacity is the PRODUCT of every ancestor's
         * own opacity, own element included, all the way to <html>. Stopping
         * at the first non-1 ancestor (or the first ancestor at all) misses
         * every case where that ancestor is opaque but one further up isn't. */
        let effOpacity = parseFloat(cs.opacity);
        for (let p = el.parentElement; p; p = p.parentElement) {
          effOpacity *= parseFloat(getComputedStyle(p).opacity);
        }
        return {
          inRow: !!(row && row.contains(el)),
          h: r.height, w: r.width,
          vw: Math.max(0, right - left), vh: Math.max(0, bottom - top),
          rleft: r.left, rtop: r.top,
          display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
          effOpacity,
          text: (el.textContent || "").trim(),
          describes: document.querySelector('[aria-describedby~="scale-layout-hint"]') !== null,
        };
      `);
      assert.ok(!hint.missing, "#scale-layout-hint never reached the DOM");
      assert.ok(hint.inRow,
        "the hint is not inside #scale-layout-row - it explains buttons it does not sit with");
      assert.ok(hint.h > 0 && hint.w > 0,
        `the hint draws no box (${hint.w}x${hint.h}, display:${hint.display}) - nothing renders`);
      assert.notStrictEqual(hint.visibility, "hidden", "the hint is visibility:hidden");
      assert.notStrictEqual(hint.opacity, "0", "the hint is fully transparent");
      assert.ok(hint.effOpacity > 0,
        `an ancestor of the hint is opacity:0 (effective opacity ${hint.effOpacity}) - the hint's `
        + "own opacity is fine, but something above it in the tree hides it");
      assert.ok(hint.vw > 0 && hint.vh > 0,
        `the hint is laid out (${hint.w}x${hint.h} at ${hint.rleft},${hint.rtop}) but none of it `
        + `survives its clipping ancestors and the viewport (${hint.vw}x${hint.vh}) - `
        + `pushed off-screen or clipped away, the owner never reads it`);
      const said = hint.text.toLowerCase();
      for (const word of ["tap", "rotate", "move"]) {
        assert.ok(said.includes(word),
          `the rendered hint never mentions ${word}: "${hint.text}"`);
      }
      assert.ok(hint.describes,
        "nothing points at the hint with aria-describedby, so a screen reader never hears it");
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

  /** What the Edit page's pan currently shows. Stage 3 moved the correction
   *  onto the pan itself, so every LAYOUT oracle below reads the drawn mock -
   *  the thing the owner can actually see. `places` is note -> where it is
   *  drawn: the index label a target announces travels with its FIELD, so the
   *  place is the only thing on screen a correction moves. */
  const panState = () => b.eval(`
    const box = document.getElementById("scale-preview");
    const hits = [...box.querySelectorAll(".panhit")];
    const name = h => String(h.getAttribute("aria-label") || "").split(",")[0];
    const sel = hits.filter(h => h.getAttribute("data-sel") === "true");
    const row = document.getElementById("scale-layout-row").getBoundingClientRect();
    const br = box.getBoundingClientRect();
    const places = {};
    for (const h of hits) places[name(h)] = h.getAttribute("cx") + "," + h.getAttribute("cy");
    return {
      notes: hits.map(name),
      places,
      selected: sel.length === 1 ? name(sel[0]) : (sel.length ? "MANY" : null),
      stops: hits.filter(h => h.tabIndex === 0).length,
      boxStop: box.tabIndex === 0,
      named: hits.every(h => (h.getAttribute("aria-label") || "").length > 0),
      // AC5: the whole LAYOUT group AND the pan, with nothing scrolled away.
      inView: br.top >= -1 && row.bottom <= window.innerHeight + 1
              && br.left >= -1 && row.right <= window.innerWidth + 1,
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
      const before = await panState();
      assert.ok(before.notes.length >= 8, `the pan drew ${JSON.stringify(before.notes)}`);
      assert.strictEqual(before.stops, 0, "a hit target is its own tab stop");
      assert.strictEqual(before.boxStop, true, "the pan is not a tab stop");
      assert.strictEqual(before.named, true, "a hit target has no accessible name");
      assert.strictEqual(before.inView, true,
        "the pan and the LAYOUT group are not both visible without scrolling");
      noOverflow(before, "the LAYOUT section");

      assert.ok(await tabTo("scale-rot-r"), "Tab never reached ROTATE");
      await pressActive();
      const after = await panState();
      assert.notDeepStrictEqual(after.places, before.places, "ROTATE moved nothing on the pan");
      assert.deepStrictEqual(Object.values(after.places).sort(),
        Object.values(before.places).sort(), "ROTATE invented or lost a place");
      noOverflow(after, "a rotated layout");
      assert.strictEqual(after.cardW, before.cardW, "ROTATE moved --card-w");

      // and it commits through the sheet's ONE primary
      await b.click("#scale-generate");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the Edit sheet to close after SAVE CHANGES" });
      await openEdit();
      assert.deepStrictEqual((await panState()).places, after.places,
        "the saved correction did not come back with the sheet");
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  test("the arrow keys choose a position and MOVE swaps it with its neighbour", async () => {
    try {
      await editFreshDeck();
      const before = await panState();
      assert.ok(await tabTo("scale-preview"), "Tab never reached the pan");
      await b.key("ArrowRight", "ArrowRight", 39);
      const chosen = await panState();
      assert.ok(chosen.selected, "ArrowRight selected nothing");
      assert.notStrictEqual(chosen.selected, before.selected,
        "ArrowRight did not move the selection");
      assert.strictEqual(await activeId(), "scale-preview",
        "the arrow keys moved focus off the pan");

      assert.ok(await tabTo("scale-move-r"), "Tab never reached MOVE");
      await pressActive();
      const moved = await panState();
      assert.strictEqual(moved.selected, chosen.selected,
        "the selection did not follow the note");
      const changed = Object.keys(chosen.places)
        .filter((n) => moved.places[n] !== chosen.places[n]).sort();
      assert.strictEqual(changed.length, 2, `MOVE is not a swap: ${JSON.stringify(changed)}`);
      assert.ok(changed.includes(chosen.selected), "MOVE did not move the chosen note");
      const other = changed.find((n) => n !== chosen.selected);
      assert.strictEqual(moved.places[chosen.selected], chosen.places[other],
        "MOVE did not put the note where its neighbour was");
      assert.strictEqual(moved.places[other], chosen.places[chosen.selected],
        "MOVE did not displace the note it passed");
      noOverflow(moved, "a moved note");
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  test("RESET puts the generated layout back in one keyboard action", async () => {
    try {
      await editFreshDeck();
      const before = await panState();
      assert.ok(await tabTo("scale-rot-r"), "Tab never reached ROTATE");
      await pressActive();
      await pressActive();
      assert.notDeepStrictEqual((await panState()).places, before.places,
        "two rotations moved nothing");

      assert.ok(await tabTo("scale-layout-reset"), "Tab never reached RESET");
      await pressActive();
      const back = await panState();
      assert.deepStrictEqual(back.places, before.places,
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
        const ids = ${JSON.stringify(ids)};
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

  test("the armed delete button still answers a press, in the pressed colour", async () => {
    /* The armed rule and the shared :active rule have the same specificity,
       so whichever comes last in the file wins. Armed came last, which left
       the armed button as the only control on the page that did not answer a
       press - on the one tap that most needs an acknowledgement, because it
       is the tap that destroys the deck. Held down rather than clicked: the
       press state only exists between mousePressed and mouseReleased, and the
       release here is the confirming tap, so this also proves the armed
       button still fires while wearing its press colour. */
    try {
      await editFreshDeck();
      await b.click("#scale-delete");
      const box = await b.eval(`
        const r = document.getElementById("scale-delete").getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      `);
      await b.send("Input.dispatchMouseEvent",
        { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
      const held = await b.eval(`
        const el = document.getElementById("scale-delete");
        return { color: getComputedStyle(el).color, armed: el.hasAttribute("data-armed") };
      `);
      await b.send("Input.dispatchMouseEvent",
        { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });

      assert.strictEqual(held.armed, true,
        "the button disarmed under its own press, so this measured the idle colour");
      assert.notStrictEqual(held.color, "rgb(227, 178, 92)",
        "the armed delete button keeps its amber under the thumb - the press that "
        + "destroys the deck is the one control on the page that does not answer");
      assert.strictEqual(held.color, "rgb(234, 230, 223)",
        "the armed delete button presses to something other than #eae6df, which is "
        + "the pressed colour every other control on this page uses");
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the Edit sheet to close after the held press was released" });
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("deleting the selected deck falls back to a built-in with a visible message", async () => {
    try {
      await editFreshDeck();
      const gone = await b.eval(`return document.querySelector("#decks .chip.on").textContent.trim();`);
      // Owner instruction, 2026-09-17: delete takes a confirmation. The first
      // tap only arms it, and says so in the label and in warning amber.
      await b.click("#scale-delete");
      const armed = await b.eval(`
        const el = document.getElementById("scale-delete");
        const r = el.getBoundingClientRect();
        return { text: el.textContent.trim(), color: getComputedStyle(el).color,
                 h: r.height, open: !document.getElementById("scale-sheet").hasAttribute("hidden") };
      `);
      assert.strictEqual(armed.open, true, "the first tap on DELETE closed the page");
      assert.strictEqual(armed.text, "TAP AGAIN TO DELETE",
        "the armed delete button does not say what the next tap does");
      assert.strictEqual(armed.color, "rgb(227, 178, 92)",
        "the armed delete button is not in warning amber");
      assert.ok(armed.h >= 44, `the armed button shrank to ${armed.h}px, under the 44px target`);
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

  test("cancelling an armed DELETE re-syncs the box, GENERATE and the message (queue row 91)", async () => {
    /* Type a seed the parser rejects, arm DELETE, then tap elsewhere to
       disarm it. disarmDelete() must leave the box's .bad class, the
       GENERATE disabled state and the message agreeing with what is
       currently typed - not with whatever they said before DELETE was
       armed. */
    try {
      await editFreshDeck();
      await typeScale("(D3) A3 H4");   // H is not a valid note letter
      const badBefore = await b.eval(`
        return {
          bad: document.getElementById("scale-box").classList.contains("bad"),
          disabled: document.getElementById("scale-generate").disabled,
          msg: document.getElementById("scale-refusal").textContent.trim(),
        };
      `);
      assert.strictEqual(badBefore.bad, true, "the rejected seed did not mark the box bad");
      assert.strictEqual(badBefore.disabled, true, "the rejected seed left GENERATE enabled");
      assert.ok(badBefore.msg.length > 0, "the rejected seed showed no message");

      await b.click("#scale-delete");   // arm DELETE
      const armed = await b.eval(`
        return {
          armed: document.getElementById("scale-delete").hasAttribute("data-armed"),
          note: document.getElementById("scale-del-note").textContent.trim(),
          bad: document.getElementById("scale-box").classList.contains("bad"),
          disabled: document.getElementById("scale-generate").disabled,
          msg: document.getElementById("scale-refusal").textContent.trim(),
        };
      `);
      assert.strictEqual(armed.armed, true, "DELETE never armed");
      /* Read the seed row WHILE armed, not only after the disarm. This is the
         half that stays observable: the disarm re-derives, so damage done by
         arming would be repaired before the after-read and the repair would
         hide its own cause. Queue row 91 WAS that cause - the arming warning
         and the parser's refusal sharing one element - so assert the warning
         went to its own line and left the seed's three-way agreement alone. */
      assert.ok(armed.note.length > 0, "arming DELETE wrote no confirmation");
      assert.strictEqual(armed.msg, badBefore.msg,
        `arming DELETE took the seed's row: the refusal became "${armed.msg}"`);
      assert.strictEqual(armed.bad, true, "arming DELETE cleaned the rejected box");
      assert.strictEqual(armed.disabled, true, "arming DELETE made GENERATE live");

      // tap elsewhere in the sheet - not on DELETE - to disarm it
      await clickPoint(8, 8);
      const disarmed = await b.eval(
        `return document.getElementById("scale-delete").hasAttribute("data-armed");`);
      assert.strictEqual(disarmed, false, "the tap elsewhere did not disarm DELETE");

      const after = await b.eval(`
        return {
          bad: document.getElementById("scale-box").classList.contains("bad"),
          disabled: document.getElementById("scale-generate").disabled,
          msg: document.getElementById("scale-refusal").textContent.trim(),
          text: document.getElementById("scale-box").value,
        };
      `);
      // The seed in the box is still rejected, so all three must still SAY so -
      // asserted against what the rejection itself showed, not against each
      // other: `after.bad === after.disabled` is satisfied by both being false,
      // which is precisely the state where the box has gone clean and GENERATE
      // is live on a seed the parser refuses.
      assert.strictEqual(after.bad, true,
        `after disarming, the box is no longer bad for the rejected "${after.text}"`);
      assert.strictEqual(after.disabled, true,
        `after disarming, GENERATE is live on the rejected "${after.text}"`);
      assert.strictEqual(after.msg, badBefore.msg,
        `after disarming, the parser's refusal became "${after.msg}"`);
    } finally {
      await b.key("Escape", "Escape", 27);
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
    // The collision refusal renders in #scale-refusal, beside the field it is
    // about - #scale-msg is the message area below the pan and never carries
    // a refusal since 2026-09-21.
    const msg = document.getElementById("scale-refusal");
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

  /* Both tests below are the reviewer's, 2026-09-21. The first cut of the
     seed-refusal move shared ONE reserved row between #scale-parse and
     #scale-msg, the sheet's general message area - and #scale-msg has callers
     that write while the parse line is also full. Two of them are reproduced
     here. They do not go through the typing path, so neither
     "the sheet does not change height as the seed is typed" nor
     "the pan does not move when the seed goes bad" could see them: the row
     took two lines, the pan stepped 26.59px under the finger, and
     #scale-layout-row's bottom reached 785.69 against a 780px viewport.
     The fix is one element per role - #scale-refusal in the .fieldrow for
     seed refusals, #scale-msg below the pan for everything else - so what
     these assert is that a message which is NOT about the seed never enters
     the seed's row. */

  test("a pan warning on the Edit open does not move the pan", async () => {
    // Path (a): openEditSheet() says its warnings AFTER showSheet() has already
    // filled the parse line. "(C3) G3 D4 G4 D5" has three pitch classes, so the
    // engine warns NO_THIRDS on every open.
    try {
      await freshLoad();
      await b.setViewport(380, 780, true);
      await generate("(C3) G3 D4 G4 D5");
      await openEdit();
      const read = () => b.eval(`
        const row = document.getElementById("scale-layout-row").getBoundingClientRect();
        return {
          panTop: document.getElementById("scale-preview").getBoundingClientRect().top,
          rowBottom: row.bottom,
          viewportH: window.innerHeight,
          msg: document.getElementById("scale-msg").textContent.trim(),
          msgTop: document.getElementById("scale-msg").getBoundingClientRect().top,
          refusal: document.getElementById("scale-refusal").textContent.trim(),
          parse: document.getElementById("scale-parse").textContent.trim(),
        };
      `);
      await b.settle();
      const warned = await read();
      assert.ok(warned.msg.length > 0,
        "this deck is meant to warn on open - the fixture no longer warns");
      // The warning is not about the seed, so it must not be in the seed's row.
      assert.strictEqual(warned.refusal, "",
        `the pan warning was written to the seed refusal line: "${warned.refusal}"`);
      assert.ok(warned.parse.length > 0,
        "the parse line is empty on a valid prefilled seed");
      assert.ok(warned.msgTop >= warned.panTop,
        `the warning's top is ${warned.msgTop.toFixed(1)}px, above the pan at ` +
        `${warned.panTop.toFixed(1)}px - it is sharing the seed's row`);
      assert.ok(warned.rowBottom <= warned.viewportH,
        `#scale-layout-row's bottom is ${warned.rowBottom.toFixed(1)}px against a ` +
        `${warned.viewportH}px viewport - the LAYOUT row is below the fold`);

      // The next keystroke re-syncs the parse line. If the warning shared that
      // row, the row would shrink back to one line and step the pan.
      await typeScale("(C3) G3 D4 G4 D5 ");
      await b.settle();
      const typed = await read();
      assert.ok(Math.abs(typed.panTop - warned.panTop) < 0.5,
        `the pan moved ${(typed.panTop - warned.panTop).toFixed(1)}px on the first ` +
        `keystroke after a warned open (warned=${warned.panTop.toFixed(1)}, ` +
        `typed=${typed.panTop.toFixed(1)})`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("a refused SAVE onto another deck's scale does not move the pan", async () => {
    // Path (b): runGenerate() refuses a seed that PARSED FINE, so the parse
    // line is full when the refusal arrives - the one case where a refusal and
    // the parse summary are both live at once.
    try {
      await freshLoad();
      await b.setViewport(380, 780, true);
      await generate(EDIT_SCALE);
      await generate(COLLIDE_SCALE);
      const chips = await chipReport();
      await selectChipAt(chips.chips.length - 2);   // the FIRST custom deck
      await openEdit();

      const read = () => b.eval(`
        const row = document.getElementById("scale-layout-row").getBoundingClientRect();
        return {
          panTop: document.getElementById("scale-preview").getBoundingClientRect().top,
          rowBottom: row.bottom,
          viewportH: window.innerHeight,
          refusal: document.getElementById("scale-refusal").textContent.trim(),
          msg: document.getElementById("scale-msg").textContent.trim(),
        };
      `);
      // Baseline AFTER typing, so the only thing that changes across the SAVE
      // is the refusal itself.
      await typeScale(COLLIDE_SCALE);
      await b.settle();
      const before = await read();

      await b.click("#scale-generate");
      await b.settle();
      const after = await read();
      assert.match(after.refusal, /Another deck already uses this scale/,
        `the refused save says "${after.refusal}" in the seed's row`);
      assert.strictEqual(after.msg, "",
        `the seed refusal was written below the pan as well: "${after.msg}"`);
      assert.ok(Math.abs(after.panTop - before.panTop) < 0.5,
        `the pan moved ${(after.panTop - before.panTop).toFixed(1)}px on the refusal ` +
        `(before=${before.panTop.toFixed(1)}, after=${after.panTop.toFixed(1)})`);
      assert.ok(after.rowBottom <= after.viewportH,
        `#scale-layout-row's bottom is ${after.rowBottom.toFixed(1)}px against a ` +
        `${after.viewportH}px viewport - the refusal pushed LAYOUT below the fold`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  /** Tap a note on the pan the way a finger does: real pointer events at the
   *  circle's own centre. The pointerdown lands on the `.panhit`, and the
   *  `click` that follows it has to find that SAME node - which is the whole
   *  hazard when something repaints the pan between the two halves. */
  async function tapPanNote(name) {
    const at = await b.eval(`
      const want = ${JSON.stringify(name)};
      const h = [...document.querySelectorAll("#scale-preview .panhit")]
        .find(el => String(el.getAttribute("aria-label") || "").split(",")[0] === want);
      if (!h) throw new Error("no pan note " + want);
      const r = h.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    `);
    await clickPoint(at.x, at.y);
  }

  test("with DELETE armed, the first tap on a pan note still chooses it (queue row 91)", async () => {
    /* disarmDelete() runs on the pointerdown, and the pan is the thing under
       the finger. Repainting it there replaces #scale-preview's markup, so the
       .panhit the press landed on is detached before the click arrives; the
       click retargets to an ancestor, the delegated handler finds no hit and
       drops it, and the owner's first tap does nothing at all. */
    try {
      await editFreshDeck();
      const before = await panState();
      const target = before.notes.find(n => n !== before.selected);
      assert.ok(target, `the pan drew nothing to tap: ${JSON.stringify(before.notes)}`);

      await b.click("#scale-delete");
      assert.strictEqual(
        await b.eval(`return document.getElementById("scale-delete").hasAttribute("data-armed");`),
        true, "DELETE never armed");

      await tapPanNote(target);
      const after = await panState();
      assert.strictEqual(after.selected, target,
        `with DELETE armed, tapping ${target} selected ${after.selected} - the tap was ` +
        `swallowed by the disarm's repaint`);
      assert.strictEqual(
        await b.eval(`return document.getElementById("scale-delete").hasAttribute("data-armed");`),
        false, "the tap on the pan did not disarm DELETE");
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  test("clearing the seed box then tapping a pan note still chooses it while DELETE is armed (queue row 117)", async () => {
    /* Same hazard as row 91's pan-tap test, one branch over: syncParseState's
       EMPTY-seed branch has its own `if (paint) showPlaceholderPan();` guard
       at index.html:4578, load-bearing on its own. Clearing the box paints
       the placeholder pan once (paint: true, from the input event); disarming
       DELETE on the very next tap must NOT repaint it again, or the .panhit
       the finger landed on is replaced before the click arrives. */
    try {
      await editFreshDeck();
      await typeScale("");
      const before = await panState();
      const target = before.notes.find(n => n !== before.selected);
      assert.ok(target, `the placeholder pan drew nothing to tap: ${JSON.stringify(before.notes)}`);

      await b.click("#scale-delete");
      assert.strictEqual(
        await b.eval(`return document.getElementById("scale-delete").hasAttribute("data-armed");`),
        true, "DELETE never armed");

      await tapPanNote(target);
      const after = await panState();
      assert.strictEqual(after.selected, target,
        `with an empty seed and DELETE armed, tapping ${target} selected ${after.selected} - ` +
        "the tap was swallowed by the disarm's placeholder repaint");
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  test("disarming DELETE leaves a standing collision refusal up (queue row 91)", async () => {
    /* The collision veto is decided by the REGISTRY, not by the seed text, so
       updateParse() cannot re-derive it: re-running it on disarm clears the red
       box and the refusal for a seed the app will still refuse, and the sheet
       then presents SAVE CHANGES as if the edit were fine. */
    try {
      await freshLoad();
      await b.setViewport(380, 780, true);
      await generate(EDIT_SCALE);
      await generate(COLLIDE_SCALE);
      const before = await chipReport();

      await selectChipAt(before.chips.length - 2);
      await openEdit();
      await typeScale(COLLIDE_SCALE);
      await b.click("#scale-generate");

      const refused = await sheetState();
      assert.strictEqual(refused.bad, true, "the collision did not mark the box bad");
      assert.match(refused.msg, /Another deck already uses this scale/,
        `the sheet says "${refused.msg}"`);

      await b.click("#scale-delete");           // arm DELETE on the refused seed
      assert.strictEqual(
        await b.eval(`return document.getElementById("scale-delete").hasAttribute("data-armed");`),
        true, "DELETE never armed");
      await clickPoint(8, 8);                   // and look away again

      const after = await sheetState();
      assert.strictEqual(after.bad, true,
        "disarming DELETE cleared the collision's red box");
      assert.match(after.msg, /Another deck already uses this scale/,
        `after disarming DELETE the sheet says "${after.msg}"`);
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  test("an ordinary unarmed tap does not wipe a collision refusal (queue row 91 guard)", async () => {
    /* disarmDelete() runs on every pointerdown in the sheet, armed or not, and
       now re-syncs the sheet through updateParse() when it DOES run. Its
       early-return guard exists so an ordinary tap while DELETE is not armed
       never calls updateParse() at all - because updateParse() only sees the
       PARSE-level verdict, and a collision refusal is bad for a reason
       parseSeed knows nothing about: the seed itself still parses fine, so
       recomputing from it would wrongly clear .bad and the refusal message
       for an edit that was never fixed. */
    try {
      await freshLoad();
      await b.setViewport(380, 780, true);
      await generate(EDIT_SCALE);
      await generate(COLLIDE_SCALE);
      const before = await chipReport();

      // EDIT_SCALE's chip: generated before COLLIDE_SCALE, so second-to-last.
      await selectChipAt(before.chips.length - 2);
      await openEdit();
      await typeScale(COLLIDE_SCALE);
      await b.click("#scale-generate");

      const st1 = await sheetState();
      assert.strictEqual(st1.bad, true, "the scale box was not marked bad");
      assert.match(st1.msg, /Another deck already uses this scale/,
        `the sheet says "${st1.msg}"`);

      // an ordinary tap elsewhere in the sheet - DELETE was never armed
      await clickPoint(8, 8);

      const st2 = await sheetState();
      assert.strictEqual(st2.bad, st1.bad,
        "an ordinary tap while unarmed changed .bad on a collision refusal");
      assert.strictEqual(st2.msg, st1.msg,
        `an ordinary tap while unarmed changed the refusal message: "${st1.msg}" -> "${st2.msg}"`);
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  test("flipping the mirror does not wipe a collision refusal (queue row 115)", async () => {
    /* Mirror is a layout OPTION, not a field: it cannot change what a seed
       hashes to, so it cannot resolve a collision the registry vetoed.
       updateParse() clears `refusal` unconditionally though, and the mirror
       buttons called it directly - so flipping the mirror over a refused
       seed silently cleared the red box and re-offered SAVE CHANGES for an
       edit the app still refuses. */
    try {
      await freshLoad();
      await b.setViewport(380, 780, true);
      await generate(EDIT_SCALE);
      await generate(COLLIDE_SCALE);
      const before = await chipReport();

      await selectChipAt(before.chips.length - 2);
      await openEdit();
      await typeScale(COLLIDE_SCALE);
      await b.click("#scale-generate");

      const refused = await sheetState();
      assert.strictEqual(refused.bad, true, "the collision did not mark the box bad");
      assert.match(refused.msg, /Another deck already uses this scale/,
        `the sheet says "${refused.msg}"`);

      await b.eval(`document.getElementById("scale-mirror-l")
        .scrollIntoView({ block: "nearest", inline: "nearest" }); return true;`);
      await b.click("#scale-mirror-l");

      const after = await sheetState();
      assert.strictEqual(after.bad, true,
        "flipping the mirror cleared the collision's red box");
      assert.match(after.msg, /Another deck already uses this scale/,
        `after flipping the mirror the sheet says "${after.msg}"`);
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  test("tapping a pan note does not wipe a collision refusal (queue row 115)", async () => {
    /* previewLayout() re-derives the sheet on every layout tap so the mock
       pan stays in sync, but a layout tap changes `order`, never the fields
       a seed hashes to - it cannot fix a collision either, and calling
       updateParse() from it dropped the refusal the same way the mirror
       buttons did. */
    try {
      await freshLoad();
      await b.setViewport(380, 780, true);
      await generate(EDIT_SCALE);
      await generate(COLLIDE_SCALE);
      const before = await chipReport();

      await selectChipAt(before.chips.length - 2);
      await openEdit();
      await typeScale(COLLIDE_SCALE);
      await b.click("#scale-generate");

      const refused = await sheetState();
      assert.strictEqual(refused.bad, true, "the collision did not mark the box bad");
      assert.match(refused.msg, /Another deck already uses this scale/,
        `the sheet says "${refused.msg}"`);

      const pan = await panState();
      const target = pan.notes.find(n => n !== pan.selected);
      assert.ok(target, `the pan drew nothing to tap: ${JSON.stringify(pan.notes)}`);
      await tapPanNote(target);

      const after = await sheetState();
      assert.strictEqual(after.bad, true,
        "tapping a pan note cleared the collision's red box");
      assert.match(after.msg, /Another deck already uses this scale/,
        `after tapping a pan note the sheet says "${after.msg}"`);
    } finally {
      await b.key("Escape", "Escape", 27);
      await b.setViewport(900, 900, false);
    }
  });

  test("editing the seed after a collision clears the refusal cleanly (queue row 116)", async () => {
    /* Row 116's repro: the seed box is the ONE re-derive that can actually
       resolve a collision, so updateParse() keeping `refusal = null` is
       load-bearing there even though the other seven callers must not do
       the same thing. Arm-then-cancel DELETE afterward and the sheet must
       show nothing stale - a live SAVE CHANGES over a clean box and an
       empty message, never the old collision text. */
    try {
      await freshLoad();
      await b.setViewport(380, 780, true);
      await generate(EDIT_SCALE);
      await generate(COLLIDE_SCALE);
      const before = await chipReport();

      await selectChipAt(before.chips.length - 2);
      await openEdit();
      await typeScale(COLLIDE_SCALE);
      await b.click("#scale-generate");

      const refused = await sheetState();
      assert.strictEqual(refused.bad, true, "the collision did not mark the box bad");
      assert.match(refused.msg, /Another deck already uses this scale/,
        `the sheet says "${refused.msg}"`);

      await typeScale(SIX_SCALES[4]);   // a free scale: the collision is over

      await b.click("#scale-delete");   // arm DELETE on the now-clean seed
      assert.strictEqual(
        await b.eval(`return document.getElementById("scale-delete").hasAttribute("data-armed");`),
        true, "DELETE never armed");
      await clickPoint(8, 8);           // and cancel it

      const after = await sheetState();
      assert.strictEqual(after.bad, false,
        "the box is still marked bad after the collision was fixed");
      assert.strictEqual(after.msg, "",
        `the sheet still says "${after.msg}" after the collision was fixed`);
      assert.strictEqual(after.primaries, 1,
        "SAVE CHANGES is not live after the collision was fixed");
    } finally {
      await b.key("Escape", "Escape", 27);
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
   * the primary action never falls below the fold (queue rows 211, 212)
   *
   * .sheetsurf is a scrolling surface that fills the viewport (100dvh since
   * the page replaced the drawer). Whenever the content is taller than the
   * viewport, whatever sits at the BOTTOM of the flow - which is the page's
   * only primary, #scale-generate (GENERATE CARDS on the create path, SAVE
   * CHANGES on the Edit path) - starts below the fold, and
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
  // in landscape, where the viewport height is at its most brutal.
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
      slots: document.querySelectorAll("#scale-preview .panhit").length,
      // The preset row used to sit directly above the box and was the tallest
      // single thing between the top of the sheet and this button (owner,
      // 2026-09: "I don't know if we need the preset options" - they went).
      // Checked in the LIVE sheet, at every fold viewport, so "removed" cannot
      // quietly become "display:none".
      presets: document.querySelectorAll("#scale-presets, #scale-presets-row, .preset").length,
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
    assert.strictEqual(m.presets, 0,
      `${where}: ${m.presets} preset element(s) are still in the open sheet`);
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
          `the worst case regressed: the pan draws only ${m.slots} hit targets`);
        assertPrimaryVisible(m, `Edit sheet (${m.slots} notes) at ${w}x${h}`);
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

  // The owner's own bug, in one measurement: "The keyboard pushes up the input
  // field past the viewport so I can't edit." Both ends of the page have to
  // survive it - the box being edited AND the button that commits the edit -
  // so this measures the pair, on the ADD page and on the EDIT page, with the
  // box focused the way a finger focuses it. Same PROXY caveat as the test
  // above: a shrunken innerHeight is the friendly case, not the honest one.
  const boxAndPrimary = () => b.eval(`
    const box = document.getElementById("scale-box").getBoundingClientRect();
    const gen = document.getElementById("scale-generate");
    const g = gen.getBoundingClientRect();
    return {
      label: (gen.textContent || "").trim(),
      focused: document.activeElement && document.activeElement.id,
      box: { top: box.top, bottom: box.bottom },
      gen: { top: g.top, bottom: g.bottom },
      vh: window.innerHeight,
    };
  `);

  function assertBothOnScreen(m, where) {
    assert.strictEqual(m.focused, "scale-box",
      `${where}: the box is not focused, so no keyboard would be up`);
    assert.ok(m.box.top >= -0.5 && m.box.bottom <= m.vh + 0.5,
      `${where}: the scale box is outside the ${m.vh}px viewport ` +
      `(top ${m.box.top.toFixed(1)}, bottom ${m.box.bottom.toFixed(1)})`);
    assert.ok(m.gen.top >= -0.5 && m.gen.bottom <= m.vh + 0.5,
      `${where}: "${m.label}" is outside the ${m.vh}px viewport ` +
      `(top ${m.gen.top.toFixed(1)}, bottom ${m.gen.bottom.toFixed(1)})`);
  }

  test("with the box focused and the viewport shrunk, both the box and the primary stay on screen", async () => {
    try {
      await freshLoad();
      await b.setViewport(380, 800, true);
      await generate(EDIT_SCALE);

      // EDIT first, while the generated deck is the selected chip.
      await openEdit();
      await b.click("#scale-box");
      await b.setViewport(380, 508, true);
      assertBothOnScreen(await boxAndPrimary(), "the Edit page at 380x508");
      await b.key("Escape", "Escape", 27);
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the Edit page to close" });

      // Then ADD, at the same shrunken viewport.
      await b.setViewport(380, 800, true);
      await openSheet();
      await typeScale(BIG_SCALE);
      await b.waitFor(`!document.getElementById("scale-preview").hasAttribute("hidden")`,
        { label: "the preview to render" });
      await b.click("#scale-box");
      await b.setViewport(380, 508, true);
      assertBothOnScreen(await boxAndPrimary(), "the Add page at 380x508");
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  /* The owner's SECOND device report, 2026-09-17, on the live site at
   * handpan.raywu.org: the keyboard pushes the bottom drawer up over the seed
   * field, and only the top half of what they typed is readable. The test
   * above passes and the phone disagrees, for two reasons this test fixes.
   *
   * 1. IT MEASURED THE WRONG BOX. assertBothOnScreen asserts the seed box is
   *    inside the VIEWPORT. On the device the box IS inside the viewport - it
   *    is clipped by .sheetbody, its own scroll container, whose height the
   *    pinned footer has eaten. A rect inside the viewport says nothing about
   *    whether a scroller shows it: the same defect queue row 78 closed for
   *    the LAYOUT hint.
   * 2. IT SHRANK THE WRONG NUMBER. setViewport shrinks innerHeight AND
   *    visualViewport.height together. A real iOS keyboard shrinks only
   *    visualViewport.height and leaves innerHeight alone - which is the whole
   *    reason kbCap() reads both - so the proxy never exercises the case the
   *    code exists to handle. The comment above already called it "the
   *    friendly case, not the honest one"; this is the honest one. */
  /* Lives in tests/helpers/cdp.js now, so the pinch-zoom lever (setPageScale)
   * and the teardown (clearKeyboard) sit beside it and every test in the repo
   * shares ONE keyboard stub. */

  /* How much of the seed box a thumb can actually read: its own rect clipped
   * by .sheetbody's scrollport and then by the VISUAL viewport, AFTER scrolling the
   * box into view the way a reader would. Scrolling first is what makes this
   * about visibility rather than about a scroll position - but it is no
   * rescue: a scrollport shorter than the box cannot show all of it at any
   * offset, which is exactly the owner's screenshot. */
  const seedBoxVisibility = () => b.eval(`
    const box = document.getElementById("scale-box");
    const body = document.querySelector(".sheetbody");
    box.scrollIntoView({ block: "center" });
    const r = box.getBoundingClientRect();
    const s = body.getBoundingClientRect();
    /* The bottom bound is the VISUAL viewport, not innerHeight. Under a real
     * keyboard innerHeight does not shrink - that is the whole premise of this
     * test - so clipping at it lets the box sit behind the keyboard and still
     * score as fully visible. tests/mutants/e_kb_sheet_never_translates.patch
     * drops applyKbOffset's translateY and survives an innerHeight bound; it
     * dies on this one. */
    const vv = window.visualViewport;
    const kbTop = vv.offsetTop + vv.height;
    const top = Math.max(r.top, s.top, vv.offsetTop);
    const bottom = Math.min(r.bottom, s.bottom, kbTop);
    return {
      h: r.height, visible: Math.max(0, bottom - top),
      portH: s.height, focused: document.activeElement && document.activeElement.id,
      innerHeight: window.innerHeight, vvHeight: vv.height, kbTop,
      boxTop: r.top, boxBottom: r.bottom,
    };
  `);

  function assertSeedBoxReadable(m, where) {
    assert.strictEqual(m.focused, "scale-box",
      `${where}: the box is not focused, so no keyboard would be up`);
    assert.ok(m.innerHeight > m.vvHeight,
      `${where}: innerHeight ${m.innerHeight} did not stay above the shrunken `
      + `visual viewport ${m.vvHeight} - this is the friendly proxy again, not a keyboard`);
    assert.ok(m.visible >= m.h - 0.5,
      `${where}: only ${m.visible.toFixed(1)}px of the ${m.h.toFixed(1)}px seed box `
      + `survives the sheet's own scroller (${m.portH.toFixed(1)}px tall) and the `
      + `keyboard line at ${m.kbTop.toFixed(1)}px (box ${m.boxTop.toFixed(1)}-`
      + `${m.boxBottom.toFixed(1)}) - the owner cannot read what they are typing`);
  }

  /* The owner's device: iPhone 14 / iOS 26.6, 390 CSS px wide, ~745 px of
   * layout viewport under Safari's chrome. The sweep is the range of iOS
   * portrait keyboards over that layout: 336 px is the plain QWERTY plus the
   * form accessory bar, 395 px is the tallest (a candidate bar above it, as
   * the CJK keyboards draw). Every point in that range is a keyboard the
   * owner can raise, so the seed box has to survive all of them, not just the
   * friendliest. vvHeight = 745 - keyboard. */
  const KEYBOARDS = [336, 365, 395];

  test("with a real keyboard up, the seed box is not clipped by the sheet's own scroller", async () => {
    try {
      await freshLoad();
      await b.setViewport(390, 745, true);
      await generate(EDIT_SCALE);

      // EDIT first: it carries the most pinned footer, so it fails first.
      await openEdit();
      await b.click("#scale-box");
      for (const kb of KEYBOARDS) {
        await b.fakeKeyboard(745 - kb);
        assertSeedBoxReadable(await seedBoxVisibility(),
          `the Edit page with a ${kb}px keyboard`);
      }
      await b.clearKeyboard();
      await b.key("Escape", "Escape", 27);
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the Edit page to close" });

      // Then ADD, the page in the owner's screenshot.
      await openSheet();
      await typeScale(BIG_SCALE);
      await b.waitFor(`!document.getElementById("scale-preview").hasAttribute("hidden")`,
        { label: "the preview to render" });
      await b.click("#scale-box");
      for (const kb of KEYBOARDS) {
        await b.fakeKeyboard(745 - kb);
        assertSeedBoxReadable(await seedBoxVisibility(),
          `the Add page with a ${kb}px keyboard`);
      }
    } finally {
      await b.clearKeyboard();
      await b.setViewport(900, 900, false);
    }
  });

  /* Reads what applyKbOffset actually wrote onto the sheet surface, plus the
   * two viewport numbers it computed them from. Returning the inputs beside
   * the outputs is what lets the assertions DERIVE their expectations instead
   * of hard-coding pixels: this file shares one browser session, and a
   * neighbouring test that leaves a different viewport set would otherwise
   * turn a real regression into a confusing pixel mismatch. */
  const surfaceState = () => b.eval(`
    const surf = document.getElementById("scale-sheet").firstElementChild;
    const vv = window.visualViewport;
    return {
      transform: surf.style.transform, maxHeight: surf.style.maxHeight,
      innerHeight: window.innerHeight,
      vvHeight: vv.height, vvOffsetTop: vv.offsetTop, vvScale: vv.scale,
    };
  `);

  /* The wiring row 54 called invisible to CI. It is not: a shrunken visual
   * viewport driven through a real resize event runs applyKbOffset end to end
   * against the shipped file, so the listener, the two pure functions and both
   * style writes are all under test. What stays unverifiable is only the
   * PREMISE - that a real iOS keyboard shrinks visualViewport.height - which
   * is an owner-device claim (queue rows 51, 67) and always will be. */
  test("the sheet answers a shrunken visual viewport by lifting and capping the surface", async () => {
    try {
      await freshLoad();
      await b.setViewport(390, 844, true);
      await openSheet();
      await b.fakeKeyboard(400);

      const m = await surfaceState();
      const off = Math.max(0, m.innerHeight - m.vvHeight - m.vvOffsetTop);
      const cap = Math.max(0, Math.round(m.vvHeight - 8));
      assert.ok(off > 0,
        `the fake keyboard did not shrink anything: innerHeight ${m.innerHeight} `
        + `vs vv.height ${m.vvHeight}`);
      assert.strictEqual(m.transform, `translateY(-${off}px)`,
        `the surface did not lift clear of the keyboard line`);
      assert.strictEqual(m.maxHeight, `${cap}px`,
        `the surface was not capped to what is left of the visual viewport`);

      // And the teardown is part of the contract, not an afterthought: a
      // leaked shadowed property would follow this session into every test
      // below it.
      await b.clearKeyboard();
      const back = await surfaceState();
      assert.strictEqual(back.vvHeight, back.innerHeight,
        "clearKeyboard did not restore the visual viewport");
      assert.strictEqual(back.transform, "", "the lift outlived the keyboard");
      assert.strictEqual(back.maxHeight, "", "the cap outlived the keyboard");
    } finally {
      await b.clearKeyboard();
      await b.setViewport(900, 900, false);
    }
  });

  /* Queue row 54, the surviving mutant. Deleting the applyKbOffset() call from
   * showSheet() used to pass the whole suite, because every keyboard test
   * shrinks the viewport AFTER opening the sheet and the resize listener then
   * does the work the direct call was supposed to do. The state the direct
   * call exists for is the other order: the keyboard is already up when the
   * sheet opens, which is what happens when the owner taps + ADD with the
   * board raised by whatever they were doing before. No event fires at open
   * time, so showSheet() is the only thing that can measure.
   *
   * Since applyKbOffset() is now gated on sheetOpen, faking the keyboard
   * BEFORE the open is genuinely inert - the listener fires and returns - so
   * anything this test sees on the surface came from showSheet() itself. */
  test("a sheet opened with the keyboard already up lifts on the first frame", async () => {
    try {
      await freshLoad();
      await b.setViewport(390, 844, true);

      await b.fakeKeyboard(400);
      const closed = await surfaceState();
      assert.strictEqual(closed.transform, "",
        "a closed sheet answered the keyboard; the sheetOpen gate is not holding");

      /* Clicked and measured inside ONE evaluation, with no turn of the event
       * loop in between. That is the whole point: a visualViewport event does
       * arrive shortly after the open (the sheet changes the layout enough to
       * produce one) and would hide the missing call, so anything asserted
       * after an await proves nothing about showSheet(). */
      const open = await b.eval(`
        document.getElementById("deck-add").click();
        const surf = document.getElementById("scale-sheet").firstElementChild;
        const vv = window.visualViewport;
        return {
          transform: surf.style.transform, maxHeight: surf.style.maxHeight,
          innerHeight: window.innerHeight,
          vvHeight: vv.height, vvOffsetTop: vv.offsetTop, vvScale: vv.scale,
        };
      `);
      const off = Math.max(0, open.innerHeight - open.vvHeight - open.vvOffsetTop);
      assert.ok(off > 0, `the fake keyboard did not shrink anything: ${JSON.stringify(open)}`);
      assert.strictEqual(open.transform, `translateY(-${off}px)`,
        "the sheet opened under a keyboard that was already up and did not lift");
      assert.strictEqual(open.maxHeight, `${Math.max(0, Math.round(open.vvHeight - 8))}px`,
        "the sheet opened under a keyboard that was already up and was not capped");
    } finally {
      await b.clearKeyboard();
      await b.setViewport(900, 900, false);
    }
  });

  /* Queue row 88. hideSheet() cleared the translate and left the cap behind,
   * so a sheet closed while the keyboard was still up kept maxHeight pinned to
   * whatever was left of the visual viewport. Nothing renders in that window -
   * the sheet is hidden, and the next showSheet() runs applyKbOffset() before
   * a frame goes out - so this is not a visible bug today. It is a latent one:
   * the cap is the only style the teardown does not undo, and every future
   * caller of hideSheet() inherits that asymmetry. Measured here rather than
   * argued: the assertion reads the style off the hidden surface with no
   * resize in between, which is exactly the state hideSheet() leaves. */
  test("closing the sheet with the keyboard up leaves no cap behind", async () => {
    try {
      await freshLoad();
      await b.setViewport(390, 844, true);
      await openSheet();
      await b.fakeKeyboard(400);

      const up = await surfaceState();
      assert.notStrictEqual(up.maxHeight, "",
        "precondition: the fake keyboard did not cap the surface");

      await b.key("Escape");
      await b.settle();
      const closed = await b.eval(`
        const sheet = document.getElementById("scale-sheet");
        const surf = sheet.firstElementChild;
        return { hidden: sheet.hasAttribute("hidden"),
                 transform: surf.style.transform, maxHeight: surf.style.maxHeight };
      `);
      assert.strictEqual(closed.hidden, true, "Escape did not close the sheet");
      assert.strictEqual(closed.transform, "", "the lift outlived the sheet");
      assert.strictEqual(closed.maxHeight, "", "the cap outlived the sheet");
    } finally {
      await b.clearKeyboard();
      await b.setViewport(900, 900, false);
    }
  });

  /* Queue row 87. A pinch-zoom shrinks visualViewport.height exactly the way a
   * keyboard does, so before this fix the sheet lifted and capped itself for a
   * reader who was only zooming in to read the seed - measured at 390x844,
   * scale 2: translateY(-422px) and maxHeight 414px, with no keyboard anywhere.
   *
   * The discriminator IS a `vv.scale > 1.01` branch, and this comment used to
   * say the opposite. The first version of the fix was arithmetic
   * (vv.height * vv.scale, and the same on vv.offsetTop), on the argument that
   * a branch would disable the keyboard fix whenever iOS auto-zoom raises the
   * scale. Both halves of that were wrong. offsetTop is already in layout px,
   * so the lift decayed to zero as the reader panned while the cap went on
   * insisting a keyboard was there; and iOS auto-zoom never fires here,
   * because #scale-box and its siblings pin 16px. See the test below and
   * index.html's applyKbOffset() for what the page actually does under zoom.
   *
   * The oracle is positive THEN negative on purpose. A test that only asserts
   * both writes are empty is satisfied by `applyKbOffset() { return; }`, which
   * is one of the mutants this lane exists to kill. */
  test("a pinch-zoom leaves the sheet alone, but a real shrink still lifts it", async () => {
    try {
      await freshLoad();
      await b.setViewport(390, 844, true);
      await openSheet();

      // Positive half: the lift still happens when it should.
      await b.fakeKeyboard(400);
      const lifted = await surfaceState();
      assert.ok(lifted.transform.startsWith("translateY(-"),
        `a shrunken visual viewport did not lift the surface (transform `
        + `${JSON.stringify(lifted.transform)})`);
      assert.ok(lifted.maxHeight !== "",
        "a shrunken visual viewport did not cap the surface");
      await b.clearKeyboard();

      // Negative half: the same shrink, produced by zooming, must not.
      await b.setPageScale(2);
      await b.settle();
      const zoomed = await surfaceState();
      assert.ok(zoomed.vvScale > 1,
        `setPageScale did not actually zoom: scale ${zoomed.vvScale}`);
      assert.ok(zoomed.vvHeight < zoomed.innerHeight,
        `the zoom did not shrink the visual viewport, so this test proves `
        + `nothing: vv.height ${zoomed.vvHeight} vs innerHeight ${zoomed.innerHeight}`);
      assert.strictEqual(zoomed.transform, "",
        `pinch-zooming lifted the sheet as if a keyboard had opened`);
      assert.strictEqual(zoomed.maxHeight, "",
        `pinch-zooming capped the sheet as if a keyboard had opened`);
    } finally {
      await b.setPageScale(1);
      await b.clearKeyboard();
      await b.setViewport(900, 900, false);
    }
  });

  /* The zoomed-WITH-a-keyboard state, which the first version of the row 87
   * fix got wrong in two directions at once. It scaled `vv.offsetTop` as well
   * as `vv.height`, but offsetTop is already in layout px - it saturates at
   * innerHeight - vv.height - so the lift decayed as the reader panned and hit
   * zero partway down, while the cap (which never sees offsetTop) went on
   * saying a keyboard was there. One state, two halves of one fix, opposite
   * answers.
   *
   * There is no arithmetic that makes both halves right here: a sheet laid out
   * at 100dvh is TALLER than the screen the moment the page is zoomed, so
   * "keep the whole surface above the keyboard" and "leave the zoom alone" are
   * not simultaneously satisfiable. So the page makes no claim at all while
   * the scale is up: both writes are cleared together, and panning is the
   * reader's. That is safe here only because this page pins 16px on the seed
   * input, so iOS never raises the scale by itself - every zoom is two
   * deliberate fingers, and the reader who made it can pan.
   *
   * Swept across offsetTop because the defect was invisible at 0, which is the
   * only value a test that never pans ever sees. */
  test("a zoom with the keyboard up is left alone at every pan position", async () => {
    try {
      await freshLoad();
      await b.setViewport(390, 844, true);
      await openSheet();
      await b.setPageScale(2);

      // 390x844 at scale 2 shows 422 layout px; a 336px keyboard takes 168 of
      // them. offsetTop is a LAYOUT-px pan offset, legal up to 844 - 222.
      for (const ot of [0, 150, 300, 600]) {
        await b.fakeKeyboard(222, ot);
        const m = await surfaceState();
        assert.ok(m.vvScale > 1,
          `setPageScale did not zoom, so this proves nothing: scale ${m.vvScale}`);
        assert.strictEqual(m.transform, "",
          `at offsetTop ${ot} the zoomed sheet was lifted as if the keyboard `
          + `were the only thing shrinking the viewport`);
        assert.strictEqual(m.maxHeight, "",
          `at offsetTop ${ot} the zoomed sheet was capped while the lift said `
          + `there was no keyboard - the two halves of one fix disagreed`);
      }

      // Negative control: the SAME shrink unzoomed is a keyboard, and both
      // halves answer it. Without this the test above is satisfied by
      // `applyKbOffset() { return; }`.
      await b.setPageScale(1);
      await b.fakeKeyboard(444, 0);
      const flat = await surfaceState();
      assert.strictEqual(flat.transform, `translateY(-${flat.innerHeight - 444}px)`,
        "the same viewport unzoomed did not lift the sheet");
      assert.strictEqual(flat.maxHeight, `${444 - 8}px`,
        "the same viewport unzoomed did not cap the sheet");
    } finally {
      await b.setPageScale(1);
      await b.clearKeyboard();
      await b.setViewport(900, 900, false);
    }
  });

  /* The footer's hairline. It used to hang off `.sheetsurf > .ctlrow`, a
   * DIRECT-CHILD selector: when the mirror/palette row moved into .sheetbody
   * the rule stopped matching anything at all and the divider vanished with
   * it, silently, because no test read it - line 510 was the only border-top
   * in the file. The rule now belongs to the scrollport's own bottom edge,
   * which is the boundary it was always describing, so it cannot be undone by
   * moving a child across it again. */
  test("a hairline divides the pinned footer from the scroll, so the footer reads as fixed", async () => {
    try {
      await freshLoad();
      await b.setViewport(390, 745, true);
      await openSheet();
      const m = await b.eval(`
        const body = document.querySelector(".sheetbody");
        const cs = getComputedStyle(body);
        return {
          next: body.nextElementSibling && body.nextElementSibling.id,
          style: cs.borderBottomStyle,
          w: cs.borderBottomStyle === "none" ? 0 : parseFloat(cs.borderBottomWidth),
          color: cs.borderBottomColor,
          bg: getComputedStyle(document.querySelector(".sheetsurf")).backgroundColor,
        };
      `);
      assert.strictEqual(m.next, "scale-generate",
        "the primary is no longer the first thing below the scrollport, so this "
        + "test is measuring the wrong boundary");
      assert.ok(m.w >= 1,
        `the scrollport's bottom edge draws no rule (${m.style} ${m.w}px), so nothing `
        + "says the footer below it does not scroll");
      assert.notStrictEqual(m.color, "rgba(0, 0, 0, 0)",
        "the rule is transparent, which is the same as not drawing it");
      assert.notStrictEqual(m.color, m.bg,
        `the rule is drawn in the sheet's own background ${m.bg}, so it is invisible`);
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
   * drawer polish (owner, 2026-09-11)
   *
   * Four requests, and all four are geometry a browser has to measure:
   * the focus ring's paint rect against a scrollport, a gap between two
   * boxes, the sheet's height across parse states, and a width that is a
   * function of the viewport. None of it is visible to the DOM-stubbed
   * unit suite, which is why it lives here.
   * ---------------------------------------------------------------- */

  // The ring's own paint rectangle: the border box grown by outline-offset
  // plus outline-width, which is where the browser actually puts it.
  const ringVsScrollport = () => b.eval(`
    const box = document.getElementById("scale-box");
    const body = document.querySelector(".sheetbody");
    const cs = getComputedStyle(box);
    const grow = parseFloat(cs.outlineOffset) + parseFloat(cs.outlineWidth);
    const r = box.getBoundingClientRect();
    const s = body.getBoundingClientRect();
    const bs = getComputedStyle(body);
    // The scrollPORT is the padding box, and only the padding box: overflow
    // is clipped at it, so the body's own inline padding is the room a ring
    // has to paint in. Borders are outside it; margins are outside that.
    const port = {
      left: s.left + parseFloat(bs.borderLeftWidth),
      right: s.right - parseFloat(bs.borderRightWidth),
    };
    return {
      focusVisible: box.matches(":focus-visible"),
      outlineStyle: cs.outlineStyle,
      ringLeft: r.left - grow, ringRight: r.right + grow,
      portLeft: port.left, portRight: port.right,
      overflowX: bs.overflowX,
      // A clipped ring with no scrollbar is invisible with no way to reach it.
      scrollable: body.scrollWidth > body.clientWidth,
    };
  `);

  test("the focus ring on the seed box is not clipped by the sheet body", async () => {
    // Confirmed on 2026-09-11 not to be a headless artifact: a text input
    // matches :focus-visible on a real pointer click too, so this is what the
    // owner sees on iOS after tapping the box, not only what a script sees.
    try {
      await freshLoad();
      await b.setViewport(380, 800, true);
      await openSheet();
      await b.click("#scale-box");
      await b.settle();

      const m = await ringVsScrollport();
      assert.ok(m.focusVisible && m.outlineStyle !== "none",
        "the box is not showing a focus ring - this test is measuring nothing");
      assert.ok(m.ringLeft >= m.portLeft - 0.5,
        `the focus ring is clipped on the left (ring ${m.ringLeft.toFixed(1)} ` +
        `vs scrollport ${m.portLeft.toFixed(1)}), and overflow-x is ` +
        `"${m.overflowX}" with scrollable=${m.scrollable}, so nothing can reach it`);
      assert.ok(m.ringRight <= m.portRight + 0.5,
        `the focus ring is clipped on the right (ring ${m.ringRight.toFixed(1)} ` +
        `vs scrollport ${m.portRight.toFixed(1)})`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("the parse line sits a step further from the box than its own label", async () => {
    try {
      await freshLoad();
      await b.setViewport(380, 800, true);
      await openSheet();
      const m = await b.eval(`
        const label = document.querySelector('label[for="scale-box"]');
        const box = document.getElementById("scale-box");
        const parse = document.getElementById("scale-parse");
        const g = (a, bEl) => bEl.getBoundingClientRect().top - a.getBoundingClientRect().bottom;
        const ramp = n => parseFloat(getComputedStyle(document.documentElement)
          .getPropertyValue("--sp-" + n));
        return { labelToBox: g(label, box), boxToParse: g(box, parse),
                 sp1: ramp(1), sp2: ramp(2) };
      `);
      // The label BELONGS to the box; the parse line COMMENTS on it. Two
      // relationships, two steps of the ramp - asserted as ramp steps so the
      // desktop and landscape rungs scale with it.
      assert.ok(Math.abs(m.labelToBox - m.sp1) < 0.5,
        `label-to-box is ${m.labelToBox.toFixed(1)}px, expected --sp-1 (${m.sp1})`);
      assert.ok(Math.abs(m.boxToParse - m.sp2) < 0.5,
        `box-to-parse is ${m.boxToParse.toFixed(1)}px, expected --sp-2 (${m.sp2})`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("the sheet does not change height as the seed is typed", async () => {
    // Owner request 3, read literally: "the drawer doesn't need to resize
    // based on the input". Three sources fed it - the preview leaving the
    // flow, the parse/message row collapsing to zero on an invalid parse, and
    // text wrapping - and a test covering only the preview would pass on two
    // of them still live. So this measures the SHEET, across the states a
    // keystroke moves between.
    //
    // The one step that is NOT covered here is empty -> first valid parse:
    // PARSE_HINT is three wrapped lines at 380px and the note list is one, a
    // 37px difference measured on 2026-09-11. Reserving it would cost every
    // phone 37px of sheet permanently to hold still at a moment BEFORE the
    // user has typed anything, so it is spent on the typing path instead.
    // The next test pins what the step is MADE of - nothing but the parse
    // line contributes to it - not its magnitude, which moves with how
    // PARSE_HINT happens to wrap.
    try {
      await freshLoad();
      await b.setViewport(380, 800, true);
      await openSheet();
      const h = async (label) => {
        await b.settle();
        return { label, ...(await b.eval(`
          const surf = document.querySelector(".sheetsurf");
          return { h: surf.getBoundingClientRect().height,
                   preview: !document.getElementById("scale-preview").hasAttribute("hidden"),
                   // Since 2026-09-21 the parse line and the refusal line take
                   // turns in ONE reserved row (whichever is empty leaves the
                   // flow), so the invariant is the ROW, not either element.
                   // Exactly one is ever filled, because showParse() and
                   // showRefusal() are the row's only writers and each blanks
                   // the other - it is not a coincidence of call order.
                   row: document.getElementById("scale-parse").getBoundingClientRect().height
                      + document.getElementById("scale-refusal").getBoundingClientRect().height };
        `)) };
      };
      const states = [];
      await typeScale("(D) A C D E F G A C");
      states.push(await h("valid"));
      await typeScale("(D) A C D zzzz");
      states.push(await h("invalid"));
      await typeScale("(D) A C D E F G A C");
      states.push(await h("valid again"));
      // A seed long enough that its failure reason is a different length from
      // the short one above: the refusal line wraps too, and it is in the sheet.
      await typeScale("(D) A C D E F G A C | Q# Q# Q# Q# Q# Q# Q#");
      states.push(await h("invalid, long reason"));

      for (const s of states) {
        assert.ok(s.preview,
          `${s.label}: the pan left the flow - the page resizes on input`);
        assert.ok(s.row > 0,
          `${s.label}: the parse/message row collapsed to zero height`);
      }
      const base = states[0].h;
      for (const s of states) {
        assert.ok(Math.abs(s.h - base) < 0.5,
          `the sheet is ${s.h.toFixed(1)}px in "${s.label}" but ` +
          `${base.toFixed(1)}px valid: ` +
          states.map(x => `${x.label}=${x.h.toFixed(1)}`).join(", "));
      }
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("the seed refusal sits above the pan", async () => {
    // Owner feedback, 2026-09-21: "Error message such as 'No ding. Start with
    // the ding note, e.g. (D) or D/.' Should be directly under the scale field
    // otherwise it's hidden below the fold". Geometric, not DOM-order: this
    // fails on a reordering, on the preview being moved above the message, and
    // on absolute positioning that reinstates the old stacking.
    try {
      await freshLoad();
      await b.setViewport(380, 800, true);
      await openSheet();
      await typeScale("(D) A C D zzzz");
      await b.settle();
      const r = await b.eval(`
        const msg = document.getElementById("scale-refusal").getBoundingClientRect();
        const box = document.getElementById("scale-box").getBoundingClientRect();
        const prev = document.getElementById("scale-preview").getBoundingClientRect();
        return { msgTop: msg.top, msgBottom: msg.bottom, boxBottom: box.bottom,
                 prevTop: prev.top,
                 text: document.getElementById("scale-refusal").textContent.trim() };
      `);
      assert.ok(r.text.length > 0, "no refusal was rendered for an invalid seed");
      assert.ok(r.msgBottom <= r.prevTop + 0.5,
        `the refusal's bottom is ${r.msgBottom.toFixed(1)}px but the pan's top ` +
        `is ${r.prevTop.toFixed(1)}px - the refusal is below the pan`);
      assert.ok(r.msgTop >= r.boxBottom - 0.5,
        `the refusal's top is ${r.msgTop.toFixed(1)}px, above the scale field's ` +
        `bottom at ${r.boxBottom.toFixed(1)}px`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("the pan does not move when the seed goes bad", async () => {
    // #scale-refusal sits between the field and the pan, so its height is in
    // the pan's path. What holds the row still across the valid -> invalid
    // step is that #scale-parse EMPTIES as the refusal fills: showRefusal()
    // blanks the parse line, :empty takes it out of the flow, and the refusal
    // stands in the identical box. Stop writing the refusal, or stop blanking
    // the parse line, and the row changes height under the user's finger.
    // Not a CSS floor: both elements' min-height is unreachable behind
    // :empty{display:none}, which is why e_refusal_row_collapses mutates the
    // CONTENT rather than the declaration.
    // The 18px step is exactly one line, so the exemption below is deliberate:
    // a refusal that WRAPS to two lines does still move the pan. Reserving the
    // second line fixes that and costs 22px the Edit sheet does not have -
    // measured 2026-09-21 at 380x780, its slack is 20.9px, breaking
    // "ROTATE makes its correction from the keyboard alone at 380px". Wrapping
    // needs a bad token near core.js:125's 12-character slice; every reason at
    // a short token renders in one line. See index.html's :empty comment.
    try {
      await freshLoad();
      await b.setViewport(380, 800, true);
      await openSheet();
      const top = async () => {
        await b.settle();
        return b.eval(`
          return document.getElementById("scale-preview").getBoundingClientRect().top;
        `);
      };
      // No EMPTY-vs-typed comparison here: the first keystroke legitimately
      // changes PARSE_HINT's own wrap (see "the only height the first
      // keystroke changes is the hint's own wrap"), which is a different
      // element and a different 37px. VALID is the right baseline - its
      // #scale-refusal is EMPTY and #scale-parse holds the reserved line.
      await typeScale("(D) A C D E F G A C");
      const valid = await top();
      await typeScale("(D) A C D zzzz");
      const bad = await top();
      const msg = await b.eval(`
        const m = document.getElementById("scale-refusal");
        return { h: m.getBoundingClientRect().height, t: m.textContent.trim() };
      `);
      assert.ok(msg.t.length > 0, "no refusal was rendered for an invalid seed");
      // Guards the premise: a refusal that silently grew to two lines would
      // make the assertions below fail for a reason this test does not mean.
      assert.ok(msg.h < 27, `the refusal wrapped (${msg.h}px) - pick a shorter token`);
      assert.ok(Math.abs(bad - valid) < 0.5,
        `the pan moved ${(bad - valid).toFixed(1)}px when the seed went bad ` +
        `(valid=${valid.toFixed(1)}, bad=${bad.toFixed(1)})`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("the only height the first keystroke changes is the hint's own wrap", async () => {
    // The accepted step from the test above, pinned. As a drawer the surface
    // grew with its content and the allowance was the parse line's own wrap;
    // as a page it is the viewport's height, so the surface must not move AT
    // ALL and the wrap has to be absorbed inside the scrolling body. Both
    // halves are checked: a page that stays put while something else inside it
    // silently grows would pass the first assertion on its own.
    try {
      await freshLoad();
      await b.setViewport(380, 800, true);
      await openSheet();
      const m = () => b.eval(`
        return { h: document.querySelector(".sheetsurf").getBoundingClientRect().height,
                 body: document.querySelector(".sheetbody").scrollHeight,
                 parse: document.getElementById("scale-parse").getBoundingClientRect().height };
      `);
      await b.settle();
      const empty = await m();
      await typeScale("(D) A C D E F G A C");
      await b.settle();
      const typed = await m();

      assert.ok(Math.abs(empty.h - typed.h) < 0.5,
        `the page surface resized by ${(empty.h - typed.h).toFixed(1)}px on the ` +
        "first keystroke - it is the viewport's height and must not move");
      const bodyDelta = empty.body - typed.body;
      const parseDelta = empty.parse - typed.parse;
      assert.ok(Math.abs(bodyDelta - parseDelta) < 0.5,
        `the scrolling body moved ${bodyDelta.toFixed(1)}px between empty and ` +
        `typed but the parse line only accounts for ${parseDelta.toFixed(1)}px ` +
        "- something else in the page is resizing on input");
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("a held pan is never announced as the current one", async () => {
    // The pan is role="img" with a name, so it is content: a stale render
    // left under the live name tells a screen reader the user is looking at
    // a seed they are not. Dimming alone is not enough - it says nothing in
    // the accessibility tree.
    try {
      await freshLoad();
      await b.setViewport(380, 800, true);
      await openSheet();
      const name = () => b.eval(`
        const p = document.getElementById("scale-preview");
        return { label: p.getAttribute("aria-label"),
                 opacity: parseFloat(getComputedStyle(p).opacity) };
      `);
      const empty = await name();
      await typeScale("(D) A C D E F G A C");
      await b.settle();
      const valid = await name();
      await typeScale("(D) A C D zzzz");
      await b.settle();
      const held = await name();

      assert.notStrictEqual(held.label, valid.label,
        `a stale pan kept the live name ("${held.label}")`);
      assert.notStrictEqual(empty.label, valid.label,
        `the placeholder example kept the live name ("${empty.label}")`);
      // One dim treatment for "not your current input", two names.
      assert.ok(held.opacity < valid.opacity && empty.opacity < valid.opacity,
        `not-current states are not dimmed (empty ${empty.opacity}, ` +
        `held ${held.opacity}, current ${valid.opacity})`);
      // Floored so the plate's black rim ink keeps its contrast: this is
      // graphic content, not decoration.
      assert.ok(held.opacity >= 0.5 && empty.opacity >= 0.5,
        `dimmed below the 0.5 contrast floor (${held.opacity}, ${empty.opacity})`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("the sheet widens with the viewport on desktop, and the pan with it", async () => {
    // Request 4. Nothing inside the drawer scales with its width on its own -
    // the seed is a short string and the plate is pinned at a phone measurement
    // (300px since Stage 3, when the plate became the correction surface and
    // the notes had to be tappable) - so widening the surface alone buys an
    // empty band. The
    // plate has to grow too, which is why both are asserted together.
    const CLAMP = (vw) => Math.min(Math.max(520, vw * 0.52), 680);
    try {
      for (const [w, hgt] of [[640, 800], [1024, 800], [1280, 900], [1440, 900], [1920, 1080]]) {
        await freshLoad();
        await b.setViewport(w, hgt, false);
        await openSheet();
        await b.settle();
        const m = await b.eval(`
          const surf = document.querySelector(".sheetsurf");
          const plate = document.getElementById("scale-preview");
          return { surf: surf.getBoundingClientRect().width,
                   plate: plate.getBoundingClientRect().width,
                   vw: window.innerWidth };
        `);
        assert.ok(Math.abs(m.surf - CLAMP(m.vw)) < 1,
          `at ${w}px the sheet is ${m.surf.toFixed(1)}px, expected ` +
          `${CLAMP(m.vw).toFixed(1)}px (clamp(520px, 52vw, 680px))`);
        assert.ok(Math.abs(m.plate - 340) < 1,
          `at ${w}px the pan plate is ${m.plate.toFixed(1)}px, expected 340px - ` +
          `a wide sheet around a phone-sized plate is a wide empty band`);
      }
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
      await b.click("#scale-delete");   // arms
      await b.click("#scale-delete");   // confirms
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
  // strip and focus belongs on the control that opened the page. (The backdrop
  // tap of the drawer era is BACK now - same close path, same focus return.)
  test("Escape and BACK still hand focus back to the opener", async () => {
    await freshLoad();
    await openSheet();
    await b.key("Escape", "Escape", 27);
    await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "Escape to close the sheet" });
    assert.strictEqual(await activeId(), "deck-add",
      "Escape no longer returns focus to + ADD");

    await openSheet();
    await b.click("#scale-back");
    await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "BACK to close the sheet" });
    assert.strictEqual(await activeId(), "deck-add",
      "BACK no longer returns focus to + ADD");
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
