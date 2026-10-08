// Pointer gestures on the layout plate, for the unit layer (Lane DR2b).
// The sandbox plate sits at (200, 200) at scale 1, so a hit circle's centre
// on the screen is its viewBox centre plus 200. Touch time is the sandbox's
// virtual clock: nothing moves until app.advance() is called.
const assert = require("node:assert");

const noteNode = (app, name) => {
  const h = app.hits().find((n) => String(n.getAttribute("aria-label")).startsWith(name + ","));
  assert.ok(h, `no hit target for ${name}`);
  return h;
};
const centre = (h) => {
  const r = h.getBoundingClientRect();
  return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, r: (r.right - r.left) / 2 };
};
const send = (app, h, type, pointerType, x, y, id = 1) =>
  app.pointer(h, type, { pointerType, pointerId: id, clientX: x, clientY: y, buttons: type === "pointerup" ? 0 : 1 });
const down = (app, name, pointerType = "mouse", at) => {
  const h = noteNode(app, name);
  const c = at || centre(h);
  send(app, h, "pointerdown", pointerType, c.x, c.y);
  return { h, x: c.x, y: c.y, type: pointerType };
};
const moveTo = (app, g, x, y) => send(app, g.h, "pointermove", g.type, x, y);
const release = (app, g, x, y) => send(app, g.h, "pointerup", g.type, x, y);
const ghostEls = (app) => app.created.filter((e) => e.className === "panghost" && e.parentNode);
const ghostCentre = (g) => ({
  x: parseFloat(g.style.left) + parseFloat(g.style.width) / 2,
  y: parseFloat(g.style.top) + parseFloat(g.style.height) / 2,
});

/** A mouse drag of `from` onto the point (x, y): press, a first move of 6 px to
 *  lift, the move to the point, the release. Returns the gesture. */
function mouseDragTo(app, from, x, y) {
  const g = down(app, from, "mouse");
  moveTo(app, g, g.x + 6, g.y);
  moveTo(app, g, x, y);
  release(app, g, x, y);
  return g;
}
const mouseDrag = (app, from, to) => {
  const c = centre(noteNode(app, to));
  return mouseDragTo(app, from, c.x, c.y);
};
/** A touch drag: hold 250 ms, then carry the finger so the ghost (36 px above
 *  it) centres on the point. */
function touchDragTo(app, from, x, y) {
  const g = down(app, from, "touch");
  app.advance(250);
  moveTo(app, g, g.x, g.y + 20);
  moveTo(app, g, x, y + 36);
  release(app, g, x, y + 36);
  return g;
}
const touchDrag = (app, from, to) => {
  const c = centre(noteNode(app, to));
  return touchDragTo(app, from, c.x, c.y);
};

module.exports = { noteNode, centre, send, down, moveTo, release, ghostEls, ghostCentre, mouseDragTo, mouseDrag, touchDragTo, touchDrag };
