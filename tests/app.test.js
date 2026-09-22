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

test("every rendered face is well-formed markup (96 cards x 2 modes)", () => {
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
  assert.strictEqual(seen, 96, "expected 96 cards across the three decks");
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

test("the deck row opens with a + ADD chip that opens the page, focusing BACK", () => {
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
  // The owner's second request: the page does not steal focus, so the whole
  // page is visible before anything is typed and no soft keyboard appears.
  // Focus still has to MOVE - leaving it on a chip behind an inert background
  // strands the keyboard - so it goes to BACK, which is a real button and
  // opens no keyboard.
  assert.strictEqual(app.activeId(), "scale-back", "focus moves to BACK on open");
  assert.notStrictEqual(app.activeId(), "scale-box",
    "the box is focused on open, which raises the soft keyboard over the page");
  // role="dialog" / aria-labelledby live in the markup, so e2e asserts those.
});

test("Escape closes the sheet and focus returns to + ADD", () => {
  const app = boot();
  openSheet(app);
  app.keydown("Escape");
  assert.strictEqual(app.sheetOpen(), false);
  assert.strictEqual(app.activeId(), "deck-add", "focus returns to the + ADD chip");
});

test("closing the sheet clears the refusal, so no error is stranded on a closed sheet (queue row 114)", () => {
  /* #scale-refusal is aria-live: it keeps its last text until something else
     writes to it, so a rejected seed's error was still there for a screen
     reader to read out on a page that no longer shows it. It is the element
     this applies to since 2026-09-21 - a refusal no longer goes through
     say(), so .announce (which is outside the aria-modal sheet, and therefore
     was never reachable while the sheet was open) never sees one. */
  const app = boot();
  openSheet(app);
  app.type("(D3) A3 H4");   // H is not a valid note letter
  assert.notStrictEqual(app.els["scale-refusal"].textContent, "",
    "the invalid seed rendered no refusal, so this test proves nothing");
  app.keydown("Escape");
  assert.strictEqual(app.sheetOpen(), false);
  assert.strictEqual(app.els["scale-refusal"].textContent, "",
    "hideSheet() left the last error stranded on the refusal line");
  assert.strictEqual(app.announcer().textContent, "",
    "hideSheet() left the last message stranded on the announcer");
});

test("BACK closes the page and returns focus to the control that opened it", () => {
  const app = boot();
  openSheet(app);
  app.els["scale-back"].click();
  assert.strictEqual(app.sheetOpen(), false, "BACK did not close the page");
  assert.strictEqual(app.activeId(), "deck-add", "focus did not return to + ADD");
});

test("the page fills the viewport, so there is no backdrop left to tap", () => {
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

test("an empty box shows the parse hint and Generate is disabled", () => {
  const app = boot();
  openSheet(app);
  app.type("");
  assert.match(app.els["scale-parse"].textContent, /^Type your ding first/);
  assert.strictEqual(app.els["scale-generate"].disabled, true);
  assert.strictEqual(app.els["scale-refusal"].textContent, "");
});

test("a valid scale fills the parse line with the ding and the numbered notes", () => {
  const app = boot();
  openSheet(app);
  app.type(scale("omitted ding octave"));       // "(D) A C D E F G A C"
  const line = app.els["scale-parse"].textContent;
  assert.match(line, /^Ding D3 \| 1 A3 2 C4 3 D4 /, `parse line was "${line}"`);
  assert.strictEqual(app.els["scale-generate"].disabled, false);
  assert.strictEqual(app.els["scale-refusal"].textContent, "", "a valid scale shows no refusal");
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
    // A refusal renders in #scale-refusal, up in the .fieldrow beside the
    // field it is about - NOT in #scale-msg, which is the sheet's general
    // message area below the pan and carries warnings and notices.
    const msg = app.els["scale-refusal"];
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
  app.els["scale-delete"].click();   // arms
  app.els["scale-delete"].click();   // confirms

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

/* Owner instruction, 2026-09-17: "Delete cards should require a confirmation."
   DELETE THIS DECK destroys a deck and its stored seed with one tap, sitting
   44px under SAVE CHANGES in a sheet the owner drives with a thumb. The
   confirmation is a second tap on the SAME control rather than a dialog: it
   costs the pinned footer no height (the reason the footer is one row at all -
   see the .sheetbody comment in index.html), and it cannot be dismissed by the
   Escape that also closes the page. Arming is visible in the label, so a
   half-remembered first tap is legible rather than armed-in-secret. */
test("DELETE THIS DECK arms on the first tap and only deletes on the second", () => {
  const app = boot();
  const d = makeCustom(app);
  app.select(d.id);
  app.clickChip(d.name);

  app.els["scale-delete"].click();
  assert.strictEqual(app.registry()[d.id] === undefined, false,
    "one tap deleted the deck - the confirmation did not gate anything");
  assert.strictEqual(app.sheetOpen(), true, "one tap closed the Edit page");
  assert.notStrictEqual(app.els["scale-delete"].textContent.trim(), "DELETE THIS DECK",
    "the armed button still reads DELETE THIS DECK, so nothing tells the owner " +
    "their tap did anything or that the next one is destructive");
  // The warning is read from #scale-del-note, not the practice-screen
  // announcer: since 2026-09-21 it lives beside the button rather than going
  // through say(). That is also the only one of the two a screen reader can
  // reach here - #scale-sheet is aria-modal, so .announce is outside the
  // dialog and hidden from AT while the Edit page is open. #scale-del-note is
  // inside it and carries its own aria-live.
  assert.ok(app.els["scale-del-note"].textContent.includes(d.name),
    `the arming message must name the deck at risk: "${app.els["scale-del-note"].textContent}"`);

  app.els["scale-delete"].click();
  assert.deepStrictEqual(app.registry(), {}, "the second tap did not delete the deck");
  assert.strictEqual(app.sheetOpen(), false, "the second tap left the sheet open");
});

test("leaving the Edit page disarms DELETE, so a stale tap cannot destroy a deck", () => {
  const app = boot();
  const d = makeCustom(app);
  app.select(d.id);
  app.clickChip(d.name);

  app.els["scale-delete"].click();          // armed
  app.keydown("Escape");                    // the owner leaves without deleting
  assert.strictEqual(app.sheetOpen(), false);
  app.clickChip(d.name);                    // and comes back later
  assert.strictEqual(app.els["scale-delete"].textContent.trim(), "DELETE THIS DECK",
    "the page re-opened with DELETE still armed - the next tap would delete " +
    "a deck on a confirmation the owner gave to a different visit");

  app.els["scale-delete"].click();
  assert.strictEqual(app.registry()[d.id] === undefined, false,
    "the re-opened page deleted the deck on one tap");
});


test("a tap anywhere else on the page disarms DELETE, without waiting for a blur", () => {
  /* The owner's phone is the reason this is not covered by the blur handler.
     iOS Safari does not give a <button> focus on tap, so `blur` never fires
     there: the arm would sit through retyping the seed, toggling the mirror and
     scrolling, and the only thing that would clear it is leaving the page. A
     pointerdown that is not the button is the same decision as looking away,
     and it is one the owner's device actually makes. */
  const app = boot();
  const d = makeCustom(app);
  app.select(d.id);
  app.clickChip(d.name);

  app.els["scale-delete"].click();
  assert.strictEqual(app.els["scale-delete"].textContent.trim(), "TAP AGAIN TO DELETE",
    "the first tap did not arm, so this test is not measuring a disarm");

  app.els["scale-sheet"].dispatchEvent(
    { type: "pointerdown", target: app.els["scale-box"] });
  assert.strictEqual(app.els["scale-delete"].textContent.trim(), "DELETE THIS DECK",
    "the owner touched the seed field and DELETE stayed armed - on iOS, where "
    + "a button takes no focus, the next tap on it would destroy the deck");

  app.els["scale-delete"].click();
  assert.strictEqual(app.registry()[d.id] === undefined, false,
    "the re-armed button deleted the deck on what was its first tap");
});

test("a pointerdown on DELETE itself does not disarm the tap that armed it", () => {
  const app = boot();
  const d = makeCustom(app);
  app.select(d.id);
  app.clickChip(d.name);

  app.els["scale-delete"].click();
  app.els["scale-sheet"].dispatchEvent(
    { type: "pointerdown", target: app.els["scale-delete"] });
  assert.strictEqual(app.els["scale-delete"].textContent.trim(), "TAP AGAIN TO DELETE",
    "the confirming tap's own pointerdown disarmed the button, so DELETE can "
    + "never fire: every second tap would only re-arm it");

  app.els["scale-delete"].click();
  assert.deepStrictEqual(app.registry(), {},
    "the confirming tap did not delete the deck");
});

test("disarming DELETE takes its warning down with it", () => {
  /* The label and the announcer say the same thing, so they have to stop
     saying it together. The blur path could only strand the warning when the
     owner tabbed away; the pointerdown path runs on every tap in the sheet,
     so a stranded "This cannot be undone." under an idle DELETE would be the
     normal case rather than the rare one. The warning lives in
     #scale-del-note, beside the button, NOT in #scale-msg: since 2026-09-21
     #scale-msg sits above the pan preview and writing an arming warning
     there moved the pan mid-tap. */
  const app = boot();
  const d = makeCustom(app);
  app.select(d.id);
  app.clickChip(d.name);

  app.els["scale-delete"].click();
  assert.match(app.els["scale-del-note"].textContent, /cannot be undone/,
    "the first tap did not warn, so this test is not measuring the warning");

  app.els["scale-sheet"].dispatchEvent(
    { type: "pointerdown", target: app.els["scale-box"] });
  assert.strictEqual(app.els["scale-del-note"].textContent, "",
    "DELETE went back to idle but the amber line still says the deck cannot be "
    + "recovered - the page warns about a thing it is no longer about to do");
});

test("deleting a deck that is already gone leaves no armed button behind", () => {
  /* deleteDeck's own guard. Reaching it means the deck vanished between the
     arming tap and the confirming one, and the button must not be left armed
     over a deck that no longer exists: the next tap would be a confirmation
     of nothing, wearing the label of a confirmation of something. */
  const app = boot();
  const d = makeCustom(app);
  app.select(d.id);
  app.clickChip(d.name);

  app.els["scale-delete"].click();
  assert.strictEqual(app.els["scale-delete"].textContent.trim(), "TAP AGAIN TO DELETE",
    "the first tap did not arm, so this test is not measuring a disarm");

  app.forgetDeck(d.id);
  app.els["scale-delete"].click();
  assert.strictEqual(app.els["scale-delete"].textContent.trim(), "DELETE THIS DECK",
    "the deck is gone and the button still reads TAP AGAIN TO DELETE");
});

test("an ordinary tap in the sheet says nothing, so it cannot wipe what was said", () => {
  /* disarmDelete() would run on EVERY pointerdown in the sheet, armed or not,
     and the half of it that takes the warning down re-derives the whole sheet
     from the seed. The early return keeps that off taps that cancelled
     nothing.

     The message on screen here is NO_THIRDS, read off the deck at open time
     (index.html:4790-4793) and NOT derivable from the seed - which is the
     whole point of the fixture. A rejected seed would prove nothing: the
     re-derive would reproduce the parser's own refusal word for word, so the
     assertion would hold whether the guard was there or not. That is the
     vacuous shape this lane's own row-91 oracle was just fixed for. */
  const app = boot();
  const d = makeCustom(app, scale("three pitch classes"));   // a pan with no thirds
  assert.ok(d.warnings.length > 0, "this fixture is meant to warn");
  app.select(d.id);
  app.clickChip(d.name);

  const said = app.els["scale-msg"].textContent;
  assert.match(said, /No 3rds on this pan/,
    "the sheet is not showing the deck's warning, so this test measures nothing");
  assert.strictEqual(app.els["scale-delete"].hasAttribute("data-armed"), false,
    "DELETE is armed, so a disarm here would be legitimate");

  app.els["scale-sheet"].dispatchEvent(
    { type: "pointerdown", target: app.els["scale-box"] });
  assert.strictEqual(app.els["scale-msg"].textContent, said,
    "an ordinary tap on the seed field erased the pan's NO_THIRDS warning - "
    + "nothing the owner can type will bring it back, because the seed never "
    + "carried it");
});

test("tabbing away from DELETE disarms it too", () => {
  /* The pointerdown path covers the phone. A desktop keyboard can leave the
     button without ever touching the page, and an arm the owner tabbed away
     from is as stale as one they tapped away from. */
  const app = boot();
  const d = makeCustom(app);
  app.select(d.id);
  app.clickChip(d.name);

  app.els["scale-delete"].click();
  assert.strictEqual(app.els["scale-delete"].textContent.trim(), "TAP AGAIN TO DELETE",
    "the first tap did not arm, so this test is not measuring a disarm");

  assert.strictEqual(typeof app.els["scale-delete"].onblur, "function",
    "DELETE has no blur handler, so tabbing away leaves it armed");
  app.els["scale-delete"].onblur();
  assert.strictEqual(app.els["scale-delete"].textContent.trim(), "DELETE THIS DECK",
    "the owner tabbed off an armed DELETE and it stayed armed");
});

/* ------------------------------------------- 23. the LAYOUT section (5) */
//
// Phase 5 / D5. A generated layout is a GUESS; the real pan may have the same
// notes in a different arrangement. The LAYOUT section corrects it - rotate the
// rim, move a single note - entirely from the keyboard, and the correction
// travels in the share URL as options.order without moving the deck id (D5-5).

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

const LAYOUT_IDS = ["scale-layout-row", "scale-rot-l", "scale-rot-r",
                    "scale-move-l", "scale-move-r", "scale-layout-reset"];

// A seed WITH a bottom shell. Stage 3 AC2 is about a bottom-shell note, which
// no rotation could reach while ROTATE was hard-wired to the rim.
const BOTTOM_STRING = "(F) G Ab C Eb F G Ab C Eb | C Db Eb Bb";

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

test("the Edit page draws the pan itself, with one target per non-ding note", () => {
  const app = boot();
  const d = makeCustom(app);
  openEdit(app, d);

  assert.strictEqual(app.els["scale-preview"].hasAttribute("hidden"), false,
    "the Edit page hides the pan, so the layout controls have nothing to move");
  const ids = Object.keys(d.fields).filter((id) => d.fields[id][F_ZONE] !== "ding");
  const shown = mockTargets(app).map((t) => t.note);
  assert.strictEqual(shown.length, ids.length,
    "the mock is not one target per non-ding field");
  const want = ids.map((id) => d.fields[id][F_NAME] + d.fields[id][F_OCT]).sort();
  assert.deepStrictEqual(shown.slice().sort(), want,
    "the mock is not the pan's non-ding notes");
  // The ding carries no slot in the correction, so it is not selectable.
  const ding = Object.keys(d.fields).filter((id) => d.fields[id][F_ZONE] === "ding");
  const fields = mockTargets(app).map((t) => t.field);
  for (const id of ding)
    assert.ok(!fields.includes(String(id)), "the ding got a correction target");
});

test("a tap selects the note that was tapped, on a pan that is already corrected", () => {
  const app = boot();
  const d = makeCustom(app);
  openEdit(app, d);

  const notes = mockTargets(app).map((t) => t.note);
  // Uncorrected first: with an identity order, slot and field agree, so this
  // half passes whichever way round the conversion is written.
  panTap(app, notes[2]);
  assert.strictEqual(mockSelected(app), notes[2], "a tap did not select the note under it");

  // Now correct the pan, so slot and field no longer agree. `order[field] =
  // slot`: reading it as slot -> field selects a different note, and the
  // arithmetic is otherwise identical, so this is the only assertion that can
  // tell the two apart.
  app.els["scale-rot-r"].click();
  const target = notes.find((n) => n !== mockSelected(app) && n !== notes[2]);
  panTap(app, target);
  assert.strictEqual(mockSelected(app), target,
    "the tap selected a different note than the one tapped - slot and field are " +
    "the wrong way round in selectPanField");
});

test("ROTATE moves every note one position and SAVE keeps the id but moves the link", () => {
  const app = boot();
  const d = makeCustom(app);
  const before = link(app, d.id);
  assert.strictEqual(before.ok, true, before.reason);
  openEdit(app, d);

  const was = mockPlaces(app);
  app.els["scale-rot-r"].click();
  const now = mockPlaces(app);
  assert.notDeepStrictEqual(now, was, "ROTATE did not move anything on the pan");
  assert.deepStrictEqual(Object.values(now).sort(), Object.values(was).sort(),
    "ROTATE invented or lost a place on the pan");

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

  const first = mockSelected(app);
  assert.ok(first, "the pan opens with no note selected, so MOVE has no subject");
  assert.strictEqual(panKey(app, "ArrowRight"), true,
    "the arrow key was not handled by the pan");
  const second = mockSelected(app);
  assert.notStrictEqual(second, first, "ArrowRight did not move the selection");
  panKey(app, "ArrowLeft");
  assert.strictEqual(mockSelected(app), first, "ArrowLeft did not move the selection back");
  panKey(app, "ArrowRight");

  const was = mockPlaces(app);
  app.els["scale-move-r"].click();
  const now = mockPlaces(app);
  assert.strictEqual(mockSelected(app), second, "the selection did not follow the note");
  const moved = Object.keys(was).filter((n) => now[n] !== was[n]).sort();
  assert.strictEqual(moved.length, 2, `MOVE is not a swap: ${JSON.stringify(moved)}`);
  assert.ok(moved.includes(second), "MOVE did not move the selected note");
  const other = moved.find((n) => n !== second);
  assert.strictEqual(now[second], was[other], "MOVE did not put the note where its neighbour was");
  assert.strictEqual(now[other], was[second], "MOVE did not displace the note it passed");
});

test("ROTATE turns the ring the selection is on, bottom shell included", () => {
  const app = boot();
  const d = makeCustom(app, BOTTOM_STRING);
  openEdit(app, d);

  const bottom = Object.keys(d.fields).filter((id) => d.fields[id][F_ZONE] === "bottom")
    .map((id) => d.fields[id][F_NAME] + d.fields[id][F_OCT]);
  assert.ok(bottom.length >= 3, `the seed has no bottom shell: ${JSON.stringify(bottom)}`);

  const was = mockPlaces(app);
  const onBottom = Object.keys(was).filter((n) => bottom.includes(n));
  assert.ok(onBottom.length >= 3, "the mock drew no bottom-shell notes");

  // Select a BOTTOM note, then rotate. Before Stage 3, ROTATE was hard-wired to
  // zoneBlock(fields, 0) - the rim - so this press turned the rim and left the
  // bottom shell exactly as it was, whatever was selected.
  panTap(app, onBottom[0]);
  app.els["scale-rot-r"].click();
  const now = mockPlaces(app);

  for (const n of Object.keys(was)) {
    if (bottom.includes(n)) continue;
    assert.strictEqual(now[n], was[n],
      `rotating a bottom-shell note moved ${n}, which is not on that ring`);
  }
  assert.notDeepStrictEqual(onBottom.map((n) => now[n]), onBottom.map((n) => was[n]),
    "ROTATE did not turn the bottom shell the selected note is on");
  assert.deepStrictEqual(onBottom.map((n) => now[n]).sort(), onBottom.map((n) => was[n]).sort(),
    "ROTATE invented or lost a bottom-shell place");
});

test("ROTATE keeps the note you chose selected as its ring turns", () => {
  const app = boot();
  const d = makeCustom(app);
  openEdit(app, d);

  // The selection is a SLOT and rotation moves every note to a new slot, so the
  // selection has to move with it or it silently ends up on whichever note
  // rotated INTO the old slot - a correction aimed at the wrong note from the
  // second press onward. Nothing else in the suite reads the selection across a
  // rotation, so this is the only assertion that can catch it.
  const notes = Object.keys(mockPlaces(app));
  const chosen = panTap(app, notes[3]);
  assert.strictEqual(mockSelected(app), chosen, "the tap did not select the note");
  app.els["scale-rot-r"].click();
  assert.strictEqual(mockSelected(app), chosen,
    "ROTATE turned the ring but left the selection behind on the old slot");
});

test("retyping a seed with a different field count drops the correction and the mock follows", () => {
  const app = boot();
  const d = makeCustom(app);
  openEdit(app, d);

  // A correction is a permutation of a FIXED length. Carry an 8-slot one onto a
  // 7-field seed and HPE.layout.solve refuses the whole pan, paintPan returns
  // false, and holdPanPreview keeps the PREVIOUS pan on screen - so the mock
  // stops following what is being typed, which is the one thing it is for.
  app.els["scale-rot-r"].click();
  app.type("(D3) A3 C4 D4 E4 F4 G4 A4");
  assert.deepStrictEqual(Object.keys(mockPlaces(app)).sort(),
    ["A3", "A4", "C4", "D4", "E4", "F4", "G4"],
    "the mock froze on the pre-edit pan instead of following the typed seed");
});

test("the deck is untouched while the mock previews the correction", () => {
  const app = boot();
  const d = makeCustom(app);
  const before = JSON.parse(JSON.stringify(app.registry()[d.id].fields));
  openEdit(app, d);

  app.els["scale-rot-r"].click();
  app.els["scale-move-r"].click();
  assert.deepStrictEqual(app.registry()[d.id].fields, before,
    "a correction was painted onto the real deck before SAVE (D4)");
  app.keydown("Escape");
  assert.deepStrictEqual(app.registry()[d.id].fields, before,
    "the deck did not come back byte-identical after an abandoned correction");
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
  const corrected = mockPlaces(app);
  app.els["scale-generate"].click();

  openEdit(app, app.registry()[d.id]);
  assert.deepStrictEqual(mockPlaces(app), corrected,
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
                    "scale-layout-reset", "scale-preview"]) {
    assert.ok(seen.has(id), `Tab never reached #${id}`);
  }
  assert.strictEqual(app.els["scale-generate"].textContent, "SAVE CHANGES",
    "the single primary was relabelled by the layout section");
  assert.strictEqual(app.els["scale-generate"].disabled, false,
    "the layout section disabled the sheet's only primary");
});

test("the LAYOUT group explains itself on the page, not only in a comment", () => {
  const app = boot();
  const d = makeCustom(app);
  openEdit(app, d);

  // Stage 4 AC3, and the owner's original complaint: "I'm not sure what any of
  // these intend to do". A comment in index.html teaches nobody - the sentence
  // has to be IN the sheet, next to the buttons, and it has to name all three
  // gestures (tap a note, ROTATE the ring, MOVE the note) or it only half
  // answers the question that prompted the stage. Read from the FILE, because
  // the sandbox conjures an element for any id asked for and would happily
  // report a hint that is not in the markup.
  //
  // COMMENTS ARE STRIPPED FIRST, and that is the whole difference between this
  // test and its own name. A commented-out paragraph is still raw file text, so
  // without the strip the sentence could survive as `<!-- ... -->` - nothing
  // rendered, the owner's question unanswered - and a test called "not only in
  // a comment" would pass on exactly the thing it forbids. What this test still
  // cannot see is `display:none` or the paragraph's PLACE in the sheet; the e2e
  // test "the LAYOUT hint is visible inside the group, not merely present in
  // the file" owns those, in a browser that can measure a box.
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8")
    .replace(/<!--[\s\S]*?-->/g, "");
  const m = /<p class="sheethint" id="scale-layout-hint">([^<]+)<\/p>/.exec(html);
  assert.ok(m, "#scale-layout-hint is not in the markup");
  const hint = m[1].toLowerCase();
  for (const word of ["tap", "rotate", "move"]) {
    assert.ok(hint.includes(word), `the LAYOUT hint never mentions ${word}: "${m[1]}"`);
  }
  assert.strictEqual(app.els["scale-layout-row"].hasAttribute("hidden"), false,
    "the LAYOUT row carrying the hint is hidden on the Edit page");
});

test("the layout markup exists and a built-in deck is never editable", () => {
  const app = boot();
  for (const id of LAYOUT_IDS) assert.ok(app.els[id], `#${id} is missing from the markup`);
  // The slot list is gone: the pan IS the selection now (D1). The sandbox
  // conjures an element for any id asked for, so this has to read the file.
  assert.ok(!/id="scale-slots"/.test(fs.readFileSync(path.join(ROOT, "index.html"), "utf8")),
    "the slot list is still in the markup");
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
  editFields(app, a, EDIT_MORE);

  // The expected id is derived from the REGISTRY, not read back from
  // app.deckId(): an edit replaces in place, so exactly one custom deck is left
  // and that is the one the user must still be on. Taking the id from
  // app.deckId() and then asserting app.deckId() equals it is a tautology that
  // passes even when the edit bounces the user onto a built-in.
  const ids = Object.keys(app.registry());
  assert.strictEqual(ids.length, 1,
    `an edit left ${ids.length} custom decks instead of replacing in place`);
  const now = ids[0];
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
  // Beside the field, not below the pan: the seed is what the owner has to
  // change, and #scale-refusal carries its own aria-live because .announce is
  // outside this aria-modal sheet and cannot be read while it is open.
  assert.match(app.els["scale-refusal"].textContent, COLLIDE_MSG);
  // That the element is aria-live is asserted in e2e, against the real markup:
  // this sandbox synthesises its elements, so their attributes say nothing.
  // UI copy, not an engine reason: nothing in the closed section 2 enum says this.
  const reasons = app.get("Object.keys(HPE.core.REASONS).map(k => HPE.core.REASONS[k].reason)");
  assert.strictEqual(reasons.includes(app.els["scale-refusal"].textContent), false,
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
test("kbOffset is zero with no keyboard: viewport heights match, offsetTop 0", () => {
  const app = boot();
  assert.strictEqual(app.get("kbOffset(844, 844, 0)"), 0);
  assert.strictEqual(app.get("kbOffset(390, 390, 0)"), 0);
});

test("kbOffset is the gap between the layout and visual viewport heights", () => {
  const app = boot();
  // A 300px keyboard on an 844px-tall layout viewport: visualViewport.height
  // drops to 544 and offsetTop stays 0 (the page has not scrolled).
  assert.strictEqual(app.get("kbOffset(844, 544, 0)"), 300);
});

test("kbOffset also nets out a nonzero visualViewport.offsetTop", () => {
  const app = boot();
  // If the page has scrolled the visual viewport down by 20px while the
  // keyboard also ate 300px, offsetTop's contribution comes back OUT of the
  // translate - the sheet should not move further than the keyboard alone
  // requires.
  assert.strictEqual(app.get("kbOffset(844, 544, 20)"), 280);
});

test("kbOffset never goes negative when the visual viewport is taller than innerHeight", () => {
  const app = boot();
  // A degenerate/rounding case (or a visualViewport briefly larger than
  // innerHeight, e.g. during a toolbar animation): the sheet must never be
  // translated DOWN, only up or not at all.
  assert.strictEqual(app.get("kbOffset(390, 400, 0)"), 0);
});

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
test("kbCap does not override the stylesheet cap with no keyboard", () => {
  const app = boot();
  assert.strictEqual(app.get("kbCap(844, 844)"), 0);
  assert.strictEqual(app.get("kbCap(390, 390)"), 0);
});

test("kbCap caps the surface to the shrunken visual viewport", () => {
  const app = boot();
  // iPhone 14 portrait, ~300pt keyboard. 544 - 8px breathing room.
  assert.strictEqual(app.get("kbCap(844, 544)"), 536);
});

test("kbCap plus kbOffset keeps the whole surface on screen", () => {
  const app = boot();
  // The invariant the owner's screenshot violated: with the surface capped
  // at kbCap and lifted by kbOffset, its top edge must be >= 0 and its
  // bottom edge must clear the keyboard.
  const off = app.get("kbOffset(844, 544, 0)");
  const cap = app.get("kbCap(844, 544)");
  const bottom = 844 - off;          // where the surface's bottom edge lands
  assert.ok(bottom - cap >= 0, "surface top is off-screen");
  assert.ok(bottom <= 544, "surface bottom is under the keyboard");
});

test("kbCap never goes negative on a degenerate viewport", () => {
  const app = boot();
  assert.strictEqual(app.get("kbCap(390, 400)"), 0);
  assert.strictEqual(app.get("kbCap(844, 4)"), 0);
});

test("applyKbOffset is a no-op in an environment with no visualViewport", () => {
  // The unit sandbox has no window.visualViewport (see tests/helpers/
  // sandbox.js) and #scale-sheet is a bare stub with no real .sheetsurf
  // child, so sheetSurf is undefined here. Booting, opening and closing the
  // sheet must not throw - the guard in applyKbOffset() is exactly what
  // keeps this safe both here and on a browser that lacks the API.
  const app = boot();
  assert.doesNotThrow(() => {
    app.run("openScaleSheet()");
    app.run("applyKbOffset()");
    app.run("closeScaleSheet()");
  });
});

/* ------------------------------ 20. pan()'s optional interactive hit layer */

/**
 * Stage 1 of the scale-page plan. pan() gains a third argument so the scale
 * page can put selection ON the pan; the CARD path must not notice. The
 * byte-identity criterion is not an aspiration - tests/test_render_agreement.py
 * pins this renderer's output against tools/hifi.py per field, so any drift in
 * the two-argument form breaks print parity too.
 */
test("pan()'s two-argument output is unchanged by the interactive layer", () => {
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
test("the card render still matches the committed digest of every built-in card", () => {
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

test("interactive pan() adds one hit target per non-ding field, and none for the ding", () => {
  const app = boot();
  const D = decks(app);
  for (let di = 0; di < D.length; di++) {
    const d = D[di];
    const svg = app.get(`pan(DECKS[${di}], null, {interactive:true})`);
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
      assert.ok(svg.includes(`aria-label="${name}${oct}, position ${lab} of ${selectable.length}"`),
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
 * DATA and the layout convention in CLAUDE.md (math-convention degrees, 0 =
 * right, 90 = up, y-up), never from the renderer.
 *
 * data-r is checked in the same place because it is the drawn radius the sizer
 * floors each target at, and the sizer's own test builds its nodes by hand: if
 * the attribute vanished from the markup, nothing else in the suite would
 * notice and every sparse-pan target would silently shrink to 44px in a real
 * browser.
 */
test("every hit target is centred on the field circle it selects", () => {
  const app = boot();
  const D = decks(app);
  const N = "([-+\\d.eE]+)";   // a field on the vertical axis renders in exponent form
  for (let di = 0; di < D.length; di++) {
    const d = D[di], g = d.geom, R = 100;
    const svg = app.get(`pan(DECKS[${di}], null, {interactive:true})`);
    const hits = [...svg.matchAll(new RegExp(
      `class="panhit" data-field="(\\d+)" cx="${N}" cy="${N}" r="${N}" data-r="${N}"`, "g"))];
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
test("the hit layer is emitted after everything it sits over", () => {
  const app = boot();
  const svg = app.get(`pan(DECKS[0], null, {interactive:true})`);
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
test("a hit target reaches 44px, never undercuts its own note, and never laps a neighbour", () => {
  const app = boot();
  const rr = (ext, size, min, pts) =>
    plain(app.get(`panHitRadii(${ext}, ${size}, ${min}, ${JSON.stringify(pts)})`));

  // Two fields 100 viewBox units apart, a 106-unit half-extent rendered 380px
  // across: one CSS px is 212/380 viewBox units, so 44px wants a radius of 22px.
  const perPx = 212 / 380;
  assert.deepStrictEqual(rr(106, 380, 44, [[-50, 0, 1], [50, 0, 1]]).map((r) => r.toFixed(9)),
    [22 * perPx, 22 * perPx].map((r) => r.toFixed(9)),
    "a sparse pan gets the full 44px");

  // Same pan, the two fields 20 apart: 44px would overlap, so they touch.
  assert.deepStrictEqual(rr(106, 380, 44, [[-10, 0, 1], [10, 0, 1]]), [10, 10],
    "a dense pan stops at touching rather than overlapping");

  // A drawn note wider than 44px keeps its own size - the floor is a floor.
  assert.deepStrictEqual(rr(106, 380, 44, [[-50, 0, 30], [50, 0, 1]]).map((r) => r.toFixed(9)),
    [(30).toFixed(9), (22 * perPx).toFixed(9)],
    "a note bigger than the floor keeps its own radius");
  // ...but not past its neighbour.
  assert.deepStrictEqual(rr(106, 380, 44, [[-10, 0, 30], [10, 0, 1]]), [10, 10],
    "a big note still stops at touching");

  // A single field has no neighbour to collide with.
  assert.ok(Math.abs(rr(106, 380, 44, [[0, 0, 1]])[0] - 22 * perPx) < 1e-9,
    "one field is never overlapping");

  // A wider render needs fewer viewBox units for the same 44 CSS px.
  assert.ok(rr(106, 760, 44, [[-50, 0, 1], [50, 0, 1]])[0]
          < rr(106, 380, 44, [[-50, 0, 1], [50, 0, 1]])[0],
    "the radius tracks the rendered size");

  // Two fields at the SAME point cannot both be hittable, but the rest of the
  // pan must not be zeroed with them. Per-target radii are what make that true;
  // a single shared radius would take the whole layer down to 0.
  const coincident = rr(106, 380, 44, [[0, 0, 1], [0, 0, 1], [80, 0, 1]]);
  assert.deepStrictEqual(coincident.slice(0, 2), [0, 0], "a coincident pair is not hittable");
  assert.ok(coincident[2] > 0, "a coincident pair does not zero its neighbours");
});

test("every built-in pan holds disjoint hit targets at the page-scale width", () => {
  const app = boot();
  const D = decks(app);
  const N = "([-+\\d.eE]+)";   // a field on the vertical axis renders cx in exponent form
  // Stage 2 gives the page-scale pan at least 300px at a 380px viewport, where
  // the drawer's 184px plate gave 184. NON-OVERLAP WINS over the 44px floor, so
  // the floor is asserted only where the geometry has room for it, and where it
  // does not the measured size is RECORDED - a regression that shrinks Pygmy's
  // targets further trips the pin rather than passing unnoticed. Pygmy reaches
  // 44px only at a 379.45px render, which is why Stage 2 cannot get the floor on
  // every deck inside a 380px viewport that has any padding at all.
  const CAPPED = { pygmy: 34.8 };   // 17 fields; touching diameter at 300px
  for (let di = 0; di < D.length; di++) {
    const d = D[di];
    const svg = app.get(`pan(DECKS[${di}], null, {interactive:true})`);
    const ext = Number(svg.match(new RegExp(`data-ext="${N}"`))[1]);
    const pts = [...svg.matchAll(
      new RegExp(`class="panhit"[^>]*cx="${N}" cy="${N}" r="${N}"`, "g"))]
      .map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
    assert.strictEqual(pts.length,
      Object.keys(d.fields).filter((f) => d.fields[f][F_ZONE] !== "ding").length,
      `${d.id}: every target carries its centre and its note's radius`);
    const rad = plain(app.get(`panHitRadii(${ext}, 300, 44, ${JSON.stringify(pts)})`));

    // Disjoint: no pair of centres is closer than the two radii together.
    for (let i = 0; i < pts.length; i += 1)
      for (let j = i + 1; j < pts.length; j += 1) {
        const gap = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
        assert.ok(gap >= rad[i] + rad[j] - 1e-9,
          `${d.id}: targets ${i} and ${j} overlap (${gap} apart, r=${rad[i]}+${rad[j]})`);
      }

    // The smallest target on the pan is the one that decides whether the deck
    // clears the floor; a per-target radius means the biggest one may exceed it.
    const px = Math.min(...rad) * 2 * (300 / (2 * ext));
    if (CAPPED[d.id] === undefined) {
      assert.ok(px >= 44 - 1e-9,
        `${d.id}: ${pts.length} targets at 300px measure ${px.toFixed(1)}px, want 44`);
    } else {
      assert.ok(Math.abs(px - CAPPED[d.id]) < 0.05,
        `${d.id}: geometry caps its ${pts.length} targets; measured ${px.toFixed(1)}px, pinned ${CAPPED[d.id]}`);
      assert.ok(px < 44, `${d.id}: capped deck no longer needs its pin - assert the 44px floor instead`);
    }
    // ...and no target is smaller than the note it selects unless its nearest
    // neighbour forced it down, which is the one reason that outranks the note.
    for (let i = 0; i < pts.length; i += 1) {
      let half = Infinity;
      for (let j = 0; j < pts.length; j += 1)
        if (j !== i) half = Math.min(half,
          Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) / 2);
      assert.ok(rad[i] >= Math.min(pts[i][2], half) - 1e-9,
        `${d.id}: target ${i} (r=${rad[i]}) undercuts its own note (${pts[i][2]}) for no reason`);
    }
  }
});

/**
 * sizePanHits is the post-insert pass: it is the only place the rendered size
 * is known. Driven here through the same shape a browser hands it, because the
 * radius written into the document is what the user actually taps.
 */
test("sizePanHits sizes an inserted layer from the measured box, idempotently", () => {
  const app = boot();
  app.run(`
    globalThis.__stub = (w, h, pts) => {
      const nodes = pts.map(([x, y, r]) => {
        const a = { cx: String(x), cy: String(y), r: String(r), "data-r": String(r) };
        return { getAttribute: (k) => (k in a ? a[k] : null),
                 setAttribute: (k, v) => { a[k] = String(v); }, attrs: a };
      });
      return { nodes,
               getAttribute: (k) => (k === "data-ext" ? "106" : null),
               getBoundingClientRect: () => ({ width: w, height: h }),
               querySelectorAll: () => nodes };
    };`);
  const radii = (w, h, pts) => plain(app.get(
    `(() => { const s = __stub(${w}, ${h}, ${JSON.stringify(pts)});
              sizePanHits(s, 44); return s.nodes.map((n) => Number(n.getAttribute("r"))); })()`));

  const sparse = [[-50, 0, 1], [50, 0, 1]];
  const at380 = radii(380, 380, sparse);
  assert.ok(Math.abs(at380[0] - 22 * (212 / 380)) < 1e-9, "a measured 380px box gives 44px targets");
  assert.ok(radii(760, 760, sparse)[0] < at380[0], "a wider box needs fewer viewBox units");

  // xMidYMid meet scales by the SMALLER dimension: a short, wide box renders the
  // pan at its height, and a radius derived from the width alone is too small.
  assert.deepStrictEqual(radii(760, 380, sparse), at380,
    "a short wide box is sized by its height, the dimension the pan actually fits");

  // Idempotent: the second pass reads data-r, not the r it just wrote, so
  // running again on resize cannot compound.
  const twice = plain(app.get(
    `(() => { const s = __stub(380, 380, ${JSON.stringify(sparse)});
              sizePanHits(s, 44); sizePanHits(s, 44); sizePanHits(s, 44);
              return s.nodes.map((n) => Number(n.getAttribute("r"))); })()`));
  assert.deepStrictEqual(twice, at380, "re-running on resize changes nothing");

  // A layer that has not been laid out yet (zero box) is left alone rather than
  // zeroed, so the default radii keep working until a real measurement arrives.
  const unlaid = plain(app.get(
    `(() => { const s = __stub(0, 0, ${JSON.stringify(sparse)});
              sizePanHits(s, 44); return s.nodes.map((n) => Number(n.getAttribute("r"))); })()`));
  assert.deepStrictEqual(unlaid, [1, 1], "an unmeasured layer keeps its rendered radii");
});

/**
 * A double quote ends an attribute, and everything after it is markup. Built-in
 * note names have none, so this drives the renderer with a deck that does - the
 * case a generated deck reaches first. Asserted at the EMISSION SITE and not
 * only on the escaper, because an escaper nobody calls escapes nothing.
 */
test("a note name cannot break out of the hit target's attributes", () => {
  const app = boot();
  const out = app.get(`escA('A" onclick="x')`);
  assert.ok(!out.includes(`"`), "no raw double quote survives into an attribute");
  assert.strictEqual(app.get(`escA('a<b&c')`), "a&lt;b&amp;c", "and the text escapes still apply");

  // A deck whose first non-ding field is named with a quote, and whose position
  // label carries one too - both interpolate into the same attribute.
  const svg = app.get(`(() => {
    const d = JSON.parse(JSON.stringify(DECKS[0]));
    const f = Object.keys(d.fields).find((k) => d.fields[k][3] !== "ding");
    d.fields[f][0] = 'A" onmouseover="steal()';
    d.fields[f][5] = '1"';
    return pan(d, null, {interactive:true});
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
  const WANT = ["class", "data-field", "cx", "cy", "r", "data-r",
                "fill", "tabindex", "role", "aria-selected", "aria-label"];
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
    assert.ok(l.endsWith(` of ${M}`), `a label stops short of its count: ${l}`);
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

test("opening ADD pushes its own route and closing pops it", () => {
  const app = boot();
  assert.strictEqual(ROUTE(app), "", "the app boots with a hash it never set");
  openSheet(app);
  assert.deepStrictEqual(pushes(app).map((c) => c.url), ["#add"],
    "opening the Add page did not push exactly one route");
  assert.strictEqual(ROUTE(app), "#add");

  app.els["scale-back"].click();
  assert.strictEqual(app.sheetOpen(), false);
  assert.strictEqual(app.history.calls.filter((c) => c.type === "back").length, 1,
    "closing the page left its own history entry on the stack");
});

test("EDIT routes to the deck it is editing, not to a generic page", () => {
  const app = boot();
  const d = makeCustom(app);
  openEdit(app, d);
  assert.strictEqual(ROUTE(app), "#edit-" + d.id,
    "the Edit page's route does not name the deck it edits");
  app.keydown("Escape");
  assert.strictEqual(app.sheetOpen(), false);
});

test("the browser's Back button closes the page and pops nothing further", () => {
  const app = boot();
  openSheet(app);
  const backs = () => app.history.calls.filter((c) => c.type === "back").length;
  const before = backs();
  app.popstate();
  assert.strictEqual(app.sheetOpen(), false, "Back did not close the page");
  assert.strictEqual(app.activeId(), "deck-add", "Back did not return focus to + ADD");
  // The entry is already gone - the browser popped it. Calling back() again
  // here would walk PAST the app's own entry and leave the site.
  assert.strictEqual(backs(), before,
    "closing from a pop popped a second entry and would leave the app");
});

test("a pop with no page open is not an invitation to close something", () => {
  const app = boot();
  const deckBefore = app.deckId();
  // Where focus is BEFORE the stray pop, so the assertion below is about what
  // the pop did rather than about where boot happens to leave focus.
  const focusBefore = app.activeId();
  app.popstate();
  assert.strictEqual(app.sheetOpen(), false);
  assert.strictEqual(app.deckId(), deckBefore, "a stray pop moved the practice screen");
  // The guard's real job. hideSheet() ends in (sheetOpener || addChip).focus(),
  // so a popstate listener that ran its body with no page open would yank focus
  // to + ADD on every back press anywhere in the app - out of whatever the user
  // was actually on. Asserting only sheetOpen() leaves that invisible.
  assert.strictEqual(app.activeId(), focusBefore,
    "a stray pop stole focus - the popstate listener ran with no page open");
});

test("closing a page that is already closed changes nothing", () => {
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
  app.run("document.getElementById('scale-box').focus()");
  const parked = app.activeId();
  app.run("closeScaleSheet()");
  app.run("closeScaleSheet()");

  assert.strictEqual(app.activeId(), parked,
    "closing an already-closed page re-ran the close path and stole focus");
  assert.strictEqual(app.history.calls.filter((c) => c.type === "back").length, 1,
    "closing an already-closed page popped again - more back presses than the " +
    "user made, and the last one leaves the app");
});

test("booting on a page route opens nothing and leaves a clean hash", () => {
  for (const hash of ["#add", "#edit-custom:abc"]) {
    const app = boot({ href: "https://example.test/index.html" + hash });
    assert.strictEqual(app.sheetOpen(), false,
      `booting on ${hash} opened a page for a deck this session never had`);
    assert.strictEqual(ROUTE(app), "",
      `booting on ${hash} left the route in the address bar: reloading is now ` +
      "a page that cannot be backed out of");
    assert.deepStrictEqual(app.history.calls.map((c) => c.type), ["replace"],
      `booting on ${hash} pushed an entry instead of replacing the one it found`);
  }
});

test("the page routes do not shadow a share URL", () => {
  const app = boot();
  const d = makeCustom(app);
  const url = link(app, d.id);
  assert.strictEqual(url.ok, true, url.reason);

  const shared = boot({ href: "https://example.test/index.html#s=" + payload(url.value) });
  assert.strictEqual(shared.deckId(), d.id,
    "a share link stopped opening its deck once the page routes were added");
  assert.strictEqual(shared.sheetOpen(), false, "a share link opened the scale page");
});

/* iOS Safari auto-zooms any form control whose font-size is under 16px, and
 * zooming IS what queue row 87 is about: the visual viewport shrinks, and
 * applyKbOffset() cannot tell that shrink from a keyboard. The page's answer
 * is to make NO claim while the scale is up - which is only safe if the page
 * never raises the scale itself. That is this test: all three of the sheet's
 * focusable controls are pinned at 16px, so every scale > 1 is two deliberate
 * fingers. Dropping any of them to 15px hands the fix off at exactly the
 * moment the keyboard opens, and no headless test would otherwise see it.
 * #scale-degrees is a <select> rather than a text input, but iOS auto-zooms a
 * focused select on the same rule, and it declares its size through the `font`
 * shorthand - hence the two patterns. Asserted against the CSS text because
 * the sandbox stubs the DOM and has no layout engine. */
test("the sheet's text inputs stay at 16px so iOS does not auto-zoom them", () => {
  const css = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "index.html"), "utf8");
  for (const sel of ["#scale-box", "#scale-name", "#scale-degrees"]) {
    /* Every standalone rule for the selector, not the first: each of these
     * three is also named in the short-viewport media block at :528, which
     * sets geometry and no font, and matching that one would report a missing
     * size that is actually declared further down. */
    const rules = [...css.matchAll(
      new RegExp(`\\${sel}\\{([^}]*)\\}`, "g"))].map(r => r[1]);
    assert.ok(rules.length, `no standalone CSS rule for ${sel}`);
    const sizeOf = body => /font-size:\s*([\d.]+)px/.exec(body)
      || /\bfont:[^;]*?\b([\d.]+)px\b/.exec(body);
    const m = rules.map(sizeOf).find(Boolean);
    assert.ok(m, `${sel} has no explicit font size; iOS will auto-zoom it`);
    assert.ok(Number(m[1]) >= 16,
      `${sel} is ${m[1]}px; iOS Safari auto-zooms controls under 16px`);
  }
});

/* ------------------------------------------- 20. the print sheet card list */

/* Workstream B, AC-B2 and AC-B4. `tools/hifi.py` build() (:379-395) is the
 * print spec and these tests are written against IT, not against the JS: the
 * full deck leads with a title and a legend card and pads with BLANK
 * templates; the print-shop sheet carries chord cards only and pads with
 * empty SKIPS, so a shop never prints a blank template it was not asked for.
 *
 * Slots per page is an ARGUMENT here, never a viewport read (AC-B2). D17
 * makes it 6 on a narrow viewport and 9 on a wide one, and a function that
 * reached for window.innerWidth itself would be neither pure nor testable
 * without viewport mocking this suite does not otherwise do. Every case below
 * therefore runs at both 9 and 6. */

/** The generated Amara deck, selected, so deck() returns it. */
function customDeck(app) {
  const res = app.generate(AMARA_STRING);
  assert.strictEqual(res.ok, true, res.reason);
  app.select(res.value.id);
  return res.value.id;
}

const kinds = (app, variant, slots) =>
  arr(app.get(`printCardList(deck(), ${JSON.stringify(variant)}, ${slots}).map(function(c){return c.kind})`));

test("print sheet card list: the full variant leads with title and legend", () => {
  const app = boot();
  customDeck(app);
  for (const slots of [9, 6]) {
    const ks = kinds(app, "full", slots);
    assert.deepStrictEqual(ks.slice(0, 2), ["title", "legend"],
      `full sheet at ${slots}/page must open with the title and legend cards`);
    assert.strictEqual(ks.filter((k) => k === "title").length, 1);
    assert.strictEqual(ks.filter((k) => k === "legend").length, 1);
  }
});

test("print sheet card list: padding fills the last page, with the right filler", () => {
  const app = boot();
  customDeck(app);
  const chordCount = app.get("deck().chords.length");
  for (const slots of [9, 6]) {
    const full = kinds(app, "full", slots);
    assert.strictEqual(full.length % slots, 0,
      `full sheet at ${slots}/page left a ragged last page`);
    // hifi.py pads the full deck with blank TEMPLATE cards.
    assert.ok(full.every((k) => ["title", "legend", "chord", "blank"].includes(k)));
    assert.strictEqual(full.length - chordCount - 2,
      full.filter((k) => k === "blank").length);

    const shop = kinds(app, "shop", slots);
    assert.strictEqual(shop.length % slots, 0,
      `print-shop sheet at ${slots}/page left a ragged last page`);
    // ...and the print-shop sheet with EMPTY slots, never with blanks.
    assert.ok(!shop.includes("blank"),
      "the print-shop sheet must not ship blank template cards");
    assert.ok(!shop.includes("title") && !shop.includes("legend"),
      "the print-shop sheet is chord cards only");
    assert.strictEqual(shop.filter((k) => k === "chord").length, chordCount);
    assert.strictEqual(shop.filter((k) => k === "skip").length,
      shop.length - chordCount);
  }
});

test("print sheet card list: a deck that exactly fills its pages gets no padding", () => {
  const app = boot();
  customDeck(app);
  const n = app.get("deck().chords.length");
  // Amara generates 25 chords; 25 + title + legend = 27 = 3 pages of 9 exactly.
  assert.strictEqual(n, 25, "fixture changed - pick a new exact-fit arithmetic");
  assert.deepStrictEqual(kinds(app, "full", 9).filter((k) => k === "blank"), []);
});

test("print sheet covers every chord exactly once, numbered from 1", () => {
  const app = boot();
  customDeck(app);
  for (const variant of ["full", "shop"]) {
    for (const slots of [9, 6]) {
      const ns = arr(app.get(
        `printCardList(deck(), ${JSON.stringify(variant)}, ${slots})` +
        `.filter(function(c){return c.kind === "chord"}).map(function(c){return c.n})`));
      const total = app.get("deck().chords.length");
      assert.deepStrictEqual(ns, Array.from({ length: total }, (_, i) => i + 1),
        `${variant} at ${slots}/page must carry every chord once, numbered 1..n in deck order`);
      const names = arr(app.get(
        `printCardList(deck(), ${JSON.stringify(variant)}, ${slots})` +
        `.filter(function(c){return c.kind === "chord"})` +
        `.map(function(c){return c.chord.main + (c.chord.sup || "")})`));
      const expected = arr(app.get(
        `deck().chords.map(function(c){return c.main + (c.sup || "")})`));
      assert.deepStrictEqual(names, expected,
        "the printed cards must be the deck's own chords, in deck order");
    }
  }
});

test("print sheet card list: a built-in deck composes the same way", () => {
  const app = boot();
  // The built-ins carry a blank_cards overlay literal in the print pipeline;
  // the app's data has none, so the list is title + legend + chords + padding.
  const di = deckIndex(app, "amara");
  const ks = arr(app.get(
    `printCardList(DECKS[${di}], "full", 9).map(function(c){return c.kind})`));
  assert.deepStrictEqual(ks.slice(0, 2), ["title", "legend"]);
  assert.strictEqual(ks.length % 9, 0);
  assert.strictEqual(ks.filter((k) => k === "chord").length,
    app.get(`DECKS[${di}].chords.length`));
});

/* ---------------------------------------------------------------------------
 * 21. the print card markup
 *
 * B3. One function turns a printCardList() entry into the inner markup of a
 * `.face`, so the print sheet draws through the app's own renderers rather
 * than a second set. The non-chord kinds mirror tools/hifi.py's title_card
 * (:474), legend_card (:490) and blank_card (:514) - the print spec - with
 * the copy substitutions D17's "The copy a custom deck does not have"
 * settled: the canonical seed string in place of the print overlay's `sub`,
 * the engine's own warning reasons in place of the blurb, and no credit line.
 * ------------------------------------------------------------------------ */

const cardHTML = (app, variant, slots, i) =>
  String(app.get(
    `printCardHTML(deck(), printCardList(deck(), ${JSON.stringify(variant)}, ${slots})[${i}])`));

test("print card markup: a chord card is the app's own answer face, minus the print row", () => {
  const app = boot();
  customDeck(app);
  const html = cardHTML(app, "shop", 9, 0);
  const main = String(app.get("deck().chords[0].main"));
  assert.ok(html.includes(main), "the chord card must carry its chord name");
  assert.ok(html.includes("<svg"), "the chord card must carry the pan diagram");
  assert.ok(html.includes("notesline") && html.includes("numline"),
    "the chord card must carry the note line and the number line");
  assert.ok(html.includes("#1"), "the chord card must carry its index number");
  assert.ok(!html.includes('class="prints"'),
    "a printed card must not carry the .prints row - it is screen furniture");
});

test("print card markup: the title card names the deck and carries its seed and blurb", () => {
  const app = boot();
  customDeck(app);
  const html = cardHTML(app, "full", 9, 0);
  const name = String(app.get("deck().name"));
  const seed = String(app.get("HPE.core.formatSeed(deck().fields)"));
  assert.ok(html.includes(name), "the title card must name the deck");
  assert.ok(html.includes(seed),
    "a custom deck has no print-overlay `sub`; the canonical seed string stands in");
  assert.ok(html.includes("CHORD CARDS"), "mirrors hifi.title_card:479");
  assert.ok(html.includes("<svg"), "the title card carries an unhighlighted pan");
  assert.ok(!html.includes("notesline"),
    "the title card is not a chord card and has no note line");
  const warnings = arr(app.get("(deck().warnings || []).map(function(w){return w.reason})"));
  for (const w of warnings) {
    assert.ok(html.includes(String(app.get(`esc(${JSON.stringify(w)})`))),
      "the engine's own reason strings are the custom deck's blurb");
  }
});

test("print card markup: the legend card is the same static anatomy lesson for every deck", () => {
  const app = boot();
  customDeck(app);
  const custom = cardHTML(app, "full", 9, 1);
  const di = deckIndex(app, "hijaz");
  const builtin = String(app.get(
    `printCardHTML(DECKS[${di}], printCardList(DECKS[${di}], "full", 9)[1])`));
  for (const s of ["LEGEND", "How to read", "ROOT NOTE", "CHORD NOTE"]) {
    assert.ok(custom.includes(s), `the legend card must carry "${s}"`);
    assert.ok(builtin.includes(s), `the built-in legend card must carry "${s}" too`);
  }
  assert.ok(custom.includes("<svg"), "the legend card demonstrates on a pan");
  assert.ok(!custom.includes("notesline"),
    "the legend card teaches the anatomy; it is not a chord card");
});

test("print card markup: a blank card is a deck-branded template with no chord on it", () => {
  const app = boot();
  customDeck(app);
  const html = String(app.get('printCardHTML(deck(), {kind: "blank"})'));
  assert.ok(html.includes(String(app.get("deck().name"))),
    "the blank card is deck-branded - hifi.blank_card:516");
  assert.ok(html.includes("<svg"), "the blank card carries an unhighlighted pan");
  assert.ok(!html.includes("notesline") && !html.includes("numline"),
    "the blank card's note and number rows are RULES to write on, not rendered lines");
  assert.ok(html.includes("blankrule"),
    "the two write-on rules mirror hifi.blank_card:520-521");
});

test("print card markup: an empty print-shop slot renders nothing at all", () => {
  const app = boot();
  customDeck(app);
  assert.strictEqual(String(app.get('printCardHTML(deck(), {kind: "skip"})')), "",
    "a `skip` is an EMPTY slot on the print-shop sheet, not a card");
});

test("print card markup: every card a sheet emits renders", () => {
  const app = boot();
  customDeck(app);
  for (const variant of ["full", "shop"]) {
    for (const slots of [9, 6]) {
      const n = Number(app.get(
        `printCardList(deck(), ${JSON.stringify(variant)}, ${slots}).length`));
      for (let i = 0; i < n; i++) {
        const kind = String(app.get(
          `printCardList(deck(), ${JSON.stringify(variant)}, ${slots})[${i}].kind`));
        const html = cardHTML(app, variant, slots, i);
        if (kind === "skip") assert.strictEqual(html, "");
        else assert.ok(html.length > 0,
          `${variant} at ${slots}/page: card ${i} (${kind}) rendered nothing`);
      }
    }
  }
});

/* ---------------------------------------------------------------------------
 * 22. the print sheet's layout selection and its grid CSS
 *
 * B4/AC-B5b. Slots-per-page is decided ONCE, in JS, at 640px - the app's own
 * breakpoint (index.html:41). The `@media print` block reads the class that
 * decision sets and never re-decides the width itself: a second breakpoint in
 * CSS is the drift vector that ships 9 padded cards into a 6-slot grid.
 * ------------------------------------------------------------------------ */

test("print sheet slot count agrees with the layout the breakpoint picks", () => {
  const app = boot();
  for (const [w, name, slots] of [[640, "wide", 9], [1024, "wide", 9],
                                  [639, "narrow", 6], [380, "narrow", 6]]) {
    assert.strictEqual(String(app.get(`printLayoutName(${w})`)), name,
      `${w}px must select the ${name} layout`);
    const L = plain(app.get(`PRINT_LAYOUTS[${JSON.stringify(name)}]`));
    assert.strictEqual(L.cols * L.rows, slots,
      `the ${name} layout must be ${slots} slots per page`);
    assert.strictEqual(L.cols, 3,
      "both layouts are 3 columns wide - D17 reduces ROWS, not columns");
    assert.strictEqual(
      Number(app.get(`printSlots(PRINT_LAYOUTS.${name}.cols, PRINT_LAYOUTS.${name}.rows).length`)),
      slots, "the slot emitter and the layout must agree on the count");
  }
});

test("print sheet grid CSS is emitted from PRINT_GEOM, never typed", () => {
  const app = boot();
  const g = plain(app.get("PRINT_GEOM"));
  for (const name of ["wide", "narrow"]) {
    const L = plain(app.get(`PRINT_LAYOUTS[${JSON.stringify(name)}]`));
    const css = String(app.get(`printGridCSS(${JSON.stringify(name)}, "letter")`));
    assert.ok(css.includes(`repeat(${L.cols}, ${g.CW}pt)`),
      `${name}: columns must come from PRINT_GEOM.CW`);
    assert.ok(css.includes(`repeat(${L.rows}, ${g.CH}pt)`),
      `${name}: rows must come from PRINT_GEOM.CH`);
    assert.ok(css.includes(`column-gap:${L.gx}pt`) && css.includes(`row-gap:${L.gy}pt`),
      `${name}: gutters must come from the layout`);
  }
});

/* B7 on an iPhone 14 (iOS 26.6): iOS Safari ignores `@page{margin:0}` and
   enforces its own printable area, so a sheet sized against the full 612pt
   page is sheared at BOTH edges - the outer cards lose their borders and the
   corner of their header copy. 3 columns plus 12.2pt gutters is 557.2pt,
   which only fits if the platform grants a 13.7pt margin; iOS grants about
   0.5in. Dropping the narrow layout's gutters brings the block to 532.8pt,
   which fits with room to spare and keeps the card at its printed size -
   the owner's choice on 2026-09-22 over scaling the sheet down. */
test("every print layout fits inside the platform-enforced printable area", () => {
  const app = boot();
  const g = plain(app.get("PRINT_GEOM"));
  const S = plain(app.get("PRINT_SAFE"));
  const layouts = plain(app.get("PRINT_LAYOUTS"));
  // Reviewer R1: `constrained` selects WHICH layouts this loop checks, so it
  // is load-bearing for the whole test. Dropping it from PRINT_LAYOUTS.narrow
  // left the suite at 163/163 green - `if (!L.constrained) continue` then
  // skipped every layout and the fit assertions below ran zero times. Pin the
  // flag by value AND count the iterations, so an empty loop cannot pass.
  assert.strictEqual(layouts.narrow.constrained, true,
    "the narrow layout must stay marked constrained or the fit loop checks nothing");
  let checked = 0;
  // iOS Safari ignores `@page` entirely - size, orientation AND margin:0 - so
  // the page box is wholly platform-chosen and the margin is whatever the
  // platform grants. Measured on iPhone 14 / iOS 26.6, US Letter: the drawn
  // area is 531.6pt of 612, i.e. 40.2pt per side. PRINT_SAFE.margin carries
  // that measurement with headroom. The old oracle asserted a bare 72
  // (0.5in/side) and passed a sheet that clipped on the device.
  assert.ok(S.margin >= 42,
    `PRINT_SAFE.margin is ${S.margin}pt, under the ~40.2pt iOS actually enforces`);
  /* Reviewer R4: the old loop measured ONE paper. g.PW/g.PH are Letter, and
     the app deliberately carries no paper dimensions at all (asserting one is
     what paginated every sheet), so the papers live here, in the test, as the
     measurement they are. A4 is the tight axis - 595.28pt wide leaves 510.9pt
     of safe width against Letter's 531.6 - and it fit by luck until now. */
  const PAPERS = { letter: [g.PW, g.PH], a4: [595.28, 841.89] };
  assert.deepStrictEqual(Object.keys(PAPERS).sort(),
    Object.keys(plain(app.get("PRINT_PAPER"))).sort(),
    "every paper the app offers must be measured by this fit loop");
  for (const [paper, [pw, ph]] of Object.entries(PAPERS)) {
    const safeW = pw - 2 * S.margin, safeH = ph - 2 * S.margin;
    for (const [name, L] of Object.entries(layouts)) {
      if (!L.constrained) continue;   // only layouts a margin-enforcing platform can select
      checked++;
      const sw = L.cols * g.CW + (L.cols - 1) * L.gx;
      const sh = L.rows * g.CH + (L.rows - 1) * L.gy;
      // A rotated sheet presents its height horizontally and vice versa.
      const w = L.rotate ? sh : sw, h = L.rotate ? sw : sh;
      assert.ok(w <= safeW,
        `the ${name} sheet presents ${w}pt of width on ${paper}, over the ${safeW}pt safe area`);
      assert.ok(h <= safeH,
        `the ${name} sheet presents ${h}pt of height on ${paper}, over the ${safeH}pt safe area`);
    }
  }
  assert.ok(checked > 0, "the fit loop asserted nothing - no layout was marked constrained");
  // The fit must come from the layout, never from the card: 62.65 x 87.21 mm
  // is the print spec both renderers share.
  assert.strictEqual(g.CW, 177.6, "the card keeps its printed width");
  assert.strictEqual(g.CH, 247.2, "the card keeps its printed height");
  // Reviewer N1/N2: pin both gutter pairs by value, not merely by arithmetic.
  assert.strictEqual(layouts.wide.gx, g.GX, "the wide sheet keeps hifi's column gutter");
  assert.strictEqual(layouts.wide.gy, g.GY, "the wide sheet keeps hifi's row gutter");
  assert.strictEqual(layouts.narrow.gx, 0, "the narrow sheet drops its column gutter");
  assert.strictEqual(layouts.narrow.gy, 0, "the narrow sheet drops its row gutter");
});

test("iOS selects the narrow layout at every viewport width", () => {
  const app = boot();
  const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
  const IPAD = "Mozilla/5.0 (iPad; CPU OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
  const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
  // Reviewer N3: printLayoutName keyed on width alone, so an iPad in portrait
  // (744/768/810/820/834) and an iPhone 14 in landscape (844) both selected
  // "wide" on the same iOS Safari - a 557.2 x 760.4pt sheet that misses the
  // printable box on BOTH axes, where rotation cannot save it either.
  for (const w of [744, 768, 810, 820, 834, 844, 1024, 1366]) {
    for (const ua of [IOS, IPAD]) {
      assert.strictEqual(
        String(app.get(`printLayoutName(${w}, ${JSON.stringify(ua)})`)), "narrow",
        `iOS at ${w}px must not select a layout that overflows its printable area`);
    }
    assert.strictEqual(
      String(app.get(`printLayoutName(${w}, ${JSON.stringify(DESKTOP)})`)), "wide",
      `a real desktop at ${w}px honours margin:0 and keeps the 3x3 sheet`);
  }
  assert.strictEqual(String(app.get(`printLayoutName(380, ${JSON.stringify(DESKTOP)})`)), "narrow",
    "the width rule still applies off iOS");
});

/* Reviewer R2: iPadOS defaults to "Request Desktop Website", so a real iPad
   sends a Macintosh UA and is caught only by the maxTouchPoints clause. That
   branch had no test: collapsing isIOS() to /iPad|iPhone|iPod/ left the suite
   at 163/163 green, while a real iPad fell through to the width rule and got
   the 557.2 x 760.4pt wide sheet that misses on both axes. */
test("iPadOS in desktop mode is still treated as iOS", () => {
  const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
  const ipad = boot({ userAgent: MAC, maxTouchPoints: 5 });
  assert.strictEqual(Boolean(ipad.get(`isIOS(${JSON.stringify(MAC)})`)), true,
    "a Macintosh UA with a touchscreen is an iPad, not a Mac");
  for (const w of [1024, 1366]) {
    assert.strictEqual(String(ipad.get(`printLayoutName(${w}, ${JSON.stringify(MAC)})`)), "narrow",
      `an iPad in desktop mode at ${w}px must not select the wide sheet`);
  }
  // A real Mac sends the same UA with no touchscreen and must keep 3x3.
  const mac = boot({ userAgent: MAC, maxTouchPoints: 0 });
  assert.strictEqual(Boolean(mac.get(`isIOS(${JSON.stringify(MAC)})`)), false,
    "a trackpad Mac is not an iPad");
  assert.strictEqual(String(mac.get(`printLayoutName(1366, ${JSON.stringify(MAC)})`)), "wide",
    "a real desktop Safari keeps the 3x3 sheet");
});

/* THE ATTEMPT-3 ORACLE. printGridCSS() asserted the PAPER height as the
   PRINTABLE height (`.printpage{height:792pt}`), the same error class as
   assuming @page{margin:0} is honoured. On iOS the printable box is about
   711.6pt, less an OS header/footer band of roughly 50pt, so a 792pt block
   does not merely clip - it PAGINATES: every sheet becomes two physical
   pages. Measured in Chrome at the parent commit: 8 pages for 4 sheets,
   every odd page blank. On the device it is the owner's "Page 1 of 10" for a
   5-sheet deck, with the sliced bottom row landing at the top of page 2.
   The fix is to stop declaring a page-box dimension at all and reserve only
   the sheet's own footprint, which the platform's box then contains. */
test("the print stylesheet never declares a page-box height", () => {
  const app = boot();
  const g = plain(app.get("PRINT_GEOM"));
  const layouts = plain(app.get("PRINT_LAYOUTS"));
  const papers = plain(app.get("PRINT_PAPER"));
  for (const paper of Object.keys(papers)) {
    for (const [name, L] of Object.entries(layouts)) {
      const css = String(app.get(`printGridCSS(${JSON.stringify(name)}, ${JSON.stringify(paper)})`));
      assert.ok(!/\.printpage\s*\{[^}]*(?<!min-)height\s*:/.test(css),
        `${name}/${paper} still fixes .printpage's height to a page-box number`);
      // Every paper-height literal must be gone from the emitted CSS: it is a
      // number we cannot know on a platform that owns the page box.
      for (const h of [792, 841.89]) {
        assert.ok(!css.includes(`${h}pt`),
          `${name}/${paper} still emits the ${h}pt paper height`);
      }
      // What it DOES reserve is the sheet's own footprint after rotation.
      const sw = L.cols * g.CW + (L.cols - 1) * L.gx;
      const sh = L.rows * g.CH + (L.rows - 1) * L.gy;
      const footprint = Math.round((L.rotate ? sw : sh) * 100) / 100;
      /* Reviewer N3: constrain the SELECTOR, not just the value. A bare
         substring let the floor move from .printpage to .printsheet and still
         pass - and the floor is precisely the half of "floor and fill" that
         Chrome can never exercise, because Chrome shrink-to-fits where iOS
         paginates. Nothing downstream would have caught the move. */
      assert.match(css,
        new RegExp(`#printroot \\.printpage\\{[^}]*min-height:${String(footprint).replace(".", "\\.")}pt`),
        `${name}/${paper} must reserve ${footprint}pt on .printpage itself`);
      // Reviewer N1: 3 * 247.2 + 2 * 9.4 lands on 760.3999999999999 in binary
      // float. A stylesheet is text a human reads in devtools; round it.
      assert.ok(!/min-height:[0-9.]*[0-9]{8}/.test(css),
        `${name}/${paper} emits an unrounded float into the stylesheet`);
    }
  }
  // The reservation has to be smaller than the smallest printable box we have
  // measured, or the block paginates again on the next platform.
  /* Reviewer N2: bound EVERY constrained layout, not `narrow` by name. The
     guard exists for whichever layout a margin-enforcing platform selects;
     naming one lets a second such layout reintroduce the pagination unseen. */
  let bounded = 0;
  for (const [name, L] of Object.entries(layouts)) {
    if (!L.constrained) continue;
    bounded++;
    const f = L.rotate
      ? L.cols * g.CW + (L.cols - 1) * L.gx
      : L.rows * g.CH + (L.rows - 1) * L.gy;
    assert.ok(f <= 661.6,
      `the ${name} sheet reserves ${f}pt, over the ~661.6pt iOS leaves inside its own bands`);
  }
  assert.ok(bounded > 0, "no layout was bounded against a printable box");
});

/* The regression a fresh reviewer caught at 43b2851: min-height alone
   collapses .printpage to its own content, so `align-items:center` has no
   free space to distribute and the sheet TOP-ALIGNS. Rendered, desktop wide
   put its top card border at y=0.0 - flush with the paper edge, inside every
   consumer printer's non-printable band - and on iOS it would sit under the
   OS header band. The fill is a PERCENTAGE so the platform resolves it
   against the page area it chose, the one number we may never assume; paired
   with the min-height floor it holds the pagination fix AND the centring.
   tests/e2e.test.js measures the rendered position; this pins the rule. */
test("the print stylesheet gives the page box something to fill", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const css = html.slice(html.indexOf("@media print"));
  assert.match(css, /html,\s*body\{[^}]*height:100%/,
    "html/body must fill the page box or a percentage height cannot resolve");
  assert.match(css, /body\.printing #printroot \.printpage\{height:100%\}/,
    ".printpage must fill the page box, or min-height collapses it and the sheet top-aligns");
  assert.ok(!/\.printpage\{height:\s*[\d.]+(pt|px|in|mm|cm)/.test(css),
    "the fill must stay a percentage - a length here is a page-box literal again");
});

/* PRINT_PAPER.h was the only source of the page-box literal above. Keeping
   the key invites the next edit to read it again, so the fix deletes it and
   this test is the guard. `css` (the @page size keyword) is what survives. */
test("PRINT_PAPER carries no page-box height", () => {
  const papers = plain(boot().get("PRINT_PAPER"));
  for (const [name, p] of Object.entries(papers)) {
    assert.ok(!("h" in p), `PRINT_PAPER.${name} still carries a page-box height`);
    assert.ok(typeof p.css === "string" && p.css.length > 0,
      `PRINT_PAPER.${name} must keep its @page size keyword`);
  }
});

test("the narrow print stylesheet actually emits the rotation", () => {
  const app = boot();
  const css = String(app.get('printGridCSS("narrow", "letter")'));
  assert.ok(/#printroot \.printsheet\{transform:rotate\(-90deg\)\}/.test(css),
    "the narrow sheet must be rotated by the emitted stylesheet, not just flagged");
  const wide = String(app.get('printGridCSS("wide", "letter")'));
  assert.ok(!/rotate\(-90deg\)/.test(wide), "the wide sheet must not rotate");
});

test("print sheet paper size is a control, and only the page box changes", () => {
  const app = boot();
  const letter = String(app.get('printGridCSS("wide", "letter")'));
  const a4 = String(app.get('printGridCSS("wide", "a4")'));
  assert.ok(/@page\{size:letter;/.test(letter));
  assert.ok(/@page\{size:A4;/.test(a4));
  // D16 and D17 are orthogonal: A4 is 297mm against Letter's 279.4mm, nowhere
  // near the ~97mm a third card row plus its gutter would need. The grid is
  // byte-identical; only the page box differs.
  const grid = (css) => css.split("\n").filter((l) => l.includes("grid-template")).join("\n");
  assert.strictEqual(grid(letter), grid(a4),
    "paper size must not change the card grid");
  assert.notStrictEqual(letter, a4, "paper size must change the page box");
});

/* ---------------------------------------------------------------------------
 * 23. the print CTA
 *
 * B5. Custom decks get the same two print options the built-ins have. A
 * built-in's are `<a href>` to the pre-built PDFs and must not move; a custom
 * deck's are `<button>` that fill the print container and call window.print().
 * ------------------------------------------------------------------------ */

test("print CTA: a custom deck's header carries the same two labels as a built-in's", () => {
  const app = boot();
  const di = deckIndex(app, "amara");
  const builtin = String(app.get(`headerHTML(DECKS[${di}], DECKS[${di}].chords[0], 1)`));
  customDeck(app);
  const custom = String(app.get("headerHTML(deck(), deck().chords[0], 1)"));
  for (const label of ["FULL DECK PDF", "PRINT-ONLY PDF"]) {
    assert.ok(builtin.includes(label), `the built-in header lost "${label}"`);
    assert.ok(custom.includes(label), `the custom header is missing "${label}"`);
  }
  assert.ok(builtin.includes("<a href="),
    "a built-in deck's print options stay plain links to the pre-built PDFs");
  assert.ok(!builtin.includes("<button"),
    "the built-in path must be UNCHANGED - a button there is a plan violation");
  assert.ok(custom.includes("<button"),
    "a custom deck has no pre-built PDF; its controls are buttons");
  assert.ok(/<select/.test(custom), "D16: the paper picker rides with the buttons");
});

/** Run the CTA and capture the sheet while it is live. window.print() is a
 *  moment the container is guaranteed populated; the app now holds the sheet
 *  up until `afterprint` (it has to - print() returns before iOS rasterizes),
 *  so capturing here is convenience, not necessity. Nothing test-only is
 *  added to the app for this. */
function printed(app, variant) {
  app.run(`captured = null; window.print = function(){ captured = {
    html: document.getElementById("printroot").innerHTML,
    cls: document.getElementById("printroot").className,
    hidden: document.getElementById("printroot").hidden,
    css: document.getElementById("printgeom").textContent }; };
    openPrintSheet(${JSON.stringify(variant)});`);
  return plain(app.get("captured"));
}
const cellCount = (html) => (html.match(/class="printcell"/g) || []).length;

test("the CTA passes the real platform through, not just the viewport", () => {
  // Wiring test: printLayoutName is only as good as the argument the call site
  // hands it. A wide-viewport iPad that still gets the 3x3 sheet is exactly
  // the B7 clipping the platform clause exists to stop.
  const app = boot({
    innerWidth: 820,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
  });
  customDeck(app);
  const cap = printed(app, "full");
  assert.ok(cap, "the CTA must call window.print()");
  assert.strictEqual(cap.cls, "narrow",
    "an 820px iPad must still get the narrow sheet - it ignores @page like every iOS Safari");
  assert.ok(/transform:rotate\(-90deg\)/.test(cap.css),
    "and the stylesheet the CTA emits must carry the rotation");
});

test("print sheet slot count agrees with the viewport at the moment the CTA fires", () => {
  for (const [w, name, slots] of [[1024, "wide", 9], [380, "narrow", 6]]) {
    const app = boot({ innerWidth: w });
    customDeck(app);
    const cap = printed(app, "full");
    assert.ok(cap, "the CTA must call window.print()");
    assert.strictEqual(cap.hidden, false, "the sheet must be showing when print() fires");
    assert.strictEqual(cap.cls, name, `${w}px must put the ${name} class on the container`);
    const L = plain(app.get(`PRINT_LAYOUTS[${JSON.stringify(name)}]`));
    assert.strictEqual(L.cols * L.rows, slots);
    // The emitted cells are the padded card list, so their count is a multiple
    // of the slot count the container's own class selects. One decision, one
    // place: the CSS never re-reads the width (AC-B5b).
    assert.strictEqual(cellCount(cap.html) % slots, 0,
      `${w}px: ${cellCount(cap.html)} cells is not a whole number of ${slots}-slot pages`);
    assert.strictEqual(cellCount(cap.html),
      Number(app.get(`printCardList(deck(), "full", ${slots}).length`)));
    assert.ok(cap.css.includes(`repeat(${L.rows}, `),
      "the geometry stylesheet must carry the same layout's row count");
  }
});

/* The defect B7 caught on an iPhone 14 (iOS 26.6): window.print() BLOCKS on
   desktop Chrome until the dialog is dismissed, but RETURNS IMMEDIATELY on
   iOS Safari, which schedules the print UI asynchronously. A synchronous
   teardown therefore runs before iOS rasterizes, and iOS prints the live app
   page instead of the card sheet. This test stubs the iOS shape - print()
   returns without firing afterprint - and asserts the sheet is STILL up. */
test("print sheet survives a print() that returns before the printer has read it", () => {
  const app = boot();
  customDeck(app);
  const root = app.els.printroot;
  app.run("window.print = function(){};");
  app.run('openPrintSheet("full")');
  assert.notStrictEqual(root.innerHTML, "",
    "iOS Safari rasterizes AFTER print() returns; an emptied container prints the app");
  assert.strictEqual(root.hidden, false, "the sheet must still be showing");
  assert.strictEqual(app.docEl.classList.contains("printing"), true,
    "body.printing is what the @media print block keys off");
  assert.notStrictEqual(app.els.printgeom.textContent, "",
    "the geometry stylesheet has to outlive print() too");
});

test("print sheet leaves no residue", () => {
  const app = boot();
  customDeck(app);
  const root = app.els.printroot;
  assert.strictEqual(root.hidden, true, "the print container starts hidden");
  assert.strictEqual(root.innerHTML, "", "the print container starts empty");
  app.run("window.print = function(){};");
  app.run('openPrintSheet("full")');
  app.fireWindow("afterprint");
  assert.strictEqual(root.innerHTML, "",
    "a stray print sheet in the DOM is a regression on the practice screen");
  assert.strictEqual(root.hidden, true, "the print container was left showing");
  assert.strictEqual(app.els.printgeom.textContent, "",
    "the geometry stylesheet was left behind");
  assert.strictEqual(app.docEl.classList.contains("printing"), false,
    "body.printing hides the whole app; leaving it on blanks the screen");
  // Idempotent: the listener is registered once at boot, so it also fires on
  // a print the app never started (the user's own Cmd+P / Share -> Print).
  app.fireWindow("afterprint");
  assert.strictEqual(root.innerHTML, "", "a second afterprint must be a no-op");
  assert.strictEqual(app.docEl.classList.contains("printing"), false);
});

test("print sheet is emptied even when the print dialog throws", () => {
  const app = boot();
  customDeck(app);
  app.run("window.print = function(){ throw new Error('no printer'); }");
  assert.throws(() => app.run('openPrintSheet("full")'), /no printer/);
  assert.strictEqual(app.els.printroot.innerHTML, "",
    "a throwing print() must not strand the sheet in the DOM");
  assert.strictEqual(app.docEl.classList.contains("printing"), false);
});

/* Reviewer finding B-2: `printPaper` is module state that survives a render,
   but headerHTML() re-emits the <select> from scratch on EVERY render with
   LETTER first and nothing marked selected. So a flip, an arrow press or a
   shuffle silently reset the control to LETTER while the app still printed
   A4 - and re-picking LETTER fired no `change` event, so the user could not
   get back without round-tripping through A4. The control has to report the
   state it owns (D16). */
test("print CTA: the paper picker reports the paper that will actually print", () => {
  const app = boot();
  customDeck(app);
  const picked = () => {
    const html = String(app.get("headerHTML(deck(), deck().chords[0], 1)"));
    const opts = html.match(/<option value="([a-z0-9]+)"( selected)?>/g) || [];
    assert.strictEqual(opts.length, 2, "the paper picker lost an option");
    const on = opts.filter((o) => o.includes(" selected"));
    assert.strictEqual(on.length, 1,
      `${on.length} options are marked selected; the picker must show exactly one`);
    return on[0].match(/value="([a-z0-9]+)"/)[1];
  };

  assert.strictEqual(picked(), "letter", "the picker must open on the default paper");
  app.run('setPrintPaper("a4")');
  assert.strictEqual(picked(), "a4",
    "after a re-render the picker reads LETTER while the sheet still prints A4");
  app.run('setPrintPaper("letter")');
  assert.strictEqual(picked(), "letter");
});

test("print CTA: the paper picker changes the page box and nothing else", () => {
  const app = boot();
  customDeck(app);
  app.run('setPrintPaper("a4")');
  const a4 = printed(app, "full");
  assert.ok(a4.css.includes("size:A4"), "the sheet must be built for the selected paper");
  app.run('setPrintPaper("letter")');
  const letter = printed(app, "full");
  assert.ok(letter.css.includes("size:letter"));
  assert.strictEqual(cellCount(a4.html), cellCount(letter.html),
    "D16 and D17 are orthogonal: paper size must not change the card count");
});
