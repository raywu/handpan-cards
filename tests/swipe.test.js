// HPE.swipe - the pure card-swipe core (thresholds, decisions, momentum curve).
// The app aliases these names (index.html), and tests/app.test.js keeps proving
// the aliases; these cases pin the module itself and kill the mutants
// re-anchored to src/engine/swipe.js.
const { test, describe } = require("node:test");
const assert = require("node:assert");
const { loadEngine } = require("./helpers/engine.js");

const S = loadEngine(["swipe"]).swipe;
const plain = (o) => JSON.parse(JSON.stringify(o));

describe("swipe core", () => {
  test("constants are the plan's values", () => {
    assert.strictEqual(S.COMMIT_PX, 18);
    assert.strictEqual(S.FLING_PX_MS, 0.15);
    assert.strictEqual(S.FLING_WINDOW_MS, 100);
    assert.strictEqual(S.SLOP_PX, 10);
    assert.strictEqual(S.TILT_DEG_PER_PX, 0.05);
    assert.strictEqual(S.TILT_MAX_DEG, 8);
    assert.strictEqual(S.OUT_MS, 220);
    assert.strictEqual(S.BACK_MS, 260);
    assert.strictEqual(S.IN_MS, 180);
    assert.strictEqual(S.IN_PX, 24);
    assert.strictEqual(S.EASE, "cubic-bezier(.2,.7,.25,1)");
    assert.strictEqual(S.OUT_EASE, "cubic-bezier(.4,0,1,1)");
    assert.strictEqual(S.MOMENTUM_MIN_MS, 140);
    assert.strictEqual(S.MOMENTUM_MAX_MS, 320);
    assert.strictEqual(S.MOMENTUM_FLOOR_PX_MS, 1.5);
  });

  test("decision commits strictly past COMMIT_PX, left = next", () => {
    assert.strictEqual(S.decision(18, 0, 0), 0);
    assert.strictEqual(S.decision(18.5, 0, 0), -1);
    assert.strictEqual(S.decision(-18.5, 0, 0), 1);
    assert.strictEqual(S.decision(-15, 0, 0), 0);
  });

  test("decision: a drag past the commit distance steps toward the swipe (20px)", () => {
    assert.strictEqual(S.decision(-20, 0, 0), 1);
    assert.strictEqual(S.decision(20, 0, 0), -1);
  });

  test("decision: a small drag below the commit distance does not navigate", () => {
    assert.strictEqual(S.decision(5, 0, 0), 0);
    assert.strictEqual(S.decision(-1, 0, 0), 0);
  });

  test("decision: a slow drag between the slop and the commit distance does not navigate", () => {
    assert.strictEqual(S.decision(12, 0, 0), 0);
    assert.strictEqual(S.decision(-15, 0, 0), 0);
  });

  test("decision: a short fast fling commits and a slow drag of the same length does not", () => {
    assert.strictEqual(S.decision(-15, 0, -0.16), 1);
    assert.strictEqual(S.decision(15, 0, 0.16), -1);
    assert.strictEqual(S.decision(-15, 0, -0.14), 0);
  });

  test("decision flings only in the drag direction and past the slop", () => {
    assert.strictEqual(S.decision(-15, 0, 0.9), 0, "a reversed velocity must not commit");
    assert.strictEqual(S.decision(-10, 0, -5), 0, "below the slop must not commit on velocity alone");
    assert.strictEqual(S.decision(-11, 0, -5), 1);
  });

  test("decision never commits when the drag has travelled further vertically than horizontally", () => {
    assert.strictEqual(S.decision(20, 25, 0.9), 0);
    assert.strictEqual(S.decision(20, 19, 0.9), -1);
  });

  test("tilt is TILT_DEG_PER_PX per px and clamps at TILT_MAX_DEG", () => {
    assert.strictEqual(S.tilt(100), 5);
    assert.strictEqual(S.tilt(-100), -5);
    assert.strictEqual(S.tilt(1000), 8);
    assert.strictEqual(S.tilt(-1000), -8);
  });

  test("xf composes the translate and the tilt", () => {
    assert.strictEqual(S.xf(100), "translate3d(100px,0,0) rotate(5deg)");
    assert.strictEqual(S.xf(-1000), "translate3d(-1000px,0,0) rotate(-8deg)");
  });

  test("releaseDecision: a tap that never moved rests with no hop and eats no click", () => {
    assert.deepStrictEqual(
      plain(S.releaseDecision({ dx: 3, dy: 0, vx: 0, moved: false, cancelled: false, blocked: false, reducedMotion: false })),
      { kind: "rest", dir: 0, eatClick: false });
    assert.deepStrictEqual(
      plain(S.releaseDecision({ dx: 3, dy: 0, vx: 0, moved: true, cancelled: false, blocked: false, reducedMotion: false })),
      { kind: "spring", dir: 0, eatClick: true });
  });

  test("releaseDecision: a committing drag flies and eats the trailing click", () => {
    assert.deepStrictEqual(
      plain(S.releaseDecision({ dx: -40, dy: 0, vx: 0, moved: true, cancelled: false, blocked: false, reducedMotion: false })),
      { kind: "fly", dir: 1, eatClick: true });
  });

  test("releaseDecision: a cancelled drag eats no click", () => {
    const r = S.releaseDecision({ dx: -40, dy: 0, vx: 0, moved: true, cancelled: true, blocked: false, reducedMotion: false });
    assert.strictEqual(r.eatClick, false);
    assert.strictEqual(r.dir, 1);
  });

  test("releaseDecision: under reduced motion a committing drag rests but keeps its direction", () => {
    assert.deepStrictEqual(
      plain(S.releaseDecision({ dx: -40, dy: 0, vx: 0, moved: true, cancelled: false, blocked: false, reducedMotion: true })),
      { kind: "rest", dir: 1, eatClick: true });
    assert.strictEqual(
      S.releaseDecision({ dx: 3, dy: 0, vx: 0, moved: true, cancelled: false, blocked: false, reducedMotion: true }).kind,
      "rest");
  });

  test("releaseDecision: a blocked drag never steps", () => {
    assert.strictEqual(
      S.releaseDecision({ dx: -40, dy: 0, vx: 0, moved: true, cancelled: false, blocked: true, reducedMotion: false }).dir, 0);
  });
});

describe("swipe outTiming", () => {
  function start(t, dx) {
    const m = t.easing.match(/cubic-bezier\(([-\d.]+),\s*([-\d.]+)/);
    return (parseFloat(m[2]) / parseFloat(m[1])) * (t.end - Math.abs(dx)) / t.duration;
  }

  test("outTiming: an unclamped release flies linearly at its own speed", () => {
    const t = S.outTiming(-2, 1, -54, 654);
    assert.strictEqual(t.end, 654);
    assert.strictEqual(t.duration, 300);
    const m = t.easing.match(/cubic-bezier\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)/);
    assert.strictEqual(m[1], m[2]);
    assert.strictEqual(start(t, -54), 2);
  });

  test("outTiming: a fast flick clamps at MOMENTUM_MIN_MS and still starts at its release speed", () => {
    const t = S.outTiming(-10, 1, -54, 654);
    assert.strictEqual(t.duration, 140);
    assert.ok(Math.abs(start(t, -54) - 10) / 10 < 0.01);
    const m = t.easing.match(/cubic-bezier\(([-\d.]+),\s*([-\d.]+)/);
    assert.ok(parseFloat(m[2]) <= 1);
  });

  test("outTiming: a slow or zero-velocity release starts at the floor and clamps at MOMENTUM_MAX_MS", () => {
    for (const [vx, dir, dx] of [[0, 1, -54], [-0.2, -1, 54]]) {
      const t = S.outTiming(vx, dir, dx, 654);
      assert.strictEqual(t.duration, 320);
      assert.ok(Math.abs(start(t, dx) - 1.5) / 1.5 < 0.01);
    }
  });

  test("outTiming: a velocity against the flight direction counts as zero", () => {
    for (const [vx, dir, dx] of [[3, 1, -54], [-3, -1, 54]]) {
      const t = S.outTiming(vx, dir, dx, 654);
      assert.ok(Math.abs(start(t, dx) - 1.5) / 1.5 < 0.01);
    }
  });

  test("outTiming: a card dragged past dist still flies forward", () => {
    const t = S.outTiming(-3, 1, -900, 654);
    assert.strictEqual(t.end, 1110);
    assert.strictEqual(t.end - 900, 210);
    const v = start(t, -900);
    assert.ok(v > 0);
    assert.ok(Math.abs(v - 3) / 3 < 0.01);
  });

  test("outTiming: the curve stays monotone, in range and forward for every input", () => {
    function monotoneY(y1, y2) {
      let prevY = -Infinity;
      for (let i = 0; i <= 100; i++) {
        const t = i / 100, mt = 1 - t;
        const y = 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t;
        if (y < prevY - 1e-9) return false;
        prevY = y;
      }
      return true;
    }
    for (let vx = -12; vx <= 12; vx += 0.5) {
      for (const dir of [1, -1]) {
        for (const absDx of [0, 200, 654, 1200]) {
          const dx = dir < 0 ? absDx : -absDx;
          const t = S.outTiming(vx, dir, dx, 654);
          assert.ok(t.duration >= 140 && t.duration <= 320, `duration vx=${vx} dir=${dir} dx=${dx}`);
          assert.ok(t.end - absDx >= 210 - 1e-9, `span vx=${vx} dir=${dir} dx=${dx}`);
          const m = t.easing.match(/cubic-bezier\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)/);
          const [x1, y1, , y2] = m.slice(1).map(Number);
          assert.ok(x1 > 0 && x1 <= 1, `x1 vx=${vx}`);
          assert.ok(y1 >= 0 && y1 <= 1, `y1 vx=${vx}`);
          assert.ok(monotoneY(y1, y2), `monotone vx=${vx} dir=${dir} dx=${dx}`);
        }
      }
    }
  });
});
