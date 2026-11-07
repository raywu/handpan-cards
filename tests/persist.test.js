// Lane P (TRI-33): the app asks for persistent storage once, after the first
// successful save, never blocks on it and never lets it change a save result.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { boot: sandboxBoot } = require("./helpers/sandbox.js");

const core = require("./helpers/engine.js").loadEngine(["core"]).core;
const entry = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "synthetic_scales.json"), "utf8"))
  .find(s => s.name === "builtin amara");
const parsed = entry.reader === "legacy" ? core.parseLegacySeed(entry.string) : null;
const SCALE = parsed && parsed.ok ? core.formatSeed(parsed.value.fields) : entry.string;

const boot = async (storage) => {
  const app = sandboxBoot({ crypto: require("node:crypto").webcrypto, abortController: true,
    indexedDB: true, broadcastChannel: true, locks: true, isSecureContext: true });
  await app.waitFor("typeof booted !== 'undefined' && booted === true", { timeout: 2000 });
  if (storage !== undefined) app.sandbox.navigator.storage = storage;
  return app;
};

test("navigator.storage absent: the save succeeds and nothing throws", async () => {
  const app = await boot();
  assert.strictEqual(app.sandbox.navigator.storage, undefined);
  const result = await app.generateAsync(SCALE);
  assert.strictEqual(result.ok, true);
});

test("navigator.storage without persist: the save succeeds", async () => {
  const app = await boot({});
  assert.strictEqual((await app.generateAsync(SCALE)).ok, true);
});

test("persist denied: asked once after the first save, the save is unaffected", async () => {
  let calls = 0;
  const app = await boot({ persist: () => { calls++; return Promise.resolve(false); } });
  assert.strictEqual(calls, 0, "no request before a save");
  const first = await app.generateAsync(SCALE);
  assert.strictEqual(first.ok, true);
  assert.strictEqual(calls, 1);
  const second = await app.generateAsync(SCALE);
  assert.strictEqual(second.ok, true);
  assert.strictEqual(calls, 1, "asked once, not per save");
});

test("persist granted: asked once after the first save", async () => {
  let calls = 0;
  const app = await boot({ persist: () => { calls++; return Promise.resolve(true); } });
  assert.strictEqual((await app.generateAsync(SCALE)).ok, true);
  assert.strictEqual(calls, 1);
});

test("persist rejecting or throwing never fails the save", async () => {
  for (const persist of [() => Promise.reject(new Error("no")), () => { throw new Error("no"); }]) {
    const app = await boot({ persist });
    assert.strictEqual((await app.generateAsync(SCALE)).ok, true);
  }
});

test("a never-settling persist does not block the save", async () => {
  const app = await boot({ persist: () => new Promise(() => {}) });
  assert.strictEqual((await app.generateAsync(SCALE)).ok, true);
});

test("a refused save does not ask for persistence", async () => {
  let calls = 0;
  const app = await boot({ persist: () => { calls++; return Promise.resolve(true); } });
  const result = await app.generateAsync("not a scale");
  assert.strictEqual(result.ok, false);
  assert.strictEqual(calls, 0);
});
