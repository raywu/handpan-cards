// CSS selector liveness probe over the served index.html in many UI states.
// Usage: CHROME_BIN=... node css_probe.js <repo> <out.json>
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");
const REPO = path.resolve(process.argv[2]);
const OUT = process.argv[3];
const { launch, APP_READY_EXPR } = require(path.join(REPO, "tests/helpers/cdp.js"));

const COLLECT = `return (() => {
  const out = [];
  const walk = (rules, media) => {
    for (const r of rules) {
      if (r.type === CSSRule.STYLE_RULE) out.push({ sel: r.selectorText, media, css: r.style.cssText.slice(0, 60) });
      else if (r.cssRules) walk(r.cssRules, (media ? media + " && " : "") + (r.conditionText || r.cssText.split("{")[0].trim()));
    }
  };
  for (const s of document.styleSheets) { try { walk(s.cssRules, ""); } catch (e) {} }
  return JSON.stringify(out);
})()`;

const STRIP = /::?(hover|active|focus-visible|focus-within|focus|before|after|placeholder|selection|-webkit-[a-z-]+|-moz-[a-z-]+)\b(\([^)]*\))?/g;
function splitTop(sel) {
  const parts = []; let depth = 0, cur = "";
  for (const ch of sel) {
    if (ch === "(") depth++; if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function matchExpr(sels) {
  return `return (() => { const r = {}; for (const s of ${JSON.stringify(sels)}) { try { r[s] = document.querySelectorAll(s).length; } catch (e) { r[s] = "ERR " + e.message; } } return JSON.stringify(r); })()`;
}

async function main() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || "/").split("?")[0]).replace(/^\/+/, "");
    const file = path.resolve(REPO, rel || "index.html");
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404).end(); return; }
      res.writeHead(200, { "Content-Type": file.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream" });
      res.end(buf);
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const URL = `http://127.0.0.1:${server.address().port}/index.html`;
  const b = await launch();
  await b.setViewport(380, 780, true);
  await b.goto(URL);
  await b.waitFor(APP_READY_EXPR, { timeout: 15000, label: "boot" });

  const rules = JSON.parse(await b.eval(COLLECT));
  const atoms = new Map(); // stripped selector -> {orig, media, stripped?}
  for (const r of rules) {
    for (const s of splitTop(r.sel)) {
      const stripped = s.replace(STRIP, "").replace(/\s+$/, "");
      const key = stripped || "*";
      if (!atoms.has(key)) atoms.set(key, { orig: new Set(), media: new Set(), pseudo: stripped !== s });
      atoms.get(key).orig.add(s); atoms.get(key).media.add(r.media);
    }
  }
  const sels = [...atoms.keys()];
  const hits = {};
  const states = [];
  const probe = async (name) => {
    await b.settle().catch(() => {});
    const r = JSON.parse(await b.eval(matchExpr(sels)));
    states.push(name);
    for (const [s, n] of Object.entries(r)) { (hits[s] ||= {})[name] = n; }
    process.stderr.write(`probed ${name}\n`);
  };
  const ev = async (code) => { try { return await b.eval(code); } catch (e) { process.stderr.write(`eval failed in state: ${e.message}\n`); } };

  await probe("boot-380");
  await ev("flip()"); await probe("flipped");
  await ev("flip(); setMode('notes')"); await probe("mode-notes");
  await ev("setMode('name')");
  await ev("document.querySelector('#tier-basic').click()"); await probe("seq-basic");
  await ev("document.querySelector('#tier-basic').click()"); // toggle off? probe anyway
  await probe("after-seq-toggle");
  await ev("openPanel()"); await probe("panel-open-380");
  await ev("document.querySelector('#print-paper-select').focus()"); await probe("panel-paper-focus");
  await ev("closePanel()");
  // About
  await ev("openAbout()"); await probe("about-open");
  await ev("closeAbout()");
  // Add sheet
  await ev("openScaleSheet(settingsTrigger)"); await probe("add-scale-tab");
  await ev("const bx=document.querySelector('#scale-box'); bx.value='(D3) A3 ZZ'; bx.dispatchEvent(new Event('input',{bubbles:true}))"); await probe("add-bad-line");
  await ev("const bx=document.querySelector('#scale-box'); bx.value='(D3) A3 Bb3 C4 D4 E4 F4 G4 A4 C5'; bx.dispatchEvent(new Event('input',{bubbles:true}))"); await probe("add-good-line");
  await ev("const f=document.querySelector('#scale-top'); f.focus(); f.value='A3 ZZ'; f.dispatchEvent(new Event('input',{bubbles:true})); f.blur()"); await probe("add-field-error");
  await ev("const f=document.querySelector('#scale-top'); f.focus(); f.value='A3 Bb3 C4 D4 E4 F4 G4 A4 C5'; f.dispatchEvent(new Event('input',{bubbles:true})); f.blur()"); await probe("add-fields-ok");
  await ev("const bx=document.querySelector('#scale-box'); bx.focus(); bx.value='(C3) G3 A3 B3 C4 D4 E4 F4 G4 A4 B4 C5 D5 E5 F5 G5 A5 B5 C6 D6 E6 F6 G6 A6'; bx.dispatchEvent(new Event('input',{bubbles:true}))"); await probe("add-crowded-warning");
  await ev("document.querySelector('#scale-tab-layout').click()"); await probe("add-layout-tab-crowded");
  await ev("document.querySelector('#scale-anchor-one').click()"); await probe("add-layout-noticed");
  await ev("document.querySelector('#scale-drawer').click()"); await probe("add-drawer-open");
  await ev("document.querySelector('#scale-fine-toggle').click()"); await probe("add-drawer-fine");
  await ev("document.querySelector('#scale-note-next').click()"); await probe("add-drawer-note-next");
  await ev("collapseLip()"); await new Promise((r) => setTimeout(r, 400)); await probe("add-layout-lipshut");
  await ev("restoreLip()"); await new Promise((r) => setTimeout(r, 400)); await probe("add-layout-restored");
  await ev("document.querySelector('#scale-tab-scale').click()"); await probe("add-scale-tab-after-layout");
  await ev("collapseLip()"); await new Promise((r) => setTimeout(r, 400)); await probe("add-scale-lipshut");
  await ev("restoreLip()"); await new Promise((r) => setTimeout(r, 400));
  await b.fakeKeyboard(260).catch(() => {}); await ev("document.querySelector('#scale-box').focus()"); await probe("add-keyboard-up");
  await b.clearKeyboard().catch(() => {});
  await ev("closeScaleSheet()"); await new Promise((r) => setTimeout(r, 300));
  // Edit sheet on seeded deck
  await ev("openEditSheet(deck(), settingsTrigger)"); await probe("edit-scale-tab");
  await ev("document.querySelector('#scale-delete').click()"); await probe("edit-delete-armed");
  await ev("document.querySelector('#scale-tab-layout').click()"); await probe("edit-layout-tab");
  await ev("document.querySelector('#scale-swatches button, #scale-swatches [role=radio], #scale-swatches > *').click()"); await probe("edit-swatch");
  await ev("closeScaleSheet()"); await new Promise((r) => setTimeout(r, 300));
  // custom deck shown + share-url reveal
  await ev("openScaleSheet(settingsTrigger)");
  await ev("const bx=document.querySelector('#scale-box'); bx.focus(); bx.value='(E3) B3 C4 E4 F#4 G4 B4 C5 E5'; bx.dispatchEvent(new Event('input',{bubbles:true}))");
  await ev("document.querySelector('#scale-generate').click()"); await new Promise((r) => setTimeout(r, 400)); await probe("custom-deck-shown");
  await ev("const u=document.querySelector('#share-url'); u.hidden=false; u.classList.remove('hidden'); u.style.display=''"); await probe("share-url-revealed-forced");
  await ev("openEditSheet(deck(), settingsTrigger)"); await probe("edit-custom");
  await ev("document.querySelector('#scale-delete').click()"); await probe("edit-custom-delete-armed");
  await ev("closeScaleSheet()"); await new Promise((r) => setTimeout(r, 300));
  // landscape
  await b.setViewport(844, 390, true); await probe("landscape-boot");
  await ev("openPanel()"); await probe("landscape-panel");
  await ev("closePanel(); openScaleSheet(settingsTrigger)"); await probe("landscape-add-scale");
  await ev("document.querySelector('#scale-tab-layout').click()"); await probe("landscape-add-layout");
  await ev("document.querySelector('#scale-drawer').click()"); await probe("landscape-drawer");
  await ev("collapseLip()"); await new Promise((r) => setTimeout(r, 400)); await probe("landscape-lipshut");
  await ev("restoreLip()"); await new Promise((r) => setTimeout(r, 400));
  await ev("closeScaleSheet()"); await new Promise((r) => setTimeout(r, 300));
  // desktop
  await b.setViewport(1280, 800, false); await probe("desktop-boot");
  await ev("openPanel()"); await probe("desktop-panel");
  await ev("openAbout()"); await probe("desktop-about");
  await ev("closeAbout()");
  await ev("openScaleSheet(settingsTrigger)"); await probe("desktop-add");
  await ev("document.querySelector('#scale-tab-layout').click()"); await probe("desktop-add-layout");
  await ev("closeScaleSheet()"); await new Promise((r) => setTimeout(r, 300));
  await b.setViewport(320, 568, true); await probe("narrow-320");
  await ev("openScaleSheet(settingsTrigger)"); await probe("narrow-add");
  await ev("closeScaleSheet()");

  const result = { states, never: [], pseudoOnly: [], errors: [], live: 0 };
  for (const [s, info] of atoms) {
    const h = hits[s] || {};
    const vals = Object.values(h);
    const err = vals.find((v) => typeof v === "string");
    if (err) { result.errors.push({ sel: s, orig: [...info.orig], err }); continue; }
    const max = Math.max(0, ...vals.filter((v) => typeof v === "number"));
    if (max === 0) result.never.push({ sel: s, orig: [...info.orig], media: [...info.media] });
    else { result.live++; if (info.pseudo) result.pseudoOnly.push({ sel: s, orig: [...info.orig], max }); }
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  console.log(`rules ${rules.length} atoms ${atoms.size} live ${result.live} never ${result.never.length} errors ${result.errors.length} states ${states.length}`);
  await b.close();
  server.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
