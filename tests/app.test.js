// Unit tests for the inline app in index.html, booted in tests/helpers/sandbox.js.
//
// Scope: only what tools/boot_sim.js does NOT already assert. boot_sim covers the
// boot order guard, every card in both modes rendering, <svg> presence, deck
// colours in CSS vars + markup, shuffle toggling, absence of German, 177 cards.
//
// Everything asserted here is derived from docs/CARD-SPEC.md ("verified card conventions",
// "instrument layouts", "data model") or from user-observable behaviour, never
// from restating the implementation. Field identities come from the deck data's
// NOTE NAMES, which is an independent route to the pitch-class rule the app
// implements with midi % 12.
const { describe } = require("node:test");
const { test } = require("node:test");
const assert = require("node:assert");
const { boot: sandboxBoot } = require("./helpers/sandbox.js");
// Ordinary unit fixtures exercise the real no-Web-Locks session adapter with
// real host crypto and AbortController. Durable/reload fixtures opt in to the
// asynchronous shared-origin model below. Explicit negative capabilities win.
const boot = (options = {}) => require("./helpers/editor_shim.js").install(sandboxBoot({ crypto: require("node:crypto").webcrypto,
  abortController: true, ...options }));

const coarse = (app, on = true) => {
  app.sandbox.matchMedia = (query) => ({
    matches: on && /pointer:\s*coarse/.test(query), media: query,
    addEventListener() {}, removeEventListener() {},
  });
};

async function idbConnection(realm) {
  assert.ok(realm.sandbox.indexedDB, "precondition: reviewed model exposes the standard IndexedDB API");
  return new Promise((resolve, reject) => {
    const request = realm.sandbox.indexedDB.open("hpfc.saved-scales.v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("collections");
    request.onerror = () => reject(request.error || new Error("fixture database open failed"));
    request.onblocked = () => reject(new Error("fixture database open was unexpectedly blocked"));
    request.onsuccess = () => resolve(request.result);
  });
}
async function idbRecord(realm, {write = false, value} = {}) {
  const db = await idbConnection(realm);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("collections", write ? "readwrite" : "readonly");
      const store = tx.objectStore("collections");
      let key, raw;
      tx.oncomplete = () => resolve(write ? undefined : {present:key !== undefined, raw});
      tx.onabort = () => reject(tx.error || new Error("fixture transaction aborted"));
      tx.onerror = () => {}; // The transaction abort is the failure oracle.
      if (write) store.put(value, "current");
      else {
        const exists = store.getKey("current"), get = store.get("current");
        exists.onsuccess = () => { key = exists.result; };
        get.onsuccess = () => { raw = get.result; };
      }
    });
  } finally { db.close(); }
}
function idbFixtureRealm(origin, storage = {}) {
  return boot({origin, storage, indexedDB:true, broadcastChannel:true,
    html:"<script>window.__savedIdbFixtureOnly=true;</script>"});
}

// Durable persistence cases opt in explicitly and await actual transaction ACK.
function observeSavedOperations(app) {
  app.run(`{
    const original=commitSaved;
    globalThis.__testSavedOperations=new Set();
    commitSaved=function(...args) {
      const operation=original.apply(this,args);
      if(operation && typeof operation.then==="function") {
        __testSavedOperations.add(operation);
        operation.then(()=>__testSavedOperations.delete(operation),()=>__testSavedOperations.delete(operation));
      }
      return operation;
    };
  }`);
  return app;
}
async function durableBoot(options = {}) {
  const { createOrigin } = require("./helpers/sandbox.js");
  const origin=options.origin || createOrigin({storage:options.storage});
  if(Object.prototype.hasOwnProperty.call(options,"idbRaw")) {
    await idbRecord(idbFixtureRealm(origin,options.storage),{write:true,value:options.idbRaw});
  }
  const app=boot({origin,indexedDB:true,broadcastChannel:true,locks:true,isSecureContext:true,...options});
  if(options.idbFault) app.idb.fault(options.idbFault.operation,options.idbFault.error,{once:true});
  await app.waitFor("typeof booted !== 'undefined' && booted === true", {timeout:2000});
  app.fixtureOrigin=origin;
  return observeSavedOperations(app);
}
const savedRaw = app => {
  assert.ok(app.idb && typeof app.idb.inspect==="function","persistent oracle requires the independently reviewed IDB model");
  const db=app.idb.inspect("hpfc.saved-scales.v1");
  const store=db?.stores.find(s=>s.name==="collections");
  const record=store?.entries.find(([key])=>key==="current");
  return record ? record[1] : undefined;
};
const savedEnvelope = app => JSON.parse(savedRaw(app));
async function committedPreference(app, expected) {
  const deadline=Date.now()+2000;
  let actual;
  do {
    const raw=savedRaw(app);
    actual=typeof raw==="string" ? JSON.parse(raw).preferredSelection : undefined;
    if(JSON.stringify(actual)===JSON.stringify(expected)) break;
    await new Promise(resolve=>setImmediate(resolve));
  } while(Date.now()<deadline);
  assert.deepStrictEqual(actual,expected,"the literal expected boot-route preference is committed in IDB");
}

const writeBarrier = app => app.getAsync(`(async()=>{
  while(globalThis.__testSavedOperations?.size) await Promise.all([...__testSavedOperations]);
  return true;
})()`);
async function generateClick(app) {
  const control=app.els["scale-generate"],handler=control.onclick;
  assert.strictEqual(typeof handler,"function","the real Generate handler is bound");
  let operation;
  function capture(...args){operation=handler.apply(this,args);return operation;}
  control.onclick=capture;
  try {
    control.click();
    if(operation&&typeof operation.then==="function")await operation;
  } finally {
    if(control.onclick===capture)control.onclick=handler;
  }
}

// DOM listeners are synchronous dispatchers. Observe the actual Promise
// returned by the app operation they invoke; never drain unrelated timers.
async function deleteClick(app) {
  app.run(`if(!globalThis.__legacyDeleteOriginal){globalThis.__legacyDeleteOriginal=deleteDeck;
    deleteDeck=function(...args){return globalThis.__legacyDeletePromise=globalThis.__legacyDeleteOriginal(...args);};}
    globalThis.__legacyDeletePromise=null;`);
  app.els["scale-delete"].click();
  if(app.get("globalThis.__legacyDeletePromise"))await app.getAsync("globalThis.__legacyDeletePromise");
}
async function resetClick(app) {
  app.run(`if(!globalThis.__legacyCommitOriginal){globalThis.__legacyCommitOriginal=commitSaved;
    commitSaved=function(command,...args){const result=globalThis.__legacyCommitOriginal(command,...args);
      if(command.type==='reset')globalThis.__legacyResetPromise=result;return result;};}
    globalThis.__legacyResetPromise=null;`);
  app.els["deck-restore"].click();
  if(app.get("globalThis.__legacyResetPromise"))await app.getAsync("globalThis.__legacyResetPromise");
}

async function hashChange(app,hash,options={}) {
  // The window dispatcher, like a browser, does not await listeners. Capture
  // the actual import operation invoked by that listener before observing it.
  app.run(`if(!globalThis.__legacyImportOriginal){globalThis.__legacyImportOriginal=openShare;
    openShare=function(...args){return globalThis.__legacyImportPromise=globalThis.__legacyImportOriginal(...args);};}
    globalThis.__legacyImportPromise=null;`);
  app.hashchange(hash,options);
  if(app.get("globalThis.__legacyImportPromise"))await app.getAsync("globalThis.__legacyImportPromise");
}

/* ------------------------------------------------------------------ helpers */

// Field tuple layout, per docs/CARD-SPEC.md "Data model":
// fields{id:[name, octave, midi, zone, angle, label]}
const F_NAME = 0, F_OCT = 1, F_MIDI = 2, F_ZONE = 3, F_LABEL = 5;

function decks(app) {
  return app.get("DECKS");
}

function deckIndex(app, id) {
  const i = decks(app).findIndex((d) => d.id === id);
  assert.ok(i >= 0, `deck ${id} not in DECKS`);
  return i;
}

/** Look a chord up by its printed name (main + superscript). */
function chordIndex(d, name) {
  const hits = d.chords.map((c, i) => [c.main + (c.sup || ""), i]).filter(([n]) => n === name);
  assert.strictEqual(hits.length, 1, `expected exactly one "${name}" chord in ${d.id}`);
  return hits[0][1];
}

/** Arrays read out of the sandbox belong to its realm; copy before comparing. */
const arr = (a) => [...a];

/** Call one of the app's pure render helpers inside the sandbox. */
function callWithChord(app, fn, deckId, main) {
  const di = deckIndex(app, deckId);
  const ci = chordIndex(decks(app)[di], main);
  return app.get(`${fn}(DECKS[${di}], DECKS[${di}].chords[${ci}])`);
}

/**
 * docs/CARD-SPEC.md verified convention #1 (pitch-class-complete highlighting), derived
 * here from note NAMES rather than from midi arithmetic: every field whose note
 * name matches a chord note lights up - ding and bottom notes included - root
 * name in the root colour on ALL its instances, other chord tones in the tone
 * colour on all of theirs.
 */
function expectedLit(d, ch) {
  const chordNames = new Set(ch.fields.map((f) => d.fields[f][F_NAME]));
  const rootName = d.fields[ch.roots[0]][F_NAME];
  const root = [], tone = [];
  for (const key of Object.keys(d.fields)) {
    const name = d.fields[key][F_NAME];
    if (name === rootName) root.push(+key);
    else if (chordNames.has(name)) tone.push(+key);
  }
  return { root: root.sort((a, b) => a - b), tone: tone.sort((a, b) => a - b) };
}

const sorted = (set) => [...set].sort((a, b) => a - b);
const strip = (html) => html.replace(/<[^>]*>/g, "");

function block(html, cls) {
  const m = new RegExp(`<div class="${cls}">([\\s\\S]*?)</div>`).exec(html);
  assert.ok(m, `no .${cls} block in render`);
  return m[1];
}

/** The coloured spans of a note/number line, in document order. */
function colouredSpans(fragment) {
  const out = [];
  const re = /<span style="color:([^"]+)">([\s\S]*?)<\/span>/g;
  let m;
  while ((m = re.exec(fragment))) out.push({ color: m[1], text: strip(m[2]).trim() });
  return out;
}

/* --------------------------------------------- a minimal XML well-formedness
 * checker: balanced tags, quoted attributes, no stray "<", only declared
 * entities. Enough to catch an unescaped "&" or a dangling <tspan>/<sup>. */
const VOID = new Set(["br", "hr", "img", "input", "meta", "link"]);
const ENTITY = /&(?!(?:amp|lt|gt|quot|apos|nbsp);|#\d+;|#x[0-9A-Fa-f]+;)/;

function assertWellFormed(xml, where) {
  const stack = [];
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf("<", i);
    const text = lt === -1 ? xml.slice(i) : xml.slice(i, lt);
    assert.ok(!ENTITY.test(text), `${where}: bare "&" in text`);
    if (lt === -1) break;
    if (xml.startsWith("<!--", lt)) {
      const end = xml.indexOf("-->", lt);
      assert.ok(end > 0, `${where}: unterminated comment`);
      i = end + 3;
      continue;
    }
    const head = /^<(\/?)([A-Za-z][\w:.-]*)/.exec(xml.slice(lt));
    assert.ok(head, `${where}: stray "<" near ${JSON.stringify(xml.slice(lt, lt + 30))}`);
    const closing = head[1] === "/";
    const name = head[2];
    let j = lt + head[0].length, quote = null, value = "", body = "";
    for (; j < xml.length; j++) {
      const c = xml[j];
      if (quote) {
        if (c === quote) {
          assert.ok(!ENTITY.test(value), `${where}: bare "&" in an attribute of <${name}>`);
          quote = null;
          value = "";
        } else value += c;
      } else if (c === '"' || c === "'") quote = c;
      else if (c === ">") break;
      else body += c;
      if (quote) continue;
    }
    assert.ok(j < xml.length, `${where}: unterminated <${name}>`);
    assert.strictEqual(quote, null, `${where}: unbalanced quote in <${name}>`);
    const selfClosing = body.trimEnd().endsWith("/");
    if (closing) {
      assert.ok(stack.length, `${where}: </${name}> with nothing open`);
      const open = stack.pop();
      assert.strictEqual(open, name, `${where}: </${name}> closes <${open}>`);
    } else if (!selfClosing && !VOID.has(name.toLowerCase())) {
      stack.push(name);
    }
    i = j + 1;
  }
  assert.deepStrictEqual(stack, [], `${where}: tags left open`);
}

/* ------------------------------------------------ 1. chordSets highlighting */

test("chordSets: Amara Gsus4 lights the ding as a chord tone", async () => {
  const app = boot();
  const d = decks(app)[deckIndex(app, "amara")];
  const { blue, green } = callWithChord(app, "chordSets", "amara", "Gsus4");

  // Gsus4 = G + C + D. Amara (docs/CARD-SPEC.md): ding D3, 1 A3, 2 C4, 3 D4, 4 E4,
  // 5 F4, 6 G4, 7 A4, 8 C5 -> root G on field 6; tones C on 2 and 8, D on the
  // ding (0) and 3.
  assert.deepStrictEqual(sorted(blue), [6]);
  assert.deepStrictEqual(sorted(green), [0, 2, 3, 8]);

  const dingIds = Object.keys(d.fields).filter((f) => d.fields[f][F_ZONE] === "ding").map(Number);
  assert.strictEqual(dingIds.length, 1);
  assert.ok(green.has(dingIds[0]), "the ding must be lit as a tone for Gsus4");

  const exp = expectedLit(d, d.chords[chordIndex(d, "Gsus4")]);
  assert.deepStrictEqual(sorted(blue), exp.root);
  assert.deepStrictEqual(sorted(green), exp.tone);
});

test("chordSets: Amara C major has two root-coloured fields (C4 + C5)", async () => {
  const app = boot();
  const d = decks(app)[deckIndex(app, "amara")];
  const { blue, green } = callWithChord(app, "chordSets", "amara", "C");

  // Double roots are correct: both C fields carry the root colour.
  assert.deepStrictEqual(sorted(blue), [2, 8]);
  assert.deepStrictEqual(sorted(green), [4, 6]);
  assert.strictEqual(blue.size, 2);
  for (const id of blue) assert.strictEqual(d.fields[id][F_NAME], "C");
  assert.strictEqual(sorted(blue).filter((id) => !green.has(id)).length, blue.size,
    "root and tone sets must not overlap");
});

test("chordSets: a Pygmy chord on a bottom note lights that bottom field", async () => {
  const app = boot();
  const d = decks(app)[deckIndex(app, "pygmy")];
  const { blue, green } = callWithChord(app, "chordSets", "pygmy", "Fsus4");

  // Fsus4 = F + Bb + C. Bb exists only on the bottom shell (field U4 = Bb3);
  // F is the ding, F4 and F5; C is C4, C5 and the bottom C3.
  const exp = expectedLit(d, d.chords[chordIndex(d, "Fsus4")]);
  assert.deepStrictEqual(sorted(blue), exp.root);
  assert.deepStrictEqual(sorted(green), exp.tone);

  const bbIds = Object.keys(d.fields)
    .filter((f) => d.fields[f][F_NAME] === "Bb" && d.fields[f][F_ZONE] === "bottom")
    .map(Number);
  assert.strictEqual(bbIds.length, 1, "Bb lives only on the bottom shell");
  assert.ok(green.has(bbIds[0]), "the Bb bottom field must be lit");
  assert.ok([...blue].some((id) => d.fields[id][F_ZONE] === "ding"), "the F ding is a root instance");
});

/* --------------------------------------------- 2. linesHTML spelling order */

test("linesHTML keeps chord-spelling order, not pitch order (Amara Fmaj7)", async () => {
  const app = boot();
  const d = decks(app)[deckIndex(app, "amara")];
  const ch = d.chords[chordIndex(d, "Fmaj7")];
  const html = callWithChord(app, "linesHTML", "amara", "Fmaj7");

  // docs/CARD-SPEC.md convention #2: lines run in chord-spelling order from the root.
  // Fmaj7 is spelled F4 - A3 - C4 - E4 / 5 - 1 - 2 - 4; pitch order would be
  // A3 - C4 - E4 - F4, which must NOT appear.
  const notes = colouredSpans(block(html, "notesline"));
  const nums = colouredSpans(block(html, "numline"));
  assert.deepStrictEqual(notes.map((s) => s.text), ["F4", "A3", "C4", "E4"]);
  assert.deepStrictEqual(nums.map((s) => s.text), ["5", "1", "2", "4"]);

  // and the same order the canonical voicing declares
  assert.deepStrictEqual(notes.map((s) => s.text),
    arr(ch.fields).map((f) => d.fields[f][F_NAME] + d.fields[f][F_OCT]));
  assert.deepStrictEqual(nums.map((s) => s.text), arr(ch.fields).map((f) => String(d.fields[f][F_LABEL])));

  // both lines are coloured per note: root -> root colour, others -> tone colour
  for (const line of [notes, nums]) {
    assert.deepStrictEqual(line.map((s) => s.color),
      [d.colors.root, d.colors.tone, d.colors.tone, d.colors.tone]);
  }
});

/* ---------------------------------------------------- 3. bottom-note badge */

test("bottom-note badge appears with the right count, and only for bottom voicings", async () => {
  const app = boot();
  const D = decks(app);
  let withBadge = 0;
  for (let di = 0; di < D.length; di++) {
    const d = D[di];
    for (let ci = 0; ci < d.chords.length; ci++) {
      const ch = d.chords[ci];
      const html = app.get(`linesHTML(DECKS[${di}], DECKS[${di}].chords[${ci}])`);
      const n = ch.fields.filter((f) => d.fields[f][F_ZONE] === "bottom").length;
      const badge = /<div class="badge">([^<]*)<\/div>/.exec(html);
      const where = `${d.id} #${ci + 1} ${ch.main}`;
      if (n === 0) {
        assert.strictEqual(badge, null, `${where}: badge on a chord with no bottom notes`);
        assert.ok(!/BOTTOM NOTE/.test(html), `${where}: stray badge text`);
      } else {
        assert.ok(badge, `${where}: missing badge for ${n} bottom note(s)`);
        assert.strictEqual(badge[1].trim(), `${n} BOTTOM NOTE${n > 1 ? "S" : ""}`, where);
        withBadge++;
      }
    }
  }
  assert.ok(withBadge > 0, "some Pygmy chords must carry a bottom-note badge");
});

/* ------------------------------------------ 4. every rendered face is XML-ok */

test("every rendered face is well-formed markup (177 cards x 2 modes)", async () => {
  const app = boot();
  let seen = 0;
  for (const d of decks(app)) {
    app.clickChip(d.name);
    for (const mode of ["A", "B"]) {
      app.run(`setMode("${mode}")`);
      const n = app.get("order.length");
      for (let i = 0; i < n; i++) {
        for (const face of ["front", "back"]) {
          const html = app.els[face].innerHTML;
          assert.ok(html.length, `${d.id} card ${i} mode ${mode}: empty ${face}`);
          assertWellFormed(`<root>${html}</root>`, `${d.id} #${i + 1} mode ${mode} ${face}`);
        }
        if (mode === "A") seen++;
        app.els.next.onclick();
      }
    }
  }
  assert.strictEqual(seen, 177, "expected 177 cards across the five decks");
});

test("the deck picker lists Kurd 10, Amara 10, Amara 9, Hijaz, Pygmy in that order", async () => {
  const app = boot();
  assert.deepStrictEqual(Array.from(decks(app), (d) => d.id),
    ["kurd", "amara10", "amara", "hijaz", "pygmy"]);
  assert.deepStrictEqual(Array.from(decks(app), (d) => d.name),
    ["D KURD 10", "D AMARA 10", "D AMARA 9", "C# HIJAZ 9", "F3 LOW PYGMY 18"]);
});

/* ------------------------------------------------------------- 5. step() */

test("step() wraps forward and backward and clears the flip", async () => {
  const app = boot();
  const n = app.get("order.length");
  assert.ok(n > 1);
  assert.strictEqual(app.els.count.textContent, `1 / ${n}`);

  for (let i = 0; i < n; i++) app.els.next.onclick();
  assert.strictEqual(app.get("idx"), 0, "forward past the last card wraps to the first");
  assert.strictEqual(app.els.count.textContent, `1 / ${n}`);

  app.els.prev.onclick();
  assert.strictEqual(app.get("idx"), n - 1, "backward from the first card wraps to the last");
  assert.strictEqual(app.els.count.textContent, `${n} / ${n}`);

  app.flip();
  assert.strictEqual(app.get("flipped"), true);
  assert.ok(app.els.card.classList.contains("flip"));
  app.els.next.onclick();
  assert.strictEqual(app.get("flipped"), false, "stepping must land face-down on the next card");
  assert.ok(!app.els.card.classList.contains("flip"));

  app.flip();
  app.els.prev.onclick();
  assert.strictEqual(app.get("flipped"), false, "stepping backward must also clear the flip");
});

/* ----------------------------------------------------------- 6. setOrder() */

test("shuffle yields a valid permutation and shuffle-off restores card order", async () => {
  const app = boot({ random: () => 0 });
  const n = app.get("order.length");
  const ascending = [...Array(n).keys()];
  assert.deepStrictEqual(arr(app.get("order")), ascending);

  app.els.shuffle.onclick.call(app.els.shuffle);
  const shuffled = arr(app.get("order"));
  assert.strictEqual(shuffled.length, n, "shuffling must not change the deck size");
  assert.strictEqual(new Set(shuffled).size, n, "shuffled order contains duplicates");
  assert.deepStrictEqual([...shuffled].sort((a, b) => a - b), ascending, "same cards, reordered");
  assert.notDeepStrictEqual(shuffled, ascending, "shuffle must actually reorder");
  assert.strictEqual(app.els.count.textContent, `1 / ${n}`, "shuffle restarts at the first card");

  app.els.shuffle.onclick.call(app.els.shuffle);
  assert.deepStrictEqual(arr(app.get("order")), ascending, "shuffle off restores ascending order");
});

/* -------------------------------------------------------- 7-9. persistence */

test("deck and mode round-trip through localStorage (subset semantics)", async () => {
  const app = await durableBoot();
  const amara = decks(app).find(d=>d.id==="amara");
  app.clickChip(amara.name);app.run('setMode("B")');await writeBarrier(app);
  assert.deepStrictEqual(savedEnvelope(app).preferredSelection,{kind:"builtin",id:"amara"});
  assert.strictEqual(JSON.parse(app.store.hpfc).mode,"B");
  assert.strictEqual(JSON.parse(app.store.hpfc).deck,undefined,"tagged selection is never copied into legacy hpfc.deck");
  const again=await durableBoot({origin:app.fixtureOrigin});
  assert.strictEqual(again.get("selection.id"),"amara");assert.strictEqual(again.get("mode"),"B");
  assert.strictEqual(again.els.count.textContent,`1 / ${amara.chords.length}`);
});

test("a first visit with empty storage opens D Kurd 10", async () => {
  const app=boot();assert.strictEqual(app.get("selection.id"),"kurd");
  assert.strictEqual(app.els.count.textContent,`1 / ${decks(app).find(d=>d.id==="kurd").chords.length}`);
  assert.strictEqual(app.store.hpfc,undefined,"opening a default view does not invent a legacy preference write");
});

test("a store holding hijaz from before the default changed still opens Hijaz", async () => {
  const raw=JSON.stringify({deck:"hijaz",mode:"A"});const app=await durableBoot({storage:{hpfc:raw}});
  assert.strictEqual(app.get("selection.id"),"hijaz");assert.strictEqual(app.store.hpfc,raw);
  assert.deepStrictEqual(savedEnvelope(app).preferredSelection,{kind:"builtin",id:"hijaz"});
  assert.deepStrictEqual(savedEnvelope(app).migration.raw,{hpfc:raw,"hpfc.scales":null,"hpfc.scales.v3":null});
});

test("a stored built-in deck wins over the default", async () => {
  for(const id of ["amara","amara10","pygmy"]){const app=boot({storage:{hpfc:JSON.stringify({deck:id,mode:"A"})}});assert.strictEqual(app.get("selection.id"),id);}
});

test("a stored custom deck wins over the default", async () => {
  const app=await durableBoot();openSheet(app);app.type(AMARA_STRING);await generateClick(app);
  const selection=plain(app.get("selection"));assert.strictEqual(selection.kind,"saved");
  assert.match(app.currentDeck().id,/^custom:/,"musical inventory keeps the canonical engine id");
  const again=await durableBoot({origin:app.fixtureOrigin});
  assert.deepStrictEqual(plain(again.get("selection")),selection);assert.deepStrictEqual(again.currentDeck(),app.currentDeck());
});

test("a share link wins over the stored deck and becomes the stored deck", async () => {
  const seeded=boot();const result=seeded.generate(AMARA_STRING);assert.strictEqual(result.ok,true);
  const url=plain(seeded.get(`shareLink(savedEntries.get(${JSON.stringify(result.instanceId)}).deck)`));assert.strictEqual(url.ok,true);
  const raw=JSON.stringify({deck:"pygmy",mode:"A"});
  const app=await durableBoot({storage:{hpfc:raw},href:"https://example.test/index.html#s="+payload(url.value)});
  assert.strictEqual(app.currentDeck().id,result.value.id);assert.strictEqual(app.get("selection.kind"),"saved");
  assert.deepStrictEqual(savedEnvelope(app).preferredSelection,plain(app.get("selection")));
  assert.strictEqual(app.store.hpfc,raw,"share import leaves legacy selection untouched");
});

test("two boots over one store: the last selection wins and sibling keys survive", async () => {
  const raw=JSON.stringify({deck:"hijaz",mode:"A",sibling:"keep"});
  const first=await durableBoot({storage:{hpfc:raw}});first.clickChip(decks(first).find(d=>d.id==="amara").name);await writeBarrier(first);
  const second=await durableBoot({origin:first.fixtureOrigin});assert.strictEqual(second.get("selection.id"),"amara");
  second.clickChip(decks(second).find(d=>d.id==="pygmy").name);await writeBarrier(second);
  assert.strictEqual(second.store.hpfc,raw,"tagged preference preserves all old sibling values byte-for-byte");
  assert.deepStrictEqual(savedEnvelope(second).preferredSelection,{kind:"builtin",id:"pygmy"});
  assert.strictEqual((await durableBoot({origin:second.fixtureOrigin})).get("selection.id"),"pygmy");
});

test("a throwing localStorage breaks neither boot nor navigation", async () => {
  const app=boot({throwOnStorage:true});assert.ok(app.els.front.innerHTML.length);assert.strictEqual(app.get("selection.id"),"kurd");
  const amara=decks(app).find(d=>d.id==="amara");app.clickChip(amara.name);app.run('setMode("B")');app.els.next.onclick();app.flip();app.els.prev.onclick();
  assert.strictEqual(app.get("selection.id"),"amara");assert.strictEqual(app.get("mode"),"B");assert.strictEqual(app.els.count.textContent,`1 / ${amara.chords.length}`);assert.ok(app.els.back.innerHTML.length);
});

// Old writeScales catch contract -> explicit actual THIS-TAB adapter: storage
// refusal retains usability without a durable-save claim or old-key mutation.
test("writeScales swallows a storage error so generate, share and delete all stay usable", async () => {
  const app=boot({throwOnStorage:true});openSheet(app);app.type(AMARA_STRING);await generateClick(app);
  assert.strictEqual(app.sheetOpen(),false);const handle=app.get("selection.id");
  assert.strictEqual(app.get("savedMode"),"session");assert.ok(savedViews(app)[handle]);
  // Hidden Save state is superseded by a new sheet's actual validation state.
  // Prove usability by opening the next Add, rather than reading a hidden button.
  openSheet(app);app.type(AMARA_STRING);app.run("editorSession.editing=true;editorCommitLine()");assert.strictEqual(app.get("editorCanSave(editorSession.history.present)"),true);app.els["scale-back"].click();
  assert.match(app.els["saved-status"].textContent,/tab|saved/i,"temporary operation is explained");
  const url=link(app,handle);assert.strictEqual(url.ok,true);assert.strictEqual((await app.getAsync(`openShare(${JSON.stringify(payload(url.value))})`)).ok,true);
  app.run("openEditSheet(deck(), null)");await deleteClick(app);await deleteClick(app);
  await app.waitFor("!pageOpen");assert.match(app.faces(),/<svg /);assert.strictEqual(app.store["hpfc.saved-scales.v1"],undefined);
});

test("an unknown stored deck id falls back to the default deck", async () => {
  const raw=JSON.stringify({deck:"nope",mode:"A"});const app=await durableBoot({storage:{hpfc:raw}});
  const first=decks(app).find(d=>d.id===app.get("DEFAULT_DECK"));
  assert.strictEqual(app.get("selection.id"),first.id);assert.strictEqual(app.els.count.textContent,`1 / ${first.chords.length}`);assert.ok(app.faces().includes(first.name));assert.strictEqual(app.cssVar("--root"),first.colors.root);
  assert.deepStrictEqual(savedEnvelope(app).preferredSelection,{kind:"builtin",id:first.id});assert.strictEqual(app.store.hpfc,raw,"fallback persists in the new namespace while preserving legacy evidence");
});

/* ------------------------------------------------- 10. pan() circle budget */

test("pan() draws one circle per field, two more per lit field, plus the chrome", async () => {
  const app = boot();
  const D = decks(app);
  for (let di = 0; di < D.length; di++) {
    const d = D[di];
    const fieldIds = Object.keys(d.fields).map(Number);
    const bottomIds = fieldIds.filter((f) => d.fields[f][F_ZONE] === "bottom");
    // chrome: the outer instrument circle, the inner ring where the deck has
    // one, and the dashed bottom-shell ring on the x-ray deck.
    const chrome = 1 + (d.geom.inner_ring ? 1 : 0) + (d.geom.bottom ? 1 : 0);

    for (let ci = 0; ci < d.chords.length; ci++) {
      const ch = d.chords[ci];
      const svg = app.get(`pan(DECKS[${di}], DECKS[${di}].chords[${ci}])`);
      const exp = expectedLit(d, ch);
      const lit = new Set([...exp.root, ...exp.tone]);
      const where = `${d.id} #${ci + 1} ${ch.main}`;

      // convention #4: a lit field is circle + coloured band + inner hairline.
      const circles = (svg.match(/<circle\b/g) || []).length;
      assert.strictEqual(circles, chrome + fieldIds.length + 2 * lit.size,
        `${where}: circle count`);

      // every field in the voicing is lit, and lit fields carry deck colours
      for (const f of ch.fields) assert.ok(lit.has(f), `${where}: voicing field ${f} not lit`);
      const bands = (svg.match(new RegExp(`stroke="${d.colors.root}"|stroke="${d.colors.tone}"`, "g")) || []).length;
      assert.strictEqual(bands, lit.size, `${where}: one coloured band per lit field`);

      // unlit bottom fields recede as dashed circles, alongside the dashed ring
      const dashed = (svg.match(/stroke-dasharray/g) || []).length;
      const unlitBottom = bottomIds.filter((f) => !lit.has(f)).length;
      assert.strictEqual(dashed, (d.geom.bottom ? 1 : 0) + unlitBottom, `${where}: dashed circles`);
    }
  }
});

/* ================================================================ Phase 3
 * The engine inlined into index.html, and the plumbing that consumes it: a
 * registry deck() can resolve, generation that runs once at submit, a save()
 * that persists built-in ids only, and pan() honouring the solver's extent.
 * Everything here is derived from docs/ENGINE-SPEC.md sections 1, 11, 12 and
 * 14, never from restating the app's implementation.
 */

const fs = require("node:fs");
const path = require("node:path");
const { plain } = require("./helpers/sandbox.js");
// Read-only test projection of actual instance views. Keys are stable local
// handles; each value retains the canonical musical inventory id unchanged.
const savedViews = app => plain(app.get("Object.fromEntries([...savedEntries].map(([id,row])=>[id,{...row.deck,instanceId:id}]))"));


const ROOT = path.join(__dirname, "..");
const SCALES = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests", "fixtures", "synthetic_scales.json"), "utf8"));

/** A synthetic fixture's scale string, by fixture name. */
function scale(name) {
  const hit = SCALES.find((s) => s.name === name);
  assert.ok(hit, `no synthetic_scales.json entry named "${name}"`);
  return currentGrammar(hit);
}

const FIXTURE_CORE = require("./helpers/engine.js").loadEngine(["core"]).core;

/** The fixture strings are legacy grammar (their reader tag says so). The app
 *  reads the new grammar, so an ok string is re-printed through the legacy
 *  reader's own zones; a refused one is left as the fixture has it. */
function currentGrammar(entry) {
  if (entry.reader !== "legacy") return entry.string;
  const old = FIXTURE_CORE.parseLegacySeed(entry.string);
  return old.ok ? FIXTURE_CORE.formatSeed(old.value.fields) : entry.string;
}

const AMARA_STRING = scale("builtin amara");

/* ------------------------------------------------- 11. the engine is inlined */

test("index.html carries the whole engine inline, with no external script", async () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  // CLAUDE.md hard constraint: single-file app, no external JS.
  assert.ok(!/<script[^>]*\bsrc=/.test(html), "index.html loads an external script");

  const app = boot();
  const HPE = app.get("HPE");
  for (const mod of ["fontdata", "pdf", "pdfdeck", "pdfcards", "core", "importer", "voicing",
                     "layout", "naming", "select", "share", "sequence", "swipe"]) {
    assert.strictEqual(typeof HPE[mod], "object", `HPE.${mod} missing from the app`);
  }
  // core must be visible to the modules that read it, so it loads before them.
  // fontdata and pdf sit ahead of the whole engine: they read nothing from it,
  // and the print emitter that draws through them loads later still. sequence
  // reads only deck.fields/deck.chords (not another engine module), so it is
  // appended last.
  const order = [...html.matchAll(/<!-- engine:(\w+) begin/g)].map((m) => m[1]);
  assert.deepStrictEqual(order, ["fontdata", "pdf", "pdfdeck", "pdfcards", "core",
                                 "importer", "voicing", "layout", "naming", "select",
                                 "share", "sequence", "swipe"]);
  // share is the app's share surface: encode, decode and the version it guards.
  const share = app.get("HPE.share");
  for (const key of ["encode", "decode"]) {
    assert.strictEqual(typeof share[key], "function", `HPE.share.${key} missing`);
  }
  assert.strictEqual(typeof share.VERSION, "number");
});

/* ------------------------------------------- 12. the generated deck registry */

test("a generated deck resolves through deck() without joining the DECKS literal", async () => {
  const app = boot();
  const before = decks(app).length;
  const res = app.generate(AMARA_STRING);
  assert.strictEqual(res.ok, true, res.reason);

  // section 12: the id is "custom:" + 8 lowercase hex, from the seed alone.
  assert.match(res.value.id, /^custom:[0-9a-f]{8}$/);
  // the literal is untouched - validate.py and tests/paths.py both need that.
  assert.strictEqual(decks(app).length, before);
  assert.ok(!decks(app).some((d) => d.id === res.value.id));

  app.select(res.instanceId);
  assert.strictEqual(app.get("selection.id"), res.instanceId);
  const shown = app.currentDeck();
  assert.strictEqual(shown.id, res.value.id);
  // section 11: exactly these keys on a generated deck.
  assert.deepStrictEqual(Object.keys(shown).sort(),
    ["chords", "colors", "degrees", "fields", "geom", "id", "name", "options", "warnings"]);
  assert.ok(shown.chords.length > 0);
  for (const ch of shown.chords) {
    assert.deepStrictEqual(Object.keys(ch).sort(), ["fields", "main", "roots", "subtitle", "sup"]);
  }
  // and it renders: the card face carries the diagram.
  assert.match(app.faces(), /<svg /);
  assert.strictEqual(app.els.count.textContent, `1 / ${shown.chords.length}`);
});

test("generation runs once at submit, never inside deck() or render()", async () => {
  const app = boot();
  const id = app.generate(AMARA_STRING).instanceId;
  app.select(id);
  // deck() hands back the SAME object every time; nothing rebuilds per render.
  assert.strictEqual(app.get("deck() === deck()"), true);
  assert.strictEqual(app.get("deck() === selectedEntry().deck"), true);
  const identity = app.get(
    "(() => { const d = deck(); render(); render(); step(1); return d === deck(); })()");
  assert.strictEqual(identity, true, "render() or step() replaced the registry object");
  const builds = spyBuild(app);
  app.run("deck(); deck(); render(); render(); step(1); step(-1);");
  assert.strictEqual(builds(), 0, "deck() or render() ran select.build again");
});

// Q17: render()'s empty-order guard
// (index.html ~6378-6379) must stay, because the boot order must not render
// before the card-order array exists. Driven directly through the sandbox,
// with an empty `order` never reached through GENERATE or a stored scale
// (once Q23's zero-chord refusal lands, no zero-chord deck can reach render()
// that way, and this mutant would otherwise pass even with the guard gone).
test("render() with an emptied order does not throw and leaves the last card on screen", async () => {
  const app = boot();
  const before = app.els.count.textContent;
  const beforeFaces = app.faces();
  assert.doesNotThrow(() => app.run("order = []; render();"),
    "render() threw with an empty order");
  assert.strictEqual(app.els.count.textContent, before,
    "render() with an empty order overwrote the counter");
  assert.strictEqual(app.faces(), beforeFaces,
    "render() with an empty order overwrote the last good card");
});

// Finding 18 (quality-refactor plan 2026-09-30): render() used to build all
// four of question/answer/questionB/answerB on every call regardless of
// mode, which called pan() - an SVG build, the expensive part of a render -
// twice (once in `answer`, once in `questionB`) even though only one of
// those two faces is ever shown in any single mode. This spies on the
// app's own `pan` to count builds per render, rather than re-deriving which
// faces "should" need a diagram here - card_face_v1.json (finding 0)
// already pins what every face's HTML must equal; this test only pins how
// many times the expensive diagram builder runs to get there.
test("render() builds the diagram at most once per render, in every mode", async () => {
  const app = boot();
  app.run(`
    globalThis.__panCalls = 0;
    globalThis.__origPan = pan;
    pan = function(...a) { __panCalls++; return __origPan(...a); };
  `);
  app.run('__panCalls = 0; setMode("A");');
  assert.strictEqual(app.get("__panCalls"), 1, "mode A should build the diagram once per render");
  app.run('__panCalls = 0; setMode("B");');
  assert.strictEqual(app.get("__panCalls"), 1, "mode B should build the diagram once per render");
  app.run('__panCalls = 0; setMode("S");');
  assert.strictEqual(app.get("__panCalls"), 1, "mode S should build the diagram once per render");
});

test("an unknown deck id still falls back to a built-in deck", async () => {
  const app = boot({ storage: { hpfc: JSON.stringify({ deck: "custom:deadbeef", mode: "A" }) } });
  assert.strictEqual(app.get("selection.id"), app.get("DEFAULT_DECK"));
  assert.match(app.faces(), /<svg /);
});

test("a rejected scale leaves the selected deck and the registry alone", async () => {
  const app = boot();
  const before = app.get("selection.id");
  // ENGINE-SPEC section 17: the whole-tone subset has no fifth above the ding.
  const res = app.generate(scale("whole tone subset"));
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, "NO_FIFTH");
  assert.strictEqual(typeof res.reason, "string");
  assert.ok(res.reason.length > 0);
  assert.strictEqual(res.value, undefined, "an err result must carry no value");
  assert.strictEqual(app.get("selection.id"), before);
  assert.deepStrictEqual(savedViews(app), {});
});

// Q23 / D7: a pan whose only fifth involves the ding builds `ok` with
// `chords: []` (the ding never voices) - select.build's own NO_FIFTH guard
// does not see this because a fifth DOES exist, just not one that reaches a
// voicing. generateDeck refuses this before registerDeck with a UI-only
// reason (no engine code: the section 2 enum is closed and has no code for
// "no chords"), and openShare surfaces the identical reason for a zero-chord
// share link, since openShare's build path is generateDeck itself.
test("GENERATE on a zero-chord pan refuses with a message, keeps the selection, saves nothing, and openShare shows the same reason", async () => {
  const app = boot();
  const before = app.get("selection.id");
  const beforeRegistry = savedViews(app);
  const ZERO_CHORD_SEED = "(F3) C4 Ab4 Bb4";

  const res = app.generate(ZERO_CHORD_SEED);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, undefined,
    "a UI-only refusal carries no engine code");
  assert.strictEqual(typeof res.reason, "string");
  assert.ok(res.reason.length > 0);
  assert.strictEqual(res.value, undefined, "an err result must carry no value");
  assert.strictEqual(app.get("selection.id"), before, "the zero-chord refusal moved the selection");
  assert.deepStrictEqual(savedViews(app), beforeRegistry,
    "the zero-chord refusal saved something to the registry");

  // The same seed reaches openShare as an encoded link, since nothing was
  // ever registered to hang a shareLink() off of.
  const seed = plain(app.get(`HPE.core.parseLegacySeed(${JSON.stringify(ZERO_CHORD_SEED)}, {})`));
  assert.strictEqual(seed.ok, true, "the zero-chord seed itself must parse");
  const encoded = plain(app.get(
    `HPE.share.encode(${JSON.stringify({ fields: seed.value.fields, options: seed.value.options })})`));
  assert.strictEqual(encoded.ok, true, "the zero-chord seed itself must encode");

  const shared = openShare(app, encoded.value);
  assert.strictEqual(shared.ok, false);
  assert.strictEqual(shared.reason, res.reason,
    "openShare composed a different sentence than GENERATE did for the same zero-chord pan");
});

test("the share version guard rejects a newer payload with NEEDS_NEWER_APP", async () => {
  const app = boot();
  const current = app.get("newestRecordVersion()");
  assert.strictEqual(app.get(`checkShareVersion(${current}).ok`), true);
  const res = plain(app.get(`checkShareVersion(${current + 1})`));
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, "NEEDS_NEWER_APP");
  assert.match(res.reason, /newer version/i);
});

/* ------------------------------------- 13. save() persists the selected deck */

test("selecting a deck persists its tagged identity, custom instances included", async () => {
  const app=await durableBoot();const builtIn=decks(app)[1];app.select(builtIn.id);await writeBarrier(app);
  assert.deepStrictEqual(savedEnvelope(app).preferredSelection,{kind:"builtin",id:builtIn.id});
  const built=await app.generateAsync(AMARA_STRING);assert.strictEqual(built.ok,true);
  app.select(built.instanceId);await writeBarrier(app);
  assert.strictEqual(app.get("selection.id"),built.instanceId);
  assert.strictEqual(app.currentDeck().id,built.value.id,"engine inventory identity remains canonical");
  assert.deepStrictEqual(savedEnvelope(app).preferredSelection,{kind:"saved",id:built.instanceId});
  app.run('setMode("B")');assert.strictEqual(JSON.parse(app.store.hpfc).mode,"B");
  assert.strictEqual(JSON.parse(app.store.hpfc).deck,undefined,"local handles never enter legacy preferences");
  assert.deepStrictEqual(savedEnvelope(app).preferredSelection,{kind:"saved",id:built.instanceId});
});

/* --------------------------------------------- 14. pan() honours geom.ext */

test("pan() sizes a generated deck's viewBox from the solver's ext", async () => {
  const app = boot();
  // The 19-field maximum is the case where the solver's extent and the
  // built-in derivation disagree (ENGINE-SPEC section 11).
  const built = app.generate(scale("nineteen field maximum"));
  const d = { ...built.value, instanceId: built.instanceId };
  const g = d.geom;
  assert.strictEqual(typeof g.ext, "number");
  const derived = g.bottom ? 100 * (g.bottom + g.r_bnote + g.n_out) + 14 : 106;
  assert.notStrictEqual(g.ext * 100, derived,
    "fixture no longer distinguishes ext from the derived extent");

  app.select(d.instanceId || d.id);
  const svg = app.get("pan(deck(), deck().chords[0])");
  const box = svg.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/);
  assert.ok(box, "no viewBox on the generated pan");
  const ext = 100 * g.ext;
  assert.strictEqual(Number(box[1]), -ext);
  assert.strictEqual(Number(box[3]), 2 * ext);

  // every field the solver placed is inside the box it sized.
  for (const key of Object.keys(d.fields)) {
    const [, , , zone, ang] = d.fields[key];
    if (zone === "ding") continue;
    const orb = 100 * (zone === "bottom" ? g.bottom : zone === "inner" ? g.inner : g.rim);
    const r = 100 * (zone === "bottom" ? g.r_bnote : g.r_note);
    assert.ok(orb + r <= ext, `field ${key} (${zone}) sticks out of ext`);
    assert.strictEqual(typeof ang, "number");
  }
});

test("the built-in decks keep the derived extent they have always rendered", async () => {
  const app = boot();
  for (let di = 0; di < decks(app).length; di++) {
    const d = decks(app)[di];
    assert.ok(!("ext" in d.geom), `${d.id} geom grew an ext key`);
    const svg = app.get(`pan(DECKS[${di}], DECKS[${di}].chords[0])`);
    const g = d.geom;
    const ext = g.bottom ? 100 * (g.bottom + g.r_bnote + g.n_out) + 14 : 106;
    assert.ok(svg.startsWith(`<svg viewBox="${-ext} ${-ext} ${2 * ext} ${2 * ext}"`),
      `${d.id}: ${svg.slice(0, 60)}`);
  }
});

/* All five built-ins are solver output, and a test says so. Each stored deck
 * is redrawn with the solver's fields and geom swapped in; the SVG must not
 * change, for the no-chord drawing and for every chord. Pygmy's stored geom
 * carries no ext (the drawing frame stays as it was), so ext is dropped from
 * the solver's geom before the comparison. */
const SOLVER_BUILTINS = {
  hijaz: "(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4",
  amara: "(D3) A3 C4 D4 E4 F4 G4 A4 C5",
  kurd: "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5",
  amara10: "(D3) A3 C4 D4 E4 F4 G4 A4 C5 D5",
  pygmy: "[C3] [Db3] [Eb3] F3 | G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]",
};
const SOLVER_ANCHOR = { pygmy: "between" };

test("all five built-ins draw exactly as the solver draws them", async () => {
  const { loadEngine } = require("./helpers/engine.js");
  const HPE = loadEngine(["core", "layout"]);
  const app = boot();
  const D = decks(app);
  for (const id of Object.keys(SOLVER_BUILTINS)) {
    const di = D.findIndex((d) => d.id === id);
    assert.ok(di >= 0, `${id} is not a built-in deck`);
    const parsed = id === "pygmy" ? HPE.core.parseSeed(SOLVER_BUILTINS[id]) : HPE.core.parseLegacySeed(SOLVER_BUILTINS[id]);
    assert.strictEqual(parsed.ok, true, id);
    const solved = HPE.layout.solve(parsed.value, SOLVER_ANCHOR[id] ? { anchor: SOLVER_ANCHOR[id] } : undefined);
    assert.strictEqual(solved.ok, true, id);
    const solvedGeom = plain(solved.value.geom);
    delete solvedGeom.ext;
    if (id === "pygmy") assert.deepStrictEqual(plain(D[di].geom), solvedGeom, "pygmy geom is solver output minus ext");
    const byMidi = {};
    for (const key of Object.keys(solved.value.fields)) byMidi[solved.value.fields[key][2]] = solved.value.fields[key];
    const fields = {};
    for (const key of Object.keys(D[di].fields)) {
      const stored = D[di].fields[key];
      const fresh = byMidi[stored[2]];
      assert.ok(fresh, `${id} field ${key} has no solver twin`);
      fields[key] = [stored[0], stored[1], stored[2], fresh[3], fresh[4], stored[5]];
    }
    const twin = `Object.assign({}, DECKS[${di}], {fields: ${JSON.stringify(fields)}, geom: ${JSON.stringify(solvedGeom)}})`;
    assert.strictEqual(app.get(`pan(${twin}, null)`), app.get(`pan(DECKS[${di}], null)`), `${id}: no-chord drawing`);
    for (let ci = 0; ci < D[di].chords.length; ci++) {
      assert.strictEqual(app.get(`pan(${twin}, DECKS[${di}].chords[${ci}])`),
        app.get(`pan(DECKS[${di}], DECKS[${di}].chords[${ci}])`), `${id} #${ci + 1}`);
    }
  }
});

/* ------------------------------------------- 15. generation operation budget */

// Finding 21 (quality-refactor plan 2026-09-30): generation runs on the
// submit path, so it has a cost budget, but the wall-clock assertion this
// replaced (`budget(fixture, ms)`, timing app.generate() and asserting the
// best of 3 runs stayed under a millisecond ceiling) is a function of
// whatever machine runs the test, not of the algorithm - it can read green
// on a loaded CI runner's lucky draw and still miss a real regression that
// a generous ms margin happens to absorb.
//
// voicing().choose() (src/engine/voicing.js, called from HPE.select's
// build(), inside its candidates loop, once per (root, chord-type)
// candidate) is the one operation whose count scales with field count the
// same way wall-clock time did for these two fixtures, and it is
// deterministic: measured at 48
// calls for "twelve note pan" and 108 for "nineteen field maximum", both
// fixtures reproducibly, across repeated runs. Pinning an upper bound on
// that count (with headroom over the measured value, so it is not a second
// byte-for-byte pin) catches the kind of regression the timing test existed
// for - an accidental extra pass over the candidate list doubles this count
// outright, long before it would double wall-clock time on a quiet machine.
function opBudget(fixture, max) {
  test(`generating ${fixture} calls voicing().choose at most ${max} times`, async () => {
    const app = boot();
    app.run(`
      globalThis.__chooseCalls = 0;
      const __origChoose = HPE.voicing.choose;
      HPE.voicing.choose = function (...a) { __chooseCalls++; return __origChoose(...a); };
    `);
    const res = app.generate(scale(fixture));
    assert.strictEqual(res.ok, true, res.reason);
    const calls = app.get("__chooseCalls");
    assert.ok(calls > 0, "the spy never saw a call - it is not wired to the real candidate path");
    assert.ok(calls <= max,
      `generation called voicing().choose ${calls} times, budget ${max}`);
  });
}
opBudget("twelve note pan", 60);
opBudget("nineteen field maximum", 130);

/* ================================================================ Phase 3 UI
 * The scale sheet: the "+ ADD" chip, the live parse line, the message tiers,
 * the mirror and palette controls, and Generate.
 *
 * Everything here is derived from the LOCKED Phase 3 UI specification in
 * docs/SCALE_ENGINE_PLAN.md ("Phase 3 UI specification [design-review
 * 2026-09-08, locked]") and from docs/ENGINE-SPEC.md sections 1, 2, 11, 13 and
 * 15 - never from restating the app's implementation. Reason sentences come
 * from the engine's own REASONS table, so a copy edit there cannot make these
 * pass against stale text.
 */

/* ---------------------------------------------------------- 16. the sheet */

const REASONS_OF = (app, code) => app.get(
  `[HPE.core.REASONS[${JSON.stringify(code)}].reason].concat(Object.values(HPE.core.REASONS[${JSON.stringify(code)}].alternates || {}))`);

/** The strip's children, as [{label, on, id}] in document order - "+ ADD"
 *  included, because it is one of them now. */
function stripRow(app) {
  return app.els.decks.children.map((c) => ({
    label: (c._html || c._text || "").replace(/<[^>]*>/g, "").trim(),
    on: c.classList.contains("on"),
    id: c.id,
  }));
}

/** The DECK chips only: the strip without its leading "+ ADD". */
function chipRow(app) {
  return stripRow(app).filter((c) => c.id !== "deck-add");
}

function openSheet(app) {
  app.els["deck-add"].click();
  return app.els;
}


test("Escape closes the sheet and focus returns to the settings trigger", async () => {
  const app = boot();
  openSheet(app);
  app.keydown("Escape");
  assert.strictEqual(app.sheetOpen(), false);
  // "+ Add a scale" lives inside the settings panel, which closePanel()
  // already hid before the sheet opened (M2, 2026-09-28) - #deck-add cannot
  // receive focus while hidden, so cancelling returns focus to the trigger.
  assert.strictEqual(app.activeId(), "settings-trigger", "focus returns to the settings trigger");
});


test("BACK closes the page and returns focus to the control that opened it", async () => {
  const app = boot();
  openSheet(app);
  app.els["scale-back"].click();
  assert.strictEqual(app.sheetOpen(), false, "BACK did not close the page");
  assert.strictEqual(app.activeId(), "settings-trigger", "focus did not return to the settings trigger");
});

test("the page fills the viewport, so there is no backdrop left to tap", async () => {
  const app = boot();
  const sheet = app.els["scale-sheet"];
  openSheet(app);
  // The drawer closed on a tap whose target WAS the layer. A full-screen page
  // has no uncovered layer to tap, so that gesture is gone rather than merely
  // unused: leaving it live makes a stray tap on the desktop page's margin
  // discard an unsaved edit with no affordance that said it would.
  sheet.dispatchEvent({ type: "click", target: sheet });
  assert.strictEqual(app.sheetOpen(), true, "a tap on the page layer closed it");
  sheet.dispatchEvent({ type: "click", target: app.els["scale-box"] });
  assert.strictEqual(app.sheetOpen(), true, "a tap inside the page closed it");
});






test("Generate builds the deck, closes the sheet, selects it and announces the count", async () => {
  const app = boot();
  openSheet(app);
  app.type(AMARA_STRING);
  await generateClick(app);

  assert.strictEqual(app.sheetOpen(), false, "the sheet closes on success");
  const ids = Object.keys(savedViews(app));
  assert.strictEqual(ids.length, 1);
  const d = savedViews(app)[ids[0]];
  assert.strictEqual(app.get("selection.id"), ids[0], "the generated instance is selected");
  assert.strictEqual(app.get("idx"), 0, "card 1 is showing");
  assert.strictEqual(app.get("flipped"), false, "card 1 is face-up");

  const said = app.announcer();
  assert.ok(said, "no practice-screen live region");
  assert.ok(said.textContent.includes(`${d.chords.length} cards generated`),
    `announced "${said.textContent}"`);

  const row = chipRow(app);
  const mine = row.find((c) => c.label === d.name);
  assert.ok(mine, `no chip for ${d.name} in ${JSON.stringify(row)}`);
  assert.strictEqual(mine.on, true, "the new chip is not selected");
});

test("the message after GENERATE carries no layout hint, first time or second", async () => {
  const app = boot();
  openSheet(app);
  app.type(AMARA_STRING);
  await generateClick(app);
  const first = app.announcer().textContent;
  assert.match(first, /^\d+ cards generated/, `first message was "${first}"`);
  assert.doesNotMatch(first, /MIRROR|mirror|swap/, `the first message still teaches a layout: "${first}"`);
  assert.strictEqual(app.get("typeof LAYOUT_HINT"), "undefined", "LAYOUT_HINT still exists");

  openSheet(app);
  app.type(AMARA_STRING);
  await generateClick(app);
  assert.doesNotMatch(app.announcer().textContent, /Tap MIRROR TOP/);
});

// Approved variants policy supersedes inventory-key replacement: different
// portable palette intent creates another instance; an exact repeat reuses it.
test("same-inventory Add preserves the earlier palette variant and exact repeats reuse the selected instance", async () => {
  const app=boot();openSheet(app);app.type(AMARA_STRING);await generateClick(app);
  const first=app.get("selection.id"),before=savedViews(app)[first];
  openSheet(app);app.type(AMARA_STRING);app.els["scale-swatches"].children[3].click();await generateClick(app);
  const second=app.get("selection.id"),after=savedViews(app)[second];
  assert.notStrictEqual(second,first);assert.deepStrictEqual(Object.keys(savedViews(app)),[first,second]);
  assert.deepStrictEqual(savedViews(app)[first],before,"earlier named/layout meaning is preserved");
  assert.strictEqual(after.id,before.id);assert.strictEqual(after.options.palette,3);assert.deepStrictEqual(after.chords,before.chords);
  openSheet(app);app.type(AMARA_STRING);app.els["scale-swatches"].children[3].click();await generateClick(app);
  assert.strictEqual(app.get("selection.id"),second);assert.deepStrictEqual(Object.keys(savedViews(app)),[first,second]);
  assert.ok(app.announcer().textContent.includes("cards generated"));
});

test("the success path reads deck.warnings without generating a second time", async () => {
  const app = boot();
  app.run(`
    globalThis.__buildCalls = 0;
    const __realBuild = HPE.select.build;
    HPE.select.build = function (seed) { globalThis.__buildCalls += 1; return __realBuild(seed); };
  `);
  openSheet(app);
  app.type(scale("three pitch classes"));       // a pan with no thirds
  await generateClick(app);

  assert.strictEqual(app.get("__buildCalls"), 1, "select.build ran more than once");
  const d = savedViews(app)[app.get("selection.id")];
  assert.ok(d.warnings.length > 0, "this fixture is meant to warn");
  const said = app.announcer();
  assert.strictEqual(said.classList.contains("warn"), true, "warning tier not applied");
  for (const w of d.warnings) assert.ok(said.textContent.includes(w.reason),
    `"${said.textContent}" is missing "${w.reason}"`);
});


test("a custom chip label is capped at 16 characters with an ellipsis", async () => {
  const app = boot();
  openSheet(app);
  app.type(AMARA_STRING);
  await generateClick(app);
  const id = app.get("selection.id");
  // Phase 4 lets a user rename; the display cap is the UI's, not the engine's.
  app.run(`savedEntries.get(${JSON.stringify(id)}).deck.name = "A RIDICULOUSLY LONG PAN NAME"`);
  app.select(id);
  const label = chipRow(app).find((c) => c.on).label;
  assert.strictEqual(label.length, 16, `chip label "${label}" is not capped at 16`);
  assert.ok(label.endsWith("…"), `chip label "${label}" is not ellipsised`);
});

test("NAN: a chip label clips by code point, never leaving half an emoji", async () => {
  const app = boot();
  openSheet(app);
  app.type(AMARA_STRING);
  await generateClick(app);
  const id = app.get("selection.id");
  const emoji = "\ud83c\udfb5";
  for (const name of [emoji.repeat(20), "a" + emoji.repeat(20), "\u65e5\u672c".repeat(10)]) {
    app.run(`savedEntries.get(${JSON.stringify(id)}).deck.name = ${JSON.stringify(name)}`);
    app.select(id);
    const label = chipRow(app).find((c) => c.on).label;
    assert.strictEqual(Array.from(label).length, 16, `chip label ${JSON.stringify(label)} is not 16 code points`);
    assert.ok(label.endsWith("\u2026"));
    assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(label), "a lone surrogate in " + JSON.stringify(label));
  }
});

test("NAN: a non-ASCII name saves, shows in its chip and survives a reload; the download name is never empty", async () => {
  for (const [name, stem] of [["Caf\u00e9", /^Cafe_/], ["\u65e5\u672c", /^D_[A-Z]+_\d+_/]]) {
    const app = await durableBoot();
    const d = await makeCustom(app);
    openEdit(app, d);
    app.els["scale-name"].value = name;
    app.els["scale-name"].dispatchEvent({ type: "input" });
    await generateClick(app);
    assert.ok(chipRow(app).some((c) => c.label === name && c.on), name);
    const again = await durableBoot({ origin: app.fixtureOrigin });
    assert.strictEqual(savedViews(again)[d.instanceId].name, name);
    again.select(d.instanceId);
    again.run('downloadDeckPDF("shop")');
    assert.match(anchor(again).download, stem, name);
  }
});

test("arrow keys do not step the card while the sheet is open", async () => {
  const app = boot();
  app.keydown("ArrowRight");
  assert.strictEqual(app.get("idx"), 1, "arrows step the card on the practice screen");
  openSheet(app);
  app.keydown("ArrowRight");
  assert.strictEqual(app.get("idx"), 1, "an arrow inside the sheet moved the card");
});

/* ================================================================ Phase 4
 * Persist and share: HPE.share wired into the app, the seed persisted under
 * its own storage key, and the two fallback paths distinguished.
 *
 * Derived from docs/ENGINE-SPEC.md sections 1, 2, 11, 13 and 14 and from
 * docs/SCALE_ENGINE_PLAN.md "Phase 4 - persist and share" (D14: the SEED is
 * the payload, options are never hashed). Reason sentences are held to the
 * spec's own section 2 table, read out of the markdown, so a copy edit in the
 * engine cannot make these pass against stale text.
 */

const SPEC_MD = fs.readFileSync(path.join(ROOT, "docs", "ENGINE-SPEC.md"), "utf8");

/** The section 2 reason sentence for a code, read from the spec's own table. */
function specReason(code) {
  // Plan section 9 reworded BAD_NOTE; ENGINE-SPEC.md is frozen history.
  if (code === "BAD_NOTE") return "<X> is not a note. Use names like C, F#, Bb, with an optional octave, e.g. (D) A Bb C.";
  const row = new RegExp(`^\\|\\s*\`${code}\`\\s*\\|[^|]*\\|\\s*\`(.+?)\`\\s*\\|`, "m").exec(SPEC_MD);
  assert.ok(row, `no section 2 row for ${code}`);
  return row[1];
}

/** The app's own inline script - the last block, after the engine regions. */
function appScript(app) {
  return app.blocks[app.blocks.length - 1];
}

/** Encode a generated deck's seed through the app's own share surface. */
function link(app, id) {
  return plain(app.get(`shareLink(savedEntries.get(${JSON.stringify(id)}).deck)`));
}

/** The share string out of a link the app made. */
const payload = (url) => url.slice(url.indexOf("#s=") + 3);

function openShare(app, text) {
  return plain(app.get(`openShare(${JSON.stringify(String(text))})`));
}

/* ------------------------------------------------ 17. one version constant */

test("the app's record version IS the engine's, not a second copy of the number", async () => {
  const app = boot();
  assert.strictEqual(app.get("SHARE_VERSION"), app.get("HPE.share.RECORD_VERSION"),
    "SHARE_VERSION and HPE.share.RECORD_VERSION have diverged");
  // Equal values are not enough: a restated literal is equal today and wrong
  // the day either side is bumped, so the app must DERIVE the constant.
  const src = appScript(app);
  const decl = /\bSHARE_VERSION\s*=\s*([^;\n]+)/.exec(src);
  assert.ok(decl, "the app no longer declares SHARE_VERSION");
  assert.match(decl[1], /HPE\.share\.RECORD_VERSION/,
    `SHARE_VERSION is restated as "${decl[1].trim()}" instead of read from the engine`);
});

/* ------------------------------------------- 18. the share version guard */

test("checkShareVersion rejects a version that is not a finite number", async () => {
  const app = boot();
  for (const expr of ["undefined", "null", "NaN", "Infinity", '"2"', "{}", "[]"]) {
    const res = plain(app.get(`checkShareVersion(${expr})`));
    assert.strictEqual(res.ok, false, `checkShareVersion(${expr}) was accepted`);
    // Section 2's enum is CLOSED and has no "corrupt" code: a malformed
    // version is the same BAD_NOTE rejection share.js gives a corrupt string.
    assert.strictEqual(res.code, "BAD_NOTE", `checkShareVersion(${expr}) code`);
    const tail = specReason("BAD_NOTE").split("<X>")[1];
    assert.ok(res.reason.endsWith(tail),
      `checkShareVersion(${expr}) invented a sentence: "${res.reason}"`);
    assert.strictEqual("value" in res, false, "an err result carries no value");
  }
  const current = app.get("SHARE_VERSION");
  assert.strictEqual(app.get(`checkShareVersion(${current}).ok`), true);
});

test("a newer share string reaches the user as section 2's NEEDS_NEWER_APP sentence", async () => {
  const app = boot();
  const id = app.generate(AMARA_STRING).instanceId;
  const url = link(app, id);
  assert.strictEqual(url.ok, true, url.reason);

  // decode reads the version byte BEFORE the checksum, so bumping the leading
  // character is exactly the PWA case: a cached old app opening a newer link.
  // The alphabet puts the digits first, so version N is the plain digit N; it
  // is spelled out here rather than read out of the engine (CONTRACT rule 2).
  const VERSION_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                        "abcdefghijklmnopqrstuvwxyz-_";
  const newer = VERSION_CHARS.charAt(app.get("HPE.share.PROFILE_ANCHOR_VERSION") + 1) +
                payload(url.value).slice(1);
  const res = openShare(app, newer);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, "NEEDS_NEWER_APP");
  assert.strictEqual(res.reason, specReason("NEEDS_NEWER_APP"),
    "the app must surface the spec's sentence verbatim");
  assert.strictEqual(app.announcer().textContent, specReason("NEEDS_NEWER_APP"),
    "the newer-link rejection never reached the user");
  assert.strictEqual(app.announcer().classList.contains("err"), true);
  // the app stays usable: the deck on screen is untouched and still renders.
  assert.match(app.faces(), /<svg /);
});

test("a corrupt share string surfaces BAD_NOTE's reason and changes nothing", async () => {
  const app = boot();
  const id = app.generate(AMARA_STRING).instanceId;
  app.select(id);
  const str = payload(link(app, id).value);

  // one flipped character anywhere in the string fails the integrity check
  const corrupt = str.slice(0, 3) + (str[3] === "A" ? "B" : "A") + str.slice(4);
  const res = openShare(app, corrupt);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, "BAD_NOTE");
  assert.ok(res.reason.length > 0);
  assert.strictEqual(app.announcer().textContent, res.reason,
    "the app composed a sentence of its own instead of the engine's reason");
  assert.strictEqual(app.get("selection.id"), id, "a corrupt link changed the selected deck");
});

/* ------------------------------------------------- 19. the share round trip */

test("a share link restores the exact deck, and options never move the id", async () => {
  const app = boot();
  const generated = app.generate(AMARA_STRING);
  const made = { ...generated.value, instanceId: generated.instanceId };
  const url = link(app, made.instanceId);
  assert.strictEqual(url.ok, true, url.reason);
  assert.ok(url.value.includes("#s="), `share link was "${url.value}"`);

  // a second app, with nothing stored, opens the link
  const other = boot();
  assert.deepStrictEqual(savedViews(other), {});
  const res = openShare(other, payload(url.value));
  assert.strictEqual(res.ok, true, res.reason);
  // D14: core.deckId hashes formatSeed(fields) only.
  assert.strictEqual(res.value.id, made.id, "the restored deck is a different deck");
  assert.strictEqual(other.get("selection.id"), res.instanceId, "the restored local instance is selected");
  assert.strictEqual(res.value.chords.length, made.chords.length);
  assert.strictEqual(other.els.count.textContent, `1 / ${made.chords.length}`);
  assert.match(other.faces(), /<svg /);

  // and the options ride beside the fields without ever entering the hash
  const third = boot();
  const generatedThird = third.generate(AMARA_STRING, { palette: 4, mirror: true });
  const recoloured = { ...generatedThird.value, instanceId: generatedThird.instanceId };
  assert.strictEqual(recoloured.id, made.id, "an option changed the deck id");
  const back = openShare(boot(), payload(link(third, recoloured.instanceId).value));
  assert.strictEqual(back.ok, true, back.reason);
  assert.strictEqual(back.value.options.palette, 4, "the palette did not survive the link");
  assert.strictEqual(back.value.options.mirror, true, "the mirror did not survive the link");
  assert.strictEqual(back.value.id, made.id);
});

test("consuming a share link runs select.build exactly once", async () => {
  const app = boot();
  const url = link(app, app.generate(AMARA_STRING).instanceId).value;

  const other = boot();
  other.run(`
    globalThis.__buildCalls = 0;
    const __realBuild = HPE.select.build;
    HPE.select.build = function (seed) { globalThis.__buildCalls += 1; return __realBuild(seed); };
  `);
  openShare(other, payload(url));
  assert.strictEqual(other.get("__buildCalls"), 1,
    "generation must run ONCE per restore (ENGINE-SPEC section 11)");
});

/* ------------------------------------------------------- 20. persistence */

test("writing the app's own keys leaves a sibling key in hpfc untouched", async () => {
  const app = boot({
    storage: { hpfc: JSON.stringify({ deck: "amara", mode: "B", srs: { again: 3 } }) },
  });
  app.run(`setMode("A")`);
  const stored = JSON.parse(app.store.hpfc);
  assert.deepStrictEqual(stored.srs, { again: 3 },
    "save() clobbered a sibling key instead of reading, modifying and writing");
  assert.strictEqual(stored.mode, "A", "the app's own key did not land");
  assert.strictEqual(stored.deck, "amara");
});

test("a generated deck survives a reload, rebuilt from its saved seed", async () => {
  const app=await durableBoot();openSheet(app);app.type(AMARA_STRING);await generateClick(app);
  const id=app.get("selection.id"),inventory=app.currentDeck().id;assert.strictEqual(app.get("selection.kind"),"saved");assert.match(inventory,/^custom:/);
  const saved=savedEnvelope(app);assert.strictEqual(saved.entries.length,1);assert.strictEqual(saved.entries[0].instanceId,id);
  assert.strictEqual(JSON.stringify(saved).includes('"chords"'),false,"only portable seed metadata is persisted");
  assert.deepStrictEqual(saved.preferredSelection,{kind:"saved",id});
  const again=await durableBoot({origin:app.fixtureOrigin});assert.ok(savedViews(again)[id]);
  assert.strictEqual(again.get("selection.id"),id);assert.strictEqual(again.currentDeck().id,inventory);
  assert.strictEqual(again.els.count.textContent,`1 / ${app.currentDeck().chords.length}`);assert.match(again.faces(),/<svg /);assert.strictEqual(again.announcer().textContent,"");
});

test("unreadable legacy scales are preserved while a safe built-in view still boots", async () => {
  const key="hpfc.scales.v3",prefs=JSON.stringify({deck:"amara",mode:"A"});
  for(const raw of ["{{{ not json","null",'"a string"',"[null, 7]",'[{"s":"not a scale at all"}]','[{"v":99,"s":"(D) A C D E F G A C"}]','[{"v":"x","s":"(D) A C D E F G A C"}]']) {
    const app=await durableBoot({storage:{hpfc:prefs,[key]:raw}});
    assert.strictEqual(app.store[key],raw,"unreadable source is never normalized or deleted");assert.strictEqual(app.store.hpfc,prefs);
    assert.deepStrictEqual(savedViews(app),{});assert.match(app.faces(),/<svg /);assert.ok(decks(app).some(d=>d.id===app.currentDeck().id));
    let rows;try{rows=JSON.parse(raw);}catch{}
    if(Array.isArray(rows)){assert.deepStrictEqual(savedEnvelope(app).entries.map(e=>e.record),rows,"opaque rows remain byte-equivalent JSON values");assert.strictEqual(savedEnvelope(app).migration.raw[key],raw);}
    else {assert.strictEqual(app.get("savedMode"),"protected");assert.strictEqual(app.store["hpfc.saved-scales.v1"],undefined,"invalid outer collection cannot be overwritten with empty");}
  }
});

/* --------------------------------- 21. the two fallbacks are distinguished */

test("an unknown BUILT-IN deck id falls back silently; a missing custom: id says so", async () => {
  const probe = await durableBoot();
  const first = probe.get("DECKS").find(d => d.id === probe.get("DEFAULT_DECK"));

  // 21a. an unknown built-in id: SILENT. This is the Phase 3 behaviour the
  // plan marks as must-not-weaken, asserted here beside the noisy path.
  const stale = await durableBoot({ storage: { hpfc: JSON.stringify({ deck: "nope", mode: "A" }) } });
  assert.strictEqual(stale.get("selection.id"), first.instanceId || first.id);
  assert.strictEqual(stale.announcer().textContent, "",
    "an unknown built-in id must fall back without a word");

  // 21b. a missing custom: id: the saved scale is gone, and the user is told.
  const gone = await durableBoot({ storage: { hpfc: JSON.stringify({ deck: "custom:deadbeef", mode: "A" }) } });
  assert.strictEqual(gone.get("selection.id"), first.instanceId || first.id);
  const said = gone.announcer().textContent;
  assert.ok(said.length > 0, "a missing custom deck fell back in silence");
  assert.ok(said.includes(first.name),
    `the message must name the deck now showing: "${said}"`);
  assert.match(gone.faces(), /<svg /);
});

// 21c. The sibling of the malformed-saved-scales case above. "hpfc" is one
// object shared with whatever else stores settings there, so hpfc.deck can come
// back as any JSON value, not just a string. A non-string id must be ignored
// exactly like an unknown one - and, critically, must not abort the rest of
// boot: the share link in the address bar is consumed at the very END of the
// script, so a throw earlier in the tail drops it in silence while the deck on
// screen still renders and the app looks perfectly fine.
test("malformed legacy selection is protected without losing an incoming link or overwriting preferences", async () => {
  const sender=boot(),generated=sender.generate(AMARA_STRING),url=link(sender,generated.instanceId);assert.strictEqual(url.ok,true);
  const hash="#s="+payload(url.value);
  for(const bad of [5,{},true,null,[1,2]]) {
    const raw=JSON.stringify({deck:bad,mode:"A"}),app=await durableBoot({storage:{hpfc:raw},href:"https://example.test/index.html"+hash});
    assert.strictEqual(app.get("savedMode"),"protected");assert.strictEqual(app.store.hpfc,raw);assert.strictEqual(app.store["hpfc.saved-scales.v1"],undefined);
    assert.strictEqual(app.location.hash,hash,"incoming content survives protected boot for an explicit recovery choice");assert.match(app.faces(),/<svg /);
    assert.strictEqual(app.els["saved-temporary-use"].hidden,false);app.els["saved-temporary-use"].click();
    await app.waitFor("savedMode==='session' && selection.kind==='saved'");
    assert.strictEqual(app.currentDeck().id,generated.value.id);assert.strictEqual(app.store.hpfc,raw);assert.strictEqual(app.store["hpfc.saved-scales.v1"],undefined);
  }
});

/* ------------------------------------------------- 22. the Edit sheet (4c) */

/** Generate a scale through the sheet and hand back the registered deck. */
async function makeCustom(app, text = AMARA_STRING) {
  openSheet(app);
  app.type(text);
  await generateClick(app);
  return { ...app.currentDeck(), instanceId: app.get("selection.id") };
}

/** Count select.build calls from here on, inside the sandbox realm. */
function spyBuild(app) {
  app.run(`
    globalThis.__buildCalls = 0;
    const __realBuild = HPE.select.build;
    HPE.select.build = function (seed) { globalThis.__buildCalls += 1; return __realBuild(seed); };
  `);
  return () => app.get("__buildCalls");
}

const editRowsShown = (app) => ["scale-name-row", "scale-delete-row"]
  .map((id) => !app.els[id].hasAttribute("hidden"));





test("changing only an option keeps the deck id and moves the share URL", async () => {
  const app = boot();
  const d = await makeCustom(app);
  app.select(d.instanceId || d.id);
  const before = link(app, d.instanceId || d.id);
  assert.strictEqual(before.ok, true, before.reason);

  app.clickChip(d.name);
  app.els["scale-swatches"].children[3].click();
  app.els["scale-name"].value = "MY PAN";
  app.els["scale-name"].dispatchEvent({ type: "input" });
  await generateClick(app);

  // D14: options are never hashed, so the id is a pure function of the fields.
  assert.deepStrictEqual(Object.keys(savedViews(app)), [d.instanceId], "a second entry appeared");
  assert.strictEqual(app.get("selection.id"), d.instanceId, "an option change moved the instance");
  assert.strictEqual(app.currentDeck().id,d.id,"options cannot change musical inventory");
  const after = savedViews(app)[d.instanceId || d.id];
  assert.strictEqual(after.options.palette, 3);
  assert.strictEqual(after.name, "MY PAN");
  const now = link(app, d.instanceId || d.id);
  assert.strictEqual(now.ok, true, now.reason);
  assert.notStrictEqual(now.value, before.value, "the options never reached the share URL");
});

test("changing the FIELDS on save mints a new deck id", async () => {
  const app = boot();
  const d = await makeCustom(app);
  app.select(d.instanceId || d.id);
  app.clickChip(d.name);
  app.type(scale("builtin hijaz"));
  await generateClick(app);

  const made = savedViews(app)[app.get("selection.id")];
  assert.notStrictEqual(made.id, d.id, "a different pan kept the old id");
  assert.strictEqual(made.id,
    app.get("HPE.core.deckId(deck().fields)"));
});

test("a name containing a curly apostrophe (U+2019) saves, normalised to ASCII", async () => {
  const app=await durableBoot(),d=await makeCustom(app);openEdit(app,d);
  app.els["scale-name"].value="RAY\u2019S PAN";app.els["scale-name"].dispatchEvent({type:"input"});await generateClick(app);
  assert.strictEqual(app.get("selection.id"),d.instanceId,"the curly-quote rename moved the id");
  assert.ok(chipRow(app).some(c=>c.label==="RAY'S PAN"&&c.on),JSON.stringify(chipRow(app).map(c=>c.label)));
  const again=await durableBoot({origin:app.fixtureOrigin});
  assert.strictEqual(savedViews(again)[d.instanceId].name,"RAY'S PAN","the curly-quote name was not stored, or was stored un-normalised");
});

test("a name typed with iOS dashes and ellipsis saves, normalised to ASCII", async () => {
  const app=await durableBoot(),d=await makeCustom(app);openEdit(app,d);
  app.els["scale-name"].value="A \u2013 B \u2014 C\u2026";app.els["scale-name"].dispatchEvent({type:"input"});await generateClick(app);
  assert.strictEqual(app.get("selection.id"),d.instanceId,"the dash/ellipsis rename moved the id");
  assert.ok(chipRow(app).some(c=>c.label==="A - B - C..."&&c.on),JSON.stringify(chipRow(app).map(c=>c.label)));
  const again=await durableBoot({origin:app.fixtureOrigin});
  assert.strictEqual(savedViews(again)[d.instanceId].name,"A - B - C...","the dash/ellipsis name was not stored, or was stored un-normalised");
});

test("renaming keeps both identities, relabels its chip and survives a reload", async () => {
  const app=await durableBoot(),d=await makeCustom(app);openEdit(app,d);app.els["scale-name"].value="RAY'S PAN";app.els["scale-name"].dispatchEvent({type:"input"});await generateClick(app);
  assert.strictEqual(app.get("selection.id"),d.instanceId);assert.strictEqual(app.currentDeck().id,d.id);
  assert.ok(chipRow(app).some(c=>c.label==="RAY'S PAN"&&c.on));
  const again=await durableBoot({origin:app.fixtureOrigin});assert.strictEqual(savedViews(again)[d.instanceId].name,"RAY'S PAN");assert.strictEqual(again.currentDeck().id,d.id);
});

// Q29: a name typed with iOS Smart Punctuation - which turns a plain ' into a
// curly U+2019 - would print as a missing glyph. sheetOptions() folds curly
// quotes back to ASCII before the name ever reaches generateDeck (kept by
// owner decision D4a), so a name containing U+2019 must save exactly as if it
// had been typed with a straight apostrophe.

// Q29b: iOS Smart Punctuation also turns a typed -- into an em dash (U+2014)
// and ... into a single ellipsis glyph (U+2026), and a pasted name can carry
// a straight en dash (U+2013) - all of which would print as missing glyphs.
// sheetOptions() folds these back to ASCII the same way it does curly quotes, so a name carrying them must save exactly
// as if it had been typed with plain "-" and "...".

test("deleting the SELECTED custom deck falls back to a built-in, says so, and stays gone", async () => {
  const app = await durableBoot();
  const first = decks(app).find(d => d.id === app.get("DEFAULT_DECK"));
  const d = await makeCustom(app);
  app.select(d.instanceId || d.id);
  app.clickChip(d.name);
  await deleteClick(app);   // arms
  await deleteClick(app);   // confirms

  assert.strictEqual(app.sheetOpen(), false, "delete left the sheet open");
  assert.deepStrictEqual(savedViews(app), {}, "the deck is still in the registry");
  assert.strictEqual(app.get("selection.id"), first.instanceId || first.id, "delete did not fall back to the default deck");
  const said = app.announcer();
  assert.ok(said.textContent.includes(d.name),
    `the delete message must name the deck removed: "${said.textContent}"`);
  assert.ok(said.textContent.includes(first.name),
    `the delete message must name the deck now showing: "${said.textContent}"`);
  assert.match(app.faces(), /<svg /);

  // it must not come back on the next boot
  const key = app.get("SCALES_KEY");
  assert.deepStrictEqual(savedEnvelope(app).entries.map(row=>row.record), [],
    "the seed record survived the delete");
  const again = await durableBoot({origin:app.fixtureOrigin});
  assert.deepStrictEqual(savedViews(again), {}, "the deleted deck came back on the next boot");
  assert.strictEqual(again.get("selection.id"), first.instanceId || first.id);
  assert.strictEqual(again.announcer().textContent, "",
    "the fallback was already persisted; the next boot must be silent");
});

test("deleting a NON-selected custom instance leaves the selection alone", async () => {
  const app=boot(),a=await makeCustom(app),b=await makeCustom(app,OTHER_STRING);app.select(b.instanceId);
  const said=app.announcer().textContent,before=plain(app.get("savedState"));
  const result=plain(app.get(`commitSavedSession({type:"delete",collectionId:savedState.collectionId,instanceId:${JSON.stringify(a.instanceId)},expectedRevision:1})`));
  assert.strictEqual(result.ok,true);assert.strictEqual(app.get("selection.id"),b.instanceId);assert.deepStrictEqual(Object.keys(savedViews(app)),[b.instanceId]);
  assert.deepStrictEqual(plain(app.get(`savedState.entries.find(e=>e.instanceId===${JSON.stringify(b.instanceId)})`)),before.entries.find(e=>e.instanceId===b.instanceId));
  assert.strictEqual(app.announcer().textContent,said);assert.strictEqual(chipRow(app).some(c=>c.label===a.name),false);
});

/* Owner instruction, 2026-09-17: "Delete cards should require a confirmation."
   DELETE THIS DECK destroys a deck and its stored seed with one tap, sitting
   44px under SAVE CHANGES in a sheet the owner drives with a thumb. The
   confirmation is a second tap on the SAME control rather than a dialog: it
   costs the pinned footer no height (the reason the footer is one row at all -
   see the .sheetbody comment in index.html), and it cannot be dismissed by the
   Escape that also closes the page. Arming is visible in the label, so a
   half-remembered first tap is legible rather than armed-in-secret. */









/* ------------------------------------------- 23. the LAYOUT section (5) */
//
// Phase 5 / D5. A generated layout is a GUESS; the real pan may have the same
// notes in a different arrangement. The LAYOUT section corrects it - rotate the
// rim, move a single note - entirely from the keyboard, and the correction
// travels in the share URL as options.seats without moving the deck id (D5-5).

// Stage 3 moved the correction ONTO the pan: there is no slot list any more, so
// every oracle below reads the pan MOCK the Edit page draws - which is the only
// thing the owner can see, and the thing whose not moving was the complaint.

/** The hit targets the mock currently draws, as {field, note, place, selected}.
 *  `place` is WHERE the note is drawn. The index label a target announces
 *  travels with its FIELD, not with the position - the solver only ever moves
 *  angles - so the place is the only thing on screen a correction changes, and
 *  the only honest oracle for "the pan moved". */
function mockTargets(app) {
  const html = String(app.els["scale-preview"].innerHTML || "");
  return [...html.matchAll(/<circle class="panhit"[^>]*\/>/g)].map((m) => m[0]).map((t) => ({
    field: (t.match(/data-field="(\d+)"/) || [])[1],
    note: (t.match(/aria-label="([^",]*), position/) || [])[1],
    place: (t.match(/cx="([^"]*)" cy="([^"]*)"/) || []).slice(1, 3).join(","),
    selected: /data-sel="true"/.test(t),
  }));
}

/** note -> the place it is drawn at: the whole visible arrangement. */
function mockPlaces(app) {
  const out = {};
  const ts = mockTargets(app);
  for (const t of ts) out[t.note] = t.place;
  assert.strictEqual(Object.keys(out).length, ts.length,
    "two targets carry the same note name, so places cannot be read by note");
  return out;
}

/** The note the pan currently has selected, or null for none. */
function mockSelected(app) {
  const hit = mockTargets(app).filter((t) => t.selected);
  assert.ok(hit.length <= 1, "the pan drew more than one selection");
  return hit.length ? hit[0].note : null;
}

/** Press a key on the pan, as a keyboard user does. */
function panKey(app, key) {
  let prevented = false;
  app.els["scale-preview"].dispatchEvent(
    { type: "keydown", key, preventDefault() { prevented = true; } });
  return prevented;
}

/** Tap a note on the pan, the way the delegated click handler receives it:
 *  a `.panhit` carrying a FIELD id. */
function panTap(app, note) {
  const t = mockTargets(app).find((x) => x.note === note);
  assert.ok(t, `no target is drawn for ${note}`);
  app.run(`selectPanField(${JSON.stringify(t.field)})`);
  return t.note;
}

const LAYOUT_IDS = ["scale-layout-reset", "scale-note-prev", "scale-note-next",
                    "scale-seat-prev", "scale-seat-next"];

// A seed WITH a bottom shell. Stage 3 AC2 is about a bottom-shell note, which
// no rotation could reach while ROTATE was hard-wired to the rim.
const BOTTOM_STRING = "[C3] [Db3] [Eb3] (F3) G3 Ab3 [Bb3] C4 Eb4 F4 G4 Ab4 C5 Eb5";

function openEdit(app, d) {
  app.select(d.instanceId || d.id);
  app.run("openEditSheet(deck(), null)");
}

















// Q15: Home/End on the pan (index.html ~7448-7463), the sheet's Shift+Tab
// wrap (~7472-7490, the only prior Tab test at :1984 always sends
// shiftKey:false) and Enter in the scale box (~7470) had no test.






/* ------------------------------- 24. a field edit REPLACES the deck (row 73) */
//
// Owner decision on coordination-doc queue row 73 (2026-09-09): "Edit means
// edit." D14 makes the id the hash of the FIELDS, so editing the notes cannot
// keep the id - but the OLD record must not survive the edit. The new deck
// takes the old one's chip position, its selection and a name re-derived from
// its own fields, so the row never shows two chips a user cannot tell apart.
// A user who wants a fork pastes the seed into "+ ADD".

/** Open Edit on a custom deck and save a DIFFERENT scale string into it. */
async function editFields(app, d, text) {
  app.select(d.instanceId || d.id);
  app.clickChip(d.name);
  app.type(text);
  await generateClick(app);
  return app.get("selection.id");
}

const EDIT_MORE = AMARA_STRING + " D5";      // one note appended: new fields, new id

test("a field edit replaces only its stable instance and keeps the old chip position", async () => {
  const app=boot(),a=await makeCustom(app),b=await makeCustom(app,OTHER_STRING),before=chipRow(app).map(c=>c.label),at=before.indexOf(a.name);
  assert.ok(at>=0);const sibling=plain(app.get(`savedState.entries.find(e=>e.instanceId===${JSON.stringify(b.instanceId)})`));
  const now=await editFields(app,a,EDIT_MORE);assert.strictEqual(now,a.instanceId,"Edit keeps the stable local handle");
  assert.notStrictEqual(savedViews(app)[now].id,a.id,"different notes change the canonical inventory id");
  assert.deepStrictEqual(Object.keys(savedViews(app)),[a.instanceId,b.instanceId]);
  assert.deepStrictEqual(plain(app.get(`savedState.entries.find(e=>e.instanceId===${JSON.stringify(b.instanceId)})`)),sibling);
  const after=chipRow(app).map(c=>c.label);assert.strictEqual(after.length,before.length);assert.strictEqual(after[at],savedViews(app)[now].name);assert.ok(after.includes(b.name));
  assert.strictEqual(after.filter(label=>label===a.name).length,0,"old pre-edit label disappears");
});

test("a field edit updates its one envelope record instead of adding a second one", async () => {
  const app=await durableBoot(),a=await makeCustom(app),before=savedEnvelope(app);assert.strictEqual(before.entries.length,1);
  const now=await editFields(app,a,EDIT_MORE),after=savedEnvelope(app);assert.strictEqual(now,a.instanceId);assert.strictEqual(after.entries.length,1);
  assert.strictEqual(after.entries[0].instanceId,before.entries[0].instanceId);assert.strictEqual(after.entries[0].displayOrdinal,before.entries[0].displayOrdinal);assert.strictEqual(after.entries[0].revision,2);
  assert.strictEqual(after.entries[0].record.s,app.get("HPE.core.formatSeed(deck().fields)"));assert.notStrictEqual(after.entries[0].record.s,before.entries[0].record.s);
  assert.strictEqual(app.store["hpfc.scales.v3"],undefined,"new Edit leaves legacy sources unchanged");
});

test("a boot after a field edit shows one updated instance in the same chip position", async () => {
  const app=await durableBoot(),a=await makeCustom(app),b=await makeCustom(app,OTHER_STRING),at=chipRow(app).map(c=>c.label).indexOf(a.name);
  await editFields(app,a,EDIT_MORE);const current=app.currentDeck(),again=await durableBoot({origin:app.fixtureOrigin});
  assert.deepStrictEqual(Object.keys(savedViews(again)),[a.instanceId,b.instanceId]);assert.strictEqual(again.get("selection.id"),a.instanceId);assert.strictEqual(again.currentDeck().id,current.id);
  const row=chipRow(again).map(c=>c.label);assert.strictEqual(row[at],current.name);assert.ok(row.includes(b.name));
});

test("a field edit keeps the edited deck selected and renames its chip from the new fields", async () => {
  const app = boot();
  const a = await makeCustom(app);
  await editFields(app, a, EDIT_MORE);

  // The expected id is derived from the REGISTRY, not read back from
  // app.get("selection.id"): an edit replaces in place, so exactly one custom deck is left
  // and that is the one the user must still be on. Taking the id from
  // app.get("selection.id") and then asserting app.get("selection.id") equals it is a tautology that
  // passes even when the edit bounces the user onto a built-in.
  const ids = Object.keys(savedViews(app));
  assert.strictEqual(ids.length, 1,
    `an edit left ${ids.length} custom decks instead of replacing in place`);
  const now = ids[0];
  assert.strictEqual(app.get("selection.id"), now,
    "the user was bounced off the deck they were editing");
  const made = savedViews(app)[now];
  // autoName lives in select.js and is the ONE producer of a generated name;
  // nothing here reimplements it and nothing disambiguates a duplicate.
  const auto = app.get(
    `HPE.select.deckName({ fields: savedEntries.get(${JSON.stringify(now)}).deck.fields, ` +
    `options: { parent: savedEntries.get(${JSON.stringify(now)}).deck.options.parent } })`);
  assert.strictEqual(made.name, auto, "the auto name was pinned to the old fields");
  assert.notStrictEqual(made.name, a.name, "the chip label did not change with the notes");
  const on = chipRow(app).filter((c) => c.on).map((c) => c.label);
  assert.deepStrictEqual(on, [auto], `the selected chip reads ${JSON.stringify(on)}`);
});

test("an options-only edit still replaces in place and keeps its stored record", async () => {
  const app = await durableBoot();
  const a = await makeCustom(app);
  const key = app.get("SCALES_KEY");
  app.select(a.instanceId || a.id);
  app.clickChip(a.name);
  app.els["scale-swatches"].children[2].click();
  await generateClick(app);

  assert.deepStrictEqual(Object.keys(savedViews(app)), [a.instanceId],
    "an options-only edit moved the instance");
  assert.strictEqual(savedViews(app)[a.instanceId || a.id].options.palette, 2);
  const list = savedEnvelope(app).entries.map(row=>row.record);
  assert.strictEqual(list.length, 1,
    `an options-only edit disturbed the stored record: ${JSON.stringify(list)}`);
  assert.strictEqual(list[0].s, app.get(`HPE.core.formatSeed(savedEntries.get(${JSON.stringify(a.instanceId || a.id)}).deck.fields)`));
});

test("a field edit still runs select.build exactly once (13A)", async () => {
  const app = boot();
  const a = await makeCustom(app);
  app.select(a.instanceId || a.id);
  app.clickChip(a.name);
  app.type(EDIT_MORE);
  const calls = spyBuild(app);
  await generateClick(app);
  assert.strictEqual(calls(), 1, "a replacing save must run select.build exactly once");
});

/* ------------------------- 25. an edit never destroys ANOTHER deck (row 131) */
//
// Owner decision on coordination-doc queue row 131 (2026-09-09): editing deck A
// onto deck B's exact scale REFUSES the save. Both decks survive, the sheet
// stays open, the box is marked bad the way a parse error marks it, and the
// live region carries UI copy - never an engine reason, because the section 2
// code enum is CLOSED and has no code for "that scale is taken".

const COLLIDE_MSG = /Another scale already has these notes/;
// Deliberately NOT a built-in's scale: the built-in Hijaz chip already reads
// "C# HIJAZ 9", which is also what autoName gives a pan seeded from it, so a
// chip lookup by label could not tell the two apart.
const OTHER_STRING = "(E3) B3 D4 E4 F#4 G4 A4 B4";
const THIRD_STRING = "(G3) D4 F4 G4 A4 Bb4 D5";

/** Rename the deck under the Edit sheet and recolour/flip it, then save. */
async function editOptions(app, d, name) {
  app.select(d.instanceId || d.id);
  app.clickChip(d.name);
  if (name !== undefined) {
    app.els["scale-name"].value = name;
    app.els["scale-name"].dispatchEvent({ type: "input" });
  }
  app.els["scale-swatches"].children[4].click();
  await generateClick(app);
  return savedViews(app)[app.get("selection.id")];
}

// The approved identity model replaces the old collision veto with sibling
// preservation; converging musical inventories are valid Edit outcomes.
test("an edit onto another scale's inventory preserves both instances and sibling bytes", async () => {
  const app=boot(),a=await makeCustom(app),b=await makeCustom(app,OTHER_STRING);
  const bNamed=await editOptions(app,b,"RAY'S PAN");assert.strictEqual(bNamed.options.palette,4);
  const before=plain(app.get("savedState")),keys=Object.keys(savedViews(app));
  const target=before.entries.find(e=>e.instanceId===b.instanceId);
  await editFields(app,a,app.get(`HPE.core.formatSeed(savedEntries.get(${JSON.stringify(b.instanceId)}).deck.fields)`));
  assert.deepStrictEqual(Object.keys(savedViews(app)),keys);assert.strictEqual(app.get("selection.id"),a.instanceId);
  assert.strictEqual(app.sheetOpen(),false);assert.strictEqual(savedViews(app)[a.instanceId].id,b.id);
  assert.deepStrictEqual(plain(app.get("savedState.entries.find(e=>e.instanceId==="+JSON.stringify(b.instanceId)+")")),target,"other instance's complete wrapper/record bytes stay unchanged");
  assert.strictEqual(savedViews(app)[b.instanceId].name,"RAY'S PAN");assert.strictEqual(savedViews(app)[b.instanceId].options.palette,4);
  assert.strictEqual(app.store["hpfc.scales.v3"],undefined,"Edit never writes the retired namespace");
});

test("the collision refusal never fires on an options-only edit, a new scale, a re-save or ADD", async () => {
  // (a) an options-only edit
  const app = boot();
  const a = await makeCustom(app);
  const b = await makeCustom(app, OTHER_STRING);
  await editOptions(app, b, "RAY'S PAN");
  assert.strictEqual(savedViews(app)[b.instanceId || b.id].options.palette, 4,
    "an options-only edit was refused");

  // (b) a field edit to a genuinely new scale
  const now = await editFields(app, a, EDIT_MORE);
  assert.strictEqual(now, a.instanceId, "the field edit keeps its local handle");
  assert.ok(savedViews(app)[now], "a field edit to a new scale was refused");

  // (c) a re-save of an unchanged deck
  const d = savedViews(app)[now];
  app.select(d.instanceId || d.id);
  app.clickChip(d.name);
  await generateClick(app);
  assert.strictEqual(app.sheetOpen(), false, "an unchanged re-save was refused");
  assert.ok(savedViews(app)[d.instanceId || d.id], "an unchanged re-save lost the deck");

  // (d) the ADD path on a seed that already exists: dedupe by id, not a refusal
  const keys = Object.keys(savedViews(app));
  openSheet(app);
  app.type(app.get(`HPE.core.formatSeed(savedEntries.get(${JSON.stringify(b.instanceId || b.id)}).deck.fields)`));
  await generateClick(app);
  assert.strictEqual(app.sheetOpen(), false, "the ADD path was refused as a collision");
  const added=app.get("selection.id");assert.notStrictEqual(added,b.instanceId,"plain Add is distinct from a named palette/mirror variant");
  assert.deepStrictEqual(Object.keys(savedViews(app)).slice(0,-1),keys);assert.deepStrictEqual(savedViews(app)[b.instanceId].name,"RAY'S PAN");
  openSheet(app);app.type(app.get("HPE.core.formatSeed(deck().fields)"));await generateClick(app);
  assert.strictEqual(app.get("selection.id"),added,"an exact portable Add repeat reuses its instance");assert.strictEqual(Object.keys(savedViews(app)).length,keys.length+1);
});

test("a converging same-inventory Edit builds once and preserves both instances (13A)", async () => {
  const app=boot(),a=await makeCustom(app),b=await makeCustom(app,OTHER_STRING);
  app.select(a.instanceId);app.clickChip(a.name);app.type(app.get(`HPE.core.formatSeed(savedEntries.get(${JSON.stringify(b.instanceId)}).deck.fields)`));
  const calls=spyBuild(app);await generateClick(app);
  assert.strictEqual(app.sheetOpen(),false);assert.strictEqual(calls(),1,"one accepted Edit cannot rebuild during validation/commit/render");
  assert.deepStrictEqual(Object.keys(savedViews(app)),[a.instanceId,b.instanceId]);assert.strictEqual(savedViews(app)[a.instanceId].id,b.id);
});

/* ------------------- 26. an options-only edit keeps its chip index (row 132) */

test("an options-only edit keeps its chip index across a reload with three instances", async () => {
  const app=await durableBoot(),one=await makeCustom(app),two=await makeCustom(app,OTHER_STRING),three=await makeCustom(app,THIRD_STRING),before=chipRow(app).map(c=>c.label),at=before.indexOf(two.name);
  assert.ok(at>before.indexOf(three.name)&&at<before.indexOf(one.name));const keys=savedEnvelope(app).entries.map(e=>e.instanceId);
  await editOptions(app,two,undefined);assert.strictEqual(app.get("selection.id"),two.instanceId);assert.strictEqual(app.currentDeck().id,two.id);
  const again=await durableBoot({origin:app.fixtureOrigin});assert.deepStrictEqual(savedEnvelope(again).entries.map(e=>e.instanceId),keys);
  assert.strictEqual(chipRow(again)[at].label,two.name);assert.strictEqual(savedViews(again)[two.instanceId].options.palette,4);
});

/* ------------------- 27. a typed name is never a coincidence (row 133) */

test("a user-typed name equal to the auto label survives a later field edit", async () => {
  const app = await durableBoot();
  const a = await makeCustom(app);
  const auto = app.get(
    `HPE.select.deckName({ fields: savedEntries.get(${JSON.stringify(a.instanceId || a.id)}).deck.fields, ` +
    `options: { parent: savedEntries.get(${JSON.stringify(a.instanceId || a.id)}).deck.options.parent } })`);
  assert.strictEqual(a.name, auto, "the setup deck is not auto-named");

  // the user opens Edit and DELIBERATELY types the very string the box holds
  app.select(a.instanceId || a.id);
  app.clickChip(a.name);
  app.els["scale-name"].value = auto;
  app.els["scale-name"].dispatchEvent({ type: "input" });
  await generateClick(app);
  assert.strictEqual(savedViews(app)[a.instanceId || a.id].options.name, auto,
    "a deliberately typed name was discarded as a coincidence");

  // and it is a real name: a later FIELD edit keeps it instead of re-deriving
  const now = await editFields(app, savedViews(app)[a.instanceId || a.id], EDIT_MORE);
  assert.strictEqual(savedViews(app)[now].name, auto,
    "the field edit renamed the deck out from under the user");
  const list = savedEnvelope(app).entries.map(row=>row.record);
  assert.strictEqual(list[0].o.name, auto, "the typed name did not reach storage");
});

test("an untouched Edit box still leaves an auto-named deck free to re-derive its name", async () => {
  const app = boot();
  const a = await makeCustom(app);
  const now = await editFields(app, a, EDIT_MORE);
  assert.strictEqual(savedViews(app)[now].options.name, undefined,
    "an untouched auto name was pinned onto the new fields");
});

/* ---------------- 28. the deck strip, and the drawer without presets ----
 * The owner moved "+ ADD" inline as the strip's first chip and had the preset
 * row deleted outright (2026-09). The second is asserted here as a fact about
 * the shipped app, not a preference: "removed" has to mean the seeds are gone
 * from the file, not merely hidden. The first ("+ ADD leads the strip through
 * every rebuild, as the same node") is retired (M2, 2026-09-28): "+ Add a
 * scale" no longer lives in the strip at all, so there is no strip-position
 * or strip-rebuild invariant left to hold on it - see
 * tests/mutants/e_add_chip_appended_last.patch, retired alongside it. */

/** The app's own <style> block, with comments stripped. */
function appCss() {
  const src = require("node:fs").readFileSync(require("./helpers/sandbox.js").APP, "utf8");
  const m = /<style>([\s\S]*?)<\/style>/.exec(src);
  assert.ok(m, "index.html has no <style> block");
  return m[1].replace(/\/\*[\s\S]*?\*\//g, "");
}

test("every gap in the app comes from the spacing ramp, never a fresh literal", async () => {
  const css = appCss();
  // The ramp itself: four steps, defined on :root, strictly increasing.
  const steps = [1, 2, 3, 4].map((i) => {
    const m = new RegExp("--sp-" + i + ":(\\d+(?:\\.\\d+)?)px").exec(css);
    assert.ok(m, `--sp-${i} is not defined in :root`);
    return Number(m[1]);
  });
  for (let i = 1; i < steps.length; i++) {
    assert.ok(steps[i] > steps[i - 1],
      `the ramp is not strictly increasing: ${JSON.stringify(steps)}`);
  }
  // And nothing reintroduces the one-value rhythm the owner reported ("there is
  // not enough spacing between each ui component" - every gap in the chrome and
  // the whole sheet was the same 9px). gap:0 is allowed: #scale-swatches butts
  // its 44px targets together on purpose. .seq-rail's column-gap:.35em (D-12)
  // is a different measurement domain from the ramp entirely - it is
  // text-flow spacing between chord units, proportional to the rail's own
  // font size, the same role letter-spacing already plays elsewhere in the
  // app, not a px-fixed gap between UI chrome components - so it is exempt
  // the same way gap:0 is, not a literal the ramp forgot. The exemption is
  // tied to that one selector, not to em-valued gaps in general, so a new
  // selector reaching for an em gap still has to justify itself here.
  const bad = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .flatMap((m) => {
      const selector = m[1].trim();
      return [...m[2].matchAll(/gap:\s*([^;}]+)/g)].map((g) => ({ selector, value: g[1].trim() }));
    })
    .filter(({ selector, value }) =>
      value !== "0" && !value.startsWith("var(--sp-") &&
      !(selector.endsWith(".seq-rail") && value === ".35em"))
    .map(({ value }) => value);
  assert.deepStrictEqual(bad, [],
    `these gaps bypass the ramp: ${JSON.stringify(bad)}`);
});

test("the presets are gone from the app, not merely hidden", async () => {
  const app = boot();
  assert.strictEqual(app.get("typeof SCALE_PRESETS"), "undefined",
    "the inlined preset seed list is still in index.html");
  assert.strictEqual(app.get("typeof applyPreset"), "undefined",
    "the preset handler is still in index.html");
  const html = require("node:fs").readFileSync(require("./helpers/sandbox.js").APP, "utf8");
  assert.doesNotMatch(html, /scale-presets/,
    "index.html still carries preset markup, CSS or ids");
});


/* ------------------ 29. replaceRegistered defends its own invariant (row 144) */

test("instance Edit rejects a stale target without changing either instance", async () => {
  const app=boot(),a=await makeCustom(app),b=await makeCustom(app,OTHER_STRING);const before=plain(app.get("savedState"));
  const result=plain(app.get(`commitSavedSession({type:"edit",collectionId:savedState.collectionId,instanceId:${JSON.stringify(a.instanceId)},expectedRevision:0,
    candidate:{deck:savedEntries.get(${JSON.stringify(b.instanceId)}).deck,record:scaleRecord(seedOf(savedEntries.get(${JSON.stringify(b.instanceId)}).deck))}})`));
  assert.strictEqual(result.ok,false);assert.strictEqual(result.kind,"conflict");assert.deepStrictEqual(plain(app.get("savedState")),before);
  assert.deepStrictEqual(Object.keys(savedViews(app)),[a.instanceId,b.instanceId]);
});

test("instance Edit replaces only its target in place while preserving a bystander", async () => {
  const app=boot(),a=await makeCustom(app),b=await makeCustom(app,OTHER_STRING),before=plain(app.get("savedState"));
  const result=plain(app.get(`commitSavedSession({type:"edit",collectionId:savedState.collectionId,instanceId:${JSON.stringify(a.instanceId)},expectedRevision:1,
    candidate:{deck:savedEntries.get(${JSON.stringify(b.instanceId)}).deck,record:scaleRecord(seedOf(savedEntries.get(${JSON.stringify(b.instanceId)}).deck))}})`));
  assert.strictEqual(result.ok,true);const after=plain(app.get("savedState"));assert.deepStrictEqual(after.entries.map(e=>e.instanceId),before.entries.map(e=>e.instanceId));
  assert.strictEqual(after.entries[0].displayOrdinal,before.entries[0].displayOrdinal);assert.strictEqual(after.entries[0].revision,2);
  assert.deepStrictEqual(after.entries[1],before.entries[1]);assert.strictEqual(savedViews(app)[a.instanceId].id,b.id);
});

// Queue row 150. The refusal above is real but nothing at the single call site
// inspects the boolean, so the branch is unreachable from the app today: the
// test above is the only thing that ever executes it. That is deliberate -
// making the call site check would add a branch that provably cannot fire, and
// a mutant for it could never redden. What has to be pinned instead is the
// CALLER COUNT: the guard's stated purpose is that a future caller cannot
// reintroduce row 131 silently, and that only holds if a future caller is
// noticed at all. This is a source scan, so it is coarse by construction - it
// counts names, not call graphs, and a rename of the function moves the count
// to zero rather than reporting a subtler truth. Both failures are loud.
//
// NOTHING IS STRIPPED (queue rows 159, 160, 184). An earlier revision of this
// scan blanked comment spans first, so that documenting the primitive in prose
// stayed free. Two independent reviews broke it in a row, and the second one
// showed why the shape cannot be repaired: a `/*` opens a comment only when it
// is CODE, so deciding which `/*` is real means tokenizing a whole HTML file as
// JS, and EVERY mis-classification converts into a blanked span - a live call
// silently swallowed while this suite stays green. That is a false NEGATIVE,
// the one direction a tripwire must never fail in.
//
// So the scan strips nothing. It counts every word-boundary OCCURRENCE of the
// name - occurrences, not lines (row 159), so a second call appended to the
// line that already names the function cannot hide behind the first - and it
// counts them in comments too. A prose mention therefore reddens this test.
// That is accepted deliberately (row 160, WONTFIX per row 184): the failure is
// loud, the message lists every occurrence with its line number, and re-pinning
// the count is a one-line reviewed act. Nothing is hidden from the SCAN: no
// span is blanked, so no live call can be swallowed by a mis-parse.
//
// The residual limit is narrower and is not closable here. A name written as
// anything other than the name is out of a name scan's reach BY CONSTRUCTION:
// a unicode-escaped identifier - spell the leading r as the six characters
// backslash-u-0-0-7-2 and it is a UnicodeEscapeSequence inside an
// IdentifierName, binding to the same function while the literal name is
// nowhere in the file - a computed property access (globalThis["replace" +
// "Registered"]),
// or any alias assembled at runtime. Each of those calls executes while the
// literal text never appears, so the count stays at 2 and this suite stays
// green. That is the same blind spot as a rename, in the other direction - and
// unlike a mis-parse it is a false negative that no amount of stripping or
// tokenizing would fix, because there is nothing in the text to find. It is
// pinned below as a known, reviewed hole rather than an accidental one.
function scanNames(source, name) {
  const re = new RegExp("\\b" + name + "\\b", "g");
  const hits = [];
  let total = 0;
  source.split("\n").forEach((line, i) => {
    const named = line.match(re);
    if (!named) return;
    total += named.length;
    hits.push([i + 1, line.trim(), named.length]);
  });
  return { total, hits };
}

// Retired primitive/caller-count policy -> one locked migration writer plus
// one locked command writer; this remains a loud coarse source tripwire.
test("the retired inventory writer is absent and durable writes stay behind the locked boundaries", async () => {
  const html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
  assert.strictEqual(scanNames(html,"replaceRegistered").total,0,"retired inventory-based mutation cannot reappear");
  assert.strictEqual((html.match(/localStorage\.setItem\(SAVED_KEY,/g)||[]).length,0,"the live collection has no localStorage mirror writer");
  const writes=[...html.matchAll(/\bstore\.put\([^;\n]*,\s*SAVED_RECORD\)/g)];
  assert.strictEqual(writes.length,2,"migration and changed-command acknowledgment are the only durable envelope writers");
  assert.strictEqual((html.match(/await locks\.request\(SAVED_LOCK,/g)||[]).length,2,"both durable writers require exclusive origin coordination");
});

// Queue rows 159, 160 and 184. The scan above runs against the real index.html,
// which can hold exactly one shape at a time, so it can never prove more than a
// single evasion is caught. This pins the ruling on synthetic source instead.
// The ruling is short: EVERY word-boundary occurrence counts, wherever it sits.
// Half of these shapes were demonstrated by reviewers hiding a live second call
// site behind a fake comment opener while the suite stayed green; under a scan
// that blanks nothing they are not special cases, they simply count.
test("the caller scan counts every occurrence, in code and in prose alike", async () => {
  const DEF = "function replaceRegistered(oldId, next) {\n}\n" +
    "if (replaced) replaceRegistered(wasId, d);\n";
  const scan = (extra) => scanNames(DEF + extra, "replaceRegistered").total;

  assert.strictEqual(scan(""), 2, "the unmodified shape is not the 2 the scan expects");

  // CODE - each of these must move the count off 2.
  assert.strictEqual(scan("replaceRegistered(d.id, d); // belt and braces\n"), 3,
    "(a) a call with a trailing // comment slipped past the scan");
  assert.strictEqual(scan('const _note = "replaceRegistered";\n'), 3,
    "(c) the name in a string literal slipped past the scan");
  assert.strictEqual(scan("const f = replaceRegistered; f(d.id, d);\n"), 3,
    "(d) an aliased indirect call slipped past the scan");
  assert.strictEqual(scan("replaceRegistered(d.id, d);\n"), 3,
    "(e) a plain third call site slipped past the scan");
  assert.strictEqual(
    scanNames(DEF.replace(/replaceRegistered\(wasId/,
      "replaceRegistered(wasId, d); else replaceRegistered(wasId"), "replaceRegistered").total, 3,
    "(h) a second call appended to a line that already names the function " +
    "slipped past the scan - it is counting lines again, not occurrences");
  // (f) a rename moves the count to zero rather than to three: also loud.
  assert.strictEqual(scanNames(DEF.replace(/replaceRegistered/g, "swapRegistered"),
    "replaceRegistered").total, 0, "(f) a rename of the primitive went unnoticed");

  // EVASION SHAPES. Each parks a live call after something that a text-level
  // comment stripper would read as `/*` but that opens no comment at all: a
  // delimiter inside a string, template or regex literal, or inside a // comment
  // already running. Every one of them hid a real call from an earlier revision
  // of this scan. Nothing is blanked now, so every one of them counts.
  assert.strictEqual(
    scan('const OPEN = "/*";\nreplaceRegistered(d.id, d);\nconst CLOSE = "*/";\n'), 3,
    "(i) a call fenced by /* and */ inside STRING literals slipped past the scan");
  assert.strictEqual(
    scan("const RE = /[/*]/;\nreplaceRegistered(d.id, d);\nconst R2 = /x*/;\n"), 3,
    "(j) a call fenced by /* and */ inside REGEX literals slipped past the scan");
  assert.strictEqual(
    scan("const T = `/*`;\nreplaceRegistered(d.id, d);\nconst U = `*/`;\n"), 3,
    "(k) a call fenced by /* and */ inside TEMPLATE literals slipped past the scan");
  assert.strictEqual(
    scan("// a stray /* carried inside a line comment\nreplaceRegistered(d.id, d);\n"), 3,
    "(l) a /* carried inside a // comment opened a block comment and swallowed a call");
  assert.strictEqual(scan("const T = `${replaceRegistered(d.id, d)}`;\n"), 3,
    "(m) a call inside a template interpolation slipped past the scan");
  // The shape that finished the previous revision off: a regex literal opening
  // in a position the tokenizer read as division, so `/[/*]/` became a comment.
  assert.strictEqual(
    scan("if (replaced) /[/*]/.test(d.name);\nreplaceRegistered(d.id, d);\n"), 3,
    "(F1) a regex literal after `)` swallowed the call that followed it");

  // PROSE COUNTS TOO. Not an oversight - the accepted cost of a scan that can
  // never swallow a call (row 160, WONTFIX per row 184). Pinned so that anyone
  // reintroducing stripping has to delete these assertions on purpose.
  assert.strictEqual(scan("// replaceRegistered(d.id, d);\n"), 3,
    "(g) a whole-line // comment was stripped - stripping is what row 184 removed");
  assert.strictEqual(scan("/* replaceRegistered returns false on a\n" +
    "   same-id collision; see queue row 144. */\n"), 3,
    "(row 160) a /* */ prose mention was stripped - stripping is what row 184 removed");
  assert.strictEqual(scan("/*\nreplaceRegistered(d.id, d);\n*/\n"), 3,
    "(b) a call commented OUT in a /* */ block was stripped");
  assert.strictEqual(scan("/* note */ replaceRegistered(d.id, d);\n"), 3,
    "an inline /* */ comment sharing a line with a real call disturbed the count");
  assert.strictEqual(scan("const x = 1; // replaceRegistered(d.id, d) once did this\n"), 3,
    "(r) a trailing // comment was stripped");

  // THE RESIDUAL HOLE, PINNED ON PURPOSE (queue row 186). A name written as
  // anything but the name is beyond a name scan by construction. These two
  // shapes each call the real function - a reduced harness with a counting
  // replaceRegistered printed "calls actually executed: 1" for the first - yet
  // the literal text never occurs, so the count stays at 2. This is NOT a
  // regression to close by reintroducing stripping (row 184 deleted that
  // machinery because stripping is itself false-negative machinery); it is the
  // documented coarseness above - the scan counts names, not call graphs.
  // Asserted so the hole is reviewed rather than accidental: anyone who ever
  // makes the scan name-aware enough to catch these will see these two
  // assertions go red and must delete them deliberately.
  //
  // Sanity first, on the fixture's own characters: if the escape were resolved
  // when this file was parsed, the fixture would contain the real identifier
  // and the assertion below would pass for entirely the wrong reason.
  const ESCAPED = "if (!replaced) \\u0072eplaceRegistered(d.id, d);\n";
  assert.ok(ESCAPED.includes("\\u0072eplaceRegistered"),
    "the fixture lost its backslash: it must carry the six-character escape, " +
    "not the resolved identifier: " + JSON.stringify(ESCAPED));
  assert.strictEqual(ESCAPED.includes("replaceRegistered"), false,
    "the fixture already spells the name literally, so the scan below would " +
    "count it and pin nothing: " + JSON.stringify(ESCAPED));
  assert.strictEqual(scan(ESCAPED), 2,
    "a unicode-escaped call site is now COUNTED. That is a real improvement, " +
    "not a failure - but it means this known hole is closed, so delete this " +
    "assertion and say so. Until then the scan is documented as blind to it.");

  const COMPUTED = 'globalThis["replace" + "Registered"](d.id, d);\n';
  assert.strictEqual(COMPUTED.includes("replaceRegistered"), false,
    "the computed-access fixture spells the name literally: " + JSON.stringify(COMPUTED));
  assert.strictEqual(scan(COMPUTED), 2,
    "a runtime-assembled call site is now COUNTED. Same as above: an " +
    "improvement, but delete this assertion deliberately rather than " +
    "leaving a stale claim about what the scan cannot see.");
});

/* ------------------------------------------------------------------ *
 * iOS keyboard fix - the visualViewport offset math (TODOS.md
 * "The iOS keyboard covers GENERATE CARDS while typing a seed")
 *
 * iOS Safari resizes the VISUAL viewport when the soft keyboard opens, not
 * the layout viewport the sheet's position:fixed is anchored to:
 * window.innerHeight stays put while window.visualViewport.height shrinks
 * and its offsetTop can move. kbOffset(innerHeight, vvHeight, vvOffsetTop)
 * is the pure translate distance the sheet has to move up by to stay above
 * the keyboard - the ONLY part of this fix a unit test (or headless
 * Chromium) can verify. The device behaviour itself - that the button is
 * actually reachable with a real keyboard up on an iPhone 14 / iOS 26.6 -
 * is NOT covered here or anywhere in CI; see the PR body.
 * ------------------------------------------------------------------ */




/* The translate alone is only half the fix, and on an iPhone 14 (844pt tall,
 * ~300pt keyboard) the missing half is what the owner actually hit: the
 * surface is sized in dvh (85dvh as a drawer, 100dvh as a page), dvh is a
 * LAYOUT-viewport unit and does not react to the keyboard, so the surface
 * stays full height. Translating it up 300px puts its TOP off-screen -
 * GENERATE CARDS comes into view (it rides the
 * translate, being in the reserved footer) while #scale-box, at the top of
 * the .sheetbody scrollport, leaves the screen entirely. The seed field
 * becomes unreachable exactly while you are typing into it.
 * kbCap() is the pure half of the cap: given the two viewport heights, the
 * max-height the surface must take so that it fits ENTIRELY inside the
 * shrunken visual viewport once translated. 0 means "no override" - leave
 * the stylesheet's dvh height alone. */





/* ------------------------------ 20. pan()'s optional interactive hit layer */

/**
 * Stage 1 of the scale-page plan. pan() gains a third argument so the scale
 * page can put selection ON the pan; the CARD path must not notice. The
 * byte-identity criterion is not an aspiration -
 * tests/test_render_agreement.py::test_band_and_hairline_agree (Q24) pins
 * this renderer's own ring geometry - the coloured band's width and radius,
 * and the inner hairline's radius - against tools/hifi.py per lit field, so
 * any drift in the two-argument form breaks print parity too.
 */
test("pan()'s two-argument output is unchanged by the interactive layer", async () => {
  const app = boot();
  const D = decks(app);
  for (let di = 0; di < D.length; di++) {
    for (let ci = 0; ci < D[di].chords.length; ci++) {
      const two = app.get(`pan(DECKS[${di}], DECKS[${di}].chords[${ci}])`);
      const empty = app.get(`pan(DECKS[${di}], DECKS[${di}].chords[${ci}], {})`);
      const where = `${D[di].id} #${ci + 1}`;
      assert.strictEqual(empty, two, `${where}: an empty opts must change nothing`);
      assert.ok(!two.includes("panhit"), `${where}: the card path draws no hit layer`);
    }
  }
});

/**
 * The test above compares two renders from the SAME tree, so a change that
 * moves both is invisible to it. This one holds the card render against a
 * committed digest, which is the only form of the criterion that survives the
 * next lane: "the printed cards did not change" is a claim about a previous
 * tree, and nothing in a single tree can make it.
 *
 * A failure here is not automatically a bug - a deliberate render change
 * regenerates the fixture (node tools/regen_pan_fixture.js) IN THE SAME COMMIT
 * and says why. It fails so that nobody does it by accident.
 */
test("the card render still matches the committed digest of every built-in card", async () => {
  const crypto = require("node:crypto");
  const fixture = require("./fixtures/pan_render_v1.json");
  const digest = (x) => crypto.createHash("sha256").update(x).digest("hex").slice(0, 16);
  const app = boot();
  const D = decks(app);
  assert.deepStrictEqual(plain(D.map((d) => d.id)).sort(), Object.keys(fixture.decks).sort(),
    "the fixture covers exactly the built-in decks");
  for (let di = 0; di < D.length; di++) {
    const rows = fixture.decks[D[di].id];
    assert.strictEqual(digest(app.get(`pan(DECKS[${di}], null)`)), rows.null,
      `${D[di].id}: the unhighlighted render drifted`);
    assert.strictEqual(Object.keys(rows).length - 1, D[di].chords.length,
      `${D[di].id}: the fixture has a row per chord`);
    for (let ci = 0; ci < D[di].chords.length; ci++)
      assert.strictEqual(digest(app.get(`pan(DECKS[${di}], DECKS[${di}].chords[${ci}])`)), rows[ci],
        `${D[di].id} #${ci + 1}: the card render drifted - regenerate the fixture only on purpose`);
  }
});

/** The seat editor's hit-layer option for a deck expression, built the way the
 *  app builds it: one entry per non-ding field with its ring, order and label. */
const hitOpts = (deckExpr) => `(() => { const hd = ${deckExpr}; const meta = {}; let o = 0;
  const ids = Object.keys(hd.fields).filter((k) => hd.fields[k][3] !== "ding");
  for (const id of ids) { const f = hd.fields[id];
    meta[id] = { ring: f[3], order: o++, label: f[0] + f[1] + ", " + f[3] + " seat " + f[5] + " of " + ids.length + ", top" }; }
  return { hit: { meta, picked: null, rover: null, flash: null } }; })()`;

test("pan() with a hit layer adds one hit target per non-ding field, and none for the ding", async () => {
  const app = boot();
  const D = decks(app);
  for (let di = 0; di < D.length; di++) {
    const d = D[di];
    const svg = app.get(`pan(DECKS[${di}], null, ${hitOpts(`DECKS[${di}]`)})`);
    const ids = Object.keys(d.fields).map(Number);
    const selectable = ids.filter((f) => d.fields[f][F_ZONE] !== "ding");
    const ding = ids.filter((f) => d.fields[f][F_ZONE] === "ding");

    const got = [...svg.matchAll(/class="panhit"[^>]*data-field="(\d+)"/g)].map((m) => Number(m[1]));
    assert.deepStrictEqual(got.slice().sort((a, b) => a - b),
      selectable.slice().sort((a, b) => a - b),
      `${d.id}: one hit target per selectable field`);
    for (const f of ding)
      assert.ok(!got.includes(f), `${d.id}: the ding carries no correction slot, so no hit target`);

    // Every target is programmatically focusable but none is in the tab order:
    // the page reaches the pan through one container stop, which Stage 2 adds.
    // Until then the layer is deliberately unreachable by Tab.
    const stops = (svg.match(/class="panhit"[^>]*tabindex="-1"/g) || []).length;
    assert.strictEqual(stops, selectable.length, `${d.id}: every hit target is tabindex=-1`);

    // A target that paints is a target that hides the note under it: SVG's
    // default fill is BLACK, so the transparent fill is load-bearing, not
    // decoration. And a control with no role announces as nothing.
    assert.strictEqual((svg.match(/class="panhit"[^>]*fill="transparent"/g) || []).length,
      selectable.length, `${d.id}: every hit target is transparent, not painted`);
    assert.strictEqual((svg.match(/class="panhit"[^>]*role="button"/g) || []).length,
      selectable.length, `${d.id}: every hit target announces as a button`);

    // Each one names the note a screen reader would be selecting, and says how
    // many there are to move through (the plan's "position N of M").
    for (const f of selectable) {
      const [name, oct, , , , lab] = d.fields[f];
      assert.ok(svg.includes(`aria-label="${name}${oct}, ${d.fields[f][3]} seat ${lab} of ${selectable.length}, top"`),
        `${d.id}: field ${f} names itself and the size of the set`);
    }
  }
});

/**
 * A hit target that is not centred on the note it SELECTS is the defect the
 * count above cannot see - and "sits on some drawn field" is not enough to
 * catch it, because rotating the centres among the targets leaves every one of
 * them on a real field while every tap picks up the neighbouring note. So the
 * centre is re-derived here from the field the target names, out of the deck
 * DATA and the layout convention in docs/CARD-SPEC.md (math-convention degrees, 0 =
 * right, 90 = up, y-up), never from the renderer.
 *
 * data-r is checked in the same place because it is the drawn radius the sizer
 * floors each target at, and the sizer's own test builds its nodes by hand: if
 * the attribute vanished from the markup, nothing else in the suite would
 * notice and every sparse-pan target would silently shrink to 44px in a real
 * browser.
 */
test("every hit target is centred on the field circle it selects", async () => {
  const app = boot();
  const D = decks(app);
  const N = "([-+\\d.eE]+)";   // a field on the vertical axis renders in exponent form
  for (let di = 0; di < D.length; di++) {
    const d = D[di], g = d.geom, R = 100;
    const svg = app.get(`pan(DECKS[${di}], null, ${hitOpts(`DECKS[${di}]`)})`);
    const hits = [...svg.matchAll(new RegExp(
      `class="panhit" data-field="(\\d+)" data-ring="[a-z]+" cx="${N}" cy="${N}" r="${N}" data-r="${N}"`, "g"))];
    assert.ok(hits.length > 0, `${d.id}: the layer has targets to check`);
    for (const [, fid, cx, cy, r, dr] of hits) {
      const [, , , zone, ang] = d.fields[fid];
      const orb = R * (zone === "bottom" ? g.bottom : zone === "inner" ? g.inner : g.rim);
      const want = [orb * Math.cos(ang * Math.PI / 180), -orb * Math.sin(ang * Math.PI / 180)];
      assert.ok(Math.hypot(Number(cx) - want[0], Number(cy) - want[1]) < 1e-9,
        `${d.id}: field ${fid} (${zone} @${ang}) should be selected at `
        + `${want.map((v) => v.toFixed(3))}, target sits at ${[cx, cy]}`);
      const rWant = R * (zone === "bottom" ? g.r_bnote : g.r_note);
      assert.ok(Math.abs(Number(dr) - rWant) < 1e-9,
        `${d.id}: field ${fid} carries its drawn radius (${dr} vs ${rWant})`);
      assert.strictEqual(r, dr, `${d.id}: field ${fid} renders at its drawn radius until sized`);
    }
  }
});

/**
 * SVG paints in document order with no z-index, so a hit layer emitted BEFORE
 * the fields is a hit layer the fields cover: every tap would land on the
 * opaque white field circle and the target would never fire.
 */
test("the hit layer is emitted after everything it sits over", async () => {
  const app = boot();
  const svg = app.get(`pan(DECKS.find(d => d.id === "hijaz"), null, ${hitOpts(`DECKS.find(d => d.id === "hijaz")`)})`);
  const group = svg.indexOf(`<g class="panhits">`);
  assert.ok(group > 0, "the layer is emitted as one group");
  assert.strictEqual(svg.slice(0, group).indexOf("panhit"), -1,
    "nothing of the layer is drawn before the group");
  assert.ok(svg.lastIndexOf("<text") < group,
    "every label is already drawn when the layer goes down");
});

/**
 * The hit radius cannot come from CSS: vector-effect holds STROKE width against
 * the viewBox scale and does nothing for a circle's hit area. It is computed
 * after insertion from the measured size, per target, under two rules:
 *
 *   - NON-OVERLAP WINS. A target that laps its neighbour selects the wrong note
 *     silently, which is worse than a target that is merely small. Where a
 *     dense pan cannot hold disjoint 44px targets, they stop at touching.
 *   - A target is never SMALLER than the note it selects. On a sparse pan the
 *     drawn note is bigger than 44px, and a user aiming at a ring they can
 *     plainly see must not miss it.
 */


/**
 * sizePanHits is the post-insert pass: it is the only place the rendered size
 * is known. Driven here through the same shape a browser hands it, because the
 * radius written into the document is what the user actually taps.
 */

/**
 * A double quote ends an attribute, and everything after it is markup. Built-in
 * note names have none, so this drives the renderer with a deck that does - the
 * case a generated deck reaches first. Asserted at the EMISSION SITE and not
 * only on the escaper, because an escaper nobody calls escapes nothing.
 */
test("a note name cannot break out of the hit target's attributes", async () => {
  const app = boot();
  const out = app.get(`escA('A" onclick="x')`);
  assert.ok(!out.includes(`"`), "no raw double quote survives into an attribute");
  assert.strictEqual(app.get(`escA('a<b&c')`), "a&lt;b&amp;c", "and the text escapes still apply");

  // A deck whose first non-ding field is named with a quote, and whose position
  // label carries one too - both interpolate into the same attribute.
  const svg = app.get(`(() => {
    const d = JSON.parse(JSON.stringify(DECKS.find(d => d.id === "hijaz")));
    const f = Object.keys(d.fields).find((k) => d.fields[k][3] !== "ding");
    d.fields[f][0] = 'A" onmouseover="steal()';
    d.fields[f][5] = '1"';
    return pan(d, null, ${hitOpts("d")});
  })()`);
  const targets = [...svg.matchAll(/<circle class="panhit"[^>]*\/>/g)].map((m) => m[0]);
  const labels = targets.map((t) => (t.match(/aria-label="([^"]*)"/) || [])[1]);
  assert.strictEqual(labels.filter((l) => l !== undefined).length, targets.length,
    "every target's aria-label still terminates where it should");
  // The injected text is harmless while it stays INSIDE a quoted value - what
  // the escape prevents is it becoming an attribute of its own, so the check is
  // on the tag's attribute NAMES, not on whether the string appears at all.
  // data-sel is absent on an unselected target, so it is not in this list: the
  // selected one is asserted separately, in the LAYOUT section.
  const WANT = ["class", "data-field", "data-ring", "cx", "cy", "r", "data-r",
                "fill", "tabindex", "role", "aria-pressed", "aria-label"];
  for (const t of targets)
    assert.deepStrictEqual([...t.matchAll(/([a-z-]+)="/g)].map((m) => m[1]), WANT,
      `a note name added an attribute to the target: ${t}`);
  assert.ok(labels.some((l) => l.includes("&quot;")),
    "the quote survives as an entity inside the label, not as a delimiter");
  // The attribute-name oracle above cannot see a label that truncates and
  // leaves a fragment carrying no `name="` behind it - ` of 8"` is stray in-tag
  // markup with no attribute in it. Every label ending where it should is what
  // catches that, and it holds for the position slot as well as the note name.
  const M = (svg.match(/class="panhit"/g) || []).length;
  for (const l of labels)
    assert.ok(l.endsWith(` of ${M}, top`), `a label stops short of its count: ${l}`);
});

/* ---------------- 30. the scale PAGE: its route, and what boot does with it
 * D3: Add and Edit are real destinations, so each pushes a history entry and
 * the phone's Back gesture closes the page instead of leaving the app. Two
 * halves that have to stay apart: closing the page POPS the entry it pushed,
 * and a pop CLOSES the page - wire either one to the other's job and Back
 * either leaves the app or strands a dead entry on the stack.
 * The hash is shared with SHARE_PREFIX ("#s="), which is read once at boot.
 * "#add" and "#edit-" are disjoint from it by construction, but "by
 * construction" is what silently stops being true, so the share URL is
 * asserted here and not assumed. */

const ROUTE = (app) => app.location.hash;
const pushes = (app) => app.history.calls.filter((c) => c.type === "push");

test("opening ADD pushes its own route and closing pops it", async () => {
  const app = boot();
  assert.strictEqual(ROUTE(app), "#deck=d-kurd-10", "the app boots with the route of the deck it shows");
  openSheet(app);
  assert.deepStrictEqual(pushes(app).map((c) => c.url), ["#add"],
    "opening the Add page did not push exactly one route");
  assert.strictEqual(ROUTE(app), "#add");

  app.els["scale-back"].click();
  assert.strictEqual(app.sheetOpen(), false);
  assert.strictEqual(app.history.calls.filter((c) => c.type === "back").length, 1,
    "closing the page left its own history entry on the stack");
});

test("EDIT routes to the deck it is editing, not to a generic page", async () => {
  const app = boot();
  const d = await makeCustom(app);
  openEdit(app, d);
  assert.strictEqual(ROUTE(app), "#edit-" + d.id,
    "the Edit page's route does not name the deck it edits");
  assert.strictEqual(app.location.href.includes(d.instanceId),false,"local saved handles never enter the address bar");
  app.keydown("Escape");
  assert.strictEqual(app.sheetOpen(), false);
});

test("the browser's Back button closes the page and pops nothing further", async () => {
  const app = boot();
  openSheet(app);
  const backs = () => app.history.calls.filter((c) => c.type === "back").length;
  const before = backs();
  app.popstate();
  assert.strictEqual(app.sheetOpen(), false, "Back did not close the page");
  assert.strictEqual(app.activeId(), "settings-trigger", "Back did not return focus to the settings trigger");
  // The entry is already gone - the browser popped it. Calling back() again
  // here would walk PAST the app's own entry and leave the site.
  assert.strictEqual(backs(), before,
    "closing from a pop popped a second entry and would leave the app");
});

test("a pop with no page open is not an invitation to close something", async () => {
  const app = boot();
  const deckBefore = app.get("selection.id");
  // Where focus is BEFORE the stray pop, so the assertion below is about what
  // the pop did rather than about where boot happens to leave focus.
  const focusBefore = app.activeId();
  const callsBefore = app.history.calls.length;
  app.popstate();
  assert.strictEqual(app.sheetOpen(), false);
  assert.strictEqual(app.get("selection.id"), deckBefore, "a stray pop moved the practice screen");
  // The guard's real job. hideSheet() ends in (sheetOpener || addChip).focus(),
  // so a popstate listener that ran its body with no page open would yank focus
  // to + ADD on every back press anywhere in the app - out of whatever the user
  // was actually on. Asserting only sheetOpen() leaves that invisible.
  assert.strictEqual(app.activeId(), focusBefore,
    "a stray pop stole focus - the popstate listener ran with no page open");
  assert.strictEqual(app.history.calls.length, callsBefore, "a stray pop wrote to history");
});

test("a pop that follows a fragment navigation leaves the destination hash alone", async () => {
  // Back/Forward between two routes (or an about link) fires popstate BEFORE
  // hashchange, with the destination already in the bar and a different deck on
  // screen. Only a sheet-close pop (pendingPop) may sync; any other pop that did
  // would overwrite the destination with the deck still shown.
  const app = boot();
  const callsBefore = app.history.calls.length;
  app.location.href = app.location.href.replace(/#.*$/, "") + "#deck=c-sharp-hijaz-9";
  app.popstate();
  assert.strictEqual(app.location.hash, "#deck=c-sharp-hijaz-9", "a stray pop rewrote the destination hash");
  assert.strictEqual(app.history.calls.length, callsBefore, "a stray pop wrote to history");
});

test("closing a page that is already closed changes nothing", async () => {
  // closeScaleSheet() is reachable from BACK, from Escape and from a save that
  // finishes, so a double call is a live possibility rather than a contrived
  // one. TWO things stop it doing damage and they stop different halves:
  // sheetRouted (already false) is what keeps the second call from popping an
  // entry this page never pushed, and the !sheetOpen guard is what keeps
  // hideSheet() from running again. The second half is the one with a visible
  // symptom - hideSheet ends in (sheetOpener || addChip).focus() - so it is the
  // one worth asserting on, and the pop count is asserted beside it because the
  // two guards are easy to mistake for one.
  const app = boot();
  app.run("openScaleSheet(document.getElementById('deck-add'))");
  assert.strictEqual(app.sheetOpen(), true);
  app.run("closeScaleSheet()");
  assert.strictEqual(app.history.calls.filter((c) => c.type === "back").length, 1,
    "closing the page did not pop its own route");

  // Move focus somewhere the close path would not have put it, so a second
  // hideSheet() has something to visibly steal.
  app.run("document.getElementById('settings-trigger').focus()");
  const parked = app.activeId();
  assert.strictEqual(parked, "settings-trigger", "the parking element did not take focus");
  app.run("closeScaleSheet()");
  app.run("closeScaleSheet()");

  assert.strictEqual(app.activeId(), parked,
    "closing an already-closed page re-ran the close path and stole focus");
  assert.strictEqual(app.history.calls.filter((c) => c.type === "back").length, 1,
    "closing an already-closed page popped again - more back presses than the " +
    "user made, and the last one leaves the app");
});

test("booting on a page route opens nothing and leaves a clean hash", async () => {
  for (const hash of ["#edit-custom:abc"]) {
    const app = boot({ href: "https://example.test/index.html" + hash });
    assert.strictEqual(app.sheetOpen(), false,
      `booting on ${hash} opened a page for a deck this session never had`);
    assert.strictEqual(ROUTE(app), "#deck=d-kurd-10",
      `booting on ${hash} left the route in the address bar: reloading is now ` +
      "a page that cannot be backed out of");
    assert.deepStrictEqual(app.history.calls.map((c) => c.type), ["replace"],
      `booting on ${hash} pushed an entry instead of replacing the one it found`);
  }
});


test("AA: a protected-mode boot on #add opens no sheet", async () => {
  const app = await durableBoot({ storage: { hpfc: JSON.stringify({ deck: 5, mode: "A" }) }, href: "https://example.test/index.html#add" });
  assert.strictEqual(app.get("savedMode"), "protected");
  assert.strictEqual(app.sheetOpen(), false);
});

test("the page routes do not shadow a share URL", async () => {
  const app = boot();
  const d = await makeCustom(app);
  const url = link(app, d.instanceId || d.id);
  assert.strictEqual(url.ok, true, url.reason);

  const shared = boot({ href: "https://example.test/index.html#s=" + payload(url.value) });
  assert.strictEqual(shared.currentDeck().id,d.id,"a share link opens the same musical inventory");
  assert.notStrictEqual(shared.get("selection.id"),d.instanceId,"fresh receiver has its own local identity");
  assert.strictEqual(shared.sheetOpen(), false, "a share link opened the scale page");
});

/* iOS Safari auto-zooms any form control whose font-size is under 16px, and
 * zooming IS what queue row 87 is about: the visual viewport shrinks, and
 * applyKbOffset() cannot tell that shrink from a keyboard. The page's answer
 * is to make NO claim while the scale is up - which is only safe if the page
 * never raises the scale itself. That is this test: both of the sheet's
 * text inputs are pinned at 16px, so every scale > 1 is two deliberate
 * fingers. Dropping any of them to 15px hands the fix off at exactly the
 * moment the keyboard opens, and no headless test would otherwise see it.
 * The `font` shorthand is read as well as `font-size` - hence the two patterns.
 * Asserted against the CSS text because the sandbox stubs the DOM and has no
 * layout engine.
 *
 * Q16: this used to take only the FIRST rule with a font size and only a
 * STANDALONE `#sel{...}` rule at that, so an override buried in a
 * comma-separated selector list inside a @media block (e.g. the short-viewport
 * block at :581, which already lists all three selectors together for their
 * min-height) was invisible to it twice over. Every rule whose selector LIST
 * includes the target, everywhere in the file, is checked here instead, and
 * every font size any of them sets must clear 16px.
 *
 * Comments are stripped before parsing (fix, second pass): a CSS comment
 * immediately above a rule glues onto that rule's FIRST selector after the
 * comma split (e.g. "/* ... *\/\n  #scale-box" is not the string "#scale-box"),
 * so #scale-box - whose every real rule in this file happens to sit right
 * after a comment - was silently falling out of `hits` for those rules and
 * only ever being checked against its one comment-free declaration. Without
 * stripping, a 14px override on #scale-box inside the @media block at :581
 * passes this test while iOS still auto-zooms it. */

/* Q26: docs/CARD-SPEC.md "Design system" names the three fonts of the visual system -
 * Marcellus for the chord name, Bitter for the note/number lines, Nunito Sans
 * everywhere else (labels/UI, and the page's own body font). Parsed straight
 * out of the CSS text rather than restated as a DOM check, since the sandbox
 * has no layout engine to read computed styles from. */
test("the visual system's three fonts land on the elements docs/CARD-SPEC.md names them for", async () => {
  const css = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "index.html"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({ selectors: m[1].split(",").map((s) => s.trim()), body: m[2] }));
  const familyOf = (body) => {
    const m = /font-family:\s*([^;]+);/.exec(body + ";");
    return m ? m[1].trim() : null;
  };
  const rulesFor = (sel) => rules.filter((r) => r.selectors.includes(sel));

  for (const sel of [".bigname", "body"]) {
    assert.ok(rulesFor(sel).length, `no CSS rule for ${sel}`);
  }
  const bignameFamilies = rulesFor(".bigname").map((r) => familyOf(r.body)).filter(Boolean);
  assert.ok(bignameFamilies.length, ".bigname has no font-family");
  for (const f of bignameFamilies) {
    assert.match(f, /^Marcellus\b/, ".bigname (the chord name) must lead with Marcellus");
  }

  for (const sel of [".notesline", ".numline"]) {
    const families = rulesFor(sel).map((r) => familyOf(r.body)).filter(Boolean);
    assert.ok(families.length, `${sel} has no font-family`);
    for (const f of families) {
      assert.match(f, /^Bitter\b/, `${sel} (note/number line) must lead with Bitter`);
    }
  }

  const bodyFamilies = rulesFor("body").map((r) => familyOf(r.body)).filter(Boolean);
  assert.ok(bodyFamilies.length, "body has no font-family");
  for (const f of bodyFamilies) {
    assert.match(f, /^"Nunito Sans"/, "body must lead with Nunito Sans");
  }
});

/** The generated Amara deck, selected, so deck() returns it. */
function customDeck(app) {
  const res = app.generate(AMARA_STRING);
  assert.strictEqual(res.ok, true, res.reason);
  app.select(res.instanceId);
  return res.instanceId;
}

/* Reviewer R2: iPadOS defaults to "Request Desktop Website", so a real iPad
   sends a Macintosh UA and is caught only by the maxTouchPoints clause.
   isIOS() is a shared symbol (R1, 2026-09-29): it still gates the PDF
   download path's navigation-vs-download branch on iOS, so its UA/touch
   detection stays covered here even with the legacy print-sheet layout
   selection (printLayoutName) retired. */
test("iPadOS in desktop mode is still treated as iOS", async () => {
  const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
  const ipad = boot({ userAgent: MAC, maxTouchPoints: 5 });
  assert.strictEqual(Boolean(ipad.get(`isIOS(${JSON.stringify(MAC)})`)), true,
    "a Macintosh UA with a touchscreen is an iPad, not a Mac");
  // A real Mac sends the same UA with no touchscreen and must not be an iPad.
  const mac = boot({ userAgent: MAC, maxTouchPoints: 0 });
  assert.strictEqual(Boolean(mac.get(`isIOS(${JSON.stringify(MAC)})`)), false,
    "a trackpad Mac is not an iPad");
});

/* The regression a fresh reviewer caught at 43b2851: min-height alone
   collapses .printpage to its own content, so `align-items:center` has no
   free space to distribute and the sheet TOP-ALIGNS - a defect that mattered
   while the legacy print sheet lived at #printroot. That container is gone
   (R1, 2026-09-29), but html/body still have to resolve their height as a
   PERCENTAGE rather than a page-box literal: iOS Safari ignores `@page`
   outright, so a literal here is a number we can never assume and (even
   post-cutover) breaks a plain browser Cmd+P print of the app itself. */
test("the print stylesheet gives the page box something to fill", async () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const css = html.slice(html.indexOf("@media print"));
  assert.match(css, /html,\s*body\{[^}]*height:100%/,
    "html/body must fill the page box or a percentage height cannot resolve");
  /* Strip CSS comments BEFORE anything reads the stylesheet. The scan can go
     VACUOUS and stay green: `indexOf` takes the FIRST textual "@media
     print", so a comment merely mentioning the phrase - in a file this
     comment-dense, an ordinary thing to write - aims the brace matcher at an
     unrelated block and every assertion below silently checks nothing. An
     anchor assertion alone did not close it, because the slice then STARTS
     inside the decoy comment and the comment's own text satisfies the
     anchor. Comments are not CSS; remove them and the case disappears. */
  const block = printBlock(html.replace(/\/\*[\s\S]*?\*\//g, " "));
  assert.ok(block.includes("html,body") || block.includes("html, body"),
    "printBlock did not find the real print stylesheet - the scan below would assert nothing");
  for (const [, sel, body] of block.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    /* html and body carry the top of the same percentage chain, so a literal
       lands there just as well (reviewer N3: `html,body{height:760pt}` inside
       the block passed 167/167 - later rule, same specificity, it wins). */
    if (!/(^|[,\s])(html|body)([,\s{]|$)/i.test(sel)) continue;
    /* matchAll, not match: CSS gives the LAST declaration the win, so reading
       only the first height let `{height:100%; min-height:0; height:760pt}`
       through (reviewer N2), and the shipped html,body rule shows
       multi-declaration blocks are house style here. `i` because CSS property
       names are case-insensitive - and so are HTML element selectors, which
       is why the filter above carries `i` too. `!important` is a legitimate,
       non-regressing suffix here and must not read as a literal; note it
       still fails the stricter literal-text pin above, which matches the
       shipped rule verbatim and is meant to. */
    for (const h of body.matchAll(/(?:^|[;\s])height\s*:\s*([^;]+)/gi)) {
      const v = h[1].trim().replace(/\s*!important$/i, "").trim();
      assert.match(v, /^100(\.0+)?%$/,
        `${sel.trim()} sets height:${v} - the fill must be a percentage, ` +
        "or it resolves against a page box we are never allowed to assume");
    }
  }
});

/** The `@media print` block alone, brace-matched. Slicing to end-of-file
 *  sweeps the app's JS in with the CSS, and a rule scan cannot tell a
 *  declaration from a function body. */
function printBlock(html) {
  const start = html.indexOf("@media print");
  let depth = 0;
  for (let i = html.indexOf("{", start); i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}" && --depth === 0) return html.slice(start, i);
  }
  throw new Error("unterminated @media print block");
}

/* ---------------------------------------------------------------------------
 * 23. the print CTA
 *
 * B5/one-pdf-path plan. Every deck - built-in or custom - gets the same two
 * print options, and both build the PDF client-side and hand it to the
 * browser as a download (the legacy `<button>`-that-calls-window.print()
 * path was retired by R1, 2026-09-29, once the owner's device gate passed).
 * ------------------------------------------------------------------------ */

/* Lane M1 (menu-shell, 2026-09-28): the print controls moved off the card
 * face and into the one settings panel (`#settings-panel`), shared by every
 * deck, built-in or custom. headerHTML() no longer renders them at all - that
 * IS acceptance (1), "no controls on any card face" - so this test now
 * asserts the negative on headerHTML and the positive on the static panel
 * markup in index.html, instead of diffing two headerHTML calls against
 * each other. */
test("print CTA: the header carries no print controls; the settings panel carries one set for every deck", async () => {
  const app = boot();
  const di = deckIndex(app, "amara");
  const builtin = String(app.get(`headerHTML(DECKS[${di}], DECKS[${di}].chords[0], 1)`));
  customDeck(app);
  const custom = String(app.get("headerHTML(deck(), deck().chords[0], 1)"));
  for (const html of [builtin, custom]) {
    for (const label of ["DOWNLOAD PDF"]) {
      assert.ok(!html.includes(label), `the card header must not carry "${label}" any more`);
    }
    assert.ok(!html.includes("<button"), "the card header must carry no buttons");
    assert.ok(!/<select/.test(html), "the card header must carry no select");
  }
  const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const panel = src.slice(src.indexOf('id="settings-panel"'), src.indexOf('id="settings-panel"') + 7000);
  for (const label of ["DOWNLOAD PDF"]) {
    assert.ok(panel.includes(label), `the settings panel is missing "${label}"`);
  }
  // One-pdf-path plan: every deck builds its PDF client-side - one panel, one
  // set of buttons, used for built-in and custom decks alike.
  assert.ok(!panel.includes("<a href="), "the panel must not link a pre-built PDF");
  assert.match(panel, /onclick="downloadDeckPDF\('shop', this, 'all'\); closePanel\(\);"/);
  assert.ok(/<button type="button" id="print-paper"/.test(panel), "D16: the paper picker rides with the buttons");
  assert.ok(!/<select id="print-paper/.test(panel), "the paper picker is a menu, not a native select");
});

const PM_SHOP_SHA256 = {
  "hijaz/letter": "99daa8974a6d0ef4785e794314376d5f0daaf00e9648b68cb8370087a93c7acc",
  "hijaz/a4": "fc8480128574008292c358d7d12f79ccace6c66e076b58902ebb51b90c18a704",
  "pygmy/letter": "90427058108e036ff5259eef7e88078b275dae907796a6d866dcbc419417af29",
  "pygmy/a4": "672b724d6fc3b3646c9524f9932036981fa99e5a79abe8058f071c3f71b77bb7",
  "amara/letter": "4651c6ec91b526c5730817522a763470fc723b934e6f39e2f6b3c038548b3c69",
  "amara/a4": "b6db7bc47c5591d70a55f5d17f2113658ab4b6d880abcc7ab28aeb86e0d1c516",
};

function pmPanel() {
  const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const at = src.indexOf('id="settings-panel"');
  return src.slice(at, src.indexOf("<!-- The scale engine, inlined", at));
}

test("PM rule 1: the print row is the DOWNLOAD PDF menu trigger then the paper menu trigger, and no full-deck control is rendered", async () => {
  const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const panel = pmPanel();
  const row = panel.slice(panel.indexOf('<div class="prints">'));
  const rowHtml = row.slice(0, row.indexOf("</div>", row.indexOf('id="print-paper-menu"')) + 6);
  const outsideMenu = rowHtml.replace(/<div id="print-menu"[\s\S]*?<\/div>/, "").replace(/<div id="print-paper-menu"[\s\S]*?<\/div>/, "");
  const controls = [...outsideMenu.matchAll(/<(button|select)\b[^>]*>/g)].map((m) => m[0]);
  assert.strictEqual(controls.length, 2, "the print row holds exactly two controls beside the menu");
  assert.match(controls[0], /^<button type="button" id="print-download" aria-haspopup="menu" aria-expanded="false" aria-controls="print-menu" onclick="togglePrintMenu\(\);">$/);
  assert.match(controls[1], /^<button type="button" id="print-paper" aria-haspopup="menu" aria-expanded="false" aria-controls="print-paper-menu" onclick="togglePaperMenu\(\);">$/);
  assert.ok(!/<select\b/.test(rowHtml), "the print row holds no native select");
  assert.match(rowHtml, /<button[^>]*>DOWNLOAD PDF<\/button>/);
  assert.ok(rowHtml.indexOf('id="print-download"') < rowHtml.indexOf('id="print-paper"'), "DOWNLOAD PDF leads the row");
  assert.ok(!src.includes("FULL DECK PDF"), "no element offers a full deck PDF");
  assert.ok(!src.includes("CHORD-ONLY PDF"), "no element is labelled CHORD-ONLY PDF");
  assert.match(panel, /<h3 class="panel-heading">Print this scale<\/h3>/);
});

test("PM rule 3: DOWNLOAD PDF names and builds the chord-only file, byte for byte what main built", async () => {
  const crypto = require("node:crypto");
  const shopButton = pmPanel().match(/<button[^>]*onclick="downloadDeckPDF\('(\w+)', this, 'all'\)[^>]*>ALL<\/button>/);
  assert.ok(shopButton, "the ALL menu item is in the panel");
  assert.strictEqual(shopButton[1], "shop", "the button builds the chord-only variant");
  for (const id of ["hijaz", "pygmy", "amara"]) {
    for (const paper of ["letter", "a4"]) {
      const app = boot();
      app.select(id);
      app.run(`setPrintPaper("${paper}"); downloadDeckPDF("shop")`);
      const bytes = Buffer.from(app.blobs()[0].parts[0]);
      assert.strictEqual(crypto.createHash("sha256").update(bytes).digest("hex"),
        PM_SHOP_SHA256[`${id}/${paper}`], `${id} ${paper}: chord-only bytes drifted from main`);
      assert.match(anchor(app).download, new RegExp(`_CHORD_ONLY_${paper === "a4" ? "A4" : "Letter"}\\.pdf$`));
    }
  }
});

test("PM rule 7: HANDPAN 101 is the second Resources link, the /handpan-101/ page in the same tab, alone in a full-width row", () => {
  const panel = pmPanel();
  const group = panel.slice(panel.indexOf('<h3 class="panel-heading">Resources</h3>'));
  const links = [...group.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map((m) => m[0]);
  assert.strictEqual(links.length, 2, "two Resources links");
  const link = links[1];
  assert.match(link, /\bid="res-handpan-101"/);
  assert.match(link, /href="\/handpan-101\/"/);
  assert.ok(!/\btarget=/.test(link), "the page opens in the same tab");
  assert.ok(!/\brel=/.test(link), "a same-site link carries no rel");
  assert.match(link, /aria-label="Handpan 101"/);
  assert.match(link, /class="mode"/);
  assert.ok(!/onclick/.test(link), "a link click must not close the panel");
  assert.strictEqual(strip(link).replace(/\s+/g, " ").trim(), "HANDPAN 101", "the complete name survives");
  const rows = [...group.matchAll(/<div class="modebar([^"]*)">([\s\S]*?)<\/div>/g)];
  assert.strictEqual(rows.length, 3, "three modebar rows");
  assert.deepStrictEqual([...rows[1][2].matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]), ["res-handpan-101"], "HANDPAN 101 is alone in the second row");
  assert.strictEqual(rows[1][1], "", "the row is a plain full-width modebar");
});

test("RR: Resources rows are EXPLORE SCALES, HANDPAN 101, ABOUT, each alone and full width, and the group has no external link", () => {
  const panel = pmPanel();
  const group = panel.slice(panel.indexOf('<h3 class="panel-heading">Resources</h3>'), panel.indexOf('id="panel-lang-heading"'));
  const rows = [...group.matchAll(/<div class="modebar([^"]*)">([\s\S]*?)<\/div>/g)];
  assert.strictEqual(rows.length, 3);
  assert.deepStrictEqual(rows.map((r) => [...r[2].matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])),
    [["res-explore"], ["res-handpan-101"], ["about-open"]]);
  for (const r of rows) assert.strictEqual(r[1], "", "each row is a plain full-width modebar");
  assert.match(rows[0][2], /href="\/scales\/"/);
  assert.ok(!/\btarget=|\brel=/.test(rows[0][2]), "EXPLORE SCALES opens in the same tab");
  assert.strictEqual(strip(rows[0][2]).replace(/\s+/g, " ").trim(), "EXPLORE SCALES");
  assert.match(rows[2][2], /<button class="mode" type="button" id="about-open"/);
  assert.ok(!/href="https?:/.test(group), "no external link in the group");
  assert.ok(!/target="_blank"/.test(group), "no new-tab link in the group");
});

test("RR: no served markup, selector row or i18n table carries a removed res- id or panel.res_amy key", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const removedRes = require("../tools/probe/panel_fit.js").REMOVED_BY_DESIGN.filter((id) => id.startsWith("res-"));
  assert.strictEqual(removedRes.length, 6);
  for (const dead of [...removedRes, "panel.res_amy"]) {
    assert.ok(!html.includes(dead), dead + " is still served");
  }
});

test("RR: panel.explore is in every i18n table", () => {
  const dir = path.join(__dirname, "..", "data", "i18n");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.strictEqual(files.length, 8);
  for (const f of files) {
    const t = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    assert.ok(typeof t["panel.explore"] === "string" && t["panel.explore"].length > 0, f + " lacks panel.explore");
    assert.ok(!Object.keys(t).some((k) => k.startsWith("panel.res_amy")), f + " keeps a panel.res_amy key");
  }
});

test("RR: panelStops lists the Resources group in visual order in single column and both grid modes", () => {
  const stubIds = [...pmPanel().matchAll(/<(?:a|button)\b[^>]*id="(res-[\w-]+|about-open)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(stubIds, ["res-explore", "res-handpan-101", "about-open"], "DOM order is visual order");
  for (const display of ["block", "flex"]) {
    const app = boot();
    app.run(`settingsPanel.querySelectorAll = (sel) => ${JSON.stringify(stubIds)}.filter((id) => id === "about-open" ? sel.includes("#about-open") : sel.includes('[id^="res-"]')).map((id) => ({ id, disabled: false, getClientRects: () => [{}] }))`);
    app.run(`globalThis.getComputedStyle = () => ({ display: "${display}" }); document.querySelector = () => ({})`);
    app.run("openPanel()");
    assert.strictEqual(app.get("getComputedStyle(null).display"), display);
    const ids = app.get("panelStops().map((e) => e.id)");
    const at = stubIds.map((id) => ids.indexOf(id));
    assert.ok(at.every((i) => i >= 0), display + ": every Resources stop is present");
    assert.deepStrictEqual([...at].sort((x, y) => x - y), at, display + ": Resources stops are in visual order");
    assert.strictEqual(ids[ids.length - 1], "lang-select", "Language closes the list");
  }
});

/* D-3's type guard on printPaper must reject a TRUTHY but invalid stored
   value, not just a falsy one - `store.printPaper || "letter"` also survives
   `null`, so a mutant reducing the guard to that passes every test that only
   tries falsy/valid inputs. "tabloid" is a truthy string that is not a
   PRINT_PAPER key; 42 is truthy and not even a string. "toString" and
   ["a4"] are rows 23/25: a plain `PRINT_PAPER[p]` bracket lookup answers
   truthy for "toString" (an INHERITED key, resolved through the prototype
   chain same as an own key) and, given an array whose lone element IS a
   valid key, for `PRINT_PAPER[["a4"]]` too (the bracket access coerces the
   array to the string "a4" before indexing) - `isPaper` must refuse both. */
for (const bad of ["tabloid", 42, null, "toString", ["a4"]]) {
  test(`printPaper boot guard: stored ${JSON.stringify(bad)} falls back to letter`, async () => {
    const app = boot({ storage: { hpfc: JSON.stringify({ deck: "amara", mode: "A", printPaper: bad }) } });
    assert.strictEqual(app.get("printPaper"), "letter",
      `stored printPaper ${JSON.stringify(bad)} booted to "${app.get("printPaper")}", not "letter"`);
  });
}

test("setPrintPaper refuses an inherited key (\"toString\") rather than accepting it as a paper", async () => {
  const app = boot();
  app.run('setPrintPaper("toString")');
  assert.strictEqual(app.get("printPaper"), "letter",
    "setPrintPaper(\"toString\") must be refused, not accepted as a PRINT_PAPER key");
});

test("setPrintPaper refuses a non-string value even when it stringifies to a valid key", async () => {
  const app = boot();
  app.run('setPrintPaper(["a4"])');
  assert.strictEqual(app.get("printPaper"), "letter",
    "setPrintPaper([\"a4\"]) must be refused - only a string paper key is accepted");
});

/* Reviewer finding B-2: `printPaper` is module state that survives a render,
   but headerHTML() re-emits the <select> from scratch on EVERY render with
   LETTER first and nothing marked selected. So a flip, an arrow press or a
   shuffle silently reset the control to LETTER while the app still printed
   A4 - and re-picking LETTER fired no `change` event, so the user could not
   get back without round-tripping through A4. The control has to report the
   state it owns (D16). */
/* Lane M1: the picker is now a static control (`#print-paper` inside
 * `#settings-panel`), not re-rendered per card - so there is no "selected"
 * attribute to drift, and setPrintPaper() pushes into the live element's
 * `.value` itself (index.html's setPrintPaper). Same bug class (D16: the
 * control must report the state it owns), narrower fix surface. */
test("print CTA: the paper picker reports the paper that will actually print", async () => {
  const app = boot();
  customDeck(app);
  const picked = () => String(app.get('document.getElementById("print-paper").textContent'));

  assert.strictEqual(picked(), "LETTER", "the picker must open on the default paper");
  app.run('setPrintPaper("a4")');
  assert.strictEqual(picked(), "A4",
    "setPrintPaper must push the new paper into the picker's own label");
  app.run('setPrintPaper("letter")');
  assert.strictEqual(picked(), "LETTER");
});

/* ---------------------------------------------------------------------------
 * 24. the PDF emitter behind the CTA
 *
 * The two custom-deck CTAs stopped asking the browser to print and started
 * writing the PDF themselves (Task 4 of the client-pdf-emitter plan). The
 * bytes are `tests/test_pdf_parity.py`'s business - held glyph for glyph
 * against tools/hifi.py. What is asserted HERE is the delivery: that a blob of
 * the right type carries them, that the file lands with the name the print
 * pipeline would have given it, that iOS takes the one route that works on
 * iOS, and that the object URL is let go afterwards.
 * ------------------------------------------------------------------------ */

const IOS_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

/** The <a> the app created to deliver a download, or null if it took the iOS
 *  route instead. `created` is every element createElement() ever made this
 *  boot, so the anchor is found by tag rather than by position. */
const anchor = (app) => app.created.filter((e) => e.tagName === "A").pop() || null;

test("the CTA emits a PDF blob and never calls window.print", async () => {
  const app = boot();
  customDeck(app);
  app.run('downloadDeckPDF("shop")');

  assert.deepStrictEqual(app.printCalls(), [],
    "the emitter path must not reach the browser's print dialog");
  const blobs = app.blobs();
  assert.strictEqual(blobs.length, 1, `${blobs.length} blobs were built, not 1`);
  assert.strictEqual(blobs[0].type, "application/pdf");
  assert.strictEqual(blobs[0].parts.length, 1);
  // Realm boundary: the bytes were built inside the vm, so `instanceof
  // Uint8Array` is false against the host's constructor.
  assert.strictEqual(blobs[0].parts[0].constructor.name, "Uint8Array");
  assert.ok(blobs[0].parts[0].length > 10000,
    "a chord-card sheet is tens of kilobytes; a near-empty blob is a silent failure");
});

test("the emitted bytes are a PDF, and the two variants differ in length", async () => {
  const app = boot();
  customDeck(app);
  app.run('downloadDeckPDF("full")');
  app.run('downloadDeckPDF("shop")');
  const [full, shop] = app.blobs().map((b) => b.parts[0]);
  const head = (u8) => String.fromCharCode(...Array.from(u8.slice(0, 5)));
  assert.strictEqual(head(full), "%PDF-");
  assert.strictEqual(head(shop), "%PDF-");
  assert.ok(full.length > shop.length,
    "the full variant carries a title card and a legend card the shop variant drops");
});

test("the download is named the way the print pipeline names its files", async () => {
  const app = boot();
  customDeck(app);
  app.run('downloadDeckPDF("full")');
  const full = anchor(app);
  assert.ok(full, "a desktop download is delivered through an <a download>");
  assert.strictEqual(full.clicks, 1, "the anchor was built but never activated");
  // pdfFileName() names a download `<Name>_CHORD_ONLY_<paper>.pdf`, the shape tools/decks.py main() writes;
  // the unused full-deck path names its output `<Name>_Cards_Letter.pdf`, with punctuation folded out of
  // the deck name. A custom deck's download takes the same shape rather than inventing a second one.
  assert.match(full.download, /^[A-Za-z0-9_]+_Cards_Letter\.pdf$/);
  app.run('downloadDeckPDF("shop")');
  assert.match(anchor(app).download, /^[A-Za-z0-9_]+_CHORD_ONLY_Letter\.pdf$/);
  app.run('setPrintPaper("a4"); downloadDeckPDF("full")');
  assert.match(anchor(app).download, /_Cards_A4\.pdf$/,
    "the paper the user picked has to reach the filename, or two downloads collide");
});

test("iOS gets the blob as a navigation, not as a download attribute", async () => {
  const app = boot({ userAgent: IOS_UA });
  customDeck(app);
  // The sandbox has no window.open (jsdom-free, and the app is the only thing
  // that calls it) - stub it as a blocked popup, same as Safari does when the
  // call is not in direct response to the tap, to exercise the location.href
  // fallback the D-2(B) delivery code depends on.
  app.run('window.open = function() { return null; };');
  app.run('downloadDeckPDF("full")');
  // `<a download>` does nothing at all on iOS Safari - the tap is swallowed and
  // the user gets no file and no error. Navigating to the blob hands the PDF to
  // the system viewer, whose Share sheet is how a file is saved on that
  // platform (learning: ios-safari-ignores-at-page is the same family of
  // platform divergence).
  assert.strictEqual(anchor(app), null, "iOS must not be handed an <a download>");
  const urls = app.objectUrls();
  assert.strictEqual(urls.length, 1);
  assert.strictEqual(app.location.href, urls[0].url,
    "iOS delivery is a navigation to the object URL");
});

/* D-2(B)'s primary path on iOS is window.open(url), with location.href only
   as the fallback for a blocked popup. A mutant that always navigates
   location.href regardless of window.open's return value delivers the same
   file either way and so is easy to miss - it only shows up as a stray
   navigation on the happy path, which is what this asserts against. */
test("iOS: when window.open succeeds, location.href is left alone", async () => {
  const app = boot({ userAgent: IOS_UA });
  customDeck(app);
  const before = app.location.href;
  app.run('window.open = function() { return { closed: false }; };');
  app.run('downloadDeckPDF("full")');
  assert.strictEqual(anchor(app), null, "iOS must not be handed an <a download>");
  assert.strictEqual(app.objectUrls().length, 1);
  assert.strictEqual(app.location.href, before,
    "window.open succeeded, so the D-2(B) fallback must not also navigate the tab");
});

test("the object URL is revoked, and not before the viewer has read it", async () => {
  const app = boot();
  customDeck(app);
  app.run('downloadDeckPDF("full")');
  const before = app.objectUrls();
  assert.strictEqual(before.length, 1);
  assert.strictEqual(before[0].revoked, false,
    "revoking in the same turn of the event loop kills the download on Safari");
  assert.strictEqual(app.flushTimers(), 0);
  assert.strictEqual(app.objectUrls()[0].revoked, true,
    "an object URL that is never revoked pins the whole PDF for the life of the tab");
});

test("the paper control drives the page box, not just the filename", async () => {
  const app = boot();
  customDeck(app);
  app.run('setPrintPaper("a4"); downloadDeckPDF("shop")');
  app.run('setPrintPaper("letter"); downloadDeckPDF("shop")');
  // Buffer, not String.fromCharCode(...bytes): a sheet is tens of thousands of
  // bytes and spreading them into a call blows the stack.
  const [a4, letter] = app.blobs().map((b) =>
    Buffer.from(b.parts[0]).toString("latin1"));
  assert.ok(/\/MediaBox \[0 0 595\.28 841\.89\]/.test(a4),
    "choosing A4 and getting a Letter page box is the exact failure the picker exists to prevent");
  assert.ok(/\/MediaBox \[0 0 612 792\]/.test(letter));
});

/* Lane M1: one shared panel now carries the CTA buttons for every deck, so
 * "built-in and custom alike" is proven by there being exactly one panel in
 * the file (not two headerHTML calls), wired to the emitter and to
 * closePanel() ("After an action": a PDF build closes the panel). */
test("the CTA buttons call the emitter, built-in and custom alike", async () => {
  const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.strictEqual((src.match(/id="settings-panel"/g) || []).length, 1,
    "exactly one settings panel serves every deck");
  const onclick = src.match(/<button[^>]*id="print-pdf-all"[^>]*onclick="([^"]*)"/)[1];
  for (const kind of ["built-in", "custom"]) {
    const app = boot();
    if (kind === "custom") customDeck(app);
    app.run("openPanel()");
    app.run(`(function () { ${onclick} }).call({ closest: () => null })`);
    const blobs = app.blobs();
    assert.strictEqual(blobs.length, 1, `${kind}: the CTA click built ${blobs.length} PDFs, not 1`);
    assert.strictEqual(blobs[0].type, "application/pdf", `${kind}: the CTA click did not build a PDF`);
    assert.strictEqual(app.get("panelOpen"), false, `${kind}: a PDF build closes the panel`);
  }
});

test("the legacy print sheet is gone: no #printroot, no openPrintSheet, no window.print caller", async () => {
  // R1, 2026-09-29: the owner's iPhone ruler check (device gate, item 1) is
  // MET, so the browser-print path this test used to keep alive has been
  // retired. Every deck downloads a client-built PDF instead.
  const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.doesNotMatch(src, /id="printroot"/);
  assert.doesNotMatch(src, /function openPrintSheet/);
  assert.doesNotMatch(src, /onclick="[^"]*window\.print\(\)/,
    "no control still calls window.print() directly");
  // Q2: the original forms above (`[>{.#]` / `\(\)\s*;`) are narrower than
  // they look - they miss window.print() with no trailing `;` and
  // body.printing) - and they used to let two now-removed comments
  // ("#printroot, body.printing" and "window.print()/openPrintSheet")
  // read as if the code they described still existed. These
  // code-shaped forms catch a real reintroduction wherever it appears,
  // comment or not, which is why both comments were reworded rather than
  // stripped at the time (AD6) - they no longer match, and have since
  // been removed entirely.
  assert.doesNotMatch(src, /addEventListener\(\s*["']afterprint/);
  assert.doesNotMatch(src, /body\.printing\b/);
  assert.doesNotMatch(src, /\bwindow\.print\s*\(/);
  // printGridCSS never existed in this codebase (confirmed by grep across
  // index.html and this file before adding these lines), so this is a
  // future-reintroduction guard, not a check against a symbol that was ever
  // here - the same reasoning AD6 applies to the afterprint/body.printing/
  // window.print forms above.
  assert.doesNotMatch(src, /printGridCSS\s*\(/);
  const app = boot();
  customDeck(app);
  assert.strictEqual(app.get("typeof openPrintSheet"), "undefined");
  assert.strictEqual(app.get("typeof PRINT_LAYOUTS"), "undefined");
  assert.strictEqual(app.get("typeof printGridCSS"), "undefined");
});

test("the head carries theme-color and color-scheme meta tags matching --table", async () => {
  // The sandbox stubs the DOM and never parses <head>, so this has to read the
  // raw file - same pattern as the scale-slots and layout-hint checks above.
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const themeColor = /<meta\s+name="theme-color"\s+content="(#[0-9a-fA-F]{6})">/.exec(html);
  assert.ok(themeColor, "no <meta name=\"theme-color\"> in the head");
  const tableToken = /--table:(#[0-9a-fA-F]{6});/.exec(html);
  assert.ok(tableToken, "the --table token itself is missing");
  assert.strictEqual(themeColor[1].toLowerCase(), tableToken[1].toLowerCase(),
    "theme-color does not equal the --table token");
  assert.strictEqual(themeColor[1].toLowerCase(), "#0f0e0b");
  assert.match(html, /<meta\s+name="color-scheme"\s+content="dark">/,
    "no <meta name=\"color-scheme\" content=\"dark\"> in the head");
});

/* Name, description, favicon and link preview - docs/plans/2026-10-04-name-and-
 * favicon.md section 4. The head is never parsed by the sandbox, so these read
 * the raw file like the theme-color test above. */

function headHtml() {
  return fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
}

function metaContent(html, attr, name) {
  const re = new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)">`);
  const m = re.exec(html);
  assert.ok(m, `no <meta ${attr}="${name}"> in the head`);
  return m[1];
}

function linkHref(html, rel, extra = "") {
  const re = new RegExp(`<link\\s+rel="${rel}"${extra}[^>]*\\shref="([^"]*)"`);
  const m = re.exec(html);
  assert.ok(m, `no <link rel="${rel}"${extra}> in the head`);
  return m[1];
}

const POSITIONING_TITLE = "Handpan Theory: Custom Scale Chord and Progression Practice";

test("the title is the positioning string; og:title and twitter:title equal it; the h1 is the app name (temporary mismatch: see the lockup tests)", async () => {
  const html = headHtml();
  const title = /<title>([^<]*)<\/title>/.exec(html);
  assert.ok(title, "no <title>");
  assert.ok(/<h1>/.test(html), "no <h1>");
  assert.strictEqual(title[1], POSITIONING_TITLE);
  assert.strictEqual(metaContent(html, "property", "og:title"), title[1]);
  assert.strictEqual(metaContent(html, "name", "twitter:title"), title[1]);
});

test("the description says free and progressions early, equals og:description and fits 120..155", async () => {
  const html = headHtml();
  const desc = metaContent(html, "name", "description");
  assert.strictEqual(metaContent(html, "property", "og:description"), desc);
  assert.ok(desc.length >= 120 && desc.length <= 155,
    `description is ${desc.length} characters, outside 120..155`);
  assert.ok(/\bfree\b/i.test(desc), "the description does not say free");
  const cut = desc.slice(0, 110);
  assert.ok(/progressions/.test(cut),
    `"progressions" is not inside the first 110 characters: ${JSON.stringify(cut)}`);
});

test("NSA: the description names Neotone in all three copies and the About text links the Neotone chord page", async () => {
  const html = headHtml();
  const metas = [metaContent(html, "name", "description"), metaContent(html, "property", "og:description"),
    /"description": "([^"]*)"/.exec(html)[1]];
  for (const m of metas) assert.match(m, /Neotone/);
  assert.strictEqual(new Set(metas).size, 1);
  const about = /<section id="about"[\s\S]*?<\/section>/.exec(INDEX_HTML())[0];
  assert.strictEqual((about.match(/<a href="\/scales\/neotone\/">/g) || []).length, 1);
  assert.match(about, /Neotone/);
  assert.ok(fs.existsSync(path.join(__dirname, "..", "scales", "neotone", "index.html")));
});

test("the favicon is an inline SVG data URI drawing the Handpan Theory mark on a square tile", async () => {
  const html = headHtml();
  const href = linkHref(html, "icon", `\\s+type="image/svg\\+xml"`);
  assert.ok(href.startsWith("data:image/svg+xml,"), "the SVG icon is not a data: URI");
  const svg = decodeURIComponent(href.slice("data:image/svg+xml,".length));
  assert.match(svg, /^<svg[^>]*\sviewBox='0 0 64 64'/, "the SVG has no 64x64 viewBox");
  assert.match(svg, /<rect width='64' height='64' fill='#0F0E0B'\/>/, "no #0F0E0B square tile");
  assert.ok(!/<circle/.test(svg), "the tile is round");
  assert.ok((svg.match(/#F6F4ED/g) || []).length >= 1, "the ivory master ink #F6F4ED is missing");
  assert.ok(!/#E6C99B|#44E0D8|#0B7B75|#DD8F00/i.test(svg), "an old mark colour or an Amara teal or amber is still in the icon");
  assert.ok(!/<(text|title)\b|role=|aria-label=/.test(svg), "the icon carries text, a title or a role");
});

test("the touch icon and the preview image exist and are named once", async () => {
  const html = headHtml();
  const touch = linkHref(html, "apple-touch-icon");
  assert.strictEqual(touch, "apple-touch-icon.png");
  assert.strictEqual(linkHref(html, "icon", `\\s+type="image/png"`), touch,
    "the PNG rel=icon must reuse apple-touch-icon.png");
  assert.ok(fs.existsSync(path.join(ROOT, touch)), `${touch} missing at the repo root`);
  const og = metaContent(html, "property", "og:image");
  assert.strictEqual(og, "https://handpantheory.com/og.png");
  assert.ok(fs.existsSync(path.join(ROOT, "og.png")), "og.png missing at the repo root");
  assert.strictEqual(metaContent(html, "name", "twitter:image"), og);
  assert.strictEqual(metaContent(html, "property", "og:image:width"), "1200");
  assert.strictEqual(metaContent(html, "property", "og:image:height"), "630");
});

describe("logo in the app: the header lockup", () => {
  const header = () => {
    const h = headHtml();
    return h.slice(h.indexOf("<header>"), h.indexOf("</header>"));
  };
  const h1Html = () => /<h1>([\s\S]*?)<\/h1>/.exec(header())[1];

  test("LG: the h1's accessible name is exactly Handpan Theory, once, from one hidden span", async () => {
    const h1 = h1Html();
    const spans = h1.match(/<span class="sr-only">[^<]*<\/span>/g) || [];
    assert.deepStrictEqual(spans, ['<span class="sr-only">Handpan Theory</span>']);
    const svg = /<svg\b[^>]*>/.exec(h1)[0];
    assert.match(svg, /\baria-hidden="true"/);
    assert.match(svg, /\bfocusable="false"/);
    assert.ok(!/\brole=|\baria-label=/.test(svg), "the svg opening tag carries role or aria-label");
    assert.ok(!/<title\b/.test(h1), "the svg carries a <title>");
    const text = h1.replace(/<svg[\s\S]*?<\/svg>/, "").replace(/<[^>]*>/g, "").trim();
    assert.strictEqual(text, "Handpan Theory");
  });

  test("LG: exactly one horizontal-full svg in the h1, no <img>, no visible Handpan Chords in the header", async () => {
    const h1 = h1Html();
    assert.strictEqual((h1.match(/<svg\b[^>]*viewBox="0 0 683\.93 196"/g) || []).length, 1);
    assert.ok(/fill="#F6F4ED"/.test(h1), "the lockup is not the ivory Two contours master");
    assert.strictEqual((h1.match(/<svg\b/g) || []).length, 1);
    assert.ok(!/<img\b/.test(header()), "an <img> is in the header");
    const visible = header().replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<span class="sr-only">[^<]*<\/span>/g, "").replace(/<[^>]*>/g, " ");
    assert.ok(!/Handpan Chords/.test(visible), "the header still says Handpan Chords");
  });

  test("LG: the lockup sits between the brand:lockup markers", async () => {
    const h = headHtml();
    const begin = h.indexOf("<!-- brand:lockup begin -->");
    const end = h.indexOf("<!-- brand:lockup end -->");
    assert.ok(begin > 0 && end > begin, "brand:lockup markers missing");
    assert.strictEqual((h.slice(begin, end).match(/<svg\b/g) || []).length, 1);
  });

  test("LG: every id in index.html is unique and every svg url(#x) / href=#x resolves", async () => {
    const h = headHtml();
    const ids = [...h.matchAll(/\sid="([^"']+)"/g)].map((m) => m[1]);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepStrictEqual([...new Set(dup)], [], "duplicate ids");
    const lockup = h.slice(h.indexOf("<!-- brand:lockup begin -->"), h.indexOf("<!-- brand:lockup end -->"));
    const refs = [...lockup.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)].map((m) => m[1] || m[2]);
    for (const r of refs) assert.ok(ids.includes(r), `dangling reference #${r}`);
    assert.ok(!ids.some((id) => /^hf/.test(id)), "an unprefixed lockup id survives");
    assert.ok(!/\sid="hpt-/.test(lockup) || refs.length > 0, "an orphan lockup id");
  });
});

/* ================================================================ Lane S2
 * "CHORD PROGRESSION" mode: app-side wiring for HPE.sequence.pick(). See
 * docs/plans/2026-09-29-chord-sequence-mode.md sections 3 (S2 row) and 8
 * (E1-E9, binding amendments) for the acceptance criteria these tests are
 * derived from. */

const SEQ_BASE = JSON.parse(fs.readFileSync(
  path.join(ROOT, "tests", "fixtures", "seq_ui_base_e728912.json"), "utf8"));

test("stored mode \"S\" reads back; unrecognised stored modes read as \"A\"", async () => {
  for (const [stored, want] of [["S", "S"], ["A", "A"], ["B", "B"],
      ["C", "A"], ["7", "A"], [null, "A"]]) {
    const app = boot({ storage: stored === null ? {} : { hpfc: JSON.stringify({ deck: "hijaz", mode: stored }) } });
    assert.strictEqual(app.get("mode"), want, `stored mode ${JSON.stringify(stored)}`);
  }
});

const FIVE = ["modeA", "modeB", "tier-basic", "tier-intermediate", "tier-advanced"];
function assertOneOfFive(app, want, label) {
  for (const id of FIVE) {
    const el = app.els[id];
    assert.strictEqual(el.getAttribute("aria-pressed"), id === want ? "true" : "false", `${label}: ${id} aria-pressed`);
    assert.strictEqual(el.classList.contains("on"), id === want, `${label}: ${id} .on`);
    assert.ok(!el.disabled, `${label}: ${id} is never disabled`);
  }
}

test("exactly one of the five practice buttons is pressed, and mode and tier survive a reload", async () => {
  const app = boot();
  assertOneOfFive(app, "modeA", "boot");
  app.run('setMode("B")');
  assertOneOfFive(app, "modeB", "B");
  app.run('setTier("advanced")');
  assertOneOfFive(app, "tier-advanced", "advanced");
  app.run('setMode("S")');
  assertOneOfFive(app, "tier-advanced", "setMode S keeps the tier lit");
  app.run('setMode("A")');
  assertOneOfFive(app, "modeA", "A unlights every tier");
  assert.strictEqual(app.get("tier"), "advanced", "the remembered tier is kept while unlit");

  app.run('setTier("intermediate")');
  const again = boot({ storage: { hpfc: app.store.hpfc } });
  assert.strictEqual(again.get("mode"), "S");
  assertOneOfFive(again, "tier-intermediate", "reload");
  for (const stored of [{ mode: "A", tier: "advanced" }, { mode: "S", tier: "nonsense" }, { mode: "S" }]) {
    const b = boot({ storage: { hpfc: JSON.stringify({ deck: "hijaz", ...stored }) } });
    assertOneOfFive(b, stored.mode === "A" ? "modeA" : "tier-" + (stored.tier === "advanced" ? "advanced" : "basic"),
      JSON.stringify(stored));
  }
});

test("setTier enters progression at that tier, deals exactly once with prev cleared, and saves both", async () => {
  for (const from of ["A", "B", "S"]) {
    const app = boot({ random: () => 0 });
    app.run(`setMode("${from}")`);
    app.run('globalThis.__calls = []; const o = HPE.sequence.pick; HPE.sequence.pick = (d, r, p, t) => { __calls.push([p, t]); return o(d, r, p, t); };');
    app.run('setTier("intermediate")');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(app.get("__calls"))), [[null, "intermediate"]], `from ${from}: one pick, prev null`);
    assert.strictEqual(app.get("mode"), "S");
    assert.strictEqual(app.get("tier"), "intermediate");
    const saved = JSON.parse(app.store.hpfc);
    assert.strictEqual(saved.mode, "S");
    assert.strictEqual(saved.tier, "intermediate");
    assert.strictEqual(app.els["panel-seq-note"].hidden, false);
  }
});

test("sequence mode: prev/next/arrows stay within the sequence and wrap, answer face shows first", async () => {
  const app = boot({ random: () => 0 });
  app.run('setMode("S")');
  const seq = app.get("seq");
  const n = seq.chords.length;
  assert.ok(n >= 2 && n <= 4, "pick() must return a 2-, 3- or 4-chord sequence");
  assert.strictEqual(app.get("idx"), 0);
  // E5: the front face is mode A's answer face byte for byte - the diagram,
  // not the chord name.
  assert.ok(app.els.front.innerHTML.includes("diagwrap"), "front face must show the diagram, not the name");
  assert.ok(!app.els.front.innerHTML.includes("Tap to reveal"), "S front must carry no hint line");

  for (let i = 0; i < n; i++) app.els.next.onclick();
  assert.strictEqual(app.get("idx"), 0, "forward all the way around wraps to the first");
  app.els.prev.onclick();
  assert.strictEqual(app.get("idx"), n - 1, "backward from the first wraps to the last");
  app.keydown("ArrowRight");
  assert.strictEqual(app.get("idx"), 0, "ArrowRight from the last chord wraps to the first");
});

test("\"New progression\" changes the sequence and does not touch shuffled", async () => {
  // A rotating (not fixed) rng: HPE.sequence.pick's own no-repeat guarantee
  // (S1 test 5, 1000 seeded draws) is the engine's job, not this lane's - this
  // proves the UI actually redraws on click and never disturbs `shuffled`.
  const values = [0, 0.31, 0.62, 0.93, 0.15, 0.47, 0.79, 0.08, 0.55, 0.88,
    0.22, 0.66, 0.11, 0.44, 0.77, 0.33, 0.99, 0.05, 0.5, 0.9];
  let i = 0;
  const app = boot({ random: () => values[i++ % values.length] });
  app.run('setMode("S")');
  const seen = new Set([JSON.stringify(app.get("seq").chords)]);
  for (let k = 0; k < 20; k++) {
    app.els.shuffle.onclick.call(app.els.shuffle);
    seen.add(JSON.stringify(app.get("seq").chords));
    assert.strictEqual(app.get("shuffled"), false, "New progression in mode S must never touch `shuffled`");
  }
  assert.ok(seen.size > 1, "20 varied draws must produce more than one distinct sequence");
});

test("\"New progression\" never redraws the sequence on screen, even with a constant rng", async () => {
  // A constant rng makes pick() deterministic, so only the `prev` argument
  // setOrder() passes can make consecutive draws differ.
  const app = boot({ random: () => 0 });
  app.run('setMode("S")');
  let last = JSON.stringify(app.get("seq").chords);
  for (let k = 0; k < 10; k++) {
    app.els.shuffle.onclick.call(app.els.shuffle);
    const now = JSON.stringify(app.get("seq").chords);
    assert.notStrictEqual(now, last, `re-roll ${k + 1} repeated the sequence on screen`);
    last = now;
  }
});

test("the re-roll control reads as a button in mode S and reverts outside it", async () => {
  const app = boot();
  app.run('setMode("S")');
  assert.ok(app.els.shuffle.classList.contains("reroll"), "mode S must mark #shuffle .reroll");
  app.run('setMode("A")');
  assert.ok(!app.els.shuffle.classList.contains("reroll"), "leaving S must drop .reroll");
  const html = require("node:fs").readFileSync(require("./helpers/sandbox.js").APP, "utf8");
  assert.match(html, /\.shuffle\.reroll\{[^}]*border:1px solid #3a352d/,
    ".reroll must borrow button.nav's border so it reads as a button");
  assert.match(html, /\.shuffle\.reroll:active\{background:#2e281e\}/,
    ".reroll must press like button.nav:active, not only recolour its text");
});

test("the mode S panel note introduces the video as seven ways to play chords", async () => {
  const html = require("node:fs").readFileSync(require("./helpers/sandbox.js").APP, "utf8");
  const note = html.match(/<p class="panel-note" id="panel-seq-note"[^>]*>([\s\S]*?)<\/p>/);
  assert.ok(note, "#panel-seq-note must exist");
  assert.match(note[1], /^\s*7 different ways to play chords:\s*<a id="seq-source-link"/);
  assert.ok(!/Styles adapted from/.test(note[1]), "the old credit line must be gone");
});

test("switching deck, generating a deck and deleting a deck each draw a new sequence", async () => {
  const app = boot();
  app.run('setMode("S")');
  const pygmy = decks(app).find((d) => d.id === "pygmy");
  app.select(pygmy.instanceId || pygmy.id);
  assert.strictEqual(app.get("mode"), "S");
  assert.ok(app.get("seq").chords, "Pygmy must draw a sequence in mode S");

  const AMARA_STRING2 = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
  const gen = app.generate(AMARA_STRING2);
  app.select(gen.instanceId);
  assert.strictEqual(app.get("mode"), "S");
  assert.ok(app.get("seq").chords, "a freshly generated deck must draw a sequence in mode S");

  // Deleting the currently-selected deck falls back to another deck; that
  // fallback must also draw a fresh sequence while mode S is active.
  app.run(`deleteDeck(${JSON.stringify(gen.value.id)})`);
  assert.strictEqual(app.get("mode"), "S");
  assert.notStrictEqual(app.get("selection.id"), gen.value.id, "the deleted deck must no longer be selected");
  const drawn = JSON.stringify(arr(app.get("seq").chords));
  const valid = app.get("[...HPE.sequence.sequences(deck(), 2), ...HPE.sequence.sequences(deck(), 3), ...HPE.sequence.sequences(deck(), 4)]").map((q) => JSON.stringify(arr(q)));
  assert.ok(valid.includes(drawn), `the fallback deck's sequence ${drawn} must be one of its own sequences`);
  assert.deepStrictEqual(arr(app.get("order")), arr(app.get("seq").chords), "order must follow the fallback deck's sequence");
});

test("the sequence source link: rel=noopener, target=_blank, the exact href, and it joins the Tab cycle only while visible", async () => {
  // Static markup attributes (href/rel/target) live in the shipped HTML, not
  // set by JS, so the sandbox's blank stub element never carries them -
  // read them from the source, same pattern as the print-CTA markup test above.
  const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const tag = src.slice(src.indexOf('id="seq-source-link"') - 40, src.indexOf('id="seq-source-link"') + 200);
  const anchorOpen = tag.slice(tag.indexOf("<a"), tag.indexOf(">") + 1);
  assert.match(anchorOpen, /rel="[^"]*\bnoopener\b[^"]*"/);
  assert.match(anchorOpen, /target="_blank"/);
  assert.match(anchorOpen, /href="https:\/\/www\.youtube\.com\/shorts\/YcmgdgZTpHc"/);
  assert.match(src, /#seq-source-link\{[^}]*min-height:44px/);
  const app = boot();
  app.run("settingsPanel.querySelectorAll = () => []");
  app.run("openPanel()");
  const stops = () => app.get("panelStops().map((e) => e.id)");
  assert.ok(!stops().includes("seq-source-link"), "the hidden link is a Tab stop in mode A");
  app.run('setMode("S")');
  assert.ok(stops().includes("seq-source-link"), "the visible link is not a Tab stop in mode S");
  app.run('setMode("A")');
  assert.ok(!stops().includes("seq-source-link"), "the link stayed a Tab stop after leaving mode S");
});

test("card faces in mode S carry no a, button or select", async () => {
  const app = boot({ random: () => 0 });
  app.run('setMode("S")');
  for (const face of ["front", "back"]) {
    const html = app.els[face].innerHTML;
    assert.ok(!/<a[\s>]/i.test(html), `${face} face must carry no <a>`);
    assert.ok(!/<button[\s>]/i.test(html), `${face} face must carry no <button>`);
    assert.ok(!/<select[\s>]/i.test(html), `${face} face must carry no <select>`);
  }
});

test("the live region names the current chord and its position: \"<name>, chord N of M\"", async () => {
  const app = boot({ random: () => 0 });
  app.run('setMode("S")');
  const d = app.currentDeck();
  const seq = app.get("seq");
  const live = app.els.count.children[1];
  assert.strictEqual(live.className, "sr-only");
  const ch = d.chords[seq.chords[0]];
  assert.strictEqual(live.textContent, `${ch.main}${ch.sup || ""}, chord 1 of ${seq.chords.length}`);
  const rail = app.els.count.children[0];
  assert.strictEqual(rail.getAttribute("aria-hidden"), "true");
});

test("the rail's chord labels are set via textContent, never innerHTML", async () => {
  // E6: renderSeqRail() must never innerHTML chord data into the DOM.
  // D-12: each chord is now one .seq-unit (an optional separator text node
  // plus one labelled name node), not an alternating flat pair of siblings.
  const app = boot({ random: () => 0 });
  app.run('setMode("S")');
  const d = app.currentDeck();
  const seq = app.get("seq");
  const rail = app.els.count.children[0];
  assert.strictEqual(rail.children.length, seq.chords.length, "one .seq-unit per chord");
  const labelNodes = rail.children.map((unit) => unit.children[unit.children.length - 1]);
  seq.chords.forEach((ci, i) => {
    const ch = d.chords[ci];
    assert.strictEqual(labelNodes[i].className, "seq-chord");
    assert.strictEqual(labelNodes[i].textContent, `${ch.main}${ch.sup || ""}`);
  });
});

test("an unsupported deck clears the card and disables stepping, with no crash", async () => {
  const app = boot({ random: () => 0 });
  app.run('setMode("S")');
  const res = app.generate("(C3) G3 D4 G4 D5");
  assert.ok(res.ok);
  app.select(res.instanceId);
  assert.strictEqual(app.get("seq").chords, null);
  assert.match(app.els.front.innerHTML, /doesn&rsquo;t have enough simple chords/);
  assert.strictEqual(app.els.front.innerHTML, app.els.back.innerHTML, "both faces show the same message");
  assert.strictEqual(app.els.count.children.length, 0);
  assert.strictEqual(app.els.count.textContent, "", "#count must carry no stale text on an unsupported deck");
  assert.doesNotMatch(app.els.count.textContent, /chord \d+ of \d+/);
  assert.doesNotThrow(() => { app.els.next.onclick(); app.els.prev.onclick(); app.flip(); app.keydown("ArrowRight"); });
  assert.strictEqual(app.get("idx"), 0, "stepping must not move while unsupported");

  // The next working deck renders normally, with no residue of the message.
  const hijaz = decks(app).find((d) => d.id === "hijaz");
  app.select(hijaz.instanceId || hijaz.id);
  assert.ok(app.get("seq").chords);
  assert.ok(!app.els.front.innerHTML.includes("doesn"), "no residue of the unsupported-deck message");
});

test("an unsupported deck entered from mode A leaves no stale count once mode S is chosen", async () => {
  const app = boot({ random: () => 0 });
  const res = app.generate("(C3) G3 D4 G4 D5");
  assert.ok(res.ok);
  app.select(res.instanceId);
  assert.strictEqual(app.get("mode"), "A");
  assert.notStrictEqual(app.els.count.textContent, "", "mode A shows a count on this deck");
  app.run('setMode("S")');
  assert.strictEqual(app.get("seq").chords, null);
  assert.strictEqual(app.els.count.textContent, "", "mode A's count must not survive into mode S");
  assert.strictEqual(app.els.count.children.length, 0);
});

test("#count drops .seq when leaving mode S for mode B", async () => {
  const app = boot({ random: () => 0 });
  app.run('setMode("S")');
  assert.strictEqual(app.els.count.classList.contains("seq"), true, "mode S must mark #count .seq");
  app.run('setMode("B")');
  assert.strictEqual(app.els.count.classList.contains("seq"), false, "#count must drop .seq in mode B");
});

test("modes A and B render byte-identical DOM to the pre-lane base, for all three decks at idx 0 and 1", async () => {
  for (const deckId of ["hijaz", "pygmy", "amara"]) {
    for (const idx of [0, 1]) {
      const app = boot();
      app.select(deckId);
      if (idx === 1) app.els.next.onclick();
      for (const mode of ["A", "B"]) {
        app.run(`setMode("${mode}")`);
        const want = SEQ_BASE[deckId][idx][mode];
        assert.strictEqual(app.els.front.innerHTML, want.front, `${deckId} idx ${idx} mode ${mode} front changed`);
        assert.strictEqual(app.els.back.innerHTML, want.back, `${deckId} idx ${idx} mode ${mode} back changed`);
        assert.strictEqual(app.els.count.textContent, want.count, `${deckId} idx ${idx} mode ${mode} count changed`);
      }
    }
  }
});

test("mode S shows the style in the footer, never on the card", async () => {
  const app = boot({ random: () => 0 });
  app.run('setMode("S")');
  const STYLES = app.get("HPE.sequence.STYLES");
  const COPY = app.get("SEQ_STYLE_COPY");
  for (const s of STYLES) {
    app.run(`seq.style = ${JSON.stringify(s)}`);
    app.run("render()");
    assert.ok(!app.els.back.innerHTML.includes(COPY[s][0]),
      `back face must not carry the style name for ${s}`);
    assert.ok(!app.els.back.innerHTML.includes(COPY[s][1]),
      `back face must not carry the style tip for ${s}`);
    assert.strictEqual(app.els["seq-style"].hidden, false, `#seq-style must show for ${s}`);
    assert.strictEqual(app.els["seq-style-name"].textContent, COPY[s][0]);
    assert.strictEqual(app.els["seq-style-tip"].textContent, COPY[s][1]);
  }
  app.run('setMode("A")');
  assert.strictEqual(app.els["seq-style"].hidden, true, "#seq-style must hide outside mode S");
  assert.strictEqual(app.els.foot.classList.contains("seq"), false, "#foot must drop .seq outside mode S");
  app.run('setMode("S")');
  assert.strictEqual(app.els.foot.classList.contains("seq"), true, "#foot must carry .seq in mode S");

  // A stored mode "S" must boot straight into the shown state, with no
  // setMode call from the test - the boot path goes through setMode(mode)
  // itself (index.html's own bootstrap line).
  const again = boot({ storage: { hpfc: JSON.stringify({ mode: "S" }) } });
  assert.strictEqual(again.els["seq-style"].hidden, false, "a stored mode S must boot with #seq-style shown");
  assert.strictEqual(again.els.foot.classList.contains("seq"), true, "a stored mode S must boot with #foot.seq set");
});

test("the three-over-two style reads exactly \"3:2 polyrhythm\"", async () => {
  const app = boot({ random: () => 0 });
  const COPY = app.get("SEQ_STYLE_COPY");
  assert.strictEqual(COPY["three-over-two"][0], "3:2 polyrhythm");
  app.run('setMode("S")');
  app.run('seq.style = "three-over-two"');
  app.run("render()");
  assert.strictEqual(app.els["seq-style-name"].textContent, "3:2 polyrhythm");
  const html = require("node:fs").readFileSync(require("./helpers/sandbox.js").APP, "utf8");
  assert.ok(!html.includes("3 over 2"), 'index.html source must not contain "3 over 2"');
});

test("nothing on the card or in the footer credits Moritz.handpan; the menu link stays", async () => {
  const html = require("node:fs").readFileSync(require("./helpers/sandbox.js").APP, "utf8");
  assert.doesNotMatch(html, /Style from Moritz/i);
  const hrefMatch = html.match(/<a id="seq-source-link"[^>]*\bhref="([^"]+)"/);
  assert.ok(hrefMatch, "#seq-source-link must still exist with an href");

  const app = boot({ random: () => 0 });
  app.run('setMode("S")');
  assert.doesNotMatch(app.els.back.innerHTML, /Moritz/i);
  assert.doesNotMatch(app.els.front.innerHTML, /Moritz/i);
  assert.doesNotMatch(app.els["seq-style-name"].textContent, /Moritz/i);
  assert.doesNotMatch(app.els["seq-style-tip"].textContent, /Moritz/i);
  assert.doesNotMatch(app.els.count.textContent, /Moritz/i);
  assert.strictEqual(hrefMatch[1], "https://www.youtube.com/shorts/YcmgdgZTpHc",
    "#seq-source-link's href must be unchanged (N44)");
});

test("in mode S the re-roll control is an icon named \"New progression\", and leaving S restores Shuffle", async () => {
  const app = boot({ random: () => 0 });
  app.run('setMode("S")');
  assert.strictEqual(app.els.shuffle.getAttribute("aria-label"), "New progression");
  assert.match(app.els.shuffle.innerHTML, /^<svg[^>]*aria-hidden="true"/);
  assert.ok(app.els.shuffle.classList.contains("reroll"));
  app.run('setMode("A")');
  assert.strictEqual(app.els.shuffle.getAttribute("aria-label"), null,
    "leaving S must drop the aria-label");
  assert.strictEqual(app.els.shuffle.textContent, "Shuffle: off");
  assert.ok(!app.els.shuffle.classList.contains("reroll"));
});

test("an unsupported deck hides the style block and a working deck brings it back", async () => {
  const app = boot({ random: () => 0 });
  app.run('setMode("S")');
  const res = app.generate("(C3) G3 D4 G4 D5");
  assert.ok(res.ok);
  app.select(res.instanceId);
  assert.strictEqual(app.get("seq").chords, null);
  assert.strictEqual(app.els["seq-style"].hidden, true, "an unsupported deck must hide #seq-style");

  const hijaz = decks(app).find((d) => d.id === "hijaz");
  app.select(hijaz.instanceId || hijaz.id);
  assert.ok(app.get("seq").chords);
  assert.strictEqual(app.els["seq-style"].hidden, false, "a working deck must bring #seq-style back");
  const COPY = app.get("SEQ_STYLE_COPY");
  const curStyle = app.get("seq.style");
  assert.strictEqual(app.els["seq-style-name"].textContent, COPY[curStyle][0]);
});

describe("swipe decision", () => {
  test("swipeDecision commits strictly past SWIPE_COMMIT_PX, left = next", async () => {
    const app = boot();
    assert.strictEqual(app.get("SWIPE_COMMIT_PX"), 18);
    assert.strictEqual(app.get("swipeDecision(18,0,0)"), 0);
    assert.strictEqual(app.get("swipeDecision(18.5,0,0)"), -1);
    assert.strictEqual(app.get("swipeDecision(-18.5,0,0)"), 1);
    assert.strictEqual(app.get("swipeDecision(-15,0,0)"), 0);
  });

  test("swipeDecision flings past SWIPE_FLING_PX_MS only in the drag direction and past the slop", async () => {
    const app = boot();
    assert.strictEqual(app.get("swipeDecision(-15,0,-0.14)"), 0);
    assert.strictEqual(app.get("swipeDecision(-15,0,-0.16)"), 1);
    assert.strictEqual(app.get("swipeDecision(15,0,0.16)"), -1);
    assert.strictEqual(app.get("swipeDecision(-15,0,0.9)"), 0, "a reversed velocity must not commit");
    assert.strictEqual(app.get("swipeDecision(-10,0,-5)"), 0, "below the slop must not commit on velocity alone");
    assert.strictEqual(app.get("swipeDecision(-11,0,-5)"), 1);
  });

  test("swipeDecision never commits when the drag has travelled further vertically than horizontally", async () => {
    const app = boot();
    assert.strictEqual(app.get("swipeDecision(20,25,0.9)"), 0, "|dy| > |dx| must veto even a large dx/vx");
    assert.strictEqual(app.get("swipeDecision(20,19,0.9)"), -1, "|dy| <= |dx| still commits");
  });

  test("swipe constants are the plan's values", async () => {
    const app = boot();
    assert.strictEqual(app.get("SWIPE_FLING_PX_MS"), 0.15);
    assert.strictEqual(app.get("SWIPE_FLING_WINDOW_MS"), 100);
    assert.strictEqual(app.get("SWIPE_SLOP_PX"), 10);
    assert.strictEqual(app.get("SWIPE_TILT_DEG_PER_PX"), 0.05);
    assert.strictEqual(app.get("SWIPE_TILT_MAX_DEG"), 8);
    assert.strictEqual(app.get("SWIPE_OUT_MS"), 220);
    assert.strictEqual(app.get("SWIPE_BACK_MS"), 260);
    assert.strictEqual(app.get("SWIPE_IN_MS"), 180);
    assert.strictEqual(app.get("SWIPE_IN_PX"), 24);
    assert.strictEqual(app.get("SWIPE_MOMENTUM_MIN_MS"), 140);
    assert.strictEqual(app.get("SWIPE_MOMENTUM_MAX_MS"), 320);
    assert.strictEqual(app.get("SWIPE_MOMENTUM_FLOOR_PX_MS"), 1.5);
  });
});

// swipeOutTiming(vx, dir, dx, dist) -> { end, duration, easing }: the mouse
// momentum curve (docs/plans/2026-10-01-swipe-momentum.md, decision 2). A
// cubic-bezier's initial slope is y1/x1 (in progress-per-unit-time); over a
// span of (end - |dx|) px in `duration` ms that is a px/ms speed, which is
// what every case below checks against the release speed `v`.
describe("swipeOutTiming", () => {
  // Parses a recorded { end, duration, easing } triple and returns the
  // curve's own start speed in px/ms: (y1 / x1) * (end - |dx|) / duration.
  function start(t, dx) {
    const m = t.easing.match(/cubic-bezier\(([-\d.]+),\s*([-\d.]+)/);
    const x1 = parseFloat(m[1]), y1 = parseFloat(m[2]);
    return (y1 / x1) * (t.end - Math.abs(dx)) / t.duration;
  }

  test("swipeOutTiming: an unclamped release flies linearly at its own speed", async () => {
    const app = boot();
    const t = app.get("swipeOutTiming(-2, 1, -54, 654)");
    assert.strictEqual(t.end, 654);
    assert.strictEqual(t.duration, 300);
    const m = t.easing.match(/cubic-bezier\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)/);
    assert.strictEqual(m[1], m[2], "unclamped: x1 must equal y1 (a straight line)");
    assert.strictEqual(start(t, -54), 2);
  });

  test("swipeOutTiming: a fast flick clamps at SWIPE_MOMENTUM_MIN_MS and still starts at its release speed", async () => {
    const app = boot();
    const t = app.get("swipeOutTiming(-10, 1, -54, 654)");
    assert.strictEqual(t.duration, 140);
    assert.ok(Math.abs(start(t, -54) - 10) / 10 < 0.01, "start speed within 1% of 10");
    const m = t.easing.match(/cubic-bezier\(([-\d.]+),\s*([-\d.]+)/);
    assert.ok(parseFloat(m[2]) <= 1, "y1 must not overshoot past 1");
  });

  test("swipeOutTiming: a slow or zero-velocity release starts at the floor and clamps at SWIPE_MOMENTUM_MAX_MS", async () => {
    const app = boot();
    for (const [vx, dir, dx] of [[0, 1, -54], [-0.2, -1, 54]]) {
      const t = app.get(`swipeOutTiming(${vx}, ${dir}, ${dx}, 654)`);
      assert.strictEqual(t.duration, 320);
      assert.ok(Math.abs(start(t, dx) - 1.5) / 1.5 < 0.01, "start speed within 1% of the floor, 1.5");
    }
  });

  test("swipeOutTiming: a velocity against the flight direction counts as zero", async () => {
    const app = boot();
    for (const [vx, dir, dx] of [[3, 1, -54], [-3, -1, 54]]) {
      const t = app.get(`swipeOutTiming(${vx}, ${dir}, ${dx}, 654)`);
      assert.ok(Math.abs(start(t, dx) - 1.5) / 1.5 < 0.01,
        "a velocity pointed back up the drag must be floored, not used negative");
    }
  });

  test("swipeOutTiming: a card dragged past dist still flies forward", async () => {
    const app = boot();
    const t = app.get("swipeOutTiming(-3, 1, -900, 654)");
    assert.strictEqual(t.end, 1110, "end must grow past dist to keep the span forward");
    assert.ok(t.end > 900);
    assert.strictEqual(t.end - 900, 210);
    const v = start(t, -900);
    assert.ok(v > 0, "the start speed must stay positive, never a backward run to a clamped dist");
    assert.ok(Math.abs(v - 3) / 3 < 0.01);
  });

  test("swipeOutTiming: the curve stays monotone, in range and forward for every input", async () => {
    const app = boot();
    // Samples y(t) of a cubic bezier (P0=(0,0), P3=(1,1)) at 101 points in t
    // and asserts it never decreases - the derivative's quadratic has a
    // negative discriminant whenever y1 <= 1 and y2 == 2/3 (and, for k <= 1,
    // x1 == 1/3 so y1 == k/3 <= 1/3 <= 1 too), so every case below is covered
    // by the same argument, not just the y1 <= 1 branch of a fast flick.
    function monotoneY(x1, y1, x2, y2) {
      let prevY = -Infinity;
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const mt = 1 - t;
        const y = 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t;
        if (y < prevY - 1e-9) return false;
        prevY = y;
      }
      return true;
    }
    for (let vx = -12; vx <= 12; vx += 0.5) {
      for (const dir of [1, -1]) {
        for (const absDx of [0, 200, 654, 1200]) {
          const dx = dir < 0 ? absDx : -absDx;
          const t = app.get(`swipeOutTiming(${vx}, ${dir}, ${dx}, 654)`);
          assert.ok(t.duration >= 140 && t.duration <= 320,
            `duration out of range for vx=${vx} dir=${dir} dx=${dx}: ${t.duration}`);
          assert.ok(t.end - absDx >= 210 - 1e-9,
            `remaining span too small for vx=${vx} dir=${dir} dx=${dx}`);
          const m = t.easing.match(/cubic-bezier\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)/);
          const [x1, y1, x2, y2] = m.slice(1).map(Number);
          assert.ok(x1 > 0 && x1 <= 1, `x1 out of (0,1] for vx=${vx} dir=${dir} dx=${dx}: ${x1}`);
          assert.ok(y1 >= 0 && y1 <= 1, `y1 out of [0,1] for vx=${vx} dir=${dir} dx=${dx}: ${y1}`);
          assert.ok(monotoneY(x1, y1, x2, y2),
            `curve not monotone for vx=${vx} dir=${dir} dx=${dx}`);
        }
      }
    }
  });
});

/**
 * tests/fixtures/card_face_v1.json pins a sha256/16 digest of every FULL CARD
 * FACE's innerHTML (header + diagram + badge + note line + number line) for
 * every built-in deck x card x mode (A, B, S) x face (front, back), generated
 * from e8f9be8 (the quality-refactor plan's reference commit - see
 * tools/regen_card_fixture.js's header). The pre-existing pan_render_v1.json
 * above pins the diagram alone; a refactor to render() (finding 18) or to any
 * app helper (finding 13) could change the header, a note line, a number line
 * or a badge and that fixture would never see it. This test is that oracle.
 *
 * It shells out to the tool's own --check rather than re-deriving the walk
 * over decks/cards/modes/sequences here, so there is exactly one place (the
 * tool) that knows how to build a face digest - this test and `node
 * tools/regen_card_fixture.js --check` can never disagree about what "every
 * face" means.
 *
 * A failure here is not automatically a bug - a deliberate face change
 * regenerates the fixture (node tools/regen_card_fixture.js) IN THE SAME
 * COMMIT and says why in that commit's message / the PR body.
 */
test("every built-in card face still matches the committed digest of card_face_v1.json", async () => {
  const { execFileSync } = require("node:child_process");
  const path = require("node:path");
  const tool = path.join(__dirname, "..", "tools", "regen_card_fixture.js");
  try {
    execFileSync(process.execPath, [tool, "--check"], { stdio: "pipe" });
  } catch (e) {
    assert.fail(
      "card_face_v1.json is stale (or missing) - regenerate it on purpose with " +
      "`node tools/regen_card_fixture.js` only if this card face change is deliberate:\n" +
      (e.stdout ? e.stdout.toString() : "") + (e.stderr ? e.stderr.toString() : "")
    );
  }
});

/* ------------------------------------------------------------ panel fit judge
 * The acceptance oracle of docs/plans/2026-10-02-difficulty-d2-replan.md section
 * 4.3 / 4.3.1. These tests exercise the JUDGE only (pure functions over
 * synthetic cells); the browser measuring lives in tools/probe/panel_fit.js and
 * is run by the CLI and the `panel fit` CI job. Test names contain "panel fit"
 * so `--test-name-pattern panel.fit` selects exactly this group.
 */
describe("panel fit judge", () => {
  const pf = require("../tools/probe/panel_fit.js");

  const ctl = (bottom, over = {}) => ({ exists: true, rendered: true, disabled: false, bottom, ...over });
  const KEYS = ["modeA", "modeB", "modeS", "deck-add"];
  function cell(over = {}) {
    const controls = {};
    for (const k of KEYS) controls[k] = ctl(100);
    return {
      needed: 400, avail: 500, modal: true,
      overflowX: { panel: 0, doc: 0 },
      controls,
      stops: [{ key: "settings-trigger", disabled: false, rendered: true },
        ...KEYS.map((k) => ({ key: k, disabled: false, rendered: true }))],
      ...over,
    };
  }
  const withControl = (c, key, v) => ({ ...c, controls: { ...c.controls, [key]: v } });
  const ref = KEYS.slice();
  const judge = (b, c, extra = {}) => pf.judgeCell({ base: b, cand: c, refRendered: ref, ...extra });

  test("panel fit: identical cells produce no offender in any rule", async () => {
    const r = judge(cell(), cell());
    for (const k of ["rule1", "rule2", "rule3", "rule4", "rule5", "rule6"]) {
      assert.deepStrictEqual([r[k].fail, r[k].reported], [[], []], k);
    }
  });

  test("panel fit rule 1: needed height beyond max(base, avail) + 1 fails, within it passes", async () => {
    const b = cell({ needed: 520, avail: 500 });
    assert.strictEqual(judge(b, cell({ needed: 521, avail: 500 })).rule1.fail.length, 0, "equal to base + 1");
    assert.strictEqual(judge(b, cell({ needed: 521.5, avail: 500 })).rule1.fail.length, 1, "base + 1.5");
    const fits = cell({ needed: 400, avail: 500 });
    assert.strictEqual(judge(fits, cell({ needed: 501, avail: 500 })).rule1.fail.length, 0, "avail + 1");
    assert.strictEqual(judge(fits, cell({ needed: 502, avail: 500 })).rule1.fail.length, 1, "avail + 2");
  });

  test("panel fit rule 2: a control unrendered on the candidate fails, whether or not the base fits", async () => {
    const gone = withControl(cell(), "deck-add", ctl(100, { rendered: false }));
    assert.strictEqual(judge(cell(), gone).rule2.fail.length, 1);
    const baseOver = cell({ needed: 700, avail: 500 });
    assert.strictEqual(judge(baseOver, withControl(baseOver, "deck-add", ctl(100, { rendered: false }))).rule2.fail.length, 1);
  });

  test("panel fit rule 2: a control pushed below max(base bottom, avail) + 0.5 fails", async () => {
    const b = cell();
    assert.strictEqual(judge(b, withControl(b, "deck-add", ctl(500.5))).rule2.fail.length, 0, "at avail + 0.5");
    assert.strictEqual(judge(b, withControl(b, "deck-add", ctl(500.6))).rule2.fail.length, 1, "past avail + 0.5");
    const low = withControl(cell(), "deck-add", ctl(900));
    assert.strictEqual(judge(low, withControl(low, "deck-add", ctl(900.4))).rule2.fail.length, 0, "base was already lower than avail");
  });

  test("panel fit rule 2: where the base itself overflows the offender is reported or failed by the OD-8 constant alone", async () => {
    const b = withControl(cell({ needed: 700, avail: 500 }), "deck-add", ctl(600));
    const c = withControl(b, "deck-add", ctl(650));
    const strict = judge(b, c, { od8FailBaseOverflow: true });
    const lax = judge(b, c, { od8FailBaseOverflow: false });
    assert.deepStrictEqual([strict.rule2.fail.length, strict.rule2.reported.length], [1, 0], "OD-8 = fail");
    assert.deepStrictEqual([lax.rule2.fail.length, lax.rule2.reported.length], [0, 1], "OD-8 = report");
  });

  test("panel fit rule 2: the OD-8 constant ships as report (owner answer 2026-10-03)", async () => {
    assert.strictEqual(pf.OD8_FAIL_BASE_OVERFLOW, false);
  });

  test("panel fit rule 2: a control the base renders and the candidate lacks fails unless it is removed by design", async () => {
    const lacks = (key) => {
      const c = cell();
      delete c.controls[key];
      return c;
    };
    assert.strictEqual(judge(cell(), lacks("deck-add")).rule2.fail.length, 1, "deleted by accident");
    const baseOver = cell({ needed: 700, avail: 500 });
    const candOver = cell({ needed: 700, avail: 500 });
    delete candOver.controls["deck-add"];
    assert.strictEqual(judge(baseOver, candOver).rule2.fail.length, 1, "a base that overflows does not excuse it");
    assert.strictEqual(judge(cell(), withControl(cell(), "deck-add", { exists: false, rendered: false, disabled: false, bottom: 0 })).rule2.fail.length, 1, "exists:false counts as lacking");
    assert.deepStrictEqual([...pf.REMOVED_BY_DESIGN].sort(), ["button:CHORD-ONLY PDF", "button:FULL DECK PDF", "modeS", "print-paper-select", "res-amy-bottom", "res-amy-progressions", "res-dingandtones", "res-handpan-helpers", "res-handpaner", "res-trainingcards", "share-copy"], "the removed-by-design list is exactly the eleven known ids");
    assert.ok(!pf.REMOVED_BY_DESIGN.includes("button:DOWNLOAD PDF"), "a lost DOWNLOAD PDF is not removed by design");
    const noS = judge(cell(), lacks("modeS"));
    assert.strictEqual(noS.rule2.fail.length, 0, "modeS is removed by design");
    assert.strictEqual(noS.rule2.reported.length, 0);
    assert.deepStrictEqual(noS.removed, ["modeS"], "removal is listed so the report can name it");
    const withFull = withControl(withControl(cell(), "button:FULL DECK PDF", ctl(100)), "button:CHORD-ONLY PDF", ctl(100));
    const noFull = judge(withFull, cell());
    assert.strictEqual(noFull.rule2.fail.length, 0, "the full-deck button is removed by design");
    assert.deepStrictEqual(noFull.removed, ["button:FULL DECK PDF", "button:CHORD-ONLY PDF"]);
    const withPaper = withControl(cell(), "print-paper", ctl(100));
    assert.strictEqual(judge(withPaper, cell()).rule2.fail.length, 1, "the paper select is not removed by design");
    assert.deepStrictEqual(judge(cell(), cell()).removed, []);
  });

  test("panel fit rule 3: a candidate-only control below the fold fails where the base fits, is reported where it does not", async () => {
    const b = cell();
    const c = withControl(cell(), "tier-select", ctl(600));
    const fit = judge(b, c);
    assert.strictEqual(fit.rule3.fail.length, 1);
    const bOver = cell({ needed: 800, avail: 500 });
    const over = judge(bOver, withControl(bOver, "tier-select", ctl(600)));
    assert.deepStrictEqual([over.rule3.fail.length, over.rule3.reported.length], [0, 1]);
    assert.strictEqual(judge(b, withControl(cell(), "tier-select", ctl(500.4))).rule3.fail.length, 0, "inside avail + 0.5");
  });

  test("panel fit rule 3: a candidate-only control is not also charged to rule 2", async () => {
    const r = judge(cell(), withControl(cell(), "tier-select", ctl(600)));
    assert.strictEqual(r.rule2.fail.length, 0);
  });

  test("panel fit rule 4: more horizontal overflow on the candidate fails, on the panel or on the document", async () => {
    assert.strictEqual(judge(cell(), cell({ overflowX: { panel: 1, doc: 0 } })).rule4.fail.length, 1);
    assert.strictEqual(judge(cell(), cell({ overflowX: { panel: 0, doc: 3 } })).rule4.fail.length, 1);
    const b = cell({ overflowX: { panel: 4, doc: 4 } });
    assert.strictEqual(judge(b, cell({ overflowX: { panel: 4, doc: 2 } })).rule4.fail.length, 0, "no worse than base");
  });

  test("panel fit rule 5: the rendered set must equal the reference cell's set for the mode", async () => {
    const hidden = withControl(cell(), "modeS", ctl(100, { rendered: false }));
    assert.strictEqual(judge(cell(), hidden).rule5.fail.length, 1, "one control unrendered");
    const extra = withControl(cell(), "tier-select", ctl(100));
    assert.strictEqual(judge(cell(), extra).rule5.fail.length, 1, "one control that the reference does not render");
    assert.strictEqual(judge(cell(), cell()).rule5.fail.length, 0);
  });

  test("panel fit rule 5: a control that does not exist on the candidate is not counted as rendered", async () => {
    const gone = withControl(cell(), "deck-add", { exists: false, rendered: false, disabled: false, bottom: 0 });
    assert.strictEqual(judge(cell(), gone).rule5.fail.length, 1);
  });

  test("panel fit rule 6: a stop that is disabled or has no client rects fails", async () => {
    const c1 = cell({ stops: [...cell().stops, { key: "seq-source-link", disabled: false, rendered: false }] });
    assert.strictEqual(judge(cell(), c1).rule6.fail.length, 1, "unrendered stop");
    const c2 = cell({ stops: [...cell().stops, { key: "tier-select", disabled: true, rendered: true }] });
    assert.strictEqual(judge(cell(), c2).rule6.fail.length, 1, "disabled stop");
  });

  test("panel fit rule 6: a rendered enabled control missing from the stop list fails, and a disabled one need not be listed", async () => {
    const missing = cell({ stops: cell().stops.filter((s) => s.key !== "deck-add") });
    assert.strictEqual(judge(cell(), missing).rule6.fail.length, 1);
    const dis = withControl(cell(), "modeB", ctl(100, { disabled: true }));
    const stops = cell().stops.filter((s) => s.key !== "modeB");
    assert.strictEqual(judge(cell(), { ...dis, stops }).rule6.fail.length, 0);
  });

  test("panel fit rule 6: the trigger is owed in the modal and unrendered in the sidebar", async () => {
    const noTrigger = cell({ stops: cell().stops.filter((s) => s.key !== "settings-trigger") });
    assert.strictEqual(judge(cell(), noTrigger).rule6.fail.length, 1, "modal omits the trigger");
    const side = cell({ modal: false, stops: noTrigger.stops });
    assert.strictEqual(judge(cell(), side).rule6.fail.length, 0, "sidebar without the trigger is correct");
    const sideListed = cell({ modal: false, stops: [{ key: "settings-trigger", disabled: false, rendered: false }, ...noTrigger.stops] });
    assert.strictEqual(judge(cell(), sideListed).rule6.fail.length, 1, "sidebar listing the unrendered trigger fails");
  });

  test("panel fit rule 6 is judged on the candidate only", async () => {
    const bad = cell({ stops: [...cell().stops, { key: "seq-source-link", disabled: false, rendered: false }] });
    assert.strictEqual(judge(bad, cell()).rule6.fail.length, 0);
  });

  test("panel fit font mode: real needs five loaded faces, fallback needs none", async () => {
    const loaded = (n) => ({ size: n, faces: Array.from({ length: n }, () => ({ status: "loaded" })) });
    assert.doesNotThrow(() => pf.checkFontMode("fallback", loaded(0)));
    assert.throws(() => pf.checkFontMode("fallback", loaded(5)), /fallback.*5/i);
    assert.throws(() => pf.checkFontMode("real", loaded(0)), /real.*0/i);
    assert.throws(() => pf.checkFontMode("real", { size: 5, faces: [...loaded(4).faces, { status: "unloaded" }] }), /unloaded/);
    assert.throws(() => pf.checkFontMode("sideways", loaded(0)), /font mode/i);
  });

  test("panel fit font mode: real faces must be the five files in tools/fonts", async () => {
    const want = [["Marcellus", "400"], ["Bitter", "400"], ["Bitter", "700"], ["Nunito Sans", "400"], ["Nunito Sans", "600"]];
    const mk = (list) => ({ size: list.length, faces: list.map(([family, weight]) => ({ family, weight, status: "loaded" })) });
    assert.doesNotThrow(() => pf.checkFontMode("real", mk(want)));
    const wrong = want.map((w, i) => (i === 4 ? ["Nunito Sans", "700"] : w));
    assert.throws(() => pf.checkFontMode("real", mk(wrong)), /Nunito Sans/);
  });

  test("panel fit grammar: accepts the forms the stylesheet uses and types the edges", async () => {
    const p = pf.parseCondition("screen and (min-width: 640px) and (min-height: 700px)");
    assert.deepStrictEqual(p.queries, [[{ axis: "width", min: true, px: 640 }, { axis: "height", min: true, px: 700 }]]);
    assert.deepStrictEqual(pf.parseCondition("(max-height: 520px)").queries, [[{ axis: "height", min: false, px: 520 }]]);
    assert.deepStrictEqual(pf.parseCondition("(max-width: 600px), (max-height: 300px)").queries.length, 2);
  });

  test("panel fit grammar: min-X: N starts a band at N, max-X: N at N + 1", async () => {
    const edges = pf.edgeStarts([
      pf.parseCondition("(min-width: 640px) and (min-height: 700px)"),
      pf.parseCondition("(max-height: 520px)"),
    ]);
    assert.deepStrictEqual(edges, { width: [640], height: [521, 700] });
  });

  test("panel fit grammar: bands cut the domain at the typed edges", async () => {
    assert.deepStrictEqual(pf.bands([521, 700], 320, 1100), [[320, 520], [521, 699], [700, 1100]]);
    assert.deepStrictEqual(pf.bands([], 320, 1100), [[320, 1100]]);
    assert.deepStrictEqual(pf.bands([320, 2000], 320, 1100), [[320, 1100]], "edges outside the open interval cut nothing");
  });

  test("panel fit grammar: rejects range syntax, relative units, orientation and anything unparsed", async () => {
    for (const bad of ["(width >= 640px)", "(max-height: 30em)", "(orientation: landscape)",
      "(min-aspect-ratio: 1/1)", "(min-resolution: 2dppx)", "(max-width: calc(600px + 1px))",
      "(max-width: 600.5px)", "(min-width: 640px) or (min-height: 700px)", "not all and (max-width: 600px)",
      "(min-width: 640px) and (hover: hover)"]) {
      assert.throws(() => pf.parseCondition(bad), /unsupported|cannot|grammar/i, bad);
    }
  });

  test("panel fit grammar: print is kept out of the edge list, and a purely non-dimensional condition is reported, not swept", async () => {
    assert.deepStrictEqual(pf.parseCondition("print"), { print: true, text: "print" });
    assert.deepStrictEqual(pf.parseCondition("(prefers-reduced-motion: reduce)"),
      { other: true, text: "(prefers-reduced-motion: reduce)" });
    assert.deepStrictEqual(pf.edgeStarts([pf.parseCondition("print")]), { width: [], height: [] });
  });

  test("panel fit walk: a sheet is skipped only when it is cross-origin and unreadable", async () => {
    const boom = () => { throw Object.assign(new Error("denied"), { name: "SecurityError" }); };
    assert.strictEqual(pf.sheetDisposition({ href: "https://fonts.googleapis.com/css2", rules: boom }, "http://127.0.0.1:1/index.html"), "skip");
    assert.throws(() => pf.sheetDisposition({ href: null, rules: boom }, "http://127.0.0.1:1/index.html"), /inline|same-origin|SecurityError/i);
    assert.throws(() => pf.sheetDisposition({ href: "http://127.0.0.1:1/x.css", rules: boom }, "http://127.0.0.1:1/index.html"), /SecurityError/);
    assert.strictEqual(pf.sheetDisposition({ href: null, rules: () => [] }, "http://127.0.0.1:1/index.html"), "read");
  });

  test("panel fit walk: an at-rule the oracle has no model for exits non-zero", async () => {
    assert.throws(() => pf.checkRuleKind("CSSContainerRule", true), /container/i);
    assert.throws(() => pf.checkRuleKind("CSSSupportsRule", true), /supports/i);
    assert.doesNotThrow(() => pf.checkRuleKind("CSSSupportsRule", false));
    assert.doesNotThrow(() => pf.checkRuleKind("CSSMediaRule", true));
  });

  test("panel fit invariance: the whole measurement vector must match, not needed alone", async () => {
    const v = (over = {}) => ({ needed: 400, overflowX: { panel: 0, doc: 0 }, rendered: ["a", "b"], bottoms: { a: 10, b: 20 }, ...over });
    assert.strictEqual(pf.vectorsEqual(v(), v({ needed: 400.4 })), true);
    assert.strictEqual(pf.vectorsEqual(v(), v({ needed: 401 })), false);
    assert.strictEqual(pf.vectorsEqual(v(), v({ bottoms: { a: 10, b: 21 } })), false, "a control moved while the total did not");
    assert.strictEqual(pf.vectorsEqual(v(), v({ rendered: ["a"] })), false);
    assert.strictEqual(pf.vectorsEqual(v(), v({ overflowX: { panel: 2, doc: 0 } })), false);
  });

  test("panel fit report: a run with skipped cells or an unreadable base is a failure of the run itself", async () => {
    assert.throws(() => pf.assertRunComplete({ skipped: 1, skipReasons: ["x"] }), /skipped/i);
    assert.doesNotThrow(() => pf.assertRunComplete({ skipped: 0, skipReasons: [] }));
  });

  test("panel fit: the heading allowance is 24", async () => {
    assert.strictEqual(pf.HEADING_ALLOWANCE_PX, 24);
    assert.strictEqual(pf.headingAllowance(false, true), 24, "base lacks the heading, candidate has it");
    assert.strictEqual(pf.headingAllowance(false, false), 0, "neither has it");
    assert.strictEqual(pf.headingAllowance(true, true), 0, "both have it: the allowance expires once main has the heading");
    assert.strictEqual(pf.headingAllowance(true, false), 0, "only the base has it");
  });

  test("panel fit rule 1: with the heading allowance a candidate up to 24px over a fitting base passes, and beyond it fails", async () => {
    const b = cell({ needed: 500, avail: 500 });
    const withA = (c) => judge(b, c, { allowance: 24 }).rule1.fail.length;
    assert.strictEqual(withA(cell({ needed: 525, avail: 500 })), 0, "base + 24 + the 1px tolerance");
    assert.strictEqual(withA(cell({ needed: 526, avail: 500 })), 1, "one pixel beyond the tolerance");
    assert.strictEqual(withA(cell({ needed: 526, avail: 530 })), 0, "a candidate that fits is unconstrained");
    assert.strictEqual(judge(b, cell({ needed: 524, avail: 500 })).rule1.fail.length, 1, "no allowance by default");
  });

  test("panel fit rule 2: controls after the second heading may sit one allowance lower, modeA and modeB may not", async () => {
    const b = withControl(withControl(cell(), "deck-add", ctl(500)), "modeA", ctl(500));
    const push = (key, bottom) => judge(b, withControl(b, key, ctl(bottom)), { allowance: 24 }).rule2.fail.length;
    assert.strictEqual(push("deck-add", 524.5), 0, "base bottom + 24 + the 0.5 tolerance");
    assert.strictEqual(push("deck-add", 524.6), 1, "past it");
    assert.strictEqual(push("modeA", 500.5), 0, "modeA stays where main has it, plus the tolerance");
    assert.strictEqual(push("modeA", 500.6), 1, "modeA gets no allowance");
    assert.strictEqual(push("modeB", 500.5), 0, "modeB: max(base bottom, avail) + the tolerance");
    assert.strictEqual(push("modeB", 500.6), 1, "modeB gets no allowance either");
    assert.deepStrictEqual(pf.ALLOWANCE_EXEMPT, ["modeA", "modeB"]);
  });

  test("panel fit rule 3 takes no heading allowance", async () => {
    const b = cell();
    const c = (bottom) => withControl(cell(), "tier-basic", ctl(bottom));
    assert.strictEqual(judge(b, c(500.5), { allowance: 24 }).rule3.fail.length, 0, "inside avail + 0.5");
    assert.strictEqual(judge(b, c(500.6), { allowance: 24 }).rule3.fail.length, 1, "past it, with the allowance on");
  });

  test("panel fit: the Resources allowance is 64, owed only for a res- control the base lacks", async () => {
    assert.strictEqual(pf.RES_ALLOWANCE_PX, 64);
    const keys = (...k) => Object.fromEntries(k.map((x) => [x, ctl(100)]));
    assert.strictEqual(pf.resAllowance(keys("res-a"), keys("res-a", "res-amy-bottom")), 64, "a new res- key");
    assert.strictEqual(pf.resAllowance(keys("res-a"), keys("res-a")), 0, "no new key");
    assert.strictEqual(pf.resAllowance(keys("res-a"), keys("res-a", "deck-add2")), 0, "a new control outside Resources earns nothing");
    assert.strictEqual(pf.resAllowance(keys("res-amy-bottom"), keys("res-amy-bottom")), 0, "the allowance expires once main has the row");
  });

    test("panel fit rule 1: a new res- control earns the Resources allowance and nothing else does", async () => {
    const b = cell({ needed: 500, avail: 500 });
    const withRes = (needed) => judge(b, withControl(cell({ needed, avail: 500 }), "res-amy-bottom", ctl(400))).rule1.fail.length;
    assert.strictEqual(withRes(565), 0, "base + 64 + the 1px tolerance");
    assert.strictEqual(withRes(566), 1, "one pixel beyond");
    assert.strictEqual(judge(b, withControl(cell({ needed: 520, avail: 500 }), "tier-basic", ctl(400))).rule1.fail.length, 1, "a new non-res control earns no allowance");
    assert.strictEqual(judge(b, cell({ needed: 520, avail: 500 })).rule1.fail.length, 1, "no new control at all");
  });

  test("panel fit rule 3: a new res- control may sit below avail within the Resources allowance, any other new control may not", async () => {
    const b = cell({ needed: 500, avail: 500 });
    const res = (bottom) => judge(b, withControl(cell({ needed: 560, avail: 500 }), "res-amy-bottom", ctl(bottom))).rule3.fail.length;
    assert.strictEqual(res(500.5), 0, "inside avail");
    assert.strictEqual(res(560), 0, "below avail, inside the allowance");
    assert.strictEqual(res(564.5), 0, "base needed + 64 + the 0.5 tolerance");
    assert.strictEqual(res(564.6), 1, "past the allowance");
    assert.strictEqual(judge(b, withControl(cell({ needed: 560, avail: 500 }), "tier-basic", ctl(501))).rule3.fail.length, 1, "a non-res new control below avail still fails");
    const both = withControl(withControl(cell({ needed: 560, avail: 500 }), "res-amy-bottom", ctl(540)), "tier-basic", ctl(540));
    assert.strictEqual(judge(b, both).rule3.fail.length, 1, "with a res- control present, the non-res one is still judged exactly");
  });

  test("panel fit rule 2: the Resources allowance does not move any existing control", async () => {
    const b = withControl(cell(), "deck-add", ctl(500));
    const c = (bottom) => withControl(withControl(cell(), "res-amy-bottom", ctl(400)), "deck-add", ctl(bottom));
    assert.strictEqual(judge(b, c(500.5)).rule2.fail.length, 0);
    assert.strictEqual(judge(b, c(500.6)).rule2.fail.length, 1, "deck-add gets no Resources allowance");
    assert.strictEqual(judge(b, c(540)).rule2.fail.length, 1);
  });

  test("panel fit: the About-row allowance is 52, owed only for an about-open control the base lacks", async () => {
    assert.strictEqual(pf.ABOUT_ALLOWANCE_PX, 52);
    const keys = (...k) => Object.fromEntries(k.map((x) => [x, ctl(100)]));
    assert.strictEqual(pf.aboutAllowance(keys("res-a"), keys("res-a", "about-open")), 52, "a new about-open key");
    assert.strictEqual(pf.aboutAllowance(keys("res-a"), keys("res-a")), 0, "no new key");
    assert.strictEqual(pf.aboutAllowance(keys("res-a"), keys("res-a", "res-b", "deck-add2")), 0, "other new controls earn nothing");
    assert.strictEqual(pf.aboutAllowance(keys("about-open"), keys("about-open")), 0, "the allowance expires once main has the row");
  });

  test("panel fit: the LS allowance is 320, owed to mode S at 740px wide and up and 300 to 359px tall only", async () => {
    assert.strictEqual(pf.LS_S_ALLOWANCE_PX, 320);
    assert.strictEqual(pf.lsAllowance(852, 330, "S"), 320);
    assert.strictEqual(pf.lsAllowance(740, 300, "S"), 320);
    assert.strictEqual(pf.lsAllowance(932, 359, "S"), 320);
    assert.strictEqual(pf.lsAllowance(852, 330, "A"), 0, "modes A and B fit two columns");
    assert.strictEqual(pf.lsAllowance(739, 330, "S"), 0, "narrower than 740");
    assert.strictEqual(pf.lsAllowance(852, 299, "S"), 0, "shorter than 300");
    assert.strictEqual(pf.lsAllowance(852, 360, "S"), 0, "360 and up keeps the LE block");
  });

  test("panel fit rule 1 and rule 3: a new about-open earns the About-row allowance and nothing else does", async () => {
    const b = cell({ needed: 500, avail: 500 });
    const withAbout = (needed) => judge(b, withControl(cell({ needed, avail: 500 }), "about-open", ctl(400))).rule1.fail.length;
    assert.strictEqual(withAbout(553), 0, "base + 52 + the 1px tolerance");
    assert.strictEqual(withAbout(554), 1, "one pixel beyond");
    assert.strictEqual(judge(b, withControl(cell({ needed: 520, avail: 500 }), "tier-basic", ctl(400))).rule1.fail.length, 1, "a new non-about control earns no allowance");
    assert.strictEqual(judge(b, cell({ needed: 520, avail: 500 })).rule1.fail.length, 1, "no new control at all");
    const about = (bottom) => judge(b, withControl(cell({ needed: 550, avail: 500 }), "about-open", ctl(bottom))).rule3.fail.length;
    assert.strictEqual(about(500.5), 0, "inside avail");
    assert.strictEqual(about(550), 0, "below avail, inside the allowance");
    assert.strictEqual(about(552.5), 0, "base needed + 52 + the 0.5 tolerance");
    assert.strictEqual(about(552.6), 1, "past the allowance");
    assert.strictEqual(judge(b, withControl(cell({ needed: 550, avail: 500 }), "tier-basic", ctl(501))).rule3.fail.length, 1, "a non-about new control below avail still fails");
    const both = withControl(withControl(cell({ needed: 550, avail: 500 }), "about-open", ctl(540)), "tier-basic", ctl(540));
    assert.strictEqual(judge(b, both).rule3.fail.length, 1, "with about-open present, the other new control is still judged exactly");
  });

  test("panel fit rule 2: the About-row allowance does not move any existing control", async () => {
    const b = withControl(cell(), "deck-add", ctl(500));
    const c = (bottom) => withControl(withControl(cell(), "about-open", ctl(400)), "deck-add", ctl(bottom));
    assert.strictEqual(judge(b, c(500.5)).rule2.fail.length, 0);
    assert.strictEqual(judge(b, c(500.6)).rule2.fail.length, 1, "deck-add gets no About-row allowance");
    assert.strictEqual(judge(b, c(540)).rule2.fail.length, 1);
  });

  test("panel fit: the backup-row allowance is 52, owed only for a backup-open control the base lacks", async () => {
    assert.strictEqual(pf.BACKUP_ALLOWANCE_PX, 52);
    const keys = (...k) => Object.fromEntries(k.map((x) => [x, ctl(100)]));
    assert.strictEqual(pf.backupAllowance(keys("res-a"), keys("res-a", "backup-open")), 52, "a new backup-open key");
    assert.strictEqual(pf.backupAllowance(keys("res-a"), keys("res-a")), 0, "no new key");
    assert.strictEqual(pf.backupAllowance(keys("backup-open"), keys("backup-open")), 0, "expires once main has the row");
  });

  test("panel fit: the Language-group allowance is 88, owed only for a lang-select control the base lacks", async () => {
    assert.strictEqual(pf.LANG_ALLOWANCE_PX, 88);
    const keys = (...k) => Object.fromEntries(k.map((x) => [x, ctl(100)]));
    assert.strictEqual(pf.langAllowance(keys("res-a"), keys("res-a", "lang-select")), 88, "a new lang-select key");
    assert.strictEqual(pf.langAllowance(keys("res-a"), keys("res-a")), 0, "no new key");
    assert.strictEqual(pf.langAllowance(keys("res-a"), keys("res-a", "about-open", "res-b")), 0, "other new controls earn nothing");
    assert.strictEqual(pf.langAllowance(keys("lang-select"), keys("lang-select")), 0, "the allowance expires once main has the select");
    const b = cell({ needed: 500, avail: 500 });
    const withLang = (needed) => judge(b, withControl(cell({ needed, avail: 500 }), "lang-select", ctl(400))).rule1.fail.length;
    assert.strictEqual(withLang(589), 0, "base + 88 + the 1px tolerance");
    assert.strictEqual(withLang(590), 1, "one pixel beyond");
    const lang = (bottom) => judge(b, withControl(cell({ needed: 550, avail: 500 }), "lang-select", ctl(bottom))).rule3.fail.length;
    assert.strictEqual(lang(588.5), 0, "base needed + 88 + the 0.5 tolerance");
    assert.strictEqual(lang(588.6), 1, "past the allowance");
    const move = withControl(withControl(cell(), "lang-select", ctl(400)), "deck-add", ctl(540));
    assert.strictEqual(judge(withControl(cell(), "deck-add", ctl(500)), move).rule2.fail.length, 1, "no existing control moves");
  });

  test("panel fit: --absolute parses as a flag, defaults off, and takes no value", () => {
    assert.strictEqual(pf.parseArgs([]).absolute, false);
    const o = pf.parseArgs(["--absolute", "--font", "both"]);
    assert.strictEqual(o.absolute, true);
    assert.strictEqual(o.font, "both");
    assert.throws(() => pf.parseArgs(["--absolute", "yes"]), /unknown argument yes/);
  });

  test("panel fit: the editor cell covers the eight UI languages at 375 and 320", () => {
    assert.deepStrictEqual(pf.EDITOR_LANGS.slice().sort(), ["de", "en", "es", "fr", "it", "ja", "zh-Hans", "zh-Hant"]);
    assert.deepStrictEqual(pf.EDITOR_CELLS.map((c) => c[0]).sort(), [320, 375]);
  });

  test("panel fit: judgeEditorCell asserts targets, octave wrap, counts size, overflow, clipping and contrast", () => {
    const ok = () => ({
      overflowDoc: 0, overflowEditor: 0, clipped: [], octWrap: false, countsPx: 13, panelDelta: 0,
      targets: [{ id: "editor-save", w: 120, h: 44 }, { id: "tray-note C", w: 44, h: 44 }],
      contrast: [{ pair: "save", ratio: 5.3 }, { pair: "counts", ratio: 7 }],
    });
    assert.deepStrictEqual(pf.judgeEditorCell(ok(), "de", 320), []);
    const bad = (over) => pf.judgeEditorCell({ ...ok(), ...over }, "de", 320);
    assert.match(bad({ overflowDoc: 3 })[0], /horizontal overflow/);
    assert.match(bad({ overflowEditor: 1 })[0], /horizontal overflow/);
    assert.match(bad({ clipped: ["editor-flats"] })[0], /clipped.*editor-flats/);
    assert.match(bad({ octWrap: true })[0], /octave row wraps/);
    assert.deepStrictEqual(pf.judgeEditorCell({ ...ok(), octWrap: true }, "en", 320), [], "the wrap rule names de and ja at 320 only");
    assert.deepStrictEqual(pf.judgeEditorCell({ ...ok(), octWrap: true }, "de", 375), []);
    assert.match(bad({ countsPx: 11.9 })[0], /counts text/);
    assert.match(bad({ panelDelta: 24 })[0], /tab switch.*24/);
    assert.match(bad({ targets: [{ id: "editor-more", w: 43.4, h: 44 }] })[0], /editor-more.*43\.4/);
    assert.deepStrictEqual(bad({ targets: [{ id: "x", w: 43.6, h: 44 }] }), [], "0.5px tolerance");
    assert.match(bad({ contrast: [{ pair: "save", ratio: 4.4 }] })[0], /contrast save/);
  });

  test("panel fit: --lang seeds the candidate's stored language and asserts the resolved lang", async () => {
    assert.strictEqual(pf.parseArgs(["--lang", "de"]).lang, "de");
    assert.strictEqual(pf.parseArgs([]).lang, null);
    const fake = (resolved) => {
      const calls = [];
      return { calls, send: async () => {}, setViewport: async () => {}, goto: async (u) => { calls.push(["goto", u]); },
        eval: async (src) => { calls.push(["eval", src]); return /documentElement\.lang/.test(src) ? resolved : true; } };
    };
    const ok = fake("de");
    await pf.prepareBrowser(ok, "http://x/", "de");
    assert.ok(ok.calls.some(([k, v]) => k === "eval" && /localStorage\.setItem\("hpfc".*"de"/.test(v)), "no stored language");
    await assert.rejects(pf.prepareBrowser(fake("en"), "http://x/", "de"), (e) => e instanceof pf.PanelFitError && /resolved "en"/.test(e.message));
    const plain = fake("en");
    await pf.prepareBrowser(plain, "http://x/");
    assert.ok(!plain.calls.some(([k, v]) => k === "eval" && /localStorage/.test(v)), "the base is seeded");
  });

  test("panel fit: the threshold cell is the lowest height in the band where the base fits", async () => {
    const b = cell({ needed: 373.8, avail: 320 });
    const c = cell({ needed: 395.8, avail: 320, overflowX: { panel: 0, doc: 0 } });
    const t = pf.thresholdCell(b, c, 320, 520);
    assert.strictEqual(t.base.avail, 373, "the first integer with needed <= avail + 1");
    assert.strictEqual(t.cand.avail, 373, "the candidate is raised by the same amount");
    assert.strictEqual(t.height, 373);
    assert.strictEqual(t.base.needed, 373.8, "nothing else moves");
    assert.strictEqual(pf.thresholdCell(cell({ needed: 300, avail: 320 }), c, 320, 520), null, "the base fits at the band's lowest height");
    assert.strictEqual(pf.thresholdCell(cell({ needed: 900, avail: 320 }), c, 320, 520), null, "the base fits nowhere in the band");
    assert.strictEqual(pf.thresholdCell(cell({ needed: 840.9, avail: 320 }), c, 320, 520), null, "the threshold is past the band's top");
  });

  test("panel fit: viewports where the candidate overflows and the base fits are counted per row, from the threshold", async () => {
    const b = cell({ needed: 373.8, avail: 320 });
    const c = cell({ needed: 395.8, avail: 320 });
    const o = pf.overflowViewports(b, c, 320, 520);
    assert.strictEqual(o.count, 22, "heights 373..394");
    assert.strictEqual(o.height, 373);
    assert.ok(Math.abs(o.scroll - 22.8) < 1e-9, "needed - avail at the threshold");
    assert.deepStrictEqual(pf.overflowViewports(cell({ needed: 300, avail: 320 }), cell({ needed: 300, avail: 320 }), 320, 520), { count: 0, height: null, scroll: 0 });
    assert.strictEqual(pf.overflowViewports(cell({ needed: 300, avail: 320 }), cell({ needed: 330, avail: 320 }), 320, 520).count, 9, "base fits at the band's lowest height: 320..328");
  });

  test("panel fit: a run that measured any cell with a scrollbar gutter fails", async () => {
    const run = (over = {}) => {
      const rules = {};
      for (const k of ["rule1", "rule2", "rule3", "rule4", "rule5", "rule6"]) rules[k] = { fail: 0, reported: 0 };
      return { rules, invarianceFailureCount: 0, gutterCells: 0, ...over };
    };
    assert.strictEqual(pf.failed(run()), false);
    assert.strictEqual(pf.failed(run({ gutterCells: 1 })), true);
    assert.match(pf.gutterMessage(352, 320, "A", 15), /scrollbar takes layout space at 352x320 mode A \(15 px\): the measurement environment is not neutral/);
  });

  test("panel fit: a run with invariance failures and every rule at 0 fails", async () => {
    const rules = {};
    for (const k of ["rule1", "rule2", "rule3", "rule4", "rule5", "rule6"]) rules[k] = { fail: 0, reported: 0 };
    assert.strictEqual(pf.failed({ rules, invarianceFailureCount: 0, gutterCells: 0 }), false);
    assert.strictEqual(pf.failed({ rules, invarianceFailureCount: 1, gutterCells: 0 }), true);
  });

  test("PF-1 tallyJudgement adds fails and reported and keeps the first ten messages", async () => {
    const fails = Array.from({ length: 12 }, (_, i) => ({ cell: `c${i}`, msg: `m${i}` }));
    const reported = [{ cell: "r0", msg: "x0" }, { cell: "r1", msg: "x1" }];
    const j = { a: { fail: fails, reported } };
    const fresh = () => ({ rules: { a: { fail: 0, reported: 0, first: [], firstReported: [] } } });
    const report = fresh();
    pf.tallyJudgement(report, j, ["a"], true);
    assert.strictEqual(report.rules.a.fail, 12);
    assert.strictEqual(report.rules.a.reported, 2);
    assert.strictEqual(report.rules.a.first.length, 10);
    assert.strictEqual(report.rules.a.first[0], "c0: m0");
    assert.deepStrictEqual(report.rules.a.firstReported, ["r0: x0", "r1: x1"]);
    pf.tallyJudgement(report, j, ["a"], true);
    assert.strictEqual(report.rules.a.fail, 24);
    assert.strictEqual(report.rules.a.first.length, 10);
    const quiet = fresh();
    pf.tallyJudgement(quiet, j, ["a"], false);
    assert.strictEqual(quiet.rules.a.reported, 2);
    assert.strictEqual(quiet.rules.a.fail, 12);
    assert.strictEqual(quiet.rules.a.firstReported.length, 0);
  });

  test("PF-2 tallyGutter counts a cell over half a pixel and keeps the first five", async () => {
    const report = { gutterCells: 0, gutterFirst: [] };
    const gutters = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    gutters.forEach((gutter) => pf.tallyGutter(report, { gutter }, 320, 568, "S"));
    assert.strictEqual(report.gutterCells, 5);
    assert.deepStrictEqual(report.gutterFirst, gutters.slice(2).map((g) => pf.gutterMessage(320, 568, "S", g)));
    const before = report.gutterFirst.slice();
    pf.tallyGutter(report, { gutter: 1.1 }, 320, 568, "S");
    assert.strictEqual(report.gutterCells, 6);
    assert.deepStrictEqual(report.gutterFirst, before);
  });

  test("PF-3 invarianceWidths keeps multiples of 16, both sides of a change, start neighbours in range and every sidebar width", async () => {
    const ws = [100, 112, 113, 128, 200];
    const differs = (w, p) => w === 200 && p === 128;
    const base = { ws, starts: [120], wLo: 100, wHi: 1300, differs };
    assert.deepStrictEqual(pf.invarianceWidths({ ...base, side: true }),
      [112, 119, 120, 121, 128, 200, 1024, 1025, 1100, 1280, 1300, 1440, 1920]);
    assert.deepStrictEqual(pf.invarianceWidths({ ...base, side: false }), [112, 119, 120, 121, 128, 200]);
    assert.deepStrictEqual(pf.invarianceWidths({ ws: [256], starts: [100, 300], wLo: 100, wHi: 300, side: false, differs: () => false }),
      [100, 101, 256, 299, 300]);
  });
});

describe("SB sandbox contract", () => {
  test("SB-1 assigning textContent drops the children of an element", async () => {
    const app = boot();
    const parent = app.sandbox.document.createElement("div");
    const child = app.sandbox.document.createElement("div");
    parent.appendChild(child);
    assert.strictEqual(parent.children.length, 1);
    parent.textContent = "";
    assert.strictEqual(parent.children.length, 0);
    assert.strictEqual(child.parentNode, null);
  });

  test("SB-2 every served id is in the markup and is looked up by the app", async () => {
    const fs = require("node:fs");
    const { ELEMENT_IDS, APP } = require("../tools/sandbox.js");
    const html = fs.readFileSync(APP, "utf8");
    const markup = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, "");
    const inMarkup = new Set([...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    const code = html.slice(html.indexOf("const DECKS"));
    const looked = new Set([...code.matchAll(/(?:getElementById|\$)\("([^"]+)"\)/g)].map((m) => m[1]));
    const problems = [];
    for (const id of ELEMENT_IDS) {
      if (!inMarkup.has(id)) problems.push(`${id} is served but not in the markup`);
      if (!looked.has(id)) problems.push(`${id} is served but the app never looks it up`);
    }
    assert.deepStrictEqual(problems, []);
  });

  test("SB-3 the announcer is a markup node, not one the app created", async () => {
    const app = boot();
    assert.ok(app.announcer());
    assert.ok(!app.created.includes(app.announcer()));
  });

  test("SB-4 shareLink starts with the location origin and path", async () => {
    const app = boot();
    const id = app.generate(AMARA_STRING).instanceId;
    const res = link(app, id);
    assert.strictEqual(res.ok, true, res.reason);
    assert.ok(res.value.startsWith(app.sandbox.location.origin + app.sandbox.location.pathname));
    assert.ok(!res.value.startsWith("undefined"));
  });

  test("SB-6 diffGen reports an extra card, an extra rail and a missing mode", async () => {
    const { diffGen } = require("../tools/regen_card_fixture.js");
    const face = { front: "f", back: "b" };
    const fixture = () => ({ decks: { d: { A: { 0: face }, B: { 0: face } } }, rails: { basic: "r" } });
    const extraCard = fixture();
    extraCard.decks.d.A[1] = face;
    const extraRail = fixture();
    extraRail.rails.advanced = "r";
    const missingMode = fixture();
    delete missingMode.decks.d.B;
    const missingRail = fixture();
    delete missingRail.rails.basic;
    assert.deepStrictEqual(diffGen(fixture(), extraCard), ["gen d mode A card 1: missing from fixture"]);
    assert.deepStrictEqual(diffGen(fixture(), extraRail), ["rail advanced: fixture undefined != current r"]);
    assert.deepStrictEqual(diffGen(fixture(), missingMode), ["gen d mode B: missing from current render"]);
    assert.deepStrictEqual(diffGen(fixture(), missingRail), ["rail basic: fixture r != current undefined"]);
  });

  test("FU-4 diffGen reports a deck or a mode that exists on one side only, even with no cards", async () => {
    const { diffGen } = require("../tools/regen_card_fixture.js");
    const face = { front: "f", back: "b" };
    const withEmptyMode = () => ({ decks: { d: { A: { 0: face }, B: {} } }, rails: {} });
    const withoutMode = () => ({ decks: { d: { A: { 0: face } } }, rails: {} });
    assert.deepStrictEqual(diffGen(withEmptyMode(), withoutMode()), ["gen d mode B: missing from current render"]);
    assert.deepStrictEqual(diffGen(withoutMode(), withEmptyMode()), ["gen d mode B: missing from fixture"]);
    const withEmptyDeck = () => ({ decks: { d: { A: { 0: face } }, e: {} }, rails: {} });
    const withoutDeck = () => ({ decks: { d: { A: { 0: face } } }, rails: {} });
    assert.deepStrictEqual(diffGen(withEmptyDeck(), withoutDeck()), ["gen e: missing from current render"]);
    assert.deepStrictEqual(diffGen(withoutDeck(), withEmptyDeck()), ["gen e: missing from fixture"]);
  });
});

describe("tab stops follow rendering", () => {
  test("getClientRects follows the hidden property", async () => {
    const app = boot();
    app.els["settings-panel"].hidden = false;
    const el = app.els["modeA"];
    el.hidden = true;
    assert.strictEqual(el.getClientRects().length, 0);
    el.hidden = false;
    assert.strictEqual(el.getClientRects().length, 1);
  });

  test("getClientRects follows the hidden attribute, and the two are one state", async () => {
    const app = boot();
    app.els["settings-panel"].hidden = false;
    const el = app.els["modeA"];
    el.setAttribute("hidden", "");
    assert.strictEqual(el.getClientRects().length, 0);
    assert.strictEqual(el.hidden, true);
    el.removeAttribute("hidden");
    assert.strictEqual(el.getClientRects().length, 1);
    el.hidden = true;
    assert.strictEqual(el.hasAttribute("hidden"), true);
  });

  test("getClientRects is empty under a hidden ancestor named by the shipped markup", async () => {
    const app = boot();
    app.els["settings-panel"].hidden = false;
    app.els["panel-seq-note"].hidden = false;
    assert.strictEqual(app.els["seq-source-link"].getClientRects().length, 1);
    app.els["panel-seq-note"].hidden = true;
    assert.strictEqual(app.els["seq-source-link"].getClientRects().length, 0,
      "a link inside a hidden paragraph still has client rects");
  });

  test("getClientRects follows the parent of a created-then-appended child", async () => {
    const app = boot();
    const parent = app.get("document.createElement('div')");
    const child = app.get("document.createElement('button')");
    assert.strictEqual(child.getClientRects().length, 1);
    parent.appendChild(child);
    parent.hidden = true;
    assert.strictEqual(child.getClientRects().length, 0);
    parent.removeChild(child);
    assert.strictEqual(child.getClientRects().length, 1);
  });

  test("Shift+Tab from the sheet's first stop wraps to the last, not off the front", async () => {
    const app = boot();
    const stops = ["a", "b", "c"].map(() => app.get("document.createElement('button')"));
    let prevented = 0;
    const key = (shiftKey) => app.get("cycleTabStops")(stops, { shiftKey, preventDefault() { prevented += 1; } });
    stops[0].focus();
    key(true);
    assert.strictEqual(app.get("document.activeElement"), stops[2], "Shift+Tab off the first stop did not wrap to the last");
    key(false);
    assert.strictEqual(app.get("document.activeElement"), stops[0], "Tab off the last stop did not wrap to the first");
    key(false);
    assert.strictEqual(app.get("document.activeElement"), stops[1]);
    assert.strictEqual(prevented, 3);
  });

  test("SB-5 Tab in an empty ADD sheet never lands on the disabled GENERATE", async () => {
    const app = boot();
    const live = app.get("document.createElement('button')");
    const dead = app.get("document.createElement('button')");
    dead.disabled = true;
    assert.strictEqual(app.get("isStop")(live), true);
    assert.strictEqual(app.get("isStop")(dead), false, "a disabled control was offered as a Tab stop");
    assert.strictEqual(app.get("isStop")(null), false);
  });

  test("SB-5 Tab in the ADD sheet skips a control inside a hidden row", async () => {
    const app = boot();
    const row = app.get("document.createElement('div')");
    const inside = app.get("document.createElement('button')");
    row.appendChild(inside);
    row.hidden = true;
    assert.strictEqual(app.get("isStop")(inside), false, "a control inside a hidden row was offered as a Tab stop");
    row.hidden = false;
    assert.strictEqual(app.get("isStop")(inside), true);
  });

  test("Tab with no stops neither throws nor swallows the key", async () => {
    const app = boot();
    let prevented = false;
    app.get("cycleTabStops")([], { shiftKey: false, preventDefault() { prevented = true; } });
    assert.strictEqual(prevented, false);
  });


});

/* ------------------------------------------------ US: unit-test surface */

test("US-1 every app surface name resolves", async () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const { names } = JSON.parse(fs.readFileSync(
    path.join(__dirname, "fixtures", "app_surface_v1.json"), "utf8"));
  assert.ok(names.length > 0, "the surface fixture lists no names");
  const app = boot();
  const retired=new Set(["CUSTOM","deckId","replaceRegistered"]);
  for(const name of retired)assert.strictEqual(app.get("typeof "+name),"undefined",name+" is intentionally retired by the approved instance architecture");
  const required=[...names.filter(name=>!retired.has(name)),"savedState","savedEntries","selection","commitSaved","commitSavedSession","buildGenerated","allDeckViews"];
  for (const name of required) {
    try {
      app.get(name);
    } catch (e) {
      assert.notStrictEqual(e.name, "ReferenceError", `${name} no longer resolves`);
    }
  }
});

test("US-2 layout boot gives the card a scene", async () => {
  const app = boot({ layout: true });
  assert.ok(app.get("scene"), "no scene in a layout boot");
  assert.strictEqual(app.get("scene === card.parentElement"), true);
  assert.deepStrictEqual(plainRect(app.get("card.getBoundingClientRect()")),
    { left: 0, top: 0, right: 360, bottom: 520, width: 360, height: 520 });
  const a = app.get("scene.animate([{opacity:0},{opacity:1}], {duration: 10})");
  assert.strictEqual(typeof a.cancel, "function");
  assert.ok(a.finished instanceof Promise || typeof a.finished.then === "function");
  assert.strictEqual(app.get("scene.getAnimations().length"), 1);
  a.cancel();
  assert.strictEqual(app.get("scene.getAnimations().length"), 0);
  assert.strictEqual(app.get("typeof window.visualViewport"), "undefined");
  assert.strictEqual(boot().get("typeof scene"), "undefined", "the default boot must stay layout-free");
  assert.strictEqual(boot({ layout: true, visualViewport: { height: 400 } }).get("window.visualViewport.height"), 400);
});

function plainRect(r) { return JSON.parse(JSON.stringify(r)); }

/* ------------------------------------------------ US-3 / US-4: swipe, wheel, keyboard inset
 * Synthetic pointer and wheel events in a layout boot. Thresholds come from
 * the e2e "card swipe" expectations (a 15px drag commits only when it is a
 * fling; a wheel gesture commits past 80px of accumulated deltaX), never from
 * the SWIPE_* / WHEEL_* constants. The sandbox dispatch has no capture/bubble
 * phases, so each event is sent straight to the element the listener is on.
 */
const settle = () => new Promise((r) => setImmediate(r));

function swipeRig() {
  const app = boot({ layout: true });
  const ptr = (type, x, t, extra = {}) => ({
    type, pointerId: 1, isPrimary: true, button: 0, buttons: 1, pointerType: "touch",
    clientX: x, clientY: 260, timeStamp: t, target: app.els.card,
    preventDefault() {}, stopPropagation() {}, ...extra,
  });
  const onCard = (type, x, t) => app.els.card.dispatchEvent(ptr(type, x, t));
  const mainEl = () => app.get("document.querySelector('main')");
  const wheelEv = (dx) => mainEl().dispatchEvent({
    type: "wheel", deltaX: dx, deltaY: 0, deltaMode: 0, ctrlKey: false, preventDefault() {},
  });
  const scene = () => app.get("scene");
  const running = () => scene()._anims.filter((a) => a.state === "running");
  const idx = () => app.get("idx");
  return { app, ptr, onCard, wheelEv, scene, running, idx };
}

test("US-3 a fast flick past threshold flies out", async () => {
  const { onCard, running, idx } = swipeRig();
  onCard("pointerdown", 100, 0);
  onCard("pointermove", 85, 25);
  onCard("pointerup", 85, 26);
  assert.strictEqual(running().length, 1, "a committed flick must start the fly-out");
  assert.strictEqual(idx(), 0, "the deck only steps once the fly-out lands");
  running()[0].finish();
  await settle();
  assert.strictEqual(idx(), 1, "swiping left deals the next card");
});

test("US-3 a slow short drag springs back", async () => {
  const { app, onCard, running, idx } = swipeRig();
  onCard("pointerdown", 100, 0);
  onCard("pointermove", 88, 300);
  onCard("pointermove", 85, 600);
  onCard("pointerup", 85, 601);
  assert.strictEqual(running().length, 1, "a sub-threshold release still animates back to rest");
  running()[0].finish();
  await settle();
  assert.strictEqual(idx(), 0, "a slow 15px drag must not change the card");
  assert.strictEqual(app.get("scene.style.transform"), "");
});

test("US-3 an open panel blocks the capture pointerdown", async () => {
  const { app, ptr, onCard, running, idx } = swipeRig();
  const docDown = () => app.sandbox.document.dispatchEvent(ptr("pointerdown", 180, 1000));
  const flick = () => { onCard("pointerdown", 100, 0); onCard("pointermove", 85, 25); onCard("pointerup", 85, 26); };

  flick();
  assert.strictEqual(running().length, 1);
  docDown();
  assert.strictEqual(idx(), 1, "a press mid-flight lands the pending fly-out");
  assert.strictEqual(app.get("drag !== null"), true, "with nothing open the press grabs the card");
  onCard("pointercancel", 180, 1001);

  flick();
  app.run("panelOpen = true");
  docDown();
  assert.strictEqual(idx(), 2, "the pending fly-out still lands");
  assert.strictEqual(app.get("drag"), null, "an open panel must not let the press start a drag");
});

test("US-3 one wheel gesture over WHEEL_COMMIT_PX steps once", async () => {
  const { app, wheelEv, running, idx } = swipeRig();
  for (const dx of [30, 30, 30, 30, 30]) wheelEv(dx);
  assert.strictEqual(running().length, 1, "past 80px accumulated the card flies out, once");
  running()[0].finish();
  await settle();
  const before = running().length;
  for (const dx of [5, 3, 2]) wheelEv(dx);
  assert.strictEqual(running().length, before, "the tail of a committed gesture starts no second fly-out");
  app.flushTimers();
  assert.strictEqual(idx(), 1);
});

async function landFlight({ app, running }) {
  running().forEach((a) => a.finish());
  await settle();
  app.flushTimers();
}

test("SW2 A: two swipes back to back, each with a momentum tail, advance two cards", async () => {
  const rig = swipeRig();
  const { wheelEv, running, idx } = rig;
  for (const dx of [30, 30, 30, 20, 10, 5, 3, 2, 1, 1]) wheelEv(dx);
  assert.strictEqual(running().length, 1);
  running()[0].finish();
  await settle();
  for (const dx of [30, 30, 30, 20, 10, 5, 3, 2, 1, 1]) wheelEv(dx);
  await landFlight(rig);
  assert.strictEqual(idx(), 2);
});

test("SW2 B: one swipe with a long monotone tail with flat repeats steps once", async () => {
  const rig = swipeRig();
  for (const dx of [30, 30, 30, 25, 25, 20, 20, 15, 15, 10, 10, 6, 6, 3, 3, 2, 2, 1, 1, 1, 0, 0]) rig.wheelEv(dx);
  await landFlight(rig);
  assert.strictEqual(rig.idx(), 1);
});

test("SW2 C: a small bump above a third of the peak does not start a gesture", async () => {
  const rig = swipeRig();
  for (const dx of [11, 11, 11, 11, 11, 11, 11, 11, 10, 8, 6, 5, 4, 5, 4, 4, 3, 2, 1]) rig.wheelEv(dx);
  await landFlight(rig);
  assert.strictEqual(rig.idx(), 1);
});

test("SW2 D: a second stroke begun during the flight counts once the card lands", async () => {
  const rig = swipeRig();
  const { wheelEv, running, idx } = rig;
  for (const dx of [30, 30, 30, 5, 2, 1]) wheelEv(dx);
  for (const dx of [30, 30]) wheelEv(dx);
  assert.strictEqual(running().length, 1, "the in-flight stroke starts no second flight");
  assert.strictEqual(idx(), 0);
  running()[0].finish();
  await settle();
  for (const dx of [30, 30, 30]) wheelEv(dx);
  await landFlight(rig);
  assert.strictEqual(idx(), 2);
});

async function playTail(rig, head, tail, landAfter) {
  const { wheelEv } = rig;
  for (const dx of head) wheelEv(dx);
  tail.slice(0, landAfter).forEach((dx) => wheelEv(dx));
  rig.running().forEach((a) => a.finish());
  await settle();
  tail.slice(landAfter).forEach((dx) => wheelEv(dx));
  await landFlight(rig);
}

test("SW2 E: a coalesced merge of three tail frames is not a new stroke", async () => {
  const rig = swipeRig();
  const tail = Array.from({ length: 150 }, (_, i) => 40 * 0.96 ** i);
  tail.splice(30, 3, tail[30] + tail[31] + tail[32]);
  await playTail(rig, [10, 25, 40], tail, 10);
  assert.strictEqual(rig.idx(), 1);
});

test("SW2 F: a zero-delta event at the lift does not make the tail a new stroke", async () => {
  const rig = swipeRig();
  const tail = Array.from({ length: 80 }, (_, i) => 25 * 0.93 ** i);
  await playTail(rig, [10, 25, 40, 40, 0], tail, 5);
  assert.strictEqual(rig.idx(), 1);
});

test("SW2 G: a stroke that starts at 1px does not leave a stale trough after the commit", async () => {
  const rig = swipeRig();
  const { wheelEv, running } = rig;
  for (const dx of [30, 1, 30, 30, 30]) wheelEv(dx);
  running().forEach((a) => a.finish());
  await settle();
  const before = running().length;
  for (let i = 0; i < 14; i++) wheelEv(8);
  assert.strictEqual(running().length, before);
});

test("SW2 H: the gap timer firing mid-flight does not spring the card back", async () => {
  const { app, wheelEv, running } = swipeRig();
  for (const dx of [30, 30, 30, 30]) wheelEv(dx);
  app.flushTimers();
  wheelEv(30);
  app.flushTimers();
  assert.strictEqual(running().length, 1);
});

test("SW2 I: a rise inside a gesture that has not fired does not restart it", async () => {
  const rig = swipeRig();
  for (const dx of [30, 1, 1, 30, 30]) rig.wheelEv(dx);
  assert.strictEqual(rig.running().length, 1);
});

test("US-3 wheel is ignored mid-flight", async () => {
  const { app, wheelEv, running, idx } = swipeRig();
  for (const dx of [30, 30, 30, 30]) wheelEv(dx);
  assert.strictEqual(running().length, 1);
  app.flushTimers();
  for (const dx of [30, 30, 30, 30]) wheelEv(dx);
  assert.strictEqual(running().length, 1, "a second gesture during the flight starts nothing");
  running()[0].finish();
  await settle();
  app.flushTimers();
  assert.strictEqual(idx(), 1, "the second gesture must not double-step");
});


/* ------------------------------------------------ AP1-1 / AP1-2: gesture guard and release decision */

test("AP1-1 canStartGesture guard table", async () => {
  const app = boot({ layout: true });
  const base = { drag: null, panelOpen: false, pageOpen: false, orderLength: 3 };
  const ev = { isPrimary: true, button: 0 };
  const can = (e, s) => app.get(`canStartGesture(${JSON.stringify(e)}, ${JSON.stringify(s)})`);
  const rows = [
    ["all clear", ev, base, true],
    ["a live drag", ev, { ...base, drag: { id: 1 } }, false],
    ["a non-primary pointer", { ...ev, isPrimary: false }, base, false],
    ["a non-main button", { ...ev, button: 2 }, base, false],
    ["the middle button", { ...ev, button: 1 }, base, false],
    ["the panel open", ev, { ...base, panelOpen: true }, false],
    ["the editor page open", ev, { ...base, pageOpen: true }, false],
    ["an empty deck", ev, { ...base, orderLength: 0 }, false],
    ["a one-card deck", ev, { ...base, orderLength: 1 }, true],
  ];
  for (const [name, e, s, want] of rows) assert.strictEqual(can(e, s), want, name);
});

test("AP1-2 releaseDecision table", async () => {
  const app = boot({ layout: true });
  const rd = (o) => plain(app.get(`releaseDecision(${JSON.stringify({
    dx: 0, dy: 0, vx: 0, moved: true, cancelled: false, blocked: false, reducedMotion: false, ...o,
  })})`));
  const rows = [
    ["fast flick left", { dx: -15, vx: -0.9 }, { kind: "fly", dir: 1, eatClick: true }],
    ["fast flick right", { dx: 15, vx: 0.9 }, { kind: "fly", dir: -1, eatClick: true }],
    ["slow short drag", { dx: -15, vx: 0 }, { kind: "spring", dir: 0, eatClick: true }],
    ["long slow drag", { dx: -40, vx: 0 }, { kind: "fly", dir: 1, eatClick: true }],
    ["out and back", { dx: 0, dy: 0, vx: 0 }, { kind: "spring", dir: 0, eatClick: true }],
    ["vertical-dominant drag", { dx: 20, dy: 25, vx: 0.9 }, { kind: "spring", dir: 0, eatClick: true }],
    ["never left the slop", { dx: 4, moved: false }, { kind: "rest", dir: 0, eatClick: false }],
    ["cancelled", { dx: -40, vx: -0.9, cancelled: true, blocked: true }, { kind: "spring", dir: 0, eatClick: false }],
    ["cancelled without moving", { dx: 0, moved: false, cancelled: true, blocked: true }, { kind: "rest", dir: 0, eatClick: false }],
    ["blocked by an open panel", { dx: -40, vx: -0.9, blocked: true }, { kind: "spring", dir: 0, eatClick: true }],
    ["mouse flick", { dx: -40, vx: -0.9 }, { kind: "fly", dir: 1, eatClick: true }],
    ["reduced motion commit", { dx: -40, vx: -0.9, reducedMotion: true }, { kind: "rest", dir: 1, eatClick: true }],
    ["reduced motion short drag", { dx: -15, reducedMotion: true }, { kind: "rest", dir: 0, eatClick: true }],
    ["reduced motion tap", { dx: 3, moved: false, reducedMotion: true }, { kind: "rest", dir: 0, eatClick: false }],
  ];
  for (const [name, o, want] of rows) assert.deepStrictEqual(rd(o), want, name);
});

test("AP1-3 wheelDecision table", async () => {
  const app = boot({ layout: true });
  const wd = (w, e) => plain(app.get(`wheelDecision(${JSON.stringify({
    sx: 0, axis: null, fired: false, skip: false, ...w,
  })}, ${JSON.stringify({ deltaX: 0, deltaY: 0, deltaMode: 0, innerHeight: 800, ...e })})`));
  const rows = [
    ["skipped gesture", { skip: true }, { deltaX: 200 }, { kind: "skip", axis: null, sx: 0, dir: 0 }],
    ["first event horizontal claims x", {}, { deltaX: 20, deltaY: 5 }, { kind: "follow", axis: "x", sx: 20, dir: 0 }],
    ["first event vertical claims y", {}, { deltaX: 5, deltaY: 20 }, { kind: "pass", axis: "y", sx: 0, dir: 0 }],
    ["zero delta claims nothing", {}, {}, { kind: "pass", axis: null, sx: 0, dir: 0 }],
    ["axis y stays y", { axis: "y" }, { deltaX: 200 }, { kind: "pass", axis: "y", sx: 0, dir: 0 }],
    ["accumulates on x", { axis: "x", sx: 30 }, { deltaX: 20 }, { kind: "follow", axis: "x", sx: 50, dir: 0 }],
    ["exactly at the threshold does not commit", { axis: "x", sx: 60 }, { deltaX: 20 }, { kind: "follow", axis: "x", sx: 80, dir: 0 }],
    ["one past the threshold commits forward", { axis: "x", sx: 60 }, { deltaX: 21 }, { kind: "commit", axis: "x", sx: 81, dir: 1 }],
    ["backward commit", { axis: "x", sx: -60 }, { deltaX: -21 }, { kind: "commit", axis: "x", sx: -81, dir: -1 }],
    ["already fired holds", { axis: "x", sx: 90, fired: true }, { deltaX: 50 }, { kind: "hold", axis: "x", sx: 90, dir: 0 }],
    ["line deltas scale by 16", {}, { deltaX: 6, deltaMode: 1 }, { kind: "commit", axis: "x", sx: 96, dir: 1 }],
    ["page deltas scale by innerHeight", {}, { deltaX: 1, deltaMode: 2, innerHeight: 600 }, { kind: "commit", axis: "x", sx: 600, dir: 1 }],
    ["pixel deltas are unscaled", {}, { deltaX: 6, deltaMode: 0 }, { kind: "follow", axis: "x", sx: 6, dir: 0 }],
  ];
  for (const [name, w, e, want] of rows) assert.deepStrictEqual(wd(w, e), want, name);
});

test("AP1-3 wheelEndDecision table", async () => {
  const app = boot({ layout: true });
  const end = (o) => app.get(`wheelEndDecision(${JSON.stringify({ skip: false, fired: false, reducedMotion: false, ...o })})`);
  assert.strictEqual(end({}), "spring");
  assert.strictEqual(end({ reducedMotion: true }), "rest");
  assert.strictEqual(end({ fired: true }), "none");
  assert.strictEqual(end({ skip: true }), "none");
  assert.strictEqual(end({ fired: true, reducedMotion: true }), "none");
});

/* ------------------------------------------------ AP2: sheet, panel, runGenerate, setMode */
const SHEET_LETS = "[editingId, refusal, nameDirty, palette, mirror, layoutSeats, pickRef, mode]";
const sheetLets = (app) => plain(app.get(SHEET_LETS));


test("AP2-2 setInert applies each caller's own background set", async () => {
  const app = boot({ layout: true });
  const ids = (expr) => plain(app.get(`${expr}.map(e => e.id)`));
  const inertIds = () => plain(app.get(`[...new Set([...background, ...panelBackground])].filter(e => e.inert).map(e => e.id)`));
  assert.deepStrictEqual(ids("background"), ["settings-panel", "about", "main"], "the sheet's set");
  assert.deepStrictEqual(ids("panelBackground"), ["main", "decks", "about", "share-copy", "saved-temporary-use"], "the panel's set");
  assert.deepStrictEqual(inertIds(), []);

  app.run("openScaleSheet()");
  assert.deepStrictEqual(inertIds().sort(), ["about", "main", "settings-panel"], "the sheet inerts its own set only");
  assert.strictEqual(app.get("background[0].getAttribute('aria-hidden')"), "true");
  app.run("closeScaleSheet()");
  assert.deepStrictEqual(inertIds(), [], "closing the sheet frees exactly what it took");
  assert.strictEqual(app.get("background[0].getAttribute('aria-hidden')"), null);

  app.run("openPanel()");
  assert.deepStrictEqual(inertIds().sort(), ["about", "decks", "main", "saved-temporary-use", "share-copy"], "the panel inerts its own set only");
  assert.strictEqual(app.get("panelBackground[1].getAttribute('aria-hidden')"), "true");
  app.run("closePanel()");
  assert.deepStrictEqual(inertIds(), []);
  assert.strictEqual(app.get("panelBackground[1].getAttribute('aria-hidden')"), null);

  app.run("setInert(true, [panelBackground[1]])");
  assert.deepStrictEqual(inertIds(), ["decks"], "setInert takes the set as an argument");
  app.run("setInert(false, [panelBackground[1]])");
  assert.deepStrictEqual(inertIds(), []);
});



test("AP2-4 setMode and shuffle produce the same label", async () => {
  const app = boot({ layout: true });
  const label = () => plain(app.get(`[shuffleBtn.textContent, shuffleBtn.classList.contains("on"), shuffleBtn.classList.contains("reroll"), shuffleBtn.getAttribute("aria-label")]`));
  app.run(`var shuffleBtn = document.getElementById("shuffle")`);
  app.run(`setMode("A")`);
  assert.deepStrictEqual(label(), ["Shuffle: off", false, false, null]);
  app.run(`shuffleBtn.onclick()`);
  const clicked = label();
  assert.deepStrictEqual(clicked, ["Shuffle: on", true, false, null]);
  app.run(`setMode("B")`);
  assert.deepStrictEqual(label(), clicked, "setMode writes what the click wrote");
  app.run(`syncShuffleLabel()`);
  assert.deepStrictEqual(label(), clicked, "syncShuffleLabel is that one writer");
  app.run(`setMode("S")`);
  assert.deepStrictEqual(label().slice(1), [false, true, "New progression"]);
  app.run(`syncShuffleLabel()`);
  assert.deepStrictEqual(label().slice(1), [false, true, "New progression"], "mode S is the icon, whatever shuffled says");
  app.run(`setMode("A")`);
  assert.deepStrictEqual(label(), clicked, "leaving S restores the text label");
});

test("AP3-0 generated faces and rail DOM match the committed digest", async () => {
  const { execFileSync } = require("node:child_process");
  const tool = path.join(ROOT, "tools", "regen_card_fixture.js");
  const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "fixtures", "gen_face_v1.json"), "utf8"));
  const digests = Object.values(fixture.decks).flatMap((d) => Object.values(d.A).map((c) => c.front));
  assert.ok(new Set(digests).size > 5, "the fixture distinguishes generated decks");
  assert.notStrictEqual(fixture.rails.basic, fixture.rails.advanced, "the two rails differ");
  try {
    execFileSync(process.execPath, [tool, "--gen", "--check"], { stdio: "pipe" });
  } catch (e) {
    assert.fail("gen_face_v1.json is stale:\n" + (e.stdout || "") + (e.stderr || ""));
  }
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(html.includes("Tap to reveal the notes"));
  const dir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "ap3-0-"));
  const drifted = path.join(dir, "index.html");
  try {
    fs.writeFileSync(drifted, html.replace("Tap to reveal the notes", "Tap to reveal the notes!"));
    assert.throws(
      () => execFileSync(process.execPath, [tool, "--gen", "--check", "--html", drifted], { stdio: "pipe" }),
      /Command failed/, "a drifted generated face must fail the check");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("R4-A29 regen_card_fixture --html without a value exits non-zero with a message", async () => {
  const { spawnSync } = require("node:child_process");
  const tool = path.join(ROOT, "tools", "regen_card_fixture.js");
  const dest = path.join(ROOT, "tests", "fixtures", "card_face_v1.json");
  const genDest = path.join(ROOT, "tests", "fixtures", "gen_face_v1.json");
  const before = fs.readFileSync(dest);
  const mtimes = () => [dest, genDest].map((f) => fs.statSync(f).mtimeMs);
  const mtimeBefore = mtimes();
  for (const argv of [["--html"], ["--check", "--html"], ["--html", "--check"], ["--gen", "--html"]]) {
    const r = spawnSync(process.execPath, [tool, ...argv], { encoding: "utf8" });
    const where = argv.join(" ");
    assert.notStrictEqual(r.status, 0, `${where}: a flag with no value must not succeed`);
    assert.match(r.stderr, /--html needs a path/, `${where}: the message names the flag`);
    assert.doesNotMatch(r.stderr, /TypeError|at Object\.|node:internal/, `${where}: a message, not a stack`);
  }
  assert.ok(fs.readFileSync(dest).equals(before), "a refused invocation writes nothing");
  assert.deepStrictEqual(mtimes(), mtimeBefore, "a refused invocation touched a fixture, even with equal bytes");
});

test("AP3-1 faceHTML is the only answer-template builder", async () => {
  const app = boot({ random: () => 0 });
  app.run(`var __calls = []; var __real = faceHTML;
    faceHTML = function (d, ch, n, kind) { __calls.push(kind); return __real.apply(this, arguments); };
    var __pan = pan; var __pans = 0; pan = function () { __pans += 1; return __pan.apply(this, arguments); };`);
  const seen = {};
  for (const mode of ["A", "B", "S"]) {
    app.run(`mode = ${JSON.stringify(mode)}; setOrder(); idx = 0; __calls.length = 0; __pans = 0; render();`);
    seen[mode] = { calls: plain(app.get("__calls")), pans: app.get("__pans"), front: app.els.front._html, back: app.els.back._html };
  }
  assert.deepStrictEqual(seen.A.calls, ["question", "answer"]);
  assert.deepStrictEqual(seen.B.calls, ["questionB", "answerB"]);
  assert.deepStrictEqual(seen.S.calls, ["answer", "backS"]);
  for (const mode of ["A", "B", "S"]) assert.strictEqual(seen[mode].pans, 1, `${mode} builds the pan once`);
  assert.ok(seen.A.back.includes("diagwrap") && seen.A.back.includes('class="lines"'));
  assert.ok(seen.S.front.includes("diagwrap") && !seen.S.front.includes("prompt"));
  assert.ok(seen.B.back.includes("prompt") && seen.B.back.includes('class="lines"'));
});


test("AP3-4 the rail keeps its scroll across a re-render of the same deal and resets on a new one", async () => {
  const app = boot({ random: () => 0 });
  app.run('setMode("S")');
  const first = app.els.count.children[0];
  first.scrollLeft = 120;
  app.run("render()");
  const again = app.els.count.children[0];
  assert.notStrictEqual(again, first, "the rail is rebuilt");
  assert.strictEqual(again.scrollLeft, 120, "same deal carries the scroll position");
  app.run(`seq = { chords: seq.chords.slice(), style: seq.style }; render()`);
  assert.strictEqual(app.els.count.children[0].scrollLeft || 0, 0, "a new deal starts at 0");
  assert.strictEqual(app.els.count.children.length, 2, "rail plus live region");
  assert.strictEqual(app.els.count.children[1].className, "sr-only");
  assert.ok(app.els.count.classList.contains("seq"));
});

/* Lane L0 (scale-syntax plan, 5.2 and 6.2): a record is found by the deck id
   its own string resolves to, not by comparing `s` with formatSeed's spelling.
   A stored record may hold any spelling the reader accepts. */
test("deleting a migrated instance removes only its record whatever source spelling it held", async () => {
  const key="hpfc.scales.v3",other="(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4";
  for(const spelling of ["(D) A C D E F G A C","D3/ A3 C4 D4 E4 F4 G4 A4 C5","(D3) A3 C4 D4 E4 F4 G4 A4 C5"]) {
    const raw=JSON.stringify([{v:2,s:spelling,o:{}},{v:2,s:other,o:{}}]),app=await durableBoot({storage:{[key]:raw}}),before=savedEnvelope(app);
    assert.strictEqual(Object.keys(savedViews(app)).length,2,"both literal legacy fixtures are readable");
    const target=before.entries[0].instanceId;app.select(target);app.clickChip(app.currentDeck().name);await deleteClick(app);await deleteClick(app);
    const after=savedEnvelope(app);assert.deepStrictEqual(after.entries,[before.entries[1]],"only the chosen source-row instance is deleted");assert.strictEqual(app.store[key],raw,"original source remains untouched for recovery");
  }
});

/* Lane L0 bounce: a string that does not re-parse has no deck id, and a null id
   matches nothing. It falls back to the exact string, and an unreadable record
   of another pan is kept byte for byte. Every canonical string the current
   grammar writes re-parses, so no typed deck reaches this: the storage
   functions are driven directly. */
const UNREADABLE = { v: 2, s: "(D3) A3 not-a-scale" };
const UNREADABLE_B = { v: 2, s: "(D3) B3 not-a-scale" };

function scalesOf(app) {
  return plain(app.get("savedState.entries.map(row=>row.record)"));
}

test("delete refuses an opaque row and preserves every saved record byte for byte", async () => {
  const key="hpfc.scales.v3",raw=JSON.stringify([{v:4,s:AMARA_STRING,o:{}},UNREADABLE,{v:4,s:OTHER_STRING,o:{}}]);
  const app=await durableBoot({storage:{[key]:raw}}),before=savedEnvelope(app),opaque=before.entries[1];
  assert.strictEqual(app.get(`savedEntries.has(${JSON.stringify(opaque.instanceId)})`),false,"opaque source has no generated mutation target");
  const result=await app.getAsync(`commitSaved({type:"delete",collectionId:savedState.collectionId,instanceId:${JSON.stringify(opaque.instanceId)},expectedRevision:1})`);
  assert.strictEqual(result.ok,false);assert.deepStrictEqual(savedEnvelope(app),before);assert.strictEqual(app.store[key],raw);
});

test("Edit refuses opaque targets and keeps opaque siblings while replacing only its readable instance", async () => {
  const key="hpfc.scales.v3",raw=JSON.stringify([{v:4,s:AMARA_STRING,o:{}},UNREADABLE]),app=await durableBoot({storage:{[key]:raw}}),before=savedEnvelope(app);
  const refused=await app.getAsync(`commitSaved({type:"edit",collectionId:savedState.collectionId,instanceId:${JSON.stringify(before.entries[1].instanceId)},expectedRevision:1,
    candidate:{deck:savedEntries.get(${JSON.stringify(before.entries[0].instanceId)}).deck,record:scaleRecord(seedOf(savedEntries.get(${JSON.stringify(before.entries[0].instanceId)}).deck))}})`);
  assert.strictEqual(refused.ok,false);assert.deepStrictEqual(savedEnvelope(app),before);
  app.select(before.entries[0].instanceId);app.clickChip(app.currentDeck().name);app.type(OTHER_STRING);await generateClick(app);
  const after=savedEnvelope(app);assert.strictEqual(after.entries.length,2);assert.deepStrictEqual(after.entries[1],before.entries[1]);
  assert.strictEqual(after.entries[0].instanceId,before.entries[0].instanceId);assert.strictEqual(after.entries[0].displayOrdinal,before.entries[0].displayOrdinal);assert.strictEqual(after.entries[0].revision,2);assert.notStrictEqual(after.entries[0].record.s,before.entries[0].record.s);assert.strictEqual(app.store[key],raw);
});

test("saving the same deck twice leaves one record", async () => {
  const app = boot();
  await makeCustom(app, AMARA_STRING);
  await makeCustom(app, AMARA_STRING);
  assert.strictEqual(scalesOf(app).length, 1, JSON.stringify(scalesOf(app)));
});

/* ------------------------------------------------ Lane S3: per-ring seats */

const PYGMY_LEGACY = "(F3) G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5 F5 G5 | C3 Db3 Eb3 Bb3 Db4 Ab5";
const PYGMY_STRING = "[C3] [Db3] [Eb3] (F3) G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 F5 G5 [Ab5]";
const ringIdsOf = (d, ring) => Object.keys(d.fields).filter((id) => d.fields[id][F_ZONE] === ring);
const anglesByNote = (d) => {
  const out = {};
  for (const id of Object.keys(d.fields)) out[d.fields[id][F_NAME] + d.fields[id][F_OCT]] = d.fields[id][4];
  return out;
};




test("S3: a cross-ring arrangement is refused by generateDeck", async () => {
  const app = boot();
  const rim = 11;
  const crossed = Array.from({ length: rim }, (_, i) => i);
  crossed[0] = rim;
  const res = plain(app.get(`generateDeck(${JSON.stringify(PYGMY_STRING)}, { seats: { rim: ${JSON.stringify(crossed)} } })`));
  assert.strictEqual(res.ok, false);
  assert.deepStrictEqual(savedViews(app), {}, "a refused arrangement still registered a deck");
});

test("S3: seats, anchor and a one-ring mirror travel through a share link and rebuild the same pan", async () => {
  const app = boot();
  const options = { mirror: true, mirrorBottom: false, anchor: "between", name: "Travel",
                    seats: { rim: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0], bottom: [1, 2, 3, 4, 5, 0] } };
  const made = app.generate(PYGMY_STRING, options);
  assert.strictEqual(made.ok, true, made.reason);
  const url = link(app, made.instanceId);
  assert.strictEqual(url.ok, true, url.reason);
  assert.strictEqual(payload(url.value).charAt(0), "6");

  const other = boot();
  const opened = openShare(other, payload(url.value));
  assert.strictEqual(opened.ok, true, opened.reason);
  const back = savedViews(other)[opened.instanceId];
  assert.deepStrictEqual(anglesByNote(back), anglesByNote(savedViews(app)[made.instanceId]));
  assert.deepStrictEqual(plain(back.options).seats, options.seats);
  assert.strictEqual(back.options.anchor, "between");
  assert.strictEqual(back.options.mirror, true);
  assert.strictEqual(back.options.mirrorBottom, false);
});

test("S3: an anchor and a seat list are solved together, not one after the other", async () => {
  const app = boot();
  const seats = { rim: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0] };
  const made = app.generate(PYGMY_STRING, { anchor: "between", seats });
  assert.strictEqual(made.ok, true, made.reason);
  const want = plain(app.get(`(() => {
    const seed = HPE.core.parseSeed(${JSON.stringify(PYGMY_STRING)}, { anchor: "between" }).value;
    return HPE.layout.solve(seed, { mirror: false, mirrorBottom: false, anchor: "between",
                                    seats: ${JSON.stringify(seats)} }).value.fields;
  })()`));
  const got = savedViews(app)[made.instanceId].fields;
  for (const id of Object.keys(want)) {
    assert.strictEqual(got[id][4], want[id][4], `field ${id} sits at a different angle`);
  }
});


test("S3: saved instances live under the new envelope and records keep version 4", async () => {
  const app=await durableBoot();await makeCustom(app,PYGMY_STRING);const e=savedEnvelope(app);
  assert.strictEqual(e.schema,1);assert.strictEqual(e.entries.length,1);assert.strictEqual(e.entries[0].record.v,4);
  assert.strictEqual(app.store["hpfc.scales.v3"],undefined);assert.strictEqual(app.store["hpfc.scales"],undefined,"new writes do not touch either legacy key");
});

test("S3: first migration preserves old source and normalizes only the new envelope", async () => {
  const old=JSON.stringify([{v:2,s:AMARA_STRING,o:{palette:2,name:"Old"}}]),app=await durableBoot({storage:{"hpfc.scales":old}});
  assert.strictEqual(app.store["hpfc.scales"],old);assert.strictEqual(app.store["hpfc.scales.v3"],undefined);
  const e=savedEnvelope(app);assert.strictEqual(e.migration.raw["hpfc.scales"],old);assert.strictEqual(e.migration.sourceKey,"hpfc.scales");
  assert.deepStrictEqual(e.entries.map(row=>row.record),JSON.parse(old).map(row=>({...row,v:4})));assert.deepStrictEqual(Object.values(savedViews(app)).map(d=>d.name),["Old"]);
});

test("S3: legacy v3 precedence preserves both exact sources in the new envelope", async () => {
  const old=JSON.stringify([{v:2,s:AMARA_STRING,o:{name:"Old"}}]),fresh=JSON.stringify([{v:3,s:"(C3) G3 C4 D4",o:{name:"Fresh"}}]);
  const app=await durableBoot({storage:{"hpfc.scales":old,"hpfc.scales.v3":fresh}}),e=savedEnvelope(app);
  assert.strictEqual(app.store["hpfc.scales"],old);assert.strictEqual(app.store["hpfc.scales.v3"],fresh);assert.strictEqual(e.migration.raw["hpfc.scales"],old);assert.strictEqual(e.migration.raw["hpfc.scales.v3"],fresh);
  assert.strictEqual(e.migration.sourceKey,"hpfc.scales.v3");assert.deepStrictEqual(e.entries.map(row=>row.record),JSON.parse(fresh).map(row=>({...row,v:4})));assert.deepStrictEqual(Object.values(savedViews(app)).map(d=>d.name),["Fresh"]);
});

test("S3: refused migration write retains the old list and serves an explicit session copy", async () => {
  const old=JSON.stringify([{v:2,s:AMARA_STRING,o:{name:"Old"}}]);
  const app=await durableBoot({storage:{"hpfc.scales":old},idbFault:{operation:"put",error:new Error("public test quota refusal")}});
  // Transactional amendment: attempted migration failure is protected until
  // an explicit temporary choice. Historical registration remains unchanged.
  assert.strictEqual(app.get("savedMode"),"protected");assert.deepStrictEqual(Object.values(savedViews(app)),[]);
  assert.strictEqual(app.store["hpfc.scales"],old);assert.strictEqual(savedRaw(app),undefined);
  assert.strictEqual(app.els["saved-temporary-use"].hidden,false);
  const writes=app.idb.operations.filter(x=>x.operation==="put").length;
  app.els["saved-temporary-use"].click();assert.strictEqual(app.get("savedMode"),"session");
  openSheet(app);app.type(AMARA_STRING);app.els["scale-name"].value="Old";app.els["scale-name"].dispatchEvent({type:"input"});
  await generateClick(app);
  assert.deepStrictEqual(Object.values(savedViews(app)).map(d=>d.name),["Old"],"explicit recovery still permits a usable temporary copy");
  assert.strictEqual(app.store["hpfc.scales"],old);assert.strictEqual(savedRaw(app),undefined);
  assert.strictEqual(app.idb.operations.filter(x=>x.operation==="put").length,writes,"temporary recovery never retries a durable write");
  assert.ok(app.els["saved-status"].textContent.length>0,"session limitation is visible");
});

test("S3: a stored v2 record's flat order becomes per-ring seats at boot", async () => {
  const order = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0, 12, 13, 14, 15, 16, 11];
  const rec = [{ v: 2, s: PYGMY_LEGACY, o: { palette: 1, name: "Moved", order } }];
  const app = boot({ storage: { "hpfc.scales": JSON.stringify(rec) } });
  const d = Object.values(savedViews(app))[0];
  assert.deepStrictEqual(plain(d.options).seats, {
    rim: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0],
    bottom: [1, 2, 3, 4, 5, 0],
  });
  assert.strictEqual("order" in plain(d.options), false);
});

test("S3: a stored cross-ring order boots as the generated arrangement, not dropped", async () => {
  const order = Array.from({ length: 17 }, (_, i) => 16 - i);
  const rec = [{ v: 2, s: PYGMY_LEGACY, o: { name: "Crossed", order } }];
  const app = boot({ storage: { "hpfc.scales": JSON.stringify(rec) } });
  const d = Object.values(savedViews(app))[0];
  assert.ok(d, "the record was dropped");
  assert.strictEqual(d.name, "Crossed");
  assert.strictEqual("seats" in plain(d.options), false);
  const plainDeck = boot().generate(PYGMY_STRING, { name: "Crossed" }).value;
  assert.deepStrictEqual(anglesByNote(d), anglesByNote(plainDeck));
});

/* ------------------------------------------------------------------ Lane W1
 * The wrapping scale field, the count line, and the two mirror switches. The
 * numbers are the lines of docs/plans/2026-10-07-scale-drawer-design-spec.md
 * section 16.2 that carry a [W1] tag; each test names its line. */

const W1_NONE = "(D3) A3 C4 D4";
const W1_BOTTOM = "[C3] (D3) A3 C4 D4";
const W1_FULL = "[C3] [Db3] [Eb3] (F3) G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]";

const pressed = (app, id) => app.els[id].getAttribute("aria-pressed") === "true";
const fieldAngles = (deck) => Object.fromEntries(
  Object.entries(deck.fields).map(([id, f]) => [id, { zone: f[3], angle: f[4] }]));

/** Add a deck from W1_FULL with the given switches pressed after typing. */
async function w1Generate(seed, ids = []) {
  const app = boot();
  openSheet(app);
  app.type(seed);
  for (const id of ids) app.els[id].click();
  await generateClick(app);
  return { app, deck: savedViews(app)[app.get("selection.id")] };
}



test("W1 line 6: Enter during an IME composition does not generate", async () => {
  const app = boot();
  openSheet(app);
  app.type(AMARA_STRING);
  let prevented = false;
  app.els["scale-box"].dispatchEvent({ type: "keydown", key: "Enter", isComposing: true,
    preventDefault() { prevented = true; } });
  assert.strictEqual(prevented, false, "Enter was swallowed while composing");
  assert.strictEqual(app.sheetOpen(), true, "Enter during composition generated");
  assert.strictEqual(Object.keys(savedViews(app)).length, 0);
});






const MN_KURD = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5";
const mnNumberLine = (deck, main) => {
  const chord = deck.chords.find((c) => c.main === main && !c.sup);
  return chord.fields.map((f) => deck.fields[f][5]).join("-");
};

test("MN: the title card omits the TONEFIELD NUMBERS line when the top is mirrored, and keeps it unmirrored or with only the bottom mirrored", () => {
  const E = require("./helpers/engine.js").loadEngine(["core", "fontdata", "pdf", "pdfdeck", "pdfcards"]);
  const lines = (seed, opts) => {
    const app = boot();
    const made = app.generate(seed, opts);
    assert.strictEqual(made.ok, true, made.reason);
    return E.pdfdeck.fromGenerated({ deck: savedViews(app)[made.instanceId] }).legend_lines;
  };
  const has = (l) => l.some((x) => x.startsWith("TONEFIELD NUMBERS RUN 1 - "));
  assert.strictEqual(has(lines(W1_BOTTOM, {})), true);
  assert.strictEqual(has(lines(W1_BOTTOM, { mirrorBottom: true })), true);
  assert.strictEqual(has(lines(W1_BOTTOM, { mirror: true })), false);
  assert.strictEqual(has(lines(MN_KURD, { mirror: true })), false);
});












test("W1 (20.9): a deck generated with MIRROR TOP on and MIRROR BOTTOM off re-solves to the same fields under a seat correction", async () => {
  const app = boot();
  const plain0 = app.generate(W1_FULL, { mirror: true, mirrorBottom: false });
  assert.strictEqual(plain0.ok, true, plain0.reason);
  const id = app.get("[...savedEntries.keys()][0]");
  const flat = fieldAngles(savedViews(app)[id]);
  const seated = app.generate(W1_FULL, {
    mirror: true, mirrorBottom: false, seats: { rim: [1, 0, 2, 3, 4, 5, 6, 7, 8] } });
  assert.strictEqual(seated.ok, true, seated.reason);
  const after = fieldAngles(savedViews(app)[seated.instanceId]);
  let compared = 0;
  for (const fid of Object.keys(flat)) {
    if (flat[fid].zone !== "bottom") continue;
    assert.strictEqual(after[fid].angle, flat[fid].angle, `bottom field ${fid} was reflected by the re-solve`);
    compared += 1;
  }
  assert.ok(compared > 0);
});



/* ------------------------------------------------------------------ Lane G2b
 * The flip. Tests below that were written AFTER the implementation are marked
 * "(pin)" in their title; the rest were written red first. */

const PLACEHOLDER = "[C3] [D3] (E3) [F#3] [G3] [A3] B3 [C4] D4 E4 F#4 G4 A4 B4 [C5] D5 E5 | F#5 G5 A5";
const indexSource = () => require("node:fs").readFileSync(require("./helpers/sandbox.js").APP, "utf8");
const placeholderOf = () => /id="scale-box"[\s\S]{0,400}?placeholder="([^"]+)"/.exec(indexSource())[1];

test("a version 2 record with a bar opens with bottom notes, not inner notes, and is rewritten as version 4 at the same index", async () => {
  const key = boot().get("SCALES_KEY");
  const first = { v: 2, s: "(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4", o: {} };
  const bar = { v: 2, s: PYGMY_LEGACY, o: {} };
  const app = boot({ storage: { [key]: JSON.stringify([first, bar]) } });
  const d = Object.values(savedViews(app)).find((x) => x.fields && Object.values(x.fields).some((f) => f[F_ZONE] === "bottom"));
  assert.ok(d, "the bar record did not open");
  assert.strictEqual(ringIdsOf(d, "bottom").length, 6, "the bar list was not read as bottom notes");
  assert.strictEqual(ringIdsOf(d, "inner").length, 0, "the bar list was read as inner notes");
  const list = scalesOf(app);
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].v, 4);
  assert.strictEqual(list[1].v, 4);
  assert.strictEqual(list[1].s, app.get(`HPE.core.formatSeed(HPE.core.parseLegacySeed(${JSON.stringify(PYGMY_LEGACY)}).value.fields)`));
});







test("TOO_MANY_RIM is not in REASONS and thirteen rim notes generate a deck", async () => {
  const app = boot();
  assert.strictEqual(app.get(`"TOO_MANY_RIM" in HPE.core.REASONS`), false);
  const thirteen = "(C3) D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4";
  const d = await makeCustom(app, thirteen);
  assert.ok(d && d.chords.length > 0);
  assert.strictEqual(ringIdsOf(d, "rim").length, 12);
});

test("a hundred-and-first top note does not collide with a bottom id", async () => {
  const app = boot();
  const PCS = "C C# D D# E F F# G G# A A# B".split(" ");
  const name = (m) => PCS[m % 12] + (Math.floor(m / 12) - 1);
  const top = [];
  for (let m = 13; m <= 113; m += 1) top.push(name(m));
  assert.strictEqual(top.length, 101);
  const res = app.generate("[C-1] (C0) " + top.join(" "), {});
  assert.strictEqual(res.ok, true, res.reason);
  const ids = Object.keys(res.value.fields);
  assert.strictEqual(new Set(ids).size, ids.length, "two fields share an id");
  assert.strictEqual(ids.length, 103);
});


test("the boot rewrite leaves an unreadable record byte-identical at its index", async () => {
  const key = boot().get("SCALES_KEY");
  const recs = [{ v: 2, s: "(D3) A3 C4 D4 E4 F4 G4 A4 C5", o: {} }, UNREADABLE, { v: 3, s: "(C#3) G#3 B3 C#4 D4 F4 F#4 G#4 B4", o: {} }];
  const app = boot({ storage: { [key]: JSON.stringify(recs) } });
  const list = scalesOf(app);
  assert.strictEqual(list.length, 3);
  assert.deepStrictEqual(list[1], UNREADABLE);
  assert.strictEqual(list[0].v, 4);
  assert.strictEqual(list[2].v, 4);
  assert.strictEqual(list[0].s, "(D3) A3 C4 D4 E4 F4 G4 A4 C5");
});

test("migration retains both same-inventory records and their source order across versions", async () => {
  const key="hpfc.scales.v3",records=[{v:2,s:PYGMY_LEGACY,o:{name:"One"}},{v:4,s:PYGMY_STRING,o:{name:"Two"}}],raw=JSON.stringify(records);
  const app=await durableBoot({storage:{[key]:raw}}),e=savedEnvelope(app);
  assert.deepStrictEqual(Object.values(savedViews(app)).map(d=>d.name),["One","Two"]);assert.strictEqual(e.entries.length,2);
  assert.notStrictEqual(e.entries[0].instanceId,e.entries[1].instanceId);assert.deepStrictEqual(e.entries.map(row=>row.displayOrdinal),[1,2]);
  assert.deepStrictEqual(e.entries.map(row=>row.record.o.name),["One","Two"]);assert.strictEqual(e.entries[0].record.v,4);assert.strictEqual(e.entries[1].record.v,4);
  assert.strictEqual(app.store[key],raw);assert.strictEqual(e.migration.raw[key],raw);assert.deepStrictEqual(e.migration.instanceIds,e.entries.map(row=>row.instanceId));
});

test("a throwing migration write leaves the old list and its session view intact", async () => {
  const key="hpfc.scales.v3",raw=JSON.stringify([{v:2,s:"(D3) A3 C4 D4 E4 F4 G4 A4 C5",o:{}}]);
  const app=await durableBoot({storage:{[key]:raw},idbFault:{operation:"put",error:new Error("public test denied")}});
  // Preserve exact recovery bytes; attempted IDB failure does not silently
  // declare the legacy copy current. Temporary operation is explicit.
  assert.strictEqual(app.store[key],raw);assert.strictEqual(app.get("savedMode"),"protected");assert.strictEqual(savedRaw(app),undefined);
  assert.strictEqual(app.els["saved-temporary-use"].hidden,false);
  const writes=app.idb.operations.filter(x=>x.operation==="put").length;
  app.els["saved-temporary-use"].click();assert.strictEqual(app.get("savedMode"),"session");
  openSheet(app);app.type(JSON.parse(raw)[0].s);await generateClick(app);
  assert.strictEqual(Object.keys(savedViews(app)).length,1,"explicit recovery can regenerate the old scale temporarily");
  assert.strictEqual(app.store[key],raw);assert.strictEqual(savedRaw(app),undefined);
  assert.strictEqual(app.idb.operations.filter(x=>x.operation==="put").length,writes);
});

test("the boot rewrite of a legacy record with a hundred and one top notes keeps every note", async () => {
  const PCS = "C C# D D# E F F# G G# A A# B".split(" ");
  const top = [];
  for (let m = 13; m <= 113; m += 1) top.push(PCS[m % 12] + (Math.floor(m / 12) - 1));
  const key = boot().get("SCALES_KEY");
  const rec = { v: 3, s: "(C0) " + top.join(" ") + " | D0", o: {} };
  const raw=JSON.stringify([rec]);const app = await durableBoot({ storage: { [key]: raw } });
  const fields = Object.values(savedViews(app))[0].fields;
  assert.strictEqual(Object.keys(fields).length, 103);
  assert.strictEqual(app.store[key],raw,"legacy record bytes are retained");
  const rewritten = savedEnvelope(app).entries[0].record;
  assert.strictEqual(rewritten.v, 4);
  assert.ok(/F8/.test(rewritten.s), rewritten.s);
  assert.ok(/\[D0\]/.test(rewritten.s), rewritten.s);
});

// Plan section 19 R5: 20 rim, 8 inner, 12 bottom, drawn from the placeholder's
// pitch set (C D E F# G A B). The budget is the larger of three times the wall
// time measured on CI and 1000 ms (plan section 20.11); over 5 s the lane stops
// instead of raising it. CI measured 14 ms (run 37715956008, js suites).
const FORTY_MEASURED_MS = 14;
const FORTY_BUDGET_MS = Math.max(3 * FORTY_MEASURED_MS, 1000);
test("a forty-note pan generates its deck inside the time budget", async () => {
  const app = boot();
  const bottom = "[G1] [A1] [B1] [C2] [D2] [E2] [F#2] [G2] [A2] [B2] [C3] [D3]";
  const rim = "F#3 G3 A3 B3 C4 D4 E4 F#4 G4 A4 B4 C5 D5 E5 F#5 G5 A5 B5 C6 D6";
  const inner = "E6 F#6 G6 A6 B6 C7 D7 E7";
  const seed = bottom + " (E3) " + rim + " | " + inner;
  const parsed = app.get(`HPE.core.parseSeed(${JSON.stringify(seed)})`);
  assert.strictEqual(parsed.ok, true, parsed.reason);
  assert.strictEqual(Object.keys(parsed.value.fields).length, 41, "ding + 40 notes");
  const t0 = Date.now();
  const res = app.generate(seed, {});
  const ms = Date.now() - t0;
  assert.strictEqual(res.ok, true, res.reason);
  assert.ok(ms < FORTY_BUDGET_MS, `${ms} ms against a ${FORTY_BUDGET_MS} ms budget`);
});

const CROWDED = "(C3) " + "D3 E3 F3 G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6 D6 E6 F6".split(" ").join(" ");




/* ------------------------------ DR1: the layout drawer shell ----------------
 * Lane DR1 of docs/plans/2026-10-07-scale-drawer-design-spec.md. The numbers in
 * the test names are the spec's acceptance lines. Lines that need a layout
 * engine (positions, sizes, focus rings) are in tests/e2e.test.js. */
const DR1_STATUS = {
  paused: "Layout is paused until the scale parses.",
  ready: "Layout is ready again.",
  noRing: "This pan has no ring with two notes, so there is nothing to rearrange.",
};
const DR1_PYGMY_MAKER = "[C3] [Db3] [Eb3] F3 | G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]";
const dr1El = (app, id) => app.els[id];
const dr1Open = (app, text = W1_NONE) => {
  openSheet(app);
  if (text !== null) app.type(text);
  return app.els;
};
const dr1Close = (app) => {
  app.click(app.els["scale-tab-scale"]);
};
const DR1_HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "");
/* Sheet guidance (plan docs/plans/2026-10-13-sheet-guidance.md, lane app). The
   sandbox's _markupParent links only ids in ELEMENT_IDS, and the wrapper is
   deliberately not one (the app never looks it up), so the structure is read
   from the served markup string with a depth walk, the way the DR2a order
   test reads it. */
const SG_HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
  .replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, "");
const sgSpan = (open) => {
  const start = SG_HTML.indexOf(open);
  assert.ok(start >= 0, `no ${open} in the markup`);
  let depth = 0;
  for (const m of SG_HTML.slice(start).matchAll(/<(\/?)div\b[^>]*>/g)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return { start, end: start + m.index + m[0].length, html: SG_HTML.slice(start, start + m.index + m[0].length) };
  }
  throw new assert.AssertionError({ message: `${open} is never closed` });
};
/* N-A1: every notice string is read THROUGH the slot. dr1Notice and the S_NOTICE
   table read the element by reference, which is blind to where it sits, so
   they assert the position on every read. */
const sgNoticeInSlot = () => {
  const slot = sgSpan('<div id="scale-guidance"');
  const at = SG_HTML.indexOf('id="scale-layout-state"');
  assert.ok(at > slot.start && at < slot.end, "the notice is read from outside #scale-guidance");
};

/** The shipped markup of one element: its opening tag attributes and inner text. */
const dr1Markup = (id) => {
  const m = new RegExp(`<(\\w+)([^>]*)\\bid="${id}"([^>]*)>([\\s\\S]*?)</\\1>`).exec(DR1_HTML);
  assert.ok(m, `no #${id} in the markup`);
  const attrs = (m[2] + " " + m[3]);
  return { attrs, text: m[4].replace(/<[^>]*>/g, "").trim(),
    attr: (k) => { const a = new RegExp(`\\b${k}="([^"]*)"`).exec(attrs); return a ? a[1] : null; } };
};
const dr1Toggle = (app) => app.els["scale-tab-layout"];
const dr1Notice = (app) => (sgNoticeInSlot(), app.els["scale-layout-state"].hidden ? "" : app.els["scale-layout-state"].textContent);
const dr1Tabs = (app, from, n) => {
  app.els[from].focus();
  const seen = [];
  for (let i = 0; i < n; i += 1) {
    app.els["scale-sheet"].dispatchEvent(
      { type: "keydown", key: "Tab", shiftKey: false, preventDefault() {} });
    seen.push(app.activeId());
  }
  return seen;
};
const dr1Angles = (deck) => Object.fromEntries(
  Object.values(deck.fields).filter((f) => f[3] !== "ding").map((f) => [f[2], f[4]]));






















test("DR1 line 40: the pan drawn with interactive off is byte-identical to the shipped output for all five built-in decks", async () => {
  const crypto = require("node:crypto");
  const fixture = require("./fixtures/pan_render_v1.json");
  const digest = (x) => crypto.createHash("sha256").update(x).digest("hex").slice(0, 16);
  const app = boot();
  const D = decks(app);
  assert.strictEqual(D.length, 5);
  for (let di = 0; di < D.length; di++) {
    const rows = fixture.decks[D[di].id];
    assert.ok(rows, `${D[di].id} has no committed digest`);
    for (const off of ["pan(DECKS[%d], null)", "pan(DECKS[%d], null, {interactive:false})", "pan(DECKS[%d], null, {})"]) {
      assert.strictEqual(digest(app.get(off.replace("%d", di))), rows.null, `${D[di].id}: ${off} drifted from the shipped output`);
    }
    for (let ci = 0; ci < D[di].chords.length; ci++) {
      const off = app.get(`pan(DECKS[${di}], DECKS[${di}].chords[${ci}], {interactive:false})`);
      assert.strictEqual(digest(off), rows[ci], `${D[di].id} #${ci + 1}: interactive:false drifted from the shipped card`);
    }
  }
});





/* ---- DR1 rule S (plan 20.16): the layout state, enumerated ---------------- */

// Spec 16.1 to 16.3, as literals. Nothing below asks the app what it should say.
const S_NOTICE = {
  // [sheet][differs][custom]
  add: { true: { true: "Layout not saved yet. GENERATE CARDS keeps it.", false: "Layout not saved yet. GENERATE CARDS keeps it." },
         false: { true: "", false: "" } },
  edit: { true: { true: "Layout not saved yet. SAVE CHANGES keeps it.", false: "Layout not saved yet. SAVE CHANGES keeps it." },
          false: { true: "Layout changed from the default.", false: "" } },
};
const S_HINT = {
                 empty: "Type a scale to adjust its layout." };
const S_BUTTON = { add: "GENERATE CARDS", edit: "SAVE CHANGES" };
const S_BOXES = {
  plain: "(D3) A3 C4 D4 E4 F4 G4 A4 C5",
  bottom: "[C3] (D3) A3 C4 D4 E4 F4 G4 A4 C5",
  inner: "(D3) A3 C4 D4 E4 F4 G4 | A4 C5",
  innerBottom: "[C3] (D3) A3 C4 D4 E4 F4 G4 | A4 C5",
};
const S_HAS_BOTTOM = { plain: false, bottom: true, inner: false, innerBottom: true };


/* ------------------------------ DR2a: seats without a drag ------------------
 * Lane DR2a of docs/plans/2026-10-07-scale-drawer-design-spec.md, read through
 * plan section 20.17. Unit layer: every expectation below is a literal table or
 * a small model written here from the spec; none is read from the app's own
 * functions. The browser layer is tests/editor_e2e.test.js. */
const D2_NAT = ["C", "D", "E", "F", "G", "A", "B"];
/** n natural notes from `start` ("E3") upward. */
function d2Nat(start, n) {
  let i = D2_NAT.indexOf(start[0]);
  let oct = Number(start.slice(1));
  const out = [];
  for (let k = 0; k < n; k += 1) {
    out.push(D2_NAT[i] + oct);
    i += 1;
    if (i === 7) { i = 0; oct += 1; }
  }
  return out;
}
/** The scale with `sz` notes in each ring, and the note names of each ring in
 *  ascending order (which is the order of the ring's permutation). */
function d2Build(sz) {
  const bottom = d2Nat("C1", sz.bottom);
  const rim = d2Nat("E3", sz.rim);
  const inner = rim.length ? d2Nat(rim[rim.length - 1], sz.inner + 1).slice(1) : d2Nat("E3", sz.inner);
  const parts = [...bottom.map((n) => `[${n}]`), "(A2)", ...rim];
  if (inner.length) parts.push("|", ...inner);
  return { text: parts.join(" "), names: { rim, inner, bottom } };
}
const D2_RINGS = ["rim", "inner", "bottom"];
const d2Sizes = (ring, n) => ({ rim: 3, inner: 3, bottom: 3, [ring]: n });
const d2Id = (n) => Array.from({ length: n }, (_, i) => i);
async function d2Open(app, text, edit) {
  if (edit) openEdit(app, await makeCustom(app, text));
  else { openSheet(app); app.type(text); }
  app.click(app.els["scale-tab-layout"]);
}
const d2Hit = (app, name) => {
  const h = app.hits().find((n) => String(n.getAttribute("aria-label")).startsWith(name + ","));
  assert.ok(h, `no hit target for ${name}`);
  return h;
};
/** A pointer tap: the press focuses the note, then the click arrives. */
const d2Tap = (app, name) => { const h = d2Hit(app, name); h.focus(); app.click(h); };
const d2Key = (app, name, key) => { const h = d2Hit(app, name); h.focus(); return app.press(h, key); };
const d2Seats = (app) => JSON.parse(app.get("JSON.stringify(layoutSeats)"));
const d2Pick = (app) => JSON.parse(app.get("JSON.stringify(pickRef)"));
const d2Status = (app) => app.els["scale-drawer-status"].textContent;
const d2Norm = (seats) => {
  const out = {};
  for (const r of D2_RINGS) {
    const l = seats && seats[r];
    if (l && l.some((s, i) => s !== i)) out[r] = l;
  }
  return Object.keys(out).length ? out : null;
};
const d2Seed = (app, seats) => {
  app.run(`setPick(null); layoutSeats = ${JSON.stringify(seats)}; resyncSheet(true)`);
};
/** The model of an exchange: the notes at list[i] and list[j] trade seats. */
const d2Exchange = (list, i, j) => { const l = list.slice(); [l[i], l[j]] = [l[j], l[i]]; return l; };
const d2Starts = (k) => {
  const out = [["default", d2Id(k)]];
  out.push(["exchange", d2Exchange(d2Id(k), 0, 1)]);
  if (k >= 3) out.push(["cycle", d2Id(k).map((i) => (i < 3 ? (i + 1) % 3 : i))]);
  return out;
};
const D2_OTHER = [1, 0, 2];
async function d2Case(ring, n, start, edit) {
  const app = boot();
  const sc = d2Build(d2Sizes(ring, n));
  await d2Open(app, sc.text, edit);
  const seats = {};
  for (const r of D2_RINGS) seats[r] = r === ring ? start : D2_OTHER;
  d2Seed(app, seats);
  return { app, sc, seats };
}
const d2AllRings = [["rim", 20], ["inner", 8], ["bottom", 8]];

/* Rule P. The fixture is D Amara 9's maker string: its rim angles are the
 * verified ones of docs/CARD-SPEC.md (1 A3 @270 ... 8 C5 @90), so the place word of
 * every seat is a literal here. */
const D2_AMARA = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
const D2_NOTES = ["A3", "C4", "D4", "E4", "F4", "G4", "A4", "C5"];
const D2_PLACE = ["bottom", "lower left", "lower right", "left", "right", "upper left", "upper right", "top"];
const D2_SEAT_OF = (seats) => (name) => (seats ? seats.indexOf(D2_NOTES.indexOf(name)) >= 0 : false);
const d2Pressed = (app) => app.hits().filter((h) => h.getAttribute("aria-pressed") === "true")
  .map((h) => h.getAttribute("aria-label").split(",")[0]);
const d2Rover = (app) => app.hits().filter((h) => h.getAttribute("tabindex") === "0")
  .map((h) => h.getAttribute("aria-label").split(",")[0]);
const d2Focus = (app) => {
  const f = app.activeHit();
  if (f === null) return app.activeId();
  const h = app.hits().find((n) => n.getAttribute("data-field") === f);
  return h.getAttribute("aria-label").split(",")[0];
};






/* Rule C: the model of spec section 14. Each ring holds an arrangement and a
 * memory of the arrangement at every count it has left. */
const D2_ORDINAL = { rim: "rim", inner: "inner", bottom: "bottom" };
const d2Row = (ring, k, restored) => (restored
  ? `The ${ring} is back to ${k} notes, so its earlier seats were restored.`
  : `The ${ring} now has ${k === 1 ? "1 note" : k + " notes"}, so its seats were reset.`);
function d2Model(counts) {
  const m = { counts: { ...counts }, cur: {}, mem: {} };
  for (const r of D2_RINGS) { m.cur[r] = null; m.mem[r] = {}; }
  m.step = (next) => {
    const said = [];
    for (const r of D2_RINGS) {
      if (next[r] === m.counts[r]) continue;
      m.mem[r][m.counts[r]] = m.cur[r];
      const had = Object.prototype.hasOwnProperty.call(m.mem[r], next[r]);
      m.cur[r] = had ? m.mem[r][next[r]] : null;
      said.push(d2Row(r, next[r], had));
      m.counts[r] = next[r];
    }
    return said;
  };
  m.arrangement = () => d2Norm(Object.fromEntries(D2_RINGS.map((r) => [r, m.cur[r]])));
  return m;
}
const d2Parses = (app, text) => app.get(`HPE.core.parseSeed(${JSON.stringify(text)}, {}).ok`);



/* Rule R (item 8, F1). Pygmy's rim, inner and bottom angles: the first table is
 * docs/CARD-SPEC.md's anchor-between listing (rim and bottom as verified, inner 128/52),
 * the second is the engine's anchor-one output for the same maker string. */
const D2_PYGMY_BETWEEN = { G3: 290, Ab3: 250, C4: 330, Eb4: 210, F4: 10, G4: 170, Ab4: 50, C5: 130, Eb5: 90,
  F5: 128, G5: 52, C3: 300, Db3: 240, Eb3: 0, Bb3: 180, Db4: 60, Ab5: 120 };
const D2_PYGMY_ONE = { G3: 270, Ab3: 230, C4: 310, Eb4: 190, F4: 350, G4: 150, Ab4: 30, C5: 110, Eb5: 70,
  F5: 128, G5: 52, C3: 300, Db3: 240, Eb3: 0, Bb3: 180, Db4: 60, Ab5: 120 };
const D2_BOTTOM = ["C3", "Db3", "Eb3", "Bb3", "Db4", "Ab5"];
const d2Mirror = (table, top, bottom) => Object.fromEntries(Object.entries(table).map(([n, a]) =>
  [n, ((D2_BOTTOM.includes(n) ? bottom : top) ? 180 - a : a) + 720].map((v) => (typeof v === "number" ? v % 360 : v))));
const d2Drawn = (app) => Object.fromEntries(app.hits().map((h) => {
  const name = h.getAttribute("aria-label").split(",")[0];
  const deg = (Math.atan2(-Number(h.getAttribute("cy")), Number(h.getAttribute("cx"))) * 180) / Math.PI;
  return [name, Math.round((deg + 360) % 360)];
}));

/* Rule C, typed one keystroke at a time with the drawer open (review 1, F-2):
 * the keystroke that ends a pause and also changes a ring's count gives ONE
 * message, row 18b first, then the count sentence. */
const d2Keystrokes = (app, steps) => steps.map((t) => { app.type(t); return d2Status(app); });




/** The marks of a picked note, split by class: each tag's attributes. */
const d2Mark = (html, cls) => {
  const m = new RegExp(`<circle class="${cls}"[^>]*>`).exec(html);
  assert.ok(m, `no .${cls} in the plate markup`);
  const num = (a) => Number(new RegExp(`\\b${a}="([\\d.]+)"`).exec(m[0])[1]);
  return { r: num("r"), sw: num("stroke-width"), stroke: /stroke="([^"]+)"/.exec(m[0])[1] };
};








/* ------------------------------------------------------------------ DR2b: the drag
 * Pointer and touch drag of a note, unit layer. The sandbox plate sits at
 * (200, 200) at scale 1 and time is a virtual clock, so a touch trace is
 * exact: nothing happens between app.advance() calls. */
const DG = require("./helpers/drag.js");
const dgOpen = async (opts, text = D2_AMARA, edit = false) => {
  const app = boot({ clock: true, ...opts });
  await d2Open(app, text, edit);
  return app;
};
const dgRingText = d2Build({ rim: 4, inner: 4, bottom: 4 });
const dgPress = (app) => app.get("press");
const dgSeats = (app) => d2Norm(d2Seats(app));
const dgTouchmove = (app, node) => app.touchmove(node, {});

describe("DR2b drag, mouse", () => {













});

describe("DR2b drag, touch (rule T traces on a controlled clock)", () => {











});

describe("DR2b refused drops and reduced motion", () => {

});

describe("DR2b item 2: a ring of one note", () => {
  const one = d2Build({ rim: 3, inner: 1, bottom: 0 });
  const ONE = one.text;
  const [LONE] = one.names.inner;
  const [RIM0] = one.names.rim;

});

describe("DR2b review 1 (20.22 steps 2, 3, 5, 6)", () => {








});

/* ------------------------------------------------ DR3 rule N and rule W
 * A seat's number is the number the default arrangement drew there. A moved
 * note takes the number of the seat it now fills, on the plate, the card
 * number line and the PDF. Seats are named by that drawn number. */

/** The number the plate draws in seat k of a ring: the default label (rule N). */
const dr3SeatLabel = (app, text, ring, k) => {
  const f = plain(app.get(`HPE.core.parseSeed(${JSON.stringify(text)}, {}).value.fields`));
  const ids = Object.keys(f).filter((id) => f[id][3] === ring).sort((a, b) => Number(a) - Number(b));
  return f[ids[k]][5];
};
const DR3_D3 = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
const DR3_KURD = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5";
const DR3_SWAPPED = { rim: [1, 0, 2, 3, 4, 5, 6, 7] };
const dr3Digest = (x) => require("node:crypto").createHash("sha256").update(x).digest("hex").slice(0, 16);

/** Everything a deck puts in front of a player, hashed: its record, every
 *  card face, every number line, and the bytes of its chord-card PDF. */
function dr3Surface(text) {
  const app = boot();
  const made = app.generate(text, {});
  assert.strictEqual(made.ok, true, made.reason);
  const id = made.instanceId;
  app.select(id);
  const deck = `savedEntries.get(${JSON.stringify(id)}).deck`;
  const n = app.get(`${deck}.chords.length`);
  const faces = [app.get(`pan(${deck}, null)`)];
  for (let i = 0; i < n; i += 1) {
    faces.push(app.get(`pan(${deck}, ${deck}.chords[${i}])`));
    faces.push(app.get(`linesHTML(${deck}, ${deck}.chords[${i}])`));
  }
  app.run('downloadDeckPDF("shop")');
  const bytes = Buffer.from(app.blobs()[0].parts[0]);
  return {
    record: dr3Digest(JSON.stringify(plain(app.get(deck)))),
    faces: dr3Digest(faces.join("\n")),
    pdf: dr3Digest(bytes),
  };
}

const DR3_UNMOVED = {
  "D3 example": { record: "98fc2a3daf186423", faces: "f40c14454a44c68e", pdf: "77d68a8b11aa417b" },
  "D Kurd 10": { record: "a88c6144c4c59f10", faces: "2ffb8e4a89d70314", pdf: "0a36f7923b3edc90" },
  "F3 Low Pygmy": { record: "d1ecde6dbdfa6f27", faces: "7d89a6a05bc946d8", pdf: "c145121fbca4d228" },
};

test("rule N: a deck with no moved seat is byte-identical in generateDeck output, card markup and PDF", async () => {
  const got = {
    "D3 example": dr3Surface(DR3_D3),
    "D Kurd 10": dr3Surface(DR3_KURD),
    "F3 Low Pygmy": dr3Surface(DR1_PYGMY_MAKER),
  };
  assert.deepStrictEqual(got, DR3_UNMOVED);
});

test("rule N: generateDeck gives the plate and the card number line the seat number", async () => {
  const app = boot();
  const made = app.generate(DR3_D3, { seats: DR3_SWAPPED });
  assert.strictEqual(made.ok, true, made.reason);
  const deck = savedViews(app)[made.instanceId];
  assert.strictEqual(deck.fields["1"][5], "2", "A3 sits in seat 2");
  assert.strictEqual(deck.fields["2"][5], "1", "C4 sits in seat 1");
  assert.deepStrictEqual(Object.keys(deck.fields).filter((k) => k > 2).map((k) => deck.fields[k][5]),
    ["3", "4", "5", "6", "7", "8"]);
  const expr = `savedEntries.get(${JSON.stringify(made.instanceId)}).deck`;
  const chords = plain(deck.chords);
  chords.forEach((ch, i) => {
    const line = app.get(`linesHTML(${expr}, ${expr}.chords[${i}])`);
    const numline = /<div class="numline">([\s\S]*)<\/div><\/div>/.exec(line)[1];
    const got = [...numline.matchAll(/>(\d+)<\/span>/g)].map((m) => m[1]);
    assert.deepStrictEqual(got, ch.fields.map((f) => deck.fields[f][5]), `${ch.main} number line`);
  });
  const svg = app.get(`pan(${expr}, ${expr}.chords[0])`);
  const labels = [...svg.matchAll(/<text[^>]*>(\d+)<\/text>/g)].map((m) => m[1]);
  assert.ok(labels.includes("2") && labels.includes("1"), "the plate draws the seat numbers");
});

test("rule N matrix: every scale, anchor, mirror and swap count keeps each ring's labels and the number line", async () => {
  const swaps = [[1, 0], [2, 1, 0]];
  const cases = [["D3 example", DR3_D3], ["D Kurd 10", DR3_KURD], ["F3 Low Pygmy", DR1_PYGMY_MAKER]];
  const app = boot();
  for (const [name, text] of cases) {
    const base = plain(app.get(`HPE.core.parseSeed(${JSON.stringify(text)}, {}).value.fields`));
    const rimIds = Object.keys(base).filter((id) => base[id][3] === "rim").sort((a, b) => a - b);
    for (const anchor of ["one", "between"]) {
      for (const mirror of [false, true]) {
        for (const nSwaps of [1, 3]) {
          const order = rimIds.map((_, i) => i);
          for (let k = 0; k < nSwaps; k += 1) [order[k], order[k + 1]] = [order[k + 1], order[k]];
          const tag = `${name} ${anchor} mirror=${mirror} swaps=${nSwaps}`;
          const made = app.generate(text, { anchor, mirror, seats: { rim: order } });
          assert.strictEqual(made.ok, true, `${tag}: ${made.reason}`);
          const deck = savedViews(app)[made.instanceId];
          const rimLabels = Object.keys(deck.fields).filter((id) => deck.fields[id][3] === "rim").map((id) => deck.fields[id][5]);
          assert.deepStrictEqual([...rimLabels].sort(), rimIds.map((id) => base[id][5]).sort(), `${tag}: rim labels are the default set`);
          const expr = `savedEntries.get(${JSON.stringify(made.instanceId)}).deck`;
          plain(deck.chords).forEach((ch, i) => {
            const line = app.get(`linesHTML(${expr}, ${expr}.chords[${i}])`);
            const numline = /<div class="numline">([\s\S]*)<\/div><\/div>/.exec(line)[1];
            const got = [...numline.matchAll(/>(\d+)<\/span>/g)].map((m) => m[1]);
            assert.deepStrictEqual(got, ch.fields.map((f) => deck.fields[f][5]).filter((l) => /^\d+$/.test(l)), `${tag}: ${ch.main} number line`);
          });
        }
      }
    }
  }
});

test("rule N: a moved deck's stored record is the record and v6 string with no parent option", async () => {
  const app = boot();
  const made = app.generate(DR3_D3, { seats: DR3_SWAPPED, anchor: "between", mirror: true });
  assert.strictEqual(made.ok, true, made.reason);
  const expr = `savedEntries.get(${JSON.stringify(made.instanceId)}).deck`;
  assert.deepStrictEqual(plain(app.get(`savedState.entries.map(row=>row.record)`)), [{
    v: 4, s: "(D3) A3 C4 D4 E4 F4 G4 A4 C5",
    o: { palette: 0, mirror: true, mirrorBottom: true, anchor: "between", parent: null, seats: DR3_SWAPPED },
  }]);
  assert.strictEqual(plain(app.get(`shareLink(${expr})`)).value,
    "https://example.test/index.html#s=6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+9/mirror/between/seats-1,0,2,3,4,5,6,7;;/bbc2db");
  assert.strictEqual(app.get(`HPE.core.formatSeed(${expr}.fields)`), DR3_D3);
});

const dr3Names = (app) => Object.fromEntries(app.hits().map((h) => [h.getAttribute("data-field"), h.getAttribute("aria-label")]));



/* ------------------------------------------------ DR3 drawer: order, copy,
 * the finer-controls disclosure, RESET LAYOUT */

const DR3_STEPS = ["scale-note-prev", "scale-note-next", "scale-seat-prev", "scale-seat-next"];
const dr3Fine = (app) => app.els["scale-fine-toggle"];
const dr3Open = async (app, text, edit) => { await d2Open(app, text, edit); return app; };






const dr3Reset = (app) => app.els["scale-layout-reset"];




/* ---- Lane F: drawer follow-up (docs/plans/2026-10-09-lane-f-drawer-follow-up.md) ---- */

const LF_BAD_NAME = "D K\u0007urd";
const lfEditBadName = async (text = D2_AMARA) => {
  const app = boot();
  openEdit(app, await makeCustom(app, D2_AMARA));
  app.els["scale-name"].value = LF_BAD_NAME;
  app.els["scale-name"].dispatchEvent({ type: "input" });
  if (text !== D2_AMARA) app.type(text);
  return app;
};









/* ------------------------------ 27. editable defaults: fork, hide, restore */
//
// docs/plans/2026-10-09-editable-defaults.md, lane app (ED-A1..A7, A13..A15).
// Everything goes through app.run / the DOM; no new bare name is read, so
// app_surface_v1.json stays.

const PINNED_IDS = Object.values(JSON.parse(fs.readFileSync(
  path.join(ROOT, "tests/fixtures/deck_ids_v1.json"), "utf8")).pinned);
const BUILTIN_NAMES = ["D KURD 10", "D AMARA 10", "D AMARA 9", "C# HIJAZ 9", "F3 LOW PYGMY 18"];

const labels = (app) => chipRow(app).map((c) => c.label);
const hiddenKey = app => plain(app.get("savedState.hidden"));

/** Tap the SELECTED built-in's chip, then DELETE twice: arm, then confirm. */
async function hideViaSheet(app, id, name) {
  app.select(id);
  app.clickChip(name);
  await deleteClick(app);
  await deleteClick(app);
}

test("editable defaults: a fresh store lists the five decks in DECKS order, hides nothing and adds no key", async () => {
  const app = boot();
  assert.deepStrictEqual(labels(app), BUILTIN_NAMES);
  assert.strictEqual(app.els["deck-restore"].hasAttribute("hidden"), true,
    "the restore button is rendered on a fresh store");
  app.select("hijaz");
  assert.strictEqual(app.store.hpfc,undefined,"selection uses collection metadata without inventing legacy keys");
  assert.deepStrictEqual(plain(app.get("savedState.preferredSelection")),{kind:"builtin",id:"hijaz"});
});

test("editable defaults: a generated deck is chip 1 and a second pushes the first to chip 2", async () => {
  const app = await durableBoot();
  const one = await makeCustom(app);
  assert.deepStrictEqual(labels(app), [one.name, ...BUILTIN_NAMES]);
  const two = await makeCustom(app, OTHER_STRING);
  assert.deepStrictEqual(labels(app), [two.name, one.name, ...BUILTIN_NAMES]);
  assert.strictEqual(chipRow(app)[0].on, true, "the new deck's chip is not the selected one");
  const again = await durableBoot({origin:app.fixtureOrigin});
  assert.deepStrictEqual(labels(again), labels(app), "chip order changed across a reload");
});

test("editable defaults: deleting a seeded deck removes its chip, stores hidden and selects Kurd", async () => {
  const app = await durableBoot();
  await hideViaSheet(app, "amara", "D AMARA 9");
  assert.deepStrictEqual(labels(app), BUILTIN_NAMES.filter((n) => n !== "D AMARA 9"));
  assert.deepStrictEqual(hiddenKey(app), ["amara"]);
  assert.strictEqual(app.get("selection.id"), "kurd");
  assert.strictEqual(app.sheetOpen(), false, "the sheet stayed open after the hide");
  assert.strictEqual(app.els["deck-restore"].hasAttribute("hidden"), false, "no reset button while a deck is deleted");
  const again = await durableBoot({origin:app.fixtureOrigin});
  assert.deepStrictEqual(labels(again), labels(app), "a hidden built-in came back on reload");
  assert.strictEqual(again.announcer().textContent, "", "a hidden deck that was not selected warned at boot");
});

test("editable defaults: deleting the selected Kurd selects the first visible deck", async () => {
  const app = boot();
  await hideViaSheet(app, "kurd", "D KURD 10");
  assert.strictEqual(app.get("selection.id"), "amara10");
  assert.deepStrictEqual(hiddenKey(app), ["kurd"]);
  assert.strictEqual(app.get("savedState.preferredSelection.id"), "amara10");
  assert.strictEqual(chipRow(app)[0].on, true);
});

test("editable defaults: the fifth seeded delete with no custom deck is refused", async () => {
  const four = ["amara10", "amara", "hijaz", "pygmy"];
  const app = boot({ storage: { hpfc: JSON.stringify({ deck: "kurd", mode: "A", hidden: four }) } });
  assert.deepStrictEqual(labels(app), ["D KURD 10"]);
  app.run("openEditSheet(deck(), null)");
  await deleteClick(app);
  await deleteClick(app);
  assert.deepStrictEqual(labels(app), ["D KURD 10"], "the last visible deck was hidden");
  assert.deepStrictEqual(hiddenKey(app), four, "the refused hide rewrote or dropped the stored hidden list");
  assert.strictEqual(app.sheetOpen(), true, "the refused hide closed the sheet");
  assert.match(String(app.get("editorSession ? editorSession.error : ''")), /at least one scale/i);
});

test("editable defaults: saving each seeded deck with a palette change mints the fixture id as its replacement in the seeded slot", async () => {
  const prefilled = [6, 7, 2, 0, 1];
  for (const [i,name] of BUILTIN_NAMES.entries()) {
    const app = boot();
    const d = app.get("DECKS")[i];
    app.select(d.instanceId || d.id);
    app.run("openEditSheet(deck(), null)");
    assert.strictEqual(app.sheetOpen(), true, `${d.id}: the selected chip did not open the sheet`);
    assert.strictEqual(app.els["scale-box"].value, app.get(`HPE.core.formatTyped(DECKS[${i}].fields)`));
    app.els["scale-swatches"].children[(prefilled[i] + 1) % 10].click();
    await app.getAsync("replaceBuiltin()");
    assert.strictEqual(app.sheetOpen(), false, `${d.id}: the save did not close the sheet`);
    assert.strictEqual(app.currentDeck().id,"custom:"+PINNED_IDS[i].replace("custom:",""));
    assert.strictEqual(app.get("selection.kind"),"saved");
    assert.strictEqual(app.get("savedState.slots["+JSON.stringify(d.id)+"]"),app.get("selection.id"));
    assert.strictEqual(savedViews(app)[app.get("selection.id")].name, name);
    assert.deepStrictEqual(labels(app), BUILTIN_NAMES, `${d.id}: the replacement left the seeded slot`);
  }
});

test("editable defaults: RESET arms, then clears hidden and replacements and keeps custom decks", async () => {
  const app = boot();
  const mine = await makeCustom(app);
  await hideViaSheet(app, "amara", "D AMARA 9");
  await hideViaSheet(app, "hijaz", "C# HIJAZ 9");
  app.select("kurd");
  app.run("openEditSheet(deck(), null)");
  app.els["scale-swatches"].children[3].click();
  await app.getAsync("replaceBuiltin()");
  assert.deepStrictEqual(hiddenKey(app), ["amara", "hijaz"]);
  const reset = app.els["deck-restore"];
  await resetClick(app);
  assert.strictEqual(reset.textContent, "TAP AGAIN TO RESET");
  assert.deepStrictEqual(hiddenKey(app), ["amara", "hijaz"], "the first tap reset");
  assert.match(String(app.get("editorSession ? editorSession.error : ''")) + app.announcer().textContent, /edits to them will be gone/i);
  await resetClick(app);
  assert.deepStrictEqual(labels(app), [mine.name, ...BUILTIN_NAMES]);
  assert.deepStrictEqual(plain(app.get("savedState.hidden")),[],"RESET clears new-authority hidden state");
  assert.strictEqual(reset.hasAttribute("hidden"), true);
  assert.strictEqual(reset.textContent, "RESET SEEDED SCALES");
  assert.deepStrictEqual(Object.keys(savedViews(app)), [mine.instanceId], "RESET dropped a custom deck or kept a replacement");
  assert.strictEqual(app.activeId(), "deck-add");
  assert.strictEqual(app.announcer().textContent, "Seeded scales restored. Showing D KURD 10.");
  assert.deepStrictEqual(records(app).filter(r => r.o && r.o.replaces), [], "RESET left a stored record naming a seed");
});

test("editable defaults: saving seeded Kurd creates its slot owner without overwriting a same-inventory fork", async () => {
  const app=boot(),fork=app.generate(app.get("HPE.core.formatSeed(DECKS[0].fields)"),{palette:2,name:"MY KURD"});assert.strictEqual(fork.ok,true);
  const before=plain(app.get(`savedState.entries.find(row=>row.instanceId===${JSON.stringify(fork.instanceId)})`));
  app.select("kurd");app.run("openEditSheet(deck(), null)");app.els["scale-swatches"].children[3].click();await app.getAsync("replaceBuiltin()");
  assert.strictEqual(app.sheetOpen(),false);const owner=app.get("selection.id");assert.notStrictEqual(owner,fork.instanceId);
  assert.strictEqual(app.get("savedState.slots.kurd"),owner);assert.strictEqual(app.currentDeck().id,fork.value.id);
  assert.strictEqual(Object.keys(savedViews(app)).length,2);assert.deepStrictEqual(plain(app.get(`savedState.entries.find(row=>row.instanceId===${JSON.stringify(fork.instanceId)})`)),before);
  assert.strictEqual(savedViews(app)[fork.instanceId].name,"MY KURD");assert.strictEqual(savedViews(app)[fork.instanceId].options.palette,2);
});

test("editable defaults: with five decks hidden the last custom deck cannot be deleted", async () => {
  const four = ["amara10", "amara", "hijaz", "pygmy"];
  const app = boot({ storage: { hpfc: JSON.stringify({ deck: "kurd", mode: "A", hidden: four }) } });
  const c = await makeCustom(app);
  await hideViaSheet(app, "kurd", "D KURD 10");
  assert.deepStrictEqual(labels(app), [c.name], "setup: one custom deck should remain");
  app.select(c.instanceId || c.id);
  app.run("openEditSheet(deck(), null)");
  await deleteClick(app);
  await deleteClick(app);
  assert.deepStrictEqual(labels(app), [c.name], "the last visible deck was deleted");
  assert.ok(savedViews(app)[c.instanceId || c.id], "the registry lost the last visible deck");
});

test("editable defaults: deleting a custom deck with Kurd hidden selects and stores the fallback, never kurd", async () => {
  const app = boot();
  const c = await makeCustom(app);
  await hideViaSheet(app, "kurd", "D KURD 10");
  app.select(c.instanceId || c.id);
  app.clickChip(c.name);
  await deleteClick(app);
  await deleteClick(app);
  assert.strictEqual(app.get("selection.id"), "amara10", "the delete fell back to the hidden Kurd");
  assert.strictEqual(app.get("savedState.preferredSelection.id"), "amara10");
  assert.deepStrictEqual(labels(app), BUILTIN_NAMES.slice(1));
});


test("editable defaults: a stored hidden deck falls back to the first visible one with the gone warning", async () => {
  const app = await durableBoot({ storage: { hpfc: JSON.stringify({ deck: "pygmy", mode: "A", hidden: ["pygmy"] }) } });
  assert.strictEqual(app.get("selection.id"), "kurd");
  assert.deepStrictEqual(labels(app), BUILTIN_NAMES.slice(0, 4));
  assert.match(app.announcer().textContent, /That scale is gone\. Showing D KURD 10\./);
});

test("editable defaults: every built-in hidden in storage still opens a deck rather than a blank page", async () => {
  const all = ["kurd", "amara10", "amara", "hijaz", "pygmy"];
  const app = boot({ storage: { hpfc: JSON.stringify({ deck: "kurd", mode: "A", hidden: all }) } });
  assert.strictEqual(app.get("selection.id"), "kurd", "a corrupt store blanked the page");
  assert.ok(app.currentDeck().chords.length > 0);
});

test("editable defaults: new hidden metadata recognizes built-ins while malformed legacy preferences stay protected", async () => {
  const valid=JSON.stringify({deck:"kurd",mode:"A",hidden:["amara","custom:zz","nope"]}),app=await durableBoot({storage:{hpfc:valid}});
  assert.deepStrictEqual(labels(app),BUILTIN_NAMES.filter(name=>name!=="D AMARA 9"));app.select("hijaz");await writeBarrier(app);
  assert.deepStrictEqual(savedEnvelope(app).hidden,["amara"]);assert.strictEqual(app.store.hpfc,valid,"normalization never rewrites original preference evidence");
  const malformed=JSON.stringify({deck:"kurd",hidden:["amara",7]}),protectedApp=await durableBoot({storage:{hpfc:malformed}});
  assert.strictEqual(protectedApp.get("savedMode"),"protected");assert.strictEqual(protectedApp.store.hpfc,malformed);assert.strictEqual(protectedApp.store["hpfc.saved-scales.v1"],undefined);assert.deepStrictEqual(labels(protectedApp),BUILTIN_NAMES);
});

test("editable defaults: #deck-restore follows #deck-add, starts hidden and joins the panel stops only while rendered", async () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /id="deck-add"[^>]*>[^<]*<\/button>\s*<\/div>\s*<button[^>]*id="deck-restore"[^>]*\bhidden\b[^>]*>RESET SEEDED SCALES<\/button>/,
    "the restore button is not right after the Scales row, hidden, with its label");
  const app = boot();
  app.run("settingsPanel.querySelectorAll = () => []");
  const stops = () => app.get("panelStops().map((e) => e.id)");
  app.run("openPanel()");
  assert.strictEqual(app.els["deck-restore"].hidden, true, "the restore button shows on a fresh store");
  assert.ok(!stops().includes("deck-restore"), "a hidden restore button is a Tab stop");
  await hideViaSheet(app, "amara", "D AMARA 9");
  assert.ok(!app.els["deck-restore"].hidden, "the reset button stays hidden with a deck deleted");
  const ids = stops();
  assert.strictEqual(ids[ids.indexOf("deck-add") + 1], "deck-restore",
    "panelStops() does not list the restore button right after + ADD A SCALE");
});

/* ------------------------------- 28. seeded decks: SAVE / DELETE, not FORK / HIDE */
//
// docs/plans/2026-10-13-seeded-save-delete.md, lane app (SD-A2..A6, A15..A20).

const reboot = async app => {await writeBarrier(app);return durableBoot({origin:app.fixtureOrigin});};
const kurdString = (app) => app.get("HPE.core.formatSeed(DECKS[0].fields)");
const records = app => plain(app.get("savedState.entries.map(row=>row.record)"));

/** Open the seeded Kurd sheet, change its palette, SAVE. */
async function saveKurdRepainted(app, swatch = 3) {
  app.select("kurd");
  app.clickChip("D KURD 10");
  app.els["scale-swatches"].children[swatch].click();
  await app.getAsync("replaceBuiltin()");
  return savedViews(app)[app.get("selection.id")];
}


test("SD: saving a seeded deck unchanged closes the sheet and writes nothing", async () => {
  const app = boot();
  const before = JSON.stringify(app.store);
  app.clickChip("D KURD 10");
  await generateClick(app);
  assert.strictEqual(app.sheetOpen(), false, "an unchanged SAVE left the sheet open");
  assert.deepStrictEqual(savedViews(app), {}, "an unchanged SAVE minted a record");
  assert.deepStrictEqual(records(app), []);
  assert.strictEqual(app.get("selection.id"), "kurd");
  assert.deepStrictEqual(labels(app), BUILTIN_NAMES);
  assert.strictEqual(JSON.stringify(app.store), before, "an unchanged SAVE wrote to storage");
});

test("PD: seeded Kurd and Amara 10 Edit open on swatch 6 and 7, and a no-op SAVE writes nothing", async () => {
  for (const [name, want, id] of [["D KURD 10", 6, "kurd"], ["D AMARA 10", 7, "amara10"]]) {
    const app = boot();
    app.select(id);
    const before = JSON.stringify(app.store);
    app.run("openEditSheet(deck(), null)");
    assert.strictEqual(app.get("editorSession.history.present.options.palette"), want, `${name}: swatch ${want} is the one picked`);
    await generateClick(app);
    assert.strictEqual(app.sheetOpen(), false, `${name}: a no-op SAVE left the sheet open`);
    assert.deepStrictEqual(savedViews(app), {}, `${name}: a no-op SAVE minted a replacement`);
    assert.strictEqual(JSON.stringify(app.store), before, `${name}: a no-op SAVE wrote to storage`);
  }
});

test("PD: a record with palette 6 to 9 survives save, reload and reshare; palettes 0 to 5 reload unchanged", async () => {
  for (const palette of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const app = await durableBoot();
    openSheet(app);
    app.type(AMARA_STRING);
    app.els["scale-swatches"].children[palette].click();
    await generateClick(app);
    const id = app.get("selection.id");
    const palettes = app.get("HPE.select.PALETTES");
    const saved = savedViews(app)[id];
    assert.strictEqual(saved.options.palette, palette, `palette ${palette} saved`);
    assert.strictEqual(saved.colors.root, palettes[palette].root);
    assert.strictEqual(saved.colors.tone, palettes[palette].tone);
    const code = app.get(`shareCode(savedEntries.get(${JSON.stringify(id)}).deck).value`);
    const again = await reboot(app);
    const backId = again.get("selection.id");
    const back = savedViews(again)[backId];
    assert.strictEqual(back.options.palette, palette, `palette ${palette} reloaded`);
    assert.strictEqual(back.colors.root, palettes[palette].root);
    assert.strictEqual(back.colors.tone, palettes[palette].tone);
    assert.strictEqual(again.get(`shareCode(savedEntries.get(${JSON.stringify(backId)}).deck).value`), code, `palette ${palette} reshares the same code`);
    if (palette >= 6) assert.match(code, new RegExp(`/palette-${palette + 1}/`));
  }
});

test("SD: a replacement takes the seeded slot across a reload and a field edit", async () => {
  const app = await durableBoot();
  const rep = await saveKurdRepainted(app);
  assert.deepStrictEqual(labels(app), BUILTIN_NAMES, "the replacement left Kurd's slot");
  assert.strictEqual(rep.options.replaces, "kurd");
  assert.strictEqual(records(app)[0].o.replaces, "kurd");
  const again = await reboot(app);
  assert.deepStrictEqual(labels(again), BUILTIN_NAMES, "the slot did not survive a reload");
  assert.strictEqual(savedViews(again)[rep.instanceId || rep.id].options.replaces, "kurd");

  again.select(rep.instanceId || rep.id);
  again.clickChip("D KURD 10");
  const handle=rep.instanceId || rep.id,before=savedEnvelope(again);
  const expectedSeed="(D3) Ab3 Bb3 C4 D4 E4 F4 G4 A4 C5";
  // A#3 would duplicate the existing Bb3 and rightly refuse Save. Ab3 is a
  // valid, distinct field change under the existing duplicate-note policy.
  again.type(again.els["scale-box"].value.replace(/A3/,"Ab3"));
  await generateClick(again);
  assert.strictEqual(again.sheetOpen(),false,"the valid field edit actually completes Save");
  const changed=savedEnvelope(again);
  assert.strictEqual(changed.entries[0].instanceId,handle);
  assert.strictEqual(changed.entries[0].record.s,expectedSeed,"the replacement commits the literal changed note content");
  assert.notStrictEqual(changed.entries[0].record.s,before.entries[0].record.s);
  assert.strictEqual(changed.entries[0].record.o.replaces,"kurd","the committed edited record retains its seeded slot authority");
  const rim=Object.values(again.currentDeck().fields).filter(field=>field[3]==="rim").map(field=>field[2]);
  assert.deepStrictEqual(rim,[56,58,60,62,64,65,67,69,72],"the edited rim contains Ab3 and has no former A3/MIDI57");
  assert.ok(!rim.includes(57));
  assert.deepStrictEqual(labels(again), BUILTIN_NAMES, "a field edit moved the replacement out of the slot");
  assert.deepStrictEqual(Object.keys(savedViews(again)).length, 1);
  const reloaded=await reboot(again);
  assert.strictEqual(savedEnvelope(reloaded).entries[0].instanceId,handle);
  assert.strictEqual(savedEnvelope(reloaded).entries[0].record.s,expectedSeed);
  assert.strictEqual(savedEnvelope(reloaded).entries[0].record.o.replaces,"kurd");
  assert.deepStrictEqual(labels(reloaded), BUILTIN_NAMES);
});

test("SD: deleting a replacement does not bring the seed back", async () => {
  const app = await durableBoot();
  const rep = await saveKurdRepainted(app);
  app.clickChip("D KURD 10");
  await deleteClick(app);
  await deleteClick(app);
  assert.deepStrictEqual(savedViews(app), {});
  assert.deepStrictEqual(labels(app), BUILTIN_NAMES.slice(1), "deleting the replacement revived seeded Kurd");
  assert.deepStrictEqual(hiddenKey(app), ["kurd"]);
  assert.deepStrictEqual(labels(await reboot(app)), BUILTIN_NAMES.slice(1));
  assert.ok(rep);
});

test("SD: a replacement outranks a hidden seed in storage", async () => {
  const app = boot();
  await saveKurdRepainted(app);
  const hpfc={deck:"kurd",hidden:["kurd"]};
  const again=boot({storage:{hpfc:JSON.stringify(hpfc),[app.get("SCALES_KEY")]:JSON.stringify(records(app))}});
  assert.deepStrictEqual(labels(again), BUILTIN_NAMES, "a hidden seed hid its own replacement");
});

test("SD: an armed RESET disarms on a tap elsewhere, blur and panel close, and re-arms after", async () => {
  const app = boot();
  await hideViaSheet(app, "amara", "D AMARA 9");
  const reset = app.els["deck-restore"];
  const mainEl = app.get("document.querySelector('main')");
  const down = (target) => app.sandbox.document.dispatchEvent({
    type: "pointerdown", target, clientX: 10, clientY: 10, button: 0, buttons: 1,
    preventDefault() {}, stopPropagation() {},
  });
  const arm = async () => { await resetClick(app); assert.strictEqual(reset.textContent, "TAP AGAIN TO RESET"); };
  await arm();
  down(reset);
  assert.strictEqual(reset.textContent, "TAP AGAIN TO RESET", "the arming tap's own pointerdown disarmed it");
  down(mainEl);
  assert.strictEqual(reset.textContent, "RESET SEEDED SCALES", "a tap elsewhere left RESET armed");
  await arm();
  reset.onblur();
  assert.strictEqual(reset.textContent, "RESET SEEDED SCALES", "blur left RESET armed");
  await arm();
  app.run("openPanel && openPanel()");
  app.run("closePanel()");
  assert.strictEqual(reset.textContent, "RESET SEEDED SCALES", "closing the panel left RESET armed");
  await arm();
  assert.deepStrictEqual(hiddenKey(app), ["amara"], "re-arming reset");
  await resetClick(app);
  assert.deepStrictEqual(plain(app.get("savedState.hidden")),[]);
});

test("SD: two records naming one seed: the newest holds the slot, deleting it promotes the older, RESET clears both", async () => {
  const probe = boot();
  const rec = (str, name, palette) => ({ v: probe.get("SHARE_VERSION"), s: str, o: { name, palette, replaces: "kurd" } });
  const again = boot({ storage: { [probe.get("SCALES_KEY")]: JSON.stringify([
    rec(kurdString(probe).replace(/C5$/, "D5"), "OLDER KURD", 2),
    rec(kurdString(probe).replace(/A3/, "Ab3"), "NEWER KURD", 3),
  ]) } });
  const [older, newer] = Object.values(savedViews(again));
  assert.deepStrictEqual([older.name, newer.name], ["OLDER KURD", "NEWER KURD"]);
  assert.deepStrictEqual(records(again).map((r) => r.o.replaces), ["kurd", "kurd"]);
  assert.deepStrictEqual(labels(again), ["OLDER KURD", ...BUILTIN_NAMES.map((n) => (n === "D KURD 10" ? "NEWER KURD" : n))],
    "the newer record did not take Kurd's slot with the older in the custom tier");
  assert.ok(savedViews(again)[older.instanceId || older.id] && savedViews(again)[newer.instanceId || newer.id]);

  again.select(newer.instanceId || newer.id);
  again.clickChip("NEWER KURD");
  await deleteClick(again);
  await deleteClick(again);
  assert.deepStrictEqual(labels(again), BUILTIN_NAMES.map((n) => (n === "D KURD 10" ? "OLDER KURD" : n)),
    "deleting the newer record did not promote the older into Kurd's slot");
  assert.strictEqual(Object.keys(savedViews(again)).includes(newer.id), false);

  const reset = again.els["deck-restore"];
  assert.strictEqual(reset.hasAttribute("hidden"), false, "RESET is unavailable while a replacement is stored");
  await resetClick(again);
  await resetClick(again);
  assert.deepStrictEqual(labels(again), BUILTIN_NAMES);
  assert.deepStrictEqual(savedViews(again), {}, "RESET kept an older same-seed record");
  assert.deepStrictEqual(records(again), [], "RESET left an older same-seed record in storage");
});

test("SD: a seed both hidden and replaced boots onto its replacement without a warning", async () => {
  const probe = boot();
  const rec = (str, o) => ({ v: probe.get("SHARE_VERSION"), s: str, o });
  const hijazString = probe.get("HPE.core.formatSeed(DECKS[3].fields)");
  const boots = (blob, list) => durableBoot({ storage: {
    hpfc: JSON.stringify({ mode: "A", ...blob }), [probe.get("SCALES_KEY")]: JSON.stringify(list) } });

  const kurd = await boots({ deck: "kurd", hidden: ["kurd"] }, [rec(kurdString(probe).replace(/C5$/, "D5"), { name: "KURD REP", palette: 2, replaces: "kurd" })]);
  assert.strictEqual(savedViews(kurd)[kurd.get("selection.id")].name, "KURD REP", "(a) a hidden, replaced Kurd did not boot onto its replacement");
  assert.strictEqual(kurd.announcer().textContent, "", "(a) the boot said the deck was gone");

  const hijaz = await boots({ deck: "hijaz", hidden: ["hijaz", "kurd"] }, [
    rec(hijazString.replace(/B4$/, "C5"), { name: "HIJAZ REP", palette: 2, replaces: "hijaz" }),
    rec(kurdString(probe).replace(/C5$/, "D5"), { name: "LATER CUSTOM", palette: 3 }),
  ]);
  assert.strictEqual(labels(hijaz)[0], "LATER CUSTOM", "(b) the replacement is first in chip order, so the case proves nothing");
  assert.strictEqual(savedViews(hijaz)[hijaz.get("selection.id")].name, "HIJAZ REP", "(b) a hidden, replaced Hijaz landed elsewhere");
  assert.strictEqual(hijaz.announcer().textContent, "", "(b) the boot said the deck was gone");

  const bare = await boots({ deck: "kurd", hidden: ["kurd"] }, []);
  assert.match(bare.announcer().textContent, /^That scale is gone\. Showing /, "(c) a hidden seed with no replacement stayed silent");
});


test("SD: re-saving a replacement keeps its seeded slot", async () => {
  const app = await durableBoot();
  const rep = await saveKurdRepainted(app);
  const owner = app.get("selection.id");
  const originalSeed = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5";
  const editedSeed = "(D3) Ab3 Bb3 C4 D4 E4 F4 G4 A4 C5";
  const initialRevision = savedEnvelope(app).entries[0].revision;
  const assertSavedSlot = (realm, seed, rim, revision) => {
    const envelope = savedEnvelope(realm);
    assert.strictEqual(envelope.entries.length, 1, "the durable collection still has one replacement");
    assert.strictEqual(envelope.slots.kurd, owner, "the committed Kurd slot keeps its owner");
    const row = envelope.entries[0];
    assert.strictEqual(row.instanceId, owner, "re-saving keeps the saved instance");
    assert.strictEqual(row.revision, revision, "the acknowledged edit revision survives reboot");
    assert.strictEqual(row.record.o.replaces, "kurd", "the durable record keeps its seeded slot authority");
    assert.strictEqual(row.record.o.palette, 4, "the requested palette is durably saved");
    assert.strictEqual(row.record.s, seed, "the durable record contains the literal requested notes");
    assert.strictEqual(realm.get("selection.id"), owner);
    assert.strictEqual(realm.get("savedState.slots.kurd"), owner);
    assert.deepStrictEqual(Object.values(realm.currentDeck().fields)
      .filter(field => field[3] === "rim").map(field => field[2]), rim,
      "the selected replacement renders the requested note pitches");
  };
  app.clickChip("D KURD 10");
  app.els["scale-swatches"].children[4].click();
  await generateClick(app);
  const paletteRevision = savedEnvelope(app).entries[0].revision;
  assertSavedSlot(app, originalSeed, [57,58,60,62,64,65,67,69,72], paletteRevision);
  assert.ok(paletteRevision > initialRevision, "the palette change advances the saved revision");
  assert.strictEqual(records(app).length, 1);
  assert.strictEqual(records(app)[0].o.replaces, "kurd", "an options-only re-save dropped replaces");
  assert.strictEqual(app.sheetOpen(), false, "the palette re-save completes");
  const afterPalette = await reboot(app);
  assert.deepStrictEqual(labels(afterPalette), BUILTIN_NAMES);
  assertSavedSlot(afterPalette, originalSeed, [57,58,60,62,64,65,67,69,72], paletteRevision);

  app.clickChip("D KURD 10");
  app.type(app.els["scale-box"].value.replace(/A3/, "Ab3"));
  await generateClick(app);
  const editedRevision = savedEnvelope(app).entries[0].revision;
  assertSavedSlot(app, editedSeed, [56,58,60,62,64,65,67,69,72], editedRevision);
  assert.ok(editedRevision > paletteRevision, "the note change advances the saved revision");
  assert.notStrictEqual(savedEnvelope(app).entries[0].record.s, originalSeed, "the field re-save changes note content");
  assert.strictEqual(records(app).length, 1);
  assert.strictEqual(records(app)[0].o.replaces, "kurd", "a field-edit re-save dropped replaces");
  assert.strictEqual(app.sheetOpen(), false, "the valid field re-save completes");
  const afterEdit = await reboot(app);
  assert.deepStrictEqual(labels(afterEdit), BUILTIN_NAMES);
  assertSavedSlot(afterEdit, editedSeed, [56,58,60,62,64,65,67,69,72], editedRevision);
  assert.ok(rep);
});

test("SD: plain Add cannot inherit slot authority and an exact shared replacement reuses its owner", async () => {
  const app=await durableBoot(),rep=await saveKurdRepainted(app),owner=app.get("selection.id"),before=savedEnvelope(app).entries.find(row=>row.instanceId===owner);
  openSheet(app);app.type(kurdString(app));await generateClick(app);const plainId=app.get("selection.id");
  assert.notStrictEqual(plainId,owner);assert.strictEqual(records(app).length,2);assert.strictEqual(savedViews(app)[plainId].options.replaces,undefined);
  assert.strictEqual(app.get("savedState.slots.kurd"),owner);assert.deepStrictEqual(savedEnvelope(app).entries.find(row=>row.instanceId===owner),before);
  const text=payload(link(app,owner).value),opened=await app.getAsync(`openShare(${JSON.stringify(text)})`);assert.strictEqual(opened.ok,true);
  assert.strictEqual(app.get("selection.id"),owner);assert.strictEqual(records(app).length,2);assert.strictEqual(app.get("savedState.slots.kurd"),owner);
  const again=await reboot(app);assert.strictEqual(again.get("savedState.slots.kurd"),owner);assert.strictEqual(labels(again).length,6);assert.ok(savedViews(again)[plainId]);assert.ok(rep);
});

test("SD: duplicate and unknown replaces targets are never unreachable", async () => {
  const app = boot();
  const rep = await saveKurdRepainted(app);
  const newer = records(app)[0];
  const older = { v: newer.v, s: scale("builtin hijaz"), o: { ...newer.o, name: "OLDER" } };
  const odd = { v: newer.v, s: scale("builtin amara"), o: { ...newer.o, name: "ODD", replaces: "nope" } };
  const again = boot({ storage: { [app.get("SCALES_KEY")]: JSON.stringify([older, newer, odd]) } });
  const names = labels(again);
  assert.strictEqual(names[names.length - 5 + 0], rep.name, "the newer record is not in Kurd's slot");
  assert.deepStrictEqual(names.slice(-4), BUILTIN_NAMES.slice(1), "the other seeds moved");
  assert.strictEqual(names.includes("OLDER"), true, "the older duplicate is unreachable");
  assert.strictEqual(names.includes("ODD"), true, "an unknown target is unreachable");
  assert.strictEqual(names.filter((n) => n === "D KURD 10").length, 1, "seeded Kurd shows beside its replacement");
});




/* ------------------------------ 29. remove the DEGREES dropdown, infer the parent always */
//
// docs/plans/2026-10-14-remove-degrees-dropdown.md, lane app (RD-A1..A6).

const RD_STRING = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
const rdRecord = (app, o) => ({ v: app.get("SHARE_VERSION"), s: RD_STRING, o });
const rdBoot = (o) => {
  const probe = boot();
  return durableBoot({storage:{[probe.get("SCALES_KEY")]:JSON.stringify([rdRecord(probe,o)])}});
};

test("RD: a record stored with a non-inferred parent is displayed with it and re-saved from Edit with the inferred one", async () => {
  const app = await rdBoot({ palette: 0, parent: 2 });
  assert.strictEqual(Object.keys(savedViews(app)).length,1);
  const id = Object.keys(savedViews(app))[0];
  assert.strictEqual(savedViews(app)[id].options.parent, 2, "the stored index is not displayed");
  assert.strictEqual(savedViews(app)[id].degrees["7"], "IV");

  openEdit(app, savedViews(app)[id]);
  app.els["scale-swatches"].children[1].click();
  await generateClick(app);
  const after = savedViews(app)[id];
  assert.strictEqual(after.options.parent, null, "SAVE kept the stored parent");
  assert.strictEqual(after.degrees["7"], "iv");
  assert.ok(records(app)[0].o.parent == null);
  assert.strictEqual(app.get("selection.id"), id, "the id moved");
  assert.strictEqual(app.announcer().textContent, "Updated D AEOLIAN 9");

  const named = await rdBoot({ palette: 0, parent: 2, name: "RAY'S PAN" });
  assert.strictEqual(Object.keys(savedViews(named)).length,1);
  const nid = Object.keys(savedViews(named))[0];
  openEdit(named, savedViews(named)[nid]);
  named.els["scale-swatches"].children[1].click();
  await generateClick(named);
  const kept = savedViews(named)[nid];
  assert.strictEqual(named.get("selection.id"), nid);
  assert.strictEqual(kept.options.parent, null, "an options-only SAVE kept the stored parent");
  assert.strictEqual(kept.degrees["7"], "iv");
  assert.strictEqual(kept.options.name, "RAY'S PAN");
  assert.strictEqual(named.announcer().textContent, "Updated RAY'S PAN");
});


test("RD: an older explicit-parent link creates a separate variant after inferred-parent Edit", async () => {
  const maker=boot(),made=maker.generate(RD_STRING,{palette:1,parent:2});assert.strictEqual(made.ok,true);
  const text=payload(link(maker,made.instanceId).value),app=await rdBoot({palette:0,parent:2});
  const id=Object.keys(savedViews(app))[0];openEdit(app,savedViews(app)[id]);app.els["scale-swatches"].children[1].click();await generateClick(app);
  const inferred=savedEnvelope(app).entries.find(row=>row.instanceId===id);assert.ok(inferred.record.o.parent==null);assert.strictEqual(savedViews(app)[id].degrees["7"],"iv");
  const imported=await app.getAsync(`openShare(${JSON.stringify(text)})`);assert.strictEqual(imported.ok,true);assert.notStrictEqual(imported.instanceId,id);
  assert.strictEqual(records(app).length,2);assert.deepStrictEqual(savedEnvelope(app).entries.find(row=>row.instanceId===id),inferred,"importing the older link leaves the edited variant untouched");
  assert.strictEqual(savedEnvelope(app).entries.find(row=>row.instanceId===imported.instanceId).record.o.parent,2);assert.strictEqual(app.currentDeck().degrees["7"],"IV");assert.strictEqual(savedViews(app)[id].degrees["7"],"iv");
});

/* ---------------------------------------------------------------- discoverability */

const INDEX_HTML = () => fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const SHIPPED_GA_ID = "G-QTYWB2HSSV";
const GA_LITERAL = 'const GA_MEASUREMENT_ID = "' + SHIPPED_GA_ID + '";';
// The shipped page with another measurement id. It throws when the literal is
// not there, so a stale anchor can never leave the real id in a "test id" boot.
const withGaId = (id) => {
  const html = INDEX_HTML();
  assert.ok(html.includes(GA_LITERAL), "the GA_MEASUREMENT_ID literal is not in index.html");
  return html.replace(GA_LITERAL, 'const GA_MEASUREMENT_ID = "' + id + '";');
};
const BUILTIN_DECKS = () => JSON.parse(fs.readFileSync(path.join(ROOT, "data", "decks.json"), "utf8"));
const VALUE_LINE = "A free chord and progression practice tool for your own handpan scale.";
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function aboutHtml() {
  const m = /<section id="about"[^>]*>([\s\S]*?)<\/section>/.exec(INDEX_HTML());
  assert.ok(m, 'no <section id="about"> in index.html');
  return m[1];
}

const textOf = (html) => html.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

describe("discoverability", () => {
  test("the about section names every built-in deck with its card count from data/decks.json and the value line", async () => {
    const text = textOf(aboutHtml());
    assert.ok(text.includes(VALUE_LINE), "the value line is missing from the about section");
    for (const d of BUILTIN_DECKS()) {
      const celtic = /^D Amara/i.test(d.name) ? escapeRe(" (D Celtic)") : "";
      const re = new RegExp(`${escapeRe(d.name)}${celtic}[:,]? ${d.chords.length} chord cards`, "i");
      assert.ok(re.test(text), `${d.name} with ${d.chords.length} chord cards is not in the about section`);
    }
    assert.strictEqual((text.match(/\(D Celtic\)/g) || []).length, 2, "the D Celtic name is not on exactly both D Amara decks");
    assert.ok(!/Celtic Minor/.test(text), "the Celtic Minor sentence is still in the about section");
    assert.ok(/<h3>Privacy<\/h3>\s*<p>[^<]*Your scales stay in this browser on this device\./.test(aboutHtml()), "the privacy sentence is missing");
    assert.ok(/Google Analytics/.test(text), "the privacy sentence is missing");
    assert.ok(/without cookies in the EEA, the UK and Switzerland/.test(text), "the privacy sentence does not name the EEA");
    const steps = (/<ol[^>]*>([\s\S]*?)<\/ol>/.exec(aboutHtml()) || [])[1] || "";
    assert.strictEqual((steps.match(/<li\b/g) || []).length, 3, "the how-it-works list is not three steps");
  });

  test("#about is in both inert lists and #app in neither", async () => {
    const html = INDEX_HTML();
    const panel = /const panelBackground = \[([\s\S]*?)\]\.filter\(Boolean\);/.exec(html);
    assert.ok(panel, "panelBackground not found");
    const sheet = /const background = \[([^\n]*)\];/.exec(html);
    assert.ok(sheet, "the sheet's background list not found");
    assert.ok(/#about/.test(panel[1]), "#about is not in panelBackground");
    assert.ok(/#about/.test(sheet[1]), "#about is not in the sheet's background");
    assert.ok(!/#app|"app"/.test(panel[1]), "#app is in panelBackground (it holds the settings trigger)");
    assert.ok(!/#app|"app"/.test(sheet[1]), "#app is in the sheet's background");
  });

  test("#app wraps header, main, footer and the live region in that order, and #about follows it before the sheet", async () => {
    const html = INDEX_HTML();
    const body = html.slice(html.indexOf("<body>"));
    const order = ['<div id="app">', "<header>", "<main>", '<footer id="foot">', 'class="announce"',
      '</div>\n\n<section id="about"', 'id="scale-sheet"'];
    let at = -1;
    for (const s of order) {
      const i = body.indexOf(s, at + 1);
      assert.ok(i > at, `${s} is missing or out of order`);
      at = i;
    }
  });
});

describe("discoverability: structured data", () => {
  const ldBlock = () => {
    const html = INDEX_HTML();
    const blocks = html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || [];
    assert.strictEqual(blocks.length, 1, "expected exactly one JSON-LD block");
    return JSON.parse(blocks[0].replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""));
  };

  const node = (type) => {
    const ld = ldBlock();
    assert.ok(Array.isArray(ld["@graph"]), "expected a @graph array");
    const hits = ld["@graph"].filter((n) => n["@type"] === type);
    assert.strictEqual(hits.length, 1, `expected exactly one ${type} node`);
    return hits[0];
  };
  const SITE_NAME = "Handpan Theory";

  test("SN: the JSON-LD block is one @graph holding exactly one WebApplication and one WebSite node", async () => {
    const ld = ldBlock();
    assert.deepStrictEqual(Object.keys(ld).sort(), ["@context", "@graph"]);
    assert.ok(Array.isArray(ld["@graph"]), "expected a @graph array");
    assert.strictEqual(ld["@graph"].length, 2);
    assert.deepStrictEqual(ld["@graph"].map((n) => n["@type"]).sort(), ["WebApplication", "WebSite"]);
  });

  test("SN: the WebSite node is named as the h1, at the canonical and og:url, with Handpan Chords and the lowercase host as alternateName", async () => {
    const html = INDEX_HTML();
    const site = node("WebSite");
    assert.strictEqual(site.name, SITE_NAME, `expected a WebSite node named ${SITE_NAME}`);
    const canonical = /<link rel="canonical" href="([^"]*)">/.exec(html)[1];
    assert.strictEqual(site.url, canonical);
    assert.strictEqual(site.url, metaContent(html, "property", "og:url"));
    assert.deepStrictEqual(site.alternateName, ["Handpan Chords", "handpantheory.com"]);
    const hostEntry = site.alternateName[1];
    assert.strictEqual(hostEntry, hostEntry.toLowerCase());
    assert.strictEqual(hostEntry, new URL(canonical).host);
    assert.deepStrictEqual(Object.keys(site).sort(), ["@type", "alternateName", "name", "url"]);
  });

  test("SN: WebApplication carries Handpan Chords as its only alternateName", async () => {
    assert.deepStrictEqual(node("WebApplication").alternateName, ["Handpan Chords"]);
  });

  test("NS: no visible text says Handpan Chords", async () => {
    const root = path.join(__dirname, "..");
    const bad = /Handpan Chords|Handpan Chord Cards/;
    const files = ["404.html", "scales/index.html", "handpan-101/index.html", "llms.txt", "README.md"];
    for (const d of fs.readdirSync(path.join(root, "scales"), { withFileTypes: true })) {
      if (d.isDirectory()) files.push(`scales/${d.name}/index.html`);
    }
    for (const f of files) {
      const src = fs.readFileSync(path.join(root, f), "utf8").replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "");
      assert.ok(!bad.test(src), `${f} still shows the old name`);
    }
    const idx = INDEX_HTML().replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "").replace(/<script>const I18N[\s\S]*?<\/script>/, "").replace(/<!--[\s\S]*?-->/g, "");
    assert.ok(!bad.test(idx), "index.html still shows the old name");
  });

  test("SN: og:site_name equals the WebSite name and appears once", async () => {
    const html = INDEX_HTML();
    assert.strictEqual(metaContent(html, "property", "og:site_name"), node("WebSite").name);
    assert.strictEqual((html.match(/property="og:site_name"/g) || []).length, 1);
  });

  test("the JSON-LD block parses and states only what the page shows", async () => {
    const html = INDEX_HTML();
    const ld = ldBlock();
    assert.strictEqual(ld["@context"], "https://schema.org");
    const app = node("WebApplication");
    assert.strictEqual(app.url, "https://handpantheory.com/");
    assert.strictEqual(app.applicationCategory, "MusicApplication");
    assert.strictEqual(app.operatingSystem, "Any");
    assert.strictEqual(app.browserRequirements, "Requires JavaScript");
    assert.strictEqual(app.isAccessibleForFree, true);
    assert.deepStrictEqual(app.offers, { "@type": "Offer", price: "0", priceCurrency: "USD" });
    assert.strictEqual(app.featureList, "Chord flashcards; chord progressions; custom scale input; printable PDF");
    assert.ok(!("aggregateRating" in app) && !("review" in app), "a rating or review is marked up but never shown");
    const block = (html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/) || [""])[0];
    assert.ok(!/"email"|@raywu\.org|@handpantheory\.com|mailto:/i.test(block), "the JSON-LD block carries an email address (G7)");
    assert.ok(!/aggregateRating|"review"/.test(html), "a rating or review appears in the page");
    assert.strictEqual(app.name, SITE_NAME, "name differs from the site name");
    assert.strictEqual(app.description, metaContent(html, "name", "description"), "description differs from the meta description");
    assert.ok(/\bfree\b/i.test(textOf(aboutHtml())), "isAccessibleForFree is marked up but the about section does not say free");
  });
});

describe("discoverability: analytics loader", () => {
  const REAL_ID = "G-TEST123456";
  const bootGa = (opts = {}) => {
    const html = withGaId(opts.id || REAL_ID);
    return boot({ html, webdriver: false, href: "https://example.test/index.html", ...opts.boot });
  };
  const gtagScripts = (app) => app.head.children.filter((c) => /googletagmanager\.com\/gtag\/js/.test(c.src || ""));
  const queue = (app) => JSON.parse(JSON.stringify(Array.from(app.get("window.dataLayer"))));

  test("the shipped measurement id is G-QTYWB2HSSV", async () => {
    assert.ok(INDEX_HTML().includes(GA_LITERAL));
    assert.strictEqual((INDEX_HTML().match(/G-QTYWB2HSSV/g) || []).length, 1, "the id appears once");
  });

  test("the shipped index.html boots unmodified on a real host and loads gtag with the shipped id", async () => {
    const app = boot({ webdriver: false, href: "https://example.test/index.html" });
    assert.strictEqual(app.get("analyticsAllowed()"), true);
    const s = gtagScripts(app);
    assert.strictEqual(s.length, 1);
    assert.strictEqual(s[0].src, "https://www.googletagmanager.com/gtag/js?id=" + SHIPPED_GA_ID);
    assert.ok(queue(app).some((e) => e[0] === "config" && e[1] === SHIPPED_GA_ID));
  });

  test("the loader appends the gtag script on a real host with a real id, and only then", async () => {
    const app = bootGa();
    const s = gtagScripts(app);
    assert.strictEqual(s.length, 1);
    assert.strictEqual(s[0].src, "https://www.googletagmanager.com/gtag/js?id=" + REAL_ID);
    assert.strictEqual(s[0].async, true);
  });

  const noInject = [
    ["a file: page", { boot: { href: "file:///x/index.html" } }],
    ["localhost", { boot: { href: "http://localhost:8000/index.html" } }],
    ["127.0.0.1", { boot: { href: "http://127.0.0.1:8000/index.html" } }],
    ["[::1]", { boot: { href: "http://[::1]:8000/index.html" } }],
    ["an automated browser", { boot: { webdriver: true } }],
    ["the placeholder id", { id: "G-XXXXXXXXXX" }],
    ["the DEV host on Cloudflare Pages", { boot: { href: "https://handpan-cards-dev.pages.dev/" } }],
    ["a Cloudflare preview host", { boot: { href: "https://abc123.handpan-cards-dev.pages.dev/" } }],
  ];
  for (const [label, opts] of noInject) {
    test(`analyticsAllowed is false for ${label}: no gtag script, no config, no event`, async () => {
      const app = bootGa(opts);
      assert.strictEqual(gtagScripts(app).length, 0);
      assert.ok(!queue(app).some((e) => e[0] === "config"), "config queued");
      assert.strictEqual(app.get("analyticsAllowed()"), false);
    });
  }

  test("consent defaults come first, in order, and config follows them", async () => {
    const q = queue(bootGa());
    const heads = q.map((e) => e[0] + (e[0] === "js" || !e[1] ? "" : ":" + e[1]));
    assert.deepStrictEqual(heads.slice(0, 4), ["consent:default", "consent:default", "js", "config:" + REAL_ID]);
    const [open, eea] = [q[0][2], q[1][2]];
    for (const c of [open, eea]) {
      assert.strictEqual(c.ad_storage, "denied");
      assert.strictEqual(c.ad_user_data, "denied");
      assert.strictEqual(c.ad_personalization, "denied");
    }
    assert.strictEqual(open.analytics_storage, "granted");
    assert.ok(!("region" in open));
    assert.strictEqual(eea.analytics_storage, "denied");
    assert.strictEqual(eea.region.length, 32);
    for (const c of ["DE", "FR", "GB", "CH", "IS", "LI", "NO", "ES", "SE"]) assert.ok(eea.region.includes(c), c);
  });

  test("page_location carries no hash, so a share payload never reaches GA", async () => {
    const app = bootGa({ boot: { href: "https://example.test/index.html#s=SECRET" } });
    const cfg = queue(app).find((e) => e[0] === "config");
    assert.strictEqual(cfg[2].page_location, "https://example.test/index.html");
    assert.ok(!JSON.stringify(queue(app)).includes("SECRET"));
  });

  test("config is queued before any event on a boot with a share link", async () => {
    const app = bootGa({ boot: { href: "https://example.test/index.html#s=zzz" } });
    const names = queue(app).map((e) => e[0] + (e[0] === "event" ? ":" + e[1] : ""));
    const cfg = names.indexOf("config"), ev = names.findIndex((n) => /^event:/.test(n));
    assert.ok(cfg >= 0 && (ev === -1 || ev > cfg), JSON.stringify(names));
  });
});

describe("discoverability: analytics events", () => {
  const REAL_ID = "G-TEST123456";
  const bootEv = (opts = {}) => {
    const html = withGaId(REAL_ID);
    return boot({ html, webdriver: false, href: "https://example.test/index.html", ...opts });
  };
  const events = (app) => JSON.parse(JSON.stringify(Array.from(app.get("window.dataLayer"))))
    .filter((e) => e[0] === "event").map((e) => ({ name: e[1], params: e[2] }));
  const since = (app, n) => events(app).slice(n);

  test("selectDeck tracks deck_select with the seeded id", async () => {
    const app = bootEv();
    const n = events(app).length;
    app.run('selectDeck("pygmy")');
    assert.deepStrictEqual(since(app, n), [{ name: "deck_select", params: { deck_kind: "seeded", deck_id: "pygmy" } }]);
  });

  test("selecting a custom deck tracks deck_kind custom and no deck_id", async () => {
    const app = bootEv();
    openSheet(app);
    app.type(AMARA_STRING);
    const n = events(app).length;
    await generateClick(app);
    const evs = since(app, n);
    const sel = evs.filter((e) => e.name === "deck_select");
    assert.ok(sel.length >= 1);
    for (const e of sel) assert.deepStrictEqual(e.params, { deck_kind: "custom" });
  });

  test("generating a scale tracks scale_create with a note count and has_bottom as 1 or 0", async () => {
    const app = bootEv();
    openSheet(app);
    app.type(AMARA_STRING);
    const n = events(app).length;
    await generateClick(app);
    const created = since(app, n).filter((e) => e.name === "scale_create");
    assert.strictEqual(created.length, 1);
    assert.strictEqual(typeof created[0].params.note_count, "number");
    assert.ok(created[0].params.note_count >= 8);
    assert.ok([0, 1].includes(created[0].params.has_bottom));
  });

  test("flip tracks card_flip with the mode", async () => {
    const app = bootEv();
    const n = events(app).length;
    app.run("flip()");
    assert.deepStrictEqual(since(app, n), [{ name: "card_flip", params: { mode: app.get("mode") } }]);
  });

  test("setTier tracks progression_view with the tier", async () => {
    const app = bootEv();
    const n = events(app).length;
    app.run('setTier("advanced")');
    const pv = since(app, n).filter((e) => e.name === "progression_view");
    assert.deepStrictEqual(pv, [{ name: "progression_view", params: { tier: "advanced" } }]);
  });

  test("downloadDeckPDF tracks pdf_download with paper, deck_kind and cards", async () => {
    const app = bootEv();
    const n = events(app).length;
    app.run('downloadDeckPDF("shop")');
    const pd = since(app, n).filter((e) => e.name === "pdf_download");
    assert.strictEqual(pd.length, 1);
    assert.deepStrictEqual(Object.keys(pd[0].params).sort(), ["cards", "deck_kind", "paper"]);
    assert.strictEqual(pd[0].params.cards, "all");
    assert.strictEqual(pd[0].params.deck_kind, "seeded");
  });

  test("a valid share link tracks share_open with no params", async () => {
    const app = bootEv();
    const seed = plain(app.get(`HPE.core.parseSeed(${JSON.stringify(AMARA_STRING)}, {})`));
    const link = plain(app.get(`HPE.share.encode(${JSON.stringify({ fields: seed.value.fields, options: seed.value.options })})`)).value;
    const n = events(app).length;
    app.run("openShare(" + JSON.stringify(link) + ")");
    const so = since(app, n).filter((e) => e.name === "share_open");
    assert.deepStrictEqual(so, [{ name: "share_open", params: {} }]);
  });

  test("track pushes nothing when the loader did not inject", async () => {
    const app = boot({ webdriver: true });
    app.run('selectDeck("pygmy"); flip(); setTier("basic");');
    assert.deepStrictEqual(events(app), []);
  });

  test("no event param is a string over 40 characters or names a custom: id", async () => {
    const app = bootEv();
    openSheet(app);
    app.type(AMARA_STRING);
    await generateClick(app);
    app.sandbox.navigator.clipboard = { writeText: async () => {} };
    app.els["share-copy"].click();
    await new Promise((r) => setImmediate(r));
    app.run('flip(); setTier("basic"); downloadDeckPDF("shop"); selectDeck("hijaz");');
    const all = events(app);
    assert.ok(all.length >= 5);
    for (const e of all) {
      assert.ok(/^[A-Za-z0-9_]{1,40}$/.test(e.name), e.name);
      assert.ok(Object.keys(e.params).length < 25);
      for (const v of Object.values(e.params)) {
        if (typeof v === "string") assert.ok(v.length <= 40 && !v.includes("custom:"), e.name + " " + v);
      }
    }
  });
});

describe("NAN: analytics with a non-ASCII-named scale", () => {
  test("no queued entry, event name or param holds a character above 0x7E", async () => {
    const app = boot({ html: withGaId("G-TEST123456"), webdriver: false, href: "https://example.test/index.html" });
    openSheet(app);
    app.type(AMARA_STRING);
    app.els["scale-name"].value = "Café 日本 🥁";
    app.els["scale-name"].dispatchEvent({ type: "input" });
    await generateClick(app);
    assert.ok(chipRow(app).some((c) => c.label.startsWith("Café")), "the scale did not save under its name");
    app.sandbox.navigator.clipboard = { writeText: async () => {} };
    app.els["share-copy"].click();
    await new Promise((r) => setImmediate(r));
    app.run('flip(); setTier("basic"); downloadDeckPDF("shop"); selectDeck("hijaz");');
    const queue = JSON.parse(JSON.stringify(Array.from(app.get("window.dataLayer"))));
    const sent = queue.filter((e) => e[0] === "event");
    assert.ok(sent.length >= 5, "too few events to mean anything: " + sent.length);
    assert.ok(!/[^\x00-\x7e]/.test(JSON.stringify(queue)), "a non-ASCII character reached the analytics queue");
    for (const e of sent) {
      for (const v of Object.values(e[2] || {})) {
        if (typeof v === "string") assert.ok(!/[^\x20-\x7e]/.test(v), e[1] + " " + JSON.stringify(v));
      }
    }
  });
});

describe("discoverability: deck route", () => {
  const REAL_ID = "G-TEST123456";
  const SLUGS = { "d-kurd-10": "kurd", "d-amara-10": "amara10", "d-amara-9": "amara", "f-low-pygmy-18": "pygmy", "c-sharp-hijaz-9": "hijaz" };
  const at = async (hash,opts={},expectedPreference=null)=>{
    const app=await durableBoot({href:"https://example.test/index.html"+hash,...opts});
    // Boot-route prefer started before the observer was installed. A fresh
    // lock cannot order that staged operation; assert its actual committed key.
    if(expectedPreference) await committedPreference(app,expectedPreference);
    return app;
  };
  const stored = (app) => JSON.parse(app.store.hpfc || "{}");
  const replaceCalls = (app) => app.history.calls.filter((c) => c.type === "replace");
  const editedSeed = (seed, name) => {
    const probe = boot();
    const base = probe.get("HPE.core.formatSeed(DECKS.find((d) => d.id === " + JSON.stringify(seed) + ").fields)");
    const alt = seed === "pygmy" ? base : base.replace(/C5$/, "D5");
    return { [probe.get("SCALES_KEY")]: JSON.stringify([{ v: probe.get("SHARE_VERSION"), s: alt, o: { name, palette: 3, replaces: seed } }]) };
  };

  test("every slug opens its built-in deck, persists it, and leaves a clean address", async () => {
    for (const [slug, id] of Object.entries(SLUGS)) {
      const app = await at("#deck=" + slug, { storage: { hpfc: JSON.stringify({ deck: "kurd", mode: "A" }) } }, {kind:"builtin",id});
      assert.strictEqual(app.get("selection.id"), id, slug);
      assert.strictEqual(savedEnvelope(app).preferredSelection.id, id, slug + " was not persisted");
      assert.strictEqual(app.location.hash, "#deck=" + slug, slug + " left the wrong hash");
      assert.strictEqual(app.location.pathname, "/index.html");
    }
  });

  test("the route is consumed with replaceState, never pushState", async () => {
    const app = await at("#deck=f-low-pygmy-18",{}, {kind:"builtin",id:"pygmy"});
    assert.deepStrictEqual(app.history.calls.filter((c) => c.type === "push"), []);
    assert.deepStrictEqual(replaceCalls(app), [], "a bar that already holds the canonical route was rewritten");
    assert.strictEqual(app.location.hash, "#deck=f-low-pygmy-18");
    const odd = await at("#deck=nope");
    assert.deepStrictEqual(odd.history.calls.filter((c) => c.type === "push"), []);
    assert.strictEqual(replaceCalls(odd).length, 1);
    assert.strictEqual(replaceCalls(odd)[0].url, "/index.html#deck=d-kurd-10");
  });

  test("a route beats the stored deck", async () => {
    const app = await at("#deck=c-sharp-hijaz-9", { storage: { hpfc: JSON.stringify({ deck: "pygmy", mode: "A" }) } }, {kind:"builtin",id:"hijaz"});
    assert.strictEqual(app.get("selection.id"), "hijaz");
  });

  test("an edited seed shows its replacement, with no warning", async () => {
    const storage = editedSeed("amara", "MY AMARA");
    const app = await at("#deck=d-amara-9", { storage });
    assert.match(app.currentDeck().id, /^custom:/);
    assert.strictEqual(savedViews(app)[app.get("selection.id")].options.replaces, "amara");
    assert.doesNotMatch(app.announcer().textContent || "", /That scale is gone/);
  });

  test("a deleted seed falls back to the default deck and says the deck is gone", async () => {
    const app = await at("#deck=f-low-pygmy-18", { storage: { hpfc: JSON.stringify({ deck: "kurd", mode: "A", hidden: ["pygmy"] }) } });
    assert.strictEqual(app.get("selection.id"), "kurd");
    assert.match(app.announcer().textContent, /^That scale is gone\. Showing D KURD 10\./);
  });

  test("an unknown slug, a custom id and an empty slug fall back silently and lose the hash", async () => {
    for (const h of ["#deck=nope", "#deck=custom:abc", "#deck="]) {
      const app = await at(h, { storage: { hpfc: JSON.stringify({ deck: "amara", mode: "A" }) } });
      assert.strictEqual(app.get("selection.id"), "amara", h);
      assert.strictEqual(app.location.hash, "#deck=d-amara-9", h);
      assert.doesNotMatch(app.announcer().textContent || "", /gone/, h);
    }
  });

  test("a share link is untouched by the route", async () => {
    const probe = boot();
    const d = await makeCustom(probe);
    const hash = "#s=" + payload(link(probe, d.instanceId || d.id).value);
    const app = await at(hash);
    assert.strictEqual(app.currentDeck().id,d.id);
    assert.notStrictEqual(app.get("selection.id"),d.instanceId,"incoming wire cannot carry sender-local handle");
    assert.strictEqual(app.location.hash, hash);
  });

  test("hashchange to a deck link selects that deck and clears the hash", async () => {
    const app = await at("", { storage: { hpfc: JSON.stringify({ deck: "kurd", mode: "A" }) } });
    await hashChange(app,"#deck=f-low-pygmy-18");await writeBarrier(app);
    assert.strictEqual(app.get("selection.id"), "pygmy");
    assert.strictEqual(savedEnvelope(app).preferredSelection.id, "pygmy");
    assert.strictEqual(app.location.hash, "#deck=f-low-pygmy-18");
    assert.deepStrictEqual(app.history.calls.filter((c) => c.type === "push"), []);
  });

  test("hashchange resolves an edited seed to its replacement and a deleted seed to a warning", async () => {
    const edited = await at("", { storage: editedSeed("amara", "MY AMARA") });
    await hashChange(edited,"#deck=d-amara-9");
    assert.match(edited.currentDeck().id, /^custom:/);
    assert.match(edited.location.hash, /^#s=/);
    const gone = await at("", { storage: { hpfc: JSON.stringify({ deck: "kurd", mode: "A", hidden: ["pygmy"] }) } });
    await hashChange(gone,"#deck=f-low-pygmy-18");
    assert.strictEqual(gone.get("selection.id"), "kurd");
    assert.match(gone.announcer().textContent, /^That scale is gone\./);
    assert.strictEqual(gone.location.hash, "#deck=d-kurd-10");
  });

  test("AA: a hashchange to #add opens the Add sheet, Back closes it and the next Back leaves the previous entry", async () => {
    const app = await at("", { storage: { hpfc: JSON.stringify({ deck: "amara", mode: "A" }) } });
    const before = app.history.calls.length;
    await hashChange(app, "#add");
    assert.strictEqual(app.sheetOpen(), true, "a hashchange to #add opened no sheet");
    assert.deepStrictEqual(app.history.calls.slice(before).map((c) => c.type + ":" + c.url), ["replace:#add"],
      "the entry the browser already pushed is reused: one replace, no push");
    assert.strictEqual(app.get("sheetRouted"), true);
    assert.strictEqual(app.get("selection.id"), "amara");
    app.els["scale-back"].click();
    assert.strictEqual(app.sheetOpen(), false);
    assert.strictEqual(app.history.calls.filter((c) => c.type === "back").length, 1, "closing pops exactly the one entry");
    assert.strictEqual(app.history.calls.filter((c) => c.type === "push").length, 0, "no duplicate entry was pushed");
  });

  test("hashchange ignores the other routes", async () => {
    for (const h of ["#edit-x", "#something"]) {
      const app = await at("", { storage: { hpfc: JSON.stringify({ deck: "amara", mode: "A" }) } });
      const before = app.history.calls.length;
      await hashChange(app,h);
      assert.strictEqual(app.get("selection.id"), "amara", h);
      assert.strictEqual(app.history.calls.length, before, h + " touched history");
    }
  });

  test("a routed boot queues config before deck_route", async () => {
    for(const storage of [{},{hpfc:JSON.stringify({deck:"hijaz",mode:"A"})}]) {
      const app=await durableBoot({html:withGaId(REAL_ID),webdriver:false,href:"https://example.test/index.html#deck=d-kurd-10",storage});await committedPreference(app,{kind:"builtin",id:"kurd"});
      const q=JSON.parse(JSON.stringify(Array.from(app.get("window.dataLayer")))),names=q.map(e=>e[0]==="js"?"js":e[0]+":"+e[1]);
      assert.deepStrictEqual(names.slice(0,5),["consent:default","consent:default","js","config:"+REAL_ID,"event:deck_route"]);
      assert.deepStrictEqual(q[4][2],{deck_id:"kurd"});assert.strictEqual(q.filter(e=>e[0]==="event"&&e[1]==="deck_route").length,1);
    }
    const same=await durableBoot({html:withGaId(REAL_ID),webdriver:false,href:"https://example.test/index.html#deck=d-kurd-10",storage:{hpfc:JSON.stringify({deck:"kurd",mode:"A"})}});await committedPreference(same,{kind:"builtin",id:"kurd"});
    const events=JSON.parse(JSON.stringify(Array.from(same.get("window.dataLayer"))));assert.strictEqual(events.filter(e=>e[0]==="event"&&e[1]==="deck_route").length,0,"same stored selection is a reload, not another routed arrival");
  });

  test("a hashchange to a deck link tracks deck_route with the routed id", async () => {
    const app = await at("", { html: withGaId(REAL_ID), webdriver: false, storage: { hpfc: JSON.stringify({ deck: "kurd", mode: "A" }) } });
    const routes = () => JSON.parse(JSON.stringify(Array.from(app.get("window.dataLayer")))).filter((e) => e[0] === "event" && e[1] === "deck_route");
    const before = routes().length;
    await hashChange(app,"#deck=f-low-pygmy-18");
    const added = routes().slice(before);
    assert.strictEqual(added.length, 1);
    assert.deepStrictEqual(added[0][2], { deck_id: "pygmy" });
  });

  test("a hashchange to an edited seed's link tracks deck_route with the seed id, not the replacement's", async () => {
    const app = await at("", { html: withGaId(REAL_ID), webdriver: false, storage: { ...editedSeed("amara", "MY AMARA"), hpfc: JSON.stringify({ deck: "kurd", mode: "A", hidden: ["amara"] }) } });
    const routes = () => JSON.parse(JSON.stringify(Array.from(app.get("window.dataLayer")))).filter((e) => e[0] === "event" && e[1] === "deck_route");
    const before = routes().length;
    await hashChange(app,"#deck=d-amara-9");
    const added = routes().slice(before);
    assert.strictEqual(added.length, 1);
    assert.deepStrictEqual(added[0][2], { deck_id: "amara" });
    assert.match(app.currentDeck().id, /^custom:/);
  });

  test("hashchange to a hidden seed that has a replacement shows the replacement with no gone warning", async () => {
    const app = await at("", { storage: { ...editedSeed("amara", "MY AMARA"), hpfc: JSON.stringify({ deck: "kurd", mode: "A", hidden: ["amara"] }) } });
    await hashChange(app,"#deck=d-amara-9");
    assert.match(app.currentDeck().id, /^custom:/);
    assert.match(app.location.hash, /^#s=/);
    assert.doesNotMatch(app.announcer().textContent, /gone/);
  });

  test("the about section links every built-in deck by its slug", async () => {
    const html = aboutHtml();
    for (const d of BUILTIN_DECKS()) {
      const slug = Object.keys(SLUGS).find((s) => SLUGS[s] === d.id);
      assert.ok(slug, d.id + " has no slug");
      assert.ok(html.includes('href="#deck=' + slug + '"'), slug + " link missing");
    }
  });
});

/* ------------------------------------------------ share url (SU-A) */
// docs/plans/2026-10-16-share-url.md: the address bar is always a link to the
// deck shown, written only with replaceState.

describe("share url", () => {
  const REAL_ID = "G-TEST123456";
  const PAGE = "https://example.test/index.html";
  const flush = () => new Promise((r) => setImmediate(r));
  const replaces = (app) => app.history.calls.filter((c) => c.type === "replace");
  const backs = (app) => app.history.calls.filter((c) => c.type === "back");
  const decodeHash = (app, hash) =>
    plain(app.get("HPE.share.decode(" + JSON.stringify(hash.slice(3)) + ")"));
  const storageOf = app => ({...app.store});
  const bootGA = (opts = {}) => {
    const html = withGaId(REAL_ID);
    return boot({ html, webdriver: false, href: PAGE, ...opts });
  };
  const gaEvents = (app) => JSON.parse(JSON.stringify(Array.from(app.get("window.dataLayer"))))
    .filter((e) => e[0] === "event").map((e) => e[1]);
  // The stub element has no querySelectorAll, which panelStops() reads for the
  // print controls and the Resources links; the share controls need neither.
  const stops = (app) => {
    app.run("settingsPanel.querySelectorAll = () => []");
    return app.get("panelStops().map((e) => e.id)");
  };
  const customShown = async () => {
    const first=await durableBoot(),d=await makeCustom(first);
    return {first,d,app:await durableBoot({origin:first.fixtureOrigin,href:PAGE})};
  };

  test("SV-ROUTE-1: modeled prior preference ACKs and unchanged rereads preserve a pending hash destination", async () => {
    const HIJAZ = "#deck=c-sharp-hijaz-9", PYGMY = "#deck=f-low-pygmy-18";
    const literalShown = (app, id, total, route, label) => {
      assert.strictEqual(app.currentDeck().id, id, label + ": literal displayed deck");
      assert.strictEqual(app.get("order.length"), total, label + ": literal card inventory");
      assert.strictEqual(app.els.count.textContent, "1 / " + total, label + ": literal card counter");
      assert.strictEqual(app.location.hash, route, label + ": canonical route");
    };
    const dispatchCurrent = app => app.hashchange(app.location.hash, { force: true });
    const completed = [];
    const complete = name => { completed.push(name); console.log("HASH_INTENT_MODEL_CASE_COMPLETE " + JSON.stringify({ name, completed: completed.length })); };
    const requiredCases = ["immediate-delivery", "prior-preference-ACK", "unchanged-reread",
      "edit-pending", "edit-canonical", "delete-pending", "delete-canonical", "slot-pending", "slot-canonical",
      "ignored-#something-edit", "ignored-#something-delete", "ignored-#add-edit", "ignored-#add-delete",
      "ignored-#edit-x-edit", "ignored-#edit-x-delete", "equal-current-ack-then-second-edit",
      "unresolved-cold-share-then-pending-route-peer-edit"];
    // Independent literal public-record URLs: decoded meaning and FNV24 are
    // specified by share-readable plan2.2; no routeFor/encode oracle is used.
    const records = {
      A: { v: 4, s: "(D3) A3 C4 D4 E4 F4 G4 A4 C5", o: { name: "PUBLIC PAN A", palette: 0 } },
      B: { v: 4, s: "(D3) A3 C4 D4 E4 F4 G4 A4 C5", o: { name: "PUBLIC PAN B", palette: 0 } },
      C: { v: 4, s: "(D3) A3 C4 D4 E4 F4 G4 A4 C5", o: { name: "PUBLIC PAN C", palette: 0 } },
    };
    const routes = {
      A: "#s=6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/PUBLIC+PAN+A/0ce2c5",
      B: "#s=6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/PUBLIC+PAN+B/0fe2ca",
      C: "#s=6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/PUBLIC+PAN+C/0ee2c8",
      kurd: "#deck=d-kurd-10", amara: "#deck=d-amara-9",
    };
    const freshLink = async (target, expected, label) => {
      const copied = [];
      target.sandbox.navigator.clipboard = { writeText: href => { copied.push(href); return Promise.resolve(); } };
      assert.strictEqual(target.els["share-copy"].disabled, false, label + ": LINK remains available");
      target.els["share-copy"].click();
      await Promise.resolve(); await Promise.resolve();
      assert.deepStrictEqual(copied, [PAGE + expected], label + ": fresh LINK contains the independent literal route");
    };
    const pair = async (builtin = false) => {
      const { createOrigin } = require("./helpers/sandbox.js");
      const origin = createOrigin({ events: "omit", broadcastEvents: "omit" });
      // Missed transport hints make the real explicit reconciliation the
      // publication boundary. They do not fake a collection or app callback.
      const local = await durableBoot({ origin, href: PAGE + (builtin ? routes.amara : routes.A) });
      await writeBarrier(local);
      const peer = await durableBoot({ origin, href: PAGE });
      await writeBarrier(peer);
      if (builtin) literalShown(local, "amara", 27, routes.amara, "builtin slot fixture");
      else {
        assert.strictEqual(local.currentDeck().name, "PUBLIC PAN A");
        assert.strictEqual(local.location.hash, routes.A);
        assert.strictEqual(savedEnvelope(local).entries.length, 1);
        assert.strictEqual(savedEnvelope(local).entries[0].revision, 1);
      }
      return { local, peer };
    };
    const peerCommand = async (ctx, kind, record = records.B) => {
      const before = savedEnvelope(ctx.peer), row = before.entries[0];
      const command = kind === "slot" ? { type: "replace-builtin", collectionId: before.collectionId,
        seedId: "amara", expectedSlotStateRevision: 0, expectedOwnerId: null } :
        { type: kind, collectionId: before.collectionId, instanceId: row.instanceId, expectedRevision: row.revision };
      const result = await ctx.peer.getAsync(`(async()=>{
        const command=${JSON.stringify(command)};
        ${kind === "delete" ? "" : `const record=${JSON.stringify(record)},built=buildGenerated(record.s,record.o);
          if(!built.ok)return built;
          command.candidate={record:scaleRecord(seedOf(built.value)),deck:built.value};`}
        return commitSaved(command);
      })()`);
      assert.strictEqual(result.ok, true, "actual peer modeled command commits: " + kind);
      assert.strictEqual(result.published, true, "the acknowledged peer cache is really published");
      const after = savedEnvelope(ctx.peer);
      assert.strictEqual(after.revision, before.revision + 1, "exactly one peer command commits its next model revision");
      if (kind === "delete") assert.strictEqual(after.entries.length, 0);
      else if (kind === "slot") {
        assert.strictEqual(after.entries.length, 1);assert.strictEqual(after.slotStateRevision, 1);
        assert.strictEqual(after.slots.amara, result.instanceId);
        assert.strictEqual(after.entries[0].record.o.name, "PUBLIC PAN B");
        assert.strictEqual(after.entries[0].record.o.replaces, "amara");
      } else {
        assert.strictEqual(after.entries[0].revision, row.revision + 1);
        assert.strictEqual(after.entries[0].record.o.name, record.o.name);
      }
      const read = await ctx.local.getAsync("reconcileSavedCollection()");
      assert.strictEqual(read.ok, true, "the local app performs the actual modeled read");
      assert.strictEqual(ctx.local.get("savedState.revision"), after.revision, "the peer model revision is applied locally");
      return after;
    };
    const resultShown = (target, kind, record = records.B) => {
      if (kind === "delete") {
        assert.strictEqual(target.currentDeck().id, "kurd");assert.strictEqual(target.get("order.length"), 49);
        return routes.kurd;
      }
      assert.strictEqual(target.currentDeck().name, record.o.name);
      assert.strictEqual(target.get("order.length"), 27);
      return record.o.name === "PUBLIC PAN C" ? routes.C : routes.B;
    };
    // The sandbox origin supplies modeled IDB/WebLocks. These are actual app
    // commands under an explicit captured schedule, not native browser proof.
    const immediate = await durableBoot({ href: PAGE });
    immediate.hashchange(HIJAZ);
    literalShown(immediate, "hijaz", 19, HIJAZ, "immediate Hijaz control");
    await writeBarrier(immediate);
    await committedPreference(immediate, { kind: "builtin", id: "hijaz" });
    const immediateIntent = { oldURL: immediate.location.href, newURL: PAGE + PYGMY };
    immediate.location.hash = PYGMY;
    dispatchCurrent(immediate);
    literalShown(immediate, "pygmy", 53, PYGMY, "immediate destination delivery control");
    await writeBarrier(immediate);
    await committedPreference(immediate, { kind: "builtin", id: "pygmy" });
    console.log("HASH_INTENT_MODEL_CONTROL " + JSON.stringify({ intended: immediateIntent,
      actualURL: immediate.location.href, revision: savedEnvelope(immediate).revision,
      qualification: "modeled event delivery; force dispatch reassigns only the current hash" }));
    complete("immediate-delivery");

    const app = await durableBoot({ href: PAGE });
    const initial = savedEnvelope(app);
    assert.strictEqual(initial.revision, 1, "the fresh modeled collection starts at its literal initial revision");
    assert.deepStrictEqual(initial.preferredSelection, { kind: "builtin", id: "kurd" });
    let release, acquiredResolve;
    const acquired = new Promise(resolve => { acquiredResolve = resolve; });
    const blocker = app.sandbox.navigator.locks.request("handpan-cards:saved-scales:v1", () => {
      acquiredResolve();
      return new Promise(resolve => { release = resolve; });
    });
    await acquired;
    try {
      app.hashchange(HIJAZ);
      literalShown(app, "hijaz", 19, HIJAZ, "prior Hijaz selection while modeled ACK held");
      await app.waitFor('navigator.locks.query().then(q=>q.pending.filter(x=>x.name==="handpan-cards:saved-scales:v1").length===1)');
      const held = await app.sandbox.navigator.locks.query();
      assert.strictEqual(held.held.filter(lock => lock.name === "handpan-cards:saved-scales:v1").length, 1);
      assert.strictEqual(held.pending.filter(lock => lock.name === "handpan-cards:saved-scales:v1").length, 1,
        "one actual app preference command waits behind the acquired model barrier");
      assert.strictEqual(savedEnvelope(app).revision, 1);
      assert.deepStrictEqual(savedEnvelope(app).preferredSelection, { kind: "builtin", id: "kurd" });
      const intended = { oldURL: app.location.href, newURL: PAGE + PYGMY };
      app.location.hash = PYGMY; // URL write before explicitly delayed modeled delivery.
      assert.strictEqual(app.location.hash, PYGMY, "the destination was really written before releasing the ACK");
      release();
      await blocker;
      await writeBarrier(app);
      await committedPreference(app, { kind: "builtin", id: "hijaz" });
      const acknowledged = savedEnvelope(app);
      assert.strictEqual(acknowledged.revision, 2, "the one prior preference command really committed its next revision");
      assert.strictEqual(app.get("savedState.revision"), 2, "the prior ACK was published into the application model");
      assert.strictEqual(app.currentDeck().id, "hijaz", "the delayed destination handler has not selected Pygmy yet");
      assert.strictEqual(app.get("order.length"), 19);
      console.log("HASH_INTENT_MODEL_ACK " + JSON.stringify({ intended, actualURL: app.location.href,
        revision: acknowledged.revision, preferredSelection: acknowledged.preferredSelection,
        shown: app.currentDeck().id, qualification: "modeled durable ACK between raw URL write and delayed handler, not native scheduling" }));
      // Intended original-source RED. Do not heal an erased destination by
      // calling app.hashchange(PYGMY) before this actual-location assertion.
      assert.strictEqual(app.location.hash, PYGMY,
        "a prior preference ACK must preserve the actual pending Pygmy destination before handler delivery");
      dispatchCurrent(app);
      literalShown(app, "pygmy", 53, PYGMY, "destination delivered after prior ACK");
    } finally {
      if (release) release();
      await blocker;
      await writeBarrier(app);
    }
    complete("prior-preference-ACK");

    const reread = await durableBoot({ href: PAGE });
    reread.hashchange(HIJAZ);
    await writeBarrier(reread);
    await committedPreference(reread, { kind: "builtin", id: "hijaz" });
    literalShown(reread, "hijaz", 19, HIJAZ, "unchanged reread setup");
    const beforeRead = savedEnvelope(reread);
    const readIntent = { oldURL: reread.location.href, newURL: PAGE + PYGMY };
    reread.location.hash = PYGMY;
    const result = await reread.getAsync("reconcileSavedCollection()");
    assert.strictEqual(result.ok, true, "the actual application performs the modeled durable reread");
    assert.strictEqual(savedEnvelope(reread).revision, beforeRead.revision, "an unchanged reread performs no new commit");
    assert.deepStrictEqual(savedEnvelope(reread).preferredSelection, { kind: "builtin", id: "hijaz" });
    assert.strictEqual(reread.currentDeck().id, "hijaz");
    console.log("HASH_INTENT_MODEL_REREAD " + JSON.stringify({ intended: readIntent,
      actualURL: reread.location.href, revision: savedEnvelope(reread).revision,
      qualification: "modeled no-op reconciliation before delayed handler, not native scheduling" }));
    assert.strictEqual(reread.location.hash, PYGMY,
      "an unchanged reread must preserve the actual pending Pygmy destination before handler delivery");
    dispatchCurrent(reread);
    literalShown(reread, "pygmy", 53, PYGMY, "destination delivered after unchanged reread");
    await writeBarrier(reread);
    complete("unchanged-reread");

    for (const kind of ["edit", "delete", "slot"]) for (const pending of [true, false]) {
      const ctx = await pair(kind === "slot");
      const name = kind + (pending ? "-pending" : "-canonical");
      const intended = { oldURL: ctx.local.location.href, newURL: PAGE + PYGMY };
      if (pending) ctx.local.location.hash = PYGMY;
      await peerCommand(ctx, kind);
      const canonical = resultShown(ctx.local, kind);
      console.log("HASH_INTENT_MODEL_REMOTE " + JSON.stringify({ name, intended,
        actualURL: ctx.local.location.href, shown: ctx.local.currentDeck().name,
        revision: savedEnvelope(ctx.local).revision }));
      if (pending) {
        assert.strictEqual(ctx.local.location.hash, PYGMY, name + ": a real peer update preserves the actual pending destination");
        dispatchCurrent(ctx.local);
        literalShown(ctx.local, "pygmy", 53, PYGMY, name + " resolved destination");
        await writeBarrier(ctx.local);
        await freshLink(ctx.local, PYGMY, name);
      } else {
        assert.strictEqual(ctx.local.location.hash, canonical, name + ": normal peer update canonicalizes the live URL");
        await freshLink(ctx.local, canonical, name);
      }
      complete(name);
    }
    for (const fragment of ["#something", "#add", "#edit-x"]) for (const kind of ["edit", "delete"]) {
      const ctx = await pair();
      const name = "ignored-" + fragment + "-" + kind;
      ctx.local.location.hash = fragment;
      const historyBefore = JSON.stringify(ctx.local.history.calls);
      dispatchCurrent(ctx.local);
      if (fragment === "#add") {
        assert.strictEqual(ctx.local.sheetOpen(), true, name + ": #add opens the Add sheet");
        ctx.local.els["scale-back"].click();
        ctx.local.popstate();
        await writeBarrier(ctx.local);
      } else {
        assert.strictEqual(ctx.local.location.hash, fragment, name + ": handler keeps the ignored raw fragment");
        assert.strictEqual(JSON.stringify(ctx.local.history.calls), historyBefore, name + ": ignored handler writes no history");
      }
      await peerCommand(ctx, kind);
      const canonical = resultShown(ctx.local, kind);
      assert.strictEqual(ctx.local.location.hash, canonical, name + ": later peer publication still canonicalizes the URL");
      await freshLink(ctx.local, canonical, name);
      complete(name);
    }
    {
      const ctx = await pair();
      ctx.local.location.hash = routes.B;
      await peerCommand(ctx, "edit", records.B);
      resultShown(ctx.local, "edit", records.B);
      assert.strictEqual(ctx.local.location.hash, routes.B, "peer recordB now matches the pending literal routeB exactly");
      const historyBefore = JSON.stringify(ctx.local.history.calls);
      dispatchCurrent(ctx.local);
      assert.strictEqual(ctx.local.location.hash, routes.B);
      assert.strictEqual(JSON.stringify(ctx.local.history.calls), historyBefore, "an exact-current route handler acknowledges without history writes");
      await peerCommand(ctx, "edit", records.C);
      resultShown(ctx.local, "edit", records.C);
      assert.strictEqual(ctx.local.location.hash, routes.C, "after the equality acknowledgment a second peer edit must update the live URL");
      await freshLink(ctx.local, routes.C, "equality acknowledgment then second peer edit");
      complete("equal-current-ack-then-second-edit");
    }
    {
      // Existing SV12 U5 recovery contract: cold import failure retains its
      // incoming share and disabled LINK without publishing a canonical route.
      // This reaches the unacknowledged-route lifecycle naturally, with no
      // marker inspection/injection and no newer temporary-use action.
      const ctx = await pair();
      const beforeRecovery = savedRaw(ctx.local);
      const cold = await durableBoot({ origin: ctx.local.fixtureOrigin, href: PAGE + routes.B,
        idbFault: { operation: "put", error: new Error("public route recovery import refusal") } });
      assert.strictEqual(cold.get("booted"), true);
      assert.strictEqual(cold.get("savedMode"), "durable");
      assert.strictEqual(cold.currentDeck().name, "PUBLIC PAN A", "failed cold import keeps its acknowledged old record visible");
      assert.strictEqual(cold.location.hash, routes.B, "the unresolved incoming share remains in the bar");
      assert.strictEqual(cold.els["share-copy"].disabled, true, "unresolved cold import cannot share the old selected record");
      assert.strictEqual(savedRaw(cold), beforeRecovery, "the refused import commits no record or revision");
      assert.deepStrictEqual(savedEnvelope(cold).entries.map(row => row.record.o.name), ["PUBLIC PAN A"]);
      assert.strictEqual(cold.history.calls.length, 0, "the unresolved cold route has never been canonicalized by a history write");
      ctx.local = cold;
      const intended = { oldURL: cold.location.href, newURL: PAGE + PYGMY };
      cold.location.hash = PYGMY;
      await peerCommand(ctx, "edit", records.C);
      resultShown(cold, "edit", records.C);
      console.log("HASH_INTENT_MODEL_RECOVERY_PENDING " + JSON.stringify({ intended,
        actualURL: cold.location.href, shown: cold.currentDeck().name, revision: savedEnvelope(cold).revision,
        qualification: "modeled peer publication after naturally unresolved cold import; no newer recovery action" }));
      assert.strictEqual(cold.location.hash, PYGMY,
        "a peer publication after an unresolved cold share must preserve the newer actual pending Pygmy destination");
      dispatchCurrent(cold);
      literalShown(cold, "pygmy", 53, PYGMY, "new destination supersedes unresolved cold share after handler delivery");
      await writeBarrier(cold);
      await freshLink(cold, PYGMY, "resolved destination after failed cold import");
      complete("unresolved-cold-share-then-pending-route-peer-edit");
    }
    assert.deepStrictEqual(completed, requiredCases, "all seventeen frozen modeled route cases execute in order with no omissions");
    console.log("HASH_INTENT_MODEL_MANIFEST " + JSON.stringify({ required: requiredCases, completed,
      count: completed.length, qualification: "actual app commands via sandbox IDB/WebLocks MODEL, not native scheduling proof" }));
  });

  test("SU: tapping three chips writes three replaceState hashes and no pushState", async () => {
    const app=await durableBoot(),n=replaces(app).length,copied=[];
    app.sandbox.navigator.clipboard={writeText:href=>{copied.push(href);return Promise.resolve();}};
    let release,acquired;
    const held=new Promise(resolve=>{acquired=resolve;});
    const blocker=app.sandbox.navigator.locks.request("handpan-cards:saved-scales:v1",()=>{
      acquired();return new Promise(resolve=>{release=resolve;});
    });
    await held;
    const routes=["#deck=d-amara-10","#deck=d-amara-9","#deck=f-low-pygmy-18"];
    try {
      // No await between tap and route assertion/LINK activation: preference
      // publication cannot mask an omitted immediate selectDeck syncRoute.
      for(const [i,name] of ["D AMARA 10","D AMARA 9","F3 LOW PYGMY 18"].entries()) {
        app.clickChip(name);
        assert.strictEqual(app.location.hash,routes[i],"the selected chip updates its route in the same stack before its preference ACK");
        assert.strictEqual(app.els["share-copy"].disabled,false);
        app.els["share-copy"].click();
      }
      // Clipboard dispatch is a microtask, but each LINK captured its URL at
      // the same-stack activation above while the real commit stays blocked.
      await Promise.resolve();
      assert.deepStrictEqual(copied,routes.map(route=>PAGE+route),"each LINK copies its selected chip before preference acknowledgment");
      await app.waitFor('navigator.locks.query().then(q=>q.pending.filter(x=>x.name==="handpan-cards:saved-scales:v1").length===3)');
      const queue=await app.sandbox.navigator.locks.query();
      assert.strictEqual(queue.held.filter(x=>x.name==="handpan-cards:saved-scales:v1").length,1);
      assert.strictEqual(queue.pending.filter(x=>x.name==="handpan-cards:saved-scales:v1").length,3,"all actual preference commits remain blocked");
      assert.deepStrictEqual(savedEnvelope(app).preferredSelection,{kind:"builtin",id:"kurd"},"the immediate routes did not rely on an acknowledged preference");
      assert.deepStrictEqual(pushes(app),[]);
      assert.deepStrictEqual(replaces(app).slice(n).map(c=>c.url),routes.map(route=>"/index.html"+route));
    } finally {release();await blocker;await writeBarrier(app);}
    await committedPreference(app,{kind:"builtin",id:"pygmy"});
    assert.deepStrictEqual(pushes(app),[]);
    assert.deepStrictEqual(replaces(app).slice(n).map(c=>c.url),routes.map(route=>"/index.html"+route),"preference completion adds no extra navigation");

  });

  test("SU: opening ADD from a #s= bar pushes #add and the pop restores #s= with the deck unchanged", async () => {
    const { d, app } = await customShown();
    const pre = app.location.href;
    assert.match(app.location.hash, /^#s=/);
    openSheet(app);
    assert.strictEqual(ROUTE(app), "#add");
    app.els["scale-back"].click();
    assert.strictEqual(backs(app).length, 1);
    app.location.href = pre;
    app.popstate();
    assert.strictEqual(app.location.href, pre);
    assert.strictEqual(app.get("selection.id"), d.instanceId || d.id);
    assert.strictEqual(backs(app).length, 1);
  });

  test("SU: SAVE with a new name keeps the id and writes a new #s= code at the pop", async () => {
    const { d, app } = await customShown();
    const pre = app.location.href;
    openEdit(app, d);
    app.els["scale-name"].value = "NEW NAME";
    app.els["scale-name"].dispatchEvent({ type: "input" });
    await generateClick(app);
    assert.strictEqual(app.get("selection.id"), d.instanceId || d.id);
    app.location.href = pre;
    const n = app.history.calls.length;
    app.popstate();
    const after = app.history.calls.slice(n);
    assert.strictEqual(after.length, 1, "the pop did not write the new code");
    assert.strictEqual(after[0].type, "replace");
    const dec = decodeHash(app, app.location.hash);
    assert.strictEqual(dec.ok, true);
    assert.strictEqual(dec.value.options.name, "NEW NAME");
  });

  test("SU: SAVE with new fields keeps the instance and writes the changed inventory code and the lit chip agrees", async () => {
    const { d, app } = await customShown();
    const pre = app.location.href;
    openEdit(app, d);
    app.type(scale("builtin hijaz"));
    await generateClick(app);
    assert.strictEqual(app.get("selection.id"), d.instanceId || d.id, "Edit retains its selected instance");
    assert.notStrictEqual(app.currentDeck().id, d.id, "the inventory did change");
    app.location.href = pre;
    app.popstate();
    const dec = decodeHash(app, app.location.hash);
    assert.strictEqual(dec.ok, true);
    assert.strictEqual(app.get("HPE.core.deckId(" + JSON.stringify(dec.value.fields) + ")"), app.currentDeck().id);
    const on = chipRow(app).filter((c) => c.on);
    assert.strictEqual(on.length, 1);
    assert.strictEqual(on[0].label, "C# HIJAZ 9 / S1", "same-name built-in and saved instance remain distinguishable");
    const selectedChip=app.els.decks.children.find(c=>c.classList.contains("on"));
    assert.strictEqual(selectedChip.getAttribute("data-selection-kind"),"saved");
    assert.strictEqual(selectedChip.getAttribute("data-selection-id"),d.instanceId);
  });

  test("SU: DELETE of the shown custom deck writes the fallback deck's route", async () => {
    const { d, app } = await customShown();
    openEdit(app, d);
    await deleteClick(app);
    await deleteClick(app);
    assert.strictEqual(app.get("selection.id"), app.get("fallbackSelection().id"));
    assert.strictEqual(app.location.hash, "#deck=d-kurd-10");
  });

  test("SU: a hashless boot on a stored custom deck ends with its #s= in the bar", async () => {
    const { d, app } = await customShown();
    assert.strictEqual(app.get("selection.id"), d.instanceId || d.id);
    const last = replaces(app).pop();
    assert.ok(last && last.url.startsWith("/index.html#s="), JSON.stringify(last));
    assert.strictEqual(app.location.hash, "#s=" + payload(link(app, d.instanceId || d.id).value));
  });

  test("SU: a hashless boot on the default deck ends with #deck=d-kurd-10", async () => {
    const app = boot();
    assert.strictEqual(replaces(app).pop().url, "/index.html#deck=d-kurd-10");
  });

  test("SU: a refused #s= at boot says the engine reason and the bar ends on the stored deck's route", async () => {
    const app = boot({ href: PAGE + "#s=zzz" });
    const reason = plain(app.get('HPE.share.decode("zzz")')).reason;
    assert.ok(reason);
    assert.strictEqual(app.announcer().textContent, reason);
    assert.strictEqual(app.location.hash, "#deck=d-kurd-10");
  });

  test("SU: a hashchange to the hash already shown is a no-op", async () => {
    const app = bootGA();
    const calls = app.history.calls.length;
    const events = gaEvents(app).length;
    const chips = app.els.decks.children.slice();
    await hashChange(app,app.location.hash, { force: true });
    assert.strictEqual(app.history.calls.length, calls);
    assert.strictEqual(gaEvents(app).length, events);
    assert.deepStrictEqual(app.els.decks.children, chips);
    assert.strictEqual(app.get("selection.id"), "kurd");
  });

  test("SU: a hashchange to a #s= code imports it once and a second identical hashchange is a no-op", async () => {
    const first = boot();
    const d = await makeCustom(first);
    const hash = "#s=" + payload(link(first, d.instanceId || d.id).value);
    const app = bootGA();
    assert.strictEqual(app.get("selection.id"), "kurd");
    await hashChange(app,hash);
    assert.strictEqual(app.currentDeck().id, d.id);
    assert.notStrictEqual(app.get("selection.id"), d.instanceId, "portable links allocate a receiver-local instance");
    const receivedInstance=app.get("selection.id");
    assert.strictEqual(app.location.hash, hash);
    assert.strictEqual(gaEvents(app).filter((e) => e === "share_open").length, 1);
    const calls = app.history.calls.length;
    await hashChange(app,hash, { force: true });
    assert.strictEqual(app.history.calls.length, calls);
    assert.strictEqual(gaEvents(app).filter((e) => e === "share_open").length, 1);
    assert.strictEqual(app.get("selection.id"),receivedInstance,"exact repeated link retains its imported instance");
  });

  test("SU: syncRoute is idempotent", async () => {
    const app = boot();
    app.clickChip("D AMARA 9");
    const n = app.history.calls.length;
    app.run("syncRoute(); syncRoute();");
    assert.strictEqual(app.history.calls.length, n);
    app.location.hash = "#nope";
    app.run("syncRoute(); syncRoute();");
    assert.strictEqual(app.history.calls.length, n + 1);
    assert.strictEqual(app.location.hash, "#deck=d-amara-9");
  });

  // The v4 spelling of D Amara 9 with the rim seats moved, a mirror, the
  // between anchor and parent 1: the string main wrote for it (rule N).
  const V4_MOVED = "4A4GpAI11Co13D214D215D216D217D211D213DGem2J49CGan2GenB30iCYmpB3GiDImsB3SxEmgT2O_m";
  const V5_MOVED = "5/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+9/parent-aeolian/mirror/between/seats-1,0,2,3,4,5,6,7;;/975b6c";
  const V6_MOVED = "6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+9/parent-aeolian/mirror/between/seats-1,0,2,3,4,5,6,7;;/61d4aa";

  test("SV: a v4 #s= boot imports once and ends with the v6 code in the bar through one replaceState", async () => {
    const app = bootGA({ href: PAGE + "#s=" + V4_MOVED });
    assert.strictEqual(app.location.hash, "#s=" + V6_MOVED);
    assert.strictEqual(gaEvents(app).filter((e) => e === "share_open").length, 1);
    assert.deepStrictEqual(app.history.calls.map((c) => c.type), ["replace"]);
    assert.strictEqual(app.currentDeck().id, plain(app.get("HPE.core.deckId(HPE.core.parseSeed(" + JSON.stringify(DR3_D3) + ", {}).value.fields)")));
  });

  test("SV: a hashchange to the v4 spelling of the deck shown rewrites the bar to v6 and imports nothing", async () => {
    const app = bootGA({ href: PAGE + "#s=" + V4_MOVED });
    const saved = plain(app.get("savedState.entries.map(row=>row.record)"));
    const events = gaEvents(app).length;
    const calls = app.history.calls.length;
    await hashChange(app,"#s=" + V4_MOVED);
    assert.strictEqual(app.location.hash, "#s=" + V6_MOVED);
    assert.deepStrictEqual(app.history.calls.slice(calls).map((c) => c.type), ["replace"]);
    assert.deepStrictEqual(plain(app.get("savedState.entries.map(row=>row.record)")), saved);
    assert.strictEqual(gaEvents(app).length, events);
  });

  test("SU: a hashchange to an unsorted v5 spelling of the deck shown rewrites the bar to the sorted code and imports nothing", async () => {
    const app = bootGA({ href: PAGE + "#s=" + V5_MOVED });
    const saved = plain(app.get("savedState.entries.map(row=>row.record)"));
    const events = gaEvents(app).length;
    const calls = app.history.calls.length;
    const unsorted = V5_MOVED.replace("(D3)_A3_C4_D4_E4_F4_G4_A4_C5", "(D3)_C4_A3_D4_E4_G4_F4_A4_C5");
    assert.notStrictEqual(unsorted, V5_MOVED);
    await hashChange(app,"#s=" + unsorted);
    assert.strictEqual(app.location.hash, "#s=" + V6_MOVED);
    assert.deepStrictEqual(app.history.calls.slice(calls).map((c) => c.type), ["replace"]);
    assert.deepStrictEqual(plain(app.get("savedState.entries.map(row=>row.record)")), saved);
    assert.strictEqual(gaEvents(app).length, events);
  });

  test("FPS: a v5 #s= boot imports once and ends with the v6 code in the bar through one replaceState", async () => {
    const app = bootGA({ href: PAGE + "#s=" + V5_MOVED });
    assert.strictEqual(app.location.hash, "#s=" + V6_MOVED);
    assert.strictEqual(gaEvents(app).filter((e) => e === "share_open").length, 1);
    assert.deepStrictEqual(app.history.calls.map((c) => c.type), ["replace"]);
    assert.strictEqual(plain(app.get("savedState.entries.map(row=>row.record)")).length, 1);
  });

  test("FPS: a hashchange to the v5 spelling of the deck shown rewrites the bar to v6 and imports nothing", async () => {
    const app = bootGA({ href: PAGE + "#s=" + V6_MOVED });
    const saved = plain(app.get("savedState.entries.map(row=>row.record)"));
    const events = gaEvents(app).length;
    const calls = app.history.calls.length;
    await hashChange(app,"#s=" + V5_MOVED);
    assert.strictEqual(app.location.hash, "#s=" + V6_MOVED);
    assert.deepStrictEqual(app.history.calls.slice(calls).map((c) => c.type), ["replace"]);
    assert.deepStrictEqual(plain(app.get("savedState.entries.map(row=>row.record)")), saved);
    assert.strictEqual(gaEvents(app).length, events);
  });

  test("FPS: a v6 link under the floor, or with a bottom seats list beside at-, is BAD_NOTE and the app imports nothing", async () => {
    const seg = "uC3_uDb3_uEb3_(F3)_G3_Ab3_uBb3_C4_uDb4_Eb4_F4_G4_Ab4_C5_Eb5_-_F5_G5_uAb5";
    const fnv = (text) => {
      let h = 0x811c9dc5;
      for (const b of Buffer.from(text, "utf8")) { h = ((h ^ b) >>> 0); h = Math.imul(h, 0x01000193) >>> 0; }
      return (h >>> 8).toString(16).padStart(6, "0");
    };
    const forge = (options) =>
      ["6", seg, "*x"].concat(options, fnv(["6", seg, "\t"].concat(options).join("\n"))).join("/");
    const stored = plain(bootGA().get("savedState.entries.map(row=>row.record)")).length;
    for (const options of [["between", "at-5,,,,,"], ["between", "seats-;;5,4,3,2,1,0", "at-,,,20,,"]]) {
      const app = bootGA({ href: PAGE + "#s=" + forge(options) });
      assert.strictEqual(plain(app.get("savedState.entries.map(row=>row.record)")).length, stored, options.join("/"));
      assert.strictEqual(gaEvents(app).filter((e) => e === "share_open").length, 0);
    }
    const ok = bootGA({ href: PAGE + "#s=" + forge(["between", "at-,,,20,,"]) });
    assert.strictEqual(plain(ok.get("savedState.entries.map(row=>row.record)")).length, stored + 1, "the control imports");
  });

  test("FPS: stored records keep v 4 after a v6 boot", async () => {
    const app = bootGA({ href: PAGE + "#s=" + V4_MOVED });
    const saved = plain(app.get("savedState.entries.map(row=>row.record)"));
    assert.strictEqual(saved.length, 1);
    assert.strictEqual(saved[0].v, 4);
    assert.strictEqual(app.get("HPE.share.RECORD_VERSION"), 4);
    assert.strictEqual(app.get("SHARE_VERSION"), 4);
  });

  const PARENTLESS_V5 = "5/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+9/f0daf4";
  const PARENTLESS = "6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+9/77d0e3";

  test("PI: a v5 link with no parent opens and the bar ends on its parentless v6 code through one replaceState, with no parent option", async () => {
    const app = bootGA({ href: PAGE + "#s=" + PARENTLESS_V5 });
    assert.strictEqual(app.location.hash, "#s=" + PARENTLESS);
    assert.strictEqual(app.history.calls.filter((c) => c.type === "replace").length, 1);
    const saved = plain(app.get("savedState.entries.map(row=>row.record)"));
    assert.strictEqual(saved.length, 1);
    assert.ok(saved[0].o.parent == null, "a parent was stored");
    const deck = Object.values(savedViews(app)).find((d) => d.options && d.options.parent === null);
    assert.ok(deck, "the registry deck carries a parent");
    assert.strictEqual(deck.degrees["7"], "iv");
  });

  test("PI: a deck made on the Add sheet stores no parent and its share code is the engine's parentless code", async () => {
    const app = boot();
    const made = app.generate(AMARA_STRING);
    assert.strictEqual(made.ok, true, made.reason);
    const expr = `savedEntries.get(${JSON.stringify(made.instanceId)}).deck`;
    assert.ok(plain(app.get(`savedState.entries.map(row=>row.record)`))[0].o.parent == null);
    assert.strictEqual(plain(app.get(`shareLink(${expr})`)).value, "https://example.test/index.html#s=" + PARENTLESS);
  });

  test("PI: a v4 link with no parent opens to a v6 bar with no parent option", async () => {
    const app = bootGA({ href: PAGE + "#s=4A4GpAI11Co13D214D215D216D217D211D213DGem2Gam2J09JLaWK45E2Wpf9aJ0" });
    assert.strictEqual(app.location.hash, "#s=6/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/MY+PAN/ebb622");
    assert.ok(plain(app.get("savedState.entries.map(row=>row.record)"))[0].o.parent == null);
  });

  test("PI: an explicit parent equal to the inferred one still travels in the bar and the record", async () => {
    const app = bootGA({ href: PAGE + "#s=" + V6_MOVED });
    assert.strictEqual(app.location.hash, "#s=" + V6_MOVED);
    assert.strictEqual(plain(app.get("savedState.entries.map(row=>row.record)"))[0].o.parent, 1);
  });

  test("SU: RESET SEEDED DECKS while showing Kurd's replacement writes #deck=d-kurd-10", async () => {
    const app = boot();
    await saveKurdRepainted(app);
    assert.match(app.location.hash, /^#s=/);
    await resetClick(app);
    await resetClick(app);
    assert.strictEqual(app.get("selection.id"), "kurd");
    assert.strictEqual(app.location.hash, "#deck=d-kurd-10");
  });

  test("SU: an edited seed shares as a custom deck", async () => {
    const app = boot();
    const rep = await saveKurdRepainted(app);
    assert.strictEqual(rep.options.replaces, "kurd");
    assert.match(app.location.hash, /^#s=/);
    assert.strictEqual(decodeHash(app, app.location.hash).ok, true);
    const fresh = boot({ href: PAGE + app.location.hash });
    const shown = savedViews(fresh)[fresh.get("selection.id")];
    assert.ok(shown, "the link did not open a custom deck");
    assert.strictEqual(shown.options.replaces, undefined);
  });

  test("SU: an over-cap custom deck disables COPY LINK with the refusal as its title and leaves the bare path", async () => {
    const { app } = await customShown();
    const reason = "Too big to share.";
    app.run(`globalThis.__enc = HPE.share.encode;
      HPE.share.encode = () => ({ ok: false, code: "OVER", reason: ${JSON.stringify(reason)} });`);
    try {
      app.run("syncRoute()");
      assert.strictEqual(app.els["share-copy"].disabled, true);
      assert.strictEqual(app.els["share-copy"].title, reason);
      assert.strictEqual(app.location.hash, "");
      assert.strictEqual(app.announcer().textContent, reason);
      assert.match(app.announcer().className, /warn/);
      app.run("say('', ''); syncRoute()");
      assert.strictEqual(app.announcer().textContent, "", "the refusal was announced twice");
    } finally {
      app.run("HPE.share.encode = globalThis.__enc");
    }
    app.run("syncRoute()");
    assert.strictEqual(app.els["share-copy"].disabled, false);
    assert.match(app.location.hash, /^#s=/);
  });

  test("SU: COPY LINK copies location.href and announces LINK COPIED", async () => {
    const app = boot({ href: PAGE + "?share=x" });
    const written = [];
    app.sandbox.navigator.clipboard = { writeText: async (t) => { written.push(t); } };
    app.els["share-copy"].click();
    await flush();
    app.flushTimers();
    assert.deepStrictEqual(written, [app.location.href]);
    assert.ok(written[0].includes("?share=x#deck=d-kurd-10"), written[0]);
    assert.strictEqual(app.announcer().textContent, "LINK COPIED");
    assert.strictEqual(app.els["share-url"].hasAttribute("hidden"), true);
  });

  test("SU: COPY LINK falls back to the clipboard when the share sheet fails", async () => {
    const app = boot();
    coarse(app);
    const written = [];
    app.sandbox.navigator.clipboard = { writeText: async (u) => { written.push(u); } };
    app.sandbox.navigator.share = async () => { const e = new Error("x"); e.name = "NotAllowedError"; throw e; };
    app.els["share-copy"].click();
    await flush();
    app.flushTimers();
    assert.deepStrictEqual(written, [app.location.href]);
    assert.strictEqual(app.announcer().textContent, "LINK COPIED");
  });

  test("SU: COPY LINK reveals the readonly input when both are absent", async () => {
    const app = boot();
    delete app.sandbox.navigator.clipboard;
    delete app.sandbox.navigator.share;
    const input = app.els["share-url"];
    assert.ok(!stops(app).includes("share-url"));
    let selects = 0;
    input.select = () => { selects++; };
    app.els["share-copy"].click();
    await flush();
    assert.strictEqual(input.hasAttribute("hidden"), false);
    assert.strictEqual(input.value, app.location.href);
    assert.strictEqual(app.activeId(), "share-url");
    assert.strictEqual(selects, 1);
    assert.strictEqual(app.announcer().textContent, "SELECT THE LINK AND COPY IT");
    assert.ok(!stops(app).includes("share-url"));
    input.dispatchEvent({ type: "blur" });
    assert.strictEqual(input.hasAttribute("hidden"), true);
  });

  test("SU: COPY LINK says nothing when the share sheet is dismissed", async () => {
    const app = boot();
    coarse(app);
    delete app.sandbox.navigator.clipboard;
    app.sandbox.navigator.share = async () => { const e = new Error("x"); e.name = "AbortError"; throw e; };
    const before = app.announcer().textContent;
    app.els["share-copy"].click();
    await flush();
    assert.strictEqual(app.announcer().textContent, before);
    assert.strictEqual(app.els["share-url"].hasAttribute("hidden"), true);
  });

  test("SU: COPY LINK is not a panel stop, enabled or disabled", async () => {
    const app = boot();
    app.run("openPanel()");
    assert.ok(!stops(app).includes("share-copy"));
    app.els["share-copy"].disabled = true;
    assert.ok(!stops(app).includes("share-copy"));
  });

  test("SI: a second COPY LINK clears the message line before writing LINK COPIED again", async () => {
    const app = boot();
    app.sandbox.navigator.clipboard = { writeText: async () => {} };
    const el = app.announcer();
    const writes = [];
    let text = el.textContent;
    Object.defineProperty(el, "textContent", {
      get: () => text,
      set: (v) => { text = v; writes.push(v); },
      configurable: true,
    });
    for (let i = 0; i < 2; i++) {
      app.els["share-copy"].click();
      await flush();
      assert.strictEqual(writes.filter((w) => w === "LINK COPIED").length, i, "the announcement was written before the deferred tick");
      assert.strictEqual(writes[writes.length - 1], "", "the line was not cleared before the tick");
      app.flushTimers();
    }
    assert.deepStrictEqual(writes, ["", "LINK COPIED", "", "LINK COPIED"]);
    writes.length = 0;
    app.run('say("hello", "ok")');
    assert.deepStrictEqual(writes, ["hello"], "say() itself writes once, with no clear");
  });

  const revealedShareUrl = () => {
    const app = boot();
    delete app.sandbox.navigator.clipboard;
    delete app.sandbox.navigator.share;
    app.els["share-copy"].click();
    assert.strictEqual(app.els["share-url"].hasAttribute("hidden"), false, "the control did not reveal #share-url");
    return app;
  };

  test("SI: opening the create sheet hides a revealed #share-url", async () => {
    const app = revealedShareUrl();
    app.run("openScaleSheet(document.getElementById('deck-add'))");
    assert.strictEqual(app.sheetOpen(), true);
    assert.strictEqual(app.els["share-url"].hasAttribute("hidden"), true);
  });

  test("SI: opening the Edit sheet hides a revealed #share-url without a blur event", async () => {
    const app = revealedShareUrl();
    let blurs = 0;
    app.els["share-url"].addEventListener("blur", () => { blurs += 1; });
    app.run("openEditSheet(deck(), document.getElementById('deck-add'))");
    assert.strictEqual(app.sheetOpen(), true);
    assert.strictEqual(blurs, 0, "a blur event fired, so this proves nothing about the explicit hide");
    assert.strictEqual(app.els["share-url"].hasAttribute("hidden"), true);
  });

  test("SI: while About is open the share icon is inert under #app and not a stop", async () => {
    const h = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    const body = h.slice(h.indexOf("<body>"));
    assert.ok(body.indexOf('<div id="app">') >= 0 && body.indexOf('<div id="app">') < body.indexOf('id="share-copy"') &&
      body.indexOf('id="share-copy"') < body.indexOf('<section id="about"'), "the icon is not inside #app");
    assert.match(h, /const aboutBackground = \(\) => \[document\.querySelector\("#app"\)/);
    const app = boot();
    app.run("openAbout()");
    assert.strictEqual(app.get("aboutOpen"), true);
    assert.ok(!app.get("aboutStops().map(e => e.id)").includes("share-copy"));
  });

  test("SU: COPY LINK tracks share_copy with no id, name or code", async () => {
    const app = bootGA();
    app.sandbox.navigator.clipboard = { writeText: async () => {} };
    app.els["share-copy"].click();
    await flush();
    const q = JSON.parse(JSON.stringify(Array.from(app.get("window.dataLayer"))));
    const ev = q.filter((e) => e[0] === "event" && e[1] === "share_copy");
    assert.deepStrictEqual(ev.map((e) => e[2]), [{ deck_kind: "seeded", method: "clipboard" }]);
  });

  test("SU: page_location carries no hash on a custom-deck boot or a #s= boot", async () => {
    const first = boot();
    const d = await makeCustom(first);
    const hash = "#s=" + payload(link(first, d.instanceId || d.id).value);
    for (const href of [PAGE, PAGE + hash]) {
      const app = bootGA({ storage: storageOf(first), href });
      const cfg = JSON.parse(JSON.stringify(Array.from(app.get("window.dataLayer")))).find((e) => e[0] === "config");
      assert.ok(cfg, "no config entry");
      assert.ok(!cfg[2].page_location.includes("#"), cfg[2].page_location);
    }
  });

  test("SU: a reload of the stored deck fires no share_open and no deck_route; a route that differs from the stored selection fires it", async () => {
    const first = await durableBoot({html:withGaId(REAL_ID),webdriver:false,href:PAGE});
    const d = await makeCustom(first);
    const hash = "#s=" + payload(link(first, d.instanceId || d.id).value);
    const again = await durableBoot({html:withGaId(REAL_ID),webdriver:false,origin:first.fixtureOrigin,href:PAGE+hash});
    assert.deepStrictEqual(gaEvents(again).filter((e) => e === "share_open" || e === "deck_route"), []);
    const otherStorage=storageOf(first),otherEnvelope=savedEnvelope(first);
    otherEnvelope.preferredSelection={kind:"builtin",id:"kurd"};
    const other=await durableBoot({html:withGaId(REAL_ID),webdriver:false,storage:otherStorage,idbRaw:JSON.stringify(otherEnvelope),href:PAGE+hash});
    assert.deepStrictEqual(gaEvents(other).filter((e) => e === "share_open"), ["share_open"]);

    const stored = { hpfc: JSON.stringify({ deck: "pygmy", mode: "A" }) };
    const sameSeed = bootGA({ storage: stored, href: PAGE + "#deck=f-low-pygmy-18" });
    assert.deepStrictEqual(gaEvents(sameSeed).filter((e) => e === "deck_route"), []);
    const otherSeed = bootGA({ storage: stored, href: PAGE + "#deck=d-amara-9" });
    assert.deepStrictEqual(gaEvents(otherSeed).filter((e) => e === "deck_route"), ["deck_route"]);
  });
});

describe("share icon", () => {
  const html = () => fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const css = () => { const h = html(); return h.slice(h.indexOf("<style>"), h.indexOf("</style>")); };
  const rule = (src, sel) => {
    const at = src.indexOf("\n" + sel + "{");
    if (at < 0) return null;
    return src.slice(at, src.indexOf("}", at));
  };

  test("SI: #share-copy is the header's first control, a button labelled Copy link with an inline SVG and no external asset", async () => {
    const h = html();
    const header = h.slice(h.indexOf("<header>"), h.indexOf("</header>"));
    const btn = /<button\b[^>]*id="share-copy"[^>]*>([\s\S]*?)<\/button>/.exec(header);
    assert.ok(btn, "#share-copy is not in the header");
    assert.ok(header.indexOf('id="share-copy"') < header.indexOf('id="settings-trigger"'), "the icon is not before the trigger");
    const ahead = header.slice(0, header.indexOf(btn[0]));
    assert.ok(!/<(button|a|input|select|textarea)\b|tabindex=/i.test(ahead), "a focusable control precedes #share-copy in the header");
    assert.ok(header.indexOf('id="share-copy"') < header.indexOf("<h1"), "the icon is not before the title");
    assert.ok(!/class="hspacer"/.test(header), "the spacer is still there");
    assert.match(btn[0], /aria-label="Copy link"/);
    assert.match(btn[0], /type="button"/);
    assert.match(btn[1], /<svg\b[^>]*aria-hidden="true"/);
    assert.ok(!/<img|href=|src=|url\(/.test(btn[1]), "an external asset");
    assert.ok(!/\btitle=/.test(btn[0]), "an enabled icon carries no title");
    assert.ok(!/COPY LINK/.test(btn[0]), "visible text in the icon");
  });

  test("SI: the Scales group holds + ADD A SCALE alone in a full-width row and no share control", async () => {
    const h = html();
    const g = h.slice(h.indexOf('id="panel-scales-group"'));
    const group = g.slice(0, g.indexOf('<div class="panel-group">'));
    assert.match(group, /<div class="modebar">\s*<button[^>]*id="deck-add"[^>]*>\+ ADD A SCALE<\/button>\s*<\/div>/);
    assert.ok(!/share-copy|share-url|COPY LINK/.test(group));
  });

  test("SI: panelStops holds neither share control, in either state", async () => {
    const app = boot();
    delete app.sandbox.navigator.clipboard;
    delete app.sandbox.navigator.share;
    app.run("settingsPanel.querySelectorAll = () => []");
    const ids = () => app.get("panelStops().map((e) => e.id)");
    for (const open of [false, true]) {
      if (open) app.run("openPanel()");
      assert.ok(!ids().includes("share-copy") && !ids().includes("share-url"));
    }
    // Close the mobile panel so LINK is reachable outside its inert background.
    app.run("closePanel()");
    app.els["share-copy"].click();
    await new Promise((r) => setImmediate(r));
    assert.strictEqual(app.els["share-url"].hasAttribute("hidden"), false);
    assert.ok(!ids().includes("share-url"));
    app.els["share-copy"].disabled = true;
    assert.ok(!ids().includes("share-copy"));
  });

  test("SI: panelBackground holds #share-copy, so an open drawer inerts it", async () => {
    const app = boot({ layout: true });
    assert.ok(app.get('panelBackground.some(e => e.id === "share-copy")'));
    app.run("openPanel()");
    assert.strictEqual(app.get('document.getElementById("share-copy").inert'), true);
    app.run("closePanel()");
    assert.ok(!app.get('document.getElementById("share-copy").inert'));
  });

  test("SI: the print block hides #share-copy and #share-url", async () => {
    const c = css();
    const block = c.slice(c.lastIndexOf("@media print{"));
    const hiddenRules=[...block.matchAll(/([^{}]+)\{([^{}]+)\}/g)]
      .filter(([,selectors,declarations])=>/\bdisplay\s*:\s*none\b/.test(declarations));
    for(const id of ["share-copy","share-url"])assert.ok(hiddenRules.some(([,selectors])=>selectors.split(",").map(x=>x.trim()).includes("#"+id)),"print hides #"+id);
  });

  test("SI: a revealed #share-url is positioned out of flow", async () => {
    const c = css();
    const r = rule(c, "#share-url");
    assert.ok(r, "no #share-url rule");
    assert.match(r, /position:absolute/);
    assert.match(r, /top:44px/);
    assert.match(r, /z-index:29/);
    assert.ok(!/margin-top/.test(r), "margin-top is still there");
    assert.match(r, /min-height:44px/);
    assert.match(r, /border-radius:12px/);
    assert.match(r, /font-size:16px/);
    assert.match(rule(c, "header") || "", /position:relative/);
    assert.match(rule(c, "#share-copy:disabled") || "", /opacity:\.5/);
    assert.match(rule(c, "#share-copy:disabled:active") || "", /background:#1a1814/);
  });

  test("SI: the glyph is two rotated stadiums drawn at stroke-width 2 (CSS overrides the 2.4 attribute)", async () => {
    assert.match(html(), /<g transform="rotate\(-45 12 12\)"[^>]*stroke-width="2\.4"/);
    assert.match(rule(css(), "#share-copy svg g") || "", /stroke-width:2\b(?!\.)/);
  });
});

describe("share url: edges", () => {
  const PAGE = "https://example.test/index.html";
  const REAL_ID = "G-TEST123456";
  const bootGA = (opts = {}) =>
    boot({ html: withGaId(REAL_ID), webdriver: false, href: PAGE, ...opts });
  const gaEvents = (app) => JSON.parse(JSON.stringify(Array.from(app.get("window.dataLayer"))))
    .filter((e) => e[0] === "event").map((e) => e[1]);
  const replaces = (app) => app.history.calls.filter((c) => c.type === "replace");
  const storageOf = app => ({...app.store});

  test("SU: a typed #deck= route while the Add/Edit sheet is open changes neither the deck nor history", async () => {
    const app = boot();
    openSheet(app);
    assert.strictEqual(app.sheetOpen(), true);
    const calls = app.history.calls.length;
    await hashChange(app,"#deck=f-low-pygmy-18");
    assert.strictEqual(app.get("selection.id"), "kurd");
    assert.strictEqual(app.history.calls.length, calls, "history was written under the open sheet");
    assert.strictEqual(app.sheetOpen(), true);
  });

  test("SU: a routed boot to the default deck beats a different stored deck and persists it", async () => {
    const legacy=JSON.stringify({deck:"pygmy",mode:"A"});
    const app=await durableBoot({href:PAGE+"#deck=d-kurd-10",storage:{hpfc:legacy}});
    await committedPreference(app,{kind:"builtin",id:"kurd"});
    assert.strictEqual(app.get("selection.id"), "kurd");
    assert.deepStrictEqual(savedEnvelope(app).preferredSelection,{kind:"builtin",id:"kurd"});
    assert.strictEqual(app.store.hpfc,legacy,"legacy recovery bytes remain untouched");
    assert.strictEqual(app.location.hash, "#deck=d-kurd-10");
  });

  test("SU: the inline head script alone queues two consent defaults and js, and no config", async () => {
    const head = /<script>\s*(window\.dataLayer = [\s\S]*?)<\/script>/.exec(INDEX_HTML());
    assert.ok(head, "the inline head script is not in index.html");
    const app = boot({ html: `<script>${head[1]}</script><script>window.__marker = 1;</script>`, webdriver: false });
    const q = JSON.parse(JSON.stringify(Array.from(app.get("window.dataLayer"))));
    assert.deepStrictEqual(q.map((e) => e[0] + (e[0] === "consent" ? ":" + e[1] : "")), ["consent:default", "consent:default", "js"]);
    assert.strictEqual(q[0][2].analytics_storage, "granted");
    assert.strictEqual(q[1][2].analytics_storage, "denied");
    assert.strictEqual(q[1][2].region.length, 32);
    assert.strictEqual(app.head.children.length, 0, "the head script appended a node");
  });

  test("SU: a boot message is not replaced by a refused-link warning", async () => {
    const first = await durableBoot();
    await makeCustom(first);
    const storage={...first.store},envelope=savedEnvelope(first);
    envelope.preferredSelection={kind:"builtin",id:"kurd"};envelope.hidden=["kurd"];
    const idbRaw=JSON.stringify(envelope);
    const html = INDEX_HTML().replace("var CAPS = { payload: 4096 };", "var CAPS = { payload: 40 };");
    assert.notStrictEqual(html, INDEX_HTML(), "the share cap literal moved");
    const app = await durableBoot({ html, href: PAGE, storage, idbRaw });
    assert.match(app.currentDeck().id, /^custom:/);
    assert.strictEqual(app.els["share-copy"].disabled, true, "the custom deck's code was not refused");
    assert.match(app.announcer().textContent, /^That scale is gone\./);

    // The real durable boot above proves the end-to-end result. Separately
    // stage the lifecycle guard's branch inputs; this does not assert that
    // asynchronous initialization naturally reaches this exact ordering.
    const bootMessage = "That scale is gone. Showing D AEOLIAN 9.";
    assert.strictEqual(app.announcer().textContent, bootMessage,
      "the actual hidden-preference boot retained its literal fallback message");
    assert.strictEqual(app.get("savedMode"), "durable");
    assert.strictEqual(app.get("selection.kind"), "saved");
    const refusedRoute = plain(app.get("routeInfo(deck())"));
    assert.strictEqual(refusedRoute.route, "", "the current saved scale still has an over-cap share route");
    assert.ok(refusedRoute.reason.length > 0, "the over-cap route has a real refusal reason");
    assert.notStrictEqual(refusedRoute.reason, bootMessage);
    app.run("booted = false; routeRefused = false;");
    assert.strictEqual(app.get("booted"), false, "explicit lifecycle-guard precondition");
    assert.strictEqual(app.get("routeRefused"), false, "the refusal has not yet been announced in this guard case");
    assert.strictEqual(app.announcer().textContent, bootMessage, "the existing boot message is present before synchronization");
    app.run("syncRoute()");
    assert.strictEqual(app.announcer().textContent, bootMessage,
      "pre-boot route synchronization must preserve an existing boot message");
    assert.strictEqual(app.get("routeRefused"), true, "the refused route was actually processed");

    app.run("booted = true; routeRefused = false; syncRoute();");
    assert.strictEqual(app.announcer().textContent, refusedRoute.reason,
      "after boot the same refused route may announce its warning");
  });

  test("SU: following a link to the custom deck shown at boot after switching away tracks share_open", async () => {
    const first = await durableBoot();
    await makeCustom(first);
    const hash = first.location.hash;
    assert.match(hash, /^#s=/);
    const app = await durableBoot({html:withGaId(REAL_ID),webdriver:false,origin:first.fixtureOrigin,href:PAGE});
    assert.match(app.currentDeck().id, /^custom:/);
    app.run('selectDeck("kurd")');
    assert.strictEqual(app.get("selection.id"), "kurd");
    assert.deepStrictEqual(gaEvents(app).filter((e) => e === "share_open"), []);
    await hashChange(app,hash);
    assert.match(app.currentDeck().id, /^custom:/);
    assert.deepStrictEqual(gaEvents(app).filter((e) => e === "share_open"), ["share_open"]);
  });

  test("SU: a deck change hides a revealed #share-url so it never keeps the old deck's link", async () => {
    const app = boot();
    delete app.sandbox.navigator.clipboard;
    delete app.sandbox.navigator.share;
    app.els["share-copy"].click();
    assert.strictEqual(app.els["share-url"].hasAttribute("hidden"), false);
    assert.strictEqual(app.els["share-url"].value, PAGE + "#deck=d-kurd-10");
    app.run('selectDeck("pygmy")');
    assert.strictEqual(app.els["share-url"].hasAttribute("hidden"), true);
  });

  test("SU: a hashchange to an unknown #deck= slug rewrites the bar to the shown deck's route", async () => {
    const app = boot();
    const before = replaces(app).length;
    await hashChange(app,"#deck=nope");
    assert.strictEqual(app.get("selection.id"), "kurd");
    assert.strictEqual(app.location.hash, "#deck=d-kurd-10");
    assert.strictEqual(replaces(app).length, before + 1);
  });

  test("SU: a hashchange to a refused #s= rewrites the bar to the shown deck's route", async () => {
    const app = boot();
    const before = replaces(app).length;
    await hashChange(app,"#s=zzz");
    assert.strictEqual(app.get("selection.id"), "kurd");
    assert.strictEqual(app.location.hash, "#deck=d-kurd-10");
    assert.strictEqual(replaces(app).length, before + 1);
  });
});

/* ---------------------------------------------------------------- about overlay */

describe("about overlay", () => {
  const REAL_ID = "G-TEST123456";
  const pushes = (app) => app.history.calls.filter((c) => c.type === "push");
  const backs = (app) => app.history.calls.filter((c) => c.type === "back");
  const openAboutFrom = (app) => { app.run("openPanel()"); app.els["about-open"].click(); };
  const headVar = (app) => app.cssVar("--about-head-h");
  const events = (app) => JSON.parse(JSON.stringify(Array.from(app.get("window.dataLayer"))))
    .filter((e) => e[0] === "event").map((e) => ({ name: e[1], params: e[2] }));

  test("AO: About's Privacy paragraph says scales stay on this device and how to share one with the link icon", async () => {
    const PRIVACY = "Your scales stay in this browser on this device. Nothing is published, and no one else can see them. To use a scale on another device or send it to a friend, tap the link icon at the top of the screen and share the link. Opening it adds the scale to that browser, and it stays there.";
    const priv = /<h3>Privacy<\/h3>\s*<p>([^<]*)<\/p>/.exec(aboutHtml());
    assert.ok(priv, "the Privacy paragraph is missing");
    assert.ok(textOf(priv[0]).includes(PRIVACY), "the Privacy paragraph does not say scales stay here and how to share one");
    assert.ok(textOf(priv[0]).includes("The site counts anonymous visits and feature use with Google Analytics, without cookies in the EEA, the UK and Switzerland."), "the Privacy paragraph does not state its Google Analytics sentence");
    const own = /<h3>Add your own scale<\/h3>\s*<p>([^<]*)<\/p>/.exec(aboutHtml());
    assert.ok(own, "the Add your own scale paragraph is missing");
    assert.strictEqual(textOf(own[1]).trim(), "Type any scale and the app generates its chords.");
    const text = textOf(aboutHtml());
    assert.ok(!/lives only in your browser/.test(text) && !/never leave your browser/.test(text));
  });

  test("About lists 16 popular scale links in five groups, each to an existing /scales/<slug>/ page, then the hub link", async () => {
    const rows = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tools", "scale_pages.json"), "utf8"));
    const groups = ["Minor", "Celtic minor", "Pentatonic minor", "Major and bright", "Middle Eastern and Japanese"];
    const m = /<h3>Popular scales<\/h3>([\s\S]*?)<h3>Privacy<\/h3>/.exec(aboutHtml());
    assert.ok(m, "no Popular scales section before Privacy");
    assert.ok(/^\s*<p>Chord charts for 16 common handpan scales\.<\/p>/.test(m[1]), "the intro is missing");
    assert.deepStrictEqual([...m[1].matchAll(/<h4>(.*?)<\/h4>/g)].map((x) => x[1]), groups);
    const links = [...m[1].matchAll(/<li><a href="(\/scales\/[a-z0-9-]+\/)">(.*?)<\/a><\/li>/g)];
    assert.deepStrictEqual(links.map((x) => x[1]), rows.map((r) => `/scales/${r.slug}/`));
    assert.deepStrictEqual(links.map((x) => x[2]), rows.map((r) => `${r.name} handpan chords`));
    for (const r of rows) assert.ok(fs.existsSync(path.join(__dirname, "..", "scales", r.slug, "index.html")), r.slug);
    for (const g of groups) {
      const block = new RegExp(`<h4>${g}</h4>\\s*<ul>([\\s\\S]*?)</ul>`).exec(m[1]);
      assert.ok(block, `no <ul> under ${g}`);
      assert.strictEqual([...block[1].matchAll(/<li><a href="\/scales\/([a-z0-9-]+)\/">/g)].map((x) => x[1]).join(),
        rows.filter((r) => r.group === g).map((r) => r.slug).join());
    }
    assert.ok(/<ul>\s*<li><a href="\/scales\/">All scale chord charts<\/a><\/li>\s*<\/ul>\s*$/.test(m[1]), "the hub link is not a one-item list at the end");
  });

  test("AO: the about section ships hidden as a dialog, in place after #app, with every existing sentence", async () => {
    const html = INDEX_HTML();
    const open = /<section id="about"[^>]*>/.exec(html);
    assert.ok(open, "no about section");
    assert.match(open[0], /\baria-labelledby="about-title"/);
    assert.match(open[0], /\brole="dialog"/);
    assert.match(open[0], /\baria-modal="true"/);
    assert.match(open[0], /\bhidden\b/, "the about section does not ship hidden");
    assert.ok(html.includes('</div>\n\n<section id="about"'), "#about no longer follows #app");
    const inner = aboutHtml();
    assert.match(inner, /^\s*<div class="abouthead">\s*<button type="button" class="mode" id="about-close" aria-label="Back to the practice screen">&larr; BACK<\/button>\s*<h2 id="about-title">About Handpan Theory<\/h2>\s*<\/div>/,
      "the sticky header holds the exit control then the title");
    const text = textOf(inner);
    assert.ok(text.includes(VALUE_LINE));
    for (const d of BUILTIN_DECKS()) {
      const celtic = /^D Amara/i.test(d.name) ? escapeRe(" (D Celtic)") : "";
      assert.ok(new RegExp(`${escapeRe(d.name)}${celtic}[:,]? ${d.chords.length} chord cards`, "i").test(text), d.name);
    }
    assert.ok(!/Celtic Minor/.test(text));
    assert.ok(/D Amara 10 \(D Celtic\): 29 chord cards/.test(text) && /D Amara 9 \(D Celtic\): 27 chord cards/.test(text));
    assert.ok(/<h3>Privacy<\/h3>\s*<p>[^<]*Your scales stay in this browser on this device\./.test(inner));
    assert.ok(/without cookies in the EEA, the UK and Switzerland/.test(text));
    const app = boot();
    assert.strictEqual(app.els.about.hidden, true, "About is open at boot");
  });

  test("AO: ABOUT closes the panel, pushes one #about entry, inerts #app and the panel, and focuses the exit, and a resize after close writes nothing", async () => {
    const app = boot();
    app.run("openPanel()");
    assert.strictEqual(app.get("panelOpen"), true);
    const before = pushes(app).length;
    app.els["about-open"].click();
    assert.strictEqual(app.get("panelOpen"), false, "the settings menu stayed open");
    assert.strictEqual(app.els.about.hidden, false, "About did not open");
    assert.strictEqual(app.get("aboutOpen"), true);
    const added = pushes(app).slice(before);
    assert.strictEqual(added.length, 1, "ABOUT did not push exactly one entry");
    assert.strictEqual(added[0].url, "#about");
    assert.deepStrictEqual(plain(added[0].state), { about: true });
    assert.strictEqual(app.location.hash, "#about");
    assert.strictEqual(app.els["settings-panel"].inert, true, "the panel is not inert");
    assert.strictEqual(app.els["settings-panel"].getAttribute("aria-hidden"), "true");
    assert.strictEqual(app.get("document.documentElement.classList.contains('about-open')"), true);
    assert.strictEqual(app.activeId(), "about-close");
    assert.notStrictEqual(headVar(app), undefined, "--about-head-h was not written on open");
    app.run("closeAbout()");
    app.run("document.documentElement.style.setProperty('--about-head-h', '7px')");
    app.run("syncAboutHead()");
    assert.strictEqual(headVar(app), "7px", "a resize after close wrote --about-head-h");
  });

  test("AO: a #deck= link to a replaced seed whose replacement is the shown deck closes About like the exit control", async () => {
    const probe = boot();
    const base = probe.get("HPE.core.formatSeed(DECKS.find((d) => d.id === \"amara\").fields)");
    const storage = {
      hpfc: JSON.stringify({ deck: "amara", mode: "A" }),
      [probe.get("SCALES_KEY")]: JSON.stringify([{ v: probe.get("SHARE_VERSION"), s: base.replace(/C5$/, "D5"), o: { name: "MY AMARA", palette: 3, replaces: "amara" } }]),
    };
    const app = boot({ storage });
    assert.match(app.currentDeck().id, /^custom:/, "the replacement is not the shown deck");
    openAboutFrom(app);
    const n = app.history.calls.length;
    app.run("aboutLink('#deck=d-amara-9')");
    assert.deepStrictEqual(app.history.calls.slice(n).map((c) => c.type), ["back"], "a link to the replaced seed did not just pop its own entry");
    assert.strictEqual(app.els.about.hidden, true);
    assert.strictEqual(app.activeId(), "settings-trigger");
    assert.match(app.currentDeck().id, /^custom:/);
    assert.doesNotMatch(app.announcer().textContent || "", /That scale is gone/);
  });

  test("AO: a dispatched resize while About is open updates --about-head-h", async () => {
    const html = INDEX_HTML().replace("<head>",
      "<head><script>window.__w = {}; const __a = window.addEventListener; " +
      "window.addEventListener = function (t, f) { (window.__w[t] = window.__w[t] || []).push(f); return __a.apply(this, arguments); };</script>");
    const app = boot({ html });
    openAboutFrom(app);
    app.run("const __q = document.querySelector.bind(document); document.querySelector = (s) => (s === '.abouthead' ? { offsetHeight: 91 } : __q(s));");
    assert.notStrictEqual(headVar(app), "91px", "the head height was already 91px, so a resize proves nothing");
    assert.strictEqual(app.get("(window.__w.resize || []).length"), 1, "no resize listener registered");
    app.run("window.__w.resize.forEach((f) => f({ type: 'resize' }))");
    assert.strictEqual(headVar(app), "91px");
  });

  test("AO: a click on a deck link inside About is default-prevented and goes through aboutLink", async () => {
    const app = boot();
    openAboutFrom(app);
    app.run("globalThis.__links = []; const __al = aboutLink; aboutLink = (h) => { __links.push(h); return __al(h); };");
    const link = { closest: (sel) => (sel === 'a[href^="#deck="]' ? link : null), getAttribute: () => "#deck=f-low-pygmy-18" };
    const ev = app.click(app.els.about, { target: link });
    assert.strictEqual(ev.defaultPrevented, true, "the click was not default-prevented, so the browser would also navigate");
    assert.deepStrictEqual(Array.from(app.get("__links")), ["#deck=f-low-pygmy-18"]);
    assert.strictEqual(app.get("selection.id"), "pygmy");
    assert.strictEqual(app.els.about.hidden, true);
  });

  test("AO: the exit control, Escape and a popstate each close About, consume the #about entry and focus the settings trigger", async () => {
    const closed = (app) => {
      assert.strictEqual(app.els.about.hidden, true);
      assert.strictEqual(app.get("aboutOpen"), false);
      assert.strictEqual(app.els["settings-panel"].inert, false);
      assert.strictEqual(app.get("document.documentElement.classList.contains('about-open')"), false);
      assert.strictEqual(app.activeId(), "settings-trigger");
      assert.strictEqual(app.get("panelOpen"), false, "the settings menu reopened");
    };
    for (const way of ["exit", "escape"]) {
      const app = boot();
      openAboutFrom(app);
      const b0 = backs(app).length;
      if (way === "exit") app.els["about-close"].click(); else app.keydown("Escape");
      closed(app);
      assert.strictEqual(backs(app).length, b0 + 1, way + " did not pop its own entry");
      app.popstate();
      assert.strictEqual(app.location.hash, "#deck=d-kurd-10", way + " left the bar off the deck's route");
    }
    const app = boot();
    openAboutFrom(app);
    const b0 = backs(app).length;
    app.location.hash = "";
    app.popstate();
    closed(app);
    assert.strictEqual(backs(app).length, b0, "a popstate popped a second entry");
  });

  test("AO: syncRoute and hashchange write nothing while About is open", async () => {
    const app = boot();
    openAboutFrom(app);
    const n = app.history.calls.length;
    app.run("syncRoute()");
    assert.strictEqual(app.history.calls.length, n, "syncRoute wrote under About");
    assert.strictEqual(app.location.hash, "#about");
    await hashChange(app,"#deck=c-sharp-hijaz-9");
    assert.strictEqual(app.get("selection.id"), "kurd", "a hashchange routed under About");
    assert.strictEqual(app.history.calls.length, n);
    assert.strictEqual(app.location.hash, "#deck=c-sharp-hijaz-9");
  });

  test("AO: a #deck= link inside About replaces the #about entry with the deck's route and selects the deck", async () => {
    const app = boot();
    openAboutFrom(app);
    const n = app.history.calls.length;
    app.run("aboutLink('#deck=f-low-pygmy-18')");
    const added = app.history.calls.slice(n);
    assert.strictEqual(added.some((c) => c.type === "push"), false, "the link pushed an entry");
    assert.strictEqual(added.some((c) => c.type === "back"), false, "the link popped an entry");
    assert.ok(added.some((c) => c.type === "replace" && c.url === "#deck=f-low-pygmy-18"), "no replace to the deck route");
    assert.strictEqual(app.get("selection.id"), "pygmy");
    assert.strictEqual(app.location.hash, "#deck=f-low-pygmy-18");
    assert.strictEqual(app.els.about.hidden, true);
    assert.strictEqual(app.get("aboutOpen"), false);
    assert.strictEqual(app.els["settings-panel"].inert, false);
  });

  test("AO: a #deck= link to the deck already shown closes About like the exit control", async () => {
    const app = boot();
    openAboutFrom(app);
    const n = app.history.calls.length;
    app.run("aboutLink('#deck=d-kurd-10')");
    const added = app.history.calls.slice(n);
    assert.deepStrictEqual(added.map((c) => c.type), ["back"], "a same-deck link did not just pop its own entry");
    assert.strictEqual(app.els.about.hidden, true);
    assert.strictEqual(app.activeId(), "settings-trigger");
    assert.strictEqual(app.get("selection.id"), "kurd");
    const gone = boot({ storage: { hpfc: JSON.stringify({ deck: "kurd", mode: "A", hidden: ["pygmy"] }) } });
    openAboutFrom(gone);
    gone.run("aboutLink('#deck=f-low-pygmy-18')");
    assert.match(gone.announcer().textContent, /^That scale is gone\./, "a fallback link lost its warning");
  });

  test("AO: a boot on #about leaves About closed and ends on the deck's route", async () => {
    const app = boot({ href: "https://example.test/index.html#about" });
    assert.strictEqual(app.els.about.hidden, true);
    assert.strictEqual(app.get("aboutOpen"), false);
    assert.strictEqual(app.location.hash, "#deck=d-kurd-10");
    assert.deepStrictEqual(pushes(app), []);
  });

  test("AO: a Forward traversal onto #about leaves About closed and rewrites the bar", async () => {
    const app = boot();
    const n = app.history.calls.length;
    app.location.hash = "#about";
    app.popstate();
    assert.strictEqual(app.els.about.hidden, true);
    assert.strictEqual(app.location.hash, "#deck=d-kurd-10");
    assert.deepStrictEqual(app.history.calls.slice(n).map((c) => c.type), ["replace"]);
  });

  test("AO: About ends with a Contact heading and a mailto link to hi@handpantheory.com", async () => {
    const inner = aboutHtml();
    assert.match(inner, /<h3>Privacy<\/h3>\s*<p>[^<]*<\/p>\s*<h3>Contact<\/h3>\s*<p><a href="mailto:hi@handpantheory\.com">hi@handpantheory\.com<\/a><\/p>\s*$/);
  });

  test("AO: ABOUT is a full-width button alone in the last Resources row, and the last Resources stop before Language", async () => {
    const panel = pmPanel();
    const group = panel.slice(panel.indexOf('<h3 class="panel-heading">Resources</h3>'));
    const rows = [...group.matchAll(/<div class="modebar([^"]*)">([\s\S]*?)<\/div>/g)];
    const last = rows[rows.length - 1];
    assert.strictEqual(last[1], "", "the ABOUT row is a plain modebar, full width");
    assert.match(last[2], /^\s*<button class="mode" type="button" id="about-open" aria-haspopup="dialog">ABOUT<\/button>\s*$/);
    assert.ok(group.lastIndexOf('id="about-open"') > group.lastIndexOf("res-handpan-101"), "ABOUT is not after HANDPAN 101");
    const app = boot();
    const stubIds = [...pmPanel().matchAll(/<(?:a|button)\b[^>]*id="(res-[\w-]+|about-open)"/g)].map((m) => m[1]);
    app.run(`settingsPanel.querySelectorAll = (sel) => /res-/.test(sel) ? ${JSON.stringify(stubIds)}.map((id) => ({ id, disabled: false, getClientRects: () => [{}] })) : []`);
    app.run("openPanel()");
    const ids = app.get("panelStops().map((e) => e.id)");
    assert.strictEqual(ids[ids.length - 2], "about-open", "about-open is not the stop before Language");
    assert.strictEqual(ids[ids.length - 3], "res-handpan-101", "HANDPAN 101 does not lead ABOUT");
  });

  test("AO: opening About tracks about_open with no params", async () => {
    const app = boot({ html: withGaId(REAL_ID), webdriver: false });
    const n = events(app).length;
    openAboutFrom(app);
    assert.deepStrictEqual(events(app).slice(n), [{ name: "about_open", params: {} }]);
  });

  test("AO: a fragment navigation while About is open closes About and leaves the destination hash for hashchange", async () => {
    const app = boot();
    openAboutFrom(app);
    app.location.href = app.location.href.replace(/#.*$/, "") + "#deck=c-sharp-hijaz-9";
    const callsBefore = app.history.calls.length;
    app.popstate();
    assert.strictEqual(app.get("aboutOpen"), false, "the pop did not close About");
    assert.strictEqual(app.location.hash, "#deck=c-sharp-hijaz-9", "the pop rewrote the destination");
    assert.strictEqual(app.history.calls.length, callsBefore, "the pop wrote to history");
    await hashChange(app,"#deck=c-sharp-hijaz-9", { force: true });
    assert.strictEqual(app.get("selection.id"), "hijaz");
  });

  test("AO: closing About when it is already closed pops nothing", async () => {
    const app = boot();
    app.run("document.getElementById('modeA').focus()");
    const parked = app.activeId();
    const n = app.history.calls.length;
    app.run("closeAbout()");
    assert.strictEqual(app.history.calls.length, n, "closing a closed About wrote to history");
    assert.strictEqual(app.activeId(), parked, "closing a closed About moved focus");
  });
});

describe("DI: dual input", () => {
  const FIELDS = ["ding", "top", "inner", "bottom"];
  const AMARA_LINE = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
  const el = (app, id) => app.els[id];
  const fire = (app, id, type) => el(app, id).dispatchEvent({ type });
  const fieldType = (app, k, text) => {
    fire(app, "scale-" + k, "focus");
    el(app, "scale-" + k).value = text;
    fire(app, "scale-" + k, "input");
  };
  const fieldSettle = (app, k) => fire(app, "scale-" + k, "blur");
  const lineType = (app, text) => {
    fire(app, "scale-box", "focus");
    el(app, "scale-box").value = text;
    fire(app, "scale-box", "input");
  };
  const fieldTexts = (app) => FIELDS.map((k) => el(app, "scale-" + k).value);
  const cls = (app, id, c) => el(app, id).classList.contains(c);
  const openAdd = () => { const app = boot(); app.els["deck-add"].click(); return app; };
  const openBuiltin = (id) => {
    const app = boot();
    app.select(id);
    app.run("openEditSheet(deck(), document.getElementById('deck-add'))");
    return app;
  };
  const AMARA_FIELDS = { ding: "D3", top: "A3 C4 D4 E4 F4 G4 A4 C5" };
  const fillAmara = (app) => { fieldType(app, "ding", AMARA_FIELDS.ding); fieldType(app, "top", AMARA_FIELDS.top); };
  const src = () => fs.readFileSync(path.join(ROOT, "index.html"), "utf8");























  const oneDeck = () => {
    const four = ["amara10", "amara", "hijaz", "pygmy"];
    const app = boot({ storage: { hpfc: JSON.stringify({ deck: "kurd", mode: "A", hidden: four }) } });
    app.clickChip("D KURD 10");
    fieldType(app, "bottom", "F");
    fieldSettle(app, "bottom");
    return app;
  };
  const visibleMsg = (app) => !el(app, "scale-msg").hidden && el(app, "scale-msg").textContent !== "";











  const noFlags = (app) => {
    assert.strictEqual(app.get("fieldsStale"), false);
    assert.strictEqual(app.get("lineStale"), false);
  };
  for (const open of [() => { const a = openAdd(); fillAmara(a); return a; }, () => openBuiltin("amara")]) {
  }




});




/* ------------------------- UX: the Layout tab and the browser's history ----
 * The Adjust overlay and its state-only history entry are gone (plan
 * 2026-10-19-sheet-tabs). The sandbox keeps no entry stack, so a test plays the
 * browser: history.state and location are set by hand before popstate(). */
const uxToggle = (app) => app.click(app.els["scale-tab-layout"]);
const uxPopTo = (app, state) => { app.history.state = state; app.popstate(); };



/* ------------------------------ TB / OR / O1 on the sheet ------------------
 * Lane T1 of docs/plans/2026-10-19-sheet-tabs.md. The Add/Edit sheet has two
 * tabs, Scale then Layout, an OR rule between the fields and the scale line,
 * and the engine's duplicate-bottom warning on the field line. */
describe("TB: the sheet's tabs", () => {
  const TB_LINE = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
  const tbEl = (app, id) => app.els[id];
  const tbTab = (app, name) => app.els["scale-tab-" + name];
  const tbOpen = async (app, edit, text = TB_LINE) => {
    if (edit) openEdit(app, await makeCustom(app, text)); else { openSheet(app); app.type(text); }
    return app;
  };
  const tbSelected = (app) => ["scale", "layout"].filter((n) => tbTab(app, n).getAttribute("aria-selected") === "true");
  const tbZeros = (app) => ["scale", "layout"].filter((n) => tbTab(app, n).getAttribute("tabindex") === "0");
  const tbMarkup = fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
    .replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, "");
  const tbAttr = (id, name) => {
    const m = new RegExp(`<\\w+\\b[^>]*\\bid="${id}"[^>]*>`).exec(tbMarkup);
    assert.ok(m, `no #${id} in the markup`);
    const a = new RegExp(`\\b${name}="([^"]*)"`).exec(m[0]);
    return a ? a[1] : null;
  };
  const tbStops = (app, from, n) => {
    app.els[from].focus();
    const seen = [from];
    for (let i = 0; i < n; i += 1) {
      app.els["scale-sheet"].dispatchEvent({ type: "keydown", key: "Tab", shiftKey: false, preventDefault() {} });
      seen.push(app.activeId());
    }
    return seen;
  };
  const tbFieldType = (app, k, text) => {
    app.els["scale-" + k].dispatchEvent({ type: "focus" });
    app.els["scale-" + k].value = text;
    app.els["scale-" + k].dispatchEvent({ type: "input" });
  };



  test("TB: a tab switch pushes no history entry and calls no replaceState", async () => {
    const app = await tbOpen(boot());
    const n = app.history.calls.length;
    app.click(tbTab(app, "layout"));
    app.click(tbTab(app, "scale"));
    app.press(tbTab(app, "scale"), "ArrowRight");
    assert.strictEqual(app.history.calls.length, n, JSON.stringify(app.history.calls.slice(n)));
  });

  test("TB: Back, Escape and a popstate close the sheet from the Layout tab exactly as from the Scale tab, with one history.back", async () => {
    const backs = (app) => app.history.calls.filter((c) => c.type === "back").length;
    for (const how of ["back", "escape", "pop"]) {
      const app = await tbOpen(boot());
      app.click(tbTab(app, "layout"));
      assert.strictEqual(app.sheetOpen(), true);
      if (how === "back") app.els["scale-back"].click();
      else if (how === "escape") app.keydown("Escape");
      else { app.history.state = null; app.location.hash = ""; app.popstate(); }
      assert.strictEqual(app.sheetOpen(), false, how);
      assert.strictEqual(backs(app), how === "pop" ? 0 : 1, how);
    }
    const app = await tbOpen(boot());
    app.click(tbTab(app, "layout"));
    app.click(tbTab(app, "scale"));
    app.click(tbTab(app, "layout"));
    app.els["scale-back"].click();
    assert.strictEqual(backs(app), 1, "one Back leaves no extra entry");
  });












});

describe("O1: sheet placement of octaveless bottoms", () => {
  const type = (app, k, text) => {
    app.els["scale-" + k].dispatchEvent({ type: "focus" });
    app.els["scale-" + k].value = text;
    app.els["scale-" + k].dispatchEvent({ type: "input" });
  };
  const settle = (app, k) => app.els["scale-" + k].dispatchEvent({ type: "blur" });
  const fieldsOf = (app) => ["ding", "top", "inner", "bottom"].map((k) => app.els["scale-" + k].value);
});

describe("O1: the duplicate-bottom warning on the field line", () => {
  const WARN_DING = "BOTTOM NOTES: D3 is already the ding. Double-check the bottom notes.";
  const type = (app, k, text) => {
    app.els["scale-" + k].dispatchEvent({ type: "focus" });
    app.els["scale-" + k].value = text;
    app.els["scale-" + k].dispatchEvent({ type: "input" });
  };
  const settle = (app, k) => app.els["scale-" + k].dispatchEvent({ type: "blur" });
  const fill = (app, bottom, inner = "") => {
    openSheet(app);
    type(app, "ding", "D3");
    type(app, "top", "A3 C4");
    if (inner) type(app, "inner", inner);
    type(app, "bottom", bottom);
    settle(app, "bottom");
  };
});

describe("UX: the footer lip", () => {
  const LINE = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
  const rectOf = (top, bottom) => () => ({ top, bottom, left: 0, right: 360, width: 360, height: bottom - top });
  const lipApp = async (kind = "add", extra = {}) => {
    const app = boot({ clock: true, layout: true, innerHeight: 800, visualViewport: { height: 800, offsetTop: 0, scale: 1 }, ...extra });
    if (kind === "seed") app.clickChip("D KURD 10");
    else if (kind === "edit") openEdit(app, await makeCustom(app, LINE));
    else { openSheet(app); app.type(LINE); }
    const bp = app.get("bandPort");
    bp.scrollHeight = 1400;
    bp.clientHeight = 500;
    bp.scrollTop = 0;
    bp.getBoundingClientRect = rectOf(100, 600);
    app.els["scale-sheet"].firstElementChild.getBoundingClientRect = rectOf(0, 700);
    app.els["scale-foot"].getBoundingClientRect = rectOf(600, 700);
    app.advance(200);
    bp.dispatchEvent({ type: "scroll" });
    return app;
  };
  const sheetOf = (app) => app.els["scale-sheet"];
  const user = (app) => sheetOf(app).dispatchEvent({ type: "touchmove", touches: [] });
  const scrollTo = (app, top, touched = true) => {
    const bp = app.get("bandPort");
    if (touched) user(app);
    bp.scrollTop = top;
    bp.dispatchEvent({ type: "scroll" });
  };
  const state = (app) => {
    const c = sheetOf(app).classList;
    return `${c.contains("lipped") ? "lipped" : "plain"}/${c.contains("lipshut") ? "shut" : "open"}`;
  };
  const OPEN = "plain/open", SHUT = "lipped/shut";
  const tab = (app, shiftKey = false) => sheetOf(app).dispatchEvent({ type: "keydown", key: "Tab", shiftKey, preventDefault() {} });
  const isActive = (app, expr) => app.get(`document.activeElement === ${expr}`);
  const collapsed = (app, kind) => { scrollTo(app, 300); assert.strictEqual(state(app), SHUT, kind); return app; };
  const lipSource = () => {
    const src = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    return src.slice(src.indexOf("/* ---- the footer lip"), src.indexOf("function hasTwoNoteRing"));
  };



















  describe("PH: P3 finger drag", () => {
    const shortApp = async () => {
      const a = await lipApp();
      a.get("bandPort").scrollHeight = 510;
      return a;
    };
    const finger = (app, type, y, o = {}) => {
      const pts = type === "touchend" ? [] : [{ identifier: o.id || 1, clientX: o.x || 0, clientY: y }, ...(o.extra ? [{ identifier: 2, clientX: 5, clientY: y }] : [])];
      sheetOf(app).dispatchEvent({ type, touches: pts, changedTouches: [{ identifier: o.id || 1, clientX: o.x || 0, clientY: y }], target: o.target });
    };
    const drag = (app, dy, o = {}) => {
      finger(app, "touchstart", 400, o);
      finger(app, "touchmove", 400 + dy, { ...o, x: (o.x || 0) + (o.dx || 0) });
      if (!o.hold) finger(app, "touchend", 400 + dy, o);
    };
    const isShut = (app) => sheetOf(app).classList.contains("lipshut");





    const trackedTarget = (excluded = true) => {
      const on = {};
      return {
        on,
        closest: (sel) => (excluded && sel.split(",").map((x) => x.trim()).includes("#scale-preview") ? {} : null),
        addEventListener: (type, fn) => { on[type] = fn; },
        fire: (type) => on[type] && on[type]({ type, touches: [] }),
      };
    };







    describe("LG: the lip gesture on every surface, momentum included", () => {
      const HOLD = 250;
      const field = (a, id, tag = "INPUT") => { const e = a.els[id]; e.tagName = tag; return e; };
      const IDS = [["scale-ding", "INPUT"], ["scale-top", "INPUT"], ["scale-inner", "INPUT"], ["scale-bottom", "INPUT"], ["scale-box", "TEXTAREA"]];
      const frames = (a, from, steps, gap = 33) => { let t = from; for (const s of steps) { a.advance(gap); t += s; scrollTo(a, t, false); } return t; };
      const spy = (a, fn) => a.run(`(() => { const o = ${fn}; globalThis.__${fn} = 0; ${fn} = function () { globalThis.__${fn}++; return o.apply(this, arguments); }; })()`);
      const calls = (a, fn) => a.get(`globalThis.__${fn}`);
      const flingOf = (a) => a.get("lipFling ? lipFling.way : null");
      const bodyAt = (a, top) => { a.get("bandPort").scrollTop = top; a.run("lipRebase()"); };
      const hit = (sel) => ({ closest: (s) => (s.split(",").map((x) => x.trim()).includes(sel) ? {} : null) });















      const flingFrom = (a, { seed = 10, way = "up", start = 0 } = {}) => {
        bodyAt(a, start);
        finger(a, "touchstart", 400);
        const y = way === "up" ? 390 : 410;
        const t = way === "up" ? start + seed : start - seed;
        a.get("bandPort").scrollTop = t;
        a.get("bandPort").dispatchEvent({ type: "scroll" });
        finger(a, "touchmove", y);
        finger(a, "touchend", y);
        return t;
      };














    });

    describe("SPN: tests-only nits on the lip fling and the example plate", () => {
      const downFling = (a, start, seed) => {
        a.get("bandPort").scrollTop = start;
        a.run("lipRebase()");
        finger(a, "touchstart", 400);
        a.get("bandPort").scrollTop = start - seed;
        a.get("bandPort").dispatchEvent({ type: "scroll" });
        finger(a, "touchmove", 410);
        finger(a, "touchend", 410);
      };

    });
  });






});

describe("SPN: the example plate", () => {
});

function plateNotes(app) {
  return [...app.els["scale-preview"].innerHTML.matchAll(/<text[^>]*>([A-G][#b]?)<tspan[^>]*>(-?\d+)<\/tspan>/g)].map((m) => m[1] + m[2]);
}

describe("PH: phone-check fixes", () => {
  const plateLabels = (app) =>
    [...app.els["scale-preview"].innerHTML.matchAll(/<text[^>]*>([^<]*)</g)].map((m) => m[1]).join("|");




});

describe("SPA: sheet polish lane A", () => {
});

describe("SPB: sheet polish lane B", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
    .replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, "");
  const panelSpan = (id) => {
    const start = html.indexOf(`<div id="${id}"`);
    assert.ok(start >= 0, `no #${id} in the markup`);
    let depth = 0;
    for (const m of html.slice(start).matchAll(/<(\/?)div\b[^>]*>/g)) {
      depth += m[1] ? -1 : 1;
      if (depth === 0) return { start, end: start + m.index + m[0].length, html: html.slice(start, start + m.index + m[0].length) };
    }
    throw new assert.AssertionError({ message: `#${id} is never closed` });
  };


});

describe("CN: SCALE NAME on the Add sheet", () => {
  const html = () => fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const typeName = (app, name) => {
    app.els["scale-name"].value = name;
    app.els["scale-name"].dispatchEvent({ type: "input" });
  };
  const addAndGenerate = async (app, name) => {
    openSheet(app);
    if (name !== undefined) typeName(app, name);
    app.type(AMARA_STRING);
    app.click(app.els["scale-next"]);
    await generateClick(app);
    return savedViews(app)[app.get("selection.id")];
  };





  test("CN3: Add with a typed name, NEXT, GENERATE CARDS: the deck, its chip and the share code carry the normalised name", async () => {
    const app = boot();
    const d = await addAndGenerate(app, "RAY\u2019S \u2013 PAN");
    assert.strictEqual(d.name, "RAY'S - PAN");
    assert.ok(chipRow(app).some((c) => c.label === "RAY'S - PAN" && c.on),
      JSON.stringify(chipRow(app).map((c) => c.label)));
    const url = link(app, d.instanceId || d.id);
    assert.strictEqual(url.ok, true, url.reason);
    const again = boot();
    openShare(again, payload(url.value));
    assert.strictEqual(savedViews(again)[again.get("selection.id")].name, "RAY'S - PAN");
  });

  test("CN4: Add with the box empty takes the auto label and writes no options.name", async () => {
    const app = boot();
    const d = await addAndGenerate(app);
    assert.ok(d.name && d.name.length > 0);
    assert.strictEqual(d.options.name, undefined);
    const bare = await makeCustom(boot());
    assert.strictEqual(d.name, bare.name);
  });




  test("CN8: Add with a different typed name preserves the original and exact repeats reuse the named instance", async () => {
    const app=boot(),first=await makeCustom(app),before=plain(app.get(`savedState.entries.find(row=>row.instanceId===${JSON.stringify(first.instanceId)})`));
    const second=await addAndGenerate(app,"SECOND NAME");assert.strictEqual(second.id,first.id);assert.notStrictEqual(second.instanceId,first.instanceId);
    assert.deepStrictEqual(Object.keys(savedViews(app)),[first.instanceId,second.instanceId]);assert.strictEqual(second.name,"SECOND NAME");
    assert.deepStrictEqual(plain(app.get(`savedState.entries.find(row=>row.instanceId===${JSON.stringify(first.instanceId)})`)),before);
    assert.ok(app.announcer().textContent.includes("cards generated"));const repeat=await addAndGenerate(app,"SECOND NAME");
    assert.strictEqual(repeat.instanceId,second.instanceId);assert.strictEqual(Object.keys(savedViews(app)).length,2);
  });

});

test("LF: the root rule sets text-size-adjust to 100% with the -webkit- prefix, so landscape iOS does not inflate text", async () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const css = html.slice(html.indexOf("<style>"), html.indexOf("@media print{"));
  const rules = [...css.matchAll(/(?:^|[\s}\/])html\s*\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(rules.some((r) => /(?:^|[;\s])-webkit-text-size-adjust:\s*100%/.test(r)), "html lacks -webkit-text-size-adjust:100%");
  assert.ok(rules.some((r) => /(?:^|[;\s])text-size-adjust:\s*100%/.test(r)), "html lacks text-size-adjust:100%");
});

describe("DS: the visible word is scale", () => {
  const html = () => fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const WORD = /(?<![#\w-])decks?(?![\w=-])/i;

  function deckHits() {
    const hits = [];
    let h = html().replace(/<!--[\s\S]*?-->/g, "");
    const scripts = [];
    h = h.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (m, body) => {
      scripts.push(m);
      return "";
    });
    h = h.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
    for (const tag of h.match(/<[a-z][^>]*>/gi) || []) {
      const re = /\b(content|aria-label|title|placeholder|alt|value)="([^"]*)"/gi;
      let m;
      while ((m = re.exec(tag))) if (WORD.test(m[2])) hits.push(`attr ${m[1]}: ${m[2]}`);
    }
    for (const t of h.replace(/<[^>]*>/g, "\n").split("\n")) if (WORD.test(t)) hits.push(`text: ${t.trim()}`);
    const ld = scripts.find((s) => /application\/ld\+json/.test(s));
    const walk = (v) => {
      if (typeof v === "string") { if (WORD.test(v)) hits.push(`jsonld: ${v}`); }
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(JSON.parse(ld.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "")));
    const src = html().replace(/<!-- engine:(\S+) begin[\s\S]*?<!-- engine:\1 end -->/g, "");
    const app = src.split(/<script\b[^>]*>/i).slice(1).map((s) => s.split(/<\/script>/i)[0])
      .filter((s) => !/^\s*\{/.test(s)).join("\n");
    const code = app.replace(/\/\*[\s\S]*?\*\//g, "");
    for (const line of code.split("\n")) {
      if (/^const DECKS = /.test(line) || /^\s*\/\//.test(line)) continue;
      const bare = line.replace(/\s\/\/\s.*$/, "");
      for (const lit of bare.match(/"[^"\\\n]*(?:\\.[^"\\\n]*)*"|'[^'\\\n]*(?:\\.[^'\\\n]*)*'|`[^`]*`/g) || []) {
        if (/\s/.test(lit) && WORD.test(lit)) hits.push(`script: ${lit}`);
      }
    }
    return hits;
  }

  test("DS1: no served text, attribute, JSON-LD value or app-script string literal says deck", async () => {
    assert.deepStrictEqual(deckHits(), []);
  });



  test("DS2b: a boot on a hidden seed says That scale is gone", async () => {
    const boot1 = boot({ storage: { hpfc: JSON.stringify({ deck: "kurd", mode: "A", hidden: ["kurd"] }) } });
    assert.match(boot1.announcer().textContent, /^That scale is gone\. Showing /);
    assert.doesNotMatch(boot1.announcer().textContent, /\bdeck\b/i);
  });

});

/* ---- Lane FP-D: the bottom ring slides (drawer drag and nudge) ----
 * The fixture is three bottom notes, a ding and four rim notes. The sandbox plate
 * sits at (200, 200) at scale 1 with R = 100 and the bottom orbit at 115, so a
 * bottom note at angle a is at (200 + 115 cos a, 200 - 115 sin a). The floor
 * between two bottom notes is 15 degrees here. */
describe("FPD: the drawer slides bottom notes", () => {
  const FPD = "[C3] [D3] [E3] (A3) C4 D4 E4 F4";
  const orbit = (a, r = 115) => ({ x: 200 + r * Math.cos(a * Math.PI / 180), y: 200 - r * Math.sin(a * Math.PI / 180) });
  const fpdAngles = (app) => JSON.parse(app.get("JSON.stringify(layoutAngles)"));
  const fpdAngle = (app, id) => app.get(`lastSolved.fields[${id}][4]`);
  const fpdLabel = (app, id) => app.get(`lastSolved.fields[${id}][5]`);
  const fpdWarn = (app) => app.els["scale-drawer-status"].classList.contains("warn");
  const fpdOpen = async (text = FPD, opts = {}) => await dgOpen(opts, text);
  const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.6, `${msg}: ${a} vs ${b}`);




});

describe("FPD: seats, sole note, hint, nudge, notices and records", () => {
  const FPD = "[C3] [D3] [E3] (A3) C4 D4 E4 F4";
  const orbit = (a, r = 115) => ({ x: 200 + r * Math.cos(a * Math.PI / 180), y: 200 - r * Math.sin(a * Math.PI / 180) });
  const ang = (app) => JSON.parse(app.get("JSON.stringify(layoutAngles)"));
  const angleOf = (app, id) => app.get(`lastSolved.fields[${id}][4]`);
  const labelOf = (app, id) => app.get(`lastSolved.fields[${id}][5]`);
  const open = async (text = FPD, edit = false) => await dgOpen({}, text, edit);
  const slide = (app, name, a) => {
    const g = DG.down(app, name, "mouse");
    DG.moveTo(app, g, g.x + 6, g.y);
    const q = orbit(a);
    DG.moveTo(app, g, q.x, q.y);
    DG.release(app, g, q.x, q.y);
  };





  const saved = async () => {
    const app = await open();
    slide(app, "C3", 300);
    await generateClick(app);
    const rec = savedViews(app)[app.get("selection.id")];
    openEdit(app, rec);
    app.click(app.els["scale-tab-layout"]);
    return app;
  };





  test("FPD: generateDeck carries options.angles into the solve and the record", async () => {
    const HPEs = require("./helpers/engine.js").loadEngine(["core", "voicing", "layout", "naming", "select", "share"]);
    const seed = HPEs.core.parseSeed("[C3] [Db3] [Eb3] (F3) G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]", { anchor: "between" });
    assert.strictEqual(seed.ok, true);
    const plain = JSON.parse(JSON.stringify(seed.value));
    plain.options = Object.assign({}, plain.options, { angles: { bottom: [null, null, null, 20, null, null] } });
    const enc = HPEs.share.encode(plain);
    assert.strictEqual(enc.ok, true);
    assert.match(enc.value, /\/between\/at-,,,20,,\/[0-9a-f]{6}$/);
    const app = await durableBoot({ href: "https://example.test/index.html#s=" + enc.value });
    const stored=savedEnvelope(app).entries.map(row=>row.record);
    assert.deepStrictEqual(stored[0].o.angles, { bottom: [null, null, null, 20, null, null] });
    const deck = savedViews(app)[app.get("selection.id")];
    const u4 = Object.values(deck.fields).filter((f) => f[3] === "bottom")[3];
    assert.strictEqual(u4[4], 20);
    const link = "#s=6/uC3_uDb3_uEb3_(F3)_G3_Ab3_uBb3_C4_uDb4_Eb4_F4_G4_Ab4_C5_Eb5_-_F5_G5_uAb5/*F+AEOLIAN+12/between/at-,225,,20,,130/5af123";
    const app2 = await durableBoot({ href: "https://example.test/index.html" + link });
    assert.strictEqual(app2.location.hash, link);
    const stored2=savedEnvelope(app2).entries.map(row=>row.record);
    assert.deepStrictEqual(stored2[0].o.angles.bottom, [null, 225, null, 20, null, 130]);
  });

  test("SV3 E1: a copied saved layout's share code keeps its custom bottom angles", async () => {
    const link = "#s=6/uC3_uDb3_uEb3_(F3)_G3_Ab3_uBb3_C4_uDb4_Eb4_F4_G4_Ab4_C5_Eb5_-_F5_G5_uAb5/*F+AEOLIAN+12/between/at-,225,,20,,130/5af123";
    const app = await durableBoot({ href: "https://example.test/index.html" + link });
    const res = JSON.parse(JSON.stringify(app.get("shareCode(deck())")));
    assert.strictEqual(res.ok, true);
    assert.match(res.value, /\/between\/at-,225,,20,,130\/[0-9a-f]{6}$/);
  });






});


/* ---- Lane OF-A: the sheet's seats follow the typed order (plan order-follow, 2026-10-23) ---- */
describe("OF: the sheet's seats follow the typed order", () => {
  const NAMED = "(D3) C4 A3 D4 E4 F4 G4 A4 C5";
  const ASC = "(D3) A3 C4 D4 E4 F4 G4 A4 C5";
  const RIM = [1, 0, 2, 3, 4, 5, 6, 7];
  const HINT = "Top notes take their seats in the order listed. Rearrange them on the Layout tab.";
  const ofPlain = (v) => JSON.parse(JSON.stringify(v));
  const add = () => { const app = boot(); openSheet(app); return app; };
  const fire = (app, id, type) => app.els[id].dispatchEvent({ type });
  const fieldType = (app, k, text) => {
    fire(app, "scale-" + k, "focus");
    app.els["scale-" + k].value = text;
    fire(app, "scale-" + k, "input");
  };
  const settle = (app, k) => fire(app, "scale-" + k, "blur");
  const lineType = (app, text) => {
    fire(app, "scale-box", "focus");
    app.els["scale-box"].value = text;
    fire(app, "scale-box", "input");
  };
  const fieldTexts = (app) => ["ding", "top", "inner", "bottom"].map((k) => app.els["scale-" + k].value);
  const note = (app, which) => app.els[`scale-${which}-note`].textContent;
  const live = (app) => { app.flushTimers(); return app.els["scale-fields-live"].textContent; };
  const typedFields = (app, ding, top, inner = "") => {
    fieldType(app, "ding", ding);
    fieldType(app, "top", top);
    if (inner) fieldType(app, "inner", inner);
  };
  const seated = (ascText, seats) => {
    const app = boot();
    const made = app.generate(ascText, { seats });
    assert.strictEqual(made.ok, true, made.reason);
    return { app, rec: savedViews(app)[made.instanceId] };
  };
  const save = async (app) => { await generateClick(app); return savedViews(app)[app.get("selection.id")]; };
  const rimLabelled = (app, label) => ofPlain(app.get(
    `Object.values(lastSolved.fields).filter((f) => f[3] === "rim" && f[5] === ${JSON.stringify(label)})`));



  test("OF: a line typed in ascending order saves no seats key and the record equals the base's", async () => {
    const app = add();
    app.type(ASC);
    assert.strictEqual(d2Seats(app), null);
    const rec = await save(app);
    assert.strictEqual("seats" in rec.options, false);
    assert.deepStrictEqual(ofPlain(rec.options), { palette: 0, mirror: false, mirrorBottom: false, anchor: "one", parent: null });
    const base = boot().generate(ASC, {});
    assert.deepStrictEqual(ofPlain(rec.fields), ofPlain(base.value.fields));
    assert.deepStrictEqual(ofPlain(rec.chords), ofPlain(base.value.chords));
  });






















  const RIM_SAID = "The rim now follows the order listed.";
  const INNER_SAID = "The inner notes now follow the order listed.";
  const INNER_NAMED = "(D3) A3 C4 D4 E4 F4 | G5 F5";









  // PD2 fixtures describe actual listed notes, not pending-state internals.
  // English note input stays unchanged; only the existing UI sentences combine.
  const PD2_BASE = "(D3) A3 C4 D4 E4 F4 | F5 G5";
  const PD2_RIM = "(D3) C4 A3 D4 E4 F4 | F5 G5";
  const PD2_INNER = "(D3) A3 C4 D4 E4 F4 | G5 F5";
  const PD2_BOTH = "(D3) C4 A3 D4 E4 F4 | G5 F5";
  const PD2_SAID = RIM_SAID + " " + INNER_SAID;
  const pd2Open = () => { const app = add(); lineType(app, PD2_BASE); return app; };
  const pd2InnerThenRim = (app) => { lineType(app, PD2_INNER); lineType(app, PD2_BOTH); };
  const pd2Layout = (app) => app.click(app.els["scale-tab-layout"]);

















  const PD2_BOTTOM_BASE = "[C3] [D3] [E3] (A3) C4 D4 E4 F4 | G4 A4";
  const PD2_BOTTOM_FOUR = "[C3] [D3] [E3] [F3] (A3) D4 C4 E4 F4 | G4 A4";
  const PD2_BOTTOM_RESET = "The bottom now has 4 notes, so its angles were reset.";
  const pd2BottomEdit = (options) => {
    const app = boot();
    const made = app.generate(PD2_BOTTOM_BASE, options);
    assert.strictEqual(made.ok, true, made.reason);
    openEdit(app, savedViews(app)[made.instanceId]);
    return app;
  };




});

/* ------------------------------------------------------------------ I18N */

describe("I18N", () => {
  const EN_PATH = path.join(ROOT, "data", "i18n", "en.json");
  const readEn = () => JSON.parse(fs.readFileSync(EN_PATH, "utf8"));
  const wrapOne = (s) => "⟦" + s + "⟧";
  const wrap = (v) => (typeof v === "string" ? wrapOne(v)
    : Object.fromEntries(Object.entries(v).map(([k, s]) => [k, wrapOne(s)])));
  /** index.html with every requested language table added, each value the en value in brackets. */
  function pseudo(langs) {
    const en = readEn();
    const tables = { en };
    for (const l of langs) tables[l] = Object.fromEntries(Object.entries(en).map(([k, v]) => [k, wrap(v)]));
    const html = INDEX_HTML();
    assert.ok(/const I18N = \{.*\};/.test(html), "index.html has no const I18N region");
    return html.replace(/const I18N = \{.*\};/, () => "const I18N = " + JSON.stringify(tables) + ";");
  }
  const ALL = ["de", "fr", "it", "es", "ja", "zh-Hant", "zh-Hans"];
  const bootLang = (langs, languages, extra = {}) => boot({ html: pseudo(langs), languages, ...extra });
  const hasEnglishOnlyId = new Set(["decks", "front", "back", "count", "scale-ding", "scale-top", "scale-inner",
    "scale-bottom", "scale-box", "scale-parse", "scale-name", "about", "scale-preview", "share-url", "seq-style-name",
    "scale-refusal", "announce", "print-paper", "print-paper-letter", "print-paper-a4"]);

  /** Every [id, kind, value] the app wrote to a UI element and left non-empty. */
  function uiTexts(app) {
    const out = [];
    for (const [id, el] of Object.entries(app.els)) {
      if (hasEnglishOnlyId.has(id)) continue;
      if (String(el.textContent || "").trim()) out.push([id, "text", el.textContent]);
      for (const a of ["aria-label", "title", "placeholder"]) {
        const v = el.getAttribute(a);
        if (v) out.push([id, a, v]);
      }
    }
    return out;
  }
  const bare = (app) => uiTexts(app).filter(([, , v]) => !v.includes("⟦"));

  test("I18N: the detection table", async () => {
    const cases = [
      [[], "en"], [["pt-BR", "de"], "de"], [["en-US", "de"], "en"], [["en", "ja"], "en"], [["de-CH", "en"], "de"],
      [["zh-HK"], "zh-Hant"], [["zh-TW"], "zh-Hant"], [["zh-Hant"], "zh-Hant"],
      [["zh-CN"], "zh-Hans"], [["zh"], "zh-Hans"], [["zh-SG"], "zh-Hans"], [["pt-BR"], "en"],
    ];
    for (const [languages, want] of cases) {
      const app = bootLang(ALL, languages);
      assert.strictEqual(app.get("uiLang()"), want, JSON.stringify(languages));
    }
    assert.strictEqual(bootLang([], ["de"]).get("uiLang()"), "en", "a code with no table gives en");
    assert.strictEqual(bootLang(["fr"], ["de", "fr"]).get("uiLang()"), "fr", "the first entry with a table wins");
    assert.deepStrictEqual([...bootLang(["fr", "ja"], ["en"]).get("LANGS")], ["en", "fr", "ja"]);
  });

  test("I18N: a stored lang beats detection and Auto stores nothing", async () => {
    const stored = JSON.stringify({ deck: "kurd", lang: "ja" });
    const app = bootLang(ALL, ["de"], { storage: { hpfc: stored } });
    assert.strictEqual(app.get("uiLang()"), "ja");
    app.run("setLang(null)");
    assert.strictEqual(app.get("uiLang()"), "de");
    assert.ok(!("lang" in JSON.parse(app.store.hpfc)), "Auto deletes the lang field");
    assert.strictEqual(JSON.parse(app.store.hpfc).deck, "kurd", "and writes nothing else");
    const fresh = bootLang(ALL, ["de"]);
    const before = fresh.store.hpfc;
    fresh.run("setLang(null)");
    assert.strictEqual(fresh.store.hpfc, before, "Auto on a store with no lang writes nothing");
    fresh.run('setLang("fr")');
    assert.strictEqual(JSON.parse(fresh.store.hpfc).lang, "fr");
    assert.strictEqual(fresh.get("uiLang()"), "fr");
  });

  test("I18N: an unknown stored lang reads as Auto and is not rewritten", async () => {
    for (const lang of ["xx", 123, null, ["de"], "pt"]) {
      const raw = JSON.stringify({ deck: "kurd", lang });
      const app = bootLang(["de"], ["de"], { storage: { hpfc: raw } });
      assert.strictEqual(app.get("uiLang()"), "de", JSON.stringify(lang));
      assert.deepStrictEqual(JSON.parse(app.store.hpfc).lang, lang, "the unknown value stays as stored");
    }
  });

  test("I18N: <html lang> follows the UI language at boot and on change", async () => {
    const app = bootLang(["de", "fr"], ["de"]);
    assert.strictEqual(app.get("document.documentElement.lang"), "de");
    app.run('setLang("fr")');
    assert.strictEqual(app.get("document.documentElement.lang"), "fr");
    app.run('setLang("en")');
    assert.strictEqual(app.get("document.documentElement.lang"), "en");
    app.run("setLang(null)");
    assert.strictEqual(app.get("document.documentElement.lang"), "de");
  });

  test("I18N: the first paint is already in the resolved language", async () => {
    const app = bootLang(["de"], ["de"]);
    assert.deepStrictEqual(bare(app), [], "no in-scope text is the bare English value at the end of boot");
    assert.ok(app.faces().includes("⟦Tap to reveal the notes⟧"), "the first card face is already in de");
  });



  test("I18N: a missing key falls back to English per key", async () => {
    const en = readEn();
    const tables = { en, de: { "sheet.next": "⟦NEXT⟧" } };
    const html = INDEX_HTML().replace(/const I18N = \{.*\};/, () => "const I18N = " + JSON.stringify(tables) + ";");
    const app = boot({ html, languages: ["de"] });
    assert.strictEqual(app.get("uiLang()"), "de");
    assert.strictEqual(app.get('t("sheet.next")'), "⟦NEXT⟧");
    assert.strictEqual(app.get('t("sheet.generate")'), en["sheet.generate"], "absent in de: en answers");
    assert.strictEqual(app.get('t("no.such.key")'), "no.such.key", "absent in both: the key itself");
  });

  test("I18N: the English DOM of the app equals the base: card text carries lang=en only under another UI language", async () => {
    const face = (languages) => {
      const app = boot({ languages });
      return app.get("headerHTML(DECKS[0], DECKS[0].chords[0], 1, false)") + app.get("nameHTML(DECKS[0].chords[0], false)");
    };
    assert.ok(!/lang="en"/.test(face(["en-US", "en"])), "English UI marked its own text as an island");
    assert.ok(/lang="en"/.test(face(["de"])), "a German UI left the English card text unmarked");
  });

  test("I18N: under every present table the card face differs from English only in the .hint text", async () => {
    const en = readEn();
    const strip = (s) => s
      .replace(/ lang="en"/g, "")
      .replace(/(<div class="hint"[^>]*>)[^<]*(<\/div>)/g, "$1$2")
      .split(wrapOne(en["card.which_chord"])).join(en["card.which_chord"]);
    const faces = (app, d, mode) => {
      app.run("Math.random = () => 0.37");
      app.select(d);
      app.run(`setMode("${mode}")`);
      const out = [];
      for (let i = 0; i < 3; i++) {
        out.push(app.faces());
        app.run("step(1)");
      }
      return out;
    };
    const base = boot({ html: pseudo([]), languages: ["en"] });
    const loc = bootLang(["de"], ["de"]);
    for (const d of base.get("DECKS").map((x) => x.id)) {
      for (const mode of ["A", "B", "S"]) {
        const a = faces(base, d, mode), b = faces(loc, d, mode);
        a.forEach((f, i) => assert.strictEqual(strip(b[i]), strip(f), `${d} ${mode} card ${i}`));
      }
    }
    assert.ok(loc.get("DECKS").length >= 5);
  });

  test("I18N: config carries ui_lang from the eight-code set and page_location stays hash-free", async () => {
    const html = (langs) => pseudo(langs).replace(GA_LITERAL, 'const GA_MEASUREMENT_ID = "G-TEST123456";');
    const cfg = (app) => JSON.parse(JSON.stringify(Array.from(app.get("window.dataLayer")))).find((e) => e[0] === "config");
    const one = boot({ html: html(["de"]), languages: ["de"], webdriver: false, href: "https://example.test/index.html#s=SECRET" });
    assert.strictEqual(cfg(one)[2].ui_lang, "de");
    assert.strictEqual(cfg(one)[2].page_location, "https://example.test/index.html");
    const two = boot({ html: html([]), languages: ["pt-BR"], webdriver: false, href: "https://example.test/index.html" });
    assert.strictEqual(cfg(two)[2].ui_lang, "en");
    const codes = new Set(["en", "de", "fr", "it", "es", "ja", "zh-Hant", "zh-Hans"]);
    for (const l of ALL) {
      const app = boot({ html: html(ALL), languages: [l], webdriver: false, href: "https://example.test/index.html" });
      assert.ok(codes.has(cfg(app)[2].ui_lang), l);
    }
  });

  test("I18N: every table has the keys of en and keeps every placeholder", async () => {
    const dir = path.join(ROOT, "data", "i18n");
    const en = readEn();
    // Frozen before Naturalness, not inferred from the candidate being checked.
    // See the fixture's source commit/hashes and the reviewed Naturalness plan.
    const contract = JSON.parse(fs.readFileSync(path.join(ROOT, "tests", "fixtures", "i18n_contract_v1.json"), "utf8"));
    const locales = ["en", ...ALL];
    const counts = (s) => {
      const out = new Map();
      for (const token of s.match(/\{\w+\}/g) || []) {
        const name = token.slice(1, -1);
        out.set(name, (out.get(name) || 0) + 1);
      }
      return Object.fromEntries(out);
    };
    const edges = (s) => [s.match(/^\s*/u)[0], s.match(/\s*$/u)[0]];
    const isPlural = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
    assert.strictEqual(contract.version, 1);
    assert.strictEqual(contract.provenance.baselineCommit, "1510ea369573078e6296fe873edb6f538c3212a3");
    assert.strictEqual(contract.keyCount, 250);
    const savedKeys=["saved.ackPending","saved.conflict","saved.conflictDeleted","saved.failure","saved.importFailure","saved.legacy","saved.presetToken","saved.recovery","saved.resetConflict","saved.resetFailure","saved.savedToken","saved.separate","saved.session","saved.sessionAckPending","saved.sessionImportAckPending","saved.temporary"];
    const retiredKeys=["panel.res_amy_bottom","panel.res_amy_bottom.aria","panel.res_amy_prog","panel.res_amy_prog.aria","footer.shuffle_off","footer.shuffle_on","seq.no_playable","about.title","sheet.your_scale","sheet.note_by_note","sheet.lip.aria","sheet.duplicate","sheet.hit_label","sheet.only_note","sheet.mirror_reflow"],neotoneKeys=["sheet.layout_mode", "sheet.mode_standard", "sheet.neotone_check", "sheet.mode_neotone", "sheet.neotone_inner_extra", "sheet.neotone_top_extra", "sheet.neotone_both_extra", "sheet.neotone_extra_mutant", "sheet.neotone_extra_main", "sheet.neotone_and", "sheet.neotone_pair_help", "sheet.neotone_unused", "sheet.neotone_range", "sheet.neotone_rearrange", "sheet.neotone_builtin", "sheet.neotone_builtin_plain", "sheet.neotone_name_label", "sheet.neotone_name_suffix", "sheet.neotone_name_suffix_plain", "sheet.neotone_name_hint", "sheet.drawer_hint_neotone", "sheet.tonefield_label", "sheet.neotone_ring_main", "sheet.neotone_ring_mutant", "sheet.neotone_empty", "sheet.neotone_demo", "sheet.neotone_picked", "sheet.neotone_swapped", "sheet.neotone_moved", "sheet.neotone_other_ring", "sheet.neotone_input_inner", "reason.NEOTONE_INPUT", "reason.PROFILE_UNKNOWN", "reason.PROFILE_MAP_INVALID", "reason.PROFILE_NOTE_MISSING", "reason.PROFILE_NOTE_TWICE", "reason.PROFILE_FULL", "reason.PROFILE_CONFLICT"],addedKeys=["panel.explore","header.share","sheet.mirror_keeps_numbers","move.notice","move.failed","move.banner","move.banner_empty","move.banner_overcap","move.go","move.go_plain","move.dismiss","move.banner_label","move.deadline","move.deadline_empty","panel.pdf_menu","panel.pdf_easy","panel.pdf_easy_medium","panel.pdf_all","editor.line.aria","editor.name.aria","editor.pins_reset","editor.undo","editor.redo","editor.remove","editor.reset","editor.save","editor.dlg.title","editor.dlg.body","editor.dlg.save","editor.dlg.discard","editor.dlg.keep","editor.empty","editor.pan.aria","editor.pantype","editor.standard","editor.neotone","editor.held","editor.cancel","editor.say.swapped","editor.say.ding_swap","editor.say.ding_replace","editor.say.replaced","editor.say.removed","editor.say.went_back","editor.release_remove","editor.say.ding_stays","editor.say.same_zone","editor.say.zone_is_full","editor.say.no_room","editor.zone_full","editor.say.placed","editor.say.added","editor.say.picked","editor.say.zone_inner","editor.say.zone_bottom","editor.say.ding_required","editor.say.rim_min","editor.say.moved","editor.say.nudged","editor.area.aria.inner","editor.area.aria.bottom","editor.neo.field_empty","editor.neo.own_row","editor.seats_reset","editor.tray.aria","editor.octave","editor.octave_label","editor.dragging","editor.octave_down","editor.octave_up","editor.flats","editor.palette","editor.palette_n","editor.layout.aria","editor.note.aria","editor.note.aria_ding","editor.zone.rim","editor.zone.inner","editor.zone.bottom","editor.zone.ding","editor.ding_bottom_only","editor.full.rim","editor.full.inner","editor.full.bottom","editor.crowded","editor.reset.inner","editor.reset.bottom","editor.reset_both","editor.reset_both_aria","editor.hint.place","editor.hint.ding","editor.tabs.aria","editor.accidentals.aria","editor.sharps","editor.more.aria","editor.menu.delete","editor.menu.delete_armed","editor.count.rim","editor.count.inner","editor.count.bottom","editor.count.ding","editor.count.main","editor.count.mutant",...["open","intro","session","restore","text.aria","share","copy","download","empty","copied","shared","select","downloaded","last","file_title","file_hidden"].map(k=>"backup."+k),...neotoneKeys],addedPluralKeys=["move.notice","move.banner"];
    const legacySheetKeys=["compose.DING_EMPTY", "compose.DING_ONE", "compose.DOUBLE_B", "compose.DUPLICATE_NOTE.ding", "compose.DUPLICATE_NOTE.inner", "compose.DUPLICATE_NOTE.top", "compose.INNER_BELOW_TOP", "compose.IN_BOTTOM", "compose.IN_TOP", "compose.NOT_ABOVE_DING", "compose.NOT_A_NOTE", "compose.NO_FIFTH", "compose.NO_OCTAVE_FITS", "compose.OCTAVES_GUESSED", "compose.OCTAVES_GUESSED_INNER", "compose.OUT_OF_RANGE", "compose.SOLFEGE", "compose.TOP_EMPTY", "compose.TYPE_NOTES_ONLY", "sheet.anchor_hint", "sheet.angle_next", "sheet.angle_next.aria", "sheet.angle_prev", "sheet.angle_prev.aria", "sheet.angles_reset", "sheet.at", "sheet.bottom", "sheet.bottom_now_has", "sheet.bottom_now_has_angles", "sheet.bottom_now_has_both", "sheet.bottom_opt", "sheet.cancelled", "sheet.counts", "sheet.del_armed", "sheet.del_idle", "sheet.ding", "sheet.drawer.aria", "sheet.drawer_hint", "sheet.drawer_hint_neotone", "sheet.drawer_hint_slide", "sheet.drop_swap", "sheet.field_msg", "sheet.fields_follow", "sheet.fields_head", "sheet.fields_stale", "sheet.fine_hide", "sheet.fine_show", "sheet.generating", "sheet.in_way", "sheet.inner", "sheet.inner_below", "sheet.inner_follows", "sheet.inner_short", "sheet.layout_changed", "sheet.layout_hint_empty", "sheet.layout_reset", "sheet.layout_unsaved_add", "sheet.layout_unsaved_edit", "sheet.line_follows", "sheet.line_label", "sheet.line_stale", "sheet.line_sub", "sheet.lip_show", "sheet.list_and", "sheet.mirror_bottom", "sheet.mirror_bottom_off", "sheet.mirror_bottom_on", "sheet.mirror_hint", "sheet.mirror_keeps_numbers", "sheet.mirror_top", "sheet.mirror_top_off", "sheet.mirror_top_on", "sheet.mode_standard", "sheet.moved_to", "sheet.name_label", "sheet.neotone_and", "sheet.neotone_both_extra", "sheet.neotone_builtin", "sheet.neotone_builtin_plain", "sheet.neotone_demo", "sheet.neotone_empty", "sheet.neotone_extra_main", "sheet.neotone_extra_mutant", "sheet.neotone_inner_extra", "sheet.neotone_input_inner", "sheet.neotone_moved", "sheet.neotone_name_hint", "sheet.neotone_name_label", "sheet.neotone_other_ring", "sheet.neotone_pair_help", "sheet.neotone_picked", "sheet.neotone_range", "sheet.neotone_rearrange", "sheet.neotone_ring_main", "sheet.neotone_ring_mutant", "sheet.neotone_swapped", "sheet.neotone_top_extra", "sheet.neotone_unused", "sheet.next", "sheet.next_note", "sheet.next_seat", "sheet.no_free_place", "sheet.no_two_ring", "sheet.not_moved", "sheet.octave_sentence", "sheet.or", "sheet.or.aria", "sheet.order_hint", "sheet.orientation", "sheet.palette", "sheet.palette_n", "sheet.pan_example", "sheet.pan_held", "sheet.parse_hint", "sheet.parse_summary", "sheet.parse_zone", "sheet.pick_bottom_many", "sheet.pick_bottom_many_fine", "sheet.pick_bottom_one", "sheet.pick_bottom_one_fine", "sheet.pick_keys", "sheet.pick_note", "sheet.pick_tap", "sheet.pick_tap_seat", "sheet.place.bottom", "sheet.place.left", "sheet.place.lower_left", "sheet.place.lower_right", "sheet.place.right", "sheet.place.top", "sheet.place.upper_left", "sheet.place.upper_right", "sheet.prev_note", "sheet.prev_seat", "sheet.preview.aria", "sheet.put_down", "sheet.put_down_kept", "sheet.put_down_kept_moves", "sheet.reset_layout", "sheet.rim_follows", "sheet.ring_back", "sheet.ring_bottom", "sheet.ring_inner", "sheet.ring_reset", "sheet.ring_rim", "sheet.save", "sheet.saving", "sheet.seat_is_now", "sheet.seat_renumber", "sheet.seat_stays", "sheet.seats_angles_reset", "sheet.seats_reset", "sheet.stays", "sheet.stays_at", "sheet.swapped", "sheet.tablist", "sheet.tonefield_label", "sheet.too_close_so", "sheet.too_close_steps", "sheet.top", "sheet.zone_bottom", "sheet.zone_inner", "sheet.zone_top"];
    assert.strictEqual(Object.keys(en).length,contract.keyCount+16-retiredKeys.length+addedKeys.length-legacySheetKeys.length,"frozen base plus the sixteen approved saved-variants messages, less the four retired Amy keys and the eleven dead keys the Editor RC I1 sweep retired (no reference in index.html, src or tools), less the legacy scale sheet keys the Editor RC U2j-2r sweep removed with the sheet, plus panel.explore (menu Resources redesign), header.share (native share), sheet.mirror_keeps_numbers, move.notice / move.failed / the click-to-move banner keys (domain move handoff), the four panel.pdf_* tier-menu keys, the editor tab, menu and zone-count keys (Editor RC W3 P1), the sixteen backup.* keys (Safari storage lane B) and the Neotone keys (Neotone lane U2)");
    for(const key of savedKeys)assert.strictEqual(typeof en[key],"string",key+" is a required new scalar message");
    for(const key of ["about.back","about.back.aria"])for(const l of ALL)assert.strictEqual(typeof JSON.parse(fs.readFileSync(path.join(dir,l+".json"),"utf8"))[key],"string",l+" keeps "+key+" (dev uses it)");
    assert.strictEqual(typeof en["about.back"],"string");
    const baseKeys=Object.keys(en).filter(key=>!savedKeys.includes(key)&&!addedKeys.includes(key)).concat(retiredKeys,legacySheetKeys.filter(key=>!addedKeys.includes(key)&&!savedKeys.includes(key)));
    assert.strictEqual(require("node:crypto").createHash("sha256")
      .update(JSON.stringify(baseKeys.sort())).digest("hex"),contract.sortedKeySha256,"all frozen baseline key identities remain unchanged");
    assert.deepStrictEqual(Object.keys(en).filter((k) => isPlural(en[k])).sort(),
      [...contract.pluralKeys.filter((k) => !legacySheetKeys.includes(k)), ...addedPluralKeys, ...neotoneKeys.filter((k) => isPlural(en[k]))].sort(), "frozen plural keys plus the handoff notice and the Neotone plurals");
    assert.deepStrictEqual(Object.keys(contract.pluralFormsByLocale).sort(), [...locales].sort());
    // This is the single independently reviewed baseline exception. Adding an
    // exception to make a changed table pass requires a new semantic decision.
    assert.deepStrictEqual(contract.placeholderCountExceptions, { de: { "compose.DOUBLE_B": { L: 2 } } });
    assert.deepStrictEqual(fs.readdirSync(dir).filter((x) => x.endsWith(".json")).sort(),
      locales.map((l) => l + ".json").sort(), "the frozen eight locale files");
    for (const locale of locales) {
      const table = JSON.parse(fs.readFileSync(path.join(dir, locale + ".json"), "utf8"));
      assert.deepStrictEqual(Object.keys(table).sort(), Object.keys(en).sort(), locale + ": key parity with en");
      for (const k of Object.keys(en)) {
        const plural = contract.pluralKeys.includes(k) || addedPluralKeys.includes(k) || (neotoneKeys.includes(k) && isPlural(en[k]));
        const label = locale + " " + k;
        assert.strictEqual(isPlural(table[k]), plural, label + ": scalar/plural type");
        if (plural) {
          assert.deepStrictEqual(Object.keys(table[k]).sort(), [...contract.pluralFormsByLocale[locale]].sort(), label + ": named plural forms");
          assert.ok(Object.hasOwn(table[k], "other"), label + ": other form required");
        }
        for (const form of plural ? contract.pluralFormsByLocale[locale] : [null]) {
          const value = plural ? table[k][form] : table[k];
          const english = plural ? (Object.hasOwn(en[k], form) ? en[k][form] : en[k].other) : en[k];
          const where = label + (form ? "." + form : "");
          assert.strictEqual(typeof value, "string", where + ": string leaf");
          assert.strictEqual(typeof english, "string", where + ": English reference leaf");
          const expectedCounts = { ...counts(english), ...(contract.placeholderCountExceptions[locale]?.[k] || {}) };
          assert.deepStrictEqual(Object.keys(counts(value)).sort(), Object.keys(counts(english)).sort(), where + ": per-form placeholder identities");
          assert.deepStrictEqual(counts(value), expectedCounts, where + ": per-form placeholder multiplicity");
          const fixedEdges = plural ? contract.nonemptyEdgeWhitespace[k]?.[form] : contract.nonemptyEdgeWhitespace[k];
          assert.deepStrictEqual(edges(value), fixedEdges || ["", ""], where + ": exact baseline edge whitespace");
        }
      }
    }
  });

  test("I18N: no table value says deck", async () => {
    const dir = path.join(ROOT, "data", "i18n");
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
      const table = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      for (const [k, v] of Object.entries(table)) {
        assert.ok(!/deck/i.test(JSON.stringify(v)), f + " " + k + " says deck");
      }
    }
  });




  test("I18N: the WHICH CHORD IS THIS? subtitle carries the UI language, not an English island", async () => {
    const en = readEn();
    const app = bootLang(["de"], ["de"]);
    const wrapped = wrapOne(en["card.which_chord"]);
    let seen = 0;
    for (const mode of ["A", "B", "S"]) {
      app.run(`setMode("${mode}")`);
      const f = app.faces();
      const at = f.indexOf(wrapped);
      if (at < 0) continue;
      seen++;
      const open = f.lastIndexOf("<", at);
      const tag = f.slice(open, f.indexOf(">", open) + 1);
      assert.ok(!/lang="en"/.test(tag), mode + ": subtitle tag " + tag);
    }
    assert.ok(seen > 0, "the subtitle shows in some mode");
  });

  const langPanelStops = (app) => {
    const stubIds = [...pmPanel().matchAll(/<(?:a|button)\b[^>]*id="(res-[\w-]+|about-open)"/g)].map((m) => m[1]);
    app.run(`settingsPanel.querySelectorAll = (sel) => /res-/.test(sel) ? ${JSON.stringify(stubIds)}.map((id) => ({ id, disabled: false, getClientRects: () => [{}] })) : []`);
    app.run("openPanel()");
    return app.get("panelStops().map((e) => e.id)");
  };

  test("I18N: the Language group follows Resources, is named by its heading, and #lang-select is the last panel stop", async () => {
    const panel = pmPanel();
    const resources = panel.indexOf('<h3 class="panel-heading">Resources</h3>');
    const lang = panel.indexOf('<div class="panel-group"><h3 class="panel-heading" id="panel-lang-heading">Language</h3><select id="lang-select" aria-labelledby="panel-lang-heading"></select></div>');
    assert.ok(resources > 0 && lang > panel.indexOf('id="about-open"'), "the Language group does not follow the Resources group");
    assert.strictEqual(panel.slice(lang).includes("<h3"), true);
    assert.strictEqual(panel.slice(lang + 10).includes('class="panel-group"'), false, "a group follows Language");
    const ids = langPanelStops(boot());
    assert.strictEqual(ids[ids.length - 1], "lang-select", "lang-select is not the last panel stop");
    assert.strictEqual(ids[ids.length - 2], "about-open", "ABOUT does not lead Language");
  });

  test("I18N: the options are AUTOMATIC (<detected endonym>) then one endonym per present table, in the fixed order", async () => {
    const texts = (app) => app.els["lang-select"].children.map((o) => [o.value, o.textContent]);
    const endonyms = { en: "ENGLISH", de: "DEUTSCH", fr: "FRANÇAIS", it: "ITALIANO", es: "ESPAÑOL", ja: "日本語", "zh-Hant": "繁體中文", "zh-Hans": "简体中文" };
    const present = Object.keys(endonyms).filter((code) => fs.existsSync(path.join(__dirname, "..", "data", "i18n", code + ".json")));
    const listed = (codes) => codes.map((code) => [code, endonyms[code]]);
    assert.deepStrictEqual(texts(boot({ languages: ["en-US"] })), [["auto", "AUTOMATIC (ENGLISH)"], ...listed(present)]);
    const app = bootLang(["zh-Hans", "fr", "de"], ["fr-CA", "en"]);
    const en = readEn();
    assert.deepStrictEqual(texts(app), [
      ["auto", wrapOne(en["sel.auto"]).replace("{lang}", "FRANÇAIS")], ...listed(["en", "de", "fr", "zh-Hans"])]);
    assert.strictEqual(app.els["lang-select"].value, "auto");
    const stored = bootLang(["de"], ["en"], { storage: { hpfc: JSON.stringify({ lang: "de" }) } });
    assert.strictEqual(stored.els["lang-select"].value, "de");
  });

  test("I18N: a pick repaints in place: focus stays on #lang-select, the panel's scrollTop is unchanged, no element is replaced", async () => {
    const app = bootLang(["de"], ["en"]);
    const select = app.els["lang-select"];
    const options = select.children.slice();
    app.run("openPanel()");
    select.focus();
    app.els["settings-panel"].scrollTop = 123;
    select.value = "de";
    select.dispatchEvent({ type: "change" });
    assert.strictEqual(app.get("document.documentElement.lang"), "de");
    assert.strictEqual(app.els["lang-select"], select, "the select was replaced");
    assert.deepStrictEqual(select.children, options, "an option was replaced");
    assert.strictEqual(select.children[0].textContent, wrapOne("AUTOMATIC ({lang})").replace("{lang}", "ENGLISH"));
    assert.strictEqual(app.els["settings-panel"].scrollTop, 123, "the panel scrolled");
    assert.strictEqual(app.get("panelOpen"), true, "a pick closed the panel");
    assert.strictEqual(JSON.parse(app.store.hpfc).lang, "de");
    select.value = "auto";
    select.dispatchEvent({ type: "change" });
    assert.strictEqual(app.get("document.documentElement.lang"), "en");
    assert.strictEqual("lang" in JSON.parse(app.store.hpfc), false, "AUTOMATIC left a stored language");
  });

  test("I18N: Escape on the focused select with its picker closed closes the panel", async () => {
    const app = boot();
    app.run("openPanel()");
    app.els["lang-select"].focus();
    assert.strictEqual(app.get("panelOpen"), true);
    assert.strictEqual(app.keydown("Escape"), true);
    assert.strictEqual(app.get("panelOpen"), false);
  });

});

/** The states the English-DOM oracle visits, shared with tools that regenerate its fixture. */
async function I18N_STATES(snap, html) {
  const opts = html === undefined ? { languages: ["en-US", "en"] } : { html, languages: ["en-US", "en"] };
  const states = {};
  let app = boot(opts);
  states.home = snap(app);
  app.run("openPanel()");
  states.panel = snap(app);
  app.run("closePanel()");
  openSheet(app);
  states.addEmpty = snap(app);
  app.type("(D3) A3 Bb3 C4 D4 E4 F4 G4 A4");
  states.addTyped = snap(app);
  app.click(app.els["scale-tab-layout"]);
  app.els["scale-fine-toggle"].click();
  states.layout = snap(app);
  app.click(app.els["scale-tab-scale"]);
  app.type("(D3) A3 Qq");
  await generateClick(app);
  states.refused = snap(app);
  app = boot(opts);
  openEdit(app, await makeCustom(app));
  states.edit = snap(app);
  return states;
}

/* ---- Lane SO-C: bottom seat numbers belong to ring positions ----
 * Pygmy under anchor "between": U1 C3 @300, U2 Db3 @240, U3 Eb3 @0, U4 Bb3 @180,
 * U5 Db4 @60, U6 Ab5 @120. Swapping Db3 and Db4 leaves U2 at 240 and U5 at 60. */
describe("SO: bottom seat numbers stay on their seats", () => {
  const SO_ANGLES = { bottom: [null, 60, null, null, 240, null] };
  const soOpen = async () => {
    const app = await dgOpen({}, DR1_PYGMY_MAKER);
    app.els["scale-anchor-between"].click();
    return app;
  };
  const soAngles = (app) => app.get("JSON.stringify(layoutAngles)");
  const soLabel = (app, id) => app.get(`lastSolved.fields[${id}][5]`);
  const soAngle = (app, id) => app.get(`lastSolved.fields[${id}][4]`);
  const soLabels = (app) => [101, 102, 103, 104, 105, 106].map((id) => soLabel(app, id));
  const soFlash = (app) => (JSON.parse(app.get("JSON.stringify(panFlash)")) || []).slice().sort();
  const soSwapped = (app) => {
    app.run("layoutAngles = { bottom: [300, null, null, null, null, null] }; resyncSheet(true)");
    DG.mouseDrag(app, "Db3", "Db4");
    return app;
  };
  const soHit = (app, prefix) => app.hits().map((h) => h.getAttribute("aria-label")).find((l) => l.startsWith(prefix));

  test("SO: generateDeck under angles alone gives the seat numbers: Bbm U4-U2-5, Db U2-5-7, Db LOW VOICING U5-5-2", async () => {
    const app = boot();
    const made = app.generate(DR1_PYGMY_MAKER, { anchor: "between", angles: SO_ANGLES });
    assert.strictEqual(made.ok, true, made.reason);
    const deck = savedViews(app)[made.instanceId];
    const line = (ch) => ch.fields.map((f) => deck.fields[f][5]).join("-");
    const named = (n) => deck.chords.filter((ch) => ch.main + (ch.sup || "") === n).map(line);
    assert.deepStrictEqual(named("Bbm"), ["U4-U2-5"]);
    assert.deepStrictEqual(named("Db"), ["U2-5-7", "U5-5-2"]);
  });








});

/* ---- the swipe cue element: print and DOM position (the sheet swipe itself is gone; editor swipe is covered in editor_e2e) ---- */
describe("SWA: swipe edge cue", () => {
  const html = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "index.html"), "utf8");
  test("SWA: the print block hides #scale-swipe-cue, and it is a direct child of #scale-sheet", async () => {
    const block = html.slice(html.lastIndexOf("@media print{"));
    const hidden = [...block.matchAll(/([^{}]+)\{([^{}]+)\}/g)].filter(([, , d]) => /\bdisplay\s*:\s*none\b/.test(d));
    assert.ok(hidden.some(([, s]) => s.split(",").map((x) => x.trim()).includes("#scale-swipe-cue")));
    const stripped = html.replace(/<!--[\s\S]*?-->/g, "");
    const from = stripped.indexOf('<div id="scale-sheet"'), at = stripped.indexOf('<div id="scale-swipe-cue"');
    assert.ok(from > 0 && at > from);
    let depth = 0;
    for (const t of stripped.slice(from, at).matchAll(/<div\b|<\/div>/g)) depth += t[0] === "</div>" ? -1 : 1;
    assert.strictEqual(depth, 1, "only #scale-sheet is open around the cue");
  });
});
/* SHARE-CUSTOMIZATION-HOTFIX: eight observable groups, no helper/app seams.
 * Promise completion is drained independently of DOM mutation. The VM's history
 * has no stack and focus() emits no blur: native ordering/selection is E1/E2. */
describe("SHC asynchronous LINK ownership", () => {
  const PAGE = "https://example.test/index.html?share=public-control";
  // Existing public FPS fixture, frozen before this repair (test above).
  const HASH = "#s=6/uC3_uDb3_uEb3_(F3)_G3_Ab3_uBb3_C4_uDb4_Eb4_F4_G4_Ab4_C5_Eb5_-_F5_G5_uAb5/*F+AEOLIAN+12/between/at-,225,,20,,130/5af123";
  const drain = () => new Promise((resolve) => setImmediate(resolve));
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
  };
  const sink = (app, method = "clipboard") => {
    const calls = [];
    const accept = (payload) => { const d = deferred(); calls.push({ payload, ...d }); return d.promise; };
    if (method === "clipboard") app.sandbox.navigator.clipboard = { writeText: accept };
    else { coarse(app); delete app.sandbox.navigator.clipboard; app.sandbox.navigator.share = accept; }
    return calls;
  };
  const copy = async (app, calls) => {
    const count = calls.length;
    app.els["share-copy"].click();
    await drain();
    assert.strictEqual(calls.length, count + 1, "LINK must reach its intercepted API exactly once");
    return calls[count];
  };
  const settle = async (call, success = false) => { call[success ? "resolve" : "reject"](success ? undefined : new Error("controlled denial")); await drain(); };
  const hidden = (app, why) => assert.strictEqual(app.els["share-url"].hidden, true, why);
  const fresh = () => boot({ href: PAGE + HASH });
  const leaveSheet = (app, href) => { app.els["scale-back"].click(); app.location.href = href; app.popstate(); };
  const live = (app) => app.announcer().textContent;
  const nudgeSave = async (app) => {
    // Click the already-selected chip: openEdit() would select first and could
    // conceal a missing Edit-entry cancellation hook.
    app.clickChip(app.currentDeck().name);
    app.click(app.els["scale-tab-layout"]);
    app.els["scale-fine-toggle"].click();
    d2Tap(app, "C3");
    app.els["scale-angle-next"].click();
    await generateClick(app);
  };

  test("SHC U1: latest LINK owns fallback in both completion orders and at identical URLs", async () => {
    for (const order of [[1, 0], [0, 1]]) {
      const app = boot({ href: PAGE });
      const calls = sink(app);
      let selections = 0;
      app.els["share-url"].select = () => { selections++; };
      const a = await copy(app, calls);
      app.clickChip("D AMARA 10");
      const b = await copy(app, calls);
      assert.deepStrictEqual(calls.map((c) => c.payload), [PAGE + "#deck=d-kurd-10", PAGE + "#deck=d-amara-10"]);
      await settle(calls[order[0]]);
      if (order[0] === 0) hidden(app, "retired A must not reveal before current B settles");
      await settle(calls[order[1]]);
      assert.strictEqual(app.els["share-url"].value, b.payload, "old A must not overwrite B's manual URL");
      assert.strictEqual(app.activeId(), "share-url");
      assert.strictEqual(selections, 1, "only B may select the manual URL");
      assert.strictEqual(live(app), "SELECT THE LINK AND COPY IT");
      assert.notStrictEqual(a.payload, b.payload);
    }
    const app = boot({ href: PAGE });
    const calls = sink(app);
    const a = await copy(app, calls), b = await copy(app, calls);
    assert.strictEqual(a.payload, b.payload);
    await settle(b, true); app.flushTimers();
    await settle(a);
    hidden(app, "same-URL older rejection must not revive fallback after B succeeds");
    assert.strictEqual(live(app), "LINK COPIED");
  });


  test("SHC U2: reselecting the current scale, or A to B to A, retires the old LINK", async () => {
    const app = fresh(), calls = sink(app), id = app.get("selection.id");
    for (const select of [() => app.select(id), () => { app.clickChip("D AMARA 10"); app.select(id); }]) {
      const old = await copy(app, calls);
      select();
      await settle(old);
      hidden(app, "selection must retire the old LINK and A to B to A must not revive ownership");
    }
  });

  test("SHC U3: Add Edit About and mobile settings retire LINK through open and cancel", async () => {
    for (const modal of ["add", "edit", "about", "panel"]) for (const success of [false, true]) {
      const app = fresh(), calls = sink(app), pre = app.location.href;
      let shared = 0;
      app.sandbox.navigator.share = async () => { shared++; };
      app.run("settingsPanel.querySelectorAll = () => []");
      const old = await copy(app, calls);
      if (modal === "add") openSheet(app);
      if (modal === "edit") app.clickChip(app.currentDeck().name);
      if (modal === "about") app.run("openAbout()");
      if (modal === "panel") { app.run("openPanel()"); app.els["settings-trigger"].focus(); }
      const focused = app.activeId();
      const before = live(app);
      await settle(old, success); app.flushTimers();
      hidden(app, modal + " must suppress old fallback");
      assert.strictEqual(app.activeId(), focused, modal + " focus must survive settlement");
      assert.strictEqual(live(app), before, modal + " notice must survive settlement");
      assert.strictEqual(shared, 0, modal + " must not start native fallback");
      if (modal === "add" || modal === "edit") leaveSheet(app, pre);
      if (modal === "about") { app.run("closeAbout()"); app.location.href = pre; app.popstate(); }
      if (modal === "panel") app.run("closePanel()");
      await drain(); app.flushTimers();
      hidden(app, "open→cancel cannot revive " + modal + " ownership");
    }
    const app = boot({ href: PAGE }), calls = sink(app);
    app.run("desktopMQ.matches = true; settingsPanel.querySelectorAll = () => []");
    const current = await copy(app, calls);
    app.run("openPanel()");
    await settle(current);
    assert.strictEqual(app.els["share-url"].hidden, false, "desktop nonmodal settings preserve current LINK");
  });

  test("SHC U4: stale success and deferred ticks preserve newer and identical-text notices", async () => {
    for (const notice of ["Unrelated notice", "LINK COPIED", ""]) {
      const app = boot(), calls = sink(app);
      app.run("say(" + JSON.stringify(notice) + ", 'warn')");
      const old = await copy(app, calls);
      // Repeating the same text is a new notice, including empty text (ABA).
      app.run("say(" + JSON.stringify(notice) + ", 'warn')");
      await settle(old, true);
      assert.strictEqual(live(app), notice, "old success must not clear an intervening notice");
      app.flushTimers();
      assert.strictEqual(live(app), notice, "old tick must not replace an identical-text notice");
    }
    for (const retire of ["new", "context", "notice"]) {
      const app = boot(), calls = sink(app), old = await copy(app, calls);
      await settle(old, true); // queues success tick without running virtual timers
      if (retire === "new") await copy(app, calls);
      if (retire === "context") app.select(app.get("selection.id"));
      if (retire === "notice") app.run("say('', 'warn')");
      app.flushTimers();
      assert.strictEqual(live(app), "", retire + " must retire the old deferred tick");
    }
    const app = boot(), calls = sink(app);
    for (let i = 0; i < 2; i++) {
      const current = await copy(app, calls);
      await settle(current, true);
      assert.strictEqual(live(app), "", "current repeated success clears before its tick");
      app.flushTimers(); assert.strictEqual(live(app), "LINK COPIED");
    }
    const old = await copy(app, calls), current = await copy(app, calls);
    await settle(current); const warning = live(app);
    await settle(old, true); app.flushTimers();
    assert.strictEqual(live(app), warning, "old success cannot clear current fallback's notice");
  });

  test("SHC U5: native branches keep captured URLs and never start fallback after retirement", async () => {
    for (const outcome of ["success", "failure", "abort"]) {
      const app = boot({ href: PAGE }), calls = sink(app, "share");
      const call = await copy(app, calls);
      assert.deepStrictEqual(plain(call.payload), { url: PAGE + "#deck=d-kurd-10" });
      if (outcome === "abort") { const e = new Error("cancel"); e.name = "AbortError"; call.reject(e); await drain(); }
      else await settle(call, outcome === "success");
      app.flushTimers();
      if (outcome === "failure") assert.strictEqual(app.els["share-url"].value, call.payload.url);
      else { hidden(app); assert.strictEqual(live(app), outcome === "success" ? "LINK SHARED" : ""); }
    }
    const app = boot({ href: PAGE }), calls = sink(app, "share");
    const written = [];
    app.sandbox.navigator.clipboard = { writeText: async (u) => { written.push(u); } };
    const call = await copy(app, calls);
    await settle(call); app.flushTimers();
    assert.deepStrictEqual(plain(written), [call.payload.url], "share failure uses the same captured URL on the clipboard");
    assert.strictEqual(live(app), "LINK COPIED");
    const late = boot(), lateCalls = sink(late, "share");
    let invoked = 0;
    const lateCall = await copy(late, lateCalls);
    Object.defineProperty(late.sandbox.navigator, "clipboard", { configurable: true, get() {
      late.select(late.get("selection.id")); return { writeText: async () => { invoked++; } };
    } });
    await settle(lateCall);
    assert.strictEqual(invoked, 0, "retirement before the clipboard fallback must suppress it");
    for (const success of [false, true]) {
      const active = boot(), nativeCalls = sink(active, "share"), pending = await copy(active, nativeCalls);
      active.select(active.get("selection.id"));
      await settle(pending, success); active.flushTimers();
      hidden(active, "an already-started native operation must finish without stale UI");
      assert.strictEqual(live(active), "");
    }
    // This test-local prelude records actual registrations; the shared stub has
    // no window.dispatchEvent. It models only event delivery, never OS UI.
    const blurHtml = indexSource().replace("<head>", `<head><script>
      globalThis.__shcBlur = [];
      const __shcAdd = window.addEventListener;
      window.addEventListener = (type, fn, ...rest) => {
        if (type === "blur") __shcBlur.push(fn);
        return __shcAdd(type, fn, ...rest);
      };
    </script>`);
    const blurred = boot({ html: blurHtml }), blurCalls = sink(blurred), pending = await copy(blurred, blurCalls);
    blurred.run("__shcBlur.forEach(fn => fn({type:'blur'}))");
    blurred.els["share-copy"].blur();
    await settle(pending, true); blurred.flushTimers();
    assert.strictEqual(live(blurred), "LINK COPIED", "window/permission blur alone must preserve completion");
  });

  test("SHC U6: blur Escape and panel dismissal stay closed and a new LINK still works", async () => {
    for (const dismissal of ["blur", "escape", "panel"]) {
      const app = boot(), calls = sink(app);
      app.run("settingsPanel.querySelectorAll = () => []");
      const old = await copy(app, calls), current = await copy(app, calls);
      await settle(current);
      assert.strictEqual(app.els["share-url"].hidden, false);
      if (dismissal === "blur") app.els["share-url"].dispatchEvent({ type: "blur" });
      if (dismissal === "escape") {
        app.press(app.els["share-url"], "Escape");
        assert.strictEqual(app.activeId(), "share-copy", "Escape returns focus to LINK");
      }
      if (dismissal === "panel") { app.run("desktopMQ.matches = true; openPanel(); closePanel()"); }
      const focused = app.activeId(), before = live(app);
      await settle(old); app.flushTimers();
      hidden(app, dismissal + " must permanently dismiss old callbacks");
      assert.strictEqual(app.activeId(), focused);
      assert.strictEqual(live(app), before);
      await settle(await copy(app, calls));
      assert.strictEqual(app.els["share-url"].hidden, false, "new LINK remains usable after " + dismissal);
    }
  });


  test("SHC U7: a Back or Forward pop retires the old LINK, even when the route comes back", async () => {
    const app = fresh(), calls = sink(app), home = app.location.href;
    const old = await copy(app, calls);
    app.location.href = PAGE;
    app.popstate();
    app.location.href = home;
    app.popstate();
    await settle(old);
    hidden(app, "a pop away and back must not revive the old LINK request");
  });

  test("SHC U8: hidden and refused LINK consume stale UI without replay and analytics stay nonsecret", async () => {
    for (const success of [false, true]) {
      const app = fresh(), calls = sink(app), pending = await copy(app, calls);
      app.sandbox.document.hidden = true;
      app.sandbox.document.dispatchEvent({ type: "visibilitychange" });
      const focused = app.activeId(), before = live(app);
      await settle(pending, success); app.flushTimers();
      hidden(app, "hidden document must never reveal manual fallback");
      assert.strictEqual(app.activeId(), focused, "hidden completion cannot steal focus");
      assert.strictEqual(live(app), before);
      app.sandbox.document.hidden = false;
      app.sandbox.document.dispatchEvent({ type: "visibilitychange" });
      await drain(); app.flushTimers(); hidden(app, "returning visible must not replay completion");
      await settle(await copy(app, calls));
      assert.strictEqual(app.els["share-url"].hidden, false, "a fresh visible LINK works");
    }
    const app = fresh(), calls = sink(app), pending = await copy(app, calls);
    app.run("globalThis.__shcEncode = HPE.share.encode; HPE.share.encode = () => ({ok:false,code:'OVER',reason:'Too big to share.'}); syncRoute()");
    assert.strictEqual(app.els["share-copy"].disabled, true);
    const refusal = live(app);
    await settle(pending); app.flushTimers();
    hidden(app, "refused LINK cannot reveal an earlier payload");
    assert.strictEqual(live(app), refusal);
    app.run("HPE.share.encode = globalThis.__shcEncode; syncRoute()");
    assert.strictEqual(app.els["share-copy"].disabled, false);
    await settle(await copy(app, calls), true); app.flushTimers();
    assert.strictEqual(live(app), "LINK COPIED");
    const ga = boot({ html: withGaId("G-TEST123456"), webdriver: false, href: PAGE + HASH });
    const events = () => plain(Array.from(ga.get("window.dataLayer"))).filter((e) => e[0] === "event" && e[1] === "share_copy").map((e) => e[2]);
    const gaCalls = sink(ga), first = await copy(ga, gaCalls);
    ga.select(ga.get("selection.id")); await settle(first, true); ga.flushTimers();
    delete ga.sandbox.navigator.clipboard; delete ga.sandbox.navigator.share;
    ga.els["share-copy"].click(); await drain();
    coarse(ga);
    ga.sandbox.navigator.share = async () => {};
    ga.els["share-copy"].click(); await drain(); ga.flushTimers();
    assert.deepStrictEqual(events(), [
      { deck_kind: "custom", method: "clipboard" },
      { deck_kind: "custom", method: "select" },
      { deck_kind: "custom", method: "share" },
    ], "analytics payload allowlist excludes URL, scale name and identity");
  });
});

/* SAVED-SCALE-VARIANTS — independent literal fixtures and approved schema1.
 * Existing policy oracles remain above until U's reviewed adapter handoff. These
 * additions do not replace them or lower floors. Backend cases first prove the
 * selected readable fixture is rendered; baseline RED is an observable ignored
 * collection/overwrite/legacy-write assertion, never a missing proposed API.
 */
{
  const SV = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/saved_variants_v1.json"), "utf8"));
  const SV_KEY = "hpfc.saved-scales.v1", SV_LOCK = "handpan-cards:saved-scales:v1";
  const { createOrigin } = require("./helpers/sandbox.js");
  const copy = v => JSON.parse(JSON.stringify(v));
  const iid = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  function cryptoFixture(sequence = []) {
    let draws = 0;
    return { get draws() { return draws; }, randomUUID() { return sequence[draws++] || iid(1000 + draws); },
      getRandomValues(a) { for (let i = 0; i < a.length; i++) a[i] = (draws + i + 17) & 255; draws++; return a; } };
  }
  function envelope(records, extra = {}) {
    return { schema: 1, collectionId: SV.ids.collectionA, revision: 1, slotStateRevision: 0,
      entries: records.map((record, i) => ({ instanceId: iid(i + 1), revision: 1, displayOrdinal: i + 1, record: copy(record) })),
      usedInstanceIds: records.map((_, i) => iid(i + 1)), nextDisplayOrdinal: records.length + 1,
      preferredSelection: records.length ? { kind: "saved", id: iid(1) } : { kind: "builtin", id: "kurd" },
      slots: {}, hidden: [], migration: { sourceKey: null, raw: { hpfc: null, "hpfc.scales": null, "hpfc.scales.v3": null }, instanceIds: [] },
      ...copy(extra) };
  }
  async function load(opts = {}) {
    const origin = opts.origin || createOrigin();
    const crypto = opts.crypto || cryptoFixture();
    if(Object.prototype.hasOwnProperty.call(opts,"idbRaw")) {
      await idbRecord(idbFixtureRealm(origin,opts.storage),{write:true,value:opts.idbRaw});
    }
    const app = boot({ origin, indexedDB:true, broadcastChannel:true, locks:true, crypto, abortController:true, isSecureContext:true, ...opts });
    if(opts.idbFault) app.idb.fault(opts.idbFault.operation,opts.idbFault.error,{once:true});
    await app.waitFor("typeof booted !== 'undefined' && booted === true", { timeout: 2000 });
    app.fixtureOrigin=origin;observeSavedOperations(app);
    return { app, origin, crypto };
  }
  const snapshot = app => {
    const raw = savedRaw(app);
    assert.strictEqual(typeof raw, "string", "an acknowledged collection must have one serialized envelope");
    const e = JSON.parse(raw);
    assert.strictEqual(e.schema, 1, "the frozen collection schema is 1");
    return e;
  };
  const names = app => chipRow(app).map(c => c.label);
  const notices = app => [app.announcer()?.textContent, app.els["scale-msg"]?.textContent,
    app.els["scale-refusal"]?.textContent, app.els["saved-status"]?.textContent].filter(Boolean).join(" ");
  async function seeded(records, extra = {}, opts = {}) {
    const e = envelope(records, extra);
    const ctx = await idbSeeded(records, extra, opts);
    const wanted = e.entries.find(x => x.instanceId === e.preferredSelection.id);
    if (wanted) assert.strictEqual(ctx.app.currentDeck().name, wanted.record.o.name,
      "a readable saved instance selected in the committed collection must render, rather than silently falling back to a preset");
    return { ...ctx, initial: e };
  }
  async function imported(app, record) {
    const encoded = plain(app.get(`(() => { const r = ${JSON.stringify(record)};
      const s = HPE.core.parseSeed(r.s); if (!s.ok) return s;
      return HPE.share.encode({ fields:s.value.fields, options:r.o || {} }); })()`));
    assert.strictEqual(encoded.ok, true, "public fixture share must encode: " + encoded.reason);
    return app.getAsync(`openShare(${JSON.stringify(encoded.value)})`);
  }
  // runGenerate is the frozen Promise-returning app entrypoint. DOM click
  // dispatch never promises to return asynchronous listener completion.
  async function submit(app) { return app.getAsync("runGenerate()"); }
  function editSelected(app) {
    const selected = app.els.decks.children.find(c => c.classList.contains("on"));
    assert.ok(selected, "selected instance has a chip"); selected.onclick();
    assert.strictEqual(app.sheetOpen(), true, "selected chip opens Edit");
  }
  async function clickAt(app, index) {
    const chip = app.els.decks.children[index]; assert.ok(chip, "literal expected chip index exists");
    await chip.onclick();
  }
  function rename(app, name) {
    app.els["scale-name"].value = name;
    app.els["scale-name"].dispatchEvent({ type: "input" });
  }
  async function command(app, cmd, record, options = {}) {
    // Build exactly once outside commit, in the app realm. No second equality
    // implementation or production-derived expected snapshot lives here.
    return app.getAsync(`(async () => { const cmd = ${JSON.stringify(cmd)};
      ${record ? `const r = ${JSON.stringify(record)}; const b = buildGenerated(r.s, r.o || {});
        if (!b.ok) return b; cmd.candidate = { record:scaleRecord(seedOf(b.value)), deck:b.value };` : ""}
      return commitSaved(cmd, ${options.signal ? "{signal:globalThis.__svSignal}" : "{}"}); })()`);
  }
  /* Transactional-storage acceptance addition, frozen before adapter changes.
   * IDB1: request success followed by transaction abort must not acknowledge.
   * IDB2: readable authority outranks stale LS in a no-lock session; no promotion.
   * IDB3: present undefined/null/object is protected, not an absent record.
   * IDB4: an own backendSource property is a collision on initial LS import.
   * IDB5: an in-flight snapshot must not swallow a later notification hint.
   * Intended faults: early request ACK; LS-as-authority; get(undefined)-as-absence;
   * overwritten provenance; coalescing that drops a trailing read. These groups
   * supplement all926 original registrations; no product oracle is weakened.
   */
  async function idbSeeded(records, extra = {}, opts = {}) {
    const origin = opts.origin || createOrigin(), initial = envelope(records, extra);
    const fixture = idbFixtureRealm(origin, opts.storage);
    await idbRecord(fixture, {write:true, value:JSON.stringify(initial)});
    const ctx = await load({origin, indexedDB:true, broadcastChannel:true, ...opts});
    return {...ctx, fixture, initial};
  }
  const slotProof = e => ({ slotStateRevision: e.slotStateRevision, slots: copy(e.slots), hidden: copy(e.hidden) });
  const affected = e => ({ ...slotProof(e), replacements: e.entries.filter(x =>
    x.record && x.record.v === 4 && typeof x.record.s === "string" &&
    ["kurd", "amara10", "amara", "hijaz", "pygmy"].includes(x.record.o?.replaces) && !x.record.s.includes("not-a-scale"))
    .map(x => ({ id:x.instanceId, revision:x.revision })) });

  test("SV1 U1: differently named same-inventory imports coexist in either order", async () => {
    for (const pair of [[SV.portableRecords.amaraA, SV.portableRecords.amaraB], [SV.portableRecords.amaraB, SV.portableRecords.amaraA]]) {
      const { app } = await load();
      const a = await imported(app, pair[0]), b = await imported(app, pair[1]);
      assert.strictEqual(a.ok, true); assert.strictEqual(b.ok, true);
      assert.deepStrictEqual(names(app).filter(n => n.startsWith("PUBLIC PAN")).sort(), ["PUBLIC PAN A", "PUBLIC PAN B"],
        "same notes must not overwrite the other named instrument");
      const before = snapshot(app);
      assert.strictEqual(before.entries.length, 2);
      assert.strictEqual(new Set(before.entries.map(x => x.instanceId)).size, 2);
      assert.strictEqual(a.value.id, "custom:977311b5"); assert.strictEqual(b.value.id, a.value.id);
      await imported(app, pair[1]);
      assert.deepStrictEqual(snapshot(app).entries, before.entries, "unchanged import reuses rather than cloning");
      assert.strictEqual(app.store["hpfc.scales.v3"], undefined, "new imports never write the legacy array");
      assert.ok(!JSON.stringify(JSON.parse(app.store.hpfc || "{}")).includes(before.entries[0].instanceId));
    }
  });

  test("SV1 U2: layout-only variants coexist and exact portable repeats reuse the selected match", async () => {
    const { app } = await load();
    await imported(app, SV.portableRecords.pygmyLayoutA); await imported(app, SV.portableRecords.pygmyLayoutB);
    assert.strictEqual(names(app).length, 7, "two layouts of the same named inventory need two saved chips");
    const before = snapshot(app);
    assert.strictEqual(before.entries.length, 2);
    assert.deepStrictEqual(before.entries.map(x => x.record.o.angles.bottom), [[null,225,null,20,null,130], [295,225,null,20,null,130]]);
    await imported(app, SV.portableRecords.pygmyLayoutA);
    assert.strictEqual(snapshot(app).preferredSelection.id, before.entries[0].instanceId);
    assert.deepStrictEqual(snapshot(app).entries, before.entries);
    const identical = await seeded([SV.portableRecords.amaraA, SV.portableRecords.amaraA], { preferredSelection:{kind:"saved",id:iid(2)} });
    await imported(identical.app, SV.portableRecords.amaraA);
    assert.strictEqual(snapshot(identical.app).preferredSelection.id, iid(2), "selected exact match outranks earlier equal sibling");
    assert.strictEqual(snapshot(identical.app).entries.length, 2);
  });

  test("SV1 U3: default normalization preserves explicit name parent and absolute-angle intent", async () => {
    for (const c of SV.portableMeaningCases) {
      const { app } = await load();
      await imported(app, SV.portableRecords[c.left]); await imported(app, SV.portableRecords[c.right]);
      assert.strictEqual(names(app).length, 5 + (c.equivalent ? 1 : 2), c.reason);
      assert.strictEqual(snapshot(app).entries.length, c.equivalent ? 1 : 2, c.reason);
    }
  });

  test("SV2 U1: Edit preserves its instance and position while sibling bytes remain unchanged", async () => {
    const a = { ...copy(SV.portableRecords.amaraA), unknown:{keep:[null,17,"literal"]} };
    a.o.future = { keep:true };
    const { app } = await seeded([a, SV.portableRecords.amaraB]);
    const before = snapshot(app), sibling = JSON.stringify(before.entries[1]);
    editSelected(app); rename(app, "PUBLIC EDITED"); app.type(SV.inventories.other.seed);
    app.els["scale-swatches"].children[4].click(); await submit(app);
    const after = snapshot(app);
    assert.deepStrictEqual(after.entries.map(x => x.instanceId), before.entries.map(x => x.instanceId));
    assert.deepStrictEqual(after.entries.map(x => x.displayOrdinal), [1,2]);
    assert.strictEqual(after.entries[0].revision, 2);
    assert.strictEqual(after.entries[0].record.s, SV.inventories.other.seed);
    assert.strictEqual(after.entries[0].record.o.name, "PUBLIC EDITED");
    assert.deepStrictEqual(after.entries[0].record.unknown, a.unknown);
    assert.deepStrictEqual(after.entries[0].record.o.future, a.o.future);
    assert.strictEqual(JSON.stringify(after.entries[1]), sibling, "editing one instance cannot mutate a sibling");
    const again = await load({origin:app.fixtureOrigin});
    assert.strictEqual(again.app.currentDeck().name, "PUBLIC EDITED");
    assert.deepStrictEqual(snapshot(again.app).entries, after.entries);
  });

  test("SV2 U2: converging Edit keeps both instances across reload", async () => {
    const { app } = await seeded([SV.portableRecords.amaraA, SV.portableRecords.amaraB]);
    const before = snapshot(app);
    editSelected(app); rename(app, "PUBLIC PAN B"); await submit(app);
    const after = snapshot(app);
    assert.strictEqual(after.entries.length, 2, "Edit convergence never deduplicates saved handles");
    assert.deepStrictEqual(after.entries.map(x => x.instanceId), before.entries.map(x => x.instanceId));
    assert.deepStrictEqual(after.entries[1], before.entries[1]);
    const again = await load({origin:app.fixtureOrigin});
    assert.strictEqual(snapshot(again.app).entries.length, 2);
    assert.strictEqual(names(again.app).length, 7);
  });

  test("SV2 U3: distinct inventory cannot overwrite through a colliding engine handle", async () => {
    const { app } = await load();
    await imported(app, SV.portableRecords.amaraA);
    const before = savedRaw(app), beforeLegacy = JSON.stringify(app.store), prior = app.currentDeck();
    // Synthetic hash-collision injection only: these public seeds do not
    // naturally collide. Independent seed text, not a hash, defines meaning.
    app.run(`HPE.core.deckId = () => "custom:977311b5";`);
    const res = await imported(app, {v:4,s:SV.inventories.other.seed,o:{name:"PUBLIC COLLISION"}});
    assert.strictEqual(res.ok, false, "a different-inventory hash collision must be refused, never overwrite the saved instrument");
    assert.strictEqual(res.kind, "inventory-collision");
    assert.strictEqual(savedRaw(app), before);
    assert.strictEqual(JSON.stringify(app.store),beforeLegacy,"collision refusal preserves the complete localStorage snapshot too");
    assert.deepStrictEqual(app.currentDeck(), prior);
  });

  test("SV3 U1: selection Edit and deletion target the chosen instance despite equal names and URLs", async () => {
    const { app } = await seeded([SV.portableRecords.amaraA, SV.portableRecords.amaraA]);
    const before = snapshot(app);
    await clickAt(app, 0); // newest custom is ordinal2; literal contract, not a view-derived oracle
    assert.deepStrictEqual(plain(app.get("selection")), {kind:"saved",id:iid(2)});
    editSelected(app); rename(app, "PUBLIC SECOND"); await submit(app);
    assert.strictEqual(snapshot(app).entries[0].record.o.name, "PUBLIC PAN A");
    assert.strictEqual(snapshot(app).entries[1].record.o.name, "PUBLIC SECOND");
    await clickAt(app, 1); editSelected(app);
    app.els["scale-delete"].click(); app.els["scale-delete"].click();
    await writeBarrier(app);
    await app.waitFor("document.getElementById('scale-sheet').hidden");
    assert.deepStrictEqual(snapshot(app).entries.map(x => x.instanceId), [before.entries[1].instanceId]);
    assert.strictEqual(app.currentDeck().name, "D KURD 10", "deleted selection falls back to the visible default");
  });

  test("SV3 U2: instance selection retires pending LINK UI when the route is identical", async () => {
    const { app } = await seeded([SV.portableRecords.amaraA, SV.portableRecords.amaraA]);
    let reject, calls = 0;
    app.sandbox.navigator.clipboard = { writeText: () => { calls++; return new Promise((_, r) => { reject = r; }); } };
    delete app.sandbox.navigator.share;
    app.els["share-copy"].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(calls, 1);
    const href = app.location.href;
    await clickAt(app, 0);
    assert.strictEqual(app.location.href, href, "two equal portable instances have the same route");
    const focus = app.activeId(), notice = notices(app);
    reject(new Error("controlled denial")); await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(app.els["share-url"].hidden, true, "old completion must not reveal fallback on the newly selected instance");
    assert.strictEqual(app.activeId(), focus); assert.strictEqual(notices(app), notice);
  });

  test("SV4 U1: migration preserves source text row order opaque values and known version meanings", async () => {
    const source = SV.migration.mixedRaw;
    const { app } = await load({ storage:copy(source.sources) });
    for (const [key, raw] of Object.entries(source.sources)) assert.strictEqual(app.store[key], raw, "migration cannot rewrite recovery source " + key);
    const e = snapshot(app);
    assert.deepStrictEqual(e.migration.raw, source.sources);
    assert.strictEqual(e.migration.sourceKey, "hpfc.scales.v3");
    assert.strictEqual(e.entries.length, source.expectedRowCount);
    assert.deepStrictEqual(e.entries.map(x => x.instanceId), e.migration.instanceIds);
    assert.deepStrictEqual(e.entries.map(x => x.displayOrdinal), source.expectedDisplayOrdinals);
    assert.deepStrictEqual(e.usedInstanceIds, e.migration.instanceIds);
    for (const i of source.expectedOpaqueRowIndices) assert.deepStrictEqual(e.entries[i].record, source.expectedInputRows[i], "opaque row " + i);
    for (const i of [1,2,3,4]) assert.deepStrictEqual(e.entries[i].record, source.expectedInputRows[i], "v4 unknown data row " + i);
    assert.strictEqual(e.entries[0].record.v, 4); assert.strictEqual(e.entries[0].record.s, SV.inventories.pygmyInner18.seed);
    assert.strictEqual(e.entries[10].record.v, 4); assert.strictEqual(e.entries[10].record.s, SV.inventories.pygmyRim18.seed);
    const prototype=e.entries[source.prototypeRowIndex];
    assert.deepStrictEqual(prototype.record, source.expectedInputRows[source.prototypeRowIndex], "own __proto__ JSON values remain data, byte-for-value");
    const view=plain(app.get(`savedEntries.get(${JSON.stringify(prototype.instanceId)}).deck`));
    assert.strictEqual(view.name, source.expectedPrototypeMeaning.name, "unknown __proto__ cannot inject a typed name");
    assert.strictEqual(view.options.palette, source.expectedPrototypeMeaning.palette, "unknown __proto__ cannot inject palette");
    assert.strictEqual(view.options.replaces, undefined, "unknown __proto__ cannot acquire slot authority");
    assert.deepStrictEqual(e.slots, source.expectedPrototypeMeaning.slots);
    assert.strictEqual(app.currentDeck().name, "PUBLIC PAN A");
  });

  test("SV4 U2: repeated boot resumes the same committed collection without allocation", async () => {
    const raw = SV.migration.duplicatesRaw.source, crypto = cryptoFixture(), origin = createOrigin();
    const first = await load({ storage:{"hpfc.scales.v3":raw}, crypto, origin });
    assert.strictEqual(first.app.store["hpfc.scales.v3"], raw, "duplicate legacy rows cannot be collapsed during migration");
    const initial = snapshot(first.app), draws = crypto.draws;
    assert.strictEqual(initial.entries.length, 2);
    for (let i = 0; i < 2; i++) {
      const next = await load({ origin, crypto });
      assert.deepStrictEqual(snapshot(next.app), initial, "acknowledged migration cannot be replayed at another boot");
      assert.strictEqual(crypto.draws, draws, "reload must not allocate new identities");
    }
  });

  test("SV4 U3: absent denied corrupt and newer sources are distinct", async () => {
    // Begin with the observable protection warning, not an absent new API.
    const bad = await load({ storage:{"hpfc.scales.v3":"{not-json"} });
    assert.ok(notices(bad.app).length > 0, "a corrupt active source must visibly offer recovery rather than silently pretending there were no saved scales");
    assert.strictEqual(bad.app.get("savedMode"), "protected");
    assert.strictEqual(bad.app.store["hpfc.scales.v3"], "{not-json");
    assert.strictEqual(bad.app.store[SV_KEY], undefined);
    for (const c of SV.migration.invalidWholeSources) {
      const storage = c.raw === null ? {} : {"hpfc.scales.v3":c.raw};
      const { app } = await load({ storage });
      assert.strictEqual(app.get("savedMode"), c.state === "absent" ? "durable" : "protected", c.id);
      if (c.raw !== null) { assert.strictEqual(app.store["hpfc.scales.v3"], c.raw); assert.strictEqual(app.store[SV_KEY], undefined); }
    }
    for (const raw of [SV.migration.newerEnvelopeRaw, SV.migration.corruptEnvelopeRaw]) {
      const { app } = await load({ storage:{[SV_KEY]:raw,"hpfc.scales.v3":JSON.stringify([SV.portableRecords.amaraA])} });
      assert.strictEqual(app.get("savedMode"), "protected"); assert.strictEqual(app.store[SV_KEY], raw);
      assert.ok(!names(app).includes("PUBLIC PAN A"), "protected newer collection never silently substitutes stale legacy content");
    }
    const denied = await load({ storageAccessError:new Error("controlled denied read") });
    assert.strictEqual(denied.app.get("savedMode"), "session"); assert.ok(notices(denied.app).length > 0);
    // Exact UUID strings and lifetime ordinal mappings are structural data,
    // never regex-coercible values or missing/undefined aliases.
    const malformed = [
      ["missing own instance identity", e => { delete e.entries[0].instanceId; e.usedInstanceIds=[]; e.nextDisplayOrdinal=1; }],
      ["array collection UUID", e => { e.collectionId=[SV.ids.collectionA]; }],
      ["collection UUID trailing newline", e => { e.collectionId=SV.ids.collectionA+"\n"; }],
      ["array row/lifetime UUID", e => { e.entries[0].instanceId=[iid(1)]; e.usedInstanceIds=[[iid(1)]]; }],
      ["row/lifetime UUID trailing newline", e => { e.entries[0].instanceId=iid(1)+"\n"; e.usedInstanceIds=[iid(1)+"\n"]; }],
      ["ordinal/history mismatch", e => { e.entries[0].displayOrdinal=2; e.usedInstanceIds=[iid(1),iid(2)]; e.nextDisplayOrdinal=3; }],
      ["array preferred saved UUID", e => { e.preferredSelection.id=[iid(1)]; }],
    ];
    for(const [label,mutate] of malformed) {
      const invalid=envelope([SV.portableRecords.amaraA]);mutate(invalid);
      const raw=JSON.stringify(invalid),ctx=await load({storage:{[SV_KEY]:raw}});
      assert.strictEqual(ctx.app.get("savedMode"),"protected",label+" protects rather than coercing/repairing the collection");
      assert.strictEqual(ctx.app.store[SV_KEY],raw,label+" source bytes remain unchanged");
      assert.strictEqual(ctx.origin.successfulWrites.filter(x=>x.key===SV_KEY).length,0,label+" cannot be normalized into a durable empty store");
    }
    for(const raw of [' { "deck": 7, "mode": "A" }\n',' { "hidden": "bad", "mode": "A" }\n']) {
      const ctx=await seeded([SV.portableRecords.amaraA],{}, {storage:{[SV_KEY]:JSON.stringify(envelope([SV.portableRecords.amaraA])),hpfc:raw}});
      const changed=ctx.app.run('updateSettings(next => { next.mode="B"; })');
      assert.strictEqual(changed,false,"unrelated settings cannot claim to save through malformed relevant recovery metadata");
      assert.strictEqual(ctx.app.store.hpfc,raw,"malformed deck/hidden preference bytes stay exact until explicit recovery");
    }
  });

  test("SV5 U1: no lock or denied storage gives this-tab-only operation without persistent writes", async () => {
    for (const opts of [{locks:false},{locksAccessError:new Error("controlled lock access")},
      {locksRequestError:new Error("controlled lock rejection")},{storageAccessError:new Error("controlled denied storage")}]) {
      const { app, origin } = await load(opts);
      openSheet(app); app.type(SV.inventories.amara9.seed); await submit(app);
      assert.strictEqual(origin.successfulWrites.filter(x => x.key === "hpfc.scales.v3" || x.key === SV_KEY).length, 0,
        "unsupported persistence cannot silently write an unlocked legacy/new saved store");
      assert.strictEqual(app.get("savedMode"), "session");
      assert.deepStrictEqual(app.idb.operations.filter(x=>x.operation==="put"||x.operation==="createObjectStore"),[],"temporary operation does not attempt new-backend writes");
      assert.match(notices(app), /this tab|session|reload|clos/i, "temporary changes must be clearly scoped to this tab");
      assert.strictEqual(app.sheetOpen(), false); assert.match(app.faces(), /<svg /);
      assert.strictEqual(plain(app.get("shareCode(deck())")).ok, true);
    }
  });

  test("SV5 U2: failed durable Save preserves draft and acknowledged winner", async () => {
    for (const failure of ["write", "serialization", "lock"]) {
      const { app } = await seeded([SV.portableRecords.amaraA]);
      const before = savedRaw(app); editSelected(app); rename(app, "UNSAVED DRAFT");
      if (failure === "write") app.idb.fault("put",new Error("controlled quota"),{once:true});
      else if (failure === "lock") app.sandbox.navigator.locks.request = () => Promise.reject(new Error("controlled lock rejected"));
      else app.run(`const __svStringify = JSON.stringify; JSON.stringify = function(v,...args) {
        if (v && v.schema === 1 && Array.isArray(v.entries)) throw new Error("controlled serialization");
        return __svStringify(v,...args); };`);
      await submit(app);
      assert.strictEqual(app.sheetOpen(), true, failure + " cannot close the unsaved draft");
      assert.strictEqual(app.els["scale-name"].value, "UNSAVED DRAFT");
      assert.strictEqual(savedRaw(app), before); assert.strictEqual(app.currentDeck().name, "PUBLIC PAN A");
      assert.strictEqual(app.get("savedMode"), "durable", "mid-session failure cannot silently change backend mode");
      assert.ok(notices(app).length > 0); assert.doesNotMatch(notices(app), /^Saved|^Created|^Updated/);
    }
  });

  test("SV5 U3: successful setItem followed by failed diagnostic readback is committed exactly once", async () => {
    // Historical title retained; the acknowledged primitive is now Txcomplete.
    const legacy=SV.migration.duplicatesRaw.source;
    const {app}=await load({storage:{"hpfc.scales.v3":legacy}});
    const diagnosticRefusal=async()=>{
      app.idb.fault("read",new Error("controlled post-ack readback"),{once:true});
      const result=await app.getAsync("reconcileSavedCollection()");
      assert.strictEqual(result.ok,false,"the diagnostic really encountered a failed backend read");
    };
    assert.strictEqual(app.store["hpfc.scales.v3"],legacy);
    const initial=snapshot(app);assert.strictEqual(initial.entries.length,2);
    await diagnosticRefusal();
    const add=await imported(app,SV.portableRecords.amaraB);assert.strictEqual(add.ok,true);
    const added=snapshot(app);assert.strictEqual(added.entries.length,3);
    await diagnosticRefusal();
    const target=added.entries[2];
    const res=await command(app,{type:"edit",collectionId:added.collectionId,instanceId:target.instanceId,expectedRevision:target.revision},
      {...copy(SV.portableRecords.amaraB),o:{name:"ACKNOWLEDGED EDIT"}});
    assert.strictEqual(res.ok,true);assert.strictEqual(res.created,false);
    await diagnosticRefusal();
    const edited=snapshot(app);assert.strictEqual(edited.entries.length,3);
    assert.strictEqual(edited.entries[2].instanceId,target.instanceId);
    assert.strictEqual(edited.entries[2].record.o.name,"ACKNOWLEDGED EDIT");
    assert.strictEqual(app.idb.operations.filter(x=>x.operation==="put").length,3,"migration/Add/Edit each commit once");
  });

  test("SV5 U4: UUID collisions and exhausted allocation preserve all prior data", async () => {
    const a=SV.portableRecords.amaraA, b=SV.portableRecords.amaraB;
    const crypto=cryptoFixture([iid(1),iid(2),iid(3),iid(3),iid(4)]);
    const {app,origin}=await seeded([a],{usedInstanceIds:[iid(1),iid(2)],nextDisplayOrdinal:3},{crypto});
    const e=snapshot(app);
    const added=await command(app,{type:"import",collectionId:e.collectionId,selectedInstanceId:iid(1)},b);
    assert.strictEqual(added.ok,true); assert.strictEqual(added.instanceId,iid(3));
    assert.strictEqual(snapshot(app).entries[1].displayOrdinal,3,"deleted ordinal2 cannot be reused");
    const gone=await command(app,{type:"delete",collectionId:e.collectionId,instanceId:iid(3),expectedRevision:1});
    assert.strictEqual(gone.ok,true);
    const again=await load({origin,crypto});
    assert.ok(snapshot(again.app).usedInstanceIds.includes(iid(3)),"reload retains deleted lifetime handles");
    const fresh=await command(again.app,{type:"import",collectionId:e.collectionId,selectedInstanceId:iid(1)},b);
    assert.strictEqual(fresh.instanceId,iid(4),"forced deleted-handle draw must be rejected after reload");
    const after=savedRaw(again.app);
    for(const type of ["edit","delete"]) {
      const stale=await command(again.app,{type,collectionId:e.collectionId,instanceId:iid(3),expectedRevision:1},type==="edit"?a:undefined);
      assert.strictEqual(stale.ok,false); assert.strictEqual(stale.kind,"conflict"); assert.strictEqual(savedRaw(again.app),after);
    }
    let exhaustedDraws=0;
    again.app.sandbox.crypto.randomUUID=()=>{exhaustedDraws++;return iid(1);};
    const exhausted=await command(again.app,{type:"import",collectionId:e.collectionId,selectedInstanceId:iid(1)},
      {v:4,s:SV.inventories.other.seed,o:{name:"NO ID AVAILABLE"}});
    assert.strictEqual(exhausted.ok,false); assert.strictEqual(exhausted.kind,"allocation");
    assert.strictEqual(exhaustedDraws,8,"allocation refuses after exactly eight colliding UUID draws");
    assert.strictEqual(savedRaw(again.app),after);
  });

  test("SV7 U1: late old-client writes remain a separate recovery branch", async () => {
    const source=SV.migration.mixedRaw, {app,origin}=await load({storage:copy(source.sources)});
    assert.strictEqual(app.store["hpfc.scales.v3"],source.sources["hpfc.scales.v3"],"old writer source must not be normalized in place");
    const before=snapshot(app), raw=JSON.stringify([SV.portableRecords.amaraB]);
    const writer=boot({origin,html:"<script>window.writerOnly=true;</script>"});
    writer.sandbox.localStorage.setItem("hpfc.scales.v3",raw); origin.flushStorageEvents();
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepStrictEqual(snapshot(app).entries,before.entries,"legacy divergence cannot replace authoritative variants");
    assert.deepStrictEqual(snapshot(app).migration,before.migration,"captured recovery baseline is immutable");
    assert.strictEqual(app.store["hpfc.scales.v3"],raw);
    assert.match(notices(app),/older|legacy|recover/i,"late old-client writes require a recovery branch notice");
  });

  test("SV7 U2: downgrade and re-upgrade preserve both namespaces", async () => {
    const old=JSON.stringify([SV.portableRecords.amaraA]);
    const {app,origin}=await seeded([SV.portableRecords.amaraA],{}, {storage:{[SV_KEY]:JSON.stringify(envelope([SV.portableRecords.amaraA])),"hpfc.scales.v3":old}});
    const before=savedRaw(app),writer=boot({origin,html:"<script>window.writerOnly=true;</script>"});
    const late=JSON.stringify([SV.portableRecords.amaraB]); writer.sandbox.localStorage.setItem("hpfc.scales.v3",late);
    const upgraded=await load({origin});
    assert.strictEqual(savedRaw(upgraded.app),before,"re-upgrade must resume the committed collection instead of re-migrating later legacy data");
    assert.strictEqual(upgraded.app.store["hpfc.scales.v3"],late); assert.strictEqual(upgraded.app.currentDeck().name,"PUBLIC PAN A");
  });

  test("SV7 U3: a stale collection epoch cannot mutate a replacement store", async () => {
    const {app}=await seeded([SV.portableRecords.amaraA]);
    const replacement=envelope([SV.portableRecords.amaraA],{collectionId:SV.ids.collectionB});
    await idbRecord(app,{write:true,value:JSON.stringify(replacement)});
    const raw=savedRaw(app);
    const res=await command(app,{type:"edit",collectionId:SV.ids.collectionA,instanceId:iid(1),expectedRevision:1},SV.portableRecords.amaraB);
    assert.strictEqual(res.ok,false); assert.strictEqual(res.kind,"conflict");
    assert.strictEqual(savedRaw(app),raw,"coincidentally equal handle/revision cannot bypass collection epoch");
    // The old API write may already be acknowledged while the caller's lock
    // Promise completion is delayed. Accepting epochB in between cannot let
    // that earlier completion roll the runtime cache back to epochA.
    const late=await seeded([SV.portableRecords.amaraA]),locks=late.app.sandbox.navigator.locks;
    const request=locks.request;let armed=true,releaseAck,pending;
    locks.request=function(...args) {
      const result=request.apply(this,args);
      if(armed&&args[0]===SV_LOCK) {armed=false;return result.then(value=>new Promise(resolve=>{
        late.app.sandbox.__svAckCaptured=true;releaseAck=()=>resolve(value);
      }));}
      return result;
    };
    try {
      pending=command(late.app,{type:"import",collectionId:SV.ids.collectionA,selectedInstanceId:iid(1)},SV.portableRecords.amaraB);
      pending.catch(()=>{});
      await late.app.waitFor("globalThis.__svAckCaptured===true",{timeout:1000});
      const committedA=snapshot(late.app);assert.strictEqual(committedA.entries.length,2,"actual API write happened before the delayed acknowledgment is released");
      const currentB={...copy(committedA),collectionId:SV.ids.collectionB};
      await idbRecord(late.app,{write:true,value:JSON.stringify(currentB)});
      const currentRaw=savedRaw(late.app);
      const accepted=await late.app.getAsync("reconcileSavedCollection()");assert.strictEqual(accepted.ok,true);
      assert.strictEqual(late.app.get("savedState.collectionId"),SV.ids.collectionB);
      releaseAck();releaseAck=null;
      const acknowledged=await pending;
      assert.strictEqual(acknowledged.ok,true,"a successful earlier API write remains acknowledged");
      assert.strictEqual(acknowledged.published,false,"acknowledged success cannot publish over a newly accepted epoch");
      assert.strictEqual(late.app.get("savedState.collectionId"),SV.ids.collectionB,"late epochA completion cannot roll the cache back");
      assert.strictEqual(savedRaw(late.app),currentRaw,"old completion cannot rewrite newer persistent bytes");
      assert.deepStrictEqual(plain(late.app.get("savedState")),currentB);
    }finally{if(releaseAck)releaseAck();locks.request=request;if(pending)await pending.catch(()=>{});}
  });

  test("SV8 U1: plain imports never inherit replacement authority", async () => {
    const rep={...copy(SV.portableRecords.amaraA),o:{name:"SLOT OWNER",replaces:"kurd",palette:2}};
    const {app}=await seeded([rep],{slots:{kurd:iid(1)},slotStateRevision:1});
    const e=snapshot(app);
    const res=await command(app,{type:"import",collectionId:e.collectionId,selectedInstanceId:iid(1)},
      {...copy(SV.portableRecords.amaraB),o:{name:"PLAIN IMPORT",replaces:"kurd",palette:3}});
    assert.strictEqual(res.ok,true);
    const after=snapshot(app),plain=after.entries.find(x=>x.instanceId===res.instanceId);
    assert.strictEqual(plain.record.o.replaces,undefined,"ordinary import must strip replacement authority");
    assert.deepStrictEqual(after.slots,{kurd:iid(1)}); assert.deepStrictEqual(after.entries[0],e.entries[0]);
  });

  test("SV8 U1b: a replacement keeps its seed's slot in the strip, after the plain saved scales", async () => {
    const rep={...copy(SV.portableRecords.amaraA),o:{name:"SLOT OWNER",replaces:"hijaz",palette:2}};
    const plainRec={...copy(SV.portableRecords.amaraB),o:{name:"PLAIN SAVED",palette:3}};
    const {app}=await seeded([rep,plainRec],{slots:{hijaz:iid(1)},slotStateRevision:1});
    const order=app.get("allDeckViews().map(v=>(v.slotId||'')+':'+v.selection.kind)");
    const builtins=app.get("DECKS.map(d=>d.id)");
    const want=[":saved",...builtins.map(id=>id+(id==="hijaz"?":saved":":builtin"))];
    assert.deepStrictEqual(plain(order),want,"the replacement must sit where its seed sat, not jump to the front");
  });

  test("SV8 U2: deleting a slot owner promotes the newest recognized survivor", async () => {
    const old={v:4,s:SV.inventories.amara9.seed,o:{name:"OLDER REPLACEMENT",replaces:"kurd"}};
    const current={v:4,s:SV.inventories.other.seed,o:{name:"NEWER REPLACEMENT",replaces:"kurd"}};
    const plain=SV.portableRecords.amaraB,opaque=SV.migration.slots.expectedRows[3];
    // RESET proofs are captured before the competing mutation. Creation AND
    // Edit of a recognized replacement must invalidate that exact proof.
    for(const action of ["create","edit"]) {
      const race=await seeded([old,current,plain,opaque],{slots:{kurd:iid(2)},slotStateRevision:1,preferredSelection:{kind:"saved",id:iid(2)}});
      const captured=snapshot(race.app),scope=affected(captured);
      const changed=await command(race.app,action==="create"
        ? {type:"replace-builtin",collectionId:captured.collectionId,seedId:"kurd",expectedSlotStateRevision:captured.slotStateRevision,expectedOwnerId:iid(2)}
        : {type:"edit",collectionId:captured.collectionId,instanceId:iid(2),expectedRevision:1},
        {v:4,s:SV.inventories.other.seed,o:{name:"CHANGED REPLACEMENT"}});
      assert.strictEqual(changed.ok,true,action+" competitor setup must commit");
      const winner=savedRaw(race.app);
      const staleReset=await command(race.app,{type:"reset",collectionId:captured.collectionId,affectedScope:scope});
      assert.strictEqual(staleReset.ok,false,action+" after arming must protect the newer replacement");
      assert.strictEqual(staleReset.kind,"conflict");
      assert.strictEqual(savedRaw(race.app),winner,"stale RESET cannot delete or rewrite the acknowledged winner");
    }
    const {app}=await seeded([old,current,plain,opaque],{slots:{kurd:iid(2)},slotStateRevision:1,preferredSelection:{kind:"saved",id:iid(2)}});
    const before=snapshot(app),staleProofless={type:"delete",collectionId:before.collectionId,instanceId:iid(1),expectedRevision:1};
    const del=await command(app,{type:"delete",collectionId:before.collectionId,instanceId:iid(2),expectedRevision:1,...slotProof(before)});
    assert.strictEqual(del.ok,true); const promoted=snapshot(app);
    assert.strictEqual(promoted.slots.kurd,iid(1)); assert.ok(promoted.hidden.includes("kurd"));
    const stale=await command(app,staleProofless);
    assert.strictEqual(stale.ok,false); assert.strictEqual(stale.kind,"conflict","promotion requires captured owner proof even if entry revision did not change");
    const armed=affected(promoted);
    const unrelated=await command(app,{type:"import",collectionId:before.collectionId,selectedInstanceId:null},
      {v:4,s:SV.inventories.other.seed,o:{name:"UNRELATED PUBLIC PAN"}});
    assert.strictEqual(unrelated.ok,true);
    const reset=await command(app,{type:"reset",collectionId:before.collectionId,affectedScope:armed});
    assert.strictEqual(reset.ok,true,"unrelated plain Add cannot invalidate a replacement-scope proof");
    const after=snapshot(app);
    assert.deepStrictEqual(after.slots,{}); assert.deepStrictEqual(after.hidden,[]);
    assert.deepStrictEqual(after.entries.find(x=>x.instanceId===iid(4)).record,opaque);
    assert.ok(after.entries.some(x=>x.instanceId===iid(3))); assert.ok(after.entries.some(x=>x.instanceId===unrelated.instanceId));
    assert.strictEqual(after.entries.some(x=>x.instanceId===iid(1)),false);
    assert.deepStrictEqual(after.migration,promoted.migration);
  });

  test("SV9 U1: cancelled waiting Save never commits and duplicate submit is disabled", async () => {
    const {app,origin}=await seeded([SV.portableRecords.amaraA]);
    let release,acquired;
    const held=new Promise(resolve=>{acquired=resolve;});
    const blocker=app.sandbox.navigator.locks.request(SV_LOCK,()=>{acquired();return new Promise(resolve=>{release=resolve;});});
    await held; const before=savedRaw(app),writes=app.idb.operations.filter(x=>x.operation==="put").length;
    try {
      editSelected(app); rename(app,"CANCELLED DRAFT");
      const pending=app.getAsync("runGenerate()");
      await app.waitFor("navigator.locks.query().then(q => q.pending.length === 1)");
      assert.strictEqual(app.els["scale-generate"].disabled,true);
      app.els["scale-generate"].click();
      const q=await app.sandbox.navigator.locks.query(); assert.strictEqual(q.pending.length,1,"duplicate submit must not enqueue another command");
      app.els["scale-back"].click(); await pending;
      assert.strictEqual(savedRaw(app),before); assert.strictEqual(app.idb.operations.filter(x=>x.operation==="put").length,writes);
      assert.strictEqual((await app.sandbox.navigator.locks.query()).pending.length,0);
    } finally {release();await blocker;}
    assert.strictEqual(savedRaw(app),before,"cancelled pending write cannot commit after release");
  });

  test("SV9 U2: an obsolete completed Save cannot close or select a newer context", async () => {
    const {app}=await seeded([SV.portableRecords.amaraA]);
    editSelected(app); rename(app,"ACKNOWLEDGED FIRST");
    const request=app.sandbox.navigator.locks.request.bind(app.sandbox.navigator.locks);
    let opened=false;
    app.sandbox.navigator.locks.request=(...args)=>request(...args).then(result=>{
      if(result?.ok&&!opened){opened=true;openSheet(app);app.type(SV.inventories.other.seed);app.els["scale-box"].focus();}
      return result;
    });
    await submit(app);
    assert.strictEqual(opened,true); assert.strictEqual(app.sheetOpen(),true,"old success must not close the new Add sheet");
    assert.strictEqual(app.els["scale-box"].value,SV.inventories.other.seed);
    assert.strictEqual(app.activeId(),"scale-box");
    assert.strictEqual(snapshot(app).entries[0].record.o.name,"ACKNOWLEDGED FIRST","already acknowledged commit stays saved");
    assert.doesNotMatch(notices(app),/ACKNOWLEDGED FIRST/,"obsolete success cannot announce into the newer context");
  });

  test("SV10 U1: final chip labels remain unique through literal suffix and built-in collisions", async () => {
    for(const lang of SV.labels.locales)for(const c of SV.labels.cases) {
      const records=c.names.map(name=>({v:4,s:SV.inventories.amara9.seed,o:{name}}));
      // Literal fixture ordinals include11/12 and101/102. Full lifetime
      // history makes those post-delete gaps a valid schema1 input.
      const input=envelope(records),highest=Math.max(...c.ordinals);
      input.entries.forEach((entry,i)=>{entry.instanceId=iid(c.ordinals[i]);entry.displayOrdinal=c.ordinals[i];});
      input.usedInstanceIds=Array.from({length:highest},(_,i)=>iid(i+1));
      input.nextDisplayOrdinal=highest+1;input.preferredSelection={kind:"saved",id:iid(c.ordinals[0])};
      const {app}=await load({storage:{hpfc:JSON.stringify({lang,mode:"A"}),[SV_KEY]:JSON.stringify(input)}});
      const labels=names(app);
      assert.strictEqual(labels.length,5+c.names.length,"every committed same-inventory label candidate must render in "+lang+"/"+c.id);
      assert.strictEqual(new Set(labels).size,labels.length,"final rendered labels must be collision-free in "+lang+"/"+c.id);
      const e=snapshot(app);
      assert.deepStrictEqual(e.entries.map(x=>x.record.o.name),c.names,"disambiguation never edits stored names");
      assert.deepStrictEqual(e.entries.map(x=>x.displayOrdinal),c.ordinals,"fixture ordinals survive rather than being silently compacted");
      for(const [i,token] of c.expectedSavedTokens.entries()) {
        // Literal fixture input order is oldest first; custom strip is newest
        // first. Bind each expected token to its own control, not a substring
        // search that could accidentally find a sibling's literal name.
        const chip=app.els.decks.children[c.names.length-1-i];
        assert.ok(chip && strip(chip.innerHTML||chip.textContent).endsWith(SV.labels.separator+token),"literal fixture collision suffix is visible on its own control: "+token);
        assert.ok((chip.getAttribute("aria-label")||strip(chip.innerHTML)).includes(token),"accessible label retains "+token);
      }
      if(c.expectedPresetToken) {
        assert.strictEqual(c.presetId,"amara","this frozen preset case targets the third built-in slot");
        const preset=app.els.decks.children[c.names.length+2];
        assert.ok(preset && strip(preset.innerHTML||preset.textContent).endsWith(SV.labels.separator+c.expectedPresetToken),"preset disambiguation retains literal fixture token "+c.expectedPresetToken);
        assert.ok((preset.getAttribute("aria-label")||strip(preset.innerHTML)).includes(c.expectedPresetToken));
      }
      for(const id of e.usedInstanceIds)assert.strictEqual(labels.some(n=>n.includes(id)),false,"opaque local handles never appear as labels");
      openSheet(app);app.type(SV.inventories.amara9.seed);
      assert.strictEqual(app.els["scale-generate"].disabled,false,"English note input remains accepted in "+lang);
    }
  });

  // Independent review regressions: approved async-ownership, coherent editor,
  // route persistence, recovery and localization contracts; not output-derived.
  test("SV11 U1: acknowledged old imports cannot steal a newer view or Add sheet", async () => {
    for (const newer of ["selection", "sheet"]) {
      const {app}=await load(); let release, acquired;
      const held=new Promise(resolve=>{acquired=resolve;});
      const blocker=app.sandbox.navigator.locks.request(SV_LOCK,()=>{acquired();return new Promise(resolve=>{release=resolve;});});
      await held;
      const pending=imported(app,SV.portableRecords.amaraA);
      await app.waitFor("navigator.locks.query().then(q=>q.pending.length===1)");
      if(newer==="selection")app.run('selectDeck({kind:"builtin",id:"pygmy"},false)');
      else {openSheet(app);app.type(SV.inventories.other.seed);app.els["scale-box"].focus();}
      const route=app.location.hash, selected=plain(app.get("selection"));
      release();await blocker; const result=await pending;
      assert.strictEqual(result.ok,true,"an already queued import remains a legitimate acknowledged record");
      assert.ok(snapshot(app).entries.some(e=>e.record.o.name==="PUBLIC PAN A"));
      assert.deepStrictEqual(plain(app.get("selection")),selected,"obsolete import must not select over newer "+newer);
      assert.strictEqual(app.location.hash,route,"obsolete import must not replace newer route");
      if(newer==="sheet") {assert.strictEqual(app.sheetOpen(),true);assert.strictEqual(app.els["scale-box"].value,SV.inventories.other.seed);assert.strictEqual(app.activeId(),"scale-box");}
      const fresh=await imported(app,SV.portableRecords.amaraB);
      assert.strictEqual(fresh.ok,true);assert.strictEqual(app.currentDeck().name,"PUBLIC PAN B","current import still selects its acknowledged version");
    }
  });

  test("SV11 U2: remote replacement keeps a clean built-in editor target and fields coherent", async () => {
    const {app,origin,crypto}=await load(); editSelected(app);
    const peer=(await load({origin,crypto})).app, before=snapshot(peer);
    const rec=copy(SV.portableRecords.amaraB);rec.o.replaces="kurd";
    const added=await command(peer,{type:"replace-builtin",collectionId:before.collectionId,seedId:"kurd",expectedSlotStateRevision:0,expectedOwnerId:null},rec);
    assert.strictEqual(added.ok,true);origin.flushBroadcastMessages();
    await app.waitFor(`savedEntries.has(${JSON.stringify(added.instanceId)})`);
    assert.strictEqual(app.get("editorSession.history.present.options.name"),"PUBLIC PAN B","clean editor must display the replacement it is now bound to");
    const base=plain(app.get("({selection:editingBase.selection,name:editingBase.deck.name,revision:editingBase.revision})"));
    assert.deepStrictEqual(base,{selection:{kind:"saved",id:added.instanceId},name:"PUBLIC PAN B",revision:1});
    rename(app,"COHERENT REPLACEMENT");await submit(app);
    assert.strictEqual(snapshot(app).entries.find(e=>e.instanceId===added.instanceId).record.o.name,"COHERENT REPLACEMENT");
  });


  test("SV11 U4: stored and detected non-English cold boots localize before ready", async () => {
    const de=JSON.parse(fs.readFileSync(path.join(ROOT,"data/i18n/de.json"),"utf8"));
    for(const storage of [{hpfc:JSON.stringify({lang:"de"})},{}]) {
      const {app}=await load({storage,languages:["de-DE","en"]});
      assert.strictEqual(app.get("document.documentElement.lang"),"de","ready UI declares its resolved language");
      assert.strictEqual(app.els["settings-trigger"].getAttribute("aria-label"),de["header.settings"],"static settings control copy is localized at first ready");
      assert.ok(app.els["lang-select"].children.some(option=>option.textContent==="DEUTSCH"),"language selector is populated before ready");
    }
  });

  test("SV11 U5: a built-in boot route persists tagged preference without rewriting legacy selection", async () => {
    const legacy=JSON.stringify({deck:"kurd",other:{keep:true}});
    const {app,origin,crypto}=await load({href:"https://example.test/index.html#deck=f-low-pygmy-18",storage:{hpfc:legacy}});
    assert.strictEqual(app.currentDeck().id,"pygmy");
    await committedPreference(app,{kind:"builtin",id:"pygmy"});
    assert.deepStrictEqual(snapshot(app).preferredSelection,{kind:"builtin",id:"pygmy"},"opening a seed route persists the selected view for the next visit");
    assert.strictEqual(app.store.hpfc,legacy,"new selection authority does not rewrite legacy preferences");
    const reloaded=(await load({origin,crypto})).app;assert.strictEqual(reloaded.currentDeck().id,"pygmy");
  });

  test("SV11 U6: missed-event conflict preserves draft then Back shows the acknowledged winner", async () => {
    const origin=createOrigin({events:"omit",broadcastEvents:"omit"});
    const {app,crypto}=await seeded([SV.portableRecords.amaraA],{}, {origin});
    editSelected(app);rename(app,"LOSING LOCAL DRAFT");
    const peer=(await load({origin,crypto})).app,e=snapshot(peer);
    const changed=await command(peer,{type:"edit",collectionId:e.collectionId,instanceId:iid(1),expectedRevision:1},SV.portableRecords.amaraB);
    assert.strictEqual(changed.ok,true);const winner=savedRaw(app);
    assert.strictEqual(snapshot(peer).entries[0].record.o.name,"PUBLIC PAN B","the peer winner is really committed before the missed-event Save");
    await new Promise(resolve=>setImmediate(resolve));
    assert.strictEqual(app.get(`savedEntries.get(${JSON.stringify(iid(1))}).deck.name`),"PUBLIC PAN A","both notification transports are omitted: the losing tab has not already reconciled the winner");
    assert.strictEqual(app.get(`savedState.entries[0].revision`),1,"the conflict fallback must discover the peer revision itself");
    await submit(app);
    assert.strictEqual(app.sheetOpen(),true);assert.strictEqual(app.els["scale-name"].value,"LOSING LOCAL DRAFT");
    assert.ok(app.els["scale-refusal"].textContent.length>0,"the conflict is shown");assert.strictEqual(savedRaw(app),winner);
    app.els["scale-back"].click();
    assert.strictEqual(app.currentDeck().name,"PUBLIC PAN B","explicit Back reviews the real saved winner even with all events omitted");
    assert.strictEqual(savedRaw(app),winner,"review/cancel cannot rewrite the winner");
  });

  test("SV11 U7: About seed routing selects the slot owner rather than an equal-inventory sibling", async () => {
    const owner=copy(SV.portableRecords.amaraA);owner.o.replaces="kurd";
    const {app}=await seeded([owner,SV.portableRecords.amaraB],{slots:{kurd:iid(1)},slotStateRevision:1,preferredSelection:{kind:"saved",id:iid(2)}});
    assert.strictEqual(app.currentDeck().name,"PUBLIC PAN B");app.run("openAbout()");
    app.run("aboutLink('#deck=d-kurd-10')");
    assert.strictEqual(app.currentDeck().name,"PUBLIC PAN A","seed link targets its owner, not any scale with the same notes");
    assert.deepStrictEqual(plain(app.get("selection")),{kind:"saved",id:iid(1)});
  });

  test("SV11 U8: protected temporary-use action is inert behind modal Settings", async () => {
    const {app}=await load({storage:{[SV_KEY]:'{"schema":99}'}});
    assert.strictEqual(app.els["saved-temporary-use"].hidden,false,"protected recovery exposes explicit temporary operation");
    app.run("openPanel()");
    assert.strictEqual(app.els["saved-temporary-use"].inert,true,"background action must be inert while Settings owns modal focus");
    app.run("closePanel()");
    assert.strictEqual(app.els["saved-temporary-use"].inert,false,"closing Settings restores the explicit action");
  });


  test("SV12 U1: Back Escape and Save return focus to a connected surviving instance chip", async () => {
    for(const action of ["back","escape","save"]) {
      const {app}=await seeded([SV.portableRecords.amaraA],{},{layout:true});
      const original=app.els.decks.children.find(c=>c.classList.contains("on"));original.focus();
      editSelected(app);
      if(action==="save"){rename(app,"FOCUS RETURN");await submit(app);}
      else if(action==="back")app.els["scale-back"].click();
      else app.keydown("Escape");
      assert.strictEqual(app.sheetOpen(),false);
      const active=app.sandbox.document.activeElement;
      assert.ok(app.els.decks.children.includes(active),action+" focus must belong to the current chip strip, never a detached opener");
      assert.strictEqual(active.getAttribute("data-selection-id"),iid(1));
    }
  });


  test("SV12 U3: a draft becoming invalid during pending Save stays disabled after completion", async () => {
    const {app}=await seeded([SV.portableRecords.amaraA]);editSelected(app);rename(app,"PENDING VALID");
    let release,acquired;const held=new Promise(resolve=>{acquired=resolve;});
    const blocker=app.sandbox.navigator.locks.request(SV_LOCK,()=>{acquired();return new Promise(resolve=>{release=resolve;});});await held;
    const pending=submit(app);await app.waitFor("navigator.locks.query().then(q=>q.pending.length===1)");
    app.type("xyz");assert.strictEqual(app.els["scale-generate"].disabled,true,"invalid draft cannot submit while pending");
    release();await blocker;await pending;
    assert.strictEqual(app.sheetOpen(),true);assert.strictEqual(app.els["scale-box"].value,"xyz");
    assert.strictEqual(app.els["scale-generate"].disabled,true,"old completion cannot re-enable an invalid current draft");
  });

  test("SV12 U4: unchanged session status is not written again into its live region", async () => {
    const {app}=await load({locks:false});const status=app.els["saved-status"];
    assert.ok(status.textContent.length>0,"this-tab status has readable current copy");
    const descriptor=Object.getOwnPropertyDescriptor(status,"textContent");let writes=0;
    Object.defineProperty(status,"textContent",{configurable:true,get:descriptor.get,set(value){writes++;descriptor.set.call(this,value);}});
    app.run("updateSavedStatus();updateSavedStatus()");
    assert.strictEqual(writes,0,"unchanged status must not generate repeated live-region mutations");
  });


  test("SV12 U5: failed incoming link remains recoverable and LINK cannot silently share the previous scale", async () => {
    const probe=await load();
    const record=SV.portableRecords.amaraB;
    const code=plain(probe.app.get(`HPE.share.encode({fields:HPE.core.parseSeed(${JSON.stringify(record.s)}).value.fields,options:${JSON.stringify(record.o)}})`));
    assert.strictEqual(code.ok,true);const hash="#s="+code.value;
    const initial=envelope([SV.portableRecords.amaraA]);
    const {app}=await load({href:"https://example.test/index.html"+hash,idbRaw:JSON.stringify(initial),
      idbFault:{operation:"put",error:new Error("public test write refused")}});
    assert.strictEqual(app.currentDeck().name,"PUBLIC PAN A","failed import cannot falsely replace the saved selection");
    assert.strictEqual(app.location.hash,hash,"failed incoming content stays available for explicit retry");
    assert.strictEqual(app.els["share-copy"].disabled,true,"LINK cannot copy the previous scale while the incoming link is unresolved");
    assert.deepStrictEqual(snapshot(app).entries.map(e=>e.record.o.name),["PUBLIC PAN A"]);
    const retried=await app.getAsync(`openShare(${JSON.stringify(code.value)})`);
    assert.strictEqual(retried.ok,true);assert.strictEqual(app.currentDeck().name,"PUBLIC PAN B");
    assert.strictEqual(app.els["share-copy"].disabled,false);assert.strictEqual(app.location.hash,hash);
  });


  test("SV12 U6: accessible collision labels explain stable saved and preset tokens in each locale", async () => {
    for(const lang of SV.labels.locales)for(const c of SV.labels.cases) {
      const input=envelope(c.names.map(name=>({v:4,s:SV.inventories.amara9.seed,o:{name}})));
      const highest=Math.max(...c.ordinals);
      input.entries.forEach((entry,i)=>{entry.instanceId=iid(c.ordinals[i]);entry.displayOrdinal=c.ordinals[i];});
      input.usedInstanceIds=Array.from({length:highest},(_,i)=>iid(i+1));input.nextDisplayOrdinal=highest+1;
      input.preferredSelection={kind:"saved",id:iid(c.ordinals[0])};
      const {app}=await load({storage:{hpfc:JSON.stringify({lang}),[SV_KEY]:JSON.stringify(input)}});
      const locale=JSON.parse(fs.readFileSync(path.join(ROOT,"data/i18n",lang+".json"),"utf8"));
      for(const [i,token] of c.expectedSavedTokens.entries()) {
        const chip=app.els.decks.children[c.names.length-1-i],visible=strip(chip.innerHTML||chip.textContent);
        const accessible=chip.getAttribute("aria-label")||visible;
        assert.ok(accessible.includes(visible),"accessible name retains the entire visible label");
        assert.notStrictEqual(accessible,visible,"saved discriminator needs a readable explanation beyond its unexplained token");
        if(lang==="en")assert.ok(accessible.includes(token+" identifies this saved scale in this browser."),"saved token explanation is readable beyond the existing Edit prefix");
        assert.strictEqual(typeof locale["saved.savedToken"],"string");
        assert.ok(accessible.includes(locale["saved.savedToken"].replace("{token}",token)),lang+" explains literal saved token "+token);
      }
      if(c.expectedPresetToken) {
        const chip=app.els.decks.children[c.names.length+2],visible=strip(chip.innerHTML||chip.textContent),accessible=chip.getAttribute("aria-label")||visible;
        assert.ok(accessible.includes(visible));assert.notStrictEqual(accessible,visible,"preset token also needs explanation");
        assert.strictEqual(typeof locale["saved.presetToken"],"string");
        assert.ok(accessible.includes(locale["saved.presetToken"].replace("{token}",c.expectedPresetToken)));
      }
    }
  });


  test("SV13 U1: opening Edit never puts a local collection or instance handle in the URL", async () => {
    const {app}=await seeded([SV.portableRecords.amaraA]);const e=snapshot(app);
    const inventory=app.currentDeck().id,practiceHref=app.location.href;editSelected(app);
    for(const handle of [e.collectionId,...e.usedInstanceIds])assert.strictEqual(app.location.href.includes(handle),false,"opaque local handles are never route metadata");
    assert.strictEqual(app.location.hash,"#edit-"+inventory,"Edit keeps the portable canonical inventory route while targeting its instance internally");
    assert.deepStrictEqual(plain(app.get("editingBase.selection")),{kind:"saved",id:iid(1)});
    app.els["scale-back"].click();
    assert.strictEqual(app.history.calls.at(-1).type,"back","Back requests the existing history entry");
    // The shared VM history is a call log, not a navigation stack. Supply the
    // browser-owned restored URL/popstate exactly as existing route tests do.
    app.location.href=practiceHref;app.popstate();
    assert.ok(app.location.hash.startsWith("#s="));
    assert.strictEqual(app.get("pendingPop"),false);
  });


  // DESIGN P1: an acknowledged session command has no durable copy to reload.
  // Fail only local snapshot publication after the real command computation;
  // do not fake a durable ACK or bypass candidate validation/allocation.
  function failPublication(app, persistence) {
    app.run(`globalThis.__publicationOriginal=applySavedSnapshot;
      applySavedSnapshot=function(envelope,views,source){
        if(source===${JSON.stringify(persistence==="session"?"session":"commit")})throw new Error("public test publication failure");
        return __publicationOriginal(envelope,views,source);
      };
      globalThis.__publishCommandOriginal=publishSavedCommand;
      publishSavedCommand=function(...args){return globalThis.__publicationAck=__publishCommandOriginal(...args);};`);
  }

  test("SV14 U1: unpublished session Save keeps its draft and never recommends destructive reload", async () => {
    const {app}=await load({locks:false});
    assert.strictEqual(app.get("savedMode"),"session");
    openSheet(app);app.type(AMARA_STRING);rename(app,"SESSION DRAFT RETAINED");
    const draft=app.els["scale-box"].value,before=plain(app.get("selection"));
    failPublication(app,"session");await submit(app);
    const ack=plain(app.get("globalThis.__publicationAck"));
    assert.strictEqual(ack.ok,true,"real session command reached its publication boundary");
    assert.strictEqual(ack.persistence,"session");assert.strictEqual(ack.published,false);
    assert.ok(ack.envelope.entries.some(e=>e.record.o.name==="SESSION DRAFT RETAINED"));
    assert.strictEqual(savedRaw(app),undefined,"session ACK never implied a durable recovery copy");
    assert.strictEqual(app.sheetOpen(),true);assert.strictEqual(app.els["scale-box"].value,draft);
    assert.strictEqual(app.els["scale-name"].value,"SESSION DRAFT RETAINED");
    assert.deepStrictEqual(plain(app.get("selection")),before,"unpublished view cannot claim selection changed");
    assert.ok(app.els["scale-refusal"].textContent.length>0,"retained draft has actionable failure feedback");
    assert.doesNotMatch(app.els["scale-refusal"].textContent,/(?:^|[.!?]\s*)(?:please\s+)?reload\b|\breload\s+to\s+(?:review|recover|restore)\b/i,"reloading would discard the only recoverable session draft");
  });

  test("SV14 U2: unpublished session import keeps incoming content without advising reload", async () => {
    const {app}=await load({locks:false});
    const r=SV.portableRecords.amaraB;
    const code=plain(app.get(`HPE.share.encode({fields:HPE.core.parseSeed(${JSON.stringify(r.s)}).value.fields,options:${JSON.stringify(r.o)}})`));
    assert.strictEqual(code.ok,true);const hash="#s="+code.value;
    const before=plain(app.get("selection"));app.location.hash=hash;
    failPublication(app,"session");const ack=await app.getAsync(`openShare(${JSON.stringify(code.value)})`);
    assert.strictEqual(ack.ok,true);assert.strictEqual(ack.persistence,"session");assert.strictEqual(ack.published,false);
    assert.ok(ack.envelope.entries.some(e=>e.record.o.name==="PUBLIC PAN B"));
    assert.strictEqual(savedRaw(app),undefined);assert.deepStrictEqual(plain(app.get("selection")),before);
    assert.strictEqual(app.location.hash,hash,"incoming portable content remains recoverable");
    assert.strictEqual(app.els["share-copy"].disabled,true,"unpublished incoming content cannot share the previous view");
    assert.ok(app.announcer().textContent.length>0);
    assert.doesNotMatch(app.announcer().textContent,/(?:^|[.!?]\s*)(?:please\s+)?reload\b|\breload\s+to\s+(?:review|recover|restore)\b/i,"session-only publication failure cannot recommend reload recovery");
  });

  test("SV14 U3: unpublished durable Save really commits and offers the approved reload review", async () => {
    const {app}=await seeded([SV.portableRecords.amaraA]);editSelected(app);rename(app,"DURABLE ACK RETAINED");
    failPublication(app,"durable");await submit(app);
    const ack=plain(app.get("globalThis.__publicationAck"));
    assert.strictEqual(ack.ok,true);assert.strictEqual(ack.persistence,"durable");assert.strictEqual(ack.published,false);
    assert.strictEqual(snapshot(app).entries[0].record.o.name,"DURABLE ACK RETAINED","durable success must exist in serialized storage before reload advice");
    assert.strictEqual(app.currentDeck().name,"PUBLIC PAN A","publication failure has not updated the current view");
    assert.strictEqual(app.sheetOpen(),true);assert.strictEqual(app.els["scale-name"].value,"DURABLE ACK RETAINED");
    assert.match(app.els["scale-refusal"].textContent,/reload/i,"durable ACK can truthfully guide review by reload");
    const reopened=await load({origin:app.fixtureOrigin});
    assert.strictEqual(reopened.app.currentDeck().name,"DURABLE ACK RETAINED","fresh boot independently recovers the acknowledged durable command");
  });


  // Hold only settlement of a real exclusive-lock result: setItem already
  // succeeded and the origin lock has been released before another tab writes.
  function holdAcknowledgedPublication(app) {
    app.run(`globalThis.__ackGate=new Promise(resolve=>globalThis.__releaseAck=resolve);
      globalThis.__holdNextAck=true;globalThis.__heldRealAck=null;
      const request=navigator.locks.request.bind(navigator.locks);
      navigator.locks.request=(...args)=>request(...args).then(async result=>{
        if(__holdNextAck&&result&&result.ok&&result.envelope){
          __holdNextAck=false;globalThis.__heldRealAck=result;await __ackGate;
        }
        return result;
      });
      globalThis.__publishAckOriginal=publishSavedCommand;
      publishSavedCommand=function(...args){return globalThis.__publishedRealAck=__publishAckOriginal(...args);};`);
  }

  test("SV15 U1: delayed same-epoch Save ACK cannot republish a deleted target or discard its draft", async () => {
    const origin=createOrigin({events:"omit"});
    const {app,crypto}=await seeded([SV.portableRecords.amaraA,SV.portableRecords.amaraB],{}, {origin});
    editSelected(app);rename(app,"ACKED LOCAL DRAFT");holdAcknowledgedPublication(app);
    const settled=submit(app).then(()=>({ok:true}),error=>({ok:false,error}));
    await app.waitFor("globalThis.__heldRealAck!==null");
    const actualAck=plain(app.get("globalThis.__heldRealAck"));
    assert.strictEqual(actualAck.ok,true);assert.strictEqual(actualAck.envelope.collectionId,snapshot(app).collectionId);
    assert.strictEqual(snapshot(app).entries.find(e=>e.instanceId===iid(1)).record.o.name,"ACKED LOCAL DRAFT","real exclusive write completed before settlement is held");
    const peer=(await load({origin,crypto})).app;
    const removed=await command(peer,{type:"delete",collectionId:actualAck.envelope.collectionId,instanceId:iid(1),expectedRevision:2});
    assert.strictEqual(removed.ok,true);assert.ok(!snapshot(peer).entries.some(e=>e.instanceId===iid(1)));
    await app.getAsync("reconcileSavedCollection()");
    const winner=savedRaw(app),before=plain(app.get("selection")),route=app.location.href;
    assert.ok(app.get("savedState.revision")>actualAck.envelope.revision);
    app.run("__releaseAck()");const completion=await settled;
    assert.strictEqual(completion.ok,true,"older successful Save ACK must not dereference a target removed by the acknowledged newer winner: "+completion.error);
    const published=plain(app.get("globalThis.__publishedRealAck"));
    assert.strictEqual(published.ok,true,"the original actual storage ACK remains successful");
    assert.strictEqual(published.published,false,"ignored same-epoch older snapshot is not a published current view");
    assert.strictEqual(savedRaw(app),winner);assert.deepStrictEqual(plain(app.get("selection")),before);
    assert.strictEqual(app.location.href,route);assert.strictEqual(app.sheetOpen(),true);
    assert.strictEqual(app.els["scale-name"].value,"ACKED LOCAL DRAFT","late ACK never discards the retained losing draft");
  });

  test("SV15 U2: delayed same-epoch import ACK cannot select over a newer reconciled edit", async () => {
    const origin=createOrigin({events:"omit"});
    const {app,crypto}=await seeded([SV.portableRecords.amaraA],{}, {origin});holdAcknowledgedPublication(app);
    const r=SV.portableRecords.amaraB;
    const encoded=plain(app.get(`HPE.share.encode({fields:HPE.core.parseSeed(${JSON.stringify(r.s)}).value.fields,options:${JSON.stringify(r.o)}})`));
    assert.strictEqual(encoded.ok,true);app.location.hash="#s="+encoded.value;
    const pending=app.getAsync(`openShare(${JSON.stringify(encoded.value)})`);
    await app.waitFor("globalThis.__heldRealAck!==null");
    const actualAck=plain(app.get("globalThis.__heldRealAck")),target=actualAck.instanceId;
    assert.strictEqual(snapshot(app).entries.find(e=>e.instanceId===target).record.o.name,"PUBLIC PAN B","incoming import was genuinely committed before holding its publication");
    const peer=(await load({origin,crypto})).app,winnerRecord=copy(SV.portableRecords.amaraB);winnerRecord.o.name="NEWER IMPORT WINNER";
    const changed=await command(peer,{type:"edit",collectionId:actualAck.envelope.collectionId,instanceId:target,expectedRevision:1},winnerRecord);
    assert.strictEqual(changed.ok,true);await app.getAsync("reconcileSavedCollection()");
    const winner=savedRaw(app),before=plain(app.get("selection")),route=app.location.href;
    assert.ok(app.get("savedState.revision")>actualAck.envelope.revision);
    app.run("__releaseAck()");const result=await pending;
    assert.strictEqual(result.ok,true,"old actual import ACK remains acknowledged");
    assert.strictEqual(result.published,false,"same-epoch newer revision prevents old import publication and selection");
    assert.strictEqual(savedRaw(app),winner);assert.deepStrictEqual(plain(app.get("selection")),before);
    assert.strictEqual(app.location.href,route);
    assert.strictEqual(app.get(`savedEntries.get(${JSON.stringify(target)}).deck.name`),"NEWER IMPORT WINNER");
  });

  test("SV15 U3: a current newer-revision real ACK still publishes and renders its committed Edit", async () => {
    const {app}=await seeded([SV.portableRecords.amaraA]),before=snapshot(app);
    const result=await command(app,{type:"edit",collectionId:before.collectionId,instanceId:iid(1),expectedRevision:1},SV.portableRecords.amaraB);
    assert.strictEqual(result.ok,true);assert.strictEqual(result.persistence,"durable");assert.strictEqual(result.published,true);
    assert.ok(result.envelope.revision>before.revision);assert.strictEqual(app.get("savedState.revision"),result.envelope.revision);
    assert.strictEqual(snapshot(app).entries[0].record.o.name,"PUBLIC PAN B");
    assert.strictEqual(app.currentDeck().name,"PUBLIC PAN B");
  });




  test("IDB1 U1: successful put followed by transaction abort never acknowledges or spends history", async () => {
    const {app}=await load({indexedDB:true,broadcastChannel:true});
    // Normal application readiness precedes the fault. A missing model API is
    // a precondition failure, never the old-adapter behavioral RED evidence.
    assert.ok(app.idb && typeof app.idb.fault === "function", "precondition: reviewed model supports the transaction fault");
    const before=await idbRecord(app);
    app.idb.fault("abortAfterPut", new Error("controlled abort after successful put"), {once:true});
    const result=await command(app,{type:"import",collectionId:app.get("savedState.collectionId")},SV.portableRecords.amaraA);
    assert.strictEqual(result.ok,false,"put request success cannot acknowledge a transaction that did not complete");
    assert.deepStrictEqual(await idbRecord(app),before,"aborted working bytes and lifetime allocation history never become committed authority");
    assert.ok(!names(app).includes("PUBLIC PAN A"),"an aborted import cannot publish a chip");
    const retry=await command(app,{type:"import",collectionId:app.get("savedState.collectionId")},SV.portableRecords.amaraA);
    assert.strictEqual(retry.ok,true);assert.strictEqual(retry.persistence,"durable");
    const durable=await idbRecord(app);
    assert.strictEqual(durable.present,true);
    const committed=JSON.parse(durable.raw);
    assert.strictEqual(committed.entries.length,1);assert.strictEqual(committed.entries[0].displayOrdinal,1);
    assert.strictEqual(committed.usedInstanceIds.length,1);assert.strictEqual(committed.nextDisplayOrdinal,2);
    assert.strictEqual(app.store[SV_KEY],undefined,"successful IDB writes never create a live LS collection mirror");
  });

  test("IDB2 U1: no-lock session hydrates authoritative IDB over stale LS and never promotes", async () => {
    const stale = JSON.stringify(envelope([SV.portableRecords.amaraB]));
    const {app, origin, fixture, initial} = await idbSeeded([SV.portableRecords.amaraA], {},
      {locks:false, storage:{[SV_KEY]:stale}});
    assert.strictEqual(app.get("savedMode"), "session");
    assert.strictEqual(app.currentDeck().name, "PUBLIC PAN A", "readable IDB, rather than stale LS, seeds the temporary clone");
    assert.deepStrictEqual(await idbRecord(fixture), {present:true, raw:JSON.stringify(initial)});
    editSelected(app); rename(app, "THIS TAB EDIT"); await submit(app);
    assert.strictEqual(app.currentDeck().name, "THIS TAB EDIT");
    await app.getAsync("reconcileSavedCollection()");
    assert.strictEqual(app.currentDeck().name, "THIS TAB EDIT", "focus/notification reconciliation cannot promote over a temporary edit");
    assert.deepStrictEqual(await idbRecord(fixture), {present:true, raw:JSON.stringify(initial)}, "session commands never change committed IDB");
    assert.strictEqual(app.store[SV_KEY], stale, "the experimental source remains exact recovery evidence");
    assert.deepStrictEqual(app.idb.operations.filter(x=>x.operation==="put"||x.operation==="createObjectStore"||x.operation==="transaction"&&x.mode==="readwrite"),[],"session authority never attempts a durable or schema write");
    assert.strictEqual(origin.successfulWrites.filter(x=>x.key===SV_KEY).length, 0);
    const absent=await load({locks:false,storage:{[SV_KEY]:stale}});
    assert.strictEqual(absent.app.get("savedMode"),"session");
    assert.strictEqual(absent.app.currentDeck().name,"PUBLIC PAN B","truly absent authority may supply only a temporary recovery copy");
    assert.strictEqual(absent.app.idb.inspect(SV_KEY),undefined,"absence probe cannot commit a database schema without locks");
    assert.deepStrictEqual(absent.app.idb.operations.filter(x=>x.operation==="put"||x.operation==="createObjectStore"),[]);
  });

  test("IDB3 U1: present undefined null and object records protect authority and legacy bytes", async () => {
    for (const raw of [undefined, null, {schema:1}]) {
      const stale=JSON.stringify(envelope([SV.portableRecords.amaraB]));
      const origin=createOrigin(), fixture=idbFixtureRealm(origin,{[SV_KEY]:stale});
      await idbRecord(fixture, {write:true, value:raw});
      assert.deepStrictEqual(await idbRecord(fixture), {present:true, raw}, "getKey proves that undefined is a present value");
      const {app}=await load({origin,indexedDB:true,broadcastChannel:true,storage:{[SV_KEY]:stale}});
      assert.strictEqual(app.get("savedMode"), "protected", "malformed present authority never authorizes stale-source migration");
      assert.ok(!names(app).includes("PUBLIC PAN B"));
      assert.deepStrictEqual(await idbRecord(fixture), {present:true, raw}, "malformed authoritative values are not repaired or replaced");
      assert.strictEqual(app.store[SV_KEY], stale);
      assert.strictEqual(origin.successfulWrites.filter(x=>x.key===SV_KEY).length, 0);
    }
    for(const backendSource of [null,{key:"__sv_untrusted_source__",raw:"untrusted"},{key:SV_KEY,raw:null}]) {
      const initial=envelope([SV.portableRecords.amaraA]);initial.migration.backendSource=backendSource;
      const raw=JSON.stringify(initial),{app}=await load({idbRaw:raw});
      assert.strictEqual(app.get("savedMode"),"protected","malformed or non-whitelisted authoritative provenance is protected");
      assert.strictEqual(savedRaw(app),raw,"recognized invalid provenance is not repaired or followed");
      assert.strictEqual(app.idb.operations.filter(x=>x.operation==="put").length,0,"application cannot write while authoritative provenance is malformed");
    }
    const stale=JSON.stringify(envelope([SV.portableRecords.amaraB]));
    const denied=await load({storage:{[SV_KEY]:stale},idbFault:{operation:"open",error:new Error("controlled IDB access denied")}});
    assert.strictEqual(denied.app.get("savedMode"),"protected","an attempted denied authoritative backend cannot masquerade as an absent collection");
    assert.ok(!names(denied.app).includes("PUBLIC PAN B"),"denied authority cannot automatically publish a stale localStorage recovery copy");
    assert.strictEqual(denied.app.store[SV_KEY],stale);
    assert.strictEqual(denied.app.idb.inspect(SV_KEY),undefined);

  });

  test("IDB4 U1: any own backendSource collision protects exact experimental source", async () => {
    for (const collision of [null, {key:SV_KEY,raw:"already-owned"}]) {
      const initial=envelope([SV.portableRecords.amaraA]);
      initial.migration.backendSource=collision;
      const raw=" "+JSON.stringify(initial)+"\n", origin=createOrigin(), fixture=idbFixtureRealm(origin,{[SV_KEY]:raw});
      // An existing empty supported DB avoids making absence depend on any
      // model-only inspection API. It has no committed current record.
      assert.deepStrictEqual(await idbRecord(fixture), {present:false, raw:undefined});
      const {app}=await load({origin,indexedDB:true,broadcastChannel:true,storage:{[SV_KEY]:raw}});
      assert.strictEqual(app.get("savedMode"), "protected", "initial import must not overwrite an unknown provenance property");
      assert.strictEqual(app.store[SV_KEY],raw);
      assert.deepStrictEqual(await idbRecord(fixture), {present:false, raw:undefined}, "collision leaves current uninitialized");
      assert.strictEqual(origin.successfulWrites.filter(x=>x.key===SV_KEY).length,0);
    }
    const initial=envelope([SV.portableRecords.amaraA]);
    const unknown={backendSource:{key:"__sv_untrusted_source__",raw:"prototype-looking data"}};
    Object.defineProperty(initial.migration,"__proto__",{value:unknown,enumerable:true});
    const raw=JSON.stringify(initial),{app}=await load({storage:{[SV_KEY]:raw}});
    assert.strictEqual(app.get("savedMode"),"durable","an own __proto__ JSON key cannot invent an own backendSource collision");
    const migrated=snapshot(app);
    assert.deepStrictEqual(migrated.migration.backendSource,{key:SV_KEY,raw});
    assert.strictEqual(Object.prototype.hasOwnProperty.call(migrated.migration,"__proto__"),true);
    assert.deepStrictEqual(migrated.migration.__proto__,unknown,"unknown prototype-looking JSON remains inert data");
    assert.strictEqual(app.store[SV_KEY],raw);

  });


  test("IDB5 U1: a hint during a completed held read triggers a trailing authoritative read", async () => {
    for (const dirty of [false,true]) {
      const origin=createOrigin({broadcastEvents:"manual"}), {app,fixture,initial}=await idbSeeded([SV.portableRecords.amaraA],{}, {origin});
      const peer=(await load({origin,indexedDB:true,broadcastChannel:true})).app;
      let interaction;
      if(dirty) {
        editSelected(app);rename(app,"TRAILING READ DRAFT");
        const name=app.els["scale-name"];name.selectionStart=2;name.selectionEnd=8;name.focus();
        app.els["scale-box"].scrollTop=27;
        interaction={name:name.value,start:name.selectionStart,end:name.selectionEnd,scroll:app.els["scale-box"].scrollTop,focus:app.activeId(),route:app.location.href};
      }
      assert.ok(app.idb && typeof app.idb.hold==="function", "precondition: reviewed model can delay a completed read event");
      app.idb.hold("complete");
      const readN=app.getAsync("reconcileSavedCollection()");
      try {
        const deadline=Date.now()+2000;
        while(!app.idb.pending("complete")) {
          assert.ok(Date.now()<deadline,"precondition: real read transaction reached completion before hint injection");
          await new Promise(resolve=>setImmediate(resolve));
        }
        const result=await command(peer,{type:"edit",collectionId:initial.collectionId,instanceId:iid(1),expectedRevision:1},SV.portableRecords.amaraB);
        assert.strictEqual(result.ok,true);
        assert.strictEqual(JSON.parse((await idbRecord(fixture)).raw).entries[0].record.o.name,"PUBLIC PAN B", "peer committed N+1 while old completion delivery was held");
        origin.flushBroadcastMessages();
      } finally {app.idb.release("complete");}
      await readN;
      const trailingDeadline=Date.now()+2000;
      let finalName;
      do {
        finalName=app.get(`savedEntries.get(${JSON.stringify(iid(1))})?.deck.name`);
        if(finalName==="PUBLIC PAN B") break;
        await new Promise(resolve=>setImmediate(resolve));
      } while(Date.now()<trailingDeadline);
      assert.strictEqual(finalName,"PUBLIC PAN B","the trailing hint publishes authoritative N+1 without another focus or command");
      if(dirty) {
        const name=app.els["scale-name"];
        assert.deepStrictEqual({name:name.value,start:name.selectionStart,end:name.selectionEnd,scroll:app.els["scale-box"].scrollTop,focus:app.activeId(),route:app.location.href},interaction,
          "trailing reconciliation preserves the complete working draft interaction");
        assert.strictEqual(app.sheetOpen(),true);
      } else assert.strictEqual(app.currentDeck().name,"PUBLIC PAN B","clean view reaches N+1 without another focus or command");
    }
  });


  /* Review regressions frozen against c512f95f before repair.
   * IDB6 fault: successful initialization connection escapes retirement.
   * IDB7 fault: failed reconciliation has no persistent visible recovery copy.
   * IDB8 fault: acknowledged initial publication failure silently shows fallback.
   * IDB9 fault: an initially absent experimental source is never monitored.
   */
  test("IDB6 U1: protected initialization closes its owned readable connection on temporary choice", async () => {
    const raw="{not-json",{app}=await load({idbRaw:raw});
    assert.strictEqual(app.get("savedMode"),"protected");
    assert.strictEqual(savedRaw(app),raw);
    assert.strictEqual(app.els["saved-temporary-use"].hidden,false);
    app.els["saved-temporary-use"].click();
    assert.strictEqual(app.get("savedMode"),"session");
    const operations=app.idb.operations;
    const opens=operations.filter(x=>x.operation==="open"&&x.db===SV_KEY).length;
    const closes=operations.filter(x=>x.operation==="close"&&x.db===SV_KEY).length;
    assert.ok(opens>0,"precondition: the app successfully inspected a present readable backend, not a denied open");
    assert.strictEqual(closes,opens,"every successfully opened owned connection is closed when protected authority is retired");
    assert.strictEqual(savedRaw(app),raw,"temporary recovery does not repair or delete malformed authority");
  });

  test("IDB7 U1: failed reconciliation visibly warns and preserves dirty interaction without promotion", async () => {
    for(const failure of ["open","read","malformed"]) {
      const {app,origin}=await seeded([SV.portableRecords.amaraA]);
      assert.strictEqual(app.els["saved-status"].hidden,true,"healthy durable view starts without recovery guidance");
      editSelected(app);rename(app,"RECOVERY DRAFT");
      const name=app.els["scale-name"],box=app.els["scale-box"];
      name.selectionStart=2;name.selectionEnd=7;box.scrollTop=29;name.focus();
      const before={name:name.value,start:name.selectionStart,end:name.selectionEnd,scroll:box.scrollTop,focus:app.activeId(),route:app.location.href,selection:plain(app.get("selection"))};
      if(failure==="malformed")await idbRecord(app,{write:true,value:"{not-json"});
      else {
        if(failure==="open") {
          // A real external versionchange retires the app's cached connection;
          // otherwise a configured open failure would never be exercised.
          const fixture=idbFixtureRealm(origin);
          await new Promise((resolve,reject)=>{
            const request=fixture.sandbox.indexedDB.open(SV_KEY,2);
            request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error("external upgrade blocked despite owned versionchange handler"));
            request.onsuccess=()=>{request.result.close();resolve();};
          });
          assert.strictEqual(app.get("savedDatabase"),null,"precondition: actual versionchange retired the owned connection before the injected open");
        }
        app.idb.fault(failure,new Error("controlled reconciliation "+failure),{once:true});
      }
      const raw=savedRaw(app),result=await app.getAsync("reconcileSavedCollection()");
      assert.strictEqual(result.ok,false,"precondition: the reconciliation operation actually failed");
      assert.strictEqual(app.els["saved-status"].textContent,SV.uiContract.copy.en.recovery,"read failure must show the existing persistent recovery guidance");
      assert.strictEqual(app.els["saved-status"].hidden,false,"recovery guidance is visible rather than only internal issue state");
      assert.strictEqual(app.get("savedMode"),"durable","reconciliation refusal cannot silently switch to temporary writes");
      assert.strictEqual(app.sheetOpen(),true);
      assert.deepStrictEqual({name:name.value,start:name.selectionStart,end:name.selectionEnd,scroll:box.scrollTop,focus:app.activeId(),route:app.location.href,selection:plain(app.get("selection"))},before);
      assert.strictEqual(savedRaw(app),raw,"reconciliation errors never modify committed authority");
    }
  });

  test("IDB8 U1: failed initial publication shows acknowledged-save guidance and reloads without allocation", async () => {
    const origin=createOrigin(),crypto=cryptoFixture(),source=JSON.stringify([SV.portableRecords.amaraA]);
    const app=boot({origin,indexedDB:true,broadcastChannel:true,locks:true,crypto,abortController:true,isSecureContext:true,storage:{"hpfc.scales.v3":source,hpfc:JSON.stringify({deck:"custom:977311b5"})}});
    // Existing replaceable lexical publication boundary: the transaction still
    // executes normally. No production test hook or counterfeit ACK is used.
    app.run(`{
      const original=applySavedSnapshot;globalThis.__initialPublicationFault=false;
      applySavedSnapshot=function(...args){
        if(args[2]==="initialization"&&!__initialPublicationFault){__initialPublicationFault=true;throw new Error("controlled initial publication failure");}
        return original.apply(this,args);
      };
    }`);
    await app.waitFor("typeof booted !== 'undefined' && booted === true",{timeout:2000});
    assert.strictEqual(app.get("globalThis.__initialPublicationFault"),true,"precondition: initial publication really failed after the normal durable commit");
    const raw=savedRaw(app),committed=JSON.parse(raw),draws=crypto.draws;
    assert.strictEqual(committed.entries[0].record.o.name,"PUBLIC PAN A","the initial transaction actually committed the source record");
    assert.strictEqual(app.els["saved-status"].textContent,"The save completed, but this view could not be refreshed. Reload to review your saved scales.","acknowledged initialization cannot silently display an unrelated fallback");
    assert.strictEqual(app.els["saved-status"].hidden,false);
    assert.strictEqual(app.get("savedMode"),"durable","publication failure does not undo the durable ACK");
    assert.strictEqual(app.store["hpfc.scales.v3"],source);
    const again=await load({origin,crypto});
    assert.strictEqual(again.app.currentDeck().name,"PUBLIC PAN A");
    assert.strictEqual(savedRaw(again.app),raw,"reload resumes the exact committed envelope");
    assert.strictEqual(crypto.draws,draws,"publication failure and reload never allocate a second identity");
  });

  test("IDB9 U1: a newly created experimental legacy branch warns without replaying over IDB", async () => {
    const source=JSON.stringify([SV.portableRecords.amaraA]),{app,origin}=await load({storage:{"hpfc.scales.v3":source,hpfc:JSON.stringify({deck:"custom:977311b5"})}});
    const before=savedRaw(app),committed=snapshot(app);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(committed.migration,"backendSource"),false,"normal migration captured absence of the experimental source");
    assert.strictEqual(app.store[SV_KEY],undefined);
    const late=JSON.stringify(envelope([SV.portableRecords.amaraB]));
    const writer=boot({origin,html:"<script>window.__olderExperimentalWriter=true;</script>"});
    writer.sandbox.localStorage.setItem(SV_KEY,late);origin.flushStorageEvents();
    assert.strictEqual(app.els["saved-status"].textContent,"An older app changed its saved scales. Those changes are kept separately for recovery.","a newly appearing experimental branch must be visible recovery evidence");
    assert.strictEqual(app.els["saved-status"].hidden,false);
    assert.strictEqual(savedRaw(app),before,"legacy notifications cannot replace authoritative IDB");
    assert.strictEqual(app.store[SV_KEY],late,"the late branch remains exact and separate");
    assert.strictEqual(app.store["hpfc.scales.v3"],source);
    assert.strictEqual(app.currentDeck().name,"PUBLIC PAN A");
    assert.ok(!names(app).includes("PUBLIC PAN B"),"branch detection does not import or replay the late client collection");
  });


  test("IDB11 U1: direct and concurrent removals never empty the collection", async () => {
    const allHidden=["kurd","amara10","amara","hijaz","pygmy"];
    const refuseLast=result=>{
      assert.strictEqual(result.ok,false,"the direct command cannot remove the final visible scale");
      assert.strictEqual(result.kind,"invalid");assert.strictEqual(result.detail,"last-visible");
    };
    // Bypass UI wouldEmpty guards: the transactional command boundary itself
    // must refuse removing the last saved scale or hiding the last built-in.
    const lastSaved=await seeded([SV.portableRecords.amaraA],{hidden:allHidden});
    const savedBefore=savedRaw(lastSaved.app);
    refuseLast(await command(lastSaved.app,{type:"delete",collectionId:SV.ids.collectionA,instanceId:iid(1),expectedRevision:1}));
    assert.strictEqual(savedRaw(lastSaved.app),savedBefore,"refused last-saved removal preserves exact committed bytes");
    assert.strictEqual(snapshot(lastSaved.app).entries.length,1);
    const lastBuiltin=await seeded([],{hidden:["amara10","amara","hijaz","pygmy"]});
    const builtinBefore=savedRaw(lastBuiltin.app);
    refuseLast(await command(lastBuiltin.app,{type:"hide-builtin",collectionId:SV.ids.collectionA,seedId:"kurd",expectedSlotStateRevision:0,expectedOwnerId:null}));
    assert.strictEqual(savedRaw(lastBuiltin.app),builtinBefore,"refused last-builtin removal preserves exact committed bytes");
    assert.deepStrictEqual(snapshot(lastBuiltin.app).hidden,["amara10","amara","hijaz","pygmy"]);

    const origin=createOrigin({events:"omit",broadcastEvents:"omit"});
    const {app,crypto}=await seeded([SV.portableRecords.amaraA,SV.portableRecords.amaraB],{hidden:allHidden},{origin});
    const peer=(await load({origin,crypto})).app;
    const initial=snapshot(app);let release,acquired;
    const held=new Promise(resolve=>{acquired=resolve;});
    const blocker=app.sandbox.navigator.locks.request(SV_LOCK,()=>{acquired();return new Promise(resolve=>{release=resolve;});});
    await held;let pending;
    try {
      pending=[command(app,{type:"delete",collectionId:initial.collectionId,instanceId:iid(1),expectedRevision:1}),
        command(peer,{type:"delete",collectionId:initial.collectionId,instanceId:iid(2),expectedRevision:1})];
      await app.waitFor(`navigator.locks.query().then(q=>q.pending.filter(x=>x.name===${JSON.stringify(SV_LOCK)}).length===2)`);
      const queue=await app.sandbox.navigator.locks.query();
      assert.strictEqual(queue.held.filter(x=>x.name===SV_LOCK).length,1);
      assert.strictEqual(queue.pending.filter(x=>x.name===SV_LOCK).length,2,"both distinct direct deletions stage before either can acquire the commit lock");
      assert.deepStrictEqual(snapshot(app),initial,"neither pending deletion has committed before release");
    }finally{release();await blocker;await Promise.allSettled(pending||[]);}
    const results=await Promise.all(pending),accepted=results.findIndex(result=>result.ok);
    assert.strictEqual(results.filter(result=>result.ok).length,1,"only one concurrent removal may be acknowledged");
    refuseLast(results.find(result=>!result.ok));
    const committed=snapshot(app),expectedRemaining=accepted===0?iid(2):iid(1);
    assert.strictEqual(committed.entries.length,1,"actual committed authority retains one visible saved scale");
    assert.strictEqual(committed.entries[0].instanceId,expectedRemaining);
    assert.deepStrictEqual(committed.entries[0],initial.entries.find(entry=>entry.instanceId===expectedRemaining));
    assert.strictEqual(committed.revision,initial.revision+1);
    assert.deepStrictEqual(committed.hidden,allHidden);
    assert.deepStrictEqual(committed.usedInstanceIds,initial.usedInstanceIds);
    assert.strictEqual(committed.nextDisplayOrdinal,initial.nextDisplayOrdinal);
  });


  test("IDB12 U1: saved-scale temporary and durable workflows preserve own-property behavior without Object.hasOwn", async () => {
    const hostHasOwn=Object.hasOwn,source=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
    const seed="(D3) A3 C4 D4 E4 F4 G4 A4 C5";
    const checkLink=(app,name)=>{
      const shared=plain(app.get("shareLink(deck())"));assert.strictEqual(shared.ok,true);
      assert.ok(shared.value.includes("#s=6/"),"a usable portable link is generated");
      const code=shared.value.split("#s=")[1];
      const decoded=plain(app.get(`HPE.share.decode(${JSON.stringify(code)})`));
      assert.strictEqual(decoded.ok,true);assert.strictEqual(decoded.value.options.name,name);
    };
    // The first iteration is a normal-API positive control for these same
    // workflows. The prefix changes only the application's VM intrinsic.
    for(const missing of [false,true]) {
      const html=(missing?"<script>Object.hasOwn=undefined;</script>":"")+source;
      const context=missing?"missing Object.hasOwn":"normal Object.hasOwn";
      let temporary;
      assert.doesNotThrow(()=>{temporary=boot({html});},context+": ordinary temporary startup must not throw");
      assert.strictEqual(Object.hasOwn,hostHasOwn,"the host intrinsic remains untouched");
      assert.strictEqual(temporary.get("typeof Object.hasOwn"),missing?"undefined":"function");
      assert.strictEqual(temporary.get("booted"),true);assert.strictEqual(temporary.get("savedMode"),"session");
      await assert.doesNotReject(async()=>{await makeCustom(temporary,seed);},context+": temporary Add completes");
      assert.strictEqual(plain(temporary.get("savedState.entries"))[0].record.s,seed);
      editSelected(temporary);rename(temporary,"COMPAT TEMP EDIT");
      await assert.doesNotReject(()=>submit(temporary),context+": temporary Edit completes");
      assert.strictEqual(temporary.sheetOpen(),false);assert.strictEqual(temporary.currentDeck().name,"COMPAT TEMP EDIT");
      checkLink(temporary,"COMPAT TEMP EDIT");

      const origin=createOrigin();let durable;
      assert.doesNotThrow(()=>{durable=boot({origin,html,indexedDB:true,broadcastChannel:true,locks:true,crypto:cryptoFixture(),abortController:true,isSecureContext:true});},context+": durable script startup must not throw");
      await assert.doesNotReject(()=>durable.getAsync("savedReady"),context+": actual durable initialization must resolve");
      assert.strictEqual(durable.get("booted"),true);assert.strictEqual(durable.get("savedMode"),"durable");
      assert.strictEqual(durable.get("typeof Object.hasOwn"),missing?"undefined":"function");
      const initialized=await idbRecord(durable);assert.strictEqual(initialized.present,true);
      assert.deepStrictEqual(JSON.parse(initialized.raw).entries,[],"ordinary initialization commits an empty supported collection");
      let added;
      await assert.doesNotReject(async()=>{added=await imported(durable,SV.portableRecords.amaraA);},context+": durable import resolves");
      assert.strictEqual(added.ok,true);assert.strictEqual(added.persistence,"durable");
      const afterAdd=JSON.parse((await idbRecord(durable)).raw);
      assert.strictEqual(afterAdd.entries.length,1);assert.strictEqual(afterAdd.entries[0].instanceId,added.instanceId);
      assert.strictEqual(afterAdd.entries[0].record.o.name,"PUBLIC PAN A");
      editSelected(durable);rename(durable,"COMPAT DURABLE EDIT");
      await assert.doesNotReject(()=>submit(durable),context+": durable Edit resolves");
      assert.strictEqual(durable.sheetOpen(),false);
      const edited=JSON.parse((await idbRecord(durable)).raw);
      assert.strictEqual(edited.entries[0].instanceId,added.instanceId);
      assert.strictEqual(edited.entries[0].record.o.name,"COMPAT DURABLE EDIT");
      checkLink(durable,"COMPAT DURABLE EDIT");

      // An own JSON __proto__ value and a shadowing hasOwnProperty value are
      // inert future data; they must survive a real commit without becoming
      // prototype authority or breaking the intrinsic-based ownership check.
      const unknown={name:"UNTRUSTED PROTOTYPE NAME",keep:[null,17]};
      Object.defineProperty(edited.entries[0].record.o,"__proto__",{value:unknown,enumerable:true});
      edited.entries[0].record.o.hasOwnProperty="not a method";
      edited.entries[0].hasOwnProperty="also inert";
      edited.revision++;edited.entries[0].revision++;
      await idbRecord(durable,{write:true,value:JSON.stringify(edited)});
      assert.strictEqual((await durable.getAsync("reconcileSavedCollection()")).ok,true);
      editSelected(durable);rename(durable,"COMPAT OWN DATA");
      await assert.doesNotReject(()=>submit(durable),context+": Edit with prototype-looking JSON resolves");
      assert.strictEqual(durable.sheetOpen(),false);
      const final=JSON.parse((await idbRecord(durable)).raw);
      assert.strictEqual(final.entries[0].record.o.name,"COMPAT OWN DATA");
      assert.strictEqual(Object.prototype.hasOwnProperty.call(final.entries[0].record.o,"__proto__"),true);
      assert.deepStrictEqual(final.entries[0].record.o.__proto__,unknown);
      assert.strictEqual(final.entries[0].record.o.hasOwnProperty,"not a method");
      assert.strictEqual(final.entries[0].hasOwnProperty,"also inert");
      assert.strictEqual(durable.get("({}).name"),undefined,"prototype-looking data does not pollute the app realm");
      checkLink(durable,"COMPAT OWN DATA");
      const ownership=plain(durable.get(`(() => {
        const input=${JSON.stringify(final)};
        const valid=Object.assign(Object.create(null),input);
        valid.entries=input.entries.map(row=>Object.assign(Object.create(null),row));
        valid.migration=Object.assign(Object.create(null),input.migration);
        valid.migration.raw=Object.assign(Object.create(null),input.migration.raw);
        const nullPrototype=stageSavedEnvelope(valid).ok;
        const inheritedRow=JSON.parse(${JSON.stringify(JSON.stringify(final))});
        const record=inheritedRow.entries[0].record;delete inheritedRow.entries[0].record;
        Object.setPrototypeOf(inheritedRow.entries[0],{record});
        const inheritedRecord=stageSavedEnvelope(inheritedRow).ok;
        const inheritedRaw=JSON.parse(${JSON.stringify(JSON.stringify(final))});
        delete inheritedRaw.migration.raw['hpfc.scales.v3'];
        Object.setPrototypeOf(inheritedRaw.migration.raw,{'hpfc.scales.v3':null});
        return {nullPrototype,inheritedRecord,inheritedRaw:stageSavedEnvelope(inheritedRaw).ok};
      })()`));
      assert.deepStrictEqual(ownership,{nullPrototype:true,inheritedRecord:false,inheritedRaw:false},context+": valid own fields work without prototypes while inherited required fields are refused");
      assert.strictEqual(durable.store[SV_KEY],undefined,"compatibility does not introduce a localStorage mirror");
      assert.strictEqual(Object.hasOwn,hostHasOwn,"all compatibility cases leave the host intrinsic intact");
      console.log("IDB12_PATH "+(missing?"missing-primitive":"normal-primitive")+" assertions complete");
    }
  });

  test("SV17 U1: preference acknowledgments and unchanged rereads preserve chip nodes while collection changes remain visible", async () => {
    const {app}=await seeded([SV.portableRecords.amaraA,SV.portableRecords.amaraB]);
    const nodes=()=>[...app.els.decks.children];
    const ids=()=>nodes().map(chip=>chip.getAttribute("data-selection-id"));
    const unchanged=(before,label)=>{
      const after=nodes();assert.strictEqual(after.length,before.length,label+": chip count");
      after.forEach((node,i)=>assert.ok(node===before[i],label+": an existing pointer target must retain its identity"));
    };
    const rebuilt=(before,label)=>{
      assert.ok(nodes().length>0,label+": controls remain available");
      assert.notStrictEqual(nodes()[0],before[0],label+": changed collection controls are refreshed");
    };
    const initial=nodes(),local=plain(app.get("selection"));
    const preferred=await command(app,{type:"prefer",collectionId:snapshot(app).collectionId,selection:{kind:"builtin",id:"amara"}});
    assert.strictEqual(preferred.ok,true);assert.strictEqual(preferred.persistence,"durable");
    assert.deepStrictEqual(snapshot(app).preferredSelection,{kind:"builtin",id:"amara"});
    assert.deepStrictEqual(plain(app.get("selection")),local,"persisted preference cannot hijack the current instrument");
    unchanged(initial,"actual preference acknowledgment");
    assert.strictEqual((await app.getAsync("reconcileSavedCollection()")).ok,true);
    unchanged(initial,"unchanged authoritative reread");

    let before=nodes(),e=snapshot(app);
    const changed={...copy(SV.portableRecords.amaraA),o:{...copy(SV.portableRecords.amaraA.o),name:"RENAMED PAN A"}};
    assert.strictEqual((await command(app,{type:"edit",collectionId:e.collectionId,instanceId:iid(1),expectedRevision:1},changed)).ok,true);
    rebuilt(before,"changed selected record");assert.strictEqual(app.currentDeck().name,"RENAMED PAN A");
    assert.ok(names(app).includes("RENAMED PAN A"),"the renamed instrument has its new visible label");

    before=nodes();
    const third={v:4,s:SV.inventories.other.seed,o:{name:"PUBLIC PAN B"}};
    const added=await imported(app,third);assert.strictEqual(added.ok,true);
    rebuilt(before,"new lifetime ordinal");
    assert.strictEqual(snapshot(app).entries.find(row=>row.instanceId===added.instanceId).displayOrdinal,3);
    assert.ok(names(app).some(label=>label.endsWith(" / S3")),"a new colliding label exposes its literal new ordinal");

    // A supported external snapshot may change entry order without changing
    // identities or their immutable ordinal/history assignments.
    before=nodes();e=snapshot(app);e.entries.reverse();e.revision++;
    await idbRecord(app,{write:true,value:JSON.stringify(e)});
    assert.strictEqual((await app.getAsync("reconcileSavedCollection()")).ok,true);
    rebuilt(before,"changed authoritative entry order");
    assert.deepStrictEqual(ids().slice(0,3),[iid(1),iid(2),added.instanceId],"the externally reordered saved controls appear in their literal order");

    before=nodes();e=snapshot(app);
    const replacement=await command(app,{type:"replace-builtin",collectionId:e.collectionId,seedId:"kurd",expectedSlotStateRevision:e.slotStateRevision,expectedOwnerId:null},
      {v:4,s:SV.inventories.other.seed,o:{name:"PUBLIC SEEDED REPLACEMENT"}});
    assert.strictEqual(replacement.ok,true);rebuilt(before,"changed seeded slot");
    assert.strictEqual(snapshot(app).slots.kurd,replacement.instanceId);
    assert.ok(ids().includes(replacement.instanceId));assert.ok(!ids().includes("kurd"),"replacement occupies the preset's visible slot");

    before=nodes();e=snapshot(app);
    assert.strictEqual((await command(app,{type:"hide-builtin",collectionId:e.collectionId,seedId:"hijaz",expectedSlotStateRevision:e.slotStateRevision,expectedOwnerId:null})).ok,true);
    rebuilt(before,"changed hidden presets");assert.ok(!ids().includes("hijaz"));

    before=nodes();e=snapshot(app);e.collectionId=SV.ids.collectionB;e.revision++;
    await idbRecord(app,{write:true,value:JSON.stringify(e)});
    assert.strictEqual((await app.getAsync("reconcileSavedCollection()")).ok,true);
    rebuilt(before,"changed collection epoch");assert.strictEqual(app.get("savedState.collectionId"),SV.ids.collectionB);

    // Delete a genuinely selected plain instance through the normal command.
    await app.getAsync(`selectDeck({kind:"saved",id:${JSON.stringify(iid(1))}},false)`);
    before=nodes();e=snapshot(app);
    const row=e.entries.find(entry=>entry.instanceId===iid(1));
    assert.strictEqual((await command(app,{type:"delete",collectionId:e.collectionId,instanceId:row.instanceId,expectedRevision:row.revision})).ok,true);
    rebuilt(before,"resolved selection after deletion");
    assert.deepStrictEqual(plain(app.get("selection")),{kind:"saved",id:replacement.instanceId},"deleted selection resolves to the surviving seeded replacement");
    assert.strictEqual(nodes().find(chip=>chip.classList.contains("on")).getAttribute("data-selection-id"),replacement.instanceId);
    assert.ok(!ids().includes(iid(1)),"the removed target cannot remain visible");
  });

}

test("NS1: About links underline at 1.5px and 2.5px on hover, like the scale pages", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const rest = /#about a\{([^}]*)\}/.exec(html);
  assert.ok(rest, "no #about a rule");
  assert.match(rest[1], /text-decoration-thickness:\s*1\.5px/);
  assert.match(rest[1], /text-underline-offset:\s*3px/);
  assert.match(html, /#about a:hover\{\s*text-decoration-thickness:\s*2\.5px/);
});

describe("NS: native share", () => {
  const PAGE = "https://example.test/index.html";
  const flush = () => new Promise((r) => setImmediate(r));
  const json = (v) => JSON.parse(JSON.stringify(v));
  const i18n = (code) => JSON.parse(fs.readFileSync(path.join(ROOT, "data", "i18n", code + ".json"), "utf8"));
  const named = (name) => { const e = new Error(name); e.name = name; return e; };
  const shareable = (opts = {}) => {
    const app = boot({ href: PAGE, ...opts });
    coarse(app);
    const calls = [];
    app.sandbox.navigator.share = (payload) => { calls.push(json(payload)); return Promise.resolve(); };
    return { app, calls };
  };
  const tap = async (app) => { app.els["share-copy"].click(); await flush(); app.flushTimers(); };
  const shareEvents = (app) => json(Array.from(app.get("window.dataLayer"))).filter((e) => e[0] === "event" && e[1] === "share_copy");

  test("NS 1: coarse pointer with navigator.share calls share once with exactly {url} inside the tap and leaves the clipboard alone", async () => {
    const { app, calls } = shareable();
    let written = 0;
    app.sandbox.navigator.clipboard = { writeText: async () => { written++; } };
    app.els["share-copy"].click();
    assert.deepStrictEqual(calls, [{ url: app.location.href }], "share was not called synchronously with exactly {url}");
    await flush(); app.flushTimers();
    assert.strictEqual(written, 0);
    assert.strictEqual(app.announcer().textContent, "LINK SHARED");
  });

  test("NS 2: AbortError is silent: no clipboard write, no reveal, no share_copy", async () => {
    const app = boot({ html: withGaId("G-TEST123456"), webdriver: false, href: PAGE });
    coarse(app);
    let written = 0;
    app.sandbox.navigator.clipboard = { writeText: async () => { written++; } };
    app.sandbox.navigator.share = () => Promise.reject(named("AbortError"));
    const before = app.announcer().textContent;
    await tap(app);
    assert.strictEqual(written, 0);
    assert.strictEqual(app.announcer().textContent, before);
    assert.strictEqual(app.els["share-url"].hasAttribute("hidden"), true);
    assert.deepStrictEqual(shareEvents(app), []);
  });

  test("NS 3: NotAllowedError falls to the clipboard: LINK COPIED, method clipboard", async () => {
    const app = boot({ html: withGaId("G-TEST123456"), webdriver: false, href: PAGE });
    coarse(app);
    const written = [];
    app.sandbox.navigator.clipboard = { writeText: async (u) => { written.push(u); } };
    app.sandbox.navigator.share = () => Promise.reject(named("NotAllowedError"));
    await tap(app);
    assert.deepStrictEqual(written, [app.location.href]);
    assert.strictEqual(app.announcer().textContent, "LINK COPIED");
    assert.deepStrictEqual(shareEvents(app).map((e) => e[2]), [{ deck_kind: "seeded", method: "clipboard" }]);
  });

  test("NS 4: share rejects then the clipboard rejects: the field is revealed with share.select, in en and ja", async () => {
    for (const lang of ["en", "ja"]) {
      const { app } = shareable();
      if (lang !== "en") app.run(`setLang(${JSON.stringify(lang)})`);
      app.sandbox.navigator.share = () => Promise.reject(named("NotAllowedError"));
      app.sandbox.navigator.clipboard = { writeText: async () => { throw new Error("denied"); } };
      app.els["share-url"].select = () => {};
      await tap(app);
      assert.strictEqual(app.els["share-url"].hasAttribute("hidden"), false);
      assert.strictEqual(app.announcer().textContent, i18n(lang)["share.select"]);
    }
  });

  test("NS 5: a tap while a share is pending does nothing, and every settle path unlocks the button", async () => {
    for (const outcome of ["resolve", "abort", "other"]) {
      const app = boot({ href: PAGE });
      coarse(app);
      app.sandbox.navigator.clipboard = { writeText: async () => {} };
      const pending = [];
      app.sandbox.navigator.share = () => new Promise((resolve, reject) => pending.push({ resolve, reject }));
      app.els["share-copy"].click();
      app.els["share-copy"].click();
      await flush();
      assert.strictEqual(pending.length, 1, "a second tap reached navigator.share");
      if (outcome === "resolve") pending[0].resolve();
      if (outcome === "abort") pending[0].reject(named("AbortError"));
      if (outcome === "other") pending[0].reject(named("InvalidStateError"));
      await flush(); app.flushTimers();
      app.els["share-copy"].click();
      await flush();
      assert.strictEqual(pending.length, 2, outcome + " left the button locked");
    }
  });

  test("NS 6: a fine pointer with navigator.share copies and never opens the sheet", async () => {
    const app = boot({ href: PAGE });
    coarse(app, false);
    const written = [];
    let shared = 0;
    app.sandbox.navigator.clipboard = { writeText: async (u) => { written.push(u); } };
    app.sandbox.navigator.share = async () => { shared++; };
    await tap(app);
    assert.deepStrictEqual(written, [app.location.href]);
    assert.strictEqual(shared, 0);
  });

  test("NS 7: no share uses the clipboard, neither reveals, and canShare false uses the clipboard", async () => {
    const a = boot({ href: PAGE });
    coarse(a);
    const written = [];
    a.sandbox.navigator.clipboard = { writeText: async (u) => { written.push(u); } };
    delete a.sandbox.navigator.share;
    await tap(a);
    assert.deepStrictEqual(written, [a.location.href]);

    const b = boot({ href: PAGE });
    coarse(b);
    delete b.sandbox.navigator.clipboard;
    delete b.sandbox.navigator.share;
    b.els["share-url"].select = () => {};
    await tap(b);
    assert.strictEqual(b.els["share-url"].hasAttribute("hidden"), false);

    const c = boot({ href: PAGE });
    coarse(c);
    let shared = 0;
    const cw = [];
    c.sandbox.navigator.share = async () => { shared++; };
    c.sandbox.navigator.canShare = () => false;
    c.sandbox.navigator.clipboard = { writeText: async (u) => { cw.push(u); } };
    await tap(c);
    assert.strictEqual(shared, 0);
    assert.deepStrictEqual(cw, [c.location.href]);
  });

  test("NS 8: label and glyph follow the share state and survive a language change", async () => {
    const { app } = shareable();
    app.run("paintShare()");
    const btn = app.els["share-copy"];
    assert.strictEqual(btn.getAttribute("aria-label"), i18n("en")["header.share"]);
    assert.match(btn.innerHTML, /glyph-share/);
    assert.ok(!/rotate\(-45/.test(btn.innerHTML));
    for (const code of ["ja", "de", "zh-Hant"]) {
      app.run(`setLang(${JSON.stringify(code)})`);
      assert.strictEqual(btn.getAttribute("aria-label"), i18n(code)["header.share"], code);
    }
    app.run('setLang("en")');
    delete app.sandbox.navigator.share;
    app.run("paintShare()");
    assert.strictEqual(btn.getAttribute("aria-label"), i18n("en")["header.share_copy"]);
    assert.ok(!/glyph-share/.test(btn.innerHTML), "the share glyph stayed");
    app.run('setLang("ja")');
    assert.strictEqual(btn.getAttribute("aria-label"), i18n("ja")["header.share_copy"]);
  });

  test("NS 9: share_copy carries only deck_kind and method, method in clipboard|share|select", async () => {
    const methods = new Set();
    for (const mode of ["share", "clipboard", "select"]) {
      const app = boot({ html: withGaId("G-TEST123456"), webdriver: false, href: PAGE });
      coarse(app, mode === "share");
      if (mode === "share") app.sandbox.navigator.share = async () => {};
      else delete app.sandbox.navigator.share;
      if (mode === "select") delete app.sandbox.navigator.clipboard;
      else app.sandbox.navigator.clipboard = { writeText: async () => {} };
      app.els["share-url"].select = () => {};
      await tap(app);
      const ev = shareEvents(app);
      assert.strictEqual(ev.length, 1, mode);
      assert.deepStrictEqual(Object.keys(ev[0][2]).sort(), ["deck_kind", "method"]);
      methods.add(ev[0][2].method);
    }
    assert.deepStrictEqual([...methods].sort(), ["clipboard", "select", "share"]);
  });

  test("NS 10: header.share exists in all eight tables", async () => {
    for (const code of ["en", "de", "es", "fr", "it", "ja", "zh-Hans", "zh-Hant"]) {
      const v = i18n(code)["header.share"];
      assert.ok(typeof v === "string" && v.length > 0, code);
    }
  });
});

/* ---- Neotone lane U: Standard | Paired areas on the Layout tab ----
 * Profile scales save as v5 records and share as v7 links. A profile record
 * never carries `replaces` (owner rule I1), so a profile SAVE on a seeded scale
 * is a separate custom entry and never a slot owner. */
describe("NEO: Neotone sheet, saves and links", () => {
  const EN = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "i18n", "en.json"), "utf8"));
  const BOTTOM_AMARA = "[B2] [C3] (D3) A3 C4 D4 E4 F4 G4 A4 C5";
  const TOP_PYGMY = "[C3] [Db3] [Eb3] (F3) G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 F5 G5 [Ab5]";
  const OWNER = "00000000-0000-4000-8000-000000000001";
  const entries = (app) => savedEnvelope(app).entries;
  const goLayout = (app) => app.click(app.els["scale-tab-layout"]);
  const openNeo = (app, text = AMARA_STRING) => {
    openSheet(app);
    app.type(text);
    app.els["scale-neotone"].checked = true;
    app.els["scale-neotone"].onchange();
  };
  const map = (app) => plain(app.get("editorSession.history.present.options.profile.map"));
  const nhits = (app) => [...String(app.els["scale-preview"].innerHTML || "").matchAll(/<circle class="nhit"[^>]*\/>/g)].map((m) => m[0]);
  const profileOf = (app, text, extra = {}) => plain(app.get(`(() => {
    const s = HPE.core.parseSeed(${JSON.stringify(text)});
    const p = HPE.layout.proposeProfile(s.value.fields);
    return { palette: 1, ...${JSON.stringify(extra)}, profile: { id: "paired", rev: 2, map: p.value.map } };
  })()`));
  const openBuiltin = (app, id) => {
    const d = decks(app).find((x) => x.id === id);
    app.select(d.id);
    app.clickChip(d.name);
    return d;
  };
  const nnFire = (app, id, type) => app.els[id].dispatchEvent({ type });
  const nnType = (app, k, text) => {
    nnFire(app, "scale-" + k, "focus");
    app.els["scale-" + k].value = text;
    nnFire(app, "scale-" + k, "input");
  };
  const nnSettle = (app, k) => nnFire(app, "scale-" + k, "blur");



  const AMARA_LINE_OF = (app) => app.els["scale-box"].value;



  const PYGMY_INNER = "[C3] [Db3] [Eb3] F3 | G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 | F5 G5 [Ab5]";
  const demoSlots = (app) => plain(app.get("shownMap()")).map((k, i) => (k !== null && map(app)[i] === null ? i : -1)).filter((i) => i !== -1);
  const M1_TEXT = "Neotone has 9 main tonefields. Inner notes F5 and G5 have no tonefield: remove them to save.";



  const aria = (app, slot) => (nhits(app).find((h) => h.includes(`data-slot="${slot}"`)).match(/aria-label="([^"]*)"/) || [])[1];
  const pygmyNeo = async () => {
    const app = await durableBoot();
    openBuiltin(app, "pygmy");
    app.els["scale-neotone"].checked = true;
    app.els["scale-neotone"].onchange();
    goLayout(app);
    return app;
  };








  const NEO_SLOT_LAST = (app) => app.get("NEO_MAIN") + 8;





  test("NEO10: a Neotone SAVE on a seeded scale writes a v5 rev 2 record as a separate entry with no replaces", async () => {
    const app = await durableBoot();
    openBuiltin(app, "amara");
    app.els["scale-neotone"].checked = true;
    app.els["scale-neotone"].onchange();
    await generateClick(app);
    await writeBarrier(app);
    const env = savedEnvelope(app);
    assert.strictEqual(env.entries.length, 1);
    const r = env.entries[0].record;
    assert.strictEqual(r.v, 5);
    assert.strictEqual(r.o.profile.id, "paired");
    assert.strictEqual(r.o.profile.rev, 2);
    assert.strictEqual(r.o.profile.map.length, 18);
    for (const name of ["mirror", "mirrorBottom", "anchor", "seats", "angles", "replaces"]) assert.strictEqual(name in r.o, false, name);
    assert.deepStrictEqual(env.slots, {});
    assert.deepStrictEqual(env.hidden, []);
    assert.ok(app.currentDeck().geom.place, "the saved scale is placed by tonefield");
    assert.ok(decks(app).some((d) => d.id === "amara"), "the built-in is still listed");
  });

  test("NEO11: a typed Neotone scale saves a v5 rev 2 record and its link is v7", async () => {
    const app = await durableBoot();
    openNeo(app);
    await generateClick(app);
    await writeBarrier(app);
    const r = entries(app)[0].record;
    assert.strictEqual(r.v, 5);
    assert.strictEqual(r.o.profile.rev, 2);
    const link = plain(app.get(`shareLink(savedEntries.get(selection.id).deck)`));
    assert.strictEqual(link.ok, true);
    assert.match(link.value, /#s=7\//);
  });

  test("NEO12: editing a Neotone scale opens in Neotone, a rearrangement keeps v5, and Standard rewrites in place as v4 with the same handle", async () => {
    const app = await durableBoot();
    openNeo(app, BOTTOM_AMARA);
    await generateClick(app);
    await writeBarrier(app);
    const handle = entries(app)[0].instanceId;
    openEdit(app, { ...app.currentDeck(), instanceId: handle });
    assert.strictEqual(app.get("neotoneOn()"), true, "an edit of a profile scale opens in Neotone");
    assert.strictEqual(app.els["scale-neotone"].checked, true);
    app.run("editorDo((m) => editorNeoMove(m, 0, 1))");
    const moved = map(app);
    await generateClick(app);
    await writeBarrier(app);
    let rows = entries(app);
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].record.v, 5);
    assert.deepStrictEqual(rows[0].record.o.profile.map, moved);
    openEdit(app, { ...app.currentDeck(), instanceId: handle });
    app.els["scale-neotone"].checked = false;
    app.els["scale-neotone"].onchange();
    await generateClick(app);
    await writeBarrier(app);
    rows = entries(app);
    assert.strictEqual(rows.length, 1, "rewritten in place");
    assert.strictEqual(rows[0].instanceId, handle, "same local handle");
    assert.strictEqual(rows[0].record.v, 4);
    assert.strictEqual("profile" in rows[0].record.o, false);
  });

  test("NEO13: a slot-owning replacement edited into Neotone saves a separate entry and keeps the owner byte-identical", async () => {
    const record = { v: 4, s: AMARA_STRING, o: { name: "MY AMARA", palette: 2, replaces: "amara" } };
    const env = {
      schema: 1, collectionId: "00000000-0000-4000-8000-00000000000a", revision: 1, slotStateRevision: 1,
      entries: [{ instanceId: OWNER, revision: 1, displayOrdinal: 1, record }],
      usedInstanceIds: [OWNER], nextDisplayOrdinal: 2,
      preferredSelection: { kind: "saved", id: OWNER },
      slots: { amara: OWNER }, hidden: [],
      migration: { sourceKey: null, raw: { hpfc: null, "hpfc.scales": null, "hpfc.scales.v3": null }, instanceIds: [] },
    };
    const app = await durableBoot({ idbRaw: JSON.stringify(env) });
    openEdit(app, { ...app.currentDeck(), instanceId: app.get("selection.id") });
    app.els["scale-neotone"].checked = true;
    app.els["scale-neotone"].onchange();
    await generateClick(app);
    await writeBarrier(app);
    const after = savedEnvelope(app);
    assert.strictEqual(after.entries.length, 2);
    const owner = after.entries.find((e) => e.instanceId === OWNER);
    assert.deepStrictEqual(owner.record, record);
    assert.deepStrictEqual(after.slots, { amara: OWNER });
    const added = after.entries.find((e) => e !== owner);
    assert.strictEqual(added.record.v, 5);
    assert.strictEqual("replaces" in added.record.o, false);
  });

  test("NEO14: a stored rev 1 record keeps its bytes until saved, opens in Neotone, and a SAVE writes rev 2", async () => {
    const probe = boot();
    const rev1 = profileOf(probe, AMARA_STRING);
    rev1.profile.rev = 1;
    const record = { v: 5, s: AMARA_STRING, o: rev1 };
    const env = {
      schema: 1, collectionId: "00000000-0000-4000-8000-00000000000a", revision: 1, slotStateRevision: 1,
      entries: [{ instanceId: OWNER, revision: 1, displayOrdinal: 1, record }],
      usedInstanceIds: [OWNER], nextDisplayOrdinal: 2,
      preferredSelection: { kind: "saved", id: OWNER },
      slots: {}, hidden: [],
      migration: { sourceKey: null, raw: { hpfc: null, "hpfc.scales": null, "hpfc.scales.v3": null }, instanceIds: [] },
    };
    const app = await durableBoot({ idbRaw: JSON.stringify(env) });
    assert.ok(app.currentDeck().geom.place, "a readable rev 1 profile renders Neotone");
    assert.deepStrictEqual(savedEnvelope(app).entries[0].record, record, "boot rewrote nothing");
    openEdit(app, { ...app.currentDeck(), instanceId: OWNER });
    assert.strictEqual(app.get("neotoneOn()"), true);
    assert.deepStrictEqual(savedEnvelope(app).entries[0].record, record, "opening Edit rewrote nothing");
    app.els["scale-name"].value = "RENAMED";
    app.run("editorCommitName()");
    await generateClick(app);
    await writeBarrier(app);
    assert.strictEqual(savedEnvelope(app).entries[0].record.o.profile.rev, 2);
  });



  test("NEO17: the sheet footer order is Cancel (BACK) then SAVE, and no Option A string is shown", async () => {
    const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    const foot = html.slice(html.indexOf('id="scale-foot"'));
    assert.ok(foot.indexOf('id="scale-delete"') === -1 || foot.indexOf('id="scale-generate"') !== -1);
    for (const gone of ["Paired areas", "PAIRED AREAS", "area", "zigzag"]) {
      const body = html.slice(0, html.indexOf("const I18N")).replace(/<!--[\s\S]*?-->/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "");
      const visible = body.replace(/<[^>]*>/g, " ");
      assert.ok(!new RegExp(gone === "area" ? "\\barea\\b" : gone).test(visible), gone + " is visible in the served text");
    }
  });

  test("NEO18: readSavedRecord and savedCandidate accept rev 2 profile records and refuse the malformed pairings", async () => {
    const app = boot();
    const base = profileOf(app, AMARA_STRING);
    const ok = (record) => app.get(`readSavedRecord(${JSON.stringify(record)}).ok`);
    assert.strictEqual(ok({ v: 5, s: AMARA_STRING, o: base }), true);
    assert.strictEqual(ok({ v: 5, s: AMARA_STRING, o: { ...base, replaces: "amara" } }), false);
    assert.strictEqual(ok({ v: 5, s: AMARA_STRING, o: { palette: 1 } }), false, "v5 without a profile");
    assert.strictEqual(ok({ v: 4, s: AMARA_STRING, o: base }), false, "v4 carrying a profile");
  });

  test("NEO19: a v7 link decodes to a Neotone scale, a Standard scale still shares as a v6 link, and the map joins the saved meaning", async () => {
    const app = boot();
    const options = profileOf(app, AMARA_STRING);
    const wire = (opts) => plain(app.get(`(() => { const s = HPE.core.parseSeed(${JSON.stringify(AMARA_STRING)}); return HPE.share.encode({ fields: s.value.fields, options: ${JSON.stringify(opts)} }); })()`));
    const v7 = wire(options);
    assert.strictEqual(v7.ok, true, v7.reason);
    assert.strictEqual(v7.value.charAt(0), "7");
    assert.strictEqual(wire({ palette: 1 }).value.charAt(0), "6");
    assert.strictEqual(app.get(`HPE.share.decode(${JSON.stringify(v7.value)}).value.options.profile.id`), "paired");
    const meaning = (opts) => JSON.parse(app.get(`savedMeaning(buildGenerated(${JSON.stringify(AMARA_STRING)}, ${JSON.stringify(opts)}).value)`));
    const acoustic = meaning({ palette: 1 });
    const paired = meaning(options);
    assert.strictEqual(paired.length, acoustic.length + 1, "only the map is appended");
    assert.strictEqual(paired[paired.length - 1].length, 18);
  });

  const MUTANT_PYGMY = "[C3] [Db3] [Eb3] (F3) G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 Ab4 C5 Eb5 [Ab5]";
  const placeOf = (app, text, extra) => plain(app.get(`buildGenerated(${JSON.stringify(text)}, ${JSON.stringify(profileOf(app, text, extra))}).value.geom`));

  test("TRI59d A1: buildGenerated keeps anchor between on a profile seed, solves it turned, and drops anchor one", async () => {
    const app = boot();
    const flat = placeOf(app, MUTANT_PYGMY);
    const turned = placeOf(app, MUTANT_PYGMY, { anchor: "between" });
    assert.strictEqual(turned.turn, 20);
    assert.strictEqual(flat.turn, undefined);
    for (const id of Object.keys(flat.place)) {
      assert.strictEqual(turned.place[id][0], (flat.place[id][0] + 20) % 360, `field ${id} turns by 20`);
    }
    const options = (extra) => plain(app.get(`buildGenerated(${JSON.stringify(MUTANT_PYGMY)}, ${JSON.stringify(profileOf(app, MUTANT_PYGMY, extra))}).value.options`));
    assert.strictEqual(options({ anchor: "between" }).anchor, "between");
    assert.strictEqual("anchor" in options({ anchor: "one" }), false);
    assert.strictEqual("anchor" in options(), false);
    assert.strictEqual(options({ anchor: "between" }).profile.rev, 2);
  });

  test("TRI59d A1: without mutant notes between moves the seats through the plain solve and keeps the anchor", async () => {
    const app = boot();
    const flat = placeOf(app, AMARA_STRING);
    const split = placeOf(app, AMARA_STRING, { anchor: "between" });
    assert.strictEqual(split.turn, undefined);
    assert.notDeepStrictEqual(split.place, flat.place, "notes 1 and 2 are split");
    assert.strictEqual(plain(app.get(`buildGenerated(${JSON.stringify(AMARA_STRING)}, ${JSON.stringify(profileOf(app, AMARA_STRING, { anchor: "between" }))}).value.options.anchor`)), "between");
  });

  test("TRI59d A1: a v9 link draws turned and keeps main and mutant roles", async () => {
    const app = boot();
    const between = profileOf(app, MUTANT_PYGMY, { anchor: "between" });
    const code = plain(app.get(`HPE.share.encode({ fields: HPE.core.parseSeed(${JSON.stringify(MUTANT_PYGMY)}).value.fields, options: ${JSON.stringify(between)} })`));
    assert.strictEqual(code.value.charAt(0), "9");
    const opened = openShare(app, code.value);
    assert.strictEqual(opened.ok, true, opened.reason);
    const shown = app.currentDeck();
    const flat = placeOf(app, MUTANT_PYGMY);
    assert.strictEqual(shown.geom.turn, 20);
    assert.strictEqual(shown.options.anchor, "between");
    for (const id of Object.keys(flat.place)) {
      assert.strictEqual(shown.geom.place[id][0], (flat.place[id][0] + 20) % 360);
      assert.strictEqual(shown.geom.place[id][3], flat.place[id][3], "main stays main, mutant stays mutant");
    }
  });

  test("TRI59d A1: neoSlotPoint puts an empty tonefield at the turned angle", async () => {
    const app = boot();
    const at = (turn) => plain(app.get(`neoSlotPoint(0, null, ${turn})`));
    const angle = (p) => ((Math.atan2(-p.y, p.x) * 180 / Math.PI) + 360) % 360;
    assert.ok(Math.abs(angle(at(0)) - 270) < 1e-6);
    assert.ok(Math.abs(angle(at(20)) - 290) < 1e-6);
    assert.deepStrictEqual(plain(app.get("neoSlotPoint(0, null)")), at(0), "no turn is the frozen angles");
  });

  test("TRI59d A1: the empty-field marks and the landing ring of a turned pan sit at the turned angles", async () => {
    const app = boot();
    const marks = (extra) => app.get(`(() => {
      const m = editorLoad(${JSON.stringify(MUTANT_PYGMY)}, ${JSON.stringify(profileOf(app, MUTANT_PYGMY, extra))}).value;
      const s = editorSolve(m).value;
      return editorNeoMarks(m, s.fields, s.geom);
    })()`);
    const centre = (markup, slot) => {
      const tag = String(markup).match(new RegExp(`<circle class="eslot" data-slot="${slot}" cx="([-0-9.]+)" cy="([-0-9.]+)"`));
      return tag && [Number(tag[1]), Number(tag[2])];
    };
    const want = (turn) => plain(app.get(`(() => { const p = neoSlotPoint(15, null, ${turn}); return [+p.x.toFixed(2), +p.y.toFixed(2)]; })()`));
    assert.deepStrictEqual(centre(marks({}), 15), want(0));
    assert.deepStrictEqual(centre(marks({ anchor: "between" }), 15), want(20));
    assert.notDeepStrictEqual(want(20), want(0));
  });

  test("TRI59d A1: the editor drag snap reads the turned angles from geom.turn", async () => {
    const app = boot();
    const hit = (extra, deg) => plain(app.get(`(() => {
      const m = editorLoad(${JSON.stringify(MUTANT_PYGMY)}, ${JSON.stringify(profileOf(app, MUTANT_PYGMY, extra))}).value;
      const s = editorSolve(m).value, a = ${deg} * Math.PI / 180;
      return editorHitAtPlaced(s, [0.745 * Math.cos(a), 0.745 * Math.sin(a)], m);
    })()`));
    assert.deepStrictEqual(hit({ anchor: "between" }, 260), hit({}, 240), "a turned pan snaps 20 degrees on");
    assert.notDeepStrictEqual(hit({ anchor: "between" }, 260), hit({}, 260));
  });

  test("TRI59d A1: editorCommitOptions keeps between on a profile model and nothing else new", async () => {
    const app = boot();
    const commit = (extra) => plain(app.get(`editorCommitOptions(editorLoad(${JSON.stringify(MUTANT_PYGMY)}, ${JSON.stringify(profileOf(app, MUTANT_PYGMY, extra))}).value)`));
    assert.strictEqual(commit({ anchor: "between" }).anchor, "between");
    assert.strictEqual("anchor" in commit({}), false);
    assert.strictEqual("anchor" in commit({ anchor: "one" }), false);
    assert.deepStrictEqual(Object.keys(commit({ anchor: "between", name: "X" })).sort(), ["anchor", "name", "palette", "profile"]);
  });

});

describe("MN3: MIRROR BOTTOM reflects every bottom note, hand-placed included", () => {
  const SEED = "[C3] [D3] [E3] (A3) C4 D4 E4 F4";
  const orbit = (a, r = 115) => ({ x: 200 + r * Math.cos(a * Math.PI / 180), y: 200 - r * Math.sin(a * Math.PI / 180) });
  const ang = (app) => JSON.parse(app.get("JSON.stringify(layoutAngles)"));
  const bottoms = (app) => [101, 102, 103].map((id) => `${app.get(`lastSolved.fields[${id}][4]`)}=${app.get(`lastSolved.fields[${id}][5]`)}`);
  const slide = (app, name, a) => {
    const g = DG.down(app, name, "mouse");
    DG.moveTo(app, g, g.x + 6, g.y);
    const q = orbit(a);
    DG.moveTo(app, g, q.x, q.y);
    DG.release(app, g, q.x, q.y);
  };





});

describe("MN3: a 5-note bottom ring toggles", () => {
});

describe("MV: the saved-scale handoff (armed in the committed bytes)", () => {
  const { createOrigin } = require("./helpers/sandbox.js");
  const webcrypto = require("node:crypto").webcrypto;
  const OLD_HOST = "old.example", NEW_HOST = "new.example", TARGET = "https://new.example";
  const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const rec = (name, s = "(D3) A3 C4 D4 E4 F4 G4 A4 C5") => ({ v: 4, s, o: { name } });
  const envelopeOf = (records, extra = {}) => ({
    schema: 1, collectionId: "11111111-1111-4111-8111-111111111111", revision: 1, slotStateRevision: 0,
    entries: records.map((record, i) => ({ instanceId: uid(i + 1), revision: 1, displayOrdinal: i + 1, record })),
    usedInstanceIds: records.map((_, i) => uid(i + 1)), nextDisplayOrdinal: records.length + 1,
    preferredSelection: records.length ? { kind: "saved", id: uid(1) } : { kind: "builtin", id: "kurd" },
    slots: {}, hidden: [],
    migration: { sourceKey: null, raw: { hpfc: null, "hpfc.scales": null, "hpfc.scales.v3": null }, instanceIds: [] }, ...extra });
  const payloadOf = (rows, hidden = []) => Buffer.from(JSON.stringify({ r: rows.map(([i, r]) => ({ i, r })), h: hidden })).toString("base64url");
  function movePage({ on = true, cap = 20000, referrer = "", session = null, deadline = null } = {}) {
    let html = INDEX_HTML();
    html = html.replace(/^const MOVE_FROM = .*;$/m, () => `const MOVE_FROM = ${on ? `"${OLD_HOST}"` : "null"};`)
      .replace(/^const MOVE_TARGET = .*;$/m, () => `const MOVE_TARGET = ${on ? `"${TARGET}"` : "null"};`);
    if (on) html = html.replace(/const MOVE_CAP = \d+;/, () => `const MOVE_CAP = ${cap};`);
    html = html.replace(/^const MOVE_DEADLINE = .*;$/m, () => `const MOVE_DEADLINE = ${JSON.stringify(deadline)};`);
    const ss = session === null ? "" : `window.__ss=${JSON.stringify(session)};window.sessionStorage={getItem:k=>k in window.__ss?window.__ss[k]:null,setItem:(k,v)=>{window.__ss[k]=String(v)},removeItem:k=>{delete window.__ss[k]}};`;
    return `<script>location.replace=function(u){window.__replaced=String(u)};location.assign=function(u){window.__assigned=String(u)};document.referrer=${JSON.stringify(referrer)};${ss}</script>` + html;
  }
  const settle = async app => { for (let i = 0; i < 40 && !app.get("typeof booted!=='undefined'&&booted"); i++) await new Promise(r => setTimeout(r, 25)); await new Promise(r => setTimeout(r, 50)); };
  const clickMove = app => { app.click(app.get("moveBannerGo")); return app.get("window.__assigned"); };
  const bannerText = app => app.get("moveBannerMsg.textContent");
  async function boot2({ host, hash = "", records, extra, referrer, on = true, cap, origin = createOrigin({}), storage, session, deadline }) {
    if (records) {
      const realm = realmAt(origin, host);
      await idbRecord(realm, { write: true, value: JSON.stringify(envelopeOf(records, extra)) });
    }
    const app = boot({ origin, storage, indexedDB: true, broadcastChannel: true, locks: true, isSecureContext: true, crypto: webcrypto,
      webdriver: false, href: `https://${host}/index.html${hash}`, html: movePage({ on, cap, referrer, session, deadline }) });
    await settle(app);
    app.fixtureOrigin = origin;
    return app;
  }
  const gtag = app => app.head.children.filter(c => /googletagmanager\.com\/gtag\/js/.test(c.src || ""));
  const realmAt = (origin, host) => boot({ origin, indexedDB: true, broadcastChannel: true, href: `https://${host}/index.html`,
    html: "<script>window.__savedIdbFixtureOnly=true;</script>" });
  const envelopeAt = (origin, host = NEW_HOST) => JSON.parse(savedRaw(realmAt(origin, host)));

  test("MV: the committed bytes arm the move from the old host to the new host", () => {
    const html = INDEX_HTML();
    assert.match(html, /^const MOVE_FROM = "handpan\.raywu\.org";$/m);
    assert.match(html, /^const MOVE_TARGET = "https:\/\/handpantheory\.com";$/m);
    assert.match(html, /^const MOVE_CAP = 20000;$/m);
  });

  test("MV: the committed bytes ship the deadline 2026-11-21", () => {
    assert.match(INDEX_HTML(), /^const MOVE_DEADLINE = "2026-11-21";$/m);
  });

  test("MV: the committed deadline is null or a quoted YYYY-MM-DD literal", () => {
    assert.match(INDEX_HTML(), /^const MOVE_DEADLINE = (null|"\d{4}-\d{2}-\d{2}");$/m);
  });

  test("MV: with no deadline the banner has no deadline line", async () => {
    const app = await boot2({ host: OLD_HOST, records: [rec("A")] });
    assert.strictEqual(bannerText(app), "Handpan Theory now lives at new.example. Your saved scale can come with you.");
    assert.doesNotMatch(bannerText(app), /start opening/);
  });

  test("MV: a set deadline adds the dated line in all 8 locales", async () => {
    const app = await boot2({ host: OLD_HOST, records: [rec("A")], deadline: "2026-11-22" });
    assert.strictEqual(bannerText(app), 'On November 22, 2026, old.example will move to new.example. Custom scales left here will be lost. Click "Move my scales" now to keep them.');
    for (const lang of JSON.parse(app.get("JSON.stringify(LANGS)"))) {
      app.run(`setLang(${JSON.stringify(lang)})`);
      const date = new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "UTC" }).format(new Date("2026-11-22T00:00:00Z"));
      const line = app.get('t("move.deadline", { date: moveDeadlineText(), from: "old.example", host: "new.example" })');
      assert.ok(line.includes(date), `${lang}: ${line}`);
      assert.ok(bannerText(app).endsWith(line), `${lang}: the deadline line closes the banner`);
    }
  });

  test("MV: with no saved scales the deadline line is the short one, in all 8 locales", async () => {
    const app = await boot2({ host: OLD_HOST, records: [], deadline: "2026-11-22" });
    assert.ok(bannerText(app).endsWith("On November 22, 2026, old.example will move to new.example."), bannerText(app));
    assert.match(bannerText(app), /now lives at/);
    for (const lang of JSON.parse(app.get("JSON.stringify(LANGS)"))) {
      app.run(`setLang(${JSON.stringify(lang)})`);
      const short = app.get('t("move.deadline_empty", { date: moveDeadlineText(), from: "old.example", host: "new.example" })');
      assert.ok(bannerText(app).endsWith(short), `${lang}: short deadline line`);
      assert.notStrictEqual(short, app.get('t("move.deadline", { date: moveDeadlineText(), from: "old.example", host: "new.example" })'), lang);
    }
  });

  test("MV: with saved scales the deadline line names the Move my scales button, in all 8 locales", async () => {
    const app = await boot2({ host: OLD_HOST, records: [rec("A")], deadline: "2026-11-22" });
    for (const lang of JSON.parse(app.get("JSON.stringify(LANGS)"))) {
      app.run(`setLang(${JSON.stringify(lang)})`);
      const long = app.get('t("move.deadline", { date: moveDeadlineText(), from: "old.example", host: "new.example" })');
      assert.ok(bannerText(app).endsWith(long), `${lang}: long deadline line`);
    }
  });

  test("MV: the deadline date is pinned to UTC, not the viewer zone", async () => {
    const was = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      const app = await boot2({ host: OLD_HOST, records: [rec("A")], deadline: "2026-11-22" });
      assert.match(bannerText(app), /On November 22, 2026, /);
      assert.doesNotMatch(bannerText(app), /November 21/);
    } finally {
      if (was === undefined) delete process.env.TZ; else process.env.TZ = was;
    }
  });

  test("MV: over-cap with a deadline shows the over-cap line, then the deadline line", async () => {
    const app = await boot2({ host: OLD_HOST, records: manyRecs(116), deadline: "2026-11-22" });
    const text = bannerText(app);
    const over = text.indexOf("saved scales fit in one move"), due = text.indexOf("will move to new.example");
    assert.ok(over >= 0 && due > over, text);
    assert.doesNotMatch(text, /now lives at/);
  });

  test("MV: the deadline adds no navigation call", () => {
    const html = INDEX_HTML();
    assert.strictEqual((html.match(/location\.(replace|assign)\(/g) || []).length, 1);
  });

  test("the move region equals c6ef6b58's with only #790's dedupe-key line applied", () => {
    const region = h => {
      const a = h.indexOf("const MOVE_FROM ="), m = h.indexOf("function moveReport", a), b = h.indexOf("\n}\n", m);
      assert.ok(a >= 0 && m >= 0 && b >= 0, "the move region markers are missing");
      return h.slice(a, b + 3);
    };
    const shipped = region(require("node:fs").readFileSync(require("node:path").join(__dirname, "fixtures", "shipped_client_c6ef6b58.html.txt"), "utf8"));
    const from = "moveDigest(moveCanon(read.record))";
    assert.strictEqual(shipped.split(from).length, 2, "the shipped region no longer holds the one line #790 changed");
    const fa = shipped.indexOf("async function moveForward"), fb = shipped.indexOf("async function moveImport");
    assert.ok(fa >= 0 && fb > fa, "the shipped region no longer holds moveForward");
    assert.ok(!region(INDEX_HTML()).includes("moveForward"), "moveForward is still inside the frozen region");
    const droppedBranch = `    else if (savedObject(row.r) && savedObject(row.r.o) && typeof row.r.o.name === "string") {
      const { name, ...bare } = row.r.o;
      if (readSavedRecord({ ...row.r, o: bare }).ok) items.push({ key: row.i + ":" + await moveDigest(moveCanon(row.r)), opaque: row.r });
    }`;
    assert.ok(shipped.includes(droppedBranch.replace("moveCanon(row.r)", "moveCanon(read.record)")) || shipped.includes(droppedBranch), "the shipped region no longer holds the branch lane U replaced");
    const expected = (shipped.slice(0, fa) + shipped.slice(fb)).replace(from, () => "moveDigest(moveCanon(row.r))")
      .replace(droppedBranch, () => `    else if (savedObject(row.r)) items.push({ key: row.i + ":" + await moveDigest(moveCanon(row.r)), opaque: row.r });`)
      .replace("const MOVE_FROM = null;\nconst MOVE_TARGET = null;\n", () => 'const MOVE_FROM = "handpan.raywu.org";\nconst MOVE_TARGET = "https://handpantheory.com";\n');
    assert.strictEqual(region(INDEX_HTML()), expected);
    assert.match(region(INDEX_HTML()), /const MOVE_CAP = 20000;/);
  });

  test("with the switches null the old host boots normally and a #move= hash is left alone", async () => {
    const app = await boot2({ host: OLD_HOST, hash: "#move=abc&then=", records: [rec("A")], on: false });
    assert.strictEqual(app.get("window.__replaced"), undefined);
    assert.strictEqual(app.get("booted"), true);
    assert.deepStrictEqual(envelopeAt(app.fixtureOrigin, OLD_HOST).entries.map(r => r.record.o.name), ["A"]);
    assert.strictEqual(envelopeAt(app.fixtureOrigin, OLD_HOST).importedIds, undefined);
  });

  test("T-B1: the old host boots, never navigates at boot, shows the move banner and loads analytics", async () => {
    const stores = [{ records: [] }, { records: [rec("A")] }, { records: manyRecs(116) }, { records: [], extra: { hidden: ["kurd"] } }];
    for (const hash of ["", "#deck=f-low-pygmy-18", "#s=6/D3-A3-C4/x/y", "#add"]) {
      for (const store of stores) {
        const app = await boot2({ host: OLD_HOST, hash, ...store });
        assert.strictEqual(app.get("window.__replaced"), undefined, hash);
        assert.strictEqual(app.get("window.__assigned"), undefined, hash);
        assert.strictEqual(app.get("booted"), true, hash);
        assert.strictEqual(app.get("moveBannerEl.hidden"), false, hash);
      }
    }
    const app = await boot2({ host: OLD_HOST, records: [rec("A")] });
    assert.strictEqual(gtag(app).length, 1);
    assert.strictEqual(app.get("analyticsLoaded"), true);
  });

  test("N1: the plain handoff forwards a legitimate arrival hash and drops a crafted #move= one", async () => {
    for (const hash of ["", "#s=6/D3-A3-C4/x/y", "#deck=f-low-pygmy-18", "#add"]) {
      const app = await boot2({ host: OLD_HOST, hash, records: [] });
      assert.strictEqual(app.get("moveUrl().url"), `${TARGET}/${hash}`, hash);
    }
    for (const hash of ["#move=abc&then=%23add", "#move=", "#x=1"]) {
      const app = await boot2({ host: OLD_HOST, hash, records: [] });
      assert.strictEqual(app.get("moveUrl().url"), `${TARGET}/`, hash);
    }
  });

  test("N1: the payload handoff carries a legitimate then hash and an empty one for a crafted #move=", async () => {
    for (const hash of ["#s=6/D3-A3-C4/x/y", "#deck=f-low-pygmy-18", "#add"]) {
      const app = await boot2({ host: OLD_HOST, hash, records: [rec("A")] });
      assert.ok(app.get("moveUrl().url").endsWith("&then=" + encodeURIComponent(hash)), hash);
    }
    for (const hash of ["#move=abc&then=%23add", "#move=", "#x=1"]) {
      const app = await boot2({ host: OLD_HOST, hash, records: [rec("A")] });
      const url = app.get("moveUrl().url");
      assert.ok(url.endsWith("&then="), url);
      assert.strictEqual(url.split("#move=").length, 2, url);
    }
  });

  test("the banner counts the saved scales and says nothing is carried when the store is empty", async () => {
    const one = await boot2({ host: OLD_HOST, records: [rec("A")] });
    assert.match(bannerText(one), /now lives at new\.example\. Your saved scale can come with you\./);
    assert.strictEqual(one.get("moveBannerGo.textContent"), "MOVE MY SCALES");
    const two = await boot2({ host: OLD_HOST, records: [rec("A"), rec("B")] });
    assert.match(bannerText(two), /Your 2 saved scales can come with you\./);
    const none = await boot2({ host: OLD_HOST, records: [] });
    assert.strictEqual(bannerText(none), "Handpan Theory now lives at new.example.");
    assert.strictEqual(none.get("moveBannerGo.textContent"), "OPEN new.example");
    assert.doesNotMatch(bannerText(none), /\bdeck/i);
  });

  test("T-C0: the click with an empty store assigns the new address with search and hash, no payload", async () => {
    const app = await boot2({ host: OLD_HOST, hash: "#deck=f-low-pygmy-18", records: [] });
    assert.strictEqual(clickMove(app), TARGET + "/#deck=f-low-pygmy-18");
    assert.strictEqual(app.get("window.__replaced"), undefined);
  });

  test("a click carries the payload with the then hash, and the old store is untouched", async () => {
    const app = await boot2({ host: OLD_HOST, hash: "#deck=f-low-pygmy-18", records: [rec("A")] });
    assert.strictEqual(app.get("window.__assigned"), undefined, "nothing navigates before the click");
    const to = clickMove(app);
    assert.ok(to.startsWith(TARGET + "/#move="), to);
    assert.ok(to.endsWith("&then=" + encodeURIComponent("#deck=f-low-pygmy-18")), to);
    assert.deepStrictEqual(envelopeAt(app.fixtureOrigin, OLD_HOST).entries.map(r => r.record.o.name), ["A"]);
  });

  const codeOf = url => /#move=([A-Za-z0-9_-]*)&then=/.exec(url)[1];
  const rowsOf = code => JSON.parse(Buffer.from(code, "base64url").toString()).r;
  const manyRecs = n => Array.from({ length: n }, (_, i) => rec(`S${i + 1} ${"x".repeat(30)}`));

  for (const total of [116, 200]) {
    test(`T-C1: over-cap store of ${total} says so before the click, then one click carries exactly the largest prefix under MOVE_CAP`, async () => {
      const records = manyRecs(total);
      const old = await boot2({ host: OLD_HOST, hash: "#deck=f-low-pygmy-18", records, extra: { hidden: ["kurd"] } });
      assert.strictEqual(old.get("window.__assigned"), undefined);
      const to = clickMove(old);
      assert.ok(to && to.startsWith(TARGET + "/#move="), String(to));
      assert.ok(to.endsWith("&then=" + encodeURIComponent("#deck=f-low-pygmy-18")), to);
      const code = codeOf(to);
      assert.ok(code.length <= 20000);
      const rows = rowsOf(code);
      assert.ok(rows.length > 0 && rows.length < total, `carried ${rows.length}`);
      assert.ok(bannerText(old).includes(`${rows.length} of your ${total} saved scales fit in one move. The rest stay here at this address.`), bannerText(old));
      assert.deepStrictEqual(rows.map(r => r.r.o.name), records.slice(0, rows.length).map(r => r.o.name));
      const more = Buffer.from(JSON.stringify({ r: records.slice(0, rows.length + 1).map((r, i) => ({ i: uid(i + 1), r })), h: ["kurd"] })).toString("base64url");
      assert.ok(more.length > 20000, "one more record would not fit");
      assert.deepStrictEqual(JSON.parse(Buffer.from(code, "base64url").toString()).h, ["kurd"]);
      assert.strictEqual(clickMove(old), to, "a second click carries the same prefix");
      assert.deepStrictEqual(envelopeAt(old.fixtureOrigin, OLD_HOST).entries.length, total, "old storage untouched");
      const origin = createOrigin({});
      const hash = `#move=${code}&then=`;
      const first = await boot2({ host: NEW_HOST, hash, referrer: `https://${OLD_HOST}/`, origin });
      assert.deepStrictEqual(envelopeAt(origin).entries.map(r => r.record.o.name), records.slice(0, rows.length).map(r => r.o.name));
      assert.deepStrictEqual(envelopeAt(origin).hidden, ["kurd"]);
      assert.match(first.get("moveNoticeEl.textContent"), new RegExp(`Your ${rows.length} saved scales moved here`));
      await boot2({ host: NEW_HOST, hash, referrer: `https://${OLD_HOST}/`, origin });
      assert.strictEqual(envelopeAt(origin).entries.length, rows.length, "second visit adds no duplicates");
    });
  }

  test("an under-cap store shows no over-cap line", async () => {
    const app = await boot2({ host: OLD_HOST, records: manyRecs(3) });
    assert.doesNotMatch(bannerText(app), /fit in one move/);
  });

  test("an over-cap store with a #s= hash keeps the hash across the click", async () => {
    const hash = "#s=6/D3-A3-C4/x/y";
    const app = await boot2({ host: OLD_HOST, hash, records: manyRecs(200) });
    assert.strictEqual(app.get("booted"), true);
    assert.notStrictEqual(app.get("location.hash"), hash, "the booted app rewrites the live hash");
    const to = clickMove(app);
    assert.ok(to.startsWith(TARGET + "/#move="), String(to));
    assert.ok(to.endsWith("&then=" + encodeURIComponent(hash)), to);
  });

  test("saved scales with accented, CJK and emoji names move intact, once, and count UTF-8 bytes toward MOVE_CAP", async () => {
    const names = ["\u00c9cho", "\u65e5\u672c\u8a9e\u306e\u97f3", "\ud83c\udfb5 Tune"];
    const records = names.map(n => rec(n));
    const old = await boot2({ host: OLD_HOST, hash: "#deck=f-low-pygmy-18", records });
    const to = clickMove(old);
    assert.ok(to && to.startsWith(TARGET + "/#move="), String(to));
    const code = codeOf(to);
    assert.deepStrictEqual(rowsOf(code).map(r => r.r.o.name), names);
    assert.deepStrictEqual(envelopeAt(old.fixtureOrigin, OLD_HOST).entries.map(r => r.record.o.name), names);
    const origin = createOrigin({});
    const hash = `#move=${code}&then=`;
    const first = await boot2({ host: NEW_HOST, hash, referrer: `https://${OLD_HOST}/`, origin });
    assert.deepStrictEqual(envelopeAt(origin).entries.map(r => r.record.o.name), names);
    assert.match(first.get("moveNoticeEl.textContent"), /Your 3 saved scales moved here/);
    await boot2({ host: NEW_HOST, hash, referrer: `https://${OLD_HOST}/`, origin });
    assert.strictEqual(envelopeAt(origin).entries.length, 3, "revisit adds no duplicates");
    const exact = Buffer.from(JSON.stringify({ r: rowsOf(code).map(r => ({ i: r.i, r: r.r })), h: [] })).toString("base64url").length;
    const tight = await boot2({ host: OLD_HOST, records, cap: exact - 1 });
    assert.strictEqual(rowsOf(codeOf(clickMove(tight))).length, 2, "one byte under the cap drops the last row");
  });

  const nanCanon = v => Array.isArray(v) ? "[" + v.map(nanCanon).join(",") + "]" :
    v && typeof v === "object" ? "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + nanCanon(v[k])).join(",") + "}" : JSON.stringify(v);
  const nanKey = (id, row) => id + ":" + require("node:crypto").createHash("sha256").update(nanCanon(row), "utf8").digest("hex").slice(0, 16);

  test("NAN: a record carried by the opaque path and one read normally share one dedupe key", async () => {
    const row = { ...rec("Caf\u00e9"), v: 3 };
    const origin = createOrigin({});
    const hash = `#move=${payloadOf([[uid(1), row]])}&then=`;
    await boot2({ host: NEW_HOST, hash, referrer: `https://${OLD_HOST}/`, origin, records: [], extra: { importedIds: [nanKey(uid(1), row)] } });
    assert.deepStrictEqual(envelopeAt(origin).entries, [], "a key recorded from the raw row did not stop a re-import");
  });

  test("NAN: a name the grammar still refuses moves by the opaque branch", async () => {
    const origin = createOrigin({});
    const hash = `#move=${payloadOf([[uid(1), rec("Bad\u0007name")], [uid(2), rec("Caf\u00e9")]])}&then=`;
    await boot2({ host: NEW_HOST, hash, referrer: `https://${OLD_HOST}/`, origin });
    assert.deepStrictEqual(envelopeAt(origin).entries.map(r => r.record.o.name), ["Bad\u0007name", "Caf\u00e9"]);
  });

  test("when not even one record fits under MOVE_CAP the click still assigns, with no payload", async () => {
    const app = await boot2({ host: OLD_HOST, hash: "#deck=f-low-pygmy-18", records: [rec("A")], cap: 10 });
    assert.strictEqual(clickMove(app), TARGET + "/#deck=f-low-pygmy-18");
    assert.deepStrictEqual(envelopeAt(app.fixtureOrigin, OLD_HOST).entries.map(r => r.record.o.name), ["A"]);
  });

  test("the new host never forwards", async () => {
    const app = await boot2({ host: NEW_HOST, records: [rec("A")] });
    assert.strictEqual(app.get("window.__replaced"), undefined);
    assert.strictEqual(app.get("window.__assigned"), undefined);
    assert.strictEqual(app.get("booted"), true);
    assert.strictEqual(app.get("moveBannerEl"), null, "no banner on the new host");
  });

  test("with the switches null there is no banner and the analytics path is unchanged", async () => {
    const app = await boot2({ host: OLD_HOST, records: [rec("A")], on: false });
    assert.strictEqual(app.get("moveBannerEl"), null);
  });

  test("T-B2: outside moveGo, index.html never navigates the page to the target", () => {
    const html = INDEX_HTML();
    assert.ok(!/location\.replace\(\s*MOVE_TARGET/.test(html), "location.replace(MOVE_TARGET is back");
    assert.strictEqual(html.split("location.assign(").length - 1, 1, "exactly one location.assign");
    const a = html.indexOf("function moveGo"), b = html.indexOf("location.assign(");
    assert.ok(a > 0 && b > a && html.indexOf("\n}\n", a) > b, "the assign is not inside moveGo");
    assert.ok(!/MOVE_ON_OLD\)\s*return \{jumped/.test(html));
    assert.ok(!/if \(!MOVE_ON_OLD\) loadAnalytics/.test(html));
  });

  test("T-D1: no href, action or formaction holds the payload or the target, and the buttons are type=button", async () => {
    const app = await boot2({ host: OLD_HOST, records: [rec("A")] });
    const attrs = JSON.parse(app.get(`JSON.stringify([...document.querySelectorAll('[href],[action],[formaction]')].flatMap(e => ['href','action','formaction'].map(a => e.getAttribute(a)).filter(v => v !== null)))`));
    for (const v of attrs) assert.ok(!/#move=|new\.example/.test(v), v);
    for (const name of ["moveBannerGo", "moveBannerDismiss"]) {
      assert.strictEqual(app.get(`${name}.getAttribute('type')`), "button");
      for (const attr of ["href", "action", "formaction"]) {
        const v = app.get(`${name}.getAttribute('${attr}')`);
        assert.ok(v === null || v === undefined || !/#move=|new\.example/.test(v), `${name} ${attr}`);
      }
    }
    assert.strictEqual(app.get("moveBannerEl.getAttribute('role')"), "region");
    assert.ok(app.get("moveBannerEl.getAttribute('aria-label')"));
  });

  test("the banner is inert behind the scale sheet, the panel and About, and live again after", async () => {
    const app = await boot2({ host: OLD_HOST, records: [rec("A")] });
    const inert = () => app.get("!!moveBannerEl.inert");
    assert.strictEqual(inert(), false);
    app.run("openScaleSheet()");
    assert.strictEqual(inert(), true, "sheet");
    assert.strictEqual(app.get("moveBannerEl.getAttribute('aria-hidden')"), "true");
    app.run("closeScaleSheet()");
    assert.strictEqual(inert(), false, "sheet closed");
    app.run("openPanel()");
    assert.strictEqual(inert(), true, "panel");
    app.run("closePanel()");
    assert.strictEqual(inert(), false, "panel closed");
    app.run("openAbout()");
    assert.strictEqual(inert(), true, "about");
    app.run("closeAbout()");
    assert.strictEqual(inert(), false, "about closed");
  });

  test("a banner created after a modal is already open starts inert, and goes live when the modal closes", async () => {
    const app = await boot2({ host: OLD_HOST, records: [rec("A")] });
    app.run("document.body.removeChild(moveBannerEl); background.splice(background.indexOf(moveBannerEl), 1); panelBackground.splice(panelBackground.indexOf(moveBannerEl), 1); moveBannerEl = null;");
    app.run("openScaleSheet()");
    app.run("renderMoveBanner()");
    assert.strictEqual(app.get("!!moveBannerEl.inert"), true, "created behind the open sheet");
    assert.strictEqual(app.get("moveBannerEl.getAttribute('aria-hidden')"), "true");
    app.run("closeScaleSheet()");
    assert.strictEqual(app.get("!!moveBannerEl.inert"), false, "sheet closed");
  });

  test("switching language re-renders the banner copy, and the over-cap line follows the store across MOVE_CAP", async () => {
    const app = await boot2({ host: OLD_HOST, records: manyRecs(3) });
    assert.match(bannerText(app), /Your 3 saved scales can come with you/);
    app.run('setLang("fr")');
    const fr = bannerText(app);
    assert.doesNotMatch(fr, /Your 3 saved scales can come with you/);
    assert.strictEqual(app.get("moveBannerGo.textContent"), app.get('t("move.go")'));
    app.run('setLang("en")');
    assert.match(bannerText(app), /Your 3 saved scales can come with you/);
  });

  test("saved-scale changes re-render the banner across MOVE_CAP in both directions", async () => {
    const fits = await boot2({ host: OLD_HOST, records: manyRecs(4) });
    const per = Math.ceil(fits.get("moveUrl().url.length") / 4);
    const app = await boot2({ host: OLD_HOST, records: manyRecs(3), cap: per * 4 - 40 });
    assert.doesNotMatch(bannerText(app), /fit in one move/);
    const grown = app.get(`(() => { const e = JSON.parse(JSON.stringify(savedState)), n = e.entries.length;
      for (let i = 0; i < 3; i++) { const row = JSON.parse(JSON.stringify(e.entries[0]));
        row.instanceId = "00000000-0000-4000-8000-0000000009" + String(i).padStart(2, "0");
        row.displayOrdinal = n + i + 1; e.entries.push(row); e.usedInstanceIds.push(row.instanceId); }
      e.revision++; e.nextDisplayOrdinal = e.entries.length + 1;
      return applySavedSnapshot(e, new Map()).ok; })()`);
    assert.strictEqual(grown, true);
    assert.strictEqual(app.get("savedState.entries.length"), 6);
    assert.match(bannerText(app), /\d of your 6 saved scales fit in one move/, "growing past the cap adds the line");
    const shrunk = app.get(`(() => { const e = JSON.parse(JSON.stringify(savedState));
      e.entries.length = 3; e.revision++; return applySavedSnapshot(e, new Map()).ok; })()`);
    assert.strictEqual(shrunk, true);
    assert.doesNotMatch(bannerText(app), /fit in one move/, "shrinking back under the cap drops the line");
    assert.match(bannerText(app), /Your 3 saved scales/);
  });

  test("deleting a saved scale re-renders the banner counts and drops the over-cap line", async () => {
    const probe = await boot2({ host: OLD_HOST, records: manyRecs(4) });
    const per = Math.ceil(probe.get("moveUrl().url.length") / 4);
    const app = await boot2({ host: OLD_HOST, records: manyRecs(5), cap: per * 4 + 20 });
    assert.match(bannerText(app), /4 of your 5 saved scales fit in one move/);
    const result = await removeLast(app);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(app.get("savedState.entries.length"), 4);
    assert.match(bannerText(app), /Your 4 saved scales can come with you/);
    assert.doesNotMatch(bannerText(app), /fit in one move/);
  });

  test("a dismissed banner stays hidden when the store or language changes", async () => {
    const app = await boot2({ host: OLD_HOST, records: [rec("A")], session: {} });
    app.click(app.get("moveBannerDismiss"));
    app.run('setLang("fr")');
    assert.strictEqual(app.get("moveBannerEl.hidden"), true);
  });

  const removeLast = app => app.getAsync(`(() => { const e = savedState, row = e.entries[e.entries.length - 1];
    return commitSaved({type:"delete",collectionId:e.collectionId,instanceId:row.instanceId,expectedRevision:row.revision}); })()`);

  test("T-D2: dismiss hides the banner for the session, and a fresh session shows it again", async () => {
    const app = await boot2({ host: OLD_HOST, records: [rec("A")], session: {} });
    assert.strictEqual(app.get("moveBannerEl.hidden"), false);
    app.click(app.get("moveBannerDismiss"));
    assert.strictEqual(app.get("moveBannerEl.hidden"), true);
    assert.strictEqual(app.get("window.__assigned"), undefined);
    const kept = JSON.parse(app.get("JSON.stringify(window.__ss)"));
    assert.ok(Object.keys(kept).length === 1, "one session key");
    const again = await boot2({ host: OLD_HOST, records: [rec("A")], session: kept });
    assert.strictEqual(again.get("moveBannerEl === null"), true);
    const fresh = await boot2({ host: OLD_HOST, records: [rec("A")], session: {} });
    assert.strictEqual(fresh.get("moveBannerEl.hidden"), false);
    assert.strictEqual(JSON.stringify(fresh.localStorage ? fresh.get("Object.keys(localStorage)") : []).includes("move"), false);
  });

  test("dismiss still hides the banner when session storage throws", async () => {
    const app = await boot2({ host: OLD_HOST, records: [rec("A")] });
    app.click(app.get("moveBannerDismiss"));
    assert.strictEqual(app.get("moveBannerEl.hidden"), true);
  });

  test("T-D3: in session mode the banner offers only the new address and the click carries no payload", async () => {
    const app = await boot2({ host: OLD_HOST, hash: "#deck=f-low-pygmy-18", records: [rec("A")], storage: undefined });
    app.get("savedMode='session'");
    app.get("renderMoveBanner()");
    assert.strictEqual(app.get("moveBannerGo.textContent"), "OPEN new.example");
    assert.strictEqual(bannerText(app), "Handpan Theory now lives at new.example.");
    assert.strictEqual(clickMove(app), TARGET + "/#deck=f-low-pygmy-18");
  });

  test("T-D3: in protected mode the banner offers only the new address and the click carries no payload", async () => {
    const app = await boot2({ host: OLD_HOST, hash: "#deck=f-low-pygmy-18", records: [rec("A")] });
    app.get("savedMode='protected'");
    app.get("renderMoveBanner()");
    assert.strictEqual(app.get("moveBannerGo.textContent"), "OPEN new.example");
    assert.strictEqual(bannerText(app), "Handpan Theory now lives at new.example.");
    assert.strictEqual(clickMove(app), TARGET + "/#deck=f-low-pygmy-18");
  });

  test("a move link is stripped to the then hash and imports once, however often it is replayed", async () => {
    const origin = createOrigin({});
    const hash = `#move=${payloadOf([[uid(1), rec("ONE")]])}&then=${encodeURIComponent("#deck=f-low-pygmy-18")}`;
    const first = await boot2({ host: NEW_HOST, hash, referrer: `https://${OLD_HOST}/`, origin });
    assert.strictEqual(first.get("location.hash"), "#deck=f-low-pygmy-18");
    assert.ok(first.history.calls.some(c => c.type === "replace" && !String(c.url).includes("move=")));
    const one = envelopeAt(origin);
    assert.deepStrictEqual(one.entries.map(r => r.record.o.name), ["ONE"]);
    assert.strictEqual(one.importedIds.length, 1);
    const second = await boot2({ host: NEW_HOST, hash, referrer: `https://${OLD_HOST}/`, origin });
    assert.ok(second.get("booted"));
    assert.deepStrictEqual(envelopeAt(origin), one, "the second import changes nothing");
  });

  test("a move link from the wrong or missing referrer writes nothing", async () => {
    for (const referrer of ["", "https://evil.example/", "not a url"]) {
      const origin = createOrigin({});
      const hash = `#move=${payloadOf([[uid(1), rec("ONE")]])}&then=`;
      const app = await boot2({ host: NEW_HOST, hash, referrer, origin });
      assert.ok(app.get("booted"), referrer);
      assert.deepStrictEqual(envelopeAt(origin).entries, [], referrer);
      assert.ok(!app.get("location.hash").includes("move="), referrer);
    }
  });

  test("a then hash outside the allowed forms is dropped", async () => {
    const origin = createOrigin({});
    const hash = `#move=${payloadOf([])}&then=${encodeURIComponent("javascript:alert(1)")}`;
    const app = await boot2({ host: NEW_HOST, hash, referrer: `https://${OLD_HOST}/`, origin });
    assert.ok(!/javascript/.test(app.get("location.href")));
  });

  test("a record the app cannot read is carried as opaque bytes and the rest import", async () => {
    const origin = createOrigin({});
    const future = { v: 99, s: "future", o: {} };
    const hash = `#move=${payloadOf([[uid(1), rec("GOOD")], [uid(2), future]])}&then=`;
    await boot2({ host: NEW_HOST, hash, referrer: `https://${OLD_HOST}/`, origin });
    const rows = envelopeAt(origin).entries.map(r => r.record);
    assert.strictEqual(rows.length, 2, "the unreadable row is carried, never dropped (R4-1)");
    assert.ok(rows.some(r => r.o.name === "GOOD"));
    assert.deepStrictEqual(rows.find(r => r.v === 99), future);
  });

  test("an older build's edit keeps the top-level importedIds", async () => {
    const origin = createOrigin({});
    const hash = `#move=${payloadOf([[uid(1), rec("ONE")]])}&then=`;
    const app = await boot2({ host: NEW_HOST, hash, referrer: `https://${OLD_HOST}/`, origin });
    const before = envelopeAt(origin);
    await app.getAsync(`(async()=>{const e=savedState,row=e.entries[0];
      return commitSaved({type:'prefer',collectionId:e.collectionId,selection:{kind:'saved',id:row.instanceId}});})()`);
    assert.deepStrictEqual(envelopeAt(origin).importedIds, before.importedIds);
  });
});

describe("FG: field guide light ground for the menu, forms and About (phase 2)", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const BEGIN = "/* field-guide:begin */";
  const END = "/* field-guide:end */";
  const block = () => {
    const a = html.indexOf(BEGIN), b = html.indexOf(END);
    assert.ok(a > 0 && b > a, "no field-guide block in the stylesheet");
    return html.slice(a + BEGIN.length, b).replace(/\/\*[\s\S]*?\*\//g, "");
  };
  const rules = () => [...block().matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({ sel: m[1].split(",").map((s) => s.trim()), body: m[2] }));
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const find = (sel) => rules().filter((r) => r.sel.includes(sel)).map((r) => r.body).join(";");

  test("FG: the block sits before the print block, which stays last", () => {
    assert.ok(html.indexOf(END) < html.indexOf("@media print"));
    assert.ok(html.lastIndexOf("@media print") > html.indexOf(END));
  });

  test("FG: root stays color-scheme:dark; light is scoped to the panel, sheet and About", () => {
    assert.match(html, /:root\{\s*color-scheme:dark;/);
    const scoped = rules().find((r) => /color-scheme:\s*light/.test(r.body));
    assert.ok(scoped, "no color-scheme:light rule");
    for (const s of ["#settings-panel", "#scale-sheet", "#about"]) assert.ok(scoped.sel.includes(s), s);
    assert.ok(!scoped.sel.includes(":root") && !scoped.sel.includes("body"));
  });

  test("FG: every selector is scoped to the panel, sheet or About", () => {
    for (const r of rules()) for (const s of r.sel)
      assert.match(s, /^(#settings-panel|#scale-sheet|\.sheetsurf|#about|\.abouthead|@)/, `unscoped: ${s}`);
  });


  test("FG: roles are the approved tokens and the text pairs pass 4.5:1", () => {
    const b = block();
    for (const hex of ["#F6F4ED", "#FFFFFF", "#242424", "#5E5850", "#8A847B", "#6756B5"])
      assert.ok(b.toUpperCase().includes(hex), hex);
    assert.ok(ratio("#242424", "#F6F4ED") >= 4.5);
    assert.ok(ratio("#5E5850", "#F6F4ED") >= 4.5);
    assert.ok(ratio("#5E5850", "#FFFFFF") >= 4.5);
    assert.ok(ratio("#FFFFFF", "#6756B5") >= 4.5);
    assert.ok(ratio("#6756B5", "#F6F4ED") >= 4.5);
    assert.ok(ratio("#8A847B", "#F6F4ED") >= 3);
  });

  test("FG: A1/A19 focus ring is a 2px ink ring, differs from the violet fill, never the teal", () => {
    const f = find("#settings-panel :focus-visible");
    assert.match(f, /outline:\s*2px solid #242424/i);
    assert.match(f, /outline-offset:\s*2px/);
    assert.ok(ratio("#242424", "#F6F4ED") >= 3);
    assert.notStrictEqual("#242424", "#6756B5");
    assert.ok(!/44e0d8/i.test(block()));
    assert.match(find("#scale-sheet :focus-visible"), /outline:\s*2px solid #242424/i);
    assert.match(find("#about :focus-visible"), /outline:\s*2px solid #242424/i);
  });





  test("FG: the desktop sidebar keeps a 4px table-coloured right edge", () => {
    assert.match(block(), /box-shadow:\s*inset -4px 0 0 #0F0E0B/i);
  });

  test("FG: no text or font-size is changed by the block", () => {
    assert.ok(!/font-size|font:|padding|margin|width|height/.test(block().replace(/(vertical-align|margin-right|width|height)[^;}]*/g,"").replace(/box-shadow[^;}]*/g,"")), "block changes geometry or type");
  });
});

describe("Neotone solid tint (owner 2026-11-03)", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const fixture = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", f), "utf8")).deck;
  const tintHex = (hex) => "#" + [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return Math.round((v + (1 - v) * 0.5) * 255).toString(16).padStart(2, "0");
  }).join("");

  test("a Neotone card with a mutant note tints its lit mains and ding and draws no state-colour stroke", () => {
    const app = boot();
    const d = fixture("profile_case_pygmy_v2.json");
    const [root, tone] = [d.colors.root.toLowerCase(), d.colors.tone.toLowerCase()];
    const tints = [tintHex(root), tintHex(tone)];
    let tintedDisks = 0;
    let tintedDing = 0;
    d.chords.forEach((_, i) => {
      const svg = app.get(`pan(${JSON.stringify(d)}, ${JSON.stringify(d.chords[i])})`);
      for (const m of svg.matchAll(/<(?:circle|path)[^>]*stroke="(#[0-9a-fA-F]{6})"/g))
        assert.ok(![root, tone].includes(m[1].toLowerCase()), "state-colour stroke " + m[1]);
      for (const m of svg.matchAll(/<circle cx="(-?[\d.e-]+)" cy="(-?[\d.e-]+)" r="([\d.e-]+)" fill="(#[0-9a-f]{3,6})" stroke="#000"/g)) {
        if (!tints.includes(m[4])) continue;
        if (Math.abs(+m[3] - 100 * d.geom.r_ding) < 1e-6) tintedDing++; else tintedDisks++;
      }
    });
    assert.ok(tintedDisks >= 1, "a tinted main disk");
    assert.ok(tintedDing >= 1, "a tinted ding");
  });

  test("a placed card with no mutant note keeps its ring bands and a white ding", () => {
    const app = boot();
    const d = fixture("profile_case_kurd9_v2.json");
    const svgs = d.chords.map((c) => app.get(`pan(${JSON.stringify(d)}, ${JSON.stringify(c)})`));
    assert.ok(svgs.some((s) => new RegExp(`<circle[^>]*fill="none" stroke="${d.colors.root}"`, "i").test(s)), "a ring band");
    const dingR = 100 * d.geom.r_ding;
    for (const s of svgs)
      for (const m of s.matchAll(/<circle[^>]*r="([\d.e-]+)" fill="(#[0-9a-fA-F]{3,6})"/g))
        if (Math.abs(+m[1] - dingR) < 1e-6) assert.strictEqual(m[2].toLowerCase(), "#fff", "the ding stays white");
  });
});


describe("PDF tier menu (lane U)", () => {
  const OPTIONS = [["easy", "EASY"], ["easy_medium", "EASY + MEDIUM"], ["all", "ALL"]];
  const SRC = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const menuHtml = () => {
    const at = SRC.indexOf('<div id="print-menu"');
    return SRC.slice(at, SRC.indexOf("</div>", at) + 6);
  };
  const spyBuild = (app) => app.run(`globalThis.__builds = [];
    (function () { const real = HPE.pdfcards.build;
      HPE.pdfcards.build = function (d, o) { __builds.push(o); return real.call(this, d, o); }; })()`);
  const builds = (app) => JSON.parse(JSON.stringify(app.get("__builds")));
  const withGa = (opts = {}) => boot({ html: withGaId("G-TEST123456"), webdriver: false, href: "https://example.test/index.html", ...opts });
  const pdfEvents = (app) => JSON.parse(JSON.stringify(Array.from(app.get("window.dataLayer"))))
    .filter((e) => e[0] === "event" && e[1] === "pdf_download").map((e) => e[2]);

  test("the menu holds exactly three items in order, inside .prints, closed by default", () => {
    const html = menuHtml();
    assert.match(html, /^<div id="print-menu" role="menu" aria-label="PDF download options" hidden>/);
    const items = [...html.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)];
    assert.deepStrictEqual(items.map((m) => m[2]), OPTIONS.map((o) => o[1]));
    items.forEach((m, i) => {
      assert.match(m[1], /role="menuitem"/);
      assert.ok(m[1].includes(`onclick="downloadDeckPDF('shop', this, '${OPTIONS[i][0]}'); closePanel();"`), m[1]);
    });
    const row = SRC.slice(SRC.indexOf('<div class="prints">'), SRC.indexOf('id="print-paper-menu"', SRC.indexOf('<div class="prints">')));
    assert.ok(row.includes(html), "the menu is a descendant of .prints");
  });

  test("the trigger toggles the menu and mirrors it in aria-expanded; nothing is stored", () => {
    const app = boot();
    const keys = Object.keys(app.store).sort();
    assert.strictEqual(app.els["print-menu"].hidden, true);
    app.run("togglePrintMenu()");
    assert.strictEqual(app.els["print-menu"].hidden, false);
    assert.strictEqual(app.els["print-download"].getAttribute("aria-expanded"), "true");
    app.run("togglePrintMenu()");
    assert.strictEqual(app.els["print-menu"].hidden, true);
    assert.strictEqual(app.els["print-download"].getAttribute("aria-expanded"), "false");
    assert.deepStrictEqual(Object.keys(app.store).sort(), keys, "choosing opens no new storage key");
  });

  test("closePanel closes an open menu; Escape closes only the menu and returns focus to the trigger", () => {
    const app = boot();
    app.run("openPanel(); togglePrintMenu()");
    app.keydown("Escape");
    assert.strictEqual(app.els["print-menu"].hidden, true);
    assert.strictEqual(app.get("panelOpen"), true, "Escape on an open menu leaves the panel open");
    assert.strictEqual(app.activeId(), "print-download");
    app.run("togglePrintMenu()");
    app.run("closePanel()");
    assert.strictEqual(app.els["print-menu"].hidden, true);
    app.keydown("Escape");
    assert.strictEqual(app.get("panelOpen"), false);
  });

  test("Escape closes only the menu on the desktop sidebar, where the panel never opens", () => {
    const app = boot();
    app.run("togglePrintMenu()");
    app.keydown("Escape");
    assert.strictEqual(app.els["print-menu"].hidden, true);
    assert.strictEqual(app.activeId(), "print-download");
  });

  test("the paper menu: two radio items in order, inside .prints, closed by default; the trigger mirrors aria-expanded", () => {
    const at = SRC.indexOf('<div id="print-paper-menu"');
    const html = SRC.slice(at, SRC.indexOf("</div>", at) + 6);
    assert.match(html, /^<div id="print-paper-menu" role="menu" aria-label="Paper size" hidden>/);
    const items = [...html.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)];
    assert.deepStrictEqual(items.map((m) => m[2]), ["LETTER", "A4"]);
    items.forEach((m, i) => {
      assert.match(m[1], /role="menuitemradio"/);
      assert.ok(m[1].includes(`onclick="choosePaper('${["letter", "a4"][i]}');"`), m[1]);
    });
    const app = boot();
    assert.strictEqual(app.els["print-paper-menu"].hidden, true);
    app.run("togglePaperMenu()");
    assert.strictEqual(app.els["print-paper-menu"].hidden, false);
    assert.strictEqual(app.els["print-paper"].getAttribute("aria-expanded"), "true");
    app.run("togglePaperMenu()");
    assert.strictEqual(app.els["print-paper-menu"].hidden, true);
    assert.strictEqual(app.els["print-paper"].getAttribute("aria-expanded"), "false");
  });

  test("only one print-row menu is open at a time", () => {
    const app = boot();
    app.run("togglePrintMenu()");
    app.run("togglePaperMenu()");
    assert.strictEqual(app.els["print-menu"].hidden, true);
    assert.strictEqual(app.els["print-download"].getAttribute("aria-expanded"), "false");
    assert.strictEqual(app.els["print-paper-menu"].hidden, false);
    app.run("togglePrintMenu()");
    assert.strictEqual(app.els["print-paper-menu"].hidden, true);
    assert.strictEqual(app.els["print-paper"].getAttribute("aria-expanded"), "false");
    assert.strictEqual(app.els["print-menu"].hidden, false);
  });

  test("choosing a paper sets it as setPrintPaper does, closes the menu, returns focus and keeps the panel open", () => {
    const app = boot();
    app.run("openPanel(); togglePaperMenu()");
    app.run("choosePaper('a4')");
    assert.strictEqual(app.get("printPaper"), "a4");
    assert.strictEqual(JSON.parse(app.store.hpfc).printPaper, "a4");
    assert.strictEqual(app.els["print-paper-menu"].hidden, true);
    assert.strictEqual(app.els["print-paper"].textContent, "A4");
    assert.deepStrictEqual(["print-paper-letter", "print-paper-a4"].map((id) => app.els[id].getAttribute("aria-checked")), ["false", "true"]);
    assert.strictEqual(app.activeId(), "print-paper");
    assert.strictEqual(app.get("panelOpen"), true);
  });

  test("a stored A4 boots with the paper button reading A4", () => {
    const app = boot({ storage: { hpfc: JSON.stringify({ deck: "amara", mode: "A", printPaper: "a4" }) } });
    assert.strictEqual(app.els["print-paper"].textContent, "A4");
    assert.strictEqual(app.els["print-paper-a4"].getAttribute("aria-checked"), "true");
  });

  test("Escape closes the open paper menu alone and returns focus to the paper button; an outside click closes it", () => {
    const app = boot();
    app.run("openPanel(); togglePaperMenu()");
    app.keydown("Escape");
    assert.strictEqual(app.els["print-paper-menu"].hidden, true);
    assert.strictEqual(app.get("panelOpen"), true);
    assert.strictEqual(app.activeId(), "print-paper");
    app.run("togglePaperMenu()");
    (app.sandbox.document._l.click || []).forEach((fn) => fn({ type: "click", target: { closest: () => null } }));
    assert.strictEqual(app.els["print-paper-menu"].hidden, true);
  });

  test("an outside click closes the menu; a click inside .prints does not", () => {
    const app = boot();
    app.run("togglePrintMenu()");
    const fire = (target) => (app.sandbox.document._l.click || []).forEach((fn) => fn({ type: "click", target }));
    fire({ closest: (sel) => (sel === ".prints" ? {} : null) });
    assert.strictEqual(app.els["print-menu"].hidden, false);
    fire({ closest: () => null });
    assert.strictEqual(app.els["print-menu"].hidden, true);
  });

  for (const id of ["hijaz", "pygmy", "amara", "kurd"]) {
    test(`${id}: each option builds exactly the tierCards set; ALL builds the unfiltered default`, () => {
      const app = boot();
      app.select(id);
      const t = JSON.parse(JSON.stringify(app.get("HPE.sequence.tierCards(deck())")));
      assert.ok(t.easy.length > 0);
      spyBuild(app);
      app.run(`downloadDeckPDF("shop", null, "easy"); downloadDeckPDF("shop", null, "easy_medium"); downloadDeckPDF("shop", null, "all");`);
      const b = builds(app);
      assert.deepStrictEqual(b[0].cards, t.easy);
      assert.deepStrictEqual(b[1].cards, t.easyMedium);
      assert.ok(!("cards" in b[2]), "ALL passes no cards option, so the bytes stay what they were");
      assert.strictEqual(b[2].variant, "shop");
    });
  }

  test("a custom scale filters too", () => {
    const app = boot();
    customDeck(app);
    const t = JSON.parse(JSON.stringify(app.get("HPE.sequence.tierCards(deck())")));
    spyBuild(app);
    app.run('downloadDeckPDF("shop", null, "easy_medium")');
    assert.deepStrictEqual(builds(app)[0].cards, t.easyMedium);
  });

  test("file names carry the option tag; ALL keeps today's name", () => {
    const app = boot();
    const names = {};
    for (const [opt] of OPTIONS) {
      app.run(`downloadDeckPDF("shop", null, "${opt}")`);
      names[opt] = anchor(app).download;
    }
    assert.match(names.easy, /^[A-Za-z0-9_]+_CHORD_ONLY_EASY_Letter\.pdf$/);
    assert.match(names.easy_medium, /^[A-Za-z0-9_]+_CHORD_ONLY_EASY_MEDIUM_Letter\.pdf$/);
    assert.match(names.all, /^[A-Za-z0-9_]+_CHORD_ONLY_Letter\.pdf$/);
    app.run('setPrintPaper("a4"); downloadDeckPDF("shop", null, "easy")');
    assert.match(anchor(app).download, /_CHORD_ONLY_EASY_A4\.pdf$/);
  });

  test("tierCards runs once per scale however often the menu opens or a PDF builds", () => {
    const app = boot();
    app.run(`globalThis.__tc = 0; (function () { const real = HPE.sequence.tierCards;
      HPE.sequence.tierCards = function (d) { __tc++; return real.call(this, d); }; })()`);
    app.run('togglePrintMenu(); togglePrintMenu(); togglePrintMenu(); downloadDeckPDF("shop", null, "easy"); downloadDeckPDF("shop", null, "easy_medium");');
    assert.strictEqual(app.get("__tc"), 1);
    app.select("pygmy");
    app.run("togglePrintMenu(); togglePrintMenu();");
    assert.strictEqual(app.get("__tc"), 2, "a different scale computes its own set");
  });

  test("an option whose set is empty is disabled when the menu opens; ALL never is; an empty click builds nothing", () => {
    const app = boot();
    app.run(`HPE.sequence.tierCards = function () { return { easy: [], easyMedium: [] }; }`);
    app.run("togglePrintMenu()");
    assert.deepStrictEqual(JSON.parse(JSON.stringify(app.get("printMenuState()"))), { easy: true, easy_medium: true, all: false });
    app.run('downloadDeckPDF("shop", null, "easy")');
    assert.strictEqual(app.blobs().length, 0);
  });

  test("equal sets still show all three options enabled", () => {
    const app = boot();
    app.run(`HPE.sequence.tierCards = function () { return { easy: [0, 1], easyMedium: [0, 1] }; }`);
    app.run("togglePrintMenu()");
    assert.deepStrictEqual(JSON.parse(JSON.stringify(app.get("printMenuState()"))), { easy: false, easy_medium: false, all: false });
  });

  test("pdf_download carries cards as a short enum and still no id or name", () => {
    const app = withGa();
    app.run('downloadDeckPDF("shop", null, "easy"); downloadDeckPDF("shop", null, "easy_medium"); downloadDeckPDF("shop", null, "all");');
    const ev = pdfEvents(app);
    assert.deepStrictEqual(ev.map((e) => e.cards), ["easy", "easy_medium", "all"]);
    for (const e of ev) assert.deepStrictEqual(Object.keys(e).sort(), ["cards", "deck_kind", "paper"]);
  });

  test("no timer or focus call sits between the item click and the build", () => {
    const body = SRC.slice(SRC.indexOf("function downloadDeckPDF"), SRC.indexOf("const ISLAND ="));
    const before = body.slice(body.indexOf("  try {"), body.indexOf("HPE.pdfcards.build("));
    assert.ok(!/setTimeout|requestAnimationFrame|\.focus\(|await /.test(before), "the build runs inside the click's gesture");
  });
});

/* ------------------------------------------------- Safari storage lane B: back up saved scales */
//
// docs/plans/2026-10-30-safari-storage.md, Lane B. A readable text list of the
// saved scales' #s= links. Restore is the user tapping each link; there is no
// paste box, no dedupe, nothing written by the panel itself.

describe("backup: back up saved scales", () => {
  const BK_KEY = "hpfc.backup.v1";
  const fsx = require("node:fs");
  const open = (app) => { app.run("openPanel()"); app.els["backup-open"].click(); };
  const textOf = (app) => String(app.els["backup-text"].value);
  const linksOf = (text) => text.split("\n").filter((l) => /#s=/.test(l)).map((l) => l.trim());
  const clip = (app) => {
    const written = [];
    app.sandbox.navigator.clipboard = { writeText: async (s) => { written.push(s); } };
    return written;
  };
  const tick = () => new Promise((r) => setImmediate(r));

  test("markup: the opener follows the reset button, the panel starts hidden, the list is read-only", () => {
    const html = fsx.readFileSync(path.join(ROOT, "index.html"), "utf8");
    assert.match(html, /id="deck-restore"[^>]*>RESET SEEDED SCALES<\/button>\s*<div class="modebar">\s*<button[^>]*id="backup-open"[^>]*>BACKUP YOUR SCALES<\/button>/,
      "the opener is not right after the reset button, with its label");
    assert.match(html, /<div[^>]*id="backup-panel"[^>]*\bhidden\b/);
    assert.match(html, /<textarea[^>]*id="backup-text"[^>]*\breadonly\b/, "the list box is not read-only");
    const inputs = html.match(/<(input|textarea)\b[^>]*>/g).filter((tag) => /id="backup-/.test(tag));
    assert.ok(inputs.every((tag) => /\breadonly\b/.test(tag)), "a writable field in the backup panel is a paste box");
    const app = boot();
    assert.strictEqual(app.els["backup-panel"].hidden, true);
  });

  test("opening and closing the panel toggles aria-expanded and writes nothing", async () => {
    const app = boot();
    const before = JSON.stringify(app.store);
    open(app);
    assert.strictEqual(app.els["backup-panel"].hidden, false);
    assert.strictEqual(app.els["backup-open"].getAttribute("aria-expanded"), "true");
    app.els["backup-open"].click();
    assert.strictEqual(app.els["backup-panel"].hidden, true);
    assert.strictEqual(app.els["backup-open"].getAttribute("aria-expanded"), "false");
    assert.strictEqual(JSON.stringify(app.store), before);
  });

  test("with nothing saved the list is empty, the buttons are disabled and the panel says so", async () => {
    const app = boot();
    open(app);
    assert.strictEqual(textOf(app), "");
    for (const id of ["backup-copy", "backup-download", "backup-share"]) assert.strictEqual(app.els[id].disabled, true, id);
    assert.strictEqual(app.els["backup-status"].textContent, "No saved scales to back up yet.");
  });

  test("an open backup panel is repainted when the menu reopens after a save", async () => {
    const app = await durableBoot();
    open(app);
    assert.strictEqual(app.els["backup-status"].textContent, "No saved scales to back up yet.");
    app.run("closePanel()");
    await makeCustom(app);
    app.els["backup-text"].value = "";
    app.els["backup-status"].textContent = "No saved scales to back up yet.";
    app.run("openPanel()");
    assert.strictEqual(app.els["backup-panel"].hidden, false);
    assert.ok(linksOf(textOf(app)).length >= 1, "the list is still empty");
    assert.strictEqual(app.els["backup-copy"].disabled, false);
    assert.strictEqual(app.els["backup-status"].textContent, "");
  });

  test("an open backup panel on desktop shows the new scale after a save", async () => {
    const app = await durableBoot();
    app.run("desktopMQ.matches = true");
    open(app);
    assert.strictEqual(app.els["backup-status"].textContent, "No saved scales to back up yet.");
    await makeCustom(app);
    assert.strictEqual(app.els["backup-panel"].hidden, false);
    assert.ok(linksOf(textOf(app)).length >= 1, "the open list is stale after the save");
    assert.strictEqual(app.els["backup-copy"].disabled, false);
    assert.strictEqual(app.els["backup-status"].textContent, "");
  });

  test("the panel copy says a restored seed replacement is a new custom scale and hidden seeds are a note", () => {
    const app = boot();
    const copy = app.get('t("backup.restore")');
    assert.match(copy, /new custom scale/);
    assert.match(copy, /hidden/);
    assert.match(copy, /note/);
    assert.doesNotMatch(copy, /\bdeck\b/i, "visible text says scale, never deck");
  });

  test("session-only mode says the data will not persist; durable mode does not", async () => {
    const session = boot();
    open(session);
    assert.strictEqual(session.els["backup-session"].hidden, false);
    assert.strictEqual(session.get("savedMode"), "session");
    const durable = await durableBoot();
    open(durable);
    assert.strictEqual(durable.els["backup-session"].hidden, true);
  });

  test("round trip: every saved scale comes back from its link on a fresh profile", async () => {
    const app = await durableBoot();
    const a = await makeCustom(app);
    const b = await makeCustom(app, OTHER_STRING);
    const ids = Object.keys(savedViews(app));
    assert.deepStrictEqual(ids, [a.instanceId, b.instanceId]);
    open(app);
    const links = linksOf(textOf(app));
    assert.strictEqual(links.length, 2, "one link per saved record");
    const originalIds = Object.values(savedViews(app)).map((d) => d.id).sort();

    const fresh = await durableBoot();
    for (const link of links) {
      assert.ok(link.startsWith(fresh.sandbox.location.origin), "a backup link is absolute");
      await hashChange(fresh, link.slice(link.indexOf("#s=")));
    }
    assert.deepStrictEqual(Object.values(savedViews(fresh)).map((d) => d.id).sort(), originalIds);
  });

  test("two saved scales that share a deck id are both listed (no dedupe)", async () => {
    const app = boot();
    const a = await makeCustom(app);
    await makeCustom(app, OTHER_STRING);
    await editFields(app, a, OTHER_STRING);
    const rows = app.get("savedState.entries.length");
    assert.strictEqual(rows, 2, "precondition: both instances were saved");
    assert.strictEqual(new Set(Object.values(savedViews(app)).map((d) => d.id)).size, 1, "precondition: they share one deck id");
    open(app);
    assert.strictEqual(linksOf(textOf(app)).length, rows);
  });

  test("a seed replacement is listed without a replaces marker and restores as a custom scale beside the seed", async () => {
    const app = await durableBoot();
    await saveKurdRepainted(app);
    assert.strictEqual(app.get("savedState.entries[0].record.o.replaces"), "kurd", "precondition: the record replaces the Kurd seed");
    open(app);
    const links = linksOf(textOf(app));
    assert.strictEqual(links.length, 1);
    assert.doesNotMatch(links[0], /replaces/);

    const fresh = await durableBoot();
    await hashChange(fresh, links[0].slice(links[0].indexOf("#s=")));
    assert.strictEqual(fresh.get("savedState.entries.length"), 1);
    assert.strictEqual(fresh.get("savedState.entries[0].record.o.replaces"), undefined, "a restored link is a custom scale");
    assert.strictEqual(labels(fresh).length, 6, "the restored scale sits beside the five seeds");
    assert.strictEqual(labels(fresh).filter((l) => l.startsWith("D KURD 10")).length, 2, "the seed and the custom scale both show");
    assert.strictEqual(fresh.get("savedState.entries[0].instanceId") !== undefined, true);
  });

  test("hidden seeds appear only as a note, never as a link", async () => {
    const app = await durableBoot();
    await hideViaSheet(app, "amara", "D AMARA 9");
    open(app);
    const text = textOf(app);
    assert.strictEqual(linksOf(text).length, 0);
    assert.match(text, /D AMARA 9/);
    assert.match(text, /Hidden seeded scales/);
    assert.strictEqual(app.els["backup-copy"].disabled, true, "nothing to restore by link means nothing to copy");
  });

  test("COPY writes the list to the clipboard and stores lastBackup in its own key, not in hpfc", async () => {
    const app = await durableBoot();
    await makeCustom(app);
    const hpfc = app.store.hpfc;
    const records = plain(app.get("savedState.entries.map(row=>row.record)"));
    const envelope = savedRaw(app);
    const written = clip(app);
    open(app);
    assert.strictEqual(app.store[BK_KEY], undefined, "opening alone is not a backup");
    app.els["backup-copy"].click();
    await tick(); await tick();
    assert.deepStrictEqual(written, [textOf(app)]);
    const stored = JSON.parse(app.store[BK_KEY]);
    assert.strictEqual(typeof stored.lastBackup, "number");
    assert.strictEqual(app.store.hpfc, hpfc, "the hpfc blob is untouched");
    assert.deepStrictEqual(plain(app.get("savedState.entries.map(row=>row.record)")), records);
    assert.strictEqual(savedRaw(app), envelope, "the saved envelope did not change");
    assert.ok(records.every((r) => r.v === records[0].v));
    assert.ok(app.get("/Last backed up/.test(document.getElementById('backup-last').textContent)"));
  });

  test("writing lastBackup does not change the migration or recovery state", async () => {
    const app = await durableBoot();
    await makeCustom(app);
    clip(app);
    const before = plain(app.get("({m: savedState.migration, mode: savedMode, rec: savedRecovery, issue: savedIssue})"));
    open(app);
    app.els["backup-copy"].click();
    await tick(); await tick();
    assert.deepStrictEqual(plain(app.get("({m: savedState.migration, mode: savedMode, rec: savedRecovery, issue: savedIssue})")), before);
    const again = await durableBoot({ origin: app.fixtureOrigin });
    assert.strictEqual(again.get("savedMode"), "durable");
    assert.strictEqual(again.get("savedState.entries.length"), 1);
  });

  test("a refused clipboard leaves lastBackup unset and tells the user to select the text", async () => {
    const app = boot();
    await makeCustom(app);
    app.sandbox.navigator.clipboard = { writeText: async () => { throw new Error("denied"); } };
    open(app);
    app.els["backup-copy"].click();
    await tick(); await tick();
    assert.strictEqual(app.store[BK_KEY], undefined);
    assert.strictEqual(app.els["backup-status"].textContent, app.get('t("backup.select")'));
  });

  test("SHARE hands the list to navigator.share and records the backup", async () => {
    const app = boot();
    await makeCustom(app);
    const shared = [];
    app.sandbox.navigator.share = async (data) => { shared.push(data); };
    open(app);
    assert.strictEqual(app.els["backup-share"].hidden, false);
    app.els["backup-share"].click();
    await tick(); await tick();
    assert.strictEqual(shared.length, 1);
    assert.strictEqual(shared[0].text, textOf(app));
    assert.strictEqual(typeof JSON.parse(app.store[BK_KEY]).lastBackup, "number");
  });

  test("SHARE is absent where the platform has no share sheet", () => {
    const app = boot();
    open(app);
    assert.strictEqual(app.els["backup-share"].hidden, true);
  });

  test("a cancelled share records nothing", async () => {
    const app = boot();
    await makeCustom(app);
    app.sandbox.navigator.share = async () => { const e = new Error("x"); e.name = "AbortError"; throw e; };
    open(app);
    app.els["backup-share"].click();
    await tick(); await tick();
    assert.strictEqual(app.store[BK_KEY], undefined);
  });

  test("backing up emits no analytics event", async () => {
    const html = fsx.readFileSync(path.join(ROOT, "index.html"), "utf8");
    const block = html.slice(html.indexOf("function backupText"), html.indexOf("function backupText") + 6000);
    assert.doesNotMatch(block, /\btrack\(/, "the backup code calls track()");
  });

  test("an older share link still decodes through the same route the backup links use", async () => {
    const app = boot();
    await hashChange(app, "#s=" + "5/(D3)_A3_C4_D4_E4_F4_G4_A4_C5/*D+AEOLIAN+9/parent-aeolian/mirror/between/seats-1,0,2,3,4,5,6,7;;/975b6c");
    assert.strictEqual(app.get("savedState.entries.length"), 1);
  });

  test("the backup keys exist in all eight i18n tables", () => {
    const dir = path.join(ROOT, "data", "i18n");
    const en = JSON.parse(fsx.readFileSync(path.join(dir, "en.json"), "utf8"));
    const keys = Object.keys(en).filter((k) => k.startsWith("backup."));
    assert.ok(keys.length >= 14);
    for (const f of fsx.readdirSync(dir).filter((n) => n.endsWith(".json"))) {
      const table = JSON.parse(fsx.readFileSync(path.join(dir, f), "utf8"));
      for (const k of keys) assert.ok(typeof table[k] === "string" && table[k].length, f + " lacks " + k);
    }
  });

  test("the opener, the list and the buttons join the Tab stops only while the panel is open", () => {
    const app = boot();
    app.run("openPanel()");
    app.run("settingsPanel.querySelectorAll = () => []");
    const ids = () => app.get("panelStops().map((e) => e.id)");
    assert.ok(ids().includes("backup-open"));
    assert.ok(!ids().includes("backup-copy"));
  });
});
