// Lane A2 (docs/plans/2026-11-05-login-sync-v2.md section 12): the sign-in
// panel and the sync client in a real browser. The page is served with the dev
// host row pointed at 127.0.0.1 and a fetch stub standing in for Supabase; no
// network call leaves the machine. Two same-origin documents (the page and an
// iframe) stand in for two tabs: they share localStorage and navigator.locks.

const { test, before, after, afterEach } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { launch, findBrowser, assertNoUncaught } = require("./helpers/cdp.js");

const REPO = path.resolve(__dirname, "..");
const PROJECT = "https://sb.test";
const BROWSER = findBrowser();

const STUB = `<script>(function(){
  var tab = window.name || "top";
  function log(path){ try { var l = JSON.parse(localStorage.getItem("__sblog") || "[]"); l.push({ tab: tab, path: path }); localStorage.setItem("__sblog", JSON.stringify(l)); } catch (e) {} }
  window.fetch = function (url, opt) {
    var p = String(url).replace(${JSON.stringify(PROJECT)}, "");
    if (String(url).indexOf(${JSON.stringify(PROJECT)}) !== 0) return Promise.reject(new TypeError("blocked " + url));
    log(p.split("?")[0]);
    function reply(json) { return Promise.resolve({ status: 200, ok: true, json: function () { return Promise.resolve(json); } }); }
    if (p.indexOf("/auth/v1/otp") === 0) return reply({});
    if (p.indexOf("/auth/v1/verify") === 0) return reply({ access_token: "acc", refresh_token: "ref", expires_in: 3600, user: { id: "11111111-1111-4111-8111-111111111111", email: "me@example.test" } });
    if (p.indexOf("/auth/v1/token") === 0) return reply({ access_token: "acc2", refresh_token: "ref2", expires_in: 3600 });
    if (p.indexOf("/auth/v1/logout") === 0) return reply({});
    if (p.indexOf("/rest/v1/saved_scales") === 0) return reply([]);
    if (p.indexOf("/rest/v1/rpc/push_scales") === 0) {
      var rows = JSON.parse(opt.body).rows, n = Number(localStorage.getItem("__sbrev") || "0");
      return reply(rows.map(function (r) { n += 1; return { scale_id: r.scale_id, rev: n }; })).then(function (x) { localStorage.setItem("__sbrev", String(n)); return x; });
    }
    return Promise.resolve({ status: 404, ok: false, json: function () { return Promise.resolve(null); } });
  };
})();</script>`;

if (!BROWSER) {
  const why = "e2e_sync skipped: no Chromium binary found (set CHROME_BIN to enable). This is not a failure - see tests/CONTRACT.md.";
  console.log(why);
  test.skip(why, () => {});
} else {
  run();
}

function run() {
  let server = null, b = null, URL = "";
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const page = () => fs.readFileSync(path.join(REPO, "index.html"), "utf8")
    .replace(/^const SYNC_ORIGINS = .*;$/m, () => `const SYNC_ORIGINS = {"127.0.0.1":{url:${JSON.stringify(PROJECT)},key:"sb_publishable_test"}};`)
    .replace("<head>", () => "<head>" + STUB);

  before(async () => {
    server = http.createServer((req, res) => {
      const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "");
      if (rel === "" || rel === "index.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(page());
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    URL = `http://127.0.0.1:${server.address().port}/index.html`;
    b = await launch({ foregroundSettle: true });
    await b.setViewport(390, 800, true);
    await b.goto(URL);
  });

  after(async () => {
    if (b) await b.close();
    if (server) await new Promise(r => server.close(r));
  });

  afterEach(() => { assertNoUncaught(); });

  const q = (sel, expr) => b.eval(`return ${expr.replace(/\$\$/g, `document.querySelector(${JSON.stringify(sel)})`)};`);
  const active = () => b.eval(`return (document.activeElement || {}).id || null;`);
  const fresh = async () => {
    await b.eval(`localStorage.clear(); sessionStorage.clear();`);
    await b.goto(URL);
    await b.eval(`location.reload();`).catch(() => {});
    await sleep(300);
    await b.goto(URL);
  };
  const openSync = async () => {
    const hidden = await b.eval(`return getComputedStyle(document.getElementById("settings-trigger")).display === "none";`);
    if (!hidden && await b.eval(`return getComputedStyle(document.getElementById("settings-panel")).display === "none";`)) await b.click("#settings-trigger");
    await b.waitFor(`!document.getElementById("sync-open").hidden`, { label: "the sync opener" });
    if (await b.eval(`return document.getElementById("sync-panel").hidden;`)) await b.click("#sync-open");
    await b.waitFor(`!document.getElementById("sync-panel").hidden`, { label: "the sync panel" });
  };
  const type = (id, v) => b.eval(`const el = document.getElementById(${JSON.stringify(id)}); el.value = ${JSON.stringify(v)}; el.dispatchEvent(new Event("input", { bubbles: true }));`);
  const signIn = async () => {
    await openSync();
    await type("sync-email", "me@example.test");
    await b.click("#sync-send");
    await b.waitFor(`!document.getElementById("sync-step-code").hidden`, { label: "the code step" });
    await type("sync-code", "123456");
    await b.click("#sync-verify");
    await b.waitFor(`!!localStorage.getItem("hpfc.sync.v1")`, { label: "the sidecar" });
  };
  const log = () => b.eval(`return JSON.parse(localStorage.getItem("__sblog") || "[]");`);

  test("signed out the opener is visible and the panel starts closed", async () => {
    await fresh();
    await b.waitFor(`!document.getElementById("sync-open").hidden`, { label: "the sync opener" });
    assert.strictEqual(await q("#sync-panel", `$$.hidden`), true);
    assert.strictEqual(await q("#sync-open", `$$.getAttribute("aria-expanded")`), "false");
    assert.deepStrictEqual(await log(), []);
  });

  test("email step: input attributes, focus, status region and the address warning", async () => {
    await fresh();
    await openSync();
    assert.strictEqual(await q("#sync-email", `$$.type + "|" + $$.autocomplete + "|" + $$.inputMode + "|" + $$.required`), "email|email|email|true");
    assert.strictEqual(await active(), "sync-email");
    assert.strictEqual(await q("#sync-msg", `$$.getAttribute("role") + "|" + $$.getAttribute("aria-live")`), "status|polite");
    assert.match(await q("#sync-domain", `$$.textContent`), /handpantheory\.com/);
    assert.strictEqual(await q("#sync-open", `$$.getAttribute("aria-expanded")`), "true");
  });

  test("a bad address is refused in place with aria-invalid and focus kept", async () => {
    await fresh();
    await openSync();
    await type("sync-email", "nope");
    await b.click("#sync-send");
    assert.strictEqual(await q("#sync-email", `$$.getAttribute("aria-invalid")`), "true");
    assert.strictEqual(await active(), "sync-email");
    assert.deepStrictEqual((await log()).filter(l => l.path === "/auth/v1/otp"), []);
  });

  test("code step: attributes, focus, and the 60 second resend cooldown", async () => {
    await fresh();
    await openSync();
    await type("sync-email", "me@example.test");
    await b.click("#sync-send");
    await b.waitFor(`!document.getElementById("sync-step-code").hidden`, { label: "the code step" });
    assert.strictEqual(await q("#sync-code", `$$.inputMode + "|" + $$.autocomplete + "|" + $$.getAttribute("pattern") + "|" + $$.maxLength`), "numeric|one-time-code|[0-9]{6}|6");
    assert.strictEqual(await active(), "sync-code");
    assert.strictEqual(await q("#sync-resend", `$$.disabled`), true);
    assert.match(await q("#sync-resend", `$$.textContent`), /\b(5[89]|60)\b/);
    assert.match(await q("#sync-msg", `$$.textContent`), /me@example\.test/);
    await b.eval(`syncResendAt = Date.now() - 1; syncPaintResend();`);
    assert.strictEqual(await q("#sync-resend", `$$.disabled`), false);
    await b.click("#sync-resend");
    await b.waitFor(`document.getElementById("sync-resend").disabled`, { label: "the cooldown restarting" });
    assert.strictEqual((await log()).filter(l => l.path === "/auth/v1/otp").length, 2);
  });

  test("signing in shows the account view with focus on its heading and starts the first sync", async () => {
    await fresh();
    await signIn();
    await b.waitFor(`!document.getElementById("sync-signed").hidden`, { label: "the account view" });
    assert.strictEqual(await active(), "sync-heading");
    assert.match(await q("#sync-heading", `$$.textContent`), /me@example\.test/);
    await b.waitFor(`JSON.parse(localStorage.getItem("hpfc.sync.v1")).first === false`, { label: "first sync done" });
    assert.ok((await log()).some(l => l.path === "/rest/v1/saved_scales"));
  });

  async function addScale(text) {
    const hidden = await b.eval(`return getComputedStyle(document.getElementById("settings-trigger")).display === "none";`);
    if (!hidden && await b.eval(`return getComputedStyle(document.getElementById("settings-panel")).display === "none";`)) await b.click("#settings-trigger");
    await b.click("#deck-add");
    await b.waitFor(`!document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the scale sheet" });
    await type("scale-box", text);
    if (await b.eval(`return !document.getElementById("scale-next").hidden;`)) {
      await b.click("#scale-next");
      await b.waitFor(`!document.getElementById("scale-panel-layout").hidden`, { label: "the Layout tab" });
    }
    await b.click("#scale-generate");
    await b.waitFor(`document.getElementById("scale-sheet").hasAttribute("hidden")`, { label: "the sheet closing" });
  }

  test("a saved scale is pushed after sign-in, and sign-out keeps it", async () => {
    await fresh();
    await signIn();
    await b.waitFor(`JSON.parse(localStorage.getItem("hpfc.sync.v1")).first === false`, { label: "first sync done" });
    await addScale("(C3) G3 C4 D4 E4 G4 A4 C5");
    await b.waitFor(`JSON.parse(localStorage.getItem("__sblog") || "[]").some(l => l.path === "/rest/v1/rpc/push_scales")`, { timeout: 8000, label: "the push" });
    const before = await b.eval(`return savedState.entries.length;`);
    await openSync();
    await b.click("#sync-out");
    await b.waitFor(`localStorage.getItem("hpfc.sync.v1") === null`, { label: "the sidecar removed" });
    assert.strictEqual(await b.eval(`return savedState.entries.length;`), before);
    assert.strictEqual(await active(), "sync-email");
  });

  const frameJs = expr => b.eval(`const w = document.getElementById("tabB").contentWindow; return w.eval(${JSON.stringify(expr)});`);
  const openFrame = async () => {
    await b.eval(`const f = document.createElement("iframe"); f.name = "B"; f.id = "tabB"; f.style.cssText = "position:fixed;left:0;top:0;width:390px;height:800px;opacity:0;pointer-events:none"; f.src = ${JSON.stringify(URL)}; document.body.appendChild(f);`);
    await b.waitFor(`(() => { try { const w = document.getElementById("tabB").contentWindow; return w.document.readyState === "complete" && w.eval("typeof syncHolder") === "boolean"; } catch (e) { return false; } })()`, { label: "tab B booted" });
  };

  test("two tabs: only the lock holder calls the token endpoint, and it pushes a save made in the other tab", async () => {
    await fresh();
    await signIn();
    await b.waitFor(`JSON.parse(localStorage.getItem("hpfc.sync.v1")).first === false`, { label: "first sync done" });
    await openFrame();
    await sleep(300);
    assert.strictEqual(await b.eval(`return syncHolder;`), true, "the first tab holds the lock");
    assert.strictEqual(await frameJs("syncHolder"), false);
    await b.eval(`localStorage.setItem("__sblog", "[]"); const s = JSON.parse(localStorage.getItem("hpfc.sync.v1")); s.accessExp = 0; localStorage.setItem("hpfc.sync.v1", JSON.stringify(s));`);
    await frameJs("syncKick(true)");
    await sleep(200);
    assert.deepStrictEqual((await log()).filter(l => l.path.startsWith("/auth/v1/token")), [], "the other tab makes no token call");
    await frameJs(`(async () => {
      document.getElementById("settings-trigger").click();
      document.getElementById("deck-add").click();
      const box = document.getElementById("scale-box"); box.value = "(D3) A3 C4 D4 E4 F4 G4 A4 C5"; box.dispatchEvent(new Event("input", { bubbles: true }));
      const next = document.getElementById("scale-next"); if (!next.hidden) next.click();
      document.getElementById("scale-generate").click();
    })()`);
    await b.waitFor(`JSON.parse(localStorage.getItem("__sblog") || "[]").some(l => l.path === "/rest/v1/rpc/push_scales")`, { timeout: 10000, label: "the lock tab pushing" });
    const calls = (await log()).filter(l => l.path.startsWith("/auth/v1/token") || l.path === "/rest/v1/rpc/push_scales");
    assert.ok(calls.length >= 1);
    assert.ok(calls.every(c => c.tab === "top"), JSON.stringify(calls));
  });

  test("two tabs: sign-out in one tab stops the other tab's pushes", async () => {
    await fresh();
    await signIn();
    await b.waitFor(`JSON.parse(localStorage.getItem("hpfc.sync.v1")).first === false`, { label: "first sync done" });
    await b.eval(`localStorage.removeItem("hpfc.sync.v1"); localStorage.setItem("__sblog", "[]");`);
    await b.eval(`syncChanged();`);
    await sleep(2400);
    assert.deepStrictEqual((await log()).filter(l => l.path.startsWith("/rest/v1") || l.path.startsWith("/auth/v1/token")), []);
  });

  test("two tabs: signing in from the other tab starts the lock tab's first sync", async () => {
    await fresh();
    await openFrame();
    await frameJs(`localStorage.setItem("hpfc.sync.v1", JSON.stringify({ v: 1, project: ${JSON.stringify(PROJECT)}, userId: "11111111-1111-4111-8111-111111111111", email: "me@example.test", refresh: "r", access: "a", accessExp: Date.now() + 3600000, cursor: 0, base: {}, alias: {}, deferredDeletes: [], localOnly: [], pending: false, first: true })); syncStartLock();`);
    await b.waitFor(`JSON.parse(localStorage.getItem("hpfc.sync.v1")).first === false`, { timeout: 8000, label: "a first sync" });
    const holders = [await b.eval(`return syncHolder;`), await frameJs("syncHolder")].filter(Boolean);
    assert.strictEqual(holders.length, 1, "exactly one tab holds the lock");
  });

  test("380px: the open panel fits, no horizontal scroll, and visible sync text says scale not deck", async () => {
    await b.setViewport(380, 800, true);
    await fresh();
    await signIn();
    await openSync();
    const fit = await b.eval(`const p = document.getElementById("sync-panel").getBoundingClientRect(); return { right: p.right, vw: innerWidth, sw: document.documentElement.scrollWidth };`);
    assert.ok(fit.right <= fit.vw + 0.5, JSON.stringify(fit));
    assert.ok(fit.sw <= fit.vw, JSON.stringify(fit));
    const text = await q("#sync-panel", `$$.innerText`);
    assert.ok(!/\bdecks?\b/i.test(text), text);
    await b.setViewport(390, 800, true);
  });
}
