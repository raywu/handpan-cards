// Stored-scale invariants over a frozen corpus of real-shaped stored lists
// (tests/fixtures/stored_blobs_v1/, one file per blob, never edited: a new shape
// goes in a new file). Every test reads the BYTES the app leaves in storage, not
// the registry alone, so a boot that quietly rewrites or drops a saved scale is
// caught here.
//
// The file drives the app only through what exists on every branch: boot, the
// sheet's SAVE and DELETE, RESET SEEDED SCALES, share links in location.hash,
// the deck chips and the stored bytes. It names no app function.
//
// HPFC_APP_ROOT chooses the index.html under test (default: the repo root), so
// the frozen-guard workflow can run these base tests against a head app.
//
// Known failures on main are `todo: "<fixing PR>"`: node:test reports them
// without failing, and the fixing PR removes the todo, which is its proof.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { boot } = require("./helpers/sandbox.js");

const APP_ROOT = process.env.HPFC_APP_ROOT || path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(APP_ROOT, "index.html"), "utf8");
const CORPUS = path.join(__dirname, "fixtures", "stored_blobs_v1");
const BLOBS = Object.fromEntries(fs.readdirSync(CORPUS).filter((f) => f.endsWith(".json")).sort()
  .map((f) => [f.replace(/\.json$/, ""), JSON.parse(fs.readFileSync(path.join(CORPUS, f), "utf8"))]));
const KEY = "hpfc.scales.v3";
const LEGACY_KEY = "hpfc.scales";
const U1_JUDGED = new Set(["dup_exact", "dup_layouts"]);
// Origin/dev moves saved scales to another backend: hpfc.scales.v3 is then only
// a legacy source, so tests that need it to be the live store stand down there.
const MOVED = /hpfc\.saved-scales/.test(HTML);
const NEW_SCALE = "(E3) B3 D4 E4 F#4 G#4";

const plain = (v) => JSON.parse(JSON.stringify(v));
const appBoot = (storage = {}, opts = {}) => boot({ html: HTML, storage, abortController: true, ...opts });
const storageOf = (blob) => {
  const s = { [blob.key]: JSON.stringify(blob.records) };
  if (blob.settings) s.hpfc = JSON.stringify(blob.settings);
  return s;
};
const listOf = (app) => JSON.parse(app.store[KEY] || "[]");
const fromStore = (app) => ({ ...app.store });
const settle = async () => { for (let i = 0; i < 8; i += 1) await new Promise((r) => setImmediate(r)); };

// Dev's saved collection lives in IndexedDB: boot it the way dev's own tests do and
// read the migrated envelope back, never the app's internals.
const durable = async (storage) => {
  const { createOrigin } = require("./helpers/sandbox.js");
  const app = boot({ origin: createOrigin({ storage }), indexedDB: true, broadcastChannel: true, locks: true,
    isSecureContext: true, crypto: require("node:crypto").webcrypto, abortController: true });
  await app.waitFor("typeof booted !== 'undefined' && booted === true", { timeout: 2000 });
  await settle();
  return app;
};
const migrated = (app) => {
  const db = app.idb.inspect("hpfc.saved-scales.v1");
  const row = db && db.stores.find((st) => st.name === "collections").entries.find(([k]) => k === "current");
  return row ? JSON.parse(row[1]).entries.map((e) => e.record) : null;
};

// The pitch names a record's scale line spells, octaves and order ignored: a
// rewrite may re-spell a legacy line but must not add, drop or change a note.
const noteSig = (rec) => (rec && typeof rec.s === "string"
  ? (rec.s.match(/[A-G][#b]?/g) || []).sort().join(" ") : null);
const chips = (app) => app.els.decks.children.map((c) => c._html);

// A head script that runs before the app: counts every setItem and removeItem
// on every key, and can make getItem throw for a chosen key. The one exception
// is the settings key "hpfc", which every boot rewrites with the bytes it
// already holds: that set is not counted unless it changes the stored bytes.
const withScript = (body) => HTML.replace(/<head[^>]*>/, (m) => `${m}<script>${body}</script>`);
const COUNT_WRITES = `globalThis.__writes=[];(function(){var s=localStorage.setItem,r=localStorage.removeItem;
localStorage.setItem=function(k,v){if(k!=="hpfc"||localStorage.getItem(k)!==String(v))globalThis.__writes.push("set "+k);return s.call(localStorage,k,v)};
localStorage.removeItem=function(k){globalThis.__writes.push("remove "+k);return r.call(localStorage,k)};})();`;
const throwingGet = (key) => `(function(){var g=localStorage.getItem;
localStorage.getItem=function(k){if(k===${JSON.stringify(key)})throw new Error("denied");return g.call(localStorage,k)};})();`;

async function saveViaSheet(app, text) {
  app.els["deck-add"].click();
  app.type(text);
  app.els["scale-generate"].click();
  await settle();
}
/** SAVE a new scale, then DELETE it through its own chip and the sheet's two taps. */
async function saveThenDelete(app, text) {
  const before = new Set(chips(app));
  await saveViaSheet(app, text);
  const fresh = chips(app).find((c) => !before.has(c));
  if (!fresh) return false;
  app.els.decks.children.find((c) => c._html === fresh).onclick();
  app.els["scale-delete"].click();
  app.els["scale-delete"].click();
  await settle();
  return true;
}
async function resetSeeded(app) {
  app.els["deck-restore"].click();
  app.els["deck-restore"].click();
  await settle();
}

test("SC: the corpus is present, one file per blob, each with provenance and its expected deck ids", () => {
  const names = Object.keys(BLOBS);
  for (const n of ["v1_flat_order", "v2_bar_order", "v3_seats", "v4_full_options", "v99_unreadable_s",
    "v99_valid_seed", "dup_exact", "dup_layouts", "non_object_entry", "bad_s", "hundred_and_one_notes",
    "builtins_edited_hidden"]) assert.ok(names.includes(n), `missing blob ${n}`);
  for (const [n, b] of Object.entries(BLOBS)) {
    assert.ok(typeof b.provenance === "string" && b.provenance.length > 20, `${n}: no provenance`);
    assert.strictEqual(b.deckIds.length, b.records.length, `${n}: deckIds do not line up with records`);
  }
});

test("SC: boot never drops or alters the notes of any stored record in the corpus", async () => {
  if (MOVED) {
    let seen = 0;
    for (const [n, b] of Object.entries(BLOBS)) {
      if (U1_JUDGED.has(n)) continue;
      const raw = JSON.stringify(b.records);
      const app = await durable({ [b.key]: raw, ...(b.settings ? { hpfc: JSON.stringify(b.settings) } : {}) });
      const recs = migrated(app);
      if (recs === null) { assert.strictEqual(app.store[b.key], raw, `${n}: a protected store was rewritten`); continue; }
      seen += 1;
      assert.strictEqual(recs.length, b.records.length, `${n}: a record left the migrated collection`);
      b.records.forEach((rec, i) => assert.strictEqual(noteSig(recs[i]), noteSig(rec), `${n}[${i}]: the migration changed the notes`));
      assert.strictEqual(app.store[b.key], raw, `${n}: the migration wrote the old key`);
    }
    assert.ok(seen >= 5, `only ${seen} corpus blobs migrated`);
    return;
  }
  for (const [n, b] of Object.entries(BLOBS)) {
    if (U1_JUDGED.has(n)) continue;
    const app = appBoot(storageOf(b));
    await settle();
    const list = listOf(app);
    assert.strictEqual(list.length, b.records.length, `${n}: a record left storage at boot`);
    b.records.forEach((rec, i) => {
      if (JSON.stringify(list[i]) === JSON.stringify(rec)) return;
      assert.strictEqual(list[i].v, 4, `${n}[${i}]: altered but not rewritten as v4`);
      assert.strictEqual(noteSig(list[i]), noteSig(rec), `${n}[${i}]: the rewrite changed the notes`);
    });
  }
});

test("SC: every record in the corpus is still present after boot, SAVE of a new deck, DELETE of another deck and a second boot", async () => {
  if (MOVED) return;
  for (const [n, b] of Object.entries(BLOBS)) {
    if (U1_JUDGED.has(n)) continue;
    const app = appBoot(storageOf(b));
    await settle();
    const count = listOf(app).length;
    const before = new Set(chips(app));
    await saveViaSheet(app, NEW_SCALE);
    assert.strictEqual(listOf(app).length - count, 1, `${n}: SAVE of a new deck did not add exactly one record`);
    const fresh = chips(app).find((c) => !before.has(c));
    assert.ok(fresh, `${n}: the saved deck has no chip`);
    app.els.decks.children.find((c) => c._html === fresh).onclick();
    app.els["scale-delete"].click();
    app.els["scale-delete"].click();
    await settle();
    const again = appBoot(fromStore(app));
    await settle();
    const list = listOf(again);
    assert.strictEqual(list.length, b.records.length, `${n}: ${JSON.stringify(list)}`);
    b.records.forEach((rec, i) => {
      if (b.deckIds[i] === null) { assert.deepStrictEqual(list[i], rec, `${n}[${i}] unreadable record changed`); return; }
      assert.strictEqual(noteSig(list[i]), noteSig(rec), `${n}[${i}] lost its notes`);
    });
  }
});

test("SC: records of one scale with different layouts or palettes all stay in storage and all show", { todo: "#583 release" }, async () => {
  const b = BLOBS.dup_layouts;
  const app = appBoot(storageOf(b));
  await settle();
  assert.deepStrictEqual(plain(listOf(app).map((r) => r.o.palette)), [0, 3], "a layout left storage");
  const again = appBoot(fromStore(app));
  await settle();
  assert.strictEqual(listOf(again).length, 2);
  assert.strictEqual(chips(again).filter((c) => c.includes("Plain")).length, 2, "both layouts must show");
});

test("SC: opening the same link twice, or saving an identical deck, leaves one record", async () => {
  if (MOVED) return;
  const app = appBoot();
  await saveViaSheet(app, NEW_SCALE);
  await saveViaSheet(app, NEW_SCALE);
  assert.strictEqual(listOf(app).length, 1, JSON.stringify(listOf(app)));
  const hash = app.location.hash;
  assert.match(hash, /^#s=/, "a saved deck should leave its share link in the address bar");
  const second = appBoot({}, { href: `https://example.test/index.html${hash}` });
  await settle();
  assert.strictEqual(listOf(second).length, 1, JSON.stringify(listOf(second)));
  second.hashchange(hash, { force: true });
  await settle();
  assert.strictEqual(listOf(second).length, 1, JSON.stringify(listOf(second)));
});

test("SC: of two exact-duplicate records, one survives with its notes and options and shows", async () => {
  if (MOVED) return;
  const b = BLOBS.dup_exact;
  const app = appBoot(storageOf(b));
  await settle();
  const same = listOf(app).filter((r) => r && r.o && r.o.name === "Same");
  assert.ok(same.length >= 1, "both duplicates left storage");
  assert.deepStrictEqual(plain(same[0].o), b.records[0].o);
  assert.strictEqual(noteSig(same[0]), noteSig(b.records[0]));
  assert.ok(chips(app).some((c) => c.includes("Same")), "the surviving duplicate does not show");
});

test("SC: an unreadable record is kept byte for byte at its index through boot, SAVE, DELETE and RESET", async () => {
  if (MOVED) return;
  const unreadable = [BLOBS.bad_s.records[0], "junk", BLOBS.v99_unreadable_s.records[0]];
  const list = [...unreadable, BLOBS.v4_plain_custom.records[0], BLOBS.builtins_edited_hidden.records[0]];
  const app = appBoot({ [KEY]: JSON.stringify(list) });
  await settle();
  const keptAt = (when) => unreadable.forEach((rec, i) => assert.strictEqual(
    JSON.stringify(listOf(app)[i]), JSON.stringify(rec), `${when}: unreadable record ${i} changed`));
  keptAt("boot");
  assert.ok(await saveThenDelete(app, NEW_SCALE), "the saved deck has no chip");
  keptAt("SAVE and DELETE");
  await resetSeeded(app);
  keptAt("RESET");
  assert.strictEqual(listOf(app).length, 4, "RESET removed more than the record naming a seed");
});

test("SC: a record above RECORD_VERSION is never rewritten or removed by SAVE of its inventory or RESET",
  { todo: "#583 or a reader that refuses v > RECORD_VERSION" }, async () => {
    const b = BLOBS.v99_valid_seed;
    const app = appBoot(storageOf(b));
    await settle();
    const kept = () => listOf(app).some((r) => JSON.stringify(r) === JSON.stringify(b.records[0]));
    assert.ok(kept(), "boot");
    await saveViaSheet(app, b.records[0].s);
    assert.ok(kept(), "SAVE of its inventory replaced it");
    await resetSeeded(app);
    assert.ok(kept(), "RESET removed it");
  });

const UNREADABLE_STORES = {
  truncated_json: '[{"v":4,"s":"(D3) A3 C4 D4 E4 F4 G4 A4 C5","o":{"name":"Cut',
  empty_object: "{}",
  a_string: '"scales"',
  null_text: "null",
  getitem_throws: JSON.stringify([BLOBS.v4_plain_custom.records[0]]),
};
const bootUnreadable = (n, raw, extra = {}) => appBoot({ [KEY]: raw, ...extra },
  n === "getitem_throws" ? { html: withScript(throwingGet(KEY)) } : {});

test("SC: a present-but-unreadable store is not written by the boot rewrite or the legacy copy", async () => {
  const legacy = JSON.stringify([BLOBS.v2_bar_order.records[0]]);
  for (const [n, raw] of Object.entries(UNREADABLE_STORES)) {
    const app = bootUnreadable(n, raw, { [LEGACY_KEY]: legacy });
    await settle();
    assert.strictEqual(app.store[KEY], raw, `${n}: boot rewrote the store`);
    assert.strictEqual(app.store[LEGACY_KEY], legacy, `${n}: boot touched the legacy key`);
  }
});

test("SC: a present-but-unreadable store is never written by SAVE, DELETE or RESET", { todo: "#583" }, async () => {
  for (const [n, raw] of Object.entries(UNREADABLE_STORES)) {
    const app = bootUnreadable(n, raw);
    await settle();
    await saveThenDelete(app, NEW_SCALE);
    assert.strictEqual(app.store[KEY], raw, `${n}: SAVE or DELETE overwrote the store`);
    await resetSeeded(app);
    assert.strictEqual(app.store[KEY], raw, `${n}: RESET overwrote the store`);
  }
});

test("SC: an absent store is created by the legacy copy, and a present-but-unreadable one is not", async () => {
  if (MOVED) {
    const legacy = JSON.stringify([BLOBS.v2_bar_order.records[0]]);
    const made = await durable({ [LEGACY_KEY]: legacy });
    assert.strictEqual(made.store[LEGACY_KEY], legacy, "the migration changed the old key");
    assert.strictEqual(made.store[KEY], undefined, "the migration invented the v3 key");
    assert.deepStrictEqual(migrated(made).map(noteSig), [noteSig(BLOBS.v2_bar_order.records[0])]);
    const refused = await durable({ [KEY]: "{", [LEGACY_KEY]: legacy });
    assert.strictEqual(refused.store[KEY], "{");
    assert.strictEqual(refused.store[LEGACY_KEY], legacy);
    assert.strictEqual(migrated(refused), null);
    return;
  }
  const legacy = JSON.stringify([BLOBS.v2_bar_order.records[0]]);
  const made = appBoot({ [LEGACY_KEY]: legacy });
  await settle();
  assert.strictEqual(made.store[LEGACY_KEY], legacy, "the legacy copy changed the old key");
  assert.deepStrictEqual(plain(listOf(made).map((r) => [r.v, noteSig(r)])),
    [[4, noteSig(BLOBS.v2_bar_order.records[0])]]);
  const refused = appBoot({ [KEY]: "{", [LEGACY_KEY]: legacy });
  await settle();
  assert.strictEqual(refused.store[KEY], "{");
});

test("SC: hpfc.scales and hpfc.scales.v3 are never written or deleted after a migration to another backend", async () => {
  const legacy = JSON.stringify([BLOBS.v2_bar_order.records[0]]);
  const v3 = JSON.stringify([BLOBS.v4_plain_custom.records[0]]);
  const app = appBoot({ [LEGACY_KEY]: legacy, [KEY]: v3 }, { indexedDB: true });
  if (!app.idb) return;
  await settle();
  const before = fromStore(app);
  await saveViaSheet(app, NEW_SCALE);
  const after = fromStore(app);
  assert.strictEqual(after[LEGACY_KEY], before[LEGACY_KEY]);
  assert.strictEqual(after[KEY], before[KEY]);
});

test("SC: a corrupt store repaired by hand loads every record on the next boot", async () => {
  const damaged = appBoot({ [KEY]: "{broken" });
  await settle();
  assert.strictEqual(damaged.store[KEY], "{broken");
  const recs = [BLOBS.v4_plain_custom.records[0], BLOBS.v3_seats.records[0], BLOBS.hundred_and_one_notes.records[0]];
  const repaired = appBoot({ ...fromStore(damaged), [KEY]: JSON.stringify(recs) });
  await settle();
  assert.strictEqual(listOf(repaired).length, 3);
});

test("SC: a second boot writes nothing", async () => {
  for (const [n, b] of Object.entries(BLOBS)) {
    if (U1_JUDGED.has(n)) continue;
    const first = appBoot(storageOf(b));
    await settle();
    const second = appBoot(fromStore(first), { html: withScript(COUNT_WRITES) });
    await settle();
    assert.deepStrictEqual(plain(second.get("globalThis.__writes")), [], `${n}: the second boot wrote or removed a key`);
  }
});

test("SC: a refused write on SAVE leaves the stored list unchanged and tells the user", { todo: "#583" }, async () => {
  const b = BLOBS.v4_plain_custom;
  const app = appBoot(storageOf(b));
  await settle();
  const before = app.store[KEY];
  app.run(`localStorage.setItem = () => { throw new Error("denied"); }`);
  await saveViaSheet(app, NEW_SCALE);
  assert.strictEqual(app.store[KEY], before, "the stored list changed");
  const said = app.els["scale-msg"].textContent + app.announcer().textContent;
  assert.match(said, /not saved|unable|couldn.?t|could not|didn.?t save|failed|only until|temporar/i,
    `the user was not told: ${JSON.stringify(said)}`);
});
