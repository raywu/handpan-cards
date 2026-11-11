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
      if (rel === "nosync.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(fs.readFileSync(path.join(REPO, "index.html"), "utf8"));
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
    if (await b.eval(`return document.getElementById("account").hidden;`)) await b.click("#sync-open");
    await b.waitFor(`!document.getElementById("account").hidden`, { label: "the account page" });
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

  test("signed out the entry is visible and the account page starts closed", async () => {
    await fresh();
    await b.waitFor(`!document.getElementById("sync-open").hidden`, { label: "the sync opener" });
    assert.strictEqual(await q("#account", `$$.hidden`), true);
    assert.strictEqual(await q("#sync-open", `$$.getAttribute("aria-haspopup")`), "dialog");
    assert.deepStrictEqual(await log(), []);
  });

  test("email step: input attributes, focus and status region", async () => {
    await fresh();
    await openSync();
    assert.strictEqual(await q("#sync-email", `$$.type + "|" + $$.autocomplete + "|" + $$.inputMode + "|" + $$.required`), "email|email|email|true");
    assert.strictEqual(await active(), "sync-email");
    assert.strictEqual(await q("#sync-msg", `$$.getAttribute("role") + "|" + $$.getAttribute("aria-live")`), "status|polite");
    assert.strictEqual(await b.eval(`return document.getElementById("sync-domain");`), null, "the address-bar line is gone");
    assert.strictEqual(await q("#account", `$$.hidden`), false);
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
    assert.strictEqual(await q("#sync-resend", `$$.textContent`), "Resend code");
    assert.match(await q("#sync-resend-at", `$$.textContent`), /^You can ask for a new code at /);
    assert.ok(await b.eval(`return syncResendAt - Date.now();`) >= 60000, "the wait is at least 60 seconds");
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
    assert.strictEqual(await q("#sync-heading", `$$.textContent`), "Signed in");
    assert.match(await b.eval(`const h = document.getElementById("sync-heading"); return h.getAttribute("aria-label") || (h.getAttribute("aria-labelledby") || "").split(/\\s+/).map(id => (document.getElementById(id) || {}).textContent || "").join(" ");`), /me@example\.test/, "the heading's accessible name carries the identity");
    await b.waitFor(`JSON.parse(localStorage.getItem("hpfc.sync.v1")).first === false`, { label: "first sync done" });
    assert.ok((await log()).some(l => l.path === "/rest/v1/saved_scales"));
  });

  async function addScale(text, frame = false) {
    // Visibility is local to the document: tab B's transparent parent is intentional.
    const inPage = expr => {
      const scoped = `(() => {
        const visible = id => {
          const el = document.getElementById(id);
          if (!el) return false;
          const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility === "visible";
        };
        return (${expr});
      })()`;
      return frame ? `document.getElementById("tabB").contentWindow.eval(${JSON.stringify(scoped)})` : scoped;
    };
    const read = expr => b.eval(`return ${inPage(expr)};`);
    const wait = (expr, label) => b.waitFor(inPage(expr), { label });
    const click = id => frame ? read(`document.getElementById(${JSON.stringify(id)}).click()`) : b.click("#" + id);

    if (await read(`!document.getElementById("account").hidden`)) await click("account-close");
    if (await read(`visible("settings-trigger") && !visible("settings-panel")`)) await click("settings-trigger");
    await click("deck-add");
    await wait(`visible("scale-sheet") && !document.getElementById("scale-sheet").hasAttribute("hidden")`, "the scale sheet");
    const [editor, legacy] = await read(`[visible("editor-line"), visible("scale-box")]`);
    if (editor === legacy) throw new Error("Expected exactly one visible scale editor profile");
    const line = editor ? "editor-line" : "scale-box";
    if (editor) await click(line);
    await read(`(() => {
      const el = document.getElementById(${JSON.stringify(line)});
      el.value = ${JSON.stringify(text)};
      el.dispatchEvent(new Event("input", { bubbles: true }));
    })()`);
    if (editor) {
      if (frame) {
        await read(`document.getElementById("editor-line").dispatchEvent(new KeyboardEvent("keydown",
          { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }))`);
      } else {
        await b.key("Enter", "Enter", 13);
      }
    } else if (await read(`visible("scale-next")`)) {
      await click("scale-next");
      await wait(`visible("scale-panel-layout")`, "the Layout tab");
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

  test("two tabs: a signed-out tab drops its signed-out message once the other tab signs it in", async () => {
    await fresh();
    await openFrame();
    await b.eval(`syncSay("sync.signedOutDone");`);
    assert.match(await q("#sync-msg", `$$.textContent`), /Signed out/);
    await frameJs(`localStorage.setItem("hpfc.sync.v1", JSON.stringify({ v: 1, project: ${JSON.stringify(PROJECT)}, userId: "11111111-1111-4111-8111-111111111111", email: "me@example.test", refresh: "r", access: "a", accessExp: Date.now() + 3600000, cursor: 0, base: {}, alias: {}, deferredDeletes: [], localOnly: [], pending: false, first: true })); syncStartLock();`);
    await b.waitFor(`JSON.parse(localStorage.getItem("hpfc.sync.v1")).first === false`, { timeout: 8000, label: "first sync" });
    await b.eval(`syncPaint();`);
    await b.waitFor(`/^Saved to your account at /.test(document.getElementById("sync-msg").textContent)`, { timeout: 8000, label: "synced status replaces the signed-out text" });
    assert.doesNotMatch(await q("#sync-msg", `$$.textContent`), /Signed out/);
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

  // ---- TRI-28 login/sync UI polish (docs/plans/2026-11-09-login-sync-ux-polish.md) ----
  const KEY = "hpfc.sync.v1";
  const EMAIL = "me@example.test";
  const msg = () => q("#sync-msg", `$$.textContent`);
  const shown = id => b.eval(`const el = document.getElementById(${JSON.stringify(id)}); if (!el) return false; const r = el.getBoundingClientRect(); return !el.hidden && r.width > 0 && r.height > 0 && getComputedStyle(el).visibility === "visible";`);
  const setSidecar = patch => b.eval(`const s = JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})); Object.assign(s, ${JSON.stringify(patch)}); localStorage.setItem(${JSON.stringify(KEY)}, JSON.stringify(s)); syncPaint();`);
  const accountText = () => b.eval(`return document.getElementById("sync-open").textContent + " | " + document.getElementById("sync-panel").textContent;`);
  const signedSynced = async () => {
    await fresh();
    await signIn();
    await b.waitFor(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})).first === false`, { label: "first sync done" });
    await b.waitFor(`/^Saved to your account at /.test(document.getElementById("sync-msg").textContent)`, { label: "a routine success is cached (copy asserted separately)" });
  };
  const gateFetch = async frag => {
    await b.eval(`window.__orig = window.__orig || window.fetch; window.__gated = 0; window.fetch = function (u, o) { if (String(u).indexOf(${JSON.stringify(frag)}) >= 0) return new Promise(function (res) { window.__gate = function () { res(window.__orig(u, o)); }; window.__gated++; }); return window.__orig(u, o); };`);
  };
  const releaseGate = () => b.eval(`window.__gate(); window.fetch = window.__orig;`);
  const failFetch = (frag, status) => b.eval(`window.__orig = window.__orig || window.fetch; window.fetch = function (u, o) { if (String(u).indexOf(${JSON.stringify(frag)}) >= 0) return Promise.resolve({ status: ${status}, ok: false, json: function () { return Promise.resolve(null); } }); return window.__orig(u, o); };`);
  const restoreFetch = () => b.eval(`if (window.__orig) window.fetch = window.__orig;`);

  test("polish: signed out the entry says Sign in and the email step has one primary Send code", async () => {
    await fresh();
    await b.waitFor(`!document.getElementById("sync-open").hidden`, { label: "the sync opener" });
    assert.strictEqual(await q("#sync-entry-main", `$$.textContent`), "Sign in");
    assert.strictEqual(await q("#sync-entry-sub", `$$.textContent`), "Save your scales");
    assert.ok(!/synced|@/i.test(await q("#sync-open", `$$.textContent`)), "no account or success claim while signed out");
    await openSync();
    assert.strictEqual(await q("#sync-send", `$$.innerText`), "Send code");
    assert.strictEqual(await q("#sync-email-label", `$$.textContent`), "Email address");
    assert.ok((await q("#sync-panel", `$$.textContent`)).includes("Save your scales to your account to use them on any device."));
    assert.ok(!/address bar/i.test(await q("#sync-panel", `$$.textContent`)));
  });

  test("polish: the code step uses sentence-case Sign in, Change email and a Resend code line with a clock time", async () => {
    await fresh();
    await openSync();
    await type("sync-email", EMAIL);
    await b.click("#sync-send");
    await b.waitFor(`!document.getElementById("sync-step-code").hidden`, { label: "the code step" });
    assert.strictEqual(await msg(), `Enter the code sent to ${EMAIL}. Check spam too.`);
    assert.strictEqual(await q("#sync-code-label", `$$.textContent`), "6-digit code");
    assert.strictEqual(await q("#sync-verify", `$$.innerText`), "Sign in");
    assert.strictEqual(await q("#sync-other", `$$.innerText`), "Change email");
    assert.strictEqual(await q("#sync-resend", `$$.innerText`), "Resend code");
    assert.match(await q("#sync-resend-at", `$$.innerText`), /^You can ask for a new code at /);
    await b.eval(`syncResendAt = Date.now() - 1; syncPaintResend();`);
    assert.strictEqual(await q("#sync-resend", `$$.innerText`), "Resend code");
    const bg = id => q(id, `getComputedStyle($$).backgroundColor`);
    assert.notStrictEqual(await bg("#sync-verify"), await bg("#sync-other"), "Sign in is primary, Change email secondary");
    assert.notStrictEqual(await bg("#sync-verify"), await bg("#sync-resend"), "Resend code is secondary");
  });

  test("polish: signed in shows one identity (opener, heading, email once) and no #sync-last", async () => {
    await signedSynced();
    assert.strictEqual(await q("#sync-entry-main", `$$.textContent`), EMAIL);
    assert.strictEqual(await q("#sync-heading", `$$.textContent`), "Signed in");
    assert.strictEqual(await q("#sync-account-email", `$$.textContent`), EMAIL);
    assert.notStrictEqual(await q("#sync-account-email", `$$.tagName`), "A", "plain text, not a mail link");
    assert.strictEqual(await b.eval(`return document.querySelectorAll('#sync-panel a[href^="mailto:"]').length;`), 0);
    const text = await q("#sync-panel", `$$.textContent`);
    assert.strictEqual(text.split(EMAIL).length - 1, 1, "the address appears once in the panel text");
    assert.strictEqual(await b.eval(`return document.getElementById("sync-last");`), null, "#sync-last is removed");
  });

  test("polish: #sync-msg is the only status region and the synced time appears once", async () => {
    await signedSynced();
    const m = await msg();
    const time = /^Saved to your account at (.+)$/.exec(m);
    assert.ok(time, "expected 'Saved to your account at {time}', got: " + m);
    const text = await accountText();
    assert.strictEqual(text.split(time[1]).length - 1, 1, "the timestamp appears once: " + text);
    assert.strictEqual(await b.eval(`return document.querySelectorAll('#sync-panel [role="status"], #sync-panel [aria-live]').length;`), 1);
    assert.strictEqual(await q("#sync-msg", `$$.getAttribute("role") + "|" + $$.getAttribute("aria-live")`), "status|polite");
    assert.ok(!/synced/i.test(await q("#sync-open", `$$.textContent`)), "the opener never claims sync");
  });

  test("polish: live first-pull and pending outrank a cached success; no timestamp before a first success", async () => {
    await signedSynced();
    await setSidecar({ pending: true });
    assert.strictEqual(await msg(), "Changes not yet saved to your account", "a cached Saved to your account message must not mask pending work");
    await setSidecar({ pending: false, first: true });
    assert.strictEqual(await msg(), "Saving to your account\u2026");
    await setSidecar({ pending: true, first: true });
    assert.strictEqual(await msg(), "Saving to your account\u2026", "a live first pull outranks pending");
    await setSidecar({ pending: false, first: true });
    assert.ok(!/Saved to your account/.test(await accountText()), "signed in is not synced");
    await b.eval(`const s = JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})); s.first = false; s.pending = false; delete s.syncedAt; localStorage.setItem(${JSON.stringify(KEY)}, JSON.stringify(s)); syncMsg = null; syncPaint();`);
    assert.ok(!/synced|\d:\d\d/i.test(await msg()), "no timestamp before a successful sync: " + await msg());
    await setSidecar({ syncedAt: Date.now() });
    assert.match(await msg(), /^Saved to your account at /, "the last success shows when nothing live applies");
  });

  test("polish: an error outranks routine repaint and pending; clearing it restores the live status", async () => {
    await signedSynced();
    await b.eval(`syncSay("sync.err.offline");`);
    const offline = await msg();
    assert.match(offline, /offline/i);
    await b.eval(`syncPaint(); syncPaint();`);
    assert.strictEqual(await msg(), offline, "routine repaint cannot clear an error");
    await setSidecar({ pending: true });
    assert.strictEqual(await msg(), offline, "pending does not hide an error");
    await setSidecar({ pending: false, first: true });
    assert.strictEqual(await msg(), offline, "a live first pull does not hide an error");
    await b.eval(`syncSay(null);`);
    assert.strictEqual(await msg(), "Saving to your account\u2026", "clearing a transient message restores the status");
  });

  const pushed = () => b.eval(`return JSON.parse(localStorage.getItem("__sblog") || "[]").filter(l => l.path === "/rest/v1/rpc/push_scales").length;`);

  test("polish: there is no consent prompt; scales already on the device upload by themselves after sign-in", async () => {
    await fresh();
    await addScale("(C3) G3 C4 D4 E4 G4 A4 C5");
    await signIn();
    await b.waitFor(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})).first === false`, { label: "first sync done" });
    await b.waitFor(`JSON.parse(localStorage.getItem("__sblog") || "[]").some(l => l.path === "/rest/v1/rpc/push_scales")`, { timeout: 8000, label: "the automatic push" });
    for (const id of ["sync-ask", "sync-ask-text", "sync-ask-yes", "sync-ask-no"]) assert.strictEqual(await b.eval(`return document.getElementById(${JSON.stringify(id)});`), null, id);
    assert.deepStrictEqual(await b.eval(`return JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})).localOnly;`), [], "nothing is left held");
    assert.ok(await b.eval(`return savedState.entries.length >= 1;`), "the device scale is kept");
  });

  test("polish: a signed-in session that still holds local scales releases and uploads them on the next sync", async () => {
    await signedSynced();
    await addScale("(D3) A3 C4 D4 E4 F4 G4 A4 C5");
    await b.waitFor(`JSON.parse(localStorage.getItem("__sblog") || "[]").some(l => l.path === "/rest/v1/rpc/push_scales")`, { timeout: 8000, label: "the routine push" });
    const id = await b.eval(`return savedState.entries[savedState.entries.length - 1].instanceId;`);
    await b.eval(`localStorage.setItem("__sblog", "[]"); const s = JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})); s.localOnly = [${JSON.stringify(id)}]; s.base = {}; s.alias = {}; localStorage.setItem(${JSON.stringify(KEY)}, JSON.stringify(s));`);
    await b.eval(`syncKick(false);`);
    await b.waitFor(`JSON.parse(localStorage.getItem("__sblog") || "[]").some(l => l.path === "/rest/v1/rpc/push_scales")`, { timeout: 8000, label: "the held scale is pushed" });
    assert.deepStrictEqual(await b.eval(`return JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})).localOnly;`), []);
    assert.ok(await b.eval(`return savedState.entries.some(e => e.instanceId === ${JSON.stringify(id)});`), "the scale is still on the device");
  });

  test("polish: control hierarchy - Sign out secondary, Delete account separated and unfilled", async () => {
    await signedSynced();
    const info = await b.eval(`
      const r = id => document.getElementById(id).getBoundingClientRect();
      const cs = id => getComputedStyle(document.getElementById(id));
      const out = r("sync-out"), del = r("sync-delete");
      return { outTop: out.top, outBottom: out.bottom, delTop: del.top,
        delBg: cs("sync-delete").backgroundColor,
        tag: document.getElementById("sync-delete").tagName,
        sizes: ["sync-out", "sync-delete"].map(id => [id, r(id).width, r(id).height]),
        texts: ["sync-out", "sync-delete"].map(id => document.getElementById(id).innerText),
        align: cs("sync-msg").textAlign };`);
    assert.ok(info.outTop < info.delTop, "order: Sign out, Delete account " + JSON.stringify(info));
    assert.ok(info.delTop - info.outBottom >= 16, "Delete account is visually separated from routine controls: " + (info.delTop - info.outBottom));
    assert.strictEqual(info.delBg, "rgba(0, 0, 0, 0)", "Delete account is an unfilled text-style button");
    assert.strictEqual(info.tag, "BUTTON");
    assert.deepStrictEqual(info.texts, ["Sign out", "Delete account"]);
    for (const [id, w, h] of info.sizes) assert.ok(w >= 44 && h >= 44, id + " target " + w + "x" + h);
    assert.ok(["start", "left"].includes(info.align), "status is left-aligned: " + info.align);
  });

  test("polish: sign-in fields, buttons and status lines have clear vertical space between them", async () => {
    await fresh();
    await openSync();
    const gaps = () => b.eval(`
      const ids = [...document.querySelectorAll("#sync-panel label, #sync-panel input, #sync-panel button, #sync-panel p")].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest("[hidden]"); });
      const out = [];
      for (let i = 1; i < ids.length; i++) out.push([ids[i - 1].id || ids[i - 1].tagName, ids[i].id || ids[i].tagName, ids[i].getBoundingClientRect().top - ids[i - 1].getBoundingClientRect().bottom]);
      return out;`);
    const need = (a, c) => (a === "sync-msg" || c === "sync-msg" ? 16 : 8);
    for (const [a, c, gap] of await gaps()) assert.ok(gap >= need(a, c), `email step: ${a} to ${c} is ${gap}px`);
    await type("sync-email", EMAIL);
    await b.click("#sync-send");
    await b.waitFor(`!document.getElementById("sync-step-code").hidden`, { label: "the code step" });
    const code = await gaps();
    assert.ok(code.length >= 5, "the code step lists its controls: " + JSON.stringify(code));
    for (const [a, c, gap] of code) assert.ok(gap >= need(a, c), `code step: ${a} to ${c} is ${gap}px`);
  });

  test("polish: a refused save shows the reason with Try again, and Try again runs the save once more", async () => {
    for (const [key, text] of [["sync.err.cap", "Not saved: scale limit reached. Remove a scale, then try again."], ["sync.err.rate", "Not saved: too many saves. Try again in a minute."]]) {
      await signedSynced();
      assert.strictEqual(await shown("sync-retry"), false, "no Try again while all is saved");
      await b.eval(`syncSay(${JSON.stringify(key)});`);
      assert.strictEqual(await msg(), text);
      assert.strictEqual(await shown("sync-retry"), true);
      assert.strictEqual(await q("#sync-retry", `$$.innerText`), "Try again");
      assert.strictEqual(await q("#sync-entry-err", `$$.textContent`), "Not saved to account \u203a");
      await b.eval(`window.__kicks = 0; const k = syncKick; syncKick = p => { window.__kicks++; return k(p); };`);
      await b.click("#sync-retry");
      await b.waitFor(`window.__kicks >= 1`, { label: "the retry save" });
      await b.waitFor(`/^Saved to your account at /.test(document.getElementById("sync-msg").textContent)`, { label: "the refusal cleared by a good save" });
      assert.strictEqual(await shown("sync-retry"), false);
    }
  });

  test("polish: Escape closes the account page and Tab wraps inside it", async () => {
    await fresh();
    await openSync();
    await b.eval(`document.getElementById("account-close").focus();`);
    for (const next of ["sync-email", "sync-send", "account-close"]) {
      await b.key("Tab", "Tab", 9);
      assert.strictEqual(await active(), next, "Tab walks the stops in order and wraps from the last to the first");
    }
    await b.key("Escape", "Escape", 27);
    await b.waitFor(`document.getElementById("account").hidden`, { label: "Escape closes the account page" });
  });

  test("polish: sending, signing in and resending disable competing controls, keep values and focus, and set aria-busy", async () => {
    await fresh();
    await openSync();
    await type("sync-email", EMAIL);
    await gateFetch("/auth/v1/otp");
    await b.click("#sync-send");
    await b.waitFor(`window.__gated === 1`, { label: "the held send" });
    await b.waitFor(`document.getElementById("sync-send").disabled`, { label: "the busy Send code" });
    assert.strictEqual(await q("#sync-send", `$$.textContent`), "Sending code\u2026");
    assert.strictEqual(await q("#sync-email", `$$.readOnly + "|" + $$.value`), "true|" + EMAIL);
    assert.strictEqual(await active(), "sync-email", "focus is not dropped by disabling the pressed button");
    assert.strictEqual(await q("#sync-panel", `$$.getAttribute("aria-busy")`), "true");
    await releaseGate();
    await b.waitFor(`!document.getElementById("sync-step-code").hidden`, { label: "the code step" });
    assert.notStrictEqual(await q("#sync-panel", `$$.getAttribute("aria-busy")`), "true");
    assert.strictEqual(await q("#sync-email", `$$.readOnly`), false);
    assert.strictEqual(await active(), "sync-code");

    await type("sync-code", "123456");
    await gateFetch("/auth/v1/verify");
    await b.click("#sync-verify");
    await b.waitFor(`window.__gated === 1`, { label: "the held verify" });
    await b.waitFor(`document.getElementById("sync-verify").disabled`, { label: "the busy Sign in" });
    assert.strictEqual(await q("#sync-verify", `$$.textContent`), "Signing in\u2026");
    assert.strictEqual(await q("#sync-other", `$$.disabled`), true);
    assert.strictEqual(await q("#sync-resend", `$$.disabled`), true);
    assert.strictEqual(await q("#sync-code", `$$.readOnly + "|" + $$.value`), "true|123456");
    assert.strictEqual(await active(), "sync-code");
    assert.strictEqual(await q("#sync-panel", `$$.getAttribute("aria-busy")`), "true");
    await releaseGate();
    await b.waitFor(`!document.getElementById("sync-signed").hidden`, { label: "the account view" });
    assert.strictEqual(await active(), "sync-heading");
    assert.notStrictEqual(await q("#sync-panel", `$$.getAttribute("aria-busy")`), "true");
  });

  test("polish: resending shows Resending code..., disables the other controls and returns to the cooldown", async () => {
    await fresh();
    await openSync();
    await type("sync-email", EMAIL);
    await b.click("#sync-send");
    await b.waitFor(`!document.getElementById("sync-step-code").hidden`, { label: "the code step" });
    await b.eval(`syncResendAt = Date.now() - 1; syncPaintResend();`);
    await gateFetch("/auth/v1/otp");
    await b.click("#sync-resend");
    await b.waitFor(`window.__gated === 1`, { label: "the held resend" });
    await b.waitFor(`document.getElementById("sync-resend").disabled`, { label: "the busy Resend code" });
    assert.strictEqual(await q("#sync-resend", `$$.textContent`), "Resending code\u2026");
    assert.strictEqual(await q("#sync-verify", `$$.disabled`), true);
    assert.strictEqual(await q("#sync-other", `$$.disabled`), true);
    assert.strictEqual(await q("#sync-code", `$$.readOnly`), true);
    assert.strictEqual(await active(), "sync-code");
    assert.strictEqual(await q("#sync-panel", `$$.getAttribute("aria-busy")`), "true");
    await releaseGate();
    await b.waitFor(`!document.getElementById("sync-resend-at").hidden`, { label: "the cooldown" });
    assert.strictEqual(await q("#sync-verify", `$$.disabled`), false);
    assert.strictEqual(await q("#sync-other", `$$.disabled`), false);
    assert.strictEqual(await q("#sync-code", `$$.readOnly`), false);
  });

  test("polish: a failed send restores the field, its value, aria-invalid, focus and the controls", async () => {
    await fresh();
    await openSync();
    await type("sync-email", EMAIL);
    await failFetch("/auth/v1/otp", 429);
    await b.click("#sync-send");
    await b.waitFor(`/Too many requests/.test(document.getElementById("sync-msg").textContent)`, { label: "the rate-limit error" });
    await restoreFetch();
    assert.strictEqual(await q("#sync-email", `$$.value + "|" + $$.getAttribute("aria-invalid") + "|" + $$.readOnly`), `${EMAIL}|true|false`);
    assert.strictEqual(await active(), "sync-email");
    assert.strictEqual(await q("#sync-send", `$$.disabled + "|" + $$.textContent`), "false|Send code");
    assert.notStrictEqual(await q("#sync-panel", `$$.getAttribute("aria-busy")`), "true");
  });

  test("polish: arming Delete account announces the consequence in the polite region, keeps focus, and disarms with the retained error restored", async () => {
    await signedSynced();
    await b.eval(`syncSay("sync.err.offline");`);
    const offline = await msg();
    await b.click("#sync-delete");
    await b.waitFor(`document.getElementById("sync-delete").textContent === "Confirm account deletion"`, { label: "the armed button" });
    assert.strictEqual(await msg(), "Permanently deletes your account and the scales saved to it. Copies on this device stay.");
    assert.strictEqual(await active(), "sync-delete", "focus stays on the confirmation button");
    assert.strictEqual(await q("#sync-msg", `$$.getAttribute("aria-live")`), "polite");
    assert.strictEqual((await log()).filter(l => l.path.indexOf("delete_my_account") >= 0).length, 0, "one press makes no request");
    await b.click("#account-close");
    await b.waitFor(`document.getElementById("account").hidden`, { label: "closed" });
    await openSync();
    assert.strictEqual(await q("#sync-delete", `$$.textContent`), "Delete account", "closing the panel disarms");
    await b.click("#sync-delete");
    await b.waitFor(`document.getElementById("sync-delete").textContent === "Confirm account deletion"`, { label: "armed again" });
    await b.waitFor(`document.getElementById("sync-delete").textContent === "Delete account"`, { timeout: 9000, label: "the six second disarm" });
    assert.ok(!/Permanently/.test(await msg()), "the consequence text is gone after expiry");
    assert.strictEqual(await msg(), offline, "the retained error is restored on disarm");
  });

  test("polish: a failed account deletion says so, keeps the session and local scales", async () => {
    await signedSynced();
    const entries = await b.eval(`return savedState.entries.length;`);
    await failFetch("delete_my_account", 500);
    await b.click("#sync-delete");
    await b.waitFor(`!!syncDeleteArmed`, { label: "armed" });
    await b.click("#sync-delete");
    await b.waitFor(`/Could not delete/.test(document.getElementById("sync-msg").textContent)`, { label: "the failure message" });
    await restoreFetch();
    assert.strictEqual(await msg(), "Could not delete your account. Try again.");
    assert.ok(await b.eval(`return !!localStorage.getItem(${JSON.stringify(KEY)});`), "the session survives");
    assert.strictEqual(await b.eval(`return savedState.entries.length;`), entries);
    assert.strictEqual(await q("#sync-delete", `$$.textContent`), "Delete account");
  });

  test("polish: a confirmed deletion ends the session and keeps the scales on this device", async () => {
    await signedSynced();
    await addScale("(C3) G3 C4 D4 E4 G4 A4 C5");
    const entries = await b.eval(`return savedState.entries.length;`);
    await b.eval(`window.__orig = window.__orig || window.fetch; window.fetch = function (u, o) { if (String(u).indexOf("delete_my_account") >= 0) return Promise.resolve({ status: 200, ok: true, json: function () { return Promise.resolve({}); } }); return window.__orig(u, o); };`);
    await openSync();
    await b.click("#sync-delete");
    await b.waitFor(`!!syncDeleteArmed`, { label: "armed" });
    await b.click("#sync-delete");
    await b.waitFor(`localStorage.getItem(${JSON.stringify(KEY)}) === null`, { label: "the sidecar removed" });
    await restoreFetch();
    assert.strictEqual(await b.eval(`return savedState.entries.length;`), entries);
    assert.strictEqual(await active(), "sync-email");
  });

  test("polish: signing out says the scales remain on this device and returns focus to the email", async () => {
    await signedSynced();
    await b.click("#sync-out");
    await b.waitFor(`localStorage.getItem(${JSON.stringify(KEY)}) === null`, { label: "the sidecar removed" });
    assert.strictEqual(await msg(), "Signed out. Your scales remain on this device.");
    assert.strictEqual(await active(), "sync-email");
    assert.strictEqual(await q("#sync-entry-main", `$$.textContent`), "Sign in");
  });

  test("polish: signing out while Delete account is armed says signed out, and a bad address then shows its own error", async () => {
    await signedSynced();
    await b.click("#sync-delete");
    await b.waitFor(`!!syncDeleteArmed`, { label: "armed" });
    await b.click("#sync-out");
    await b.waitFor(`localStorage.getItem(${JSON.stringify(KEY)}) === null`, { label: "the sidecar removed" });
    assert.strictEqual(await msg(), "Signed out. Your scales remain on this device.");
    assert.strictEqual(await b.eval(`return syncDeleteArmed;`), null, "the arm is cleared with the session");
    await type("sync-email", "nope");
    await b.click("#sync-send");
    assert.strictEqual(await msg(), "Enter a valid email address.");
    assert.strictEqual(await q("#sync-email", `$$.getAttribute("aria-invalid")`), "true");
  });

  test("polish: a 254-character address wraps without clipping at 320px and 380px, ", async () => {
    const long = "a".repeat(64) + "@" + ["b".repeat(63), "c".repeat(63), "d".repeat(58), "te"].join(".");
    assert.strictEqual(long.length, 254);
    for (const width of [380, 320]) {
      await b.setViewport(width, 800, true);
      await signedSynced();
      await setSidecar({ email: long });
      assert.ok(await b.eval(`return !!document.getElementById("sync-account-email");`), "the markup has #sync-account-email");
      assert.strictEqual(await q("#sync-account-email", `$$.textContent`), long, "no truncation");
      const fit = await b.eval(`
        const vw = innerWidth, bad = [];
        for (const el of document.querySelectorAll("#sync-open, #sync-panel, #sync-panel *")) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5)) bad.push(el.id || el.tagName);
        }
        return { vw, sw: document.documentElement.scrollWidth, bad };`);
      assert.ok(fit.sw <= fit.vw && fit.bad.length === 0, width + "px " + JSON.stringify(fit));
    }
    await b.setViewport(390, 800, true);
  });

  test("E-entry: the sign-in entry overlaps no panel group at short wide, landscape and portrait sizes", async () => {
    await fresh();
    try {
      for (const [w, h] of [[800, 330], [844, 340], [844, 359], [740, 300], [390, 800]]) {
        await b.setViewport(w, h, w < 1024);
        await b.goto(URL);
        const hidden = await b.eval(`return getComputedStyle(document.getElementById("settings-trigger")).display === "none";`);
        if (!hidden && await b.eval(`return getComputedStyle(document.getElementById("settings-panel")).display === "none";`)) await b.click("#settings-trigger");
        await b.waitFor(`!document.getElementById("sync-open").hidden`, { label: "the sync opener at " + w + "x" + h });
        const hits = await b.eval(`const e = document.getElementById("sync-open").getBoundingClientRect();
          return [...document.querySelectorAll("#settings-panel .panel-group")].filter(g => { const x = g.getBoundingClientRect(); return x.width && x.height && !(x.right <= e.left || x.left >= e.right || x.bottom <= e.top || x.top >= e.bottom); }).map(g => g.id || g.className);`);
        assert.deepStrictEqual(hits, [], "the entry covers a group at " + w + "x" + h);
      }
    } finally { await b.setViewport(390, 800, true); }
  });

  test("E-deeplink-export: #export and #account open their pages at boot and by same-tab fragment, and Back lands on the deck", async () => {
    await fresh();
    await b.eval(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify({ v: 1, project: PROJECT, userId: B_USER, email: "b@example.test", refresh: "r", access: "a", accessExp: Date.now() + 3600000, cursor: 0, base: {}, alias: {}, deferredDeletes: [], localOnly: [], pending: false, first: false, syncedAt: Date.now() }))});`);
    for (const [hash, page, focus] of [["#export", "export", "export-close"], ["#account", "account", "sync-heading"]]) {
      await b.goto(URL + "?d=" + page + hash);
      await b.waitFor(`!document.getElementById(${JSON.stringify(page)}).hidden`, { label: page + " at boot" });
      assert.strictEqual(await active(), focus);
      await b.eval(`history.back();`);
      await b.waitFor(`document.getElementById(${JSON.stringify(page)}).hidden`, { label: page + " closed by Back" });
      await b.goto(URL + "?d=" + page + "b");
      await b.eval(`location.hash = ${JSON.stringify(hash)};`);
      await b.waitFor(`!document.getElementById(${JSON.stringify(page)}).hidden`, { label: page + " by fragment" });
      assert.strictEqual(await active(), focus);
      await b.eval(`history.back();`);
      await b.waitFor(`document.getElementById(${JSON.stringify(page)}).hidden`, { label: page + " closed by Back after fragment" });
      assert.notStrictEqual(await b.eval(`return location.hash;`), hash);
    }
  });

  test("a same-tab #account link on a host without sign-in leaves the deck's own route in the address bar", async () => {
    await fresh();
    const plain = URL.replace("index.html", "nosync.html");
    await b.goto(plain);
    await b.waitFor(`document.getElementById("sync-open").hidden === true`, { label: "no sync entry on this host" });
    await b.eval(`location.hash = "#account";`);
    await b.waitFor(`location.hash !== "#account"`, { label: "the account fragment replaced" });
    assert.strictEqual(await q("#account", `$$.hidden`), true);
    await b.goto(plain + "#account");
    await b.waitFor(`location.hash !== "#account"`, { label: "the account fragment replaced at boot" });
  });

  test("polish: the export opener reads Export scale links and no longer says scales live only in this browser", async () => {
    await fresh();
    assert.strictEqual(await q("#backup-open", `$$.textContent`), "Export scale links");
    assert.strictEqual(await q("#backup-intro", `$$.textContent`), "A list of links you keep yourself.");
    assert.ok(!/only in this browser/i.test(await q("#backup-panel", `$$.textContent`)));
  });

  // ---- state-bound messages and flags across a sign-in flip (regroup subplan, TRI-28) ----
  const B_USER = "22222222-2222-4222-8222-222222222222";
  const bSidecar = over => JSON.stringify({ v: 1, project: PROJECT, userId: B_USER, email: "b@example.test", refresh: "r", access: "a", accessExp: Date.now() + 3600000, cursor: 0, base: {}, alias: {}, deferredDeletes: [], localOnly: [], pending: false, first: false, syncedAt: Date.now(), ...over });
  // lock "B": tab B takes the sync lock and holds it before signing in, so this tab can never get it.
  // lock "A": this tab asks for the lock in the same task as tab B's write.
  const bSignIn = async (lock, over = {}) => {
    if (lock === "B") {
      await frameJs(`window.__held = false; navigator.locks.request(${JSON.stringify("hpfc.sync")}, () => { window.__held = true; return new Promise(() => {}); }); 0`);
      await b.waitFor(`document.getElementById("tabB").contentWindow.__held === true`, { label: "tab B holding the lock" });
    }
    await b.eval(`const w = document.getElementById("tabB").contentWindow; w.eval(${JSON.stringify(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(bSidecar(over))});`)}); ${lock === "A" ? "syncStartLock();" : ""}`);
  };
  const bSignOut = () => frameJs(`localStorage.removeItem(${JSON.stringify(KEY)});`);
  const waitSigned = on => b.waitFor(`document.getElementById("sync-signed").hidden === ${!on} && document.getElementById("sync-form").hidden === ${on}`, { label: on ? "the account view" : "the sign-in form" });
  const holderIs = async holder => {
    if (holder) await b.waitFor(`syncHolder === true`, { label: "this tab holding the lock" });
    else { await sleep(200); assert.strictEqual(await b.eval(`return syncHolder;`), false, "the other tab holds the lock"); }
  };

  test("E-export-hint: with the export page open, another tab signing in hides the hint and signing out shows it", async () => {
    await fresh();
    await openFrame();
    await b.eval(`openSubpage("export");`);
    assert.strictEqual(await q("#backup-signin", `$$.hidden`), false);
    await bSignIn("B");
    await b.waitFor(`document.getElementById("backup-signin").hidden === true`, { label: "hint hidden once signed in" });
    await bSignOut();
    await b.waitFor(`document.getElementById("backup-signin").hidden === false`, { label: "hint shown once signed out" });
  });

  test("two tabs: a state flip in the other tab drops this tab's state-bound message and flags", async () => {
    for (const holder of [true, false]) {
      for (const key of ["sync.err.badCode", "sync.err.expired", "sync.err.badEmail", "sync.err.sendFailed", "sync.err.rateLimited", "sync.err.offline", "sync.sent", "sync.signedOutDone"]) {
        const row = (holder ? "holder " : "non-holder ") + key;
        await fresh();
        await openFrame();
        await openSync();
        await b.eval(`syncEmail = "old@example.test"; syncStep = "code"; syncSay(${JSON.stringify(key)}, { email: "old@example.test" });`);
        const old = await msg();
        assert.ok(old.length > 0, row);
        await bSignIn(holder ? "A" : "B");
        await waitSigned(true);
        await holderIs(holder);
        await b.waitFor(`/^Saved to your account at /.test(document.getElementById("sync-msg").textContent)`, { label: row + " signed-in status" });
        await bSignOut();
        await waitSigned(false);
        assert.notStrictEqual(await msg(), old, row + ": the message does not come back after the flip back");
        assert.strictEqual(await q("#sync-step-code", `$$.hidden`), true, row + ": no code step for the old address");
        assert.strictEqual(await q("#sync-step-email", `$$.hidden`), false, row);
      }
      for (const key of ["sync.err.deleteFailed", "arm"].concat(holder ? ["sync.err.cap", "sync.err.rate"] : [])) {
        const row = (holder ? "holder " : "non-holder ") + key;
        await fresh();
        await openFrame();
        await bSignIn(holder ? "A" : "B");
        await waitSigned(true);
        await holderIs(holder);
        await openSync();
        if (key === "arm") {
          await b.click("#sync-delete");
          await b.waitFor(`!!syncDeleteArmed`, { label: row + " armed" });
        } else await b.eval(`syncSay(${JSON.stringify(key)});`);
        const old = await msg();
        await bSignOut();
        await waitSigned(false);
        assert.notStrictEqual(await msg(), old, row + ": not shown signed out");
        await bSignIn(null);
        await waitSigned(true);
        assert.notStrictEqual(await msg(), old, row + ": not shown after signing in again");
        assert.strictEqual(await q("#sync-delete", `$$.textContent`), "Delete account", row + ": not armed after signing in again");
      }
    }
  });

  test("two tabs: a holder's failed first sync after a state flip shows pending, not the old signed-out error", async () => {
    await fresh();
    await openFrame();
    await openSync();
    await b.eval(`syncSay("sync.err.signedOut");`);
    const old = await msg();
    await failFetch("/rest/v1/saved_scales", 500);
    await bSignIn("A", { first: true, syncedAt: null });
    await waitSigned(true);
    await holderIs(true);
    await b.waitFor(`JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})).pending === true || document.getElementById("sync-msg").textContent === "Changes not yet saved to your account"`, { timeout: 8000, label: "the failed first sync" });
    await sleep(200);
    await restoreFetch();
    assert.notStrictEqual(await msg(), old);
    assert.match(await msg(), /^(Changes not yet saved to your account|Saving to your account…)$/);
  });

  const gateFail = async (frag, status) => {
    await b.eval(`window.__orig = window.__orig || window.fetch; window.__gated = 0; window.fetch = function (u, o) { if (String(u).indexOf(${JSON.stringify(frag)}) >= 0) return new Promise(function (res) { window.__gate = function () { res({ status: ${status}, ok: false, json: function () { return Promise.resolve(null); } }); }; window.__gated++; }); return window.__orig(u, o); };`);
  };

  test("two tabs: a send, verify or resend that completes after a state flip changes nothing", async () => {
    for (const kind of ["send", "verify-fail", "verify-ok", "resend"]) {
      await fresh();
      await openFrame();
      await openSync();
      await type("sync-email", EMAIL);
      if (kind !== "send") {
        await b.click("#sync-send");
        await b.waitFor(`!document.getElementById("sync-step-code").hidden`, { label: kind + " code step" });
      }
      const sent = await b.eval(`return t("sync.sent", { email: ${JSON.stringify(EMAIL)} });`);
      if (kind === "send") { await gateFetch("/auth/v1/otp"); await b.click("#sync-send"); }
      else if (kind === "resend") { await b.eval(`syncResendAt = Date.now() - 1; syncPaintResend();`); await gateFetch("/auth/v1/otp"); await b.click("#sync-resend"); }
      else {
        await type("sync-code", "123456");
        if (kind === "verify-fail") await gateFail("/auth/v1/verify", 400); else await gateFetch("/auth/v1/verify");
        await b.click("#sync-verify");
      }
      await b.waitFor(`window.__gated === 1`, { label: kind + " held" });
      await bSignIn("B");
      await waitSigned(true);
      await releaseGate();
      await b.waitFor(`!syncBusy`, { label: kind + " completed" });
      await sleep(200);
      assert.notStrictEqual(await q("#sync-panel", `$$.getAttribute("aria-busy")`), "true", kind);
      assert.ok(!/code|sent to/i.test(await msg()), kind + ": " + await msg());
      assert.notStrictEqual(await msg(), sent, kind);
      assert.strictEqual(await b.eval(`return JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})).userId;`), B_USER, kind + ": the other tab's session stands");
      await bSignOut();
      await waitSigned(false);
      assert.notStrictEqual(await msg(), sent, kind);
    }
  });
}
