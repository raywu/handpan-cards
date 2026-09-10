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

function reap(entry) {
  if (!entry) return;
  LIVE.delete(entry);
  try { entry.proc.kill("SIGKILL"); } catch {}
  try { fs.rmSync(entry.profileDir, { recursive: true, force: true }); } catch {}
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
    const deadline = Date.now() + 15000;
    for (;;) {
      const ready = await this.eval(`return document.readyState === "complete" && !!document.querySelector("#count")?.textContent;`).catch(() => false);
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
  async settle() {   // let CSS transitions finish
    await this.eval(`return new Promise(r => requestAnimationFrame(() => setTimeout(r, 500)));`);
  }
  async setViewport(width, height, mobile = true) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width, height, deviceScaleFactor: 1, mobile,
      screenWidth: width, screenHeight: height,
    });
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
  async close() {
    try { this.ws.close(); } catch {}
    // Deregisters as well as kills, so a normally-closed browser is not killed
    // a second time at process exit.
    reap(this.entry);
  }
}

async function launch() {
  const bin = findBrowser();
  if (!bin) return null;
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "hpfc-prof-"));
  const proc = spawn(bin, [
    "--headless=new", "--remote-debugging-port=0", "--no-sandbox",
    "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run",
    "--autoplay-policy=no-user-gesture-required",  // roadmap: audio playback
    `--user-data-dir=${profileDir}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

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
      const t = setTimeout(() => reject(new Error("browser did not report a debug port")), 20000);
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

module.exports = { launch, findBrowser };
