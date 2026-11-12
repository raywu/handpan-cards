// Spec-first tests for the bounded SPS sheet-body fixture. The reviewed fixture
// amendment requires the shipped body's membership without claiming browser
// capture/bubble, native selection or touch-to-click fidelity.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { boot } = require("./helpers/sandbox.js");

function sheetBody(app) {
  const body = app.sandbox.document.querySelector(".sheetbody");
  assert.ok(body, "sheetBody:true must expose the shipped anonymous sheet body");
  return body;
}

test("SPS fixture: opt-in exposes one anonymous body inside the existing sheet surface", () => {
  const app = boot({ layout: true, sheetBody: true });
  const body = sheetBody(app);
  assert.equal(app.sandbox.document.querySelectorAll(".sheetbody").length, 1);
  assert.equal(body.tagName, "DIV");
  assert.equal(body.id, "", "the fixture must not invent a shipped control id");
  assert.equal(body.parentElement, app.els["scale-sheet"].firstElementChild);
  assert.equal(app.els["scale-sheet"].contains(body), true);
  assert.equal(body.closest(".sheetbody"), body);
});

test("SPS fixture: tabs panels fields preview and Layout controls share body ancestry", () => {
  const app = boot({ layout: true, sheetBody: true });
  const body = sheetBody(app);
  // These memberships are literal expectations from the shipped sheet skeleton,
  // not a list inferred from sandbox ancestry or a recognizer's chosen target.
  for (const id of [
    "scale-tabs", "scale-tab-scale", "scale-tab-layout",
    "scale-panel-scale", "scale-panel-layout", "scale-name", "scale-box",
    "scale-ding", "scale-top", "scale-inner", "scale-bottom",
    "scale-preview", "scale-layout-reset", "scale-anchor-one",
    "scale-anchor-between", "scale-swatches", "scale-drawer-status",
  ]) {
    assert.equal(body.contains(app.els[id]), true, id + " belongs inside the body");
    assert.equal(app.els[id].closest(".sheetbody"), body, id + " has the same closest body");
  }
  assert.equal(app.els["scale-top"].closest("#scale-panel-scale"), app.els["scale-panel-scale"]);
  assert.equal(app.els["scale-swatches"].closest("#scale-panel-layout"), app.els["scale-panel-layout"]);
});

test("SPS fixture: header guidance and pinned footer controls remain outside the body", () => {
  const app = boot({ layout: true, sheetBody: true });
  const body = sheetBody(app);
  for (const id of [
    "scale-back", "scale-title", "scale-field-msg", "scale-msg", "scale-layout-state",
    "scale-foot", "scale-footslide", "scale-next", "scale-generate",
    "scale-delete-row", "scale-delete", "scale-lip",
  ]) {
    assert.equal(body.contains(app.els[id]), false, id + " is not a body descendant");
    assert.equal(app.els[id].closest(".sheetbody"), null, id + " has no body ancestor");
  }
});

test("SPS fixture: moved tabs follow supplied markup instead of a control-id membership list", () => {
  const original = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const blocks = original.match(/<div id="scale-tabs"[^>]*>[\s\S]*?<\/div>/g);
  assert.equal(blocks && blocks.length, 1, "the negative fixture needs the one shipped tab strip");
  const opening = '<div class="sheetbody">';
  assert.equal(original.split(opening).length - 1, 1);
  // Deliberately move the real tab block just before the body. Both panels stay
  // inside it. A body fixture that unconditionally adopts scale-tabs is blind
  // to this malformed membership and must fail this independent negative case.
  const html = original.replace(blocks[0], "").replace(opening, blocks[0] + "\n" + opening);
  const app = boot({ layout: true, sheetBody: true, html });
  const body = sheetBody(app);
  for (const id of ["scale-tabs", "scale-tab-scale", "scale-tab-layout"]) {
    assert.equal(body.contains(app.els[id]), false, id + " moved outside the body");
    assert.equal(app.els[id].closest(".sheetbody"), null);
  }
  for (const id of ["scale-panel-scale", "scale-panel-layout", "scale-top", "scale-swatches"]) {
    assert.equal(body.contains(app.els[id]), true, id + " stayed inside the body");
    assert.equal(app.els[id].closest(".sheetbody"), body);
  }
});

test("SPS fixture: omitted and false opt-in preserve the existing body-free layout fixture", () => {
  for (const opts of [{ layout: true }, { layout: true, sheetBody: false }]) {
    const app = boot(opts);
    assert.equal(app.sandbox.document.querySelector(".sheetbody"), null);
    assert.equal(app.sandbox.document.querySelectorAll(".sheetbody").length, 0);
  }
});
