# Reviewed production-target acceptance artifact

Frozen temporary script, not an installed workflow or Claude change. Independent engineering and UX reviews cleared the exact adapter and stage plan before execution. Original local/dev script remains unchanged; only the explicit main allowlist and fixed production URL were added. Runtime success must be reported separately.

Script SHA256: `125db76274b2531aeb234724f2f0b1e184140b149301e8dbd0edf3876e922c13`.
Plan SHA256: `38ce14c3aa5822e2594468660fb670e3ae978c938be24e3ba85bbfcbf5cfc1c1`.

Extract the JavaScript verbatim beside an inspected disposable evidence directory, verify SHA, read the exact plan and reserve the sole host browser lease. Requires the existing inspected helper/fonts, matching clean release ref and the bounded reviewed supervisor.

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
assert(['local', 'dev', 'main'].includes(target), '--target must be local, dev or main');
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
  passed: false, skipped: 0, records: [], reachDiagnostics: [], identities: [], ownedBrowsers: [], helperLaunchCalls: [], cleanup: [], errors: [],
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
    if (report.errors.length && browser) {
      try {
        const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        const file = OUT.replace(/\.json$/, '') + '-failure.png';
        fs.writeFileSync(file, Buffer.from(shot.data, 'base64'), { flag: 'wx' }); report.failureScreenshot = file;
      } catch (e) { report.failureScreenshotError = e.message; }
    }
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
// Causal observations only: no application private state/functions are called.
const REACH_SNAPSHOT = `function snapshot(selector) {
  const e=document.querySelector(selector);if(!e)throw Error('missing control');
  const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return {id:e.id,tag:e.tagName,classes:e.className&&String(e.className),l:r.left,r:r.right,t:r.top,b:r.bottom,w:r.width,h:r.height,scrollTop:e.scrollTop,scrollLeft:e.scrollLeft,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,overflowX:c.overflowX,overflowY:c.overflowY,display:c.display,position:c.position};};
  const r=e.getBoundingClientRect(),v=visualViewport,viewport={l:v?v.offsetLeft:0,t:v?v.offsetTop:0,r:v?v.offsetLeft+v.width:innerWidth,b:v?v.offsetTop+v.height:innerHeight};
  const ancestors=[];let clip={...viewport};
  for(let p=e.parentElement;p;p=p.parentElement){const c=getComputedStyle(p),q=rect(p);if(/^(auto|scroll|hidden|clip)$/.test(c.overflowX)){clip.l=Math.max(clip.l,q.l+p.clientLeft);clip.r=Math.min(clip.r,q.l+p.clientLeft+p.clientWidth);}if(/^(auto|scroll|hidden|clip)$/.test(c.overflowY)){clip.t=Math.max(clip.t,q.t+p.clientTop);clip.b=Math.min(clip.b,q.t+p.clientTop+p.clientHeight);}if(p.closest('#scale-sheet')&&(/^(auto|scroll|hidden|clip)$/.test(c.overflowX)||/^(auto|scroll|hidden|clip)$/.test(c.overflowY)))ancestors.push(q);}
  const hit=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2),body=document.querySelector('#scale-sheet .sheetbody'),surface=document.querySelector('#scale-sheet .sheetsurf');
  return {target:rect(e),viewport,clip,clippingAncestors:ancestors,activeId:document.activeElement&&document.activeElement.id,sheetClasses:document.getElementById('scale-sheet').className,inSheet:!!e.closest('#scale-sheet'),body:rect(body),surface:rect(surface),footer:rect(document.getElementById('scale-foot')),guidance:rect(document.getElementById('scale-guidance')),hit:!!hit&&e.contains(hit),occludingElement:rect(hit),occludingHTML:hit?hit.outerHTML.slice(0,1000):null,wheel:window.__naturalReachWheel||null};
}`;
function reachable(m) {
  const r=m.target,c=m.clip;
  return r.w>0&&r.h>0&&r.l>=c.l-.5&&r.r<=c.r+.5&&r.t>=c.t-.5&&r.b<=c.b+.5&&m.hit;
}
async function reach(selector) {
  const measure=()=>browser.eval(REACH_SNAPSHOT+`return snapshot(${stringify(selector)});`);
  const d={context,selector,before:await measure()}; report.reachDiagnostics.push(d); write();
  if(reachable(d.before)){d.repositioned=false;write();return;}
  d.repositioned=true;
  if(d.before.inSheet){
    // A real wheel turn is the documented reader gesture that releases focus
    // pinning; pick only a currently visible, hit-tested sheet-body point.
    const point=await browser.eval(`const body=document.querySelector('#scale-sheet .sheetbody'),surf=document.querySelector('#scale-sheet .sheetsurf'),a=body.getBoundingClientRect(),b=surf.getBoundingClientRect(),v=visualViewport,L=Math.max(a.left,b.left,v.offsetLeft),R=Math.min(a.right,b.right,v.offsetLeft+v.width),T=Math.max(a.top,b.top,v.offsetTop),B=Math.min(a.bottom,b.bottom,v.offsetTop+v.height);if(!(R>L&&B>T))return null;for(const fy of [.5,.25,.75])for(const fx of [.5,.25,.75]){const x=L+(R-L)*fx,y=T+(B-T)*fy,hit=document.elementFromPoint(x,y);if(hit&&body.contains(hit)){window.__naturalReachWheel=null;document.getElementById('scale-sheet').addEventListener('wheel',e=>{window.__naturalReachWheel={trusted:e.isTrusted,deltaY:e.deltaY,targetId:e.target.id};},{once:true,passive:true});return {x,y,visiblePort:{l:L,r:R,t:T,b:B},hitId:hit.id,hitTag:hit.tagName};}}return null;`);
    d.wheelPoint=point;write();assert(point,'no visible hit-tested sheet scrollport point for reader handoff');
    const deltaY=(d.before.target.t+d.before.target.b>point.visiblePort.t+point.visiblePort.b?1:-1)*Math.min(40,(point.visiblePort.b-point.visiblePort.t)/4);
    d.wheelDeltaY=deltaY;
    await browser.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:point.x,y:point.y,deltaX:0,deltaY});
    await settle();d.afterWheel=await measure();write();
    assert(d.afterWheel.wheel&&d.afterWheel.wheel.trusted&&d.afterWheel.wheel.deltaY===deltaY,'trusted reader wheel handoff not observed');
  }
  d.immediateAfter=await browser.eval(REACH_SNAPSHOT+`document.querySelector(${stringify(selector)}).scrollIntoView({block:'center',inline:'nearest'});return snapshot(${stringify(selector)});`);write();
  await settle();d.settled=await measure();write();
  assert(reachable(d.settled),'unreachable control after single reader handoff; possible existing accessibility defect: '+selector+': '+stringify(d.settled));
}
async function click(selector) {
  await reach(selector); await browser.click(selector); await settle();
  const f=await browser.eval(`const e=document.querySelector(${stringify(selector)});return {field:e.matches('input,textarea,select'),focused:document.activeElement===e,activeId:document.activeElement&&document.activeElement.id};`);
  if(f.field)assert(f.focused,'pointer did not focus requested field: '+selector+': '+stringify(f));
}
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
  else if (target === 'main') URL_APP = 'https://handpan.raywu.org/';
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

## Exact reviewed plan

# Staged main-release acceptance adapter — review plan

Status: author-prepared, syntax/source-diff validation only. Independent engineering
and design review must clear the frozen source before ROOT executes any browser,
server or network request. No application, repository, Claude, configuration or
original frozen harness edit is authorized by this artifact.

## Scope and frozen provenance

Original frozen script: `naturalness-acceptance.cjs`, SHA256 `1bc5cb48e2bf09273c1f0e8e05a6f0cd4d3afaae0a1b12251feb38d6824c71cc`.
New temporary script: `naturalness-release-acceptance.cjs`, SHA256 `125db76274b2531aeb234724f2f0b1e184140b149301e8dbd0edf3876e922c13`.
Exact adapter diff: `naturalness-release-acceptance.diff` beside this plan.

Only two source sites change: the target allowlist/error now accepts `main`, and
its routing maps `main` to the fixed URL `https://handpan.raywu.org/` supplied
by ROOT from its previous confirmed production receipt. `local` remains default;
`dev` routing is unchanged. No arbitrary URL argument, fallback-to-production
behavior or inferred target is added. Unknown targets still fail before lease,
output, browser or server creation. No production reachability was probed here.

## Preserved acceptance contract

All journey bodies, fixtures, assertions, execution counts, font checks, data
invariance, full localized error comparisons, pointer/focus/geometry/44px bounds,
wheel handoff diagnostics, screenshot policy, console checks, launch observation,
cooperative lease, owned-resource cleanup and timeout handling are byte-identical.
The original840s maximum internal deadline and reviewed900s outer supervisor remain.
Matrix:8locales ×2font modes ×3viewports =48unique full journeys;16keyboard cases
with64focused fields;16localized error/keyboard checks;96positive Layout previews;
24real-font Edit screenshots. No skip or partial matrix is a successful run.

Every local and production journey still requires the actual Chrome document's
HTTP200 response body SHA256 to equal index.html at `--expected-ref`, matching
frame/loader and completed response; service-worker substitution is rejected.
Canonical embedded-table equality is checked against that exact Git ref. Each
stage's HTML can differ from QA DEV and previous release stages; use its own
expected-ref HTML hash, never an earlier stage's or DEV's HTML hash. ROOT resolves
the stage and verifies the separate pinned table manifest described below before
accepting that release source. The script has no stage CLI and receives only the
exact expected ref; no canonical comparison or assertion changes are needed.

No DEV-only noindex assertion exists in the frozen script and none is added or
removed. Production header/served-resource checks remain separate ROOT evidence;
this adapter does not establish deployment indexing/hosting correctness by itself.
Existing limitations (headless Chrome, simulated keyboard, repository-font
interception, no full Mac-suite repair/native-device/native-human certification)
remain accurate for both targets.

## Stage-aware table provenance — resolved by ROOT, not the script

ROOT reports the user-ordered main queue as **#548 → #554 → #559 → Naturalness**.
This plan follows that order; ROOT verifies each stage's actual authorization,
reviewed source/ref and prerequisites before execution. Do not merge or certify a
later stage on the strength of an earlier stage's receipts.

| Stage | Pinned expected translated tables | What stage acceptance establishes |
|---|---|---|
| Initial C / #548 | The original seven non-English canonical table blobs from #548 head `845eed4673342545fd1f6282d2f523e108911d90` | Runtime acceptance under the historical C wording, not final Naturalness copy certification |
| SO-D / #554 | Preserve those same original seven #548 blobs while applying only the separately authorized documentation stage | Factual/source checks and exact unchanged app/table hashes; reuse prior runtime evidence when identical. New48runs are optional unless relevant runtime changes are demonstrated |
| Resources / #559 | Preserve those same original seven #548 blobs while applying only the separately authorized Resources stage | Runtime acceptance at this stage's exact local/production HTML; not Naturalness copy certification |
| Final Naturalness | All seven non-English canonical table blobs must equal owner-QA DEV candidate `69c7bd389fcf923a6258774383f75ea6413e35c4` byte-for-byte | Final Naturalness runtime acceptance, requiring a new full48journey run against the final source HTML hash |

The seven locales are de, fr, it, es, ja, zh-Hant and zh-Hans. English remains an
unchanged input/UI convention control: ROOT separately verifies its canonical
blob against the approved English baseline/QA69 before each stage. A stage
manifest records stage ID, reviewed release ref, expected table-source ref and
seven per-locale blob/SHA256 identities, English control, expected HTML SHA256,
actual main merge ref and evidence paths as applicable. ROOT derives and checks
these exact values separately; this author does not fabricate a stage manifest or
claim any stage passed. Missing or mismatched manifest blocks that stage.

The initial C local and production runs still exercise all48journeys using their
historical canonical wording. They cannot be reused as proof of final translated
copy, final HTML identity or final Naturalness coverage. Final Naturalness local
and actual-production48journeys remain mandatory at their own exact refs, with
all unchanged checks, counts and cleanup. Runtime-changing stages follow the per-stage sequence below; documentation-only554 does not require an invented48-run gate. Prove its app/table bytes unchanged and use factual/source checks; rerun48 only if relevant runtime changes are actually found. No old receipt substitutes for current-source identity verification. This is a plan-only provenance clarification, not a new script
parameter or assertion, nor authority to alter application/Claude behavior.

## Reviewed execution sequence — ROOT only after clearance

1. For the next stage in the ordered queue, ROOT resolves the clean dedicated
   release checkout and exact reviewed source ref; confirms stage-scoped user
   main-release consent, stage-manifest table identity, installed helper/fonts
   and sole host-browser availability. Do not reuse/change other owners'
   worktrees. Validate required runtime-changing stages/targets independently; documentation-only554 may reuse runtime evidence only after exact unchanged app/table identity is proved.
2. For a runtime-changing stage, before merge run this adapter with target `local` against the release checkout
   and immutable reviewed head under the existing supervisor. Use a fresh output
   basename matching `naturalness-*.json` beside the script; supervisor name must
   differ from inner report basename. Supply an explicit unique lease-owner.
3. Check all48records/counts, actual identities, required screenshots and both
   cleanup layers; do not accept an exit code alone. Preserve any failed run.
4. For a runtime-changing stage, after independently reviewed exact-head fullCI and authorized main integration,
   wait for actual production deployment and verify expected main ref/resources.
   Run target `main` with the actual main merge ref and the matching clean release
   tree. A stale production body fails its hash; do not weaken identity or replace
   response content, alter headers, use a mirror, or accept a partial matrix.
5. ROOT/independent reviewer reconcile final production counts, screenshots,
   network body identities and cleanup before reporting release verification.

Illustrative command arguments (placeholders MUST be replaced; not executed here):
`node naturalness-release-acceptance.cjs --root ROOT_RELEASE_CHECKOUT --expected-ref REVIEWED_REF --target local --lease-owner root/naturalness-release-local --out PATH/naturalness-release-local-UNIQUE.json`.
Post-merge uses `--target main`, actual verified merge ref and a different fresh
output/lease-owner. The fixed origin is the sole added network destination.

## Failure and recovery

Missing source/helper/browser, wrong target/ref, stale HTML, mismatched table,
failed assertions, console errors, incomplete matrix, deadline, opaque internal
retry or cleanup uncertainty all remain failures. Never reinterpret them as a
release pass or retry an assertion with relaxed limits. Preserve report/screenshot
and inspect owned resources; a retained lease is not permission for broad cleanup.
Expected deployment lag can be diagnosed with existing authorized read-only checks;
a later execution needs a fresh output and confirmed lease cleanup. ROOT verifies
consent for the named ordered queue; that consent does not grant unrelated held
feature releases, reordered stages or Claude changes.

## Author validation and review gate

Original adapter author validation was exact two-site diff, original hash
preservation and `node --check` only. This subsequent update changes this plan
only. Adapter SHA256 remains
`125db76274b2531aeb234724f2f0b1e184140b149301e8dbd0edf3876e922c13`.
The syntax check does not execute the script or establish local/production success. No browser, server, network or Git mutation was
performed by this adapter author. ROOT obtains separate independent engineering
and design clearance of these exact hashes, then owns execution. Rollback removes
only the unused new temporary adapter/evidence, preserving original and receipts.
