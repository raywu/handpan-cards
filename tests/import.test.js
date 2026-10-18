// Lane A1 - HPE.importer (docs/plans/2026-10-16-scale-import.md, section 4.4
// and "Lane A1"). Every expected value comes from the plan's table, from the
// captured spec lines in tests/fixtures/import_cases_v1.json, or is written by
// hand in that fixture; the pitch checks below are computed independently of
// the importer by reading the notes straight off the source text.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadEngine } = require("./helpers/engine.js");

const ROOT = path.join(__dirname, "..");
const E = loadEngine(["core", "importer"]);
const { core, importer } = E;
const fixture = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests", "fixtures", "import_cases_v1.json"), "utf8"));
const byId = (id) => fixture.cases.find((c) => c.id === id);
const plain = (x) => JSON.parse(JSON.stringify(x));
const interpret = (t, o) => plain(importer.interpret(t, o));
const run = (c) => interpret(c.text, { title: c.title });
const provisionalOf = (c, opts) => {
  const spy = loadEngine(["core", "importer"]);
  const real = spy.core.parseSeed;
  const seen = [];
  spy.core.parseSeed = function (x) { seen.push(x); return real.apply(this, arguments); };
  spy.importer.interpret(c.text, Object.assign({ title: c.title }, opts));
  return seen;
};
const codes = (r) => r.flags.map((f) => f.code).sort();
const flagOf = (r, code) => r.flags.find((f) => f.code === code);
const pc = (n) => n.replace(/-?\d+$/, "");
const fieldNames = (seed) => {
  const p = core.parseSeed(seed);
  assert.ok(p.ok, "parseSeed accepts " + seed);
  return Object.values(p.value.fields).map((f) => f[0] + f[1]);
};

test("fixture: every case has an id, a group, a source and an expectation", () => {
  assert.equal(fixture.version, 1);
  const ids = new Set();
  for (const c of fixture.cases) {
    assert.ok(!ids.has(c.id), "duplicate id " + c.id);
    ids.add(c.id);
    assert.ok(c.group && c.source && c.expect && typeof c.text === "string", c.id);
    assert.ok(c.source.synthetic || c.source.url || c.source.note, c.id + " has no provenance");
  }
  assert.ok(fixture.cases.filter((c) => /yataoshop/.test(c.source.url || "")).length >= 25);
});

test("every fixture: status, flag codes, serialised string and field count match", () => {
  for (const c of fixture.cases) {
    const r = run(c);
    assert.equal(r.status, c.expect.status, c.id + " status");
    assert.deepEqual(codes(r), [...c.expect.codes].sort(), c.id + " codes");
    const s = importer.serialise(r);
    assert.equal(s, c.expect.serialised, c.id + " serialised");
    if (c.expect.fields !== null) {
      assert.equal(fieldNames(s).length, c.expect.fields, c.id + " field count");
    }
  }
});

test("INSUFFICIENT and NEEDS_INPUT results write no string", () => {
  for (const c of fixture.cases) {
    const r = run(c);
    if (r.status !== "REVIEW") assert.equal(importer.serialise(r), "", c.id);
  }
  assert.equal(importer.serialise(null), "");
});

test("the Yatao D Aegean 18 line gives the exact scale string, with the ding cue", () => {
  const r = run(byId("yatao-handpan-yataopan-d-aegean-18"));
  assert.equal(r.status, "REVIEW");
  assert.equal(importer.serialise(r),
    "[B2] (D3) [E3] F#3 [G#3] A3 [B3] C#4 D4 [E4] F#4 G#4 A4 [B4] C#5 D5 [E5] F#5");
  assert.deepEqual(codes(r), ["COUNT_OK", "DING_CUE"]);
  assert.equal(r.roles.ding.note, "D3");
  assert.equal(r.roles.top.length, 10);
  assert.equal(r.roles.bottom.length, 7);
});

test("the rendered Yatao page (labels and values on separate lines) gives the same string", () => {
  const page = byId("yatao-d-aegean-18-page");
  assert.equal(importer.serialise(run(page)), byId("yatao-handpan-yataopan-d-aegean-18").expect.serialised);
});

test("every REVIEW string is a fixed point of formatSeed(parseSeed(x))", () => {
  for (const c of fixture.cases) {
    const s = importer.serialise(run(c));
    if (!s) continue;
    const p = core.parseSeed(s);
    assert.ok(p.ok, c.id);
    assert.equal(core.formatSeed(p.value), s, c.id);
  }
});

test("pitch multiset: serialised fields equal the notes read off the source text", () => {
  for (const c of fixture.cases) {
    const r = run(c);
    const s = importer.serialise(r);
    if (!s) continue;
    const names = fieldNames(s);
    const listed = r.notes.filter((n) => n.role !== "unknown").map((n) => n.note);
    assert.equal(names.length, listed.length, c.id + " count");
    const octaveless = c.group === "octaveless";
    const norm = (a) => a.map((n) => (octaveless ? pc(n) : n)).sort();
    assert.deepEqual(norm(names), norm(listed), c.id);
    if (!octaveless && c.group !== "mixed-octave" && c.group !== "reference-pitch") {
      const written = (c.text.replace(/([A-G]) #/g, "$1#").match(/[A-G][#b]?-?\d/g) || []).sort();
      assert.deepEqual([...names].sort(), [...written].sort(), c.id + " vs text");
    }
  }
});

test("octaveless sources: the provisional string, hand-written octaves, roles and guesses", () => {
  for (const c of fixture.cases.filter((x) => x.group === "octaveless")) {
    const r = run(c);
    const x = c.expect;
    assert.ok(flagOf(r, "NO_OCTAVE"), c.id);
    assert.deepEqual(provisionalOf(c), [x.provisional], c.id + " provisional");
    assert.deepEqual(r.notes.map((n) => [pc(n.note), n.role]), x.sourceNotes, c.id + " roles");
    const held = [r.roles.ding, ...r.roles.top, ...r.roles.inner, ...r.roles.bottom];
    assert.deepEqual(held.map((e) => e.note).sort(), [...x.inferred].sort(), c.id + " inferred");
    assert.deepEqual(held.filter((e) => e.guess).map((e) => e.note).sort(), [...x.guessed].sort(), c.id + " guessed");
    assert.ok(held.every((e) => e.inferred), c.id + " all inferred");
    for (const n of r.notes) {
      assert.equal(c.text.slice(n.span.start, n.span.end).replace(/\s+/g, ""), pc(n.note), c.id + " span " + n.note);
    }
  }
});

test("C Ashakiran 15 octaveless line blocks with BOTTOM_NO_OCTAVE and writes no string", () => {
  const r = run(byId("yatao-c-ashakiran-15-octaveless"));
  assert.equal(r.status, "NEEDS_INPUT");
  assert.equal(flagOf(r, "BOTTOM_NO_OCTAVE").level, "BLOCK");
  assert.equal(importer.serialise(r), "");
});

test("a descending octaveless source lists every note under NO_OCTAVE and is not flagged as unsorted", () => {
  const c = byId("synthetic-descending");
  const r = run(c);
  assert.equal(importer.serialise(r), "(C3) G3 A3 E4 Eb5 F5");
  assert.deepEqual(flagOf(r, "NO_OCTAVE").notes, c.expect.noOctaveNotes);
  assert.equal(flagOf(r, "SOURCE_NOT_ASCENDING"), undefined);
});

test("a provisional string parseSeed refuses blocks the result with parseSeed's own refusal", () => {
  for (const id of ["synthetic-labelled-refused", "synthetic-unlabelled-ding", "synthetic-mixed-bottom-below"]) {
    const c = byId(id);
    const r = run(c);
    const f = flagOf(r, "PROVISIONAL_REFUSED");
    assert.ok(f, id);
    assert.equal(f.level, "BLOCK");
    assert.equal(r.status, "NEEDS_INPUT");
    assert.equal(importer.serialise(r), "");
    assert.equal(f.refusal.code, c.expect.refusalCode, id);
    assert.deepEqual(provisionalOf(c), [c.expect.provisional], id + " provisional");
    const direct = core.parseSeed(c.expect.provisional);
    assert.equal(direct.ok, false, id);
    assert.equal(f.refusal.code, direct.code, id);
    assert.equal(f.refusal.reason, direct.reason, id);
    assert.deepEqual(f.refusal, { code: direct.code, reason: direct.reason }, id + " refusal shape");
  }
});

test("a source with every octave written never builds a provisional string", () => {
  const calls = [];
  const spy = loadEngine(["core", "importer"]);
  const real = spy.core.parseSeed;
  spy.core.parseSeed = function (x) { calls.push(x); return real.apply(this, arguments); };
  for (const c of fixture.cases.filter((x) => x.group === "yatao-line" || x.group === "row")) {
    if (c.id === "sanango-medusa-12") continue;
    const before = calls.length;
    const r = plain(spy.importer.interpret(c.text, { title: c.title }));
    assert.equal(flagOf(r, "NO_OCTAVE"), undefined, c.id);
    assert.equal(calls.length, before, c.id + " called parseSeed");
  }
});

test("guess is set only on bottoms whose octave was inferred", () => {
  for (const c of fixture.cases) {
    const r = run(c);
    for (const e of [r.roles.ding, ...r.roles.top, ...r.roles.inner]) {
      if (e) assert.ok(!e.guess, c.id);
    }
    for (const e of r.roles.bottom) assert.equal(!!e.guess, !!e.inferred, c.id);
  }
});

test("UNDECLARED_PARENS: parenthesised notes get no role and nothing is serialised", () => {
  for (const id of ["sela-sehp401"]) {
    const c = byId(id);
    const r = run(c);
    assert.equal(r.status, "NEEDS_INPUT", id);
    const f = flagOf(r, "UNDECLARED_PARENS");
    assert.equal(f.level, "BLOCK");
    const unknown = r.notes.filter((n) => n.role === "unknown");
    assert.deepEqual(unknown.map((n) => pc(n.note)), c.expect.parens.map(pc), id);
    const held = [r.roles.ding, ...r.roles.top, ...r.roles.inner, ...r.roles.bottom].filter(Boolean);
    for (const n of unknown) assert.ok(!held.some((e) => e.span && e.span.start === n.span.start), id);
  }
  assert.deepEqual(flagOf(run(byId("sela-sehp401")), "UNDECLARED_PARENS").notes, [1, 2, 3]);
});

test("Sela SEHP401: the three bracketed notes stay unassigned and D3 is only a cue", () => {
  const r = run(byId("sela-sehp401"));
  assert.deepEqual(codes(r), ["COUNT_OK", "DING_CUE", "UNDECLARED_PARENS"]);
  assert.equal(r.total, 12);
  assert.deepEqual(flagOf(r, "DING_CUE").notes, [0]);
});

test("conflicting dings: Medusa asks, and a pick of note 0 resolves it to a refused provisional", () => {
  const c = byId("sanango-medusa-12");
  const r = run(c);
  assert.equal(r.status, "NEEDS_INPUT");
  assert.deepEqual(flagOf(r, "CONFLICTING_DING").notes, [0, 1]);
  const p = interpret(c.text, { title: c.title, ding: 0 });
  assert.deepEqual(codes(p), ["COUNT_OK", "NO_OCTAVE", "PROVISIONAL_REFUSED"]);
  assert.equal(p.status, "NEEDS_INPUT");
  assert.equal(p.flags.find((f) => f.code === "PROVISIONAL_REFUSED").refusal.code, "NOTE_OUT_OF_ORDER");
  assert.equal(importer.serialise(p), "");
});

test("a picked ding clears DING_CUE and CONFLICTING_DING and lets the string through", () => {
  const r = interpret("Notes: D E F G Bb", { ding: 3 });
  assert.equal(r.status, "REVIEW");
  assert.deepEqual(codes(r), ["NO_OCTAVE"]);
  assert.equal(importer.serialise(r), "(G3) D4 E4 F4 Bb4");
});

test("a picked ding on a note after the first moves to the front: same string as the labelled form", () => {
  const picked = importer.serialise(importer.interpret("Ding: D Top: E F G Bb", { ding: 3 }));
  assert.equal(picked, "(G3) D4 E4 F4 Bb4");
  assert.equal(picked, importer.serialise(importer.interpret("Ding: G Top: D E F Bb")));
});

test("an inner note below the highest top note blocks with INNER_BELOW_TOP and writes no string", () => {
  const r = run(byId("synthetic-inner-below-top"));
  assert.equal(r.status, "NEEDS_INPUT");
  assert.equal(flagOf(r, "INNER_BELOW_TOP").level, "BLOCK");
  assert.equal(importer.serialise(r), "");
});

test("prose after the note list never reads as a later note: the nine product-page tails stay REVIEW", () => {
  const tails = fixture.cases.filter((x) => x.group === "prose-tail");
  assert.equal(tails.length, 9);
  for (const c of tails) {
    const r = run(c);
    assert.equal(r.status, "REVIEW", c.id);
    assert.equal(flagOf(r, "AMBIGUOUS_NOTE"), undefined, c.id);
    assert.ok(importer.serialise(r).startsWith("(D3) A3 Bb3 C4 D4 E4 F4 G4 A4"), c.id);
  }
});

test("a whole Yatao page with its Key line after the bottom list reads the same 18 notes as the page itself", () => {
  const r = run(byId("synthetic-yatao-key-after-list"));
  assert.equal(r.status, "REVIEW");
  assert.equal(flagOf(r, "AMBIGUOUS_NOTE"), undefined);
  assert.equal(importer.serialise(r), importer.serialise(run(byId("yatao-d-aegean-18-page"))));
});

test("a reference pitch after the list (A4 = 440 Hz, A4 at 440, A4 432 Hz) is not a later note, in prose or under a Word: key", () => {
  const refs = fixture.cases.filter((x) => x.group === "reference-pitch");
  assert.equal(refs.length, 5);
  for (const c of refs) {
    const r = run(c);
    assert.equal(r.status, "REVIEW", c.id);
    assert.equal(flagOf(r, "AMBIGUOUS_NOTE"), undefined, c.id);
    assert.equal(importer.serialise(r), "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4", c.id);
  }
});

test("a later section under a label the importer does not know blocks: its notes are never dropped", () => {
  const rows = fixture.cases.filter((x) => x.group === "unrecognised-section");
  assert.equal(rows.length, 24);
  for (const c of rows) {
    const r = run(c);
    assert.equal(r.status, "NEEDS_INPUT", c.id);
    assert.equal(flagOf(r, "AMBIGUOUS_NOTE").level, "BLOCK", c.id);
    assert.equal(importer.serialise(r), "", c.id);
  }
});

test("spec lines and product prose after the list stay REVIEW: Key values, model names and scale names", () => {
  const rows = fixture.cases.filter((x) => x.group === "spec-tail");
  assert.equal(rows.length, 8);
  for (const c of rows) {
    const r = run(c);
    assert.equal(r.status, "REVIEW", c.id);
    assert.equal(flagOf(r, "AMBIGUOUS_NOTE"), undefined, c.id);
    assert.equal(importer.serialise(r), "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4", c.id);
  }
});

test("accepted false blocks: an octaved note or a run of key letters in prose after the list blocks (fail closed)", () => {
  const rows = fixture.cases.filter((x) => x.group === "accepted-block");
  assert.equal(rows.length, 5);
  for (const c of rows) {
    const r = run(c);
    assert.equal(r.status, "NEEDS_INPUT", c.id);
    assert.ok(flagOf(r, "AMBIGUOUS_NOTE"), c.id);
    assert.equal(importer.serialise(r), "", c.id);
  }
});

test("octaved tops with octaveless inner notes: the inner octaves climb above the tops", () => {
  const c = byId("synthetic-mixed-octave-inner");
  const r = run(c);
  assert.equal(importer.serialise(r), "(D3) A3 C4 D4 E4 F4 G4 A4 C5 | E5 F5");
  assert.deepEqual(r.roles.inner.map((e) => [e.note, !!e.inferred]), [["E5", true], ["F5", true]]);
});

test("a list cut short by a token that is not a note blocks while a later token still reads as a note", () => {
  const rows = fixture.cases.filter((x) => x.group === "truncated");
  assert.equal(rows.length, 18);
  for (const c of rows) {
    const r = run(c);
    assert.equal(r.status, "NEEDS_INPUT", c.id);
    assert.ok(flagOf(r, "AMBIGUOUS_NOTE"), c.id);
    assert.equal(importer.serialise(r), "", c.id);
  }
});

function entries(r) {
  return [["ding", r.roles.ding ? [r.roles.ding] : []], ["top", r.roles.top], ["inner", r.roles.inner], ["bottom", r.roles.bottom]]
    .map(([k, a]) => [k, a.map((e) => [e.note, !!e.inferred, !!e.guess])]);
}
const strip = (r) => codes(r).filter((c) => c !== "DING_CUE" && c !== "CONFLICTING_DING");

test("opts.ding relabel equivalence: every pick on a bare list equals writing the Ding: label", () => {
  const names = ["D", "E", "F", "G", "Bb"];
  names.forEach((n, i) => {
    const rest = names.filter((_, j) => j !== i).join(" ");
    const picked = interpret("Notes: " + names.join(" "), { ding: i });
    const labelled = interpret("Ding: " + n + " Top: " + rest);
    assert.equal(picked.status, labelled.status, "pick " + i);
    assert.deepEqual(strip(picked), strip(labelled), "pick " + i);
    assert.deepEqual(entries(picked), entries(labelled), "pick " + i);
    assert.equal(importer.serialise(picked), importer.serialise(labelled), "pick " + i);
  });
});

test("opts.ding relabel equivalence on a Yatao line: picking the first note equals the cue", () => {
  const c = byId("yatao-handpan-yataopan-d-aegean-18");
  const cue = run(c);
  const picked = interpret(c.text, { title: c.title, ding: 0 });
  assert.equal(picked.status, "REVIEW");
  assert.deepEqual(strip(picked), strip(cue));
  assert.equal(importer.serialise(picked), importer.serialise(cue));
  assert.equal(flagOf(picked, "DING_CUE"), undefined);
});

test("count flags: OK, excluding the ding, and a mismatch that blocks", () => {
  assert.ok(flagOf(run(byId("yatao-handpan-yataopan-d-aegean-18")), "COUNT_OK"));
  assert.ok(flagOf(run(byId("sanango-d-aegean-17")), "COUNT_EXCL_DING"));
  const m = flagOf(run(byId("yatao-without-e5")), "COUNT_MISMATCH");
  assert.equal(m.level, "BLOCK");
  assert.equal(m.title, 18);
  assert.equal(m.listed, 17);
});

test("source order flags: out-of-order and repeated pitches are confirmations, not refusals", () => {
  const r = run(byId("sanango-c-harmonic-minor-16"));
  assert.equal(r.status, "REVIEW");
  assert.deepEqual(flagOf(r, "SOURCE_NOT_ASCENDING").notes, [5, 6, 12, 13]);
  assert.deepEqual(flagOf(r, "DUPLICATE_PITCH").notes, [3, 13]);
  assert.equal(flagOf(r, "SOURCE_NOT_ASCENDING").level, "CONFIRM");
  assert.equal(flagOf(r, "DUPLICATE_PITCH").level, "CONFIRM");
});

test("prose with no note list is INSUFFICIENT with NO_NOTE_LIST", () => {
  for (const id of ["name-only", "image-only", "ayasa-pygmy-21"]) {
    const r = run(byId(id));
    assert.equal(r.status, "INSUFFICIENT", id);
    assert.deepEqual(codes(r), ["NO_NOTE_LIST"], id);
    assert.equal(flagOf(r, "NO_NOTE_LIST").level, "BLOCK");
  }
});

test("status follows the worst flag level", () => {
  for (const c of fixture.cases) {
    const r = run(c);
    const levels = r.flags.map((f) => f.level);
    if (r.status === "INSUFFICIENT" || r.status === "NEEDS_INPUT") assert.ok(levels.includes("BLOCK"), c.id);
    if (r.status === "REVIEW") assert.ok(!levels.includes("BLOCK"), c.id);
  }
});

test("typographic input is normalised one character for one: sharps, flats", () => {
  const a = interpret("Ding: D3 Top: F♯3 A3 C♯4 Bottom: B♭2");
  const b = interpret("Ding: D3 Top: F#3 A3 C#4 Bottom: Bb2");
  assert.equal(importer.serialise(a), importer.serialise(b));
  assert.deepEqual(a.notes.map((n) => [n.span.start, n.span.end]), b.notes.map((n) => [n.span.start, n.span.end]));
});

test("a space inside a note raises SPACE_IN_NOTE and still reads the note", () => {
  const r = interpret("Ding: D3 Top: A3 C #4 D4 E4", {});
  assert.ok(flagOf(r, "SPACE_IN_NOTE"));
  assert.equal(r.roles.top[1].note, "C#4");
});

test("interpret never throws on odd input", () => {
  for (const t of ["", "   ", ")))", "(((", "Ding:", "Ding: Top:", "C C C C", "\u0000", "9 +3", "Notes:"]) {
    const r = interpret(t, { title: "x" });
    assert.ok(["INSUFFICIENT", "NEEDS_INPUT", "REVIEW"].includes(r.status), JSON.stringify(t));
  }
});

test("BOTTOM_NO_OCTAVE, CONFLICTING_LIST and PARENS_AS_BOTTOM join FLAG_ORDER at their levels", () => {
  const blocked = run(byId("yatao-c-ashakiran-15-octaveless"));
  assert.equal(flagOf(blocked, "BOTTOM_NO_OCTAVE").level, "BLOCK");
  const level = (text, opts, code) => flagOf(interpret(text, opts), code).level;
  assert.equal(level("Ding: D3 Top: A3 C4 D4 E4 F4 G4 A4 C5 Bottom: (C3) (F3)", { parens: "bottom" }, "PARENS_AS_BOTTOM"), "CONFIRM");
});

test("parens: bottom reads round brackets as bottom notes; without it the same text still blocks", () => {
  const text = "Ding: D3 Top: A3 C4 D4 E4 F4 G4 A4 C5 (C3) (F3)";
  const plain = interpret(text);
  assert.equal(plain.status, "NEEDS_INPUT");
  assert.ok(flagOf(plain, "UNDECLARED_PARENS"));
  const r = interpret(text, { parens: "bottom" });
  assert.equal(flagOf(r, "UNDECLARED_PARENS"), undefined);
  assert.equal(flagOf(r, "PARENS_AS_BOTTOM").level, "CONFIRM");
  assert.equal(r.status, "REVIEW");
  assert.deepEqual(r.roles.bottom.map((e) => e.note), ["C3", "F3"]);
});

test("parens: bottom on a text with no round brackets changes nothing and raises nothing", () => {
  const text = "Ding: D3 Top: A3 C4 D4 E4 F4 G4 A4 C5";
  assert.deepEqual(interpret(text, { parens: "bottom" }), interpret(text));
});

test("BOTTOM_NO_OCTAVE: a bottom note written without an octave blocks and writes no string", () => {
  const r = interpret("Ding: D3 Top: A3 C4 D4 E4 F4 G4 A4 Bottom: C F");
  assert.equal(r.status, "NEEDS_INPUT");
  assert.equal(flagOf(r, "BOTTOM_NO_OCTAVE").level, "BLOCK");
  assert.equal(importer.serialise(r), "");
  const ok = interpret("Ding: D3 Top: A3 C4 D4 E4 F4 G4 A4 Bottom: C3 F3");
  assert.equal(flagOf(ok, "BOTTOM_NO_OCTAVE"), undefined);
  assert.equal(ok.status, "REVIEW");
});

function longPage(stray, after) {
  const filler = [];
  for (let i = 0; i < 40; i += 1) filler.push("The pan sounds warm and clear, hand made with care in the shop, number " + i + ".");
  const list = ["Ding: D3", "Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5", "Bottom: C3 F3"].join("\n");
  return [stray, filler.join("\n"), list, filler.join("\n"), after].filter(Boolean).join("\n");
}

test("battiloro window: a run of five or more notes outside the kept window blocks with CONFLICTING_LIST", () => {
  const clean = longPage("");
  assert.ok(clean.length > 2000);
  const ok = interpret(clean);
  assert.equal(ok.status, "REVIEW");
  assert.equal(flagOf(ok, "CONFLICTING_LIST"), undefined);
  const stray = longPage("Older listing: C D E F G A B");
  assert.ok(stray.length > 2000);
  const r = interpret(stray);
  assert.equal(r.status, "NEEDS_INPUT");
  assert.equal(flagOf(r, "CONFLICTING_LIST").level, "BLOCK");
  assert.equal(flagOf(r, "CONFLICTING_LIST").runs, 1);
  assert.equal(importer.serialise(r), "");
  const later = interpret(longPage("", "Newer listing: C D E F G A B"));
  assert.equal(later.status, "NEEDS_INPUT");
  assert.equal(flagOf(later, "CONFLICTING_LIST").level, "BLOCK");
  assert.equal(flagOf(later, "CONFLICTING_LIST").runs, 1);
  const four = interpret(longPage("Older listing: C D E F"));
  assert.equal(flagOf(four, "CONFLICTING_LIST"), undefined);
});

const NARROW_FILL = (i) => "The pan sounds warm and clear, hand made with care in the shop, number " + i + ".";

test("narrowing check: a role clause outside the kept window blocks rather than being dropped", () => {
  const filler = Array.from({ length: 30 }, (_, i) => NARROW_FILL(i));
  const page = (top, extra) => [top, ...filler.slice(0, 8), extra, ...filler, "This is a D minor scale."].join("\n");
  for (const extra of ["C and D top.", "F and G inner.", "C and F on the bottom."]) {
    const text = page("D3 ding, A3 Bb3 C4 D4 E4 F4 G4 A4 top.", extra);
    assert.ok(text.length > 2000);
    const r = interpret(text);
    assert.equal(r.status, "NEEDS_INPUT", extra);
    assert.deepEqual(r.flags.map((f) => f.code), ["CONFLICTING_LIST"], extra);
    assert.equal(flagOf(r, "CONFLICTING_LIST").wide, true, extra);
    assert.equal(importer.serialise(r), "", extra);
  }
  const octaveless = interpret(page("D ding, A Bb C D E F G A top.", "C and D top."));
  assert.equal(octaveless.status, "NEEDS_INPUT");
  assert.deepEqual(octaveless.flags.map((f) => f.code), ["CONFLICTING_LIST", "NO_OCTAVE"]);
  const agreed = interpret(page("D3 ding, A3 Bb3 C4 D4 E4 F4 G4 A4 top.", "C5 and D5 top.").replace("\nThis is a D minor scale.", ""));
  assert.equal(agreed.status, "REVIEW");
  assert.equal(importer.serialise(agreed), "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5 D5");
});

test("narrowing check: a seeded fuzz of long texts reads each one as its compact form or blocks", () => {
  const LISTS = [
    ["Ding: D3", "Top: A3 Bb3 C4 D4 E4 F4 G4 A4", "Bottom: C3 F3"],
    ["D3 ding, A3 Bb3 C4 D4 E4 F4 G4 A4 top."],
    ["D ding, A Bb C D E F G A top."],
    ["Notes: D3 / A3 Bb3 C4 D4 E4 F4 G4 A4 C5"],
    ["Ding: D", "Top: A Bb C D E F G A"],
    ["Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5", "Inner: D5 E5", "Ding: D3"],
  ];
  const PROSE = [
    "C and D top.", "F and G inner.", "C and F on the bottom.", "C5 and D5 top.", "C3 and F3 on the bottom.",
    "A perfect gift for beginners.", "This is a D minor scale.", "A4 = 440 Hz", "Tuned to A4 at 432.", "Key: D",
    "Ding: D", "Note: A", "Bottom: c3 f3", "Older listing: C D E F G A B", "Also in C and D.", "E4", "G",
    "Top: A grade", "Sol La Si", "F3 Low Pygmy", "Bb3, C4", "Inner: none", "Nine notes in all.",
  ];
  let s = 2026;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const reading = (r) => [r.status, importer.serialise(r), r.flags.map((f) => f.code).join()].join(" | ");
  for (let i = 0; i < 3000; i += 1) {
    const blocks = pick(LISTS).slice();
    const extra = Math.floor(rnd() * 3);
    for (let k = 0; k < extra; k += 1) blocks.splice(Math.floor(rnd() * (blocks.length + 1)), 0, pick(PROSE));
    const long = [];
    const compact = [];
    let n = 0;
    blocks.forEach((line) => {
      const fill = Math.floor(rnd() * 30);
      if (fill) compact.push(NARROW_FILL(0));
      for (let f = 0; f < fill; f += 1) long.push(NARROW_FILL(n++));
      long.push(line);
      compact.push(line);
    });
    while (long.join("\n").length <= 2000) long.push(NARROW_FILL(n++));
    if (compact[compact.length - 1] !== NARROW_FILL(0)) compact.push(NARROW_FILL(0));
    const short = compact.join("\n");
    assert.ok(short.length <= 2000);
    const r = interpret(long.join("\n"));
    if (r.status !== "REVIEW") { assert.equal(importer.serialise(r), ""); continue; }
    assert.equal(reading(r), reading(interpret(short)), short);
  }
});

test("a text of 2,000 characters or fewer is not narrowed: a stray run of five notes beside the list is not a window block", () => {
  const r = interpret("Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4\nElsewhere C D E F G A B");
  assert.equal(flagOf(r, "CONFLICTING_LIST"), undefined);
});

function leadPage(width) {
  const prose = [];
  for (let i = 0; i < 6; i += 1) prose.push(("Lead " + i + " ").padEnd(width - 1, "x") + ".");
  const tail = [];
  for (let i = 0; i < 20; i += 1) tail.push("The pan sounds warm and clear, hand made with care in the shop, number " + i + ".");
  return prose.join("\n") + "\nDing: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5 Bottom: C3 F3 G3\n" + tail.join("\n");
}

test("window cut: a single-line list after 195 and 196 char prose lines is never serialised truncated", () => {
  for (const width of [195, 196]) {
    const text = leadPage(width);
    assert.ok(text.length > 2000);
    const r = interpret(text);
    const seed = importer.serialise(r);
    assert.equal(r.status, "REVIEW", String(width));
    assert.equal(seed, FULL_SEED, String(width));
  }
});

test("window cut: an unlabelled list the window cuts blocks and writes nothing", () => {
  for (const width of [195, 196]) {
    const text = leadPage(width).replace("Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5 Bottom: C3 F3 G3", "D3 A3 Bb3 C4 D4 E4 F4 G4 A4 C5");
    assert.ok(text.length > 2000);
    const r = interpret(text);
    assert.equal(flagOf(r, "CONFLICTING_LIST").runs, 1, String(width));
    assert.equal(importer.serialise(r), "", String(width));
  }
});

test("window invariant: a long text reads as its short form or blocks, over every list shape, labelled or clause, padding width and position", () => {
  const spec = ["Material: steel", "Weight: five kilos", "Size: wide", "Shipping: free", "Bag: included", "Warranty: two years"];
  const shapes = {
    bare: ["Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5"],
    dot: ["Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5."],
    bottom: ["Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5 Bottom: C3 F3 G3"],
    pygmy: ["Ding: F3", "Top: G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5", "Inner: F5 G5", ...spec, "Bottom: C3 Db3 Eb3 Bb3 Db4 Ab5"],
    multi: ["Ding: D3", "Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5", ...spec, "Bottom:", "C3,", "F3,", "G3."],
  };
  for (let k = 1; k <= 7; k += 1) {
    shapes["below" + k] = ["Ding: D3", "Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5", ...spec.concat(spec).slice(0, k - 1), "Bottom: C3 F3 G3 E3 B2"];
  }
  shapes.clause = ["D3 ding, A3 Bb3 C4 D4 E4 F4 G4 A4 top, C3 F3 bottom."];
  for (const k of [0, 1, 4, 8]) {
    shapes["clause" + k] = ["D3 ding, A3 Bb3 C4 D4 E4 F4 G4 A4 top.", ...spec.concat(spec).slice(0, k), "C3 and F3 on the bottom."];
  }
  const tail = TAIL.concat(TAIL).slice(0, 30);
  for (const [name, lines] of Object.entries(shapes)) {
    for (const sep of ["\n", "\r\n"]) {
      const short = interpret(lines.join(sep));
      const want = [short.status, short.flags.map((f) => f.code).join(), importer.serialise(short)];
      for (const p of [0, 2, 6]) {
        for (let w = 40; w <= 900; w += 13) {
          const lead = [];
          for (let i = 0; i < p; i += 1) lead.push(("Lead " + i + " ").padEnd(w - 1, "x") + ".");
          const text = lead.concat(lines, tail).join(sep);
          const r = interpret(text);
          const id = [name, JSON.stringify(sep), p, w].join(" ");
          assert.ok(text.length > 2000, id);
          assert.deepEqual([r.status, r.flags.map((f) => f.code).join(), importer.serialise(r)], want, id);
        }
      }
    }
  }
});

test("pitch-like prose outside the lists never lets a long text drop a note; it reads as its short form or blocks", () => {
  const spec = ["Material: steel", "Weight: five kilos", "Size: wide", "Shipping: free", "Bag: included", "Warranty: two years"];
  const shapes = {
    labelled: ["Ding: D3", "Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5", ...spec, "Bottom: C3 F3 G3"],
    clause: ["D3 ding, A3 Bb3 C4 D4 E4 F4 G4 A4 top.", ...spec, "C3 and F3 on the bottom."],
    clauseFirst: ["C3 and F3 on the bottom.", ...spec, "D3 ding, A3 Bb3 C4 D4 E4 F4 G4 A4 top."],
  };
  const pitchy = ["A perfect gift for beginners.", "This is a D minor scale.", "Tuned around D4.", "Model E5 edition.", "Free shipping, A grade steel.", "Size C or D available.", "A bag and A stand come with it."];
  for (const [name, lines] of Object.entries(shapes)) {
    const short = interpret(lines.join("\n"));
    const want = [short.status, short.flags.map((f) => f.code).join(), importer.serialise(short)];
    for (const line of pitchy) {
      for (const where of ["lead", "tail"]) {
        const body = where === "lead" ? [line, ...TAIL, ...lines] : [...lines, ...TAIL, line];
        const text = body.join("\n");
        const r = interpret(text);
        const got = [r.status, r.flags.map((f) => f.code).join(), importer.serialise(r)];
        const id = [name, line, where].join(" | ");
        assert.ok(text.length > 2000, id);
        if (r.status === "REVIEW") assert.deepEqual(got, want, id);
        else assert.equal(got[2], "", id);
      }
    }
  }
});

test("a reference pitch on the line after a list is not a list note", () => {
  const r = interpret("Ding: F3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5\nand A4 = 440 Hz tuning.");
  assert.equal(r.status, "REVIEW");
  assert.equal(importer.serialise(r), "(F3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5");
  const long = interpret(["Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5 Bottom: C3 F3 G3", ...TAIL, "Tuned to A4 = 440 Hz."].join("\n"));
  assert.equal(long.status, "REVIEW");
  assert.equal(importer.serialise(long), FULL_SEED);
  const far = interpret(["Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5 Bottom: C3 F3 G3", ...TAIL, ...TAIL, ...TAIL, "Tuned to A4 = 440 Hz."].join("\n"));
  assert.equal(far.status, "REVIEW");
  assert.equal(importer.serialise(far), FULL_SEED);
});

test("window widening: a labelled spread of exactly 2,000 characters is read, and 2,001 blocks", () => {
  const spreadOf = (n) => {
    const head = "Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5";
    const last = "Bottom: C3 F3 G3";
    let left = n - head.length - last.length - 1;
    const fill = [];
    while (left > 81) { fill.push("x".repeat(80)); left -= 81; }
    fill.push("x".repeat(left - 1));
    const body = [head, ...fill, last].join("\n");
    assert.equal(body.length, n);
    return body + "\n" + TAIL.join("\n");
  };
  const at = interpret(spreadOf(2000));
  assert.equal(at.status, "REVIEW");
  assert.equal(importer.serialise(at), FULL_SEED);
  const over = interpret(spreadOf(2001));
  assert.equal(over.status, "NEEDS_INPUT");
  assert.ok(over.flags.some((f) => f.code === "CONFLICTING_LIST" && f.spread === 2001));
});

const FULL_SEED = "[C3] (D3) [F3] [G3] A3 Bb3 C4 D4 E4 F4 G4 A4 C5";
const TAIL = Array.from({ length: 25 }, (_, i) => "The pan sounds warm and clear, hand made with care in the shop, number " + i + ".");

test("window widening: a long text reads every labelled list whole, as its short form does", () => {
  const cut = (w) => ["Lead 0 ".padEnd(w, "x") + ".", "Lead 1 ".padEnd(w, "x") + ".",
    "Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5 Bottom: C3 F3 G3", ...TAIL].join("\n");
  const table = ["Ding: D3", "Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5", "Material: steel", "Weight: 5 kg",
    "Size: 53 cm", "Shipping: free", "Bag: included", "Warranty: two years", "Bottom: C3 F3 G3"];
  const early = ["Ding: D3", "Material: steel", "Weight: 5 kg", "Size: 53 cm", "Shipping: free",
    "Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5", "Bottom: C3 F3 G3", "Tuned to A4 at 440 Hz.", "A bag and A stand come with it."];
  const cases = [570, 572, 573].map((w) => ["bottom cut " + w, cut(w)])
    .concat([["bottom row 7 lines down", table], ["ding row before the window", early]]
      .map(([k, lines]) => [k, lines.concat(TAIL).join("\n")]));
  for (const [label, text] of cases) {
    assert.ok(text.length > 2000, label);
    const r = interpret(text);
    assert.equal(r.status, "REVIEW", label);
    assert.equal(importer.serialise(r), FULL_SEED, label);
  }
});

test("window widening: labelled lists spread wider than 2,000 characters block", () => {
  const text = ["Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5", ...TAIL, ...TAIL, "Bottom: C3 F3 G3"].join("\n");
  assert.ok(text.length > 2000 && text.indexOf("Bottom:") > 2000);
  const r = interpret(text);
  assert.equal(r.status, "NEEDS_INPUT");
  assert.ok(flagOf(r, "CONFLICTING_LIST").spread > 2000);
});

test("windowOf picks the first of two equally dense lines", () => {
  const filler = [];
  for (let i = 0; i < 30; i += 1) filler.push("The pan sounds warm and clear, hand made with care in the shop, number " + i + ".");
  const a = "Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 Bottom: C F";
  const b = "Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 Bottom: C3 F3";
  const text = [a, filler.join("\n"), b, filler.join("\n")].join("\n");
  assert.ok(text.length > 2000);
  const r = interpret(text);
  assert.ok(flagOf(r, "CONFLICTING_LIST"));
  assert.ok(flagOf(r, "BOTTOM_NO_OCTAVE"));
});
