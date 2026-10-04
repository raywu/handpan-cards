#!/usr/bin/env node
/* Rewrites (or, with --check, verifies) tests/fixtures/card_face_v1.json: a
 * sha256/16 fingerprint of every FULL CARD FACE's innerHTML - header,
 * diagram, badge, note line and number line together, not just the diagram
 * pan() alone pins (see tools/regen_pan_fixture.js).
 *
 * Why this exists (quality-refactor plan, 2026-09-30, finding 0 / R-1):
 * "same DOM per card" had no oracle covering the whole face. A refactor to
 * render() (finding 18) or to any app helper (finding 13) could silently
 * change the header, note line, number line or a badge and nothing would
 * fail. This fixture is that oracle, generated from e8f9be8 (the plan's
 * reference commit) and checked, unchanged, at every commit on lane A's
 * branch. A deliberate face change regenerates it in the SAME commit and
 * says why in that commit's message / the PR body - never as a silent
 * rebuild.
 *
 * Coverage: every BUILT-IN deck (DECKS, not a generated/custom one) x every
 * card x mode A, B and S x face (front, back). Mode S does not have a
 * "card index" of its own - a sequence is a walk over SOME of the deck's
 * chords in a particular order - so S is covered by every sequence
 * HPE.sequence.sequences(deck, 2|3) can produce for that deck (the complete,
 * deterministic set - not a random draw), at every position in each one.
 *
 * Usage:
 *   node tools/regen_card_fixture.js              regenerate from ./index.html
 *   node tools/regen_card_fixture.js --html PATH  regenerate from PATH instead
 *   node tools/regen_card_fixture.js --check      compare only, exit 1 on any
 *                                                  mismatch (named deck/card/
 *                                                  mode/face), never writes
 *   --html combines with --check.
 *
 * --html works WITHOUT touching tools/sandbox.js (lane T's file, not this
 * lane's to edit): sandbox.js's boot() always reads its own fixed APP path
 * (`path.join(__dirname, "..", "index.html")`) via the real node:fs, so this
 * tool intercepts fs.readFileSync for exactly that one path for the
 * duration of one boot() call and hands back the requested file's bytes
 * instead - sandbox.js's own logic, including every element id it serves,
 * runs unmodified against a different file on disk.
 */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const sandboxMod = require("./sandbox.js");

const digest = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

function bootFromHtml(htmlPath) {
  const content = fs.readFileSync(htmlPath, "utf8");
  const real = fs.readFileSync;
  fs.readFileSync = function (p, ...rest) {
    if (p === sandboxMod.APP) return content;
    return real.call(fs, p, ...rest);
  };
  try {
    return sandboxMod.boot();
  } finally {
    fs.readFileSync = real;
  }
}

/** Every sequence HPE.sequence.sequences(deck, length) can produce, for
 *  length 2 and 3 together - the complete, order-independent set, not one
 *  random draw. [] when the deck has no home anchor or no sequence at all
 *  (render() shows the "not enough simple chords" face instead; that face
 *  carries no card index or mode-A/B content to diverge, so it is not
 *  fixtured here - a deck losing its only sequence is a chords[] change,
 *  which is a non-goal, not a render regression).
 */
function sequencesFor(app, deckIndex) {
  const expr = `(function(){
    var d = DECKS[${deckIndex}];
    return (HPE.sequence.sequences(d, 2) || []).concat(HPE.sequence.sequences(d, 3) || []);
  })()`;
  return app.get(expr);
}

function facesForDeck(app, deckIndex) {
  const d = app.get(`DECKS[${deckIndex}]`);
  const n = d.chords.length;
  const modes = {};

  for (const mode of ["A", "B"]) {
    app.run(`mode = ${JSON.stringify(mode)}`);
    const cards = {};
    for (let c = 0; c < n; c += 1) {
      app.run(`order = [...Array(${n}).keys()]`);
      app.run(`idx = ${c}`);
      app.run("render()");
      cards[c] = { front: digest(app.els.front._html), back: digest(app.els.back._html) };
    }
    modes[mode] = cards;
  }

  app.run('mode = "S"');
  const sequences = sequencesFor(app, deckIndex);
  const sCards = {};
  sequences.forEach((seqChords, si) => {
    app.run(`seq = ${JSON.stringify({ chords: seqChords, style: "together" })}`);
    app.run("order = seq.chords.slice()");
    seqChords.forEach((_, pos) => {
      app.run(`idx = ${pos}`);
      app.run("render()");
      sCards[`${si}.${pos}`] = { front: digest(app.els.front._html), back: digest(app.els.back._html) };
    });
  });
  modes.S = sCards;

  return modes;
}

function build(htmlPath) {
  const app = bootFromHtml(htmlPath);
  const D = app.get("DECKS");
  const decks = {};
  for (let i = 0; i < D.length; i += 1) {
    app.select(D[i].id);
    decks[D[i].id] = facesForDeck(app, i);
  }
  return decks;
}

function diffAll(expected, actual) {
  const problems = [];
  const deckIds = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const deckId of deckIds) {
    const eDeck = expected[deckId] || {};
    const aDeck = actual[deckId] || {};
    const modes = new Set([...Object.keys(eDeck), ...Object.keys(aDeck)]);
    for (const mode of modes) {
      const eMode = eDeck[mode] || {};
      const aMode = aDeck[mode] || {};
      const cards = new Set([...Object.keys(eMode), ...Object.keys(aMode)]);
      for (const card of cards) {
        const eCard = eMode[card];
        const aCard = aMode[card];
        if (!eCard || !aCard) {
          problems.push(`${deckId} mode ${mode} card ${card}: ${!eCard ? "missing from fixture" : "missing from current render"}`);
          continue;
        }
        for (const face of ["front", "back"]) {
          if (eCard[face] !== aCard[face]) {
            problems.push(`${deckId} mode ${mode} card ${card} face ${face}: fixture ${eCard[face]} != current ${aCard[face]}`);
          }
        }
      }
    }
  }
  return problems;
}

const GEN_SCALES = path.join(__dirname, "..", "tests", "fixtures", "synthetic_scales.json");
const GEN_DEST = path.join(__dirname, "..", "tests", "fixtures", "gen_face_v1.json");

/** Structural serialisation of a stub-DOM node: tag, class, attributes, text. */
function serialiseNode(n) {
  if (n.nodeType === 3) return JSON.stringify(n.textContent);
  const attrs = Object.keys(n.attributes || {}).sort().map((k) => `${k}=${n.attributes[k]}`).join(" ");
  const kids = (n.children || []).map(serialiseNode).join("");
  return `<${n.tagName.toLowerCase()} class="${n.className}" ${attrs}>${JSON.stringify(n._text || "")}${kids}</>`;
}

/** Faces of the first three cards of every generated synthetic deck in modes
 *  A and B, plus the sequence-rail DOM for one basic and one tiered sequence
 *  on Amara. Digests only, like card_face_v1.json. */
function buildGen(htmlPath) {
  const app = bootFromHtml(htmlPath);
  const scales = JSON.parse(fs.readFileSync(GEN_SCALES, "utf8")).filter((s) => s.expect && s.expect.ok);
  const decks = {};
  for (const sc of scales) {
    const res = app.generate(sc.string);
    if (!res.ok) throw new Error(`${sc.name}: generate failed`);
    app.select(res.value.id);
    const modes = {};
    for (const mode of ["A", "B"]) {
      app.run(`mode = ${JSON.stringify(mode)}`);
      const n = app.get("deck().chords.length");
      app.run(`order = [...Array(${n}).keys()]`);
      const cards = {};
      for (let c = 0; c < Math.min(3, n); c += 1) {
        app.run(`idx = ${c}`);
        app.run("render()");
        cards[c] = { front: digest(app.els.front._html), back: digest(app.els.back._html) };
      }
      modes[mode] = cards;
    }
    decks[sc.name] = modes;
  }
  app.select("amara");
  const rails = {};
  for (const tierName of ["basic", "advanced"]) {
    app.run(`mode = "S"`);
    app.run(`tier = ${JSON.stringify(tierName)}`);
    app.run("seq = HPE.sequence.pick(deck(), function () { return 0; }, null, tier)");
    app.run("order = seq.chords.slice()");
    app.run("idx = 0");
    app.run("render()");
    rails[tierName] = digest(serialiseNode(app.els.count));
  }
  return { decks, rails };
}

function diffGen(expected, actual) {
  const problems = [];
  for (const k of new Set([...Object.keys(expected.decks), ...Object.keys(actual.decks)])) {
    const e = expected.decks[k], a = actual.decks[k];
    if (!e || !a) { problems.push(`gen deck "${k}": ${!e ? "missing from fixture" : "missing from current render"}`); continue; }
    for (const mode of ["A", "B"]) {
      for (const c of Object.keys(e[mode])) {
        for (const face of ["front", "back"]) {
          if (!a[mode][c] || e[mode][c][face] !== a[mode][c][face]) {
            problems.push(`gen deck "${k}" mode ${mode} card ${c} face ${face}: fixture ${e[mode][c][face]} != current ${a[mode][c] && a[mode][c][face]}`);
          }
        }
      }
    }
  }
  for (const t of Object.keys(expected.rails)) {
    if (expected.rails[t] !== actual.rails[t]) problems.push(`rail ${t}: fixture ${expected.rails[t]} != current ${actual.rails[t]}`);
  }
  return problems;
}

function mainGen(htmlPath, check) {
  const gen = buildGen(htmlPath);
  if (check) {
    const problems = diffGen(JSON.parse(fs.readFileSync(GEN_DEST, "utf8")), gen);
    if (problems.length) {
      console.error(`gen_face_v1.json is stale against ${htmlPath} (${problems.length} mismatch(es)):`);
      for (const p of problems) console.error("  " + p);
      process.exit(1);
    }
    console.log(`gen_face_v1.json matches ${htmlPath}: ${Object.keys(gen.decks).length} generated decks, rails ${Object.keys(gen.rails).join("/")}`);
    return;
  }
  const out = {
    _what: "sha256/16 of (a) the front and back face innerHTML of the first three cards of every ok synthetic_scales.json deck, generated, in modes A and B; (b) a structural serialisation of #count after render() in mode S for a basic and an advanced sequence on Amara (HPE.sequence.pick with rng () => 0).",
    _why: "AP3-0 (complexity refactor 2026-10-03): card_face_v1.json hashes built-in faces only and nothing hashed the rail DOM. Taken from main fe63803 before any AP3 refactor commit.",
    _regen: "node tools/regen_card_fixture.js --gen [--html PATH]",
    ...gen,
  };
  fs.writeFileSync(GEN_DEST, JSON.stringify(out, null, 2) + "\n");
  console.log(`wrote ${GEN_DEST} from ${htmlPath}`);
}

function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const htmlFlagIdx = args.indexOf("--html");
  const htmlArg = htmlFlagIdx >= 0 ? args[htmlFlagIdx + 1] : null;
  const htmlPath = path.resolve(htmlArg || path.join(__dirname, "..", "index.html"));
  const dest = path.join(__dirname, "..", "tests", "fixtures", "card_face_v1.json");

  if (args.includes("--gen")) { mainGen(htmlPath, check); return; }

  const decks = build(htmlPath);

  if (check) {
    const existing = JSON.parse(fs.readFileSync(dest, "utf8"));
    const problems = diffAll(existing.decks, decks);
    if (problems.length) {
      console.error(`card_face_v1.json is stale against ${htmlPath} (${problems.length} mismatch(es)):`);
      for (const p of problems) console.error("  " + p);
      process.exit(1);
    }
    console.log(`card_face_v1.json matches ${htmlPath}: ` +
      Object.keys(decks).map((k) => `${k} ${Object.keys(decks[k].A).length} cards`).join(", "));
    mainGen(htmlPath, true);
    return;
  }

  const out = {
    _what: "sha256(face innerHTML) truncated to 16 hex, for every BUILT-IN deck x card x mode (A, B, S) x face (front, back). S is keyed `<sequence index>.<position>` over every sequence HPE.sequence.sequences(deck, 2|3) can produce, not a random draw.",
    _why: "finding 0 / R-1 (quality-refactor plan, 2026-09-30): the pre-existing pan_render_v1.json pins the diagram only; header, note line, number line and badges had no oracle, so a render refactor (finding 18, 13) could change them silently. Generated from e8f9be8 (git show e8f9be8:index.html), the plan's reference commit - a deliberate face change regenerates this file in the same commit and says why.",
    _regen: "node tools/regen_card_fixture.js [--html PATH]",
    decks,
  };
  fs.writeFileSync(dest, JSON.stringify(out, null, 2) + "\n");
  console.log(`wrote ${dest} from ${htmlPath}: ` +
    Object.keys(decks).map((k) => `${k} ${Object.keys(decks[k].A).length} cards`).join(", "));
}

main();
