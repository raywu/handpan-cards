const pf = require(process.cwd() + "/tools/probe/panel_fit.js");
const { launch } = require(process.cwd() + "/tests/helpers/cdp.js");
const http = require("http"), fs = require("fs");
(async () => {
  const [, , htmlPath, cellsJson] = process.argv;
  const html = fs.readFileSync(htmlPath, "utf8");
  const srv = http.createServer((q, r) => { r.setHeader("content-type", "text/html"); r.end(html); });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${srv.address().port}/index.html`;
  const cells = JSON.parse(cellsJson);
  const out = {};
  for (const fm of ["fallback", "real"]) {
    const b = await launch({ realFonts: fm === "real" });
    await pf.prepareBrowser(b, url);
    await b.eval(`await_ = 0; return true;`).catch(() => {});
    out[fm] = {};
    for (const [w, h] of cells) {
      await b.setViewport(w, h, false);
      await b.settle();
      const modes = await b.eval(`
        return ["A","B","S"].map((m) => {
          const c = window.__pf.one(m);
          const groups = [...document.querySelectorAll("#settings-panel > .panel-group")].map((g) => g.getBoundingClientRect().height);
          const ph = document.getElementById("panel-prog-heading");
          return { needed: c.needed, avail: c.avail, groups, H: ph ? ph.getBoundingClientRect().height : null,
            g: ph ? parseFloat(getComputedStyle(ph).marginTop) : null, scrollH: document.getElementById("settings-panel").scrollHeight };
        });`);
      out[fm][`${w}x${h}`] = modes;
    }
    await b.close();
  }
  srv.close();
  console.log(JSON.stringify(out));
})();
