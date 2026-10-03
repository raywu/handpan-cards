#!/usr/bin/env node
// The settings-panel acceptance oracle (docs/plans/2026-10-02-difficulty-d2-replan.md
// sections 4.3 and 4.3.1). Library and CLI.
//
//   node tools/probe/panel_fit.js --base origin/main [--candidate <ref>]
//        [--font real|fallback|both] [--workers N]
//
// It extracts the base's index.html with `git show`, serves base and candidate,
// derives the media-query edges from the CSSOM of BOTH, and measures every cell
// of the domain in both roots. Nothing in here names a breakpoint.
//
// Exit status is non-zero on any regression, on a run that skipped a cell, on a
// font mode that is not the one requested, on a base that cannot be read, on a
// condition the grammar does not model, and on a broken invariance check.
// It never skips silently.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { execFileSync } = require("node:child_process");

const REPO = path.resolve(__dirname, "..", "..");

/* ------------------------------------------------------------------ constants */

// Owner ruling 2026-10-02 (plan section 4.3, rule 2): a control offscreen on the
// candidate where the base shows it is a regression. OD-8, answered by the owner
// 2026-10-03: where the base ITSELF overflows, a control that sits lower on the
// candidate is reported, not failed. The constant governs POSITION only; a control
// the candidate does not render, or lacks, fails whatever it says (ER-25).
const OD8_FAIL_BASE_OVERFLOW = false;

// Controls the base renders and the candidate deliberately lacks (ER-16, RP-19).
// Any other control the base renders and the candidate lacks fails rule 2: the
// judge walks the candidate's controls, so an accidental deletion is otherwise
// invisible to it.
const REMOVED_BY_DESIGN = ["modeS"];

const W_LO = 320, W_HI = 1300, H_LO = 320, H_HI = 1100;
const SIDEBAR_WIDTHS = [1024, 1025, 1100, 1280, 1300, 1440, 1920];
const REF_CELL = [380, 740];
const MODES = ["A", "B", "S"];
const FIT_TOL = 1, CTRL_TOL = 0.5, EQ_TOL = 0.5;

// The cost of the second Practice heading ("Chord progression"), a judge PARAMETER
// rather than a constant of the rules: 24 only while the base lacks
// #panel-prog-heading and the candidate has it, 0 otherwise. Rules 1 and 2 (the
// position half) tolerate that much growth; rule 3 never does. modeA and modeB sit
// above the second heading, so they are exempt from rule 2's allowance.
const HEADING_ALLOWANCE_PX = 24;
const ALLOWANCE_EXEMPT = ["modeA", "modeB"];
function headingAllowance(baseHas, candHas) {
  return !baseHas && candHas ? HEADING_ALLOWANCE_PX : 0;
}

const REAL_FACES = [["Marcellus", "400"], ["Bitter", "400"], ["Bitter", "700"],
  ["Nunito Sans", "400"], ["Nunito Sans", "600"]];

/* ------------------------------------------------------------------ the judge */

class PanelFitError extends Error {}

const offender = (cellId, msg) => ({ cell: cellId || "", msg });

function present(c, key) {
  const v = c.controls[key];
  return !!v && v.exists !== false;
}

// One cell, both roots. Pure: the synthetic-cell tests in tests/app.test.js drive
// exactly this function.
function judgeCell({ base: b, cand: c, refRendered, od8FailBaseOverflow = OD8_FAIL_BASE_OVERFLOW, id = "", allowance = 0 }) {
  const out = { removed: [] };
  for (const r of ["rule1", "rule2", "rule3", "rule4", "rule5", "rule6"]) out[r] = { fail: [], reported: [] };
  const avail = c.avail;
  const baseFits = b.needed <= b.avail + FIT_TOL;

  // 1 fit
  if (c.needed > Math.max(b.needed + allowance, avail) + FIT_TOL) {
    out.rule1.fail.push(offender(id, `${c.needed.toFixed(1)} / ${b.needed.toFixed(1)} / ${avail.toFixed(1)}`));
  }

  for (const key of Object.keys(c.controls)) {
    if (!present(c, key)) continue;
    const cc = c.controls[key];
    if (present(b, key)) {
      // 2 control (a control the base renders)
      const bc = b.controls[key];
      if (!bc.rendered) continue;
      if (!cc.rendered) {
        out.rule2.fail.push(offender(id, `${key} unrendered (base bottom ${bc.bottom.toFixed(1)})`));
      } else if (cc.bottom > Math.max(bc.bottom + (ALLOWANCE_EXEMPT.includes(key) ? 0 : allowance), avail) + CTRL_TOL) {
        const o = offender(id, `${key} bottom ${cc.bottom.toFixed(1)} vs base ${bc.bottom.toFixed(1)} / avail ${avail.toFixed(1)}`);
        if (baseFits || od8FailBaseOverflow) out.rule2.fail.push(o);
        else out.rule2.reported.push(o);
      }
    } else if (cc.rendered && cc.bottom > avail + CTRL_TOL) {
      // 3 new control
      const o = offender(id, `${key} bottom ${cc.bottom.toFixed(1)} vs avail ${avail.toFixed(1)}`);
      (baseFits ? out.rule3.fail : out.rule3.reported).push(o);
    }
  }

  // 2 control, the other direction: rendered on the base, absent from the candidate
  for (const key of Object.keys(b.controls)) {
    if (!present(b, key) || !b.controls[key].rendered || present(c, key)) continue;
    if (REMOVED_BY_DESIGN.includes(key)) { out.removed.push(key); continue; }
    out.rule2.fail.push(offender(id, `${key} is rendered on the base and absent from the candidate`));
  }

  // 4 horizontal
  for (const k of ["panel", "doc"]) {
    if (c.overflowX[k] > b.overflowX[k]) {
      out.rule4.fail.push(offender(id, `${k} ${c.overflowX[k]} vs base ${b.overflowX[k]}`));
    }
  }

  // 5 R-1: rendered set equals the reference cell's for this mode
  const renderedC = Object.keys(c.controls).filter((k) => present(c, k) && c.controls[k].rendered).sort();
  const want = [...refRendered].sort();
  if (renderedC.join("|") !== want.join("|")) {
    const miss = want.filter((k) => !renderedC.includes(k));
    const extra = renderedC.filter((k) => !want.includes(k));
    out.rule5.fail.push(offender(id, `missing [${miss}] extra [${extra}]`));
  }

  // 6 R-2: the stop list, candidate only
  const listed = new Set(c.stops.map((s) => s.key));
  for (const s of c.stops) {
    if (s.disabled) out.rule6.fail.push(offender(id, `${s.key} is a stop but disabled`));
    else if (!s.rendered) out.rule6.fail.push(offender(id, `${s.key} is a stop but has no client rects`));
  }
  const owed = Object.keys(c.controls).filter((k) => present(c, k) && c.controls[k].rendered && !c.controls[k].disabled);
  if (c.modal) owed.push("settings-trigger");
  for (const k of owed) if (!listed.has(k)) out.rule6.fail.push(offender(id, `${k} is rendered and enabled but not a stop`));

  return out;
}

// The lowest height in a band [lo, hi] at which the base fits, as a synthetic cell:
// avail rises 1:1 with the viewport height inside a band, so both records are the
// measured ones with avail raised by d. Null when the base fits at lo already or
// fits nowhere in the band.
function thresholdCell(b, c, lo, hi) {
  const d = Math.ceil(b.needed - FIT_TOL - b.avail);
  if (d <= 0 || lo + d > hi) return null;
  return { base: { ...b, avail: b.avail + d }, cand: { ...c, avail: c.avail + d }, height: lo + d };
}

// Viewports (integer heights in the band) where the base fits and the candidate
// does not, and the largest candidate shortfall, taken at the threshold height.
function overflowViewports(b, c, lo, hi) {
  let count = 0, height = null, scroll = 0;
  for (let h = lo; h <= hi; h++) {
    const a = b.avail + (h - lo);
    if (b.needed <= a + FIT_TOL && c.needed > a + FIT_TOL) {
      count++;
      if (height === null) { height = h; scroll = c.needed - a; }
    }
  }
  return { count, height, scroll };
}

function gutterMessage(w, h, mode, px) {
  return `scrollbar takes layout space at ${w}x${h} mode ${mode} (${px} px): the measurement environment is not neutral`;
}

// Classic scrollbars take layout width on Linux CI and on a Mac with a mouse; the
// measurement must not depend on them (F-18).
async function neutraliseScrollbars(b) {
  await b.send("Emulation.setScrollbarsHidden", { hidden: true });
}

async function prepareBrowser(b, url) {
  await neutraliseScrollbars(b);
  await b.setViewport(1000, 800, false);
  await b.goto(url);
  await b.eval(`window.__pf = ${MEASURE_SRC}; return true;`);
}

function vectorsEqual(a, b) {
  if (Math.abs(a.needed - b.needed) > EQ_TOL) return false;
  if (a.overflowX.panel !== b.overflowX.panel || a.overflowX.doc !== b.overflowX.doc) return false;
  if ([...a.rendered].sort().join("|") !== [...b.rendered].sort().join("|")) return false;
  for (const k of a.rendered) {
    if (Math.abs(a.bottoms[k] - b.bottoms[k]) > EQ_TOL) return false;
  }
  return true;
}

function vectorOf(cell) {
  const rendered = Object.keys(cell.controls).filter((k) => present(cell, k) && cell.controls[k].rendered);
  const bottoms = {};
  for (const k of rendered) bottoms[k] = cell.controls[k].bottom;
  return { needed: cell.needed, overflowX: cell.overflowX, rendered, bottoms };
}

function assertRunComplete({ skipped, skipReasons }) {
  if (skipped) throw new PanelFitError(`${skipped} cells skipped: ${(skipReasons || []).join("; ")}`);
}

/* -------------------------------------------------------------- font modes */

function checkFontMode(mode, fonts) {
  if (mode === "fallback") {
    if (fonts.size !== 0) {
      throw new PanelFitError(`font mode fallback requested but document.fonts.size is ${fonts.size}, not 0`);
    }
    return;
  }
  if (mode !== "real") throw new PanelFitError(`unknown font mode ${JSON.stringify(mode)}`);
  if (fonts.size !== REAL_FACES.length) {
    throw new PanelFitError(`font mode real requested but document.fonts.size is ${fonts.size}, not ${REAL_FACES.length}`);
  }
  const bad = fonts.faces.filter((f) => f.status !== "loaded");
  if (bad.length) {
    throw new PanelFitError(`font mode real: faces not loaded: ${bad.map((f) => `${f.family} ${f.weight} ${f.status}`).join(", ")}`);
  }
  const got = fonts.faces.map((f) => `${String(f.family).replace(/["']/g, "")} ${f.weight}`).sort();
  const want = REAL_FACES.map(([f, w]) => `${f} ${w}`).sort();
  if (got.join("|") !== want.join("|")) {
    throw new PanelFitError(`font mode real: faces are [${got}] but tools/fonts holds [${want}]`);
  }
}

/* ----------------------------------------------------------- condition grammar */

const TERM = /^\(\s*(min|max)-(width|height)\s*:\s*(\d+)px\s*\)$/;

// A whitelist. Anything not accepted here that touches a dimension throws.
function parseCondition(text) {
  const t = String(text).trim();
  if (t === "print") return { print: true, text: t };
  const unsupported = (why) => new PanelFitError(`unsupported media condition (${why}): ${t}`);
  const mentionsDim = /width|height|aspect-ratio|orientation|resolution|\bdevice-/i.test(t);
  if (!mentionsDim) {
    if (/\b(min|max)-/.test(t) || /[<>=]/.test(t)) throw unsupported("cannot parse");
    return { other: true, text: t };
  }
  if (/\b(or|not|only)\b/i.test(t)) throw unsupported("or/not/only not in the grammar");
  const queries = [];
  for (const q of t.split(",")) {
    const parts = q.trim().replace(/^screen\s+and\s+/i, "").split(/\s+and\s+/i);
    const terms = [];
    for (const p of parts) {
      const m = TERM.exec(p.trim());
      if (!m) throw unsupported(`term ${JSON.stringify(p.trim())} is outside the grammar`);
      terms.push({ axis: m[2], min: m[1] === "min", px: Number(m[3]) });
    }
    queries.push(terms);
  }
  return { queries, text: t };
}

// Typed edges: min-X: N changes truth between N-1 and N (a band starts at N),
// max-X: N between N and N+1 (a band starts at N+1).
function edgeStarts(parsed) {
  const out = { width: new Set(), height: new Set() };
  for (const p of parsed) {
    for (const q of p.queries || []) {
      for (const t of q) out[t.axis].add(t.min ? t.px : t.px + 1);
    }
  }
  return { width: [...out.width].sort((a, b) => a - b), height: [...out.height].sort((a, b) => a - b) };
}

// The raw N of each term, the numbers the stylesheet writes.
function rawEdges(parsed) {
  const out = { width: new Set(), height: new Set() };
  for (const p of parsed) for (const q of p.queries || []) for (const t of q) out[t.axis].add(t.px);
  return { width: [...out.width].sort((a, b) => a - b), height: [...out.height].sort((a, b) => a - b) };
}

function bands(starts, lo, hi) {
  const cuts = [...new Set(starts)].filter((s) => s > lo && s <= hi).sort((a, b) => a - b);
  const out = [];
  let from = lo;
  for (const s of cuts) { out.push([from, s - 1]); from = s; }
  out.push([from, hi]);
  return out;
}

/* ------------------------------------------------------------- the CSSOM walk */

function sheetDisposition(sheet, pageUrl) {
  try {
    sheet.rules();
    return "read";
  } catch (e) {
    const crossOrigin = sheet.href && new URL(sheet.href, pageUrl).origin !== new URL(pageUrl).origin;
    if (crossOrigin && e && e.name === "SecurityError") return "skip";
    throw new PanelFitError(`cannot read ${sheet.href || "an inline sheet"}: ${e && e.name === "SecurityError" ? "SecurityError" : e}`);
  }
}

function checkRuleKind(kind, containsKept) {
  if (!containsKept) return;
  if (kind === "CSSContainerRule") throw new PanelFitError("@container contains a panel rule; the oracle has no model for it");
  if (kind === "CSSSupportsRule") throw new PanelFitError("@supports contains a panel rule; the oracle has no model for it");
}

// Runs in the page. Returns the dimensional/print/other condition texts of every
// grouping rule that contains a rule matching the panel, one of its descendants
// or one of its ancestors, in the CURRENT mode and panel state.
const WALK_FN = `
(pageUrl) => {
  const panel = document.getElementById("settings-panel");
  const targets = [panel, ...panel.querySelectorAll("*")];
  for (let a = panel.parentElement; a; a = a.parentElement) targets.push(a);
  const splitSel = (s) => {
    const out = []; let d = 0, cur = "";
    for (const ch of s) {
      if (ch === "(" || ch === "[") d++;
      if (ch === ")" || ch === "]") d--;
      if (ch === "," && d === 0) { out.push(cur); cur = ""; } else cur += ch;
    }
    out.push(cur); return out;
  };
  const stripPseudo = (s) => s.replace(/::?(before|after|first-line|first-letter|marker|placeholder|selection|-webkit-[a-z-]+)(\\([^)]*\\))?/g, "");
  const matchesPanel = (selText) => {
    for (const raw of splitSel(selText)) {
      const s = stripPseudo(raw.trim()) || "*";
      for (const el of targets) { try { if (el.matches(s)) return true; } catch (e) { return true; } }
    }
    return false;
  };
  const conditions = []; const problems = []; const skippedSheets = [];
  const walk = (rules, stack) => {
    let kept = false;
    for (const r of rules) {
      const kind = r.constructor.name;
      if (kind === "CSSStyleRule") {
        let k = matchesPanel(r.selectorText);
        if (r.cssRules && r.cssRules.length && walk(r.cssRules, stack)) k = true;
        if (k) kept = true;
      } else if (r.cssRules && kind !== "CSSKeyframesRule") {
        const inner = walk(r.cssRules, stack.concat([[kind, r.conditionText || ""]]));
        if (inner) {
          kept = true;
          if (kind === "CSSContainerRule" || kind === "CSSSupportsRule") problems.push(kind);
          if (kind === "CSSMediaRule") conditions.push(r.conditionText);
        }
      }
    }
    return kept;
  };
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; }
    catch (e) {
      skippedSheets.push({ href: sheet.href, name: e && e.name });
      continue;
    }
    walk(rules, []);
  }
  return { conditions: [...new Set(conditions)], problems, skippedSheets };
}`;

/* --------------------------------------------------------- the page-side measurer */

const MEASURE_SRC = `
(() => {
  const panel = document.getElementById("settings-panel");
  const trigger = document.getElementById("settings-trigger");
  const SEL = "button, a[href], select, input, textarea, [tabindex]";
  const keyOf = (el) => {
    if (el === trigger) return "settings-trigger";
    if (el.id) return el.id;
    const t = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\\s+/g, " ");
    return el.tagName.toLowerCase() + ":" + t;
  };
  const rendered = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility === "visible";
  const ensureOpen = () => { if (!desktopMQ.matches && !panelOpen) openPanel(); };
  const one = (m) => {
    setMode(m);
    ensureOpen();
    panel.scrollTop = 0;
    const modal = !desktopMQ.matches;
    const top = panel.getBoundingClientRect().top;
    let maxBottom = 0;
    for (const el of panel.querySelectorAll("*")) {
      if (el.getClientRects().length === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.bottom - top > maxBottom) maxBottom = r.bottom - top;
    }
    const cs = getComputedStyle(panel);
    const needed = maxBottom + parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
    const controls = {};
    for (const el of panel.querySelectorAll(SEL)) {
      const k = keyOf(el);
      if (controls[k]) throw new Error("two panel controls share the key " + k);
      const r = el.getBoundingClientRect();
      controls[k] = { exists: true, rendered: rendered(el), disabled: !!el.disabled, bottom: r.bottom - top };
    }
    const stops = panelStops().map((el) => ({ key: keyOf(el), disabled: !!el.disabled, rendered: el.getClientRects().length > 0 }));
    const de = document.documentElement;
    return {
      needed, avail: panel.clientHeight, modal, controls, stops,
      gutter: panel.offsetWidth - panel.clientWidth - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth),
      overflowX: { panel: panel.scrollWidth - panel.clientWidth, doc: de.scrollWidth - de.clientWidth },
    };
  };
  return {
    cell: (modes) => modes.map(one),
    setMode, one,
    walk: ${WALK_FN},
    sidebar: () => desktopMQ.matches,
    fonts: async () => {
      await document.fonts.ready;
      const specs = ["14px Marcellus", "400 14px Bitter", "700 14px Bitter", "400 14px 'Nunito Sans'", "600 14px 'Nunito Sans'"];
      await Promise.all(specs.map((s) => document.fonts.load(s)));
      return { size: document.fonts.size, faces: [...document.fonts].map((f) => ({ family: f.family, weight: f.weight, status: f.status })) };
    },
    hasProgHeading: () => !!document.getElementById("panel-prog-heading"),
    spare: (m) => {
      setMode(m);
      ensureOpen();
      const heads = [...panel.querySelectorAll(".panel-heading")].filter((h) => h.getClientRects().length);
      const sp1 = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sp-1")) || null;
      const tiers = {};
      for (const id of ["tier-basic", "tier-intermediate", "tier-advanced"]) {
        const el = document.getElementById(id);
        if (!el || !el.getClientRects().length) { tiers[id] = null; continue; }
        const cs = getComputedStyle(el);
        const rg = document.createRange();
        rg.selectNodeContents(el);
        tiers[id] = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - rg.getBoundingClientRect().width;
      }
      const ph = document.getElementById("panel-prog-heading");
      return {
        headings: heads.map((h) => ({ text: h.textContent.trim(), height: h.getBoundingClientRect().height })),
        gap: ph && ph.getClientRects().length ? parseFloat(getComputedStyle(ph).marginTop) : null,
        sp1, tiers,
      };
    },
    labelWidths: (labels) => {
      const ref = getComputedStyle(document.getElementById("modeA"));
      const out = {};
      for (const text of labels) {
        const s = document.createElement("span");
        s.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
        s.style.fontFamily = ref.fontFamily; s.style.fontSize = ref.fontSize; s.style.fontWeight = ref.fontWeight;
        s.style.letterSpacing = ref.letterSpacing; s.style.textTransform = ref.textTransform;
        s.textContent = text; panel.appendChild(s);
        out[text] = s.getBoundingClientRect().width; s.remove();
      }
      return out;
    },
  };
})()`;

/* ------------------------------------------------------------------- the runner */

function sh(args) {
  return execFileSync("git", args, { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 28 });
}

function readRoot(ref, which) {
  if (!ref) return fs.readFileSync(path.join(REPO, "index.html"), "utf8");
  try { return sh(["show", `${ref}:index.html`]); }
  catch (e) { throw new PanelFitError(`cannot read the ${which} (${ref}:index.html): ${e.message.split("\n")[0]}`); }
}

function serve(html) {
  return new Promise((resolve, reject) => {
    const s = http.createServer((req, res) => {
      const p = (req.url || "/").split("?")[0];
      if (p === "/" || p === "/index.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(html);
      } else { res.writeHead(404).end(); }
    });
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => resolve(s));
  });
}

class Root {
  constructor(name, html, fontMode, workers) {
    Object.assign(this, { name, html, fontMode, workers, browsers: [], url: "", server: null });
  }
  async start() {
    const { launch } = require("../../tests/helpers/cdp.js");
    this.server = await serve(this.html);
    this.url = `http://127.0.0.1:${this.server.address().port}/index.html`;
    for (let i = 0; i < this.workers; i++) {
      const b = await launch({ realFonts: this.fontMode === "real" });
      if (!b) throw new PanelFitError("no browser found (set CHROME_BIN)");
      await prepareBrowser(b, this.url);
      this.browsers.push(b);
    }
    const fonts = await this.browsers[0].eval(`return window.__pf.fonts();`);
    checkFontMode(this.fontMode, fonts);
  }
  async close() {
    for (const b of this.browsers) { try { await b.close(); } catch {} }
    if (this.server) this.server.close();
  }
  // cells: [[w, h], ...] -> [[cellA, cellB, cellS], ...] in order
  async measure(cells, modes = MODES) {
    const out = new Array(cells.length);
    const n = this.browsers.length;
    await Promise.all(this.browsers.map(async (b, wi) => {
      let lastW = -1, lastH = -1;
      for (let i = wi; i < cells.length; i += n) {
        const [w, h] = cells[i];
        if (w !== lastW || h !== lastH) { await b.setViewport(w, h, false); lastW = w; lastH = h; }
        out[i] = await b.eval(`return window.__pf.cell(${JSON.stringify(modes)});`);
      }
    }));
    return out;
  }
  async walk() {
    const b = this.browsers[0];
    await b.setViewport(1000, 800, false);
    const all = new Set(); const sk = new Set();
    for (const m of MODES) {
      const r = await b.eval(`const pf = window.__pf; pf.one(${JSON.stringify(m)}); return pf.walk(${JSON.stringify(this.url)});`);
      for (const c of r.conditions) all.add(c);
      for (const p of r.problems) throw new PanelFitError(`${p} contains a panel rule in ${this.name}; the oracle has no model for it`);
      for (const s of r.skippedSheets) {
        if (s.name === "SecurityError" && s.href && new URL(s.href).origin !== new URL(this.url).origin) sk.add(s.href);
        else throw new PanelFitError(`cannot read ${s.href || "an inline sheet"} in ${this.name}: ${s.name}`);
      }
    }
    return { conditions: [...all].sort(), skippedSheets: [...sk] };
  }
}

function cellId(w, h, mode) { return `${w}x${h} ${mode}`; }

async function runFont({ baseHtml, candHtml, baseLabel, candLabel, fontMode, workers, log, widthRange }) {
  const t0 = Date.now();
  const base = new Root("base", baseHtml, fontMode, workers);
  const cand = new Root("candidate", candHtml, fontMode, workers);
  const report = { font: fontMode, skipped: 0, skipReasons: [], cells: 0, invariance: 0, rules: {}, removed: {}, edges: {} };
  const ruleNames = ["rule1", "rule2", "rule3", "rule4", "rule5", "rule6"];
  for (const r of ruleNames) report.rules[r] = { fail: 0, reported: 0, first: [], firstReported: [] };
  const extra = { rule6Sidebar: 0, rule5Short: 0, rule6Short: 0, rule12Cells: [] };
  report.gutterCells = 0; report.gutterFirst = [];
  report.threshold = { cells: 0, viewports: 0, maxScroll: 0, maxScrollAt: null };
  try {
    await Promise.all([base.start(), cand.start()]);

    // Edges: the walk over both roots.
    const [wb, wc] = await Promise.all([base.walk(), cand.walk()]);
    const parse = (list) => list.map(parseCondition);
    const pb = parse(wb.conditions), pc = parse(wc.conditions);
    const dim = (p) => p.filter((x) => x.queries);
    const printed = [...new Set([...pb, ...pc].filter((x) => x.print).map((x) => x.text))];
    const others = [...new Set([...pb, ...pc].filter((x) => x.other).map((x) => x.text))];
    const startsAll = edgeStarts([...dim(pb), ...dim(pc)]);
    report.edges = {
      baseConditions: dim(pb).map((x) => x.text), candConditions: dim(pc).map((x) => x.text),
      raw: rawEdges([...dim(pb), ...dim(pc)]), starts: startsAll, print: printed, other: others,
      crossOriginSheetsSkipped: [...new Set([...wb.skippedSheets, ...wc.skippedSheets])],
    };
    const hBands = bands(startsAll.height, H_LO, H_HI);
    const [baseHas, candHas] = await Promise.all([base, cand].map((r) => r.browsers[0].eval(`return window.__pf.hasProgHeading();`)));
    const allowance = headingAllowance(baseHas, candHas);
    report.allowance = allowance; report.allowanceWhy = allowance ? "base has no #panel-prog-heading, candidate has" : "";
    const countGutter = (rec, w, h, m) => {
      if (rec.gutter > 0.5) { report.gutterCells++; if (report.gutterFirst.length < 5) report.gutterFirst.push(gutterMessage(w, h, m, rec.gutter)); }
    };
    const wLo = widthRange ? widthRange[0] : W_LO, wHi = widthRange ? widthRange[1] : W_HI;

    // Labels (ER-10) and the reference cell.
    await cand.browsers[0].setViewport(320, 568, false);
    report.labelWidths = await cand.browsers[0].eval(`
      return window.__pf.labelWidths(["MEDIUM", "HARD", "EASY", "NAME \u2192 NOTES"]);`);
    report.spare = [];
    for (const [w, h] of [[320, 568], [427, 320], [1024, 700]]) {
      await cand.browsers[0].setViewport(w, h, false);
      report.spare.push({ w, h, ...(await cand.browsers[0].eval(`return window.__pf.spare("A");`)) });
    }
    const [refCell] = await cand.measure([REF_CELL]);
    const refRendered = refCell.map((c) => Object.keys(c.controls).filter((k) => c.controls[k].rendered));

    // Which bands put the sidebar in play (the app's own desktopMQ decides).
    const rows = [];
    for (const [lo, hi] of hBands) {
      await cand.browsers[0].setViewport(1024, lo, false);
      const side = await cand.browsers[0].eval(`return window.__pf.sidebar();`);
      const ws = [];
      for (let x = wLo; x <= wHi; x++) if (!(side && x >= 1024)) ws.push(x);
      if (side) for (const x of SIDEBAR_WIDTHS) ws.push(x);
      rows.push({ lo, hi, side, ws });
    }
    const cellList = [];
    for (const r of rows) for (const w of r.ws) cellList.push([w, r.lo]);
    log(`[${fontMode}] ${cellList.length} (width, height) rows x ${MODES.length} modes`);

    const [mb, mc] = await Promise.all([base.measure(cellList), cand.measure(cellList)]);
    const vecB = new Map(), vecC = new Map();
    cellList.forEach(([w, h], i) => {
      MODES.forEach((m, mi) => {
        report.cells++;
        const id = cellId(w, h, m);
        vecB.set(id, vectorOf(mb[i][mi])); vecC.set(id, vectorOf(mc[i][mi]));
        countGutter(mb[i][mi], w, h, m); countGutter(mc[i][mi], w, h, m);
        const j = judgeCell({ base: mb[i][mi], cand: mc[i][mi], refRendered: refRendered[mi], id, allowance });
        for (const k of j.removed) report.removed[k] = (report.removed[k] || 0) + 1;
        for (const rn of ruleNames) {
          const R = report.rules[rn];
          R.fail += j[rn].fail.length; R.reported += j[rn].reported.length;
          for (const o of j[rn].fail) if (R.first.length < 10) R.first.push(`${o.cell}: ${o.msg}`);
          for (const o of j[rn].reported) if (R.firstReported.length < 10) R.firstReported.push(`${o.cell}: ${o.msg}`);
        }
        if (j.rule6.fail.length && !mc[i][mi].modal) extra.rule6Sidebar++;
        if (h <= 356 && m === "S") {
          if (j.rule5.fail.length) extra.rule5Short++;
          if (j.rule6.fail.length) extra.rule6Short++;
        }
        if (j.rule1.fail.length || j.rule2.fail.length) extra.rule12Cells.push([w, h, m]);

        const row = rows.find((r) => r.lo === h);
        const t = thresholdCell(mb[i][mi], mc[i][mi], row.lo, row.hi);
        if (t) {
          report.threshold.cells++;
          const jt = judgeCell({ base: t.base, cand: t.cand, refRendered: refRendered[mi], id: `${w}x${t.height} ${m} (threshold)`, allowance });
          for (const rn of ["rule1", "rule2", "rule3"]) {
            const R = report.rules[rn];
            R.fail += jt[rn].fail.length; R.reported += jt[rn].reported.length;
            for (const o of jt[rn].fail) if (R.first.length < 10) R.first.push(`${o.cell}: ${o.msg}`);
          }
        }
        const ov = overflowViewports(mb[i][mi], mc[i][mi], row.lo, row.hi);
        report.threshold.viewports += ov.count;
        if (ov.scroll > report.threshold.maxScroll) { report.threshold.maxScroll = ov.scroll; report.threshold.maxScrollAt = `${w}x${ov.height} mode ${m}`; }
      });
    });

    // ER-8: the invariance check, on the whole vector, in both roots.
    const failures = [];
    const startsW = startsAll.width;
    for (const r of rows) {
      if (r.lo === r.hi) continue;
      const set = new Set();
      const ws = r.ws.filter((w) => !(r.side && w >= 1024));
      for (const w of ws) if (w % 16 === 0) set.add(w);
      for (const s of startsW) for (const d of [-1, 0, 1]) if (s + d >= wLo && s + d <= wHi) set.add(s + d);
      const modeVec = (map, w, mi) => map.get(cellId(w, r.lo, MODES[mi]));
      for (let k = 1; k < ws.length; k++) {
        const w = ws[k], p = ws[k - 1];
        for (let mi = 0; mi < MODES.length; mi++) {
          const differs = !vectorsEqual(modeVec(vecB, w, mi), modeVec(vecB, p, mi)) || !vectorsEqual(modeVec(vecC, w, mi), modeVec(vecC, p, mi));
          if (differs) { set.add(w); set.add(p); }
        }
      }
      if (r.side) for (const w of SIDEBAR_WIDTHS) set.add(w);
      const mid = Math.floor((r.lo + r.hi) / 2);
      const tops = [...new Set([mid, r.hi])].filter((h) => h !== r.lo);
      const pts = [];
      for (const w of [...set].sort((a, b) => a - b)) for (const h of tops) pts.push([w, h]);
      const [ib, ic] = await Promise.all([base.measure(pts), cand.measure(pts)]);
      pts.forEach(([w, h], i) => {
        MODES.forEach((m, mi) => {
          report.invariance++;
          countGutter(ib[i][mi], w, h, m); countGutter(ic[i][mi], w, h, m);
          for (const [name, got, map] of [["base", ib, vecB], ["candidate", ic, vecC]]) {
            if (!vectorsEqual(vectorOf(got[i][mi]), map.get(cellId(w, r.lo, m)))) {
              failures.push(`height-dependent layout inside a band: ${name}, band ${r.lo}-${r.hi}, ${w}x${h} vs ${w}x${r.lo}, mode ${m}`);
            }
          }
        });
      });
      if (r.side) {
        for (let mi = 0; mi < MODES.length; mi++) {
          for (const [name, map] of [["base", vecB], ["candidate", vecC]]) {
            const v0 = modeVec(map, SIDEBAR_WIDTHS[0], mi);
            for (const w of SIDEBAR_WIDTHS) {
              if (!vectorsEqual(modeVec(map, w, mi), v0)) failures.push(`sidebar is not width-independent: ${name}, band ${r.lo}-${r.hi}, width ${w} vs ${SIDEBAR_WIDTHS[0]}, mode ${MODES[mi]}`);
            }
          }
        }
      }
    }
    report.invarianceFailures = failures.slice(0, 20);
    report.invarianceFailureCount = failures.length;
    report.extra = { ...extra, rule12Cells: undefined, rule12Count: extra.rule12Cells.length };
    report.rule12Cells = extra.rule12Cells;
    report.rows = rows.map((r) => ({ lo: r.lo, hi: r.hi, side: r.side, widths: r.ws.length }));
  } finally {
    await Promise.all([base.close(), cand.close()]);
  }
  report.wallSeconds = (Date.now() - t0) / 1000;
  report.baseLabel = baseLabel; report.candLabel = candLabel;
  assertRunComplete(report);
  return report;
}

function printReport(r, out) {
  const p = (s = "") => out(s);
  p(`=== panel fit: font ${r.font}   base ${r.baseLabel}   candidate ${r.candLabel}`);
  p(`cells measured: ${r.cells} (${r.invariance} extra invariance cells)   cells skipped: ${r.skipped}`);
  p(`rows: ${r.rows.map((x) => `h${x.lo}-${x.hi}${x.side ? " (sidebar)" : ""} x${x.widths}`).join(", ")}`);
  p(`edges, raw (width): ${r.edges.raw.width.join(", ") || "-"}   (height): ${r.edges.raw.height.join(", ") || "-"}`);
  p(`edges, typed band starts (width): ${r.edges.starts.width.join(", ") || "-"}   (height): ${r.edges.starts.height.join(", ") || "-"}`);
  p(`candidate dimensional conditions: ${r.edges.candConditions.length}`);
  for (const c of r.edges.candConditions) p(`  ${c}`);
  p(`base dimensional conditions: ${r.edges.baseConditions.length}`);
  for (const c of r.edges.baseConditions) p(`  ${c}`);
  if (r.edges.print.length) p(`print conditions (kept out of the edge list): ${r.edges.print.join(" | ")}`);
  if (r.edges.other.length) p(`non-dimensional conditions (reported, not swept): ${r.edges.other.join(" | ")}`);
  if (r.edges.crossOriginSheetsSkipped.length) p(`cross-origin sheets skipped: ${r.edges.crossOriginSheetsSkipped.join(", ")}`);
  const names = { rule1: "1 fit", rule2: "2 control", rule3: "3 new control", rule4: "4 horizontal", rule5: "5 R-1 rendered set", rule6: "6 R-2 stop list" };
  for (const k of Object.keys(names)) {
    const R = r.rules[k];
    p(`rule ${names[k]}: ${R.fail} failing, ${R.reported} reported-only`);
    for (const f of R.first) p(`    ${f}`);
    for (const f of R.firstReported) p(`    (reported) ${f}`);
  }
  p(`controls removed by design (cells): ${Object.entries(r.removed).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}`);
  p("rule 1/2 failing width ranges per band row and mode:");
  for (const [k, v] of Object.entries(rangesOf(r.rule12Cells))) p(`    h${k}: ${v}`);
  p(`rule 6 failing in sidebar cells (expected on main and 0ea790d): ${r.extra.rule6Sidebar}`);
  p(`mode S at h <= 356: rule 5 failing cells ${r.extra.rule5Short}, rule 6 failing cells ${r.extra.rule6Short}`);
  p(`heading allowance: ${r.allowance}${r.allowanceWhy ? ` (${r.allowanceWhy})` : ""}`);
  p(`HEADING_ALLOWANCE_PX: ${HEADING_ALLOWANCE_PX}`);
  p(`viewports where the candidate overflows and the base fits: ${r.threshold.viewports} (threshold cells judged: ${r.threshold.cells})`);
  p(`largest candidate shortfall at a threshold height: ${r.threshold.maxScroll.toFixed(1)} px${r.threshold.maxScrollAt ? ` at ${r.threshold.maxScrollAt}` : ""}`);
  p(`cells with a scrollbar gutter: ${r.gutterCells}`);
  for (const f of r.gutterFirst) p(`    ${f}`);
  for (const s of r.spare) {
    const tiers = Object.entries(s.tiers).map(([k, v]) => `${k.replace("tier-", "")}=${v === null ? "-" : v.toFixed(2)}`).join(" ");
    p(`at ${s.w}x${s.h}: in-button label spare (px) ${tiers}; headings ${s.headings.map((h) => `${h.text} ${h.height.toFixed(2)}`).join(", ") || "-"}; --sp-1 ${s.sp1}; gap above progression heading ${s.gap}`);
  }
  p(`invariance failures: ${r.invarianceFailureCount}`);
  for (const f of r.invarianceFailures) p(`    ${f}`);
  p(`rendered label widths at 320 wide (px): ${Object.entries(r.labelWidths).map(([k, v]) => `${k}=${v.toFixed(2)}`).join("  ")}`);
  p(`wall time: ${r.wallSeconds.toFixed(0)} s`);
}

function rangesOf(cells) {
  const by = new Map();
  for (const [w, h, m] of cells) {
    const k = `${h} ${m}`;
    if (!by.has(k)) by.set(k, new Set());
    by.get(k).add(w);
  }
  const out = {};
  for (const [k, set] of [...by].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) {
    const ws = [...set].sort((a, b) => a - b);
    const parts = [];
    for (let i = 0; i < ws.length;) {
      let j = i;
      while (j + 1 < ws.length && ws[j + 1] === ws[j] + 1) j++;
      parts.push(i === j ? `${ws[i]}` : `${ws[i]}-${ws[j]}`);
      i = j + 1;
    }
    out[k] = parts.join(", ");
  }
  return out;
}

function failed(r) {
  const ks = ["rule1", "rule3", "rule4", "rule5", "rule6", "rule2"];
  return ks.some((k) => r.rules[k].fail > 0) || r.invarianceFailureCount > 0 || r.gutterCells > 0;
}

function parseArgs(argv) {
  const o = { base: "origin/main", candidate: null, font: "both", workers: 2, widths: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base") o.base = argv[++i];
    else if (a === "--candidate") o.candidate = argv[++i];
    else if (a === "--font") o.font = argv[++i];
    else if (a === "--workers") o.workers = Number(argv[++i]);
    else if (a === "--widths") o.widths = argv[++i].split("-").map(Number);
    else throw new PanelFitError(`unknown argument ${a}`);
  }
  if (!["real", "fallback", "both"].includes(o.font)) throw new PanelFitError(`--font must be real, fallback or both`);
  return o;
}

async function main(argv) {
  const o = parseArgs(argv);
  const out = (s) => process.stdout.write(s + "\n");
  const baseHtml = readRoot(o.base, "base");
  const candHtml = readRoot(o.candidate, "candidate");
  const candLabel = o.candidate || "working tree";
  if (baseHtml === candHtml) {
    out(`index.html identical to ${o.base}: 0 cells measured`);
    return 0;
  }
  let bad = false;
  for (const fontMode of o.font === "both" ? ["real", "fallback"] : [o.font]) {
    const r = await runFont({ baseHtml, candHtml, baseLabel: o.base, candLabel, fontMode, workers: o.workers, log: out, widthRange: o.widths });
    printReport(r, out);
    if (failed(r)) bad = true;
  }
  out(bad ? "panel fit: FAIL" : "panel fit: PASS");
  return bad ? 1 : 0;
}

module.exports = {
  OD8_FAIL_BASE_OVERFLOW, REMOVED_BY_DESIGN, HEADING_ALLOWANCE_PX, ALLOWANCE_EXEMPT, headingAllowance, thresholdCell,
  overflowViewports, gutterMessage, neutraliseScrollbars, prepareBrowser, failed, PanelFitError, judgeCell, vectorsEqual, vectorOf, assertRunComplete,
  checkFontMode, WALK_FN, parseCondition, edgeStarts, rawEdges, bands, sheetDisposition, checkRuleKind,
  MEASURE_SRC, Root, readRoot,
};

if (require.main === module) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => {
    process.stderr.write(`panel fit: ${e && e.stack ? e.stack : e}\n`);
    process.exit(2);
  });
}
