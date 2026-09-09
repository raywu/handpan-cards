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
  for (const mod of ["core", "voicing", "layout", "naming", "select"]) {
    assert.strictEqual(typeof HPE[mod], "object", `HPE.${mod} missing from the app`);
  }
  // core must be visible to the modules that read it, so it loads first.
  const order = [...html.matchAll(/<!-- engine:(\w+) begin/g)].map((m) => m[1]);
  assert.deepStrictEqual(order, ["core", "voicing", "layout", "naming", "select"]);
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

/* --------------------------------------- 13. save() persists built-ins only */

test("selecting a generated deck leaves the stored deck on the last built-in", () => {
  const app = boot();
  const builtIn = decks(app)[1];
  app.select(builtIn.id);
  assert.strictEqual(JSON.parse(app.store.hpfc).deck, builtIn.id);

  const id = app.generate(AMARA_STRING).value.id;
  app.select(id);
  assert.strictEqual(app.deckId(), id, "the custom deck is on screen");
  const stored = JSON.parse(app.store.hpfc);
  // Phase 4 lifts this; in Phase 3 a reload must restore a built-in deck.
  assert.strictEqual(stored.deck, builtIn.id, "a custom deck id was persisted");
  assert.strictEqual(stored.mode, "A", "mode must still round-trip");

  // and a mode change while a custom deck is showing keeps the built-in id.
  app.run('setMode("B")');
  assert.deepStrictEqual(JSON.parse(app.store.hpfc), { deck: builtIn.id, mode: "B" });
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
