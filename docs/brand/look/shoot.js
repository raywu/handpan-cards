// Screens of the real app and pages with a direction's CSS injected.
// usage: node shoot.js <direction.css | -> <outdir> [baseurl] [scale-page.css]
// The scale-page CSS (optional 4th arg) is injected into scale pages,
// handpan-101 and 404; the 1st into the app. Cards are untouched: scale-page
// cards live in shadow roots that page CSS cannot reach.
const {chromium} = require('playwright');
const fs = require('fs'), path = require('path');
const [css, out, base = 'http://127.0.0.1:8765/', pcss] = process.argv.slice(2);
const appCSS = css && css !== '-' ? fs.readFileSync(css, 'utf8') : '';
const pageCSS = pcss ? fs.readFileSync(pcss, 'utf8') : appCSS;
fs.mkdirSync(out, {recursive: true});
(async () => {
  const b = await chromium.launch();
  async function page(w, h, scheme = 'dark') {
    const ctx = await b.newContext({viewport: {width: w, height: h}, colorScheme: scheme, deviceScaleFactor: 1});
    await ctx.addInitScript(() => { try { localStorage.setItem('hp_consent', 'denied'); } catch (e) {} });
    return ctx.newPage();
  }
  async function app(p, route, extra) {
    await p.goto(base + route, {waitUntil: 'networkidle'});
    if (appCSS) await p.addStyleTag({content: appCSS});
    await p.waitForTimeout(300);
    if (extra) { await extra(p); await p.waitForTimeout(450); }
  }
  const shots = [];
  for (const [w, h] of [[380, 800], [1280, 860]]) {
    let p = await page(w, h);
    await app(p, '#deck=d-amara-10'); shots.push([p, `main-${w}`]); await p.screenshot({path: `${out}/main-${w}.png`});
    await p.click('#card'); await p.waitForTimeout(700); await p.screenshot({path: `${out}/flipped-${w}.png`});
    if (await p.isVisible('#settings-trigger')) await p.click('#settings-trigger'); await p.waitForTimeout(500); await p.screenshot({path: `${out}/settings-${w}.png`});
    await p.click('#about-open', {force: true}); await p.waitForTimeout(500); await p.screenshot({path: `${out}/about-${w}.png`});
    await p.close();
    for (const scheme of ['dark', 'light']) {
      p = await page(w, h, scheme);
      await p.goto(base + 'scales/d-amara-10/', {waitUntil: 'networkidle'});
      if (pageCSS) await p.addStyleTag({content: pageCSS});
      await p.waitForTimeout(300);
      await p.screenshot({path: `${out}/scalepage-${scheme}-${w}.png`});
      await p.close();
    }
    p = await page(w, h);
    await p.goto(base + 'handpan-101/', {waitUntil: 'networkidle'});
    if (pageCSS) await p.addStyleTag({content: pageCSS});
    await p.waitForTimeout(300); await p.screenshot({path: `${out}/handpan101-${w}.png`}); await p.close();
  }
  // each built-in scale, main view, 380
  for (const id of ['d-kurd-10', 'd-amara-10', 'd-amara-9', 'c-sharp-hijaz-9', 'f-low-pygmy-18']) {
    const p = await page(380, 800);
    await app(p, '#deck=' + id); await p.screenshot({path: `${out}/scale-${id}-380.png`}); await p.close();
  }
  await b.close();
  console.log('ok', out);
})().catch(e => { console.error(e); process.exit(1); });
