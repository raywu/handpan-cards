// Minimal Chrome DevTools Protocol driver - zero dependencies.
// Node 22 ships a global WebSocket, and a Chromium binary is already present on
// CI runners and dev machines, so this replaces a full browser-automation
// dependency with ~120 lines we own.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CANDIDATES = [
  process.env.CHROME_BIN,
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

function findBrowser() {
  for (const c of CANDIDATES) {
    if (c && fs.existsSync(c)) return c;
  }
  for (const dir of ["/opt/pw-browsers", "/root/.cache/ms-playwright"]) {
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir)) {
      for (const leaf of ["chrome-linux/chrome", "chrome-linux/headless_shell"]) {
        const p = path.join(dir, e, leaf);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Reaping. A launched browser is a real OS process plus a real profile
// directory, and close() - the only cleanup there used to be - runs from the
// suite's after() hook. Two paths never reach it: a launch() that rejects after
// spawn, and a suite killed by a signal (SUITE_TIMEOUT in mutation_check.sh and
// NODE_TIMEOUT in suite_health.py both SIGTERM an overrunning run). Either way
// the browser root was reparented to init and stayed alive, and its
// hpfc-prof-* directory stayed on disk. Every live browser is therefore
// registered here, and reaped from process teardown as well as from close().
// ---------------------------------------------------------------------------
const LIVE = new Set();

// The one definition of "the app has booted", shared by Browser.goto() below
// and tests/e2e.test.js's navigate() - see goto() for why they are not fully
// merged (a reload has a staleness check with nothing to be stale against on
// the very first load).
const APP_READY_EXPR =
  `document.readyState === "complete" && !!document.querySelector("#count")?.textContent`;

// A synchronous sleep. The 'exit' handler cannot await, and the wait below has
// to happen there too.
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function reap(entry) {
  if (!entry) return;
  LIVE.delete(entry);
  // Kill the GROUP, not just the root. Chrome is one root plus four children;
  // signalling only the root leaves the renderers running for a few more
  // milliseconds, and on Linux one of them recreates --user-data-dir straight
  // after the rmSync - CI failed exactly that way ("the profile directory
  // survived") while the root was already gone. launch() spawns detached so
  // the browser leads its own group and the whole tree dies at once.
  try { process.kill(-entry.proc.pid, "SIGKILL"); }
  catch { try { entry.proc.kill("SIGKILL"); } catch {} }
  // And then remove the profile, retrying briefly in case a dying child wins
  // the race anyway. Bounded at 100ms: this runs on the way out of a killed
  // suite, which must never become a hang.
  for (let i = 0; i < 5; i++) {
    try { fs.rmSync(entry.profileDir, { recursive: true, force: true }); } catch {}
    if (!fs.existsSync(entry.profileDir)) return;
    sleepSync(20);
  }
}

function reapAll() {
  for (const entry of [...LIVE]) reap(entry);
}

let reaperInstalled = false;
function installReaper() {
  if (reaperInstalled) return;
  reaperInstalled = true;
  // 'exit' cannot await anything - kill() and rmSync() are both synchronous,
  // which is the whole reason the reaper is shaped this way.
  process.on("exit", reapAll);
  for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
    const handler = () => {
      reapAll();
      // Installing a handler REPLACES node's default action for the signal, so
      // not re-raising here would turn "kill the overrunning suite" into "hang
      // forever" - a worse bug than the leak. Step aside and let the signal
      // land: with no listeners left the default terminates the process; if
      // something else is listening, that owner decides.
      process.off(sig, handler);
      if (process.listenerCount(sig) === 0) {
        try { process.kill(process.pid, sig); } catch { process.exit(1); }
      }
    };
    process.on(sig, handler);
  }
}

class Browser {
  constructor(proc, ws, profileDir, entry) {
    this.proc = proc; this.ws = ws; this.profileDir = profileDir;
    this.entry = entry || { proc, profileDir };
    this.id = 0; this.pending = new Map(); this.sessionId = null;
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      const p = this.pending.get(msg.id);
      if (p) {
        clearTimeout(p.timer);          // else the timer holds the event loop
        this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      }
    });
  }
  send(method, params = {}, useSession = true) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (useSession && this.sessionId) payload.sessionId = this.sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((res, rej) => {
      const timer = setTimeout(() => {
        if (this.pending.delete(id)) rej(new Error("CDP timeout: " + method));
      }, 20000);
      if (typeof timer.unref === "function") timer.unref();
      this.pending.set(id, { resolve: res, reject: rej, timer });
    });
  }
  // Evaluate in page and return the JSON value.
  async eval(expr) {
    const r = await this.send("Runtime.evaluate", {
      expression: `(() => { ${expr} })()`, returnByValue: true, awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error("page error: " + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails));
    return r.result.value;
  }
  async goto(url) {
    await this.send("Page.navigate", { url });
    // Poll for the app to have booted rather than trusting a load event: the
    // Google Fonts <link> is render-blocking, so readyState alone is not enough.
    // APP_READY_EXPR is the one definition of "booted" this navigator and
    // tests/e2e.test.js's navigate() both poll for (finding 17, quality
    // refactor 2026-09-30) - navigate() layers its own staleness check on top
    // for a reload, which this first-ever load has nothing to be stale against.
    const deadline = Date.now() + 15000;
    for (;;) {
      const ready = await this.eval(`return ${APP_READY_EXPR};`).catch(() => false);
      if (ready) return;
      if (Date.now() > deadline) throw new Error("page never became ready: " + url);
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  // Poll a page-side predicate until true. Use this instead of fixed sleeps:
  // the card flip is a 450ms CSS transition, so computed transforms read as the
  // identity matrix immediately after a click.
  async waitFor(expr, { timeout = 5000, label = "condition" } = {}) {
    const deadline = Date.now() + timeout;
    for (;;) {
      if (await this.eval(`return !!(${expr});`).catch(() => false)) return true;
      if (Date.now() > deadline) throw new Error("timed out waiting for " + label);
      await new Promise((r) => setTimeout(r, 40));
    }
  }
  // Let CSS/WAAPI animations finish. Finding 6 (quality refactor 2026-09-30):
  // this used to be a fixed 500ms sleep, paid by all ~76 call sites whether or
  // not anything was actually animating. Wait one frame so a just-started
  // animation is registered, then poll getAnimations() until it is empty,
  // with the old 500ms kept as a CEILING - not a guaranteed wait - so a
  // stuck/never-clearing animation still bounds the suite the way the fixed
  // sleep always did, instead of hanging it.
  async settle() {
    await this.eval(`return new Promise(r => requestAnimationFrame(r));`);
    const deadline = Date.now() + 500;
    for (;;) {
      const n = await this.eval(`return document.getAnimations().length;`);
      if (n === 0) return;
      if (Date.now() > deadline) return;
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  async setViewport(width, height, mobile = true) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width, height, deviceScaleFactor: 1, mobile,
      screenWidth: width, screenHeight: height,
    });
  }
  /* Shrink the VISUAL viewport the way a soft keyboard does, and only that
   * way: innerHeight is left alone, which is the whole distinction kbCap()
   * exists to read. Shadows the two properties as own, configurable values on
   * the visualViewport INSTANCE (they are prototype getters, so this is the
   * only handle) and then fires a real resize, so the page's own listener runs
   * the production code path end to end.
   *
   * What this proves: the wiring - the listener, kbOffset/kbCap, and both
   * style writes. What it does NOT prove: that a real iOS keyboard shrinks
   * visualViewport.height at all. No CDP soft-keyboard emulation exists, so
   * that premise stays an owner-device claim (queue rows 51, 67).
   *
   * The shadowing lives on the document, so it does NOT survive goto(). Fake
   * after the last navigation, never before - a test that navigates in between
   * silently gets an unshrunk page and passes for the wrong reason. */
  async fakeKeyboard(vvHeight, vvOffsetTop = 0) {
    return this.eval(`
      const vv = window.visualViewport;
      Object.defineProperty(vv, "height", { value: ${vvHeight}, configurable: true });
      Object.defineProperty(vv, "offsetTop", { value: ${vvOffsetTop}, configurable: true });
      vv.dispatchEvent(new Event("resize"));
      return { innerHeight: window.innerHeight, vvHeight: vv.height, vvOffsetTop: vv.offsetTop };
    `);
  }
  /* Put the real prototype getters back and fire one more resize, so the page
   * sees the keyboard close. Deleting the own properties is what restores
   * them; assigning a large height would leave the shadowing in place for
   * every test after this one. Call it in a finally - this file shares ONE
   * browser session, and a leaked shadow is indistinguishable from a bug in
   * whatever runs next. */
  async clearKeyboard() {
    return this.eval(`
      const vv = window.visualViewport;
      delete vv.height;
      delete vv.offsetTop;
      vv.dispatchEvent(new Event("resize"));
      return { innerHeight: window.innerHeight, vvHeight: vv.height };
    `);
  }
  /* A REAL pinch-zoom, not a fake: setPageScaleFactor shrinks the visual
   * viewport and raises visualViewport.scale exactly as two fingers do. This
   * is global page state, not per-test - always restore it with
   * setPageScale(1) in a finally. */
  async setPageScale(factor) {
    await this.send("Emulation.setPageScaleFactor", { pageScaleFactor: factor });
  }
  async click(selector) {
    const box = await this.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error("no element: " + ${JSON.stringify(selector)});
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    `);
    for (const type of ["mousePressed", "mouseReleased"]) {
      await this.send("Input.dispatchMouseEvent", {
        type, x: box.x, y: box.y, button: "left", clickCount: 1,
      });
    }
  }
  async key(key, code, keyCode) {
    for (const type of ["keyDown", "keyUp"]) {
      await this.send("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
    }
  }
  async swipe(selector, dx) {
    const box = await this.eval(`
      const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    `);
    const pt = (x) => [{ x, y: box.y, radiusX: 4, radiusY: 4, force: 1, id: 1 }];
    await this.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(box.x) });
    await this.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(box.x + dx) });
    await this.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  // Timed drag, touch or mouse, for the swipe suite (M1: CDP timestamp deltas
  // are honoured, so no wall-clock sleeps are needed for a timed gesture).
  // pts is [[dx, ms], ...] or [[dx, ms, dy], ...] for a diagonal/vertical leg.
  async drag(selector, pts, { pointer = "touch", release = true, y0 = 0 } = {}) {
    await this.waitForPendingSettle();
    const box = await this.eval(`
      const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    `);
    const t0 = Date.now() / 1000;
    const at = (dx, dy) => ({ x: box.x + dx, y: box.y + y0 + (dy || 0) });
    const last = pts.length ? pts[pts.length - 1] : [0, 0, 0];
    if (pointer === "touch") {
      const tp = (dx, dy) => [{ ...at(dx, dy), radiusX: 4, radiusY: 4, force: 1, id: 1 }];
      await this.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: tp(0, 0), timestamp: t0 });
      for (const [dx, ms, dy] of pts) {
        await this.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: tp(dx, dy), timestamp: t0 + ms / 1000 });
      }
      if (release) {
        await this.armPendingSettle();
        await this.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], timestamp: t0 + last[1] / 1000 });
        this.settleAfterRealRelease();
      }
    } else {
      const p0 = at(0, 0);
      await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p0.x, y: p0.y, button: "left", clickCount: 1, timestamp: t0 });
      for (const [dx, ms, dy] of pts) {
        const p = at(dx, dy);
        await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y, buttons: 1, timestamp: t0 + ms / 1000 });
      }
      if (release) {
        const p = at(last[0], last[2]);
        await this.armPendingSettle();
        await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1, timestamp: t0 + last[1] / 1000 });
        this.settleAfterRealRelease();
      }
    }
  }
  // A real touchend/mouseup releases the element's pointer capture (if any)
  // asynchronously via a trusted lostpointercapture - if a caller moves on
  // (e.g. a fresh page load for the next test) before that fires, Chrome can
  // deliver it late, against whatever now occupies the same element/pointer
  // id, and cancel a drag that never asked for it. Wait for one (there may be
  // none, if the element never captured) and then let two real animation
  // frames pass so Chrome's own capture bookkeeping for the old pointer id
  // has drained before it gets reused.
  //
  // This is deliberately NOT awaited by the caller that just released: a
  // test that inspects page/animation state right after its own drag ends
  // (e.g. counting in-flight animations) must see that state immediately,
  // not after several real animation frames have been allowed to pass. The
  // wait is instead stashed as a pending promise and paid for by whichever
  // NEXT real press this browser makes (drag(), or a test-local press that
  // calls waitForPendingSettle() first) - that is the only place the actual
  // race (a stale lostpointercapture landing on a fresh capture) can bite.
  // Arms the lostpointercapture listener. Must be called (and awaited)
  // BEFORE the real touchend/mouseup is dispatched, or the trusted event -
  // which can fire before this function would otherwise get around to
  // attaching the listener - is missed entirely and every settle below
  // degrades to its full timeout. See endMouseDragForReal (tests/e2e.test.js)
  // for the same pattern.
  async armPendingSettle() {
    await this.eval(`
      window.__cdpLpcSeen = false;
      const c = document.getElementById("card");
      if (c) c.addEventListener("lostpointercapture", () => { window.__cdpLpcSeen = true; }, { once: true });
      return true;
    `).catch(() => {});
  }
  settleAfterRealRelease() {
    this._pendingSettle = this.deferPendingSettle();
    return this._pendingSettle;
  }
  async deferPendingSettle() {
    await this.waitFor(`window.__cdpLpcSeen === true`, {
      label: "a real release's own lostpointercapture to fire",
      timeout: 1000,
    }).catch(() => {});
    await this.eval(`
      return new Promise(resolve => { requestAnimationFrame(() => requestAnimationFrame(resolve)); });
    `).catch(() => {});
  }
  // Awaited by any helper about to start a NEW real press/capture, so it
  // does not collide with a straggling lostpointercapture from whatever this
  // browser last released. A no-op once already settled.
  async waitForPendingSettle() {
    if (this._pendingSettle) {
      const p = this._pendingSettle;
      this._pendingSettle = null;
      await p;
    }
  }
  // Finishes every WAAPI animation on `selector`, looping because finish()
  // on a fly-out chains land(), which starts the enter animation.
  async finishAnimations(selector = ".scene") {
    return this.eval(`
      return (async () => {
        const el = document.querySelector(${JSON.stringify(selector)});
        for (let i = 0; i < 4; i++) {
          const anims = el.getAnimations();
          if (!anims.length) break;
          anims.forEach(a => a.finish());
          await Promise.resolve();
        }
        return true;
      })();
    `);
  }
  async close() {
    try { this.ws.close(); } catch {}
    // Deregisters as well as kills, so a normally-closed browser is not killed
    // a second time at process exit.
    reap(this.entry);
  }
}

// The wait for the browser to print its DevTools ws URL. NOT raisable: a longer
// bound only trades an abort for a longer hang, and the runs that hit it were
// not slow by a few seconds, they were a loaded runner losing a scheduling
// lottery. HPFC_CDP_PORT_TIMEOUT_MS exists for the retry tests, which have to
// reach this path on purpose; Math.min makes it a floor-only knob, so nothing -
// a stray CI env, a future lane - can use it to lengthen the bound.
const PORT_TIMEOUT_MS = 20000;
function portTimeoutMs() {
  const raw = Number(process.env.HPFC_CDP_PORT_TIMEOUT_MS);
  return raw > 0 ? Math.min(raw, PORT_TIMEOUT_MS) : PORT_TIMEOUT_MS;
}
// The one rejection that is retried. Compared by message because it is the only
// handle the race gives us, and because it is already a documented diagnostic.
const SLOW_START = "browser did not report a debug port";

// One launch attempt: spawn, wait for the port, connect, set the session up.
// Reaps its own browser on every post-spawn failure and rethrows the ORIGINAL
// error - callers, and launch()'s retry test below, read the message.
async function launchOnce() {
  const bin = findBrowser();
  if (!bin) return null;
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "hpfc-prof-"));
  const proc = spawn(bin, [
    "--headless=new", "--remote-debugging-port=0", "--no-sandbox",
    "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run",
    "--autoplay-policy=no-user-gesture-required",  // roadmap: audio playback
    // A horizontal touch drag that the page does not scroll is an overscroll,
    // and Chrome answers an overscroll with history navigation: the document
    // goes away mid-test and every later evaluate reads null off a missing
    // element. It cost a CI cycle on the swipe tests, which dispatch exactly
    // that gesture. The browser is not what we are testing - the app's own
    // touchend handler is - so the gesture is turned off here rather than
    // worked around in the tests. This masks a headless-Chromium artifact,
    // not the underlying app question: whether a real Android Chrome swipe on
    // the card should be safe from back-navigation is still open - see queue
    // row 95 of docs/plans/2026-09-16-remaining-work-coordination.md. This
    // flag is also global to every test in this shared CDP session, not
    // scoped to the swipe tests that need it; row 97 closed that as
    // won't-fix rather than adding either a per-test-launch cost or a
    // source-text assertion that would just churn on every new swipe test.
    "--disable-features=OverscrollHistoryNavigation,TouchpadOverscrollHistoryNavigation",
    `--user-data-dir=${profileDir}`, "about:blank",
    // detached: the browser leads its own process group, which is what lets
    // reap() take the whole tree down in one signal. See reap().
  ], { stdio: ["ignore", "ignore", "pipe"], detached: true });

  const entry = { proc, profileDir };
  LIVE.add(entry);
  installReaper();

  // Everything past the spawn can reject with the child already running: the
  // debug-port timeout, the WebSocket open, any of the setup sends. Reap before
  // rethrowing, and rethrow the ORIGINAL error - "browser did not report a
  // debug port" is a diagnostic callers read.
  let ws = null;
  try {
    const wsUrl = await new Promise((resolve, reject) => {
      let buf = "";
      const t = setTimeout(() => reject(new Error(SLOW_START)), portTimeoutMs());
      proc.stderr.on("data", (d) => {
        buf += d.toString();
        const m = buf.match(/ws:\/\/[^\s]+/);
        if (m) { clearTimeout(t); resolve(m[0]); }
      });
      proc.on("exit", (c) => { clearTimeout(t); reject(new Error("browser exited: " + c)); });
    });

    ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
    const b = new Browser(proc, ws, profileDir, entry);

    // Fresh target per launch => no service-worker or storage carry-over.
    const { targetId } = await b.send("Target.createTarget", { url: "about:blank" }, false);
    const { sessionId } = await b.send("Target.attachToTarget", { targetId, flatten: true }, false);
    b.sessionId = sessionId;
    await b.send("Page.enable");
    await b.send("Runtime.enable");
    // Google Fonts is render-blocking in index.html; block it so runs are
    // deterministic and work offline. Tests therefore measure fallback metrics.
    await b.send("Network.enable");
    await b.send("Network.setBlockedURLs", { urls: ["*fonts.googleapis.com*", "*fonts.gstatic.com*"] });
    return b;
  } catch (err) {
    try { if (ws) ws.close(); } catch {}
    reap(entry);
    throw err;
  }
}

// CI run 34518203026 aborted the mutation gate at its baseline check: the e2e
// suite failed on the CLEAN tree with SLOW_START, ~2 minutes into a 232-mutant
// sweep, and a re-run with no code change was green. The exit branch did NOT
// fire - the browser was alive and had simply not printed its ws URL yet. That
// is a loaded runner, not breakage, and it is the fourth occurrence.
//
// So that ONE rejection gets ONE more attempt. Everything else - no binary, a
// browser that exited, a WebSocket that would not open, a setup send that
// failed - is real breakage, and retrying real breakage only pays the same
// failure twice. launchOnce() has already reaped the first, still-running
// browser and its profile directory by the time we get here (its catch), which
// is what keeps a retry from leaking a live Chrome and a temp dir.
//
// The notice goes to stderr on purpose: a silent retry would convert a known
// intermittent into an unexplained 20s of dead air in the log.
async function launch() {
  try {
    return await launchOnce();
  } catch (err) {
    if (!err || err.message !== SLOW_START) throw err;
    process.stderr.write(
      `[cdp] ${SLOW_START} within ${portTimeoutMs()}ms - reaped it and retrying the launch once\n`);
    return await launchOnce();
  }
}

// Browser and APP_READY_EXPR are exported for tests/harness.test.js's
// self-tests of settle() and the shared readiness predicate, not for e2e
// journeys - those only ever get a Browser instance from launch().
module.exports = { launch, findBrowser, Browser, APP_READY_EXPR };
