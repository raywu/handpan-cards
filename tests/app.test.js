// Unit tests for the inline app in index.html, booted in tests/helpers/sandbox.js.
//
// Scope: only what tools/boot_sim.js does NOT already assert. boot_sim covers the
// boot order guard, every card in both modes rendering, <svg> presence, deck
// colours in CSS vars + markup, shuffle toggling, absence of German, 59 cards.
//
// Everything asserted here is derived from CLAUDE.md ("verified card conventions",
// "instrument layouts", "app data model") or from user-observable behaviour, never
// from restating the implementation. Field identities come from the deck data's
// NOTE NAMES, which is an independent route to the pitch-class rule the app
// implements with midi % 12.
const { test } = require("node:test");
const assert = require("node:assert");
const { boot } = require("./helpers/sandbox.js");

/* ------------------------------------------------------------------ helpers */

// Field tuple layout, per CLAUDE.md "App data model":
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
 * CLAUDE.md verified convention #1 (pitch-class-complete highlighting), derived
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

test("chordSets: Amara Gsus4 lights the ding as a chord tone", () => {
  const app = boot();
  const d = decks(app)[deckIndex(app, "amara")];
  const { blue, green } = callWithChord(app, "chordSets", "amara", "Gsus4");

  // Gsus4 = G + C + D. Amara (CLAUDE.md): ding D3, 1 A3, 2 C4, 3 D4, 4 E4,
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

test("chordSets: Amara C major has two root-coloured fields (C4 + C5)", () => {
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

test("chordSets: a Pygmy chord on a bottom note lights that bottom field", () => {
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

test("linesHTML keeps chord-spelling order, not pitch order (Amara Fmaj7)", () => {
  const app = boot();
  const d = decks(app)[deckIndex(app, "amara")];
  const ch = d.chords[chordIndex(d, "Fmaj7")];
  const html = callWithChord(app, "linesHTML", "amara", "Fmaj7");

  // CLAUDE.md convention #2: lines run in chord-spelling order from the root.
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

test("bottom-note badge appears with the right count, and only for bottom voicings", () => {
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

test("every rendered face is well-formed markup (59 cards x 2 modes)", () => {
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
  assert.strictEqual(seen, 59, "expected 59 cards across the three decks");
});

/* ------------------------------------------------------------- 5. step() */

test("step() wraps forward and backward and clears the flip", () => {
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

test("shuffle yields a valid permutation and shuffle-off restores card order", () => {
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

test("deck and mode round-trip through localStorage (subset semantics)", () => {
  const app = boot();
  const amara = decks(app).find((d) => d.id === "amara");
  app.clickChip(amara.name);
  app.run(`setMode("B")`);

  const stored = JSON.parse(app.store.hpfc);
  assert.strictEqual(stored.deck, "amara");
  assert.strictEqual(stored.mode, "B");

  // a fresh boot on that storage resumes where we left off
  const again = boot({ storage: { hpfc: app.store.hpfc } });
  assert.strictEqual(again.get("deckId"), "amara");
  assert.strictEqual(again.get("mode"), "B");
  assert.strictEqual(again.els.count.textContent, `1 / ${amara.chords.length}`);
});

test("a throwing localStorage breaks neither boot nor navigation", () => {
  const app = boot({ throwOnStorage: true });
  assert.ok(app.els.front.innerHTML.length, "app must render with storage denied");

  const amara = decks(app).find((d) => d.id === "amara");
  app.clickChip(amara.name);
  app.run(`setMode("B")`);
  app.els.next.onclick();
  app.flip();
  app.els.prev.onclick();
  assert.strictEqual(app.get("deckId"), "amara");
  assert.strictEqual(app.get("mode"), "B");
  assert.strictEqual(app.els.count.textContent, `1 / ${amara.chords.length}`);
  assert.ok(app.els.back.innerHTML.length);
});

test("an unknown stored deck id falls back to the first deck", () => {
  const app = boot({ storage: { hpfc: JSON.stringify({ deck: "nope", mode: "A" }) } });
  const first = decks(app)[0];
  assert.strictEqual(app.get("deckId"), first.id, "deckId must be renormalised, not left dangling");
  assert.strictEqual(app.els.count.textContent, `1 / ${first.chords.length}`);
  assert.ok(app.faces().includes(first.name));
  assert.strictEqual(app.cssVar("--root"), first.colors.root);

  // and the fallback is persisted as the real id, not the bogus one
  app.run(`setMode("A")`);
  assert.strictEqual(JSON.parse(app.store.hpfc).deck, first.id);
});

/* ------------------------------------------------- 10. pan() circle budget */

test("pan() draws one circle per field, two more per lit field, plus the chrome", () => {
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

const ROOT = path.join(__dirname, "..");
const SCALES = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests", "fixtures", "synthetic_scales.json"), "utf8"));

/** A synthetic fixture's scale string, by fixture name. */
function scale(name) {
  const hit = SCALES.find((s) => s.name === name);
  assert.ok(hit, `no synthetic_scales.json entry named "${name}"`);
  return hit.string;
}

const AMARA_STRING = scale("builtin amara");

/* ------------------------------------------------- 11. the engine is inlined */

test("index.html carries the whole engine inline, with no external script", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  // CLAUDE.md hard constraint: single-file app, no external JS.
  assert.ok(!/<script[^>]*\bsrc=/.test(html), "index.html loads an external script");

  const app = boot();
  const HPE = app.get("HPE");
  for (const mod of ["core", "voicing", "layout", "naming", "select", "share"]) {
    assert.strictEqual(typeof HPE[mod], "object", `HPE.${mod} missing from the app`);
  }
  // core must be visible to the modules that read it, so it loads first.
  const order = [...html.matchAll(/<!-- engine:(\w+) begin/g)].map((m) => m[1]);
  assert.deepStrictEqual(order, ["core", "voicing", "layout", "naming", "select", "share"]);
  // share is the app's share surface: encode, decode and the version it guards.
  const share = app.get("HPE.share");
  for (const key of ["encode", "decode"]) {
    assert.strictEqual(typeof share[key], "function", `HPE.share.${key} missing`);
  }
  assert.strictEqual(typeof share.VERSION, "number");
});

/* ------------------------------------------- 12. the generated deck registry */

test("a generated deck resolves through deck() without joining the DECKS literal", () => {
  const app = boot();
  const before = decks(app).length;
  const res = app.generate(AMARA_STRING);
  assert.strictEqual(res.ok, true, res.reason);

  // section 12: the id is "custom:" + 8 lowercase hex, from the seed alone.
  assert.match(res.value.id, /^custom:[0-9a-f]{8}$/);
  // the literal is untouched - validate.py and tests/paths.py both need that.
  assert.strictEqual(decks(app).length, before);
  assert.ok(!decks(app).some((d) => d.id === res.value.id));

  app.select(res.value.id);
  assert.strictEqual(app.deckId(), res.value.id);
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

test("generation runs once at submit, never inside deck() or render()", () => {
  const app = boot();
  const id = app.generate(AMARA_STRING).value.id;
  app.select(id);
  // deck() hands back the SAME object every time; nothing rebuilds per render.
  assert.strictEqual(app.get("deck() === deck()"), true);
  assert.strictEqual(app.get("deck() === CUSTOM[deckId]"), true);
  const identity = app.get(
    "(() => { const d = deck(); render(); render(); step(1); return d === deck(); })()");
  assert.strictEqual(identity, true, "render() or step() replaced the registry object");
});

test("an unknown deck id still falls back to a built-in deck", () => {
  const app = boot({ storage: { hpfc: JSON.stringify({ deck: "custom:deadbeef", mode: "A" }) } });
  assert.strictEqual(app.deckId(), decks(app)[0].id);
  assert.match(app.faces(), /<svg /);
});

test("a rejected scale leaves the selected deck and the registry alone", () => {
  const app = boot();
  const before = app.deckId();
  // ENGINE-SPEC section 17: the whole-tone subset has no fifth above the ding.
  const res = app.generate(scale("whole tone subset"));
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, "NO_FIFTH");
  assert.strictEqual(typeof res.reason, "string");
  assert.ok(res.reason.length > 0);
  assert.strictEqual(res.value, undefined, "an err result must carry no value");
  assert.strictEqual(app.deckId(), before);
  assert.deepStrictEqual(app.registry(), {});
});

test("the share version guard rejects a newer payload with NEEDS_NEWER_APP", () => {
  const app = boot();
  const current = app.get("SHARE_VERSION");
  assert.strictEqual(app.get(`checkShareVersion(${current}).ok`), true);
  const res = plain(app.get(`checkShareVersion(${current + 1})`));
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.code, "NEEDS_NEWER_APP");
  assert.match(res.reason, /newer version/i);
});

/* ------------------------------------- 13. save() persists the selected deck */

test("selecting a deck persists its id, custom decks included", () => {
  const app = boot();
  const builtIn = decks(app)[1];
  app.select(builtIn.id);
  assert.strictEqual(JSON.parse(app.store.hpfc).deck, builtIn.id);

  const id = app.generate(AMARA_STRING).value.id;
  app.select(id);
  assert.strictEqual(app.deckId(), id, "the custom deck is on screen");
  const stored = JSON.parse(app.store.hpfc);
  // Phase 4 lifted the Phase 3 guard: the seed is saved under its own key and
  // rebuilt at boot, so a stored custom id is no longer a dangling reference.
  assert.strictEqual(stored.deck, id, "the selected custom deck was not persisted");
  assert.strictEqual(stored.mode, "A", "mode must still round-trip");

  // and a mode change while a custom deck is showing keeps that deck.
  app.run('setMode("B")');
  assert.deepStrictEqual(JSON.parse(app.store.hpfc), { deck: id, mode: "B" });
});

/* --------------------------------------------- 14. pan() honours geom.ext */

test("pan() sizes a generated deck's viewBox from the solver's ext", () => {
  const app = boot();
  // The 19-field maximum is the case where the solver's extent and the
  // built-in derivation disagree (ENGINE-SPEC section 11).
  const d = app.generate(scale("nineteen field maximum")).value;
  const g = d.geom;
  assert.strictEqual(typeof g.ext, "number");
  const derived = g.bottom ? 100 * (g.bottom + g.r_bnote + g.n_out) + 14 : 106;
  assert.notStrictEqual(g.ext * 100, derived,
    "fixture no longer distinguishes ext from the derived extent");

  app.select(d.id);
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

test("the built-in decks keep the derived extent they have always rendered", () => {
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

/* ------------------------------------------- 15. generation-time budget */

// [eng-review 15A] Generation happens while the user waits, so it has a budget.
// Timed inside an already-booted app: parse + select.build + registry
// insertion, never process startup or the engine module load.
function budget(fixture, ms) {
  test(`generating ${fixture} stays inside ${ms} ms`, () => {
    const app = boot();
    const s = scale(fixture);
    app.generate(s);                 // warm the JIT; the budget is steady state
    let best = Infinity;
    for (let i = 0; i < 3; i++) {
      const t0 = process.hrtime.bigint();
      const res = app.generate(s);
      const dt = Number(process.hrtime.bigint() - t0) / 1e6;
      assert.strictEqual(res.ok, true, res.reason);
      best = Math.min(best, dt);
    }
    assert.ok(best < ms, `generation took ${best.toFixed(1)} ms, budget ${ms} ms`);
  });
}
budget("twelve note pan", 200);
budget("nineteen field maximum", 500);

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

const REASON = (app, code) => app.get(`HPE.core.REASONS[${JSON.stringify(code)}].reason`);

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

test("the deck row opens with a + ADD chip that opens the sheet, focusing the box", () => {
  const app = boot();
  const row = chipRow(app);
  assert.strictEqual(row.length, decks(app).length, "one chip per deck");
  // + ADD is the strip's FIRST child, in normal flow with the deck chips -
  // see the .chip.add comment in index.html for why first, and why in flow.
  assert.strictEqual(stripRow(app)[0].id, "deck-add",
    "+ ADD is not the first chip in the strip");

  assert.strictEqual(app.sheetOpen(), false, "the sheet starts closed");
  openSheet(app);
  assert.strictEqual(app.sheetOpen(), true);
  assert.strictEqual(app.activeId(), "scale-box", "focus moves to the scale box on open");
  // role="dialog" / aria-modal live in the markup, so e2e asserts those.
});

test("Escape closes the sheet and focus returns to + ADD", () => {
  const app = boot();
  openSheet(app);
  app.keydown("Escape");
  assert.strictEqual(app.sheetOpen(), false);
  assert.strictEqual(app.activeId(), "deck-add", "focus returns to the + ADD chip");
});

test("a tap on the backdrop closes the sheet; a tap inside it does not", () => {
  const app = boot();
  const sheet = app.els["scale-sheet"];
  openSheet(app);
  sheet.dispatchEvent({ type: "click", target: app.els["scale-box"] });
  assert.strictEqual(app.sheetOpen(), true, "a tap inside the sheet keeps it open");
  sheet.dispatchEvent({ type: "click", target: sheet });
  assert.strictEqual(app.sheetOpen(), false, "a tap on the backdrop closes it");
});

test("an empty box shows the parse hint and Generate is disabled", () => {
  const app = boot();
  openSheet(app);
  app.type("");
  assert.match(app.els["scale-parse"].textContent, /^Type your ding first/);
  assert.strictEqual(app.els["scale-generate"].disabled, true);
  assert.strictEqual(app.els["scale-msg"].textContent, "");
});

test("a valid scale fills the parse line with the ding and the numbered notes", () => {
  const app = boot();
  openSheet(app);
  app.type(scale("omitted ding octave"));       // "(D) A C D E F G A C"
  const line = app.els["scale-parse"].textContent;
  assert.match(line, /^Ding D3 \| 1 A3 2 C4 3 D4 /, `parse line was "${line}"`);
  assert.strictEqual(app.els["scale-generate"].disabled, false);
  assert.strictEqual(app.els["scale-msg"].textContent, "", "a valid scale shows no message");
});

test("bottom notes reach the parse line under their own U labels", () => {
  const app = boot();
  openSheet(app);
  app.type(scale("bottom notes after bar"));
  assert.match(app.els["scale-parse"].textContent, /U1 C3 U2 E3$/);
});

for (const [fixture, code] of [
  ["no ding", "NO_DING"],
  ["whole tone subset", "NO_FIFTH"],
  ["fourteen top notes", "TOO_MANY_RIM"],
  ["bad note token", "BAD_NOTE"],
  ["midi out of range", "NOTE_OUT_OF_RANGE"],
  ["bottom note below the inferred one before it", "NOTE_OUT_OF_ORDER"],
  ["duplicate field", "NOTE_REPEATED"],
]) {
  test(`${code} shows the engine's own sentence and keeps Generate disabled`, () => {
    const app = boot();
    openSheet(app);
    app.type(scale(fixture));
    const msg = app.els["scale-msg"];
    assert.strictEqual(msg.classList.contains("err"), true, "error tier not applied");
    assert.ok(msg.textContent.length > 0, "no message rendered");
    // The reason is the engine's, with its substitutions already applied.
    const template = REASON(app, code).replace(/<[^>]+>/g, "");
    for (const word of template.split(/\s+/).filter((w) => w.length > 3).slice(0, 3)) {
      assert.ok(msg.textContent.includes(word),
        `"${msg.textContent}" does not read like ${code}'s reason "${template}"`);
    }
    assert.strictEqual(app.els["scale-generate"].disabled, true);
    assert.strictEqual(app.els["scale-box"].classList.contains("bad"), true,
      "the box keeps the text and gains the error outline");
    assert.strictEqual(app.els["scale-box"].value, scale(fixture));
  });
}

test("Generate builds the deck, closes the sheet, selects it and announces the count", () => {
  const app = boot();
  openSheet(app);
  app.type(AMARA_STRING);
  app.els["scale-generate"].click();

  assert.strictEqual(app.sheetOpen(), false, "the sheet closes on success");
  const ids = Object.keys(app.registry());
  assert.strictEqual(ids.length, 1);
  const d = app.registry()[ids[0]];
  assert.strictEqual(app.deckId(), d.id, "the generated deck is selected");
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
  assert.strictEqual(stripRow(app)[0].id, "deck-add",
    "a generate left + ADD somewhere other than the head of the strip");
});

test("the one-time layout hint is appended on the first generation of a deck, not the second", () => {
  const app = boot();
  openSheet(app);
  app.type(AMARA_STRING);
  app.els["scale-generate"].click();
  const first = app.announcer().textContent;
  assert.match(first, /LEFT-FIRST \/ RIGHT-FIRST/, `first message was "${first}"`);

  openSheet(app);
  app.type(AMARA_STRING);
  app.els["scale-generate"].click();
  const second = app.announcer().textContent;
  assert.doesNotMatch(second, /LEFT-FIRST \/ RIGHT-FIRST/,
    `the hint fired twice: "${second}"`);
});

test("a same-id generate replaces the deck in place, keeps the id and says Updated", () => {
  const app = boot();
  openSheet(app);
  app.type(AMARA_STRING);
  app.els["scale-generate"].click();
  const id = app.deckId();
  const before = app.registry()[id];

  // Same notes, a different palette: D14 keeps options out of the id.
  openSheet(app);
  app.type(AMARA_STRING);
  app.els["scale-swatches"].children[3].click();
  app.els["scale-generate"].click();

  assert.deepStrictEqual(Object.keys(app.registry()), [id], "a second entry appeared");
  assert.strictEqual(app.deckId(), id, "the replaced deck is not selected");
  const after = app.registry()[id];
  assert.strictEqual(after.options.palette, 3, "the new palette did not land");
  assert.deepStrictEqual(after.chords, before.chords, "the cards changed");
  assert.ok(app.announcer().textContent.startsWith(`Updated ${after.name}`),
    `announced "${app.announcer().textContent}"`);
});

test("the success path reads deck.warnings without generating a second time", () => {
  const app = boot();
  app.run(`
    globalThis.__buildCalls = 0;
    const __realBuild = HPE.select.build;
    HPE.select.build = function (seed) { globalThis.__buildCalls += 1; return __realBuild(seed); };
  `);
  openSheet(app);
  app.type(scale("three pitch classes"));       // a pan with no thirds
  app.els["scale-generate"].click();

  assert.strictEqual(app.get("__buildCalls"), 1, "select.build ran more than once");
  const d = app.registry()[app.deckId()];
  assert.ok(d.warnings.length > 0, "this fixture is meant to warn");
  const said = app.announcer();
  assert.strictEqual(said.classList.contains("warn"), true, "warning tier not applied");
  for (const w of d.warnings) assert.ok(said.textContent.includes(w.reason),
    `"${said.textContent}" is missing "${w.reason}"`);
});

test("the mirror pair defaults to right-first and carries the choice into the deck", () => {
  const app = boot();
  openSheet(app);
  assert.strictEqual(app.els["scale-mirror-r"].classList.contains("on"), true,
    "right-first is the default (D12)");
  assert.strictEqual(app.els["scale-mirror-l"].classList.contains("on"), false);

  app.type(AMARA_STRING);
  app.els["scale-mirror-l"].click();
  assert.strictEqual(app.els["scale-mirror-l"].classList.contains("on"), true);
  assert.strictEqual(app.els["scale-mirror-r"].classList.contains("on"), false);
  app.els["scale-generate"].click();
  // ENGINE-SPEC section 13: mirror true = left-first.
  assert.strictEqual(app.registry()[app.deckId()].options.mirror, true);
});

test("six palette swatches carry the D6 indices and the selected one is ringed", () => {
  const app = boot();
  openSheet(app);
  const dots = app.els["scale-swatches"].children;
  const palettes = app.get("HPE.select.PALETTES");
  assert.strictEqual(dots.length, 6, "the D6 set is six swatches");
  assert.strictEqual(dots.filter((d) => d.classList.contains("sel")).length, 1);
  assert.strictEqual(dots[0].classList.contains("sel"), true, "index 0 is the default");
  for (let i = 0; i < 6; i++) {
    assert.strictEqual(dots[i].style._props["--dga"], palettes[i].root, `swatch ${i} root`);
    assert.strictEqual(dots[i].style._props["--dgb"], palettes[i].tone, `swatch ${i} tone`);
  }

  app.type(AMARA_STRING);
  dots[4].click();
  assert.strictEqual(app.els["scale-swatches"].children[4].classList.contains("sel"), true);
  app.els["scale-generate"].click();
  const d = app.registry()[app.deckId()];
  assert.strictEqual(d.options.palette, 4);
  assert.strictEqual(d.colors.root, palettes[4].root);
});

test("a custom chip label is capped at 16 characters with an ellipsis", () => {
  const app = boot();
  openSheet(app);
  app.type(AMARA_STRING);
  app.els["scale-generate"].click();
  const id = app.deckId();
  // Phase 4 lets a user rename; the display cap is the UI's, not the engine's.
  app.run(`CUSTOM[${JSON.stringify(id)}].name = "A RIDICULOUSLY LONG PAN NAME"`);
  app.select(id);
  const label = chipRow(app).find((c) => c.on).label;
  assert.strictEqual(label.length, 16, `chip label "${label}" is not capped at 16`);
  assert.ok(label.endsWith("…"), `chip label "${label}" is not ellipsised`);
});

test("arrow keys do not step the card while the sheet is open", () => {
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
  return plain(app.get(`shareLink(CUSTOM[${JSON.stringify(id)}])`));
}

/** The share string out of a link the app made. */
const payload = (url) => url.slice(url.indexOf("#s=") + 3);

function openShare(app, text) {
  return plain(app.get(`openShare(${JSON.stringify(String(text))})`));
}

/* ------------------------------------------------ 17. one version constant */

test("the app's share version IS the engine's, not a second copy of the number", () => {
  const app = boot();
  assert.strictEqual(app.get("SHARE_VERSION"), app.get("HPE.share.VERSION"),
    "SHARE_VERSION and HPE.share.VERSION have diverged");
  // Equal values are not enough: a restated literal is equal today and wrong
  // the day either side is bumped, so the app must DERIVE the constant.
  const src = appScript(app);
  const decl = /\bSHARE_VERSION\s*=\s*([^;\n]+)/.exec(src);
  assert.ok(decl, "the app no longer declares SHARE_VERSION");
  assert.match(decl[1], /HPE\.share\.VERSION/,
    `SHARE_VERSION is restated as "${decl[1].trim()}" instead of read from the engine`);
});

/* ------------------------------------------- 18. the share version guard */

test("checkShareVersion rejects a version that is not a finite number", () => {
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

test("a newer share string reaches the user as section 2's NEEDS_NEWER_APP sentence", () => {
  const app = boot();
  const id = app.generate(AMARA_STRING).value.id;
  const url = link(app, id);
  assert.strictEqual(url.ok, true, url.reason);

  // decode reads the version byte BEFORE the checksum, so bumping the leading
  // character is exactly the PWA case: a cached old app opening a newer link.
  // The alphabet puts the digits first, so version N is the plain digit N; it
  // is spelled out here rather than read out of the engine (CONTRACT rule 2).
  const VERSION_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
                        "abcdefghijklmnopqrstuvwxyz-_";
  const newer = VERSION_CHARS.charAt(app.get("SHARE_VERSION") + 1) +
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

test("a corrupt share string surfaces BAD_NOTE's reason and changes nothing", () => {
  const app = boot();
  const id = app.generate(AMARA_STRING).value.id;
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
  assert.strictEqual(app.deckId(), id, "a corrupt link changed the selected deck");
});

/* ------------------------------------------------- 19. the share round trip */

test("a share link restores the exact deck, and options never move the id", () => {
  const app = boot();
  const made = app.generate(AMARA_STRING).value;
  const url = link(app, made.id);
  assert.strictEqual(url.ok, true, url.reason);
  assert.ok(url.value.includes("#s="), `share link was "${url.value}"`);

  // a second app, with nothing stored, opens the link
  const other = boot();
  assert.deepStrictEqual(other.registry(), {});
  const res = openShare(other, payload(url.value));
  assert.strictEqual(res.ok, true, res.reason);
  // D14: core.deckId hashes formatSeed(fields) only.
  assert.strictEqual(res.value.id, made.id, "the restored deck is a different deck");
  assert.strictEqual(other.deckId(), made.id, "the restored deck is not selected");
  assert.strictEqual(res.value.chords.length, made.chords.length);
  assert.strictEqual(other.els.count.textContent, `1 / ${made.chords.length}`);
  assert.match(other.faces(), /<svg /);

  // and the options ride beside the fields without ever entering the hash
  const third = boot();
  const recoloured = third.generate(AMARA_STRING, { palette: 4, mirror: true }).value;
  assert.strictEqual(recoloured.id, made.id, "an option changed the deck id");
  const back = openShare(boot(), payload(link(third, recoloured.id).value));
  assert.strictEqual(back.ok, true, back.reason);
  assert.strictEqual(back.value.options.palette, 4, "the palette did not survive the link");
  assert.strictEqual(back.value.options.mirror, true, "the mirror did not survive the link");
  assert.strictEqual(back.value.id, made.id);
});

test("consuming a share link runs select.build exactly once", () => {
  const app = boot();
  const url = link(app, app.generate(AMARA_STRING).value.id).value;

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

test("writing the app's own keys leaves a sibling key in hpfc untouched", () => {
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

test("a generated deck survives a reload, rebuilt from its saved seed", () => {
  const app = boot();
  openSheet(app);
  app.type(AMARA_STRING);
  app.els["scale-generate"].click();
  const id = app.deckId();
  assert.match(id, /^custom:/);

  // the SEED is what is stored, under its own key - never the built deck
  const key = app.get("SCALES_KEY");
  assert.notStrictEqual(key, "hpfc", "saved scales must not live inside hpfc");
  const saved = JSON.parse(app.store[key]);
  assert.strictEqual(saved.length, 1);
  assert.strictEqual(JSON.stringify(saved).includes("chords"), false,
    "the built deck was persisted; D14 stores the seed only");
  assert.strictEqual(JSON.parse(app.store.hpfc).deck, id,
    "a selected custom deck must now persist (Phase 4 lifts the Phase 3 guard)");

  const again = boot({ storage: { hpfc: app.store.hpfc, [key]: app.store[key] } });
  assert.ok(Object.keys(again.registry()).includes(id), "the saved scale was not rebuilt");
  assert.strictEqual(again.deckId(), id, "the custom deck did not survive the reload");
  assert.strictEqual(again.els.count.textContent,
    `1 / ${again.registry()[id].chords.length}`);
  assert.match(again.faces(), /<svg /);
  assert.strictEqual(again.announcer().textContent, "",
    "a deck that WAS restored must not be reported missing");
});

test("a corrupt saved scale is dropped and the app still boots on the built-ins", () => {
  const key = boot().get("SCALES_KEY");
  for (const raw of ["{{{ not json", "null", '"a string"', "[null, 7]",
                     '[{"s": "not a scale at all"}]',
                     '[{"v": 99, "s": "(D) A C D E F G A C"}]',
                     '[{"v": "x", "s": "(D) A C D E F G A C"}]']) {
    const again = boot({ storage: { hpfc: JSON.stringify({ deck: "amara", mode: "A" }), [key]: raw } });
    assert.strictEqual(again.deckId(), "amara", `boot broke on saved scales ${raw}`);
    assert.deepStrictEqual(again.registry(), {}, `an unusable record was rebuilt from ${raw}`);
    assert.match(again.faces(), /<svg /);
  }
});

/* --------------------------------- 21. the two fallbacks are distinguished */

test("an unknown BUILT-IN deck id falls back silently; a missing custom: id says so", () => {
  const first = boot().get("DECKS")[0];

  // 21a. an unknown built-in id: SILENT. This is the Phase 3 behaviour the
  // plan marks as must-not-weaken, asserted here beside the noisy path.
  const stale = boot({ storage: { hpfc: JSON.stringify({ deck: "nope", mode: "A" }) } });
  assert.strictEqual(stale.deckId(), first.id);
  assert.strictEqual(stale.announcer().textContent, "",
    "an unknown built-in id must fall back without a word");

  // 21b. a missing custom: id: the saved scale is gone, and the user is told.
  const gone = boot({ storage: { hpfc: JSON.stringify({ deck: "custom:deadbeef", mode: "A" }) } });
  assert.strictEqual(gone.deckId(), first.id);
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
test("a non-string stored deck id is ignored and never eats a share link", () => {
  const first = boot().get("DECKS")[0];

  const seeded = boot();
  const made = seeded.generate(AMARA_STRING).value;
  const url = link(seeded, made.id);
  assert.strictEqual(url.ok, true, url.reason);
  const hash = "#s=" + payload(url.value);

  for (const bad of [5, {}, true, null, [1, 2]]) {
    const raw = JSON.stringify({ deck: bad, mode: "A" });

    const again = boot({ storage: { hpfc: raw } });
    assert.strictEqual(again.deckId(), first.id, `boot broke on hpfc = ${raw}`);
    assert.match(again.faces(), /<svg /);
    assert.strictEqual(again.announcer().textContent, "",
      `a non-string deck id must fall back without a word (${raw})`);

    const shared = boot({
      storage: { hpfc: raw },
      href: "https://example.test/index.html" + hash,
    });
    assert.strictEqual(shared.deckId(), made.id,
      `the share link was dropped when hpfc was ${raw}`);
    assert.match(shared.faces(), /<svg /);
  }
});

/* ------------------------------------------------- 22. the Edit sheet (4c) */

/** Generate a scale through the sheet and hand back the registered deck. */
function makeCustom(app, text = AMARA_STRING) {
  openSheet(app);
  app.type(text);
  app.els["scale-generate"].click();
  return app.registry()[app.deckId()];
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

const editRowsShown = (app) => ["scale-name-row", "scale-degrees-row", "scale-delete-row"]
  .map((id) => !app.els[id].hasAttribute("hidden"));

test("tapping the already-selected custom chip opens the sheet in Edit state, prefilled", () => {
  const app = boot();
  const d = makeCustom(app);

  // a NON-selected chip still just selects; it never opens the sheet
  app.clickChip("D AMARA 9");
  assert.strictEqual(app.sheetOpen(), false, "a non-selected chip opened the sheet");
  assert.strictEqual(app.deckId(), "amara", "a non-selected chip did not select its deck");

  app.select(d.id);
  app.clickChip(d.name);
  assert.strictEqual(app.sheetOpen(), true, "the selected custom chip did not open the sheet");
  // 8A: the box shows the CANONICAL seed string, not whatever was typed.
  assert.strictEqual(app.els["scale-box"].value, app.get(
    `HPE.core.formatSeed(CUSTOM[${JSON.stringify(d.id)}].fields)`),
    "the Edit box is not prefilled with formatSeed(fields)");
  assert.strictEqual(app.els["scale-name"].value, d.name, "the Name field is not prefilled");
  assert.deepStrictEqual(editRowsShown(app), [true, true, true],
    "an Edit-only row is still hidden");
  assert.strictEqual(app.els["scale-generate"].textContent, "SAVE CHANGES");
  assert.strictEqual(app.els["scale-generate"].disabled, false,
    "SAVE CHANGES is the single enabled primary and must be live on a valid seed");
  // The DELETE THIS DECK copy lives in the markup, so e2e reads it; here the
  // link only has to be wired to the deck the sheet is editing.
  assert.strictEqual(typeof app.els["scale-delete"].onclick, "function",
    "the delete link is not wired");
});

test("+ ADD after an Edit opens a clean create sheet, never the edited deck's seed", () => {
  const app = boot();
  const d = makeCustom(app);
  app.select(d.id);
  app.clickChip(d.name);
  app.keydown("Escape");

  openSheet(app);
  assert.strictEqual(app.els["scale-box"].value, "", "the create box kept the edited seed");
  assert.deepStrictEqual(editRowsShown(app), [false, false, false],
    "an Edit-only row is visible on the create path");
  assert.strictEqual(app.els["scale-generate"].textContent, "GENERATE CARDS");
  assert.strictEqual(app.els["scale-generate"].disabled, true);
});

test("the Degrees select lists the parent candidates with the inferred one preselected", () => {
  const app = boot();
  const d = makeCustom(app);
  app.select(d.id);
  app.clickChip(d.name);

  const parents = arr(app.get("HPE.naming.PARENTS")).map((p) => p.name);
  const opts = app.els["scale-degrees"].children;
  assert.deepStrictEqual(opts.map((o) => o.value), parents.map((_, i) => String(i)),
    "the Degrees select does not carry the fixed parent list order");
  assert.deepStrictEqual(opts.map((o) => o.textContent), parents);
  assert.strictEqual(app.els["scale-degrees"].value, String(d.options.parent),
    "the inferred parent is not preselected");

  // D10: the override is the parent INDEX, and it relabels the degrees.
  const other = d.options.parent === 0 ? 1 : 0;
  app.els["scale-degrees"].value = String(other);
  app.els["scale-generate"].click();
  const after = app.registry()[d.id];
  assert.strictEqual(after.options.parent, other, "the Degrees choice did not reach the deck");
  assert.notDeepStrictEqual(after.degrees, d.degrees,
    "a different parent produced identical degree labels");
});

test("the Edit sheet shows deck.warnings from the registry with no generation call", () => {
  const app = boot();
  const d = makeCustom(app, scale("three pitch classes"));   // a pan with no thirds
  assert.ok(d.warnings.length > 0, "this fixture is meant to warn");
  app.select(d.id);

  const calls = spyBuild(app);
  app.clickChip(d.name);
  assert.strictEqual(calls(), 0, "opening the Edit sheet regenerated the deck");
  const said = app.els["scale-msg"];
  assert.strictEqual(said.classList.contains("warn"), true, "warning tier not applied");
  for (const w of d.warnings) assert.ok(said.textContent.includes(w.reason),
    `"${said.textContent}" is missing "${w.reason}"`);
});

test("saving from the Edit sheet regenerates exactly once (13A)", () => {
  const app = boot();
  const d = makeCustom(app);
  app.select(d.id);
  app.clickChip(d.name);

  const calls = spyBuild(app);
  app.els["scale-generate"].click();
  assert.strictEqual(calls(), 1, "a save must run select.build exactly once");
  assert.strictEqual(app.sheetOpen(), false, "the sheet stays open after a save");
});

test("changing only an option keeps the deck id and moves the share URL", () => {
  const app = boot();
  const d = makeCustom(app);
  app.select(d.id);
  const before = link(app, d.id);
  assert.strictEqual(before.ok, true, before.reason);

  app.clickChip(d.name);
  app.els["scale-swatches"].children[3].click();
  app.els["scale-mirror-l"].click();
  app.els["scale-degrees"].value = String(d.options.parent === 0 ? 1 : 0);
  app.els["scale-name"].value = "MY PAN";
  app.els["scale-name"].dispatchEvent({ type: "input" });
  app.els["scale-generate"].click();

  // D14: options are never hashed, so the id is a pure function of the fields.
  assert.deepStrictEqual(Object.keys(app.registry()), [d.id], "a second entry appeared");
  assert.strictEqual(app.deckId(), d.id, "an option change moved the id");
  const after = app.registry()[d.id];
  assert.strictEqual(after.options.palette, 3);
  assert.strictEqual(after.options.mirror, true);
  assert.strictEqual(after.name, "MY PAN");
  const now = link(app, d.id);
  assert.strictEqual(now.ok, true, now.reason);
  assert.notStrictEqual(now.value, before.value, "the options never reached the share URL");
});

test("changing the FIELDS on save mints a new deck id", () => {
  const app = boot();
  const d = makeCustom(app);
  app.select(d.id);
  app.clickChip(d.name);
  app.type(scale("builtin hijaz"));
  app.els["scale-generate"].click();

  const made = app.registry()[app.deckId()];
  assert.notStrictEqual(made.id, d.id, "a different pan kept the old id");
  assert.strictEqual(made.id,
    app.get(`HPE.core.deckId(CUSTOM[${JSON.stringify(made.id)}].fields)`));
});

test("renaming keeps the id, relabels the chip and survives a reload", () => {
  const app = boot();
  const d = makeCustom(app);
  app.select(d.id);
  app.clickChip(d.name);
  app.els["scale-name"].value = "RAY'S PAN";
  app.els["scale-name"].dispatchEvent({ type: "input" });
  app.els["scale-generate"].click();

  assert.strictEqual(app.deckId(), d.id, "a rename moved the id");
  const row = chipRow(app);
  assert.ok(row.some((c) => c.label === "RAY'S PAN" && c.on),
    `the chip row still reads ${JSON.stringify(row.map((c) => c.label))}`);

  const key = app.get("SCALES_KEY");
  const again = boot({ storage: { hpfc: app.store.hpfc, [key]: app.store[key] } });
  assert.strictEqual(again.registry()[d.id].name, "RAY'S PAN",
    "the new name was not stored with the seed");
});

test("deleting the SELECTED custom deck falls back to a built-in, says so, and stays gone", () => {
  const app = boot();
  const first = decks(app)[0];
  const d = makeCustom(app);
  app.select(d.id);
  app.clickChip(d.name);
  app.els["scale-delete"].click();

  assert.strictEqual(app.sheetOpen(), false, "delete left the sheet open");
  assert.deepStrictEqual(app.registry(), {}, "the deck is still in the registry");
  assert.strictEqual(app.deckId(), first.id, "delete did not fall back to the first built-in");
  const said = app.announcer();
  assert.ok(said.textContent.includes(d.name),
    `the delete message must name the deck removed: "${said.textContent}"`);
  assert.ok(said.textContent.includes(first.name),
    `the delete message must name the deck now showing: "${said.textContent}"`);
  assert.match(app.faces(), /<svg /);

  // it must not come back on the next boot
  const key = app.get("SCALES_KEY");
  assert.deepStrictEqual(JSON.parse(app.store[key] || "[]"), [],
    "the seed record survived the delete");
  const again = boot({ storage: { hpfc: app.store.hpfc, [key]: app.store[key] || "[]" } });
  assert.deepStrictEqual(again.registry(), {}, "the deleted deck came back on the next boot");
  assert.strictEqual(again.deckId(), first.id);
  assert.strictEqual(again.announcer().textContent, "",
    "the fallback was already persisted; the next boot must be silent");
});

test("deleting a NON-selected custom deck leaves the selection alone", () => {
  const app = boot();
  const a = makeCustom(app);
  const b = makeCustom(app, OTHER_STRING);
  app.select(b.id);
  const said = app.announcer().textContent;
  app.run(`deleteDeck(${JSON.stringify(a.id)})`);

  assert.strictEqual(app.deckId(), b.id, "deleting another deck moved the selection");
  assert.deepStrictEqual(Object.keys(app.registry()), [b.id]);
  assert.strictEqual(app.announcer().textContent, said,
    "deleting a deck the user is not looking at must not announce a fallback");
  const row = chipRow(app);
  assert.strictEqual(row.some((c) => c.label === a.name), false, "the chip is still in the row");
});

/* ------------------------------------------- 23. the LAYOUT section (5) */
//
// Phase 5 / D5. A generated layout is a GUESS; the real pan may have the same
// notes in a different arrangement. The LAYOUT section corrects it - rotate the
// rim, move a single note - entirely from the keyboard, and the correction
// travels in the share URL as options.order without moving the deck id (D5-5).

/** The note under each solved position, left to right. */
const slotLabels = (app) => app.els["scale-slots"].children.map((b) => b.textContent);

/** The position the slot list currently has selected. */
const slotSelected = (app) =>
  app.els["scale-slots"].children.findIndex((b) => b.getAttribute("aria-pressed") === "true");

/** Press a key on the slot list, as a keyboard user does. */
function slotKey(app, key) {
  let prevented = false;
  app.els["scale-slots"].dispatchEvent(
    { type: "keydown", key, preventDefault() { prevented = true; } });
  return prevented;
}

const LAYOUT_IDS = ["scale-layout-row", "scale-rot-l", "scale-rot-r", "scale-slots",
                    "scale-move-l", "scale-move-r", "scale-layout-reset"];

function openEdit(app, d) {
  app.select(d.id);
  app.clickChip(d.name);
}

test("the LAYOUT section is Edit-only, like the other correction rows", () => {
  const app = boot();
  const d = makeCustom(app);
  assert.strictEqual(app.els["scale-layout-row"].hasAttribute("hidden"), true,
    "the create sheet offers a layout correction for a pan that does not exist yet");
  openEdit(app, d);
  assert.strictEqual(app.els["scale-layout-row"].hasAttribute("hidden"), false,
    "the Edit sheet hides the layout correction");
});

test("the slot list shows every non-ding note in the solved order", () => {
  const app = boot();
  const d = makeCustom(app);
  openEdit(app, d);

  const ids = Object.keys(d.fields).filter((id) => d.fields[id][F_ZONE] !== "ding");
  assert.strictEqual(app.els["scale-slots"].children.length, ids.length,
    "the slot list is not one control per non-ding field");
  // Every note is present exactly once, and the ding is not among them.
  const shown = slotLabels(app).slice().sort();
  const want = ids.map((id) => d.fields[id][F_NAME] + d.fields[id][F_OCT]).sort();
  assert.deepStrictEqual(shown, want, "the slot list is not the pan's non-ding notes");
  for (const b of app.els["scale-slots"].children) {
    assert.ok(String(b.getAttribute("aria-label") || "").length > 0,
      "a slot control has no accessible name");
  }
});

test("ROTATE moves every note one position and SAVE keeps the id but moves the link", () => {
  const app = boot();
  const d = makeCustom(app);
  const before = link(app, d.id);
  assert.strictEqual(before.ok, true, before.reason);
  openEdit(app, d);

  const was = slotLabels(app);
  app.els["scale-rot-r"].click();
  const now = slotLabels(app);
  assert.notDeepStrictEqual(now, was, "ROTATE did not move anything");
  assert.deepStrictEqual(now.slice().sort(), was.slice().sort(),
    "ROTATE invented or lost a note");

  app.els["scale-generate"].click();
  assert.strictEqual(app.deckId(), d.id, "a layout correction moved the deck id (D5-5)");
  const after = app.registry()[d.id];
  assert.ok(Array.isArray(after.options.order), "the correction did not reach the deck");
  const moved = link(app, d.id);
  assert.strictEqual(moved.ok, true, moved.reason);
  assert.notStrictEqual(moved.value, before.value,
    "the correction never reached the share URL (D5-5)");
});

test("a correction is reachable with the keyboard alone: arrows select, MOVE swaps", () => {
  const app = boot();
  const d = makeCustom(app);
  openEdit(app, d);

  const was = slotLabels(app);
  assert.strictEqual(slotSelected(app), 0, "no position is selected to begin with");
  assert.strictEqual(slotKey(app, "ArrowRight"), true,
    "the arrow key was not handled by the slot list");
  assert.strictEqual(slotSelected(app), 1, "ArrowRight did not move the selection");
  slotKey(app, "ArrowLeft");
  assert.strictEqual(slotSelected(app), 0, "ArrowLeft did not move the selection back");
  slotKey(app, "ArrowRight");

  app.els["scale-move-r"].click();
  const now = slotLabels(app);
  assert.strictEqual(now[1], was[2], "MOVE did not move the selected note");
  assert.strictEqual(now[2], was[1], "MOVE did not displace the note it passed");
  assert.strictEqual(slotSelected(app), 2, "the selection did not follow the note");
  for (let i = 0; i < was.length; i += 1) {
    if (i === 1 || i === 2) continue;
    assert.strictEqual(now[i], was[i], `MOVE disturbed position ${i}`);
  }

  // Only the selected slot is a tab stop; the others are reached with arrows.
  const stops = app.els["scale-slots"].children.filter((b) => b.tabIndex === 0);
  assert.strictEqual(stops.length, 1, "the slot list is not a single tab stop");
});

test("RESET clears the correction to ABSENT in one action, not to the identity", () => {
  const app = boot();
  const d = makeCustom(app);
  // The baseline is a save that corrects NOTHING: an Edit always commits the
  // name too, so only an uncorrected save isolates what `order` costs.
  openEdit(app, d);
  app.els["scale-generate"].click();
  const before = link(app, d.id);
  openEdit(app, app.registry()[d.id]);
  app.els["scale-rot-r"].click();
  app.els["scale-generate"].click();
  assert.notStrictEqual(link(app, d.id).value, before.value);

  openEdit(app, app.registry()[d.id]);
  app.els["scale-layout-reset"].click();
  app.els["scale-generate"].click();

  const after = app.registry()[d.id];
  assert.strictEqual(after.options.order === undefined || after.options.order === null, true,
    "RESET left an identity permutation on the deck instead of clearing it");
  assert.strictEqual(link(app, d.id).value, before.value,
    "RESET did not restore the byte-for-byte default share link");
});

test("rotating all the way round is absent again, never a stored identity", () => {
  const app = boot();
  const d = makeCustom(app);
  openEdit(app, d);
  app.els["scale-generate"].click();
  const before = link(app, d.id);
  const plain0 = app.registry()[d.id].fields;
  openEdit(app, app.registry()[d.id]);
  const rim = Object.keys(d.fields).filter((id) => d.fields[id][F_ZONE] === "rim").length;
  for (let i = 0; i < rim; i += 1) app.els["scale-rot-r"].click();
  app.els["scale-generate"].click();

  assert.deepStrictEqual(app.registry()[d.id].fields, plain0,
    "a full rotation did not come back to the generated layout");
  assert.strictEqual(link(app, d.id).value, before.value,
    "a full rotation left a longer link than the default");
});

test("a correction survives a save, a reopen and a reload", () => {
  const app = boot();
  const d = makeCustom(app);
  openEdit(app, d);
  app.els["scale-rot-r"].click();
  const corrected = slotLabels(app);
  app.els["scale-generate"].click();

  openEdit(app, app.registry()[d.id]);
  assert.deepStrictEqual(slotLabels(app), corrected,
    "reopening the sheet forgot the correction");
  app.keydown("Escape");

  const key = app.get("SCALES_KEY");
  const again = boot({ storage: { hpfc: app.store.hpfc, [key]: app.store[key] } });
  assert.deepStrictEqual(again.registry()[d.id].fields, app.registry()[d.id].fields,
    "the correction did not survive a reload");
});

test("a correction travels in a share link and lands on the same deck id", () => {
  const app = boot();
  const d = makeCustom(app);
  openEdit(app, d);
  app.els["scale-rot-r"].click();
  app.els["scale-generate"].click();
  const url = link(app, d.id);
  assert.strictEqual(url.ok, true, url.reason);

  const opened = boot({ href: "https://example.test/index.html#s=" + payload(url.value) });
  assert.strictEqual(opened.deckId(), d.id, "the shared correction landed on a different deck");
  assert.deepStrictEqual(opened.registry()[d.id].fields, app.registry()[d.id].fields,
    "the shared layout is not the corrected one");
});

test("Escape closes the sheet without keeping the previewed correction", () => {
  const app = boot();
  const d = makeCustom(app);
  openEdit(app, d);
  app.els["scale-rot-r"].click();
  app.keydown("Escape");

  assert.strictEqual(app.sheetOpen(), false, "Escape did not close the sheet");
  assert.deepStrictEqual(app.registry()[d.id].fields, d.fields,
    "an abandoned preview was left on the deck");
});

test("the layout controls are tab stops inside the sheet and never a second primary", () => {
  const app = boot();
  const d = makeCustom(app);
  openEdit(app, d);

  const seen = new Set();
  for (let i = 0; i < 40; i += 1) {
    app.els["scale-sheet"].dispatchEvent(
      { type: "keydown", key: "Tab", shiftKey: false, preventDefault() {} });
    seen.add(app.activeId());
  }
  for (const id of ["scale-rot-l", "scale-rot-r", "scale-move-l", "scale-move-r",
                    "scale-layout-reset"]) {
    assert.ok(seen.has(id), `Tab never reached #${id}`);
  }
  assert.ok([...seen].some((id) => String(id).startsWith("scale-slot-")),
    "Tab never reached the slot list");
  assert.strictEqual(app.els["scale-generate"].textContent, "SAVE CHANGES",
    "the single primary was relabelled by the layout section");
  assert.strictEqual(app.els["scale-generate"].disabled, false,
    "the layout section disabled the sheet's only primary");
});

test("the layout markup exists and a built-in deck is never editable", () => {
  const app = boot();
  for (const id of LAYOUT_IDS) assert.ok(app.els[id], `#${id} is missing from the markup`);
  app.select("amara");
  app.clickChip("D AMARA 9");
  assert.strictEqual(app.sheetOpen(), false,
    "a built-in chip opened the sheet, so it could be corrected");
});

/* ------------------------------- 24. a field edit REPLACES the deck (row 73) */
//
// Owner decision on coordination-doc queue row 73 (2026-09-09): "Edit means
// edit." D14 makes the id the hash of the FIELDS, so editing the notes cannot
// keep the id - but the OLD record must not survive the edit. The new deck
// takes the old one's chip position, its selection and a name re-derived from
// its own fields, so the row never shows two chips a user cannot tell apart.
// A user who wants a fork pastes the seed into "+ ADD".

/** Open Edit on a custom deck and save a DIFFERENT scale string into it. */
function editFields(app, d, text) {
  app.select(d.id);
  app.clickChip(d.name);
  app.type(text);
  app.els["scale-generate"].click();
  return app.deckId();
}

const EDIT_MORE = AMARA_STRING + " D5";      // one note appended: new fields, new id

test("a field edit replaces the deck and the new one takes the old chip position", () => {
  const app = boot();
  const a = makeCustom(app);
  const b = makeCustom(app, OTHER_STRING);
  const before = chipRow(app).map((c) => c.label);
  const at = before.indexOf(a.name);
  assert.ok(at >= 0, "the deck under test has no chip");

  const now = editFields(app, a, EDIT_MORE);
  assert.notStrictEqual(now, a.id, "a field edit must mint a new id (D14)");
  const keys = Object.keys(app.registry());
  assert.strictEqual(keys.length, 2, `the registry forked: ${JSON.stringify(keys)}`);
  assert.strictEqual(keys.includes(a.id), false, "the edited deck's old id survived");
  assert.ok(keys.includes(now) && keys.includes(b.id), JSON.stringify(keys));

  const after = chipRow(app).map((c) => c.label);
  assert.strictEqual(after.length, before.length, `the chip row grew: ${JSON.stringify(after)}`);
  assert.strictEqual(after[at], app.registry()[now].name,
    `the replacement did not take the old chip's position: ${JSON.stringify(after)}`);
  // the symptom: two chips a user cannot tell apart. The custom decks' labels
  // are compared, not the whole row - a generated pan may legitimately auto-name
  // itself after the built-in it was seeded from.
  const custom = Object.values(app.registry()).map((x) => x.name);
  assert.strictEqual(new Set(custom).size, custom.length,
    `two custom chips share a label: ${JSON.stringify(custom)}`);
  assert.strictEqual(after.filter((l) => l === a.name).length, 0,
    `the pre-edit label is still in the row: ${JSON.stringify(after)}`);
});

test("a field edit drops the old seed record instead of adding a second one", () => {
  const app = boot();
  const a = makeCustom(app);
  const key = app.get("SCALES_KEY");
  const was = JSON.parse(app.store[key] || "[]");
  assert.strictEqual(was.length, 1, "the setup did not store exactly one record");

  const now = editFields(app, a, EDIT_MORE);
  const list = JSON.parse(app.store[key] || "[]");
  assert.strictEqual(list.length, 1, `the old record survived: ${JSON.stringify(list)}`);
  assert.strictEqual(list[0].s, app.get(`HPE.core.formatSeed(CUSTOM[${JSON.stringify(now)}].fields)`),
    "the stored record is not the edited scale");
  assert.strictEqual(list.some((r) => r.s === was[0].s), false,
    "the pre-edit scale string is still in storage");
});

test("a boot after a field edit shows exactly one deck, in the same chip position", () => {
  const app = boot();
  const a = makeCustom(app);
  const b = makeCustom(app, OTHER_STRING);
  const at = chipRow(app).map((c) => c.label).indexOf(a.name);
  const now = editFields(app, a, EDIT_MORE);
  const name = app.registry()[now].name;

  const key = app.get("SCALES_KEY");
  const again = boot({ storage: { hpfc: app.store.hpfc, [key]: app.store[key] || "[]" } });
  const keys = Object.keys(again.registry());
  assert.strictEqual(keys.length, 2, `a deck was resurrected on boot: ${JSON.stringify(keys)}`);
  assert.strictEqual(keys.includes(a.id), false, "the replaced deck came back on the next boot");
  const row = chipRow(again).map((c) => c.label);
  assert.strictEqual(row[at], name,
    `the replacement lost its chip position across a reload: ${JSON.stringify(row)}`);
  assert.ok(row.includes(b.name), "the untouched deck lost its chip");
});

test("a field edit keeps the edited deck selected and renames its chip from the new fields", () => {
  const app = boot();
  const a = makeCustom(app);
  const now = editFields(app, a, EDIT_MORE);

  assert.strictEqual(app.deckId(), now,
    "the user was bounced off the deck they were editing");
  const made = app.registry()[now];
  // autoName lives in select.js and is the ONE producer of a generated name;
  // nothing here reimplements it and nothing disambiguates a duplicate.
  const auto = app.get(
    `HPE.select.autoName(CUSTOM[${JSON.stringify(now)}].fields, ` +
    `CUSTOM[${JSON.stringify(now)}].options.parent)`);
  assert.strictEqual(made.name, auto, "the auto name was pinned to the old fields");
  assert.notStrictEqual(made.name, a.name, "the chip label did not change with the notes");
  const on = chipRow(app).filter((c) => c.on).map((c) => c.label);
  assert.deepStrictEqual(on, [auto], `the selected chip reads ${JSON.stringify(on)}`);
});

test("an options-only edit still replaces in place and keeps its stored record", () => {
  const app = boot();
  const a = makeCustom(app);
  const key = app.get("SCALES_KEY");
  app.select(a.id);
  app.clickChip(a.name);
  app.els["scale-swatches"].children[2].click();
  app.els["scale-generate"].click();

  assert.deepStrictEqual(Object.keys(app.registry()), [a.id],
    "an options-only edit moved the id");
  assert.strictEqual(app.registry()[a.id].options.palette, 2);
  const list = JSON.parse(app.store[key] || "[]");
  assert.strictEqual(list.length, 1,
    `an options-only edit disturbed the stored record: ${JSON.stringify(list)}`);
  assert.strictEqual(list[0].s, app.get(`HPE.core.formatSeed(CUSTOM[${JSON.stringify(a.id)}].fields)`));
});

test("a field edit still runs select.build exactly once (13A)", () => {
  const app = boot();
  const a = makeCustom(app);
  app.select(a.id);
  app.clickChip(a.name);
  app.type(EDIT_MORE);
  const calls = spyBuild(app);
  app.els["scale-generate"].click();
  assert.strictEqual(calls(), 1, "a replacing save must run select.build exactly once");
});

/* ------------------------- 25. an edit never destroys ANOTHER deck (row 131) */
//
// Owner decision on coordination-doc queue row 131 (2026-09-09): editing deck A
// onto deck B's exact scale REFUSES the save. Both decks survive, the sheet
// stays open, the box is marked bad the way a parse error marks it, and the
// live region carries UI copy - never an engine reason, because the section 2
// code enum is CLOSED and has no code for "that scale is taken".

const COLLIDE_MSG = /Another deck already uses this scale/;
// Deliberately NOT a built-in's scale: the built-in Hijaz chip already reads
// "C# HIJAZ 9", which is also what autoName gives a pan seeded from it, so a
// chip lookup by label could not tell the two apart.
const OTHER_STRING = "(E3) B3 D4 E4 F#4 G4 A4 B4";
const THIRD_STRING = "(G3) D4 F4 G4 A4 Bb4 D5";

/** Rename the deck under the Edit sheet and recolour/flip it, then save. */
function editOptions(app, d, name) {
  app.select(d.id);
  app.clickChip(d.name);
  if (name !== undefined) {
    app.els["scale-name"].value = name;
    app.els["scale-name"].dispatchEvent({ type: "input" });
  }
  app.els["scale-swatches"].children[4].click();
  app.els["scale-mirror-l"].click();
  app.els["scale-generate"].click();
  return app.registry()[app.deckId()];
}

test("an edit onto another deck's scale is refused and both decks survive", () => {
  const app = boot();
  const key = app.get("SCALES_KEY");
  const a = makeCustom(app);
  const b = makeCustom(app, OTHER_STRING);
  const bNamed = editOptions(app, b, "RAY'S PAN");
  assert.strictEqual(bNamed.name, "RAY'S PAN", "the setup did not rename the victim");
  assert.strictEqual(bNamed.options.palette, 4, "the setup did not recolour the victim");
  assert.strictEqual(bNamed.options.mirror, true, "the setup did not flip the victim");

  const bSeed = app.get(`HPE.core.formatSeed(CUSTOM[${JSON.stringify(b.id)}].fields)`);
  app.select(a.id);
  const storedBefore = app.store[key];
  const keysBefore = Object.keys(app.registry());

  app.clickChip(a.name);
  app.type(bSeed);                       // A's fields, retyped as B's exact scale
  app.els["scale-generate"].click();

  assert.deepStrictEqual(Object.keys(app.registry()), keysBefore,
    "the refused save changed the registry");
  const after = app.registry()[b.id];
  assert.ok(after, "the victim deck was destroyed by the edit");
  assert.strictEqual(after.name, "RAY'S PAN", "the victim lost its name");
  assert.strictEqual(after.options.palette, 4, "the victim lost its palette");
  assert.strictEqual(after.options.mirror, true, "the victim lost its mirror");
  assert.deepStrictEqual(app.registry()[a.id], a, "the edited deck was changed by a refusal");

  assert.strictEqual(app.store[key], storedBefore,
    `a refused save wrote to hpfc.scales: ${app.store[key]}`);
  assert.strictEqual(app.deckId(), a.id, "the refusal moved the selection");
  assert.strictEqual(app.sheetOpen(), true, "the refusal closed the sheet");
  assert.ok(app.els["scale-box"].classList.contains("bad"),
    "the scale box was not marked bad on a refusal");
  assert.match(app.els["scale-msg"].textContent, COLLIDE_MSG);
  assert.match(app.announcer().textContent, COLLIDE_MSG);
  // UI copy, not an engine reason: nothing in the closed section 2 enum says this.
  const reasons = app.get("Object.keys(HPE.core.REASONS).map(k => HPE.core.REASONS[k].reason)");
  assert.strictEqual(reasons.includes(app.els["scale-msg"].textContent), false,
    "the refusal message masquerades as an engine reason");
});

test("the collision refusal never fires on an options-only edit, a new scale, a re-save or ADD", () => {
  // (a) an options-only edit
  const app = boot();
  const a = makeCustom(app);
  const b = makeCustom(app, OTHER_STRING);
  editOptions(app, b, "RAY'S PAN");
  assert.strictEqual(app.registry()[b.id].options.palette, 4,
    "an options-only edit was refused");

  // (b) a field edit to a genuinely new scale
  const now = editFields(app, a, EDIT_MORE);
  assert.notStrictEqual(now, a.id, "the field edit did not land");
  assert.ok(app.registry()[now], "a field edit to a new scale was refused");

  // (c) a re-save of an unchanged deck
  const d = app.registry()[now];
  app.select(d.id);
  app.clickChip(d.name);
  app.els["scale-generate"].click();
  assert.strictEqual(app.sheetOpen(), false, "an unchanged re-save was refused");
  assert.ok(app.registry()[d.id], "an unchanged re-save lost the deck");

  // (d) the ADD path on a seed that already exists: dedupe by id, not a refusal
  const keys = Object.keys(app.registry());
  openSheet(app);
  app.type(app.get(`HPE.core.formatSeed(CUSTOM[${JSON.stringify(b.id)}].fields)`));
  app.els["scale-generate"].click();
  assert.strictEqual(app.sheetOpen(), false, "the ADD path was refused as a collision");
  assert.deepStrictEqual(Object.keys(app.registry()), keys,
    "the ADD path forked a deck instead of deduping by id");
  assert.strictEqual(app.deckId(), b.id, "the ADD path did not select the existing deck");
});

test("a refused save still runs select.build exactly once (13A)", () => {
  const app = boot();
  const a = makeCustom(app);
  const b = makeCustom(app, OTHER_STRING);
  const bSeed = app.get(`HPE.core.formatSeed(CUSTOM[${JSON.stringify(b.id)}].fields)`);
  app.select(a.id);
  app.clickChip(a.name);
  app.type(bSeed);
  const calls = spyBuild(app);
  app.els["scale-generate"].click();
  assert.strictEqual(app.sheetOpen(), true, "the collision was not refused");
  // 13A pins exactly ONE build per submit, so the refusal cannot afford one of
  // its own: the prospective id is D14's hash of the fields (core.deckId), and
  // the veto runs before the build the accepted path would spend.
  assert.strictEqual(calls(), 0,
    `a refused save ran select.build ${calls()} times - the id comes from D14, not a build`);
});

/* ------------------- 26. an options-only edit keeps its chip index (row 132) */

test("an options-only edit keeps its chip index across a reload with three decks", () => {
  const app = boot();
  const key = app.get("SCALES_KEY");
  const one = makeCustom(app);
  const two = makeCustom(app, OTHER_STRING);
  const three = makeCustom(app, THIRD_STRING);
  const before = chipRow(app).map((c) => c.label);
  const at = before.indexOf(two.name);
  assert.ok(at >= 0 && at < before.indexOf(three.name), "the setup has no middle deck");

  editOptions(app, two, undefined);        // palette + mirror only: the id cannot move
  assert.ok(app.registry()[two.id], "an options-only edit moved the id");

  const again = boot({ storage: { hpfc: app.store.hpfc, [key]: app.store[key] || "[]" } });
  const row = chipRow(again).map((c) => c.label);
  assert.strictEqual(row[at], two.name,
    `an options-only edit moved the chip on the next boot: ${JSON.stringify(row)}`);
  assert.deepStrictEqual(row, before,
    `the chip row was reordered by an options-only edit: ${JSON.stringify(row)}`);
  assert.deepStrictEqual(Object.keys(again.registry()), [one.id, two.id, three.id],
    "the registry order changed across the reload");
});

/* ------------------- 27. a typed name is never a coincidence (row 133) */

test("a user-typed name equal to the auto label survives a later field edit", () => {
  const app = boot();
  const a = makeCustom(app);
  const auto = app.get(
    `HPE.select.autoName(CUSTOM[${JSON.stringify(a.id)}].fields, ` +
    `CUSTOM[${JSON.stringify(a.id)}].options.parent)`);
  assert.strictEqual(a.name, auto, "the setup deck is not auto-named");

  // the user opens Edit and DELIBERATELY types the very string the box holds
  app.select(a.id);
  app.clickChip(a.name);
  app.els["scale-name"].value = auto;
  app.els["scale-name"].dispatchEvent({ type: "input" });
  app.els["scale-generate"].click();
  assert.strictEqual(app.registry()[a.id].options.name, auto,
    "a deliberately typed name was discarded as a coincidence");

  // and it is a real name: a later FIELD edit keeps it instead of re-deriving
  const now = editFields(app, app.registry()[a.id], EDIT_MORE);
  assert.strictEqual(app.registry()[now].name, auto,
    "the field edit renamed the deck out from under the user");
  const list = JSON.parse(app.store[app.get("SCALES_KEY")] || "[]");
  assert.strictEqual(list[0].o.name, auto, "the typed name did not reach storage");
});

test("an untouched Edit box still leaves an auto-named deck free to re-derive its name", () => {
  const app = boot();
  const a = makeCustom(app);
  const now = editFields(app, a, EDIT_MORE);
  assert.strictEqual(app.registry()[now].options.name, undefined,
    "an untouched auto name was pinned onto the new fields");
});

/* ---------------- 28. the deck strip, and the drawer without presets ----
 * The owner moved "+ ADD" inline as the strip's first chip and had the preset
 * row deleted outright (2026-09). Both are asserted here as facts about the
 * shipped app, not as preferences: the first because a rebuild that loses it,
 * or appends it last, puts the only entry point to the create sheet off-screen
 * on a phone; the second because "removed" has to mean the seeds are gone from
 * the file, not merely hidden. */

test("+ ADD leads the strip through every rebuild, as the same node", () => {
  const app = boot();
  const add = app.els["deck-add"];
  assert.strictEqual(app.els.decks.children[0], add,
    "+ ADD is not the strip's first child on boot");

  // A rebuild throws the strip away (innerHTML = "") and builds it again. The
  // node must be MOVED, not recreated: closeScaleSheet() and selectDeck() both
  // hold this exact element, and its onclick is a property on it.
  const d = makeCustom(app);
  app.select(d.id);
  assert.strictEqual(app.els.decks.children[0], add,
    "a rebuild replaced or displaced the + ADD node");
  assert.strictEqual(app.els.decks.children.length, app.get("allDecks().length") + 1,
    "the strip is not one + ADD plus one chip per deck");

  // Still live after the rebuild: the click still opens the sheet.
  assert.strictEqual(app.sheetOpen(), false);
  add.click();
  assert.strictEqual(app.sheetOpen(), true, "+ ADD stopped opening the sheet after a rebuild");
});

/** The app's own <style> block, with comments stripped. */
function appCss() {
  const src = require("node:fs").readFileSync(require("./helpers/sandbox.js").APP, "utf8");
  const m = /<style>([\s\S]*?)<\/style>/.exec(src);
  assert.ok(m, "index.html has no <style> block");
  return m[1].replace(/\/\*[\s\S]*?\*\//g, "");
}

test("every gap in the app comes from the spacing ramp, never a fresh literal", () => {
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
  // its 44px targets together on purpose.
  const bad = [...css.matchAll(/gap:\s*([^;}]+)/g)]
    .map((m) => m[1].trim())
    .filter((v) => v !== "0" && !v.startsWith("var(--sp-"));
  assert.deepStrictEqual(bad, [],
    `these gaps bypass the ramp: ${JSON.stringify(bad)}`);
});

test("the presets are gone from the app, not merely hidden", () => {
  const app = boot();
  assert.strictEqual(app.get("typeof SCALE_PRESETS"), "undefined",
    "the inlined preset seed list is still in index.html");
  assert.strictEqual(app.get("typeof applyPreset"), "undefined",
    "the preset handler is still in index.html");
  const html = require("node:fs").readFileSync(require("./helpers/sandbox.js").APP, "utf8");
  assert.doesNotMatch(html, /scale-presets/,
    "index.html still carries preset markup, CSS or ids");
});

test("with the presets gone, the standing hint teaches the whole seed grammar", () => {
  const app = boot();
  openSheet(app);
  // An empty box shows the hint and nothing else, so the hint is the only
  // teaching there is besides the label and the placeholder.
  assert.strictEqual(app.els["scale-parse"].textContent, app.get("PARSE_HINT"));
  const hint = app.get("PARSE_HINT");
  assert.match(hint, /ding/i, "the hint does not name the ding");
  assert.match(hint, /\|/, "the hint does not mention the bottom-note bar");

  // And the example it points at - the placeholder - must actually parse, or
  // the one worked example in the sheet is a lie. The stub does not parse
  // markup, so the placeholder is read out of index.html itself.
  const src = require("node:fs").readFileSync(require("./helpers/sandbox.js").APP, "utf8");
  const m = /id="scale-box"[\s\S]{0,400}?placeholder="([^"]+)"/.exec(src);
  assert.ok(m, "the scale box lost its placeholder");
  const ph = m[1];
  const res = app.get(`HPE.core.parseSeed(${JSON.stringify(ph)})`);
  assert.strictEqual(res.ok, true,
    `the placeholder "${ph}" does not parse: ${res.code}`);
});

/* ------------------ 29. replaceRegistered defends its own invariant (row 144) */

test("replaceRegistered refuses to overwrite a DIFFERENT deck holding the new id", () => {
  const app = boot();
  const a = makeCustom(app);
  const b = makeCustom(app, OTHER_STRING);
  const before = app.registry();

  // The destructive line is `else if (k !== next.id)`: without a defence of its
  // own, replacing `a` with a deck carrying `b`'s id silently drops `b`.
  const ok = app.get(
    `replaceRegistered(${JSON.stringify(a.id)}, ` +
    `Object.assign({}, CUSTOM[${JSON.stringify(b.id)}]))`);
  assert.strictEqual(ok, false, "the primitive accepted a same-id collision");
  assert.deepStrictEqual(app.registry(), before,
    "a same-id collision changed the registry");
  // deepStrictEqual is order-blind, and the registry's insertion order IS the
  // chip order - a refusal that rebuilt the object would pass the check above
  // while reshuffling the chips.
  assert.deepStrictEqual(Object.keys(app.registry()), Object.keys(before),
    "a same-id collision reordered the registry");
});

test("replaceRegistered still replaces in place when there is no collision", () => {
  const app = boot();
  const a = makeCustom(app);
  const b = makeCustom(app, OTHER_STRING);
  const at = Object.keys(app.registry()).indexOf(a.id);

  const ok = app.get(
    `replaceRegistered(${JSON.stringify(a.id)}, ` +
    `Object.assign({}, CUSTOM[${JSON.stringify(a.id)}], { id: "custom:zzz" }))`);
  assert.strictEqual(ok, true, "an uncontested replacement was refused");
  const keys = Object.keys(app.registry());
  assert.strictEqual(keys[at], "custom:zzz", `the replacement moved: ${JSON.stringify(keys)}`);
  assert.ok(keys.includes(b.id), "the bystander deck was dropped");
  assert.strictEqual(keys.includes(a.id), false, "the old id survived the replacement");
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

test("replaceRegistered has exactly one call site, and a new one must read the return", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const { total, hits } = scanNames(html, "replaceRegistered");

  assert.strictEqual(total, 2,
    "replaceRegistered is named " + total + " times in index.html " +
    "(expected 2: the definition and its one call). Every occurrence, with its " +
    "line number: " + JSON.stringify(hits) + ". This scan counts mentions in " +
    "COMMENTS too - it strips nothing, deliberately - so if you only added " +
    "prose, re-pin the count above. If you added a call: replaceRegistered " +
    "REFUSES rather than throwing when another deck already sits at next.id, " +
    "so inspect its boolean return and handle false - do not discard it the " +
    "way the pre-existing edit-path call safely can (its collision is ruled " +
    "out upstream by the row-131 veto). Then update this count deliberately.");

  assert.ok(/^function replaceRegistered\(/.test(hits[0][1]),
    "the first mention of replaceRegistered is no longer its definition: " +
    JSON.stringify(hits[0]));
});

// Queue rows 159, 160 and 184. The scan above runs against the real index.html,
// which can hold exactly one shape at a time, so it can never prove more than a
// single evasion is caught. This pins the ruling on synthetic source instead.
// The ruling is short: EVERY word-boundary occurrence counts, wherever it sits.
// Half of these shapes were demonstrated by reviewers hiding a live second call
// site behind a fake comment opener while the suite stayed green; under a scan
// that blanks nothing they are not special cases, they simply count.
test("the caller scan counts every occurrence, in code and in prose alike", () => {
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
