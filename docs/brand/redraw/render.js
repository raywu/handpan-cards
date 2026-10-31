// node render.js in.svg out.png width height  -> SVG on the mock's ground colour
const { chromium } = require('playwright'); const fs = require('fs');
(async () => {
  const [inp, out, w, h] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const svg = fs.readFileSync(inp, 'utf8');
  await p.setContent(`<body style="margin:0;background:#171511">${svg.replace('<svg ', `<svg style="display:block;width:${w}px;height:${h}px" `)}</body>`);
  await p.screenshot({ path: out }); await b.close();
})();
