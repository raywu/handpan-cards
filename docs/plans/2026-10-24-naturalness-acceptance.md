# Reviewed Naturalness acceptance artifact

This preserves the exact temporary script for fresh-session reproducibility.
Extract the JavaScript block verbatim to a disposable directory, verify its
SHA256, and follow the plan below. It requires an inspected clean project
checkout, existing Node/CDP helper, installed Chrome and project fonts. Reserve
the integrator's sole browser lease. This is an acceptance artifact, not an
installed workflow, production helper repair or full-Mac-suite fix.

Script SHA256: `8bb0b39891b07391f6c924e0c551fdf51dcdd0efdbfe769769a4b2c61ab4c3ac`.
Plan SHA256: `91b4652a897419d1e3b75d52697a4bc96e810fef36ec0f2ab882914b8ab8bbca`.
Independent engineering9.5 and UX/spec9.8 source reviews cleared this revision.
The script follows binding sheet-tabs S1: Scale has no preview; positive fields
are checked there and96positive Layout preview/SVG checks are separate. A prior
English-only run exposed the superseded/vacuous DI pan check; no app/tab/CSS
change was made. Its failure and independently verified stale-lease recovery
remain retained. The earlier reviewed source is recoverable from commit16302bfd.
This revised snapshot precedes execution; source review is not runtime acceptance.
Final results and exact refs belong in the workstream receipt.

## Exact script

```javascript
#!/usr/bin/env node
'use strict';
// Temporary acceptance artifact. Review before use; not a shipped harness fix.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const allowed = new Set(['--root', '--expected-ref', '--target', '--out', '--lease-owner', '--timeout-seconds']);
const opt = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i];
  assert(allowed.has(k) && process.argv[i + 1] && !Object.hasOwn(opt, k), 'unknown, duplicate or valueless option');
  opt[k] = process.argv[i + 1];
}
assert(opt['--root'] && opt['--expected-ref'] && opt['--lease-owner'], '--root, --expected-ref and --lease-owner are required');
const ROOT = fs.realpathSync(opt['--root']);
const DIR = fs.realpathSync(__dirname);
const OUT = path.resolve(opt['--out'] || path.join(DIR, 'naturalness-acceptance.json'));
assert(path.dirname(OUT) === DIR && /^naturalness-[A-Za-z0-9._-]+\.json$/.test(path.basename(OUT)), 'report must be a naturalness-*.json beside this script');
assert(!fs.existsSync(OUT), 'report exists; choose a fresh output filename');
const target = opt['--target'] || 'local';
assert(['local', 'dev'].includes(target), '--target must be local or dev');
assert(/^[A-Za-z0-9_./:-]+$/.test(opt['--lease-owner']), 'invalid lease-owner label');
const seconds = Number(opt['--timeout-seconds'] || 840);
assert(Number.isInteger(seconds) && seconds >= 60 && seconds <= 840, 'internal deadline must be60..840s; use a reviewed900s outer supervisor');
const controlled = ['NODE_OPTIONS', 'E2E_PORT', 'HPC_COVERAGE_DIR', 'NODE_V8_COVERAGE', 'NODE_SUITE_TIMEOUT', 'HPFC_CDP_PORT_TIMEOUT_MS'];
for (const k of controlled) assert(!process.env[k], 'unset inherited ' + k);
const git = (...args) => execFileSync('git', ['-C', ROOT, ...args], { timeout: 10000, maxBuffer: 16 * 1024 * 1024 });
const ref = git('rev-parse', '--verify', opt['--expected-ref'] + '^{commit}').toString().trim();
// A merge ref with the same tree is allowed; an uncommitted/other tree is not.
git('diff', '--quiet', ref, '--');
const html = git('show', ref + ':index.html');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const languages = ['en', 'de', 'fr', 'it', 'es', 'ja', 'zh-Hant', 'zh-Hans'];
const tables = Object.fromEntries(languages.map(l => [l, JSON.parse(git('show', ref + ':data/i18n/' + l + '.json'))]));
assert.deepEqual(git('ls-tree', '-r', '--name-only', ref, '--', 'data/i18n').toString().trim().split('\n')
  .filter(f => /^data\/i18n\/[^/]+\.json$/.test(f)).map(f => path.basename(f, '.json')).sort(), [...languages].sort(), 'expected exactly the eight canonical locales');
const helper = require(path.join(ROOT, 'tests/helpers/cdp.js'));
const views = [[380, 780, true], [844, 390, true], [1280, 800, false]];
const VALUES = { 'scale-ding': 'D3', 'scale-top': 'A3 Bb3 C4 D4 E4 F4 G4 A4', 'scale-inner': 'C5 D5', 'scale-bottom': 'C3 Eb3' };
// Literal grammar fixture: no implementation-derived parser oracle.
const LINE = '[C3] (D3) [Eb3] A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5';
const NAME = 'English Input 42';
const leasePath = path.join(DIR, 'naturalness-browser.lease.json');
const lease = JSON.stringify({ owner: opt['--lease-owner'], pid: process.pid, root: ROOT, expectedRef: ref, started: new Date().toISOString(), token: crypto.randomBytes(12).toString('hex') });
const leaseFd = fs.openSync(leasePath, 'wx'); fs.writeFileSync(leaseFd, lease + '\n'); fs.closeSync(leaseFd);
// Cooperative file lock only: integrator serialization remains authoritative.
fs.closeSync(fs.openSync(OUT, 'wx'));
const report = {
  sourceRef: ref, rootHead: git('rev-parse', 'HEAD').toString().trim(), target,
  sourceSHA256: hash(html), scriptSHA256: hash(fs.readFileSync(__filename)),
  started: new Date().toISOString(), expectedCells: 48, expectedKeyboardCases: 16, expectedErrorKeyboardCases: 16, expectedLayoutPreviewChecks: 96,
  languages, views, fonts: ['real', 'fallback'], fixture: { fields: VALUES, line: LINE, name: NAME },
  environment: { node: process.version, platform: process.platform, arch: process.arch, chrome: helper.findBrowser(), controlledOverridesAbsent: controlled },
  lease: { path: leasePath, owner: opt['--lease-owner'], nodePid: process.pid, cooperative: true },
  passed: false, skipped: 0, records: [], identities: [], ownedBrowsers: [], helperLaunchCalls: [], cleanup: [], errors: [],
  limitations: [
    'Targeted48-cell acceptance only; does not establish full Mac-suite repair, full Linux CI, or native-human language quality.',
    'Page.bringToFront is an explicit foreground-interaction precondition; the existing20s CDP request and500ms settle ceiling are unchanged.',
    'Language selection sets the visible select value and dispatches change; no OS-native picker gesture is claimed.',
    'Text replacement uses programmatic selection plus CDP Input.insertText; trusted input dispatch is checked, not native keyboard/IME fidelity.',
    'Keyboard case shadows visualViewport through the existing helper and programmatically focuses fields; it proves wiring/layout, not actual iOS keyboard behavior.',
    'Real fonts are checked-in TTFs served through the existing helper; CJK system fallback is host-specific and live Google Fonts delivery is not tested.',
    '48 journeys use multi-card generation and plural other statuses; single-card plural rendering and every possible refusal/status are not exhaustively exercised.',
    'Generated data is compared to the first English journey for locale invariance; existing engine suites remain the correctness oracle.',
    'Settings full-domain fit is a separate panel_fit job. No fit budget, timeout, application function or engine/data value is overridden.',
    'Only new isolated browser-profile state is cleared; no owner browser profile or unrelated process is accessed.'
  ]
};
let browser = null, server = null, URL_APP = null, context = 'initialization', stopping = false, expectedData = null, launchPromise = null, closePromise = null, finalizationPromise = null, restoreLaunchObservation = null;
const stringify = JSON.stringify;
const write = () => {
  const temp = OUT + '.' + process.pid + '.part';
  fs.writeFileSync(temp, JSON.stringify(report, null, 2) + '\n'); fs.renameSync(temp, OUT);
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
function groupMembers(pgid) {
  assert(Number.isSafeInteger(pgid) && pgid > 0, 'invalid owned PGID');
  // Read metadata only: signal-zero may return EPERM even for an absent group.
  // A failed/truncated/malformed query is uncertainty, never absence evidence.
  const text = execFileSync('ps', ['-axo', 'pid=,ppid=,pgid=,comm='], { encoding: 'utf8', timeout: 1000, maxBuffer: 4 * 1024 * 1024 });
  const rows = text.split('\n').filter(line => line.trim()).map(line => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
    assert(match, 'malformed process metadata');
    return { pid: Number(match[1]), ppid: Number(match[2]), pgid: Number(match[3]), command: match[4] };
  });
  assert(rows.some(row => row.pid === process.pid), 'process metadata omitted current harness');
  return rows.filter(row => row.pgid === pgid);
}
async function closeBrowser() {
  if (closePromise) return closePromise;
  if (!browser) return;
  const b = browser; browser = null;
  closePromise = (async () => {
    const entry = { pid: b.proc.pid, profile: b.profileDir };
    let closeError = null;
    try { await b.close(); } catch (e) { closeError = e.message; }
    const deadline = Date.now() + 3000;
    let members = groupMembers(entry.pid);
    while (Date.now() < deadline && (members.length || fs.existsSync(entry.profile))) { await sleep(50); members = groupMembers(entry.pid); }
    const state = { ...entry, groupAbsent: members.length === 0, observedGroupMembers: members, processQuery: 'ps -axo pid=,ppid=,pgid=,comm= (1s timeout per query)', profileAbsent: !fs.existsSync(entry.profile), closeError };
    report.cleanup.push(state); write();
    assert(state.groupAbsent && state.profileAbsent && !closeError, 'owned browser cleanup incomplete');
  })();
  try { await closePromise; } finally { closePromise = null; }
}
async function closeServer() {
  if (!server) return;
  const s = server; server = null;
  await new Promise((resolve, reject) => {
    s.close(error => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : resolve());
    s.closeAllConnections();
  });
  report.serverClosed = true;
}
function releaseLease() {
  const clean = report.helperLaunchCalls.every(x => x.status === 'succeeded' && !x.internalRetryCleanupUnverified && !x.observationUnverified) &&
    report.cleanup.length === report.ownedBrowsers.length &&
    report.cleanup.every(x => x.groupAbsent && x.profileAbsent && !x.closeError) &&
    (!report.localServerAttempted || report.serverClosed === true);
  report.cleanupVerified = clean;
  if (clean && fs.existsSync(leasePath) && fs.readFileSync(leasePath, 'utf8') === lease + '\n') { fs.unlinkSync(leasePath); report.lease.released = true; }
  else report.lease.released = false;
}
function finalize(reason) {
  if (reason) { report.errors.push({ context, message: reason }); report.passed = false; process.exitCode = 1; }
  if (finalizationPromise) return finalizationPromise;
  stopping = true;
  finalizationPromise = (async () => {
    clearTimeout(timer);
    // An opaque failed/pending helper launch cannot be proven clean from zero
    // returned Browser objects. Wait briefly for ownership, otherwise retain lease.
    if (launchPromise) await Promise.race([launchPromise.catch(() => {}), sleep(3000)]);
    if (restoreLaunchObservation) restoreLaunchObservation();
    try { await closeBrowser(); } catch (e) { report.errors.push({ context: 'cleanup', message: e.message }); }
    try { await closeServer(); } catch (e) { report.errors.push({ context: 'server cleanup', message: e.message }); }
    releaseLease();
    if (report.errors.length || !report.cleanupVerified || !report.lease.released) { report.passed = false; process.exitCode = 1; }
    report.finished = new Date().toISOString(); write();
    process.stdout.write(JSON.stringify({ passed: report.passed, completed: report.records.filter(r => r.passed).length, attempted: report.records.length, expected: report.expectedCells, skipped: report.skipped, errors: report.errors.length, cleanupVerified: report.cleanupVerified, leaseReleased: report.lease.released, report: OUT }) + '\n');
    // Keep our persistent signal listeners installed through all asynchronous
    // teardown; helper handlers may remove themselves and re-raise a signal.
    process.exit(report.passed ? 0 : 1);
  })();
  return finalizationPromise;
}
const timer = setTimeout(() => { void finalize('internal wall deadline'); }, seconds * 1000);
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, () => { void finalize(signal); });
function requireRunning() { assert(!stopping, 'acceptance interrupted during teardown'); }
async function settle() { await browser.send('Page.bringToFront'); await browser.settle(); }
async function reach(selector) {
  await browser.eval(`const e=document.querySelector(${stringify(selector)});if(!e)throw Error('missing control');e.scrollIntoView({block:'center',inline:'nearest'});return true;`);
  await settle();
  const m = await browser.eval(`const e=document.querySelector(${stringify(selector)}),r=e.getBoundingClientRect();return {w:r.width,h:r.height,l:r.left,r:r.right,t:r.top,b:r.bottom,vw:innerWidth,vh:innerHeight,hit:e.contains(document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2))};`);
  assert(m.w > 0 && m.h > 0 && m.l >= -.5 && m.r <= m.vw + .5 && m.t >= -.5 && m.b <= m.vh + .5 && m.hit, 'unreachable control ' + selector + ': ' + stringify(m));
}
async function click(selector) { await reach(selector); await browser.click(selector); await settle(); }
async function replaceText(id, value) {
  await click('#' + id);
  assert.equal(await browser.eval('return document.activeElement.id;'), id, 'field not focused');
  await browser.eval(`document.getElementById(${stringify(id)}).select();return true;`);
  await browser.send('Input.insertText', { text: value }); await settle();
  assert.equal(await browser.eval(`return document.getElementById(${stringify(id)}).value;`), value, 'typed value rewritten');
}
const visiblePanel = `getComputedStyle(document.getElementById('settings-panel')).display !== 'none'`;
async function chooseLanguage(lang) {
  if (!(await browser.eval('return ' + visiblePanel + ';'))) { await click('#settings-trigger'); await browser.waitFor(visiblePanel); }
  await reach('#lang-select');
  await browser.eval(`const e=document.getElementById('lang-select');e.value=${stringify(lang)};e.dispatchEvent(new Event('change',{bubbles:true}));return true;`);
  await browser.waitFor('document.documentElement.lang === ' + stringify(lang), { label: 'resolved locale' });
  const actual = await browser.eval(`return {lang:uiLang(),value:document.getElementById('lang-select').value,stored:JSON.parse(localStorage.getItem('hpfc')).lang,label:document.getElementById('deck-add').textContent.trim()};`);
  assert.equal(actual.lang, lang); assert.equal(actual.value, lang); assert.equal(actual.stored, lang);
  assert.equal(actual.label, tables[lang]['panel.add'].trim());
}
async function navigateFresh(font) {
  if (await browser.eval(`return location.origin===${stringify(new URL(URL_APP).origin)};`)) await browser.eval('localStorage.clear();return true;');
  await browser.send('Page.navigate', { url: 'about:blank' });
  await browser.waitFor(`location.href==='about:blank'`, { label: 'old document discarded' });
  const docs = [], done = new Set();
  browser.on('Network.responseReceived', p => { if (p.type === 'Document' && p.response.url === URL_APP) docs.push(p); });
  browser.on('Network.loadingFinished', p => done.add(p.requestId));
  const nav = await browser.send('Page.navigate', { url: URL_APP }); assert(!nav.errorText && nav.loaderId, 'fresh cross-document navigation missing');
  const end = Date.now() + 15000;
  while (!docs.some(d => d.frameId === nav.frameId && d.loaderId === nav.loaderId && done.has(d.requestId))) { assert(Date.now() < end, 'fresh document response/body unavailable'); await sleep(40); }
  const doc = docs.find(d => d.frameId === nav.frameId && d.loaderId === nav.loaderId);
  const response = await browser.send('Network.getResponseBody', { requestId: doc.requestId });
  const observed = hash(Buffer.from(response.body, response.base64Encoded ? 'base64' : 'utf8'));
  const identity = { context, font, status: doc.response.status, SHA256: observed, fromDiskCache: !!doc.response.fromDiskCache, fromServiceWorker: !!doc.response.fromServiceWorker };
  report.identities.push(identity); write();
  assert.equal(doc.response.status, 200, 'actual browser document HTTP status'); assert(!doc.response.fromServiceWorker, 'unexpected service-worker document');
  assert.equal(observed, report.sourceSHA256, 'browser document differs from exact ref');
  await browser.waitFor(helper.APP_READY_EXPR, { timeout: 15000, label: 'candidate boot after verified document' });
  assert.deepEqual(await browser.eval('return I18N;'), tables, 'embedded tables do not equal canonical ref tables');
  assert.deepEqual(await browser.eval(`return [...document.getElementById('lang-select').options].map(o=>o.value).filter(x=>x!=='auto').sort();`), [...languages].sort());
  await browser.eval(`return Promise.all(["14px Marcellus","400 14px Bitter","700 14px Bitter","400 14px 'Nunito Sans'","600 14px 'Nunito Sans'"].map(s=>document.fonts.load(s))).then(()=>document.fonts.ready).then(()=>true);`);
  const faces = await browser.eval(`return [...document.fonts].map(f=>({family:f.family.replace(/["']/g,''),weight:f.weight,status:f.status}));`);
  identity.faces = faces;
  if (font === 'fallback') assert.equal(faces.length, 0, 'fallback registered a font');
  else { assert.deepEqual(faces.map(f => f.family + ' ' + f.weight).sort(), ['Marcellus 400', 'Bitter 400', 'Bitter 700', 'Nunito Sans 400', 'Nunito Sans 600'].sort()); assert(faces.every(f => f.status === 'loaded')); }
  await settle();
  await browser.eval(`window.__naturalInputs=[];document.addEventListener('input',e=>{if(['scale-name','scale-ding','scale-top','scale-inner','scale-bottom'].includes(e.target.id))window.__naturalInputs.push({id:e.target.id,trusted:e.isTrusted});},true);return true;`);
}
const labelKeys = { 'scale-title': 'sheet.title_add', 'scale-ding-label': 'sheet.ding', 'scale-top-label': 'sheet.top', 'scale-inner-label': 'sheet.inner', 'scale-bottom-label': 'sheet.bottom_opt', 'scale-fields-head': 'sheet.fields_head' };
async function labels(lang) {
  for (const [id, key] of Object.entries(labelKeys)) assert.equal(await browser.eval(`return document.getElementById(${stringify(id)}).textContent.trim();`), tables[lang][key].trim(), 'localized label ' + key);
  assert.equal(await browser.eval('return document.getElementById("scale-next").textContent.trim();'), tables[lang]['sheet.next'].trim());
  const islands = await browser.eval(`return ['scale-ding','scale-top','scale-inner','scale-bottom','scale-box'].map(id=>[id,document.getElementById(id).getAttribute('lang')]);`);
  for (const [id, value] of islands) assert.equal(value, lang === 'en' ? null : 'en', 'English input language island ' + id);
}
async function geometry() {
  const m = await browser.eval(`const s=document.getElementById('scale-sheet'),ids=['scale-title','scale-back','scale-tab-scale','scale-tab-layout','scale-fields-head','scale-ding-label','scale-top-label','scale-inner-label','scale-bottom-label','scale-next','scale-generate','scale-mirror','scale-mirror-bottom','scale-fine-toggle','scale-layout-reset'];return {sheetOverflow:s.scrollWidth-s.clientWidth,documentOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,controls:ids.map(id=>document.getElementById(id)).filter(e=>e.getClientRects().length&&e.getBoundingClientRect().height>0).map(e=>({id:e.id,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,x:e.scrollWidth-e.clientWidth,y:e.scrollHeight-e.clientHeight,ellipsis:getComputedStyle(e).textOverflow==='ellipsis'}))};`);
  assert(m.sheetOverflow <= 0 && m.documentOverflow <= 0, 'sheet/document horizontal overflow');
  for (const e of m.controls) {
    assert(e.x <= 1 && e.y <= 1 && !e.ellipsis, 'local text clipping: ' + stringify(e));
    if (['scale-tab-scale', 'scale-tab-layout', 'scale-next'].includes(e.id)) assert(e.h >= 44, 'tab/NEXT target below existing44px requirement');
  }
  return m;
}
async function errorKeyboard() {
  try {
    await browser.fakeKeyboard(520);
    await browser.eval(`document.getElementById('scale-top').focus();return true;`); await settle();
    await browser.eval(`document.getElementById('scale-inner').focus();return true;`); await settle();
    await browser.eval(`const s=document.querySelector('#scale-sheet .sheetbody');s.scrollTop=s.scrollHeight;return true;`); await settle();
    const m = await browser.eval(`const r=document.getElementById('scale-field-msg').getBoundingClientRect(),v=visualViewport;return {top:r.top,bottom:r.bottom,height:r.height,viewportTop:v.offsetTop,viewportBottom:v.offsetTop+v.height};`);
    assert(m.height > 0 && m.top >= m.viewportTop - .5 && m.bottom <= m.viewportBottom + .5, 'translated error outside simulated keyboard viewport'); return m;
  } finally { await browser.eval('document.activeElement&&document.activeElement.blur();return true;'); await browser.clearKeyboard(); await settle(); }
}
async function keyboard(rows) {
  try {
    for (const id of Object.keys(VALUES)) {
      await browser.clearKeyboard();
      await browser.eval(`document.activeElement&&document.activeElement.blur();document.querySelector('#scale-sheet .sheetbody').scrollTop=0;return true;`);
      await browser.fakeKeyboard(520);
      await browser.eval(`document.getElementById(${stringify(id)}).focus();return true;`); await settle();
      const m = await browser.eval(`const id=${stringify(id)},e=document.getElementById(id),r=e.getBoundingClientRect(),s=document.querySelector('#scale-sheet .sheetbody').getBoundingClientRect(),v=visualViewport;return {activeId:document.activeElement.id,tab:document.getElementById('scale-sheet').dataset.tab,scaleHidden:document.getElementById('scale-panel-scale').hidden,layoutHidden:document.getElementById('scale-panel-layout').hidden,field:{w:r.width,h:r.height,visible:Math.max(0,Math.min(r.bottom,s.bottom,v.offsetTop+v.height)-Math.max(r.top,s.top,v.offsetTop))}};`);
      rows.push({ id, ...m }); write();
      assert.equal(m.activeId, id, 'simulated keyboard field did not receive focus: ' + stringify(m));
      assert.equal(m.tab, 'scale'); assert.equal(m.scaleHidden, false); assert.equal(m.layoutHidden, true);
      assert(m.field.w > 0 && m.field.h > 0, 'keyboard field has no positive area: ' + stringify(m));
      assert(m.field.visible >= m.field.h - .5, 'focused field clipped above simulated keyboard: ' + id);
    }
  } finally { await browser.eval('document.activeElement&&document.activeElement.blur();return true;'); await browser.clearKeyboard(); await settle(); }
  return rows;
}
async function dataSnapshot() {
  const s = await browser.eval(`const d=CUSTOM[deckId];if(!d)throw Error('generated custom scale absent');return {id:deckId,name:d.name,optionName:d.options&&d.options.name,line:HPE.core.formatSeed(d.fields),chords:d.chords.length,data:JSON.stringify({fields:d.fields,chords:d.chords,geom:d.geom,options:d.options})};`);
  assert.equal(s.name, NAME); assert.equal(s.optionName, NAME); assert.equal(s.line, LINE); assert(s.chords > 1, 'multi-card fixture needed');
  s.dataSHA256 = hash(s.data); delete s.data; return s;
}
function interpolate(lang, key, vars) { return tables[lang][key].replace(/\{(\w+)\}/g, (m, k) => Object.hasOwn(vars, k) ? String(vars[k]) : m); }
async function primary(lang, edit, rec) {
  if (await browser.eval('return !document.getElementById("scale-next").hidden;')) {
    await click('#scale-next'); await browser.waitFor(`!document.getElementById('scale-panel-layout').hidden`);
  } else if (await browser.eval('return document.getElementById("scale-panel-layout").hidden;')) await click('#scale-tab-layout');
  const preview = await browser.eval(`const e=document.getElementById('scale-preview'),r=e.getBoundingClientRect(),svg=e.querySelector('svg'),sr=svg&&svg.getBoundingClientRect();return {tab:document.getElementById('scale-sheet').dataset.tab,scaleHidden:document.getElementById('scale-panel-scale').hidden,layoutHidden:document.getElementById('scale-panel-layout').hidden,wrapper:{w:r.width,h:r.height,cssWidth:parseFloat(getComputedStyle(e).width)},svg:sr?{w:sr.width,h:sr.height}:null};`);
  (rec.layoutPreviews ||= []).push({ phase: edit ? 'edit' : 'add', ...preview }); write();
  assert.equal(preview.tab, 'layout'); assert.equal(preview.scaleHidden, true); assert.equal(preview.layoutHidden, false);
  assert(preview.wrapper.w > 0 && preview.wrapper.h > 0 && preview.svg && preview.svg.w > 0 && preview.svg.h > 0, 'Layout wrapper/real SVG has no positive area: ' + stringify(preview));
  assert(preview.wrapper.cssWidth >= 160 && preview.wrapper.cssWidth <= 480, 'Layout preview outside accepted160..480px CSS width clamp: ' + stringify(preview));
  assert.equal(await browser.eval('return document.getElementById("scale-generate").textContent.trim();'), tables[lang][edit ? 'sheet.save' : 'sheet.generate'].trim());
  await geometry(); await click('#scale-generate');
  await browser.waitFor(`document.getElementById('scale-sheet').hidden`, { label: edit ? 'saved sheet closes' : 'generated sheet closes' }); await settle();
}
async function journey(font, lang, w, h) {
  const rec = { key: `${font}/${lang}/${w}x${h}`, font, lang, width: w, height: h, passed: false, started: new Date().toISOString() };
  report.records.push(rec); context = rec.key; write();
  await browser.setViewport(w, h, w < 1000); await navigateFresh(font); await chooseLanguage(lang);
  await click('#deck-add'); await browser.waitFor(`!document.getElementById('scale-sheet').hidden`);
  await labels(lang); rec.addGeometry = await geometry();
  await replaceText('scale-name', NAME); await replaceText('scale-ding', VALUES['scale-ding']);
  await replaceText('scale-top', 'A3 BB');
  // Existing UI deliberately reveals new field errors only after leaving it.
  await click('#scale-inner');
  const expectedError = interpolate(lang, 'sheet.field_msg', { FIELD_SHORT: tables[lang]['sheet.top'], message: interpolate(lang, 'compose.DOUBLE_B', { L: 'B' }) });
  await browser.waitFor(`document.getElementById('scale-field-msg').textContent===${stringify(expectedError)}`, { label: 'localized uppercase-B error' });
  assert.equal(await browser.eval('return document.getElementById("scale-top").getAttribute("aria-invalid");'), 'true');
  assert(await browser.eval('return document.getElementById("scale-generate").disabled;'), 'invalid input enabled generation');
  rec.localizedError = await browser.eval('return document.getElementById("scale-field-msg").textContent;');
  assert.equal(rec.localizedError, expectedError, 'complete localized field sentence');
  if (w === 380) rec.errorKeyboard = await errorKeyboard();
  for (const [id, value] of Object.entries(VALUES)) await replaceText(id, value);
  await browser.waitFor(`document.getElementById('scale-box').value===${stringify(LINE)}&&!document.getElementById('scale-generate').disabled`, { label: 'literal English line composes' });
  assert.equal(await browser.eval('return document.getElementById("scale-top").getAttribute("aria-invalid");'), 'false');
  for (const [id, value] of Object.entries(VALUES)) assert.equal(await browser.eval(`return document.getElementById(${stringify(id)}).value;`), value);
  assert.equal(await browser.eval('return document.getElementById("scale-name").value;'), NAME);
  const inputEvents = await browser.eval('return window.__naturalInputs;');
  for (const id of ['scale-name', ...Object.keys(VALUES)]) assert(inputEvents.some(e => e.id === id && e.trusted), 'missing trusted input event: ' + id);
  if (w === 380) { rec.keyboard = []; await keyboard(rec.keyboard); }
  await primary(lang, false, rec); const made = await dataSnapshot();
  if (expectedData === null) { assert.equal(lang, 'en'); expectedData = made; }
  else assert.deepEqual(made, expectedData, 'language/font/viewport changed generated scale data');
  rec.generated = made;
  const generated = tables[lang]['sheet.generated'].other.replace('{n}', String(made.chords));
  assert((await browser.eval('return document.querySelector(".announce").textContent;')).includes(generated), 'localized generated count/status absent');
  const other = lang === 'en' ? 'de' : 'en'; await chooseLanguage(other); assert.deepEqual(await dataSnapshot(), made, 'switch changed user data'); await chooseLanguage(lang);
  if (await browser.eval("return document.getElementById('settings-trigger').getAttribute('aria-expanded') === 'true';")) await click('#settings-trigger');
  await click('#decks .chip.on'); await browser.waitFor(`!document.getElementById('scale-sheet').hidden`);
  assert.equal(await browser.eval('return document.getElementById("scale-title").textContent.trim();'), tables[lang]['sheet.title_edit'].trim());
  assert.equal(await browser.eval('return document.getElementById("scale-name").value;'), NAME, 'Edit translated user name');
  assert.equal(await browser.eval('return document.getElementById("scale-box").value;'), LINE, 'Edit changed English notation');
  for (const [id, value] of Object.entries(VALUES)) assert.equal(await browser.eval(`return document.getElementById(${stringify(id)}).value;`), value, 'Edit changed field ' + id);
  rec.editGeometry = await geometry();
  if (font === 'real') {
    const file = OUT.replace(/\.json$/, '') + '-' + lang + '-' + w + 'x' + h + '.png';
    const image = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(file, Buffer.from(image.data, 'base64'), { flag: 'wx' }); rec.editScreenshot = file;
  }
  await primary(lang, true, rec); assert.deepEqual(await dataSnapshot(), made, 'unchanged Edit save altered user data');
  assert((await browser.eval('return document.querySelector(".announce").textContent;')).includes(interpolate(lang, 'sheet.updated', { name: NAME })), 'localized update status/name absent');
  helper.assertNoUncaught(); rec.passed = true; rec.finished = new Date().toISOString(); write();
}
// Exact single-chunk notice from the inspected helper's inherited SLOW_START
// retry (20s port bound; an inherited override was already rejected above).
const RETRY_NOTICE = '[cdp] browser did not report a debug port within 20000ms - reaped it and retrying the launch once\n';
function observeLaunchRetry(call) {
  const original = process.stderr.write;
  function observedWrite(...args) {
    // Observation must never interfere with the original stream contract:
    // forward the same receiver, arguments, callback and return/backpressure.
    try {
      const chunk = args[0];
      const text = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) || chunk instanceof Uint8Array ? Buffer.from(chunk).toString('utf8') : null;
      if (text === RETRY_NOTICE) {
        call.internalRetryCleanupUnverified = true;
        call.actualLaunchAttemptsObserved = 2;
        call.retryNotice = RETRY_NOTICE;
      }
    } catch { call.observationUnverified = true; }
    return Reflect.apply(original, this, args);
  }
  process.stderr.write = observedWrite;
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    if (process.stderr.write === observedWrite) process.stderr.write = original;
    else call.observationUnverified = true; // Do not overwrite another owner.
    if (restoreLaunchObservation === restore) restoreLaunchObservation = null;
  };
  restoreLaunchObservation = restore;
  return restore;
}
async function main() {
  assert(helper.findBrowser(), 'missing browser is failure, not skip');
  if (target === 'dev') URL_APP = 'https://handpan-cards-dev.pages.dev/';
  else {
    report.localServerAttempted = true;
    server = http.createServer((req, res) => {
      if (!['/', '/index.html'].includes(new URL(req.url, 'http://127.0.0.1').pathname)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(html);
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    requireRunning();
    URL_APP = 'http://127.0.0.1:' + server.address().port + '/';
  }
  report.url = URL_APP;
  for (const font of ['real', 'fallback']) {
    requireRunning(); context = font + ' launch';
    const attempt = { font, status: 'pending', actualLaunchAttemptsObserved: 1, internalRetryCleanupUnverified: false, observationUnverified: false, started: new Date().toISOString() };
    report.helperLaunchCalls.push(attempt); write();
    launchPromise = (async () => {
      const restore = observeLaunchRetry(attempt);
      try {
        browser = await helper.launch({ realFonts: font === 'real' }); assert(browser, 'browser launch returned null');
        report.ownedBrowsers.push({ font, pid: browser.proc.pid, profile: browser.profileDir });
        attempt.status = 'succeeded'; attempt.finished = new Date().toISOString(); write();
      } catch (e) { attempt.status = 'failed-unverified'; attempt.error = e.message; write(); throw e; }
      finally { restore(); }
    })();
    await launchPromise; launchPromise = null; requireRunning();
    assert(!attempt.internalRetryCleanupUnverified && !attempt.observationUnverified, 'helper internal retry/observation cleanup unverified; retain lease for independent inspection');
    const version = await browser.send('Browser.getVersion', {}, false);
    (report.environment.browserVersions ||= []).push({ font, product: version.product, protocolVersion: version.protocolVersion, jsVersion: version.jsVersion });
    browser.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') report.errors.push({ context, message: 'console.error; arguments not collected' }); });
    await browser.send('Network.enable'); await browser.send('Network.setCacheDisabled', { cacheDisabled: true });
    for (const lang of languages) {
      for (const [w, h] of views) { requireRunning(); await journey(font, lang, w, h); }
      process.stderr.write('Naturalness ' + font + '/' + lang + ':3 cells completed\n');
    }
    await closeBrowser();
  }
  assert.equal(report.records.length, report.expectedCells); assert.equal(new Set(report.records.map(r => r.key)).size, report.expectedCells);
  assert(report.records.every(r => r.passed)); assert.equal(report.identities.length, report.expectedCells);
  assert.equal(report.records.filter(r => r.keyboard).length, report.expectedKeyboardCases);
  assert.equal(report.records.filter(r => r.errorKeyboard).length, report.expectedErrorKeyboardCases);
  assert.equal(report.records.reduce((n, r) => n + (r.layoutPreviews || []).length, 0), report.expectedLayoutPreviewChecks);
  assert.equal(report.errors.length, 0, 'browser console errors'); report.passed = true;
}
main().then(() => finalize(), e => finalize(e.stack || e.message));
```

## Execution and limits

# Naturalness targeted browser acceptance — author draft

Status: revised after the integrator-run local failure described below; this
author has only syntax-checked the revised source. Independent engineering review
and root browser-lease allocation are required before execution. No browser,
test journey, server, network request, repository edit or Git mutation was run
by this author. Prior integrator-run evidence remains intact.

Source: `naturalness-acceptance.cjs` in this directory. This is an external
acceptance artifact, not a production helper repair or a permanent CI test suite.
Read the candidate's shared browser runbook and Naturalness plan first.

## Matrix and objective evidence

| Dimension | Selection | Count |
|---|---|---:|
| Languages | en, de, fr, it, es, ja, zh-Hant, zh-Hans | 8 |
| Font modes | existing helper real TTF interception; fallback | 2 |
| Viewports | 380×780 mobile, 844×390 mobile, 1280×800 desktop | 3 |
| Unique full journeys | all combinations, exact canonical locale resolved | **48** |
| Simulated keyboard cases | each locale/font at380×780 | **16** |
| Focused-field checks in those cases | ding, top, inner, bottom | **64** |
| Translated error above simulated keyboard | each locale/font at380×780 | **16** |
| Exact browser-document identities | one fresh document per journey | **48** |
| Layout preview checks | actual Layout tab, Add and Edit in each journey | **96** |
| Real-font Edit screenshots | every real-font locale/viewport | **24** |

Each journey:

1. Uses a fresh actual document, verifies its HTTP status and SHA256 against the
   selected Git commit, rejects service-worker substitution, verifies all eight
   embedded tables equal canonical committed JSON, and verifies font registry.
2. Selects the language through the visible control (value plus bubbling change
   event), checks `uiLang`, document language, selected value and stored language.
3. Opens Add using actual click dispatch and checks representative native labels
   plus the existing English `lang` islands on all four note inputs and the line.
4. Inserts a literal ASCII user name and Ding through CDP text input, then
   `A3 BB` in TOP. It leaves the field because existing UI deliberately reveals
   new errors only on blur. The expected error comes from committed
   `compose.DOUBLE_B` with `{L}=B`, preserving the German two-occurrence exception.
   It independently wraps that message with canonical `sheet.field_msg` and
   canonical `sheet.top`; the complete field sentence must equal the DOM text
   exactly, including the field prefix and punctuation.
   Invalid TOP must have `aria-invalid=true` and generation must be disabled.
5. At380×780, checks that error is visible above a simulated260px keyboard using
   the existing DI test's rectangle criterion. Keyboard simulation is then reset.
6. Replaces all four fields with the literal valid fixture below, checks raw
   field values remain exact and trusted `input` events occurred, and requires
   the literal composed English line with generation enabled.
7. At380×780, uses existing `fakeKeyboard` and the DI field visibility criterion
   to check all four focused fields. The active element must equal the requested
   field and have positive width/height. The Scale tab must be active, its panel
   visible and Layout panel hidden. Raw metrics are recorded before assertions,
   including on failure. The Scale tab intentionally has no pan (accepted sheet-tabs
   supersession S1); no hidden preview is used to claim keyboard visibility.
   Focus is programmatic for this wiring check, not a physical keyboard claim.
8. Activates NEXT/Generate through real click dispatch. On the actual Layout
   tab, separately requires a positive rendered preview wrapper and real SVG,
   and CSS width within the accepted160..480px clamp, on both Add and Edit
   (**96checks**). This measures the actual Layout state without borrowing the
   superseded small-pan Scale-tab keyboard expectation. It checks the named
   custom scale's canonical line/name and compares fields/chords/geometry/options
   identity to the first English journey. It requires a localized multi-card
   generation status with the actual observed chord count.
9. Switches to another language and back through settings; closes the settings
   modal only when the trigger has `aria-expanded=true` (desktop static sidebar
   visibility is not treated as an open modal). Generated user data
   must be unchanged. Reopens the selected custom chip in Edit, checks the exact
   name, line and four field values, and checks the localized Edit/Save labels.
10. Checks sheet/document horizontal overflow, local control/label clipping and
    the existing44px tab/NEXT target requirement (height >=44 exactly; the
    separate0.5px visibility allowance does not relax this target). It saves the unchanged scale;
    data identity remains the same and localized `sheet.updated` retains the
    typed English name. Real-font Edit screenshots are retained.

Fixture, derived from the project's established bracket/bar grammar and fully
octaved dual-input examples, not a second parser implementation:

```text
Name: English Input 42
Ding: D3
Top: A3 Bb3 C4 D4 E4 F4 G4 A4
Inner: C5 D5
Bottom: C3 Eb3
Line: [C3] (D3) [Eb3] A3 Bb3 C4 D4 E4 F4 G4 A4 | C5 D5
```

## Execution after independent review

Use a clean candidate whose tracked tree matches the expected Git ref. Canonical
tables must already be synced and committed. The script reads expected HTML and
tables from Git; local mode serves those exact committed bytes on an ephemeral
loopback-only server. DEV mode uses **only**
`https://handpan-cards-dev.pages.dev/`, with actual Chrome document-response
identity. No nonbrowser HTTP client preflight, authentication change, custom
user agent, alternate URL or local substitution is used to claim DEV coverage.

The integrator must reserve the sole host-browser lease across all jobs. The
script also creates an exclusive cooperative
`naturalness-browser.lease.json` beside itself. Other harnesses must respect
root scheduling; the file alone cannot enforce host-wide serialization. An
existing lease is never auto-deleted. Use a fresh output filename; existing
reports and screenshots are not overwritten.

In a dedicated job remove `NODE_OPTIONS`, `E2E_PORT`, `HPC_COVERAGE_DIR`,
`NODE_V8_COVERAGE`, `NODE_SUITE_TIMEOUT` and `HPFC_CDP_PORT_TIMEOUT_MS`. Set the
actual Mac `CHROME_BIN` when appropriate. Use the already-reviewed temporary
900s outer supervisor. The script's internal default is840s with cleanup grace;
neither existing20s CDP nor500ms settle deadlines are enlarged.

Example command shape (replace absolute checkout/ref/report values):

```sh
node /private/tmp/handpan-browser-parallel.HskZRy/evidence/naturalness-acceptance.cjs \
  --root /absolute/path/to/clean-candidate \
  --expected-ref FULL_COMMIT_SHA \
  --target local \
  --lease-owner root/naturalness \
  --out /private/tmp/handpan-browser-parallel.HskZRy/evidence/naturalness-local-FULL_COMMIT_SHA.json
```

After final reviewed source delivery, `--target dev` uses the canonical DEV root;
choose a different fresh `naturalness-dev-*.json` output. Do not run local and
DEV matrices concurrently or mistake local success for deployment identity.

The script places the headless target in the foreground before settlement.
This is an explicit active-interaction precondition, informed by the Mac
diagnosis; it does not modify app/helper code or establish full unmodified Mac
suite success. A root-approved browser launch is still required.

## Failure and recovery

Missing browser, incomplete/extra locales, dirty or wrong source tree, stale
deployed document, table mismatch, wrong selection, changed English input/name,
incorrect error/status, clipping, keyboard visibility failure, console error,
uncaught exception, timeout or cleanup residue leaves acceptance failed.
The report records attempted and completed unique cells; partial execution can
never be presented as48passed. `skipped` is always0 because unavailable required
coverage fails rather than skips. There is no automatic assertion retry.

Normal completion, errors, deadline and SIGINT/SIGTERM/SIGHUP converge on one
shared finalization promise. Persistent owned signal listeners remain installed
through asynchronous teardown, including while helper signal handlers reap their
owned Chrome and remove themselves. Browser close has its own shared promise so
normal-close and finalization cannot independently close or falsely certify the
same resources. The process exits only after that finalization path completes.

Every outer helper launch **call** is recorded before invocation; this is not
the same as an actual Chrome launch attempt. During interrupted
launch, finalization waits up to3s for returned ownership, then closes any known
owned browser. Failed or still-pending launches are **cleanup unverified**, even
if zero browser objects were returned: opaque helper cleanup is not independent
absence evidence. The helper has one inherited SLOW_START retry, announced by its exact inspected
stderr notice: `[cdp] browser did not report a debug port within 20000ms - reaped
it and retrying the launch once`. A temporary observer around each helper call
preserves the original stderr receiver, arguments, callback and return value;
observation itself never throws. It is restored when the call settles, or by
finalization if a launch remains pending. A different stream writer is not
overwritten; loss of observation is treated as unverified.

The notice records a second actual launch attempt, but the first attempt's
resources are opaque to this harness. Even a successful returned browser then
fails acceptance: finalization closes/verifies that known owned browser while
retaining the lease and marking overall cleanup unverified for independent
inspection of the first attempt. No hook or helper source change is introduced.
This inherited launch retry is distinct from acceptance assertions: assertions
are never retried, and an observed launch retry cannot produce a passing report.
The report remains failed and the lease is retained for root
inspection; there is no broad process scan, kill or profile deletion. A returned
browser's group and profile must both be absent after its bounded owned cleanup.
Group absence uses read-only `ps -axo pid=,ppid=,pgid=,comm=` metadata, matching
the inspected supervisor approach, with a1s timeout/4MiB bound per query and a3s
polling window. Every nonempty row must parse and the current harness PID must
be present. Query errors, incomplete/malformed output or an omitted harness PID
are uncertainty, not absence; failure retains the lease. The script neither
uses signal-zero as a metadata query nor signals unknown processes.
The local HTTP server's close callback must complete before lease release.

The lease is released only after verified owned-browser and server cleanup and
only if its exact contents still identify this script's token. SIGKILL or
uncertain launch/cleanup can leave a stale file; the integrator must inspect
recorded ownership and actual termination before manual recovery. No broad
Chrome kill, profile wildcard deletion or other actor's tree/storage is touched.

If a failure may be pre-existing (especially known Mac viewport/keyboard
assertions), classify it by inspecting source and an appropriate isolated
baseline reproduction. Do not weaken the expected behavior or silently replace
the failed acceptance check. Preserve raw stdout/stderr, report, source hash,
ref and cleanup evidence. The revised script is not yet executed, so the corrected48-case behavior
remains operationally unverified.

## Limits

- Headless Chromium and synthetic viewport/keyboard wiring; no Safari, real iOS
  keyboard, OS-native picker, IME, accessibility-reader or physical-device claim.
- Local real TTF metrics, with host-specific CJK fallbacks; no live Google Fonts
  delivery verification.
- Representative UI/error/status journeys, not exhaustive visualization of all
  250strings, every refusal, every plural category or the documented existing
  hardcoded singleton English path.
- Multi-card generation uses plural `other`; structural/unit reviews cover all
  named forms separately. Numerical chord data compares against English for
  locale invariance; it does not replace the established engine correctness tests.
- Full settings fit is measured separately across its full approved domain.
  Exact-head Linux CI, all mutants, independent language/code reviews and actual
  final DEV evidence remain separate required gates. This artifact proves none
  merely by loading or syntax-checking.

Source references inspected: `tests/helpers/cdp.js`, `tests/e2e.test.js`
I18N/DI/IB/TB journeys, `tests/import.test.js` IH composition cases,
`src/engine/importer.js`/`core.js`, `index.html` language application and
Add/Edit/generation consumers, `tools/sync_i18n.py`, and the previously reviewed
external DEV harness. No scripts from those references were executed.

## Independent review amendments

The held pre-execution review found and corrected six issues: desktop static
sidebar closure, signal/main-finally finalization races, unverifiable failed
launch/server cleanup, vacuous keyboard visibility and missing focus proof,
partial localized-error matching, and a wrongly borrowed target-size tolerance.
The48-cell matrix, literal input/data invariants and document SHA checks are
unchanged. No assertion was weakened; these corrections are syntax-checked only
and require renewed independent review before any browser execution.

The subsequent narrow review also identified the helper's opaque internal
SLOW_START retry. The outer-call ledger now distinguishes observed actual
attempts, and exact retry-notice observation conservatively blocks success and
lease release. This instrumentation is syntax-checked only, with no runtime
validation claimed.

## First integrator-run failure and scope correction

The retained local run2 logs failed in the first English journey because this
harness incorrectly expected a pan on the Scale tab. The accepted
`docs/plans/2026-10-19-sheet-tabs.md` supersession S1 explicitly says that tab draws
no pan; `index.html` places `#scale-preview` under hidden `#scale-panel-layout`.
Existing DI pan visibility tests can pass vacuously on zero height and are stale
against this later accepted design. Follow-up owner: browser-suite maintenance
lane should review/update those obsolete DI expectations under its own reviewed
plan; no app/CSS or repository test change belongs to this acceptance correction.

The revised keyboard scope checks real Scale-tab inputs and tab state; preview
existence/accepted size is tested separately on Layout. The48 journeys,16keyboard
cases,64field checks and16error checks remain, plus96explicit Layout preview
checks. This is a harness-state correction to the current spec, not tolerance
relief or an application regression waiver.

Run2 teardown also reported signal-zero `EPERM`; it did not establish absence.
Root separately verified the owned Node56080, Chrome56148 group and profile absent
and removed only the owned stale lease; provenance is
`naturalness-local-run2-recovery.json`. Those prior failed logs/recovery records
are preserved. The revised metadata query must be reviewed before another run;
there is no automatic retry of this failed acceptance assertion.
