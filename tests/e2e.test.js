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

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { launch, findBrowser, APP_READY_EXPR } = require("./helpers/cdp.js");

const REPO = path.resolve(__dirname, "..");
// Loopback only, and by default port 0 - the OS hands out a free port, so two
// suites running side by side (several agents share this machine) simply cannot
// collide. E2E_PORT pins a specific port when you want one; a pinned port that
// is already taken is a LOUD, immediate failure, never a hang - see the before()
// hook and the "a taken port fails the harness fast" test in tests/harness.test.js.
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
  async function navigate(target) {
    if (navDead) throw navDead;
    let last = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await b.eval(`window.__stale = true; return true;`);
        const loaded = onceEvent("Page.loadEventFired", 20000);
        await b.send("Page.navigate", { url: target || URL });
        await loaded;
        // APP_READY_EXPR is the same "has the app booted" predicate
        // Browser.goto() polls for on the very first load (finding 17,
        // quality refactor 2026-09-30); this reload layers its own
        // staleness check on top, which the first load has nothing to be
        // stale against.
        await b.waitFor(
          `${APP_READY_EXPR} && !window.__stale`,
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

  // The suite's default desktop viewport, set once in before() and restored
  // here on every freshLoad() - finding 17 (quality refactor 2026-09-30):
  // a test that called b.setViewport() directly and never restored it used
  // to leak that viewport into whichever test's freshLoad() ran next.
  // freshLoad() resetting unconditionally is the backstop.
  const DEFAULT_VIEWPORT = [900, 900, false];

  async function freshLoad() {
    if (navDead) throw navDead;
    await b.setViewport(...DEFAULT_VIEWPORT);
    await b.eval(`try { localStorage.clear(); } catch (e) {} return true;`).catch(() => {});
    await navigate();
    // "+ ADD" ships in the markup, so waiting on ".chip" alone can be satisfied
    // before the app has booted. Wait for a real deck chip.
    await b.waitFor(`document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`, {
      label: "deck chips to be built",
    });
  }

  // Lane M1: the print controls and the mode toggle both live behind the
  // header's settings trigger now. Real interaction opens the panel first,
  // the same way a real user would, rather than reaching into a `hidden`
  // subtree - a click on a `hidden` element's descendant is not what ships.
  // M3 (desktop sidebar, 2026-09-28): at >=1024x700 the trigger is
  // display:none and the panel is already showing (CSS forces it visible
  // regardless of the `hidden` attribute), so a real user never clicks
  // anything here - the click is skipped when the trigger itself is not
  // visible, and the wait checks computed style rather than the `hidden`
  // attribute so it is satisfied either way.
  async function openSettingsPanel() {
    const triggerHidden = await b.eval(
      `return getComputedStyle(document.getElementById("settings-trigger")).display === "none";`);
    if (!triggerHidden) await b.click("#settings-trigger");
    await b.waitFor(
      `getComputedStyle(document.getElementById("settings-panel")).display !== "none"`,
      { label: "settings panel to open" },
    );
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

  // Lane F (deflake): several tests drag a card into its fly-out, then pause
  // the 220ms fly-out animation to inspect/exercise the card at a fixed
  // midpoint. Finding-then-pausing it via a SEPARATE b.eval after the drag
  // races real wall-clock time - on a slow CI runner the animation can
  // finish and the card can land before that eval ever runs, silently
  // turning the test into a no-op (observed: a right-click test's mutant
  // kill depended on this). installFlyoutPauseHook wraps .scene's own
  // .animate() so any 220ms animation it creates is paused in the SAME task
  // it is created in, before any wall-clock time can pass - removing the
  // race entirely rather than racing to win it. Call it once per freshLoad,
  // before the drag that triggers the fly-out.
  async function installFlyoutPauseHook() {
    await b.eval(`
      const scene = document.querySelector(".scene");
      if (!scene.__flyoutPauseHooked) {
        scene.__flyoutPauseHooked = true;
        const orig = scene.animate.bind(scene);
        scene.animate = (...args) => {
          const anim = orig(...args);
          if (anim.effect && anim.effect.getComputedTiming().duration === 220) anim.pause();
          return anim;
        };
      }
      return true;
    `);
  }

  // Finds the (already-paused, thanks to installFlyoutPauseHook) fly-out
  // animation and sets it to a fixed midpoint. Asserts it is actually
  // pending first: a missing animation means the hook was not installed
  // before the drag, or the fly-out already landed - either way the rest of
  // the test would pass vacuously, which is the exact failure mode this
  // helper exists to rule out.
  async function pauseFlyoutAnimation(currentTime = 150) {
    const found = await b.eval(`
      const a = document.querySelector(".scene").getAnimations().find(a => a.effect.getComputedTiming().duration === 220);
      if (!a) return false;
      if (a.playState !== "paused") a.pause();
      a.currentTime = ${currentTime};
      return true;
    `);
    assert.strictEqual(found, true,
      "the fly-out animation must still be pending (call installFlyoutPauseHook before the drag)");
  }

  // Click the i-th deck chip and wait for the deck to actually change over.
  // #decks holds deck chips only (M2, 2026-09-28: "+ Add a scale" moved into
  // the settings panel), so deck i is the (i + 1)-th chip. The hit test below
  // is what keeps this helper honest about the bug class the old "never
  // scroll" rule was protecting (row 214: something coming to rest ON TOP of
  // a chip). Scrolling moves a chip into the port; it cannot move an overlay
  // off it, so the assertion still fails on exactly the regression it was
  // written for.
  async function selectDeck(i, meta) {
    const sel = `#decks .chip:nth-child(${i + 1})`;
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

  // One touch-point-array builder shared by every synthetic touch gesture in
  // this file (finding 17, quality refactor 2026-09-30: three call sites drew
  // their own identical `{ radiusX: 4, radiusY: 4, force: 1, id: 1 }` literal).
  function touchPoint(x, y) {
    return [{ x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 }];
  }

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

  // M2, 2026-09-28: "+ Add a scale" moved out of the strip into the settings
  // panel, so #decks must hold deck chips and nothing else.
  test("#decks contains only deck chips - + ADD is not one of them", async () => {
    await freshLoad();
    const info = await b.eval(`
      const nav = document.getElementById("decks");
      return {
        addInStrip: !!document.getElementById("deck-add") &&
          nav.contains(document.getElementById("deck-add")),
        childCount: nav.children.length,
        chipCount: nav.querySelectorAll(".chip").length,
        addInPanel: !!document.querySelector("#settings-panel #deck-add"),
      };
    `);
    assert.strictEqual(info.addInStrip, false, "#deck-add is still inside #decks");
    assert.strictEqual(info.childCount, info.chipCount,
      "#decks has a child that is not a .chip");
    assert.strictEqual(info.addInPanel, true,
      "#deck-add did not move into the settings panel");
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

  /* Q14: #card's own keydown handler (index.html:7506-7509) treats a focused
     Enter or Space as "flip", same as a click - untested anywhere else, since
     every other keydown test in this file exists to prove a DESCENDANT
     control's Enter/Space does NOT bubble into a flip. This is the positive
     case: the card itself, focused directly, must still flip on both keys. */
  test("Enter and Space on a focused card flip it", async () => {
    await freshLoad();
    await b.eval(`document.getElementById("card").focus(); return true;`);
    assert.strictEqual(await cardFlipped(), false, "card starts unflipped");

    await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await b.send("Input.dispatchKeyEvent", { type: "char", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await b.waitFor(`document.getElementById("card").classList.contains("flip")`, {
      label: "Enter on the focused card to flip it",
    });
    assert.strictEqual(await cardFlipped(), true, "Enter on the focused card did not flip it");

    await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
    await b.send("Input.dispatchKeyEvent", { type: "char", key: " ", code: "Space", text: " ", unmodifiedText: " ", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
    await b.waitFor(`!document.getElementById("card").classList.contains("flip")`, {
      label: "Space on the focused card to flip it back",
    });
    assert.strictEqual(await cardFlipped(), false, "Space on the focused card did not flip it back");
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

  /* The swipe block (search `swipeDecision`) is the primary way the app is
     navigated on a phone and had no test of any kind until this group. A unit
     test cannot reach it: it is real touch dispatch, not a click. */
  test("a swipe past the threshold steps the deck in the swiped direction", async () => {
    await freshLoad();
    const n = (await decksMeta())[0].chords;

    await b.swipe("#card", -120);
    await expectCount(`2 / ${n}`, "swiping left did not step forward");

    await b.swipe("#card", 120);
    await expectCount(`1 / ${n}`, "swiping right did not step back");

    // Just past the 18px threshold, but slow and stalled right at release so
    // a fling cannot mask the distance (M4): only the commit distance decides.
    await b.drag("#card", [[-6, 150], [-13, 300], [-20, 450]]);
    await b.finishAnimations();
    await expectCount(`2 / ${n}`, "a 20px drag did not clear the 18px threshold");
  });

  // Owner: "Swipe gesture is very difficult at low speed... requires a very
  // quick flick." A deliberate, unhurried drag - ~30px over 600ms, ~0.05
  // px/ms even in the trailing fling window - must now commit on distance
  // alone (30 > the new 18px SWIPE_COMMIT_PX), with no flick required.
  test("a slow, deliberate drag past the new lower threshold still commits", async () => {
    await freshLoad();
    const n = (await decksMeta())[0].chords;

    await b.drag("#card", [[-5, 100], [-10, 200], [-15, 300], [-20, 400], [-25, 500], [-30, 600]]);
    await b.finishAnimations();
    await expectCount(`2 / ${n}`, "a slow 30px drag over 600ms did not step the deck");
  });

  test("a swipe shorter than the threshold does not navigate", async () => {
    // The card is BOTH the flip target and the swipe target, so the deadzone is
    // the whole of what keeps an ordinary tap - and the small drag a thumb makes
    // while tapping - from also throwing the card away to the next one.
    await freshLoad();
    const n = (await decksMeta())[0].chords;

    // Q27 positive sentinel: touch listeners are passive, so b.swipe()'s
    // synthetic touch events can resolve before the app's own handler has
    // run. Prove the harness is live first, with a control that must
    // navigate.
    await b.click("#next");
    await expectCount(`2 / ${n}`, "#next did not step forward - the harness itself is broken");
    await b.click("#prev");
    await expectCount(`1 / ${n}`, "#prev did not step back to the starting card");

    // b.drag() resolves once CDP has accepted the synthetic touch events, and
    // with passive listeners that can be BEFORE the page has handled them - so
    // a poll of #count right after can read stale. A second touchend listener
    // on the same element acks that touchend reached #card - it does NOT prove
    // the app acted on it (a dropped touchstart still fires touchend and still
    // acks), so the final -120 drag below, which must still navigate, is the
    // real guard against a handler that stopped reacting to touchend
    // altogether. Waiting on the ack only pins each exact-count read past the
    // CDP-vs-handler race; the read itself depends on step() rendering
    // synchronously, not on listener registration order. Slow (~0.03 px/ms
    // in the trailing fling window) so a fling cannot commit these, and the
    // 15px distance stays under the 18px commit threshold.
    await b.eval(`
      window.__swipeAck = 0;
      document.getElementById("card").addEventListener(
        "touchend", () => { window.__swipeAck++; }, { passive: true },
      );
      return true;
    `);

    await b.drag("#card", [[-3, 100], [-6, 200], [-9, 300], [-12, 400], [-15, 500]]);
    await b.waitFor(`window.__swipeAck === 1`, { timeout: 5000, label: "swipe 1 to be acknowledged" });
    await b.finishAnimations();
    assert.strictEqual(await countText(), `1 / ${n}`, "a 15px drag navigated; the deadzone shrank");

    await b.drag("#card", [[3, 100], [6, 200], [9, 300], [12, 400], [15, 500]]);
    await b.waitFor(`window.__swipeAck === 2`, { timeout: 5000, label: "swipe 2 to be acknowledged" });
    await b.finishAnimations();
    assert.strictEqual(await countText(), `1 / ${n}`, "a 15px drag back navigated; the deadzone shrank");

    // N1 (review nit, PR 143 attempt 1): a swipe PAST the threshold, run
    // last, is what actually guards against a handler that silently stopped
    // reacting to touchend at all - the ack above proves touchend reached
    // #card, not that the app acted on it (see the comment above).
    await b.swipe("#card", -120);
    await b.waitFor(`window.__swipeAck === 3`, { timeout: 5000, label: "swipe 3 to be acknowledged" });
    await b.finishAnimations();
    assert.strictEqual(await countText(), `2 / ${n}`, "a swipe past the threshold did not navigate at all");
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
    await openSettingsPanel();
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
   * print controls (one-pdf-path plan): every deck - built-in and
   * generated - builds its PDF client-side through HPE.pdfdeck, so the
   * header's print row is the same markup everywhere: two <button>s and
   * one paper <select>, never an <a href> to a pre-built file. The six
   * committed PDFs still ship (print-shop artifact) but nothing in the
   * app links them any more.
   * ---------------------------------------------------------------- */

  /* Lane M1 (menu-shell, 2026-09-28): the print row moved into the one
     settings panel shared by every deck, so it is no longer re-rendered per
     deck - checking it once per built-in deck would just check the same
     static markup N times. What still varies per deck is whether selecting
     one leaves the row intact; the shape claim itself (2 buttons, 1 select,
     never an <a>) is checked once, then re-checked after a couple of deck
     switches and after generating a deck, to prove nothing about switching
     decks touches the panel's markup. */
  test("every deck's print row is two buttons and one paper select, and never an <a>", async () => {
    await freshLoad();
    const meta = await decksMeta();
    const shape = () => b.eval(`
      const root = document.querySelector("#settings-panel .prints");
      return {
        buttons: root.querySelectorAll("button").length,
        selects: root.querySelectorAll("select").length,
        anchors: root.querySelectorAll("a").length,
        labels: [...root.querySelectorAll("button")].map(b => b.textContent.trim()),
      };
    `);

    for (const i of [0, meta.length - 1]) {
      await selectDeck(i, meta);
      const id = meta[i].id;
      const m = await shape();
      assert.strictEqual(m.anchors, 0, `deck ${id}: .prints still renders an <a>`);
      assert.strictEqual(m.buttons, 2, `deck ${id}: expected exactly 2 buttons, found ${m.buttons}`);
      assert.strictEqual(m.selects, 1, `deck ${id}: expected exactly 1 paper select, found ${m.selects}`);
      assert.deepStrictEqual(m.labels, ["FULL DECK PDF", "CHORD-ONLY PDF"], `deck ${id}`);
    }

    // And a generated deck gets the identical row - it is the same element.
    await generate(SIX_SCALES[1]);
    const g = await shape();
    assert.strictEqual(g.anchors, 0, "generated deck: .prints still renders an <a>");
    assert.strictEqual(g.buttons, 2, "generated deck: expected exactly 2 buttons");
    assert.strictEqual(g.selects, 1, "generated deck: expected exactly 1 paper select");
  });

  /* Lane M1: .prints no longer lives anywhere near .hdr - it moved into the
     settings panel. What's left to prove here is acceptance (1): the card
     face (.hdr included) carries no print controls at all, on every deck,
     and the deck-name box is unaffected (still its normal two lines). The
     panel's own layout budget (no wrap at 380px/320px) is covered separately
     by the settings-panel fit tests below. */
  test("the print controls sit outside .hdr and do not grow the deck-name box", async () => {
    await freshLoad();
    const meta = await decksMeta();
    await b.setViewport(380, 800, true);
    await b.settle();

    try {
      for (const i of [0, meta.length - 1]) {
        await selectDeck(i, meta);
        const m = await b.eval(`
          const hdr = document.querySelector("#front .hdr");
          const l = hdr.querySelector(".l");
          return {
            hdrChildren: hdr.children.length,
            nameLines: l.getBoundingClientRect().height,
            lineHeight: parseFloat(getComputedStyle(l).lineHeight),
            printsInFront: !!document.querySelector("#front .prints"),
          };
        `);
        assert.strictEqual(m.hdrChildren, 2,
          `${meta[i].id}: .hdr gained a child - the print controls must not join its flex row`);
        assert.strictEqual(m.printsInFront, false,
          `${meta[i].id}: .prints is still on the card face`);
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

  /* HPE.pdfcards.build runs synchronously, so downloadDeckPDF's whole
     disable -> build -> deliver -> re-enable sequence used to complete
     within ONE task with no yield to the browser's event loop in between.
     A second real tap dispatched while that task is still on the call stack
     (the reviewer's repro: two mousePressed/mouseReleased pairs sent
     together over CDP, on Pygmy in real Chrome) is queued by the browser and
     only processed once this task finishes - by which point the old
     `finally` had already re-enabled the buttons in the SAME task, so the
     queued tap landed on an enabled button and ran the build again.
     `btn.click()` called a second time from JS, before yielding, models the
     same "second activation queued while the guard is still up" scenario
     deterministically: a disabled button's `.click()` is a documented no-op,
     and whether that button is still disabled at this point is exactly what
     the setTimeout(0)-deferred re-enable controls (browsers suppress the
     click on a disabled element the same way whether the click call
     originates from a second dispatched input event or from script). */
  test("two taps on FULL DECK PDF queued together build the PDF once", async () => {
    await freshLoad();
    const meta = await decksMeta();
    const i = meta.findIndex((m) => m.id === "pygmy");
    assert.notStrictEqual(i, -1, "pygmy deck not found in DECKS");
    await selectDeck(i, meta);
    await openSettingsPanel();
    const count = await b.eval(`
      window.__buildCount = 0;
      const realBuild = HPE.pdfcards.build;
      HPE.pdfcards.build = function (...args) {
        window.__buildCount++;
        return realBuild.apply(this, args);
      };
      // Real Chrome opens a native "Save As" dialog for a.click() on some
      // profiles; suppress activation so the test cannot hang on a modal
      // that has nothing to do with the guard under test.
      HTMLAnchorElement.prototype.click = function () {};
      const btn = document.querySelector("#settings-panel .prints button"); // FULL DECK PDF
      btn.click();
      btn.click(); // the "second tap queued while the first is still running"
      return window.__buildCount;
    `);
    assert.strictEqual(count, 1,
      `two taps on FULL DECK PDF queued in the same task ran HPE.pdfcards.build ${count} time(s), not 1`);
  });

  /* The `finally` in downloadDeckPDF must re-enable the buttons on BOTH the
     success and the error path - a mutant that only re-enables after the
     `try` block leaves the row permanently disabled the first time the build
     throws. */
  test("print buttons are re-enabled after a build error", async () => {
    await freshLoad();
    await openSettingsPanel();
    await b.eval(`
      HPE.pdfcards.build = function () { throw new Error("boom (test)"); };
      // A real uncaught exception from an inline onclick handler is otherwise
      // just a console error; nothing to swallow here, but make sure it
      // cannot pop a dialog on this profile either.
      window.onerror = () => true;
      return true;
    `);
    const sel = "#settings-panel .prints button";
    await b.click(sel);
    // The build threw synchronously, but the row's re-enable is deferred via
    // setTimeout(0) - a genuine macrotask gap, not a CSS transition - so poll
    // for the real post-condition instead of a fixed wait.
    await b.waitFor(`document.querySelector(${JSON.stringify(sel)}).disabled === false`, {
      label: "the print button to be re-enabled after HPE.pdfcards.build threw",
    });
    const disabledRightAfter = await b.eval(`return document.querySelector(${JSON.stringify(sel)}).disabled;`);
    assert.strictEqual(disabledRightAfter, false,
      "a print button stayed disabled after HPE.pdfcards.build threw");
  });

  /* Finding 9 (quality refactor 2026-09-30, A-F1): the previous version of
     this test added its OWN click listener to prove "activated", which fires
     from the browser's native Enter-converts-to-click behaviour alone and
     never touches a line of app code - a mutant that broke the button's real
     onclick wiring (downloadDeckPDF(...); closePanel()) would still pass it.
     This version spies on HPE.pdfcards.build, the function downloadDeckPDF
     itself calls, and also checks closePanel()'s own observable effect (the
     panel's `hidden` attribute coming back), so a mutant that breaks that
     real call chain has something to break.

     The card's own keydown handler treats Space and Enter as "flip" and is
     bound to #card, so it fires for a key event that BUBBLES from any
     descendant; the wrapper's onclick="event.stopPropagation()" guards the
     mouse path only, keydown being a separate listener on a separate phase.
     It is unreachable from here today (#settings-panel is not inside #card;
     see index.html's own note by the handler, G5/owner-gated, left in place),
     so `flipped` below is expected to stay false independent of this guard -
     the assertion is kept as a regression guard in case that ever changes. */
  test("Enter on a print button runs its real click handler and does not flip the card", async () => {
    await freshLoad();
    await openSettingsPanel();
    await b.eval(`
      window.__buildCalls = [];
      HPE.pdfcards.build = (deck, opts) => { window.__buildCalls.push(opts); };
      document.querySelector("#settings-panel .prints button").focus();
      return true;
    `);
    await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await b.send("Input.dispatchKeyEvent", { type: "char", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await b.settle();
    const m = await b.eval(`
      return {
        buildCalls: window.__buildCalls,
        panelHidden: document.getElementById("settings-panel").hasAttribute("hidden"),
        flipped: document.getElementById("card").classList.contains("flip"),
      };
    `);
    assert.strictEqual(m.flipped, false,
      "Enter on a print button flipped the card");
    assert.strictEqual(m.buildCalls.length, 1,
      "Enter on the FULL DECK PDF button never reached HPE.pdfcards.build - " +
      "the real onclick chain did not run");
    assert.strictEqual(m.buildCalls[0].variant, "full",
      "Enter on the FULL DECK PDF button built the wrong variant");
    assert.strictEqual(m.panelHidden, true,
      "Enter on a print button never called closePanel() - the panel stayed open");
  });

  /* The paper <select> lives in the same .prints row as the print buttons and
     bubbles keydown to #card exactly the same way. Before the guard covered
     `select`, focusing it and pressing Space/Enter both flipped the card AND
     (via preventDefault) blocked the browser's own native open-the-picker
     behaviour for that key - the worst of both. */
  test("Enter on the paper select does not flip the card, on a built-in deck", async () => {
    await freshLoad();
    await openSettingsPanel();
    await b.eval(`
      const sel = document.querySelector("#settings-panel .prints select");
      sel.focus();
      return true;
    `);
    await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await b.send("Input.dispatchKeyEvent", { type: "char", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await b.settle();
    const flipped = await b.eval(`return document.getElementById("card").classList.contains("flip");`);
    assert.strictEqual(flipped, false, "Enter on the focused paper select flipped the card");
  });

  // A separate test (rather than Enter then Space in one) because Space's
  // native default action on a focused <select> is to open its OS dropdown -
  // stacking it after Enter's own default action risks compounding native
  // popup state across dispatches. Each test starts from a freshly loaded,
  // unopened select.
  test("Space on the paper select does not flip the card, on a built-in deck", async () => {
    await freshLoad();
    await openSettingsPanel();
    await b.eval(`
      const sel = document.querySelector("#settings-panel .prints select");
      sel.focus();
      return true;
    `);
    await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
    await b.send("Input.dispatchKeyEvent", { type: "char", key: " ", code: "Space", text: " ", unmodifiedText: " ", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
    await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32 });
    await b.settle();
    const flipped = await b.eval(`return document.getElementById("card").classList.contains("flip");`);
    assert.strictEqual(flipped, false, "Space on the focused paper select flipped the card");
  });

  /* Lane M1 (menu-shell): headerHTML() no longer renders .prints into either
     face - it moved into the one #settings-panel, a body-level sibling of
     header/main/footer (eng review F4: never nested under any of them, so it
     cannot go inert when something else inerts its background, and it is
     never duplicated across #front/#back in the first place). This replaces
     the old front/back tab-order duplication test with acceptance (1) - no
     controls on any card face, flipped or not - and acceptance (11) - the
     panel's own ancestry. */
  test("print controls are never on a card face, and the panel is not inside header/main/footer/card", async () => {
    await freshLoad();
    const faces = () => b.eval(`
      return {
        front: !!document.querySelector("#front .prints, #front button, #front select"),
        back: !!document.querySelector("#back .prints, #back button, #back select"),
      };
    `);
    const shut = await faces();
    assert.strictEqual(shut.front, false, "the showing face carries an interactive control");
    assert.strictEqual(shut.back, false, "the hidden face carries an interactive control");

    await b.click("#card");
    await b.waitFor(`document.getElementById("card").classList.contains("flip")`, {
      label: "card to take the flip class",
    });
    const open = await faces();
    assert.strictEqual(open.front, false, "after the flip the now-hidden face carries a control");
    assert.strictEqual(open.back, false, "after the flip the now-showing face carries a control");

    const ancestry = await b.eval(`
      const p = document.getElementById("settings-panel");
      return {
        inHeader: !!p.closest("header"),
        inMain: !!p.closest("main"),
        inFooter: !!p.closest("footer"),
        inCard: !!p.closest("#card"),
      };
    `);
    assert.deepStrictEqual(ancestry, { inHeader: false, inMain: false, inFooter: false, inCard: false },
      "the settings panel must not be a descendant of header, main, footer or #card");
  });

  /* Lane M1/M2b: the document keydown handler's panelOpen branch is the
     only thing standing between the settings panel and the card underneath
     it for ArrowRight/ArrowLeft - without its own `return`, either arrow key
     typed while the panel is open falls through to step() on the card the
     panel is supposed to be modal over. That half is exercised directly by
     the ArrowRight/ArrowLeft assertions below and killed by the
     e_menu_keys_leak_to_card mutant.
     Enter/Space are a DIFFERENT path: the document handler never acts on
     them at all (only Escape and Tab do, inside the panelOpen branch) -
     flip() is wired to #card's OWN keydown listener (row 7621), which only
     ever fires for a keydown targeting #card or a descendant. With the
     panel open, #card sits inside <main>, which openPanel() makes `inert`,
     so #card cannot hold focus and cannot receive the event in the first
     place - there is no document-level guard for Enter/Space to test, only
     the inert boundary. This test proves that boundary directly: it calls
     #card.focus() while the panel is open and asserts focus did NOT move
     there (inert refused it), THEN dispatches Enter and Space and asserts
     the panel stays open and the card neither flips nor steps. Dropping
     `el.inert = true` from openPanel() lets #card take focus, which reds
     the focus assertion immediately (m2b_panel_card_not_inert). */
  test("arrow keys and Enter/Space do not reach the card while the settings panel is open", async () => {
    await freshLoad();
    const meta = await decksMeta();
    const n = meta[0].chords;
    await expectCount(`1 / ${n}`, "starts on the first card");

    await openSettingsPanel();
    await b.key("ArrowRight", "ArrowRight", 39);
    await expectCount(`1 / ${n}`, "ArrowRight must not step the card while the panel is open");
    await b.key("ArrowLeft", "ArrowLeft", 37);
    await expectCount(`1 / ${n}`, "ArrowLeft must not step the card while the panel is open");

    // Move focus off the trigger first: otherwise the Enter/Space probes
    // below would hit the TRIGGER's own click handler (which closes the
    // panel) before ever reaching a point where the inert boundary matters.
    await b.eval(`document.activeElement.blur()`);
    const blurred = await b.eval(`return document.activeElement === document.body`);
    assert.strictEqual(blurred, true, "focus did not move to <body> for the Enter/Space probes");

    await b.eval(`document.getElementById("card").focus()`);
    const cardFocused = await b.eval(
      `return document.activeElement === document.getElementById("card")`);
    assert.strictEqual(cardFocused, false,
      "#card sits inside <main>, which the open panel makes inert - it must refuse focus");

    const readState = () => b.eval(`return {
      panelOpen: document.getElementById("settings-panel").hidden === false,
      flip: document.getElementById("card").classList.contains("flip"),
      count: (document.getElementById("count").textContent || "").trim(),
    }`);

    await b.key("Enter", "Enter", 13);
    let state = await readState();
    assert.strictEqual(state.panelOpen, true,
      "Enter with no panel control focused must not close the panel");
    assert.strictEqual(state.flip, false,
      "the card must not have flipped from Enter while the panel is open");
    assert.strictEqual(state.count, `1 / ${n}`,
      "Enter must not step the card while the panel is open");

    await b.key(" ", " ", 32);
    state = await readState();
    assert.strictEqual(state.panelOpen, true,
      "Space with no panel control focused must not close the panel");
    assert.strictEqual(state.flip, false,
      "the card must not have flipped from Space while the panel is open");
    assert.strictEqual(state.count, `1 / ${n}`,
      "Space must not step the card while the panel is open");
  });

  test("the settings trigger opens and closes the full-screen panel, and reports its own state", async () => {
    await freshLoad();
    const haspopup = await b.eval(
      `return document.getElementById("settings-trigger").getAttribute("aria-haspopup")`);
    assert.strictEqual(haspopup, "dialog", "the trigger must advertise the dialog it opens");
    const closedExpanded = await b.eval(
      `return document.getElementById("settings-trigger").getAttribute("aria-expanded")`);
    assert.strictEqual(closedExpanded, "false", "aria-expanded must start false");

    // 1. Escape closes it and returns focus to the trigger.
    await openSettingsPanel();
    let expanded = await b.eval(
      `return document.getElementById("settings-trigger").getAttribute("aria-expanded")`);
    assert.strictEqual(expanded, "true", "aria-expanded must flip true once the panel is open");
    await b.key("Escape", "Escape", 27);
    await b.waitFor(`document.getElementById("settings-panel").hidden === true`,
      { label: "panel to close on Escape" });
    let focused = await b.eval(`return document.activeElement.id`);
    assert.strictEqual(focused, "settings-trigger", "Escape must return focus to the trigger");
    expanded = await b.eval(
      `return document.getElementById("settings-trigger").getAttribute("aria-expanded")`);
    assert.strictEqual(expanded, "false", "aria-expanded must flip back false on close");

    // 2. Below the desktop breakpoint the open panel is a full-screen
    // takeover (owner decision 2026-09-29), so the scrim is covered and the
    // exit is the trigger, drawn on top of the panel as an X.
    await openSettingsPanel();
    const cover = await b.eval(`
      const p = document.getElementById("settings-panel").getBoundingClientRect();
      const t = document.getElementById("settings-trigger").getBoundingClientRect();
      const hit = document.elementFromPoint(t.left + t.width / 2, t.top + t.height / 2);
      const before = getComputedStyle(document.querySelector("#settings-trigger .glyph"), "::before");
      return { p: [p.left, p.top, p.width, p.height], vw: innerWidth, vh: innerHeight,
               onTop: !!(hit && hit.closest("#settings-trigger")), glyph: before.transform };`);
    assert.deepStrictEqual(cover.p, [0, 0, cover.vw, cover.vh], "the open panel must cover the whole viewport");
    assert.ok(cover.onTop, "the trigger must be the topmost element at its own centre while the panel is open");
    assert.notStrictEqual(cover.glyph, "none", "the open trigger's glyph must be drawn as an X (rotated bars)");
    await b.click("#settings-trigger");
    await b.waitFor(`document.getElementById("settings-panel").hidden === true`,
      { label: "panel to close on a tap on the X" });

    // 3. A second tap on the trigger itself closes it.
    await openSettingsPanel();
    await b.click("#settings-trigger");
    await b.waitFor(`document.getElementById("settings-panel").hidden === true`,
      { label: "panel to close on a second trigger tap" });
    focused = await b.eval(`return document.activeElement.id`);
    assert.strictEqual(focused, "settings-trigger",
      "a second trigger tap must leave focus on the trigger");
  });

  // M2, 2026-09-28 (review gap on M1, PR #153: "Tab trap and background inert
  // untested (2 hand mutants survived)"). The panel's own keydown handler
  // (index.html panelOpen branch) computes panelStops() and moves focus among
  // them itself, with e.preventDefault() - so native Tab order is irrelevant
  // and only this list matters. "+ ADD A SCALE" (#deck-add) sits between the
  // mode buttons and the print controls in DOM order and must be one of the
  // stops.
  test("Tab is trapped inside the settings panel and cycles every stop, wrapping both ways",
    async () => {
      await freshLoad();
      await openSettingsPanel();
      // Some panel stops (the print buttons) carry no id, so tag each stop
      // with its own index into the app's OWN panelStops() list (the exact
      // array the keydown handler cycles through) and track focus by that
      // index, not by id alone - two different id-less print buttons would
      // otherwise be indistinguishable.
      await b.eval(`window.panelStops().forEach((el, i) => el.setAttribute("data-stop-idx", i));`);
      const describe = () => b.eval(`
        const panel = document.getElementById("settings-panel");
        const a = document.activeElement;
        return {
          id: a && a.id || null,
          stopIdx: a && a.hasAttribute("data-stop-idx") ? a.getAttribute("data-stop-idx") : null,
          isTrigger: a && a.id === "settings-trigger",
          inPanel: !!a && panel.contains(a),
        };
      `);
      const first = await describe();
      assert.strictEqual(first.isTrigger, true,
        "focus is not on the trigger right after opening");

      // The bound is derived from the app's own panelStops() list, not a
      // hand-picked constant: a forward cycle visits every stop once, then
      // one more Tab wraps back to the trigger (R186-3, future-proofing -
      // a fixed headroom would silently stop catching a missing wrap the
      // day the panel grows past it).
      const bound = (await b.eval(`return window.panelStops().length;`)) + 1;
      const seen = [first];
      for (let i = 0; i < bound; i++) {
        await b.key("Tab", "Tab", 9);
        seen.push(await describe());
        if (seen[seen.length - 1].isTrigger) break;
      }
      assert.strictEqual(seen[seen.length - 1].isTrigger, true,
        `Tab never wrapped back to the trigger: ${JSON.stringify(seen)}`);
      const ids = seen.map((s) => s.id);
      assert.ok(ids.includes("modeA"), `Tab never reached #modeA: ${JSON.stringify(seen)}`);
      assert.ok(ids.includes("modeB"), `Tab never reached #modeB: ${JSON.stringify(seen)}`);
      assert.ok(ids.includes("deck-add"),
        `Tab never reached + ADD A SCALE: ${JSON.stringify(seen)}`);
      // Eng review amendment 1: the three Resources links join panelStops()
      // after the print controls, so a forward Tab cycle must reach all three.
      for (const id of ["res-handpaner", "res-dingandtones", "res-trainingcards"]) {
        assert.ok(ids.includes(id), `Tab never reached #${id}: ${JSON.stringify(seen)}`);
      }
      // #deck-add opens the scale sheet dialog, exactly what the old strip
      // chip advertised (review gap on PR #155: the move into the panel
      // dropped this attribute).
      const deckAddHaspopup = await b.eval(
        `return document.getElementById("deck-add").getAttribute("aria-haspopup")`);
      assert.strictEqual(deckAddHaspopup, "dialog",
        "+ ADD A SCALE must advertise the dialog it opens");
      // Everything seen must actually be inside the panel (or be the trigger
      // that opened it) - Tab must never escape to the inert background.
      const outside = seen.filter((s) => !s.isTrigger && !s.inPanel);
      assert.deepStrictEqual(outside, [], `Tab escaped the panel: ${JSON.stringify(outside)}`);

      // Tab from the LAST real stop (the entry right before the walk wrapped
      // back to the trigger above) must land on the trigger - i.e. Tab from
      // last wraps to first. seen[seen.length - 1] is that trigger landing;
      // seen[seen.length - 2] is the last real stop that produced it.
      const lastStop = seen[seen.length - 2];
      assert.ok(lastStop && !lastStop.isTrigger,
        `no real stop preceded the wrap back to the trigger: ${JSON.stringify(seen)}`);

      // Shift+Tab from the trigger (the first stop) must land on that SAME
      // last stop - not merely "inside the panel, not the trigger" (which a
      // wrap to the wrong index, or to any other stop, would also satisfy).
      await b.send("Input.dispatchKeyEvent", {
        type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9,
        nativeVirtualKeyCode: 9, modifiers: 8,
      });
      await b.send("Input.dispatchKeyEvent", {
        type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9,
        nativeVirtualKeyCode: 9, modifiers: 8,
      });
      const last = await describe();
      assert.strictEqual(last.isTrigger, false,
        "Shift+Tab from the first stop did not move focus off the trigger");
      assert.strictEqual(last.inPanel, true,
        `Shift+Tab from the first stop landed outside the panel: ${JSON.stringify(last)}`);
      assert.strictEqual(last.stopIdx, lastStop.stopIdx,
        `Shift+Tab from the first stop must land on the LAST stop (idx ${lastStop.stopIdx}), ` +
        `landed on idx ${last.stopIdx} instead: ${JSON.stringify({ lastStop, last })}`);
    });

  // M2, 2026-09-28 (same review gap as above). panelBackground is
  // [main, footer, #decks] - NOT header, because #settings-trigger itself
  // must stay reachable to close the panel it opened.
  test("main, footer and the deck strip are inert and aria-hidden while the settings panel is open, and restored on close",
    async () => {
      await freshLoad();
      const shut = await b.eval(`
        return [...document.querySelectorAll("main, footer, #decks")]
          .map(el => ({ sel: el.tagName + (el.id ? "#" + el.id : ""),
                        hidden: el.getAttribute("aria-hidden"), inert: !!el.inert }));
      `);
      assert.ok(shut.length >= 3, "main, footer or #decks is missing from the page");
      for (const el of shut) {
        assert.strictEqual(el.hidden, null, `${el.sel} is aria-hidden before the panel opens`);
        assert.strictEqual(el.inert, false, `${el.sel} is inert before the panel opens`);
      }

      await openSettingsPanel();
      const headerLive = await b.eval(
        `return { inert: !!document.querySelector("header").inert, ` +
        `hidden: document.querySelector("header").getAttribute("aria-hidden") };`);
      assert.strictEqual(headerLive.inert, false,
        "header went inert while the panel is open - the trigger could not close it");
      assert.strictEqual(headerLive.hidden, null,
        "header is aria-hidden while the panel is open");

      const open = await b.eval(`
        return [...document.querySelectorAll("main, footer, #decks")]
          .map(el => ({ sel: el.tagName + (el.id ? "#" + el.id : ""),
                        hidden: el.getAttribute("aria-hidden"), inert: !!el.inert }));
      `);
      assert.strictEqual(open.length, shut.length, "the background set changed while the panel was open");
      for (const el of open) {
        assert.strictEqual(el.hidden, "true",
          `${el.sel} is still exposed to a screen reader behind the panel`);
        assert.strictEqual(el.inert, true, `${el.sel} is still interactive behind the panel`);
      }

      await b.key("Escape", "Escape", 27);
      await b.waitFor(`document.getElementById("settings-panel").hidden === true`,
        { label: "the panel to close" });
      const back = await b.eval(`
        return [...document.querySelectorAll("main, footer, #decks")]
          .map(el => ({ sel: el.tagName + (el.id ? "#" + el.id : ""),
                        hidden: el.getAttribute("aria-hidden"), inert: !!el.inert }));
      `);
      for (const el of back) {
        assert.strictEqual(el.hidden, null, `${el.sel} is still aria-hidden after the panel closed`);
        assert.strictEqual(el.inert, false, `${el.sel} is still inert after the panel closed`);
      }
    });

  // M2, 2026-09-28 (review gap on M1, PR #153: "320 h1/trigger overlap
  // untested"). At the narrowest supported phone width the header title and
  // the settings trigger must not overlap - two hit targets sharing a pixel
  // is the same mis-tap class the deck-strip overlay bug was.
  test("the header title and the settings trigger do not overlap at 320x568", async () => {
    await freshLoad();
    await b.setViewport(320, 568, true);
    try {
      const m = await b.eval(`
        const h = document.querySelector("h1").getBoundingClientRect();
        const t = document.getElementById("settings-trigger").getBoundingClientRect();
        return {
          h: { l: h.left, r: h.right, t: h.top, b: h.bottom },
          trig: { l: t.left, r: t.right, t: t.top, b: t.bottom },
        };
      `);
      const overlaps = m.h.l < m.trig.r && m.h.r > m.trig.l && m.h.t < m.trig.b && m.h.b > m.trig.t;
      assert.strictEqual(overlaps, false,
        `h1 ${JSON.stringify(m.h)} overlaps #settings-trigger ${JSON.stringify(m.trig)} at 320x568`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("the full-screen settings panel fits with no scroll in every mode, at 320x568 and every landscape size",
    async () => {
      await freshLoad();
      try {
        for (const [vw, vh] of [[320, 568], [844, 390], [926, 428], [667, 375], [1280, 500]]) {
          await b.setViewport(vw, vh, vw < vh);
          await b.settle();
          for (const mode of ["A", "B", "S"]) {
            await openSettingsPanel();
            await b.click(`#mode${mode}`);
            await b.waitFor(`document.getElementById("settings-panel").hidden === true`,
              { label: `panel to close after selecting mode ${mode}` });
            await openSettingsPanel();
            const m = await b.eval(`
              const p = document.getElementById("settings-panel");
              const r = p.getBoundingClientRect();
              const t = document.getElementById("settings-trigger").getBoundingClientRect();
              const hit = (a, k) => a.left < k.right && a.right > k.left && a.top < k.bottom && a.bottom > k.top;
              const ctrls = [...p.querySelectorAll("button, select, a")].filter(e => e.offsetParent);
              return {
                rect: [r.left, r.top, r.width, r.height],
                scrollH: p.scrollHeight, clientH: p.clientHeight,
                scrollW: p.scrollWidth, clientW: p.clientWidth,
                noteShown: !document.getElementById("panel-seq-note").hidden,
                offscreen: ctrls.filter(e => { const k = e.getBoundingClientRect();
                  return k.left < 0 || k.top < 0 || k.right > innerWidth + 0.5 || k.bottom > innerHeight + 0.5; }).map(e => e.id || e.textContent.trim()),
                underTrigger: ctrls.filter(e => hit(e.getBoundingClientRect(), t)).map(e => e.id || e.textContent.trim()),
                short: ctrls.filter(e => e.getBoundingClientRect().height < 44).map(e => e.id || e.textContent.trim()),
                resIds: ctrls.filter(e => e.id && e.id.startsWith("res-")).map(e => e.id),
              };
            `);
            const label = `${vw}x${vh} mode ${mode}`;
            assert.deepStrictEqual(m.rect, [0, 0, vw, vh], `${label}: the panel must cover the viewport`);
            // A hidden Resources group would silently vanish from `ctrls`
            // (the `offsetParent` filter above) and pass every other
            // assertion here vacuously, so require all three ids to actually
            // be present and measured at every size/mode.
            assert.deepStrictEqual(m.resIds.slice().sort(),
              ["res-dingandtones", "res-handpaner", "res-trainingcards"],
              `${label}: the Resources links are not all visible/measured`);
            assert.strictEqual(m.noteShown, mode === "S", `${label}: the credit note shows only in mode S`);
            assert.ok(m.scrollH <= m.clientH + 1,
              `${label}: panel content (${m.scrollH}px) overflows its own box (${m.clientH}px) vertically`);
            assert.ok(m.scrollW <= m.clientW + 1,
              `${label}: panel content (${m.scrollW}px) overflows its own box (${m.clientW}px) horizontally`);
            assert.deepStrictEqual(m.offscreen.slice().sort(), [],
              `${label}: controls off screen`);
            assert.deepStrictEqual(m.underTrigger, [], `${label}: controls under the X trigger`);
            assert.deepStrictEqual(m.short, [], `${label}: controls under the 44px target`);
            await b.key("Escape", "Escape", 27);
            await b.waitFor(`document.getElementById("settings-panel").hidden === true`,
              { label: `panel to close at ${label}` });
          }
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

  /* ---------------------------------------------------------------- *
   * Resources menu (docs/plans/2026-10-01-resources-menu.md, eng review
   * amendments 1-7)
   * ---------------------------------------------------------------- */

  const RESOURCES = [
    { id: "res-handpaner", href: "https://handpaner.com/", label: "HANDPANER" },
    { id: "res-dingandtones", href: "https://www.dingandtones.com/", label: "DING & TONES" },
    { id: "res-trainingcards", href: "https://svenkirchhofer.de/handpan-training-cards/", label: "HTC" },
  ];

  test("the settings panel has exactly one Resources group with the three outbound links", async () => {
    await freshLoad();
    await openSettingsPanel();
    const m = await b.eval(`
      const headings = [...document.querySelectorAll("#settings-panel .panel-heading")]
        .filter(h => h.textContent.trim() === "Resources");
      const group = headings[0] ? headings[0].closest(".panel-group") : null;
      const links = group ? [...group.querySelectorAll("a")] : [];
      return {
        headingCount: headings.length,
        links: links.map(a => ({
          id: a.id, href: a.getAttribute("href"), target: a.getAttribute("target"),
          rel: a.getAttribute("rel"), label: a.textContent.trim(),
          className: a.className,
          textDecoration: getComputedStyle(a).textDecorationLine,
        })),
      };
    `);
    assert.strictEqual(m.headingCount, 1, "expected exactly one Resources heading");
    assert.strictEqual(m.links.length, 3, `expected 3 links in the Resources group, got ${JSON.stringify(m.links)}`);
    m.links.forEach((link, i) => {
      const expected = RESOURCES[i];
      assert.strictEqual(link.id, expected.id, `link ${i} id mismatch: ${JSON.stringify(link)}`);
      assert.strictEqual(link.href, expected.href, `link ${i} href mismatch: ${JSON.stringify(link)}`);
      assert.strictEqual(link.label, expected.label, `link ${i} label mismatch: ${JSON.stringify(link)}`);
      assert.strictEqual(link.target, "_blank", `link ${i} must open in a new tab: ${JSON.stringify(link)}`);
      assert.match(link.rel, /\bnoopener\b/, `link ${i} rel must contain noopener: ${JSON.stringify(link)}`);
      assert.match(link.className, /\bmode\b/, `link ${i} must reuse .mode styling: ${JSON.stringify(link)}`);
      // Eng review amendment 2: a.mode gets no text-decoration from .mode,
      // so the anchor's own rule must suppress the UA underline explicitly.
      assert.strictEqual(link.textDecoration, "none",
        `link ${i} must not show the default anchor underline: ${JSON.stringify(link)}`);
    });
  });

  // Eng review amendment 5 (Codex finding, "outside voice"): the desktop
  // sidebar at its smallest supported size, 1024x700, must not gain NEW
  // vertical or horizontal scroll from the Resources group beyond what the
  // sidebar already does. Baseline measured on origin/main before this group
  // existed: scrollHeight === clientHeight (688px) at 1024x700 in every mode
  // - i.e. no overflow at all. Recorded in the PR body per the amendment.
  test("the desktop sidebar at 1024x700 gains no new HORIZONTAL scroll from the Resources group, in modes A, B and S",
    async () => {
      await freshLoad();
      try {
        await b.setViewport(1024, 700, false);
        await b.settle();
        for (const mode of ["A", "B", "S"]) {
          await b.click(`#mode${mode}`);
          await b.settle();
          const m = await b.eval(`
            const p = document.getElementById("settings-panel");
            const resIds = ["res-handpaner", "res-dingandtones", "res-trainingcards"];
            return {
              scrollH: p.scrollHeight, clientH: p.clientHeight,
              scrollW: p.scrollWidth, clientW: p.clientWidth,
              resVisible: resIds.every(id => {
                const el = document.getElementById(id);
                return el && el.getClientRects().length > 0;
              }),
            };
          `);
          const label = `1024x700 mode ${mode}`;
          assert.ok(m.scrollW <= m.clientW + 1,
            `${label}: the sidebar (${m.scrollW}px) overflows its own box (${m.clientW}px) horizontally`);
          assert.ok(m.resVisible, `${label}: the Resources links are not all rendered in the sidebar`);
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

  // R186-1: the HORIZONTAL test above only ever asserted scrollW <= clientW,
  // despite its own comment citing a VERTICAL baseline (scrollHeight ===
  // clientHeight at 1024x700 before the Resources group existed). This is
  // the test that actually checks that baseline still holds: no NEW vertical
  // scroll from the Resources group, in modes A, B and S. A rename of the
  // HORIZONTAL test is a non-goal (it would break the mutant `# suite:`
  // pattern that targets it by name), so this is a new, separate test.
  test("the desktop sidebar at 1024x700 gains no new VERTICAL scroll from the Resources group, in modes A, B and S",
    async () => {
      await freshLoad();
      try {
        await b.setViewport(1024, 700, false);
        await b.settle();
        for (const mode of ["A", "B", "S"]) {
          await b.click(`#mode${mode}`);
          await b.settle();
          const m = await b.eval(`
            const p = document.getElementById("settings-panel");
            const resIds = ["res-handpaner", "res-dingandtones", "res-trainingcards"];
            return {
              scrollH: p.scrollHeight, clientH: p.clientHeight,
              resVisible: resIds.every(id => {
                const el = document.getElementById(id);
                return el && el.getClientRects().length > 0;
              }),
            };
          `);
          const label = `1024x700 mode ${mode}`;
          assert.ok(m.scrollH <= m.clientH + 1,
            `${label}: the sidebar (${m.scrollH}px) overflows its own box (${m.clientH}px) vertically`);
          assert.ok(m.resVisible, `${label}: the Resources links are not all rendered in the sidebar`);
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

  // Reviewer FAIL #2 (2026-10-02): the sidebar's narrow-height budget
  // (index.html's "narrow-height budget" comment above max-height:745px)
  // was measured for modes A/B only and left a gap at viewport heights the
  // original two tests above never sampled - 1024x700 is the one height
  // they check, and the gap sits strictly above it. A height sweep (every
  // integer 700-900 at 1024 and 1280 wide, modes A/B/S) found: modes A/B
  // overflow NOWHERE in that whole range; mode S overflows 746-757px, worst
  // at 746 (+12px, res-trainingcards pushed offscreen), and is clean again
  // at 758+. This test samples that worst height (746), the coordinator's
  // named regression point (750), and a point past the old bound but still
  // inside the gap (757, the last still-overflowing height) at both
  // 1024 and 1280 wide, in all three modes - modes A/B are included so a
  // future fix that over-corrects for mode S and reintroduces an A/B
  // regression is also caught.
  test("the desktop sidebar has no vertical scroll at 1024x746/750/757 and 1280x746 (reviewer FAIL #2 mode-S gap), in modes A, B and S",
    async () => {
      await freshLoad();
      try {
        for (const [w, h] of [[1024, 746], [1024, 750], [1024, 757], [1280, 746]]) {
          await b.setViewport(w, h, false);
          await b.settle();
          for (const mode of ["A", "B", "S"]) {
            await b.click(`#mode${mode}`);
            await b.settle();
            const m = await b.eval(`
              const p = document.getElementById("settings-panel");
              const resIds = ["res-handpaner", "res-dingandtones", "res-trainingcards"];
              return {
                scrollH: p.scrollHeight, clientH: p.clientHeight,
                resVisible: resIds.every(id => {
                  const el = document.getElementById(id);
                  return el && el.getClientRects().length > 0;
                }),
              };
            `);
            const label = `${w}x${h} mode ${mode}`;
            assert.ok(m.scrollH <= m.clientH + 1,
              `${label}: the sidebar (${m.scrollH}px) overflows its own box (${m.clientH}px) vertically by ${m.scrollH - m.clientH}px`);
            assert.ok(m.resVisible, `${label}: the Resources links are not all rendered in the sidebar`);
          }
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

  // Eng review amendment 7 (Codex finding): the original behaviour test only
  // proved nothing broke when a click was intercepted and defaultPrevented -
  // true of literally any link, even a dead one. This proves ACTIVATION: a
  // real mouse click and a real Enter keypress on a focused link each produce
  // exactly one recorded navigation attempt, to the right href, with
  // target=_blank - while the panel stays open and the practice mode and
  // current card are unchanged (amendment 3: links deliberately do not call
  // closePanel()).
  test("Resources links activate on click and on Enter, to the right href, without closing the panel or changing mode/card",
    async () => {
      await freshLoad();
      await openSettingsPanel();
      await b.eval(`
        window.__resActivations = [];
        window.__resCapture = (e) => {
          const a = e.target.closest && e.target.closest("a[id^='res-']");
          if (!a) return;
          window.__resActivations.push({
            id: a.id, href: a.getAttribute("href"), target: a.getAttribute("target"),
          });
          // Stop the real navigation the click would otherwise trigger -
          // this is a test harness concern, not production behaviour.
          e.preventDefault();
        };
        document.addEventListener("click", window.__resCapture, true);
        return true;
      `);
      const before = await b.eval(`return {
        modeA: document.getElementById("modeA").getAttribute("aria-pressed"),
        front: document.getElementById("front").textContent,
      };`);

      for (const r of RESOURCES) {
        await b.eval(`window.__resActivations = []; return true;`);
        await b.click(`#${r.id}`);
        const afterClick = await b.eval(`return window.__resActivations;`);
        assert.strictEqual(afterClick.length, 1,
          `clicking #${r.id} should produce exactly one activation, got ${JSON.stringify(afterClick)}`);
        assert.strictEqual(afterClick[0].href, r.href, `#${r.id} click activation had the wrong href`);
        assert.strictEqual(afterClick[0].target, "_blank", `#${r.id} click activation had the wrong target`);
        const panelOpenAfterClick = await b.eval(
          `return getComputedStyle(document.getElementById("settings-panel")).display !== "none";`);
        assert.strictEqual(panelOpenAfterClick, true,
          `clicking #${r.id} must not close the settings panel`);

        await b.eval(`
          window.__resActivations = [];
          document.getElementById(${JSON.stringify(r.id)}).focus();
          return document.activeElement.id;
        `);
        await b.key("Enter", "Enter", 13);
        const afterEnter = await b.eval(`return window.__resActivations;`);
        assert.strictEqual(afterEnter.length, 1,
          `pressing Enter on #${r.id} should produce exactly one activation, got ${JSON.stringify(afterEnter)}`);
        assert.strictEqual(afterEnter[0].href, r.href, `#${r.id} Enter activation had the wrong href`);
        assert.strictEqual(afterEnter[0].target, "_blank", `#${r.id} Enter activation had the wrong target`);
      }

      const after = await b.eval(`return {
        modeA: document.getElementById("modeA").getAttribute("aria-pressed"),
        front: document.getElementById("front").textContent,
      };`);
      assert.strictEqual(after.modeA, before.modeA, "a Resources link changed the practice mode");
      assert.strictEqual(after.front, before.front, "a Resources link changed the displayed card");
    });

  test("the paper choice survives a reload", async () => {
    await freshLoad();
    await openSettingsPanel();
    await b.eval(`
      const sel = document.querySelector("#settings-panel .prints select");
      sel.value = "a4";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    `);
    const before = await stored();
    assert.strictEqual(before.printPaper, "a4", "the paper choice was not saved under \"hpfc\"");

    await navigate(); // reload
    await b.waitFor(`document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`, {
      label: "chips after reload",
    });
    const after = await b.eval(`
      return document.getElementById("print-paper-select").value;
    `);
    assert.strictEqual(after, "a4", "the paper selector did not come back on A4 after a reload");
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
    // "+ Add a scale" lives in the settings panel now (M2, 2026-09-28), so a
    // real tap opens the panel first, the same way a real user would.
    await openSettingsPanel();
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

  test("Escape closes the sheet and focus returns to the settings trigger", async () => {
    await freshLoad();
    await openSheet();
    // AC2: the page does not steal focus into the box - no soft keyboard until
    // the user taps it - but focus does leave the inert background.
    assert.strictEqual(await activeId(), "scale-back",
      "focus did not land on BACK when the page opened");
    await b.key("Escape", "Escape", 27);
    await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "Escape to close the sheet" });
    // "+ Add a scale" lives inside the settings panel, which closePanel()
    // already hid before the sheet opened (M2, 2026-09-28) - #deck-add cannot
    // receive focus while hidden, so cancelling returns focus to the trigger
    // that is actually still on screen.
    assert.strictEqual(await activeId(), "settings-trigger",
      "focus did not return to the settings trigger");
  });

  // Task item 2's own acceptance criterion: opening "+ Add a scale" from the
  // panel closes the panel FIRST (see addChip.onclick), so cancelling the
  // sheet must not leave the panel's inert/hidden bookkeeping stuck. Nothing
  // in header/main/footer/#settings-panel may still be inert or aria-hidden,
  // the panel itself must be closed (hidden, aria-expanded=false on the
  // trigger) and the scrim must be hidden.
  test("open-from-panel then cancel leaves no residual panel or background state", async () => {
    await freshLoad();
    await openSheet();
    await b.key("Escape", "Escape", 27);
    await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "Escape to close the sheet" });
    const state = await b.eval(`
      const rects = ["header", "main", "footer", "#settings-panel"].map(sel => {
        const el = document.querySelector(sel);
        return { sel, inert: !!el && el.inert, ariaHidden: el && el.getAttribute("aria-hidden") };
      });
      return {
        rects,
        panelHidden: document.getElementById("settings-panel").hidden,
        scrimHidden: document.getElementById("settings-scrim").hidden,
        expanded: document.getElementById("settings-trigger").getAttribute("aria-expanded"),
      };
    `);
    for (const r of state.rects) {
      assert.strictEqual(r.inert, false, `${r.sel} is still inert after cancel`);
      assert.strictEqual(r.ariaHidden, null, `${r.sel} is still aria-hidden after cancel`);
    }
    assert.strictEqual(state.panelHidden, true, "the settings panel did not stay closed");
    assert.strictEqual(state.scrimHidden, true, "the settings scrim did not stay hidden");
    assert.strictEqual(state.expanded, "false", "the trigger did not report aria-expanded=false");
  });

  // AC3. The drawer closed on a backdrop tap; the page has no backdrop, and a
  // stray tap on a full-viewport page would silently discard an unsaved edit.
  // BACK is the gesture now, and the old one has to be gone, not just unused.
  test("BACK closes the page and focus returns to the settings trigger; a stray tap does not",
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
      assert.strictEqual(await activeId(), "settings-trigger",
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

  /* Q1: the share-URL inbound flow (index.html:7573-7574) had no e2e test -
     openShare() itself is unit-tested against the sandbox (app.test.js), but
     the sandbox never navigates, so a boot-order regression on a real
     `location.hash` would stay green everywhere else. There is no
     `hashchange` path (Q30), so a FRESH navigation is the only reachable
     case; an in-tab hash paste is a behaviour gap, not a test gap.
     The link is built through the app's own shareLink(), never hand-encoded
     here, so the wire format is exercised exactly as a real share does it. */
  test("a fresh navigation to a share link shows the deck, count and a lit field", async () => {
    try {
      // After freshLoad(), which resets to DEFAULT_VIEWPORT: Q1 is a 380px
      // finding, and the share-link boot below must happen at that width.
      await freshLoad();
      await b.setViewport(380, 800, true);
      await generate(SIX_SCALES[1]);
      const shared = await b.eval(`
        const d = CUSTOM[deckId];
        const res = shareLink(d);
        return {
          ok: res.ok, reason: res.ok ? null : res.reason, url: res.ok ? res.value : null,
          name: d.name, chords: d.chords.length, colors: d.colors,
        };
      `);
      assert.strictEqual(shared.ok, true, `the app could not build its own share link: ${shared.reason}`);
      const hash = shared.url.slice(shared.url.indexOf("#s="));
      assert.strictEqual(hash.indexOf("#s="), 0, `no #s= payload in "${shared.url}"`);

      await b.eval(`try { localStorage.clear(); } catch (e) {} return true;`).catch(() => {});
      // A hash-only change from the SAME document is an in-page fragment
      // navigation in Chrome - no Page.loadEventFired, no fresh boot. A cache-
      // busting query forces a REAL navigation, which is the only case (Q30:
      // there is no hashchange listener) openShare() ever runs for.
      await navigate(`${URL}?share=${Date.now()}${hash}`);
      await b.waitFor(`document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`, {
        label: "deck chips to be built after the share link boots",
      });
      assert.strictEqual(await b.eval(`return window.innerWidth;`), 380,
        "the share link must boot at Q1's 380px width");

      const after = await b.eval(`
        const l = document.querySelector("#front .hdr .l");
        const clone = l ? l.cloneNode(true) : null;
        if (clone) clone.querySelectorAll(".num, .deg").forEach((el) => el.remove());
        const root = ${JSON.stringify(shared.colors.root.toLowerCase())};
        const tone = ${JSON.stringify(shared.colors.tone.toLowerCase())};
        // The diagram lives on whichever face is the ANSWER (mode-dependent -
        // #front in NOTES->NAME, #back in the default NAME->NOTES), so both
        // faces are checked rather than assuming which one currently shows it.
        const lit = [...document.querySelectorAll("#front .diagwrap circle, #back .diagwrap circle")].some((c) => {
          const s = (c.getAttribute("stroke") || "").toLowerCase();
          return s === root || s === tone;
        });
        return {
          name: clone ? clone.textContent.trim() : null,
          count: (document.getElementById("count").textContent || "").trim(),
          lit,
        };
      `);
      assert.strictEqual(after.name, shared.name,
        `the shared deck's name never reached the header ("${after.name}" vs "${shared.name}")`);
      assert.strictEqual(after.count, `1 / ${shared.chords}`,
        `the shared deck's chord count is wrong: "${after.count}"`);
      assert.strictEqual(after.lit, true,
        "no field in the diagram is lit after a fresh navigation to the share link");
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  /* Every deck - built-in or generated - prints through the same client-side
     PDF path and the same shared panel (one-pdf-path plan, lane M1's
     menu-shell move): there is no per-deck .prints any more, so a generated
     deck's card faces carry no print controls either. */
  test("print controls are never on a card face for a generated deck", async () => {
    await freshLoad();
    await generate(SIX_SCALES[1]);
    const faces = await b.eval(`
      return {
        front: !!document.querySelector("#front .prints, #front button, #front select"),
        back: !!document.querySelector("#back .prints, #back button, #back select"),
      };
    `);
    assert.strictEqual(faces.front, false, "the showing face carries a print control");
    assert.strictEqual(faces.back, false, "the hidden face carries a print control");
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
    await openSettingsPanel();
    // The anchor click is real, so the transfer is real unless it is refused.
    await b.send("Page.setDownloadBehavior", { behavior: "deny" }).catch(() => {});

    const cap = await b.eval(`
      return (async () => {
        const real = URL.createObjectURL;
        const seen = [];
        URL.createObjectURL = function (blob) { seen.push(blob); return real.call(URL, blob); };
        const btn = [...document.querySelectorAll("#settings-panel .prints button")]
          .find(el => el.textContent.trim() === "FULL DECK PDF");
        if (!btn) return { err: "no FULL DECK PDF button in the settings panel" };
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

  /* The generated-deck test above is the full pymupdf oracle (page count,
     page box, card-frame count, glyph count). This is the same claim - "a
     reader can open it" - run over a BUILT-IN deck, which as of the
     one-pdf-path plan goes through HPE.pdfdeck.fromBuiltin rather than
     fromGenerated. A lighter probe is enough here: the two code paths
     converge on the same pdfcards.build/pymupdf-verified renderer, and this
     test exists to catch fromBuiltin wiring - a missing/garbled overlay
     field, a bad geom.ext fallback - not to re-prove the renderer itself. */
  test("a built-in deck's FULL DECK PDF tap produces bytes that open as a PDF", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;
    const { spawnSync } = require("node:child_process");
    const os = require("node:os");

    await freshLoad();
    await openSettingsPanel();
    await b.send("Page.setDownloadBehavior", { behavior: "deny" }).catch(() => {});

    const cap = await b.eval(`
      return (async () => {
        const real = URL.createObjectURL;
        const seen = [];
        URL.createObjectURL = function (blob) { seen.push(blob); return real.call(URL, blob); };
        const btn = [...document.querySelectorAll("#settings-panel .prints button")]
          .find(el => el.textContent.trim() === "FULL DECK PDF");
        if (!btn) return { err: "no FULL DECK PDF button in the settings panel" };
        try { btn.click(); } finally { URL.createObjectURL = real; }
        if (seen.length !== 1) return { err: seen.length + " blobs, not 1" };
        const u8 = new Uint8Array(await seen[0].arrayBuffer());
        let s = "";
        for (let i = 0; i < u8.length; i += 4096) {
          s += String.fromCharCode.apply(null, u8.subarray(i, i + 4096));
        }
        return { type: seen[0].type, n: u8.length, b64: btoa(s) };
      })();`);

    assert.ok(!cap.err, cap.err);
    assert.strictEqual(cap.type, "application/pdf");
    assert.ok(cap.n > 10000, `the CTA produced ${cap.n} bytes; that is not a card sheet`);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "builtin-pdf-"));
    const pdf = path.join(dir, "deck.pdf");
    fs.writeFileSync(pdf, Buffer.from(cap.b64, "base64"));

    const probe = [
      "import sys, fitz",
      "d = fitz.open(sys.argv[1])",
      "assert d.page_count > 0, 'no pages'",
      "text = ''.join(p.get_text('text') for p in d)",
      "assert len(text) > 500, 'no text drawn: %d chars' % len(text)",
      "print('ok')",
    ].join("\n");

    let r;
    try {
      r = spawnSync("python3", ["-c", probe, pdf], { encoding: "utf8", timeout: 120000 });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    assert.strictEqual(r.status, 0,
      `the pymupdf probe failed (install pymupdf):\n${(r.stdout || "") + (r.stderr || "")}`);
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
        // Both scroll ends, reachable or not: a justify-content:center strip
        // (in place of the auto-margin end chips) centres a row that DOESN'T
        // fit exactly as one that does, stranding the first chip off the
        // left edge at scrollLeft 0 - the auto margins are what keep it
        // reachable once the row overflows.
        nav.scrollLeft = 0;
        const first = nav.firstElementChild.getBoundingClientRect();
        const atStart = first.left - navR.left;
        nav.scrollLeft = nav.scrollWidth;
        const last = nav.lastElementChild.getBoundingClientRect();
        const atEnd = navR.right - last.right;
        const maxScroll = nav.scrollLeft;
        nav.scrollLeft = 0;
        return {
          chips: chips.length,
          tops: [...new Set(chips.map(c => Math.round(c.getBoundingClientRect().top)))],
          rowScrolls: nav.scrollWidth > nav.clientWidth + 1,
          wraps: nav.scrollHeight > nav.clientHeight + 1,
          activeInView: on.left >= navR.left - 1 && on.right <= navR.right + 1,
          body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
          atStart: +atStart.toFixed(2), atEnd: +atEnd.toFixed(2), maxScroll,
        };
      `);
      // #decks holds deck chips only now (M2, 2026-09-28: "+ Add a scale"
      // moved into the settings panel) - three built-ins and six customs.
      assert.strictEqual(row.chips, 3 + 6, "three built-ins and six customs");
      assert.strictEqual(row.tops.length, 1, `the chip row wrapped onto ${row.tops.length} lines`);
      assert.strictEqual(row.wraps, false, "the chip row grew taller than one line");
      assert.strictEqual(row.rowScrolls, true, "nine chips at 380px should scroll horizontally");
      assert.strictEqual(row.activeInView, true, "the active chip is not scrolled into view");
      assert.ok(row.body.sw <= row.body.cw + 1, "the chip row blew the page out horizontally");
      assert.ok(row.atStart >= -1,
        `at scrollLeft 0 the first chip starts ${-row.atStart}px left of .decks - it is ` +
        `unreachable: ${JSON.stringify(row)}`);
      assert.ok(row.atEnd >= -1,
        `fully scrolled, the last chip still ends ${-row.atEnd}px past .decks' right edge: ` +
        `${JSON.stringify(row)}`);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  // "+ ADD is fully on-screen and hit-testable at phone widths" (row 1926,
  // pre-M2) retired 2026-09-28: it guarded + ADD's reachability as the
  // strip's own first chip, which could be scrolled off-screen at phone
  // widths. "+ Add a scale" now lives in the settings panel (M2), a fixed
  // dialog that is never subject to the deck strip's scroll/overflow at
  // all - the behaviour under test is gone, not merely relocated. Panel
  // reachability and on-screen fit are covered by "the settings panel fits
  // entirely on screen, with no clipping or scroll, at 320x568 and 844x390"
  // and by the 44px-target sweep below.

  test("the owner's journey at 380px: tap the settings trigger, add a scale, see the pan", async () => {
    await freshLoad();
    await b.setViewport(380, 800, true);
    try {
      await openSettingsPanel();
      await b.click("#deck-add");
      await b.waitFor(`!document.getElementById("scale-sheet").hasAttribute("hidden")`,
        { label: "the scale sheet to open from + ADD A SCALE at 380px" });
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

  // "no deck chip ever rests under + ADD..." (pre-M2) retired 2026-09-28:
  // it guarded a sticky-overlay regression specific to + ADD living in the
  // deck strip. "+ Add a scale" now lives in the settings panel (M2) and is
  // never drawn over the strip at all, so the regression class this test
  // hunted cannot recur; mutant e_add_chip_overlaps_strip is retired with it
  // (see PR body).


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
  // Lane M1: NAME<->NOTES moved behind the settings panel, so the reachable
  // header control in the collapsed landscape row is #settings-trigger, not
  // #modeA/#modeB directly - the mode buttons are covered by the settings
  // panel's own landscape-fit tests below. Lane M2, 2026-09-28: "+ Add a
  // scale" (#deck-add) moved into that same panel and is covered there too -
  // it is not part of the always-on chrome this matrix is about.
  const LANDSCAPE_CONTROLS = ["#settings-trigger", ".shuffle", ".count", "#prev", "#next"];

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

  /* Lane M1: #modeA/#modeB and the panel's print buttons/select are now
     behind the settings trigger. The panel's own scrim covers the rest of
     the page while it is open (by design - it is a modal), so the sweep
     runs in two passes: the panel's own stops with it OPEN (the same real
     interaction acceptance (12) requires), and everything else - Shuffle,
     prev/next, the deck strip - with it CLOSED, its normal resting state.
     #settings-trigger itself joins the sweep as the new persistent 44px
     header control. */
  const probeTargets = (sels) => b.eval(`
    const name = (el) => !el ? "null"
      : el === document.documentElement ? "html"
      : (el.id ? "#" + el.id : el.tagName.toLowerCase()) +
        (el.className && typeof el.className === "string" ? "." + el.className.trim().replace(/\\s+/g, ".") : "");
    const rows = [];
    const sels = ${JSON.stringify(sels)};
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

  test("the mode buttons and Shuffle are 44px tall and steal nothing from their neighbours",
    async () => {
      await freshLoad();
      await b.setViewport(390, 844, true);
      try {
        // The three under-sized controls, plus the ones that already pass:
        // a min-height that swallows a neighbour is the row-214 bug again.
        const resting = await probeTargets(
          ["#shuffle", "#prev", "#next", "#decks .chip"]);
        await openSettingsPanel();
        // #deck-add ("+ Add a scale", M2, 2026-09-28) lives in the panel now,
        // so it is measured here, with the panel open, alongside the other
        // panel-only controls.
        const inPanel = await probeTargets(
          ["#settings-trigger", "#modeA", "#modeB", "#modeS", "#deck-add",
           "#settings-panel .prints button", "#settings-panel .prints select"]);
        const probe = resting.concat(inPanel);
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
    // Re-measured 2026-09-28 (lane M1, menu-shell): the modebar row came out
    // of the header entirely (NAME<->NOTES moved into the settings panel),
    // so every row's chrome dropped again and the table was tightened onto
    // the new numbers. Portrait chrome 263.67 -> 225.67 (320x568: 262.67 ->
    // 227.67, the print row's own floor still applies there); landscape
    // chrome 251.67 -> 158.67, and the card at 844x390 is 100.16 -> 167.5px
    // wide, +67.3%.
    [390, 844, 343.19, 225.67],
    [390, 745, 342.69, 225.67],
    [375, 667, 306.81, 225.67],
    [320, 568, 246.44, 227.67],
    [844, 390, 167.50, 158.67],
    [926, 428, 195.02, 158.67],
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
      await generate(EDIT_SCALE);           // four chips, the owner's case (M2,
      // 2026-09-28: "+ Add a scale" moved out of the strip into the settings
      // panel, so it no longer contributes to the strip's measured width)
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

      // The positive claim, stated as a RELATIONSHIP rather than as a pixel
      // count: with "+ Add a scale" out of the strip (M2, 2026-09-28), a
      // custom deck's four chips now fit every landscape row in the budget
      // table, including the narrowest one that used to overflow by 21px
      // pre-M2 (611/590 at 667x375). Measured 2026-09-29: .decks
      // scrollWidth/clientWidth is 767/767 at 844x390, 849/849 at 926x428,
      // 590/590 at 667x375 and 1203/1203 at 1280x500 - every row fits with
      // room to spare, so the strip's overflow-x:auto scroll path is no
      // longer exercised by this configuration at all.
      //
      // Those pixel counts are font-metric dependent - a CI box without the
      // webfont measures different chips - so what is ASSERTED is the sign,
      // on every row: the strip fits. That is the claim this test now pins,
      // in place of the pre-M2 claim that the narrowest row still overflows.
      for (const row of ["844x390", "926x428", "667x375", "1280x500"]) {
        const m = seen[row];
        assert.ok(m.sw <= m.cw + 1,
          `at ${row} the deck strip no longer fits (${m.sw} > ${m.cw}), so a ` +
          "chip is reachable only by scrolling. With \"+ Add a scale\" out of " +
          "the strip (M2), every landscape row in the budget table should fit " +
          `a custom deck's four chips: ${JSON.stringify(seen, null, 2)}`);
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
              triggerOrder: getComputedStyle(document.getElementById("settings-trigger")).order,
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
  // assertion is always about #scale-generate. This used to need a fallback
  // scripted click at 844x390, where + ADD wrapped onto a second line that
  // #decks (overflow:auto) clipped. "+ Add a scale" now lives in the settings
  // panel (M2, 2026-09-28), a fixed dialog never subject to that clipping, so
  // opening it is a plain real tap through the panel at every fold viewport.
  const openSheetForFold = async (w, h) => {
    await openSettingsPanel();
    await b.click("#deck-add");
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
      await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, {
        label: "Escape to close the sheet",
      });
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
      // vv.scale updates as soon as setPageScaleFactor returns, but the
      // resize handler (applyKbOffset) that this test's negative asserts
      // depend on runs on the NEXT rendering step - a scale-only waitFor()
      // reads the surface before that handler has run and makes the negative
      // asserts vacuous (review B1, PR 143 attempt 1). Keep this one timed.
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
    assert.strictEqual(await activeId(), "settings-trigger",
      "Escape no longer returns focus to the settings trigger");

    await openSheet();
    await b.click("#scale-back");
    await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "BACK to close the sheet" });
    assert.strictEqual(await activeId(), "settings-trigger",
      "BACK no longer returns focus to the settings trigger");
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

    await openSettingsPanel();
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
    await openSettingsPanel();
    await b.click("#modeB");
    await b.waitFor(`document.getElementById("modeB").classList.contains("on")`,
      { label: "mode B to become active" });
    check(await readCard(), "in NOTES -> NAME");
  });

  /* ---------------------------------------------------------------- *
   * page background covers every viewport (lane A, android-bg-and-menu
   * plan 2026-09-28)
   *
   * Nothing the page controls may paint anything but the table colour at
   * any viewport size. The candidates that CDP can see: theme-color/
   * color-scheme meta (app.test.js sandbox test owns those, since they are
   * <head> text, not layout), html's own background-color, and the print
   * hardening. The URL-bar-collapse band and the gesture-bar area are
   * DEVICE-GATE (plan §2 A4/A5, §7) - CDP's setViewport relays the page out
   * before any capture, so no unpainted band ever exists to photograph.
   * ---------------------------------------------------------------- */
  describe("page background covers every viewport", () => {
    const MATRIX = [
      [360, 800, "portrait"],
      [412, 915, "portrait"],
      [390, 844, "portrait"],
      [320, 568, "portrait"],
      [915, 412, "landscape"],
      [844, 390, "landscape"],
      [673, 841, "foldable unfolded"],
      [800, 1280, "tablet"],
      [1280, 800, "desktop"],
    ];

    const TABLE = [26, 24, 21];   // #1a1815
    const TABLE2 = [38, 34, 28];  // #26221c
    const FRAME = 4;              // outer pixel frame width to sample

    // Renders the CURRENT page to a real PNG via CDP, then decodes it back to
    // pixels entirely in-browser (an <img> onto a <canvas>) so no PNG decoder
    // needs writing on the Node side - the browser already has one.
    //
    // `tol` is deliberately different per job:
    //  - matrix rows and the sheet-open row only need to reject white and
    //    off-palette pixels; the real render's gradient midpoint measures a
    //    stable max of ~8.37 at every size, so a wide tolerance (~20) leaves
    //    plenty of headroom against rendering drift without risking a false
    //    pass on an actually-wrong colour.
    //  - the gradient-removed row is the one that must tell a real render
    //    (measured ~3.0 from --table) apart from Chromium's OWN
    //    color-scheme:dark canvas default (rgb(18,18,18), used when nothing
    //    paints a background at all; ~10.4 from --table, ~12.08 measured
    //    under the ab_root_bg_dropped mutant) - so it needs a tight
    //    tolerance (~5) that sits strictly between those two numbers.
    async function edgeCheck(tol) {
      const shot = await b.send("Page.captureScreenshot", { format: "png" });
      return b.eval(`
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const w = img.width, h = img.height;
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, w, h).data;
            const table = ${JSON.stringify(TABLE)};
            const table2 = ${JSON.stringify(TABLE2)};
            const dist = (r, g, bch, t) =>
              Math.sqrt((r - t[0]) ** 2 + (g - t[1]) ** 2 + (bch - t[2]) ** 2);
            let bad = null;
            const check = (x, y) => {
              if (bad || x < 0 || y < 0 || x >= w || y >= h) return;
              const i = (y * w + x) * 4;
              const r = data[i], g = data[i + 1], bch = data[i + 2];
              if (Math.min(dist(r, g, bch, table), dist(r, g, bch, table2)) > ${tol}) {
                bad = { x, y, r, g, b: bch };
              }
            };
            for (let x = 0; x < w; x++) {
              for (let f = 0; f < ${FRAME}; f++) { check(x, f); check(x, h - 1 - f); }
            }
            for (let y = 0; y < h; y++) {
              for (let f = 0; f < ${FRAME}; f++) { check(f, y); check(w - 1 - f, y); }
            }
            resolve({ w, h, bad });
          };
          img.onerror = () => reject(new Error("screenshot PNG failed to decode"));
          img.src = "data:image/png;base64,${shot.data}";
        });
      `);
    }

    for (const [vw, vh, label] of MATRIX) {
      test(`${label} ${vw}x${vh}: outer 4px frame is table-coloured, never white`, async () => {
        await freshLoad();
        try {
          await b.setViewport(vw, vh, true);
          await b.settle();
          const r = await edgeCheck(20);
          assert.strictEqual(r.bad, null,
            `edge pixel not table-coloured at ${vw}x${vh}: ${JSON.stringify(r.bad)}`);
        } finally {
          await b.setViewport(900, 900, false);
        }
      });
    }

    test("with the scale sheet open, the outer frame stays table-coloured", async () => {
      await freshLoad();
      try {
        await b.setViewport(390, 844, true);
        await openSheet();
        await b.settle();
        const r = await edgeCheck(20);
        assert.strictEqual(r.bad, null,
          `edge pixel not table-coloured with the sheet open: ${JSON.stringify(r.bad)}`);
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    // Simulates an unpainted body gradient (a real frame before the image has
    // painted, or mid-resize). This is the one row that MUST fail at
    // 879499d, because that base has no colour under the gradient - only
    // A3's html{background-color:var(--table)} rescues it. This is what
    // kills ab_root_bg_dropped.
    test("with body's gradient image removed, the outer frame still stays table-coloured", async () => {
      await freshLoad();
      try {
        await b.setViewport(390, 844, true);
        await b.eval(`document.body.style.backgroundImage = "none"; return true;`);
        await b.settle();
        const r = await edgeCheck(5);
        assert.strictEqual(r.bad, null,
          `edge pixel not table-coloured with body's gradient removed: ${JSON.stringify(r.bad)}`);
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("documentElement computes color-scheme: dark", async () => {
      await freshLoad();
      const scheme = await b.eval(
        `return getComputedStyle(document.documentElement).colorScheme;`);
      assert.strictEqual(scheme, "dark");
    });

    test("html's computed background-color is the table colour", async () => {
      await freshLoad();
      const bg = await b.eval(
        `return getComputedStyle(document.documentElement).backgroundColor;`);
      assert.strictEqual(bg, "rgb(26, 24, 21)");
    });

    test("under print media, html computes to a white background", async () => {
      await freshLoad();
      try {
        await b.send("Emulation.setEmulatedMedia", { media: "print" });
        const bg = await b.eval(
          `return getComputedStyle(document.documentElement).backgroundColor;`);
        assert.strictEqual(bg, "rgb(255, 255, 255)");
      } finally {
        await b.send("Emulation.setEmulatedMedia", { media: "" });
      }
    });
  });

  /* ---------------------------------------------------------------- *
   * desktop sidebar (M3, 2026-09-28 follow-up plan: docs/plans/
   * 2026-09-28-android-bg-and-menu.md, S2 Part B / S3 M3 row / S6 O6 /
   * the "Addendum: M3 desktop sidebar")
   *
   * At >=1024x700 the same #settings-panel markup M1 built presents as a
   * static, always-visible, non-modal sidebar column instead of a modal
   * drawer: the trigger and scrim disappear, and openPanel()/closePanel()'s
   * role=dialog/aria-modal/inert/aria-hidden/Tab-trap wiring is never
   * reached because the only thing that calls openPanel() - a click on
   * #settings-trigger - cannot happen on a display:none element. Below the
   * breakpoint the M1/M2 hamburger + modal panel is unchanged; that is
   * covered above, this block only adds the desktop-only behaviour.
   * ---------------------------------------------------------------- */
  describe("desktop sidebar", () => {
    // .scene rect measured against the base this lane built on (ed38ff5,
    // PR #155 merge, the tip main pointed to when this lane started) with a
    // throwaway script driving tests/helpers/cdp.js against that commit's
    // index.html. The sidebar CSS is position:fixed, which removes it from
    // flow, so these numbers are the acceptance oracle for "the sidebar
    // must not shrink main or the card" - a regression that put the panel
    // back in flow would move them.
    const BASE_SCENE = {
      "1280x800": { width: 367.984375, height: 508.1875, left: 456, right: 823.984375, top: 153.0625, bottom: 661.25 },
      "1024x768": { width: 353.265625, height: 487.859375, left: 335.359375, right: 688.625, top: 147.234375, bottom: 635.09375 },
    };

    async function sceneRect() {
      return b.eval(`
        const r = document.querySelector(".scene").getBoundingClientRect();
        return { width: r.width, height: r.height, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      `);
    }

    test("at 1280x800 and 1024x768 the panel is a static, non-modal sidebar", async () => {
      await freshLoad();
      try {
        for (const [w, h] of [[1280, 800], [1024, 768]]) {
          await b.setViewport(w, h, false);
          await b.settle();
          const st = await b.eval(`return {
            trigger: getComputedStyle(document.getElementById("settings-trigger")).display,
            scrim: getComputedStyle(document.getElementById("settings-scrim")).display,
            panelDisplay: getComputedStyle(document.getElementById("settings-panel")).display,
            role: document.getElementById("settings-panel").getAttribute("role"),
            ariaModal: document.getElementById("settings-panel").getAttribute("aria-modal"),
            headerInert: document.querySelector("header").inert,
            mainInert: document.querySelector("main").inert,
            footerInert: document.querySelector("footer").inert,
            decksInert: document.getElementById("decks").inert,
            headerAH: document.querySelector("header").getAttribute("aria-hidden"),
            mainAH: document.querySelector("main").getAttribute("aria-hidden"),
            footerAH: document.querySelector("footer").getAttribute("aria-hidden"),
            decksAH: document.getElementById("decks").getAttribute("aria-hidden"),
          };`);
          assert.strictEqual(st.trigger, "none", `${w}x${h}: #settings-trigger should be display:none`);
          assert.strictEqual(st.scrim, "none", `${w}x${h}: #settings-scrim should be display:none`);
          assert.notStrictEqual(st.panelDisplay, "none", `${w}x${h}: the sidebar should be visible`);
          assert.strictEqual(st.role, null, `${w}x${h}: the sidebar must not carry role=dialog`);
          assert.strictEqual(st.ariaModal, null, `${w}x${h}: the sidebar must not carry aria-modal`);
          const bg = { header: [st.headerInert, st.headerAH], main: [st.mainInert, st.mainAH],
                       footer: [st.footerInert, st.footerAH], decks: [st.decksInert, st.decksAH] };
          for (const [k, [inert, ah]] of Object.entries(bg)) {
            assert.strictEqual(inert, false, `${w}x${h}: ${k} must not be inert`);
            assert.strictEqual(ah, null, `${w}x${h}: ${k} must not be aria-hidden`);
          }
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("the card rect at 1280x800 and 1024x768 matches the pre-sidebar base measurement", async () => {
      await freshLoad();
      try {
        for (const [key, [w, h]] of Object.entries({ "1280x800": [1280, 800], "1024x768": [1024, 768] })) {
          await b.setViewport(w, h, false);
          await b.settle();
          const got = await sceneRect();
          const base = BASE_SCENE[key];
          for (const prop of ["width", "height", "left", "right", "top", "bottom"]) {
            assert.ok(Math.abs(got[prop] - base[prop]) <= 0.5,
              `${key} .scene ${prop}: got ${got[prop]}, base (ed38ff5) ${base[prop]}`);
          }
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    // The sidebar-tightening query (index.html's "narrow-height budget" rule,
    // max-height:745px) exists for 1024x700 alone, which has no spare room
    // once the Difficulty group's forced two-row tier bar is counted;
    // 1280x800 is outside that bound and must keep the panel's default,
    // untightened spacing - the same values it had before this lane's work:
    // panel gap/padding from the base --sp-3/--sp-4 ramp at >=640px width/
    // >=700px height, and each .panel-group's own heading-to-control gap
    // from its untightened --sp-1.
    test("at 1280x800 the sidebar keeps its default (untightened) spacing", async () => {
      await freshLoad();
      try {
        await b.setViewport(1280, 800, false);
        await b.settle();
        const m = await b.eval(`
          const panel = document.getElementById("settings-panel");
          const cs = getComputedStyle(panel);
          const headings = [...panel.querySelectorAll(".panel-heading")];
          const practiceHeading = headings.find(h => h.textContent.trim() === "Practice");
          const modeA = document.getElementById("modeA");
          return {
            gap: cs.gap, padding: cs.padding,
            headingToControlGap: modeA.getBoundingClientRect().top - practiceHeading.getBoundingClientRect().bottom,
          };
        `);
        assert.strictEqual(m.gap, "20px", "1280x800: panel gap must equal the untightened --sp-3 ramp value");
        assert.strictEqual(m.padding, "28px 20px", "1280x800: panel padding must equal the untightened --sp-4/--sp-3 ramp values");
        assert.ok(Math.abs(m.headingToControlGap - 6) <= 1,
          `1280x800: heading-to-control gap should be the untightened .panel-group --sp-1 (6px), got ${m.headingToControlGap}`);
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("at 1280x800, ArrowRight steps the counter and Enter flips the card", async () => {
      await freshLoad();
      try {
        await b.setViewport(1280, 800, false);
        await b.settle();
        const meta = await decksMeta();
        const n = meta[0].chords;
        await expectCount(`1 / ${n}`, "starts on the first card at desktop");

        await b.key("ArrowRight", "ArrowRight", 39);
        await expectCount(`2 / ${n}`, "ArrowRight steps the counter at desktop");

        const flippedBefore = await cardFlipped();
        await b.eval(`document.getElementById("card").focus(); return true;`);
        await b.key("Enter", "Enter", 13);
        await b.settle();
        const flippedAfter = await cardFlipped();
        assert.notStrictEqual(flippedAfter, flippedBefore, "Enter did not flip the card at desktop");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("the sidebar's FULL DECK and CHORD-ONLY buttons produce a PDF blob", async () => {
      await freshLoad();
      try {
        await b.setViewport(1280, 800, false);
        await b.settle();
        for (const label of ["FULL DECK PDF", "CHORD-ONLY PDF"]) {
          const cap = await b.eval(`
            return (async () => {
              const real = URL.createObjectURL;
              const seen = [];
              URL.createObjectURL = function (blob) { seen.push(blob); return real.call(URL, blob); };
              const btn = [...document.querySelectorAll("#settings-panel .prints button")]
                .find(el => el.textContent.trim() === ${JSON.stringify(label)});
              if (!btn) return { err: "no " + ${JSON.stringify(label)} + " button in the sidebar" };
              try { btn.click(); } finally { URL.createObjectURL = real; }
              if (seen.length !== 1) return { err: seen.length + " blobs, not 1" };
              return { type: seen[0].type, n: seen[0].size };
            })();`);
          assert.ok(!cap.err, cap.err);
          assert.strictEqual(cap.type, "application/pdf", `${label}: wrong blob type`);
          assert.ok(cap.n > 10000, `${label}: produced ${cap.n} bytes; that is not a card sheet`);
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("below the breakpoint the hamburger behaviour is unchanged", async () => {
      await freshLoad();
      try {
        for (const [w, h, mobile] of [[1023, 800, false], [844, 390, true], [390, 844, true]]) {
          await b.setViewport(w, h, mobile);
          await b.settle();
          const st = await b.eval(`return {
            trigger: getComputedStyle(document.getElementById("settings-trigger")).display,
            panelDisplay: getComputedStyle(document.getElementById("settings-panel")).display,
            panelHidden: document.getElementById("settings-panel").hidden,
          };`);
          assert.strictEqual(st.trigger, "flex", `${w}x${h}: the hamburger trigger should be visible`);
          assert.strictEqual(st.panelHidden, true, `${w}x${h}: the panel should start hidden`);
          assert.strictEqual(st.panelDisplay, "none", `${w}x${h}: the panel should not render`);
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("resizing across the breakpoint with the panel open sheds modal state, and resizing back shows the closed hamburger", async () => {
      await freshLoad();
      try {
        await b.setViewport(900, 800, false);
        await openSettingsPanel();
        let st = await b.eval(`return {
          role: document.getElementById("settings-panel").getAttribute("role"),
          mainInert: document.querySelector("main").inert,
        };`);
        assert.strictEqual(st.role, "dialog", "sanity: the panel should be modal below the breakpoint");
        assert.strictEqual(st.mainInert, true, "sanity: main should be inert while the modal panel is open");

        await b.setViewport(1280, 800, false);
        await b.settle();
        st = await b.eval(`return {
          role: document.getElementById("settings-panel").getAttribute("role"),
          ariaModal: document.getElementById("settings-panel").getAttribute("aria-modal"),
          headerInert: document.querySelector("header").inert,
          mainInert: document.querySelector("main").inert,
          footerInert: document.querySelector("footer").inert,
          decksInert: document.getElementById("decks").inert,
          headerAH: document.querySelector("header").getAttribute("aria-hidden"),
          mainAH: document.querySelector("main").getAttribute("aria-hidden"),
          footerAH: document.querySelector("footer").getAttribute("aria-hidden"),
          decksAH: document.getElementById("decks").getAttribute("aria-hidden"),
          scrimDisplay: getComputedStyle(document.getElementById("settings-scrim")).display,
          expanded: document.getElementById("settings-trigger").getAttribute("aria-expanded"),
          active: document.activeElement ? {
            id: document.activeElement.id, tag: document.activeElement.tagName,
            connected: document.activeElement.isConnected, inert: document.activeElement.inert,
            visible: getComputedStyle(document.activeElement).display !== "none",
          } : null,
        };`);
        assert.strictEqual(st.role, null, "role=dialog must be shed on resize to desktop");
        assert.strictEqual(st.ariaModal, null, "aria-modal must be shed on resize to desktop");
        const bg = { header: [st.headerInert, st.headerAH], main: [st.mainInert, st.mainAH],
                     footer: [st.footerInert, st.footerAH], decks: [st.decksInert, st.decksAH] };
        for (const [k, [inert, ah]] of Object.entries(bg)) {
          assert.strictEqual(inert, false, `${k} must not be inert after resizing to desktop`);
          assert.strictEqual(ah, null, `${k} must not be aria-hidden after resizing to desktop`);
        }
        assert.strictEqual(st.scrimDisplay, "none", "the scrim must not be visible at desktop");
        assert.strictEqual(st.expanded, "false", "the trigger's aria-expanded must come back to false");
        assert.ok(st.active, "focus must land somewhere");
        assert.strictEqual(st.active.connected, true, "focus must be on a connected element");
        assert.strictEqual(st.active.inert, false, "focus must not be on an inert element");
        assert.strictEqual(st.active.visible, true, "focus must be on a visible element");
        // Reviewer finding N4: <body> passes all three checks above (it is
        // connected, never inert, and always "visible"), so it slipped past
        // this test even though it means the trigger's own settingsTrigger.focus()
        // call in closePanel() silently failed (the trigger is display:none
        // at this width) and nobody re-homed focus onto a live control.
        assert.notStrictEqual(st.active.tag, "BODY",
          "focus must not be stranded on <body> after resizing to desktop with the panel open");
        // Reviewer finding Q20 (round-2, 2026-09-29): stillLive's own
        // getComputedStyle(a).display !== "none" clause is what tells apart
        // an element that is *connected but no longer rendered* (the trigger,
        // mid-transition to display:none) from one that is actually still a
        // usable focus target - "not <body>" and "isConnected" alone both
        // stay true for a display:none element right up until the browser
        // gets around to blurring it. Pin the concrete, positive outcome the
        // display check exists to guarantee: re-homed focus lands
        // specifically on the card, not merely "somewhere that isn't body".
        assert.strictEqual(st.active.id, "card",
          "focus must be re-homed onto the card after resizing to desktop with the panel open");

        await b.setViewport(900, 800, false);
        await b.settle();
        st = await b.eval(`return {
          panelHidden: document.getElementById("settings-panel").hidden,
          panelDisplay: getComputedStyle(document.getElementById("settings-panel")).display,
          expanded: document.getElementById("settings-trigger").getAttribute("aria-expanded"),
        };`);
        assert.strictEqual(st.panelHidden, true, "resizing back down should show the closed hamburger state");
        assert.strictEqual(st.panelDisplay, "none", "resizing back down should show the closed hamburger state");
        assert.strictEqual(st.expanded, "false", "resizing back down should show the closed hamburger state");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    // Reviewer finding Q20 (round-2, 2026-09-29): the desktopMQ change
    // handler's own comment explains that document.activeElement is STILL
    // the (about-to-be-hidden) trigger at the moment the listener runs, and
    // only becomes <body> on a LATER, separate tick - stillLive's
    // `getComputedStyle(a).display !== "none"` clause exists to catch
    // exactly that tick. A real CDP viewport resize does not reproduce it
    // reliably (this harness's own resize already lands on <body> by the
    // time any script can observe it, a timing quirk of headless Chrome
    // under CDP's Emulation domain, not the real-window-resize path the
    // comment describes) - so simulate the tick directly instead of racing
    // it: shadow `document.activeElement` for exactly one read (the
    // listener's own) to return the still-focused, now-hidden trigger, then
    // fall back to the real accessor immediately after. This is
    // deterministic and exercises the exact branch the display check
    // guards, independent of how fast or slow any given browser actually
    // performs the native blur-to-body step.
    test("stillLive's display check re-homes focus when the trigger is still active but already hidden", async () => {
      await freshLoad();
      try {
        await b.setViewport(900, 800, false);
        await openSettingsPanel();
        await b.eval(`
          const trigger = document.getElementById("settings-trigger");
          let armed = true;
          Object.defineProperty(document, "activeElement", {
            configurable: true,
            get() {
              if (armed) { armed = false; delete document.activeElement; return trigger; }
              return document.body;
            }
          });
          return true;
        `);
        await b.setViewport(1280, 800, false);
        await b.settle();
        const active = await b.eval(`return {
          id: document.activeElement.id, tag: document.activeElement.tagName,
        };`);
        assert.strictEqual(active.id, "card",
          "focus must be re-homed onto the card when the change listener still observes the (now-hidden) trigger as active");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("the sidebar never overlaps the card or the footer controls", async () => {
      await freshLoad();
      try {
        for (const [w, h] of [[1024, 700], [1920, 1080]]) {
          await b.setViewport(w, h, false);
          await b.settle();
          const rects = await b.eval(`
            const rr = (sel) => document.querySelector(sel).getBoundingClientRect();
            const r = (x) => ({ left: x.left, right: x.right, top: x.top, bottom: x.bottom });
            return { scene: r(rr(".scene")), footer: r(rr("footer")), panel: r(rr("#settings-panel")) };
          `);
          const disjoint = (a, c) => a.right <= c.left || c.right <= a.left || a.bottom <= c.top || c.bottom <= a.top;
          assert.ok(disjoint(rects.scene, rects.panel),
            `${w}x${h}: the sidebar overlaps the card: ${JSON.stringify(rects)}`);
          assert.ok(disjoint(rects.footer, rects.panel),
            `${w}x${h}: the sidebar overlaps the footer: ${JSON.stringify(rects)}`);
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    // Reviewer finding Q19 (round-2, 2026-09-29): the desktop-only header
    // max-width rule (line ~265) REPLACES the base rule's min(92vw,900px)
    // ceiling with a calc() that has no upper bound of its own, so at wide
    // viewports (1920x1080: calc gives 1400px) the header runs far past the
    // 900px cap the base rule exists to enforce.
    test("at 1920x1080 the header stays within its 900px ceiling", async () => {
      await freshLoad();
      try {
        await b.setViewport(1920, 1080, false);
        await b.settle();
        const width = await b.eval(`return document.querySelector("header").getBoundingClientRect().width;`);
        assert.ok(width <= 900.5, `header width at 1920x1080 should be <= 900px, got ${width}`);
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("every panel control is 44px tall in the sidebar presentation too", async () => {
      await freshLoad();
      try {
        await b.setViewport(1280, 800, false);
        await b.settle();
        const probe = await probeTargets(
          ["#modeA", "#modeB", "#deck-add",
           "#settings-panel .prints button", "#settings-panel .prints select",
           "#res-handpaner", "#res-dingandtones", "#res-trainingcards"]);
        const short = probe.filter((p) => !p.missing && p.h < 44);
        const stolen = probe.filter((p) => !p.missing && p.bad.length);
        assert.deepStrictEqual(probe.filter((p) => p.missing), []);
        assert.deepStrictEqual(short.map((p) => `${p.sel} ${p.w}x${p.h}`), [],
          "interactive controls under the 44px minimum in the desktop sidebar");
        assert.deepStrictEqual(stolen.map((p) => `${p.sel}: ${p.bad.join(", ")}`), [],
          "a control's own box hit-tests to something else in the desktop sidebar");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    // Reviewer finding F1: the header only widens to min(92vw,900px) (line
    // ~164); at 1024-1280px that right edge sits UNDER the 240px sidebar, so
    // a deck strip with enough chips to actually reach that edge (built-ins
    // alone never do) gets its last chips hidden under the sidebar instead of
    // scrolled into view.
    test("the deck-chip strip stays clear of the sidebar with several custom decks", async () => {
      await freshLoad();
      try {
        for (const s of SIX_SCALES.slice(0, 4)) await generate(s);
        for (const [w, h] of [[1024, 768], [1280, 800]]) {
          await b.setViewport(w, h, false);
          await b.settle();
          const rects = await b.eval(`
            const rr = (sel) => document.querySelector(sel).getBoundingClientRect();
            const r = (x) => ({ left: x.left, right: x.right, top: x.top, bottom: x.bottom });
            return { decks: r(rr("#decks")), panel: r(rr("#settings-panel")) };
          `);
          const disjoint = (a, c) => a.right <= c.left || c.right <= a.left || a.bottom <= c.top || c.bottom <= a.top;
          assert.ok(disjoint(rects.decks, rects.panel),
            `${w}x${h}: the deck strip overlaps the sidebar: ${JSON.stringify(rects)}`);

          // Scroll the strip to its end and confirm the last chip is actually
          // reachable at its own centre point, not merely off to the side
          // under the sidebar (the bug: elementFromPoint there returns #modeA).
          const hit = await b.eval(`
            const strip = document.getElementById("decks");
            strip.scrollLeft = strip.scrollWidth;
            const chips = strip.querySelectorAll(".chip");
            const last = chips[chips.length - 1];
            const r = last.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const el = document.elementFromPoint(cx, cy);
            return { hitId: el && el.id, hitsLast: !!(el === last || (el && last.contains(el))) };
          `);
          assert.ok(hit.hitsLast,
            `${w}x${h}: the last deck chip is not hit-testable after scrolling to it (hit ${hit.hitId})`);
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    // Reviewer finding F2: addChip.onclick always passes settingsTrigger as
    // the opener; the trigger is display:none on desktop, so hideSheet()'s
    // sheetOpener.focus() silently fails and focus is stranded on <body>.
    test("focus lands on a live control after the add-scale sheet closes, on desktop, not <body>", async () => {
      await freshLoad();
      try {
        await b.setViewport(1280, 800, false);
        await b.settle();

        // Generate path: focus should land on the new deck's chip.
        await openSheet();
        await typeScale(SIX_SCALES[0]);
        await b.click("#scale-generate");
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
          { label: "the sheet to close after Generate" });
        let a = await b.eval(`return {
          tag: document.activeElement.tagName,
          isChip: !!(document.activeElement.classList && document.activeElement.classList.contains("chip")),
        };`);
        assert.notStrictEqual(a.tag, "BODY", "focus fell to <body> after Generate on desktop");
        assert.ok(a.isChip, "focus should land on the new deck's chip after Generate on desktop");

        // Escape path: focus should return to #deck-add, which is now the
        // visible, focusable opener on desktop (unlike the hidden trigger).
        await openSheet();
        await b.key("Escape", "Escape", 27);
        await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
          { label: "the sheet to close after Escape" });
        assert.strictEqual(await activeId(), "deck-add",
          "focus should return to #deck-add after Escape on desktop");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    // Reviewer finding F3: the sidebar (z-index 41, the same value the below-
    // breakpoint modal panel uses) draws OVER the full-screen #scale-sheet
    // (z-index 30) when the sheet is open on desktop.
    test("the add-scale sheet covers the sidebar when open on desktop", async () => {
      await freshLoad();
      try {
        await b.setViewport(1280, 800, false);
        await b.settle();
        await openSheet();
        // Note: elementFromPoint is unusable here -- showSheet()'s own
        // background-inerting loop marks #settings-panel inert while the
        // sheet is open, and inert elements are skipped during hit-testing
        // regardless of their actual paint order. Compare z-index directly.
        const z = await b.eval(`
          return {
            panel: parseInt(getComputedStyle(document.getElementById("settings-panel")).zIndex, 10),
            sheet: parseInt(getComputedStyle(document.getElementById("scale-sheet")).zIndex, 10),
          };
        `);
        assert.ok(z.panel < z.sheet,
          `the sidebar's z-index (${z.panel}) must be below the sheet's (${z.sheet}) so the sheet visually covers it while open`);
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    // Reviewer finding N3: the document keydown handler's final ArrowRight/
    // ArrowLeft branch only checks sheetOpen/panelOpen, and the desktop
    // sidebar never sets panelOpen=true (it is never "opened"), so a native
    // <select> inside it gets its own arrow-key behaviour DOUBLED by the
    // global card-step shortcut.
    test("arrow keys typed into a sidebar form control do not also step the card", async () => {
      await freshLoad();
      try {
        await b.setViewport(1280, 800, false);
        await b.settle();
        const meta = await decksMeta();
        const n = meta[0].chords;
        await expectCount(`1 / ${n}`, "starts on the first card at desktop");
        await b.eval(`document.getElementById("print-paper-select").focus(); return true;`);
        await b.key("ArrowRight", "ArrowRight", 39);
        await b.settle();
        await expectCount(`1 / ${n}`,
          "ArrowRight typed into the sidebar's paper select must not also step the card");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    // Reviewer finding Q18 (round-2, 2026-09-29): the guard above used to
    // return early for ANY target inside #settings-panel, not just form
    // controls, so at desktop, after a mouse click on a plain sidebar
    // button (#modeB), the *next* ArrowRight was silently swallowed even
    // though a <button> has no native arrow-key behaviour to protect
    // against doubling.
    test("at 1280x800, ArrowRight steps the card after a click on a sidebar button", async () => {
      await freshLoad();
      try {
        await b.setViewport(1280, 800, false);
        await b.settle();
        const meta = await decksMeta();
        const n = meta[0].chords;
        await expectCount(`1 / ${n}`, "starts on the first card at desktop");
        await b.click("#modeB");
        await b.key("ArrowRight", "ArrowRight", 39);
        await expectCount(`2 / ${n}`,
          "ArrowRight after clicking a sidebar button (#modeB) must still step the card");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    // Reviewer finding N1: the breakpoint is written twice - once in the CSS
    // media query, once in desktopMQ's own matchMedia() string - and nothing
    // asserted they still agree at a width close enough to the line that a
    // drift in either one would show up. 1050x800 is the tell: the CSS
    // (min-width:1024px) already presents the sidebar there, but a JS
    // threshold that had drifted upward (e.g. to 1100px) would still believe
    // it is below the breakpoint and would never run closePanel() on the
    // matchMedia change - leaving main/header/#decks stuck inert under a
    // sidebar that otherwise looks correct. 1023x800 is the sibling check
    // that the two thresholds also agree just below the line.
    test("the CSS breakpoint and desktopMQ agree at 1050x800 and 1023x800", async () => {
      await freshLoad();
      try {
        await b.setViewport(900, 800, false);
        await openSettingsPanel();
        let st = await b.eval(`return { role: document.getElementById("settings-panel").getAttribute("role") };`);
        assert.strictEqual(st.role, "dialog", "sanity: the panel should be modal below the breakpoint");

        await b.setViewport(1050, 800, false);
        await b.settle();
        st = await b.eval(`return {
          triggerDisplay: getComputedStyle(document.getElementById("settings-trigger")).display,
          role: document.getElementById("settings-panel").getAttribute("role"),
          ariaModal: document.getElementById("settings-panel").getAttribute("aria-modal"),
          mainInert: document.querySelector("main").inert,
        };`);
        assert.strictEqual(st.triggerDisplay, "none", "1050x800: the CSS says desktop, the trigger should be hidden");
        assert.strictEqual(st.role, null,
          "1050x800: modal state must be shed - the JS breakpoint must agree with the CSS one");
        assert.strictEqual(st.ariaModal, null, "1050x800: aria-modal must be shed at 1050x800");
        assert.strictEqual(st.mainInert, false, "1050x800: main must not be stuck inert");

        await b.setViewport(1023, 800, false);
        await b.settle();
        st = await b.eval(`return {
          triggerDisplay: getComputedStyle(document.getElementById("settings-trigger")).display,
          panelDisplay: getComputedStyle(document.getElementById("settings-panel")).display,
        };`);
        assert.strictEqual(st.triggerDisplay, "flex", "1023x800: below the breakpoint, the trigger should be visible");
        assert.strictEqual(st.panelDisplay, "none",
          "1023x800: below the breakpoint, the closed panel should not render");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });
  });

  // Reviewer FAIL #3 (bounce 4): every test above measures FALLBACK font
  // metrics - launch()'s default blocks fonts.googleapis.com/gstatic.com
  // outright (see tests/helpers/cdp.js's comment) so runs are deterministic
  // offline, but that means the panel-fit math above was only ever verified
  // against a generic serif/sans-serif, never the real Marcellus/Bitter/
  // Nunito Sans the app actually ships. A SEPARATE browser (`rb`), launched
  // with `{ realFonts: true }`, serves the TTFs already checked into
  // tools/fonts/ as local @font-face data URIs instead - no network, no
  // second hop to fonts.gstatic.com. Kept to its own describe/before/after
  // rather than swapping the shared `b` so the rest of the suite keeps
  // measuring the fast, deterministic fallback metrics it was written
  // against; only the handful of cells reviewer #3 actually measured with
  // real fonts are re-checked here.
  describe("real fonts (reviewer FAIL #3 panel overflow)", () => {
    let rb = null;
    before(async () => {
      rb = await launch({ realFonts: true });
      assert.ok(rb, "browser found by findBrowser() but launch({ realFonts: true }) returned null");
      await rb.goto(URL);
      // Fonts load async even once request-intercepted; document.fonts.ready
      // is the one correct wait - a fixed sleep would be timing-dependent and
      // settle() only waits on WAAPI/CSS animations, not font loading.
      await rb.eval(`return document.fonts.ready.then(() => true);`);
    });
    after(async () => { if (rb) await rb.close(); });

    async function panelOverflow(w, h, mode, mobile) {
      await rb.setViewport(w, h, mobile);
      await rb.settle();
      if (mobile) {
        await rb.click("#settings-trigger");
        await rb.waitFor(`getComputedStyle(document.getElementById("settings-panel")).display !== "none"`,
          { label: "panel open" });
      }
      await rb.click(`#mode${mode}`);
      if (mobile) {
        await rb.waitFor(`document.getElementById("settings-panel").hidden === true`,
          { label: "panel close after mode" });
        await rb.click("#settings-trigger");
        await rb.waitFor(`getComputedStyle(document.getElementById("settings-panel")).display !== "none"`,
          { label: "panel reopen" });
      }
      await rb.settle();
      const m = await rb.eval(`
        const p = document.getElementById("settings-panel");
        const resIds = ["res-handpaner", "res-dingandtones", "res-trainingcards"];
        return {
          scrollH: p.scrollHeight, clientH: p.clientHeight,
          resVisible: resIds.every(id => {
            const el = document.getElementById(id);
            return el && el.getClientRects().length > 0;
          }),
        };
      `);
      if (mobile) {
        await rb.click("#settings-trigger");
        await rb.waitFor(`getComputedStyle(document.getElementById("settings-panel")).display === "none"`,
          { label: "panel close for next case" });
      }
      return m;
    }

    // The desktop sidebar cells reviewer #3 measured with real fonts:
    // 1024/1280 wide, heights 746-760 (overflow +16px->+2px under the OLD
    // max-height:745px bound), plus the three named width/height pairs that
    // showed +12px at the same underlying cause (the bound never reached
    // real fonts' own 762px exact-fit). Widened to 765px, every one of these
    // is a real-font exact fit (0px overflow) - see index.html's "narrow-
    // height budget" comment for the measurement this bound is now based on.
    test("the desktop sidebar has no vertical scroll under REAL fonts at the heights reviewer #3 measured",
      async () => {
        const cases = [
          [1024, 746], [1024, 750], [1024, 754], [1024, 758], [1024, 760],
          [1280, 746], [1280, 750], [1366, 750], [1536, 750],
        ];
        for (const [w, h] of cases) {
          for (const mode of ["A", "B"]) {
            const m = await panelOverflow(w, h, mode, false);
            const label = `${w}x${h} mode ${mode} (real fonts)`;
            assert.ok(m.scrollH <= m.clientH + 1,
              `${label}: the sidebar (${m.scrollH}px) overflows its own box (${m.clientH}px) by ${m.scrollH - m.clientH}px`);
            assert.ok(m.resVisible, `${label}: the Resources links are not all rendered in the sidebar`);
          }
        }
      });

    // 320x568 mode S: reviewer #3 measured +4px under real fonts (the last
    // Resources link ending at 572 against a 568px box) - a different,
    // narrower-viewport breakpoint from the sidebar cells above (the
    // full-screen portrait panel, not the fixed sidebar).
    test("the 320x568 full-screen panel has no vertical scroll under REAL fonts in mode S",
      async () => {
        const m = await panelOverflow(320, 568, "S", true);
        assert.ok(m.scrollH <= m.clientH + 1,
          `320x568 mode S (real fonts): the panel (${m.scrollH}px) overflows its own box ` +
          `(${m.clientH}px) by ${m.scrollH - m.clientH}px`);
        assert.ok(m.resVisible, "320x568 mode S (real fonts): the Resources links are not all rendered");
      });
  });

  // Lane S2: "CHORD PROGRESSION" mode's app-side wiring. See
  // docs/plans/2026-09-29-chord-sequence-mode.md sections 3 (S2 row) and 8
  // (E1-E9). Only browser-only behaviour lives here - anything the sandbox
  // stub can check (see tests/app.test.js) stays there.
  describe("sequence mode", () => {
    async function enterSeqMode() {
      await freshLoad();
      await openSettingsPanel();
      await b.click("#modeS");
      await b.waitFor(`document.getElementById("modeS").getAttribute("aria-pressed") === "true"`,
        { label: "mode S to take effect" });
    }

    test("selecting CHORD PROGRESSION presses #modeS exclusively, shows the credit note, and survives a reload",
      async () => {
        await enterSeqMode();
        const st = await b.eval(`return {
          a: document.getElementById("modeA").getAttribute("aria-pressed"),
          b: document.getElementById("modeB").getAttribute("aria-pressed"),
          s: document.getElementById("modeS").getAttribute("aria-pressed"),
          noteHidden: document.getElementById("panel-seq-note").hidden,
        };`);
        assert.deepStrictEqual(st, { a: "false", b: "false", s: "true", noteHidden: false });
        const before = await stored();
        assert.strictEqual(before.mode, "S", "mode S was not saved under \"hpfc\"");
        await navigate();
        await b.waitFor(`document.getElementById("modeS").getAttribute("aria-pressed") === "true"`,
          { label: "mode S to survive a reload" });
      });

    test("prev/next/arrows step within the sequence and wrap; the front face shows the diagram, not a hint",
      async () => {
        await enterSeqMode();
        const info = await b.eval(`return {
          frontHasDiagram: document.getElementById("front").innerHTML.includes("diagwrap"),
          frontHasHint: document.getElementById("front").innerHTML.includes("Tap to reveal"),
        };`);
        assert.ok(!info.frontHasHint, "S mode's front face must carry no hint line");
        assert.ok(info.frontHasDiagram, "S mode's front face must show the diagram");
        // Step forward all the way around and confirm it wraps to the first chord.
        const railText = () => b.eval(`return document.querySelector("#count .seq-rail").textContent;`);
        const before = await railText();
        for (let i = 0; i < 5; i++) {
          await b.click("#next");
          await b.settle();
        }
        const after = await railText();
        assert.strictEqual(after, before, "the rail's chord list must be unchanged by stepping");
        await b.click("#prev");
        await b.settle();
        await b.key("ArrowRight", "ArrowRight", 39);
        await b.settle();
        // No crash, and the live region still names a position - the exact
        // wrap arithmetic is covered in tests/app.test.js.
        const live = await b.eval(`return document.querySelector("#count .sr-only").textContent;`);
        assert.match(live, /^.+, chord \d+ of \d+$/);
      });

    test("the live region names the current chord and its position; the visible rail is aria-hidden",
      async () => {
        await enterSeqMode();
        const m = await b.eval(`return {
          railHidden: document.querySelector("#count .seq-rail").getAttribute("aria-hidden"),
          live: document.querySelector("#count .sr-only").textContent,
          countAria: document.getElementById("count").getAttribute("aria-live"),
        };`);
        assert.strictEqual(m.railHidden, "true");
        assert.strictEqual(m.countAria, "polite");
        assert.match(m.live, /^.+, chord 1 of \d+$/);
      });

    test("\"New progression\" redraws without touching Shuffle's own on/off state", async () => {
      await enterSeqMode();
      const label = await b.eval(`return document.getElementById("shuffle").getAttribute("aria-label");`);
      assert.strictEqual(label, "New progression");
      const seen = new Set();
      for (let i = 0; i < 8; i++) {
        await b.click("#shuffle");
        await b.settle();
        seen.add(await b.eval(`return document.querySelector("#count .seq-rail").textContent;`));
      }
      // `shuffled` is an in-memory flag only - it is never persisted under
      // "hpfc" even in modes A/B (pre-existing, not S2's concern). Mode A's
      // Shuffle button reflects it declaratively via .on, so read it there.
      // Switch back to mode A: Shuffle's own state must read exactly as it
      // did before mode S was ever entered (default off).
      await openSettingsPanel();
      await b.click("#modeA");
      await b.waitFor(`document.getElementById("modeA").getAttribute("aria-pressed") === "true"`,
        { label: "mode A to take effect" });
      const btn = await b.eval(`return {
        text: document.getElementById("shuffle").textContent,
        on: document.getElementById("shuffle").classList.contains("on"),
      };`);
      assert.strictEqual(btn.text, "Shuffle: off");
      assert.strictEqual(btn.on, false);
    });

    // §8 E2, S2 test 12. Modes A and B each carry Shuffle's own on/off state
    // declaratively (label + .on class); entering and leaving S must never
    // disturb it, and New progression in S must never touch it either.
    test("sequence mode: entering and leaving rebuilds the order, with shuffle on and off", async () => {
      const shuffleState = () => b.eval(`return {
        text: document.getElementById("shuffle").textContent,
        on: document.getElementById("shuffle").classList.contains("on"),
      };`);
      const railText = () => b.eval(`return document.querySelector("#count .seq-rail")?.textContent ?? null;`);

      for (const [baseMode, turnShuffleOn] of [["A", false], ["B", true]]) {
        await freshLoad();
        await openSettingsPanel();
        await b.click(`#mode${baseMode}`);
        await b.waitFor(`document.getElementById("mode${baseMode}").getAttribute("aria-pressed") === "true"`,
          { label: `mode ${baseMode} to take effect` });
        if (turnShuffleOn) {
          await b.click("#shuffle");
          await b.settle();
        }
        const before = await shuffleState();
        assert.strictEqual(before.on, turnShuffleOn, `mode ${baseMode} Shuffle .on before entering S`);

        await openSettingsPanel();
        await b.click("#modeS");
        await b.waitFor(`document.getElementById("modeS").getAttribute("aria-pressed") === "true"`,
          { label: "mode S to take effect" });
        const seqRail = await railText();
        assert.ok(seqRail, "entering S must draw a sequence and render the rail");
        const chordCount = seqRail.split(" → ").length;
        assert.ok(chordCount === 2 || chordCount === 3, `entering S must give an order of length 2 or 3, got ${chordCount}`);

        // New progression in S must never touch `shuffled` - re-roll a few times.
        const seen = new Set([seqRail]);
        for (let i = 0; i < 4; i++) {
          await b.click("#shuffle");
          await b.settle();
          seen.add(await railText());
        }
        assert.ok(seen.size > 1, "New progression in S must redraw a different sequence at least once");

        await openSettingsPanel();
        await b.click(`#mode${baseMode}`);
        await b.waitFor(`document.getElementById("mode${baseMode}").getAttribute("aria-pressed") === "true"`,
          { label: `mode ${baseMode} to take effect again` });
        const after = await shuffleState();
        assert.deepStrictEqual(after, before,
          `mode ${baseMode} Shuffle state must be restored exactly after a round trip through S`);
      }
    });

    test("a persisted mode \"S\" boots straight into a sequence, not the empty-sequence message", async () => {
      await enterSeqMode();
      await navigate(); // reload
      await b.waitFor(`document.getElementById("modeS").getAttribute("aria-pressed") === "true"`,
        { label: "mode S to survive a reload" });
      const m = await b.eval(`return {
        rail: document.querySelector("#count .seq-rail")?.textContent ?? null,
        frontHasMessage: document.getElementById("front").innerHTML.includes("doesn"),
      };`);
      assert.ok(m.rail, "a reload into a persisted mode S must draw a sequence, not show the empty state");
      assert.ok(!m.frontHasMessage, "a reload into mode S must not show the unsupported-deck message");
    });

    // A real reverse Tab: Input.dispatchKeyEvent's modifiers bitmask (8 = Shift),
    // sent directly since tests/helpers/cdp.js's key() has no modifier param and
    // this lane does not touch that shared helper for one local need.
    async function shiftTab() {
      for (const type of ["keyDown", "keyUp"]) {
        await b.send("Input.dispatchKeyEvent", {
          type, key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, modifiers: 8,
        });
      }
    }
    // Drives a real forward or backward Tab cycle through the currently-open
    // panel (native focus, exactly like a keyboard user), tagging every stop
    // with its index into the app's own panelStops() first (two print buttons
    // carry no id, same technique as the "Tab is trapped inside the settings
    // panel" test above), and
    // returns the ids visited, stopping once focus wraps back to the trigger
    // or after `max` presses.
    // D-8 added three more panelStops() (the tier buttons) between the
    // sequence link and #deck-add, pushing the mode-S cycle past the old
    // default of 14 presses before it wraps back to the trigger.
    async function driveTabCycle(reverse, max = 20) {
      await b.eval(`window.panelStops().forEach((el, i) => el.setAttribute("data-stop-idx", i));`);
      const describe = () => b.eval(`
        const a = document.activeElement;
        return { id: a && a.id || null, isTrigger: a && a.id === "settings-trigger" };
      `);
      const seen = [await describe()];
      for (let i = 0; i < max; i++) {
        if (reverse) await shiftTab(); else await b.key("Tab", "Tab", 9);
        seen.push(await describe());
        if (seen[seen.length - 1].isTrigger) break;
      }
      return seen;
    }

    test("the sequence source link opens in a new tab, is a real 44px target, and joins the real Tab cycle only while visible",
      async () => {
        await enterSeqMode();
        // Selecting a mode closes the panel (closePanel() in #modeS's own
        // onclick) - reopen it to measure the link's rendered, visible size.
        await openSettingsPanel();
        const link = await b.eval(`
          const a = document.getElementById("seq-source-link");
          const r = a.getBoundingClientRect();
          return {
            rel: a.getAttribute("rel"), target: a.getAttribute("target"),
            href: a.getAttribute("href"), h: r.height, w: r.width,
          };
        `);
        assert.match(link.rel, /\bnoopener\b/);
        assert.strictEqual(link.target, "_blank");
        assert.strictEqual(link.href, "https://www.youtube.com/shorts/YcmgdgZTpHc");
        assert.ok(link.h >= 44, `link hit target height ${link.h} < 44px`);

        // Mode S, forward: a real keyboard Tab cycle must actually land on
        // the link, and wrap back to the trigger.
        const fwdS = await driveTabCycle(false);
        assert.strictEqual(fwdS[fwdS.length - 1].isTrigger, true,
          `forward Tab never wrapped back to the trigger in mode S: ${JSON.stringify(fwdS)}`);
        assert.ok(fwdS.some((s) => s.id === "seq-source-link"),
          `forward Tab never reached #seq-source-link in mode S: ${JSON.stringify(fwdS)}`);

        // Mode S, backward: same cycle, walked the other way from the
        // trigger, must also reach it (Shift+Tab is a real, separate path
        // through the panel's own keydown handler, not just the reverse of
        // the array checked above).
        await b.eval(`document.getElementById("settings-trigger").focus(); return true;`);
        const backS = await driveTabCycle(true);
        assert.strictEqual(backS[backS.length - 1].isTrigger, true,
          `backward Tab never wrapped back to the trigger in mode S: ${JSON.stringify(backS)}`);
        assert.ok(backS.some((s) => s.id === "seq-source-link"),
          `backward Tab never reached #seq-source-link in mode S: ${JSON.stringify(backS)}`);

        // Switch back to A: the note (and the link) hide. #modeS itself
        // always remains a stop, but the now-hidden link must never be
        // landed on by a real Tab cycle in either direction, in modes A
        // or B. The panel is still open from backS above; close it first so
        // each iteration can reopen it cleanly before its mode click
        // (openSettingsPanel() unconditionally taps the trigger, so calling
        // it while already open would toggle the panel shut instead).
        await b.eval(`document.getElementById("settings-scrim")?.click(); return true;`).catch(() => {});
        await b.waitFor(`document.getElementById("settings-panel").hidden === true`,
          { label: "panel to close before the A/B loop" });
        for (const mode of ["A", "B"]) {
          await openSettingsPanel();
          await b.click(`#mode${mode}`);
          await b.waitFor(`document.getElementById("mode${mode}").getAttribute("aria-pressed") === "true"`,
            { label: `mode ${mode} to take effect` });
          if (mode === "A") {
            const noteHidden = await b.eval(
              `return document.getElementById("panel-seq-note").hidden;`);
            assert.strictEqual(noteHidden, true);
          }
          await openSettingsPanel();
          const fwd = await driveTabCycle(false);
          assert.strictEqual(fwd[fwd.length - 1].isTrigger, true,
            `forward Tab never wrapped back to the trigger in mode ${mode}: ${JSON.stringify(fwd)}`);
          assert.ok(!fwd.some((s) => s.id === "seq-source-link"),
            `forward Tab landed on hidden #seq-source-link in mode ${mode}: ${JSON.stringify(fwd)}`);
          assert.ok(fwd.some((s) => s.id === "modeS"), `#modeS is always a stop in mode ${mode}`);
          await b.eval(`document.getElementById("settings-trigger").focus(); return true;`);
          const back = await driveTabCycle(true);
          assert.strictEqual(back[back.length - 1].isTrigger, true,
            `backward Tab never wrapped back to the trigger in mode ${mode}: ${JSON.stringify(back)}`);
          assert.ok(!back.some((s) => s.id === "seq-source-link"),
            `backward Tab landed on hidden #seq-source-link in mode ${mode}: ${JSON.stringify(back)}`);
          await b.eval(`document.getElementById("settings-scrim")?.click(); return true;`).catch(() => {});
          await b.waitFor(`document.getElementById("settings-panel").hidden === true`,
            { label: `panel to close after mode ${mode}` });
        }
      });

    // Acceptance 7: "#count is one line at 320x568 for the longest built-in
    // rail". Anchors are triad, sus4, dim or 5 only, so re-rolling repeatedly
    // exercises every rail width the built-in decks can produce, 3-chord
    // sequences included (the worst case for width); asserting the fit on
    // every draw is a stronger guarantee than asserting it on one sequence
    // whose identity would have to be pinned by re-implementing the engine's
    // own pick() here.
    test("sequence mode: the rail is one line at 320x568 for every drawn sequence, including the longest",
      async () => {
        await freshLoad();
        await b.setViewport(320, 568, true);
        await b.settle();
        await openSettingsPanel();
        await b.click("#modeS");
        await b.waitFor(`document.getElementById("modeS").getAttribute("aria-pressed") === "true"`,
          { label: "mode S to take effect" });
        try {
          let sawThreeChord = false;
          for (let i = 0; i < 24; i++) {
            const m = await b.eval(`
              const rail = document.querySelector("#count .seq-rail");
              const count = document.getElementById("count");
              // .mid is display:contents in the footer grid (D18): it draws no
              // box of its own, so containment is checked against #foot, the
              // footer landmark that actually owns the rect.
              const mid = document.getElementById("foot");
              const prev = document.getElementById("prev");
              const next = document.getElementById("next");
              const cr = count.getBoundingClientRect(), mr = mid.getBoundingClientRect();
              const pr = prev.getBoundingClientRect(), nr = next.getBoundingClientRect();
              const insideMid = cr.left >= mr.left - 0.5 && cr.right <= mr.right + 0.5
                && cr.top >= mr.top - 0.5 && cr.bottom <= mr.bottom + 0.5;
              const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
              // A single line means every child sits on the same baseline row:
              // compare the top of the first and last child rather than a
              // height/line-height ratio, which drifts a couple of px with
              // the bold current-chord node's own font metrics.
              const kids = Array.from(rail.children);
              const firstTop = kids[0].getBoundingClientRect().top;
              const lastTop = kids[kids.length - 1].getBoundingClientRect().top;
              return {
                text: rail.textContent, chordUnits: rail.querySelectorAll(".seq-chord").length,
                oneLine: Math.abs(firstTop - lastTop) <= 1,
                // "one line at 320x568" means the rail fits fully - no ellipsis
                // truncation needed - not merely that #count's own box (which
                // clips with text-overflow:ellipsis as a safety net) stays put.
                fitsWithoutEllipsis: count.scrollWidth <= count.clientWidth + 1,
                insideMid,
                overlapsPrev: overlaps(cr, pr), overlapsNext: overlaps(cr, nr),
              };
            `);
            const chordCount = m.chordUnits;
            if (chordCount === 3) sawThreeChord = true;
            assert.ok(m.oneLine, `rail "${m.text}" wrapped to more than one line at 320x568`);
            assert.ok(m.fitsWithoutEllipsis, `rail "${m.text}" overflows #count and needs the ellipsis fallback at 320x568`);
            assert.ok(m.insideMid, `#count is not contained within .mid at 320x568`);
            assert.strictEqual(m.overlapsPrev, false, `#count overlaps #prev at 320x568`);
            assert.strictEqual(m.overlapsNext, false, `#count overlaps #next at 320x568`);
            await b.click("#shuffle");
            await b.settle();
          }
          assert.ok(sawThreeChord, "24 re-rolls never produced a 3-chord sequence - the worst case for width was not exercised");
        } finally {
          await b.setViewport(900, 900, false);
        }
      });

    // Pinned worst cases for the rail at 320x568: Hijaz's longest real rail,
    // a synthetic rail of three sus4 names (anchors are triad, sus4, dim or 5,
    // so "X#sus4" is the longest name a generated deck can put on the rail),
    // and a chord name carrying
    // markup, which must render as literal text (textContent, never innerHTML).
    test("sequence mode: the pinned longest rail, a 6-character rail and a markup-bearing name all fit on one line at 320x568",
      async () => {
        await freshLoad();
        await b.setViewport(320, 568, true);
        await b.settle();
        await openSettingsPanel();
        await b.click("#modeS");
        await b.waitFor(`document.getElementById("modeS").getAttribute("aria-pressed") === "true"`,
          { label: "mode S to take effect" });
        await b.eval(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return true;`);
        await b.waitFor(`document.getElementById("settings-panel").hidden === true`, { label: "panel to close" });
        try {
          const measure = (names) => b.eval(`
            const d = deck();
            ${JSON.stringify(names)}.forEach((n, i) => { if (n !== null) { d.chords[[0, 10, 12][i]].main = n; d.chords[[0, 10, 12][i]].sup = ""; } });
            seq = { chords: [0, 10, 12], style: seq.style };
            order = seq.chords.slice(); idx = 0; flipped = false;
            render();
            const rail = document.querySelector("#count .seq-rail");
            const count = document.getElementById("count");
            const kids = Array.from(rail.children);
            return {
              text: rail.textContent,
              bolds: rail.querySelectorAll("b").length,
              oneLine: Math.abs(kids[0].getBoundingClientRect().top - kids[kids.length - 1].getBoundingClientRect().top) <= 1,
              fits: count.scrollWidth <= count.clientWidth + 1, sw: count.scrollWidth, cw: count.clientWidth, font: getComputedStyle(count).fontSize,
            };`);
          const real = await measure([null, null, null]);
          assert.strictEqual(real.text, "C# → F#sus4 → G#°");
          assert.ok(real.oneLine && real.fits, `pinned rail "${real.text}" must fit on one line`);

          const wide = await measure(["G#sus4", "C#sus4", "D#sus4"]);
          assert.strictEqual(wide.text, "G#sus4 → C#sus4 → D#sus4");
          assert.ok(wide.oneLine && wide.fits, `6-character rail "${wide.text}" must fit on one line ${JSON.stringify(wide)}`);

          const markup = await measure([null, "<b>x</b>", null]);
          assert.strictEqual(markup.text, "G#sus4 → <b>x</b> → D#sus4", "markup in a chord name must render as literal text");
          assert.strictEqual(markup.bolds, 1, "only the current chord's own <b> node may exist in the rail");
        } finally {
          await b.setViewport(900, 900, false);
          await freshLoad();
        }
      });

    // D-12 (owner decision 2026-10-02, "Scroll, one line" - supersedes the
    // wrap-to-a-second-line design the two tests above were written against):
    // the rail never wraps, at any sequence length, and keeps the current
    // chord in view by scrolling horizontally instead. Picks the longest
    // ADVANCED rail ANY built-in deck can draw, by actual rendered pixel
    // width (not chord count or character count, which can rank two
    // candidates differently once per-glyph kerning is in play) - sampling
    // pick() directly rather than re-rolling through the UI, since the UI
    // path cannot target "longest" without re-implementing pick()'s own
    // selection logic here (same reasoning as Acceptance 7 above).
    async function pickLongestAdvancedRail() {
      return b.eval(`
        const measure = (text) => {
          const c = document.createElement("canvas");
          const ctx = c.getContext("2d");
          ctx.font = "400 20px Marcellus, serif";
          return ctx.measureText(text).width;
        };
        let best = null;
        for (const d of DECKS) {
          for (let i = 0; i < 60; i++) {
            const picked = HPE.sequence.pick(d, Math.random, null, "advanced");
            if (!picked || !picked.chords) continue;
            const text = picked.chords.map(ci => {
              const c = d.chords[ci];
              return c.main + (c.sup || "");
            }).join(" → ");
            const w = measure(text);
            if (!best || w > best.w) best = { deckId: d.id, chords: picked.chords, text, w };
          }
        }
        return best;
      `);
    }
    const D12_VIEWPORTS = [[667, 375], [844, 390], [320, 568], [380, 740]];
    test("D-12: the rail never wraps and the current chord stays in view, for the longest built-in ADVANCED rail",
      async () => {
        const longest = await pickLongestAdvancedRail();
        assert.ok(longest && longest.chords && longest.chords.length >= 3,
          `could not find a usable ADVANCED sequence to test against: ${JSON.stringify(longest)}`);
        for (const [w, h] of D12_VIEWPORTS) {
          await freshLoad();
          await b.setViewport(w, h, w < h);
          await b.settle();
          await b.send("Emulation.setEmulatedMedia", {
            media: "", features: [{ name: "prefers-reduced-motion", value: "reduce" }],
          });
          try {
            await b.eval(`
              selectDeck(${JSON.stringify(longest.deckId)});
              tier = "advanced"; mode = "S";
              seq = { chords: ${JSON.stringify(longest.chords)}, style: "together" };
              order = seq.chords.slice(); idx = 0; flipped = false;
              document.getElementById("foot").classList.add("seq");
              render();
              return true;
            `);
            for (let step = 0; step <= longest.chords.length; step++) {
              const m = await b.eval(`
                const rail = document.querySelector("#count .seq-rail");
                const cur = rail.querySelector(".seq-chord > b, b.seq-chord") || rail.querySelector("b");
                const rr = rail.getBoundingClientRect(), cr = cur.getBoundingClientRect();
                const kids = Array.from(rail.children);
                const docEl = document.documentElement;
                return {
                  oneLine: Math.abs(kids[0].getBoundingClientRect().top - kids[kids.length - 1].getBoundingClientRect().top) <= 1,
                  curInRail: cr.left >= rr.left - 0.5 && cr.right <= rr.right + 0.5,
                  noBodyHScroll: docEl.scrollWidth <= docEl.clientWidth + 1,
                  idx, text: rail.textContent,
                };
              `);
              assert.ok(m.oneLine, `${w}x${h} step ${step}: rail "${m.text}" wrapped to more than one line`);
              assert.ok(m.curInRail, `${w}x${h} step ${step}: current chord is not fully inside the rail's visible box ("${m.text}")`);
              assert.ok(m.noBodyHScroll, `${w}x${h} step ${step}: page has horizontal scroll`);
              await b.eval(`step(1); return true;`);
              await b.settle();
            }
          } finally {
            await b.send("Emulation.setEmulatedMedia", { media: "", features: [] });
            await b.setViewport(900, 900, false);
          }
        }
      });

    test("D-12: BASIC and ADVANCED footer/card dimensions are identical at the four rail viewports",
      async () => {
        const longest = await pickLongestAdvancedRail();
        for (const [w, h] of D12_VIEWPORTS) {
          await freshLoad();
          await b.setViewport(w, h, w < h);
          await b.settle();
          await openSettingsPanel();
          await b.click("#modeS");
          await b.waitFor(`document.getElementById("modeS").getAttribute("aria-pressed") === "true"`,
            { label: "mode S to take effect" });
          await b.eval(`document.getElementById("settings-scrim")?.click(); return true;`).catch(() => {});
          await b.waitFor(`document.getElementById("settings-panel").hidden === true`, { label: "panel to close" });
          await b.settle();
          const rectsOf = (sel) => `(() => {
            const r = document.querySelector("${sel}").getBoundingClientRect();
            return { w: r.width, h: r.height };
          })()`;
          const basic = await b.eval(`return { footer: ${rectsOf("footer")}, card: ${rectsOf("#card")} };`);
          await b.eval(`
            selectDeck(${JSON.stringify(longest.deckId)});
            tier = "advanced";
            seq = { chords: ${JSON.stringify(longest.chords)}, style: "together" };
            order = seq.chords.slice(); idx = 0; flipped = false;
            render();
            return true;
          `);
          await b.settle();
          const advanced = await b.eval(`return { footer: ${rectsOf("footer")}, card: ${rectsOf("#card")} };`);
          for (const box of ["footer", "card"]) {
            for (const k of ["w", "h"]) {
              assert.ok(Math.abs(basic[box][k] - advanced[box][k]) <= 0.5,
                `${w}x${h} ${box}.${k}: BASIC ${basic[box][k]} vs the longest ADVANCED rail ${advanced[box][k]}`);
            }
          }
          await b.setViewport(900, 900, false);
        }
      });

    // Acceptance 7 (revised, O1/O5): switching from A to S at a fixed viewport
    // must keep the header exactly where it was and the footer's LEFT EDGE
    // and WIDTH fixed - only its height may grow, and only by the style block
    // O1 adds. The card must still satisfy assertCardFits's own relation to
    // main (E3, replaces "does not move or resize the header, card area or
    // footer": that claim is false by design now the footer grows in S - D13).
    // 1280x500, not 1280x800: assertCardFits's LANDSCAPE_CONTROLS always
    // expects #settings-trigger tappable, but M3's desktop sidebar
    // (>=1024x700) makes it display:none by design - 1280x500 is the same
    // short-but-wide desktop window the pre-existing assertCardFits call
    // sites above already use for that reason.
    const E3_VIEWPORTS = [[390, 844], [390, 745], [380, 700], [320, 568], [844, 390], [667, 375], [1280, 500]];
    test("switching to mode S keeps the header and footer width fixed and grows the footer only by the style block",
      async () => {
        const rectsOf = (sel) => `(() => {
          const r = document.querySelector("${sel}").getBoundingClientRect();
          return { l: r.left, t: r.top, w: r.width, h: r.height };
        })()`;
        for (const [w, h] of E3_VIEWPORTS) {
          await freshLoad();
          await b.setViewport(w, h, w < h);
          await b.settle();
          const before = await b.eval(`return {
            header: ${rectsOf("header")},
            footer: ${rectsOf("footer")},
          };`);
          await assertCardFits(`at ${w}x${h} in mode A`);
          await openSettingsPanel();
          await b.click("#modeS");
          await b.waitFor(`document.getElementById("modeS").getAttribute("aria-pressed") === "true"`,
            { label: "mode S to take effect" });
          await b.eval(`document.getElementById("settings-scrim")?.click(); return true;`).catch(() => {});
          await b.waitFor(`document.getElementById("settings-panel").hidden === true`,
            { label: "panel to close" });
          await b.settle();
          const after = await b.eval(`return {
            header: ${rectsOf("header")},
            footer: ${rectsOf("footer")},
            scrollHeight: document.scrollingElement.scrollHeight,
            innerHeight: window.innerHeight,
            styleBottom: document.getElementById("seq-style").getBoundingClientRect().bottom,
          };`);
          for (const k of ["l", "t", "w", "h"]) {
            assert.ok(Math.abs(before.header[k] - after.header[k]) <= 0.5,
              `${w}x${h} header.${k}: mode A ${before.header[k]} vs mode S ${after.header[k]}`);
          }
          assert.ok(Math.abs(before.footer.l - after.footer.l) <= 0.5,
            `${w}x${h} footer.l moved: mode A ${before.footer.l} vs mode S ${after.footer.l}`);
          assert.ok(Math.abs(before.footer.w - after.footer.w) <= 0.5,
            `${w}x${h} footer.w changed: mode A ${before.footer.w} vs mode S ${after.footer.w}`);
          const growth = after.footer.h - before.footer.h;
          const maxGrowth = after.innerHeight > 520 ? 70 : 10;
          assert.ok(growth <= maxGrowth,
            `${w}x${h} footer grew by ${growth}px switching to S, budget ${maxGrowth}px`);
          assert.ok(after.scrollHeight <= after.innerHeight + 0.5,
            `${w}x${h} the page scrolls in mode S: scrollHeight ${after.scrollHeight} > innerHeight ${after.innerHeight}`);
          assert.ok(after.styleBottom <= after.innerHeight + 0.5,
            `${w}x${h} #seq-style's bottom (${after.styleBottom}) is past innerHeight (${after.innerHeight})`);
          await assertCardFits(`at ${w}x${h} in mode S`);
        }
      });

    test("the footer controls share one centre line in every mode", async () => {
      const viewports = [[380, 700], [320, 568], [844, 390], [1280, 800]];
      for (const [w, h] of viewports) {
        await freshLoad();
        await b.setViewport(w, h, w < h);
        await b.settle();
        for (const mode of ["A", "B", "S"]) {
          await openSettingsPanel();
          await b.click(`#mode${mode}`);
          await b.waitFor(`document.getElementById("mode${mode}").getAttribute("aria-pressed") === "true"`,
            { label: `mode ${mode} to take effect` });
          await b.eval(`document.getElementById("settings-scrim")?.click(); return true;`).catch(() => {});
          await b.waitFor(`document.getElementById("settings-panel").hidden === true`,
            { label: "panel to close" });
          await b.settle();
          const m = await b.eval(`
            const cy = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return r.top + r.height / 2; };
            const cx = (sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return r.left + r.width / 2; };
            const foot = document.getElementById("foot").getBoundingClientRect();
            return {
              prev: cy("#prev"), shuffle: cy("#shuffle"), next: cy("#next"),
              shuffleCx: cx("#shuffle"),
              shuffleW: document.getElementById("shuffle").getBoundingClientRect().width,
              countR: document.getElementById("count").getBoundingClientRect().right,
              shuffleL: document.getElementById("shuffle").getBoundingClientRect().left,
              shuffleR: document.getElementById("shuffle").getBoundingClientRect().right,
              nextL: document.getElementById("next").getBoundingClientRect().left,
              countCx: cx("#count"), footCx: foot.left + foot.width / 2,
            };
          `);
          assert.ok(Math.abs(m.prev - m.shuffle) <= 0.5,
            `${w}x${h} mode ${mode}: #prev cy ${m.prev} vs #shuffle cy ${m.shuffle}`);
          assert.ok(Math.abs(m.next - m.shuffle) <= 0.5,
            `${w}x${h} mode ${mode}: #next cy ${m.next} vs #shuffle cy ${m.shuffle}`);
          if (h > w) {
            assert.ok(Math.abs(m.countCx - m.footCx) <= 1,
              `${w}x${h} mode ${mode}: #count cx ${m.countCx} vs footer centre ${m.footCx}`);
          }
          // #shuffle is a centred item in the middle column, never stretched
          // across it (the text toggle is ~95px wide, the refresh icon 56px).
          assert.ok(m.shuffleW <= 120,
            `${w}x${h} mode ${mode}: #shuffle is ${m.shuffleW}px wide - stretched across its column`);
          const landscapeS = mode === "S" && h <= 520;
          if (!landscapeS) {
            assert.ok(Math.abs(m.shuffleCx - m.footCx) <= 1,
              `${w}x${h} mode ${mode}: #shuffle cx ${m.shuffleCx} vs footer centre ${m.footCx}`);
          } else {
            // D8: landscape S puts the refresh button in its own column
            // beside #next, right of the rail.
            assert.ok(m.shuffleL >= m.countR - 0.5 && m.shuffleR <= m.nextL + 0.5,
              `${w}x${h} mode S: #shuffle [${m.shuffleL}, ${m.shuffleR}] is not between #count (right ${m.countR}) and #next (left ${m.nextL})`);
          }
        }
      }
    });

    test("landscape mode S keeps the style line inside the footer, clear of every control and the status line",
      async () => {
        for (const [w, h] of [[844, 390], [667, 375], [1280, 500]]) {
          await b.setViewport(w, h, false);
          await b.eval(`localStorage.clear();
            localStorage.setItem("hpfc", JSON.stringify({ mode: "S", deck: "custom:gone" })); return true;`);
          await navigate();
          await b.waitFor(`document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`,
            { label: "deck chips to be built" });
          await b.eval(`return document.fonts.ready.then(() => true);`);
          await b.settle();
          const m = await b.eval(`
            const box = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
            const text = (e) => { const g = document.createRange(); g.selectNodeContents(e);
              const rs = Array.from(g.getClientRects()); if (!rs.length) return null;
              return { l: Math.min(...rs.map((x) => x.left)), t: Math.min(...rs.map((x) => x.top)),
                       r: Math.max(...rs.map((x) => x.right)), b: Math.max(...rs.map((x) => x.bottom)) }; };
            const st = document.getElementById("seq-style");
            return { hidden: st.hidden, style: text(st), foot: box(document.getElementById("foot")),
              announce: text(document.querySelector(".announce")),
              others: ["#prev", "#next", "#shuffle", "#count"].map((s) => [s, box(document.querySelector(s))]) };
          `);
          assert.strictEqual(m.hidden, false, `${w}x${h}: #seq-style hidden in mode S`);
          assert.ok(m.announce, `${w}x${h}: the deck-gone boot left .announce empty, so the overlap check is vacuous`);
          const hit = (a, c) => a.l < c.r - 0.5 && c.l < a.r - 0.5 && a.t < c.b - 0.5 && c.t < a.b - 0.5;
          assert.ok(m.style.t >= m.foot.t - 0.5 && m.style.b <= m.foot.b + 0.5,
            `${w}x${h}: style text [${m.style.t}, ${m.style.b}] spills out of #foot [${m.foot.t}, ${m.foot.b}]`);
          assert.ok(!hit(m.style, m.announce),
            `${w}x${h}: style text ${JSON.stringify(m.style)} overlaps the status line ${JSON.stringify(m.announce)}`);
          for (const [sel, r] of m.others) {
            assert.ok(!hit(m.style, r), `${w}x${h}: style text ${JSON.stringify(m.style)} overlaps ${sel} ${JSON.stringify(r)}`);
          }
        }
      });

    test("the mode S refresh button is a 44px icon that hit-tests to itself", async () => {
      for (const [w, h] of [[380, 700], [844, 390]]) {
        await freshLoad();
        await b.setViewport(w, h, w < h);
        await b.settle();
        await openSettingsPanel();
        await b.click("#modeS");
        await b.waitFor(`document.getElementById("modeS").getAttribute("aria-pressed") === "true"`,
          { label: "mode S to take effect" });
        await b.eval(`document.getElementById("settings-scrim")?.click(); return true;`).catch(() => {});
        await b.waitFor(`document.getElementById("settings-panel").hidden === true`,
          { label: "panel to close" });
        await b.settle();
        const m = await b.eval(`
          const hitsSelf = (sel) => {
            const el = document.querySelector(sel);
            const r = el.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return !!hit && (hit === el || el.contains(hit));
          };
          const btn = document.getElementById("shuffle");
          const r = btn.getBoundingClientRect();
          return {
            w: r.width, h: r.height,
            ariaLabel: btn.getAttribute("aria-label"),
            hasSvg: !!btn.querySelector("svg"),
            text: btn.textContent.trim(),
            hitsSelf: hitsSelf("#shuffle"),
            prevHits: hitsSelf("#prev"), nextHits: hitsSelf("#next"),
          };
        `);
        assert.ok(m.w >= 44 && m.h >= 44, `${w}x${h}: #shuffle is ${m.w}x${m.h}, must be at least 44x44`);
        assert.strictEqual(m.ariaLabel, "New progression");
        assert.ok(m.hasSvg, "#shuffle must contain an svg in mode S");
        assert.strictEqual(m.text, "", "#shuffle must carry no visible text in mode S");
        assert.strictEqual(m.hitsSelf, true, `${w}x${h}: #shuffle does not hit-test to itself`);
        assert.strictEqual(m.prevHits, true, `${w}x${h}: #prev does not hit-test to itself`);
        assert.strictEqual(m.nextHits, true, `${w}x${h}: #next does not hit-test to itself`);

        await openSettingsPanel();
        await b.click("#modeA");
        await b.waitFor(`document.getElementById("modeA").getAttribute("aria-pressed") === "true"`,
          { label: "mode A to take effect" });
        const a = await b.eval(`
          const btn = document.getElementById("shuffle");
          return { hasSvg: !!btn.querySelector("svg"), ariaLabel: btn.getAttribute("aria-label"), text: btn.textContent };
        `);
        assert.strictEqual(a.hasSvg, false, "leaving S must remove the svg");
        assert.strictEqual(a.ariaLabel, null, "leaving S must drop the aria-label");
        assert.strictEqual(a.text, "Shuffle: off");
      }
    });

    test("the rail is centred Marcellus of at least 18px and its current chord meets AA on every deck", async () => {
      const hexToRgb = (hex) => {
        const h = hex.replace("#", "");
        return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
      };
      await freshLoad();
      await b.setViewport(380, 700, true);
      await b.settle();
      await openSettingsPanel();
      await b.click("#modeS");
      await b.waitFor(`document.getElementById("modeS").getAttribute("aria-pressed") === "true"`,
        { label: "mode S to take effect" });
      for (const deckId of ["hijaz", "pygmy", "amara"]) {
        await b.eval(`selectDeck(${JSON.stringify(deckId)}); return true;`);
        await b.settle();
        const m = await b.eval(`
          const parse = (s) => (s.match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
          const count = document.getElementById("count");
          const cs = getComputedStyle(count);
          const cur = count.querySelector("b");
          const bcs = cur ? getComputedStyle(cur) : null;
          return {
            fontFamily: cs.fontFamily, fontSize: parseFloat(cs.fontSize), textAlign: cs.textAlign,
            color: bcs ? parse(bcs.color) : null,
            decorationLine: bcs ? bcs.textDecorationLine : null,
            decorationColor: bcs ? parse(bcs.textDecorationColor) : null,
            root: deck().colors.root,
          };
        `);
        assert.ok(/^Marcellus/i.test(m.fontFamily), `${deckId}: #count font-family is "${m.fontFamily}"`);
        assert.ok(m.fontSize >= 18, `${deckId}: #count font-size is ${m.fontSize}px, needs >= 18px`);
        assert.strictEqual(m.textAlign, "center", `${deckId}: #count text-align is "${m.textAlign}"`);
        assert.ok(m.color, `${deckId}: the rail's current chord <b> was not found`);
        const ratio = contrastRatio(m.color, [0x1a, 0x18, 0x15]);
        assert.ok(ratio >= AA_NORMAL, `${deckId}: rail current-chord colour is ${ratio.toFixed(2)}:1 on #1a1815, needs ${AA_NORMAL}`);
        assert.ok(m.decorationLine.includes("underline"), `${deckId}: rail current chord lost its underline`);
        assert.deepStrictEqual(m.decorationColor, hexToRgb(m.root),
          `${deckId}: underline colour must be the deck's root colour`);
      }
    });

    test("the hint line is centred under the card", async () => {
      await freshLoad();
      await b.setViewport(844, 390, true);
      await b.settle();
      const m = await b.eval(`
        const hint = document.querySelector(".hint");
        const cs = getComputedStyle(hint);
        const range = document.createRange();
        range.selectNodeContents(hint);
        const rects = Array.from(range.getClientRects());
        const hintBox = hint.getBoundingClientRect();
        const boxCentre = (hintBox.left + hintBox.right) / 2;
        return { textAlign: cs.textAlign, offsets: rects.map((r) => Math.abs((r.left + r.right) / 2 - boxCentre)) };
      `);
      assert.strictEqual(m.textAlign, "center", `.hint text-align is "${m.textAlign}"`);
      assert.ok(m.offsets.length > 0, ".hint has no rendered line boxes");
      for (const off of m.offsets) {
        assert.ok(off <= 1, `a .hint line box is ${off}px off centre`);
      }
    });

    test("the menu's NAME->NOTES and NOTES->NAME buttons split their row evenly", async () => {
      try {
        for (const [w, h] of [[380, 700], [1280, 800]]) {
          await freshLoad();
          await b.setViewport(w, h, w < h);
          await b.settle();
          await openSettingsPanel();
          const m = await b.eval(`
            const ra = document.getElementById("modeA").getBoundingClientRect();
            const rb = document.getElementById("modeB").getBoundingClientRect();
            const rs = document.getElementById("modeS").getBoundingClientRect();
            return { wa: ra.width, wb: rb.width, la: ra.left, ls: rs.left, rbRight: rb.right, rsRight: rs.right };
          `);
          assert.ok(Math.abs(m.wa - m.wb) <= 1, `${w}x${h}: #modeA width ${m.wa} vs #modeB width ${m.wb}`);
          assert.ok(Math.abs(m.la - m.ls) <= 1, `${w}x${h}: #modeA left ${m.la} vs #modeS left ${m.ls}`);
          assert.ok(Math.abs(m.rbRight - m.rsRight) <= 1, `${w}x${h}: #modeB right ${m.rbRight} vs #modeS right ${m.rsRight}`);
          await b.eval(`document.getElementById("settings-scrim")?.click(); return true;`).catch(() => {});
          await b.waitFor(`document.getElementById("settings-panel").hidden === true`,
            { label: "panel to close" });
        }
      } finally {
        // This test is the only one in the file that leaves the viewport at
        // a >=1024x700 desktop size without resetting it - the swipe suite's
        // settings-panel guard test inherits that ambient state (no swipe
        // test sets its own viewport) and the desktop-sidebar breakpoint
        // means panelOpen is never set, silently defeating that guard.
        await b.setViewport(900, 900, false);
      }
    });

    test("an unsupported deck's sequence clears the card, disables stepping, and does not crash",
      async () => {
        await freshLoad();
        await openSettingsPanel();
        await b.click("#deck-add");
        await b.waitFor(`getComputedStyle(document.getElementById("scale-box")).display !== "none"`,
          { label: "the scale sheet to open" });
        await b.eval(`
          const box = document.getElementById("scale-box");
          box.value = "(C3) G3 D4 G4 D5";
          box.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        `);
        await b.click("#scale-generate");
        await b.waitFor(`document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`,
          { label: "the generated deck chip" });
        await openSettingsPanel();
        await b.click("#modeS");
        await b.waitFor(`document.getElementById("modeS").getAttribute("aria-pressed") === "true"`,
          { label: "mode S to take effect" });
        const m = await b.eval(`return {
          front: document.getElementById("front").innerHTML,
          back: document.getElementById("back").innerHTML,
          countChildren: document.getElementById("count").children.length,
        };`);
        assert.match(m.front, /doesn.t have enough simple chords/);
        assert.strictEqual(m.front, m.back);
        assert.strictEqual(m.countChildren, 0);
        // Stepping and flipping on the empty state must not throw.
        await b.click("#next");
        await b.click("#prev");
        await b.eval(`document.getElementById("card").click(); return true;`);
        await b.key("ArrowRight", "ArrowRight", 39);
        await b.settle();
      });

  });

  /* ---------------------------------------------------------------- *
   * difficulty - docs/plans/2026-10-02-sequence-difficulty.md
   * ---------------------------------------------------------------- */
  describe("difficulty", () => {
    async function enterSeqMode() {
      await freshLoad();
      await openSettingsPanel();
      await b.click("#modeS");
      await b.waitFor(`document.getElementById("modeS").getAttribute("aria-pressed") === "true"`,
        { label: "mode S to take effect" });
    }
    const tierState = () => b.eval(`return {
      basic: { on: document.getElementById("tier-basic").classList.contains("on"),
        pressed: document.getElementById("tier-basic").getAttribute("aria-pressed"),
        disabled: document.getElementById("tier-basic").disabled },
      intermediate: { on: document.getElementById("tier-intermediate").classList.contains("on"),
        pressed: document.getElementById("tier-intermediate").getAttribute("aria-pressed"),
        disabled: document.getElementById("tier-intermediate").disabled },
      advanced: { on: document.getElementById("tier-advanced").classList.contains("on"),
        pressed: document.getElementById("tier-advanced").getAttribute("aria-pressed"),
        disabled: document.getElementById("tier-advanced").disabled },
      noteHidden: document.getElementById("panel-tier-note").hidden,
    };`);

    // D-8/D-10: always visible, always present in the panel markup, in every
    // mode - only the disabled state (checked below) ever changes.
    test("the Difficulty group is present and visible in modes A, B and S", async () => {
      await freshLoad();
      await openSettingsPanel();
      for (const m of ["A", "B", "S"]) {
        await b.click(`#mode${m}`);
        await b.waitFor(`document.getElementById("mode${m}").getAttribute("aria-pressed") === "true"`,
          { label: `mode ${m} to take effect` });
        await openSettingsPanel();
        const hidden = await b.eval(
          `return getComputedStyle(document.getElementById("panel-tier-group")).display === "none";`);
        assert.strictEqual(hidden, false, `Difficulty group must be visible in mode ${m}`);
      }
    });

    // D-9: a three-across row once the group's own container is wide enough
    // (mobile portrait). Narrower columns (the landscape grid and the
    // desktop sidebar, both tested below) do NOT fall to a single column -
    // INTERMEDIATE's unbroken word forces a 2+1 wrap instead (BASIC and
    // INTERMEDIATE share a row, ADVANCED wraps onto its own row alone). The
    // `row` assertion below only tells row-of-three apart from not-row-of-
    // three; it does not distinguish that 2+1 wrap from a true single
    // column, both of which read `row: false`.
    test("the Difficulty group matches the Practice group's width and switches from a row to a column layout",
      async () => {
        // Narrow single-column viewports keep the three tier buttons on one
        // row. The landscape grid (812x375) and the desktop sidebar
        // (1280x800) are both narrower settings-group columns (~270-370px),
        // and INTERMEDIATE's unbroken word forces ADVANCED to wrap onto its
        // own row inside .tierbar at that width - "row" is false at both.
        const expectRow = { "380x740": true, "320x640": true, "812x375": false, "1280x800": false };
        for (const [w, h, landscape] of [[380, 740, false], [320, 640, false], [812, 375, true], [1280, 800, false]]) {
          await freshLoad();
          await b.setViewport(w, h, landscape);
          await b.settle();
          await openSettingsPanel();
          const m = await b.eval(`
            const practice = document.getElementById("modeA").closest(".panel-group");
            const tierGroup = document.getElementById("panel-tier-group");
            const pr = practice.getBoundingClientRect(), tr = tierGroup.getBoundingClientRect();
            const basic = document.getElementById("tier-basic").getBoundingClientRect();
            const inter = document.getElementById("tier-intermediate").getBoundingClientRect();
            const adv = document.getElementById("tier-advanced").getBoundingClientRect();
            return {
              widthsMatch: Math.abs(pr.width - tr.width) <= 1,
              row: Math.abs(basic.top - inter.top) <= 1 && Math.abs(inter.top - adv.top) <= 1,
              basicH: basic.height, interH: inter.height, advH: adv.height,
            };
          `);
          assert.ok(m.widthsMatch, `${w}x${h}: Difficulty group width must equal the Practice group's`);
          assert.strictEqual(m.row, expectRow[`${w}x${h}`], `${w}x${h}: tier-button row layout`);
          assert.ok(m.basicH >= 44 && m.interH >= 44 && m.advH >= 44,
            `${w}x${h}: every tier button must be a >=44px tall hit target`);
          await b.setViewport(900, 900, false);
        }
      });

    // D-10: greyed and inert everywhere except mode S. The remembered tier
    // stays visibly pressed even while the group is disabled.
    test("the tier buttons are disabled and out of the Tab order in modes A and B, enabled only in S",
      async () => {
        await enterSeqMode();
        let st = await tierState();
        assert.strictEqual(st.basic.disabled, false, "tier buttons must be enabled in mode S");
        assert.strictEqual(st.noteHidden, true, "the greyed-state note must be hidden in mode S");
        const stopsS = await b.eval(`return window.panelStops().map(e => e.id);`);
        assert.ok(stopsS.includes("tier-basic") && stopsS.includes("tier-intermediate")
          && stopsS.includes("tier-advanced"), "enabled tier buttons must join the Tab trap in mode S");
        // B2 (reviewer FAIL #3): a hidden idref still contributes its text to
        // the accessible description, so the live mode-S buttons must not
        // carry aria-describedby="panel-tier-note" at all - otherwise a
        // screen reader announces "Pick CHORD PROGRESSION to change this."
        // on buttons that already work.
        const describedByS = await b.eval(`return ["tier-basic", "tier-intermediate", "tier-advanced"]
          .map(id => document.getElementById(id).getAttribute("aria-describedby"));`);
        assert.deepStrictEqual(describedByS, [null, null, null],
          "tier buttons must not carry aria-describedby in mode S");

        await openSettingsPanel();
        await b.click("#modeA");
        await b.waitFor(`document.getElementById("modeA").getAttribute("aria-pressed") === "true"`,
          { label: "mode A to take effect" });
        await openSettingsPanel();
        st = await tierState();
        assert.strictEqual(st.basic.disabled, true);
        assert.strictEqual(st.intermediate.disabled, true);
        assert.strictEqual(st.advanced.disabled, true);
        assert.strictEqual(st.basic.on, true, "the remembered tier stays visibly pressed while greyed out");
        assert.strictEqual(st.noteHidden, false, "the greyed-state note must be visible outside mode S");
        const opacity = await b.eval(
          `return getComputedStyle(document.getElementById("tier-intermediate")).opacity;`);
        assert.ok(Number(opacity) < 1, "a disabled tier button must read visually greyed out");
        const stopsA = await b.eval(`return window.panelStops().map(e => e.id);`);
        assert.ok(!stopsA.includes("tier-basic") && !stopsA.includes("tier-intermediate")
          && !stopsA.includes("tier-advanced"), "disabled tier buttons must not join the Tab trap");
        const describedByA = await b.eval(`return ["tier-basic", "tier-intermediate", "tier-advanced"]
          .map(id => document.getElementById(id).getAttribute("aria-describedby"));`);
        assert.deepStrictEqual(describedByA, ["panel-tier-note", "panel-tier-note", "panel-tier-note"],
          "disabled tier buttons outside mode S must carry aria-describedby=panel-tier-note");
      });

    // D-7/D-11: clicking a tier presses it exclusively, persists across a
    // reload, deals a progression that actually classifies at that tier (or
    // shows the D-6 empty message), and closes the mobile panel.
    test("clicking a tier presses it exclusively, persists, re-deals at that tier, and closes the panel",
      async () => {
        await enterSeqMode();
        for (const t of ["advanced", "intermediate", "basic"]) {
          await openSettingsPanel();
          await b.click(`#tier-${t}`);
          await b.waitFor(`document.getElementById("tier-${t}").getAttribute("aria-pressed") === "true"`,
            { label: `tier ${t} to take effect` });
          const st = await tierState();
          for (const other of ["basic", "intermediate", "advanced"]) {
            assert.strictEqual(st[other].pressed, other === t ? "true" : "false",
              `tier ${t}: ${other} aria-pressed`);
          }
          await b.waitFor(`document.getElementById("settings-panel").hidden === true`,
            { label: `clicking tier ${t} to close the mobile settings panel` });
          const before = await stored();
          assert.strictEqual(before.tier, t, `tier ${t} was not saved under "hpfc"`);
          const check = await b.eval(`
            if (!seq || !seq.chords) return { empty: true, reason: seq && seq.reason };
            return { empty: false, tierOf: HPE.sequence.tierOf(deck(), seq.chords) };
          `);
          if (!check.empty) assert.strictEqual(check.tierOf, t, `dealt progression at tier ${t} classified as ${check.tierOf}`);
          await navigate();
          await b.waitFor(`document.getElementById("tier-${t}").getAttribute("aria-pressed") === "true"`,
            { label: `tier ${t} to survive a reload` });
        }
      });

    // D-11 reviewer nit: a click on the ALREADY-pressed tier is not a no-op -
    // it must still redraw a (possibly different) progression.
    test("clicking the already-pressed tier still re-deals", async () => {
      await enterSeqMode();
      const railText = () => b.eval(`return document.querySelector("#count .seq-rail")?.textContent ?? null;`);
      const seen = new Set([await railText()]);
      for (let i = 0; i < 8; i++) {
        await openSettingsPanel();
        await b.click("#tier-basic"); // already pressed - basic is the boot default
        await b.settle();
        seen.add(await railText());
      }
      assert.ok(seen.size > 1, "re-clicking the pressed tier must eventually redraw a different sequence");
    });

    // D-11 reviewer nit: `prev` is cleared on a tier change, so the new tier's
    // sequence is never rejected merely because the OLD tier happened to deal
    // the identical chord indices. Asserted directly against the argument
    // HPE.sequence.pick() receives, rather than against pick()'s output,
    // because output-shape assertions here (sequence vs. reason) are true
    // whether or not `seq = null;` runs in setTier() - pick() almost always
    // returns one or the other regardless of `prev`.
    test("a tier change clears prev before the next pick() call",
      async () => {
        await enterSeqMode();
        const result = await b.eval(`
          const calls = [];
          const origPick = HPE.sequence.pick;
          HPE.sequence.pick = (d, rng, prev, t) => {
            calls.push(prev);
            return origPick(d, rng, prev, t);
          };
          try {
            setTier("advanced");
          } finally {
            HPE.sequence.pick = origPick;
          }
          return { prevArg: calls[0] };
        `);
        assert.strictEqual(result.prevArg, null,
          "setTier must clear seq before setOrder() calls pick, so pick's prev argument is null");
      });

    // hpfc.tier is TYPE-guarded exactly like hpfc.mode (D-7): a corrupted or
    // future value reads back as "basic", and writing it never drops a
    // sibling key already in the shared "hpfc" object.
    test("a corrupted hpfc.tier reads back as basic and sibling hpfc keys survive a tier write", async () => {
      await freshLoad();
      await b.eval(`
        const raw = JSON.parse(localStorage.getItem("hpfc") || "{}");
        raw.tier = "nonsense"; raw.someSiblingFeature = "keep-me";
        localStorage.setItem("hpfc", JSON.stringify(raw));
        return true;
      `);
      await navigate();
      const afterLoad = await b.eval(`return typeof tier === "string" ? tier : null;`);
      assert.strictEqual(afterLoad, "basic", "a corrupted hpfc.tier must read back as basic");
      await openSettingsPanel();
      await b.click("#modeS");
      await b.waitFor(`document.getElementById("modeS").getAttribute("aria-pressed") === "true"`,
        { label: "mode S to take effect" });
      await openSettingsPanel();
      await b.click("#tier-intermediate");
      await b.settle();
      const after = await stored();
      assert.strictEqual(after.tier, "intermediate");
      assert.strictEqual(after.someSiblingFeature, "keep-me", "an unrelated hpfc key must survive a tier write");
    });

    // D-6: NO_TIER_SEQUENCE (intermediate/advanced found nothing) gets a
    // tier-named message; the pre-existing NO_HOME_CHORD/TOO_FEW_CHORDS copy
    // (both basic-only reasons) is unchanged - covered by the existing
    // "unsupported deck" test in the "sequence mode" describe above.
    test("a NO_TIER_SEQUENCE deck shows a message naming the selected tier", async () => {
      await enterSeqMode();
      const m = await b.eval(`
        tier = "advanced";
        seq = { chords: null, reason: "NO_TIER_SEQUENCE" };
        render();
        return { front: document.getElementById("front").innerHTML, back: document.getElementById("back").innerHTML };
      `);
      assert.strictEqual(m.front, m.back);
      assert.match(m.front, /ADVANCED/, "the empty message must name the selected tier");
      assert.doesNotMatch(m.front, /doesn.t have enough simple chords/,
        "NO_TIER_SEQUENCE must not reuse the NO_HOME_CHORD/TOO_FEW_CHORDS copy");
    });

    // Owner request (2026-10-02): the difficulty engine must apply to
    // custom/user-added scales too, not only the three built-ins. Generates a
    // scale via the scale sheet (same pattern as the "unsupported deck" e2e
    // test), then confirms every tier's dealt progression on that deck is
    // either correctly classified or reports the D-6 empty reason.
    test("on a user-added scale, the selected tier is passed to pick and the dealt progression matches it",
      async () => {
        await freshLoad();
        await openSettingsPanel();
        await b.click("#deck-add");
        await b.waitFor(`getComputedStyle(document.getElementById("scale-box")).display !== "none"`,
          { label: "the scale sheet to open" });
        await b.eval(`
          const box = document.getElementById("scale-box");
          box.value = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
          box.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        `);
        await b.click("#scale-generate");
        await b.waitFor(`document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`,
          { label: "the generated deck chip" });
        await openSettingsPanel();
        await b.click("#modeS");
        await b.waitFor(`document.getElementById("modeS").getAttribute("aria-pressed") === "true"`,
          { label: "mode S to take effect" });
        for (const t of ["basic", "intermediate", "advanced"]) {
          await openSettingsPanel();
          await b.click(`#tier-${t}`);
          await b.waitFor(`document.getElementById("tier-${t}").getAttribute("aria-pressed") === "true"`,
            { label: `tier ${t} to take effect` });
          const check = await b.eval(`
            return {
              deckIsCustom: deckId.startsWith("custom:"),
              empty: !(seq && seq.chords),
              reason: seq && seq.reason,
              tierOf: (seq && seq.chords) ? HPE.sequence.tierOf(deck(), seq.chords) : null,
            };
          `);
          assert.ok(check.deckIsCustom, "the generated deck must be the active deck");
          if (check.empty) {
            assert.ok(["NO_HOME_CHORD", "TOO_FEW_CHORDS", "NO_TIER_SEQUENCE"].includes(check.reason),
              `tier ${t} on the custom deck: unexpected empty reason ${check.reason}`);
          } else {
            assert.strictEqual(check.tierOf, t, `tier ${t} on the custom deck dealt a ${check.tierOf} progression`);
          }
        }
      });

    // 2026-10-02 panel-fit bounce: the Difficulty group's collapsed top
    // margin must never eat into the gap BELOW it too (it used to, via a
    // symmetric negative margin-bottom hardcoded to a ramp step that desynced
    // from the panel's actual gap once a narrower media query tightened it -
    // see "#panel-tier-group" in the CSS). No tier button may ever overlap
    // another panel element, and the gap from the last tier button down to
    // the next heading must be at least as big as the panel's own ordinary
    // group-to-group gap (minus 1px slack), i.e. a real group boundary, not
    // a squeezed or negative one.
    test("the Difficulty group never overlaps the next panel element, and its gap to the next heading is a real group gap",
      async () => {
        for (const [w, h, mode] of [[1024, 700, "S"], [320, 568, "S"], [1024, 700, "A"]]) {
          await freshLoad();
          await b.setViewport(w, h, w < h);
          await b.settle();
          await openSettingsPanel();
          await b.click(`#mode${mode}`);
          await b.waitFor(`document.getElementById("mode${mode}").getAttribute("aria-pressed") === "true"`,
            { label: `mode ${mode} to take effect` });
          await openSettingsPanel();
          const m = await b.eval(`
            const rect = el => el.getBoundingClientRect();
            const hit = (a, k) => a.left < k.right && a.right > k.left && a.top < k.bottom && a.bottom > k.top;
            const panel = document.getElementById("settings-panel");
            const panelEls = [...panel.querySelectorAll("*")].filter(el =>
              !document.getElementById("panel-tier-group").contains(el) && el !== document.getElementById("panel-tier-group"));
            const tierBtns = ["tier-basic", "tier-intermediate", "tier-advanced"].map(id => rect(document.getElementById(id)));
            const overlaps = [];
            for (const br of tierBtns) for (const el of panelEls) {
              if (hit(br, rect(el))) overlaps.push(el.tagName + (el.id ? "#" + el.id : "") + (el.className ? "." + el.className : ""));
            }
            const headings = [...panel.querySelectorAll(".panel-heading")].map(h => ({ text: h.textContent.trim(), r: rect(h) }));
            const scalesHeading = headings.find(h => h.text === "Scales");
            const lastBtnBottom = Math.max(...tierBtns.map(r => r.bottom));
            const gapToScales = scalesHeading ? scalesHeading.r.top - lastBtnBottom : null;
            // Reference gap: between the two groups that are NOT the tier
            // group - Scales heading top vs the end of the Difficulty group's
            // own predecessor chain is unavailable without another collapsed
            // margin to compare against, so use the gap already measured
            // elsewhere in this deck: the Print group's heading vs the
            // Scales group's own bottom edge, both ordinary (uncollapsed)
            // group boundaries.
            const scalesGroup = document.getElementById("panel-scales-group");
            const printHeading = headings.find(h => h.text === "Print this deck");
            const ordinaryGap = printHeading ? printHeading.r.top - rect(scalesGroup).bottom : null;
            return { overlaps, gapToScales, ordinaryGap };
          `);
          assert.deepStrictEqual(m.overlaps, [],
            `${w}x${h} mode ${mode}: a tier button overlaps another panel element: ${JSON.stringify(m.overlaps)}`);
          assert.ok(m.gapToScales >= m.ordinaryGap - 1,
            `${w}x${h} mode ${mode}: gap to Scales heading (${m.gapToScales}) must be >= the panel's ordinary group gap (${m.ordinaryGap}) minus 1px`);
        }
      });
  });

  /* ---------------------------------------------------------------- *
   * card swipe (Tinder-style drag) - docs/plans/2026-09-29-card-swipe-animation.md
   * ---------------------------------------------------------------- */
  describe("card swipe", () => {
    // Computed .scene transform as {a, b, m41} (cos, sin, translateX), or
    // {none: true} for "none". translate3d + rotate forces a 3D matrix, so
    // both matrix() and matrix3d() forms are handled.
    async function sceneXform() {
      return b.eval(`
        const t = getComputedStyle(document.querySelector(".scene")).transform;
        if (t === "none") return { none: true, a: 1, b: 0, m41: 0 };
        const m3 = /^matrix3d\\(([^)]+)\\)$/.exec(t);
        if (m3) {
          const v = m3[1].split(",").map(Number);
          return { none: false, a: v[0], b: v[1], m41: v[12] };
        }
        const v = /^matrix\\(([^)]+)\\)$/.exec(t)[1].split(",").map(Number);
        return { none: false, a: v[0], b: v[1], m41: v[4] };
      `);
    }
    const sceneAnimCount = () => b.eval(`return document.querySelector(".scene").getAnimations().length;`);
    const sceneStyle = () => b.eval(`
      const s = document.querySelector(".scene");
      return { transform: s.style.transform, willChange: s.style.willChange };
    `);

    // A held touch drag the test can move and release/cancel in further
    // stages, without CDP re-dispatching touchStart (which would start a
    // second, unrelated gesture).
    async function startDrag(selector) {
      const box = await b.eval(`
        const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      `);
      await b.waitForPendingSettle();
      const t0 = Date.now() / 1000;
      const pt = (dx, dy) => touchPoint(box.x + dx, box.y + (dy || 0));
      await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(0, 0), timestamp: t0 });
      return {
        async move(dx, ms, dy) {
          await b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(dx, dy), timestamp: t0 + ms / 1000 });
        },
        async release(dx, ms, dy) {
          await b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(dx, dy), timestamp: t0 + ms / 1000 });
          // Armed (and awaited) before touchEnd, not after: a real touchend's
          // lostpointercapture can fire before an eval sent only after the
          // dispatch would get around to attaching the listener, which would
          // miss it and degrade every settle below to its full timeout. See
          // endMouseDragForReal and cdp.js's armPendingSettle.
          await b.armPendingSettle();
          await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], timestamp: t0 + ms / 1000 + 0.001 });
          // See b.settleAfterRealRelease / endMouseDragForReal: a real
          // touchend's lostpointercapture fires asynchronously and can land
          // on a later test's drag if that later drag does not wait for it
          // first - deferred (not awaited) here for the same reason it is
          // deferred in cdp.js's drag(): a caller that inspects animation
          // state right after this release must see it immediately.
          b.settleAfterRealRelease();
        },
      };
    }

    test("card swipe: the card follows a held drag with a tilt, then springs back below the threshold", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      const g = await startDrag("#card");
      await g.move(80, 0);
      const held = await sceneXform();
      assert.ok(Math.abs(held.m41 - 80) <= 1, `m41 ${held.m41} should be ~80`);
      assert.ok(held.b > 0, `expected a positive rotation, got b=${held.b}`);
      assert.strictEqual(await sceneStyle().then((s) => s.willChange), "transform");
      const cardXf = await cardTransform();
      assert.strictEqual(rotationAmount(cardXf), 0, "the .card itself must not rotate during a swipe");
      await g.release(12, 400);
      assert.strictEqual(await sceneAnimCount(), 1, "release below threshold should start exactly one spring-back animation");
      assert.strictEqual(await countText(), `1 / ${n}`, "a spring-back must not step the deck");
      await b.finishAnimations();
      const after = await sceneXform();
      assert.strictEqual(after.none, true, ".scene transform should be none once settled");
      const style = await sceneStyle();
      assert.strictEqual(style.willChange, "", "willChange must be cleared once settled");
      const touchAction = await b.eval(`return getComputedStyle(document.querySelector(".scene")).touchAction;`);
      assert.strictEqual(touchAction, "none");
    });

    test("card swipe: the card is swipe-only - main and .scene never scroll or zoom", async () => {
      await freshLoad();
      // Owner decision (2026-09-30): a device log from iOS 18.7 WebKit showed
      // `pan-y pinch-zoom` letting the scroll recogniser claim a clearly
      // horizontal swipe once accumulated vertical drift crossed ~10px, well
      // under the ~6.3px seen on swipes that committed cleanly - so a touch
      // on the card must never scroll or zoom the page at all.
      const touchAction = await b.eval(`return {
        main: getComputedStyle(document.querySelector("main")).touchAction,
        scene: getComputedStyle(document.querySelector(".scene")).touchAction,
      };`);
      assert.strictEqual(touchAction.main, "none", "main must be swipe-only");
      assert.strictEqual(touchAction.scene, "none", ".scene must be swipe-only");
    });

    test("card swipe: the tilt is SWIPE_TILT_DEG_PER_PX per px and clamps at SWIPE_TILT_MAX_DEG", async () => {
      await freshLoad();
      const angle = (x) => Math.atan2(x.b, x.a) * 180 / Math.PI;
      let g = await startDrag("#card");
      await g.move(100, 0);
      assert.ok(Math.abs(angle(await sceneXform()) - 5) <= 0.2, "100px should tilt ~5deg");
      await g.release(100, 50);
      await b.finishAnimations();

      g = await startDrag("#card");
      await g.move(400, 0);
      assert.ok(Math.abs(angle(await sceneXform()) - 8) <= 0.2, "400px should clamp to 8deg");
      await g.release(400, 50);
      await b.finishAnimations();

      g = await startDrag("#card");
      await g.move(-400, 0);
      assert.ok(Math.abs(angle(await sceneXform()) - (-8)) <= 0.2, "-400px should clamp to -8deg");
      await g.release(-400, 50);
      await b.finishAnimations();
    });

    test("card swipe: a commit flies the card out, then steps and deals the next card in from the opposite side", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      await b.drag("#card", [[-40, 100], [-80, 200], [-120, 300]]);
      const mid = await b.eval(`
        const anims = document.querySelector(".scene").getAnimations();
        const a = anims[0];
        const effect = a.effect.getKeyframes();
        const timing = a.effect.getComputedTiming();
        return {
          count: (document.getElementById("count").textContent || "").trim(),
          n: anims.length,
          duration: timing.duration,
          easing: a.effect.getTiming().easing,
          lastX: parseFloat(effect[effect.length - 1].transform.match(/translate3d\\(([-\\d.]+)px/)[1]),
        };
      `);
      assert.strictEqual(mid.count, `1 / ${n}`, "count must not move before the fly-out finishes");
      assert.strictEqual(mid.n, 1);
      assert.strictEqual(mid.duration, 220);
      assert.strictEqual(mid.easing, "cubic-bezier(0.4, 0, 1, 1)");
      assert.ok(mid.lastX < -380, `fly-out should end well off-screen, got ${mid.lastX}`);

      await b.eval(`document.querySelector(".scene").getAnimations().forEach(a => a.finish()); return true;`);
      await b.waitFor(`(document.getElementById("count").textContent || "").trim() === "2 / ${n}"`,
        { label: "the fly-out landing to advance the count" });
      const front = await b.eval(`return document.getElementById("front").textContent;`);
      const chord2 = await b.eval(`return deck().chords[order[1]].main;`);
      assert.ok(front.includes(chord2), "front face should hold the second chord after landing");
      const enter = await b.eval(`
        const a = document.querySelector(".scene").getAnimations()[0];
        const kf = a.effect.getKeyframes();
        return { x: parseFloat(kf[0].transform.match(/translate3d\\(([-\\d.]+)px/)[1]), opacity: +kf[0].opacity };
      `);
      assert.strictEqual(enter.x, 24);
      assert.strictEqual(enter.opacity, 0);
      await b.finishAnimations();
      assert.strictEqual(await sceneAnimCount(), 0);
      const settled = await sceneXform();
      assert.strictEqual(settled.none, true);
      assert.strictEqual(await sceneStyle().then((s) => s.willChange), "",
        "willChange must be cleared once a committed swipe lands, not only on a spring-back");
    });

    test("card swipe: a short fast fling commits and a slow drag of the same length does not", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;

      await b.drag("#card", [[-8, 10], [-15, 25]]);
      await b.finishAnimations();
      await expectCount(`2 / ${n}`, "a fast 15px fling should commit");

      await freshLoad();
      // The trailing 100ms window (500-600ms) must itself read as moving but
      // under the fling threshold (~0.05 px/ms here) - a window with zero
      // trailing velocity (e.g. a last leg with no intermediate point) would
      // pass for the wrong reason: "not fast enough" versus "not moving at
      // all" are different guards, and this drag is testing the former.
      await b.drag("#card", [[-8, 300], [-11, 520], [-15, 600]]);
      await b.finishAnimations();
      await expectCount(`1 / ${n}`, "a slow 15px drag should not commit");

      // (a): the whole gesture averages ~0.12 px/ms, under the fling
      // threshold, but the last 100ms window (OV3's fling window) alone is
      // a fling.
      await freshLoad();
      await b.drag("#card", [[-3, 100], [-17, 140]]);
      await b.finishAnimations();
      await expectCount(`2 / ${n}`, "a fling within the trailing window should commit");

      // (b): the flick ages out of the fling window once the pointer sits
      // still before release.
      await freshLoad();
      await b.drag("#card", [[-15, 30], [-15, 230]]);
      await b.finishAnimations();
      await expectCount(`1 / ${n}`, "a stale flick (held still before release) should not commit");
    });

    test("card swipe: a horizontal swipe with real vertical drift (the iOS device case) still commits", async () => {
      // The exact device shape that iOS 18.7 WebKit was cancelling under
      // `pan-y pinch-zoom` (dx -80, dy ~12, ~100ms, angle a few degrees off
      // horizontal): this proves the APP logic never rejected that gesture -
      // only the browser's own scroll recogniser did, which touch-action:none
      // now prevents from ever claiming it.
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      await b.drag("#card", [[-40, 50, 6], [-80, 100, 12]]);
      await b.finishAnimations();
      await expectCount(`2 / ${n}`, "the device-case swipe (dx -80, dy 12, ~100ms) must commit");
    });

    test("card swipe: a tap-sized flick never steps and the tap still flips", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      await b.drag("#card", [[-4, 5], [-8, 10]]);
      await b.finishAnimations();
      await expectCount(`1 / ${n}`, "a tap-sized flick must not navigate");
      // A tap that small (below SWIPE_SLOP_PX) is recognised by the browser's
      // own touch-to-click synthesis as a tap, and the card's click listener
      // (unrelated to the swipe code) flips it - the swipe handling must not
      // suppress that.
      assert.strictEqual(await cardFlipped(), true, "a tap-sized flick must still flip the card");
      await b.click("#card");
      assert.strictEqual(await cardFlipped(), false, "a plain mouse click must flip it back");
    });

    test("card swipe: a jitter hop below the slop radius clears with no spring-back animation", async () => {
      await freshLoad();
      // Q9: !moved implies |dx| <= SWIPE_SLOP_PX, so a spy on scene.animate
      // (not a getAnimations().length read right after pointerup, which
      // races the 260ms spring-back and could pass on the unfixed code under
      // a slow CI frame) is the only reliable way to prove no animation ever
      // started.
      await b.eval(`
        window.__animateCalls = 0;
        const scene = document.querySelector(".scene");
        const orig = scene.animate.bind(scene);
        scene.animate = (...args) => { window.__animateCalls++; return orig(...args); };
        return true;
      `);
      const g = await startDrag("#card");
      await g.release(6, 50);
      const calls = await b.eval(`return window.__animateCalls;`);
      assert.strictEqual(calls, 0, "a real touch drag below the slop radius must not start any animation");
      const xf = await sceneXform();
      assert.strictEqual(xf.none, true, ".scene transform must be cleared immediately, not animated back");
      assert.strictEqual(await cardFlipped(), true,
        "the tap-sized touch must still flip the card, via #card's own click listener");
    });

    test("card swipe: a mouse drag commits without flipping, a mouse click still flips, a short mouse drag springs back without flipping", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      await b.drag("#card", [[-60, 100], [-120, 200]], { pointer: "mouse" });
      await b.finishAnimations();
      await expectCount(`2 / ${n}`, "a mouse drag past the threshold should commit");
      assert.strictEqual(await cardFlipped(), false, "a committing drag must not flip the card");
      await b.click("#card");
      assert.strictEqual(await cardFlipped(), true, "a mouse click must still flip");
      await b.click("#card");
      assert.strictEqual(await cardFlipped(), false);
      // Q29/finding 5: the count was already `2 / n` from the commit above
      // and a spring-back never changes it, so waiting on the count proves
      // nothing about the spring-back itself. b.settle() waits for the real
      // animation queue (and the task queue behind it, e.g. eatClick's own
      // decay) to go quiet instead, so a flip that would only land on a LATER
      // task than finishAnimations() forced is not missed.
      await b.drag("#card", [[-8, 100], [-15, 300]], { pointer: "mouse" });
      await b.finishAnimations();
      await b.settle();
      const flipped = await cardFlipped();
      if (flipped) {
        const diag = await b.eval(`
          return {
            transform: getComputedStyle(document.querySelector(".scene")).transform,
            eatClick: typeof eatClick !== "undefined" ? eatClick : null,
          };
        `);
        assert.fail(
          `a spring-back must not flip (.scene transform=${diag.transform}, eatClick=${diag.eatClick})`,
        );
      }
      assert.strictEqual(
        (await b.eval(`return (document.getElementById("count").textContent || "").trim();`)),
        `2 / ${n}`,
        "a short slow mouse drag must spring back, not navigate",
      );
    });

    test("card swipe: a right-click at the rest position during the fly-out does not eat the next click", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      await installFlyoutPauseHook();
      await b.drag("#card", [[-40, 100], [-80, 200], [-120, 300]]);
      await pauseFlyoutAnimation(150);
      const rest = await b.eval(`
        const r = flight.rect;
        return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
      `);
      // Q11: a CDP right-button press gives pointerdown with button 2 plus
      // contextmenu, and no "click" ever fires for it. The capture handler's
      // pointerdown still lands the pending flight (any button does), so
      // this also advances the count by one - that landing, not a bug, is
      // why the assertion below expects landing index + 1 for the Enter step.
      await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rest.x, y: rest.y, button: "right", clickCount: 1 });
      await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rest.x, y: rest.y, button: "right", clickCount: 1 });
      await b.waitFor(`(document.getElementById("count").textContent || "").trim() === "2 / ${n}"`,
        { label: "the right-click to land the flight" });
      // Not a mouse click on #next: a real click there fires its own
      // pointerdown first, and that pointerdown's capture handler resets
      // eatClick from #next's own target (outside the card/rest box, so
      // "inside" is false there regardless of this guard) before the click
      // event itself ever fires - so a mouse click on #next can't tell a
      // stuck eatClick apart from one that was never stuck (confirmed
      // empirically: it passes with the `sw_eatclick_any_button` mutant
      // applied too). A keyboard Enter on a freshly focused #next is not
      // used either: this harness's b.key() sends only keyDown/keyUp with no
      // `char` event, which does not trigger a button's native
      // Enter-activates-click at all. And even a native activation click
      // arrives with no pointerdown of its own, exactly like .click() below,
      // so it could not discriminate a stuck eatClick from one that was
      // never stuck anyway.
      // A programmatic .click() is the one action that reaches the
      // document's capture click listener with no pointerdown of its own
      // (the same technique the "no-flight capture branch" test below uses
      // as its positive control), so it sees eatClick exactly as the
      // right-click left it.
      await b.eval(`document.getElementById("next").click(); return true;`);
      await expectCount(`3 / ${n}`, "a later click must still step, unmasked by the right-click");
    });

    test("card swipe: the no-flight capture branch resets eatClick on every real pointerdown", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      // Positive control: writing eatClick = true through b.eval, then a
      // PROGRAMMATIC .click() (which fires no pointerdown of its own, so the
      // capture handler's reset never runs), proves the eval reaches the
      // live top-level binding: the click must be eaten and #next must not step.
      await b.eval(`eatClick = true; return true;`);
      await b.eval(`document.getElementById("next").click(); return true;`);
      await expectCount(`1 / ${n}`, "a stale eatClick=true must still eat a programmatic click");

      // Q12: set eatClick = true again, then a REAL click (mousedown +
      // mouseup -> a genuine pointerdown reaches the no-flight capture
      // branch first and resets eatClick to false before the click fires).
      await b.eval(`eatClick = true; return true;`);
      await b.click("#next");
      await expectCount(`2 / ${n}`, "a real pointerdown must reset eatClick before its own click fires");
    });

    test("card swipe: a flipped card keeps its back face during the fly-out and the next card arrives front-up", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      await b.click("#card");
      assert.strictEqual(await cardFlipped(), true);
      await b.drag("#card", [[-40, 100], [-80, 200], [-120, 300]]);
      const midFlipped = await cardFlipped();
      assert.strictEqual(midFlipped, true, ".card must keep .flip mid-flight");
      await b.eval(`document.querySelector(".scene").getAnimations().forEach(a => a.finish()); return true;`);
      await b.waitFor(`(document.getElementById("count").textContent || "").trim() === "2 / ${n}"`,
        { label: "the fly-out to land" });
      assert.strictEqual(await cardFlipped(), false, ".flip must be gone once the new card lands");
      const frontHidden = await b.eval(`return document.getElementById("front").getAttribute("aria-hidden");`);
      assert.notStrictEqual(frontHidden, "true");
      const cardXf = await cardTransform();
      assert.strictEqual(rotationAmount(cardXf), 0, "the reset must be immediate, not mid-transition");
      const cardAnims = await b.eval(`return document.getElementById("card").getAnimations().filter(a => a instanceof CSSTransition).length;`);
      assert.strictEqual(cardAnims, 0, "the flip reset must not animate while the new card deals in");
    });

    test("card swipe: a tap during the fly-out lands it once and never flips the wrong card", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      await b.drag("#card", [[-40, 100], [-80, 200], [-120, 300]]);
      // A real mouse b.click() here goes through mousedown/mouseup, which
      // starts and ends a fresh, trivial drag on #card via pointer capture -
      // Chrome then never fires "click" at all, so a mouse click can never
      // reach the target and can't exercise eatClick's guard either way.
      // Wait out the drag's OWN eatClick (set by release() on the commit,
      // same as the eatClickClear() pattern below) so it cannot mask the
      // guard under test, then dispatch a real pointerdown (so the capture
      // handler's eatClick assignment - the one under test - actually runs)
      // followed by a genuine click() (which fires no pointerdown of its
      // own, so it cannot re-trigger the guard by accident, only observe it).
      await b.waitFor(`!eatClick`, { label: "eatClick to decay" });
      await b.eval(`
        const el = document.getElementById("card");
        el.dispatchEvent(new PointerEvent("pointerdown", {
          bubbles: true, cancelable: true, isPrimary: true, pointerId: 999, button: 0,
        }));
        el.click();
        return true;
      `);
      assert.strictEqual(await countText(), `2 / ${n}`, "a tap during flight should land it immediately");
      assert.strictEqual(await cardFlipped(), false, "the landing tap must not also flip the new card");
      const outAnim = await b.eval(`return document.querySelector(".scene").getAnimations().some(a => a.effect.getComputedTiming().duration === 220);`);
      assert.strictEqual(outAnim, false, "the fly-out animation must be gone once landed");
    });

    test("card swipe: buttons and arrows during the fly-out land it first, never dropping or doubling a step", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      // eatClick decays on a setTimeout(0) queued at release; wait it out so
      // the deliberate action below is never mistaken for the drag's own
      // trailing tap-click.
      const eatClickClear = () => b.waitFor(`!eatClick`, { label: "eatClick to decay" });

      await b.drag("#card", [[-40, 100], [-80, 200], [-120, 300]]);
      await eatClickClear();
      await b.click("#next");
      await expectCount(`3 / ${n}`, "a #next click during flight should land then step");

      await b.drag("#card", [[-40, 100], [-80, 200], [-120, 300]]);
      await eatClickClear();
      await b.key("ArrowRight", "ArrowRight", 39);
      await expectCount(`5 / ${n}`, "an ArrowRight during flight should land then step");

      await b.drag("#card", [[-40, 100], [-80, 200], [-120, 300]]);
      await eatClickClear();
      await b.eval(`document.getElementById("next").click(); return true;`);
      assert.strictEqual(await countText(), `7 / ${n}`, "a programmatic .click() during flight should land then step");
      await b.finishAnimations();
      assert.strictEqual(await countText(), `7 / ${n}`, "finishing leftover animations must not add another step");
    });

    test("card swipe: Enter on a focused #next after a settled touch swipe still steps", async () => {
      // Regression: release() used to arm eatClick on every moved touch drag
      // with no decay, relying on a later click or pointerdown to clear it.
      // A touch drag never produces a trailing click, so eatClick stayed
      // stuck true - the document click listener (capture phase) then ate
      // the very next click ANYWHERE, including the native click a browser
      // synthesizes for Enter on a focused button, well after the swipe had
      // fully settled.
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      await b.drag("#card", [[-40, 100], [-80, 200], [-120, 300]]);
      await b.finishAnimations();
      await expectCount(`2 / ${n}`, "the touch swipe should commit and land");
      await new Promise((resolve) => setTimeout(resolve, 50));
      await b.eval(`document.getElementById("next").focus(); return true;`);
      await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
      await b.send("Input.dispatchKeyEvent", { type: "char", key: "Enter", code: "Enter", text: "\r", unmodifiedText: "\r", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
      await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
      await expectCount(`3 / ${n}`, "Enter on #next after a settled touch swipe must still step");
    });

    test("card swipe: a click right after a cancelled drag is not eaten", async () => {
      // Same regression as above, via the Q15 cancel path: release(e, true)
      // must never arm eatClick at all, since a cancelled interaction never
      // has a trailing click to consume it either. eatClick's own decay is a
      // setTimeout(0), which reliably clears it before any CDP round-trip (a
      // real Enter keypress included) can land - so a `!cancelled` regression
      // is only observable in the narrow window before that decay fires.
      // Dispatch the pointercancel and the click in ONE synchronous script so
      // the click lands in the exact same task as release(e, true), before
      // the decay's setTimeout(0) has any chance to run.
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      await b.eval(`
        window.__dragId = null;
        document.getElementById("card").addEventListener(
          "pointerdown", (e) => { window.__dragId = e.pointerId; }, { once: true },
        );
        return true;
      `);
      const g = await startDrag("#card");
      await g.move(80, 0);
      await b.eval(`
        const id = window.__dragId;
        document.getElementById("card").dispatchEvent(new PointerEvent("pointercancel", {
          pointerId: id, isPrimary: true, clientX: 0, bubbles: true,
        }));
        document.getElementById("next").click();
        return true;
      `);
      await b.finishAnimations();
      await expectCount(`2 / ${n}`, "a click immediately after a cancelled drag must not be eaten");
      // The pointercancel above was a synthetic PointerEvent, not a real CDP
      // touch release, so the underlying touch (id 1) is still "down" as far
      // as Chrome's input pipeline is concerned; end it for real or the next
      // test's touchstart with the same id misbehaves.
      await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    });

    test("card swipe: a real touch tap at the card's REST position during flight lands it and must not flip", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      await b.setViewport(380, 800, true);
      await b.settle();
      try {
        // .scene carries the fly-out transform, so #card's OWN rect moves
        // with it mid-flight - capture the rest position before dragging.
        const rest = await b.eval(`
          const r = document.getElementById("card").getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        `);
        await installFlyoutPauseHook();
        await b.drag("#card", [[-40, 100], [-80, 200], [-120, 300]]);
        await pauseFlyoutAnimation(150);
        // A real touch at the REST centre: mid-flight the card has visually
        // moved away, so this point hit-tests to some other element, not
        // #card - unlike a synthetic pointerdown dispatched on #card itself.
        await b.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: touchPoint(rest.x, rest.y),
        });
        await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        assert.strictEqual(await countText(), `2 / ${n}`, "a real tap at the rest position during flight should land it");
        assert.strictEqual(await cardFlipped(), false, "the landing tap must not also flip the new card");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("card swipe: a second real swipe from the REST position during flight is not dropped", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      await b.setViewport(380, 800, true);
      await b.settle();
      try {
        const rest = await b.eval(`
          const r = document.getElementById("card").getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        `);
        await installFlyoutPauseHook();
        await b.drag("#card", [[-40, 100], [-80, 200], [-120, 300]]);
        await pauseFlyoutAnimation(150);
        const t0 = Date.now() / 1000;
        const pt = (dx) => touchPoint(rest.x + dx, rest.y);
        await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(0), timestamp: t0 });
        await b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(-40), timestamp: t0 + 0.1 });
        await b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(-80), timestamp: t0 + 0.2 });
        await b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(-120), timestamp: t0 + 0.3 });
        await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], timestamp: t0 + 0.3 });
        await b.finishAnimations();
        assert.strictEqual(await countText(), `3 / ${n}`,
          "a second real swipe starting at the rest position during flight must not be dropped");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("card swipe: a drag with the settings panel open, or opened mid-drag, does nothing", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      await openSettingsPanel();
      await b.drag("#card", [[-60, 100], [-120, 200]]);
      await b.finishAnimations();
      await expectCount(`1 / ${n}`, "a drag while the settings panel is open must not navigate");
      let xf = await sceneXform();
      assert.strictEqual(xf.none, true);
      await b.eval(`document.getElementById("settings-scrim")?.click(); return true;`).catch(() => {});
      await b.waitFor(`document.getElementById("settings-panel").hidden === true`, { label: "panel to close" });

      const g = await startDrag("#card");
      await g.move(-120, 100);
      // Q10: tried a real openPanel() call here instead of the direct
      // panelOpen assignment. At this 900x900 viewport openPanel() is off
      // the desktopMQ, so it inerts panelBackground, which includes <main> -
      // and measured against sw_panel_guard_dropped, an inert ancestor
      // silently swallows every further pointer event to #card, captured or
      // not: the test's own g.release() touch never reaches release(), so
      // count stays unchanged under BOTH the fixed code and the mutant - the
      // rewrite cannot discriminate the guard at all. The direct assignment
      // is kept for that reason (M6).
      await b.eval(`panelOpen = true; return true;`);
      await g.release(-120, 200);
      await b.finishAnimations();
      await expectCount(`1 / ${n}`, "opening the panel mid-drag must suppress the release");
      xf = await sceneXform();
      assert.strictEqual(xf.none, true);
    });

    test("card swipe: a drag with the scale sheet open does nothing", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      await openSheet();
      const open = await b.eval(`return sheetOpen === true;`);
      assert.strictEqual(open, true, "sheetOpen must be true once the sheet is shown");
      await b.drag("#card", [[-60, 100], [-120, 200]]);
      await b.finishAnimations();
      await expectCount(`1 / ${n}`, "a drag while the scale sheet is open must not navigate");

      // The sheet's own preview SVG occludes #card at this viewport, so a
      // fresh physical touch there never reaches #card at all - the guard
      // above is only exercised by coincidence of that occlusion. Open the
      // sheet mid-drag instead (pointer capture routes the released touch to
      // #card regardless of what now covers it).
      //
      // Q10: tried a real showSheet() call here too. showSheet()'s own
      // `background` array also includes <main>, so it inerts the same
      // ancestor openPanel() does - and the identical finding applies
      // (measured against sw_sheet_guard_dropped): an inert ancestor
      // swallows every further pointer event to #card regardless of pointer
      // capture, so the test's own g.release() touch never reaches
      // release() under either the fixed code or the mutant. The rewrite
      // can't discriminate the guard, so the direct assignment is kept
      // (M6).
      await b.eval(`hideSheet(); return true;`);
      const g = await startDrag("#card");
      await g.move(-120, 100);
      await b.eval(`sheetOpen = true; return true;`);
      await g.release(-120, 200);
      await b.finishAnimations();
      await expectCount(`1 / ${n}`, "opening the scale sheet mid-drag must suppress the release");
    });

    test("card swipe: under reduced motion the swipe steps instantly with no animation", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      try {
        await b.send("Emulation.setEmulatedMedia", {
          media: "", features: [{ name: "prefers-reduced-motion", value: "reduce" }],
        });
        const g = await startDrag("#card");
        await g.move(-80, 0);
        const held = await sceneXform();
        assert.strictEqual(held.none, true, "reduced motion must not move .scene while held");
        await g.release(-120, 100);
        assert.strictEqual(await countText(), `2 / ${n}`, "reduced motion must step synchronously on release");
        const anims = await b.eval(`return document.getAnimations().length;`);
        assert.strictEqual(anims, 0, "reduced motion must not animate anything");
      } finally {
        await b.send("Emulation.setEmulatedMedia", { media: "", features: [] });
      }
    });

    test("card swipe: a vertical drag never scrolls the page and does not step, at 320x568 and 844x390", async () => {
      // Superseded (2026-09-30, owner decision - the card is swipe-only): a
      // vertical drag used to be handed to the browser's native scroll under
      // `pan-y pinch-zoom`, ending in a pointercancel. A device log from iOS
      // 18.7 WebKit showed that same scroll recogniser claiming even a
      // clearly HORIZONTAL swipe once vertical drift crossed ~10px - so
      // main/.scene are now touch-action:none and a touch on the card never
      // scrolls or cancels at all; this test now asserts the opposite of what
      // it asserted before.
      try {
        for (const [w, h] of [[320, 568], [844, 390]]) {
          await freshLoad();
          await b.setViewport(w, h, w < h);
          await b.settle();
          const n = (await decksMeta())[0].chords;
          await b.eval(`window.__pcOnce = 0; document.getElementById("card").addEventListener("pointercancel", () => { window.__pcOnce++; }, { once: true }); return true;`);
          if (h > w) {
            // CHROME_BUDGET fits every viewport with no page overflow by design
            // (untouched here), so there would be nothing to scroll without a
            // forced spacer even if scrolling were still possible here.
            // An absolutely-positioned spacer, not body.style.minHeight: main
            // is a flex:1 child of body, so raising body's min-height used to
            // let main (and the centred #card inside it) grow to fill the
            // extra space and drift far down the now-2000px column - well
            // past the 568px viewport, which put the drag's start point off
            // #card entirely (elementFromPoint returned null there) and made
            // the "no scroll" result meaningless. A spacer removed from flow
            // adds scrollable height without moving #card at all.
            await b.eval(`
              const spacer = document.createElement("div");
              spacer.style.cssText = "position:absolute; top:0; left:0; height:2000px; width:1px; pointer-events:none;";
              document.body.appendChild(spacer);
              return true;
            `);
          }
          const before = await b.eval(`return window.scrollY;`);
          await b.drag("#card", [[15, 100, -100]]);
          await b.finishAnimations();
          assert.strictEqual(await countText(), `1 / ${n}`, `${w}x${h}: a vertical drag must not step the deck`);
          const xf = await sceneXform();
          assert.strictEqual(xf.none, true, `${w}x${h}: .scene transform must settle to none`);
          const scrollY = await b.eval(`return window.scrollY;`);
          assert.strictEqual(scrollY, before, `${w}x${h}: the page must never scroll from a drag on the card`);
          const pc = await b.eval(`return window.__pcOnce;`);
          assert.strictEqual(pc, 0, `${w}x${h}: touch-action:none must never produce a pointercancel`);
        }
      } finally {
        // Viewport is a browser-level setting; restore it here so a throw
        // mid-loop cannot leak a small viewport into the next test.
        await b.setViewport(900, 900, false);
      }
    });

    test("card swipe: a card in flight never widens the page, at 380x800 and 844x390", async () => {
      try {
        for (const [w, h] of [[380, 800], [844, 390]]) {
          await freshLoad();
          await b.setViewport(w, h, w < h);
          await b.settle();
          let g = await startDrag("#card");
          await g.move(100, 0);
          await b.eval(`window.scrollTo(500, 0); return true;`);
          let m = await b.eval(`return { scrollX: window.scrollX, scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth };`);
          // Compare against the viewport width we asked for (w), not
          // window.innerWidth: on a mobile-emulated viewport, once page
          // content genuinely overflows horizontally, Chrome's mobile layout
          // can widen the layout viewport itself to fit that content (the
          // classic "horizontal scroll on mobile" failure mode) - innerWidth
          // then grows right along with scrollWidth and the two stay equal,
          // silently passing a scrollWidth<=innerWidth check even though the
          // page did get wider than the device. w is fixed by setViewport()
          // and is unaffected by any such widening, so it is the invariant
          // that actually catches main{overflow-x:clip} being dropped.
          assert.strictEqual(m.scrollX, 0, `${w}x${h}: held drag must not scroll horizontally`);
          assert.ok(m.scrollWidth <= w, `${w}x${h}: held drag must not widen the page (${m.scrollWidth} > ${w})`);
          await g.release(0, 50);
          await b.finishAnimations();

          g = await startDrag("#card");
          await g.move(-40, 100);
          await g.release(-120, 200);
          await b.eval(`
            const a = document.querySelector(".scene").getAnimations()[0];
            if (a) a.currentTime = 150;
            window.scrollTo(500, 0);
            return true;
          `);
          m = await b.eval(`return { scrollX: window.scrollX, scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth };`);
          assert.strictEqual(m.scrollX, 0, `${w}x${h}: a paused fly-out must not scroll horizontally`);
          assert.ok(m.scrollWidth <= w, `${w}x${h}: a paused fly-out must not widen the page (${m.scrollWidth} > ${w})`);
          await b.finishAnimations();
        }
      } finally {
        // The viewport is a browser-level setting, not a page one; restore it
        // here so a mid-loop assertion throw cannot leak it into the next
        // test (freshLoad() resets it before the next one, too).
        await b.setViewport(900, 900, false);
      }
    });

    test("card swipe: #count is written once per step, never per frame", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      await b.eval(`
        window.__countBatches = 0;
        new MutationObserver(() => { window.__countBatches++; })
          .observe(document.getElementById("count"), { childList: true, characterData: true, subtree: true });
        return true;
      `);
      const g = await startDrag("#card");
      for (let i = 1; i <= 12; i++) await g.move(-10 * i, i * 20);
      const duringMoves = await b.eval(`return window.__countBatches;`);
      assert.strictEqual(duringMoves, 0, "no #count write should happen while dragging");
      await g.release(-120, 260);
      await b.finishAnimations();
      await expectCount(`2 / ${n}`, "the drag should have committed");
      const total = await b.eval(`return window.__countBatches;`);
      assert.strictEqual(total, 1, "#count should be written exactly once for the whole step");
    });

    test("card swipe: a 2-card order and a 2-chord sequence (prev == next) animate and land", async () => {
      await freshLoad();
      await b.eval(`order = [0, 1]; idx = 0; render(); return true;`);
      const finish = () => b.eval(`document.querySelector(".scene").getAnimations().forEach(a => a.finish()); return true;`);
      await b.drag("#card", [[-40, 100], [-80, 200], [-120, 300]]);
      await finish();
      await b.waitFor(`(document.getElementById("count").textContent || "").trim() === "2 / 2"`,
        { label: "2-card order to advance" });
      await b.drag("#card", [[40, 100], [80, 200], [120, 300]]);
      await finish();
      await b.waitFor(`(document.getElementById("count").textContent || "").trim() === "1 / 2"`,
        { label: "2-card order to go back" });
      await b.drag("#card", [[-40, 100], [-80, 200], [-120, 300]]);
      await finish();
      await b.waitFor(`(document.getElementById("count").textContent || "").trim() === "2 / 2"`,
        { label: "2-card order to advance again" });

      await openSettingsPanel();
      await b.click("#modeS");
      await b.waitFor(`document.getElementById("modeS").getAttribute("aria-pressed") === "true"`,
        { label: "mode S to take effect" });
      await b.eval(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); return true;`);
      await b.waitFor(`document.getElementById("settings-panel").hidden === true`, { label: "panel to close" });
      await b.eval(`
        seq = { chords: [0, 10], style: seq.style };
        order = seq.chords.slice(); idx = 0; flipped = false;
        render();
        return true;
      `);
      await b.drag("#card", [[-40, 100], [-80, 200], [-120, 300]]);
      await finish();
      await b.waitFor(`(document.querySelector("#count .sr-only") || {}).textContent?.includes("chord 2 of 2")`,
        { label: "the rail to mark chord 2" });
      await b.drag("#card", [[-40, 100], [-80, 200], [-120, 300]]);
      await finish();
      await b.waitFor(`(document.querySelector("#count .sr-only") || {}).textContent?.includes("chord 1 of 2")`,
        { label: "the rail to wrap back to chord 1" });
    });

    test("card swipe: a printed card carries no transform", async () => {
      await freshLoad();
      const g = await startDrag("#card");
      await g.move(80, 0);
      try {
        await b.send("Emulation.setEmulatedMedia", { media: "print" });
        const xf = await b.eval(`return getComputedStyle(document.querySelector(".scene")).transform;`);
        assert.strictEqual(xf, "none", "a printed card must carry no swipe transform");
      } finally {
        await b.send("Emulation.setEmulatedMedia", { media: "" });
        await g.release(0, 50);
        await b.finishAnimations();
      }
    });

    test("card swipe: a pointercancel mid-drag springs back from the last move and does not step", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      await b.eval(`
        window.__dragId = null;
        document.getElementById("card").addEventListener(
          "pointerdown", (e) => { window.__dragId = e.pointerId; }, { once: true },
        );
        return true;
      `);
      const g = await startDrag("#card");
      await g.move(80, 0);
      await b.eval(`
        const id = window.__dragId;
        document.getElementById("card").dispatchEvent(new PointerEvent("pointercancel", {
          pointerId: id, isPrimary: true, clientX: 0, bubbles: true,
        }));
        return true;
      `);
      assert.strictEqual(await countText(), `1 / ${n}`, "a pointercancel must not step the deck");
      const anim = await b.eval(`
        const anims = document.querySelector(".scene").getAnimations();
        const a = anims[0];
        const kf = a ? a.effect.getKeyframes() : null;
        return {
          n: anims.length,
          duration: a ? a.effect.getComputedTiming().duration : null,
          x0: kf ? parseFloat(kf[0].transform.match(/translate3d\\(([-\\d.]+)px/)[1]) : null,
        };
      `);
      assert.strictEqual(anim.n, 1, "a pointercancel should spring back with exactly one animation");
      assert.strictEqual(anim.duration, 260);
      assert.ok(Math.abs(anim.x0 - 80) <= 1, `spring-back should start from the last real move (80), got ${anim.x0}`);
      await b.finishAnimations();
      const settled = await sceneXform();
      assert.strictEqual(settled.none, true);
      const style = await sceneStyle();
      assert.strictEqual(style.willChange, "");
      // The pointercancel above was a synthetic PointerEvent on the app's own
      // element, not a real CDP touch release, so the underlying touch (id 1)
      // is still "down" as far as Chrome's input pipeline is concerned; end
      // it for real or the next test's touchstart with the same id misbehaves.
      await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    });

    test("card swipe: a mouse button released off-window during a drag is recognised and releases it", async () => {
      await freshLoad();
      const box = await b.eval(`
        const r = document.getElementById("card").getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      `);
      // A fresh test's first real press - same cross-test-boundary race as
      // drag()/startDrag()/startMouseDrag(), see waitForPendingSettle.
      await b.waitForPendingSettle();
      // Q15: a mouse button released outside the browser window (or a native
      // context menu opened over it) delivers no pointerup/lostpointercapture
      // at all - the OS eats it - and the drag stays live, following the
      // pointer forever. A CDP mouseMoved with buttons: 0 after a left
      // mousePressed arrives as a real pointermove with buttons === 0, which
      // is the only signal available.
      await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
      await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x + 60, y: box.y, buttons: 0 });
      const dragState = await b.eval(`return drag;`);
      assert.strictEqual(dragState, null, "a pointermove with no buttons held must release a live mouse drag");
      await b.finishAnimations();
      const xf = await b.eval(`return getComputedStyle(document.querySelector(".scene")).transform;`);
      assert.strictEqual(xf, "none", "the scene must settle with no inline transform");
      // End the press for real (both to leave no stuck button state for later
      // tests, and because this mouseup - same target throughout, since
      // pointer capture kept routing to #card - is itself a genuine click:
      // an extra explicit b.click() here would be a SECOND click, toggling
      // the flip right back and hiding a real eatClick-stuck failure behind
      // an even number of flips).
      await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x + 60, y: box.y, button: "left", clickCount: 1 });
      assert.strictEqual(await cardFlipped(), true, "the release's own click must still flip the card, proving eatClick was not left stuck");
    });

    test("card swipe: a synthetic contextmenu on #card releases a live drag", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      const g = await startDrag("#card");
      await g.move(60, 0);
      // Q15: ctrl+click also fires contextmenu, but only on macOS, so it is
      // not portable to Linux CI - a synthetic dispatch reaches the listener
      // just the same while the drag is live.
      await b.eval(`
        document.getElementById("card").dispatchEvent(
          new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
        return true;
      `);
      const dragState = await b.eval(`return drag;`);
      assert.strictEqual(dragState, null, "a contextmenu during a live drag must release it");
      await b.finishAnimations();
      const xf = await sceneXform();
      assert.strictEqual(xf.none, true, ".scene transform must settle to none after the contextmenu release");
      await expectCount(`1 / ${n}`, "a contextmenu release must not step the deck");
      // The contextmenu dispatch above is a synthetic event on the app's own
      // element, not a CDP touch release, so Chrome's input pipeline still
      // considers touch id 1 down; end it for real.
      await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    });

    test("card swipe: a second pointer cannot end or hijack a drag in progress", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      const g = await startDrag("#card");
      // Held below SWIPE_COMMIT_PX (18) AND over enough elapsed time (300ms)
      // that its velocity reads well under the fling threshold, on purpose:
      // a move at ms=0 has effectively infinite velocity, so ANY dx there
      // (even a small one) registers as a fling and commits regardless of
      // this guard - which would make the spurious pointerup below commit
      // too, landing on the same final count as the real gesture and hiding
      // the bug entirely. Slow and short means the spurious release below,
      // if ever allowed through, ends the drag as a spring-back, not a
      // commit - silently swallowing the real gesture's own eventual release
      // rather than producing a same-looking commit that would mask it.
      // -15 (not -17) was avoided here: Chromium's synthetic-touch slop
      // delays the resulting pointermove past the point this test reads it.
      await g.move(-17, 300);
      await b.eval(`
        const card = document.getElementById("card");
        card.dispatchEvent(new PointerEvent("pointerdown", {
          pointerId: 999, pointerType: "mouse", isPrimary: true, button: 0, clientX: 0, bubbles: true,
        }));
        card.dispatchEvent(new PointerEvent("pointerup", {
          pointerId: 999, pointerType: "mouse", isPrimary: true, button: 0, clientX: 0, bubbles: true,
        }));
        return true;
      `);
      const mid = await sceneXform();
      assert.ok(Math.abs(mid.m41 - (-17)) <= 1, `a second pointer must not disturb the drag, m41=${mid.m41}`);
      assert.strictEqual(await countText(), `1 / ${n}`, "a second pointer's pointerup must not end the drag");
      await g.release(-120, 200);
      await b.finishAnimations();
      await expectCount(`2 / ${n}`, "the original touch should still be able to commit");
    });

    // N40 (owner in-scope widening): step() suppresses .card's reverse-flip
    // transition for every caller, not just land() - #next, ArrowRight, and
    // the swipe's own land() all reset a flipped card the same way.
    /* ---- desktop swipe: mouse lpc-release order + trackpad wheel ----
     * docs/plans/2026-09-30-desktop-swipe.md */
    async function startMouseDrag(selector) {
      const box = await b.eval(`
        const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      `);
      await b.waitForPendingSettle();
      const press = async () => {
        const t0 = Date.now() / 1000;
        await b.send("Input.dispatchMouseEvent", {
          type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1, timestamp: t0,
        });
        return t0;
      };
      const g = { box, t0: await press(), represses: 0 };
      g.id = await b.eval(`return drag ? drag.id : null;`);
      assert.ok(g.id !== null, "a real mouse press must start a drag");
      g.move = async (dx, ms, dy) => {
        const send = () => b.send("Input.dispatchMouseEvent", {
          type: "mouseMoved", x: box.x + dx, y: box.y + (dy || 0), buttons: 1, timestamp: g.t0 + ms / 1000,
        });
        await send();
        // Headless Chrome can drop a fresh mouse capture while the button is
        // still held (a trusted lostpointercapture right after its own
        // gotpointercapture, observed ~1 run in 13 straight after the
        // second-pointer touch test, sometimes on consecutive presses). The
        // app rightly cancels on that, so the drag dies before this move
        // registers. That is the harness's input pipeline, not the app:
        // release and re-press, a bounded number of times, then require the
        // move. A drag still live but not moving is never retried.
        while (!(await b.waitFor(`drag && drag.moved`, { label: "drag to register the move", timeout: 1500 })
          .then(() => true, () => false))) {
          assert.ok(g.represses < 3, "drag to register the move (re-pressed 3 times)");
          assert.strictEqual(await b.eval(`return drag;`), null, "drag to register the move (drag still live)");
          g.represses++;
          await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });
          await b.finishAnimations();
          await new Promise(r => setTimeout(r, 150 * g.represses));
          g.t0 = await press();
          g.id = await b.eval(`return drag ? drag.id : null;`);
          assert.ok(g.id !== null, "a real mouse re-press must start a drag");
          await send();
        }
        if (g.represses) console.error(`startMouseDrag: re-pressed ${g.represses}x`);
      };
      return g;
    }
    // Dispatches one synthetic event on `selector` via its own CDP round
    // trip (Runtime.evaluate), so a setTimeout(0) queued by the app between
    // two dispatches gets a chance to fire - required to replicate Chrome's
    // real mouse-release order (lostpointercapture, then pointerup, then
    // click, each its own task) rather than three listeners firing
    // synchronously inside one script.
    async function dispatchEvt(selector, ctor, type, extra) {
      return b.eval(`
        document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new ${ctor}(${JSON.stringify(type)}, Object.assign({
          bubbles: true, cancelable: true,
        }, ${JSON.stringify(extra || {})})));
        return true;
      `);
    }
    // Ends a real mouse press (one started via startMouseDrag, whose
    // pointerdown called card.setPointerCapture) for real, then waits for
    // Chrome's own trusted lostpointercapture that the real release
    // triggers asynchronously - a synthetic lostpointercapture dispatched
    // mid-test never releases this real capture, so the real one still
    // fires on the real mouseup. If a test returns before it fires, it can
    // land on the very next test's drag instead (same real-input pipeline,
    // reused low pointer ids) and cancel it before its first move.
    async function endMouseDragForReal(x, y) {
      await b.eval(`
        window.__cdpLpcSeen = false;
        document.getElementById("card").addEventListener("lostpointercapture", () => {
          window.__cdpLpcSeen = true;
        }, { once: true });
        return true;
      `);
      await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
      // See b.settleAfterRealRelease (tests/helpers/cdp.js): waits for the
      // real release's own lostpointercapture, then two real animation
      // frames so Chrome's capture bookkeeping for this pointer id has
      // drained before a later test reuses it. The listener above is
      // armed here (not inside settleAfterRealRelease) because it must be
      // attached before mouseReleased is sent, not after. The wait itself is
      // deferred (not awaited) rather than run inline: a caller that
      // inspects animation state right after this release must see it
      // immediately, not after several real animation frames have elapsed -
      // whichever NEXT real press this browser makes pays for the wait
      // instead, via waitForPendingSettle().
      b._pendingSettle = (async () => {
        await b.waitFor(`window.__cdpLpcSeen === true`, {
          label: "the real mouseup's own lostpointercapture to fire",
          timeout: 1000,
        }).catch(() => {});
        await b.eval(`
          return new Promise(resolve => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          });
        `).catch(() => {});
      })();
    }

    test("card swipe: Chrome's real mouse-release order - lostpointercapture, then pointerup, then click - commits without flipping", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      const g = await startMouseDrag("#card");
      assert.ok(g.id !== null, "a real mouse press must start a drag");
      await g.move(-100, 60);
      const rx = g.box.x - 100, ry = g.box.y;
      // Lab-observed order (db trace 2lru4aur8i92pgogjd0t): lostpointercapture
      // (buttons 0, real coords) fires BEFORE pointerup.
      await dispatchEvt("#card", "PointerEvent", "lostpointercapture", {
        pointerId: g.id, pointerType: "mouse", isPrimary: true, buttons: 0, clientX: rx, clientY: ry,
      });
      await dispatchEvt("#card", "PointerEvent", "pointerup", {
        pointerId: g.id, pointerType: "mouse", isPrimary: true, button: 0, buttons: 0, clientX: rx, clientY: ry,
      });
      await dispatchEvt("#card", "MouseEvent", "click", {});
      await b.finishAnimations();
      await expectCount(`2 / ${n}`, "the real Chrome mouse-release order must still commit");
      assert.strictEqual(await cardFlipped(), false, "a committing drag must not flip the card");
      // startMouseDrag's mousePressed never got a real release - end it for
      // real (and wait out the resulting real lostpointercapture) so it
      // cannot bleed into a later test's press.
      await endMouseDragForReal(rx, ry);
    });

    test("card swipe: a touch lostpointercapture still cancels the drag, not a mouse-only release", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      const g = await startDrag("#card");
      await g.move(80, 0);
      const id = await b.eval(`return drag.id;`);
      await dispatchEvt("#card", "PointerEvent", "lostpointercapture", {
        pointerId: id, pointerType: "touch", isPrimary: true, buttons: 0, clientX: 0,
      });
      assert.strictEqual(await countText(), `1 / ${n}`, "a touch lostpointercapture must not commit");
      const anim = await b.eval(`
        const a = document.querySelector(".scene").getAnimations()[0];
        const kf = a ? a.effect.getKeyframes() : null;
        return { n: document.querySelector(".scene").getAnimations().length,
                 duration: a ? a.effect.getComputedTiming().duration : null };
      `);
      assert.strictEqual(anim.n, 1, "a cancelled touch drag should spring back with one animation");
      assert.strictEqual(anim.duration, 260, "a cancelled drag springs back, it does not fly out");
      await b.finishAnimations();
      // Synthetic lpc on the app's own element does not end the real
      // underlying touch (id 1) as far as Chrome's input pipeline is
      // concerned, nor does it release the real pointer capture #card
      // still holds (card.setPointerCapture on pointerdown) - end the
      // touch for real or a later test's touchstart misbehaves.
      await b.eval(`
        window.__lpcSeen = false;
        document.getElementById("card").addEventListener("lostpointercapture", () => {
          window.__lpcSeen = true;
        }, { once: true });
        return true;
      `);
      await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      // Ending a real, captured touch makes Chrome fire its OWN trusted
      // lostpointercapture asynchronously - if this test returns before
      // that fires, it can land on the very next test's drag instead
      // (same pointerId, reused by CDP's touch dispatch), cancelling it
      // before its first move. Wait for it here so it is consumed by
      // this test's own (already-null) `drag`, not a later one's.
      await b.waitFor(`window.__lpcSeen === true`, {
        label: "the real touchend's own lostpointercapture to fire",
        timeout: 1000,
      });
      // The real lostpointercapture firing does not guarantee Chrome's
      // internal capture bookkeeping for the old (touch) pointerId has
      // fully settled yet - reusing the same low pointerId for a brand
      // new mouse capture immediately afterward can spuriously re-fire a
      // trusted lostpointercapture against that new capture. Two real
      // animation-frame round trips give the browser's input pipeline a
      // chance to drain before the next test's pointerdown.
      await b.eval(`
        return new Promise(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
      `);
    });

    test("card swipe: a mouse lostpointercapture with a button still held cancels the drag", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      const g = await startMouseDrag("#card");
      await g.move(-100, 60);
      const rx = g.box.x - 100, ry = g.box.y;
      // buttons still reporting the left button held (bit 1) must be treated
      // like any other cancel, not the Chrome ordinary-release path.
      await dispatchEvt("#card", "PointerEvent", "lostpointercapture", {
        pointerId: g.id, pointerType: "mouse", isPrimary: true, buttons: 1, clientX: rx, clientY: ry,
      });
      assert.strictEqual(await countText(), `1 / ${n}`, "lpc with a button still held must not commit");
      await b.finishAnimations();
      assert.strictEqual(await countText(), `1 / ${n}`, "settling after the spring-back must still not have stepped");
      // Release the real underlying mouse button (and wait out the real
      // lostpointercapture that triggers) so it cannot bleed into a later
      // test's drag.
      await endMouseDragForReal(rx, ry);
    });

    test("card swipe: a click more than 400ms after a committing mouse drag is not eaten and flips", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      // Commit via the synthetic lpc path only (no trailing pointerup/click
      // dispatched), exactly as the eng-review-item-3 test below does: a
      // real mouse release's own trailing click fires (and self-eats)
      // almost immediately, which would clear eatClick/eatClickTimer within
      // milliseconds regardless of the configured decay duration and so
      // cannot discriminate a wrong decay length (e.g. 400ms mutated to
      // 4000ms) - a behavioral click-then-flip assertion driven by a real
      // b.drag()+b.click() always "passes" either way, since the real
      // click's own pointerdown resets eatClick unconditionally before the
      // mutation can matter.
      const g = await startMouseDrag("#card");
      await g.move(-100, 60);
      const rx = g.box.x - 100, ry = g.box.y;
      await dispatchEvt("#card", "PointerEvent", "lostpointercapture", {
        pointerId: g.id, pointerType: "mouse", isPrimary: true, buttons: 0, clientX: rx, clientY: ry,
      });
      await b.finishAnimations();
      await expectCount(`2 / ${n}`, "the drag should have committed");
      assert.strictEqual(await b.eval(`return eatClick;`), true,
        "the committing drag must arm eatClick right after landing");
      await new Promise((r) => setTimeout(r, 450));
      assert.strictEqual(await b.eval(`return eatClick;`), false,
        "eatClick must have decayed back to false on its own well past the 400ms window");
      await b.click("#card");
      assert.strictEqual(await cardFlipped(), true, "a click well after the 400ms decay must flip");
      // startMouseDrag's mousePressed never got a real release of its own
      // (the commit above is driven by the synthetic lpc, and b.click()
      // above presses and releases again at a fresh location) - send a
      // final real release so a stuck button cannot bleed into a later test.
      await endMouseDragForReal(rx, ry);
    });

    // AP's `sw_eatclick_timer_not_cleared` mutant: drop the
    // `clearTimeout(eatClickTimer)` inside setEatClick (index.html's own
    // comment says every assignment site must go through it exactly so a
    // stale timer from an earlier release can never clear a freshly-armed
    // eatClick out from under a later one). Whitebox by design, same as the
    // other eatClick/eatClickTimer reads above: setEatClick is a top-level
    // function declaration in a classic (non-module) script, so it hangs off
    // `window` like `eatClick` and `eatClickTimer` themselves, and the bug
    // lives inside the function's own body - independent of how a caller
    // (mouse release, touch release, the click listener) reaches it.
    test("a stale eatClick decay never clears a re-armed eatClick", async () => {
      await freshLoad();
      // Mirrors release()'s own mouse-release decay (setEatClick(true, 400)
      // at index.html's release()).
      const DECAY_MS = 400;
      // First release arms eatClick with a 400ms decay timer.
      await b.eval(`window.setEatClick(true, ${DECAY_MS}); return true;`);
      assert.strictEqual(await b.eval(`return eatClick;`), true,
        "setEatClick(true, ...) must arm eatClick");
      // A second release lands partway through the first decay window and
      // re-arms eatClick with its OWN fresh 400ms timer.
      await new Promise((r) => setTimeout(r, DECAY_MS / 2));
      await b.eval(`window.setEatClick(true, ${DECAY_MS}); return true;`);
      // Wait past the FIRST decay's deadline (400ms after the first call,
      // i.e. 200ms after the second) but comfortably before the second
      // decay's own deadline (600ms after the first call) - if the stale
      // timer from the first call were not cancelled when the second call
      // re-armed, it would fire in this window and clear the re-armed
      // eatClick early.
      await new Promise((r) => setTimeout(r, DECAY_MS / 2 + 100));
      assert.strictEqual(await b.eval(`return eatClick;`), true,
        "a stale decay timer from an earlier setEatClick cleared a re-armed eatClick");
    });

    // Eng review item 3: every place that assigns eatClick must also cancel
    // any pending decay timer, so a stale timer from an earlier assignment
    // can never fire later and clobber a fresher one. The clearest, most
    // deterministic way to prove this is white-box: a committing mouse drag
    // arms a real 400ms timer, then a mid-flight tap (landing the flight via
    // the document capture-phase pointerdown branch, which assigns eatClick
    // with no decay) must leave no timer behind - if it did, that stale
    // timer firing later could clear eatClick out from under a later,
    // unrelated assignment. `eatClickTimer` does not exist at all before
    // this change, so this test fails with a ReferenceError on unmodified
    // code and only passes once the timer is centralized and cancelled on
    // every assignment.
    test("card swipe: landing a flight during a mid-flight tap cancels a stale mouse-decay timer from the committing drag", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      // Commit via the synthetic lpc path only (no trailing pointerup/click
      // dispatched) so nothing consumes the decay timer on its own - a real
      // trailing click would eat it immediately via the document click
      // listener, which is a different (already-tested) path, not a stale
      // timer surviving past its own assignment.
      const g = await startMouseDrag("#card");
      await g.move(-100, 60);
      const rx = g.box.x - 100, ry = g.box.y;
      await dispatchEvt("#card", "PointerEvent", "lostpointercapture", {
        pointerId: g.id, pointerType: "mouse", isPrimary: true, buttons: 0, clientX: rx, clientY: ry,
      });
      const armed = await b.eval(`return eatClickTimer !== null && flight !== null;`);
      assert.strictEqual(armed, true, "a committing mouse drag must arm a decay timer and be mid-flight");
      // ~100ms into the ~400ms decay window (and well inside the 220ms
      // fly-out - do NOT poll countText here, that would wait out the
      // fly-out and land it for real before the tap), tap the card - the
      // document capture-phase pointerdown's `if (flight)` branch lands it
      // and reassigns eatClick with no decay.
      await new Promise((r) => setTimeout(r, 100));
      const stillMidFlight = await b.eval(`return flight !== null;`);
      assert.strictEqual(stillMidFlight, true, "the tap must land during the fly-out, not after it already landed itself");
      // Check eatClickTimer right after the bare pointerdown, before the
      // trailing click fires: the click listener's own `if (eatClick)
      // setEatClick(false)` would clear a lingering timer as a side effect
      // regardless of what the pointerdown branch did, which would mask a
      // bypass of setEatClick there (a direct `eatClick = ...` assignment
      // that skips cancelling the stale timer). Isolating the pointerdown
      // is what makes that bypass observable.
      await b.eval(`
        document.getElementById("card").dispatchEvent(new PointerEvent("pointerdown", {
          bubbles: true, cancelable: true, isPrimary: true, pointerId: 999, button: 0,
        }));
        return true;
      `);
      const timerAfterPointerdown = await b.eval(`return eatClickTimer;`);
      assert.strictEqual(timerAfterPointerdown, null,
        "landing the flight via a mid-flight tap's pointerdown must cancel the committing drag's stale decay timer");
      await b.eval(`document.getElementById("card").click(); return true;`);
      assert.strictEqual(await countText(), `2 / ${n}`, "the committed drag should have landed exactly once");
      assert.strictEqual(await cardFlipped(), false, "the landing tap must not also flip the newly-landed card");
      await b.finishAnimations();
      // startMouseDrag's mousePressed never got a real release - end it for
      // real (and wait out the resulting real lostpointercapture) so it
      // cannot bleed into a later test's drag.
      await endMouseDragForReal(rx, ry);
    });

    // Eng review item 1: on the lpc-as-release path the event's own point is
    // not pushed into drag.pts, so a lostpointercapture carrying a stale/
    // unrelated coordinate cannot corrupt the trailing-window velocity
    // calculation into a spurious fling. A short, slow drag (real dx well
    // under SWIPE_COMMIT_PX, real velocity well under the fling threshold)
    // must still spring back even when the lpc event itself claims clientX 0 -
    // a coordinate far from the real release point that, if pushed, would
    // read as an enormous last-instant velocity.
    test("card swipe: a short mouse drag whose lostpointercapture carries a stale clientX still springs back", async () => {
      await freshLoad();
      const n = (await decksMeta())[0].chords;
      // Every event in this test is dispatched synthetically (never through
      // CDP's Input.dispatchMouseEvent), so every e.timeStamp lives in the
      // same performance.now() clock: a real pointermove from
      // startMouseDrag()/g.move() gets its timeStamp from CDP's own
      // (unrelated) timestamp parameter, which does not compare
      // meaningfully against a synthetic lostpointercapture's timeStamp -
      // mixing the two made the window/velocity math below meaningless
      // (span came out negative and vx stayed 0 regardless of pushPoint).
      const box = await b.eval(`
        const r = document.querySelector("#card").getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      `);
      const pid = 4242;
      await dispatchEvt("#card", "PointerEvent", "pointerdown", {
        pointerId: pid, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1,
        clientX: box.x, clientY: box.y,
      });
      // Real wall-clock gap so this first sample ages out of the 100ms
      // trailing window by the time the final move/lpc pair fires.
      await new Promise((r) => setTimeout(r, 150));
      // The final real sample: a short drag (|dx| well under
      // SWIPE_COMMIT_PX) landing just before the lpc event, so it is still
      // inside the trailing window - exactly the point a stale pushed
      // coordinate would corrupt.
      await dispatchEvt("#card", "PointerEvent", "pointermove", {
        pointerId: pid, pointerType: "mouse", isPrimary: true, buttons: 1,
        clientX: box.x - 15, clientY: box.y,
      });
      await dispatchEvt("#card", "PointerEvent", "lostpointercapture", {
        pointerId: pid, pointerType: "mouse", isPrimary: true, buttons: 0,
        clientX: 0, clientY: box.y,
      });
      assert.strictEqual(await countText(), `1 / ${n}`, "a short slow drag must not commit, stale lpc point or not");
      await b.finishAnimations();
      // A short, non-committing drag still counts as "moved" (it exceeded
      // the slop threshold), so release() still arms eatClick to swallow the
      // drag's own trailing click - exactly as the existing "short mouse
      // drag springs back without flipping" test already covers. This test
      // is only about the fling-velocity corruption: a stale lpc clientX
      // must not turn the spring-back into a spurious commit (asserted
      // above), not about whether the trailing click flips.
      assert.strictEqual(await countText(), `1 / ${n}`);
    });

    describe("trackpad two-finger swipe (wheel)", () => {
      async function wheelAt(dx, dy, modifiers) {
        const where = await b.eval(`
          const r = document.querySelector("main").getBoundingClientRect();
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        `);
        return b.send("Input.dispatchMouseEvent", {
          type: "mouseWheel", x: where.x, y: where.y, deltaX: dx, deltaY: dy,
          ...(modifiers ? { modifiers } : {}),
        });
      }
      async function wheelGesture(legs) {
        for (const [dx, dy] of legs) await wheelAt(dx, dy);
      }

      test("card swipe (wheel): deltaX past 80px advances the deck exactly once per gesture", async () => {
        await freshLoad();
        const n = (await decksMeta())[0].chords;
        await wheelGesture([[30, 0], [30, 0], [30, 0], [30, 0]]);
        await b.finishAnimations();
        await expectCount(`2 / ${n}`, "a trackpad swipe past 80px should advance once");
      });

      test("card swipe (wheel): deltaX under 80px does nothing and leaves no transform", async () => {
        await freshLoad();
        const n = (await decksMeta())[0].chords;
        await wheelGesture([[20, 0], [20, 0]]);
        await new Promise((r) => setTimeout(r, 250));
        await b.finishAnimations();
        assert.strictEqual(await countText(), `1 / ${n}`, "under-threshold deltaX must not step");
        const xf = await sceneXform();
        assert.strictEqual(xf.none, true, "the transform must be cleared once the gesture ends");
        const style = await sceneStyle();
        assert.strictEqual(style.willChange, "", "willChange must be cleared once the gesture ends");
      });

      test("card swipe (wheel): deltaX>0 follows with a negative translateX mid-gesture", async () => {
        await freshLoad();
        await wheelAt(20, 0);
        const xf = await sceneXform();
        assert.strictEqual(xf.none, false, "a wheel event under threshold must apply a follow transform");
        assert.ok(xf.m41 < 0, `deltaX>0 (sx>0) must move the card to translateX<0, got ${xf.m41}`);
        await new Promise((r) => setTimeout(r, 250));
        await b.finishAnimations();
      });

      test("card swipe (wheel): a sub-threshold gesture's spring-back starts exactly where the follow transform left off", async () => {
        await freshLoad();
        const n = (await decksMeta())[0].chords;
        await wheelGesture([[20, 0], [20, 0]]);
        const follow = await sceneXform();
        assert.strictEqual(follow.none, false, "a sub-threshold gesture must leave a follow transform in place");
        const followDeg = Math.atan2(follow.b, follow.a) * 180 / Math.PI;
        // Wait past WHEEL_GESTURE_GAP_MS (160ms) so wheelGestureEnd() fires
        // and springBack()'s WAAPI animation is created - read its keyframes
        // statically (safe regardless of playback progress, same pattern as
        // the fly-out/enter keyframe reads above).
        await new Promise((r) => setTimeout(r, 250));
        const first = await b.eval(`
          const a = document.querySelector(".scene").getAnimations()[0];
          const kf = a.effect.getKeyframes();
          const m = kf[0].transform.match(/translate3d\\(([-\\d.]+)px[^)]*\\)\\s*rotate\\(([-\\d.]+)deg\\)/);
          return { x: parseFloat(m[1]), deg: parseFloat(m[2]) };
        `);
        assert.ok(
          Math.abs(first.x - follow.m41) < 0.5,
          `spring-back's first keyframe translateX (${first.x}) must match the follow transform it left off at (${follow.m41})`,
        );
        assert.ok(
          Math.abs(first.deg - followDeg) < 0.5,
          `spring-back's first keyframe rotate (${first.deg}) must match the follow transform's rotate (${followDeg})`,
        );
        await b.finishAnimations();
        assert.strictEqual(await countText(), `1 / ${n}`);
      });

      test("card swipe (wheel): a vertical-dominant wheel does nothing and is not preventDefault-ed", async () => {
        await freshLoad();
        const n = (await decksMeta())[0].chords;
        const where = await b.eval(`
          const r = document.querySelector("main").getBoundingClientRect();
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        `);
        await b.eval(`
          window.__wheelPrevented = null;
          document.querySelector("main").addEventListener("wheel", (e) => {
            window.__wheelPrevented = e.defaultPrevented;
          }, { once: true });
          return true;
        `);
        await b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: where.x, y: where.y, deltaX: 0, deltaY: 100 });
        const prevented = await b.eval(`return window.__wheelPrevented;`);
        assert.strictEqual(prevented, false, "a vertical-dominant wheel must not be preventDefault-ed");
        assert.strictEqual(await countText(), `1 / ${n}`);
      });

      test("card swipe (wheel): ctrlKey (pinch-zoom) is ignored", async () => {
        await freshLoad();
        const n = (await decksMeta())[0].chords;
        await wheelAt(100, 0, 2); // modifiers bit 2 = Ctrl
        await new Promise((r) => setTimeout(r, 250));
        await b.finishAnimations();
        assert.strictEqual(await countText(), `1 / ${n}`, "a ctrl+wheel pinch-zoom gesture must never navigate");
        const xf = await sceneXform();
        assert.strictEqual(xf.none, true, "a ctrl+wheel gesture must leave no follow transform");
      });

      test("card swipe (wheel): a second gesture after the 160ms gap advances again", async () => {
        await freshLoad();
        const n = (await decksMeta())[0].chords;
        await wheelGesture([[50, 0], [50, 0]]);
        await b.finishAnimations();
        await expectCount(`2 / ${n}`, "the first gesture should commit");
        await new Promise((r) => setTimeout(r, 220)); // past the 160ms gesture gap
        await wheelGesture([[50, 0], [50, 0]]);
        await b.finishAnimations();
        await expectCount(`3 / ${n}`, "a later, separate gesture should commit again");
      });

      test("card swipe (wheel): a trackpad swipe does nothing while the settings panel is open", async () => {
        await freshLoad();
        const n = (await decksMeta())[0].chords;
        await openSettingsPanel();
        // openSettingsPanel()'s click is a real CDP mouse press/release, and
        // the gesture-skip computation below reads `order`/`flight`/`drag`
        // at the moment the synthetic wheel event arrives - wait for that
        // real click's own event turn to fully settle first, or a rare,
        // otherwise-undetectable race (this assertion observed flaking
        // roughly 1 run in 10 locally without this wait) can catch `order`
        // transiently empty or `flight`/`drag` transiently non-null for a
        // reason that has nothing to do with the panelOpen/sheetOpen guard
        // this test exists to cover, making the mutant look caught (or not)
        // by accident rather than by the thing under test.
        await b.waitFor(
          `typeof order !== "undefined" && order.length > 0 && !flight && !drag`,
          { label: "swipe state to settle after opening the settings panel" },
        );
        // The open settings panel visually overlays <main>, so a real,
        // coordinate-targeted wheel event (CDP's Input.dispatchMouseEvent,
        // as wheelAt()/wheelGesture() use) hit-tests to the panel/backdrop
        // and never reaches wheelMain's own listener at all - that reaches
        // the same "nothing happens" outcome regardless of the handler's
        // own panelOpen/sheetOpen skip check, so it cannot discriminate a
        // mutation that drops that check. Dispatching the WheelEvent
        // synthetically, directly on <main>, bypasses the occlusion and
        // actually exercises the skip condition itself.
        await b.eval(`
          document.querySelector("main").dispatchEvent(new WheelEvent("wheel", {
            bubbles: true, cancelable: true, deltaX: 50, deltaY: 0,
          }));
          document.querySelector("main").dispatchEvent(new WheelEvent("wheel", {
            bubbles: true, cancelable: true, deltaX: 50, deltaY: 0,
          }));
          return true;
        `);
        await new Promise((r) => setTimeout(r, 250));
        await b.finishAnimations();
        assert.strictEqual(await countText(), `1 / ${n}`, "a wheel gesture must do nothing while the panel is open");
      });

      test("card swipe (wheel): momentum wheel events after a committed gesture lands do not step again", async () => {
        await freshLoad();
        const n = (await decksMeta())[0].chords;
        // The committing leg crosses the threshold and starts the 220ms
        // fly-out; the deck count already reads the committed value even
        // though the card is still mid-flight.
        await wheelAt(100, 0);
        // The deck count only updates at land(), which fires when the
        // 220ms fly-out finishes - polling expectCount here would wait out
        // that whole animation and land it for real before we ever get to
        // exercise the mid-flight guard, so check `flight` directly instead.
        assert.strictEqual(await b.eval(`return flight !== null;`), true,
          "the committing leg must start a fly-out immediately");
        // Wait past the 160ms gesture-gap so the first gesture object ends
        // (wheel = null) and the next wheel event starts a genuinely NEW
        // gesture, but stay under the 220ms fly-out so `flight` is still
        // non-null when that new gesture evaluates its skip condition -
        // this is what the `flight` term in the skip guard exists for: a
        // new trackpad gesture arriving as momentum while the previous
        // card is still flying out must not be allowed to commit a second
        // step on top of it.
        await new Promise((r) => setTimeout(r, 180));
        assert.strictEqual(await b.eval(`return flight !== null && wheel === null;`), true,
          "the first gesture must have ended via its own gap timer while its flight is still mid-air");
        await wheelAt(100, 0);
        await wheelAt(20, 0);
        // A second, un-skipped gesture would call flyOut() again on the
        // same scene element while the first fly-out is still running:
        // flyOut's own finished-callback self-protection
        // (`if (flight && flight.anim === anim) land()`) then means only
        // the SECOND animation's landing ever calls step() - net count
        // still reads one step higher, masking the bug - so the committed
        // count alone cannot discriminate this mutation. A second,
        // overlapping animation on .scene is the observable symptom.
        assert.strictEqual(await b.eval(`return scene.getAnimations().length;`), 1,
          "a new gesture arriving mid-flight must not start a second, overlapping fly-out animation");
        await new Promise((r) => setTimeout(r, 250));
        await b.finishAnimations();
        await expectCount(`2 / ${n}`, "momentum arriving mid-flight must not advance the deck a second time");
      });

      test("card swipe (wheel): the axis lock holds for the whole gesture even once later deltas favour the other axis", async () => {
        await freshLoad();
        const n = (await decksMeta())[0].chords;
        // First event locks the gesture to the x axis (|dx|=50 > |dy|=5).
        // Later events in the SAME gesture report dy >> dx; the lock must
        // still treat the gesture as horizontal and keep committing on dx.
        await wheelAt(50, 5);
        await wheelAt(50, 200);
        await b.finishAnimations();
        await expectCount(`2 / ${n}`, "an axis locked to x at gesture start must keep stepping off dx alone");
      });
    });

    /* ---------------------------------------------------------------- *
     * mouse momentum - docs/plans/2026-10-01-swipe-momentum.md
     * ---------------------------------------------------------------- */
    describe("mouse momentum", () => {
      // Installs a recorder around scene.animate(), once per fresh load: for
      // every call it records { kf, timing, t }, where `timing` is the
      // NORMALIZED easing from effect.getTiming() (the form
      // "cubic-bezier(0.4, 0, 1, 1)" the rest of this suite already reads at
      // `:7689` - the raw opts string would not compare equal, finding OV-3).
      // It attaches its OWN anim.finished.then() before returning the
      // animation, so it runs before the app's own .then(land) in flyOut()
      // while fill:"forwards" still holds the end pose - that is what lets
      // `finishedAt`/`finishRect` see where the card actually landed, not
      // the rest position land() resets it to. It also samples
      // { alive, m41, currentTime } ON THE PAGE, polled via requestAnimationFrame
      // rather than a fixed-delay setTimeout: a WAAPI animation's currentTime
      // stays 0 until the compositor assigns it a start time on the FIRST
      // frame tick after creation, and that tick's wall-clock offset from
      // creation is not fixed (observed 0-30ms+ in this harness) - a fixed
      // 30ms timer can land either side of it (finding F1: currentTime can
      // still be 0 at the sample - callers must check that first regardless).
      // Polling on rAF instead samples on the frame boundary itself, so
      // currentTime is > 0 as soon as a sample is taken at all; it still
      // bails out (sample stays null) if the flight already finished first.
      async function installRecorder() {
        await b.eval(`
          window.__anims = [];
          const scene = document.querySelector(".scene");
          const orig = scene.animate.bind(scene);
          scene.animate = (kf, opts) => {
            const anim = orig(kf, opts);
            const rec = { kf, timing: anim.effect.getTiming(), t: performance.now(), finishedAt: null, finishRect: null, sample: null };
            window.__anims.push(rec);
            anim.finished.then(() => {
              rec.finishedAt = performance.now();
              const r = document.getElementById("card").getBoundingClientRect();
              rec.finishRect = { left: r.left, right: r.right };
            }, () => {});
            function poll(framesLeft) {
              if (anim.currentTime === 0 && anim.playState === "running" && framesLeft > 0) {
                requestAnimationFrame(() => poll(framesLeft - 1));
                return;
              }
              const t = getComputedStyle(scene).transform;
              let m41 = 0;
              if (t !== "none") {
                const m3 = /^matrix3d\\(([^)]+)\\)$/.exec(t);
                const v = (m3 ? m3[1] : /^matrix\\(([^)]+)\\)$/.exec(t)[1]).split(",").map(Number);
                m41 = m3 ? v[12] : v[4];
              }
              rec.sample = { alive: !!(flight && flight.anim === anim), m41, currentTime: anim.currentTime };
            }
            requestAnimationFrame(() => poll(20));
            return anim;
          };
          return true;
        `);
      }
      const recordedAnims = () => b.eval(`return window.__anims;`);
      // Keyframe #0's translateX, in px - the dx the out-animation started
      // from (flyOut's own swipeXf(dx) first keyframe).
      function dxOf(kf) {
        return parseFloat(/translate3d\(([-\d.]+)px/.exec(kf[0].transform)[1]);
      }
      // Replays a recorded { kf, timing } pair on a detached, off-screen div:
      // paused at currentTime 0 and then 4ms, (x4 - x0) / 4 is the curve's
      // own slope near t=0 - the same initial speed the unit tests check
      // analytically from x1/y1, here read back from the real WAAPI engine
      // instead.
      async function replaySpeed(anim) {
        return b.eval(`
          const kf = ${JSON.stringify(anim.kf)};
          const timing = ${JSON.stringify(anim.timing)};
          const div = document.createElement("div");
          div.style.position = "fixed"; div.style.left = "-9999px"; div.style.top = "-9999px";
          document.body.appendChild(div);
          const a = div.animate(kf, timing);
          a.pause();
          function x() {
            const t = getComputedStyle(div).transform;
            if (t === "none") return 0;
            const m3 = /^matrix3d\\(([^)]+)\\)$/.exec(t);
            const v = (m3 ? m3[1] : /^matrix\\(([^)]+)\\)$/.exec(t)[1]).split(",").map(Number);
            return m3 ? v[12] : v[4];
          }
          a.currentTime = 0;
          const x0 = x();
          a.currentTime = 4;
          const x4 = x();
          div.remove();
          return (x4 - x0) / 4;
        `);
      }

      test("card swipe (mouse momentum): a fast release flies on at its release speed, leaves the viewport, then the next card enters", async () => {
        async function flick(width, height, legs, v) {
          await b.setViewport(width, height, false);
          try {
            await freshLoad();
            const n = (await decksMeta())[0].chords;
            await installRecorder();
            await b.drag("#card", legs, { pointer: "mouse" });
            await b.waitFor(`window.__anims.length >= 1 && window.__anims[0].sample !== null`,
              { label: "the out animation's 30ms sample to be taken" });
            const out = (await recordedAnims())[0];
            assert.ok(out.sample, "the 30ms sample must have been taken");
            assert.strictEqual(out.sample.alive, true,
              "the flight must still be live 30ms after release (D180-7)");
            assert.ok(out.sample.currentTime > 0, "currentTime must not be 0 (an animation frame must have run)");
            const dx = dxOf(out.kf);
            const liveV = (out.sample.m41 - dx) / out.sample.currentTime;
            assert.strictEqual(Math.sign(liveV), Math.sign(v), "the live sample must move in the release direction");
            assert.ok(Math.abs(liveV) >= 0.85 * Math.abs(v) && Math.abs(liveV) <= 1.15 * Math.abs(v),
              `live average speed ${liveV} out of [0.85, 1.15] x ${v}`);
            const replayed = await replaySpeed(out);
            assert.strictEqual(Math.sign(replayed), Math.sign(v), "the replayed curve must start in the release direction");
            assert.ok(Math.abs(replayed) >= 0.9 * Math.abs(v) && Math.abs(replayed) <= 1.1 * Math.abs(v),
              `replayed start speed ${replayed} out of [0.9, 1.1] x ${v}`);
            await b.waitFor(`window.__anims[0].finishedAt !== null`, { label: "the out animation to finish", timeout: 2000 });
            const finished = (await recordedAnims())[0];
            if (v < 0) assert.ok(finished.finishRect.right <= 0, `leftward fly-out must clear the viewport, right=${finished.finishRect.right}`);
            else assert.ok(finished.finishRect.left >= width, `rightward fly-out must clear the viewport, left=${finished.finishRect.left}`);
            await b.finishAnimations();
            await b.waitFor(`window.__anims.length >= 2`, { label: "the enter animation to be recorded" });
            const anims = await recordedAnims();
            assert.strictEqual(anims.length, 2, "exactly one enter animation must follow the out animation");
            const enter = anims[1];
            assert.ok(enter.kf[0].opacity !== undefined, "the enter animation must be the opacity keyframe pair");
            assert.ok(enter.t >= finished.finishedAt, "the enter animation must start at or after the out animation finished");
            const newCount = await countText();
            const [idx] = newCount.split(" / ").map(Number);
            return { n, idx };
          } finally {
            await b.setViewport(900, 900, false);
          }
        }

        let r = await flick(1024, 700, [[-40, 16], [-100, 32], [-180, 48]], -3.75);
        assert.strictEqual(r.idx, 2, "a leftward release must advance exactly one card");
        assert.strictEqual(await cardFlipped(), false, "a committing drag must never flip the card");

        await flick(380, 800, [[-40, 20], [-100, 40], [-160, 80]], -2);

        // The rightward (dir = -1) leg runs from the SECOND card, reached by
        // one #next click, so the "go back" path is covered too.
        await b.setViewport(1024, 700, false);
        try {
          await freshLoad();
          await b.click("#next");
          await b.waitFor(`(document.getElementById("count").textContent || "").trim() === "2 / ${(await decksMeta())[0].chords}"`,
            { label: "the #next click to land" });
          await installRecorder();
          await b.drag("#card", [[40, 16], [100, 32], [180, 48]], { pointer: "mouse" });
          await b.waitFor(`window.__anims.length >= 1 && window.__anims[0].sample !== null`,
            { label: "the out animation's 30ms sample to be taken" });
          const out = (await recordedAnims())[0];
          assert.strictEqual(out.sample.alive, true);
          assert.ok(out.sample.currentTime > 0, "currentTime must not be 0 (an animation frame must have run)");
          const dx = dxOf(out.kf);
          const liveV = (out.sample.m41 - dx) / out.sample.currentTime;
          assert.ok(liveV > 0, "a rightward release must move right");
          const replayed = await replaySpeed(out);
          assert.ok(replayed > 0 && Math.abs(replayed - 3.75) / 3.75 <= 0.1);
          await b.finishAnimations();
          await b.waitFor(`(document.getElementById("count").textContent || "").trim() === "1 / ${(await decksMeta())[0].chords}"`,
            { label: "the rightward release to go back one card" });
          assert.strictEqual(await cardFlipped(), false);
        } finally {
          await b.setViewport(900, 900, false);
        }
      });

      test("card swipe (mouse momentum): a slow commit starts at the floor speed and is off-screen within SWIPE_MOMENTUM_MAX_MS", async () => {
        await b.setViewport(1024, 700, false);
        try {
          await freshLoad();
          await installRecorder();
          await b.drag("#card", [[-8, 100], [-15, 200], [-25, 400]], { pointer: "mouse" });
          await b.waitFor(`window.__anims.length >= 1`, { label: "the out animation to be recorded" });
          const out = (await recordedAnims())[0];
          assert.ok(out.timing.duration <= 320, `duration ${out.timing.duration} must not exceed SWIPE_MOMENTUM_MAX_MS`);
          const replayed = await replaySpeed(out);
          assert.ok(replayed < 0, "a leftward commit must start moving left");
          assert.ok(Math.abs(replayed) >= 0.9 * 1.5 && Math.abs(replayed) <= 1.1 * 1.5,
            `floor start speed ${replayed} out of [0.9, 1.1] x 1.5`);
          await b.waitFor(`flight === null`, { label: "the flight to land", timeout: out.timing.duration + 1000 });
          const finished = (await recordedAnims())[0];
          assert.ok(finished.finishRect.right <= 0, `must clear the viewport, right=${finished.finishRect.right}`);
          await b.finishAnimations();
          const anims = await recordedAnims();
          assert.strictEqual(anims.length, 2);
          assert.ok(anims[1].t >= finished.finishedAt);
        } finally {
          await b.setViewport(900, 900, false);
        }
      });

      test("card swipe (mouse momentum): touch, pen and wheel fly-outs keep the fixed 220ms curve", async () => {
        await b.setViewport(1024, 700, false);
        try {
          // Touch.
          await freshLoad();
          await installRecorder();
          await b.drag("#card", [[-40, 16], [-100, 32], [-180, 48]], { pointer: "touch" });
          await b.waitFor(`window.__anims.length >= 1`, { label: "the touch out animation to be recorded" });
          let out = (await recordedAnims())[0];
          assert.strictEqual(out.timing.duration, 220);
          assert.strictEqual(out.timing.easing, "cubic-bezier(0.4, 0, 1, 1)");
          await b.finishAnimations();

          // Pen, sent inline (tests/helpers/cdp.js's drag() takes no
          // pointerType - decision 4's auto-decision 4 keeps it that way).
          await freshLoad();
          await installRecorder();
          const box = await b.eval(`
            const r = document.getElementById("card").getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          `);
          const observedPointerType = await b.eval(`
            window.__seenPointerType = null;
            document.getElementById("card").addEventListener("pointerdown",
              (e) => { window.__seenPointerType = e.pointerType; }, { once: true });
            return true;
          `).then(() => true);
          void observedPointerType;
          await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1, pointerType: "pen" });
          await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x - 40, y: box.y, buttons: 1, pointerType: "pen" });
          await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x - 180, y: box.y, buttons: 1, pointerType: "pen" });
          await b.armPendingSettle();
          await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x - 180, y: box.y, button: "left", clickCount: 1, pointerType: "pen" });
          b.settleAfterRealRelease();
          const seenPointerType = await b.eval(`return window.__seenPointerType;`);
          if (seenPointerType === "pen") {
            await b.waitFor(`window.__anims.length >= 1`, { label: "the pen out animation to be recorded" });
            out = (await recordedAnims())[0];
            assert.strictEqual(out.timing.duration, 220, "pen must keep the fixed 220ms curve");
            assert.strictEqual(out.timing.easing, "cubic-bezier(0.4, 0, 1, 1)");
          }
          // Auto-decision (plan, decision 4, item 4): if CDP does not surface
          // pointerType "pen" to the page, this leg is dropped rather than
          // changing tests/helpers/cdp.js (a non-goal of this lane).
          await b.finishAnimations();

          // Wheel.
          await freshLoad();
          await installRecorder();
          const where = await b.eval(`
            const r = document.querySelector("main").getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
          `);
          for (let i = 0; i < 4; i++) {
            await b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: where.x, y: where.y, deltaX: 30, deltaY: 0 });
          }
          await b.waitFor(`window.__anims.length >= 1`, { label: "the wheel out animation to be recorded" });
          out = (await recordedAnims())[0];
          assert.strictEqual(out.timing.duration, 220, "wheel must keep the fixed 220ms curve");
          assert.strictEqual(out.timing.easing, "cubic-bezier(0.4, 0, 1, 1)");
          await b.finishAnimations();
        } finally {
          await b.setViewport(900, 900, false);
        }
      });

      test("card swipe (mouse momentum): under reduced motion a mouse commit steps instantly with no animation", async () => {
        await b.setViewport(1024, 700, false);
        try {
          await freshLoad();
          const n = (await decksMeta())[0].chords;
          try {
            await b.send("Emulation.setEmulatedMedia", {
              media: "", features: [{ name: "prefers-reduced-motion", value: "reduce" }],
            });
            await installRecorder();
            await b.drag("#card", [[-40, 16], [-100, 32], [-180, 48]], { pointer: "mouse" });
            assert.strictEqual(await countText(), `2 / ${n}`, "reduced motion must step synchronously on release");
            const anims = await recordedAnims();
            assert.strictEqual(anims.length, 0, "reduced motion must never build a momentum curve");
          } finally {
            await b.send("Emulation.setEmulatedMedia", { media: "", features: [] });
          }
        } finally {
          await b.setViewport(900, 900, false);
        }
      });

      test("card swipe (mouse momentum): buttons, arrows and the wheel during a live mouse flight land it first, never dropping or doubling a step", async () => {
        await b.setViewport(1024, 700, false);
        try {
          // (a) a real click on #next.
          await freshLoad();
          let n = (await decksMeta())[0].chords;
          await installRecorder();
          await b.drag("#card", [[-8, 100], [-15, 200], [-25, 400]], { pointer: "mouse" });
          assert.notStrictEqual(await b.eval(`return flight;`), null, "a committed mouse drag must leave a live flight (D180-7)");
          await b.click("#next");
          await expectCount(`3 / ${n}`, "a real click on #next mid-flight must land the flight, then step");

          // (b) an ArrowRight keydown.
          await freshLoad();
          n = (await decksMeta())[0].chords;
          await installRecorder();
          await b.drag("#card", [[-8, 100], [-15, 200], [-25, 400]], { pointer: "mouse" });
          assert.notStrictEqual(await b.eval(`return flight;`), null, "a committed mouse drag must leave a live flight (D180-7)");
          await b.key("ArrowRight", "ArrowRight", 39);
          await expectCount(`3 / ${n}`, "ArrowRight mid-flight must land the flight, then step");

          // (c) a wheel gesture started mid-flight is skipped entirely.
          await freshLoad();
          n = (await decksMeta())[0].chords;
          await installRecorder();
          await b.drag("#card", [[-8, 100], [-15, 200], [-25, 400]], { pointer: "mouse" });
          assert.notStrictEqual(await b.eval(`return flight;`), null, "a committed mouse drag must leave a live flight (D180-7)");
          const where = await b.eval(`
            const r = document.querySelector("main").getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
          `);
          await b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: where.x, y: where.y, deltaX: 30, deltaY: 0 });
          await b.finishAnimations();
          await expectCount(`2 / ${n}`, "a wheel gesture mid-flight must be skipped entirely, not a second step");
        } finally {
          await b.setViewport(900, 900, false);
        }
      });
    });

    test("card swipe: #next and ArrowRight on a flipped card deal without a reverse-flip transition", async () => {
      await freshLoad();
      // b.settle() after flipping is not optional here: two style changes
      // (add .flip, then remove it) with no real painted frame committed in
      // between never register as a transition-eligible change at all in this
      // headless harness, baseline or mutant alike - a bare back-to-back
      // b.click("#card") -> b.click("#next") proves nothing either way.
      // A `transitionrun` listener, armed before the reset and read back
      // after two real animation frames, is what distinguishes an instant
      // reset from an animated one: the event fires the frame a transition
      // is scheduled (no fixed real-time wait, and nothing to race against
      // the .45s duration - if it hasn't fired within two frames it never
      // will for this reset).
      const armTransitionRun = () => b.eval(`
        window.__transitionRuns = 0;
        document.getElementById("card").addEventListener("transitionrun", () => { window.__transitionRuns++; });
        return true;
      `);
      const twoFrames = () => b.eval(`return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));`);
      const transitionRuns = () => b.eval(`return window.__transitionRuns;`);

      await b.click("#card");
      await b.settle();
      assert.strictEqual(await cardFlipped(), true);
      await armTransitionRun();
      await b.click("#next");
      assert.strictEqual(await cardFlipped(), false, "#next must reset the flip");
      await twoFrames();
      assert.strictEqual(await transitionRuns(), 0, "#next must not animate the reverse-flip");

      await b.click("#card");
      await b.settle();
      assert.strictEqual(await cardFlipped(), true);
      await armTransitionRun();
      await b.key("ArrowRight", "ArrowRight", 39);
      assert.strictEqual(await cardFlipped(), false, "ArrowRight must reset the flip");
      await twoFrames();
      assert.strictEqual(await transitionRuns(), 0, "ArrowRight must not animate the reverse-flip");
    });
  });

}
