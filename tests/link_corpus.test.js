// Release safety, lane C - the frozen link corpus.
//
// Every share-link wire version (v1 to v6) and every #deck= slug is frozen as a
// fixture, so a link already in someone's chat history keeps opening the same
// deck forever. The fixtures are append-only: a deliberate change to a deck id
// adds a file to tests/fixtures/deck_id_map_v1/ and never edits an entry.
//
// Oracle: each entry in tests/fixtures/share_links_v1/v<N>.json was encoded by
// the released encoder at the commit its file names, and read back by that same
// commit's decoder (its "provenance"). The current decoder is only ever held
// against those recorded decks, never used to produce them.
//
// HPFC_APP_ROOT chooses the tree under test: its index.html and src/engine/
// (default: this repo), so a release candidate can be held against the corpus.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { boot } = require("../tools/sandbox.js");

const REPO = path.join(__dirname, "..");
const APP_ROOT = process.env.HPFC_APP_ROOT ? path.resolve(process.env.HPFC_APP_ROOT) : REPO;
const HTML = fs.readFileSync(path.join(APP_ROOT, "index.html"), "utf8");
const BASE = "https://example.test/index.html";
const SCALES_KEY = "hpfc.scales.v3";

function loadEngine() {
  const sb = { console, URL, URLSearchParams, TextEncoder, TextDecoder, structuredClone, btoa, atob };
  vm.createContext(sb);
  for (const m of ["core", "voicing", "layout", "naming", "select", "share"]) {
    const file = path.join(APP_ROOT, "src", "engine", m + ".js");
    vm.runInContext(fs.readFileSync(file, "utf8"), sb, { filename: file });
  }
  return sb.HPE;
}
const HPE = loadEngine();
const plain = (x) => JSON.parse(JSON.stringify(x));
const IDB = HTML.includes("hpfc.saved-scales.v1");
const newOrigin = () => (IDB ? require("./helpers/sandbox.js").createOrigin({}) : undefined);
const bootAt = (hash, origin) => boot(IDB
  ? { href: BASE + hash, html: HTML, origin: origin || newOrigin(), indexedDB: true, broadcastChannel: true, locks: true,
    isSecureContext: true, crypto: require("node:crypto").webcrypto, abortController: true }
  : { href: BASE + hash, html: HTML, storage: origin, crypto: require("node:crypto").webcrypto, abortController: true });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = async (app) => {
  if (!IDB) return;
  await app.waitFor("typeof booted !== 'undefined' && booted === true", { timeout: 3000 });
  await pause(60);
};
const savedRaw = (app) => {
  if (!IDB) return app.store[SCALES_KEY];
  const db = app.idb.inspect("hpfc.saved-scales.v1");
  const st = db && db.stores.find((x) => x.name === "collections");
  const rec = st && st.entries.find(([k]) => k === "current");
  if (!rec) return undefined;
  return JSON.parse(rec[1]).entries.length ? rec[1] : undefined;
};
const savedCount = (app) => {
  const raw = savedRaw(app);
  return IDB ? JSON.parse(raw).entries.length : JSON.parse(raw).length;
};
const findDeck = (app, id) => (IDB ? app.get("allDecks()").find((d) => d.id === id) : app.registry()[id]);
const reuse = (app, origin) => (IDB ? origin : { ...app.store });
const shownId = (app) => {
  if (typeof app.currentDeck === "function") {
    try { return app.currentDeck().id; } catch (e) { /* no deck() in this tree */ }
  }
  return app.deckId();
};

const FIXTURES = path.join(REPO, "tests", "fixtures");
const CORPUS = [1, 2, 3, 4, 5, 6].map((n) =>
  JSON.parse(fs.readFileSync(path.join(FIXTURES, "share_links_v1", `v${n}.json`), "utf8")));
const SLUGS = JSON.parse(fs.readFileSync(path.join(FIXTURES, "share_links_v1", "slugs.json"), "utf8"));
const MAP_DIR = path.join(FIXTURES, "deck_id_map_v1");
const mapFiles = () => fs.readdirSync(MAP_DIR).filter((f) => /^\d{4}_.+\.json$/.test(f)).sort();
const ID_MAP = Object.assign({}, ...mapFiles().map((f) =>
  JSON.parse(fs.readFileSync(path.join(MAP_DIR, f), "utf8"))));
const resolveId = (recorded) => (Object.prototype.hasOwnProperty.call(ID_MAP, recorded) ? ID_MAP[recorded] : recorded);
const ENTRIES = CORPUS.flatMap((doc) => doc.entries.map((e) => ({ ...e, wire: doc.wireVersion })));

test("LC: the corpus covers wire versions 1 to 6, every entry names its provenance and every id is unique", () => {
  assert.deepEqual(CORPUS.map((d) => d.wireVersion), [1, 2, 3, 4, 5, 6]);
  for (const doc of CORPUS) {
    assert.match(doc.encoderCommit, /^[0-9a-f]{8}$/);
    assert.ok(doc.entries.length > 0);
    assert.equal(new Set(doc.entries.map((e) => e.id)).size, doc.entries.length, `v${doc.wireVersion} ids repeat`);
    for (const e of doc.entries) {
      assert.ok(e.provenance.includes(doc.encoderCommit), `${e.id}: provenance names the commit`);
      assert.ok(e.link.startsWith(String(doc.wireVersion)), `${e.id}: link opens with its version byte`);
    }
  }
  const joined = (v) => CORPUS[v - 1].entries.map((e) => e.options);
  assert.ok(joined(6).some((o) => o.angles), "v6 carries an at- entry");
  assert.ok(ENTRIES.some((e) => e.options.seats), "some entry carries seats");
  assert.ok(ENTRIES.some((e) => e.options.mirror && e.options.mirrorBottom === false), "mirror alone");
  assert.ok(ENTRIES.some((e) => e.options.anchor === "between"), "anchor between");
  assert.ok(ENTRIES.some((e) => e.options.parent !== undefined && e.options.parent !== null), "explicit parent");
  assert.ok(ENTRIES.some((e) => /%/.test(e.name || "") && /\+/.test(e.name) && /_/.test(e.name)), "a name with %, + and _");
  assert.ok(ENTRIES.some((e) => Object.values(e.fields).some((f) => f[3] === "bottom")), "bottom notes");
  assert.ok(ENTRIES.some((e) => Object.values(e.fields).some((f) => f[3] === "inner")), "inner notes");
});

test("LC: every frozen link decodes to its recorded deck id, fields, options and name", () => {
  for (const e of ENTRIES) {
    const where = `v${e.wire} ${e.id}`;
    const res = HPE.share.decode(e.link);
    assert.equal(res.ok, true, `${where}: ${res.code} ${res.reason}`);
    const value = plain(res.value);
    assert.deepEqual(value.fields, e.fields, `${where}: fields`);
    assert.deepEqual(value.options, e.options, `${where}: options`);
    assert.equal(value.options.name === undefined ? null : value.options.name, e.name, `${where}: name`);
    assert.equal(HPE.core.deckId(value.fields), resolveId(e.deckId), `${where}: deck id`);
  }
});

// Two notes decode in every era but make no chord, so the app has refused them since v1.
const NO_CHORDS = new Set(["minimal-two-notes"]);

test("LC: every frozen link opens its deck in the booted app", async () => {
  for (const e of ENTRIES) {
    const where = `v${e.wire} ${e.id}`;
    const app = bootAt("#s=" + e.link);
    await settle(app);
    if (NO_CHORDS.has(e.id)) {
      assert.equal(shownId(app), "kurd", `${where}: a scale with no playable chords opens nothing`);
      assert.equal(savedRaw(app), undefined, `${where}: and saves nothing`);
      assert.match(app.announcer().textContent, /no playable chords/, where);
      continue;
    }
    const id = resolveId(e.deckId);
    assert.equal(shownId(app), id, `${where}: the booted app shows the recorded deck`);
    const deck = findDeck(app, id);
    assert.ok(deck, `${where}: the deck is in the registry`);
    if (e.name) assert.equal(deck.name, e.name, `${where}: name`);
    assert.ok(savedCount(app) >= 1, `${where}: the opened deck is saved`);
  }
});

test("LC: every frozen #deck= slug opens its deck", async () => {
  assert.deepEqual(Object.keys(SLUGS.slugs).sort(),
    ["c-sharp-hijaz-9", "d-amara-10", "d-amara-9", "d-kurd-10", "f-low-pygmy-18"]);
  for (const [slug, id] of Object.entries(SLUGS.slugs)) {
    const app = bootAt("#deck=" + slug);
    await settle(app);
    assert.equal(shownId(app), resolveId(id), `#deck=${slug}`);
    assert.equal(app.location.hash, "#deck=" + slug, `#deck=${slug} leaves its own route in the bar`);
  }
});

test("LC: re-encoding a frozen deck at the current VERSION and decoding it gives the same deck", () => {
  assert.ok(HPE.share.VERSION >= 6);
  for (const e of ENTRIES) {
    const where = `v${e.wire} ${e.id}`;
    const first = HPE.share.decode(e.link);
    assert.equal(first.ok, true, where);
    const enc = HPE.share.encode(plain(first.value));
    assert.equal(enc.ok, true, `${where}: encode ${enc.code} ${enc.reason}`);
    assert.ok(enc.value.startsWith(String(HPE.share.VERSION)), `${where}: written at the current version`);
    const back = HPE.share.decode(enc.value);
    assert.equal(back.ok, true, `${where}: ${back.code} ${back.reason}`);
    const value = plain(back.value);
    assert.deepEqual(value.fields, e.fields, `${where}: fields`);
    assert.deepEqual(value.options, e.options, `${where}: options`);
    assert.equal(HPE.core.deckId(value.fields), resolveId(e.deckId), `${where}: deck id`);
  }
});

test("LC: a version byte above VERSION is NEEDS_NEWER_APP and boot stores nothing and rewrites no stored record", async () => {
  const above = String(HPE.share.PROFILE_VERSION + 1);
  for (const e of ENTRIES) {
    const res = HPE.share.decode(above + e.link.slice(1));
    assert.equal(res.ok, false, `v${e.wire} ${e.id}`);
    assert.equal(res.code, "NEEDS_NEWER_APP", `v${e.wire} ${e.id}`);
  }

  const sample = [1, 4, 5, 6].map((n) => CORPUS[n - 1].entries[0]).concat(
    CORPUS[5].entries.filter((e) => e.options.angles).slice(0, 1));
  for (const e of sample) {
    const newer = above + e.link.slice(1);
    const fresh = bootAt("#s=" + newer);
    await settle(fresh);
    assert.equal(savedRaw(fresh), undefined, `${e.id}: a refused link on a fresh store saves nothing`);
    assert.equal(shownId(fresh), "kurd", `${e.id}: the deck on screen is the default`);

    const owned = CORPUS[5].entries.find((x) => x.options.angles);
    const origin = newOrigin();
    const seeded = bootAt("#s=" + owned.link, origin);
    await settle(seeded);
    const before = savedRaw(seeded);
    assert.ok(before, "a stored record exists to be protected");
    const again = bootAt("#s=" + newer, reuse(seeded, origin));
    await settle(again);
    assert.equal(savedRaw(again), before, `${e.id}: the stored records are byte-identical`);
    assert.ok(findDeck(again, resolveId(owned.deckId)), `${e.id}: the saved scale is still in the registry`);
  }
});

test("LC: every frozen deck id resolves to itself or through the id map, and the map has no cycle", async () => {
  const listed = fs.readFileSync(path.join(MAP_DIR, "FROZEN.sha256"), "utf8").trim().split("\n")
    .map((l) => l.match(/^([0-9a-f]{64}) {2}(\S+)$/)).map((m) => { assert.ok(m, "FROZEN.sha256 line shape"); return m; });
  assert.deepEqual(listed.map((m) => m[2]).sort(), mapFiles(), "every map file is listed and no listed file is missing");
  for (const [, hash, file] of listed) {
    const bytes = fs.readFileSync(path.join(MAP_DIR, file));
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), hash, `${file} is frozen`);
  }

  for (const start of Object.keys(ID_MAP)) {
    const seen = new Set([start]);
    for (let at = ID_MAP[start]; Object.prototype.hasOwnProperty.call(ID_MAP, at); at = ID_MAP[at]) {
      assert.ok(!seen.has(at), `id map cycle through ${at}`);
      seen.add(at);
    }
  }

  for (const e of ENTRIES) {
    const current = HPE.core.deckId(e.fields);
    assert.equal(current, resolveId(e.deckId), `v${e.wire} ${e.id}: ${e.deckId} resolves to ${current}`);
  }
  for (const [slug, id] of Object.entries(SLUGS.slugs)) {
    const app = bootAt("#deck=" + slug);
    await settle(app);
    assert.equal(shownId(app), resolveId(id), `built-in ${id} resolves`);
  }
});

/* ---------------- section 18: acoustic links stay byte-identical ----------- */

const SHIPPED_HTML = fs.readFileSync(path.join(FIXTURES, "shipped_client_ee5438d0.html.txt"), "utf8");
function loadShippedEngine() {
  const sb = { console, URL, URLSearchParams, TextEncoder, TextDecoder, structuredClone, btoa, atob };
  vm.createContext(sb);
  for (const m of ["core", "voicing", "layout", "naming", "select", "share"]) {
    const begin = SHIPPED_HTML.indexOf(`<!-- engine:${m} begin`);
    const end = SHIPPED_HTML.indexOf(`<!-- engine:${m} end -->`);
    assert.ok(begin >= 0 && end > begin, `shipped client has engine:${m}`);
    const body = SHIPPED_HTML.slice(SHIPPED_HTML.indexOf("<script>", begin) + 8, SHIPPED_HTML.lastIndexOf("</script>", end));
    vm.runInContext(body, sb, { filename: `shipped-${m}.js` });
  }
  return sb.HPE;
}
const SHIPPED = loadShippedEngine();
const PAIRED_PAN = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5";

test("LC18: every v6 corpus link re-encodes to the identical bytes under the current engine", () => {
  let n = 0;
  for (const e of ENTRIES.filter((x) => x.wire === 6)) {
    const first = HPE.share.decode(e.link);
    assert.equal(first.ok, true, e.id);
    const enc = HPE.share.encode(plain(first.value));
    assert.equal(enc.ok, true, e.id);
    assert.equal(enc.value, e.link, `${e.id}: v6 bytes`);
    n += 1;
  }
  assert.ok(n > 0);
});

test("LC18: every corpus entry and every built-in encodes to the same bytes as the shipped client", () => {
  const seeds = ENTRIES.map((e) => [e.id, plain(HPE.share.decode(e.link).value)]);
  const decks = JSON.parse(fs.readFileSync(path.join(REPO, "data", "decks.json"), "utf8"));
  for (const deck of decks.decks || decks) {
    if (!deck.fields) continue;
    const seed = HPE.core.parseSeed(HPE.core.formatSeed(deck.fields));
    if (seed.ok) seeds.push([deck.id, plain(seed.value)]);
  }
  assert.ok(seeds.length > 20);
  for (const [id, seed] of seeds) {
    const now = HPE.share.encode(plain(seed));
    const then = SHIPPED.share.encode(plain(seed));
    assert.equal(now.ok, then.ok, id);
    assert.equal(now.value, then.value, `${id}: bytes`);
    if (now.ok) assert.ok(now.value.startsWith("6/"), id);
  }
});

test("LC18: the shipped client's decoder refuses a v7 link as NEEDS_NEWER_APP", () => {
  const seed = HPE.core.parseSeed(PAIRED_PAN).value;
  HPE.core.PROFILE_ENABLED = true;
  try {
    const map = HPE.layout.proposeProfile(seed.fields).value.map;
    const profiled = HPE.core.parseSeed(PAIRED_PAN, { profile: { id: "paired", rev: 2, map } }).value;
    const link = HPE.share.encode(profiled).value;
    assert.ok(link.startsWith("7/"));
    const old = SHIPPED.share.decode(link);
    assert.equal(old.ok, false);
    assert.equal(old.code, "NEEDS_NEWER_APP");
  } finally {
    HPE.core.PROFILE_ENABLED = false;
  }
});

// Written by the dev build at b5aed492 (PROFILE_ENABLED true, map rev 1).
const DEV_V7 = {
  pygmy: "7/uC3_uDb3_uEb3_(F3)_G3_Ab3_uBb3_C4_uDb4_Eb4_F4_G4_Ab4_C5_Eb5_-_F5_G5_uAb5/*F+AEOLIAN+12/pair-r55.r56.r60.r63.r65.r67.r68.r72.r75.i77.i79.b48.b49.b51.b58.b61.b80.-/811c17",
  kurd10: "7/(D3)_A3_Bb3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+10/pair-r57.r58.r60.r62.r64.r65.r67.r69.r72.-.-.-.-.-.-.-.-.-/e4abb5",
  offSeat: "7/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+9/pair-r57.r60.-.r64.r65.r67.r69.r72.r62.-.-.-.-.-.-.-.-.-/647ab0",
  tenRim: "7/(D3)_A3_Bb3_C4_D4_E4_F4_G4_A4_C5_D5/*D+AEOLIAN+11/pair-r57.r58.r60.r62.r64.r65.r67.r69.r72.r74.-.-.-.-.-.-.-.-/7d5ab4"
};

test("LC19: dev-build v7 links decode and migrateProfile gives the A5 result", () => {
  HPE.core.PROFILE_ENABLED = true;
  try {
    const pygmy = HPE.share.decode(DEV_V7.pygmy);
    assert.equal(pygmy.ok, true, `${pygmy.code}`);
    const pp = plain(pygmy.value.options.profile);
    assert.equal(pp.rev, 2);
    assert.deepEqual(pp.map, ["r55", "r56", "r60", "r63", "r65", "r67", "r68", "r72", "r75", "b48", "b49", "b51", "b58", "b61", "b80", null, null, null]);
    assert.deepEqual(pp.unplaced, ["i77", "i79"]);

    const kurd = HPE.share.decode(DEV_V7.kurd10);
    assert.equal(kurd.ok, true);
    const kp = plain(kurd.value.options.profile);
    assert.equal(kp.rev, 2);
    assert.deepEqual(kp.map.slice(0, 9), ["r57", "r58", "r60", "r62", "r64", "r65", "r67", "r69", "r72"]);
    assert.equal(kp.map.slice(9).every((k) => k === null), true);
    assert.equal(kp.unplaced, undefined);
    assert.equal(HPE.share.encode(kurd.value).value, DEV_V7.kurd10);

    const ten = HPE.share.decode(DEV_V7.tenRim);
    assert.equal(ten.ok, true);
    const tp = plain(ten.value.options.profile);
    assert.deepEqual(tp.map.slice(0, 9), kp.map.slice(0, 9));
    assert.deepEqual(tp.unplaced, ["r74"]);

    const off = HPE.share.decode(DEV_V7.offSeat);
    assert.equal(off.ok, true, `${off.code}`);
    const op = plain(off.value.options.profile);
    assert.equal(op.rev, 2);
    assert.deepEqual(op.map, ["r57", "r60", "r62", "r64", "r65", "r67", "r69", "r72", ...Array(10).fill(null)]);
    assert.equal(op.unplaced, undefined);
  } finally {
    HPE.core.PROFILE_ENABLED = false;
  }
});
