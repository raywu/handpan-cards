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

test("C Ashakiran 15 octaveless line gives the plan's hand-written string", () => {
  assert.equal(importer.serialise(run(byId("yatao-c-ashakiran-15-octaveless"))),
    "(C3) F3 G3 A3 B3 C4 D4 E4 G4 [D5] [E5] [F5] [A5] [B5] [C6]");
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
  for (const id of ["sela-sehp401", "synthetic-pasted-provisional"]) {
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

test("a reference pitch after the list (A4 = 440 Hz) is not a later note, and a Word: key ends the scan", () => {
  const r = run(byId("synthetic-reference-pitch"));
  assert.equal(r.status, "REVIEW");
  assert.equal(flagOf(r, "AMBIGUOUS_NOTE"), undefined);
  assert.equal(importer.serialise(r), "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4");
});

test("octaved tops with octaveless inner notes: the inner octaves climb above the tops", () => {
  const c = byId("synthetic-mixed-octave-inner");
  const r = run(c);
  assert.equal(importer.serialise(r), "(D3) A3 C4 D4 E4 F4 G4 A4 C5 | E5 F5");
  assert.deepEqual(r.roles.inner.map((e) => [e.note, !!e.inferred]), [["E5", true], ["F5", true]]);
});

test("a list cut short by a token that is not a note blocks while a later token still reads as a note", () => {
  for (const c of fixture.cases.filter((x) => x.group === "truncated")) {
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
