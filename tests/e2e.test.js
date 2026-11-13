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

const { describe, test, before, after, afterEach } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { launch, findBrowser, ANALYTICS_PATTERNS, APP_READY_EXPR, peekExceptions, expectUncaught, assertNoUncaught } = require("./helpers/cdp.js");

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
  let moveMode = null;
  let spawnError = null;
  let b = null;
  /** index.html with a de table whose every value is the English value in brackets (the app.test.js pseudo table). */
  function moveHtml() {
    const inject = "<script>(function(){var p=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){" +
      "var fail=false;try{fail=localStorage.getItem('moveFail')==='1'&&String(arguments[0]).indexOf('importedIds')>=0;}catch(e){}" +
      "if(fail)throw new Error('injected write failure');return p.apply(this,arguments);};})();</script>";
    return fs.readFileSync(path.join(REPO, "index.html"), "utf8")
      .replace(/^const MOVE_FROM = .*;$/m, () => `const MOVE_FROM = ${JSON.stringify(moveMode.from)};`)
      .replace(/^const MOVE_TARGET = .*;$/m, () => `const MOVE_TARGET = ${JSON.stringify(moveMode.target)};`)
      .replace(/const MOVE_CAP = \d+;/, () => `const MOVE_CAP = ${moveMode.cap || 20000};`)
      .replace(/^const MOVE_DEADLINE = .*;$/m, () => `const MOVE_DEADLINE = ${JSON.stringify(moveMode.deadline || null)};`)
      .replace("<head>", () => "<head>" + inject);
  }
  function pseudoDeHtml() {
    const en = JSON.parse(fs.readFileSync(path.join(REPO, "data", "i18n", "en.json"), "utf8"));
    const wrap = (v) => (typeof v === "string" ? "\u27e6" + v + "\u27e7"
      : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, "\u27e6" + x + "\u27e7"])));
    const de = Object.fromEntries(Object.entries(en).map(([k, v]) => [k, wrap(v)]));
    return fs.readFileSync(path.join(REPO, "index.html"), "utf8")
      .replace(/const I18N = \{.*\};/, () => "const I18N = " + JSON.stringify({ en, de }) + ";");
  }

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
      if (moveMode && (rel === "" || rel === "index.html")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(moveHtml());
        return;
      }
      if (rel === "__pseudo_de.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(pseudoDeHtml());
        return;
      }
      const file = path.resolve(REPO, !rel || rel.endsWith("/") ? rel + "index.html" : rel);
      if (!file.startsWith(REPO + path.sep)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end(); return; }
        const type = file.endsWith(".html") ? "text/html; charset=utf-8"
          : file.endsWith(".js") ? "text/javascript" : "application/octet-stream";
        res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
        res.end(file === path.join(REPO, "index.html") ? buf.toString("utf8") : buf);
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

    b = await launch({ foregroundSettle: true });
    assert.ok(b, "browser found by findBrowser() but launch() returned null");
    await b.setViewport(900, 900, false);
    await b.goto(URL);
  });

  after(async () => {
    if (b) await b.close();
    if (server) await new Promise((r) => server.close(r));
  });

  // Empty since #226. A row is [/test name regex/, /message pattern/] and masks
  // ONE named test; there is no global allow-list, so a new uncaught exception
  // fails its test.
  const KNOWN_UNCAUGHT = [];

  afterEach((t) => {
    for (const [name, pattern] of KNOWN_UNCAUGHT) if (name.test(t.name)) expectUncaught(pattern);
    assertNoUncaught();
  });

  test("EX-4 sentinel: the uncaught guard is armed", async () => {
    const throwFromClick = (label) => b.eval(
      "const x = document.createElement('button');" +
      `x.onclick = () => { throw new Error('EX-4 sentinel ${label}'); };` +
      "x.click();");
    const recorded = async (label) => {
      const deadline = Date.now() + 5000;
      while (!peekExceptions().some((e) => e.includes("EX-4 sentinel " + label))) {
        assert.ok(Date.now() < deadline, `the registry never recorded the ${label} throw`);
        await new Promise((r) => setTimeout(r, 40));
      }
    };
    await throwFromClick("unexpected");
    await recorded("unexpected");
    assert.throws(() => assertNoUncaught(), /EX-4 sentinel unexpected/);
    expectUncaught(/EX-4 sentinel expected/);
    await throwFromClick("expected");
    await recorded("expected");
    assertNoUncaught();
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

  // The meta row of the deck the page booted: looked up by the page's own
  // DEFAULT_DECK, never by array position.
  const bootMeta = async (meta) => {
    const rows = meta || await decksMeta();
    const id = await b.eval(`return DEFAULT_DECK;`);
    return rows.find(m => m.id === id);
  };

  const countText = () =>
    b.eval(`return (document.getElementById("count").textContent || "").trim();`);

  // Deck chips only: "+ ADD" shares the .chip styling but is not a deck.
  const chipStates = () =>
    b.eval(`return [...document.querySelectorAll("#decks .chip:not(#deck-add)")]
              .map(c => ({ text: c.textContent.trim(), on: c.classList.contains("on") }));`);

  // The panel has no "mode S" button any more: progression is entered by
  // tapping a tier, so a test that walks A, B and S taps EASY for S.
  const modeBtn = (m) => (m === "S" ? "tier-basic" : "mode" + m);
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
  const WALK_RULES = `
    const walk = (rules, visit) => {
      for (const r of Array.from(rules)) {
        if (r.cssRules && r.cssRules.length) walk(r.cssRules, visit);
        visit(r);
      }
    };
    const walkSheets = (visit) => {
      for (const s of Array.from(document.styleSheets)) { try { walk(s.cssRules, visit); } catch (e) {} }
    };`;
  async function enterSeqMode() {
    await freshLoad();
    await openSettingsPanel();
    await b.click("#tier-basic");
    await b.waitFor(`document.getElementById("tier-basic").getAttribute("aria-pressed") === "true"`,
      { label: "mode S to take effect" });
  }
  /* Page timer constants the converted waits bound. They are written here on purpose, never read from the page: a wait that read the
   * constant back would move with it and could not fail when the constant grows. */
  const PIN_MS = 600, LIP_SLIDE_MS = 180, LIP_END_MS = 220;
  const LIP_SLIDE_END_S = (LIP_SLIDE_MS - 10) / 1000; // mirrors index.html LIP_SLIDE_END_S: a transitionend under it is not the slide's end
  /* A9 (iii): the sheet's scrollers have stood still for six frames and nothing animates, then one slide longer, so a late lip flip is seen. */
  async function waitSheetRest(label) {
    const ok = await b.eval(`return new Promise((res) => {
      const els = [document.querySelector("#scale-sheet .sheetbody"), document.querySelector("#scale-sheet .sheetsurf")].filter(Boolean);
      const pos = () => els.map((e) => e.scrollTop).join(",");
      let last = pos(), still = 0;
      const t0 = performance.now();
      const f = () => {
        const p = pos();
        still = p === last && document.getAnimations().length === 0 ? still + 1 : 0;
        last = p;
        if (still >= 6) return res(true);
        if (performance.now() - t0 > 5000) return res(false);
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });`);
    assert.ok(ok, `timed out waiting for ${label}`);
  }
  async function waitFlingSettled(label) {
    await waitSheetRest(label);
    await waitElapsed(LIP_SLIDE_MS + 120, "a late lip flip after " + label);
  }
  const railText = () => b.eval(`return document.querySelector("#count .seq-rail")?.textContent ?? null;`);
  const rectsOf = (sel) => `(() => {
    const r = document.querySelector("${sel}").getBoundingClientRect();
    return { l: r.left, t: r.top, w: r.width, h: r.height };
  })()`;
  async function waitElapsed(ms, label) {
    await b.eval(`return new Promise((r) => setTimeout(r, ${ms}));`);
  }
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
    const origin = new globalThis.URL(URL).origin;
    assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin), "freshLoad only clears the owned loopback test origin");
    await b.send("Storage.clearDataForOrigin", {origin, storageTypes:"indexeddb"});
    await navigate();
    // "+ ADD" ships in the markup, so waiting on ".chip" alone can be satisfied
    // before the app has booted. Wait for a real deck chip.
    await b.waitFor(`document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`, {
      label: "deck chips to be built",
    });
  }

  // ENGINE-SPEC sections12/14 and the transactional-storage amendment:
  // legacy selection/hidden state migrates only when current IDB authority is
  // absent. These explicit fixture resets belong before migration navigation;
  // ordinary reloads must retain the database and prove persistence instead.
  async function clearSavedIdbForLegacyMigrationFixture() {
    const origin=new globalThis.URL(URL).origin;
    assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(origin),"legacy fixture only clears the owned loopback test origin");
    await b.send("Storage.clearDataForOrigin",{origin,storageTypes:"indexeddb"});
  }

  // Fixture authority is the actual same-origin IndexedDB record. Both
  // existence and value are observed in one transaction and returned only on
  // complete; a successful request alone never counts as seeded/persisted.
  async function nativeSavedRecord(options = {}) {
    return new Promise((resolve,reject) => {
      const request=indexedDB.open("hpfc.saved-scales.v1",1);
      request.onupgradeneeded=()=>request.result.createObjectStore("collections");
      request.onerror=()=>reject(request.error || new Error("native fixture open failed"));
      request.onblocked=()=>reject(new Error("native fixture open blocked"));
      request.onsuccess=()=>{
        const db=request.result;let key,raw;
        let tx;
        try {tx=db.transaction("collections",options.write?"readwrite":"readonly");}
        catch(error){db.close();reject(error);return;}
        tx.oncomplete=()=>{db.close();resolve(options.write?null:{present:key!==undefined,raw});};
        tx.onabort=()=>{db.close();reject(tx.error || new Error("native fixture transaction aborted"));};
        tx.onerror=()=>{};
        const store=tx.objectStore("collections");
        if(options.write)store.put(options.raw,"current");
        else {
          const exists=store.getKey("current"),get=store.get("current");
          exists.onsuccess=()=>{key=exists.result;};get.onsuccess=()=>{raw=get.result;};
        }
      };
    });
  }
  const nativeSavedExpression=options=>`(${nativeSavedRecord.toString()})(${JSON.stringify(options||{})})`;
  const nativeSavedEnvelope=async target=>{
    const record=await target.eval(`return ${nativeSavedExpression()};`);
    assert.strictEqual(record.present,true,"an acknowledged collection has a real persistent current key");
    assert.strictEqual(typeof record.raw,"string","persistent collection is serialized schema1");
    return JSON.parse(record.raw);
  };

  // Preference commands can stage an asynchronous read before requesting the
  // lock. Observe the literal expected committed preference, never a new lock.
  async function nativeCommittedPreference(target,expected) {
    const deadline=Date.now()+5000;let actual;
    do {
      actual=(await nativeSavedEnvelope(target)).preferredSelection;
      if(JSON.stringify(actual)===JSON.stringify(expected))break;
      await sleep(20);
    }while(Date.now()<deadline);
    assert.deepStrictEqual(actual,expected,"literal expected preference is committed in the actual IDB transaction");
    return actual;
  }
  const nativeLegacySavedSources=target=>target.eval(`return {hpfc:localStorage.getItem('hpfc'),scales:localStorage.getItem('hpfc.scales'),v3:localStorage.getItem('hpfc.scales.v3')};`);

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
    } catch (waitFailure) {
      const observed = await countText();
      const message = `${label}: expected the counter to read "${text}", saw "${observed}"`;
      if (label !== "a mouse drag past the threshold should commit") assert.fail(message);
      // Freeze the original observation and assertion before diagnostic RPCs.
      // A late animation or a failed diagnostic cannot change this verdict.
      let originalFailure;
      try { assert.fail(message); } catch (error) { originalFailure = error; }
      try {
        const failure = await b.eval(`
          const card=document.getElementById('card'),r=card.getBoundingClientRect(),scene=document.querySelector('.scene');
          const x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);
          const anim=a=>({currentTime:a.currentTime,startTime:a.startTime,playState:a.playState,pending:a.pending,
            timing:a.effect?a.effect.getTiming():null,computedTiming:a.effect?a.effect.getComputedTiming():null});
          return {clock:performance.now(),readyState:document.readyState,viewport:{width:innerWidth,height:innerHeight},
            card:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,hitOnCard:!!hit&&(hit===card||card.contains(hit)),inert:!!card.closest('[inert]')},
            visibility:document.visibilityState,focused:document.hasFocus(),activeElement:document.activeElement?.id||null,
            reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
            booted,savedMode,selection:{...selection},mode,tier,orderLength:order.length,idx,
            count:document.getElementById('count').textContent.trim(),panelOpen,sheetOpen,flipped,eatClick,
            ownLostPointerCaptureSeen:window.__cdpLpcSeen??null,
            drag:drag?{id:drag.id,pointerType:drag.pointerType,x0:drag.x0,y0:drag.y0,last:drag.last,lastY:drag.lastY,moved:drag.moved,pts:drag.pts.map(point=>({...point}))}:null,
            flight:flight?{dir:flight.dir,restRect:flight.rect,animation:anim(flight.anim)}:null,
            sceneInlineTransform:scene.style.transform,sceneComputedTransform:getComputedStyle(scene).transform,
            sceneAnimations:scene.getAnimations().map(anim),allAnimations:document.getAnimations().map(anim)};
        `);
        console.log("POST_DRAG_FAILURE_ONLY_STATE " + JSON.stringify({label,expected:text,observed,waitFailure:String(waitFailure),failure,
          helper:{foregroundSettle:b.foregroundSettle,pendingSettle:!!b._pendingSettle,lastViewport:b.lastViewport}}));
      } catch (diagnosticError) {
        console.log("POST_DRAG_FAILURE_ONLY_STATE " + JSON.stringify({label,expected:text,observed,waitFailure:String(waitFailure),diagnosticError:String(diagnosticError)}));
      }
      throw originalFailure;
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
  test("boots with the default deck loaded", async () => {
    await freshLoad();
    const meta = await decksMeta();
    assert.ok(meta.length >= 1, "page exposes no decks");

    assert.strictEqual(await countText(), `1 / ${(await bootMeta(meta)).chords}`);

    const chips = await chipStates();
    const home = meta.indexOf(await bootMeta(meta));
    assert.strictEqual(chips.length, meta.length, "one chip per deck");
    assert.deepStrictEqual(
      chips.map((c) => c.on),
      chips.map((_, i) => i === home),
      "only the default deck's chip is active on a clean boot",
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
  /* ---------------------------------------------------------------- *
   * 2. deck switching
   * ---------------------------------------------------------------- */
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

  /* Q14: #card's own keydown handler (the card.addEventListener keydown handler in index.html) treats a focused
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
  /* The swipe block (search `swipeDecision`) is the primary way the app is
     navigated on a phone and had no test of any kind until this group. A unit
     test cannot reach it: it is real touch dispatch, not a click. */
  // Owner: "Swipe gesture is very difficult at low speed... requires a very
  // quick flick." A deliberate, unhurried drag - ~30px over 600ms, ~0.05
  // px/ms even in the trailing fling window - must now commit on distance
  // alone (30 > the new 18px SWIPE_COMMIT_PX), with no flick required.
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
  /* ---------------------------------------------------------------- *
   * 5. persistence
   *
   * Subset semantics only: the hpfc key is going to carry spaced-repetition
   * progress too (CONTRACT), so never assert deep equality on it.
   * ---------------------------------------------------------------- */
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
  /* ---------------------------------------------------------------- *
   * print controls (one-pdf-path plan): every deck - built-in and
   * generated - builds its PDF client-side through HPE.pdfdeck, so the
   * header's print row is the same markup everywhere: two <button>s and
   * one paper <select>, never an <a href> to a pre-built file.
   * ---------------------------------------------------------------- */

  /* Lane M1 (menu-shell, 2026-09-28): the print row moved into the one
     settings panel shared by every deck, so it is no longer re-rendered per
     deck - checking it once per built-in deck would just check the same
     static markup N times. What still varies per deck is whether selecting
     one leaves the row intact; the shape claim itself (2 buttons, 1 select,
     never an <a>) is checked once, then re-checked after a couple of deck
     switches and after generating a deck, to prove nothing about switching
     decks touches the panel's markup. */
  /* Lane M1: .prints no longer lives anywhere near .hdr - it moved into the
     settings panel. What's left to prove here is acceptance (1): the card
     face (.hdr included) carries no print controls at all, on every deck,
     and the deck-name box is unaffected (still its normal two lines). The
     panel's own layout budget (no wrap at 380px/320px) is covered separately
     by the settings-panel fit tests below. */
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
    const sel = "#print-pdf-all";
    await b.click("#print-download");
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
      togglePrintMenu();
      document.getElementById("print-pdf-all").focus();
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
      "Enter on the DOWNLOAD PDF button never reached HPE.pdfcards.build - " +
      "the real onclick chain did not run");
    assert.strictEqual(m.buildCalls[0].variant, "shop",
      "Enter on the DOWNLOAD PDF button built the wrong variant");
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
      const sel = document.getElementById("print-paper");
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
      const sel = document.getElementById("print-paper");
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
  // Resources menu links in DOM order: EXPLORE SCALES, HANDPAN 101, each alone
  // in a full-width row, then the ABOUT button (not a link). Every list of
  // Resources ids in this file derives from this literal acceptance inventory.
  const RESOURCES = [
    { id: "res-explore", href: "/scales/", label: "EXPLORE SCALES", row: 0, sameTab: true },
    { id: "res-handpan-101", href: "/handpan-101/", label: "HANDPAN 101", row: 1,
      aria: "Handpan 101", sameTab: true },
  ];
  const RES_IDS = RESOURCES.map((r) => r.id);
  const RES_IDS_JS = JSON.stringify(RES_IDS);

  // D2 re-plan step 2 (R-2): a stop is a control the page RENDERS. Both
  // helpers drive real Tab/Shift+Tab events.
  async function tabKey(shift) {
    for (const type of ["keyDown", "keyUp"]) {
      await b.send("Input.dispatchKeyEvent", {
        type, key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9,
        modifiers: shift ? 8 : 0,
      });
    }
  }
  const stopTag = () => b.eval(`
    const a = document.activeElement;
    return a && a.hasAttribute("data-stop-idx") ? a.getAttribute("data-stop-idx") : (a && a.id) || (a ? "n" + [...document.querySelectorAll("*")].indexOf(a) : null);`);

  test("a panel control unrendered by CSS is never a Tab stop, and Tab still cycles",
    async () => {
      for (const hide of ["#seq-source-link", "#deck-add"]) {
        await freshLoad();
        await openSettingsPanel();
        await b.click("#tier-basic");
        await b.waitFor(`document.getElementById("tier-basic").classList.contains("on")`, { label: "mode S" });
        if (await b.eval(`return document.getElementById("settings-panel").hidden;`)) {
          await openSettingsPanel();
        }
        await b.eval(`const s = document.createElement("style"); s.id = "inj";
          s.textContent = ${JSON.stringify(hide + "{display:none !important}")};
          document.head.appendChild(s); return true;`);
        const rendered = await b.eval(
          `return document.querySelector(${JSON.stringify(hide)}).getClientRects().length;`);
        assert.strictEqual(rendered, 0, `${hide} is still rendered after the injected rule`);
        const ids = await b.eval(`
          window.panelStops().forEach((el, i) => el.setAttribute("data-stop-idx", i));
          return window.panelStops().map(e => e.id);`);
        assert.ok(!ids.includes(hide.slice(1)), `panelStops() lists the unrendered ${hide}`);
        const n = ids.length;
        await b.eval(`document.getElementById("settings-trigger").focus(); return true;`);
        const fwd = [];
        for (let i = 0; i < n; i++) { await tabKey(false); fwd.push(await stopTag()); }
        assert.deepStrictEqual(fwd, [...Array(n).keys()].map((i) => String((i + 1) % n)),
          `${hide}: forward Tab did not cycle every stop once and wrap: ${JSON.stringify(fwd)}`);
        const back = [];
        for (let i = 0; i < n; i++) { await tabKey(true); back.push(await stopTag()); }
        assert.deepStrictEqual(back, [...Array(n).keys()].map((i) => String((n - 1 - i) % n)),
          `${hide}: Shift+Tab did not cycle every stop once and wrap: ${JSON.stringify(back)}`);
      }
    });

  test("Tab from outside the stop list enters the panel cycle", async () => {
    await freshLoad();
    await openSettingsPanel();
    const ids = await b.eval(`
      window.panelStops().forEach((el, i) => el.setAttribute("data-stop-idx", i));
      document.activeElement.blur();
      return { n: window.panelStops().length, active: document.activeElement === document.body };`);
    assert.strictEqual(ids.active, true, "could not park focus outside the stop list");
    await tabKey(false);
    assert.strictEqual(await stopTag(), "0", "Tab from outside did not land on the first stop");
    await b.eval(`document.activeElement.blur(); return true;`);
    await tabKey(true);
    assert.strictEqual(await stopTag(), String(ids.n - 1),
      "Shift+Tab from outside did not land on the last stop");
  });

  // D2 re-plan step 3 (R-1): CSS never unrenders a panel control. The rendered
  // set is a function of mode alone; only the `hidden` attribute setMode()
  // writes, and the panel being closed, take a control out of the panel.
  // D2 re-plan step 3: a ratchet over the CSSOM, never committed red. The
  // dimensional media conditions that can reach the panel (modes A, B and S
  // unioned, `print` and non-dimensional conditions excluded) are a literal
  // list: adding one means editing it here, in view of the reviewer. The walk
  // is the oracle's own (tools/probe/panel_fit.js), so the two cannot drift.
  test("the panel's media conditions are exactly the listed ones", async () => {
    const { WALK_FN, parseCondition } = require("../tools/probe/panel_fit.js");
    await freshLoad();
    const seen = new Set();
    for (const mode of ["A", "B", "S"]) {
      await b.eval(`setMode(${JSON.stringify(mode)}); return true;`);
      const r = await b.eval(`return (${WALK_FN})(location.href);`);
      assert.deepStrictEqual(r.problems, [], "a container or supports rule contains a panel rule");
      for (const c of r.conditions) seen.add(c);
    }
    const dimensional = [...seen].filter((c) => parseCondition(c).queries).sort();
    assert.deepStrictEqual(dimensional, [
      "(max-height: 299px)",
      "(max-height: 520px)",
      "(min-height: 300px) and (max-height: 359px) and (min-width: 740px)",
      "(min-height: 360px) and (max-height: 520px) and (min-width: 740px)",
      "(min-width: 1024px) and (min-height: 700px)",
      "(min-width: 640px) and (min-height: 700px)",
    ].sort());
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

  // AP2-2's stub gap (refactor pass 4, lane T): tools/sandbox.js has no
  // header or footer, so the unit test "AP2-2 setInert applies each caller's
  // own background set" sees the sheet's set as [settings-panel, main] and the
  // panel's as [main, decks]. The real sets are header/main/footer/
  // #settings-panel for the sheet and main/footer/#decks for the panel, and
  // only a real DOM can say which elements actually carry `inert` in each state.
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

  // D2 step 6b (H-9): the second heading ("Chord progression") costs H + g, and at
  // 667x375 in progression the panel now needs 18.75px more than it has under the
  // fallback fonts this harness loads (main needed 373.75 of 375 and fit). That
  // one cell leaves the fits assertion and is asserted on its own, two-sided:
  // scroll equals main's pinned needed + H + g - the panel's height, within 1px,
  // and nothing but the Resources links is below the fold. Every other cell keeps
  // the fit assertion unchanged.
  // macOS fallback fonts measure 373.75; the Linux CI runner's measure 371.75
  // (its 16px headings against macOS's 17px). Both read from origin/main 655a45c.
  // Lane PM (2026-10-08): HANDPAN 101 adds a 44px row + one --sp-1 (47 here) to the
  // Resources column, which is the tall one in this cell; the one-line print row
  // is not in it. That historical intermediate was 418.75 / 420.75.
  // Accepted main/dev's subsequent one-row cleanup pins 369 / 371;
  // compact HTC must preserve that footprint and every original equation.

  test("LE: at 844x390, 740x360 and 926x428 the open settings panel fits with no scroll in every locale, ABOUT alone in its row, and Tab order unchanged",
    { timeout: 240000 }, async () => {
      await freshLoad();
      try {
        const langs = await b.eval(`return [...document.getElementById("lang-select").options].map(o => o.value).filter(v => v !== "auto");`);
        assert.strictEqual(langs.length, 8, "eight UI locales");
        let count = null;
        for (const [vw, vh] of [[844, 390], [740, 360], [926, 428]]) {
          await b.setViewport(vw, vh, true);
          await b.settle();
          for (const lang of langs) {
            await openSettingsPanel();
            await b.eval(`const e=document.getElementById("lang-select");e.value=${JSON.stringify(lang)};e.dispatchEvent(new Event("change",{bubbles:true}));return true;`);
            await b.waitFor(`document.documentElement.lang === ${JSON.stringify(lang)}`, { label: "locale applied" });
            const label = `${vw}x${vh} ${lang}`;
            const m = await b.eval(`
              const p = document.getElementById("settings-panel");
              const ctrls = [...p.querySelectorAll("button, select, a")].filter(e => e.offsetParent);
              const about = document.getElementById("about-open");
              const row = about.parentElement;
              const g = getComputedStyle(p);
              return {
                scrollH: p.scrollHeight, clientH: p.clientHeight, scrollW: p.scrollWidth, clientW: p.clientWidth,
                cols: g.columnCount,
                offscreen: ctrls.filter(e => { const k = e.getBoundingClientRect();
                  return k.left < 0 || k.top < 0 || k.right > innerWidth + 0.5 || k.bottom > innerHeight + 0.5; }).map(e => e.id || e.textContent.trim()),
                aboutAlone: row.children.length === 1,
                aboutFull: Math.abs(about.getBoundingClientRect().width - row.getBoundingClientRect().width) <= 1,
                tabindex: ctrls.filter(e => e.tabIndex > 0).length,
                n: ctrls.length,
              };`);
            assert.strictEqual(m.cols, "2", `${label}: two CSS columns`);
            assert.ok(m.scrollH <= m.clientH + 1, `${label}: panel scrolls (${m.scrollH} > ${m.clientH})`);
            assert.ok(m.scrollW <= m.clientW + 1, `${label}: panel overflows horizontally`);
            assert.deepStrictEqual(m.offscreen, [], `${label}: controls off screen`);
            assert.ok(m.aboutAlone && m.aboutFull, `${label}: ABOUT alone in its full-width row`);
            assert.strictEqual(m.tabindex, 0, `${label}: no positive tabindex`);
            count = count || m.n;
            assert.strictEqual(m.n, count, `${label}: same controls`);
            await b.key("Escape", "Escape", 27);
            await b.waitFor(`document.getElementById("settings-panel").hidden === true`, { label: `close at ${label}` });
          }
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

  test("LS3: below 300px tall in landscape the open settings panel is two columns, scrolls to its last control, clears the trigger and the right edge",
    { timeout: 120000 }, async () => {
      await freshLoad();
      try {
        for (const [vw, vh] of [[852, 260], [932, 280], [844, 250], [667, 260]]) {
          await b.setViewport(vw, vh, true);
          await b.settle();
          await openSettingsPanel();
          const label = `${vw}x${vh}`;
          const m = await b.eval(`
            const p = document.getElementById("settings-panel");
            p.scrollTop = p.scrollHeight;
            const ctrls = [...p.querySelectorAll("button, select, a")].filter(e => e.offsetParent);
            const t = document.getElementById("settings-trigger").getBoundingClientRect();
            const groups = [...p.querySelectorAll(".panel-group")].filter(e => e.offsetParent);
            const lefts = new Set(groups.map(g => Math.round(g.getBoundingClientRect().left)));
            const last = document.getElementById("about-open").getBoundingClientRect();
            return {
              lefts: [...lefts].length,
              overflowY: getComputedStyle(p).overflowY,
              under: ctrls.filter(e => { const k = e.getBoundingClientRect();
                return k.left < t.right && k.right > t.left && k.top < t.bottom && k.bottom > t.top; }).map(e => e.id || e.textContent.trim()),
              wide: ctrls.filter(e => e.getBoundingClientRect().right > innerWidth + 0.5).map(e => e.id || e.textContent.trim()),
              lastBottom: last.bottom, lastTop: last.top,
            };`);
          assert.strictEqual(m.lefts, 2, `${label}: two columns, got ${m.lefts}`);
          assert.strictEqual(m.overflowY, "auto", `${label}: panel scrolls`);
          assert.deepStrictEqual(m.under, [], `${label}: controls under the trigger`);
          assert.deepStrictEqual(m.wide, [], `${label}: controls past the right edge`);
          assert.ok(m.lastBottom <= vh + 0.5 && m.lastTop >= 0, `${label}: ABOUT scrolled into view (${m.lastTop}-${m.lastBottom})`);
          await b.key("Escape", "Escape", 27);
          await b.waitFor(`document.getElementById("settings-panel").hidden === true`, { label: `close at ${label}` });
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

  /* ---------------------------------------------------------------- *
   * Resources menu (docs/plans/2026-10-01-resources-menu.md, eng review
   * amendments 1-7)
   * ---------------------------------------------------------------- */

  test("the settings panel has exactly one Resources group with its two same-tab links and ABOUT, each alone in a row", async () => {
    await freshLoad();
    await openSettingsPanel();
    const m = await b.eval(`
      const headings = [...document.querySelectorAll("#settings-panel .panel-heading")]
        .filter(h => h.textContent.trim() === "Resources");
      const group = headings[0] ? headings[0].closest(".panel-group") : null;
      const links = group ? [...group.querySelectorAll("a")] : [];
      const rows = group ? [...group.querySelectorAll(".modebar")] : [];
      return {
        headingCount: headings.length,
        rowSizes: rows.map(r => r.querySelectorAll("a").length),
        rowOf: links.map(a => rows.indexOf(a.closest(".modebar"))),
        links: links.map(a => ({
          id: a.id, href: a.getAttribute("href"), target: a.getAttribute("target"),
          rel: a.getAttribute("rel"), label: a.textContent.trim(),
          aria: a.getAttribute("aria-label"), onclick: a.getAttribute("onclick"),
          className: a.className,
          textDecoration: getComputedStyle(a).textDecorationLine,
        })),
      };
    `);
    assert.strictEqual(m.headingCount, 1, "expected exactly one Resources heading");
    assert.deepStrictEqual(m.rowSizes, [1, 1, 0], "two link rows, then the ABOUT row with no link");
    assert.strictEqual(m.links.length, 2, `expected 7 links in the Resources group, got ${JSON.stringify(m.links)}`);
    m.links.forEach((link, i) => {
      const expected = RESOURCES[i];
      assert.strictEqual(link.id, expected.id, `link ${i} id mismatch: ${JSON.stringify(link)}`);
      assert.strictEqual(m.rowOf[i], expected.row, `link ${i} sits in the wrong row: ${JSON.stringify(link)}`);
      assert.strictEqual(link.href, expected.href, `link ${i} href mismatch: ${JSON.stringify(link)}`);
      assert.strictEqual(link.label, expected.label, `link ${i} label mismatch: ${JSON.stringify(link)}`);
      if (expected.aria) assert.strictEqual(link.aria, expected.aria, `link ${i} aria-label mismatch: ${JSON.stringify(link)}`);
      assert.strictEqual(link.onclick, null, `link ${i} must not close the panel or run script: ${JSON.stringify(link)}`);
      if (expected.sameTab) {
        assert.strictEqual(link.target, null, `link ${i} must open in the same tab: ${JSON.stringify(link)}`);
        assert.strictEqual(link.rel, null, `link ${i} carries no rel: ${JSON.stringify(link)}`);
      } else {
        assert.strictEqual(link.target, "_blank", `link ${i} must open in a new tab: ${JSON.stringify(link)}`);
        assert.match(link.rel, /\bnoopener\b/, `link ${i} rel must contain noopener: ${JSON.stringify(link)}`);
      }
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
          await b.click(`#${modeBtn(mode)}`);
          await b.settle();
          const m = await b.eval(`
            const p = document.getElementById("settings-panel");
            const resIds = ${RES_IDS_JS};
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
          await b.click(`#${modeBtn(mode)}`);
          await b.settle();
          const m = await b.eval(`
            const p = document.getElementById("settings-panel");
            const resIds = ${RES_IDS_JS};
            return {
              scrollH: p.scrollHeight, clientH: p.clientHeight,
              resVisible: resIds.every(id => {
                const el = document.getElementById(id);
                return el && el.getClientRects().length > 0;
              }),
            };
          `);
          const label = `1024x700 mode ${mode}`;
          if (mode === "S") {
            // D2 step 6b (H-9): progression at 1024x700 needed 673.75 (macOS; 669.75 on the Linux runner) of 688 on
            // main (fallback fonts, which this harness loads) and now needs the
            // second heading's H + g more, so it scrolls by exactly that much
            // less main's spare: two-sided within 1px, and every control is
            // still reachable by scrolling (its bottom is inside scrollHeight).
            const unreachable = await b.eval(`
              const p = document.getElementById("settings-panel");
              const top = p.getBoundingClientRect().top - p.scrollTop;
              return [...p.querySelectorAll("button, a")].filter(e => e.getClientRects().length)
                .filter(e => e.getBoundingClientRect().bottom - top > p.scrollHeight + 0.5).map(e => e.id);`);
            assert.deepStrictEqual(unreachable, [], `${label}: a control lies beyond the scrollable height`);
          } else {
            // Every control stays reachable by scrolling.
            const unreachable = await b.eval(`
              const p = document.getElementById("settings-panel");
              const top = p.getBoundingClientRect().top - p.scrollTop;
              return [...p.querySelectorAll("button, a")].filter(e => e.getClientRects().length)
                .filter(e => e.getBoundingClientRect().bottom - top > p.scrollHeight + 0.5).map(e => e.id);`);
            assert.deepStrictEqual(unreachable, [], `${label}: a control lies beyond the scrollable height`);
          }
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
  // at 746 (+12px, the last site link pushed offscreen), and is clean again
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
            await b.click(`#${modeBtn(mode)}`);
            await b.settle();
            const m = await b.eval(`
              const p = document.getElementById("settings-panel");
              const resIds = ${RES_IDS_JS};
              return {
                scrollH: p.scrollHeight, clientH: p.clientHeight,
                resVisible: resIds.every(id => {
                  const el = document.getElementById(id);
                  return el && el.getClientRects().length > 0;
                }),
              };
            `);
            const label = `${w}x${h} mode ${mode}`;
            if (mode !== "S") {
              assert.ok(m.scrollH <= m.clientH + 1,
                `${label}: the sidebar (${m.scrollH}px) overflows its own box (${m.clientH}px) vertically by ${m.scrollH - m.clientH}px`);
            }
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
  test("RR: at 380x780 EXPLORE SCALES is a 44px full-width target, a tap loads /scales/, and Back shows the app", async () => {
    try {
      await freshLoad();
      await b.setViewport(380, 780, true);
      await b.settle();
      await openSettingsPanel();
      const m = await b.eval(`
        const a = document.getElementById("res-explore"), row = a.parentElement;
        const ar = a.getBoundingClientRect(), rr = row.getBoundingClientRect(), cs = getComputedStyle(row);
        return { h: ar.height, w: ar.width, rowW: rr.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
          alone: row.children.length === 1, text: a.textContent.trim() };`);
      assert.ok(m.h >= 44, `EXPLORE SCALES is ${m.h}px tall`);
      assert.ok(Math.abs(m.w - m.rowW) <= 1, `EXPLORE SCALES is ${m.w}px in a ${m.rowW}px row`);
      assert.ok(m.alone, "EXPLORE SCALES is alone in its row");
      assert.strictEqual(m.text, "EXPLORE SCALES");
      const start = await b.eval(`return location.href;`);
      await b.click("#res-explore");
      await b.waitFor(`location.pathname === "/scales/"`, { label: "the scales page to load" });
      await b.eval(`history.back(); return true;`);
      await b.waitFor(`location.href === ${JSON.stringify(start)} && !!document.getElementById("settings-trigger")`,
        { label: "Back to show the app" });
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

  test("NT: at 375px the Neotone factory table fits, links stay in view, nomut rows hide, and at 1024 they show", async () => {
    try {
      await freshLoad();
      const page = new globalThis.URL(URL).origin + "/scales/neotone/";
      const probe = `
        const vw = document.documentElement.clientWidth;
        const tb = [...document.querySelectorAll("table tbody")];
        const over = [...document.querySelectorAll("table tbody, table th, table td")]
          .filter((e) => !e.matches("th[scope=row]") && e.scrollWidth > e.clientWidth + 1).length;
        const links = [...document.querySelectorAll("table tbody a")];
        const out = links.filter((a) => { const r = a.getBoundingClientRect(); return r.left < 0 || r.right > vw + 1; }).length;
        const card = (n) => tb.find((t) => t.textContent.includes(n));
        const shown = (t) => [...t.querySelectorAll("tr")].map((r) => getComputedStyle(r).display !== "none");
        return { sw: document.documentElement.scrollWidth, over, out, links: links.length, tbodies: tb.length,
          nomutHidden: [...document.querySelectorAll("tr.nomut")].filter((r) => getComputedStyle(r).display === "none").length,
          nomut: document.querySelectorAll("tr.nomut").length,
          sirena: card("La Sirena") && { np: card("La Sirena").textContent.includes("Layout not published"), note: !!card("La Sirena").querySelector("tr.note"), practice: !!card("La Sirena").querySelector("a[href^='/#s=']"), rows: shown(card("La Sirena")) },
          onoleo: card("Onoleo") && { np: card("Onoleo").textContent.includes("Layout not published"), note: !!card("Onoleo").querySelector("tr.note"), practice: !!card("Onoleo").querySelector("a[href^='/#s=']") } };`;
      await b.setViewport(375, 812, true);
      await b.send("Page.navigate", { url: page });
      await b.waitFor(`location.pathname === "/scales/neotone/" && document.querySelectorAll("table tbody").length === 10`, { label: "the Neotone page" });
      await b.settle();
      const m = await b.eval(probe);
      assert.ok(m.sw <= 375, `page scrollWidth ${m.sw}`);
      assert.strictEqual(m.over, 0, "no tbody or cell overflows");
      assert.strictEqual(m.out, 0, "every Practice link is inside the viewport");
      assert.strictEqual(m.tbodies, 10);
      assert.ok(m.sirena.practice && !m.sirena.np && !m.sirena.note, "La Sirena has a Practice link and no disclaimer: " + JSON.stringify(m.sirena));
      assert.ok(m.onoleo.practice && !m.onoleo.np && !m.onoleo.note, "Onoleo has a Practice link and no disclaimer: " + JSON.stringify(m.onoleo));
      assert.ok(m.sirena.rows.every(Boolean), "La Sirena shows its mutant row");
      assert.strictEqual(m.nomutHidden, m.nomut, "nomut rows are hidden on the phone");
      await b.setViewport(1024, 800, false);
      await b.settle();
      const d = await b.eval(probe);
      assert.strictEqual(d.nomutHidden, 0, "nomut rows show at 1024");
      assert.ok(d.sw <= 1024);
    } finally {
      await b.setViewport(900, 900, false);
    }
  });

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
      const ensureResourcesPanelOpen = async () => {
        if (await b.eval(`return getComputedStyle(document.getElementById("settings-panel")).display === "none";`))
          await openSettingsPanel();
        await b.settle();
      };
      for (const mode of ["A", "B", "S"]) {
        await ensureResourcesPanelOpen();
        await b.eval(`document.getElementById("${modeBtn(mode)}").scrollIntoView({block:"nearest", inline:"nearest"}); return true;`);
        await b.click(`#${modeBtn(mode)}`);
        await b.waitFor(`document.getElementById("${modeBtn(mode)}").getAttribute("aria-pressed") === "true"`,
          { label: `Resources activation mode ${mode}` });
        await ensureResourcesPanelOpen();
        const before = await b.eval(`return {
          modeA: document.getElementById("modeA").getAttribute("aria-pressed"),
          modeB: document.getElementById("modeB").getAttribute("aria-pressed"),
          modeS: document.getElementById("tier-basic").getAttribute("aria-pressed"),
          count: document.getElementById("count").textContent,
          front: document.getElementById("front").textContent,
        };`);

        for (const r of RESOURCES) {
          await b.eval(`document.getElementById(${JSON.stringify(r.id)}).scrollIntoView({block:"nearest", inline:"nearest"});
            window.__resActivations = []; return true;`);
          await b.click(`#${r.id}`);
          const afterClick = await b.eval(`return window.__resActivations;`);
          assert.strictEqual(afterClick.length, 1,
            `clicking #${r.id} should produce exactly one activation, got ${JSON.stringify(afterClick)}`);
          assert.strictEqual(afterClick[0].href, r.href, `#${r.id} click activation had the wrong href`);
          assert.strictEqual(afterClick[0].target, r.sameTab ? null : "_blank", `#${r.id} click activation had the wrong target`);
          assert.deepStrictEqual(await b.eval(`return { modeA: document.getElementById("modeA").getAttribute("aria-pressed"),
            modeB: document.getElementById("modeB").getAttribute("aria-pressed"), modeS: document.getElementById("tier-basic").getAttribute("aria-pressed"),
            count: document.getElementById("count").textContent, front: document.getElementById("front").textContent };`), before,
            `mode ${mode}: #${r.id} click preserves practice state`);
          const panelOpenAfterClick = await b.eval(
            `return getComputedStyle(document.getElementById("settings-panel")).display !== "none";`);
          assert.strictEqual(panelOpenAfterClick, true,
            `clicking #${r.id} must not close the settings panel`);

          const focused = await b.eval(`
            window.__resActivations = [];
            document.getElementById(${JSON.stringify(r.id)}).focus();
            return document.activeElement.id;
          `);
          assert.strictEqual(focused, r.id, `mode ${mode}: #${r.id} receives keyboard focus`);
          await b.key("Enter", "Enter", 13);
          const afterEnter = await b.eval(`return window.__resActivations;`);
          assert.strictEqual(afterEnter.length, 1,
            `pressing Enter on #${r.id} should produce exactly one activation, got ${JSON.stringify(afterEnter)}`);
          assert.strictEqual(afterEnter[0].href, r.href, `#${r.id} Enter activation had the wrong href`);
          assert.strictEqual(afterEnter[0].target, r.sameTab ? null : "_blank", `#${r.id} Enter activation had the wrong target`);
          assert.deepStrictEqual(await b.eval(`return { modeA: document.getElementById("modeA").getAttribute("aria-pressed"),
            modeB: document.getElementById("modeB").getAttribute("aria-pressed"), modeS: document.getElementById("tier-basic").getAttribute("aria-pressed"),
            count: document.getElementById("count").textContent, front: document.getElementById("front").textContent };`), before,
            `mode ${mode}: #${r.id} Enter preserves practice state`);
          assert.strictEqual(await b.eval(`return getComputedStyle(document.getElementById("settings-panel")).display !== "none";`), true,
            `mode ${mode}: #${r.id} Enter keeps Settings open`);
        }

        const after = await b.eval(`return {
          modeA: document.getElementById("modeA").getAttribute("aria-pressed"),
          modeB: document.getElementById("modeB").getAttribute("aria-pressed"),
          modeS: document.getElementById("tier-basic").getAttribute("aria-pressed"),
          count: document.getElementById("count").textContent,
          front: document.getElementById("front").textContent,
        };`);
        assert.strictEqual(after.modeA, before.modeA, "a Resources link changed mode A");
        assert.strictEqual(after.modeB, before.modeB, "a Resources link changed mode B");
        assert.strictEqual(after.modeS, before.modeS, "a Resources link changed mode S");
        assert.strictEqual(after.count, before.count, "a Resources link changed the current card position");
        assert.strictEqual(after.front, before.front, "a Resources link changed the displayed card");
      }
    });

  const MENU_VIEWPORTS = [[320, 568, true], [380, 700, true], [768, 1024, false], [844, 390, true], [1024, 700, false]];
  const ROW_JS = `(() => {
    const p = document.getElementById("settings-panel");
    return [...p.querySelectorAll(".modebar, .prints")].filter(r => r.offsetParent).map(r => {
      const cs = getComputedStyle(r), rr = r.getBoundingClientRect();
      const kids = [...r.children].filter(k => k.offsetParent);
      const lines = [];
      for (const k of kids) {
        const kr = k.getBoundingClientRect();
        let l = lines.find(x => Math.abs(x.top - kr.top) < 4);
        if (!l) { l = { top: kr.top, items: [] }; lines.push(l); }
        l.items.push({ id: k.id || k.textContent.trim().slice(0, 12), left: kr.left, right: kr.right, width: kr.width });
      }
      return { cls: r.className, left: rr.left + parseFloat(cs.paddingLeft), right: rr.right - parseFloat(cs.paddingRight), lines };
    });
  })()`;

  test("PDF tier menu: opens under the row without moving it, three tappable items fit in every locale, the panel stays open, Escape closes only the menu",
    { timeout: 300000 }, async () => {
      await freshLoad();
      try {
        const langs = await b.eval(`return [...document.getElementById("lang-select").options].map(o => o.value).filter(v => v !== "auto");`);
        assert.strictEqual(langs.length, 8, "eight UI locales");
        for (const [vw, vh, over] of [[320, 568, true], [380, 700, true], [844, 390, true], [1024, 700, false]]) {
          await b.setViewport(vw, vh, over);
          await b.settle();
          for (const lang of langs) {
            await openSettingsPanel();
            await b.eval(`const e=document.getElementById("lang-select");e.value=${JSON.stringify(lang)};e.dispatchEvent(new Event("change",{bubbles:true}));return true;`);
            await b.waitFor(`document.documentElement.lang === ${JSON.stringify(lang)}`, { label: "locale applied" });
            const label = `${vw}x${vh} ${lang}`;
            const MEASURE = `(() => {
              const row = document.querySelector("#settings-panel .prints"), trig = document.getElementById("print-download");
              const menu = document.getElementById("print-menu");
              const items = [...menu.querySelectorAll("button")];
              return {
                rowH: row.getBoundingClientRect().height, trigW: trig.getBoundingClientRect().width,
                rowBottom: row.getBoundingClientRect().bottom, rowTop: row.getBoundingClientRect().top,
                open: !!menu.offsetParent, expanded: trig.getAttribute("aria-expanded"),
                panelHidden: getComputedStyle(document.getElementById("settings-panel")).display === "none",
                items: items.map(i => { const r = i.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                  return { id: i.id, h: r.height, top: r.top, left: r.left, right: r.right, spill: i.scrollWidth - i.clientWidth, hit: hit === i || i.contains(hit) }; }),
              };
            })()`;
            const closed = await b.eval(`return ${MEASURE};`);
            assert.strictEqual(closed.open, false, `${label}: menu starts closed`);
            await b.click("#print-download");
            await b.waitFor(`!!document.getElementById("print-menu").offsetParent`, { label: "menu to open" });
            const m = await b.eval(`return ${MEASURE};`);
            assert.strictEqual(m.expanded, "true", `${label}: aria-expanded`);
            assert.strictEqual(m.rowH, closed.rowH, `${label}: opening the menu changed the row height`);
            assert.strictEqual(m.trigW, closed.trigW, `${label}: opening the menu changed the trigger width`);
            assert.strictEqual(m.panelHidden, false, `${label}: opening the menu closed the panel`);
            assert.deepStrictEqual(m.items.map((i) => i.id), ["print-pdf-easy", "print-pdf-easy_medium", "print-pdf-all"]);
            for (const i of m.items) {
              assert.ok(i.h >= 44, `${label}: ${i.id} is under the 44px target (${i.h})`);
              assert.ok(i.spill <= 0, `${label}: ${i.id} clips its text`);
              assert.ok(i.left >= 0 && i.right <= vw + 0.5, `${label}: ${i.id} leaves the viewport`);
              assert.ok(i.top >= m.rowBottom - 0.5 || i.top + i.h <= m.rowTop + 0.5, `${label}: ${i.id} overlaps the print row ${JSON.stringify([i, m.rowTop, m.rowBottom])}`);
              assert.ok(i.top >= 0 && i.top + i.h <= vh + 0.5, `${label}: ${i.id} leaves the viewport vertically`);
              assert.ok(i.hit, `${label}: ${i.id} is covered by something else at its centre`);
            }
            await b.key("Escape", "Escape", 27);
            const after = await b.eval(`return ${MEASURE};`);
            assert.strictEqual(after.open, false, `${label}: Escape left the menu open`);
            assert.strictEqual(after.panelHidden, false, `${label}: Escape on an open menu closed the panel`);
            const PAPER = `(() => {
              const trig = document.getElementById("print-paper"), menu = document.getElementById("print-paper-menu");
              const row = document.querySelector("#settings-panel .prints").getBoundingClientRect();
              return { open: !!menu.offsetParent, expanded: trig.getAttribute("aria-expanded"), rowH: row.height,
                other: !!document.getElementById("print-menu").offsetParent, focus: document.activeElement.id,
                items: [...menu.querySelectorAll("button")].map(i => { const r = i.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                  return { id: i.id, h: r.height, top: r.top, left: r.left, right: r.right, spill: i.scrollWidth - i.clientWidth, hit: hit === i || i.contains(hit) }; }) };
            })()`;
            const pClosed = await b.eval(`return ${PAPER};`);
            assert.strictEqual(pClosed.open, false, `${label}: paper menu starts closed`);
            await b.click("#print-download");
            await b.waitFor(`!!document.getElementById("print-menu").offsetParent`, { label: "download menu to open" });
            await b.click("#print-paper");
            await b.waitFor(`!!document.getElementById("print-paper-menu").offsetParent`, { label: "paper menu to open" });
            const pm = await b.eval(`return ${PAPER};`);
            assert.strictEqual(pm.other, false, `${label}: opening the paper menu left the download menu open`);
            assert.strictEqual(pm.expanded, "true", `${label}: paper aria-expanded`);
            assert.strictEqual(pm.rowH, pClosed.rowH, `${label}: opening the paper menu changed the row height`);
            assert.deepStrictEqual(pm.items.map((i) => i.id), ["print-paper-letter", "print-paper-a4"]);
            for (const i of pm.items) {
              assert.ok(i.h >= 44, `${label}: ${i.id} is under the 44px target (${i.h})`);
              assert.ok(i.spill <= 0, `${label}: ${i.id} clips its text`);
              assert.ok(i.left >= 0 && i.right <= vw + 0.5, `${label}: ${i.id} leaves the viewport`);
              assert.ok(i.top >= 0 && i.top + i.h <= vh + 0.5, `${label}: ${i.id} leaves the viewport vertically`);
              assert.ok(i.hit, `${label}: ${i.id} is covered by something else at its centre`);
            }
            await b.click("#print-download");
            await b.waitFor(`!document.getElementById("print-paper-menu").offsetParent`, { label: "paper menu to close" });
            assert.strictEqual((await b.eval(`return ${PAPER};`)).expanded, "false", `${label}: paper aria-expanded after the download menu opened`);
            await b.key("Escape", "Escape", 27);
            await b.click("#print-paper");
            await b.key("Escape", "Escape", 27);
            const pEsc = await b.eval(`return ${PAPER};`);
            assert.strictEqual(pEsc.open, false, `${label}: Escape left the paper menu open`);
            assert.strictEqual(pEsc.focus, "print-paper", `${label}: Escape did not return focus to the paper button`);
            await b.key("Escape", "Escape", 27);
          }
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

  test("the paper button is styled like DOWNLOAD PDF, and its menu picks the paper, closes on choice and outside tap, and keeps the panel open",
    async () => {
      await freshLoad();
      try {
        for (const [vw, vh, over] of [[380, 700, true], [1280, 800, false]]) {
          await b.setViewport(vw, vh, over);
          await b.settle();
          await openSettingsPanel();
          const PICK = `const pick = (id) => { const c = getComputedStyle(document.getElementById(id)); return { h: c.height, font: c.font, ls: c.letterSpacing, border: c.border, bg: c.backgroundColor, color: c.color, radius: c.borderRadius, ta: c.textAlign }; };`;
          const away = () => b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
          await b.click("#print-download");
          await away();
          const dlItem = await b.eval(`${PICK} return pick("print-pdf-easy");`);
          await b.click("#print-paper");
          await away();
          const look = await b.eval(`${PICK} return { dl: pick("print-download"), paper: pick("print-paper"), item: pick("print-paper-a4") };`);
          look.dlItem = dlItem;
          await b.click("#print-paper");
          assert.deepStrictEqual(look.paper, look.dl, `${vw}x${vh}: the paper button differs from DOWNLOAD PDF`);
          assert.deepStrictEqual(look.item, look.dlItem, `${vw}x${vh}: a paper menu item differs from a PDF menu item`);
          assert.strictEqual(await b.eval(`return document.getElementById("print-paper").textContent;`), "LETTER");
          await b.click("#print-paper");
          await b.click("#print-paper-a4");
          const m = await b.eval(`return { label: document.getElementById("print-paper").textContent,
            open: !!document.getElementById("print-paper-menu").offsetParent, focus: document.activeElement.id,
            checked: [...document.querySelectorAll("#print-paper-menu button")].map(i => i.getAttribute("aria-checked")),
            panel: getComputedStyle(document.getElementById("settings-panel")).display !== "none" };`);
          assert.deepStrictEqual(m, { label: "A4", open: false, focus: "print-paper", checked: ["false", "true"], panel: true }, `${vw}x${vh}`);
          await b.click("#print-paper");
          await b.waitFor(`!!document.getElementById("print-paper-menu").offsetParent`, { label: "paper menu to open" });
          await b.click("#modeB");
          assert.strictEqual(await b.eval(`return !!document.getElementById("print-paper-menu").offsetParent;`), false, `${vw}x${vh}: an outside tap left the paper menu open`);
          await b.eval(`setPrintPaper("letter"); return true;`);
          await b.key("Escape", "Escape", 27);
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

  test("every row of the settings panel is flush: each visual line spans the row from edge to edge",
    async () => {
      await freshLoad();
      try {
        for (const [vw, vh, over] of MENU_VIEWPORTS) {
          await b.setViewport(vw, vh, over);
          await b.settle();
          await openSettingsPanel();
          const rows = await b.eval(`return ${ROW_JS};`);
          assert.ok(rows.length >= 4, `${vw}x${vh}: expected the panel's rows to be measured, got ${rows.length}`);
          for (const r of rows) {
            for (const l of r.lines) {
              const first = Math.min(...l.items.map((i) => i.left)), last = Math.max(...l.items.map((i) => i.right));
              assert.ok(Math.abs(first - r.left) <= 1 && Math.abs(last - r.right) <= 1,
                `${vw}x${vh}: a line of .${r.cls} is not flush: ${JSON.stringify(l.items)} in [${r.left}, ${r.right}]`);
            }
          }
          const prints = await b.eval(`
            const row = document.querySelector("#settings-panel .prints");
            const kids = [...row.children].filter(k => k.offsetParent);
            const tops = kids.map(k => k.getBoundingClientRect().top);
            return { n: kids.length, oneLine: Math.max(...tops) - Math.min(...tops) < 2,
              tall: Math.min(...kids.map(k => k.getBoundingClientRect().height)),
              spill: kids.map(k => k.scrollWidth - k.clientWidth) };
          `);
          assert.strictEqual(prints.n, 2, `${vw}x${vh}: the print row holds two controls`);
          assert.ok(prints.oneLine, `${vw}x${vh}: DOWNLOAD PDF and the paper select are not on one line`);
          assert.ok(prints.tall >= 44, `${vw}x${vh}: a print control is under the 44px target`);
          assert.ok(prints.spill.every((x) => x <= 0), `${vw}x${vh}: a print control clips its text: ${JSON.stringify(prints.spill)}`);
          await b.key("Escape", "Escape", 27);
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

  // Shared browser-side line reader: count text glyph rows, not the boxes
  // of wrappers around those rows. Keep the existing width filter/top bins.
  function renderedTextLineCount(el) {
    const tops = new Set();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue.trim()) continue;
      const r = document.createRange();
      r.selectNodeContents(node);
      for (const x of r.getClientRects()) {
        if (x.width > 0) tops.add(Math.round(x.top / 4));
      }
    }
    return tops.size;
  }

  // These literal fixtures specify actual text rows independently of the
  // reader. The padded nested wrapper exposes a container rectangle that is
  // not a third text line; THREE remains a real third-line witness.
  test("#seq-source-link and the Resources links are each a panel stop exactly once, and the links carry no onclick",
    async () => {
      await freshLoad();
      await openSettingsPanel();
      await b.click(`#${modeBtn("S")}`);
      await b.waitFor(`document.getElementById("settings-panel").hidden === true`, { label: "panel to close after selecting mode S" });
      await openSettingsPanel();
      const m = await b.eval(`
        const stops = window.panelStops();
        return { ids: stops.map(e => e.id).filter(Boolean),
          onclick: ${RES_IDS_JS}.map(id => document.getElementById(id).getAttribute("onclick")) };
      `);
      for (const id of RES_IDS) assert.strictEqual(m.ids.filter((x) => x === id).length, 1, `#${id} must be a panel stop exactly once`);
      assert.strictEqual(m.ids.filter((x) => x === "seq-source-link").length, 1, "#seq-source-link must be a panel stop exactly once in mode S");
      assert.deepStrictEqual(m.onclick, RES_IDS.map(() => null));
    });

  // AD8 (owner: "All buttons should center text"). Every visible button and
  // link in the panel, per line of its label: the text rect sits centred in the
  // control's box within 1px. #seq-source-link is excluded: it is inline text in
  // a note paragraph, not a boxed control. A <select>'s shown value is not a text
  // node, so no Range can measure it: for the select this asserts only the
  // computed text-align / text-align-last, which proves the CSS asks for a
  // centred value (and Chrome honours it), not the rendered pixel position.
  test("every button and link in the settings panel centres its label, line by line; the paper control is a centred button",
    async () => {
      await freshLoad();
      try {
        for (const [vw, vh, over] of [[320, 568, true], [380, 700, true], [1024, 700, false]]) {
          await b.setViewport(vw, vh, over);
          await b.settle();
          await openSettingsPanel();
          const m = await b.eval(`
            const p = document.getElementById("settings-panel");
            const ctrls = [...p.querySelectorAll("button, a")].filter(e => e.offsetParent && e.id !== "seq-source-link");
            const bad = [];
            for (const e of ctrls) {
              const k = e.getBoundingClientRect(), g = document.createRange(); g.selectNodeContents(e);
              const lines = [];
              for (const t of g.getClientRects()) {
                if (t.width < 1) continue;
                let l = lines.find(x => Math.abs(x.top - t.top) < 4);
                if (!l) { l = { top: t.top, left: t.left, right: t.right }; lines.push(l); }
                l.left = Math.min(l.left, t.left); l.right = Math.max(l.right, t.right);
              }
              for (const l of lines) {
                const d = (l.left - k.left) - (k.right - l.right);
                if (Math.abs(d) > 2) bad.push((e.id || e.textContent.trim()) + " off by " + (d / 2).toFixed(2));
              }
            }
            return { n: ctrls.length, bad, paper: ctrls.some(e => e.id === "print-paper"),
              selects: p.querySelectorAll(".prints select").length };
          `);
          const label = `${vw}x${vh}`;
          assert.ok(m.n >= 10, `${label}: expected the panel's buttons and links to be measured, got ${m.n}`);
          assert.deepStrictEqual(m.bad, [], `${label}: labels not centred in their controls`);
          assert.strictEqual(m.paper, true, `${label}: the paper button was not measured for centring`);
          assert.strictEqual(m.selects, 0, `${label}: the print row holds a native select again`);
          await b.key("Escape", "Escape", 27);
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

  test("the paper choice survives a reload", async () => {
    await freshLoad();
    await openSettingsPanel();
    await b.eval(`
      document.getElementById("print-paper").click();
      document.getElementById("print-paper-a4").click();
      return true;
    `);
    const before = await stored();
    assert.strictEqual(before.printPaper, "a4", "the paper choice was not saved under \"hpfc\"");

    await navigate(); // reload
    await b.waitFor(`document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`, {
      label: "chips after reload",
    });
    const after = await b.eval(`
      return document.getElementById("print-paper").textContent;
    `);
    assert.strictEqual(after, "A4", "the paper button did not come back on A4 after a reload");
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

  /** Tap the primary: on Add's Scale tab that is NEXT first, then GENERATE CARDS. */
  async function clickGenerate() {
    if (await b.eval(`return !document.getElementById("scale-next").hidden;`)) {
      await b.click("#scale-next");
      await b.waitFor(`!document.getElementById("scale-panel-layout").hidden`, { label: "the Layout tab after NEXT" });
    }
    await b.click("#scale-generate");
  }
  async function generate(scale) {
    await openSheet();
    await typeScale(scale);
    await clickGenerate();
    await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "the sheet to close after Generate" });
  }

  // AC6, the half the reachability test above cannot see. That test filters on
  // [inert] alone, so it passes just as happily whether aria-hidden is set or
  // not: inert already removes the background from the tab order and from hit
  // testing. aria-hidden is what removes it from the SCREEN READER, which is a
  // separate promise to a separate user, and it needs its own assertion or a
  // change that drops it ships green.
  // Task item 2's own acceptance criterion: opening "+ Add a scale" from the
  // panel closes the panel FIRST (see addChip.onclick), so cancelling the
  // sheet must not leave the panel's inert/hidden bookkeeping stuck. Nothing
  // in header/main/footer/#settings-panel may still be inert or aria-hidden,
  // the panel itself must be closed (hidden, aria-expanded=false on the
  // trigger) and the scrim must be hidden.
  // AC3. The drawer closed on a backdrop tap; the page has no backdrop, and a
  // stray tap on a full-viewport page would silently discard an unsaved edit.
  // BACK is the gesture now, and the old one has to be gone, not just unused.
  // AC4. The page owns a history entry, so the platform back gesture is the
  // same close - and it must not take the browser off the app.
  /* Q1: the share-URL inbound flow (the location.hash SHARE_PREFIX branch at boot in index.html) had no e2e test -
     openShare() itself is unit-tested against the sandbox (app.test.js), but
     the sandbox never navigates, so a boot-order regression on a real
     `location.hash` would stay green everywhere else. This test takes the
     FRESH-navigation path (a real boot on the link); the in-tab path, a
     `hashchange` to a `#s=` code, goes through the same openShare() and is
     covered in describe("share url") below.
     The link is built through the app's own shareLink(), never hand-encoded
     here, so the wire format is exercised exactly as a real share does it. */
  /* Every deck - built-in or generated - prints through the same client-side
     PDF path and the same shared panel (one-pdf-path plan, lane M1's
     menu-shell move): there is no per-deck .prints any more, so a generated
     deck's card faces carry no print controls either. */

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
  /* NAN (TRI-29): a non-ASCII name saves, survives a reload, shows in its chip
     and prints. The print faces draw printable ASCII only, so an accented name
     prints with its accents stripped and a name that is not drawable even then
     prints the scale's auto label. Read off the blob, as above. */
  /* The generated-deck test above is the full pymupdf oracle (page count,
     page box, card-frame count, glyph count). This is the same claim - "a
     reader can open it" - run over a BUILT-IN deck, which as of the
     one-pdf-path plan goes through HPE.pdfdeck.fromBuiltin rather than
     fromGenerated. A lighter probe is enough here: the two code paths
     converge on the same pdfcards.build/pymupdf-verified renderer, and this
     test exists to catch fromBuiltin wiring - a missing/garbled overlay
     field, a bad geom.ext fallback - not to re-prove the renderer itself. */
  test("a built-in deck's DOWNLOAD PDF tap produces bytes that open as a PDF", async () => {
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
        togglePrintMenu();
        const btn = document.getElementById("print-pdf-all");
        if (!btn) return { err: "no ALL item in the DOWNLOAD PDF menu" };
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

  // "+ ADD is fully on-screen and hit-testable at phone widths" (row 1926,
  // pre-M2) retired 2026-09-28: it guarded + ADD's reachability as the
  // strip's own first chip, which could be scrolled off-screen at phone
  // widths. "+ Add a scale" now lives in the settings panel (M2), a fixed
  // dialog that is never subject to the deck strip's scroll/overflow at
  // all - the behaviour under test is gone, not merely relocated. Panel
  // reachability and on-screen fit are covered by "the settings panel fits
  // entirely on screen, with no clipping or scroll, at 320x568 and 844x390"
  // and by the 44px-target sweep below.

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
  const LANDSCAPE_CONTROLS = ["#share-copy", "#settings-trigger", ".shuffle", ".count", "#prev", "#next"];

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
    // Raised 2026-11-01 (logo in the app, owner Q2 2026-10-31): the header row
    // grew from 44px to the 64px lockup (+20px; at 320 the lockup shrinks to
    // 52.7px, +9px), so portrait chrome 225.67 -> 245.67 (320x568: 227.67 ->
    // 236.69 measured, budget 238.67) and the card at 375x667 and 320x568 gave
    // up 0.6% and 2.6%. Landscape does not move: the h1 stays hidden there.
    [390, 844, 343.19, 245.67],
    [390, 745, 342.69, 245.67],
    [375, 667, 305.11, 245.67],
    [320, 568, 239.91, 238.67],
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

  test("lockup: the header lockup is 64px tall at 380 and inside .hrow clear of both buttons, and shrinks to fit at 320",
    async () => {
      await freshLoad();
      try {
        const bad = [];
        for (const [vw, vh, wantH] of [[380, 740, 64], [320, 568, null]]) {
          await b.setViewport(vw, vh, true);
          const m = await b.eval(`
            const r = (el) => { const x = el.getBoundingClientRect(); return {l: x.left, r: x.right, t: x.top, b: x.bottom, w: x.width, h: x.height}; };
            const row = r(document.querySelector(".hrow"));
            const svg = r(document.querySelector("h1 svg"));
            return {row, svg, share: r(document.querySelector("#share-copy")),
              settings: r(document.querySelector("#settings-trigger")),
              scrollW: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth};
          `);
          const tag = `${vw}x${vh}`;
          if (wantH !== null && Math.abs(m.svg.h - wantH) > 0.6) bad.push(`${tag}: the lockup is ${m.svg.h}px tall, want ${wantH}`);
          if (wantH === null && !(m.svg.h < 64 && m.svg.h > 44)) bad.push(`${tag}: the lockup is ${m.svg.h}px tall, want it shrunk below 64 and above 44`);
          if (m.svg.l < m.row.l - 0.5 || m.svg.r > m.row.r + 0.5 || m.svg.t < m.row.t - 0.5 || m.svg.b > m.row.b + 0.5) bad.push(`${tag}: the lockup leaves .hrow`);
          if (m.svg.l < m.share.r - 0.5) bad.push(`${tag}: the lockup overlaps #share-copy`);
          if (m.svg.r > m.settings.l + 0.5) bad.push(`${tag}: the lockup overlaps #settings-trigger`);
          if (m.scrollW > m.cw) bad.push(`${tag}: the page scrolls sideways (${m.scrollW} > ${m.cw})`);
        }
        assert.deepStrictEqual(bad, []);
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
    await b.setViewport(380, 840, true);
    await generate(EDIT_SCALE);
    await openEdit();
  }

  /** Open the Layout tab, the way a finger does. */
  const openDrawer = async () => {
    await b.eval(`document.getElementById("scale-tab-layout")
      .scrollIntoView({ block: "nearest", inline: "nearest" }); return true;`);
    await b.click("#scale-tab-layout");
    await b.waitFor(`!document.getElementById("scale-panel-layout").hidden`,
      { label: "the Layout tab to open" });
  };
  /** editFreshDeck(), then the drawer that holds ROTATE, MOVE and RESET. */
  async function editFreshDeckOpen() {
    await editFreshDeck();
    await openDrawer();
  }

  /* ------------------------------------------------------------------
   * Lane DR1: the layout drawer shell, judged in a real browser. The unit
   * tests own the state; these own what only a layout engine can see. The
   * numbers are the spec's acceptance lines
   * (docs/plans/2026-10-07-scale-drawer-design-spec.md).
   * ---------------------------------------------------------------- */
  const DR1_SCALE = "[C3] (D3) A3 C4 D4";
  const addWithDrawer = async (w, h) => {
    await freshLoad();
    await b.setViewport(w, h, true);
    await openSheet();
    await typeScale(DR1_SCALE);
    await openDrawer();
  };
  const bandPosition = () =>
    b.eval(`return getComputedStyle(document.getElementById("scale-plate-band")).position;`);
  const body = `document.querySelector("#scale-sheet .sheetbody")`;
  const scrollEnd = () => b.eval(`const s = ${body}; s.scrollTop = s.scrollHeight; return s.scrollTop;`);
  const inScrollport = (id) => b.eval(`
    const sp = ${body}.getBoundingClientRect();
    const r = document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, spTop: sp.top, spBottom: sp.bottom, h: r.height };
  `);

  // DI-E: the four note fields beside the scale line (plan 2026-10-18-dual-input.md, H2b').
  const DI_FIELDS = ["scale-ding", "scale-top", "scale-inner", "scale-bottom"];
  const diVisible = (id) => b.eval(`
    const el = document.getElementById(${JSON.stringify(id)}), r = el.getBoundingClientRect();
    const sp = document.querySelector("#scale-sheet .sheetbody").getBoundingClientRect();
    const vv = window.visualViewport, bottom = Math.min(sp.bottom, vv.offsetTop + vv.height);
    const band = document.getElementById("scale-plate-band"), under = ${JSON.stringify(id)} !== "scale-preview" && getComputedStyle(band).position === "sticky" && r.left < band.getBoundingClientRect().right - 1 ? band.getBoundingClientRect().bottom : 0;
    const top = Math.max(sp.top, vv.offsetTop, under);
    return { h: r.height, vis: Math.max(0, Math.min(r.bottom, bottom) - Math.max(r.top, top)) };`);
  const diPan = () => diVisible("scale-preview");
  const diHeadHidden = () => b.eval(`return getComputedStyle(document.querySelector("#scale-sheet .sheethead")).display === "none" ||
    document.querySelector("#scale-sheet .sheethead").getBoundingClientRect().height === 0;`);
  const diOpenAdd = async (w, h) => {
    await freshLoad();
    await b.setViewport(w, h, true);
    await openSheet();
  };
  const diKeyboardCase = async (w, h, hideHead) => {
    try {
      await diOpenAdd(w, h);
      for (const id of DI_FIELDS) {
        await b.clearKeyboard();
        await b.eval(`document.activeElement && document.activeElement.blur(); document.querySelector("#scale-sheet .sheetbody").scrollTop = 0; return true;`);
        await b.fakeKeyboard(h - 260);
        await b.eval(`document.getElementById(${JSON.stringify(id)}).focus(); return true;`);
        await b.settle();
        await b.send("Input.insertText", { text: "A" });
        await b.settle();
        const f = await diVisible(id), p = await diPan();
        assert.ok(f.vis >= f.h - 0.5, `${w}x${h} ${id}: only ${f.vis} of ${f.h}px of the field is in view`);
        assert.ok(p.vis >= (hideHead && id === "scale-bottom" ? Math.min(p.h, 24) : p.h - 0.5), `${w}x${h} ${id}: ${p.vis} of ${p.h}px of the small pan in view`);
        if (hideHead) assert.ok(await diHeadHidden(), `${w}x${h} ${id}: the sheet head is still shown`);
      }
      if (hideHead) {
        await b.eval(`document.activeElement && document.activeElement.blur(); return true;`);
        await b.clearKeyboard();
        await b.settle();
        const back = await b.eval(`const r = document.getElementById("scale-back").getBoundingClientRect(); return r.height;`);
        assert.ok(back > 0, "BACK did not show again once the keyboard closed");
      }
    } finally {
      await b.clearKeyboard();
      await b.setViewport(900, 900, false);
    }
  };

  const activeChipText = () => b.eval(`
    const el = document.activeElement;
    return el && el.closest && el.closest("#decks") ? el.textContent.trim() : null;
  `);


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
    const sel = hits.filter(h => h.getAttribute("aria-pressed") === "true");
    const row = document.getElementById("scale-layout-zone").getBoundingClientRect();
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
    await clickGenerate();
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
        .filter(el => !el.disabled && el.getClientRects().length > 0 && el.textContent.trim().match(/^(GENERATE|SAVE)/)).length,
      body: { sw: document.body.scrollWidth, cw: document.body.clientWidth },
    };
  `);

  // A valid seed can still have no playable chords: its submit refusal is a
  // real non-parser error, independent of the removed inventory veto.
  const BUILD_REFUSAL_SEED = "(F3) C4 Ab4 Bb4";
  const BUILD_REFUSAL_TEXT = "This pan has no playable chords - try a different scale.";
  const nativeRefusalSelection = () => b.eval(`
    const chip=document.querySelector('#decks .chip.on');
    return {kind:chip.getAttribute('data-selection-kind'),id:chip.getAttribute('data-selection-id')};
  `);
  async function stageBuildRefusal() {
    await typeScale(BUILD_REFUSAL_SEED);
    const parsed=await b.eval(`return {
      summary:document.getElementById('scale-parse').textContent.trim(),
      refusal:document.getElementById('scale-refusal').textContent.trim(),
      disabled:document.getElementById('scale-generate').disabled,
      bad:document.getElementById('scale-box').classList.contains('bad')};`);
    assert.ok(parsed.summary.length>0,"the literal seed must produce a successful parse summary before submit");
    assert.strictEqual(parsed.refusal,"");assert.strictEqual(parsed.bad,false);
    assert.strictEqual(parsed.disabled,false,"grammar-valid zero-chord input must reach real generation");
    const selection=await nativeRefusalSelection();
    assert.strictEqual(selection.kind,"saved","the refusal fixture edits an existing saved instrument");
    await nativeCommittedPreference(b,selection);
    return {envelope:await nativeSavedEnvelope(b),selection};
  }
  async function assertRefusalSavedUnchanged(before) {
    assert.deepStrictEqual(await nativeSavedEnvelope(b),before.envelope,"refused generation and draft actions cannot mutate committed saved data");
    assert.deepStrictEqual(await nativeRefusalSelection(),before.selection,"refused generation and draft actions cannot change selection");
  }
  async function assertStandingBuildRefusal(before) {
    assert.strictEqual(await b.eval("return document.getElementById('scale-refusal').textContent.trim();"),BUILD_REFUSAL_TEXT);
    assert.strictEqual(await b.eval("return document.getElementById('scale-generate').disabled;"),true,"a standing build refusal stays disabled until the seed changes");
    await assertRefusalSavedUnchanged(before);
  }
  async function submitBuildRefusal(before) {
    const actionLabel=await b.eval("return document.getElementById('scale-generate').textContent;");
    await clickGenerate();
    // Wait for handler completion, not the expected error channel or state:
    // a fault that routes the message incorrectly must fail an assertion.
    await b.waitFor(`savePending===null && document.getElementById('scale-generate').textContent===${JSON.stringify(actionLabel)}`,
      {label:"the submit handler completes and restores its action label"});
    await assertStandingBuildRefusal(before);
  }

  // Approved variants policy replaces inventory-collision refusal with
  // instance-targeted Edit. Preserve sibling bytes and usable re-entry.
  /* Both tests below are the reviewer's, 2026-09-21. The first cut of the
     seed-refusal move shared ONE reserved row between #scale-parse and
     #scale-msg, the sheet's general message area - and #scale-msg has callers
     that write while the parse line is also full. Two of them are reproduced
     here. They do not go through the typing path, so neither
     "the sheet does not change height as the seed is typed" nor
     "the pan does not move when the seed goes bad" could see them: the row
     took two lines, the pan stepped 26.59px under the finger, and
     the last row's bottom (then #scale-swatches, now the Scale tab's
     scale field row since the palette moved to Layout) reached 785.69 against
     a 780px viewport.
     The fix is one element per role - #scale-refusal in the .fieldrow for
     seed refusals, #scale-msg below the pan for everything else - so what
     these assert is that a message which is NOT about the seed never enters
     the seed's row. */

  const layoutRowReachable = () => b.eval(`
    const port = document.querySelector(".sheetbody");
    const prev = port.scrollTop;
    port.scrollTop = port.scrollHeight;
    const row = document.getElementById("scale-box").closest(".fieldrow").getBoundingClientRect();
    const r = { rowBottom: row.bottom, portBottom: port.getBoundingClientRect().bottom };
    port.scrollTop = prev;
    return r;
  `);

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

  /* ---------------------------------------------------------------- Lane W1
   * The wrapping scale field (spec 16.2 lines 1-8, 79, 80, 118) and the two
   * mirror switches' hit area. Measured at 380, the phone width the sheet is
   * built for. */
  const W1_PHONE = [380, 780, true];

  const fieldMetrics = () => b.eval(`
    const ta = document.getElementById("scale-box");
    const wrap = document.getElementById("scale-box-wrap");
    const cs = getComputedStyle(ta);
    const line = parseFloat(cs.lineHeight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
    return {
      tag: ta.tagName, h: ta.getBoundingClientRect().height, line, padY,
      rows: Math.round((ta.getBoundingClientRect().height - padY) / line),
      sw: ta.scrollWidth, cw: ta.clientWidth, wsw: wrap.scrollWidth, wcw: wrap.clientWidth,
      st: ta.scrollTop, sh: ta.scrollHeight, ch: ta.clientHeight,
      grow: wrap.dataset.grow, active: document.activeElement && document.activeElement.id,
    };
  `);

  /** The first count of repeated words at which the field is `rows` high. */
  async function wordsForRows(rows) {
    for (let n = 1; n <= 120; n += 1) {
      await typeScale("(D3) " + "Ab4 ".repeat(n).trim());
      if ((await fieldMetrics()).rows === rows) return n;
    }
    return null;
  }


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
  const BIG_SCALE = "[C3] (D3) [E3] [F3] [G3] [A3] A3 [Bb3] C4 D4 E4 F4 G4 A4 C5 D5 E5 F5 | G5 A5";

  // Everything the fold check needs, read in one round trip and with nothing
  // scrolled first. `hit` is named so a failure says what is covering it.
  const primaryFold = () => b.eval(`
    // Every scrollable box in the sheet, so "nothing was scrolled first" is
    // checked against whichever one actually carries the overflow.
    const surf = document.getElementById("scale-sheet").firstElementChild;
    const scrolled = [surf, ...surf.querySelectorAll("*")]
      .filter(el => el.scrollTop > 0).map(el => (el.id || el.className) + ":" + el.scrollTop);
    const next = document.getElementById("scale-next");
    const gen = next.hidden ? document.getElementById("scale-generate") : next;
    const r = gen.getBoundingClientRect();
    const hit = document.elementFromPoint(
      Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    return {
      scrolled, lipped: document.getElementById("scale-sheet").classList.contains("lipped"),
      top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height,
      vw: window.innerWidth, vh: window.innerHeight,
      label: (gen.textContent || "").trim(),
      hitsSelf: hit === gen,
      hit: hit ? (hit.id || hit.className || hit.tagName) : null,
      slots: document.querySelectorAll("#scale-preview svg text").length,
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
        const lowest = Math.max(...[...el.querySelectorAll("*")]
          .map((c) => c.getBoundingClientRect()).filter((q) => q.height > 0).map((q) => q.bottom));
        return {
          clientH: el.clientHeight,
          overhang: lowest - el.getBoundingClientRect().bottom,
        };
      })(),
    };
  `);

  function assertPrimaryVisible(m, where) {
    assert.strictEqual(m.lipped, false, `${where}: the footer is lipped at open`);
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

  const THREE_ROW_SCALE = "(C3) D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6 D6 E6 F6 G6 A6 B6 C7 D7 E7 F7 G7 A7 B7 C8 D8 E8 F8";

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

  const settleBox = () => b.waitFor(
    `document.getElementById("scale-box").getBoundingClientRect().bottom <= window.innerHeight + 0.5`,
    { label: "the focused box to be revealed" }).catch(() => {});

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
    assert.ok(m.portH >= m.h + 100,
      `${where}: the sheet's scroller is only ${m.portH.toFixed(1)}px tall, under the ${(m.h + 100).toFixed(1)}px `
      + "that leaves the box 100px of its neighbours - pinned rows are starving it");
  }

  /* The owner's device: iPhone 14 / iOS 26.6, 390 CSS px wide, ~745 px of
   * layout viewport under Safari's chrome. The sweep is the range of iOS
   * portrait keyboards over that layout: 336 px is the plain QWERTY plus the
   * form accessory bar, 395 px is the tallest (a candidate bar above it, as
   * the CJK keyboards draw). Every point in that range is a keyboard the
   * owner can raise, so the seed box has to survive all of them, not just the
   * friendliest. vvHeight = 745 - keyboard. */
  const KEYBOARDS = [336, 365, 395];

  /* ---------------------------------------------------------------- *
   * Sheet guidance (docs/plans/2026-10-13-sheet-guidance.md, lane app)
   *
   * #scale-guidance sits between .sheetbody and the primary and holds
   * #scale-msg then #scale-layout-state, so the notice and every page-state
   * message stay on screen with SAVE CHANGES whatever the scroll, viewport or
   * keyboard. Strings are never asserted here (the dr1Notice and S_NOTICE
   * tests own them); these read GEOMETRY. Line counts are MEASURED, not
   * assumed from a string length: CI serves fallback fonts, where a string
   * wraps differently, and the line height (12px x 1.5 = 18px) is the only
   * figure that does not move.
   * ---------------------------------------------------------------- */
  const SG_LINE = 18;

  const sgPut = ({ warn = null, note = null, field = null, pan = true }) => b.eval(`
    fieldMsg.textContent = ${JSON.stringify(field || "")};
    say(${JSON.stringify(warn || "")}, ${warn ? '"warn"' : '""'});
    layoutNote.textContent = ${JSON.stringify(note || "")};
    layoutNote.hidden = ${note ? "false" : "true"};
    sheet.classList.toggle("noticed", ${note ? "true" : "false"});
    ${warn && pan ? 'msgLine.classList.add("pan");' : ""}
    return true;`);

  const sgFit = (which, n) => b.eval(`
    const el = ${which === "msg" ? "msgLine" : which === "field" ? "fieldMsg" : "layoutNote"};
    const w = "Keep every note you can reach on the pan before you press the button below".split(" ");
    const wasHidden = el.hidden; el.hidden = false;
    let t = "";
    for (let i = 0; i < 120; i += 1) {
      t += (i ? " " : "") + w[i % w.length];
      el.textContent = t;
      if (el.getBoundingClientRect().height >= ${n * SG_LINE} - 0.5) break;
    }
    el.textContent = ""; el.hidden = wasHidden;
    return t;`);

  const sgGeometry = () => b.eval(`
    const surf = document.querySelector(".sheetsurf");
    const body = surf.querySelector(".sheetbody");
    const slot = document.getElementById("scale-guidance");
    const gen = document.getElementById("scale-generate");
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;width:var(--sp-2)";
    document.body.append(probe);
    const sp2 = probe.getBoundingClientRect().width; probe.remove();
    const bb = body.getBoundingClientRect(), sr = slot.getBoundingClientRect(), gr = gen.getBoundingClientRect();
    const h = (el) => el.hidden || !el.textContent ? 0 : el.getBoundingClientRect().height;
    return { port: body.clientHeight, slotH: sr.height, gapTop: sr.top - bb.bottom, gapBottom: gr.top - sr.bottom,
      rowGap: parseFloat(getComputedStyle(surf).rowGap) || 0, bodyToGen: gr.top - bb.bottom,
      sp2, msgH: h(document.getElementById("scale-msg")) + h(document.getElementById("scale-field-msg")), noteH: h(document.getElementById("scale-layout-state")),
      genTop: gr.top };`);

  const sgEditBig = async () => {
    await freshLoad();
    await b.setViewport(380, 800, true);
    await generate(BIG_SCALE);
  };

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
  /* Queue row 88. hideSheet() cleared the translate and left the cap behind,
   * so a sheet closed while the keyboard was still up kept maxHeight pinned to
   * whatever was left of the visual viewport. Nothing renders in that window -
   * the sheet is hidden, and the next showSheet() runs applyKbOffset() before
   * a frame goes out - so this is not a visible bug today. It is a latent one:
   * the cap is the only style the teardown does not undo, and every future
   * caller of hideSheet() inherits that asymmetry. Measured here rather than
   * argued: the assertion reads the style off the hidden surface with no
   * resize in between, which is exactly the state hideSheet() leaves. */
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
  /* ---------------------------------------------------------------- *
   * Lane KB (Subplan KB): the sheet's layout is decided by the visible
   * area only, under the four ways iOS reports a keyboard, and the ADJUST
   * LAYOUT toggle keeps its place. Models: A innerHeight fixed, B
   * innerHeight == vv.height, C innerHeight == vv.height + 57, D the layout
   * viewport itself resizes.
   * ---------------------------------------------------------------- */
  const KB_MODELS = [["A", "fixed"], ["B", "vv"], ["C", 57], ["D", "layout"]];
  const KB_FIELDS = ["scale-ding", "scale-top", "scale-inner", "scale-bottom"];
  const kbSettle = () => new Promise((r) => setTimeout(r, 120));
  const kbFillAdd = () => b.eval(`
    const v = { ding: "D3", top: "A Bb C D E F G A", inner: "C Eb" };
    for (const k in v) { const el = document.getElementById("scale-" + k); el.value = v[k]; el.dispatchEvent(new Event("input", { bubbles: true })); }
    document.activeElement.blur();
    return true;`);
  const kbOpenAdd = async (w, h) => {
    await freshLoad();
    await b.setViewport(w, h, true);
    await openSheet();
    await kbFillAdd();
  };
  const kbState = (id) => b.eval(`
    const s = document.getElementById("scale-sheet");
    const surf = s.querySelector(".sheetsurf"), body = s.querySelector(".sheetbody");
    const r = (e) => { const q = e.getBoundingClientRect(); return { top: q.top, bottom: q.bottom }; };
    const vv = window.visualViewport;
    return {
      classes: ["kbup", "short", "side", "tiny"].filter((c) => s.classList.contains(c)),
      head: getComputedStyle(s.querySelector(".sheethead")).display,
      vvh: vv.height, off: vv.offsetTop,
      field: r(document.getElementById(${JSON.stringify(id)})),
      pan: r(document.getElementById("scale-preview")),
      body: r(body), surf: r(surf),
      gen: r(document.getElementById("scale-generate")), lip: r(document.getElementById("scale-lip")), msg: r(document.getElementById("scale-guidance")),
    };`);
  const kbFocus = (id) => b.eval(`document.getElementById(${JSON.stringify(id)}).focus(); return true;`);

  /* ---------------------------------------------------------------- *
   * Lane KB2: the landscape keyboard-up sheet scrolls by touch anywhere
   * across the screen, and moving focus between the note fields moves
   * nothing that is already whole in view. iOS's own focus scroll is
   * emulated by a document focusin listener that nudges .sheetbody a
   * moment later, even when the field was visible.
   * ---------------------------------------------------------------- */
  const kb2Touch = async (type, pts, t) => b.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y]) => ({ x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 })), timestamp: t });
  const kb2Swipe = async (x, y0, dy) => {
    const t0 = Date.now() / 1000;
    await kb2Touch("touchStart", [[x, y0]], t0);
    for (let i = 1; i <= 8; i++) await kb2Touch("touchMove", [[x, y0 + (dy * i) / 8]], t0 + i * 0.016);
    await kb2Touch("touchEnd", [], t0 + 0.15);
    await new Promise((r) => setTimeout(r, 250));
  };
  const kb2Tap = async (id, fromTop) => {
    const p = await b.eval(`const r = document.getElementById(${JSON.stringify(id)}).getBoundingClientRect(); return { x: r.left + r.width / 2, y: ${fromTop ? "r.top + 14" : "r.top + r.height / 2"} };`);
    const t0 = Date.now() / 1000;
    await kb2Touch("touchStart", [[p.x, p.y]], t0);
    await kb2Touch("touchEnd", [], t0 + 0.05);
    await waitElapsed(PIN_MS + 50, "the tap's focus pin (PIN_MS) to lapse");
  };
  const kb2Scene = () => b.eval(`
    const q = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
    const o = { fields: {} };
    for (const id of ${JSON.stringify(KB_FIELDS)}) o.fields[id] = q(document.getElementById(id));
    const body = document.querySelector("#scale-sheet .sheetbody");
    o.body = q(body); o.padB = parseFloat(getComputedStyle(body).scrollPaddingBottom) || 0; o.bodyTop = body.scrollTop; o.vvh = window.visualViewport.height;
    o.surfTop = document.querySelector("#scale-sheet .sheetsurf").scrollTop;
    o.gen = q(document.getElementById("scale-lip"));
    return o;`);
  const kb2Watch = () => b.eval(`
    window.__kb2Scrolls = 0;
    document.addEventListener("scroll", () => { window.__kb2Scrolls += 1; }, true);
    return true;`);
  const kb2IosNative = () => b.eval(`
    document.addEventListener("focusin", () => {
      setTimeout(() => { const body = document.querySelector("#scale-sheet .sheetbody"); body.scrollTop += 37; }, 30);
    }, true);
    return true;`);
  const kb2Whole = (r, s) => r.top >= s.body.top - 1 && r.bottom <= s.body.bottom - s.padB + 1 && r.top >= -1 && r.bottom <= s.vvh + 1;

  const kb2Still = async () => {
    let last = await b.eval(`return document.querySelector("#scale-sheet .sheetbody").scrollTop + "/" + document.querySelector("#scale-sheet .sheetsurf").scrollTop;`);
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 150));
      const now = await b.eval(`return document.querySelector("#scale-sheet .sheetbody").scrollTop + "/" + document.querySelector("#scale-sheet .sheetsurf").scrollTop;`);
      if (now === last) return;
      last = now;
    }
  };
  const kb2Reach = async (id) => {
    for (let i = 0; i < 10; i++) {
      const s = await kb2Scene();
      const r = s.fields[id];
      const limit = s.body.bottom - s.padB;
      const dy = r.top < s.body.top + 4 ? 30 : r.bottom > limit - 4 ? -30 : 0;
      if (!dy) return s;
      await kb2Swipe(40, Math.round((s.body.top + s.body.bottom) / 2), dy);
      await kb2Still();
      await new Promise((res) => setTimeout(res, 1200));
      const t = await kb2Scene();
      if (t.bodyTop === s.bodyTop) return t;
    }
    return kb2Scene();
  };
  const KB2_VIEWPORTS = [[393, 659, 361]];
  const kb2Setup = async (w, h, vv, ios) => {
    await kbOpenAdd(w, h);
    await kb2Tap("scale-ding");
    await b.fakeKeyboard(vv);
    await kbSettle();
    await kb2Watch();
    if (ios) await kb2IosNative();
  };

  /* ---- KB2b: the tap pin lets go of a drag, a close, and keeps the tiny column ---- */
  const kb2bSurf = () => b.eval(`
    const surf = document.querySelector("#scale-sheet .sheetsurf");
    const o = { surf: surf.scrollTop, vvh: window.visualViewport.height, fields: {} };
    for (const id of ${JSON.stringify(KB_FIELDS)}) { const r = document.getElementById(id).getBoundingClientRect(); o.fields[id] = { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }
    return o;`);
  const kb2bWhole = (r, vvh) => r.top >= 1 && r.bottom <= vvh - 1;
  const kb2bReveal = async (pred) => {
    for (let i = 0; i < 8; i++) {
      const s = await kb2bSurf();
      if (pred(s)) return s;
      await kb2Swipe(40, Math.round(s.vvh * 0.8), -30);
      await kb2Still();
    }
    return kb2bSurf();
  };
  const kb2bTinyOpen = async (w, h, vv) => {
    await kbOpenAdd(w, h);
    await kb2Tap("scale-ding");
    await b.fakeKeyboard(vv);
    await kbSettle();
    const cls = await b.eval(`return [...document.getElementById("scale-sheet").classList];`);
    assert.ok(cls.includes("tiny"), `${w}x${h} vv ${vv}: not tiny (${cls})`);
  };

  /* ---- F4: ADJUST LAYOUT keeps its place and the pan stays tappable ---- */
  const F4_VIEWPORTS = [[390, 669], [390, 745], [380, 780], [320, 568]];
  const f4OpenEdit = async (w, h, slug) => {
    await freshLoad();
    await b.setViewport(w, h, true);
    const route = { kurd: "d-kurd-10", pygmy: "f-low-pygmy-18" }[slug];
    if (slug !== "kurd") {
      await b.eval(`location.hash = "#deck=${route}"; return true;`);
      await kbSettle();
    }
    assert.strictEqual(await b.eval(`return location.hash;`), "#deck=" + route, `the ${slug} deck is not the one shown`);
    await openEdit();
    await b.eval(`document.activeElement && document.activeElement.blur(); return true;`);
  };
    const f4Geom = () => b.eval(`
    const port = document.querySelector("#scale-sheet .sheetbody"), pr = port.getBoundingClientRect();
    const r = (id) => { const q = document.getElementById(id).getBoundingClientRect(); return { top: q.top, bottom: q.bottom, width: q.width }; };
    const st = document.getElementById("scale-drawer-status");
    const band = r("scale-plate-band");
    if (!st.hidden) band.bottom = Math.max(band.bottom, st.getBoundingClientRect().bottom);
    return { scrollTop: port.scrollTop, portTop: pr.top, portBottom: pr.bottom, band,
      plate: r("scale-preview"), btn: r("scale-tab-layout"), drawer: r("scale-drawer"),
      bandPos: getComputedStyle(document.getElementById("scale-plate-band")).position };`);
  const f4OpenDrawer = async () => {
    await b.click("#scale-tab-layout");
    await b.waitFor(`!document.getElementById("scale-panel-layout").hidden`, { label: "the Layout tab to open" });
    await new Promise((r) => setTimeout(r, 250));
  };

  /* The footer's hairline. It used to hang off `.sheetsurf > .ctlrow`, a
   * DIRECT-CHILD selector: when the mirror/palette row moved into .sheetbody
   * the rule stopped matching anything at all and the divider vanished with
   * it, silently, because no test read it - line 510 was the only border-top
   * in the file. The rule now belongs to the scrollport's own bottom edge,
   * which is the boundary it was always describing, so it cannot be undone by
   * moving a child across it again. */
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
  // Regression guard for the same row: the two closes that were measured
  // CORRECT must stay correct. They do not re-select, so nothing rebuilds the
  // strip and focus belongs on the control that opened the page. (The backdrop
  // tap of the drawer era is BACK now - same close path, same focus return.)
  // Row 217. The `.on` class is a colour, and colour is not state.
  // Row 219. REASONED, not measured: Chromium cannot tell us what VoiceOver
  // announces. What IS checkable is that only one face is exposed at a time
  // and that the counter is a live region.
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

    const TABLE = [15, 14, 11];   // #0f0e0b
    const TABLE2 = [15, 14, 11];  // #0f0e0b
    const FRAME = 4;              // outer pixel frame width to sample
    const PAPER = [246, 244, 237]; // #F6F4ED: the field-guide sheet ground (never white)

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
    async function edgeCheck(tol, alt, altTol) {
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
            const table2 = ${JSON.stringify(alt || TABLE2)};
            const tol2 = ${altTol === undefined ? tol : altTol};
            const dist = (r, g, bch, t) =>
              Math.sqrt((r - t[0]) ** 2 + (g - t[1]) ** 2 + (bch - t[2]) ** 2);
            let bad = null;
            const check = (x, y) => {
              if (bad || x < 0 || y < 0 || x >= w || y >= h) return;
              const i = (y * w + x) * 4;
              const r = data[i], g = data[i + 1], bch = data[i + 2];
              if (dist(r, g, bch, table) > ${tol} && dist(r, g, bch, table2) > tol2) {
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

    // Simulates an unpainted body gradient (a real frame before the image has
    // painted, or mid-resize). This is the one row that MUST fail at
    // 879499d, because that base has no colour under the gradient - only
    // A3's html{background-color:var(--table)} rescues it. This is what
    // kills ab_root_bg_dropped.
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
      assert.strictEqual(bg, "rgb(15, 14, 11)");
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
      "1280x800": { width: 367.984375, height: 508.1875, left: 456, right: 823.984375, top: 163.0625, bottom: 671.25 },
      "1024x768": { width: 353.265625, height: 487.859375, left: 335.359375, right: 688.625, top: 157.21875, bottom: 645.078125 },
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
          const practiceHeading = headings.find(h => h.textContent.trim() === "Flash cards");
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

    test("the sidebar's DOWNLOAD PDF button produces a PDF blob", async () => {
      await freshLoad();
      try {
        await b.setViewport(1280, 800, false);
        await b.settle();
        for (const label of ["DOWNLOAD PDF"]) {
          const cap = await b.eval(`
            return (async () => {
              const real = URL.createObjectURL;
              const seen = [];
              URL.createObjectURL = function (blob) { seen.push(blob); return real.call(URL, blob); };
              togglePrintMenu();
              const btn = document.getElementById("print-pdf-all");
              if (!btn) return { err: "no ALL item in the sidebar's " + ${JSON.stringify(label)} + " menu" };
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

    // Reviewer finding F1: the header only widens to min(92vw,900px) (line
    // ~164); at 1024-1280px that right edge sits UNDER the 240px sidebar, so
    // a deck strip with enough chips to actually reach that edge (built-ins
    // alone never do) gets its last chips hidden under the sidebar instead of
    // scrolled into view.
    // Reviewer finding F2: addChip.onclick always passes settingsTrigger as
    // the opener; the trigger is display:none on desktop, so hideSheet()'s
    // sheetOpener.focus() silently fails and focus is stranded on <body>.
    // Reviewer finding F3: the sidebar (z-index 41, the same value the below-
    // breakpoint modal panel uses) draws OVER the full-screen #scale-sheet
    // (z-index 30) when the sheet is open on desktop.
    // Reviewer finding N3: the document keydown handler's final ArrowRight/
    // ArrowLeft branch only checks sheetOpen/panelOpen, and the desktop
    // sidebar never sets panelOpen=true (it is never "opened"), so a native
    // <select> inside it gets its own arrow-key behaviour DOUBLED by the
    // global card-step shortcut.
    // Reviewer finding Q18 (round-2, 2026-09-29): the guard above used to
    // return early for ANY target inside #settings-panel, not just form
    // controls, so at desktop, after a mouse click on a plain sidebar
    // button (#modeB), the *next* ArrowRight was silently swallowed even
    // though a <button> has no native arrow-key behaviour to protect
    // against doubling.
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
      // Nit 2 (bounce 5): document.fonts.ready resolves once the browser's
      // font-matching settles, even if every @font-face it tried to match
      // failed to load and it fell back to a system font silently - a broken
      // Fetch-domain interception in launch({ realFonts: true }) would pass
      // this `before` hook and then every test below would quietly measure
      // FALLBACK metrics while believing it was testing real fonts, which is
      // exactly the gap reviewer FAIL #4 exploited (a fallback-font pass does
      // not establish a real-font pass; see probe4.js in the bounce-5
      // investigation). Assert the three families this app ships
      // (Marcellus, Bitter, Nunito Sans) actually matched, so an interception
      // break fails loudly here instead of silently degrading every test in
      // this describe block.
      // ER-1 (D2 re-plan): document.fonts.check(spec) returns TRUE when no
      // @font-face is registered at all (document.fonts.size 0, every load()
      // resolving to an empty list), so the check() assertion that stood here
      // could not fail in the one situation it exists to catch - a broken
      // interception that leaves every family on its fallback. Assert the
      // registry instead: five faces, every one loaded, and the families and
      // weights are exactly the five files in tools/fonts. checkFontMode is the
      // same function the panel-fit oracle runs, so the two cannot disagree.
      const fonts = await rb.eval(`
        const specs = ["14px Marcellus", "400 14px Bitter", "700 14px Bitter",
          "400 14px 'Nunito Sans'", "600 14px 'Nunito Sans'"];
        return Promise.all(specs.map(s => document.fonts.load(s))).then(() => ({
          size: document.fonts.size,
          faces: [...document.fonts].map(f => ({ family: f.family, weight: f.weight, status: f.status })),
        }));
      `);
      require("../tools/probe/panel_fit.js").checkFontMode("real", fonts);
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
      await rb.click(`#${modeBtn(mode)}`);
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
        const resIds = ${RES_IDS_JS};
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
        assert.ok(m.resVisible, "320x568 mode S (real fonts): the Resources links are not all rendered");
      });

    // Bounce 5 (reviewer FAIL #4): adding the Difficulty panel-group shifted
    // the landscape grid's auto-fit column packing, stranding a 114px+ tall
    // group alone in the leftover row at several widths and forcing an extra
    // row entirely at 568px wide - a regression invisible to every landscape
    // test above (844x390, 926x428, 667x375, 1280x500 all sit above this
    // band). The reviewer's full sweep (6,471 cells/font) found 110
    // regressions real-font / 129 fallback, all inside this band; these are
    // the band edges, in real fonts, where it bit hardest. Confirmed RED at
    // b3fdcf9 (pre-fix) and GREEN after the order/tierbar-wrap/row-gap/
    // panel-seq-note fixes in index.html's base max-height:520px block.
    //
    // D2 re-plan step 3 (R-1): the "Bounce 5 follow-up" trims that used to
    // follow here - four max-height:356px blocks, one of which unrendered
    // #panel-seq-note - are deleted, because CSS never unrenders a panel
    // control (T-R1). The cells at 300-306px that only those trims reached
    // are no longer asserted here; the `panel fit` oracle (tools/probe/
    // panel_fit.js) reports that band until step 6 reworks the landscape
    // layout. What remains are the band edges the base block still holds.
    test("the landscape panel has no vertical scroll and no offscreen control at the bounce-5 band edges (REAL fonts)",
      async () => {
        // D2 step 6b (H-9): the second heading costs H + g (18 + 3 here, real
        // fonts), so 740x340 S and 568x312 A now scroll. Each case carries main's
        // needed height as a literal (origin/main, same measuring function); a
        // case whose main-needed + H + g exceeds the panel by more than the 1px
        // tolerance must scroll by exactly that much (two-sided, within 1px)
        // with every control still reachable by scrolling; the others keep the
        // original assertion (no scroll, nothing offscreen).
        const cases = [
          // Lane PM (2026-10-08): HANDPAN 101 (+47) and the one-line print row
          // (-50 where the print group was the tall column): 328.25 -> 375.25,
          // 310 -> 357, 251.75 unchanged, 313 -> 310.
          // Retain accepted Lane W single-row pins with compact HTC.
          [740, 360, "S", 0 /* LE: two columns, no scroll */], // 300-359px tall at 740px up: the LS grid, asserted by "LS:"
          [568, 312, "A", 310],
        ];
        for (const [w, h, mode, mainNeeded] of cases) {
          await rb.setViewport(w, h, true);
          await rb.goto(URL);
          await rb.eval(`localStorage.clear(); localStorage.setItem("hpfc", ${JSON.stringify(JSON.stringify({ mode }))});`);
          await rb.goto(URL);
          await rb.eval(`return document.fonts.ready.then(() => true);`);
          await rb.settle();
          await rb.click("#settings-trigger");
          await rb.waitFor(`getComputedStyle(document.getElementById("settings-panel")).display !== "none"`,
            { label: "panel open" });
          await rb.settle();
          const m = await rb.eval(`
            const p = document.getElementById("settings-panel");
            const ctrls = [...p.querySelectorAll("button, select, a")].filter(e => e.offsetParent);
            const hd = document.getElementById("panel-prog-heading");
            return {
              over: p.scrollHeight - p.clientHeight, clientH: p.clientHeight,
              hg: hd.getBoundingClientRect().height + parseFloat(getComputedStyle(hd).marginTop),
              reach: ctrls.filter(e => e.getBoundingClientRect().bottom - (p.getBoundingClientRect().top - p.scrollTop) > p.scrollHeight + 0.5).map(e => e.id),
              off: ctrls.filter(e => {
                const k = e.getBoundingClientRect();
                return k.left < -0.5 || k.top < -0.5 || k.right > innerWidth + 0.5 || k.bottom > innerHeight + 0.5;
              }).map(e => e.id || e.textContent.trim()),
            };
          `);
          const label = `${w}x${h} mode ${mode} (real fonts)`;
          if (m.over > 1) {
            assert.deepStrictEqual(m.reach, [], `${label}: a control lies beyond the scrollable height`);
            {
              assert.deepStrictEqual(m.off.filter((id) => !id.startsWith("res-") && id !== "about-open" && id !== "lang-select"), [],
                `${label}: only the Resources links, ABOUT and Language may be below the fold once the cell scrolls`);
            }
          } else {
            assert.deepStrictEqual(m.off, [], `${label}: controls offscreen: ${JSON.stringify(m.off)}`);
          }
        }
      });

    // LS: the LE two-column menu reaches short iPhone landscape (300px up).
    test("LS: with RESET SEEDED SCALES showing, the short-landscape menu scrolls vertically, never spills into a third column, stays two columns and leaves #lang-select tappable (REAL fonts)",
      { timeout: 300000 }, async () => {
        try {
          for (const mode of ["A", "B", "S"]) {
            await rb.setViewport(852, 330, true);
            await rb.goto(URL);
            await rb.eval(`localStorage.setItem("hpfc", ${JSON.stringify(JSON.stringify({ mode, hidden: ["amara"] }))}); return true;`);
            await rb.send("Storage.clearDataForOrigin", { origin: new globalThis.URL(URL).origin, storageTypes: "indexeddb" });
            await rb.goto(URL);
            await rb.eval(`return document.fonts.ready.then(() => true);`);
            for (const [w, h] of [[852, 330], [844, 320], [740, 300], [1000, 300], [844, 340], [844, 350], [844, 359], [844, 360], [844, 365], [740, 360], [1000, 370], [844, 380], [844, 389], [844, 390], [932, 430], [844, 520]]) {
              await rb.setViewport(w, h, true);
              await rb.settle();
              await rb.click("#settings-trigger");
              await rb.waitFor(`getComputedStyle(document.getElementById("settings-panel")).display !== "none"`, { label: "panel open" });
              const label = `mode ${mode} ${w}x${h}`;
              const m = await rb.eval(`
                const p = document.getElementById("settings-panel");
                const r = document.getElementById("deck-restore");
                const s = document.getElementById("lang-select");
                s.scrollIntoView({ block: "center" });
                const k = s.getBoundingClientRect();
                const top = document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2);
                return { restore: !r.hidden, ncols: new Set([...p.querySelectorAll(".panel-group")].filter(g => g.getBoundingClientRect().width > 8).map(g => Math.round(g.getBoundingClientRect().left))).size, scrollW: p.scrollWidth, clientW: p.clientWidth, hitSelect: top === s };`);
              assert.ok(m.restore, `${label}: RESET SEEDED SCALES is showing`);
              assert.ok(m.scrollW <= m.clientW + 1, `${label}: overflows horizontally (${m.scrollW} > ${m.clientW})`);
              assert.strictEqual(m.ncols, 2, `${label}: the groups sit in ${m.ncols} columns`);
              assert.ok(m.hitSelect, `${label}: #lang-select is not what a tap at its centre reaches`);
              await rb.key("Escape", "Escape", 27);
              await rb.waitFor(`document.getElementById("settings-panel").hidden === true`, { label: `close at ${label}` });
            }
          }
        } finally {
          await rb.setViewport(900, 900, false);
          await rb.goto(URL);
        }
      });

    test("LS: with the backup panel open (RESET hidden) the short-landscape menu scrolls vertically and never spills sideways, in en and de (REAL fonts)",
      { timeout: 300000 }, async () => {
        try {
          await rb.setViewport(852, 330, true);
          await rb.goto(URL);
          await rb.eval(`localStorage.setItem("hpfc", ${JSON.stringify(JSON.stringify({ mode: "A" }))}); return true;`);
          await rb.send("Storage.clearDataForOrigin", { origin: new globalThis.URL(URL).origin, storageTypes: "indexeddb" });
          await rb.goto(URL);
          await rb.eval(`return document.fonts.ready.then(() => true);`);
          for (const lang of ["en", "de"]) {
            for (const [w, h] of [[740, 300], [800, 340], [740, 360], [844, 390], [932, 430], [1000, 480], [1024, 520]]) {
              await rb.setViewport(w, h, true);
              await rb.settle();
              await rb.click("#settings-trigger");
              await rb.waitFor(`getComputedStyle(document.getElementById("settings-panel")).display !== "none"`, { label: "panel open" });
              await rb.eval(`const e=document.getElementById("lang-select");e.value=${JSON.stringify(lang)};e.dispatchEvent(new Event("change",{bubbles:true}));return true;`);
              await rb.waitFor(`document.documentElement.lang === ${JSON.stringify(lang)}`, { label: "locale applied" });
              if (await rb.eval(`return document.getElementById("backup-panel").hidden;`)) await rb.click("#backup-open");
              await rb.waitFor(`!document.getElementById("backup-panel").hidden`, { label: "backup panel open" });
              await rb.settle();
              const label = `${lang} ${w}x${h}`;
              const m = await rb.eval(`
                const p = document.getElementById("settings-panel");
                const s = document.getElementById("lang-select");
                s.scrollIntoView({ block: "center" });
                const k = s.getBoundingClientRect();
                const top = document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2);
                return { restore: !document.getElementById("deck-restore").hidden, scrollW: p.scrollWidth, clientW: p.clientWidth, hitSelect: top === s };`);
              assert.strictEqual(m.restore, false, `${label}: RESET SEEDED SCALES is hidden`);
              assert.ok(m.scrollW <= m.clientW + 1, `${label}: overflows horizontally (${m.scrollW} > ${m.clientW})`);
              assert.ok(m.hitSelect, `${label}: #lang-select is not reachable by a tap at its centre`);
              await rb.key("Escape", "Escape", 27);
              await rb.waitFor(`document.getElementById("settings-panel").hidden === true`, { label: `close at ${label}` });
            }
          }
        } finally {
          await rb.setViewport(900, 900, false);
          await rb.goto(URL);
        }
      });

    test("LS2: with the backup panel open its controls are panel Tab stops right after BACKUP YOUR SCALES, in the grid and DOM orders (REAL fonts)",
      { timeout: 120000 }, async () => {
        try {
          await rb.setViewport(844, 390, true);
          await rb.goto(URL);
          await rb.eval(`localStorage.setItem("hpfc", ${JSON.stringify(JSON.stringify({ mode: "A" }))}); return true;`);
          await rb.send("Storage.clearDataForOrigin", { origin: new globalThis.URL(URL).origin, storageTypes: "indexeddb" });
          await rb.goto(URL);
          await rb.eval(`return document.fonts.ready.then(() => true);`);
          for (const [w, h] of [[844, 390], [380, 780]]) {
            await rb.setViewport(w, h, true);
            await rb.settle();
            await rb.click("#settings-trigger");
            await rb.waitFor(`getComputedStyle(document.getElementById("settings-panel")).display !== "none"`, { label: "panel open" });
            if (await rb.eval(`return document.getElementById("backup-panel").hidden;`)) await rb.click("#backup-open");
            await rb.waitFor(`!document.getElementById("backup-panel").hidden`, { label: "backup panel open" });
            await rb.eval(`for (const id of ["backup-share", "backup-copy", "backup-download"]) document.getElementById(id).disabled = false; return true;`);
            const m = await rb.eval(`
              const ids = window.panelStops().map(e => e.id);
              const want = ["backup-open", ...[...document.getElementById("backup-panel").querySelectorAll("textarea, button")]
                .filter(e => !e.disabled && e.getClientRects().length > 0).map(e => e.id)];
              return { ids, want };`);
            const at = m.ids.indexOf("backup-open");
            assert.ok(at >= 0, `${w}x${h}: backup-open is a stop: ${JSON.stringify(m.ids)}`);
            assert.ok(m.want.includes("backup-text") && m.want.includes("backup-copy") && m.want.includes("backup-download"), `${w}x${h}: the backup controls render`);
            assert.deepStrictEqual(m.ids.slice(at, at + m.want.length), m.want, `${w}x${h}: ${JSON.stringify(m.ids)}`);
            await rb.key("Escape", "Escape", 27);
            await rb.waitFor(`document.getElementById("settings-panel").hidden === true`, { label: `close at ${w}x${h}` });
          }
        } finally {
          await rb.setViewport(900, 900, false);
          await rb.goto(URL);
        }
      });

    test("LS2: with the progression note and RESET SEEDED SCALES showing, the columns balance: Flash cards, Print, Scales left and Resources, Language right, each stacked flush, at 844x390 and 800x340 (REAL fonts)",
      { timeout: 120000 }, async () => {
        try {
          await rb.setViewport(844, 390, true);
          await rb.goto(URL);
          await rb.eval(`localStorage.setItem("hpfc", ${JSON.stringify(JSON.stringify({ mode: "S", hidden: ["amara"] }))}); return true;`);
          await rb.send("Storage.clearDataForOrigin", { origin: new globalThis.URL(URL).origin, storageTypes: "indexeddb" });
          await rb.goto(URL);
          await rb.eval(`return document.fonts.ready.then(() => true);`);
          for (const [w, h] of [[844, 390], [800, 340]]) {
            await rb.setViewport(w, h, true);
            await rb.settle();
            await rb.click("#settings-trigger");
            await rb.waitFor(`getComputedStyle(document.getElementById("settings-panel")).display !== "none"`, { label: "panel open" });
            const label = `${w}x${h}`;
            if (await rb.eval(`return document.getElementById("panel-seq-note").hidden;`)) {
              await rb.click("#tier-basic");
              await rb.waitFor(`!document.getElementById("panel-seq-note").hidden`, { label: "progression note" });
            }
            const m = await rb.eval(`
              const byHeading = t => [...document.querySelectorAll("#settings-panel .panel-group")].find(c => c.querySelector(".panel-heading").textContent === t);
              const names = [["Flash cards", "L"], ["Print this scale", "L"], ["Scales", "L"], ["Resources", "R"], ["Language", "R"]];
              const rects = names.map(([t, side]) => { const el = byHeading(t); const r = el.getBoundingClientRect(); return { t, side, left: r.left, top: r.top, bottom: r.bottom, mb: parseFloat(getComputedStyle(el).marginBottom) }; });
              const p = document.getElementById("settings-panel");
              const col = document.querySelector("#settings-panel .panel-col");
              return { note: !document.getElementById("panel-seq-note").hidden, restore: !document.getElementById("deck-restore").hidden, rects,
                rowGapL: parseFloat(getComputedStyle(p).rowGap) || 0, rowGapR: parseFloat(getComputedStyle(col).rowGap) || 0,
                about: document.getElementById("about-open").getBoundingClientRect().bottom, resBottom: byHeading("Resources").getBoundingClientRect().bottom,
                scrolls: p.scrollHeight > p.clientHeight + 1, sh: p.scrollHeight, ch: p.clientHeight };
            `);
            assert.ok(m.note && m.restore, `${label}: note and RESET both showing`);
            const want = h >= 360 ? 20 : 9;
            assert.ok(Math.abs(m.rowGapR - m.rowGapL) <= 0.5 && m.rowGapL > 0, `${label}: the right column's row-gap ${m.rowGapR} equals the left column's ${m.rowGapL}`);
            const left = m.rects.filter(r => r.side === "L"), right = m.rects.filter(r => r.side === "R");
            assert.ok(left.every(r => Math.abs(r.left - left[0].left) <= 1) && right.every(r => Math.abs(r.left - right[0].left) <= 1) && right[0].left > left[0].left + 50, `${label}: two columns ${JSON.stringify(m.rects)}`);
            for (const [col, rg] of [[left, m.rowGapL], [right, m.rowGapR]]) {
              for (let i = 1; i < col.length; i++) {
                assert.ok(Math.abs(col[i].top - col[i - 1].bottom - want) <= 1, `${label}: ${col[i].t} is ${col[i].top - col[i - 1].bottom}px under ${col[i - 1].t}, want the ${want}px group gap`);
                assert.ok(Math.abs(col[i].top - col[i - 1].bottom - col[i - 1].mb - rg) <= 1, `${label}: ${col[i].t} is ${col[i].top - col[i - 1].bottom}px under ${col[i - 1].t}, margin ${col[i - 1].mb} row-gap ${rg}`);
              }
            }
            assert.ok(Math.abs(m.about - m.resBottom) <= 12, `${label}: ABOUT is the last Resources row`);
            await rb.key("Escape", "Escape", 27);
            await rb.waitFor(`document.getElementById("settings-panel").hidden === true`, { label: `close at ${label}` });
          }
        } finally {
          await rb.setViewport(900, 900, false);
          await rb.goto(URL);
        }
      });

    test("LS2: with the progression note alone (no RESET) at 800x340, the columns are flush with the 9px group gap (REAL fonts)",
      { timeout: 120000 }, async () => {
        try {
          await rb.setViewport(844, 390, true);
          await rb.goto(URL);
          await rb.eval(`localStorage.setItem("hpfc", ${JSON.stringify(JSON.stringify({ mode: "S" }))}); return true;`);
          await rb.send("Storage.clearDataForOrigin", { origin: new globalThis.URL(URL).origin, storageTypes: "indexeddb" });
          await rb.goto(URL);
          await rb.eval(`return document.fonts.ready.then(() => true);`);
          await rb.setViewport(800, 340, true);
          await rb.settle();
          await rb.click("#settings-trigger");
          await rb.waitFor(`getComputedStyle(document.getElementById("settings-panel")).display !== "none"`, { label: "panel open" });
          if (await rb.eval(`return document.getElementById("panel-seq-note").hidden;`)) {
            await rb.click("#tier-basic");
            await rb.waitFor(`!document.getElementById("panel-seq-note").hidden`, { label: "progression note" });
          }
          const m = await rb.eval(`
            const g = t => { const r = [...document.querySelectorAll("#settings-panel .panel-group")].find(c => c.querySelector(".panel-heading").textContent === t).getBoundingClientRect(); return { left: r.left, top: r.top, bottom: r.bottom }; };
            const p = document.getElementById("settings-panel");
            return { note: !document.getElementById("panel-seq-note").hidden, restore: !document.getElementById("deck-restore").hidden,
              f: g("Flash cards"), pr: g("Print this scale"), sc: g("Scales"), re: g("Resources"), la: g("Language"),
              scrolls: p.scrollHeight > p.clientHeight + 1, sh: p.scrollHeight, ch: p.clientHeight };`);
          assert.ok(m.note && !m.restore, "note alone");
          assert.ok(m.re.left > m.f.left + 50 && Math.abs(m.la.left - m.re.left) <= 1 && Math.abs(m.pr.left - m.f.left) <= 1, "two columns " + JSON.stringify(m));
          for (const [a, b] of [[m.f, m.pr], [m.pr, m.sc], [m.re, m.la]]) assert.ok(Math.abs(b.top - a.bottom - 9) <= 1, `gap ${b.top - a.bottom}, want 9`);
        } finally {
          await rb.setViewport(900, 900, false);
          await rb.goto(URL);
        }
      });

    test("LS2: in the default state at 800x340 and 740x359, Resources and Language keep the 6px margin and break-inside avoid, with 6px between them (REAL fonts)",
      { timeout: 120000 }, async () => {
        try {
          await rb.setViewport(844, 390, true);
          await rb.goto(URL);
          await rb.eval(`localStorage.setItem("hpfc", ${JSON.stringify(JSON.stringify({ mode: "A" }))}); return true;`);
          await rb.send("Storage.clearDataForOrigin", { origin: new globalThis.URL(URL).origin, storageTypes: "indexeddb" });
          await rb.goto(URL);
          await rb.eval(`return document.fonts.ready.then(() => true);`);
          for (const [w, h] of [[800, 340], [740, 359]]) {
            await rb.setViewport(w, h, true);
            await rb.settle();
            await rb.click("#settings-trigger");
            await rb.waitFor(`getComputedStyle(document.getElementById("settings-panel")).display !== "none"`, { label: "panel open" });
            const label = `${w}x${h}`;
            const m = await rb.eval(`
              const byHeading = t => [...document.querySelectorAll("#settings-panel .panel-group")].find(c => c.querySelector(".panel-heading").textContent === t);
              const res = byHeading("Resources"), lang = byHeading("Language");
              const cs = el => ({ mb: parseFloat(getComputedStyle(el).marginBottom), bi: getComputedStyle(el).breakInside });
              return { note: !document.getElementById("panel-seq-note").hidden, restore: !document.getElementById("deck-restore").hidden,
                res: cs(res), lang: cs(lang), cols: getComputedStyle(document.getElementById("settings-panel")).columnCount,
                gap: lang.getBoundingClientRect().top - res.getBoundingClientRect().bottom,
                sameCol: Math.abs(lang.getBoundingClientRect().left - res.getBoundingClientRect().left) <= 1 };`);
            assert.ok(!m.note && !m.restore, `${label}: the default state`);
            assert.strictEqual(m.cols, "2", `${label}: balanced columns`);
            for (const k of ["res", "lang"]) {
              assert.strictEqual(m[k].mb, 6, `${label}: ${k} margin-bottom ${m[k].mb}`);
              assert.strictEqual(m[k].bi, "avoid", `${label}: ${k} break-inside ${m[k].bi}`);
            }
            if (m.sameCol) assert.ok(Math.abs(m.gap - 6) <= 1, `${label}: Language is ${m.gap}px under Resources`);
            await rb.key("Escape", "Escape", 27);
            await rb.waitFor(`document.getElementById("settings-panel").hidden === true`, { label: `close at ${label}` });
          }
        } finally {
          await rb.setViewport(900, 900, false);
          await rb.goto(URL);
        }
      });
  });

  // Lane S2: "CHORD PROGRESSION" mode's app-side wiring. See
  // docs/plans/2026-09-29-chord-sequence-mode.md sections 3 (S2 row) and 8
  // (E1-E9). Only browser-only behaviour lives here - anything the sandbox
  // stub can check (see tests/app.test.js) stays there.
  describe("sequence mode", () => {

    test("selecting a tier presses it exclusively, shows the credit note, and survives a reload",
      async () => {
        await enterSeqMode();
        const st = await b.eval(`return {
          a: document.getElementById("modeA").getAttribute("aria-pressed"),
          b: document.getElementById("modeB").getAttribute("aria-pressed"),
          s: document.getElementById("tier-basic").getAttribute("aria-pressed"),
          noteHidden: document.getElementById("panel-seq-note").hidden,
        };`);
        assert.deepStrictEqual(st, { a: "false", b: "false", s: "true", noteHidden: false });
        const before = await stored();
        assert.strictEqual(before.mode, "S", "mode S was not saved under \"hpfc\"");
        await navigate();
        await b.waitFor(`document.getElementById("tier-basic").getAttribute("aria-pressed") === "true"`,
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

      for (const [baseMode, turnShuffleOn] of [["A", false], ["B", true]]) {
        await freshLoad();
        await openSettingsPanel();
        await b.click(`#${modeBtn(baseMode)}`);
        await b.waitFor(`document.getElementById("${modeBtn(baseMode)}").getAttribute("aria-pressed") === "true"`,
          { label: `mode ${baseMode} to take effect` });
        if (turnShuffleOn) {
          await b.click("#shuffle");
          await b.settle();
        }
        const before = await shuffleState();
        assert.strictEqual(before.on, turnShuffleOn, `mode ${baseMode} Shuffle .on before entering S`);

        await openSettingsPanel();
        await b.click("#tier-basic");
        await b.waitFor(`document.getElementById("tier-basic").getAttribute("aria-pressed") === "true"`,
          { label: "mode S to take effect" });
        const seqRail = await railText();
        assert.ok(seqRail, "entering S must draw a sequence and render the rail");
        const chordCount = seqRail.split(" → ").length;
        assert.ok(chordCount >= 2 && chordCount <= 4, `entering S must give an order of length 2, 3 or 4, got ${chordCount}`);

        // New progression in S must never touch `shuffled` - re-roll a few times.
        const seen = new Set([seqRail]);
        for (let i = 0; i < 4; i++) {
          await b.click("#shuffle");
          await b.settle();
          seen.add(await railText());
        }
        assert.ok(seen.size > 1, "New progression in S must redraw a different sequence at least once");

        await openSettingsPanel();
        await b.click(`#${modeBtn(baseMode)}`);
        await b.waitFor(`document.getElementById("${modeBtn(baseMode)}").getAttribute("aria-pressed") === "true"`,
          { label: `mode ${baseMode} to take effect again` });
        const after = await shuffleState();
        assert.deepStrictEqual(after, before,
          `mode ${baseMode} Shuffle state must be restored exactly after a round trip through S`);
      }
    });

    test("a persisted mode \"S\" boots straight into a sequence, not the empty-sequence message", async () => {
      await enterSeqMode();
      await navigate(); // reload
      await b.waitFor(`document.getElementById("tier-basic").getAttribute("aria-pressed") === "true"`,
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
        // Selecting a mode closes the panel (closePanel() in a tier button's own
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

        // Switch back to A: the note (and the link) hide. The three tier buttons
        // always remain stops, but the now-hidden link must never be
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
          await b.click(`#${modeBtn(mode)}`);
          await b.waitFor(`document.getElementById("${modeBtn(mode)}").getAttribute("aria-pressed") === "true"`,
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
          assert.ok(["tier-basic", "tier-intermediate", "tier-advanced"].every((id) => fwd.some((s) => s.id === id)),
            `the three tier buttons are always stops in mode ${mode}`);
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

    // D2 re-plan step 4 (owner's five-button design, §4.2a): five mutually
    // exclusive practice buttons. There is no #modeS and no disabled state.
    const FLASH_STOPS = ["settings-trigger", "modeA", "modeB", "tier-basic", "tier-intermediate",
      "tier-advanced", "deck-add", "backup-open", "print-download", "print-paper", ...RES_IDS,
      "about-open", "lang-select"];
    const PROG_STOPS = [...FLASH_STOPS.slice(0, 6), "seq-source-link", ...FLASH_STOPS.slice(6)];
    const MODAL_VIEWPORTS = [[320, 568, true], [768, 1024, true], [568, 320, true], [683, 330, true], [844, 390, true]];
    const pressedFive = () => b.eval(`return ["modeA", "modeB", "tier-basic", "tier-intermediate", "tier-advanced"]
      .map(id => { const el = document.getElementById(id);
        return [id, el.getAttribute("aria-pressed"), el.classList.contains("on"), el.disabled]; });`);
    const assertExactlyOne = (five, want, label) => {
      for (const [id, pressed, on, disabled] of five) {
        assert.strictEqual(pressed, id === want ? "true" : "false", `${label}: ${id} aria-pressed`);
        assert.strictEqual(on, id === want, `${label}: ${id} .on`);
        assert.strictEqual(disabled, false, `${label}: ${id} must never be disabled`);
      }
    };
    async function cycleIds() {
      await b.eval(`document.getElementById("settings-trigger").focus(); return true;`);
      const seen = await driveTabCycle(false, 20);
      const back = (await (async () => {
        await b.eval(`document.getElementById("settings-trigger").focus(); return true;`);
        return driveTabCycle(true, 20);
      })());
      return { fwd: seen.map((x) => x.id || ""), back: back.map((x) => x.id || "") };
    }

    test("Tab cycles exactly the sixteen flash-card stops in the modal at every viewport class", async () => {
      for (const [w, h, m] of MODAL_VIEWPORTS) {
        await freshLoad();
        await b.setViewport(w, h, m);
        await b.settle();
        for (const mode of ["A", "B"]) {
          await openSettingsPanel();
          await b.click(`#${modeBtn(mode)}`);
          await b.waitFor(`document.getElementById("${modeBtn(mode)}").getAttribute("aria-pressed") === "true"`,
            { label: `mode ${mode}` });
          await openSettingsPanel();
          const { fwd, back } = await cycleIds();
          assert.deepStrictEqual(fwd.slice(0, -1), FLASH_STOPS, `${w}x${h} ${mode}: forward Tab order`);
          assert.strictEqual(fwd[fwd.length - 1], "settings-trigger");
          assert.deepStrictEqual(back.slice(0, -1), [FLASH_STOPS[0], ...FLASH_STOPS.slice(1).reverse()],
            `${w}x${h} ${mode}: Shift+Tab is the exact reverse`);
          await b.eval(`document.getElementById("settings-scrim")?.click(); return true;`).catch(() => {});
          await b.waitFor(`document.getElementById("settings-panel").hidden === true`, { label: "panel closes" });
        }
      }
      await b.setViewport(900, 900, false);
    });

    test("Tab cycles exactly the seventeen progression stops in the modal at every viewport class", async () => {
      for (const [w, h, m] of MODAL_VIEWPORTS) {
        await freshLoad();
        await b.setViewport(w, h, m);
        await b.settle();
        await openSettingsPanel();
        await b.click("#tier-intermediate");
        await b.waitFor(`document.getElementById("tier-intermediate").getAttribute("aria-pressed") === "true"`,
          { label: "progression" });
        await openSettingsPanel();
        const { fwd, back } = await cycleIds();
        assert.deepStrictEqual(fwd.slice(0, -1), PROG_STOPS, `${w}x${h}: forward Tab order`);
        assert.deepStrictEqual(back.slice(0, -1), [PROG_STOPS[0], ...PROG_STOPS.slice(1).reverse()],
          `${w}x${h}: Shift+Tab is the exact reverse`);
        await b.eval(`document.getElementById("settings-scrim")?.click(); return true;`).catch(() => {});
        await b.waitFor(`document.getElementById("settings-panel").hidden === true`, { label: "panel closes" });
      }
      await b.setViewport(900, 900, false);
    });

    test("the sidebar's native Tab order is the panel's DOM order", async () => {
      try {
        for (const [w, h] of [[1024, 700], [1280, 800]]) {
          await freshLoad();
          await b.setViewport(w, h, false);
          await b.settle();
          for (const prog of [false, true]) {
            if (prog) { await b.click("#tier-advanced"); await b.settle(); }
            const ids = await b.eval(`return [...document.getElementById("settings-panel")
              .querySelectorAll("button, a[href], select")].filter(el => !el.disabled && el.getClientRects().length > 0)
              .map(el => el.id || "");`);
            assert.deepStrictEqual(ids, (prog ? PROG_STOPS : FLASH_STOPS).slice(1), `${w}x${h} prog=${prog}`);
            const panelStops = await b.eval(`return window.panelStops().map(e => e.id || "");`);
            assert.deepStrictEqual(panelStops, ids, `${w}x${h} prog=${prog}: panelStops agrees`);
          }
        }
      } finally { await b.setViewport(900, 900, false); }
    });

    test("a flash-card button unlights every tier and leaves the stored tier alone", async () => {
      await freshLoad();
      await openSettingsPanel();
      await b.click("#tier-advanced");
      await b.waitFor(`document.getElementById("tier-advanced").getAttribute("aria-pressed") === "true"`, { label: "advanced" });
      for (const m of ["A", "B"]) {
        await openSettingsPanel();
        await b.click(`#${modeBtn(m)}`);
        await b.waitFor(`document.getElementById("${modeBtn(m)}").getAttribute("aria-pressed") === "true"`, { label: `mode ${m}` });
        assertExactlyOne(await pressedFive(), `mode${m}`, `after ${m}`);
        assert.strictEqual((await stored()).tier, "advanced", "hpfc.tier must be unchanged by a flash-card press");
        assert.strictEqual((await stored()).mode, m);
        await b.waitFor(`document.getElementById("settings-panel").hidden === true`, { label: "panel closes" });
        assert.strictEqual(await b.eval(`return document.activeElement.id;`), "settings-trigger", "focus returns to the trigger");
      }
    });

    test("in the sidebar a button press re-states all five and keeps focus", async () => {
      try {
        for (const [w, h] of [[1024, 700], [1280, 800]]) {
          await freshLoad();
          await b.setViewport(w, h, false);
          await b.settle();
          for (const [id, want] of [["#tier-intermediate", "tier-intermediate"], ["#modeB", "modeB"], ["#tier-basic", "tier-basic"]]) {
            await b.click(id);
            await b.settle();
            assertExactlyOne(await pressedFive(), want, `${w}x${h} ${id}`);
            assert.strictEqual(await b.eval(`return document.activeElement.id;`), id.slice(1), "focus stays on the pressed button");
            assert.strictEqual(await b.eval(`return getComputedStyle(document.getElementById("settings-panel")).display !== "none";`), true);
          }
        }
      } finally { await b.setViewport(900, 900, false); }
    });

    test("tapping a tier from a flash-card mode enters progression at that tier in one tap and closes the panel", async () => {
      await freshLoad();
      for (const [m, t] of [["A", "intermediate"], ["B", "advanced"]]) {
        await openSettingsPanel();
        await b.click(`#${modeBtn(m)}`);
        await b.waitFor(`document.getElementById("${modeBtn(m)}").getAttribute("aria-pressed") === "true"`, { label: `mode ${m}` });
        await b.eval(`window.__picks = []; window.__origPick = HPE.sequence.pick; const o = window.__origPick;
          HPE.sequence.pick = (d, r, p, t) => { window.__picks.push([p, t]); return o(d, r, p, t); }; return true;`);
        await openSettingsPanel();
        await b.click(`#tier-${t}`);
        await b.waitFor(`document.getElementById("tier-${t}").getAttribute("aria-pressed") === "true"`, { label: t });
        const r = await b.eval(`return { picks: window.__picks, hidden: document.getElementById("settings-panel").hidden,
          note: document.getElementById("panel-seq-note").hidden, active: document.activeElement.id };`);
        assert.deepStrictEqual(r.picks, [[null, t]], "exactly one pick call, at the tapped tier, with prev cleared");
        assert.strictEqual(r.hidden, true);
        assert.strictEqual(r.note, false);
        assert.strictEqual(r.active, "settings-trigger");
        assertExactlyOne(await pressedFive(), `tier-${t}`, `tap ${t} from ${m}`);
        const st = await stored();
        assert.strictEqual(st.mode, "S");
        assert.strictEqual(st.tier, t);
        await b.eval(`HPE.sequence.pick = window.__origPick; delete window.__picks; return true;`);
      }
    });

    test("the practice group has a Flash cards heading and a Chord progression heading, in both states", async () => {
      for (const mode of ["A", "S"]) {
        await freshLoad();
        await b.eval(`localStorage.setItem("hpfc", ${JSON.stringify(JSON.stringify({ mode, tier: "basic" }))}); return true;`);
        await navigate();
        await openSettingsPanel();
        const r = await b.eval(`
          const panel = document.getElementById("settings-panel");
          const group = document.querySelector("#settings-panel > .panel-group");
          const all = [...panel.querySelectorAll("h3")];
          const inGroup = [...group.querySelectorAll(".panel-heading")];
          const pos = (el) => [...group.querySelectorAll("*")].indexOf(el);
          const second = document.getElementById("panel-prog-heading");
          return {
            h3Count: all.length, h3Texts: all.map((h) => h.textContent.trim()),
            groupHeadings: inGroup.map((h) => [h.tagName, h.className, h.textContent.trim()]),
            order: second ? [pos(inGroup[0]) < pos(document.getElementById("modeA")), pos(document.getElementById("modeB")) < pos(second), pos(second) < pos(document.getElementById("tier-basic"))] : null,
            secondRendered: !!second && second.getClientRects().length > 0,
            stops: [inGroup.map((h) => h.tabIndex)],
          };`);
        assert.deepStrictEqual(r.groupHeadings, [["H3", "panel-heading", "Flash cards"], ["H3", "panel-heading", "Chord progression"]], `mode ${mode}`);
        assert.deepStrictEqual(r.order, [true, true, true], `mode ${mode}: Flash cards before modeA, Chord progression between modeB and the tiers`);
        assert.strictEqual(r.secondRendered, true, `mode ${mode}: the second heading renders in both states`);
        assert.strictEqual(r.h3Count, 6, `mode ${mode}: six h3 in all`);
        assert.ok(!r.h3Texts.includes("Practice"), `mode ${mode}: no heading is named Practice`);
        assert.ok(r.stops[0].every((t) => t === -1), `mode ${mode}: a heading is a Tab stop`);
      }
    });

    describe("T-HEAD: the two headings in both font modes", () => {
      const fontsFor = {};
      before(async () => {
        const pf = require("../tools/probe/panel_fit.js");
        for (const fm of ["fallback", "real"]) {
          const br = await launch({ realFonts: fm === "real" });
          assert.ok(br);
          await pf.prepareBrowser(br, URL);
          pf.checkFontMode(fm, await br.eval(`return window.__pf.fonts();`));
          fontsFor[fm] = br;
        }
      });
      after(async () => { for (const br of Object.values(fontsFor)) await br.close(); });

      const probe = `
        const hs = [...document.querySelector("#settings-panel > .panel-group").querySelectorAll(".panel-heading")];
        const scales = document.querySelector("#panel-scales-group .panel-heading");
        const style = (el) => { const c = getComputedStyle(el); return [c.fontFamily, c.fontSize, c.fontWeight, c.color, c.letterSpacing, c.textTransform].join("|"); };
        const lines = (el) => { const r = document.createRange(); r.selectNodeContents(el);
          return new Set([...r.getClientRects()].map((k) => Math.round(k.top))).size; };
        const second = document.getElementById("panel-prog-heading");
        const modebar = document.querySelector(".modebar"), tierbar = document.querySelector(".tierbar");
        return {
          texts: hs.map((h) => h.textContent.trim()), tags: hs.map((h) => h.tagName),
          lines: hs.map(lines), same: hs.map((h) => style(h) === style(scales)),
          above: second.getBoundingClientRect().top - modebar.getBoundingClientRect().bottom,
          below: tierbar.getBoundingClientRect().top - second.getBoundingClientRect().bottom,
          inside: second.getBoundingClientRect().right <= document.getElementById("settings-panel").getBoundingClientRect().right,
        };`;

      test("both headings are h3.panel-heading on one line, styled as the Scales heading, with twice the gap above the second as below it", async () => {
        for (const [fm, br] of Object.entries(fontsFor)) {
          for (const [w, h] of [[320, 568], [568, 320], [1024, 700]]) {
            await br.setViewport(w, h, false);
            await br.settle();
            await br.eval(`window.__pf.one("A"); return true;`);
            const r = await br.eval(probe);
            const where = `${fm} ${w}x${h}`;
            assert.deepStrictEqual(r.texts, ["Flash cards", "Chord progression"], where);
            assert.deepStrictEqual(r.tags, ["H3", "H3"], where);
            assert.deepStrictEqual(r.lines, [1, 1], where + ": each heading is one line of text");
            assert.deepStrictEqual(r.same, [true, true], where + ": no new label style");
            assert.ok(Math.abs(r.above - 2 * r.below) <= 0.5, `${where}: gap above ${r.above}, below ${r.below}`);
            assert.ok(r.inside, where);
          }
        }
      });

      test("a heading that wraps is seen as wrapping (the one-line check can fail)", async () => {
        const br = fontsFor.fallback;
        await br.setViewport(320, 568, false);
        await br.settle();
        await br.eval(`window.__pf.one("A"); document.getElementById("panel-prog-heading").style.width = "40px"; return true;`);
        const r = await br.eval(probe);
        await br.eval(`document.getElementById("panel-prog-heading").style.width = ""; return true;`);
        assert.ok(r.lines[1] > 1, "a narrowed 'Chord progression' must report more than one line");
      });
    });

    test("the tier buttons are named as drawn and grouped under the Chord progression heading", async () => {
      const cases = [[380, 740, true, false], [568, 320, true, true], [1280, 800, false, true]];
      try {
        for (const [w, h, m] of cases) {
          await freshLoad();
          await b.setViewport(w, h, m);
          await b.settle();
          await openSettingsPanel();
          await b.send("Accessibility.enable", {});
          const { nodes } = await b.send("Accessibility.getFullAXTree", {});
          const byId = new Map(nodes.map((n) => [n.nodeId, n]));
          const btns = nodes.filter((n) => n.role && n.role.value === "button" && !n.ignored
            && ["EASY", "MEDIUM", "HARD"].includes((n.name && n.name.value || "").trim()));
          assert.deepStrictEqual(btns.map((n) => n.name.value.trim()).sort(), ["EASY", "HARD", "MEDIUM"], `${w}x${h}: tier names`);
          const src = await b.eval(`const g = document.querySelector(".tierbar");
            return { labelledby: g.getAttribute("aria-labelledby"), label: g.getAttribute("aria-label"),
              heading: document.getElementById("panel-prog-heading") && document.getElementById("panel-prog-heading").textContent.trim() };`);
          assert.deepStrictEqual(src, { labelledby: "panel-prog-heading", label: null, heading: "Chord progression" },
            `${w}x${h}: the group's name must come from the visible heading, not from a second string`);
          for (const n of btns) {
            assert.ok(!n.description || !n.description.value, `${w}x${h}: ${n.name.value} has a description`);
            const parent = byId.get(n.parentId);
            assert.ok(parent && parent.role.value === "group" && parent.name && parent.name.value === "Chord progression",
              `${w}x${h}: tier buttons sit in a group named Chord progression`);
          }
          const ring = await b.eval(`const el = document.getElementById("tier-basic"); el.focus({ focusVisible: true });
            const cs = getComputedStyle(el); return [cs.outlineWidth, cs.outlineColor, cs.outlineStyle];`);
          assert.deepStrictEqual(ring, ["2px", "rgb(36, 36, 36)", "solid"], `${w}x${h}: field-guide ink focus ring`);
        }
      } finally { await b.setViewport(900, 900, false); }
    });

    test("exactly one of the five practice buttons is pressed at boot, after every press, and after a reload", async () => {
      await freshLoad();
      assertExactlyOne(await pressedFive(), "modeA", "boot");
      for (const [id, want] of [["tier-advanced", "tier-advanced"], ["modeB", "modeB"], ["tier-basic", "tier-basic"], ["modeA", "modeA"]]) {
        await openSettingsPanel();
        await b.click(`#${id}`);
        await b.settle();
        assertExactlyOne(await pressedFive(), want, `after ${id}`);
        await navigate();
        await b.waitFor(`document.getElementById("${want}").getAttribute("aria-pressed") === "true"`, { label: "reload" });
        assertExactlyOne(await pressedFive(), want, `reload after ${id}`);
      }
      for (const [stored_, want] of [[{ mode: "S", tier: "advanced" }, "tier-advanced"], [{ mode: "A", tier: "advanced" }, "modeA"],
        [{ mode: "S", tier: "nonsense" }, "tier-basic"], [{ mode: "S" }, "tier-basic"]]) {
        await b.eval(`localStorage.setItem("hpfc", ${JSON.stringify(JSON.stringify(stored_))}); return true;`);
        await navigate();
        await b.waitFor(`document.getElementById("${want}").getAttribute("aria-pressed") === "true"`, { label: JSON.stringify(stored_) });
        assertExactlyOne(await pressedFive(), want, JSON.stringify(stored_));
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
        await b.click("#tier-basic");
        await b.waitFor(`document.getElementById("tier-basic").getAttribute("aria-pressed") === "true"`,
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
    test("the footer controls share one centre line in every mode", async () => {
      const viewports = [[380, 700], [320, 568], [844, 390], [1280, 800]];
      for (const [w, h] of viewports) {
        await freshLoad();
        await b.setViewport(w, h, w < h);
        await b.settle();
        for (const mode of ["A", "B", "S"]) {
          await openSettingsPanel();
          await b.click(`#${modeBtn(mode)}`);
          await b.waitFor(`document.getElementById("${modeBtn(mode)}").getAttribute("aria-pressed") === "true"`,
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

    test("the mode S refresh button is a 44px icon that hit-tests to itself", async () => {
      for (const [w, h] of [[380, 700], [844, 390]]) {
        await freshLoad();
        await b.setViewport(w, h, w < h);
        await b.settle();
        await openSettingsPanel();
        await b.click("#tier-basic");
        await b.waitFor(`document.getElementById("tier-basic").getAttribute("aria-pressed") === "true"`,
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
            const rl = document.getElementById("tier-basic").getBoundingClientRect();
            const rr = document.getElementById("tier-advanced").getBoundingClientRect();
            return { wa: ra.width, wb: rb.width, la: ra.left, ls: rl.left, rbRight: rb.right, rsRight: rr.right };
          `);
          assert.ok(Math.abs(m.wa - m.wb) <= 1, `${w}x${h}: #modeA width ${m.wa} vs #modeB width ${m.wb}`);
          assert.ok(Math.abs(m.la - m.ls) <= 1, `${w}x${h}: #modeA left ${m.la} vs #tier-basic left ${m.ls}`);
          assert.ok(Math.abs(m.rbRight - m.rsRight) <= 1, `${w}x${h}: #modeB right ${m.rbRight} vs #tier-advanced right ${m.rsRight}`);
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

  });

  /* ---------------------------------------------------------------- *
   * progression rail scroll continuity (D2 follow-up). Real fonts, NO forced
   * reduced motion: the lurch only exists with smooth scrolling on.
   * ---------------------------------------------------------------- */
  describe("progression rail scroll continuity", () => {
    let rb = null;
    before(async () => {
      rb = await launch({ realFonts: true });
      assert.ok(rb);
      await rb.goto(URL);
      await rb.eval(`return document.fonts.ready.then(() => true);`);
    });
    after(async () => { if (rb) await rb.close(); });

    const sampleFrames = (action) => `
      const rail = () => document.querySelector("#count .seq-rail");
      ${action};
      const out = [];
      return new Promise((res) => {
        const t0 = performance.now();
        const tick = () => {
          out.push(rail().scrollLeft);
          if (performance.now() - t0 < 700) requestAnimationFrame(tick); else res(out);
        };
        tick();
      });`;

    async function dealSixChordRail() {
      await rb.setViewport(380, 740, true);
      await rb.settle();
      await rb.eval(`
        selectDeck("hijaz");
        const d = deck();
        const longest = d.chords.map((c, i) => [i, (c.main + (c.sup || "")).length])
          .sort((a, c) => c[1] - a[1] || a[0] - c[0]).slice(0, 6).map((x) => x[0]);
        tier = "advanced"; mode = "S";
        seq = { chords: longest, style: "together" };
        order = seq.chords.slice(); idx = 0; flipped = false;
        document.getElementById("foot").classList.add("seq");
        render();
        return true;`);
      await rb.settle();
      const m = await rb.eval(`
        const r = document.querySelector("#count .seq-rail");
        return { sw: r.scrollWidth, cw: r.clientWidth, reduced: matchMedia("(prefers-reduced-motion: reduce)").matches };`);
      assert.ok(!m.reduced, "this test needs default motion");
      assert.ok(m.sw > m.cw + 40, `the rail must overflow to exercise the scroll: ${JSON.stringify(m)}`);
    }

    const settleScroll = `
      return new Promise((res) => {
        let last = -1, same = 0;
        const tick = () => {
          const v = document.querySelector("#count .seq-rail").scrollLeft;
          same = v === last ? same + 1 : 0; last = v;
          if (same >= 8) res(v); else requestAnimationFrame(tick);
        };
        tick();
      });`;
    const currentInView = `
      const rail = document.querySelector("#count .seq-rail");
      const rr = rail.getBoundingClientRect(), cr = rail.querySelector("b").getBoundingClientRect();
      return { idx, left: rail.scrollLeft, inView: cr.left >= rr.left - 0.5 && cr.right <= rr.right + 0.5 };`;
    const settledAtLast = async () => {
      await rb.eval(`step(-1); return true;`);
      return rb.eval(settleScroll);
    };

  });

  /* ---------------------------------------------------------------- *
   * difficulty - docs/plans/2026-10-02-sequence-difficulty.md
   * ---------------------------------------------------------------- */
  describe("difficulty", () => {
    const tierState = () => b.eval(`return Object.fromEntries(["basic", "intermediate", "advanced"].map(t => {
      const el = document.getElementById("tier-" + t);
      return [t, { on: el.classList.contains("on"), pressed: el.getAttribute("aria-pressed") }];
    }));`);

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
      await b.click("#tier-basic");
      await b.waitFor(`document.getElementById("tier-basic").getAttribute("aria-pressed") === "true"`,
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
      for (const t of ["basic", "intermediate", "advanced"]) {
        const m = await b.eval(`
          tier = ${JSON.stringify(t)};
          seq = { chords: null, reason: "NO_TIER_SEQUENCE" };
          render();
          return {
            front: document.getElementById("front").innerHTML,
            back: document.getElementById("back").innerHTML,
            button: document.getElementById("tier-${t}").textContent.trim()
          };
        `);
        assert.strictEqual(m.front, m.back);
        assert.match(m.button, /^(EASY|MEDIUM|HARD)$/);
        assert.ok(m.front.includes(`no ${m.button} progressions`),
          `the empty message for ${t} must use the button's own spelling "${m.button}"`);
        assert.doesNotMatch(m.front, /BASIC|INTERMEDIATE|ADVANCED/);
        assert.doesNotMatch(m.front, /doesn.t have enough simple chords/,
          "NO_TIER_SEQUENCE must not reuse the NO_HOME_CHORD/TOO_FEW_CHORDS copy");
      }
    });

    // Owner request (2026-10-02): the difficulty engine must apply to
    // custom/user-added scales too, not only the three built-ins. Generates a
    // scale via the scale sheet (same pattern as the "unsupported deck" e2e
    // test), then confirms every tier's dealt progression on that deck is
    // either correctly classified or reports the D-6 empty reason.
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
      const n = (await bootMeta()).chords;
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
      const n = (await bootMeta()).chords;
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

    test("card swipe: a flipped card keeps its back face during the fly-out and the next card arrives front-up", async () => {
      await freshLoad();
      const n = (await bootMeta()).chords;
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
      const n = (await bootMeta()).chords;
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

    test("card swipe: a real touch tap at the card's REST position during flight lands it and must not flip", async () => {
      await freshLoad();
      const n = (await bootMeta()).chords;
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
      const n = (await bootMeta()).chords;
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

    test("card swipe: under reduced motion the swipe steps instantly with no animation", async () => {
      await freshLoad();
      const n = (await bootMeta()).chords;
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
          const n = (await bootMeta()).chords;
          await b.eval(`window.__pcOnce = 0; document.getElementById("card").addEventListener("pointercancel", () => { window.__pcOnce++; }, { once: true }); return true;`);
          if (h > w) {
            // CHROME_BUDGET fits every viewport with no page overflow by design
            // within #app (untouched here), so there would be nothing to scroll without a
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
      await b.click("#tier-basic");
      await b.waitFor(`document.getElementById("tier-basic").getAttribute("aria-pressed") === "true"`,
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
      const n = (await bootMeta()).chords;
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
          await b.releasing(() => b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 }));
          await b.finishAnimations();
          await b.waitForPendingSettle();
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

    test("card swipe: a touch lostpointercapture still cancels the drag, not a mouse-only release", async () => {
      await freshLoad();
      const n = (await bootMeta()).chords;
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
      const n = (await bootMeta()).chords;
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
      await waitElapsed(DECAY_MS / 2, "half the first decay window to pass");
      await b.eval(`window.setEatClick(true, ${DECAY_MS}); return true;`);
      // Wait past the FIRST decay's deadline (400ms after the first call,
      // i.e. 200ms after the second) but comfortably before the second
      // decay's own deadline (600ms after the first call) - if the stale
      // timer from the first call were not cancelled when the second call
      // re-armed, it would fire in this window and clear the re-armed
      // eatClick early.
      await waitElapsed(DECAY_MS / 2 + 100, "the first decay's deadline to pass");
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
      const n = (await bootMeta()).chords;
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
      // The flight is still in the air here (inside the 220ms
      // fly-out - do NOT poll countText here, that would wait out the
      // fly-out and land it for real before the tap), tap the card - the
      // document capture-phase pointerdown's `if (flight)` branch lands it
      // and reassigns eatClick with no decay.
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
      const n = (await bootMeta()).chords;
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
      await waitElapsed(150, "the first sample to age out of the trailing window");
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

      test("card swipe (wheel): deltaX under 80px does nothing and leaves no transform", async () => {
        await freshLoad();
        const n = (await bootMeta()).chords;
        await wheelGesture([[20, 0], [20, 0]]);
        await waitElapsed(250, "the 160ms gap to fire");
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
        await b.waitFor(`wheel === null && flight === null`, { label: "the wheel gesture to end and settle", timeout: 1000 });
        await b.finishAnimations();
      });

      test("card swipe (wheel): a sub-threshold gesture's spring-back starts exactly where the follow transform left off", async () => {
        await freshLoad();
        const n = (await bootMeta()).chords;
        await wheelGesture([[20, 0], [20, 0]]);
        const follow = await sceneXform();
        assert.strictEqual(follow.none, false, "a sub-threshold gesture must leave a follow transform in place");
        const followDeg = Math.atan2(follow.b, follow.a) * 180 / Math.PI;
        // Wait past WHEEL_GESTURE_GAP_MS (160ms) so wheelGestureEnd() fires
        // and springBack()'s WAAPI animation is created - read its keyframes
        // statically (safe regardless of playback progress, same pattern as
        // the fly-out/enter keyframe reads above).
        await waitElapsed(250, "the gesture to end and springBack() to start");
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
        const n = (await bootMeta()).chords;
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
        const n = (await bootMeta()).chords;
        await wheelAt(100, 0, 2); // modifiers bit 2 = Ctrl
        await b.waitFor(`wheel === null && flight === null`, { label: "the wheel gesture to end and settle", timeout: 1000 });
        await b.finishAnimations();
        assert.strictEqual(await countText(), `1 / ${n}`, "a ctrl+wheel pinch-zoom gesture must never navigate");
        const xf = await sceneXform();
        assert.strictEqual(xf.none, true, "a ctrl+wheel gesture must leave no follow transform");
      });

      test("card swipe (wheel): under reduced motion a sub-threshold wheel gesture rests the card after the gap", async () => {
        await freshLoad();
        try {
          await wheelAt(20, 0);
          const follow = await sceneXform();
          assert.strictEqual(follow.none, false, "motion on: a sub-threshold wheel event must apply a follow transform");
          await b.send("Emulation.setEmulatedMedia", {
            media: "", features: [{ name: "prefers-reduced-motion", value: "reduce" }],
          });
          assert.strictEqual(await b.eval(`return matchMedia("(prefers-reduced-motion: reduce)").matches;`), true);
          await waitElapsed(250, "the gesture to end and swipeRest() to fire");
          assert.strictEqual((await sceneXform()).none, true, "swipeRest() must clear the follow transform");
          assert.strictEqual((await sceneStyle()).willChange, "", "swipeRest() must clear willChange");
        } finally {
          await b.send("Emulation.setEmulatedMedia", { media: "", features: [] });
        }
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

      test("card swipe (mouse momentum): a slow commit starts at the floor speed and is off-screen within SWIPE_MOMENTUM_MAX_MS", async () => {
        await b.setViewport(1024, 700, false);
        try {
          await freshLoad();
          await installRecorder();
          await b.drag("#card", [[-8, 100], [-15, 200], [-25, 400]], { pointer: "mouse" });
          await b.waitFor(`window.__anims.length >= 1`, { label: "the out animation to be recorded" });
          const out = (await recordedAnims())[0];
          assert.ok(out.timing.duration >= 140 && out.timing.duration <= 320,
            `duration ${out.timing.duration} out of [SWIPE_MOMENTUM_MIN_MS 140, SWIPE_MOMENTUM_MAX_MS 320]`);
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
          await b.releasing(() => b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x - 180, y: box.y, button: "left", clickCount: 1, pointerType: "pen" }));
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
          const n = (await bootMeta()).chords;
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

    test("card swipe: startDrag swallows only NotFoundError from setPointerCapture", async () => {
      await freshLoad();
      const press = (error) => b.eval(`
        const card = document.getElementById("card");
        window.__captureCalls = 0;
        card.setPointerCapture = () => { window.__captureCalls++; throw ${error}; };
        const init = { pointerId: 998, pointerType: "mouse", isPrimary: true, button: 0, clientX: 0, bubbles: true };
        card.dispatchEvent(new PointerEvent("pointerdown", init));
        card.dispatchEvent(new PointerEvent("pointerup", init));
        return window.__captureCalls;
      `);
      expectUncaught(/co probe/);
      assert.strictEqual(await press(`new TypeError("co probe")`), 1);
      const deadline = Date.now() + 5000;
      while (!peekExceptions().some((x) => /co probe/.test(x)) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 25));
      }
      assert.ok(peekExceptions().some((x) => /co probe/.test(x)), "a non-NotFoundError must propagate out of startDrag");
      await b.waitFor(`drag === null`, { label: "the first gesture to release", timeout: 1000 });
      const before = peekExceptions().length;
      assert.strictEqual(await press(`new DOMException("x", "NotFoundError")`), 1);
      await b.eval(`return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));`);
      assert.strictEqual(peekExceptions().length, before, "NotFoundError must be swallowed");
    });
  });



  describe("panel fit measures a neutral scrollbar environment (F-18)", () => {
    test("panel fit measures the same panel with and without a classic scrollbar", async () => {
      const pf = require("../tools/probe/panel_fit.js");
      const cb = await launch({});
      assert.ok(cb);
      try {
        // The launch hides the root scrollbar; this test measures panel_fit.js's OWN
        // neutralisation, so put the scrollbar back first.
        await cb.send("Emulation.setScrollbarsHidden", { hidden: false });
        await pf.prepareBrowser(cb, URL);
        const css = `#settings-panel::-webkit-scrollbar{width:15px}`;
        const vectors = {};
        for (const withBar of [false, true]) {
          await cb.eval(`
            document.getElementById("pf-classic")?.remove();
            ${withBar ? `const st = document.createElement("style"); st.id = "pf-classic"; st.textContent = ${JSON.stringify(css)}; document.head.appendChild(st);` : ""}
            return true;`);
          for (const [w, h] of [[352, 320], [352, 520]]) {
            await cb.setViewport(w, h, false);
            const [cell] = await cb.eval(`return window.__pf.cell(["A"]);`);
            assert.strictEqual(cell.gutter, 0, `${w}x${h} withBar=${withBar}: the scrollbar takes no layout width`);
            vectors[`${w}x${h} ${withBar}`] = pf.vectorOf(cell);
          }
        }
        for (const [w, h] of [[352, 320], [352, 520]]) {
          assert.ok(pf.vectorsEqual(vectors[`${w}x${h} false`], vectors[`${w}x${h} true`]), `${w}x${h}: same vector with and without the classic scrollbar`);
        }
      } finally { await cb.close(); }
    });
  });

  // D2 step 6b/6c (H-8, H-9; ER-28, ER-31): T-LABEL and T-EDGE, restored from
  // b8aaf6c^ without the abbreviation clause. T-EDGE's tables are main's own
  // numbers as literals, measured on origin/main (655a45c) with the oracle's
  // measuring function, so the test does not drift when main gains the heading.
  // Per cell and mode: needed = main + H + g within 0.5px (or main + 0 where
  // L_DELTA says the heading costs `needed` nothing), the first panel group
  // equals main's group + H + g, and each other group equals main's. H is the
  // second heading's height and g its computed margin-top; H + g must not
  // exceed the oracle's HEADING_ALLOWANCE_PX.
  describe("tier row (T-LABEL, T-EDGE)", () => {
    const pf = require("../tools/probe/panel_fit.js");
    const fonts = {};
    before(async () => {
      for (const fm of ["fallback", "real"]) {
        const br = await launch({ realFonts: fm === "real" });
        assert.ok(br, "no browser for " + fm);
        await pf.prepareBrowser(br, URL);
        pf.checkFontMode(fm, await br.eval(`return window.__pf.fonts();`));
        fonts[fm] = br;
      }
    });
    after(async () => { for (const br of Object.values(fonts)) await br.close(); });

    const labelProbe = `
      const bar = document.querySelector(".tierbar");
      return { barW: bar.clientWidth, rows: ["tier-basic", "tier-intermediate", "tier-advanced"].map((id) => {
        const el = document.getElementById(id);
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        const rg = document.createRange(); rg.selectNodeContents(el);
        return { id, top: r.top, w: r.width, h: r.height, sw: el.scrollWidth, cw: el.clientWidth,
          content: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
          text: el.textContent.trim(), textW: rg.getBoundingClientRect().width };
      }) };`;

    test("every tier label fits its button with 2px to spare, in one row, in both font modes", async () => {
      const cells = [[320, 568], [380, 740], [768, 1024], [427, 320], [568, 320], [640, 320], [667, 375],
                     [860, 400], [1024, 700], [1280, 800]];
      const barWidth = { "320x568": 292, "427x320": 200, "1024x700": 199 };
      const full = { "tier-basic": "EASY", "tier-intermediate": "MEDIUM", "tier-advanced": "HARD" };
      const states = [["A", null], ["B", null], ["S", "basic"], ["S", "intermediate"], ["S", "advanced"]];
      for (const [fm, br] of Object.entries(fonts)) {
        for (const [w, h] of cells) {
          await br.setViewport(w, h, false);
          await br.settle();
          for (const [mode, t] of states) {
            const where = `${fm} ${w}x${h} mode ${mode}${t ? " tier " + t : ""}`;
            const r = await br.eval(`
              ${t ? `tier = ${JSON.stringify(t)};` : ""}
              window.__pf.one(${JSON.stringify(mode)});
              ${labelProbe}`);
            if (barWidth[w + "x" + h]) assert.strictEqual(r.barW, barWidth[w + "x" + h], where + ": the tier bar width moved");
            assert.strictEqual(new Set(r.rows.map((x) => Math.round(x.top * 10))).size, 1, where + ": the tier buttons are not on one row");
            for (const x of r.rows) {
              assert.ok(x.sw <= x.cw, where + ": " + x.id + " scrolls horizontally (" + x.sw + " > " + x.cw + ")");
              assert.strictEqual(x.text, full[x.id], where + ": " + x.id + " draws the wrong string");
              assert.ok(x.textW <= x.content - 2, where + ": " + x.id + " label " + x.textW + "px has under 2px to spare in " + x.content + "px");
              assert.ok(Math.abs(x.h - 44) < 0.5, where + ": " + x.id + " is " + x.h + "px tall");
              assert.ok(x.w >= 44, where + ": " + x.id + " is " + x.w + "px wide");
            }
          }
        }
      }
    });

    test("the tier row stays on one row under a 15px classic scrollbar at 1024x700 in progression", async () => {
      for (const [fm, br] of Object.entries(fonts)) {
        await br.setViewport(1024, 700, false);
        await br.settle();
        await br.eval(`const st = document.createElement("style"); st.id = "pf-classic";
          st.textContent = "#settings-panel::-webkit-scrollbar{width:15px}"; document.head.appendChild(st); return true;`);
        try {
          const r = await br.eval(`window.__pf.one("S"); ${labelProbe}`);
          assert.strictEqual(new Set(r.rows.map((x) => Math.round(x.top * 10))).size, 1, fm + ": one row under the classic scrollbar");
          for (const x of r.rows) assert.ok(x.sw <= x.cw, `${fm}: ${x.id} scrolls horizontally under the classic scrollbar (${x.sw} > ${x.cw})`);
        } finally {
          await br.eval(`document.getElementById("pf-classic").remove(); return true;`);
        }
      }
    });

    // The derived-edge budget tables pinned main's group heights plus the Amy row,
    // PM and Language deltas. The Resources group is now three fixed rows, so those
    // sums no longer hold; the CI panel-fit oracle (tools/probe/panel_fit.js) owns
    // the budget, and this keeps every control reachable at representative edges.
    test("every panel control is reachable at representative portrait, landscape and sidebar edges, in both font modes", async () => {
      const cells = [[320, 568], [380, 700], [639, 701], [640, 700], [320, 320], [568, 375], [667, 375], [1024, 700], [1280, 800]];
      for (const [fm, br] of Object.entries(fonts)) {
        for (const [w, h] of cells) {
          await br.setViewport(w, h, false);
          await br.settle();
          for (const m of ["A", "B", "S"]) {
            const unreachable = await br.eval(`
              window.__pf.one(${JSON.stringify(m)});
              const p = document.getElementById("settings-panel");
              const top = p.getBoundingClientRect().top - p.scrollTop;
              return [...p.querySelectorAll("button, select, a")].filter(e => e.getClientRects().length)
                .filter(e => e.getBoundingClientRect().bottom - top > p.scrollHeight + 0.5).map(e => e.id);`);
            assert.deepStrictEqual(unreachable, [], `${fm} ${w}x${h} mode ${m}: a control lies beyond the scrollable height`);
          }
        }
      }
    });
  });

  // Editable defaults (lane e2e): delete, save and reset a seeded deck, at 380px.
  const deleteSelectedSeeded = async () => {
    await openEdit();
    await b.click("#scale-delete");
    await b.waitFor(`document.getElementById("scale-delete").hasAttribute("data-armed")`,
      { label: "DELETE THIS SCALE to arm" });
    await b.click("#scale-delete");
    await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`,
      { label: "the sheet to close after the delete" });
  };
  const chipTexts = () => b.eval(
    `return [...document.querySelectorAll("#decks .chip:not(#deck-add)")].map(e => e.textContent.trim());`);

  describe("analytics hosts", () => {
    const PATTERNS = ANALYTICS_PATTERNS;
    const HOSTS = PATTERNS.map((p) => p.replace(/\*/g, ""));

    async function recordBoot(cb, load) {
      const urls = [];
      const byId = new Map();
      const failed = [];
      cb.on("Network.requestWillBeSent", (p) => { urls.push(p.request.url); byId.set(p.requestId, p.request.url); });
      cb.on("Network.loadingFailed", (p) => { failed.push(byId.get(p.requestId)); });
      try {
        await cb.send("Network.enable");
        await load();
      } finally { cb.off("Network.requestWillBeSent"); cb.off("Network.loadingFailed"); }
      urls.failed = failed;
      return urls;
    }
    function assertClean(urls, where) {
      const bad = urls.filter((u) => HOSTS.some((h) => u.includes(h)));
      assert.deepStrictEqual(bad, [], `${where}: a test boot sent analytics requests`);
    }

    test("a full boot sends zero requests to googletagmanager.com and google-analytics.com", async () => {
      assert.deepStrictEqual(HOSTS, ["googletagmanager.com", "google-analytics.com"], "the block list no longer names both analytics hosts");
      const urls = await recordBoot(b, freshLoad);
      assert.ok(urls.length > 0, "the recorder saw the boot's requests");
      assertClean(urls, "default launch");
      for (const p of PATTERNS) assert.ok(b.blockedUrls.includes(p), `launch() blocks ${p}`);

      const cb = await launch({ realFonts: true });
      try {
        const real = await recordBoot(cb, async () => {
          await cb.send("Page.navigate", { url: URL });
          await cb.waitFor(APP_READY_EXPR, { label: "app ready (realFonts)" });
        });
        assert.ok(real.length > 0, "the recorder saw the realFonts boot's requests");
        assertClean(real, "realFonts launch");
        const fontUrls = real.filter((u) => /fonts\.googleapis\.com/.test(u));
        assert.ok(fontUrls.length > 0, "the realFonts boot requested the font stylesheet, so the next check proves something");
        assert.deepStrictEqual(real.failed.filter((u) => /fonts\.googleapis\.com/.test(u || "")), [], "the analytics block failed a font request");
        for (const p of PATTERNS) assert.ok(cb.blockedUrls.includes(p), `realFonts launch() blocks ${p}`);
      } finally { await cb.close(); }
    });
  });

  describe("harness scrollbars", () => {
    test("the e2e launch hides classic scrollbars: innerWidth equals documentElement.clientWidth on a page taller than the viewport", async () => {
      for (const opts of [{}, { realFonts: true }]) {
        const cb = await launch(opts);
        try {
          await cb.setViewport(900, 900, false);
          await cb.send("Page.navigate", { url: "data:text/html,<!doctype html><body style='height:5000px'></body>" });
          await cb.waitFor('document.readyState === "complete" && document.body.offsetHeight === 5000', { label: "tall page" });
          const m = await cb.eval(`return { iw: innerWidth, cw: document.documentElement.clientWidth };`);
          const where = JSON.stringify(opts);
          assert.strictEqual(m.iw, 900, `${where}: innerWidth`);
          assert.strictEqual(m.cw, 900, `${where}: documentElement.clientWidth`);
          assert.strictEqual(m.iw, m.cw, `${where}: no scrollbar takes layout width`);
        } finally { await cb.close(); }
      }
    });
  });

  describe("discoverability", () => {
    // .scene rect, origin/main (2b7dadc) re-measured with the header lockup (logo-in-app D10) (before #app and #about
    // existed) with the e2e launch (fallback fonts, scrollbars hidden) at
    // these viewports, desktop emulation (mobile: false). The wrapper and the
    // section below the first screen must not move the card (plan D20).
    const ORIGIN_SCENE = {
      "380x780": { width: 334.390625, height: 461.78125, left: 22.796875, top: 176.265625 },
      "320x568": { width: 239.90625, height: 331.3125, left: 40.046875, top: 131.015625 },
      "1024x700": { width: 314.515625, height: 434.34375, left: 354.734375, top: 149.984375 },
    };
    const VIEWPORTS = { "380x780": [380, 780], "320x568": [320, 568], "1024x700": [1024, 700] };

    test("the about section is not rendered on / and its text is in the served HTML", async () => {
      await freshLoad();
      await b.setViewport(380, 780, false);
      try {
        await b.settle();
        const m = await b.eval(`
          const a = document.getElementById("about");
          const r = a.getBoundingClientRect();
          return fetch(location.href.split("#")[0]).then((res) => res.text()).then((served) => ({
                   width: r.width, display: getComputedStyle(a).display, hidden: a.hidden,
                   served: /id="about"/.test(served) && /D Celtic/.test(served),
                   dsw: document.documentElement.scrollWidth, dcw: document.documentElement.clientWidth }));
        `);
        assert.strictEqual(m.hidden, true, "#about is not hidden on /");
        assert.strictEqual(m.display, "none", "#about is rendered on /");
        assert.strictEqual(m.width, 0);
        assert.strictEqual(m.served, true, "the About text is not in the served HTML");
        assert.ok(m.dsw <= m.dcw + 1, `the document scrolls horizontally at 380px (${m.dsw} > ${m.dcw})`);
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("the card keeps its origin/main size and position with About off the first screen", async () => {
      await freshLoad();
      try {
        for (const [key, [w, h]] of Object.entries(VIEWPORTS)) {
          await b.setViewport(w, h, false);
          await b.settle();
          const got = await b.eval(`
            const r = document.querySelector(".scene").getBoundingClientRect();
            return { width: r.width, height: r.height, left: r.left, top: r.top };
          `);
          const base = ORIGIN_SCENE[key];
          for (const prop of ["width", "height", "left", "top"]) {
            assert.ok(Math.abs(got[prop] - base[prop]) <= 1,
              `${key} .scene ${prop}: got ${got[prop]}, origin/main ${base[prop]}`);
          }
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("analyticsAllowed() is false in the harness and the boot sends zero analytics requests", async () => {
      const urls = [];
      b.on("Network.requestWillBeSent", (p) => { urls.push(p.request.url); });
      try {
        await b.send("Network.enable");
        await freshLoad();
      } finally { b.off("Network.requestWillBeSent"); }
      const m = await b.eval(`
        return { allowed: analyticsAllowed(), host: location.hostname,
                 scripts: [...document.head.querySelectorAll("script[src]")].map((s) => s.src),
                 config: window.dataLayer.some((e) => e[0] === "config"),
                 consent: window.dataLayer.filter((e) => e[0] === "consent").length };
      `);
      assert.strictEqual(m.host, "127.0.0.1");
      assert.strictEqual(m.allowed, false);
      assert.deepStrictEqual(m.scripts, []);
      assert.strictEqual(m.config, false);
      assert.strictEqual(m.consent, 2, "the inline consent defaults still ran");
      assert.deepStrictEqual(urls.filter((u) => /googletagmanager\.com|google-analytics\.com/.test(u)), []);
    });

    test("a #deck= link opens that deck at 380px and the address bar keeps the deck's own route", async () => {
      await freshLoad();
      await b.setViewport(380, 780, false);
      try {
        await navigate(URL + "?r=route#deck=f-low-pygmy-18");
        await b.settle();
        const m = await b.eval(`
          const chip = document.querySelector("#decks .chip.on");
          return { hash: location.hash, search: location.search, chip: chip ? chip.textContent : null,
                   sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
        `);
        assert.strictEqual(m.hash, "#deck=f-low-pygmy-18");
        assert.strictEqual(m.search, "?r=route");
        assert.match(m.chip, /pygmy/i);
        assert.deepStrictEqual(await nativeCommittedPreference(b,{kind:"builtin",id:"pygmy"}),{kind:"builtin",id:"pygmy"});
        assert.strictEqual((await stored())?.deck,undefined,"routed selection preserves the absent legacy hpfc.deck");
        assert.ok(m.sw <= m.cw + 1, "horizontal overflow at 380px");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("clicking a deck link inside the open About switches the deck without a reload", async () => {
      await freshLoad();
      await b.setViewport(380, 780, false);
      try {
        await openSettingsPanel();
        await b.click("#about-open");
        await b.waitFor(`document.getElementById("about").hidden === false`, { label: "About to open" });
        await b.eval(`window.__noReload = true; document.querySelector('#about a[href="#deck=c-sharp-hijaz-9"]').scrollIntoView({ block: "center" }); return true;`);
        await b.settle();
        await b.click('#about a[href="#deck=c-sharp-hijaz-9"]');
        await b.waitFor(`/hijaz/i.test((document.querySelector("#decks .chip.on") || {}).textContent || "")`, { label: "Hijaz chip on" });
        const m = await b.eval(`
          return { hash: location.hash, kept: window.__noReload === true,
                   navs: performance.getEntriesByType("navigation").length };
        `);
        assert.strictEqual(m.hash, "#deck=c-sharp-hijaz-9");
        assert.strictEqual(m.kept, true, "the page reloaded");
        assert.strictEqual(m.navs, 1);
        assert.deepStrictEqual(await nativeCommittedPreference(b,{kind:"builtin",id:"hijaz"}),{kind:"builtin",id:"hijaz"});
        assert.strictEqual((await stored())?.deck,undefined,"About navigation preserves the absent legacy hpfc.deck");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });
  });

  describe("about overlay", () => {
    const chipOnText = () => b.eval(`return (document.querySelector("#decks .chip.on") || {}).textContent || ""`);
    const aboutIsHidden = () => b.eval(`return document.getElementById("about").hidden`);
    const activeId = () => b.eval(`return document.activeElement ? document.activeElement.id : ""`);
    async function openAboutUi() {
      await openSettingsPanel();
      await b.eval(`document.getElementById("about-open").scrollIntoView({ block: "center" }); return true;`);
      await b.settle();
      await b.click("#about-open");
      await b.waitFor(`document.getElementById("about").hidden === false`, { label: "About to open" });
      await b.settle();
    }
    async function waitAboutClosed() {
      await b.waitFor(`document.getElementById("about").hidden === true`, { label: "About to close" });
      await b.settle();
    }

    test("AO: at 380px ABOUT opens a full-screen About, the panel is closed, the app is inert and covered, and focus is on the exit", async () => {
      await freshLoad();
      await b.setViewport(380, 800, false);
      try {
        await b.settle();
        await openAboutUi();
        const m = await b.eval(`
          const a = document.getElementById("about");
          const r = a.getBoundingClientRect();
          const top = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
          const app = document.getElementById("app");
          return { rect: [r.left, r.top, r.width, r.height], iw: innerWidth, ih: innerHeight,
                   panelHidden: document.getElementById("settings-panel").hidden,
                   covered: !!top && a.contains(top), appInert: app.inert, appAria: app.getAttribute("aria-hidden"),
                   role: a.getAttribute("role"), modal: a.getAttribute("aria-modal"),
                   active: document.activeElement.id, hash: location.hash,
                   htmlClass: document.documentElement.classList.contains("about-open") };
        `);
        assert.deepStrictEqual(m.rect, [0, 0, m.iw, m.ih], "About is not full screen");
        assert.strictEqual(m.panelHidden, true, "the settings panel is still open");
        assert.strictEqual(m.covered, true, "something covers About at the centre");
        assert.strictEqual(m.appInert, true);
        assert.strictEqual(m.appAria, "true");
        assert.strictEqual(m.role, "dialog");
        assert.strictEqual(m.modal, "true");
        assert.strictEqual(m.active, "about-close");
        assert.strictEqual(m.hash, "#about");
        assert.strictEqual(m.htmlClass, true);
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("AO: at 380px the exit control restores the deck, card, flip state, mode and scroll, with focus on the settings trigger", async () => {
      await freshLoad();
      await b.setViewport(380, 800, false);
      try {
        await b.settle();
        await b.eval(`location.hash = "#deck=c-sharp-hijaz-9"; return true;`);
        await b.waitFor(`/hijaz/i.test((document.querySelector("#decks .chip.on") || {}).textContent || "")`, { label: "Hijaz on" });
        await openSettingsPanel();
        await b.click("#modeB");
        await b.waitFor(`document.getElementById("modeB").getAttribute("aria-pressed") === "true"`, { label: "mode B" });
        await b.key("ArrowRight", "ArrowRight", 39);
        await b.settle();
        await b.click("#card");
        await b.waitFor(`document.getElementById("card").classList.contains("flip")`, { label: "card flipped" });
        await b.settle();
        const snap = () => b.eval(`
          return { chip: (document.querySelector("#decks .chip.on") || {}).textContent, count: document.getElementById("count").textContent,
                   flip: document.getElementById("card").classList.contains("flip"),
                   mode: document.getElementById("modeB").getAttribute("aria-pressed"),
                   scrollY: window.scrollY, hash: location.hash };
        `);
        const before = await snap();
        await openAboutUi();
        await b.click("#about-close");
        await waitAboutClosed();
        const after = await snap();
        assert.deepStrictEqual(after, before, "the app state changed across About");
        assert.strictEqual(await activeId(), "settings-trigger");
        assert.strictEqual(await b.eval(`return document.getElementById("settings-panel").hidden`), true);
        assert.strictEqual(await b.eval(`return document.getElementById("app").inert`), false);
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("AO: at 380px Back closes About and one more Back leaves the page's history as it was before ABOUT", async () => {
      await freshLoad();
      await b.setViewport(380, 800, false);
      try {
        await b.settle();
        const nav = async () => {
          const h = await b.send("Page.getNavigationHistory");
          return { index: h.currentIndex, length: h.entries.length, url: h.entries[h.currentIndex].url,
                   ids: h.entries.map((e) => e.id), currentId: h.entries[h.currentIndex].id };
        };
        const before = await nav();
        await openAboutUi();
        await b.waitFor(`location.hash === "#about"`, { label: "the bar to read #about" });
        const during = await nav();
        assert.match(during.url, /#about$/);
        const fresh = during.ids.filter((id) => !before.ids.includes(id));
        assert.deepStrictEqual(fresh, [during.currentId], "ABOUT did not push exactly one new entry, the current one");
        assert.ok(during.ids.includes(before.currentId), "ABOUT dropped the entry it was opened from");
        assert.strictEqual(await b.eval(`return !!(history.state && history.state.about)`), true, "ABOUT did not push its own entry");
        await b.eval(`history.back(); return true;`);
        await waitAboutClosed();
        await b.waitFor(`location.hash === "#deck=d-kurd-10"`, { label: "the bar to return to the deck route" });
        const after = await nav();
        assert.strictEqual(after.index, during.index - 1, "Back did not step exactly one entry");
        assert.strictEqual(after.url, before.url);
        await b.eval(`history.back(); return true;`);
        await new Promise((r) => setTimeout(r, 300));
        const left = await nav();
        assert.ok(left.index < after.index || left.url !== before.url, "a second Back stayed on the page's own entries");
        assert.strictEqual(await aboutIsHidden().catch(() => true), true);
      } finally {
        await navigate().catch(() => {});
        await b.setViewport(900, 900, false);
      }
    });

    test("AO: at 380px Escape closes About and arrow keys never step the card while it is open", async () => {
      await freshLoad();
      await b.setViewport(380, 800, false);
      try {
        await b.settle();
        const count = () => b.eval(`return document.getElementById("count").textContent`);
        const c0 = await count();
        await openAboutUi();
        await b.key("ArrowRight", "ArrowRight", 39);
        await b.key("ArrowLeft", "ArrowLeft", 37);
        await b.settle();
        assert.strictEqual(await count(), c0, "an arrow key stepped the card under About");
        await b.key("Escape", "Escape", 27);
        await waitAboutClosed();
        assert.strictEqual(await activeId(), "settings-trigger");
        assert.strictEqual(await count(), c0);
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("AO: at 380px a #deck= link inside About switches deck and one Back returns to the previous deck", async () => {
      await freshLoad();
      await b.setViewport(380, 800, false);
      try {
        await b.settle();
        assert.match(await chipOnText(), /kurd/i);
        await openAboutUi();
        const sel = '#about a[href="#deck=c-sharp-hijaz-9"]';
        await b.eval(`document.querySelector('${sel}').scrollIntoView({ block: "center" }); return true;`);
        await b.settle();
        await b.click(sel);
        await b.waitFor(`/hijaz/i.test((document.querySelector("#decks .chip.on") || {}).textContent || "")`, { label: "Hijaz on" });
        await waitAboutClosed();
        assert.strictEqual(await b.eval(`return location.hash`), "#deck=c-sharp-hijaz-9");
        await b.eval(`history.back(); return true;`);
        await b.waitFor(`/kurd/i.test((document.querySelector("#decks .chip.on") || {}).textContent || "")`, { label: "Kurd back on" });
        await new Promise((r) => setTimeout(r, 300));
        assert.strictEqual(await b.eval(`return location.hash`), "#deck=d-kurd-10");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("AO: the page behind About does not scroll, at 380x800 and 844x390", async () => {
      for (const [w, h] of [[380, 800], [844, 390]]) {
        await freshLoad();
        await b.setViewport(w, h, false);
        try {
          await b.settle();
          await openAboutUi();
          const m = await b.eval(`
            const before = window.scrollY;
            window.scrollTo(0, 9999);
            return { overflow: getComputedStyle(document.documentElement).overflow, before, after: window.scrollY };
          `);
          assert.strictEqual(m.overflow, "hidden", `${w}x${h}: the page is scrollable under About`);
          assert.strictEqual(m.after, m.before, `${w}x${h}: the page scrolled under About`);
        } finally {
          await b.setViewport(900, 900, false);
        }
      }
    });

    test("AO: About scrolls with its exit visible, non-overlapping 44px link targets and no horizontal scroll at 380x800, 844x390 and 1280x800", async () => {
      for (const [w, h] of [[380, 800], [844, 390], [1280, 800]]) {
        await freshLoad();
        await b.setViewport(w, h, false);
        try {
          await b.settle();
          await openAboutUi();
          const m = await b.eval(`
            const a = document.getElementById("about");
            a.scrollTop = a.scrollHeight;
            const close = document.getElementById("about-close").getBoundingClientRect();
            const links = [...a.querySelectorAll('ul a, a[href^="mailto:"]')].map((l) => {
              const r = l.getBoundingClientRect();
              const range = document.createRange(); range.selectNodeContents(l);
              const t = range.getBoundingClientRect();
              return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height,
                       textMid: (t.top + t.bottom) / 2, rowMid: (r.top + r.bottom) / 2 };
            });
            return { close: [close.top, close.bottom], ih: innerHeight, links, scrolled: a.scrollTop > 0 || a.scrollHeight <= a.clientHeight,
                     sw: a.scrollWidth, cw: a.clientWidth,
                     dsw: document.documentElement.scrollWidth, dcw: document.documentElement.clientWidth };
          `);
          const where = `${w}x${h}`;
          assert.ok(m.close[0] >= 0 && m.close[1] <= m.ih, `${where}: the exit control is off screen when scrolled to the end`);
          assert.strictEqual(m.links.length, 23, `${where}: five deck links, sixteen popular scale links, the hub link and the mailto link`);
          for (const l of m.links) {
            assert.ok(l.h >= 44, `${where}: a link target is ${l.h}px tall`);
            assert.ok(Math.abs(l.textMid - l.rowMid) <= 2, `${where}: link text is ${l.textMid - l.rowMid}px off its row centre`);
          }
          const sorted = m.links.slice().sort((x, y) => x.top - y.top);
          for (let i = 1; i < sorted.length; i++) {
            assert.ok(sorted[i].top >= sorted[i - 1].bottom - 0.5, `${where}: link rects overlap`);
          }
          assert.ok(m.sw <= m.cw + 1, `${where}: About scrolls horizontally`);
          assert.ok(m.dsw <= m.dcw + 1, `${where}: the document scrolls horizontally`);
        } finally {
          await b.setViewport(900, 900, false);
        }
      }
    });

    test("I18N: a chosen language survives closing and reopening the panel, a mode tap and a reload", async () => {
      await freshLoad();
      await b.setViewport(380, 800, false);
      try {
        await b.settle();
        await openSettingsPanel();
        await b.eval(`const s = document.getElementById("lang-select"); s.value = "de"; s.dispatchEvent(new Event("change", { bubbles: true })); return true;`);
        await b.waitFor(`document.documentElement.lang === "de"`, { label: "the language to apply" });
        const stored = () => b.eval(`try { return JSON.parse(localStorage.getItem("hpfc")).lang || null; } catch (e) { return "ERR"; }`);
        assert.strictEqual(await stored(), "de", "stored after choosing");
        await b.click("#settings-trigger");
        await b.waitFor(`getComputedStyle(document.getElementById("settings-panel")).display === "none"`, { label: "settings panel to close" });
        await openSettingsPanel();
        assert.strictEqual(await stored(), "de", "stored after close and reopen");
        assert.strictEqual(await b.eval(`return document.getElementById("lang-select").value;`), "de", "select after reopen");
        await b.click("#modeB");
        await b.settle();
        assert.strictEqual(await stored(), "de", "stored after a mode tap");
        await navigate(URL);
        await b.settle();
        assert.strictEqual(await b.eval(`return document.documentElement.lang;`), "de", "lang after reload");
      } finally {
        await b.eval(`try { localStorage.clear(); } catch (e) {} return true;`);
        await b.setViewport(900, 900, false);
      }
    });

    test("AO: at 1280x800 the sidebar's ABOUT opens About and closing returns focus to ABOUT", async () => {
      await freshLoad();
      await b.setViewport(1280, 800, false);
      try {
        await b.settle();
        await b.click("#about-open");
        await b.waitFor(`document.getElementById("about").hidden === false`, { label: "About to open" });
        assert.strictEqual(await activeId(), "about-close");
        await b.click("#about-close");
        await waitAboutClosed();
        assert.strictEqual(await activeId(), "about-open");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("AO: the About content box is at least min(520, viewport - 32)px wide at 380x800 and 1280x800", async () => {
      for (const [w, h] of [[380, 800], [1280, 800]]) {
        await freshLoad();
        await b.setViewport(w, h, false);
        try {
          await b.settle();
          await openAboutUi();
          const m = await b.eval(`
            const a = document.getElementById("about");
            const c = getComputedStyle(a);
            return { box: a.clientWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight), iw: innerWidth };
          `);
          const want = Math.min(520, m.iw - 32);
          assert.ok(m.box >= want - 0.5, `${w}x${h}: the content box is ${m.box}px, wanted at least ${want}`);
        } finally {
          await b.setViewport(900, 900, false);
        }
      }
    });
  });

  describe("share url", () => {
    const hash = () => b.eval(`return location.hash`);
    const href = () => b.eval(`return location.href`);
    const chipOn = () => b.eval(`return (document.querySelector("#decks .chip.on") || {}).textContent || ""`);
    const waitHash = (h, label) => b.waitFor(`location.hash === ${JSON.stringify(h)}`, { label });
    const HIJAZ = "#deck=c-sharp-hijaz-9";
    const PYGMY = "#deck=f-low-pygmy-18";
    const waitChip = (re, label) => b.waitFor(`${re}.test((document.querySelector("#decks .chip.on") || {}).textContent || "")`, { label });

    test("edge 1: three chip taps rewrite the bar each time and add no history entry", async () => {
      await freshLoad();
      await b.settle();
      const len = await b.eval(`return history.length`);
      const seen = [await hash()];
      for (const i of [1, 2, 3]) {
        await b.eval(`document.querySelectorAll("#decks .chip:not(#deck-add)")[${i}].click(); return true`);
        await b.settle();
        const h = await hash();
        assert.match(h, /^#deck=/);
        assert.notStrictEqual(h, seen[seen.length - 1], `tap ${i} left the previous deck's route`);
        seen.push(h);
      }
      assert.strictEqual(await b.eval(`return history.length`), len, "chip taps pushed history entries");
      assert.strictEqual(await hash(), await b.eval(`return routeFor(deck())`), "the bar is not the shown deck's route");
    });

    test("edge 8: the app's own writes fire no hashchange, and a hashchange to the shown hash changes nothing", async () => {
      await freshLoad();
      await b.settle();
      await b.eval(`window.__hc = 0; window.addEventListener("hashchange", () => { window.__hc++; }); return true`);
      for (const i of [1, 2, 3]) {
        await b.eval(`document.querySelectorAll("#decks .chip:not(#deck-add)")[${i}].click(); return true`);
        await b.settle();
      }
      assert.strictEqual(await b.eval(`return window.__hc`), 0, "replaceState fired hashchange");
      const shown = await b.eval(`return { hash: location.hash, chip: document.querySelector("#decks .chip.on").textContent }`);
      await b.eval(`window.dispatchEvent(new HashChangeEvent("hashchange")); return true`);
      await b.settle();
      const again = await b.eval(`return { hash: location.hash, chip: document.querySelector("#decks .chip.on").textContent }`);
      assert.deepStrictEqual(again, shown);
    });

    test("edge 9: a real COPY LINK click puts location.href, query included, on the clipboard", async () => {
      const origin = await b.eval(`return location.origin`);
      await b.send("Browser.grantPermissions", { permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"], origin });
      await freshLoad();
      await navigate(URL + "?share=x");
      await b.settle();
      await b.click("#share-copy");
      await b.waitFor(`/LINK COPIED/.test(document.getElementById("announce") ? document.getElementById("announce").textContent : document.body.textContent)`,
        { label: "LINK COPIED to be announced" });
      const m = await b.eval(`return navigator.clipboard.readText().then((t) => ({ clip: t, href: location.href }))`);
      assert.strictEqual(m.clip, m.href);
      assert.ok(m.clip.includes("?share=x#deck="), m.clip);
    });

    for (const kind of ["coarse", "fine"]) {
      test(`NS: at 380x780 with a ${kind} pointer one tap on COPY LINK ${kind === "coarse" ? "calls navigator.share on the same tick" : "never calls navigator.share"}`, async () => {
        await freshLoad();
        await b.setViewport(380, 780, true);
        await b.send("Emulation.setTouchEmulationEnabled", { enabled: kind === "coarse", maxTouchPoints: 5 });
        try {
          await b.settle();
          const m = await b.eval(`
            window.__shareCalls = 0; window.__shareArg = null;
            navigator.share = (o) => { window.__shareCalls++; window.__shareArg = o; return new Promise(() => {}); };
            document.getElementById("share-copy").click();
            return { calls: window.__shareCalls, arg: window.__shareArg, href: location.href };
          `);
          if (kind === "coarse") {
            assert.strictEqual(m.calls, 1, "navigator.share was not called on the tap's own tick");
            assert.deepStrictEqual(m.arg, { url: m.href });
          } else {
            assert.strictEqual(m.calls, 0);
          }
        } finally {
          await b.send("Emulation.setTouchEmulationEnabled", { enabled: false });
          await b.setViewport(900, 900, false);
        }
      });
    }

    test("edge 10: COPY LINK is a 44px target in the header at 320px and 380px with no horizontal overflow", async () => {
      await freshLoad();
      try {
        for (const [w, h] of [[320, 568], [380, 700]]) {
          await b.setViewport(w, h, true);
          await b.settle();
          const m = await b.eval(`
            const r = document.getElementById("share-copy").getBoundingClientRect();
            return { h: r.height, w: r.width, left: r.left, right: r.right, vw: innerWidth,
                     sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
          `);
          assert.ok(m.h >= 44 && m.w >= 44, `${w}px: COPY LINK is ${m.w}x${m.h}`);
          assert.ok(m.left >= 0 && m.right <= m.vw, `${w}px: COPY LINK leaves the viewport: ${m.left}..${m.right} of ${m.vw}`);
          assert.ok(m.sw <= m.cw + 1, `horizontal overflow at ${w}px`);
        }
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("SI: the share icon is a 44px target in the header's left cell at 380x780 and the title stays centred", async () => {
      await freshLoad();
      try {
        await b.setViewport(380, 780, true);
        await b.settle();
        const m = await b.eval(`
          const r = (s) => document.querySelector(s).getBoundingClientRect();
          const i = r("#share-copy"), h = r("h1"), row = r(".hrow");
          const hit = document.elementFromPoint(i.left + i.width / 2, i.top + i.height / 2);
          return { iw: i.width, ih: i.height, il: i.left - row.left, hc: h.left + h.width / 2,
                   rc: row.left + row.width / 2, hit: !!(hit && hit.closest("#share-copy")) };
        `);
        assert.ok(m.iw === 44 && m.ih === 44, `icon is ${m.iw}x${m.ih}`);
        assert.ok(Math.abs(m.il) <= 1, `icon is not in the left cell: ${m.il}`);
        assert.ok(Math.abs(m.hc - m.rc) <= 1, `title is off centre: ${m.hc} vs ${m.rc}`);
        assert.strictEqual(m.hit, true);
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    const revealShareUrl = async () => {
      await b.eval(`Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
        Object.defineProperty(navigator, "share", { value: undefined, configurable: true }); return true;`);
      await b.click("#share-copy");
      await b.waitFor(`!document.getElementById("share-url").hidden`, { label: "#share-url to be revealed" });
    };

    test("SI: at 844x390 #share-copy sits right of the deck strip and directly beside #settings-trigger", async () => {
      await freshLoad();
      try {
        await b.setViewport(844, 390, true);
        await b.settle();
        const m = await b.eval(`
          const r = (s) => { const q = document.querySelector(s).getBoundingClientRect(); return { l: q.left, r: q.right, t: q.top, b: q.bottom }; };
          return { decks: r("#decks"), share: r("#share-copy"), trig: r("#settings-trigger"),
                   order: getComputedStyle(document.getElementById("share-copy")).order };
        `);
        assert.strictEqual(m.order, "2");
        assert.ok(m.decks.r <= m.share.l + 1, `the icon is left of the strip's end: ${m.decks.r} vs ${m.share.l}`);
        assert.ok(m.share.r <= m.trig.l + 1, "the icon is not left of the settings trigger");
        assert.ok(m.trig.l - m.share.r <= 16, `something sits between the icon and the trigger: ${m.trig.l - m.share.r}px`);
        assert.ok(Math.abs(m.share.t - m.trig.t) <= 4, "the icon is not on the trigger's row");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("SI: while About is open #share-copy has an inert ancestor and a click at its position copies nothing", async () => {
      await freshLoad();
      await b.setViewport(380, 800, false);
      try {
        await b.settle();
        await b.eval(`window.__copied = 0;
          Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { window.__copied += 1; } }, configurable: true });
          return true;`);
        await openSettingsPanel();
        await b.eval(`document.getElementById("about-open").scrollIntoView({ block: "center" }); return true;`);
        await b.settle();
        await b.click("#about-open");
        await b.waitFor(`document.getElementById("about").hidden === false`, { label: "About to open" });
        await b.settle();
        assert.strictEqual(await b.eval(`return !!document.getElementById("share-copy").closest("[inert]")`), true, "no inert ancestor");
        assert.strictEqual(await b.eval(`const r = document.getElementById("share-copy").getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!(hit && hit.closest("#share-copy"))`), false, "the icon is hit-testable under About");
        await b.click("#share-copy");
        await b.settle();
        assert.strictEqual(await b.eval(`return window.__copied`), 0, "a click copied the link under About");
      } finally {
        await b.setViewport(900, 900, false);
      }
    });

    test("a #s= link boots a custom deck, keeps a #s= bar, and COPY LINK is live", async () => {
      const code = "4A4GpAI11Co13D214D215D216D217D211D213DGem2J49CGan2GenB30iCYmpB3GiDImsB3SxEmgT2O_m";
      await freshLoad();
      await navigate(URL + "?r=s#s=" + code);
      await b.settle();
      assert.match(await hash(), /^#s=/);
      assert.strictEqual(await b.eval(`return document.getElementById("share-copy").disabled`), false);
    });

    test("SV: a v4 link opens, the bar ends on v6, and Back leaves the page", async () => {
      const v4 = "4A4GpAI11Co13D214D215D216D217D211D213DGem2J49CGan2GenB30iCYmpB3GiDImsB3SxEmgT2O_m";
      const v6 = "#s=6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+9/parent-aeolian/mirror/between/seats-1,0,2,3,4,5,6,7;;/61d4aa";
      const nav = async () => {
        const h = await b.send("Page.getNavigationHistory");
        return { index: h.currentIndex, url: h.entries[h.currentIndex].url };
      };
      await freshLoad();
      await b.settle();
      await navigate(URL + "?r=sv#s=" + v4);
      await b.settle();
      await waitHash(v6, "the bar to be rewritten to the v6 code");
      const during = await nav();
      assert.ok(during.url.includes("?r=sv"), "the link's own page is not current");
      await b.eval(`history.back(); return true`);
      await new Promise((r) => setTimeout(r, 500));
      const left = await nav();
      assert.strictEqual(left.index, during.index - 1, "the rewrite added a history entry");
      assert.ok(!left.url.includes("?r=sv"), "Back did not leave the link's page");
    });

    test("FPD: a v5 link opens, the bar ends on v6, and Back leaves the page", async () => {
      const v5 = "5/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+9/parent-aeolian/mirror/between/seats-1,0,2,3,4,5,6,7;;/975b6c";
      const v6 = "#s=6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+9/parent-aeolian/mirror/between/seats-1,0,2,3,4,5,6,7;;/61d4aa";
      const nav = async () => {
        const h = await b.send("Page.getNavigationHistory");
        return { index: h.currentIndex, url: h.entries[h.currentIndex].url };
      };
      await freshLoad();
      await b.settle();
      await navigate(URL + "?r=fpd#s=" + v5);
      await b.settle();
      await waitHash(v6, "the bar to be rewritten to the v6 code");
      const during = await nav();
      assert.ok(during.url.includes("?r=fpd"), "the link's own page is not current");
      await b.eval(`history.back(); return true`);
      await new Promise((r) => setTimeout(r, 500));
      const left = await nav();
      assert.strictEqual(left.index, during.index - 1, "the rewrite added a history entry");
      assert.ok(!left.url.includes("?r=fpd"), "Back did not leave the link's page");
    });

    test("Back and Forward between two deck routes show each deck in turn", async () => {
      await freshLoad();
      await b.eval(`location.hash = ${JSON.stringify(HIJAZ)}; return true`);
      await waitChip(/hijaz/i, "Hijaz on");
      await b.eval(`location.hash = ${JSON.stringify(PYGMY)}; return true`);
      await waitChip(/pygmy/i, "Pygmy on");
      await b.eval(`history.back(); return true`);
      await waitChip(/hijaz/i, "Hijaz on after Back");
      await new Promise((r) => setTimeout(r, 300));
      assert.strictEqual(await hash(), HIJAZ);
      assert.match(await chipOn(), /hijaz/i);
      await b.eval(`history.forward(); return true`);
      await waitChip(/pygmy/i, "Pygmy on after Forward");
      await new Promise((r) => setTimeout(r, 300));
      assert.strictEqual(await hash(), PYGMY);
      assert.match(await chipOn(), /pygmy/i);
    });
  });

  /* ------------------------- TB: Scale and Layout tabs, the OR rule ----------
   * Lane T1 of docs/plans/2026-10-19-sheet-tabs.md (section 5.3). */
  describe("TB: Scale and Layout tabs", () => {
    const TB_KURD = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
    const frames = () => b.eval(`return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));`);
    const tbOpenAdd = async (w, h, scale = TB_KURD) => {
      await freshLoad();
      await b.setViewport(w, h, w < 1000);
      await b.settle();
      await openSheet();
      if (scale) await typeScale(scale);
      await frames();
    };
    const tbToLayout = async () => {
      await b.click("#scale-tab-layout");
      await b.waitFor(`!document.getElementById("scale-panel-layout").hidden`, { label: "the Layout tab" });
      await new Promise((r) => setTimeout(r, 250));
      await frames();
    };
    const rect = (sel) => b.eval(`const e = document.querySelector(${JSON.stringify(sel)});
      const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };`);
    const FLOORS = [[320, 568, 274], [380, 780, 334], [393, 852, 347], [844, 390, 274], [1280, 800, 478]];

  });

  describe("SPA: sheet polish lane A", () => {
    const SPA_SCALE = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
    const SPA_WARN = "Keep every note you can reach on the pan before you press the button below, because a note that is left out cannot be lit on its card";
    const SPA_ONE = "Keep every note you can reach";
    const SPA_MORE = " and the sheet keeps the message clear of the footer while it folds away and comes back again, so a long warning still reads in full above the buttons and never slides under the lip at any width";
    const titleSet = (t, re) => [...new Set([...t.name.matchAll(re)].map((m) => m[0]))].sort();
    const ranSet = (xs) => [...new Set(xs)].sort();
    const THREE = {};
    const calibrate = async () => {
      await b.eval(`say(${JSON.stringify(SPA_ONE)}, "warn"); return true;`);
      assert.strictEqual(await msgLines(), 1, "SPA_ONE is not one line");
      let text = SPA_WARN;
      const words = SPA_MORE.trim().split(" ");
      for (let i = 0; i <= words.length; i++) {
        await b.eval(`say(${JSON.stringify(text)}, "warn"); return true;`);
        const n = await msgLines();
        if (n === 3) { await b.eval(`say("", ""); return true;`); return text; }
        assert.ok(n < 3, `calibration overshot to ${n} lines`);
        text += " " + words[i];
      }
      assert.fail("no three-line text was reached");
    };
    const msgLines = () => b.eval(`const r = document.createRange(); r.selectNodeContents(document.getElementById("scale-msg")); return new Set([...r.getClientRects()].filter((x) => x.height > 0).map((x) => Math.round(x.top))).size;`);
    const VPS = [[320, 568], [380, 780], [390, 844], [844, 390]];
    const kbHeight = (w, h) => (h - (h >= 700 ? 336 : 260));
    const spaOpen = async (w, h, { edit = false, tab = "scale" } = {}) => {
      await freshLoad();
      await b.setViewport(w, h, w < 1000);
      await b.settle();
      if (edit) { await generate(SPA_SCALE); await openEdit(); }
      else { await openSheet(); await typeScale(SPA_SCALE); }
      if (tab === "layout") { await b.click("#scale-tab-layout"); await sleep(250); }
      await b.eval(`
        const s = document.getElementById("scale-sheet");
        window.__lip = [];
        let last = s.className;
        new MutationObserver(() => {
          const c = s.className;
          if (c === last) return;
          const had = (k) => last.split(" ").includes(k), has = (k) => c.split(" ").includes(k);
          if (had("lipped") !== has("lipped") || had("lipshut") !== has("lipshut")) window.__lip.push({ t: performance.now(), lipped: has("lipped"), shut: has("lipshut") });
          last = c;
        }).observe(s, { attributes: true, attributeFilter: ["class"] });
        return true;`);
      await sleep(80);
    };
    const spaReset = async () => {
      await b.send("Emulation.setEmulatedMedia", { media: "", features: [{ name: "prefers-reduced-motion", value: "no-preference" }] }).catch(() => {});
      await b.clearKeyboard().catch(() => {});
      await b.setViewport(900, 900, false);
    };
    const tabOn = (tab) => b.eval(`const t = document.getElementById("scale-tab-${tab}"), p = document.getElementById("scale-panel-${tab}"); return t.getAttribute("aria-selected") === "true" && !p.hidden;`);
    const rmOn = () => b.eval(`return matchMedia("(prefers-reduced-motion: reduce)").matches;`);
    const kbOn = () => b.eval(`return document.getElementById("scale-sheet").classList.contains("kbup");`);
    const shut = async () => { await b.eval(`collapseLip(); return true;`); await sleep(260); };
    const state = () => b.eval(`const s = document.getElementById("scale-sheet"); return { lipped: s.classList.contains("lipped"), shut: s.classList.contains("lipshut"), kbup: s.classList.contains("kbup"), flips: window.__lip.length };`);
    const px = (name) => b.eval(`
      const p = document.createElement("div");
      p.style.cssText = "position:absolute;visibility:hidden;width:0;height:var(${name})";
      document.body.appendChild(p);
      const h = p.getBoundingClientRect().height;
      p.remove();
      return h;`);
    const kbUp = async (w, h) => {
      await b.eval(`document.getElementById("scale-box").focus(); return true;`);
      await b.fakeKeyboard(kbHeight(w, h));
      await sleep(400);
    };
    const tapAt = async (x, y) => {
      for (const type of ["mousePressed", "mouseReleased"]) await b.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
      await sleep(250);
    };
    const PROBE = `
      window.__spa = {
        snap(t) {
          const q = (id) => document.getElementById(id);
          const rect = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; };
          const msg = q("scale-msg"), sheet = q("scale-sheet");
          let text = null;
          if (msg.textContent) {
            const r = document.createRange(); r.selectNodeContents(msg);
            const rs = [...r.getClientRects()].filter((x) => x.height > 0);
            if (rs.length) text = { top: Math.min(...rs.map((x) => x.top)), bottom: Math.max(...rs.map((x) => x.bottom)) };
          }
          const lipped = sheet.classList.contains("lipped");
          const clip = lipped ? rect(q("scale-footclip")) : null;
          const seen = (e) => {
            if (!e || e.hidden || getComputedStyle(e).visibility === "hidden") return null;
            let r = rect(e);
            if (clip) r = { top: Math.max(r.top, clip.top), bottom: Math.min(r.bottom, clip.bottom) };
            return r.bottom - r.top > 0.5 ? r : null;
          };
          const n = q("scale-next"), g = q("scale-generate");
          const lip = q("scale-lip");
          return { t, text, primary: seen(!n.hidden ? n : g), del: q("scale-delete-row").hidden ? null : seen(q("scale-delete")),
            zone: lip.hidden ? null : rect(lip), cls: sheet.className };
        },
        run(ms, steps) {
          return new Promise((res) => {
            const out = [], t0 = performance.now();
            const todo = steps.map((s) => ({ ...s, done: false }));
            const tick = () => {
              const t = performance.now() - t0;
              for (const s of todo) if (!s.done && t >= s.at) { s.done = true; new Function(s.code)(); }
              out.push(this.snap(Math.round(t)));
              if (t < ms) requestAnimationFrame(tick); else res(out);
            };
            requestAnimationFrame(tick);
          });
        },
      };
      return true;`;
    const hits = (f) => {
      const v = [];
      const over = (a, b2) => a && b2 && Math.min(a.bottom, b2.bottom) - Math.max(a.top, b2.top) > 1;
      if (over(f.text, f.primary)) v.push(`t=${f.t} text ${JSON.stringify(f.text)} over the primary ${JSON.stringify(f.primary)} [${f.cls}]`);
      if (over(f.text, f.del)) v.push(`t=${f.t} text ${JSON.stringify(f.text)} over DELETE ${JSON.stringify(f.del)} [${f.cls}]`);
      if (over(f.text, f.zone)) v.push(`t=${f.t} text ${JSON.stringify(f.text)} over the tap zone ${JSON.stringify(f.zone)} [${f.cls}]`);
      return v;
    };
    const lastControl = (open) => b.eval(`
      const body = document.querySelector("#scale-sheet .sheetbody");
      body.scrollTop = body.scrollHeight;
      const panel = document.querySelector('#scale-sheet [role=tabpanel]:not([hidden])');
      const seen = [...panel.querySelectorAll("button, input, textarea, select, a[href]")].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden" && !e.closest("[hidden]"));
      let last = null;
      for (const e of seen) if (!last || e.getBoundingClientRect().bottom > last.getBoundingClientRect().bottom) last = e;
      const r = last.getBoundingClientRect();
      let onLip = 0;
      for (const fx of [0.25, 0.5, 0.75]) for (const dy of [1, 3, 6]) {
        const t = document.elementFromPoint(r.left + r.width * fx, r.bottom - dy);
        if (t && t.closest("#scale-lip")) onLip += 1;
      }
      const lip = document.getElementById("scale-lip");
      return { id: last.id || last.className || last.tagName, bottom: r.bottom, body: body.getBoundingClientRect().bottom,
        zoneTop: lip.hidden ? null : lip.getBoundingClientRect().top, onLip, M: body.scrollHeight - body.clientHeight };`);

    const OF_NAMED = "(D3) C4 A3 D4 E4 F4 G4 A4 C5";
    const OF_HINT = "Top notes take their seats in the order listed. Rearrange them on the Layout tab.";

    const PD2_BASE = "(D3) A3 C4 D4 E4 F4 | F5 G5";
    const PD2_INNER = "(D3) A3 C4 D4 E4 F4 | G5 F5";
    const PD2_BOTH = "(D3) C4 A3 D4 E4 F4 | G5 F5";
    const PD2_SAID = "The rim now follows the order listed. The inner notes now follow the order listed.";
    const pd2Status = () => b.eval(`const e = document.getElementById("scale-drawer-status"); return {text:e.textContent,hidden:e.hidden};`);
    const pd2Edits = async () => { await typeScale(PD2_BASE); await typeScale(PD2_INNER); await typeScale(PD2_BOTH); };

    const msgState = () => b.eval(`
      const msg = document.getElementById("scale-msg"), lip = document.getElementById("scale-lip");
      const r = document.createRange(); r.selectNodeContents(msg);
      const rs = [...r.getClientRects()].filter((x) => x.height > 0);
      const bottom = Math.max(...rs.map((x) => x.bottom)), top = Math.min(...rs.map((x) => x.top));
      const left = Math.min(...rs.map((x) => x.left)), right = Math.max(...rs.map((x) => x.right));
      const hit = (x, y) => { const t = document.elementFromPoint(x, y); return !!(t && t.closest("#scale-guidance")); };
      const cx = (left + right) / 2;
      return { top, bottom, cx, zoneTop: lip.hidden ? null : lip.getBoundingClientRect().top,
        hitCentre: hit(cx, (top + bottom) / 2), hitBottom: hit(cx, bottom - 1), hitLeft: hit(left + 2, bottom - 1) };`);

    const CHANGES = {
      appear: { pre: `say("", "")`, change: `say(${JSON.stringify(SPA_WARN)}, "warn")` },
      clear: { pre: `say(${JSON.stringify(SPA_WARN)}, "warn")`, change: `say("", "")` },
      grow: { pre: `say(${JSON.stringify(SPA_ONE)}, "warn")`, change: (w) => `say(${JSON.stringify(THREE[w])}, "warn")` },
    };
    const LINES = { appear: [(n) => n === 0, (n) => n >= 1], clear: [(n) => n >= 1, (n) => n === 0], grow: [(n) => n === 1, (n) => n === 3] };
    const LINES_SAID = { appear: "0 to 1 or more", clear: "1 or more to 0", grow: "1 to 3" };
  });

  /* ------------------------- SPC: landscape Layout, plate pinned, footer capped ----
   * Lane SPC of docs/plans/2026-10-21-sheet-polish.md (section 3.3, D-3; owner Q1 "Pin + fit").
   * Baselines in C4 and C6 are the 81ad610 rects of Table M (rows Mc3-Mc7), re-measured on d4bfb86. */
  describe("SPC: landscape Layout, plate pinned, footer capped", () => {
    const SPC_KURD = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
    const STATES = ["no message", "a one-line notice", "a two-line warning", "the Edit delete refusal",
      "the refusal beside a notice", "a re-armed DELETE", "the notice with three ring-reset suffixes",
      "a multi-line drawer status from layoutStatus()"];
    const toLayout = async () => {
      await b.eval(`document.getElementById("scale-tab-layout").click(); return true;`);
      await b.waitFor(`!document.getElementById("scale-panel-layout").hidden`, { label: "the Layout tab" });
      await sleep(300);
    };
    const spcCreate = async (w = 844, h = 390) => {
      await freshLoad();
      await b.setViewport(w, h, true);
      await b.settle();
      await openSheet();
      await typeScale(SPC_KURD);
      await toLayout();
    };
    const spcEdit = async (w = 844, h = 390) => {
      await freshLoad();
      await b.eval(`localStorage.setItem("hpfc", ${JSON.stringify(JSON.stringify({ deck: "kurd", mode: "A", hidden: ["amara10", "amara", "hijaz", "pygmy"] }))}); return true;`);
      await clearSavedIdbForLegacyMigrationFixture();
      await navigate();
      assert.deepStrictEqual((await nativeSavedEnvelope(b)).hidden,["amara10","amara","hijaz","pygmy"],"fixture actually migrates the four hidden seeds, leaving only Kurd");
      await b.waitFor(`document.querySelectorAll("#decks .chip:not(#deck-add)").length > 0`, { label: "the chips" });
      await b.setViewport(w, h, true);
      await b.settle();
      await openEdit();
      await toLayout();
    };
    const probe = () => b.eval(`
      const h = (el) => (!el || el.hidden || getComputedStyle(el).display === "none") ? 0 : el.getBoundingClientRect().height;
      return { msg: h(msgLine), msgText: msgLine.textContent, note: h(layoutNote), noteText: layoutNote.textContent,
        delNote: document.getElementById("scale-del-note").textContent, status: h(drawerStatus), statusText: drawerStatus.textContent,
        guidance: document.getElementById("scale-guidance").getBoundingClientRect().height,
        deleteShown: !document.getElementById("scale-delete-row").hidden };`);
    const fitStatus = (n) => b.eval(`
      const w = "Swapped Eb5 and Ab4 so the bottom ring reads upward from the lowest seat on the right".split(" ");
      let t = "";
      for (let i = 0; i < 120; i += 1) {
        t += (i ? " " : "") + w[i % w.length];
        layoutStatus(t);
        if (drawerStatus.getBoundingClientRect().height >= ${n * SG_LINE} - 0.5) break;
      }
      return t;`);
    const fitSettled = async (which, n, prefix = "") => {
      const w = "Keep every note you can reach on the pan before you press the button below".split(" ");
      const el = which === "warn" ? "msgLine" : "layoutNote";
      let t = prefix;
      for (let i = 0; i < 80; i += 1) {
        t += (i || prefix ? " " : "") + w[i % w.length];
        await sgPut(which === "warn" ? { warn: t } : { note: t });
        await sleep(170);
        const h = await b.eval(`return ${el}.getBoundingClientRect().height;`);
        if (h >= n * SG_LINE - 0.5) return t;
      }
      throw new Error("could not fit " + n + " lines of " + which);
    };
    const REFUSAL = /Keep at least one scale/;
    const apply = async (state) => {
      const p0 = await probe();
      assert.strictEqual(p0.deleteShown, true, "DELETE THIS DECK is not shown on Edit");
      if (state === "no message") {
        assert.strictEqual(p0.guidance, 0, "the guidance slot holds something with no message");
        return;
      }
      if (state === "a one-line notice") await sgPut({ note: await sgFit("note", 1) });
      else if (state === "a two-line warning") await fitSettled("warn", 2);
      else if (state === "the Edit delete refusal") {
        await b.click("#scale-delete");
        await b.click("#scale-delete");
      } else if (state === "the refusal beside a notice") {
        await b.eval(`document.getElementById("scale-anchor-between").click(); return true;`);
        await b.settle();
        await b.click("#scale-delete");
        await b.click("#scale-delete");
      } else if (state === "a re-armed DELETE") {
        await b.click("#scale-delete");
        await b.click("#scale-delete");
        const text = await b.eval(`return msgLine.textContent;`);
        await b.eval(`say(${JSON.stringify(text)}, "warn"); return true;`);
        await b.click("#scale-delete");
      } else if (state === "the notice with three ring-reset suffixes") {
        const sfx = await b.eval(`return LAYOUT_RINGS.map((r) => " The " + r + " seats were reset.").join("");`);
        await fitSettled("note", 3, "Layout not saved yet. SAVE CHANGES keeps it." + sfx);
      } else if (state === "a multi-line drawer status from layoutStatus()") await fitStatus(3);
      else throw new Error("unknown state " + state);
      await b.settle();
      await sleep(150);
      const p = await probe();
      if (state === "a one-line notice") assert.ok(p.noteText.length > 0 && p.note > 17.5 && p.note < 30, `the notice is ${p.note}px: ${JSON.stringify(p)}`);
      if (state === "a two-line warning") assert.ok(p.msgText.length > 0 && p.msg >= 35.5, `the warning is ${p.msg}px: ${JSON.stringify(p)}`);
      if (state === "the Edit delete refusal") assert.ok(REFUSAL.test(p.msgText) && p.msg > 0, `no delete refusal: ${JSON.stringify(p)}`);
      if (state === "the refusal beside a notice") {
        assert.ok(REFUSAL.test(p.msgText) && p.msg > 0, `no delete refusal: ${JSON.stringify(p)}`);
        assert.ok(p.noteText.length > 0 && p.note > 0, `no notice beside it: ${JSON.stringify(p)}`);
        assert.ok(p.guidance >= p.msg + p.note - 0.5, `the slot is ${p.guidance}px for ${p.msg}px and ${p.note}px`);
      }
      if (state === "a re-armed DELETE") assert.ok(REFUSAL.test(p.msgText) && p.delNote.length > 0, `the re-arm wrote no note beside DELETE: ${JSON.stringify(p)}`);
      if (state === "the notice with three ring-reset suffixes") {
        assert.strictEqual((p.noteText.match(/seats were reset/g) || []).length, 3, `not three suffixes: ${p.noteText}`);
        assert.ok(p.note >= 53.5, `the notice is ${p.note}px, under three lines`);
      }
      if (state === "a multi-line drawer status from layoutStatus()") {
        assert.ok(p.statusText.length > 0 && p.status >= 53.5, `the status wraps to ${p.status}px, not more than one line (floor is 36px)`);
        assert.strictEqual(p.guidance, 0, "the guidance slot holds the drawer status");
      }
    };
    const measure = (call = "") => b.eval(`
      ${call}
      const r = (el) => { const q = el.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom, w: q.width, h: q.height }; };
      const body = document.querySelector(".sheetbody");
      return { body: r(body), port: body.clientHeight, st: body.scrollTop, M: body.scrollHeight - body.clientHeight,
        band: r(plateBand), pan: r(document.getElementById("scale-preview")),
        lipped: sheet.classList.contains("lipped"), shut: sheet.classList.contains("lipshut") };`);
    const scrollTo = async (where) => {
      await b.eval(`document.querySelector(".sheetbody").scrollTop = ${where === "end" ? 1e6 : 0}; return true;`);
      await sleep(120);
    };
    const shut = async () => {
      await b.eval(`collapseLip(); return true;`);
      await sleep(350);
    };

    const spcShutPan = (call = "") => b.eval(`${call}
      const q = document.getElementById("scale-preview").getBoundingClientRect();
      return { w: q.width, h: q.height, lipped: sheet.classList.contains("lipped"), shut: sheet.classList.contains("lipshut"),
        note: layoutNote.hidden ? "" : layoutNote.textContent };`);
    const spcRestoreTrace = (want, tag) => b.eval(`
      const out = [];
      const read = () => { const q = document.getElementById("scale-preview").getBoundingClientRect(); return Math.round(q.width * 10) / 10; };
      restoreLip();
      const t0 = performance.now();
      return new Promise((resolve) => {
        const tick = () => {
          out.push([Math.round(performance.now() - t0), read(), sheet.classList.contains("lipped")]);
          if (performance.now() - t0 < 520) setTimeout(tick, 20); else resolve(out);
        };
        tick();
      });`).then((trace) => {
      const bad = trace.filter(([, w]) => Math.abs(w - want) > 0.5);
      assert.ok(trace.some(([, , lipped]) => !lipped), `${tag}: the footer never finished opening`);
      assert.deepStrictEqual(bad, [], `${tag}: the pan is not ${want}px at every frame of the restore, trace [ms, width, lipped]: ${JSON.stringify(trace.filter((x, i, a) => i === 0 || x[1] !== a[i - 1][1] || x[2] !== a[i - 1][2]))}`);
    });

    const spcSlide = (call, midCall = "", midAt = 60) => b.eval(`
      const foot = document.getElementById("scale-footslide"), g = document.getElementById("scale-guidance");
      const ev = [], samples = [];
      const names = ["transitionrun", "transitionend", "transitioncancel"];
      const log = (e) => { if (e.propertyName === "transform" || e.propertyName === "visibility") ev.push([e.type, e.target === foot ? "foot" : "guidance", e.propertyName, Math.round(performance.now() - t0)]); };
      for (const el of [foot, g]) for (const n of names) el.addEventListener(n, log);
      const ty = (el) => new DOMMatrix(getComputedStyle(el).transform).m42;
      const t0 = performance.now();
      ${call}
      ${midCall ? `setTimeout(() => { ${midCall} }, ${midAt});` : ""}
      return new Promise((resolve) => {
        const frame = () => {
          const t = performance.now() - t0;
          samples.push([Math.round(t), Math.round(ty(foot) * 10) / 10, Math.round(ty(g) * 10) / 10, getComputedStyle(foot).visibility]);
          if (t < 600) requestAnimationFrame(frame); else resolve({ ev, samples });
        };
        requestAnimationFrame(frame);
      });`);
    const spcAssertSlide = (r, tag, hides) => {
      const cancels = r.ev.filter((e) => e[0] === "transitioncancel");
      assert.deepStrictEqual(cancels, [], `${tag}: the slide was cancelled, events [type, element, property, ms]: ${JSON.stringify(r.ev)}`);
      assert.ok(r.ev.some((e) => e[0] === "transitionend" && e[1] === "foot" && e[2] === "transform" && e[3] >= 120), `${tag}: #scale-footslide never ended its transform transition after the 180ms slide: ${JSON.stringify(r.ev)}`);
      const fy = r.samples.map((s) => s[1]);
      const lo = Math.min(...fy), hi = Math.max(...fy);
      assert.ok(hi - lo > 8, `${tag}: #scale-footslide moved only ${hi - lo}px`);
      const mid = new Set(fy.filter((v) => v > lo + 1 && v < hi - 1));
      assert.ok(mid.size >= 2, `${tag}: #scale-footslide jumped from ${lo} to ${hi} without easing, transforms across frames ${JSON.stringify(r.samples.slice(0, 16).map((s) => [s[0], s[1]]))}`);
      const gy = r.samples.map((s) => s[2]);
      const glo = Math.min(...gy), ghi = Math.max(...gy);
      if (ghi - glo > 8) assert.ok(new Set(gy.filter((v) => v > glo + 1 && v < ghi - 1)).size >= 2, `${tag}: the guidance jumped from ${glo} to ${ghi} without easing`);
      if (hides) {
        const first = r.samples.find((s) => s[3] === "hidden");
        assert.ok(first && first[0] >= 140, `${tag}: #scale-footslide went hidden at ${first && first[0]}ms, not at the end of the slide`);
      }
    };

    /* Regroup (review 4): the open-footer room is derived (lipDelta), never measured, so a guidance or viewport change
     * in ANY lip state sizes the pan at the event. The lip is driven by real CDP wheel events. A wheel scroll right after
     * a collapse or restore first re-bases lipScroll's range (the range differs shut and open), so a -10 primer
     * precedes the -100 that restores. The reversing gesture cancels the running transition by spec (2 cancels in
     * SHUT-rev, 3 in OPENING-rev, measured with no event); the app's own cancels are counted after the retargeted
     * slide's transitionrun, once the log is cleared. */
    const spcWheel = (dy) => b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 300, y: 200, deltaX: 0, deltaY: dy });
    const spcPrime = () => spcWheel(-10);
    const spcLog = () => b.eval(`
      window.__spcEv = [];
      if (!window.__spcLogged) {
        window.__spcLogged = true;
        const f = document.getElementById("scale-footslide"), g = document.getElementById("scale-guidance");
        for (const n of ["transitionrun", "transitioncancel"]) for (const el of [f, g]) el.addEventListener(n, (e) => {
          if (e.propertyName === "transform" || e.propertyName === "visibility") window.__spcEv.push([e.type, e.target === f ? "foot" : "guidance", e.propertyName, Math.round(performance.now())]);
        });
      }
      return true;`);
    const spcGesture = async (dy) => {
      await b.eval(`window.__spcMark = performance.now(); return true;`);
      await spcWheel(dy);
      await b.waitFor(`window.__spcEv.some((e) => e[0] === "transitionrun" && e[1] === "foot" && e[2] === "transform" && e[3] >= window.__spcMark)`, { label: "the retargeted slide's transitionrun" });
    };
    const spcClearLog = () => b.eval(`const n = window.__spcEv.filter((e) => e[0] === "transitioncancel").length; window.__spcEv.length = 0; return n;`);
    const spcDrive = async (state) => {
      await spcLog();
      if (state === "SHUTTING") { await spcGesture(100); return spcClearLog(); }
      if (state === "OPENING-rev") {
        await spcWheel(100);
        await sleep(25);
        await spcPrime();
        await sleep(25);
        await spcGesture(-100);
        return spcClearLog();
      }
      await spcWheel(100);
      await sleep(400);
      await spcPrime();
      await sleep(100);
      if (state === "OPENING") { await spcGesture(-100); return spcClearLog(); }
      await spcWheel(-100);
      await sleep(40);
      await spcGesture(100);
      const pre = await spcClearLog();
      await sleep(400);
      return pre;
    };
    const spcSampler = (ms) => b.eval(`
      window.__spcW = [];
      const t0 = performance.now();
      const f = () => {
        const t = performance.now(), body = document.querySelector(".sheetbody");
        window.__spcW.push([Math.round(t), Math.round(document.getElementById("scale-preview").getBoundingClientRect().width * 10) / 10,
          sheet.classList.contains("lipped"), sheet.classList.contains("lipshut"), Math.round(plateBand.getBoundingClientRect().bottom * 10) / 10, Math.round(body.getBoundingClientRect().bottom * 10) / 10]);
        if (t - t0 < ${ms}) requestAnimationFrame(f); else window.__spcDone = true;
      };
      window.__spcDone = false;
      requestAnimationFrame(f);
      return true;`);
    const SPC_WARN = "Crowded pan: the labels are small. Keep every note you can reach on the pan before you press the button below, and a few more words so that this line wraps onto a second line even on a wide sheet.";
    const spcFire = async (ev) => {
      const mark = `window.__spcT = performance.now();`;
      if (ev === "notice") await b.eval(`${mark} document.getElementById("scale-anchor-between").click(); return true;`);
      else if (ev === "clear") await b.eval(`${mark} document.getElementById("scale-anchor-one").click(); return true;`);
      else if (ev === "warn") await b.eval(`${mark} say(${JSON.stringify(SPC_WARN)}, "warn"); return true;`);
      else if (ev === "rotate") { await b.eval(`${mark} return true;`); await b.setViewport(740, 360, true); }
      else throw new Error("unknown event " + ev);
    };
    const spcPan = () => b.eval(`return Math.round(document.getElementById("scale-preview").getBoundingClientRect().width * 10) / 10;`);
    /* One cell: drive to `state`, fire `ev`, sample every frame, restore if still shut, and judge the samples. */
    const spcCell = async (mode, state, ev) => {
      if (mode === "create") await spcCreate(); else await spcEdit();
      if (ev === "clear") {
        await b.eval(`document.getElementById("scale-anchor-between").click(); return true;`);
        await b.settle();
        await sleep(300);
      }
      const before = await spcPan();
      const gestureCancels = await spcDrive(state);
      await spcSampler(1000);
      await spcFire(ev);
      await sleep(state === "OPENING" || state === "OPENING-rev" ? 260 : 150);
      const mid = await b.eval(`return { lipped: sheet.classList.contains("lipped"), shut: sheet.classList.contains("lipshut") };`);
      if (mid.lipped) {
        await spcPrime();
        await sleep(100);
        await spcWheel(-100);
      }
      await sleep(480);
      const r = await b.eval(`return { T: window.__spcT, W: window.__spcW, cancels: window.__spcEv.filter((e) => e[0] === "transitioncancel"), ev: window.__spcEv };`);
      return { before, gestureCancels, mid, ...r };
    };
    const spcJudge = (tag, c, { within = 50 } = {}) => {
      const last = c.W[c.W.length - 1];
      assert.strictEqual(last[2], false, `${tag}: the footer never finished opening, last sample ${JSON.stringify(last)}`);
      const want = last[1];
      assert.ok(Math.abs(want - c.before) > 4, `${tag}: the event did not change the open-footer size (${c.before} before, ${want} after)`);
      const after = c.W.filter((s) => s[0] >= c.T);
      const reached = after.find((s) => Math.abs(s[1] - want) <= 0.5);
      const trace = JSON.stringify(after.filter((x, i, a) => i === 0 || x[1] !== a[i - 1][1] || x[2] !== a[i - 1][2] || x[3] !== a[i - 1][3]).map((s) => [s[0] - Math.round(c.T), s[1], s[2] ? (s[3] ? "S" : "O") : "-"]));
      assert.ok(reached, `${tag}: the pan never reached ${want}px, trace [ms from the event, width, S shut / O opening / - open]: ${trace}`);
      assert.ok(reached[2], `${tag}: the pan reached ${want}px only after the footer opened: it resized at the restore, not at the event, trace [ms, width, state]: ${trace}`);
      assert.ok(reached[0] - c.T <= within, `${tag}: the pan took ${Math.round(reached[0] - c.T)}ms to reach ${want}px after the event, more than ${within}ms, trace [ms, width, state]: ${trace}`);
      const wobble = after.filter((s) => s[0] > reached[0] && Math.abs(s[1] - want) > 0.5);
      assert.deepStrictEqual(wobble, [], `${tag}: the pan changed after it reached ${want}px, trace [ms, width, state]: ${trace}`);
      /* A rAF callback runs before the frame's ResizeObserver delivery, so the event's own first frame is unpainted layout: skip it. */
      const past = after.filter((s) => s[0] > c.T + 20 && s[2] && s[4] > s[5] + 0.5);
      assert.deepStrictEqual(past, [], `${tag}: the plate band ends below the scrollport while the footer is lipped, samples [t, w, lipped, shut, band bottom, port bottom]: ${JSON.stringify(past.slice(0, 3))}`);
      assert.deepStrictEqual(c.cancels, [], `${tag}: the app cancelled the slide after the gesture's own ${c.gestureCancels} cancels, events [type, element, property, ms]: ${JSON.stringify(c.ev)}`);
      console.log(`${tag}: reversing gesture cancelled ${c.gestureCancels} transitions (the control); pan ${c.before} -> ${want} in ${Math.round(reached[0] - c.T)}ms`);
    };

    /* A guard on the identity the derivation rests on: the shut pan equals the open-footer pan at landscape
     * viewports. The footer is collapsed and restored through collapseLip/restoreLip; no timing is under test here. */
  });

  describe("UX: the footer lip", () => {
    const LIP_KURD = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
    const SIZES = [[380, 780], [320, 568], [393, 852], [844, 390], [1280, 800]];
    const LIP_CROWDED = "(C3) D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6 D6 E6 F6";
    const lipOpen = async (w, h, { edit = false, spacer = 900, scale = LIP_KURD } = {}) => {
      await freshLoad();
      await b.setViewport(w, h, w < 1000);
      await b.settle();
      if (edit) { await generate(scale); await openEdit(); }
      else { await openSheet(); await typeScale(scale); }
      await b.eval(`
        const p = document.getElementById("scale-panel-scale");
        if (${spacer} > 0) { const d = document.createElement("div"); d.id = "lip-spacer"; d.style.height = "${spacer}px"; p.appendChild(d); }
        const s = document.getElementById("scale-sheet");
        window.__lip = [];
        let last = s.className;
        new MutationObserver(() => {
          const c = s.className;
          if (c === last) return;
          const had = (k) => last.split(" ").includes(k), has = (k) => c.split(" ").includes(k);
          if (had("lipped") !== has("lipped") || had("lipshut") !== has("lipshut")) {
            window.__lip.push({ t: performance.now(), lipped: has("lipped"), shut: has("lipshut") });
          }
          last = c;
        }).observe(s, { attributes: true, attributeFilter: ["class"] });
        return true;`);
      await sleep(150);
    };
    const lipState = () => b.eval(`
      const s = document.getElementById("scale-sheet");
      const body = document.querySelector("#scale-sheet .sheetbody");
      return { lipped: s.classList.contains("lipped"), shut: s.classList.contains("lipshut"),
        M: body.scrollHeight - body.clientHeight, top: body.scrollTop, flips: window.__lip.filter((e) => e.lipped !== undefined).length,
        lippedFlips: (() => { let n = 0, prev = false; for (const e of window.__lip) { if (e.lipped !== prev) n += 1; prev = e.lipped; } return n; })() };`);
    const bodyBox = () => b.eval(`const r = document.querySelector("#scale-sheet .sheetbody").getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height };`);
    const swipeBody = async (dy, ms = 90) => {
      const bb = await bodyBox();
      const steps = 6;
      const pts = [];
      for (let i = 1; i <= steps; i++) pts.push([0, Math.round((ms * i) / steps), Math.round((dy * i) / steps)]);
      pts.push([0, ms + 250, dy]);
      const y0 = await b.eval(`
        const body = document.querySelector(".sheetbody"), r = body.getBoundingClientRect(), x = r.left + r.width / 2;
        for (let y = r.top + r.height * 0.8; y > r.top + 4; y -= 4) {
          const clear = [[0, 0], [0, -24], [0, 24], [-24, 0], [24, 0]].every(([dx, dy]) => {
            const t = document.elementFromPoint(x + dx, y + dy);
            return t && body.contains(t) && !t.closest("#scale-lip, #scale-preview, input, textarea, select");
          });
          if (clear) return Math.round(y - (r.top + r.height / 2));
        }
        return ${Math.round(bb.h * 0.3)};`);
      await b.drag(".sheetbody", pts, { y0 });
      await sleep(300);
    };
    const collapse = async () => { await swipeBody(-140); };
    const restoreBySwipe = async () => { await swipeBody(140); };
    const slideWithin = async (ms, label, act, doneExpr) => {
      await b.waitFor(`document.getElementById("scale-footslide").getAnimations().length === 0`, { timeout: 3000, label: label + ": an earlier footslide transition to settle" });
      await b.eval(`window.__slideN0 = window.__lip.length; window.__slideAct = performance.now(); window.__slideEnd = new Promise((r) => { const f = document.getElementById("scale-footslide"); f.addEventListener("transitionend", function on(e) { if (e.target !== f || e.propertyName !== "transform" || e.elapsedTime < ${LIP_SLIDE_END_S} || e.timeStamp < window.__slideAct) return; f.removeEventListener("transitionend", on); r(performance.now()); }); }); return true;`);
      const t0 = Date.now();
      await act();
      await b.eval(`return Promise.race([window.__slideEnd, new Promise((_, rej) => setTimeout(() => rej(new Error(${JSON.stringify(label)} + ": no footslide transitionend within ${ms}ms")), ${ms}))]);`);
      await b.waitFor(doneExpr, { timeout: Math.max(40, ms - (Date.now() - t0)), label: label + " within " + ms + "ms" });
      const m = await b.eval(`const n = window.__lip.slice(window.__slideN0); return window.__slideEnd.then((end) => ({ start: n.length ? n[0].t : null, end, off: (n.find((e) => !e.lipped) || {}).t ?? null }));`);
      assert.ok(m.start !== null, `${label}: no lip flip was logged`);
      assert.ok(m.end - m.start <= LIP_SLIDE_MS + 80, `${label}: the footslide transition ended ${Math.round(m.end - m.start)}ms after the flip, over ${LIP_SLIDE_MS}ms + 80`);
      assert.ok(m.off === null || m.off - m.start <= LIP_END_MS + 80, `${label}: the lipped class lapsed ${Math.round(m.off - m.start)}ms after the flip, over ${LIP_END_MS}ms + 80`);
    };
    const tapAt = async (x, y) => {
      for (const type of ["mousePressed", "mouseReleased"]) {
        await b.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
      }
      await sleep(400);
    };
    const lipDiag = () => b.eval(`const s = document.getElementById("scale-sheet"), f = document.getElementById("scale-foot").getBoundingClientRect(), l = document.getElementById("scale-lip").getBoundingClientRect(); return JSON.stringify({ cls: s.className, ih: innerHeight, vv: visualViewport.height, foot: [f.top, f.bottom], lip: [l.top, l.bottom, document.getElementById("scale-lip").hidden], top: (document.elementFromPoint(190, l.top + 2) || {}).id });`);
    const primaryRect = () => b.eval(`
      const n = document.getElementById("scale-next"), g = document.getElementById("scale-generate");
      const e = !n.hidden ? n : g; const r = e.getBoundingClientRect();
      return { id: e.id, top: r.top, bottom: r.bottom };`);
    const lipRect = () => b.eval(`const r = document.getElementById("scale-lip").getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width, h: r.height };`);
    const reset = async () => {
      await b.send("Emulation.setEmulatedMedia", { media: "", features: [{ name: "prefers-reduced-motion", value: "no-preference" }] }).catch(() => {});
      await b.clearKeyboard().catch(() => {});
      await b.setViewport(900, 900, false);
    };

    const gap = () => b.eval(`
      const body = document.querySelector("#scale-sheet .sheetbody");
      const surf = document.querySelector("#scale-sheet .sheetsurf") || document.getElementById("scale-sheet");
      return { M: body.scrollHeight - body.clientHeight, E: surf.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom };`);
    const pull = async (dy, { sel = "#scale-tabs", y0 = 0, ms = 90 } = {}) => {
      const pts = [];
      for (let i = 1; i <= 6; i++) pts.push([0, Math.round((ms * i) / 6), Math.round((dy * i) / 6)]);
      await b.drag(sel, pts, { y0 });
      await sleep(350);
    };
    const wheelBody = async (dy) => {
      const bb = await bodyBox();
      await b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 150, y: Math.round(bb.top + bb.h / 2), deltaX: 0, deltaY: dy });
      await sleep(400);
    };
    const finger2 = (type, pts) => b.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 4, radiusY: 4, force: 1 })) });

    const lgWatch = () => b.eval(`
      window.__lg = { clicks: 0, focusin: 0 };
      document.addEventListener("click", () => { window.__lg.clicks += 1; }, true);
      document.addEventListener("focusin", () => { window.__lg.focusin += 1; }, true);
      return true;`);
    const lgSeen = () => b.eval(`return { clicks: window.__lg.clicks, focusin: window.__lg.focusin, active: (document.activeElement || {}).id || document.activeElement.tagName };`);
    const lgDrag = async (sel, dy, { ms = 90 } = {}) => {
      const pts = [];
      for (let i = 1; i <= 6; i++) pts.push([0, Math.round((ms * i) / 6), Math.round((dy * i) / 6)]);
      await b.drag(sel, pts, { y0: 0 });
      await waitFlingSettled("the drag's momentum and the footer slide");
    };
    const lgReplay = async (ctx, w, h, sel, dy, startShut) => {
      await lipOpen(w, h, { spacer: 900 });
      await lgWatch();
      if (startShut) {
        await wheelBody(300);
        await wheelBody(300);
        assert.ok((await lipState()).shut, `${ctx}: the footer did not shut first`);
      }
      const hit = await b.eval(`
        const el = document.querySelector(${JSON.stringify(sel)}), body = document.querySelector("#scale-sheet .sheetbody");
        if (${startShut ? "true" : "false"}) body.scrollTop = Math.min(258, body.scrollHeight - body.clientHeight);
        else { const r0 = el.getBoundingClientRect(), b0 = body.getBoundingClientRect(); if (r0.top < b0.top || r0.bottom > b0.bottom) el.scrollIntoView({ block: "nearest" }); }
        const r = el.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { ok: !!t && (t === el || el.contains(t)), top: body.scrollTop };`);
      await sleep(400);
      const before = await lipState();
      const seen0 = await lgSeen();
      if (!hit.ok) return { skipped: true, ctx };
      await lgDrag(sel, dy);
      const after = await lipState();
      const seen = await lgSeen();
      return { skipped: false, ctx, flips: after.lippedFlips - before.lippedFlips, shut: after.shut, lipped: after.lipped, seen0, seen };
    };

    const focusPrimary = () => b.eval(`const n = document.getElementById("scale-next"), g = document.getElementById("scale-generate"); const e = !n.hidden ? n : g; e.focus(); return document.activeElement.id;`);
    const activeId = () => b.eval(`return document.activeElement && document.activeElement.id;`);
  });

  describe("FPD: the bottom ring slides under a real finger and mouse", () => {
    const FPD_SCALE = "[C3] [D3] [E3] (A3) C4 D4 E4 F4";
    const open = async (w, h, mobile) => {
      await freshLoad();
      await b.setViewport(w, h, mobile);
      await b.settle();
      await openSheet();
      await typeScale(FPD_SCALE);
      await openDrawer();
      await b.settle();
    };
    const hits = () => b.eval(`
      const svg = document.querySelector("#scale-preview svg");
      return [...document.querySelectorAll("#scale-preview .panhit")].map((h) => {
        const r = h.getBoundingClientRect();
        return { name: h.getAttribute("aria-label").split(",")[0], ring: h.getAttribute("data-ring"),
          cx: Number(h.getAttribute("cx")), cy: Number(h.getAttribute("cy")), ar: Number(h.getAttribute("r")),
          x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, r: (r.right - r.left) / 2 };
      });`);
    const frame = async () => {
      const all = await hits();
      const h = all[0];
      const k = h.r / h.ar;
      const o = { x: h.x - k * h.cx, y: h.y - k * h.cy };
      const bottom = all.filter((n) => n.ring === "bottom")[0];
      return { all, k, o, orbit: Math.hypot(bottom.cx, bottom.cy) };
    };
    const at = (f, deg, rad = f.orbit) => ({ x: f.o.x + f.k * rad * Math.cos(deg * Math.PI / 180), y: f.o.y - f.k * rad * Math.sin(deg * Math.PI / 180) });
    const named = (all, n) => all.find((x) => x.name === n);
    const status = () => b.eval(`return document.getElementById("scale-drawer-status").textContent;`);
    const warned = () => b.eval(`return document.getElementById("scale-drawer-status").classList.contains("warn");`);
    const ghostCount = () => b.eval(`return document.querySelectorAll(".panghost").length;`);
    const sheetState = () => b.eval(`const s = document.getElementById("scale-sheet"); const body = document.querySelector("#scale-sheet .sheetbody");
      return { cls: ["lipped", "lipshut"].map((k) => s.classList.contains(k)).join(), top: body.scrollTop, drawer: document.getElementById("scale-panel-layout").scrollTop };`);
    const touch = (type, pts) => b.send("Input.dispatchTouchEvent", {
      type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, radiusX: 4, radiusY: 4, force: 1, id: i + 1 })) });
    const touchPath = async (from, path, { hold = 320, release = true } = {}) => {
      await touch("touchStart", [from]);
      await sleep(hold);
      for (const p of path) await touch("touchMove", [{ x: p.x, y: p.y + 36 }]);
      if (release) await touch("touchEnd", []);
      await sleep(120);
    };
    const arc = (f, a, c, n = 6) => Array.from({ length: n }, (_, i) => at(f, a + ((c - a) * (i + 1)) / n));
    const mouse = (type, x, y, extra = {}) => b.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1, ...extra });
    const near = (p, q, tol, msg) => assert.ok(Math.hypot(p.x - q.x, p.y - q.y) <= tol, `${msg}: ${JSON.stringify(p)} vs ${JSON.stringify(q)}`);

  });
  /* SHC: two native journeys. API sinks never touch the OS clipboard/picker.
   * Promise drains finish even when suppression causes no DOM mutation. */
  describe("SHC native LINK ownership", () => {
    const HASH = "#s=6/uC3_uDb3_uEb3_(F3)_G3_Ab3_uBb3_C4_uDb4_Eb4_F4_G4_Ab4_C5_Eb5_-_F5_G5_uAb5/*F+AEOLIAN+12/between/at-,225,,20,,130/5af123";
    const query = "?share=public-control";
    const expectedOptions = [295, 225, null, 20, null, 130];
    const expectedPositions = { C3: 295, Db3: 225, Eb3: 0, Bb3: 20, Db4: 60, Ab5: 130 };
    // b.click dispatches trusted mouse input at the element's centre; it
    // neither scrolls nor checks that another layer would receive that input.
    // Keep this preflight local to these journeys and fail with an assertion
    // before any input if the intended target is not actually usable.
    const trustedClick = async (selector) => {
      await b.eval(`const el = document.querySelector(${JSON.stringify(selector)});
        if (el) el.scrollIntoView({block:"nearest",inline:"nearest",behavior:"instant"});
        return !!el;`);
      await b.settle();
      const target = await b.eval(`
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return {found:false};
        const r = el.getBoundingClientRect(), x = r.left + r.width/2, y = r.top + r.height/2;
        const style = getComputedStyle(el), hit = document.elementFromPoint(x,y);
        return {found:true, enabled:!el.matches(":disabled"), inert:!!el.closest("[inert]"),
          visible:el.getClientRects().length>0 && style.display!=="none" && style.visibility!=="hidden" && r.width>0 && r.height>0,
          inViewport:x>=0 && y>=0 && x<innerWidth && y<innerHeight,
          hit:!!hit && (hit===el || el.contains(hit))};
      `);
      assert.deepStrictEqual(target, {found:true,enabled:true,inert:false,visible:true,inViewport:true,hit:true},
        "SHC trusted click target must be enabled, visible and hit-testable: " + selector);
      await b.click(selector);
    };
    const enterEdit = async () => {
      await trustedClick("#decks .chip.on");
      await b.waitFor(`!document.getElementById("scale-sheet").hidden`, {label:"SHC actual Edit entry"});
    };
    const enterLayout = async () => {
      await trustedClick("#scale-tab-layout");
      await b.waitFor(`!document.getElementById("scale-panel-layout").hidden`, {label:"SHC actual Layout tab"});
    };
    const install = () => b.eval(`
      window.__shc = { calls: [], order: [] };
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        writeText: (payload) => new Promise((resolve, reject) => {
          __shc.calls.push({payload, href: location.href, resolve, reject});
          __shc.order.push("copy" + __shc.calls.length);
        })
      }});
      window.addEventListener("popstate", () => __shc.order.push("pop"));
      return true;
    `);
    const clickLink = async (count) => {
      await trustedClick("#share-copy");
      await b.waitFor(`__shc.calls.length === ${count}`, { label: "SHC intercepted LINK " + count });
    };
    const complete = (index, success) => b.eval(`return (async () => {
      __shc.calls[${index}].${success ? "resolve()" : 'reject(new Error("controlled denial"))'};
      await Promise.resolve();
      await new Promise(resolve => setTimeout(resolve, 0));
      await new Promise(resolve => setTimeout(resolve, 0));
      return true;
    })();`);
    const snapshot = () => b.eval(`return ${nativeSavedExpression()}.then(persisted=>{
      const saved=JSON.parse(persisted.raw),input = document.getElementById("share-url");
      return { hidden: input.hidden, value: input.value, focus: document.activeElement.id,
        notice: document.querySelector(".announce").textContent,
        start: input.selectionStart, end: input.selectionEnd, readonly: input.readOnly,
        href: location.href, options: deck().options.angles.bottom,
        records: saved.entries,
        selectedRecord: saved.entries.find(row=>row.instanceId===selection.id).record,
        calls: __shc.calls.map(c => ({payload:c.payload,href:c.href})), order: __shc.order.slice() };
    });`);
    const showFine = async () => {
      await enterLayout();
      await trustedClick("#scale-fine-toggle");
      await b.waitFor(`!document.getElementById("scale-fine").hidden`, { label: "SHC finer controls" });
    };
    const assertDrawnPositions = async () => {
      const positions = await b.eval(`return Object.fromEntries([...document.querySelectorAll('#scale-preview .panhit[data-ring="bottom"]')].map(el => {
        const pitch = el.getAttribute("aria-label").split(",")[0];
        const angle = (Math.atan2(-Number(el.getAttribute("cy")), Number(el.getAttribute("cx"))) * 180 / Math.PI + 360) % 360;
        return [pitch, angle];
      }));`);
      assert.deepStrictEqual(Object.keys(positions).sort(), Object.keys(expectedPositions).sort());
      for (const [pitch, angle] of Object.entries(expectedPositions)) {
        const delta = Math.abs(((positions[pitch] - angle + 540) % 360) - 180);
        assert.ok(delta < 0.1, "fresh receiver drawn pitch " + pitch + " must be at " + angle + " degrees");
      }
    };

  });

  /* SAVED-SCALE-VARIANTS — six actual browser groups. Two-target tests use one
   * owned Chrome/profile and real Web Locks, not two isolated launch() profiles.
   * Peer RPCs reuse the existing driver's pending map. rawSend creates its CDP
   * payload synchronously; restore sessionId before awaiting any response.
   * Root alone executes this suite under the serialized host-browser lease.
   */
  {
    const SV = JSON.parse(fs.readFileSync(path.join(REPO,"tests/fixtures/saved_variants_v1.json"),"utf8"));
    const KEY="hpfc.saved-scales.v1",LOCK="handpan-cards:saved-scales:v1";
    const clone=v=>JSON.parse(JSON.stringify(v));
    const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
    const makeEnvelope=(records,extra={})=>({schema:1,collectionId:SV.ids.collectionA,revision:1,slotStateRevision:0,
      entries:records.map((record,i)=>({instanceId:uid(i+1),revision:1,displayOrdinal:i+1,record:clone(record)})),
      usedInstanceIds:records.map((_,i)=>uid(i+1)),nextDisplayOrdinal:records.length+1,
      preferredSelection:records.length?{kind:"saved",id:uid(1)}:{kind:"builtin",id:"kurd"},slots:{},hidden:[],
      migration:{sourceKey:null,raw:{hpfc:null,"hpfc.scales":null,"hpfc.scales.v3":null},instanceIds:[]},...clone(extra)});
    function session(id,owner=b) {
      const send=(method,params={})=>{const previous=owner.sessionId;owner.sessionId=id;
        try{return owner.rawSend(method,params);}finally{owner.sessionId=previous;}};
      const evaluate=async body=>{const r=await send("Runtime.evaluate",{expression:`(() => { ${body} })()`,awaitPromise:true,returnByValue:true});
        assert.ok(!r.exceptionDetails,"SV page evaluation must complete without an uncaught error: "+JSON.stringify(r.exceptionDetails));return r.result.value;};
      const wait=async(expr,label,timeout=5000)=>{const deadline=Date.now()+timeout;for(;;){if(await evaluate(`return Promise.resolve(${expr}).then(Boolean);`))return;
        if(Date.now()>deadline)throw new Error("SV readiness deadline: "+label);await sleep(20);}};
      const click=async selector=>{await send("Page.bringToFront");
        const point=await evaluate(`const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;
          el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});const r=el.getBoundingClientRect();
          const x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);
          return {x,y,w:r.width,h:r.height,hit:!!hit&&(el===hit||el.contains(hit)),disabled:el.disabled===true};`);
        const usable=await evaluate(`const el=document.querySelector(${JSON.stringify(selector)});if(!el)return false;
          for(let n=el;n;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return false;}
          const r=el.getBoundingClientRect();return !el.closest('[inert]')&&r.left+r.width/2>=0&&r.top+r.height/2>=0&&r.left+r.width/2<innerWidth&&r.top+r.height/2<innerHeight;`);
        assert.ok(point&&point.w>0&&point.h>0&&point.hit&&!point.disabled&&usable,"SV trusted click target must be visible/enabled/not inert and hit-testable: "+selector);
        await send("Input.dispatchMouseEvent",{type:"mousePressed",x:point.x,y:point.y,button:"left",clickCount:1});
        await send("Input.dispatchMouseEvent",{type:"mouseReleased",x:point.x,y:point.y,button:"left",clickCount:1});};
      const type=async(selector,text)=>{await click(selector);await send("Input.dispatchKeyEvent",{type:"keyDown",key:"a",code:"KeyA",commands:["selectAll"]});
        await send("Input.dispatchKeyEvent",{type:"keyUp",key:"a",code:"KeyA"});await send("Input.insertText",{text});};
      const key=async(key,code,keyCode)=>{await send("Page.bringToFront");
        for(const type of key==="Enter"?["rawKeyDown","char","keyUp"]:["keyDown","keyUp"])
          await send("Input.dispatchKeyEvent",{type,key,code,...(type==="char"?{text:"\r",unmodifiedText:"\r"}:{}),windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode});};
      return {id,send,eval:evaluate,wait,click,type,key};
    }
    const read=p=>nativeSavedEnvelope(p);
    const importRecord=(p,record)=>p.eval(`const r=${JSON.stringify(record)},s=HPE.core.parseSeed(r.s);
      const code=HPE.share.encode({fields:s.value.fields,options:r.o||{}});return openShare(code.value);`);
    const commit=(p,cmd,record)=>p.eval(`const command=${JSON.stringify(cmd)};
      ${record?`const r=${JSON.stringify(record)},built=buildGenerated(r.s,r.o||{});if(!built.ok)return built;
        command.candidate={record:scaleRecord(seedOf(built.value)),deck:built.value};`:""}
      return commitSaved(command);`);
    const scope=e=>({slotStateRevision:e.slotStateRevision,slots:clone(e.slots),hidden:clone(e.hidden),
      replacements:e.entries.filter(x=>x.record?.v===4&&x.record.o?.replaces==="kurd")
        .map(x=>({id:x.instanceId,revision:x.revision}))});
    async function withTwo(records,extra,body) {
      await freshLoad();await b.setViewport(1280,800,false);
      if(records){await b.eval(`return ${nativeSavedExpression({write:true,raw:JSON.stringify(makeEnvelope(records,extra))})};`);await navigate();}
      const primary=session(b.sessionId);let targetId=null;
      try {
        const first=await primary.send("Target.getTargetInfo");
        ({targetId}=await b.send("Target.createTarget",{url:"about:blank"},false));
        const attached=await b.send("Target.attachToTarget",{targetId,flatten:true},false),peer=session(attached.sessionId);
        assert.notStrictEqual(peer.id,primary.id,"actual distinct CDP sessions are required");
        assert.notStrictEqual(targetId,first.targetInfo.targetId,"actual distinct targets are required");
        await peer.send("Page.enable");await peer.send("Runtime.enable");await peer.send("Network.enable");
        await peer.send("Network.setBlockedURLs",{urls:b.blockedUrls});
        await peer.send("Emulation.setDeviceMetricsOverride",{width:1280,height:800,deviceScaleFactor:1,mobile:false});
        await peer.send("Page.navigate",{url:URL});
        await peer.wait(APP_READY_EXPR,"peer document boot");
        assert.strictEqual(await primary.eval("return location.origin;"),await peer.eval("return location.origin;"),"actual targets share the loopback origin");
        assert.deepStrictEqual(await read(peer),await read(primary),"both actual targets observe the same completed IDB current record");
        console.log("SV_TARGETS "+JSON.stringify({first:first.targetInfo.targetId,second:targetId,distinctSessions:true,sharedOrigin:true}));
        await body(primary,peer);
      } finally {if(targetId)await b.send("Target.closeTarget",{targetId},false);}
    }
    async function openEdit(p) {await p.click("#decks .chip.on");await p.wait("!document.getElementById('scale-sheet').hidden","Edit open");}
    async function save(p) {await p.click("#scale-generate");await p.wait("document.getElementById('scale-sheet').hidden","saved sheet closed");
      await p.wait("location.hash===routeFor(deck())","saved canonical route");}
    async function hold(p) {
      await p.eval(`window.__svHeld=false;window.__svRelease=null;
        window.__svBarrier=navigator.locks.request(${JSON.stringify(LOCK)},()=>{window.__svHeld=true;
          return new Promise(resolve=>{window.__svRelease=resolve;});});return true;`);
      await p.wait("window.__svHeld===true","real exclusive barrier acquired");
    }
    const release=p=>p.eval("if(window.__svRelease)window.__svRelease();return true;");
    async function openPeer(owner) {
      const {targetId}=await owner.send("Target.createTarget",{url:"about:blank"},false);
      try {
        const {sessionId}=await owner.send("Target.attachToTarget",{targetId,flatten:true},false),p=session(sessionId,owner);
        assert.notStrictEqual(sessionId,owner.sessionId,"barrier must be owned by another actual target/session");
        await p.send("Page.enable");await p.send("Runtime.enable");await p.send("Network.enable");
        await p.send("Network.setBlockedURLs",{urls:owner.blockedUrls});await p.send("Page.navigate",{url:URL});
        await p.wait(APP_READY_EXPR,"actual peer barrier document");
        return {p,close:()=>owner.send("Target.closeTarget",{targetId},false)};
      } catch(error){await owner.send("Target.closeTarget",{targetId},false);throw error;}
    }
    async function ink(p,selector,{text,control=false,live=false}={}) {
      await p.send("Page.bringToFront");
      await p.eval(`const n=document.querySelector(${JSON.stringify(selector)});if(n)n.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});return true;`);
      await p.eval("return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));");
      const m=await p.eval(`const el=document.querySelector(${JSON.stringify(selector)});if(!el)return {found:false};
        const r=el.getBoundingClientRect();let visible=!!el.getClientRects().length&&r.width>0&&r.height>0&&!el.closest('[inert]');
        for(let n=el;n;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)visible=false;}
        const clips=[],walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;
        while((node=walker.nextNode()))if(node.textContent.trim()){
          const range=document.createRange();range.selectNodeContents(node);
          for(const t of range.getClientRects()){
            if(t.left<-1||t.top<-1||t.right>innerWidth+1||t.bottom>innerHeight+1)clips.push('viewport');
            if(t.left<r.left-1||t.top<r.top-1||t.right>r.right+1||t.bottom>r.bottom+1)clips.push('control bounds');
            for(let n=node.parentElement;n;n=n.parentElement){const s=getComputedStyle(n),a=n.getBoundingClientRect(),l=a.left+n.clientLeft,top=a.top+n.clientTop;
              if(/hidden|clip|auto|scroll/.test(s.overflowX)&&(t.left<l-1||t.right>l+n.clientWidth+1))clips.push('ancestor-x:'+n.className);
              if(/hidden|clip|auto|scroll/.test(s.overflowY)&&(t.top<top-1||t.bottom>top+n.clientHeight+1))clips.push('ancestor-y:'+n.className);}
          }
        }
        const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        let announcement=null,ariaHidden=false;
        for(let n=el;n;n=n.parentElement){
          if((n.getAttribute('aria-hidden')||'').trim().toLowerCase()==='true')ariaHidden=true;
          if(announcement===null){const a=(n.getAttribute('aria-live')||'').trim().toLowerCase(),role=(n.getAttribute('role')||'').trim().toLowerCase();
            if(['off','polite','assertive'].includes(a))announcement=a;
            else if(role==='status'||role==='alert')announcement=role==='status'?'polite':'assertive';}
        }
        return {found:true,visible,announcement,ariaHidden,text:el.textContent.trim(),aria:el.getAttribute('aria-label')||el.textContent.trim(),width:r.width,height:r.height,
          disabled:el.disabled===true,hit:!!hit&&(el===hit||el.contains(hit)),clips};`);
      assert.ok(m.found&&m.visible,"required message/control has visible computed ink: "+selector);
      if(text!==undefined)assert.strictEqual(m.text,text,"independent frozen copy: "+selector);
      if(live){assert.strictEqual(m.ariaHidden,false,"announcement has no aria-hidden suppression: "+selector);
        assert.ok(m.announcement==='polite'||m.announcement==='assertive',"message has an effective live region, respecting explicit off: "+selector);}
      assert.deepStrictEqual(m.clips,[],"text Range and ancestor x/y clipping: "+selector);
      if(control){assert.ok(m.width>=44&&m.height>=44,"action is at least44x44: "+selector);assert.ok(m.hit&&!m.disabled,"action target is usable: "+selector);}
      return m;
    }
    async function conflictSave(p,blocker,lang="en",kind="conflict",live=false) {
      await hold(blocker);
      try {
        await p.click("#scale-generate");
        // IDB staging precedes lock acquisition. Keep the real blocker held
        // until the trusted action has actually queued its single request.
        await p.wait(`navigator.locks.query().then(q=>q.pending.filter(x=>x.name===${JSON.stringify(LOCK)}).length===1)`,"trusted Save reaches the real exclusive commit queue");
        const q=await p.eval("return navigator.locks.query();");
        assert.strictEqual(q.pending.filter(x=>x.name===LOCK).length,1,"trusted Save must actually enqueue its commit; a no-op cannot pass");
      }finally{await release(blocker);}
      await p.wait(`navigator.locks.query().then(q=>q.pending.filter(x=>x.name===${JSON.stringify(LOCK)}).length===0&&document.getElementById('scale-generate').disabled===false)`,"Save operation releases its queue and returns from pending");
      assert.strictEqual(await p.eval("return document.getElementById('scale-sheet').hidden;"),false,"conflict keeps the draft page open");
      // Observe natural post-Save visibility BEFORE ink()/click helpers scroll.
      const recoveryVisible=await p.eval(`const body=document.querySelector('#scale-sheet .sheetbody'),br=body.getBoundingClientRect();
        return ['scale-conflict-msg','scale-conflict-separate'].map(id=>{const el=document.getElementById(id),r=el.getBoundingClientRect();
          return {id,visible:!!el.getClientRects().length&&r.height>0&&r.width>0&&r.top>=Math.max(0,br.top+body.clientTop)-1&&r.bottom<=Math.min(innerHeight,br.top+body.clientTop+body.clientHeight)+1};});`);
      assert.ok(recoveryVisible.every(item=>item.visible),"failed Save reveals recovery copy and action without test-driven scrolling: "+JSON.stringify(recoveryVisible));
      await ink(p,"#scale-conflict-msg",{text:SV.uiContract.copy[lang][kind],live});
      await ink(p,"#scale-conflict-separate",{text:SV.uiContract.copy[lang].separate,control:true});
      await ink(p,"#scale-back",{control:true});
    }

    async function startImport(p,record) {
      await p.eval(`const r=${JSON.stringify(record)},seed=HPE.core.parseSeed(r.s),code=HPE.share.encode({fields:seed.value.fields,options:r.o||{}});
        window.__svOperationDone=false;window.__svResult=null;window.__svOperation=Promise.resolve(openShare(code.value))
          .then(result=>{window.__svResult=result;window.__svOperationDone=true;},error=>{window.__svResult={ok:false,error:String(error)};window.__svOperationDone=true;});return true;`);
    }

    test("SV-PG: with 200 saved variants, 30 chip taps each select the tapped scale within 500 ms",{timeout:120000},async()=>{
      await freshLoad();await b.setViewport(380,780,false);
      const taps=[...new Set([0,199,...Array.from({length:28},(_,i)=>Math.round((i+1)*199/29))])];
      assert.strictEqual(taps.length,30,"thirty distinct chips are tapped");
      const tapPalette=new Map(taps.map((i,k)=>[i,k%10]));
      const records=Array.from({length:200},(_,i)=>({...clone(SV.portableRecords.amaraA),o:{name:"SVPG "+String(i+1).padStart(3,"0"),palette:tapPalette.has(i)?tapPalette.get(i):i%10}}));
      await b.eval(`return ${nativeSavedExpression({write:true,raw:JSON.stringify(makeEnvelope(records,{preferredSelection:{kind:"builtin",id:"kurd"}}))})};`);
      await navigate();
      const rows=await b.eval(`const taps=${JSON.stringify(taps)},uid=${uid.toString()},out=[];
        return (async()=>{
          if(document.querySelectorAll('#decks .chip[data-selection-kind="saved"]').length!==200)return {error:'200 saved chips are not rendered'};
          for(const i of taps){
            const id=uid(i+1),name='SVPG '+String(i+1).padStart(3,'0'),chip=document.querySelector('#decks .chip[data-selection-id="'+id+'"]');
            if(!chip)return {error:'missing chip '+i};
            const ok=()=>selection.kind==='saved'&&selection.id===id&&deck().name===name
              &&!!document.querySelector('#decks .chip.on[data-selection-id="'+id+'"]')
              &&savedState.preferredSelection.kind==='saved'&&savedState.preferredSelection.id===id
              &&getComputedStyle(document.documentElement).getPropertyValue('--root').trim().toLowerCase()===deck().colors.root.toLowerCase();
            const t0=performance.now();chip.click();
            while(!ok()){
              if(performance.now()-t0>5000)return {error:'tap '+i+' never selected '+name};
              await new Promise(resolve=>setTimeout(resolve,0));
            }
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            out.push({i,ms:performance.now()-t0,root:getComputedStyle(document.documentElement).getPropertyValue('--root').trim().toLowerCase()});
          }
          return {rows:out};
        })();`);
      assert.ok(!rows.error,rows.error);
      const max=Math.max(...rows.rows.map(r=>r.ms));
      console.log("SV_PG_TAPS "+JSON.stringify({count:rows.rows.length,maxMs:Math.round(max*10)/10,perTapMs:rows.rows.map(r=>Math.round(r.ms*10)/10)}));
      assert.strictEqual(rows.rows.length,30);
      assert.strictEqual(new Set(tapPalette.values()).size,10,"all ten palettes are used");
      for(let k=1;k<rows.rows.length;k++)assert.notStrictEqual(rows.rows[k].root,rows.rows[k-1].root,"taps "+(k-1)+" and "+k+" share a root colour");
      for(const r of rows.rows)assert.ok(r.ms<500,"chip "+r.i+" selected in "+r.ms.toFixed(1)+" ms, bound 500");
    });

    // Real native-only deletion regression: the scoped model has no delete
    // API. Metadata inspection below must not open the missing DB itself.
    // Transactional amendment: post-boot readonly reconciliation cannot create
    // schema or allocate identities outside a granted initialization lock.
    test("IDB10 E1: reconciliation after external deletion leaves the database absent without allocation",{timeout:30000},async()=>{
      await freshLoad();const p=session(b.sessionId);
      const before=await p.eval(`return indexedDB.databases().then(rows=>rows.filter(row=>row.name==='hpfc.saved-scales.v1').map(row=>({name:row.name,version:row.version})));`);
      assert.deepStrictEqual(before,[{name:"hpfc.saved-scales.v1",version:1}],"precondition: ordinary durable boot created the supported owned database");
      await p.eval(`window.__idbDeletionDraws={uuid:0,random:0};
        const uuid=crypto.randomUUID.bind(crypto),random=crypto.getRandomValues.bind(crypto);
        Object.defineProperty(crypto,'randomUUID',{configurable:true,value:(...args)=>{__idbDeletionDraws.uuid++;return uuid(...args);}});
        Object.defineProperty(crypto,'getRandomValues',{configurable:true,value:(...args)=>{__idbDeletionDraws.random++;return random(...args);}});
        return new Promise((resolve,reject)=>{
          const request=indexedDB.deleteDatabase('hpfc.saved-scales.v1');
          request.onsuccess=()=>resolve(true);request.onerror=()=>reject(request.error);
          request.onblocked=()=>reject(new Error('owned deletion blocked despite the application versionchange handler'));
        });`);
      assert.strictEqual(await p.eval(`return indexedDB.databases().then(rows=>rows.filter(row=>row.name==='hpfc.saved-scales.v1').length);`),0,"actual native deletion completed before reconciliation");
      const result=await p.eval("return reconcileSavedCollection();");
      const after=await p.eval(`return indexedDB.databases().then(rows=>rows.filter(row=>row.name==='hpfc.saved-scales.v1').map(row=>({name:row.name,version:row.version})));`);
      assert.deepStrictEqual(after,[],"readonly reconciliation must not recreate schema after external deletion");
      assert.strictEqual(result.ok,false,"missing authority is a truthful reconciliation refusal, never an acknowledged empty collection");
      assert.deepStrictEqual(await p.eval("return window.__idbDeletionDraws;"),{uuid:0,random:0},"readonly absence never allocates an epoch or instance identity");
    });

  }


  describe("FT: scale page flip cards", () => {
    const pageUrl = (slug) => URL.replace(/index\.html$/, "") + "scales/" + slug + "/index.html";
    const center = (sel) => b.eval(`
      document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: "center" });
      const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
    const tap = async (sel) => {
      const pt = await center(sel);
      for (const type of ["mousePressed", "mouseReleased"]) {
        await b.send("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", clickCount: 1 });
      }
    };
    const visibleStep = () => b.eval(`
      const s = [...document.querySelectorAll(".prog .slot")].filter((x) => getComputedStyle(x).display !== "none");
      return { n: s.length, step: s[0] && (s[0].querySelector(".step").getAttribute("aria-label") || s[0].querySelector(".step").textContent) };`);
    const flipped = () => b.eval(`
      const s = [...document.querySelectorAll(".prog .slot")].find((x) => getComputedStyle(x).display !== "none");
      return s.querySelector(".cardhost").shadowRoot.querySelector(".flip").checked;`);
    const faceTransform = (sel) => b.eval(`
      const s = [...document.querySelectorAll(".prog .slot")].find((x) => getComputedStyle(x).display !== "none");
      return getComputedStyle(s.querySelector(".cardhost").shadowRoot.querySelector(${JSON.stringify(sel)})).transform;`);
    const cardRect = () => b.eval(`
      const s = [...document.querySelectorAll(".prog .slot")].find((x) => getComputedStyle(x).display !== "none");
      const r = s.querySelector(".cardhost").getBoundingClientRect();
      return { w: r.width, h: r.height };`);

    for (const slug of ["d-kurd-10", "d-kurd-9"]) {
      test(`FT: ${slug} at 380x780 shows one chord, NEXT steps, a tap flips, and nothing shifts`, async () => {
        await b.setViewport(380, 780, true);
        await b.send("Page.navigate", { url: pageUrl(slug) });
        await b.waitFor(`document.readyState === "complete" && document.querySelector(".prog .slot")`, { label: "stepper" });
        assert.deepStrictEqual(await visibleStep(), { n: 1, step: "Chord 1 of 3" });
        assert.strictEqual(await b.eval(`return !![...document.querySelectorAll(".prog .nav label")].find((l) => l.textContent === "PREV" && l.offsetParent);`), true, "PREV is drawn on step 1");
        const before = await cardRect();
        assert.strictEqual(await flipped(), false);
        assert.ok(rotationAmount(await faceTransform(".inner")) < 0.01, `unflipped .inner must be at identity, got ${await faceTransform(".inner")}`);
        await tap(".prog .slot:nth-child(1) .cardhost");
        assert.strictEqual(await flipped(), true, "tap flips");
        await b.waitFor(`(() => { const s = [...document.querySelectorAll(".prog .slot")].find((x) => getComputedStyle(x).display !== "none"); return getComputedStyle(s.querySelector(".cardhost").shadowRoot.querySelector(".inner")).transform.indexOf("matrix3d(-1") === 0; })()`, { label: "the flipped .inner to finish its rotateY" });
        await b.settle();
        assert.ok(rotationAmount(await faceTransform(".inner")) > 0.5, `flipped .inner must be rotated, got ${await faceTransform(".inner")}`);
        assert.ok(rotationAmount(await faceTransform(".front")) > 0.5, `.front must carry its rotateY(180deg), got ${await faceTransform(".front")}`);
        assert.deepStrictEqual(await cardRect(), before, "flip shifts nothing");
        const nav = await b.eval(`
          const l = document.querySelector(".prog .slot:nth-child(1) .nav label:last-child");
          const r = l.getBoundingClientRect(); return { w: r.width, h: r.height, t: l.textContent };`);
        assert.strictEqual(nav.t, "NEXT");
        assert.ok(nav.w >= 44 && nav.h >= 44, "NEXT is a 44px target");
        await tap(".prog .slot:nth-child(1) .nav label:last-child");
        assert.deepStrictEqual(await visibleStep(), { n: 1, step: "Chord 2 of 3" });
        assert.deepStrictEqual(await cardRect(), before, "stepping shifts nothing");
      });
    }

    for (const [w, h] of [[844, 390], [380, 780]]) {
      for (const slug of ["d-kurd-9", "e-amara-20"]) {
        test(`FT: ${slug} at ${w}x${h}: NEXT and PREV tapped at the viewport top do not scroll the page`, async () => {
          await b.setViewport(w, h, true);
          await b.send("Page.navigate", { url: pageUrl(slug) });
          await b.waitFor(`document.readyState === "complete" && document.querySelector(".prog .slot")`, { label: "stepper" });
          for (const sel of [".prog .slot:nth-child(1) .nav label", ".prog .slot:nth-child(2) .nav label:first-child"]) {
            const pt = await b.eval(`
              const l = document.querySelector(${JSON.stringify(sel)});
              scrollBy(0, l.getBoundingClientRect().top - 2);
              const r = l.getBoundingClientRect();
              return { x: r.left + r.width / 2, y: r.top + r.height / 2, sy: scrollY };`);
            for (const type of ["mousePressed", "mouseReleased"]) {
              await b.send("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", clickCount: 1 });
            }
            await new Promise((r) => setTimeout(r, 100));
            const after = await b.eval(`return scrollY;`);
            // e-amara-20's chord 2 is 15px taller; scroll anchoring (or the page end) moves scrollY by that growth only.
            assert.ok(Math.abs(after - pt.sy) <= 16, `${sel} at the top leaves scrollY alone (${pt.sy} -> ${after})`);
          }
        });
      }
    }

    for (const [w, h] of [[844, 390], [380, 780]]) {
      for (const slug of ["d-kurd-9", "e-amara-20", "f-low-pygmy-18"]) {
        test(`FT: ${slug} at ${w}x${h}: NEXT and PREV tapped with the label 1, 16 and 32px below the fold do not scroll the page`, async () => {
          await b.setViewport(w, h, true);
          for (const hidden of [1, 16, 32]) {
            for (const [step, sel] of [[1, ".prog .slot:nth-child(1) .nav label:last-child"], [2, ".prog .slot:nth-child(2) .nav label:first-child"]]) {
              await b.send("Page.navigate", { url: pageUrl(slug) });
              await b.waitFor(`document.readyState === "complete" && document.querySelector(".prog .slot")`, { label: "stepper" });
              const pt = await b.eval(`
                document.querySelector("#p${step}").checked = true;
                const l = document.querySelector(${JSON.stringify(sel)});
                l.scrollIntoView({ block: "end" }); scrollBy(0, -${hidden});
                const r = l.getBoundingClientRect();
                return { x: r.left + r.width / 2, y: (r.top + Math.min(r.bottom, innerHeight)) / 2, sy: scrollY };`);
              for (const type of ["mousePressed", "mouseReleased"]) {
                await b.send("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", clickCount: 1 });
              }
              await new Promise((r) => setTimeout(r, 120));
              const after = await b.eval(`return { y: scrollY, on: [...document.querySelectorAll(".prog > input")].findIndex((x) => x.checked) + 1 };`);
              assert.strictEqual(after.on, step === 1 ? 2 : 1, `${sel} ${hidden}px below the fold steps`);
              // A taller next chord (e-amara-20, f-low-pygmy-18) moves scrollY by its growth only.
              const tol = slug === "d-kurd-9" ? 0 : 16;
              assert.ok(Math.abs(after.y - pt.sy) <= tol, `${sel} ${hidden}px below the fold leaves scrollY alone (${pt.sy} -> ${after.y})`);
            }
          }
        });
      }
    }

    for (const [w, h] of [[844, 390], [380, 780]]) {
      test(`FT: d-kurd-9 at ${w}x${h} zoomed to 2.5x on NEXT: tapping NEXT twice steps without panning the visual viewport`, async () => {
        await b.setViewport(w, h, true);
        try {
          await b.send("Page.navigate", { url: pageUrl("d-kurd-9") });
          await b.waitFor(`document.readyState === "complete" && document.querySelector(".prog .slot")`, { label: "stepper" });
          await b.setPageScale(2.5);
          await b.settle();
          for (const [step, sel] of [[2, ".prog .slot:nth-child(1) .nav label:last-child"], [3, ".prog .slot:nth-child(2) .nav label:last-child"]]) {
            if (step === 2) {
              await b.eval(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: "center", inline: "center" }); return 1;`);
              await b.settle();
            }
            const v = await b.eval(`
              const l = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); const v = visualViewport;
              return { s: v.scale, px: v.pageLeft, py: v.pageTop, x: l.left + l.width / 2 - v.offsetLeft, y: l.top + l.height / 2 - v.offsetTop, vw: v.width, vh: v.height };`);
            assert.ok(v.s > 2, `zoomed (${v.s})`);
            assert.ok(v.x > 0 && v.x < v.vw && v.y > 0 && v.y < v.vh, `${sel} is in the zoomed view (${JSON.stringify(v)})`);
            for (const type of ["mousePressed", "mouseReleased"]) {
              await b.send("Input.dispatchMouseEvent", { type, x: v.x, y: v.y, button: "left", clickCount: 1 });
            }
            await new Promise((r) => setTimeout(r, 300));
            const a = await b.eval(`const v = visualViewport; return { px: v.pageLeft, py: v.pageTop, on: [...document.querySelectorAll(".prog > input")].findIndex((x) => x.checked) + 1 };`);
            assert.strictEqual(a.on, step, `${sel} steps to ${step}`);
            assert.ok(Math.abs(a.px - v.px) <= 2 && Math.abs(a.py - v.py) <= 2, `${sel} leaves the visual viewport alone (${v.px},${v.py} -> ${a.px},${a.py})`);
          }
        } finally {
          await b.setPageScale(1);
        }
      });
    }

    for (const [w, h] of [[844, 390], [380, 780]]) {
      test(`FT: d-kurd-9 at ${w}x${h}: a touch tap on NEXT and PREV with the label 16px below the fold steps and does not scroll`, async () => {
        await b.setViewport(w, h, true);
        await b.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
        try {
          for (const [step, sel] of [[1, ".prog .slot:nth-child(1) .nav label:last-child"], [2, ".prog .slot:nth-child(2) .nav label:first-child"]]) {
            await b.send("Page.navigate", { url: pageUrl("d-kurd-9") });
            await b.waitFor(`document.readyState === "complete" && document.querySelector(".prog .slot")`, { label: "stepper" });
            const pt = await b.eval(`
              document.querySelector("#p${step}").checked = true;
              const l = document.querySelector(${JSON.stringify(sel)});
              l.scrollIntoView({ block: "end" }); scrollBy(0, -16);
              const r = l.getBoundingClientRect();
              return { x: r.left + r.width / 2, y: (r.top + Math.min(r.bottom, innerHeight)) / 2, sy: scrollY };`);
            await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pt.x, y: pt.y }] });
            await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
            await new Promise((r) => setTimeout(r, 300));
            const after = await b.eval(`return { y: scrollY, on: [...document.querySelectorAll(".prog > input")].findIndex((x) => x.checked) + 1 };`);
            assert.strictEqual(after.on, step === 1 ? 2 : 1, `${sel} touch steps`);
            assert.ok(Math.abs(after.y - pt.sy) <= 0, `${sel} touch leaves scrollY alone (${pt.sy} -> ${after.y})`);
          }
        } finally {
          await b.send("Emulation.setTouchEmulationEnabled", { enabled: false });
        }
      });
    }

    const loadPage = async (slug) => {
      await b.send("Page.navigate", { url: pageUrl(slug) });
      await b.waitFor(`document.readyState === "complete" && document.querySelector(".prog .slot")`, { label: "stepper" });
    };
    const tapXY = async (kind, x, y) => {
      if (kind === "mouse") {
        for (const type of ["mousePressed", "mouseReleased"]) await b.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
      } else {
        await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      }
    };
    const stepNow = () => b.eval(`return [...document.querySelectorAll(".prog > input")].findIndex((x) => x.checked) + 1;`);

    const matrixCells = [];
    for (const slug of ["d-kurd-9", "e-amara-20", "f-low-pygmy-18"]) {
      for (const [w, h] of [[380, 780], [844, 390]]) {
        for (const zoom of [1, 2.5]) matrixCells.push([slug, w, h, zoom, ["mouse", "touch"]]);
      }
    }
    matrixCells.push(["d-kurd-9", 1280, 800, 1, ["mouse"]]);
    for (const [slug, w, h, zoom, kinds] of matrixCells) {
      test(`FT: ${slug} at ${w}x${h} ${zoom}x: NEXT and PREV tapped with the label top 10px and 35px above the view, and the label bottom 1, 16 and 32px below the fold, scroll the page and the visual viewport by under 2px`, async () => {
        await b.setViewport(w, h, true);
        try {
          for (const kind of kinds) {
            await b.send("Emulation.setTouchEmulationEnabled", { enabled: kind === "touch", maxTouchPoints: 5 });
            await loadPage(slug);
            if (zoom !== 1) { await b.setPageScale(zoom); await b.settle(); }
            for (const [name, step, sel] of [["NEXT", 1, ".prog .slot:nth-child(1) .nav label:last-child"], ["PREV", 2, ".prog .slot:nth-child(2) .nav label:first-child"]]) {
              for (const cs of ["top-10", "top-35", "bot+1", "bot+16", "bot+32"]) {
                const n = +cs.slice(4);
                await b.eval(`document.querySelector("#p${step}").checked = true; return 1;`);
                const target = cs.startsWith("top") ? `(l.top - v.offsetTop) + ${n}` : `(l.bottom - v.offsetTop) - v.height - ${n}`;
                for (let i = 0; i < 3; i++) {
                  await b.eval(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: "center", inline: "center" }); return 1;`);
                  await b.settle();
                  await b.eval(`const l = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(), v = visualViewport; scrollTo(scrollX, scrollY + ${target}); return 1;`);
                  await b.settle();
                }
                const be = await b.eval(`
                  const l = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(), v = visualViewport;
                  const t = l.top - v.offsetTop, bo = l.bottom - v.offsetTop;
                  return { sy: scrollY, px: v.pageLeft, py: v.pageTop, x: l.left + l.width / 2 - v.offsetLeft, y: (Math.max(t, 0) + Math.min(bo, v.height)) / 2, t, bo };`);
                await tapXY(kind, be.x, be.y);
                await new Promise((r) => setTimeout(r, 300));
                const a = await b.eval(`const v = visualViewport; return { sy: scrollY, px: v.pageLeft, py: v.pageTop, max: document.documentElement.scrollHeight - innerHeight };`);
                const clamped = a.sy < be.sy && a.sy >= a.max - 1;
                const where = `${name} ${kind} ${cs} (label ${be.t.toFixed(0)}..${be.bo.toFixed(0)})`;
                assert.strictEqual(await stepNow(), name === "NEXT" ? 2 : 1, `${where} steps`);
                assert.ok(clamped || Math.abs(a.sy - be.sy) < 2, `${where} leaves scrollY alone (${be.sy} -> ${a.sy})`);
                assert.ok(clamped || Math.abs(a.py - be.py) < 2, `${where} leaves the visual viewport top alone (${be.py} -> ${a.py})`);
                assert.ok(Math.abs(a.px - be.px) < 2, `${where} leaves the visual viewport left alone (${be.px} -> ${a.px})`);
              }
            }
          }
        } finally {
          await b.setPageScale(1);
          await b.send("Emulation.setTouchEmulationEnabled", { enabled: false });
        }
      });
    }

    for (const slug of ["d-kurd-9", "e-amara-20"]) {
      for (const kind of ["mouse", "touch"]) {
        test(`FT: ${slug} at 380x780: NEXT twice from p1 lands on p2 then p3, and PREV from p3 lands on p2 (${kind})`, async () => {
          await b.setViewport(380, 780, true);
          await b.send("Emulation.setTouchEmulationEnabled", { enabled: kind === "touch", maxTouchPoints: 5 });
          try {
            await loadPage(slug);
            const labelPt = (st, which) => b.eval(`
              const l = document.querySelector(".prog .slot:nth-child(${st}) .nav label:${which}-child");
              l.scrollIntoView({ block: "center" }); const r = l.getBoundingClientRect();
              return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
            for (const [st, which, want] of [[1, "last", 2], [2, "last", 3], [3, "first", 2]]) {
              const p = await labelPt(st, which);
              await tapXY(kind, p.x, p.y);
              await new Promise((r) => setTimeout(r, 200));
              assert.strictEqual(await stepNow(), want, `${which} label of step ${st} lands on ${want}`);
            }
          } finally {
            await b.send("Emulation.setTouchEmulationEnabled", { enabled: false });
          }
        });
      }
    }

    for (const slug of ["d-kurd-9", "e-amara-20"]) {
      test(`FT: ${slug} at 380x780: PREV and NEXT are drawn and step with wrap at the first, a middle and the last card, flipped or not`, async () => {
        await b.setViewport(380, 780, true);
        await loadPage(slug);
        const n = await b.eval(`return document.querySelectorAll(".prog > input").length;`);
        for (const [pos, flip] of [[1, false], [1, true], [2, false], [2, true], [n, false], [n, true]]) {
          for (const [which, want] of [["first", pos === 1 ? n : pos - 1], ["last", pos === n ? 1 : pos + 1]]) {
            await b.eval(`
              document.querySelector("#p${pos}").checked = true;
              const slot = document.querySelector(".prog .slot:nth-child(${pos})");
              slot.querySelector(".cardhost").shadowRoot.querySelector(".flip").checked = ${flip};
              return true;`);
            const r = await b.eval(`
              const l = document.querySelector(".prog .slot:nth-child(${pos}) .nav label:${which}-child");
              if (!l) return null;
              l.scrollIntoView({ block: "center" }); const a = l.getBoundingClientRect();
              return { x: a.left + a.width / 2, y: a.top + a.height / 2, w: a.width, h: a.height, v: getComputedStyle(l).visibility };`);
            assert.ok(r && r.w >= 56 && r.h >= 44 && r.v === "visible", `${which} arrow at card ${pos} (flipped ${flip}) is drawn`);
            await tapXY("mouse", r.x, r.y);
            await new Promise((res) => setTimeout(res, 200));
            assert.strictEqual(await stepNow(), want, `${which} arrow at card ${pos} (flipped ${flip}) lands on ${want}`);
          }
        }
      });
    }

    for (const [w, h] of [[844, 390], [380, 780], [1280, 800]]) {
      test(`FT: d-kurd-9 at ${w}x${h}: in each checked state each adjacent radio equals the visible nav label it replaces, the checked radio sits on the nav row with no pointer events, and every far radio has no pointer events`, async () => {
        await b.setViewport(w, h, true);
        await loadPage("d-kurd-9");
        for (const step of [1, 2, 3]) {
          const r = await b.eval(`
            document.querySelector("#p${step}").checked = true;
            const ins = [...document.querySelectorAll(".prog > input")];
            const nav = document.querySelector(".prog .slot:nth-child(${step}) .nav").getBoundingClientRect();
            const labels = [...document.querySelectorAll(".prog .slot:nth-child(${step}) .nav label")].map((l) => {
              const a = l.getBoundingClientRect(); return { t: l.textContent, f: l.htmlFor, a: [a.left, a.top, a.right, a.bottom] };
            });
            return { nav: [nav.top, nav.bottom], labels, radios: ins.map((i) => {
              const c = i.getBoundingClientRect();
              return { id: i.id, checked: i.checked, pe: getComputedStyle(i).pointerEvents, c: [c.left, c.top, c.right, c.bottom] };
            }), labelPe: [...document.querySelectorAll(".prog .nav label")].map((l) => getComputedStyle(l).pointerEvents) };`);
          for (const l of r.labels) {
            const i = r.radios.find((x) => x.id === l.f);
            for (let k = 0; k < 4; k++) assert.ok(Math.abs(i.c[k] - l.a[k]) <= 1, `step ${step} ${l.t}: radio ${i.id} ${JSON.stringify(i.c)} equals label ${JSON.stringify(l.a)} within 1px`);
            assert.strictEqual(i.pe, "auto", `step ${step} ${l.t} radio takes pointer events`);
          }
          const chk = r.radios.find((x) => x.checked);
          assert.strictEqual(chk.pe, "none", `step ${step}: the checked radio takes no pointer events`);
          assert.ok(chk.c[1] >= r.nav[0] - 1 && chk.c[3] <= r.nav[1] + 1, `step ${step}: the checked radio sits on the nav row (${chk.c[1]}..${chk.c[3]} in ${r.nav})`);
          const adj = new Set(r.labels.map((l) => l.f));
          for (const x of r.radios) {
            if (x.checked || adj.has(x.id)) continue;
            assert.strictEqual(x.pe, "none", `step ${step}: far radio ${x.id} takes no pointer events`);
            for (const l of r.labels) {
              const o = x.c[0] < l.a[2] && x.c[2] > l.a[0] && x.c[1] < l.a[3] && x.c[3] > l.a[1];
              assert.ok(!o || x.pe === "none", `far radio ${x.id} never covers a label with pointer events`);
            }
          }
          assert.ok(r.labelPe.every((p) => p === "none"), "the labels are visual only");
        }
      });
    }

    test("FT: the shipped scroll margin covers the tallest nav-bottom to chord-name-top distance over every scale page at 380x780", async () => {
      await b.setViewport(380, 780, true);
      const fs = require("node:fs");
      const dir = require("node:path").join(__dirname, "..", "scales");
      const slugs = fs.readdirSync(dir).filter((x) => fs.existsSync(require("node:path").join(dir, x, "index.html")));
      assert.ok(slugs.length >= 16, `all the pages are listed (${slugs.length})`);
      let max = 0, margin = 0, at = "";
      for (const slug of slugs) {
        await loadPage(slug);
        const r = await b.eval(`
          const out = []; const n = document.querySelectorAll(".prog > input").length;
          for (let st = 1; st <= n; st++) {
            document.querySelector("#p" + st).checked = true;
            const s = document.querySelector(".prog .slot:nth-child(" + st + ")");
            out.push(s.querySelector(".nav").getBoundingClientRect().bottom - s.querySelector(".cardhost").shadowRoot.querySelector(".fname").getBoundingClientRect().top);
          }
          return { d: Math.max(...out), m: parseFloat(getComputedStyle(document.querySelector("#p1")).scrollMarginTop) };`);
        margin = r.m;
        if (r.d > max) { max = r.d; at = slug; }
      }
      console.log(`FT scroll-margin-top: shipped ${margin}px, measured max ${max.toFixed(2)}px on ${at} at 380x780`);
      assert.ok(margin >= max, `shipped margin ${margin} >= measured max ${max} (${at})`);
    });

    const tabCases = [];
    for (const slug of ["d-kurd-9", "f-low-pygmy-18"]) for (const [w, h] of [[380, 780], [844, 390]]) for (const st of [1, 2, 3]) for (const shift of [false, true]) tabCases.push([slug, w, h, st, shift]);
    for (const [slug, w, h, st, shift] of tabCases) {
      test(`FT: ${slug} at ${w}x${h}: ${shift ? "Shift+Tab" : "Tab"} onto the checked step ${st} brings the nav into view and the chord name's top at or below 0 when both fit`, async () => {
        await b.setViewport(w, h, true);
        await loadPage(slug);
        await b.eval(`
          document.querySelector("#p${st}").checked = true;
          const ins = [...document.querySelectorAll("a, button, input")].filter((e) => e.tabIndex >= 0);
          const radios = [...document.querySelectorAll(".prog > input")];
          const from = ${shift} ? document.querySelector(".prog .slot:nth-child(${st}) .cardhost").shadowRoot.querySelector(".flip") : ins[ins.indexOf(radios[0]) - 1];
          from.focus({ preventScroll: true });
          scrollTo(0, ${shift} ? document.documentElement.scrollHeight : 0); return 1;`);
        await b.settle();
        const mod = shift ? 8 : 0;
        await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: mod });
        await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: mod });
        await new Promise((r) => setTimeout(r, 250));
        const a = await b.eval(`
          const s = document.querySelector(".prog .slot:nth-child(${st})");
          const nav = s.querySelector(".nav").getBoundingClientRect();
          const name = s.querySelector(".cardhost").shadowRoot.querySelector(".fname").getBoundingClientRect();
          return { id: document.activeElement.id, navTop: nav.top, navBottom: nav.bottom, nameTop: name.top, vh: innerHeight,
            margin: parseFloat(getComputedStyle(document.querySelector("#p1")).scrollMarginTop) };`);
        assert.strictEqual(a.id, "p" + st, "the checked step takes the focus");
        assert.ok(a.navBottom <= a.vh + 1 && a.navTop >= -1, `the nav is in view (${a.navTop}..${a.navBottom} of ${a.vh})`);
        assert.ok(a.margin + 44 <= a.vh, `the scroll margin ${a.margin} + 44 fits the ${a.vh}px viewport`);
        if (a.navBottom - a.nameTop <= a.vh) assert.ok(a.nameTop >= -1, `the chord name's top is at or below 0 (${a.nameTop})`);
        else console.log(`FT best effort: ${slug} ${w}x${h} step ${st}: nav bottom - name top ${a.navBottom - a.nameTop} > ${a.vh}`);
      });
    }

    for (const slug of ["d-kurd-9", "f-low-pygmy-18"]) {
      test(`FT: ${slug} at 380x780: ArrowRight and ArrowLeft on the focused step keep the chord name at or below 0 and scroll nothing when the nav and name are already in view`, async () => {
        await b.setViewport(380, 780, true);
        await loadPage(slug);
        await b.eval(`document.querySelector("#p1").focus(); return 1;`);
        await b.settle();
        for (const [k, code, vk, want] of [["ArrowRight", "ArrowRight", 39, 2], ["ArrowRight", "ArrowRight", 39, 3], ["ArrowLeft", "ArrowLeft", 37, 2]]) {
          const pre = await b.eval(`
            const s = document.querySelector(".prog .slot:nth-child(" + ([...document.querySelectorAll(".prog > input")].findIndex((x) => x.checked) + 1) + ")");
            const nav = s.querySelector(".nav").getBoundingClientRect();
            const name = s.querySelector(".cardhost").shadowRoot.querySelector(".fname").getBoundingClientRect();
            return { sy: scrollY, both: nav.top >= 0 && nav.bottom <= innerHeight && name.top >= 0 };`);
          await b.key(k, code, vk);
          await new Promise((r) => setTimeout(r, 250));
          const a = await b.eval(`
            const s = document.querySelector(".prog .slot:nth-child(${want})");
            const nav = s.querySelector(".nav").getBoundingClientRect();
            const name = s.querySelector(".cardhost").shadowRoot.querySelector(".fname").getBoundingClientRect();
            return { sy: scrollY, nameTop: name.top, navBottom: nav.bottom, vh: innerHeight, on: [...document.querySelectorAll(".prog > input")].findIndex((x) => x.checked) + 1 };`);
          assert.strictEqual(a.on, want, `${k} lands on ${want}`);
          if (a.navBottom - a.nameTop <= a.vh) assert.ok(a.nameTop >= -1, `${k}: chord name top ${a.nameTop} at or below 0`);
          if (pre.both) assert.ok(Math.abs(a.sy - pre.sy) < 2, `${k} with the nav and name in view scrolls nothing (${pre.sy} -> ${a.sy})`);
        }
      });
    }

    for (const [w, h] of [[844, 390], [380, 780]]) {
      for (const slug of ["e-amara-20", "d-aegean-18"]) {
        test(`FT: ${slug} at ${w}x${h}: Tab and Shift+Tab into the steps bring the focused step into view`, async () => {
          await b.setViewport(w, h, true);
          await b.send("Page.navigate", { url: pageUrl(slug) });
          await b.waitFor(`document.readyState === "complete" && document.querySelector(".prog .slot")`, { label: "stepper" });
          const ring = () => b.eval(`
            const s = [...document.querySelectorAll(".prog .slot")].find((x) => getComputedStyle(x).display !== "none");
            const r = s.getBoundingClientRect();
            return { id: document.activeElement.id, ring: getComputedStyle(s).outlineStyle, top: r.top, bottom: r.bottom, vh: innerHeight };`);
          await b.eval(`
            const f = [...document.querySelectorAll("a[href], input")];
            f[f.indexOf(document.querySelector("#p1")) - 1].focus(); scrollTo(0, 0); return true;`);
          await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
          await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
          let r = await ring();
          assert.strictEqual(r.id, "p1");
          assert.strictEqual(r.ring, "solid", "the focused step shows a ring");
          assert.ok(r.bottom > 40 && r.top < r.vh - 40, `Tab: the ringed step is in view (${r.top}..${r.bottom} of ${r.vh})`);
          await b.eval(`document.querySelector(".prog .slot:nth-child(1) .cardhost").shadowRoot.querySelector(".flip").focus();
            const n = document.querySelector(".prog .slot:nth-child(1) .nav"); n.scrollIntoView({ block: "end" }); return true;`);
          await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: 8 });
          await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, modifiers: 8 });
          r = await ring();
          assert.strictEqual(r.id, "p1");
          assert.ok(r.bottom > 40 && r.top < r.vh - 40, `Shift+Tab: the ringed step is in view (${r.top}..${r.bottom} of ${r.vh})`);
        });
      }
    }

    test("FT: Tab reaches the radio group, arrows step, Space on the flip checkbox flips", async () => {
      await b.setViewport(380, 780, true);
      await b.send("Page.navigate", { url: pageUrl("d-kurd-9") });
      await b.waitFor(`document.readyState === "complete" && document.querySelector(".prog .slot")`, { label: "stepper" });
      await b.eval(`document.querySelector("#p1").focus(); return true;`);
      await b.key("ArrowRight", "ArrowRight", 39);
      assert.strictEqual((await visibleStep()).step, "Chord 2 of 3");
      assert.strictEqual(await b.eval(`return document.activeElement.id;`), "p2");
      await b.key("ArrowLeft", "ArrowLeft", 37);
      assert.strictEqual((await visibleStep()).step, "Chord 1 of 3");
      await b.eval(`document.querySelector(".prog .slot:nth-child(1) .cardhost").shadowRoot.querySelector(".flip").focus(); return true;`);
      await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", text: " ", windowsVirtualKeyCode: 32 });
      await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
      assert.strictEqual(await flipped(), true, "Space flips");
    });

    const swipeSetup = async (slug, w, h) => {
      await b.setViewport(w, h, true);
      await b.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      await loadPage(slug);
      await b.eval(`document.querySelector(".prog .slot:nth-child(1) .cardhost").scrollIntoView({ block: "center" }); return true;`);
    };
    const hostCenter = () => b.eval(`
      const s = [...document.querySelectorAll(".prog .slot")].find((x) => getComputedStyle(x).display !== "none");
      const r = s.querySelector(".cardhost").getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };`);
    let lastTouch = 0;
    const swipe = async (dx, dy, ms, rest = 0) => {
      const c = await hostCenter();
      const t0 = Math.max(Date.now() / 1000, lastTouch + 0.05);
      lastTouch = t0 + (ms + rest) / 1000 + 0.001;
      const at = (f) => [{ x: c.x + dx * f, y: c.y + dy * f }];
      await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(0), timestamp: t0 });
      for (let i = 1; i <= 6; i++) {
        await b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(i / 6), timestamp: t0 + (ms * i) / 6000 });
      }
      if (rest) await b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(1), timestamp: t0 + (ms + rest) / 1000 });
      await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], timestamp: lastTouch });
      await new Promise((r) => setTimeout(r, 480));
    };
    const tapTouch = async () => {
      const c = await hostCenter();
      const t0 = Math.max(Date.now() / 1000, lastTouch + 0.05);
      lastTouch = t0 + 0.05;
      await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y }], timestamp: t0 });
      await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], timestamp: lastTouch });
      await new Promise((r) => setTimeout(r, 120));
    };
    const stepIndex = async () => Number((await visibleStep()).step.match(/Chord (\d+)/)[1]);

    test("FT: a horizontal drag steps the chord, a slow 30px drag included", async () => {
      try {
        for (const slug of ["d-kurd-10", "d-kurd-9"]) {
          for (const [w, h] of [[380, 780], [844, 390]]) {
            const at = `${slug} ${w}x${h}`;
            await swipeSetup(slug, w, h);
            assert.strictEqual(await stepIndex(), 1, at);
            await swipe(-60, 0, 150);
            assert.strictEqual(await stepIndex(), 2, `${at}: left drag steps forward`);
            assert.strictEqual(await flipped(), false, `${at}: a drag does not flip`);
            await swipe(60, 0, 150);
            assert.strictEqual(await stepIndex(), 1, `${at}: right drag steps back`);
            await swipe(-30, 0, 400);
            assert.strictEqual(await stepIndex(), 2, `${at}: a slow 30px drag steps`);
            assert.strictEqual(await b.eval(`return document.querySelector(".prog").classList.contains("sw");`), true, at);
          }
        }
      } finally {
        await b.send("Emulation.setTouchEmulationEnabled", { enabled: false });
      }
    });

    test("FT: a vertical drag makes no step and no flip, and a tap afterwards flips", async () => {
      try {
        await swipeSetup("d-kurd-10", 380, 780);
        await swipe(0, 200, 250);
        assert.strictEqual(await stepIndex(), 1, "no step");
        assert.strictEqual(await flipped(), false, "no flip");
        await b.eval(`document.querySelector(".prog .slot:nth-child(1) .cardhost").scrollIntoView({ block: "center" }); return true;`);
        await tapTouch();
        assert.strictEqual(await flipped(), true, "a tap flips");
      } finally {
        await b.send("Emulation.setTouchEmulationEnabled", { enabled: false });
      }
    });

    test("FT: a swipe then a tap flips exactly once", async () => {
      try {
        await swipeSetup("d-kurd-9", 380, 780);
        await tapTouch();
        assert.strictEqual(await flipped(), true, "a plain tap flips");
        await tapTouch();
        assert.strictEqual(await flipped(), false, "a second tap flips back");
        await swipe(-60, 0, 150, 150);
        assert.strictEqual(await stepIndex(), 2);
        await b.eval(`document.querySelector(".prog .slot:nth-child(2) .cardhost").scrollIntoView({ block: "center" }); return true;`);
        await tapTouch();
        assert.strictEqual(await flipped(), true, "the tap right after a swipe flips once");
        await b.eval(`document.querySelector(".prog .slot:nth-child(2) .cardhost").shadowRoot.querySelector(".flip").checked = false; return true;`);
        await swipe(-60, 0, 150);
        assert.strictEqual(await stepIndex(), 3);
        await new Promise((r) => setTimeout(r, 500));
        await tapTouch();
        assert.strictEqual(await flipped(), true, "a tap after the suppress window flips");
      } finally {
        await b.send("Emulation.setTouchEmulationEnabled", { enabled: false });
      }
    });

    test("FT: a swipe past the last chord or before the first wraps around", async () => {
      try {
        await swipeSetup("d-kurd-10", 380, 780);
        await swipe(60, 0, 150);
        const n = await b.eval(`return document.querySelectorAll(".prog > input").length;`);
        assert.strictEqual(await stepIndex(), n, "before the first wraps to the last");
        await swipe(-60, 0, 150);
        assert.strictEqual(await stepIndex(), 1, "past the last wraps to the first");
      } finally {
        await b.send("Emulation.setTouchEmulationEnabled", { enabled: false });
      }
    });

    const anim = () => b.eval(`
      const s = [...document.querySelectorAll(".prog .slot")].find((x) => getComputedStyle(x).display !== "none");
      return s.querySelector(".cardhost").getAnimations().map((a) => { const t = a.effect.getTiming(); return { d: t.duration, e: t.easing }; });`);
    const counter = () => b.eval(`
      const s = [...document.querySelectorAll(".prog .slot")].find((x) => getComputedStyle(x).display !== "none");
      const e = s.querySelector(".step"); return { t: e.textContent, a: e.getAttribute("aria-label") };`);
    const mouseDrag = async (dx, steps = 8) => {
      const c = await hostCenter();
      await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: c.x, y: c.y, button: "left", buttons: 1, clickCount: 1 });
      for (let i = 1; i <= steps; i++) await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: c.x + (dx * i) / steps, y: c.y, button: "left", buttons: 1 });
      await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: c.x + dx, y: c.y, button: "left", clickCount: 1 });
      await new Promise((r) => setTimeout(r, 450));
    };
    const mouseSetup = async (slug, w, h) => {
      await b.setViewport(w, h, false);
      await loadPage(slug);
      await b.eval(`document.querySelector(".prog .slot:nth-child(1) .cardhost").scrollIntoView({ block: "center" }); return true;`);
    };

    test("FT: the counter reads n / 3 and is named Chord n of 3, and the rail sits under the card with the current chord marked", async () => {
      await swipeSetup("d-kurd-9", 380, 780);
      assert.deepStrictEqual(await counter(), { t: "1 / 3", a: "Chord 1 of 3" });
      const r = await b.eval(`
        const s = document.querySelector(".prog .slot:nth-child(1)");
        const rail = s.querySelector(".rail"); const card = s.querySelector(".cardhost").getBoundingClientRect();
        const rr = rail.getBoundingClientRect();
        const between = [...s.children].filter((x) => x !== rail && x.getBoundingClientRect().top >= card.bottom - 0.5 && x.getBoundingClientRect().bottom <= rr.top + 0.5 && x.getBoundingClientRect().height > 0);
        return { gap: rr.top - card.bottom, between: between.length, cur: rail.querySelectorAll("b").length, txt: rail.textContent };`);
      assert.ok(Math.abs(r.gap - 14) <= 1, `the rail's top is the app's 14px below the card (${r.gap})`);
      assert.strictEqual(r.between, 0, "nothing sits between the card and the rail");
      assert.strictEqual(r.cur, 1);
      assert.strictEqual(r.txt.split(" → ").length, 3, r.txt);
    });

    test("FT: a touch commit flies out 220ms, comes in 180ms and advances exactly one step", async () => {
      try {
        await swipeSetup("d-kurd-9", 380, 780);
        const c = await hostCenter();
        const t0 = Math.max(Date.now() / 1000, lastTouch + 0.05);
        lastTouch = t0 + 1;
        await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y }], timestamp: t0 });
        for (let i = 1; i <= 4; i++) await b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: c.x - 15 * i, y: c.y }], timestamp: t0 + 0.04 * i });
        await new Promise((r) => setTimeout(r, 80));
        const tf = await b.eval(`return getComputedStyle(document.querySelector(".prog .slot:nth-child(1) .cardhost")).transform;`);
        const m = tf.match(/matrix\(([^)]+)\)/)[1].split(",").map(Number);
        const deg = Math.atan2(m[1], m[0]) * 180 / Math.PI;
        assert.ok(Math.abs(deg - -60 * 0.05) < 0.1, `tilt follows 0.05deg per px (${deg})`);
        await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], timestamp: t0 + 0.2 });
        const out = await anim();
        assert.ok(out.some((a) => Math.abs(a.d - 220) <= 1), JSON.stringify(out));
        await b.waitFor(`(() => { const e = document.querySelector(".prog .slot:nth-child(2) .cardhost"); return e.getAnimations().some((a) => a.effect.getTiming().duration === 180); })()`, { label: "in animation" });
        await new Promise((r) => setTimeout(r, 500));
        assert.strictEqual(await stepIndex(), 2, "exactly one step");
      } finally {
        await b.send("Emulation.setTouchEmulationEnabled", { enabled: false });
      }
    });

    test("FT: a short touch drag springs back with no step and no flip", async () => {
      try {
        await swipeSetup("d-kurd-9", 380, 780);
        await swipe(-12, 0, 400);
        assert.strictEqual(await stepIndex(), 1);
        assert.strictEqual(await flipped(), false);
      } finally {
        await b.send("Emulation.setTouchEmulationEnabled", { enabled: false });
      }
    });

    test("FT: with reduced motion a swipe steps with no animation", async () => {
      try {
        await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
        await swipeSetup("d-kurd-9", 380, 780);
        await swipe(-60, 0, 150);
        assert.strictEqual(await stepIndex(), 2);
        assert.deepStrictEqual(await anim(), []);
      } finally {
        await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
        await b.send("Emulation.setTouchEmulationEnabled", { enabled: false });
      }
    });

    test("FT: arrows step with wrap when the card has focus, and a focused radio keeps native stepping", async () => {
      await b.setViewport(380, 780, true);
      await loadPage("d-kurd-9");
      await b.eval(`document.querySelector(".prog .slot:nth-child(1) .cardhost").shadowRoot.querySelector(".flip").focus(); return true;`);
      await b.key("ArrowLeft", "ArrowLeft", 37);
      assert.strictEqual(await stepIndex(), 3, "wraps back to the last");
      await b.key("ArrowRight", "ArrowRight", 39);
      assert.strictEqual(await stepIndex(), 1, "wraps forward to the first");
      await b.eval(`document.querySelector("#p1").focus(); return true;`);
      await b.key("ArrowRight", "ArrowRight", 39);
      assert.strictEqual(await stepIndex(), 2, "native radio arrow steps once");
    });

    test("FT: the flip transition equals the app's and the diagram is the front face, the name the flip", async () => {
      await b.setViewport(380, 780, true);
      await loadPage("d-kurd-9");
      const r = await b.eval(`
        const sr = document.querySelector(".prog .slot:nth-child(1) .cardhost").shadowRoot;
        const inner = getComputedStyle(sr.querySelector(".inner"));
        return { tr: inner.transitionDuration + " " + inner.transitionTimingFunction, persp: getComputedStyle(sr.querySelector(".wrap")).perspective,
          front: getComputedStyle(sr.querySelector(".front")).transform, back: getComputedStyle(sr.querySelector(".back")).transform };`);
      assert.strictEqual(r.tr, "0.45s cubic-bezier(0.2, 0.7, 0.25, 1)");
      assert.strictEqual(r.persp, "1400px");
      assert.notStrictEqual(r.front, "none");
      assert.ok(r.back === "none" || r.back === "matrix(1, 0, 0, 1, 0, 0)", r.back);
      await tap(".prog .slot:nth-child(1) .cardhost");
      await b.waitFor(`(() => { const s = document.querySelector(".prog .slot:nth-child(1)"); return getComputedStyle(s.querySelector(".cardhost").shadowRoot.querySelector(".inner")).transform.indexOf("matrix3d(-1") === 0; })()`, { label: "flip finished" });
      assert.ok((await faceTransform(".inner")).indexOf("matrix3d(-1") === 0, "the flip turns the card to the name face");
    });

    test("FT: at 380x780 nothing scrolls sideways before, during and after a swipe", async () => {
      try {
        await swipeSetup("e-amara-20", 380, 780);
        const wide = () => b.eval(`return document.documentElement.scrollWidth > innerWidth;`);
        assert.strictEqual(await wide(), false);
        const c = await hostCenter();
        const t0 = Math.max(Date.now() / 1000, lastTouch + 0.05);
        lastTouch = t0 + 1;
        await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y }], timestamp: t0 });
        for (let i = 1; i <= 6; i++) await b.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: c.x - 25 * i, y: c.y }], timestamp: t0 + 0.03 * i });
        assert.strictEqual(await wide(), false, "during");
        await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], timestamp: t0 + 0.4 });
        await new Promise((r) => setTimeout(r, 600));
        assert.strictEqual(await wide(), false, "after");
      } finally {
        await b.send("Emulation.setTouchEmulationEnabled", { enabled: false });
      }
    });

    test("FT: a mouse drag at 1280x800 steps forward and back, a short drag springs back, a click flips, and nothing is selected", async () => {
      await mouseSetup("d-kurd-9", 1280, 800);
      await mouseDrag(-80);
      assert.strictEqual(await stepIndex(), 2, "drag left steps forward");
      assert.strictEqual(await flipped(), false, "the click ending a drag does not flip");
      assert.strictEqual(await b.eval(`return String(window.getSelection()).length;`), 0, "no text selection");
      await b.eval(`document.querySelector(".prog .slot:nth-child(2) .cardhost").scrollIntoView({ block: "center" }); return true;`);
      await mouseDrag(80);
      assert.strictEqual(await stepIndex(), 1, "drag right steps back");
      await mouseDrag(-14);
      assert.strictEqual(await stepIndex(), 1, "a short drag steps nothing");
      assert.strictEqual(await flipped(), false, "a short drag flips nothing");
      await tap(".prog .slot:nth-child(1) .cardhost");
      assert.strictEqual(await flipped(), true, "a plain click flips");
    });

    const wheelOn = async (dx, dy) => {
      const c = await hostCenter();
      await b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: c.x, y: c.y, deltaX: dx, deltaY: dy });
    };

    test("FT: a horizontal trackpad wheel gesture steps once per gesture, a vertical one and a short one step nothing", async () => {
      await mouseSetup("d-kurd-9", 1280, 800);
      for (const dx of [30, 30, 30, 30]) await wheelOn(dx, 0);
      await new Promise((r) => setTimeout(r, 600));
      assert.strictEqual(await stepIndex(), 2, "deltaX past 80 steps forward once");
      for (const dx of [-30, -30, -30, -30]) await wheelOn(dx, 0);
      await new Promise((r) => setTimeout(r, 600));
      assert.strictEqual(await stepIndex(), 1, "negative deltaX steps back once");
      await wheelOn(20, 0);
      await new Promise((r) => setTimeout(r, 400));
      assert.strictEqual(await stepIndex(), 1, "a short gesture steps nothing");
      for (const dy of [60, 60, 60]) await wheelOn(0, dy);
      await new Promise((r) => setTimeout(r, 400));
      assert.strictEqual(await stepIndex(), 1, "a vertical gesture steps nothing");
    });

    const wheelEv = (dx, dy, o = {}) => b.eval(`
      const h = document.querySelector(".prog .slot:nth-child(1) .cardhost");
      const e = new WheelEvent("wheel", { deltaX: ${dx}, deltaY: ${dy}, deltaMode: ${o.mode || 0}, ctrlKey: ${!!o.ctrl}, bubbles: true, cancelable: true });
      h.dispatchEvent(e);
      return { prevented: e.defaultPrevented, tf: h.style.transform };`);
    const pause = (ms) => new Promise((r) => setTimeout(r, ms));

    test("scale page wheel: a gesture opening with a zero-delta event still steps once", async () => {
      await mouseSetup("d-kurd-9", 1280, 800);
      await wheelEv(0, 0);
      for (let i = 0; i < 4; i++) await wheelEv(30, 0);
      await pause(600);
      assert.strictEqual(await stepIndex(), 2);
    });

    test("scale page wheel: a momentum tail after a step never fires a second step", async () => {
      await mouseSetup("d-kurd-9", 1280, 800);
      for (let i = 0; i < 4; i++) await wheelEv(30, 0);
      for (let i = 0; i < 25; i++) { await wheelEv(6, 0); await pause(25); }
      await pause(600);
      assert.strictEqual(await stepIndex(), 2);
    });

    const stroke = async (dxs, ms = 16) => { for (const dx of dxs) { await wheelEv(dx, 0); await pause(ms); } };

    test("scale page wheel: SW2 A two swipes back to back, each with a tail, advance two cards", async () => {
      await mouseSetup("d-kurd-9", 1280, 800);
      await stroke([30, 30, 30, 20, 10, 5, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
      await stroke([30, 30, 30, 20, 10, 5, 3, 2, 1, 1]);
      await pause(600);
      assert.strictEqual(await stepIndex(), 3);
    });

    test("scale page wheel: SW2 B one swipe with a long monotone tail with flat repeats steps once", async () => {
      await mouseSetup("d-kurd-9", 1280, 800);
      await stroke([30, 30, 30, 25, 25, 20, 20, 15, 15, 10, 10, 6, 6, 3, 3, 2, 2, 1, 1, 1, 0, 0], 30);
      await pause(600);
      assert.strictEqual(await stepIndex(), 2);
    });

    test("scale page wheel: SW2 C a small bump above a third of the peak does not start a gesture", async () => {
      await mouseSetup("d-kurd-9", 1280, 800);
      await stroke([11, 11, 11, 11, 11, 11, 11, 11, 10, 8, 6, 5, 4, 5, 4, 4, 3, 2, 1], 30);
      await pause(600);
      assert.strictEqual(await stepIndex(), 2);
    });

    test("scale page wheel: SW2 D a second stroke begun during the flight counts once the card lands", async () => {
      await mouseSetup("d-kurd-9", 1280, 800);
      await stroke([30, 30, 30, 5, 2, 1]);
      await stroke(Array(20).fill(30), 20);
      await pause(600);
      assert.strictEqual(await stepIndex(), 3);
    });

    test("scale page wheel: the card follows deltaX below the threshold and springs back", async () => {
      await mouseSetup("d-kurd-9", 1280, 800);
      const r = await wheelEv(30, 0);
      assert.strictEqual(r.prevented, true);
      assert.match(r.tf, /translate3d\(-30px/);
      await pause(400);
      assert.strictEqual((await wheelEv(0, 0)).tf, "");
      assert.strictEqual(await stepIndex(), 1);
    });

    test("scale page wheel: ctrlKey (pinch) never steps", async () => {
      await mouseSetup("d-kurd-9", 1280, 800);
      let r;
      for (let i = 0; i < 6; i++) r = await wheelEv(30, 0, { ctrl: true });
      await pause(500);
      assert.strictEqual(r.prevented, false);
      assert.strictEqual(await stepIndex(), 1);
    });

    test("scale page wheel: deltaMode 1 lines are scaled to pixels like the app", async () => {
      await mouseSetup("d-kurd-9", 1280, 800);
      await wheelEv(6, 0, { mode: 1 });
      await pause(600);
      assert.strictEqual(await stepIndex(), 2);
    });

    test("FT: a sustained wheel stream that runs on through the fly-out steps exactly once, decaying or steady", async () => {
      for (const shape of ["decay", "steady"]) {
        await mouseSetup("d-kurd-9", 1280, 800);
        const c = await hostCenter();
        for (let i = 0; i < 50; i++) {
          const dx = shape === "decay" ? Math.max(1, Math.round(45 * 0.9 ** i)) : 15;
          await b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: c.x, y: c.y, deltaX: dx, deltaY: 0 });
          await new Promise((r) => setTimeout(r, 30));
        }
        await new Promise((r) => setTimeout(r, 600));
        assert.strictEqual(await stepIndex(), 2, shape + " stream: one step, not a second one after the fly");
      }
    });

    test("FT: a vertical mouse drag on the card makes no step and no flip", async () => {
      await mouseSetup("d-kurd-9", 1280, 800);
      const c = await hostCenter();
      await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: c.x, y: c.y, button: "left", buttons: 1, clickCount: 1 });
      for (let i = 1; i <= 8; i++) await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: c.x, y: c.y + 10 * i, button: "left", buttons: 1 });
      await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: c.x, y: c.y + 80, button: "left", clickCount: 1 });
      await new Promise((r) => setTimeout(r, 450));
      assert.strictEqual(await stepIndex(), 1, "no step");
      assert.strictEqual(await flipped(), false, "the click ending a vertical drag does not flip");
    });

    test("FT: with scripts off NEXT still steps, a tap flips and a swipe does nothing", async () => {
      await b.setViewport(380, 780, true);
      await b.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      await b.send("Emulation.setScriptExecutionDisabled", { value: true });
      try {
        await b.send("Page.navigate", { url: pageUrl("d-kurd-10") });
        await new Promise((r) => setTimeout(r, 800));
      } finally {
        await b.send("Emulation.setScriptExecutionDisabled", { value: false });
      }
      try {
        assert.strictEqual(await b.eval(`return document.querySelector(".prog").classList.contains("sw");`), false, "the swipe script never ran");
        await b.eval(`document.querySelector(".prog .slot:nth-child(1) .cardhost").scrollIntoView({ block: "center" }); return true;`);
        await swipe(-60, 0, 150);
        assert.strictEqual(await stepIndex(), 1, "a swipe does nothing");
        await tapTouch();
        assert.strictEqual(await flipped(), true, "a tap flips");
        await tap(".prog .slot:nth-child(1) .nav label:last-child");
        assert.strictEqual(await stepIndex(), 2, "NEXT steps");
      } finally {
        await b.send("Emulation.setTouchEmulationEnabled", { enabled: false });
      }
    });
  });


  describe("MV: the saved-scale handoff to the new host", () => {
    const SV = JSON.parse(fs.readFileSync(path.join(REPO, "tests/fixtures/saved_variants_v1.json"), "utf8"));
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    const OLDSEED = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
    const SEED2 = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4";
    const KURDSEED = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5";
    const rec = (name, s = OLDSEED, o = {}) => ({ v: 4, s, o: { name, ...o } });
    const port = () => server.address().port;
    const OLD = () => `http://127.0.0.1:${port()}`;
    const NEW = () => `http://localhost:${port()}`;
    const on = (cap, deadline) => { moveMode = { from: "127.0.0.1", target: NEW(), cap, deadline }; };
    const envelopeOf = (records, extra = {}, collectionId = SV.ids.collectionA, base = 1) => ({
      schema: 1, collectionId, revision: 1, slotStateRevision: 0,
      entries: records.map((record, i) => ({ instanceId: uid(base + i), revision: 1, displayOrdinal: i + 1, record: clone(record) })),
      usedInstanceIds: records.map((_, i) => uid(base + i)), nextDisplayOrdinal: records.length + 1,
      preferredSelection: records.length ? { kind: "saved", id: uid(base) } : { kind: "builtin", id: "kurd" },
      slots: {}, hidden: [],
      migration: { sourceKey: null, raw: { hpfc: null, "hpfc.scales": null, "hpfc.scales.v3": null }, instanceIds: [] }, ...clone(extra) });
    const payloadOf = (rows, hidden = []) => Buffer.from(JSON.stringify({ r: rows.map(([i, r]) => ({ i, r })), h: hidden })).toString("base64url");
    const clearOrigin = (origin) => b.send("Storage.clearDataForOrigin", { origin, storageTypes: "indexeddb,local_storage" });
    async function go(url, referrer) {
      const blank = onceEvent("Page.loadEventFired", 20000);
      await b.send("Page.navigate", { url: "about:blank" });
      await blank;
      const loaded = onceEvent("Page.loadEventFired", 20000);
      await b.send("Page.navigate", { url, ...(referrer ? { referrer } : {}) });
      await loaded;
      await b.waitFor(APP_READY_EXPR, { timeout: 15000, label: "the page to boot" });
    }
    const bannerReady = `!!document.querySelector('#move-banner button.move-go') && !document.getElementById('move-banner').hidden`;
    const bannerText = () => b.eval(`return document.querySelector('#move-banner .move-banner-msg').textContent;`);
    const pressMove = () => b.click('#move-banner button.move-go');
    async function goOld(url = OLD() + "/index.html", referrer) {
      await go(url, referrer);
      await b.waitFor(bannerReady, { timeout: 15000, label: "the move banner" });
      await pressMove();
    }
    async function peek(origin) {
      const keep = moveMode; moveMode = null;
      try { await go(origin + "/index.html"); return await nativeSavedEnvelope(b); } finally { moveMode = keep; }
    }
    async function seed(origin, records, extra = {}, collectionId = SV.ids.collectionA, base = 1) {
      const keep = moveMode; moveMode = null;
      try {
        await clearOrigin(origin);
        await go(origin + "/index.html");
        await b.eval(`return ${nativeSavedExpression({ write: true, raw: JSON.stringify(envelopeOf(records, extra, collectionId, base)) })};`);
      } finally { moveMode = keep; }
    }
    async function seedLegacy(origin, records) {
      const keep = moveMode; moveMode = null;
      try {
        await clearOrigin(origin);
        await go(origin + "/index.html");
        await b.send("Storage.clearDataForOrigin", { origin, storageTypes: "indexeddb" });
        await b.eval(`localStorage.setItem('hpfc.scales.v3', ${JSON.stringify(JSON.stringify(records))}); return true;`);
      } finally { moveMode = keep; }
    }
    const names = (e) => e.entries.map((row) => row.record.o && row.record.o.name);
    const noticeShown = `!!document.getElementById('move-notice') && !document.getElementById('move-notice').hidden`;
    const noticeText = () => b.eval(`const n=document.getElementById('move-notice');return n&&!n.hidden?n.textContent:null;`);
    const where = () => b.eval(`return {origin:location.origin,hash:location.hash,search:location.search};`);
    const atNew = () => `location.origin===${JSON.stringify(NEW())}`;
    const remove = (name) => b.eval(`const e=savedState,row=e.entries.find(r=>r.record.o.name===${JSON.stringify(name)});
      return commitSaved({type:'delete',collectionId:e.collectionId,instanceId:row.instanceId,expectedRevision:row.revision});`);
    afterEach(async () => { moveMode = null; });

    test("move: the banner is the first element of body and carries no payload in any attribute of the document", async () => {
      on(); await seed(OLD(), [rec("A")]);
      await go(OLD() + "/index.html");
      await b.waitFor(bannerReady, { timeout: 15000, label: "the move banner" });
      assert.strictEqual(await b.eval(`return document.body.firstElementChild.id;`), "move-banner");
      const attrs = await b.eval(`return [...document.querySelectorAll('[href],[action],[formaction]')].flatMap(e => ['href','action','formaction'].map(a => e.getAttribute(a)).filter(v => v !== null));`);
      assert.ok(attrs.length > 0, "the document-wide query finds attributes");
      for (const v of attrs) assert.ok(!/#move=/.test(v), v);
    });

    test("move: the banner is an overlay - the footer stays put, and it does not overflow at 375x580 and 320 wide in all 8 locales", async () => {
      on(undefined, "2026-11-22"); await seed(OLD(), [rec("A"), rec("B", SEED2)]);
      try {
        for (const [w, h] of [[375, 580], [320, 568]]) {
          await b.setViewport(w, h, true);
          await go(OLD() + "/index.html");
          await b.waitFor(bannerReady, { timeout: 15000, label: "the move banner" });
          const footerBottom = () => b.eval(`return document.querySelector('footer').getBoundingClientRect().bottom;`);
          const shown = await footerBottom();
          await b.eval(`document.getElementById('move-banner').hidden = true; return true;`);
          const hidden = await footerBottom();
          assert.strictEqual(shown, hidden, `the banner does not move the footer at ${w}`);
          await b.eval(`document.getElementById('move-banner').hidden = false; return true;`);
          const langs = await b.eval(`return LANGS.slice();`);
          assert.strictEqual(langs.length, 8);
          for (const lang of langs) {
            await b.eval(`setLang(${JSON.stringify(lang)}); return true;`);
            const r = await b.eval(`const el = document.getElementById('move-banner'), r = el.getBoundingClientRect();
              return { sw: el.scrollWidth, cw: el.clientWidth, left: r.left, right: r.right, bottom: r.bottom, vw: innerWidth, vh: innerHeight,
                text: el.querySelector('.move-banner-msg').textContent,
                btns: [...el.querySelectorAll('button')].map(x => { const q = x.getBoundingClientRect(); return q.left >= r.left && q.right <= r.right; }) };`);
            assert.match(r.text, /2026/, `${lang} ${w}: the banner carries the deadline date`);
            assert.ok(r.sw <= r.cw, `${lang} ${w}: horizontal overflow ${r.sw} > ${r.cw}`);
            assert.ok(r.left >= 0 && r.right <= r.vw, `${lang} ${w}: inside the viewport width`);
            assert.ok(r.bottom <= r.vh, `${lang} ${w}: inside the viewport height`);
            assert.ok(r.btns.every(Boolean), `${lang} ${w}: buttons inside the banner`);
          }
        }
      } finally { await b.setViewport(...DEFAULT_VIEWPORT); }
    });

    test("move: the banner covers no footer control and no top menu control at 375x580, 320x568, 1280x800, 667x375, 568x320 and 844x390", async () => {
      on(undefined, "2026-11-22"); await seed(OLD(), [rec("A")]);
      try {
        for (const [w, h] of [[375, 580], [320, 568], [1280, 800], [667, 375], [568, 320], [844, 390]]) {
          await b.setViewport(w, h, w < 900);
          await go(OLD() + "/index.html");
          await b.waitFor(bannerReady, { timeout: 15000, label: "the move banner" });
          const hits = await b.eval(`return ['#prev','#next','#shuffle','#count','#settings-trigger','#share-copy'].map(sel => {
            const el = document.querySelector(sel), r = el.getBoundingClientRect();
            if (!r.width || !r.height) return { sel, ok: true, skipped: true };
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return { sel, ok: !!hit && (hit === el || el.contains(hit)), hit: hit && (hit.id || hit.className || hit.tagName) };
          });`);
          for (const sel of ["#prev", "#next", "#shuffle", "#count"]) assert.ok(!hits.find(x => x.sel === sel).skipped, `${w}x${h}: ${sel} is rendered`);
          for (const x of hits) assert.ok(x.ok, `${w}x${h}: ${x.sel} is covered by ${x.hit}`);
          const top = await b.eval(`const r = document.getElementById('move-banner').getBoundingClientRect(); return r.top < innerHeight / 2;`);
          assert.ok(top, `${w}x${h}: the banner sits in the top half`);
        }
      } finally { await b.setViewport(...DEFAULT_VIEWPORT); }
    });

    test("move: a crafted #move= link with no MOVE_FROM referrer writes nothing and opens the then hash", async () => {
      on(); await clearOrigin(NEW());
      await go(`${NEW()}/index.html#move=${payloadOf([[uid(1), rec("CRAFTED")]])}&then=${encodeURIComponent("#deck=f-low-pygmy-18")}`);
      assert.strictEqual((await where()).hash, "#deck=f-low-pygmy-18");
      assert.deepStrictEqual((await nativeSavedEnvelope(b)).entries, []);
    });

    test("move: revisit after edit/delete re-imports nothing - edit then delete a scale on the new host, revisit old /, no duplicate and no resurrection", async () => {
      on(); await clearOrigin(NEW());
      await seed(OLD(), [rec("ONE"), rec("TWO", SEED2)]);
      await goOld();
      await b.waitFor(`${atNew()} && ${noticeShown}`, { label: "the notice" });
      const first = await nativeSavedEnvelope(b);
      assert.deepStrictEqual(names(first).sort(), ["ONE", "TWO"]);
      assert.ok(Array.isArray(first.importedIds) && first.importedIds.length === 2);
      await remove("TWO");
      await b.eval(`const e=savedState,row=e.entries.find(r=>r.record.o.name==='ONE'),
        built=buildGenerated(row.record.s,{...row.record.o,name:'ONE EDITED'});
        return commitSaved({type:'edit',collectionId:e.collectionId,instanceId:row.instanceId,expectedRevision:row.revision,
          candidate:{record:scaleRecord(seedOf(built.value)),deck:built.value}});`);
      await goOld();
      await b.waitFor(atNew(), { label: "the second jump" });
      await sleep(500);
      const after = await nativeSavedEnvelope(b);
      assert.deepStrictEqual(names(after), ["ONE EDITED"]);
      assert.deepStrictEqual(after.importedIds, first.importedIds);
    });

    test("move: seeded merge - a moved replacement of a seed the new host already replaced imports as an ordinary custom scale with its name kept", async () => {
      on();
      await seed(NEW(), [rec("NEW KURD", KURDSEED, { replaces: "kurd" })], { slots: { kurd: uid(9) } }, SV.ids.collectionB, 9);
      await seed(OLD(), [rec("OLD KURD", KURDSEED, { replaces: "kurd" })], { slots: { kurd: uid(1) } });
      await goOld();
      await b.waitFor(`${atNew()} && ${noticeShown}`, { label: "the notice" });
      const e = await nativeSavedEnvelope(b);
      assert.strictEqual(e.slots.kurd, uid(9));
      const moved = e.entries.find((row) => row.record.o.name === "OLD KURD");
      assert.ok(moved, "the moved record is imported");
      assert.strictEqual(moved.record.o.replaces, undefined);
    });

    test("move: seeded merge - moved hidden ids join the new list only for seeds the new host has no record for", async () => {
      on();
      await seed(NEW(), [rec("NEW HIJAZ", "(C#3) G#3 B3 C#4 D4 F4 F#4 G#4", { replaces: "hijaz" })], { slots: { hijaz: uid(9) } }, SV.ids.collectionB, 9);
      await seed(OLD(), [], { hidden: ["hijaz", "pygmy"] });
      await goOld();
      await b.waitFor(atNew(), { label: "the jump" });
      await sleep(800);
      const e = await peek(NEW());
      assert.ok(e.hidden.includes("pygmy"), "a seed without a record is hidden");
      assert.ok(!e.hidden.includes("hijaz"), "a replaced seed stays visible");
    });

    test("move: pressing the button twice, from two loads of the old host, imports each record once", async () => {
      on(); await clearOrigin(NEW());
      await seed(OLD(), [rec("A"), rec("B", SEED2), rec("C", "(D3) A3 C4 D4 E4 F4 G4 A4")]);
      await goOld();
      await b.waitFor(`${atNew()} && ${noticeShown}`, { label: "the notice" });
      await goOld();
      await b.waitFor(atNew(), { label: "the second move" });
      await sleep(800);
      assert.deepStrictEqual(names(await peek(NEW())).sort(), ["A", "B", "C"]);
    });

    test("T-E1: a real click on the banner button lands on the new host with the origin referrer, every scale arrives, and the notice counts them", async () => {
      on(); await clearOrigin(NEW());
      const eight = Array.from({ length: 8 }, (_, i) => rec(`E${i + 1}`, i % 2 ? SEED2 : OLDSEED));
      await seed(OLD(), eight);
      await go(OLD() + "/index.html");
      await b.waitFor(bannerReady, { label: "the move banner" });
      assert.strictEqual((await where()).origin, OLD(), "nothing navigated at boot");
      await sleep(500);
      assert.strictEqual((await where()).origin, OLD(), "still on the old host");
      await pressMove();
      await b.waitFor(`${atNew()} && ${noticeShown}`, { label: "the notice" });
      assert.strictEqual(await b.eval(`return new URL(document.referrer).hostname;`), "127.0.0.1");
      assert.strictEqual(await noticeText(), "Your 8 saved scales moved here.");
      assert.deepStrictEqual(names(await nativeSavedEnvelope(b)).sort(), eight.map((r) => r.o.name).sort());
    });

    test("T-E2: n200 over the cap says so before the click, one click moves the largest prefix that fits, and Back finds the banner and all 200 still on the old host", async () => {
      on(); await clearOrigin(NEW());
      const many = Array.from({ length: 200 }, (_, i) => rec(`S${i + 1} ${"x".repeat(30)}`));
      await seed(OLD(), many);
      await go(OLD() + "/index.html");
      await b.waitFor(bannerReady, { label: "the move banner" });
      const line = await bannerText();
      const fit = /(\d+) of your 200 saved scales fit in one move\. The rest stay here at this address\./.exec(line);
      assert.ok(fit, line);
      const n = Number(fit[1]);
      assert.ok(n > 0 && n < 200, String(n));
      await pressMove();
      await b.waitFor(`${atNew()} && ${noticeShown}`, { label: "the notice" });
      assert.deepStrictEqual(names(await nativeSavedEnvelope(b)), many.slice(0, n).map((r) => r.o.name));
      await b.eval(`history.back();return true;`);
      await b.waitFor(`location.origin===${JSON.stringify(OLD())} && ${bannerReady}`, { label: "Back to the old host" });
      assert.strictEqual(await bannerText(), line);
      assert.strictEqual((await nativeSavedEnvelope(b)).entries.length, 200);
    });

    test("T-E3: an old-host #s= link and a #deck= link open on the old host with the banner and the route intact", async () => {
      on();
      await seed(OLD(), [rec("A")]);
      const keep = moveMode; moveMode = null;
      const code = await b.eval(`const s=HPE.core.parseSeed(${JSON.stringify(OLDSEED)});return HPE.share.encode({fields:s.value.fields,options:{}}).value;`);
      moveMode = keep;
      await go(`${OLD()}/index.html#s=${code}`);
      await b.waitFor(bannerReady, { label: "the move banner" });
      assert.strictEqual((await where()).origin, OLD());
      assert.ok((await where()).hash.startsWith("#s="), (await where()).hash);
      await go(`${OLD()}/index.html#deck=f-low-pygmy-18`);
      await b.waitFor(bannerReady, { label: "the move banner" });
      assert.strictEqual((await where()).origin, OLD());
      assert.strictEqual((await where()).hash, "#deck=f-low-pygmy-18");
    });

    test("move: #move= is stripped to the then hash before render, and Back or reload does not re-import", async () => {
      on(); await clearOrigin(NEW());
      await go(`${NEW()}/index.html#move=${payloadOf([[uid(1), rec("ONE")]])}&then=${encodeURIComponent("#deck=f-low-pygmy-18")}`, OLD() + "/");
      assert.strictEqual((await where()).hash, "#deck=f-low-pygmy-18");
      assert.deepStrictEqual(names(await nativeSavedEnvelope(b)), ["ONE"]);
      await remove("ONE");
      await go(`${NEW()}/index.html#deck=f-low-pygmy-18`, OLD() + "/");
      assert.ok(!(await where()).hash.includes("move="));
      assert.deepStrictEqual(names(await nativeSavedEnvelope(b)), [], "reload re-imports nothing");
    });

    test("move: a #s= link opened on the old host with an empty store is carried through the click and opens on the new host", async () => {
      on();
      await seed(OLD(), []);
      const keep = moveMode; moveMode = null;
      const code = await b.eval(`const s=HPE.core.parseSeed(${JSON.stringify(OLDSEED)});return HPE.share.encode({fields:s.value.fields,options:{}}).value;`);
      moveMode = keep;
      await goOld(`${OLD()}/index.html#s=${code}`);
      await b.waitFor(`${atNew()} && /^#(s=|deck=)/.test(location.hash)`, { label: "the jump with the link carried" });
      await b.waitFor(APP_READY_EXPR, { timeout: 15000, label: "the new host to boot" });
      assert.ok(/^#(s=|deck=)/.test((await where()).hash), "the link is carried");
    });

    test("move: a payload over MOVE_CAP still forwards, carrying only the prefix that fits, and old storage is untouched", async () => {
      on(50); await clearOrigin(NEW());
      await seed(OLD(), [rec("A"), rec("B", SEED2)]);
      await goOld();
      await b.waitFor(atNew(), { label: "the jump" });
      await sleep(800);
      assert.strictEqual(await noticeText(), null);
      assert.deepStrictEqual(names(await peek(NEW())), []);
      assert.deepStrictEqual(names(await peek(OLD())).sort(), ["A", "B"]);
    });

    test("move: a store held only in legacy storage keys forwards every record", async () => {
      on(); await clearOrigin(NEW());
      await seedLegacy(OLD(), [rec("L1"), rec("L2", SEED2), rec("L3", "(D3) A3 C4 D4 E4 F4 G4 A4")]);
      await goOld();
      await b.waitFor(atNew(), { label: "the jump" });
      await sleep(800);
      assert.deepStrictEqual(names(await peek(NEW())).sort(), ["L1", "L2", "L3"]);
    });

    test("move: a non-ASCII-named record moves by the normal path and shows its chip on the new host", async () => {
      on(); await clearOrigin(NEW());
      const prod = [rec("Caf\u00e9 \u65e5\u672c"), rec("Caf\u00e9 \u2713", SEED2), rec("ASCII", "(D3) A3 C4 D4 E4 F4 G4 A4")];
      await seed(OLD(), prod);
      await goOld();
      await b.waitFor(atNew(), { label: "the jump" });
      await sleep(800);
      assert.deepStrictEqual(names(await peek(NEW())).sort(), ["ASCII", "Caf\u00e9 \u2713", "Caf\u00e9 \u65e5\u672c"]);
      const chips = await b.eval(`return [...document.querySelectorAll('#decks .chip')].map(c=>c.getAttribute('aria-label')||c.textContent);`);
      for (const n of ["Caf\u00e9 \u65e5\u672c", "Caf\u00e9 \u2713"]) {
        assert.strictEqual(chips.filter((c) => c.includes(n)).length, 1, "one chip for " + n);
      }
      assert.deepStrictEqual(names(await peek(OLD())).sort(), ["ASCII", "Caf\u00e9 \u2713", "Caf\u00e9 \u65e5\u672c"], "the old store is untouched");
    });

    test("move: paired-area rev 1 and rev 2 records arrive byte-identical", async () => {
      on(); await clearOrigin(NEW());
      const keep = moveMode; moveMode = null;
      await go(OLD() + "/index.html");
      const prof = await b.eval(`const f=HPE.core.parseSeed(${JSON.stringify(OLDSEED)}).value.fields;return HPE.layout.proposeProfile(f).value.map;`);
      moveMode = keep;
      const v5 = (name, rev) => ({ v: 5, s: OLDSEED, o: { name, palette: 1, profile: { id: "paired", rev, map: prof } } });
      const records = [v5("PAIRED ONE", 1), v5("PAIRED TWO", 2), rec("ACOUSTIC", SEED2)];
      await seed(OLD(), records);
      await goOld();
      await b.waitFor(atNew(), { label: "the jump" });
      await sleep(800);
      const byName = (x, y) => x.o.name.localeCompare(y.o.name);
      const arrived = (await peek(NEW())).entries.map((row) => row.record).sort(byName);
      assert.deepStrictEqual(arrived, [...records].sort(byName));
    });

    test("move: a NEEDS_NEWER_APP record in the payload is carried as opaque bytes and the rest import", async () => {
      on(); await clearOrigin(NEW());
      const future = { v: 99, s: "future", o: {} };
      await go(`${NEW()}/index.html#move=${payloadOf([[uid(1), rec("GOOD")], [uid(2), future]])}&then=`, OLD() + "/");
      await b.waitFor(noticeShown, { label: "the notice" });
      const rows = (await nativeSavedEnvelope(b)).entries.map((row) => row.record);
      assert.strictEqual(rows.length, 2);
      assert.ok(rows.some((r) => r.o.name === "GOOD"));
      assert.deepStrictEqual(rows.find((r) => r.v === 99), future);
    });

    test("move: the notice shows the singular and plural counts only after the write commits", async () => {
      on(); await clearOrigin(NEW());
      await go(`${NEW()}/index.html#move=${payloadOf([[uid(1), rec("ONE")]])}&then=`, OLD() + "/");
      await b.waitFor(noticeShown, { label: "the notice" });
      assert.strictEqual(await noticeText(), "Your saved scale moved here.");
      assert.strictEqual((await nativeSavedEnvelope(b)).entries.length, 1, "committed before the notice");
      await clearOrigin(NEW());
      await go(`${NEW()}/index.html#move=${payloadOf([[uid(1), rec("ONE")], [uid(2), rec("TWO", SEED2)]])}&then=`, OLD() + "/");
      await b.waitFor(noticeShown, { label: "the notice" });
      assert.strictEqual(await noticeText(), "Your 2 saved scales moved here.");
    });

    test("move: failed write retries - the still-at-the-old-address message shows, importedIds in the IDB saved collection is unchanged, and the next visit imports every record once", async () => {
      on(); await clearOrigin(NEW());
      await seed(OLD(), [rec("A"), rec("B", SEED2)]);
      await go(NEW() + "/index.html");
      await b.eval(`localStorage.setItem('moveFail','1');return true;`);
      await goOld();
      await b.waitFor(noticeShown, { label: "the failure message" });
      assert.match(await noticeText(), /still at the old address/);
      const failed = await nativeSavedEnvelope(b);
      assert.deepStrictEqual(failed.entries, []);
      assert.ok(!failed.importedIds || failed.importedIds.length === 0);
      await b.eval(`localStorage.removeItem('moveFail');return true;`);
      await goOld();
      await b.waitFor(`${atNew()} && ${noticeShown}`, { label: "the notice" });
      assert.deepStrictEqual(names(await nativeSavedEnvelope(b)).sort(), ["A", "B"]);
    });

    test("move: a click on an old path lands on the new host in one hop with its search and fragment, keeps the old host in Back history, and the new host has no redirect", async () => {
      on(); await clearOrigin(NEW());
      await seed(OLD(), [rec("A")]);
      await go(`${OLD()}/index.html?x=1#deck=f-low-pygmy-18`);
      await b.waitFor(bannerReady, { timeout: 15000, label: "the move banner" });
      const history = async () => { const h = await b.send("Page.getNavigationHistory"); return { at: h.currentIndex, urls: h.entries.map((e) => e.url) }; };
      const old = await history();
      assert.ok(old.urls[old.at].startsWith(OLD()), "the old page is current before the click");
      await pressMove();
      await b.waitFor(`${atNew()} && !location.hash.startsWith('#move=')`, { label: "the jump settled" });
      const w = await where();
      assert.strictEqual(w.search, "?x=1");
      assert.ok(w.hash.startsWith("#deck=") || w.hash === "", `hash ${w.hash.slice(0, 40)}`);
      const after = await history();
      assert.ok(after.urls[after.at].startsWith(NEW()), "the new host is the current entry");
      assert.ok(after.urls[after.at - 1].startsWith(`${OLD()}/index.html?x=1`), "Back goes to the old page, not a replaced entry");
      assert.strictEqual(after.urls.length, after.at + 1, "the hop leaves nothing ahead of it");
      await go(NEW() + "/index.html");
      assert.strictEqual((await where()).origin, NEW(), "the new host does not redirect");
    });

    test("move: an empty or malformed referrer imports nothing and the then hash opens", async () => {
      on(); await clearOrigin(NEW());
      const link = `${NEW()}/index.html#move=${payloadOf([[uid(1), rec("X")]])}&then=${encodeURIComponent("#deck=f-low-pygmy-18")}`;
      await go(link);
      assert.strictEqual((await where()).hash, "#deck=f-low-pygmy-18");
      assert.deepStrictEqual((await nativeSavedEnvelope(b)).entries, []);
      await go(link, "http://evil.example/");
      assert.strictEqual((await where()).hash, "#deck=f-low-pygmy-18");
      assert.deepStrictEqual((await nativeSavedEnvelope(b)).entries, []);
    });

    test("move: neither host sends a Referrer-Policy stricter than strict-origin-when-cross-origin", () => {
      const html = fs.readFileSync(path.join(REPO, "index.html"), "utf8");
      assert.ok(!/<meta[^>]+name=["']referrer["']/i.test(html), "no referrer meta");
      const headers = fs.readFileSync(path.join(REPO, "_headers"), "utf8");
      for (const m of headers.matchAll(/Referrer-Policy:\s*(\S+)/gi))
        assert.ok(["strict-origin-when-cross-origin", "no-referrer-when-downgrade", "origin-when-cross-origin", "unsafe-url"].includes(m[1].toLowerCase()), m[1]);
    });

    test("move: re-flip after a rollback imports only records saved on the old host meanwhile, no duplicates", async () => {
      on(); await clearOrigin(NEW());
      await seed(OLD(), [rec("A")]);
      await goOld();
      await b.waitFor(`${atNew()} && ${noticeShown}`, { label: "the notice" });
      await seed(OLD(), [rec("A"), rec("B", SEED2)]);
      await goOld();
      await b.waitFor(atNew(), { label: "the second jump" });
      await sleep(800);
      assert.deepStrictEqual(names(await peek(NEW())).sort(), ["A", "B"]);
    });
  });

}

