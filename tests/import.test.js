// Lane A1 - HPE.importer (docs/plans/2026-10-16-scale-import.md, section 4.4
// and "Lane A1"). Every expected value comes from the plan's table, from the
// captured spec lines in tests/fixtures/import_cases_v1.json, or is written by
// hand in that fixture; the pitch checks below are computed independently of
// the importer by reading the notes straight off the source text.
const test = require("node:test");
const { describe } = test;
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
    const seen = provisionalOf(c);
    assert.equal(seen[0], x.provisional, c.id + " provisional");
    assert.ok(seen.slice(1).every((line) => line === importer.serialise(r)), c.id + " only the guard calls parseSeed after it, on serialise(r)");
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
    assert.ok(calls.slice(before).every((line) => line === importer.serialise(r)), c.id + " parseSeed saw a line other than serialise(r)");
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

test("a Main note or Hauptnote line that disagrees with a slash-marked ding blocks with CONFLICTING_DING", () => {
  const list = "Notes: D3 / A3 Bb3 C4 D4 E4 F4 G4 A4";
  for (const t of [
    "Main note C3\n" + list,
    "Hauptnote C3 wird mitgeliefert\n" + list,
    list + "\nMain note C3 version also available.",
    "Notes: D / A Bb C D E F G A C\nMain note A grade",
    "Main note C3\nNotes: D3) A3 Bb3 C4 D4 E4 F4 G4 A4",
  ]) {
    const r = interpret(t);
    assert.equal(r.status, "NEEDS_INPUT", t);
    assert.ok(flagOf(r, "CONFLICTING_DING"), t);
    assert.equal(importer.serialise(r), "", t);
  }
  const agree = interpret("Main note D3\n" + list);
  assert.equal(importer.serialise(agree), "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4");
  assert.equal(flagOf(agree, "CONFLICTING_DING"), undefined);
});

test("a weak label (Note:, notes ... are:, a bare Notes) with fewer than five notes after it is prose, never a list", () => {
  const list = "Ding: D3\nTop: A3 Bb3 C4 D4 E4 F4 G4 A4";
  const want = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4";
  for (const t of [
    "Please note: E3 bottom optional\n" + list,
    list + "\nBottom note: C3",
    list + "\nAdditional note: C5 (+150 EUR)",
    list + "\nLowest note: C3",
    list + "\nNote: C5 can be added on request.",
    list + "\nOther notes are: C5 D5",
    list + "\nNotes C5 and D5 can be added",
    "Note: F3 Low Pygmy is our bestseller.\nNotes: D3 / A3 Bb3 C4 D4 E4 F4 G4 A4",
  ]) {
    const r = interpret(t);
    const out = importer.serialise(r);
    assert.ok(out === "" || out === want, t + " -> " + out);
  }
  assert.equal(importer.serialise(interpret("Note: F3 Low Pygmy is our bestseller.\nNotes: D3 / A3 Bb3 C4 D4 E4 F4 G4 A4")), want);
  assert.equal(importer.serialise(interpret("Note: Re3 / La3 Sib3 Do4 Re4 Mi4 Fa4")), "(D3) A3 Bb3 C4 D4 E4 F4");
});

test("a Main note or Hauptnote line that the next list does not restate blocks, slash or not", () => {
  for (const t of [
    "Main note C3 version also available.\nNotes: D3 A3 Bb3 C4 D4 E4 F4 G4 A4",
    "Hauptnote C3 wird mitgeliefert\nNotes: D3, A3, Bb3, C4, D4, E4, F4, G4, A4",
    "Notes: D3 A3 Bb3 C4 D4 E4 F4 G4 A4\nHauptnote C3 wird mitgeliefert",
    "Main note D4\nNotes: D3 A3 Bb3 C4 D4 E4 F4 G4 A4",
    "Ding\tC3\nHauptnote C\nNotes\tC4 D4 E4 G4 A4 C5",
  ]) {
    const r = interpret(t);
    assert.equal(r.status, "NEEDS_INPUT", t);
    assert.ok(flagOf(r, "CONFLICTING_DING"), t);
  }
  const same = interpret("Main note D3\nNotes: D3 A3 Bb3 C4 D4 E4 F4 G4 A4");
  assert.equal(importer.serialise(same), "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4");
  assert.equal(flagOf(same, "DUPLICATE_PITCH"), undefined);
  assert.equal(importer.serialise(interpret("Hauptnote D\nNoten D3 A3 Bb3 C4 D4 E4 F4")), "(D3) A3 Bb3 C4 D4 E4 F4");
});

test("a Ding: label with no octave is not merged into an octaved first top note", () => {
  assert.equal(importer.serialise(interpret("Ding: D\nTop: D4 E4 F4 G4 A4 C5")), "(D3) D4 E4 F4 G4 A4 C5");
  assert.equal(importer.serialise(interpret("Ding: C\nTop: C4 D4 E4 G4 A4 C5")), "(C3) C4 D4 E4 G4 A4 C5");
});

test("a reference pitch inside a list that notes still follow blocks instead of cutting the list", () => {
  const r = interpret("Ding: D3\nTop:\n- A3\n- Bb3\n- C4\n- D4\n- E4\n- F4\nA4 440\n- G4\n- A4\n- C5");
  assert.equal(r.status, "NEEDS_INPUT");
  assert.ok(flagOf(r, "AMBIGUOUS_NOTE"));
  assert.equal(importer.serialise(interpret("Ding: D3\nTop: A3 Bb3 C4 D4 E4 F4 G4 A4\nA4 440")),
    "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4");
});

test("two labelled top lists are two readings of the rim and block with CONFLICTING_LIST", () => {
  for (const t of [
    "Ding: C#3\nOuter circle: G#3 - B3 - C#4 - D4 - F4 - F#4 - G#4 - B4\nTop: D3 shell",
    "Ding: F3\nOuter circle: G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5\nBottom: C3 Db3\nNotes: D3 version shipped by default.",
  ]) {
    const r = interpret(t);
    assert.equal(r.status, "NEEDS_INPUT", t);
    assert.ok(flagOf(r, "CONFLICTING_LIST"), t);
  }
});

test("a picked ding clears DING_CUE and CONFLICTING_DING and lets the string through", () => {
  const r = interpret("Notes: D E F G Bb", { ding: 3 });
  assert.equal(r.status, "REVIEW");
  assert.deepEqual(codes(r), ["NO_OCTAVE"]);
  assert.equal(importer.serialise(r), "(G3) D4 E4 F4 Bb4");
  for (const t of ["Main note C3\nNotes: D3 / A3 Bb3 C4 D4 E4 F4 G4 A4", "Main note C3 version also available.\nNotes: D3 A3 Bb3 C4 D4 E4 F4 G4 A4"]) {
    const picked = interpret(t, { ding: 0 });
    assert.equal(picked.status, "REVIEW", t);
    assert.equal(importer.serialise(picked), "(C3) D3 A3 Bb3 C4 D4 E4 F4 G4 A4", t);
  }
});

test("a picked ding on a note after the first moves to the front: same string as the labelled form", () => {
  const picked = importer.serialise(importer.interpret("Ding: D Top: E F G Bb", { ding: 3 }));
  assert.equal(picked, "(G3) D4 E4 F4 Bb4");
  assert.equal(picked, importer.serialise(importer.interpret("Ding: G Top: D E F Bb")));
});

test("IB: an inner note below the highest top note is a CONFIRM and serialises rim, bar, inner", () => {
  const r = run(byId("synthetic-inner-below-top"));
  assert.equal(r.status, "REVIEW");
  assert.equal(flagOf(r, "INNER_BELOW_TOP").level, "INFO");
  assert.equal(importer.serialise(r), "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5 | B4");
});

test("IB: the INNER_BELOW_TOP notes equal innerBelowRim of the serialised deck", () => {
  const r = run(byId("synthetic-inner-below-top"));
  const names = flagOf(r, "INNER_BELOW_TOP").notes.map((i) => r.notes[i].note);
  assert.ok(names.length > 0);
  assert.deepEqual(names, plain(core.innerBelowRim(core.parseSeed(importer.serialise(r)).value.fields)));
});

test("IB: serialise writes a dip as rim, bar, inner and equals formatSeed", () => {
  const roles = {
    ding: { note: "D3" },
    top: ["A3", "Bb3", "C4", "D4", "E4"].map((note) => ({ note })),
    inner: ["B3", "F4"].map((note) => ({ note })),
    bottom: [{ note: "C3" }]
  };
  const line = importer.serialise({ status: "REVIEW", roles });
  assert.equal(line, "[C3] (D3) A3 Bb3 C4 D4 E4 | B3 F4");
  assert.equal(line, core.formatSeed(core.parseSeed(line).value.fields));
  const bare = importer.serialise({ status: "REVIEW", roles: { ...roles, bottom: [] } });
  assert.equal(bare, "(D3) A3 Bb3 C4 D4 E4 | B3 F4");
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

const FUZZ_LISTS = [
  ["Ding: D3", "Top: A3 Bb3 C4 D4 E4 F4 G4 A4", "Bottom: C3 F3"],
  ["D3 ding, A3 Bb3 C4 D4 E4 F4 G4 A4 top."],
  ["D ding, A Bb C D E F G A top."],
  ["Notes: D3 / A3 Bb3 C4 D4 E4 F4 G4 A4 C5"],
  ["Ding: D", "Top: A Bb C D E F G A"],
  ["Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5", "Inner: D5 E5", "Ding: D3"],
];
const FUZZ_PROSE = [
  "C and D top.", "F and G inner.", "C and F on the bottom.", "C5 and D5 top.", "C3 and F3 on the bottom.",
  "A perfect gift for beginners.", "This is a D minor scale.", "A4 = 440 Hz", "Tuned to A4 at 432.", "Key: D",
  "Ding: D", "Note: A", "Bottom: c3 f3", "Older listing: C D E F G A B", "Also in C and D.", "E4", "G",
  "Top: A grade", "Sol La Si", "F3 Low Pygmy", "Bb3, C4", "Inner: none", "Nine notes in all.",
];

function fuzzPages(count) {
  let s = 2026;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const pages = [];
  for (let i = 0; i < count; i += 1) {
    const blocks = pick(FUZZ_LISTS).slice();
    const extra = Math.floor(rnd() * 3);
    for (let k = 0; k < extra; k += 1) blocks.splice(Math.floor(rnd() * (blocks.length + 1)), 0, pick(FUZZ_PROSE));
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
    pages.push({ long: long.join("\n"), short: compact.join("\n") });
  }
  return pages;
}

test("narrowing check: a seeded fuzz of long texts reads each one as its compact form or blocks", () => {
  const reading = (r) => [r.status, importer.serialise(r), r.flags.map((f) => f.code).join()].join(" | ");
  for (const page of fuzzPages(3000)) {
    assert.ok(page.short.length <= 2000);
    const r = interpret(page.long);
    if (r.status !== "REVIEW") { assert.equal(importer.serialise(r), ""); continue; }
    assert.equal(reading(r), reading(interpret(page.short)), page.short);
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

test("exactly four notes after a weak label are prose, not a list", () => {
  const r = interpret("Note: D3 A3 C4 D4");
  assert.equal(r.status, "INSUFFICIENT");
  assert.equal(importer.serialise(r), "");
});

test("a top note that repeats the ding at its own octave is a REPEATED_IN_SHELL block, not a restatement", () => {
  const r = interpret("Ding: D3 Top: D3 A3 Bb3 C4 D4 E4 F4 G4 A4");
  assert.equal(r.status, "NEEDS_INPUT");
  assert.ok(flagOf(r, "REPEATED_IN_SHELL"));
  const bare = interpret("Ding: D Top: D3 A3 Bb3 C4 E4 F4 G4 A4 C5");
  assert.equal(bare.status, "NEEDS_INPUT");
  assert.ok(flagOf(bare, "PROVISIONAL_REFUSED"));
});

test("parens:bottom reads the parenthesised notes after the ding as bottoms", () => {
  const r = interpret("Notes: (D3) A3 Bb3 (C4) D4 E4 F4 G4 A4 C5", { parens: "bottom" });
  assert.equal(r.status, "REVIEW");
  assert.equal(importer.serialise(r), "(D3) A3 Bb3 [C4] D4 E4 F4 G4 A4 C5");
});

test("reader: a weak label before ordinary words is prose, not notes", () => {
  const list = "Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4";
  for (const t of ["Note: B-grade finish", "Note: E-mail us", "Note: A hard case is included", "Notes A and E are brighter."]) {
    assert.equal(interpret(t).status, "INSUFFICIENT", t);
    assert.equal(importer.serialise(interpret(t + "\n" + list)), "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4", t);
  }
  for (const t of ["Note: B-grade finish", "Note: E-mail us", "Note: A hard case is included"]) {
    assert.equal(importer.serialise(interpret(list + "\n" + t)), "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4", t);
  }
});

// Import fix, lane E (docs/plans/2026-10-18-import-fix.md, E-1 and E-2).
const goldFixture = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests", "fixtures", "import_gold_v1.json"), "utf8"));

function synthTexts() {
  const out = new Set();
  const scales = [
    { ding: "D3", top: ["A3", "Bb3", "C4", "D4", "E4", "F4", "G4", "A4"], bottom: ["Bb2", "C3", "E3", "F3", "G3"], inner: ["C5", "D5"] },
    { ding: "C#3", top: ["G#3", "B3", "C#4", "D4", "F4", "F#4", "G#4", "B4"], bottom: ["F#2", "A2"], inner: ["C#5"] },
    { ding: "F3", top: ["G3", "Ab3", "C4", "Eb4", "F4", "G4", "Ab4", "C5", "Eb5"], bottom: ["C3", "Db3", "Eb3", "Bb3", "Db4"], inner: ["F5", "G5"] },
    { ding: "E3", top: ["B3", "D4", "E4", "F#4", "G4", "A4", "B4", "D5"], bottom: ["C3", "D3", "G3"], inner: [] },
  ];
  const below = { D3: ["C3", "A2", "Bb2"], "C#3": ["B2", "G#2"], F3: ["Eb3", "C3"], E3: ["D3", "B2"] };
  const labels = [
    ["Ding: ", " Top: ", " Bottom: ", " Inner: "],
    ["Ding: ", "\nTop: ", "\nBottom: ", "\nInner: "],
    ["Main note ", "\nNotes: ", "\nBottom notes: ", "\nInner notes: "],
  ];
  const seps = [" ", ", ", " - "];
  const bare = (a) => a.map((n) => n.replace(/-?\d$/, ""));
  for (const sc of scales) for (const L of labels) for (const sep of seps) {
    const base = (d = sc.ding, t = sc.top, b = sc.bottom, i = sc.inner) => {
      let x = L[0] + d + L[1] + t.join(sep);
      if (b.length) x += L[2] + b.join(sep);
      if (i.length) x += L[3] + i.join(sep);
      out.add(x);
    };
    base();
    base(sc.ding, sc.top, [], []);
    for (const n of below[sc.ding]) {
      base(sc.ding, [n, ...sc.top]);
      base(sc.ding, [...sc.top.slice(0, 2), n, ...sc.top.slice(2)], [], []);
    }
    base(sc.top[1], sc.top, [], []);
    base(sc.ding, [sc.ding, ...sc.top]);
    base(sc.bottom[0], sc.top);
    base(sc.ding, sc.top, [...sc.bottom, sc.ding]);
    for (let k = 0; k < sc.top.length; k++) base(sc.ding, [...sc.top.slice(0, k + 1), sc.top[k], ...sc.top.slice(k + 1)]);
    if (sc.bottom.length) base(sc.ding, sc.top, [...sc.bottom, sc.bottom[0]]);
    if (sc.inner.length) base(sc.ding, sc.top, sc.bottom, [...sc.inner, sc.inner[0]]);
    if (sc.bottom.length) base(sc.ding, sc.top, [...sc.bottom, sc.top[2]]);
    base(sc.ding, sc.top, sc.bottom, [sc.top[1]]);
    out.add("Ding: " + sc.ding + " Ding: " + sc.top[0] + " Top: " + sc.top.slice(1).join(sep));
    out.add("Ding: " + sc.top[0] + " Ding: " + sc.ding + " Top: " + sc.top.slice(1).join(sep));
    out.add("Main note " + below[sc.ding][0] + "\nNotes: " + sc.ding + " / " + sc.top.join(sep));
    out.add("Hauptnote " + sc.top[3] + "\nNoten " + sc.ding + " / " + sc.top.join(sep));
    base(sc.ding + sep + sc.top[0], sc.top.slice(1));
    base(sc.ding + sep + below[sc.ding][0], sc.top);
    base(sc.ding + sep + sc.top[1] + sep + sc.top[2], sc.top);
    out.add(L[1].trim() + " " + sc.top.join(sep) + "\nDing: " + sc.ding + "\n" + sc.top.slice(1, 3).join(sep));
    out.add("Ding: " + sc.ding + sep + sc.top[0] + " Ding: " + sc.top[1] + " Top: " + sc.top.slice(2).join(sep));
    base(sc.ding, bare(sc.top), [], []);
    base(sc.ding, sc.top, bare(sc.bottom), []);
    base(sc.ding, [...sc.top.slice(0, 3), bare([sc.top[3]])[0], ...sc.top.slice(4)], [], []);
  }
  return [...out];
}

const FINDING_TEXTS = [
  "Main note C3\nNotes: D3 / A3 Bb3 C4 D4 E4 F4 G4 A4",
  "Hauptnote C3\nNoten D3 / A3 Bb3 C4 D4 E4 F4 G4 A4",
  "Ding: D3 Ding: E3 Top: A3 B3 C4",
  "Ding: D3 Top: A3 A3 C4 D4 E4 F4",
  "Ding: D3 Top: D3 A3 Bb3 C4 D4 E4 F4 G4 A4",
  "Ding: D3 Top: A3 Bb3 C D4 E4 F4 G4 A4",
  "Notes: (D3) A3 (C4) (F4) G4",
  "Ding: D3 Top: C3 A3 Bb3 C4 D4",
  "Ding: D3 Top: F#3 A3 C#4 Bottom: Bb2",
  "Ding: D3 E3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4",
  "Ding: F3\nOuter circle: G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5\nBottom: C3 Db3\nNotes: D3 version shipped by default.",
  ["Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5", "Inner: D5 E5", "Ding: D3", "Bb3, C4"].join("\n"),
];

let corpusCache = null;
function importCorpus() {
  if (corpusCache) return corpusCache;
  const texts = new Set();
  fixture.cases.forEach((c) => texts.add(c.text));
  goldFixture.cases.forEach((c) => texts.add(c.span));
  FINDING_TEXTS.forEach((t) => texts.add(t));
  synthTexts().forEach((t) => texts.add(t));
  fuzzPages(3000).forEach((pg) => texts.add(pg.short));
  corpusCache = [...texts];
  return corpusCache;
}

function eachReachable(visit) {
  for (const text of importCorpus()) {
    const base = importer.interpret(text);
    visit(text, undefined, base);
    for (let i = 0; i < base.notes.length; i += 1) visit(text, i, importer.interpret(text, { ding: i }));
  }
}

const flagOrderCodes = () => {
  const src = fs.readFileSync(path.join(ROOT, "src", "engine", "importer.js"), "utf8");
  const at = src.indexOf("var FLAG_ORDER");
  return [...src.slice(at, src.indexOf("];", at)).matchAll(/\["([A-Z_]+)",/g)].map((m) => m[1]);
};

test("every REVIEW string the sheet can reach, every ding pick included, is a fixed point of formatSeed(parseSeed(x))", () => {
  const bad = [];
  let reviews = 0;
  eachReachable((text, pick, r) => {
    if (r.status !== "REVIEW") return;
    reviews += 1;
    const seed = importer.serialise(r);
    const p = seed ? core.parseSeed(seed) : { ok: false, code: "EMPTY" };
    const fixed = p.ok && core.formatSeed(p.value) === seed;
    if (!fixed && bad.length < 10) bad.push({ text, pick, seed, code: p.code || "NOT_A_FIXED_POINT" });
  });
  assert.ok(reviews > 1000, "the corpus produced REVIEW results: " + reviews);
  assert.deepEqual(bad, []);
});

test("IX: every result's flags are in FLAG_ORDER order", () => {
  const order = flagOrderCodes();
  const bad = [];
  eachReachable((text, pick, r) => {
    const ranks = r.flags.map((f) => order.indexOf(f.code));
    const sorted = ranks.every((x, i) => x >= 0 && (i === 0 || ranks[i - 1] <= x));
    if (!sorted && bad.length < 10) bad.push({ text, pick, flags: r.flags.map((f) => f.code) });
  });
  assert.deepEqual(bad, []);
});

test("IX: SEED_REFUSED fires only on a picked ding with no perfect fifth above it", () => {
  assert.ok(flagOrderCodes().includes("SEED_REFUSED"), "FLAG_ORDER holds SEED_REFUSED");
  const bad = [];
  let fired = 0;
  eachReachable((text, pick, r) => {
    const f = r.flags.find((x) => x.code === "SEED_REFUSED");
    if (!f) return;
    fired += 1;
    const ok = pick !== undefined && f.refusal.code === "NO_FIFTH" && r.status === "NEEDS_INPUT" && importer.serialise(r) === "";
    if (!ok && bad.length < 10) bad.push({ text, pick, refusal: f.refusal, status: r.status });
  });
  assert.ok(fired > 0, "the guard fires on the corpus");
  assert.deepEqual(bad, []);
});

const seedOf = (t, o) => importer.serialise(importer.interpret(t, o));
const B1 = "Main note C3\nNotes: D3 / A3 Bb3 C4 D4 E4 F4 G4 A4";
const B1_HAUPT = "Hauptnote C3\nNoten D3 / A3 Bb3 C4 D4 E4 F4 G4 A4";
const flagCodes = (r) => r.flags.map((f) => f.code);

test("IX: picking the list ding on a Main note clash drops the cue: (D3) A3 Bb3 C4 D4 E4 F4 G4 A4 with DING_CUE_DROPPED [0]", () => {
  for (const t of [B1, B1_HAUPT]) {
    const r = interpret(t, { ding: 1 });
    assert.equal(r.status, "REVIEW", t);
    assert.equal(seedOf(t, { ding: 1 }), "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4", t);
    assert.deepEqual(flagOf(r, "DING_CUE_DROPPED").notes, [0], t);
    assert.equal(flagOf(r, "DING_CUE_DROPPED").ding, 1, t);
    assert.equal(flagOf(r, "DING_CUE_DROPPED").level, "CONFIRM", t);
  }
});

test("IX: picking the Main note cue keeps the list ding as a top note: (C3) D3 A3 Bb3 ...", () => {
  const r = interpret(B1, { ding: 0 });
  assert.equal(r.status, "REVIEW");
  assert.equal(importer.serialise(r), "(C3) D3 A3 Bb3 C4 D4 E4 F4 G4 A4");
  assert.equal(flagOf(r, "DING_CUE_DROPPED"), undefined);
  assert.equal(flagOf(r, "DING_NOT_LOWEST"), undefined);
});

test("IX: TWO_DINGS: each pick writes (D3) or (E3) A3 B3 C4 with the other cue dropped", () => {
  const t = "Ding: D3 Ding: E3 Top: A3 B3 C4";
  const d = interpret(t, { ding: 0 });
  assert.equal(importer.serialise(d), "(D3) A3 B3 C4");
  assert.deepEqual(flagOf(d, "DING_CUE_DROPPED").notes, [1]);
  const e = interpret(t, { ding: 1 });
  assert.equal(importer.serialise(e), "(E3) A3 B3 C4");
  assert.deepEqual(flagOf(e, "DING_CUE_DROPPED").notes, [0]);
});

test("IX: one note per ding label is the cue: Ding: D3 Ding: E3 Top: A3 B3 C4 pick 0 drops E3 only", () => {
  const r = interpret("Ding: D3 Ding: E3 Top: A3 B3 C4", { ding: 0 });
  assert.equal(r.status, "REVIEW");
  assert.equal(importer.serialise(r), "(D3) A3 B3 C4");
  assert.deepEqual(flagOf(r, "DING_CUE_DROPPED").notes, [1]);
});

test("IX: a pitch repeated in one shell blocks with REPEATED_IN_SHELL and writes nothing", () => {
  const b2 = interpret("Ding: D3 Top: A3 A3 C4 D4 E4 F4");
  assert.equal(b2.status, "NEEDS_INPUT");
  assert.deepEqual(flagOf(b2, "REPEATED_IN_SHELL").notes, [1, 2]);
  assert.equal(flagOf(b2, "REPEATED_IN_SHELL").level, "BLOCK");
  assert.equal(importer.serialise(b2), "");
  const copy = interpret("Ding: D3 Top: D3 A3 Bb3 C4 D4 E4 F4 G4 A4");
  assert.equal(copy.status, "NEEDS_INPUT");
  assert.deepEqual(flagOf(copy, "REPEATED_IN_SHELL").notes, [0, 1]);
  assert.equal(importer.serialise(copy), "");
});

test("IX: a pitch repeated across shells stays a DUPLICATE_PITCH CONFIRM and writes a line parseSeed accepts", () => {
  const r = run(byId("sanango-c-harmonic-minor-16"));
  const f = flagOf(r, "DUPLICATE_PITCH");
  assert.deepEqual(f.notes, [3, 13]);
  assert.equal(f.level, "CONFIRM");
  assert.equal(flagOf(r, "REPEATED_IN_SHELL"), undefined);
  assert.equal(r.status, "REVIEW");
  assert.ok(core.parseSeed(importer.serialise(r)).ok);
});

test("IX: a pick above other top or inner notes blocks with DING_NOT_LOWEST naming them", () => {
  const cue = interpret(B1, { ding: 3 });
  assert.equal(cue.status, "NEEDS_INPUT");
  assert.deepEqual(flagOf(cue, "DING_NOT_LOWEST").notes, [1, 2]);
  assert.equal(flagOf(cue, "DING_NOT_LOWEST").ding, 3);
  assert.equal(importer.serialise(cue), "");
  const inner = interpret("Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4 Inner: C5 D5", { ding: 9 });
  assert.equal(inner.status, "NEEDS_INPUT");
  assert.deepEqual(flagOf(inner, "DING_NOT_LOWEST").notes, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(importer.serialise(inner), "");
});

test("IX: a labelled ding above a top note blocks with no pick: Ding: D3 Top: C3 A3 Bb3 C4 D4 is NEEDS_INPUT DING_NOT_LOWEST", () => {
  const r = interpret("Ding: D3 Top: C3 A3 Bb3 C4 D4");
  assert.equal(r.status, "NEEDS_INPUT");
  const f = flagOf(r, "DING_NOT_LOWEST");
  assert.deepEqual(f.notes.map((i) => r.notes[i].note), ["C3"]);
  assert.equal(importer.serialise(r), "");
});

test("IX: D-10 a prose D3 after a second list blocks with DING_NOT_LOWEST and CONFLICTING_LIST", () => {
  const r = interpret("Ding: F3\nOuter circle: G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5\nBottom: C3 Db3\nNotes: D3 version shipped by default.");
  assert.equal(r.status, "NEEDS_INPUT");
  assert.deepEqual(flagCodes(r), ["DING_NOT_LOWEST", "CONFLICTING_LIST"]);
});

test("IX: a picked bottom note blocks with DING_ON_BOTTOM", () => {
  const r = interpret("Ding: D3 Top: F#3 A3 C#4 Bottom: Bb2", { ding: 4 });
  assert.equal(r.status, "NEEDS_INPUT");
  assert.deepEqual(flagOf(r, "DING_ON_BOTTOM"), { code: "DING_ON_BOTTOM", level: "BLOCK", ding: 4 });
  assert.equal(importer.serialise(r), "");
});

test("IX: the SEED_REFUSED guard blocks a picked ding with no fifth above it: Ding: D3 Ding: E3 Top: A3 B3 C4 with ding 2", () => {
  const r = interpret("Ding: D3 Ding: E3 Top: A3 B3 C4", { ding: 2 });
  assert.equal(r.status, "NEEDS_INPUT");
  assert.equal(flagOf(r, "SEED_REFUSED").refusal.code, "NO_FIFTH");
  assert.equal(flagOf(r, "SEED_REFUSED").level, "BLOCK");
  const seen = flagCodes(r);
  assert.ok(seen.indexOf("SEED_REFUSED") < seen.indexOf("DING_CUE_DROPPED"), seen.join());
  assert.equal(importer.serialise(r), "");
});

test("IX: the SEED_REFUSED guard turns any refused REVIEW into NEEDS_INPUT", () => {
  const stub = loadEngine(["core", "importer"]);
  stub.core.parseSeed = function () { return { ok: false, code: "STUB_REFUSAL", reason: "stub" }; };
  const r = plain(stub.importer.interpret("Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4"));
  assert.equal(r.status, "NEEDS_INPUT");
  assert.deepEqual(flagOf(r, "SEED_REFUSED").refusal, { code: "STUB_REFUSAL", reason: "stub" });
});

test("IX: a ding label holding two notes blocks under any pick: Ding: D3 E3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4 pick 0 is NEEDS_INPUT DING_CLAUSE_MANY", () => {
  const t = "Ding: D3 E3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4";
  const r = interpret(t, { ding: 0 });
  assert.equal(r.status, "NEEDS_INPUT");
  assert.deepEqual(flagCodes(r), ["DING_CLAUSE_MANY"]);
  assert.deepEqual(flagOf(r, "DING_CLAUSE_MANY").notes, [0, 1]);
  assert.ok(r.notes.every((n) => n.role !== "dropped"));
  assert.equal(importer.serialise(r), "");
  assert.deepEqual(flagOf(interpret(t), "CONFLICTING_DING").notes, [0, 1]);
});

test("IX: an unlabelled line after a ding label is never dropped: the long-page Ding: D3 then Bb3, C4 with ding 11", () => {
  const page = ["Top: A3 Bb3 C4 D4 E4 F4 G4 A4 C5", "Inner: D5 E5", "Ding: D3", "Bb3, C4"].join("\n");
  const r = interpret(page, { ding: 11 });
  assert.equal(r.status, "NEEDS_INPUT");
  assert.deepEqual(flagOf(r, "DING_CLAUSE_MANY").notes, [11, 12, 13]);
  assert.ok(r.notes.every((n) => n.role !== "dropped"));
  assert.equal(importer.serialise(r), "");
});

test("IX: a dropped cue leaves no trace in the inferred octaves: Ding: D Ding: C Top: A Bb C D E F G A (G) with ding 0 and parens as bottom", () => {
  const r = interpret("Ding: D Ding: C Top: A Bb C D E F G A (G)", { ding: 0, parens: "bottom" });
  assert.equal(r.status, "REVIEW");
  assert.deepEqual(flagOf(r, "DING_CUE_DROPPED").notes, [1]);
  assert.equal(importer.serialise(r), "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 [G5]");
});

test("IX: DING_NOT_LOWEST names exactly the notes below the picked ding", () => {
  const cue = interpret("Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4", { ding: 3 });
  assert.equal(cue.status, "NEEDS_INPUT");
  assert.deepEqual(flagOf(cue, "DING_NOT_LOWEST").notes, [0, 1, 2]);
  const inner = interpret("Ding: D3 Top: A3 Bb3 C4 D4 E4 F4 G4 A4, C5 Inner: B4", { ding: 9 });
  assert.equal(inner.status, "NEEDS_INPUT");
  assert.deepEqual(flagOf(inner, "DING_NOT_LOWEST").notes, [0, 1, 2, 3, 4, 5, 6, 7, 8, 10]);
  assert.equal(importer.serialise(inner), "");
});

test("IX: a stray close mark in a contested read is kept as the picked ding and the label cue is dropped", () => {
  const r = interpret("Ding: D3\nTop: A3) Bb3 C4 D4 E4 F4 G4 A4", { ding: 1 });
  assert.equal(r.status, "REVIEW");
  assert.equal(importer.serialise(r), "(A3) Bb3 C4 D4 E4 F4 G4 A4");
  assert.deepEqual(flagOf(r, "DING_CUE_DROPPED").notes, [0]);
});

test("IX: a dropped ding cue is not counted as a bare note", () => {
  const r = interpret("Ding: D3 Ding: E\nTop: A3 Bb3 C4 D4 E4 F4 G4 A4", { ding: 0 });
  assert.equal(r.status, "REVIEW");
  assert.deepEqual(flagOf(r, "DING_CUE_DROPPED").notes, [1]);
  assert.equal(flagOf(r, "NO_OCTAVE"), undefined);
  assert.equal(importer.serialise(r), "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4");
});

test("IX: a dropped ding cue is not checked for a repeated pitch", () => {
  const r = interpret("Ding: D3\nDing: A3\nTop: A3 Bb3 C4 D4 E4 F4 G4 A4", { ding: 0 });
  assert.equal(r.status, "REVIEW");
  assert.equal(flagOf(r, "REPEATED_IN_SHELL"), undefined);
  assert.equal(importer.serialise(r), "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4");
});

test("IH: N1 DING_NOT_LOWEST names only notes strictly below the ding: Ding: D3 Top: D3 A3 Bb3 C4 D4 is NEEDS_INPUT with REPEATED_IN_SHELL alone", () => {
  const r = interpret("Ding: D3 Top: D3 A3 Bb3 C4 D4");
  assert.equal(r.status, "NEEDS_INPUT");
  assert.deepEqual(codes(r), ["REPEATED_IN_SHELL"]);
});

describe("IH: compose", () => {
  const compose = (f) => plain(importer.compose(Object.assign({ ding: "", top: "", inner: "", bottom: "" }, f)));
  const RIM8 = "A Bb C D E F G A";
  const lineOf = (s) => core.formatSeed(core.parseSeed(s).value.fields);
  const unclean = (r, f) => assert.ok(!r.ok && r.errors[f] !== null, f + " carries an error");

  test("IH: compose infers rim and inner octaves exactly as parseSeed does for the same line", () => {
    const r = compose({ ding: "D3", top: RIM8, inner: "C D" });
    const line = "(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5";
    assert.ok(r.ok);
    assert.equal(r.line, lineOf(line));
    assert.deepEqual(r.seed, plain(core.parseSeed(line).value));
    assert.deepEqual(r.notes.top, ["A3", "Bb3", "C4", "D4", "E4", "F4", "G4", "A4"]);
    assert.deepEqual(r.notes.inner, ["C5", "D5"]);
    assert.deepEqual(r.notes.ding, ["D3"]);
  });

  test("IH: compose places bottoms through serialise, after the bar when they sit above an inner note and before a ding of the same pitch", () => {
    const high = compose({ ding: "F3", top: "G3 Ab3 C4 Eb4 F4 G4 Ab4 C5 Eb5", inner: "F5 G5", bottom: "Ab5" });
    assert.ok(high.ok);
    assert.match(high.line, / \| F5 G5 \[Ab5\]$/);
    const tie = compose({ ding: "D3", top: "A3", bottom: "D3" });
    assert.ok(tie.ok);
    assert.equal(tie.line, "[D3] (D3) A3");
  });

  test("IH: compose of each built-in's decomposed fields equals formatSeed of that deck, Pygmy included", () => {
    const decks = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "decks.json"), "utf8"));
    assert.equal(decks.length, 5);
    for (const d of decks) {
      const ids = Object.keys(d.fields).map(Number).sort((a, b) => a - b);
      const names = (zone) => ids.filter((i) => d.fields[i][3] === zone).map((i) => d.fields[i][0] + d.fields[i][1]).join(" ");
      const r = compose({ ding: names("ding"), top: names("rim"), inner: names("inner"), bottom: names("bottom") });
      assert.ok(r.ok, d.id + " composes");
      assert.equal(r.line, core.formatSeed(d.fields), d.id);
      assert.deepEqual(r.guessed, [], d.id + " guesses nothing");
    }
  });

  test("IH: compose guesses the first octaveless bottom in the ding's octave, an octave down when it names the ding, and lists it in guessed, and Db under ding C#3 reads Db2", () => {
    const a = compose({ ding: "D3", top: "A3", bottom: "Bb" });
    assert.deepEqual(a.guessed, ["Bb3"]);
    assert.deepEqual(a.notes.bottom, ["Bb3"]);
    const same = compose({ ding: "D3", top: "A3", bottom: "D" });
    assert.deepEqual(same.guessed, ["D2"]);
    assert.equal(same.line, "[D2] (D3) A3");
    const enharmonic = compose({ ding: "C#3", top: "G#3", bottom: "Db" });
    assert.deepEqual(enharmonic.guessed, ["Db2"]);
    assert.ok(enharmonic.ok);
  });

  test("IH: compose keeps a typed bottom octave, lists no guess for it, and sets info only when something was guessed", () => {
    const typed = compose({ ding: "D3", top: "A3", bottom: "C3 Eb3" });
    assert.ok(typed.ok);
    assert.deepEqual(typed.guessed, []);
    assert.equal(typed.info.bottom, null);
    const mixed = compose({ ding: "D3", top: "A3", bottom: "C3 Eb" });
    assert.deepEqual(mixed.guessed, ["Eb3"]);
    assert.equal(mixed.info.bottom, "Octaves guessed: Eb3. Type an octave to change a guess.");
    const two = compose({ ding: "D3", top: "A3", bottom: "C Eb" });
    assert.deepEqual(two.guessed, ["C3", "Eb3"]);
    assert.equal(two.info.bottom, "Octaves guessed: C3, Eb3. Type an octave to change a guess.");
  });

  test("IH: compose reads lowercase notes: a3, bb3 and eb read as A3, Bb3 and Eb", () => {
    const r = compose({ ding: "d3", top: "a3 bb3 c4 d4 e4 f4 g4 a4", bottom: "eb" });
    assert.ok(r.ok);
    assert.deepEqual(r.notes.top, ["A3", "Bb3", "C4", "D4", "E4", "F4", "G4", "A4"]);
    assert.deepEqual(r.notes.bottom, ["Eb3"]);
    assert.equal(r.line, "(D3) [Eb3] A3 Bb3 C4 D4 E4 F4 G4 A4");
  });

  test("IH: compose refuses an uppercase second B: BB3 gives \"BB is not a note: write B-flat as Bb.\" and EB gives \"EB is not a note: write E-flat as Eb.\"", () => {
    const bb = compose({ ding: "D3", top: "A3 BB3" });
    assert.equal(bb.errors.top, "BB is not a note: write B-flat as Bb.");
    assert.equal(bb.ok, false);
    const eb = compose({ ding: "D3", top: "A3", bottom: "EB" });
    assert.equal(eb.errors.bottom, "EB is not a note: write E-flat as Eb.");
    const b = compose({ ding: "D3", top: "A B" });
    assert.ok(b.ok);
    assert.deepEqual(b.notes.top, ["A3", "B3"]);
  });

  test("IH: compose refuses solfege with \"Use letter names, like D A Bb.\"", () => {
    const top = compose({ ding: "D3", top: "Re Mi" });
    assert.equal(top.errors.top, "Use letter names, like D A Bb.");
    const ding = compose({ ding: "Sol" });
    assert.equal(ding.errors.ding, "Use letter names, like D A Bb.");
    const bottom = compose({ ding: "D3", top: "A3", bottom: "Do3" });
    assert.equal(bottom.errors.bottom, "Use letter names, like D A Bb.");
  });

  test("IH: compose reads # b ♯ ♭ and splits on spaces, commas, semicolons and line breaks", () => {
    const r = compose({ ding: "D3", top: "A♭3 B♭3,  C4;D4\nE4\tF♯4 G#4" });
    assert.deepEqual(r.notes.top, ["Ab3", "Bb3", "C4", "D4", "E4", "F#4", "G#4"]);
    assert.equal(r.errors.top, null);
    const flat = compose({ ding: "D♭3", top: "A♭3" });
    assert.deepEqual(flat.notes.ding, ["Db3"]);
  });

  test("IH: compose refuses brackets and bars typed into a field", () => {
    const msg = "Type notes only: the line is written for you.";
    assert.equal(compose({ ding: "D3", top: "[A3] Bb3" }).errors.top, msg);
    assert.equal(compose({ ding: "(D3)", top: "A3" }).errors.ding, msg);
    assert.equal(compose({ ding: "D3", top: "A3 Bb3 C4", inner: "| D5" }).errors.inner, msg);
    assert.equal(compose({ ding: "D3", top: "A3", bottom: "(C3)" }).errors.bottom, msg);
  });

  test("IH: compose stages its parse: a top order error is under TOP with \"X is lower than Y: list low to high.\", a top note below the ding says so, a top pitch repeated in INNER is NOTE_REPEATED under INNER, and an octaveless inner Bb over top C4 reads Bb4", () => {
    const order = compose({ ding: "D3", top: "A3 Bb3 G3" });
    assert.equal(order.errors.top, "G3 is lower than Bb3: list low to high.");
    assert.equal(order.errors.ding, null);
    assert.equal(order.errors.inner, null);
    const below = compose({ ding: "D3", top: "C3 A3" });
    assert.equal(below.errors.top, "C3 is not above the ding, D3.");
    const repeat = compose({ ding: "D3", top: "A3 Bb3 C4", inner: "C4" });
    assert.equal(repeat.errors.inner, "C4 is already in the top or inner notes.");
    assert.equal(repeat.errors.top, null);
    const lower = compose({ ding: "D3", top: "A3 Bb3 C4", inner: "Bb3" });
    assert.equal(lower.errors.inner, "Bb3 is already in the top or inner notes.");
    const dip = compose({ ding: "D3", top: "A3 Bb3 C4", inner: "B3" });
    assert.equal(dip.errors.inner, null);
    assert.ok(dip.ok);
    const later = compose({ ding: "D3", top: "A3 Bb3 C4", inner: "D5 C5" });
    assert.equal(later.errors.inner, "C5 is lower than D5: list low to high.");
    const bare = compose({ ding: "D3", top: "A3 Bb3 C4", inner: "Bb" });
    assert.equal(bare.errors.inner, null);
    assert.deepEqual(bare.notes.inner, ["Bb4"]);
    assert.ok(bare.ok);
  });

  test("IB: compose accepts an inner note typed below the top notes and writes rim, bar, inner", () => {
    const r = compose({ ding: "D3", top: "A3 Bb3 C4 D4 E4", inner: "B3 F4" });
    assert.ok(r.ok);
    assert.equal(r.errors.inner, null);
    assert.equal(r.line, "(D3) A3 Bb3 C4 D4 E4 | B3 F4");
    assert.deepEqual(r.notes.top, ["A3", "Bb3", "C4", "D4", "E4"]);
    assert.deepEqual(r.notes.inner, ["B3", "F4"]);
  });

  test("IB: compose keeps every top note on the rim when an inner note sits below it", () => {
    assert.equal(compose({ ding: "D3", top: "A3 Bb3 C4 D4 E4", inner: "B3 F4" }).line, "(D3) A3 Bb3 C4 D4 E4 | B3 F4");
    assert.equal(compose({ ding: "D3", top: "A3 C4", inner: "B3" }).line, "(D3) A3 C4 | B3");
  });

  test("IB: compose names a guessed inner octave in info.inner and says how to put a note lower", () => {
    const r = compose({ ding: "D3", top: RIM8, inner: "C D" });
    assert.equal(r.info.inner, "Octaves guessed: C5, D5. An inner note can sit below the top notes: type its octave to put it there.");
    const typed = compose({ ding: "D3", top: RIM8, inner: "C5 D5" });
    assert.equal(typed.info.inner, null);
    assert.equal(compose({ ding: "D3", top: RIM8 }).info.inner, null);
  });

  test("IB: compose names an inner note below the top notes in info.inner", () => {
    const r = compose({ ding: "D3", top: "A3 C4 D4 E4", inner: "B3" });
    assert.equal(r.info.inner, "B3 sits below the top notes. Check it on the pan picture.");
    const both = compose({ ding: "D3", top: "A3 C4 D4 E4", inner: "B3 F" });
    assert.equal(both.info.inner, "Octaves guessed: F4. An inner note can sit below the top notes: type its octave to put it there. B3 sits below the top notes. Check it on the pan picture.");
    assert.equal(compose({ ding: "D3", top: "A3 C4", inner: "D5" }).info.inner, null);
  });

  test("IB: compose says an inner note at or below the ding is not above the ding", () => {
    const r = compose({ ding: "D3", top: "A3 C4 D4 E4", inner: "C3" });
    assert.equal(r.errors.inner, "C3 is not above the ding, D3.");
    assert.equal(r.ok, false);
    const same = compose({ ding: "D3", top: "A3 C4 D4 E4", inner: "D3" });
    assert.equal(same.errors.inner, "D3 is not above the ding, D3.");
  });

  test("IH: compose puts NO_FIFTH under DING and never NO_FIFTH under TOP while a prefix is staged, and reports no NO_FIFTH while TOP is empty (DING F3 alone carries no DING error)", () => {
    const alone = compose({ ding: "F3" });
    assert.equal(alone.errors.ding, null);
    assert.equal(alone.errors.top, "Enter the top notes, low to high.");
    const none = compose({ ding: "F3", top: "G3 Ab3" });
    assert.equal(none.errors.ding, "No fifth above the ding F3: add C to the top notes, or check the ding.");
    assert.equal(none.errors.top, null);
    assert.equal(none.ok, false);
    assert.equal(none.line, "");
    const order = compose({ ding: "D3", top: "Bb3 G3" });
    assert.equal(order.errors.top, "G3 is lower than Bb3: list low to high.");
    assert.equal(order.errors.ding, null);
    const inner = compose({ ding: "F3", top: "G3 Ab3", inner: "Bb4" });
    assert.equal(inner.errors.inner, null);
    assert.match(inner.errors.ding, /^No fifth above the ding F3/);
    const fixed = compose({ ding: "F3", top: "G3 Ab3", inner: "C5" });
    assert.ok(fixed.ok);
  });

  test("IH: compose refuses bottoms out of order with \"X is lower than Y: list low to high.\", refuses a repeated bottom, and accepts a bottom copy of a rim pitch", () => {
    const order = compose({ ding: "D3", top: "A3", bottom: "Eb3 C3" });
    assert.equal(order.errors.bottom, "C3 is lower than Eb3: list low to high.");
    assert.equal(order.ok, false);
    const repeat = compose({ ding: "D3", top: "A3", bottom: "C3 C3" });
    assert.equal(repeat.errors.bottom, "C3 is already in the bottom notes.");
    const typedLow = compose({ ding: "D3", top: "A3", bottom: "C Eb2" });
    assert.equal(typedLow.errors.bottom, "Eb2 is lower than C3: list low to high.");
    const copy = compose({ ding: "D3", top: "A3 Bb3", bottom: "A3" });
    assert.ok(copy.ok);
    assert.equal(copy.line, "(D3) [A3] A3 Bb3");
  });

  test("IH: compose refuses notes outside C-1 to G9 in each field, and an octaveless bottom whose guess falls outside that range", () => {
    const msg = (x) => x + " is outside C-1 to G9.";
    assert.equal(compose({ ding: "D3", top: "A3 Ab9" }).errors.top, msg("Ab9"));
    assert.equal(compose({ ding: "Ab9" }).errors.ding, msg("Ab9"));
    assert.equal(compose({ ding: "D3", top: "A3 Bb3 C4", inner: "B9" }).errors.inner, msg("B9"));
    assert.equal(compose({ ding: "D3", top: "A3", bottom: "Cb-1" }).errors.bottom, msg("Cb-1"));
    assert.equal(compose({ ding: "D3", top: "G9 A" }).errors.top, msg("A9"));
    const fit = "A has no octave that fits: type one.";
    assert.equal(compose({ ding: "G9", bottom: "A" }).errors.bottom, fit);
    assert.equal(compose({ ding: "D3", top: "A3", bottom: "G9 A" }).errors.bottom, fit);
    assert.ok(compose({ ding: "Cb4", top: "Gb4", bottom: "G9" }).ok);
  });

  test("IH: compose of four blank fields is empty, not ok, and carries no errors", () => {
    for (const r of [compose({}), compose({ ding: " ", top: "\n", inner: ",", bottom: ";" })]) {
      assert.equal(r.empty, true);
      assert.equal(r.ok, false);
      assert.deepEqual(r.errors, { ding: null, top: null, inner: null, bottom: null });
      assert.equal(r.line, "");
      assert.deepEqual(r.guessed, []);
    }
    assert.equal(compose({ ding: "D3" }).empty, false);
    assert.equal(compose({ bottom: "C3" }).empty, false);
    assert.equal(compose({ bottom: "C3" }).errors.ding, "Enter the ding, like D3.");
  });

  test("IH: compose steps each later octaveless bottom to the lowest octave above the one before it, so Pygmy's octaveless bottoms read C3 Db3 Eb3 Bb3 Db4 Ab4", () => {
    const r = compose({ ding: "F3", top: "G Ab C Eb F G Ab C Eb", inner: "F G", bottom: "C Db Eb Bb Db Ab" });
    assert.ok(r.ok);
    assert.deepEqual(r.guessed, ["C3", "Db3", "Eb3", "Bb3", "Db4", "Ab4"]);
    assert.deepEqual(r.notes.bottom, ["C3", "Db3", "Eb3", "Bb3", "Db4", "Ab4"]);
    assert.equal(r.line, lineOf("[C3] [Db3] [Eb3] (F3) G3 Ab3 [Bb3] C4 [Db4] Eb4 F4 G4 [Ab4] Ab4 C5 Eb5 | F5 G5"));
    assert.equal(r.info.bottom, "Octaves guessed: C3, Db3, Eb3, Bb3, Db4, Ab4. Type an octave to change a guess.");
  });

  test("IH: compose steps a later octaveless bottom past the ding's midi: under ding D3, bottoms C D read C3 D4", () => {
    const r = compose({ ding: "D3", top: "A3", bottom: "C D" });
    assert.ok(r.ok);
    assert.deepEqual(r.guessed, ["C3", "D4"]);
    assert.equal(r.line, lineOf("[C3] (D3) A3 [D4]"));
    assert.deepEqual(r.notes.bottom, ["C3", "D4"]);
  });
});
